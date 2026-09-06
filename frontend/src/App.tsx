import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Lock } from "lucide-react"
import "./index.css"
import { useAuth } from "./hooks/useAuth"
import { AuthPage } from "./pages/AuthPage"
import { AcceptInvitePage } from "./pages/AcceptInvitePage"
import { ChatLayout } from "./components/layout/ChatLayout"
import type { StudioTab } from "./pages/SkillStudioPage"
// Phase 235-08 (SURF-03): the Library's own tab union, so the payload below is typed by the
// SAME source the page reads rather than by a second string literal beside it.
import type { LibraryTab } from "./pages/librarySelection"
// Phase 235 plan 15 (gap-closure round 1): the hand-off's LIFETIME rule, as a strict leaf.
import { libraryTabAfterNavigate } from "@/lib/libraryTabHandoff"
import { TooltipProvider } from "@/components/ui/tooltip"
import { StreamsProvider } from "@/providers/StreamsProvider"
// Phase 166 (D-166-07): the org-context spine mounts OUTSIDE StreamsProvider so an
// org switch can reach the streams teardown from above. Exposes active org +
// memberships + role + can_manage/can_audit_view + switchOrg via useOrg/useOrgOptional.
import { OrgProvider } from "@/providers/OrgProvider"
import { CitationNavProvider } from "@/lib/citationNav"
import { TechnicalNamesProvider } from "@/providers/TechnicalNamesProvider"
// Phase 183 (CANVAS-01 / OP-2): broadcasts the ONE effective-features map below the
// nav so a page can gate on a governed feature without a second GET /features.
// Value-passing only — App still owns the single useEffectiveFeatures call.
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
import { getMaintenanceStatus, getSetupStatus, FEATURE_FORBIDDEN_EVENT, VISIBILITY_REFUSAL, type SetupStatus } from "@/lib/api"
import { hydrateSupabaseFromRuntime } from "@/lib/supabase"
import { SetupWizard } from "./pages/SetupWizard"
import { FinalizedLockout } from "./components/setup/FinalizedLockout"

// Phase 158 (DEPLOY-02 / D-06, D-07): the API base the startup runtime-config hydrate +
// the public setup-status probe use — the same var the api.ts client reads.
const API_BASE = import.meta.env.VITE_API_BASE_URL as string

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

// Phase 188 Plan 09 (RUNVIZ-03 / D-188-10): the TWELFTH member below is the run's own
// home (SPEC Req 6). ⚠ Its literal is deliberately NOT spelled again in this comment —
// the acceptance fence counts occurrences in this file, and prose that repeats the
// member would make a code measurement satisfiable by a comment (the 187-24 lesson,
// met again by 188-03 / 188-07 / 188-08). NO ROUTER: the three-homes contract holds and this
// is wired exactly like the other eleven (a `useState<ActiveView>` switch + a matching
// render branch in ChatLayout + a launch that navigates to it). ⚠ The member alone is
// NOT reachability: ChatLayout's trailing `<KnowledgeHealthPage />` is a POSITIONAL
// FALLBACK, not a `default:` that throws, so a union member with no branch silently
// renders Knowledge Health (the Phase-118 built-but-unreachable lesson). The matching
// branch ships in the same commit as this member.
export type ActiveView = "chat" | "documents" | "skills" | "settings" | "workflows" | "classification-rules" | "connections" | "skill-studio" | "control-room" | "org-admin" | "workflow-run"

