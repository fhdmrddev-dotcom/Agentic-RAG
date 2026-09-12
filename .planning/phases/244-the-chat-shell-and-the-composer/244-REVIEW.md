---
phase: 244-the-chat-shell-and-the-composer
reviewed: 2026-09-12T00:00:00Z
depth: standard
diff_base: 8cd9d8119
round: gap-closure-1
supersedes: 244-REVIEW-build-round.md
supersedes_note: |
  ⛔ THIS FILE DOES NOT RETIRE THE BUILD ROUND'S FINDINGS. `244-REVIEW-build-round.md` is the
  review of a DIFFERENT diff (`223b3ea4f..HEAD`, 29 files) and is preserved verbatim; its
  frontmatter carries the disposition of all 18 findings, of which WR-04, WR-08 and IN-01..IN-09
  are still OPEN with fireable triggers in `deferred-items.md`. `WR-07` is CLOSED by `244-13`.
  This file reviews ONLY `8cd9d8119..b11e99c8e` (gap-closure round 1, plans 244-09 … 244-13).
files_reviewed: 16
files_reviewed_list:
  - backend/app/services/tool_dispatcher.py
  - frontend/src/components/layout/NavPanel.tsx
  - frontend/src/providers/StreamsProvider.tsx
  - frontend/src/components/chat/ChatArea.tsx
  - frontend/src/components/chat/MessageItem.tsx
  - frontend/src/components/chat/MessageList.tsx
  - frontend/src/stores/streamsStore.ts
  - backend/tests/unit/test_244_attachment_hydration.py
  - frontend/src/components/layout/__tests__/ChatLayout.scrollFrame.test.tsx
  - frontend/src/__tests__/providers/streamsProvider_244_snapshot_failure.test.tsx
  - frontend/src/components/chat/__tests__/ChatAreaBanner.test.tsx
  - frontend/src/components/chat/__tests__/MessageItem.inlineApproval.test.tsx
  - frontend/src/components/chat/__tests__/ThinkingBlock.characterization.test.tsx
  - frontend/src/components/chat/__tests__/ChatArea.capPausedComposer.test.tsx
  - frontend/src/components/chat/__tests__/ThreadRunLineKickoff.test.tsx
  - frontend/src/components/chat/__tests__/MessageItem.answerOutOfFold.test.tsx
findings:
  critical: 1
  warning: 5
  info: 5
  total: 11
status: issues-found
---

# Phase 244 — gap-closure round 1: Code Review Report

**Reviewed:** 2026-09-12
**Depth:** standard (per-file analysis of `8cd9d8119..b11e99c8e`, language-aware)
**Files Reviewed:** 7 non-test source files + 9 test files
**Status:** issues_found

## Summary

Five plans, five measured gaps. Four of the five fixes address the cause they name and nothing
else. The fifth (`244-11`, gap G-3) reuses **half** of the shipped writer it says it copied: it
takes the failure WRITE from the `loadMessages` path and leaves behind that path's
clear-on-success and its silent single retry — so a transient snapshot 503 now paints a banner
that never goes away, and once the transcript loads the banner asserts the exact sentence
`244-11` exists to prevent (**CR-01**).

`244-13`'s lock discriminator is correct at all six write sites and at every consumer I could
find — but it fixes WR-07's direction and leaves the mirror open one component over: the Continue
card is still gated on `capPaused` alone, so a harness run that caps now renders *"Start a new
message to keep going"* over a composer that has just been disabled (**WR-01**). Two mount-time
writers of the same lock still disagree about `capPaused`, and after this round that disagreement
is what decides whether that card renders at all (**WR-02**).

**What held up under adversarial reading, verified rather than accepted:**

- **The path-traversal fence is genuinely byte-unchanged.** `_attachment_container_path`
  (`tool_dispatcher.py:1820-1846`) does not appear in the diff at all; `_ATTACHMENTS_DIR` and
  `_ATTACHMENT_NAME_MAX` are untouched. The new per-file record keys on the **raw workspace
  path** (`row["path"]`), never on the container destination, so the record cannot be used to
  smuggle a path past the sanitiser — the dedup decision and the destination decision remain two
  separate derivations of one row.
