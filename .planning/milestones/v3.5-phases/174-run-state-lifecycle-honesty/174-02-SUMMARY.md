---
phase: 174-run-state-lifecycle-honesty
plan: 02
subsystem: testing
tags: [react, chat-surface, vitest, render-derive, runStatus, reload-derive, verify-only]

# Dependency graph
requires:
  - phase: 147
    provides: cancelled-no-output affordance (MessageItem.tsx:632) + persistent "Response stopped" indicator (:675) — the STATE-01a/02 render conditions this plan LOCKS
  - phase: 145
    provides: runs.status authoritative run-lifecycle foundation (FND-01) — the persisted state the reload-derive reads
  - phase: 095.1
    provides: threads.py runs-enrich zip (:350-353) + api.ts _mapMessageResponse started_at/run_status mapping — the reload-derive chain confirmed intact here
provides:
  - "STATE-01a: locked under test — empty-content cancelled row renders data-testid=cancelled-no-output ('cancelled — no output yet'), never an avatar-only empty bubble"
  - "STATE-02: locked under test — cancelled-with-content renders persistent 'Response stopped' + timed_out renders 'Agent reached time limit', both derived purely from message.runStatus (the reload-derive field)"
  - "Confirmed (by inspection, no edit): the runs.status -> runStatus cold-reload derive (threads.py:350-353 zip keyed on message_id; api.ts:198 _mapMessageResponse) is intact end-to-end — reserve surgical fix did NOT fire (D-03 expectation held)"
