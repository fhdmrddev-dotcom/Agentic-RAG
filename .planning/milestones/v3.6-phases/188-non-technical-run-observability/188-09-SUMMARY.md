---
phase: 188
plan: 09
subsystem: launch-path-and-navigation
tags: [wave-8, RUNVIZ-03, req-6, fourth-home, no-router, id-trap, positional-fallback]
requires:
  - "188-08 — `WorkflowRunPage` and its `{ runId, onBack, onOpenThread }` props contract; this plan is the mount its closing note asked for"
provides:
  - "frontend/src/App.tsx — `ActiveView` at 12 members; the run's own home"
  - "frontend/src/components/layout/ChatLayout.tsx — `activeRunId` state, the run-surface render branch before the positional fallback, and `doRun`'s retargeted tail"
  - "frontend/src/components/layout/ChatLayout.launch.test.tsx — 12 tests, four planted defects observed RED, inside the count gate from its first commit"
  - "scripts/vitest-count-gate.cjs — the `src/components/layout/ChatLayout.launch.test.tsx` TARGETS entry (the two-knob trap, FIFTH occurrence)"
affects:
  - "188-10 — the deliverable region now has a real user standing in front of it; `run.thread_id` remains the input and no new endpoint is owed"
  - "188-11 — pins `ChatLayout.launch.test.tsx` at **12** from the gate's printed `actual` column"
tech-stack:
  added: []
  patterns:
    - "Reachability is a TRIAD, not a union member: the type, the render branch and the navigation that reaches it all ship in one phase — a member without a branch renders the positional fallback silently"
    - "When two differently-typed ids share a name AND a shape, the compiler is not a control: give the two test fixtures deliberately different values so a swap is a visible failure, and fence the wrong id's tokens out of the source"
    - "A post-success read must degrade, never throw: a network blip on a read that happens AFTER the mutation succeeded must not be reported as a failed mutation"
    - "A source fence over a heavily-commented file must read STRIPPED-COMMENT code, and the stripper must itself be tested first — this file carries the fenced branch condition twice, once as code and once as prose"
    - "Falsify a positional-fallback guard by breaking the branch CONDITION, not by moving the block: a condition that no longer matches its union member reproduces the Phase-118 built-but-unreachable hazard exactly"
key-files:
  created:
    - frontend/src/components/layout/ChatLayout.launch.test.tsx
  modified:
    - frontend/src/App.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/layout/__tests__/ChatLayoutLaunch.test.tsx
    - scripts/vitest-count-gate.cjs
decisions:
  - "D-188-09-A: a null OR FAILED anchor read degrades to the shipped behaviour (`selectThread` + chat), not just a null one. The plan specified the null case; the failure case is the same defect one level up and is strictly more dangerous — this read happens AFTER a launch that already succeeded, so an unhandled rejection would propagate out of `doRun` and make RunModal render an error for a run that is genuinely under way, while ALSO leaving no cleanup (the WR-04 catch is scoped above this line). Handled as Rule 2, and fenced by its own test."
  - "D-188-09-B: the shipped Phase-121 `ChatLayoutLaunch.test.tsx` was AMENDED rather than left or deleted. Its SC#2 line asserted `onNavigate(\"chat\")` — the exact call D-188-12 replaces — so leaving it meant a red suite and deleting it meant dropping the only other guard on the launch route. Its first two assertions (createThread + postMessage with the definition id) are unchanged and now serve BOTH phases: Phase 121's D-02/D-03 launch route and Phase 188's Req 6 second assertion are the same two facts."
  - "D-188-09-C: `activeRunId` is ChatLayout-local, not App-held. `studioSkillId` is the App-held precedent for a per-view id, but it exists there because THREE surfaces navigate into the Studio. Only `doRun` — which already lives in ChatLayout — writes this one, so lifting it to App would thread a prop through for a single writer. `panelState` / `drawerOpen` are the local precedents."
  - "D-188-09-D: the source fence reads stripped-comment code. Measured: `activeView === \"workflow-run\"` appears TWICE in `ChatLayout.tsx` — once as the branch, once in the prose explaining why no nav-rail item claims the view. A raw-source fence would let a deleted branch pass on the strength of the paragraph describing it (falsification D proved this: against raw source the plant went red only on the render tests; against stripped code it also reds the fence)."
