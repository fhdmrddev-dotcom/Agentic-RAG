---
phase: 174-run-state-lifecycle-honesty
plan: 04
subsystem: ui
tags: [react, chat-surface, streams-provider, dedup, run-timer, avatar, reconcile-race]

# Dependency graph
requires:
  - phase: 095.1
    provides: "the RunCard started_at-anchored timer (RunCard.tsx:122 runStartMs = startedAt ?? created_at) — reused verbatim as the CONSUMER of the new kickoff startedAt stamp"
  - phase: 174-03
    provides: "the render-only blockedNotice temp/no-runId assistant row (STATE-01b amber) whose survival is the mandatory dedup regression invariant"
  - phase: 123
    provides: "dedupMessagesByRunId (dedupMessages.ts) — the shared bucket-read dedup seam extended here for the pre-runId window"
provides:
  - "STATE-04 timer: the kickoff optimistic assistant placeholder is stamped with startedAt (client send-time) so the run-strip timer climbs from a stable wall-clock baseline on a nav-back remount instead of reseeding from component mount (D-11)"
  - "STATE-04 avatar: dedupMessagesByRunId now collapses the same-send pre-runId double-mount twin (two adjacent empty temp/no-runId assistant rows) to one — scoped so the STATE-01b amber + failed-send temp rows are never erased (D-12)"
affects: [175, 176, 178, chat-surface, StreamsProvider, MessageList, RunCard, run-state-honesty]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive render-only field stamp on the kickoff placeholder (startedAt joins runId/model/provider) — no backend field, persisted runs.started_at enrich corrects drift on next hydrate (D-14 Deep byte-identical)"
    - "Narrowly-scoped pre-runId collapse: a same-send twin (adjacent empty temp/no-runId assistant rows) collapses; a blockedNotice/failed row is guarded on BOTH the predicate AND the always-user-row-between-sends invariant — never a blind any-two-temp-rows rule"

key-files:
  created: []
  modified:
    - frontend/src/providers/StreamsProvider.tsx
    - frontend/src/lib/dedupMessages.ts
    - frontend/src/components/chat/RunCard.timer.test.tsx
    - frontend/src/lib/__tests__/dedupMessages.test.ts
    - frontend/src/__tests__/components/chat/MessageList.dedup.test.tsx
    - frontend/src/__tests__/providers/streamsProvider_075_7_reconcile_race.test.tsx

key-decisions:
  - "Task-1 Wave-0 confirmation: the workflow run-receipt renders through RunCard (the tool_calls>0 gate at MessageItem.tsx:437 — harness phases run Deep tools) and RunStatusStrip is purely presentational (receives elapsedLabel as a prop, owns NO timer). PRIMARY (RunCard-only) branch fired — RunStatusStrip.tsx UNTOUCHED; RunCard.tsx:122 unedited (already 095.1-correct). Resolves RESEARCH Open Q4 / A3."
  - "Chose option (b) — pure-dedup adjacency in dedupMessagesByRunId — over option (a) insert-seam guard: it lives at the single shared bucket-read seam, is a pure testable function, and avoids touching the StreamsProvider reconcile-insert path (which would risk regressing the 075.7 race fix). The collapse is scoped to the same-send twin, never a blind any-two-temp-rows rule."
  - "Keep the FIRST of the twin (the original send-time placeholder that later receives the runId + startedAt stamp), drop the adjacent duplicate — aligns Task 2 (single avatar) with Task 1 (the surviving row is the anchored one)."
  - "Defensive both-sides guard: isCollapsiblePreRunPlaceholder excludes blockedNotice rows and runStatus==='failed' rows, so the STATE-01b amber + failed-send placeholders can never collapse even if an empty temp row were somehow directly adjacent."

requirements-completed: [STATE-04]

# Metrics
duration: ~18min
completed: 2026-07-22
---

# Phase 174 Plan 04: STATE-04 Workflow-Run Timer Anchor + Single Avatar Summary

**Navigating back into a streaming workflow run no longer lies about elapsed time or shows two avatars: the kickoff placeholder now carries a stable `startedAt` so the 095.1 RunCard timer keeps climbing on remount, and `dedupMessagesByRunId` collapses the same-send pre-runId double-mount twin to one avatar — without ever erasing the STATE-01b amber (blockedNotice) bubble or a failed-send placeholder.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-07-22T17:32:00Z (approx, plan load)
- **Completed:** 2026-07-22T17:50:00Z
- **Tasks:** 2 (both `tdd="true"`)
- **Files modified:** 6 (2 source, 4 test); 0 created

