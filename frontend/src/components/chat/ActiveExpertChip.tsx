/**
 * Phase 260 (PACK-02 / D-260-02 / 260-UI-SPEC §2.2) — Active Expert Chip.
 *
 * Renders inside the existing Using: chips row container (data-testid="active-connector-chips")
 * alongside attachments and active connectors.
 */

import { Sparkles, X } from "lucide-react"
import type { ExpertBundle } from "@/types"
import { cn } from "@/lib/utils"

interface ActiveExpertChipProps {
  expert: ExpertBundle
  onDismiss: () => void
  className?: string
}

export function ActiveExpertChip({
  expert,
  onDismiss,
  className,
}: ActiveExpertChipProps) {
  const scopeLabel = expert.scope_mode === "restricted" ? "Restricted" : "Biased"

  return (
    <span
      data-testid="active-expert-chip"
      data-expert-id={expert.id}
      className={cn(
        "bg-violet-500/15 border border-violet-500/35 text-violet-200 text-xs font-medium rounded-md px-2.5 py-1 flex items-center gap-1.5 shadow-xs animate-in fade-in zoom-in-95 duration-150",
        className,
      )}
    >
      <Sparkles className="h-3.5 w-3.5 text-violet-400 shrink-0" />
      <span className="font-semibold text-violet-100">{expert.name}</span>
      <span className="text-violet-300/70 text-[11px]">·</span>
      <span className="text-violet-300/90 text-[11px] font-normal uppercase tracking-wider">
        {scopeLabel}
      </span>
      <button
        type="button"
        aria-label={`Dismiss ${expert.name}`}
        onClick={onDismiss}
        className="rounded-full p-0.5 hover:bg-violet-500/20 text-violet-300 hover:text-white transition-colors ml-0.5 focus:outline-none"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