metrics:
  duration: ~55 min
  completed: 2026-08-05
  tasks: 3
  commits: 3
  migrations: 0
  packages_installed: 0
---

# Phase 188 Plan 09: Launching Lands on the Run — Summary

`doRun`'s last two lines now resolve the thread's `active_workflow_run_id` and navigate to
the run's own home instead of dumping the user into a chat message list. One union member,
one render branch before the positional fallback, one retargeted tail, and 12 tests that
fence all three — with four planted defects observed RED.

## THE MEASUREMENTS

```
$ cd frontend && npx tsc --noEmit -p tsconfig.app.json | grep -cE "error TS"
33                          # baseline AND after every task — not 0; a bare `npx tsc --noEmit`
                            # checks ZERO files, which is the trap this number exists to avoid

$ node scripts/vitest-count-gate.cjs
total 2367  ·  failed 0  ·  pinned total 1037
count gate OK — 26/26 pinned files present, no per-file decrease, 0 failing.
  ChatLayout.launch.test.tsx    —      12     new        # it DEMONSTRABLY RUNS

$ git diff --numstat 42d517b9 HEAD -- frontend/src/components/workflows/WorkflowCanvas.tsx
13	2	frontend/src/components/workflows/WorkflowCanvas.tsx

$ git status --porcelain backend/app/api/threads.py frontend/src/lib/nav-items.ts
(empty)
```

Gate total moved **2355 → 2367** (+12, exactly this suite). `WorkflowCanvas.tsx` was **not
touched by this plan at all** — the whole-phase diff is unchanged at **13 / 2** against the
≤15 / ≤4 cap, so the two remaining insertions of headroom are still unspent.

**`backend/app/api/threads.py` is byte-untouched.** An additive `workflow_run_id` key on the
kickoff POST response would have been one line and would have removed the extra client
round-trip — and it was refused. That file is G-5-firing (9+ plans) and the key would change
the response bytes for every workflow kickoff in the app. The extra `getThreadWorkflow` read
is the lower-risk default, and keeping this phase out of that file is the reason it exists.

## What Was Built

### Task 1 — the fourth home (`cda42f85`)

`ActiveView` goes 11 → 12 on one line. **No router**: this is a `useState<ActiveView>` switch
like the other eleven, and the three-homes contract holds.

The render branch sits **immediately before** the trailing `<KnowledgeHealthPage />`, and its
comment says why in the voice of the `governance` branch: that trailing element is a
**positional fallback**, not a `default:` that throws, so a union member with no branch of its
own renders Knowledge Health silently — the Phase-118 built-but-unreachable lesson. The
reachability triad (union member + mount + the navigation that reaches it) is owned in-phase.

**No nav-rail item was added.** `frontend/src/lib/nav-items.ts` is byte-untouched and
`git status --porcelain` on it is empty: per the UI-SPEC, while `activeView === "workflow-run"`
no rail item carries `aria-current`, because this home is reached by launching or by the
thread's reciprocal seam, never from the rail.

**The chat branch is byte-unchanged.** All three hunks of the diff are pure insertions and
none lands inside the `activeView === "chat" ?` region — verified with `git diff -U0`, whose
hunk headers are `@@ -23,0`, `@@ -215,0` and `@@ -643,0`. That is what makes SPEC Req 6's *no
message list and no composer* a property of the layout: the composer, the message list and the
workspace panel all live inside the chat branch, and a view on the else side renders none of
them.

`onOpenThread` resolves the thread off the already-loaded app-wide `threads` list (Phase 156's
Wave-1 bootstrap) because `selectThread` takes a `Thread`, not an id — the file's own idiom,
not an invented one.

### Task 2 — the retargeted tail (`b621faff`)

