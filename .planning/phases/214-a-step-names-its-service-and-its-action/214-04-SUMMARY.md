---
phase: 214-a-step-names-its-service-and-its-action
plan: 04
subsystem: workflow-builder-layout
tags: [layout, grid-track, D-214-22, pin-in-lockstep, hand-off]
requires:
  - "D-214-22 (operator decision, 2026-08-28) — the clamp arm of sketch 214 §4's open fork"
  - "frontend/src/components/settings/ConnectionsTab.tsx:387 — the shipped spelling to copy"
provides:
  - "the builder form panel's open grid track as `clamp(480px, 38%, 640px)` — the SAME track Settings has used since Phase 213"
  - "a pin on the COLLAPSED 44px arm, which did not exist before"
  - "the room plan 214-07's per-argument source lane (sketch variant B, gutter and all) needs"
affects:
  - "plan 214-07 — builds the argument editor inside this widened track; three `400px` prose sites handed off to it explicitly"
  - "plan 214-15 — the phase-wide `grep -rn \"400px\" frontend/src` sweep, and the two stale hot-file ledger rows"
tech-stack:
  added: []
  patterns:
    - "one authoring panel track, spelled byte-identically in both surfaces"
    - "assert the LITERAL style string, never a computed width, when the value is a CSS function jsdom does not resolve"
key-files:
  created: []
  modified:
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/pages/WorkflowBuilderPage.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
    - frontend/src/components/workflows/WorkflowCanvas.composition.test.tsx
    - frontend/src/components/workflows/WorkflowCanvas.tsx
decisions:
  - "The 900px overflow case PASSES against the widened panel — recorded as an observed pass, and the `900 − 480 = 420` headroom is stated as arithmetic OVER that observation rather than as its cause."
  - "The recorded headroom uses the clamp's MINIMUM (480px), not its maximum, because that is the worst case the column must survive; the clamp only grows from there and `38%` of a 900px viewport is 342px, so 480 binds."
  - "Two prose mentions were re-worded to avoid the literal string `400px` even though they were historically truthful — the phase's acceptance is a mechanical grep, and a truthful mention would have read as a survivor to plan 214-15's sweep."
metrics:
  duration: ~35 min
  completed: 2026-08-28
  tasks: 2
  commits: 2
---

# Phase 214 Plan 04: The Builder Panel Joins Settings' Track Summary

The builder's push/split form panel moved off a fixed `400px` onto
`clamp(480px, 38%, 640px)` — byte-identical to the track Settings has shipped since Phase
213 — with its one real pin, one test rename, a new collapsed-arm pin, and every prose
mention in the five owned files changed in the same two commits.

## What shipped

| Task | Commit | What |
|---|---|---|
| 1 | `98503d1d7` | The open grid track widens; the pin at `WorkflowBuilderPage.test.tsx` changes in lockstep; a NEW case pins the collapsed `44px` arm; six prose mentions renamed |
| 2 | `e3fe03121` | `canvas.test.tsx:367` renamed with zero assertion changes; the 900px overflow case re-run and its measured outcome recorded; `WorkflowCanvas.tsx:1337` prose renamed |

## The re-run grep, in full

The plan's stated risk was *"a mention it did not know about"*. `grep -rn "400px" frontend/src`
was re-run **before any edit** and returned **27 lines**. Every one was already named by
D-214-22 or already out of scope — **no unknown site existed.** The post-plan sweep,
verbatim, with `components/settings` and `handleSpike` excluded exactly as the plan specifies:

```
frontend/src/components/workflows/ConnectionPicker.tsx:73:/** State 1. One dim line, no spinner — this is a 400px panel field, not a run surface. */
frontend/src/components/workflows/ConnectionPicker.tsx:433:   * reason: it re-issues the WHOLE connection list on every toggle inside a 400px panel
frontend/src/components/workflows/McpToolPicker.tsx:125:   * connection list on every toggle inside a 400px panel field, and the response IS the row.
frontend/src/components/workflows/McpToolPicker.tsx:521:              a 44px switch would read as the most important control on a 400px panel. The
frontend/src/components/workflows/PhaseFormPanel.tsx:30: * The fixed-width 400px right-side form panel that REFINES one phase of a draft
```

**Five lines, three files, and all three are plan `214-07`'s.** That is exactly the
predicted set — see the hand-off below.

## ⚠ THE HAND-OFF TO PLAN 214-07 — named here so it cannot fall between two plans

`ConnectionPicker.tsx:73,433` · `McpToolPicker.tsx:125,521` · `PhaseFormPanel.tsx:30` carry
`400px` prose and are **NOT in this plan's `files_modified`**. Plan `214-07` edits all three
for other reasons in the same phase and **owns making these five lines truthful**.

⚠ **`PhaseFormPanel.tsx:30` is the sharpest of the five** — it does not merely mention a
number, it asserts a *property*: *"The **fixed-width** 400px right-side form panel"*. After
this plan the panel is **not fixed-width**. That line is now false in two ways, not one, and
`214-07` must change the adjective as well as the number.

