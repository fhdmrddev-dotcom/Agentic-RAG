// ─────────────────────────────────────────────────────────────────────────────
// Phase 166 Plan 05 (ADMIN-02 / ADMIN-03 / ADMIN-05 / D-166-02 / D-166-05 /
// sketch 079-C) — ProfileMenu, the merged rail-footer identity popover.
//
// The 079-C Hybrid: ONE rail-footer identity anchor (mirroring RailItem's
// collapsed/expanded dual-render so it works icon-only at the 58px rail) opens a
// menu holding, top to bottom:
//   • identity — name/email from useAuth (App already holds the user; do NOT re-fetch)
//   • the ◆ Org-admin / Member role badge (indigo admin / muted member — D-166-05)
//   • the org-switcher section — renders ONLY at 2+ orgs (D-166-02); a solo user sees
//     just the identity, no switcher chrome
//   • the theme toggle (079-C relocates theme OUT of its standalone rail RailItem into
//     this one home — the footer must render exactly ONE theme control)
//   • Sign out (sign-out moves INTO the menu; it no longer has its own RailItem)
//
// This is the user-side mirror of the Phase-146 operator shield: "who am I / my
// controls," made a rail-footer anchor (there is no top bar — SEED-113's "top-right
// anchor" lands in the footer where Sign out used to live).
//
// PRESENTATIONAL: picking an org calls OrgProvider.switchOrg(), which OWNS the
// D-166-08 teardown (subscriptions down → guarded clearThreadBucket → refetch). The
// menu NEVER tears down streams itself (no clearThreadBucket here — grep-locked).
//
// Primitive: the shipped shadcn DropdownMenu (Radix Menu) — the rail-footer popover
// with no new package (threat T-166-SC: no installs). Org data is read via
// useOrgOptional() so the menu still renders where no OrgProvider is mounted (tests /
// the pre-provider shell) — a solo/empty context simply hides the switcher.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react"
import { Building2, Check, LogOut, Moon, Sun, User } from "lucide-react"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/useAuth"
import { useOrgOptional } from "@/providers/OrgProvider"

interface ProfileMenuProps {
  /** The current theme — the menu's theme item flips its icon/label off this. */
  theme: "light" | "dark"
  /** Toggle the theme (owned by the parent; the menu stays presentational). */
  onToggleTheme: () => void
  /** Sign out — lives INSIDE the menu now (079-C merges the bare Sign out RailItem). */
  onSignOut: () => void
  /** True when the rail is the 58px icon spine — the anchor renders icon-only. */
  collapsed: boolean
}

/** True for the roles that hold `org:manage` — they get the ◆ Org-admin badge
 *  (mirrors OrgBand.isOrgAdminRole so the badge copy never disagrees). */
function isOrgAdminRole(role: string): boolean {
  return role === "org-admin" || role === "super-admin"
}

/** The 079-C merged rail-footer identity anchor + popover. */
export function ProfileMenu({ theme, onToggleTheme, onSignOut, collapsed }: ProfileMenuProps) {
  const { user } = useAuth()
  const org = useOrgOptional()
  const [open, setOpen] = useState(false)

  const email = user?.email ?? null
  const displayName =
    (user?.user_metadata?.name as string | undefined) ||
    (email ? email.split("@")[0] : "Account")

  const orgs = org?.orgs ?? []
  const activeOrgId = org?.activeOrgId ?? null
  const role = org?.role ?? "member"
  const admin = isOrgAdminRole(role)
  // D-166-02: the switcher is chrome ONLY at 2+ orgs; a solo user (100% today) sees
  // just the identity anchor — a quiet name button, no switcher.
  const showSwitcher = orgs.length >= 2

  // RailItem dual-render: collapsed → a 40px icon square; expanded → a full-width row
  // with the name/email beside the icon. Both open the SAME popover.
  const anchor = (
    <button
      type="button"
      aria-label="Account menu"
      className={cn(
        "flex items-center h-10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40",
        collapsed ? "w-10 justify-center" : "w-full justify-start gap-3 px-3",
      )}
    >
      <User className="w-5 h-5 shrink-0" />
      {!collapsed && (
        <span className="flex-1 min-w-0 text-left leading-tight">
          <span className="block text-sm font-medium truncate text-sidebar-foreground">{displayName}</span>
          {email && (
            <span className="block text-[11px] text-muted-foreground truncate">{email}</span>
          )}
        </span>
      )}
    </button>
  )

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      {/* Collapsed → wrap the trigger in a hover tooltip (the label lives in the tip),
          mirroring RailItem. Expanded → the name/email is already visible, no tooltip. */}
      {collapsed ? (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{anchor}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" className="ml-2">
            Account
          </TooltipContent>
        </Tooltip>
      ) : (
        <DropdownMenuTrigger asChild>{anchor}</DropdownMenuTrigger>
      )}

      <DropdownMenuContent side="right" align="end" sideOffset={8} className="w-64">
        {/* Identity header + role badge (D-166-05) — the same badge copy the shell band shows. */}
        <div className="px-2 py-1.5">
          <div className="text-sm font-semibold text-foreground truncate" title={displayName}>
            {displayName}
          </div>
          {email && (
            <div className="text-[11px] text-muted-foreground truncate" title={email}>
              {email}
            </div>
          )}
          <div className="mt-1.5">
            {admin ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                <span aria-hidden="true">◆</span>
                Org-admin
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Member
              </span>
            )}
          </div>
        </div>

        {/* Org switcher — ONLY at 2+ orgs (D-166-02). Picking a non-active org delegates
            to OrgProvider.switchOrg (D-166-08 teardown owner); the menu never wipes buckets. */}
        {showSwitcher && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Switch organization
            </DropdownMenuLabel>
            {orgs.map((o) => {
              const isActive = o.org_id === activeOrgId
              return (
                <DropdownMenuItem
                  key={o.org_id}
                  className="gap-2"
                  onSelect={() => {
                    if (!isActive) org?.switchOrg(o.org_id)
                    setOpen(false)
                  }}
                >
                  <Building2 className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
                  <span className="flex-1 truncate">{o.name}</span>
                  {isActive && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                </DropdownMenuItem>
              )
            })}
          </>
        )}

        <DropdownMenuSeparator />

        {/* Theme — the ONE home for the toggle (079-C removes the standalone rail RailItem).
            preventDefault keeps the popover open so flipping theme doesn't dismiss identity. */}
        <DropdownMenuItem
          className="gap-2"
          onSelect={(e) => {
            e.preventDefault()
            onToggleTheme()
          }}
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
        </DropdownMenuItem>

        {/* Sign out — now a menu item (moved off the rail footer). */}
        <DropdownMenuItem
          className="gap-2 text-muted-foreground focus:text-destructive"
          onSelect={() => onSignOut()}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
