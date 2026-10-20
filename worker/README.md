# Worker

`src/recallcam_worker/pipeline.py` defines the sequential stage runner. Each module in `stages/` has a neutral TODO boundary and raises `NotImplementedError` until real processing is provided.

From the repository root, with Compose running:

```sh
docker compose exec worker python -m recallcam_worker --show-pipeline
```

Queue consumption and the PostgreSQL checkpoint adapter are not implemented yet. Compose starts `python -m recallcam_worker --standby`, which logs that processing is unavailable and waits for shutdown without claiming jobs. It handles SIGTERM/SIGINT gracefully. A running standby container does not mean indexing is ready. The default CLI without a mode still exits with an explanatory error.

The worker uses the shared Python image, mounted source/configs, infrastructure service URLs, shared scratch/cache volumes and native HTTP model URLs. Restart it after changing imported code. Linux containers on Mac do not expose MPS; CV/embedding device choices must reflect container capabilities. Only LLM/VLM serving stays native.

When implemented, replace standby with the queue consumer using one Redis job per video, one active indexing job, persistent claims/checkpoints and the shared contracts. No real processing is introduced by this packaging change. See [Containers](../docs/Containers.md).
