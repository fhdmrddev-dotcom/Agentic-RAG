import { lazy, Suspense, useState, useRef, useEffect } from "react"
import { Terminal, Clock, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ToolCall, OutputLine, OutputFile } from "@/types"
import { OutputFileCard } from "../OutputFileCard"
import { StatusPill, type ToolStatus } from "../StatusPill"

// Phase 075.8 Task 7 (sketch 002 D1): editor-inset syntax highlighting.
// Lazy-loaded so the Shiki WASM bundle (~150 KB) doesn't block the first
// render of a chat that has no execute_code yet. Falls back to a plain
// mono pre while loading (see ShikiCode for the dual-render contract).
const ShikiCode = lazy(() =>
  import("./ShikiCode").then(m => ({ default: m.ShikiCode }))
)

/**
 * Phase 075.9 T4 — shared editor inset for execute_code.
 *
 * Exported so the preparing-state branch in ToolCallPanel can render the
 * SAME Shiki view as the running/done branch — closes the "code-stream
 * blink" defect at tool_start. The inset reads `tc.argsCodeText` during
 * preparing and `tc.args.code` post-start (the reducer's spread at
 * tool_start makes both fields carry IDENTICAL content at the transition
 * moment, so the visual swap is byte-stable: no remount, no re-flow).
 *
 * The `streaming` prop tells ShikiCode to use React's `useDeferredValue`
 * so rapid prop changes during the SSE token stream don't re-run the
 * WASM tokenizer on every keystroke-equivalent update.
 */
