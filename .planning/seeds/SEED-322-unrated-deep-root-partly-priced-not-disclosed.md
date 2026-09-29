---
seed_id: SEED-322
title: An unrated Deep root whose sub-agents run on a rated model is disclosed as "excluded" while its sub-agent dollars are in the total
created: 2026-09-29
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The next phase that edits backend/app/db/rates.py or anything under frontend/src/components/admin/spend/ — or the first report of a newly added model used before its rate is registered.
trigger_paths: ["backend/app/db/rates.py", "frontend/src/components/admin/spend/**"]
trigger_surfaces: [admin]
migration_note:
relates_to: ["268", "D-268-21", "D-268-28", "268-REVIEW.md iteration 2 WR-02", "SEED-321"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-322: An unrated Deep root with priced sub-agents is still called "excluded"

## The finding

`per_root.cost_usd` in `backend/app/db/rates.py` sums every priced member of a root: the root plus its
sub-agents, each priced at its own rate (D-268-21). Whether a root counts as rated or unrated depends on the
**root's own** rate only.

The rates module's header notes that a sub-agent "may run on the provider's FAST default". So a **Deep** root on a
model with no registered rate, with sub-agents on a rated default model, has this shape:

- It counts in `unrated_runs_count`. The Unrated tile ("excluded from org dollar totals",
  `frontend/src/components/admin/spend/BlindSpotsCard.tsx`) and the KPI footnote ("… unrated excluded") both say
  that count is excluded.
- Its sub-agents' USD **is** in `total_spend_usd`, `window_total_usd` and its Expert line.

D-268-28 added an honest disclosure, `partly_priced_harness_runs`: "N harness runs partly priced — sub-agent costs
included, orchestrator cost not". It covers only **harness placeholder** roots, because the filter requires
`pr.is_box_shell`. So the page still makes a false "excluded" claim for the Deep-root population.

## Why it matters

The operator reads the Unrated count as dollars the total leaves out, but for these runs part of the money is in the
total. Anyone who picks a newly added model before an operator registers its rate can reach this. It was accepted at
268's close under the G-7 cap (operator ruling, 2026-09-29), not fixed.

## When to surface

- Any phase whose `files_modified` names `backend/app/db/rates.py` or a file under
  `frontend/src/components/admin/spend/`.
- The first time an operator reports an unrated-run count that does not reconcile with the total.

## Scope estimate

Small. The copy is operator-ruled, so the fix needs a ruling first. Two options:

- (a) Widen the count to `pr.input_cost_per_million IS NULL AND pr.priced_subagents > 0`, dropping `is_box_shell`,
  and give it a non-harness wording.
- (b) Keep the harness-only count and add a second counter for non-shell roots.

Either way, add a real-Postgres fixture row: an unrated non-shell root with one priced sub-agent, asserted
disclosed. The `per_root` CTE already carries `priced_subagents` and `is_box_shell`.

## Breadcrumbs

- 268-REVIEW.md iteration 2, **WR-02**: the finding, with both options.
- 268-REVIEW-FIX.md iteration 2, WR-05: the fixer named this gap ("no copy was ruled for it").
- `ff148c13f`: D-268-28's harness-only disclosure. `test_268_spend_rollup_pg.py` pins R8, the harness shell, only.
