---
phase: 192-workflow-library-ia
plan: 04
subsystem: testing
tags: [characterization-baseline, vitest, graded-action-guards, wave-2, pre-move, WFIN-03]

# Dependency graph
requires:
  - phase: 192-workflow-library-ia
    provides: "192-01's count-gate adoption — PublishedCardDelete.test.tsx was pinned at 7 in BOTH knobs before this plan added a line, so the growth is measured rather than invisible"
  - phase: 188.1-workflow-canvas-refactor
    provides: "the binding lesson that a characterization baseline only proves something if it PREDATES the change"
  - phase: 188.2-phase-node-card-refactor
    provides: "the capture-block mechanics (rows declared once, one shared helper, literal labelled a CAPTURE and observed twice, non-vacuity guards) and the JSX-fragment wrapper-delta rule"
provides:
  - "Seven whole-innerHTML captures of the WFIN-03 delete Sheet, taken while frontend/src/components/workflows/library/WorkflowDeleteSheet.tsx provably does not exist"
  - "The two graded-guard invariants pinned as BEHAVIOUR, separately from the byte captures: never dismisses mid-delete, and no optimistic vanish"
  - "The MEASURED move extent — four spans, 169 lines — recorded inside the file 192-07's executor will read"
  - "A named, narrow useId normalization plus the aria-labelledby round trip that keeps the linkage provable despite it"
affects: [192-07, 192-12]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A capture helper that is the ONLY render path: capture and assertion call the same function, so the recorded literal and the asserted DOM cannot drift"
    - "One narrow NAMED normalization for a position-derived useId token, with the linkage it hides re-asserted separately on the live DOM"
    - "Invariants driven RED against plants in real shipped source, each plant reddening exactly its own cases while the positive controls stay green"

key-files:
  created: []
  modified:
    - frontend/src/pages/__tests__/PublishedCardDelete.test.tsx

key-decisions:
  - "NORMALIZE the Radix useId token (and only that token), because D-01 moves this JSX into its own component, which changes the token for a reason PATTERNS 2 already classifies as the accepted wrapper delta — left raw, all seven captures would red on the move for a non-behavioural reason and an executor would 'fix' them by re-capturing"
  - "Assert the aria-labelledby round trip on the LIVE DOM so normalizing the id's VALUE does not hide a broken LINK"
  - "Spread the two branches of the Kept sentence across two of the seven keys (threads=0 in loadedZeroThreads, threads=3 in loadedInFlight) rather than adding an eighth key — both branches are captured and the table stays at exactly 7"
  - "Do NOT touch scripts/vitest-count-gate.cjs — growth is informational (the gate fails only on a per-file DECREASE) and the pin RAISE 7 -> 26 is owed to 192-12 under the 188-12 precedent"

requirements-completed: [LIB-03]

# Metrics
duration: 20min
completed: 2026-08-10
---

# Phase 192 Plan 04: Delete-Sheet Pre-Move Baseline Summary

**The WFIN-03 victim-naming delete Sheet's seven render states are captured byte-exactly, and its two graded-guard invariants are pinned as behaviour, in two commits where `library/WorkflowDeleteSheet.tsx` provably does not exist — and the "verbatim move" it protects is recorded as a measured 169 lines across FOUR spans, not the 132-line JSX range CONTEXT.md scopes it at.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-10T19:05Z
- **Completed:** 2026-08-10T19:24Z
- **Tasks:** 2
- **Files modified:** 1 (no source file touched)

## Task Commits

1. **Task 1: Capture seven whole-innerHTML render states** — `ef542777` (test)
2. **Task 2: Pin the two graded-guard invariants + prove the capture predates the move** — `4b8cf6da` (test)

## The predates-the-move proof (T-192-08 — command and verbatim output, as required)

```
$ git rev-parse HEAD
4b8cf6dadd252988f9c0d48d7febf07a84825726

$ git show HEAD:frontend/src/components/workflows/library/WorkflowDeleteSheet.tsx
fatal: path 'frontend/src/components/workflows/library/WorkflowDeleteSheet.tsx' does not exist in 'HEAD'
EXIT=128
```

The same command was run at the **capture** commit before one literal was written, with the same result:

