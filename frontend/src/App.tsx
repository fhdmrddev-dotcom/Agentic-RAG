import { useState } from "react"
import "./index.css"
import { useAuth } from "./hooks/useAuth"
import { AuthPage } from "./pages/AuthPage"
import { ChatLayout } from "./components/layout/ChatLayout"
import type { StudioTab } from "./pages/SkillStudioPage"
import { TooltipProvider } from "@/components/ui/tooltip"
import { StreamsProvider } from "@/providers/StreamsProvider"

export type ActiveView = "chat" | "documents" | "skills" | "settings" | "library-health" | "workflows" | "classification-rules" | "governance" | "skill-studio"

function App() {
  const { user, loading, signIn, signUp, signOut } = useAuth()
  const [activeView, setActiveView] = useState<ActiveView>("chat")
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null)
  // Phase 137-06 (PANEL-01 / D-01 / sketch 057-A): the unified Skill Studio is a
  // focused full-surface entered WITH a skillId + a tab (mirroring the shipped Tuner
  // ActiveView precedent — no router). App holds the selected-skill + active-tab state
  // and the navigators; all thread to ChatLayout so the reachability triad (ActiveView
  // union + the ChatLayout mount branch + the SkillsPage entry action) is owned
  // in-phase (the Phase-118 built-but-unreachable lesson). The single "Open studio"
  // button lives in the slim detail panel (Plan 07); this plan defines + threads the
  // navigators. The legacy Trigger Tuner is ABSORBED as the Studio's Triggering tab:
  // the "Tune triggers" / lint "Tune this →" handoff (handleTuneSkill) REDIRECTS to
  // Studio · Triggering (D-01 no orphan Tuner surface / D-06 lint re-point).
  const [studioSkillId, setStudioSkillId] = useState<string | null>(null)
  const [studioTab, setStudioTab] = useState<StudioTab>("evals")
  const handleOpenStudio = (skillId: string, tab: StudioTab = "evals") => {
    setStudioSkillId(skillId)
    setStudioTab(tab)
    setActiveView("skill-studio")
  }
  const handleReviewEvals = (skillId: string) => handleOpenStudio(skillId, "evals")
  const handleStudioTabChange = (tab: StudioTab) => setStudioTab(tab)
  // Legacy redirect (D-01 / D-06): the shipped "Tune triggers" + lint "Tune this →"
  // callers land in Studio · Triggering — no standalone Tuner surface remains.
  const handleTuneSkill = (skillId: string) => handleOpenStudio(skillId, "triggering")

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
          studioSkillId={studioSkillId}
          studioTab={studioTab}
          onOpenStudio={handleOpenStudio}
          onReviewEvals={handleReviewEvals}
          onStudioTabChange={handleStudioTabChange}
          onTuneSkill={handleTuneSkill}
        />
      </TooltipProvider>
    </StreamsProvider>
  )
}

export default App
