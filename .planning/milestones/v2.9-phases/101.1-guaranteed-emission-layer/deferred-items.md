# Phase 101.1 — Deferred Items

Out-of-scope discoveries logged during execution (per the SCOPE BOUNDARY rule —
not fixed here; routed forward).

## DI-101.1-10-A — Two pre-existing stuck-active `confirm` phase rows (Phase 092-era)

**Found during:** Plan 101.1-10 Task 1 (global cleanliness check after repairing the 3 named runs).

**Observation:** beyond the 3 dirty runs the plan named (575e7345 / a7f415ad / 4ea9bc56,
all `fill`/`llm_emit` — repaired), the live DB has **2 OTHER** `workflow_phases` rows
still `status='active'` under a `failed` parent run:

| run prefix | phase_index | slug | created |
|---|---|---|---|
| `5aa42b6b` | 1 | `confirm` | 2026-06-01 |
| `e0d1f740` | 1 | `confirm` | 2026-06-03 |

**Why out of scope:** these are `confirm` (ask_user / `llm_human_input`) phases from the
Phase 092-era dual-mode wiring window (June 1 / June 3), NOT the `llm_emit` silent-crash
class this phase fixes. Plan 101.1-10 Task 1 names exactly the 3 emission-layer runs; the
repair script is scoped to those 3 run_ids by construction. Expanding it to a blanket
"all active-under-failed" sweep would violate the plan's SCOPE and risk touching
unrelated terminal states.

**Disposition:** documented, not fixed. They are cosmetically stuck `active` on terminal
(failed) runs — no live impact (the runs are done; the DB reconcile is the source of
truth per D-v2.5-03). If a future phase audits workflow_phases hygiene broadly, a
general `repair: flip active phases of terminal runs to match` sweep can clear these two
(and prevent recurrence at the ask_user terminal site, the same class the Plan 07
completed-branch flip closed for emit).

**Re-open trigger:** any phase touching `llm_human_input` / ask_user terminal handling,
or a deliberate workflow_phases hygiene sweep.
