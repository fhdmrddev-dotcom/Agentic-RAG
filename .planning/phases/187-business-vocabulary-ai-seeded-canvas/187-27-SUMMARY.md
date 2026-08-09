---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 27
subsystem: workflow-studio-authoring
tags: [gap-closure, round-5, fail-open, validate-on-open, d-184-14, d-184-15, d-181-01, d-187-14]
gap_closure: true
gap_closure_round: 5
gap_closure_base: 15339441

requires:
  - "useLiveValidation.ts — the shipped four-state loop and its `enabled` contract (Phase 184-06, VALID-02)"
  - "verdictModel.ts — DEGRADED_SENTENCE, the one home for every word a surface says about a check (184-08)"
  - "ProblemsTray.tsx — three clean affordances that already suppress for a non-null cause (184-08)"
  - "WorkflowBuilderPage.tsx — the `blockedReason` memo and its branch ordering (184-11 / CR-03 / 186-18)"
provides:
  - "TrayCheckCause — the check-state union a SURFACE can be in, widened past what the loop can emit"
  - "isCheckOutstanding(kind) — one home for the idle-or-checking rule, so the hot page gains no declaration"
  - "validate-on-open for a flag-on drafted definition with steps"
  - "a fail-closed publish window: a check that did not run can no longer unblock a publish"
affects:
  - "the problems tray: a third honest sentence, and three all-clear affordances that stop lying"
  - "the publish trigger: disabled with a reason for the window between opening a draft and the first answer"
  - "nothing else: no backend file, no migration, no shared path, and the flag-off surface byte-for-byte"

tech-stack:
  added: []
  patterns:
    - "widen the union in the CONSUMER-facing module, never in the emitter — a type must not admit a member its owner cannot produce (the WR-14 drift class)"
    - "an exported one-line predicate instead of a page-level helper, so a capped hot page gains a branch and not a declaration"
    - "a rewritten instrument, not a weakened property: when an absolute count stops being able to carry a claim, measure the claim directly"

key-files:
  created: []
  modified:
    - frontend/src/components/workflows/verdictModel.ts
    - frontend/src/components/workflows/verdictModel.test.ts
    - frontend/src/components/workflows/ProblemsTray.tsx
    - frontend/src/components/workflows/ProblemsTray.test.tsx
    - frontend/src/components/workflows/WorkflowCanvas.tsx
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx

decisions:
  - "D-187-27-01: the never-ran member is spelled `not-run`, NOT the obvious single word — that word is on the graded-governance never-say list and `governanceVocabulary.test.ts` sweeps every string literal in this tree for it. Renaming the discriminant beat adding an exemption to a shipped governance fence. This DEVIATES from the plan's literal `contains: \"unchecked\"` artifact criterion; the criterion's INTENT (a named third member reaching all three files) is met"
  - "D-187-27-02: `isCheckOutstanding` is exported from `verdictModel.ts` rather than inlined twice on the page — one home for the rule, and zero new declarations in a page under a hard insertion cap"
  - "D-187-27-03: four shipped cases were rewritten IN PLACE, never deleted; three had instruments that only worked while nothing validated on open, and one was asserting the defect outright"
  - "D-187-27-04: 186-16's WR-10 baseline capture was STRENGTHENED rather than weakened — `before` is now taken from a SETTLED reading instead of an accidental pre-check one"

metrics:
  duration_minutes: 74
  tasks_completed: 3
  files_created: 0
  files_modified: 7
  tests_added: 15
  commits: 2
  completed: 2026-08-04
---

# Phase 187 Plan 27: The Never-Ran Fail-Open (GAP B) Summary

Opening an existing draft into the canvas now **issues** a check, and until that check answers the
publish trigger is disabled with an honest sentence — closing the fail-open where the canvas claimed
*"Nothing to fix — the static checks pass · checked by the server"* over a check nobody had made.

## What shipped

The operator's session measured `validateCallsMade: 0` on an opened draft, with the tray rendering
the all-clear and Publish **enabled** — for a definition the server marks `ok:false` the moment it is
asked. That is verbatim the shape the page's own `blockedReason` docblock forbids: *"A check that did
NOT RUN must never unblock a publish (D-184-14, fail-closed)."* The shipped rule covered `degraded`
and did not cover **never-ran**.

| # | Task | Commit |
|---|---|---|
| 1 | not-yet-checked becomes a state the surface can say out loud | `a3aa3f4d` |
| 2 | the check runs on open, and until it answers Publish says so | `a25a2df2` |
| 3 | prove each fence bites, and measure every gate | *(measurement only — the four probes were applied to real source, observed RED, and reverted; no source change survives, so the task carries no commit of its own — the 187-26 precedent)* |

