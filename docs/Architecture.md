# RecallCam application and processing architecture

This document records architecture choices that supplement the [cahier des charges](RecallCam_Cahier_des_Charges.md). It does not replace its module specifications, shared data contract, privacy rules, acceptance criteria, or MVP/Stage 2 scope. The [sequential pipeline](Sequential_Pipeline.md) describes the processing order and frame-selection policy.

The application separates interactive backend work, background video indexing, storage, and model inference. It supports team development on different operating systems without machine-specific branches in application logic.

## 1. Components and boundaries

```text
User interface
    │ HTTP / supported application streaming connections
    ▼
FastAPI backend
    ├── Application logic, authentication, user requests and responses
    ├── Upload and video storage coordination
    ├── Video/job registration and job-status endpoints
    ├── Query planning, retrieval, grounding and answers as specified
    ├── PostgreSQL / object storage / retrieval indexes
    ├── HTTP → LLM service
    ├── HTTP → VLM service when query verification is required
    └── Enqueue a video job reference → Redis-backed queue
                                              │
                                              ▼
                                      Background worker
                                        ├── Sequential indexing orchestration
                                        ├── CV, activity and frame selection
                                        ├── Visual and text embedding stages
                                        ├── HTTP → VLM service for captions
                                        ├── HTTP → LLM service for summaries
                                        └── Persist outputs and progress

VLM service and LLM service
    Separate inference services, on the same host or a reachable host/provider
    Model weights and inference remain outside FastAPI and worker processes
```

The backend and worker are separate processes. The initial repository uses `front/` for Next.js, `backend/` for FastAPI and its `query/` package, `worker/` for sequential indexing, and `shared/` for Python contracts/settings and adapter boundaries. One root Python package configuration installs the three Python namespaces together. This separation does not require a separate repository or network service for every processing stage. See [Development](Development.md) for what is implemented versus scaffolded.

VLM and LLM are logical service roles. They may be exposed by the same model server using distinct model identifiers, or by different services. Their deployment does not change who owns application logic or indexing orchestration.

## 2. FastAPI backend responsibilities

The backend owns the normal application request/response flow and application logic, including:

- Authentication, authorization, input validation, and the specified audit behavior.
- Camera/video registration and collection of recording-time metadata.
- Upload handling, storage references, and access to original videos and evidence clips.
- Durable job creation, queue publishing, and job status/progress responses.
- The user-query workflow, including planning, retrieval, SQL counts, grounding, citations, answers, feedback, and other specified behavior.
- HTTP calls to the configured LLM and, where required, VLM services for the online query path.

Long video indexing runs in the worker, rather than occupying the request that registered the upload. Upload completion may take time; the asynchronous indexing response is returned after storage and job registration have been handled successfully.

An illustrative flow is:

```text
Upload/register video
    → persist video metadata and storage reference
    → create durable indexing job
    → publish job reference to Redis-backed queue
    → return 202 Accepted with video_id and job_id

Read job status
    → return durable status, current stage, progress and any error
```

Endpoint paths and response fields are implementation details to finalize through the project's shared schemas. This example does not introduce a replacement for Section 8's data contract.

## 3. Background worker responsibilities

The worker owns all background indexing orchestration for a video: preparation, frame sampling, CV, activity/redundancy selection, visual embeddings, caption requests, summary requests, text embeddings, and index finalization.

Calling a model service is part of orchestration. The worker prepares requests and validates/stores responses, while the service performs VLM or LLM inference.

The worker also owns processing checkpoints, stage metrics, resumable execution, and progress updates. It reads and writes storage through shared clients and stable references rather than relying on paths available only to the API process.

Start with one active indexing job and the stage sequence in the pipeline document. Batch size can be one or more items. Multiple queue jobs must not accidentally start multiple indexing pipelines because a queue library defaults to higher concurrency.

The backend can continue serving users while a worker is busy. This is a process-responsibility boundary, not a guarantee that shared compute, storage, or model services will never contend.

## 4. Redis-backed job queue

Queue one indexing job per video. Chunks and their processing batches are internal units of that job, tracked through checkpoints and database records.

The logical job input can be as small as:

```json
{
  "job_id": "job-123",
  "video_id": "video-456"
}
```

