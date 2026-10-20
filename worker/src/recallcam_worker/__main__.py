"""Inspect the scaffold without pretending a queue consumer already exists."""

import argparse
import logging
import signal
from threading import Event

from recallcam_worker.pipeline import STAGES


def main() -> None:
    parser = argparse.ArgumentParser(description="RecallCam worker scaffold")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--show-pipeline", action="store_true", help="Print stage execution order")
    mode.add_argument(
        "--standby",
        action="store_true",
        help="Keep the scaffold container available without consuming jobs",
    )
    args = parser.parse_args()
    if args.show_pipeline:
        for position, stage in enumerate(STAGES, start=1):
            print(f"{position}. {stage.name.value}")
        return
    if args.standby:
        logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
        stopped = Event()

        def stop(_signum: int, _frame: object) -> None:
            stopped.set()

        signal.signal(signal.SIGTERM, stop)
        signal.signal(signal.SIGINT, stop)
        logging.warning(
            "Worker STANDBY: queue consumption and durable job persistence are not implemented. "
            "No jobs are claimed and no videos are processed."
        )
        stopped.wait()
        logging.info("Worker standby stopped.")
        return
    parser.exit(
        2,
        "Queue consumption and durable job persistence are not implemented yet. "
        "Use --show-pipeline to inspect the stage skeleton.\n",
    )


if __name__ == "__main__":
    main()
