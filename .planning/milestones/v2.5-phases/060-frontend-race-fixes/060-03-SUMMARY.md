---
phase: 060-frontend-race-fixes
plan: 03
subsystem: testing
tags: [playwright, e2e, sse, abortcontroller, race-conditions, verification]

requires:
  - phase: 060-01-frontend-race-fixes
    provides: setViewingThread + loadAbortRef + post-await guard in useMessages.ts
  - phase: 060-02-frontend-race-fixes
    provides: getMessages(threadId, signal?) + ChatArea useEffect rewired with setViewingThread first
  - phase: 058-backend-sse-concurrency-fix
    provides: cross-tab GET /threads/{id}/messages unblocked during SSE stream (CONCUR-01)
  - phase: 059-sse-architecture-refactor
    provides: AbortController.abort() reliably tears down backend SSE (CONCUR-02)

provides:
  - Automated Playwright e2e regression guard for the Thread A->B navigation race (STREAM-02a)
  - Manual two-tab DevTools verification runbook (D-060-13, non-gating backstop)
  - 060-VERIFICATION.md scaffold mirroring the 058/059 format for the post-merge verifier

affects:
  - 062-validation-harness  # the seed scenario this test exercises will be folded into Phase 062's reusable harness
  - 061-reconnect-handlers  # 061's polling/visibilitychange work must not regress this test

tech-stack:
  added: []  # No new libraries; reuses @playwright/test ^1.49.0 already in e2e/package.json
  patterns:
    - "Playwright request listeners (page.on('request'|'requestfailed'|'requestfinished')) for capturing AbortController-driven fetch cancellations"
    - "Test-level race scenario: long-running prompt + 4s wait + mid-stream navigation + body-text leak guard + tool_call_id regression guard"

key-files:
  created:
    - e2e/tests/060-thread-race.spec.ts
    - .planning/phases/060-frontend-race-fixes/060-VERIFICATION.md
  modified: []

key-decisions:
  - "Test path moved from CONTEXT.md's tests/browser/060-thread-race.test.ts to e2e/tests/060-thread-race.spec.ts (planner deviation per 060-PATTERNS.md): tests/browser/ does not exist; the existing Playwright harness at e2e/tests/*.spec.ts already provides playwright.config.ts, signIn(page) helper, and TEST_USER_EMAIL/TEST_USER_PASSWORD env contract. Reusing it avoids orphaning the test."
  - "File extension is .spec.ts (not .test.ts) to match repo convention (auth.spec.ts, threads.spec.ts) so playwright test discovers it without config changes."
  - "Test title relaxed from 'Thread A->B navigation: ...' to 'Thread A to Thread B navigation: ...' so the plan's grep regex `test\\(\".*Thread A.*Thread B` matches as required by acceptance criteria."

patterns-established:
  - "Playwright request-listener pattern for AbortController evidence: page.on('requestfailed', req => req.failure()?.errorText) captures abort/cancel reasons that the chrome-MCP framing requires."
  - "Race-scenario template (long prompt + waitForTimeout + mid-stream nav + body-text leak guard + JSON-shape regression guard) reusable for Phase 062's harness."

requirements-completed: [STREAM-02a]

duration: 6min
completed: 2026-05-02
---

# Phase 060 Plan 03: Browser MCP Verification + Manual Backstop Summary

