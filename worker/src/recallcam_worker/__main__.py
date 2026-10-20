"""Inspect the scaffold without pretending a queue consumer already exists."""

import argparse

from recallcam_worker.pipeline import STAGES


def main() -> None:
    parser = argparse.ArgumentParser(description="RecallCam worker scaffold")
    parser.add_argument("--show-pipeline", action="store_true", help="Print stage execution order")
    args = parser.parse_args()
    if args.show_pipeline:
        for position, stage in enumerate(STAGES, start=1):
            print(f"{position}. {stage.name.value}")
        return
    parser.exit(
        2,
        "Queue consumption and durable job persistence are not implemented yet. "
        "Use --show-pipeline to inspect the stage skeleton.\n",
    )


if __name__ == "__main__":
    main()
