/**
 * Phase 167 Plan 05 Task 2 (INV-01 / D-167-07) — the org Invitations & Roles home.
 *
 * Clones `OrgMembersTab`'s PURE-LEAF posture (props in, DOM out; the shell owns the
 * fetch + the re-fetch-on-mutation). The only local state is transient UI (the invite
 * dialog's open flag + the per-row busy/fresh-link state) — the OrgAuditTab `openChip`
 * precedent for a pure leaf holding its own popover state.
 *
 * Renders:
 *   - a "Send invite" affordance (opens `InviteMemberDialog`), shown only to `org:invite`
 *     holders (honest-absent otherwise — never a disabled button that lies, T-166-09);
 *   - the invitation list with per-row status chips (pending / accepted / expired /
 *     revoked) reusing the 166 chip vocabulary (org-indigo `primary`, success-green for
 *     accepted — the reserved operator warning tint is never used here);
 *   - per-row resend/revoke actions on PENDING invites (the shell performs the mutation +
 *     re-fetch; resend returns the FRESH link-first URL, D-167-02, surfaced inline to copy).
 *
 * SECURITY (T-167-17): render courtesy only — every write is server-gated on `org:invite`
 * (Plan 02). `canInvite` gates the affordances for honesty, not authorization.
 */
import { useState } from "react"
import { Check, Copy, Link2, Mail, RefreshCw, X } from "lucide-react"

import type { Invitation } from "@/lib/api"
import { cn } from "@/lib/utils"
import { InviteMemberDialog } from "./InviteMemberDialog"

interface InvitationsTabProps {
  /** Every invitation the shell fetched; `null` while the fetch is in flight. */
  invitations: Invitation[] | null
  /** Render-only gate (org:invite): show the send/resend/revoke affordances. The server
   *  gate is the real wall — this only keeps the UI honest for a non-inviter. */
  canInvite: boolean
  /** Re-fetch the list after a successful send (re-fetch-not-optimistic). */
  onSent: () => void
  /** Resend a pending invite — the shell re-mints + re-fetches and returns the FRESH
   *  link-first URL (or null on failure) so the leaf can surface it to copy. */
  onResend: (id: string) => Promise<string | null>
  /** Revoke a pending invite — the shell flips it to revoked + re-fetches. */
  onRevoke: (id: string) => Promise<void>
}

/** Map the invite role to a display chip (mirrors OrgMembersTab's D-166-05 vocabulary):
 *  managers read as the indigo `◆ Org-admin` badge, everyone else as the muted badge. */
function roleLabel(role: string): { label: string; admin: boolean } {
  if (role === "org-admin" || role === "super-admin") return { label: "Org-admin", admin: true }
  if (role === "dept-admin") return { label: "Dept-admin", admin: true }
  return { label: "Member", admin: false }
}

type ChipTone = "primary" | "success" | "muted"

/** Map the lifecycle status to a plain label + a 166-vocabulary tone. Pending is the live
 *  indigo chip; accepted is success-green (a positive terminal state — a green, not the
 *  reserved operator warning tint); expired/revoked are the calm muted chip. */
function statusChip(status: string): { label: string; tone: ChipTone } {
  switch (status) {
    case "pending":
      return { label: "Pending", tone: "primary" }
    case "accepted":
      return { label: "Accepted", tone: "success" }
    case "expired":
      return { label: "Expired", tone: "muted" }
    case "revoked":
      return { label: "Revoked", tone: "muted" }
    default:
      return { label: status, tone: "muted" }
  }
}

const CHIP_TONE_CLASS: Record<ChipTone, string> = {
  primary: "border-primary/30 bg-primary/10 text-primary",
  success: "border-success/30 bg-success/10 text-success",
  muted: "border-border bg-muted/40 text-muted-foreground",
}

/** The joined/expiry sub-line date — absolute, never fabricated. */
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "unknown"
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return "unknown"
  return new Date(t).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/** The Invitations & Roles home — send affordance + the invitation list (INV-01). */
