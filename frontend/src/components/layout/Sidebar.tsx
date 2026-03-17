import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Plus, LogOut, MessageSquare, FileText, Settings, Sparkles } from "lucide-react"
import type { Thread } from "@/types"
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
}: Props) {
  useEffect(() => {
    loadThreads().catch(console.error)
  }, [loadThreads])

  return (
    <div className="flex flex-col h-full w-64 border-r bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
          <Sparkles className="w-4 h-4 text-primary-foreground" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-semibold text-sm tracking-tight">Agentic RAG</span>
          <span className="text-[10px] text-muted-foreground">Powered by AI</span>
        </div>
      </div>

      {/* New Chat */}
      <div className="px-3 py-3">
        <Button
          onClick={() => { onNavigate("chat"); onNewThread() }}
          className="w-full justify-start gap-2"
          variant="outline"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Thread list */}
      <ScrollArea className="flex-1 px-2">
        {threads.length > 0 && (
          <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
            Recent
          </p>
        )}
        <div className="space-y-0.5 pb-2">
          {threads.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6">No chats yet</p>
          )}
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => { onNavigate("chat"); onSelectThread(thread) }}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 hover:bg-accent transition-colors group",
                activeView === "chat" && selectedThread?.id === thread.id
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{thread.title}</span>
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Bottom nav */}
      <div className="border-t px-2 py-3 space-y-0.5">
        <Button
          onClick={() => onNavigate("documents")}
          variant={activeView === "documents" ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "w-full justify-start gap-2",
            activeView !== "documents" && "text-muted-foreground hover:text-foreground",
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
            "w-full justify-start gap-2",
            activeView !== "settings" && "text-muted-foreground hover:text-foreground",
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Button>
        <Button
          onClick={onSignOut}
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