- **The new cap arithmetic cannot be driven negative.** `rows[:max(MAX - len(already), 0)]` plus
  the second `if not rows: return notes` means budget exhaustion returns a NAMED note and copies
  nothing, rather than slicing with a negative index (which in Python would silently copy from
  the tail). Driven in the suite's case C against `_ATTACHMENT_HYDRATION_MAX_FILES = 2`.
- **The in-place mutation of `already` is safe for every caller.** `_hydrate_thread_attachments`
  has exactly **one** call site (`tool_dispatcher.py:2107`); the set it receives is the one stored
  in `_hydrated_files[session]`, keyed per sandbox session, which is itself keyed per `thread_id`
  (`sandbox_service.get_or_create:25`). No second caller shares the object, and the `TypeError`
  fallback builds a throw-away set rather than aliasing a shared one.
- **`StreamsProvider.tsx:4368`'s `wf.mode === "harness"` was correctly left alone.** That read is
  inside `reconcilePhases` and consumes `ThreadWorkflowState.mode` (`lib/api/threads.ts:1276`,
  `"deep" | "harness"`) — the **server wire type**, a different field from the client store's
  `WorkflowLock.mode`. Confirmed by reading both declarations; the two are not interchangeable
  and the diff does not conflate them.
- **`244-12`'s mount renders nothing when there is no pause, and cannot double-render in the chat
  column.** `PendingAskStack` returns `null` on `asks.length === 0` (`PendingAskCard.tsx:734`);
  the per-row mount was removed from `MessageItem` in the same commit; `WorkspacePanel.tsx:436`
  is the only other mount and it is a *different column*, gated on `pendingAsks.length > 0`, which
  is the deliberate two-homes design (D-244-11) rather than a duplicate.
- **The cost claim is constant in row count.** `usePanelReconcile` fires on `[threadId]` only, so
  the mount's fetches scale with thread opens, not with rows — verified in source, and fenced by
  W3/W4 with an equality against a control rather than a literal. I found nothing larger than the
  published +4, nothing unbounded, and nothing that scales with row count.
- **No new type errors.** `npx tsc -p tsconfig.app.json --noEmit` in `frontend/` reports **67**,
  byte-identical to the recorded base count, and none of the 67 sit in a file this round touched.
- **The gate registry was not weakened.** `git diff --numstat scripts/vitest-count-gate.cjs` reads
  `81 4`; every removed line is a baseline number REPLACED by a larger one
  (`ChatAreaBanner 7→9`, `ChatLayout.scrollFrame 5→6`, `ChatArea.capPausedComposer 6→8`,
  `MessageItem.inlineApproval 8→13`) plus two newly-pinned files. No entry was deleted.
- **No plan over-claims.** All five SUMMARYs state *built, drive owed*; `244-11`, `244-12` and
  `244-13` say explicitly that `SHELL-01`/`SHELL-03`/`SHELL-02` are **not** closed (D-244-14 /
  D-244-19). No fence asserts otherwise.
- **G-7 holds on capability.** Nothing in the round adds a user-facing capability. The one item
  that reads as new surface is a *re-ordering* (G-2), not a capability — see IN-03 for the record
  defect attached to it.

---

## Critical Issues

### CR-01: A successful reconcile never clears the error it just set — `244-11`'s banner is sticky, and once the transcript loads it asserts the sentence the plan was written to prevent

**File:** `frontend/src/providers/StreamsProvider.tsx:1955-1982` (the new write)
**Also:** `frontend/src/providers/StreamsProvider.tsx:3232-3238` (the ONLY clear, and it is in
`loadMessages`, not in `reconcile`), `frontend/src/components/chat/ChatArea.tsx:712-717` (the
sentence), `frontend/src/components/chat/ChatArea.tsx:174-186` (`handleRetryReconcile`)

**Issue:** the new arm says, verbatim, that it is *"The EXACT shipped write from the loadMessages
failure path (:3209-3215), reused rather than re-invented: two writers of one slice that differ is
how slices drift here."* The write was reused. **The other two halves of that writer were not:**

