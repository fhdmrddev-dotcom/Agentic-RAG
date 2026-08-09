---
phase: 174-run-state-lifecycle-honesty
plan: 03
subsystem: ui
tags: [react, chat-surface, streams-provider, error-handling, amber-notice, xss-safe, workflow-kill-switch]

# Dependency graph
requires:
  - phase: 174-01
    provides: "STATE-03 pre-answer label seam + the toolMeta/outerBannerLabel render call site (shared MessageItem pre-answer window)"
  - phase: 149
    provides: "the model-fallback-notice amber primitive (MessageItem.tsx:467-473) reused verbatim for the STATE-01b amber tier"
  - phase: 092
    provides: "the per-thread workflowLockByThread + clearWorkflowLockForThread action reused for the defensive lock-clear"
provides:
  - "STATE-01b: a workflows kill-switch 403 renders an honest in-chat AMBER bubble carrying the server ApiError.message instead of a blank workflow card"
  - "render-only blockedNotice?: { message: string } Message field (sibling of modelFallbackNotice, no persistence, no migration)"
  - "a narrow err.status===403 catch branch in StreamsProvider.sendMessage (placeholder-swap + defensive clearWorkflowLockForThread) that leaves the 400/409 rollback paths byte-identical"
affects: [175, 176, 178, chat-surface, StreamsProvider, MessageItem, run-state-honesty]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Narrowest-status-first additive catch branch (403 inserted before the generic ApiError branch) — divergence keyed narrowly so sibling paths stay byte-identical (D-05)"
    - "Render-only optional Message field stamped once in the provider, read once in MessageItem (no persistence, no migration) — sketch 129-C amber administrative-block tier"
    - "XSS-safe server-string render: ApiError.message as React text children only, never dangerouslySetInnerHTML (T-174-03-01 / A23)"

key-files:
  created:
    - frontend/src/components/chat/__tests__/MessageItem.blockedNotice.test.tsx
    - frontend/src/__tests__/providers/streamsProvider_state01b_403.test.tsx
  modified:
    - frontend/src/types/index.ts
    - frontend/src/components/chat/MessageItem.tsx
    - frontend/src/providers/StreamsProvider.tsx

key-decisions:
  - "403 is the sole discriminator (D-05 / RESEARCH Open Q5) — the workflows kill-switch + app-layer ban both raise 403; 400 disabled-skill and 409 workflow-lock keep their rollback-banner paths byte-identical"
  - "Reused the model-fallback-notice amber classes verbatim (D-06) + added a Ban glyph so the tier is never color-alone (A10 / WCAG 1.4.1) — no bespoke amber CSS"
  - "Defensive clearWorkflowLockForThread(threadId) via the OWNING threadId closure (A25) — a no-op in the common case (the kickoff lock is only seeded after run_id, which a 403 never reaches) but guarantees the composer is never left locked"
  - "No runs query in the 403 branch — the 403 fires before any run/message INSERT (Pitfall 5); the branch is a pure frontend placeholder-swap + lock-clear"

patterns-established:
  - "Amber administrative-block tier (129-C): reuse the model-fallback-notice primitive + glyph, server string as React text"
  - "Additive catch branch divergence proven by regression rows (400/409 assert NO blockedNotice) alongside the new 403 behavior"

requirements-completed: [STATE-01]

# Metrics
duration: ~13min
completed: 2026-07-22
---

# Phase 174 Plan 03: STATE-01b Killed-Workflow Honest Amber Reason Bubble Summary

**A workflows kill-switch 403 now renders an honest in-chat amber "disabled by the administrator" bubble (server string verbatim, XSS-safe) and clears the harness workflow-lock so the composer stays usable — instead of a blank workflow card with a stuck composer.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-07-22T13:20:00Z
- **Completed:** 2026-07-22T13:33:37Z
- **Tasks:** 3
- **Files modified:** 5 (3 modified, 2 test files created)

## Accomplishments
- Added a render-only `blockedNotice?: { message: string }` Message field (sibling of `modelFallbackNotice`) — no persistence, no migration.
- Added the amber blocked-notice render block in `MessageItem` reusing the `model-fallback-notice` primitive verbatim (D-06) + a `Ban` glyph (A10) rendering the server string as React text only (A23/XSS-safe).
- Inserted a narrow `err.status === 403` branch in `StreamsProvider.sendMessage`'s catch — placeholder-swap (keeps the user bubble) + defensive `clearWorkflowLockForThread(threadId)` — positioned before the generic `ApiError` branch so the Deep 400/409 rollback paths stay byte-identical (D-05, verified: 22 insertions / 0 deletions).
- Two new tests: a component render test (verbatim server string, exact amber classes, HTML-injection probe, absent-path byte-identical) and a provider catch test proving the 403 amber+lock-clear and the narrow 400/409 divergence.

## Task Commits

Each task was committed atomically:

1. **Task 1: blockedNotice type + amber render block + component test** - `051d2cef` (feat)
2. **Task 2: err.status===403 catch branch (placeholder-swap + lock-clear)** - `03074d42` (feat)
3. **Task 3: StreamsProvider 403 catch test (+ 400/409 regression rows)** - `bd9ae324` (test)

_Note: Task 2 is marked `tdd="true"` in the plan; the plan structures its RED test as the dedicated Task 3 catch test (green), with Task 2's own gate being the differential Deep-ordering + send-lifecycle regression suite._

## Files Created/Modified
- `frontend/src/types/index.ts` — added the render-only `blockedNotice?: { message: string }` field.
- `frontend/src/components/chat/MessageItem.tsx` — added the amber `data-testid="blocked-notice"` block (reuses the amber primitive + `Ban` glyph, XSS-safe React text) and the `Ban` lucide import.
- `frontend/src/providers/StreamsProvider.tsx` — added the `else if (err instanceof ApiError && err.status === 403)` catch branch (placeholder-swap + defensive lock-clear).
- `frontend/src/components/chat/__tests__/MessageItem.blockedNotice.test.tsx` — component render test (created).
- `frontend/src/__tests__/providers/streamsProvider_state01b_403.test.tsx` — provider catch test (created).

## Verification

- `npm test -- MessageItem.blockedNotice.test.tsx` → 4/4 green.
- `npm test -- streamsProvider_state01b_403.test.tsx` → 3/3 green (403 amber+lock-clear; 409 + 400 regression rows assert NO blockedNotice).
- `npm test -- StreamsProvider.anthropic-ordering streamsProvider_bug_260707` → 7/7 green (Deep byte-identical guard + send/stream lifecycle intact).
- Combined suite (all 5 files) → 14/14 green.
- `git diff` on `StreamsProvider.tsx` = 22 insertions / 0 deletions → the 409, generic-400, and network branches are byte-identical (D-05).

## Decisions Made
None beyond the plan — the plan's D-04/D-05/D-06 decisions and the RESEARCH `status===403` discriminator (Open Q5) were followed as specified. The one implementation choice within Claude's discretion: the glyph for A10 color-never-alone is lucide `Ban` (the ⊘ prohibition analog), kept inside the reused amber classes via an additive `flex items-center gap-1.5` layout (the same additive-layout idiom the `capPaused` amber block uses).

## Deviations from Plan

None - plan executed exactly as written. No auto-fixes were required (Rules 1-3 did not fire); no architectural decisions surfaced (Rule 4 did not fire).

## Issues Encountered

**Pre-existing test rot surfaced during the MessageItem regression sweep (out of scope — logged, not fixed).**
`MessageItem.test.tsx:106` ("shows thinking indicator when streaming with empty content") asserts the pre-answer label matches `/thinking/i`, but the shipped label is "Setting up agent…" (the `outerBannerLabel` default at the STATE-03 call site, `MessageItem.tsx:625`). This failure is **pre-existing SEED-056 rot, not caused by Plan 03**: Plan 03's `MessageItem.tsx` diff is purely the additive `blockedNotice` block (falsy-guarded for this test's message) + the `Ban` import — it does not touch the thinking/pre-answer branch, and the test file was not edited by Plan 03. The thinking-branch render is byte-identical at the phase-start baseline (`5888ab46`), so the result is identical before and after this plan. Per the plan's verification note ("differential vs SEED-056 rot — do not chase pre-existing failures"), this is logged to `deferred-items.md` and routed to the STATE-03 label owner. The full MessageItem suite is otherwise 61/62 green (differential: 0 net-new failures from this plan).

## Known Stubs

None — `blockedNotice` is wired end-to-end (server `ApiError.message` → provider stamp → amber render), no placeholder/mock data.

## Threat Flags

None — no new security surface introduced beyond the plan's `<threat_model>`. The amber bubble renders the already-authorized-and-refused server 403 message as React text (T-174-03-01 mitigated by construction); no new endpoint, authz, or persistence.

## User Setup Required

None - no external service configuration required. This is a render-layer-only change (no backend edit, no migration, no env var).

## Next Phase Readiness
- STATE-01b (BUILD) is complete under test. The killed-workflow chat surface is honest; the run-state/lifecycle surface Plans 175/176/178 render on is one step more stable.
- **Live UAT owed (VALIDATION.md, at `/gsd:verify-work`):** Control Plane → Workflows kill-switch OFF; launch a workflow from chat → amber "disabled by the administrator" bubble, composer usable (not locked); parallel-thread axis (Thread A blocked while Thread B keeps its own composer state). Requires a published workflow + the kill-switch toggle (operator-configured).

## Self-Check: PASSED

All 5 code/test files + the SUMMARY + deferred-items.md exist on disk; all 3 task commits (`051d2cef`, `03074d42`, `bd9ae324`) are present in git history.

---
*Phase: 174-run-state-lifecycle-honesty*
*Completed: 2026-07-22*
