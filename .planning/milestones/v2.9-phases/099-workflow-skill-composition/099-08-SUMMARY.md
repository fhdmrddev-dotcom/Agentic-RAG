---
phase: 099-workflow-skill-composition
plan: 08
subsystem: ui
tags: [react, zustand, streaming, error-handling, ApiError, chat-surface, gap-closure]

# Dependency graph
requires:
  - phase: 092-dual-mode-wiring
    provides: "ApiError status-carrying error + the 409 lock-refusal catch branch (092-06 / F3) this plan extends additively"
  - phase: 099-workflow-skill-composition
    provides: "WFSKILL-01 backend skill-snapshot publish gate that returns a descriptive 400 on a disabled skill_ref — the refusal this plan makes legible"
provides:
  - "postMessage reads the response body and throws ApiError(detail, status) — FastAPI {detail} survives the send path"
  - "StreamsProvider non-409 ApiError catch branch — rolls back both optimistic temps, sets per-thread reconcile banner to the server detail, stashes the failed prompt"
  - "streamsStore.failedSendDrafts per-thread Map + useFailedSendDraftForThread selector"
  - "ChatArea banner renders the server detail for ANY ApiError (no Retry for non-retryable statuses); failed prompt fed back to the composer via the existing prefill seam"
affects: [chat-surface, StreamsProvider, ChatArea, MessageInput, harness-kickoff, error-banner]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read the HTTP error body before throwing so the server {detail} survives (mirrors the uploadDocument detail-read idiom) while keeping the status-carrying ApiError for the 409 distinguisher"
    - "Per-thread failed-send draft Map + selector mirroring fallbackNotices/reconcileErrors isolation — recover the typed prompt through the existing prefill seam, cleared on consume AND on banner dismiss"
    - "Additive-only catch branch between the 409 branch and the network else — no success-path or 409-semantics edit"

key-files:
  created:
    - frontend/src/components/chat/__tests__/ChatAreaBanner.test.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/stores/streamsStore.ts
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/__tests__/lib/api.test.ts
    - frontend/src/__tests__/providers/streamsProvider.test.tsx

key-decisions:
  - "KEEP MINIMAL on the network-error else: a genuine non-ApiError failure keeps the failed placeholder, no banner (per plan decision — transient, blast-radius)"
  - "409 stays byte-equivalent: fixed lock copy (never the raw body), Dismiss-only, both temps rolled back, NO draft stashed (retrying a doomed Deep send is meaningless)"
  - "Server detail rendered as React text children, never dangerouslySetInnerHTML (T-099-08-01) — server-controlled string can never inject HTML"

patterns-established:
  - "Error-body passthrough: read body before throw, status-carrying ApiError, string-detail guard, generic fallback for non-string/unparseable bodies"
  - "Per-thread stashed draft recovery via the prefill seam (prefillMessage={failedDraft ?? prefillMessage}; clear on consume + on dismiss)"

requirements-completed: [WFSKILL-01]

# Metrics
duration: 11min
completed: 2026-06-10
---

# Phase 099 Plan 08: Surface Kickoff Refusals in the Chat UI (UAT L10 Gap Closure) Summary

**A disabled-skill kickoff (non-409 400) now shows the server's descriptive message in the owning thread's error banner — both optimistic bubbles roll back, the typed prompt repopulates the composer, and the 409 + Deep success paths stay byte-equivalent.**

## Performance

- **Duration:** 11 min (Tasks 1-3; Task 4 is an operator checkpoint, not executed)
- **Started:** 2026-06-10T09:13:33Z
- **Completed (Tasks 1-3):** 2026-06-10T09:24:28Z
- **Tasks:** 3 of 4 (Task 4 = checkpoint:human-verify, awaiting operator)
- **Files modified:** 6 source/test files modified + 1 test file created (7 total)

## Accomplishments
- Stopped swallowing the HTTP error body: `postMessage` reads the response body and throws `ApiError(detail, status)` before the generic fallback, so FastAPI's `{detail}` (the actionable disabled-skill gate message) reaches the UI.
- Added the non-409 `ApiError` catch branch in `StreamsProvider.sendMessage`: rolls back BOTH optimistic temp bubbles (so reconcile cannot leave a dead blank thread), sets the per-thread reconcile banner to the server detail, and stashes the typed prompt in a new `failedSendDrafts` per-thread Map.
- Made the refusal visible in `ChatArea`: the banner now renders `reconcileError.message` for ANY `ApiError` (not just 409), hides Retry for non-retryable statuses (400/403/404/409/422), and feeds the stashed prompt back into the composer via the existing prefill seam (cleared on consume and on banner dismiss).
- Server detail rendered as React text children (no `dangerouslySetInnerHTML`) — T-099-08-01 XSS mitigation by construction.