| the shipped `loadMessages` writer | the new `reconcile` arm |
|---|---|
| **silent single retry at 1s before the banner** (`:3243`, D-068.5-09 — "handles transient outage") | banner on the FIRST failure |
| **clears the entry on success** (`:3232-3238`) | no clear anywhere in `reconcile` |
| aborts matched two ways (`Error.name` AND a duck-typed `{name}`, `:3241-3242`) | `instanceof DOMException` only (WR-04) |

`reconcile` is the thread-open path — `loadMessages` is called only from `handleRetryReconcile`
(`ChatArea.tsx:184`), the `buffer_expired` arm (`:2305`) and the stream-terminal `finally`
(`:2341`). So on an ordinary thread open there is **no writer that can clear the entry**.

Concrete, and it is precisely the sequence UAT row L-1 setup already observed (*"first click
empty, second click fine"*):

1. Open thread A. `getSnapshot` 503s (measured 2 of 4). `reconcileErrors.set("A", err)`.
   Transcript empty → banner reads *"Couldn't load this conversation. It's still there — try
   again."* — correct, and the fix working.
2. Navigate to thread B, then back to A. `setViewingThread` → `reconcile("A")` → **200**. The
   bucket hydrates and all 78 messages render.
3. The banner is **still there**, because nothing deleted the key — and `messages.length` is now
   non-zero, so `ChatArea.tsx:715` flips it to
   *"Couldn't load latest messages. Showing cached version."* over a **freshly fetched**
   transcript. That is the exact false claim `244-11`'s own docblock calls *"a claim ABOUT THE
   SCREEN"* and was written to stop.

The banner persists for the life of the session on that thread unless the person notices the
Retry or × they have no reason to click, because the conversation in front of them is complete.

**Why no fence saw it:** `streamsProvider_244_snapshot_failure.test.tsx` Test 2 is the happy-path
control — and it starts from `reconcileErrors: new Map()` in `beforeEach`, so it can only observe
*"success writes no error"*, never *"success clears a prior error"*. This is the round's own
recorded lesson firing a third time: **a control that begins in the clean state cannot see a
missing transition out of the dirty one.**

**Fix:** restore the other half of the writer it copied — clear on success, inside `reconcile`,
immediately after the snapshot resolves:

```ts
snapshot = await getSnapshot(threadId)
// … then, before hydrating the bucket:
if (useStreamsStore.getState().reconcileErrors.has(threadId)) {
  useStreamsStore.setState((s) => {
    const next = new Map(s.reconcileErrors)
    next.delete(threadId)
    return { reconcileErrors: next }
  })
}
```

and add the missing case to the suite — **seed the error, then resolve the snapshot, and assert
the key is gone**:

```ts
it("Test 2b (THE MISSING TRANSITION) — a resolving snapshot CLEARS a prior failure", async () => {
  useStreamsStore.setState((s) => ({
    reconcileErrors: new Map(s.reconcileErrors).set(THREAD_ID, SNAPSHOT_503()),
  }))
  mockGetSnapshot.mockResolvedValue(EMPTY_SNAPSHOT)
  await act(async () => { await result.current.reconcile(THREAD_ID) })
  expect(useStreamsStore.getState().reconcileErrors.has(THREAD_ID)).toBe(false)
})
```

⚠ Separately, consider whether the **first** failure should raise the banner at all. The shipped
path retries once at 1s precisely because the observed failure mode here is transient (the second
click succeeded, twice). Raising on attempt 0 makes the banner more likely to be seen on a thread
that would have loaded a second later — which is a legitimate decision, but it is a DIFFERENT
decision from the one the comment claims to be making, and it is not recorded anywhere.

---

## Warnings

### WR-01: `244-13` fixed WR-07's direction and left the mirror — a harness cap-pause now shows "Start a new message to keep going" over a composer it has just disabled

**File:** `frontend/src/components/chat/MessageItem.tsx:790-798`
**Also:** `frontend/src/components/chat/ChatArea.tsx:167`,
`frontend/src/providers/StreamsProvider.tsx:1207-1215` (the writer that produces the state),
`frontend/src/providers/StreamsProvider.tsx:4643-4648`

**Issue:** the Continue card's gate was **not** moved onto the new discriminator:

```tsx
{message.role === "assistant" && isLastAssistant && workflowLock?.capPaused && ( … )}
```

Before this round, `workflowLocked = lock !== null && !lock.capPaused`, so the card and the
composer agreed: card visible ⇒ composer enabled. After `ChatArea.tsx:167` became
`lock.mode === "harness"`, the two decouple for exactly one state — `mode: "harness"` **and**
`capPaused: true`:

- composer: **disabled**, placeholder and `title` both *"Workflow running — Cancel to switch back"*
- transcript, on the last assistant row: *"Reached the Continue limit — this run is stopped.
  **Start a new message to keep going.**"* (`MessageItem.tsx:796`, the `continuesRemaining <= 0`
  arm)

