import { useCallback, useEffect, useRef, useState } from "react"
import { NavPanel } from "./NavPanel"
import { ChatArea } from "@/components/chat/ChatArea"
import { IngestionPage } from "@/pages/IngestionPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { SkillsPage } from "@/pages/SkillsPage"
import { KnowledgeHealthPage } from "@/pages/KnowledgeHealthPage"
import { useThreads } from "@/hooks/useThreads"
import { useFolders } from "@/hooks/useFolders"
import { useTheme } from "@/hooks/useTheme"
import type { ActiveView } from "@/App"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MessageSquare, FileText, Activity, Zap, Settings, Plus } from "lucide-react"

const NAV_ITEMS_MOBILE = [
  { view: "chat" as ActiveView,           icon: MessageSquare, label: "Chat" },
  { view: "documents" as ActiveView,      icon: FileText,      label: "Documents" },
  { view: "library-health" as ActiveView, icon: Activity,      label: "Library Health" },
  { view: "skills" as ActiveView,         icon: Zap,           label: "Skills" },
  { view: "settings" as ActiveView,       icon: Settings,      label: "Settings" },
] as const

interface Props {
  onSignOut: () => void
  activeView: ActiveView
  onNavigate: (view: ActiveView) => void
  prefillMessage: string | null
  onSetPrefillMessage: (msg: string | null) => void
}

export function ChatLayout({ onSignOut, activeView, onNavigate, prefillMessage, onSetPrefillMessage }: Props) {
  const {
    threads,
    selectedThread,
    loading: _loading,
    loadThreads,
    selectThread,
    newThread,
    deleteThread,
    renameThread,
    updateThreadTitle,
  } = useThreads()

  const { folders } = useFolders()
  const { theme, toggleTheme } = useTheme()

  const selectedThreadRef = useRef(selectedThread)
  useEffect(() => {
    selectedThreadRef.current = selectedThread
  }, [selectedThread])

  const handleTitleUpdate = useCallback(
    (title: string) => {
      const thread = selectedThreadRef.current
      if (thread) updateThreadTitle(thread.id, title)
    },
    [updateThreadTitle],
  )

  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleTryInChat = useCallback((skillName: string) => {
    onSetPrefillMessage(`Use the ${skillName} skill`)
    onNavigate("chat")
  }, [onSetPrefillMessage, onNavigate])

  return (
    <div className="flex h-screen bg-background">
      <NavPanel
        activeView={activeView}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
        threads={threads}
        selectedThread={selectedThread}
        onSelectThread={selectThread}
        onNewThread={newThread}
        loadThreads={loadThreads}
        onDeleteThread={deleteThread}
        onRenameThread={renameThread}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          aria-label="Close navigation"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar/95 backdrop-blur-md flex flex-col md:hidden">
          {/* Thread list (scrollable, top) */}
          <div className="flex-1 overflow-y-auto px-2 pt-4">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
              Chat
            </p>
            <div className="px-1 mb-2">
              <Button
                onClick={() => { newThread() }}
                className="w-full justify-center gap-2 gradient-primary text-white shadow-md shadow-primary/20 hover:opacity-90 transition-all border-none font-semibold"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
            </div>
            <div className="space-y-0.5 mt-2">
              {threads.length === 0 && (
                <p className="text-[10px] text-muted-foreground/50 text-center py-4 italic">No recent chats</p>
              )}
              {threads.map((thread) => {
                const isSelected = selectedThread?.id === thread.id
                return (
                  <div
                    key={thread.id}
                    className={cn(
                      "relative rounded-lg cursor-pointer transition-all duration-150 py-1.5",
                      isSelected
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-accent/40 hover:text-sidebar-foreground",
                    )}
                    onClick={() => selectThread(thread)}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-gradient-to-b from-indigo-500 to-cyan-500" />
                    )}
                    <div className="px-3 flex items-center gap-2 overflow-hidden whitespace-nowrap">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" />
                      <span className="text-sm truncate" title={thread.title}>{thread.title}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          {/* Nav icon row (bottom, fixed) */}
          <div className="border-t border-border/20 px-2 py-3 flex items-center justify-around">
            {NAV_ITEMS_MOBILE.map(({ view, icon: Icon, label }) => {
              const isActive = activeView === view
              return (
                <button
                  key={view}
                  aria-label={label}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => { onNavigate(view); setDrawerOpen(false) }}
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                    !isActive && "text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40",
                  )}
                >
                  {isActive ? (
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl gradient-primary shadow-sm shadow-primary/20">
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <main className="flex-1 overflow-hidden">
        {activeView === "documents" ? (
          <IngestionPage />
        ) : activeView === "skills" ? (
          <SkillsPage onTryInChat={handleTryInChat} />
        ) : activeView === "settings" ? (
          <SettingsPage />
        ) : activeView === "library-health" ? (
          <KnowledgeHealthPage />
        ) : (
          <ChatArea thread={selectedThread} onCreateThread={newThread} onTitleUpdate={handleTitleUpdate} folders={folders} prefillMessage={prefillMessage} onClearPrefill={() => onSetPrefillMessage(null)} onOpenDrawer={() => setDrawerOpen(true)} />
        )}
      </main>
    </div>
  )
}
