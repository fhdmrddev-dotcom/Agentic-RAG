---
phase: 184-editable-canvas-live-structural-validation-round-trip
plan: 08
subsystem: workflows
tags: [valid-03, server-verdicts, colour-budget, problems-tray, fail-closed, source-guards, wave-5]

# Dependency graph
requires:
  - phase: 184-03
    provides: "`PhaseNodeCard`'s declared-but-unrendered `verdict` slot, `nodePresentation.ts` as the one presentation-table home, and the 30-assertion provider-free suite this plan appended to"
  - phase: 184-06
    provides: "`api.ts`'s `Verdict` wire type (with `code` deliberately a plain string) and `useLiveValidation`'s `DegradedValidationCause` — both consumed as shipped"
  - phase: 184-01
    provides: "`scripts/vitest-count-gate.cjs` — the D-184-08 per-file count differential"
  - phase: 182-server-validation-seam
    provides: "the `/validate` verdict vocabulary and its fail-closed severity classifier — mirrored here, never re-implemented"
provides:
  - "`verdictModel.ts` — the pure grouping module: `groupVerdicts` / `summaryLine` / `NOTHING_OUTSTANDING` / `DEGRADED_SENTENCE`, containing provably zero verdict-identifier knowledge"
  - "`nodePresentation.VERDICT_MARK` + `VERDICT_DESTRUCTIVE_TOKEN` — the two marks in one copy, and the single named literal the R9 colour scan searches for"
  - "`PhaseNodeCard`'s rendered verdict mark on the card's RIGHT edge — the first slot from the 184-03 seam to be filled"
  - "`ProblemsTray.tsx` — the two-count summary, the `phase: null` home, jump-to-step rows, and the cause-split degraded copy"
affects: [184-12, 184-13, 185, 188]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A colour budget asserted by counting one exported token literal in the emitted HTML, with a planted positive control — a scan, never an eyeball"
    - "One fail-closed rule (`incomplete` is the only soft value; everything else is hard) applied identically at the count, at the node mark and at the tray row, so a summary can never say '0 problems' while a problem renders"
    - "A source fence that had to be LINE-SCOPED because the module's own docblock sentence bridged across twenty lines into the real import it was describing"
    - "A lint rule deciding a file-placement argument: `react-refresh/only-export-components` is what put the mark table in `nodePresentation` and the degraded copy in `verdictModel`"

key-files:
  created:
    - frontend/src/components/workflows/verdictModel.ts
    - frontend/src/components/workflows/verdictModel.test.ts
    - frontend/src/components/workflows/ProblemsTray.tsx
    - frontend/src/components/workflows/ProblemsTray.test.tsx
  modified:
    - frontend/src/components/workflows/nodePresentation.ts
    - frontend/src/components/workflows/PhaseNodeCard.tsx
    - frontend/src/components/workflows/PhaseNodeCard.test.tsx

key-decisions:
  - "The verdict-mark table lives in `nodePresentation.ts` and the degraded sentences in `verdictModel.ts` because `react-refresh/only-export-components` forbids a component module from exporting either — the lint rule, not taste, decided both placements"
  - "`markFor` and every row compare against the SOFT severity only; anything else is the hard one, which mirrors the route's fail-closed classifier rather than substituting for it"
  - "TWO pre-existing assertions in `PhaseNodeCard.test.tsx` were narrowed, both forced, both enumerated below — the D-184-08 zero-assertion-edit claim does NOT hold for this plan and is not claimed"
  - "The tray is fully controlled: `open` belongs to the caller, so 'does not auto-open on a new error' is true by construction rather than by a suppressed effect"
  - "`requirements.mark-complete` was deliberately NOT run — see the Requirements section"

patterns-established:
  - "Falsify a colour-budget scan by making the SOFT mark spend the destructive token: two tests go red and name the token in the failure message"
  - "A 'never reads as clean' assertion needs its own positive control — the same regex is asserted to FIRE on the healthy empty state, or it could be passing on a typo"

requirements-completed: []  # VALID-03 is this plan's frontmatter requirement and it is NOT complete — no canvas node carries a mark yet and no page mounts the tray. REQUIREMENTS.md deliberately untouched; see "Requirements".

# Metrics
duration: 17min
completed: 2026-07-27
---

