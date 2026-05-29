---
gsd_state_version: 1.0
milestone: v2.7
milestone_name: Milestone Context
status: executing
stopped_at: Completed 087-07 (surface contrast + Chrome-MCP layout gate — 004-panel-shell verified); authored gap plan 087-08 (single nav-style toggle consolidation + full live design-contract + cross-provider UAT) — awaiting operator go-ahead to execute
last_updated: "2026-05-29T08:21:39.408Z"
last_activity: 2026-05-29 -- Phase 087 Plan 07 finalized at layout gate; gap plan 087-08 authored
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 23
  completed_plans: 22
  percent: 96
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-27) + .planning/PRDs/v2.7.md (drafted 2026-05-12, scoped to Themes A+C+D+H for v2.7)

**Core value:** The agent acts as an AI colleague -- it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared
**Current focus:** Phase 086 — streamsprovider-extension-panel-hooks

## Current Position

Phase: 087 (panel-ui) — 7 of 8 plans complete (087-08 authored, awaiting operator go-ahead to execute)
Plan: 087-07 complete (surface contrast gaps 5/6 + orchestrator-driven Chrome-MCP gate)
Status: Plan 06 (layout re-arch) + Plan 07 (contrast tokens) shipped. The 004-panel-shell layout contract was VERIFIED live via Chrome MCP (no overflow, flush-right, stable left edge 1088 across threads, mobile bottom-sheet intact, surface contrast distinct both themes). The Plan 07 gate surfaced one gap-d miss (persistent reopen toggle absent on the empty/welcome screen) and — per operator decision 2026-05-29 — the three feature contracts (005 file/diff, 006 ask_user, 007 seam) + the mandatory cross-provider scoreboard were wrongly deferred and are now PROMOTED into gap plan 087-08, alongside a toggle-consolidation rework. **087-08 directive:** ONE workspace toggle, inside the panel, mirroring NavPanel — collapse-to-rail (drop the fully-hidden state + the redundant chat-header toggle); the always-present rail closes gap-d (reopen-by-mouse on every thread incl. welcome) and hosts the pulsing-amber-dot.
Next: operator go-ahead → /gsd:execute-phase 087 --gaps-only (runs 087-08): Wave 1 = gsd-executor toggle consolidation (ChatLayout/WorkspacePanel/PanelRail/ChatArea + tests + panel-shell.md contract); Wave 2 = orchestrator-driven blocking Chrome-MCP gate over 004/005/006/007 + PANEL-02 + cross-provider 4-axis scoreboard (seed live runs — no deferrals). Then verify + complete 087.
Downstream: Phase 088 (E2E reload flow) is load-bearing on the 007 seam — 087-08's seam-reload verification de-risks it.
Last activity: 2026-05-29

Progress: [█████████░] 95% (21/22 plans)

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
| 087 | 5/5 | - | ~8min (087-02) |

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
- (087-05): A2/Pitfall-1 resolved concretely — Send Answer gated on (pick OR type) AND run_id!=null; pure-SSE prompt (no run_id) triggers reconcile-if-missing + shows "Preparing…"; NEVER POSTs without a reconciled run_id (would 404)
- (087-05): answer flow is optimistic-then-reactive — optimistic green .answered on 200, then ask_user_response SSE removes the prompt from the store → card unmounts + run un-pauses (D4)
- (087-05): seam mode signal reuses per-message runStatus==='streaming' (live=pointer/cue, terminal/rehydrated=card) — no new global state; D-05 single source of truth (live in panel, history in transcript)
- (087-05): SeamCard closes the documented ask_user reload gap (answered Q&A in chat on reload) — the OPEN FOLLOW-UP the Phase 086 surface note flagged
- (087-05): seam open handlers (onSeePanel/onOpenPanel) left as optional unwired props — Plan 02 panel shell owns the panel-open action and wires them; renderers degrade to no-op click until then
- (087-05): MessageItem seam mounts are PURELY additive (102 insertions / 0 deletions); RunCard call shape preserved; BUG-260529-02 surface untouched (G-5)
- (087-02): seam open handlers wired via a module-level event bus (panelOpenSignal — subscribeOpenPanel/requestOpenPanel) instead of re-plumbing onSeePanel/onOpenPanel through MessageList→ChatArea; keeps the G-5 MessageItem change to 6 ins / 0 del and carries no thread data (PANEL-06 / T-087-17 safe)
- (087-02): WorkspacePanel state machine — header button CYCLES open→rail→hidden→open; ⌘./Ctrl+. TOGGLES open↔hidden; rail icon / seam pointer EXPANDS to open
- (087-02): push/split grid lives INSIDE WorkspacePanel's own aside (Pitfall 3 — live ChatLayout is flex not grid); ChatLayout mount is one additive sibling gated on activeView==='chat' (6 ins / 0 del)
- (087-02): mobile (<768px) detected via window.innerWidth + resize (not matchMedia — jsdom-safe); body renders inside the Plan-01 Radix-Dialog Sheet
- (087-02): the fixed-order 'Pending question' slot is satisfied by PendingAskStack PINNED at the very top (087-05 contract), not an extra empty accordion section — avoids the empty-tax the short-circuit forbids
- (087-06): the chat|panel split is now ONE ChatLayout-level CSS grid (1fr | clamp(300-420px)/52px/0) — Pitfall-3 self-referential aside-grid (where 30% collapsed to its 300px floor) REVERSED in favor of panel-shell.md D1; the panel column resolves against the real row width so 1fr+clamp always sums to the row → zero horizontal overflow + flush-right panel + chat centers in its own 1fr column (closes gaps 1 & 7)
- (087-06): WorkspacePanel is now CONTROLLED (state/onCycle/onExpand/onHide props); the open/rail/hidden state machine, the ⌘./Ctrl+. listener, and subscribeOpenPanel(expand) lifted UP to ChatLayout so the persistent chat-header toggle + the seam pointer drive the same state (closes gap 3 — hidden panel reopenable by mouse)
- (087-06): pulsing-amber-dot ask_user-pending indicator on the chat-header toggle computed in ChatLayout via useAskUserPrompt(useViewingThread()) — workspacePending = pending.length>0 && state!=='open'; motion-safe:animate-pulse honors prefers-reduced-motion, no new store (closes gap 4 / PANEL-01)
- (087-06): DevTwoPaneMock import+mount removed from production App.tsx (file retained for dev); T-087-06-01 info-disclosure mitigated (closes gap 2)

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

Last session: 2026-05-29T01:50:00.000Z
Stopped at: Completed 087-02-PLAN.md (panel shell + composition capstone, PANEL-01/PANEL-02) — all 5 plans of Phase 087 done
Resume file: None — Phase 087 fully composed; next is /gsd:verify-work 087

**Planned Phase:** 085 (new-llm-tools) — 4 plans — 2026-05-28T11:29:12.000Z
