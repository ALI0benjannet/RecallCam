# RecallCam

Video search and investigation with timestamped evidence. This repository starts with a development scaffold for a team implementing the cahier des charges.

## Project structure

```text
front/       Next.js and TypeScript application
backend/     FastAPI application, routes, and query/RAG modules
worker/      Separate process, sequential pipeline, and stage TODOs
shared/      Shared Python settings, contracts, and adapter boundaries
configs/     Versioned processing policy and prompt location
migrations/  Future versioned application database migrations
tests/       Scaffold contract and orchestration checks
docs/        Requirements and architecture
compose.yaml PostgreSQL, Redis, Qdrant, SILO, and bucket initialization
```

Backend, worker, and shared modules are one installable Python project with separate import namespaces. Their folder separation does not require duplicating configuration or contracts. The frontend is a separate npm project.

## Requirements

- Python 3.11 or newer; Python 3.12 is used to verify this scaffold.
- Node.js 22 or newer and npm.
- A running Docker engine with Docker Compose. Both ARM64 and AMD64 deployments are supported by the chosen infrastructure image families; the local verification platform is documented in the development guide.

## Configuration

From the repository root, copy `.env.example` to `.env`. On macOS/Linux use `cp .env.example .env`; on PowerShell use `Copy-Item .env.example .env`.

Separately copy `front/.env.example` to `front/.env.local` to configure the browser's API URL. Keep API/model credentials in the backend/worker environment, never in browser-visible `NEXT_PUBLIC_` variables.

The checked-in credentials are local development examples. Service ports, database URLs, S3 endpoint/bucket/credentials, VLM/LLM URLs/model IDs/protocols, and processing devices are configurable. Changing infrastructure credentials or ports also requires updating the corresponding application URLs in `.env`.

## Start infrastructure

```sh
docker compose config --quiet
docker compose up -d
docker compose ps -a
```

| Service | Default host address |
| --- | --- |
| PostgreSQL | `127.0.0.1:5432` |
| Redis | `127.0.0.1:6379` |
| Qdrant HTTP / dashboard | `http://127.0.0.1:6333/dashboard` |
| S3-compatible object storage | `http://127.0.0.1:9000` |
| SILO console | `http://127.0.0.1:9001` |

SILO is the community-maintained S3-compatible deployment chosen here. The one-shot `storage-init` service creates the private `recallcam` bucket and exits successfully. No anonymous bucket access is enabled. SILO retains `MINIO_*` server variables for compatibility; application settings use provider-neutral `S3_*` names. See the [SILO installation documentation](https://silo.pgsty.com/download/).

Named Docker volumes persist all infrastructure data. `docker compose stop` stops services while retaining containers/data; `docker compose down` removes containers/network while retaining named volumes. Adding `-v` to `down` deletes those volumes and their stored data.

## Start the backend

Create a virtual environment with a supported Python version:

```sh
python3.11 -m venv .venv
```

Activate it with `source .venv/bin/activate` on macOS/Linux, or `.venv\Scripts\Activate.ps1` on PowerShell. A different installed Python 3.11+ executable is also suitable; Windows can use `py -3.11 -m venv .venv`.

With the environment active, from the repository root:

```sh
python -m pip install -r requirements-dev.lock
python -m pip install --no-deps -e .
python -m uvicorn recallcam_backend.main:app --reload --host 127.0.0.1 --port 8000
```

Open `http://127.0.0.1:8000/docs`. `/health/live` checks process liveness only. It does not check infrastructure readiness or application migrations. `/api/queries` returns HTTP 501 until query processing is implemented.

## Start the front

In another terminal:

```sh
cd front
npm ci
npm run dev
```

Open `http://localhost:3000`. The home page can check backend liveness. Upload, library, and chat pages are explicitly marked as unimplemented.

## Inspect the worker

With the Python environment active, from the repository root:

```sh
python -m recallcam_worker --show-pipeline
```

The stage runner exists, but queue consumption, durable checkpoint persistence, actual CV/embeddings, model HTTP adapters, and indexing are not implemented. Running the worker without `--show-pipeline` exits with a clear error. Stage TODOs raise `NotImplementedError`; no real video is marked indexed.

VLM and LLM servers are external HTTP services. Compose does not download or load those models. Host processes can use localhost or a reachable remote URL. If application processes are containerized later, use container-reachable addresses; localhost inside a container does not refer to the host's model server.

## Checks

```sh
python -m pytest
python -m ruff check backend worker shared tests
python -m black --check backend worker shared tests
npm --prefix front run typecheck
npm --prefix front run build
docker compose config --quiet
```

Python dependencies are resolved in `requirements-dev.lock`; frontend dependencies are resolved in `front/package-lock.json`. Update the dependency declarations and their corresponding lockfile together. No queue library, ORM/migration tool, or LangChain dependency is selected by this scaffold.

## Read before implementation

- [Agent instructions](AGENTS.md)
- [Cahier des charges](docs/RecallCam_Cahier_des_Charges.md)
- [Architecture](docs/Architecture.md)
- [Sequential pipeline](docs/Sequential_Pipeline.md)
- [Development guide](docs/Development.md)

The architecture supplements the specification. This scaffold is not a reduced replacement for its required features, evaluation, or privacy/data handling requirements.
