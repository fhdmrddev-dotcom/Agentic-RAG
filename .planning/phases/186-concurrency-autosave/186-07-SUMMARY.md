---
phase: 186-concurrency-autosave
plan: 07
subsystem: workflow-builder
tags: [react-composition, autosave, optimistic-concurrency, conflict-banner, g5-extraction, honest-refusal]

# Dependency graph
requires:
  - phase: 186-06
    provides: "`useDraftPersistence` — the whole write seam, its six-arm `PersistState`, `AUTOSAVE_DEBOUNCE_MS`, the two hold sentences and `SAVE_FAILED_SENTENCE`"
  - phase: 186-04
    provides: "the retired store `saveState` slot, `setProjectFolder`, and the reworded D-184-05 fence naming the hook as the write's home"
  - phase: 186-03
    provides: "`updateWorkflowDraft(id, def, token?, signal?)`, `WorkflowDraftWriteResult`, `token` on `WorkflowDraftRow`, and the three named refusals"
provides:
  - "autosave LIVE in the product — an edit lands a guarded PATCH ~1 s after the author stops"
  - "`BuilderInitial.token` — the opaque concurrency token carried on all four Builder entry paths"
  - "`BuilderSaveRegion` — the four save sentences and the three controls, in one component"
  - "`BuilderHeaderBar` — moved out of the page unchanged (G-5)"
  - "`PUBLISHED_CONFLICT_MESSAGE` relocated to `useDraftPersistence`, beside the branch that picks it"
  - "`PublishGauntletProps.onRunningChange` — the D-186-12 publish-in-flight boolean"
affects:
  - "186-08 (the promoted KB chip renders on this same header; the `actionGroup` mount and `BuilderSaveRegion` must not be disturbed)"
  - "187 (the `blocked_stage` verdict half of BUG-260731-03)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A reporter threaded BACK through an existing render prop (`renderPublish`'s 4th argument) rather than a new context, to carry one boolean"
    - "A receipt retired by the next CHANGE rather than by a timer (`saved && !dirty`)"
    - "A test harness that composes the real write hook beside the component under test, so a zero-write claim is measured against a loop that is genuinely watching"

key-files:
  created:
    - frontend/src/components/workflows/BuilderSaveRegion.tsx
    - frontend/src/components/workflows/BuilderHeaderBar.tsx
  modified:
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/hooks/useDraftPersistence.ts
    - frontend/src/hooks/useDraftPersistence.test.tsx
    - frontend/src/components/workflows/PublishGauntlet.tsx
    - frontend/src/components/workflows/WorkflowDoorSwitch.tsx
    - frontend/src/components/workflows/WorkflowCanvas.editing.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.session.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx

key-decisions:
  - "`PUBLISHED_CONFLICT_MESSAGE` MOVED into the hook (186-06's first option) rather than a discriminator added to the `error` arm — the branch that chooses it moved, so the string moved with it; the page re-exports the name, the `SAVED_STILL_A_DRAFT` precedent applied a second time."
  - "`GENERIC_SAVE_ERROR` RETIRED with a tombstone. Keeping it beside the hook's `SAVE_FAILED_SENTENCE` would have left one situation with two spellings — the failure 186-04 retired the store's parallel save enum for."
  - "G-5 was honoured by EXTRACTION, not by cutting reasons out of docblocks. Two components left the page: the net-new `BuilderSaveRegion`, and `BuilderHeaderBar` unchanged."
  - "The quiet autosave line is FLAG-GATED and the conflict banner is NOT: the line describes a loop that only runs with the canvas flag on, while a conflict is reachable through the explicit Save button on any surface and must always offer both exits."
  - "`publishInFlight` is threaded through the EXISTING `renderPublish` seam as an optional 4th argument plus one optional `PublishGauntlet` prop — a boolean reporter, not a state channel."
  - "The panel's blur commit is `saveNow` behind a `dirty` check, so a no-op blur cannot bump the row and invalidate every other tab's token."

patterns-established:
  - "A zero-network fence extended to name the API CLIENT as well as `fetch`, because the client rejects at the auth step before `fetch` under jsdom — a fetch-only spy could not falsify the claim"

requirements-completed: []

# Metrics
duration: ~65min
completed: 2026-08-01
---

