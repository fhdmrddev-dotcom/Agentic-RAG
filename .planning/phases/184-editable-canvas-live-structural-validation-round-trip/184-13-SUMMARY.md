---
phase: 184-editable-canvas-live-structural-validation-round-trip
plan: 13
subsystem: workflows
tags: [canvas-toolbar, undo-redo, zundo-207, r12, one-bottom-region, problems-tray-mounted, keyboard-bindings, save-honesty, wave-9, final-plan]

# Dependency graph
requires:
  - phase: 184-04
    provides: "`useBuilderTemporal` — the ONLY React-19-safe way to render undo/redo enabled state — plus `createBuilderStore`'s temporal half and the `SaveState` type"
  - phase: 184-08
    provides: "`ProblemsTray` (built, never mounted until this plan), `summaryLine`, `groupVerdicts`, and `VERDICT_DESTRUCTIVE_TOKEN` — the literal the R9 scan counts"
  - phase: 184-10
    provides: "`WorkflowCanvas`'s editing half and the gated-window-listener precedent it carries"
  - phase: 184-11
    provides: "the composed session — `SAVED_STILL_A_DRAFT`, the save-state machine, `blockedReason` in the EXISTING header, the store-driven `hasEdited`, and the verdict mirror the tray reads"
  - phase: 184-12
    provides: "the `＋` / `✕` affordances the toolbar's history is fed by, and Deviation 2's rule — a control that wants to look dangerous uses a raw hsl literal, never the `destructive` token"
provides:
  - "`CanvasToolbar` — undo / redo / tidy up / save state / save draft, with the zundo #207 landmine discharged by a falsified test rather than by a comment"
  - "`WorkflowCanvasProps.session` — one optional object carrying everything the ONE bottom region renders, so 'two rows, always' is a property of the type rather than of a test"
  - "The mounted `ProblemsTray` — the first plan in the phase where a user can SEE a server verdict listed"
  - "D-184-04's four key bindings behind one gated window listener that yields to text fields"
  - "`WorkflowCanvas.composition.test.tsx` — the R12 structural proof"
