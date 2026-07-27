---
phase: 184-editable-canvas-live-structural-validation-round-trip
plan: 06
subsystem: workflows
tags: [live-validation, debounce, abort-controller, monotonic-sequence, fail-closed, typed-error, react-19, wave-1]

# Dependency graph
requires:
  - phase: 184-01
    provides: "`scripts/vitest-count-gate.cjs` — the D-184-08 per-file count differential, pinned at 16 files / 424 tests"
  - phase: 184-04
    provides: "`builderStore.ts`'s `ServerVerdict` / `DegradedCause` and the verdict-safe `partialize` — the untracked slice this hook's output lands in, outside the undo history"
  - phase: 184-05
    provides: "`canvasModel.fromCanvas` — the serializer that produces the definition the caller will feed this loop"
  - phase: 182-server-validation-seam
    provides: "`POST /workflows/validate` (always-200 envelope, raw-definition body, fail-closed severity classifier) and `GET /workflows/grounding-bundle` — both consumed EXACTLY as shipped"
provides:
  - "`validateWorkflow` / `getGroundingBundle` — the first clients the two shipped canvas routes have ever had"
  - "`WorkflowValidateUnreadableError` — the typed 422 that LOGS the rejected body at the api boundary and carries only a fixed business-plain message"
  - "`Verdict` / `ValidateResponse` / `GroundingBundle` — the wire types, with `code` deliberately declared as a plain string"
  - "`useLiveValidation` — the app's ONLY caller of the validation seam: one 500 ms debounce, abort + monotonic sequence, fail-closed degraded state with the cause kept, minimum-visible checking beat"
  - "`useLiveValidation.test.tsx` — 20 assertions covering all four R7 rows, with the out-of-order case falsified"
affects: [184-08, 184-09, 184-11, 184-12, 184-13, 185, 188]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A staleness guard chosen so the test that proves it CANNOT pass on the other guard — the success path deliberately omits an `aborted` check, because a sequence proof that abort could also satisfy proves nothing"
    - "A failed check that is fail-closed BY SHAPE rather than by assertion: the degraded member carries no `ok` field, so 'a blip rendered as a green light' is unrepresentable"
    - "An error class that logs its payload at the boundary that received it and carries a FIXED message forward, so an internals leak needs a new code path rather than a forgotten sanitizer"
    - "A module mock that SPREADS the real module and overrides one export — mock completeness becomes automatic and the typed error under test stays the real class, so a name drift fails a test"
    - "One shape declared in two modules that cannot import each other, bridged by a compile-time mutual-assignability assertion in the one module that legitimately sees both"

key-files:
  created:
    - frontend/src/hooks/useLiveValidation.ts
    - frontend/src/hooks/useLiveValidation.test.tsx
  modified:
    - frontend/src/lib/api.ts

key-decisions:
  - "The success path checks the sequence and NOTHING else — adding `signal.aborted` there would have made R7's out-of-order test pass on abort, silently voiding the proof the plan asks for"
  - "`ValidationState` gained a fourth member, `{kind:'checking'}`, because the plan's three-member union had no honest home for a first-ever check in flight — the alternative was claiming `ok:false` with an empty verdict list before the server had said anything"
  - "The minimum-visible beat is a second TIMER, not a clock read, so it behaves identically under fake timers and in a browser"
  - "`Verdict` is declared in `api.ts` and bridged to `builderStore`'s `ServerVerdict` at compile time — the two modules are forbidden from importing each other in both directions"
  - "`requirements.mark-complete` was deliberately NOT run — see the Requirements section"

patterns-established:
  - "Falsify a last-write-wins guard by deleting the guard, not by reordering the test: 1 of 20 went red and the sibling in-order case stayed green, which is what makes the red one evidence about ordering specifically"
  - "Assert 'not shown' over the whole reachable string graph with a planted positive control, rather than over the two fields the author happened to think of"

requirements-completed: []  # VALID-02 and VALID-03 are this plan's frontmatter requirements and NEITHER is complete. The loop exists and is proven; no surface renders it yet. REQUIREMENTS.md deliberately left untouched — see "Requirements".

# Metrics
duration: 20min
completed: 2026-07-27
---

