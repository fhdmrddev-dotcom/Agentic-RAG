---
phase: 196-registry-backed-model-picker-canvas
plan: 01
subsystem: model-capability-registry
status: PAUSED-AT-CHECKPOINT
tags: [migration, emit_tier, model-registry, operator-control, A7-pin]
requires:
  - "supabase/migrations/119_workflow_phases_cancelled.sql (highest migration before this plan — confirmed)"
  - "supabase/migrations/053 (model_overrides_read_all SELECT RLS — no new policy needed)"
  - "backend/app/services/forced_emit.py::_RUNGS_BY_TIER (layer 2 of the A7 pin)"
provides:
  - "model_capabilities_overrides.emit_tier — nullable text + named CHECK (migration 120, AUTHORED; NOT YET APPLIED)"
  - "backend/tests/unit/test_196_emit_tier_two_layer_pin.py — the A7 three-layer equality pin"
affects:
  - "backend/app/config.py (Task 3, not yet started)"
  - "backend/app/api/admin.py (Task 3, not yet started)"
  - "frontend/src/lib/api.ts, frontend/src/components/admin/ModelRegistryTab.tsx (Task 4, not yet started)"
tech-stack:
  added: []
  patterns:
    - "migration 099 header shape (APPLY / THEN / CLOUD PARITY) + migration 081 inline enum CHECK"
    - "test_audit_event_registration.py pin shape: highest-numbered-migration-wins, comment-strip-before-match, both-direction equality, positive control over the SAME extractor, non-vacuity floor"
key-files:
  created:
    - supabase/migrations/120_model_capabilities_overrides_emit_tier.sql
    - backend/tests/unit/test_196_emit_tier_two_layer_pin.py
  modified: []
decisions:
  - "The CHECK is written as `emit_tier IS NULL OR emit_tier IN (...)` rather than a bare `IN`. A bare IN already admits NULL (NULL IN (...) is NULL, not false, so the CHECK is not violated), but relying on that is a silent property; the explicit form states the intent that all 37 shipped rows read NULL."
  - "The constraint is named inline on the ADD COLUMN (`CONSTRAINT model_capabilities_overrides_emit_tier_check`) so the pin test finds it BY NAME rather than by position."
  - "Idempotence of `ADD COLUMN IF NOT EXISTS ... CONSTRAINT ... CHECK (...)` is NOT claimed in the migration comment — it is proven by NEITHER shipped analog (099 has IF NOT EXISTS but no CHECK; 081 has the CHECK but no IF NOT EXISTS). The migration says so explicitly and defers to Task 2's live measurement."
metrics:
  tasks_completed: 1
  tasks_total: 4
  commits: 1
---

# Phase 196 Plan 01: Registry-Backed emit_tier Summary

⚠ **THIS PLAN IS PAUSED AT TASK 2, A `[BLOCKING]` OPERATOR CHECKPOINT.** This file is committed at
the pause deliberately, so Task 1's evidence — in particular the verbatim RED output, which cannot
be reproduced once Task 3 turns the pin green — survives a worktree teardown. Tasks 2, 3 and 4 are
NOT done. Do not read this as a completion record.

## What shipped in Task 1

`emit_tier` is authored as a real column and the guard that will keep its vocabulary honest exists
and has been **observed red for the right reason**.

- `supabase/migrations/120_model_capabilities_overrides_emit_tier.sql` — nullable `text`, no
  `NOT NULL`, no `DEFAULT`, plus the named CHECK `model_capabilities_overrides_emit_tier_check`
  admitting `NULL` or exactly `force_strict` / `force` / `coerce`. `119_workflow_phases_cancelled.sql`
  was confirmed to be the highest-numbered migration before committing to `120`.
- `backend/tests/unit/test_196_emit_tier_two_layer_pin.py` — the A7 pin, three-way where all three
  layers exist.

## The RED output, verbatim (Task 1)

Recorded because a guard whose control was never observed red is not evidence. Command:

```
cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/test_196_emit_tier_two_layer_pin.py -q
```

```
F..                                                                      [100%]
================================== FAILURES ===================================
__________ test_a7_emit_tier_vocabulary_is_equal_across_three_layers __________
>       assert patch_set is not None, (
E       AssertionError: LAYER 3 IS MISSING: app.api.admin._MODEL_CAP_ENUM_COLUMNS['emit_tier'] does not exist, so the PATCH path has no enum guard at all. Every value the database's CHECK (120_model_capabilities_overrides_emit_tier.sql) would reject reaches Postgres as a raw 23514 instead of a 422, and every value it ACCEPTS is written unvalidated against the ladder in forced_emit._RUNGS_BY_TIER. Add the constant beside _MODEL_CAP_INT_COLUMNS / _MODEL_CAP_BOOL_COLUMNS and validate it in set_model_capability's guard loop.
E       assert None is not None

tests\unit\test_196_emit_tier_two_layer_pin.py:164: AssertionError
=========================== short test summary info ===========================
FAILED tests/unit/test_196_emit_tier_two_layer_pin.py::test_a7_emit_tier_vocabulary_is_equal_across_three_layers
1 failed, 2 passed, 1 warning in 3.38s
```

⚠ **`1 failed, 2 passed` is the shape that matters, not `1 failed`.** The two passing tests are the
positive control and the read-time-default check, and both run the SAME extractor over the SAME
migration. So the red is provably about the missing third layer and NOT about a parser that stopped
matching — which is the failure a lone red assertion could not distinguish. The failure sentence
names the missing layer and the file to fix, by design: layer 3 is returned as `None` rather than
raised, so a bare `ImportError` collected before any assertion can never stand in for the finding.

## Deviations from Plan

None in Task 1 — authored as written.

One observation worth recording rather than a deviation: the migration's own header prose contains
the words `CONSTRAINT ... CHECK (...)` inside a `--` comment (the idempotence caveat the plan asked
for). That makes the header a candidate match for the pin's body regex, so SQL line-comment
stripping is not merely inherited habit from `test_audit_event_registration.py` here — it is
load-bearing against this specific file. The positive control asserts it directly by planting a
`'decoy_tier'` literal inside a comment and requiring it to be absent from the parse.

## Owed / not performed

- **Task 2 — operator action, BLOCKING.** Migration 120 is authored but **NOT applied to any
  database**. No agent may apply it: CLAUDE.md forbids `supabase db push` / `supabase db reset`.
- **Cloud parity OWED — paste 120 into the cloud SQL editor at promotion.** Operator-gated, NOT
  performed, and it must land in the same operation as any deploy of this code.
- Tasks 3 and 4 not started.

## Self-Check: PASSED

- `supabase/migrations/120_model_capabilities_overrides_emit_tier.sql` — FOUND
- `backend/tests/unit/test_196_emit_tier_two_layer_pin.py` — FOUND
- commit `b9642dbd` — FOUND
