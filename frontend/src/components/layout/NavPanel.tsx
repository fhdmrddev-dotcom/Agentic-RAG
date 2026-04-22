import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  MessageSquare, FileText, Activity, Zap, Settings,
  LogOut, Plus, Sparkles, Pencil, Trash2, MoreHorizontal,
  Moon, Sun, PanelLeftClose, PanelLeftOpen, Folder as FolderIcon,
} from "lucide-react"
import type { ActiveView } from "@/App"
import type { Thread } from "@/types"

interface Props {
  // From AppDock
  activeView: ActiveView
  onNavigate: (view: ActiveView) => void
  onSignOut: () => void
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

  // Thread list — displayed ONLY when activeView === "chat"
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
        "hidden md:flex flex-col h-full bg-sidebar border-r border-border/20 shrink-0 transition-[width] duration-300 ease-in-out relative overflow-hidden",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* 
        Unified Inner Wrapper: Always 64 (256px) wide. 
        When the parent shrinks to w-16 (64px), it simply masks over the content gracefully. 
        No layout recalculation or DOM swapping occurs, eliminating layout jumps entirely.
      */}
      <div className="flex flex-col h-full w-64 min-w-[16rem]">
        
        {/* Toggle Button - Absolute positions cleanly animate over the full width */}
        <button
          onClick={handleToggle}
          className={cn(
            "absolute top-4 flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40 transition-all duration-300 z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            isCollapsed ? "left-[16px]" : "left-[212px]"
          )}
          aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>

        {/* Header Row: Logo */}
        <div className="flex items-center h-16 px-4 mb-2 shrink-0">
          <div className={cn(
            "flex items-center gap-2 transition-opacity duration-200", 
            isCollapsed ? "opacity-0" : "opacity-100 delay-100"
          )}>
            <div className="flex items-center justify-center w-8 h-8 rounded-lg gradient-primary shadow-sm shadow-primary/20 shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-headline font-semibold text-[15px] tracking-tight text-sidebar-foreground">
              Agentic RAG
            </span>
          </div>
        </div>

        {/* Primary Nav Items */}
        {/* padding px-3 (12px), button px-2.5 (10px). Icon is centered at 32px perfectly fitting the 64px collapsed parent. */}
        <div className="px-3 pb-2 space-y-1">
          {NAV_ITEMS.map(({ view, icon: Icon, label }) => {
            const isActive = activeView === view
            const buttonContent = (
              <button
                onClick={() => onNavigate(view)}
                className={cn(
                  "flex items-center gap-3 w-full h-10 px-2.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 relative",
                    isActive 
                    ? "bg-primary/15 text-primary font-medium" 
                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40"
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className={cn(
                  "text-sm whitespace-nowrap transition-opacity duration-200", 
                  isCollapsed ? "opacity-0" : "opacity-100"
                )}>
                  {label}
                </span>
              </button>
            )

            return isCollapsed ? (
              <Tooltip key={view} delayDuration={0}>
                <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
                <TooltipContent side="right" className="ml-2">{label}</TooltipContent>
              </Tooltip>
            ) : (
              <div key={view}>{buttonContent}</div>
            )
          })}
        </div>

        {/* Dynamic Content Area (Threads) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 scrollbar-thin">
          <div className={cn(
            "transition-opacity duration-200 w-[232px]", 
            isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100 delay-100"
          )}>
            {activeView === "chat" && (
              <div className="flex flex-col">
                <div className="flex items-center justify-between pb-2 px-1 border-b border-border/10 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                    Chats
                  </span>
                  <button
                    onClick={() => onNewThread()}
                    className="flex p-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors items-center justify-center"
                    title="New Chat"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {renderThreadList()}
              </div>
            )}
          </div>
        </div>

        {/* Footer Area */}
        <div className="p-3 mt-auto space-y-1">
          {(() => {
            const themeButtonContent = (
              <button
                onClick={onToggleTheme}
                className="flex items-center gap-3 w-full h-10 px-2.5 text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40 transition-colors rounded-lg focus-visible:outline-none"
              >
                {theme === "dark" ? <Sun className="w-5 h-5 shrink-0" /> : <Moon className="w-5 h-5 shrink-0" />}
                <span className={cn(
                  "text-sm whitespace-nowrap transition-opacity duration-200", 
                  isCollapsed ? "opacity-0" : "opacity-100"
                )}>
                  {theme === "dark" ? "Light Mode" : "Dark Mode"}
                </span>
              </button>
            )

            const signOutButtonContent = (
              <button
                onClick={onSignOut}
                className="flex items-center gap-3 w-full h-10 px-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors rounded-lg focus-visible:outline-none"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                <span className={cn(
                  "text-sm whitespace-nowrap transition-opacity duration-200", 
                  isCollapsed ? "opacity-0" : "opacity-100"
                )}>
                  Sign out
                </span>
              </button>
            )

            return (
              <>
                {isCollapsed ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>{themeButtonContent}</TooltipTrigger>
                    <TooltipContent side="right" className="ml-2">Toggle Theme</TooltipContent>
                  </Tooltip>
                ) : themeButtonContent}
                
                {isCollapsed ? (
                  <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>{signOutButtonContent}</TooltipTrigger>
                    <TooltipContent side="right" className="ml-2">Sign out</TooltipContent>
                  </Tooltip>
                ) : signOutButtonContent}
              </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

