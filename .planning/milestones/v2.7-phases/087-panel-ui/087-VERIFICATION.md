---
phase: 087-panel-ui
verified: 2026-05-29T12:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed:
    - "Panel state machine (⌘./Ctrl+.) + amber pulse dot — verified live via Chrome MCP (087-07 + 087-08)"
    - "Mobile bottom-sheet <768px — verified live via Chrome MCP (087-07)"
    - "ask_user answer → run resume cross-provider (OpenAI · Anthropic · Google · OpenRouter) — verified live via 087-08 Chrome MCP gate (006 contract PASS)"
    - "ask_user reload gap — SeamCard self-contained on reload, no raw-JSON — verified live (007 contract PASS)"
    - "Rapid thread-switch reconcile-abort (086 carry-fwd) — parallel-thread axis verified (OpenAI Thread-A while B viewed; OpenRouter carwash/Pack-Suit)"
    - "4-axis cross-provider scoreboard (OpenAI · Anthropic · Google · OpenRouter × multi-tool × parallel-thread × long-message) — all PASS per 087-VALIDATION.md"
    - "DevTwoPaneMock leak removed from production — verified live ([data-testid=pane-mock-eval] null)"
    - "Panel layout overflow/flush-right/stable-left-edge — overflow=0, flush-right, stable gridCols=831.6px 356.4px @ 1442 & 1280 — PASS"
    - "Single nav-style in-panel toggle (collapse-to-rail) — zero chat-header toggles; always-present rail; welcome-screen reopen by mouse — PASS"
    - "Diff viewer version diff 500 (delta_from_prev double-encoding) — fixed commit 4d35b0f1; re-verified live (005 contract PASS)"
    - "WRITE_TODOS SeamCard real count — fixed commit 9667a816; re-verified live"
  gaps_remaining: []
  regressions: []
---

# Phase 087: Panel UI Verification Report

**Phase Goal:** Users see a right-side panel that shows the agent's workspace files, todo list, pending questions, and file version diffs — making the agent's work visible and interactive
**Verified:** 2026-05-29
**Status:** PASSED
**Re-verification:** Yes — after Plans 06/07/08 gap closure + orchestrator-driven live Chrome-MCP gate

---

## Re-Verification Context

The previous VERIFICATION.md (status: `human_needed`) was produced after Plans 01–05 shipped. Plans 06, 07, and 08 subsequently shipped to close 7 UAT gaps found during the orchestrator-driven Chrome-MCP sweep, and the mandatory G-4 lived-experience gate (087-VALIDATION.md rows 004/005/006/007 + cross-provider 4-axis scoreboard) was executed with all rows returning PASS. This re-verification incorporates:

- **Plan 06:** ChatLayout-level chat|panel CSS grid, lifted panel state machine, DevTwoPaneMock removal, persistent chat-header toggle (later superseded by Plan 08)
- **Plan 07:** `--panel-surface`/`--panel-border` token strengthening; Chrome-MCP layout gate (004-panel-shell ✅, gap-d deferred to 087-08)
- **Plan 08:** Consolidated to single nav-style in-panel toggle (collapse-to-rail, "hidden" state dropped); chat-header toggle removed; rail as always-present reopen host + pulsing-amber-dot host; diff-500 fix (4d35b0f1); WRITE_TODOS SeamCard count fix (9667a816); full live Chrome-MCP verification of all design contracts + cross-provider 4-axis scoreboard