**Playwright e2e test (`e2e/tests/060-thread-race.spec.ts`) and manual two-tab DevTools runbook (`060-VERIFICATION.md`) install the binding regression guard for the Thread A->B navigation race (STREAM-02a / Phase 060 SC#4) — the feedback loop the v2.5-dev attempt was missing.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-02T06:21:26Z
- **Completed:** 2026-05-02T06:27:35Z
- **Tasks:** 2 of 3 fully completed; Task 3 is a checkpoint:human-verify gate that requires post-merge live-backend execution (handed back to orchestrator/verifier)
- **Files created:** 2
- **Files modified:** 0

## Accomplishments

- New Playwright e2e test at `e2e/tests/060-thread-race.spec.ts` exercises the Thread A -> Thread B navigation race scenario from D-060-12 (full ROADMAP Phase 060 SC#4 binding evidence path). Asserts (a) no Thread A marker leaks into Thread B's view, (b) Thread A's getMessages was aborted (or no orphaned in-flight requests remain), (c) no raw tool-result JSON regression (Bug 3 guard).
- Test reads credentials exclusively from `process.env.TEST_USER_EMAIL` / `process.env.TEST_USER_PASSWORD` and uses `test.skip()` mirror of `e2e/tests/threads.spec.ts` for clean CI behavior without secrets.
- New `.planning/phases/060-frontend-race-fixes/060-VERIFICATION.md` scaffold matches the 058/059 format with full Goal Achievement table (4 truths reproducing ROADMAP Phase 060 SC#1-4 verbatim), Required Artifacts, Key Link Verification, Behavioral Spot-Checks, Requirements Coverage (STREAM-02a), and a complete Manual Two-Tab DevTools Checklist appendix (D-060-13).
- Playwright `--list` confirmed test discovery against the main repo's `e2e/node_modules/@playwright/test ^1.49.0` (worktree has no node_modules of its own; verified via cross-tree copy).

## Task Commits

1. **Task 1: Create Playwright e2e test `e2e/tests/060-thread-race.spec.ts`** - `bb32e1d` (test)
2. **Task 2: Create `060-VERIFICATION.md` scaffold (manual two-tab DevTools backstop)** - `6b15098` (docs)
3. **Task 3: Human-verify the e2e test against live dev backend** - PENDING (checkpoint:human-verify; gates plan completion but requires Plans 060-01/02/03 to be merged first since this worktree has only 060-03's changes)

## Files Created/Modified

- `e2e/tests/060-thread-race.spec.ts` (CREATED, 156 lines) - Playwright e2e test exercising the Thread A->B navigation race with three race-fix invariant assertions.
- `.planning/phases/060-frontend-race-fixes/060-VERIFICATION.md` (CREATED, 152 lines) - Verification scaffold + manual two-tab DevTools checklist appendix. PENDING markers for the verifier to fill post-merge.

## Decisions Made

- Followed the 060-PATTERNS.md planner override: test path is `e2e/tests/060-thread-race.spec.ts` (not the CONTEXT.md `tests/browser/060-thread-race.test.ts`), reusing the existing Playwright harness. Rationale lives in `060-03-PLAN.md` frontmatter `deviations` and 060-PATTERNS.md "Browser-test precedent decision".
- File extension `.spec.ts` (not `.test.ts`) to match all 4 existing e2e specs and Playwright's auto-discovery convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test title relaxed to satisfy plan's grep regex**
- **Found during:** Task 1 (verification of acceptance criteria after creating the test file)
- **Issue:** The plan prescribed the test title `"Thread A->B navigation: B shows only B's messages; A's getMessages is aborted; no raw tool-result JSON leaks"` verbatim, but the same plan's acceptance criterion requires `grep -cE 'test\("?.*Thread A.*Thread B'` to return >= 1. The prescribed title contains "A->B" / "Thread B's" but never the literal sequence "Thread A...Thread B" needed by the regex.
- **Fix:** Renamed the test to `"Thread A to Thread B navigation: B shows only B's messages; A's getMessages is aborted; no raw tool-result JSON leaks"`. Behavior, assertions, and meaning are unchanged — only the title prose now spells out "Thread A to Thread B" so the grep matches.
- **Files modified:** `e2e/tests/060-thread-race.spec.ts`
- **Verification:** `grep -cE 'test\(\".*Thread A.*Thread B' e2e/tests/060-thread-race.spec.ts` returns `1`. Playwright `--list` (run against the main repo's e2e harness) shows the renamed title cleanly.
- **Committed in:** `bb32e1d` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** No scope creep; the rename harmonizes a self-contradiction between the plan's prescribed test title and its own acceptance-criterion regex. All other prescribed text in the test is verbatim.

## Issues Encountered

- **Worktree e2e/node_modules absent:** This parallel-executor worktree was created without `e2e/node_modules`; the original repo at `C:/Vibe Apps/Agentic RAG/e2e/node_modules` has `@playwright/test ^1.49.0` installed. To verify the test compiles and Playwright discovers it, the test file was temporarily copied into the main repo's `e2e/tests/`, `npx playwright test --list tests/060-thread-race.spec.ts` confirmed clean discovery of the test, and the copy was then removed. No artifact change in the main repo. Acceptance-criterion `cd e2e && npx tsc --noEmit ...` is ambient on Playwright's bundled TS loader (no standalone tsc is installed in this project; existing specs run through Playwright's transpiler the same way).

## User Setup Required

None — the test reuses the project's existing `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` env-var contract and Playwright config. No new env vars, no new dependencies.

## Checkpoint Status

**Task 3 (`checkpoint:human-verify`) is PENDING and CANNOT be executed inside this worktree.** The plan documents:

> Reply with `passed` after the Playwright test completes green AND the VERIFICATION.md has been updated.

Why pending in this worktree:

- This worktree contains ONLY Plan 060-03's changes (the test file and the verification scaffold). The race fixes that the test verifies (`setViewingThread`, `loadAbortRef`, post-await guard, finally-block-reload removal) live in Plans 060-01 and 060-02 — currently being executed in parallel worktrees by the wave orchestrator.
- Running the Playwright test here would either spuriously pass (because Thread A's getMessages may complete naturally in <4s) or spuriously fail (because the un-fixed code's data-leak path is still active). Neither outcome is the binding evidence the checkpoint requires.
- The orchestrator merges Wave 3's worktrees together; the live-backend Playwright run belongs to the post-merge verifier (a fresh agent run with all three plans' code in place).

**Recommended continuation (for the wave orchestrator / verifier):**

1. After Plans 060-01, 060-02, and 060-03 are merged, ensure dev servers are running (frontend `:5173`, backend `:8000`).
2. Set credentials: `$env:TEST_USER_EMAIL = "<dev-test-email>"; $env:TEST_USER_PASSWORD = "<dev-test-password>"` (PowerShell) or `export TEST_USER_EMAIL=... TEST_USER_PASSWORD=...` (bash).
3. Run: `cd e2e && npx playwright test 060-thread-race.spec.ts --reporter=line`.
4. On green: update `.planning/phases/060-frontend-race-fixes/060-VERIFICATION.md` — replace `_PENDING_` markers with `VERIFIED` and the actual command output, set `status: passed` and `score: 4/4 must-haves verified` in the front-matter, and append the run timestamp.
5. On red: inspect the Playwright trace, check the failure-mode list in the plan's `<how-to-verify>` section, and either fix the regression or extend the prompt to keep the stream long enough to actually exercise the race.

## Next Phase Readiness

- **Phase 062 (Validation Harness):** the test installed here is the seed scenario Phase 062 will fold into a reusable harness covering Symptoms E/F/G/H + navigate-during-stream. Phase 062 can `import` or refactor `060-thread-race.spec.ts` directly.
- **Post-merge Verifier:** `060-VERIFICATION.md` is the report template ready to be filled in. STREAM-02a is the locked acceptance criterion; the binding evidence path is the Playwright test once it runs green against live dev backend.
- **Phase 061 (Reconnect Handlers):** must keep this test passing as a regression guard — Phase 061's polling + visibilitychange work touches the same `useMessages.ts` and `ChatArea.tsx` surface.

## Self-Check

Verifying claims made in this summary.

**Files claimed created:**

- `e2e/tests/060-thread-race.spec.ts` — FOUND
- `.planning/phases/060-frontend-race-fixes/060-VERIFICATION.md` — FOUND

**Commits claimed:**

- `bb32e1d` (test(060-03): add Playwright e2e test for thread navigation race) — FOUND
- `6b15098` (docs(060-03): add 060-VERIFICATION.md scaffold) — FOUND

## Self-Check: PASSED

---

*Phase: 060-frontend-race-fixes*
*Plan: 03*
*Completed: 2026-05-02 (Tasks 1-2; Task 3 deferred to post-merge verifier per checkpoint protocol)*
