import { useCallback, useEffect, useState } from "react"
import { NavPanel } from "./NavPanel"
import { ChatArea } from "@/components/chat/ChatArea"
import { WorkspacePanel, type PanelState } from "@/components/panel/WorkspacePanel"
import { subscribeOpenPanel } from "@/components/panel/panelOpenSignal"
import { IngestionPage } from "@/pages/IngestionPage"
import { SettingsPage } from "@/pages/SettingsPage"
import { SkillsPage } from "@/pages/SkillsPage"
import { KnowledgeHealthPage } from "@/pages/KnowledgeHealthPage"
import { WorkflowsPage } from "@/pages/WorkflowsPage"
import { ClassificationRulesPage } from "@/components/classification/ClassificationRulesPage"
import { useThreads } from "@/hooks/useThreads"
import { useFolders } from "@/hooks/useFolders"
import { useTheme } from "@/hooks/useTheme"
import type { ActiveView } from "@/App"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { MessageSquare, Plus } from "lucide-react"
// Phase 103-06 (REQ-7 / sketch 023-A): the mobile drawer consumes the SINGLE
// shared NAV_ITEMS const (incl. the Workflows home + its distinct icon) — the
// local NAV_ITEMS_MOBILE triplicate is gone (NavPanel already consumes it; this
// is the third + final consumer that kills the triplication).
import { NAV_ITEMS } from "@/lib/nav-items"
// Phase 103-06: the Run-from-page launch reuses the EXISTING kickoff path —
// createThread + sendMessage(workflow_definition_id) — NEVER a bespoke
// /workflows/{id}/run route (D-103-CONF-1; threads.py byte-identical).
import { createThread, postMessage, type PublishedWorkflow } from "@/lib/api"

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
  //    The free-text kickoff becomes inputs={"kickoff_prompt": content}; project
  //    scope is BAKED INTO the published definition (we never pass a folder here). ──
  const doRun = useCallback(
    async (def: PublishedWorkflow, kickoff: string) => {
      const thread = await createThread(def.name)
      await postMessage(thread.id, kickoff, { workflowDefinitionId: def.id })
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

  // Chat-side seam affordances request a panel-open via the module-level signal
  // (additive wiring — moved up from WorkspacePanel; PANEL-06 safe). A seam
  // pointer still force-opens the panel.
  useEffect(() => subscribeOpenPanel(expand), [expand])

  return (
    <div className="flex h-screen bg-background">
      <NavPanel
        activeView={activeView}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
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

      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div
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
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
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
            <div className="space-y-0.5 mt-2">
              {threads.length === 0 && (
                <p className="text-[10px] text-muted-foreground/50 text-center py-4 italic">No recent chats</p>
              )}
              {threads.map((thread) => {
                const isSelected = selectedThread?.id === thread.id
                return (
                  <div
                    key={thread.id}
                    className={cn(
                      "relative rounded-lg cursor-pointer transition-all duration-150 py-1.5",
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
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-50" />
                      <span className="text-sm truncate" title={thread.title}>{thread.title}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          {/* Nav icon row (bottom, fixed) */}
          <div className="border-t border-border/20 px-2 py-3 flex items-center justify-around">
            {NAV_ITEMS.map(({ view, icon: Icon, label }) => {
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
            <SkillsPage onTryInChat={handleTryInChat} />
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
          ) : (
            <KnowledgeHealthPage />
          )}
        </main>
      )}
    </div>
  )
}