# Phase 184 Plan 06: The Live Validation Loop Summary

**`POST /workflows/validate` and `GET /workflows/grounding-bundle` — built in Phase 182 and never called by anything — now have typed clients and one hook that owns the app's only call to the validation seam: debounced at 500 ms over structural and config edits alike, guarded twice against a reply that arrives out of order, fail-closed on every non-200 with the CAUSE kept so a reproducible shape rejection is never worded as "try again", the rejected body logged at the api boundary and provably absent from every string a renderer can reach, no call issued before the author's first edit, and not one line of client-side lint or grounding classification anywhere.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-27T10:14:00Z
- **Completed:** 2026-07-27T10:33:00Z
- **Tasks:** 3 (all `auto`, all committed atomically)
- **Files created:** 2 · **Files modified:** 1

## Task Commits

1. **Task 1: `api.ts` — `validateWorkflow`, `getGroundingBundle`, the typed 422** — `7f71d6d5` (feat) — `frontend/src/lib/api.ts` (+150)
2. **Task 2: `useLiveValidation` — debounce, abort, monotonic sequence, honest degraded state** — `06b9a41f` (feat) — `frontend/src/hooks/useLiveValidation.ts` (new, 275 L)
3. **Task 3: `useLiveValidation.test.tsx` — R7's proofs** — `84d48049` (test) — 501 L, 20 assertions

No commit deletes a tracked file (`git diff --diff-filter=D` empty across all three).

---

## (a) The out-of-order falsification — BOTH observations

The plan requires the out-of-order case to pass on the **sequence guard**, not on abort. A test that would also pass with the guard removed proves nothing, so the guard was removed and the suite re-run.

**The probe** — the applied-sequence check deleted from the success path, everything else left intact:

```ts
.then((res) => {
  // FALSIFICATION PROBE — TEMPORARY, RESTORED IMMEDIATELY BELOW.
  appliedRef.current = seq
```

**Observation 1 — exactly ONE test went red, and it is the right one:**

```
Tests  1 failed | 19 passed (20)

× renders the NEWER verdict when the newer reply resolves FIRST and the older LAST
AssertionError: expected [ { code: 'no_terminal', …(3) } ]
                to deeply equal [ { code: 'orphan_phase', …(3) } ]
```

The message names the defect precisely: the **older** answer (`no_terminal`) rendered where the **newer** one (`orphan_phase`) belongs. That is the real-world failure this guard exists to prevent — a user's latest edit showing the previous edit's verdicts.

**Observation 2 — the two neighbouring tests stayed GREEN, and that is the load-bearing half:**

- *"still applies the newer reply when the two land in the expected order"* — green under the probe, because in-order delivery never needed the guard. The red test is therefore about ORDERING specifically, not about the loop working at all.
- *"does not degrade when the superseded call rejects with an abort"* — green under the probe. **This is what proves the out-of-order test does not pass on abort.** Both guards were live in that run; only the sequence one was removed, and the abort-silent behaviour was unaffected while the ordering behaviour broke. If abort had been carrying the ordering claim, the red test would have stayed green.

**Restored —** `grep -c "FALSIFICATION PROBE" useLiveValidation.ts` → **0**, `git diff --stat` against the Task-2 commit is **empty** (the hook is byte-identical), and the suite is **20/20 green with exit code 0**.

### Why the success path deliberately does NOT check `signal.aborted`

This is the single most important implementation decision in the plan and it is easy to "improve" into a bug. `usePanelReconcile.ts:74` has a post-await `if (signal.aborted) return`, and copying it here would look like good hygiene. It would also have made the out-of-order test pass on **abort**: when the effect re-runs for definition B, the cleanup aborts controller 1, so by the time the superseded reply resolves its signal reads aborted and the reply is dropped for the wrong reason. The falsification above would then have shown a green suite with the sequence guard deleted — a proof that proves nothing.

So the success path's ONLY staleness test is `seq <= appliedRef.current`. The docblock says so, and says why, at the line itself.

---

## (b) The 422 body never reaches a rendered value — asserted over the whole graph

T-184-06-01 is checked two ways, not one:

