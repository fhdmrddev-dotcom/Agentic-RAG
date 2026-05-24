import { MarkdownRenderer } from "../MarkdownRenderer"
import type { ToolCall } from "@/types"

// Phase 075.7 Plan 01 (D-02 atomic extraction): lifted from ToolCallPanel.tsx
// WebSearchResult (L389-397).

export interface WebSearchBodyProps {
  result: string
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function summarize(_tc: ToolCall): string {
  // D-03 contract requires (tc: ToolCall) => string signature; web_search
  // result is opaque markdown today, so no derivation is performed.
  return "View search results"
}

export default function WebSearchBody({ result }: WebSearchBodyProps) {
  return (
    <div className="max-h-48 overflow-y-auto overflow-x-hidden">
      <div className="text-[11px] text-foreground/70 leading-relaxed space-y-1">
        <MarkdownRenderer content={result} className="text-[11px]" />
      </div>
    </div>
  )
}
