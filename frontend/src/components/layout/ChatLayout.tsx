import { useCallback, useEffect, useRef, useState } from "react"
import { NavPanel } from "./NavPanel"
import { ChatHistoryColumn } from "./ChatHistoryColumn"
import { ThreadCommandPalette } from "./ThreadCommandPalette"
import { ChatArea } from "@/components/chat/ChatArea"
import { WorkspacePanel, type PanelState } from "@/components/panel/WorkspacePanel"
import { subscribeOpenPanel } from "@/components/panel/panelOpenSignal"
import { IngestionPage } from "@/pages/IngestionPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { SkillsPage } from "@/pages/SkillsPage"
import { KnowledgeHealthPage } from "@/pages/KnowledgeHealthPage"
import { WorkflowsPage } from "@/pages/WorkflowsPage"
import { ClassificationRulesPage } from "@/components/classification/ClassificationRulesPage"
import { GovernancePage } from "@/pages/GovernancePage"
import { SkillStudioPage, type StudioTab } from "@/pages/SkillStudioPage"
// Phase 146 (ADMIN-01): the Control Room mounts here as a full-surface branch
// (governance/skill-studio precedent), reachable only via the probe-gated shield.
import { ControlRoomPage } from "@/components/admin/ControlRoomPage"
// Phase 166 Plan 05 (ADMIN-01): the org-admin shell mounts here as a full-surface
// branch (the ControlRoomPage precedent), reachable via the indigo canManage-gated
// Shield-mirror. useOrgOptional supplies canManage (the mobile-drawer shield gate) +
// activeOrgId (the D-166-08 thread-list refetch key).
import { OrgAdminShell } from "@/components/org/OrgAdminShell"
import { useOrgOptional } from "@/providers/OrgProvider"
import { useThreads } from "@/hooks/useThreads"
import { useFolders } from "@/hooks/useFolders"
import { useTheme } from "@/hooks/useTheme"
import type { ActiveView } from "@/App"
import type { OperatorIdentity } from "@/lib/api"
import { cn } from "@/lib/utils"
// Phase 156 (POLISH-01 / D-08, Wave 3): the mobile drawer reuses the ONE shared
// title-search predicate + XSS-safe highlight (Plan 01) so it filters its list the
// SAME way the desktop ChatHistoryColumn does — SC#2 reaches mobile.
import { matchesTitle, HighlightTitle } from "@/lib/threadGroups"
import { Button } from "@/components/ui/button"
import { MessageSquare, Plus, Search, Shield } from "lucide-react"
// Phase 103-06 (REQ-7 / sketch 023-A): the mobile drawer consumes the SINGLE
// shared nav list (incl. the Workflows home + its distinct icon) — the local
// NAV_ITEMS_MOBILE triplicate is gone (NavPanel consumes the same list). Phase 148
// (VIS-01): the list is now the effective-features-FILTERED `navItems` threaded from
// App (governed items already vanished) — NOT the raw NAV_ITEMS const, so the mobile
// drawer and the desktop rail hide the same governed features per one filter pass.
import type { NavItem } from "@/lib/nav-items"
// Phase 103-06: the Run-from-page launch reuses the EXISTING kickoff path —
// createThread + sendMessage(workflow_definition_id) — NEVER a bespoke
// /workflows/{id}/run route (D-103-CONF-1; threads.py byte-identical).
// WR-04: the raw deleteThread api client, aliased to avoid shadowing the useThreads()
// binding (:77) — used for best-effort orphan cleanup on a failed launch.
import {
  createThread,
  postMessage,
  uploadWorkspaceTemplate,
  deleteThread as deleteLaunchThread,
  type PublishedWorkflow,
} from "@/lib/api"

