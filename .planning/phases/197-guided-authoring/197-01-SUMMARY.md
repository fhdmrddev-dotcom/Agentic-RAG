---
phase: 197-guided-authoring
plan: 01
subsystem: testing
tags: [characterization-baseline, vitest, count-gate, numstat, g-5-ledger, d-05]

# Dependency graph
requires:
  - phase: 193.1
    provides: "WorkflowBuilderPage.preDraft.baseline.test.tsx — the six-row whole-container capture of the GOVERN door's pre-draft describe screen"
  - phase: 193
    provides: "WorkflowDoorSwitch.baseline.test.tsx — the LOOSE door's half of the same capture"
  - phase: 187
    provides: "WorkflowBuilderPage.describe.test.tsx FLAG_OFF_DESCRIBE_MARKUP — the CTA-group byte pin that predates this phase by ten"
provides:
  - "The phase base SHA as a 40-char hex literal, so every later wave's numstat criterion has a fixed left-hand side"
  - "Three pre-change baseline verdicts, quoted verbatim, proving the D-05 fence was green BEFORE any source byte moved"
  - "Four gate baselines (count gate, tsc, backend pytest) measured on this tree rather than inherited"
  - "Six re-derived G-5 ledger triples for the files this phase touches"
  - "Four standing numstat deletion criteria + two named exclusions, as runnable commands"
affects: [197-02, 197-03, 197-04, 197-05, 197-06, 197-07, 197-08, 197-09, 197-10, 197-11, wave-merge, phase-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Measurement-only wave-0 plan: files_modified is empty by design; the deliverable is a recorded criterion"
    - "A red line expressed as a runnable `git diff --numstat <base-sha> HEAD -- <path>` command, not a judgement"

key-files:
  created:
    - ".planning/phases/197-guided-authoring/197-01-SUMMARY.md"
  modified: []

key-decisions:
  - "The D-05 fence is the SHIPPED 193.1/193 baselines, not a new capture — a capture taken now would postdate this phase's own context"
  - "The four numstat criteria run at every wave merge AND at phase close, not only once"
  - "WorkflowBuilderPage.header.test.tsx and scripts/vitest-count-gate.cjs are EXPLICIT exclusions from the zero-deletion rule"

patterns-established:
  - "Record the base SHA as a literal, never as a description — this project's numbers have rotted three times, once in a single day"
  - "Every inherited figure is re-derived with its own command beside it in the SUMMARY"

requirements-completed: [AUTH-02]

# Metrics
duration: 39min
completed: 2026-08-18
---

# Phase 197 Plan 01: D-05 Red Line + Pre-Change Baselines Summary

**The phase base SHA, three green pre-draft baseline verdicts, four re-measured gate baselines, six re-derived G-5 triples and four runnable zero-deletion numstat criteria — recorded before a single source byte changed.**

## Performance

- **Duration:** 39 min
- **Started:** 2026-08-18T10:12:00Z
- **Completed:** 2026-08-18T10:51:00Z
- **Tasks:** 3
- **Source files modified:** 0 (by design — `files_modified: []`)

---

## THE PHASE BASE SHA

```
52e6bcdb8a28b2cda1e3fa06a1bc95b733dbee07
```

`git rev-parse HEAD`, run in this worktree after the dispatched-base assertion. This is the
**literal** left-hand side of every numstat criterion below. Do not re-derive it, do not describe
it — substitute it.

Subject line of that commit:
`docs(state): 197 PLANNED — 11 plans, checker passed, three upstream claims measured false`

---

## Task 1 — The three shipped pre-draft baselines, GREEN at the base SHA

Command, run from `frontend/`, one invocation, cap honoured:

```bash
GSD_VITEST_MAX_WORKERS=2 npx vitest run \
  src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx \
  src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx \
  src/pages/WorkflowBuilderPage.describe.test.tsx
```

**Verdict, verbatim:**

```
 RUN  v4.1.0 C:/Vibe Apps/Agentic RAG/.claude/worktrees/agent-a25259e72fdf56965/frontend

 Test Files  3 passed (3)
      Tests  69 passed (69)
   Start at  10:13:42
   Duration  46.54s (transform 25.69s, setup 8.35s, import 32.46s, tests 3.12s, environment 60.59s)
```

**failed 0.** All three suites named in the plan are covered by that one run:

| # | Suite | Door | What it fences |
|---|---|---|---|
| 1 | `frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx` | GOVERN | six whole-container captures (flagOff/flagOn × empty/composing/error) of the `describeScreen`; the only `/generate` caller in the app |
| 2 | `frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx` | LOOSE / fast | the near-identical second pre-draft screen; its CTA is a HANDOFF and makes no network call |
| 3 | `frontend/src/pages/WorkflowBuilderPage.describe.test.tsx` | GOVERN | `FLAG_OFF_DESCRIBE_MARKUP` at `:307` — a byte-exact literal of the CTA GROUP ALONE, captured in Phase 187 wave 1 |

⚠ **Both screens contain the literal splice anchor `<div className="flex flex-col items-center gap-3">`**
(`WorkflowDoorSwitch.tsx:300` and `WorkflowBuilderPage.tsx:1579`). The class string cannot tell
them apart, so a later plan that splices "at the CTA group" can land on the wrong one. Suite 1
disambiguates by IMPORT and by pinning `starter-door-trigger`, a node that exists ONLY on the
GOVERN screen.

### Why no new capture was authored

The plan is explicit and this executor obeyed it: **no second baseline file was created.** The
shipped fence predates this phase by four phases (193 / 193.1 / 187). A capture taken today would
postdate `197-CONTEXT.md` and would manufacture the exact *"a capture and the assertion that guards
it drift apart"* condition the fence's own docblock (`:250-262`) names — the file deliberately has
ONE `capture` helper so the captured strings and the asserting `expect`s cannot diverge.

### The deletion history of the fence — "exactly once, deliberately"

`git log --numstat --format='%h %ad %s' --date=short -- frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx`

| commit | date | ins | **del** | subject |
|---|---|---|---|---|
| `f434d43c` | 2026-08-18 | 3 | **0** | `feat(196-08): AUTH-04 is real — four free-text model boxes become four gated pickers` |
| `0a2742a3` | 2026-08-15 | 54 | **6** | `test(193.1-08): both re-captures DECLARED — and the plan's "two rows" is measured as four` |
| `02606a08` | 2026-08-15 | 120 | **0** | `feat(193.1-07): the wire AND the bind, in ONE commit — D-19 is indivisible` |
| `517ad56d` | 2026-08-14 | 61 | **0** | `test(193.1-01): pin the /generate request body as a KEY SET before the wire grows` |
| `594fdc8d` | 2026-08-14 | 438 | **0** | `test(193.1-01): capture the pre-draft describe screen on the UNMOVED tree` |

Five commits, **6 deletions total, all in one commit — and that commit's own subject contains the
word `DECLARED`.** That is the precedent the D-05 criterion below encodes: deletions are not
forbidden, they are *declared, dated and reasoned in the plan that makes them*. A silent deletion
is the failure mode.

`git status --short` after this task: **empty.** No file under `frontend/`, `backend/` or
`scripts/` was touched.
