---
phase: 066-adaptive-run-timeouts-lifecycle-states
generated: 2026-05-06T19:40:00Z
depth: standard
file_count: 9
files_reviewed_list:
  - backend/app/api/threads.py
  - backend/app/api/runs.py
  - backend/app/config.py
  - backend/app/models/message.py
  - supabase/migrations/038_runs_timed_out_status.sql
  - frontend/src/types/index.ts
  - frontend/src/lib/api.ts
  - frontend/src/hooks/useMessages.ts
  - frontend/src/components/chat/MessageItem.tsx
findings:
  blocker: 1
  warning: 4
  info: 5
  total: 10
status: issues_found
---

# Phase 066: Code Review Report

**Reviewed:** 2026-05-06T19:40:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 066 is a substantive lifecycle-architecture change: it deletes the
120s total-deadline `asyncio.timeout` wrapper, introduces a per-LLM-call timer
keyed on `MODEL_CAPABILITIES.llm_call_timeout_seconds`, splits the overloaded
`cancelled` terminal state into `cancelled` (user-Stop) vs `timed_out` (system
deadline), and threads the new state through Pydantic, the SSE wire format,
and the frontend banner / Resume gating. The Plan 04 production fix
(`except (asyncio.TimeoutError, asyncio.CancelledError): raise` ahead of the
broad APIError / Exception inner handlers) is sound — it correctly closes the
swallow-bug Plan 02 left behind, and the test suite proves the partition guard
holds for the producer side.

The work is mostly correct and well-commented. However, **the `runs.py`
cancel-handler partition guard is incomplete**: the
`row["status"] in ("completed","failed","cancelled")` short-circuit at the
DELETE path was not extended to admit the new 5th terminal value, and a late
DELETE arriving on an already-`timed_out` row therefore overwrites the run as
`cancelled` via the zombie-heal path — directly violating the D-066-05
contract that the executor's tests explicitly bound for the inverse
direction. Plan 04 only asserts "DELETE writes cancelled, not timed_out";
it does not assert "DELETE on timed_out is a no-op."

