# Explicit playback preparation

This application feature supplements the source specification's M1/M7 playback and source-timeline requirements. It does not implement or change the AI indexing pipeline. Upload, playback conversion and indexing are distinct operations, as explicitly requested by the user.

## User flow and permissions

1. Upload saves the original, validates bounded metadata and creates one thumbnail. It queues nothing.
2. Open player requests an authorized temporary URL. The backend prefers a completed playback copy if one exists, otherwise the original.
3. A browser format/decoding failure offers **Prepare playback**. Network errors instead suggest refreshing the link/checking the connection. Browser errors are broad categories: decoding failure may also indicate damaged footage, so conversion is an attempt, not a guarantee.
4. Only an administrator with `videos:manage` can click Prepare playback. Other footage readers see the status and can play completed copies, following the existing role split. No client-reported incompatibility changes the original's metadata or authorizes processing implicitly.
5. The explicit POST creates a durable request, attempts Redis publication and returns 202; it does not wait for FFmpeg. The view shows queued/running stages, success or a safe failure with a manual retry. It polls active jobs every three seconds while visible, updating React state and notifications without a page refresh. Closing/navigating away stops that page's polling, while the already queued worker task continues. A status-request failure is shown with refresh and a toast. Database/queue acknowledgment can take a short time; 202 is acceptance, not conversion success.
6. **Play MP4 copy** opens a newly authorized URL once ready. Indexing still requires its separate future Process action, which remains disabled.

## Persistence, transport and recovery

Migration `0003_playback_preparation` adds `media_jobs`, with schema/producer versions, requester, source checksum, effective recipe, status, stage, attempts, timestamps and safe error. A partial unique index allows one queued/running media request per video. Another allows one published `playback` artifact per video. Each manual retry after failure has a new job ID; duplicate clicks while active return the existing job.

RQ is the selected Redis queue library (`rq==2.12.0` in the lockfile). The `recallcam-media` queue uses JSON serialization and receives only a durable job UUID as the function argument. Footage, source URLs, credentials, captions and large outputs stay out of Redis. RQ's internal keys also hold its own function/status/execution metadata. This media queue is separate from the still-unimplemented indexing-job contract and stage checkpoints.

The PostgreSQL queued rows act as a durable outbox. The worker maintenance thread republishes existing queued requests every five seconds, repairing API publication failure and Redis loss. Stable RQ identities, unique enqueueing and a per-job publisher lock prevent duplicate queue publications. These are retries of an already explicitly authorized request, not automatic new conversion requests.

An ordinary conversion failure is saved in PostgreSQL and raised to RQ as `PlaybackPreparationFailed`; RQ must mark that execution failed rather than report Job OK. Raw SDK/subprocess exception messages and chains are suppressed. Worker diagnostics include the job ID, phase, error class and code-file/function/line locations without source text, local variables, credentials or media URLs. The administrator still chooses when to retry a failed request.

FFmpeg stderr is now drained continuously into a bounded 64 KiB memory tail. A failed exit logs its code and up to 4096 characters after removing control sequences, generated scratch paths, URLs and recognizable credential assignments. No diagnostic file grows on disk, and the database/UI receive a safe error category rather than raw stderr. The child process is killed/waited on timeout or interruption before scratch cleanup. Encoder/version, disk/permission and input-policy errors have distinct messages. Input restrictions, strict decoding and timeline validation are not weakened to hide failures.

Compose runs one RQ `SpawnWorker` using `--media`. A PostgreSQL session advisory lock also serializes conversion execution across accidental extra consumers. The same lock gates recovery: only when no conversion holds it can an interrupted `running` request be returned to the queue. Three interrupted execution attempts exhaust automatic recovery; ordinary decode/storage/conversion failures require an explicit manual retry. Attempt numbers fence stale finalization writes. A permanently missing/damaged/unsupported source fails visibly.

When the AI indexing consumer is implemented, it must coordinate with the same single-active-execution policy; adding a second independent consumer must not make AI indexing and conversion compete for the machine by default.

The maintenance thread publishes `mode=media` presence. The header labels the worker **Playback** and explains that AI indexing is unavailable. Presence confirms an active worker process, not successful conversion or overall dependency health. `--standby` remains an optional diagnostic mode; Compose no longer uses it.

## Worker conversion

`worker/playback.py` resolves trusted source references and settings from PostgreSQL, streams the original to bounded scratch storage, checks its stored size/SHA-256, and calls FFmpeg on local paths. Network/playlist inputs are excluded by the shared demuxer/protocol allowlist. The backend never performs full-video conversion. Shared FFprobe/thumbnail code lives in `shared/src/recallcam_shared/media.py`.

Current recipe `h264-playback/1.1` uses CPU `libx264`, preset `fast`, CRF 18, `yuv420p`, first video/optional first audio stream, AAC at 128 kbit/s, and MP4 `+faststart`. It does not force 5 FPS, trim, downscale or crop. Odd image dimensions are padded by at most one pixel per dimension for H.264 compatibility. Additional audio tracks, chapters and file metadata are omitted from the viewing copy; the original retains them. Rotated/unusual sources may fail current dimension/timeline validation and require a later recipe rather than silently publishing a mismatched copy.

`-copyts -start_at_zero` retains the recording's time spacing while normalizing its initial offset. Recipe 1.1 uses `-fps_mode:v vfr`, encoder time base `1:90000`, MP4 video timescale `90000`, and `-bf:v 0`. Finer encoder/muxer precision reduces timestamp rounding collisions; VFR handling can drop frames with conflicting presentation timestamps, and disabling B-frame reordering avoids additional decoding-time reordering. This is a viewing-copy compatibility policy, not image-content redundancy detection, 5 FPS CV sampling or a guarantee of one-to-one frame preservation. Disabling B-frames may increase copy size. The original remains authoritative for AI processing and precise evidence.