## Task-1 Wave-0 Confirmation (which branch fired)

**PRIMARY path — RunCard-only. No separate-strip edit.**

Confirmed by reading the live source this session:
- `MessageItem.tsx:437` gates `<RunCard>` on `message.tool_calls && message.tool_calls.length > 0`. A workflow/harness run in chat accumulates Deep tool calls, so the run-receipt renders through **RunCard** (the `tool_calls>0` gate) — resolving RESEARCH Open Q4 / A3.
- `RunStatusStrip.tsx` is **purely presentational**: it receives `elapsedLabel` as a prop (computed by RunCard) and owns **no independent timer** (its own header comment confirms "computed in RunCard"). It merely renders the segment markup.
- `RunCard.tsx:122` (`runStartMs = message.startedAt ? Date.parse(message.startedAt) : Date.parse(message.created_at)`) is the already-correct Phase-095.1 consumer.

**Therefore:** STATE-04 timer completeness is satisfied by the kickoff `startedAt` stamp (the SOURCE) + the unedited RunCard consumer. `RunStatusStrip.tsx` was left out of the diff entirely; the conditional `npm test -- RunStatusStrip` fallback branch **did not fire** (no separate strip owns the workflow timer), so it was not run.

## Accomplishments

- **Task 1 (timer, `21b9a734`):** Added `startedAt: new Date().toISOString()` to the kickoff `m.id === assistantId` branch (`StreamsProvider.tsx:~1859-1868`) alongside the existing runId/model/provider stamp. The kickoff POST carries no `started_at` (verified :1807-1818), so client send-time is the anchor; the persisted `runs.started_at` enrich (`api.ts started_at→startedAt`) corrects any drift on the next hydrate. Extended `RunCard.timer.test.tsx` with test **(g)**: a streaming run with an old `startedAt` + a remount-fresh `created_at` derives elapsed from the anchor (~300s), not a mount-reseed (~0). 49/49 RunCard tests green.
- **Task 2 (avatar, `bcdc9962` RED → `31e8275d` GREEN):** Added `isCollapsiblePreRunPlaceholder` to `dedupMessages.ts` and a scoped collapse at the `if (!runKey)` seam: two ADJACENT empty `temp-`/no-runId assistant rows (no intervening user row) collapse to one, keeping the first. The predicate excludes `blockedNotice` rows and `runStatus === "failed"` rows. Extended three test files (dedup unit, MessageList render, reconcile-race render-seam) with the same-send POSITIVE case, the MANDATORY amber/failed-survives REGRESSION, and the genuine-harness/adjacency negatives.

## Task Commits

Each task committed atomically:

1. **Task 1: startedAt kickoff stamp + RunCard timer test (g)** — `21b9a734` (feat)
2. **Task 2 RED: failing same-send dedup + amber/failed-survives regression tests** — `bcdc9962` (test)
3. **Task 2 GREEN: same-send pre-runId avatar collapse in dedupMessagesByRunId** — `31e8275d` (feat)

## Files Modified

- `frontend/src/providers/StreamsProvider.tsx` — kickoff placeholder now stamps `startedAt` (additive, alongside runId/model/provider).
- `frontend/src/lib/dedupMessages.ts` — new `isCollapsiblePreRunPlaceholder` predicate + scoped same-send twin collapse in the `!runKey` branch.
- `frontend/src/components/chat/RunCard.timer.test.tsx` — test (g), the nav-back anchor contract-lock.
- `frontend/src/lib/__tests__/dedupMessages.test.ts` — `STATE-04 pre-runId same-send twin` describe: positive collapse, 2 mandatory regressions (amber + failed), defensive both-sides guard, user-row-between negative, harness-real-id negative, lone-placeholder pass-through.
- `frontend/src/__tests__/components/chat/MessageList.dedup.test.tsx` — render-level single-avatar positive + amber/new-placeholder both-survive regression.
- `frontend/src/__tests__/providers/streamsProvider_075_7_reconcile_race.test.tsx` — pre-runId double-mount collapses to one avatar at the render seam while amber + harness rows survive.

## Verification

