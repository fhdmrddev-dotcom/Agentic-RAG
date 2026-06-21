import { useState } from "react"
import "./index.css"
import { useAuth } from "./hooks/useAuth"
import { AuthPage } from "./pages/AuthPage"
import { ChatLayout } from "./components/layout/ChatLayout"
import { TooltipProvider } from "@/components/ui/tooltip"
import { StreamsProvider } from "@/providers/StreamsProvider"

export type ActiveView = "chat" | "documents" | "skills" | "settings" | "library-health" | "workflows" | "classification-rules" | "governance"

function App() {
  const { user, loading, signIn, signUp, signOut } = useAuth()
  const [activeView, setActiveView] = useState<ActiveView>("chat")
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (!user) {
    return <AuthPage onSignIn={signIn} onSignUp={signUp} />
  }

  return (
    <StreamsProvider>
      <TooltipProvider>
        <ChatLayout
          onSignOut={signOut}
          activeView={activeView}
          onNavigate={setActiveView}
          prefillMessage={prefillMessage}
          onSetPrefillMessage={setPrefillMessage}
        />
      </TooltipProvider>
    </StreamsProvider>
  )
}

export default App
