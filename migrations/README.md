# Database migrations

Alembic is configured in root `alembic.ini`; its connection comes from shared settings. Compose runs `migrate` after PostgreSQL is healthy and before backend/worker startup. To apply new migrations explicitly, from the repository root:

```sh
docker compose run --rm migrate
```

Migration `0001_accounts_cameras_audit` creates `users`, `cameras` and `audit_events`, including UUID identities, foreign keys, constrained roles, case-normalized unique emails, timezone-aware timestamps, schema/producer versions and administration indexes. PostgreSQL user/camera storage is persistent; authentication tokens and refresh/session records are not stored.

Create the first administrator separately using the interactive command in [Backend setup](../backend/README.md). Migrations never seed passwords or grant roles to an existing account. Backend startup does not automatically run migrations.

The ORM metadata lives in `shared/src/recallcam_shared/database/models.py`. Generate later migrations with `docker compose exec backend python -m alembic revision --autogenerate -m "describe change"`, review the SQL operations and retain versioned migrations. Do not modify an applied migration to introduce new behavior. A downgrade of this initial migration deletes its three tables and their data; use it only when that data loss is intended.

Migration `0002_video_library` adds videos and artifact references, upload/media states and original recording timelines, without indexing-job tables. It has not been applied by the agent.

Migration `0003_playback_preparation` adds durable `media_jobs` for explicitly requested playback conversion, a partial unique active-request index and one playback-artifact-per-video index. It has not been applied by the agent. Rebuild the shared Python image for RQ before running the migration service. [Playback preparation](../docs/Playback_Preparation.md) documents the outbox/recovery contract.

Camera lines/zones, indexing jobs/checkpoints/outbox, pipeline records and online-query tables require later migrations. Their proposed design remains in [PostgreSQL application design](../docs/PostgreSQL_App_Design.md).

The initial migration was applied natively to the local PostgreSQL database on 2026-10-20 as setup. Compose retains the existing database volume and upgrades fresh environments through its migration service. The containerized migration was not built/launched/tested at the user's request; the earlier native result does not verify this image or network path.