```
$ git rev-parse HEAD
14b309b4bd3b04ad5718caa821c24ddb613e2d3f

$ git show 14b309b4:frontend/src/components/workflows/library/WorkflowDeleteSheet.tsx
fatal: path 'frontend/src/components/workflows/library/WorkflowDeleteSheet.tsx' does not exist in 'HEAD'
EXIT=128
```

And the destination directory itself:

```
$ ls frontend/src/components/workflows/library
ls: cannot access 'frontend/src/components/workflows/library': No such file or directory
EXIT=2
```

The capture SHA `14b309b4` is recorded **inside the test file**, not only here, so a later reader inherits a re-runnable command rather than a claim.

## The measured move extent — 169 lines, and it RECONCILES rather than being quoted

The plan and `192-RESEARCH.md` both say "≈169 lines". Re-derived at HEAD with `grep -n` over `frontend/src/pages/WorkflowsPage.tsx` (1407 L), **summing the three spans RESEARCH names gives 165, not 169.** The missing four are the `onDeleted` prop and its D-LOCK-04 docblock, which cannot stay behind either — it is the re-fetch seam the whole no-optimistic-vanish invariant runs through. Named, the figure is exact:

| Span | Lines | What it is |
|---|---|---|
| `:743` | 1 | `type DeletePhase = "idle" \| "deleting" \| "deleted" \| "error"` |
| `:756-759` | 4 | the `onDeleted` prop + its docblock on `PublishedCard` — **the span RESEARCH omits** |
| `:768-799` | 32 | the five state hooks + `descId` (`:768-772`), `openDeleteSheet` (`:774-786`), `handleDelete` (`:788-799`) |
| `:872-1003` | 132 | the `<Sheet>` JSX (comment from `:872`, element from `:877`) |
| **total** | **169** | |

CONTEXT.md's `:872-1003` is **the JSX only**. Everything in the first three rows lives *inside* `PublishedCard` — the component D-01 **deletes** — so a cut that takes only the JSX reads self-contained and is not. The spans are recorded in the test file so `192-07` inherits the measurement, not the number.

## The seven captured states

| Key | Drives | What it pins |
|---|---|---|
| `loading` | preview never resolves | "Loading the exact counts…" and **no counts at all** — a count during load would be a lie |
| `loadedZeroThreads` | `versions:1 runs:0 threads:0 in_flight:0` | the always-rendered zero-threads variant *"No chat threads to keep."* |
| `loadedInFlight` | `versions:2 runs:5 threads:3 in_flight:1` | the amber cancel-first banner + the `threads > 0` branch of the Kept sentence |
| `deleting` | cascade deferred, never resolved | the in-flight terminal, with the destructive control gone |
| `deleted` | cascade resolves | "Deleted · recorded" + the audit receipt |
| `error` | cascade rejects | the honest error + `delete-retry` |
| `previewError` | preview rejects | the preview failure path and its single neutral exit |

Both branches of the Kept sentence are captured across the seven, so the table stays at **exactly 7 keys** without losing a branch — asserted by a dedicated case (`toHaveLength(7)` + key-set equality) so a dropped row cannot shrink the baseline silently.

## Two agreeing runs, on the unchanged tree

The captures were taken twice through the shared helper and diffed as raw files:

| Point | Result |
|---|---|
| Capture run 1 vs run 2, **before** normalization | `diff` empty — byte agreement |
| Capture run 1 vs run 2, **after** normalization | `diff` empty — byte agreement |
| Suite, run 1 / run 2 (Task 1) | `19 passed (19)` / `19 passed (19)` |
| Suite, run 1 / run 2 (Task 2) | `26 passed (26)` / `26 passed (26)` |

Worth stating plainly: the two runs agreed byte for byte **without** the normalization too. The normalization is not there to buy determinism it lacked — it is there for the move.

## Non-vacuity — PROVED, not asserted (three plants, all reverted)

