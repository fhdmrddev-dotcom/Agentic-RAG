# Phase 250 — the blocking measurement, taken before a line was planned

**Taken:** 2026-09-15, against the live local database (`todos`, `runs`), via `asyncpg` on
`settings.postgres_dsn`. Script: scratchpad only, not committed. Re-derive rather than trust this
file — it rots like every other number in this project.

## The question the ROADMAP said must be answered here

> Does the stuck todo item carry the string `" (run ended — not completed)"`?
> **PRESENT ⇒** the reconciler ran; `HONEST-04` is a copy / scoping decision.
> **ABSENT ⇒** the reconciler did not run; `HONEST-04` is a backend defect.
> *"Planning before this is measured builds one of two mutually exclusive fixes at random."*

## The answer: PRESENT — and the dichotomy is false

```
=== todos by status ===
  completed      268
  pending         52
  in_progress     26

=== open todos (pending/in_progress) ===
  open todos total: 78
  carrying marker : 25
  WITHOUT marker  : 53
  distinct threads: 26

=== unmarked, split by era (Phase 138 shipped the reconciler on 2026-07-06) ===
  before 2026-07-06 (reconciler did not exist): 49
  on/after 2026-07-06                         :  4   ← the only interesting rows

=== those 4 rows, and the runs behind them ===
  thread cfa60ada  todo@2026-08-31 22:07:41  runs = timed_out:1
  thread 501c1f8d  todo@2026-08-18 04:48:11  runs = cancelled:1, timed_out:1
                                             ← NOT ONE `completed`

=== marked rows ===
  25 marked · newest 2026-09-13 14:31:05 · oldest 2026-07-06 07:49:21

=== run statuses across all 26 threads holding an open todo ===
  completed 38 · cancelled 5 · timed_out 2      (none running)
```

Newest marked row, verbatim (em-dash U+2014 renders as `?` in a Windows console — encoding only):

```
2026-09-13 14:31:05  in_progress  MARKED  'Translate full document content to Arabic (run ended — not completed)'
2026-09-13 14:31:05  pending      MARKED  'Recreate the document as an Arabic PDF matching the original format (…)'
2026-09-13 14:31:05  pending      MARKED  'Verify output and deliver (run ended — not completed)'
```

## What this decides

1. **`HONEST-04` is the COPY arm.** `2026-09-13` is the operator's own report date, and those rows
   **carry the marker**. The reconciler fired correctly and told a person that work they had
   watched finish was *"not completed"*. The words are the defect.
2. **`HONEST-03` gets a LOCATED gate defect, not a mystery.** Every post-138 unmarked row sits
   behind a run that ended `timed_out` or `cancelled`. `run_producer.py:145` admits only
   `terminal_status == "completed"`, so those runs reconcile nothing — correct by the gate's own
   rule, wrong for the surface.
3. **`BUG-260902-01`'s mechanism claim is REFUTED.** *"There is no reconciliation at all"* is
   false: `reconcile_open_todos_on_run_end` exists, ships, and has exactly one call site. Its
   **gate** is the defect, not its absence.
4. **No backfill is needed** — see `D-250-04`/`D-250-05`. The 49 legacy + 4 gated rows become
   honest presentationally, by reading run state, without rewriting a stored row.

## Static facts measured alongside (2026-09-15)

| | |
|---|---|
| `reconcile_open_todos_on_run_end` call sites | **1** — `run_producer.py:146` |
| `_RUN_STATUS_TO_TERMINAL_TYPE` | `{completed, failed, cancelled, timed_out}` — `cap_paused` absent |
| `todos_status_check` | `pending \| in_progress \| completed` (no *abandoned*) |
| `settings.context_window_reserve_recent` | `10` |
| `full_reasoning_content` | **reset to `""` at `agent_loop.py:2733` and `:2839`** — the `HONEST-02` trap |

## Hot-file triples, re-derived from git (recipe in CLAUDE.md, date buckets subtracted)

| File | commits / phases / lines | G-5 | Ledger row |
|---|---|---|---|
| `backend/app/services/todos_service.py` | 4 / 3 / 187 | **FIRES** | ⛔ absent |
| `backend/app/services/context_window.py` | 10 / 5 / 602 | **FIRES** | ⛔ absent |
| `frontend/src/components/panel/TodosSection.tsx` | 6 / 4 / 210 | **FIRES** | ⛔ absent |
| `backend/app/services/run_producer.py` | 3 / 2 / 693 | below | ⛔ absent |
| `backend/app/services/agent_loop.py` | 45 / 21 / 3326 | **FIRES** | section present |
