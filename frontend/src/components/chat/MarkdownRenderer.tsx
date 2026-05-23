import { useMemo } from "react"
import { marked } from "marked"
import DOMPurify from "dompurify"
import { cn } from "@/lib/utils"

// Configure marked
marked.setOptions({ gfm: true, breaks: true })

interface Props {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className }: Props) {
  // Plan 075.4-04 D-075.4-SC#6 — memoize the marked.parse + DOMPurify.sanitize
  // pipeline keyed by content. Skips ~marked-tokenize + ~DOMPurify-walk on
  // every parent re-render when the message text didn't change (the common
  // case during streaming — sibling MessageItem rows re-render but THIS
  // message's content is byte-identical). DOMPurify.sanitize still runs on
  // every content change (memo invalidates on prop change) — no new XSS
  // surface introduced.
  const html = useMemo(
    () => DOMPurify.sanitize(marked.parse(content) as string),
    [content],
  )

  return (
    <div
      className={cn("markdown text-sm text-foreground leading-relaxed", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
