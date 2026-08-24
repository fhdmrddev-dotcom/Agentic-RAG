---
phase: 204-scheduled-and-recurring-unattended-runs
type: preflight
reviewed: 2026-08-24
reviewer: Claude (validation pass over Gemini's plan, before execution)
plan_commit: b4699f6f
verdict: execute — 3 gaps to close DURING execution, none blocking
---

# Phase 204 pre-flight — read this before executing

The plan is **sound and is not being re-planned.** It took all three L-01 scope items the
ROADMAP detail section named. What follows is what the plan does NOT cover and must be added
inside the existing plans — no new plans, no re-planning.

## ✅ Verified correct — do not re-check these

| Check | Evidence in the plan |
|---|---|
| L-01 acceptance is BEHAVIOURAL | *"issues zero further LLM provider calls"*, *"verified with mock provider call counters"* — measured requests, never the status column |
| `WORKER_COUNT=2` | named in `204-01` must-have truth 5 |
| One path, not two | *"Both manual Stop and automated cancellation utilize the identical `cancel_workflow_run_internals`"* |
| Scheduler is reachable | `backend/app/main.py` is in `204-03` `files_modified` — not the Phase-118 built-but-unreachable shape |
| No duplicate firings at 2 workers | `SKIP LOCKED` / advisory lock |
| Migration number | 123 is the highest on disk, so **124 is correct** |
| RLS on the new table | named in `204-03` |
| Wave 2 parallelism is safe | `204-02` and `204-03` have **zero `files_modified` overlap** — measured, not assumed |

## ⚠ THE THREE GAPS — close each inside its existing plan

### G-1 · Migration 124 has no bootstrap-artifact regeneration (`204-03`)

CLAUDE.md rule, verbatim in force: apply the migration by **pasting it into the Supabase SQL
editor** — never `supabase db push` / `db reset`, which would wipe dev data — then run:

```bash
bash scripts/regenerate-full-schema.sh          # no --reset
```

Neither the apply nor the regeneration is in `204-03`'s `files_modified` or its must-haves.
**Without the regeneration, `supabase/full-schema.sql` lacks `workflow_schedules` and every
greenfield deploy silently comes up without the table.** Never hand-edit `full-schema.sql`.

### G-2 · Deploy-artifact parity will turn CI red (`204-03`)

A new **bundled background service** plus any scheduler env var (poll interval, enable flag)
trips the Phase-158 / D-16 same-commit rule. `scripts/check-deploy-drift.sh` enforces it in the
`deploy-artifacts` workflow, so this fails in CI rather than quietly:

- `deploy/onebox.env.example`
- `docs/OPERATOR.md` → Step-3 seed list
- `docker-compose.prod.yml`

A var that is intentionally omitted goes in the script's `OMITTED_FROM_ONEBOX` list — never left
to drift.

### G-3 · `frontend/src/lib/api.ts` is missing from `files_modified` (`204-03`)

`WorkflowScheduleModal.tsx` must call the new `/schedules` endpoints. Two ways this goes wrong:

- **Editing `api.ts` undeclared** is `196-08`'s failure mode — a whole-module `vi.mock` factory
  that omits a newly reachable export produced **249 red tests** far from their cause.
- **Fetching inline in the modal** breaks the one-home convention every other client call follows.

⚠ **AND `api.ts` CARRIES AN OWED DECLINE.** Its 197 re-open trigger — *"the next phase adding a
RUNTIME export or a second concern here"* — **already fired at 200.2** and has not been answered.
Schedule CRUD functions would be the **second** firing. Either take the extraction, or re-decline
in writing with a fresh trigger; carrying the old *"it did not fire"* sentence forward is not
available. Row + full derivation: `docs/HOT-FILE-LEDGER.md` → `frontend/src/lib/api.ts`.

## ⚠ One risk to resolve in `204-01` task 1, not at wiring time

`204-02`'s `CircuitBreaker.record_tokens(input_tokens, output_tokens)` needs a source.

**Measured:** token usage IS captured in the CHAT path — `agent_loop.py` tracks
`input_tokens_total`, `db/runs.py` persists it. **But `backend/app/services/harness/` contains
exactly 2 usage references in total, both in `publish_service.py`.** So whether the *harness*
phase executors ever see per-call token counts is **unproven**.

If they do not, the token half of SCHED-02 is a bigger lift than the plan reads and the duration
breaker carries the phase alone. **Establish this before building the tracker**, and if the counts
are absent, say so in the SUMMARY rather than shipping a ceiling that can never trip — that is the
Phase-200 SC#3 shape (built, gated, green, structurally unreachable).

## Execution notes

- Wave 1: `204-01`. Wave 2: `204-02` + `204-03` in parallel (overlap verified zero).
- Bring local infra up first — `204-03` needs the live DB at `:54322` for migration 124:
  `powershell -ExecutionPolicy Bypass -File scripts/start-local-infra.ps1`
- Gates that matter here: `pytest tests/unit` phase-scoped, and for `204-03`'s frontend half
  `npx tsc --noEmit -p tsconfig.app.json` (**the bare `--noEmit` checks ZERO files**) plus
  `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root.
- **Standing criterion for this phase:** every mitigation named in a plan's `<threat_model>` has a
  test. Phase 203 wrote three and implemented none, and every task still passed.