That is the *"UI instructs an action it forbids"* inversion this phase exists to remove, moved
one component over rather than closed. It is the mirror of WR-07, not a residue of it.

**Reachability, stated honestly:** the state is produced by the product, not only by a fixture.
`onCapPaused` (write site 1) now **inherits** `"harness"` and sets `capPaused: true` on whatever
lock the thread holds, and `ThreadRunLineKickoff.test.tsx` **D5b(a)** drives exactly that through
the real `sendMessage` + the real SSE callback bundle. The producer side is
`agent_loop.persist_cap_paused` (`agent_loop.py:328-385`), reached from the shared loop at
`:2579-2603` — the same loop a harness phase runs. The RECONCILE route stays latent (no writer of
`workflow_runs.status = 'cap_paused'` was found, and `ChatArea.tsx:256` forces `capPaused: false`
on that branch anyway); the **SSE route is not latent**.

⚠ A second consumer carries the same shape: `useHarnessLiveForThread` returns `true` for
`mode === "harness"`, so a harness run parked at its iteration cap still renders
`data-run-line-state="live"` and a 1s `setInterval` clock (`ThreadRunLine.tsx:243-249`). That may
be defensible — a cap-paused harness run is non-terminal — but it is the same question G-1 asked
about the Deep case, and nobody asked it about this one.

**Fix:** make the card's copy read the discriminator the lock now carries, so the two surfaces
cannot disagree:

```tsx
{message.role === "assistant" && isLastAssistant && workflowLock?.capPaused && (
  …
  {continueExhausted || workflowLock.continuesRemaining <= 0
    ? workflowLock.mode === "harness"
      ? "Reached the Continue limit — this run is stopped. Cancel the workflow to start something new."
      : "Reached the Continue limit — this run is stopped. Start a new message to keep going."
    : "Reached the iteration limit — some tools haven't run yet."}
```

and add the case to `ChatArea.capPausedComposer.test.tsx` beside D5: with the harness cap-paused
lock, assert the composer is disabled **and** that the Deep sentence is absent — in one tree, the
way D6 already does for the Deep case.

### WR-02: Two mount-time writers of the same lock disagree about `capPaused`, and after this round that disagreement decides whether the Continue card renders during a live harness run

**File:** `frontend/src/providers/StreamsProvider.tsx:2365` (`capPaused: wf.cap_paused`) vs
`frontend/src/components/chat/ChatArea.tsx:256` (`capPaused: false`)

**Issue:** both fire on thread open, both call `getThreadWorkflow(threadId)`, both take the
`locked && !lock_is_stale && active_workflow_run_id` branch, and both write the same store key —
with **different** values for `capPaused`. `244-08` fixed the ChatArea site (its comment at
`:236-249` explains why `false` is the safe value); the mirrored site in the provider's reconcile
was left passing the server's flag through. Whichever resolves last wins, and neither is ordered
against the other.

While `workflowLocked` read `!capPaused` this was WR-07's bug surface. Now that `workflowLocked`
reads `mode`, the surviving consequence is WR-01's: whether a genuine live harness run shows the
Continue card at all depends on a promise race. The provider's own comment on this arm says the
mode is *"said EXPLICITLY rather than left to a default"* — the `capPaused` line one row below it
was not given the same treatment.

