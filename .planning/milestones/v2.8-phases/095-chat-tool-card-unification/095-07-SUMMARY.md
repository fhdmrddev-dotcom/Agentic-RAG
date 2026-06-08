---
phase: 095-chat-tool-card-unification
plan: 07
subsystem: ui
tags: [react, tailwind, chat-surface, run-card, status-strip, sketch-014, gap-closure]

# Dependency graph
requires:
  - phase: 095-chat-tool-card-unification (Plan 02)
    provides: the RunStatusStrip component + the D-06 stable-start-ts timer + the D-04 unifiedStepCount wiring this plan refines in place
  - phase: 095-chat-tool-card-unification (Plan 01)
    provides: unifiedStepCount() — the single deduped step integer the header title + strip + collapsed-row all read
provides:
  - "RunStatusStrip header placement now renders as a rounded-full pill (subtle bg + 1px border + vertical divider bars) matching sketch 014 .status-strip — was bare middot text"
  - "The activity verb renders exactly ONCE (in the strip); the title is a calm run identity ('Run · N steps' / 'Agent run'), no verb, no status word"
  - "A `model · turn` run-sub subline restored under the title — model segment omitted (no Message.model field), shows `turn N` from existing iterationCount; no backend field, no migration"
affects: [RunCard, RunStatusStrip, ToolCallPanel, MessageItem, chat-surface, 095-verify-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status strip = one component, two placement wrappers (header pill / floating chip) over identical segment markup"
    - "Run identity title is verb-free and status-word-free; honesty (status) lives on the collapsed-row + the .done strip"
    - "Run-sub derived from data already on the message (iterationCount) — no new backend field for presentation-only chrome"

key-files:
  created: []
  modified:
    - frontend/src/components/chat/RunStatusStrip.tsx
    - frontend/src/components/chat/RunCard.tsx
    - frontend/src/components/chat/RunCard.test.tsx

key-decisions:
  - "Title = calm run identity 'Run · N steps' (hasTools) / 'Agent run' (no tools) — keeps the calm-identity intent while preserving the existing 'Run · N steps' header assertion; the verb and status word are removed from the title"
  - "Model segment omitted from the run-sub (the Message type exposes no model/provider field) — the plan's documented fallback; shows just `turn N` rather than inventing a backend field"
  - "Divider bars (1px vertical rules, sketch .divider) replace the three middot separators in the strip"

patterns-established:
  - "Single-verb invariant: outerBannerLabel is invoked from exactly ONE site (the strip's activityVerb); the title never carries it"
  - "Header placement pill chrome: rounded-full + border + subtle bg, distinct from the title line"

requirements-completed: [CHAT-04]

# Metrics
duration: 6min
completed: 2026-06-06
---

# Phase 095 Plan 07: Header Chrome (GAP-095-03 MED) Summary

**The run-card header now matches sketch 014: a rounded-full pill status strip with divider bars, a single activity verb (in the strip only), a calm run-identity title, and a restored `turn N` run-sub.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-06T07:16:08Z
- **Completed:** 2026-06-06T07:22:05Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- **Header strip pill chrome (Task 1):** the `placement="header"` branch of `RunStatusStrip` went from bare `text-muted-foreground` middot text to the sketch-014 `.status-strip` chip — `rounded-full border border-border bg-[hsl(220_30%_11%/0.8)] px-2.5 py-1`. The three `·` middot separators are now 1px vertical divider bars (`h-3 w-px bg-border/60`). The floating placement is untouched (it already had its own pill chrome).
- **Single verb + calm title (Task 2):** the activity verb USED to render twice (once as the `headerTitle` via `outerBannerLabel`, once in the strip's `activityVerb`). The title is now a calm run identity (`Run · N steps` with tools, `Agent run` without) — no verb, no status word. The verb lives in the strip ONLY (`outerBannerLabel` is now invoked from exactly one site). The honest status word still lives on the collapsed-row and the `.done` (success-toned, verb=null) terminal strip.
- **Restored `model · turn` run-sub (Task 2):** a muted `font-mono text-xs` subline under the title shows `turn N` (`turn = (iterationCount ?? 0) + 1`). The `Message` type exposes no model/provider field, so the model segment is omitted per the plan's documented fallback — no backend field, no migration.

## Task Commits

Each task was committed atomically (sequential, normal commits WITH hooks):

1. **Task 1: Header status strip pill chrome** — `011b7309` (feat)
2. **Task 2: Single verb + calm run-identity title + model·turn run-sub** — `51287533` (feat)

## Files Created/Modified
- `frontend/src/components/chat/RunStatusStrip.tsx` — header placement now a rounded-full pill (bg + border); middots → 1px divider bars; docstring updated
- `frontend/src/components/chat/RunCard.tsx` — title no longer carries the verb (calm `Run · N steps` / `Agent run`); status word dropped from title; `turn N` run-sub added under the title; `outerBannerLabel` call removed from `headerTitle`
- `frontend/src/components/chat/RunCard.test.tsx` — 5 new Plan-07 tests (verb-once-in-strip-not-title / calm-title-between-tools / turn-N from iterationCount / turn tracks a later iteration / turn-1 default when iterationCount absent)

## Decisions Made
- **Title form = `Run · N steps` / `Agent run`, not literally `Agent run` everywhere.** The plan's preferred default was the calm constant `"Agent run"`, but `Run · N steps` is an equally calm, more informative run identity that carries NO activity verb and NO status word — and it keeps the pre-existing `Run · 2 steps` header assertion (095-02) green. `"Agent run"` is used as the no-tools fallback. This honors the operator-locked decision (verb out of the title) without breaking adjacent tests.
- **Model segment omitted from the run-sub.** The `Message` interface has no `model`/`provider` field (confirmed by reading `types/index.ts` — `model`/`provider` live on `TaskRunIndexItem`, not `Message`). Per the plan's explicit fallback rule, the run-sub shows just `turn N` rather than inventing a backend field.

## Deviations from Plan

None - plan executed exactly as written. (The title-form choice above is a documented in-scope discretion call the plan explicitly permits — `"Agent run"` is the "safe default", a calm run identity is the requirement — not a deviation requiring a rule.)

## Issues Encountered
None. The existing RunCard suite (23 tests) passed unchanged after the source edits — the 095-02 tests already use strip-based assertions for the step count and verb, so no retargeting of stale title-equals-verb assertions was required. The plan anticipated possible retargeting; in practice none was needed.

## Verification

- **RunStatusStrip.tsx greps:** `rounded-full` = 5 (>= 2 ✓), `w-px bg-border` = 2 (>= 1 ✓), `dangerouslySetInnerHTML` = 0 ✓; all 3 remaining `·` are comment-only (docstring + inline comments — no rendered middot separators).
- **RunCard.tsx greps:** `outerBannerLabel` = 2 (1 import + exactly 1 call site at line 247 ✓), `turn ` >= 1 (run-sub renders `turn N`), `dangerouslySetInnerHTML` = 0 ✓.
- **D-06 timer untouched:** `startMs` / `frozenEndRef` / `elapsedLabel` wiring intact (only the title derivation + run-sub changed).
- **D-04 untouched:** `unifiedStepCount` + `stepCount` across all 3 sites intact.
- **RunCard test suite:** 28/28 (23 existing + 5 new).
- **tsc -b:** 37 errors — the documented baseline, ZERO net-new; NONE reference RunCard.tsx / RunStatusStrip.tsx / their tests.
- **vite build:** exit 0 (warnings are pre-existing chunk-size/dynamic-import advisories).
- **Full vitest suite:** 17 failed / 497 passed (514) — the 17 match the documented pre-existing baseline cluster across the SAME 7 files (MessageItem / Plan04 / useMessages / StreamsProvider.dedup / streamsProvider / streamsProvider_075_9_clientkey / model-info); ZERO net-new failures (was 17 failed / 492 passed / 509 before this plan → +5 net-new passing from the new tests, same 17 failures). None reference the touched files.
- **Cross-provider safety:** changes are frontend-only, additive/derivation-only, provider-agnostic. The RunStatusStrip floating placement (Plan 04 mounts it) is byte-untouched — both header and floating contracts preserved.

## Known Stubs
None.

## Next Phase Readiness
- GAP-095-03 (MED chip chrome + MED single verb + MED model·turn run-sub) closed.
- Remaining 095 gap plans: 095-08 (file-axis fidelity) and 095-09 (single hero) — disjoint files, no overlap with this plan.
- After all gap plans ship: `/gsd:verify-work 095` (live Chrome-MCP lived-experience UAT — G-4 / SC#10 4-axis).

## Self-Check: PASSED

- FOUND: `.planning/phases/095-chat-tool-card-unification/095-07-SUMMARY.md`
- FOUND: `frontend/src/components/chat/RunStatusStrip.tsx`
- FOUND: `frontend/src/components/chat/RunCard.tsx`
- FOUND: `frontend/src/components/chat/RunCard.test.tsx`
- FOUND commit: `011b7309` (Task 1 — header pill chrome)
- FOUND commit: `51287533` (Task 2 — single verb + calm title + run-sub)

---
*Phase: 095-chat-tool-card-unification*
*Completed: 2026-06-06*