Other concerns are quality / hardening: sync-iteration of the LLM SDK stream
inside `async with asyncio.timeout(...)` cannot preempt a network read that
blocks without yielding (pre-existing architectural issue inherited by 066,
but 066's design *assumes* the timer fires reliably); the 38-migration is not
idempotent; defaults for `_last_iteration` / `_last_model_id` /
`_last_per_call_budget` could theoretically produce a misleading error string
on edge paths.

## Blocker Issues

### BL-01: `cancel_run` short-circuit excludes `timed_out` — late DELETE corrupts terminal state (D-066-05 partition violation)

**File:** `backend/app/api/runs.py:388`
**Issue:** The DELETE handler's already-terminal short-circuit reads
`if row["status"] in ("completed", "failed", "cancelled"):` and returns 204
silently. After Phase 066 the runs.status enum admits a 5th value
(`timed_out`); the tuple was not updated. Concrete failure mode:

1. Producer's per-LLM-call timer fires → outer classifier sets
   `_terminal_status = "timed_out"` → `_shielded_finalize` writes
   `runs.status = 'timed_out'`, `runs.error = 'timed_out: ...'`,
   `RUN_TASKS.pop(run_id)`.
2. Network delay or rapid user click — frontend has not yet rendered the
   `timed_out` SSE sentinel and the user hits Stop.
3. `DELETE /runs/{run_id}` arrives. Step 1 ownership SELECT returns the row
   with `status = 'timed_out'`.
4. Step 2 check at line 388 evaluates **False** because `'timed_out'` is
   missing from the tuple.
5. Step 3a `RUN_TASKS.get(run_id)` returns `None` (producer already exited).
6. Step 3b zombie-heal path runs: `UPDATE runs SET status='cancelled',
   error='cancelled_by_user', completed_at=now()` — silently overwrites the
   `timed_out` classification with `cancelled`.

This directly violates D-066-05's strict partition: "timer fire = system =
`timed_out`; DELETE verb = user = `cancelled`. **The two terminal states are
partitioned strictly by source.**" Audit / billing / observability all lose
fidelity (the system-failure mode now masquerades as user intent), and the
frontend that received the `timed_out` SSE sentinel will see the run revert
to `cancelled` on the next `loadMessages` / reconcile.

Plan 04's `test_delete_writes_cancelled_not_timed_out` asserts only one
direction of the partition (timer-fired runs that have not yet reached
terminal state are not relabeled). The test does NOT cover the
already-terminal-`timed_out` race exercised here; the executor's
T-066-01 partition guard is therefore one-way.

**Fix:**
```python
# ── Step 2: already-terminal → 204 silent (D-062-09 idempotent) ──
# Phase 066 D-066-04: include 'timed_out' so a late DELETE arriving after the
# producer's per-call timer has already finalized cannot overwrite the
# system-classified terminal state with user-Stop semantics. D-066-05 strict
# partition: timer fire = 'timed_out' (system); DELETE = 'cancelled' (user).
# Re-classification by a late DELETE breaks the partition.
if row["status"] in ("completed", "failed", "cancelled", "timed_out"):
    return Response(status_code=status.HTTP_204_NO_CONTENT)
```

Also extend Plan 04's partition test
(`test_066_terminal_classification.py::test_delete_writes_cancelled_not_timed_out`)
or add a sibling test
(`test_delete_on_timed_out_is_noop`) that seeds `runs.status='timed_out'` and
asserts a subsequent DELETE returns 204 without mutating
`runs.status` / `runs.error`.

## Warnings

### WR-01: Sync iteration of LLM SDK stream cannot be preempted by `asyncio.timeout` mid-network-read

**File:** `backend/app/api/threads.py:1213-1239` (Anthropic), `1297-1326` (OpenAI/OpenRouter/Google)
**Issue:** Both per-LLM-call timer wraps are
`async with asyncio.timeout(per_call_budget): for _ant_event in _ant_gen:`
(line 1214) and `async with asyncio.timeout(per_call_budget): for chunk in
stream:` (line 1298). These are **sync** for-loops over **sync** generators
that perform blocking httpx reads inside `next(...)`. `asyncio.timeout` can
only fire when control returns to the event loop via an `await`; while
`next(_ant_gen)` is blocked on a network read no awaits happen, so the
deadline cannot be enforced until the next chunk arrives.

In the happy path this does not matter — when the SDK is producing chunks,
each iteration runs `await _emit(redis, run_id, 'delta', ...)` which yields
to the event loop. The pathology surfaces on a *stalling* upstream (the
exact failure mode 066 is supposed to bound): if the LLM endpoint accepts
the request, opens the SSE response, then hangs without sending bytes,
the `for chunk in stream:` iterator blocks inside httpx's read for as long
as the OS-level socket timeout (typically 5 minutes for httpx default), not
the configured `per_call_budget`.

This is a **pre-existing** architectural issue (the same blocking iteration
existed before 066 inside the old 120s outer wrapper), but D-066-11 / D-066-02
explicitly *promise* clean termination at the per-call deadline, and the
mitigation (`stream.close()` / `_ant_gen.close()` before re-raise) only runs
after the timeout actually fires. RESEARCH.md and Pitfall 6 in 066-RESEARCH
do call out the "sync iteration in event loop" concern — but the implemented
mitigation is the close-then-raise, not a switch to async iteration.

**Fix:** Two acceptable resolutions:

1. **(Preferred long-term)** Move the SDK stream iteration into a thread via
   `run_in_threadpool` or a dedicated executor, communicating chunks back via
   an `asyncio.Queue`. The producer coroutine awaits the queue with the
   per-call timeout; the worker thread can be cancelled via `stream.close()`
   when the queue read times out. This makes the deadline reliable.
2. **(Cheap stopgap)** Pass an explicit lower-level `timeout` to the SDK
   client (`anthropic.Anthropic(api_key=..., timeout=httpx.Timeout(...))`,
   `OpenAI(api_key=..., timeout=...)`) so the underlying httpx read raises
   when the model stalls. Set the socket read timeout near the
   `per_call_budget` value so the SDK itself errors before the asyncio.timeout
   would have fired. This converts the failure into an `APIError`, which the
   existing handler catches — but it then classifies as `failed`, not
   `timed_out`. Would need a follow-up to translate stall-error → TimeoutError
   in the wrap.

For now, document the pre-existing limitation in 066-DEBRIEF or a new
deferred-item card so it is not silently lost.

### WR-02: Migration 038 is not idempotent — re-running raises "constraint does not exist"

**File:** `supabase/migrations/038_runs_timed_out_status.sql:23-26`
**Issue:** The single `ALTER TABLE ... DROP CONSTRAINT runs_status_check, ADD
CONSTRAINT runs_status_check CHECK (...)` statement is atomic on a fresh
apply, but a second invocation (operator runs the migration twice by mistake,
or a CI reset re-applies) errors at the DROP — the constraint was already
dropped on the first run.

The Supabase CLI tracks applied migrations via the
`schema_migrations` table, so under the supported workflow this never
re-runs. But the project's documented apply path is **manual** ("paste into
the Supabase SQL editor" — CLAUDE.md), which has no such guard. A copy-paste
mistake silently fails and the operator may not realize the migration ran
once before.

**Fix:**
```sql
ALTER TABLE public.runs
    DROP CONSTRAINT IF EXISTS runs_status_check,
    ADD  CONSTRAINT runs_status_check
        CHECK (status IN ('streaming','completed','failed','cancelled','timed_out'));
```

`DROP CONSTRAINT IF EXISTS` makes the migration safe to re-run. The ADD will
fail on a second run because the constraint name already exists — but that
fails *loudly* and locally, which is the desired behavior (the migration is
already applied; nothing to do).

### WR-03: `_last_iteration` / `_last_model_id` / `_last_per_call_budget` defaults can produce a misleading `runs.error` string

**File:** `backend/app/api/threads.py:865-867`, `2275-2280`
**Issue:** The closure-scoped sentinels are initialized to
`_last_iteration = 0`, `_last_model_id = ""`, `_last_per_call_budget = 0`.
The intent (per the comment block at 858-867) is to avoid `UnboundLocalError`
if a `TimeoutError` somehow fires before the iteration loop captures real
values. In the implemented happy paths, the values are always set before any
`async with asyncio.timeout(per_call_budget):` block — so the defaults are
only reached if a TimeoutError originates from somewhere *outside* the
intended per-call wraps and bubbles to the outer classifier.

The error string in that pathological case becomes:
`"timed_out: 0s per-call deadline exceeded at iteration 0 (model=)"`

That looks like a real timeout at iteration 0 with a 0-second budget against
an unknown model — actively misleading for an operator triaging
`runs.error`. The defaults should either be unmistakably-sentinel
(`-1`, `"<unknown>"`) or the outer classifier should branch on
"`_last_model_id == ""` → emit a generic `timed_out: deadline fired before
agent loop entered` message".

**Fix:**
```python
# Phase 066 D-066-07: capture per-iteration context for the timed_out
# error string. ...
_last_iteration: int = -1
_last_model_id: str = "<not_yet_resolved>"
_last_per_call_budget: int = -1
```
And in the outer classifier:
```python
except asyncio.TimeoutError:
    if _last_iteration < 0:
        _terminal_error = (
            "timed_out: deadline fired before agent loop entered "
            "(check for asyncio.timeout outside the per-call SDK block)"
        )
    else:
        _terminal_error = (
            f"timed_out: {_last_per_call_budget}s per-call deadline "
            f"exceeded at iteration {_last_iteration} "
            f"(model={_last_model_id})"
        )
    _terminal_status = "timed_out"
```

### WR-04: `runs.py` docstring + cancel_run code comments still reference the old 4-value enum

**File:** `backend/app/api/runs.py:336-339, 388`
**Issue:** Lines 336-339 say:
```
#   - terminal:   runs.status in {completed, failed, cancelled} →
#                 204 silent (D-062-09 idempotent)
```
And the code at line 388 enumerates only 4 values. This is partly the same
defect as BL-01 (the missing `timed_out` admit), but the comment block also
needs a Phase 066 update to keep the documentation honest about the 5-value
enum. Without it, future readers debugging the partition will read the
docstring and conclude that 4 values is correct.

**Fix:** When BL-01 is fixed, also update the docstring's terminal-list to
4 values: `{completed, failed, cancelled, timed_out}` and add a Phase 066
note.

## Info

### IN-01: `from app.config import get_per_call_timeout` is repeated as a local import in two places

**File:** `backend/app/api/threads.py:1179, 1289`
**Issue:** Both provider paths execute `from app.config import
get_per_call_timeout` inside the agent loop body — once per iteration. The
import is cached after first execution (`sys.modules`), so this is not a
performance hit, but it is unidiomatic.

**Fix:** Per the Plan 04 SUMMARY this is intentional — the local import is
the patch site for `monkeypatch.setattr(app.config, 'get_per_call_timeout',
...)` in tests. Module-level imports would resolve the symbol at module-load
time and miss the patch. **No code change required**, but consider
documenting the test-driven rationale in a comment beside ONE of the two
imports (currently the comment "local import — same module imported in
Anthropic path above" at 1289 hints at the testability rationale but does
not state it explicitly).

### IN-02: `DEFAULT_LLM_CALL_TIMEOUT_SECONDS = 180` is buried below settings parsing — operator won't find it via env-var search

**File:** `backend/app/config.py:143`
**Issue:** Operators looking for "where is the per-call timeout default
configured" will likely grep for `LLM_CALL_TIMEOUT` in the codebase. The
constant is at module scope but well below the registry it modifies, and
adjacent constants (`_LLM_CALL_TIMEOUT_MIN_S`, `_LLM_CALL_TIMEOUT_MAX_S`)
are private (leading underscore) while the actual default is public.

**Fix:** Consider moving `DEFAULT_LLM_CALL_TIMEOUT_SECONDS` into the
`Settings` class as `default_llm_call_timeout_seconds: int = 180`, which:

1. Makes it overridable via env var (`DEFAULT_LLM_CALL_TIMEOUT_SECONDS=240`)
   for operators who want a global default-bump without enumerating
   `LLM_CALL_TIMEOUT_OVERRIDES` per model.
2. Surfaces the value in any future `/settings` admin UI consistently with
   the rest of the config surface.

This is a minor polish; current code is correct.

### IN-03: `_parse_llm_call_timeout_overrides` parses on every call — micro-inefficiency (out of v1 scope but worth noting)

**File:** `backend/app/config.py:170-175`
**Issue:** `get_per_call_timeout` is called once per iteration of the agent
loop, and each call invokes `_parse_llm_call_timeout_overrides` which
re-parses the env-var string. For a 15-iteration agent run, the
comma-separated string is parsed 15 times per request. The result is
deterministic per Settings instance, so a `functools.lru_cache` on the parser
or a one-shot cache on the Settings instance would eliminate the redundancy.

Per the v1-scope note in this review's mandate, performance is out of scope.
Recording for visibility only.

**Fix (optional):**
```python
@functools.lru_cache(maxsize=4)
def _parse_llm_call_timeout_overrides(raw: str) -> dict[str, int]:
    ...
```

### IN-04: MessageItem.tsx renders TWO indicators on a `timed_out` run with non-empty content

**File:** `frontend/src/components/chat/MessageItem.tsx:104-115, 159-166`
**Issue:** When `runStatus === 'timed_out'` and `message.content` is non-empty
(typical case — the agent produced some text before the timer fired), the
component renders:

1. The Resume button at line 104 (`runStatus === 'failed' || runStatus ===
   'timed_out'`).
2. The "Stopped indicator" banner at line 159
   (`message.stopped || message.runStatus === 'timed_out'`) showing
   "Agent reached time limit".

Neither contradicts the other, but the in-content placeholder banner switch
at lines 130-141 (which renders "Agent reached time limit" when there is no
content) is suppressed in the with-content path because the
`message.content ? ... : ...` ternary at line 78 short-circuits to the
content branch. So the user sees: content + ConfidenceBadge + CitationList
+ "Resume" button + "Agent reached time limit" indicator, in that order.

That's actually the desired UX (banner under the content, Resume CTA visible).
But the comment at 151-158 says "in-content banner suppressed because content
present; bottom indicator says 'Response stopped' — without this dual update
contradictory copy". That comment frames the dual rendering as a fix for
contradictory copy, which it is — but the implementation also unintentionally
renders the stopped indicator on `runStatus === 'completed'` if the legacy
`message.stopped` boolean was ever set on a row that subsequently completed.

The legacy `stopped` flag from pre-D-063.1-15 rows defaults to undefined and
should never be `true` on a completed row, so this is a low-impact code-smell
(potential future regression vector if the stopped flag's lifecycle changes).

**Fix (defensive):** Make the stopped-indicator check explicitly exclude
`completed`:
```jsx
{((message.runStatus === "timed_out") ||
  (message.runStatus === "cancelled") ||
  (message.stopped && message.runStatus !== "completed")) && !isStreaming && (
  <div className="...">
    <Square className="w-3 h-3" />
    <span className="italic">
      {message.runStatus === "timed_out"
        ? "Agent reached time limit"
        : "Response stopped"}
    </span>
  </div>
)}
```

### IN-05: useMessages.ts sendMessage path sets `stopped: true` on `timed_out`; reconcile path does NOT — divergent UI behavior

**File:** `frontend/src/hooks/useMessages.ts:573` (sendMessage), `812` (reconcile)
**Issue:** sendMessage's `onTerminal` override (line 573) sets
`{ ...m, runStatus: "timed_out", stopped: true }`, while reconcile's
`onTerminal` override (line 812) sets `{ ...m, runStatus: "timed_out" }`
(no `stopped`). The comments explain the divergence — reconcile may attach
mid-stream and `stopped: true` would mis-render — but `onTerminal` only
fires AFTER the terminal sentinel, so the run is by definition no longer
mid-stream when this branch executes. The reconcile-path comment's reasoning
appears slightly off.

In MessageItem.tsx the banner switch at line 159 handles
`message.runStatus === 'timed_out'` directly without keying on `stopped`, so
the user-visible behavior is identical for the two paths today. But the
divergence is asymmetric and could trip up future code that DOES key on
`stopped` (e.g. a "show retry button only if stopped" rule).

**Fix:** Make both paths set `stopped: true` for `timed_out` (and
symmetrically for `cancelled`), or delete the `stopped: true` writes
from sendMessage so both paths are no-ops on the stopped flag and
MessageItem keys solely on `runStatus`. Either direction restores
symmetry.

---

_Reviewed: 2026-05-06T19:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
