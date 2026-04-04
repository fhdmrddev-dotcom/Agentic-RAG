# Phase 15: Code Output UI — Research

**Researched:** 2026-04-03
**Domain:** React SSE event handling, real-time streaming UI, file download cards, Tailwind dark terminal styling
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SAND-12 | Frontend displays a Code Output panel that renders stdout/stderr stream and shows download links for output files | All five success criteria map directly to new React state fields + a new `ExecuteCodeBlock` component wired into `ToolCallPanel.tsx` |

</phase_requirements>

---

## Summary

Phase 15 is a pure-frontend phase. The backend already emits four new SSE event types (`code_execution_start`, `code_stdout`, `code_stderr`, `code_execution_complete`) from Phase 14. The frontend currently ignores all four. This phase wires them end-to-end: adds new callbacks to `streamMessage()` in `api.ts`, threads those callbacks through `useMessages.ts`, extends the `ToolCall` type to carry live stdout/stderr lines and completed output file metadata, and adds an `ExecuteCodeBlock` component inside `ToolCallPanel.tsx` that replaces the generic tool row for `execute_code`.

The design constraint is the existing dark-theme component library (Tailwind + shadcn/ui). Terminal output should use `bg-zinc-900` or equivalent with `text-green-400`/`text-red-400` for stdout/stderr respectively. The existing `ToolCallPanel` pattern — collapsible card with spinner-to-checkmark transition, `bg-muted/30 ghost-border` when done, `bg-primary/5 border-primary/20` while running — must be preserved for all other tools; `execute_code` gets its own richer inline block inside the same container.

**Primary recommendation:** Add a single `ExecuteCodeBlock` component (≈150 lines) that handles all four execution states (idle → running → complete → error), wire four new callbacks into the existing SSE pipeline, and extend `ToolCall` with three new optional fields. No new files beyond the component itself; everything plugs into existing patterns.

---

## Project Constraints (from CLAUDE.md)

- Frontend: React + Vite + Tailwind + shadcn/ui — no other UI frameworks
- Backend: Python + FastAPI — not touched in this phase
- No LangChain / LangGraph — irrelevant, frontend-only phase
- Stream chat responses via SSE — this phase consumes the existing SSE stream
- Plans saved to `.agent/plans/` — NOTE: project CLAUDE.md says `.agent/plans/`; GSD saves to `.planning/phases/` per roadmap; use `.planning/phases/` per established project convention
- Each plan must include at least one validation test per task

---

## Standard Stack

### Core (already installed — no new packages required)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| React | 18.x | Component state, hooks | Already in project |
| Tailwind CSS | 3.x | Utility styling | Already configured |
| shadcn/ui | — | ScrollArea, Badge primitives | Already in project |
| lucide-react | — | Icons (Terminal, Download, CheckCircle2, XCircle, Loader2) | Already in project — new icons needed |

**No npm installs required.** All dependencies are already present.

### New Icons from lucide-react (already installed)

The following lucide-react icons are available and suit the new component:

| Icon | Use |
|------|-----|
| `Terminal` | Execute code tool icon (replaces generic `Wrench`) |
| `Download` | File download card action |
| `FileOutput` | Output files section header |
| `XCircle` | Error state indicator |
| `CheckCircle2` | Already used for done state |
| `Loader2` | Already used for running state |

**Confidence:** HIGH — verified by reading `ToolCallPanel.tsx` imports and lucide-react icon list.

---

## Architecture Patterns

### Existing Pattern: Component-per-tool in ToolCallPanel

The established pattern in this codebase is: for each tool name that needs rich rendering, add a dedicated result component (`LsResult`, `TreeResult`, `GrepResult`, etc.) and dispatch in `renderResult()`. For `execute_code`, this pattern extends further — the entire tool row (not just the result section) needs to be replaced because:

1. The tool is running during streaming (stdout/stderr arrives before `tool_end`)
2. The output data (stdout lines, stderr lines, output files) needs to live on the `ToolCall` object so it persists when the component re-renders
3. The panel needs an inline terminal output area, not just a collapsible result block

**Solution:** Detect `tc.name === "execute_code"` in the main render loop of `ToolCallPanel` and render `<ExecuteCodeBlock tc={tc} />` instead of the generic tool row.

### Recommended Project Structure (changes only)

