---
gsd_state_version: 1.0
milestone: v2.7
milestone_name: Milestone Context
status: executing
stopped_at: Phase 087 Plan 04 complete
last_updated: "2026-05-29T01:30:00.000Z"
last_activity: 2026-05-29 -- Phase 087 Plan 04 (version diff viewer, PANEL-07) executed
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 20
  completed_plans: 18
  percent: 90
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-27) + .planning/PRDs/v2.7.md (drafted 2026-05-12, scoped to Themes A+C+D+H for v2.7)

**Core value:** The agent acts as an AI colleague -- it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared
**Current focus:** Phase 086 — streamsprovider-extension-panel-hooks

## Current Position

Phase: 087 (panel-ui) — IN PROGRESS
Plan: 3 of 5 complete (Wave 0 foundation + Wave 2 file browser + Wave 2 version-diff shipped)
Status: Ready to execute remaining Wave 2 plan (087-05 pending-ask + seam) and Wave 3 (087-02 panel shell)
Carry-forward into 087 verification: re-run the deferred 086 UAT item (rapid thread-switch reconcile-abort) live once the panel hooks are mounted (unit-tested FC#5 in the interim). FilePreview + VersionDiff both use AbortController on (threadId, file.id[, pair]) change — real consumers for that abort path.
Last activity: 2026-05-29 -- Phase 087 Plan 04 (version diff viewer, PANEL-07) executed

Progress: [██████░░░░] 60% (3/5 plans)

## Performance Metrics

**Velocity:**

- Total plans completed: 20 (v2.7)
- Prior milestones: v2.6 shipped 91 plans in 16 days (~5.7 plans/day)
- Average duration: ~12min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 083 | 3 | - | - |
| 084 | 5 | - | - |
| 085 | 5 | - | - |

**Recent Trend:**

- Last 5 plans: (from v2.6 close)
- Trend: Stable

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- (v2.7 roadmap): 6 phases derived from 22 requirements; research consensus confirmed build order
- (v2.7 roadmap): G-5 mandated -- threads.py extraction is Phase 083, prerequisite for all new tools
- (v2.7 roadmap): G-2 fires for Phase 087 (Panel UI) -- sketch-before-plan mandatory
- (v2.7 research): ask_user requires Redis pub/sub for cross-worker safety (asyncio.Event fails with WORKER_COUNT=2)
- (083-03): Kimi thinking filter uses state-machine with _in_think_block; provider-gated on moonshot + deepseek
- (083-03): _SINGLE_MODEL_PROVIDERS frozenset classifies provider tiers for title gen model routing
- (087-01): Sheet bottom-sheet hand-authored on installed @radix-ui/react-dialog (side=bottom) — NOT npx shadcn add sheet (avoids vaul); zero new dependency (A3)
- (087-01): --warning-foreground darkened to deep-midnight ink (240 60% 8%) for ≥4.5:1 on amber bg (UI-SPEC), rather than lightening text
- (087-01): WorkspaceFileContent is a discriminated union over storage_type (inline|bucket) so Plan 03 preview routing is type-safe
- (087-01): Wave 0 panel tests are GREEN-only it.todo() contracts (52) mapped to VALIDATION per-req map; each downstream plan flips its own todos to live tests
- (087-03): ShikiCode reused for code preview (A1) — UI-SPEC's literal react-syntax-highlighter is superseded; RSH stays unused, no new dep
- (087-03): CsvTablePreview is a hand-rolled quote-aware splitter (no CSV lib, D-01); malformed/ragged/≥2000-rows/>256KB all short-circuit to the calm fallback before DOM build (T-087-07)
- (087-03): fileFlash added as an index.css @keyframes + .animate-fileFlash utility (prefers-reduced-motion guarded), mirroring brandPulse/checkPop — no Tailwind config change
- (087-04): unified-diff parsed CLIENT-SIDE via pure parseUnifiedDiff (no diff lib, SC#3) — backend already emits the difflib string; Unicode minus (U+2212) for del signs per UI-SPEC
- (087-04): shared DiffLines presentational renderer (5th file beyond the plan's 4) so VersionDiff in-column diff + DiffExpandOverlay wide diff share one render path; ⤢ overlay reuses the SAME parsed payload — no second fetch (D4)
- (087-04): VersionDiff defaults to latest-two (Compare v{n-1}<->v{n}); red-base/green-target pills carry text+aria (base/target version N), not color-only

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 085 `ask_user` tool has the highest implementation risk in the milestone -- Redis pub/sub cleanup path needs explicit decision records during planning
- Phase 087 Panel UI requires sketch approval (G-2) before planning can begin
- Tool count budget: 16 existing + ~8 new = ~24 total; Google warns >20; consolidation into fewer tools with action parameters recommended during Phase 084/085 planning

### Phase 086 surface note — BUG-260528-01 fix (2026-05-28, commit 7d2b3d2)

Surfaced for Phase 086 (streamsprovider-extension-panel-hooks), which touches the same snapshot/reconcile/message-list surface:

- **What was fixed:** `GET /threads/{id}/snapshot` and `/messages` now filter `role='system'` rows (`.neq("role","system")`). Phase 085's `ask_user` tool persists prompt/response as durable `role='system'` rows (migration 048), but `MessageResponse.role` is `Literal["user","assistant"]` — serializing a system row raised `ResponseValidationError` → **500, thread won't load**. Regression guard added in `test_075_snapshot.py`.
- **Constraint for 086:** any reconcile/snapshot/message-list change MUST preserve this filter, or threads with ask_user history 500 on load again. The `panel.py` `/pending` query (raw asyncpg, scans system rows directly) is the separate path and is unaffected.
- **OPEN FOLLOW-UP for 086 to decide:** answered ask_user Q&A turns are NOT rendered in reloaded conversation history (no frontend renderer for `tool_calls[].kind='ask_user_*'`; `/pending` only surfaces *unanswered* prompts). If reloaded ask_user history should be visible to the user, Phase 086 owns building that renderer (+ widening the wire model) rather than filtering. See `.planning/reported-bugs/snapshot-500-on-system-role-askuser-rows.md`.
- Also cleaned 2026-05-28: 7 ask_user test-fixture threads purged from dev DB; 8 stale git worktrees pruned.

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260529-0sc | Fix Phase 086 WR-04: persist panel todo/task Maps to localStorage write-path (closes the sole blocking gap from 086-VERIFICATION.md) | 2026-05-28 | 62c1cf0 | [260529-0sc-fix-phase-086-wr-04-persist-panel-todo-t](./quick/260529-0sc-fix-phase-086-wr-04-persist-panel-todo-t/) |
| 260529-1wb | Fix BUG-260529-01: write_todos crashes on stringified `todos` arg — json.loads coercion + isinstance guards so weak/OpenRouter models get a self-correcting error instead of a crash loop (RED→GREEN regression test) | 2026-05-28 | c756522 | [260529-1wb-fix-bug-260529-01-write-todos-crashes-on](./quick/260529-1wb-fix-bug-260529-01-write-todos-crashes-on/) |

## Deferred Items

Items carried forward from v2.6 milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Phase | 082.5 Error Handler Foundation (SEED-026 slice) | Deferred to v2.7+ | v2.6 close |
| Dormant seed | SEED-002 Skill Studio Milestone Preparation | Dormant | v2.5 |
| Dormant seed | SEED-003 Deployment Flexibility & Install/Config UX | Dormant | v2.5 |
| Dormant seed | SEED-004 Org / Department / Role Multi-Tenancy | Dormant | v2.5 |
| Dormant seed | SEED-005 Document Management Capabilities | Dormant | v2.5 |
| Quick tasks | 11 pre-GSD micro-tickets (260322..260412) | Unknown | v2.5 |
| UAT cosmetic | 15 HUMAN-UAT status fields not flipped | Cosmetic only | v2.6 close |
| Verification | 10 verification gaps with project approval | Accepted | v2.6 close |

## Session Continuity

Last session: 2026-05-29T01:30:00.000Z
Stopped at: Completed 087-04-PLAN.md (version diff viewer, PANEL-07)
Resume file: None — ready for remaining 087 plans (087-05 pending-ask + seam, 087-02 panel shell)

**Planned Phase:** 085 (new-llm-tools) — 4 plans — 2026-05-28T11:29:12.000Z
