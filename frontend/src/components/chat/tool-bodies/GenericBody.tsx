import type { ToolCall } from "@/types"
import { stripUntrustedEnvelope } from "./untrustedEnvelope"

// Phase 075.7 Plan 01 (D-02 atomic extraction): lifted from ToolCallPanel.tsx
// GenericResult (L401-409). Fallback for any tool name not matched by the
// registry (consumed by summarizeToolCall in tool-bodies/index.ts).

export interface GenericBodyProps {
  result: string
}

export function summarize(tc: ToolCall): string {
  // ⚠ THE ENVELOPE COMES OFF FIRST, OR THE PREVIEW IS 80 CHARACTERS OF OUR OWN
  // MARKUP. A connector result begins `<external_tool_result service="…" tool="…">`,
  // which is longer than this budget on its own — so before this line the run card's
  // one-line summary of every connector call showed the fence and none of the answer.
  const r = stripUntrustedEnvelope(tc.result ?? "")
  if (!r) return "no output"
  const cleaned = r.replace(/\s+/g, " ").trim()
  return cleaned.length > 80 ? cleaned.slice(0, 80) + "…" : cleaned
}

export default function GenericBody({ result }: GenericBodyProps) {
  return (
    <div className="max-h-48 overflow-y-auto overflow-x-hidden">
      <pre className="text-[10px] font-mono text-foreground/50 whitespace-pre-wrap break-words leading-relaxed">
        {(() => {
          // The expanded body too: a person opening a step wants the tool's output,
          // not the armour wrapped around it for the model's benefit.
          const shown = stripUntrustedEnvelope(result)
          return shown.slice(0, 1500) + (shown.length > 1500 ? "\n…" : "")
        })()}
      </pre>
    </div>
  )
}