## Task Commits

Each task was committed atomically (TDD: test+impl folded into one commit per task since the test file and source ship together):

1. **Task 1: postMessage surfaces server detail on non-409 refusal** — `c899cbb9` (fix)
2. **Task 2: non-409 ApiError catch branch surfaces refusal + stashes draft** — `6c0ee970` (feat)
3. **Task 3: banner shows server detail for any ApiError + prompt recovery** — `9b376fbc` (feat)

**Task 4: Live L10 re-run (operator verification)** — NOT executed. This is a `checkpoint:human-verify` gate (`auto_advance: false`); it is the G-4 lived-experience acceptance bar and awaits operator sign-off (see "Checkpoint — Awaiting Operator Verification" below).

_Plan metadata commit (this SUMMARY + STATE/ROADMAP) follows separately._

## Files Created/Modified
- `frontend/src/lib/api.ts` — `postMessage` reads the body before throwing; `ApiError(detail ?? "Failed to send message", status)` with a string-detail guard.
- `frontend/src/providers/StreamsProvider.tsx` — new `} else if (err instanceof ApiError) {` branch (rollback both temps + set banner + stash draft); `useFailedSendDraftForThread` selector exported.
- `frontend/src/stores/streamsStore.ts` — `failedSendDrafts: Map<string, string>` state field + init.
- `frontend/src/components/chat/ChatArea.tsx` — banner message gate widened to any ApiError; `NON_RETRYABLE` set drives `hideRetry`; `failedDraft` fed to `prefillMessage`; `dismissReconcileError` clears the draft symmetrically.
- `frontend/src/__tests__/lib/api.test.ts` — `describe("postMessage error handling")` with 4 cases (non-409 detail / 409 status / unparseable-body fallback / success unchanged).
- `frontend/src/__tests__/providers/streamsProvider.test.tsx` — `describe("099-08 — kickoff refusal surfaces the server detail")` with 4 cases; `vi.mock("@/lib/api")` upgraded to re-export the real `ApiError` via `importActual`.
- `frontend/src/components/chat/__tests__/ChatAreaBanner.test.tsx` (NEW) — `describe("099-08 refusal banner")` with 4 cases (400 gate / 409 lock / plain reconcile / draft prefill).

## Verification

- `src/__tests__/lib/api.test.ts` — 42/42 pass (38 pre-existing + 4 new postMessage tests).
- `src/__tests__/providers/streamsProvider.test.tsx` — 31 pass / 10 fail; the 10 failures are the documented pre-existing rot (SEED-056 / project_frontend_vitest_rot — L-068-02, L-068-05, listener-migration, L-068.5-02/05, 075.6 argsCodeText reducer), proven pre-existing via a `git stash` round-trip at this task's base (10 fail at baseline with my changes stashed, identical set). All 4 new 099-08 tests pass.
- `src/components/chat/__tests__/ChatAreaBanner.test.tsx` — 4/4 pass.
- `src/components/chat/__tests__/ChatAreaMode.test.tsx` + `src/__tests__/components/chat/MessageList.test.tsx` — 12/12 pass.
- `npx tsc --noEmit -p tsconfig.json` — clean (exit 0, no errors).
- **Net-new test failures vs baseline = 0** (baseline-stash-proven).
- `git diff --name-only` across the 3 task commits shows ONLY the 7 plan files; **zero backend files**; success path / 409 semantics / SSE handling untouched.

## Grep Acceptance Criteria (all satisfied)
- Task 1: `await res.json().catch` inside postMessage ✓; `typeof body?.detail === "string"` ✓; `throw new ApiError` remains the only error type postMessage throws ✓.
- Task 2: `} else if (err instanceof ApiError) {` ✓ (StreamsProvider.tsx:1811); `failedSendDrafts: new Map(s.failedSendDrafts).set(threadId, content)` ✓ (:1825); `failedSendDrafts` in streamsStore.ts = 3 (≥2) ✓; `useFailedSendDraftForThread` exported ✓ (:2807); 409 lock copy literal occurs exactly once ✓.
- Task 3: message gate is `reconcileError instanceof ApiError` (no `&& status === 409`) ✓ (:535); `NON_RETRYABLE` ✓; `useFailedSendDraftForThread` read + `prefillMessage={failedDraft ?? prefillMessage}` ✓; no `dangerouslySetInnerHTML` JSX usage (the single grep hit is a comment confirming the safe pattern) ✓; 409 testid split unchanged ✓.