export function InvitationsTab({
  invitations,
  canInvite,
  onSent,
  onResend,
  onRevoke,
}: InvitationsTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  // Per-row transient state: which row is mid-mutation, and the fresh resend links to copy.
  const [busyId, setBusyId] = useState<string | null>(null)
  const [freshLinks, setFreshLinks] = useState<Record<string, string>>({})
  const [copiedId, setCopiedId] = useState<string | null>(null)

  async function handleResend(id: string) {
    setBusyId(id)
    try {
      const link = await onResend(id)
      if (link) setFreshLinks((prev) => ({ ...prev, [id]: link }))
    } finally {
      setBusyId(null)
    }
  }

  async function handleRevoke(id: string) {
    setBusyId(id)
    try {
      await onRevoke(id)
    } finally {
      setBusyId(null)
    }
  }

  async function copyFresh(id: string) {
    const link = freshLinks[id]
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 2000)
    } catch {
      /* clipboard blocked — the link is visible in the row regardless */
    }
  }

  return (
    <section aria-label="Organization invitations" className="mx-auto max-w-3xl px-6 py-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-headline text-base font-bold text-foreground">Invitations &amp; Roles</h3>
        <span className="flex-1" />
        {/* Send affordance — honest-absent for a non-inviter (never a lying disabled button). */}
        {canInvite && (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
            Send invite
          </button>
        )}
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        Invite teammates by email — share the generated link and they join by signing in. Roles
        are set at send time.
      </p>

      {invitations == null ? (
        <div
          aria-busy="true"
          className="rounded-[10px] border border-border bg-card px-4 py-6 text-sm text-muted-foreground opacity-40"
        >
          Loading invitations…
        </div>
      ) : invitations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-border bg-card/40 px-4 py-10 text-center">
          <div className="text-sm font-semibold text-foreground">No invitations yet</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {canInvite
              ? "Send an invite to add a teammate to your organization."
              : "Invitations your organization sends will appear here."}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[10px] border border-border">
          <div className="divide-y divide-border/60">
            {invitations.map((inv) => (
              <InvitationRow
                key={inv.id}
                inv={inv}
                canInvite={canInvite}
                busy={busyId === inv.id}
                freshLink={freshLinks[inv.id]}
                copied={copiedId === inv.id}
                onResend={() => handleResend(inv.id)}
                onRevoke={() => handleRevoke(inv.id)}
                onCopyFresh={() => copyFresh(inv.id)}
              />
            ))}
          </div>
        </div>
      )}

      <InviteMemberDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={onSent}
      />
    </section>
  )
}

interface InvitationRowProps {
  inv: Invitation
  canInvite: boolean
  busy: boolean
  freshLink?: string
  copied: boolean
  onResend: () => void
  onRevoke: () => void
  onCopyFresh: () => void
}

/** One invitation row — identity + role chip + status chip, with resend/revoke actions on
 *  PENDING invites (gated on `canInvite`). A freshly-resent link surfaces inline to copy. */
function InvitationRow({
  inv,
  canInvite,
  busy,
  freshLink,
  copied,
  onResend,
  onRevoke,
  onCopyFresh,
}: InvitationRowProps) {
  const email = inv.email ?? "unknown invitee"
  const initial = (inv.email ?? "?").trim().charAt(0).toUpperCase() || "?"
  const role = roleLabel(inv.role)
  const status = statusChip(inv.status)
  const isPending = inv.status === "pending"

  return (
    <div className="flex flex-col gap-2 px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {/* Identity: avatar + email + status sub-line. */}
        <div className="flex min-w-0 flex-[2] items-center gap-3">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-sm font-semibold text-white"
          >
            {initial}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground" title={email}>
              {email}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {isPending
                ? `expires ${formatDate(inv.expires_at)}`
                : `invited ${formatDate(inv.created_at)}`}
            </div>
          </div>
        </div>

        {/* Role chip (166 vocabulary). */}
        <div className="flex-none">
          {role.admin ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              <span aria-hidden="true">◆</span>
              {role.label}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {role.label}
            </span>
          )}
        </div>

        {/* Status chip. */}
        <div className="flex-none">
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
              CHIP_TONE_CLASS[status.tone],
            )}
            data-testid="invitation-status"
          >
            {status.label}
          </span>
        </div>

        {/* Resend / revoke — only for PENDING invites, only for an inviter (honest-absent). */}
        {isPending && canInvite && (
          <div className="flex flex-none items-center gap-1">
            <button
              type="button"
              disabled={busy}
              onClick={onResend}
              aria-label={`Resend invitation to ${email}`}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors enabled:hover:border-primary/40 enabled:hover:text-primary disabled:opacity-40"
            >
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
              Resend
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onRevoke}
              aria-label={`Revoke invitation to ${email}`}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors enabled:hover:border-destructive/40 enabled:hover:text-destructive disabled:opacity-40"
            >
              <X className="h-3 w-3" aria-hidden="true" />
              Revoke
            </button>
          </div>
        )}
      </div>

      {/* A freshly-resent link surfaces inline to copy (link-first, D-167-02). */}
      {freshLink && (
        <div className="flex items-stretch gap-2 pl-12">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-primary/30 bg-primary/[0.06] px-2.5 py-1.5">
            <Link2 className="h-3 w-3 flex-none text-primary" aria-hidden="true" />
            <span
              className="truncate font-mono text-[11px] text-foreground"
              title={freshLink}
              data-testid="invitation-fresh-link"
            >
              {freshLink}
            </span>
          </div>
          <button
            type="button"
            onClick={onCopyFresh}
            className="inline-flex flex-none items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" aria-hidden="true" />
                Copy
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default InvitationsTab
