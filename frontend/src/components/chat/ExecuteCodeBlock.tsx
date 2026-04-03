import { useState, useRef, useEffect } from "react"
import { Terminal, CheckCircle2, XCircle, Loader2, Download, Clock, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ToolCall, OutputLine, OutputFile } from "@/types"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

interface ExecuteCodeBlockProps {
  tc: ToolCall
}

function OutputFileCard({ file }: { file: OutputFile }) {
  return (
    <a
      href={file.url}
      download={file.filename}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2.5 rounded-md bg-muted/30 ghost-border px-3 py-2 text-xs hover:bg-accent/40 transition-colors group"
    >
      <Download className="w-3.5 h-3.5 text-primary flex-shrink-0" />
      <span className="flex-1 font-mono text-foreground/80 truncate">{file.filename}</span>
      <span className="text-muted-foreground/50 flex-shrink-0">{formatBytes(file.size)}</span>
    </a>
  )
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

  return (
    <div
      ref={containerRef}
      className="rounded-md bg-zinc-900/80 p-2.5 font-mono text-xs leading-relaxed max-h-64 overflow-y-auto"
    >
      {lines.map((line, i) => (
        <div
          key={i}
          className={cn(
            line.kind === "stdout" ? "text-emerald-400" : "text-red-400"
          )}
          style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}
        >
          {line.content}
        </div>
      ))}
      {isStreaming && lines.length > 0 && (
        <span className="inline-block w-1.5 h-3 bg-emerald-400/50 animate-pulse rounded-sm" />
      )}
    </div>
  )
}

export function ExecuteCodeBlock({ tc }: ExecuteCodeBlockProps) {
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
  const lines = tc.outputLines ?? []
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
          {/* Code preview from args if available */}
          {tc.args.code && (
            <span className="ml-1.5 opacity-50">
              &ldquo;{tc.args.code.slice(0, 60)}{tc.args.code.length > 60 ? "..." : ""}&rdquo;
            </span>
          )}
        </span>
        {/* Duration badge — use executionDurationMs from backend, not startedAt/endedAt */}
        {isComplete && executionDurationMs != null && executionDurationMs > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60 font-mono tabular-nums flex-shrink-0">
            <Clock className="w-2.5 h-2.5" />
            {formatDuration(executionDurationMs)}
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
