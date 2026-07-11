import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  MessageSquare,
  LogOut, Plus, Sparkles, Pencil, Trash2, MoreHorizontal,
  Moon, Sun, PanelLeftClose, PanelLeftOpen, Folder as FolderIcon,
  AlertCircle, Square, Shield,
} from "lucide-react"
import type { ActiveView } from "@/App"
import type { Folder, Thread } from "@/types"
// Phase 103 (REQ-7) — the single shared nav source (kills the triplication).
// Phase 148 (VIS-01 / D-04): the rail now renders the effective-features-FILTERED
// `navItems` prop threaded from App (governed items already vanished per sketch
// 069-A) — NOT the raw NAV_ITEMS const — so a non-operator's rail hides the same
// governed features the mobile drawer does. Render-only; the API is the wall.
import type { NavItem } from "@/lib/nav-items"
// SEED-064: cross-thread run visibility + Stop.
import { useStreamingThreadIds, useStreamActions } from "@/providers/StreamsProvider"
import { ActiveRunsTray } from "@/components/chat/ActiveRunsTray"

interface Props {
  activeView: ActiveView
  onNavigate: (view: ActiveView) => void
  // Phase 148 (VIS-01 / D-04): the effective-features-FILTERED nav list from App —
  // governed items the caller can't use are already dropped (the vanish, never a
  // locked/badged item). The operator shield stays OUTSIDE this list (isOperator).
  navItems: readonly NavItem[]
  // Phase 146 (ADMIN-01 / D-07): the App-level probe result, render-only. When true,
  // the amber operator shield renders at the rail bottom; when false/loading it
  // renders NOTHING (no placeholder, no reserved space) — the rail is byte-identical
  // to today for every non-operator. The shield lives OUTSIDE the shared NAV_ITEMS
  // array (a regression test locks that), so the array never leaks the surface.
  isOperator: boolean
  onSignOut: () => void
  threads: Thread[]
  selectedThread: Thread | null
  onSelectThread: (thread: Thread) => void
  onNewThread: (folderId?: string | null) => void
  loadThreads: () => Promise<void>
  onDeleteThread: (id: string) => Promise<void>
  onRenameThread: (id: string, title: string) => Promise<void>
  folders: Folder[]
  theme: "light" | "dark"
  onToggleTheme: () => void
}