**Fix:** make the two writers identical. Either hoist the branch into one helper both sites call,
or apply `244-08`'s ruling at the second site too:

```ts
mode: "harness",
// ⛔ ALWAYS false on this branch — mirrored from ChatArea.tsx:256 (T-244-03-01 / 244-08).
capPaused: false,
```

and fence it with a source assertion that the two class-of-branch writes agree, in the style of
`workspaceAllowedExt.lockstep.test.ts`.

### WR-03: A transient per-file hydration failure is recorded as permanent for the whole session, and its note is emitted exactly once

**File:** `backend/app/services/tool_dispatcher.py:1938-1954` (`already.add(src_path)` at `:1941`,
before the `try` at `:1942`)

**Issue:** the deviation's justification is *"a permanently-broken file costs one attempt per
SESSION and not one per `execute_code` call; its failure is already named individually below, so
nothing is lost."* The first clause is true. **The second is only true of the call in which the
failure happened.** On every later call the path is filtered out at `:1899`
(`rows = [r for r in rows if … not in already]`), so no note is produced and the model receives
no signal at all.

The `except` at `:1946` catches **every** exception, not only permanent ones. The realistic
failure set on this path is dominated by transient causes: `_get_file_content` reaching Supabase
Storage, `get_file_by_path` on the pg pool, and `copy_to_runtime` against a Docker daemon. A
single Storage blip on the person's `.xlsx` therefore:

1. names the failure once, in the tool result of whichever `execute_code` call happened to race
   the blip;
2. marks the file copied for the remaining ~30 minutes of the cached session;
3. leaves `/sandbox/attachments/` permanently short that file, with no further note — the exact
   silence UAT L-5 defect 6b cost ten wasted agent rounds to discover.

The suite pins the failure note (`test_a_hydration_failure_is_named_and_does_not_abort_the_run`)
but **no case drives a second `execute_code` after a failure**, which is the only place the
deviation's claim can be checked. The strongest new claim in the plan is the one with no fence.

**Fix:** separate *claimed* from *succeeded*, and keep the DoS bound by capping retries rather
than by never retrying:

```python
for row in rows:
    src_path = row.get("path") or ""
    dest = _attachment_container_path(src_path)
    try:
        …
        await run_in_threadpool(_copy_in, content, dest)
        already.add(src_path)                     # ← on SUCCESS
    except Exception as e:
        failed[src_path] = failed.get(src_path, 0) + 1
        if failed[src_path] >= _ATTACHMENT_HYDRATION_MAX_RETRIES:   # e.g. 2
            already.add(src_path)                 # give up, once, deliberately
        logger.warning(…)
        notes.append(…)                           # named on EVERY attempt, not once
```

and add case F: *"a file that fails once is retried on the next call and NAMED again; a file that
fails twice is given up on and named a final time."*

⚠ Related, and worth naming so it is not rediscovered: `already` counts **failed** paths against
the 50-file session budget at `:1910`, so a run whose Storage is flaky can exhaust the copy budget
without a single file arriving. The truncation note it then emits (*"Only the first 50 of N …"*)
is false in that state.

### WR-04: The `AbortError` arm in `reconcile` is unreachable, its stated justification is factually wrong, and it is narrower than the shipped guard it claims to mirror

**File:** `frontend/src/providers/StreamsProvider.tsx:1967`

**Issue:** three separate problems in one line.

1. **Unreachable.** `getSnapshot(threadId, signal?)` (`lib/api/threads.ts:1063-1071`) takes an
   *optional* signal — and the call at `:1950` passes **none**. Nothing can abort this fetch, so
   the branch cannot fire.
2. **The justification is false.** The comment reads: *"`reconcile` is fired from
   `setViewingThread` on EVERY thread switch; without this arm each switch that cancels an
   in-flight snapshot would raise a banner on the thread the person actually wanted."* No switch
   cancels this snapshot; the in-flight protection here is `reconcileInFlightRef` (`:1942`), which
   **drops** the second reconcile rather than aborting the first. A comment that names a mechanism
   the code does not have is the class of defect this phase has already paid for twice.
