---
id: BUG-260915-01
title: Todo rows read "Not ticked" on a LIVE run after a plain thread open
reported: 2026-09-15
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/streaming, frontend/panel]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-105]
re_open_trigger: null
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

⚠ The window is not a race measured in milliseconds. `reconcile()` is listener-driven —
`visibilitychange`, `focus`, `pageshow` — and **opening a thread triggers none of them**.
`ChatArea` calls `loadMessages` only. So the false state persists until the user tabs away
and back.

## Mechanism

The two sets are written by paths that never meet:

- `loadingThreads` — added at the top of `loadMessages`, removed in its `finally`.
- `streamingThreads` — added by the reconcile-derive, the send path, and the SSE reattach.
  **None of those is `loadMessages`.**

`TodosSection.tsx` OR-s the two selectors and states as fact that this closes the window.
It does not. That comment is now corrected in place to say what was measured.

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

1. **Reconcile on thread-switch** — the missing trigger. Also heals the phantom-Stop class
   generally, and matches the 2026-08-16 precedent's fix.
2. **Derive liveness from the thread's own run row** rather than from two transient sets —
   removes the ordering dependency instead of sequencing it.

⛔ Until then the characterization test above is the record, and it is written to FAIL if
the window closes — so whoever fixes it is told by the suite, rather than leaving a stale
test asserting a defect.
