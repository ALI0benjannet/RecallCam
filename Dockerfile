# Backend, migration CLI and worker share the same portable Python environment.
ARG PYTHON_IMAGE=python:3.12-slim-bookworm
FROM ${PYTHON_IMAGE}

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    VIRTUAL_ENV=/opt/venv \
    PATH="/opt/venv/bin:$PATH" \
    HF_HOME=/home/app/.cache/huggingface

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/* \
    && python -m venv /opt/venv \
    && groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --create-home app

WORKDIR /app
COPY requirements-dev.lock ./
RUN python -m pip install --no-cache-dir -r requirements-dev.lock

COPY pyproject.toml alembic.ini README.md ./
COPY backend/ ./backend/
COPY shared/ ./shared/
COPY worker/ ./worker/
COPY configs/ ./configs/
COPY migrations/ ./migrations/
COPY tests/ ./tests/

RUN python -m pip install --no-cache-dir --no-deps -e . \
    && mkdir -p /app/data /home/app/.cache/huggingface \
    && chown -R app:app /app /home/app/.cache

USER app
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "recallcam_backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
