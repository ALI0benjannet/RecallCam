# PostgreSQL application design

Status: product decisions and proposed application design, with a first implementation/migration for `users`, `cameras` and `audit_events`. Other tables below remain proposed. See [Authentication and administration](Authentication_and_Admin.md) for the implemented slice and its untested status. The [cahier des charges](RecallCam_Cahier_des_Charges.md), especially Sections 4, 5, 7 (M1/M7), 8 and 10, remains authoritative. This document adds application choices alongside [Architecture](Architecture.md) and [Sequential pipeline](Sequential_Pipeline.md).

## 1. Accounts and authorization

Authentication uses signed, expiring JWT access tokens. There is no authentication-session table, refresh-token table or server-side login session. When an access token expires, the user signs in again. Validate the signature, allowed algorithm, expiry, issuer and audience on protected requests; expiry checking alone is insufficient.

Missing, invalid or expired credentials return `401 Unauthorized` with the appropriate Bearer challenge. An authenticated user without permission returns `403 Forbidden`, following [RFC 6750 Section 3.1](https://www.rfc-editor.org/rfc/rfc6750#section-3.1).

Administrators create accounts and assign one of three fixed roles. Public self-registration and configurable permission-management screens are outside this initial design. Permissions are defined centrally in application code and enforced by the backend, including file/evidence access, rather than only by hidden UI controls.

| Feature | Operator | Supervisor | Administrator |
| --- | --- | --- | --- |
| Browse accessible footage, ask questions, view answers/evidence, submit feedback | Yes | Yes | Yes |
| Export evidence and inspect query audit logs | No | Yes | Yes |
| Standing queries, when Stage 2 is implemented | No | Yes | Yes |
| Create users and assign roles | No | No | Yes |
| Manage cameras/videos, upload and enqueue indexing | No | No | Yes |
| Manage retention and model versions | No | No | Yes |

Administrator inheritance of all features is an explicit project choice. Supervisor inheritance follows Section 5.1. A supervisor's additional permissions do not include assigning roles or managing users.

Implemented `users` fields include `user_id`, unique normalized `email`, `display_name`, `password_hash`, constrained `role`, `is_active`, `auth_version`, `created_by`, `created_at`, `updated_at` and record versions. Store password hashes, never plaintext passwords. The first administrator is created with the deliberate bootstrap CLI described in the authentication guide.

Authorization policy: after JWT verification, resolve its `sub` to the current user and use the database's active status and role, so administrator changes take effect without waiting for token expiry. This is an account lookup, not a session record. Token lifetime and signing configuration belong in deployment settings. Client logout discards the token; there is no individual-token revocation store. Password changes/resets or account deactivation increase `auth_version`, invalidating earlier tokens for that account.

Chat conversations and query history are durable application records; they are unrelated to authentication sessions.

## 2. Upload and Process are separate actions

```text
Administrator uploads a file with camera and recording start time
    → store the original in object storage
    → record video metadata and preview information in PostgreSQL
    → show the video in the library as not indexed
    → stop here until Process is selected

Administrator selects Process
    → validate source availability and required metadata
    → create a durable indexing job and outbox event in one transaction
    → publish a small job reference to Redis
    → one worker claims the job
    → persist stage progress throughout processing
    → validate/finalize required indexes before recording success
```

Upload completion does not automatically create an indexing job. The library entry remains available for ordinary video viewing while unindexed; semantic search and indexed-event answers require successfully published processing outputs. A combined Upload and Process UI control, if added later, must explicitly invoke both actions.

Collect the camera and **recording start date, time and timezone/offset**, not just a day or the upload time. A date-only draft may be stored but cannot be queued until its timeline is complete. Derive the recording end from the actual media duration for a continuous recording. Preserve the camera timezone separately from absolute timestamps. Synthetic camera-days follow the specification's source-to-timeline mapping.

Duration, dimensions and thumbnail are library metadata, independent of running CV/VLM/embeddings. Plan bounded media probing and preview generation during upload finalization; do not decode/analyze the whole video in the upload request. Expose pending/failed preview metadata honestly and revalidate the media in the worker's prepare stage.

## 3. Proposed application tables

The following is the proposed application-schema scope. The first migration implements users, camera metadata and administrative audit. Other SQL types, migrations and domain contracts remain to be implemented. Camera line/zone configuration is deferred to perception integration.

| Table | Main fields and responsibility |
| --- | --- |
| `users` | Account fields above; one fixed role per user, administrator-created accounts. |
| `cameras` | `camera_id`, name, description/location, timezone, active status, timestamps. |
| `camera_configurations` | Camera, version, line/zone configuration, creator, timestamps; jobs reference the effective version for reproducible events. |
| `videos` | `video_id`, camera, uploader, original filename, source bucket/key, content type, byte size, checksum when available, recording start/end, duration, width/height/frame rate, upload state, metadata state, timestamps. |
| `artifacts` | Derived file references: video, optional producing job, kind (thumbnail, frame, clip, etc.), bucket/key, size, content type, checksum, timestamps. Media bytes remain in object storage. |
| `jobs` | `job_id`, video, requesting user, type, status, enqueue order, configuration revision and secret-free snapshot, current stage, timestamps, last error. |
| `job_stages` | Job/stage identity, order, status, processed/total units when known, checkpoint, output references, metrics, timestamps, last error. |
| `job_attempts` | Job, attempt number, worker identity, claim/heartbeat/lease information, timing, outcome and error; preserve retry history. |
| `outbox_events` | Durable request to publish an indexing job; payload, ordered identity, delivery attempts, publication time/error. |
| `audit_events` | Actor, action, resource reference, timestamp and bounded metadata; record user/role changes, upload/process actions and other specified audit operations without tokens/passwords. |

Use foreign keys, constrained roles/statuses, nonnegative duration/size, valid time intervals, and indexed camera/time and job/status fields. Preserve Section 8 schema and producer version metadata in exchanged/persisted domain records. Use JSONB for versioned configuration and checkpoints, not as a substitute for typed identity/status/time columns.

Keep upload state, media-metadata state and indexing-job state separate. A failed indexing attempt does not mean the stored upload failed. The UI can derive a video badge from these records rather than maintain a second conflicting copy of job status in `videos`.

Repeated Process requests must return the existing pending/queued/running indexing job for that video. Enforce this in PostgreSQL, for example with a partial unique index over active indexing jobs, rather than relying on disabled buttons. An explicit later reprocess creates a new job/revision; a recoverable retry resumes the same logical job and adds an attempt. Keep an earlier valid index usable until its replacement passes finalization; expose only validated index revisions to normal retrieval.

Pipeline-domain tables (chunks, keyframes, tracks, events, captions, summaries and their links) are still required. Online-query tables (conversations, queries with user/time/purpose, tool calls, returned evidence, answers, citations and feedback) are also still required. They will be designed with their respective contracts; this initial table scope does not remove them. Query audit must preserve every returned clip as required by P5/M7, not merely a generic action entry.

## 4. Queue and progress views

The initial deployment permits **one active indexing job across the application**, with one model stage at a time. Waiting videos use FIFO enqueue order. Creating more worker processes must not bypass the concurrency rule; implement a shared claim/lease with a fencing or equivalent ownership check before enabling processing/recovery.

```text
pending publication → queued → running → succeeded
                                      ↘ failed

Within a running job:
prepare → perception → visual_embeddings → captions
        → summaries → text_embeddings → finalize
```

`pending publication` means a durable request exists but queue publication is not yet confirmed. Queue publishing and PostgreSQL are not one transaction: use the outbox, reconcile duplicate deliveries, and ensure a delayed publication acknowledgement cannot move a running/completed job back to queued. Redis is the execution transport; PostgreSQL owns durable history and progress.

The queue page combines video metadata with job records:

| Display | Data source |
| --- | --- |
| Thumbnail, filename, camera, recording period, duration | Video and artifact records. |
| Awaiting publication / waiting / processing / failed / complete | Durable job state. |
| Current stage | `jobs.current_stage` and its `job_stages` record. |
| Progress within that stage | Processed/total units with a stated unit, when available. |
| Approximate waiting position | Derived from eligible jobs in enqueue order; do not persist a manually updated position column. |
| Retry/error information | Job, stage and attempt records. |

Example: video A is processing at VLM captions, video B is waiting first, and video C is uploaded but has no job. Video C appears in the library, not the processing queue. Show unknown progress/ETA as unknown rather than infer a time estimate from the number of completed stages; stages have different costs.

Read status through backend endpoints backed by PostgreSQL. Periodic polling is sufficient for the initial page; live push updates can be added without changing these ownership boundaries. Do not expose Redis directly to the browser.

## 5. Persistence boundaries and deletion

PostgreSQL stores application records and required pipeline metadata/text. Object storage holds original videos and derived files. Qdrant and the lexical index hold retrieval representations; Redis holds queue transport state. Store stable object keys and identifiers, not local machine paths, large binary payloads or expiring signed URLs in durable references.

Video deletion must coordinate PostgreSQL records, object artifacts, vector/lexical representations and in-flight jobs. Retention and deletion requirements remain those of P6 and Section 10. Database cascades alone cannot delete external artifacts; audit retention must avoid retaining deleted footage or derived sensitive content in audit payloads.
