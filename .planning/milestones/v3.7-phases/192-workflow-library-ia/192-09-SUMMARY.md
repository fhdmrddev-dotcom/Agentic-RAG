---
phase: 192-workflow-library-ia
plan: 09
subsystem: workflow-library-frontend
tags: [frontend, rewrite, card, action-vocabulary, graded-action-guard, a11y-contract, D-09, D-10, D-12, D-13, D-14, D-15, D-18, LIB-02, LIB-03]

# Dependency graph
requires:
  - phase: 192-05
    provides: "`library/` itself, `LibraryRow`/`Provenance`, `CHIP_PREDICATES.yours`, `FORK_VERB`/`FORK_CONSEQUENCE`, and the five-fence subtree suite whose explicit path list already named `./WorkflowCard.tsx`"
  - phase: 192-08
    provides: "`WorkflowDeleteSheet` as a black box with an imperative handle, and the measured location of the ⑂ Tweak tooltip this card replaces"
provides:
  - "frontend/src/components/workflows/library/WorkflowCard.tsx — 159-C's ONE card (512 L): one primary verb, a quiet ⋯ overflow, one consequence sentence, three guard grades"
  - "frontend/src/components/workflows/library/WorkflowCard.test.tsx — 35 tests (460 L), every absence with a positive control, every describedby a getElementById round trip"
  - "The full shipped testid surface, emitted verbatim, so 192-10 can claim untouched-green honestly"