# Phase 184 Plan 08: The Node Marks and the Problems Tray Summary

**Every severity, code and message the canvas will show now comes from one pure module that provably contains no verdict vocabulary at all — it groups by the slug the server already guarantees, counts by reading `severity`, and says *"1 problem · 2 things to finish"* in two separate words before anything is opened; the card's Wave-0 `verdict` slot is filled with a red ✕ and a **dashed grey ○** whose colour budget is proven by counting one exported token literal in the emitted HTML (three `incomplete` cards: 0 occurrences, one `error` card: 6 — both with planted controls); and a tray gives the `phase: null` findings the home that is the recorded reason sketch 139-A beat 139-B, renders identifiers this client has never seen with the server's own words verbatim, and tells the truth in two different sentences when the check did not run.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-07-27T07:02:08Z
- **Completed:** 2026-07-27T07:18:55Z
- **Tasks:** 3 (all `auto`, all committed atomically)
- **Files created:** 4 · **Files modified:** 3

## Task Commits

1. **Task 1: `verdictModel.ts` — group and count, classify nothing** — `6542642a` (feat) — `verdictModel.ts` (new, 180 L) + `verdictModel.test.ts` (new, 25 assertions)
2. **Task 2: the two node marks** — `296350b4` (feat) — `nodePresentation.ts`, `PhaseNodeCard.tsx`, `PhaseNodeCard.test.tsx` (30 → 42 assertions)
3. **Task 3: `ProblemsTray.tsx`** — `8be085e0` (feat) — `ProblemsTray.tsx` (new, 318 L) + `ProblemsTray.test.tsx` (new, 23 assertions) + `verdictModel.ts` (the degraded copy)

No commit deletes a tracked file (`git diff --diff-filter=D` empty across all three).

---

## (a) THE DESTRUCTIVE TOKEN LITERAL, AND THE POSITIVE-CONTROL RESULT

The `<output>` block requires both to be quoted. The literal is:

```ts
// frontend/src/components/workflows/nodePresentation.ts
export const VERDICT_DESTRUCTIVE_TOKEN = "destructive"
```

It is the Tailwind/CSS-variable token family the app already uses for destructive UI
(`--destructive` in `index.css:33`/`:108`), and it is named ONCE so the R9 check is a
count rather than a colour heuristic. Both suites scan with the same helper —
`html.split(VERDICT_DESTRUCTIVE_TOKEN).length - 1`.

| Scan | Required | Observed |
|---|---|---|
| 3 `incomplete` cards, 0 `error` (`PhaseNodeCard.test.tsx`) | 0 | **0** |
| POSITIVE CONTROL — 1 `error` card | ≥ 1 | **6** (border + bg + text classes) |
| 3 `incomplete` verdicts, tray CLOSED | 0 | **0** |
| 3 `incomplete` verdicts, tray OPEN (where the row marks actually render) | 0 | **0** |
| POSITIVE CONTROL — one `error` verdict added to the same set, tray open | ≥ 1 | **≥ 1** |
| The whole card WITHOUT any verdict (body + both badges + icon well, selected) | 0 | **0** |
| `VERDICT_MARK.error.className` contains it / `incomplete` and `unknown` do not | — | **holds** |

The last two rows matter as much as the first: the scan is only meaningful if the rest
of the card is neutral to begin with, otherwise a stray destructive class elsewhere
would mask a regression in the mark itself.

**Falsified, not merely green.** `VERDICT_MARK.incomplete.className` was temporarily
changed to `border border-dashed border-destructive/70 bg-muted text-destructive` and
the suite re-run:

```
× 3 incomplete cards and 0 error cards emit the destructive token ZERO times
  AssertionError: expected 6 to be +0
× the token literal is REAL — it is the one the error mark's classes actually name
  AssertionError: expected 'border border-dashed border-destructi…' not to contain 'destructive'

Tests  2 failed | 40 passed (42)
```

Restored: `grep -c "bg-muted text-muted-foreground" nodePresentation.ts` → **2** (the
soft mark and the degraded one), suite back to 42/42.

---

## (b) THE TWO ASSERTION EDITS — enumerated, because the zero-edit claim does NOT hold here

**This plan edited two pre-existing assertions in `frontend/src/components/workflows/PhaseNodeCard.test.tsx`. Both were forced. Neither is claimed as compliant, and the D-184-08 gate is reported here as VIOLATED-BY-NECESSITY rather than green.**

