# RecallCam development guide

## Scope of the initial scaffold

The repository now has separate `front/`, `backend/`, and `worker/` folders, plus `shared/` Python contracts/configuration. One root Python distribution installs backend, worker, and shared packages. Native API/worker processes can run on supported Windows, macOS, or Linux environments; inference addresses and device preferences are configuration.

Implemented foundations:

- Next.js/TypeScript pages and a browser-to-backend liveness check.
- FastAPI process-liveness route and an explicit HTTP 501 query placeholder.
- A neutral seven-stage sequential runner and unimplemented stage boundaries.
- An injected checkpoint-store protocol, not a production persistence adapter.
- Shared typed environment settings and an initial execution context.
- Compose infrastructure with persistent PostgreSQL, Redis, Qdrant, and SILO volumes.
- A repeatable private S3 bucket initialization service.

Not yet implemented: video uploads/library APIs, camera management, application database migrations, authentication/audit, Redis publishing/consumption, durable job claims and recovery, processing stages, HTTP model adapters, retrieval/grounding, LangChain/tool loops, and evidence/citation checks. Placeholder pages and TODO handlers must not be represented as working product features.

## Sources of requirements and choices

The [cahier des charges](RecallCam_Cahier_des_Charges.md) remains unchanged and authoritative. [Architecture](Architecture.md) and [Sequential pipeline](Sequential_Pipeline.md) record supplemental decisions. Deployment changes do not remove any evaluation or feature requirements.

The source specification names MinIO among recommended tools. For this scaffold, choose [SILO](https://silo.pgsty.com/download/) as the S3-compatible object-storage deployment. [MinIO's community repository](https://github.com/minio/minio) is archived and no longer maintained; its existing source remains AGPL-licensed. This is a maintained deployment substitution behind an S3 interface, not an edit to the original requirements.

Image versions and credentials/ports are documented in the root `.env.example`. SILO server compatibility variables retain their `MINIO_*` names; use provider-neutral `S3_*` application settings. The selected SILO release is `RELEASE.2026-10-18T00-00-00Z`.

## Setup and daily commands

Follow the [root README](../README.md) for platform-specific environment activation and startup commands. Start infrastructure with `docker compose up -d`; start API and front in separate terminals. The worker currently supports `python -m recallcam_worker --show-pipeline` rather than actual queue consumption.

Run commands from the repository root unless a command explicitly changes directory. Python settings read the root `.env`; Next.js reads `front/.env.local`. Keep secrets out of committed files and frontend public environment variables. The ignored `data/` directory is for future local scratch files; persisted object data lives in Docker volumes.

Default exposed infrastructure ports bind to `127.0.0.1`. Remote teammates can run their own stack or configure a deliberately reachable shared deployment. There is no assumption that every teammate uses one developer's machine. Model services remain outside the API/worker and are reached over HTTP.

## Implementing modules

Add stage work behind `worker/src/recallcam_worker/stages/`. Each stage runs across the current video before the next stage starts. Save and validate outputs before returning successfully. Implement durable checkpoints/claims before connecting real queue processing; the runner's protocol does not provide persistence by itself.

Place online agent and retrieval work under `backend/src/recallcam_backend/query/`. Tool functions expose typed application operations; model calls use HTTP adapters in `shared/`, and model weights must not be loaded by the API or worker. A provider URL alone is not sufficient if its protocol differs from the selected adapter.

Processing settings are versioned in `configs/pipeline.yaml`. These values are a draft policy and are not yet consumed by TODO handlers. Shared job context includes a processing configuration revision to avoid reusing checkpoints from a different configuration. Complete domain schemas must follow Section 8 before modules exchange real records.

## Dependency maintenance

`pyproject.toml` declares the Python project and developer tools. Rebuild the development lockfile using a supported Python environment with pip-tools installed:

```sh
python -m pip install "pip-tools>=7.5,<8"
python -m piptools compile --extra dev --output-file requirements-dev.lock pyproject.toml
```

Install with the lockfile, then install the repository editable with `--no-deps`. Front uses npm with `package-lock.json`; use `npm ci` for repeatable installs. Keep declarations and locks in the same change. Do not commit `.venv`, `node_modules`, generated media, local credentials, downloaded weights, or infrastructure data.

## Verification

The README lists the exact Python test, lint, format, frontend typecheck/build, and Compose validation commands. Scaffold tests check stage ordering, stop-on-failure behavior, checkpoint revision isolation, explicit TODO failures, endpoint configuration, and honest API responses. These are not model-quality or indexing-throughput measurements.

Docker Compose can validate syntax without a running engine. Actual infrastructure verification additionally checks PostgreSQL/Redis health, Qdrant readiness, SILO readiness, and successful bucket initialization. Do not infer that the services run solely because `docker compose config` succeeds.

The initial scaffold is verified locally on macOS ARM64; Windows/AMD64 should be verified by the team as development proceeds. No real video or licensed dataset needs to be uploaded to check this scaffold.

Verification recorded on 2026-10-20: seven Python tests passed; Ruff and Black checks passed; frontend TypeScript checking and production build passed; the editable Python packages imported outside the repository; worker stage inspection printed the specified order; Compose configuration validated; PostgreSQL and Redis were healthy; Qdrant and SILO readiness returned HTTP 200; bucket initialization exited successfully; and a temporary S3 object completed a write/read/delete round trip. No real indexing or model-quality result is claimed by these checks.
