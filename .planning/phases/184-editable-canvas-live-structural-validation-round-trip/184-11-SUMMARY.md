---
phase: 184-editable-canvas-live-structural-validation-round-trip
plan: 11
subsystem: workflows
tags: [composition, live-validation, governance-rails, publish-handoff, leave-guard, wr-09, 409-conflict, wave-7]

# Dependency graph
requires:
  - phase: 184-04
    provides: "`builderStore` — the per-mount temporal store whose untracked half holds the verdicts, whose `dirty` the leave guard reads, and whose `flushHistory()` is the dismissal commit seam"
  - phase: 184-06
    provides: "`useLiveValidation` — the ONE caller of `POST /workflows/validate`, with its `enabled` gate and its two degraded causes"
  - phase: 184-07
    provides: "`canvasNudge.readNudges` / `writeNudge` — the only home of browser storage on this surface"
  - phase: 184-08
    provides: "`verdictModel.groupVerdicts` / `markFor` / `DEGRADED_SENTENCE` — grouping and the two degraded sentences"
  - phase: 184-09
    provides: "`useGroundingBundle` + `PhaseFormPanel`'s optional `rails` prop"
  - phase: 184-10
    provides: "`WorkflowCanvas`'s editing half (`editable` / `marks` / `nudges` / `onNudge` / `onCommitNodes`) and `builderStore.commitCanvasNodes`"
provides:
  - "`WorkflowBuilderPage` as the ONE composition point — the live loop, the rails, the nudge and the verdict marks all arrive as hooks and leave as props"
  - "`PublishGauntlet.blockedReason` — an optional, absent-is-today's-behaviour prop that disables the trigger AND names the reason"
  - "`renderPublish`'s third argument — the publish-blocking reason, threaded through the EXISTING header seam (no net-new band)"
  - "`registerCanLeave` — the router-free unsaved-work leave guard, spanning `WorkflowsPage`'s breadcrumb and `beforeunload`"
  - "The WR-09 convergence: all three dismissal paths COMMIT and none of them PATCHes"
  - "`WorkflowBuilderPage.session.test.tsx` — 17 net-new session-edge assertions"
affects: [184-12, 184-13, 185, 186, 188]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A spread-conditional prop (`{...(cond ? { rails } : {})}`) when 'absent' and 'undefined' must be DIFFERENT observable states — a flag-off surface has to be missing the key, not carrying it empty"
    - "Converging three dismissal paths on ONE callback and then deciding, in one place, that a dismissal commits and never writes"
    - "Suppressing a button's focus transfer (`onMouseDown` preventDefault) to remove an INCIDENTAL side effect — the ✕ used to PATCH a version only because pressing it blurred a field"
    - "Reading a state with no rendered indicator through its user-visible CONSEQUENCE (the leave guard) rather than through a private field"
    - "Asserting a `beforeunload` listener by DISPATCHING the event and reading `defaultPrevented`, not by counting `addEventListener` calls — a registration spy passes on a handler that forgot to cancel"

key-files:
  created:
    - frontend/src/pages/WorkflowBuilderPage.session.test.tsx
  modified:
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.test.tsx
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/components/workflows/PublishGauntlet.tsx
    - frontend/src/components/workflows/PhaseFormPanel.tsx
    - frontend/src/components/workflows/WorkflowDoorSwitch.tsx

key-decisions:
  - "WR-09 is resolved the OTHER WAY from the 183 review's recommendation: a dismissal commits to the DEFINITION and writes nothing, rather than blurring so all three paths converge on the ✕'s incidental PATCH. Phase 184 has an explicit-save contract and now a leave guard, so the loss window that made a silent PATCH attractive is closed"
  - "The 409 is classified on the error's NAME, not `instanceof WorkflowConflictError` — the shipped `useLiveValidation.causeOf` idiom. No value import from the api client, so no shipped test's module mock had to grow a class"
  - "`blockedReason` is GATED ON THE CANVAS FLAG. Without that gate a flag-off empty draft would get a disabled Publish, which is a flag-off surface change (D-14 / D-181-01)"
  - "The gates rail derives at most ONE row and always LOCKED — a removable row would need a `validators` write seam this panel does not have, and a Remove button that cannot remove is the lie the row union exists to make un-representable"
  - "`toolOptions` falls back to the literal `\"degraded\"` for every non-`ready` bundle reading, including `loading`: an empty array claims the workspace offers nothing, and omitting the rail would put the free-text tools box back on screen, which R11 forbids"
  - "ONE forced assertion edit — the `Saved ✓` literal in `WorkflowBuilderPage.test.tsx` — enumerated in full below"