The whole test diff across the three commits is **860 insertions / 9 deletions**, and
every one of the 9 deleted lines is listed below.

### Edit 1 — the byte-identical proof no longer passes `verdict`

```diff
- it("renders BYTE-IDENTICAL DOM whether verdict / status / stepNumber are passed or not", () => {
+ it("renders BYTE-IDENTICAL DOM whether status / stepNumber are passed or not", () => {
    const withSlots = renderCard({
      badges: [groundingBadge],
-     verdict: "error",
      status: "running",
```

**Why it could not be avoided:** the assertion literally encodes *"passing a `verdict`
changes no DOM"*. 184-08 is the plan chartered to make that false. Keeping it green
would have required this plan not to render the mark — i.e. not to exist. 184-03's own
summary predicted the fill (*"184-08 lands the marks"*) but the assertion it left behind
had no way to survive it.

**What replaces it, stronger than what was removed:** the two remaining `verdict`
contracts are now guarded individually — *"the verdict slot ABSENT still renders no
verdict element"* (the Wave-0 half that survives) and *"identical props except the
verdict produce DIFFERENT marks"* (VALID-03's headline proof). The two slots still
unrendered, `status` and `stepNumber`, keep the original byte-identical guarantee.

### Edit 2 — the `nodePresentation` fence narrowed from a module-path ban to a tint ban

```diff
- expect(phaseNodeCardSource).not.toMatch(/from\s+["']@\/components\/workflows\/nodePresentation["']/)
+ expect(phaseNodeCardSource).not.toMatch(/import[^;]*\b(ICON_TINT|DEFAULT_TINT)\b[^;]*from\s+["'][^"']*nodePresentation["']/)
  expect(phaseNodeCardSource).not.toMatch(/ICON_TINT\[/)
+ expect(phaseNodeCardSource).not.toMatch(/DEFAULT_TINT\s*[,)\]]/)
```

**Why it could not be avoided, and why this is not a judgement call:** the plan says
*"add the verdict mark to `nodePresentation.ts` and render it from `PhaseNodeCard`"* —
which requires the import the fence banned. The obvious dodge was to put the table in
`PhaseNodeCard.tsx` instead, and that was in fact implemented first. **ESLint refused
it:**

```
src/components/workflows/PhaseNodeCard.tsx
  181:14  error  Fast refresh only works when a file only exports components.
                 Use a new file to share constants or functions between components
                 react-refresh/only-export-components
```

A component module may not export the shared constant, so the table has exactly one
legal home and the card has exactly one legal way to read it. A relative-specifier
dodge (`from "./nodePresentation"`, which the old regex would not have matched) was
considered and rejected outright: it would have left the fence green while its own name
became false, which is the D-ITEM-183-02 trap in its purest form.

**The property under guard is unchanged and is now asserted three ways instead of one:**
the card imports no tint identifier, indexes no tint table, and passes no tint value —
each with a positive control proving the ADAPTER contains that exact form, so none of
the three can go vacuous.

### The other 6 deleted lines

All six are comment or title text, listed for completeness: the suite header's item 4
(which named 184-08 as a phase that had not happened), the byte-identical test's inline
comment, and four lines of the tint fence's explanation, each replaced with a longer
one that records why the narrowing happened at the line where it happened.

### The 184-01 carve-out

Still **spent**, and this plan consumed none of it. `soulData.test.ts` reported its
pinned **14** on every gate run. What this plan spent is something different — two
Wave-0 seam assertions in a file 184-03 created — and it is reported as its own line
item rather than folded into that carve-out.

---

## (c) Import-path changes (D-184-08)

**Import-path-only changes: ZERO.** No existing import line in any file was re-pointed.

Four net-new import STATEMENTS appear, all in or for net-new code, listed so the
accounting is complete:

