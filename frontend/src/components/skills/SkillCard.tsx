import { useState } from "react"
import { Zap, Eye, EyeOff, Pencil, Globe, Trash2, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { Skill } from "@/types"

interface Props {
  skill: Skill
  currentUserId: string
  onEdit: (skill: Skill) => void
  onDelete: (id: string) => Promise<void>
  onToggleEnabled: (id: string) => Promise<void>
  onToggleGlobal: (id: string) => Promise<void>
  onTryInChat: (skillName: string) => void
}

export function SkillCard({
  skill,
  currentUserId,
  onEdit,
  onDelete,
  onToggleEnabled,
  onToggleGlobal,
  onTryInChat,
}: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const isOwner = skill.user_id === currentUserId

  const handleToggle = async (toggleFn: (id: string) => Promise<void>) => {
    try {
      await toggleFn(skill.id)
    } catch {
      setToggleError("Failed to update skill.")
      setTimeout(() => setToggleError(null), 3000)
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl bg-card ghost-border p-4 transition-all animate-fadeSlideUp",
        !skill.is_enabled && "opacity-50",
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <Zap className="h-4 w-4 mt-0.5 text-primary shrink-0" />
        <span className="font-semibold text-sm text-foreground truncate flex-1 min-w-0">{skill.name}</span>
        {skill.is_global && (
          <span className="text-[10px] text-muted-foreground bg-muted px-2 py-1 rounded-full shrink-0">
            Global
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
            {/* Toggle enabled — hidden for global skills the user doesn't own */}
            {!(skill.user_id !== currentUserId && skill.is_global) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleToggle(onToggleEnabled)}
                  >
                    {skill.is_enabled ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {skill.is_enabled ? "Disable skill" : "Enable skill"}
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
                      onClick={() => onEdit(skill)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
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
                      onClick={() => handleToggle(onToggleGlobal)}
                    >
                      <Globe className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {skill.is_global ? "Unshare" : "Share globally"}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:text-destructive"
                      onClick={() => setConfirmingDelete(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
    </div>
  )
}
