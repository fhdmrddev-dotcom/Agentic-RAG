---
phase: 087-panel-ui
verified: 2026-05-29T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Panel open/rail/hidden state cycle + keyboard shortcut (⌘./Ctrl+.) at desktop widths (1024px, 1440px)"
    expected: "Button click cycles open→rail→hidden→open; ⌘./Ctrl+. toggles open↔hidden; panel column animates with 300ms grid-template-columns transition; at 1024px chat stays ≥600px readable floor; amber pulse dot appears on toggle when ask_user pending + panel closed"
    why_human: "Grid-state-machine animation, laptop-squeeze guard, and amber pulse dot require live browser rendering — can't verify via static grep or unit tests"
  - test: "Mobile bottom-sheet behavior at <768px (simulate with DevTools 375px viewport)"
    expected: "WorkspacePanel renders as Sheet (Radix Dialog bottom-sheet) instead of side column; sheet slides up from bottom; .sheet-grip handle dismisses; sheet never occludes the chat composer; touch targets ≥44px"
    why_human: "Bottom-sheet DOM + touch target dimensions require Chrome DevTools viewport simulation"
  - test: "ask_user answer → run resume cross-provider (exercise at minimum OpenAI + Anthropic + Google)"
    expected: "Agent calls ask_user → panel shows amber card (newest-top) + run-card turns amber + composer locks; user types/selects answer + clicks Send Answer → optimistic green flip + 'Answered · agent resumed'; run continues and prints next output; panel card disappears reactively"
    why_human: "Cross-worker Redis pub/sub resume + SSE ask_user_response clearing + composer-lock interplay require a running backend + real provider round-trip. 4-axis scoreboard (cross-provider × multi-tool × parallel-thread × long-message) is the CLAUDE.md MANDATORY UAT rule for phases touching ask_user/SSE"
  - test: "ask_user reload gap — page reload mid-/post-question then verify SeamCard appears in chat"
    expected: "After reload: panel shows current pending asks (or empty if answered); answered Q&A appears as a SeamCard (self-contained) in the chat transcript — NOT as a pointer, NOT as raw JSON"
    why_human: "Persistence across page reload and the reloaded-vs-live mode routing in MessageItem require a real browser session"
  - test: "Rapid thread-switch reconcile-abort (086 carry-forward UAT item, now live)"
    expected: "Thread A streaming with workspace activity → switch to Thread B → panel reflects Thread B's state; Thread A's panel GET requests show as cancelled in Network tab (no cross-thread data bleed)"
    why_human: "Network-timing race with AbortController; no unit proxy for cancel; DevTools Network panel required"
  - test: "4-axis cross-provider scoreboard: write_todos + workspace_write + ask_user on at least OpenAI, Anthropic, Google, OpenRouter"
    expected: "Panel updates identically across providers when each calls write_todos/workspace_write/ask_user — one UX, four adapters. Multi-tool row: single prompt writes both a file AND a todo. Parallel-thread row: Thread A streaming while Thread B accepts prompt — panel switches cleanly"
    why_human: "CLAUDE.md MANDATORY 4-axis UAT rule for phases touching streaming/provider/UI-state. Cannot verify without running backend + real provider credentials"
---

# Phase 087: Panel UI Verification Report

