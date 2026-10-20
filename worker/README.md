# Worker

`src/recallcam_worker/pipeline.py` defines the sequential stage runner. Each module in `stages/` has a neutral TODO boundary and raises `NotImplementedError` until real processing is provided.

From the repository root, with Compose running:

```sh
docker compose exec worker python -m recallcam_worker --show-pipeline
```

Compose now starts `python -m recallcam_worker --media`: one RQ SpawnWorker consuming explicitly requested playback preparations, with JSON serialization, PostgreSQL durable requests/outbox reconciliation, a global execution lock and bounded interruption recovery. See [Playback preparation](../docs/Playback_Preparation.md) for the complete behavior, configuration and migration 0003. No upload or browser error automatically creates a request. AI indexing and its checkpoint adapter are still unimplemented. The default CLI without a mode exits with an explanatory error.

Optional `--standby` retains the diagnostic presence-only mode and consumes nothing. Media mode emits a presence heartbeat every five seconds (30-second TTL), separately from job work. The header identifies it as Playback, never indexing readiness.

The worker uses the shared Python image, mounted source/configs, infrastructure service URLs, shared scratch/cache volumes and native HTTP model URLs. Restart it after changing imported code. Linux containers on Mac do not expose MPS; CV/embedding device choices must reflect container capabilities. Only LLM/VLM serving stays native.

When indexing is implemented, retain one job per video, one active execution, persistent stage/batch checkpoints and shared contracts. Media conversion uses originals as inputs and creates a separate private H.264 viewing artifact; it does not invoke the seven-stage runner or any model. See [Containers](../docs/Containers.md).

Missing/stale heartbeats or an unreachable heartbeat store produce an unavailable indicator. Presence does not confirm every dependency or a successfully completed job. This change was source-edited/formatted with dependency-lock regeneration only: no tests, image builds, migrations, FFmpeg runs or live checks were performed, at the user's request.

Failure handling now saves the failed durable request and raises a safe exception so RQ also reports failure. Worker diagnostics include phase and code locations without raw SDK exceptions/credentials. The user's reported initial `AttributeError` exposed incorrect S3 stream context-manager handling, corrected in the shared download adapter. Restart with `docker compose restart worker`, then use the UI's explicit Retry preparation action. No rebuild/migration is needed for this source-only fix, and no conversion was run by the agent.

FFmpeg failures additionally log their exit code and a bounded, redacted stderr tail; the earlier generic error discarded the actual reason and did not prove footage damage. Output capture drains continuously without an unbounded memory/disk log, and interruption kills/waits for FFmpeg before scratch cleanup. Safe UI categories identify missing encoder/options, storage and input-policy failures; detailed redacted diagnostics stay in worker logs. Restart the worker and explicitly retry to obtain them. The agent has not run a conversion or tests for this diagnostic change.

New preparation requests now use recipe `h264-playback/1.1` to address the user's equal-DTS muxing error: VFR output, a 90 kHz encoder/MP4 video clock and no B-frames. It may drop conflicting-timestamp frames in the viewing copy, while preserving the original and retaining duration/start checks and strict error handling. Recipe 1.0 pending requests keep their prior behavior. Run `docker compose restart backend worker`, then explicitly Retry preparation to create a 1.1 request. No rebuild/migration is needed; no conversion or tests were run by the agent.
