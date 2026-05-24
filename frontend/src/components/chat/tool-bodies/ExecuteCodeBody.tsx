import { useState, useRef, useEffect } from "react"
import { Terminal, CheckCircle2, XCircle, Loader2, Clock, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ToolCall, OutputLine, OutputFile } from "@/types"
import { OutputFileCard } from "../OutputFileCard"

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

  // 2026-05-24 UX refinement: replace the hardcoded near-black zinc-900
  // container with a theme-aware card surface that keeps the terminal
  // affordance (monospace, line-by-line, per-stream colour coding) while
  // integrating with the Deep Midnight palette. Adds a small header strip
  // so the user can see at a glance what kind of pane this is (was "messy
  // and not organised" per 2026-05-23 UAT feedback).
  return (
    <div className="rounded-md border border-border/40 bg-card/60 overflow-hidden">
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border/30 bg-muted/30">
        <span className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground/80">
          Terminal output
        </span>
        {isStreaming && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-1" />
        )}
        <span className="ml-auto text-[9px] font-mono text-muted-foreground/50">
          {lines.length} {lines.length === 1 ? "line" : "lines"}
        </span>
      </div>
      <div
        ref={containerRef}
        className="px-2.5 py-2 font-mono text-xs leading-relaxed max-h-64 overflow-y-auto"
      >
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              "flex items-start gap-1.5",
              line.kind === "stdout" ? "text-foreground/85" : "text-red-400"
            )}
            style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
          >
            {/* Plan 075.4-04 D-075.4-SC#6 — inline stderr badge alongside red lines.
                Sits beside the line content so the operator can disambiguate
                stderr from red-coloured stdout (some libraries print warnings to
                stdout with ANSI red). Per-line badge complements the error-box
                below (which renders only for `errorMessage`, not per-line). */}
            {line.kind === "stderr" && (
              <span className="inline-flex items-center rounded-sm bg-red-500/15 px-1 py-0 text-[9px] uppercase tracking-wider text-red-400 font-semibold leading-tight flex-shrink-0 mt-0.5">
                stderr
              </span>
            )}
            <span className="flex-1 min-w-0">{line.content}</span>
          </div>
        ))}
        {isStreaming && lines.length > 0 && (
          <span className="inline-block w-1.5 h-3 bg-primary/60 animate-pulse rounded-sm" />
        )}
      </div>
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
            {isRunning ? "Executing code" : isError ? "Execution failed" : "Code executed"}
          </span>
          {/* Description (preferred) or raw code preview */}
          {tc.args.description ? (
            <span className="ml-1.5 opacity-60 italic">{tc.args.description}</span>
          ) : tc.args.code ? (
            <span className="ml-1.5 opacity-50">
              &ldquo;{tc.args.code.slice(0, 60)}{tc.args.code.length > 60 ? "..." : ""}&rdquo;
            </span>
          ) : null}
        </span>
        {/* Duration badge — use executionDurationMs from backend, not startedAt/endedAt */}
        {isComplete && executionDurationMs != null && executionDurationMs > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60 font-mono tabular-nums flex-shrink-0">
            <Clock className="w-2.5 h-2.5" />
            {formatDuration(executionDurationMs)}
          </span>
        )}
        {/* Phase 067.4 R-5 (D-067.4-R5-01 amended): live elapsed counter during
            execution. Hidden once `executionDurationMs` lands (post-completion
            duration badge above takes over). Mirrors the post-completion badge
            shape verbatim — same Clock icon, same formatDuration helper, same
            Tailwind classes. */}
        {isRunning && !isComplete && tc.elapsedSeconds != null && tc.elapsedSeconds > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60 font-mono tabular-nums flex-shrink-0">
            <Clock className="w-2.5 h-2.5" />
            {formatDuration(tc.elapsedSeconds * 1000)}
          </span>
        )}
        {/* Status indicator */}
        <span className="flex-shrink-0">
          {isRunning && !isComplete ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
          ) : isError ? (
            <XCircle className="w-3.5 h-3.5 text-red-400" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-success animate-checkPop" />
          )}
        </span>
      </div>

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
              className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors mb-1"
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
          <span className="text-[10px] text-muted-foreground/50 font-medium">Output files</span>
          {outputFiles.map((file, i) => (
            <OutputFileCard key={i} file={file} />
          ))}
        </div>
      )}
    </div>
  )
}
