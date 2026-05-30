# Phase 087: Panel UI - Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 19 (16 new · 3 modified)
**Analogs found:** 19 / 19 (all matched — this is a translation-from-sketch + reuse-existing job, not greenfield)

> Frontend-only phase. All backend endpoints + Phase 086 reactive hooks already exist. New components live in a NEW dir `frontend/src/components/panel/`. The G-5 hot files (`MessageItem`/`StreamsProvider`) are touched **additively only** (mount points), never internally re-architected.

---

## File Classification

| New/Modified File | Role | Data Flow / Hook | Closest Analog | Match Quality |
|-------------------|------|------------------|----------------|---------------|
| `frontend/src/components/panel/WorkspacePanel.tsx` | panel shell / layout-state host | `useViewingThread` + all panel hooks | `frontend/src/components/chat/ChatArea.tsx` (thread-scoped consumer + grid host) | role-match |
| `frontend/src/components/panel/PanelRail.tsx` | collapsed-rail nav | counts derived from hooks | `frontend/src/components/layout/ChatLayout.tsx:156-180` (icon-button nav row) | role-match |
| `frontend/src/components/panel/PanelSection.tsx` | collapsible primitive | — | `frontend/src/components/ui/collapsible.tsx` + `panel-shell.md` `.sec-head`/`.sec-body` | exact (sketch CSS) |
| `frontend/src/components/panel/PanelEmpty.tsx` | empty short-circuit | — | `frontend/src/components/chat/ChatArea.tsx:288-336` (centered welcome empty state) | exact (sketch CSS) |
| `frontend/src/components/panel/TodosSection.tsx` | live list section | `useTodos` → `Todo[]` | `frontend/src/components/chat/MessageList.tsx` (live-array → row map) | role-match |
| `frontend/src/components/panel/FilesSection.tsx` | file list section | `useWorkspaceFiles` → `WorkspaceFile[]` | `frontend/src/components/chat/OutputFileCard.tsx` (file-row chrome) | role-match |
| `frontend/src/components/panel/FilePreview.tsx` | full-replace drill-in router | content API (new client fn) | `MarkdownRenderer.tsx` + `tool-bodies/ShikiCode.tsx` (per-type render) | exact (reuse) |
| `frontend/src/components/panel/CsvTablePreview.tsx` | CSV `<table>` (D-01) | parses inline `content` string | NO ANALOG — see §No Analog | new |
| `frontend/src/components/panel/VersionDiff.tsx` | client-side unified-diff parser + renderer | versions + diff API (new client fns) | `workspace_service.compute_diff` (wire shape) + `file-browser-and-diff.md` CSS | exact (sketch CSS) |
| `frontend/src/components/panel/DiffExpandOverlay.tsx` | opt-in wide diff dialog | — | `frontend/src/components/ui/dialog.tsx` | exact (reuse) |
| `frontend/src/components/panel/PendingAskCard.tsx` | pinned amber answer card | `useAskUserPrompt` → `PendingAsk[]` + POST answer | `pending-question.md` CSS + `ChatArea.tsx:376-403` (amber banner) | exact (sketch CSS) |
| `frontend/src/components/panel/PausedRunCue.tsx` | chat-side paused cue (additive) | streaming run state | `frontend/src/components/chat/RunCard.tsx` / `StatusPill.tsx` | role-match |
| `frontend/src/components/panel/SeamPointer.tsx` | live one-line chat pointer | live event mode | `chat-panel-seam.md` `.pointer` CSS | exact (sketch CSS) |
| `frontend/src/components/panel/SeamCard.tsx` | reloaded self-contained card | reloaded event mode | `chat-panel-seam.md` `.seam-card` CSS + `OutputFileCard.tsx` (file chip) | exact (sketch CSS) |
| `frontend/src/components/ui/sheet.tsx` | mobile bottom-sheet primitive | — | `frontend/src/components/ui/dialog.tsx` (Radix Dialog wrapper) | role-match (shadcn add) |
| `frontend/src/lib/api.ts` (MODIFIED) | API client fns | content / versions / diff / ask-answer | `api.ts:709-753` (the 4 Phase-086 GET helpers) | exact |
| `frontend/src/index.css` (MODIFIED) | design tokens | — | `index.css:36-55` (`.dark` block, `--success` precedent) | exact |
| `frontend/src/components/chat/MessageItem.tsx` (MODIFIED) | seam mount point | additive renders | `MessageItem.tsx:206-208` + `:339` | exact (additive) |
| `frontend/src/components/layout/ChatLayout.tsx` (MODIFIED) | grid host / 3rd column | mounts `WorkspacePanel` | `ChatLayout.tsx:69-197` (the flex layout host) | exact (additive) |