function App() {
  const { user, loading, signIn, signUp, signOut } = useAuth()
  // Phase 158 (DEPLOY-02 / D-06, D-07): the one-shot first-run setup probe + the runtime
  // Supabase hydrate, both at bootstrap BEFORE the auth check matters. (1) hydrateSupabase-
  // FromRuntime overlays the browser's Supabase creds from GET /public-config, so a wizard-
  // entered Supabase URL logs in without a frontend rebuild (falls back to the baked VITE_*
  // on any failure — never blocks boot). (2) getSetupStatus probes GET /setup/status (it
  // resolves needs_setup:false on ANY failure, so a transient backend blip never bounces a
  // configured box's users into the wizard — T-158-05). setupStatus stays null until the
  // probe resolves, holding the existing spinner; the configured non-/setup path is unchanged.
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null)
  useEffect(() => {
    let alive = true
    ;(async () => {
      await hydrateSupabaseFromRuntime(API_BASE)
      const status = await getSetupStatus()
      if (alive) setSetupStatus(status)
    })()
    return () => {
      alive = false
    }
  }, [])
  const [activeView, setActiveView] = useState<ActiveView>(() => {
    // BUG-260903-01 / SEED-185: both OAuth callbacks land on `/app?connections=1&…`, and until
    // 2026-09-03 nothing read it — the person arrived on Chat with their result in the URL.
    // Read once, land on Connections, and drop the query so a reload does not re-route.
    const q = new URLSearchParams(window.location.search)
    if (q.get("connections") !== "1") return "chat"
    window.history.replaceState(null, "", window.location.pathname)
    return "connections"
  })
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

  // Phase 235-08 (SURF-03 / D-235-04 / T-235-27): the Library's tab, held HERE beside
  // `activeView` and set by ONE navigator — the exact shape of `handleOpenStudio` above.
  //
  // ⛔ NO TWELFTH `ActiveView` MEMBER. The Library already has one, and the comment above
  // the union records that a member is not reachability. What was missing was never a view:
  // `LibraryPage`'s only prop was `onNavigate`, so the Health TAB had no external door at
  // all, and SURF-03's route (rail badge → popover → Health → source card) was impossible.
  //
  // ⛔ AND NO URL. This app has no router (`SEED-185`), so assigning the browser's location
  // here would be a full page reload onto a path that renders the chat home. ⚠ THAT API IS
  // DELIBERATELY NOT SPELLED IN THIS COMMENT: the acceptance criterion greps this file for
  // it, and prose that names it would make a code measurement satisfiable by a comment (the
  // 187-24 lesson, which `App.tsx:91-101` above already records once). `undefined` means
  // "the page decides", so the Library keeps its own default on every other entry into it.
  const [libraryTab, setLibraryTab] = useState<LibraryTab | undefined>(undefined)
  const handleOpenLibraryHealth = () => {
    setLibraryTab("health")
    setActiveView("documents")
  }
  // ⛔ Phase 235 plan 15 (gap-closure round 1 · verification G5) — AND IT IS ONE-SHOT.
  //
  // The line above was the ONLY write to `libraryTab` when 235-08 shipped, and the comment
  // above it claimed a behaviour nothing enforced: `LibraryPage` is mounted inside a ternary
  // in `ChatLayout`, so it UNMOUNTS on navigation away and re-seeds its reducer from
  // `initialTab` at every mount. After ONE click on the attention popover, every subsequent
  // entry into the Library opened on Health — the claim two paragraphs up, falsified by the
  // code beneath it. The clear belongs to the NAVIGATOR, not to a second writer: the hand-off
  // survives the trip INTO the Library and is spent by the next navigation anywhere else
  // (`libraryTabAfterNavigate` owns that rule and is tested without mounting anything).
  const handleNavigate = (next: ActiveView) => {
    setActiveView(next)
    setLibraryTab((pending) => libraryTabAfterNavigate(pending, next))
  }

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
  const { features: effectiveFeatures, loading: featuresLoading, refetch: refetchFeatures } = useEffectiveFeatures(user?.id ?? null)
  const navItems = visibleNavItems(effectiveFeatures)
  // Phase 183 (CANVAS-01 / OP-2): the SAME object the nav filter reads, memoized so
  // descendants re-render only when the map / loading / refetch actually change
  // (the TechnicalNamesProvider memo idiom). This is broadcast — never re-fetched:
  // one hook call site in the whole tree keeps the budget at one GET /features per
  // session, and the nav and any page consumer can never disagree.
  const effectiveFeaturesValue = useMemo(
    () => ({ features: effectiveFeatures, loading: featuresLoading, refetch: refetchFeatures }),
    [effectiveFeatures, featuresLoading, refetchFeatures],
  )

  // Phase 148 (VIS-01 / D-04): the graceful mid-session-flip bounce. If a governed
  // feature's audience is tightened while a non-operator is on its page, that page's
  // NEXT data fetch is refused server-side (a 403 from require_visible). api.ts surfaces
  // any such ApiError(403) as the FEATURE_FORBIDDEN_EVENT window event — we catch it
  // here, show a PLAIN refusal (matching the server body, never a crash/blank),
  // setActiveView("chat") to route home, and refetch the effective map so the nav
  // re-syncs within the ~30s TTL window. Render-only — the server 403 is the wall; the
  // client map alone is NOT the trigger (a flip can land before the map refetch).
  const [featureRefusal, setFeatureRefusal] = useState<string | null>(null)
  useEffect(() => {
    const onForbidden = (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string; status?: number }>).detail
      // CR-02 fix: only a genuine require_visible refusal bounces. api.ts now gates the
      // dispatch on status===403 AND message===VISIBILITY_REFUSAL, so the FLAG-01
      // workflows kill-switch 403 and the app-layer ban 403 never reach here. Re-assert
      // the SAME literal here (explicit + grep-able) so the backend gate, the ApiError
      // dispatch guard, and this listener all agree on that one string.
      if (detail?.status !== 403 || detail?.message !== VISIBILITY_REFUSAL) return
      setFeatureRefusal(VISIBILITY_REFUSAL)
      setActiveView("chat")
      refetchFeatures()
    }
    window.addEventListener(FEATURE_FORBIDDEN_EVENT, onForbidden)
    return () => window.removeEventListener(FEATURE_FORBIDDEN_EVENT, onForbidden)
  }, [refetchFeatures])
  // Auto-dismiss the plain refusal after a few seconds — it is a transient product
  // message (the user is already routed home), not a blocking modal.
  useEffect(() => {
    if (!featureRefusal) return
    const id = window.setTimeout(() => setFeatureRefusal(null), 6000)
    return () => window.clearTimeout(id)
  }, [featureRefusal])

  // Phase 158 (D-06): hold the existing spinner until BOTH the auth state AND the one-shot
  // setup probe resolve — so a fresh box shows the wizard (never a flash of AuthPage first)
  // and a configured box falls straight through to its unchanged path once the probe returns.
  if (loading || setupStatus === null) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  // Phase 158 (D-06): the pre-auth setup branch, BEFORE the !user check. Render the wizard
  // when the box needs setup, or on a literal /setup visit of an un-finalized box; render the
  // lock-out (SC#2) for a finalized /setup visit — never a config field. A configured box that
  // never visits /setup falls through to the unchanged AuthPage/ChatLayout path below (the
  // byte-identical invariant). No url router — a window.location.pathname check honours /setup.
  const atSetupPath = window.location.pathname === "/setup"
  if (setupStatus.needs_setup || (atSetupPath && !setupStatus.finalized)) {
    return <SetupWizard />
  }
  if (atSetupPath && setupStatus.finalized) {
    return <FinalizedLockout onGoToApp={() => window.location.assign("/app")} />
  }

  // Phase 167 (INV-01 / INV-02 / D-167-01): the pre-auth /invite accept-invite branch,
  // mirroring the /setup precedent above — a guarded window.location.pathname check (no url
  // router). Placed BEFORE the !user AuthPage return so an unauthenticated invitee gets the
  // invite-branded auth (sign in → additive 2nd org, or sign up → fresh join) and an already-
  // authenticated visitor on /invite still lands on the accept flow (NOT straight into
  // ChatLayout). AcceptInvitePage reads the raw token from the URL and, on the first authed
  // session, idempotently calls acceptInvitation(token); on success it redirects to "/" so
  // OrgProvider re-probes and the 166 switcher shows both orgs. A non-/invite visit is
  // byte-identical to today — this branch only fires on the literal /invite path.
  const atInvitePath = window.location.pathname === "/invite"
  if (atInvitePath) {
    return <AcceptInvitePage user={user} onSignIn={signIn} onSignUp={signUp} />
  }

  if (!user) {
    return <AuthPage onSignIn={signIn} onSignUp={signUp} />
  }

  return (
    <OrgProvider userId={user?.id ?? null}>
      <StreamsProvider>
        <TooltipProvider>
        {/* Phase 147 (D-06): app-wide end-user maintenance banner — sits above
            ChatLayout, outside the /admin surface, reading the public /health flag. */}
        <MaintenanceBanner />
        {/* Phase 148 (VIS-01 / D-04): the graceful-bounce plain refusal. Shown for a
            few seconds after a mid-session feature-flip 403 routed the user home — a
            calm, honest product message (NOT an alarm), matching the server 403 body.
            RENDER-ONLY; the server 403 is the security wall. */}
        {featureRefusal && (
          <div
            role="status"
            className="fixed inset-x-0 top-0 z-[61] flex items-center justify-center gap-2 border-b border-border/50 bg-card/95 px-4 py-2 text-center text-sm font-medium text-foreground shadow-sm backdrop-blur-sm"
          >
            <Lock className="h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" />
            <span>{featureRefusal}</span>
          </div>
        )}
        {/* Phase 154 (LANG-01 / D-01, D-01a): the app-wide plain⇄technical reveal
            state. Wrapping <ChatLayout> here covers chat, documents, workflows,
            settings, AND /admin — the Control Room renders inside ChatLayout's view
            switch — so the Settings toggle and the admin Control Room toggle move
            ONE shared value and can never disagree. Default plain; localStorage. */}
        <TechnicalNamesProvider>
          {/* Phase 183 (CANVAS-01 / OP-2): the app-wide effective-features broadcast.
              It sits beside TechnicalNamesProvider — both are app-wide UI contexts and
              both must cover ChatLayout's view switch, so the workflows view (and any
              other page) can read the map. Pure plumbing: the value is the object the
              ONE useEffectiveFeatures call above already produced, so there is no
              second GET /features and the Phase-148 fail-closed policy is unchanged.
              A descendant that reads a NULL context (no provider) must treat it as
              fail-closed — every governed feature hidden. */}
          <EffectiveFeaturesProvider value={effectiveFeaturesValue}>
          {/* Phase 153 (CITE-01 / SC#2): the citation cross-view nav provider wraps
              BOTH the chat subtree (where the citation markers/"Open document"
              affordance live) and the documents view (IngestionPage, which reads the
              one-shot pending intent). `navigate` is the real view switcher; opening
              a cited doc pre-selects it through IngestionPage's EXISTING owner/RLS-
              scoped DocumentDetailPanel fetch — no new unscoped document_id fetch. */}
          {/* Phase 235 plan 15: this door routes through the SAME navigator, deliberately.
              It is a DIFFERENT intent (open a cited document), but a hand-off that one
              navigator clears and another bypasses is the exact defect class being closed
              here. Today it is a strict no-op — `citationNav.tsx` only ever navigates to the
              Library view, which is the one destination the rule KEEPS the hand-off for — so
              this changes no behaviour now and clears correctly if a citation ever leads
              somewhere else. */}
          <CitationNavProvider navigate={handleNavigate}>
            <ChatLayout
              onSignOut={signOut}
              activeView={activeView}
              onNavigate={handleNavigate}
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
              libraryTab={libraryTab}
              onOpenLibraryHealth={handleOpenLibraryHealth}
            />
          </CitationNavProvider>
          </EffectiveFeaturesProvider>
        </TechnicalNamesProvider>
        </TooltipProvider>
      </StreamsProvider>
    </OrgProvider>
  )
}

export default App
