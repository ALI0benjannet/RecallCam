"""Run explicit playback preparation, or inspect the unimplemented indexing stages."""

import argparse
import json
import logging
import signal
from threading import Event
from uuid import uuid4

from redis import Redis
from redis.exceptions import RedisError

from recallcam_shared.monitoring import (
    WORKER_HEARTBEAT_INTERVAL,
    WORKER_HEARTBEAT_KEY,
    WORKER_HEARTBEAT_TTL,
)
from recallcam_shared.settings import Settings

from recallcam_worker.pipeline import STAGES


def main() -> None:
    parser = argparse.ArgumentParser(description="RecallCam worker scaffold")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--show-pipeline", action="store_true", help="Print stage execution order")
    mode.add_argument(
        "--media", action="store_true", help="Consume explicitly requested playback conversions"
    )
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
    if args.media:
        from recallcam_worker.media_service import run_media_worker

        logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
        run_media_worker(Settings())
        return
    if args.standby:
        logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
        stopped = Event()

        def stop(_signum: int, _frame: object) -> None:
            stopped.set()

        signal.signal(signal.SIGTERM, stop)
        signal.signal(signal.SIGINT, stop)
        logging.warning(
            "Worker STANDBY: playback queue consumption is disabled in this mode. "
            "No jobs are claimed. AI indexing is not implemented."
        )
        settings = Settings()
        payload = json.dumps({"mode": "standby", "instance": str(uuid4())})
        with Redis.from_url(
            settings.redis_url.get_secret_value(), socket_connect_timeout=2, socket_timeout=2
        ) as client:
            while not stopped.is_set():
                try:
                    client.set(WORKER_HEARTBEAT_KEY, payload, ex=WORKER_HEARTBEAT_TTL)
                except RedisError:
                    logging.warning(
                        "Worker heartbeat could not reach Redis; no processing was attempted."
                    )
                stopped.wait(WORKER_HEARTBEAT_INTERVAL)
            try:
                client.eval(
                    "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0",
                    1,
                    WORKER_HEARTBEAT_KEY,
                    payload,
                )
            except RedisError:
                pass  # TTL removes presence if Redis is unreachable during shutdown.
        logging.info("Worker standby stopped.")
        return
    parser.exit(
        2,
        "Choose --media for explicit playback preparation, --standby for presence only, "
        "or --show-pipeline to inspect the unimplemented AI stage skeleton.\n",
    )


if __name__ == "__main__":
    main()
