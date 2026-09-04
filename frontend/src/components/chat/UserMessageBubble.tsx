/**
 * Phase 227 Wave 3 — UserMessageBubble component (B-2).
 *
 * Encapsulates user message role presentation and 7-line clamping with gradient fade
 * extracted from MessageItem.tsx:
 *   - UserBubble: 7-line clamp, Read more/Show less toggle, and gradient fade
 */
import { useRef, useState, useLayoutEffect } from "react"
import { cn } from "@/lib/utils"

/**
 * Phase 128 Plan 02 (D-01 / D-03 / D-04) — user bubble 7-line clamp.
 *
 * Visual contract:
 *   - <= 7 lines: renders whole text with no fade and no toggle (clean text)
 *   - > 7 lines: clamped to 7 lines via webkit-line-clamp + CSS gradient fade
 *     into bubble violet (D-03) + underline "Read more" toggle button.
 *   - Click "Read more": expands full height, swaps toggle label to "Show less",
 *     removes fade. Click "Show less": re-clamps.
 *
 * DOM note: uses <p> rather than <MarkdownRenderer> so raw markdown doesn't
 * throw on user content (T-128-02-02); jsdom reports 0/0 (no layout) so the
 * effect no-ops in tests, which assert structure + the fade class instead.
 */
export function UserBubble({ content }: { content: string }) {
  const pRef = useRef<HTMLParagraphElement>(null)
  const [overflowing, setOverflowing] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // useLayoutEffect (NOT useEffect) so the measure runs pre-paint — avoids the
  // one-frame full-height flash before the clamp applies (RESEARCH Pitfall 5).
  useLayoutEffect(() => {
    const el = pRef.current
    if (el) setOverflowing(el.scrollHeight > el.clientHeight + 1)
  }, [content])

  return (
    <div className="relative" data-testid="user-bubble">
      <p
        ref={pRef}
        className={cn(
          "whitespace-pre-wrap break-words",
          !expanded && "[display:-webkit-box] [-webkit-line-clamp:7] [-webkit-box-orient:vertical] overflow-hidden",
        )}
      >
        {content}
      </p>
      {/* Fade dissolves into the bubble violet (the 135° gradient's END,
          index.css:199), NOT the page bg — D-03. Only while clamped + overflowing. */}
      {overflowing && !expanded && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-[hsl(258_90%_66%)] to-transparent"
        />
      )}
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs text-white/80 underline"
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  )
}
