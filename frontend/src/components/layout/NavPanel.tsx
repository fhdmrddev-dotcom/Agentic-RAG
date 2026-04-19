import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  MessageSquare, FileText, Activity, Zap, Settings,
  LogOut, Plus, Sparkles, Pencil, Trash2, MoreHorizontal,
  Moon, Sun, ChevronLeft, ChevronRight, Folder as FolderIcon,
} from "lucide-react"
import type { ActiveView } from "@/App"
import type { Thread } from "@/types"

interface Props {
  // From AppDock
  activeView: ActiveView
  onNavigate: (view: ActiveView) => void
  onSignOut: () => void
  // From Sidebar
  threads: Thread[]
  selectedThread: Thread | null
  onSelectThread: (thread: Thread) => void
  onNewThread: () => void
  loadThreads: () => Promise<void>
  onDeleteThread: (id: string) => Promise<void>
  onRenameThread: (id: string, title: string) => Promise<void>
  theme: "light" | "dark"
  onToggleTheme: () => void
}

const NAV_ITEMS = [
  { view: "chat" as ActiveView,           icon: MessageSquare, label: "Chat" },
  { view: "documents" as ActiveView,      icon: FileText,      label: "Documents" },
  { view: "library-health" as ActiveView, icon: Activity,      label: "Library Health" },
  { view: "skills" as ActiveView,         icon: Zap,           label: "Skills" },
  { view: "settings" as ActiveView,       icon: Settings,      label: "Settings" },
] as const