affects: [192-10, 192-11, 192-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "presentational card with a flat total prop contract (GovernanceSection.tsx precedent)"
    - "aria-describedby round trip resolved through document.getElementById (GovernanceSection.test.tsx:109-118)"
    - "arm-to-confirm middle guard grade (MaintenancePanel.tsx:39-129), count-free"
    - "imperative-handle mount of the heavy guard (WorkflowDeleteSheet, 192-08)"
    - "absence assertion paired with a self-planted positive control (the Phase 187 lesson)"
    - "prop type derived FROM the consumer's prop (`WorkflowDeleteSheetProps[\"wf\"]`) rather than re-imported"

key-files:
  created:
    - frontend/src/components/workflows/library/WorkflowCard.tsx
    - frontend/src/components/workflows/library/WorkflowCard.test.tsx
  modified: []

key-decisions:
  - "The fork props are named for what the fork PRODUCES (`onForkNewVersion` / `onForkStarter`), not for the row's provenance — that is the real D-12 distinction, and it keeps the D-10 raw grep truthful"
  - "The heavy `Delete workflow…` is gated on OWNERSHIP through the shipped `CHIP_PREDICATES.yours`, so a starter never offers an action the server would refuse — which is also exactly what the shipped starter card did"
  - "The draft guard is `MaintenancePanel`'s arm-to-confirm, rendered in the CARD rather than in the menu, because a Radix menu item closes its own menu on select"
  - "The three legacy root testids (`published-card` / `starter-card` / `draft-card`) and `published-delete` are carried forward too, beyond the four the plan named — 62 consumers across 7 suites, and continuity is cheaper than a rewrite in 192-10"

requirements-completed: []

# Metrics
duration: ~55min
completed: 2026-08-11
---

# Phase 192 Plan 09: The One Library Card Summary

**159-C's single card now exists at `components/workflows/library/WorkflowCard.tsx` (512 L): one primary verb per row state, everything else quiet behind `⋯`, and exactly ONE always-visible sentence — spent on the fork, wired by `aria-describedby` and resolved through `getElementById`, replacing a tooltip a touch user never saw. Its 35-test suite passes, and EIGHT real plants in production source were each observed RED and restored md5-identical, so not one headline claim rests on a green that has never been tested.**

## Performance

- **Duration:** ~55 min · **Tasks:** 3 · **Commits:** 3 (plus this SUMMARY)
- **Files:** 2 created, 0 modified — `git diff --name-only 07a32cec..HEAD` lists exactly one file, plus the untracked-then-committed suite

## The measured numbers (these feed 192-12's subtree delta)

| Module | Lines |
|---|---|
| `WorkflowCard.tsx` | **512** (plan floor: 220) |
| `WorkflowCard.test.tsx` | **460** |
| *this plan's subtotal* | **972** |
| `192-05`'s five modules | 1332 |
| `192-07`'s two | 723 |
| `192-08`'s one | 296 |
| **`library/` subtree total** | **3323** |

## What shipped

**Task 1 — the shell** (`a6183388`). The verb table, the `⋯` host extended from the shipped one, the soul consumed unchanged, and the second draft button gone.

**Task 2 — the fork and the two delete grades** (`5f3ab7bd`). One word, two functions; one sentence as an a11y contract; no dialog on the fork; the draft delete on the single-draft endpoint behind an arm-to-confirm.

**Task 3 — the suite** (`a787cf6f`). 35 tests, then eight plants.

## The three guard grades on ONE card — each an argument, not a taste

The recorded 146–148 rule grades a guard by consequence, and applied here it gives three different answers on one component. That is the point, and the card's docblock carries the table so a later reader inherits the reasoning rather than the outcome:

| Action | Grade | Why |
|---|---|---|
| fork | **direct flip** (D-15) | Non-destructive and reversible — the live version stays live. A sheet here spends the vocabulary `Delete workflow…` relies on (`CapabilityGrid.tsx:11-13`). The sketch attached a confirm to 159-C; it is deliberately not shipped. |
| draft delete | **arm-to-confirm** (D-18) | No live history, no runs, no threads. One extra click, **no fetch**, **no fabricated count** (`CapabilityGrid.tsx:15-21`), never silent. |
| live delete | **the Sheet**, unchanged | Server counts before the action is offered, victim named, in-place lifecycle, no optimistic vanish. |

"Demonstrably lighter than the Sheet" is therefore arguable by **precedent**: sheet (server preview + victim naming + terminal lifecycle) versus arm (one click, zero requests).

## EIGHT REAL PLANTS, EVERY ONE RED, EVERY ONE RESTORED md5-IDENTICAL

The suite passed **35/35 on its first run**, which proves nothing on its own — so each headline claim was driven RED against a plant in *production source* (never in the test), with an EOL-normalized md5 taken before the plant and after `git checkout --`. The blast radius is reported as measured, including where it was wide.

| # | Plant (real, in `WorkflowCard.tsx`) | Suite | Result | md5 |
|---|---|---|---|---|
| 1 | the hover-only tooltip attribute on the fork item | fences | **RED** — `./WorkflowCard.tsx paints no hover-only explanation` · 1/47 | `1f709490` → `1f709490` |
| 2 | `import type { WorkflowsPageProps } from "@/pages/WorkflowsPage.tsx"` | fences | **RED** — `imports the page in no form at all` · 1/47 | identical |
| 3 | the raw-HTML escape hatch replacing the soul | fences | **RED** — `renders no raw HTML` · 1/47 | identical |
| 4 | `runnable` re-derived so a DRAFT qualifies | card | **RED ×14** | identical |
| 5 | the consequence paragraph's id changed to a dangling one | card | **RED ×2 — and ONLY 2** | identical |
| 6 | the draft Delete item calling the delete directly (no arm) | card | **RED ×6** | identical |
| 7 | the starter fork re-pointed at the same-slug handler | card | **RED ×1** | identical |
| 8 | the removed label returning as the draft's primary verb | card | **RED ×2** | identical |

**Plant 5 is the one worth keeping.** It left the sentence fully rendered and only broke the id it is addressed by — so a presence check, an attribute check and a text check would all have stayed green. Exactly two cases failed, and they are the two that resolve the id through `document.getElementById`. That is the silent failure D-14 would otherwise ship, caught by construction.

**Plant 1 also settles the debt 192-08 handed forward.** The ⑂ Tweak tooltip really is gone: re-measured at this base it lives at `WorkflowsPage.tsx:853` (not the `:871` two prior documents quote — see the corrections section), and this card replaces that control with `aria-describedby`. Plant 1 proves the fence would have caught a reintroduction, and a DOM-level plant of the same tooltip (`title={FORK_CONSEQUENCE}`) additionally reddened this suite's own `getByTitle` case.

## The testid surface — 62 consumers, and MORE carried forward than the plan required

Measured here with `grep -rn` over every test file under `frontend/src`, not inherited: **62 occurrences across 7 suites**. All ten shipped ids are emitted verbatim:

| id | carried | note |
|---|---|---|
| `published-run` · `draft-open` | ✅ | the two primaries |
| `published-tweak` · `use-starter` | ✅ | **distinct ids on distinct controls** — D-12's only mechanical evidence |
| `published-card` · `starter-card` · `draft-card` | ✅ | **beyond the plan's four.** The plan's table named four; `192-08` named `published-card` and `published-delete` as also load-bearing. Carrying all of them costs nothing and makes `192-10`'s untouched-green claim true rather than hopeful |
| `published-delete` | ✅ | 32 rows in `PublishedCardDelete.test.tsx` address it |
| `draft-publish` | ❌ **dies** | with the button D-10 removes; one consumer, and `192-10` Task 3 owns it |

**No id was renamed, so no consuming test was rewritten.** All ten suites that touch these ids ran green **untouched**: `176 passed (176)`.

Four ids are net-new and belong to D-18's guard: `draft-delete`, `draft-delete-prompt`, `draft-delete-confirm`, `draft-delete-cancel`, plus `draft-delete-error` and `fork-consequence`.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] A glob in the docblock terminated the block comment**

- **Found during:** Task 1, at the typecheck gate — **55 errors** against a baseline of 33, all of them parse errors cascading from line 41.
- **Issue:** the header explained the measurement method as `grep -rn` over a path glob. The glob contains the two characters that CLOSE a block comment, so the docblock ended mid-sentence and the rest of the prose was parsed as code. `TS1121: Octal literals are not allowed` on an English sentence is a memorable way to learn this.
- **Fix:** the method is described in words instead. The measurement is unchanged.
- **Verification:** `tsc -p tsconfig.app.json --noEmit` back to **33**.
- **Committed in:** `a6183388`

**2. [Rule 1 — Bug] The docblock naming the two forbidden clients satisfied the grep that proves they are absent**

- **Found during:** Task 2, at the grep gates — `deleteWorkflowCascade` and `getWorkflowDeletePreview` each read **1** where the plan requires **0**. Both hits were my own prose explaining why a draft must never reach them.
- **Issue:** this is `192-08`'s deviation 1 and `192-06`'s deviation 2 in a third form. **T-192-04 and every `?raw`/grep-based check in this phase is blind to the comment/code distinction that F1's parser handles**, so prose about an absence counts as its presence.
- **Fix:** reworded to *"the cascade client and its preview client"*, with an explicit note at the site saying the phrasing is deliberate and why — so the next author does not tidy it back.
- **Verification:** `grep -n` for both identifiers on the module returns **no hits**.
- **Committed in:** `5f3ab7bd`

### Design decisions the plan left open, or left contradictory

**3. ⚠ THE PLAN'S OWN D-10 CHECK AND ITS OWN PROP NAME ARE MUTUALLY EXCLUSIVE, and the conflict is resolved rather than papered over.** Task 1's acceptance says `grep -c "Publish"` must equal **0**; Task 2's action text names the prop `onForkPublished`, which contains that token, as does the API type `PublishedWorkflow` the delete Sheet's prop needs. Both cannot hold. Resolved in the direction the phase has taken three times already — make the cheap raw check truthful where it costs only naming, and say so:

- the fork props are **`onForkNewVersion`** and **`onForkStarter`**. Naming them for what the fork PRODUCES (a new version of a live row · a fresh copy of a shared one) is the actual D-12 distinction and is arguably the better name regardless;
- the delete target's type is derived as **`WorkflowDeleteSheetProps["wf"]`** rather than re-imported from the api seam. This is strictly better coupling: the card accepts exactly what the guard it mounts accepts, so a change to the Sheet is a typecheck error here rather than a drift.

`grep -c "Publish"` on the module is **0**, and D-10 is additionally proved where it matters — as a rendered-DOM absence across all three row states with a self-planted positive control, driven RED by plant 8.

**4. `aria-label="Workflow actions"` is an INLINE LITERAL, not a constant.** The plan requires `grep -c` on the literal to equal 1. It is an accessible name carried over verbatim from `WorkflowsPage.tsx:821` and is part of the shipped test surface (`PublishedCardDelete.test.tsx` addresses the menu by it), so a literal is the honest form — the same argument as the testids.

**5. The heavy `Delete workflow…` is gated on OWNERSHIP, not merely on "runnable".** D-09's table gives the overflow to *"published or starter"*. Taken literally that offers a destructive action on a curated system-global row the user does not own, against an endpoint that is owner-gated server-side — an action that can only fail, which is the dishonesty this phase exists to remove. **The shipped starter card never had one**, so the gate reproduces shipped behaviour exactly while honouring D-09 for every row where it can be true. The predicate is the shipped `CHIP_PREDICATES.yours`, imported rather than re-tested, because a second copy of it is the drift D-03 forbids by name. Asserted as its own case, and note it also proves the *Yours* fallback is live: a starter's `isMine` is `false`, a draft's is `undefined` and falls back correctly.

**6. The armed prompt renders in the CARD, not in the menu.** A Radix `DropdownMenuItem` closes its own menu on select, so an in-menu confirm would vanish on the click that armed it. The item arms; the prompt appears in place under the footer; Confirm deletes, Cancel disarms.

**7. Five strings are declared module-privately rather than in `libraryVocabulary.ts`** — `RUN_LABEL`, `OPEN_LABEL`, `DELETE_WORKFLOW_LABEL`, `DELETE_DRAFT_LABEL` and the three prompt words. Same scope boundary `192-07` recorded for its four: this plan's `files_modified` names two files and the vocabulary module is not one of them. **The re-home is OWED.** They are not outside the honesty guarantee while they wait — this file is one of the seven paths F5 sweeps by name.

### Inherited claims CORRECTED by measurement

**8. The ⑂ Tweak tooltip is at `WorkflowsPage.tsx:853`, not `:871`.** `192-08-SUMMARY.md` measured `:871` and the dispatch brief propagated it; the six `title` attributes on the page now sit at `:112`, `:578`, `:602`, **`:853`**, `:900`, `:916`. `192-08`'s own cut moved everything below its four spans, and only the two *below* the Sheet's old range shifted by the full −142. **This is the fourth inherited line number this phase has corrected by measurement** — 192-05→06, 06→08, 04's 165→169→175, and now this. Every number in this SUMMARY was re-derived at this base.

**9. `deleteWorkflowDraft` is at `api.ts:3542` with the signature `(id: string, signal?: AbortSignal)`.** The plan quotes `:3525` and `(definitionId: string)`. The extra optional parameter is harmless at the call site; the line number is 17 stale.

**10. The worktree came up at `fda79214` again** — a `master` merge commit — rather than the dispatched base `07a32cec`. `git merge-base` returned `3781a3fe`, the startup assertion fired, and the worktree was reset before anything was read. **This is now seven of eight worktrees in this phase**, exactly as the brief predicted. All three commits sit directly on `07a32cec`.

---

**Total deviations:** 2 auto-fixed (Rules 1 and 3), 5 open design decisions resolved, 3 inherited claims corrected. **Impact on scope:** none. No new capability beyond D-18's wiring, no new dependency, no schema or API surface.

## Gates

| Gate | Result |
|---|---|
| `vitest run src/components/workflows/library` | **154 passed / 0 failed** (4 files) |
| `WorkflowCard.test.tsx` alone | **35 passed / 0 failed** |
| the 10 suites consuming the shipped testids | **176 passed / 0 failed**, all **untouched** |
| `tsc -p tsconfig.app.json --noEmit` | **33** — the recorded baseline, unmoved, at three separate measurements (before writing a line, after Task 1, after Task 3) |
| `eslint src/components/workflows/library` | **0** |
| `eslint src/components/workflows/library -c eslint.a11y.config.js` | **0** |
| `node scripts/vitest-count-gate.cjs` | **exit 0**, TWICE — `total 3142 · failed 0`, `56/56 pinned present`, **no per-file decrease**, both runs agreeing exactly |
| `git diff --name-only 07a32cec..HEAD` | one file (plus the suite, committed in Task 3) |
| `git diff --diff-filter=D` | empty — no file deleted |
| `WorkflowSoul.tsx` / `PhaseSpine.tsx` / `soulData.ts` in the diff | **absent** — consumed unchanged, as LIB-02 requires |

Every vitest invocation carried `GSD_VITEST_MAX_WORKERS=4` **and** `--maxWorkers=4`. **The gate did not flake once**, and this plan ran as the only executor in its wave — the same confirming data point `192-08` recorded, now twice.

Movements in the gate table that are **not this plan's**, logged so a later reader does not attribute them here: `PhaseTimeline.test.tsx` 17 → 21 (+4), `RunModal.test.tsx` 11 → 32 (+21), `RunModal.a11y.test.tsx` 8 → 16 (+8), `PublishedCardDelete.test.tsx` 7 → 32 (+25). All four are present in the dispatched base from waves 1–4.

## Owed to 192-12 — the pin numbers, READ OUT of the gate's own `actual`

⚠ `scripts/vitest-count-gate.cjs` is **not** in this plan's `files_modified` and was not touched. The raises below are **owed, not waived**, and every figure is the gate's own printed `actual` across **two agreeing runs**:

| Suite | Pinned today | Measured `actual` | Note |
|---|---|---|---|
| `WorkflowCard.test.tsx` | **—** (`new`) | **35** | this plan's |
| `LibraryToolbar.test.tsx` | **—** (`new`) | **36** | 192-07's, still unpinned |
| `libraryFilter.test.ts` | **—** (`new`) | **36** | 192-05's, still unpinned |
| `librarySubtree.fences.test.ts` | **—** (`new`) | **47** | 192-05's, still unpinned |
| `PublishedCardDelete.test.tsx` | 7 | **32** | 192-08's owed raise, unchanged here |

No `TARGETS` entry was added: the existing `src/components/workflows` directory entry already reaches this path, and a `TARGETS` path that does not resolve makes the gate **ERROR (exit 2)** rather than merely fail.

**The pin-DECREASE hazard did not materialise** — no test case was relocated out of any pinned file, and the gate read `no per-file decrease` on both runs.

**192-12's RED-plant obligation for `WorkflowCard.tsx` is now DISCHARGED** for F1, F4 and T-192-04 (plants 1–3 above, driven in this real module, restored md5-identical). `WorkflowDeleteSheet.tsx` remains owed; `LibraryToolbar.tsx` was partly discharged by `192-07`.

## Threat Model Status

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-192-23 | mitigate | **Mitigated and PROVED.** The cascade client and the preview client appear **zero** times in this module (verified by `grep -n`, after deviation 2 removed them from prose), and every draft path carries a `not.toHaveBeenCalled` assertion on both. Plant 6 reddened six rows when the arm step was removed. |
| T-192-24 | mitigate | **Mitigated and PROVED.** One word, two functions: `freshHash` is absent (0), the card constructs no slug and no version, and each provenance's fork is asserted on *which callback fired*. Plant 7 — re-pointing the starter fork at the same-slug handler, the exact merge that would collide on the global `UNIQUE(slug, version)` — reddened it. |
| T-192-21 | mitigate | **Mitigated and PROVED, three ways.** Zero tooltip attributes in the module (F1, parsed, driven RED by plant 1); the rendered fork control asserted to carry none, with `getByTitle` proved able to find a planted one; and the describedby round trip resolved through `getElementById`, driven RED by plant 5 against a *dangling* id that every weaker check would have passed. |
| T-192-25 | mitigate | **Mitigated.** The draft guard is `MaintenancePanel`'s shipped arm-to-confirm, so "lighter than the Sheet" is arguable by precedent; and the armed prompt is asserted to contain **no digit at all**, because no preview is fetched and a fabricated number is worse than no number. |
| T-192-04 | mitigate | **Mitigated and PROVED.** `WorkflowSoul` is consumed unchanged and is absent from the diff; `dangerouslySetInnerHTML` is 0 in the module and the fence was driven RED by plant 3. The highlight is not re-implemented here — this card renders no highlight at all. |
| T-192-SC | accept | **Held.** Zero packages installed. |

**Threat flags:** none. No network surface beyond an already-shipped client with an already-shipped endpoint, no auth path, no file access, no schema change.

## Known Stubs

None. Every prop is wired to real behaviour and asserted, including the two `192-10` has not composed yet.

## What the next plans inherit

- **`192-10` (the page composition)** — mount `<WorkflowCard row={...} folderName={...} onRun onOpen onForkNewVersion onForkStarter onDeleted />`, one per merged row. **`onForkNewVersion` takes the page's shipped `onTweak` and `onForkStarter` takes `onUseStarter`, unchanged and unmerged.** The card takes a `LibraryRow`, so the page's handlers receive `row` and read `row.source` for the wire object they need. Delete `DraftCard`, `PublishedCard`, `StarterCard` and `FilterItem`; `draft-publish` dies with them and its one consumer is yours. Every other shipped testid is already emitted here, so the ten consuming suites should stay green **untouched** — 176 tests, verified at this base.
- **`192-11`** — the card's own hooks: root `published-card`/`starter-card`/`draft-card` (all also carrying `data-card="workflow-card"` and `data-provenance`), `fork-consequence` for the sentence, and the five `draft-delete-*` ids for D-18's guard.
- **`192-12`** — the four pin raises above, and the RED plants still owed on `WorkflowDeleteSheet.tsx`.
- **Whoever re-homes the strings** — five from this file and `192-07`'s four, into `libraryVocabulary.ts`, deleting both blocks in the same commit.

## User Setup Required

None — no external service configuration, no dependency, no migration, no env var.

## Requirements

`LIB-02` and `LIB-03` sit in this plan's frontmatter and **neither becomes user-observable here** — this plan ships a component, and nothing mounts it until `192-10`. They were deliberately **not** marked complete: no `state.*`, `requirements.mark-complete` or `roadmap.update-plan-progress` verb was called, and `STATE.md` / `ROADMAP.md` are untouched.

## Self-Check: PASSED

- `frontend/src/components/workflows/library/WorkflowCard.tsx` — **FOUND** (512 L · 0 tooltip attrs · 0 raw-HTML · 0 page specifiers · 0 `freshHash` · 0 cascade/preview identifiers)
- `frontend/src/components/workflows/library/WorkflowCard.test.tsx` — **FOUND** (460 L · 35 tests · 0 failures)
- Commit `a6183388` — **FOUND** in `git log`
- Commit `5f3ab7bd` — **FOUND** in `git log`
- Commit `a787cf6f` — **FOUND** in `git log`
- `git diff --diff-filter=D 07a32cec..HEAD` — empty (no file deleted)
- `git status --short` — clean apart from this SUMMARY; all eight plants fully reverted, md5 `1f709490` on every restore
- `.planning/STATE.md` / `.planning/ROADMAP.md` — **unmodified**

---
*Phase: 192-workflow-library-ia*
*Completed: 2026-08-11*