affects: [185, 186, 188, phase-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A React-19 reactivity claim discharged by PLANTING the non-reactive form and recording the reds, not by trusting a docblock"
    - "One optional prop OBJECT rather than N optional props, when the members must appear together or not at all — it makes a composition rule (two rows, never one, never three) unrepresentable rather than merely untested"
    - "A source fence run over COMMENT-STRIPPED source, so the docblock that explains a ban is allowed to name the thing it bans (the seventh D-ITEM-183-02 instance in this phase; stripping is now the house answer)"
    - "`flex-col-reverse` on a bottom region: source order stays [row 1, row 2] while the FIRST row owns the actual bottom edge, so 'expands upward' and 'does not push the toolbar' are both literally true"
    - "Refusing to fake a measurement jsdom cannot take — the structural half is asserted mechanically and the visual half is handed to a named live row, in the file's own docblock"

key-files:
  created:
    - frontend/src/components/workflows/CanvasToolbar.tsx
    - frontend/src/components/workflows/CanvasToolbar.test.tsx
    - frontend/src/components/workflows/WorkflowCanvas.composition.test.tsx
  modified:
    - frontend/src/components/workflows/WorkflowCanvas.tsx
    - frontend/src/components/workflows/builderStore.ts
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx

key-decisions:
  - "`SAVED_STILL_A_DRAFT` MOVED from the page to `builderStore.ts` and is re-exported under the same name — a leaf on the code-split canvas chunk must not reach back into a page module for a string, and re-typing it would be the second spelling that unlocks a locked string"
  - "The bottom region is fed by ONE optional `session` object, which is also what keeps the two shipped provider-less canvas suites green: `CanvasToolbar` legitimately throws outside a `BuilderStoreProvider`, so the region has to be genuinely absent there"
  - "The region is `flex-col-reverse`: the toolbar owns the bottom edge and never moves when the tray opens"
  - "No bottom region on the EMPTY draft — U-1's first screen is an invitation, and a save state plus a problems tray on a workflow with no steps is chrome about nothing"
  - "The header's shipped Save-draft cluster STAYS. 184-11's R12 assertion pins `builder-save-state` inside the header and D-181-01 forbids moving it; the toolbar's trigger is a second entry point to the ONE save path, asserted to PATCH exactly once"
  - "`validateWorkflow` is deliberately NOT pinned at zero on an undo — an undo really does change the definition, so the loop re-checking it is the loop working. What must be zero is the WRITE"
  - "`requirements.mark-complete` was NOT run — REQUIREMENTS.md is untouched and all 5 phase REQ-IDs remain Pending, per the orchestrator's phase-end contract"

patterns-established:
  - "Strip comments before a `?raw` source fence — it is the only way a fence and the paragraph explaining it can both be true"
  - "A positive control on a comment STRIPPER, not just on the pattern: assert the raw source contains the identifier and the stripped source does not, or an over-eager stripper passes every fence by measuring an empty string"

requirements-completed: []  # VALID-02 / VALID-03 are this plan's frontmatter requirements. They are now OBSERVABLE for the first time — but the orchestrator marks all 5 at phase end, after verifying the behaviour live. REQUIREMENTS.md deliberately untouched.

# Metrics
duration: 30min
completed: 2026-07-27
---

# Phase 184 Plan 13: The One Bottom Region Summary

**The authoring session closes: undo and redo now sit where editing happens with an enabled state that is a genuine SUBSCRIPTION — proven by planting the `getState()` form and watching five assertions go red — four keyboard accelerators ride one window listener that exists only on the flagged canvas and steps aside the moment the cursor is in a text field, and the problems tray is MOUNTED for the first time in the phase, folded into a single bottom edge with the toolbar so that a 900 px canvas grows exactly one region with exactly two rows whether the tray is open or shut, still spends zero `destructive` tokens on a draft whose findings are all "not finished yet", and still leaves publish in the header it already had.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-07-27T09:31:29Z
- **Completed:** 2026-07-27T10:01:22Z
- **Tasks:** 3 (all `auto`) + one anti-drift correction
- **Files created:** 3 · **Files modified:** 4

## Task Commits

| # | Commit | Type | What |
|---|---|---|---|
| 1 | `dfee9500` | feat | `CanvasToolbar` + its 14-assertion suite; `SAVED_STILL_A_DRAFT` moved to `builderStore.ts` and re-exported from the page |
| 2 | `e72b561e` | feat | D-184-04's gated window listener + 9 net-new page assertions |
| 3 | `42bd7533` | feat | The composed bottom region, the page wiring, `WorkflowCanvas.composition.test.tsx` (19) + 5 net-new page assertions |
| — | `728fc564` | docs | Anti-drift: retire `builderStore`'s stale "this slot is the toolbar's home" reservation |

No commit deletes a tracked file (`git diff --diff-filter=D --name-only` is empty on all four).

---

## (a) THE PITFALL-7 FALSIFICATION — the observations, in full

The `<output>` block requires these verbatim. `CanvasToolbar.tsx` was temporarily rewritten from

```ts
const canUndo = useBuilderTemporal((t) => t.pastStates.length > 0)
const canRedo = useBuilderTemporal((t) => t.futureStates.length > 0)
```

to the form zundo issue #207 warns about:

```ts
const canUndo = store.temporal.getState().pastStates.length > 0
const canRedo = store.temporal.getState().futureStates.length > 0
```

and the suite re-run. **Five distinct reds:**

```
× Undo starts disabled and becomes enabled on a structural edit WITHOUT a remount
× Redo is disabled until an undo happens, and disabled AGAIN after a new edit
× selector reads are used for the RENDERED values and getState() only for side effects
    AssertionError: expected 0 to be greater than or equal to 2
× Undo steps the definition back through the store
    AssertionError: expected 6 to be 5
× Redo steps it forward again
    AssertionError: expected 6 to be 5

Tests  5 failed | 9 passed (14)
```

The last two are the informative ones, and they are worth reading twice. The buttons did not merely *look* wrong — they were **permanently disabled**, so clicking Undo did nothing at all and the definition never moved. Under React 19 the `getState()` form does not degrade into "the state updates a render late"; it never updates, so the control is dead for the whole session. That is a silent, total failure of the one affordance sketch 141-B put on the canvas, and it is exactly why the plan asked for it to be falsified rather than asserted.

**Restored, and verified:** 14/14 green, `grep -c 'useBuilderTemporal(' CanvasToolbar.tsx` → **2**, and every `temporal.getState()` in the component's non-comment source is followed by `.undo()` or `.redo()` — a side-effect call, never a rendered value.

### The `getState()` audit the acceptance criteria asked for, occurrence by occurrence

There are exactly **two** in `CanvasToolbar.tsx`'s code, both inside event-handler bodies:

| Occurrence | Context | Rendered value? |
|---|---|---|
| `const undo = () => store.temporal.getState().undo()` | the Undo button's `onClick` | **No** — a side effect |
| `const redo = () => store.temporal.getState().redo()` | the Redo button's `onClick` | **No** — a side effect |

Two more appear in the file's DOCBLOCK, where the forbidden form has to be named in order to be forbidden — see Deviation 1.

The page's listener adds one more of the same kind: `const temporal = store.temporal.getState()` inside `onKeyDown`, then `temporal.undo()` / `temporal.redo()`. Also a side effect, also correct.

---

## (b) THE KEYDOWN EFFECT'S GUARD, quoted

The `<output>` block requires this verbatim. `frontend/src/pages/WorkflowBuilderPage.tsx`:

```tsx
  useEffect(() => {
    if (!canvasEnabled || activeGraphView !== "canvas") return

    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return
      if (event.repeat) return

      const key = event.key.toLowerCase()
      const isUndo = key === "z" && !event.shiftKey
      const isRedo = (key === "z" && event.shiftKey) || key === "y"
      if (!isUndo && !isRedo) return

      // The yield. Native field-level undo keeps working inside every text control.
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable === true) return

      event.preventDefault()
      const temporal = store.temporal.getState()
      if (isUndo) temporal.undo()
      else temporal.redo()
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [canvasEnabled, activeGraphView, store])
```

Both halves of the gate are in the guard AND in the dependency array, so a mid-session flag tightening (or a switch back to the Spine) tears the listener down rather than leaving a stale one behind. The cleanup removes exactly the handler it added.

**Falsified, twice:**

| Probe | Reds | Restored |
|---|---|---|
| The three-tag yield removed | **1** — *"it YIELDS to a text field"* | ✓ |
| `if (!canvasEnabled \|\| activeGraphView !== "canvas") return` removed | **2** — the flag-off row and the Spine row | ✓ |

Both probes were applied and reverted in place; `git diff` on the page is clean of them.

---

## (c) THE PHASE-WIDE SCOPE CONFIRMATION

Measured against the pre-phase base commit `b53edd8a` (the parent of `4a019bd8`, the first 184 commit), across **all 53 commits of phase 184**:

```
$ git diff --name-only b53edd8a..HEAD -- backend/           | wc -l
0
$ git diff --name-only b53edd8a..HEAD -- supabase/migrations | wc -l
0
```

**Zero backend files and zero migration files changed by the entire phase.** Slot 114 stays RESERVED for Phase 186's `workflow_layouts`, exactly as the SPEC's out-of-scope list requires. `frontend/package.json` and the lockfile appear in none of this plan's four commits.

---

## What a user can now DO end to end

This is the last plan of the phase, so this section is the point of it.

**Before Phase 184**, a user with `visual_workflow_canvas` on could open a workflow, press `⬡ Canvas`, and *look* at a read-only projection of it. Every edit had to be made in the `≣ Spine` form, one field at a time, and the only thing that ever told them whether the workflow was publishable was the publish gauntlet — after they pressed it.

**After this phase**, on the flagged canvas, a user can:

1. **Open a brand-new draft** and be met with a named invitation — *"Add your first step"* — rather than an empty screen, with `◆ Publish…` disabled and reading *"Add a step to get started"* (an invitation, not a claimed verdict: nothing is asked of the server on a workflow with no steps).
2. **Add a step anywhere**, including before the first one, by pressing the `＋` that sits *on* the connector where the step will land, and choosing from six plain-language types — with any choice that would strand the deliverable disabled and its reason stated inline.
3. **Reorder** by dragging a card along its lane, or by selecting one and pressing `⌥←` / `⌥→` — one op behind both, announced positionally to a screen reader.
4. **Nudge a card vertically** for readability, which is browser-local, never serialized, never in the undo history, and clearable with **Tidy up**.
5. **Delete a step** with a single `✕` and no modal, read a message saying what went and how many steps were renumbered, and press **Undo** on that message — or be *refused*, with the reason named, when another step still sends its failures to the one being removed.
6. **Undo and redo the whole session** from the toolbar buttons or from `⌘Z` / `Ctrl+Z` / `⇧⌘Z` / `Ctrl+Y` — including config edits made from the Spine, because the history is one stack — while `⌘Z` inside a text field still does what the browser does.
7. **See, live, what the server thinks**: a red `✕` or a dashed grey `○` on the cards, and a bottom tray that says *"1 problem · 3 things to finish"* before it is opened, lists every finding in the server's own words when it is, gives workflow-wide findings a home, jumps to the step a finding belongs to, and tells the truth in two different sentences when the check could not run at all.
8. **Know where they stand on saving**: *"Not saved yet"* → *"Saving…"* → *"Saved · still a draft"*, with no word anywhere implying published, and a browser prompt if they try to leave with unsaved work.
9. **See why publish is blocked** — the server's own first sentence, in the header the Builder already had.

**And with the flag off, none of it exists** — for everyone including operators.

## Still owed to phase verification

Two items carry forward, both blocked on Docker/Supabase being up, plus this plan's own live rows:

1. **`__fixtures__/corpusDump.json` needs regenerating** against a running local Supabase before `/gsd:verify-work` (owed since **184-05**).
2. **The live in-app five-surface icon sweep** for the `llm_agent` → compass / `llm_batch_agents` → handshake glyph swap (owed since **184-01**).
3. **R12's visual half (new, this plan).** jsdom lays nothing out, so *"no horizontal overflow at 900 px"* cannot be measured here and was not faked. At 900 px with the panel open, confirm: one bottom region, the toolbar as the bottom-most row, the tray summary directly above it, and nothing clipped horizontally. Open the tray and confirm it grows **upward** into the canvas without moving the toolbar.
4. **The two save entry points, as a person meets them.** The page header's `Save draft` and the toolbar's both call the same handler. Confirm on a real screen that having both reads as convenient rather than as duplicated chrome — this is the one composition call in the plan that a machine cannot judge (see Deviation 3).
5. Everything 184-10 and 184-12 already added to the G-4 list (the real pointer drag, the `＋` reveal on hover vs. touch, the `✕` on a two-line title, the menu at minimum zoom, delete-then-Undo as a person, the leave guard, the blocked publish).

---

## Verification Results

| Gate | Required | Observed |
|---|---|---|
| `npx vitest run …CanvasToolbar.test.tsx` | 0 failures, exit 0 | **14 passed, exit 0** |
| `npx vitest run …WorkflowCanvas.composition.test.tsx` | 0 failures, exit 0 | **19 passed, exit 0** |
| `npx vitest run …WorkflowBuilderPage.canvas.test.tsx` | the shipped assertions pass unmodified | **68 passed** (54 → 68, **+14**); `git diff --numstat` = **321 insertions, 0 deletions** |
| `npx vitest run src/components/workflows + the 4 page/admin suites` | 0 failures | **29 files / 1054 passed, exit 0** |
| `node scripts/vitest-count-gate.cjs` | exit 0, all 16 pinned held | **exit 0** after every task; 16/16 present, **every pinned delta 0**; 990 → 1004 → 1013 → **1037**, **0 failing** |
| `npx tsc -b \| grep -c "error TS"` | ≤ 33 | **33** after every task — equal to the `develop` differential, and **none of the 33 names a file this plan touched** |
| `npx vite build` | exit 0 | **exit 0**, built in 3.91 s |
| `git diff --exit-code -- 'src/**/__snapshots__/*'` | exit 0 | **exit 0 — byte-unchanged** |
| `revertByteIdentical.test.tsx` | green at its pinned 7 | **7/7, file untouched** |
| `WorkflowCanvas.test.tsx` (read-only) | 31, file untouched | **31 passed**, `git diff` on it is **empty** |
| `WorkflowCanvas.editing.test.tsx` | 49, file untouched | **49 passed**, `git diff` on it is **empty** |
| `npx eslint` on all 7 files | clean | **zero problems** |
| `grep -cE 'workflows/validate\|grounding_mode\|MiniMap\|hideAttribution' WorkflowCanvas.tsx` | 0 | **0**; `showInteractive={false}` still present |
| `git diff --name-only <pre-phase>..HEAD -- backend/` | 0 | **0** |
| `git diff --name-only <pre-phase>..HEAD -- supabase/migrations` | 0 | **0** |
| `.planning/REQUIREMENTS.md` | untouched, all 5 REQ-IDs Pending | **untouched** |
| Deletions in any commit | none | **none** |

### Full frontend suite — no NEW failures

```
npm test → Test Files 9 failed | 219 passed (228)
                Tests 23 failed | 2829 passed (2852)
```

The nine failing FILES and the twenty-three failing TESTS are **the same set 184-11 and 184-12 recorded**, name for name: eight SEED-056 vitest-rot files (chat / streaming / ingestion / model-info) plus `PublishGauntlet.test.tsx`'s documented load-dependent 5 s timeout flake, which passes 24/24 in isolation and reported its pinned 24 with 0 failing on every count-gate run. The file count moved 226 → 228 because this plan adds two test files; the passing count moved 217 → 219 accordingly. Nothing in either rot category was fixed (SEED-049 / SEED-056 are named, not repaired, per the scope-boundary rule).

---

## Assertion edits: ZERO

**This plan edited ZERO assertions in any pre-existing test file.**

```
$ git diff --numstat dfee9500~1 HEAD -- 'frontend/src/**/*.test.ts' 'frontend/src/**/*.test.tsx'
571  0  frontend/src/components/workflows/CanvasToolbar.test.tsx          (new)
396  0  frontend/src/components/workflows/WorkflowCanvas.composition.test.tsx (new)
321  0  frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
```

Both blocks appended to `WorkflowBuilderPage.canvas.test.tsx` are **0-deletion**, achieved the 184-12 way: every symbol they need was already imported on its own line by an earlier plan, so no existing import line had to be widened.

The phase's assertion-edit ledger is therefore **unchanged** by this plan and closes at: 184-08's two forced narrowings in `PhaseNodeCard.test.tsx`, 184-11's one forced literal in `WorkflowBuilderPage.test.tsx`, and the 184-01 `soulData.test.ts` carve-out (still **spent and unconsumed** — it reported its pinned 14 on every gate run).

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The `getState()` source fence had to be run over COMMENT-STRIPPED source, twice**

- **Found during:** Task 1 (first run: 1 failure), then Task 3 (first run: 1 failure)
- **Issue:** the plan's acceptance asks that `temporal.getState()` never appear in a rendered value, and the natural fence greps the raw `?raw` source. Both files' docblocks have to NAME the forbidden form in order to explain why it is forbidden — `CanvasToolbar.tsx` quotes the zundo maintainer's `pastStates` sentence, and `WorkflowCanvas.tsx` has said *"this canvas derives no severity"* since 184-10. Both fences went red on the paragraph that documents them. The only ways to pass them as written were to delete the explanation or to make it lie: **D-ITEM-183-02 in its purest form, and the seventh instance in this phase.**
- **Fix:** both fences strip block comments, line comments and JSX comments before scanning, with the reason written at the regex. Stripping is now the house answer rather than a one-off.
- **Files modified:** `CanvasToolbar.test.tsx`, `WorkflowCanvas.composition.test.tsx`
- **Verification:** each fence carries **two** positive controls — one proving the pattern rejects the forbidden form, and one proving the STRIPPER really strips (`raw` contains the identifier, `code` does not, and `code` still contains a known code-only literal). Without the second, an over-eager stripper would pass every fence by scanning an empty string
- **Committed in:** `dfee9500`, `42bd7533`

---

**2. [Rule 3 - Blocking] `SAVED_STILL_A_DRAFT` had to MOVE, because the toolbar cannot import from a page**

- **Found during:** Task 1
- **Issue:** 184-11 exported the locked literal from `WorkflowBuilderPage.tsx` and explicitly told this plan to reuse it (*"two spellings of a locked string is how a locked string stops being locked"*). But `CanvasToolbar` is a leaf on the `React.lazy` canvas chunk, and a VALUE import from the page module would (a) pull the entire page — and its `@/lib/api` import — into that chunk, undoing D-183-03's whole point, and (b) force the toolbar's own unit suite to mock the api client to render a button. Re-typing the literal was the other option, and it is the one 184-11 forbade.
- **Fix:** the declaration moved to `builderStore.ts`, beside the `SaveState` type and the untracked `saveState` slot that already named the toolbar. The page imports it and **re-exports it under the same name**, so every existing caller and every existing grep still finds it at `@/pages/WorkflowBuilderPage`. `builderStore` is already in the main bundle and is imported by both sides, so no cycle and no chunk movement.
- **Files modified:** `builderStore.ts`, `WorkflowBuilderPage.tsx` (a 3-line net change)
- **Verification:** the toolbar suite asserts the rendered chip `toBe` the imported constant AND `toBe` the literal string; `WorkflowBuilderPage.test.tsx` (15) and `WorkflowBuilderPage.session.test.tsx` (17) both pass unmodified
- **Committed in:** `dfee9500`

---

**3. [Rule 3 - Blocking] The header's shipped Save-draft cluster STAYS, so there are two entry points to one save**

- **Found during:** Task 3
- **Issue:** sketch 141-B's variant-B header carries only the name, the `draft` chip and Publish — the save state moved to the canvas toolbar. Implementing that literally means removing `builder-save-state` from the header, which turns **`WorkflowBuilderPage.canvas.test.tsx`'s shipped R12 assertion** red (*"publish is in the EXISTING header — the same one that carries the save state"*, 184-11) and would be an assertion edit on a pinned file. Gating the removal on the canvas view would keep flag-off byte-identical but still break that assertion, which runs with the flag ON.
- **Fix:** the header is untouched. The toolbar's save reading and its `Save draft` trigger are ADDITIVE, and both triggers call the same `onSaveDraft` — asserted end to end on the page: editing then pressing the toolbar's button PATCHes the row **exactly once** and flips both readings to `Saved · still a draft`. One save path, two entry points, and the toolbar's testid (`canvas-toolbar-save`) is distinct so neither query is ambiguous.
- **Files modified:** none beyond the composition itself
- **Residual risk, stated rather than hidden:** whether two `Save draft` buttons on one screen reads as convenient or as duplicated chrome is an operator judgement on a rendered screen. It is listed as a live row in "Still owed to phase verification" above. If the operator dislikes it, the cheapest correction is dropping the toolbar's *button* (keeping its save READING), which costs one assertion in this plan's own new file and touches no pinned one.
- **Committed in:** `42bd7533`

---

**4. [Rule 2 - Missing Critical] The bottom region is ONE optional prop object, not nine loose props**

- **Found during:** Task 3
- **Issue:** the plan lists the wiring as nine separate values passed into `WorkflowCanvas`. Two problems. First, `CanvasToolbar` calls `useBuilderStore()`, which THROWS outside a `BuilderStoreProvider` — and both shipped canvas suites (`WorkflowCanvas.test.tsx` at 31 and `WorkflowCanvas.editing.test.tsx` at 49) render this component with no provider at all. Nine independently-optional props would have made "is there enough here to render a region?" a judgement the component had to make on every render, and any wrong answer crashes 80 pinned assertions. Second, R12 says **two rows maximum**; with independent props there are states with one row and states with three, and R12 becomes a thing tests check rather than a thing the code cannot violate.
- **Fix:** a single `session?: CanvasSession`. Present ⇒ exactly two rows. Absent ⇒ no region, which is precisely what both shipped suites need. The rule is enforced by the type, not by an assertion.
- **Files modified:** `WorkflowCanvas.tsx`, `WorkflowBuilderPage.tsx`
- **Verification:** *"an editable canvas with NO session renders no region either"* pins the shipped shape; both shipped suites pass with `git diff` empty on them
- **Committed in:** `42bd7533`

---

**5. [Rule 2 - Missing Critical] No bottom region on the EMPTY draft**

- **Found during:** Task 3
- **Issue:** the plan says the region renders "only when `editable`". On a zero-step draft that would put a save state and a problems tray on a screen whose entire job is to say *"Add your first step"* — and 184-VALIDATION's U-1 row explicitly requires **"no tray, no marks"** there. It would also render a tray about a check that D-184-15 guarantees has never run.
- **Fix:** the region renders in the populated branch only; the empty branch keeps 184-12's invitation exactly as it shipped. The reason is written at the render site so nobody "fixes" the asymmetry later.
- **Files modified:** `WorkflowCanvas.tsx`
- **Committed in:** `42bd7533`

---

**6. [Rule 2 - Missing Critical] The region is `flex-col-reverse`, so opening the tray never moves the toolbar**

- **Found during:** Task 3
- **Issue:** the plan asks for row 1 = toolbar, row 2 = tray, *"the tray expands UPWARD… and it does not push the toolbar"*. In a normal column those two clauses conflict: the toolbar is above the tray, so the tray's list growing upward pushes the toolbar up.
- **Fix:** source order stays `[toolbar, tray]` — row 1 and row 2 as the plan numbers them — and the region reverses its main axis. The toolbar therefore owns the actual bottom edge, the tray's summary sits directly above it, and the list grows upward from the summary into the canvas. Every clause is literally true. `ProblemsTray` was already `flex-col-reverse` internally (184-08 built it that way for the same sketch line), so the two nest consistently.
- **Files modified:** `WorkflowCanvas.tsx`
- **Verification:** the two-rows assertion checks source order AND the reverse class; the visual reading is a named G-4 row rather than a faked measurement
- **Committed in:** `42bd7533`

---

**7. [Rule 3 - Blocking] The "no net-new header band" proof lives in the PAGE suite, not the composition file**

- **Found during:** Task 3
- **Issue:** the plan assigns *"the page's header region has the same number of direct children as the pre-plan baseline, and Publish is inside it"* to `WorkflowCanvas.composition.test.tsx`. `WorkflowCanvas` cannot see the page's header — it does not render one and has no access to one. Asserting it there would mean mounting the whole page inside a component suite, which drags in the `@/lib/api` factory mock, the two hooks and the lazy boundary, to measure something the page suite already has a harness for.
- **Fix:** the header-band block (5 assertions) is appended to `WorkflowBuilderPage.canvas.test.tsx`, immediately after 184-11's shipped header assertion, with a header paragraph stating the split. This is 184-12's Deviation 3 applied for the same reason. The composition file keeps everything that IS a property of the component.
- **Files modified:** `WorkflowBuilderPage.canvas.test.tsx`
- **Verification:** every acceptance criterion the plan lists is met — only its file assignment moved. One banner, exactly two direct children, Publish and the save state both inside it, the bottom region's `closest("header")` null with a positive control proving the query resolves on that page, and the whole region vanishing when the user switches back to the Spine
- **Committed in:** `42bd7533`

---

**8. [Rule 1 - Bug] `validateWorkflow` is NOT pinned at zero on an undo**

- **Found during:** Task 2
- **Issue:** the plan's acceptance says *"An undo issues zero api calls"*, and threat T-184-13-02 restates it as a 0-api-call check. Taken literally that includes `validateWorkflow` — but an undo genuinely CHANGES `phases`, and `hasEdited` is already true by then, so the live loop re-checking the new shape is D-184-15 working exactly as specified. Pinning it at zero would be asserting the loop OFF, and would go red the first time anyone fixed a bug in it. (184-12's zero-`validate` claim is not the same claim: it measures a REFUSED delete, where nothing changed.)
- **Fix:** the assertion pins the **writes** — `createWorkflowDraft` and `updateWorkflowDraft` both at 0, measured 700 ms after the undo, well past the coalescing window. That is what D-184-03 actually protects, and the reason for the narrowing is written into the test rather than left for a reader to reconstruct.
- **Files modified:** `WorkflowBuilderPage.canvas.test.tsx`
- **Committed in:** `e72b561e`