affects: [175-cross-provider-streaming-fidelity, 176-chat-render-correctness, 178-chat-ui-ux-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "VERIFY-not-rebuild regression lock: extend the existing component test to pin an already-shipped render condition (Phase 147/D-03) so sibling hot-file churn cannot silently regress it — no production render touched (D-01)"
    - "Component-level proof of a backend reload-derive: assert the render fires from message.runStatus alone (the field threads.py zips + api.ts maps), so a full cold reload re-derives the same marker"

key-files:
  created: []
  modified:
    - frontend/src/__tests__/components/MessageItem.test.tsx

key-decisions:
  - "VERIFY-only (D-01/D-02): the cancelled-no-output + 'Response stopped'/'Agent reached time limit' renders already exist and are correct — locked under test, NOT rebuilt; MessageItem.tsx unchanged this plan"
  - "Reserve surgical fix did NOT fire (D-03): the reload-derive chain (threads.py:350-353 keyed on message_id; api.ts:198 run_status->runStatus) is intact by inspection — no threads.py / api.ts / migration edit, exactly as research predicted"
  - "Asserted mutual exclusion both directions: empty-content cancelled -> affordance only (no 'Response stopped'); content-bearing cancelled -> 'Response stopped' only (no empty affordance) — the !!content gate proven at the render layer"

patterns-established:
  - "VERIFY-not-rebuild regression lock over a Phase-147/D-03 shipped render — extend, never re-implement"
  - "runStatus-driven render assertion = component-level proof of the backend reload-persistence contract"

requirements-completed: [STATE-01, STATE-02]

# Metrics
duration: 10min
completed: 2026-07-22
---

# Phase 174 Plan 02: STATE-01a + STATE-02 Verify-and-Close Summary

**The empty-content cancelled affordance (`cancelled — no output yet`) and the persistent stop indicator (`Response stopped` / `Agent reached time limit`) — both shipped in Phase 147/D-03 — are now LOCKED under 6 new component tests proving they render purely from `message.runStatus` (the field the cold-reload derive populates). The reload-derive chain was confirmed intact by inspection; the contingent reserve surgical fix did NOT fire, exactly as research predicted. No production code touched (VERIFY, D-01/D-03).**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-22T13:09:30Z
- **Completed:** 2026-07-22T13:19:30Z
- **Tasks:** 2 (Task 1: test extension; Task 2: inspection-only, no code change)
- **Files modified:** 1 (`MessageItem.test.tsx`, +96 lines)

## Accomplishments
- **STATE-01a locked:** an empty-content assistant row with `runStatus:"cancelled"` (not streaming) renders `data-testid="cancelled-no-output"` with verbatim `cancelled — no output yet` — the DeepSeek early-cancel empty-bubble case (BUG-260710-02) can never regress silently.
- **STATE-02 locked:** a cancelled run WITH content renders `Response stopped`; a `timed_out` run renders `Agent reached time limit`; both derive purely from `message.runStatus`, and the indicator gates on `!isStreaming` (a terminal/reload marker, not a live one). This is the component-level proof of STATE-02's reload persistence — `message.stopped` is live-only, so gating additionally on `runStatus` is what survives a full cold reload (BUG-260710-01).
- **Mutual-exclusion guard proven both directions:** empty-content cancelled → affordance ONLY (no double "Response stopped"); content-bearing cancelled → "Response stopped" ONLY (no empty affordance). The `!!message.content` gate is locked at the render layer.
- **Reload-derive chain confirmed intact by inspection (Task 2):** `threads.py:350-353` zips `runs.status → run_status` keyed on the message's own `message_id` (so even the empty content_len=0 early-cancel row is populated), and `api.ts:_mapMessageResponse` (:198) maps `run_status → runStatus` on every `getMessages`/`getSnapshot`. Matches the 174-RESEARCH.md trace exactly — no gap, no change.

## Task Commits

1. **Task 1: Extend MessageItem.test.tsx to lock the STATE-01a + STATE-02 render invariants** - `5ef7e291` (test)
2. **Task 2: Confirm the reload-derive chain intact + document the reserve surgical fix (contingent, no code)** - no code commit (inspection-only; the render-layer reload-derive contract is covered by Task 1's runStatus-driven cases, per the task's own acceptance criteria). Finding recorded in this SUMMARY.

**Plan metadata:** committed with this SUMMARY (docs: complete plan).

## Files Created/Modified
- `frontend/src/__tests__/components/MessageItem.test.tsx` - Added a `Phase 174 — STATE-01a/02 terminal-state render (VERIFY, derives from runStatus)` describe block with 6 cases: empty-content cancelled → `cancelled-no-output`; its mutual-exclusion guard; cancelled-with-content → `Response stopped`; its reverse guard (no empty affordance); `timed_out` → `Agent reached time limit`; and the `!isStreaming` gate. Production render files (`MessageItem.tsx`) untouched.

## Verification

- **`cd frontend && npm test -- MessageItem.test.tsx`** — differential vs SEED-056 baseline:
  - **Baseline (HEAD, before this plan):** 1 failed / 25 passed.
  - **With the 6 new tests:** 1 failed / 31 passed.
  - The single failure is IDENTICAL on both sides — the pre-existing `getByText(/thinking/i)` rot at line 106 ("shows thinking indicator when streaming with empty content"): the shipped pre-tools label has been `Setting up agent…` since Phase 067.1 / Plan 01's STATE-03 extension, not "thinking". **Zero net-new failures**; all 6 new STATE-01a/02 assertions pass.
- **Reserve-fix gate (D-03):** `git status --short` for `frontend/src/components/chat/MessageItem.tsx`, `frontend/src/lib/api.ts`, and `backend/app/api/threads.py` = clean (unchanged). The reserve surgical fix did **not** fire — the traced reload-derive chain is intact by inspection, matching the research expectation. No migration, no backend edit, no shared-path fork (D-14).
- **Manual live UAT (deferred to `/gsd:verify-work`, authored in 174-VALIDATION.md):** DeepSeek early-cancel → full cold reload keeps "cancelled — no output yet"; a mid-stream Stop keeps "Response stopped" after (a) nav-away-and-back and (b) a full cold browser reload, on ≥1 provider. Not run here (needs the live dev stack + DeepSeek key).

## Decisions Made
- **VERIFY, not rebuild (D-01/D-02):** the two render conditions (`MessageItem.tsx:632` cancelled-no-output, `:675` "Response stopped"/"Agent reached time limit") already exist and are correct end-to-end. They were locked under test, never re-implemented — a rebuild would risk regressing Phase 147/D-03. `MessageItem.tsx` shows zero diff this plan.
- **Reserve surgical fix held and NOT fired (D-03):** research traced the full persist→finalize→zip→map→render chain and predicted no gap. Confirmed by inspection: `threads.py:350-353` keys the run-join on `message_id` (not content), so the empty early-cancel row gets `run_status='cancelled'`; `api.ts:198` maps it to `runStatus`. No edit to `threads.py`/`api.ts`, no new persistence, no migration.
- **runStatus-driven assertions as the reload proof:** because `message.stopped` is live-only and NOT re-derived on reload, gating the persistent indicator additionally on `message.runStatus` is precisely what makes it survive a cold reload. Asserting the render fires from `runStatus` alone (the field the backend zip populates) is the component-level proof of the reload-persistence contract — Task 2's regression guard, satisfied by Task 1's cases per the plan's acceptance criteria.

## Deviations from Plan

None - plan executed exactly as written. Task 1 extended the test at the exact harness the plan/PATTERNS prescribed (`makeMessage`/`renderWithTooltip`, `getByTestId`), and Task 2's reserve surgical fix was — as research expected — NOT triggered (the reload-derive chain is intact). No bugs, missing functionality, or blocking issues were discovered; no auto-fix rules fired.

## Issues Encountered
- **Pre-existing SEED-056 rot surfaced (not caused by this plan, not fixed — out of scope):** the `MessageItem.test.tsx` "shows thinking indicator when streaming with empty content" case (line 106) expects `/thinking/i` but the shipped pre-tools label is `Setting up agent…` (Phase 067.1 / Plan 01 STATE-03). A rigorous git differential (checkout HEAD version → run → restore) confirmed it fails IDENTICALLY at baseline (1 failed / 25 passed) as with my change (1 failed / 31 passed) — zero new failures. Left for a future rot-sweep per SEED-056 and the phase's differential-only mandate; my 6 appended cases are a self-contained describe block that cannot affect the line-106 case.

## Known Stubs
None — this plan adds test coverage over an already-live render + an inspection of an already-wired reload-derive. No hardcoded/placeholder values, no un-wired data sources introduced.

## Threat Flags
None — VERIFY-only over the existing persisted `runs.status` reload-derive + existing render conditions. No new endpoint, input, auth, persistence, or trust boundary (threat register T-174-02-01/SC both `accept`, unchanged).

## User Setup Required
None - no external service configuration required. (The STATE-01a DeepSeek early-cancel + cold-reload UAT and the STATE-02 mid-stream-Stop + reload UAT run at `/gsd:verify-work` against the live dev stack, per 174-VALIDATION.md.)

## Next Phase Readiness
- STATE-01a/02 are verify-and-closed at the component layer; the highest-regression-risk Phase-147/D-03 renders are now guarded, so the remaining 174 plans (STATE-01b amber block, STATE-04 timer/avatar) can edit the sibling MessageItem/StreamsProvider surface without silently regressing the terminal-state markers.
- The cold-reload derive is confirmed intact — no persistence/migration owed by this plan.
- Live cross-provider cold-reload UAT (STATE-01a on DeepSeek + ≥1 other; STATE-02 nav + full reload) remains for `/gsd:verify-work` (SC#10 4-axis, authored in 174-VALIDATION.md). Only if that UAT contradicts the traced derive does the reserve surgical fix fire (narrow correction at the `threads.py` join / `api.ts` map — never new persistence; D-03/D-14).

## Self-Check: PASSED
- FOUND: frontend/src/__tests__/components/MessageItem.test.tsx (modified, +96 lines)
- FOUND commit: `5ef7e291` (Task 1, test)
- CONFIRMED unchanged: frontend/src/components/chat/MessageItem.tsx, frontend/src/lib/api.ts, backend/app/api/threads.py (reserve fix did NOT fire — D-03)

---
*Phase: 174-run-state-lifecycle-honesty*
*Completed: 2026-07-22*