Only the two closing lines changed. Everything above the `// Only reached on a successful
launch` comment survives verbatim: `createThread`, the strict template ordering
(createThread → upload → send, Landmine 8), `postMessage` with the definition id, and the
**WR-04 orphan cleanup** that best-effort deletes the launch shell and RE-THROWS the original
error so RunModal still renders the server's message verbatim. Req 6's second assertion — *the
thread is still created and still anchors the run* — exists as a guard against over-deleting
here, and it is now asserted rather than trusted.

**The id trap, recorded at the call.** Two differently-typed ids share the name `run_id` in
this codebase and **both are bare uuids**, so the compiler cannot catch a swap. The id the
message POST hands back is the producer row that `GET /runs/{id}/stream` consumes; the run
surface is addressed by the `workflow_runs` row, which is exactly what the thread's
`active_workflow_run_id` anchor holds. Navigating with the other one yields a surface that
resolves nothing.

**No race, and therefore no retry loop.** RESEARCH measured that `create_workflow_run` writes
the thread anchor in the same transaction as the `workflow_runs` INSERT (`threads.py:930-948`),
before the producer spawns and before the response is built (`:1011`). D-188-11's thread-id
fallback is unnecessary and was not written.

**The degradation is deliberate and is now two-sided** (D-188-09-A). A null anchor restores the
shipped behaviour rather than opening a surface that cannot resolve its run. A *failed* read
does the same — see Deviations 1.

### Task 3 — the wire fence + the gate entry (`edfff92b`)

12 tests in a fresh suite authored against the shipped `ChatLayout.orgRefetch.test.tsx`
harness (the same hook mocks, the same heavy-chrome stubs — no second harness invented).
`WorkflowsPage` is stubbed down to the one thing this suite needs from it: the `onLaunch`
prop, which IS `doRun`, so the fence sits on the launch wiring rather than on card chrome that
has its own suite.

The two id fixtures are **deliberately different values** (`wfrun-0000-correct` vs
`prodrun-9999-wrong`) with a comment saying that is why — the wrong id has to be *detectable*,
and in production both are bare uuids.

The structural assertions carry positive controls: the composer and message list are asserted
**present** on the chat view before being asserted absent on the run view, and `library-health`
— a union member with no branch of its own — is used to prove the trailing element really is a
positional fallback rather than a `default:` that throws.

The `TARGETS` entry ships in the **same commit** that creates the file. `src/components/layout/`
lands outside BOTH gate knobs by default; an entry pointing at a path that does not exist yet
makes the gate ERROR rather than fail, so it can only be added here. `BASELINE` is left alone —
188-11 pins the count from the printed `actual` column.

## THE FALSIFICATIONS — four planted defects, all observed RED, all reverted

Verbatim (ANSI stripped, failing test names from `--reporter=verbose`):

**A. `doRun` navigating with the PRODUCER id captured from the message POST response** — the
exact T-188-09-01 defect:

```
 × hands the run surface the ANCHOR id, never the producer id from the POST response
 × a null anchor restores the shipped behaviour instead of opening a run it cannot resolve
 × a FAILED anchor read also degrades to the shipped behaviour — the launch already succeeded
Tests  3 failed | 8 passed (11)
```

Note the second and third failures: with the producer id the navigation is *always* truthy, so
both degradation paths die with it. That is the real blast radius of the swap, not a bonus.

**B. The WR-04 orphan cleanup deleted:**

```
 × WR-04: a failed launch cleans up the thread, re-throws, and navigates NOWHERE
AssertionError: expected "vi.fn()" to be called with arguments: [ 'thread-launched' ]
Tests  1 failed | 10 passed (11)
```

**C. The null-anchor guard removed (always navigate to the run):**

```
 × a null anchor restores the shipped behaviour instead of opening a run it cannot resolve
 × a FAILED anchor read also degrades to the shipped behaviour — the launch already succeeded
AssertionError: expected "vi.fn()" to be called with arguments: [ 'chat' ]
Tests  2 failed | 9 passed (11)
```

**D. The branch condition no longer matching its union member** — the Phase-118
built-but-unreachable hazard, reproduced rather than described:

```
 × hands the run surface the ANCHOR id, never the producer id from the POST response
 × renders NO message list and NO composer on the run surface (with the positive control)
 × is NOT the Knowledge-Health positional fallback (with the positive control)
 × the comment stripper works — and this file really does carry the tokens in prose
 × places the run-surface branch BEFORE the trailing positional fallback
Tests  5 failed | 7 passed (12)
```