1. **Logged.** `console.warn` is spied; the test asserts it fired **once** and that its second argument **is** (`toBe`, by identity) the raw body object handed to the error. The logging happens in `api.ts`'s real constructor — the suite spreads the real module rather than replacing it, so this is the shipped code path, not a stand-in.
2. **Not shown.** A `reachableStrings()` walk collects **every** string reachable from `ValidationState` — through objects and arrays, at any depth — and asserts none contains the planted internals marker, the framework error type, or the field name from the rejected path. Asserting on `message` and `cause` alone would have missed a leak through a nested verdict.

The walk carries its own **positive control** (`it("the reachable-string walk is a real control — it FINDS a planted internal")`), because a walk that silently returned `[]` would satisfy every negative assertion vacuously. The main test also asserts `strings.length > 0` for the same reason.

---

## (c) Import-path changes and assertion edits (D-184-08)

**Import-path-only changes in this plan: ZERO.** No existing import line in any file was re-pointed. Three net-new import STATEMENTS appear in net-new code (`useLiveValidation.ts` imports `react`, `@/lib/api` and a type from `builderStore`); they are dependencies of new code, not re-pointings, and are listed here only so the accounting is complete. `api.ts`'s import block is untouched — its diff is 150 insertions, 0 deletions, entirely below line 3370.

**Assertion edits in pre-existing test files: ZERO.**

```
$ git diff --stat 7f71d6d5~1 HEAD -- 'frontend/src/**/*.test.ts' 'frontend/src/**/*.test.tsx'
 (no pre-existing test file appears; the only test file in the range is the net-new
  frontend/src/hooks/useLiveValidation.test.tsx, 501 insertions / 0 deletions)
```

The 184-01 `soulData.test.ts` carve-out remains the only permitted assertion edit in Phase 184 and stays **spent** — this plan consumed none of it, and `soulData.test.ts` reported its pinned **14** on every gate run.

---

## Verification Results

| Gate | Required | Observed |
|---|---|---|
| `npx vitest run src/hooks/useLiveValidation.test.tsx` | 0 failures AND exit code 0 | **20 passed, exit 0** (checked explicitly — a green summary with a non-zero exit is the shipped jsdom failure mode) |
| `npx vitest run src/components/workflows … + the 3 gating suites` | 0 failures | **20 files / 752 tests passed, 0 failed, exit 0** |
| `node scripts/vitest-count-gate.cjs` | exit 0, all 16 pinned held | **exit 0** after every task; 752 total, **0 failing**, 16/16 present, **no per-file decrease** |
| Pinned-file deltas | 0 everywhere | **0 everywhere** except `canvasModel.purity.test.ts` 69 → 79, the increase 184-05 already recorded |
| `npx tsc -b \| grep -c "error TS"` | ≤ 33 (the `develop` differential) | **33** after every task — equal to baseline, and no error names a file this plan touched |
| `npx vite build` | exit 0 | **exit 0** |
| `npx eslint` on all three files | clean | **zero problems** |
| `git diff --exit-code -- 'frontend/src/**/__snapshots__/*'` | exit 0 | **exit 0 — byte-unchanged** |
| `revertByteIdentical.test.tsx` | green at its pinned 7 | **7/7, unmodified** |
| `WorkflowCanvas.test.tsx` | 31, unmodified | **31 passed** |
| `grep -c 'workflows/validate' WorkflowCanvas.tsx` | 0 | **0** — the fetch lives in the hook and `api.ts`, by construction |
| `grep -cE 'severity\s*===\|_severity\|classifySeverity' api.ts` | 0 | **0** |
| `grep -cE 'severity\s*===\s*"(error\|incomplete)"' useLiveValidation.ts` | 0 | **0** — the hook compares no severity to anything |
| `grep -c 'kind:' useLiveValidation.ts` | ≥ 3 | **8** |
| `git diff --name-only -- backend/ supabase/migrations` | 0 | **0** across all three commits |
| REQUIREMENTS.md | untouched, all 5 phase REQ-IDs Pending | **untouched** |
| Deletions in any commit | none | **none** |

### The acceptance criteria that needed reading rather than grepping