| File | Added import | Why |
|---|---|---|
| `PhaseNodeCard.tsx` | `{ VERDICT_MARK, type VerdictMarkKind } from "@/components/workflows/nodePresentation"` | the mark table + its key type (see Edit 2) |
| `PhaseNodeCard.test.tsx` | `{ VERDICT_DESTRUCTIVE_TOKEN, VERDICT_MARK } from "./nodePresentation"` | a SEPARATE statement, not a widening of the existing line, so the 184-08 diff stays auditable by `git diff` alone |
| `verdictModel.ts` | `import type { Verdict } from "@/lib/api"` · `import type { DegradedValidationCause } from "@/hooks/useLiveValidation"` | both type-only and therefore erased — no runtime edge, and no third declaration of either shape |
| `ProblemsTray.tsx` | the five it needs, all net-new | — |

---

## Verification Results

| Gate | Required | Observed |
|---|---|---|
| `npx vitest run src/components/workflows/verdictModel.test.ts` | 0 failures, exit 0 | **25 passed, exit 0** |
| `npx vitest run src/components/workflows/ProblemsTray.test.tsx` | 0 failures, exit 0 | **23 passed, exit 0** |
| `npx vitest run src/components/workflows/PhaseNodeCard.test.tsx` | 0 failures | **42 passed** (30 → 42, +12) |
| `WorkflowCanvas.test.tsx` | 31, unmodified | **31 passed, unmodified** |
| `npx vitest run src/components/workflows … + the 3 gating suites` | 0 failures | **24 files / 877 tests passed, 0 failed, exit 0** |
| `node scripts/vitest-count-gate.cjs` | exit 0, all 16 pinned held | **exit 0** after every task; 877 total, **0 failing**, 16/16 present, **no per-file decrease** |
| `npx tsc -b \| grep -c "error TS"` | ≤ 33 | **33** after every task — equal to the `develop` differential |
| `npx vite build` | exit 0 | **exit 0**, built in 4.18 s |
| `npx eslint` on all 7 files | clean | **zero problems** (after the two `react-refresh` findings were resolved by moving the constants — see Deviations 1 and 2) |
| `git diff --exit-code -- 'frontend/src/**/__snapshots__/*'` | exit 0 | **exit 0 — byte-unchanged** (the adapter still never passes `verdict`, so the projection cannot move) |
| `revertByteIdentical.test.tsx` | green at its pinned 7 | **7/7, unmodified** |
| `grep -cE '<forbidden codes>' verdictModel.ts` | 0 | **0** |
| `grep -cE 'fetch\(\|from "@/components/workflows/builderStore"' verdictModel.ts` | 0 | **0** |
| `grep -cE '@xyflow\|mockReactFlow\|ReactFlowProvider' ProblemsTray.test.tsx` | 0 | **0** |
| `grep -cE 'workflows/validate\|/lib/api' ProblemsTray.tsx` | 0 | **0** |
| `git diff --name-only -- backend/` | 0 | **0** |
| `git diff --name-only -- supabase/migrations` | 0 | **0** |
| `package.json` / lockfile in any commit | absent | **absent** |
| REQUIREMENTS.md | untouched, all 5 phase REQ-IDs Pending | **untouched** — VALID-02/03, CANVAS-02/03/04 all `- [ ]` / **Pending** |
| Deletions in any commit | none | **none** |

### The acceptance criteria that needed reading rather than grepping

- **`summaryLine` for 1 error + 2 incomplete** returns exactly `1 problem · 2 things to finish` — asserted by `toBe`, so a stray space or a different separator fails.
- **Both halves pluralise independently** — `2 problems · 1 thing to finish`, `1 problem · 1 thing to finish`, `3 problems · 3 things to finish`.
- **A zero half is OMITTED, not rendered as a zero** — `0/3` returns `3 things to finish` and is additionally asserted not to match `/problem/i` or `/\b0\b`; `2/0` likewise on `/finish/i`.
- **The `?raw` guard's positive control passes** — the forbidden-identifier regex is asserted to MATCH both a planted table literal and a planted severity branch, so a typo in the pattern turns the control red rather than the fence vacuous.
- **The unknown-code and unknown-severity verdicts survive with their fields unchanged** — asserted by `toEqual` AND by `toBe` (reference identity), which also proves the module copies no verdict and therefore cannot mutate one.
- **An unrecognised `code` renders with its `message` verbatim** — exact string equality on the row's message element, not a substring match.
- **`degraded="unreadable"` and `degraded="unreachable"` produce DIFFERENT sentences** — asserted against `DEGRADED_SENTENCE` and against each other, plus a `/shape/i` check pinning which one is which.
- **`container.querySelectorAll("button, a, [tabindex]")` is 0** for a card carrying a verdict mark — checked for all three mark kinds, with two badges and `selected: true`.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `react-refresh/only-export-components` decided where the mark table lives — and it settled a plan contradiction**