---

## Wire Contracts (LOAD-BEARING — executor must match these exactly)

### `useAskUserPrompt` → `PendingAsk[]` (D-03)
Hook: `StreamsProvider.tsx:1798-1815` returns `{ data: PendingAsk[]; isLoading; error; reconcile }`.

`PendingAsk` (`frontend/src/types/index.ts:295-303`):
```typescript
export interface PendingAsk {
  tool_call_id: string   // identity key (NOT ask_id), required
  prompt: string
  options: string[]      // [] when the call supplies no choices → render free-text only (D3)
  timeout_seconds: number
  message_id?: string    // GET-only (panel.py); absent on SSE flat payload
  run_id?: string        // GET-only; REQUIRED to POST the answer (route is /runs/{run_id}/...)
  created_at?: string
}
```
Render the FULL array, newest pinned on top, each its own sticky amber card (D-03). The hook return shape `{ data, isLoading, error, reconcile }` is IDENTICAL for `useTodos`/`useWorkspaceFiles`/`useTasks` (`StreamsProvider.tsx:1758-1834`) — all four are null-safe (`data` is never `undefined`, empty ref is stable).

### `GET /threads/{tid}/workspace/files/{id}/content` → preview source (D-02)
Backend: `workspace.py:124-199`. TWO response shapes (branch on `storage_type`):
```jsonc
// inline files (md/code/csv/text) — decoded UTF-8 string:
{ "id","path","size_bytes","mime_type", "storage_type":"inline", "content":"<text>" }
// bucket/binary/large files — 60s-TTL signed URL:
{ "id","path","size_bytes","mime_type", "storage_type":"bucket", "signed_url":"<url|null>" }
```
`FilePreview` routing: `storage_type==="inline"` → route by mime/ext (md→MarkdownRenderer, code→ShikiCode, csv→CsvTablePreview); `storage_type==="bucket"` + image mime → frame `signed_url` in `<img>`; else → calm "No preview available · Download" fallback (mandatory, must not break layout). `signed_url` CAN be `null` (backend best-effort) — treat null as fallback.

### `GET /threads/{tid}/workspace/files/{id}/diff?from=&to=` → `VersionDiff` source (D-04)
Backend: `workspace.py:238-323` → `workspace_service.compute_diff` (`workspace_service.py:99-132`). Wire shape:
```jsonc
{
  "path": "summary.md",
  "from_version": 2,
  "to_version": 3,
  "delta": {
    "format": "unified",
    "diff": "--- v2\n+++ v3\n@@ -1,5 +1,7 @@\n context\n-old\n+new\n",  // RAW unified-diff STRING
    "stats": { "additions": 12, "deletions": 3 },
    "truncated": true   // backend truncates at 500 diff lines (compute_diff:123-125)
  },
  "stats": { "additions": 12, "deletions": 3 }
}
```
`VersionDiff` parses `delta.diff` **client-side** (split on `\n`): lines starting `@@`→hunk header, `+`(not `+++`)→add, `-`(not `---`)→del, else→context. Render with the fixed 16px sign-gutter (`.diff .sign { width:16px }`). Surface `delta.truncated===true` in the UI. The `⤢` overlay shows the SAME payload — no extra fetch.

### `GET /threads/{tid}/workspace/files/{id}/versions` → version pills
Backend: `workspace.py:202-235` → `[{ id, version, size_bytes, created_at }]` sorted version DESC. Drives the red-base/green-target pill strip; one-click default = latest two (`Compare v{n-1}↔v{n}`).