The worker resolves the authorized video metadata, storage key, and recorded processing configuration from durable storage. This JSON illustrates logical input; it is not a claim about a queue library's physical Redis key format.

Do not put video bytes, all image bytes, or large model outputs in Redis. Do not enqueue a separate job for every chunk in this initial design. The worker advances stages internally rather than requiring the API to enqueue each following stage.

Use a Redis-backed queue library compatible with the specification's Celery/RQ options. The exact library is still an implementation choice; these documents do not silently select one. Its worker startup and execution behavior must be checked on the team's supported development platforms.

The initial policy is ordinary queue order with one active video job. Job timeouts must accommodate real video processing, and interrupted or stale jobs must be recoverable. Redis execution state is not the sole durable record of application jobs.

## 5. Storage and consistency

| Component | Responsibility |
| --- | --- |
| PostgreSQL | Specified metadata, tracks, events and audit data; durable video/job records and processing progress. |
| Redis | Queue transport and execution coordination; transient queue-library state. |
| Vector database | Specified visual, caption and summary vectors with metadata filters; Qdrant is the specification's recommended choice. |
| Lexical index | BM25 representation of captions, as specified. |
| Object storage | Original videos, selected frames, derived clips and other file artifacts. |

Use a storage interface so a local development directory and a shared object-storage service can implement the same operations. A local directory is a development adapter; it does not remove the object-storage architecture in the specification. The exact production service remains to be chosen.

