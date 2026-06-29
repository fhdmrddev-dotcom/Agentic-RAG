# Phase 133: Eval Runner — With-Skill vs Without-Skill - Research

**Researched:** 2026-06-30
**Domain:** Eval-run orchestration over the existing agent loop + run-buffer SSE; new owner-scoped persistence (migration 080)
**Confidence:** HIGH (every claim below is grounded in a read of the cited file:line; no external package research needed — this phase adds zero dependencies)

## Summary

Phase 133 is, architecturally, **"`skill_tuner.py` but the per-cell work is `run_agent_loop` instead of `forced_emit`."** The Skill Trigger Tuner (Phase 123) already ships the *exact* substrate this phase needs: a net-new owner-scoped router that kicks off a **bounded background run over the Redis run-buffer**, returns a `run_id` immediately, streams a **distinct, additive SSE event vocabulary** over the **shared `replay_tail_consumer`**, closes with a single `done`/`error` terminal sentinel, and exposes a results GET. `[VERIFIED: backend/app/api/skill_tuner.py:1-90]` The eval runner should be modeled directly on it.

The one place Phase 133 is genuinely harder than the tuner: the tuner measured skill *triggering* with a single `forced_emit` shot and never needed a thread or the agent loop. EVAL-02 measures **real skill behavior** (does the agent load and *use* the skill), which requires the full multi-iteration tool-calling loop — i.e. `run_agent_loop(ctx, ...)`. That entry point (a) requires a real `thread_id` whose message history it reads from the DB `[VERIFIED: agent_loop.py:1101, 1143]`, and (b) injects the skill catalog through a **hardcoded** block with no override hook `[VERIFIED: agent_loop.py:1174-1195]`.