3. **Narrower than the writer it copied.** The shipped `loadMessages` guard tests *both*
   `err instanceof Error && err.name === "AbortError"` **and** a duck-typed `{ name }`
   (`:3241-3242`), and `usePanelReconcile.ts:86-95` does the same — precisely because the shape
   differs between jsdom, undici and the browser. This arm tests `instanceof DOMException` only.
   If a signal is ever threaded through (the parameter is already there, inviting it), a non-
   `DOMException` abort will paint the banner CR-01 makes permanent.

`streamsProvider_244_snapshot_failure.test.tsx` **Test 3** is a control over a branch the product
cannot reach, and it passes because the fixture constructs a `DOMException` by hand — the same
"the test constructs the shape it then asserts" pattern the file's own header warns about, one
case below the warning.

**Fix:** either thread the signal through and make the guard real, or delete the branch and the
paragraph together. If it is kept, widen it to the shipped shape:

```ts
if (err instanceof Error && err.name === "AbortError") return
if (err && typeof err === "object" && "name" in err &&
    (err as { name: string }).name === "AbortError") return
```

### WR-05: `NavPanel.tsx`'s comment claims neither class token is spelled verbatim — one of them is, and it is the one whose count the SUMMARY does not report

**File:** `frontend/src/components/layout/NavPanel.tsx:215` (the literal) vs `:227-229` (the claim)
**Also:** `.planning/phases/244-the-chat-shell-and-the-composer/244-09-SUMMARY.md:104-105`
(the acceptance table), `:257-271` (deviation 1)

**Issue:** the trailing note says:

> *"The two class tokens are deliberately NOT spelled out verbatim in this comment: `244-09`'s
> acceptance counts their occurrences in this file with `grep -c`, and a comment mention would
> inflate that count and blind the check to a real second application."*

But `:215` reads ``⭐ `min-h-0` BESIDE IT IS DEFENSIVE, not the fix``. Measured:

```
grep -c "overflow-y-auto" NavPanel.tsx  →  1   ✅ as claimed
grep -c "min-h-0"         NavPanel.tsx  →  2   ⛔ inflated by the comment
```

The SUMMARY's acceptance table publishes `overflow-y-auto` (1) and `mt-auto` (1) and **omits
`min-h-0`** — i.e. the one token whose count the edit broke is the one not reported, so the table
reads clean. Deviation 1 was raised for exactly this conflict and the fix was applied to one of
the two tokens.

The consequence is small (a second real application of `min-h-0` in this file would read 3, not
2) but it is the 187-24 vacuity class reproduced *inside the comment that cites 187-24*, and the
next reader running the documented grep gets a number the documentation does not explain.

**Fix:** name the defensive token by CSS declaration the way the load-bearing one already is —
e.g. *"the automatic-minimum-size override beside it is defensive"* — and add the third row to
the SUMMARY's acceptance table so the count is published rather than inferred.

---

## Info

### IN-01: `overflow-y-auto` on the rail root also turns `overflow-x` into `auto`

**File:** `frontend/src/components/layout/NavPanel.tsx:231`

Per CSS overflow, when one axis is not `visible` the other computes to `auto`. The rail is a
width-animating column (`motion-safe:transition-[width]`, `w-[58px]` ⇄ `w-[210px]`) whose children
switch to their expanded layout on the same tick the width starts animating — so during the
~300 ms expand the content is laid out for 210 px inside a box that is still 58 px wide, and the
rail can flash a horizontal scrollbar or become horizontally scrollable. (Tooltips and the
`AttentionPopover` are safe: Radix Popper positions them `fixed`, and nothing in the rail's
ancestor chain establishes a containing block for fixed descendants.)

**Fix:** `overflow-y-auto overflow-x-hidden` → computed `overflow: hidden auto`, which is
well-defined and cannot clip the collapsed badge (measured: the `-right-1` badge ends 5 px inside
the 58 px box).