**Both halves shipped together, because either alone is wrong.** Fail-closed alone would leave every
opened draft permanently unpublishable until the author made a pointless edit — a fail-closed state a
person cannot escape is a new defect, not a fix. Validate-on-open alone leaves the debounce-plus-request
window still lying. The "…and an ok:true answer RELEASES it" case is the one that pins the first half;
the "…still the reason once the request is genuinely in flight" assertion pins the second.

**The component was never the liar.** All three of `ProblemsTray`'s clean affordances — the counts
line, the resting attribution and the empty paragraph — already suppress themselves for a non-null
cause. The tray needed a **value**, not a rewrite, which is why this fix cost the component exactly
one prop type and one docblock paragraph.

## The mount cap (D-187-14) — measured, not asserted

`git diff --numstat 15339441 HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx`:

```
15	3	frontend/src/pages/WorkflowBuilderPage.tsx
```

**Exactly at the round cap: 15 insertions / 3 deletions**, of which 187-26 spent 6 / 1 and this plan
spent 9 / 2. The first draft of edit 4 measured 16 insertions; the ternary was collapsed onto one
line rather than the budget renegotiated.

The three deletions were named in advance and are a **hook argument**, a `useState` initializer
(187-26's) and a `useMemo` object field — so **zero reach the render body**, which is what D-187-14
literally constrains. Proved with `187-VALIDATION.md` §(a1)'s added-lines-only method (`[ \t]`, not
`[[:space:]]`, on this machine's grep):

```
$ echo "$D" | grep -cE '^\+[ \t]*<[A-Z]'                          # new JSX elements
0
$ echo "$D" | grep -cE '^\+[ \t]*(function|const [A-Za-z]+ = \()'  # new declarations
0
```

The whole of this plan's share of the page:

```diff
@@ -189,0 +190 @@
+import { isCheckOutstanding } from "@/components/workflows/verdictModel" // 187-27 (GAP B)
@@ -780,0 +787 @@   (one added sentence in the `hasEdited` docblock, recording the D-184-15 narrowing)
@@ -802 +809,2 @@
-  const validation = useLiveValidation(definition as WorkflowDefinitionJSON | null, hasEdited)
+  // 187-27 (GAP B): also on OPEN, for a flag-on draft that already has steps …
+  const validation = useLiveValidation(definition as …, hasEdited || (canvasEnabled && phases.length > 0))
@@ -1120,0 +1129,2 @@
+    // 187-27 (GAP B): NEVER-RAN is fail-closed too — D-184-14's rule for a check that did not run.
+    if (isCheckOutstanding(validation.kind)) return DEGRADED_SENTENCE["not-run"]
@@ -1366 +1376,2 @@
-      degraded: storeDegraded === null ? null : storeDegraded.kind === "422" ? "unreadable" : "unreachable",
+      // 187-27 (GAP B): never-ran OUTRANKS the mirror …
+      degraded: isCheckOutstanding(validation.kind) ? "not-run" : storeDegraded === null ? … ,
@@ -1378,0 +1391 @@
+    validation,
```

The never-ran branch sits **below** the `!canvasEnabled || builderPhase` gate, because it is a
statement about a check — a verdict-class reading — and the flag-off surface must never show one.
CR-03 / 186-18 is the recorded cost of getting that ordering wrong.

## RED observed before green, both times

**Task 1** — five cases run against the shipped modules:

```
 × counts, beat and empty paragraph are ABSENT for `unchecked` …
   AssertionError: expected '' to be undefined
 × held-stale findings still render under `unchecked` …
   AssertionError: expected '' to be undefined
 × DEGRADED_SENTENCE is TOTAL over the widened union …
   AssertionError: expected [ 'unreachable', 'unreadable' ] to deeply equal [ 'unchecked', 'unreachable', …(1) ]
 × the third sentence is DISTINCT from both shipped ones AND from the clean line
   TypeError: Cannot read properties of undefined (reading 'trim')
 × it claims no pass and attributes nothing to the server …
   TypeError: .toMatch() expects to receive a string, but got undefined
 Test Files  2 failed (2)
      Tests  5 failed | 54 passed (59)
```

**The defect's exact current rendering was recorded as part of that RED**, and it is the positive
control inside the first case: with the cause `null` and every other input identical, the tray
renders `problems-tray-counts` = *"Nothing to fix — the static checks pass"*, `problems-tray-beat` =
*"checked by the server"*, and the *"Nothing outstanding"* paragraph. That is what the page handed
the tray for every opened draft before this plan. Then green: **59 passed**.

**Task 2** — four cases run against the shipped page:

```
 × VALIDATE-ON-OPEN — mounting a drafted definition WITH steps asks the server, on no edit at all
   AssertionError: expected 0 to be greater than or equal to 1
 × THE FAIL-CLOSED WINDOW — while the answer is outstanding, Publish is DISABLED and names why
   Error: expect(element).toBeDisabled()
   Received element is not disabled:
     <button class="… bg-primary …" data-testid="publish-trigger" type="button" />
 × …and an ok:false answer names the VERDICT verbatim, never the unchecked sentence
 × THE TRAY AGREES WITH THE TRIGGER — one never-ran state, never two stories
   AssertionError: expected 'false' to be 'unchecked'
 Tests  4 failed | 3 passed (7)
```

The second one is the operator's finding reproduced mechanically: the publish trigger **is not
disabled** on a draft nobody has checked.

## The four falsification probes

Each was applied to real source, driven through real `vitest`, observed RED with raw output, then
reverted — with the revert **proved by sha256** and by an empty `git status`. Per the 187-24 lesson,
`git checkout --` was **not** used: a sidecar copy reversed exactly what it applied.

| # | Probe | Observed RED | Revert proved |
|---|---|---|---|
| P-19 | reverted the enabled widening to bare `hasEdited` | `expected 0 to be greater than or equal to 1` — the validate-on-open case | sha256 `db0aa868…eeb36` restored |
| P-20 | deleted `canvasEnabled &&` from the enabled expression | `expected "vi.fn()" to be called +0 times, but got 1 times` — the D-181-01 flag-OFF pin | sha256 `db0aa868…eeb36` restored |
| P-21 | deleted the `blockedReason` never-ran branch | `Received element is not disabled` — the fail-closed publish-window case | sha256 `db0aa868…eeb36` restored |
| P-22 | forced the canvas session's `degraded` back to the store-only translation | `expected 'false' to be 'not-run'` — the tray's three-absence case, i.e. the original defect reproduced on demand | sha256 `db0aa868…eeb36` restored |

### A harness hazard worth recording — the first P-19 and P-20 runs measured NOTHING

The first attempt at each probe reported **green**, and both were false readings: the working-tree
edit did not survive between the tool call that applied it and the tool call that ran `vitest`, so
the suite ran against unprobed source. The plan's own instruction is what caught it — *"if it stays
green without the guard, the pin is measuring nothing"* — and the diagnosis was made by
instrumenting the assertion to print `{calls, grid, spine}` rather than by assuming.

**The rule this establishes for any future probe in this project: apply the probe and run the suite
in ONE tool call.** A probe applied in one call and measured in the next is not a falsification; it
is a green light with nothing behind it. Both P-19 and P-20 went red immediately once re-run that
way, and P-21 / P-22 were driven that way from the start.

## Every gate, measured

| # | Gate | Result |
|---|---|---|
| 1 | the five named suites | **0 failed**, 237 total |
| 2 | `node scripts/vitest-count-gate.cjs` | **exit 0** — `count gate OK — 18/18 pinned files present, no per-file decrease, 0 failing`. Total 2164, pinned total 715. `WorkflowBuilderPage.canvas.test.tsx` **124** (pin 22, +102) and `WorkflowCanvas.test.tsx` **35** (pin 31, +4) — neither fell. **No pin was lowered.** No parallel-execution flake recurred in `PublishGauntlet.test.tsx` (46) or the canvas suite |
| 3 | `npx tsc --noEmit -p tsconfig.app.json` | **33 `error TS` lines**, ZERO in this plan's files |
| 4 | `npx vite build` | **exit 0** — `✓ built in 4.74s` |
| 5 | zero backend files, zero migrations | `git diff --name-only 15339441 HEAD -- backend/ supabase/migrations` → 0 lines; `git status --porcelain supabase/migrations` → 0 lines |
| 6 | zero false completion records | no SDK completion verb called — see "State writes" below |

### Per-file counts, before and after

The "before" is **derived** from the round base's own blobs (`git show 15339441:<path> | grep -cE
'^\s*it(\.each)?\('`), never inherited. Absolute literal counts do not equal run counts (`it.each`
expands), so the **deltas** are the instrument:

| file | declared literals base → HEAD | delta | ran at HEAD |
|---|---|---|---|
| `verdictModel.test.ts` | 25 → 29 | **+4** | 29 |
| `ProblemsTray.test.tsx` | 26 → 30 | **+4** | 30 |
| `WorkflowBuilderPage.canvas.test.tsx` | 114 → 121 | **+7** | 124 |
| `WorkflowBuilderPage.describe.test.tsx` | 12 → 15 | **+3** *(187-26's, not this plan's)* | 19 |
| `WorkflowCanvas.test.tsx` | 35 → 35 | 0 | 35 |

Every delta is non-negative. Measured run totals moved 222 → **237** across the five suites.

### The typecheck baseline, re-derived rather than inherited

`33` is the count of lines matching `error TS`; the raw output is **61 lines**, because several TS
errors emit indented continuations. Measured at the start of this plan (before any edit), after Task
1, after Task 2 and after the rename — stable at 33/61 throughout, and none in this plan's files at
any point. This agrees with 187-26's re-derivation; it was re-measured, not copied.

## Deviations from Plan

### 1. [Rule 2 — a shipped governance fence] The union member is spelled `not-run`, not the plan's word

- **Found during:** Task 2, gate 2 (the count gate went red with 1 failing test)
- **Issue:** The plan specifies the third member be keyed `"unchecked"`, and its `must_haves`
  artifacts require the literal string `unchecked` in three files. That word is on the **graded
  governance never-say list** (`references/graded-governance.md` §VOCABULARY, binding — *"Free to
  think"*, never *"Ungoverned"* / *"unchecked"*, because *"Judgement is not a gap"*), and
  `governanceVocabulary.test.ts` sweeps every string literal in the workflows tree and the Builder
  page for it with the TypeScript parser. The literal type member and the page's discriminant both
  tripped it:
  `expected [ './verdictModel.ts', …(1) ] to deeply equal []`.
- **Fix:** The member is `"not-run"` and the sentence is unchanged. The alternative was adding an
  exemption to a shipped governance fence to fit a spelling — which would have weakened a guard whose
  bluntness is deliberate (it does not care whether a literal is copy or a discriminant, because the
  way banned copy actually arrives is somebody lifting a nearby machine token into a sentence).
  `verdictModel.ts`'s docblock now carries a **DO NOT "TIDY" THIS SPELLING** paragraph naming the
  fence, so the next reader does not rename it back and red the gate.
- **What this costs the plan's criteria, stated plainly:** the artifact criterion `contains:
  "unchecked"` and the key-link `pattern: "unchecked"` do **not** hold literally. Their intent — a
  named third member reaching `verdictModel.ts`, `ProblemsTray.test.tsx` and
  `WorkflowBuilderPage.canvas.test.tsx`, and a page→tray link carrying it — is met under the token
  `not-run`. The user-facing sentence *"Not checked yet."* is unaffected.
- **Files:** all seven
- **Commit:** `a25a2df2`

### 2. [Rule 3 — blocking] Four shipped cases had instruments that only worked while nothing validated on open

Triage, never deletion. No per-file count dropped; each rewrite is named here.

| Case | Why it broke | What it asserts now |
|---|---|---|
| `184-11` *"mounting a draft calls validateWorkflow ZERO times and renders no verdict mark"* | **It was asserting the DEFECT.** Zero calls on a drafted definition WITH steps is exactly the fail-open GAP B measured | renamed *"mounting a draft ISSUES the check (187-27) and still claims no verdict until it answers"*; the no-mark half is untouched. D-184-15's own reason — a draft with NO steps — is asserted still at ZERO in the new block. Its `describe` was renamed to *"what starts the loop (D-184-15, narrowed by 187-27)"* |
| `184-12` *"R10 — the refusal consults the server ZERO times"* | The absolute count over the whole mount can no longer carry "the refusal asked nothing" | the open's own check is settled first, then the property is a **differential across the gesture** — which is what it always meant |
| `185-08` *"D-185-19 — the row is synthesized LOCALLY"* | Same class | **stronger now**: the check is held UNANSWERED for the whole case, so nothing the server said can possibly be the row's source. The positive control became "the spy fires AGAIN" |
| `186-16` *"names the outstanding write while it is outstanding…"* | Its `before` baseline caught the transient never-ran sentence, so the closing equality compared two different moments | **strengthened, not weakened**: `before` is now taken once the open's check has ANSWERED, so *"returns to whatever it was before the write"* is a settled-to-settled equality |

### 3. [observation, not a change] The shipped *"the FIRST edit starts the loop"* case is now weaker but still true

`184-11`'s second case asserts one call after an edit. With validate-on-open the mount already
schedules one, so the case no longer isolates the edit as the cause. It was left in place and
untouched — it still passes and still states something true, and rewriting a green case to chase
precision would have been scope this plan did not price. Named here so it is a known, recorded
weakening rather than a discovered one. The edit-driven loop remains falsified by P-19 (which reds
the *open* case) and by `D-185-19`'s rewritten positive control (which reds if an edit stops asking).

## State writes — what was and was not done

Per the standing false-completion guard, recorded so the next reader can audit it:

- **`requirements.mark-complete` was NOT called.** `VOCAB-02` remains unmarked;
  `git status --porcelain .planning/REQUIREMENTS.md` is EMPTY.
- **`state.advance-plan` was NOT called.**
- **`roadmap.update-plan-progress` was NOT called.** The two ROADMAP edits are hand-made and each
  individually true: the wave-14 checkbox for `187-27` is ticked, and the phase progress-table row
  moves `26/29` → `27/29`. **No checkbox for `187-28` or `187-29` was touched**; both remain `- [ ]`.
- `completed_plans` incremented 97 → 98, a single honest step for this one plan.

## Known Stubs

None. Every value this plan adds is derived from live state: the cause comes from the loop's own
discriminant, the sentence comes from the one copy module, and both reach the surface through props
that already existed. No hardcoded empty value flows to a rendered element and no placeholder copy
ships.

## Threat surface

No new surface beyond the plan's register.

- **T-187-R5-06** (elevation of privilege, `blockedReason`) — mitigated. A never-ran check can no
  longer unblock Publish; the branch sits below the flag gate. Observed RED by P-21.
- **T-187-R5-07** (repudiation, `ProblemsTray`) — mitigated. The surface cannot attribute a check to
  a server that never made one; the resting attribution and the all-clear line are both provably
  absent, with a positive control in the same case proving the fence can fire.
- **T-187-R5-08** (behaviour change, the widened `enabled`) — mitigated. `canvasEnabled &&` keeps the
  flag-off surface issuing exactly the requests it issues today, pinned at zero and observed RED by
  P-20.
- **T-187-R5-09** (self-inflicted DoS, validate-on-open) — mitigated. One debounced request per
  opened draft on the already-shipped abort + sequence loop; zero-step drafts still issue nothing.
- **T-187-R5-10** (tampering, the widened union) — accepted as planned. `verdictModel`'s shipped
  `?raw` purity guards were re-run and hold: no identifier table, no request, no runtime import of
  the API client, no store, no React, no DOM/clock/randomness. The two added imports are type-only
  and erased.
- **T-187-R5-SC** — held: **zero package-manager installs**, zero new dependencies.

## Verification against the plan's success criteria

- [x] `useLiveValidation` is enabled by `hasEdited || (canvasEnabled && phases.length > 0)`
- [x] `TrayCheckCause` and its sentence live in `verdictModel.ts`; `DEGRADED_SENTENCE` is total over
      it, asserted by iterating the record's own keys plus a compile-time exhaustiveness object
- [~] the member is keyed `not-run`, not `unchecked` — see Deviation 1
- [x] `ProblemsTray` renders no counts, no beat and no empty paragraph for the never-ran cause, with
      a positive control in the same case proving all three DO render when the cause is `null`
- [x] `blockedReason` returns the never-ran sentence while `validation.kind` is `idle` or `checking`
- [x] Flag-OFF open issues ZERO `/validate` calls, pinned and observed RED without the guard
- [x] P-19…P-22 each observed RED with raw output and each revert proved by sha256
- [x] `git diff --numstat 15339441 HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx` = **15 / 3**;
      the third deletion is the `useMemo` object field, named in advance; both render-body greps 0
- [x] No per-file test count dropped; `node scripts/vitest-count-gate.cjs` exit 0
- [x] `npx tsc --noEmit -p tsconfig.app.json` = 33, none in this plan's files; `vite build` exit 0
- [x] Zero migrations, zero backend files, zero SDK completion verbs called

## What this does NOT close

`187-27` closes GAP B only. GAP C (`187-28`, the stale `workflows.py` doc claim) and the round-5
pins + record (`187-29`) are untouched.

**Owed to the operator, and not satisfiable by any test in this plan:** round-5 manual row **M16**
("a freshly-opened draft claims no check nobody ran — *watch the FIRST SECOND*") is authored in
`187-29`. The seeded-rows caveat is binding on it: the existing `workflow_definitions` rows are test
data of unknown vintage, so M16 must also be performed against a **freshly generated** draft. This
plan's jsdom cases prove the state machine; only the operator can confirm that the first second on a
real screen reads as *"Not checked yet."* rather than as a flash of the old all-clear.

## Self-Check: PASSED

All 7 modified files exist on disk. Both claimed commits (`a3aa3f4d`, `a25a2df2`) resolve in
`git log`. `.planning/REQUIREMENTS.md` is clean and `VOCAB-02` carries no completion mark. In the
ROADMAP's round-5 waves `187-26` and `187-27` are ticked; `187-28` and `187-29` both remain `- [ ]`.
