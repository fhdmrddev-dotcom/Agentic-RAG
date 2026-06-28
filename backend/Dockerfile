# Backend (FastAPI) production image — deployed via Coolify on the VPS.
# Build context = backend/. Runtime env vars (SUPABASE_*, REDIS_URL, provider
# keys, SANDBOX_*) are injected by Coolify — never baked in (.env is ignored).
#
# The agent's execute_code sandbox spawns Docker containers via the llm_sandbox
# Python SDK, which talks to the host Docker daemon at /var/run/docker.sock.
# That socket is mounted into this container by Coolify at runtime (single-tenant
# box: socket access = host root — acceptable here, see docs/DEPLOYMENT-PIPELINE.md).
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System libraries for OpenCV (pulled in by camelot-py[base], used in PDF table
# extraction). Everything else in requirements installs from wheels.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgl1 \
      libglib2.0-0 \
      libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python deps first (layer caching). We DROP sentence-transformers, which
# pulls ~2 GB of PyTorch, from the cloud image: reranking is OFF by default and,
# when enabled, the Cohere API provider needs no local model. The local
# CrossEncoder reranker (the only consumer of sentence-transformers) would also
# strain a 4 GB VPS. Re-include it + size up the box if you want local reranking.
# requirements.txt stays the single source of truth; we filter at build time.
COPY requirements.txt ./
RUN grep -ivE '^[[:space:]]*sentence-transformers' requirements.txt > requirements.cloud.txt \
    && pip install -r requirements.cloud.txt

# Application code
COPY . .

EXPOSE 8000

# Multi-worker is the production default (WORKER_COUNT=2, decision D-PRD-12).
# exec so uvicorn is PID 1 and receives signals for clean shutdown.
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WORKER_COUNT:-2}"]