- **Found during:** Task 2
- **Issue:** the plan asks for the table in `nodePresentation.ts` AND for `PhaseNodeCard.test.tsx`'s assertions to be left alone — and the shipped fence forbids the card from importing that module at all. Both cannot hold. The table was therefore implemented in `PhaseNodeCard.tsx` first, beside `NodeVerdictMark`, specifically to avoid touching the fence. ESLint rejected it: a component file may not export a shared constant (`react-refresh/only-export-components`, quoted in full in section (b)).
- **Fix:** the table, `VERDICT_DESTRUCTIVE_TOKEN` and the key type `VerdictMarkKind` went to `nodePresentation.ts` exactly as the plan asked; `PhaseNodeCard.NodeVerdictMark` became an alias of `VerdictMarkKind`, so its exported name still resolves for every caller and there is only one copy of the union. The fence was narrowed to the tint identifiers it was written to guard, with the reason written at the assertion.
- **Files modified:** `nodePresentation.ts`, `PhaseNodeCard.tsx`, `PhaseNodeCard.test.tsx`
- **Verification:** eslint clean on all three; the three replacement tint fences each carry a positive control against the adapter; `tsc` holds at 33
- **Committed in:** `296350b4`

---

**2. [Rule 3 - Blocking] The same lint rule moved `DEGRADED_SENTENCE` out of the tray**

- **Found during:** Task 3
- **Issue:** the plan places the degraded copy in `ProblemsTray.tsx`. Exporting it from there tripped the identical rule. Leaving it un-exported would have made the test hard-code its own second copy of two user-facing sentences — free to drift from the ones actually rendered, which is the failure mode the wording split exists to prevent.
- **Fix:** `DEGRADED_SENTENCE` moved to `verdictModel.ts`, beside `NOTHING_OUTSTANDING`. That is also the better home on merit: every word a surface says ABOUT a check now sits in one pure module, next to the resting-state line it has to be chosen against.
- **Files modified:** `ProblemsTray.tsx`, `verdictModel.ts`, `ProblemsTray.test.tsx`
- **Verification:** the tray test imports the sentences from `verdictModel` and asserts the rendered text `toBe` them
- **Committed in:** `8be085e0`

---

**3. [Rule 2 - Missing Critical] There is no third declaration of the degraded-cause union**

- **Found during:** Task 3
- **Issue:** `ProblemsTray`'s prop was first typed with a locally declared `DegradedCause = "unreadable" | "unreachable"`. `useLiveValidation.ts:101` already exports `DegradedValidationCause` with exactly those members, and `builderStore.ts:122` carries a THIRD, differently-shaped `DegradedCause` (`{kind:"422"|"network"} | null`). A fourth spelling in a component would have made a rename in the hook a silent no-op here rather than a typecheck error.
- **Fix:** both `ProblemsTray.tsx` and `verdictModel.ts` type-import `DegradedValidationCause` from the hook that owns it. Type-only, so no runtime edge and no cycle (the hook imports neither module).
- **Files modified:** `ProblemsTray.tsx`, `verdictModel.ts`
- **Committed in:** `8be085e0`

---

**4. [Rule 2 - Missing Critical] `markFor` fails CLOSED on a severity outside the wire union**

- **Found during:** Task 1
- **Issue:** the plan's precedence sentence reads *"if any verdict has `severity === "error"` the mark is `error`, else if any exists the mark is `incomplete`"*. Implemented literally, a severity the wire delivers but the union does not name would resolve to the SOFT mark — a value nobody has classified rendering as "not finished yet". That is fail-OPEN, and it contradicts the plan's own totality paragraph two lines below (*"treat it as `error` at the RENDER layer"*) and the route's own classifier, which fails closed.
- **Fix:** ONE rule, applied in three places — the count, the node mark, and the tray row: `incomplete` is the only soft value and everything else is hard. For the two real severities the behaviour is identical to the plan's sentence; for a third value it is honest. The count follows the same rule deliberately, so a summary can never read "0 problems" while a problem renders.
- **Files modified:** `verdictModel.ts`, `ProblemsTray.tsx`
- **Verification:** *"an unrecognised SEVERITY survives verbatim AND fails closed at the mark"* in both suites — the field is asserted unchanged (`"catastrophe"`) while the mark and the destructive-token count say `error`
- **Committed in:** `6542642a`, `8be085e0`