export function NavPanel({
  activeView,
  onNavigate,
  onSignOut,
  threads,
  selectedThread,
  onSelectThread,
  onNewThread,
  loadThreads,
  onDeleteThread,
  onRenameThread,
  theme,
  onToggleTheme,
}: Props) {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("nav_panel_collapsed") === "true"
  })

  function handleToggle() {
    setIsCollapsed((prev) => {
      const next = !prev
      localStorage.setItem("nav_panel_collapsed", String(next))
      return next
    })
  }

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadThreads().catch(() => {
      // Auth may not be ready yet on page refresh — retry once after 2s
      setTimeout(() => loadThreads().catch(console.error), 2000)
    })
  }, [loadThreads])

  useEffect(() => {
    if (editingId) editInputRef.current?.focus()
  }, [editingId])

  function startRename(thread: Thread) {
    setMenuOpenId(null)
    setEditingId(thread.id)
    setEditValue(thread.title)
  }

  async function commitRename(id: string) {
    const trimmed = editValue.trim()
    if (trimmed) await onRenameThread(id, trimmed)
    setEditingId(null)
  }

  // Icon rail — shared between collapsed and expanded left sub-column
  function renderIconRail(showTooltips: boolean) {
    return (
      <>
        <div className="flex flex-col items-center gap-1 flex-1 pt-1">
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
                {showTooltips && <TooltipContent side="right">{label}</TooltipContent>}
              </Tooltip>
            )
          })}
        </div>

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
            {showTooltips && <TooltipContent side="right">Sign out</TooltipContent>}
          </Tooltip>
        </div>
      </>
    )
  }

  // Thread list — shared in expanded right sub-column
  function renderThreadList() {
    return (
      <div className="space-y-0.5 mt-2">
        {threads.length === 0 && (
          <p className="text-[10px] text-muted-foreground/50 text-center py-4 italic">No recent chats</p>
        )}
        {threads.map((thread) => {
          const isSelected = selectedThread?.id === thread.id
          const isEditing = editingId === thread.id
          const isMenuOpen = menuOpenId === thread.id
          const isHovered = hoveredId === thread.id
          const showActions = isHovered || isMenuOpen

          return (
            <div
              key={thread.id}
              className="relative group"
              onMouseEnter={() => setHoveredId(thread.id)}
              onMouseLeave={() => { if (!isMenuOpen) setHoveredId(null) }}
            >
              {isEditing ? (
                <input
                  ref={editInputRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => commitRename(thread.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(thread.id)
                    if (e.key === "Escape") setEditingId(null)
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-card border border-border/30 rounded-lg outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                />
              ) : (
                <div
                  className={cn(
                    "relative rounded-lg cursor-pointer transition-all duration-150 py-1.5",
                    isSelected
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-sidebar-foreground",
                  )}
                  onClick={() => onSelectThread(thread)}
                >
                  {/* Active indicator */}
                  {isSelected && (
                    <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-gradient-to-b from-indigo-500 to-cyan-500" />
                  )}
                  {/* Title row */}
                  <div className="px-3 flex items-center gap-2 overflow-hidden whitespace-nowrap">
                    <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    <span className="text-sm truncate" title={thread.title}>
                      {thread.title}
                    </span>
                    {thread.folder_id && (
                      <FolderIcon className="h-3 w-3 shrink-0 text-primary/40" />
                    )}
                  </div>

                  {/* Dots button overlaid on right */}
                  {showActions && (
                    <div
                      className="absolute inset-y-0 right-0 flex items-center pr-1.5"
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuOpenId(isMenuOpen ? null : thread.id)
                      }}
                    >
                      <span className="p-0.5 rounded-md bg-accent hover:bg-muted inline-flex transition-colors">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Dropdown menu */}
              {isMenuOpen && (
                <div
                  className="absolute right-2 top-full mt-0.5 z-50 w-36 rounded-lg ghost-border bg-popover shadow-lg shadow-black/20 py-1"
                  onMouseLeave={() => setMenuOpenId(null)}
                >
                  <button
                    onClick={() => startRename(thread)}
                    className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-accent transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Rename
                  </button>
                  <button
                    onClick={async () => { setMenuOpenId(null); await onDeleteThread(thread.id) }}
                    className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-destructive/10 text-destructive transition-colors"
                    aria-label="Delete Thread"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "hidden md:flex flex-col h-full bg-sidebar border-r border-border/20 shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out",
        isCollapsed ? "w-14" : "w-64",
      )}
    >
      {isCollapsed ? (
        /* Collapsed: icon rail only */
        <div className="flex flex-col h-full w-14 items-center">
          {/* Logo icon */}
          <div className="flex items-center justify-center py-4">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl gradient-primary shadow-sm shadow-primary/20">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
          </div>

          {/* Toggle button */}
          <button
            onClick={handleToggle}
            className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label="Expand navigation"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Nav icons + sign out */}
          {renderIconRail(true)}
        </div>
      ) : (
        /* Expanded: icon sub-column + thread list sub-column */
        <div className="flex h-full">
          {/* Left: w-14 icon rail */}
          <div className="flex flex-col w-14 items-center border-r border-border/10 shrink-0 pt-3">
            {renderIconRail(false)}
          </div>

          {/* Right: flex-1 thread list */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Logo block */}
            <div className="flex items-center gap-2.5 px-4 py-4">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl gradient-primary shadow-sm shadow-primary/20">
                <Sparkles className="w-4.5 h-4.5 text-white" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="font-headline font-semibold text-sm tracking-tight text-sidebar-foreground">Agentic RAG</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">Powered by AI</span>
              </div>
            </div>

            {/* Toggle button */}
            <div className="px-2 pb-1">
              <button
                onClick={handleToggle}
                className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label="Collapse navigation"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Chat section */}
            <div className="flex-1 px-2 overflow-y-auto overflow-x-hidden pt-1">
              <div>
                <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                  Chat
                </p>
                <div className="px-1 mb-2">
                  <Button
                    onClick={() => onNewThread()}
                    className="w-full justify-center gap-2 gradient-primary text-white shadow-md shadow-primary/20 hover:opacity-90 transition-all border-none font-semibold"
                    size="sm"
                  >
                    <Plus className="h-4 w-4" />
                    New Chat
                  </Button>
                </div>

                {/* Thread list */}
                {renderThreadList()}
              </div>
            </div>

            {/* Footer — theme toggle */}
            <div className="border-t border-border/10 px-2 py-2">
              <Button
                onClick={onToggleTheme}
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-muted-foreground hover:text-sidebar-foreground transition-all py-2"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
