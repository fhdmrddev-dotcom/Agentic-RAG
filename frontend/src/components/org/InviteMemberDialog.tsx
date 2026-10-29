/**
 * Phase 167 Plan 05 Task 2 (INV-01 / D-167-02 / D-167-03) — the invite-member modal.
 *
 * Clones the shipped `CreateLinkDialog` SHELL (the shadcn Dialog + reset-on-open + the
 * segmented role chips + the confirm handler with 422-vs-transient error discrimination +
 * the loading footer button + the onCreated→parent-re-fetch rule). NO new package — the
 * 166 line established `@radix-ui/react-popover` is NOT installed; this uses the shipped
 * `@/components/ui/dialog`.
 *
 * Fields:
 *   - an email input, and
 *   - a segmented role picker: **Member (default)** + **Org-admin**, with **Dept-admin
 *     greyed/disabled** (D-167-03 — a plain "available once departments ship" hint, NEVER
 *     a lying enabled control; the server also refuses non-{member,org-admin} roles).
 *
 * Delivery is LINK-FIRST (D-167-02): on a successful send the raw-token invite LINK is
 * surfaced with a copy affordance for the inviter to share — no email service required by
 * default. The raw token lives ONLY in that link (T-167-18); it is never stored or logged
 * separately. `onCreated` fires so the parent re-fetches (re-fetch-not-optimistic).
 *
 * SECURITY (T-167-17): this modal is render courtesy only — every write is server-gated on
 * `org:invite` (Plan 02). A forced mount without the permission 403s at the wire.
 * Org-indigo `primary` accent throughout — the reserved operator warning tint is never used.
 *
 * Phase 300-05 (NOTE-06 / D-11, UI-D12): the result panel has THREE arms by `email_delivery` —
 * "Invitation sent" (we emailed it), "Invitation created" (the email did not go: the D-11 sentence
 * in a NEUTRAL box, and Copy link takes focus, since the link is the one thing left to do) and the
 * shipped "Invitation ready" (no email attempted, or an older backend). Every word comes from
 * `inviteDeliveryCopy.ts`; no arm names the mail provider, an error code, or a retry.
 */
import { useEffect, useRef, useState } from "react"
import { Check, Copy, Link2, MailX } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { sendInvitation, ApiError } from "@/lib/api"
import { cn } from "@/lib/utils"
import { INVITE_DELIVERY, deliveryTitle, type InviteDelivery } from "./inviteDeliveryCopy"

interface Props {
  open: boolean
  onClose: () => void
  /** Fired after a successful send — the parent re-fetches the invitation list (D-117-9
   *  re-fetch-not-optimistic precedent). */
  onCreated: () => void
}

/** The invitable roles (D-167-03). Member is the default; Org-admin is the optional
 *  elevation. Dept-admin is a GREYED/disabled option until departments ship (Phase 169) —
 *  never an active choice, and the server refuses it too. */
const ROLE_OPTIONS: ReadonlyArray<{
  value: string
  label: string
  enabled: boolean
  hint: string
}> = [
  { value: "member", label: "Member", enabled: true, hint: "Can use the workspace." },
  {
    value: "org-admin",
    label: "Org-admin",
    enabled: true,
    hint: "Can manage members, invitations, and org settings.",
  },
  {
    value: "dept-admin",
    label: "Dept-admin",
    enabled: false,
    hint: "Available once departments ship.",
  },
]

/** A minimal client-side email shape check — enables the Send button. The server
 *  re-validates (a bad shape → 422); this is only to avoid an obviously-empty submit. */
function looksLikeEmail(value: string): boolean {
  const v = value.trim()
  return v.length >= 3 && v.includes("@") && !v.includes(" ")
}