---

**5. [Rule 1 - Bug] The API-import fence had to be line-scoped or the module's own docblock tripped it**

- **Found during:** Task 1 (first run: 1 failure)
- **Issue:** `/import\s+(?!type\b)[^;]*from\s+["']@\/lib\/api["']/` went red on a module that contains exactly one import, and that one a type import. `[^;]` matches newlines, so the docblock sentence *"a runtime import of the API client appears here"* on line 27 bridged twenty-six lines down into the real `import type … from "@/lib/api"` on line 53. The only way to pass it as written was to delete the paragraph explaining the fence.
- **Fix:** `/^import\s+(?!type\b)[^\n;]*from\s+["']@\/lib\/api["']/m` — anchored to a line start and forbidden from crossing one. The reason is written at the regex, because the next author will otherwise "simplify" it straight back.
- **Files modified:** `verdictModel.test.ts`
- **Committed in:** `6542642a`

---

**6. [Rule 2 - Missing Critical] The "never reads as clean" assertion got its own positive control**

- **Found during:** Task 3
- **Issue:** the plan asks the degraded tests to assert *"no element renders an `ok`/clean/pass affordance"*. A regex that matches nothing satisfies that perfectly, and this is the third time in this phase a negative assertion needed a control (184-06's reachable-string walk, 184-03's four fences).
- **Fix:** the same `CLEAN_AFFORDANCE` regex is asserted to FIRE on the healthy empty state (`degraded: null`, no verdicts), where the tray legitimately says "Nothing outstanding". A typo in the pattern now turns that control red.
- **Files modified:** `ProblemsTray.test.tsx`
- **Committed in:** `8be085e0`

---

**7. [Rule 2 - Missing Critical] The clean COUNTS line is suppressed while degraded, not just the beat**

- **Found during:** Task 3
- **Issue:** with `degraded` set and no held-stale findings, `summaryLine` returns `NOTHING_OUTSTANDING` — so a failed check would have rendered the words "Nothing to fix" in the closed summary. That is the exact "registry blip reads as a green light" failure D-184-14 and sketch 139 both name, arriving through the counts line rather than through the verdicts.
- **Fix:** `showCounts = hasAnyVerdict || degraded === null`. With held-stale findings both the counts and the degraded sentence render (the counts are still true); with nothing held over, the degraded sentence stands alone. The resting `"checked by the server"` attribution is suppressed while degraded for the same reason.
- **Files modified:** `ProblemsTray.tsx`
- **Verification:** *"neither degraded state renders a clean / ok / passing affordance"* additionally asserts `queryByTestId("problems-tray-counts")` is null
- **Committed in:** `8be085e0`

---

**8. [Rule 2 - Missing Critical] `requirements.mark-complete` was NOT run**

- **Found during:** post-plan state updates
- **Issue:** this plan's frontmatter names `requirements: [VALID-03]`. The verb flips it to **Complete** off the frontmatter alone, as it did in 184-01 (reverted) and was avoided in 184-02 through 184-07. VALID-03 is *"a user SEES per-node validation status derived from the server verdict"* — and nothing is mounted. The adapter still does not pass `verdict`, no page renders the tray, and a user can observe no difference. 184-13 composes the bottom region.
- **Fix:** the verb was not invoked. `.planning/REQUIREMENTS.md` is untouched; all five phase REQ-IDs remain **Pending**.
- **Files modified:** none

---

**Total deviations:** 8 (1 bug, 5 missing-critical, 2 blocking)
**Impact on plan:** none expands scope — the file set is exactly the seven in `files_modified`. Deviations 1 and 2 are file-placement calls made BY A LINT RULE rather than by preference, and 1 also resolves a contradiction between two of the plan's own requirements. Deviations 3, 4, 6 and 7 are the plan's intent implemented correctly rather than literally. Deviation 5 is a fence found broken and fixed. Deviation 8 prevents a false completion claim in a planning artifact.

---

## Design decisions worth carrying forward