Re-checked by plan `214-15`'s phase-wide sweep, which after `214-07` must return only
`components/settings/*` (out of scope — that is the Settings panel, which already moved to
this clamp at Phase 213) and `test-utils/handleSpike.test.tsx` (an unrelated `height: 400px`).

## The overflow case: measured, not reasoned about

D-214-22 flagged `WorkflowCanvas.composition.test.tsx:234`'s arithmetic as written against a
400px panel. The plan gave two branches and required taking whichever the run gave.

**It gave the passing branch.** Both suites ran green against the widened track — `2 test
files passed, 174 tests passed` — and ran green a second time after the comment edits.
**No viewport constant was changed and no assertion was loosened.**

The recorded margin is `900 − 480 = 420` — the R12 column width minus the panel clamp's
**minimum**. The minimum is the right operand because it is the worst case the column must
survive: `38%` of a 900px viewport is 342px, so the clamp floors at 480 and only grows from
there as the viewport does.

⚠ **The comment states that as arithmetic OVER an observed pass, not as the reason for it.**
That distinction is load-bearing and is written into the source: this assertion is
**structural** — it walks declared inline widths in a renderer that lays nothing out — so it
never reads the panel at all and would have passed at any panel width. **A green run here is
NOT evidence that 900px is survivable in a browser.** Real overflow at 900px remains live
G-4 UAT, exactly as the original comment already said.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] Two truthful prose mentions still tripped a mechanical acceptance**

- **Found during:** Task 1 and Task 2 verification.
- **Issue:** The plan's acceptance is `grep -c "400px" <file>` is **0**, and the natural way
  to record a widening is *"widened from a fixed `400px` to …"*. Two such lines were written
  (`WorkflowBuilderPage.tsx:28`, `canvas.test.tsx:370`) — both historically **truthful**, both
  counted by the grep, and both would have read as survivors to `214-15`'s phase-wide sweep.
- **Fix:** Re-worded to *"off its old fixed pixel value"* / *"named the previous fixed pixel
  width"*. The history survives; the literal does not.
- **Why this is a fix and not a workaround:** the sweep cannot distinguish a stale mention
  from a historical one, and a sweep that must be read by a human to be interpreted is not a
  sweep. The value belongs in the git history and in this summary, not in a grep's blast radius.
- **Commits:** `98503d1d7`, `e3fe03121`.

**2. [Rule 3 — Blocking] The D-214-22 note could not sit where it was first written**

- **Found during:** Task 1.
- **Issue:** The note was first authored as `//` lines **between JSX attributes** in the
  `builder-grid` opening tag. That parses under Babel/TS, but it is a form the codebase does
  not otherwise use in an opening tag, and putting a load-bearing decision record somewhere
  fragile is the wrong trade.
- **Fix:** Folded into the existing `{/* … */}` block immediately above the element, where the
  sheet-divergence commentary already lives. Zero behavioural difference.
- **Commit:** `98503d1d7`.

No other deviations. No package was installed. No architectural change was needed, so Rule 4
was never entered.

## Verification

| Check | Result |
|---|---|
| `WorkflowBuilderPage.test.tsx` | **16 passed** — pinned baseline in `scripts/vitest-count-gate.cjs` is **15**, so **+1**, exactly the new collapsed-arm case |
| `canvas.test.tsx` + `WorkflowCanvas.composition.test.tsx` | **174 passed**, twice (once before the comment edits, once after) |
| `npx tsc --noEmit -p tsconfig.app.json` | **34 errors** — at the plan's stated ceiling, and **none in any of the five files this plan touched** (grouped by file: `useMessages.test.ts` 5, `ChatAreaMode.test.tsx` 4, `FilePreview.test.tsx` 3, `FilesSection.test.tsx` 3, `OrgProvider.test.tsx` 2, `SettingsPage.tsx` 2, `SkillFormDialog.tsx` 2, then 13 files at 1 each). Pre-existing baseline, untouched. |
| clamp spelling | `grep -o "clamp([^)]*)"` returns the single value `clamp(480px, 38%, 640px)` from **both** `WorkflowBuilderPage.tsx` and `ConnectionsTab.tsx` — byte-identical, spaces included |
| `44px` unchanged | `grep -c '"44px"'` is **1** at HEAD~2 and **1** now |
| rename changed no assertion | `git diff -- canvas.test.tsx \| grep -c "^[-+]\s*expect"` → **0** |
| `400px` in owned files | **0** in all five |

**The full `scripts/vitest-count-gate.cjs` was deliberately NOT run.** Per the parallel-executor
brief the orchestrator owns it at the post-merge gate, and per CLAUDE.md `count gate OK` is not
reliably reachable on demand — so the deterministic per-file evidence above is what this plan
offers as its acceptance. The expected per-file delta at that gate is
`WorkflowBuilderPage.test.tsx: 15 → 16 (+1)`, with **no** other pinned file changing.

