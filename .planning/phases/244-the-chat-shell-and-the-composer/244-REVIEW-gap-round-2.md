---
phase: 244-the-chat-shell-and-the-composer
reviewed: 2026-09-12T22:20:00Z
depth: standard
diff_base: 8a27ab7f8
round: gap-closure-2
supersedes: null
supersedes_note: |
  ⛔ THIS FILE RETIRES NOTHING FROM EITHER PRIOR REVIEW. `244-REVIEW.md` (`diff_base: 8cd9d8119`,
  gap-closure round 1) and `244-REVIEW-build-round.md` (`223b3ea4f..`, the build round) are both
  PRESERVED and both still carry their own open findings and dispositions. This file reviews ONLY
  `8a27ab7f8..9ae9f6883` — plan `244-15`, three source files — and makes no claim about any
  finding outside that diff.
files_reviewed: 7
files_reviewed_list:
  - frontend/src/stores/streamsStore.ts
  - frontend/src/providers/StreamsProvider.tsx
  - frontend/src/components/panel/PendingAskCard.tsx
  - frontend/src/__tests__/providers/streamsProvider_244_settle_ask.test.tsx
  - frontend/src/components/panel/__tests__/PendingAskCard.retired.baseline.test.tsx
  - scripts/vitest-count-gate.cjs
  - docs/HOT-FILE-LEDGER.md
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: dispositioned
dispositions:
  WR-01: FIXED — G-3 fast-fix at `f0398f045` (merged `6acc0bf28`). A 7-line precondition above the
    `try`: return early when the thread holds neither a `workflowLockByThread` entry nor a
    `harnessKickoffThreads` mark, so a Deep chat answer no longer disarms the 8s stop-confirmation
    timer and no longer issues a useless GET. Driven RED first — Tests 13/14/16 press Stop for real
    via `stopThread` + `userEvent`, so the disarm (the invisible half) is observed, not modelled.
    Test 15 pins the absent read. Count gate `8270 · 0 failed · 7480 · 277/277` (+4 = the 4 new cases).
  WR-02: DEFERRED — `deferred-items.md` § 12, with three triggers, the cheapest being the owed
    `244-15-UAT-ROW.md` drive observing an answered card reappear. The fix needs an owner for the
    reconcile's AbortController (or a targeted remove instead of a list replace) — a design call a
    spent gap-closure round is the wrong place to make.
  WR-03: DEFERRED — `deferred-items.md` § 13. The BOUND holds (O(answers), no poll, no retry); the
    NUMBER in the prose does not, and Test 8 cannot reach the second GET because `viewedThreadId` is
    `null` in Tests 2-6. ⛔ Deferred as a decision, not a typo fix: correcting the comment alone
    leaves the fence still unable to fire.
  info_items: IN-01 and IN-02 were corrected inside the WR-01 commit — the stale `:4711` citation
    (87 lines off) is now by SYMBOL so it cannot rot again, and the docblock's "six write sites" is
    seven measured call sites. IN-03 (Test 8's brace matcher and strings) and IN-04
    (`settleAnswered` unmemoised) are ACCEPTED, unfixed.
disposition_note: |
  ⚠ G-7's round cap was already SPENT when this review landed (2 of 2, waved through on the worded
  escape hatch — see `STATE.md → Guardrail overrides`). So WR-01 was triaged under G-3 as a fast-fix
  and NOT as a third round, exactly as the G-7 protocol prescribes: a gap in the last round's own
  output is a signal to fix small and stop, never to iterate. WR-02/WR-03 are deferred DECISIONS with
  fireable triggers, never silent drops.
verification_context: |
  ⚠ OV-SOLO-01 — this phase is SELF-VERIFIED, NOT INDEPENDENTLY REVIEWED. Gemini is unavailable;
  the builder and the verifier are the same agent. This review is the first read of `244-15` by an
  agent that did not shape it, but it is still Claude reviewing Claude.
  ⚠ SHELL-03 reports BUILT, DRIVE OWED. Every assertion added by this plan is a jsdom mount over a
  mocked `@/lib/api`. `244-15-UAT-ROW.md` is UNRUN. No finding below — and no clean verdict above —
  is evidence that the product behaves this way in a browser.
---

# Phase 244 (gap-closure round 2, plan `244-15`): Code Review Report

**Reviewed:** 2026-09-12
**Depth:** standard (+ RED drives against planted defects)
**Diff base:** `8a27ab7f8..9ae9f6883` (7 commits)
**Files reviewed:** 3 source + 2 suites + the gate + the ledger
**Status:** issues_found — **0 critical, 3 warnings, 4 info**

