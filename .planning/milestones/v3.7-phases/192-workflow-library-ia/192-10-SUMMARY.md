---
phase: 192-workflow-library-ia
plan: 10
subsystem: workflow-library-frontend
tags: [frontend, composition, merge, allSettled, deletion, count-gate-pin, D-01, D-02, D-05, D-11, D-16, D-17, LIB-01, LIB-02, LIB-03, LIB-04]

# Dependency graph
requires:
  - phase: 192-02
    provides: "`PublishedWorkflow.is_mine` on both feeds — the bit `CHIP_PREDICATES.yours` reads"
  - phase: 192-05
    provides: "`mergeLibrary` / `filterLibrary` / `chipCounts`, `LibraryRow`, `LIBRARY_STATES`, `sourceFailedMessage`, and the `UNBOUND` re-home this plan closes"
  - phase: 192-06
    provides: "`RunModal` as a module — its render site here is byte-identical"
  - phase: 192-07
    provides: "`LibraryToolbar` and its flat, total prop contract"
  - phase: 192-08
    provides: "`WorkflowDeleteSheet` as a black box — mounted by the card now, not by this page"
  - phase: 192-09
    provides: "`WorkflowCard`, and the testid continuity that makes this plan's untouched-green claim true rather than hopeful"
provides:
  - "frontend/src/pages/WorkflowsPage.tsx — composition: one merged feed, one toolbar, one flat list"
  - "the D-16 merge with per-source failure isolation, proved against a real defect plant"
  - "the ONE authorized count-gate pin lowering of this phase (23 → 22)"