- **422 branches before the generic throw** — confirmed by reading `validateWorkflow`'s body order: the `res.status === 422` branch and its `throw` precede `if (!res.ok)`.
- **`Verdict.code` is `string`** — declared as `code: string`, with a docblock paragraph stating why and instructing later phases not to narrow it. No union of literal codes exists anywhere in `api.ts`.
- **`WorkflowValidateUnreadableError.message` interpolates nothing** — it is the fixed literal `"the workflow's shape could not be read by the validator"`; the body reaches only the `console.warn` argument list.
- **The effect cleanup calls BOTH `clearTimeout` and `controller.abort()`** — and clears the minimum-visible timer as well, which the plan did not ask for but which the "issues nothing more after unmount" test now pins.
- **The abort check is the double-shaped form** — copied verbatim from `usePanelReconcile.ts:84-92` into `isAbortError`, and both arms are exercised: one test rejects with a real `Error` carrying the abort name, another with a plain object carrying it.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `ValidationState` gained a fourth member for the first-ever check**

- **Found during:** Task 2, writing the beat's opening transition
- **Issue:** the plan's union is `idle | verdicts | degraded`. Only `verdicts` and `degraded` carry `checking`, so a check running with **no previous answer to hold** — the first check of every session, i.e. the moment right after the author's first edit — had nowhere honest to live. Staying `idle` makes the beat unrenderable; entering `verdicts` requires inventing an `ok` value before the server has said anything, and inventing `ok:false` on an empty verdict list is exactly the "greeted with a not-ok reading" failure D-184-15 exists to prevent, just moved 500 ms later.
- **Fix:** a fourth member, `{ kind: "checking" }`, carrying no `ok` and no verdicts. Every other member is unchanged, so the plan's shape is a floor rather than a ceiling; the `grep -c 'kind:' >= 3` criterion is satisfied at 8, and a dedicated assertion pins `{kind:"checking"}` as the exact state during the first beat.
- **Files modified:** `frontend/src/hooks/useLiveValidation.ts`
- **Verification:** *"keeps checking true for a reply that lands well inside the minimum"* asserts the state is `{kind:"checking"}` — by `toEqual`, so an extra invented field would fail
- **Committed in:** `06b9a41f`

---

**2. [Rule 2 - Missing Critical] The one-shape-two-declarations problem was bridged, not duplicated**

- **Found during:** Task 1
- **Issue:** `builderStore.ts:113` already declares `ServerVerdict`, structurally identical to the `Verdict` the plan requires `api.ts` to export, and its docblock instructs the future API client to *import this type rather than declaring a second copy*. That instruction cannot be followed in either direction: `builderStore.test.ts:381-390` fences the store against ever naming `@/lib/api` (so an undo can never write to the server), and `api.ts` importing the store would make the transport layer depend on a module that type-imports `WorkflowBuilderPage`, which imports `api.ts`. Declaring the second copy silently is how two shapes drift.
- **Fix:** `Verdict` is declared in `api.ts` (the wire-shape home, where every other wire type in this app lives), and `useLiveValidation.ts` — the one module that legitimately imports both — carries an exported mutual-assignability type assertion. A drift in either declaration is now a `tsc` error. Both docblocks name the other declaration and state why the import is impossible, so the next reader does not "fix" the duplication by creating a cycle.
- **Files modified:** `frontend/src/lib/api.ts`, `frontend/src/hooks/useLiveValidation.ts`
- **Verification:** `tsc` holds at 33; deliberately breaking either declaration locally produced a typecheck error at the bridge
- **Committed in:** `7f71d6d5`, `06b9a41f`

---

**3. [Rule 3 - Blocking] The bridge type had to be exported to stay alive**

- **Found during:** Task 2
- **Issue:** written as a local `type _VerdictBridge = …`, the assertion tripped `TS6196` / `@typescript-eslint/no-unused-vars` and pushed the differential to **34**. Silencing it with an eslint-disable comment or an `_`-prefix exemption would have left a type alias nothing references — which is exactly the dead code both rules exist to remove, and a future cleanup would have deleted the guard without noticing it was one.
- **Fix:** the alias is `export`ed, with a line saying it is exported so the assertion stays live rather than because anyone consumes it.
- **Files modified:** `frontend/src/hooks/useLiveValidation.ts`
- **Verification:** `tsc` back to **33**, eslint clean on all three files
- **Committed in:** `06b9a41f`

