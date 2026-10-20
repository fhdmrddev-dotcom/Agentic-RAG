# Phase 286: Seams Before Features - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-10-18
**Phase:** 286-seams-before-features
**Areas discussed:** Which files get cut, workflows.py split shape, Frontend seams to take, Proof of "behaviour unchanged"; plus plan shape.

---

## Which files get cut

| Option | Description | Selected |
|--------|-------------|----------|
| The 4 candidates only (Recommended) | workflows.py, RunPage, Card, Builder; others get written reasons | ✓ |
| 4 candidates + publish_service.py | 5th plan, bigger risk surface | |
| 3 only: drop Builder | defer Builder with a reason | |

**User's choice:** The 4 candidates only.

## workflows.py split shape

| Option | Description | Selected |
|--------|-------------|----------|
| Models/pure logic out, patched handlers stay (Recommended) | Zero test edits; 44 patch sites untouched | ✓ |
| Full sub-router split, rewrite patch targets | ~44 patch edits across 25 test files | |
| Models + pure logic only, no handler moves | smallest win | |

**User's choice:** Models/pure logic out, patched handlers stay.
**Notes:** Driven by the measurement that 25 test files patch `app.api.workflows.<name>`.

## Frontend seams (Builder)

| Option | Description | Selected |
|--------|-------------|----------|
| Lookups hook + copy leaf (Recommended) | save/concurrency seam already taken in 186-07 | ✓ |
| Lookups hook only | | |
| Copy leaf only | | |

**User's choice:** Lookups hook + copy leaf. Card (overflow menu + armed delete) and RunPage (run read + poll) were stated as defaults and not contested.

## Proof of "behaviour unchanged"

| Option | Description | Selected |
|--------|-------------|----------|
| Full set, pins first (Recommended) | OpenAPI snapshot, AST identity, DOM captures, empty numstat on pins | ✓ |
| Existing suites + OpenAPI diff only | | |
| Full set, one end-of-phase verifier | | |

**User's choice:** Full set, pins first.

## Plan shape

| Option | Description | Selected |
|--------|-------------|----------|
| 4 plans, one per file, parallel worktrees (Recommended) | | ✓ |
| 3 plans | | |
| Only the 2 OWED ones | | |

**User's choice:** 4 plans, one per file, parallel worktrees.

## Claude's Discretion

Names of new modules/hooks and exact boundaries inside the agreed seams.

## Deferred Ideas

- Non-linear / parallel workflows (user recalled an earlier discussion): routed to SEED-295 and SEED-086 (VIS-01, Phase 290); not this phase.
- Extracting publish_service / harness_engine / phase_types / PublishGauntlet / WorkflowCanvas.
- Full sub-router split of workflows.py.
