# Shared Python modules

`src/recallcam_shared/` contains configuration and shared execution contracts. It is installed together with backend and worker from the root `pyproject.toml`, so neither process needs `sys.path` changes.

Domain data contracts must follow Section 8 of the cahier des charges. The initial `JobContext` contains references to persisted inputs, not a completed replacement for all video/chunk/event schemas.

`contracts/access.py` defines fixed roles and their effective permissions. `contracts/accounts.py` defines login, user, camera and audit API contracts. `database/` contains PostgreSQL connection/session factories and SQLAlchemy application metadata for users, cameras, videos, artifacts and audit events; explicit Alembic migrations live at the repository root. These database sessions are short-lived units of work, not authentication sessions.

`contracts/videos.py` adds versioned recording-library/playback-preparation API types. `storage/s3.py` supplies the private S3-compatible adapter, including bounded original downloads; the filesystem adapter remains future work. `media.py` shares FFprobe/thumbnail utilities between API and worker. `media_queue.py` implements the RQ/JSON playback transport; `MediaJob` stores durable explicit requests separately from indexing. `monitoring.py` defines standby/media-worker presence independently of job transport. The `inference/`, indexing `queue/` and `indexes/` packages remain future adapter boundaries. No model weights or inference engines belong here for the VLM/LLM: only HTTP integration.
