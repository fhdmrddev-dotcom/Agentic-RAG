import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Plus, MessageSquare, Sparkles, Pencil, Trash2, MoreHorizontal, Folder as FolderIcon, Moon, Sun } from "lucide-react"
import type { Folder, Thread } from "@/types"

interface Props {
  threads: Thread[]
  selectedThread: Thread | null
  onSelectThread: (thread: Thread) => void
  onNewThread: () => void
  loadThreads: () => Promise<void>
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
  loadThreads,
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

      {/* Chat Section — This part scrolls */}
      <div className="flex-1 px-2 overflow-y-auto overflow-x-hidden pt-2">
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
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent/40 hover:text-sidebar-foreground",
                      )}
                      onClick={() => onSelectThread(thread)}
                    >
                      {/* Active indicator */}
                      {isSelected && (
                        <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-primary" />
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
      </div>

      {/* Footer — theme toggle only */}
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
  )
}
