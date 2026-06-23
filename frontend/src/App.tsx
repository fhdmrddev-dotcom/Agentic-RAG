import { useState } from "react"
import "./index.css"
import { useAuth } from "./hooks/useAuth"
import { AuthPage } from "./pages/AuthPage"
import { ChatLayout } from "./components/layout/ChatLayout"
import { TooltipProvider } from "@/components/ui/tooltip"
import { StreamsProvider } from "@/providers/StreamsProvider"

export type ActiveView = "chat" | "documents" | "skills" | "settings" | "library-health" | "workflows" | "classification-rules" | "governance" | "skill-tuner"

function App() {
  const { user, loading, signIn, signUp, signOut } = useAuth()
  const [activeView, setActiveView] = useState<ActiveView>("chat")
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null)
  // Phase 123-05 (TRIG-01 / sketch 041-A): the Trigger Tuner is a focused
  // full-surface entered WITH a skillId (NOT a cold top-level nav). App holds
  // the selected-skill state (mirroring the existing per-view selection state
  // pattern) + the onTuneSkill navigator; both thread to ChatLayout so the
  // skill-tuner mount branch + the SkillsPage "Tune triggers" entry action are
  // owned in-phase (the Phase-118 built-but-unreachable lesson).
  const [tunerSkillId, setTunerSkillId] = useState<string | null>(null)
  const handleTuneSkill = (skillId: string) => {
    setTunerSkillId(skillId)
    setActiveView("skill-tuner")
  }

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
          tunerSkillId={tunerSkillId}
          onTuneSkill={handleTuneSkill}
        />
      </TooltipProvider>
    </StreamsProvider>
  )
}

export default App
