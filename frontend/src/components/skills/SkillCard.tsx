import { useState } from "react"
import { Zap, Pencil, Globe, Trash2, MessageSquare, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { PublishGateDialog } from "./PublishGateDialog"
import type { Skill } from "@/types"

interface Props {
  skill: Skill
  currentUserId: string
  onEdit: (skill: Skill) => void
  onSelect: (skill: Skill) => void
  onDelete: (id: string) => Promise<void>
  onToggleEnabled: (id: string) => Promise<void>
  // Phase 136 (GATE-01): the share direction rides an optional `override` through
  // the publish gate; the unshare direction passes nothing (never gated — D-07).
  onToggleOrgShared: (id: string, override?: boolean) => Promise<void>
  onTryInChat: (skillName: string) => void
  onExport: (id: string, name: string) => Promise<void>
  // Phase 137-07 (PANEL-01 / sketch 057 MAP / D-06): passed through to the publish
  // gate dialog's UNMET-branch "Review evals →" link (Studio · Evals). Optional so
  // callers without a navigator simply render no link.
  onReviewEvals?: (skillId: string) => void
}

export function SkillCard({
  skill,
  currentUserId,
  onEdit,
  onSelect,
  onDelete,
  onToggleEnabled,
  onToggleOrgShared,
  onTryInChat,
  onExport,
  onReviewEvals,
}: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [localEnabled, setLocalEnabled] = useState(skill.is_enabled)
  const [exporting, setExporting] = useState(false)
  // Phase 136 (GATE-01 / D-05): the private→org-shared share opens the gate dialog.
  const [showPublishDialog, setShowPublishDialog] = useState(false)

  const isOwner = skill.user_id === currentUserId

  // Keep local state in sync if the skill prop changes from outside
  // (e.g. parent re-fetches or bulk updates)
  if (localEnabled !== skill.is_enabled && !toggleError) {
    setLocalEnabled(skill.is_enabled)
  }

  const handleToggleEnabled = async () => {
    // Optimistically flip local state immediately for instant feedback
    const nextEnabled = !localEnabled
    setLocalEnabled(nextEnabled)
    try {
      await onToggleEnabled(skill.id)
    } catch {
      // Revert on failure
      setLocalEnabled(!nextEnabled)
      setToggleError("Failed to update skill.")
      setTimeout(() => setToggleError(null), 3000)
    }
  }

  const handleToggleOrgShared = async () => {
    try {
      await onToggleOrgShared(skill.id)
    } catch {
      setToggleError("Failed to update skill.")
      setTimeout(() => setToggleError(null), 3000)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await onExport(skill.id, skill.name)
    } catch {
      setToggleError("Export failed. Try again.")
      setTimeout(() => setToggleError(null), 3000)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      // Phase 155 (A11Y-01): the card is a keyboard-operable button-role open target.
      // It hosts nested controls (toggle, export/edit/delete, Try in Chat), so it
      // cannot be a native <button>; the rule's sanctioned fallback (role + tab +
      // keyboard support) is used, with the Enter/Space handler guarded to the card
      // itself so a nested control's key press never double-fires open. (A fully
      // separated open/action restructure is logged to SEED-092-remainder.)
      role="button"
      tabIndex={0}
      aria-label={`Open skill: ${skill.name}`}
      className={cn(
        "rounded-xl bg-card ghost-border p-4 transition-all animate-fadeSlideUp cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        !localEnabled && "opacity-50",
      )}
      onClick={() => onSelect(skill)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(skill)
        }
      }}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <Zap className="h-4 w-4 mt-0.5 text-primary shrink-0" />
        <span className="font-semibold text-sm text-foreground truncate flex-1 min-w-0">{skill.name}</span>
        {/* Phase 137.2 / CREATE-01 (D-01) — ONE pill via a ternary: "Built-in"
            (trust-badge tint) for a system-owned platform built-in, else the
            existing muted "Shared with org" pill. A built-in is inherently shared,
            so two pills would be redundant. Reflects the backend value; never set
            here (badge-spoofing mitigation, T-137.2-02). Phase 165 (MIG-02):
            is_system stays the physical marker (D-165-02); is_global→is_org_shared. */}
        {skill.is_system ? (
          <span className="text-[10px] text-primary bg-primary/10 px-2 py-1 rounded-full shrink-0">
            Built-in
          </span>
        ) : skill.is_org_shared && (
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full shrink-0">
            Shared with org
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground line-clamp-2 mt-1.5">{skill.description}</p>

      {/* Divider */}
      <div className="border-t border-border/50 mt-3 pt-3" />

      {/* Footer */}
      {confirmingDelete ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm text-foreground">Delete skill?</p>
          <p className="text-xs text-muted-foreground">"{skill.name}" will be permanently deleted.</p>
          <div className="flex gap-2 mt-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setConfirmingDelete(false)}
            >
              Keep Skill
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="text-xs"
              onClick={async () => {
                await onDelete(skill.id)
                setConfirmingDelete(false)
              }}
            >
              Delete Skill
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          {/* Try in Chat */}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => onTryInChat(skill.name)}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Try in Chat
          </Button>

          {/* Action buttons */}
          <div className="flex items-center gap-0.5">
            {/* Toggle enabled — hidden for org-shared skills the user doesn't own */}
            {!(skill.user_id !== currentUserId && skill.is_org_shared) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-full"
                    onClick={handleToggleEnabled}
                    aria-pressed={localEnabled}
                    aria-label={localEnabled ? "Disable skill" : "Enable skill"}
                  >
                    <div
                      className={cn(
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-200",
                        !localEnabled && "bg-muted",
                      )}
                      style={localEnabled ? {
                        backgroundImage: "linear-gradient(135deg, hsl(239 84% 67%), hsl(258 90% 66%))"
                      } : undefined}
                    >
                      <span className={cn(
                        "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
                        localEnabled ? "translate-x-4" : "translate-x-1",
                      )} />
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {localEnabled ? "Disable skill" : "Enable skill"}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Owner-only actions */}
            {isOwner && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={exporting}
                      onClick={handleExport}
                      aria-label="Export skill"
                    >
                      {exporting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{exporting ? "Exporting..." : "Export skill"}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => { e.stopPropagation(); onSelect(skill); onEdit(skill) }}
                      aria-label="Edit skill"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit skill</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        // D-07: unshare (shared→private) is a direct, never-gated
                        // toggle; share (private→org-shared) opens the publish gate.
                        if (skill.is_org_shared) {
                          handleToggleOrgShared()
                        } else {
                          setShowPublishDialog(true)
                        }
                      }}
                      aria-label={skill.is_org_shared ? "Unshare skill" : "Share skill with org"}
                    >
                      <Globe className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {skill.is_org_shared ? "Unshare" : "Share with org"}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:text-destructive"
                      onClick={() => setConfirmingDelete(true)}
                      aria-label="Delete skill"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete skill</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toggle error */}
      {toggleError && (
        <p className="text-xs text-destructive mt-1">{toggleError}</p>
      )}

      {/* Phase 136 (GATE-01 / D-05): publish gate on the share direction. The
          server is the gate (D-07) — onConfirm just echoes the override choice. */}
      <PublishGateDialog
        skillId={skill.id}
        open={showPublishDialog}
        onOpenChange={setShowPublishDialog}
        onConfirm={async (override) => {
          await onToggleOrgShared(skill.id, override)
        }}
        onReviewEvals={onReviewEvals}
      />
    </div>
  )
}
