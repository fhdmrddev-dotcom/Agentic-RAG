---
phase: 205-stateful-and-incremental-workflows
type: preflight
stage: discuss → plan boundary (reviewed BEFORE planning, not before execution)
reviewed: 2026-08-24
reviewer: Claude (validation pass over Gemini's CONTEXT.md)
context_commit: 7443ee59
verdict: PLAN — but D-01 and D-04 must change FIRST. Two findings are blockers and both are measured, not argued.
---

# Phase 205 pre-flight — read this before planning

The context is well-shaped and its instincts are right: it named the jsonb trap, owner scoping and
the single-plan constraint unprompted. **It is not being re-discussed.** What follows is what is
WRONG or MISSING, measured against the live database and the shipped code.

⚠ **This review is at the discuss→plan boundary, earlier than 204's was.** That is deliberate: two
of these findings would have become schema and behaviour if they reached a plan unchallenged.

## ✅ Verified correct — do not re-check these

| Claim | Evidence |
|---|---|
| `load_run_phases` exists | `backend/app/db/workflows.py:1320` |
| `_persist_output` exists | `backend/app/services/harness_engine.py:173` |
| jsonb defensive-parse pattern exists to copy | `load_run_budget` (`db/workflows.py`) — `isinstance(meta, str)` → `json.loads` → `isinstance(dict)` |
| Owner scoping is security-bearing on a service-role pool | correct, and the reason is that these queries BYPASS RLS — the `WHERE` is the only boundary |
| Single plan | correct, and it is 204's paid-for lesson |
| `db/workflows.py` is a G-5 hot file | 43 commits / 21 phases / 2194 lines |

---

## ⛔ G-1 · BLOCKER — `definition_id` scoping makes the living register RESET ON EVERY REPUBLISH

**D-01 says:** *"the most recent `status = 'completed'` run for the exact same published
`definition_id`."*

**Measured, live, just now:** republishing mints a **NEW `definition_id`** for the same workflow.

```
slugs with more than one definition id:
  pm-weekly-status-report            4
  meridian-risk-summary-good-cc99c1b7 3
  doc_qa_human                        2
  ephemeral-template-fill-101uat      2
  doc_qa_scoped_098uat                2
```

`workflow_definitions` carries `id`, **`slug`**, **`version`**, `status`, `created_by`. So under D-01
a weekly risk register **forgets everything the moment its author fixes a typo in a prompt and
republishes.** That is fatal to the feature's premise, and it would present as "the register
mysteriously reset" — a bug nobody could reproduce from the code, because the code is doing exactly
what D-01 says.

**The fix is a scoping decision the plan must make explicitly**, not a query detail:
- scope on the **stable workflow identity** (`slug`, owner-scoped) rather than `definition_id`; **or**
- carry an explicit lineage key on the definition and scope on that.

⚠ **Either way the plan must state what happens when the SHAPE changes.** If v2 of a workflow emits
different fields than v1, "read the prior run" is reading a different contract. The honest options are
to version the register or to degrade to cold-start — but the decision must be written down, because
silence here becomes a crash or a silently-wrong delta at runtime.

---

## ⛔ G-2 · BLOCKER — `workflow_runs` HAS NO `created_by` COLUMN, AND NO `output` COLUMN EITHER

**D-04 says:** *"Owner scoping is strictly enforced … (`created_by = $N` or org isolation)."*

**Measured — the actual columns:**

```
workflow_runs   -> id, thread_id, definition_id, status, current_phase_id, org_id,
                   created_at, updated_at, claimed_at, inputs, model, continues_used,
                   user_id, is_golden_run, definition_snapshot, metadata
workflow_phases -> id, workflow_run_id, phase_index, slug, status, output, org_id,
                   created_at, updated_at, started_at, completed_at
```

Two corrections:

1. **It is `user_id`, not `created_by`.** `created_by` belongs to `workflow_definitions`. A query
   written from D-04 verbatim raises `UndefinedColumn` — which is exactly the error this session hit
   twice while driving the 204 UAT, so it is a live footgun, not a hypothetical.
2. ⚠ **`workflow_runs` has no `output` column at all.** D-03's *"prior run's final deliverable
   output"* must therefore come from **`workflow_phases.output`**, joined on `workflow_run_id`.
   The plan must say so, because "the run's output" reads like a column that exists.

---

## ⛔ G-3 · THE JSONB TRAP IS NOT A PRECAUTION HERE — IT IS THE MAJORITY PATH, TODAY

D-04 correctly says to defend at the point of read. **It understates the problem by a lot.**

**Measured on the live DB, right now, AFTER migration 123:**

```
workflow_phases.output typeof:   string  532
                                 object   78
```

**87% of the rows this phase exists to read are STRING SCALARS.** And migration 123 did **not** fix
them — it repaired `workflow_runs.definition_snapshot` only (`grep -c workflow_phases` in that
migration returns **0**). The memory that "123 repaired it" is about a different column.

Consequences the plan must absorb:

- `output->>'text'` returns **NULL** on 532 of 610 rows. A read that does not unwrap the string first
  will find nothing and — because the honest render of "nothing" is a legitimate cold start — will
  look like a *first run* rather than a bug. **That is precisely how Phase 200's per-step count
  shipped dead on 484 of 484 rows and nobody could see it.**
- ⚠ **D-06's `deltas` block would be WRITTEN into that same column.** So the plan owes the WRITE side
  too: bind a plain dict, never `json.dumps` (the pool registers a jsonb codec). Getting the read
  right and the write wrong just adds a 533rd string scalar.
- **The plan should decide whether 205 repairs the existing rows** (a migration, the 123 pattern) or
  only defends the read. Defending the read is sufficient for correctness and is the cheaper call —
  but it must be a stated decision, because leaving 532 malformed rows in place is a choice.

---

## ⚠ G-4 · D-03's "last phase" CONTRADICTS THE SHIPPED DELIVERABLE-RESOLUTION RULE

**D-03 says:** the deliverable comes *"from the last phase of the prior completed run"*.

**Phase 200.2 shipped a different rule, and rejected that one BY NAME.** Verbatim from
`docs/HOT-FILE-LEDGER.md`:

> **THE ANSWER IS THE LAST SERVER-ORDERED ROW WITH A NON-EMPTY `deliverable_text` — three rules were
> available and two of them are wrong.** *The final row* fails on a run whose closing step emits a
> FILE while the step before it wrote the prose… *Any row with text* fails harder — **a `confirm`
> step carries `text` too, and it is a QUESTION.** Measured on real local data, verbatim: *"Does this
> draft answer your question? Add any corrections."*

So D-03 as written would feed **a file-emitting closing step's empty text**, or **the machine's own
question**, into next week's run as its baseline. Both wrong rules already have pinned test cases.

**The plan must reuse the shipped resolution**, not re-derive it. Two independent surfaces disagreeing
about what a run produced is the failure this repo has recorded repeatedly.

---

## ⚠ G-5 · `frontend/src/components/workflows/builder/` DOES NOT EXIST

`canonical_refs` names it for D-07/D-08. The workflow components are **flat** under
`frontend/src/components/workflows/` (with a `library/` subdirectory, no `builder/`). The real homes:

- workflow-level settings → `WorkflowBuilderPage.tsx` (⚠ **G-5 hot file, 51 / 17 / 2867**)
- the phase prompt editor + variable chips → `PhaseFormPanel.tsx` (⚠ **G-5, 24 / 11 / 1375**)

⚠ **`PhaseFormPanel.test.tsx` pins that panel's `useState` / `useMemo` / `useEffect` count at an
ABSOLUTE ZERO.** A variable-chip picker with its own open/closed state **cannot live in that file** —
two prior phases hit this and answered it with extractions (`FieldGuidance.tsx` at 199-06,
`StepCardSection.tsx` at 200-04) rather than re-baselining the pin. **D-08 must budget a new leaf
component**, or it will be discovered mid-execution.

---

## Missing from the context entirely

1. **No threat model.** Cross-tenant read of a prior run's deliverable is the obvious one and D-04
   half-names it. ⚠ **Standing criterion, and Phase 203 failed it:** every mitigation named in a
   plan's `<threat_model>` needs an actual test. 203 wrote three, implemented none, and every task
   still passed.
2. **No statement of how a stateful workflow behaves when the prior run FAILED MIDWAY** — D-01
   ignores non-completed runs, which is right, but a run that completed with a *partial* register is
   indistinguishable from a good one. Worth one sentence.
3. **`task_service.py` is not mentioned and may well be touched.** It fires **G-5 at nine phases with
   NO hot-file ledger row** — invisible to its own guardrail for its entire life. It is the sole home
   of `_stream_one_iteration` and `run_task_sub_agent`, so a change there lands in **chat** as well as
   workflows. If 205 touches it, it owes the ledger row in the same commit.
4. **No index decision recorded.** The context defers it to "Claude's discretion", but the resolution
   query runs on every stateful run; whatever the scoping key ends up being (G-1), the index should be
   named in the plan rather than left to execution.

## Execution notes for whoever plans this

- **ONE plan.** 204's two parallel waves were each green while two real defects sat at their seam.
- Gates: `backend\venv\Scripts\python -m pytest backend/tests/unit -q` phase-scoped (baseline ~67
  pre-existing failures — report only NEW ones), and for any frontend half
  `npx tsc --noEmit -p tsconfig.app.json` (**the bare `--noEmit` checks ZERO files**) plus
  `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root.
- **Verify by DRIVING a real run**, not by reading code. Both 204 defects were found that way and
  neither was visible to 106 passing tests.
