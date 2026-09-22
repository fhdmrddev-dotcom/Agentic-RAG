/**
 * Phase 262 plan 03 (PACK-11) — the catalog's card face.
 *
 * The five-element anatomy from sketch `261-262-expert-authoring-and-catalog` §1, in order:
 *   1 identity gem + name + meta line (category · provenance) + the scope-mode badge
 *   2 ⛔ NO LECTURING PARAGRAPH. The sketch removes it from the face deliberately ("less text,
 *     more visuals"); that prose is the detail modal's job (PACK-12, plan 04). This is a
 *     PROHIBITION and it is load-bearing — the face is the gem and the tiles.
 *   3 a scope envelope of pills: the folder COUNT, the skill names, the connection names
 *   4 up to three tiles drawn from the Expert's OWN `prompt_suggestions`
 *   5 a dual-action footer: Details and Start Chat
 *
 * ⛔ THERE IS NO SECOND VARIANT OF THIS CARD. No greyed row, no disabled row, no badge offering
 * a paid door. D-262-02's ruling is that an Expert the caller may not use does not appear at all
 * — the vanish is the server's list arriving shorter, and a card that could render an Expert as
 * unavailable would be the brochure for a shut door the sketch names.
 *
 * ⛔ THE SKETCH'S FOOTER SHOWS A THIRD CONTROL — the one that copies a system template into a
 * tenant-editable row (`SEED-303 S8`, named in `262-03-SUMMARY.md` rather than spelled here,
 * since the acceptance grep proving it absent would be satisfied by this comment). It is OUT
 * OF SCOPE, deferred by CONTEXT: it is a WRITE on a read surface. Not rendered in any form,
 * including a disabled or coming-soon one.
 *
 * ⚠ THE TILES ARE DISPLAY, NOT TRIGGERS, IN THIS PLAN. One-click execution is PACK-13 and lands
 * in plan 05; this card's declared props carry no prompt-bearing callback. A tile wired to
 * anything other than running its own prompt would be a control that lies about itself, so the
 * tiles carry no button affordance and the two footer controls own every interaction.
 */

import type { ReactNode } from "react"
import { ArrowUpRight, FolderClosed, Plug, Sparkles, Wrench } from "lucide-react"
import { ExpertIcon } from "@/components/experts/expertIcon"
import type { ExpertBundle } from "@/types"
import { cn } from "@/lib/utils"

export interface ExpertCardProps {
  expert: ExpertBundle
  /** Opens the detail view (plan 04). */
  onInspect: (expert: ExpertBundle) => void
  /** Starts a scoped conversation with this Expert (plan 05). */
  onStartChat: (expert: ExpertBundle) => void
}

/** Element 3 — one muted pill, used for every envelope entry so no resource type outranks another. */
function ScopePill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      {icon}
      {label}
    </span>
  )
}

export function ExpertCard({ expert, onInspect, onStartChat }: ExpertCardProps) {
  const isRestricted = expert.scope_mode === "restricted"
  const folderCount = expert.knowledge_folder_ids?.length ?? 0
  const skills = expert.member_skills ?? []
  const connections = expert.required_connections ?? []
  // Up to three, the sketch's count. An Expert with none renders no strip at all — an invented
  // tile would be this phase's sixth demo-Expert hardcode (RESEARCH R-7, retired in plan 02).
  const tiles = (expert.prompt_suggestions ?? []).slice(0, 3)

  return (
    <div
      data-testid={`expert-card-${expert.slug}`}
      className="group flex flex-col justify-between gap-4 rounded-xl border border-border/70 bg-card p-5 transition-all hover:border-primary/50 hover:shadow-md"
    >
      <div className="space-y-3">
        {/* ── 1 · identity gem, name, meta line, scope-mode badge ── */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 text-violet-200 ring-1 ring-violet-500/30">
            <ExpertIcon icon={expert.icon} className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-semibold leading-snug text-foreground">
                {expert.name}
              </h3>
              <span
                className={cn(
                  "rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                  isRestricted
                    ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
                    : "border-amber-500/20 bg-amber-500/10 text-amber-300",
                )}
              >
                {isRestricted ? "Restricted" : "Biased"}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
              {/* An absent category says so; it is never folded under someone else's heading. */}
              {expert.category?.trim() || "Uncategorised"}
              {" · "}
              {expert.is_system ? "System Template" : "Org Custom"}
            </p>
          </div>
        </div>

        {/* ── 3 · scope envelope. Folders are a COUNT here; the NAMES are the modal's job. ── */}
        <div className="flex flex-wrap gap-1.5">
          {folderCount > 0 && (
            <ScopePill
              icon={<FolderClosed className="h-2.5 w-2.5 text-violet-400" />}
              label={`${folderCount} folder${folderCount === 1 ? "" : "s"}`}
            />
          )}
          {skills.map((s) => (
            <ScopePill
              key={`skill-${s}`}
              icon={<Wrench className="h-2.5 w-2.5 text-violet-400" />}
              label={s}
            />
          ))}
          {connections.map((c) => (
            <ScopePill
              key={`conn-${c}`}
              icon={<Plug className="h-2.5 w-2.5 text-violet-400" />}
              label={c}
            />
          ))}
        </div>

        {/* ── 4 · the Expert's own prompt tiles, or nothing ── */}
        {tiles.length > 0 && (
          <ul data-testid="expert-card-tiles" className="space-y-1.5">
            {tiles.map((t, i) => (
              <li
                key={`${t.title}-${i}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 text-[11px] text-foreground/90"
              >
                <span className="truncate">{t.title}</span>
                <ArrowUpRight className="h-3 w-3 flex-none text-muted-foreground/70" />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── 5 · dual-action footer ── */}
      <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-3">
        <button
          type="button"
          onClick={() => onInspect(expert)}
          className="rounded-lg border border-border/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          Details
        </button>
        <button
          type="button"
          onClick={() => onStartChat(expert)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Start Chat
        </button>
      </div>
    </div>
  )
}
