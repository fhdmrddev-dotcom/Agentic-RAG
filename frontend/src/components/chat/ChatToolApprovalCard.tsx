/**
 * Phase 216 (GRANT-03 / CHAT-07 / D-216-08) — Interactive Tool Approval Card.
 *
 * Rendered inline in chat when an external tool execution requires human approval ("ask" posture).
 * Provides clear parameter preview and "Allow" / "Reject" decision actions.
 */

import { useState } from "react"
import { Check, ShieldAlert, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConnectionMarkGlyph } from "@/lib/connectionMark"
import { submitToolApproval } from "@/lib/api"
import { cn } from "@/lib/utils"

export interface ToolApprovalRequest {
  callId: string
  serviceId: string
  serviceName: string
  toolName: string
  args: Record<string, any>
}

interface ChatToolApprovalCardProps {
  threadId: string
  approval: ToolApprovalRequest
  onDecision?: (decision: "allow" | "reject") => void
}

export function ChatToolApprovalCard({
  threadId,
  approval,
  onDecision,
}: ChatToolApprovalCardProps) {
  const [submitting, setSubmitting] = useState(false)
  const [decisionState, setDecisionState] = useState<"allow" | "reject" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDecision(decision: "allow" | "reject") {
    if (submitting || decisionState) return
    setSubmitting(true)
    setError(null)
    try {
      await submitToolApproval(threadId, approval.callId, decision)
      setDecisionState(decision)
      onDecision?.(decision)
    } catch (err: any) {
      setError(err.message || "Failed to submit decision")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      data-testid={`tool-approval-card-${approval.callId}`}
      className={cn(
        "my-3 p-4 rounded-xl border transition-all duration-200",
        decisionState === "allow"
          ? "border-green-500/30 bg-green-500/5 text-foreground"
          : decisionState === "reject"
            ? "border-destructive/30 bg-destructive/5 text-foreground"
            : "border-amber-500/40 bg-amber-500/5 shadow-xs",
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="p-1 rounded-md bg-background border border-border/80 shadow-xs">
            <ConnectionMarkGlyph
              shape={{ service_id: approval.serviceId }}
              size="chip"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-xs text-foreground">
                {approval.serviceName || approval.serviceId}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                · {approval.toolName}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Action requires your approval to proceed
            </div>
          </div>
        </div>

        {decisionState === "allow" ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-500/10 px-2.5 py-1 rounded-full">
            <Check className="h-3.5 w-3.5" />
            Approved
          </span>
        ) : decisionState === "reject" ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-destructive bg-destructive/10 px-2.5 py-1 rounded-full">
            <X className="h-3.5 w-3.5" />
            Rejected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
            <ShieldAlert className="h-3 w-3" />
            Approval Required
          </span>
        )}
      </div>

      {/* Arguments preview */}
      {approval.args && Object.keys(approval.args).length > 0 && (
        <div className="my-2.5 p-2.5 rounded-lg bg-background/80 border border-border/60 font-mono text-[11px] max-h-36 overflow-y-auto">
          <div className="text-[10px] text-muted-foreground font-sans font-medium mb-1">
            Parameters:
          </div>
          <pre className="whitespace-pre-wrap break-all text-foreground/90">
            {JSON.stringify(approval.args, null, 2)}
          </pre>
        </div>
      )}

      {error && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2 my-2">
          {error}
        </div>
      )}

      {!decisionState && (
        <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-border/40">
          <Button
            size="sm"
            variant="outline"
            disabled={submitting}
            onClick={() => handleDecision("reject")}
            data-testid="approval-reject-btn"
            className="h-7 px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-border"
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reject"}
          </Button>
          <Button
            size="sm"
            disabled={submitting}
            onClick={() => handleDecision("allow")}
            data-testid="approval-allow-btn"
            className="h-7 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Allow Action"}
          </Button>
        </div>
      )}
    </div>
  )
}