| Plant | In | Result |
|---|---|---|
| `Delete forever` → `Delete forever now` | `WorkflowsPage.tsx` | **2 failed / 17 passed** — exactly `loadedZeroThreads` and `loadedInFlight`, the only two states that render that control |
| deleted the line `if (!o && deletePhase === "deleting") return` | `WorkflowsPage.tsx:882` | **2 failed / 24 passed** — exactly the two refusal cases; **all four positive controls stayed green**, which is what separates *"refuses correctly"* from *"never closes"* |
| hoisted `onDeleted()` above `await deleteWorkflowCascade(wf.id)` | `WorkflowsPage.tsx:788-799` | **2 failed / 24 passed** — exactly the two invariant-2 cases, **including the rejected-cascade one**, which is the half a happy-path test would miss |

Each plant was reverted with `git checkout -- src/pages/WorkflowsPage.tsx` and the suite returned green. `git diff --name-only HEAD~2` lists exactly one file, and `git diff --diff-filter=D` lists no deletions: **no source file is modified by this plan.**

## The two graded-guard invariants (T-192-11)

Marked in the file as **invariants, not captures** — they answer a different question from the byte literals and are never re-derived from them. Every byte of every capture could stay identical while `onOpenChange` quietly stopped refusing.

1. **The Sheet never dismisses mid-delete.** Asserted on *both* dismissal paths — `Escape` and the Radix `Close` affordances (the grip row and the ✕) — because the refusal lives on `onOpenChange`, which every path funnels through. Four positive controls: Escape closes when idle, and Escape closes again once the delete reaches its terminal state (the refusal is scoped to `deletePhase === "deleting"` only).
2. **No optimistic vanish (D-LOCK-04).** The published feed is emptied **before** the click, so a locally-filtered list or a stray early re-fetch would be visible. During the in-flight window the card is still on screen and the fetch count is **unchanged**; only after the server confirms does `onDeleted()` re-fetch and the row leave. A rejected cascade leaves the card present with the error rendered and, again, **zero** re-fetches.

These are the properties **D-15** (fork = direct flip) and **D-18** (draft delete must be demonstrably *lighter*) both argue against. "Lighter than X" is meaningless if X drifts, so the grade is now pinned rather than described.

## Deviations from Plan

**None affecting scope — no rule 1/2/3/4 fired, and no source file was touched.** Two judgement calls inside the plan's own latitude are recorded because they change what the baseline means:

**1. One narrow, named normalization was added to the capture helper (not specified by the plan).**
Radix's `SheetTitle` receives an `id` from React's `useId` (observed `radix-_r_3_`). The value is **position-derived**: it depends on where the hook sits in the React tree. D-01 moves this JSX into a component of its own, which **changes the tree position and therefore the token** — for exactly the reason PATTERNS § 2 already classifies as the **accepted wrapper delta**. Left raw, all seven captures would go red on a correct move, and the natural "fix" is to re-capture — which destroys the baseline. The normalization replaces that one token and nothing else: no whitespace collapsing, no attribute sorting, no text folding. Because the id is what `aria-labelledby` points at, **the linkage is re-asserted separately on the live DOM** (`aria-labelledby` resolves to a real heading whose text is "Delete this workflow?"), plus the `aria-describedby` half, whose id is row-derived (`wf-delete-pub-1`) and therefore never normalized. Both are stated in the file, at length, next to the regex.

**2. RESEARCH's "≈169" was found to be 165 by its own span list, and the fourth span was identified rather than the number being accepted.** See the extent table above. This is the recorded *don't inherit unmeasured claims* rule applied to a figure this plan's acceptance criteria required the file to contain — the file now carries the **spans**, with a note that the 169 is re-derived here and not quoted.

## Issues Encountered

**1. `console.log` from inside a vitest test is not surfaced by this project's reporter.** The first capture harness wrote to stdout and produced zero output despite the test passing; the captures were obtained by having the harness `appendFileSync` to the scratchpad instead. Recorded because the next executor doing a pre-move capture will hit it in the first five minutes. No config change was made — this is a note, not a fix.

