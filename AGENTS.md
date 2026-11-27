# RecallCam agent instructions

RecallCam is a video search and investigation platform with timestamped evidence. Work from the repository documents, not assumptions from a previous chat.

## Team identity and task readiness

- Read [Team work split](docs/Team_Work_Split.md) when starting work. It assigns processing and retrieval tasks, stable task IDs, handoffs and initial dependencies.
- At the start of a new chat, if the user's identity is unknown, ask which member is working: Mohamed Elgheith, Ali, Gheith Mahmoud, Boutheina or Ons. Clarify an ambiguous "Gheith"; Mohamed Elgheith and Gheith Mahmoud are different members. Reuse identity explicitly established in the current chat. Do not infer it from the operating-system account or Git author, or save personal session identity in committed files. Read-only orientation may proceed while awaiting the answer; wait to choose person-specific implementation work.
- Before implementing a task, inspect the current code, contracts, migrations and relevant verification notes. State the assigned task ID, next deliverable and whether it can start now, start with fixtures, or is waiting for a named dependency. Identify the missing output/owner and offer independent work when live integration must wait. The work split's dated snapshot is not proof of current readiness.
- Default to the member's assignments while honoring explicit requests for other authorized work. Coordinate shared contract/migration changes with their owners; follow the specification's contract approval rules. Never present a fixture, TODO, worker heartbeat or unvalidated index as completed live processing/retrieval.
- Update the work split when agreed ownership or dependency expectations change, and regenerate its team PDF. Keep the source specification unchanged.

## Read before implementation

1. [Cahier des charges](docs/RecallCam_Cahier_des_Charges.md): authoritative requirements, module specifications, scope, data contracts, evaluation, and acceptance criteria.
2. [Architecture](docs/Architecture.md): backend/worker boundaries, Redis queue, storage, HTTP inference, and deployment configuration.
3. [Sequential pipeline](docs/Sequential_Pipeline.md): indexing order, activity selection, redundancy handling, batching, and recovery.

For application/authentication work also read [PostgreSQL application design](docs/PostgreSQL_App_Design.md), [Authentication and administration](docs/Authentication_and_Admin.md) and [Recording library](docs/Recording_Library.md). For frontend work read [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md) and [frontend agent instructions](front/AGENTS.md); reuse the shared Tailwind/shadcn UI and notification patterns.

The architecture and pipeline supplement the cahier des charges; they do not override it. Revisit the relevant specification sections for each task. Surface conflicts rather than silently changing requirements or treating examples and recommendations as mandatory values. Record routine implementation decisions without unnecessarily blocking independent work.

## Architecture rules

- FastAPI owns application logic, user requests/responses, uploads, storage coordination, video/job registration, job status, and the specified online query workflow.
- A separate background worker owns all video-indexing orchestration and processing. Share domain code and schemas in the same repository where useful.
- Keep all background and periodic work in the worker. FastAPI serves policy and preview requests; the worker runs [opt-in retention](docs/Recording_Retention.md) through the shared recording deletion path.
- Use a Redis-backed job queue. Queue one job per video using identifiers/storage references; manage chunks and batches inside that job. Keep video/image bytes and large outputs out of Redis.
- Recording upload/FFprobe/one-thumbnail generation belongs to the backend and never automatically enqueues processing. Administrators can explicitly request separate worker playback conversion after a decoding error; preserve originals. Read [Playback preparation](docs/Playback_Preparation.md) for RQ/JSON, durable outbox, recovery and deletion rules. Header media-worker presence means playback preparation, not indexing readiness.
- Keep durable metadata, tracks, events, and job progress in PostgreSQL. Preserve the specified vector, lexical/BM25, and object-storage representations. Qdrant is the specification's recommended vector database.
- VLM and LLM inference run in separate services reached through HTTP. Neither FastAPI nor the worker loads their weights or performs their inference in-process. Use provider adapters with normalized application interfaces.
- The current VLM choice is Qwen3-VL-4B-Instruct. The tested MLX 4-bit artifact is a deployment option, not a platform requirement. CV/tracker and embedding choices follow the specification and evaluation.

