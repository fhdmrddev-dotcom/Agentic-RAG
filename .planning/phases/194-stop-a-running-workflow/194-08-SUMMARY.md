---
phase: 194-stop-a-running-workflow
plan: 08
subsystem: chat-streaming
tags: [stop, cancel, streams-provider, active-runs-tray, honesty, fences]
requires:
  - "194-01 (BASELINE figures)"
  - "194-03 (the panel Stop mount + its F-1 cancelRun-call-site fence)"
provides:
  - "V-06: the composer Stop's producer-id resolution during a harness run, pinned on the id VALUE"
  - "V-08: the tray lists a harness thread and stops it through the one durable path"
  - "T-194-08-01: the pre-stamp silent no-op is now OBSERVABLE"
affects:
  - "frontend/src/providers/StreamsProvider.tsx (stopStream + stopThread ONLY)"
tech-stack:
  added: []
  patterns:
    - "assert the VALUE handed to cancelRun, never the call count — a wrong-id Stop is silent by construction"
    - "drive membership from the real send path, never a hand-seeded Set"
    - "swap ONE action on the live zustand store for a spy, so a one-mechanism claim becomes exact"
key-files:
  created:
    - frontend/src/components/chat/__tests__/ComposerStopHarness.test.tsx
    - frontend/src/components/chat/__tests__/ActiveRunsTray.test.tsx
  modified:
    - frontend/src/providers/StreamsProvider.tsx
decisions:
  - "The pre-stamp no-op is made OBSERVABLE (console.warn), not fixed by disabling the control — the rejected option carries a re-open trigger in the code comment"
  - "V-08 is a CREATE, not the 'extend' 194-VALIDATION.md claims — measured, the file did not exist"
  - "scripts/vitest-count-gate.cjs is NOT edited: these suites sit outside its TARGETS, and the script is outside this plan's files_modified"
metrics:
  tasks: 3
  commits: 4
  duration: ~50m
  completed: 2026-08-16
---

# Phase 194 Plan 08: Composer + Tray Stop During a Harness Run — Summary

Pinned SC#1 mounts 2 and 3 on the id **VALUE** they resolve, refuted CONTEXT's stated
fear about the stuck-banner state by measurement, and closed the one real gap: a Stop
pressed before the run id is stamped is no longer a silent success.

**Base asserted:** `b096db88` (the worktree forked from `3781a3fe` — the **6th of 6**
wrong-base forks in this phase; corrected with `git reset --hard` before any commit).

---

## What shipped

| Task | Commit | What |
|---|---|---|
| 1 | `cac9ff83` | `ComposerStopHarness.test.tsx` — 6 cases pinning V-06 |
| 2 | `241d9cd5` | `StreamsProvider.tsx` — both falsy-`runId` early returns made observable, +5 cases |
| 2b | `c2a82087` | Repaired a **vacuous fence of this plan's own**, caught by its own plant |
| 3 | `58e6dac7` | `ActiveRunsTray.test.tsx` — 5 cases pinning V-08 (a CREATE) |

**Production diff is one file and two hunks.** `git diff -U0 -- StreamsProvider.tsx`
reports hunks at `@@ -2386` (inside `stopStream`) and `@@ -2408` (inside `stopThread`),
`+61 / −2`, and **the two deleted lines are the two bare `if (!runId) return` guards
themselves**. No demux line, no store slice, no export moved. Of the 61 added lines,
~50 are the recorded-decision comment.

---

## The measured refutation of CONTEXT D-08 — recorded beside the original wording

`194-CONTEXT.md` D-08 mount 2 says whether the composer Stop *"actually renders and
fires during a workflow run is UNVERIFIED"*, and that `BUG-260815-04` *"may defeat"*
the `runStatus === "streaming"` scan.

**Measured: it does not, and the stuck banner is the evidence.** The banner branch
(`MessageItem.tsx:635`) is `isStreaming && !hasAnyTools`, rendered on the LAST assistant
row (`MessageList.tsx:182` passes `isStreaming={isStreaming && isLastAssistant}`). The
scan walks to the LAST assistant message in the same bucket. When the stuck banner is
on screen, the row the scan targets is the row the banner is drawn on. The
stuck-banner case asserts it is genuinely in that shape (harness-locked, thread
streaming, last message assistant, `tool_calls` length 0, `runStatus === "streaming"`)
**before** claiming the scan survives it — and it PASSES.

⚠ **The one honest qualification, stated rather than rounded up.** `MessageItem`'s
`isStreaming` is the THREAD-level `useStreamingForThread` value, **not**
`message.runStatus` — the two predicates are not literally identical. What makes them
coincide is construction: both mint sites stamp `runStatus: "streaming"` in the same
breath as the `streamingThreads` add (`:1926-1936` send, `:1621-1632` reconcile). A
future change adding a streaming thread with no `runStatus`-stamped row would separate
them. Nothing does today; the docblock is where a future reader learns the property
rests on that.