**Phase Goal:** Users see a right-side panel that shows the agent's workspace files, todo list, pending questions, and file version diffs — making the agent's work visible and interactive
**Verified:** 2026-05-29
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A collapsible right-side panel (~30% width) appears next to chat, togglable via button and ⌘./Ctrl+., renders as bottom-sheet on mobile <768px | VERIFIED | `WorkspacePanel.tsx`: `useViewingThread`, `metaKey/ctrlKey + key==="."` toggle, `Sheet`/`SheetContent side="bottom"`, `role="complementary" aria-label="Agent workspace"`, grid-state machine open/rail/hidden. `ChatLayout.tsx`: additive `activeView === "chat" && <WorkspacePanel>` sibling (6 ins / 0 del verified via git diff). Unit tests: 9/9 WorkspacePanel tests GREEN. |
| 2 | Todos section renders the live todo list with status indicators (pending, in-progress, completed) and updates reactively — no page refresh | VERIFIED | `TodosSection.tsx`: `useTodos(threadId)` hook; `TodoStatus = "pending" \| "in_progress" \| "completed"`; icon + visible text label (non-color-only); reduced-motion guarded. Tests: 6/6 GREEN. `WorkspacePanel.tsx` mounts `<TodosSection>` in fixed-order accordion. |
| 3 | Workspace file browser lists thread files with click-to-preview; previews reuse MarkdownRenderer and syntax highlighting (ShikiCode); CSV renders as table; malformed/huge/null-url fall back gracefully | VERIFIED | `FilesSection.tsx`: `useWorkspaceFiles`, `role=listbox`/`option`, roving tabindex, `formatBytes`, `<FilePreview>` drill-in. `FilePreview.tsx`: `getWorkspaceFileContent`, imports `MarkdownRenderer`, `ShikiCode`, `CsvTablePreview`; zero `dangerouslySetInnerHTML`. `CsvTablePreview.tsx`: `<table>`, quote-aware parser, ≥2000-row / >256KB caps, malformed fallback. Tests: FilesSection 5/5, FilePreview 10/10, CsvTablePreview 6/6 GREEN. |
| 4 | Pending user input renders ask_user prompts with choice chips + free-text; submitting resumes the agent; expired prompts are calm; A2 run_id gate prevents blind POST | VERIFIED | `PendingAskCard.tsx`: `useAskUserPrompt`, `answerAskUser(run_id, …)`, `role=radiogroup`/`role=radio` chips, `aria-disabled` submit gate on `canSubmit && run_id != null`, `reconcile()` on missing run_id, optimistic green `.answered` + `aria-live="polite"`, calm `.expired` state. Zero `dangerouslySetInnerHTML`. Tests: PendingAskCard 10/10 GREEN. |
| 5 | Diff viewer renders pre-computed version deltas; user can pick any two versions; truncation is surfaced; ⤢ overlay shows same payload without a second fetch | VERIFIED | `diffParse.ts`: pure `parseUnifiedDiff`, classifies hunk/add/del/context/header, empty→[]; zero react/fetch imports. `VersionDiff.tsx`: `getWorkspaceFileDiff`, `parseUnifiedDiff`, `aria-label="base version N"/"target version N"`, truncation notice, `DiffExpandOverlay` wired. `DiffExpandOverlay.tsx`: Radix `Dialog` reuse (focus-trap/Escape/restore), zero fetch/getWorkspaceFileDiff calls. `DiffLines.tsx`: shared renderer. Tests: VersionDiff 14/14 GREEN (7 parser + 7 component). |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/lib/api.ts` | 4 workspace client fns (content/versions/diff/answerAskUser) | VERIFIED | All 4 functions present (lines 768, 785, 803, 825); follow `getAuthHeaders + fetch + non-OK throw` pattern; `answerAskUser` POSTs to `/runs/${runId}/ask_user_response` |
| `frontend/src/index.css` | `--warning`, `--warning-foreground`, `--muted-foreground-dim` in `.dark` | VERIFIED | Lines 60-64: `--warning: 38 92% 60%`, `--warning-foreground: 240 60% 8%`, `--muted-foreground-dim: 220 16% 45%` |
| `frontend/src/components/ui/sheet.tsx` | Bottom-sheet on `@radix-ui/react-dialog`, zero new dep | VERIFIED | Imports `@radix-ui/react-dialog` line 18; exports `Sheet`, `SheetContent`; no vaul in package.json |
| `frontend/src/types/index.ts` | 5 wire-mirror types | VERIFIED | `WorkspaceFileContentInline`, `WorkspaceFileContentBucket`, `WorkspaceFileContent` union, `WorkspaceVersion`, `WorkspaceDiff`, `AskUserAnswerBody` all present (lines 337–390) |
| `frontend/src/components/panel/__tests__/fixtures.ts` | Shared mock payloads + hook factories | VERIFIED | `mockPendingAskWithRunId`, `mockPendingAskNoRunId`, `mockContentInline`, `mockDiffString`, `mockDiffNonTruncated`, `mockDiffTruncated`, `mockCsvValid`, `mockCsvMalformed`, `makeHookReturn` all present |
| 7 test files under `__tests__/` | Wave 0 contract files (WorkspacePanel, TodosSection, FilePreview, CsvTablePreview, PendingAskCard, VersionDiff, Seam) | VERIFIED | All 9 files present (7 component test files + fixtures.ts + FilesSection.test.tsx added by Plan 03) |
| `frontend/src/components/panel/WorkspacePanel.tsx` | Panel shell, grid-state machine, ⌘. handler, empty short-circuit, section composition | VERIFIED | `useViewingThread`, `role="complementary"`, `metaKey/ctrlKey + "."` handler, `PanelEmpty`, all 4 section imports, `selectedFile`/`compare versions` guard, `Sheet` mobile path, `PendingAskStack` pinned |
| `frontend/src/components/panel/PanelSection.tsx` | Collapsible accordion with `aria-expanded` + `role=region` | VERIFIED | `aria-expanded` on button (line 59), `role="region"` body (line 91) |
| `frontend/src/components/panel/PanelEmpty.tsx` | "No workspace activity yet" centered empty state | VERIFIED | Copy present: "No workspace activity yet" |
| `frontend/src/components/panel/PanelRail.tsx` | 52px strip with count-bearing aria-labels + decorative badges | VERIFIED | `aria-label` includes counts ("Todos — N of M done", "Files — N", "Pending question — needs your answer"); amber warn badge present |
| `frontend/src/components/panel/TodosSection.tsx` | Live todo list with `useTodos` + non-color-only status | VERIFIED | `useTodos` imported; pending/in_progress/completed handled; icon + visible text label |
| `frontend/src/components/panel/FilesSection.tsx` | File list with `useWorkspaceFiles` + drill-in + `role=listbox` | VERIFIED | `useWorkspaceFiles`, `FilePreview` drill-in, `formatBytes`, `role="listbox"`/`"option"` |
| `frontend/src/components/panel/FilePreview.tsx` | Per-type router reusing ShikiCode + MarkdownRenderer, no `dangerouslySetInnerHTML` | VERIFIED | `ShikiCode` + `MarkdownRenderer` + `CsvTablePreview` imported; `getWorkspaceFileContent` wired; `‹ Files` back button; zero `dangerouslySetInnerHTML` in real code |
| `frontend/src/components/panel/CsvTablePreview.tsx` | `<table>` from CSV, size guards, no `dangerouslySetInnerHTML` | VERIFIED | `<table>` present; 2000-row / 256KB caps; malformed fallback; zero `dangerouslySetInnerHTML` |
| `frontend/src/lib/diffParse.ts` | Pure `parseUnifiedDiff`, zero react/fetch | VERIFIED | `export function parseUnifiedDiff` present; comment confirms "React-free + fetch-free" |
| `frontend/src/components/panel/VersionDiff.tsx` | Version pills + in-column diff + truncation notice + ⤢ | VERIFIED | `getWorkspaceFileDiff`, `parseUnifiedDiff`, `DiffExpandOverlay`, `aria-label` base/target pills, truncation notice wired |
| `frontend/src/components/panel/DiffExpandOverlay.tsx` | Radix Dialog, no second fetch | VERIFIED | `Dialog`/`DialogContent` imported; zero `getWorkspaceFileDiff`/`fetch` calls in real code |
| `frontend/src/components/panel/DiffLines.tsx` | Shared in-column diff renderer | VERIFIED | Present; extracted from DiffExpandOverlay + VersionDiff as shared sub-component (explicitly sanctioned by Plan 04 task text) |
| `frontend/src/components/panel/PendingAskCard.tsx` | Pinned amber answer card with `answerAskUser` + A2 gate | VERIFIED | `answerAskUser`, `useAskUserPrompt`, `run_id` gate, `radiogroup`/`role=radio`, `aria-disabled`, `aria-live`, zero `dangerouslySetInnerHTML` |
| `frontend/src/components/panel/SeamPointer.tsx` | Live one-line chat pointer for panel-owned tools | VERIFIED | `SeamKind` exported; "see panel" copy present; `write_todos`/`workspace_write`/`ask_user` handled |
| `frontend/src/components/panel/SeamCard.tsx` | Reloaded self-contained chat card, no raw JSON | VERIFIED | "open panel ↗" copy present; zero `JSON.stringify` |
| `frontend/src/components/panel/PausedRunCue.tsx` | Amber paused cue + "Agent is paused" | VERIFIED | "ask_user · awaiting your answer" + "Agent is paused" present |
| `frontend/src/components/panel/panelOpenSignal.ts` | Module-level event bus (additive seam wiring) | VERIFIED | Present; additive deviation from plan, documented in 087-02-SUMMARY decisions |
| `frontend/src/components/layout/ChatLayout.tsx` | Additive WorkspacePanel sibling mount | VERIFIED | `WorkspacePanel` import + `activeView === "chat" && <WorkspacePanel ...>` present; git diff confirms 6 ins / 0 del |
| `frontend/src/components/chat/MessageItem.tsx` | Additive SeamPointer/SeamCard/PausedRunCue mounts | VERIFIED | All three components imported + mounted additively; git diff confirms 108 ins / 0 del (Plan 05) + 6 ins / 0 del (Plan 02 seam wiring) |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `api.ts answerAskUser` | `POST /runs/{runId}/ask_user_response` | `fetch` with `method: "POST"` | WIRED | Line 831: `fetch(\`${API_BASE}/runs/${runId}/ask_user_response\`, { method: "POST", headers, body: JSON.stringify(body) })` |
| `api.ts getWorkspaceFileContent/Versions/Diff` | GET workspace endpoints | `getAuthHeaders + fetch + non-OK throw` | WIRED | All three GET fns present at lines 768/785/803 following established pattern |
| `sheet.tsx` | `@radix-ui/react-dialog` | `import * as DialogPrimitive` | WIRED | Line 18; no vaul dependency |
| `ChatLayout.tsx` | `WorkspacePanel` | additive sibling render when `activeView==='chat'` | WIRED | Line 202: `{activeView === "chat" && <WorkspacePanel selectedThread={selectedThread} />}` |
| `WorkspacePanel` | `FilesSection / TodosSection / VersionDiff / PendingAskStack` | section composition | WIRED | All four imported and rendered in fixed-order accordion |
| `WorkspacePanel` | `PanelEmpty` | empty short-circuit | WIRED | When `todos.length===0 && files.length===0 && pendingAsks.length===0` → renders `<PanelEmpty/>` |
| `WorkspacePanel VersionDiff` | `selectedFile` lifted from `FilesSection` | `onSelectFile` prop callback | WIRED | `FilesSection onSelectFile={setSelectedFile}`; `VersionDiff file={selectedFile}`; "Select a file to compare versions" null guard present |
| `WorkspacePanel` | `Sheet` (mobile) | `<768px` bottom-sheet render | WIRED | `Sheet open={state !== "hidden"}` + `SheetContent side="bottom"` at line 173 |
| `FilePreview` | `getWorkspaceFileContent` | `fetch on file select` | WIRED | Line 181: `getWorkspaceFileContent(threadId, file.id, controller.signal)` |
| `FilePreview code branch` | `ShikiCode` | import | WIRED | Line 31 import; line 239 usage |
| `VersionDiff` | `getWorkspaceFileDiff` | fetch on version pick | WIRED | Line 83: `getWorkspaceFileDiff(threadId, fileId, pair.from, pair.to, controller.signal)` |
| `VersionDiff` | `parseUnifiedDiff` | import | WIRED | Line 25 import; line 101 usage |
| `DiffExpandOverlay` | same parsed `DiffLine[]` | prop (no second fetch) | WIRED | Receives `lines: DiffLine[]` prop; zero `getWorkspaceFileDiff`/`fetch` calls in real code |
| `PendingAskCard submit` | `answerAskUser(run_id, body)` | POST on Send Answer | WIRED | Line 102: `await answerAskUser(run_id, { tool_call_id, response_text, choice_index })` |
| `MessageItem` | `SeamPointer / SeamCard / PausedRunCue` | additive sibling render | WIRED | All three imported (lines 18-20); `seamKindFor`/`seamCardPayloadFor` helpers + two additive mount blocks confirmed |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `WorkspacePanel` | `todos`, `files`, `pendingAsks` | Phase 086 reactive hooks (`useTodos`, `useWorkspaceFiles`, `useAskUserPrompt`) | Yes — hooks subscribe to SSE-backed Zustand Maps (Phase 086) | FLOWING |
| `TodosSection` | `todos: Todo[]` | `useTodos(threadId)` | Yes — Phase 086 hook; updates on `write_todos` SSE events | FLOWING |
| `FilesSection` | `files: WorkspaceFile[]` | `useWorkspaceFiles(threadId)` | Yes — Phase 086 hook | FLOWING |
| `FilePreview` | `content: WorkspaceFileContent` | `getWorkspaceFileContent(threadId, file.id, signal)` | Yes — authenticated fetch to RLS-protected backend endpoint | FLOWING |
| `VersionDiff` | `versions: WorkspaceVersion[]`, `diff: WorkspaceDiff` | `getWorkspaceFileVersions` + `getWorkspaceFileDiff` | Yes — authenticated fetches to workspace API endpoints | FLOWING |
| `PendingAskCard` | `asks: PendingAsk[]` | `useAskUserPrompt(threadId)` | Yes — Phase 086 hook; cleared by `ask_user_response` SSE | FLOWING |
| `DiffExpandOverlay` | `lines: DiffLine[]` | Prop from `VersionDiff` (same parse result) | Yes — receives parent's already-fetched + parsed payload | FLOWING |

---

### Behavioral Spot-Checks

Step 7b SKIPPED for running-server checks (no server active). Static checks performed instead:

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `answerAskUser` POST route correct | `grep "ask_user_response" api.ts` | `fetch(\`${API_BASE}/runs/${runId}/ask_user_response\`, { method: "POST" ... })` | PASS |
| `parseUnifiedDiff` is pure (no react/fetch) | `grep -c "react\|fetch" diffParse.ts` | 0 real code matches (only in comment) | PASS |
| Zero XSS surface in panel components | `grep dangerouslySetInnerHTML panel/` | 0 matches in real code; 2 in negating comments | PASS |
| Zero raw-JSON leak in seam | `grep JSON.stringify SeamPointer.tsx SeamCard.tsx` | 0 matches | PASS |
| ChatLayout change additive | `git diff --stat HEAD~15..HEAD -- ChatLayout.tsx` | 6 ins / 0 del | PASS |
| MessageItem change additive | `git diff --stat HEAD~15..HEAD -- MessageItem.tsx` | 108 ins / 0 del | PASS |
| vaul not added | `grep vaul package.json` | no match | PASS |
| Panel test suite | 67 passing / 0 failing across 8 files (orchestrator pre-verified) | 67/67 GREEN | PASS |
| Full suite baseline | 386 passed / 17 failed (orchestrator pre-verified) | 17 pre-existing failures unchanged | PASS |
| TypeScript | `tsc --noEmit` exits 0 (orchestrator pre-verified) | Clean | PASS |

---

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| PANEL-01 | 087-01, 087-02 | Right-side panel, collapsible, keyboard shortcut, mobile bottom-sheet | SATISFIED | WorkspacePanel: state machine, ⌘./Ctrl+. toggle, Sheet <768px, ChatLayout additive mount; WorkspacePanel.test.tsx 9/9 GREEN |
| PANEL-02 | 087-02 | Todos section renders live with status indicators, updates on write_todos SSE | SATISFIED | TodosSection: `useTodos`, non-color-only status (icon + text label), reactive; TodosSection.test.tsx 6/6 GREEN |
| PANEL-03 | 087-01, 087-03 | Workspace file browser + click-to-preview reusing MarkdownRenderer + syntax highlighting | SATISFIED | FilesSection + FilePreview + CsvTablePreview: all routing paths verified; ShikiCode reused (not react-syntax-highlighter); FilePreview 10/10 + CsvTablePreview 6/6 + FilesSection 5/5 GREEN |
| PANEL-04 | 087-01, 087-05 | ask_user prompts with choices + free-text, submit resumes agent | SATISFIED | PendingAskCard: stacked, run_id-gated, radiogroup chips, textarea, answerAskUser wired, optimistic green flip, calm expiry; PendingAskCard 10/10 GREEN |
| PANEL-07 | 087-01, 087-04 | Diff viewer for workspace file versions with pre-computed deltas | SATISFIED | diffParse.ts + VersionDiff + DiffExpandOverlay + DiffLines: pure parser, version pills with text+aria, truncation notice, ⤢ overlay (no second fetch); VersionDiff 14/14 GREEN |
| PANEL-05 | Phase 086 (NOT 087) | Single SSE subscription, demultiplexed by type | NOT IN SCOPE | Shipped in Phase 086; REQUIREMENTS.md traceability table confirms Phase 086; correctly excluded from 087 plans |
| PANEL-06 | Phase 086 (NOT 087) | Panel events routed to separate state stores | NOT IN SCOPE | Shipped in Phase 086; panelOpenSignal bus in Phase 087 carries no thread data (verified in 087-02 threat model T-087-17) |
| A11Y-01 | Phase 088 (NOT 087) | WCAG 2.1 AA full compliance | DEFERRED | Explicitly deferred to Phase 088; 087 bakes in the required structural affordances (aria-expanded, role=region, aria-labels, contrast tokens) |
| A11Y-02 | Phase 088 (NOT 087) | Keyboard navigation without mouse-only paths | DEFERRED | FilesSection role=listbox/option + roving tabindex already implemented; Phase 088 provides the formal A11Y gate |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `DiffLines.tsx` line 13 | `"never dangerouslySetInnerHTML"` string in comment | INFO | Negation comment only — grep false positive; no real usage; confirms intent |
| `VersionDiff.tsx` line 18 | `"never dangerouslySetInnerHTML"` in comment | INFO | Same — negation comment, not real usage |

No blockers found. No stubs in app components. The `it.todo` placeholders that existed in Plan 01 Wave 0 test files have all been flipped to live tests by Plans 02–05 (confirmed: 67 live tests, 0 todo remaining per 087-02-SUMMARY).

---

### Human Verification Required

The following items require live browser testing and cannot be verified programmatically. Per 087-VALIDATION.md and CLAUDE.md's 4-axis UAT rule, these are expected human-testing obligations for this phase.

#### 1. Panel Three-State Machine + Keyboard Toggle (Desktop)

**Test:** Open the app at http://localhost:5173, navigate to a chat thread. Click the panel toggle button three times; then use ⌘./Ctrl+. to toggle. Resize browser to 1024px wide.
**Expected:** Button click cycles open→rail→hidden→open with 300ms animated column transition; keyboard shortcut toggles open↔hidden directly; at 1024px the chat column stays readable (≥600px); amber pulsing dot appears on the toggle button when an ask_user is pending AND the panel is closed.
**Why human:** Grid-state-machine animation, the laptop-squeeze guard, and the amber pulse dot require live DOM rendering.

#### 2. Mobile Bottom-Sheet (<768px)

**Test:** Resize Chrome DevTools to 375px viewport width. Open panel toggle, interact with the sheet.
**Expected:** Panel renders as a bottom-sheet sliding up from the bottom edge (not a side column); .sheet-grip handle dismisses the sheet; sheet never visually occludes the chat composer; all tappable elements ≥44px touch targets.
**Why human:** Bottom-sheet DOM layout and touch target sizing require Chrome DevTools viewport simulation.

#### 3. ask_user Answer → Run Resume (Cross-Provider)

**Test:** With backend running, start a chat on OpenAI (or Anthropic / Google) that triggers `ask_user`. In the panel, type an answer and click Send Answer.
**Expected:** Chat run-card turns amber + composer locks when ask_user fires; panel shows stacked amber card(s) newest-top; answer submits, card flips green with "Answered · agent resumed"; run continues; card disappears reactively once SSE clears it; composer unlocks. Repeat for at least 2 additional providers.
**Why human:** Cross-worker Redis pub/sub resume + SSE ask_user_response clearing + composer-lock interplay require a running backend + real provider round-trip. This is the CLAUDE.md MANDATORY cross-provider axis.

#### 4. ask_user Reload Gap Closure

**Test:** Trigger ask_user, answer it, then reload the page. Inspect the chat transcript.
**Expected:** The answered Q&A appears as a SeamCard (self-contained "You answered: <value>" + "open panel ↗") in the chat transcript — not as a quiet SeamPointer (live-only), and not as raw JSON.
**Why human:** Persistence + reloaded-vs-live mode routing in MessageItem can only be verified across a real page reload.

#### 5. Rapid Thread-Switch Reconcile-Abort (086 Carry-Forward)

**Test:** Start Thread A streaming with a workspace write. Immediately switch to Thread B and trigger a prompt.
**Expected:** Panel reflects Thread B's state (not Thread A's); Thread A's panel GET requests appear as "cancelled" in the DevTools Network tab (no stale cross-thread data visible in the panel).
**Why human:** AbortController cancel timing is a network-timing race; no unit proxy; requires DevTools Network panel.

