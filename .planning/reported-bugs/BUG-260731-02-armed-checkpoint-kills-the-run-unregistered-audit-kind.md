---
id: BUG-260731-02
title: The armed action-risk checkpoint KILLS the run — `action_risk_pending` was never registered in either the Python allow-list or the Postgres CHECK
reported: 2026-07-31
surface: Agentic-RAG
severity: blocking
status: open
affected_areas: [backend/harness, governance/GOVERN-03, audit-ledger, migrations]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 7db42404
  date: 2026-07-31
---

# BUG-260731-02: The armed action-risk checkpoint kills the run instead of parking it

## What we observed

Driving the SC#10 **parallel-thread** row required a workflow with an armed step, so a copy of the
published `compliance-gap-report` was created with `action_risk_armed: true` on the `emit` phase
(`workflow_definitions.slug = sc10-armed-f77e72`) and launched via
`POST /threads/{id}/messages` with `gpt-5.5` / `openai`.

Expected (GOVERN-03, and the explicit promise of plan `185-05`): `retrieve` completes, `emit` reaches
its `timing: "pre"` approval gate, the run **parks indefinitely** waiting for a person, and the
ledger records that it paused.

Actual — `workflow_runs.id = 80c8823d`, thread `292d07b0-e04c-41e7-8ed9-beec5b72c3ec`:

| | |
|---|---|
| `workflow_phases.retrieve` | `completed` (with `gate_passed`) |
| `workflow_phases.emit` | `active`, output `{}` |
| `workflow_runs.status` | **`failed`** |
| `harness_audit` rows for the run | 5 — `phase_started`, `gate_passed`, `phase_completed`, `phase_transition`, `phase_started`. **No `gate_failed`. No failure event at all.** |

`runs.error` on the owning chat run `de405cd1` carries the cause verbatim:

```
failed: ValueError: write_audit event_type must be one of the 22 harness_audit kinds
(059 + 069 + 070), got 'action_risk_pending'
```

So the run did not pause and did not fail *for a governance reason* — it **crashed**, mid-pause, on
its own audit write, leaving a phase permanently `active` under a run marked `failed`.

**This is a two-layer registration gap, not a typo.** `action_risk_pending` is emitted at
`backend/app/services/harness_engine.py:712-716`, and it is absent from BOTH gates that admit an
audit kind:

1. **Python allow-list** — `_AUDIT_EVENT_TYPES`, `backend/app/db/workflows.py:56-80`. 22 kinds
   (9 lifecycle + 7 emit-transition + 6 judge/publish/policy). `write_audit` raises `ValueError`
   before the INSERT (`:951-955`).
2. **Postgres CHECK constraint** on `harness_audit.event_type` — verified live against the running DB
   via `pg_get_constraintdef`: the same 22 literals, `action_risk_pending` not among them.

Layer 2 is the load-bearing half: **fixing the Python list alone would move the failure from a
`ValueError` to a Postgres `23514` mid-run.** A durable fix requires a **migration** that extends the
CHECK.

## Why it matters

`blocking` for GOVERN-03, and it invalidates the phase's remaining human gate.

1. **The armed checkpoint — the entire GOVERN-03 deliverable — does not work.** An armed step never
   parks. It kills the run. There is no state in which a person is asked.
2. **G-4 #3 ("arm it and walk away") cannot pass, and would have cost the operator ~20 minutes to
   discover.** Its failure condition is *"the run advanced on its own, or the prompt survived but is
   unreachable"* — the real behaviour is worse than either: the run dies before anyone is asked.
3. **The fix collides with the phase's own zero-migration contract.** `185-SPEC.md` criterion 2
   asserts `git diff -- supabase/migrations` is 0 lines and the live head is still **113**, and the
   ROADMAP row for 185 states "**NO migration** (additive optional field in the WorkflowDefinition
   JSONB, not a column)". Extending the CHECK needs migration **114**. Phase 185 cannot close both
   honestly — either criterion 2 is amended, or GOVERN-03 ships broken.