---

**9. [Rule 2 - Missing Critical] The toolbar says NOTHING at rest, and falls back to the dirty words on a message-less error**

- **Found during:** Task 1
- **Issue:** the plan enumerates four save readings and leaves `idle` undefined. Rendering "Saved" on a draft this session never wrote is the same class of lie as rendering "Published". Separately, `errorMessage` is optional, so `saveState: "error"` with no message had to render *something*, and the obvious fallback was a second spelling of the page's `GENERIC_SAVE_ERROR`.
- **Fix:** `idle` renders no chip at all (the `role="status"` region is still present at load, so an assistive technology has picked it up before the first transition). A message-less error renders the **dirty** words — *"Not saved yet"* — which is true (a save that failed is a draft that is not saved) and is a sentence this component already owns. The page in fact always supplies a message, so the fallback is a belt rather than a behaviour.
- **Files modified:** `CanvasToolbar.tsx`
- **Verification:** dedicated assertions for the silent `idle` and for both error branches
- **Committed in:** `dfee9500`

---

### Anti-drift corrections applied while writing (not defects)

**10. [Rule 2 - Missing Critical] Three docblocks would have started lying**

- **Found during:** Tasks 2 and 3, plus one post-plan sweep
- **Issue:** (i) `WorkflowCanvas.tsx`'s opening paragraph said *"`editable` flips FOUR things"* — this plan adds a fifth. (ii) The `editable` prop's own docblock enumerated what `false` suppresses and did not mention the bottom region. (iii) `WorkflowBuilderPage.tsx`'s docblock described exactly one gated window key listener; there are now two. (iv) `builderStore.ts` reserved its `saveState` slot *"for the canvas toolbar (141-B) … this slot is the toolbar's home"* — and this plan built that toolbar and did not use it, because persistence lives on the page (D-184-05).
- **Fix:** all four corrected in the same commits as the behaviour, except (iv) which got its own `docs` commit because it is a pure comment fix in a file whose behaviour did not change. The counts are written out **with their history** (*"it used to be one, then four"*), and the retired reservation says explicitly that Phase 186 is the plan that gets to decide whether the slot earns its keep — so nobody re-adds a promise nothing keeps.
- **Files modified:** `WorkflowCanvas.tsx`, `WorkflowBuilderPage.tsx`, `builderStore.ts`
- **Committed in:** `e72b561e`, `42bd7533`, `728fc564`

