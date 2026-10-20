from dataclasses import replace

import pytest

from recallcam_shared.contracts.jobs import JobContext, StageName
from recallcam_worker.pipeline import STAGES, Stage, run_pipeline


class RecordingCheckpoints:
    """Test-only adapter; this must never stand in for durable production state."""

    def __init__(self):
        self.done = set()
        self.events = []

    def key(self, context, stage):
        return context.job_id, context.config_revision, stage

    def is_complete(self, context, stage):
        return self.key(context, stage) in self.done

    def started(self, context, stage):
        self.events.append((stage, "started"))

    def completed(self, context, stage):
        self.done.add(self.key(context, stage))
        self.events.append((stage, "completed"))

    def failed(self, context, stage, error):
        self.events.append((stage, "failed", str(error)))


@pytest.fixture
def context():
    return JobContext(
        job_id="job-1", video_id="video-1", source_key="videos/1/source.mp4", config_revision="v1"
    )


def test_model_stage_order_preserves_dependencies():
    assert [stage.name for stage in STAGES] == [
        StageName.PREPARE,
        StageName.PERCEPTION,
        StageName.VISUAL_EMBEDDINGS,
        StageName.CAPTIONS,
        StageName.SUMMARIES,
        StageName.TEXT_EMBEDDINGS,
        StageName.FINALIZE,
    ]


def test_failure_keeps_later_stages_unexecuted_and_resumes_completed_work(context):
    checkpoints = RecordingCheckpoints()
    calls = []

    def prepare(ctx):
        calls.append("prepare")

    def fail_perception(ctx):
        calls.append("perception-failed")
        raise RuntimeError("detector unavailable")

    stages = (
        Stage(StageName.PREPARE, prepare),
        Stage(StageName.PERCEPTION, fail_perception),
        Stage(StageName.CAPTIONS, lambda ctx: calls.append("captions")),
    )
    with pytest.raises(RuntimeError, match="detector unavailable"):
        run_pipeline(context, checkpoints, stages)
    assert calls == ["prepare", "perception-failed"]
    assert checkpoints.is_complete(context, StageName.PREPARE)
    assert not checkpoints.is_complete(context, StageName.PERCEPTION)
    assert not checkpoints.is_complete(context, StageName.CAPTIONS)

    repaired = replace(stages[1], run=lambda ctx: calls.append("perception-recovered"))
    run_pipeline(context, checkpoints, (stages[0], repaired, stages[2]))
    assert calls == ["prepare", "perception-failed", "perception-recovered", "captions"]


def test_new_configuration_does_not_reuse_old_checkpoints(context):
    checkpoints = RecordingCheckpoints()
    calls = []
    stages = (Stage(StageName.PREPARE, lambda ctx: calls.append(ctx.config_revision)),)
    run_pipeline(context, checkpoints, stages)
    run_pipeline(context.model_copy(update={"config_revision": "v2"}), checkpoints, stages)
    assert calls == ["v1", "v2"]


def test_unimplemented_stage_never_succeeds(context):
    checkpoints = RecordingCheckpoints()
    with pytest.raises(NotImplementedError, match="prepare"):
        run_pipeline(context, checkpoints)
    assert not checkpoints.done
    assert checkpoints.events[-1][1] == "failed"
