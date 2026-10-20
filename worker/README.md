# Worker

`src/recallcam_worker/pipeline.py` defines the sequential stage runner. Each module in `stages/` has a neutral TODO boundary and raises `NotImplementedError` until real processing is provided.

From the repository root, after Python setup:

```sh
python -m recallcam_worker --show-pipeline
```

Queue consumption and the PostgreSQL checkpoint adapter are not implemented yet. The default CLI exits with an explanatory error instead of claiming to process jobs. When implemented, use one Redis job per video, one active indexing job, persistent claims/checkpoints, and the shared configuration/contracts.