# Phase 186 Plan 07: The page composes the loop, and gets smaller doing it

**Autosave is live in the product: an edit lands a guarded PATCH about a second after the author stops, the token reaches the Builder from all four entry paths, a conflict raises an alert that offers Reload before Overwrite — and `WorkflowBuilderPage.tsx` came out of it 36 lines SHORTER than it went in.**

## Performance

- **Duration:** ~65 min
- **Tasks:** 3
- **Files:** 2 created, 10 modified — 1114 insertions / 247 deletions across the plan
- **Tests:** 232 → 260 on the seven suites the plan names; the wider 50-file workflow subset is **1901 passed, 0 failed**

## G-5 evidence — the measured numbers

```
$ git diff --stat 43696415..HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx
 frontend/src/pages/WorkflowBuilderPage.tsx | 424 +++++++++++++----------------
 1 file changed, 194 insertions(+), 230 deletions(-)
```

**230 deletions > 194 insertions. NET NEGATIVE by 36.** The file is **1656 → 1620** lines.

That did not happen on the first pass, and how it was fixed is worth recording. Composing the hook and adding the two surfaces produced **+356 / −148** — a file 50 lines *bigger*, because ~200 of those insertions were docblock prose. Trimming prose alone got it to **+190 / −176**, still positive, and going further would have meant deleting the *reasons* this codebase keeps in its comments. So the number was fixed the way G-5 actually intends:

| Move | Lines off the page |
|---|---|
| `BuilderSaveRegion.tsx` — the four save sentences, their constants and the three controls, net-new in this plan | ~145 |
| `BuilderHeaderBar.tsx` — moved out **verbatim**, zero DOM change, zero behaviour change | ~50 |
| Prose tightened (every fact kept, restatements removed) | ~65 |

`BuilderHeaderBar` is a pure-layout component with no state, no handler and no knowledge of its children, so the move is byte-neutral at the DOM — which is why `WorkflowBuilderPage.header.test.tsx`'s **literal markup pin passes unedited** on both sides of it.

## Task commits

| Task | Name | Commit |
|---|---|---|
| 1 | The token reaches the Builder from all four entry paths | `d4c760dd` |
| 2 | Compose the hook; the page loses the seam and gains two sentences | `30a45a9c` |
| 3 | F12 — a cosmetic drag still reaches the network zero times | `4b6bc297` |

## What was built

### Task 1 — the token, on all four routes

`BuilderInitial` gained `token?: string | null` with a docblock that states it is bytes, that it is never parsed into a date value, that absent means the first write goes unguarded, and that four routes reach the Builder and each must carry or knowingly lack one.

All four seeding sites in `WorkflowsPage` carry it: `onTweak` and `onUseStarter` from `createWorkflowDraft`'s response, `onOpenDraft` from the drafts row (`?? null`, so a shelf row read before the field shipped degrades to an unguarded first write rather than a crash), and `openBuilderFresh` deliberately seeds nothing at all.

**The pass-through cast was widened, which was the highest-risk line in the plan and is now the highest-value one.** It is a hand-built object rather than a spread, so a token added to state but forgotten there would produce a Builder that autosaves with no guard and **no visible symptom** until it clobbered something. It is now listed explicitly and pinned by a test.

### Task 2 — the composition

**Off the page:** `saveState`, `saveErrorMessage`, `savedTimerRef`, `draftIdRef`, `creatingRef`, `onPersist`, `onSaveDraft` and the 409-by-name catch.