---

**Total deviations:** 10 (2 bugs, 5 missing-critical, 3 blocking)
**Impact on plan:** none expands scope. Two files beyond `files_modified` were touched — `builderStore.ts` (Deviation 2's constant move plus Deviation 10's comment) and `WorkflowBuilderPage.canvas.test.tsx` (Deviation 7's relocated block, plus Task 2's keyboard assertions which the plan explicitly allowed to land in "a co-located page test"). Deviations 3, 5, 6, 7 and 8 are the only departures from the plan's literal text; each is more correct or more honest than what it wrote, and each is the resolution of a conflict between the plan and something already shipped.

---

## Design decisions worth carrying forward

- **Falsify reactivity claims, always.** The `getState()` probe did not produce a subtly-late render — it produced a **permanently dead button**. Any future component that renders zundo (or any external-store) derived state should plant the non-reactive form once and record the reds. It takes two minutes and it is the difference between a working control and a decorative one.
- **Strip comments before a source fence.** Seven times in one phase a fence has forced a docblock to omit the identifier it was explaining. The answer is not a cleverer regex and it is certainly not a shorter docblock — it is scanning code and asserting, with a control, that the stripper stripped.
- **Group props that must co-occur into one object.** `session?: CanvasSession` makes "one row" and "three rows" unrepresentable, and it is simultaneously what keeps 80 provider-less assertions green. A composition rule enforced by a type does not need a test to notice when someone breaks it.
- **`flex-col-reverse` reconciles "row 1 first" with "row 1 at the bottom".** Worth remembering for any bottom-anchored region that grows upward — Phase 188's run status will want exactly this shape.
- **Name the half you cannot measure, in the file.** The composition suite's docblock says outright that jsdom cannot measure overflow and hands that half to a named live row. That is cheaper than a fake measurement and it survives the next reader.
- **A locked string belongs in the module the *type* lives in, not the module that first rendered it.** `SAVED_STILL_A_DRAFT` next to `SaveState` is reachable from both the page and a code-split leaf; on the page it was reachable from exactly one of them.