---

**4. [Rule 2 - Missing Critical] The suite SPREADS the real api module instead of replacing it**

- **Found during:** Task 3
- **Issue:** the plan prescribes the `useOperatorProbe.test.ts` shape — `vi.mock("@/lib/api", () => ({...}))`, a whole-module replacement — and warns that every symbol the render path touches must be enumerated (the `feedback_mock_completeness` lesson). Following it literally has a second cost the plan does not name: the 422 test would have to hand-write a stand-in error class, and the hook branches on `err.name`. A stand-in whose name string matched the hook's literal would pass forever even if `api.ts` later renamed the real class — the test would be pinning the test's own copy, and a real 422 would silently classify as unreachable and tell the user to retry a shape error forever.
- **Fix:** the shipped `FailReason.test.tsx:40-48` idiom — `const actual = await vi.importActual(...)`, spread, with `validateWorkflow` the only override. Mock completeness becomes automatic (there is no enumeration to forget), and the error under test is the REAL class, so its `name` and the hook's branch are pinned against each other.
- **Files modified:** `frontend/src/hooks/useLiveValidation.test.tsx`
- **Verification:** the 422 test constructs `new WorkflowValidateUnreadableError(RAW_422_BODY)` from the real module and asserts `cause === "unreadable"`; the same real constructor's `console.warn` is what the logging assertion observes
- **Committed in:** `84d48049`

---

**5. [Rule 1 - Bug] Only the CURRENT beat may end the checking indicator**

- **Found during:** Task 2
- **Issue:** the minimum-visible timer's callback first read `if (seq < appliedRef.current) return`. With beat 1 settled (`appliedRef === 1`) and beat 2 already running, beat 1's timer evaluates `1 < 1` → false and would have cleared `checking` on **beat 2's** indicator — turning the spinner off while a check was genuinely in flight, i.e. a surface claiming to be up to date while it was not.
- **Fix:** `if (seq !== seqRef.current) return` — the guard asks "am I the live beat?", which is the question, rather than "is my answer stale?", which is a different one. The distinction is written on the line.
- **Files modified:** `frontend/src/hooks/useLiveValidation.ts`
- **Verification:** *"holds the previous verdicts, dimmed, while the next check is in flight"* runs two consecutive beats and asserts `checking: true` throughout the second one
- **Committed in:** `06b9a41f`

---

**6. [Rule 2 - Missing Critical] A disabled loop does not wipe the server's last word**

- **Found during:** Task 2
- **Issue:** the plan says "return `{kind:"idle"}` … while `enabled` is false or `def` is null". Implemented as a RESET, a transient disable (or a `def` briefly null during a document transition) would discard a real server answer and replace it with a client-authored state — the client asserting something without a server, which is the D-182-06 line in a different disguise.
- **Fix:** the initial state is `idle` and the effect early-returns without touching state, so a never-enabled loop reports `idle` exactly as the plan requires (both dedicated tests assert `toEqual({kind:"idle"})`) while a previously answered loop keeps the server's last word. The reason is recorded at the early return.
- **Files modified:** `frontend/src/hooks/useLiveValidation.ts`
- **Committed in:** `06b9a41f`

---

**7. [Rule 2 - Missing Critical] `requirements.mark-complete` was NOT run**

