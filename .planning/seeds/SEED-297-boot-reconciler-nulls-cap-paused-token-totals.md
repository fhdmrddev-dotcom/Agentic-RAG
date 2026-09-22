---
seed_id: SEED-297
title: "The boot reconciler NULLs a cap_paused run's already-persisted token totals — finalize_run's unconditional SET, measured at Phase 256"
created: 2026-09-18
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: >
  Any phase that (a) edits db/runs.py finalize_run's UPDATE statement, (b) edits
  run_reconciler.py's candidate status set or its finalize call, (c) changes
  main.py's boot reconcile call arguments, or (d) makes a cap_paused run's token
  total load-bearing for money — which Phase 257's METER-07 per-run dollar view does.
trigger_paths:
  - "backend/app/db/runs.py"
  - "backend/app/services/run_reconciler.py"
  - "backend/app/main.py"
trigger_surfaces: [chat, harness, admin]
migration_note:
relates_to:
  - "backend/app/services/run_producer.py:249"
  - "backend/app/db/runs.py:104"
  - "backend/app/services/run_reconciler.py:236"
  - "backend/app/main.py:434"
  - "256"
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-297: The boot reconciler NULLs a `cap_paused` run's already-persisted token totals

## The finding

**A `cap_paused` chat run that carries REAL token totals loses them at the next backend restart.**
That is literally *"a run loses its token count"* — the sentence Phase 256 is named for — and no
decision covered it until this entry.

The chain, every link source-measured at `902701e89`:

1. **`backend/app/services/run_producer.py:249-257`** finalizes a `cap_paused` run with its **real
   totals** via `finalize_run` — deliberately *not* `finalize_run_terminal`, so the row stays in
   `runs:active` and the stream remains re-attachable.
2. **`backend/app/db/runs.py:104-122`** — `finalize_run` performs an **unconditional**
   `SET input_tokens = $6, output_tokens = $7`. A second call carrying `None` therefore **NULLs the
   columns**, silently, with no guard.
3. **`backend/app/services/run_reconciler.py:84`** —
   `_NON_TERMINAL_CHAT_STATUSES = ["streaming", "cap_paused"]`; `:217` uses the full list when
   `include_cap_paused` is true.
4. **`backend/app/services/run_reconciler.py:101`** — `include_cap_paused: bool = True` is the
   **default**.
5. **`backend/app/main.py:434-436`** — the **BOOT** sweep calls `reconcile_orphaned_runs(pool=…,
   redis=…, supabase=…)` with **no `include_cap_paused` argument**, i.e. `True`. ⚠ The periodic
   sweep at `:490` correctly passes `False`. **The two call sites disagree, and nothing at either
   site says why.**
6. **`backend/app/services/run_reconciler.py:236-247`** then calls
   `finalize_run_terminal(..., input_tokens=None, output_tokens=None)`.

## Why it matters

Phase 256 exists so that a run's spend is either counted or explicitly named as uncountable. This
defect produces the third case: a number that **was** known, **was** written to the database, and is
then overwritten with `NULL` by a housekeeping sweep — so the row afterwards is indistinguishable
from a run whose provider never surfaced usage. **A destroyed measurement that looks exactly like a
missing one is worse than either**, because no downstream reader can tell them apart.

Who pays, and when: **Phase 257's METER-07 per-run dollar view.** The moment a token total becomes
money on a screen, an under-count is a wrong invoice rather than a wrong debug line. Until then the
cost is confined to diagnostics.

⭐ **Size: NOT YET MEASURED, and that is recorded rather than guessed.** The sizing query below is a
**production READ** (free, no approval needed under CLAUDE.md's Supabase MCP rule), but the MCP
tool is **not available inside a GSD worktree-executor agent** — `mcp__supabase__execute_sql`
resolves to *"No such tool available"* (the known upstream bug that strips MCP tools from agents
carrying a `tools:` frontmatter restriction). ⛔ **No fabricated figure is recorded here.** Run it
from a top-level session:

```sql
SELECT count(*) FROM runs
 WHERE status = 'failed'
   AND error LIKE 'failed: orphaned%'
   AND input_tokens IS NULL;
```

⚠ That count is an **upper bound with a known contaminant**: it cannot separate rows this defect
NULLed from rows that were genuinely never counted (`SEED-299`). Distinguishing them needs a
`cap_paused`-at-the-time signal the schema does not currently carry — which is itself part of why
the disposition below is REGISTER.

## When to surface

Any phase that touches `db/runs.py`'s `finalize_run` UPDATE, `run_reconciler.py`'s candidate status
set or its finalize call, or `main.py`'s boot reconcile arguments. **And unconditionally at
METER-07**, where the number becomes money.

## Scope estimate

**Small to fix, Medium to ship safely** — and that gap is the whole reason this is registered.

⛔ **DISPOSITION: REGISTER, not fix.** Decided explicitly at Phase 256 (plan `256-02`), because an
unnamed hole is exactly what this phase exists to stop.

**The reason, written down rather than implied.** The apparent two-line repair is:

```sql
SET input_tokens = COALESCE($6, input_tokens)
```

That changes a **shipped writer with multiple callers**, and it would silently make a genuine
`None`-after-a-value **un-writable** — there would no longer be any way to record *"we previously
believed a number and now know it was wrong."* That is a **semantic change to a shared writer, not a
patch**, and it is inconsistent with D-256-05's posture of leaving `finish_run` byte-unchanged. The
honest fix is narrower and belongs to its own phase: make the BOOT sweep pass
`include_cap_paused=False` (matching the periodic sweep), or give `finalize_run` an explicit
`overwrite_usage: bool` that each caller states. **Both are behaviour changes to a restart path and
deserve their own UAT.**

## Breadcrumbs

- Measured during Phase 256 research (`256-RESEARCH.md` §"Register Entries Owed" → R-1) and
  re-verified at `902701e89` while writing plan `256-02`.
- `docs/HOT-FILE-LEDGER.md` → `backend/app/services/run_reconciler.py` carries the same chain as a
  binding invariant on the next editor of that file, with a ledger row added at Phase 256 because
  the file had none for its entire life.
- ⭐ The nuance that keeps the blast radius bounded, and it is load-bearing:
  `run_reconciler.py:217-247` only touches **non-terminal** rows, so it can never overwrite a
  **COMPLETED** run's real total. A future edit that widens the candidate set to terminal statuses
  converts this from a `cap_paused`-only defect into general data loss.
- Related but distinct: `SEED-299` — a *stranded* Deep chat run's count is genuinely **unknowable**,
  so its `NULL` is honest. This seed is about a `NULL` that **destroys a known value**. ⛔ Do not
  merge the two: one is a measurement gap, the other is a measurement being deleted.
