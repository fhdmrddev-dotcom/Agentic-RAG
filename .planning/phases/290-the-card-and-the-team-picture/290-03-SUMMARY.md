---
phase: 290-the-card-and-the-team-picture
plan: 03
subsystem: frontend/workflows (team picture render + canvas mount)
tags: [team-picture, canvas, read-only-view, hot-file, tdd]
requires:
  - teamModel.ts (deriveTeam, TeamModel / TeamStep / TeamGate / TeamLine) from 290-01
  - teamVocabulary.ts (every picture string) from 290-01
  - lib/phaseGlyph.tsx (phaseGlyph)
provides:
  - TeamPicture (read-only org chart, one SVG path per deriveTeam lines[] item, the ⌥ ledger)
  - TeamViewSwitch (the Steps | Team tablist)
  - WorkflowCanvas optional `team` prop + one Team early return
  - the builder's one `team` prop at its existing canvas call
affects:
  - 290-04 (ledger sections for WorkflowCanvas.tsx / WorkflowBuilderPage.tsx: the six spent items below)
tech-stack:
  added: []
  patterns: [measured SVG line layer over a CSS-grid layout, degenerate-path floor for jsdom, gated early-return view swap in a hot file]
key-files:
  created:
    - frontend/src/components/workflows/TeamPicture.tsx
    - frontend/src/components/workflows/TeamPicture.test.tsx
    - frontend/src/components/workflows/WorkflowCanvas.team.test.tsx
  modified:
    - frontend/src/components/workflows/WorkflowCanvas.tsx
    - frontend/src/components/workflows/WorkflowCanvas.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/components/settings/__tests__/connectionVerbFence.test.ts
decisions:
  - "The ⌥ ledger renders after the <figure> (inside the plane), so the caption can be the figure's <figcaption>; its stroke samples carry no data-line-kind, so the drawn-line set stays exactly lines[]"
  - "Phase glyphs render through createElement(Glyph, ...) (the StepChipLine.tsx idiom), because eslint react-hooks/static-components rejects <Glyph /> from a lookup"
  - "When a jump exists, the step row gets bottom padding so the absence line sits below the jump run instead of under it"
metrics:
  duration: ~45 min
  completed: 2026-10-21
  tasks: 2
  files: 6
---

# Phase 290 Plan 03: The Team Picture and the Steps | Team Switch Summary

The team picture now renders, read-only, from `deriveTeam`. It shows the orchestrator on top, the steps in run order with their gates nested under each one, and exactly one SVG path per `lines[]` item. You reach it from a `Steps | Team` switch in the canvas header, and the switch appears only when the builder passes the new `team` prop. The run page passes nothing, so it shows no switch, and the header there is byte-identical to the 290-01 pin.

## Base and commits

- **Plan base:** `753a2119c7c7f3b820dd62b007f2cb2b7ecbf379` (develop, includes merged 290-01 and 290-02). The worktree started on `17a064f2e`, and the branch check reset it to the base.
- `b2a3b2686` `test(290-03)`: failing tests for the team picture and its switch (Task 1 RED; the module did not exist)
- `70aad7dd0` `feat(290-03)`: the team picture, read-only, drawn from the definition (Task 1 GREEN)
- `eab0a97f8` `test(290-03)`: failing tests for the Steps | Team switch on the canvas (Task 2 RED: 5 failed / 2 passed. The 2 that passed were the no-prop arm and the run-page source fence, which are already true at base.)
- `969641970` `feat(290-03)`: Steps | Team switch on the canvas header (Task 2 GREEN)
- `75160a9ed` `fix(290-03)`: record the Steps | Team tablist as a reviewed carrier in the verb fence (Rule 3, found by the count gate)

## The six budget items spent in `WorkflowCanvas.tsx` (for the 290-04 ledger section)

The file was 1708 lines at base and is 1744 now (+39 / -3, comments included). `useState` went from 8 to 9 and `useMemo` stayed at 8.