**Falsification D is also what produced D-188-09-D.** Against the RAW source it reddened only
the three render tests — the source fence stayed green, because the branch condition still
appeared in the *comment* explaining the nav-rail rule. The fence was rewritten to read
stripped-comment code with the stripper itself tested first, and the same plant then reds five
tests instead of three.

The shipped Phase-121 suite was falsified separately before its amendment was committed:
flipping `onNavigate("workflow-run")` back to `onNavigate("chat")` reds it with
`expected "vi.fn()" to be called with arguments: [ 'workflow-run' ]`.

Every source file was restored from a pre-plant copy and the suite re-run green before
committing. **No `git stash` and no `git clean` were used** — the `tsc` baseline was taken
before any edit, and plants were reverted with an explicit file copy.

## Verification

| Criterion | Result |
|---|---|
| Launching does not navigate to the chat view | ✅ asserted + falsified (A, C) |
| The run surface renders no message list and no composer | ✅ structural, with a positive control on the chat view |
| The thread is still created and still sets `active_workflow_run_id` | ✅ `createThread` ×1, `postMessage` ×1 with the definition id, `getThreadWorkflow(THREAD_ID)` |
| The run id comes from the anchor, never the POST response | ✅ distinct fixtures + a stripped-code fence forbidding both wrong-id tokens |
| `ActiveView` has exactly 12 members | ✅ **12**, one line |
| `grep -c '"workflow-run"' frontend/src/App.tsx` = 1 | ✅ **1** (after Deviation 2) |
| The branch precedes `<KnowledgeHealthPage />` | ✅ asserted on stripped code; falsification D reds it |
| No nav-rail item; `nav-items.ts` untouched | ✅ `git status --porcelain` empty |
| The chat branch is unchanged | ✅ three hunks, all pure insertions, none in `:541-576` |
| `backend/app/api/threads.py` untouched | ✅ `git status --porcelain` empty |
| `npx vitest run src/components/layout/` exits 0 | ✅ **9 files / 84 tests passed** |
| `npx vitest run …ChatLayout.launch.test.tsx` ≥ 6 tests | ✅ **12 passed (12)** |
| `node scripts/vitest-count-gate.cjs` exit 0, failed 0, no decrease | ✅ exit **0** · total **2367** (was 2355) · failed **0** · 26/26 |
| `grep -c 'ChatLayout.launch.test.tsx' scripts/vitest-count-gate.cjs` = 1 | ✅ **1** |
| `npx tsc --noEmit -p tsconfig.app.json` = 33 | ✅ **33** at baseline and after each of the three tasks |
| `WorkflowCanvas.tsx` whole-phase ≤ 15 ins / ≤ 4 del | ✅ **13 / 2** — untouched by this plan |
| Zero migrations | ✅ `git diff --name-only HEAD~3 HEAD -- supabase/migrations/` empty |
| No file deleted | ✅ `git diff --diff-filter=D --name-only HEAD~3 HEAD` empty |
| No `git add -A`; `.planning/STATE.md` and `.claude/**` untouched | ✅ every commit staged by explicit path; the 5 files above are the entire diff |
| Zero packages installed | ✅ |

## Deviations from Plan

### 1. [Rule 2 — missing error handling] The anchor read degrades on FAILURE, not only on null

The plan specified the null case. It did not specify what happens if `getThreadWorkflow`
*rejects*, and the default there is worse than the case that was specified: the read sits
**below** `doRun`'s WR-04 `try`, so an unhandled rejection propagates out of `doRun` with no
cleanup and RunModal renders an error — **for a run that is genuinely under way**. The launch
already succeeded by that point; the thread exists, the anchor is written, the producer is
spawned. Reporting that as a failed launch is a lie, and one that invites the user to retry and
mint a second run.

Resolved with a `.catch(() => null)` that funnels into the same deliberate degradation, and
fenced by its own test (which also asserts the promise *resolves* and that no cleanup fires).
Recorded as a decision (D-188-09-A) rather than a silent guard.