## Summary

**The four headline claims are TRUE, and I confirmed each by reading the code rather than the
SUMMARY.** The release-only invariant holds; both disjuncts of `useHarnessLiveForThread` are
cleared; `onAnswered` fires exactly once, on success only, after the optimistic flip; and
`WorkflowRunPage`'s third home is untouched (`WorkflowRunPage.tsx:1629-1642` does not pass
`onAnswered`; the prop defaults to `undefined` and the call site is `onAnswered?.()`).

**The fences BIND — I drove three planted defects RED rather than taking a green run as evidence.**
The tree was restored md5-identical afterwards and `git status` is unchanged:

| Plant | Result |
|---|---|
| Inverted the guard: `if (liveAnchor \|\| capPaused)` → `if (!(...))` | **5 failed** — Tests 2, 3, 4, 5, 7. Polarity is fenced in BOTH directions. |
| Moved `onAnswered?.()` into the `catch` arm | **1 failed** — Test 11. Fire-on-failure is fenced. |
| Deleted `onAnswered={settleAnswered}` from the stack | **2 failed** — Tests 9 and 10. The two-homes pair is NOT presence-vacuous. |

Baseline green: `21 passed (21)` across both adopted suites; `281 passed (281)` across
`src/components/panel/__tests__` + `ChatArea.approval` + `MessageList`. `tsc -p tsconfig.app.json
--noEmit` reads **67** at HEAD, identical to the SUMMARY's published base — zero new errors. The
CLAUDE.md size gate, the hot-file ledger gate (66 files parsed — **not** the Phase-242 vacuous-CRLF
shape) and all four re-derived ledger triples check out exactly, including the six-digit quick-task
subtraction (`StreamsProvider` 38 raw − `260529` = 37 ✓; `vitest-count-gate` 49 raw − 3 = 46 ✓).

**What I found is one design omission with a real user-visible consequence (WR-01), one unguarded
race the change materially widens (WR-02), and one newly-authored claim that is false on the exact
path it describes (WR-03).** None is a blocker. None involves data loss, security, or the elevation
the plan was most careful about.

---

## Warnings

### WR-01: the settle clears STOP state on threads that have no workflow at all — silently cancelling an unconfirmed stop

**File:** `frontend/src/providers/StreamsProvider.tsx:3578-3580`
**Status:** **CONFIRMED** by reading the code path end to end. The failure scenario is PLAUSIBLE
(it needs a Stop press and an answer inside the same 8-second window).

`releaseSettledWorkflowLock` fires on **every** answered ask, from `PendingAskStack`, which mounts
in the chat column (`MessageList.tsx:320`) and the panel for **every** thread — not only workflow
threads. `PendingAskCard`'s own 409 arm documents the case: *"a chat run was cancelled 20 seconds
after its ask posted"* — chat-run asks render in this stack.

For a Deep/chat thread `GET /threads/{id}/workflow` **always** reports no anchor and no cap-pause,
so the release arm **always** runs, and it calls `clearStopStateForThread(threadId)`
unconditionally. That function (`:1595-1617`) does three things beyond the kickoff mark:

```
stoppingThreads.delete(threadId)      // the "Stopping…" reading
stopNotConfirmed.delete(threadId)
disarmStopTimer(threadId)             // the 8s R2 climb-down
```

**Inputs → wrong behaviour.** Thread has a live chat run with a pending `ask_user`. The user presses
Stop (`recordStopPress` → `stoppingThreads.add`, 8 s timer armed). `StopControl.tsx:287-296` takes
the Stop button **out of the DOM** and renders `role="status"` "Stopping…". Within that window the
user answers the pending prompt. `settleAnswered` → `releaseSettledWorkflowLock` → release arm →
`clearStopStateForThread`. **The "Stopping…" reading vanishes, the Stop button reappears as if no
stop had ever been pressed, and the 8-second "we could not confirm the stop" climb-down never
fires** — over a run that is still streaming. That is the exact class of NEW LIE
`clearStopStateForThread`'s own docblock warns about (*"the surface would report an unconfirmed stop
about a stop that WAS confirmed"* — here, the mirror image), on the one surface Phase 194.1 built to
be honest about stopping.

The settle path has no business touching a thread it has nothing to release on. The same guard also
removes the pointless two-GET round trip this path currently issues on every Deep-thread answer.

