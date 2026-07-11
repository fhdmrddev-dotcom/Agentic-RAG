import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import "./index.css"
import { useAuth } from "./hooks/useAuth"
import { AuthPage } from "./pages/AuthPage"
import { ChatLayout } from "./components/layout/ChatLayout"
import type { StudioTab } from "./pages/SkillStudioPage"
import { TooltipProvider } from "@/components/ui/tooltip"
import { StreamsProvider } from "@/providers/StreamsProvider"
import { getMaintenanceStatus } from "@/lib/api"

// Phase 147 (D-06 / T-147-15) — the persistent, app-wide, end-user maintenance
// banner. It lives at the App/ChatLayout seam OUTSIDE the operator /admin surface
// (end users are 404 on every /admin route), so it reads the PUBLIC /health
// `maintenance` boolean via getMaintenanceStatus — never an /admin route. When
// maintenance is ON, all users see an honest read-only banner and can still
// browse/read; when OFF (or on any read failure), it renders NOTHING — the app
// DOM stays byte-identical to today. Presentational + resilient: a failed read
// assumes not-in-maintenance so a health blip never falsely announces maintenance
// or blocks the app. It is a fixed top strip so it disturbs no existing layout.
function MaintenanceBanner() {
  const [maintenanceOn, setMaintenanceOn] = useState(false)

  useEffect(() => {
    let alive = true
    const read = () => {
      // getMaintenanceStatus already resolves false on any failure (unauthed,
      // best-effort). Guard the setState against unmount either way.
      getMaintenanceStatus()
        .then((on) => {
          if (alive) setMaintenanceOn(on)
        })
        .catch(() => {
          if (alive) setMaintenanceOn(false)
        })
    }
    read()
    // Poll on a modest cadence matching the flag TTL window — do NOT hammer it.
    const id = window.setInterval(read, 30_000)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [])

  if (!maintenanceOn) return null

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 border-b border-amber-500/40 bg-amber-500/95 px-4 py-2 text-center text-sm font-medium text-amber-950 shadow-sm"
    >
      <AlertTriangle className="h-4 w-4 flex-none" aria-hidden="true" />
      <span>
        Maintenance mode — the platform is read-only. You can read everything; nothing new runs
        right now.
      </span>
    </div>
  )
}
// Phase 146 (ADMIN-01 / D-07): the operator probe is hosted ONCE at App level
// (single mount probe — Pitfall 4). It drives RENDERING ONLY: isOperator threads
// to the nav (the probe-gated shield) and identity threads to the Control Room.
// The backend 404 gate stays the sole authority; a forged flag reveals nothing.
import { useOperatorProbe } from "@/hooks/useOperatorProbe"
// Phase 148 (VIS-01 / D-04): the per-session effective-features probe (sibling of
// useOperatorProbe). Its map filters the nav (governed items vanish per the sketch
// 069-A) and its refetch re-syncs after the graceful 403 bounce. Render-only —
// 148-05's require_visible API is the security wall.
import { useEffectiveFeatures } from "@/hooks/useEffectiveFeatures"
import { visibleNavItems } from "@/lib/nav-items"

export type ActiveView = "chat" | "documents" | "skills" | "settings" | "library-health" | "workflows" | "classification-rules" | "governance" | "skill-studio" | "control-room"

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

  // Phase 146 (ADMIN-01 / D-07): one probe per authenticated session, keyed to
  // the signed-in user id (WR-01 — NOT App mount). isOperator gates the shield
  // (render-only); identity feeds the Control Room band. Keying to user?.id
  // re-probes after a fresh SPA sign-in and clears operator state on sign-out /
  // user switch. A non-operator's probe yields null → isOperator false → the nav
  // stays byte-identical to today.
  const { isOperator, identity: operatorIdentity } = useOperatorProbe(user?.id ?? null)

  // Phase 148 (VIS-01 / D-04): the per-session effective-features map, keyed to the
  // same user id (WR-01). It filters the nav so a governed feature the caller cannot
  // use simply does NOT render (the sketch 069-A vanish). Fails CLOSED to {} on error
  // / pre-resolve — a blip never flashes an operators-only feature to an end user
  // (T-148-FAILCLOSED). An operator's map is all-true → every nav item shows.
  const { features: effectiveFeatures } = useEffectiveFeatures(user?.id ?? null)
  const navItems = visibleNavItems(effectiveFeatures)

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
        {/* Phase 147 (D-06): app-wide end-user maintenance banner — sits above
            ChatLayout, outside the /admin surface, reading the public /health flag. */}
        <MaintenanceBanner />
        <ChatLayout
          onSignOut={signOut}
          activeView={activeView}
          onNavigate={setActiveView}
          navItems={navItems}
          isOperator={isOperator}
          operatorIdentity={operatorIdentity}
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
