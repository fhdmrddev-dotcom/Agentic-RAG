---
phase: 087-panel-ui
plan: 08
subsystem: ui
tags: [react, workspace-panel, navpanel-parity, chrome-mcp, cross-provider, jsonb, asyncpg]

requires:
  - phase: 087-06
    provides: "ChatLayout-level grid + lifted panel state machine"
  - phase: 087-07
    provides: "panel/rail surface contrast tokens"
provides:
  - "Single nav-style in-panel workspace toggle (collapse-to-rail; chat-header toggle + fully-hidden state removed)"
  - "Always-present rail = mouse reopen host on every thread (closes 087-07 gap-d) + pulsing-amber-dot pending host"
  - "Live Chrome-MCP verification of all four design contracts (004/005/006/007) + PANEL-02 + cross-provider 4-axis scoreboard"
  - "Fix: workspace version diff 500 (delta_from_prev JSONB double-encoding)"
  - "Fix: WRITE_TODOS SeamCard real todo count (was always 0)"
affects: [088]

tech-stack:
  added: []
  patterns:
    - "Panel collapse mirrors NavPanel: 2-state open↔rail, single in-panel toggle, rail never fully disappears"
    - "asyncpg JSONB columns: pass dicts directly (pool codec encodes once) — never json.dumps at the call site"

key-files:
  created: []
  modified:
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/panel/WorkspacePanel.tsx
    - frontend/src/components/panel/PanelRail.tsx
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/components/chat/MessageItem.tsx
    - frontend/src/components/panel/WorkspacePanel.test.tsx
    - .claude/skills/sketch-findings-agentic-rag/references/panel-shell.md
    - backend/app/db/workspace.py
    - backend/app/api/workspace.py

key-decisions:
  - "PanelState narrowed to open|rail (dropped hidden) — nav-parity; single in-panel toggle; ⌘. toggles open↔rail"
  - "Removed the redundant ChatArea chat-header workspace toggle + onToggleWorkspace prop"
  - "delta_from_prev double-encoding fixed at the write site (pass dict) + a defensive str-guard on the API read"
  - "WRITE_TODOS SeamCard count derived from tc.args.todos (length + completed), not the non-existent total/done fields"

patterns-established:
  - "Collapse-to-rail (nav-parity) is the canonical panel collapse model — supersedes the 3-state open/rail/hidden contract in panel-shell.md (004)"

requirements-completed: [PANEL-01, PANEL-02, PANEL-03, PANEL-04, PANEL-07]

duration: ~Wave1 (executor) + orchestrator-driven Wave2 live gate
completed: 2026-05-29
---

# Phase 087 Plan 08: Toggle Consolidation + Full Design-Contract Verification

**One nav-style in-panel workspace toggle (collapse-to-rail) replaces the two-control/hidden-state design; all four design contracts (004/005/006/007) + PANEL-02 + the cross-provider 4-axis scoreboard verified live — surfacing and fixing a real version-diff 500 and a todo-count bug.**

## Accomplishments

### Wave 1 — toggle consolidation (commit c1d446f6)
- `PanelState` narrowed to `"open" | "rail"` (fully-hidden state dropped). Single in-panel toggle, nav-parity: `PanelRightClose`/"Collapse" (open→rail) ↔ `PanelRightOpen`/"Expand" (rail→open).
- ChatArea chat-header "Toggle workspace" button + `onToggleWorkspace` prop removed (both return paths + call site).
- Rail leads with an always-present Expand control (renders with 0 todos/0 files) = the mouse reopen host on every thread incl. the empty/welcome screen → closes 087-07 gap-d. Pulsing-amber-dot now hosted here.
- `⌘./Ctrl+.` toggles open↔rail; grid panel track `clamp(300px,30%,420px)`/`52px` (no 0 column).
- `panel-shell.md` (004 contract) updated to nav-style collapse-to-rail with a "Superseded (087-08)" note.
- tsc clean; panel tests 72/72.

### Wave 2 — live Chrome-MCP gate (orchestrator-driven, all PASS)
See `087-VALIDATION.md` for the full row-by-row + cross-provider scoreboard.