#### 6. 4-Axis Cross-Provider UAT Scoreboard

**Test:** Execute the CLAUDE.md MANDATORY 4-axis scoreboard: (a) cross-provider: trigger write_todos + workspace_write + ask_user on OpenAI, Anthropic, Google, OpenRouter; (b) multi-tool: one prompt that writes a file AND a todo; (c) parallel-thread: Thread A streaming while Thread B accepts a prompt; (d) long-message: ≥50 prior messages then trigger a panel tool.
**Expected:** Panel renders identically across providers for all panel-owned tool events. Multi-tool row: both Files and Todos sections update. Parallel-thread row: panel switches cleanly with no cross-thread bleed. Long-message row: state updates with no drop.
**Why human:** CLAUDE.md's MANDATORY UAT rule for phases touching streaming/provider/UI-state. Cannot verify without live backend + real provider credentials.

---

### Gaps Summary

No programmatic gaps found. All 5 roadmap success criteria are met by verified, substantive, wired, data-flowing code. The 67/67 panel test suite (orchestrator-pre-verified) and clean tsc build corroborate the grep-level evidence.

The 6 human verification items above are the expected lived-experience UAT obligations documented in 087-VALIDATION.md. They are not blockers to the code being correct — they are the mandatory cross-provider + responsive + E2E gates that require a running backend and browser.