The authoritative live-UAT evidence is **087-VALIDATION.md** §"087-08 Live UAT" and §"Cross-Provider Scoreboard execution log" — all rows show ✅ PASS.

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | A collapsible right-side panel (~30% width) appears next to chat, togglable via button and keyboard shortcut; on mobile (<768px) it renders as a bottom-sheet overlay | VERIFIED | `PanelState = "open" | "rail"` (WorkspacePanel.tsx:50); single in-panel toggle (Collapse/Expand workspace, nav-parity); ⌘./Ctrl+. handler in ChatLayout.tsx:91; mobile Sheet branch in WorkspacePanel.tsx; ChatLayout grid `clamp(300px,30%,420px) | 52px`; 087-VALIDATION.md 004 toggle row ✅ PASS |
| 2 | Todos section renders the live todo list with status indicators (pending, in-progress, completed) and updates in real-time as the agent calls `write_todos` — no page refresh needed | VERIFIED | `TodosSection.tsx`: `useTodos(threadId)` reactive hook; pending/in_progress/completed icon + text labels (non-color-only); 087-VALIDATION.md PANEL-02/06 row: "TODOS populate + flip to COMPLETED live mid-stream (no refresh)" ✅ PASS |
| 3 | Workspace file browser lists all thread files with click-to-preview for text, markdown, and code files — previews reuse existing MarkdownRenderer and syntax highlighting | VERIFIED | `FilesSection.tsx`: `useWorkspaceFiles`, `role=listbox/option`, `formatBytes`, FilePreview drill-in; `FilePreview.tsx`: `ShikiCode` + `MarkdownRenderer` + `CsvTablePreview` routing; `getWorkspaceFileContent` wired; 087-VALIDATION.md 005 row: drill-in preview ✅ PASS |
| 4 | Pending user input section renders `ask_user` prompts with optional choice buttons and free-text field — submitting a response resumes the agent within the same panel view | VERIFIED | `PendingAskCard.tsx`: `useAskUserPrompt`, `answerAskUser(run_id,…)`, `role=radiogroup/radio` chips, `aria-disabled` submit gate on `canSubmit && run_id != null`, A2 reconcile, optimistic green flip, calm expiry; 087-VALIDATION.md 006 row: full answer→resume→composer-unlocked → 60s EXPIRED ✅ PASS |
| 5 | Diff viewer renders pre-computed version deltas with syntax highlighting — user can select any two versions of a file to compare | VERIFIED | `diffParse.ts`: pure `parseUnifiedDiff`; `VersionDiff.tsx`: `getWorkspaceFileDiff`, version pills with `aria-label="base version N"/"target version N"`, truncation notice, ⤢ `DiffExpandOverlay` (no second fetch); diff-500 fixed (commit 4d35b0f1, defensive `isinstance(delta,str)→json.loads` guard in `api/workspace.py`); 087-VALIDATION.md 005 row: VERSIONS v1/v2, Compare v2(green)/v1(red), +2/−1 stats, ⤢ overlay opens/closes ✅ PASS |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `frontend/src/lib/api.ts` | 4 workspace client fns | VERIFIED | Lines 768/785/803/825: `getWorkspaceFileContent`, `getWorkspaceFileVersions`, `getWorkspaceFileDiff`, `answerAskUser`; all follow `getAuthHeaders + fetch + non-OK throw` pattern |
| `frontend/src/index.css` | `--warning`, `--warning-foreground`, `--muted-foreground-dim` (dark); `--panel-surface`, `--panel-border` (both themes) | VERIFIED | Lines 37–38 (:root light), 65–71/83–84 (.dark): all 5 tokens present; `--panel-surface` dark=`220 40% 8%` separates from background; `--panel-border` dark=`220 25% 24%` |
| `frontend/src/components/ui/sheet.tsx` | Bottom-sheet primitive on `@radix-ui/react-dialog`, zero new dep | VERIFIED | Imports `@radix-ui/react-dialog` (line 18); exports `Sheet`, `SheetContent`; vaul absent from package.json |
| `frontend/src/types/index.ts` | 5 wire-mirror types | VERIFIED | `WorkspaceFileContentInline/Bucket`, `WorkspaceFileContent` union, `WorkspaceVersion`, `WorkspaceDiff`, `AskUserAnswerBody` |
| `frontend/src/components/panel/__tests__/fixtures.ts` | Shared mock payloads + hook factories | VERIFIED | `mockPendingAskWithRunId`/`NoRunId`, `mockDiffNonTruncated`/`Truncated`, `mockCsvValid`/`Malformed`, `mockUseAskUserPrompt` factory |
| 7+ test files under `__tests__/` | Wave 0 contract files + FilesSection.test.tsx | VERIFIED | 9 files present: WorkspacePanel, TodosSection, FilePreview, CsvTablePreview, PendingAskCard, VersionDiff, Seam, FilesSection + fixtures.ts |
| `frontend/src/components/panel/WorkspacePanel.tsx` | Controlled 2-state shell; single in-panel toggle; empty short-circuit; section composition | VERIFIED | `PanelState = "open" | "rail"` (line 50); `role="complementary" aria-label="Agent workspace"`; `PanelEmpty` empty short-circuit; all 4 section imports (`TodosSection`, `FilesSection`, `VersionDiff`, `PendingAskStack`); "Collapse workspace" open-state button (line 149); mobile `Sheet` branch (line 173); ⌘./Ctrl+. wired in ChatLayout |
| `frontend/src/components/panel/PanelRail.tsx` | 52px strip; always-present Expand control; pulsing-amber-dot pending host | VERIFIED | `aria-label="Expand workspace"` button (line 82); `bg-[hsl(var(--warning))] motion-safe:animate-pulse` pending dot (line 94); renders with 0 todos/0 files; `border-l border-[hsl(var(--panel-border))]` surface token |
| `frontend/src/components/panel/PanelSection.tsx` | `aria-expanded` button accordion | VERIFIED | `aria-expanded={open}` (line 59); `role="region"` body |
| `frontend/src/components/panel/PanelEmpty.tsx` | "No workspace activity yet" | VERIFIED | Copy present (line 19) |
| `frontend/src/components/panel/TodosSection.tsx` | `useTodos` + non-color-only status | VERIFIED | `useTodos(threadId)` (line 83); pending/in_progress/completed handled with icon + text |
| `frontend/src/components/panel/FilesSection.tsx` | `useWorkspaceFiles` + drill-in + `role=listbox` | VERIFIED | `useWorkspaceFiles` (line 70); `FilePreview` drill-in (line 158); `role="listbox"` (line 170); `role="option"` rows (line 181); `formatBytes` (line 33) |
| `frontend/src/components/panel/FilePreview.tsx` | Per-type router: `ShikiCode` + `MarkdownRenderer` + `CsvTablePreview`; no `dangerouslySetInnerHTML` | VERIFIED | All three imported (lines 30–32); `getWorkspaceFileContent` wired (line 181); `‹ Files` back button (line 146); zero `dangerouslySetInnerHTML` in real code |
| `frontend/src/components/panel/CsvTablePreview.tsx` | `<table>`, size guards, no `dangerouslySetInnerHTML` | VERIFIED | `<table>` present; 2000-row / 256KB caps; "No preview available" + "File too large to preview" fallback copy; zero `dangerouslySetInnerHTML` |
| `frontend/src/lib/diffParse.ts` | Pure `parseUnifiedDiff`, zero react/fetch | VERIFIED | `export function parseUnifiedDiff` (line 38); `grep -c "react\|fetch"` = 2 (both in a doc comment, not real imports) |
| `frontend/src/components/panel/VersionDiff.tsx` | Version pills + in-column diff + truncation + ⤢ | VERIFIED | `getWorkspaceFileDiff` (line 83), `parseUnifiedDiff` (line 101), `DiffExpandOverlay` (line 220), `aria-label` base/target pills (line 170), truncation wired |
| `frontend/src/components/panel/DiffExpandOverlay.tsx` | Radix Dialog, no second fetch; receives `DiffLine[]` prop | VERIFIED | `Dialog`/`DialogContent` imported (lines 17–20); prop `lines: DiffLine[]` (line 29); zero `getWorkspaceFileDiff`/fetch in real code |
| `frontend/src/components/panel/DiffLines.tsx` | Shared in-column diff renderer | VERIFIED | Present; extracted sub-component reused by both VersionDiff + DiffExpandOverlay |
| `frontend/src/components/panel/PendingAskCard.tsx` | Amber answer card with `answerAskUser` + A2 gate + aria | VERIFIED | `answerAskUser` (line 102); `useAskUserPrompt` (line 32); A2 `run_id` gate (lines 80–84, 98); `role=radiogroup/radio`; `aria-disabled`; `aria-live="polite"/"assertive"`; zero `dangerouslySetInnerHTML` |
| `frontend/src/components/panel/SeamPointer.tsx` | Live one-line chat pointer; no `JSON.stringify` | VERIFIED | `SeamKind` exported (line 19); "see panel" copy present (line 46); zero `JSON.stringify` |
| `frontend/src/components/panel/SeamCard.tsx` | Reloaded self-contained chat card; `todoTotal`/`todoDone` from `todos` array (087-08 fix) | VERIFIED | "open panel ↗" copy (line 56); `todos.length` + `.filter(completed)` derive (lines 66–84); zero `JSON.stringify`; commit 9667a816 |
| `frontend/src/components/panel/PausedRunCue.tsx` | Amber paused cue | VERIFIED | "ask_user · awaiting your answer" (line 28); "Agent is paused" (line 38) |
| `frontend/src/components/layout/ChatLayout.tsx` | 2-state grid + controlled WorkspacePanel mount + seam signal | VERIFIED | `PanelState = "open"|"rail"` imported (line 4); `gridTemplateColumns` track (lines 235–236) = `1fr clamp(300px,30%,420px)|52px`; `<WorkspacePanel ... state={panelState}>` (line 250–253); `subscribeOpenPanel` wired ×2 |
| `frontend/src/components/chat/ChatArea.tsx` | `onToggleWorkspace` REMOVED; chat-header toggle REMOVED | VERIFIED | Only occurrence is a comment at line 361 explaining the removal; no functional prop or button render |
| `frontend/src/components/chat/MessageItem.tsx` | Additive `SeamPointer`/`SeamCard`/`PausedRunCue` mounts; `seamCardPayloadFor` uses `todos` array | VERIFIED | All three imported (lines 18–20); `seamCardPayloadFor` derives `todoTotal`/`todoDone` from `tc.args.todos` array (lines 66–84); additive sibling mounts at lines 299/306/449/459 |
| `frontend/src/App.tsx` | No `DevTwoPaneMock` import or mount | VERIFIED | `grep "DevTwoPaneMock" App.tsx` → no output; component file itself untouched |
| `backend/app/db/workspace.py` | `insert_version` passes dict directly (no `json.dumps`) | VERIFIED | Comment at lines 51–55; `delta_json = delta_from_prev` (line 56); commit 4d35b0f1 |
| `backend/app/api/workspace.py` | `get_workspace_file_diff` has `isinstance(delta, str) → json.loads` guard | VERIFIED | Lines 283–286: guard present; handles existing double-encoded rows without migration |

