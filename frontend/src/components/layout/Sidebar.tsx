import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { Plus, LogOut, MessageSquare, FileText, Settings } from "lucide-react"
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
    <div className="flex flex-col h-full w-64 border-r bg-muted/30">
      <div className="p-3">
        <Button
          onClick={() => { onNavigate("chat"); onNewThread() }}
          className="w-full"
          variant="outline"
          size="sm"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>
      <Separator />
      <ScrollArea className="flex-1 px-2 py-2">
        <div className="space-y-1">
          {threads.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No chats yet</p>
          )}
          {threads.map((thread) => (
            <button
              key={thread.id}
              onClick={() => { onNavigate("chat"); onSelectThread(thread) }}
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 hover:bg-accent transition-colors",
                activeView === "chat" && selectedThread?.id === thread.id && "bg-accent",
              )}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{thread.title}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
      <Separator />
      <div className="p-3 space-y-1">
        <Button
          onClick={() => onNavigate("documents")}
          variant={activeView === "documents" ? "secondary" : "ghost"}
          size="sm"
          className="w-full justify-start text-muted-foreground"
        >
          <FileText className="h-4 w-4 mr-2" />
          Documents
        </Button>
        <Button
          onClick={() => onNavigate("settings")}
          variant={activeView === "settings" ? "secondary" : "ghost"}
          size="sm"
          className="w-full justify-start text-muted-foreground"
        >
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
        <Button
          onClick={onSignOut}
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