### 2. [Rule 1 — vacuous fence] Three separate comments broke the acceptance greps they described

The fifth, sixth and seventh occurrences of the trap 187-24 named and 188-03 / 188-07 / 188-08
each hit again — recorded here as a **rule**, not another incident:

> A comment that spells a token an acceptance grep counts converts a measurement of the CODE
> into a measurement of the PROSE. Describe by ROLE; never quote the literal.

| Where | The prose | The break |
|---|---|---|
| `App.tsx` | the comment quoted the new union member | `grep -c '"workflow-run"' App.tsx` returned **2**, not 1 |
| `ChatLayout.tsx` `doRun` | the comment quoted the two replaced navigation calls | `grep -c 'onNavigate("chat")'` returned **7**, not 6 |
| `ChatLayout.tsx` branch | the comment named `<WorkspacePanel>` as a JSX tag | the Task-3 source fence went RED — the tag appeared after the split point |

All three are now written by role, each with a ⚠ note recording *why* the words are left
unspelled so the next reader does not helpfully restore them. The third one is the interesting
case: it was caught **by a test**, not by a grep in a plan document — which is the argument for
putting these fences in suites rather than in acceptance criteria.

### 3. [Measured correction] The `onNavigate("chat")` acceptance count could not drop

The plan expected `grep -c 'onNavigate("chat")'` to fall by one. It cannot: Task 1's branch
introduces a legitimate NEW `onNavigate("chat")` in `onOpenThread` (the D-188-13 seam back into
the run's chat thread), and `doRun` deliberately retains one on its fallback path — which the
plan itself permits. File total is **6 at HEAD and 6 now**; the load-bearing figure is the one
inside `doRun`, which is **exactly 1** and is the degradation, verified by reading the function
as the criterion instructs.

### 4. [Rule 1 — a shipped test asserted the replaced behaviour] `ChatLayoutLaunch.test.tsx` amended

`frontend/src/components/layout/__tests__/ChatLayoutLaunch.test.tsx` (Phase 121, SC#2) asserts
`onNavigate("chat")` at its third assertion — the exact call D-188-12 replaces. It runs today
(it is inside `src/components/layout/`, though outside the count gate) and Task 2 would have
turned it red. Amended rather than deleted: its first two assertions are Phase 121's D-02/D-03
launch route AND Phase 188's Req 6 second assertion, so the file now guards both. The docblock
records the amendment and why. Falsified before commit. See D-188-09-B.

Note also that this file carries **pre-existing** TypeScript errors (it predates the Props
widening at Phases 146/148/166 and passes 5 of 14 props). Those are part of the **33** baseline
and were deliberately **not** fixed here — out of scope, and fixing them would move a number
this phase uses as a control.

### 5. [Rule 3 — commit hygiene] Task 1's state was declared read-only so every commit typechecks

`const [activeRunId, setActiveRunId] = useState(...)` with no consumer is a `TS6133` under
`noUnusedLocals`, which would have left Task 1's commit at **34**. Rather than merge the two
tasks or ship a commit that does not typecheck, Task 1 declared `const [activeRunId] =
useState<string | null>(null)` — a truthful intermediate state (*the home exists; nothing sets
its id yet*, so the surface renders its calm no-id guard) — and Task 2 widened the destructure
by one token. Both commits read **33**.

## Known Stubs

**None introduced by this plan.** The deliverable region's stub is 188-08's, assigned to
188-10, and this plan does not touch `WorkflowRunPage.tsx`.

One thing this plan makes newly *visible* rather than newly stubbed: because launching now lands
on the run surface, a user reaching it for a live run sees the empty deliverable frame. That is
188-10's fill and is already recorded as its scope.

## Threat Flags

None. All five register entries were handled as specified:

- **T-188-09-01** (spoofing of identity — the two `run_id`s) — **mitigated, and the mitigation
  bit.** `doRun` resolves the thread anchor and never the POST response id; the two fixtures
  differ so the wrong one is detectable; a stripped-code fence asserts neither wrong-id token
  appears in the file, with positive controls proving both assembled needles match the shapes
  they forbid. Falsification A reds three tests on the plant.
- **T-188-09-02** (denial of service / data loss — the WR-04 cleanup) — **mitigated.** The
  cleanup path is byte-unchanged, asserted directly with the created thread's id, and the test
  also asserts that navigation does not occur and that the anchor read never fires on failure.
  Falsification B goes red on the plant.
- **T-188-09-03** (information disclosure — a tampered run id) — **accepted as planned.**
  Addressing is client-side; authorisation is not. `GET /workflow-runs/{id}` ownership-gates and
  404s (Plan 03, T-188-IDOR), so a tampered `activeRunId` yields *That run isn't available.*
- **T-188-09-04** (elevation of privilege — client-side gating) — **accepted as planned.** No
  flag check is added on the client; non-discoverability is server-side. A client gate would be
  a D-14 / D-181-02 red-line violation.
- **T-188-SC** (supply chain) — **accepted.** Zero packages installed; `package.json` and both
  lockfiles untouched.

No security-relevant surface outside the register was introduced: no endpoint, no auth path, no
file access, no schema change.

## Commits

| Task | Commit | Files | Diff |
|---|---|---|---|
| 1 | `cda42f85` | `App.tsx`, `layout/ChatLayout.tsx` | +61 / −1 |
| 2 | `b621faff` | `layout/ChatLayout.tsx`, `layout/__tests__/ChatLayoutLaunch.test.tsx` | +87 / −9 |
| 3 | `edfff92b` | `layout/ChatLayout.launch.test.tsx` (new), `layout/ChatLayout.tsx`, `scripts/vitest-count-gate.cjs` | +460 / −1 |

## Notes for the Next Plans

- **188-10 (the deliverable region).** The surface now has a user standing in front of it for
  a LIVE run, so the live empty-state copy (*No files yet — this run hasn't written anything.*)
  is on screen far more often than the terminal one. `run.thread_id` is still the input and no
  new endpoint is owed.
- **188-11 (the pins).** Pin `ChatLayout.launch.test.tsx` at **12** from the gate's own printed
  `actual` column across two agreeing runs — never hand-counted from `it(` literals. All the
  stale-low pins 188-02/04/05/06/07/08 flagged remain owed.
- **A reciprocal seam is now owed, and it is the only route to a finished run.** `GET /runs` is
  deferred, so once the user leaves the run surface the ONLY way back is the thread's run
  receipt (`Open the run`, D-188-13). `onOpenThread` — this plan's half of that seam — is wired
  and tested; its counterpart is not yet built. If it does not ship in this phase, a launched
  run becomes unreachable after one navigation away.
- **`ChatLayoutLaunch.test.tsx` carries pre-existing TypeScript errors** (Props widened at
  Phases 146/148/166; it passes 5 of 14). Part of the 33 baseline, deliberately untouched. A
  phase that wants that number to move should fix it there and re-pin the baseline.
- **The two remaining `WorkflowCanvas.tsx` insertions are still unspent**, and the
  `PlaneEditingLayer` / `EDIT_AFFORDANCE` extraction 185-10 named **remains owed** at the next
  FEATURE touch of that file. This plan did not touch it.

## Self-Check: PASSED

Files verified present on disk:

- `FOUND: frontend/src/App.tsx`
- `FOUND: frontend/src/components/layout/ChatLayout.tsx`
- `FOUND: frontend/src/components/layout/ChatLayout.launch.test.tsx`
- `FOUND: frontend/src/components/layout/__tests__/ChatLayoutLaunch.test.tsx`
- `FOUND: scripts/vitest-count-gate.cjs`
- `FOUND: .planning/phases/188-non-technical-run-observability/188-09-SUMMARY.md`

Commits verified in `git log`:

- `FOUND: cda42f85` — feat(188-09): the fourth home — ActiveView member + the run-surface render branch
- `FOUND: b621faff` — feat(188-09): launching lands on the run, not in the chat message list
- `FOUND: edfff92b` — test(188-09): fence the launch path — the retarget, the surviving half, the id trap

`git diff --diff-filter=D --name-only HEAD~3 HEAD` is empty — this plan deleted no file.
