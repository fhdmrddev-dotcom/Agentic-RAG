import { useState } from "react"
import "./index.css"
import { useAuth } from "./hooks/useAuth"
import { AuthPage } from "./pages/AuthPage"
import { ChatLayout } from "./components/layout/ChatLayout"
import { TooltipProvider } from "@/components/ui/tooltip"

export type ActiveView = "chat" | "documents" | "settings"

function App() {
  const { user, loading, signIn, signUp, signOut } = useAuth()
  const [activeView, setActiveView] = useState<ActiveView>("chat")

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
    <TooltipProvider>
      <ChatLayout
        onSignOut={signOut}
        activeView={activeView}
        onNavigate={setActiveView}
      />
    </TooltipProvider>
  )
}

export default App
