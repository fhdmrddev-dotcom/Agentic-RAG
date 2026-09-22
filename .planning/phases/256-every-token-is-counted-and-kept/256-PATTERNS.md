# Phase 256: Every Token Is Counted And Kept — Pattern Map

**Mapped:** 2026-09-18
**Measured at:** `git rev-parse --short HEAD` → **`edf2d1024`**
⚠ **NOT `772f53354`** (CONTEXT.md's stated base, stale by 6) and **NOT `e78cf5e63`** (RESEARCH.md's
base, stale by 1 — `edf2d1024` is the commit that ADDED `256-RESEARCH.md`, a docs-only commit).
**Every line number below was re-derived at `edf2d1024`, not copied from RESEARCH.md.** Result:
**every backend line number RESEARCH.md quotes is still exact** — verified individually, listed per
section. ⛔ Re-derive again before quoting; this project's own repeated finding is that a figure goes
stale on the next commit.

**Files analyzed:** 12 (3 created · 9 modified, counting the migration and the three test files)
**Analogs found:** 9 exact / 1 partial / **3 NO IN-REPO ANALOG**

---

## File Classification

| New/Modified file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `supabase/migrations/182_*.sql` | migration (additive ALTER) | DDL, one-shot | `supabase/migrations/175_documents_thread_key.sql` | **exact** |
| `backend/app/db/workflows.py` → new `persist_run_usage` | DB writer (one-home) | request-response, single UPDATE | `backend/app/db/workflows.py:2023-2035` (`advance_current_phase`) | **exact** |
| `backend/app/services/harness_engine.py` (`_enforce_budget` reorder + the call) | service / engine loop | event-driven (per-phase boundary) | same function, `:1873-1876` — the change is a REORDER of shipped lines | **exact (in-place)** |
| `backend/app/services/circuit_breaker.py` (widen `absorb_usage_box` return) | service / in-memory accumulator | transform | same method, `:150-164` | **exact (in-place)** |
| `backend/app/services/forced_emit.py` `_drain` (+2 arms) | service / stream drain | streaming | `backend/app/services/task_service.py:414-430` | **exact** |
| `backend/app/services/forced_emit.py` ladder accumulator | service / retry loop | batch (n rungs) | `backend/app/services/forced_emit.py:433-434` — **in the same file** | **exact** |
| `backend/app/services/harness/phase_types.py` `_exec_llm_emit` (+1 line) | executor | event-driven | `phase_types.py:917` (and `:1028`) | **exact** |
| `backend/app/api/runs.py:677` · `:1331` · `harness_engine.py:3051` · `publish_service.py:1671` · `scheduler_service.py:296` | producer shells (finally-block finalize) | request-response terminal write | `backend/app/services/run_producer.py:230-247` | **exact** |
| `backend/app/services/eval_runner_service.py` (widen return tuple) | service / job runner | batch | `phase_types.py:768` `_record_run_usage` (box idiom) · `eval_runner_service.py:433-434`-style local accumulator | **partial — DIFFERENT SHAPE, see §7** |
| new test: `parent_run_id IS NULL` AST fence | test (source fence) | transform over source | `backend/tests/unit/test_255_extension_contract_guard.py:122-144` ⚠ **not** `test_189_no_egress.py` — see §8 | **role-match** |
| new test: `None`-vs-`0` drain cases | test (unit) | streaming | `backend/tests/unit/test_token_accumulator_missing_usage.py:44-93` | **role-match (⚠ reimplements, does not drive)** |
| new test: persistence round-trip across a restart | test (durability) | file/DB I/O | ⛔ **NO IN-REPO ANALOG** — see §10 | **none** |

---

## 1. `supabase/migrations/182_*.sql` (migration, additive ALTER)

**Analog:** `supabase/migrations/175_documents_thread_key.sql` — **the whole file, 34 lines.** It is a
structural one-for-one match for 182: numbered header naming phase + decision ids, a WHY-NULLABLE
rationale using the exact same NULL-≠-sentinel argument, the no-backfill rule, the SQL-editor paste
note, `ADD COLUMN IF NOT EXISTS`, a multi-line `COMMENT ON COLUMN`, and a **partial index** — and
**no grant tail**.

**Quoted verbatim, `supabase/migrations/175_documents_thread_key.sql:1-34`:**

```sql
-- Migration 175 — Phase 240 (SRC-05 / D-3 / D-240-06)
-- documents.thread_key: the retrieval-grouping column for mail conversations.
--
-- WHY IT IS NULLABLE, AND WHY THAT IS NOT LAZINESS.
--   Most documents are not mail, and a mail message whose client wrote no Message-ID has no
--   usable key either. Those are DIFFERENT FACTS and a rule must not be able to match the
--   difference away. A sentinel ('' or 'unknown') would fuse them — the exact mistake
--   metadata.source.path already paid for at D-238-07.4 ...
--
-- WHY THERE IS NO BACKFILL HERE.
--   A schema change must not do data work. Mail already in the Library keeps thread_key NULL and
--   reads as a thread of one; an opt-in re-derive is a separate, revertible task.
--
-- NOTE: no COMMIT inside a PROCEDURE/DO block — migrations 105 and 107 could not be pasted into
-- the Supabase SQL editor for exactly that reason.

ALTER TABLE public.documents
    ADD COLUMN IF NOT EXISTS thread_key text;

COMMENT ON COLUMN public.documents.thread_key IS
    'Phase 240 (D-3): the conversation a mail document belongs to, derived from its own RFC 5322 '
    'headers (References[0] -> In-Reply-To -> Message-ID), normalised and capped at 512 chars. '
    'NULL means "not mail" or "mail with no usable headers" — deliberately not distinguished by a '
    'sentinel. Never derived from Subject.';

CREATE INDEX IF NOT EXISTS documents_thread_key_idx
    ON public.documents (user_id, thread_key)
    WHERE thread_key IS NOT NULL;
```

**Conventions it must not break:**
- **`ADD COLUMN IF NOT EXISTS`, re-paste-safe.** Confirmed as the house idiom: **15 migrations** use
  it (`grep -rln "ADD COLUMN IF NOT EXISTS" supabase/migrations/` → 128, 129, 140, 150, 152, 154,
  155, 166, 170, 173, 174, 175, 176, 179, 180).