**Onto the page:** one `useDraftPersistence` call, composed exactly like the `useLiveValidation` call two dozen lines above it — `enabled` is *drafted + canvas-enabled* (never `hasEdited`, per 186-06's note 3), and `validationCause` is derived as a **primitive** so the hold gate does not churn on every validation beat.

**The two surfaces**, both mounted in the header's existing `actionGroup` via `BuilderSaveRegion`:

- a quiet `role="status"` line (`builder-autosave-status`) reading `Saving…` / `Saved · just now` / the loop's hold sentence — **silent at rest, on a refusal and on a conflict**, and flag-gated;
- a `role="alert"` banner (`builder-conflict-banner`) offering **Reload first, Overwrite second**, asserted positionally in two suites by `compareDocumentPosition` *and* by index within the banner.

The shipped Save-draft button survives as the commit-now affordance, keeps `Saved · still a draft`, and now calls `saveNow()`. Nothing shipped was deleted.

**Three docblocks that would otherwise have lied were corrected**, and a fourth had to be too:
- the D-184-05 handoff at the top of the file now says where the write lives, agreeing in substance with 186-04's corrected `builderStore.ts` fence;
- the `SAVED_STILL_A_DRAFT` re-export no longer names the retired store type (`grep -n "\bSaveState\b"` → **0 hits**);
- `UNSAVED_LEAVE_PROMPT` and the `beforeunload` block record D-186-03's meaning change — same words, same code, but the question moved from *"you forgot to save"* to *"a write genuinely failed or is being held"*;
- **(not in the plan)** the `initial` prop's docblock said `draftId` "seeds both state + the draftIdRef", a ref this plan deleted.

### Task 3 — F12, extended

A harness composing the **real** `useDraftPersistence` over a **real** builder store, beside the editable canvas. A cosmetic nudge is driven through the shipped `drag` helper, the offset is confirmed written to `canvasNudge`, then the clock runs past `AUTOSAVE_DEBOUNCE_MS + 400` — and the accumulated `fetchSpy`, `createWorkflowDraft` and `updateWorkflowDraft` counts are all **0**, with `dirty` still `false`. A **positive control** in the same block proves the harness's loop is live (a real `patchConfig` edit writes exactly once). A final describe, declared last so it runs last, pins the whole file's accumulated fetch count at 0.

Neither `canvasNudge.ts` nor `WorkflowCanvas.tsx` was opened.

## RED evidence — the F12 falsification, observed before it was trusted

The plan requires the new case to be observed FAILING if the nudge is routed through the write path. It was planted, run, and reverted. Verbatim:

```
× F12: a cosmetic nudge writes nothing WITH autosave live
    > a nudge-only drag issues ZERO requests and ZERO draft writes across the whole window
AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times

× F12: ... > the loop in that harness IS live — a real edit does write (the positive control)
AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times

 Test Files  1 failed (1)
      Tests  2 failed | 55 passed (57)
```

The planted defect was three lines inside the test's own `onNudge`:

```ts
// PLANTED DEFECT (temporary): route the cosmetic offset through the definition.
store.getState().patchConfig(slug, { prompt: `nudged to ${dy}` })
```

Reverted → `Tests 57 passed (57)`; `grep -c "PLANTED DEFECT"` → **0**.

> **The falsification is why the fence had to grow past `fetch`.** With a fetch-only spy, the planted defect would have gone **green**: `getAuthHeaders()` throws `"Not authenticated"` before `fetch` is ever reached under jsdom, so a nudge wrongly routed into the write path raises no fetch at all. A fence that cannot go red is not a fence — this is 185's *observe the falsification first* lesson catching a real hole in an inherited guard.

## Test counts — before / after, per file

| File | Before | After | Note |
|---|---|---|---|
| `WorkflowBuilderPage.test.tsx` | 15 | **15** | 1 assertion retargeted, none deleted |
| `WorkflowBuilderPage.session.test.tsx` | 17 | **23** | +6 (token on the wire ×2, autosave ×2, conflict ×2); 2 retargeted |
| `WorkflowBuilderPage.canvas.test.tsx` | 77 | **84** | +7 (quiet line ×3, banner ×4) |
| `WorkflowBuilderPage.header.test.tsx` | 15 | **15** | untouched; its markup pin passes unedited |
| `WorkflowsPage.test.tsx` | 23 | **23** | untouched |
| `WorkflowCanvas.editing.test.tsx` | 54 | **57** | +3; **1 deletion**, explained below |
| `canvasNudge.test.ts` | 31 | **31** | re-run unedited as the second half of the evidence |
| `useDraftPersistence.test.tsx` | 22 | **23** | +1, for the published-row branch this plan added |
| **Total (the plan's 7 + the hook's)** | **254** | **271** | strictly increasing everywhere |

**The one deletion in `WorkflowCanvas.editing.test.tsx`** (`git diff --numstat` → `153 1`) is the line `import { createElement } from "react"`, replaced by `import { createElement, useMemo } from "react"`. No assertion, describe or helper was removed.

## Verification

| Check | Result |
|---|---|
| `npx tsc -b --force` total errors | **33** == baseline |
| …of which name a file this plan touched | **0** |
| `npx vite build` | **exit 0**, `WorkflowCanvas-*.js` still its own 195 kB lazy chunk |
| `npx vitest run src/pages/ src/components/workflows/ src/hooks/ src/lib/api.workflows.test.ts` | **1901 passed, 0 failed** (50 files) |
| The plan's 6 targeted suites, run together | **183 passed** |
| `git diff --name-only` on `backend/`, `supabase/migrations`, `WorkflowCanvas.tsx`, `canvasNudge.ts`, `CanvasToolbar.tsx` | **0 files** |
| Post-commit deletion check (all three commits) | **0 tracked files deleted** |
| Untracked files left behind | none — `git status --short frontend/` is empty |

### Grep criteria — measured

| Criterion | Required | Measured | Note |
|---|---|---|---|
| `grep -c "token" WorkflowsPage.tsx` | ≥ 4 | **13** | each of the three `setBuilderInitial({` calls carries one |
| `grep -n "definition: builderInitial.definition, draftId: builderInitial.draftId"` | 0 | **0** | the cast was widened, not left behind |
| `grep -c "useDraftPersistence" WorkflowBuilderPage.tsx` | ≥ 1 | **8** | |
| `grep -c "export const HOLD_" WorkflowBuilderPage.tsx` | 0 | **0** | the hold sentences are rendered, never re-declared |
| `grep -c "UNSAVED_LEAVE_PROMPT"` | unchanged | 2 → **3** | the guard was not deleted; the extra hit is the new docblock recording D-186-03 |
| `grep -n "\bSaveState\b" WorkflowBuilderPage.tsx` | 0 hits | **0 hits** | see Deviation 1 |
| `grep -c "onPersist\|onSaveDraft\|draftIdRef\|creatingRef\|savedTimerRef"` | 0 | **2** | see Deviation 1 |
| `grep -c "AUTOSAVE_DEBOUNCE_MS" WorkflowCanvas.editing.test.tsx` | ≥ 1 | **2** | imported, never retyped |
| `git diff --numstat` deletions in `WorkflowCanvas.editing.test.tsx` | 0 | **1** | the `createElement` import line; explained above |

## The `publishInFlight` wiring — for 186-08, which renders on this same header

D-186-12 needed a boolean the page could not observe: `PublishGauntlet` owns `loading` privately and the page reaches it only through the `renderPublish` render prop. It is threaded through **that existing seam**, in three small pieces:

1. `PublishGauntletProps.onRunningChange?: (running: boolean) => void` — optional and additive, in the `blockedReason` shape. One `useEffect` reports the flag the component **already keeps**, and reports `false` on unmount so a Builder cannot be left holding its writes because the gauntlet closed mid-request. Absent ⇒ today's behaviour byte for byte; `PublishGauntlet.test.tsx` is unedited and green.
2. `renderPublish` gained an optional **4th argument**. A three-parameter implementation is still assignable, so no existing call site changed. `WorkflowDoorSwitch`'s pass-through type was widened identically.
3. `WorkflowsPage` forwards it; the page holds one `useState<boolean>` whose only reader is the hook's hold gate.

**186-08 must not disturb `actionGroup`'s shape.** The header's merged row still has exactly **two** direct children (pinned in `canvas.test.tsx`, re-measured with the conflict banner on screen), and everything the header says about saving now lives in `BuilderSaveRegion` — a new chip belongs in `identityGroup`, not in the save cluster.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] Two acceptance greps are unsatisfiable without editing files this plan may not open**