### IN-02: The repaired `?raw` fence still cannot tell code from a comment — it only moved which file is at risk

**File:** `frontend/src/components/chat/__tests__/MessageItem.inlineApproval.test.tsx:597-603`

`244-12` caught its own fence passing for the wrong reason (a prose mention of `<PendingAskStack`
in `MessageItem.tsx` held the count at 1 after the mount left) and repaired it by asserting **0**
in `MessageItem.tsx` and **1** in `MessageList.tsx`. The zero-assertion is now immune. The
one-assertion is not: a future comment in `MessageList.tsx` that carries the opening bracket keeps
the count at 1 with the mount deleted, which is the identical failure one file over.
`ChatLayout.scrollFrame.test.tsx` already ships the remedy (`stripComments` before counting).

**Fix:** apply the same `stripComments` normaliser before `matchAll` on both sides.

### IN-03: The G-2 re-order shipped INSIDE the closure round while the UAT record says it was taken outside it, and no row covers it

**File:** `.planning/phases/244-the-chat-shell-and-the-composer/244-UAT.md:759-762`
**Commit:** `5953ef1de feat(244-12): G-2 — the thinking badge below the tools, as an OPERATOR OVERRIDE`

The round-2 table states *"`G-2` HAS NO ROW IN THIS TABLE AND THAT IS DELIBERATE … it was taken
outside the closure round."* The **decision** was taken outside; the **change** was not — it is a
`244-12` commit that re-orders `MessageItem.tsx:527-533` and re-drives two fences. The result is
that the round's only user-visible visual change is the one item with no UAT row, in a round whose
whole premise is *built, drive owed*.

It is **not** a G-7 violation (a re-order is not a new capability), and the source fences were
driven RED against the old order in both files. But *"no row"* and *"outside the round"* are
different claims and only the first is true.

**Fix:** correct the sentence to *"the decision was taken outside the round; the edit shipped in
`244-12` and owes a visual row"*, and add a one-line R2-6 row so the operator's own override is
confirmed on screen.

### IN-04: `ChatArea.capPausedComposer.test.tsx` D5 seeds after awaiting the reconcile, and a late settle can overwrite the seed

**File:** `frontend/src/components/chat/__tests__/ChatArea.capPausedComposer.test.tsx:365-380`

The case waits for the lock to land, then calls `seedHarnessCapPausedLock()` to flip `capPaused`
to `true`. `ChatArea`'s workflow effect re-runs on `[thread?.id, streamActions]` and its `.then`
writes `capPaused: false` — so a second settle after the seed silently restores the state the case
is NOT about, and the following `waitFor` would then pass on its first tick only by luck of
ordering. The docblock explains why the seed exists (the branch cannot produce this state); it does
not guard against the branch racing it.

**Fix:** assert the post-seed value once with `expect(...)` rather than `waitFor(...)` so a
regression cannot be papered over by a retry, or make `getThreadWorkflow` resolve exactly once
(`mockResolvedValueOnce` + a rejecting default).

### IN-05: The truncation note is re-emitted on every subsequent `execute_code` call once the budget is exhausted

**File:** `backend/app/services/tool_dispatcher.py:1908-1918`

Once `len(already) >= _ATTACHMENT_HYDRATION_MAX_FILES`, every later call re-lists, re-computes
`len(already) + len(rows) > MAX`, appends *"Only the first 50 of N workspace files were copied…"*
and returns. The note is correct and NAMED (which is the discipline), but a run calling
`execute_code` eight times pushes the same sentence into eight tool results. Harmless today at a
50-file cap; worth a `if not already_noted_this_session` marker if the note ever grows.

---

## Which of the five gap fixes I verified, and which I could not