- **Found during:** post-plan state updates
- **Issue:** this plan's frontmatter names `requirements: [VALID-02, VALID-03]`. The verb flips both to **Complete** off the frontmatter alone, as it did in 184-01 (reverted) and was avoided in 184-02 / 03 / 04 / 05. VALID-02 is live structural validation *as the canvas is built* and VALID-03 is *every mark comes from the server* — **no surface renders a verdict yet.** This plan ships the transport and the loop; a user can observe no difference.
- **Fix:** the verb was not invoked. `.planning/REQUIREMENTS.md` is untouched; all five phase REQ-IDs (`VALID-02`, `VALID-03`, `CANVAS-02`, `CANVAS-03`, `CANVAS-04`) remain **Pending**. The orchestrator marks them at phase end when the behaviour is observable (Phase 182's VALID-01 precedent).
- **Files modified:** none

---

**Total deviations:** 7 (1 bug, 5 missing-critical, 1 blocking)
**Impact on plan:** none expands scope. The file set is exactly the three in `files_modified`. Deviation 1 widens a type union by one member; deviations 2, 4 and 6 are the plan's intent implemented correctly rather than literally; 3 and 5 are defects found and fixed during the task; 7 prevents a false completion claim in a planning artifact.

---

## Design decisions worth carrying forward

- **The proof shaped the implementation, not the other way round.** The success path omits an `aborted` check *because* R7's test has to be able to fail. That is unusual enough to be worth naming: the plan asked for a proof that could only pass one way, and the only way to deliver it was to remove a line that looked like good practice. The docblock states this at the line, so a future contributor who adds the check back will read why first.
- **Fail-closed by SHAPE beats fail-closed by test.** `degraded` has no `ok` field. "A failed check rendered as clean" is not a bug this suite catches — it is a state nobody can construct. The test that asserts `"ok" in result.current === false` is documenting the shape, not defending against a live path.
- **Two guards, two questions.** The applied-sequence guard asks *is this answer stale?*; the beat guard asks *am I the live beat?* They look interchangeable and are not (Deviation 5). Each line says which question it asks.
- **The minimum-visible beat is a timer, not a clock read.** `Date.now()` would have worked under vitest's default fake-timer configuration and broken the day someone narrows `toFake`. A second `setTimeout` has no such dependency.
- **A "not shown" assertion needs a positive control as much as a source grep does.** The reachable-string walk carries one, and the main test asserts the walk found *something*, because a walk that returns nothing satisfies every negative assertion perfectly.
- **The caller contract is written down.** The loop keys on the definition's IDENTITY: a fresh object literal built during render re-fires it every render, a mutated-in-place object never fires it. 184-08 / 184-13 need to read that paragraph before wiring the store's phases into it.

## Requirements

**Neither VALID-02 nor VALID-03 is complete, and `.planning/REQUIREMENTS.md` was deliberately left untouched.**

- **VALID-02** — the live loop exists, is debounced, guarded and proven. **Nothing calls it.** No canvas node carries a mark and no problems tray exists; those land in 184-08 / 184-13.
- **VALID-03** — the client-classifies-nothing contract is honoured and machine-checked here (no severity comparison, unknown codes passed through verbatim), but the requirement is about what a user *sees* on the canvas, and no verdict is rendered yet.

## Threat Model Disposition

| Threat ID | Disposition | Status |
|---|---|---|
| T-184-06-01 (info disclosure — the 422 body) | mitigate | **CLOSED.** The raw body reaches exactly one place: a single `console.warn` argument list inside the error's constructor, at the `api.ts` boundary. The error's `message` is a fixed literal with nothing interpolated. Asserted twice — the log fired once with the body **by identity**, and no string reachable from `ValidationState` at any depth contains the planted marker, the framework error type or the rejected field name, with a positive control proving the walk can find one |
| T-184-06-02 (repudiation — client-side classification) | mitigate | **CLOSED.** `grep -cE 'severity\s*===\s*"(error\|incomplete)"'` on the hook returns 0 and the same classifier grep on `api.ts` returns 0. The pass-through is asserted behaviourally, not just by grep: a verdict with a code this client has never seen arrives with its `code` and severity unchanged, alongside a known one, in the same order |
| T-184-06-03 (spoofing — a degraded check reading clean) | mitigate | **CLOSED BY CONSTRUCTION.** The degraded member of the union carries no `ok` field, so no code path can produce one. The rejected-call test asserts `kind === "degraded"`, `"ok" in state === false`, and that the previously rendered verdicts are still present rather than replaced by an empty (and therefore clean-looking) array |
| T-184-06-04 (info disclosure — route existence when the flag is off) | accept (unchanged) | **HONOURED.** No route is mounted and no auth decision changes. A mid-session flag flip arrives as a 404 and lands in the `unreachable` class alongside a network failure, which is the correct read: the client cannot and must not distinguish "gated" from "unbuilt" |
| T-184-06-05 (DoS — validate call volume) | mitigate | **CLOSED.** One 500 ms debounce over ALL definition changes, with in-flight aborts. Asserted: three definitions inside the window issue **zero** requests during it and **exactly one** after it, carrying the LAST definition. A second test proves an unmounted hook issues nothing at any later time |
| T-184-06-SC (tampering — npm installs) | accept | **HONOURED — this plan installed nothing.** `package.json` and the lockfile appear in none of the three commits |

## Scope Fence Compliance

- **Frontend only.** `git diff --name-only -- backend/ supabase/migrations` returns **0** lines across all three commits. Zero backend change: both routes are consumed exactly as shipped. Slot 114 stays RESERVED.
- **No env var, no dependency, no migration, no cloud parity owed.**
- **No debounce library** — the timer is a closure in the shipped `lib/throttle.ts` shape, with `clearTimeout` on every effect run (a debounce resets; the shipped helper is a throttle and does not).
- **`WorkflowCanvas.tsx` untouched**, and its 31 assertions pass unmodified. The fetch could not have landed there: honouring the shipped fence is what put the boundary in the right place.
- **Only `--reporter=default` / the gate's own `--reporter=json`.** No watch flag committed anywhere. No scratch file written inside `frontend/` or `backend/`.

## Issues Encountered

- **`lib/model-info.test.ts` fails** in `npx vitest run src/lib` (1 of 191). Pre-existing SEED-056 vitest rot, named in 184-04's summary as one of the eight rotted files, and it asserts on a static model-cost table this plan does not touch. Named, not fixed — the scope-boundary rule.
- **The plan's own mock instruction carried a hidden cost** (Deviation 4). "Replace the whole module and enumerate every symbol" solves mock completeness and creates a *different* drift: a hand-written stand-in for a typed error pins the test's own copy of the class name. Worth remembering the next time a suite mocks a module that exports the error it is testing.
- **`vi.advanceTimersByTimeAsync` must be wrapped in `act`** for a `renderHook` under React 19, or the state updates the timers cause are not flushed and the assertions read a stale render. Both helpers in this suite do it; a future author copying the RESEARCH snippet verbatim would not.
- **`PublishGauntlet.test.tsx`'s parallel-run flake** (recorded in 184-04 and 184-05) did not appear in any run of this plan; it reported its pinned 24 green on every gate invocation.

## User Setup Required

**None.** No env var, no migration, no dependency, no cloud step, no operator action.

Carried forward, unchanged, from 184-05: `__fixtures__/corpusDump.json` still needs regenerating against a running local Supabase before `/gsd:verify-work` — that is 184-05's blocker, not this plan's, and nothing here depends on it.

## Next Phase Readiness

- **184-08 / 184-13 can render.** They consume `ValidationState` and own every user-facing string. The two degraded sentences are quoted in the hook's docblock so the wording split cannot be lost in the hand-off, and the `phase: null` verdict needs its home in the tray.
- **The verdicts land OUTSIDE the undo history for free.** `builderStore`'s `partialize` already excludes `verdicts` / `checking` / `degraded`, and the compile-time bridge guarantees this hook's `Verdict[]` is assignable to the store's `readonly ServerVerdict[]` without a cast. `⌘Z` cannot undo a server response.
- **`getGroundingBundle` is wired but uncalled**, deliberately — CANVAS-04's rails land in a later plan. Its `degraded` field is the honesty signal that plan must branch on; the docblock says why emptiness is not a substitute.
- **Phase 188 can reuse this hook's shape** for live run state without touching `WorkflowCanvas.tsx`, which is the architecture the shipped scope fence bought.
- **The zero-assertion-edit gate is still armed and the 184-01 carve-out is still spent.** This plan consumed none of it.
- **Carried forward from 184-01:** the live in-app five-surface icon sweep remains a phase-verification G-4 row (needs Docker up — the same prerequisite as 184-05's dump regeneration, so both can be done in one pass).

## Self-Check: PASSED

- `frontend/src/lib/api.ts` — FOUND
- `frontend/src/hooks/useLiveValidation.ts` — FOUND
- `frontend/src/hooks/useLiveValidation.test.tsx` — FOUND
- Commit `7f71d6d5` — FOUND
- Commit `06b9a41f` — FOUND
- Commit `84d48049` — FOUND

---
*Phase: 184-editable-canvas-live-structural-validation-round-trip*
*Completed: 2026-07-27*