**Fix:**
```ts
// The settle owns ONE fact — a workflow lock the server has dropped. A thread that holds
// neither half of that fact has nothing for this path to release, and clearing the STOP
// slice there cancels an in-flight stop-confirmation window that belongs to another concern.
const s = useStreamsStore.getState()
if (!s.workflowLockByThread.has(threadId) && !s.harnessKickoffThreads.has(threadId)) return
s.actions.clearWorkflowLockForThread(threadId)
clearStopStateForThread(threadId)
refreshPhaseSpineAfterStop(threadId)
```
and add the negative control the suite is missing: *seed `stoppingThreads` with no lock and no
kickoff mark, answer, assert `stoppingThreads.has(tid)` is still `true`.* (Placed before the GET it
also removes the fetch; placed after, it keeps the read-then-decide shape. Either is correct —
the guard is the point.)

---

### WR-02: the new post-answer `reconcile()` has no ordering guard, so a stale full-list replace can resurrect an answered prompt

**File:** `frontend/src/components/panel/PendingAskCard.tsx:809` (`void reconcile()`) with
`frontend/src/hooks/usePanelReconcile.ts:106-112`
**Status:** the missing guard is **CONFIRMED**; the interleaving that exploits it is **PLAUSIBLE**.

`reconcile()` is the *manual escape hatch*. It mints its own `AbortController` that **nothing ever
aborts**, and its post-await guard is `if (signal.aborted) return` — i.e. it guards against its own
(never-fired) abort and against nothing else. There is no generation counter and no last-write-wins
protection. On success it calls `replace(tid, data)`, an **atomic replacement of the whole list**.

Before `244-15` this hatch fired at most once per card, behind `reconciledOnce`. It now fires on
**every successful answer**, which makes two concurrent, unordered, whole-list replacements routine
rather than exotic.

**Inputs → wrong behaviour.** Two parallel asks (`useAskUserPrompt`'s own docblock: *"parallel asks
are possible (D-085-06)"*), both rendered by the stack. The user answers ask 1 → GET-A issued. The
user answers ask 2 → GET-B issued. GET-B returns `[]` first → store `[]` → both cards unmount.
GET-A, issued before ask 2 was persisted, returns `[ask2]` → `replacePendingAsksForThread(tid,
[ask2])` → **the card for the already-answered ask 2 re-mounts, fresh, in `state: "pending"`,
offering `Send Answer` for a prompt the server has settled.** Answering it yields the 409 "This run
has already ended" arm. That is the shipped defect this plan exists to remove, re-entered through
its own fix.

⭐ **Two adjacent hazards I checked and can rule OUT**, so this finding is not overstated:
- The server race is genuinely closed. `runs.py:838-858` inserts the `ask_user_response` row
  **before** the 200 returns, and `panel.py:193-204` filters `NOT EXISTS` on exactly that row — so a
  *single* settle reconcile can never resurrect the ask it just answered. The test file's claim on
  this half is TRUE.
- `reconcile()` cannot reject (`runReconcile` catches everything and writes `reconcileErrors`), so
  the bare `void reconcile()` raises no unhandled rejection.

A sibling of the same shape: `releaseSettledWorkflowLock` is likewise unordered against the six lock
WRITERS. A lock set between the GET being served and its response landing on the client is cleared
by the stale read — which would unlock the composer during a live run. I could **not** construct a
reachable path to it (every route to a fresh lock requires the composer to already be unlocked, or a
Continue press that the fail-closed `cap_paused` arm covers), so I am recording it as **PLAUSIBLE,
unproven** rather than as a second warning. What would settle it: a driven row that kicks a new
harness run off within one RTT of answering the previous run's last approval.

**Fix (either):**
```ts
// (a) generation guard in usePanelReconcile's manual hatch — a reconcile whose payload is
//     older than one already applied must not be written.
const genRef = useRef(0)
const reconcile = useCallback(async () => {
  if (!threadId) return
  const gen = ++genRef.current
  const controller = new AbortController()
  await runReconcile(threadId, controller.signal, () => gen === genRef.current)
}, [threadId, runReconcile])
```
```ts
// (b) or keep one in-flight settle per thread and let a newer one abort the older:
settleAbortRef.current.get(threadId)?.abort()
```
Fence it with a case that resolves the two GETs out of order and asserts the older payload is
dropped.

---

### WR-03: "ONE GET per human answer" is false on the production path — the release arm issues two, and the stack a third

**File:** `frontend/src/providers/StreamsProvider.tsx:3524` (the claim) vs `:3580` (the second GET)
**Status:** **CONFIRMED** by code reading.

The action's docblock argues its bounded-ness from a number:

> ⚠ AND IT NEVER POLLS. **One GET per human answer**, bounded by the number of answers.

The release arm's last line is `refreshPhaseSpineAfterStop(threadId)`, whose only guard is
`viewedThreadId !== threadId → return` (`:4449`). **`PendingAskStack`'s `threadId` IS
`useViewingThread()` (`PendingAskCard.tsx:731`, `StreamsProvider.tsx:4656`), so that guard passes by
construction on every production settle** — and `reconcilePhases` issues a **second**
`getThreadWorkflow` (`:4462`). The stack's `void reconcile()` adds a `getThreadPendingAsks`. That is
**three** requests per answered approval, not one.

The SUMMARY contradicts itself on the same count — line 51 says *"one GET per answered approval"*,
line 336 says *"The two GETs the settle issues"* — and both undercount.

This is not a performance finding (out of v1 scope); it is a **false claim in a register, authored
in the same commit as the code it describes**, load-bearing for the "it never polls" argument, and
**unfenced**: no case asserts `mockGetThreadWorkflow` call count on the *success* arm, and in Tests
2-6 `viewedThreadId` is `null`, so the second GET never executes in the suite at all.

**Fix:** correct the sentence to what the code does — *"One workflow GET in this action; the release
arm's `refreshPhaseSpineAfterStop` issues a second on the viewed thread, and the caller's ask
reconcile a third — three bounded reads per human answer, never a poll"* — and pin it:
```ts
expect(mockGetThreadWorkflow).toHaveBeenCalledTimes(2)  // with viewedThreadId === THREAD_ID
```
(WR-01's guard, if taken, removes both GETs for non-workflow threads and makes the corrected
sentence narrower still.)

---

## Info

### IN-01: a newly-authored docblock says there are six `setWorkflowLockForThread` write sites — there are seven

**File:** `frontend/src/stores/streamsStore.ts:371-373`
**Status:** **CONFIRMED** by measurement.

The executor's own claim — `grep -c` reads 5 → 5 in `StreamsProvider.tsx` — is **TRUE** (I verified
against `git show 8a27ab7f8:`). But the new docblock states the population:

