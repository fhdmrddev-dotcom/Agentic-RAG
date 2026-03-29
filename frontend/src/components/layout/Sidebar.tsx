import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Plus, LogOut, MessageSquare, FileText, Settings, Sparkles, Pencil, Trash2, MoreHorizontal, Folder as FolderIcon, Moon, Sun } from "lucide-react"
import type { Folder, Thread } from "@/types"
import type { ActiveView } from "@/App"

interface Props {
  threads: Thread[]
  selectedThread: Thread | null
  onSelectThread: (thread: Thread) => void
  onNewThread: () => void
  onSignOut: () => void
  loadThreads: () => Promise<void>
  activeView: ActiveView
  onNavigate: (view: ActiveView) => void
  onDeleteThread: (id: string) => Promise<void>
  onRenameThread: (id: string, title: string) => Promise<void>
  folders: Folder[]
  theme: "light" | "dark"
  onToggleTheme: () => void
}

export function Sidebar({
  threads,
  selectedThread,
  onSelectThread,
  onNewThread,
  onSignOut,
  loadThreads,
  activeView,
  onNavigate,
  onDeleteThread,
  onRenameThread,
  folders: _folders,
  theme,
  onToggleTheme,
}: Props) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadThreads().catch(console.error)
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

  return (
    <div className="flex flex-col h-full w-64 bg-sidebar overflow-hidden border-r border-border/20">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl gradient-primary shadow-sm shadow-primary/20">
          <Sparkles className="w-4.5 h-4.5 text-white" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-headline font-bold text-sm tracking-tight text-sidebar-foreground">Agentic RAG</span>
          <span className="text-[10px] text-muted-foreground mt-0.5">Powered by AI</span>
        </div>
      </div>

      {/* New Chat */}
      <div className="px-3 py-2">
        <Button
          onClick={() => { onNavigate("chat"); onNewThread() }}
          className="w-full justify-start gap-2 ghost-border bg-transparent hover:bg-accent/50 text-sidebar-foreground transition-all"
          variant="outline"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Thread list */}
      <div className="flex-1 px-2 overflow-y-auto overflow-x-hidden mt-1">
        {threads.length > 0 && (
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
            Recent
          </p>
        )}
        <div className="space-y-0.5 pb-2">
          {threads.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8 opacity-60">No chats yet</p>
          )}
          {threads.map((thread) => {
            const isSelected = activeView === "chat" && selectedThread?.id === thread.id
            const isEditing = editingId === thread.id
            const isMenuOpen = menuOpenId === thread.id
            const isHovered = hoveredId === thread.id
            const showActions = isHovered || isMenuOpen

            return (
              <div
                key={thread.id}
                className="relative"
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
                    className="w-full px-3 py-1.5 text-sm bg-card border border-border/30 rounded-lg outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                  />
                ) : (
                  <div
                    className={cn(
                      "relative rounded-lg cursor-pointer transition-all duration-150",
                      isSelected
                        ? "bg-accent text-sidebar-foreground"
                        : "text-muted-foreground hover:bg-accent/40 hover:text-sidebar-foreground",
                    )}
                    onClick={() => { onNavigate("chat"); onSelectThread(thread) }}
                  >
                    {/* Active indicator */}
                    {isSelected && (
                      <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />
                    )}
                    {/* Title row */}
                    <div className="px-3 py-2 flex items-center gap-2 overflow-hidden whitespace-nowrap">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-60" />
                      <span className="text-sm truncate" title={thread.title}>
                        {thread.title}
                      </span>
                      {thread.folder_id && (
                        <FolderIcon className="h-3 w-3 shrink-0 text-primary/50" />
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
                        <span className="p-1 rounded-md bg-accent hover:bg-muted inline-flex transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
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
      </div>

      {/* Bottom nav */}
      <div className="border-t border-border/20 px-2 py-3 space-y-0.5">
        <Button
          onClick={() => onNavigate("documents")}
          variant={activeView === "documents" ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "w-full justify-start gap-2 transition-all",
            activeView === "documents"
              ? "text-primary font-medium"
              : "text-muted-foreground hover:text-sidebar-foreground",
          )}
        >
          <FileText className="h-4 w-4" />
          Documents
        </Button>
        <Button
          onClick={() => onNavigate("settings")}
          variant={activeView === "settings" ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "w-full justify-start gap-2 transition-all",
            activeView === "settings"
              ? "text-primary font-medium"
              : "text-muted-foreground hover:text-sidebar-foreground",
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Button>

        {/* Theme toggle + Sign out row */}
        <div className="flex items-center gap-1 pt-1">
          <Button
            onClick={onToggleTheme}
            variant="ghost"
            size="sm"
            className="flex-1 justify-start gap-2 text-muted-foreground hover:text-sidebar-foreground transition-all"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Light Mode" : "Dark Mode"}
          </Button>
        </div>
        <Button
          onClick={onSignOut}
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive transition-all"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