- Plan verification command — `npx vitest run RunCard dedupMessages.test.ts streamsProvider_075_7_reconcile_race MessageList.dedup` → **7 files / 72 tests green**.
- Task 2 file-scoped — `dedupMessages.test.ts streamsProvider_075_7_reconcile_race MessageList.dedup` → **23/23 green** (includes the same-send POSITIVE, the MANDATORY amber/failed-survives REGRESSION, and the existing rows-without-runId + user-row negatives).
- **RED→GREEN proven:** at RED the 3 collapse tests failed (twin not yet collapsed) while the amber/failed survive-regressions already passed; at GREEN all 23 pass.
- **Differential vs SEED-056 rot (0 net-new):** the broader G-5 sweep surfaced 3 failures — `StreamsProvider.dedup.test.ts` (2: tool-call reducer `D-075.2-01`/`D-075.2-04`) and `useMessages.test.ts` (1: reconcile switch-back). Both files were run against the ORIGINAL (pre-Task-2) `dedupMessages.ts` and failed identically; neither test references `dedupMessagesByRunId`. These are pre-existing SEED-056 rot, not caused by this plan. Every touched-file test is green.

## Decisions Made

Beyond the frontmatter key-decisions, the one implementation choice within Claude's discretion: **option (b) pure-dedup adjacency** was selected over the plan's PREFERRED option (a) insert-seam guard. Rationale: option (b) lives at the single shared bucket-read seam (`dedupMessagesByRunId`, consumed by both MessageList and useDerivedPanel), is a pure/deterministic function that makes the mandatory regression trivially testable, and avoids editing the StreamsProvider reconcile-insert path — which carries the 075.7 race-fix and is the higher-risk surface. The plan explicitly sanctions option (b) ("restrict to ADJACENT temp/no-runId assistant rows with NO intervening user message"). The scoping constraint (never a blind any-two-temp-rows rule) is honored via BOTH the `blockedNotice`/`failed` predicate exclusion AND the adjacency rule (a genuinely different send always inserts a user row between its placeholders).

## Deviations from Plan

None — plan executed as written. `RunStatusStrip.tsx` (pre-declared conditional in `files_modified`) was correctly left untouched because the PRIMARY RunCard-only branch fired. No auto-fixes were required (Rules 1-3 did not fire); no architectural decisions surfaced (Rule 4 did not fire).

## Known Stubs

None — both fixes are wired end-to-end (the `startedAt` stamp flows into the live RunCard timer derivation; the dedup collapse operates on the real bucket at the MessageList render seam). No placeholder/mock data.

## Threat Flags

None — no new security surface beyond the plan's `<threat_model>`. This is a pure render/reconcile fix + an additive display-only client timestamp over already-authoritative run data. No new endpoint, input, auth, or persistence; no backend change, no migration (D-14). Per-thread keying is preserved (the dedup operates on a single thread's bucket; `startedAt` is stamped on the owning thread's placeholder) — T-174-04-01 (cross-thread bleed) holds; T-174-04-02 (client anchor drift) is display-only and self-correcting via the persisted enrich.

## User Setup Required

None — render-layer-only change (no backend edit, no migration, no env var). Live cross-provider UAT (multi-minute streaming workflow → nav away and back on a fast + a slow provider → timer continues + exactly one avatar; plus the STATE-01b cross-check that a killed-workflow amber bubble + a fresh same-thread send keep BOTH visible) is owed at `/gsd:verify-work` per `174-VALIDATION.md`.

## Next Phase Readiness

- STATE-04 (BUILD) is complete under test. The workflow-run chat surface no longer reseeds its timer or double-mounts its avatar; the run-lifecycle surface that Plans 175/176/178 render on is one step more honest and stable.
- The full-suite differential (`cd frontend && npm test`, no NEW failures vs the SEED-056 rot baseline) is the phase-gate concern for `/gsd:verify-work`; the per-task file-scoped + adjacent-G-5 differentials done here show 0 net-new failures.

## Self-Check: PASSED

All 6 modified files exist on disk; all 3 task commits (`21b9a734`, `bcdc9962`, `31e8275d`) are present in git history. The plan verification command is green (72/72). RunStatusStrip.tsx correctly absent from the diff (PRIMARY branch).

---
*Phase: 174-run-state-lifecycle-honesty*
*Completed: 2026-07-22*
