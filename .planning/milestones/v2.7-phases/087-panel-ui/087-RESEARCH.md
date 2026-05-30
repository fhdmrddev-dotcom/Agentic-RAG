# Phase 087: Panel UI - Research

**Researched:** 2026-05-29
**Domain:** Frontend React panel UI (workspace panel) — reactive consumption of Phase 086 hooks, file/diff rendering, ask_user resume, responsive shell
**Confidence:** HIGH (every wire contract verified against live code; visuals locked by approved UI-SPEC + sketches)

## Summary

Phase 087 is a **translation + reuse job, not a design or research job**. The visual/interaction contract is fully locked by the approved 087-UI-SPEC (6/6 checker dimensions) and operator-approved sketches 004–007. All backend endpoints (Phases 084/085) and all reactive frontend hooks (Phase 086) already exist and are verified live. The phase ships **frontend-only**: ~14 new components under a new `frontend/src/components/panel/` dir, 4 new `api.ts` client fns, a `sheet.tsx` shadcn primitive, two CSS token additions, and **additive-only** mount points in two G-5 files (`ChatLayout.tsx` grid host, `MessageItem.tsx` seam renderers). No new migrations, no new API routes, no new heavy dependencies. [VERIFIED: codebase grep + file reads]

The five key research questions resolve cleanly against the live code:
1. **Diff:** backend emits a **raw unified-diff STRING** (`delta.diff`), truncated at 500 lines. The client parses it line-by-line — **no diff library needed**. [VERIFIED: workspace_service.py:99-132, workspace.py:238-323]
2. **Responsive:** use a shadcn **Sheet** primitive (Radix Dialog variant) for the `<768px` bottom-sheet — `sheet.tsx` is NOT yet in `components/ui/` and must be added; `@radix-ui/react-dialog@^1.1.15` is installed, `vaul` is NOT. [VERIFIED: ls components/ui + package.json]
3. **ask_user resume:** POST `/runs/{run_id}/ask_user_response` (persist-first-then-publish) un-pauses the run; the resulting `ask_user_response` SSE removes the prompt from the store, reactively clearing the card. No client fn exists yet — must be added. [VERIFIED: runs.py:496-585]
4. **Panel shell seam:** the live app layout is `flex h-screen` (NOT a CSS grid yet) — the push/split three-column grid is introduced inside the panel's own container; `ChatLayout` gets one additive sibling render. [VERIFIED: ChatLayout.tsx:69-197]
5. **Preview reuse:** md→`MarkdownRenderer`, code→`ShikiCode` (the LIVE highlighter — `react-syntax-highlighter` is in package.json but imported NOWHERE), csv→new minimal `<table>` (one type with no existing renderer), image→framed signed URL, else→graceful fallback. [VERIFIED: grep usage]

**Primary recommendation:** Build the panel components 1:1 from the UI-SPEC + sketch CSS, bind each section to its Phase 086 hook, parse the unified-diff string client-side (no lib), reuse `MarkdownRenderer`/`ShikiCode`/`dialog`/`formatBytes`, add a `Sheet` primitive for mobile, and keep both G-5 file touches strictly additive. Re-run the deferred 086 rapid-thread-switch reconcile-abort UAT live once the hooks have a real consumer mounted.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (CSV preview):** CSV files get a **minimal in-panel `<table>`** rendered from the CSV — **no new dependency**. Graceful fallback to "No preview available · Download" when the CSV is malformed or too large. The one preview type with no existing renderer; md/code/text reuse `MarkdownRenderer` + (live) syntax highlighting.
- **D-02 (file content):** Content from `GET /workspace/files/{id}/content` (built): inline files return `{storage_type:"inline", content}`; bucket/binary files return `{storage_type:"bucket", signed_url}` (60s TTL). Image preview frames the signed URL; binary/too-large → calm "no preview · Download" fallback (must not break layout).
- **D-03 (parallel ask_user):** Multiple simultaneous `ask_user` prompts **stack — newest pinned on top, each its own amber card, all sticky, no cap**. `useAskUserPrompt` returns `PendingAsk[]`; render the full array. Submit on any card un-pauses the run + unlocks the composer.
- **D-04 (diff):** Diff from `GET /workspace/files/{id}/diff?from=&to=` (built). Wire shape is a **raw unified-diff string**, not pre-parsed hunks: `{ path, from_version, to_version, delta:{ format:"unified", diff:"<string>", stats:{additions,deletions}, truncated:bool }, stats }`. **`VersionDiff` parses the unified-diff string client-side.** Render in-column `+/−` with the fixed 16px sign-gutter. Backend truncates at 500 diff lines and sets `truncated:true` — surface that state; the `⤢` overlay shows the same truncated payload (no extra fetch).
- **D-05 (BUG-260529-02 routing):** Chat tool-card unification bug → **kept SEPARATE** as its own future phase. Phase 087 adds only the *additive* seam renderers (`SeamPointer`/`SeamCard`/`PausedRunCue`) and **must not worsen** existing cards. `PausedRunCue` is additive, not folded into card unification.
- **D-06 (BUG-260521-02 routing):** "Final outputs" pinned-panel download-link bug → **kept SEPARATE**. Different surface (old pinned card in `MessageItem`) from the new Workspace panel; not 087 scope. Existing `re_open_trigger` stands.

### Claude's Discretion
- **Token additions:** add `--warning: 38 92% 60%` (+ `--warning-foreground`) and a dim-text var to `index.css :.dark` before building — a token addition matching `[theme]`, not a redesign. Executor decides exact var naming.
- **Empty-state heading copy:** use UI-SPEC's recommended `No workspace activity yet` + body, unless a different voice surfaces at plan-phase.
- **Contrast verification:** executor verifies the two at-risk amber pairs hit ≥4.5:1 (darken dim background rather than lighten text if needed).

