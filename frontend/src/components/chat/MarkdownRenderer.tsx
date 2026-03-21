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
  const html = DOMPurify.sanitize(marked.parse(content) as string)

  return (
    <div
      className={cn("markdown text-sm text-foreground leading-relaxed", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
