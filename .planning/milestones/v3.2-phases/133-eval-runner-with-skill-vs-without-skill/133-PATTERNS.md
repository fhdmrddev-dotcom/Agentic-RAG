# Phase 133: Eval Runner — With-Skill vs Without-Skill - Pattern Map

**Mapped:** 2026-06-30
**Files analyzed:** 8 (6 new, 2 modified)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/api/evals.py` (NEW) | route (router) | event-driven / streaming | `backend/app/api/skill_tuner.py` | exact (bounded-bg-run-over-buffer) |
| `backend/app/services/eval_runner_service.py` (NEW) | service | batch / event-driven | `backend/app/api/skill_tuner.py::_run_tuner_job` + `backend/app/services/skill_tuner_service.py` | role + flow match |
| `backend/app/models/eval_run.py` (NEW) | model | request-response | `backend/app/models/skill_test_case.py`, `skill_version.py` | exact |
| `supabase/migrations/080_eval_runs_and_results.sql` (NEW) | migration | CRUD | `supabase/migrations/079_skill_versions_and_test_cases.sql` + `035_runs_table.sql` | exact |
| `backend/app/services/agent_loop.py` (MODIFIED) | service (G-5 hot file) | event-driven | Phase 092 `RunContext.resume_dropped_tool_calls` additive field (same file, :186-194) | exact (in-file precedent) |
| `backend/app/main.py` (MODIFIED ~:423/:446) | config (router mount) | — | existing `skill_tuner.router` / `skill_test_cases.router` mounts | exact |
| `frontend/src/...` thin surface (NEW, `--skip-ui`) | component | streaming (reattach) | `frontend/src/lib/api.ts` `subscribeToRun`/`getActiveRuns` | role-match (client reuse) |
| `backend/tests/integration/test_eval_runner.py` + `tests/unit/test_agent_loop_catalog_override.py` (NEW) | test | — | `tests/integration/test_skill_tuner_routes.py`, `test_132_test_cases.py` | exact |

---

## Pattern Assignments

### `backend/app/api/evals.py` (router, event-driven/streaming)

**Analog:** `backend/app/api/skill_tuner.py` — the *exact* "bounded background run over the Redis run-buffer + additive SSE vocabulary + owner-scoped 404 gate" skeleton. Copy its shape and swap the inner unit of work (`forced_emit` → `run_agent_loop`).

**Imports pattern** (skill_tuner.py:40-62) — copy verbatim, adding `app.db.runs` and `run_agent_loop`:
```python
from __future__ import annotations
import asyncio, contextlib, json, logging, time as time_mod
from datetime import datetime, timezone
from uuid import UUID, uuid4
import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field
from sse_starlette import EventSourceResponse
from supabase import Client
from app.api.runs import replay_tail_consumer
from app.config import get_model_capability, get_per_call_timeout, settings
from app.dependencies import get_current_user, get_redis, get_supabase
router = APIRouter(prefix="/skills", tags=["skill-evals"])
```

**Owner-scoping gate** (skill_tuner.py:177-206) — copy `_fetch_owned_or_global_skill` verbatim (service-role `.or_(user_id.eq,is_global.eq.true)`, 404 not 403 on miss, wrapped in `run_in_threadpool`). This is the SOLE leak gate (V4). For the *create* path, prefer the stricter owned-only variant from skill_test_cases.py:49-63 if cases must be authored against an owned skill.

**Additive SSE vocabulary** (skill_tuner.py:78-90) — define eval-specific event types; NEVER reuse chat event types:
```python
EVENT_CASE_STARTED = "eval_case_started"
EVENT_CASE_DONE = "eval_case_done"
EVENT_COMPLETE = "eval_complete"
TERMINAL_DONE = "done"      # threads.TERMINAL_TYPES — closes the shared consumer
TERMINAL_ERROR = "error"
_EVAL_BUFFER_TTL_S = 600
```

**Emit helpers** (skill_tuner.py:210-240) — copy `_emit_tuner`/`_emit_terminal` shape exactly: canonical `{"data": json.dumps({"type": event_type, **fields})}` envelope, `maxlen=10000, approximate=True`, `EXPIRE` on terminal, best-effort try/except.

**In-flight CAS claim** (skill_tuner.py:92-135, 676-684) — copy the atomic Redis `SET NX` claim (`eval_inflight:{skill_id}`, value=`run_id`) + the `_RELEASE_IF_OWNED` Lua compare-and-delete. One eval run per skill under `WORKER_COUNT=2`; losing POST → 409.

**Cancel flag** (skill_tuner.py:138-146, 288-289) — `eval_cancel:{run_id}` checked at the top of each case/arm so `DELETE /runs/{run_id}` stops further paid completions.

**POST route + ZADD + spawn** (skill_tuner.py:650-772) — owner-verify, mint `run_id = uuid4()`, claim in-flight, `ZADD runs:active` + `runs_by_thread:tuner:{skill_id}`-analog, `asyncio.create_task(...)`, return `{run_id}` immediately (202). KEY DIVERGENCE for Pattern 3: also `insert_run(...)` a companion `public.runs` row keyed by the same `run_id` so `getActiveRuns`/`subscribeToRun`/`DELETE /runs/{id}` work unchanged.

**Stream route** (skill_tuner.py:775-814) — owner-verify, assert run↔skill membership via `redis.zscore(...)` (CR-01 — proves the caller-supplied `run_id` belongs to this skill, not an arbitrary leaked buffer), then `return EventSourceResponse(replay_tail_consumer(redis=redis, run_id=run_id, since=since, settings=settings), ping=None)`. NOTE: per RESEARCH §Pattern 3, prefer reusing `GET /runs/{run_id}/stream` verbatim via the companion runs row instead of a bespoke stream route.

---

### `backend/app/services/eval_runner_service.py` (service, batch/event-driven)

**Analog:** `backend/app/api/skill_tuner.py::_run_tuner_job` (skill_tuner.py:371-647) for the bounded-background-job control flow + `try/except → terminal error / finally → CAS-release + ZREM` lifecycle; `backend/app/services/skill_tuner_service.py:100-110` for provider-from-model resolution.

**Bounded job skeleton** (skill_tuner.py:371-647) — copy the `try: ... except Exception: _emit_terminal(TERMINAL_ERROR) finally: _release_inflight_if_owned + zrem` envelope. The inner loop replaces candidate×target scoring with: for each test case → run WITH arm → persist `eval_results` → emit `eval_case_done` → run WITHOUT arm → persist → emit. Sequential arms (RESEARCH Pattern 4).

**Drive `run_agent_loop` per arm (Pattern 2 — NO-OP emit, CRITICAL):**
```python
async def _noop(*a, **k): ...
ctx = RunContext(
    run_id=run_id, thread_id=eval_thread_id, current_user=current_user,
    user_settings=user_settings, body=eval_body, redis=redis, supabase=supabase,
    resolved_model=model, resolved_provider=provider,
    skill_catalog_override=(target_skill,),   # WITH arm; () for WITHOUT  ← NEW field
)
result = await run_agent_loop(ctx, emit=_noop, emit_terminal=_noop, spawn=_spawn)
output = result.full_content_final
in_tok, out_tok = result.input_tokens_total, result.output_tokens_total
```
The loop emits `'error'`/`'done'` (both in `TERMINAL_TYPES`) directly through `emit`; a real emit would terminate the shared eval stream on the FIRST completion. No-op emit eliminates this (RESEARCH Pattern 2, runs.py:188 break-on-terminal). Do NOT call `result.persist` or `_shielded_finalize` — `eval_results` is the durable record.

**RunContext construction reference:** mirror `threads.py:1490-1500` (the Deep branch build) — that is the canonical 9-field construction; add only `skill_catalog_override`.

**Provider resolution** (skill_tuner_service.py:104-110) — derive/validate provider from the POST-body `model` via `get_model_capability(model)`; reject unknown models (V5). Single provider per run (D-01).

**Blocking-I/O discipline** — wrap every `supabase-py` call (`eval_results` insert, `eval_runs` status update) in `run_in_threadpool` (D-v2.5-01; skill_tuner.py:183-197 precedent). Do NOT follow skill_test_cases.py's inline-sync convention here — this is a live-run path; match skill_tuner.

**Per-arm failure handling** (RESEARCH Pattern 2) — wrap each completion in try/except; on raise record `status='failed'`/`'timed_out'` + truncated (≤200 char, threads.py:1561 precedent) error on the `eval_results` row and continue — partials stay readable (D-06).

**Durable companion-row finalize** (db/runs.py:69-109) — call `finalize_run(pool, run_id=..., status=..., ...)` at the end so the companion `public.runs` row closes cleanly (reattach/cancel parity).

---

### `backend/app/services/agent_loop.py` (MODIFIED — G-5 hot file, additive default-off field)

**Analog: the in-file Phase 092 precedent at agent_loop.py:186-194** — the EXACT additive-default-off `RunContext` extension shape the executor must replicate. Reproduced verbatim:
```python
@dataclass(frozen=True)
class RunContext:
    run_id: UUID
    thread_id: str
    current_user: dict
    user_settings: Any
    body: Any
    redis: Any
    supabase: Any
    resolved_model: str
    resolved_provider: str
    # Phase 092 (092-03 / CONT-01) — ADDITIVE Continue-resume inputs. OFF by
    # default at EVERY existing call site → Deep Mode byte-identical (075.x
    # cascade rule). ...
    resume_dropped_tool_calls: bool = False
    dropped_tool_calls: tuple = ()