| # | Item | Line(s) at HEAD |
|---|---|---|
| 1 | Optional prop `team?: { workflowName: string }` (docblocked), destructured after `session` | 668, 688 |
| 2 | `const [view, setView] = useState<"steps" \| "team">("steps")` | 1155 |
| 3 | `const teamShown = team !== undefined && view === "team"` | 1156 |
| 4 | Keyboard reorder effect: `\|\| teamShown` in the early return, plus `teamShown` in its deps (RESEARCH F-6) | 1160, 1216 |
| 5 | Header: `editable && !teamShown` on the left-side ternary, `teamShown ? TEAM_HEADER_HINT : "the plane pans · steps stay put"`, and one gated `{team ? <TeamViewSwitch …/> : null}` before the ⌥ toggle | 1269, 1284, 1289 |
| 6 | One early return `if (teamShown)` mounting `<TeamPicture>` under `{header}`, placed before the empty-draft return; all hooks stay above it | 1407-1419 |

Two imports were added (`TeamPicture, TeamViewSwitch`, `TEAM_HEADER_HINT`). There is no second hook, no memo and no other branch. The memo lives in `TeamPicture`.

`WorkflowBuilderPage.tsx`: +2 / -0 (a comment and `team={{ workflowName: … }}` built inline from `meta`). `useState` is unchanged at 20. `WorkflowRunPage.tsx`, `backend/` and `supabase/` all have an empty diff against the base.

## Verification

- **Task 1 suites:** `TeamPicture.test.tsx`, `teamModel.test.ts` and `governanceVocabulary.test.ts` gave 3 files / 309 tests passed. `eslint TeamPicture.tsx TeamPicture.test.tsx` exited 0.
- **Task 2 suites:** `WorkflowCanvas.team.test.tsx`, `WorkflowCanvas.test.tsx`, `WorkflowCanvas.editing.test.tsx`, `__tests__/WorkflowCanvas.headerPin.test.tsx`, `pages/WorkflowBuilderPage.canvas.test.tsx`, `pages/__tests__/WorkflowBuilderPage.seam286.pin.test.tsx` and `TeamPicture.test.tsx` gave 7 files / 384 tests passed.
- **Header pin proof:** `git diff --numstat 753a2119c HEAD -- …/__tests__/WorkflowCanvas.headerPin.test.tsx …/__snapshots__/WorkflowCanvas.headerPin.test.tsx.snap` is empty. Vitest re-saved both `.snap` files (the header pin and seam286) with LF endings, but `git diff` showed no content change. I restored each one by path with `git checkout -- <file>`, and neither was staged.
- **Hooks rules:** `node scripts/check-react-hooks-rules.cjs` reported no new rules-of-hooks violation. The two it reports are in `ToolCallPanel.tsx`, which was already there and is unrelated.
- **tsc set diff** (`tsc -p tsconfig.app.json --noEmit`, compared with line numbers stripped): HEAD has 63 errors. Base has 64: the same 63 plus one in `WorkflowCanvas.team.test.tsx`, which is the new suite's `team` prop checked against the base canvas. Nothing is new at HEAD (`comm -13` is empty).
- **eslint on the two modified source files:** I added no new error. The 3 errors reported are on lines I did not touch: `WorkflowCanvas.test.tsx:2132-2133` (unused `_`) and `WorkflowBuilderPage.tsx:308` (react-refresh only-export-components).
- **Acceptance greps:** `if (teamShown)` = 1; `team={{ workflowName` = 1. TeamPicture code lines have 0 hits for `dangerouslySetInnerHTML|innerHTML|@xyflow|@/lib/api|<button … team-(step|gate)`. `deriveTeam(` = 1, `typeof ResizeObserver` = 1, and `data-line-source` appears in the suite.
- **Count gate (wave full gate):** the final verdict is `count gate OK — 486/486 pinned files present, no per-file decrease, 0 failing` (total 11371, pinned total 10247, +1124). It took two runs:
  - **First run: VIOLATED, 1 failing test.** I took the failure from the gate's own persisted JSON report: `connectionVerbFence.test.ts` › "no element on either surface carries a selectable ARIA role at all", with `expected [ …(2) ] to deeply equal [ Array(1) ]`. That fence scans the `components/workflows` tree for `role="tab|radio|option"`. The new `TeamViewSwitch` tablist made it the second match, so the failure was caused by this plan and not inherited: at base `TeamPicture.tsx` does not exist and the fence passes. The settings tree also has an empty numstat against base, so the suite itself is provably unmodified apart from the fix below.
  - **Second run: OK**, after the fix (deviation 2).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] eslint `react-hooks/static-components` rejected `<Glyph />`**