```
frontend/src/
├── types/index.ts             # Extend ToolCall with stdout/stderr/outputFiles
├── lib/api.ts                 # Add 4 new callbacks to streamMessage()
├── hooks/useMessages.ts       # Wire 4 new callbacks into streamMessage call
└── components/chat/
    ├── ToolCallPanel.tsx      # Add execute_code branch + import ExecuteCodeBlock
    └── ExecuteCodeBlock.tsx   # NEW: full execute_code rendering component
```

### Pattern: ToolCall Type Extension

The `ToolCall` interface in `types/index.ts` currently has: `name`, `args`, `status`, `result`, `sub_agent`, `startedAt`, `endedAt`. Add:

```typescript
// Source: types/index.ts — extend existing ToolCall interface
stdout?: string[]          // Lines accumulated from code_stdout events
stderr?: string[]          // Lines accumulated from code_stderr events
outputFiles?: Array<{ filename: string; url: string; size: number }>
executionDurationMs?: number  // From code_execution_complete.duration_ms
exitCode?: number             // From code_execution_complete.exit_code
errorMessage?: string         // From code_execution_complete.error (exit_code=1 path)
```

All fields are optional — backward compatible with persisted tool calls that were stored before Phase 15.

### Pattern: SSE Callback Extension in api.ts

`streamMessage()` currently accepts 8 callbacks (onDelta, onDone, onTitleUpdate, onToolStart, onToolEnd, onSubAgentStart, onSubAgentDelta, onSubAgentDone, onSkillActivated). Add 4 more at the end to preserve call-site compatibility:

```typescript
// Source: frontend/src/lib/api.ts — append after existing callbacks
onCodeExecutionStart?: (codePreview: string) => void,
onCodeStdout?: (content: string) => void,
onCodeStderr?: (content: string) => void,
onCodeExecutionComplete?: (exitCode: number, durationMs: number, outputFiles: OutputFile[], error?: string) => void,
```

In the SSE parse loop, add four `else if` branches matching the existing style:

```typescript
} else if (parsed.type === "code_execution_start" && onCodeExecutionStart) {
  onCodeExecutionStart(parsed.code_preview as string)
} else if (parsed.type === "code_stdout" && onCodeStdout) {
  onCodeStdout(parsed.content as string)
} else if (parsed.type === "code_stderr" && onCodeStderr) {
  onCodeStderr(parsed.content as string)
} else if (parsed.type === "code_execution_complete" && onCodeExecutionComplete) {
  onCodeExecutionComplete(
    parsed.exit_code as number,
    parsed.duration_ms as number,
    (parsed.output_files ?? []) as OutputFile[],
    parsed.error as string | undefined,
  )
}
```

### Pattern: useMessages.ts Callback Wiring

In `useMessages.ts`, the `sendMessage` function calls `streamMessage(...)` with inline callbacks. Add four new callbacks that mutate the `execute_code` entry in the running message's `tool_calls` array:

```typescript
// onCodeExecutionStart — find the running execute_code tool and mark it active
// (code_execution_start fires after tool_start, so the ToolCall entry already exists)

// onCodeStdout — append line to tc.stdout array
(content) => {
  setMessages((prev) =>
    prev.map((m) => {
      if (m.id !== assistantId) return m
      const updated = (m.tool_calls ?? []).map((tc) =>
        tc.name === "execute_code" && tc.status === "running"
          ? { ...tc, stdout: [...(tc.stdout ?? []), content] }
          : tc
      )
      return { ...m, tool_calls: updated }
    })
  )
},

// onCodeStderr — append line to tc.stderr array (same pattern, target stderr)

// onCodeExecutionComplete — set exitCode, durationMs, outputFiles, errorMessage
(exitCode, durationMs, outputFiles, error) => {
  setMessages((prev) =>
    prev.map((m) => {
      if (m.id !== assistantId) return m
      const updated = (m.tool_calls ?? []).map((tc) =>
        tc.name === "execute_code" && tc.status === "running"
          ? { ...tc, exitCode, executionDurationMs: durationMs, outputFiles, errorMessage: error }
          : tc
      )
      return { ...m, tool_calls: updated }
    })
  )
},
```

**Important:** `tool_end` will still fire after `code_execution_complete`, setting `status: "done"`. The `onCodeExecutionComplete` callback fires first and populates the data; `onToolEnd` then sets `status: "done"`. This ordering is guaranteed by the backend: `code_execution_complete` is yielded before the `tool_end` SSE event (the tool result JSON is emitted after the execution events).

### Pattern: ExecuteCodeBlock Component

This is the main new component. It renders differently based on execution state:

**State 1 — Running (no stdout/stderr yet):** Spinner + "Executing Python…" label
**State 2 — Running with output:** Terminal panel (bg-zinc-900) showing accumulated stdout (green) and stderr (red) lines, auto-scrolling
**State 3 — Complete (exit_code === 0):** CheckCircle + duration badge + collapsed terminal (expandable) + file download cards
**State 4 — Error (exit_code !== 0):** XCircle + red error message + collapsed terminal showing stderr

```typescript
// Source: new file frontend/src/components/chat/ExecuteCodeBlock.tsx

interface ExecuteCodeBlockProps {
  tc: ToolCall
}

export function ExecuteCodeBlock({ tc }: ExecuteCodeBlockProps) {
  // Derive state from tc fields
  const isRunning = tc.status === "running"
  const hasOutput = (tc.stdout?.length ?? 0) + (tc.stderr?.length ?? 0) > 0
  const isComplete = tc.status === "done" && tc.exitCode !== undefined
  const isError = isComplete && tc.exitCode !== 0

  // Terminal panel, file download cards, status header
}
```

### Pattern: Terminal Output Panel

```tsx
// Dark terminal panel for stdout/stderr — bg-zinc-900 matches common terminal aesthetics
// and contrasts clearly in both the running (blue-glow) and done (muted) card states
<div className="rounded-md bg-zinc-900 p-2.5 font-mono text-xs leading-relaxed max-h-48 overflow-y-auto">
  {tc.stdout?.map((line, i) => (
    <div key={`out-${i}`} className="text-green-400 whitespace-pre-wrap break-all">{line}</div>
  ))}
  {tc.stderr?.map((line, i) => (
    <div key={`err-${i}`} className="text-red-400 whitespace-pre-wrap break-all">{line}</div>
  ))}
</div>
```

**Note:** Stdout and stderr lines should be interleaved in arrival order for accurate execution replay. The simplest approach is to merge them into a single `outputLines: Array<{kind: "stdout"|"stderr", content: string}>` array in the `ToolCall` type rather than separate arrays. This preserves ordering. See "Common Pitfalls" section below.

### Pattern: File Download Cards

```tsx
// Each output file gets a download card with filename, formatted size, and anchor link
function OutputFileCard({ file }: { file: { filename: string; url: string; size: number } }) {
  return (
    <a
      href={file.url}
      download={file.filename}
      className="flex items-center gap-2.5 rounded-md bg-muted/30 ghost-border px-3 py-2
                 text-xs hover:bg-accent/40 transition-colors group"
    >
      <Download className="w-3.5 h-3.5 text-primary flex-shrink-0 group-hover:text-primary" />
      <span className="flex-1 font-mono text-foreground/80 truncate">{file.filename}</span>
      <span className="text-muted-foreground/50 flex-shrink-0">{formatBytes(file.size)}</span>
    </a>
  )
}
```

### Pattern: Python Badge

```tsx
// Small language badge — consistent with existing tool icon patterns
<span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/15 text-blue-400 flex-shrink-0">
  Python
</span>
```

### Anti-Patterns to Avoid

- **Separate stdout/stderr arrays with index-based interleaving:** Arrival order from the SSE stream is the only reliable ordering signal. Use a single `outputLines` array with `{kind, content}` entries instead of `stdout[]` + `stderr[]`. This is a deviation from the initial type design above — the merged approach is strictly better.
- **Buffering stdout/stderr until completion:** Each SSE event must trigger a `setMessages` call immediately. React batches state updates so multiple rapid events will be batched efficiently — do not buffer them manually.
- **Auto-scroll fighting the user:** Use a `useRef` on the terminal scroll container and `scrollIntoView` on new entries only when the container is already scrolled to the bottom (within ~20px). If the user has scrolled up to read earlier output, do not force-scroll them back down.
- **Relying on tool_end.result for file list:** The `tool_end` event carries the JSON tool result which also contains `output_files`, but this arrives after `code_execution_complete`. Use `code_execution_complete` as the source of truth for `outputFiles` — do not parse `tc.result` for files.
- **Breaking existing tool call rendering:** `ToolCallPanel.tsx` renders all tool calls in a loop. The `execute_code` branch must be additive — other tools still render via the existing path. Do not refactor the shared rendering logic.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Byte formatting | Custom formatter | Simple `formatBytes()` util (8 lines) | Trivial; existing `formatDuration()` in ToolCallPanel.tsx is the pattern to follow |
| Auto-scroll to bottom | Interval polling | `useEffect` + `scrollIntoView` with bottom-check | Standard React pattern; no library needed for this scale |
| SSE event parsing | New SSE client | Extend existing `streamMessage()` in `api.ts` | Existing parser handles all edge cases (buffer, malformed lines, [DONE]) — adding 4 `else if` branches is the correct extension point |
| Animation | Custom CSS | Tailwind `animate-spin`, `animate-pulse`, existing `animate-checkPop` / `animate-toolSlideIn` | All animations already defined in project; reuse them |

