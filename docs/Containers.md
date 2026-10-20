# Container development setup

## Service boundaries

`compose.yaml` is the full development deployment. It runs `front` (Next.js), `backend` (FastAPI), `worker`, a one-shot `migrate`, PostgreSQL, Redis, Qdrant, SILO and its one-shot `storage-init`. LLM/VLM servers stay native/outside Docker. No application image downloads their weights or launches their inference runtime.

CV/tracking and embeddings belong to worker/application code as those stages are implemented. Their actual model dependencies and inference are not implemented yet. Container packaging does not implement those stages.

The worker starts with `--media`: one RQ SpawnWorker for explicitly requested playback conversion, backed by durable PostgreSQL media jobs and outbox recovery. It does not run AI indexing. The header identifies media presence as Playback, with a 30-second TTL. Optional `--standby` consumes nothing; `--show-pipeline` prints the unimplemented AI stage order. See [Playback preparation](Playback_Preparation.md) for migration 0003, limits, recovery and deletion behavior.

## Configuration and network addresses

Root `.env` supplies explicit Compose environment values. Application containers do not mount the whole `.env`; frontend does not receive database, storage, signing or model secrets. Build contexts exclude `.env*`, host environments/dependencies and caches. Images install locked dependencies; bind mounts preserve the same source across platforms.

| Caller / destination            | Default address                                                        |
| ------------------------------- | ---------------------------------------------------------------------- |
| Browser → frontend              | `http://localhost:3000` (published `FRONT_PORT`)                       |
| Browser → application API       | Same frontend origin, `/api/*`                                         |
| Next.js server → backend        | `http://backend:8000` (`BACKEND_INTERNAL_URL`)                         |
| Backend/worker → PostgreSQL     | `postgres:5432` in `DATABASE_URL`                                      |
| Backend/worker → Redis          | `redis://redis:6379/0`                                                 |
| Backend/worker → Qdrant         | `http://qdrant:6333`                                                   |
| Backend/worker → object storage | `http://object-storage:9000`                                           |
| Backend/worker → native VLM     | `http://host.docker.internal:1234`, or configured serving host/port    |
| Backend/worker → native LLM     | `http://host.docker.internal:1234/v1`, or configured serving host/port |

Inside a container, `localhost` is that container. Published host ports are for host tools; internal URLs use service ports even when published ports change. Compose `extra_hosts` maps the model host with `host-gateway`; see Docker's [host-service connection guide](https://docs.docker.com/desktop/features/networking/networking-how-tos/), [daemon host-gateway documentation](https://docs.docker.com/reference/cli/dockerd/#configure-host-gateway-ip) and [service configuration](https://docs.docker.com/reference/compose-file/services/#extra_hosts).

The native model server must accept connections from Docker's host gateway. Enable the server's appropriate local-network access/bind setting when necessary. Keep its actual port/protocol in `VLM_BASE_URL`/`LLM_BASE_URL`; the two models need not share a service or port. Remote endpoints can use their configured reachable host instead. Startup and playback preparation do not send model requests. Endpoint flexibility does not override footage licences or privacy rules.

`front/next.config.mjs` uses [Next.js rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites) for `/api/*` and `/health/live`, preserving the paths and bearer header. The browser client defaults to an empty base URL. A deliberate `NEXT_PUBLIC_API_BASE_URL` override can target a browser-reachable API instead, with appropriate CORS origins. `BACKEND_INTERNAL_URL` is server-only configuration. No JWT session or inference moves into the proxy.

Compose publishes ports on loopback by default. Access from another device requires a deliberate bind/host configuration; the same-origin API path then follows the frontend address. Backend OpenAPI remains available on its published port.

## Startup, schema and accounts

From the repository root:

```sh
docker compose up --build -d
docker compose logs -f backend worker front
```

Stop native frontend/backend servers before using their ports. No host `.venv`, `node_modules` or `front/.env.local` is required. Configure root `.env` and its private JWT key first; the [README](../README.md) provides a Docker-only key-generation command.