The output must probe as H.264, preserve the expected dimensions (including minimal padding), and match source duration and relative video start within the recorded tolerance (0.1–0.25 seconds, derived from the frame rate). A truncated/output-limited or materially shifted copy is rejected. These metadata checks do not prove frame-by-frame evidence equivalence; source-relative grounding/citation checks remain required when M5/M7 are implemented. Original camera start/end times, original checksum and video metadata are never replaced by copy values. Strict `-xerror` and timeline checks remain enabled. Pending recipe 1.0 jobs keep their original passthrough settings; explicit retry creates a new 1.1 request with captured timing settings. Restart/reload both API and worker so newly requested jobs use the new recipe.

The complete MP4 is privately stored under `videos/{video_id}/playback/{job_id}/playback.mp4`. Final source/state checks and the artifact/job commit hold the video lock also used by deletion. A deletion during CPU work prevents later publication; already-running conversion may finish locally before its output is discarded. Deletion removes the complete video prefix and cascades media-job/artifact rows. Stale Redis references become no-ops. There is no automatic indexed-video deletion coordination because indexing is not implemented.

Temporary directories are cleaned on ordinary completion/failure. Hard process death may leave scratch files, incomplete multipart uploads or unreferenced objects; operational cleanup is still needed. Recovery restarts a conversion rather than resuming encoded bytes. Keep enough scratch space for the input, output and MP4 finalization; stored media size is not the peak scratch requirement.

## API and configuration

| Endpoint                                     | Access and behavior                                                                                                           |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/videos/{id}/playback-preparation`  | Footage readers; latest request or `not_requested`, with no signed URLs.                                                      |
| `POST /api/videos/{id}/playback-preparation` | Administrator; explicitly create/reuse request, return 202.                                                                   |
| `POST /api/videos/{id}/playback`             | Footage readers; prefer published MP4 copy, return `rendition=playback` or `original`; retain audit and temporary URL policy. |

The new `PlaybackPreparationRead` application contract starts at schema `1.0`; the playback response adds `rendition`. Frozen chunk/track/event/citation contracts and the source specification are unchanged. Audit records cover explicit requests, success and ordinary preparation failures using video/job identifiers without footage or URLs.

Configuration is portable across Docker hosts:

- `PLAYBACK_CONVERSION_TIMEOUT_SECONDS=7200`: FFmpeg wall-clock cap; RQ adds 600 seconds for transfers/validation. Large videos can require tuning.
- `PLAYBACK_CONVERSION_THREADS=2`: decoder/encoder/filter thread setting.
- `PLAYBACK_CONVERSION_MAX_BYTES=21474836480`: output cap (20 GiB); incomplete output fails validation.
- Existing FFmpeg/FFprobe paths, probe timeout, storage settings and `/app/data` scratch volume apply. Source download is bounded by its registered original size.

Settings are captured on the durable request; changing environment values applies to newly requested jobs. No host-specific GPU branch or native model service is involved. The UI does not assume every file FFmpeg can inspect can also be fully decoded or converted.

After the dependency update, rebuild the shared Python image, apply the migration and recreate API/worker:

```sh
docker compose build backend
docker compose run --rm migrate
docker compose up -d --force-recreate backend worker
```

The frontend source is mounted for hot reload; if its earlier Video.js dependency has not been installed in the image, also rebuild/recreate `front` as documented in its README.

## Verification status

Source review, dependency lock generation, upstream RQ API inspection and formatting only. At the user's request no automated tests, lint/type checks, build, migration, FFmpeg execution, Docker startup, HTTP playback request or browser check was run. The developer must verify conversion with the supplied MPEG samples, timing, role enforcement, duplicate clicks, worker interruption/Redis recovery, file-size limits and deletion during preparation before relying on it.

On 2026-10-21 the user's first conversion attempt reported `AttributeError` followed by RQ Job OK. Source review found that `StreamingBody.__enter__` returns the raw HTTP response, so calling the wrapper's `iter_chunks()` on that result fails. Download now uses `contextlib.closing` to retain/close the SDK wrapper, as confirmed by the [botocore implementation](https://github.com/boto/botocore/blob/develop/botocore/response.py). Conversion failures are also propagated safely to RQ, rather than returned as success. These fixes were source-edited/formatted only; no successful conversion is claimed. Restart the worker to load the mounted source changes, then explicitly select Retry preparation.

The next user attempt passed download/checksum and reached an FFmpeg failure. Its cause cannot be recovered from that attempt because stderr had been discarded; the generic failure does not establish damaged/unsupported footage. Bounded redacted diagnostics were added so the user's next explicit retry identifies the actual FFmpeg error. No conversion/tests were run by the agent, and no conversion-success claim is made.

The subsequent user log identified equal output DTS values (`previous: 22528, current: 22528`), causing strict muxing to abort. Recipe 1.1 was added for that timestamp conflict. The log establishes the output collision; it does not establish whether the source contains identical timestamps or encoder time-base rounding caused it. The new recipe was source-reviewed/formatted only, with no test, conversion or service restart by the agent; developer retry must confirm the result.

Upstream references: [RQ jobs and JSON serialization](https://python-rq.org/docs/jobs/), [RQ workers](https://python-rq.org/docs/workers/), [FFmpeg options](https://ffmpeg.org/ffmpeg.html).