---

## SSE Event Payloads (exact shapes from backend)

These are the exact JSON objects emitted by Phase 14's `threads.py`:

```typescript
// code_execution_start — fires before session.run()
{ type: "code_execution_start", code_preview: string }  // code_preview = code[:200]

// code_stdout — fires per stdout chunk
{ type: "code_stdout", content: string }

// code_stderr — fires per stderr chunk
{ type: "code_stderr", content: string }

// code_execution_complete — success path (exit_code=0)
{
  type: "code_execution_complete",
  exit_code: 0,
  duration_ms: number,
  execution_id: string | null,
  output_files: Array<{ filename: string; url: string; size: number }>
}

// code_execution_complete — error path (exit_code=1, Python exception caught)
{
  type: "code_execution_complete",
  exit_code: 1,
  error: string,
  duration_ms: 0,
  output_files: []
}
```

**Key detail:** `execution_id` can be `null` if the DB insert fails. The UI should handle `null` gracefully — show files if `output_files` is non-empty regardless of `execution_id`.

**Key detail:** `code_execution_complete` fires before `tool_end`. The sequence is:
1. SSE: `tool_start` → `onToolStart` creates ToolCall with `status: "running"`
2. SSE: `code_execution_start` → (optional: UI can ignore, already covered by tool_start)
3. SSE: `code_stdout` × N → `onCodeStdout` appends to outputLines
4. SSE: `code_stderr` × N → `onCodeStderr` appends to outputLines
5. SSE: `code_execution_complete` → `onCodeExecutionComplete` sets exitCode/durationMs/outputFiles
6. SSE: `tool_end` → `onToolEnd` sets `status: "done"` and `result` (the full tool result JSON)

This means the `ExecuteCodeBlock` component should derive its "is complete" state from `tc.exitCode !== undefined` (set by step 5), not from `tc.status === "done"` (set by step 6). By the time step 6 fires, the display data is already present.

---

## Common Pitfalls

### Pitfall 1: Stdout/Stderr Ordering Lost

**What goes wrong:** Using separate `stdout: string[]` and `stderr: string[]` arrays on `ToolCall` means the interleaved arrival order is lost. When rendered, all stdout appears first, then all stderr — but real Python programs interleave them.

**Why it happens:** Parallel array accumulation does not track relative ordering.

**How to avoid:** Use a single `outputLines: Array<{kind: "stdout"|"stderr", content: string}>` field. Append to the same array in both `onCodeStdout` and `onCodeStderr` callbacks.

**Warning signs:** Test by running code that prints to both stdout and stderr in alternating order — if all green lines appear before all red lines, the bug is present.

### Pitfall 2: setMessages Closure Stale State

**What goes wrong:** The `onCodeStdout` and `onCodeStderr` callbacks are closures created when `sendMessage` runs. If they capture `messages` directly and mutate it, they will use stale state.

**Why it happens:** Multiple rapid SSE events trigger multiple `setMessages` calls in the same event loop tick.

**How to avoid:** Always use the functional form: `setMessages((prev) => ...)`. All existing callbacks in `useMessages.ts` already follow this pattern correctly.

**Warning signs:** Some stdout lines disappear when execution produces output quickly (e.g., a tight Python loop printing to stdout).

### Pitfall 3: onCodeExecutionComplete Fires Before tool_end — Double Status Update

**What goes wrong:** If `onCodeExecutionComplete` sets `status: "done"` on the ToolCall, then `onToolEnd` also sets `status: "done"`, causing redundant re-renders. More critically, if `onCodeExecutionComplete` marks status done and the component switches to "complete" view, but `outputFiles` hasn't been set yet, a flash of empty state can occur.

**Why it happens:** Misordering the fields set by each callback.

