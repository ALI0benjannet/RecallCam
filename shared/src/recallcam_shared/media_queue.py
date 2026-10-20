"""RQ transport for explicit, durable playback preparation requests.

PostgreSQL is the outbox/source of truth. Redis contains only the job identifier.
"""

from uuid import UUID

from redis import Redis
from rq import Queue
from rq.exceptions import DuplicateJobError
from rq.serializers import JSONSerializer

from recallcam_shared.settings import Settings

MEDIA_QUEUE = "recallcam-media"
# Session-level PostgreSQL advisory lock shared by conversion and recovery.
MEDIA_EXECUTION_LOCK = 724638501
MAX_INTERRUPTED_ATTEMPTS = 3


def redis_connection(settings: Settings) -> Redis:
    return Redis.from_url(
        settings.redis_url.get_secret_value(), socket_connect_timeout=2, socket_timeout=10
    )


def media_queue(client: Redis) -> Queue:
    return Queue(MEDIA_QUEUE, connection=client, serializer=JSONSerializer)


def publish_preparation(queue: Queue, job_id: UUID, timeout: int) -> None:
    # Serialize outbox/API publishers before inspecting or replacing an old RQ record.
    with queue.connection.lock(f"recallcam:media:publish:{job_id}", timeout=60, blocking_timeout=2):
        _publish_preparation(queue, job_id, timeout)


def _publish_preparation(queue: Queue, job_id: UUID, timeout: int) -> None:
    identity = f"playback-{job_id}"
    existing = queue.fetch_job(identity)
    if existing:
        if existing.get_status() in {"queued", "started", "deferred", "scheduled"}:
            return
        existing.delete()
    try:
        queue.enqueue(
            "recallcam_worker.playback.prepare_playback",
            str(job_id),
            job_id=identity,
            unique=True,
            job_timeout=timeout + 600,
            result_ttl=3600,
            failure_ttl=86400,
            description="Prepare private recording playback",
        )
    except DuplicateJobError:
        pass  # API retry and outbox reconciliation can publish the same durable request.