interface Props {
  onSignOut: () => void
  activeView: ActiveView
  onNavigate: (view: ActiveView) => void
  // Phase 148 (VIS-01 / D-04): the effective-features-FILTERED nav list from App
  // (governed items the caller can't use already dropped — the sketch 069-A vanish).
  // Threaded to both the desktop NavPanel and the mobile drawer so both hide the
  // same features from a single filter pass. Render-only; the API is the wall.
  navItems: readonly NavItem[]
  // Phase 146 (ADMIN-01 / D-07): the App-level probe result, render-only. isOperator
  // gates the shield (nav + mobile drawer); operatorIdentity feeds the Control Room
  // band. Non-operators get isOperator=false → nav stays byte-identical to today.
  isOperator: boolean
  operatorIdentity: OperatorIdentity | null
  prefillMessage: string | null
  onSetPrefillMessage: (msg: string | null) => void
  // Phase 137-06 (PANEL-01 / D-01 / sketch 057-A): the unified Skill Studio focused
  // full-surface — its selected skill + active tab + the navigators, all owned by App
  // (per-view state) so the reachability triad (ActiveView union + the mount branch
  // below + the SkillsPage entry action) is owned in-phase. `onOpenStudio` /
  // `onReviewEvals` drill through to SkillsPage (the slim detail panel — Plan 07 — hosts
  // the sole studio-entry button). `onTuneSkill` is preserved: the shipped "Tune
  // triggers" + lint "Tune this →" handoff now auto-lands in Studio · Triggering via
  // App's redirect (the Trigger Tuner is absorbed as the Triggering tab — no orphan).
  studioSkillId: string | null
  studioTab: StudioTab
  onOpenStudio: (skillId: string, tab?: StudioTab) => void
  onReviewEvals: (skillId: string) => void
  onStudioTabChange: (tab: StudioTab) => void
  onTuneSkill: (skillId: string) => void
}

