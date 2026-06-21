import { useState } from "react"
import { Zap, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NavRow } from "./NavRow"
import { updateRule, deleteRule } from "@/lib/api"
import type { ClassificationRule, ViewCondition, ViewConditionOp } from "@/types"
import { cn } from "@/lib/utils"

/**
 * AutomationGroup — the "Automation" sidebar group (Phase 118, sketch 037-A),
 * a PEER to the Folders + Views groups. Clones the ViewsGroup shape (group header +
 * shared NavRow list + kebab actions) — each rule row builds from the SHARED NavRow
 * (NEVER a FolderNode clone), with a Zap icon (vs the amber folder / funnel view), the
 * tooltip-labeled `G` global pill (`isGlobal={rule.is_global}`), and Edit / Delete
 * kebab actions.
 *
 * The 037-A rule-row anatomy: `● name [G] · condition (mono) → 📁 action · [toggle] · ⋯`
 *  - the enabled DOT is green when enabled, dim when disabled;
 *  - the condition summary is a frozen, mono one-line render of the rule's match_expr;
 *  - the → folder action shows the suggested-folder name;
 *  - the toggle is a live `role="switch"` that PATCHes `updateRule(id, {enabled})`
 *    (the enable/disable rides the UPDATE path — no separate endpoint);
 *  - the kebab edits (→ onEditRule, opens the builder) / deletes (→ deleteRule).
 *
 * Unlike ViewsGroup the per-row "would match N" live count is OWNED BY THE BUILDER, not
 * the row — the row shows the STATIC condition summary instead (a rule is a forward-only
 * upload trigger, not a live saved filter; D-118-2). So there is no lazy fetchCount here.
 *
 * UX-01: Deep Midnight / Aether, mobile-responsive, WCAG 2.1 AA — the toggle + kebab
 * are keyboard-operable; the NavRow reveals actions on hover OR focus-within (never
 * hover-only, which is touch-invisible).
 */

/** Plain-language operator labels for the frozen condition summary (sans, never
 *  jargon — mirrors the FilterBar/RuleBuilderPanel chip rendering). */
const OP_LABEL: Record<ViewConditionOp, string> = {
  eq: "is",
  one_of: "is one of",
  contains: "contains",
  is_empty: "is empty",
  gte: "≥",
  lte: "≤",
  between: "between",
  within_next: "within next",
  older_than: "older than",
  before: "before",
  after: "after",
}

function conditionText(c: ViewCondition): string {
  const op = OP_LABEL[c.op]
  if (c.op === "is_empty") return `${c.field} ${op}`
  if (c.op === "one_of") return `${c.field} ${op} ${(c.values ?? []).join(", ")}`
  if (c.op === "between") return `${c.field} ${op} ${c.value} – ${c.value2}`
  if (c.op === "within_next" || c.op === "older_than") {
    return `${c.field} ${op} ${c.value} ${c.unit ?? "days"}`
  }
  return `${c.field} ${op} ${c.value}`
}

/** A whole-rule condition summary: the flat-AND conditions joined with "AND". */
function summarize(rule: ClassificationRule): string {
  const conds = rule.match_expr?.conditions ?? []
  if (conds.length === 0) return "any document"
  return conds.map(conditionText).join(" AND ")
}

export interface AutomationGroupProps {
  /** The caller's own + global classification rules (from `listRules()`, owned by the page). */
  rules: ClassificationRule[]
  /** Edit → open the RuleBuilderPanel pre-filled for an in-place PATCH. */
  onEditRule: (rule: ClassificationRule) => void
  /** Fired after a rule's `enabled` is toggled live so the page can reconcile its list. */
  onToggled: (rule: ClassificationRule) => void
  /** Fired after a rule is deleted so the page can drop it from the list. */
  onDeleted: (id: string) => void
  /** id → folder name map (resolved by the page) for the → folder action label. */
  folderNames?: Record<string, string>
}

export function AutomationGroup({
  rules,
  onEditRule,
  onToggled,
  onDeleted,
  folderNames = {},
}: AutomationGroupProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const handleToggle = async (rule: ClassificationRule) => {
    setTogglingId(rule.id)
    try {
      const updated = await updateRule(rule.id, { enabled: !rule.enabled })
      onToggled(updated)
    } catch (err) {
      console.error("Could not toggle rule:", err)
    } finally {
      setTogglingId(null)
    }
  }

  const handleConfirmDelete = async (id: string) => {
    setDeletingId(null)
    try {
      await deleteRule(id)
      onDeleted(id)
    } catch (err) {
      console.error("Could not delete rule:", err)
    }
  }

  return (
    <div className="flex flex-col">
      {/* Group header — mirrors the Folders/Views header style (uppercase, tracked). */}
      <div className="flex items-center justify-between px-2 mb-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
          Automation
        </span>
        <Zap className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden="true" />
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-6 px-2">
          <p className="text-sm font-medium">No classification rules yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            New rule suggests a folder for matching uploads.
          </p>
        </div>
      ) : (
        rules.map((rule) => {
          const isDeleting = deletingId === rule.id
          const folderName = rule.suggest_folder_id
            ? folderNames[rule.suggest_folder_id] ?? "a folder"
            : "no folder"
          return (
            <div key={rule.id}>
              <NavRow
                icon={Zap}
                iconClassName={rule.enabled ? "text-emerald-400" : "text-muted-foreground/40"}
                name={rule.name}
                isGlobal={rule.is_global}
                actions={
                  <>
                    {/* Live enabled toggle (037-A) — PATCHes updateRule(id,{enabled}). */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rule.enabled}
                      aria-label={`${rule.enabled ? "Disable" : "Enable"} rule ${rule.name}`}
                      disabled={togglingId === rule.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleToggle(rule)
                      }}
                      className={cn(
                        "relative h-4 w-7 shrink-0 rounded-full transition-colors disabled:opacity-50",
                        "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        rule.enabled ? "bg-emerald-500/70" : "bg-muted",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute top-0.5 h-3 w-3 rounded-full bg-background transition-transform",
                          rule.enabled ? "left-0.5 translate-x-3" : "left-0.5 translate-x-0",
                        )}
                      />
                    </button>

                    {/* Kebab — Edit / Delete. */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          aria-label={`Actions for ${rule.name}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-3 w-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onEditRule(rule)
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Edit rule
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeletingId(rule.id)
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                }
              />

              {/* The 037-A condition → folder summary line (mono, under the row). */}
              <div className="ml-8 -mt-0.5 mb-1 flex items-center gap-1.5 px-2 text-[11px] text-muted-foreground">
                <code className="font-mono truncate">{summarize(rule)}</code>
                <span aria-hidden="true">→</span>
                <span className="inline-flex items-center gap-0.5 shrink-0">
                  <span aria-hidden="true">📁</span>
                  {folderName}
                </span>
              </div>

              {/* Inline delete confirmation (mirrors the ViewsGroup idiom). */}
              {isDeleting && (
                <div className="ml-8 py-2 px-2 text-xs text-muted-foreground flex items-center gap-2 flex-wrap bg-destructive/5 rounded-md mt-1">
                  <span>
                    Delete the rule <strong>{rule.name}</strong>? Your documents are not
                    affected — only this rule is removed (existing suggestions stay).
                  </span>
                  <div className="flex gap-1.5 mt-1 w-full">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-6 text-xs px-2.5"
                      onClick={() => void handleConfirmDelete(rule.id)}
                    >
                      Delete
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs px-2.5"
                      onClick={() => setDeletingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

export default AutomationGroup
