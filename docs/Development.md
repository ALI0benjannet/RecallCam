# RecallCam development guide

## Scope of the initial scaffold

The repository has separate `front/`, `backend/` and `worker/` folders, plus `shared/` Python contracts/configuration. Compose packages all application/infrastructure services; only LLM/VLM serving stays native/external. One Python image installs backend, worker and shared packages. Addresses and device preferences are configuration across development platforms; see [Containers](Containers.md).

Implemented foundations:

- Next.js/TypeScript pages and a browser-to-backend liveness check.
- FastAPI process-liveness route and an explicit HTTP 501 query placeholder.
- A neutral seven-stage sequential runner and unimplemented stage boundaries.
- An injected checkpoint-store protocol, not a production persistence adapter.
- Shared typed environment settings and an initial execution context.
- Compose infrastructure with persistent PostgreSQL, Redis, Qdrant, and SILO volumes.
- A repeatable private S3 bucket initialization service.
- Full development Compose services, source mounts, one-shot migrations and a frontend API proxy. The initial standby has since been extended with the explicitly requested playback-only RQ consumer.

The next application slice adds login/JWT signing and validation, separate authentication/role middleware, fixed permissions, administrator-created users, account/password changes, camera metadata management, administrative audit, SQLAlchemy/psycopg persistence and an initial Alembic migration. These features connect frontend routes to backend APIs; they have not been tested at the user's request. See [Authentication and administration](Authentication_and_Admin.md) and [UI system](../DESIGN.md).

The [recording-library slice](Recording_Library.md) now adds uploads/library/playback, videos/artifacts migration 0002, audit names and header backend/worker presence. [Playback preparation](Playback_Preparation.md) adds migration 0003, explicit administrator conversion requests, a playback-only RQ consumer and durable outbox/recovery.

Not yet implemented: line/zone camera configuration, indexing-job database migrations, indexing queue consumption/claims/checkpoints, AI processing stages, HTTP model adapters, retrieval/grounding, LangChain/tool loops, query-purpose/returned-clip audit and evidence/citation checks. Placeholder pages and TODO handlers must not be represented as working product features.

## Sources of requirements and choices

The [cahier des charges](RecallCam_Cahier_des_Charges.md) remains unchanged and authoritative. [Architecture](Architecture.md) and [Sequential pipeline](Sequential_Pipeline.md) record supplemental decisions. Deployment changes do not remove any evaluation or feature requirements.

[PostgreSQL application design](PostgreSQL_App_Design.md) records the agreed stateless JWT, fixed-role permissions and explicit upload-then-Process workflow, with application tables and queue/status views. Its users/cameras/administrative-audit subset now has an implementation and migration; uploads/library and playback-preparation jobs are now implemented; indexing queues/checkpoints remain future work.

