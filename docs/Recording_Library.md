# Recording library and service visibility

Implemented slice: private video uploads, recording metadata, filtered library, original playback, title/description edits, retry and deletion. This supplements the cahier des charges (M1/M7, Sections 4/5/8/10) and [PostgreSQL application design](PostgreSQL_App_Design.md). AI indexing, CV, embeddings, model calls and RAG remain outside this slice. [Explicit playback preparation](Playback_Preparation.md) separately adds browser compatibility copies through RQ; uploads enqueue nothing.

## User workflow

An administrator selects an active camera, the original file, a title and the camera's recording start date/time. The form resolves the UTC offset using the camera's IANA timezone on that date; ambiguous daylight-saving times require an explicit offset, and nonexistent local times are rejected. The backend validates the supplied offset against the camera timezone and saves an immutable timezone snapshot and absolute timestamp. Later camera timezone changes do not rewrite existing videos.

Upload first registers metadata (`pending`), then sends the raw file with an authenticated streaming PUT. Video bytes are written to a generated scratch path, checked against the registered size and configured limit, and hashed with SHA-256. They are not converted to base64 or placed in PostgreSQL/Redis. After validation and private storage, the upload becomes `ready`. No indexing job is created. The library and detail view display **Not indexed**; Process remains disabled.

The library has search, camera/upload-state filters, UTC period bounds and pagination. Period matching includes recordings overlapping the selected interval; the upper bound is exclusive. Entries without a known duration are matched by their start time. Each row displays the recording time in its own saved camera timezone. Upload time and recording time are distinct.

All active authenticated roles can view stored recordings. Only administrators can register/upload, edit or delete. Incomplete, failed and deleting entries are visible only to administrators. The detail page supports retries with the original filename/size and keeps camera, source identity and recording timestamps immutable; a correction of that timeline currently requires replacing the unindexed entry.

## FFprobe and FFmpeg

The shared Python Docker image already installs `ffmpeg`, which provides both binaries. Upload inspection/thumbnail extraction runs in the backend container; explicitly requested full conversion runs in the worker container on every development platform. `FFPROBE_BINARY` and `FFMPEG_BINARY` configure executable names; they are not host-specific application branches.

FFprobe reads bounded metadata (duration, dimensions, frame rate and codec); FFmpeg extracts **one thumbnail**, without transcoding or modifying the original. Probe and preview timeouts are configurable. Only the accepted file containers/protocol are enabled for these local operations; playlist/network inputs are excluded. Supported extensions are MP4, M4V, MOV, WebM, MKV, AVI, MPG and MPEG, and the actual media must be readable with a known positive duration. The file picker reads these extensions from `/api/videos/upload-policy`, so frontend acceptance follows the backend rather than a separate hard-coded list. FFprobe and thumbnail extraction share an explicit demuxer allowlist that includes MPEG program streams, as used by the CAVIAR samples. Browser playback still depends on the browser's container/codec support; accepting MPEG does not guarantee that a browser can play its original MPEG-1/2 stream. The upload/detail views explain this limitation. See the [browser codec guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Video_codecs#mpeg-2_part_2_video). An administrator can explicitly queue a compatibility transcode after a decoding failure; it preserves the original and its timeline. Uploading and opening the player never enqueue conversion.

Unreadable media fails upload validation. A thumbnail failure does not discard a successfully stored original; it is recorded as unavailable. This metadata/preview work is not an indexing stage or a model benchmark.

## Storage and playback

`storage/s3.py` implements the current SILO/S3-compatible adapter. `STORAGE_BACKEND=s3` is required for this slice; the older filesystem setting remains a future adapter boundary. Durable references contain bucket/object keys, never local paths or expiring URLs. Generated keys are scoped under `videos/{video_id}/{attempt_id}/`.

Two endpoint settings have different callers:

- `S3_ENDPOINT_URL`: backend/worker access, normally `http://object-storage:9000` in Compose.
- `S3_PUBLIC_ENDPOINT_URL`: browser-reachable storage address, normally `http://localhost:9000`. Change it with the published storage port or remote development host. Never use a Docker-only hostname here or rewrite a URL after signing.

The bucket stays private. Authorized API requests issue short-lived, read-only S3 links for thumbnails/playback; the application's JWT never enters these URLs. The backend logs a playback-authorization event without storing its signed link. Responses and objects use private/no-store caching headers. The shared `RecordingPlayer` integrates Video.js 10.1.0's React Neutral skin around native HTML video playback, retaining direct object-storage range support. Private thumbnails use ordinary image elements, avoiding Next's shared image optimizer/cache.