---

## Fences driven RED — five plants, and one of them found a fence of ours vacuous

Every plant was applied to **real production source**, observed, reverted, and the file
confirmed **md5-identical**.

| # | Plant | File | Reds | Observed failure |
|---|---|---|---|---|
| A | Re-seed the kickoff placeholder from the workflow-run anchor (`anchorRunId ?? run_id`) | `StreamsProvider.tsx` | hop-2 case | `expected 'wfrun-aaaa-bbbb' to be 'producer-run-1111-2222'` |
| A′ | Same plant, intermediate assertion neutralised | `StreamsProvider.tsx` | hop-2 case | `cancelRun` received `"wfrun-aaaa-bbbb"` — **the value clause fires independently** |
| B | Hoist `stopThread`'s warn OUT of the guard | `StreamsProvider.tsx` | happy-path-silence case | `expected "warn" to not be called at all, but actually been called 1 times` |
| C | `stoppedByUserRef.current = true` ABOVE the guard | `StreamsProvider.tsx` | stoppedByUserRef case | `expected true not to be true` |
| D | Tray's per-row Stop calls `cancelRun(id)` instead of `stopThread(id)` | `ActiveRunsTray.tsx` | 3 cases | `stopThread` 0/1, `cancelRun` 2/3, `stopThread(` occurrences 1/2 |
| E | A `cancelRun` on a path **no test clicks**, both `stopThread` sites intact | `ActiveRunsTray.tsx` | 2 cases | `cancelRun` called 2 times; `not to contain 'cancelRun'` — **both ABSENCE clauses fire independently** |

md5s: `StreamsProvider.tsx` `5756e4e2…` (pre-change) → `f1bdacaa…` (post-change),
restored exactly after every plant. `ActiveRunsTray.tsx` `24e5608a…` before and after
plants D and E.

### ⚠ Plant C did NOT red on its first run — and investigating rather than recording a pass found a fence WE had just written that could not fire

This is the fourth instance in Phase 194 of a fence caught by PLANTING and none by
reading, and the first where the vacuity was in this plan's **own new test**. It failed
in **two independent ways**, either of which alone would have shipped it:

1. **The stamp is in `sendMessage`'s `finally`, not in `onTerminal`.** The
   `wasStoppedByUser → stopped: true` write lives at `:2352-2364`, reached only once
   `await subscribeToRun(...)` **resolves**. The house `makeSseRecorder` returns a
   promise that never resolves — correct for delta-routing tests, fatal here. The
   `finally` never ran, so `stopped` was never written under ANY value of the ref, and
   `expect(stopped).not.toBe(true)` passed vacuously.
2. **The "positive control" was itself vacuous.** It used `onTerminal("cancelled")`,
   and `:2138` stamps `stopped: true` off the terminal **KIND** alone with no reference
   to `stoppedByUserRef`. It proved the `kind` branch works and said nothing about the
   ref. *A test that passes because a pre-existing mechanism ALSO produces the value
   proves less than it looks* — exactly the trap the brief names.

Both cases were rewritten onto a `makeControllableRun()` helper using terminal kind
`"done"`, so the **only** writer of `stopped` is the ref. Plant C was then re-driven
and reds precisely one case with `expected true not to be true`.

### Clauses NOT independently driven — stated rather than implied

The source fence's `not.toMatch(/from\s+"@\/lib\/api"/)` and `not.toMatch(/fetch\s*\(/)`
clauses were **not** driven RED independently. Plants D and E both add the `@/lib/api`
import, but the earlier `cancelRun` clause short-circuits before those are reached. They
are belt-and-braces beside the driven `cancelRun` clause, and this sentence is the
record of that.

### The comment-strip is DEFENSIVE, not load-bearing today

`grep -c "cancelRun" ActiveRunsTray.tsx` → **0**. The docblock at `:25-26` says *"cancel
path"*, not `cancelRun`, so stripping comments does not currently save this fence from
the bare-grep trap. It is kept because that trap has been tripped four times in Phase
194 alone, and because `:25-26` is precisely the docblock that will acquire the literal
token the next time someone documents the rule more precisely. Claiming the strip is
load-bearing would be the overstatement this project keeps correcting.

---

## The observability fix, and the option that was rejected

`stopStream` (`:2386`) and `stopThread` (`:2408`) now emit
`console.warn("Stop did nothing: no run id yet for thread", <id>, "— the run had not
finished registering (the pre-stamp window). …")`.

- **The guard is unchanged** — `cancelRun` is still never called with a falsy id.
- The wording is deliberately distinct from the neighbouring `"Stop failed:"` catch, so
  the two conditions are separable in a log capture.
