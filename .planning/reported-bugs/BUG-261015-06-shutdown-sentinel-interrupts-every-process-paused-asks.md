---
id: BUG-261015-06
title: A shutting-down app process interrupts EVERY paused ask_user in Redis, including other workers' and other servers' — the backend unit suite kills live dev pauses
reported: 2026-10-15
surface: Agentic-RAG
severity: major
status: closed
affected_areas: [backend/ask-user, backend/lifespan, backend/tests]
folded_into: null
verified_closed_by: "fix b77aade1e, 2026-10-15"
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 5358a243a
  date: 2026-10-15
---

# BUG-261015-06: the shutdown sentinel is not scoped to the process that owns the pause

## What we observed

On 2026-10-15 at 22:26 local time, the BUG-261015-03 re-drive was run on the operator's dev backend. Eight new chats were each sent the pause prompt.
- **All 7 pauses** ended within about 45 s. The result read `ask_user interrupted by server shutdown`, and the models then wrote "the question was interrupted by a server shutdown".
- **The dev backend was not restarted.**
- **The backend unit suite was running at the same moment,** in another shell under the local-DB lock.

| Thread | Model | Final message (start) |
|---|---|---|
| `fix 261015 openai` | gpt-5.6-sol | "I couldn't receive your selection because the question tool was interrupted…" |
| `fix 261015 zhipu` | glm-5.2 | "The tool is being interrupted repeatedly by a server shutdown…" |
| `fix 261015 lmstudio` | spark-x2.5-4b | "…before the server experienced an interruption…" |

## Cause (read in code)

1. **The test:** `tests/unit/test_health.py:12` runs `with TestClient(app) as c:`, so the FULL lifespan runs, startup and shutdown.
2. **The Redis it uses:** `get_redis()` reads `settings.redis_url` from `backend/.env`. That is the same local Redis the running dev backend uses.
3. **The broadcast:** on lifespan shutdown, `main.py` (around line 689) calls `ask_user_service.broadcast_shutdown_sentinel_to_all`. That function **SCANs `ask_user:channels:*` across the whole Redis** and PUBLISHes the shutdown sentinel to every channel it finds. It is not limited to the channels its own process registered.

The test process therefore interrupts every live pause on the dev server.

## Why it matters beyond tests

The same unscoped broadcast fires whenever ONE app process shuts down:
- a single uvicorn worker restarting (`WORKER_COUNT=2` is the default);
- one instance of a multi-instance deploy rolling.

Each case cancels paused questions that belong to processes which are still alive and could have answered them. The person sees "interrupted by server shutdown" on a server that never stopped.

## Suggested routing

- **Scope the sentinel** to the channels THIS process registered: an in-process set of `(run_id, tool_call_id)`, or a per-process key prefix. The `SCAN *` then covers only what this process owns.
- **Isolate the tests:** keep the unit suite off the live Redis, either through a test `REDIS_URL` DB index or a mocked `get_redis` in `test_health`.
- **Re-drive:** a pause on worker A must survive a restart of worker B.
- **Also re-drive BUG-261015-03's pause rows,** since they were invalidated by this.

## Fixed and re-driven (2026-10-15)

**The fix is commit `b77aade1e`:**
- A process-local `_LOCAL_CHANNELS` set.
- Both subscribe sites register and unregister their channel.
- The shutdown broadcast publishes only to this process's channels.

**Live check, backend restarted on the fix:**
- **The pause:** a deepseek-v4-pro pause was opened (run `1122d2c6`, pending 1 at 18:52:47 UTC).
- **The test:** `pytest tests/unit/test_health.py` was then run. It drives the full `TestClient(app)` lifespan, startup and shutdown, against the live local Redis, from 18:52:51 to 18:53:13.
- **Result:** afterwards the pause was **still pending**. It was answered "Blue", and the run completed "You chose **Blue**."
- **Before the fix,** the same kind of run interrupted 7 of 7 live pauses.

**Not driven:** a two-worker restart (worker A's pause survives worker B restarting). That case is covered by the same code path and by the unit test.