## Observations, recorded rather than concluded

⚠ **`WorkflowBuilderPage.canvas.test.tsx` is one of SEED-171's five known-flaky suites and it
sat inside this plan's blast radius.** It was **green on the first run of both invocations**.
SEED-171's triage procedure was therefore never entered and the worker cap was never touched
(it held at `2` throughout, per CLAUDE.md).

**This is an observation, not proof of innocence.** SEED-171's own finding is that one green
sample proves nothing about a flaky suite. What *can* be said precisely: the only change to
that file was a **test title string and a four-line comment**, verified by
`git diff | grep -c "^[-+]\s*expect"` returning `0` — so the case's behaviour is
**provably unmodified**.

## Threat register outcome

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-214-04-01 | mitigate | **Discharged.** The pin changed in the same commit as the source and still asserts the literal style string. A comment beside the line records *why* — jsdom does not resolve `clamp()`, so a `getComputedStyle` check would be green-by-accident — so the guard cannot be "improved" into uselessness by a future reader. |
| T-214-04-02 | mitigate | **Discharged, on the passing branch.** The case was re-run rather than reasoned about; it passed; nothing was loosened and no viewport constant moved. The minimum viewport did **not** move. |
| T-214-04-03 | accept, with a named owner | **Accepted and owned.** Five lines, three files, all `214-07`'s — enumerated verbatim above, with `PhaseFormPanel.tsx:30`'s extra falsity (the word *"fixed-width"*) called out separately. |
| T-214-04-SC | mitigate | **Nothing installed.** No `package.json` or lockfile change in either commit. |

## G-5 disposition — both rows re-derived at execute time, and both are STALE

Per CLAUDE.md's recipe, run in this worktree at HEAD:

| File | Ledger cell | **Measured 2026-08-28** | Verdict |
|---|---|---|---|
| `frontend/src/pages/WorkflowBuilderPage.tsx` | 51 / 17 / 2867 | **54 / 22 / 2937** | ⚠ **STALE — G-5 FIRES** |
| `frontend/src/components/workflows/WorkflowCanvas.tsx` | 27 / 8 / 1565 | **31 / 9 / 1708** | ⚠ **STALE — G-5 FIRES** |

⚠ **The plan predicted `WorkflowBuilderPage.tsx` at `53 / 19 / 2927` and the real figure is
`54 / 22 / 2937` — the plan's own re-derivation had itself gone stale between planning and
execution, by three phases.** That is this ledger's recurring finding reproducing inside a
single phase, and it is recorded rather than quietly corrected. `WorkflowCanvas.tsx`'s phase
buckets measure `183 184 185 187 188 188.1 199 200 214` = **9**.

**Disposition: honoured by construction**, and the argument is stated rather than gestured at.
The diff on `WorkflowBuilderPage.tsx` is **one value inside one string literal plus comment
lines**; on `WorkflowCanvas.tsx` it is **one comment**. No control flow, no new state, no new
prop, no new import, no new export. The extraction each file is owed is neither performed nor
made harder, and neither file's responsibilities changed. **Both rows are corrected in plan
`214-15`'s single ledger commit**, which carries the CLAUDE.md row and the
`docs/HOT-FILE-LEDGER.md` section together per the same-commit sync rule — this plan does not
touch either file, because a ledger edited by four parallel worktree agents is a merge conflict
by construction.

## Known stubs

None. No placeholder, no empty-value default, no unwired component. This plan shipped one CSS
value, one new test case, one rename and truthful prose.

## Threat flags

None. No network endpoint, no auth path, no file access pattern, no schema change. The diff is
a CSS grid track and its assertions.

## What this plan hands forward

- **Plan `214-07`** now has the room the sketch's variant B needs. The gutter's binding property
  is unchanged and unmet by this plan: sketch SC#5 / BUILD-CONTRACT row 3 — the lane is a grid
  column that **widens** (`.arow` ships `grid-template-columns: 0 minmax(0,1fr)`, `.gutter-on`
  widens *that same column* to `118px`), **never inserted**, so a sourced and an unsourced row
  must have **identical** label-column offsets. ⚠ **If `214-07` ships without that gutter, the
  phase has paid the pin cost and shipped variant C — the arm the operator did NOT pick.**
  `214-07`'s gutter assertion is what makes that visible; this plan cannot see it.
- **Plan `214-15`**: two stale ledger rows (above) and the phase-wide `400px` sweep.

## Self-Check: PASSED

- `frontend/src/pages/WorkflowBuilderPage.tsx` — FOUND
- `frontend/src/pages/WorkflowBuilderPage.test.tsx` — FOUND
- `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` — FOUND
- `frontend/src/components/workflows/WorkflowCanvas.composition.test.tsx` — FOUND
- `frontend/src/components/workflows/WorkflowCanvas.tsx` — FOUND
- commit `98503d1d7` — FOUND
- commit `e3fe03121` — FOUND