## Known Stubs

**None.** Everything this plan adds is a complete implementation of its contract, and — unlike every prior plan in this phase — nothing it builds is left unmounted. The `＋`, the `✕`, the marks, the tray, the toolbar and the keys are all reachable by a user on the flagged canvas.

One thing is deliberately unread rather than stubbed: `builderStore`'s `saveState` slot and its `setSaveState` action, whose reservation is now retired in the source with Phase 186 named as the plan that decides its fate (Deviation 10).

## Threat Model Disposition

| Threat ID | Disposition | Status |
|---|---|---|
| T-184-13-01 (tampering — the global undo listener) | mitigate | **CLOSED.** Gated on `canvasEnabled && activeGraphView === "canvas"` in both the guard and the dependency array, asserted with an `addEventListener` spy on the flag-off render AND on the flag-on Spine render, each with a positive control proving the spy sees the registration when the gate opens; falsified by removing the gate (2 reds). It yields to `input` / `textarea` / `contenteditable`, asserted on all three with a positive control proving the same press outside a field DOES undo, and falsified by removing the yield (1 red). The auto-repeat guard makes one press one step, and an unmodified `z` does nothing |
| T-184-13-02 (repudiation — undo silently writing to the server) | mitigate | **CLOSED, with its scope narrowed honestly.** `createWorkflowDraft` and `updateWorkflowDraft` are both at **0** seven hundred milliseconds after an undo. `validateWorkflow` is deliberately not included and the reason is written at the assertion — see Deviation 8. The toolbar's own suite additionally pins a whole-suite `fetch` spy at 0 |
| T-184-13-03 (spoofing — a disabled control that lies about history depth) | mitigate | **CLOSED by evidence.** Both readings are selector reads; the `getState()` form was planted and produced 5 reds, including two proving the button was not merely stale but DEAD. A comment-stripped source fence additionally pins that every `temporal.getState()` in the component's code is followed by `.undo()` or `.redo()` |
| T-184-13-04 (tampering — verdict text in the summary) | mitigate | **CLOSED.** The tray renders every server string as a plain React text child (184-08's guarantee, unchanged); `grep -c 'dangerouslySetInnerHTML'` on `WorkflowCanvas.tsx` and `CanvasToolbar.tsx` → 0. The composition suite asserts the tray's rows carry the server's `message` verbatim, including a workflow-wide one |
| T-184-13-05 (EoP — flag-off surface drift) | mitigate | **CLOSED.** The region renders only when `editable && session`, and the page passes `session` only when `canvasEnabled`; `editable: false` **with a session supplied** renders no region at all (asserted). `revertByteIdentical.test.tsx` is green at its pinned 7 unmodified, the canvas snapshot is byte-unchanged, `WorkflowCanvas.test.tsx` (31) and `WorkflowCanvas.editing.test.tsx` (49) both pass with an EMPTY `git diff`, and no keydown listener is registered from this path with the flag off |
| T-184-13-SC (tampering — npm installs) | accept | **HONOURED — this plan installed nothing.** `frontend/package.json` and the lockfile appear in none of the four commits |

## Scope Fence Compliance

- **Frontend only.** `git diff --name-only -- backend/ supabase/migrations` returns **0** lines across all four commits, and **0** across the whole phase measured from the pre-phase base. Slot 114 stays RESERVED.
- **No env var, no dependency, no migration, no new endpoint, no cloud parity owed.**
- **No new file beyond the two the plan names**, plus `CanvasToolbar.tsx` itself.
- **Phase 185 is not pre-empted.** `grep -c 'grounding_mode'` on both touched source files → **0**. The tray renders whatever `code` the server sends, so a graded-governance finding ships as a new identifier with no frontend edit.
- **Phase 186's seam is intact.** `draftIdRef`, `creatingRef`, `onPersist`, `onSaveDraft` and the create-once-then-PATCH branch are byte-unchanged; the toolbar's trigger calls the existing `onSaveDraft` and nothing else.
- **Phase 188's colour budget is intact.** A 3-`incomplete` draft emits the `destructive` token **zero** times in the bottom region and zero times in the whole canvas, with a one-`error` positive control proving the scan fires. The toolbar's error chip uses raw hsl literals, with the reason at the call site — 184-12's Deviation 2, carried forward as instructed.
- **No motion added.** Nothing in the bottom region carries an `animate-` / `transition-` class keyed on selection or verdict state.
- **`__fixtures__/canvasFixtures.ts` untouched** (D-184-17). Both new suites read `evalCoverage` and hand-author their own verdict arrays inline.
- **Only `--reporter=default` / the gate's own `--reporter=json`.** No watch flag committed. Every probe was an in-place edit, reverted in place, with `git diff` verified clean afterwards; no scratch file was written inside `frontend/` or `backend/`.

## Issues Encountered

- **A `?raw` fence and a good docblock are structurally in tension**, and this is now the seventh time in Phase 184. The fix is mechanical (strip comments, control the stripper) and should probably be a shared test helper the next time a phase needs three of them.
- **`store.getState()` outside `act()` does not flush** in a suite driving a React subscription — the composition test's toolbar-reactivity row failed on its first run for that reason alone, not for a reactivity one. Worth knowing before reading a red as evidence.
- **`PublishGauntlet.test.tsx` still flakes under the fully-parallel `npm test`** (and flaked once inside the count gate itself, which passed cleanly on the immediate re-run). Fifth plan in a row to record it; a `testTimeout` bump belongs in a cleanup phase, not here.
- **`fireEvent.keyDown(window, …)` is the right driver for a window listener** — dispatching at `document.body` also works, but targeting an element you control is what makes the yield assertions readable.

## User Setup Required

**None.** No env var, no migration, no dependency, no cloud step, no operator action before the phase-verification rows listed above.

## Next Phase Readiness

- **The phase is functionally complete on the flagged canvas.** Everything the SPEC's in-scope list names is built AND mounted; see "What a user can now DO end to end".
- **All 5 REQ-IDs remain Pending, deliberately.** VALID-02 and VALID-03 are this plan's frontmatter requirements and both are now observable for the first time — but the orchestrator marks all five at phase end after verifying the behaviour live (the Phase 182 VALID-01 precedent), and `.planning/REQUIREMENTS.md` is untouched by every plan in this phase.
- **Phase 185 lands on untouched seams.** `allowedTypesAt`'s row shape, the verdict `code` vocabulary and the `rails.gates` array are all unchanged, so graded governance adds data rather than layout.
- **Phase 186 inherits one save path with two entry points**, both routing through the unchanged `onSaveDraft`, and `markSaved()` as the one place a confirmed write clears `dirty`. An autosave implementation still has exactly one call site to move.
- **Phase 188 inherits a free colour budget, a proven scan shape, and a bottom-anchored region pattern** (`flex-col-reverse`, one object prop, two rows) that its run-status strip can reuse rather than re-argue.
- **The verifier should read this file's Deviation 3** before judging the two `Save draft` buttons — it is a deliberate, reversible call, not an oversight.

## Self-Check: PASSED

- `frontend/src/components/workflows/CanvasToolbar.tsx` — FOUND
- `frontend/src/components/workflows/CanvasToolbar.test.tsx` — FOUND
- `frontend/src/components/workflows/WorkflowCanvas.composition.test.tsx` — FOUND
- `frontend/src/components/workflows/WorkflowCanvas.tsx` — FOUND
- `frontend/src/components/workflows/builderStore.ts` — FOUND
- `frontend/src/pages/WorkflowBuilderPage.tsx` — FOUND
- `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` — FOUND
- Commit `dfee9500` — FOUND
- Commit `e72b561e` — FOUND
- Commit `42bd7533` — FOUND
- Commit `728fc564` — FOUND

---
*Phase: 184-editable-canvas-live-structural-validation-round-trip*
*Completed: 2026-07-27*
