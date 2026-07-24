# Phase 174 — Deferred Items (out-of-scope discoveries)

Discoveries logged during execution that are OUT OF SCOPE for the current plan
(per the executor scope boundary — only auto-fix issues directly caused by the
current task's changes). Do NOT fix here; route to the owning plan/phase.

## From Plan 03 (STATE-01b) execution — 2026-07-22

- **`MessageItem.test.tsx:106` — `getByText(/thinking/i)` fails (pre-existing SEED-056 rot).**
  - **What:** The streaming-state test "shows thinking indicator when streaming with empty
    content" asserts the pre-answer label matches `/thinking/i`, but the label renders
    "Setting up agent…" (the `outerBannerLabel` `!hasAnyTools && !isPlanning` default —
    now the STATE-03 call site at `MessageItem.tsx:625`).
  - **Confirmed pre-existing, NOT caused by Plan 03:** Plan 03's `MessageItem.tsx` diff is
    purely the additive `blockedNotice` block (behind a falsy guard for this test's message)
    + the `Ban` import — it does not touch the thinking/pre-answer branch. The test file was
    not edited by Plan 03. The thinking-branch render is byte-identical at the phase-start
    baseline (`5888ab46`), so this failure is identical before and after Plan 03.
  - **Owner:** the STATE-03 pre-answer-label work (already shipped an earlier 174 plan) — the
    stale test should be updated to assert the shipped copy ("Setting up agent…" / "Reasoning…"),
    or is part of the documented SEED-056 vitest rot baseline. Differential-only per the plan's
    verification note ("do not chase pre-existing failures").
