---
phase: 15-code-output-ui
status: passed
requirement: SAND-12
verified: 2026-04-04
verification_method: code-inspection
---

# Phase 15 Verification: SAND-12

## Requirement

**SAND-12:** Frontend displays a Code Output panel that renders stdout/stderr stream and shows download links for output files.

---

## Evidence by Success Criterion

### SC1 — Code Output panel renders for execute_code tool calls

**Satisfied by:** `ExecuteCodeBlock.tsx` (created in Phase 15 Plan 02) dispatched from `ToolCallPanel.tsx`.

- `ToolCallPanel.tsx` imports `ExecuteCodeBlock` and routes `tc.name === "execute_code"` calls to it via a ternary in the map loop (preserving the connecting line divider shared with all other tool rows).
- `toolIcon()`, `toolLabel()`, and `toolIconColor()` functions in `ToolCallPanel.tsx` all include explicit `execute_code` branches, wiring the Terminal icon, "Executing code" label, and `text-blue-400` color.

### SC2 — Python badge, status indicator, and execution time displayed

**Satisfied by:** `ExecuteCodeBlock.tsx` header row.

- **Python badge:** `<span className="... bg-blue-500/15 text-blue-400 ...">Python</span>` renders unconditionally in the header row.
- **Status indicators:** Three mutually exclusive states using lucide-react icons:
  - Running: `<Loader2 className="... animate-spin ..." />` (while `tc.status === "running"` and `exitCode === undefined`)
  - Error: `<XCircle className="... text-red-400" />` (when `exitCode !== 0`)
  - Success: `<CheckCircle2 className="... text-success animate-checkPop" />` (when `exitCode === 0`)
- **Execution duration:** `<Clock />` icon plus `formatDuration(executionDurationMs)` rendered when `isComplete && executionDurationMs != null && executionDurationMs > 0`. `executionDurationMs` sourced from live `tc.executionDurationMs` or parsed from `tc.result` JSON field `duration_ms` on reload.

### SC3 — Streaming stdout/stderr rendered in real time

**Satisfied by:** `api.ts` SSE parse branches + `useMessages.ts` accumulation callbacks + `TerminalOutput` sub-component in `ExecuteCodeBlock.tsx`.

- **`api.ts`** (lines 93–155): `streamMessage()` accepts four new optional callback params: `onCodeExecutionStart`, `onCodeStdout`, `onCodeStderr`, `onCodeExecutionComplete`. SSE parse loop dispatches each via `parsed.type` matching `code_execution_start`, `code_stdout`, `code_stderr`, `code_execution_complete`.
- **`useMessages.ts`** (lines 136–163): `onCodeStdout` appends `{ kind: "stdout", content }` to the running execute_code ToolCall's `outputLines` array using a functional `setMessages` updater. `onCodeStderr` does the same with `kind: "stderr"`. A single interleaved array preserves arrival order.
- **`TerminalOutput`** (inside `ExecuteCodeBlock.tsx`): Renders each `OutputLine` as `text-emerald-400` (stdout) or `text-red-400` (stderr). Auto-scrolls to bottom when `lines.length` changes (with a 24px near-bottom threshold to avoid fighting user scroll). Shows a blinking cursor span while `isStreaming` is true and lines are present.

### SC4 — Download cards rendered for output files

**Satisfied by:** `OutputFileCard` sub-component and `outputFiles` derivation in `ExecuteCodeBlock.tsx`.

- `OutputFileCard` renders an anchor tag with `href={file.url}` and `download={file.filename}`, a `Download` lucide icon, the filename in monospace, and `formatBytes(file.size)` for human-readable file size.
- `outputFiles` array is derived from live `tc.outputFiles` (populated by `onCodeExecutionComplete` callback in `useMessages.ts`) with a reload fallback that parses `tc.result` JSON field `output_files` for messages loaded from history.
- Download cards section is rendered only when `isSuccess && outputFiles.length > 0`.

### SC5 — Error state displayed when exit code is non-zero

**Satisfied by:** `ExecuteCodeBlock.tsx` error state logic.

- `isError` is derived as `isComplete && exitCode !== 0`.
- When `isError` is true: the `XCircle` red icon appears in the status slot, and if `tc.errorMessage` is set, a red-bordered `div` renders the error text in monospace font.
- `errorMessage` is populated by `onCodeExecutionComplete` in `useMessages.ts` when the `error` parameter is present (sourced from the backend `code_execution_complete` SSE event `error` field).

---

## Verdict

**SAND-12 PASSED** — All 5 success criteria satisfied via code inspection of Phase 15 artifacts.

Evidence sourced from:
- `frontend/src/components/chat/ExecuteCodeBlock.tsx` (182 lines, created Phase 15 Plan 02)
- `frontend/src/components/chat/ToolCallPanel.tsx` (updated Phase 15 Plan 02)
- `frontend/src/hooks/useMessages.ts` (updated Phase 15 Plan 01)
- `frontend/src/lib/api.ts` (updated Phase 15 Plan 01)

Phase 15 Plans 01 and 02 together fully implement SAND-12 with no stubs or missing wiring.
