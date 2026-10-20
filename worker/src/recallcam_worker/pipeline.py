"""Stage orchestration with an injected durable checkpoint-store boundary."""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Protocol

from recallcam_shared.contracts.jobs import JobContext, StageName
from recallcam_worker.stages import (
    captions,
    finalize,
    perception,
    prepare,
    summaries,
    text_embeddings,
    visual_embeddings,
)


@dataclass(frozen=True)
class Stage:
    name: StageName
    run: Callable[[JobContext], None]


STAGES = (
    Stage(StageName.PREPARE, prepare.run),
    Stage(StageName.PERCEPTION, perception.run),
    Stage(StageName.VISUAL_EMBEDDINGS, visual_embeddings.run),
    Stage(StageName.CAPTIONS, captions.run),
    Stage(StageName.SUMMARIES, summaries.run),
    Stage(StageName.TEXT_EMBEDDINGS, text_embeddings.run),
    Stage(StageName.FINALIZE, finalize.run),
)


class CheckpointStore(Protocol):
    """Implement using durable job records, including the context's configuration revision."""

    def is_complete(self, context: JobContext, stage: StageName) -> bool: ...

    def started(self, context: JobContext, stage: StageName) -> None: ...

    def completed(self, context: JobContext, stage: StageName) -> None: ...

    def failed(self, context: JobContext, stage: StageName, error: Exception) -> None: ...


def run_pipeline(
    context: JobContext,
    checkpoints: CheckpointStore,
    stages: Sequence[Stage] = STAGES,
) -> None:
    """Queue integration supplies a claim, persisted context, and checkpoint adapter.

    Handlers must persist and validate their outputs before returning successfully.
    This runner itself does not mark an overall job indexed or provide a queue consumer.
    """
    for stage in stages:
        if checkpoints.is_complete(context, stage.name):
            continue
        checkpoints.started(context, stage.name)
        try:
            stage.run(context)
        except Exception as error:
            checkpoints.failed(context, stage.name, error)
            raise
        checkpoints.completed(context, stage.name)