- **Found during:** Task 2 verification. The sixth consecutive plan in this phase to hit this shape.
- **Issue A:** `grep -c "onPersist\|onSaveDraft\|draftIdRef\|creatingRef\|savedTimerRef"` must return **0**. Two hits are unavoidable: `onSaveDraft:` is a property of `CanvasSession`, an interface owned by `WorkflowCanvas.tsx` (a **read-only fence**), and `onPersist=` is a required prop of `PhaseFormPanel`, a file outside this plan. Both are other components' public interfaces; renaming either means opening a fenced or out-of-scope file, and spreading them (`{...{ onPersist: … }}`) to dodge the count is exactly the obfuscation 186-03 caught and reverted in itself.
- **Issue B:** `grep -n "SaveState"` must return 0 hits "naming the retired store type" — but the substring matches `toolbarSaveState`, the page's own variable for the toolbar's *surviving* enum.
- **Fix:** measured the PROPERTY each grep protects. **Zero declarations** of any of the five removed symbols remain (the `useState`, the two refs and both callbacks are gone); the two residual hits are JSX/object **attribute names** owned elsewhere. `grep -n "\bSaveState\b"` — the word-boundary form 186-04 used for the same criterion — returns **0 hits**. Two further prose hits were found and removed as part of this: one docblock still named the deleted catch, and the `initial` prop's docblock still claimed `draftId` seeds a `draftIdRef` that no longer exists.
- **Committed in:** `30a45a9c`.