### POST answer → un-pause run (D-03, PANEL-04)
Backend: `runs.py:496-584`, route `POST /runs/{run_id}/ask_user_response`, body:
```typescript
{ tool_call_id: string; response_text: string; choice_index: number | null }
```
NO frontend client fn exists yet — must be ADDED to `api.ts`. `run_id` comes from `PendingAsk.run_id`. Persist-first, then publish (backend); on 200 the SSE `ask_user_response` event removes the prompt from the store (`api.ts:564`), which reactively clears the card.

### Token vars to add (D-Claude's-discretion, UI-SPEC Open Contract #1)
`index.css:36` opens `.dark { … }`; `--success: 142 71% 45%` already lives at `index.css:54` (the precedent). Add alongside it:
```css
--warning: 38 92% 60%;
--warning-foreground: 240 60% 8%;   /* the #06061a amber-button text, as HSL channels */
/* dim label var — name at executor discretion, e.g.: */
--muted-foreground-dim: 220 16% 45%;
```
Verify contrast ≥4.5:1 on the two at-risk amber pairs (darken dim bg, don't lighten text).

---

## Pattern Assignments

### `frontend/src/components/panel/WorkspacePanel.tsx` (panel shell, all-hooks consumer)
**Analog:** `frontend/src/components/chat/ChatArea.tsx`

**Thread-scoped hook consumption** (`ChatArea.tsx:61-68`) — copy this null-safe pattern:
```typescript
const isStreaming = useStreamingForThread(thread?.id ?? null)
// → for the panel:
const threadId = useViewingThread()                  // StreamsProvider.tsx:1836
const { data: todos } = useTodos(threadId)           // never undefined; empty ref stable
const { data: files } = useWorkspaceFiles(threadId)
const { data: pendingAsks } = useAskUserPrompt(threadId)
```
**Empty short-circuit (D3):** when `todos.length === 0 && files.length === 0 && pendingAsks.length === 0` (+ no versions), render `<PanelEmpty/>` — NEVER four empty headers (`panel-shell.md` D3 / "What to Avoid").

**Grid-state machine** (`panel-shell.md` CSS lines 30-44): classes `panel-collapsed | panel-rail | (open)`; `grid-template-columns: 52px 1fr clamp(300px,30%,420px)`; transition `var(--dur-slow)` (320ms). `⌘.`/`Ctrl+.` toggle (D6). Use `<aside role="complementary" aria-label="Agent workspace">` (UI-SPEC A11Y).

### `frontend/src/components/panel/PanelSection.tsx` (collapsible primitive)
**Analog:** `frontend/src/components/ui/collapsible.tsx` (Radix) + `panel-shell.md:47-55`.
`.sec-head` MUST be a real `<button aria-expanded>` with chevron `aria-hidden`; Enter/Space toggle (UI-SPEC A11Y). Count badge right-aligned (`margin-left:auto`, mono); `.count.warn` → amber when pending-Q.

### `frontend/src/components/panel/PanelEmpty.tsx` (empty short-circuit)
**Analog:** `ChatArea.tsx:302-333` (centered `flex items-center justify-center`, icon + heading + body). Copy: heading `No workspace activity yet`, body per UI-SPEC Copywriting. `panel-shell.md:69-73` CSS.

### `frontend/src/components/panel/FilesSection.tsx` + `FilePreview.tsx` (file browser, full-replace drill-in)
**Analog (row chrome):** `OutputFileCard.tsx:109-145` (icon + mono filename + meta + truncation). **Analog (per-type render):** `MarkdownRenderer.tsx:14` (`<MarkdownRenderer content={...} />`) and `tool-bodies/ShikiCode.tsx` for code.

> **Renderer note:** UI-SPEC says "react-syntax-highlighter" but the LIVE code path for code highlighting is **Shiki** (`tool-bodies/ShikiCode.tsx`, added Phase 075.8). `react-syntax-highlighter@16.1.1` IS in `package.json` but is not the active highlighter. Executor should reuse `ShikiCode` (the real in-repo analog) for parity with chat code blocks — confirm with planner if the SPEC's literal mention must be honored instead. No NEW dep either way.

`formatBytes` already exists at `OutputFileCard.tsx:24-28` — copy/extract, don't re-derive. File-row states: `:hover` (`bg-accent`), `.sel` (primary-dim + primary-glow), `.flash` (green `fileFlash` 1.4s). A11Y: `role="listbox"/option` or roving tabindex, Enter/Space opens, Escape returns to list. `‹ Files` back button mandatory.

### `frontend/src/components/panel/VersionDiff.tsx` + `DiffExpandOverlay.tsx`
**Analog (CSS):** `file-browser-and-diff.md:57-72`. **Analog (overlay):** `frontend/src/components/ui/dialog.tsx` (Radix → focus trap + Escape + restore free). Parse `delta.diff` string per the Wire Contracts §diff above. Red `.a`=base/green `.b`=target pills with text/aria (not color-only — UI-SPEC A11Y). `role="region" aria-label="Diff v2 to v3"`.

### `frontend/src/components/panel/PendingAskCard.tsx` (D-03, PANEL-04)
**Analog (CSS):** `pending-question.md:32-81`. **Analog (amber chrome precedent):** `ChatArea.tsx:361-364` amber-banner + `:376-403` (`role="status" aria-live`). Render `PendingAsk[]` as a stack (newest top, all `position:sticky;top:0;z-index:4`). Choice chips = `<button role="radio">` in a `radiogroup`; free-text always present (D3); `Send Answer` `aria-disabled` until pick-or-type. On submit → call new `answerAskUser(run_id, {tool_call_id, response_text, choice_index})`; flip green `.answered`; announce via `aria-live="polite"`. Countdown from `timeout_seconds`; expiry → calm `.expired`, never a crash (D5).

### Seam renderers — `SeamPointer.tsx` / `SeamCard.tsx` / `PausedRunCue.tsx` (D-05 — ADDITIVE ONLY)
**Analogs (CSS):** `chat-panel-seam.md:32-54` (`.pointer`, `.seam-card`, `.qa`) and `pending-question.md:75-81` (`.run-card.paused`). **Mount point:** `MessageItem.tsx:206-208` (next to `<RunCard>`) for live `SeamPointer`; bottom near `:339` (`finalOutputFiles.map`) for reloaded `SeamCard`. **Mode-aware:** `live → SeamPointer`, `reloaded → SeamCard` (mode = "from currently-streaming run vs rehydrated history"). `SeamCard` file chip reuses `OutputFileCard` shape + an "open panel ↗" primary link. **D-05 / BUG-260529-02:** purely additive — do NOT alter existing card internals, do NOT fold into card unification, must NOT worsen existing tool cards.

### `frontend/src/components/ui/sheet.tsx` (mobile bottom-sheet — NOT yet present)
**Analog:** `frontend/src/components/ui/dialog.tsx` (Radix Dialog wrapper already in repo). `@radix-ui/react-dialog@^1.1.15` is installed; `sheet` is the standard shadcn slide-from-edge variant of Dialog (`react-sheet`/Dialog with `side` styling). Add via shadcn or hand-author as a Dialog variant — official block, no third-party registry. Used by `WorkspacePanel` at `<768px` (`panel-shell.md` D5 — `translateY`, `.sheet-grip`, never occlude composer).

### `frontend/src/lib/api.ts` (MODIFIED — add client fns)
**Analog:** `api.ts:709-753` (the four Phase-086 GET helpers — `getAuthHeaders()` + `fetch` + non-OK throw, optional `AbortSignal`). ADD:
- `getWorkspaceFileContent(threadId, fileId, signal?)` → content shape (inline|bucket)
- `getWorkspaceFileVersions(threadId, fileId, signal?)` → version list
- `getWorkspaceFileDiff(threadId, fileId, from, to, signal?)` → diff `delta`
- `answerAskUser(runId, { tool_call_id, response_text, choice_index })` → POST `/runs/{runId}/ask_user_response` (mirror an existing POST helper for the body/headers shape; `runs.py:496`).

### `frontend/src/components/layout/ChatLayout.tsx` (MODIFIED — grid host)
**Analog:** itself, `ChatLayout.tsx:184-196`. Currently `<div flex h-screen>` with `<NavPanel>` + `<main flex-1>`. Mount `<WorkspacePanel>` as a SIBLING after `<main>` only when `activeView==="chat"` (the panel is chat-surface-only). The push/split grid lives inside `WorkspacePanel`'s own container per `panel-shell.md` D1 — keep `ChatLayout` change minimal (one additive sibling render + pass `selectedThread`).

---

## Shared Patterns

### Hook consumption contract (all 4 panel hooks)
**Source:** `StreamsProvider.tsx:1758-1834`
**Apply to:** WorkspacePanel, TodosSection, FilesSection, PendingAskCard
Every hook returns `{ data: T[]; isLoading: boolean; error: Error | null; reconcile: () => Promise<void> }`. `data` is NEVER `undefined`; the empty array is a stable module-level ref (PANEL-06 — safe to use directly in deps/selectors). `useViewingThread()` (`:1836`) gives the current `threadId | null` to pass in.

### API client fetch wrapper
**Source:** `api.ts:709-717` (`getThreadTodos`)
**Apply to:** all 4 new client fns in `api.ts`
```typescript
export async function getX(threadId: string, signal?: AbortSignal): Promise<T> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/threads/${threadId}/...`, { headers, signal })
  if (!res.ok) throw new Error("Failed to ...")
  return (await res.json()) as T
}
```

### Reuse-first renderers (SC#3 — no new UI deps)
**Source:** `MarkdownRenderer.tsx:14` · `tool-bodies/ShikiCode.tsx` · `ui/dialog.tsx` · `OutputFileCard.tsx:24-28` (`formatBytes`)
**Apply to:** FilePreview, VersionDiff/DiffExpandOverlay, FilesSection/SeamCard. Do NOT re-add markdown, syntax-highlight, dialog, or byte-formatting logic — import the existing ones.

### Amber / status color language (LOCKED — never swap)
**Source:** UI-SPEC Color + `pending-question.md`
**Apply to:** PendingAskCard, PausedRunCue, PanelRail warn badge. amber=needs-you/paused · green=done/answered/diff-added · red=diff-removed/base · primary=live/pointer/selected/focus. Token `--warning` must be added to `index.css` first (precedent: `--success` at `index.css:54`).

### Accessibility contract (Phase 088 gate — bake in now)
**Source:** UI-SPEC Accessibility Contract
**Apply to:** every interactive panel element. `<aside role=complementary>`, section heads `<button aria-expanded>`, rail icons `<button>` with count-bearing `aria-label` (badge `aria-hidden`), file list keyboard nav, dialog focus-trap (free via Radix), choice chips `role=radio` in `radiogroup`, `aria-live` on answer + pending-Q, visible `--ring` focus, `prefers-reduced-motion` respected.

---

## No Analog Found

| File | Role | Data Flow | Reason / Mitigation |
|------|------|-----------|---------------------|
| `frontend/src/components/panel/CsvTablePreview.tsx` | CSV `<table>` preview | parses inline `content` string | D-01 + UI-SPEC Open Contract #3: no CSV renderer exists in repo. Build a minimal in-panel `<table>` from the CSV string (split lines/commas — basic quote-aware split), NO new dependency. Graceful fallback to "No preview available · Download" when malformed or too large. This is the one preview type with no ready renderer. |

> `sheet.tsx` is listed as role-match (not no-analog) because `ui/dialog.tsx` is a direct Radix-Dialog analog and `sheet` is the official shadcn slide variant of the same primitive.

---

## Metadata

**Analog search scope:** `frontend/src/components/{panel,chat,ui,layout}/`, `frontend/src/{lib,types,providers}/`, `backend/app/api/{workspace,panel,runs}.py`, `backend/app/services/workspace_service.py`, sketch refs 004–007.
**Files scanned:** ~30
**Pattern extraction date:** 2026-05-29
