/**
 * Phase 260 (PACK-02 / D-260-02 / 260-UI-SPEC §2.1) — Invite Expert Dialog.
 *
 * Modal dialog for browsing and selecting domain experts to advise on the active thread.
 */

import { useEffect, useState } from "react"
import { Sparkles, Check, Loader2, Folder, Wrench, Shield } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { listExperts } from "@/lib/api"
import type { ExpertBundle } from "@/types"
import { cn } from "@/lib/utils"

interface InviteExpertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectExpert: (expert: ExpertBundle) => void
  currentExpertId?: string | null
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

export function InviteExpertDialog({
  open,
  onOpenChange,
  onSelectExpert,
  currentExpertId,
}: InviteExpertDialogProps) {
  const [experts, setExperts] = useState<ExpertBundle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let mounted = true
    setLoading(true)
    setError(null)

    listExperts(true, true)
      .then((data) => {
        if (mounted) {
          setExperts(data)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load experts")
          setLoading(false)
        }
      })

    return () => {
      mounted = false
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="invite-expert-dialog"
        className="max-w-md bg-card/95 border-border/80 backdrop-blur-md shadow-2xl p-6 rounded-2xl"
      >
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <DialogTitle className="text-base font-semibold text-foreground">
              Invite an Expert
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Invite a domain consultant into this thread. The expert scopes document search and tools while retaining full chat history.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-3 max-h-[380px] overflow-y-auto pr-1">
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
              <span className="text-xs">Loading available experts...</span>
            </div>
          )}

          {error && (
            <div className="p-3 text-xs rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && experts.length === 0 && (
            <div className="py-10 text-center text-xs text-muted-foreground">
              No expert bundles currently available for this organization.
            </div>
          )}

          {!loading &&
            !error &&
            experts.map((expert) => {
              const isCurrent = expert.id === currentExpertId
              const iconEmoji = getExpertIcon(expert)
              const isRestricted = expert.scope_mode === "restricted"

              return (
                <div
                  key={expert.id}
                  data-testid={`expert-card-${expert.slug}`}
                  className={cn(
                    "group relative p-3.5 rounded-xl border transition-all duration-200",
                    isCurrent
                      ? "bg-violet-500/10 border-violet-500/40 ring-1 ring-violet-500/30"
                      : "bg-muted/30 hover:bg-muted/60 border-border/60 hover:border-violet-500/30",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 flex items-center justify-center text-lg shrink-0">
                      {iconEmoji}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {expert.name}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wider",
                            isRestricted
                              ? "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-300 border border-amber-500/20",
                          )}
                        >
                          {isRestricted ? "Restricted" : "Biased"}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {expert.description || "Specialized domain assistant with scoped access."}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-muted-foreground/80">
                        {expert.knowledge_folder_ids?.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Folder className="h-3 w-3 text-violet-400" />
                            {expert.knowledge_folder_ids.length} folder{expert.knowledge_folder_ids.length > 1 ? "s" : ""}
                          </span>
                        )}
                        {expert.member_skills?.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Wrench className="h-3 w-3 text-violet-400" />
                            {expert.member_skills.length} skill{expert.member_skills.length > 1 ? "s" : ""}
                          </span>
                        )}
                        {expert.required_connections?.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Shield className="h-3 w-3 text-violet-400" />
                            {expert.required_connections.length} conn
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      data-testid={`invite-expert-btn-${expert.slug}`}
                      onClick={() => {
                        onSelectExpert(expert)
                        onOpenChange(false)
                      }}
                      className={cn(
                        "text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-150 flex items-center gap-1.5",
                        isCurrent
                          ? "bg-violet-500/20 text-violet-200 border border-violet-500/40 cursor-default"
                          : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
                      )}
                    >
                      {isCurrent ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-violet-400" />
                          Active
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          Invite to Thread
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