PostgreSQL's health check gates `migrate`. Successful migration and bucket initialization gate backend/worker startup. Frontend waits for backend liveness. This uses Compose [dependency conditions](https://docs.docker.com/compose/how-tos/startup-order/). Backend health is process liveness, not model availability or proof of indexing readiness. Initialization containers normally complete and exit; a failed initialization blocks dependents.

Compose migration does not seed accounts or reset data. Create the first administrator interactively:

```sh
docker compose exec backend python -m recallcam_backend.cli create-admin --email you@example.com --display-name "Your name"
```

Apply new migrations during development with `docker compose run --rm migrate`. Generate a migration with `docker compose exec backend python -m alembic revision --autogenerate -m "describe change"`, then review its operations. Commands writing bind-mounted files need host permissions appropriate to the container user. Backend startup itself does not create tables.

Existing infrastructure volume names are retained. Do not delete volumes to change deployment mode. Changing PostgreSQL credentials in `.env` does not change the password already stored in an initialized database; coordinate the actual credential change when needed.

## Source, dependencies and data

The Python image is shared by API, migrations and worker. It includes FFmpeg and the current locked application/developer packages. It installs the three Python namespaces editable at bind-mounted paths. Including FFmpeg does not implement ingestion. Future model stages must add their actual dependencies before running.

Frontend dependencies are installed as Linux-compatible packages in its image. Source/public and selected config files are mounted; host `node_modules`, `.next` and `.env.local` are excluded. Next.js writes cache in the container filesystem, avoiding host/container native-binary mixing. After a dependency/lockfile or Dockerfile change, rebuild with `docker compose up --build -d`.

Frontend/backend source reloads automatically. Restart worker after its code changes. Recreate services after environment changes; restarting alone retains the previous container environment. Next.js server config changes require restart/recreation when necessary.

`app_data` shares scratch files at `/app/data` between backend/worker. `model_cache` retains future CV/embedding cache files, not LLM/VLM service weights. Original/derived media still uses the specified S3 representation; scratch storage is not durable evidence storage. Infrastructure volumes retain database, queue, vector index and object storage. `docker compose down -v` deletes named volumes and their contents.

## Device and deployment scope

This is a development stack with reload and bind mounts, not an immutable production deployment. Base images select supported ARM64/AMD64 architecture without forcing emulation on Apple Silicon.

Linux containers on macOS do not expose Apple's MPS accelerator. Local CV/embedding configuration must suit the container (CPU/automatic fallback until another supported runtime is configured). Native Qwen/LLM serving can retain host acceleration. Linux/NVIDIA deployments need deliberate GPU/runtime configuration before selecting CUDA; an environment string alone does not expose the GPU.

## Verification status

At the user's request, no Docker build, Compose launch/config validation, HTTP requests, automated tests, typechecks or browser checks were run for this change. Health checks execute when the user starts the stack; they are not a claim of verified deployment. The earlier native database migration does not validate these images or network paths.

## Recording uploads and service presence

The Python image already installs FFmpeg/FFprobe. New locked boto3/Redis dependencies require a rebuild. [Recording library](Recording_Library.md) describes migration 0002, limits, browser-facing `S3_PUBLIC_ENDPOINT_URL`, temporary private playback and standby heartbeat status. Set the public storage URL to the browser-reachable host/port, retaining the internal Docker endpoint for SDK transfers. `BACKEND_PROXY_TIMEOUT_SECONDS` controls the upload rewrite timeout. No model pipeline is started. For this slice no images or migration were executed by the agent; only migration failure logs were read and the identified source error corrected.

The later media worker adds RQ and migration 0003. [Playback preparation](Playback_Preparation.md) lists the rebuild/migrate/recreate commands and `PLAYBACK_CONVERSION_*` settings, now passed through Compose. It runs CPU FFmpeg in the worker, using shared scratch storage and private S3 artifacts. This change was not built, started, migrated or tested by the agent. Existing Python images must be rebuilt before the source imports RQ.
