---
phase: 188
plan: 05
subsystem: run-state-honesty
tags: [wave-4, extraction, G-5, RUNVIZ-01, RUNVIZ-02, source-fence, count-gate]
requires:
  - "188-02 — Phase[\"status\"] carries `unknown`, and the terminal-branch fallback is already honest; this plan moved the map that produces it"
  - "188-04 — the live branch's identity overlay reads `wf.phases`; the extraction had to leave `byIndex` and both `?.` reads intact, and did"
provides:
  - "frontend/src/lib/phaseState.ts — the ONE phase-state derivation: DB_PHASE_STATUS, phaseStatusFromDb, CanvasReading, canvasReading, TERMINAL_RUN_STATUSES"
  - "Zero local re-derivations: the only declaration of either shipped symbol anywhere in frontend/src is now the lib module"
  - "canvasReading — the single named place `retrying` collapses into running (D-188-03), so Req 4's subset property is a property of one function"
  - "phaseStatusFromDb is TOTAL over EVERY string, including inherited object keys — the guard was measured RED, not assumed"
  - "frontend/src/lib/phaseState.test.ts (34 cases) RUNNING inside the count gate — TARGETS gained the entry in the same commit that created the file"
  - "The RESEARCH measurement that `timed_out` is dead, recorded in the module docblock so a later phase can retire it in one line (D-188-21's re-open trigger satisfied)"
affects:
  - "Every later 188 plan that needs a canvas run reading — `canvasReading` is the door, and building a second one is now a source-fence failure, not a review comment"
  - "The canvas words table (188-06+) — it consumes CanvasReading and owns its OWN strings; the panel's six words are untouched and byte-identical"
  - "188-11 — `phaseState.test.ts` is deliberately in TARGETS but NOT in BASELINE; pin it from the printed `actual` (34 at this commit)"
tech-stack:
  added: []
  patterns:
    - "A pure `lib/*` leaf module with EXACTLY ONE import (`@/types`) makes an ESM cycle impossible by construction — the mechanism, not a convention"
    - "Declare the fence's expected set as an exhaustive `Record<Union, …>` so the COMPILER, not a comment, keeps the test in step with the type"
    - "Ship the count-gate TARGETS entry in the SAME commit as the net-new test file — earlier makes the gate ERROR, later leaves the fence unexecuted"
    - "A source fence read via `?raw`, with every needle assembled from parts and every absence carrying a positive control"
    - "Never spell the token a fence forbids, even in a comment — a docblock quoting it makes the grep vacuous (187-24; 188-02 had to reword, and so did this file)"
    - "`obj[key] ?? fallback` over an object LITERAL is not total: inherited members are never nullish, so the coalesce never fires"
key-files:
  created:
    - frontend/src/lib/phaseState.ts
    - frontend/src/lib/phaseState.test.ts
  modified:
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/components/panel/PhaseTimeline.tsx
    - scripts/vitest-count-gate.cjs
decisions:
  - "D-188-05-A: `phaseStatusFromDb` ships an own-property guard rather than the plan's literal `DB_PHASE_STATUS[raw] ?? \"unknown\"`. Measured RED first — `phaseStatusFromDb(\"constructor\")` returned `[Function Object]`. The plan's expression is not total, and totality is this function's entire contract."
  - "D-188-05-B: the parity block asserts over a compiler-forced `Record<Phase[\"status\"], true>` rather than importing `STATUS_META` (which is not exported). The panel's own `Record<Phase[\"status\"], StatusMeta>` is already the compiler's parity guarantee; this suite asserts the other half — that every value the derivation yields is a member of that union."
  - "D-188-05-C: `phaseState.test.ts` goes into TARGETS but deliberately NOT into BASELINE. It postdates the 1037 pin, so it reports as `new` and its count is free to grow while 188-11 does the final pinning — the shipped `WorkflowBuilderPage.header.test.tsx` precedent."
metrics:
  duration: ~40 min
  completed: 2026-08-05
  tasks: 3
  commits: 3
---

# Phase 188 Plan 05: The One Derivation Summary

The phase-state derivation now lives in exactly one file, consumed by both the developer timeline and (from the next plan) the business canvas — and writing the fence around it turned up a totality hole in the very function the fence exists to protect.

## What Was Built

