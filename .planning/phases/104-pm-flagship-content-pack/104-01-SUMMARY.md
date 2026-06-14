---
phase: 104-pm-flagship-content-pack
plan: 01
subsystem: content
tags: [docxtpl, python-docx, jinja2, template-fill, risk-register, pm-pack, synthetic-corpus]

# Dependency graph
requires:
  - phase: 097-spike
    provides: "proven docxtpl tag conventions (single-run paragraphs/cells, {%tr%} 3-row loop) + Project Meridian corpus material + worded->numeric Score mapping (Cond 3)"
  - phase: 101.1
    provides: "the flat EmitFieldMap shape + parse_docx_template_variables docx oracle the templates' tags must satisfy"
  - phase: 102
    provides: "the validation-gate library (citations_required / output_file_valid) the seeded defs will attach (Plan 02)"
provides:
  - "Two docxtpl templates under scripts/pm-pack/templates/ (weekly-status-report.docx, risk-register.docx) the headline template-fill workflows render against"
  - "weekly-status-report.docx exposing the 8 named EmitFieldMap scalar keys (project_name, reporting_period, overall_rag_status, summary, accomplishments, planned_next, risks_blockers, milestones)"
  - "risk-register.docx: 9-col {%tr for r in rows %} table, 8 model-emitted cited columns + an INLINE Jinja P×I Score (no model field, no backend code)"
  - "A synthetic 'PM Demo Project' corpus (5 markdown docs) with cited-able spans for every non-null status/risk field + 7 worded-P/I risks"
  - "Two reproducible builders (make_pm_corpus.py, make_pm_templates.py) Plan 02's seed script consumes"
  - "A template-shape oracle test proving placeholders present + the inline worded->numeric Score renders 6 (High×Medium) / 0 (unmapped)"
affects: [104-02-seed-script, 104-03-verification, pm-flagship-scoreboard, template-fill]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline-Jinja driver-compute in the template (P×I via dict-lookup + multiply) instead of a backend numeric_hook — the score is derived from the SAME cited cells the model emits, rendered in docxtpl's SandboxedEnvironment, with zero backend change"
    - "docxtpl {%tr%} 3-row table loop authored programmatically with python-docx (Pitfall-4-safe single-run cells), mirroring spike-097"
    - "Test fixture _cell() mirrors production build_context _cell() dict shape verbatim so a passing render proves the live render path"

key-files:
  created:
    - "scripts/pm-pack/make_pm_corpus.py"
    - "scripts/pm-pack/make_pm_templates.py"
    - "scripts/pm-pack/templates/weekly-status-report.docx"
    - "scripts/pm-pack/templates/risk-register.docx"
    - "scripts/pm-pack/sample-corpus/project-charter-source.md"
    - "scripts/pm-pack/sample-corpus/weekly-meeting-notes-w1.md"
    - "scripts/pm-pack/sample-corpus/weekly-meeting-notes-w2.md"
    - "scripts/pm-pack/sample-corpus/sprint-task-log.md"
    - "scripts/pm-pack/sample-corpus/risk-log.md"
    - "backend/tests/unit/test_pm_pack_templates.py"
  modified: []

key-decisions:
  - "Risk Register Score is an INLINE Jinja expression (Low=1/Med=2/High=3, P×I) NOT {{ r.score }} — prod build_context applies no numeric_hook so a bare deref renders blank; the inline expression derives the score from cited probability/impact in the SandboxedEnvironment with zero engine code"
  - "Corpus authored as markdown (per RESEARCH Q4) — ingests byte-identically and is simplest to author; 5 docs ≈ 5 embedding calls at seed time"
  - "Corpus deliberately NOT padded to a 0% decline-rate (some fields like a numeric 'Score' or fine-grained metrics are intentionally absent) — a healthy decline-rate signals honest grounding, not invention"

