import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { MarkdownRenderer } from "./MarkdownRenderer"

/**
 * The agent's interim natural-language narration (message.content) while an
 * agentic run is still streaming — "Now I'll search the knowledge base…",
 * "Next I'll generate the chart…". This is PROCESS text, not the final answer:
 * the backend keeps only the last iteration's content, so at run-end this
 * narration gives way to the persisted final answer (rendered normally by
 * MessageItem once the run settles).
 *
 * While the run is live we fold the narration to a one-line GIST (the most
 * recent line — "what the agent is doing now") with click-to-expand for the
 * full trail. This keeps the conversation readable instead of growing a raw
 * run-on blob below the run card (the reported concern), and the full text
 * stays one click away.
 *
 * Provider-agnostic: reads the normalized `message.content` channel that the
 * backend gateway populates for every provider, so the folded gist reads the
 * same on zhipu/GLM, Anthropic, OpenAI, etc.
 */
export function StreamingNarration({ content }: { content: string }) {
  const [open, setOpen] = useState(false)
  const gist = toGist(content)
  if (!gist) return null
  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid="streaming-narration">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          data-testid="streaming-narration-trigger"
          className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground/80 hover:text-foreground transition-colors w-full text-left"
        >
          {open ? (
            <ChevronDown className="w-3 h-3 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 shrink-0" />
          )}
          <span className="flex-1 truncate italic">{gist}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0">
        <div
          data-testid="streaming-narration-body"
          className="mt-1 ml-1.5 px-3 py-2 text-sm text-muted-foreground/80 border-l-2 border-muted-foreground/20 max-h-64 overflow-y-auto"
        >
          <MarkdownRenderer content={content} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

/**
 * The collapsed gist = the most recent non-empty line of the narration (what
 * the agent is doing right now), with leading markdown markers + inline
 * emphasis stripped so the one-line preview reads as plain prose.
 */
function toGist(text: string): string {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const last = lines.length ? lines[lines.length - 1] : ""
  return last
    .replace(/^[#>\-*+\s]+/, "") // leading heading / list / quote markers
    .replace(/[*_`]/g, "") // inline emphasis / code ticks
    .trim()
}