### Task 1 — `frontend/src/lib/phaseState.ts` (`b55e8e90`, +156 / −0)

Five exports, one import, no vocabulary:

| Export | What it is |
|---|---|
| `DB_PHASE_STATUS` | moved VERBATIM out of `StreamsProvider.tsx`, provenance comment and all |
| `phaseStatusFromDb(raw)` | the TOTAL map, whose fallback is `unknown` and never success |
| `CanvasReading` | the seven readings D-188-04 locks — `retrying` is not a member |
| `canvasReading(phase)` | the collapse rule, and the ONE named place `retrying` becomes running |
| `TERMINAL_RUN_STATUSES` | moved out of `PhaseTimeline.tsx:40`, `timed_out` intact |

The header docblock states the sentence Req 8's fence depends on — **this module holds the DERIVATION, never the VOCABULARY** — and the acceptance greps agree: `grep -c '^import'` is **1**, and the no-vocabulary / no-styling grep is **0**.

The `TERMINAL_RUN_STATUSES` docblock carries the RESEARCH measurement in full (`run_status` assigned in exactly one place in `threads.py`, from `workflow_runs.status`, whose CHECK is `active | paused | cap_paused | completed | failed | cancelled`; the Deep producer row's status feeds only a local `producer_terminal` boolean). D-188-21's re-open trigger was *"someone measures it"* — it is now measured, on record, and next to the value, so a later phase retires the member in one line instead of re-deriving the argument.

### Task 2 — both shipped consumers rewired (`ebb4ede6`, +18 / −11)

`StreamsProvider.tsx`: the local `const DB_PHASE_STATUS` is gone, `phaseStatusFromDb` is imported, and the terminal branch's `DB_PHASE_STATUS[r.status] ?? "unknown"` became one total call. The plan's own sentence is the reason and it is now in the source: a fallback at each call site is a fallback that can be got wrong at each call site.

`PhaseTimeline.tsx`: the local `Set` is gone and imported instead. **Nothing else in the file changed** — the consumer at `:132` appears on neither side of the diff:

```
$ git diff HEAD~3..HEAD -- frontend/src/components/panel/PhaseTimeline.tsx | grep -E '^[+-]' | grep TERMINAL_RUN_STATUSES
+import { TERMINAL_RUN_STATUSES } from "@/lib/phaseState"
-const TERMINAL_RUN_STATUSES = new Set(["completed", "failed", "cancelled", "timed_out"])
```

**No test assertion moved.** `git diff --stat -- frontend/src/components/panel/__tests__/` for this task is empty, and the suite is green at **12 files / 154 passed** — an extraction that requires a test edit is not an extraction.

### Task 3 — the suite, the gate entry, and the fix the suite forced (`dfc8960a`, +449 / −1)

`phaseState.test.ts`, **34 cases** in five blocks: totality, the Req-4 subset property, precedence, parity, and the source fence. The module's source is read with `?raw`. Nine positive controls; every needle assembled with `.join("")`.

Two structural choices worth naming:

- **`PAINTABLE` and `PHASE_STATUSES` are derived from exhaustive `Record<Union, …>` literals**, so adding an eighth reading without updating this suite is a typecheck error rather than a silently under-covered fence.
- **`RECONCILABLE` is built from the shipped `DB_PHASE_STATUS`**, never re-typed — the subset property reads the same map the product reads.

`scripts/vitest-count-gate.cjs` gained `"src/lib/phaseState.test.ts"` to `TARGETS` **in this same commit**. The comment records the two-knob trap for its third occurrence, and why the entry is file-level rather than the bare `src/lib` directory (ten unread suites whose future rot this phase declines to own).

## THE RED — the totality hole the fence found

The suite was run against the module as Task 1 shipped it, i.e. with the plan's literal `DB_PHASE_STATUS[raw] ?? "unknown"`. Verbatim (ANSI stripped):

```
 ❯ src/lib/phaseState.test.ts (34 tests | 2 failed) 14ms
     × is total over INHERITED object keys — a prototype name is not a status 4ms
     × yields ONLY members of the Phase status union, for every input tried 2ms

 FAIL  src/lib/phaseState.test.ts > phaseStatusFromDb — total over every string, and never claims success > is total over INHERITED object keys — a prototype name is not a status
AssertionError: constructor is not a phase status: expected [Function Object] to be 'unknown' // Object.is equality

- Expected:
"unknown"

+ Received:
[Function Object]

 ❯ src/lib/phaseState.test.ts:168:70

 FAIL  src/lib/phaseState.test.ts > … > yields ONLY members of the Phase status union, for every input tried
AssertionError: constructor produced a value outside the union: expected [ 'pending', 'running', 'done', …(4) ] to include [Function Object]

 Test Files  1 failed (1)
      Tests  2 failed | 32 passed (34)
```

**Read the received value plainly: `[Function Object]`.** `DB_PHASE_STATUS` is a plain object literal, so it inherits `constructor`, `toString` and `__proto__`. Those reads are **never nullish**, so `??` never fires, and the function returns a *function* typed as a `Phase["status"]`. That value then misses the panel's `STATUS_META` lookup and crashes `PhaseCard` reading `.glyph` off `undefined`.

Unreachable from the CHECK-constrained column today — which is precisely the argument under which every fail-open in this file's history shipped, and the third time this phase has met that argument. The fix is one guarded line, and it is documented in the module with the observed value:

```ts
export function phaseStatusFromDb(raw: string): Phase["status"] {
  if (!Object.prototype.hasOwnProperty.call(DB_PHASE_STATUS, raw)) return "unknown"
  return DB_PHASE_STATUS[raw]
}
```

**The `32 passed` in that same run is the load-bearing half of the observation** — the other four blocks, including the whole source fence and every positive control, were green before the fix. Two failures out of thirty-four is a measurement of the function, not of a broken harness.

## Verification

| Criterion | Result |
|---|---|
| `phaseState.ts` exports all five symbols | ✅ `DB_PHASE_STATUS`, `phaseStatusFromDb`, `CanvasReading`, `canvasReading`, `TERMINAL_RUN_STATUSES` |
| `grep -c '^import' phaseState.ts` = 1 | ✅ **1** — `@/types`, nothing else |
| No vocabulary / no styling grep = 0 | ✅ **0** over the module (and **0** over the test file too — every needle assembled) |
| `grep -c 'timed_out' phaseState.ts` ≥ 1, docblock names `workflow_runs_status_check` | ✅ **4** / **1** |
| `grep -c 'const DB_PHASE_STATUS' StreamsProvider.tsx` = 0 | ✅ **0** |
| `grep -c 'const TERMINAL_RUN_STATUSES' PhaseTimeline.tsx` = 0 | ✅ **0** |
| `grep -c '@/lib/phaseState'` in each consumer | ✅ `PhaseTimeline.tsx` **1**; `StreamsProvider.tsx` **2** (the import + one prose reference — see § Deviations 2) |
| The ONLY declaration of either symbol in `frontend/src` | ✅ `lib/phaseState.ts` — the two other `DB_PHASE_STATUS` hits are prose in `PhaseReconcile.test.tsx` and a move note |
| No test assertion edited in Task 2 | ✅ `git diff -- frontend/src/components/panel/__tests__/` empty |
| `npx vitest run src/lib/phaseState.test.ts` exits 0, ≥ 20 tests | ✅ **34 passed (34)** |
| `npx vitest run src/lib/phaseState.test.ts src/components/panel/__tests__/` | ✅ **13 files / 188 passed (188)** |
| `grep -c 'readFileSync' phaseState.test.ts` = 0 | ✅ **0** — after a reword; it was **2** in prose first (§ Deviations 3) |
| `grep -c 'src/lib/phaseState.test.ts' vitest-count-gate.cjs` = 1 | ✅ **1** |
| The new suite RUNS inside the gate | ✅ printed `phaseState.test.ts — 34 new`; the gate's command line names the file |
| `node scripts/vitest-count-gate.cjs` exits 0, `failed` 0, total increased | ✅ **total 2250 · failed 0 · pinned 1037 · 26/26** (was 2216; +34) |
| `npx tsc --noEmit -p tsconfig.app.json` reports 33 | ✅ **33** at every task, and the error **set** is byte-identical to the pre-edit baseline (`diff` empty) — a stronger statement than "still 33" |
| The panel's six shipped words byte-identical | ✅ `Locked` / `Running` / `Complete` / `Failed` / `Attempt` / `Skipped`; `PhaseCard.tsx` is not in this plan's diff at all |
| `retrying` not paintable; a retrying phase reads as running | ✅ both asserted, with the pair that makes the absence meaningful |
| `canvasReading(undefined) === "not-started"` | ✅ asserted, plus the contrast case (an existing row with an unrecognised status → `unknown`) |
| `git diff --name-only HEAD -- supabase/migrations/` empty | ✅ zero migrations |
| No `git add -A`; `.planning/STATE.md` untouched | ✅ every commit staged by explicit path; the pre-existing `.claude/**` dirt and the untracked `scripts/_uat111*` scratch are untouched |
| No file deleted | ✅ `git diff --diff-filter=D --name-only HEAD~3 HEAD` empty |

## Deviations from Plan

### 1. [Rule 1 — bug] `phaseStatusFromDb` needed an own-property guard the plan did not specify

The plan (and RESEARCH § Code Example 1) both give the body as `DB_PHASE_STATUS[raw] ?? "unknown"`. **That expression is not total**, and the fence the same plan asked for is what proved it — raw output above. Fixed inline with a one-line guard, documented in the module with the observed value, and covered by two of the 34 cases plus a positive control that the inherited members really are reachable by index on a plain object literal.

This lands squarely inside the plan's own threat register: **T-188-05-01** (spoofing of outcome) is dispositioned *mitigate*, with the mitigation stated as *"totality is asserted directly"*. It is asserted, and it failed, and it is now true. Carried as a Rule-1 fix rather than a Rule-4 question because it changes no structure and no interface — the signature, the call site and the exported shape are all unchanged.

### 2. Measured correction to an acceptance criterion — `@/lib/phaseState` greps to **2** in `StreamsProvider.tsx`, not 1

The criterion says the grep returns 1 for each consumer. `PhaseTimeline.tsx` returns **1**. `StreamsProvider.tsx` returns **2**:

```
115:import { phaseStatusFromDb } from "@/lib/phaseState"     ← the import
3316:// ... the Phase-098-UAT `DB_PHASE_STATUS` map MOVED to `@/lib/phaseState` ...
```

The second is the **move note left at the map's old address**, which the plan's own Task-2 action asks for (*"delete the local declaration and its now-relocated comment"* — the relocation has to be discoverable from where the reader expects the map). The criterion's intent — exactly one import of the shared module — holds: `grep -c '^import.*@/lib/phaseState'` is **1**. Recorded rather than silently satisfied, per the project's *don't inherit unmeasured claims* rule, and rather than deleting a useful signpost to make a number match.

### 3. The `readFileSync` criterion caught this file's own docblock — reworded, not waived

First draft: `grep -c 'readFileSync' phaseState.test.ts` returned **2**, both in the header docblock explaining *why* the `?raw` loader is used instead. Exactly 188-02's deviation 3, recurring: **a comment quoting the token a fence forbids makes the fence vacuous** (187-24). The prose now names the mechanism without spelling the token, and says so in-line so the next author does not "improve" it back. The criterion returns **0** honestly rather than by exemption.

### 4. [Rule 2 — completeness] Fourteen cases beyond the plan's five groups

The plan specifies five coverage groups; a literal reading yields roughly twenty cases. The file has **34**. The additions are all cheap discriminators that make an existing assertion mean something:

- **Case sensitivity** — an upper-cased known value is `unknown`, with a positive control that its lower-cased form maps. Without the control, the assertion is consistent with a broken lookup rather than with case sensitivity.
- **Empty string and whitespace** — the cheapest totality inputs, and the ones a "the column is constrained" argument covers least.
- **The empty-string `pendingAsk`** — `!= null` is the shipped predicate, so an ask that failed to render still blocks the step. Pinned deliberately, because a truthiness check would silently un-block it.
- **`pendingAsk: null` still reads its status** — the positive control without which every assertion in the precedence block is consistent with the function *always* returning the waiting reading.
- **An existing row with an unrecognised status reads `unknown`** — the contrast that gives `canvasReading(undefined) === "not-started"` its meaning. Asserting one without the other proves neither.
- **Cardinality and non-identity** — seven statuses, seven readings, but only six distinct reading outputs, because two statuses collapse into one. That single number is the shape of D-188-03 stated as a property.

### 5. No `git stash` was used

The `tsc` baseline was captured **before** any edit (scratchpad, at commit `93bbfc87`) and the full error set diffed after every task — the sanctioned alternative 188-02 recommended after its own process deviation, and the method 188-04 used. All three diffs are empty.

## Known Stubs

None. Every line written is live: both shipped consumers import the module in the running product, and all 34 cases drive the real exported functions with no mock anywhere in the file.

## Threat Flags

None. Every register entry was handled as specified:

- **T-188-05-01** (spoofing of outcome — `phaseStatusFromDb`) — **mitigated, and the mitigation bit.** Totality is asserted directly including the explicit *is not done* assertion, and the assertion **failed against the shipped expression**, which is the difference between a fence and a gesture. The single fallback now lives in one place.
- **T-188-05-02** (tampering — a second derivation appearing later) — **mitigated.** The `?raw` fence asserts exactly one declaration of each function and forbids the module importing the api client, a provider or a component; all three absences carry positive controls, and the fence now RUNS inside the count gate, which was the half that could have been silently skipped.
- **T-188-05-03** (information disclosure) — **accepted as planned.** The module renders nothing and holds no vocabulary, enforced by the no-vocabulary grep at 0.
- **T-188-SC** (supply chain) — **accepted.** Zero packages installed; `package.json` and both lockfiles untouched.

No security-relevant surface outside the register was introduced: no endpoint, no auth path, no file access, no schema change. `git diff --name-only HEAD -- supabase/migrations/` is empty.

## Commits

| Task | Commit | Files | Diff |
|---|---|---|---|
| 1 | `b55e8e90` | `lib/phaseState.ts` | +156 / −0 |
| 2 | `ebb4ede6` | `providers/StreamsProvider.tsx`, `components/panel/PhaseTimeline.tsx` | +18 / −11 |
| 3 | `dfc8960a` | `lib/phaseState.test.ts`, `lib/phaseState.ts`, `scripts/vitest-count-gate.cjs` | +449 / −1 |

## Notes for the Next Plan

- **`canvasReading` is the only door.** A canvas plan that needs a run reading imports it; writing a second switch over `Phase["status"]` in the canvas tree is now a source-fence failure rather than a review comment. The canvas's own **words** table is a different file and a different concern — that separation is D-188-02, not an accident.
- **`canvasReading` takes `Phase | undefined` deliberately.** The canvas joins definition nodes to run rows by `phase_index` (D-188-01) and will have holes; `undefined` → `not-started` is the answer, and the *existing row with an unrecognised status* → `unknown` case is what keeps the two distinguishable. Do not "simplify" the signature to a required argument.
- **`phaseState.test.ts` is in TARGETS but NOT in BASELINE — pin it at 34.** Read the number from the gate's printed `actual` column across two agreeing runs, never by hand-counting `it(` literals. Same for the still-outstanding stale-low pins: `PhaseReconcile.test.tsx` is pinned at **2** while it runs **12**, flagged by both 188-02 and 188-04 and still owed.
- **The prototype-key lesson generalises.** Anywhere in this phase that indexes an object literal by a server-supplied string and coalesces, the coalesce does not fire for inherited names. The canvas words table will be exactly that shape.
- **`timed_out`'s retirement is now a one-liner with evidence attached** — the measurement sits in the module docblock and a test keeps it attached to the value. A later phase deletes one string and one docblock paragraph.
- **`PhaseCard`'s `STATUS_META` is still not exported**, which is why this suite asserts parity over a compiler-forced union table instead. If a later plan needs the panel's key set mechanically, exporting it is a one-line change — but the panel's `Record<Phase["status"], StatusMeta>` already makes the compiler the guarantee, so measure the need before spending the export.

## Self-Check: PASSED

- All five files exist on disk: `frontend/src/lib/phaseState.ts`, `frontend/src/lib/phaseState.test.ts`, `frontend/src/providers/StreamsProvider.tsx`, `frontend/src/components/panel/PhaseTimeline.tsx`, `scripts/vitest-count-gate.cjs` — plus this summary.
- All three commits resolve in `git log`: `b55e8e90`, `ebb4ede6`, `dfc8960a`.
- `git diff --diff-filter=D --name-only HEAD~3 HEAD` is empty — this plan deleted no file.