### Deferred Items

Items not in Phase 087 scope, covered by Phase 088:

| # | Item | Addressed In | Evidence |
|---|------|-------------|---------|
| 1 | WCAG 2.1 AA full compliance (A11Y-01) | Phase 088 | Phase 088 SC#2: "All panel surfaces pass WCAG 2.1 AA" |
| 2 | Keyboard-only file browser + todo navigation formal gate (A11Y-02) | Phase 088 | Phase 088 SC#3: "File browser and todo list fully navigable via keyboard alone" |
| 3 | 4-axis UAT matrix across all providers (CLAUDE.md SC#10) | Phase 088 | Phase 088 SC#1: "4-axis UAT matrix complete: all new SSE event types verified across OpenAI, Anthropic, Google, and OpenRouter" |
| 4 | E2E workspace flow (write → view → diff → ask → resume) verified across ≥2 providers | Phase 088 | Phase 088 SC#4: "E2E workspace flow verified ... across at least 2 providers" |

Note: Items 3–4 in the deferred list overlap with the human_verification section above. The human_verification items are the Phase 087 portion of the UAT that the developer should run now to close the phase responsibly. Phase 088 provides the formal cross-cutting gate with the full matrix.

---

_Verified: 2026-05-29_
_Verifier: Claude (gsd-verifier)_