- **One fail-closed rule, three places.** `incomplete` is the only soft value; everything else is hard. Applying it at the count, at the node mark and at the tray row is what makes it impossible for the summary to say "0 problems" while a problem is on screen. Three separate comparisons would have drifted the first time someone added a severity.
- **The colour budget is a COUNT, not a review comment.** One exported literal, `html.split(token).length - 1`, and a planted control. That is the whole mechanism, and it is the reason R9 can be verified by a machine at 11 p.m. rather than by a person squinting at a screenshot. Phase 188 should reuse the same shape for its run-state palette.
- **A lint rule can be the tie-breaker in an architecture argument.** Two placements were decided by `react-refresh/only-export-components` and both landed where the plan wanted them anyway. Worth remembering the next time a "put it next to the type" instinct competes with "put it in the tables module".
- **A fully controlled tray makes a behavioural promise structural.** "Does not auto-open on a new error" is not an effect that was carefully not written — `open` is the caller's prop, so there is no code path that could open it. The test asserts `onToggle` was never called, which is the honest form of the claim.
- **`[^;]` matches newlines.** Two of the four source fences in this plan needed line scoping or a docblock anchor. That is now the sixth-plus instance of D-ITEM-183-02 in this project and the second where the trap was inside a regex character class rather than in the choice of identifier.
- **A negative assertion needs a control as much as a source grep does.** Both new "must not render" claims in this plan carry one, following 184-06's reachable-string walk.

## Requirements

**VALID-03 is NOT complete, and `.planning/REQUIREMENTS.md` was deliberately left untouched.**