**The single shared-path risk (read this first, planner):** an honest A/B per D-03 (WITH = target skill only) and D-04 (WITHOUT = no skills) **cannot be produced read-only**. The only existing "no skills" lever is `agent_mode == "explorer"`, but explorer *also* swaps the system prompt, the toolset, and the iteration cap `[VERIFIED: agent_loop.py:1153-1160]` — so using it for the WITHOUT arm changes more than one variable and breaks the honest A/B. Producing "target-only" and "empty" catalogs requires **one additive, default-off parameter on `RunContext`** that the injection block reads. This is the *sanctioned* extension pattern (identical to Phase 092's `resume_dropped_tool_calls`, which is off at every existing call site → Deep Mode byte-identical `[VERIFIED: agent_loop.py:186-194]`), **not** a fork of the provider path that D-14 forbids. It is still a write to a G-5 hot file and must be planned with a Deep-byte-identical regression guard.

**Primary recommendation:** Build a net-new `eval_runner_service.py` + `app/api/evals.py` router modeled on `skill_tuner.py`. Mint **one `run_id` per eval run** = the stream buffer key + an `eval_runs.id`; also insert a companion `public.runs` row keyed by that id so `getActiveRuns`/`subscribeToRun`/`DELETE /runs/{id}` (reattach + cancel) work **unchanged**. Drive each completion through `run_agent_loop` with a **no-op `emit`/`emit_terminal`** (the loop itself emits `'error'` and `'done'`, both TERMINAL_TYPES — they must never reach the eval buffer), capture `AgentLoopResult.full_content_final`, persist an `eval_results` row immediately, and emit additive `eval_*` status events to `run:{run_id}`. Add the one additive `RunContext.skill_catalog_override` field for the honest A/B. Run the two arms **sequentially** per case.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Launch eval run / list runs / fetch results | API / Backend (`app/api/evals.py`) | — | Owner-scoped CRUD + kickoff; mirrors `skill_tuner.py` router |
| Drive 2×N completions through the agent loop | API / Backend (`eval_runner_service.py` background task) | Provider gateway | Reuses `run_agent_loop`; provider routing stays at the gateway boundary (D-14) |
| Per-case live progress | API / Backend → Redis `run:{run_id}` | Frontend (reattach) | Additive `eval_*` events on the shared run-buffer transport |
| Persist run + per-case results | Database (`eval_runs`, `eval_results`, mig 080) | `public.runs` companion row | Durable record survives Redis TTL + backend restart (D-06) |
| Reattach-on-reload / cancel | Frontend (`subscribeToRun`/`getActiveRuns`) | API `/runs/*` | Reuse existing chat-run lifecycle verbatim via the companion `runs` row |
| Thin run/watch/results UI | Frontend (--skip-ui surface) | — | Non-designed; Phase 137 owns the real panel |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** One eval run targets **a single provider/model, picked at launch**. Compare providers by launching another run (cost = 2 variants × N cases per run).
- **D-02:** The result schema is **provider-keyed regardless** (every `eval_results` row records provider/model) so multi-provider fan-out is a later additive change.
- **D-03:** The WITH-skill completion injects **ONLY the target skill** into the catalog (not the full enabled catalog). Resolves SEED-002. Lever: the injection block at `agent_loop.py:1174-1195`.
- **D-04:** The WITHOUT-skill completion injects **no skills at all** (empty catalog). Combined with D-03, the only variable across the two runs is the target skill itself.
- **D-05:** Live progress is **per-case/per-variant status transitions + full completion text dropped when each arm finishes** — NOT token-by-token. Streams through the existing `_emit → run:{run_id}` buffer as **additive** event types.
- **D-06:** **Persist-per-case, reattach-on-reload, no server-crash auto-resume.** Each case result persists the instant that arm completes. Reload reattaches via `getActiveRuns` + `subscribeToRun(since=0)`. Backend death mid-run → marked interrupted, partials readable, user re-runs. No new durable worker/job infra.
- **D-07:** Ship a **thin, non-designed functional surface** (treat as `--skip-ui`, mirrors Phase 132). No polish, no UI-SPEC. Must not pre-empt Phase 137.
- **D-08:** Add eval-run tables in **migration `080`**. `eval_runs` FK `skill_version_id → skill_versions.id` (per Phase-132 D-10) + `skill_id`, `user_id`, `provider`, `model`, `status`, `created_at`. `eval_results` FK `eval_run_id`, FK `test_case_id → skill_test_cases.id`, a `variant` discriminator (`with_skill`/`without_skill`), output text, per-result status + error, tokens. **Owner-only RLS + app-code `.eq("user_id", …)` as the real gate.** Apply via SQL editor, regen `full-schema.sql` (no-reset), commit both.

### Claude's Discretion
- **How an eval completion is driven through the thread-keyed loop** — ephemeral/throwaway thread per completion vs eval-scoped without a persisted chat thread (follow `threads.py:1490` RunContext build + `skill_tuner_service.py` precedent). → **Resolved below: one ephemeral eval thread per eval run, sequential, user-message-only.**
- **Whether the two arms run sequentially or concurrently.** → **Resolved below: sequential.**
- Exact `eval_runs`/`eval_results` columns, status enums, SSE event type names, endpoint shapes — consistent with `runs.py` + `skill_tuner.py`. → **Concrete proposals below.**
- Provider/model picker UI specifics in the thin surface.

### Deferred Ideas (OUT OF SCOPE)
- Multi-provider fan-out in one run (results already provider-keyed — D-02).
- Full token-by-token streaming of each completion (revisit only if D-05 feels insufficient in UAT).
- Fully resumable runs / server-crash auto-resume (needs durable job/worker model — v3.3+).
- Per-provider pass/fail verdict + side-by-side comparison UI + thumbs-up/down ratings → Phase 134 (EVAL-03/04).
- Designed Skill Evals panel → Phase 137 (PANEL-01, G-2).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EVAL-02 | Launch an eval run that executes each saved test case WITH the target skill and WITHOUT it; per-case progress streams live over SSE; the full result set persists + remains readable after reload/restart; reuses the existing agent loop + provider gateway (no new runtime); Deep Mode byte-identical (SC#10). | The full design below: `skill_tuner.py`-modeled router/service (§Architecture Patterns), the no-op-emit `run_agent_loop` drive (§Pattern 2), the one additive `RunContext.skill_catalog_override` for the honest A/B (§Shared-Path Risk), migration 080 (§Persistence), reattach via the companion `runs` row (§Pattern 3). |

## ⚠ Shared-Path Risk (FIRST-CLASS — planner must address)

**Risk:** The honest A/B (D-03/D-04) requires editing the shared skill-injection block in `agent_loop.py`, a G-5 hot file on the Deep/agent-loop path that D-14 protects.

**Evidence:**
- The catalog is built by a hardcoded query with **no injection point**: `agent_loop.py:1174-1195` runs `supabase.table("skills").select("name, description").or_(f"user_id.eq.{current_user['id']},is_global.eq.true").eq("is_enabled", True)` and appends `## Available Skills`. `[VERIFIED: agent_loop.py:1176-1195]`
- The only existing skip lever is `if body.agent_mode != "explorer":` — but the explorer branch *also* sets `active_system_prompt = EXPLORER_SYSTEM_PROMPT`, `active_tools = get_explorer_tools()`, and `max_iterations = 8` `[VERIFIED: agent_loop.py:1153-1160]`. Using explorer for the WITHOUT arm therefore changes **three** variables besides skills → **not** an honest A/B.
- `RunContext` is `frozen=True` and carries only stable inputs; there is **no** field that scopes the catalog `[VERIFIED: agent_loop.py:166-194]`.
- DB-level workarounds (toggling `is_enabled` / `is_global` on real skill rows to control what the query returns) are **unsafe**: global mutable state under `WORKER_COUNT=2`, races, and it corrupts the user's real catalog. Rejected.
- A synthetic `current_user["id"]` that owns no skills still returns all `is_global=true` enabled skills — cannot produce "target-only" or guaranteed-empty. Rejected.

**Recommended resolution (the sanctioned pattern, NOT a fork):**
Add **one additive, default-off** field to `RunContext`, e.g.:
```python
# ADDITIVE — off at every existing call site → Deep Mode byte-identical (092 precedent).
skill_catalog_override: tuple[dict, ...] | None = None  # None = query DB (current behavior); () = inject NOTHING; (skills,) = inject EXACTLY these
```
and change **only** the data source inside the injection block:
```python
if body.agent_mode != "explorer":
    if ctx_skill_catalog_override is None:        # default — unchanged DB query
        enabled_skills = (await aexec(... existing query ...)).data or []
    else:                                          # eval arms drive this
        enabled_skills = list(ctx_skill_catalog_override)
    if enabled_skills:
        ... existing catalog_note build, UNCHANGED ...
```
This is **byte-identical** to Phase 092's `resume_dropped_tool_calls` / `dropped_tool_calls` extension (additive frozen-dataclass fields, default-off, every existing call site unchanged) `[VERIFIED: agent_loop.py:186-194; threads.py:1490-1500 builds RunContext without them]`. D-14 forbids *forking the shared provider path*; an additive default-off input that the same single code path reads is the project's established way to extend the loop. The eval service then passes:
- WITH arm: `skill_catalog_override=({"name": skill.name, "description": <version-snapshot description>},)`
- WITHOUT arm: `skill_catalog_override=()`

**Planner obligations:** (1) flag this as a Deep-path touch in PLAN `files_modified` (G-5 ledger: `agent_loop.py` is the loop, audit during plan); (2) include a regression test asserting Deep Mode (override `None`) produces the identical catalog query + prompt; (3) the SC#10 "Deep Mode byte-identical" UAT axis is the lived backstop. **Do not** attempt a read-only hack — there isn't an honest one.

## Standard Stack

**No new packages.** This phase reuses the in-tree stack only: FastAPI router + Pydantic models, `redis.asyncio` (run-buffer), `supabase-py` (service-role, owner-scoped), `asyncpg` (durable run writes via `app/db/runs.py`), `sse_starlette.EventSourceResponse` (already used by `runs.py`/`skill_tuner.py`), and `run_agent_loop` + the provider gateway. `[VERIFIED: skill_tuner.py:42-60 import set; runs.py:32-63]`

| Component | Source | Purpose |
|-----------|--------|---------|
| `app.services.agent_loop.run_agent_loop` / `RunContext` / `AgentLoopResult` | agent_loop.py:1031 / :166 / :197 | The single-completion driver per eval arm |
| `app.api.runs.replay_tail_consumer` | runs.py:81 | Shared SSE consumer (eval stream reuses it) |
| `app.db.runs.insert_run` / `finalize_run` | db/runs.py:26 / :69 | Durable companion `runs` row (reattach + cancel reuse) |
| `app.config.get_model_capability` | config.py:489 | Resolve provider from chosen model (single provider/run, D-01) |
| `forced_emit` / gateway dispatcher | provider_gateway/dispatcher.py:87 | NOT called directly — `run_agent_loop` routes through it internally |

## Package Legitimacy Audit

**No external packages are installed by this phase.** Every dependency is already in `backend/requirements.txt` and exercised by the chat/tuner paths. Package Legitimacy Gate: N/A (no `npm install` / `pip install` step). If the planner later decides to add a helper, run the gate then.

## Architecture Patterns

### System Architecture Diagram

```
POST /skills/{skill_id}/evals/runs (provider, model)
        │  owner-verify skill (.or_(own,global)) → 404 on miss
        │  resolve skill_version_id (latest) ; read test cases (owner-scoped)
        ▼
  eval_runner_service.start_run()
        │  mint run_id (uuid4)
        │  create ephemeral eval thread (one per run)
        │  insert eval_runs row (status=running)         ──► public.eval_runs  (mig 080)
        │  insert companion public.runs row (run_id, thread_id, status=streaming, model, provider)
        │  ZADD runs:active / runs_by_thread:{thread}    ──► Redis sorted sets (reattach feed)
        │  spawn background task ; RUN_TASKS[run_id]=task (cancel reuse)
        ▼  return {run_id} IMMEDIATELY (non-blocking, D-06)
  background task (sequential):
   for case in cases:
     emit eval_case_started(case, variant=with_skill)   ──► run:{run_id} (XADD)
     ┌─ insert user message (case.prompt) into eval thread
     │  ctx = RunContext(thread_id=eval_thread, run_id, provider, model,
     │                   skill_catalog_override=(target_skill,))   ← WITH arm
     │  run_agent_loop(ctx, emit=NOOP, emit_terminal=NOOP, spawn=_spawn)  ──► provider gateway
     │  output = result.full_content_final ; tokens = result.*_tokens_total
     └─ insert eval_results(with_skill, output, status, tokens)    ──► public.eval_results
     emit eval_case_done(case, with_skill, output, status)         ──► run:{run_id}
     ... repeat for variant=without_skill with skill_catalog_override=() ...
   finalize: eval_runs.status=completed ; finalize_run(runs) ;
             ZREM sorted sets ; XADD terminal 'done' ; EXPIRE run:{run_id} 600s
        ▼
GET /runs/{run_id}/stream?since=  (REUSED verbatim — replay_tail_consumer)
GET /skills/{skill_id}/evals/runs/{run_id}  (results readout — DB read)
DELETE /runs/{run_id}  (cancel — REUSED verbatim via RUN_TASKS + companion runs row)
Frontend reload → getActiveRuns(thread) → subscribeToRun(run_id, since=0)
```

### Recommended Project Structure
```
backend/app/
├── api/evals.py                 # NEW router — mirrors skill_tuner.py shape
├── services/eval_runner_service.py  # NEW — bounded background run; drives run_agent_loop
├── models/eval_run.py           # NEW — Pydantic (StartEvalRunBody, EvalRunResponse, EvalResultResponse)
├── db/runs.py                   # REUSE insert_run/finalize_run for the companion runs row
└── services/agent_loop.py       # ONE additive field: RunContext.skill_catalog_override (§Shared-Path Risk)
supabase/migrations/080_eval_runs_and_results.sql  # NEW
frontend/src/...                 # thin --skip-ui surface (run button, live case list, results readout)
```

### Pattern 1: Bounded background run over the buffer (mirror `skill_tuner.py`)
**What:** POST owner-verifies, mints `run_id`, spawns a bounded background task, returns `{run_id}` immediately; progress rides `run:{run_id}` as a **distinct** event vocabulary; a single `done`/`error` terminal closes it; buffer gets a post-finalize `EXPIRE`. `[VERIFIED: skill_tuner.py:1-90, 210-241]`
**When to use:** This is the exact eval-runner skeleton.
**Key reuse details:**
- Owner-scoping helper: copy `_fetch_owned_or_global_skill` (skill_tuner.py:177-206) — service-role client, `.or_(own,global)`, 404 on miss, wrapped in `run_in_threadpool`.
- Emit helpers: copy `_emit_tuner`/`_emit_terminal` shape (skill_tuner.py:210-240) — canonical `{"data": json.dumps({"type", **fields})}` envelope, MAXLEN 10000, EXPIRE on terminal.
- In-flight guard: atomic Redis `SET NX` claim `eval_inflight:{skill_id}` with CAS-release (skill_tuner.py:92-135) so a skill can't have two concurrent eval runs under `WORKER_COUNT=2`.
- Cancel flag: `eval_cancel:{run_id}` checked at the top of each case/arm so a DELETE stops further (paid) completions cleanly (skill_tuner.py:138-146, 288-289).

### Pattern 2: Drive `run_agent_loop` per arm with a NO-OP emit
**What:** Each completion calls `run_agent_loop(ctx, emit=_noop, emit_terminal=_noop, spawn=_spawn)` and reads the outcome from the **return value**, not the stream.
**Why no-op emit (critical):** `run_agent_loop` emits `'error'` (agent_loop.py:2061, 2186, 2525, 2537) and the closing `'done'`/`'stream_end'` (docstring + post-loop emits) directly through the passed `emit`. Both `'error'` and `'done'` are in `TERMINAL_TYPES` `[VERIFIED: threads.py:137]`, and `replay_tail_consumer` **breaks on the first terminal entry** `[VERIFIED: runs.py:188-189, 335-336]`. If completions shared the eval buffer with the real emit, the **first** completion's `done`/`error` would terminate the whole eval stream. A no-op emit eliminates this entirely and matches D-05 (status + final text, not token streaming).
**Outcome capture:** `AgentLoopResult.full_content_final` is the completion text; `input_tokens_total`/`output_tokens_total` are the tokens `[VERIFIED: agent_loop.py:218-224]`. The eval service does **not** call `result.persist` (no chat assistant row needed — `eval_results` is the durable record) and does **not** run `_shielded_finalize` (that is threads.py's; the eval service owns its own finalize).
**Failure handling:** wrap each completion in `try/except`; on raise (timeout/cancel/exception) record `status='failed'`/`'error'` + truncated error string on the `eval_results` row and continue to the next case — partials stay readable (D-06).

### Pattern 3: One `run_id`, companion `runs` row → reattach + cancel for free
**What:** Use **one** `run_id` for the whole eval run = the `run:{run_id}` buffer key AND `eval_runs.id`; also `insert_run(pool, run_id=run_id, thread_id=<eval thread>, user_id, status="streaming", model, provider)` `[VERIFIED: db/runs.py:26-66]`.
**Why:** `getActiveRuns(threadId)` queries `public.runs` by thread `[VERIFIED: threads.py:304-308; api.ts:848-859]`; `subscribeToRun(runId, since)` hits `GET /runs/{id}/stream` which owner-checks the `runs` row `[VERIFIED: runs.py:386-407; api.ts:503-522]`; `DELETE /runs/{id}` cancels via `RUN_TASKS[run_id]` + zombie-heals the `runs` row `[VERIFIED: runs.py:1092-1155]`. By inserting the companion `runs` row and registering `RUN_TASKS[run_id]`, the eval run reattaches and cancels through the **existing chat-run machinery with zero new frontend stream code**. The `eval_runs` table carries the eval-domain data; the `runs` row carries the streaming lifecycle. They are 1:1 on `run_id`.
**Reattach flow (frontend):** on reload, `getActiveRuns(evalThreadId)` → if the eval run is streaming, `subscribeToRun(run_id, since=0)` replays all buffered `eval_*` events then live-tails (D-06). The durable readout always comes from `GET .../evals/runs/{run_id}` (DB), so even after the buffer TTL-expires the full result set renders.

### Pattern 4: Thread strategy (resolves the Discretion question)
**Recommendation: one ephemeral eval thread per eval run; arms run sequentially; insert only the test-case prompt as a user message; do not persist assistant replies.**
**Why a thread at all:** `run_agent_loop` reads `threads.folder_id` (`.single()`, agent_loop.py:1101) and the full message history for `thread_id` (agent_loop.py:1143-1150) — it is hard-coupled to a DB-resident thread + messages. There is no in-memory-history path; building one would fork the loop (D-14 violation). So a real thread row + a real user-message row must exist before each completion.
**Why one thread, sequential, prompt-only:** the history load is origin-filtered and ordered (agent_loop.py:1143-1150). Running arms/cases **sequentially** and inserting **only** the current case's prompt (and *not* persisting the assistant reply) keeps each completion a clean single-turn context. Between cases, remove the prior prompt (or use a fresh thread per case — see tradeoff) so case *i+1* never sees case *i*. Both arms of one case read the same single prompt — no re-insert needed between WITH and WITHOUT.
**Tradeoff vs fresh-thread-per-completion:** a fresh thread per completion (2N threads) gives structural isolation with zero cleanup logic but pollutes `list_threads` (which returns all threads by `user_id` `[VERIFIED: threads.py:204-216]`) with 2N rows per run. One reused ephemeral thread keeps the count to one but needs sequential execution + between-case prompt cleanup. **Recommend the single reused thread** for a thin surface; flag the cosmetic "eval threads appear in the chat list" issue for the planner (cheapest fix: filter `list_threads` by a title/marker — a *minor additive* threads.py edit, not on the agent-loop path; or defer hiding to Phase 137).
**Why sequential arms (resolves the second Discretion question):** (1) live progress is per-case/variant either way (D-05), so concurrency buys only wall-clock; (2) the tuner deliberately serializes within a provider and caps cross-provider concurrency at 4 because 8-wide bursts trip provider rate limits `[VERIFIED: skill_tuner.py:69-74]` — eval completions are *heavier* (full multi-iteration loops), so concurrent arms on one provider/model (D-01 is single-provider) would hit the **same** rate-limit bucket; (3) a single reused thread requires sequential execution for clean history. Concurrency is a clean later optimization (provider-keyed schema already supports fan-out — D-02). Recommend sequential.

### Anti-Patterns to Avoid
- **Sharing the eval buffer with the real loop emit** → first completion's `done`/`error` kills the stream (Pattern 2). Use no-op emit.
- **Toggling real skill `is_enabled`/`is_global` to fake the A/B** → global mutable state under multi-worker; corrupts the user catalog. Use `RunContext.skill_catalog_override` (§Shared-Path Risk).
- **Using `agent_mode="explorer"` for the WITHOUT arm** → changes prompt+tools+iterations, not just skills → dishonest A/B (agent_loop.py:1153-1160).
- **Blocking supabase-py calls directly in async handlers** → wrap reads/writes in `run_in_threadpool` (D-v2.5-01; skill_tuner.py:183-197 precedent). Note: `skill_test_cases.py` deliberately calls sync inline as accepted tech-debt (SEED-097) — the **new** router should prefer `run_in_threadpool` (matches skill_tuner, the closest live-run precedent).
- **In-process run state** → `WORKER_COUNT=2`; all eval state lives in Redis + DB, never module globals (the `RUN_TASKS`/in-flight-claim pattern is the sanctioned exception: `RUN_TASKS` is a same-process cancel handle, the in-flight *correctness* gate is the Redis `SET NX` claim — skill_tuner.py:92-105).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Live progress transport | A new WebSocket / polling channel | `_emit`-style XADD to `run:{run_id}` + `replay_tail_consumer` | Reattach, replay, TTL, terminal-sentinel already solved (runs.py) |
| Reattach-on-reload | New active-eval-runs endpoint + client | Companion `public.runs` row → `getActiveRuns`/`subscribeToRun` | Zero new frontend stream code (Pattern 3) |
| Cancel a run | New cancel endpoint | `DELETE /runs/{run_id}` + `RUN_TASKS[run_id]` | Happy-path + zombie-heal already handled (runs.py:1092) |
| Durable run lifecycle | New status machine | `public.runs` + `insert_run`/`finalize_run` | Status enum, indexes, RLS already exist (mig 035, db/runs.py) |
| One-run-per-skill guard | In-process set | Atomic Redis `SET NX` claim + CAS-release | Holds across TOCTOU + multi-worker (skill_tuner.py:92-135) |
| Provider routing per arm | Branch on provider in the eval service | Set `RunContext.resolved_provider/model`; the loop routes via the gateway | D-14: provider differences stay at the gateway boundary |

**Key insight:** Phase 123 already paid the cost of building the bounded-background-run-over-the-buffer pattern; Phase 133's net-new code is small if it copies that skeleton and swaps the inner unit of work (`forced_emit` → `run_agent_loop`).

## Persistence: Migration 080 (concrete proposal)

Next number is **`080`** (079 latest applied). Mirror the 079/035/077 conventions exactly: owner-only RLS as defense-in-depth, app-code `.eq("user_id")` as the real gate, FK `ON DELETE CASCADE`, indexes on FK + user_id, `COMMENT ON TABLE`. Apply via the **Supabase SQL editor** (never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no `--reset`), commit migration + regenerated `full-schema.sql` together. `[VERIFIED: 079 header lines 35-39; CLAUDE.md schema rules]`

```sql
-- 080_eval_runs_and_results.sql — Phase 133 (EVAL-02) eval runner persistence.
CREATE TABLE public.eval_runs (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),  -- == the stream run_id (companion runs.run_id)
    skill_id         uuid NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    skill_version_id uuid NOT NULL REFERENCES public.skill_versions(id) ON DELETE CASCADE,  -- D-10 traceability
    user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider         text NOT NULL,                               -- D-01 single provider/run
    model            text NOT NULL,
    status           text NOT NULL DEFAULT 'running'
                       CHECK (status IN ('running','completed','failed','cancelled','interrupted')),
    case_count       integer NOT NULL DEFAULT 0,                  -- N test cases at launch
    error            text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    completed_at     timestamptz
);
CREATE INDEX idx_eval_runs_skill_id ON public.eval_runs (skill_id);
CREATE INDEX idx_eval_runs_user_id  ON public.eval_runs (user_id);

CREATE TABLE public.eval_results (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    eval_run_id   uuid NOT NULL REFERENCES public.eval_runs(id) ON DELETE CASCADE,
    test_case_id  uuid NOT NULL REFERENCES public.skill_test_cases(id) ON DELETE CASCADE,  -- D-10
    user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    variant       text NOT NULL CHECK (variant IN ('with_skill','without_skill')),         -- D-04 discriminator
    provider      text NOT NULL,                                  -- D-02 provider-keyed even though run is single-provider
    model         text NOT NULL,
    output        text NOT NULL DEFAULT '',                       -- full_content_final
    status        text NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('completed','failed','timed_out','cancelled')),
    error         text,
    input_tokens  integer,
    output_tokens integer,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eval_results_run_id  ON public.eval_results (eval_run_id);
CREATE INDEX idx_eval_results_case_id ON public.eval_results (test_case_id);
CREATE INDEX idx_eval_results_user_id ON public.eval_results (user_id);

-- RLS: owner-only SELECT (defense-in-depth; service-role writes bypass RLS; app-code .eq(user_id) is the real gate).
ALTER TABLE public.eval_runs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eval_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own eval runs"
  ON public.eval_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own eval results"
  ON public.eval_results FOR SELECT USING (auth.uid() = user_id);
-- No INSERT/UPDATE/DELETE policies — all writes go through the service-role background task (035/079 precedent).
```

**Notes / decisions:**
- `eval_runs.id` doubles as the stream `run_id`; the companion `public.runs` row uses the same UUID (Pattern 3). No separate `run_id` FK column needed — they are equal by construction.
- `status='interrupted'` is the backend-died-mid-run terminal (D-06): a startup sweep (or the next read) can flip a stranded `running` eval_run to `interrupted`; partials in `eval_results` stay readable. (Mirrors the runs zombie-heal philosophy; **no** auto-resume.)
- Two results rows per case (with/without). After Phase 134 adds ratings, those FK into `eval_results.id` — keep the PK stable (D-10 forward-compat).
- `expected_behavior` lives on `skill_test_cases` (mig 079) — **not** copied here; the run reads it from the case at compare time (Phase 134).

## Backend Conventions & Endpoint Shapes

Mount the new router at `backend/app/main.py` alongside the others: add `evals` to the `from app.api import (...)` line (main.py:423) and `app.include_router(evals.router)` after `skill_test_cases.router` (main.py:446). `[VERIFIED: main.py:423-446]`

Proposed routes (mirror `skill_tuner.py` prefix style under `/skills/{skill_id}/...`; stream/cancel reuse `/runs/*`):

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/skills/{skill_id}/evals/runs` | Owner-verify skill, resolve latest `skill_version_id`, read owner-scoped test cases, mint run_id, spawn bounded background task, return `{run_id}` immediately (D-06) |
| `GET` | `/runs/{run_id}/stream?since=` | **Reused verbatim** (runs.py) — eval `eval_*` events stream over the shared consumer |
| `GET` | `/skills/{skill_id}/evals/runs/{run_id}` | Owner-verify, return the eval_run + its eval_results (the durable readout; survives TTL/restart) |
| `GET` | `/skills/{skill_id}/evals/runs` | List a skill's eval runs (owner-scoped, newest first) |
| `DELETE` | `/runs/{run_id}` | **Reused verbatim** (runs.py) — cancel via `RUN_TASKS` + companion runs row; the background task also checks `eval_cancel:{run_id}` |

Pydantic models (mirror `skill_test_case.py`/`skill_version.py` shape): `StartEvalRunBody {provider: str, model: str}` (single provider/run — D-01); `EvalRunResponse` (all `eval_runs` columns); `EvalResultResponse` (all `eval_results` columns). Use `from __future__ import annotations`, plain `BaseModel`, FLAT single-typed fields (no multi-type unions — Gemini schema trap, but only relevant if a model is ever forced-emit'd; not for these CRUD shapes). `[VERIFIED: models/skill_test_case.py:1-52]`

Provider/model resolution (D-01): the POST body carries `provider` + `model`; derive/validate provider from the model via `get_model_capability(model)` exactly like the tuner does `[VERIFIED: skill_tuner_service.py:104-110, 216]`, then set `RunContext(resolved_provider=provider, resolved_model=model, ...)`. The loop routes through the gateway unchanged — no eval-side provider branching (D-14).

## Cross-Provider (SC#10) Considerations

- **Threading the provider into the loop:** set `resolved_provider`/`resolved_model` on the `RunContext` (the same fields threads.py sets at :1498-1499) `[VERIFIED: threads.py:1490-1500; agent_loop.py:184-185, 1093-1094]`. The eval completion then routes through `provider_gateway.open_stream` exactly as a chat turn does — **no eval-specific provider code**. D-01 keeps a run single-provider, so there is no per-arm provider divergence within a run.
- **Per-provider traps to flag for VALIDATION.md:**
  - The `skill_catalog_override` content becomes part of the system prompt (`## Available Skills` note). Anthropic rejects empty content blocks (the tuner notes "anthropic empty-block 400" — skill_tuner_service.py:130) — but the WITHOUT arm (`override=()`) simply **omits** the catalog note (the `if enabled_skills:` guard), so the base system prompt is non-empty. Confirm no empty-prompt path is introduced.
  - Tool-schema sanitizers differ per provider (Gemini multi-type arrays; minimax/moonshot strict validators — reference_gemini_schema_type_array_trap). These live inside the gateway and are exercised by the normal loop; the eval changes none of them — but the SC#10 cross-provider axis must still run a tool-using test case on each representative provider to prove the WITH arm actually loads + uses the skill across providers.
  - DeepSeek/MiniMax/GLM native-tool routing depends on exact model IDs in `MODEL_CAPABILITIES` (config.py:228); a wrong ID narrates tools as text. The eval's provider/model picker must surface only valid registry models (validate against `get_model_capability`).

## Runtime State Inventory

This is a **net-new** persistence + service phase, not a rename/refactor. The only "state" considerations:
- **Stored data:** new tables only (eval_runs, eval_results) — no existing data migrated. The v1 backfill concern was Phase 132's; none here.
- **Live service config:** none — no external service registration.
- **OS-registered state:** none.
- **Secrets/env vars:** none new — reuses existing provider keys + `REDIS_URL`/`SUPABASE_URL`.
- **Build artifacts:** none.
- **Ephemeral threads created at runtime** (Pattern 4) are the one new runtime-state footprint: they accumulate in `public.threads`. Plan a cleanup/visibility decision (filter from `list_threads`, or cascade-delete with the eval run, or leave + hide in Phase 137).

## Validation Architecture

> nyquist_validation is treated as enabled (no `workflow.nyquist_validation: false` found; absent = enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend), in `backend/` venv; frontend vitest (thin surface — minimal) |
| Config file | backend pytest config in repo (existing tuner/test-case tests are the template) |
| Quick run command | `cd backend && . venv/Scripts/activate && pytest tests/test_eval_runner.py -x` |
| Full suite command | `cd backend && . venv/Scripts/activate && pytest -q` (exclude known SEED-056 / 075.4-TEST-TRIAGE rot) |

### Phase Requirements → Test Map (observable truths per success criterion)
| SC | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|-------------|
| SC1 | Each case executed twice → exactly 2 `eval_results` rows per case (variant with_skill + without_skill) | unit/integration | `pytest tests/test_eval_runner.py::test_two_results_per_case -x` | ❌ Wave 0 |
| SC1 | WITH arm injects ONLY the target skill; WITHOUT injects nothing (catalog override honesty) | unit | `pytest tests/test_agent_loop_catalog_override.py -x` | ❌ Wave 0 |
| SC2 | `eval_case_started`/`eval_case_done` events land on `run:{run_id}` in order; no chat terminal types mid-run | unit | `pytest tests/test_eval_runner.py::test_sse_vocabulary -x` | ❌ Wave 0 |
| SC3 | Results persist per-case; readable via GET after the buffer is gone (simulate TTL expiry) | integration | `pytest tests/test_eval_runner.py::test_results_persist_after_buffer_expiry -x` | ❌ Wave 0 |
| SC3 | Reattach: companion `runs` row makes `getActiveRuns` list the eval run; `subscribeToRun(since=0)` replays | integration | `pytest tests/test_eval_runner.py::test_reattach_via_runs_row -x` | ❌ Wave 0 |
| SC4 | **Deep Mode byte-identical** — `RunContext` with `skill_catalog_override=None` produces the identical catalog query + system prompt as today | regression (unit) | `pytest tests/test_agent_loop_catalog_override.py::test_deep_mode_unchanged -x` | ❌ Wave 0 |
| SC4 | Owner-scoping: user B cannot launch/stream/read user A's eval run → 404 | integration | `pytest tests/test_eval_runner.py::test_cross_user_404 -x` | ❌ Wave 0 |

### SC#10 4-Axis UAT Bandwidth (authored in VALIDATION.md, NOT plan tasks — MANDATORY)
This phase touches streaming + agent loop + provider routing + UI state, so VALIDATION.md must carry:
- **Cross-provider:** launch an eval run on each of OpenAI, Anthropic, Google, OpenRouter (representative model per axis); confirm both arms complete and the WITH arm visibly loads the skill.
- **Multi-tool:** ≥1 test case whose prompt exercises 2+ tools (e.g. `search_documents` + `execute_code`) under the WITH arm — proves the full loop (not a single emission) runs.
- **Parallel-thread:** an eval run streaming while a normal Deep chat thread accepts a new prompt — confirm the eval buffer and the chat buffer don't interfere (distinct `run_id`s).
- **Long-history:** a test case with a ≥5 KB prompt (or run after a long chat thread exists) — confirm history-trim + completion still work in the eval thread.
- **Deep-Mode-byte-identical backstop:** run a normal Deep chat turn (no eval) and confirm catalog injection + streaming are unchanged after the `skill_catalog_override` field lands.

### Wave 0 Gaps
- [ ] `backend/tests/test_eval_runner.py` — covers SC1/SC2/SC3 + cross-user 404
- [ ] `backend/tests/test_agent_loop_catalog_override.py` — covers the additive field + Deep-Mode-unchanged regression (the shared-path guard)
- [ ] Shared fixtures: a seeded skill + skill_version + 2 test cases owned by a test user; a fake/mock provider for the inner `run_agent_loop` so unit tests don't hit a real LLM (mirror existing tuner test mocks)

## Security Domain

> security_enforcement treated as enabled (absent = enabled).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | Owner-scoping: every query `.eq("user_id", …)` (service-role bypasses RLS); 404-not-403 on cross-user; skill ownership verified before launch (`_fetch_owned_or_global_skill` pattern, skill_tuner.py:177) |
| V5 Input Validation | yes | Pydantic body models; validate `model`/`provider` against `get_model_capability` (reject unknown models); UUID path params |
| V6 Cryptography | no | No new secrets; reuses existing provider keys (never logged — presence-only, T-123-03-02 precedent) |
| V2/V3 Auth/Session | n/a | Reuses `get_current_user` dependency |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user IDOR (read/stream another user's eval run) | Information Disclosure | `.eq("user_id")` on every read + RLS defense-in-depth; companion `runs` row already 404s cross-user (runs.py:397-407) |
| DoS via unbounded fan-out / cost blow-up | Denial of Service | Bound N cases, single provider/run (D-01), per-call timeout (`get_per_call_timeout`), atomic in-flight claim (one eval per skill), `eval_cancel:{run_id}` checkpoint |
| Forged `skill_id`/body ids | Tampering / EoP | skill_id from path + owner-verify; user_id from `current_user`, never body (T-132-07 precedent) |
| Error-string leakage in `eval_results.error` / `runs.error` | Information Disclosure | Truncate to ≤200 chars (threads.py:1561 precedent) — never raw tracebacks/key fragments |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Skill-quality measurement via single `forced_emit` shot (trigger-only) | Full-loop behavioral eval via `run_agent_loop` (loads + uses skill) | This phase | Requires thread + catalog-override; heavier; sequential |
| Per-feature live channels | One run-buffer (`run:{run_id}`) + `replay_tail_consumer` + companion `runs` row | Phase 061-062/123 | Reattach/cancel/TTL are free; eval reuses them |

**Deprecated/outdated:** `event_consumer` in threads.py was deleted (Phase 063); the only live SSE consumer is `replay_tail_consumer` (runs.py). Do not resurrect a second streaming path. `[VERIFIED: threads.py:197-201]`

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A no-op `emit`/`emit_terminal` is functionally safe for `run_agent_loop` (emit is observability-only; tool dispatch/history/provider calls don't depend on its side effects) | Pattern 2 | LOW — if some control flow depends on emit, eval completions could misbehave; mitigate by reading the full loop body during planning and/or routing emit to a throwaway per-completion buffer instead of a true no-op | 
| A2 | `AgentLoopResult.full_content_final` holds the complete answer text on the happy path | Pattern 2 | MEDIUM — verify against a live completion; if empty on some provider paths, fall back to reading the (skipped) persist payload | 
| A3 | One reused ephemeral thread + sequential arms + prompt-only history yields clean single-turn isolation | Pattern 4 | MEDIUM — if origin/history filtering leaks a prior case, switch to fresh-thread-per-completion | 
| A4 | `interrupted` backend-died terminal can be set by a startup sweep or lazy read without new worker infra | Persistence | LOW — worst case a stranded `running` eval_run shows stale; partials still readable |

## Open Questions (RESOLVED)

1. **RESOLVED (deferred to Phase 137):** Should eval threads be hidden from `list_threads`?
   - Known: `list_threads` returns all threads by `user_id` (threads.py:204-216); ephemeral eval threads would appear.
   - Resolution: leave visible for the thin --skip-ui surface (D-07); proper hiding deferred to Phase 137. No filter task in Phase 133 scope.

2. **RESOLVED (self-answered):** `skill_catalog_override` exact shape — tuple of `{"name","description"}` dicts is enough for the WITH arm (the injection block only reads `s['name']`/`s['description']`, agent_loop.py:1186-1187). No downstream code needs the full skill row.

3. **RESOLVED (Plan 03 — version snapshot):** Which `skill_version_id` does a run record? — the **latest** version at launch time (max `version_number` for the skill, owner-scoped). The WITH arm's injected name/description comes from that **version snapshot** (not the live `skills` row) for true traceability per D-10. Implemented in Plan 03 must_haves.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Redis (run-buffer) | SSE streaming + in-flight claim | ✓ (docker-compose.dev.yml) | local | none — required (same as chat) |
| Supabase/Postgres | eval tables + companion runs row | ✓ | local CLI | none — required |
| asyncpg pool | `insert_run`/`finalize_run` | ✓ | existing | none |
| ≥1 LLM provider key | the actual completions | ✓ (per user_settings) | — | run fails honestly per-case if provider unconfigured |

No missing dependencies. No new infra.

## Sources

### Primary (HIGH confidence — read this session)
- `backend/app/services/agent_loop.py` — RunContext :166-194, AgentLoopResult :197-227, run_agent_loop :1031, thread/history load :1101/:1143-1150, agent_mode branch :1153-1160, **skill injection block :1174-1195**, terminal `error`/`done` emits :2061/:2186/:2525/:2537
- `backend/app/api/threads.py` — `_spawn` :112, RUN_TASKS :129, TERMINAL_TYPES :137, `_emit`/`_emit_terminal` :152/:169, run kickoff (uuid4/insert_run/zadd/RUN_TASKS) :1062-1118/:1778, `_enrich_messages_with_runs` :228, list_active_runs :304, Deep RunContext build :1490-1508
- `backend/app/api/runs.py` — `replay_tail_consumer` :81 (terminal break :188/:335), `GET /runs/{id}/stream` :386, `DELETE /runs/{id}` cancel/zombie-heal :1092
- `backend/app/api/skill_tuner.py` — the bounded-background-run-over-buffer precedent :1-90, in-flight CAS :92-135, owner-verify :177-206, emit/terminal helpers :210-241, concurrency caps :69-74
- `backend/app/services/skill_tuner_service.py` — drive-without-fork precedent, provider-from-model :104-110/:216, owner-scoped catalog query :406-428
- `backend/app/api/skill_test_cases.py` — owner-scoped CRUD + `.eq(user_id)` gate (the model to mirror)
- `backend/app/db/runs.py` — insert_run :26, finalize_run :69, insert_assistant_message :145
- `supabase/migrations/079_skill_versions_and_test_cases.sql` — FK targets + RLS/trigger conventions; `supabase/migrations/035_runs_table.sql` — durable runs model
- `backend/app/main.py:423-446` — router mount pattern
- `frontend/src/lib/api.ts` — `subscribeToRun` :503, `getActiveRuns` :848
- `backend/app/config.py:489` `get_model_capability`; `provider_gateway/dispatcher.py:42/:87` GatewayRequest/open_stream
- `.planning/phases/133.../133-CONTEXT.md`, `.../132-CONTEXT.md`, `CLAUDE.md`

### Secondary / Tertiary
- None — all findings are first-party codebase reads (no WebSearch needed; zero new packages).

## Metadata

**Confidence breakdown:**
- Standard stack / reuse map: HIGH — every component read at file:line.
- Architecture (tuner-modeled runner, companion runs row, no-op emit): HIGH — direct precedent in skill_tuner.py + verified terminal-emit hazard.
- Shared-path risk (catalog override): HIGH — hardcoded block verified; 092 additive-field precedent verified.
- Thread strategy + sequential arms: MEDIUM — sound from the loop's DB coupling + tuner rate-limit lesson, but isolation should be confirmed by an integration test (A3).
- Persistence shape: HIGH — mirrors 079/035/077 verbatim.

**Research date:** 2026-06-30
**Valid until:** ~2026-07-30 (stable internal codebase; re-check if agent_loop.py or runs.py change before planning)
