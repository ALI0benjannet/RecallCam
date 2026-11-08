# Recording retention

This implements the configurable recording retention part of P6 in the [cahier des charges](RecallCam_Cahier_des_Charges.md). The present scope is stored recordings, their original objects, thumbnails and MP4 playback copies, and their PostgreSQL recording, artifact and playback-job rows. AI indexing and its vector, lexical, caption and event stores are not implemented. Extend the shared deletion path to clean those representations before permitting deletion of indexed recordings.

Administrators open **Management → Recording retention**. One global policy applies to the library. Migration `0004_recording_retention` seeds 30 days with **automatic deletion off**. The period can be changed while off. Age is based on the recording end, in UTC: eligible recordings ended at or before the current time minus the configured number of 24-hour days. Old footage can qualify as soon as its upload finishes. Only ready recordings qualify; incomplete uploads, recordings already being deleted and recordings with queued or running playback preparation are excluded from the preview and new claims.

The preview is read-only and can show the effect of unsaved settings. It lists eligible recordings, their cameras and end times, and the cutoff and total. Enabling automatic deletion or shortening an active period requires a fresh preview in the UI and explicit confirmation. The preview can change as uploads and playback jobs finish or time passes. An administrator can turn the policy off at any time; this stops new claims. Deletions whose intent is already committed can continue or retry, because their stored files may already be partly removed.

| Request                                               | Effect                                                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/retention`                                  | Read the saved policy and its revision.                                                                                                                                   |
| `GET /api/retention/preview?retention_days=30&page=1` | List current matches for the proposed duration without modifying data.                                                                                                    |
| `PUT /api/retention`                                  | Save `enabled` and `retention_days` (1–3650), using `expected_revision` to reject stale updates. Requires `confirm_deletion: true` to enable or shorten an active policy. |

All three endpoints require `retention:manage`. FastAPI validates, reads or saves the policy and audits changes; it does not schedule or run automatic deletion.

The Compose **worker** runs a periodic retention sweep in media mode, separately from the RQ playback consumer and its heartbeat/outbox loop. It runs at startup and then waits `RETENTION_SWEEP_INTERVAL_SECONDS` (default 60) after each pass. Each pass examines up to 20 previously marked recordings and 20 new candidates. The worker locks the policy and recording to recheck eligibility, commits deletion intent with the policy revision, then uses the same object-prefix and metadata cleanup as manual deletion. Video locks prevent duplicate deletion and conflicting writes. Storage failures leave a durable marker; the worker retries later without reapplying the policy to an already started deletion. Standby mode runs neither sweep nor playback jobs.

The audit log records policy changes and deletion requests/completions, with **System** as the worker actor and a recording retention reason. It keeps bounded audit metadata, not footage or signed URLs.

For an existing Compose setup, apply the migration and recreate the backend and worker so the worker uses the updated environment:

```sh
docker compose run --rm migrate
docker compose up -d --force-recreate backend worker
```

To verify manually, use disposable recordings: preview with the policy off and confirm nothing is deleted, then enable it and verify only expired ready recordings disappear and that System audit entries appear. Check that a supervisor cannot open the settings or call its API. Turn retention off after verification if the library should not auto-expire. No tests, migrations, service restarts or deletions were run by the agent.