```

**The ONE new field to add** (immediately after `dropped_tool_calls`, same default-off discipline):
```python
    # Phase 133 (EVAL-02) — ADDITIVE skill-catalog override for the honest A/B.
    # OFF by default (None) at EVERY existing call site → Deep Mode byte-identical
    # (092 precedent). None = query DB (current behavior); () = inject NOTHING
    # (WITHOUT arm, D-04); (skill, ...) = inject EXACTLY these (WITH arm, D-03).
    # Frozen tuple keeps the dataclass hashable/immutable.
    skill_catalog_override: tuple[dict, ...] | None = None
```
Because it has a default, EVERY existing call site (threads.py:1490-1500 — the only Deep construction) stays byte-identical with zero changes (RESEARCH §Shared-Path Risk, verified threads.py builds RunContext without the field).

**The ONE read site to change** — the skill-injection block at agent_loop.py:1174-1195. Change ONLY the data source; the `## Available Skills` catalog_note build stays byte-identical:
```python
if body.agent_mode != "explorer":
    if ctx.skill_catalog_override is None:        # default — UNCHANGED DB query (:1176-1183)
        _skills_resp = await aexec(
            supabase.table("skills").select("name, description")
            .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
            .eq("is_enabled", True).order("name")
        )
        enabled_skills = _skills_resp.data or []
    else:                                          # eval arms drive this
        enabled_skills = list(ctx.skill_catalog_override)
    if enabled_skills:                             # :1185 — UNCHANGED below
        catalog_lines = "\n".join(f"- **{s['name']}**: {s['description']}" for s in enabled_skills)
        catalog_note = f"\n\n## Available Skills\n...{LOAD_SKILL_POLICY}\n{catalog_lines}"
        active_system_prompt = active_system_prompt + catalog_note
```
Note `ctx.skill_catalog_override` must be aliased near agent_loop.py:1093 (`_resolved_model = ctx.resolved_model` block) if the loop body reads via local name. The override dict needs only `name` + `description` keys (the only fields read at :1187).