**2. [Rule 3 — Blocking] `GENERIC_SAVE_ERROR` and the hook's `SAVE_FAILED_SENTENCE` are two spellings of one situation**

- **Found during:** Task 2, wiring the refusal line.
- **Issue:** With `PUBLISHED_CONFLICT_MESSAGE` moved into the hook, the page's remaining `GENERIC_SAVE_ERROR` ("Couldn't save") became a second, differently-worded home for the exact case the hook already answers with `SAVE_FAILED_SENTENCE`. Rendering both was impossible; rendering the page's would have meant string-comparing the hook's sentence to decide.
- **Fix:** retired `GENERIC_SAVE_ERROR` with a tombstone comment stating the four facts (no other consumer, verified by grep; one situation must not have two spellings; the wording changed deliberately to this phase's refusal voice; and why it is recorded rather than deleted silently). **One** shipped assertion changed its expected literal, and the reason is written into the test beside it.
- **Committed in:** `30a45a9c`.

**3. [Rule 2 — Missing critical functionality] The published-row sentence would have regressed**

- **Found during:** Task 2, flagged in advance by 186-06's handoff note 1.
- **Issue:** `WorkflowConflictError` landed in the hook's cause-neutral branch, so a save against a published row would have lost the sentence 184-11 shipped for it (D-184-16 debt 3) and told the author only "we couldn't complete the save" — with no way out named.
- **Fix:** took 186-06's first option. `PUBLISHED_CONFLICT_MESSAGE` moved into `useDraftPersistence.ts` with its docblock, `refusalOf` gained a third named branch, and the page re-exports the name so every existing caller and grep still resolves. A new case in the hook's suite pins it and asserts it is **not** the generic sentence.
- **Committed in:** `30a45a9c`.

**4. [Rule 2 — Missing critical functionality] A no-op blur would have manufactured this phase's own conflict**

- **Found during:** Task 2, replacing `PhaseFormPanel`'s `onPersist`.
- **Issue:** The obvious replacement is `saveNow`, which shipped behaviour matches exactly — but `saveNow` deliberately bypasses the loop's `dirty` gate. Every blur, including one on an unchanged field, would then PATCH: bumping `updated_at`, minting a fresh token and invalidating the one every other open tab holds. That is precisely the stale-token conflict this phase exists to prevent, manufactured by the surface that prevents it — the same hazard 186-06's own Deviation 4 added the dirty gate for.
- **Fix:** `onFieldCommit` — `saveNow` behind `store.getState().dirty`. Immediacy is preserved where it matters; a no-op blur writes nothing.
- **Committed in:** `30a45a9c`.

**5. [Rule 1 — Bug] The `saved` receipt had no way to retire itself**

- **Found during:** Task 2, deleting `savedTimerRef`.
- **Issue:** The page's old `saveState` fell back to `idle` on a 2.5 s timer, so a stale `Saved · still a draft` could not survive an edit. The hook's `saved` has no timer. Wired naively, the header would keep claiming a save while the author typed the next change, and the toolbar chip would read `saved` while `dirty` was true.
- **Fix:** the receipt is gated on `saved && !dirty`, and the toolbar derivation reads `dirty` **before** `saved`. A receipt is now retired by the next change rather than by a clock, which is strictly more honest than the timer it replaces. Pinned by a canvas-suite case that edits after a confirmed autosave and asserts the confirmation disappears.
- **Committed in:** `30a45a9c`.

**6. [Rule 3 — Blocking] `publishInFlight` had no source, and the fetch-only F12 fence could not go red**

Both are described in full above (§*The `publishInFlight` wiring* and §*RED evidence*). Each required touching a file the plan's `files_modified` does not list — `PublishGauntlet.tsx` + `WorkflowDoorSwitch.tsx` for the first (one optional prop and one type widening, additive, with `PublishGauntlet.test.tsx` unedited and green), and `useDraftPersistence.ts` for Deviation 3. **No read-only fence was opened**, and `git diff --name-only` on `WorkflowCanvas.tsx`, `canvasNudge.ts`, `CanvasToolbar.tsx`, `backend/` and `supabase/migrations` returns **0 files**.

**7. [Scope] Task 1's wire assertion lives in Task 2's commit**

- **Issue:** The plan asks Task 1 to assert "the forked/opened path hands a non-null token through". Before Task 2 exists, the page calls `updateWorkflowDraft(id, def)` with two arguments by construction, so there is nowhere the token can be OBSERVED. The alternative — inspecting a prop through a new page harness — is what the plan's own fallback clause tells the executor not to invent.
- **Resolution:** Task 1 shipped the plumbing, verified by `tsc` and by every existing suite staying green. The two assertions that pin it end to end (the drafts-row token echoed verbatim on the first PATCH, including its `.123456` microsecond tail; and the token CHAINED from the first PATCH's response into the second) landed in `30a45a9c`, together with a strengthened `WorkflowBuilderPage.test.tsx` row that now pins the create's token on the second save.

### Two retargeted assertions — neither deleted, both explained in the test

| File | Was | Now | Why |
|---|---|---|---|
| `WorkflowBuilderPage.test.tsx` | `toHaveBeenCalledWith("created-1", expect.anything())` | `…, expect.anything(), "tok-from-create")` | The call carries a third argument now, so the two-argument matcher could no longer describe a **correct** call. **Strengthened**, not widened: the id is still pinned and the token is pinned beside it. |
| `WorkflowBuilderPage.session.test.tsx` | `expect(error.textContent).toBe("Couldn't save")` | `…toBe(SAVE_FAILED_SENTENCE)` | Deviation 2. The purpose is unchanged and both halves still measured — a 404 reads as itself and is never told the workflow is published. The suite now reads the **constant**, so a re-wording cannot leave a green test asserting a sentence the product no longer says. |

One further row was **renamed** rather than retargeted: *"a STRUCTURAL edit alone issues ZERO persistence calls — there is no autosave"* is now *"three structural edits in a burst issue ZERO writes while the window is open"*. Every assertion in it is byte-identical; only the name changed, because the sentence it used to prove is no longer true and the one it still proves is the coalescing half of D-186-01. The other half — that the write does eventually happen unasked — is a new case in the 186-07 block.

---

**Total deviations:** 7 — 3 plan-internal blockers, 2 Rule 2, 1 Rule 1, 1 scope note. **No Rule 4.**
**Impact on scope:** two net-new component files (one of them a verbatim move) and three additive edits outside the declared list, each named above. No package installed, no backend file, no migration, no read-only fence opened.

## Issues encountered

- **The G-5 criterion was not met on the first pass, and prose-trimming alone could not meet it.** Recorded in full above. The lesson is the inverse of this phase's usual one: here the criterion was satisfiable *as written*, and the honest way to satisfy it was to move code out rather than to argue the property was met. Hollowing out docblocks to move a number would have been the same failure as obfuscating code to move a grep.
- **The workflow suite is flaky at full parallelism on this machine, and it is not this plan's doing.** A default-concurrency run of the count gate's target set reports 7 failures — 5 rows in `PublishGauntlet.test.tsx` and 2 axe rows in `WorkflowCanvas.test.tsx` — every one of them a 5000 ms **timeout**, and the count varies between runs (7 ↔ 8). At `--maxWorkers=2 --testTimeout=20000` the identical set is **1678 passed, 0 failed**. Proven pre-existing rather than assumed: `git checkout 43696415 -- PublishGauntlet.tsx` (working tree verified clean first, everything already committed — the 186-01 self-destruction failure mode) reproduces **the same 7 rows** with the pre-plan component, and the file was restored immediately.
- **`scripts/vitest-count-gate.cjs` therefore reports VIOLATED**, for that reason alone. Its per-file table shows **no file below its pin** — every delta is `0` or positive, and `WorkflowBuilderPage.canvas.test.tsx` is `+62`.
- **One of my own new canvas tests was wrong before it was right.** It asserted `getAllByRole("banner")` had length 1 while the form panel was open — and `PhaseFormPanel` contributes a `<header>` of its own. Retargeted onto `builder-header-bar` directly, with the reason written into the test, because the subject is the Builder's row and not how many headers a panel brings with it.

## Known stubs

None. Every branch is wired end to end: the token flows from four routes to the wire, the hold gate has a real publish source, both conflict exits are reachable from the DOM, and the quiet line reads real loop state. Nothing renders placeholder data and nothing is gated on work a later plan owes.

## Threat surface

Every threat in the plan's register is implemented and asserted. No new network endpoint, auth path, file access or schema surface — this plan adds no API function and issues no request the hook did not already own.

| Threat | Where it is enforced | Where it is asserted |
|---|---|---|
| T-186-07-01 spoofing a success | the receipt renders only from `kind: "saved"` **and** `!dirty`; `BuilderSaveRegion` narrows the union and derives nothing | canvas suite: silent at rest; `Saved · just now` only after a confirmed write; retired by the next edit |
| T-186-07-02 a cosmetic drag entering the write path | `canvasNudge.ts` untouched and importless; nothing routes a nudge to the store | F12's harness + the planted-nudge falsification observed RED and reverted |
| T-186-07-03 silent loss on navigate-away | the `dirty`-keyed `canLeave` / `beforeunload` guard is KEPT; a refusal leaves `dirty` armed | the four shipped leave-guard rows, unedited and green |
| T-186-07-04 an accidental overwrite | Reload precedes Overwrite in DOM order; neither is invoked by any effect | asserted twice (`compareDocumentPosition` + index within the banner) in two suites, plus a "neither exit is taken by itself" row |
| T-186-07-05 scope creep into a G-5 read-only file | — | `git diff --name-only` on `WorkflowCanvas.tsx`, `canvasNudge.ts`, `CanvasToolbar.tsx` → **0 files** |
| T-186-07-SC package installs | zero packages installed | `git diff --stat` lists only source files |

## User setup required

None — no environment variable, no migration, no cloud-parity step, no package. `scripts/check-deploy-drift.sh` is unaffected.

## Notes for 186-08

1. **The header's merged row must keep exactly TWO direct children.** `WorkflowBuilderPage.canvas.test.tsx` pins it, and 186-07 re-measured it with the conflict banner mounted. A new control goes inside one of the two groups.
2. **Everything the header says about SAVING now lives in `BuilderSaveRegion.tsx`.** The promoted KB chip belongs in `identityGroup`, beside `builder-bound-folder` — not in the save cluster.
3. **`setProjectFolder` already arms `dirty` (186-04), so binding a KB will autosave on its own** about a second later, through this plan's loop. The `hasEdited` half is still 186-08's, at the chip's call site.
4. **The flag-off header is pinned as literal markup** in `WorkflowBuilderPage.header.test.tsx`. Anything added to `identityGroup` that renders with the canvas flag off will break that pin — gate it, or update the pin deliberately and say so.

## Self-Check: PASSED

- `frontend/src/components/workflows/BuilderSaveRegion.tsx` — FOUND
- `frontend/src/components/workflows/BuilderHeaderBar.tsx` — FOUND
- `frontend/src/pages/WorkflowBuilderPage.tsx` — FOUND
- `frontend/src/pages/WorkflowsPage.tsx` — FOUND
- `frontend/src/hooks/useDraftPersistence.ts` — FOUND
- commit `d4c760dd` — FOUND in `git log`
- commit `30a45a9c` — FOUND in `git log`
- commit `4b6bc297` — FOUND in `git log`

---
*Phase: 186-concurrency-autosave*
*Completed: 2026-08-01*