- **`COMMENT ON COLUMN` is written as adjacent single-quoted string literals**, one per line, with a
  trailing space inside each — not one long line. Note **`''`-doubling** for an apostrophe inside the
  comment (RESEARCH.md's proposed 182 text uses `run''s` / `can''t`-style doubling and is correct).
- **The no-backfill sentence is part of the pattern**, not decoration. 182 writes no data.
- **Partial index precedent confirmed, twice more:** `supabase/migrations/055_todos_table.sql:42`
  `CREATE INDEX idx_runs_parent ON public.runs(parent_run_id) WHERE parent_run_id IS NOT NULL;` and
  `059_harness_audit_and_threads_col.sql:34`. Both predicates are a bare `IS NOT NULL`.

**⚠ THE GRANT QUESTION — CONFIRMED BY LOOKING, and 175 is the reason the answer holds:**
- `grep -rn "GRANT.*workflow_runs\|workflow_runs.*GRANT" supabase/full-schema.sql supabase/migrations/*.sql` → **0 hits.**
- `grep -c "workflow_runs" scripts/full-schema-supplement.sql` → **0.**
- **The analog carries NO grant tail either** — 175 ends at its index. So 182 differs from nothing:
  both tables rely on Supabase's blanket table grants plus RLS, and table-level privileges are
  inherited by a new column.
- The supplement's own maintenance header (`scripts/full-schema-supplement.sql:20-40`) lists exactly
  four mirrorable classes — **storage buckets, an `auth.users` trigger, realtime memberships, ACLs** —
  and re-derives the ACL set as *"32 statements across TWELVE files, on SEVEN tables: 118 · 126 · 127
  · 128 · 129 · 150 · 151 · 156 · 168 · 169 · 172 · 177"*. **182 adds none of the four.** ⛔ If 182
  ever gains a `GRANT`, it joins that list in the same commit.

---

## 2. `persist_run_usage` in `backend/app/db/workflows.py` (DB writer, one-home)

### 2a. The house style for a single-statement `workflow_runs` writer

**Analog:** `backend/app/db/workflows.py:2023-2035` (`advance_current_phase`) — the closest shape in
the file: module-level `async def`, `pool: asyncpg.Pool` first positional, `run_id: UUID`, a short
docstring whose **last line names the table and the key**, and a bare `await pool.execute(...)` with
no transaction because there is one statement.

```python
# backend/app/db/workflows.py:2023-2035
async def advance_current_phase(
    pool: asyncpg.Pool, run_id: UUID, next_phase_id: UUID | None
) -> None:
    """Point ``workflow_runs.current_phase_id`` at the next phase (or NULL on last).

    workflow_runs table, keyed by its own ``id``.
    """
    await pool.execute(
        "UPDATE workflow_runs SET current_phase_id = $2 WHERE id = $1",
        run_id,
        next_phase_id,
    )
```

**Conventions it must not break:**
- **`await pool.execute(` is the single-statement idiom; `async with pool.acquire()` is the
  multi-statement/transaction idiom.** Measured in this file: `pool.execute(` **11**,
  `async with pool.acquire()` **5**. `persist_run_usage` writes one statement → use `pool.execute`.
- **Positional `$1/$2/$3` parameters only. No f-string SQL.** (`claim_run`'s docstring names the
  rule; T-091-03.)
- **The docstring's closing line names the table and the key** — every writer in this file does it.
- **Keyword-only for the value args** is the convention when a function takes more than one value —
  see `db/runs.py:82-91` below, which is `pool` positional then `*,` then every field.

### 2b. `finish_run` — the house style for a writer's CONTRACT docstring, ⛔ NOT to be edited

**D-256-05 requires `finish_run` byte-unchanged (7 call sites, 3 with no usage box).** It is quoted
here only to show the executor what a load-bearing writer docstring looks like in this file.

**Verified: `backend/app/db/workflows.py:2169` is `async def finish_run(pool: asyncpg.Pool, run_id: UUID, status: str) -> None:`.**
The cross-worker interleave contract, verbatim, **`backend/app/db/workflows.py:2191-2200`:**

```python
    ⚠ THE CROSS-WORKER INTERLEAVE — NAMED HERE RATHER THAN GUARDED, because a caller is
    who needs to know. A Stop landing on worker A (``_cancel_run_internals`` Step 3b →
    ``finish_run``) while worker B's producer is mid-F2 can interleave two
    ``UPDATE workflow_runs SET status = $2 WHERE id = $1`` writes against the same row.
    That is safe today for one reason only, and the reason is worth stating precisely:
    the interleave is BENIGN BY VALUE-IDENTITY, NOT BY EXCLUSION — both writes carry the SAME VALUE, row-level locking serialises them, and the anchor clear is idempotent (it finds 0 rows on the second pass).
    THE ONE THING A CALLER MUST NEVER DO IS MAKE THE TWO WRITES DISAGREE — e.g. one passing 'failed' while the other passes 'cancelled'. That prohibition IS the whole guard.
    Nothing here serialises the two workers, and adding a lock would be the wrong fix: the
    value-identity property is cheaper and it is what the shipped paths already satisfy.
```

**The convention this demonstrates, and it is the one `persist_run_usage` must honour in its own
docstring:** ⭐ **name the concurrency property explicitly and say which one it is NOT.** `finish_run`
is *value-identity-safe, not exclusion-safe*. An ADD is **order-independent but not repeat-safe** —
the opposite axis. `persist_run_usage`'s docstring must say that in those terms, and must name the
`(0,0)` guard as the thing that carries repeat-safety (not as an optimisation).

⚠ **A second convention visible here, which the plan should copy:** `finish_run` also shows how this
codebase *upgraded* a prose contract when prose proved insufficient — the L-01 guard at `:2222-2258`
is 30 lines of comment explaining that *"that prohibition was prose and prose cannot bind a producer
running on another worker"*, followed by a narrowed `WHERE`. `persist_run_usage` is the same class of
claim, and its guard is the `(0,0)` early return.

### 2c. The `None`-may-be-legitimate writer, and the missing-usage WARNING CONTRACT

**`backend/app/db/runs.py:82-121` (`finalize_run`)** — the shared `runs` terminal writer. Two things
to copy: the keyword-only signature shape, and the **documented caller obligation** at `:93-99`:

```python
# backend/app/db/runs.py:82-104
async def finalize_run(
    pool: asyncpg.Pool,
    *,
    run_id: UUID,
    status: str,
    error: str | None,
    completed_at: datetime,
    message_id: UUID | None,
    input_tokens: int | None,
    output_tokens: int | None,
) -> None:
    """Finalize a runs row at end-of-stream (Phase 073 - replaces threads.py:2651 aexec).

    TOKEN-COL-01 (D-073-07 / D-073-09):
      - input_tokens / output_tokens may be None (NULL write) if the SDK never
        surfaced usage on any iteration. Callers that detect this case MUST
        emit ``logger.warning('runs.usage missing for run=%s provider=%s model=%s', ...)``
        BEFORE calling finalize_run with None/None.
      - When non-None, the values are the SUM across all LLM iterations in the run.

    error column is TEXT (not JSONB) per supabase/full-schema.sql:471.
    """
    await pool.execute(
```

**⚠ The convention it must not break, and it is currently VIOLATED at five sites:** the
`logger.warning` is a **contract written into the writer's docstring**, and §6 below shows all five
shells calling with `None/None` and no warning. Mirroring the warning is part of the METER-05 fix,
not an extra.

---

## 3. `harness_engine.py` — the `_enforce_budget` reorder (service, event-driven)

**Analog: the function itself.** The change is a reorder of shipped lines, so the analog and the
subject are the same code — which is exactly what makes D-256-13's "by construction" claim provable.

**Verified at `edf2d1024`: `_enforce_budget` is defined at `:1848`; the guard is `:1873-1874`; the
absorb is `:1875`; `check_limits` is `:1876`. Call sites are exactly two — `:1978` and `:2547`.**

```python
# backend/app/services/harness_engine.py:1873-1885 — CURRENT code
        if not breaker.armed:
            return
        breaker.absorb_usage_box(getattr(ctx, "run_usage_box", None))
        _tripped, _reason = breaker.check_limits()
        if not _tripped:
            return
        await breaker.trip_breaker(
            pool, redis, run_id, _reason, {"observed_by": where},
            user_id=_audit_user_id,
        )
        raise CircuitBreakerTrippedError(_reason, breaker.measurements())
```

⭐ **RESEARCH.md's C-1 correction is CONFIRMED by direct read: the guard sits ABOVE the absorb.** The
persist must be moved above `:1873`, or SC#1 persists nothing for any interactive run.

**The convention it must not break** — stated in the function's own docstring, `:1850-1873`, and it
is the reason the reorder is safe but the *implementation* is delicate:

```python
# backend/app/services/harness_engine.py:1851-1856
        ⚠ IT RAISES ``CircuitBreakerTrippedError`` AND **NOT** ``asyncio.CancelledError``,
        AND IT IS CALLED FROM OUTSIDE THE PHASE ``try``. Both halves are load-bearing. A
        ``CancelledError`` would take the escape arm below, which calls ``cancel_phase`` —
        and a shipped Phase-194 fence AST-counts ``cancel_phase`` call sites in this module
        at EXACTLY ONE (204-01 hit that fence and answered by removing a write, not by
        re-baselining the count).
```

⛔ **So `persist_run_usage`'s exception must not be swallowed into a `CancelledError`, and it must not
be wrapped in a `try` that reaches the escape arm.** RESEARCH.md's "let the exception propagate to
`_enforce_budget`'s caller" is consistent with this; a `try/except` here would add a branch and break
the `3 → 3` arithmetic D-256-13 demands.

### ⚠ A PROSE-ROT OBLIGATION IN THIS FILE THAT NO REGISTER NAMES

**`backend/app/services/harness_engine.py:1837-1842`, verbatim — this comment becomes FALSE the
moment METER-06 ships:**

```python
    # ⚠ ``llm_emit`` PHASES ARE NOT COUNTED, AND THAT IS NAMED RATHER THAN HIDDEN.
    # ``forced_emit`` measures no usage anywhere in its own module, so its spend is
    # invisible to any box. Wiring it means instrumenting the forcing seam, which is a
    # different file and a different plan. The three counted types are the three that
    # loop (``llm_agent``, ``llm_batch_agents``) or stream (``llm_single``); a sealed
    # single shot is the one that cannot run away.
```

⭐ **This is the phase's own thesis handed to it in advance** — a hole that WAS named rather than
hidden, in a register (a source comment) nothing sweeps. **The METER-06 plan must update it in the
same commit as the drain arms**, recording the original beside the correction per the project's
standing rule. A second, weaker one sits at `:1826` (*"``harness/`` contained two ``usage``
references in total, both ``input_tokens=None``"*) — already stale at 7 sites.

---

## 4. `circuit_breaker.py` — `absorb_usage_box` widened to RETURN the delta

**Analog: the method itself.** ⭐ **This is the delta mechanism the phase must REUSE, not reinvent.**

**Verified at `edf2d1024`: `record_tokens` at `:140`, `absorb_usage_box` at `:150`, `armed` at `:128`,
`check_limits` at `:177`.**

```python
# backend/app/services/circuit_breaker.py:140-164 — CURRENT code, verbatim
    def record_tokens(self, input_tokens: int | None, output_tokens: int | None) -> None:
        """ADD this call's usage to the running totals.

        Negative deltas are clamped to zero: the only caller that can produce one is a
        usage box that went BACKWARDS, which means the box was reset under us, and
        subtracting from a spend counter is never the safe direction for a spend cap.
        """
        self.input_tokens += max(0, int(input_tokens or 0))
        self.output_tokens += max(0, int(output_tokens or 0))

    def absorb_usage_box(self, box: dict | None) -> None:
        """Sync from a CUMULATIVE ``usage_box`` — the shipped accumulator idiom.

        ``task_service._stream_one_iteration`` SUMS each turn's usage into a
        caller-supplied dict with keys ``input_tokens`` / ``output_tokens`` (Phase 093
        D-17). The engine hands one such box to every phase executor, so the box holds
        RUN-CUMULATIVE totals while ``record_tokens`` is ADDITIVE. This does the
        subtraction in ONE place — the breaker — rather than making the hot engine file
        carry delta bookkeeping it would have to get right.
        """
        if not box:
            return
        total_in = max(0, int(box.get("input_tokens") or 0))
        total_out = max(0, int(box.get("output_tokens") or 0))
        self.record_tokens(total_in - self.input_tokens, total_out - self.output_tokens)
```

**Stated plainly, as instructed: `persist_run_usage`'s delta comes from THIS watermark.** The
watermark is `self.input_tokens` / `self.output_tokens`, initialised `0` at
`circuit_breaker.py:117-118`. The delta is `box_total − watermark`; `record_tokens` then advances the
watermark by exactly that delta. ⭐ **A second `_enforce_budget` on an unchanged box therefore yields
`(0, 0)`, and that — not a key, not a lock, not an upsert — is what makes the DB write idempotent
against repetition.** There must be **no second delta bookkeeper anywhere in the phase.**

**Conventions it must not break:**
1. ⛔ **The `max(0, …)` clamp must be preserved ON THE RETURNED DELTA.** Today the clamp lives inside
   `record_tokens` (`:147-148`). Extracting `d_in`/`d_out` for the return **moves the clamp's
   consumer**: an unclamped return would hand `persist_run_usage` a negative and the DB `+` would
   **subtract real spend**. The docstring at `:142-145` says exactly why that direction is never safe.
2. **`if not box: return` is the `{}`-and-`None` no-op** — both falsy, both correct. The widened form
   must return `(0, 0)` there, never `(None, None)` (the column's NULL comes from *never writing*, not
   from writing a None delta).
3. **Method count must stay 9 and branch count in `absorb_usage_box` must stay 1** (D-256-13's
   arithmetic). Widening a return from `None` is byte-compatible for callers that ignore it.
4. ⚠ **`armed` is a short-circuit, never a semantic** — proven by `check_limits` at `:186-193`: both
   ceilings are `None` on a disarmed breaker, so it returns `(False, None)` unconditionally. That is
   the executable basis for Fence 4.

---

## 5. `forced_emit.py` — METER-06's two drain arms + the ladder accumulator

### 5a. The two arms — analog `backend/app/services/task_service.py:414-430`

**Verified at `edf2d1024`: `task_service._drain` is defined at `:349` with return type
`tuple[str, list[dict], str, int | None, int | None]`; the `usage` arm is at `:414`; the
`usage_delta` arm at `:424`.**

```python
# backend/app/services/task_service.py:414-430 — VERBATIM, the canonical two-arm reader
                elif et == "usage":
                    # D-17 (verbatim agent_loop.py:1399-1408): SUM usage.
                    _i = event.get("input_tokens", 0) or 0
                    _o = event.get("output_tokens", 0) or 0
                    if in_tok is None:
                        in_tok = _i
                        out_tok = _o
                    else:
                        in_tok += _i
                        out_tok = (out_tok or 0) + _o
                elif et == "usage_delta":
                    # D-17 (verbatim agent_loop.py:1409-1416): incremental output.
                    _o = event.get("output_tokens", 0) or 0
                    if out_tok is None:
                        out_tok = _o
                    else:
                        out_tok += _o
```

And the box write two frames out, **`task_service.py:446-455`**, which shows the `is not None` test
that is the load-bearing one:

```python
    content, tool_calls, _reasoning, _in_tok, _out_tok = await run_in_threadpool(_drain)
    ...
    # D-17: accumulate this turn's usage into the cross-iteration usage_box (SUM).
    if _in_tok is not None:
        usage_box["input_tokens"] = (usage_box.get("input_tokens") or 0) + _in_tok
    if _out_tok is not None:
        usage_box["output_tokens"] = (usage_box.get("output_tokens") or 0) + _out_tok
```

**The convention it must not break — and it is the phase's central invariant:**
⛔ **`in_tok` / `out_tok` are initialised `None`, and the first-event branch ASSIGNS rather than adds.**
A genuine measured **`0`** survives the `is not None` test and reaches the box; an **absent**
measurement does not. Initialising to `0` collapses the two facts and is the exact `None`-vs-`0`
defect D-256-06 forbids one layer up.

**The subject, for comparison — `backend/app/services/forced_emit.py:516-578`.** Verified: `_drain`
is at `:516`, signature `def _drain(stream) -> tuple[str, list[dict], str | None]:`, arms are
`delta` / `tool_preparing` / `tool_args_progress` / `tool_start` / `finish` — **no `usage`, no
`usage_delta`**, return at `:578` is a 3-tuple. Its own docstring already names the analog:

```python
# backend/app/services/forced_emit.py:516-521
def _drain(stream) -> tuple[str, list[dict], str | None]:
    """Drain ONE forced shot's gateway event stream into ``(content, tool_calls,
    finish_reason)``. Mirrors ``task_service._stream_one_iteration._drain`` (the
    canonical single-call drain) — but it is a SEALED single shot, never the open
    loop (D-01). Drives the bare sync generator inside a threadpool; closes it after.
    """
```

⚠ **The call site that must be widened with it is `forced_emit.py:465`:**
`content, tool_calls, finish_reason = await run_in_threadpool(_drain, stream)` — a 3-tuple unpack
inside the per-rung `try`.

### 5b. The ladder accumulator (D-256-12) — the analog is IN THE SAME FILE

⭐ **`forced_emit.py:433-435` already demonstrates the exact placement D-256-12 needs:** a
`str | None`-typed accumulator declared immediately above the rung loop and reassigned on every rung,
success or failure.

```python
# backend/app/services/forced_emit.py:433-435
    last_failure: str | None = None
    last_truncated = False
    for rung_name, forced, rung_strict in _RUNGS_BY_TIER[emit_tier]:
```

Reassigned at `:471-472` (provider raised), `:477-478` (truncated), `:501-502` (failed to emit), and
read at the floor `:507-512`. **`in_tok: int | None = None` / `out_tok: int | None = None` go in
exactly that slot, and they ACCUMULATE rather than replace.**

**The convention it must not break:** this file's loop uses `continue` on every failure arm — so an
accumulator declared *inside* the loop is silently reset per rung, which is precisely Fence 2's
planted violation (c). Declaring at `:433` is what makes "every rung counts" true by construction.

### ⚠ CORRECTION TO RESEARCH.md — `_failure()` has ONE call site, not two

- **RESEARCH.md §Q4 item 2, verbatim:** *"⚠ `_failure` is called from the exhausted-ladder floor
  (`:507`) **and** from a raised-exception backstop, so it must take the totals as parameters rather
  than default them."*
- **MEASURED at `edf2d1024`:** `grep -rn "[^_a-z]_failure(" backend/app/ | grep -v "def _failure"` →
  **exactly one hit, `forced_emit.py:507`.** The raised-exception path at `:466-473` does **not**
  call `_failure`; it sets `last_failure = "provider_error"` and `continue`s, reaching the same floor
  at `:507`. `_failure` is defined at `:179` and is module-private.
- **Consequence for the plan (it gets CHEAPER, not harder):** there is **one** exit to thread the
  totals through, not two, and the success return at `:491-500` is the other. **Two returns total,
  which matches D-256-13's `return` statements in `forced_emit` 2 → 2.** The parameter-vs-default
  advice still stands on its merits (a defaulted token param on `_failure` would let a future caller
  silently drop the count) — but the *reason given* is wrong, and a plan that goes looking for a
  second call site will not find one.

### 5c. `_exec_llm_emit` (+1 line) — analog `phase_types.py:917`

**Verified at `edf2d1024`: `_record_run_usage` is defined at `phase_types.py:768`; its two existing
call sites are `:917` and `:1028`.** The `:917` precedent, with the comment that makes it a pattern:

```python
# backend/app/services/harness/phase_types.py:914-917
    # Phase 204 (SCHED-02): fold this sub-agent's token spend into the run-level box the
    # circuit breaker reads. Same shape as the F7 hand-off directly below — a fact the
    # sub-agent already produced, threaded up to the one scope that can act on it.
    _record_run_usage(ctx, result.get("input_tokens"), result.get("output_tokens"))
```

**The convention it must not break — `_record_run_usage`'s own docstring,
`backend/app/services/harness/phase_types.py:780-782`:**

```python
    ⚠ ``None`` ADDS NOTHING. A provider that emitted no usage must not be read as zero;
    the two are different facts and only the first is worth a warning (which
    ``run_task_sub_agent`` already logs).
```

And the absence-is-the-common-case rule it depends on, `phase_types.py:752-766` (`_run_usage_box`):
`getattr(ctx, "run_usage_box", None)` returning `None` for *"a Deep run, a unit stub and a publish
golden run"*. ⛔ **The new `_exec_llm_emit` line must be a bare call with no `or 0` and no guard** —
`_record_run_usage` already no-ops on a missing box (`:784-785`) and on `None` values (`:786-789`).

---

## 6. The five producer shells (`input_tokens=None` → real totals)

**Analog: `backend/app/services/run_producer.py:230-247`.** ⭐ **RESEARCH.md's C-5 correction is
CONFIRMED — quote BOTH so the difference is visible, as instructed.**

**Verified at `edf2d1024`: the warning is at `run_producer.py:230-234`; the two finalize calls carry
`input_tokens=_input_tokens_total` at `:245` and `:256`.**

```python
# backend/app/services/run_producer.py:229-247 — ✅ COPY THIS. It SOURCES real totals.
    try:
        if _input_tokens_total is None and _output_tokens_total is None:
            logger.warning(
                "runs.usage missing for run=%s provider=%s model=%s",
                run_id, resolved_provider, resolved_model,
            )
        if terminal_status != "cap_paused":
            await finalize_run_terminal(
                pool=await get_pg_pool(),
                redis=redis,
                run_id=run_id,
                thread_id=UUID(thread_id) if isinstance(thread_id, str) else thread_id,
                status=terminal_status,
                error=terminal_error,
                completed_at=datetime.now(timezone.utc),
                message_id=UUID(_msg_id_for_runs) if _msg_id_for_runs else None,
                input_tokens=_input_tokens_total,
                output_tokens=_output_tokens_total,
            )
```

```python
# backend/app/services/run_lifecycle.py:359-395 — ⛔ DO NOT COPY. A PASS-THROUGH with None DEFAULTS.
async def finalize_run_terminal(
    *,
    pool,
    redis,
    run_id,
    thread_id,
    status,
    error,
    completed_at,
    message_id=None,
    input_tokens=None,        # ← :369, a DEFAULT, not a measurement
    output_tokens=None,
) -> None:
    """Atomic TERMINAL co-write — finalize the ``runs`` row THEN ZREM both mirrors.
    ...
    """
    await finalize_run(
        pool,
        run_id=run_id,
        ...
        input_tokens=input_tokens,      # ← :393, forwards whatever it was given
        output_tokens=output_tokens,
    )
    await redis.zrem(_ACTIVE_SET_KEY, str(run_id))
    await redis.zrem(f"runs_by_thread:{thread_id}", str(run_id))
```

**The difference, stated so it cannot be missed:** `run_producer.py:230-247` **measures, warns, then
writes**. `run_lifecycle.py:359-395` **is the writer being called** — it originates nothing, carries
`None` defaults at `:369-370`, and has no warning. **Copying `run_lifecycle.py:386` would reproduce
the defect.** ⚠ CONTEXT.md `<code_context>` names both as *"the two call sites that already pass real
totals"*; **that register is WRONG and RESEARCH.md's C-5 is right.** The distinguishing test is
whether the function computes its own totals — 175 lines of `run_producer` do; `finalize_run_terminal`
has no local accumulator at all.

**All five subject sites re-verified at `edf2d1024` by `grep -rn "input_tokens=None" backend/app/`
— every line number is exact:**

| # | Site | Writer called | Box carrier |
|---|---|---|---|
| 1 | `backend/app/api/runs.py:677` | `finalize_run` | `ctx` (ask_user re-drive) |
| 2 | `backend/app/api/runs.py:1331` | `finalize_run` (aliased `_finalize_run`) | `wf_ctx` (continuation) |
| 3 | `backend/app/services/harness_engine.py:3051` | `finalize_run` | `ctx` (boot-sweep resume) |
| 4 | `backend/app/services/harness/publish_service.py:1671` | `finalize_run` | `ctx` (golden run) |
| 5 | `backend/app/services/scheduler_service.py:296` | ⚠ **`finalize_run_terminal`** | `ctx`, may be `None` |
| 6 | `backend/app/services/eval_runner_service.py:946` | `finalize_run` | §7 — DIFFERENT shape |
| 7 | `backend/app/services/run_reconciler.py:245` | `finalize_run_terminal` | REGISTER (no process) |
| — | `backend/app/services/run_lifecycle.py:369` | — | a DEFAULT PARAM, not a site |

Site 1 in full, so the executor sees the exact `finally`-block shape to change —
**`backend/app/api/runs.py:670-679`:**

```python
                    await finalize_run(
                        pool,
                        run_id=_pid,
                        status="failed" if _failed else "completed",
                        error="ask_user re-drive failed" if _failed else None,
                        completed_at=_dt.now(_tz.utc),
                        message_id=None,
                        input_tokens=None,
                        output_tokens=None,
                    )
```

Site 5, which is the odd one — **`backend/app/services/scheduler_service.py:287-298`:**

```python
                await finalize_run_terminal(
                    pool=pool,
                    redis=redis,
                    run_id=pid,
                    thread_id=thread_id,
                    status="failed" if failed else "completed",
                    error="scheduled run failed" if failed else None,
                    completed_at=datetime.now(timezone.utc),
                    message_id=None,
                    input_tokens=None,
                    output_tokens=None,
                )
```

**Conventions the five must not break:**
- ⛔ **`_box.get("input_tokens")` with NO default and NO `or 0`.** An absent key stays `None` to the
  column. (`db/runs.py:93-97` + `phase_types.py:780`.)
- ⛔ **The warning format string is the shipped literal, identifier-only:**
  `"runs.usage missing for run=%s provider=%s model=%s"`. **T-073-04 forbids token VALUES in it** —
  pinned by `test_token_accumulator_missing_usage.py:41` as `_MISSING_USAGE_FORMAT` and asserted not
  to contain `"tokens="` / `"value="` / `"usage_dict"`. Five new call sites inherit that constraint.
- **The warning goes BEFORE the finalize call, inside the same `try`** (the analog's ordering).
- **Grain:** the box holds the SEGMENT's spend (reset at `harness_engine.py:1844`) and each shell is a
  per-segment `runs` row — writing segment onto segment is D-256-03-correct. ⛔ Do not write the
  `workflow_runs` cumulative here.

---

## 7. `eval_runner_service.py` — widen the internal return tuple (RESEARCH.md Q1)

> ⚠ **PARTIAL ANALOG ONLY. The producer-shell shape of §6 MUST NOT be copied here** — RESEARCH.md
> Q1 measured `ctx.run_usage_box` absent from the entire eval path, and I re-confirmed the box's
> single writer: `grep -rn "run_usage_box" backend/app` shows the only assignment is
> `harness_engine.py:1844`, and `eval_runner_service` never calls `run_workflow`.

**The measurements already exist, two frames from the broken finalize. All four line ranges verified
at `edf2d1024`:**

```python
# backend/app/services/eval_runner_service.py:590-594 — the totals ARE measured, per arm
    try:
        result = await run_agent_loop(ctx, emit=_noop, emit_terminal=_noop, spawn=_spawn)
        output = result.full_content_final or ""
        in_tok = result.input_tokens_total
        out_tok = result.output_tokens_total
```

```python
# backend/app/services/eval_runner_service.py:702 — the return that DROPS them
    return (variant, verdict_state, verdict_passed)
```

```python
# backend/app/services/eval_runner_service.py:852-855 — the outer collector, and its OWN docstring
        # Run-LOCAL rollup accumulator (D-PRD-12 / WORKER_COUNT=2 — NO module-global run
        # state). Only WITH-skill arm outcomes count toward the rollup denominator (OQ3);
        # the without-skill verdict is persisted for the A/B story + SI-01, not counted here.
        with_outcomes: list[tuple[str, str, bool | None]] = []
```

```python
# backend/app/services/eval_runner_service.py:939-948 — the broken finalize, in the job's `finally:`
        try:
            await finalize_run(
                pool,
                run_id=run_id,
                status=final_status,
                error=run_error,
                completed_at=datetime.now(timezone.utc),
                message_id=None,
                input_tokens=None,
                output_tokens=None,
            )
```

**Closest analog for the CARRIER, and it is a shape not a copy:**
`backend/app/services/eval_runner_service.py:852-855` itself — a **run-LOCAL accumulator declared in
the job function, never a module global**, with the reason written into the comment (`D-PRD-12` /
`WORKER_COUNT=2`). A token accumulator belongs in exactly that slot, beside `with_outcomes`.

**The convention it must not break — and it is a live trap:**
⛔ **`with_outcomes` is deliberately WITH-arm-only** (*"the without-skill verdict … not counted
here"*, `:854-855`). That is right for a **verdict** rollup and wrong for a **spend** rollup — you
were billed for both arms (D-256-12's own logic). **A token accumulator must NOT inherit
`with_outcomes`' narrowing**; if the plan widens the existing 3-tuple to carry tokens, the WITHOUT
arm's return at `:901-908` is currently **discarded entirely** and must be captured. ⭐ **Do not
solve this by making `with_outcomes` carry tokens** — that fuses two rollups with different
denominators into one list, and the comment at `:852-855` exists to stop exactly that. Two
accumulators, one per concern.

⚠ **And the hole that survives either way:** `_judge_eval_answer` (`:648`) is a third paid call per
arm whose usage is measured nowhere. The coverage marker must say so (RESEARCH.md R-4).

---

## 8. New test: the `parent_run_id IS NULL` AST fence

> ⛔ **CORRECTION TO RESEARCH.md — ITS NAMED FIRST-CHOICE ANALOG IS A DEAD WALK.** This is the most
> important thing in this document for the fence plan, and it was found by reading the file rather
> than trusting the citation.

- **RESEARCH.md §Fences To Build #1, verbatim:** *"**Closest existing analog to copy** —
  **`backend/tests/unit/test_189_no_egress.py`** — Case A is a source-walk fence with two independent
  vacuity guards"*, and *"Copy `test_189_no_egress.py:20-28` exactly: drive the matcher against an
  in-test haystack … and assert the walk **visited a plausible number of files**."*
- **MEASURED at `edf2d1024`:**
  - `test_189_no_egress.py:20-28` is **the module DOCSTRING**, not executable code. It *describes*
    two vacuity guards.
  - The walk helper exists at **`:80-81`**:
    `def _app_python_files(): return [p for p in _APP_ROOT.rglob("*.py") if "__pycache__" not in p.parts]`
  - **`grep -n "_app_python_files" backend/tests/unit/test_189_no_egress.py` returns the DEFINITION
    AND NOTHING ELSE. The helper has ZERO CALLERS.** The file-count vacuity guard the docstring
    promises **does not execute anywhere.**
  - The reason is the retirement itself. **`test_no_mcp_identifiers_in_backend_app` (`:249-259`) no
    longer walks anything:**

```python
# backend/tests/unit/test_189_no_egress.py:246-259 — the RETIRED gate, verbatim
# Phase 206 (CONN-02 / CONN-03 / D-206-07) — Consciously retired with the introduction of
# the official backend MCP connector client (`app.services.mcp_client`). Egress is guarded
# by `app.security.egress.validate_mcp_destination` and per-tool grant enforcement.
def test_no_mcp_identifiers_in_backend_app():
    """Phase 206 / D-206-07: Retired gate.

    The original 189 gate ensured zero MCP code existed in backend/app during Phase 189/190.
    Phase 206 officially introduced the MCP client with strict SSRF destination validation.
    This test remains as a documented milestone record.
    """
    from app.services import mcp_client
    assert mcp_client is not None
```

⭐ **The retirement discipline IS the pattern to copy, exactly as the prompt says** — the reason is
written into the test body and the comment above it, the decision id (`D-206-07`) is named, and the
original intent is preserved rather than deleted. ⚠ **But note what the retirement ALSO did: it left
a helper and a docstring describing guards that no longer run.** That is this project's own recurring
finding (*"what rotted was the PROSE, not the guard"*) one register lower. **A 256 fence must not
leave an orphaned helper.**

**What IS still live and worth copying from that file — `test_189_no_egress.py:215-244`, the matcher
positive control, which passes today:**

```python
# backend/tests/unit/test_189_no_egress.py:215-244
def test_the_mcp_matcher_actually_matches():
    """V11 positive control — the fence's matcher fires on a haystack that HAS the token.

    Without this, a typo in the regex (or an accidental over-escape) would make
    ``test_no_mcp_identifiers_in_backend_app`` green forever while checking nothing at all.
    """
    fires_on = [
        "client = MCPClient(server_url)",          # PascalCase - `\\bmcp\\b` MISSES this
        "self._httpMCPClient = build()",           # camelCase segment - also missed by `\\b`
        ...
    ]
    for haystack in fires_on:
        assert _MCP_TOKEN.search(haystack), (
            f"the mcp fence matcher failed to fire on {haystack!r} - the fence would pass "
            "vacuously over the whole tree"
        )

    # The boundary half, so the fence is not a bare substring search ...
    for haystack in ["mcpherson", "compute", "dmcpx", "camp", "McPherson"]:
        assert not _MCP_TOKEN.search(haystack), (...)
```

⭐ **And the file records its own matcher being falsified by this control** — `:59-71`, verbatim:
*"⚠ THE PLAN SPECIFIED `re.compile(r"\bmcp\b", re.IGNORECASE)` AND ITS OWN POSITIVE CONTROL FALSIFIED
IT. `\bmcp\b` does NOT match `MCPClient` … That is precisely the vacuous-fence failure the control
exists to catch, so the matcher is strengthened rather than the control weakened."* **Budget for the
same on a `SUM(` + `parent_run_id` conjunction matcher.**

### The LIVE analog for a source fence that actually walks and reports

**`backend/tests/unit/test_255_extension_contract_guard.py:122-144` — quoted in full:**

```python
def test_no_dynamic_code_execution_in_trigger_paths():
    """EXT-02: Zero occurrences of importlib, eval, or exec in the six trigger paths."""
    backend_app_dir = Path(__file__).resolve().parent.parent.parent / "app"

    forbidden_re = re.compile(r"\b(importlib|eval\s*\(|(?<!a)exec\s*\(|__import__\s*\()")

    violations = []
    for rel_path in TRIGGER_FILES:
        file_path = backend_app_dir.parent / rel_path
        if not file_path.exists():
            violations.append(f"File not found: {rel_path}")
            continue

        content = file_path.read_text(encoding="utf-8")
        lines = content.splitlines()
        for idx, line in enumerate(lines, 1):
            code_part = line.split("#")[0].strip()
            if forbidden_re.search(code_part):
                violations.append(f"{rel_path}:{idx} -> {line.strip()}")

    assert not violations, (
        f"Closed core violation: dynamic code execution primitives found in trigger files:\n"
        + "\n".join(violations)
    )
```

**Conventions worth copying from it:**
- **A collected `violations` list reported as one assertion**, each entry formatted
  `f"{rel_path}:{idx} -> {line.strip()}"` — so the gate **names the file and the line**, which
  D-256-02 requires.
- ⭐ **A missing file is a VIOLATION, not a skip** (`"File not found: {rel_path}"`). That is a real
  anti-vacuity mechanism: a renamed subject cannot silently empty the set.
- `code_part = line.split("#")[0]` — comments are excluded, so a docstring mentioning `SUM(` does not
  trip the gate. ⚠ This is also its weakness for 256: **it is line-oriented.**
- `TRIGGER_FILES` is a named `list[Path]` module constant at `:30-37`.

⚠ **Two caveats the planner needs:**
1. **`test_255_extension_contract_guard.py` imports `ast` at `:15` and NEVER USES IT** — `grep -c
   "ast\." → 0`. So it is a **regex** fence, not an AST fence, despite RESEARCH.md citing it as
   *"second-closest, for the AST mechanics"*. **That citation is wrong about the mechanism.** It is
   still the best *reporting/vacuity* analog.
2. **Real `ast.parse` fences DO exist in the gate** — `grep -rln "ast.parse(" backend/tests/unit/`
   returns **20+ files**, including `test_190_egress.py`, `test_222_no_undefined_names.py`,
   `test_214_failure_reason_seam.py`, `test_200_1_phase_output_shape.py`. ⭐ **If Fence 1 is to be a
   genuine AST fence (RESEARCH.md recommends it, because the conjunction spans lines), copy the
   `ast.parse` mechanics from one of those and the reporting/vacuity shape from
   `test_255_extension_contract_guard.py:122-144`.** Neither file alone is the analog.

**The md5-restoration precedent RESEARCH.md names** —
`backend/tests/unit/services/sources/test_240_contract_unchanged.py` — **verified present.**

---

## 9. New test: the `None`-vs-`0` drain cases

**Analog:** `backend/tests/unit/test_token_accumulator_missing_usage.py` — **93 lines, verified
present and in `tests/unit/` (inside the canonical gate).**

```python
# backend/tests/unit/test_token_accumulator_missing_usage.py:44-50 — a case, verbatim
def test_missing_usage_returns_none():
    """No trailing usage chunk -> accumulator stays (None, None) — D-073-09 sentinel."""
    input_total = output_total = None
    for chunk in (_normal_chunk(c) for c in ("hello", "world")):
        input_total, output_total = accumulate_openai(chunk, input_total, output_total)
    assert (input_total, output_total) == (None, None)
```

And the security half, **`:79-93`**, which the five new warning call sites inherit:

```python
def test_missing_usage_format_string_has_no_token_values():
    """T-073-04: warning format string must NOT contain token-value placeholders.
    ...
    """
    assert "run=%s" in _MISSING_USAGE_FORMAT
    assert "provider=%s" in _MISSING_USAGE_FORMAT
    assert "model=%s" in _MISSING_USAGE_FORMAT
    # NEGATIVE assertions — these substrings are FORBIDDEN
    assert "tokens=" not in _MISSING_USAGE_FORMAT
```

**Conventions to copy:** the module docstring states the threat id (`T-073-04`) and the pinned
format-string literal is a module constant (`_MISSING_USAGE_FORMAT`, `:41`) so one edit cannot
desynchronise the assertion from the code.

> ⚠ **THE CAVEAT THAT MATTERS, and it is why this is `role-match` and not `exact`:**
> **this test does NOT drive production code.** `accumulate_openai` is **defined inside the test
> file** at `:23-31`, as a local reimplementation of the OpenAI accumulator, and
> `test_missing_usage_finalize_log_format` (`:53-77`) **inlines the `if/else` it claims to test**
> (*"Simulate the if/else from RESEARCH Pattern 3 lines 428-432"*, `:63`). So it pins a SHAPE, and a
> drift in `openai_compat.py` or in the five new warning sites would not turn it red.
> ⛔ **Fence 2 explicitly requires behavioural driving of the real `forced_emit._drain` over a fake
> event stream** (*"not by grepping for the arm names"*). **Copy this file's CASES and its
> negative-assertion discipline; do NOT copy its reimplement-locally method.** The real-drain
> precedent to follow instead is `backend/tests/unit/test_forced_emit.py` (verified present, in the
> gate) — it exercises the actual module.

---

## 10. New test: the persistence round-trip across a process restart (SC#1)

> # ⛔ NO IN-REPO ANALOG.
> **Nothing in this repository writes to Postgres, drops the connection or pool, re-reads fresh, and
> asserts the value survived.** Searched: `grep -rln "restart\|reconnect\|fresh pool\|re-read"
> backend/tests/unit/`, every `asyncpg.connect(` / `create_pool(` consumer in
> `backend/tests/integration/` (20+ files), and `backend/tests/integration/conftest.py`'s fixtures.
> **This is a real finding for the planner: SC#1's literal words — *"re-reading the run after the
> process restarts returns the same totals"* — have no shape to copy, and the plan must either invent
> one or say plainly which weaker property it is asserting instead.**

**Three partial matches, and exactly where each diverges:**

| Partial | What it really does | Where it diverges from SC#1 |
|---|---|---|
| **`backend/tests/unit/test_239_settings_cross_worker_invalidation.py:124-160`** ⭐ the only in-repo mechanism that genuinely crosses a process boundary | `subprocess.Popen([sys.executable, "-c", textwrap.dedent(src)], cwd=BACKEND_DIR, …)` spawns a **REAL second interpreter**; the parent publishes and the child reports its own module globals over a JSON line on stdout | Its subject is a **module-global cache**, not a DB column. Its own docstring (`:166-168`) says: *"WHAT THIS DOES NOT PROVE: that the child read the real Postgres row (**its pool is a stub**)"* |
| **`backend/tests/integration/test_093_ask_user_workflow_run_live.py`** | live local Postgres (`:54322`) via *"a fresh asyncpg pool"* + the service-role PostgREST client, seeding and inspecting **`workflow_runs`** — the exact table 182 alters | One process, one pool, no restart. And it is in **`tests/integration/`, OUTSIDE the canonical unit gate** |
| **`backend/tests/integration/test_111_1_reembed_resume.py:1-20`** | proves the re-embed job is *"RESUMABLE: each pass re-selects chunks where embedding_model != current, so a **crashed/partial** run picks up where it left off"* | Resumability is proven by **re-running a predicate**, never by restarting anything. Also integration-only |

**The honest shape available today, and the planner should choose it explicitly:**
`test_239_settings_cross_worker_invalidation.py`'s docstring already models the right disclosure —
*"⚠ WHAT A SINGLE-PROCESS TEST CANNOT DO. The defect IS the process boundary."* **Combining its
`subprocess` mechanism with `test_093_ask_user_workflow_run_live.py`'s live `workflow_runs` pool would
be a genuine SC#1 proof, and no such combination exists in this repo.** A same-process
write-then-fresh-pool-read is the cheap approximation; it must be **labelled as such**, not written
up as a restart.

⚠ **Gate placement, from RESEARCH.md §Test Strategy and re-confirmed by `ls`:** the migration-shape
analog `backend/tests/integration/test_120_migration.py` (*"LIVE-DB migration-semantics gate"*, real
asyncpg on `:54322`, `information_schema.columns` reads, **writes only inside a rolled-back
transaction**, clean skip when the DB is unreachable) is the right shape for asserting 182's column
shape — **but `tests/integration/` is outside `pytest tests/unit`, so it is invisible to the 71-name
baseline and cannot be the phase's only proof.**

---

## 11. `text[]` column with a partial index — is there a precedent?

**Answer: HALF a precedent, and the half that is missing is the important one.**

| Question | Measured at `edf2d1024` | Verdict |
|---|---|---|
| Does any **`text[]` column** exist in a numbered migration? | **YES — exactly one.** `supabase/migrations/129_connector_oauth_tokens.sql:54`: `scopes TEXT[] NOT NULL DEFAULT '{}',` on `connector_tokens`. Confirmed as the only array-typed column in the whole schema: `grep -nE "^\s+\w+ (text\|uuid\|integer\|jsonb)\[\]" supabase/full-schema.sql` → **1 hit, `full-schema.sql:1149`**, inside `CREATE TABLE public.connector_tokens`. | ⚠ **precedent for the TYPE only, and it is the OPPOSITE posture** — `NOT NULL DEFAULT '{}'`, i.e. two states. D-256-07's marker needs **three** (`NULL` = pre-182 unknown · `{}` = covers nothing · a populated array). ⛔ Do not copy its `NOT NULL DEFAULT '{}'`. |
| Do the other `text[]` greps count? | **NO.** `071_dm_foundations.sql:35`/`:68`, `152_…:23`, `170_documents_source_state.sql:136` are all `::text[]` **array-literal casts inside CHECK constraints** (`= ANY (ARRAY[…]::text[])`), not column declarations. | not a precedent |
| Does any **partial index** exist? | **YES.** `055_todos_table.sql:42`, `059_harness_audit_and_threads_col.sql:34`, and the analog `175_documents_thread_key.sql:32-34`. | ✅ precedent for the partial index |
| Does any **partial index over an ARRAY** exist? | **NO.** | ⛔ **NO IN-REPO ANALOG** |
| Does `@>` appear in any **index predicate**? | **NO.** All 10+ `@>` hits (`007_document_metadata.sql:36`, `008`, `016`, `020`, `023`, `025`, `034`, …) are **`jsonb` containment inside RPC function bodies** — `AND (metadata_filter IS NULL OR d.metadata @> metadata_filter)`. `007:6-7` has a **GIN index on the jsonb column**, not a predicate. | ⛔ **NO IN-REPO ANALOG for `@>` in a predicate, and none for array containment at all** |
| GIN on an array? | **NO.** Only two GIN indexes exist: `007:7` (jsonb), `008:15` (tsvector). | n/a |

> ⛔ **So: for the coverage marker's `text[] … WHERE NOT (token_coverage @> ARRAY[…]::text[])`, the
> executor has NO in-repo precedent for the predicate.** RESEARCH.md's A1/U-2 flags this as
> `[ASSUMED]`, and this pattern map confirms there is nothing to copy. **Follow
> `175_documents_thread_key.sql`'s style only, and paste-and-verify the DDL against the live SQL
> editor before the plan commits to it** — which the migration route requires anyway. RESEARCH.md's
> fallback (`array_length(token_coverage, 1) < 4`) also has no precedent, and it hard-codes arity
> rather than members.

---

## Shared Patterns

### S-1 — `None` ≠ `0`, and it is a SECURITY property here, not a style
**Sources (all three verified):** `circuit_breaker.py:160` (`if not box: return`) ·
`phase_types.py:780-789` (`⚠ None ADDS NOTHING` + `if input_tokens:`) ·
`task_service.py:452-455` (`if _in_tok is not None:` — a measured **0** IS written).
**Apply to:** migration 182's nullability, `persist_run_usage`'s `(0,0)` guard, the drain arms'
`int | None` initialisation, all five shells' `.get()` with no default.
⭐ **The three absorbers disagree in a way that is deliberate and must be preserved:** `circuit_breaker`
treats `{}` as a no-op, `phase_types` treats `None` **and** `0` as adding nothing (it is a summer, so
adding 0 is identical to skipping), and `task_service` distinguishes `0` from `None` (it is the
**measurer**, so the difference is the whole information). ⛔ Pick the one whose ROLE matches.

### S-2 — Parameterised SQL only, one home, docstring names the table
**Sources:** `db/workflows.py:2023-2035` · `db/runs.py:104-121` · `claim_run` (`db/workflows.py:2282`).
**Apply to:** `persist_run_usage`. ⛔ No f-string SQL (T-091-03). ⛔ No SQL in `harness_engine.py`
(D-256-05; the file's inline-SQL count must stay 0 → 0).
⚠ **Security posture to state in the plan, from RESEARCH.md §Security V4 and confirmed by the
analogs:** `persist_run_usage` runs on the **service-role pool**, which BYPASSes RLS, so `WHERE id = $1`
is the entire access boundary and `run_id` must come from the engine's own loop, never a request body.
⛔ Never add an org-less `UPDATE … WHERE thread_id` variant.

### S-3 — The identifier-only `logger.warning`
**Source:** `run_producer.py:231-234`; contract at `db/runs.py:93-97`; pinned by
`test_token_accumulator_missing_usage.py:41` + `:79-93` (T-073-04).
**Apply to:** the five new shell warnings. ⛔ Never token VALUES in the format string.

### S-4 — Declare the accumulator ABOVE the loop
**Sources:** `forced_emit.py:433-434` (`last_failure` / `last_truncated`, in the very file being
modified) · `eval_runner_service.py:852-855` (`with_outcomes`, with the `NO module-global run state`
reason written in).
**Apply to:** METER-06's ladder totals (D-256-12) and the eval accumulator (Q1).
⛔ **Run-LOCAL, never a module global** — `WORKER_COUNT=2` is the shipped default and the
`eval_runner_service.py:852` comment cites D-PRD-12 for exactly this.

### S-5 — Record the CORRECTION beside the original; retire a fence DELIBERATELY
**Sources:** `db/workflows.py:2172-2190` (`finish_run`'s *"quoted here rather than deleted, because it
was NARROWER THAN THE FUNCTION"*) · `test_189_no_egress.py:246-259` (D-206-07's conscious retirement,
reason in the body) · `test_189_no_egress.py:59-71` (a matcher falsified by its own control, matcher
strengthened rather than control weakened).
**Apply to:** the `harness_engine.py:1837-1842` comment that METER-06 falsifies (§3), the
`harness_engine.py:1826` stale count, SEED-074's three stale claims, and every ledger row re-derived.

---

## NO IN-REPO ANALOG — the three gaps, for the planner

| # | Thing | Closest partial | Where it diverges |
|---|---|---|---|
| **G-a** | A test proving a DB value survives a **process restart** (SC#1, verbatim) | `test_239_settings_cross_worker_invalidation.py:124-160` — real `subprocess.Popen([sys.executable, "-c", …])` | Subject is a module-global cache; **its own docstring says its child's pool is a stub**. Nothing in the repo restarts a process AND re-reads Postgres. See §10. |
| **G-b** | A **partial index predicate over an array** / `@>` in any index predicate | `175_documents_thread_key.sql:32-34` (partial index, `IS NOT NULL` predicate) · `007_document_metadata.sql:36` (`@>` but **jsonb, in a function body**) | No array containment anywhere; no `@>` in any predicate; only 1 array column in the entire schema and it is `NOT NULL DEFAULT '{}'` (wrong posture). See §11. |
| **G-c** | A `text[]` column with **three-state** semantics (`NULL` / `{}` / populated) | `129_connector_oauth_tokens.sql:54` — `scopes TEXT[] NOT NULL DEFAULT '{}'` | `NOT NULL DEFAULT '{}'` is exactly the two-state collapse D-256-07 needs to avoid. The style analog for the COMMENT explaining a third state is `175_documents_thread_key.sql:20-25`. |

---

## Register disagreements — quoted, with the wrong register named

| # | Claim | CONTEXT.md | RESEARCH.md | **Measured at `edf2d1024`** | Wrong register |
|---|---|---|---|---|---|
| 1 | Which call site to copy for the five shells | `<code_context>`: *"`run_producer.py:249` **and** `run_lifecycle.py:386` — the two call sites that **already pass real totals**. Copy their shape"* | C-5: *"`run_lifecycle.py:386-395` is the body of `finalize_run_terminal`, which forwards whatever it was given … **Copy `run_producer.py:230-247`**"* | `run_lifecycle.py:369-370` are `input_tokens=None` **default parameters**; `:393` forwards. `run_producer.py:230-234` computes + warns. | ⛔ **CONTEXT.md** |
| 2 | The write point | D-256-04: *"at the existing breaker absorb point (`harness_engine.py:1875`)"* | C-1: the persist must sit **above** the `armed` guard | `:1873` `if not breaker.armed:` · `:1874` `return` · `:1875` the absorb | ⛔ **CONTEXT.md** (the *place* is right, the *line* is not) |
| 3 | `panel.py:243-274` reads child tokens | *"⚠ A shipped surface that reads child tokens"* | C-2: it selects no token column | not re-measured here; RESEARCH.md quotes the `SELECT` list at `panel.py:259-263` | ⛔ **CONTEXT.md** (per RESEARCH.md; not independently re-verified by this map) |
| 4 | `_failure()`'s call sites | — | §Q4: *"`_failure` is called from the exhausted-ladder floor (`:507`) **and** from a raised-exception backstop"* | **ONE call site.** `grep -rn "[^_a-z]_failure(" backend/app/` → `forced_emit.py:507` only. The exception arm at `:466-473` sets `last_failure` and `continue`s. | ⛔ **RESEARCH.md** (§5b) |
| 5 | The source-fence analog | — | Fence 1: *"`test_189_no_egress.py` — Case A is a source-walk fence with two independent vacuity guards"*; *"copy `:20-28` exactly"* | `:20-28` is the DOCSTRING. The walk helper `:80-81` has **zero callers**; the gate `:249-259` was retired to a 2-line import assert. The file-count guard **executes nowhere**. | ⛔ **RESEARCH.md** (§8) |
| 6 | `test_255_extension_contract_guard.py` as "the AST mechanics" | — | Fence 1: *"Second-closest, for the AST mechanics over a registry"* | It `import ast` at `:15` and **never uses it** (`grep -c "ast\." → 0`). Its fence is line-oriented regex. Real `ast.parse` fences: 20+ other files. | ⛔ **RESEARCH.md** (§8) |
| 7 | Base SHA | `772f53354` | `e78cf5e63` | **`edf2d1024`** | both stale; RESEARCH.md's own C-8 predicted it |

⭐ **Every backend line number RESEARCH.md quotes was re-derived here and is EXACT** — `1873`/`1875`,
`768`/`917`/`1028`, `414`/`424`, `150`/`164`, `516`, `433`, `230`/`245`, `677`/`1331`/`3051`/`1671`/`296`/`946`/`245`, `2169`, `2023`, `82`. The disagreements above are about **which analog and what it
contains**, never about where the code is.

---

## Metadata

**Analog search scope:** `backend/app/{api,db,services,services/harness,services/provider_gateway}` ·
`backend/tests/unit/` · `backend/tests/integration/` · `supabase/migrations/` (148 files) ·
`supabase/full-schema.sql` · `scripts/full-schema-supplement.sql`
**Files opened and read (not merely grepped):** 20
**Every excerpt above was read at `edf2d1024` and carries its `file:line`.** Nothing was copied from
RESEARCH.md without opening the file.
**Pattern extraction date:** 2026-09-18
