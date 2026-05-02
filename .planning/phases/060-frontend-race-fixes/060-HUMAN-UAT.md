---
status: resolved
phase: 060-frontend-race-fixes
source: [060-VERIFICATION.md]
started: 2026-05-02T00:00:00Z
updated: 2026-05-02T07:30:00Z
---

## Current Test

[complete]

## Tests

### 1. SC#4 — Thread A → Thread B race fix (Playwright e2e)
expected: Running `cd e2e && TEST_USER_EMAIL=<email> TEST_USER_PASSWORD=<password> npx playwright test 060-thread-race.spec.ts --reporter=line` exits 0. The test starts a stream on Thread A, navigates to Thread B mid-stream, and asserts: (a) Thread B view contains no leak from Thread A, (b) the failed/aborted requests list contains the in-flight Thread A `getMessages` URL, (c) Thread B's assistant messages render cleanly with no raw tool-result JSON.
result: skipped — environment missing Playwright Chromium binary on test runner; covered by manual backstop in test #2 below. To run later: `npx playwright install chromium` then re-run.

### 2. SC#4 — Manual two-tab DevTools backstop (per 060-VERIFICATION.md)
expected: With dev server running, open Tab A streaming a long response on Thread A, then click Thread B. DevTools Network tab shows Thread A's `GET /threads/A/messages` flipped to `(canceled)`. Thread B's view loads only Thread B messages. No raw `{ "tool_call_id": ... }` JSON appears in Thread B's chat content.
result: passed — user verified 2026-05-02. Network tab showed `messages (canceled) fetch api.ts:50 0.0 kB 5.02 s` (the in-flight Thread A `getMessages` aborted exactly at the `fetch(url, { headers, signal })` call site). Thread B loaded cleanly with its own messages, no leak from A, no raw JSON regression. The "Thread A stream does not resume on return" observation is expected at this milestone and is Phase 061's deliverable (Resume button + visibilitychange/pageshow recovery per D-v2.5-05).

## Summary

total: 2
passed: 1
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps
