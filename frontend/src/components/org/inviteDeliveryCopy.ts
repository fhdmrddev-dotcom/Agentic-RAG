/**
 * Phase 300-05 (NOTE-06 / D-11, UI-D12; UI-SPEC S4) — the one home of what the inviter is told
 * about the invitation EMAIL. The invite itself always succeeds and always yields a link
 * (link-first, D-167-02); these sentences say whether the email went.
 *
 * ⛔ Zero imports: a pure leaf the dialog and the invitations list both read.
 * ⛔ Never a provider name, an error code, or "try again" — retrying the invite would mint a
 *   second link. The way out is always the link the inviter already holds.
 */

export const INVITE_DELIVERY = {
  titles: {
    sent: "Invitation sent",
    failed: "Invitation created",
    not_configured: "Invitation ready",
  },
  /** The `sent` body, split around the bolded email address. */
  sentBefore: "We emailed an invitation to ",
  sentAfter: ". You can also copy the link and send it yourself.",
  /** D-11, verbatim. */
  failed: "Invitation created, but the email didn't send. Copy the link and send it yourself.",
  /** The invitations list: a pending row whose latest send failed. */
  chip: "Email not sent",
  /** Under a freshly resent link whose email failed again. */
  resendFailed: "The email didn't send. Copy the link and send it yourself.",
} as const

export type InviteDelivery = keyof typeof INVITE_DELIVERY.titles

export function deliveryTitle(delivery: InviteDelivery): string {
  return INVITE_DELIVERY.titles[delivery]
}
