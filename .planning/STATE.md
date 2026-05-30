---
gsd_state_version: 1.0
milestone: v2.7
milestone_name: Milestone Context
status: executing
stopped_at: Completed 088-05-PLAN.md (verification capstone — phase 088 ALL 5 plans done)
last_updated: "2026-05-30T08:05:15.301Z"
last_activity: 2026-05-30
progress:
  total_phases: 6
  completed_phases: 6
  total_plans: 28
  completed_plans: 28
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-27) + .planning/PRDs/v2.7.md (drafted 2026-05-12, scoped to Themes A+C+D+H for v2.7)

**Core value:** The agent acts as an AI colleague -- it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared
**Current focus:** v2.7 build COMPLETE (all 6 phases 083-088 shipped) — next is `/gsd:verify-work 088` then `/gsd:complete-milestone`

## Current Position

Phase: 088 (cross-cutting-verification-accessibility) — ✅ COMPLETE (all 5 plans, all 3 waves shipped 2026-05-30)
Plan: 5 of 5 done — 088-05 (Wave 3 capstone) DONE
Status: Phase 088 verification gate COMPLETE — v2.7 at 28/28 plans (100%). Ready for `/gsd:verify-work 088` → then milestone close-out (`/gsd:complete-milestone`).
Next: Run `/gsd:verify-work 088` to confirm the phase, then close v2.7 (`/gsd:complete-milestone`). v2.8 carries the deferred items: Google secondary-model 404 routing artifact; per-provider task/ask_user gaps a universal text directive did not close (eval script `scripts/eval_cross_provider.py` is the v2.8 harness seed, D-08); 087 deferrals SEED-037 (office/PDF in-panel viewing + download), SEED-038 (artifacts unification), SEED-039 (panel reliability/fast-switch race).
✅ 088-05 (Wave 3, verification capstone, checkpoint:human-verify) DONE 2026-05-30 — operator felt pass "approved". 088-VALIDATION.md filled: 4-axis cross-provider UAT scoreboard 6/6 PASS (OpenAI/Anthropic/Google(3.5) LIVE via Chrome MCP multi-tool write_todos+workspace_write+ask_user; OpenRouter/DeepSeek/Moonshot via the 088-04 6×4 eval multi-tool rows; parallel-thread PASS — Thread A streaming while Thread B composer+Send stayed enabled, the 075.3 global-isStreaming guard held, zero bleed; long-message PASS — 5321-char ≈5.2KB prompt round-tripped full-text no-truncation; gemini-2.5 provenance-only D-03). a11y: REAL rendered contrast FIXED both themes (dark 7.21:1 / light 4.66:1 after 6b5da2cf, was 3.59:1/4.01:1) + global :focus-visible ring + full keyboard-only walk + operator lived G-4 pass. Deep workspace flow verified LIVE no-refresh on Anthropic+Google (write→v2→VIEW DIFF→ask_user→respond→resume). D-17 gemini-3 thought_signature CLOSED-as-verified (Google axis CLEAN, zero 400; facts.md→v2 proves 2 sequential tool rounds echoed the signature; 075.4 Stage-4 hotfix holds; verified_closed_by: 088). 3 UAT blockers fixed in-088 under D-16 (all additive/panel-scoped, re-verified live): 7f650da0 workspace file-id in SSE (deep-flow 404 blocker), 6b5da2cf panel AA contrast tokens both themes (global tokens untouched), b0b8d735 todo status colors. nyquist_compliant: true; A11Y-01/02 signed off. Transient 503-on-snapshot + page-scroll-during-HMR recorded as non-issues (not reproducible / not code regressions).
✅ 088-04 (Wave 2, SEED-034 fold-gate) DONE 2026-05-30 — VERDICT FOLDED: text-only universal write_todos + ask_user directive folded into threads.py:336 SYSTEM_PROMPT + openai_service tool descriptions (2f6e2523, TASK_TOOL untouched, no tool_choice forcing); AFTER 6×4 re-run = condition-b MET (OpenAI/Anthropic/OpenRouter `multi-tool` write_todos FAIL→PASS) + condition-c MET (Moonshot `task` FAIL proven sampling variance — re-confirmed PASS) + condition-a git-diff-proven text-only; eval extended 4→6 providers (added native deepseek+moonshot). Wave 1 recap: 088-01 vitest-axe gate + global focus ring + 2 aria-live + FilesSection aria-selected (89/89 panel tests); 088-02 `scripts/eval_cross_provider.py` (687 lines, localhost-gated, real-route, secret-safe); 088-03 `scenario-13-workspace-deep-flow.spec.ts` (294 lines, Anthropic+Google, no-refresh, 400-toEqual([]) D-17 check).
Downstream: v2.7 Agent Workspace & Panel milestone COMPLETE on the build side (all 6 phases 083-088 shipped); next administrative step is verify + milestone close.
Last activity: 2026-05-30