| plan | gap | verified statically? | what I could NOT verify |
|---|---|---|---|
| **244-09** | G-5 (rail overflows below ~540 px) | ✅ **Yes, as far as source goes.** The rail root now carries `min-h-0 overflow-y-auto`; it is the one element the UAT measured to escape; the `mt-auto` footer is untouched, and `margin-top: auto` correctly resolves to 0 once the content overflows, so the fix cannot make the footer unreachable. No `min-height` was added to any ancestor (the named anti-fix). | **The pixels.** jsdom performs no layout; link 6 is a presence assertion and says so. `244-09-UAT-ROW.md` is unfilled. IN-01 is the one behaviour change I can name without a browser. |
| **244-10** | L-5 defect 6b (2nd attachment never hydrates) | ✅ **Cause addressed.** `WeakSet[session]` → `WeakKeyDictionary[session, set[path]]`, consulted per call, filter applied to the gated listing's output (no second expiry rule), cap is a session total, traversal fence byte-unchanged, in-place mutation safe for the single caller. | **That a byte lands in a real container** — every case drives a `MagicMock`. And **WR-03**: a failed copy DOES poison the record, which is the one thing the deviation asserts it does not cost. |
| **244-11** | G-3 (a snapshot 503 reaches nothing) | ⚠ **Partially.** The write lands in the right slice with the right key; the copy is content-asserted rather than testid-asserted; the empty/non-empty sentences are both fenced and the shipped one is byte-unchanged. | **The pair is incomplete — CR-01.** The clear-on-success and the silent retry were not carried across, and the abort guard (**WR-04**) is unreachable with a false justification. Nothing here rules on G-4. |
| **244-12** | G-6 (workflow approval unreachable in chat) | ✅ **Yes, to the limit of source.** The mount is list-level, unconditional, zero-prop, returns `null` with no pause; the per-row mount is gone; the panel's mount is a separate column gated on `pendingAsks.length > 0`; cost is constant in row count and in pause existence; W1 seeds through the product's own fetcher and carries no ask-bearing message. | **That the harness carrier actually populates `pendingAsksByThread`.** No source path proves it; the strongest evidence is UAT L-4, which observed the panel rendering all three controls off that same slice. R2-4 is the row that settles it. Also unverified: the `sticky top-0` card's placement at the bottom of a long transcript. |
| **244-13** | G-1 + WR-07 (lock says what it IS) | ✅ **The widening itself is correct.** All six write sites read the server's `ThreadWorkflowState.mode` or are harness by construction; site 1's inheritance is the only inference and it is reasoned and driven (D5b). `useHarnessLiveForThread` and `MessageItem:862` are mode-gated; `StreamsProvider:4368` correctly still reads the **wire** type; `PendingAskStack`'s `runIsOver` still reads presence but is harmless (a Deep thread has no phases). No path treats a `cap_paused` lock as harness. | **WR-01** — the reverse direction is open at `MessageItem.tsx:792`, and **WR-02** — the two mount-time writers still disagree on `capPaused`. And the browser: `244-13-UAT-ROW.md` is unfilled. |

## Security

No new issues. `tool_dispatcher.py` is the only backend file in the diff.

- `_attachment_container_path` is **absent from the diff** — the traversal fence (`\`→`/`
  normalise → `basename` → charset narrow → `lstrip(".")` → 120-char cap → non-empty fallback) is
  byte-unchanged, as the SUMMARY claims.
- The per-file record keys on `row["path"]` (the workspace path), never on the derived container
  destination, so it cannot be used to smuggle a path past the sanitiser or to make one row's
  record satisfy another row's copy.
- The slice bound is `max(MAX - len(already), 0)`, so the cap cannot become a negative index.
- The `WeakKeyDictionary` is keyed by the sandbox session, which is keyed by `thread_id`, so a
  record cannot cross a thread or a tenant. A worker bounce produces a new session object and a
  fresh (empty) record — over-copying, never under-.
- ⚠ Not a vulnerability but worth recording once: in the multi-worker default (`WORKER_COUNT=2`)
  each worker builds its own session object **re-attached to the same container**, so the record
  is per-process and the same file can be copied once per worker. Pre-existing (the `WeakSet` had
  the identical property) and bounded by worker count.

---

_Reviewed: 2026-09-12_
_Reviewer: Claude (gsd-code-reviewer) — solo run, no independent second reviewer (OV-SOLO-01)_
_Depth: standard · diff `8cd9d8119..b11e99c8e`_
