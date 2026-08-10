---
phase: 190-live-connector-slice-connector-security-stretch
plan: 05
subsystem: frontend
tags: [canvas, phase-vocabulary, badge, conn-02, d-24, d-23, empty-diff-fence, count-gate, tdd]

# Dependency graph
requires:
  - phase: 189
    plan: 13
    provides: "notConnectedOf written with the TYPE test and the STATE test on SEPARATE lines, specifically so 190 could edit only the second"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 03
    provides: "public.connector_connections — the rows a connection_id now references"
provides:
  - "notConnectedOf's state test is FALSIFIABLE — a bound external_action step no longer carries the `Not connected` badge"
  - "the suite's FIRST genuine bound case, plus its unbound opposite and the empty/whitespace/non-string boundary"
  - "a zero-import PROPERTY fence on phaseVocabulary.ts, proved to bite by a planted import observed RED"
  - "the measured 0 0 evidence for all eight fenced files, including PhaseFormPanel.tsx (D-23)"
  - "the count-gate pin for phaseVocabulary.test.ts moved 112 -> 117 in the same commit as the count"
affects: [190-06, 190-07, 190-13, 190-19, 190-verify-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A boundary case needs its CONTRAST or it is vacuous — against an unconditional `return true`, every `is TRUE` assertion passes while pinning nothing"
    - "Pin the PROPERTY, not the shipped LITERAL — 189-13's seam case pinned `return true` and went RED on the very change it was written to enable"
    - "Prove a pre-existing failure by RESTORING the changed files to the base commit and re-running, rather than arguing from file names"
    - "`git checkout <commit> -- <path>` writes the INDEX too, so bare `git diff` (worktree vs index) reads CLEAN — always name HEAD explicitly"
    - "Sanity-check that fenced paths EXIST before reading an empty `git diff --numstat` as a pass — an empty result and a typo are indistinguishable"

key-files:
  created: []
  modified:
    - frontend/src/components/workflows/phaseVocabulary.ts
    - frontend/src/components/workflows/phaseVocabulary.test.ts
    - scripts/vitest-count-gate.cjs
    - .planning/phases/190-live-connector-slice-connector-security-stretch/deferred-items.md

key-decisions:
  - "THE LINE IS 812, re-derived with grep -n + wc -l and NOT cited — CONTEXT D-24 (:811-814) and <canonical_refs> (:788-814) are both wrong, as RESEARCH CORRECTION #2 said"
  - "A destination is a NON-EMPTY STRING: \"\", whitespace-only, null, undefined, absent, numbers, booleans, arrays and objects are all still not-connected. A truthiness check would clear the badge for \"\""
  - "189-13's SEPARATE-LINES seam case was AMENDED to pin the property (two returning lines, type first, state second, state reads connection_id) and deliberately NOT re-pinned to 190's literal, so the next phase to widen the test need not come back to it"
  - "The bound state adds NOTHING (UI-SPEC 7b) — no badge, dot, tint or mark. Written into the function's docblock so the absence reads as a decision"
  - "npm test is NOT green (21 failed / 8 files) and it was NOT green before this plan either — recorded as D-190-DEF-05 with a measurement, never rounded up to a pass"

patterns-established:
  - "Re-capture a RED transcript's :LINE:COL AFTER pasting it in — inserting the transcript moves the assertions it cites (the 0d52542c correction, hit twice here)"
  - "A one-line data edit can retire a UI affordance across a fenced 8-file subtree when the predicate was written for it a phase earlier"

requirements-completed: []

# Metrics
duration: ~55min
completed: 2026-08-08
---

# Phase 190 Plan 05: The `Not connected` Badge Retires by DATA Summary

**One production line — `phaseVocabulary.ts:812`, re-derived rather than cited — now reads `phase.config.connection_id` instead of returning `true`, so a bound `external_action` step loses its canvas badge and gains nothing in its place; the previously-unreachable false branch got the suite's first genuine bound case, and all eight fenced card-subtree files ended the plan at a measured `0 0`.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-08-08
- **Tasks:** 3
- **Files modified:** 4 (0 created)

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 | `fc994b4a` | `test(190-05): the bound/unbound pair + the zero-import fence, observed RED` |
| 2 | `41a9ead2` | `feat(190-05): retire the Not connected badge by DATA — one line at :812` |
| 3 | `24c0a639` | `chore(190-05): move the phaseVocabulary count-gate pin 112 -> 117 with its count` |

---

## 1 · The re-derived line number

The plan, CONTEXT and `<canonical_refs>` disagree, so nothing was inherited. Measured at
`d78817b8` before any edit:

```
$ grep -n "notConnectedOf" frontend/src/components/workflows/phaseVocabulary.ts | tail -1
810:export function notConnectedOf(phase: PhaseSpecJSON): boolean {
$ wc -l frontend/src/components/workflows/phaseVocabulary.ts
813 frontend/src/components/workflows/phaseVocabulary.ts
```

The function spans **:810-813** and the line 190 edits is **812**. CONTEXT D-24's `:811-814` and
`<canonical_refs>`'s `:788-814` are both **wrong**, exactly as `190-RESEARCH.md` ⚠ CORRECTION #2
and the pattern mapper independently reported. `EXTERNAL_ACTION_PHASE_TYPE` is confirmed a
file-local `const` at `:500`, not an import — which is why the zero-import property survives.

## 2 · The diff — exactly one code line

`git diff -U0` on the production file returns **two hunks, only one of which is code**:

```
@@ -797,12 +797,33 @@ export function waitsForYou(phase: PhaseSpecJSON): boolean {
@@ -812 +833 @@ export function notConnectedOf(phase: PhaseSpecJSON): boolean {
-  return true
+  return typeof phase.config?.connection_id !== "string" || phase.config?.connection_id.trim() === ""
```

The first hunk is the docblock; the second is the single line. `--numstat` reads **34 / 13** =
33 prose insertions + **1 code insertion**, 12 prose deletions + **1 code deletion**.

The type test on the line above is untouched. No import was added:

```
$ grep -nE "^\s*(import|const .* = require\()" frontend/src/components/workflows/phaseVocabulary.ts
(prints nothing)
```

`canvasModel.ts`, `PhaseNode.tsx` and `PhaseNodeCard.tsx` all print nothing on
`git diff --numstat` — `notConnected` was already resolved once in `canvasModel.buildPhaseData`
and passed as DATA, so nothing new had to reach it.

**Why a non-empty string and not truthiness:** the definition column is JSONB and hand-editable.
`!!config.connection_id` would clear the badge for `""`; a `"connection_id" in config` key test
would clear it for `null`. Both are driven RED in the suite.

## 3 · RED observations

### 3a · The bound pair (Task 1) — 2 failed / 115 passed (117)

Recorded verbatim inside the test file under `RED OBSERVED (plan 190-05)`:

```
❯ src/components/workflows/phaseVocabulary.test.ts (117 tests | 2 failed) 35ms
     × returns FALSE for an external_action phase that HAS a connection_id bound 7ms
     × returns TRUE when connection_id is present but empty or whitespace 1ms

AssertionError: expected true to be false // Object.is equality
- Expected  + Received
- false     + true
 ❯ src/components/workflows/phaseVocabulary.test.ts:1003:88
 ❯ src/components/workflows/phaseVocabulary.test.ts:1039:53

 Test Files  1 failed (1)
      Tests  2 failed | 115 passed (117)
```

The two failures are exactly the two the plan predicted.

**The finding worth keeping:** the boundary case failed on line `:1039` — its **CONTRAST**
assertion (`"a"` → `false`), *not* on any of its eight "is TRUE" lines. Against an unconditional
`return true` every "is TRUE" assertion passes vacuously, so a boundary case written without its
opposite would have shipped GREEN while pinning nothing at all.

The `:LINE:COL` references were **re-captured against the file as committed**, twice — pasting a
33-line transcript above an assertion moves it. This is the same correction plan 190-01 had to
make in commit `0d52542c`.

### 3b · The zero-import fence (Task 3A) — driven against a REAL plant

`import type { PhaseNodeData } from "./canvasModel"` was inserted at the top of the **production**
file (not a fixture). **Both** fences went RED:

```
 FAIL … > the WR-04 guard is the INLINE form — this module still has ZERO imports
AssertionError: expected 'import type { PhaseNodeData } from ".…' not to match /^import\s/m

 FAIL … > phaseVocabulary.ts has ZERO import statements
AssertionError: expected [ Array(1) ] to deeply equal []

 Test Files  1 failed (1)
      Tests  2 failed | 115 passed (117)
```

The new 190-05 fence caught it via its `offenders` array, and 189-13's shipped fence caught it
independently.

**Restored md5-identical:**

| | md5 |
|---|---|
| pre-plant | `514bc7ecb899f709857332504c8a1b97` |
| post-restore | `514bc7ecb899f709857332504c8a1b97` |

`grep -c PLANT frontend/src/components/workflows/phaseVocabulary.ts` → **0**.

## 4 · The eight fenced files — measured `0 0`

Existence was sanity-checked **first**, because an empty `git diff --numstat` and a path typo are
indistinguishable. All eight resolved `OK`. Then, both ways:

```
>>>BEGIN git diff --numstat HEAD -- <eight>
<<<END
>>>BEGIN git diff --numstat de122b9a HEAD -- <eight>  (PHASE BASE -> HEAD)
<<<END
```

**Both print NOTHING.** The eight: `PhaseFormPanel.tsx` (D-23, the hot-file ledger row whose one
gated line 189-14 already spent) · `PhaseNode.tsx` · `PhaseNodeCard.tsx` ·
`phaseNodeCardContract.ts` · `ownProperty.ts` · `NodeCornerMarks.tsx` · `NodeRunOverlay.tsx` ·
`NodeIconWell.tsx`.

The three shipped card invariants all still bind and none was approached: **no third badge** (the
`tsc` differential below is the mechanical half), **no focusable control inside the card**, and
**badge slot 1 stays reserved**. Per UI-SPEC §7b the bound state is an **absence** — no badge,
dot, tint or mark replaces the retired word — and that reasoning is now written into the
function's own docblock so a later reader cannot mistake the silence for an oversight.

Zero installs: `git diff frontend/package.json frontend/package-lock.json` prints nothing.

## 5 · Gates — RUN, never quoted

| Gate | Baseline (re-measured at HEAD) | After | Verdict |
|---|---|---|---|
| `node scripts/vitest-count-gate.cjs` | running **2727** / pinned **2714** / +13 / failed 0 / 48 files | running **2732** / pinned **2719** / +13 / failed 0 / 48 files, **exit 0**, `count gate OK` | pin moved with the count |
| `phaseVocabulary.test.ts` pin | 112 pinned / **112** actual | **117** pinned / **117** actual | +5, extension |
| `npx tsc --noEmit -p tsconfig.app.json` | **33** | **33** | at baseline |
| `npx vitest run …/phaseVocabulary.test.ts` | 112 passed | **117 passed / 0 failed** | green |
| `npx eslint` (the two touched files) | — | exit 0 | clean |

The pin was read from **the gate's own `actual` column** across the run that moved it
(`phaseVocabulary.test.ts  112  117  +5`), never hand-counted and never quoted from a document —
the gate only fails on a DECREASE, so drift is silent. The residual **+13** is the pre-existing
drift measured at baseline (`ExternalActionSection.test.tsx` +9, `PhaseTimeline.test.tsx` +4);
this plan contributed **0** net drift. `git diff -U0` on the gate shows one hunk, the pin value
and its dated comment.

## 6 · Deviations from Plan

### 1. [Rule 1 — Bug] 189-13's seam case pinned the LITERAL it was written to enable

- **Found during:** Task 2, immediately after the one-line edit — `1 failed | 116 passed`.
- **Issue:** `it("the TYPE test and the STATE test are on SEPARATE LINES (the Phase-190 seam)")`
  asserted `body` matched `/\n\s+return true/`. That literal **is** the line 190 exists to
  replace, so the case went RED on the intended change. It was pinning the placeholder, not the
  property.
- **Fix:** amended to pin the **property** — exactly two returning lines, the type test first
  (still an early return), the state test second on its own line reading `connection_id` and
  *not* re-reading the type — with a fused-predicate positive control driven through the real
  matcher. Deliberately **not** re-pinned to 190's literal either, so a future phase that widens
  the destination test need not come back here. The amendment is documented in the case itself.
- **Files modified:** `frontend/src/components/workflows/phaseVocabulary.test.ts`
- **Commit:** `41a9ead2`
- **Note:** the plan scoped Task 2's `<files>` to `phaseVocabulary.ts` alone; its acceptance
  criterion of `0 failed` was unreachable without this.

### 2. [Rule 1 — Bug] My own fixture took `tsc` 33 → 34

- **Found during:** Task 2 acceptance checks.
- **Issue:** `error TS2322: Type 'Record<string, unknown>' is not assignable to type
  'PhaseConfigJSON & Record<string, unknown>'` — the shared `phase()` helper types its `config`
  as an intersection, and the conditionally-built record (which is what expresses "no key at
  all") is not assignable to it.
- **Fix:** built the fixture directly with the `toolPhase` cast idiom the same file already uses,
  with the reasoning and the measured 33→34 recorded in the fixture's docblock. `tsc`
  **re-measured back at 33**.
- **Commit:** `41a9ead2`

### 3. [Correction] The first draft of the amended seam assertion was wrong, and was corrected by running it

`/^\s*return\b/gm` counted **one** return, not two: the type test's `return false` trails an
`if (…)` guard rather than starting its line. Re-expressed as a count of `return`-bearing LINES.
Recorded inline in the test so the next reader does not repeat it.

### 4. [Process finding] `git checkout <commit> -- <path>` writes the INDEX too

While measuring §7's pre-existence claim, the three files were reset to the base commit. Bare
`git diff --numstat <path>` then read **clean** — because `git diff` compares worktree to
**index**, and `git checkout <commit> -- <path>` had updated the index as well. The regression
was only visible via `git diff HEAD --numstat`. The uncommitted count-gate pin edit was lost to
that reset and re-applied; the unrelated BUG-260808-01 pin (`WorkflowCanvas.editing.test.tsx`
63 → 65) was verified restored at 65/65. **Every fence check in this summary names `HEAD`
explicitly.**

## 7 · Deferred / out of scope

**D-190-DEF-05 — `cd frontend && npm test` is NOT green, and was not before this plan.** The
plan's Task 3 lists `npm test` reporting `0 failed`; measured, it reports **21 failed / 8 files**
(4567 passed / 4588). This is recorded as a finding rather than rounded to a pass.

Pre-existence was **measured, not argued**: the three changed files were reset to `de122b9a`, the
eight suites re-run, and the identical **21 failed / 8 files** reproduced with this plan's changes
absent; the files were then restored md5-identical. Independently, `grep -c -i
"phaseVocabulary\|notConnected\|workflows/"` returns **0** for every one of the eight, and none of
them appears in the count gate's `TARGETS` — they are the chat/ingestion surfaces (SEED-056
frontend vitest rot), not the workflow canvas. This is the recorded "the count gate has TWO knobs"
trap: **`/gsd:verify-work 190` must not read `npm test` as a regression signal for this phase.**

Also noted, untouched: pre-existing untracked scratch under `scripts/_uat111*`, `scripts/pm-pack/out/`,
`scripts/.sse_after_run1/` from earlier phases — not created by this plan.

## 8 · Threat model — dispositions honoured

| Threat ID | Disposition | Evidence |
|---|---|---|
| `T-190-05-T6` | mitigated | The state test reads **only** `phase.config.connection_id`, a reference. No host, port, token or secret is read, and per UI-SPEC §7b the canvas renders **no new string at all** for the bound state |
| `T-190-05-FENCE` | mitigated | `git diff --numstat HEAD -- <eight>` and `… de122b9a HEAD -- <eight>` both empty, after an existence sanity check |
| `T-190-05-IMPORT` | mitigated | Real planted import observed RED on two independent fences; restored md5-identical; `grep -c PLANT` → 0 |
| `T-190-05-BADGE` | mitigated | No badge added in either slot; `tsc -p tsconfig.app.json` at the re-measured baseline 33 |
| `T-190-05-PIN` | mitigated | Pin moved in the SAME commit as the count, read from the gate's own `actual` column |
| `T-190-SC` | mitigated | Zero installs — `git diff frontend/package.json frontend/package-lock.json` prints nothing |

No new security surface was introduced: the change is a pure read of a parameter the function
already received. **No threat flags.**

## 9 · Known Stubs

**None.** The one changed line is fully wired: `notConnectedOf` is called by
`canvasModel.buildPhaseData` and rendered by `PhaseNode` from `data.notConnected`, both untouched
and both already shipped. The `connection_id` field it reads is produced by the picker in a later
plan (190-13); until then the false branch is reachable only via a hand-edited definition — which
is precisely what the new bound case drives, and why it is a real test rather than a stub.

## Self-Check: PASSED

| Claim | Verified |
|---|---|
| `frontend/src/components/workflows/phaseVocabulary.ts` | FOUND |
| `frontend/src/components/workflows/phaseVocabulary.test.ts` | FOUND |
| `scripts/vitest-count-gate.cjs` | FOUND |
| `.planning/…/190-05-SUMMARY.md` | FOUND |
| commit `fc994b4a` | FOUND |
| commit `41a9ead2` | FOUND |
| commit `24c0a639` | FOUND |
| no file deletions in any of the three commits | VERIFIED (`--diff-filter=D` empty for each) |