patterns-established:
  - "Inline worded->numeric template compute: keep deterministic non-LLM derivations in the template Jinja, not the shared engine, when the prod render context applies no hook"
  - "Reproducible content builders live under scripts/<pack>/ (off the uvicorn --reload watched backend/ tree); the .docx artifacts are committed binaries"

requirements-completed: [PM-01]

# Metrics
duration: 22min
completed: 2026-06-14
---

# Phase 104 Plan 01: PM Flagship Content Pack — Templates & Corpus Summary

**Two docxtpl PM templates (weekly status report + a 9-column risk register whose Score is an inline P×I Jinja expression, not backend code) plus a 5-doc synthetic "Project Meridian" corpus and a template-shape oracle test — the content the headline template-fill workflows render and cite against, with ZERO engine code.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-06-14T19:32:00Z (approx)
- **Completed:** 2026-06-14T19:54:50Z
- **Tasks:** 3
- **Files modified:** 10 created (2 builders, 2 docx templates, 5 corpus docs, 1 test)

## Accomplishments
- Built `weekly-status-report.docx` exposing all 8 named EmitFieldMap scalar keys (verified via the live `parse_docx_template_variables` oracle).
- Built `risk-register.docx` — a `{%tr for r in rows %}` 9-column table where the model emits 8 cited columns and the **Score** cell is an inline Jinja P×I expression (Low=1/Med=2/High=3) that renders a non-blank score from WORDED inputs with no backend `numeric_hook`.
- Authored a 5-doc synthetic "PM Demo Project (sample data)" markdown corpus (Project Meridian: charter source, 2 weekly meeting notes for freshness, a sprint/task log, a 7-risk log) with cited-able spans for every non-null field the status report + risk register fill.
- Wrote a 4-test template-shape oracle proving placeholders present, no bare `{{ r.score }}`, and the live render produces Score "6" for High×Medium and "0" for an unmapped value — fixture shape provably matches `build_context`'s dict output.

## Task Commits

Each task was committed atomically:

1. **Task 1: Weekly Status Report template + synthetic corpus** — `2fd1fff3` (feat)
2. **Task 2: Risk Register template with inline P×I Score** — `b5844629` (feat)
3. **Task 3: Template-shape oracle test (TDD)** — `f04f53de` (test)

**Plan metadata:** (this commit) — docs: complete plan

_Note: Task 3 is `tdd="true"`. The "implementation under test" (the two `.docx` templates) was shipped by Tasks 1-2, so the test went GREEN on first run. Per the TDD fail-fast rule, a passing test against a pre-existing artifact was investigated: the templates ARE the deliverable this test pins, and the test's render-and-assert (not just a static grep) genuinely exercises the inline-Score behavior — confirmed it fails if the Score expression is broken. Recorded under "TDD Gate Compliance" below._

## Files Created/Modified
- `scripts/pm-pack/make_pm_corpus.py` — reproducible builder for the 5-doc synthetic corpus.
- `scripts/pm-pack/make_pm_templates.py` — reproducible python-docx builder for both templates (`build_status_report()` + `build_risk_register()`).
- `scripts/pm-pack/templates/weekly-status-report.docx` — 8 scalar tags under labeled headings.
- `scripts/pm-pack/templates/risk-register.docx` — 9-col `{%tr%}` table + inline P×I Score.
- `scripts/pm-pack/sample-corpus/project-charter-source.md` — project name, sponsor, objectives, scope, SR-01..03.
- `scripts/pm-pack/sample-corpus/weekly-meeting-notes-w1.md` — Week 8 (GREEN, earlier period for freshness).
- `scripts/pm-pack/sample-corpus/weekly-meeting-notes-w2.md` — Week 9 (AMBER, the latest period — summary/accomplishments/planned-next/risks).
- `scripts/pm-pack/sample-corpus/sprint-task-log.md` — task status, planned next, Week 11/13/18/24 milestones + metrics.
- `scripts/pm-pack/sample-corpus/risk-log.md` — 7 risks (M-01..M-07), each with worded probability + impact + owner + mitigation + status.
- `backend/tests/unit/test_pm_pack_templates.py` — 4-test template-shape + live-score-render oracle.

