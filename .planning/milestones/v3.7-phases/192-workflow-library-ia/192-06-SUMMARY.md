---
phase: 192-workflow-library-ia
plan: 06
subsystem: workflow-library-frontend
tags: [frontend, verbatim-move, extraction, D-01, LIB-03, characterization-baseline, focus-trap, run-modal]

# Dependency graph
requires:
  - phase: 192-03
    provides: "six whole-`innerHTML` captures + both canvas-gate destination captures + the dialog focus contract, taken at 14b309b4 where this plan's destination path answered `does not exist in 'HEAD'`"
  - phase: 192-05
    provides: "`components/workflows/library/` and the five-fence subtree suite whose explicit path list already named `./RunModal.tsx`"
provides:
  - "frontend/src/components/workflows/library/RunModal.tsx — the Run modal in its own module, 430 L"
  - "A HARD CUT: WorkflowsPage.tsx 1407 → 1068 L, declares the component nowhere, no re-export shim"
  - "The one-direction import edge, asserted over `?raw` sources with the third (no-shim) clause"
  - "192-03's F1 gap CLOSED — the modal's OWN mid-launch Escape guard, asserted in isolation and driven RED"
affects: [192-08, 192-10, 192-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "create-additively-then-cut (188.1's second lesson) — two commits, so the diff reads as a MOVE"
    - "verbatim proved by `sed` + `cmp` against the base commit's blob, not by inspection"
    - "props type DERIVED (`Parameters<typeof RunModal>[0]`) rather than re-declared, so it cannot drift"
    - "pure-insertion test block: `typeof import(…)` types + dynamic `await import(…)` values, no import line widened"

key-files:
  created:
    - frontend/src/components/workflows/library/RunModal.tsx
  modified:
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/pages/__tests__/RunModal.test.tsx

key-decisions:
  - "The delete range is :1054-1406, not :1054-1405 — the extra line is ONE of the two blank lines that would otherwise collide above `export default WorkflowsPage`"
  - "`RunModalProps` is derived from the component rather than hand-declared, so the exported type cannot diverge from the inline props object the move brought over untouched"
  - "The F1-closing rows live in `RunModal.test.tsx` (in `files_modified`), not in `RunModal.a11y.test.tsx` (not in it) — a new file or a foreign file would have been a pin hazard or an ownership breach"
  - "The `useCanvasGate` page→component layering smell is RECORDED in the docblock, not fixed — 192 did not introduce it, and fixing it here is scope creep"

patterns-established:
  - "A docblock that names a fence must not SPELL what a RAW-regex fence forbids — T-192-04 greps, it does not parse (the inverse of F1's 187-24 trap)"

requirements-completed: [LIB-03]

# Metrics
duration: ~55min
completed: 2026-08-11
---

# Phase 192 Plan 06: The RunModal Verbatim Move Summary

**`RunModal` now lives in `components/workflows/library/RunModal.tsx` (430 L) and
`WorkflowsPage.tsx` declares it nowhere — a hard cut with no shim, 1407 → 1068 L, proved
verbatim by `cmp` against the base commit's blob and validated by all six of 192-03's captured
baselines passing with ZERO re-capture. The gap 192-03 named and could not close — the modal's
own mid-launch Escape guard, invisible behind the page's outer guard — is now asserted in
isolation and was driven RED against a real deletion of it.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2 · **Commits:** 2 (plus this SUMMARY)
- **Files:** 1 created, 2 modified

## The measured numbers (every one re-derived, none inherited)

| Measurement | Value | How |
|---|---|---|
| `WorkflowsPage.tsx` **before** | **1407 L** | `wc -l` at base `d5a601cd` |
| `WorkflowsPage.tsx` **after** | **1068 L** | `wc -l` |
| `library/RunModal.tsx` | **430 L** | `wc -l` |
| Moved body extent | **352 L** (`:1054-1405`) | `grep -n "function RunModal("` → 1054; `sed -n '1405,1407p'` → `}` / blank / `export default WorkflowsPage` |
| Range actually deleted | **`:1054-1406`** (353 L) | see the deviation below |
| The cut, `git diff --numstat` | **18 insertions / 357 deletions** on the page | `git diff --numstat` |
| The whole two-commit move | **430 / 0** (new module) · **18 / 357** (page) · **143 / 0** (test) | `git diff --numstat e966168a~1 HEAD` |

188.1's equivalent clean move was 22 insertions / 323 deletions. **The shape holds: a large
deletion against a small insertion.** The 18 insertions on the page are one import line plus
three explanatory comment blocks; only ONE of them is executable.

## The verbatim proof — mechanical, not asserted

The body was never re-typed. It was extracted with `sed` and appended, with `printf 'export '`
supplying the single added keyword, so byte-identity is a property of the construction rather
than of care. Verified twice — once before the first commit, and again after the cut against
the **base commit's blob** rather than the working tree:

```
$ git show d5a601cd:frontend/src/pages/WorkflowsPage.tsx > /tmp/page-base.txt
$ sed -n '1054,1405p' /tmp/page-base.txt        > /tmp/base-body.txt
$ sed -n '65,416p'  …/library/RunModal.tsx      > /tmp/now-body.txt
$ sed '1s/^export //' /tmp/now-body.txt         > /tmp/now-noexp.txt
$ diff /tmp/base-body.txt /tmp/now-noexp.txt && echo IDENTICAL
IDENTICAL vs base commit d5a601cd
```

**The `export ` keyword is the only character added inside the moved range.** Every inline
comment, every `:NNN` reference and every blank line came across untouched — including the
`:NNN`s that point at the *pre-move* page, which the docblock says plainly rather than
rewriting (rewriting them would be an edit, and this must read as a move).

## ZERO RE-CAPTURE — the headline contract

192-03 committed six whole-`innerHTML` captures, both sides of the canvas-gate `run-destination`
branch, and a behavioural focus/dialog contract. **All of them passed after the cut, untouched.**

| Suite | Result after the cut |
|---|---|
| `RunModal.test.tsx` + `RunModal.a11y.test.tsx` | **43 passed** (the captures, pre-addition) |
| `WorkflowsPage.test.tsx` + `WorkflowBuilderPage.header.test.tsx` | **55 passed** |
| All four together, after the new rows | **103 passed** |
| `src/components/workflows/library/` | **83 passed** |

`git diff` over `frontend/src/pages/__tests__/` at the point the baselines were re-run was
**empty** — and the final diff of `RunModal.test.tsx` is **143 insertions / 0 deletions**, one
contiguous append. **Not one `*_BASELINE` literal was edited, re-captured or re-ordered.**

## F1 CLOSED — the gap 192-03 named, driven RED

192-03's finding F1, measured by plant: the mid-launch dismissal guard is DOUBLE — the modal's
own `if (!submitting) onCancel()` and the page's `onCancel` (`if (runSubmitting) return`) — and
**deleting the MODAL's half alone left every assertion green.** D-01 moves the modal and leaves
`onCancel` on the page, so dropping the inner guard during this move would have been invisible.
192-03 also named why it could not close it: the fix needs `RunModal` rendered in isolation,
impossible while it was a module-private function inside a 1407-line page.

The cut is what made it possible, so the assertion landed in the same commit as the cut. Three
rows render the component **directly**, with an `onCancel` that has no outer guard of any kind.

**The RED drive (a real plant in production source, not a synthetic control):**

| Step | Observation |
|---|---|
| `md5sum library/RunModal.tsx` before | `61ecadc73363c80bc520f69f559a944a` |
| Plant: `sed -i '216s/.*/        onCancel()/'` — the guard genuinely deleted | line 216 reads `onCancel()` |
| Run | **`Tests 1 failed \| 31 passed (32)`** — `× Escape mid-launch does NOT reach onCancel — the modal refuses on its own` |
| Blast radius | **exactly one row.** The positive control ("the same Escape DOES reach onCancel when no launch is in flight") stayed green, so the failure is the guard and not a broken wire |
| Restore | `git checkout -- …/RunModal.tsx`; `git status --short` shows the file clean; line 216 reads `if (!submitting) onCancel()` |

⚠ The post-restore `md5sum` reads `81ded820887424fb8c8cd3de3e149522` rather than the pre-plant
`61ecadc7…`, and that is **git's CRLF normalization on checkout, not a residual edit** — `git
status` and `git diff --stat` both report the file clean against the commit. Stated rather than
quietly omitted, because an md5 that does not match is exactly the kind of thing a later reader
would otherwise have to re-derive.

## Task Commits

1. **Task 1 — create `library/RunModal.tsx` additively** — `e966168a` (refactor). The page is
   deliberately UNCHANGED in this commit; both declarations coexist for exactly one commit,
   which is what makes the next one read as a cut rather than a rewrite.
2. **Task 2 — the cut + the F1 closure** — `7114a640` (refactor).

## Files Created/Modified

- **`frontend/src/components/workflows/library/RunModal.tsx`** — created, **430 L**. A 64-line
  docblock in the `PlaneEditingLayer.tsx:1-52` shape, seven import lines, the 352-line body, and
  a derived props type. **Exports exactly two things** (`grep -n "^export "` → 2): the component
  and `RunModalProps`. **No runtime value of any kind**, per `react-refresh/only-export-components`.
- **`frontend/src/pages/WorkflowsPage.tsx`** — 1407 → 1068 L. The declaration deleted, one named
  import added, four import lines corrected, three comment blocks recording what left and why.
- **`frontend/src/pages/__tests__/RunModal.test.tsx`** — +143, a pure insertion at the foot.
  Two new `describe` blocks, five new rows. 27 → **32** tests.

## Verification

| Check | Result |
|---|---|
| `grep -c "function RunModal(" WorkflowsPage.tsx` | **0** |
| `grep -c 'from "@/components/workflows/library/RunModal"'` | **1** |
| `grep -c "export { RunModal"` / `grep -c "export \* from"` | **0** / **0** |
| `tail -1 WorkflowsPage.tsx` | `export default WorkflowsPage` |
| `grep -c "export function WorkflowsPage({ folders, onLaunch }: WorkflowsPageProps) {"` | **1** — the byte-exact plant target `WorkflowBuilderPage.header.test.tsx` holds, unchanged |
| `tsc -p tsconfig.app.json --noEmit` | **33** — the recorded project baseline, unmoved, at every one of four measurements |
| `eslint` on the new module (+ `eslint.a11y.config.js`) | **0** / **0** |
| `eslint src/pages/WorkflowsPage.tsx src/pages/__tests__/RunModal.test.tsx` | **0** |
| `librarySubtree.fences.test.ts` | **47 passed** — F1 / F4 / F5 / T-192-04 now read a real file |
| `WorkflowBuilderPage.header.test.tsx` | **32 / 32 / 0** in the gate table — unmoved (T-192-18) |
| `ChatLayout.launch.test.tsx` | **17 / 17 / 0** — unmoved (T-192-17) |
| `node scripts/vitest-count-gate.cjs` | **exit 0, `count gate OK`, 56/56 pinned present, no per-file decrease** — on **5 of 6** runs; see below |

Every vitest invocation in this plan carried `GSD_VITEST_MAX_WORKERS=4` **and** `--maxWorkers=4`.

### ⚠ The count gate flaked once in six runs — recorded, attributed, not chased

Six runs of the gate on the **identical tree**: `failed 0` · **`failed 2`** · `failed 0` ·
`failed 0` · exit 0 · exit 0. The `failed 2` run's two test names were **not captured**, and
that is stated as a limitation rather than papered over.

What is known, and is enough to attribute it away from this plan's scope:

- **192-05 measured this exact non-determinism on ONE commit** — `failed 6 → 0 → 1 → 3` — and
  read the failing names out of the gate's own JSON rather than guessing: `WorkflowBuilderPage
  .canvas.test.tsx`, `WorkflowBuilderPage.session.test.tsx` and the two `WorkflowCanvas.test.tsx`
  axe rows. **None under `library/`, and none in any file this plan touches.** That set is
  exactly the one this plan's dispatch brief names as known-flaky-under-load.
- This plan's four target suites ran **103/103 on four separate occasions** and its own new rows
  32/32 on three, with no intermittency at all.
- `192-RESEARCH.md` Pitfall 7 already names the session suite as timing out at 5060 ms against a
  5000 ms limit at `--maxWorkers=4` and passing on re-run.

The cap CLAUDE.md prescribes was applied to every run; it is calibrated for two concurrent
agents, and two were running this wave.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] The delete range is `:1054-1406`, not the plan's `:1054-1405`**

- **Found during:** Task 2, before deleting anything.
- **Issue:** `:1053` and `:1406` are BOTH blank (they separate `StarterCard` from `RunModal` and
  `RunModal` from the default export). Deleting only `:1054-1405` leaves the two blanks adjacent
  — a double blank line the file's style does not use anywhere else, i.e. a gratuitous
  formatting change smuggled into a move whose whole claim is that it changed nothing.
- **Fix:** deleted `:1054-1406`, consuming one of the two colliding blanks. The result is `}` /
  one blank / `export default WorkflowsPage`, byte-identical in shape to what preceded the
  component. **The plan's real constraint — never include `:1407` — is respected and was
  re-verified with `sed -n '1405,1407p'` before the delete.**
- **Verification:** `tail -1` → `export default WorkflowsPage`; `eslint` 0.
- **Committed in:** `7114a640`

**2. [Rule 1 — Bug] The new module's docblock reds the T-192-04 fence by SPELLING what it forbids**

- **Found during:** Task 1, at the fence gate.
- **Issue:** the docblock listed the four fences the module now lives under, and named T-192-04's
  as *"no `dangerouslySetInnerHTML`"*. **T-192-04 is a RAW regex** (`const RAW_HTML =
  /dangerouslySetInnerHTML/`, matched against `?raw` source), unlike F1 which is parsed precisely
  so prose about the rule survives. `grep -c` on the new file returned **1** before the fences
  ever ran.
- **Fix:** rephrased to "no raw-HTML escape hatch", with a sentence recording *why* the phrasing
  is deliberate — the exact inverse of the 187-24 trap that made 192-05 parse F1 instead of
  grepping it. This is a real asymmetry between two fences in the same file and the next author
  will hit it too.
- **Verification:** `grep -c` → **0**; `librarySubtree.fences.test.ts` **47 passed**.
- **Committed in:** `e966168a`

### Design decisions the plan left open

**3. `RunModalProps` is DERIVED, not re-declared.** The plan says "export `RunModal` and its
props type". The props are an inline object type on the function, and the move brought it over
untouched. Hand-typing a second `RunModalProps` interface beside it would create exactly the
drift an extraction exists to remove — two declarations of one contract, one of which nothing
checks. `export type RunModalProps = Parameters<typeof RunModal>[0]` reads the surviving
declaration, so it cannot diverge, and it is the idiom already shipped at `RunModal.test.tsx:360`.
Types are erased, so this does not put a runtime value in a component module.

**4. The F1-closing rows went into `RunModal.test.tsx`, not `RunModal.a11y.test.tsx`.** The
Escape/focus contract lives in the a11y file, which is where these rows would naturally sit — but
that file is **not** in this plan's `files_modified`, and 192-07 was executing concurrently. A
brand-new `library/RunModal.test.tsx` was the other option and is worse: it is the pin-DECREASE
hazard this plan was briefed on. Appending to the file this plan already owns is the only choice
that is neither an ownership breach nor a gate risk.

### Inherited claim CORRECTED by measurement

**5. `192-05-SUMMARY.md` says `RunModal.tsx` "carries `title=` today" and that "F1 will fire on
the moved code". Measured, that is FALSE.** `grep -n "title=" WorkflowsPage.tsx` returns six
hits — `:84`, `:550`, `:574`, `:857`, `:1028`, `:1044` — and **every one is above `:1054`**. The
nearest (`:1044`, on `StarterCard`'s "Use this →" button) misses the modal's first line by ten
lines, which is presumably how the claim arose. **`RunModal` carries zero `title` attributes**,
F1 passed on the moved code with no conversion, and **no `aria-describedby` work was owed to or
performed by this plan.**

⚠ **This does not clear the claim for `192-08`** (the `WorkflowDeleteSheet` move), which the same
sentence covers: `:857` sits inside the published-card region and is a genuine live hit. Whoever
executes that move should re-derive rather than inherit either the original claim or this
correction.

---

**Total deviations:** 2 auto-fixed (Rules 3 and 1), 2 open design decisions, 1 inherited claim
corrected. **Impact on scope:** none. No new capability, no new dependency, no schema or API
surface.

## Threat Model Status

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-192-13 | mitigate | **Held.** `grep -Ec "from \"[^\"]*WorkflowsPage(\.[jt]sx?)?\""` on the new module → **0**, and F4 (which ports the load-bearing `(\.[jt]sx?)?` group and the dynamic-import form) passed over it as a real file. The module reaches `@/pages/WorkflowBuilderPage` for `useCanvasGate` — a different specifier, not a cycle, and recorded in the docblock as inherited rather than introduced. **192-12 still owes the RED plant in this file.** |
| T-192-16 | mitigate | **Mitigated and PROVED.** Two-commit create-then-cut; body byte-identical by `diff` against the base commit's blob; six baselines + two destination captures + the focus contract green with zero re-capture; `--numstat` measured (18/357) rather than asserted. |
| T-192-17 | mitigate | **Held.** `onLaunch` untouched; the render site keeps `key={runFor.id}` and all eight props (asserted over `?raw` source, non-vacuity guarded). `ChatLayout.launch.test.tsx` unmoved at **17**. |
| T-192-18 | mitigate | **Held.** `WorkflowBuilderPage.header.test.tsx` unmoved at **32**; the byte-exact export signature line and `export default WorkflowsPage` both asserted present. |
| T-192-SC | accept | **Held.** Zero packages installed. |

**Threat flags:** none. No network surface, no auth path, no file access, no schema change — a
component moved between two files in one frontend bundle.

## Known Stubs

None. Every line moved is live code that was live before it moved.

## Owed to 192-12 — the pin numbers, READ OUT of the gate's own `actual` column

⚠ **`scripts/vitest-count-gate.cjs` is NOT in this plan's `files_modified` and was not touched.**
The raises below are owed, not waived. Both figures come from the gate's printed table across
runs that agreed, never by adding to a number in a comment:

| Suite | Pinned in `BASELINE` today | Measured `actual` now | Delta | Note |
|---|---|---|---|---|
| `RunModal.test.tsx` | **11** | **32** | **+21** | 192-03 raised it 11 → 27; this plan's five new rows take it to 32 |
| `RunModal.a11y.test.tsx` | **8** | **16** | **+8** | unchanged by this plan — 192-03's figure, re-read here and confirmed |
| `libraryFilter.test.ts` | *unpinned* (`new`) | **36** | — | 192-05's, still unpinned |
| `librarySubtree.fences.test.ts` | *unpinned* (`new`) | **47** | — | 192-05's, still unpinned |

**The pin-DECREASE hazard this plan was briefed on did NOT materialise, deliberately.** No test
case was relocated out of `frontend/src/pages/__tests__/` into a new `library/` suite; the new
coverage was appended to the file that already exists. Both pinned files went **up**, and the
gate fails only on a decrease.

Also visible in the gate table and **not this plan's**: `PhaseTimeline.test.tsx` 17 → 21 (+4) and
`PublishedCardDelete.test.tsx` 7 → 26 (+19). Both are present at the wave-2 base `d5a601cd` and
outside this plan's `files_modified`; logged so a later reader does not attribute them here.

## What the next plans inherit

- **192-08 (the `WorkflowDeleteSheet` move)** now has a worked template for the same shape:
  `sed` the range out, `printf 'export '`, `cmp` against the base blob, cut in a second commit,
  read the orphaned imports out of `tsc` instead of guessing. **And it inherits deviation 5's
  warning:** the `title=` at `:857` is a real hit for that move even though it was a false one
  for this.
- **192-10 (the page composition)** gets a page 339 lines shorter, with the modal's concern
  already gone. The page still declares `UNBOUND` alongside `libraryFilter.ts`'s identical copy —
  **untouched here on purpose**, it is 192-10's to delete.
- **192-12** owes: the two pin raises above, and the RED plants in the four `library/` modules
  that did not exist when the fences were written. **`RunModal.tsx` is now one of them and is the
  first that can be planted.**

## User Setup Required

None — no external service configuration, no dependency, no migration, no env var.

## Self-Check: PASSED

- `frontend/src/components/workflows/library/RunModal.tsx` — **FOUND** (430 L, 2 exports, 0 `WorkflowsPage` specifiers)
- `frontend/src/pages/WorkflowsPage.tsx` — **FOUND** (1068 L, 0 `function RunModal(`, 1 import, 0 shims)
- `frontend/src/pages/__tests__/RunModal.test.tsx` — **FOUND** (32 tests)
- Commit `e966168a` — **FOUND** in `git log`
- Commit `7114a640` — **FOUND** in `git log`
- `git status --short` — clean apart from this SUMMARY; the planted guard fully reverted
- `.planning/STATE.md` / `.planning/ROADMAP.md` — **unmodified**; no `gsd-sdk query state.*`,
  `requirements.mark-complete` or `roadmap.update-plan-progress` verb was called

## Worktree base correction (not a code deviation)

The worktree came up at **`fda79214`** — a `master` merge commit — rather than the dispatched
base `d5a601cd`; `git merge-base` returned `3781a3fe`. The startup assertion fired and it was
corrected with `git reset --hard d5a601cd` before anything was read. **This is now four of five
worktrees in this phase** (192-03 and 192-05 both recorded it). The assertion is load-bearing:
without it this plan's entire verbatim proof would have been measured against the wrong base.

---
*Phase: 192-workflow-library-ia*
*Completed: 2026-08-11*
