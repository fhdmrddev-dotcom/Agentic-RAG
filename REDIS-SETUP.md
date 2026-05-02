# Redis Setup Guide

Redis powers run-backed streaming in v2.5+ (see Phase 061 / decision D-v2.5-08). This guide covers connecting the app to either a **local** Redis container or a **cloud** Redis service. Switching between them is just an env var — no code changes.

> **No migrations exist for Redis.** Redis has no schema; streams and keys are created on first write. This is intentional and one of the reasons we picked Redis Streams over Postgres-based alternatives like pgmq.

---

## Table of Contents

1. [Architecture overview](#architecture-overview)
2. [Local development setup](#local-development-setup)
3. [Connecting to a cloud Redis](#connecting-to-a-cloud-redis)
4. [Switching between local and cloud](#switching-between-local-and-cloud)
5. [Key conventions](#key-conventions)
6. [Troubleshooting](#troubleshooting)

---

## Architecture overview

```
┌──────────────────────────────────────────────────────────────────────┐
│ Your app (FastAPI backend)                                           │
│                                                                      │
│ Reads: backend/.env  →  REDIS_URL=redis://...                        │
│ Uses: redis.asyncio.from_url(REDIS_URL)                              │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │
              ┌───────────────────┴───────────────────┐
              │                                       │
              ▼                                       ▼
┌──────────────────────────┐            ┌──────────────────────────┐
│ Local Redis (default)    │            │ Cloud Redis (alt)        │
│                          │            │                          │
│ Managed by docker-compose│            │ Upstash, Redis Cloud,    │
│ -compose.dev.yml         │            │ AWS ElastiCache, etc.    │
│ Port 6379, no auth, no   │            │ TLS-only (rediss://),    │
│ persistence (ephemeral). │            │ password auth.           │
└──────────────────────────┘            └──────────────────────────┘
```

**Use case:** the per-run streaming buffer. Each chat generation writes its tokens to a Redis Stream keyed by `run_id`; the SSE handler reads from the stream as a consumer with a cursor offset. Multi-tab fan-out, refresh-mid-stream, and navigate-away survival all fall out of this architecture.

---

## Local development setup

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running

### Steps

1. **Start Redis** (one-time per machine):
   ```powershell
   cd "C:\Vibe Apps\Agentic RAG"
   docker compose -f docker-compose.dev.yml up -d
   ```
   The compose file uses `restart: unless-stopped`, so Redis auto-starts on Docker Desktop boot — you only run `up -d` once.

2. **Verify it's running**:
   ```powershell
   docker exec agentic-rag-redis redis-cli ping
   ```
   Expected: `PONG`.

3. **Add to `backend/.env`** (already in `backend/.env.example`):
   ```env
   REDIS_URL=redis://localhost:6379
   ```

4. **Optional: start the Redis Insight web UI** for visual debugging of streams:
   ```powershell
   docker compose -f docker-compose.dev.yml --profile insight up -d
   ```
   Then open http://localhost:5540, click **Add Redis database**, fill in:
   - Host: `agentic-rag-redis`
   - Port: `6379`
   - Name: `Local Dev` (or anything)

   Useful once Phase 061 starts writing run-stream data — you can browse `run:*` streams visually, see entries, replay offsets, etc.

### Configuration choices in `docker-compose.dev.yml`

The local Redis is configured for **dev convenience, not durability**:

| Setting | Why |
|---|---|
| `--save ""` and `--appendonly no` | No persistence. Per-run buffers are ephemeral with TTL ~10 min — surviving Docker restarts is unnecessary, and persistence adds complexity (corruption recovery, backup) for zero dev benefit. |
| `--maxmemory 256mb` | Bounded RAM. A runaway producer can't OOM the host. |
| `--maxmemory-policy allkeys-lru` | If memory hits the cap, oldest keys evict first. |
| `restart: unless-stopped` | Auto-starts on Docker Desktop boot. |
| No password | Local-only access on localhost. Don't expose port 6379 outside the host. |

If you need a configuration change for local dev (e.g., bump `maxmemory`), edit `docker-compose.dev.yml` and run `docker compose -f docker-compose.dev.yml up -d` again.

---

## Connecting to a cloud Redis

For production deploys (Hostinger VPS, AWS, etc.), you'll want a managed Redis service rather than running it yourself. Recommended options:

### Option A — Upstash (recommended, free tier)

1. Sign up at https://console.upstash.com
2. Click **Create Database** → name it (e.g., `agentic-rag-runs`) → pick a region close to your backend → choose **Free** tier (10K commands/day, 256MB — enough for low-volume v2.5 work)
3. From the database dashboard, copy the **REST URL** or **TLS Endpoint**:
   ```
   rediss://default:<password>@<endpoint>.upstash.io:6379
   ```
4. Update `backend/.env`:
   ```env
   REDIS_URL=rediss://default:<password>@<endpoint>.upstash.io:6379
   ```
   **Important:** note the `rediss://` (double `s`) for TLS. Plain `redis://` will fail with a TLS handshake error against Upstash.
5. Restart the backend. The app now uses cloud Redis.

### Option B — Self-hosted Redis on your VPS (e.g., Hostinger)

If you're deploying the app to a Hostinger VPS (per SEED-003), the cleanest setup is to run Redis as a systemd service on the same VPS:

```bash
# On the VPS
sudo apt update && sudo apt install -y redis-server
sudo systemctl enable --now redis-server
sudo redis-cli ping   # expect PONG
```

Then in your VPS-side `backend/.env`:
```env
REDIS_URL=redis://localhost:6379
```

Same address as local dev because the backend and Redis are on the same VPS. Lock down the firewall so port 6379 is only reachable from `localhost` — never expose it publicly without auth.

### Option C — AWS ElastiCache, Redis Cloud, etc.

Same env-var pattern. Get the connection URL from the provider dashboard, paste into `REDIS_URL`, restart backend.

---

## Switching between local and cloud

The app reads `REDIS_URL` at startup. To swap:

1. Stop the backend (`Ctrl+C`)
2. Edit `backend/.env`:
   - For local: `REDIS_URL=redis://localhost:6379`
   - For cloud: `REDIS_URL=rediss://default:<password>@<endpoint>.upstash.io:6379`
3. Restart: `uvicorn app.main:app --reload --port 8000`

**Tip:** keep two `.env` files (`.env.local`, `.env.cloud`) and copy the right one over `backend/.env` when switching. They're all gitignored.

**Caveat for in-flight runs:** switching `REDIS_URL` while a generation is in progress orphans the buffer in the previous Redis. The producer task will fail to write its next event, and the consumer will hang waiting. Restart cleanly: stop backend, ensure no active runs, switch URL, restart.

---

## Key conventions

These are forward-looking for Phase 061. The actual Redis client code is added there — this section documents the namespace so anyone reading the code knows the layout.

| Key pattern | Type | Purpose |
|---|---|---|
| `run:{run_id}` | Stream | Per-run event buffer. One entry per SSE event (token, tool, error, done). Producer task writes; SSE consumers read with offset cursor via `XREAD`. |
| `runs_by_thread:{thread_id}` | Sorted set | Index of active runs per thread. Score = started_at unix timestamp. Used by `GET /threads/{id}/active-runs` to enumerate in O(log N). |
| `runs:active` | Sorted set | Global index of currently-streaming runs. Used by abandoned-run sweeper to find runs whose buffer hasn't been consumed for >N minutes. |

**TTL discipline (Phase 061):**
- Completed run: `EXPIRE run:{id} 600` (10 min retention for late reconnects)
- Failed/aborted run: `EXPIRE run:{id} 60` (short retention; user just sees error)
- Abandoned run (no consumer for N min): producer task is cancelled by sweeper; key expires immediately

**No keys exist outside this namespace.** The full Redis instance is available to the app, but conventionally only run-buffer keys live there. If a future phase adds e.g. a rate-limiter or session cache, it gets its own namespace prefix.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Connection refused` / `cannot connect to localhost:6379` | Redis container not running | `docker compose -f docker-compose.dev.yml up -d`; verify with `docker ps` |
| `error during connect` from `docker compose` | Docker Desktop not running | Open Docker Desktop, wait for whale icon, retry |
| `port is already allocated` | Something else on 6379 (rare) | `docker ps` to find it; stop it, or change Redis port in `docker-compose.dev.yml` |
| Cloud Redis hangs / handshake error | Forgot `rediss://` (TLS) for cloud provider | Use double-`s` URL: `rediss://default:<password>@<host>:6379` |
| `WRONGPASS` from cloud Redis | Password incorrect or copied with whitespace | Re-copy from provider dashboard, paste into `.env` carefully |
| Backend startup error: `ModuleNotFoundError: No module named 'redis'` | `redis` package not installed (Phase 061 hasn't run yet) | Expected before Phase 061. Will be added to `requirements.txt` in 061. |
| Buffer key never expires after run completes | Producer task didn't call `EXPIRE` (Phase 061 implementation bug) | Check producer task; manually clean up with `redis-cli FLUSHDB` for local dev |
| Multi-tab desync (one tab ahead of the other) | Consumer cursor not advancing on one tab | Phase 061 implementation issue — both tabs should each track their own offset |

---

## Reference

- Redis Streams docs: https://redis.io/docs/latest/develop/data-types/streams/
- `XREAD` (consume with cursor): https://redis.io/docs/latest/commands/xread/
- `XADD` (produce): https://redis.io/docs/latest/commands/xadd/
- Upstash dashboard: https://console.upstash.com
- Local dev compose: `docker-compose.dev.yml`
- Env template: `backend/.env.example`
- Companion guide: `supabase/SETUP.md`
