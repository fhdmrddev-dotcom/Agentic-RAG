import { useEffect, useRef } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

/**
 * 075.6 Plan 02 / SPEC Req #4: Collapsible live code panel rendered during
 * `tc.status === "preparing"` with non-empty `tc.argsCodeText`. Default-
 * expanded for the active preparing tool; collapsed for past preparing tools
 * and after the `tool_start` transition (reducer clears `argsCodeText`).
 *
 * Content-agnostic API per CONTEXT.md §specifics — forward-ref for v2.7
 * extended-thinking summary surface ("Thinking…" + summary stream) and
 * eval-pane streaming reuse without modification. The "live code" use case
 * is just one consumer: a future caller can pass `title="Thinking…"` +
 * `contentText={summaryStream}` and the same component renders.
 *
 * Per SPEC §Boundaries the T-260523-09 byte counter STAYS — it moves inside
 * this panel's header as a small at-a-glance label.
 *
 * Body uses plain `<pre><code>` — NO syntax highlighting in 075.6 (RESEARCH
 * Open Question 3 — deferred); existing ExecuteCodeBlock at
 * ToolCallPanel.tsx:720-721 handles post-start highlighting.
 */
export interface ToolArgsLivePanelProps {
  /** Header label, e.g. "Generating code…". Content-agnostic per CONTEXT.md
   * §specifics — future consumers can pass "Thinking…" or any other title. */
  title: string
  /** Cumulative streamed text body. Currently fed from `tc.argsCodeText`;
   * future consumers can wire any string stream. */
  contentText: string
  /** Cumulative byte count for the at-a-glance header label. */
  byteCount: number
  /** Caller-owned expanded state. Caller computes the
   * default-expanded-for-active rule via `i === lastPreparingIndex` at the
   * displayItems-map level. */
  expanded: boolean
  /** Chevron toggle handler. */
  onToggle: () => void
}

export function ToolArgsLivePanel({
  title,
  contentText,
  byteCount,
  expanded,
  onToggle,
}: ToolArgsLivePanelProps) {
  // I-2 / SPEC Req #4 screenshot caveat: max-h-64 overflow-y-auto caps the
  // visible viewport at ~256 px. For a >5 KB code stream the panel scrolls;
  // auto-scroll-to-bottom on every contentText change keeps the latest line
  // in view so the "≥5 KB visible" assertion is screenshot-stable.
  // WR-03 (2026-05-24): include `expanded` in deps so re-expanding the panel
  // mid-stream jumps to bottom; previously the <pre> mounted with
  // scrollTop=0 after a collapse → re-expand cycle on streams ≥5 KB.
  const bodyRef = useRef<HTMLPreElement>(null)
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [contentText, expanded])

  return (
    <div className="mt-1.5 rounded-md border border-border/30 bg-muted/20">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-muted/30 transition-colors"
      >
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        <span className="flex-1 text-left">{title}</span>
        {byteCount > 0 && (
          <span className="font-normal text-foreground/40 not-italic font-mono tabular-nums">
            ({(byteCount / 1024).toFixed(1)} KB)
          </span>
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-2.5 border-t border-border/20 min-w-0 overflow-hidden">
          <pre
            ref={bodyRef}
            className="text-[11px] font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap break-all text-foreground/70 mt-2"
          >
            <code>{contentText}</code>
          </pre>
        </div>
      )}
    </div>
  )
}
