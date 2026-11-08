"""Worker-only recurring cleanup of recordings under the active retention policy."""

import logging
from threading import Event
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from recallcam_shared.database.models import RetentionPolicy, Video
from recallcam_shared.recording_deletion import mark_for_deletion, purge_marked_recording
from recallcam_shared.retention import (
    RETENTION_POLICY_ID,
    expiry_conditions,
    expiry_cutoff,
    pending_retention_deletion,
)
from recallcam_shared.settings import Settings
from recallcam_shared.storage.s3 import S3Storage, StorageUnavailable

_BATCH_SIZE = 20
logger = logging.getLogger(__name__)


def _claim(factory: sessionmaker[Session], video_id: UUID) -> bool:
    with factory.begin() as session:
        # Serialize with policy edits up to the point where intent is durable.
        policy = session.get(RetentionPolicy, RETENTION_POLICY_ID, with_for_update={"read": True})
        if policy is None or not policy.enabled:
            return False
        video = session.get(Video, video_id, with_for_update={"skip_locked": True})
        if video is None:
            return False
        # Recheck after obtaining the video lock: a playback request may have
        # registered since the initial scan and takes this same lock.
        eligible = session.scalar(
            select(Video.video_id).where(
                Video.video_id == video_id, *expiry_conditions(expiry_cutoff(policy.retention_days))
            )
        )
        if eligible is None:
            return False
        mark_for_deletion(session, video, actor_id=None, retention_revision=policy.revision)
        return True


def sweep(factory: sessionmaker[Session], settings: Settings, stopped: Event) -> None:
    with factory() as session:
        policy = session.get(RetentionPolicy, RETENTION_POLICY_ID)
        pending = list(
            session.scalars(
                select(Video.video_id)
                .where(*pending_retention_deletion())
                .order_by(Video.updated_at, Video.video_id)
                .limit(_BATCH_SIZE)
            )
        )
        expired = (
            list(
                session.scalars(
                    select(Video.video_id)
                    .where(*expiry_conditions(expiry_cutoff(policy.retention_days)))
                    .order_by(Video.recording_end, Video.video_id)
                    .limit(_BATCH_SIZE)
                )
            )
            if policy is not None and policy.enabled
            else []
        )
    if not (pending or expired) or stopped.is_set():
        return
    storage = S3Storage(settings)
    for video_id, needs_claim in [(id_, False) for id_ in pending] + [
        (id_, True) for id_ in expired
    ]:
        if stopped.is_set():
            return
        if needs_claim and not _claim(factory, video_id):
            continue
        deleted = False
        with factory.begin() as session:
            try:
                deleted = purge_marked_recording(
                    session, storage, video_id, actor_id=None, retention_only=True
                )
            except StorageUnavailable:
                # Intent is durable. Move this retry behind other pending rows
                # so one bad object does not starve the rest of the library.
                session.execute(
                    update(Video)
                    .where(Video.video_id == video_id, *pending_retention_deletion())
                    .values(updated_at=func.now())
                )
                logger.warning("Retention storage deletion will be retried for %s.", video_id)
        if deleted:
            logger.info("Retention purged recording %s.", video_id)


def run_retention(factory: sessionmaker[Session], settings: Settings, stopped: Event) -> None:
    while not stopped.is_set():
        try:
            sweep(factory, settings, stopped)
        except (SQLAlchemyError, StorageUnavailable) as error:
            logger.warning("Retention sweep could not complete (%s).", type(error).__name__)
        stopped.wait(settings.retention_sweep_interval_seconds)