## Decisions Made
None beyond the plan-specified decisions (KEEP MINIMAL on the network else; 409 byte-equivalence with no draft stash; text-children XSS-safe rendering). Followed the plan verbatim.

## Deviations from Plan
None - plan executed exactly as written.

The one non-source adjustment worth noting (not a deviation from intent): the `streamsProvider.test.tsx` `vi.mock("@/lib/api")` factory was upgraded to an async `importActual` form so it re-exports the REAL `ApiError` class — required because the production `instanceof ApiError` checks (the 409 distinguisher AND the new non-409 branch) must match the same class the tests construct. The plan's Task 2 action explicitly directed `Import ApiError from @/lib/api` in the tests; the mock factory change is the mechanical enabler for that, with no behavior change to the stubbed network fns. Confirmed not the cause of the 10 baseline-rot failures via the stash round-trip.

## Issues Encountered
- `--reporter=basic` is rejected by this vitest version (v4.1.0) — it tries to load a file named `basic`. Used the default reporter for all runs (no behavior impact; the verify commands' intent is satisfied).
- The 10 streamsProvider.test.tsx failures looked alarming at first (12 failed post-edit); a `git stash` round-trip at the task base proved 10 are pre-existing SEED-056 rot, leaving exactly my 2 RED tests in the failing set during RED. Net-new = 0.

## Known Stubs
None — all code is wired to live data (the server detail flows from `api.ts` → store → banner; the stashed prompt flows store → prefill → composer). No placeholders, no hardcoded empties feeding the UI.

## Threat Flags
None — this plan introduces no new network endpoints, auth paths, file access, or schema changes. The one new trust-boundary surface (server `{detail}` string crossing into the DOM) is the `T-099-08-01` threat already enumerated in the plan's threat model and mitigated by rendering as React text children (no `dangerouslySetInnerHTML`).

## Checkpoint — Awaiting Operator Verification (Task 4)

**Status:** Tasks 1-3 complete and committed. Task 4 (`checkpoint:human-verify`, G-4 lived-experience gate) is NOT executed — it is the operator-driven acceptance bar.

**What was built (for verification context):** the frontend now surfaces backend kickoff refusals — `api.ts` passes through the server `detail`, `StreamsProvider` rolls back both optimistic bubbles + sets the per-thread banner + stashes the prompt, and `ChatArea` shows the message (no Retry for gate-refusal statuses) while feeding the prompt back to the composer. Automated coverage: api.test.ts postMessage tests + streamsProvider 099-08 branch tests + ChatAreaBanner tests + tsc clean.

**How to verify (re-run UAT row L10 LIVE):**
1. In the Skills UI, DISABLE the skill referenced by the `skill_compose_099uat` (or `risk-lens_099uat`) workflow.
2. Start a NEW chat thread, pick that skill-bearing workflow (Harness mode), type a recognizable prompt (e.g. "L10 refusal probe"), and send.
3. EXPECT: an amber error banner in THAT thread carrying the server's descriptive message (the disabled-skill gate text — NOT "Couldn't load latest messages"), with NO Retry control (Dismiss × only). The thread is NOT a dead blank "New Chat".
4. EXPECT: the typed prompt is back in the composer input (recoverable).
5. Repeat across 2-3 providers from the repro set (glm / minimax / gpt-5.4-mini) — the banner must appear on all.
6. SANITY: (a) a NORMAL Deep message in a fresh thread streams normally, no banner; (b) starting a workflow then trying to send a Deep message into the SAME thread mid-run still shows the EXISTING 409 lock banner with no Retry (byte-equivalent).
7. Re-enable the skill afterward.
8. Optional DB cross-check: zero new `workflow_runs` for the refused attempts (gate still fail-closed server-side).

**Resume signal:** Operator types "approved" once the banner shows the server message, the prompt is recoverable, and the 409 + Deep-success paths are unchanged — or describes what differed.

## Next Phase Readiness
- Tasks 1-3 ship the full frontend legibility fix for UAT L10; WFSKILL-01's publish-gate behavior is now legible end-to-end (backend fail-closed + frontend-visible) pending the operator's live L10 re-run.
- No blockers. The only outstanding item is the Task 4 operator checkpoint.

## Self-Check: PASSED

- All 6 created/modified source/test files verified present on disk.
- 099-08-SUMMARY.md verified present.
- All 3 task commits verified in git log: `c899cbb9`, `6c0ee970`, `9b376fbc`.

---
*Phase: 099-workflow-skill-composition*
*Completed (Tasks 1-3): 2026-06-10*