export function ChatLayout({ onSignOut, activeView, onNavigate, navItems, isOperator, operatorIdentity, prefillMessage, onSetPrefillMessage, studioSkillId, studioTab, onOpenStudio, onReviewEvals, onStudioTabChange, onTuneSkill }: Props) {
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

  // Phase 166 Plan 05 (ADMIN-01 / D-166-08): the org context (render-only). canManage
  // gates the mobile-drawer indigo shield; activeOrgId keys the thread-list refetch.
  const org = useOrgOptional()
  const canManage = org?.canManage ?? false
  const activeOrgId = org?.activeOrgId ?? null

  // Phase 156 (POLISH-01, Wave 1 / RESEARCH Pitfall 1): the single app-wide thread
  // bootstrap. Lifted UP from the old NavPanel (which only mounted on the chat view)
  // so the whole app shares one loaded thread list — the Wave-2 global ⌘K palette is
  // never empty on a non-chat view. Keeps the retry-once-after-2s guard for an auth
  // session that isn't ready yet on a hard refresh.
  useEffect(() => {
    loadThreads().catch(() => {
      setTimeout(() => loadThreads().catch(console.error), 2000)
    })
  }, [loadThreads])

  // Phase 166 Plan 05 (ADMIN-02 / D-166-08 second half): reconcile the sidebar thread
  // list to the newly-active org after a switchOrg(). OrgProvider.switchOrg syncs the
  // X-Org-Id header SYNCHRONOUSLY (Plan 02) BEFORE this effect runs, so loadThreads()
  // fetches the NEW org's threads. This is ORTHOGONAL to the StreamsProvider bucket
  // teardown (also Plan 02) — the two are independent 067.5 state, so no cross-effect
  // ordering coupling is needed (reconcile-via-fetch, D-v2.5-03). A ref-guard skips the
  // initial mount (the one-shot effect above already loaded the current org) so this
  // fires ONLY on an actual org change — never a duplicate mount fetch.
  const lastOrgRef = useRef(activeOrgId)
  useEffect(() => {
    if (lastOrgRef.current === activeOrgId) return
    lastOrgRef.current = activeOrgId
    loadThreads().catch(console.error)
  }, [activeOrgId, loadThreads])

  // Title cross-wiring fix (parallel chats): apply a generated title to the run's
  // OWNING threadId (threaded through from StreamsProvider via makeStreamCallbacks)
  // — NOT the currently VIEWED thread, which under fast nav / concurrent runs was
  // the wrong chat (the long run getting a short chat's title).
  const handleTitleUpdate = useCallback(
    (threadId: string, title: string) => {
      updateThreadTitle(threadId, title)
    },
    [updateThreadTitle],
  )

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [mobileFolderId, setMobileFolderId] = useState<string | null>(null)
  // Phase 156 (POLISH-01 / D-08, Wave 3): the mobile drawer's title-search query.
  // Narrows the drawer's flat list via the shared `matchesTitle` (SC#2 on mobile).
  // Desktop-keyboard-first: there is deliberately NO ⌘K on mobile (D-08).
  const [mobileQuery, setMobileQuery] = useState("")

  // Phase 156 (POLISH-01 / D-03, Wave 2): the global ⌘K command palette. Owned HERE
  // (not the chat-only column) so it is reachable on EVERY view over the Wave-1
  // app-wide `threads` (RESEARCH Pitfall 1 — never empty off-chat). Toggled by the
  // ⌘K/Ctrl+K window keydown below OR the ⌘K chip in the ChatHistoryColumn filter box.
  const [paletteOpen, setPaletteOpen] = useState(false)

  // Phase 156 REFINEMENT (operator 2026-07-16, sketch-left-layout Variant A): two
  // left-chrome collapse states, each PINNED + persisted (survives reload), mirroring
  // the workspace-panel collapse the app already ships.
  //  • navExpanded — the ☰ toggle unfolds the 58px icon rail to ~210px labels
  //    (operator concern a: "unfold it and see it fully"); never on hover.
  //  • historyCollapsed — folds the chat-history column fully away so the conversation
  //    goes full-width (operator concern b: "chat area even narrower"). The ▷ reopen
  //    handle then rides the chat top-bar (ChatArea.onReopenHistory).
  // Owned HERE (not in NavPanel/ChatHistoryColumn) so those stay pure/presentational
  // and the NavPanel isolation test sees no localStorage. localStorage is guarded for
  // private-mode / SSR where it can throw.
  const [navExpanded, setNavExpanded] = useState(() => {
    try {
      return localStorage.getItem("nav_rail_expanded") === "1"
    } catch {
      return false
    }
  })
  const toggleNavExpanded = useCallback(() => {
    setNavExpanded((v) => {
      const next = !v
      try {
        localStorage.setItem("nav_rail_expanded", next ? "1" : "0")
      } catch {
        /* private mode — the choice just won't persist */
      }
      return next
    })
  }, [])

  const [historyCollapsed, setHistoryCollapsed] = useState(() => {
    try {
      return localStorage.getItem("chat_history_collapsed") === "1"
    } catch {
      return false
    }
  })
  const setHistoryCollapsedPersisted = useCallback((collapsed: boolean) => {
    setHistoryCollapsed(collapsed)
    try {
      localStorage.setItem("chat_history_collapsed", collapsed ? "1" : "0")
    } catch {
      /* private mode — the choice just won't persist */
    }
  }, [])

  const handleTryInChat = useCallback((skillName: string) => {
    onSetPrefillMessage(`Use the ${skillName} skill`)
    onNavigate("chat")
  }, [onSetPrefillMessage, onNavigate])

  // ── Phase 103-06 (REQ-7 / D-103-CONF-1): doRun — the Run-from-page launch.
  //    Workflows are a MODE of a thread, never page-resident: Run creates a NEW
  //    thread, kicks off a REAL server-side run by REUSING the existing kickoff
  //    (POST /threads → POST /threads/{id}/messages with workflow_definition_id —
  //    NO bespoke /workflows/{id}/run; threads.py byte-identical), then selects +
  //    views the thread and switches to Chat. active_workflow_run_id is set
  //    server-side atomically (create_workflow_run); GET /threads/{id}/workflow ->
  //    "harness" is the proof a real run was kicked off (NOT a view-only switch).
  //    The free-text kickoff becomes inputs={"kickoff_prompt": content}.
  //    ── Phase 152 (WFIN-01/02): the Run modal now carries two optional run inputs.
  //    A staged template File uploads to THIS launched (owned) thread BETWEEN
  //    createThread and postMessage, so the fill path discovers it by `kind` on the
  //    thread (Landmine 8 — the order is strict: createThread → upload → send). A
  //    per-run KB-folder override rides into create_workflow_run.inputs via
  //    postMessage's folder_id (D-01); absence = today's behavior (D-06). A failed
  //    upload surfaces BEFORE the send (the await is not swallowed) so the modal can
  //    render the server's 422 verbatim and no run kicks off. ──
  const doRun = useCallback(
    async (
      def: PublishedWorkflow,
      kickoff: string,
      opts?: { templateFile?: File | null; folderId?: string | null },
    ) => {
      const templateFile = opts?.templateFile ?? null
      const folderId = opts?.folderId ?? null
      const thread = await createThread(def.name)
      // WR-04: a post-create failure (a template 422 — now a routine step — or a
      // postMessage 409/network error) must NOT strand the created thread shell, or
      // every "fix the file → Run again" retry mints another orphan. Best-effort delete
      // the created thread in the catch, then RE-THROW the ORIGINAL error so RunModal
      // still renders the server's message verbatim (the launch-error surfacing, incl.
      // the 422, must not regress). The cleanup is fire-and-forget (errors swallowed) so
      // it never masks or blocks the user-facing failure.
      try {
        // Landmine 8: upload to the launched owned thread so resolve_template_source
        // Branch 2 discovers it by kind='template_input'. Not swallowed — a 422 aborts
        // the launch before postMessage.
        if (templateFile) await uploadWorkspaceTemplate(thread.id, templateFile)
        await postMessage(thread.id, kickoff, {
          workflowDefinitionId: def.id,
          // WFIN-02 (D-01): additive — only when a per-run override was picked (D-06).
          ...(folderId ? { folderId } : {}),
        })
      } catch (e) {
        void deleteLaunchThread(thread.id).catch(() => {}) // don't leak the launch shell
        throw e
      }
      // Only reached on a successful launch — never runs after a thrown/cleaned failure.
      await loadThreads()
      selectThread(thread)
      onNavigate("chat")
    },
    [loadThreads, selectThread, onNavigate],
  )

  // ── Plan 06: lifted panel state machine (panel-shell.md D1). The chat|panel
  //    split is a single ChatLayout-level CSS grid; the single in-panel toggle +
  //    the seam signal drive THIS state.
  //    Plan 08 (operator directive 2026-05-29): consolidated to a NAV-STYLE
  //    2-state machine (open ↔ rail), mirroring NavPanel. The "hidden" state and
  //    the redundant chat-header toggle are gone — the ~52px rail is ALWAYS
  //    present, so the panel is reopenable by mouse on every thread (incl. the
  //    empty/welcome screen), and the pulsing-amber-dot has a permanent host on
  //    the rail's Expand control. ──
  const [panelState, setPanelState] = useState<PanelState>("open")

  // Single in-panel toggle, nav-parity (NavPanel.tsx single button): open ↔ rail.
  // The open-state collapse control (WorkspacePanel header) and the rail Expand
  // control (PanelRail) both flip THIS toggle.
  const togglePanel = useCallback(() => {
    setPanelState((s) => (s === "open" ? "rail" : "open"))
  }, [])
  // Rail Expand control / seam pointer: → open (force-open, never to rail).
  const expand = useCallback(() => setPanelState("open"), [])

  // ⌘./Ctrl+. toggles open ↔ rail (D6, now nav-style — no fully-hidden state).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault()
        togglePanel()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [togglePanel])

  // ⌘K / Ctrl+K toggles the global command palette — mirrors the ⌘. idiom above but
  // matches k (toLowerCase catches shifted K, exactly as the sketch does), and
  // preventDefault also suppresses the browser's native Ctrl+K. Stable deps: the
  // functional setState needs no dependency, so the listener is registered once.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Chat-side seam affordances request a panel-open via the module-level signal
  // (additive wiring — moved up from WorkspacePanel; PANEL-06 safe). A seam
  // pointer still force-opens the panel.
  useEffect(() => subscribeOpenPanel(expand), [expand])

  // Phase 156 (POLISH-01 / D-08, Wave 3): the mobile drawer's filtered list —
  // the SAME shared predicate the desktop column uses (parity). Blank query passes
  // everything through, so an untouched drawer is byte-identical to before.
  const mobileFiltered = threads.filter((t) => matchesTitle(t, mobileQuery))

  return (
    <div className="flex h-screen bg-background">
      <NavPanel
        activeView={activeView}
        onNavigate={onNavigate}
        navItems={navItems}
        isOperator={isOperator}
        onNewThread={newThread}
        onSignOut={onSignOut}
        theme={theme}
        onToggleTheme={toggleTheme}
        expanded={navExpanded}
        onToggleExpanded={toggleNavExpanded}
      />

      {/* Phase 156 (POLISH-01 / D-01, Wave 1): the dedicated full-height chat-history
          column — mounted ONLY on the chat view (mirrors how the thread list was
          chat-only in the old NavPanel). It owns the thread list + inline filter +
          date grouping; the thin rail can no longer starve it (D-10 — structurally
          relieves BUG-260711-01). It is `hidden md:flex` + `shrink-0`, so mobile still
          uses the drawer below and the chat grid keeps `flex-1 min-w-0` → the three
          desktop columns never overflow (Pitfall 7). */}
      {/* Phase 156 REFINEMENT: mounted only when NOT collapsed — folding it away frees
          its ~300px to the conversation (the chat grid below is flex-1, so it reflows to
          full-width). The ▷ reopen handle lives in the chat top-bar (ChatArea). */}
      {activeView === "chat" && !historyCollapsed && (
        <ChatHistoryColumn
          threads={threads}
          selectedThread={selectedThread}
          onSelectThread={selectThread}
          onNewThread={newThread}
          onDeleteThread={deleteThread}
          onRenameThread={renameThread}
          folders={folders}
          onOpenPalette={() => setPaletteOpen(true)}
          onCollapse={() => setHistoryCollapsedPersisted(true)}
        />
      )}

      {/* Phase 156 (POLISH-01 / D-03, Wave 2): the global ⌘K palette, mounted ONCE at
          the layout root OUTSIDE the activeView switch so it is reachable from every
          view (chat / Documents / Settings / Workflows / …). It reads the same app-wide
          `threads` the rest of the layout owns (Wave-1 lifted loadThreads → never empty
          off-chat, Pitfall 1); StreamsProvider-free, so it mounts cleanly here. Selecting
          a result runs selectThread + onNavigate("chat"). When closed it renders nothing. */}
      <ThreadCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        threads={threads}
        onSelectThread={selectThread}
        onNavigate={onNavigate}
      />

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <button
          type="button"
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
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Chat
            </p>
            <div className="px-1 mb-2">
              <Button
                onClick={() => { newThread(mobileFolderId); setMobileFolderId(null) }}
                className="w-full justify-center gap-2 gradient-primary text-white shadow-md shadow-primary/20 hover:opacity-90 transition-all border-none font-semibold"
                size="sm"
              >
                <Plus className="h-4 w-4" />
                New Chat
              </Button>
              {folders.length > 0 && (
                <select
                  value={mobileFolderId ?? ""}
                  onChange={(e) => setMobileFolderId(e.target.value || null)}
                  className="w-full text-xs rounded-lg px-2 py-1.5 bg-card text-foreground ghost-border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all mt-2"
                >
                  <option value="">All documents</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              )}
            </div>
            {/* Phase 156 Wave 3 (Plan 04 / D-08): the mobile drawer title search —
                reuses the shared `matchesTitle` predicate so the drawer filters its
                list the SAME way the desktop column does (SC#2 reaches mobile). There
                is deliberately NO ⌘K here (desktop-keyboard-first, D-08). */}
            <div className="px-1 mb-2">
              <div className="flex items-center gap-2 h-9 px-2.5 rounded-lg bg-card ghost-border transition-all focus-within:ring-2 focus-within:ring-primary/30">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  type="text"
                  value={mobileQuery}
                  onChange={(e) => setMobileQuery(e.target.value)}
                  placeholder="Search chats…"
                  aria-label="Search chats"
                  className="flex-1 min-w-0 bg-transparent border-0 outline-none text-xs text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="space-y-0.5 mt-2">
              {mobileFiltered.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-4 italic">
                  {mobileQuery.trim() ? "No chats match your search." : "No recent chats"}
                </p>
              ) : (
                mobileFiltered.map((thread) => {
                const isSelected = selectedThread?.id === thread.id
                return (
                  <button
                    type="button"
                    key={thread.id}
                    className={cn(
                      "relative block w-full text-left rounded-lg cursor-pointer transition-all duration-150 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
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
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden="true" />
                      <span className="text-sm truncate" title={thread.title}>
                        <HighlightTitle title={thread.title} query={mobileQuery} />
                      </span>
                    </div>
                  </button>
                )
              })
              )}
            </div>
          </div>
          {/* Nav icon row (bottom, fixed) */}
          <div className="border-t border-border/20 px-2 py-3 flex items-center justify-around">
            {navItems.map(({ view, icon: Icon, label }) => {
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
            {/* Phase 166 Plan 05 (ADMIN-01 / D-166-05): the indigo org-admin Shield-mirror
                on mobile — parallel to the amber operator shield, gated on canManage,
                honestly ABSENT for a member, so the org-admin shell is reachable on mobile
                too (the reachability triad reaches the drawer). Indigo, never amber. */}
            {canManage && (
              <button
                aria-label="Organization admin"
                aria-current={activeView === "org-admin" ? "page" : undefined}
                onClick={() => { onNavigate("org-admin"); setDrawerOpen(false) }}
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  activeView === "org-admin"
                    ? "bg-indigo-500/15 text-indigo-400"
                    : "text-indigo-400/80 hover:text-indigo-400 hover:bg-indigo-500/10",
                )}
              >
                <Shield className="w-4 h-4" />
              </button>
            )}

            {/* Phase 146 (ADMIN-01 / D-07): the probe-gated operator shield —
                rendered OUTSIDE NAV_ITEMS (a SEPARATE element, never in the shared
                array) so a non-operator's drawer is byte-identical. Amber Shield,
                distinct from Governance's ShieldCheck; only when isOperator. */}
            {isOperator && (
              <button
                aria-label="Control Room"
                aria-current={activeView === "control-room" ? "page" : undefined}
                onClick={() => { onNavigate("control-room"); setDrawerOpen(false) }}
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  activeView === "control-room"
                    ? "bg-amber-500/15 text-amber-400"
                    : "text-amber-400/80 hover:text-amber-400 hover:bg-amber-500/10",
                )}
              >
                <Shield className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {activeView === "chat" ? (
        // Phase 087-06: App-level chat|panel CSS grid (panel-shell.md D1). The
        // panel column resolves against the REAL row width (not the panel's own
        // indefinite flex width), so 1fr + clamp(...) always sums to the row —
        // zero horizontal overflow, flush-right panel, and the chat centers
        // within its own 1fr column (no dead band).
        // Phase 087-08: nav-style 2-state track — clamp(...) when open, 52px when
        // rail. NO 0 column: the rail is always present, so the panel is always
        // reopenable by mouse (incl. the empty/welcome screen).
        <div
          className="grid min-w-0 flex-1 overflow-hidden motion-safe:transition-[grid-template-columns] motion-safe:duration-300"
          style={{
            gridTemplateColumns:
              "1fr " + (panelState === "open" ? "clamp(300px,30%,420px)" : "52px"),
          }}
        >
          <main className="min-w-0 overflow-hidden">
            <ChatArea
              thread={selectedThread}
              onCreateThread={newThread}
              onTitleUpdate={handleTitleUpdate}
              folders={folders}
              prefillMessage={prefillMessage}
              onClearPrefill={() => onSetPrefillMessage(null)}
              onOpenDrawer={() => setDrawerOpen(true)}
              // Phase 156 REFINEMENT: the ▷ reopen handle shows only while collapsed.
              onReopenHistory={historyCollapsed ? () => setHistoryCollapsedPersisted(false) : undefined}
            />
          </main>
          <WorkspacePanel
            selectedThread={selectedThread}
            state={panelState}
            onToggle={togglePanel}
            onExpand={expand}
          />
        </div>
      ) : (
        <main className="flex-1 overflow-hidden">
          {activeView === "documents" ? (
            <IngestionPage onNavigate={onNavigate} />
          ) : activeView === "skills" ? (
            <SkillsPage
              onTryInChat={handleTryInChat}
              onTuneSkill={onTuneSkill}
              onOpenStudio={onOpenStudio}
              onReviewEvals={onReviewEvals}
            />
          ) : activeView === "settings" ? (
            <SettingsPage />
          ) : activeView === "workflows" ? (
            // Phase 103-06 (REQ-7): the Workflows page mounts here (additive branch
            // BEFORE the trailing KnowledgeHealthPage else — the existing chat +
            // documents/skills/settings render paths are untouched). It hosts the
            // Builder + the publish gauntlet as intra-view state (three-homes, no
            // router); onLaunch = doRun (the existing-kickoff launcher).
            <WorkflowsPage folders={folders} onLaunch={doRun} />
          ) : activeView === "classification-rules" ? (
            // Phase 118 gap-closure (CLASS-01 reachability): the rules-authoring
            // page mounts here as a top-level home (the Plan-04 ActiveView seam +
            // sketch 037-A), additive BEFORE the trailing KnowledgeHealthPage else.
            // Self-fetches via listRules() — no props; three-homes, no router.
            <ClassificationRulesPage />
          ) : activeView === "governance" ? (
            // Phase 119 (DGOV-01/02): the Governance top-level home mounts here as
            // a peer to Library Health (the D-119-2 navigation triad — App.tsx
            // union + this branch + the nav-items entry, all owned in-phase so the
            // surface is reachable; the Phase 118 built-but-unreachable lesson).
            // Self-fetches the 3 governance signals — no props; three-homes, no router.
            <GovernancePage />
          ) : activeView === "skill-studio" ? (
            // Phase 137-06 (PANEL-01 / D-01 / sketch 057-A): the unified Skill Studio
            // focused full-surface mounts here (additive branch BEFORE the trailing
            // KnowledgeHealthPage else — mirrors the governance/tuner precedent). It is
            // entered WITH a skillId — via the slim detail panel's "Open studio" (Plan
            // 07) or the "Tune triggers"/lint redirect (→ tab=triggering). The persistent
            // header + Evals/Triggering/Versions tabs live inside; the Trigger Tuner is
            // absorbed as the Triggering tab; "‹ Skills" returns. The reachability triad
            // (App union + this mount + the navigators) is owned in-phase (the Phase-118
            // built-but-unreachable lesson).
            <SkillStudioPage
              skillId={studioSkillId}
              tab={studioTab}
              onTabChange={onStudioTabChange}
              onBack={() => onNavigate("skills")}
            />
          ) : activeView === "control-room" ? (
            // Phase 146 (ADMIN-01 / D-07): the Control Room full-surface mounts here
            // (additive branch BEFORE the trailing KnowledgeHealthPage else — the
            // governance/skill-studio precedent). It is reachable ONLY via the
            // probe-gated shield (NavPanel footer + the mobile drawer); operatorIdentity
            // feeds the band, onBack returns to chat. The reachability triad (App union
            // + this mount + the shield action) is owned in-phase (the built-but-
            // unreachable lesson).
            <ControlRoomPage identity={operatorIdentity} onBack={() => onNavigate("chat")} />
          ) : activeView === "org-admin" ? (
            // Phase 166 Plan 05 (ADMIN-01 / D-166-05): the org-admin shell full-surface
            // mounts here (additive branch BEFORE the trailing KnowledgeHealthPage else —
            // the ControlRoomPage precedent). Reached ONLY via the indigo canManage-gated
            // Shield-mirror (NavPanel footer + the mobile drawer); the shell self-sources
            // everything from useOrg()/useTechnicalNames() — its only prop is onBack. This
            // closes the reachability triad (App union [Plan 02] + this mount + the NavPanel
            // entry — all owned in-phase; the Phase-118 built-but-unreachable lesson).
            <OrgAdminShell onBack={() => onNavigate("chat")} />
          ) : (
            <KnowledgeHealthPage />
          )}
        </main>
      )}
    </div>
  )
}
