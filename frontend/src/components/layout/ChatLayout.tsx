import { useCallback, useEffect, useRef } from "react"
import { Sidebar } from "./Sidebar"
import { AppDock } from "./AppDock"
import { ChatArea } from "@/components/chat/ChatArea"
import { IngestionPage } from "@/pages/IngestionPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { SkillsPage } from "@/pages/SkillsPage"
import { KnowledgeHealthPage } from "@/pages/KnowledgeHealthPage"
import { useThreads } from "@/hooks/useThreads"
import { useFolders } from "@/hooks/useFolders"
import { useTheme } from "@/hooks/useTheme"
import type { ActiveView } from "@/App"

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

  const handleTryInChat = useCallback((skillName: string) => {
    onSetPrefillMessage(`Use the ${skillName} skill`)
    onNavigate("chat")
  }, [onSetPrefillMessage, onNavigate])

  return (
    <div className="flex h-screen bg-background">
      <AppDock activeView={activeView} onNavigate={onNavigate} onSignOut={onSignOut} />
      <Sidebar
        threads={threads}
        selectedThread={selectedThread}
        onSelectThread={selectThread}
        onNewThread={newThread}
        loadThreads={loadThreads}
        onDeleteThread={deleteThread}
        onRenameThread={renameThread}
        folders={folders}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
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
          <ChatArea thread={selectedThread} onCreateThread={newThread} onTitleUpdate={handleTitleUpdate} folders={folders} prefillMessage={prefillMessage} onClearPrefill={() => onSetPrefillMessage(null)} />
        )}
      </main>
    </div>
  )
}