export function ExecuteCodeEditorInset({ tc }: { tc: ToolCall }) {
  // Phase 075.9 T4: streaming-first fallback chain. During preparing,
  // `argsCodeText` carries the cumulative bytes from tool_args_progress;
  // after tool_start the reducer copies the canonical args.code in and
  // clears argsCodeText. Reading both with ?? keeps the inset mounted
  // and byte-stable across the transition.
  const displayCode = tc.argsCodeText ?? tc.args.code
  const isStreaming = tc.status === "preparing" && !!tc.argsCodeText
  if (!displayCode) return null
  return (
    <div
      data-testid="tc-editor"
      className="mt-2 grid grid-cols-[32px_1fr] bg-[#0d1117] max-h-[180px] overflow-y-auto rounded-md border border-border/40"
    >
      <div
        data-testid="tc-gutter"
        aria-hidden="true"
        className="bg-[hsl(220_30%_7%)] text-muted-foreground font-mono text-[11px] text-right py-2 pr-1.5 border-r border-border/40 select-none leading-[1.7]"
      >
        {displayCode.split("\n").map((_: string, i: number) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <Suspense
        fallback={
          <pre className="m-0 px-3 py-2 font-mono text-[11px] leading-[1.7] text-[#c9d1d9] whitespace-pre overflow-x-auto">
            {displayCode}
          </pre>
        }
      >
        <ShikiCode code={displayCode} language="python" theme="github-dark" streaming={isStreaming} />
      </Suspense>
    </div>
  )
}

// Phase 075.7 Plan 01 (D-02 atomic extraction): ported verbatim from the
// legacy execute-code wrapper. Functional behavior preserved (code/STDOUT/
// STDERR/OutputFileCard/sticky-bottom-indicator/ToolArgsLivePanel-preparing-
// state). Renamed to default export `ExecuteCodeBody`. Editor-inset
// visual polish (gutter, syntax tokens, labeled STDOUT/STDERR per sketch
// tool-call-panel.md D1/D3) is BEST-EFFORT per SPEC §Boundaries — NOT a
// verifier gate. Behavior parity IS gated.

// Phase 075.2 Plan 02 (BUG-260521-02 / D-075.2-05): `OutputFileCard` +
// `API_BASE` + `resolveOutputUrl` + `formatBytes` were extracted to
// `../OutputFileCard.tsx` so the pinned Final Outputs panel in
// `MessageItem.tsx` can reuse the same card shape. This file now consumes
// the shared component directly — per-cell rendering behavior is
// byte-identical to pre-refactor.

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

interface ExecuteCodeBodyProps {
  tc: ToolCall
}

function TerminalOutput({ lines, isStreaming }: { lines: OutputLine[]; isStreaming: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 24
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight
    }
  }, [lines.length])

  // Phase 075.8 Task 7 (sketch 002 D3 — STDOUT and STDERR are labeled regions).
  // Partition lines by kind while preserving their original order within each
  // region, then render two visually-distinct regions stacked: STDOUT first,
  // STDERR below. Each region gets an uppercase `STDOUT` / `STDERR` divider
  // per sketch D3 — failure-mode triage immediately surfaces the error band.
  // Streaming dot still pulses on whichever region last received a line.
  const stdoutLines: OutputLine[] = []
  const stderrLines: OutputLine[] = []
  for (const ln of lines) {
    if (ln.kind === "stderr") stderrLines.push(ln)
    else stdoutLines.push(ln)
  }
  const lastKind = lines.length > 0 ? lines[lines.length - 1].kind : null

  return (
    <div
      ref={containerRef}
      className="rounded-md border border-border/40 bg-[#0d1117] overflow-hidden max-h-64 overflow-y-auto"
    >
      {stdoutLines.length > 0 && (
        <>
          <div
            data-testid="tc-divider-stdout"
            className="flex items-center px-3 py-1 bg-[hsl(220_30%_9%)] border-b border-border/40 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground/80"
          >
            <span>STDOUT</span>
            {isStreaming && lastKind === "stdout" && (
              <span className="ml-auto flex items-center gap-1.5 text-primary normal-case">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-dotBounce" />
                streaming
              </span>
            )}
            {!isStreaming && (
              <span className="ml-auto text-muted-foreground normal-case">
                {stdoutLines.length} {stdoutLines.length === 1 ? "line" : "lines"}
              </span>
            )}
          </div>
          <div className="px-3 py-2 font-mono text-[11px] leading-[1.65] text-[#c9d1d9]">
            {stdoutLines.map((line, i) => (
              <div
                key={`stdout-${i}`}
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
              >
                {line.content}
              </div>
            ))}
            {isStreaming && lastKind === "stdout" && (
              <span className="inline-block w-1.5 h-3 bg-primary/60 animate-pulse rounded-sm align-middle" />
            )}
          </div>
        </>
      )}
      {stderrLines.length > 0 && (
        <>
          <div
            data-testid="tc-divider-stderr"
            className={cn(
              "flex items-center px-3 py-1 border-b border-border/40 font-mono text-[10px] uppercase tracking-[0.06em]",
              "bg-destructive/10 text-destructive",
              stdoutLines.length > 0 && "border-t border-border/40",
            )}
          >
            <span>STDERR</span>
            {isStreaming && lastKind === "stderr" && (
              <span className="ml-auto flex items-center gap-1.5 normal-case">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-current animate-dotBounce" />
                streaming
              </span>
            )}
            {!isStreaming && (
              <span className="ml-auto opacity-60 normal-case">
                {stderrLines.length} {stderrLines.length === 1 ? "line" : "lines"}
              </span>
            )}
          </div>
          <div className="px-3 py-2 font-mono text-[11px] leading-[1.65] text-[#ffa198]">
            {stderrLines.map((line, i) => (
              <div
                key={`stderr-${i}`}
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
              >
                {line.content}
              </div>
            ))}
            {isStreaming && lastKind === "stderr" && (
              <span className="inline-block w-1.5 h-3 bg-destructive/60 animate-pulse rounded-sm align-middle" />
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function summarize(tc: ToolCall): string {
  // Priority: file output filename → last STDOUT line → "executed" fallback.
  if (tc.outputFiles && tc.outputFiles.length > 0) {
    return `[saved ${tc.outputFiles[0].filename}]`
  }
  const lines = tc.outputLines ?? []
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i]
    if (l.kind === "stdout" && l.content && l.content.trim()) {
      const text = l.content.trim().split("\n").pop() ?? ""
      return text.length > 80 ? text.slice(0, 80) + "…" : text
    }
  }
  return "executed"
}

export default function ExecuteCodeBody({ tc }: ExecuteCodeBodyProps) {
  const [terminalOpen, setTerminalOpen] = useState(true)

  // Derive outputFiles from tc.outputFiles (live) or parse from tc.result (reloaded)
  const outputFiles: OutputFile[] = tc.outputFiles ?? (() => {
    try {
      const r = tc.result ? JSON.parse(tc.result) : null
      return r?.output_files ?? []
    } catch { return [] }
  })()

  // Similarly derive exitCode for reloaded messages
  const exitCode: number | undefined = tc.exitCode ?? (() => {
    try {
      const r = tc.result ? JSON.parse(tc.result) : null
      return r?.exit_code
    } catch { return undefined }
  })()

  const executionDurationMs: number | undefined = tc.executionDurationMs ?? (() => {
    try {
      const r = tc.result ? JSON.parse(tc.result) : null
      return r?.duration_ms
    } catch { return undefined }
  })()

  const isPreparing = tc.status === "preparing"
  const isRunning = tc.status === "running"
  // Use live outputLines if present; on reload reconstruct from persisted stdout/stderr
  const lines: OutputLine[] = tc.outputLines ?? (() => {
    try {
      const r = tc.result ? JSON.parse(tc.result) : null
      if (!r) return []
      const out: OutputLine[] = []
      if (r.stdout) r.stdout.split("\n").filter(Boolean).forEach((l: string) => out.push({ kind: "stdout", content: l }))
      if (r.stderr) r.stderr.split("\n").filter(Boolean).forEach((l: string) => out.push({ kind: "stderr", content: l }))
      return out
    } catch { return [] }
  })()
  const hasOutput = lines.length > 0
  const isComplete = exitCode !== undefined
  const isError = isComplete && exitCode !== 0
  const isSuccess = isComplete && exitCode === 0

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center gap-2.5">
        {/* Python badge */}
        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/15 text-blue-400 flex-shrink-0">
          Python
        </span>
        {/* Label */}
        <span className="flex-1 min-w-0 text-xs text-muted-foreground truncate">
          <span className="font-semibold text-foreground/80">
            {isPreparing ? "Generating code" : isRunning ? "Executing code" : isError ? "Execution failed" : "Code executed"}
          </span>
          {/* Phase 075.9 hot-fix: byte counter during preparing — the
              ToolArgsLivePanel that previously owned this affordance lived
              in the else branch of ToolCallPanel and is dead code for
              execute_code now that ExecuteCodeBody renders across all
              statuses. Keeps the glanceable "is the model still typing"
              signal alongside the visibly-streaming Shiki tokens. */}
          {isPreparing && tc.argsBytesStreamed != null && tc.argsBytesStreamed > 0 && (
            <span className="ml-1.5 opacity-60 font-mono tabular-nums">
              ({(tc.argsBytesStreamed / 1024).toFixed(1)} KB)
            </span>
          )}
          {/* Phase 075.8 Task 7: description-only hint stays — the inline
              60-char code preview is dropped because the full code now
              renders below in the editor inset. */}
          {tc.args.description && (
            <span className="ml-1.5 opacity-60 italic">{tc.args.description}</span>
          )}
        </span>
        {/* Phase 075.8 Task 2 (sketch 002 D5):
            - During RUNNING: keep the live elapsed counter (the running
              StatusPill variant intentionally has no duration suffix), so
              the user sees the seconds-by-seconds ticker.
            - On terminal completion: drop the standalone Clock badge — the
              done/failed pill carries `· {duration}` inline. */}
        {isRunning && !isComplete && tc.elapsedSeconds != null && tc.elapsedSeconds > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono tabular-nums flex-shrink-0">
            <Clock className="w-2.5 h-2.5" />
            {formatDuration(tc.elapsedSeconds * 1000)}
          </span>
        )}
        {/* Phase 075.8 Task 2: universal StatusPill replaces the
            Loader2/XCircle/CheckCircle2 trio. Failed runs surface as the
            destructive pill (via isError → "failed"); success as the
            success-green "done · 11.3s". executionDurationMs comes from the
            backend duration (sandbox-side), preferred over startedAt/endedAt
            because it strips the iteration loop/queue overhead. */}
        <StatusPill
          status={
            isPreparing
              ? "preparing"
              : isRunning && !isComplete
                ? "running"
                : (isError ? "failed" : "done") as ToolStatus
          }
          duration={isComplete ? executionDurationMs : undefined}
        />
      </div>

      {/* Phase 075.8 Task 7 (sketch 002 D1) + 075.9 T4 — Editor inset.
          Now extracted to ExecuteCodeEditorInset so the preparing-state
          branch in ToolCallPanel can mount the SAME Shiki view starting
          from the first ~5 streamed bytes. Reading tc.argsCodeText ??
          tc.args.code keeps the view mounted across the tool_start
          transition (no blink, no re-flow). */}
      <ExecuteCodeEditorInset tc={tc} />

      {/* Error message (error state only) */}
      {isError && tc.errorMessage && (
        <div className="mt-2 ml-0 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400 font-mono whitespace-pre-wrap">
          {tc.errorMessage}
        </div>
      )}

      {/* Terminal output — show when lines exist */}
      {hasOutput && (
        <div className="mt-2">
          {/* Collapse toggle when execution is complete */}
          {isComplete && (
            <button
              onClick={() => setTerminalOpen(v => !v)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-muted-foreground transition-colors mb-1"
            >
              {terminalOpen ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
              <Terminal className="w-2.5 h-2.5" />
              <span>Output ({lines.length} line{lines.length !== 1 ? "s" : ""})</span>
            </button>
          )}
          {(terminalOpen || isRunning) && (
            <TerminalOutput lines={lines} isStreaming={isRunning} />
          )}
        </div>
      )}

      {/* Output file download cards (success state with files) */}
      {isSuccess && outputFiles.length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          <span className="text-[10px] text-muted-foreground font-medium">Output files</span>
          {outputFiles.map((file, i) => (
            <OutputFileCard key={i} file={file} />
          ))}
        </div>
      )}
    </div>
  )
}
