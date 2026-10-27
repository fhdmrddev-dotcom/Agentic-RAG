import { useMemo } from "react"
import { marked } from "marked"
import DOMPurify from "dompurify"
import { cn } from "@/lib/utils"

// Configure marked
marked.setOptions({ gfm: true, breaks: true })

// 296 review FE-WR-02: an allow-list of what markdown renders, none of which fetches anything at
// render — no img/picture/source/video/audio/iframe/svg/input, no `style` (tag or attribute, so no
// CSS url()), no src/srcset/poster. Links stay (a click, not a render-time request).
const NO_REMOTE_MEDIA = {
  ALLOWED_TAGS: [
    "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "b", "i", "del", "s",
    "code", "pre", "blockquote", "ul", "ol", "li", "a", "table", "thead", "tbody", "tr", "th", "td",
    "span", "div", "sup", "sub",
  ],
  ALLOWED_ATTR: ["href", "title", "align", "start", "class"],
  ALLOW_DATA_ATTR: false,
}

interface Props {
  content: string
  className?: string
  /** 296 review FE-WR-02: drop every element/attribute that would load a resource at render.
   *  For surfaces a colleague opens (the evidence report). Chat leaves it unset. */
  noRemoteMedia?: boolean
}

export function MarkdownRenderer({ content, className, noRemoteMedia = false }: Props) {
  // Plan 075.4-04 D-075.4-SC#6 — memoize the marked.parse + DOMPurify.sanitize
  // pipeline keyed by content. Skips ~marked-tokenize + ~DOMPurify-walk on
  // every parent re-render when the message text didn't change (the common
  // case during streaming — sibling MessageItem rows re-render but THIS
  // message's content is byte-identical). DOMPurify.sanitize still runs on
  // every content change (memo invalidates on prop change) — no new XSS
  // surface introduced.
  const html = useMemo(
    () =>
      noRemoteMedia
        ? DOMPurify.sanitize(marked.parse(content) as string, NO_REMOTE_MEDIA)
        : DOMPurify.sanitize(marked.parse(content) as string),
    [content, noRemoteMedia],
  )

  return (
    <div
      className={cn("markdown text-sm text-foreground leading-relaxed", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