- **Found during:** Task 1, eslint
- **Issue:** rendering `phaseGlyph(type)`'s result as JSX counts as "creating a component during render".
- **Fix:** I used `createElement(Glyph, { className, "aria-hidden": true })`, which is the house idiom in `library/StepChipLine.tsx:60`.
- **Commit:** `70aad7dd0`

**2. [Rule 3 - Blocking] The verb fence flagged the new tablist (outside `files_modified`)**
- **Found during:** the wave count gate
- **Issue:** `settings/__tests__/connectionVerbFence.test.ts` (211-05 SC#3) treats any new `role="tab|radio|option"` carrier in the settings and workflows trees as "a decision to review". UI-SPEC §2 requires `TeamViewSwitch` to be a `role="tab"` tablist.
- **Fix:** I reviewed it and recorded it on the same terms as the 294-04 `RerankEngineBlock` exemption. It is a switch between two views of one workflow, not a verb category, so it is exempted by path with a dated review comment. The fence's needle and its positive control are unchanged, and the exemption must still match a real carrier, so if the tablist is ever removed the fence will report it rather than absorb it.
- **Files modified:** `frontend/src/components/settings/__tests__/connectionVerbFence.test.ts`
- **Commit:** `75160a9ed`

**3. [Process] TDD commits split per task**
- Each task shipped as a RED `test(290-03)` commit followed by a GREEN `feat(290-03)` commit, not as one commit per task. The plan's two `feat` subjects are used verbatim for the GREEN commits.

**4. [Process] `CANVAS_SUBTREE_PATHS` length moved 3 → 4 in the same edit**
- I added `./TeamPicture.tsx` and changed the length pin together, instead of reading the value from a failing run first. Every existing canvas fence stayed green over the added source, so no fence needle was edited.

### Notes, not deviations

- **Session region:** in Team mode the session (bottom) region is absent by construction, because the early return renders only `{header}` and `<TeamPicture>`. The suite proves this for the notice region (a planted refusal disappears and comes back) and checks that `canvas-bottom-region` is absent. It does not mount a live `CanvasSession`, because `CanvasToolbar` throws outside a `BuilderStoreProvider`, the same constraint the existing canvas suites work under.
- **Scroll position:** as the plan recorded (RESEARCH A4), `<ReactFlow fitView>` re-fits when the plane remounts. Selection and unsaved edits survive because the page owns them. The F-6 test shows the selected step still reorders after a Team → Steps round trip.
- **graphify:** I did not run `graphify update .` in this worktree, because `graphify-out/` is tracked and shared. The orchestrator can refresh it after the merge.

## Known Stubs

None. The picture is wired to the builder's in-memory phases through the canvas.

## Threat Flags

None. No network, auth, file or schema surface was added. TeamPicture imports no API client (fenced), renders author text as JSX text or attributes only (a planted `<img onerror>` name and `<b>` criteria render literally), and is now covered by the canvas's `CANVAS_SUBTREE_PATHS` fences. T-290-11 is mitigated: the keyboard effect is gated on `teamShown`, with a Steps positive control.

## Self-Check: PASSED

- FOUND: all 3 created files (TeamPicture.tsx, TeamPicture.test.tsx, WorkflowCanvas.team.test.tsx)
- FOUND: commits b2a3b2686, 70aad7dd0, eab0a97f8, 969641970, 75160a9ed
