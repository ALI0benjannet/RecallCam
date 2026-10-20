# Shared Python modules

`src/recallcam_shared/` contains configuration and shared execution contracts. It is installed together with backend and worker from the root `pyproject.toml`, so neither process needs `sys.path` changes.

Domain data contracts must follow Section 8 of the cahier des charges. The initial `JobContext` contains references to persisted inputs, not a completed replacement for all video/chunk/event schemas.

`contracts/access.py` defines fixed roles and their effective permissions. `contracts/accounts.py` defines login, user, camera and audit API contracts. `database/` contains PostgreSQL connection/session factories and SQLAlchemy application metadata for users, cameras and audit events; explicit Alembic migrations live at the repository root. These database sessions are short-lived units of work, not authentication sessions.

The `inference/`, `storage/`, `queue/`, and `indexes/` packages remain boundaries for future shared adapters. No model weights or inference engines belong here for the VLM/LLM: only HTTP integration.