patterns-established:
  - "A positive control on an absence assertion caught a module-graph bug on its FIRST run: the flag-off `rails` assertion was passing vacuously because the provider came from a pre-`resetModules` graph"
  - "A `user-event` driver is the RIGHT choice when focus fidelity IS the mechanism under test — the ✕ zero-PATCH row goes red without the suppression precisely because user-event moves focus like a browser"

requirements-completed: []  # CANVAS-02 and CANVAS-03 are this plan's frontmatter requirements and NEITHER is complete — the ＋/✕ affordances (184-12) and the toolbar/tray (184-13) are still unbuilt. REQUIREMENTS.md deliberately untouched; the orchestrator marks all 5 at phase end.

# Metrics
duration: 55min
completed: 2026-07-27
---

# Phase 184 Plan 11: The Composed Authoring Session Summary

**The page is now the one composition point — the live loop runs only after the author's first real edit, its answer feeds the marks and (next plan) the tray from a single untracked store slice, the rails reach the panel through a prop that is genuinely ABSENT with the flag off, and publish blocks in the header it already had while NAMING the server's own first message — and all three D-184-16 session-edge debts are paid: an unsaved draft cannot be left by breadcrumb or by tab close without being asked, all three dismissal paths commit the pending value and none of them PATCHes a version any more (the ✕ used to, and only because pressing it moved focus), and a 409 finally says which row it is and how to get out of it. Persistence itself is byte-unchanged: one POST, then PATCHes, no autosave.**

## Performance

- **Duration:** ~55 min
- **Started:** 2026-07-27T12:12:00Z
- **Completed:** 2026-07-27T13:00:00Z
- **Tasks:** 3 (all `auto`)
- **Files created:** 1 · **Files modified:** 7

## Task Commits

| # | Commit | Type | What |
|---|---|---|---|
| 1 | `04d4f8f7` | feat | The composed session — Tasks 1, 2 and 3's SOURCE (page, gauntlet, panel, door shell, WorkflowsPage) |
| 2 | `53ceef65` | test | Task 1's proof — the R3 payload walk, the D-184-15 silence, the D-14 absent `rails` key |
| 3 | `6f04b987` | test | Task 2's proof — R12, a blocked publish that names a real reason in the existing header |
| 4 | `9524f308` | test | Task 3's proof — R6, D-184-03 and all three D-184-16 debts |

**Why four commits and not three, and why the first one is not one-task-shaped.** All three tasks edit `WorkflowBuilderPage.tsx`, and a commit is a whole-file snapshot. Splitting the source into three commits would have meant three commit messages each describing a fraction of what the tree actually contained at that commit — a lie about the working state, which is worse than a coarse-grained but accurate commit. So the source landed once, honestly described, and each task's PROOF landed as its own commit. Every commit is green on its own.

No commit deletes a tracked file (`git diff --diff-filter=D --name-only 04d4f8f7~1 HEAD` → **empty**).

---

## `<output>` REQUIREMENT 1: the captured api call log from the R6 session test

Verbatim, as the suite asserts it:

```
callLog === [
  "createWorkflowDraft",
  "updateWorkflowDraft",
  "updateWorkflowDraft",
]
```

Driven as a real session: describe → draft → **Save** (create) → edit → **Save** (patch) → edit → **Save** (patch). Two further assertions ride the same log:

- `mockUpdate.mock.calls.every(c => c[0] === "created-1")` — every PATCH targets the id the create returned, so no session can mint a second row.
- **The race version.** With the create held OPEN (an unresolved promise) and three save clicks fired back to back, `createWorkflowDraft` is still called **exactly once**. The shipped `creatingRef` guard is the thing that keeps the `UNIQUE(slug, version)` 500 off the table, and a test that let the first call settle first would be green on a page with no guard at all.
- **And the negative.** Three structural edits (`addPhaseOfType`, `reorderPhase`, `removePhaseBySlug`) dispatched straight at the store produce `callLog === []` — asserted 700 ms later, well past the coalescing window, so "zero" is not "not yet". **There is no autosave.**

## `<output>` REQUIREMENT 2: the exact `blockedReason` strings observed