What this plan contributes: the whole rendering half exists and is machine-checked —
the client provably classifies nothing, both marks render from server-supplied values,
unknown identifiers survive verbatim, `phase: null` has a home, and a degraded check
never reads as clean. What is missing is the wiring: `PhaseNode` still does not pass
`verdict`, and no page mounts `ProblemsTray`. **184-13 composes the bottom region and
is where a user first sees any of this.** The orchestrator marks all five REQ-IDs at
phase end when the behaviour is observable (Phase 182's VALID-01 precedent).

## Threat Model Disposition

| Threat ID | Disposition | Status |
|---|---|---|
| T-184-08-01 (tampering — the verdict `message`) | mitigate | **CLOSED.** Every server string — `message`, `code`, and the derived step name — renders as a plain React text child. No `dangerouslySetInnerHTML` appears in either new component; the shipped source fence on `PhaseNodeCard` (anchored on the prop form, with a planted positive control) still passes, and `ProblemsTray` contains no HTML sink at all |
| T-184-08-02 (repudiation — client-side severity classification) | mitigate | **CLOSED.** `verdictModel.ts` contains none of the eleven identifiers the two lint modules and the route mint today, proven by a `?raw` fence with a two-case positive control and FALSIFIED by planting a table (1 test went red, naming it). The only severity comparison in the module is against the soft value, asserted by a dedicated fence with its own control. Precedence is documented in the docblock as a presentation rule over values the server supplied |
| T-184-08-03 (spoofing — a degraded check rendering as clean) | mitigate | **CLOSED.** The `unknown` mark is neutral-but-not-clean and its accessible label is asserted not to match `/ok\|clean\|fine\|pass\|all good\|✓/i`; the tray's two degraded states are asserted to render no clean affordance at all, with the same regex proven to FIRE on the healthy state; held-stale verdicts are asserted still present; the clean counts line and the resting "checked by the server" attribution are both suppressed while degraded (Deviation 7) |
| T-184-08-04 (info disclosure — technical codes on a business surface) | mitigate | **CLOSED.** The raw `code` renders only when `useTechnicalNamesOptional()?.showTechnical` is true. No provider is mounted in the tray suite, and a dedicated test asserts a row containing a known identifier does NOT print it — the fail-closed accessor returning `null` means plain language, not a crash. The 422 body never reaches this layer: it is logged at the `api.ts` boundary and the tray receives only a cause discriminator |
| T-184-08-SC (tampering — npm installs) | accept | **HONOURED — this plan installed nothing.** `package.json` and the lockfile appear in none of the three commits |

## Scope Fence Compliance

- **Frontend only.** `git diff --name-only -- backend/ supabase/migrations` returns **0** lines across all three commits. Slot 114 stays RESERVED.
- **No env var, no dependency, no migration, no cloud parity owed.**
- **Nothing is mounted.** `PhaseNode.tsx`, `WorkflowCanvas.tsx` and `WorkflowBuilderPage.tsx` are untouched; the canvas snapshot is byte-unchanged and all 31 + 22 shipped canvas assertions pass unmodified.
- **No `grounding_mode` invented** anywhere — that is Phase 185's field.
- **No third badge.** The max-2 tuple is untouched; the verdict mark is a corner mark, not a badge.
- **No new colour beyond the two marks.** `incomplete` and `unknown` spend neutral tokens only; the strong palette stays reserved for Phase 188.
- **No motion added.** A dedicated test asserts the mark's classes match no `animate-` / `transition-` / `motion-safe:` form, with `selected: true`.
- **Only `--reporter=default` / the gate's own `--reporter=json`.** No watch flag committed. No scratch file written inside `frontend/` or `backend/` (the two falsification probes were in-place edits, both reverted and grep-verified).

## Issues Encountered

- **The plan contained a pair of mutually unsatisfiable instructions** (Deviation 1), which is now the second time in this phase — 184-03 hit the same class in its own Task 3. The tell is the same both times: a `?raw` fence written as a blanket ban meets a later plan that legitimately needs the thing banned. Worth flagging to the 184-13 planner: check the shipped fences BEFORE writing "add X to module Y and import it from Z".
- **`react-refresh/only-export-components` is enforced in this repo** and will reject a constant exported from any `.tsx` that also exports a component. Two placements in this plan were decided by it. Future plans should assume a shared const belongs in a `.ts` module from the start.
- **`[^;]*` in a source-fence regex spans newlines**, and a docblock that explains the fence will bridge into the thing it forbids (Deviation 5).
- **`lib/model-info.test.ts`** remains pre-existing SEED-056 rot; it is outside this plan's target set and was not touched.
- **`PublishGauntlet.test.tsx`'s parallel-run flake** did not appear in any run of this plan; it reported its pinned 24 green on every gate invocation.

## User Setup Required

**None.** No env var, no migration, no dependency, no cloud step, no operator action.

Carried forward, unchanged, from 184-05: `__fixtures__/corpusDump.json` still needs
regenerating against a running local Supabase before `/gsd:verify-work`. Carried forward
from 184-01: the live in-app five-surface icon sweep remains a phase-verification G-4
row (needs Docker up).

## Next Phase Readiness

- **184-13 has everything it needs to compose.** It passes `groups.markFor(slug)` into the adapter's `verdict` prop and mounts `ProblemsTray` in the bottom region with `open` in its own state. Both are leaves; neither fetches.
- **184-12's per-node actions must stay on the BOTTOM edge.** The verdict mark now occupies the card's right edge at `-right-2 top-1.5`, per `canvas-184.css` `body.card-b .vmark`.
- **Phase 185 adds identifiers, not client code.** A new governance finding ships as a new `code` in the backend module that owns it and renders here with no frontend edit at all — that is the property `verdictModel`'s fence exists to keep true, and it is now falsifiable rather than aspirational.
- **Phase 188 inherits the free colour budget** and can reuse the token-count scan shape for its run-state palette.
- **The zero-assertion-edit gate is NO LONGER intact for phase 184.** Two Wave-0 seam assertions were narrowed here, both enumerated in section (b). A verifier should read that section rather than assume the gate is green.

## Self-Check: PASSED

- `frontend/src/components/workflows/verdictModel.ts` — FOUND
- `frontend/src/components/workflows/verdictModel.test.ts` — FOUND
- `frontend/src/components/workflows/nodePresentation.ts` — FOUND
- `frontend/src/components/workflows/PhaseNodeCard.tsx` — FOUND
- `frontend/src/components/workflows/PhaseNodeCard.test.tsx` — FOUND
- `frontend/src/components/workflows/ProblemsTray.tsx` — FOUND
- `frontend/src/components/workflows/ProblemsTray.test.tsx` — FOUND
- Commit `6542642a` — FOUND
- Commit `296350b4` — FOUND
- Commit `8be085e0` — FOUND

---
*Phase: 184-editable-canvas-live-structural-validation-round-trip*
*Completed: 2026-07-27*