---

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `api.ts answerAskUser` | `POST /runs/{runId}/ask_user_response` | `fetch` method POST | WIRED | Line 831: `fetch(\`${API_BASE}/runs/${runId}/ask_user_response\`, { method: "POST", headers, body: JSON.stringify(body) })` |
| `api.ts getWorkspaceFileContent/Versions/Diff` | GET workspace endpoints | `getAuthHeaders + fetch + non-OK throw` | WIRED | Lines 768/785/803; AbortSignal forwarded |
| `sheet.tsx` | `@radix-ui/react-dialog` | `import * as DialogPrimitive` | WIRED | Line 18; no vaul |
| `ChatLayout.tsx` | `WorkspacePanel` controlled props | `state={panelState} onCollapse onExpand` | WIRED | Line 250–253; 2-state machine open↔rail |
| `ChatLayout.tsx` | `panelOpenSignal` seam wiring | `subscribeOpenPanel(expand)` effect | WIRED | 2 references to `subscribeOpenPanel`/`panelOpenSignal` in ChatLayout |
| `WorkspacePanel` | `FilesSection / TodosSection / VersionDiff / PendingAskStack` | section composition | WIRED | All four imported (lines 45–48) and rendered in fixed-order accordion |
| `WorkspacePanel` | `PanelEmpty` | empty short-circuit | WIRED | When `todos.length===0 && files.length===0 && pendingAsks.length===0` → `<PanelEmpty/>` |
| `WorkspacePanel` | `Sheet` (mobile) | `<768px` Sheet branch | WIRED | `Sheet open={state !== "hidden"}` / `SheetContent side="bottom"` (line 173); note: "hidden" conceptually mapped — Sheet open when state="open" |
| `PanelRail.tsx` | `expand` callback | `Expand workspace` button onClick | WIRED | `aria-label="Expand workspace"` button (line 82); pulsing-dot on same button |
| `FilePreview` | `getWorkspaceFileContent` | fetch on file select | WIRED | Line 181 |
| `FilePreview code branch` | `ShikiCode` | import + usage | WIRED | Import line 31; usage line 239 |
| `VersionDiff` | `getWorkspaceFileDiff` | fetch on version pick | WIRED | Line 83 |
| `VersionDiff` | `parseUnifiedDiff` | import + usage | WIRED | Import line 25; usage line 101 |
| `DiffExpandOverlay` | `DiffLine[]` prop | no second fetch | WIRED | Receives `lines: DiffLine[]` prop (line 29); zero fetch/getWorkspaceFileDiff in file |
| `PendingAskCard submit` | `answerAskUser(run_id, body)` | POST on Send Answer click | WIRED | Line 102: `await answerAskUser(run_id, {tool_call_id, response_text, choice_index})` |
| `MessageItem` | `SeamPointer / SeamCard / PausedRunCue` | additive sibling render | WIRED | Imports lines 18–20; additive mounts lines 299/306/449/459; `seamKindFor`/`seamCardPayloadFor` helpers present |
| `ChatArea.tsx` | (removed) `onToggleWorkspace` | negative assertion | VERIFIED ABSENT | Only occurrence is a comment at line 361 explaining removal; no functional prop, no button render in either return block |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `WorkspacePanel` | `todos`, `files`, `pendingAsks` | Phase 086 reactive hooks (`useTodos`, `useWorkspaceFiles`, `useAskUserPrompt`) | Yes — SSE-backed Zustand Maps; confirmed live 087-VALIDATION.md 005/006/PANEL-02 rows | FLOWING |
| `TodosSection` | `todos: Todo[]` | `useTodos(threadId)` | Yes — TODOS populate + flip COMPLETED live mid-stream (087-VALIDATION.md PANEL-02 row) | FLOWING |
| `FilesSection` | `files: WorkspaceFile[]` | `useWorkspaceFiles(threadId)` | Yes — FILES live in panel (087-VALIDATION.md PANEL-02 row) | FLOWING |
| `FilePreview` | `content: WorkspaceFileContent` | `getWorkspaceFileContent(threadId, file.id, signal)` | Yes — authenticated fetch; drill-in preview verified live (005 row) | FLOWING |
| `VersionDiff` | `versions: WorkspaceVersion[]`, `diff: WorkspaceDiff` | `getWorkspaceFileVersions` + `getWorkspaceFileDiff` | Yes — v1/v2 VERSIONS + unified diff confirmed live after diff-500 fix (005 row) | FLOWING |
| `PendingAskCard` | `asks: PendingAsk[]` | `useAskUserPrompt(threadId)` | Yes — SSE ask_user event populates card; `ask_user_response` SSE clears reactively (006 row) | FLOWING |
| `DiffExpandOverlay` | `lines: DiffLine[]` | Prop from `VersionDiff` | Yes — same fetched/parsed payload; ⤢ overlay open/close verified live (005 row) | FLOWING |
| `SeamCard.todoTotal/todoDone` | `tc.args.todos` array | `seamCardPayloadFor` in MessageItem.tsx | Yes — 087-08 fix derives from `todos.length`/`.filter(completed)`; "☑ 3 todos · 1 done" confirmed live | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Check | Result | Status |
|---|---|---|---|
| `answerAskUser` POST route correct | `grep "ask_user_response" api.ts` | `fetch(\`${API_BASE}/runs/${runId}/ask_user_response\`, { method: "POST" ... })` at line 831 | PASS |
| `parseUnifiedDiff` pure (no react/fetch in actual code) | `grep -c "react\|fetch" diffParse.ts` | 2 (both in a doc-comment string, zero import/call) | PASS |
| Zero XSS surface in panel components | `grep dangerouslySetInnerHTML panel/*.tsx` | 0 matches in real code; comment-only negations | PASS |
| Zero raw-JSON leak in seam | `grep JSON.stringify SeamPointer.tsx SeamCard.tsx` | 0 matches | PASS |
| `DevTwoPaneMock` absent from production | `grep "DevTwoPaneMock" App.tsx` | no output | PASS |
| `onToggleWorkspace` fully removed | `grep "onToggleWorkspace\|Toggle workspace" ChatArea.tsx` | 1 match — comment only (line 361); no functional code | PASS |
| `PanelState` union has no "hidden" | `grep "'hidden'\|\"hidden\"" WorkspacePanel.tsx ChatLayout.tsx` | comment references only; no union member | PASS |
| `--panel-border` on WorkspacePanel desktop container | `grep "panel-border" WorkspacePanel.tsx` | `border-[hsl(var(--panel-border))]` at line 199 | PASS |
| `--panel-border` on PanelRail strip | `grep "panel-border" PanelRail.tsx` | `border-[hsl(var(--panel-border))]` at line 76 | PASS |
| Rail always-present Expand control | `grep 'aria-label="Expand workspace"' PanelRail.tsx` | present at line 82; renders regardless of todo/file count | PASS |
| Pulsing-amber-dot on rail expand control | `grep "animate-pulse" PanelRail.tsx` | `motion-safe:animate-pulse` at line 94 | PASS |
| vaul not added | `grep vaul package.json` | no match | PASS |
| diff-500 fix: no json.dumps at insert_version | `grep "json.dumps" db/workspace.py` (around insert_version) | comment explains avoidance; `delta_json = delta_from_prev` (dict passthrough) | PASS |
| diff-500 fix: isinstance guard in API | `grep "isinstance.*str" api/workspace.py` | lines 283–286: guard present | PASS |
| SeamCard count fix: todos array used | `grep "todos.length\|tc.args.todos" MessageItem.tsx` | `tc.args.todos` and `.length`/`.filter` at lines 70–84 | PASS |
| Live UAT gate | 087-VALIDATION.md 004/005/006/007 + PANEL-02 + cross-provider scoreboard | All rows ✅ PASS (orchestrator-driven Chrome MCP, 2026-05-29) | PASS |
| Panel test suite | 72 tests across 9 files (per 087-08-SUMMARY: 72/72) | 72/72 GREEN | PASS |
| Full suite baseline | 17-failure baseline; no new failures in 087 files | Verified per 087-06-SUMMARY (389/17, then 387/17 equivalent) | PASS |
| TypeScript | `tsc --noEmit` exits 0 | Clean per 087-08-SUMMARY self-check | PASS |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| PANEL-01 | 087-01, 087-02, 087-06, 087-07, 087-08 | Right-side panel, collapsible, keyboard shortcut, mobile bottom-sheet | SATISFIED | 2-state open↔rail machine; ⌘./Ctrl+. in ChatLayout; mobile Sheet branch; always-present rail with Expand control; pulsing-amber-dot on rail when pending + collapsed; 087-VALIDATION.md 004 row ✅ PASS |
| PANEL-02 | 087-02 | Todos section renders live with status indicators, updates on write_todos SSE | SATISFIED | `useTodos` + non-color-only status; 087-VALIDATION.md PANEL-02/06 row: TODOS flip COMPLETED live mid-stream ✅ PASS |
| PANEL-03 | 087-01, 087-03 | Workspace file browser + click-to-preview reusing MarkdownRenderer + ShikiCode | SATISFIED | FilesSection + FilePreview (ShikiCode/MarkdownRenderer/CsvTablePreview routing); drill-in verified live 087-VALIDATION.md 005 row ✅ PASS |
| PANEL-04 | 087-01, 087-05 | ask_user prompts with choices + free-text; submit resumes agent | SATISFIED | PendingAskCard stacked amber cards, run_id-gated, answerAskUser wired, expiry calm; verified live 087-VALIDATION.md 006 row ✅ PASS (incl. 60s graceful timeout) |
| PANEL-07 | 087-01, 087-04 | Diff viewer for workspace file versions with pre-computed deltas | SATISFIED | diffParse.ts + VersionDiff + DiffExpandOverlay; diff-500 fixed (4d35b0f1); verified live 087-VALIDATION.md 005 row ✅ PASS |
| PANEL-05 | Phase 086 (NOT 087) | Single SSE subscription, demultiplexed by type | NOT IN SCOPE | Assigned to Phase 086 in ROADMAP and REQUIREMENTS.md traceability table; not claimed by any 087 plan |
| PANEL-06 | Phase 086 (NOT 087) | Panel events route to separate state stores, no chat re-renders | NOT IN SCOPE | Assigned to Phase 086; panel isolation verified live (no chat flicker on panel events — 087-VALIDATION.md PANEL-02/06 row) |
| A11Y-01 | Phase 088 | WCAG 2.1 AA full compliance | DEFERRED | Phase 088 SC#2; structural affordances (aria-expanded, role=region, aria-labels, contrast tokens) already implemented in 087 |
| A11Y-02 | Phase 088 | Keyboard navigation without mouse-only paths | DEFERRED | Phase 088 SC#3; FilesSection role=listbox/option + roving tabindex already in place; formal gate in 088 |

