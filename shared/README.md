# Shared Python modules

`src/recallcam_shared/` contains configuration and shared execution contracts. It is installed together with backend and worker from the root `pyproject.toml`, so neither process needs `sys.path` changes.

Domain data contracts must follow Section 8 of the cahier des charges. The initial `JobContext` contains references to persisted inputs, not a completed replacement for all video/chunk/event schemas.

The `inference/`, `storage/`, `database/`, `queue/`, and `indexes/` packages are boundaries for future shared adapters. No model weights or inference engines belong here for the VLM/LLM: only HTTP integration.