Signed URLs are temporary bearer capabilities: account changes prevent new grants immediately, while a previously issued link can remain usable until expiry. Default `MEDIA_URL_TTL_SECONDS=300`, configurable between 30 and 900 seconds. The player includes a refresh-link action; an expired thumbnail falls back to its file icon and library refresh requests new links. Do not log, persist or publish these links. See the SDK's [managed transfers](https://docs.aws.amazon.com/boto3/latest/guide/s3-uploading-files.html) and [presigned URL behavior](https://docs.aws.amazon.com/boto3/latest/guide/s3-presigned-urls.html).

The player offers scrubbing, time display, volume, playback speed, scoped keyboard shortcuts, touch seeking, buffering/error presentation and browser-supported fullscreen/picture-in-picture. Shared styling preserves the entire frame with `contain` fitting. Link renewal captures the position, paused state, speed, mute and volume in memory before replacing the source, restoring after metadata loads; browser autoplay policy can require another press of Play. Moving to a different recording clears that state. Open/refresh authorization still goes through the existing audited backend endpoint; the UI does not attempt unauthorized URL extension or an automatic retry loop.

The dependency is `@videojs/react@10.1.0` (Apache-2.0); [installation](https://videojs.org/docs/guides/installation/react) and [skin customization](https://videojs.org/docs/framework/react/guides/customize-skins) explain the upstream integration. No video-hosting or analytics service is configured. The native adapter adds no codec decoder; separately requested worker conversion supplies a private MP4 viewing artifact when needed. No captions, multiple renditions or preview storyboards are supplied yet. The component's `seekTo(seconds)` handle is an integration point for future M7 citations using original-relative seconds; this slice does not implement citation navigation, evidence strips or the event timeline.

## Persistence and recovery

Migration `0002_video_library` adds `videos` and `artifacts`, with source references, size/checksum, absolute recording interval, timezone snapshot, media attributes, upload/metadata/thumbnail states and producer/schema versions. Only thumbnail artifacts are currently produced. Camera references restrict deletion; camera archival preserves library entries. User removal can clear attribution without deleting footage.

An upload claim has an attempt ID and expiring lease. Concurrent active uploads are rejected. A retry may reclaim an expired attempt; it uses a new generated storage prefix. Writes recheck ownership and hold a row lock through final storage writes/commit, so finalization cannot race a library deletion or a new claim. Managed file transfer finishes before scratch cleanup. A dropped HTTP response can leave a successfully stored video; clients check the existing entry before attempting another upload.

Cancellation, ordinary errors and retries retain an administrator-visible entry. Deletion invalidates an incomplete upload and first persists `deleting`, then removes all objects under the video's prefix and deletes metadata/artifact rows. Finalization uses the same row lock: deletion either waits for the storage transfer or prevents it from starting. Storage failure retains a hidden-from-viewers, retryable deleting entry; database cascades do not substitute for object deletion. Minimal administrative audit identifiers remain; footage, descriptions and signed URLs are never copied into audit payloads. Removed resources display descriptive fallback names rather than UUIDs.

A process killed without cleanup can leave scratch files or incomplete S3 multipart transfers. Operational cleanup/lifecycle policy is still required; do not claim crash-proof resumable byte uploads. Retry resends the file, not a partial byte range. Once indexing is implemented, deletion must also coordinate active jobs and all derived vector/lexical/pipeline representations before the route can delete indexed recordings. No such representations are created here.

## API

| Endpoint                                     | Access / behavior                                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `GET /api/videos/upload-policy`              | Administrator; limits and accepted extensions.                                                      |
| `POST /api/videos`                           | Administrator; register camera, filename, size, title/description and offset-aware recording start. |
| `PUT /api/videos/{id}/content`               | Administrator; raw file body, streamed to bounded scratch storage.                                  |
| `GET /api/videos`                            | Authenticated footage readers; paginated search/filter results with temporary thumbnail links.      |
| `GET /api/videos/{id}`                       | Same read policy; recording metadata, no storage credentials.                                       |
| `PATCH /api/videos/{id}`                     | Administrator; title and description only.                                                          |
| `POST /api/videos/{id}/playback`             | Footage readers; authorize a temporary original/thumbnail link, with administrative audit.          |
| `GET /api/videos/{id}/playback-preparation`  | Footage readers; latest explicit preparation status.                                                |
| `POST /api/videos/{id}/playback-preparation` | Administrator; explicitly enqueue/reuse playback conversion, return 202.                            |
| `DELETE /api/videos/{id}`                    | Administrator; retryable coordinated object/metadata deletion, then 204.                            |
| `GET /api/services/status`                   | Authenticated; backend reachability and recent worker presence.                                     |

Typed contracts are in `shared/.../contracts/videos.py` and `front/src/lib/types.ts`. The upload slice introduced no indexing-job schema. Migration 0003 separately adds `media_jobs` for explicit playback preparation, documented in [Playback preparation](Playback_Preparation.md). Audit responses add `actor_name` and `resource_name` alongside stable IDs; the frontend renders names and supports searching them. Names reflect current records, not historical snapshots. This general action audit does not implement the future per-query purpose/returned-evidence audit.

## Header status indicators

The global authenticated header automatically polls service status every 20 seconds while visible, refreshes on visibility return and offers a manual check. Initial state is neutral/checking; confirmed connection is a green check icon, unavailable/unconfirmed state a red cross. Labels/accessibility text supplement color. Manual checks provide toast feedback; background polling does not repeatedly toast failures.

The backend indicator means the authenticated API and its account lookup are reachable, not that every dependency or model is healthy. The media worker writes a small Redis presence key every five seconds with a 30-second TTL; optional diagnostic standby writes every ten seconds. Shutdown removes only its own value; Redis failure is logged without credentials. Missing/stale presence or an unavailable heartbeat store yields a red worker indicator. A green media-worker indicator means **connected for playback preparation**, not AI indexing readiness. Diagnostic standby remains distinctly labeled and consumes nothing.

## Configuration and developer start

`.env.example`, ignored local `.env` and Compose carry the media settings. Default upload size is 10 GiB, with a 3600-second receipt/claim limit, 30-second probe limit and 20-second thumbnail limit. These are configurable application policies, not source-spec throughput targets. Reserve enough scratch disk for concurrent uploads.

Next rewrites stream the raw upload to FastAPI; `BACKEND_PROXY_TIMEOUT_SECONDS` defaults to 3600 to avoid Next's short default rewrite timeout. No Next proxy/middleware body reader is added. Future middleware must not clone/buffer a large upload body; see the [Next body buffering documentation](https://nextjs.org/docs/app/api-reference/config/next-config-js/proxyClientMaxBodySize). A separate reverse proxy needs compatible size/time limits if deployed.

Rebuild after the new boto3/Redis dependencies, then run migrations and start services from the repository root:

```sh
docker compose build
docker compose run --rm migrate
docker compose up -d
```

A failed migration intentionally blocks backend/worker startup; frontend waits for backend health. Infrastructure remains independent. Diagnose with `docker compose logs --tail 100 migrate`; do not remove schema dependencies to hide a migration error, and do not delete persistent volumes to fix it.

## Verification status

Source editing, formatting and dependency-lock regeneration were performed. At the user's request, no automated tests, lint/type checks, builds, live upload/playback requests or browser checks were run. The user's attempted startup exposed an ORM column-argument error; its migration log was read and the source corrected. That diagnosis is not a successful migration result. Migration 0002 has not been applied by the agent. The developer will verify uploads, large transfers, timezone/DST handling, playback/range requests, deletion recovery, access control, audit labels and service indicators.

MPEG support update: MPG/MPEG filename validation, MIME mapping, shared probing/thumbnail demuxer allowance and UI format guidance were updated. No schema/dependency change was needed. Per the user’s existing instruction, no tests, builds, typechecks, FFmpeg runs or browser checks were performed. Reload the upload page after the backend reloads to fetch the updated policy.

Player update: the React player dependency and lockfile, shared component/skin styling and detail-page integration were added. Source formatting only; runtime playback, renewal/restoration, shortcuts, responsive controls and browser capability behavior remain for the developer to verify. Rebuild/recreate the frontend image for its new dependency, as documented in [front/README.md](../front/README.md#recording-player).

Explicit conversion update: migration 0003, RQ/JSON media transport, durable outbox/recovery, worker conversion, preference for ready playback copies and the error/status/request/retry UI are implemented in source. No tests, image build, migration, FFmpeg run or runtime check was performed. See [Playback preparation](Playback_Preparation.md) for commands and limitations.
