import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { LogOut, Plus, Sparkles, Moon, Sun, Shield, Menu, type LucideIcon } from "lucide-react"
import type { ActiveView } from "@/App"
// Phase 103 (REQ-7) — the single shared nav source (kills the triplication).
// Phase 148 (VIS-01 / D-04): the rail renders the effective-features-FILTERED
// `navItems` prop threaded from App (governed items already vanished per sketch
// 069-A) — NOT the raw NAV_ITEMS const — so a non-operator's rail hides the same
// governed features the mobile drawer does. Render-only; the API is the wall.
import type { NavItem } from "@/lib/nav-items"

// Phase 156 (POLISH-01 / D-01, D-07, Wave 1): NavPanel is a PERMANENT icon rail —
// logo → New Chat (+) → nav icons → footer icons. The old collapsible w-64↔w-16 column
// (which MASKED its content, incl. New Chat + the thread list, on collapse — the
// SEED-045 Anchor-1 bug) is gone: the whole thread region moved to the dedicated
// `ChatHistoryColumn` (D-09), so this rail is stream-free and its growth can NEVER hide
// New Chat on any view — SC#1 by construction.
//
// Phase 156 REFINEMENT (operator 2026-07-16, sketch-left-layout Variant A): the rail
// still defaults to the thin 58px icon spine, but a deliberate ☰ click now EXPANDS it
// to ~210px with labels beside every icon — so the operator can "unfold it and see it
// fully" (their concern a). It is PINNED (never hover — the annoyance they flagged) and
// its open/closed choice is remembered by the parent (`nav_rail_expanded`, owned in
// ChatLayout; this component stays pure/presentational). Collapsed icons keep their
// hover tooltips; expanded rows drop the tooltip since the label is already visible.

interface Props {
  activeView: ActiveView
  onNavigate: (view: ActiveView) => void
  // Phase 148 (VIS-01 / D-04): the effective-features-FILTERED nav list from App —
  // governed items the caller can't use are already dropped (the vanish, never a
  // locked/badged item). The operator shield stays OUTSIDE this list (isOperator).
  navItems: readonly NavItem[]
  // Phase 146 (ADMIN-01 / D-07): the App-level probe result, render-only. When true,
  // the amber operator shield renders at the rail bottom; when false/loading it
  // renders NOTHING (no placeholder, no reserved space). The shield lives OUTSIDE the
  // shared NAV_ITEMS array (a regression test locks that), so the array never leaks
  // the surface.
  isOperator: boolean
  // Phase 156 (D-02): the rail's New Chat (+) — reachable from EVERY view. Fires
  // onNewThread() then switches to chat, so "New Chat from Settings" works.
  onNewThread: (folderId?: string | null) => void
  onSignOut: () => void
  theme: "light" | "dark"
  onToggleTheme: () => void
  // Phase 156 REFINEMENT: the pinned ☰ expand/collapse state (icons ⇄ labels). Parent-
  // owned + persisted so this component stays pure; false = the default 58px icon rail.
  expanded: boolean
  onToggleExpanded: () => void
}

// One rail control, two renderings. Collapsed → a 40px icon square wrapped in a
// hover tooltip (the label lives in the tip). Expanded → a full-width row with the
// icon + a visible label, tooltip dropped (redundant). `className` carries the
// tone-specific colours (primary New-Chat wash, active highlight, amber shield, …).
function RailItem({
  expanded,
  icon: Icon,
  label,
  active,
  onClick,
  className,
}: {
  expanded: boolean
  icon: LucideIcon
  label: string
  active?: boolean
  onClick: () => void
  className?: string
}) {
  const button = (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center h-10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        expanded ? "w-full justify-start gap-3 px-3" : "w-10 justify-center",
        className,
      )}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {expanded && <span className="text-sm font-medium truncate">{label}</span>}
    </button>
  )
  if (expanded) return button
  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" className="ml-2">{label}</TooltipContent>
    </Tooltip>
  )
}

export function NavPanel({
  activeView,
  onNavigate,
  navItems,
  isOperator,
  onNewThread,
  onSignOut,
  theme,
  onToggleTheme,
  expanded,
  onToggleExpanded,
}: Props) {
  const isControlRoom = activeView === "control-room"

  return (
    <div
      className={cn(
        "hidden md:flex flex-col h-full shrink-0 bg-sidebar border-r border-border/20 py-3 motion-safe:transition-[width] motion-safe:duration-300",
        expanded ? "w-[210px] items-stretch px-2" : "w-[58px] items-center",
      )}
    >
      {/* Logo + the ☰ expand/collapse toggle. Collapsed → stacked & centered; expanded
          → logo left, toggle flush right (sketch Variant A .rail-toggle self-end). */}
      <div
        className={cn(
          "flex shrink-0",
          expanded ? "items-center justify-between w-full mb-1" : "flex-col items-center gap-1.5",
        )}
      >
        <div className="flex items-center justify-center w-8 h-8 rounded-lg gradient-primary shadow-sm shadow-primary/20 shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
        {/* PINNED toggle (never hover) — the label-reveal the operator asked for. The
            aria-label flips Expand⇄Collapse; the parent persists the choice. */}
        <button
          onClick={onToggleExpanded}
          aria-label={expanded ? "Collapse navigation" : "Expand navigation"}
          aria-expanded={expanded}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <Menu className="w-[18px] h-[18px] shrink-0" />
        </button>
      </div>

      {/* New Chat (+) + the primary nav items. */}
      <div className={cn("flex flex-col gap-1 mt-4 flex-1", expanded ? "items-stretch" : "items-center")}>
        {/* Phase 156 (D-02 / SC#1): New Chat lives permanently on the rail — no state
            can hide it. From a non-chat view it also switches to chat. */}
        <RailItem
          expanded={expanded}
          icon={Plus}
          label="New chat"
          onClick={() => {
            onNewThread()
            onNavigate("chat")
          }}
          className="text-primary bg-primary/10 hover:bg-primary/20"
        />

        {navItems.map(({ view, icon, label }) => (
          <RailItem
            key={view}
            expanded={expanded}
            icon={icon}
            label={label}
            active={activeView === view}
            onClick={() => onNavigate(view)}
            className={
              activeView === view
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40"
            }
          />
        ))}
      </div>

      {/* Footer: theme toggle, probe-gated operator shield, sign out. */}
      <div className={cn("flex flex-col gap-1 mt-auto", expanded ? "items-stretch" : "items-center")}>
        <RailItem
          expanded={expanded}
          icon={theme === "dark" ? Sun : Moon}
          label={theme === "dark" ? "Light Mode" : "Dark Mode"}
          onClick={onToggleTheme}
          className="text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40"
        />

        {/* Phase 146 (ADMIN-01 / D-07): the probe-gated operator shield. Amber lucide
            Shield (distinct from Governance's ShieldCheck), active-highlights when in
            the Control Room. Rendered ONLY when isOperator, and OUTSIDE navItems (the
            D-07 non-discoverable contract — nothing rendered for non-operators). */}
        {isOperator && (
          <RailItem
            expanded={expanded}
            icon={Shield}
            label="Control Room"
            active={isControlRoom}
            onClick={() => onNavigate("control-room")}
            className={
              isControlRoom
                ? "bg-amber-500/15 text-amber-400"
                : "text-amber-400/80 hover:text-amber-400 hover:bg-amber-500/10"
            }
          />
        )}

        <RailItem
          expanded={expanded}
          icon={LogOut}
          label="Sign out"
          onClick={onSignOut}
          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        />
      </div>
    </div>
  )
}