- It names the thread id and the condition and **nothing else** (T-194-08-04: no message
  content, no auth header, no run output).
- **`stoppedByUserRef` stays BELOW the guard.** Verified at HEAD: the shipped order was
  already correct, so this is a pin, not a fix. Setting it on a path that cancelled
  nothing would be the same lie one layer up — the surface would render "Response
  stopped" for a run that completed.

**Rejected: disable the Stop control until the id lands** (194-RESEARCH § B's second
option). It reaches into the composer's shipped `disabled` logic and changes a control's
behaviour during a one-RTT window on **every** run, Deep included, to close a gap
measured in one round trip. **RE-OPEN TRIGGER (recorded in the code comment, not only
here): a second sighting of a Stop lost in the pre-stamp window** — a UAT row, a bug
report, or this `warn` appearing in a real log capture.

No npm package was added; the observability uses `console` (T-194-08-SC satisfied).

---

## V-08's stale claim, corrected

`194-VALIDATION.md` row V-08 names
`frontend/src/components/chat/__tests__/ActiveRunsTray.test.tsx` and marks it
**"✅ extend"**. **Measured at the phase base: it did not exist**, and `ActiveRunsTray`
had **no dedicated suite anywhere in the repository** — its only coverage was
incidental, through `ChatHistoryColumn.test.tsx`, which mounts the tray as a child and
asserts nothing about it. **V-08 is a Wave-0 CREATE.** The original wording is quoted
beside the correction in the new file's docblock. `194-VALIDATION.md` itself was **not**
edited (it is outside this plan's `files_modified`).

The suite deliberately does **not** copy `ChatHistoryColumn.test.tsx`'s wholesale
provider mock: a hand-seeded `Set` proves only that a listed id renders, whereas V-08's
sentence is about **membership**. The harness thread is driven into
`useStreamingThreadIds()` by a **real workflow kickoff** through the same
`streamingThreads` add at `:1942-1944`, so a future change that skips the add for
harness kickoffs reds here.

---

## Gates

| Gate | Baseline (`194-BASELINE.md` / inherited at `b096db88`) | Measured | Verdict |
|---|---|---|---|
| `tsc -p tsconfig.app.json --noEmit` | **33** | **33** | unmoved (re-run after every task) |
| frontend count gate | `OK` · total 3954 · failed **0** · pinned 3868 · 75/75 | `count gate OK` · total **3954** · failed **0** · pinned 3868 · **75/75** | OK |
| new suites | — | **16 passed / 0 failed** (11 + 5) | green |
| production `cancelRun(` call sites | definition + **2** | definition + **2** (`:2400`, `:2470`) — no third | unmoved |

⚠ **The count gate does NOT execute either new suite, and saying so is part of the
reading.** `TARGETS` (`scripts/vitest-count-gate.cjs:2071`) covers
`src/components/workflows` plus four named Builder-page files; `src/components/chat` is
outside it entirely. That is why the total is **3954 both before and after** rather than
3970. The gate's value here is the *other* direction — it proves the `StreamsProvider`
edit broke nothing inside its blast radius (`failed 0`). Evidence that the new suites
pass is the direct vitest runs above, not the gate.

### Regression evidence for the `StreamsProvider` edit — compared by NAME, never by count

`src/providers src/__tests__/providers src/components/chat src/components/layout
src/components/panel` was run twice: once with my `StreamsProvider.tsx`, once with the
**base** file restored via `git checkout b096db88 -- <file>` (test files unchanged
between runs, so the only variable is the production edit).

```
BEFORE (base StreamsProvider): 15 failing
AFTER  (my  StreamsProvider):  13 failing
NEW failures introduced by my change: 0
Failures that disappeared: 2
  - ComposerStopHarness … "stopStream in the same condition behaves identically"
  - ComposerStopHarness … "stopThread with a streaming assistant that has NO runId …"
```

The **only** delta is my two signal cases flipping from red to green — which is the RED
observation re-confirmed as a byproduct. The 13 remaining failures are **identical by
name** on both sides: the pre-existing SEED-056 rot set in the provider suites
(dedup / `argsCodeText` / reconcile / clientKey), none of which touches the cancel path.
A count comparison could not have shown this; the name diff can.

---

## Deviations from Plan

**1. [Rule 1 — Bug in our own new test] The `stoppedByUserRef` fence was vacuous**
- **Found during:** Task 2, driving plant C
- **Issue:** Both the assertion and its "positive control" could not fire (see above)
- **Fix:** `makeControllableRun()` helper + terminal kind `"done"` in both cases
- **Commit:** `c2a82087`

**2. [Rule 3 — Blocking] `getSnapshot` was missing from the api mock**
- **Found during:** Task 1, hop-3 case
- **Issue:** Since Phase 075 (D-075-02) `reconcile` reads the atomic `getSnapshot`, not
  `getActiveRuns`. Unmocked, the whole reconcile died inside its own
  `catch { console.error("reconcile failed:") }` — silently — so hop 3 never minted.
  The ported house mock (`streamsProvider.test.tsx:33-62`) stubs only five functions.
- **Fix:** added `getSnapshot` to the mock, with the reason recorded inline.

**3. [Process] `git checkout -- <file>` destroyed an uncommitted implementation**
- **Found during:** Task 2, reverting plant A
- Reverting a plant with `git checkout --` reverts to **HEAD**, which discarded the
  Task-2 implementation that was not yet committed. Re-applied and verified
  byte-identical by md5 (`f1bdacaa…`); no work lost. **Plants after an uncommitted
  change must be reverted from a file copy, or the change committed first.** No
  `git stash` was used at any point (forbidden — the stash stack is shared across
  worktrees). A pre-existing `stash@{0}` from another session was observed and left
  untouched.

---

## Deferred, with triggers

| Item | Trigger |
|---|---|
| Neither new suite is inside `scripts/vitest-count-gate.cjs`'s `TARGETS`, so the gate can never notice them being deleted or shrinking. Not fixed here: the script is outside this plan's `files_modified`, and a bare `src/components/chat` directory entry would drag a large unrelated surface into the gate's blast radius. | The next plan whose `files_modified` legitimately includes `scripts/vitest-count-gate.cjs` should add these two files as **named entries** (the `WorkflowBuilderPage.*.test.tsx` precedent), not a directory entry. |
| `194-VALIDATION.md` row V-08 still reads "✅ extend". | Whoever next edits `194-VALIDATION.md` corrects the row to CREATE, quoting the original beside it. |
| `WorkflowLock.runId`'s two-id-types landmine is untouched here (route-side fix is plan 194-11). This plan's contribution is that the tray cannot reach it, and the composer resolves the correct type. | Plan 194-11. |

---

## Threat register outcomes

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-194-08-01 | mitigate | **Done.** Early return observable; `stoppedByUserRef` proved (by a driven plant) to stay below the guard. |
| T-194-08-02 | mitigate | **Done.** The V-06 pin asserts the id VALUE against the kickoff body's producer id and was driven RED against the workflow-anchor re-seed. Server half remains plan 194-10. |
| T-194-08-03 | transfer | Unchanged — the tray sends a thread id it already renders; ownership is enforced server-side. |
| T-194-08-04 | mitigate | **Done.** The signal carries the thread id and the condition only. |
| T-194-08-SC | mitigate | **Done.** No npm install; `console` only. |

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema surface was
introduced; the only production change is a `console.warn` on an existing early return.

## Non-goals honoured

- ⛔ Id-resolution strategy unchanged (pinned, not rewritten).
- ⛔ `cancelRun`'s 404 swallow untouched.
- ⛔ The harness phase demux (`:963-1100`) untouched — zero diff lines there.
- ⛔ No third `cancelRun` call site (verified: definition + 2).
- ⛔ No npm package.
- ⛔ Mount 4 stays descoped — nothing under `pages/WorkflowsPage.tsx` or
  `components/workflows/library/`.
- STATE.md / ROADMAP.md / REQUIREMENTS.md untouched; no `gsd-sdk state.*` /
  `roadmap.*` / `requirements.*` verb was invoked.

## Known Stubs

None.

## G-5 note

`frontend/src/providers/StreamsProvider.tsx` **is** on the `CLAUDE.md` hot-file ledger
(`068 / 075 / 075.4 / 075.6 / 075.7`, marked *satisfied (075.7)*). This plan adds **no
second concern**: the whole change is a `console.warn` inside two guards the file
already had, at `+61 / −2` with the two deleted lines being those guards. No refactor is
owed by this plan. The ledger row is not edited here — `CLAUDE.md` is outside this
plan's `files_modified`, and re-deriving that row's figures belongs to the phase's
close-out plan.

## Self-Check: PASSED

All four artifacts present on disk (`ComposerStopHarness.test.tsx`,
`ActiveRunsTray.test.tsx`, `StreamsProvider.tsx`, `194-08-SUMMARY.md`); all four commit
hashes (`cac9ff83`, `241d9cd5`, `c2a82087`, `58e6dac7`) present in `git log`. Working
tree clean apart from this SUMMARY at the time of the check.

## Skills

`sketch-findings-agentic-rag` was **not** loaded, and the reason is recorded rather than
left as an omission: this plan draws no control, names no user-visible control, adds no
copy to any surface and changes no visual. Its only new output is a `console` line. The
one component-render case renders the **already-shipped** `composer-stop` control and
asserts its shipped `aria-label`; it introduces nothing to design.
