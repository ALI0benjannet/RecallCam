"""RQ media consumer, durable outbox reconciliation and worker presence."""

import json
import logging
from datetime import UTC, datetime
from threading import Event, Thread
from uuid import uuid4

from redis.exceptions import RedisError
from rq import SpawnWorker
from rq.serializers import JSONSerializer
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError

from recallcam_shared.database.connection import create_database_engine, create_session_factory
from recallcam_shared.database.models import MediaJob
from recallcam_shared.media_queue import (
    MAX_INTERRUPTED_ATTEMPTS,
    MEDIA_EXECUTION_LOCK,
    media_queue,
    publish_preparation,
    redis_connection,
)
from recallcam_shared.monitoring import WORKER_HEARTBEAT_KEY, WORKER_HEARTBEAT_TTL
from recallcam_shared.settings import Settings


def reconcile(engine, factory, queue) -> None:
    # Recover only if no conversion owns the execution lock. A hard-killed RQ child
    # releases this PostgreSQL session lock without waiting for its Redis timeout.
    with engine.connect() as connection:
        locked = connection.scalar(
            text("SELECT pg_try_advisory_lock(:key)"), {"key": MEDIA_EXECUTION_LOCK}
        )
        connection.commit()
        if locked:
            try:
                with factory() as session:
                    for job in session.scalars(
                        select(MediaJob).where(MediaJob.status == "running").with_for_update()
                    ):
                        if job.attempts < MAX_INTERRUPTED_ATTEMPTS:
                            job.status, job.stage, job.last_error = "queued", "queued", None
                        else:
                            job.status, job.stage = "failed", "failed"
                            job.last_error = "Preparation was interrupted repeatedly. Check the worker, then retry."
                            job.finished_at = datetime.now(UTC)
                        # A stale RQ started record must not hide the durable retry.
                        queued = queue.fetch_job(f"playback-{job.job_id}")
                        if queued:
                            queued.delete()
                    session.commit()
            finally:
                connection.execute(
                    text("SELECT pg_advisory_unlock(:key)"), {"key": MEDIA_EXECUTION_LOCK}
                )
                connection.commit()
    # Replaying already queued RQ jobs is idempotent. This also repairs Redis loss
    # and the database-commit/queue-publication gap, without creating new requests.
    with factory() as session:
        jobs = list(
            session.scalars(
                select(MediaJob)
                .where(MediaJob.status == "queued")
                .order_by(MediaJob.created_at)
                .limit(100)
            )
        )
    for job in jobs:
        publish_preparation(queue, job.job_id, job.settings["timeout_seconds"])


def run_media_worker(settings: Settings) -> None:
    stopped = Event()
    engine = create_database_engine(settings)
    factory = create_session_factory(engine)
    identity = str(uuid4())
    payload = json.dumps({"mode": "media", "instance": identity})

    def maintain() -> None:
        with redis_connection(settings) as client:
            queue = media_queue(client)
            while not stopped.is_set():
                try:
                    client.set(WORKER_HEARTBEAT_KEY, payload, ex=WORKER_HEARTBEAT_TTL)
                    reconcile(engine, factory, queue)
                except (RedisError, SQLAlchemyError):
                    logging.warning(
                        "Media worker outbox/presence unavailable; durable requests remain saved."
                    )
                stopped.wait(5)
            try:
                client.eval(
                    "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0",
                    1,
                    WORKER_HEARTBEAT_KEY,
                    payload,
                )
            except RedisError:
                pass

    thread = Thread(target=maintain, name="media-outbox", daemon=True)
    thread.start()
    try:
        with redis_connection(settings) as client:
            worker = SpawnWorker(
                [media_queue(client)],
                connection=client,
                serializer=JSONSerializer,
                name=f"recallcam-media-{identity}",
            )
            logging.warning(
                "Media worker active: explicit playback preparation only. AI indexing is unavailable."
            )
            worker.work(logging_level="WARNING")
    finally:
        stopped.set()
        thread.join(timeout=15)
        engine.dispose()