**How to avoid:** `onCodeExecutionComplete` sets only `exitCode`, `executionDurationMs`, `outputFiles`, and `errorMessage`. `onToolEnd` sets `status: "done"` and `result`. The component checks both `tc.exitCode !== undefined` (execution data present) and renders files only when that is true.

### Pitfall 4: Download URL Signed URL Expiry

**What goes wrong:** Supabase signed URLs expire after 1 hour (as configured in `harvest_output_files`). If a user leaves the chat open for >1 hour and then tries to download, the link is dead.

**Why it happens:** `create_signed_url(storage_path, 3600)` — 3600 seconds = 1 hour.

**How to avoid (planning consideration):** This is a known limitation, not a bug. The plan should include a note in the file download card tooltip: "Links expire after 1 hour." Do not attempt to auto-refresh in this phase — out of scope.

### Pitfall 5: Auto-scroll Disrupts Reading

**What goes wrong:** When stdout is streaming fast, forcing scroll-to-bottom on every new line prevents the user from reading earlier output.

**Why it happens:** `useEffect` with `scrollIntoView` fires on every render caused by a new line.

**How to avoid:** Before calling `scrollIntoView`, check `container.scrollHeight - container.scrollTop - container.clientHeight < 24`. Only scroll if user is already near the bottom.

---

## Code Examples

### Exact SSE Parser Addition (api.ts)

```typescript
// Source: backend/app/api/threads.py lines 614, 624-626, 628-631, 682-693
// Add these branches in the SSE parse loop in frontend/src/lib/api.ts
// after the existing `skill_activated` branch:

} else if (parsed.type === "code_execution_start" && onCodeExecutionStart) {
  onCodeExecutionStart(parsed.code_preview as string)
} else if (parsed.type === "code_stdout" && onCodeStdout) {
  onCodeStdout(parsed.content as string)
} else if (parsed.type === "code_stderr" && onCodeStderr) {
  onCodeStderr(parsed.content as string)
} else if (parsed.type === "code_execution_complete" && onCodeExecutionComplete) {
  onCodeExecutionComplete(
    parsed.exit_code as number,
    parsed.duration_ms as number,
    (parsed.output_files ?? []) as Array<{ filename: string; url: string; size: number }>,
    parsed.error as string | undefined,
  )
}
```

### ToolCall Type Extension (types/index.ts)

```typescript
// Source: frontend/src/types/index.ts — extend existing ToolCall interface
export interface OutputFile {
  filename: string
  url: string
  size: number
}

export interface ToolCall {
  name: string
  args: Record<string, string>
  status: "running" | "done"
  result?: string
  sub_agent?: SubAgentState
  startedAt?: number
  endedAt?: number
  // Code execution fields (execute_code tool only)
  outputLines?: Array<{ kind: "stdout" | "stderr"; content: string }>
  outputFiles?: OutputFile[]
  executionDurationMs?: number
  exitCode?: number
  errorMessage?: string
}
```

### ExecuteCodeBlock Dispatch in ToolCallPanel.tsx

```tsx
// Source: frontend/src/components/chat/ToolCallPanel.tsx
// In the tool render loop, add before the existing generic row:

{tc.name === "execute_code" ? (
  <ExecuteCodeBlock tc={tc} />
) : (
  // existing generic tool row JSX
)}
```

### formatBytes Utility