## Decisions Made
- **Inline-Jinja Score, not `{{ r.score }}`** (D-104-4): the production render context is the sandbox-inlined `build_context` (`tool_dispatcher.py:1225-1240`) which applies NO `numeric_hook` — a bare `{{ r.score }}` would render blank in prod. The Score is therefore an inline dict-lookup-and-multiply expression over the cited `r.probability.value` / `r.impact.value`, case- and synonym-tolerant (`|trim|lower`, `.get(..., 0)`), rendered in docxtpl's `SandboxedEnvironment(autoescape=True)`. Zero backend change; derived deterministically from cited values.
- **Markdown corpus** (RESEARCH Q4): simplest to author, ingests byte-identically to a human upload; small (5 docs) to bound seed-time embedding cost.
- **Two weekly-notes periods (Week 8 GREEN → Week 9 AMBER):** gives the freshness gate two versions to reason over and makes the latest reporting period unambiguous.

## Deviations from Plan

None - plan executed exactly as written. No file under `backend/app/**` was modified; no new migration; no engine code. The only `backend/` write is the test under `backend/tests/unit/`.

## TDD Gate Compliance

Plan task type is `tdd="true"` (Task 3) within an `execute`-type plan (not a plan-level `type: tdd`). The RED gate is implicit: the templates this test pins were built in Tasks 1-2 (committed `2fd1fff3` / `b5844629`) before the test (`f04f53de`). The test went GREEN on first run because the artifacts already existed. Per the fail-fast rule, this was investigated and is correct for this content phase — Task 3 is a verification oracle over data artifacts, not a behavior to grow test-first. The test is a genuine render-and-assert (it renders the risk template through the production docxtpl + SandboxedEnvironment driver and asserts the rendered Score cell equals "6" / "0"), so it would fail if the inline Score expression regressed. Tasks 1-2 carry `feat(...)` commits; Task 3 carries the `test(...)` commit.

## Issues Encountered
- **python-docx output is not byte-deterministic across re-runs** (the `.docx` zip embeds non-deterministic internal ordering/metadata), so re-running `make_pm_templates.py` shows the two `.docx` files as modified in the working tree even though their Jinja content is identical. Resolved by `git checkout --` on the two template files after the final verification re-run so the working tree matches the committed artifacts. The committed templates are validated by the passing test. (Not a defect — a builder reproducibility property worth noting for Plan 02's seed script, which uploads these committed bytes to Storage.)

## User Setup Required
None - no external service configuration required for this plan. (Plan 02's seed script will require an embedding key configured in `backend/.env` to ingest the corpus.)

## Next Phase Readiness
- The two `.docx` templates + 5 corpus docs are committed and ready for Plan 02's seed script (`scripts/seed-pm-pack.py`) to upload to Storage (`{demo_user_id}/_library/<slug>.docx`) and ingest into the per-account demo folder.
- The status template's 8 scalar keys + the risk template's 8 cited columns are the contract the seeded `llm_emit` defs' field-map emission must cover.
- The inline P×I Score is proven to render non-blank from worded inputs (the D-104-4 acceptance bar) with zero engine code.

## Self-Check: PASSED

All 10 created files verified present on disk; all 3 task commits (`2fd1fff3`, `b5844629`, `f04f53de`) verified in git history. The 3 plan `<verification>` commands all pass (corpus builder writes 5 docs; templates builder writes 2 docx re-opening clean; `pytest tests/unit/test_pm_pack_templates.py` is green — 4 passed, deterministic on a second run). No `backend/app/**` file modified; no new migration.

---
*Phase: 104-pm-flagship-content-pack*
*Completed: 2026-06-14*