The initial Compose deployment selects SILO as S3-compatible object storage, with a persistent volume and one-shot private bucket initialization. This deployment choice follows the MinIO community repository's archival; the specification's original wording remains unchanged. Application settings use `S3_*` names, while SILO retains `MINIO_*` server compatibility variables. See the [SILO installation guide](https://silo.pgsty.com/download/) and [MinIO repository status](https://github.com/minio/minio).

Persist a stable object key such as `videos/video-456/source.mp4`, not a developer's absolute home-directory path. If API and worker use a local filesystem, they need access to the same configured data. On different hosts, use storage both can reach; changing the model URL does not make local files shared automatically.

Database writes and queue publishing are separate operations. Handle failures between them: a durable job must be discoverable and re-enqueueable if publishing fails. The concrete mechanism can be an outbox or reconciliation process; do not treat the pair as an atomic cross-system transaction.

Use idempotent writes, stable identifiers, and a claim/lease mechanism appropriate to the selected queue so retries or duplicate deliveries do not create duplicate events, vectors, or concurrent processing of the same video. Persist completed checkpoints and expose partial/failed work accurately.

## 6. VLM and LLM inference through HTTP

Neither FastAPI nor the worker loads VLM/LLM weights or imports their inference runtime to execute them in-process. Both communicate with separate serving services using HTTP clients.

Those services can run locally, on a teammate's computer, on shared infrastructure, or at a compatible provider. Provider flexibility does not change the specification's rules on research data, licences, privacy, or external APIs; a configurable endpoint alone is not authorization to send restricted video frames to it. Text-only external LLM use remains subject to the same applicable requirements.

Keep inference behind application interfaces, for example:

```text
caption_service.caption(selected_frames, supported_context)
text_service.summarize(captions, events)
text_service.plan_query(question, context)
text_service.answer(question, evidence)
```

HTTP adapters translate these operations into a configured server's protocol. They handle authentication, model identifiers, payloads, timeouts, bounded retries, and normalized responses. Domain code should not assume LM Studio or Bionic response fields.

Changing only a URL is sufficient when two services expose the same supported protocol. A different provider protocol requires a matching adapter; it must not spread provider-specific branches through API handlers or pipeline stages.

The current VLM choice is **Qwen3-VL-4B-Instruct**. `lmstudio-community/Qwen3-VL-4B-Instruct-MLX-4bit` is the artifact already tested on one development machine. A different platform or service may expose the same model family under another runtime, artifact, or served identifier. Record the actual model and quantization in provenance; do not assume all variants produce identical results.

The text LLM is independently configurable. CV, tracking, and embedding choices continue to follow their specification modules and evaluation. This document does not require them to use HTTP or choose their exact deployment location.

## 7. Configuration across development platforms

Use one application codebase with typed configuration. Read deployment values from environment variables and version the processing policies/prompts in repository configuration, following the specification's reproducibility requirements.

Commit an `.env.example` with placeholders and documented meanings. Keep personal `.env` files and credentials out of version control. Do not embed a developer's username, absolute paths, host address, model ID, or accelerator choice in application logic.

An illustrative configuration is:

```dotenv
# Deployment configuration; values are examples, not mandatory defaults.
DATABASE_URL=postgresql://recallcam:replace-me@127.0.0.1:5432/recallcam
REDIS_URL=redis://127.0.0.1:6379/0
QDRANT_URL=http://127.0.0.1:6333
STORAGE_BACKEND=filesystem
DATA_DIR=./data

# Separate HTTP model services.
VLM_API_STYLE=lmstudio-native
VLM_BASE_URL=http://127.0.0.1:1234
VLM_MODEL_ID=qwen3-vl-4b-instruct-mlx
VLM_API_KEY=
VLM_TIMEOUT_SECONDS=180

LLM_API_STYLE=openai-compatible
LLM_BASE_URL=https://your-text-model-service.example/v1
LLM_MODEL_ID=replace-with-served-model-id
LLM_API_KEY=
LLM_TIMEOUT_SECONDS=120

# Local processing configuration; choose supported devices per environment.
CV_DEVICE=auto
EMBEDDING_DEVICE=auto
INDEXING_CONCURRENCY=1
```

The example above illustrates the configuration categories. The current implemented settings and SILO/S3 values are defined in the root `.env.example` and `shared/src/recallcam_shared/settings.py`; consult those files for the full deployment configuration. Timeout values are examples to tune, not performance targets. `auto` is currently a configured preference, not implemented device detection; future processing needs an explicit, tested selection policy and an override.

Document URL conventions in each adapter. For example, the native LM Studio adapter can append `/api/v1/chat` to the illustrated VLM base URL, while an OpenAI-compatible chat adapter appends `/chat/completions` to a base URL ending in `/v1`. Avoid duplicating path segments or assuming a fixed port.

`127.0.0.1` means the current process's host or container. A worker running elsewhere needs a reachable address for the model service, database, Redis, and storage. Keep these addresses in deployment configuration. Use path utilities and storage keys for portability rather than hard-coded Windows or macOS path syntax.

Version processing settings separately, including the 5 FPS initial CV profile, chunking/selection policy, prompts, and model/embedding versions. Snapshot the effective settings for each job so changing a developer's environment does not silently change a resumed job's results. Credentials remain deployment secrets, not job metadata.

Use the same embedding model/version and compatible preprocessing when writing and searching a shared collection. A change of embedding space requires a separately versioned collection or re-indexing, rather than mixing incompatible vectors.

## 8. Resource lifecycle and service availability

Keep the selected VLM available during the video's captioning stage. Avoid repeated load/unload cycles between chunks. The worker's sequential order limits competing indexing stages, but a separate service can retain loaded models after requests finish.

When services share constrained hardware with CV or embeddings, coordinate loading, unloading, or idle eviction through the serving layer as supported. Manage only instances the application is responsible for; a worker must not unload an unrelated shared service's model merely because its own stage finished. On independently provisioned services, their residency can remain under the service's control.

Record HTTP failures and preserve completed work. Bounded retries must distinguish transient failures from invalid configuration or rejected input. Missing caption or summary work must remain visible and resumable. Preserve the specification's evidence-only degradation when generative services are unavailable.

## 9. Development and integration

Backend and worker share versioned Pydantic/JSON Schema contracts for identifiers, timestamps, evidence references, and producing-module versions. Follow the specification's contract change process rather than inventing per-developer payloads.

Use recorded fixtures and mock HTTP model responses for application integration tests that do not require model hardware. Keep real inference checks and performance measurements identifiable so fixture results are never reported as model-quality or speed results.

Infrastructure services can use a shared deployment configuration such as Docker Compose, while model services and accelerated worker components run through whichever supported deployment suits the environment. Do not require all team members to use the same accelerator or assume a Linux container exposes every host's GPU identically.

The initial scaffold realizes these folder/service boundaries without implementing the full product. It does not add a team allocation, hardware target, model-selection mandate, or reduced version of the cahier des charges. The intended result remains one application architecture with configurable deployments and a sequential background indexing implementation.
