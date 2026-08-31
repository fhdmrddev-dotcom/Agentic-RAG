/**
 * Phase 216 (GRANT-03 / CHAT-07 / D-216-08) — Interactive Tool Approval Card.
 *
 * Rendered inline in chat when an external tool execution requires human approval ("ask" posture).
 *
 * ── ⚠ THE THIRD BUTTON WAS DESIGNED, WRITTEN DOWN, AND NEVER BUILT (fixed 2026-08-31) ──
 * `grantsVocabulary.ts` has carried `ASK_ALWAYS` — "Always allow {tool} on this
 * connection" — since Phase 213, and the settings panel has offered all three postures
 * for just as long. This card shipped with two. So the only way to stop being asked the
 * same question was to leave the conversation, find the connection in Settings, and
 * change it there — for a decision the person was already being asked to make, right
 * here, with the arguments in front of them. Same BUILD-OR-DROP failure as the view
 * card's `⋯`: the copy shipped, the button did not.
 *
 * ── ⚠ "ALWAYS" IS TWO ACTS AND EITHER CAN OUTLIVE THE OTHER ─────────────────────────────
 * Letting THIS call through needs only that the thread is yours. Changing what a
 * connection may do needs `org:manage`. A member who clicks Always gets the first and not
 * the second — so the card reports the halves separately and never claims a setting
 * changed when it did not. The server does the grant write itself (a read-merge-write it
 * owns), because doing it here would put a lost-update race on a permission surface.
 */

import { useState } from "react"
import { Check, ShieldAlert, X, Loader2, Infinity as InfinityIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ConnectionMarkGlyph } from "@/lib/connectionMark"
import { submitToolApproval } from "@/lib/api"
import { GRANTS_COPY } from "@/components/settings/grantsVocabulary"
import { cn } from "@/lib/utils"

export interface ToolApprovalRequest {
  callId: string
  /** ⚠ WITHOUT THIS THERE IS NO "ALWAYS" BUTTON. Two connections can share a
   *  `service_id`, so the row being changed has to be named, never inferred. A run that
   *  paused before this field existed simply gets the two-button card. */
  connectionId?: string
  serviceId: string
  serviceName: string
  toolName: string
  args: Record<string, any>
}

export type ApprovalDecision = "allow" | "reject" | "always"

interface ChatToolApprovalCardProps {
  threadId: string
  approval: ToolApprovalRequest
  onDecision?: (decision: ApprovalDecision) => void
}

export function ChatToolApprovalCard({
  threadId,
  approval,
  onDecision,
}: ChatToolApprovalCardProps) {
  const [submitting, setSubmitting] = useState(false)
  const [decisionState, setDecisionState] = useState<ApprovalDecision | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Set only when "Always" let the call through but could NOT change the setting. */
  const [grantProblem, setGrantProblem] = useState<string | null>(null)

  // No connection id means no row to change — an older paused run, or an event from
  // before the field existed. The button is not rendered rather than rendered broken.
  const canAlwaysAllow = Boolean(approval.connectionId)

  async function handleDecision(decision: ApprovalDecision) {
    if (submitting || decisionState) return
    setSubmitting(true)
    setError(null)
    setGrantProblem(null)
    try {
      const res = await submitToolApproval(threadId, approval.callId, decision, {
        connectionId: approval.connectionId,
        toolName: approval.toolName,
      })
      // ⚠ THE TWO HALVES ARE READ SEPARATELY. `status: "ok"` means the run was released;
      // it says nothing about whether the grant was written, and collapsing them would
      // tell someone their setting changed when it did not.
      if (decision === "always" && res.grant_persisted === false) {
        setGrantProblem(res.grant_problem || GRANTS_COPY.ASK_ALWAYS_NOTE)
      }
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
        decisionState === "allow" || decisionState === "always"
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
              {canAlwaysAllow
                ? `${GRANTS_COPY.ASK_NOTHING_SENT} “Always allow” changes the setting for ${approval.toolName} on ${approval.serviceName || approval.serviceId}.`
                : GRANTS_COPY.ASK_NOTHING_SENT}
            </div>
          </div>
        </div>

        {decisionState === "allow" || decisionState === "always" ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-500/10 px-2.5 py-1 rounded-full">
            <Check className="h-3.5 w-3.5" />
            {/* ⚠ THE SETTLED STATE TELLS THE TRUTH ABOUT WHICH ONE HAPPENED. "Always
                allowed" on a click that only allowed once would be the exact lie this
                card's own grant/approval split exists to prevent. */}
            {decisionState === "always" && !grantProblem ? "Always allowed" : "Approved"}
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

      {/* ⚠ ALLOWED ONCE, SETTING UNCHANGED — said plainly, in the place the person clicked.
          Silence here would leave them believing they will not be asked again. */}
      {grantProblem && (
        <div
          data-testid="approval-grant-problem"
          className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md p-2 my-2"
        >
          {grantProblem}
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
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : GRANTS_COPY.ASK_APPROVE}
          </Button>
          {/* ⚠ THE WORDS ARE `GRANTS_COPY`'s, NOT NEW ONES. This card and the settings
              panel are two views of ONE decision, and two vocabularies for it is how the
              same posture ends up called different things in different rooms. */}
          {canAlwaysAllow && (
            <Button
              size="sm"
              variant="outline"
              disabled={submitting}
              onClick={() => handleDecision("always")}
              data-testid="approval-always-btn"
              title={GRANTS_COPY.ASK_ALWAYS_NOTE}
              className="h-7 px-3 text-xs border-primary/40 text-primary hover:bg-primary/10 font-medium"
            >
              {submitting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <InfinityIcon className="h-3 w-3 mr-1" />
                  Always allow
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