> There are **six** `setWorkflowLockForThread` write sites and two of them are fenced in lockstep

Measured across production code (excluding tests and the type/stub declarations): **seven** call
sites — `ChatArea.tsx:229`, `ChatArea.tsx:262`, `StreamsProvider.tsx:1207, 2412, 2449, 2630, 3970`.
Six of them carry a `WRITE SITE n of 6` marker from `244-13`; **`StreamsProvider.tsx:3970` (the
producer-resubscribe re-key) carries none and is uncounted.** It is defensibly not a *derivation*
(it spreads an existing lock's `runId` and is a no-op when no lock exists), which is presumably why
`244-13` excluded it — but the sentence says *write sites*, not *derivations*, and an auditor who
sweeps for writers off this number will miss one. The count is inherited, not introduced here; it is
recorded because the new text re-publishes it as fact.

**Fix:** *"six DERIVING write sites (`WRITE SITE n of 6`) plus one re-key at `:3970` that spreads an
existing lock and creates none"* — or extend the numbering to `7`.

### IN-02: line citations in the new comments were already stale in the commit that wrote them

**File:** `frontend/src/providers/StreamsProvider.tsx:3571`, `:3547`, `:3564`
**Status:** **CONFIRMED.**

- `` `useHarnessLiveForThread` (:4711) `` — it is at **:4798** (87 lines off).
- *"the two `setWorkflowLockForThread` arms … (:2411 and :2447)"* — the calls are at **:2412** and
  **:2449**.
- *"the identical arm the mount reconcile owns at :2440"* — the call is at **:2441**.

The correctly-cited ones are worth naming too, because they show the drift is mechanical rather than
careless: `WorkflowRunPage.tsx:1629` ✓, `removePendingAskForThread` ✓. This file's own ledger row
has been stale eight consecutive times; inline `:NNNN` citations rot on the very edit that adds
lines above them.

**Fix:** cite by symbol name, not line — `` `useHarnessLiveForThread` (this file, search it) `` — or
accept the rot and re-derive at each touch.

### IN-03: Test 8's brace matcher does not skip braces inside strings or template literals

**File:** `frontend/src/__tests__/providers/streamsProvider_244_settle_ask.test.tsx:446-458`
**Status:** **CONFIRMED** (the fence currently works — I drove it — but it is fragile).

The sweep brace-matches the action body with a raw depth counter after `stripComments`. The body
happens to contain no braces inside string literals today. Adding a `` `${threadId}` `` template to
a `console.warn` in that action would unbalance the counter and either truncate the body (silently
weakening every `not.toMatch`) or run it to EOF. The suite does guard against the *empty* case
(`body.length > 120`), but not against a *truncated* one.

**Fix:** add an upper bound as well — `expect(body.length).toBeLessThan(4000)` — so a runaway match
fails loudly instead of sweeping the rest of the file.

### IN-04: `settleAnswered` is re-created on every stack render

**File:** `frontend/src/components/panel/PendingAskCard.tsx:806-810`
**Status:** **CONFIRMED**, cosmetic.

Every other cross-render callback in this file's neighbourhood is memoised; this one is a bare
arrow, so `PendingAskCard` takes a new prop identity on each stack render. Harmless today
(`PendingAskCard` is not memoised either), and a `useCallback` would be strictly more code than the
problem is worth — recorded only so the asymmetry is a decision rather than an oversight.

---

## Claims verified TRUE (recorded so a future reader does not re-litigate them)

| Claim | Verdict |
|---|---|
| The action never SETS a lock, a kickoff mark or a timer | **TRUE.** No `setWorkflowLockForThread`, no `setInterval`/`setTimeout` in the body; the live arm only calls `subscribeProducerStream`, which sets no lock (`:1762-1818`). Transitively an SSE `onCapPaused` can still write one — correctly, since that arm only runs when the server already reports the run live. |
| Guard polarity is correct and fenced | **TRUE**, driven RED both ways. |
| BOTH disjuncts of `useHarnessLiveForThread` are cleared | **TRUE** — the lock via `clearWorkflowLockForThread`, `harnessKickoffThreads` via `clearStopStateForThread` (`:1608-1615`). |
| The live arm is not a dead end | **TRUE** — the re-attached stream's `onTerminal` clears the lock (`:2873`) and the `streamingThreads` subscription clears the kickoff mark (`:3810-3828`). |
| `onAnswered` fires once, success only, after the optimistic flip, and cannot crash the card | **TRUE** — inside the `try`, after `setState("answered")`, wrapped in its own `try/catch`; `canSubmit` requires `!submitting && state === "pending"` and the button carries `disabled`, so a double-click cannot double-fire. |
| The third home is behaviourally byte-unchanged | **TRUE** — `WorkflowRunPage.tsx:1629-1642` passes no `onAnswered`; Test 12 pins it by API call count. |
| `PendingAskCard.retired.baseline.test.tsx` `737 → 837` is a real measurement | **TRUE** — `wc -l` 836, `split("\n").length` 837, verified directly. Nine `it(` blocks, matching the new `BASELINE` pin of 9; the three retirement-sentence fences are untouched and the suite's other eight cases assert real source content, not line counts. |
| The gate adoptions are real | **TRUE** — 12 `it(` in the settle suite = pin 12; both files added to TARGETS **and** BASELINE (the two-knob trap, correctly handled in one commit). |
| No suite mocks `@/stores/streamsStore` | **TRUE** — `grep` returns zero, so the "reach the store, not the provider hook" argument holds and the no-op default is genuinely what the eight provider-mocking suites get. |
| The four ledger triples | **TRUE** — all four re-derived exactly, with the six-digit quick-task subtraction applied. |
| `tsc` set diff | **TRUE** — 67 at HEAD, 67 published as base, `streamsStore.ts(439,55)` is the shifted pre-existing zustand `TS2345`. |

---

## What this review did NOT and could NOT establish

- **Nothing here is browser evidence.** Every case in `streamsProvider_244_settle_ask.test.tsx` is a
  jsdom mount over a mocked `@/lib/api`; two `<PendingAskStack/>` under one provider share a
  process, a store instance and a synchronous scheduler. The suite's own header says this. The real
  failure had a network round trip in the middle of it, and **`244-15-UAT-ROW.md` is UNRUN**. The
  file that says the mechanism composes is not the file that says the product works.
- **WR-02's interleaving is reasoned, not observed.** What would settle it: a driven row with two
  parallel asks answered inside one second, or a test that resolves the two reconcile GETs out of
  order.
- **The new-lock clobber (inside WR-02) is PLAUSIBLE and unproven.** What would settle it: a driven
  row that starts a new harness run within one RTT of answering the previous run's last approval.
- **OV-SOLO-01 stands.** This is Claude reviewing Claude. No independent reviewer exists for this
  phase.

---

_Reviewed: 2026-09-12_
_Reviewer: Claude (gsd-code-reviewer) — adversarial pass, three defects planted and driven RED, tree restored md5-identical_
_Depth: standard_