- **004 panel-shell:** single toggle collapse→rail→reopen-by-mouse verified on welcome + content threads, dark + light; ⌘.; zero `aria-label="Toggle workspace"`; no overflow / flush-right / stable left edge @ 1442 & 1280; mobile bottom-sheet intact; rail amber pulse-dot host.
- **005 file-and-diff:** drill-in preview, VERSIONS v1/v2, Compare v2(green)/v1(red), +2/−1 stats, unified diff, ⤢ DiffExpandOverlay. (Required a backend fix — see Deviations.)
- **006 pending-question:** paused amber run-card + locked composer + rail pulse-dot + pinned PendingAskCard (radio+free-text, submit gated→enabled on pick) + chat quiet cue → answered → resumed in chosen format + composer unlocked; 60s graceful timeout shows EXPIRED on both surfaces.
- **007 chat-panel-seam:** live quiet SeamPointers; after a full page reload → self-contained "You answered" / EXPIRED cards; no raw-JSON leak.
- **PANEL-02/06:** todos populate + flip to COMPLETED live mid-stream (no refresh); chat shows quiet "see panel →" pointers, not duplicate rich cards.
- **Cross-provider 4-axis scoreboard:** OpenAI · Anthropic · Google · OpenRouter all render the panel/seam/todos identically (one UX, four adapters); multi-tool ✅ (write_todos+workspace_write+write_todos); parallel-thread ✅ (carwash ran while Pack-Suit viewed — no bleed, reconciled on return); long-message ✅ (5604-byte Anthropic prompt).

## Task Commits

1. **Wave 1 — single nav-style toggle (collapse-to-rail)** — `c1d446f6` (feat)
2. **Fix — version diff 500 (delta_from_prev double-encoding)** — `4d35b0f1` (fix)
3. **Fix — WRITE_TODOS seam card real count** — `9667a816` (fix)

## Deviations from Plan

Two real defects surfaced by the Wave 2 live gate and fixed inline (both pre-existing, NOT introduced by this plan):

### 1. [UAT-found · backend] Version-diff endpoint returned HTTP 500
- **Found during:** Task 2, 005 verification (multi-version `/notes.md`).
- **Issue:** `GET /threads/{}/workspace/files/{}/diff?from=1&to=2` 500'd (UI: "Could not load versions"; browser: CORS/ERR_FAILED — a 500 carries no CORS header). Root cause via DB probe (`jsonb_typeof(delta_from_prev) = 'string'`): `insert_version` did `json.dumps()` AND the asyncpg pool's JSONB codec encodes again → the JSONB column stored a JSON string → the API reader's `delta.get()` raised. Pre-existing since the version feature (Phase 084/087-04); the sibling `workspace_service.get_file_diff` already had a str-guard, the API route did not.
- **Fix:** `db/workspace.py` pass the dict directly (codec encodes once); `api/workspace.py` defensive `isinstance(delta, str) → json.loads` guard (handles existing double-encoded rows, no data migration). Commit `4d35b0f1`. Re-verified live (200 + full diff render).

### 2. [UAT-found · frontend] WRITE_TODOS SeamCard always showed "0 todos"
- **Found during:** Task 2, PANEL-02 / cross-provider verification (all 4 providers).
- **Issue:** `seamCardPayloadFor` read `tc.args.total`/`tc.args.done`, but write_todos args carry a `todos` array — no total/done field → SeamCard fell back to 0.
- **Fix:** derive `todoTotal` from `todos.length` and `todoDone` from the completed count. Commit `9667a816`. Re-verified live ("☑ 3 todos" / "☑ 3 todos · 1 done").

## Issues Encountered

The deferral of 005/006/007 + the scoreboard in Plan 07's gate ("if data permits") would have shipped the diff-500 (a broken core feature) — vindicating the operator's insistence on verifying ALL design contracts live (see [[feedback_uat_cover_all_design_contracts]]). Both fixes are pre-existing bugs the panel UAT exposed, not regressions from this phase.

## Next Phase Readiness
- Phase 087 panel is fully verified across all design contracts + 4 providers.
- Phase 088 (E2E reload flow) is de-risked: the 007 seam reload (self-contained resolved cards, no raw-JSON) is confirmed.

---
*Phase: 087-panel-ui*
*Completed: 2026-05-29*

## Self-Check: PASSED
- Wave 1 + 2 fix commits present (c1d446f6, 4d35b0f1, 9667a816); tsc clean; 72/72 panel tests; all design contracts + cross-provider scoreboard verified live; both UAT-found defects fixed + re-verified.