4. **A phase left `active` under a `failed` run is an inconsistent ledger state**, which the run
   surface (Phase 188) will have to render. Fixing this now avoids baking the inconsistency into a
   view.

## Hypothesized cause

**Verified for mechanism; hypothesis only for how it escaped review.**

Plan `185-05` deliberately introduced `action_risk_pending` *for honesty*. The comment at
`harness_engine.py:700-711` argues the case well: announcing `gate_failed` on an armed pause "would
tell the ledger and the frontend that something went wrong when nothing did — and the audit ledger's
own vocabulary rule (consequence ≠ receipt) makes that a correctness defect, not cosmetics."

The irony is exact and worth recording: **the `else` branch, which writes the less honest
`gate_failed`, is registered and works. The more honest branch is the one that kills the run.** A
correctness improvement was made at the vocabulary layer without registering the new word at either
enforcement layer.

How it escaped: the new event is written through `write_audit`, and `185-05`'s tests must have
exercised the pause path against a mocked `pool`/`write_audit` — a real allow-list check never ran.
This is the **same failure class the file's own docstring already documents**
(`backend/app/db/workflows.py:943-948`): *"the first audit write of any live run raised
NotNullViolationError and killed the run before any phase executed (the bug was **mock-only-invisible
until the first live run** in Phase 092)."* The project has now hit mock-invisible audit-write death
twice, in the same function, for two different reasons. That argues for a structural guard, not
another careful review.

## Suggested routing

- **Fold into in-flight phase: 185.** GOVERN-03 is 185's requirement and it does not work. Closing 185
  with this open would mark the action-risk dial Complete against a checkpoint that crashes.
- **Requires a decision from the operator, not just a fix:** 185 forbade itself migrations. Options:
  (a) amend criterion 2 and ship migration 114 extending the CHECK (correct, but breaks a stated
  contract), or (b) have the armed pause reuse an already-registered kind and defer the honest
  vocabulary to the phase that ships the run surface (works today, but re-introduces exactly the
  dishonesty `185-05` set out to remove).
  **Recommendation: (a).** The zero-migration promise was a scoping convenience; the honest-pause
  vocabulary is a correctness property, and (b) knowingly ships the defect the phase existed to fix.
- **Add a structural guard regardless:** a test that asserts every `event_type` literal passed to
  `write_audit` anywhere in `app/services/` is a member of `_AUDIT_EVENT_TYPES`, and a check that
  `_AUDIT_EVENT_TYPES` equals the live CHECK constraint's literal set. Either would have caught this
  at author time, and the second would have caught the 092 bug too.

## Workarounds

- **None for the operator.** Do not arm an action-risk checkpoint on a workflow you intend to run —
  the run will die at that step. Authoring the dial in the panel is safe; only execution is affected.
- **For test purposes**, an unarmed workflow is unaffected — every other SC#10 row in this session
  ran clean.

## Reference / evidence links

- Failing run: `workflow_runs.id = 80c8823d`, chat run `runs.run_id = de405cd1`, thread
  `292d07b0-e04c-41e7-8ed9-beec5b72c3ec`; definition `sc10-armed-f77e72` (disposable test fixture).
- `backend/app/services/harness_engine.py:712-716` — the `action_risk_pending` write, and `:700-711`
  the comment explaining why it exists.
- `backend/app/db/workflows.py:56-80` — `_AUDIT_EVENT_TYPES`; `:951-955` — the raising guard;
  `:943-948` — the prior mock-invisible audit-write death, same function.
- Live `pg_get_constraintdef` on `harness_audit` — the 22-literal CHECK, verified 2026-07-31.
- `185-SPEC.md` criterion 2 + ROADMAP Phase 185 row — the zero-migration contract this collides with.
- [[BUG-260730-01]], [[BUG-260730-02]] — the other two defects this phase's UAT surfaced.