Progress: [██████████] 100%

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

| Phase 088 P088-01 | 13min | 3 tasks | 15 files |
| Phase 088 P088-02 | 6min | 2 tasks | 1 files |
| Phase 088 P088-03 | 3min | 2 tasks | 1 files |
| Phase 088 P088-04 | 75min | 3 tasks | 4 files |
| Phase 088 P088-05 | 1h 40m | 3 tasks | 2 files |

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
- (088-01): vitest-axe (NOT jest-axe) wired as the structural-a11y matcher — runner is Vitest 4.1.0; D-13's jest-axe was the wrong binding (RESEARCH correction #2)
- (088-01): global :focus-visible ring added to index.css @layer base via zero-specificity :where(...) — a floor, not an override (components with their own focus-visible:ring-* still win)
- (088-01): A11Y-01/02 structurally GREEN + axe-gated on all 8 panel components (89/89), no component restructure needed (no D-09 SEED); contrast/focus-ring real-verification deferred to Plan 05 Chrome MCP Lighthouse (Pitfall 5)
- (088-02): cross-provider eval script switches provider via the per-request MessageCreate.provider/model override (threads.py:1285), NOT a persistent user_settings UPDATE — measures the REAL active_system_prompt (Pitfall 2) with zero global-state mutation
- (088-02): scripts/eval_cross_provider.py is the SEED-034 fold-gate evidence source (D-05) — greppable EVAL_ROW/EVAL_SUMMARY scoreboard; Plan 04 re-runs it before/after a text-only prompt change to prove +1 failing model passes / 0 strong regressions. Authored here, run LIVE in Plans 04/05 (operator backend)
- D-088-03: scenario-13 deep-flow E2E uses assert-then-expand to open the default-open panel (never the blind ⌘./Ctrl+. toggle) and selects the diff by aria-label '^=Diff v' to disambiguate from the PanelSection region bodies; built REUSE-AND-EXTEND on scenario-02 + 3 fixtures, parameterized over Anthropic + Google, with zero-400 toEqual([]) on both axes (D-17).
- (088-04): SEED-034 VERDICT = FOLDED — text-only universal write_todos + ask_user directive kept at 2f6e2523; AFTER 6x4 eval = condition-b MET (OpenAI/Anthropic/OpenRouter multi-tool write_todos FAIL->PASS) + condition-c MET (zero fold-attributable regression; Moonshot task FAIL is sampling variance, re-confirmed PASS) + condition-a git-diff-proven text-only (TASK_TOOL untouched, no tool_choice forcing)
- (088-04): eval PROVIDERS extended 4->6 (operator-approved, additive) — native deepseek + moonshot added as the weak-model fold-gate targets; Google is a constant 404 confound (gate judged on 5 non-Google providers; 404 did not reproduce this run); per-provider task/ask_user gaps + Google secondary-model 404 deferred to v2.8 (eval script is the v2.8 harness seed, D-08)
- (088-05): Phase 088 verification gate COMPLETE — 4-axis cross-provider UAT 6/6 PASS (OpenAI/Anthropic/Google live + OpenRouter/DeepSeek/Moonshot via 088-04 eval; parallel-thread + 5.2KB long-message PASS); a11y real-contrast FIXED both themes (dark 7.21:1 / light 4.66:1); deep flow LIVE no-refresh Anthropic+Google; A11Y-01/02 signed off; nyquist_compliant: true; operator felt pass 'approved'
- (088-05): D-17 gemini-3 thought_signature CLOSED-as-verified — Google-axis deep flow + multi-tool rounds CLEAN (zero 400; facts.md->v2 proves 2 tool rounds echoed the signature; 075.4 Stage-4 hotfix holds); transient 088-04 Google 404 is a SEPARATE secondary-model routing artifact (v2.8), did not reproduce
- (088-05): 3 UAT blockers fixed in-088 under D-16 (verified-capability only, all additive/panel-scoped) — 7f650da0 workspace file-id in SSE (deep-flow 404), 6b5da2cf panel AA contrast tokens both themes (global tokens untouched), b0b8d735 todo status colors

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

Last session: 2026-05-30T08:05:03.904Z
Stopped at: Completed 088-05-PLAN.md (verification capstone — phase 088 ALL 5 plans done)
Resume file: None

**Planned Phase:** 088 (cross-cutting-verification-accessibility) — 5 plans — 2026-05-29T17:09:34.911Z
