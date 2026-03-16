import { Sidebar } from "./Sidebar"
import { ChatArea } from "@/components/chat/ChatArea"
import { useThreads } from "@/hooks/useThreads"

interface Props {
  onSignOut: () => void
}

export function ChatLayout({ onSignOut }: Props) {
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
      />
      <main className="flex-1 overflow-hidden">
        <ChatArea thread={selectedThread} onCreateThread={newThread} />
      </main>
    </div>
  )
}