```typescript
// Simple utility — add to ExecuteCodeBlock.tsx or a shared lib/utils location
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact on Phase 15 |
|---|---|---|
| Poll for execution results | SSE push already in place (Phase 14) | No polling needed — pipe directly into React state |
| Separate terminal component library | Tailwind-only dark panel | No extra deps; matches existing patterns |
| Store stdout in DB, load on mount | Live stream into component state | Stdout/stderr lines only exist in memory for the current session; on page reload, the terminal view is not reconstructed (by design — `result` JSON in tool_calls is the persistent record) |

**On page reload:** `tc.result` (the tool result JSON) is persisted to DB in `messages.tool_calls`. It contains `status`, `exit_code`, `duration_ms`, `execution_id`, and `output_files`. But `outputLines` (stdout/stderr) is NOT persisted — it is ephemeral streaming state. On reload, `ExecuteCodeBlock` will show the completion state (exit_code, duration, files) but the terminal output will be empty. This is acceptable behavior for v2.0. The plan should document this explicitly so the implementer does not try to persist streaming output.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — pure frontend code change, no new CLI tools, services, or runtimes required).

---

## Validation Architecture

`workflow.nyquist_validation` is not set in `.planning/config.json` (key absent = treat as enabled).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (Vite project default) |
| Config file | Check `frontend/vite.config.ts` or `vitest.config.ts` — likely none yet |
| Quick run command | `cd frontend && npm run test` (if configured) |
| Full suite command | `cd frontend && npm run test` |

**Note:** The frontend has no established test suite in this project. The existing validation pattern across all phases has been manual browser testing + backend unit tests (pytest). SAND-12 is a UI-only requirement. Per project CLAUDE.md convention: "Use browser testing where applicable via an appropriate MCP."

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAND-12 | Panel renders when execute_code dispatched | Manual browser | n/a | n/a |
| SAND-12 | Stdout (green) streams in real time | Manual browser | n/a | n/a |
| SAND-12 | Stderr (red) streams in real time | Manual browser | n/a | n/a |
| SAND-12 | File download cards appear after completion | Manual browser | n/a | n/a |
| SAND-12 | Error state shown with red styling | Manual browser | n/a | n/a |

### Wave 0 Gaps

Frontend tests are manual-only for this project (established pattern across Phases 9–14). No test framework setup is needed.

The plan's validation step should: start the dev server (`npm run dev`), enable `SANDBOX_ENABLED=true`, and perform browser testing of all 5 success criteria from ROADMAP.md.

---

## Open Questions

1. **Interleaved stdout/stderr ordering**
   - What we know: Backend emits `code_stdout` and `code_stderr` as separate events; arrival order on the frontend is the true execution order
   - What's unclear: Does `llm-sandbox`'s `on_stdout`/`on_stderr` preserve interleaved order relative to each other? Or does llm-sandbox buffer stdout and stderr separately and flush at end?
   - Recommendation: Use a single `outputLines` array (merged by arrival order) and test with code that explicitly interleaves stdout/stderr. If llm-sandbox does batch-flush stderr at end, document that in the plan but proceed — the UI design handles it either way.

2. **Signed URL expiry UX**
   - What we know: URLs expire after 1 hour (hardcoded in sandbox_service.py)
   - What's unclear: Should the UI show the expiry time? Should there be a "re-download" mechanism?
   - Recommendation: Show a subtle "(expires in 1h)" note on the download card. Do not implement URL refresh in this phase.

3. **Scroll behavior on very long output**
   - What we know: Docker executions can produce many stdout lines (e.g., training loops, data processing)
   - What's unclear: Is `max-h-48` (12rem) an appropriate cap for the terminal panel?
   - Recommendation: Use `max-h-64` (16rem) for the terminal panel with a ScrollArea. Keep terminal collapsed by default after completion (user can expand). This matches the existing `ReadDocumentResult` expandable pattern.

---

## Sources

### Primary (HIGH confidence)
- Direct code read: `frontend/src/lib/api.ts` — exact SSE parser structure and all existing callbacks
- Direct code read: `frontend/src/hooks/useMessages.ts` — exact callback wiring pattern
- Direct code read: `frontend/src/types/index.ts` — existing ToolCall interface fields
- Direct code read: `frontend/src/components/chat/ToolCallPanel.tsx` — existing component patterns, Tailwind classes, icon imports
- Direct code read: `frontend/src/components/chat/MessageItem.tsx` — how tool calls are rendered from message
- Direct code read: `backend/app/api/threads.py` lines 610–694 — exact SSE event shapes emitted
- Direct code read: `backend/app/services/sandbox_service.py` lines 67–124 — exact `output_files` dict shape: `{filename, url, size}`
- Direct code read: `.planning/phases/14-code-execution-sandbox/14-VERIFICATION.md` — confirmed event sequence and all Phase 14 truths

### Secondary (MEDIUM confidence)
- ROADMAP.md Phase 15 success criteria — 5 concrete success criteria drive the component design
- STATE.md accumulated decisions — Phase 14 decision "output_files included in tool_result JSON so LLM knows about downloadable artifacts" confirms duplicate data path (tool_end result also carries files)

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- SSE event shapes: HIGH — read directly from backend source
- ToolCall type extension: HIGH — read directly from types/index.ts
- Component architecture: HIGH — follows established ToolCallPanel patterns exactly
- Tailwind styling: HIGH — follows existing classes in ToolCallPanel.tsx
- Stdout/stderr ordering guarantee from llm-sandbox: LOW — not verified, flagged as Open Question 1
- Signed URL expiry behavior: HIGH — read directly from sandbox_service.py line 113

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable — all findings from project source code, not external APIs)
