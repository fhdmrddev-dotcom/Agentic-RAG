/**
 * Phase 177 Plan 01 Task 2 — OrgIdentity: RoleBadge + OrgAvatar (the D-04 primitive).
 *
 * ONE shared org-identity element. The role badge ships byte-identically at FOUR
 * sites today — OrgBand.tsx:78-87, ProfileMenu.tsx:133-142, InvitationsTab.tsx:254-266,
 * OrgMembersTab.tsx:147-165 — and the gradient initial-circle avatar at two more
 * (InvitationsTab.tsx:236-241 + the dashed pending variant OrgMembersTab.tsx:225-228).
 * This is a pure extraction (D-01): every class string is lifted verbatim.
 *
 * Honest-absent stays at the call site (D-05/D-06): these primitives READ role and
 * render — they contain ZERO gating logic (no canManage). The call site keeps the
 * `{canManage && ...}` gate. Both render presentational <span>/<div> elements only.
 */
import { cn } from "@/lib/utils"

/**
 * Reconciled 4-tier role → badge mapping (D-04 / D-166-05). OrgBand + ProfileMenu
 * historically only knew admin/member; the management tabs also emit Dept-admin.
 * This is the fuller, unified mapping every call site now shares. Pure — no gating.
 */
export function roleBadgeMeta(role: string): { label: string; admin: boolean } {
  if (role === "org-admin" || role === "super-admin") return { label: "Org-admin", admin: true }
  if (role === "dept-admin") return { label: "Dept-admin", admin: true }
  return { label: "Member", admin: false }
}

// Verbatim from OrgBand.tsx:79 (the ◆ indigo primary pill) and OrgBand.tsx:84 (the
// muted member pill). Kept as literal strings so the extraction is byte-identical to
// the four inline sources it retires.
const ADMIN_PILL =
  "inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
const MEMBER_PILL =
  "inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"

export interface RoleBadgeProps {
  /** The active-org role. Rendered via roleBadgeMeta — the primitive never gates. */
  role: string
}

/**
 * The org-scoped role badge: `◆ Org-admin` (indigo) for managers, `Member` (muted)
 * otherwise. Never-colour-alone — the label WORD is always present; the ◆ glyph is
 * decorative (aria-hidden). Presentational <span>, never interactive.
 */
export function RoleBadge({ role }: RoleBadgeProps) {
  const { label, admin } = roleBadgeMeta(role)

  if (admin) {
    return (
      <span data-testid="role-badge" data-admin="true" className={ADMIN_PILL}>
        <span aria-hidden="true">◆</span>
        {label}
      </span>
    )
  }

  return (
    <span data-testid="role-badge" data-admin="false" className={MEMBER_PILL}>
      {label}
    </span>
  )
}

// The gradient initial-circle atom (InvitationsTab.tsx:236-241) and its dashed
// indigo pending variant (OrgMembersTab.tsx:225-228). Hand-rolled gradient — NOT the
// shadcn ui/avatar.tsx image-Avatar (its look/behavior differs); do not swap.
const AVATAR_BASE = "flex h-9 w-9 flex-none items-center justify-center rounded-full text-sm font-semibold"
const AVATAR_SOLID = "bg-gradient-to-br from-primary to-primary/60 text-white"
const AVATAR_PENDING = "border border-dashed border-primary/40 bg-primary/[0.06] text-primary"

export interface OrgAvatarProps {
  /** The single initial rendered inside the circle (decorative — the name/email
   *  is the accessible identity beside it). */
  initial: string
  /** Render the dashed indigo "not joined yet" variant instead of the solid gradient. */
  pending?: boolean
}

/**
 * The org identity avatar — a gradient initial-circle, or the dashed indigo variant
 * for a still-pending invitee. Decorative (aria-hidden); the accessible identity is
 * the name/email the call site renders alongside it.
 */
export function OrgAvatar({ initial, pending = false }: OrgAvatarProps) {
  return (
    <div
      data-testid="org-avatar"
      aria-hidden="true"
      className={cn(AVATAR_BASE, pending ? AVATAR_PENDING : AVATAR_SOLID)}
    >
      {initial}
    </div>
  )
}
