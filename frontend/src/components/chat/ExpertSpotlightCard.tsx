/**
 * Phase 260 (PACK-03 / D-260-06 / 260-UI-SPEC §2.3 & §2.4) — Expert Spotlight Card.
 *
 * Hero visual onboarding card rendered in the chat stream when an expert consultant is active.
 * Features glowing identity gem, clean scope badges (zero lecturing text), and 3 visual Action Tiles
 * with 1-click execution.
 */

import { X, ArrowRight, Folder, Wrench } from "lucide-react"
import type { ExpertBundle } from "@/types"
import { cn } from "@/lib/utils"

interface ExpertSpotlightCardProps {
  expert: ExpertBundle
  onSelectPrompt: (prompt: string) => void
  onDismiss?: () => void
  className?: string
}

interface ActionTile {
  icon: string
  title: string
  prompt: string
}

const DEFAULT_FINANCIAL_TILES: ActionTile[] = [
  {
    icon: "📈",
    title: "Q3 Revenue Growth YoY",
    prompt: "Compare Q3 revenue growth and YoY trajectory from the latest filings.",
  },
  {
    icon: "⚖️",
    title: "Gross Margin Comparison",
    prompt: "Calculate gross margin and EBITDA breakdown based on reported figures.",
  },
  {
    icon: "💵",
    title: "Operating Cash Flow",
    prompt: "Analyze operating cash flow changes and liquidity position.",
  },
]

function getTilesForExpert(expert: ExpertBundle): ActionTile[] {
  if (expert.prompt_suggestions && expert.prompt_suggestions.length > 0) {
    return expert.prompt_suggestions.map((ps, idx) => {
      let icon = "✨"
      if (idx === 0) icon = "📈"
      else if (idx === 1) icon = "⚖️"
      else if (idx === 2) icon = "💵"
      return {
        icon,
        title: ps.title,
        prompt: ps.prompt,
      }
    })
  }
  if (expert.slug === "financial-analyzer" || expert.name.toLowerCase().includes("financial")) {
    return DEFAULT_FINANCIAL_TILES
  }
  return [
    {
      icon: "✨",
      title: "Explore Scope",
      prompt: `What documents and analysis are available under ${expert.name}?`,
    },
  ]
}

function getExpertIcon(expert: ExpertBundle): string {
  if (expert.slug === "financial-analyzer" || expert.name.toLowerCase().includes("financial")) {
    return "📊"
  }
  if (expert.name.toLowerCase().includes("legal")) {
    return "⚖️"
  }
  if (expert.name.toLowerCase().includes("code") || expert.name.toLowerCase().includes("developer")) {
    return "💻"
  }
  return "✨"
}

export function ExpertSpotlightCard({
  expert,
  onSelectPrompt,
  onDismiss,
  className,
}: ExpertSpotlightCardProps) {
  const iconEmoji = getExpertIcon(expert)
  const isRestricted = expert.scope_mode === "restricted"
  const tiles = getTilesForExpert(expert)

  // Domain badge names
  const folderLabel =
    expert.slug === "financial-analyzer" || expert.name.toLowerCase().includes("financial")
      ? "SEC Filings & Reports"
      : `${expert.knowledge_folder_ids?.length || 1} Folder${expert.knowledge_folder_ids?.length === 1 ? "" : "s"}`

  const skillLabel =
    expert.slug === "financial-analyzer" || expert.name.toLowerCase().includes("financial")
      ? "ratio_calculator"
      : expert.member_skills && expert.member_skills.length > 0
        ? expert.member_skills[0]
        : "domain_tools"

  return (
    <div
      data-testid="expert-spotlight-card"
      className={cn(
        "bg-gradient-to-br from-violet-950/40 to-slate-900/60 border border-violet-500/25 rounded-2xl p-5 shadow-xl shadow-black/40 animate-in fade-in slide-in-from-bottom-2 duration-300 backdrop-blur-md my-4",
        className,
      )}
    >
      {/* Header & Identity Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-violet-400/40 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(168,85,247,0.3)] shrink-0">
            {iconEmoji}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-foreground tracking-tight">
                {expert.name}
              </h3>
              <span
                data-testid="expert-scope-tag"
                className={cn(
                  "text-[11px] rounded-full px-2 py-0.5 font-semibold uppercase tracking-wider",
                  isRestricted
                    ? "bg-rose-500/10 border border-rose-500/30 text-rose-300"
                    : "bg-amber-500/10 border border-amber-500/30 text-amber-300",
                )}
              >
                {isRestricted ? "Restricted" : "Biased"}
              </span>
            </div>

            {/* Visual scope badges without lecturing prose */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 bg-white/5 border border-white/10 text-muted-foreground text-[11px] rounded-full px-2.5 py-0.5 font-medium">
                <Folder className="h-3 w-3 text-violet-400" />
                {folderLabel}
              </span>
              <span className="inline-flex items-center gap-1 bg-white/5 border border-white/10 text-muted-foreground text-[11px] rounded-full px-2.5 py-0.5 font-medium font-mono">
                <Wrench className="h-3 w-3 text-violet-400" />
                {skillLabel}
              </span>
            </div>
          </div>
        </div>

        {onDismiss && (
          <button
            type="button"
            aria-label={`Dismiss ${expert.name}`}
            onClick={onDismiss}
            className="rounded-full p-1.5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Action Tiles Grid (PACK-03) */}
      <div className="mt-4 pt-3 border-t border-white/[0.06]">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-violet-300/70 mb-2.5">
          Try asking
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {tiles.map((tile, idx) => (
            <button
              key={idx}
              type="button"
              data-testid={`action-tile-${idx}`}
              onClick={() => onSelectPrompt(tile.prompt)}
              className="group text-left bg-white/[0.03] hover:bg-violet-500/10 border border-white/[0.08] hover:border-violet-400/40 rounded-xl p-3 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-violet-500/40 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-base">{tile.icon}</span>
                  <span className="text-xs font-semibold text-foreground group-hover:text-violet-200 transition-colors">
                    {tile.title}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {tile.prompt}
                </p>
              </div>

              <div className="text-[10px] text-violet-300/80 group-hover:text-violet-200 flex items-center justify-between mt-3 font-medium">
                <span>Ask now</span>
                <ArrowRight className="h-3 w-3 transform group-hover:translate-x-0.5 transition-transform" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
