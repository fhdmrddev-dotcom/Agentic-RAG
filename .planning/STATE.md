---
gsd_state_version: 1.0
milestone: v2.8
milestone_name: Harness Engine & Workflow Mode
status: in-progress
stopped_at: Milestone v2.8 started via /gsd:new-milestone — defining requirements
last_updated: "2026-05-30T09:30:00.000Z"
last_activity: 2026-05-30
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-30 after v2.7 close)

**Core value:** The agent acts as an AI colleague -- it knows your knowledge base, can run code, and can be taught new behaviors (skills) that persist and can be shared
**Current focus:** v2.8 (Harness Engine & Workflow Mode) STARTED 2026-05-30 — defining requirements → research → roadmap. Plugin Contract deferred to v2.9.

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Milestone v2.8 (Harness Engine & Workflow Mode) started — defining requirements → research → roadmap
Scope: HARNESS-01..03 (state-machine workflow runtime, 5 phase types, validation gates, resumable runs) + MODE-01 (dual Deep/Harness mode) + folded SEED-029 (Continue button) / SEED-034 (eval-harness regression gate) / SEED-035 (tool-count budget) / SEED-036a (`task()` concurrency fair-share) + 2 polish riders (chat tool-card unification, Anthropic cross-provider parity). PLUGIN-01..03 + `super_admin`/operator role tier DEFERRED to v2.9 (before v3.0). See PROJECT.md D-v2.8-01.
Next: Research-first ON → 4 parallel harness-domain research agents → REQUIREMENTS.md → ROADMAP.md (gsd-roadmapper). Phase numbering continues from v2.7 (last phase 088 → v2.8 starts at **089**). Migrations renumber from real head **056+** (PRD's 125-139 reservation is stale).
Carry-forwards into v2.8 (verify at kickoff): BUG-260527-01 title-gen (DeepSeek/Moonshot/Google, fixed-but-unverified), Google secondary-model 404, download-link payload. 087 panel deferrals SEED-037/038/039 (037 download → standalone `/gsd:quick`).
G-5 FIRING: `threads.py` (3,186 LOC, 9+ phases) — agent_runner extraction lands FIRST in v2.8 so the harness sits in a clean module.
Last activity: 2026-05-30 — v2.8 started via /gsd:new-milestone

Progress: [          ] 0% — requirements not yet defined

## Performance Metrics

**Velocity:**

- Total plans completed: 25 (v2.7)
- Prior milestones: v2.6 shipped 91 plans in 16 days (~5.7 plans/day)
- Average duration: ~12min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 083 | 3 | - | - |
| 084 | 5 | - | - |
| 085 | 5 | - | - |
| 087 | 5/5 | - | ~8min (087-02) |
| 088 | 5 | - | - |

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

### Acknowledged at v2.7 close (2026-05-30)

27 open artifact-audit items acknowledged and deferred at v2.7 milestone close (operator chose "Acknowledge all & proceed"). None block the shipped build — the milestone was verified end-to-end by the Phase 088 cross-cutting capstone.

| Category | Item | Status |
|----------|------|--------|
| UAT gap | 085-HUMAN-UAT.md (5 operator-only scenarios) | Rolled forward — operator-only rows |
| UAT gap | 087-HUMAN-UAT.md (6 operator-only scenarios) | Rolled forward — operator-only rows |
| UAT gap | 083 / 084 / 086 / 087-UAT (0 pending scenarios) | Cosmetic — status fields not flipped |
| Verification | 083-VERIFICATION.md (human_needed) | Accepted — operator UAT approved in-phase |
| Verification | 085-VERIFICATION.md (human_needed) | Accepted — operator UAT approved in-phase |
| Quick tasks | 11 pre-GSD micro-tickets (260322..260412) | Unknown — predate GSD (carried since v2.5) |
| Quick task | 260522-gdg-google-15-iter-loop-diagnostic | Diagnostic note only |
| Quick tasks | 260529-0sc, 260529-1wb | Actually DONE (commits 62c1cf0, c756522) — audit false-positive |
| Dormant seeds | SEED-002 / SEED-003 / SEED-004 / SEED-005 | Dormant — long-deferred future milestones |

Plus v2.7-specific deferrals carried with re-open triggers: **SEED-037** (in-panel office/PDF/PPTX viewing + working download), **SEED-038** (chat-vs-panel artifacts unification), **SEED-039** (panel reliability / fast-switch race), **BUG-260527-01** (title-gen live-verify on DeepSeek/Moonshot/Google — folded into 083 but unverified), **BUG-260529-02** (chat-tool-card unification — own v2.8 phase).

### Carried forward from v2.6 milestone close:

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
