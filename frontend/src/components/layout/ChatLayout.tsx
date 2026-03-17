import { Sidebar } from "./Sidebar"
import { ChatArea } from "@/components/chat/ChatArea"
import { IngestionPage } from "@/pages/IngestionPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { useThreads } from "@/hooks/useThreads"
import type { ActiveView } from "@/App"

interface Props {
  onSignOut: () => void
  activeView: ActiveView
  onNavigate: (view: ActiveView) => void
}

export function ChatLayout({ onSignOut, activeView, onNavigate }: Props) {
  const { threads, selectedThread, loading: _loading, loadThreads, selectThread, newThread } = useThreads()

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        threads={threads}
        selectedThread={selectedThread}
        onSelectThread={selectThread}
        onNewThread={newThread}
        onSignOut={onSignOut}
        loadThreads={loadThreads}
        activeView={activeView}
        onNavigate={onNavigate}
      />
      <main className="flex-1 overflow-hidden">
        {activeView === "documents" ? (
          <IngestionPage />
        ) : activeView === "settings" ? (
          <SettingsPage />
        ) : (
          <ChatArea thread={selectedThread} onCreateThread={newThread} />
        )}
      </main>
    </div>
  )
}
