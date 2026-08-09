---
phase: 174-run-state-lifecycle-honesty
plan: 01
subsystem: ui
tags: [react, chat-surface, streaming, cross-provider, toolMeta, vitest, render-derive]

# Dependency graph
requires:
  - phase: 067.1
    provides: outerBannerLabel() pre-answer label + its MessageItem call site
  - phase: 147
    provides: cancelled/stopped terminal render (the sibling STATE-01a/02 surface, untouched here)
provides:
  - "STATE-03: pre-first-token 'Reasoning…' honesty — a reasoning-streaming model no longer reads as a dead 'Setting up agent…'"
  - "outerBannerLabel additive reasoningActive=false param (mirrors the isHarness precedent) — Deep byte-identical default (D-14)"
  - "toolMeta.test.ts — the Wave-0 D-14 byte-identical guard that was previously missing (RESEARCH Open Q6)"
affects: [175-cross-provider-streaming-fidelity, 176-chat-render-correctness, 178-chat-ui-ux-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive default-valued param keeps every existing caller + Deep Mode byte-identical (D-14) — reasoningActive=false mirrors isHarness=false"
    - "Render-derive over an already-stamped cross-provider signal (message.reasoningContent) — no new backend event, no latency work"

key-files:
  created:
    - frontend/src/lib/__tests__/toolMeta.test.ts
  modified:
    - frontend/src/lib/toolMeta.ts
    - frontend/src/components/chat/MessageItem.tsx

key-decisions:
  - "Scoped 'Reasoning…' to the reasoning-before-any-tool window only (MessageItem:620, hasAnyTools always false there) — no tool-name branches at this site (Pitfall 1)"
  - "reasoningActive derived as !message.content && !!message.reasoningContent — only the pre-content reasoning window, no new state (D-08)"
  - "Anthropic/Google keep the calm 'Setting up agent…' fallback by design (they never emit reasoning_delta) — CORRECT, not a bug (Pitfall 2)"

patterns-established:
  - "Additive default-false param for Deep-byte-identical label extension (isHarness → reasoningActive)"
  - "Pure-lib vitest guard locking a D-14 byte-identical invariant before AND after a render-derive change"

requirements-completed: [STATE-03]

# Metrics
duration: 3min
completed: 2026-07-22
---

# Phase 174 Plan 01: STATE-03 Pre-Answer "Reasoning…" Honesty Summary

**Pre-first-token label now reads "Reasoning…" for reasoning-streaming providers (DeepSeek/Kimi/GLM/MiniMax/OpenAI-reasoning) instead of the dead "Setting up agent…", via an additive `reasoningActive` param on `outerBannerLabel` derived from the already-stamped cross-provider `message.reasoningContent` — Deep Mode byte-identical, no backend change.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-07-22T13:07:32Z
- **Completed:** 2026-07-22T13:10:48Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- Added `frontend/src/lib/__tests__/toolMeta.test.ts` — the previously-missing Wave-0 guard that locks the D-14 byte-identical default (`outerBannerLabel(null,false,false,false,false)` === "Setting up agent…") plus the isHarness path and the isPlanning arm, and asserts the new STATE-03 "Reasoning…" branch.
- Extended `outerBannerLabel` with an additive trailing `reasoningActive = false` param (mirroring the `isHarness = false` precedent verbatim), branching "Reasoning…" ONLY inside the existing `!hasAnyTools && !isPlanning` arm — every other branch byte-identical.
- Wired `MessageItem.tsx:620` to derive `reasoningActive = !message.content && !!message.reasoningContent` from the already-stamped cross-provider field and pass it as the 5th arg — no new backend event, no new state, no latency work (D-08/D-10).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create toolMeta.test.ts (Wave-0 gap — RED, D-14 byte-identical guard)** - `076806d9` (test)
2. **Task 2: Extend outerBannerLabel with reasoningActive + wire the MessageItem call site (GREEN)** - `60976627` (feat)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

_TDD gate: RED (`076806d9`, test — the "Reasoning…" case failed as designed while the byte-identical guards passed) → GREEN (`60976627`, feat — all 5 toolMeta assertions pass). No REFACTOR needed (the additive change is minimal and clean)._

## Files Created/Modified
- `frontend/src/lib/__tests__/toolMeta.test.ts` - NEW pure-lib vitest guard: D-14 byte-identical default + isHarness/isPlanning unchanged + STATE-03 "Reasoning…" branch + scoping proof (reasoningActive doesn't leak into the tool arm).
- `frontend/src/lib/toolMeta.ts` - `outerBannerLabel` gains `reasoningActive = false`; "Reasoning…" returned only inside the `!hasAnyTools && !isPlanning` arm.
- `frontend/src/components/chat/MessageItem.tsx` - `:620` call site derives `reasoningActive` from `message.reasoningContent` and passes it as the 5th `outerBannerLabel` arg.

## Decisions Made
- **Derive expression `!message.content && !!message.reasoningContent`** — fires only in the pre-content reasoning window (once a visible token arrives, `message.content` is truthy → falls back to normal render). Matches RESEARCH Pattern 3 exactly.
- **No tool-name branches at `MessageItem:620`** — this call site always passes `hasAnyTools=false`; tool-args honesty already lives in `RunStatusStrip` once a tool appears (Pitfall 1). Scope kept to the reasoning window.
- **Cross-provider by construction** — the signal `message.reasoningContent` is already normalized cross-provider at the gateway (`openai_compat.py` `<think>`/`reasoning_content` → `reasoning_delta`); Anthropic/Google keep the calm fallback by design (Pitfall 2), so no per-provider frontend branching was added (D-09/D-14).

## Deviations from Plan

None - plan executed exactly as written. Both tasks landed at their specified seams with the exact signatures the plan/RESEARCH/PATTERNS prescribed; no bugs, missing functionality, or blocking issues were discovered.

## Issues Encountered
- **Pre-existing SEED-056 rot surfaced (not caused by this plan, not fixed — out of scope):** `frontend/src/__tests__/components/MessageItem.test.tsx` has one rotted assertion — "shows thinking indicator when streaming with empty content" expects copy `/thinking/i`, but the shipped pre-tools label has been "Setting up agent…" since Phase 067.1. A rigorous git differential (reverting the Task-2 edits to HEAD, re-running the file, restoring) confirmed this test fails **identically at the HEAD baseline** (1 failed / 51 passed, same test name), so this plan introduces **zero new failures**. My derive is a provable no-op for the test's `content:""`/no-`reasoningContent` input (`true && false` → `false`). Per the plan's explicit instruction ("do NOT chase those, only ensure the touched-file tests pass") and SEED-056, this is left for a future rot-sweep, not this render-honesty plan.

## Known Stubs
None — the change wires a live, already-populated cross-provider signal into the render. No hardcoded/placeholder values introduced.

## User Setup Required
None - no external service configuration required. (Live cross-provider UAT for the "Reasoning…" state on Kimi/DeepSeek/GLM is authored in 174-VALIDATION.md and runs at `/gsd:verify-work`, not here.)

## Next Phase Readiness
- STATE-03 render-derive complete and unit-green; the pre-answer honesty surface is stable for the remaining 174 plans (STATE-01a/02 verify, STATE-01b amber block, STATE-04 timer/avatar) and for 175/176 which render on this same surface.
- Deep Mode byte-identical held (D-14): the `outerBannerLabel` default and every non-reasoning caller are unchanged, locked by the new toolMeta.test.ts.
- Live cross-provider "Reasoning…" UAT remains for `/gsd:verify-work` (needs a reasoning-heavy OpenAI-compat model — Kimi/DeepSeek/GLM — running against the dev stack).

## Self-Check: PASSED
- FOUND: frontend/src/lib/__tests__/toolMeta.test.ts
- FOUND: frontend/src/lib/toolMeta.ts
- FOUND: frontend/src/components/chat/MessageItem.tsx
- FOUND commit: `076806d9` (Task 1, test)
- FOUND commit: `60976627` (Task 2, feat)

---
*Phase: 174-run-state-lifecycle-honesty*
*Completed: 2026-07-22*