export function InviteMemberDialog({ open, onClose, onCreated }: Props) {
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<string>("member")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The link-first success panel: the raw-token invite link to copy/share (D-167-02).
  const [sentLink, setSentLink] = useState<string | null>(null)
  // 300-05 (D-11): how the invitation email went, from the server's answer.
  const [delivery, setDelivery] = useState<InviteDelivery>("not_configured")
  const [copied, setCopied] = useState(false)
  const copyRef = useRef<HTMLButtonElement>(null)

  // Reset-on-open (the CreateLinkDialog posture): clear form + result + errors when the
  // modal is (re)opened so a prior send never bleeds into the next.
  useEffect(() => {
    if (!open) return
    setEmail("")
    setRole("member")
    setLoading(false)
    setError(null)
    setSentLink(null)
    setDelivery("not_configured")
    setCopied(false)
  }, [open])

  // The failed arm: a keyboard user lands on the one thing left to do (UI-SPEC S4).
  useEffect(() => {
    if (sentLink && delivery === "failed") copyRef.current?.focus()
  }, [sentLink, delivery])

  async function handleConfirm() {
    if (!looksLikeEmail(email)) return
    setLoading(true)
    setError(null)
    try {
      const result = await sendInvitation(email.trim(), role)
      // An older backend omits the field: read as "no email attempted", never a failure.
      setDelivery(result.email_delivery ?? "not_configured")
      setSentLink(result.link)
      onCreated() // re-fetch-not-optimistic: the parent reloads the pending list
    } catch (err) {
      // A 422 is a permanent rejection (a malformed email the server rejects, a role the
      // server refuses). "Please try again" would mislead — reserve it for transient
      // network/5xx failures and surface a non-retry message for 422 (the WR-03 rule).
      if (err instanceof ApiError && err.status === 422) {
        setError("That email address can’t be invited.")
      } else if (err instanceof ApiError && err.status === 400) {
        setError("That role can’t be granted by invitation.")
      } else {
        setError("Could not send the invitation. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  async function copyLink() {
    if (!sentLink) return
    try {
      await navigator.clipboard.writeText(sentLink)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the link is visible in the field regardless */
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{sentLink ? deliveryTitle(delivery) : "Invite a member"}</DialogTitle>
        </DialogHeader>

        {sentLink ? (
          /* ── Link-first success (D-167-02): surface the copy/share link. ── */
          <div className="min-w-0 space-y-3 py-2">
            {delivery === "sent" ? (
              <p className="break-words text-sm text-muted-foreground">
                {INVITE_DELIVERY.sentBefore}
                <span className="font-semibold text-foreground">{email.trim()}</span>
                {INVITE_DELIVERY.sentAfter}
              </p>
            ) : delivery === "failed" ? (
              <div
                role="status"
                className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-4 py-2"
              >
                <MailX className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-foreground">{INVITE_DELIVERY.failed}</p>
              </div>
            ) : (
              <p className="break-words text-sm text-muted-foreground">
                Share this link with{" "}
                <span className="font-medium text-foreground">{email.trim()}</span>. They join
                your organization by opening it and signing in.
              </p>
            )}
            <div className="flex items-stretch gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-primary/30 bg-primary/[0.06] px-3 py-2">
                <Link2 className="h-3.5 w-3.5 flex-none text-primary" aria-hidden="true" />
                <span
                  className="min-w-0 flex-1 truncate font-mono text-xs text-foreground"
                  title={sentLink}
                  data-testid="invite-link"
                >
                  {sentLink}
                </span>
              </div>
              <Button
                ref={copyRef}
                type="button"
                variant="outline"
                onClick={copyLink}
                className="flex-none gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    Copy link
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The link expires in 7 days and can be used once. You can resend or revoke it
              from the invitations list.
            </p>
          </div>
        ) : (
          /* ── The invite form: email + the segmented role picker. ── */
          <div className="min-w-0 space-y-4 py-2">
            <div>
              <label
                htmlFor="invite-email"
                className="mb-2 block text-[11px] uppercase tracking-wide text-muted-foreground"
              >
                Email address
              </label>
              <input
                id="invite-email"
                type="email"
                autoComplete="off"
                placeholder="teammate@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cn(
                  "w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm text-foreground",
                  "placeholder:text-muted-foreground/60",
                  "focus:border-primary focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                )}
              />
            </div>

            <div>
              <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                Role
              </p>
              <div role="group" aria-label="Invite role" className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((opt) => {
                  const selected = opt.enabled && role === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={!opt.enabled}
                      aria-pressed={opt.enabled ? selected : undefined}
                      aria-disabled={!opt.enabled}
                      title={opt.hint}
                      onClick={() => opt.enabled && setRole(opt.value)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                        "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        !opt.enabled
                          ? "cursor-not-allowed border-border/50 bg-muted/30 text-muted-foreground/50"
                          : selected
                            ? "border-primary bg-primary/15 text-foreground"
                            : "border-border/60 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {opt.label}
                      {!opt.enabled && (
                        <span className="ml-1 text-[10px] font-normal">(soon)</span>
                      )}
                    </button>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {ROLE_OPTIONS.find((o) => o.value === role)?.hint ??
                  "Choose the role this person gets when they join."}
              </p>
            </div>

            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {sentLink ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={!looksLikeEmail(email) || loading}>
                {loading ? "Sending…" : "Send invite"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default InviteMemberDialog
