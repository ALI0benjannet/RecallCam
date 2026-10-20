"""Ephemeral worker presence, separate from Redis job transport and processing readiness."""

WORKER_HEARTBEAT_KEY = "recallcam:services:worker"
WORKER_HEARTBEAT_TTL = 30
WORKER_HEARTBEAT_INTERVAL = 10