## Sequential indexing rules

Initial order for one video:

```text
Prepare video and timeline
→ CV, tracking, attributes, events, activity/redundancy selection
→ Visual embeddings
→ VLM chunk captions via HTTP
→ LLM summaries via HTTP
→ Text embeddings of captions and summaries
→ Validate/finalize indexes and record completion
```

- Start with one active indexing job and one model stage at a time. Finish the stage across the video before switching models; bounded batches, including size one, are allowed.
- Start CV sampling at 5 FPS, within the specification's range. Resolution and VLM frames per chunk remain configurable; candidate keyframe frequency is not a mandatory VLM request rate.
- Use activity and temporal change to select VLM inputs, then remove redundant views. Object presence alone is insufficient. Preserve tracking, dwell facts, static-period coverage, meaningful changes, and fallback checks for detector misses.
- Caption active chunks factually. Do not infer entry from a single still image, invent intent or timestamps, or repeat a previous event as a new event. Use original timeline metadata and supported tracking evidence.
- Preserve original footage, absolute/relative timestamps, and evidence links. Compression reduces repeated work, not elapsed source time. Maintain tracking continuity and avoid double-counting overlaps.
- Persist stage/batch checkpoints and use idempotent writes. Recover interrupted jobs and enqueue failures without duplicating events or vectors. Never label unfinished required work as complete.
- Reuse models throughout their stage. Coordinate resource release with services when needed; sequential requests do not automatically unload externally hosted models.

## Configuration and shared contracts

- Support different development platforms through configuration and adapters, not machine-specific application branches. There is no single Mac/Windows hardware target.
- Configure service URLs, model IDs, API styles, credentials, timeouts, storage, and supported devices. Commit a documented `.env.example`; exclude personal `.env` files and secrets.
- Use portable paths and stable storage keys. API and worker must reach the same stored data. Localhost addresses and GPU availability are deployment-specific.
- Share versioned Pydantic/JSON Schema contracts. Preserve camera/video/chunk/track/event identifiers, timestamp conventions, evidence references, and producer versions. Follow the specification's contract-change process.
- Version prompts and processing/model settings; capture effective settings per job without storing secrets. Keep compatible embedding spaces for indexing and retrieval.
- Preserve the specified privacy, dataset-licence, audit, citation, abstention, and deletion requirements. A configurable HTTP endpoint does not authorize sending restricted footage to an external provider.

## Development and verification

- Inspect the current repository before changing it. The project has `front/`, `backend/` (including `query/`), `worker/`, and `shared/`, with authentication/admin/camera, recording-library and explicit playback-preparation code and migrations. Read [README](README.md) and [Development](docs/Development.md). AI stage TODOs, indexing-job consumption/checkpoints and RAG remain unimplemented; do not claim successful indexing.
- Compose runs frontend, backend, a media worker, migration service, PostgreSQL, Redis, Qdrant and SILO with persistent volumes. Only VLM/LLM inference stays native/external through HTTP. Read [Containers](docs/Containers.md) before deployment/configuration work. Playback conversion is explicitly enqueued; the worker also sweeps retention when enabled. Optional standby runs neither. Keep storage settings provider-neutral.
- Keep changes focused and reviewable. Do not overwrite unrelated teammate work. Preserve the source specification; document implementation choices separately.
- When scaffolding, document actual install, service-start, worker-start, lint, format, and test commands in a README and keep dependency/lock files consistent. Follow the specification's Python/tooling guidance.
- Use fixtures and mocked HTTP responses for integration work without model hardware. Keep real inference checks separate; never report fixture or repeated-image cache results as independent model benchmarks.
- Run relevant checks for the change and report results and limitations honestly. Prioritize contract, job recovery, timestamp/overlap, selection, provider-adapter, and evidence correctness checks as those components are implemented. Documentation-only changes need link/content checks rather than invented application test runs.
- Keep these instructions concise and update the linked documents when implemented behavior changes. Unresolved queue-library, storage-provider, and threshold choices are not already settled by illustrative examples.