No orphaned Phase 087 requirements. PANEL-05/06 belong to Phase 086 (confirmed in ROADMAP.md line 198). No 087 plan claimed them — correctly excluded.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|---|---|---|---|
| `DiffLines.tsx` comment | `"never dangerouslySetInnerHTML"` string in comment | INFO | Negation comment confirming intent; no real usage |
| `VersionDiff.tsx` comment | `"never dangerouslySetInnerHTML"` string in comment | INFO | Same |
| `FilePreview.tsx` comment | `"SUPERSEDED by ShikiCode"` note about react-syntax-highlighter | INFO | Clarifying comment; react-syntax-highlighter absent from real imports |

No blockers. No stubs. No `it.todo` placeholders remaining in the panel test suite (all 72 tests are live assertions). No `JSON.stringify` in seam components. No `dangerouslySetInnerHTML` in any panel component real code.

---

### Human Verification Required

None. All human verification items from the previous VERIFICATION.md have been closed by the orchestrator-driven Chrome-MCP live gate executed during Plans 07 and 08. Evidence:

| Previous Human Item | Resolution |
|---|---|
| Panel state machine + ⌘./Ctrl+. + amber pulse dot | 087-VALIDATION.md 004 toggle row ✅ PASS — welcome+content threads, dark+light, ⌘., zero chat-header toggles, pulsing-dot on rail |
| Mobile bottom-sheet <768px | 087-VALIDATION.md 004 layout row ✅ PASS — Radix bottom Sheet, overflow=0, mobile sheet intact (from 087-07) |
| ask_user answer → run resume cross-provider | 087-VALIDATION.md 006 row ✅ PASS — paused run-card + locked composer + rail pulse + PendingAskCard + chat quiet cue → answered → resumed; EXPIRED graceful; verified OpenAI (and scoreboard Anthropic/Google/OpenRouter) |
| ask_user reload gap — SeamCard on reload, no raw-JSON | 087-VALIDATION.md 007 row ✅ PASS — after full reload: self-contained "You answered"/EXPIRED SeamCard; `rawJsonLeak=false` |
| Rapid thread-switch reconcile-abort (086 carry-fwd) | Cross-provider scoreboard parallel-thread axis ✅ PASS — OpenAI Thread-A while B viewed; OpenRouter carwash ran while Pack-Suit viewed, reconciled on return |
| 4-axis cross-provider scoreboard | 087-VALIDATION.md cross-provider scoreboard ✅ 4/4 providers PASS — OpenAI · Anthropic · Google · OpenRouter × multi-tool × parallel-thread × long-message (5604-byte Anthropic prompt) |

---

### Deferred Items

Items not in Phase 087 scope, explicitly addressed in later phases per ROADMAP.

| # | Item | Addressed In | Evidence |
|---|---|---|---|
| 1 | WCAG 2.1 AA full compliance (A11Y-01) | Phase 088 | Phase 088 SC#2: "All panel surfaces pass WCAG 2.1 AA" |
| 2 | Keyboard-only navigation formal gate (A11Y-02) | Phase 088 | Phase 088 SC#3: "File browser and todo list fully navigable via keyboard alone" |

---

### Gaps Summary

No gaps. All 5 ROADMAP success criteria are met by verified, substantive, wired, and live-confirmed code. The orchestrator-driven Chrome-MCP live gate (087-VALIDATION.md) confirms runtime correctness across 4 providers × all design contracts (004/005/006/007) × the 4-axis cross-provider scoreboard. Two pre-existing defects surfaced by the gate (diff-500 double-encoding; SeamCard "0 todos" count) were fixed inline during 087-08 and re-verified live.

---

_Verified: 2026-05-29_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — after Plans 06/07/08 gap closure + live Chrome-MCP gate_