The source specification names MinIO among recommended tools. For this scaffold, choose [SILO](https://silo.pgsty.com/download/) as the S3-compatible object-storage deployment. [MinIO's community repository](https://github.com/minio/minio) is archived and no longer maintained; its existing source remains AGPL-licensed. This is a maintained deployment substitution behind an S3 interface, not an edit to the original requirements.

Image versions and credentials/ports are documented in the root `.env.example`. SILO server compatibility variables retain their `MINIO_*` names; use provider-neutral `S3_*` application settings. The selected SILO release is `RELEASE.2026-10-18T00-00-00Z`.

## Setup and daily commands

Follow the [root README](../README.md): `docker compose up --build -d` starts application and infrastructure. Stop native frontend/backend servers if they hold the published ports. Inspect the worker with `docker compose exec worker python -m recallcam_worker --show-pipeline`; Compose uses `--media` for explicit playback preparation; AI stages remain unavailable.

Run Compose commands from the repository root. Root `.env` supplies selected environment settings; frontend does not receive backend/model secrets and does not mount `front/.env.local`. Browser calls use the frontend origin and its server-side backend proxy. Backend/worker share `/app/data` scratch storage and a cache volume; object data remains in its separate persistent storage volume. Host `.venv`, `node_modules` and `.next` are excluded from image contexts.

Default exposed infrastructure ports bind to `127.0.0.1`. Remote teammates can run their own stack or configure a deliberately reachable shared deployment. There is no assumption that every teammate uses one developer's machine. Model services remain outside the API/worker and are reached over HTTP.

## Implementing modules

Add stage work behind `worker/src/recallcam_worker/stages/`. Each stage runs across the current video before the next stage starts. Save and validate outputs before returning successfully. Implement durable checkpoints/claims before connecting real queue processing; the runner's protocol does not provide persistence by itself.

Place online agent and retrieval work under `backend/src/recallcam_backend/query/`. Tool functions expose typed application operations; model calls use HTTP adapters in `shared/`, and model weights must not be loaded by the API or worker. A provider URL alone is not sufficient if its protocol differs from the selected adapter.

Processing settings are versioned in `configs/pipeline.yaml`. These values are a draft policy and are not yet consumed by TODO handlers. Shared job context includes a processing configuration revision to avoid reusing checkpoints from a different configuration. Complete domain schemas must follow Section 8 before modules exchange real records.

## Dependency maintenance

`pyproject.toml` declares the Python project and tools. Rebuild the lockfile in a disposable Python service instance with the repository mounted, or a supported local development environment with pip-tools:

```sh
python -m pip install "pip-tools>=7.5,<8"
python -m piptools compile --extra dev --output-file requirements-dev.lock pyproject.toml
```

Install with the lockfile, then install the repository editable with `--no-deps`. Front uses npm with `package-lock.json`; use `npm ci` for repeatable installs. Keep declarations and locks in the same change. Do not commit `.venv`, `node_modules`, generated media, local credentials, downloaded weights, or infrastructure data.

Dockerfiles perform locked installs and editable Python installation. Rebuild images after dependency/lockfile changes with `docker compose up --build -d`. Dependency declarations are not mounted over stale image-installed packages. Source/config mounts handle ordinary code changes; restart worker after changing imported code.

## Verification

The README lists the exact Python test, lint, format, frontend typecheck/build, and Compose validation commands. Scaffold tests check stage ordering, stop-on-failure behavior, checkpoint revision isolation, explicit TODO failures, endpoint configuration, and honest API responses. These are not model-quality or indexing-throughput measurements.

Docker Compose can validate syntax without a running engine. Actual infrastructure verification additionally checks PostgreSQL/Redis health, Qdrant readiness, SILO readiness, and successful bucket initialization. Do not infer that the services run solely because `docker compose config` succeeds.

The initial scaffold is verified locally on macOS ARM64; Windows/AMD64 should be verified by the team as development proceeds. No real video or licensed dataset needs to be uploaded to check this scaffold.

Initial-scaffold verification recorded on 2026-10-20, before authentication/admin changes: seven Python tests passed; Ruff and Black checks passed; frontend TypeScript checking and production build passed; the editable Python packages imported outside the repository; worker stage inspection printed the specified order; Compose configuration validated; PostgreSQL and Redis were healthy; Qdrant and SILO readiness returned HTTP 200; bucket initialization exited successfully; and a temporary S3 object completed a write/read/delete round trip. Those results apply only to that earlier scaffold. No real indexing or model-quality result is claimed by these checks.

The subsequent authentication/admin change deliberately did not run automated tests, lint/type checks, a frontend build, HTTP requests or browser checks because the user requested to test personally. Dependencies were installed and the first users/cameras/audit migration was applied to the local PostgreSQL database as setup; no account was seeded. Setup exposed and corrected dotenv parsing for the fixed `INDEXING_CONCURRENCY=1` policy. Existing scaffold tests may need authentication-aware updates; no new passing-test claim is made.

The later full-container development packaging was not built, launched, config-validated or tested, also at the user's request. Earlier host results do not validate these Docker images. The source specification remains unchanged.

The later UI redesign follows the web-semantique visual reference, updates the shared shell and all existing screens, and adds a real active-camera preview to the overview using the existing camera API. The [UI system](../DESIGN.md) and [frontend instructions](../front/AGENTS.md) document it. Source editing and formatting were performed; no tests, build, typecheck, HTTP requests or browser checks were run. Earlier scaffold verification does not validate the redesigned interface.

The recording-library/status slice was source-edited/formatted and its dependency lock regenerated; no tests, lint/type checks, builds or live application requests were run. The user attempted startup; migrate logs exposed an ORM argument error, which was corrected in source. No successful migration or functional verification is claimed. User-run migration 0002 and stack rebuild are required before trying the new pages.

The later explicit playback-preparation slice adds the RQ/JSON consumer and PostgreSQL media-job outbox/recovery, migration 0003, shared media helpers and the complete player request/status/retry UI. See [Playback preparation](Playback_Preparation.md). Dependency resolution/upstream API inspection and source formatting were performed; no tests, lint/type checks, image build, migration, FFmpeg execution or live checks were run. This does not implement AI indexing.
