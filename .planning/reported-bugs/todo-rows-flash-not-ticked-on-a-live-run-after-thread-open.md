---
id: BUG-260915-01
title: Todo rows read "Not ticked" on a LIVE run after a plain thread open
reported: 2026-09-15
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [frontend/streaming, frontend/panel]
folded_into: 252
verified_closed_by: null
related_seeds: [SEED-105]
re_open_trigger: null
corrected: 2026-09-16 — the stated MECHANISM was measurably false and is struck through below, not deleted. Source of the correction: the v4.2 milestone audit's Flow C, re-driven at `53e2435b7` and recorded in `.planning/phases/252-close-the-v42-audit-gaps/252-RESEARCH.md` §5.1 (decision `D-20` in `252-CONTEXT.md`). ⛔ The audit document itself is untracked and is NOT cited here — a citation must point at a file that exists (the W-8 lesson from this same phase). Fix candidate #1 was ALREADY IMPLEMENTED when this report was written; building it ships a no-op.
reproduces_on:
  branch: develop
  commit: d57816c65
  date: 2026-09-15
---

# BUG-260915-01: Todo rows read "Not ticked" on a LIVE run after a plain thread open

## What we observed

**Driven against the real store**, not reasoned about —
`frontend/src/__tests__/providers/streamsProvider_250_liveness_window.test.tsx`, which passes:

| Step | `streamingThreads ∪ loadingThreads` |
|---|---|
| during `loadMessages` fetch | **true** (loading is set) |
| after `loadMessages` resolves | ⛔ **false** |
| after `reconcile()` runs | **true** |

The thread has a live run throughout (`snapshot.active_runs` carries
`status: "streaming"`). Between the second and third rows there is a window in which the
app believes nothing is running on a thread where something is.

## Why it matters

Phase 250's `HONEST-03` made the panel's status text depend on exactly that belief:
`deriveTodoDisplayStatus(status, isRunLive)` renders `Not ticked` when `isRunLive` is
false. So inside this window **every open todo on a live run reads `Not ticked`** — the
mirror image of the stuck-spinner defect the phase was built to remove, and the exact
failure `TodosSection.tsx`'s own comment names as the thing it must not do.

⚠ The window is not a race measured in milliseconds. ~~`reconcile()` is listener-driven —
`visibilitychange`, `focus`, `pageshow` — and **opening a thread triggers none of them**.
`ChatArea` calls `loadMessages` only.~~ **REFUTED 2026-09-16 — see the Mechanism section; the
strikethrough is kept because the prediction being wrong IS the finding.** The false state does
persist until the user navigates away and back, but not for that reason.

## Mechanism

### ⛔ CORRECTED 2026-09-16 (Phase 252, plan `252-04`). The original is struck through, never deleted.

~~The two sets are written by paths that never meet:~~

- ~~`loadingThreads` — added at the top of `loadMessages`, removed in its `finally`.~~
- ~~`streamingThreads` — added by the reconcile-derive, the send path, and the SSE reattach.
  **None of those is `loadMessages`.**~~

~~`TodosSection.tsx` OR-s the two selectors and states as fact that this closes the window.
It does not. That comment is now corrected in place to say what was measured.~~

That description is not *wrong* about the two sets — it is wrong about the **trigger**, and the
trigger is the whole reason the report recommended the fix it recommended. Measured at
`53e2435b7`, every line quoted and verified:

1. ⛔ **Opening a thread DOES fire `reconcile`.** `StreamsProvider.tsx:1936-1942`:
   ```js
   if (threadId !== null) {
     useStreamsStore
       .getState()
       .actions.reconcile(threadId)
   ```
   and `ChatArea.tsx:323-325` calls `setViewingThread` from a `useLayoutEffect` keyed on
   `[thread?.id]`:
   ```js
   useLayoutEffect(() => {
     setViewingThread(thread?.id ?? null)
   }, [thread?.id])
   ```
   **So fix candidate #1 below is ALREADY IMPLEMENTED. A fixer who follows this report as
   originally written ships a no-op.**

2. **The real hole is that `reconcile` sets no liveness signal of its own, so the `||` buys
   nothing for the duration of its round-trip.** `loadMessages` is the **only** writer of
   `loadingThreads` — added at `StreamsProvider.tsx:3277`
   (`loadingThreads: new Set(s.loadingThreads).add(threadId),`) and cleared at `:3386-3391`.
   Thread open runs `reconcile`, which calls `getSnapshot` and touches **neither** set until the
   snapshot comes back. So `isStreaming || isLoading` is false for the **whole `/snapshot`
   round-trip** → `Not ticked` on **every** thread open, not merely on some.

3. **And the persistence has a different cause than the one claimed.** `reconcileInFlightRef` is
   a **single global boolean**, not keyed by thread — declared at `StreamsProvider.tsx:1503`
   (`const reconcileInFlightRef = useRef(false)`), read at `:1975`
   (`if (reconcileInFlightRef.current) return`) and cleared at `:2506`
   (`reconcileInFlightRef.current = false`). A reconcile in flight on thread A therefore **drops**
   the reconcile for thread B entirely, and B keeps the false state until the user navigates away
   and back. ⭐ The code already knew: `:2028` says verbatim *"would hold `reconcileInFlightRef` —
   a GLOBAL flag, not a per-thread one … Make the in-flight guard per-thread first if a retry is
   ever wanted here."*

⭐ **The method matters more than the correction.** This report was written from the **symptom**
and reasoned backwards to a mechanism; the mechanism itself was never driven. *A review is a claim
about code, not the code* — the four line references above were each opened and read before this
paragraph was written.

⚠ **Why no test caught it:** `TodosSection.test.tsx` replaces both selectors with
`vi.fn()`, so it pins the MOCK's ordering, never the provider's. This is the same shape as
the hook-order defect in the same file — a unit test whose mocks make the real invariant
structurally invisible.

## Prior art in this repo

This is the **missing-trigger** class, third occurrence. `StreamsProvider.tsx`'s own
docblock records the 2026-08-16 one verbatim: *"Both ends of the wire were already correct
… What was missing is that **nothing re-read it**."* The discriminating prediction there —
*"navigating away and back will show the panel correcting itself"* — applies unchanged here.

## Not fixed in the review round, deliberately

The fix is a trigger change in `StreamsProvider.tsx` — **102 commits / 37 phases, a
G-5-FIRING hot file**. Adding a reconcile on thread-switch changes live chat state for
every surface that reads these sets, which is a phase, not a code-review closure (G-7: a
closure round may never introduce new capability). Candidate approaches, for whoever takes it:

1. ⛔ **ALREADY IMPLEMENTED — DO NOT BUILD THIS.** ~~**Reconcile on thread-switch** — the missing
   trigger. Also heals the phantom-Stop class generally, and matches the 2026-08-16 precedent's
   fix.~~ `StreamsProvider.tsx:1936-1942` already fires `actions.reconcile(threadId)` from
   `setViewingThread`, which `ChatArea.tsx:323-325` calls on every thread change. **Building this
   ships a no-op.**
2. **Derive liveness from the thread's own run row** rather than from two transient sets —
   removes the ordering dependency instead of sequencing it. ⭐ **This one is correct**, and the
   variant taken in Phase 252 (`252-04`) also closes the global-drop of #3: a new per-thread
   `reconcilingThreads` slice marks the thread live for the duration of reconcile's own
   round-trip, and `reconcileInFlightRef` becomes per-thread so a switch can no longer drop a
   reconcile.

⛔ Until then the characterization test above is the record, and it is written to FAIL if
the window closes — so whoever fixes it is told by the suite, rather than leaving a stale
test asserting a defect.
