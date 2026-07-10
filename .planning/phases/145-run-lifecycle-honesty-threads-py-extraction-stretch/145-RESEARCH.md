# Phase 145: Run-Lifecycle Honesty + threads.py Extraction — Research

**Researched:** 2026-07-09
**Domain:** Run-lifecycle state machine (Postgres `runs.status` ⇄ Redis `runs:active` co-write), SSE reconcile honesty (frontend watchdog), backend staleness sweep (Redis stream-age oracle), G-5 extraction of chat-run lifecycle out of `threads.py`.
**Confidence:** HIGH (design is locked by CONTEXT's 14 decisions; every value/seam below is grounded in the actual code, not training data).

## Summary

This phase makes the chat's "is it running? / can I Stop it?" signal honest in **both** directions and pays down the G-5 debt on `backend/app/api/threads.py` (2,226 lines). The design is already locked (D-145-01..14); the researcher's job was to arm the planner with **evidence for the values and seams CONTEXT deliberately left open**. All seven open unknowns are resolved below with concrete recommendations and code refs.

The single most important **new** finding — which reshapes the frontend fix and was NOT explicit in CONTEXT — is that **`streamingThreads` (the Zustand set that drives the Stop button) is written ONLY by the send path** (`StreamsProvider.tsx:1715` add, `:2019` delete-in-finally). The reconcile action (`:1361+`) and the visibility/focus listeners (`:2592-2616`) **never touch `streamingThreads`.** That means: (a) Direction A cannot be healed by reconcile-on-tab-focus today — only a full page reload (which re-initialises the store) clears the phantom Stop; and (b) Direction B's "no Stop on a live run after the SSE broke" is the mirror symptom — reconcile re-attaches to the active run but never re-adds the thread to `streamingThreads`. **The core frontend fix is therefore to make `streamingThreads` reconcile-driven** (derive it from `snapshot.active_runs` on every reconcile/watchdog tick, guarded by in-flight-send), which realises D-145-01 ("`runs.status` authoritative, every other representation agrees") for the Stop button specifically. Both the watchdog (Direction A) and Direction B collapse into that one change plus the existing getSnapshot plumbing.

**Primary recommendation:** Extract a `run_lifecycle` module owning two atomic co-writers (`register_run_start` / `finalize_run_terminal`) that write `runs.status` **and** `runs:active` together, routing terminal writes through `db.runs.finalize_run`; switch `run_reconciler.py`'s orphan predicate from "absent from `runs:active`" to **stream-age** and add a periodic lifespan sweep; and make the frontend `streamingThreads` set reconcile-derived with a per-thread inactivity watchdog + the existing tab-focus reconcile. Backend kill-timeout `STALE_TIMEOUT` must be **> 1800s** (the `ask_user` ceiling); frontend reconcile watchdog `N` is short (~20s) because it only re-fetches.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

> Copied verbatim from `145-CONTEXT.md`. **The planner MUST honor these.** D-145-01 supersedes the FND-01 / ROADMAP "runs:active is the single source of truth" wording — see Phase Requirements below.

### Locked Decisions

**Authoritative signal (the reshaping decision)**
- **D-145-01:** Postgres `runs.status` is THE authoritative "is this run streaming?" signal. The frontend already derives `isStreaming` from it via `get_snapshot` (`threads.py` ~:364 / :413-423; `StreamsProvider` ~:232), and a browser refresh already self-heals Direction A precisely because that SELECT returns `[]` once `completed`. **This SUPERSEDES the FND-01 / ROADMAP wording that named Redis `runs:active` as the single source of truth** — that wording came from the pre-trace hypothesis (`c12ff264` corrected it). The FND-01 requirement text should be updated to reflect this at plan time.
- **D-145-02:** `runs:active` becomes a DERIVED MIRROR, not a source of truth. The extracted owner writes `runs.status` and `runs:active` **together on every transition** (register on start / ZREM on terminal), so `runs:active == {runs WHERE status='streaming'}` by construction. Existing consumers keep reading it (admin backpressure `ZCARD` `api/admin.py:72`) but it can no longer drift. This co-write is the core anti-drift fix — today the ZADD/ZREM live in different code paths than the status writes, which is exactly how they got out of sync (observed: `runs:active` empty while `runs.status='streaming'`).

**Direction A — UI self-heals a phantom-running run**
- **D-145-03:** Client inactivity watchdog is the trigger. While a run shows "running", if the SSE produces no bytes for N seconds, fire a reconcile `getSnapshot`; if `runs.status` is not `streaming`, finalize the UI to done. This is the ONLY mechanism that catches the observed case (tab open 16 min, NO `done`/`error`/close event ever arrived, so the existing close-triggered `_isTransientStreamEnd` path never fired). Add reconcile-on-tab-focus (`visibilitychange`) as a cheap additive belt. Reuse the existing `_isTransientStreamEnd` / `getSnapshot` reconcile plumbing — just add the timer trigger.
- **D-145-04:** Silent finalize — no banner, no "reconnecting…" state. If the reconcile confirms terminal, the UI transitions straight to the finished state; if still streaming, nothing changes.
- **D-145-05:** Watchdog inactivity window N is a short window (default ~20s, tunable) — safe because it only RECONCILES (never kills). Researcher/planner to pin the exact value with evidence (long legit gaps = code-exec / long tool calls).

**Direction B — backend corrects a lying `runs.status` (dead producer)**
- **D-145-06:** Periodic + boot staleness sweep, extending `run_reconciler.py` to also run on an interval. The liveness oracle is the `run:{run_id}` stream's last-event age, NOT `runs:active` membership — because `runs:active` is now a derived mirror (D-145-02) and can no longer detect orphans (a genuine orphan HAS `status='streaming'` and would be PRESENT in the mirror). A run non-terminal in PG whose stream has produced no new events in > `STALE_TIMEOUT` is terminalized to `failed` via the atomic owner. No schema.
- **D-145-07:** Two timeouts by design. Backend sweep `STALE_TIMEOUT` is generous / conservative (e.g. 2–5 min, longer than any legitimate tool/code-exec gap) because it KILLS. The frontend watchdog N is short because it only RECONCILES. Do not conflate them.
- **D-145-08:** The periodic sweep must be WORKER_COUNT=2 single-flight-safe — reuse the existing boot `SET NX` guard pattern (`run_reconcile_lock`).

**Extraction (G-5 paydown)**
- **D-145-09:** Extract the chat-run lifecycle (start register + terminal + the atomic `runs.status` + `runs:active` writer) out of `threads.py` into a dedicated, unit-tested module. Reuse `backend/app/db/runs.py:finalize_run` as the terminal writer so reattach/cancel/reconciler parity holds. Build it with a clean API so eval/tuner/eval_runner CAN adopt it next, but do NOT migrate them this phase. File a follow-up seed.

**Bug folding + cross-cutting constraints**
- **D-145-10:** BUG-260707-01 folded — the composer flipping Stop→Send + 👍/👎 feedback appearing mid-run after a transient reattach is the same affordance-honesty defect on the same `_isTransientStreamEnd` path. Contract: the UI must NOT flip to "done" affordances until `runs.status` is actually terminal. Add a VALIDATION row.
- **D-145-11:** LIVE repro BEFORE the fix (locked from scope). Reproduce, via DB + Redis, (i) why `runs:active` was empty during Direction B, and (ii) whether Direction A reproduces WITHOUT a restart. Operator drives the repro.
- **D-145-12:** Red line (D-14) — all fixes additive / at the boundary. The extracted module is new; shipped eval/tuner/Deep chat paths are not forked.
- **D-145-13:** SC#10 UAT — cross-provider × UI-state × parallel-thread. Both directions across providers (OpenAI = Direction A; DeepSeek + MiniMax = Direction B) + a parallel-thread row. Authored under VALIDATION.md.
- **D-145-14:** "Stop actually cancels" scope note — the observed bug was Stop absent (Dir B) or dead/no-op because nothing to cancel (Dir A), not present-but-broken cancel. Treat cancel-correctness as covered by the existing `runs.py` cancel path + the now-honest affordance. Researcher should VERIFY the cancel path works end-to-end cross-provider; do not assume new cancel logic is needed.

### Claude's Discretion
- Exact module name / file location for the extracted run-lifecycle owner (planner's call; `run_reconciler.py` and `skill_tuner.py` are naming/precedent analogs).
- Whether the periodic sweep is a dedicated lifespan task or folded into an existing scheduler (`harness_engine.resume_stranded_workflows` is the interval-sweep precedent).

### Deferred Ideas (OUT OF SCOPE)
- Migrate eval / tuner / eval_runner run-lifecycle writers onto the shared extracted module — the true single-owner end-state. Deferred to keep shipped eval/tuner paths untouched (red line). Plant as a follow-up SEED with re-open trigger = "any future `runs:active` drift observed on eval or tuner runs, or the next G-5 touch of evals.py/skill_tuner.py."
- `last_heartbeat` schema column — rejected (no schema; stream-age is the oracle). Re-open trigger = stream-age proves insufficient (e.g., a provider that legitimately produces zero stream events for > STALE_TIMEOUT).
- Full 5-writer consolidation in one phase — rejected (red-line risk / blast radius).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (verbatim from REQUIREMENTS.md) | Research Support |
|----|--------------------------------------------|------------------|
| **FND-01** | Run-lifecycle honesty — the chat run-state signal is authoritative and reflects backend reality in **both** directions: a genuinely-streaming run is visible + stoppable (Stop actually cancels), and a finished run finalizes with no phantom "running" / dead Stop. *[wording says] Redis `runs:active` is the single source of truth (…reconciled via fetch on reconnect per D-v2.5-03)*; the run-lifecycle / `runs:active` logic is extracted OUT of `threads.py` into a dedicated, tested module. (BUG-260709-01 cross-provider repro; BUG-260702-02 orphaned runs on restart. Phase 145.) | **The italicised "`runs:active` is the single source of truth" clause is SUPERSEDED by D-145-01** — planner must update FND-01 to read "Postgres `runs.status` is authoritative; `runs:active` is a derived mirror co-written on every transition." Every mechanism (watchdog, sweep, extraction) is grounded in the Unknowns Resolved section below. |

**⚠️ FND-01 wording correction (planner action):** update the requirement text so its acceptance is not self-contradictory with the locked design. The rest of the sentence (both-directions honesty, Stop actually cancels, reconcile-on-reconnect, extraction out of `threads.py`) stands unchanged.
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Authoritative run-status truth | Database (`runs.status`) | — | D-145-01. A single durable column; a browser refresh already self-heals off it. |
| `runs:active` membership (backpressure index) | Database-mirror (Redis) | — | D-145-02. Becomes a *derived* index co-written with the status; consumers = `admin.py:72` ZCARD only. |
| Atomic status⇄mirror co-write | API/Backend service (new `run_lifecycle` module) | — | D-145-09. The one owner that guarantees the mirror can't drift from the truth. |
| Missed-terminal UI self-heal (Direction A) | Frontend (StreamsProvider watchdog) | Frontend (visibility reconcile) | D-145-03/04. The truth is fine; only the browser's local `streamingThreads` is stale → a client-side reconcile fixes it. |
| Lying-status correction (Direction B) | API/Backend (extended `run_reconciler`) | — | D-145-06. The truth itself is wrong (dead producer) → only a backend sweep can correct a lying status; the frontend trusts `runs.status`. |
| Live-run cancel (Stop) | API/Backend (`runs.py` DELETE + in-process `task.cancel()`) | Redis pub/sub (ask_user wake) | D-145-14. Existing path; verified below. **Cross-worker cancel is a pre-existing gap (Open Q1).** |
| Periodic sweep host | API/Backend (lifespan interval task) | — | Precedent: `_sweep_expired_templates` (`main.py:302-314`). |

---

## Unknowns Resolved (Planner Action Items)

> This is the heart of the research. Each of CONTEXT's 7 deferred unknowns gets a concrete recommendation + the evidence/code-refs behind it.

### U1 — Frontend watchdog inactivity window N (D-145-05)

**Recommendation: N = 20s (configurable), implemented as an inactivity timer that RESETS on every stream event for the thread, evaluated by ONE shared `setInterval` (~5s tick) over the streaming-threads set — not a timer-per-run.** `[CITED: code trace]`

Because the watchdog only calls `getSnapshot` (never kills), a false fire during a legitimate silent gap is a single cheap round-trip that returns "still streaming" → no-op. So N can be short. The only cost of a *too-short* N is `getSnapshot` churn during a genuinely-slow run.

**Evidence for "the longest legitimate silent gap" (so N-churn is bounded, not harmful):**
- Code execution is **self-heartbeating** — `tool_dispatcher.py:1031 / 1145 / 1240` XADD a `code_executing` event carrying `elapsed_seconds` periodically while the sandbox runs; sandbox warm-up (~10-15s pip install, CLAUDE.md) is brief. So code-exec never produces a long silent stream. `[VERIFIED: codebase grep]`
- Silent **reasoning** (OpenAI o-series / `gpt-5.x-pro` do not stream reasoning tokens) can be quiet up to the per-call ceiling `llm_call_timeout_seconds` = **900s** (`config.py:212-220`, "the timeout only guards against genuinely hung streams"). DeepSeek/Anthropic/Kimi stream reasoning deltas (`agent_loop.py:1829-1839` `reasoning_delta`; onReasoningDelta) so they are not silent. `[VERIFIED: config.py]`
- **ask_user** pause: the Deep-chat `ask_user` tool blocks on a Redis SUBSCRIBE up to `ask_user_max_timeout_seconds` = **1800s** (`config.py:979`, `tool_dispatcher.py:3022-3030`) — the stream is silent the whole time. `[VERIFIED: config.py]`

At N=20s a legitimately-silent 900s reasoning run fires ~45 no-op `getSnapshot` calls; that is acceptable (one lightweight combined GET each). To trim churn you may back off after the first "still-streaming" result, or set N=30s — the tab-focus reconcile (below) is the cheap belt that catches the case even at a larger N. **Do NOT couple N to the code-exec/tool gap** — those self-heartbeat, so they are not the constraint.

**Tab-focus belt (already exists, reuse it):** `useEffect #2` at `StreamsProvider.tsx:2592-2616` already fires `reconcile(tid)` on `visibilitychange`/`focus`/`pageshow`. **But note (see U7 / Pitfall 1): today `reconcile()` does not clear `streamingThreads`, so the belt alone does not clear a phantom Stop — the reconcile path must be taught to reconcile `streamingThreads` from `snapshot.active_runs` first.**

**Where the watchdog probe should live:** reuse the `_isTransientStreamEnd`-style probe (`getSnapshot` → `active_runs.some(r => r.run_id === runId && r.status === 'streaming')`, `StreamsProvider.tsx:230-235`). Do NOT call the full `reconcile()` action on every tick — that re-derives the whole bucket and re-attaches subscriptions; the watchdog wants a *read-only* probe that only silently finalizes on a terminal verdict.

### U2 — Backend `STALE_TIMEOUT` (D-145-06/07, KILLS)

**Recommendation: `STALE_TIMEOUT` must EXCEED the longest legitimate silent gap of a LIVE producer. The evidence puts that ceiling at 1800s (ask_user), not the 2–5 min CONTEXT suggested. Recommend a config-driven default of `2400s` (40 min).** `[VERIFIED: config.py]`

CONTEXT's "e.g. 2–5 min" (D-145-07) is **too aggressive** — it would terminalize (a) a silently-reasoning o-series run (up to 900s) and (b) a Deep run legitimately waiting on `ask_user` (up to 1800s), both of which are genuinely alive. Grounding the value in the same longest-legit-gap evidence as U1:

| Legit silent source | Ceiling | Streams during? |
|---------------------|---------|-----------------|
| Code exec / tool calls | seconds–minutes | Yes — `code_executing` heartbeat (`tool_dispatcher.py`) |
| Silent reasoning (o-series, `*-pro`) | 900s (`llm_call_timeout_seconds`) | No |
| `ask_user` human wait (Deep tool) | 1800s (`ask_user_max_timeout_seconds`) | No |

So the longest legit quiet-but-alive gap = **1800s**. A safe generous kill-timeout is **> 1800s + margin ≈ 2400s (40 min)**.

**Why a live-but-quiet run never needs the sweep anyway:** a genuinely-hung stream self-terminates at its per-call timeout (900s) — the producer finalizes it. The sweep's real job is the **dead producer** (restart / broken SSE), whose stream simply stops growing *forever*; a generous 40-min timeout still catches it, just not instantly. In dev, uvicorn `--reload` restarts fire the **boot** sweep constantly, so the dead-producer window is small in practice; in prod, restarts are rare and the periodic sweep is the net.

**Two alternatives to shorten it (offer to the operator at plan time):**
1. **Exclude pending-`ask_user` runs from the sweep** (skip any non-terminal run that has an open `ask_user` prompt row / pending pubsub) → then `STALE_TIMEOUT` only needs to clear the 900s reasoning ceiling → ~`1200s` (20 min). More code, tighter window.
2. **Config-driven generous default (recommended):** add `run_stale_sweep_timeout_seconds: int = 2400` to `config.py` Settings (sibling of `ask_user_max_timeout_seconds:979`), overridable per the project's dynamic-settings direction. Simpler; no ask_user special-case.

**Two-timeout separation is sound (confirms D-145-07):** frontend N (~20s, reconciles) and backend `STALE_TIMEOUT` (~2400s, kills) serve different masters and must not be conflated. `[VERIFIED: code trace]`

**⚠️ This corrects a value in CONTEXT** — flag it in the plan so the operator ratifies 2400s (or picks alternative 1). Assumption A1.

### U3 — The stream-age liveness oracle

**Recommendation: read `XINFO STREAM run:{run_id}` → `last-generated-id`, parse its `<ms>` prefix, and compute `age_ms = redis_now_ms − last_ms`. A non-terminal PG row is an orphan iff its stream is MISSING or `age_ms > STALE_TIMEOUT`.** `[CITED: redis.io XINFO STREAM]` + `[VERIFIED: codebase]`

Redis Stream entry IDs are `<ms>-<seq>` where `<ms>` is the server wall-clock at XADD, so the stream carries its own timestamps — no schema needed (D-145-06). The exact commands:
- `info = await redis.xinfo_stream(f"run:{run_id}")` — **already used** in the snapshot path (`threads.py:449`), which reads `info.get("first-entry")` (`threads.py:482-487`). For age, read `info.get("last-generated-id")` (bytes → `.decode()` → `int(v.split("-")[0])`). `last-generated-id` is monotonic and unaffected by MAXLEN trimming (safer than `last-entry`, which can be trimmed). `[CITED: redis.io]`
- Missing stream → `xinfo_stream` raises `ResponseError('no such key')` — **already handled** at `threads.py:452,460`. A non-terminal PG row with a MISSING stream is ALSO an orphan (stream GC'd/expired but status never finalized) → terminalize.
- Clock: use the **Redis** clock for `now` (`sec, usec = await redis.time()`) to eliminate app↔Redis skew, since the entry `<ms>` is stamped by Redis. Minor but correct.

**The crux of D-145-06 — VERIFIED:** `db.runs.finalize_run` (`db/runs.py:69-109`) writes ONLY `runs.status`; the `runs:active` ZREM lives in a *separate* code path (`threads.py:1721`, `:2209`; `runs.py:1247`). Under D-145-02 the atomic owner will co-write both — so **a genuine orphan (dead producer) will have `status='streaming'` AND still be PRESENT in `runs:active`** (nobody ran the terminal co-write). Therefore `runs:active` membership can no longer be the orphan predicate. `run_reconciler.py:190-198 _is_orphan` ("`zscore runs:active is None`") **must be replaced** by the stream-age predicate. This is a direct, small change to `_is_orphan` + `_reconcile_chat_runs` (`run_reconciler.py:151-187`).

**Edge to encode:** `_NON_TERMINAL_CHAT_STATUSES = ["streaming", "cap_paused"]` (`run_reconciler.py:66`). A `cap_paused` run (harness Continue-waiting) is legitimately quiet and re-attachable; under stream-age it could be killed. Keep the existing behavior scoped or exclude `cap_paused` from the periodic sweep (leave it to the boot sweep / Continue flow). Flag for the planner (Open Q2).

### U4 — The cancel path end-to-end (D-145-14)

**Verdict: the existing cancel path genuinely cancels a live run cross-provider; NO new cancel logic is needed for the observed bug. One pre-existing gap (cross-worker) should be flagged, not fixed, in 145.** `[VERIFIED: code trace]`

Trace of the Stop button:
1. Frontend `cancelRun(runId)` → `DELETE /runs/{run_id}` (`api/runs.py:1092-1097`).
2. Ownership SELECT (404 not 403 cross-user — T-062-01, `runs.py:1107-1119`).
3. Already-terminal → 204 silent (`:1124`).
4. **Happy path** — producer task alive in `RUN_TASKS` (`:1133`): publish ask_user cancel sentinel (`:1149`, wakes a paused `ask_user`) → `task.cancel()` (`:1154`). The producer's `CancelledError` handler sets `_terminal_status='cancelled'` (`threads.py:1558`) and `_shielded_finalize` runs the ordered finalize (`finalize_run(status='cancelled')` + terminal sentinel + EXPIRE + ZREM, `threads.py:1684-1724`). Returns 204 immediately (does not await). **Provider-agnostic** — `task.cancel()` propagates `CancelledError` into the agent loop regardless of which provider SDK stream is being awaited.
5. **Zombie heal** — `RUN_TASKS` missing but `status='streaming'` (`:1157+`): supabase UPDATE `status='cancelled'` + synthetic sentinel + ZREM ×2 + EXPIRE. Honors "Stop my run" even when the producer is dead.

**No new cancel logic needed** — confirms D-145-14. The observed bug was Stop *absent* (Dir B: `streamingThreads` cleared after SSE broke) or *dead* (Dir A: nothing to cancel), never present-but-broken cancel.

**Extraction note:** the zombie-heal writes status via a **supabase-py UPDATE** (`runs.py:1176-1183`), NOT `db.runs.finalize_run`. For parity (D-145-09) the zombie-heal chat-run terminal SHOULD adopt the new `finalize_run_terminal` owner (it is a chat-run terminal writer and squarely "the cancel path"). This is in-scope and low-risk. The happy-path cancel already reaches the owner through the producer's `_shielded_finalize`.

**Open Q1 (flag, do NOT fix in 145): cross-worker cancel gap.** `task.cancel()` only works if `RUN_TASKS[run_id]` is on the **same** worker. With `WORKER_COUNT=2` (CLAUDE.md default), a Stop routed to the *other* worker finds `RUN_TASKS` empty → falls to zombie-heal → marks the DB `cancelled` while the live producer keeps running on the first worker (and may overwrite the status at its own terminal, since `finalize_run` has no CAS). The only cross-worker signal today is `publish_cancel_sentinel`, which wakes `ask_user` only (`ask_user_service.py:241`), not the main loop. This is a separate concern from 145's honesty/extraction scope — surface it in the cancel-path UAT and, if it reproduces, file a follow-up (cross-worker cancel via a `run:{id}:cancel` pub/sub the producer subscribes to). Re-open trigger: "a live run is not cancellable when Stop lands on the non-owning worker."

### U5 — The extraction seams (D-145-09, G-5 paydown)

**Recommendation: create `backend/app/services/run_lifecycle.py` (planner's naming call) exposing two async co-writers with explicit `pool`/`redis` params (DI → unit-testable). Every chat-run start/terminal — in `threads.py`, `runs.py` cancel zombie-heal, and `run_reconciler.py` — routes through them.** `[VERIFIED: code trace]`

**Exactly what moves OUT of `threads.py`:**

| Concern | Current site(s) | Moves to |
|---------|-----------------|----------|
| START register (insert `status='streaming'` + `ZADD runs:active` + `ZADD runs_by_thread`) | `threads.py:1108-1125` | `register_run_start()` |
| SPAWN-FAILURE cleanup (`status='failed'` + `ZREM` ×2) | `threads.py:1131-1141` | `finalize_run_terminal(status='failed')` |
| TERMINAL transition (Deep) (`finalize_run` + `ZREM` ×2) | `threads.py:1684-1693` (status) + `:1721-1722` (ZREM) | `finalize_run_terminal()` |
| TERMINAL transition (continuation) (`finalize_run` + `ZREM` ×2) | `threads.py:2176-2186` + `:2209-2210` | `finalize_run_terminal()` |
| Cancel zombie-heal terminal (parity, D-145-09) | `runs.py:1176-1183` + `:1247-1253` | `finalize_run_terminal(status='cancelled')` |

**What STAYS in `threads.py` (transport / read, not lifecycle-status):**
- The SSE producer task and its `_emit` / `_emit_terminal` XADDs (`threads.py:152-183`) — stream transport.
- The terminal sentinel XADD + `EXPIRE run:{id}` (`threads.py:1697-1717`) — SSE-transport ordering (Pitfall 2/5); can stay in the producer. (Optionally the owner takes an `on_terminal_stream_cleanup` hook, but keeping sentinel/EXPIRE in the producer is the lower-risk seam.)
- `get_snapshot` (`threads.py:364-` the reconcile READ) — API read of `runs.status`; unchanged.
- `RUN_TASKS` registry + cancel wiring — the cancel verb lives in `runs.py`.

**Proposed public API (planner may rename):**
```python
# backend/app/services/run_lifecycle.py
async def register_run_start(*, pool, redis, run_id, thread_id, user_id,
                             model, provider, spawned_by_worker=None,
                             parent_run_id=None, status="streaming") -> None:
    """Atomic co-write: insert_run(status) + ZADD runs:active + ZADD runs_by_thread.
    Invariant on success: run_id ∈ runs:active  ⇔  runs.status == 'streaming'."""

async def finalize_run_terminal(*, pool, redis, run_id, thread_id, status, error,
                                completed_at, message_id=None,
                                input_tokens=None, output_tokens=None) -> None:
    """Atomic co-write: db.runs.finalize_run(status=terminal) + ZREM runs:active
    + ZREM runs_by_thread. Reused by threads.py (Deep + continuation), runs.py cancel
    zombie-heal, and run_reconciler.py. Invariant: terminal status ⇔ absent from runs:active."""
```
- **Terminal writer reuse (D-145-09):** `finalize_run_terminal` calls `db.runs.finalize_run` (`db/runs.py:69`) internally — the same DB writer the producer, cancel, and reconciler already share, so reattach/cancel/reconciler parity holds.
- **Invariant by construction:** the ONLY writers of `runs:active` for chat runs become these two functions, each co-writing the status — so `runs:active == {run_id : runs.status=='streaming'}` holds for chat/Deep runs. (The 5 eval/tuner writers are NOT migrated — D-145-12; the invariant is chat-scoped this phase.)
- **Unit-test seam:** explicit `pool` + `redis` params (identical shape to `reconcile_orphaned_runs(*, pool, redis, supabase)`, `run_reconciler.py:74`) → tests inject the in-memory `_FakePool` + `_FakeRedis` already in `backend/tests/test_run_reconciler.py:34-136`. Assert BOTH `pool.execute` (status) AND `redis.zadd/zrem` fired with the same `run_id` in the same call → proves atomicity.
- **Precedent analogs for structure/testing:** `run_reconciler.py` (DI params, best-effort per-row, `run_in_threadpool` for supabase-py, `SET NX` guard) and `skill_tuner.py` (module + `_emit_*` helpers). Follow `run_reconciler.py`'s shape.

### U6 — The periodic sweep host (Claude's discretion)

**Recommendation: a DEDICATED lifespan interval task, cloning the `_sweep_expired_templates` shape (`main.py:302-314`), calling the extended reconciler with a per-tick `SET NX` guard. Cadence: every ~120s.** `[VERIFIED: main.py]`

`main.py` lifespan already has the exact precedent — `_sweep_expired_templates` is `async def … while True: <work>; await asyncio.sleep(15*60)` spawned via `asyncio.create_task(...)` (`main.py:302-314`). Mirror it:
```python
async def _reconcile_orphans_periodic():
    while True:
        try:
            count = await reconcile_orphaned_runs(pool=…, redis=…, supabase=…)  # extended: stream-age + per-tick SET NX
            if count: logger.info("Periodic run reconciler closed %d orphan(s)", count)
        except Exception:
            logger.exception("Periodic run reconciler failed (app continues)")
        await asyncio.sleep(settings.run_stale_sweep_interval_seconds)  # ~120s
asyncio.create_task(_reconcile_orphans_periodic())
```
- **Single-flight (D-145-08):** reuse the `SET NX` guard already in `reconcile_orphaned_runs` (`run_reconciler.py:83-88`, key `run_reconcile_lock`, `_RECONCILE_LOCK_TTL_S=300`). For the periodic case the guard TTL should be **shorter than the tick** (e.g. TTL ~90s for a 120s tick) so exactly one of `WORKER_COUNT=2` sweeps per tick and the guard self-expires before the next tick. (The boot call already self-expires at 300s.) Confirm the TTL/tick relationship in the plan.
- **Do NOT fold into `harness_engine.resume_stranded_workflows`** — that is a *boot-only* sweep (`main.py:257-269`), not an interval, and it re-drives workflow runs (different semantics). The template-sweep interval is the right precedent. Keep the run-lifecycle sweep in `run_reconciler.py` (G-5: out of `threads.py`).
- **Cadence rationale:** the sweep is a safety net for dead producers; with a generous `STALE_TIMEOUT` (U2) the correction latency is dominated by `STALE_TIMEOUT`, not the tick, so a 120s tick is cheap and ample. Faster ticks add Redis load for no honesty benefit.

### U7 — Direction A repro shape (D-145-11)

**Finding: Direction A reproduces WITHOUT a backend restart — it is a pure missed-terminal-SSE with an open connection. The watchdog TIMER is therefore strictly necessary (not an optimization). The existing close-triggered `_isTransientStreamEnd` path structurally cannot catch it.** `[VERIFIED: code trace]`

Why the existing self-heal did not fire in the 16-min-stuck case:
- `_isTransientStreamEnd` runs **inside `onTerminal`** (`StreamsProvider.tsx:1499`, `:1802`). `onTerminal` only fires when `subscribeToRun`'s SSE stream **ends** — a terminal sentinel arrives or the reader closes. In the observed case NO `done`/`error`/close event ever arrived (tab open 16 min), so `onTerminal` never fired → no probe → no reconcile.
- The send path's `streamingThreads.delete(threadId)` is in the `finally` of the awaited `subscribeToRun` (`StreamsProvider.tsx:2011-2023`). If the terminal event is missed AND the connection never closes, that `await` never resolves → the `finally` never runs → `streamingThreads.has(threadId)` stays true → phantom "running" + dead Stop for as long as the tab stays open.
- The tab-focus reconcile (`:2592-2616`) did not fire because the tab stayed visible; **and even if it had, `reconcile()` does not clear `streamingThreads`** (see Pitfall 1) — which is why only a full page **reload** (store re-init) healed it.

**Consequence for the plan:** the watchdog is load-bearing, and it must do MORE than probe — on a confirmed-terminal verdict it must **silently write `streamingThreads.delete(threadId)` and flip the placeholder's `runStatus`** (reuse the terminal-flip map at `StreamsProvider.tsx:1558-1569`). The LIVE repro (first plan task, D-145-11) should confirm the mechanism (missed terminal, open connection) and record whether a Direction-A-after-restart variant also exists (producer dies → SSE eventually errors → `onTerminal('error')` → `_isTransientStreamEnd` → `getSnapshot` may still read `streaming` until the boot sweep flips it — a second, restart-flavored path the sweep + watchdog jointly cover).

---

## Standard Stack

No new external packages. This phase extends existing, already-installed infrastructure. The "stack" here is the set of libraries you will test/extend against.

### Core (already in the project — extend, don't add)
| Library | Role in this phase | Where |
|---------|--------------------|-------|
| `redis.asyncio` (redis-py) | `xinfo_stream` (stream-age oracle), `set(nx=…)` guard, `zadd`/`zrem`/`zscore`/`time` | `run_reconciler.py`, new `run_lifecycle.py` |
| `asyncpg` (pool) | `runs.status` reads/writes via `db.runs.finalize_run` / `insert_run` | `db/runs.py` |
| `supabase-py` (+ `run_in_threadpool`, D-v2.5-01) | eval_runs reconcile (blocking → threadpool) | `run_reconciler.py` |
| `sse-starlette` `EventSourceResponse` | the SSE transport (unchanged; `ping=None`, `runs.py:444/455`) | `runs.py` stream_run |
| Zustand v5 (`subscribeWithSelector`) | `streamingThreads` set that drives Stop | `StreamsProvider.tsx` / `streamsStore` |
| `pytest` + `pytest-asyncio` | backend unit tests (in-memory fakes) | `backend/tests/` |
| `vitest` + `vi.hoisted`/`vi.mock` | frontend unit tests (getSnapshot mock, fake timers) | `frontend/src/__tests__/` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff / why rejected |
|------------|-----------|-------------------------|
| Stream-age oracle | `last_heartbeat` schema column | Rejected by CONTEXT (no schema). Stream-age reuses existing `run:{id}` stream; re-open only if a provider legitimately emits zero stream events > STALE_TIMEOUT. |
| Config-driven generous `STALE_TIMEOUT` (2400s) | Exclude pending-`ask_user` runs, use ~1200s | Both valid; generous default is simpler/lower-risk. Present both to operator. |
| Dedicated lifespan interval task | Fold into `harness_engine.resume_stranded_workflows` | Rejected — that is boot-only and re-drives workflows (wrong semantics). |

**Installation:** none.

## Package Legitimacy Audit

**Not applicable — this phase installs NO external packages.** All work extends first-party modules (`run_reconciler.py`, `threads.py`, `runs.py`, `db/runs.py`, `StreamsProvider.tsx`) and already-installed dependencies (redis-py, asyncpg, supabase-py, sse-starlette, zustand, pytest, vitest). slopcheck / registry verification is moot. If the planner adds a helper package (not anticipated), gate it behind a `checkpoint:human-verify` per the standard protocol.

---

## Runtime State Inventory (extraction/refactor phase)

> The "runtime state" the extraction must preserve is the **run-lifecycle state machine across Postgres + Redis** — not filesystem renames. Every item below must survive the extraction byte-for-behavior.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data (Postgres) | `runs.status` enum: `streaming / cap_paused / completed / failed / cancelled / timed_out` (`run_reconciler.py:64-66`; `db/runs.py:41`). The authoritative signal (D-145-01). | Code: route all chat-run status writes through `run_lifecycle`. No data migration (existing rows are already correct; the boot+periodic sweep will terminalize any stranded ones). |
| Live service config (Redis) | `runs:active` (ZSET), `runs_by_thread:{tid}` (ZSET), `run:{run_id}` (Stream) — CLAUDE.md conventions, created on first write, NO migration. | Code: `runs:active`/`runs_by_thread` become co-written by `run_lifecycle`; `run:{id}` stream is the age oracle (read-only for the sweep). |
| OS-registered state | None — no OS scheduler/registration touches run state. | None (verified — run lifecycle is entirely in-process + Redis + PG). |
| Secrets/env vars | None renamed. New optional tunables (`run_stale_sweep_timeout_seconds`, `_interval_seconds`) are `config.py` Settings, not secrets. | Add Settings fields; no secret changes. |
| Build artifacts / consumers to keep drift-proof | `admin.py:72` `ZCARD runs:active` backpressure (unchanged consumer); the 5 OTHER `runs:active` writers NOT migrated (evals.py :315/:1915/:2624, runs.py :1247, skill_tuner.py :643/:738, eval_runner_service.py :864). | None this phase (D-145-12). File the follow-up SEED for their migration. |

**The canonical question:** after the extraction, is `runs:active` still written anywhere OUTSIDE the new owner? **Yes — deliberately** (the 5 eval/tuner writers, red line). So the invariant `runs:active == {status='streaming'}` is guaranteed only for **chat/Deep** runs this phase. Document this scope explicitly in the module docstring so a future reader doesn't assume a global invariant.

---

## Architecture Patterns

### Data-flow: the three representations and the two directions

```
              ┌─────────────────────────── AUTHORITATIVE ───────────────────────────┐
   send /     │  Postgres runs.status  ('streaming' → terminal)                     │
   producer ──┼──►  register_run_start ─┐                          ┌─ finalize_run_terminal
              │      (NEW atomic owner)  │  co-write (one unit)     │   (NEW atomic owner)
              │                          ▼                          ▼
              │        Redis runs:active ZSET  ◄── derived mirror (D-145-02) ──►  runs_by_thread
              └──────────────────────────┬───────────────────────────────────────────┘
                                         │ read-only
        ┌──────── get_snapshot (threads.py:364, SELECT status='streaming') ─────────┐
        ▼                                                                            ▼
  FRONTEND StreamsProvider                                        BACKEND run_reconciler (Dir B)
   streamingThreads set  ◄── reconcile-derive (NEW, U7/Pitfall 1)   boot + periodic sweep:
   ├─ Dir A: watchdog (N≈20s) + tab-focus → getSnapshot            stream-age oracle on run:{id}
   │        if status≠streaming → silent finalize                  age > STALE_TIMEOUT (≈2400s)
   └─ Stop button = streamingThreads.has(threadId)                 → finalize_run_terminal('failed')
                                                                    (single-flight SET NX, W=2 safe)

   run:{run_id} Redis Stream  ── XADD per SSE event (transport) ── last-generated-id = liveness clock
```

### Pattern 1: Atomic status⇄mirror co-write (the anti-drift core)
**What:** every `runs.status` transition for a chat run and its `runs:active` membership move as ONE unit inside `run_lifecycle`.
**Why:** today they live in different code paths (`db/runs.py:finalize_run` writes status; `threads.py:1721`/`2209` ZREM) → they drifted (observed `runs:active` empty while `status='streaming'`).
**Example (terminal):**
```python
# run_lifecycle.finalize_run_terminal
await finalize_run(pool, run_id=run_id, status=status, error=error,
                   completed_at=completed_at, message_id=message_id,
                   input_tokens=input_tokens, output_tokens=output_tokens)  # db/runs.py:69
await redis.zrem("runs:active", str(run_id))
await redis.zrem(f"runs_by_thread:{thread_id}", str(run_id))
```

### Pattern 2: Reconcile-derive `streamingThreads` from `snapshot.active_runs` (NEW — U7)
**What:** on every reconcile/watchdog tick, set `streamingThreads` from the snapshot (add threads with an active run, delete threads with none), respecting in-flight sends.
**Why:** realises D-145-01 for the Stop button; fixes Direction A (delete on terminal) and Direction B (re-add on a still-active reconciled run) with one change.
**Guard (Pitfall 1):** never delete a thread that has an in-flight send (`sendingThreadsRef.current.has(threadId)`) — mirror the delete-then-readd race fix already at `StreamsProvider.tsx:1839-1853`.

### Pattern 3: Single-flight interval sweep (WORKER_COUNT=2)
**What:** `while True: <SET NX guarded sweep>; sleep(tick)` in lifespan.
**Precedent:** `_sweep_expired_templates` (`main.py:302-314`) + `run_reconcile_lock` SET NX (`run_reconciler.py:83`).

### Anti-Patterns to Avoid
- **Killing on `runs:active` absence** — invalid post-D-145-02 (a genuine orphan is PRESENT in the mirror). Use stream-age.
- **Watchdog calling the full `reconcile()` action every tick** — heavy; re-derives buckets + re-attaches. Use the read-only `getSnapshot` probe.
- **Conflating N and STALE_TIMEOUT** — one reconciles (short), one kills (generous > 1800s).
- **Assuming the extraction gives a global `runs:active` invariant** — it's chat-scoped this phase (5 writers unmigrated).
- **Flipping the DB status without CAS in a multi-writer race** — `finalize_run` has no CAS; the cross-worker cancel gap (Open Q1) can overwrite a `cancelled` with `completed`. Do not "fix" cancel here, but be aware when reasoning about parity.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Liveness heartbeat | A `last_heartbeat` column + writer | Redis Stream `last-generated-id` age | Rejected by CONTEXT; the stream already timestamps every event. |
| Terminal DB write | A fresh UPDATE in the new module | `db.runs.finalize_run` (`db/runs.py:69`) | The one writer the producer + cancel + reconciler already share (parity, D-145-09). |
| Single-flight across workers | A new lock scheme | `redis.set(key, nx=True, ex=…)` (`run_reconciler.py:83`) | Battle-tested `run_reconcile_lock` pattern. |
| Interval scheduler | A new task framework | Lifespan `asyncio.create_task` + `while True/sleep` (`main.py:302-314`) | Precedent already in the codebase. |
| SSE reconcile probe | A new fetch chain | `getSnapshot` + `_isTransientStreamEnd`/`_reattachAfterTransient` (`StreamsProvider.tsx:194-278`) | D-145-03 says reuse; just add the timer trigger. |
| In-memory test doubles | New mocks | `_FakeRedis`/`_FakeSupabase`/`_FakePool` (`test_run_reconciler.py:34-136`) | Extend them with `xinfo_stream`/`time`. |

**Key insight:** almost everything this phase needs already exists as a shipped, tested primitive. The work is *re-wiring* (co-write, stream-age predicate, reconcile-derive `streamingThreads`, timer trigger), not net-new machinery.

---

## Common Pitfalls

### Pitfall 1: `reconcile()` does not clear/set `streamingThreads` — tab-focus alone won't fix Direction A
**What goes wrong:** you add reconcile-on-tab-focus (or rely on the existing one) expecting the phantom Stop to clear, but it doesn't — because `streamingThreads` is written ONLY by the send path (`:1715` add, `:2019` delete). `reconcile()` (`:1361+`) re-derives messages but never touches `streamingThreads`.
**Root cause:** the Stop button reads `streamingThreads.has(threadId)` (`ChatArea.tsx:67` `useStreamingForThread`; `StreamsProvider.tsx:2973`), which is send-path-only state.
**How to avoid:** make the reconcile path (and the watchdog) reconcile `streamingThreads` from `snapshot.active_runs` — add if present, delete if absent — guarded by `sendingThreadsRef`.
**Warning sign:** a green unit test on the watchdog probe while the live Stop button never disappears.

### Pitfall 2: Killing a live-but-silent reasoning or `ask_user`-waiting run
**What goes wrong:** `STALE_TIMEOUT` set to CONTEXT's suggested 2–5 min terminalizes a genuinely-alive run (o-series reasoning up to 900s; `ask_user` wait up to 1800s).
**How to avoid:** `STALE_TIMEOUT > 1800s` (recommend 2400s), OR exclude pending-`ask_user` runs and use ~1200s.
**Warning sign:** a run flips to `failed` while the user is mid-answering an `ask_user` prompt, or right as a reasoning model returns its first token.

### Pitfall 3: `cap_paused` runs killed by the periodic stream-age sweep
**What goes wrong:** `_NON_TERMINAL_CHAT_STATUSES` includes `cap_paused` (`run_reconciler.py:66`); a legitimately-paused, re-attachable Continue run has a quiet stream and gets killed.
**How to avoid:** exclude `cap_paused` from the *periodic* sweep (leave it to boot / the Continue flow), or verify Continue budget before terminalizing. Decide at plan time (Open Q2).

### Pitfall 4: MAXLEN trimming vs `last-entry`
**What goes wrong:** using `last-entry` for stream age can misbehave when the stream is trimmed.
**How to avoid:** use `last-generated-id` (monotonic, trim-independent); read `now` from `redis.time()` to avoid clock skew.

### Pitfall 5: Missing stream ≠ live
**What goes wrong:** treating an `xinfo_stream` `no such key` as "unknown, skip" leaves a non-terminal PG row (whose stream expired/was GC'd) stranded forever.
**How to avoid:** a non-terminal PG row with a MISSING stream is ALSO an orphan → terminalize. (The GC'd-buffer path is already recognized at `threads.py:452-466`.)

### Pitfall 6: Redis hiccup must SKIP, never flip
**What goes wrong:** a transient Redis error on the age read causes a false-orphan terminalization.
**How to avoid:** preserve the existing safe default — an exception in the liveness read propagates to the per-row handler which logs and SKIPS (`run_reconciler.py:190-198` comment). Never flip on unverifiable liveness.

---

## State of the Art

| Old Approach (pre-145) | Current (post-145) | Impact |
|------------------------|--------------------|--------|
| `runs.status` and `runs:active` written in separate code paths | Co-written atomically by `run_lifecycle` | They can no longer drift for chat runs. |
| Orphan predicate = "absent from `runs:active`" (`run_reconciler.py:_is_orphan`) | Orphan predicate = stream-age > STALE_TIMEOUT (or stream missing) | Detects dead producers that D-145-02 makes invisible to the membership test. |
| Boot-only orphan sweep | Boot + periodic interval sweep | A lying status is corrected live, not only at next restart. |
| `streamingThreads` = send-path-only local flag | `streamingThreads` reconcile-derived from `runs.status` | Stop button becomes honest in both directions without a reload. |
| Missed-terminal heals only on reload | Watchdog timer + tab-focus silent finalize | Direction A self-heals with the tab open. |

**Deprecated/outdated by this phase:** `run_reconciler.py:_is_orphan` (membership predicate) is replaced by stream-age. Its docstring lines 24-28 / 59-61 that call `runs:active` "the AUTHORITATIVE streaming set" must be rewritten (D-145-01 makes `runs.status` authoritative).

---

## Validation Architecture

> Nyquist validation is enabled (no `workflow.nyquist_validation: false` found). This section lets a VALIDATION.md be derived directly.

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | `pytest` + `pytest-asyncio` (`@pytest.mark.asyncio`) — see `backend/tests/test_run_reconciler.py` |
| Frontend framework | `vitest` + `@testing-library`, `vi.hoisted`/`vi.mock`, fake timers — see `frontend/src/__tests__/providers/StreamsProvider.transient.test.ts` |
| Backend quick run | `cd backend && venv/Scripts/python -m pytest tests/test_run_lifecycle.py tests/test_run_reconciler.py -x` |
| Frontend quick run | `cd frontend && npx vitest run src/__tests__/providers/StreamsProvider.*.test.ts` |
| Full backend suite | `cd backend && venv/Scripts/python -m pytest -q` |

### Phase Requirements → Test Map
| Req / Decision | Behavior | Test Type | Automated Command | File |
|----------------|----------|-----------|-------------------|------|
| D-145-02 / D-145-09 | `register_run_start` co-writes status + ZADD atomically | unit | `pytest tests/test_run_lifecycle.py::test_register_cowrites_status_and_active -x` | ❌ Wave 0 |
| D-145-02 / D-145-09 | `finalize_run_terminal` routes status via `finalize_run` + ZREM ×2 | unit | `pytest tests/test_run_lifecycle.py::test_finalize_cowrites_terminal_and_zrem -x` | ❌ Wave 0 |
| D-145-06 | stream-age orphan: seed `run:{id}` last-id old → terminalize `failed` | unit | `pytest tests/test_run_reconciler.py::test_stale_stream_flipped_to_failed -x` | extend existing |
| D-145-06 | fresh stream (recent last-id) → NOT flipped | unit | `pytest tests/test_run_reconciler.py::test_fresh_stream_not_flipped -x` | extend existing |
| D-145-06 | present-in-runs:active BUT stale stream → STILL flipped (the crux) | unit | `pytest tests/test_run_reconciler.py::test_present_in_active_but_stale_is_orphan -x` | ❌ Wave 0 |
| D-145-05 | missing stream (GC'd) + non-terminal → orphan | unit | `pytest tests/test_run_reconciler.py::test_missing_stream_is_orphan -x` | ❌ Wave 0 |
| D-145-08 | periodic sweep SET NX single-flight (loser = 0) | unit | `pytest tests/test_run_reconciler.py::test_set_nx_guard_returns_zero_when_held -x` | exists (reuse) |
| D-145-03/04 | watchdog: silent finalize on terminal snapshot (fake timer) | unit | `vitest run …::watchdog silent-finalizes on terminal` | ❌ Wave 0 |
| D-145-03 | watchdog: no-op while snapshot still streaming | unit | `vitest run …::watchdog no-ops while streaming` | ❌ Wave 0 |
| D-145-07 (U7) | Pattern 2: reconcile clears `streamingThreads` when active_runs empty | unit | `vitest run …::reconcile clears streamingThreads on terminal snapshot` | ❌ Wave 0 |
| D-145-10 | reattach RESTORES `streamingThreads` (no Stop→Send flip mid-run) | unit | `vitest run …::transient reattach keeps streamingThreads` | extend transient test |
| D-145-14 | cancel happy-path → `finalize_run_terminal('cancelled')` + ZREM | unit/integration | `pytest tests/test_cancel_run.py::test_cancel_finalizes_and_zrems -x` | ❌ Wave 0 |

### Deterministic test recipes
- **Atomic co-writer (unit):** inject `_FakePool` + `_FakeRedis` (`test_run_reconciler.py:34-136`); assert `pool.executed` (status) AND `redis` ZADD/ZREM both fired for the same `run_id`.
- **Stream-age oracle (unit):** extend `_FakeRedis` with `xinfo_stream(key)` returning `{"last-generated-id": b"<ms>-0"}` and `time()` returning a fixed `(sec, usec)`; seed `<ms>` = now−(STALE_TIMEOUT+1)s → assert flipped; seed `<ms>` = now → assert NOT flipped; omit the key (raise `ResponseError('no such key')`) → assert flipped. No live Redis.
- **Watchdog (unit):** `vi.useFakeTimers()`, mock `getSnapshot` to return `active_runs: []` (terminal); advance `N` seconds; assert `streamingThreads` no longer has the thread and the placeholder `runStatus` flipped — mirror `StreamsProvider.transient.test.ts:27-62` mocking style (`vi.mock('@/lib/api')`).
- **Direction B (unit):** `getSnapshot` returns an active run → assert reconcile ADDs the thread to `streamingThreads` (Stop reappears).

### Live UAT (D-145-13, SC#10 — authored under VALIDATION.md, NOT PLAN tasks)
The 4-axis bandwidth (CLAUDE.md UAT recipe) applied to both directions:
| Axis | Row |
|------|-----|
| Cross-provider | OpenAI (Dir A repro: finish → no phantom Stop), DeepSeek + MiniMax (Dir B repro: live run shows working Stop after an SSE break), plus Google + Anthropic sanity. |
| Both directions | Dir A: complete a run, keep the tab open, confirm the Stop clears within N without reload. Dir B: `--reload` restart mid-stream, confirm the sweep terminalizes the dead producer and the Stop reflects reality. |
| Multi-tool | A run with `search_documents` + `execute_code` (self-heartbeating code-exec must NOT trip the sweep or watchdog). |
| Parallel-thread | Thread A streaming while Thread B accepts a prompt — the watchdog/`streamingThreads` reconcile must stay per-thread (respect the per-thread Set; `StreamsProvider.tsx:1038-1069`). |
| Long-message / long-gap | A silent-reasoning run (o-series or `*-pro`) with a > 60s first-token gap — watchdog no-ops, sweep does not kill. |
| Cancel (D-145-14) | Stop a genuinely-live run per provider → confirm it actually cancels (DB `cancelled` + ZREM) and note whether the wrong-worker case reproduces (Open Q1). |

### Wave 0 Gaps
- [ ] `backend/tests/test_run_lifecycle.py` — new; atomic co-writer tests (D-145-02/09).
- [ ] Extend `backend/tests/test_run_reconciler.py` `_FakeRedis` with `xinfo_stream` + `time`; add stale/fresh/missing/present-but-stale cases (D-145-06).
- [ ] `frontend/src/__tests__/providers/StreamsProvider.watchdog.test.ts` (or extend `.transient.test.ts`) — fake-timer watchdog + `streamingThreads` reconcile (D-145-03/04, U7, D-145-10).
- [ ] `backend/tests/test_cancel_run.py` (if not present) — cancel → `finalize_run_terminal` parity (D-145-14).

*(Existing infra covers the harness: pytest-asyncio + in-memory fakes on the backend, vitest + `vi.mock('@/lib/api')` on the frontend. No framework install needed.)*

---

## Security Domain

`security_enforcement` treated as enabled (no `false` in config). This phase adds no new external surface; it must PRESERVE the existing gates.

### Applicable ASVS Categories
| ASVS | Applies | Standard Control (preserve) |
|------|---------|------------------------------|
| V4 Access Control | yes | The cancel/stream/snapshot endpoints already enforce owner-scoped ownership SELECT (404-not-403, T-062-01: `runs.py:1107-1119`, `threads.py:379-388`). The extraction must NOT change these — `run_lifecycle` is called by already-authorized paths; the sweep is service-role (boot/interval, not request-scoped) scoped by row id + CAS. |
| V5 Input Validation | n/a-new | No new user input; `run_id`/`thread_id` remain UUID-typed. |
| V6 Cryptography | no | No crypto. |
| Logging (T-073-04) | yes | Reconciler/owner logs are identifier-only (run id, no content) — preserve (`run_reconciler.py:70-71` short error notes; `threads.py:461-465`). Never leak tracebacks into the RLS-readable `runs.error` column. |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation (existing, preserve) |
|---------|--------|--------------------------------|
| Cross-user cancel/stream | Info Disclosure / EoP | Ownership SELECT before any RUN_TASKS/Redis op (T-062-01/02). |
| False-orphan terminalization on Redis hiccup | Tampering (self-inflicted) | Skip-on-unverifiable-liveness (Pitfall 6). |
| Sweep double-run under WORKER_COUNT=2 | (correctness) | SET NX single-flight (D-145-08). |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Redis (local, docker-compose.dev.yml) | stream-age oracle, `runs:active`, guard | ✓ (project default) | — | Sweep degrades to skip on Redis error (safe default). |
| Postgres/Supabase (local CLI) | `runs.status` authoritative | ✓ (project default) | — | none (hard dep). |
| Redis Streams `XINFO STREAM` | last-generated-id oracle | ✓ (already used `threads.py:449`) | Redis ≥5 (streams) | `XREVRANGE run:{id} + - COUNT 1` as alt. |
| WORKER_COUNT=2 (multi-uvicorn) | single-flight test realism | ✓ (CLAUDE.md default) | — | test at WORKER_COUNT=2 for the cancel Open Q1. |

**Missing dependencies with no fallback:** none. All infrastructure is the standard local dev stack.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `STALE_TIMEOUT` should be ~2400s (> 1800s ask_user ceiling), correcting CONTEXT's "2–5 min" | U2 | Too low → kills live `ask_user`/reasoning runs; too high → slow dead-producer correction. Operator ratifies; default is a config field so it's tunable without a deploy. |
| A2 | `ask_user` (Deep tool) keeps `runs.status='streaming'` (not a distinct paused status) during the wait | U2/U3 | If it uses `cap_paused` instead, the sweep must exclude that status (Pitfall 3 already covers `cap_paused`). Verify in the LIVE repro (D-145-11). |
| A3 | The watchdog must write `streamingThreads.delete` + `runStatus` flip itself (reconcile doesn't) | U7/Pitfall 1 | If a hidden derive already clears `streamingThreads`, the watchdog write is redundant (harmless). Grep confirmed no such write, but verify in the LIVE repro. |
| A4 | Cross-worker cancel gap exists (task.cancel is in-process) | U4/Open Q1 | If a cross-worker cancel signal exists that I missed, Open Q1 is moot. Grep found only `publish_cancel_sentinel` (ask_user-only). |
| A5 | `xinfo_stream` returns `last-generated-id` as `<ms>-<seq>` (Redis server clock) | U3 | If the deployed Redis strips it, fall back to `XREVRANGE … COUNT 1`. Standard Redis behavior. |

*(Every `[ASSUMED]`/A-tagged item needs operator confirmation or LIVE-repro verification before it becomes a locked decision. A1 in particular contradicts a value in CONTEXT and must be surfaced.)*

## Open Questions (RESOLVED at plan time — 2026-07-09)

> All three were settled during `/gsd:plan-phase 145` (operator ratification + plan design). Kept here for the audit trail with the resolution pointer.

1. **Cross-worker cancel (WORKER_COUNT=2).** — **RESOLVED: FLAGGED, not fixed (out of 145 scope).**
   - What we know: `task.cancel()` is in-process; a Stop on the non-owning worker falls to zombie-heal (marks DB cancelled) while the live producer keeps running on the other worker.
   - What's unclear: whether this reproduces in the operator's dev setup (WORKER_COUNT=2 default) and whether the producer's own terminal then overwrites `cancelled` (no CAS in `finalize_run`).
   - **Resolution:** honesty/extraction scope only — Plan 145-03 records it as an accepted threat (`T-145-03-03`) + surfaces it in the cancel UAT; Plan 145-06 plants it in SEED-109 with re-open trigger "a live run is not cancellable when Stop lands on the non-owning worker." No fix in 145.

2. **`cap_paused` under the periodic sweep.** — **RESOLVED: excluded from the periodic sweep.**
   - What we know: `cap_paused` is non-terminal, quiet, and re-attachable (harness Continue).
   - **Resolution:** Plan 145-04 calls the periodic reconciler with `include_cap_paused=False` (boot sweep / Continue flow keep owning it); covered by `test_cap_paused_not_swept_periodically`.

3. **`STALE_TIMEOUT` final value (A1).** — **RESOLVED: config-driven 2400s (operator-ratified).**
   - What we know: longest legit silent gap = 1800s (ask_user) / 900s (reasoning).
   - **Resolution:** operator ratified the config-driven generous default over the exclude-ask_user alternative — Plan 145-04 adds `run_stale_sweep_timeout_seconds: int = 2400` (+ `run_stale_sweep_interval_seconds`) to `config.py`. The exclude-ask_user path is NOT built.

---

## Sources

### Primary (HIGH confidence — codebase, read this session)
- `backend/app/services/run_reconciler.py` — boot reconciler to extend; `_is_orphan` (membership → stream-age), `_reconcile_chat_runs`, SET NX guard, `_drop_stream`.
- `backend/app/db/runs.py` — `finalize_run` (status-only; the shared terminal writer) / `insert_run`.
- `backend/app/api/threads.py` — `_emit`/`_emit_terminal` (:152-183), ZADD (:1124-1125), spawn-fail (:1131-1141), Deep terminal (:1684-1724), continuation terminal (:2176-2212), `get_snapshot` (:364-487), `xinfo_stream` usage (:449, :482).
- `backend/app/api/runs.py` — `stream_run` (:386-456, `ping=None`), `cancel_run` DELETE (:1092-1259, happy/zombie/terminal paths).
- `backend/app/api/admin.py` — `ZCARD runs:active` backpressure (:72).
- `backend/app/main.py` — lifespan spawns (:257-314): boot reconciler, resume sweep, `_sweep_expired_templates` interval precedent.
- `backend/app/config.py` — `llm_call_timeout_seconds` tiers (:212-220; 180/300/600/900s), `ask_user_max_timeout_seconds=1800` (:979).
- `backend/app/services/tool_dispatcher.py` — `code_executing` heartbeat (:1031/1145/1240), `ask_user` clamp (:3022-3030).
- `backend/app/services/harness_engine.py` — `resume_stranded_workflows` (boot-only precedent, :1672-1791).
- `frontend/src/providers/StreamsProvider.tsx` — `_isTransientStreamEnd` (:194-236), `_reattachAfterTransient` (:257-278), reconcile action (:1361+), onTerminal handlers (:1499-1590, :1802-1880), streamingThreads writes (:1715/:1852/:2019), visibility listeners (:2592-2616), selectors (:2937-2982).
- `frontend/src/components/chat/ChatArea.tsx` — Stop wired to `useStreamingForThread` (:67, :342-343).
- `backend/tests/test_run_reconciler.py` — in-memory fake pattern to extend.
- `frontend/src/__tests__/providers/StreamsProvider.transient.test.ts` — getSnapshot-mock pattern.
- `145-CONTEXT.md`, `BUG-260709-01`, `BUG-260702-02`, `.planning/REQUIREMENTS.md` (FND-01), `.planning/ROADMAP.md` (Phase 145).

### Secondary (MEDIUM — Redis semantics)
- Redis `XINFO STREAM` returns `last-generated-id` (`<ms>-<seq>`, server-clock ms); trim-independent — `[CITED: redis.io/commands/xinfo-stream]`, corroborated by existing `xinfo_stream` use in `threads.py`.

### Tertiary (LOW — none)
- No unverified web claims; all findings are codebase-grounded.

---

## Metadata

**Confidence breakdown:**
- Standard stack / no-new-packages: HIGH — verified by codebase (all primitives exist).
- Extraction seams (U5): HIGH — exact line refs for every move; DI seam matches shipped `reconcile_orphaned_runs`.
- Timeout values (U1/U2): HIGH on the evidence (900s/1800s from config.py), MEDIUM on the exact recommended number (operator must ratify A1).
- Stream-age oracle (U3): HIGH — `xinfo_stream` already used in-repo; `last-generated-id` is standard Redis.
- Cancel path (U4): HIGH on the happy/zombie trace; MEDIUM-flagged cross-worker gap (Open Q1).
- Direction A repro shape (U7): HIGH — the missed-terminal/open-connection mechanism is a direct code trace; LIVE repro (D-145-11) will confirm.

**Research date:** 2026-07-09
**Valid until:** ~2026-08-09 (stable internal code; re-verify if `threads.py`, `StreamsProvider.tsx`, `run_reconciler.py`, or the `config.py` timeout tiers change before planning).
