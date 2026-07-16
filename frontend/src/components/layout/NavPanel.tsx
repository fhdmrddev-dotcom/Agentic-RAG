import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { LogOut, Plus, Sparkles, Moon, Sun, Shield } from "lucide-react"
import type { ActiveView } from "@/App"
// Phase 103 (REQ-7) — the single shared nav source (kills the triplication).
// Phase 148 (VIS-01 / D-04): the rail renders the effective-features-FILTERED
// `navItems` prop threaded from App (governed items already vanished per sketch
// 069-A) — NOT the raw NAV_ITEMS const — so a non-operator's rail hides the same
// governed features the mobile drawer does. Render-only; the API is the wall.
import type { NavItem } from "@/lib/nav-items"

// Phase 156 (POLISH-01 / D-01, D-07, Wave 1): NavPanel is now a PERMANENT thin icon
// rail (~58px) — logo → New Chat (+) → nav icons → footer icons. The old collapsible
// w-64↔w-16 column (which MASKED its content, incl. New Chat + the thread list, on
// collapse — the SEED-045 Anchor-1 bug) is gone: the persisted collapse flag, the
// collapse-toggle state, and the width masking are all removed (D-07). The whole thread
// region moved to the new dedicated `ChatHistoryColumn` (D-09), so this rail is
// stream-free (no StreamsProvider dependency) and its growth can NEVER hide New Chat on
// any view — SC#1 by construction.

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
}: Props) {
  const isControlRoom = activeView === "control-room"

  return (
    <div className="hidden md:flex flex-col items-center h-full w-[58px] shrink-0 bg-sidebar border-r border-border/20 py-3">
      {/* Logo — always visible (no opacity gate now). */}
      <div className="flex items-center justify-center w-8 h-8 rounded-lg gradient-primary shadow-sm shadow-primary/20 shrink-0">
        <Sparkles className="w-4 h-4 text-white" />
      </div>

      {/* New Chat (+) + the primary nav icons — each a tooltip-wrapped icon button. */}
      <div className="flex flex-col items-center gap-1 mt-4 flex-1">
        {/* Phase 156 (D-02 / SC#1): New Chat lives permanently on the rail — no state
            can hide it. From a non-chat view it also switches to chat. */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={() => {
                onNewThread()
                onNavigate("chat")
              }}
              aria-label="New chat"
              className="flex items-center justify-center w-10 h-10 rounded-lg text-primary bg-primary/10 hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <Plus className="w-5 h-5 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="ml-2">New chat</TooltipContent>
        </Tooltip>

        {navItems.map(({ view, icon: Icon, label }) => {
          const isActive = activeView === view
          return (
            <Tooltip key={view} delayDuration={0}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onNavigate(view)}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                    isActive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40",
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="ml-2">{label}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      {/* Footer: theme toggle, probe-gated operator shield, sign out. */}
      <div className="flex flex-col items-center gap-1 mt-auto">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={onToggleTheme}
              aria-label={theme === "dark" ? "Light Mode" : "Dark Mode"}
              className="flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {theme === "dark" ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="ml-2">{theme === "dark" ? "Light Mode" : "Dark Mode"}</TooltipContent>
        </Tooltip>

        {/* Phase 146 (ADMIN-01 / D-07): the probe-gated operator shield. Amber lucide
            Shield (distinct from Governance's ShieldCheck), active-highlights when in
            the Control Room. Rendered ONLY when isOperator, and OUTSIDE navItems (the
            D-07 non-discoverable contract — nothing rendered for non-operators). */}
        {isOperator && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onNavigate("control-room")}
                aria-label="Control Room"
                aria-current={isControlRoom ? "page" : undefined}
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  isControlRoom
                    ? "bg-amber-500/15 text-amber-400"
                    : "text-amber-400/80 hover:text-amber-400 hover:bg-amber-500/10",
                )}
              >
                <Shield className="w-5 h-5 shrink-0" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="ml-2">Control Room</TooltipContent>
          </Tooltip>
        )}

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              onClick={onSignOut}
              aria-label="Sign out"
              className="flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <LogOut className="w-5 h-5 shrink-0" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="ml-2">Sign out</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
