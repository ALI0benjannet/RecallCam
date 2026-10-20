# Backend

FastAPI code is in `src/recallcam_backend/`; the online RAG workflow belongs in its `query/` package. HTTP routes call application services rather than running video indexing.

From the repository root, after Python setup:

```sh
python -m uvicorn recallcam_backend.main:app --reload --host 127.0.0.1 --port 8000
```

Implemented: process liveness and a query endpoint that explicitly returns HTTP 501. Uploads, durable video/job records, retrieval, authentication, audit, queue publishing, and infrastructure readiness are still to be implemented. See the root README and specification for the required scope.