affects: [192-11, 192-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promise.allSettled over independent feeds, with per-source try/catch + per-source latest-wins tickets"
    - "tri-state per-source fetch record (pending / ok / failed) instead of a page-wide boolean"
    - "wire-type -> LibraryRow adapters at the composition boundary, reading `row.source`"
    - "a pin lowered only alongside a named, plan-authorized deletion, in the same commit"
    - "source-level `?raw` pin for a keyword a behavioural test provably cannot distinguish"

key-files:
  created: []
  modified:
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/pages/WorkflowsPage.test.tsx
    - scripts/vitest-count-gate.cjs
    - frontend/src/pages/WorkflowBuilderPage.header.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.session.test.tsx
    - frontend/src/pages/__tests__/PublishedCardDelete.test.tsx

key-decisions:
  - "The D14 honesty banner was DELETED rather than re-worded, because its claim was measured FALSE — a re-worded falsehood is a new falsehood"
  - "The toolbar mounts DURING the first load, not after it: the latest-wins guard exercises a state where the project selection moves while the mount fetch is in flight"
  - "`loading` means 'nothing has answered yet', not 'not everything has answered' — the second is the `Promise.all` mistake one layer up, and the latest-wins guard drove it out"
  - "`Promise.allSettled` is NOT what saves the library today — the per-source try/catch is. Measured, and pinned as source rather than claimed behaviourally"
  - "The post-publish Run CTA survives above the toolbar, with its lookup retargeted to the merged list and drafts excluded"

requirements-completed: []

# Metrics
duration: ~2h05m
completed: 2026-08-11
---

# Phase 192 Plan 10: The Composition Summary

**157-B is live. `WorkflowsPage.tsx` is composition — one merged feed behind one persistent toolbar over one flat list — and the three shelves, the 200px project rail, `FilterItem`, `DraftCard`, `PublishedCard`, `StarterCard`, the dashed build-card and the D14 honesty banner are all gone in one commit. The merge trap the whole phase was warned about is not argued: a rejected `/drafts` is driven against the real defect shape and observed RED, then restored md5-identical — and the measurement that plant produced showed that `allSettled` is NOT what saves the library, which is recorded as a correction rather than left as a claim nobody tested.**

## Performance

- **Duration:** ~2 h 05 · **Tasks:** 3 · **Commits:** 3 (plus this SUMMARY)
- **Files:** 0 created, 6 modified · **777 insertions / 470 deletions** across `b7aceb3a..HEAD`
- **No file was deleted** — `git diff --diff-filter=D b7aceb3a..HEAD` is empty. The 223 deleted lines are four function declarations inside a surviving file.

| Commit | Task |
|---|---|
| `fc57b6a5` | the merged feed — `allSettled`, per-source isolation, three tickets, D-17 semantics |
| `a9881684` | the frame swap — one toolbar, one flat list, and the deletions |
| `b4d2f837` | the suite realignment + the one pin lowering |

## The measured page (this feeds `192-12`'s subtree delta)

**Re-derived at this commit with a named method, and the direction of one number is stated rather than smoothed.**

| | before (`b7aceb3a`) | after | Δ |
|---|---|---|---|
| `wc -l` | **926** | **1007** | **+81 (+8.7 %)** |
| CODE | **615** | **479** | **−136 (−22.1 %)** |
| comment | 270 | 484 | +214 |
| blank | 42 | 45 | +3 |

⚠ **THE FILE GREW WHILE ITS CODE SHRANK BY A FIFTH, and the growth is the honest number to lead with.** 223 lines of card declarations left; the prose that records *why* they left — the D-11 falsehood receipt, the Phase-193 residual, the merge trap, the `allSettled` correction — is larger than the code it replaced. That is the same shape `188.2` reported when its five-module subtree grew 67 %, and it is stated for the same reason: a later reader who measures `wc -l` and finds 1007 against a plan that deleted four components should find the explanation here, not a surprise.

Method (re-runnable): a blank/comment/code classifier where a line inside a `/* … */` or `{/* … */}` block counts as comment, validated by `blank + comment + code === total` on both columns (42+270+615 = 927; 45+484+479 = 1008 — the classifier's total is `wc -l` + 1 because a trailing newline yields a final empty element).

## What shipped

**Task 1 — the merged feed** (`fc57b6a5`). `Promise.allSettled` over the three fetches, all three latest-wins tickets kept with the published-only asymmetry intact, `mergeLibrary` + `filterLibrary` consumed, per-source failure state, and the page's duplicate `UNBOUND` deleted. **Deliberately sequenced under the OLD frame**: the shelves still rendered, from the merged and narrowed list partitioned by provenance, so the merge was proved against the twenty-three tests that already existed *before* the frame around them changed. All 23 stayed green.

**Task 2 — the frame swap** (`a9881684`). One toolbar, one flat list, and every deletion below.

**Task 3 — the suite** (`b4d2f837`). Two deletions, eleven rewrites, one addition, one pin lowered.

## EVERY DELETED THING, NAMED — so the merge can be verified rather than trusted

No FILE was deleted. What was deleted, all within `WorkflowsPage.tsx`:

| # | Deleted | Where it went |
|---|---|---|
| 1 | `<section data-testid="starters-shelf">` | one flat list; the name survives as the *Starters* chip |
| 2 | `<section data-testid="published-shelf">` + its `GET /workflows/published` chip | the *Ready to run* chip; the literal is gone from the surface (D-11) |
| 3 | `<section data-testid="drafts-shelf">` | the *Still building* chip |
| 4 | the `<nav aria-label="Project filter">` rail and `grid-cols-[200px_1fr]` | one toolbar `<select>`; 200 px returned to the grid |
| 5 | `function FilterItem` | its `aria-pressed` contract is the toolbar's chip skin |
| 6 | `function DraftCard` | `WorkflowCard`, provenance `draft` |
| 7 | `function PublishedCard` | `WorkflowCard`, provenance `published` |
| 8 | `function StarterCard` | `WorkflowCard`, provenance `starter` |
| 9 | the dashed `data-testid="build-card"` | the toolbar's `library-create` |
| 10 | the D14 honesty banner | **nowhere — see below** |
| 11 | the two **library** renders of `<NetNewFlag />` | nowhere; the function and its Builder render stay |
| 12 | four orphaned imports | `lucide-react`, `ui/dropdown-menu`, `WorkflowSoul`, `WorkflowDeleteSheet` |

Lines 906–1128 (223 lines) were the four component declarations, removed as one range. **Every orphaned import was READ OUT of `tsc`** — it named exactly four (`TS6192` ×2, `TS6133`, `TS6192`) — never predicted, the method `192-06` and `192-08` each used for their own cuts.

## The D-11 measurement, verbatim, and why the banner was removed rather than re-worded

The banner rendered:

> *Drafts are yours to shape; **Published** is live (`GET /workflows/published`). Draft create/list/update/delete are `net-new`.*

D-11 asked for a plan-time check before touching it. RESEARCH performed it and the answer is that **the claim is FALSE at HEAD**: all four draft-CRUD routes are live and gated —
`POST /workflows` (`workflows.py:979`), `GET /workflows/drafts` (`:1012`), `PATCH /workflows/{id}` (`:1044`), `DELETE /workflows/{id}` (`:1141`), each carrying `Depends(require_visible("workflow_authoring"))` — and `createWorkflowDraft`, `listDraftWorkflows` and `updateWorkflowDraft` are all called from this very page.

**A disclosure of a falsehood cannot be honestly re-worded**: re-phrasing it in plainer language ships a NEW false statement, which is strictly worse than the one it replaces. So it was deleted, and the reason is recorded at the render site and in the file header rather than in this document alone. The second half of D-11 — the literal route string rendered as user-visible text — left with the Published shelf's chip in the same commit.

## THE MERGE TRAP — driven RED against the real defect, and the plant CORRECTED a claim

The one added test is `a REJECTED /workflows/drafts still renders the published rows and the starter`. A test in which all three feeds resolve is green against `Promise.all` and `Promise.allSettled` alike and proves nothing, so this one was driven against real plants in production source.

| # | Plant (real, in `WorkflowsPage.tsx`) | Result | md5 |
|---|---|---|---|
| 1 | `Promise.allSettled` → `Promise.all(...).catch(() => {})` | **GREEN — the plant did NOT fire** | `aa558148` → `aa558148` |
| 2 | the list gated on `loading \|\| failedSources.length > 0` (the single shared error path) | **RED** — `Unable to find [data-testid="published-card"]` | `aa558148` → `aa558148` |
| 3 | plant 1 again, against the source pin added after it | **RED** — `expected … to contain 'Promise.allSettled('` | `aa558148` → `aa558148` |

**⚠ PLANT 1 IS THE ONE WORTH KEEPING, AND IT CORRECTS THIS PLAN'S OWN HEADLINE CLAIM.** `allSettled` is required by the plan, is the correct shape, and is present — but it is **not what saves the library today**. The isolation that actually holds is the **per-source `try`/`catch` inside each `refetch*`**, each committing behind its own ticket; the aggregate has no consumer, so `all` and `allSettled` are behaviourally identical here and the behavioural test cannot tell them apart. Rather than let a green stand for a guarantee it does not provide:

- the **property** (a refused feed subtracts only itself) is proved behaviourally, RED against plant 2 — the defect RESEARCH actually names;
- the **keyword** is pinned as SOURCE inside the same `it()` (so the count is unchanged), RED against plant 3;
- and the page's own docblock says plainly that `allSettled` is insurance against the *first consumer this aggregate acquires* — a settle-gated spinner, a telemetry hook — which would make `all` re-introduce the gate on the two carve-out feeds instantly and silently.

The claim and the check now match, and neither overstates the other.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] `loading` meant "not everything has answered", which is the `Promise.all` mistake one layer up**

- **Found during:** Task 3, by the latest-wins guard — the only case in the suite that deliberately holds one feed open while the others return.
- **Issue:** Task 1 cleared a single `loading` flag after `allSettled` resolved. That makes the two RUN CARVE-OUT feeds conditional on the SLOWEST feed: two sources had committed real rows and the page rendered a loading line over them. It is the same defect as `Promise.all`, moved from the aggregate into the render gate — **waiting for a feed that has answered is the same lie as hiding a feed that failed.**
- **Fix:** the per-source record became **tri-state** (`pending` / `ok` / `failed`); `loading` is now `!anySettled`, and `updating` is `!allSettled || publishedUpdating` so a count is still never presented as final early. A re-query deliberately does NOT return a source to `pending` — blanking a settled source to signal motion is the count-zeroing D-17's companion rule forbids by name.
- **Verification:** latest-wins green; the merge-trap case green; `tsc` unmoved at 33.
- **Committed in:** `b4d2f837`

**2. [Rule 1 — Bug] Three acceptance greps red on this plan's own prose — the fourth file in this phase to hit it**

- **Found during:** Tasks 2 and 3, at the grep gates.
- **Issue:** `grep -c "GET /workflows/published"` read **4** where Task 2 requires **0**, and `grep -c "shelf"` on the suite read **4** where Task 3 requires **0**. Every avoidable hit was my own comment explaining the removal. This is `192-06` deviation 2, `192-08` deviation 1 and `192-09` deviation 2 in a fourth file: **a raw-count check is blind to the comment/code distinction, so prose about an absence counts as its presence.**
- **Fix:** the route is described in words at all three of my sites; the deleted tests are described by what they asserted rather than quoted by title, with their titles moved to the commit message and the gate comment where a source grep cannot see them. Each omission is stated at the site with its reason, so a later author does not tidy it back.
- **Verification:** `shelf` on the suite → **0**. `GET /workflows/published` on the page → **1**, which is the irreducible residual below.
- **Committed in:** `a9881684`, `b4d2f837`

### Contradictions inside the plan, resolved rather than papered over

**3. ⚠ TASK 2'S OWN ACCEPTANCE GREP AND ITS OWN INSTRUCTION ARE MUTUALLY EXCLUSIVE.** Task 2 requires `grep -c "GET /workflows/published"` to equal **0**, AND requires `NetNewFlag` to survive untouched, AND states that `WorkflowBuilderPage.header.test.tsx` pins the Builder band by byte-exact `innerHTML` **including the flag's full `title=` string** — which contains that literal. All three cannot hold.

Resolved in the direction the phase has taken three times: make the cheap raw check truthful everywhere it costs only phrasing, and state the one place it cannot be. **The count is 1, and it is `NetNewFlag`'s tooltip at `:173`** — a render that no longer appears on the library surface at all. It is recorded in the function's own docblock as **two Phase-193 residuals** (the hover-only tooltip attribute, and the developer vocabulary inside it) with a named trigger: *whichever phase next edits the Builder breadcrumb band — Phase 193, which owns it — re-captures the byte-exact baseline and retires both in the same commit.* Neither is fixable from 192 without editing a cross-phase assertion this plan is not allowed to move.

**4. ⚠ RESEARCH'S TEST CLASSIFICATION IS RIGHT ABOUT CONTRACTS AND UNDERSTATES THE WORK BY ROUGHLY HALF.** It predicts *two deletions, four rewrites, seventeen green*. **Measured: the restructure turned 13 of 23 red, not 6.** The classification is not wrong — all eleven surviving contracts ARE intact — but it classified by CONTRACT and the seven extra failures are INTERACTION changes it did not model:

| Case | Why it needed a rewrite RESEARCH did not predict |
|---|---|
| latest-wins (`:187`) | classified *"must stay green"*, but it picks a project by clicking the rail. Clicking an `<option>` fires no `change` in jsdom |
| Tweak ×3 (`:394`–`:421`) | the fork verb is now ONE word inside the card's `⋯` (D-09/D-12), not a button on the card face |
| `onUseStarter` fork (`:446`) | same, plus the starters shelf it scoped through is gone |
| build-card fresh build (`:488`) | RESEARCH did note this one needs a new click target |
| back-nav refetch (`:499`) | classified *"must stay green"*, but it enters the Builder via `build-card` and witnesses return via `drafts-shelf` |

Every assertion in all eleven is unchanged. Only the route to it moved. **Two deletions is exact**; four rewrites is really eleven.

**5. Four consumer sites in three OTHER suites had to move, and they were found by RE-RUNNING rather than by prediction.** `WorkflowBuilderPage.header.test.tsx` (`build-card` → `library-create`), `WorkflowBuilderPage.session.test.tsx` (the same, plus three `drafts-shelf` presence checks → `library-toolbar`), and `PublishedCardDelete.test.tsx`'s 192-08 one-direction fence. **No test count changed in any of them** — header still reads 32, session still reads 23 — because a selector change must never move a count.

**6. `PublishedCardDelete.test.tsx`'s one-direction fence was RE-POINTED, and its property got stronger.** When `192-08` wrote it, the Sheet's host was `PublishedCard` *inside the page*, so *"the page imports the Sheet"* and *"exactly one host imports the Sheet"* were the same claim. They are not any more: `192-09` built the one card and this plan deleted the three it replaces, so the host is `WorkflowCard`. The row now reads BOTH sources — the import edge and the `published-delete` trigger are asserted on the card, and the page is asserted to name the module **nowhere at all**, which `192-08` could not assert because the page was the host. Same property, moved subject, and strictly more than before.

**7. `deleteWorkflowDraft` was added to ONE `vi.mock` factory, not six.** The plan says to check every suite that mounts the page and *"read the failure, do not guess."* Read: Vitest's mocked-module access is lazy, so a missing symbol throws only where it is REACHED. All five other page-mounting suites were re-run and stayed green, so none gained a line it did not need.

**8. The worktree came up at `fda79214` again** — a `master` merge commit — rather than the dispatched base `b7aceb3a`. `git merge-base` returned `3781a3fe`, the startup assertion fired, and the worktree was reset before anything was read. **This is now eight of eight worktrees in this phase**, exactly as the brief predicted. All three commits sit directly on `b7aceb3a`.

---

**Total deviations:** 2 auto-fixed (both Rule 1), 6 plan contradictions or under-predictions resolved. **Impact on scope:** none. No new capability, no new dependency, no schema or API surface, zero packages installed.

## The pin — the ONE lowering of this phase

**23 → 22, in the same commit as the two deletions that justify it, at a number READ FROM THE GATE'S OWN `actual` COLUMN.**

The run made against the restructured suite printed:

```
WorkflowsPage.test.tsx                       23      22      -1
FAIL  [count-decrease] WorkflowsPage.test.tsx — pinned 23, ran 22 (-1).
```

**22 is the measurement.** The arithmetic (23 − 2 deleted + 1 added = 22) merely has to AGREE with it; if it ever did not, the measurement would win. Two runs after the edit printed `delta 0`, both `exit 0`.

The two deleted tests, named in the gate comment and the commit message so the trade is auditable:

1. *"the Published shelf renders ABOVE the Drafts shelf (DOM order — BUG-260628-01 fold, D-143-5)"*
2. *"folds BUG-260628-01 (SC-e): section order is Starters → Published → Drafts (runnable no longer buried under drafts)"*

**The bug they folded is not un-fixed by their removal.** BUG-260628-01 was *"runnable work is buried under drafts"*; 157-B answers it more strongly than a section order can — a user who wants runnable rows says so with the *Ready to run* chip and receives exactly the count that chip promised, which `libraryFilter.test.ts` proves as arithmetic, per chip, without a DOM.

`git diff scripts/vitest-count-gate.cjs` changes **exactly one** numeric value, downward. **No other pin was touched.**

## The testid continuity contract — verified BEFORE the rewrite, then measured after

The plan required checking that `192-09` actually shipped the four ids before rewriting seventeen tests on the strength of it. Measured on `WorkflowCard.tsx` before Task 3 began: `published-run` `:442`, `published-tweak` `:362`, `use-starter` `:371`, `draft-open` `:451` — each **1**, each verbatim. `published-delete` `:383` too. `draft-publish` is **0**, which is D-10 working.

| | suites | tests | failures |
|---|---|---|---|
| every suite consuming a shipped card testid | **8** | **194** | **0** |

**The delta versus this plan's base is exactly −1, and it is fully accounted for:** 23 + 32 + 23 + 32 + 32 + 16 + 35 + 2 = **195** before, **194** after — the net of two deletions and one addition in `WorkflowsPage.test.tsx`, and nothing else moved.

⚠ **One inherited figure is corrected:** `192-09-SUMMARY.md` reports *"the 10 suites consuming the shipped testids — 176 passed"*. Derived here by `grep -rl` over every test file for the nine shipped ids, the set is **8 files**, not 10. The files named are all real; the count and total differ, so `176` should not be quoted forward as this plan's baseline — **195 → 194** is, and it is re-derivable from the pins above.

## Gates

| Gate | Result |
|---|---|
| `node scripts/vitest-count-gate.cjs` | **exit 0, TWICE after the pin edit** — `total 3141 · failed 0`, `56/56 pinned present`, no per-file decrease, `WorkflowsPage.test.tsx delta 0` on both |
| `vitest run src/pages/WorkflowsPage.test.tsx` | **22 passed / 0 failed** |
| `vitest run src/pages src/components/workflows/library` | **629 passed / 0 failed** (22 files) |
| `WorkflowBuilderPage.header.test.tsx` | **32 tests, 0 failures** — the byte-exact breadcrumb band unmoved |
| `WorkflowBuilderPage.session.test.tsx` | **23 tests, 0 failures** |
| the 8 testid-consumer suites | **194 passed / 0 failed** |
| `tsc -p tsconfig.app.json --noEmit` | **33** — the recorded baseline, unmoved, at four separate measurements (before writing a line, after Task 1, after Task 2's deletions, after Task 3) |
| `eslint src/pages/WorkflowsPage.tsx` | **0** |
| `eslint src/pages/WorkflowsPage.tsx -c eslint.a11y.config.js` | **0** |
| `git diff --diff-filter=D b7aceb3a..HEAD` | **empty** — no file deleted |

Every vitest invocation carried `GSD_VITEST_MAX_WORKERS=4` **and** `--maxWorkers=4`. This plan ran as the only executor in its wave and **the gate did not flake once** across four full runs — the third consecutive confirming data point after `192-08` and `192-09`.

### Task-2 acceptance greps, all measured on the shipped file

| Check | Required | Measured |
|---|---|---|
| `starters-shelf\|published-shelf\|drafts-shelf` | 0 | **0** |
| `function FilterItem\|DraftCard\|PublishedCard\|StarterCard` | 0 | **0** |
| `build-card` | 0 | **0** |
| `grid-cols-[200px_1fr]` | 0 | **0** |
| `GET /workflows/published` | 0 | **1** — see deviation 3 |
| `function NetNewFlag` | 1 | **1** |
| `<NetNewFlag` | 1 | **1** |
| `run-cta` | ≥ 1 | **1** |
| `openBuilderFresh` | ≥ 1 | **2** |
| `allSettled` | ≥ 1 | **4** |
| `Promise.all(` | 0 | **0** |
| `publishedSeqRef` / `startersSeqRef` / `draftsSeqRef` | ≥ 2 each | **5 / 4 / 4** |
| `mergeLibrary` | ≥ 1 | **3** |
| `soulDeliverable\|tierForDefinition` | 0 | **0** |
| `UNBOUND` | ≥ 1 | **7** (imported; the page's own `const` is gone) |
| `scope: "mine"` | must survive | **1** |
| `shelf` in the suite | 0 | **0** |
| `deleteWorkflowDraft` in the suite | ≥ 1 | **2** |

## Threat Model Status

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-192-03 | mitigate | **Mitigated and PROVED — and the proof is more precise than the plan's wording.** A rejected `/drafts` renders both carve-out feeds in full, degrades to zero drafts, and names the refusal. Driven RED against the single-shared-error-path plant. ⚠ The mitigation is the **per-source `try`/`catch`**, not the `allSettled` keyword: plant 1 measured `Promise.all` behaviourally indistinguishable here, so the keyword is pinned as source instead of credited with a guarantee it does not currently provide. |
| T-192-26 | mitigate | **Mitigated.** Four states held apart — loading (no list, no counts presented as final), genuinely empty, filtered-to-empty (with the toolbar's *Clear search & filters* one click away), and a source failed (named, others still rendered). The tri-state record is what makes `pending` ≠ `failed` ≠ `ok`; deviation 1 records the version that got this wrong and how it was caught. |
| T-192-27 | mitigate | **Mitigated.** D-17 implemented for all three row kinds through `matchesProject`, which the page does not re-state: published narrowed server-side (`?project_folder_id=`, plus the `UNBOUND` client narrow the server cannot express), drafts client-side, starters held out. `192-07`'s note states the fact in the toolbar; this plan neither duplicates nor contradicts it. |
| T-192-18 | mitigate | **Mitigated and PROVED.** `NetNewFlag` is not deleted; only its two library renders are. `WorkflowBuilderPage.header.test.tsx` reports **exactly 32 tests, 0 failures**, byte-exact band unmoved. |
| T-192-06 | mitigate | **Mitigated.** Exactly one pin lowered, in the same commit as two named deletions, at a number read from the gate's own `actual` across two agreeing runs. `git diff` on the gate changes one numeric value. |
| T-192-28 | accept | **Held.** `openBuilderFresh` → `setBuilderInitial(null)` + `setPageView("builder")` is byte-unchanged; the create control merely calls it. Asserted by the rewritten fresh-build cases in three suites. |
| T-192-SC | accept | **Held.** Zero packages installed. |

**Threat flags:** none. No new network surface, no auth path, no file access, no schema change — the three feeds and their endpoints are the shipped ones, reached through the shipped clients.

## Known Stubs

None. Every prop the page passes is wired to real behaviour, including the two the toolbar previously had no consumer for (`updating`, `onClearAll`) and all five of the card's callbacks.

## What the next plans inherit

- **`192-11`** — the page-level hooks now exist and are addressable: `library-toolbar`, `library-list`, `library-loading`, `library-empty`, `library-filtered-empty`, and `library-source-failed-{starter|published|draft}`. **The `is_mine === (provenance !== "starter")` cross-check `192-02` raised is still OWED and is yours** — this plan wires `is_mine` through `mergeLibrary` unchanged and asserts nothing about it. `?scope=mine` is untouched and must stay: D-16's dedupe-free property depends on it.
- **`192-12`** — the four pin raises `192-05`/`192-07`/`192-09` owe are UNCHANGED and still owed (`WorkflowCard` 35, `LibraryToolbar` 36, `libraryFilter` 36, `librarySubtree.fences` 47, plus `PublishedCardDelete` 7 → 32). **This plan's own pin is settled at 22 and needs nothing further.** The RED-plant obligation on `WorkflowDeleteSheet.tsx` also remains.
- **Phase 193** — the two `NetNewFlag` residuals, with their trigger recorded at the function.
- **Whoever re-homes the strings** — `192-07`'s four and `192-09`'s five into `libraryVocabulary.ts`. This plan added none: every user-facing string it renders is imported from that module.

## User Setup Required

None — no external service configuration, no dependency, no migration, no env var.

## Requirements

`LIB-01`…`LIB-04` sit in this plan's frontmatter and **all four finally become user-observable here** — this is the plan that mounts the surface the previous five built. They were nonetheless deliberately **NOT** marked complete: no `state.*`, `requirements.mark-complete` or `roadmap.update-plan-progress` verb was called, and `.planning/STATE.md` / `.planning/ROADMAP.md` are untouched. Marking them is the orchestrator's job at phase end, after verification.

## Self-Check: PASSED

- `frontend/src/pages/WorkflowsPage.tsx` — **FOUND** (1007 L · 479 code · 0 shelf testids · 0 card declarations · 0 `build-card` · 1 `NetNewFlag` render)
- `frontend/src/pages/WorkflowsPage.test.tsx` — **FOUND** (22 tests · 0 failures · 0 `shelf`)
- `scripts/vitest-count-gate.cjs` — **FOUND** (one pin lowered 23 → 22, one numeric change in the diff)
- Commit `fc57b6a5` — **FOUND** in `git log`
- Commit `a9881684` — **FOUND** in `git log`
- Commit `b4d2f837` — **FOUND** in `git log`
- `git diff --diff-filter=D b7aceb3a..HEAD` — empty (no file deleted)
- `git status --short` — clean apart from this SUMMARY; all three plants reverted, md5 `aa558148` on every restore
- `.planning/STATE.md` / `.planning/ROADMAP.md` — **unmodified**

---
*Phase: 192-workflow-library-ia*
*Completed: 2026-08-11*