| Case | Observed string (`toBe`, exact) | Trigger |
|---|---|---|
| **Empty draft** (0 phases, flag on) | `Add a step to get started` | `disabled`, `aria-describedby` → the reason element |
| **Verdicts, `ok:false`** — server returned an `incomplete` FIRST and an `error` second | `Nothing in this workflow produces a deliverable.` (the ERROR's message, verbatim) | `disabled` |
| **Degraded** (`WorkflowValidateUnreadableError`) | `We couldn't check this — the workflow's shape isn't something we can read yet.` | `disabled` |
| **`ok: true`** | — (no reason element in the DOM) | enabled, exactly as today |
| **Empty draft, flag OFF** | — (no reason element in the DOM) | enabled, exactly as today (D-14) |

The empty-draft case additionally asserts `validateWorkflow` was called **0 times**: the invitation is not a verdict, nothing was asked, and D-182-06's "one lint implementation, zero client-side re-implementation" is intact.

---

## Falsifications — 5 probes, 9 distinct reds, every one restored

An assertion that has only ever passed is not evidence.

| Probe | Reds | Restored |
|---|---|---|
| `flushHistory()` removed from `clearSelection` | 1 — *"a dismissal COMMITS the coalescing run"* | ✓ |
| The ✕'s `onMouseDown` preventDefault removed | 2 — *"the ✕ suppresses the focus transfer"* AND *"✕ — … ZERO PATCHes were issued"* | ✓ |
| `hasEdited` forced true | 1 — *"mounting a draft calls validateWorkflow ZERO times"* | ✓ |
| The guard's dirty branch replaced with `() => true` | 3 — the undo row, the dirty-guard row, and the end-to-end breadcrumb row | ✓ |
| `store.getState().markSaved()` removed from `onPersist` | 2 — the undo row and the `beforeunload` arm/disarm row | ✓ |
| `verdicts[0]` instead of error-first, AND the flag gate dropped from `blockedReason` | 2 — the ordering row and the flag-off D-14 row | ✓ |

`git diff --stat` on both probed source files returns **empty** after every restore, and `grep` confirms the probe strings are gone.

**The most informative probe** is the ✕ one. Removing the mousedown suppression turned the *zero-PATCH* row red as well as the mechanism row — which means `user-event` really does move focus in jsdom, the ✕ really did PATCH a version on every dismissal with a focused field, and the row is **not** green-by-construction. That is exactly the 183 review's WR-09-02 complaint ("the guard is attached to the wrong half of the contract"), now measured rather than argued.

**A second finding, from a positive control rather than a probe.** The D-14 `rails`-absence test uses `vi.resetModules()` + `vi.doMock` to read the panel's outgoing props. On the first run its POSITIVE CONTROL failed: the flag-ON case also reported no `rails` key. The cause was that the test rendered `EffectiveFeaturesProvider` from its top-level import — a DIFFERENT React context object from the one the freshly-imported page reads — so `useEffectiveFeaturesOptional()` returned null, `canvasEnabled` was false, and the absence assertion was passing **vacuously**. The provider is now imported from the same post-reset graph, and the reason is written at the seam.

---

## Verification Results

| Gate | Required | Observed |
|---|---|---|
| `node scripts/vitest-count-gate.cjs` | exit 0, no per-file decrease | **exit 0** — 16/16 pinned present, **every pinned delta 0**, 933 → **948**, **0 failing** |
| `npx vitest run …session.test.tsx` | 0 failures AND exit 0 | **17 passed, exit 0** |
| `npx vitest run …canvas.test.tsx` | the 22 shipped pass unmodified | **37 passed** (22 shipped + 15 net-new); `git diff --numstat` = **304 insertions, 0 deletions** |
| `npx vitest run src/components/workflows` + `revertByteIdentical` | 0 failures | **24 files / 896 passed** |
| `revertByteIdentical.test.tsx` | green at its pinned 7 | **7/7** |
| `PublishGauntlet.test.tsx` | 24, **file untouched** | **24 passed in isolation**, `git diff` on it is **empty** |
| `npx tsc -b \| grep -c "error TS"` | ≤ 33 | **33** — the `develop` baseline, and **none of the 33 names a file this plan touched** |
| `npx vite build` | exit 0 | **exit 0** |
| `git diff --exit-code -- 'frontend/src/**/__snapshots__/*'` | exit 0 | **exit 0 — byte-unchanged** |
| `npx eslint` on all 8 files | clean | **zero problems** (one `exhaustive-deps` warning was resolved with a documented disable — see Deviation 4) |
| `grep -cE 'localStorage\|sessionStorage\|aria-pressed\|reactflow' WorkflowBuilderPage.tsx` | 0 | **0** |
| `grep -c 'visual_workflow_canvas === true'` | ≥ 1 | **1**; the lazy import at its pinned shape is untouched |
| `grep -c 'grounding_mode' WorkflowBuilderPage.tsx` | 0 | **0** |
| `grep -c 'canvasEnabled ? { rails }'` | ≥ 1 | **1** |
| `git diff --name-only -- backend/ supabase/migrations` | 0 | **0** — slot 114 stays RESERVED |
| `frontend/package.json` / lockfile | absent from every commit | **absent** |
| `.planning/REQUIREMENTS.md` | untouched, all 5 REQ-IDs Pending | **untouched** |

### Full frontend suite — no NEW failures

```
npm test → Test Files 9 failed | 217 passed (226)
                Tests 23 failed | 2740 passed (2763)
```

The nine failing FILES are **byte-identical to the set 184-04 recorded**, and none is attributable to this plan:

| File | Verdict |
|---|---|
| `IngestionPage.test.tsx` · `MessageItem.test.tsx` · `Plan04.frontend.test.tsx` · `useMessages.test.ts` · `StreamsProvider.dedup.test.ts` · `streamsProvider.test.tsx` · `streamsProvider_075_9_clientkey.test.tsx` · `model-info.test.ts` | **Pre-existing SEED-056 vitest rot** — chat / streaming / ingestion / model-info. None imports anything this plan touched |
| `PublishGauntlet.test.tsx` | **The documented load-dependent 5 s timeout flake.** It passes **24/24 in isolation** (15.2 s; its heaviest test alone is ~2.5 s) and the count gate reports it at its pinned **24 with 0 failing** on every run. Named in 184-04 with the same evidence |

Nothing in either category was fixed: SEED-049 (Playwright) and SEED-056 (vitest rot) are named, not repaired, per the scope-boundary rule.

---

## The ONE forced assertion edit, with its full diff

Wave 0's zero-edit gate is complete, so a forced edit was permitted. **Exactly one was taken**, in `WorkflowBuilderPage.test.tsx` (pinned count unchanged at 15):

```diff
-  it("Save draft shows a transient 'Saved ✓' confirmation on success", async () => {
+  it("Save draft shows a transient 'Saved · still a draft' confirmation on success", async () => {
     mockUpdate.mockResolvedValue({})
     const { default: userEvent } = await import("@testing-library/user-event")
     const user = userEvent.setup()
     render(<WorkflowBuilderPage initial={{ definition: draft3, draftId: "draft-77" }} />)
     await user.click(screen.getByTestId("builder-save-draft"))
-    expect(await screen.findByTestId("builder-save-confirm")).toHaveTextContent("Saved ✓")
+    expect(await screen.findByTestId("builder-save-confirm")).toHaveTextContent(
+      "Saved · still a draft",
+    )
   })
```

**Why it was unavoidable.** The wording is operator-locked in `184-CONTEXT.md` `<specifics>` — *"the save state says 'Saved · still a draft' — no word implying published, ever"* — and this plan's own R6 acceptance requires the exact string. The shipped assertion pins the superseded Phase-103-ux literal. Only the LITERAL moved: the assertion's purpose (an explicit save produces a transient, visible, honest confirmation) is unchanged and still measured, and the count gate still reports 15.

**The 184-10 "second table beats an edited assertion" escape was tried first and rejected.** `Saved ✓ · still a draft` would have kept the old literal green as a substring (`toHaveTextContent` matches substrings) — but it would have shipped a wording nobody locked, and the exact locked string is what this plan's acceptance and any later grep look for. Asserting only the new qualifier would have stopped pinning the confirmation itself. The rationale is written into the test file as well as here, so a reader of the test does not have to come looking.

**Everything else was additive.** `git diff --numstat HEAD~4 HEAD` over all test files:

```
304  0  frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
613  0  frontend/src/pages/WorkflowBuilderPage.session.test.tsx
 21  2  frontend/src/pages/WorkflowBuilderPage.test.tsx
```

The two deletions are the two lines above. `PublishGauntlet.test.tsx`, `PhaseFormPanel.test.tsx`, `PhaseFormPanel.rails.test.tsx`, `WorkflowCanvas.test.tsx`, `WorkflowCanvas.editing.test.tsx`, `builderStore.test.ts` and `canvasModel.purity.test.ts` are all **untouched**.

### The mock-factory additions (not assertion edits, enumerated for completeness)

`WorkflowBuilderPage.canvas.test.tsx`'s `vi.mock("@/lib/api", …)` gained three symbols — `validateWorkflow`, `getGroundingBundle`, `publishWorkflow` — plus two `beforeEach` defaults and one hoisted block. A whole-module factory mock must enumerate every export the render path reaches or the hook calls `undefined` and the failure surfaces far from its cause. All are pure insertions (0 deletions).

**`canvasModel.purity.test.ts` was deliberately NOT touched.** The plan asks for "the shipped `forbiddenKeysIn` walk", which would mean exporting it — but importing one test module from another registers ITS `it(...)` blocks into the importing file too, doubling the per-file counts the gate exists to pin. The walk is therefore COPIED, with a comment saying why and a **positive control** proving the copy fires (a planted `position` key is found).

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WR-09 is resolved the OTHER WAY from the 183 review's recommended fix**

- **Found during:** Task 3
- **Issue:** 183-REVIEW-09's WR-09-01 recommends blurring the focused field before unmount, so Escape and pane-click converge on the ✕'s behaviour. Its own WR-09-02, and this plan's acceptance criteria, require **zero `updateWorkflowDraft` calls on all three dismissal paths**. Those two are not simultaneously satisfiable: `onBlur` IS the panel's persist seam, so a blur-based convergence makes every dismissal PATCH a version.
- **Fix:** converge the other way. All three paths already ended in `clearSelection`; that callback now (a) calls `store.getState().flushHistory()`, committing the coalescing config run so the sentence just typed is ONE undo entry that exists at dismissal time, and (b) releases the selection — and does nothing else. The typed VALUE was never at risk: every panel field is controlled and its `onChange` reaches `store.patchConfig` on the keystroke, not on the blur. What made the review's fix attractive was the loss window ("edit → Escape → leave the Builder with no further save"), and this plan closes that window with the leave guard and the dirty state instead of with a silent write.
- **Files modified:** `WorkflowBuilderPage.tsx`
- **Verification:** three rows assert the value is in the definition and zero PATCHes were issued; a fourth pins the falsifiable half (the undo entry exists at dismissal time) and goes red when `flushHistory()` is removed
- **Committed in:** `04d4f8f7`

---

**2. [Rule 2 - Missing Critical] The ✕ suppresses its focus transfer, or WR-09-02 is green only in jsdom**

- **Found during:** Task 3
- **Issue:** with the fix above in place, the three zero-PATCH assertions would still have been **green by construction** under `fireEvent`, which does not move focus. In a real browser pressing the ✕ moves focus off the field, the field fires `onBlur`, and `onPersist` PATCHes — which is precisely the asymmetry the 183 review measured (`ESCAPE -> 0 calls, CLOSE-BUTTON -> 1 call`). Shipping the assertion without the mechanism would have been the "a gate that lies" failure this phase has now named in four plans.
- **Fix:** `onMouseDown={(event) => event.preventDefault()}` on the panel's ✕, with the reason at the call site. Keyboard activation never fires `mousedown`, so Enter/Space are untouched, and no shipped panel assertion moves.
- **Files modified:** `PhaseFormPanel.tsx` (a file this plan's `files_modified` does not list — a one-line, additive change, unavoidable because the button lives there)
- **Verification:** the ✕ row is driven with `user-event` **on purpose**, and the probe proves it: removing the suppression turns BOTH the zero-PATCH row and the mechanism row red
- **Committed in:** `04d4f8f7`

---

**3. [Rule 3 - Blocking] `WorkflowDoorSwitch` had to grow two pass-through props**

- **Found during:** Tasks 2 and 3
- **Issue:** the plan threads `blockedReason` through `renderPublish` and `registerCanLeave` from `WorkflowsPage` to the Builder — but `WorkflowDoorSwitch` sits between them and declares its OWN `renderPublish` signature. A three-parameter implementation in `WorkflowsPage` is not assignable to a two-parameter prop type, so the plan's literal wiring is a `tsc` error at the shell boundary.
- **Fix:** the shell's `renderPublish` type gained the optional third parameter and the shell gained a `registerCanLeave` pass-through. It reads neither and owns no state; both props are wires. `WorkflowDoorSwitch.test.tsx` reports its pinned **13** unmodified.
- **Files modified:** `WorkflowDoorSwitch.tsx`
- **Committed in:** `04d4f8f7`

---

**4. [Rule 3 - Blocking] The nudge re-read needs an invalidation key, and the lint rule cannot see it**

- **Found during:** Task 1
- **Issue:** `nudges` is a read of `canvasNudge.ts`'s storage, re-taken after a write. Expressed as a `useEffect` + `setState` it is the cascading-render shape `react-hooks/set-state-in-effect` exists to stop (and which `useGroundingBundle`'s docblock already argues against); expressed as a `useMemo` keyed on a version counter, `exhaustive-deps` flags the counter as unnecessary because it is not read in the body.
- **Fix:** the `useMemo` + counter, with a targeted `eslint-disable-next-line` carrying the reason — the counter is an INVALIDATION key, and holding the map in page state instead would put a second copy of it outside the module that owns it.
- **Files modified:** `WorkflowBuilderPage.tsx`
- **Verification:** `npx eslint` on all eight touched files reports zero problems
- **Committed in:** `04d4f8f7`

---

**5. [Rule 1 - Bug] The 409 is classified on the error's NAME, not with `instanceof`**

- **Found during:** Task 3
- **Issue:** the plan specifies `err instanceof WorkflowConflictError`, which needs a VALUE import of the class into the page. Both shipped Builder suites mock `@/lib/api` with a whole-module factory that does not export it, so the import would resolve to `undefined` and `err instanceof undefined` throws a `TypeError` **inside the catch block** — turning the shipped *"Save draft shows an honest error state when the persist fails"* assertion red for a reason that has nothing to do with the 409.
- **Fix:** branch on `err.name === "WorkflowConflictError"`, which is the idiom `useLiveValidation.causeOf` already ships and states its reason for (it survives a module or realm boundary that `instanceof` does not). The page needs no value import, no shipped mock had to grow a class, and the literal identifier is still in the source for anyone grepping.
- **Files modified:** `WorkflowBuilderPage.tsx`
- **Verification:** the session suite rejects with a real `WorkflowConflictError` (name and all) and asserts the exact sentence; a generic `Error` keeps `Couldn't save`
- **Committed in:** `04d4f8f7`

---

**6. [Rule 2 - Missing Critical] `markSaved()` is called on a confirmed write**

- **Found during:** Task 3
- **Issue:** nothing in the app called the store's `markSaved()`, so `dirty` armed on the first edit and never cleared. With the leave guard landing in the same plan, every save would still have been followed by an "unsaved changes" prompt — a guard that cries wolf teaches a person to click through it, which is worse than no guard.
- **Fix:** one line in `onPersist`, after the confirmed write and before `return true`. The create-once-then-PATCH guard (`draftIdRef`, `creatingRef`, the in-flight skip, the `finally` reset) is byte-unchanged, and `markSaved()` itself writes nothing. D-184-03 is unaffected: the store's dirty subscription re-arms on the very next `phases` change, including an undo.
- **Files modified:** `WorkflowBuilderPage.tsx`
- **Verification:** the probe that removes it turns two rows red — the undo row and the `beforeunload` disarm row
- **Committed in:** `04d4f8f7`

---

**7. [Rule 2 - Missing Critical] `editable` / `onCommitNodes` are wired here, not left for a later plan**

- **Found during:** Task 1
- **Issue:** the plan's Task 1 enumerates `marks`, `nudges` and `onNudge` but not `editable` or `onCommitNodes`, and 184-10's summary hands the wiring to "184-12 / 184-13" while neither of those plans lists it either. Left unwired, 184-10's entire editing half — the axis-split drag and the `⌥←`/`⌥→` reorder — is unreachable from the app, and D-184-15's "the first structural edit starts the loop" has no canvas-originated path to be started by.
- **Fix:** all five editing props are passed together, exactly as 184-10's "Next Phase Readiness" section specifies them. `editable={canvasEnabled}` is passed explicitly even though the branch is unreachable while the flag is off, so the gate is stated rather than assumed.
- **Files modified:** `WorkflowBuilderPage.tsx`
- **Committed in:** `04d4f8f7`

---

**8. [Rule 2 - Missing Critical] `requirements.mark-complete` was NOT run**

- **Found during:** post-plan state updates
- **Issue:** the frontmatter names `requirements: [CANVAS-02, CANVAS-03]` and the verb flips both off the frontmatter alone. CANVAS-02 is *"a user can add, move, connect and delete phase-nodes"* — **add and delete land in 184-12**, and the toolbar/tray that make the session legible land in 184-13.
- **Fix:** the verb was not invoked. `.planning/REQUIREMENTS.md` is untouched; all five phase REQ-IDs remain **Pending**. Consistent with 184-02 through 184-10.
- **Files modified:** none

---

**Total deviations:** 8 (2 bugs, 4 missing-critical, 2 blocking)
**Impact on plan:** none expands scope. Two files beyond `files_modified` were touched — `PhaseFormPanel.tsx` (one line, Deviation 2) and `WorkflowDoorSwitch.tsx` (two pass-through props, Deviation 3) — both forced by where the code already lives. Deviations 1 and 2 are the only behavioural departures from the plan's literal text, and both are strictly more honest than what it wrote.

---

## Design decisions worth carrying forward

- **A dismissal is not a save.** One callback decides it, one comment explains it, and the ✕'s incidental PATCH is gone. Any future dismissal affordance that routes through `clearSelection` inherits both halves for free.
- **Absence is a state, and it needs the spread.** `{...(cond ? { rails } : {})}` is the only form that makes "the flag-off panel receives no rails key" observable. `rails={cond ? r : undefined}` looks identical in the DOM and fails the assertion that matters.
- **`hasEdited` is driven by the STORE, not by call sites.** The subscription reads the one thing every edit has in common (a new `phases` reference) and excludes document transitions (which always replace `meta`). 184-12 adds `＋` and `✕` and needs to remember nothing.
- **The publish reason travels on the existing seam.** `renderPublish` gained a third argument rather than the mount moving. 141-B's operator correction survives by construction, and the R12 test asserts the trigger and the save state share ONE `<header>` with exactly one `banner` landmark.
- **The verdicts are mirrored into the store, not read twice.** The marks (canvas, today) and the tray (184-13) will read one slice, and `partialize` keeps all three keys out of the undo stack so an arriving response can never push a history entry.
- **Fail closed on the palette.** Every non-`ready` bundle reading is `"degraded"`. An empty array would say "this workspace offers no tools" while the truth is "we could not ask", and dropping the rail would restore a free-text box that is not a whitelist.

## Known Stubs

**None.** Everything this plan adds is a complete implementation of its contract.

Two things are deliberately UNBUILT rather than stubbed, and both are named in the plan set: the `＋` / `✕` affordances and the empty-draft "Add your first step" invitation are **184-12**, and the canvas toolbar (undo/redo + save state) plus the problems tray are **184-13**. The problems tray in particular means the verdict data mirrored into the store is currently rendered only as per-node marks; the tray reads the same slice and needs no page change.

## Threat Model Disposition

| Threat ID | Disposition | Status |
|---|---|---|
| T-184-11-01 (tampering — layout keys in the draft payload) | mitigate | **CLOSED.** The shipped `forbiddenKeysIn` walk runs over the ACTUAL serialized create and PATCH bodies from a driven editing session and finds **zero** `position`/`x`/`y`/`layout` keys at any depth, with a positive control proving the walk fires on a planted key. The cosmetic `dy` is structurally unable to reach the payload — it is not a field of the store and `canvasNudge.ts` owns its storage |
| T-184-11-02 (repudiation — a dismissal silently minting a PATCH) | mitigate | **CLOSED, and wider than the assertion alone.** All three paths carry the zero-PATCH assertion, AND the MECHANISM that made the ✕ different was removed — the probe proves the ✕ row would be red without it, so this is not a guard that passes because the driver is polite |
| T-184-11-03 (DoS — duplicate draft creation) | mitigate | **CLOSED.** Three saves fired against a create held OPEN still issue exactly one `createWorkflowDraft`; the `creatingRef`/`draftIdRef` guard is byte-unchanged |
| T-184-11-04 (spoofing — a blocked publish that reads as available, or a degraded check unblocking it) | mitigate | **CLOSED.** `blockedReason` is derived from the server's response only; the degraded case keeps publish disabled and says which failure it was; the empty-draft case is an INVITATION, commented as such at the derivation, and provably asks the server nothing |
| T-184-11-05 (info disclosure — 409 / error surfacing) | mitigate | **CLOSED.** The 409 renders a business-plain sentence naming the way out; every other failure keeps the non-swallowing generic state. No server body, no Pydantic `loc`/`msg`, no status code reaches the surface |
| T-184-11-06 (EoP — flag-off surface drift) | mitigate | **CLOSED.** `rails` is spread-conditional and its absence is asserted on the props object with `in`; `blockedReason` is gated on the flag, so a flag-off empty draft keeps today's enabled trigger (probed — dropping the gate turns that row red); `revertByteIdentical.test.tsx` is green at 7 and the canvas snapshot is byte-unchanged |
| T-184-11-SC (tampering — npm installs) | accept | **Honoured — this plan installed nothing.** `frontend/package.json` and the lockfile appear in none of the four commits |

## Scope Fence Compliance

- **Frontend only.** `git diff --name-only -- backend/ supabase/migrations` returns **0** lines across all four commits. Slot 114 stays RESERVED.
- **No env var, no dependency, no migration, no cloud parity owed.**
- **No new endpoint.** The page calls `POST /workflows` and `PATCH /workflows/{id}` exactly as it did, plus the two 182 routes whose only callers are the two hooks from 184-06 / 184-09.
- **Phase 186's seam is intact.** `draftIdRef`, `creatingRef`, the in-flight skip, the `finally` reset and the create-once-then-PATCH branch are byte-unchanged; the one added line is `markSaved()` after a confirmed write.
- **Phase 185 is not pre-empted.** `grep -c 'grounding_mode'` → 0; the gates rail derives from `groundingFor()` and plugs into the same `rails.gates` array 185 will fill.
- **`__fixtures__/canvasFixtures.ts` untouched** (D-184-17). The session suite hand-authors its own two-step definition inline.
- **Only `--reporter=default` / the gate's own `--reporter=json`.** No watch flag committed. No scratch file inside `frontend/` or `backend/` — every probe was an in-place edit, restored and `git diff`-verified.

## Issues Encountered

- **A `vi.resetModules()` + `vi.doMock` test must re-import EVERY module whose identity matters**, not just the one under test. Importing a React context provider from the pre-reset graph makes the component read `null` and silently inverts what the test measures. Only the positive control caught it.
- **`toHaveTextContent` matches SUBSTRINGS**, which is why `Saved ✓ · still a draft` would have kept a superseded assertion green. Worth knowing when weighing a "second table beats an edited assertion" escape: sometimes the escape exists and is still the wrong answer.
- **jsdom rejects a hand-rolled `addEventListener` spy** that forwards through `EventTarget.prototype` (`'addEventListener' called on an object that is not a valid instance of EventTarget`). Asserting the DISPATCHED event's `defaultPrevented` is both simpler and a stronger claim.
- **`PublishGauntlet.test.tsx` still flakes under the fully-parallel `npm test`** with a 5 s test timeout while passing 24/24 in isolation. Third plan in a row to record it; it is a harness-load artifact, and a candidate for a `testTimeout` bump in a later cleanup rather than a code change.

## User Setup Required

**None.** No env var, no migration, no dependency, no operator step.

Carried forward, unchanged: `__fixtures__/corpusDump.json` still needs regenerating against a running local Supabase before `/gsd:verify-work` (184-05), and the live in-app five-surface icon sweep remains a phase-verification G-4 row (184-01). Both need Docker up.

**Owned by phase verification (live-only), added to 184-10's U-2 drag row:**
- **The leave guard as a person meets it.** Edit a step, press `← Workflows`, and confirm the browser prompt appears and that cancelling leaves the work exactly as it was; save, then press it again and confirm no prompt. Then edit and close the TAB, and confirm the browser's own "leave site?" dialog appears.
- **The blocked publish.** On a brand-new draft, `◆ Publish…` should read as an invitation (*"Add a step to get started"*) rather than as a failure; after adding a step with a real problem, it should name the server's own first sentence.

## Next Phase Readiness

- **184-12 has everything it needs on the page.** `hasEdited` is store-driven, so a `＋` that dispatches `insertPhaseOfTypeAt` starts the live loop with no extra wiring; `blockedReason` already handles the zero-phase case, so the empty-draft invitation and the disabled publish agree by construction.
- **184-13's tray reads a slice that is already populated.** `verdicts`, `checking` and `degraded` are mirrored into the store on every loop transition, and `groupVerdicts` is already memoized on the page — the tray needs `summaryLine(verdictGroups)` and nothing else from here.
- **184-13's toolbar save state must reuse `SAVED_STILL_A_DRAFT`**, exported from the page for exactly that reason. Two spellings of a locked string is how a locked string stops being locked.
- **The assertion-edit budget: this plan spent ONE**, enumerated above with its full diff. Together with 184-08's two narrowings in `PhaseNodeCard.test.tsx` and the 184-01 `soulData.test.ts` carve-out, that is the complete list for phase 184.
- **Phase 186 still has its seam**, and now also has `markSaved()` as the one place a confirmed write clears `dirty` — an autosave implementation has exactly one call site to move.

## Self-Check: PASSED

- `frontend/src/pages/WorkflowBuilderPage.tsx` — FOUND
- `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` — FOUND
- `frontend/src/pages/WorkflowBuilderPage.session.test.tsx` — FOUND
- `frontend/src/pages/WorkflowBuilderPage.test.tsx` — FOUND
- `frontend/src/pages/WorkflowsPage.tsx` — FOUND
- `frontend/src/components/workflows/PublishGauntlet.tsx` — FOUND
- `frontend/src/components/workflows/PhaseFormPanel.tsx` — FOUND
- `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` — FOUND
- Commit `04d4f8f7` — FOUND
- Commit `53ceef65` — FOUND
- Commit `6f04b987` — FOUND
- Commit `9524f308` — FOUND

---
*Phase: 184-editable-canvas-live-structural-validation-round-trip*
*Completed: 2026-07-27*