**2. The captures were written into the file by script, deliberately.** ~14.7 KB of byte-exact HTML transcribed by hand (or through a model's context) is a corruption risk with no upside; the substitution was done with a `re.sub` over the placeholder table so the committed literals are the captured bytes.

## Verification

| Check | Result |
|---|---|
| `GSD_VITEST_MAX_WORKERS=4 npx vitest run --maxWorkers=4 src/pages/__tests__/PublishedCardDelete.test.tsx` | **26 passed (26)**, 0 failures, twice with agreeing counts |
| `node scripts/vitest-count-gate.cjs` | **exit 0** — `56/56 pinned files present, no per-file decrease, 0 failing` |
| `npx tsc -p tsconfig.app.json --noEmit` | **33 errors** — unmoved from the documented baseline |
| `git diff --name-only HEAD~2` | exactly `frontend/src/pages/__tests__/PublishedCardDelete.test.tsx` |
| `git show HEAD:…/library/WorkflowDeleteSheet.tsx` | **exit 128** — path does not exist |
| `grep -c DELETE_SHEET_HTML_BASELINE` | 16 (≥ 2 required) |
| `grep -c "toBeGreaterThan(0)"` | 1 (≥ 1 required) |
| `grep -ci "mid-delete\|never dismiss"` / `grep -ci optimistic` | both ≥ 1 |
| header contains `:743` · `:768` · `:877` · `169` | all present |

Every vitest invocation in this plan ran with `GSD_VITEST_MAX_WORKERS=4`.

## The count-gate pin RAISE owed to 192-12

`PublishedCardDelete.test.tsx` was pinned at **7** by 192-01 and now runs **26**. The gate prints this as `+19` and **exits 0** — it fails only on a per-file *decrease*, so growth needs no pin edit and `scripts/vitest-count-gate.cjs` is not in this plan's `files_modified`. **The RAISE 7 → 26 is owed to `192-12`'s pinning sweep**, at a number read from the gate's own `actual` column across two agreeing runs, never computed from this document. Editing the gate here would have been a deviation; it was not done.

For the record, the gate also reports the four pre-existing drifts 192-01 recorded (`ExternalActionSection` +9, `PhaseTimeline` +4, `WorkflowBuilderPage.canvas` +5, `builderStore` +6). None is touched here; total reads `2953` against a pinned `2910` (`+43` = `+19` from this plan plus that inherited `+24`).

## Known Stubs

None. This plan adds no runtime code, no UI and no data path — it adds tests only, and modifies zero source files.

## Threat Flags

None — no network endpoint, auth path, file access pattern or schema is touched. The plan's two `mitigate` dispositions are discharged and the third is inherited intact:

- **T-192-08** (Repudiation — the baseline) — discharged: `git show <capture-sha>:…/library/WorkflowDeleteSheet.tsx` exits 128, at both the capture commit and HEAD, with output pasted above.
- **T-192-11** (Tampering — the graded-guard vocabulary) — discharged: both invariants pinned as behaviour and each driven RED against a real plant.
- **T-192-12** (Tampering — the "verbatim" move) — discharged **and strengthened**: the test file records four spans totalling 169 L, correcting RESEARCH's own three-span list which sums to 165.
- **T-192-SC** (package installs) — `accept`, and correct: **zero packages installed**.

## Next Phase Readiness

- **`192-07` (the move) inherits a stick and a map.** Seven captures that must not diff, two invariants that must not weaken, and the four spans that must move as one unit. If the move reds a capture, the move changed the DOM — the correct response is to fix the move, not re-record the literal. That sentence is in the file, not just here.
- **The one legitimate diff to expect on the move:** none in these seven. The `useId` token — the one thing a correct move *would* have changed — is already normalized, and the wrapper (component + props destructure + props type) is not covered by any capture, per PATTERNS § 2.
- **Owed:** the `7 → 26` pin raise, to `192-12`.

## Self-Check: PASSED

- `frontend/src/pages/__tests__/PublishedCardDelete.test.tsx` — FOUND (modified; this plan creates no new file)
- `.planning/phases/192-workflow-library-ia/192-04-SUMMARY.md` — FOUND
- Commit `ef542777` — FOUND
- Commit `4b8cf6da` — FOUND
- `git diff --diff-filter=D --name-only HEAD~2 HEAD` — empty (no deletions)
- `git status --short` — clean apart from this SUMMARY before its commit
- STATE.md and ROADMAP.md untouched; no `state.*`, `requirements.mark-complete` or `roadmap.update-plan-progress` SDK verb called

---
*Phase: 192-workflow-library-ia*
*Completed: 2026-08-10*
