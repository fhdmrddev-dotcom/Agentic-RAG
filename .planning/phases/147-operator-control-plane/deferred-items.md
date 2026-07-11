# Phase 147 — Deferred Items (out-of-scope discoveries)

Items found during execution that are OUT OF SCOPE for the current task's
changes. Logged, not fixed (executor scope boundary).

## From Plan 147-06 (Task 2)

- **Pre-existing test rot (SEED-056):** `frontend/src/__tests__/components/MessageItem.test.tsx`
  → `MessageItem – streaming state > shows thinking indicator when streaming with empty content`
  fails at BASELINE (verified by stashing this plan's `MessageItem.tsx` edit and
  re-running — the failure reproduces on untouched source). The assertion
  `getByText(/thinking/i)` no longer matches the `outerBannerLabel(...)` copy for a
  streaming empty-content assistant message (the thinking indicator DOM still
  renders; only the literal word "thinking" is gone). Unrelated to the 147-06
  cancelled-honesty edits — those are in a separate new test file
  (`src/components/chat/__tests__/MessageItem.test.tsx`, 3/3 green). Not fixed per
  the plan's acceptance note ("pre-existing SEED-056 rot in unrelated tests is not
  this plan's concern").