### Deferred Ideas (OUT OF SCOPE)
- **BUG-260529-02** (chat tool-card unification: auto-scroll, collapse-by-default, sub-agent card dedup) — its own future phase. 087 must not worsen it.
- **BUG-260521-02** ("Final outputs" pinned-panel download link) — separate re-verify via Chrome MCP later; not 087.
- **User inline file editing** — explicitly out of scope per REQUIREMENTS; v2.8.
- **`workspace_delete` user-facing control** — agent tool only; no destructive panel UI this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PANEL-01 | Collapsible right-side panel (~30% width) next to chat, togglable via button + keyboard shortcut; mobile (<768px) = bottom-sheet overlay | Panel-shell sketch + UI-SPEC layout grid (52px/1fr/clamp(300px,30%,420px)); `⌘.`/`Ctrl+.` toggle; live layout is `flex h-screen` so the grid is introduced inside the panel container; `Sheet` primitive for <768px (must be added) |
| PANEL-02 | Todos section renders live todo list with status indicators; updates real-time on `write_todos`, no refresh | `useTodos(threadId)` → `Todo[]` reactive hook (verified StreamsProvider.tsx:1758); `checkPop` on complete; full-replace identity |
| PANEL-03 | Workspace file browser lists thread files with click-to-preview for text/md/code; reuse MarkdownRenderer + syntax highlighting | `useWorkspaceFiles` + `GET /content` two-shape response (verified workspace.py:124-199); FilePreview per-type routing; reuse `MarkdownRenderer` + `ShikiCode` (the live highlighter) |
| PANEL-04 | Pending user input section renders `ask_user` prompts with choice buttons + free-text; submit resumes the agent in the same panel view | `useAskUserPrompt` → `PendingAsk[]`; new `answerAskUser(runId, body)` → POST `/runs/{run_id}/ask_user_response` (verified runs.py:496); SSE `ask_user_response` clears the card reactively |
| PANEL-07 | Diff viewer renders pre-computed version deltas with syntax highlighting; user selects any two versions to compare | `GET /diff?from=&to=` raw unified-diff string (verified workspace_service.py:99); `VersionDiff` parses client-side; `GET /versions` red-base/green-target pills; opt-in `⤢` overlay |

*(PANEL-05/06 — single SSE subscription + separate state stores — already shipped in Phase 086.)*
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Panel shell layout / collapse / responsive | Browser / Client (React) | — | Pure presentation; grid-state machine + `⌘.` handler live in `WorkspacePanel` |
| Reactive section data (todos/files/asks/tasks) | Frontend state (Zustand via Phase 086 hooks) | API (reconcile-on-thread-switch GET) | SSE demux already lands in 4 Maps (Phase 086); panel only *reads* + triggers reconcile on mount/thread-switch |
| File content / versions / diff fetch | API / Backend (already built) | Browser (render only) | All compute (diff, signed-URL, truncation) is backend; client renders the wire payload |
| Diff parsing + rendering | Browser / Client | — | Backend emits raw unified-diff STRING; client splits + colorizes (no lib, no compute) |
| ask_user answer submit + resume | API / Backend (Redis pub/sub resume) | Browser (POST + optimistic UI) | Persist-first-then-publish is backend; panel POSTs and waits for `ask_user_response` SSE to clear |
| Seam renderers (live pointer / reload card) | Browser / Client | — | Additive chat-transcript rendering; mode = live-run vs rehydrated history |

## Standard Stack

### Core (all already in repo — NO new install for these)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | (repo) | Component layer | App framework [VERIFIED: package.json] |
| zustand | (repo, via StreamsProvider) | Reactive panel state | Phase 086 hooks read from a Zustand store; panel consumes via 4 named hooks [VERIFIED: StreamsProvider.tsx] |
| `@radix-ui/react-dialog` | ^1.1.15 | Diff expand overlay + base for mobile Sheet | Already installed; gives focus-trap + Escape + restore free [VERIFIED: package.json] |
| shiki | ^4.1.0 | Code-file + diff syntax highlighting (the LIVE highlighter) | `ShikiCode` is the active in-repo code renderer; `react-syntax-highlighter` is in package.json but imported NOWHERE [VERIFIED: grep — 0 imports of react-syntax-highlighter in src/] |
| lucide-react | ^0.577.0 | Icons (file/chevron/warning) | Project icon lib [CITED: components.json] |
| tailwindcss | (repo) | Styling | Project stack [VERIFIED: CLAUDE.md] |