export function NavPanel({
  activeView,
  onNavigate,
  navItems,
  isOperator,
  onSignOut,
  threads,
  selectedThread,
  onSelectThread,
  onNewThread,
  loadThreads,
  onDeleteThread,
  onRenameThread,
  folders,
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

  // SEED-064: which threads have a live run (reactive on start/stop, not tokens)
  // + the cross-thread stop action.
  const streamingThreadIds = useStreamingThreadIds()
  const streamActions = useStreamActions()

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)
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
          // SEED-064: live run on this thread?
          const isRunning = streamingThreadIds.has(thread.id)

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

                  {/* SEED-064: resting running dot — ambient "this chat is working"
                      signal. A short gradient scrim keeps it clear of a long title.
                      Hidden while hovered (the Stop button takes its place). */}
                  {isRunning && !showActions && (
                    <div
                      className="absolute inset-y-0 right-0 flex items-center pl-6 pr-3 bg-gradient-to-l from-sidebar via-sidebar to-transparent rounded-r-lg pointer-events-none"
                      aria-label="Run in progress"
                    >
                      <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    </div>
                  )}

                  {/* Actions on hover: Stop (if running) + the rename/delete menu.
                      The gradient scrim fades a long title out behind the buttons so
                      they never visually collide with the text (SEED-064 polish). */}
                  {showActions && (
                    <div className="absolute inset-y-0 right-0 flex items-center gap-1 pl-10 pr-1.5 bg-gradient-to-l from-sidebar via-sidebar to-transparent rounded-r-lg">
                      {isRunning && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            void streamActions.stopThread(thread.id)
                          }}
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-destructive/40 text-destructive bg-destructive/15 hover:bg-destructive/25 transition-colors"
                          aria-label="Stop run"
                        >
                          <Square className="h-2.5 w-2.5 fill-current" />
                        </button>
                      )}
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent hover:bg-muted cursor-pointer transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenId(isMenuOpen ? null : thread.id)
                        }}
                      >
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
                    onClick={() => { setMenuOpenId(null); setDeleteConfirmId(thread.id) }}
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
        
        {/* Toggle — absolute on the outer container so it tracks the right edge when expanded
            and sits centered in the 64px column when collapsed */}
        <button
          onClick={handleToggle}
          className={cn(
            "absolute top-4 z-20 flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            isCollapsed ? "left-4" : "right-3"
          )}
          aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {isCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
        </button>

        {/* Header Row: Logo — fades out when collapsed so the toggle is the only thing visible */}
        <div className="flex items-center h-16 px-4 mb-2 shrink-0">
          <div className={cn(
            "flex items-center gap-2 transition-opacity duration-200",
            isCollapsed ? "opacity-0" : "opacity-100 delay-100"
          )}>
            <div className="flex items-center justify-center w-8 h-8 rounded-lg gradient-primary shadow-sm shadow-primary/20 shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-headline font-semibold text-[15px] tracking-tight text-sidebar-foreground whitespace-nowrap">
              Agentic RAG
            </span>
          </div>
        </div>

        {/* Primary Nav Items */}
        {/* padding px-3 (12px), button px-2.5 (10px). Icon is centered at 32px perfectly fitting the 64px collapsed parent. */}
        <div className="px-3 pb-2 space-y-1">
          {navItems.map(({ view, icon: Icon, label }) => {
            const isActive = activeView === view
            const buttonContent = (
              <button
                onClick={() => onNavigate(view)}
                className={cn(
                  "flex items-center gap-3 h-10 px-2.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 relative",
                  isCollapsed ? "w-10" : "w-full",
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
                  <div className="flex items-center gap-1">
                    {/* SEED-064: cross-thread active-runs counter + Stop tray
                        (renders null when nothing is running). */}
                    <ActiveRunsTray threads={threads} />
                    <button
                      onClick={() => {
                        onNewThread(selectedFolderId)
                        setShowFolderPicker(false)
                      }}
                      className="flex p-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors items-center justify-center"
                      title="New Chat"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    {folders.length > 0 && (
                      <button
                        onClick={() => setShowFolderPicker((prev) => !prev)}
                        className={cn(
                          "flex p-1 rounded-md transition-colors items-center justify-center",
                          showFolderPicker
                            ? "bg-accent text-primary"
                            : "hover:bg-accent/40 text-muted-foreground hover:text-sidebar-foreground"
                        )}
                        title="Choose folder"
                      >
                        <FolderIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {showFolderPicker && folders.length > 0 && (
                  <div className="mb-2 px-1">
                    <select
                      value={selectedFolderId ?? ""}
                      onChange={(e) => setSelectedFolderId(e.target.value || null)}
                      className="w-full text-xs rounded-lg px-2 py-1.5 bg-card text-foreground ghost-border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                    >
                      <option value="">All documents</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Scope this chat to a folder
                    </p>
                  </div>
                )}
                {renderThreadList()}
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null) }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                <AlertDialogTitle>Delete thread?</AlertDialogTitle>
              </div>
              <AlertDialogDescription>
                This will permanently delete this thread and all its messages. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (deleteConfirmId) {
                    await onDeleteThread(deleteConfirmId)
                    setDeleteConfirmId(null)
                  }
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Footer Area */}
        <div className="p-3 mt-auto space-y-1">
          {(() => {
            const themeButtonContent = (
              <button
                onClick={onToggleTheme}
                className={cn(
                  "flex items-center gap-3 h-10 px-2.5 text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40 transition-colors rounded-lg focus-visible:outline-none",
                  isCollapsed ? "w-10" : "w-full"
                )}
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
                className={cn(
                  "flex items-center gap-3 h-10 px-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors rounded-lg focus-visible:outline-none",
                  isCollapsed ? "w-10" : "w-full"
                )}
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

            // Phase 146 (ADMIN-01 / D-07): the probe-gated operator shield. Amber
            // lucide Shield (distinct from Governance's ShieldCheck), same footer-
            // button + collapsed-tooltip idiom. Active-highlights when in the Control
            // Room. Rendered ONLY when isOperator — see the probe-gated block below.
            const isControlRoom = activeView === "control-room"
            const shieldButtonContent = (
              <button
                onClick={() => onNavigate("control-room")}
                aria-current={isControlRoom ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 h-10 px-2.5 transition-colors rounded-lg focus-visible:outline-none",
                  isCollapsed ? "w-10" : "w-full",
                  isControlRoom
                    ? "bg-amber-500/15 text-amber-400 font-medium"
                    : "text-amber-400/80 hover:text-amber-400 hover:bg-amber-500/10"
                )}
              >
                <Shield className="w-5 h-5 shrink-0" />
                <span className={cn(
                  "text-sm whitespace-nowrap transition-opacity duration-200",
                  isCollapsed ? "opacity-0" : "opacity-100"
                )}>
                  Control Room
                </span>
              </button>
            )

            return (
              <>
                {/* Probe-gated operator shield — nothing rendered for non-operators
                    (byte-identical rail; the D-07 non-discoverable contract). */}
                {isOperator && (
                  isCollapsed ? (
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>{shieldButtonContent}</TooltipTrigger>
                      <TooltipContent side="right" className="ml-2">Control Room</TooltipContent>
                    </Tooltip>
                  ) : shieldButtonContent
                )}

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

