# RecallCam

Video search and investigation with timestamped evidence. Docker Compose runs the frontend, backend, worker and infrastructure. Only LLM/VLM inference servers run natively or at another configured HTTP endpoint.

The application currently implements login, fixed-role permissions, administrator-created accounts, camera metadata, private recording uploads/library/playback and administrative audit with readable names. Indexing and RAG remain future work. The worker consumes explicitly requested playback-preparation jobs through RQ; it does not run AI indexing. Uploads still enqueue nothing.

## Project structure

```text
front/       Next.js, TypeScript, Tailwind/shadcn UI, frontend Dockerfile
backend/     FastAPI application and query/RAG modules
worker/      Playback conversion consumer, sequential AI runner and stage TODOs
shared/      Shared Python settings, contracts and database adapters
configs/     Versioned processing policy and prompt location
migrations/  Alembic application database migrations
tests/       Existing scaffold checks
docs/        Requirements, architecture and development guides
Dockerfile   Shared Python image for backend, worker and migrations
compose.yaml Full development stack; native LLM/VLM remain outside Docker
```

## Requirements and configuration

Install a Docker engine with Docker Compose. Host Node.js and Python environments are not required for the Compose workflow. Base images select the host's supported architecture; no Mac/Windows application branches are used.

Copy `.env.example` to `.env` at the repository root. On macOS/Linux use `cp .env.example .env`; on PowerShell use `Copy-Item .env.example .env`. Do not overwrite an existing personal `.env`.

Set a private `JWT_SIGNING_KEY` of at least 32 random bytes. A fresh checkout can generate one without installing Python on the host:

```sh
docker run --rm python:3.12-slim-bookworm python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Copy the result into the private `.env`; the example deliberately has no usable signing key. The existing local environment already has a generated key. Its service URLs were updated for container routing while credentials/model choices and remote endpoints were preserved.

Internal URLs use Compose service names: `postgres`, `redis`, `qdrant`, `object-storage`. Native model URLs use `host.docker.internal` and the actual serving port, or another reachable host/provider address. Model IDs, API styles, credentials, timeouts and device choices remain configurable. See [Containers](docs/Containers.md) for networking and native model access.

## Start the application

Stop previously started native `npm run dev` and Uvicorn processes if they occupy ports 3000/8000. From the repository root:

```sh
docker compose up --build -d
docker compose logs -f backend worker front
```

Compose waits for PostgreSQL, runs the `migrate` service, then starts the application. The private S3 bucket is created by `storage-init`. Both initialization containers normally finish successfully and exit.

| Service                              | Default host address                              |
| ------------------------------------ | ------------------------------------------------- |
| Frontend                             | `http://localhost:3000/login`                     |
| Backend / OpenAPI                    | `http://localhost:8000/docs`                      |
| PostgreSQL                           | `127.0.0.1:5432`                                  |
| Redis                                | `127.0.0.1:6379`                                  |
| Qdrant dashboard                     | `http://localhost:6333/dashboard`                 |
| S3-compatible storage / SILO console | `http://localhost:9000` / `http://localhost:9001` |

The frontend proxies `/api/*` and `/health/live` to `backend:8000`. Private playback/thumbnail links use the separate browser-reachable `S3_PUBLIC_ENDPOINT_URL`, normally `http://localhost:9000`; update it when the storage port or deployment host changes. Browser requests stay on the frontend origin, so Docker-only names never become browser API addresses. Root `.env` configures Compose; `front/.env.local` is not copied or mounted into the frontend container. Only selected frontend settings enter that service.

## Create the first administrator

With the backend running:

```sh
docker compose exec backend python -m recallcam_backend.cli create-admin --email you@example.com --display-name "Your name"
```

Use your chosen account email and enter a password at the hidden prompts. Bootstrap works only for an empty user table; there is no seeded/default password. Existing accounts and data remain in their persistent volumes. Later accounts are created through the administrator's Users page.

See [Authentication and administration](docs/Authentication_and_Admin.md) for roles, password behavior and API surfaces.

## Development and maintenance

Application source and configuration directories are bind-mounted. Next.js and Uvicorn reload frontend/backend code. Host `.venv`, `node_modules`, `.next` and credentials are excluded from image contexts. Dependencies stay inside their images; changing a dependency declaration/lockfile requires rebuilding:

```sh
docker compose up --build -d
docker compose restart worker
docker compose exec worker python -m recallcam_worker --show-pipeline
```

For newly added dependencies and migrations, run `docker compose build`, then `docker compose run --rm migrate`, then `docker compose up -d`. For a migration without dependency changes, apply it with `docker compose run --rm migrate`. Backend startup itself does not create tables. After changing `.env` values, recreate the affected services with `docker compose up -d`; a plain restart does not reload container environment variables.

Named volumes retain PostgreSQL, Redis, Qdrant, object storage, shared scratch data and future local model caches. `docker compose stop` stops services; `docker compose down` removes containers/network and retains data. Adding `-v` deletes named volumes and their stored data.

Current images are development images with reload and bind mounts. A production deployment needs a separate immutable build configuration. Linux containers on a Mac do not expose the host's MPS accelerator; CV/embedding device selection must reflect the container environment. LLM/VLM inference remains native through HTTP.

## Verification commands

For the person performing verification:

```sh
docker compose exec backend python -m pytest
docker compose exec backend python -m ruff check backend worker shared tests
docker compose exec backend python -m black --check backend worker shared tests
docker compose exec front npm run typecheck
docker compose run --rm --no-deps front npm run build
docker compose config --quiet
```

Use a disposable frontend container for production-build checks to avoid conflicting with the running development server. Formatting commands are `docker compose exec front npm run format` and `docker compose exec backend python -m black backend worker shared tests`. Bind-mounted files edited from Linux containers must be writable by the container user; the team can format with its host editor instead.

At the user's request, this containerization change was not built, started or tested. Earlier scaffold/authentication setup results do not validate these container images. No real indexing/model-quality result is claimed.

## Read before implementation

- [Agent instructions](AGENTS.md)
- [Cahier des charges](docs/RecallCam_Cahier_des_Charges.md)
- [Architecture](docs/Architecture.md)
- [Sequential pipeline](docs/Sequential_Pipeline.md)
- [PostgreSQL application design](docs/PostgreSQL_App_Design.md)
- [Authentication and administration](docs/Authentication_and_Admin.md)
- [Recording library and status indicators](docs/Recording_Library.md)
- [Container guide](docs/Containers.md)
- [Product context](PRODUCT.md) and [UI system](DESIGN.md)
- [Development guide](docs/Development.md)

The supplemental documents and container packaging do not reduce the specification's required features, evaluation or privacy/data-handling requirements.

The recording-library/status change adds migration 0002 and locked boto3/Redis dependencies. FFmpeg/FFprobe are provided by the Python image. The header shows live API/worker presence; a connected standby worker does not process videos. [Library implementation and limitations](docs/Recording_Library.md). This slice was not built or functionally tested; the user performs verification.

The later [explicit playback preparation](docs/Playback_Preparation.md) adds migration 0003 and the locked RQ dependency. A decoding error offers administrators Prepare playback; the worker creates a private H.264 MP4 viewing artifact while retaining the original. Uploads never enqueue conversion or indexing automatically. Compose now uses `--media` for playback-only jobs; AI indexing remains unavailable. Rebuild with `docker compose build backend`, apply with `docker compose run --rm migrate`, then recreate with `docker compose up -d --force-recreate backend worker`. Source/lock updates were not built, migrated, converted or tested by the agent, per user instruction.