### Supporting (must be ADDED this phase)
| Item | Source | Purpose | When to Use |
|------|--------|---------|-------------|
| `frontend/src/components/ui/sheet.tsx` | shadcn official block (Radix Dialog variant) | Mobile (<768px) bottom-sheet container | Added via `npx shadcn@latest add sheet` OR hand-authored as a Dialog `side="bottom"` variant. NOT a third-party registry. [VERIFIED: not present in components/ui/] |
| 4 new `api.ts` client fns | hand-written, mirror existing helper shape | content / versions / diff fetch + ask_user answer POST | `getWorkspaceFileContent`, `getWorkspaceFileVersions`, `getWorkspaceFileDiff`, `answerAskUser` [VERIFIED: api.ts:709-753 pattern] |
| `--warning` / `--warning-foreground` / dim-text CSS vars | `index.css :.dark` | Amber ask_user treatment + dim labels | Add before building; precedent `--success` at index.css:54 [VERIFIED: index.css:36-61] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side unified-diff string parse | `diff` / `react-diff-viewer` / `diff2html` npm | REJECTED — SC#3 forbids new UI deps; backend already emits a parsed-enough unified-diff string; a lib would add 20–80 KB for what is a ~15-line `split('\n')` + prefix-switch. The sketch CSS already defines the exact `.dl.add/.del/.ctx/.hunk` rendering. [VERIFIED: workspace_service.py emits ready-to-render string] |
| shadcn `Sheet` (Radix Dialog) | `vaul` (the shadcn Drawer dep) | `vaul` is NOT installed; adding it is a new dep (against SC#3). Radix Dialog (installed) + a `side="bottom"` style variant covers the bottom-sheet need with focus-trap free. [VERIFIED: package.json — no vaul] |
| `ShikiCode` for code preview | `react-syntax-highlighter` (literal UI-SPEC mention) | UI-SPEC literally says "react-syntax-highlighter" but the LIVE code path is Shiki (added Phase 075.8). `ShikiCode` gives parity with chat code blocks. **Flag for planner** (Open Question #1). [VERIFIED: grep — RSH has 0 imports, ShikiCode is active] |

**Installation:**
```bash
# Only the Sheet primitive — everything else is already present
npx shadcn@latest add sheet   # OR hand-author a Dialog side="bottom" variant
# NO npm install of diff/highlight/drawer libs (SC#3)
```

**Version verification (performed this session):**
```
@radix-ui/react-dialog  ^1.1.15  [VERIFIED: package.json grep]
shiki                   ^4.1.0   [VERIFIED: package.json grep]
react-syntax-highlighter ^16.1.1 [VERIFIED: present but UNUSED — 0 src imports]
lucide-react            ^0.577.0 [CITED: components.json]
vaul                    (absent) [VERIFIED: package.json grep — not installed]
```

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────── BACKEND (Phases 084/085 — built) ──────────────────────┐
  agent loop ─ write_todos / workspace_write / ask_user ─▶ SSE _emit ─▶ Redis run stream
                                                          │                                              │
  GET /threads/{tid}/todos · /workspace/files · /ask_user/pending · /tasks   (reconcile sources)        │
  GET /workspace/files/{id}/content   → {storage_type:inline|bucket, content|signed_url}                │
  GET /workspace/files/{id}/versions  → [{id,version,size_bytes,created_at}] DESC                       │
  GET /workspace/files/{id}/diff      → {delta:{diff:"<unified string>", stats, truncated}}             │
  POST /runs/{run_id}/ask_user_response → persist(messages) ─▶ SSE ask_user_response ─▶ pub/sub resume  │
                         └──────────────────────────────────────────────────────────────────────────────┘
                                       │ single demuxed SSE subscription (Phase 086 / PANEL-05)
                                       ▼
        ┌──────────────────── FRONTEND state (Phase 086 — live) ────────────────────┐
        │  api.ts dispatch → makeStreamCallbacks → 4 per-thread Zustand Maps         │
        │  (todosByThread · workspaceFilesByThread · pendingAsksByThread · tasks…)   │
        │  exposed via 4 named hooks {data,isLoading,error,reconcile}, data≠undefined│
        └───────────────────────────────────────────────────────────────────────────┘
                                       │ panel reads reactively (NO chat re-render — PANEL-06)
                                       ▼
   ┌──────────────────────── THIS PHASE (087 — frontend-only) ───────────────────────────────┐
   │  ChatLayout (flex host) ── additive sibling ──▶ WorkspacePanel (push/split grid + ⌘.)     │
   │     ├─ PanelEmpty (short-circuit when 0 activity)                                          │
   │     ├─ PendingAskCard[]  ← useAskUserPrompt   ── submit → answerAskUser() → SSE clears     │
   │     ├─ TodosSection      ← useTodos                                                        │
   │     ├─ FilesSection      ← useWorkspaceFiles  ── click → FilePreview (md/code/csv/img/fb)  │
   │     ├─ VersionDiff       ← getDiff (parse string client-side) ── ⤢ → DiffExpandOverlay     │
   │     └─ PanelRail (52px collapsed strip + count/warn badges)                                │
   │  MessageItem ── additive ──▶ SeamPointer (live) / SeamCard (reloaded) / PausedRunCue       │
   └────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
frontend/src/components/panel/        # NEW dir — all panel components
├── WorkspacePanel.tsx                # shell, grid-state machine, ⌘. handler, empty short-circuit
├── PanelRail.tsx                     # 52px collapsed strip + count/warn badges
├── PanelSection.tsx                  # generic collapsible .sec-head/.sec-body primitive
├── PanelEmpty.tsx                    # centered empty short-circuit
├── TodosSection.tsx                  # useTodos
├── FilesSection.tsx                  # useWorkspaceFiles + file rows
├── FilePreview.tsx                   # full-replace drill-in, per-type routing
├── CsvTablePreview.tsx               # NEW — minimal <table>, no dep (D-01)
├── VersionDiff.tsx                   # client-side unified-diff parse + render
├── DiffExpandOverlay.tsx             # shadcn dialog wide diff
├── PendingAskCard.tsx                # pinned amber card, answer + resume
├── SeamPointer.tsx                   # live one-line chat pointer (additive)
├── SeamCard.tsx                      # reloaded self-contained card (additive)
└── PausedRunCue.tsx                  # chat-side paused cue (additive)
frontend/src/components/ui/sheet.tsx  # NEW — mobile bottom-sheet primitive
frontend/src/lib/api.ts               # MODIFIED — 4 new client fns
frontend/src/index.css                # MODIFIED — --warning + dim-text tokens
frontend/src/components/layout/ChatLayout.tsx   # MODIFIED — additive panel sibling
frontend/src/components/chat/MessageItem.tsx    # MODIFIED — additive seam mount points
```

### Pattern 1: Reactive hook consumption (all 4 panel hooks identical contract)
**What:** Every Phase 086 hook returns `{ data: T[]; isLoading; error; reconcile }`. `data` is NEVER undefined (module-level EMPTY constant fallback, stable ref → safe in deps/selectors per PANEL-06).
**When to use:** every section component + the shell.
```typescript
// Source: VERIFIED StreamsProvider.tsx:1758-1834
const threadId = useViewingThread()                  // string | null
const { data: todos } = useTodos(threadId)           // Todo[]; never undefined
const { data: files } = useWorkspaceFiles(threadId)  // WorkspaceFile[]
const { data: pendingAsks } = useAskUserPrompt(threadId)  // PendingAsk[]
// Empty short-circuit (D3): render <PanelEmpty/> when all four are empty
```

### Pattern 2: Client-side unified-diff parse (NO library)
**What:** Split `delta.diff` on `\n`; classify each line by prefix.
**When to use:** `VersionDiff` + `DiffExpandOverlay` (same payload, no extra fetch).
```typescript
// Source: VERIFIED workspace_service.py:99-132 emits Python difflib.unified_diff output
// line classification:
//   "@@ ..."  → hunk header   (primary indigo bg)
//   "+" (not "+++") → addition  (green .dl.add, sign "+")
//   "-" (not "---") → deletion  (red .dl.del, sign "−")
//   "--- vN" / "+++ vN" → file headers (skip or render as meta)
//   else → context (.dl.ctx)
// Fixed 16px sign gutter (.diff .sign{width:16px}); .diff scrolls-x, never wraps.
// Surface delta.truncated===true ("diff truncated at 500 lines").
```

### Pattern 3: ask_user answer + resume (persist-first SSE-clears)
**What:** POST the answer; backend persists then publishes; the `ask_user_response` SSE removes the prompt from the store → the card reactively clears.
**When to use:** `PendingAskCard` submit.
```typescript
// Source: VERIFIED runs.py:496-585 + PATTERNS wire contract
// new api.ts fn (mirror the POST helper shape at api.ts:40/347/790):
//   answerAskUser(runId, { tool_call_id, response_text, choice_index })
//   → POST /runs/{runId}/ask_user_response  (run_id comes from PendingAsk.run_id)
// On 200: optimistic green .answered state; SSE ask_user_response then clears
// the prompt from pendingAsksByThread (api.ts dispatch) → run un-pauses, composer unlocks.
// NOTE: PendingAsk.run_id is GET-only (panel.py); REQUIRED to POST. SSE flat payload
// omits run_id — so the answer path depends on the GET-reconciled prompt carrying run_id.
```

### Pattern 4: Additive panel mount into flex layout (NOT a grid rewrite)
**What:** The live `ChatLayout` is `flex h-screen` with `<NavPanel>` + `<main flex-1>`. Mount `<WorkspacePanel>` as a sibling after `<main>`, only when `activeView==="chat"`. The push/split grid lives inside `WorkspacePanel`'s own container — keep the `ChatLayout` change minimal.
**When to use:** the one `ChatLayout` touch.
```tsx
// Source: VERIFIED ChatLayout.tsx:184-197 (flex, not grid)
<main className="flex-1 overflow-hidden"> … <ChatArea …/> … </main>
{activeView === "chat" && <WorkspacePanel selectedThread={selectedThread} />}
```

### Anti-Patterns to Avoid
- **Adding a diff/highlight/drawer npm package** — SC#3 forbids new UI deps; everything needed is in-repo (Shiki, Radix Dialog, MarkdownRenderer) or a string parse.
- **Re-architecting G-5 hot files** — `ChatLayout` + `MessageItem` are touched ADDITIVELY only (one sibling render / new seam renderers). Never modify `RunCard`/`ToolCallPanel` internals (D-05).
- **Rendering the same data richly in both chat and panel** — single source of truth: live state in panel, history in transcript. Live → quiet pointer; reloaded → self-contained card.
- **Four empty section headers** — always short-circuit to one `<PanelEmpty/>` when there's zero workspace activity.
- **Auto-widening the panel for a diff** — never; the `⤢` opens an opt-in overlay over chat.
- **Letting a pending ask go silent on collapse** — rail warn badge + toggle pulse-dot are mandatory.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown preview | Custom MD parser | `MarkdownRenderer.tsx` (import) | Already handles GFM + code blocks + sanitization; reused in 4 places [VERIFIED: grep] |
| Code syntax highlighting | New highlighter / RSH | `ShikiCode` (import) | The live highlighter (Phase 075.8); VSCode-quality tokens; singleton WASM cache [VERIFIED: ShikiCode.tsx] |
| Diff parsing | A diff npm lib | `split('\n')` + prefix switch | Backend already emits ready unified-diff string; sketch CSS defines the render exactly [VERIFIED: workspace_service.py] |
| Byte formatting | `formatBytes` re-derive | `OutputFileCard.tsx:24` `formatBytes` (extract/import) | Exists; copy or hoist [VERIFIED: OutputFileCard.tsx:24] |
| Focus-trap / Escape / restore on the wide-diff overlay | Manual keydown handlers | shadcn `dialog` (Radix) | Radix gives focus-trap + Escape + focus-restore free [VERIFIED: ui/dialog.tsx present] |
| Mobile bottom-sheet slide/dismiss | Custom transform state machine | `Sheet` (Radix Dialog `side="bottom"`) | Standard shadcn block; focus management free [VERIFIED: vaul absent, dialog present] |
| Reconcile-on-thread-switch + abort | Per-component AbortController | `usePanelReconcile` (already inside the 4 hooks) | Phase 086 factored this; hooks already abort stale fetches [VERIFIED: usePanelReconcile.ts] |
| SSE→store demux for panel events | New event handling | Phase 086 dispatch (done) | 6 SSE branches already route into 4 Maps; panel only reads [VERIFIED: 086-01-SUMMARY] |

**Key insight:** This phase's entire value is *binding existing reactive data to locked visuals*. Almost every "hard" subproblem (streaming, diff compute, reconcile, highlighting, markdown) was already solved upstream. The only genuinely-new code is the CSV `<table>` (no analog) and the unified-diff string parser (trivial).

## Common Pitfalls

### Pitfall 1: PendingAsk.run_id absent on the SSE path
**What goes wrong:** Submitting an answer needs `run_id` (route is `/runs/{run_id}/ask_user_response`), but the SSE `ask_user_prompt` flat payload omits `run_id` — only the GET reconcile (`panel.py`) carries it.
**Why it happens:** Two ingestion paths (live SSE vs GET reconcile) have different payload shapes; SSE is flat.
**How to avoid:** Ensure the panel can always POST — the GET-reconciled prompt carries `run_id`. If a prompt arrives only via SSE without `run_id`, the submit must trigger a reconcile (or be disabled until reconcile fills `run_id`). Plan a verification that a live-SSE-only ask is still answerable.
**Warning signs:** "answer button does nothing" on a freshly-streamed ask before any thread-switch/reconcile.

### Pitfall 2: react-syntax-highlighter vs Shiki mismatch
**What goes wrong:** Following the UI-SPEC literally would import `react-syntax-highlighter`, which is in package.json but UNUSED — adding a second highlighter to the bundle and diverging from chat code blocks.
**Why it happens:** UI-SPEC was written from the design substrate; the live highlighter switched to Shiki in Phase 075.8.
**How to avoid:** Reuse `ShikiCode`. Confirm with the planner that the SPEC's literal mention is superseded (PATTERNS already flags this). [VERIFIED]
**Warning signs:** two highlighting code paths; inconsistent token colors between a code preview and a chat code block.

### Pitfall 3: Layout is flex, not grid (yet)
**What goes wrong:** Plans assume the sketch's three-column CSS grid already exists in `ChatLayout`; it does not (`flex h-screen`).
**Why it happens:** Sketch CSS shows the target grid; the live host is still flex.
**How to avoid:** Introduce the push/split grid inside `WorkspacePanel`'s own container (or convert the chat+panel region to grid) — keep the `ChatLayout` change to one additive sibling render. Verify the laptop-squeeze guard (`clamp(300px,30%,420px)`, chat ≥600px floor at 1024px). [VERIFIED: ChatLayout.tsx:69-197]
**Warning signs:** chat run-card tool output wrapping illegibly at ~1024px; panel overlapping rather than pushing.

### Pitfall 4: Diff truncation silently dropping content
**What goes wrong:** Backend truncates at 500 diff lines and sets `truncated:true`, but the UI shows a partial diff as if complete.
**Why it happens:** `delta.truncated` not surfaced.
**How to avoid:** Render an explicit "diff truncated at 500 lines" notice when `delta.truncated===true`; the `⤢` overlay shows the SAME (still-truncated) payload — no second fetch. [VERIFIED: workspace_service.py:123-125]
**Warning signs:** a large file's diff looks suspiciously short with no notice.

### Pitfall 5: signed_url can be null
**What goes wrong:** Image preview frames a `null` signed URL → broken `<img>`.
**Why it happens:** Backend signed-URL creation is best-effort; `signed_url` can be `null`.
**How to avoid:** Treat `storage_type==="bucket"` with `signed_url===null` as the calm fallback ("No preview available · Download"). [VERIFIED: workspace.py:176-198 url may stay None]
**Warning signs:** broken image icon in the preview.

### Pitfall 6: Panel re-rendering chat (PANEL-06 regression)
**What goes wrong:** Mounting the panel hooks accidentally re-renders the chat message list on every panel event.
**Why it happens:** Selecting from the store too broadly, or sharing a selector with chat.
**How to avoid:** The 4 hooks already use isolated Maps + EMPTY-ref fallbacks; consume them as-is. Verify via Chrome MCP that a panel SSE event does NOT flicker the chat list (re-run the Phase 086 isolation check live). [VERIFIED: 086-02-SUMMARY PANEL-06]
**Warning signs:** chat messages flicker when a todo/file event arrives.

## Runtime State Inventory

> Not a rename/refactor/migration phase — greenfield frontend feature. Section omitted by trigger rule. (No stored data renames, no live-service config, no OS-registered state, no secret renames, no build-artifact renames involved.)

## Code Examples

### File preview per-type routing (D-02)
```typescript
// Source: VERIFIED workspace.py:124-199 (two response shapes) + PATTERNS D-02
// GET /threads/{tid}/workspace/files/{id}/content →
//   inline: { id, path, size_bytes, mime_type, storage_type:"inline", content:"<text>" }
//   bucket: { id, path, size_bytes, mime_type, storage_type:"bucket", signed_url:"<url|null>" }
// FilePreview routing:
//   inline + md       → <MarkdownRenderer content={content} />
//   inline + code      → <ShikiCode code={content} language={langFromExt(path)} />
//   inline + csv       → <CsvTablePreview content={content} />   (new, no dep)
//   bucket + image mime + signed_url → <img src={signed_url} />
//   else / signed_url null / too-large → calm "No preview available · Download" fallback
```

### Diff fetch + version pills (PANEL-07)
```typescript
// Source: VERIFIED workspace.py:202-235 (versions) + :238-323 (diff)
// GET /versions → [{ id, version, size_bytes, created_at }] sorted version DESC
//   → red .vchip.a = base/before, green .vchip.b = target/after
//   → one-click default Compare v{n-1}↔v{n} (latest two)
// GET /diff?from=&to= → { path, from_version, to_version,
//                         delta:{ format:"unified", diff:"<string>", stats:{additions,deletions}, truncated:bool },
//                         stats:{additions,deletions} }
//   → parse delta.diff client-side (Pattern 2); surface delta.truncated
```

### New api.ts client fn shape (mirror existing)
```typescript
// Source: VERIFIED api.ts:709-717 (getThreadTodos pattern)
export async function getWorkspaceFileDiff(
  threadId: string, fileId: string, from: number, to: number, signal?: AbortSignal,
): Promise<WorkspaceDiff> {
  const headers = await getAuthHeaders()
  const res = await fetch(
    `${API_BASE}/threads/${threadId}/workspace/files/${fileId}/diff?from=${from}&to=${to}`,
    { headers, signal },
  )
  if (!res.ok) throw new Error("Failed to fetch diff")
  return (await res.json()) as WorkspaceDiff
}
// answerAskUser mirrors the POST helpers at api.ts:40/347/790 (method:"POST", JSON body)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-syntax-highlighter` for code | `ShikiCode` (Shiki 4, WASM, singleton) | Phase 075.8 | Reuse `ShikiCode`, not RSH, despite UI-SPEC's literal mention |
| Panel-owned tools fall through to raw-JSON chat row; answered ask_user vanishes on reload | Mode-aware seam renderers (live pointer / reload card) | This phase (087) | Closes the documented ask_user reload gap; additive, not card-unification |
| No reactive panel data | Phase 086 4 Maps + 4 named hooks + reconcile | Phase 086 (shipped) | Panel is pure consumer; no fetch/dispatch logic to build |

**Deprecated/outdated:**
- `react-syntax-highlighter` in package.json: present but **dead** (0 imports). Do not introduce new usage; prefer `ShikiCode`. Removing it from package.json is OUT of scope for 087.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | UI-SPEC's literal "react-syntax-highlighter" is superseded by `ShikiCode` for code preview | Standard Stack / Pitfall 2 | LOW — both render code; using ShikiCode gives chat parity. Planner should confirm the SPEC's mention is non-binding. |
| A2 | A live-SSE-only ask_user (no run_id yet) is answerable after reconcile fills run_id | Pitfall 1 | MEDIUM — if a prompt can be answered while still SSE-only, submit could 404. Plan should verify the run_id source on the submit path. |
| A3 | Adding `sheet.tsx` via shadcn does not pull `vaul` | Standard Stack | LOW — the Radix-Dialog `side="bottom"` variant avoids vaul; if `shadcn add sheet` tries to add vaul, hand-author the Dialog variant instead. |

**If a planner needs more certainty on A2:** read `backend/app/api/panel.py` (the `/ask_user/pending` GET) and `ask_user_service.py` to confirm `run_id` is always present on the GET-reconciled `PendingAsk`, and trace whether the SSE `ask_user_prompt` payload can be enriched with `run_id` at emit time.

## Open Questions (RESOLVED during planning — 2026-05-29)

1. **Code highlighter: ShikiCode vs the SPEC's literal RSH mention.**
   - What we know: `ShikiCode` is the live highlighter; `react-syntax-highlighter` has 0 imports.
   - What's unclear: whether the UI-SPEC author intended the literal lib or "the app's syntax highlighting."
   - Recommendation: reuse `ShikiCode`; note the substitution in the plan for the UI checker.
   - **RESOLVED:** ShikiCode adopted (not react-syntax-highlighter) — 087-03 Task 2; acceptance asserts `grep -c "react-syntax-highlighter"` returns 0. SPEC's literal mention treated as non-binding ("the app's syntax highlighting").

2. **ask_user submit run_id source on a pure-SSE prompt.**
   - What we know: `run_id` is GET-only on `PendingAsk`; the route needs it.
   - What's unclear: whether a brand-new SSE prompt (pre-reconcile) carries enough to POST.
   - Recommendation: gate submit on `run_id` presence (trigger a reconcile if missing), and add a UAT row exercising answer-immediately-after-live-prompt.
   - **RESOLVED:** Submit gated on `run_id != null` + reconcile-if-missing on mount — 087-05 Task 1; `mockPendingAskNoRunId` fixture + no-run_id behavior test (087-01 Task 3). Answer-immediately-after-live-prompt is a cross-provider UAT row in 087-VALIDATION.md.

3. **Sheet primitive: shadcn add vs hand-author.**
   - What we know: `vaul` is not installed; Radix Dialog is.
   - Recommendation: prefer hand-authoring a Dialog `side="bottom"` variant to guarantee no new dep; only `npx shadcn add sheet` if it confirms no vaul pull.
   - **RESOLVED:** Hand-authored `sheet.tsx` from Radix Dialog `side="bottom"` — 087-01 Task 2; `npx shadcn add sheet` forbidden, acceptance asserts `grep -c "vaul" package.json` returns 0.

## Environment Availability

> Frontend-only phase consuming already-built backend endpoints and already-installed deps. All external dependencies are in-repo.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Backend workspace/panel/runs endpoints | All sections | ✓ (Phases 084/085) | live | — |
| Phase 086 hooks + Zustand store | All sections | ✓ | live | — |
| `@radix-ui/react-dialog` | Diff overlay + Sheet base | ✓ | ^1.1.15 | — |
| shiki / `ShikiCode` | Code preview + diff | ✓ | ^4.1.0 | plain `<pre>` (ShikiCode already degrades) |
| `MarkdownRenderer` | md preview + ask_user rich text | ✓ | live | — |
| `sheet.tsx` ui primitive | Mobile bottom-sheet | ✗ | — | hand-author Dialog `side="bottom"` (no new dep) |
| `vaul` | (would back a Drawer) | ✗ | — | NOT used — Radix Dialog covers it |
| Dev app + Chrome DevTools MCP | UAT | ✓ | localhost:5173, login fhdmrd@gmail.com/123456 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `sheet.tsx` (hand-author from Radix Dialog).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.0 (+ @vitest/ui) [VERIFIED: package.json] |
| Config file | `frontend/vitest.config.ts` [VERIFIED] |
| Quick run command | `cd frontend && npx vitest run <path>` |
| Full suite command | `cd frontend && npm test` (`vitest run`) |
| Real-browser UAT | Chrome DevTools MCP (project convention; login fhdmrd@gmail.com/123456 at http://localhost:5173) |

**Note on baseline:** Phase 086 reported a known ~17-failure pre-existing baseline in `StreamsProvider.dedup.test.ts` / `streamsProvider.test.tsx` / `streamsProvider_075_9_clientkey.test.tsx` (argsCodeText/dedup/clientKey/068-reconcile) — unrelated to panel work. Phase 087 tests must not regress beyond that baseline; new panel tests are GREEN-only.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PANEL-01 | Panel toggles open/rail/hidden via button + `⌘.`; mobile <768px = bottom-sheet | unit (state machine) + manual (Chrome MCP responsive) | `npx vitest run src/components/panel/__tests__/WorkspacePanel.test.tsx` | ❌ Wave 0 |
| PANEL-02 | Todos render live with status; update on `write_todos` no refresh | unit (render from `useTodos` mock) + manual (Chrome MCP live) | `npx vitest run src/components/panel/__tests__/TodosSection.test.tsx` | ❌ Wave 0 |
| PANEL-03 | File list + click-to-preview routes md/code/csv/img/fallback correctly | unit (per-type routing) + manual (Chrome MCP preview) | `npx vitest run src/components/panel/__tests__/FilePreview.test.tsx` | ❌ Wave 0 |
| PANEL-03 | CSV renders as table; malformed/huge → fallback | unit | `npx vitest run src/components/panel/__tests__/CsvTablePreview.test.tsx` | ❌ Wave 0 |
| PANEL-04 | ask_user card renders choices+free-text; submit disabled until pick/type; submit → answered + resume | unit (render+submit-gate) + manual (Chrome MCP resume) | `npx vitest run src/components/panel/__tests__/PendingAskCard.test.tsx` | ❌ Wave 0 |
| PANEL-07 | Diff parses unified string into add/del/ctx/hunk; truncation surfaced; version pick red-base/green-target | unit (string parser) + manual (Chrome MCP diff) | `npx vitest run src/components/panel/__tests__/VersionDiff.test.tsx` | ❌ Wave 0 |
| Seam (D-05) | Live → pointer, reloaded → card; no raw-JSON leak; additive (no card-internals change) | unit (mode routing) + manual (Chrome MCP reload) | `npx vitest run src/components/panel/__tests__/Seam.test.tsx` | ❌ Wave 0 |
| Carry-fwd | Rapid thread-switch reconcile-abort, now with real hook consumer | manual (Chrome MCP — re-run deferred 086 UAT live) | n/a (Network panel: A's panel GET shows cancelled; B shows own data) | n/a |

### Lived-experience UAT (CLAUDE.md G-4 — operator-defined "I'd recognize failure here", Chrome MCP drives all):
- Watch a slow multi-tool run end-to-end: todos update live in the panel while chat shows only quiet pointers (no duplicate rich cards), no chat flicker on panel events (PANEL-06).
- Trigger `ask_user`: chat run-card turns amber + composer locks + toggle pulses when panel closed; answer in panel → run resumes in-place, composer unlocks, card flips green.
- Reload mid-/post-question: the answered Q&A appears as a self-contained card in chat (closes the reload gap); panel shows current state only.
- Resize 375 / 768 / 1024 / 1440: bottom-sheet below 768 never occludes composer + grip dismisses; at 1024 chat keeps a readable floor (no illegible run-card wrap); 1440 comfortable two-canvas.

### Cross-provider UAT (CLAUDE.md UAT scoreboard — 4 axes, all 6 native providers):
Panel data is provider-agnostic (shared SSE vocabulary), but the panel is the first real consumer, so re-exercise:
- **Cross-provider:** trigger write_todos + workspace_write + ask_user on OpenAI, Anthropic, Google (3.x+), OpenRouter, DeepSeek, Moonshot — panel renders identically (one UX, four+ adapters).
- **Multi-tool:** one prompt that writes a file AND a todo list — both sections update.
- **Parallel-thread:** Thread A streaming while Thread B accepts a prompt — panel switches cleanly, no cross-thread bleed (the deferred 086 abort test, now live).
- **Long-message:** ≥50 prior messages or ≥5 KB prompt that triggers a panel tool — state updates with no drop.

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run src/components/panel/` (panel suite quick run)
- **Per wave merge:** `cd frontend && npm test` (full suite; must not regress past the known baseline)
- **Phase gate:** full suite green (minus known baseline) + Chrome MCP lived-experience UAT + cross-provider scoreboard before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `src/components/panel/__tests__/WorkspacePanel.test.tsx` — covers PANEL-01 (toggle state machine, empty short-circuit)
- [ ] `src/components/panel/__tests__/TodosSection.test.tsx` — covers PANEL-02
- [ ] `src/components/panel/__tests__/FilePreview.test.tsx` — covers PANEL-03 routing
- [ ] `src/components/panel/__tests__/CsvTablePreview.test.tsx` — covers PANEL-03 CSV + fallback
- [ ] `src/components/panel/__tests__/PendingAskCard.test.tsx` — covers PANEL-04 (submit gate, run_id presence, answered state)
- [ ] `src/components/panel/__tests__/VersionDiff.test.tsx` — covers PANEL-07 (string parse, truncation, pill color/aria)
- [ ] `src/components/panel/__tests__/Seam.test.tsx` — covers seam mode routing + no-raw-JSON
- [ ] Shared test fixtures: mock `useTodos`/`useWorkspaceFiles`/`useAskUserPrompt` + sample wire payloads (content inline/bucket, diff string with hunks, versions list)
- [ ] Framework install: none — Vitest present.

## Security Domain

> `security_enforcement` not explicitly false in config — section included. Frontend-only, no new auth surface; all reads go through existing authenticated, RLS-protected, thread-ownership-verified endpoints.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No new auth; reuses `getAuthHeaders()` bearer token on every fetch [VERIFIED: api.ts pattern] |
| V3 Session Management | no | No new session state |
| V4 Access Control | yes (inherited) | Every endpoint calls `_verify_thread_ownership` (404 not 403 on miss — no existence leak) [VERIFIED: workspace.py:136, runs.py:512-524 user_id scoping] |
| V5 Input Validation | yes | ask_user answer body validated by Pydantic `AskUserResponseBody` (backend); free-text rendered as text, not HTML; MarkdownRenderer already sanitizes [VERIFIED: runs.py body model] |
| V6 Cryptography | no | Signed URLs (60s TTL) generated server-side; client only consumes |
| V7 Error Handling | yes | Diff truncation + signed_url null + preview fallback must degrade calmly, never crash/leak |

### Known Threat Patterns for React panel consuming agent output
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via file content / diff / ask_user prompt rendered as HTML | Tampering | Render via `MarkdownRenderer` (sanitizes) / `ShikiCode` (escapes) / plain text in CSV `<table>` and diff lines — never `dangerouslySetInnerHTML` on raw file content |
| Cross-thread data bleed on rapid switch | Information Disclosure | `usePanelReconcile` aborts stale fetches + keys writes by the thread the fetch was invoked with (Phase 086 FC#5) — re-verify live this phase |
| Signed-URL leakage / stale | Information Disclosure | 60s TTL server-side; client never persists; null → fallback |
| Answering another user's run | Spoofing / Access Control | Backend `runs` query scoped by `user_id`; 404 on foreign run [VERIFIED: runs.py:512-524] |
| localStorage cross-user cache leak | Information Disclosure | Phase 086 user-scoped cache key + version guard (inherited; no new persistence in 087) |

## Sources

### Primary (HIGH confidence — verified this session via tool)
- `backend/app/services/workspace_service.py:99-132` — `compute_diff` unified-diff string + 500-line truncation [VERIFIED: Read]
- `backend/app/api/workspace.py:124-323` — content (inline/bucket two-shape), versions, diff endpoints [VERIFIED: Read]
- `backend/app/api/runs.py:496-585` — `ask_user_response` persist-first-then-publish [VERIFIED: Read]
- `frontend/src/providers/StreamsProvider.tsx:1758-1837` — 4 named hooks + `useViewingThread` contract [VERIFIED: Read]
- `frontend/src/lib/api.ts:709-753` — Phase 086 GET helper pattern (template for new fns) [VERIFIED: Read]
- `frontend/src/components/layout/ChatLayout.tsx:69-197` — live layout is `flex h-screen`, not grid [VERIFIED: Read]
- `frontend/src/index.css:36-61` — `.dark` token block, `--success` precedent, no `--warning` yet [VERIFIED: Read]
- `frontend/package.json` + `components/ui/` listing — Shiki active, RSH unused, no vaul, no sheet.tsx, Vitest 4 [VERIFIED: Bash grep/ls]
- `frontend/src/components/chat/{MarkdownRenderer,ShikiCode,OutputFileCard,MessageItem}.tsx` — reuse signatures + mount points [VERIFIED: Bash grep]
- `.planning/phases/086-*/086-0{1,2}-SUMMARY.md` + `086-UAT.md` — reactive data contract + deferred abort UAT [VERIFIED: Read]

### Primary (HIGH confidence — locked design contract)
- `.planning/phases/087-panel-ui/087-UI-SPEC.md` — approved 6/6 visual/interaction contract [CITED]
- `.planning/phases/087-panel-ui/087-CONTEXT.md` — locked decisions D-01..D-06 [CITED]
- `.planning/phases/087-panel-ui/087-PATTERNS.md` — analog map + wire contracts [CITED]
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` + `references/{panel-shell,file-browser-and-diff,pending-question,chat-panel-seam}.md` — sketches 004–007 [CITED]

### Secondary (MEDIUM confidence)
- none needed — every claim verified against live code or the locked contract.

### Tertiary (LOW confidence)
- none.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dep verified in package.json; reuse targets confirmed present and active.
- Architecture: HIGH — all wire contracts read directly from backend + frontend source; layout reality (flex not grid) confirmed.
- Pitfalls: HIGH — each derived from a verified code fact (run_id GET-only, RSH unused, truncation flag, signed_url null, flex host).
- Visuals: HIGH (locked) — UI-SPEC approved 6/6; this research does not re-open them.

**Research date:** 2026-05-29
**Valid until:** 2026-06-28 (stable — local codebase facts; re-verify only if Phase 086/084/085 endpoints or hook signatures change before planning)
