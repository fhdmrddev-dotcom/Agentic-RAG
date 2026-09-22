/**
 * Phase 260 (PACK-03 / D-260-06 / 260-UI-SPEC §2.3 & §2.4) — Expert Spotlight Card.
 *
 * Hero visual onboarding card rendered in the chat stream when an expert consultant is active.
 * Features glowing identity gem, clean scope badges (zero lecturing text), and 3 visual Action Tiles
 * with 1-click execution.
 *
 * ⚠ Phase 262 (D-262-06 / RESEARCH R-7) — FOUR hardcoded demo-Expert sites RETIRED here, as
 * rewrites with their original reason preserved (the `SEED-177` rule, precedent `D-206-07`).
 * They were: a default action-tile array and the branch that returned it; a per-Expert icon
 * guesser duplicated VERBATIM into `InviteExpertDialog.tsx`; and a leading arm in each of the
 * two badge labels returning the seeded Expert's own folder name and skill name as literals.
 * ⛔ The exact identifiers, line numbers and retired strings are recorded in
 * `docs/HOT-FILE-LEDGER.md` and `262-02-SUMMARY.md` — spelling them here would satisfy the very
 * greps that prove they are gone.
 *
 * ⭐ THEY SHIPPED FOR A REAL REASON AND IT IS WORTH KEEPING READABLE. At Phase 260 there was
 * one seeded demo Expert (migration 188) and no read path for the presentation columns at all
 * — migration 189 had not landed. Hardcoding that Expert's face, its three prompts, its folder
 * name and its skill name was the only way the hero card could look like the sketch it was
 * built from.
 *
 * ⛔ IT IS NOW A LIE, AND THAT IS WHY IT GOES. `ExpertAuthoringStudio` writes `icon` and
 * `prompt_suggestions`, so an Expert authored by a customer — one that merely had the word
 * "financial" in its NAME — rendered the demo Expert's glyph, three prompts it never authored,
 * a folder label naming documents it cannot see, and a skill it does not carry. Every branch
 * below now reads the Expert's OWN row, and no fallback anywhere inspects `slug` or `name`.
 */

import { X, ArrowRight, Folder, Wrench } from "lucide-react"
import type { ExpertBundle } from "@/types"
import { ExpertIcon } from "@/components/experts/expertIcon"
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

// ⚠ RETIRED (262-02): the default action-tile array — three verbatim revenue / margin /
// cash-flow prompts that were returned to ANY Expert whose slug matched the seeded demo Expert
// or whose name merely CONTAINED the word "financial". It was the only way to fill the hero
// grid before `prompt_suggestions` had an author-facing writer. An Expert that authored no
// suggestions now gets the honest single "Explore Scope" tile this function always had for
// everyone else — one true tile beats three invented ones.
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
  return [
    {
      icon: "✨",
      title: "Explore Scope",
      prompt: `What documents and analysis are available under ${expert.name}?`,
    },
  ]
}

// ⚠ RETIRED (262-02): the per-Expert icon guesser — a slug/name string-match returning one of
// four emoji, duplicated VERBATIM into `InviteExpertDialog.tsx`. Two copies of one decision is a
// one-home-per-concern violation on its own, and neither copy read the `icon` column migration
// 189 added and the authoring studio writes. Both call sites now render
// `<ExpertIcon icon={expert.icon} />` — see `@/components/experts/expertIcon`.

export function ExpertSpotlightCard({
  expert,
  onSelectPrompt,
  onDismiss,
  className,
}: ExpertSpotlightCardProps) {
  const isRestricted = expert.scope_mode === "restricted"
  const tiles = getTilesForExpert(expert)

  // Domain badge names.
  // ⚠ RETIRED (262-02): both labels carried a leading demo-Expert arm returning a literal
  // folder name and a literal skill name. Those named the SEEDED Expert's own folder and skill
  // — true for it at Phase 260, a fabrication for every Expert authored since. Each label now
  // falls to the arm it already had for every other Expert, so the card states only what the
  // row says.
  //
  // ⛔ The folder pill stays a COUNT on purpose. This is a hero summary; the folder NAMES are
  // PACK-12's job in the detail modal (plan 04), where an id that cannot be resolved needs an
  // honest "a folder you cannot see" state rather than a blank.
  //
  // ⚠ CORRECTED (262-UAT R.3): both labels still had a FALLBACK that invented a fact —
  // `length || 1` turned zero folders into "1 Folders", and a skill-less Expert got a
  // `domain_tools` chip. An absent binding now renders no chip at all.
  const folderCount = expert.knowledge_folder_ids?.length ?? 0
  const folderLabel =
    folderCount > 0 ? `${folderCount} Folder${folderCount === 1 ? "" : "s"}` : null

  const skillLabel =
    expert.member_skills && expert.member_skills.length > 0 ? expert.member_skills[0] : null

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
            <ExpertIcon icon={expert.icon} className="h-5 w-5 text-violet-200" />
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
            {(folderLabel || skillLabel) && (
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {folderLabel && (
                  <span
                    data-testid="expert-spotlight-folder-chip"
                    className="inline-flex items-center gap-1 bg-white/5 border border-white/10 text-muted-foreground text-[11px] rounded-full px-2.5 py-0.5 font-medium"
                  >
                    <Folder className="h-3 w-3 text-violet-400" />
                    {folderLabel}
                  </span>
                )}
                {skillLabel && (
                  <span
                    data-testid="expert-spotlight-skill-chip"
                    className="inline-flex items-center gap-1 bg-white/5 border border-white/10 text-muted-foreground text-[11px] rounded-full px-2.5 py-0.5 font-medium font-mono"
                  >
                    <Wrench className="h-3 w-3 text-violet-400" />
                    {skillLabel}
                  </span>
                )}
              </div>
            )}
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