**WHY not the read-only `explorer` lever (rejected, agent_loop.py:1153-1160):** `agent_mode == "explorer"` ALSO swaps `active_system_prompt`, `active_tools`, and `max_iterations` (8 vs 15) → three variables besides skills → dishonest A/B. The additive field is the only honest path.

**Planner obligations (RESEARCH):** flag `agent_loop.py` as a G-5 Deep-path touch in PLAN `files_modified`; add a regression test asserting `skill_catalog_override=None` produces the identical catalog query + system prompt (SC#4 Deep-Mode-byte-identical).

---

### `backend/app/models/eval_run.py` (model, request-response)

**Analog:** `backend/app/models/skill_test_case.py` + `skill_version.py` — plain `BaseModel`, FLAT single-typed fields (Gemini multi-type-array trap — never `type: [...]`), `from datetime import datetime` / `from uuid import UUID`, one Create body + one Response per table.

**Body model** (mirror skill_test_case.py:20-27 — `user_id`/`skill_id` NEVER in body, T-132-07):
```python
class StartEvalRunBody(BaseModel):
    provider: str
    model: str            # single provider/model per run — D-01
```

**Response models** (mirror skill_test_case.py:40-51 / skill_version.py:18-30 — full row shape, every column typed):
```python
class EvalRunResponse(BaseModel):
    id: UUID; skill_id: UUID; skill_version_id: UUID; user_id: UUID
    provider: str; model: str; status: str; case_count: int
    error: str | None; created_at: datetime; completed_at: datetime | None

class EvalResultResponse(BaseModel):
    id: UUID; eval_run_id: UUID; test_case_id: UUID; user_id: UUID
    variant: str; provider: str; model: str; output: str; status: str
    error: str | None; input_tokens: int | None; output_tokens: int | None
    created_at: datetime
```

---

### `supabase/migrations/080_eval_runs_and_results.sql` (migration, CRUD)

**Analog:** `supabase/migrations/079_skill_versions_and_test_cases.sql` (FK targets, owner-only RLS, `COMMENT ON TABLE`, index conventions, header block) + `035_runs_table.sql` (durable run-audit + status enum model). The concrete table shape is already drafted in RESEARCH.md:208-255 — use it verbatim.

**Conventions to copy from 079** (header lines 35-39 + RLS block 177-209):
- FK `ON DELETE CASCADE`; `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
- `eval_runs.skill_version_id → skill_versions.id` and `eval_results.test_case_id → skill_test_cases.id` (D-10 stable FK targets, 079:45/77).
- Indexes on every FK + `user_id` (079:61-62, 89-90).
- RLS owner-only SELECT (079:182-190): `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY ... FOR SELECT USING (auth.uid() = user_id)`. NO INSERT/UPDATE/DELETE policies — all writes go through the service-role background task (079:180-181 precedent). App-code `.eq("user_id")` is the real gate.
- `COMMENT ON TABLE` documenting the decision refs.
- `status` CHECK enum mirroring 035 runs (`running/completed/failed/cancelled/interrupted`).

**Apply discipline** (079:35-37, CLAUDE.md): apply via the Supabase SQL editor (NEVER `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (NO `--reset`), commit migration + regenerated `full-schema.sql` together. Next number is `080` (079 is latest applied). Migrations are NOT idempotent — apply once.

---

### `backend/app/main.py` (MODIFIED, router mount)

**Analog:** the existing `skill_tuner` / `skill_test_cases` mounts (main.py:423, 445-446).

**Import line** (main.py:423) — append `evals` to the `from app.api import (...)` tuple.

**Mount** (main.py:446) — after `app.include_router(skill_test_cases.router)`:
```python
app.include_router(evals.router)  # Phase 133 EVAL-02 — owner-scoped eval runner (bounded bg run over run-buffer + eval_* SSE + companion runs row)
```

---

### `frontend/src/...` thin functional surface (component, streaming — `--skip-ui`)

**Analog:** `frontend/src/lib/api.ts` `subscribeToRun(runId, since, callbacks, signal)` (:503-522) and `getActiveRuns(threadId, signal)` (:848-859) — reused VERBATIM because the eval run writes a companion `public.runs` row (Pattern 3), so the existing chat-run reattach client works with ZERO new stream code.

**Reattach flow** (RESEARCH Pattern 3): on load, `getActiveRuns(evalThreadId)` → if the eval run is streaming, `subscribeToRun(run_id, "0", callbacks)` replays buffered `eval_*` events then live-tails. The durable readout always comes from `GET /skills/{skill_id}/evals/runs/{run_id}` (DB) so it renders after the buffer TTL expires.

**Scope:** thin only (run button + live case-by-case list + plain results readout). No designed panel, no UI-SPEC — Phase 137 (PANEL-01, G-2) owns the real surface; the thin surface must not constrain it (D-07). Add eval-specific client functions (`startEvalRun`, `getEvalRun`) mirroring the existing `api.ts` fetch+`getAuthHeaders()` shape (api.ts:509/852).

---

### `backend/tests/integration/test_eval_runner.py` + `backend/tests/unit/test_agent_loop_catalog_override.py` (tests)

**Analogs:** `tests/integration/test_skill_tuner_routes.py` (the bounded-bg-run route test template) and `tests/integration/test_132_test_cases.py` (owner-scope CRUD template).

**Test harness pattern** (test_skill_tuner_routes.py:19-70):
- `httpx.ASGITransport` against `app.main.app`; `app.dependency_overrides[get_current_user/get_redis/get_supabase]`.
- `OWNER` / `OTHER_USER` fixed-UUID dicts (test_132_test_cases.py:35-36) for the cross-user-404 assertion.
- `_FakeRedis` in-memory async fake (test_skill_tuner_routes.py:41-75) honoring `xadd/zadd/zrem/zscore/set(nx=)/get/expire` — copy it; it already honors the `SET NX` 409 semantic the in-flight claim needs.
- `_build_mock_supabase` from `tests.integration._run_helpers` for the owner-scoped table reads.
- Mock the inner `run_agent_loop` (return a fake `AgentLoopResult` with `full_content_final`/token totals) so unit tests don't hit a real LLM — mirror how tuner tests mock `skill_tuner_service` candidate/classify functions (test_skill_tuner_routes.py:17, 23).

**Required coverage** (RESEARCH §Test Map): two `eval_results` rows per case (with/without); `eval_*` SSE vocabulary in order with no chat terminal mid-run; results persist after buffer expiry; reattach via companion runs row; cross-user 404; AND in the unit file — `skill_catalog_override=None` → identical catalog query/prompt (Deep-Mode-byte-identical, SC#4) + `()` injects nothing + `(skill,)` injects only that skill.

---

## Shared Patterns

### Owner-scoping (the SOLE runtime leak gate — V4)
**Source:** `backend/app/api/skill_tuner.py:177-206` (`_fetch_owned_or_global_skill`) and `skill_test_cases.py:49-63` (`_verify_owned_skill`, owned-only).
**Apply to:** every route in `evals.py` + every read/write in `eval_runner_service.py`.
`get_supabase()` is SERVICE-ROLE (bypasses RLS) → app-code `.eq("user_id", …)` / `.or_(own,global)` is the only gate. 404 (never 403) on a miss. `user_id` from `current_user`, never the body. Wrap reads in `run_in_threadpool`.

### Run-buffer SSE transport (additive vocabulary on the shared consumer)
**Source:** `backend/app/api/skill_tuner.py:210-240` (`_emit_tuner`/`_emit_terminal`) → `run:{run_id}` Redis stream; consumed by `runs.py::replay_tail_consumer`.
**Apply to:** `eval_runner_service.py` progress emits.
Canonical `{"data": json.dumps({"type", **fields})}` envelope, `maxlen=10000`, EXPIRE on terminal, best-effort try/except. Eval `eval_*` types are non-terminal; close with one `done`/`error` sentinel. NEVER reuse chat event types.

### Durable companion `public.runs` row → reattach + cancel for free (Pattern 3)
**Source:** `backend/app/db/runs.py:26-109` (`insert_run`/`finalize_run`); consumed by `getActiveRuns`/`subscribeToRun`/`DELETE /runs/{id}`.
**Apply to:** `evals.py` POST (insert) + `eval_runner_service.py` finalize. One `run_id` = `eval_runs.id` = `runs.run_id` = `run:{run_id}` buffer key (1:1 by construction). Gives reattach/cancel/zombie-heal with zero new frontend stream code.

### Additive default-off RunContext extension (Deep-byte-identical)
**Source:** `backend/app/services/agent_loop.py:186-194` (Phase 092 `resume_dropped_tool_calls`/`dropped_tool_calls`).
**Apply to:** the single new `skill_catalog_override` field. Default-off so every existing call site is untouched; the same single code path reads it (NOT a fork — D-14 forbids forking the provider path, not additive inputs the shared path reads).

### Blocking-I/O discipline
**Source:** `backend/app/api/skill_tuner.py:183-197` (`run_in_threadpool` around supabase-py).
**Apply to:** every supabase-py call in `evals.py` + `eval_runner_service.py` (D-v2.5-01 / SEED-097). Do NOT copy skill_test_cases.py's accepted inline-sync tech-debt — this is a live-run path.

### Error-string truncation (no leakage)
**Source:** `threads.py:1561` precedent (≤200 chars) cited in RESEARCH §Security.
**Apply to:** `eval_results.error` + companion `runs.error` writes — truncate; never raw tracebacks/key fragments.

---

## No Analog Found

None. Every file has a strong in-codebase analog — this phase is structurally "`skill_tuner.py` with `run_agent_loop` as the inner unit of work," and the persistence/model/test/mount patterns all have exact 079/132/123 precedents.

---

## Metadata

**Analog search scope:** `backend/app/api/`, `backend/app/services/`, `backend/app/models/`, `backend/app/db/`, `supabase/migrations/`, `backend/tests/`, `frontend/src/lib/`.
**Files scanned/read:** skill_tuner.py, skill_test_cases.py, skill_tuner_service.py, agent_loop.py (RunContext + injection block + run_agent_loop signature), models/skill_test_case.py, models/skill_version.py, db/runs.py, threads.py (RunContext build), main.py (mounts), migrations/079, frontend/src/lib/api.ts, tests/integration/{test_skill_tuner_routes,test_132_test_cases}.py.
**Pattern extraction date:** 2026-06-30

## PATTERN MAPPING COMPLETE

**Phase:** 133 - Eval Runner — With-Skill vs Without-Skill
**Files classified:** 8 (6 new, 2 modified)
**Analogs found:** 8 / 8

### Coverage
- Files with exact analog: 7
- Files with role-match analog: 1 (thin frontend surface — client reuse)
- Files with no analog: 0

### Key Patterns Identified
- The eval runner is `skill_tuner.py`'s bounded-background-run-over-the-run-buffer skeleton with `run_agent_loop` (NO-OP emit) swapped in for `forced_emit` — copy router shape, CAS in-flight claim, emit/terminal helpers, owner-404 gate verbatim.
- The honest A/B requires ONE additive default-off `RunContext.skill_catalog_override` field — byte-identical to the Phase 092 `resume_dropped_tool_calls` in-file precedent (agent_loop.py:186-194); change only the data source inside the injection block (:1174-1195), every existing call site untouched.
- Reattach/cancel come free by writing a companion `public.runs` row (one `run_id` = `eval_runs.id` = buffer key) so `getActiveRuns`/`subscribeToRun`/`DELETE /runs/{id}` work with zero new frontend stream code.
- Migration 080 mirrors 079/035 exactly (owner-only RLS SELECT, service-role writes, FK CASCADE to `skill_versions.id`/`skill_test_cases.id`, app-code `.eq(user_id)` as the real gate).

### File Created
`.planning/phases/133-eval-runner-with-skill-vs-without-skill/133-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can reference analog file:line excerpts directly in PLAN.md action sections — note the G-5 `agent_loop.py` touch requires the Deep-Mode-byte-identical regression guard (SC#4) and the SC#10 4-axis UAT.
