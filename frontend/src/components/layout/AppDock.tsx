import { cn } from "@/lib/utils"
import { MessageSquare, FileText, Activity, Zap, Settings, LogOut } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ActiveView } from "@/App"

interface Props {
  activeView: ActiveView
  onNavigate: (view: ActiveView) => void
  onSignOut: () => void
}

const NAV_ITEMS = [
  { view: "chat" as ActiveView,           icon: MessageSquare, label: "Chat" },
  { view: "documents" as ActiveView,      icon: FileText,      label: "Documents" },
  { view: "library-health" as ActiveView, icon: Activity,      label: "Library Health" },
  { view: "skills" as ActiveView,         icon: Zap,           label: "Skills" },
  { view: "settings" as ActiveView,       icon: Settings,      label: "Settings" },
] as const

export function AppDock({ activeView, onNavigate, onSignOut }: Props) {
  return (
    <div className="flex flex-col h-full w-14 bg-sidebar border-r border-border/20 shrink-0">
      {/* Top icon cluster */}
      <div className="flex flex-col items-center gap-1 pt-3 flex-1">
        {NAV_ITEMS.map(({ view, icon: Icon, label }) => {
          const isActive = activeView === view
          return (
            <Tooltip key={view}>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                    !isActive && "text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40",
                  )}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => onNavigate(view)}
                >
                  {isActive ? (
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl gradient-primary shadow-sm shadow-primary/20">
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      {/* Bottom: Sign Out */}
      <div className="flex flex-col items-center pb-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:text-destructive hover:bg-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label="Sign out"
              onClick={onSignOut}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Sign out</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
