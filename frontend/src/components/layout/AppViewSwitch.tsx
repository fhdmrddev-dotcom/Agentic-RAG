import { ChatArea } from "@/components/chat/ChatArea"
import { ThreadNavigationProvider, type ThreadNavigation } from "@/components/chat/threadNavigation"
import { WorkspacePanel, type PanelState } from "@/components/panel/WorkspacePanel"
import { LibraryPage } from "@/pages/LibraryPage"
// Phase 235-08 — the tab union from the page's own leaf, the `type StudioTab` idiom below.
import type { LibraryTab } from "@/pages/librarySelection"
import { SettingsPage } from "@/pages/SettingsPage"
import { SETTINGS_TAB_STORAGE_KEY } from "@/components/settings/settingsTabs"
import { writeApiKeyPrepick } from "@/components/settings/apiKeys/apiKeyPrepick"
import { ConnectionsPage } from "@/pages/ConnectionsPage"
import { SkillsPage } from "@/pages/SkillsPage"
import { WorkflowsPage } from "@/pages/WorkflowsPage"
import { UnknownViewFallback } from "./UnknownViewFallback"
import { SkillStudioPage, type StudioTab } from "@/pages/SkillStudioPage"
// Phase 146 (ADMIN-01): the Control Room mounts here as a full-surface branch
// (governance/skill-studio precedent), reachable only via the probe-gated shield.
import { ControlRoomPage } from "@/components/admin/ControlRoomPage"
// Phase 166 Plan 05 (ADMIN-01): the org-admin shell mounts here as a full-surface
// branch (the ControlRoomPage precedent), reachable via the indigo canManage-gated
// Shield-mirror.
import { OrgAdminShell } from "@/components/org/OrgAdminShell"
// Phase 188 Plan 09 (RUNVIZ-03): the run's own room mounts here as a full-surface
// branch (the SkillStudioPage precedent — entered WITH an id, returned via callbacks).
import { WorkflowRunPage, COPY_LOADING } from "@/pages/WorkflowRunPage"
// Phase 297-02 (D-14 / D-19 / D-35): the not-found and holding states, as arms of this switch.
import { AddressNotFound, AddressHolding, ADMIN_HOLD_COPY } from "./AddressNotFound"
// Phase 257 (METER-07): Operator Spend & Metering cockpit
import { AdminSpendPage } from "@/pages/admin/AdminSpendPage"
// Phase 262 plan 05 (PACK-11 / PACK-13 / D-262-03): the Expert catalog, and the ordered
// handoff that turns one control on it into a chat the SERVER already knows is scoped.
// `startScopedChat` takes every seam as a parameter, so the seams ChatLayout holds are
// injected at the mount below rather than imported by the catalog itself.
import { ExpertCatalogPage } from "@/components/experts/catalog/ExpertCatalogPage"
import { startScopedChat } from "@/components/experts/catalog/startScopedChat"
import type { AttentionCondition } from "./attentionConditions"
import type { useThreads } from "@/hooks/useThreads"
import type { useFolders } from "@/hooks/useFolders"
import type { ActiveView } from "@/App"
import type { OperatorIdentity, PublishedWorkflow } from "@/lib/api"
import type { Thread } from "@/types"
import type { EntityLink } from "@/hooks/useAppNavigation"
import { Menu } from "lucide-react"
// Phase 262 plan 05 (PACK-13 / D-262-08): the SHIPPED PATCH the composer's invite door
// already issues — the same mechanism, reached one register lower so a surface outside the
// chat branch can use it. ⛔ Not a second way to scope a thread.
import { setThreadActiveExpert } from "@/lib/api"

type Threads = ReturnType<typeof useThreads>

export interface AppViewSwitchProps {
  /** The view on screen. */
  activeView: ActiveView
  /** The app navigator (App's `useAppNavigation().onNavigate`, threaded through ChatLayout). */
  onNavigate: (view: ActiveView) => void
  /** The workspace panel's 2-state track (open ↔ rail), owned by ChatLayout. */
  panelState: PanelState
  /** Flip the workspace panel open ↔ rail. */
  togglePanel: () => void
  /** Force the workspace panel open. */
  expand: () => void
  /** The chat surface's thread door (ChatLayout's memoised value). */
  threadNavigation: ThreadNavigation
  /** The selected thread from ChatLayout's one `useThreads()`. */
  selectedThread: Threads["selectedThread"]
  /** Create a thread (ChatLayout's `useThreads().newThread`). */
  newThread: Threads["newThread"]
  /** Write the server's thread back into the list (267-REVIEW CR-01). */
  patchThread: Threads["patchThread"]
  /** Apply a generated title to the run's OWNING thread. */
  handleTitleUpdate: (threadId: string, title: string) => void
  /** `useFolders()`'s ONE read. */
  folders: ReturnType<typeof useFolders>["folders"]
  /** The composer prefill App holds. */
  prefillMessage: string | null
  /** Set or clear the composer prefill. */
  onSetPrefillMessage: (msg: string | null) => void
  /** Open or close ChatLayout's mobile drawer. */
  setDrawerOpen: (open: boolean) => void
  /** Whether the attention signal shows (ChatLayout's ONE registry read). */
  showAttention: boolean
  /** How many attention conditions the ONE read resolved. */
  attentionCount: number
  /** Whether the chat-history column is folded away. */
  historyCollapsed: boolean
  /** Fold or unfold the chat-history column, persisted. */
  setHistoryCollapsedPersisted: (collapsed: boolean) => void
  /** ChatLayout's ONE strict `=== true` canvas read — passed in, never re-read here (CR-05). */
  canvasEnabled: boolean
  /** Open the run room on a `workflow_runs.id`. */
  openRunSurface: (runId: string) => void
  /** The run room's `workflow_runs.id` (never a producer run id). */
  activeRunId: string | null
  /** The Run-from-page launcher (ChatLayout's `doRun`). */
  doRun: (
    def: PublishedWorkflow,
    kickoff: string,
    opts?: { templateFile?: File | null; folderId?: string | null; inputs?: Record<string, string> },
  ) => Promise<void>
  /** The one-shot Library tab hand-off. */
  libraryTab: LibraryTab | undefined
  /** ChatLayout's ONE resolved attention condition list, handed DOWN as data. */
  attentionConditions: readonly AttentionCondition[]
  /** The Library's Ask exit (a NEW conversation, pre-filled, never sent). */
  handleAskInChat: (question: string) => Promise<boolean>
  /** The Skills page's "Try in chat" (prefills the CURRENT thread). */
  handleTryInChat: (skillName: string) => void
  /** Legacy Tuner door → Skill Studio · Triggering. */
  onTuneSkill: (skillId: string) => void
  /** Open the Skill Studio on a skill. */
  onOpenStudio: (skillId: string, tab?: StudioTab) => void
  /** Open the Skill Studio on Evals. */
  onReviewEvals: (skillId: string) => void
  /** The Skill Studio's skill. */
  studioSkillId: string | null
  /** The Skill Studio's tab. */
  studioTab: StudioTab
  /** Change the Skill Studio's tab. */
  onStudioTabChange: (tab: StudioTab) => void
  /** The operator probe identity for the Control Room band. */
  operatorIdentity: OperatorIdentity | null
  /** Phase 297-02 (D-14): the address names nothing — S1 renders instead of any view. */
  addressNotFound?: boolean
  /** Phase 297-02 (D-19): the features read is still loading (ChatLayout's ONE context read). */
  featuresLoading?: boolean
  /** Phase 297-02 (D-35): the operator probe's answer, and whether it is still loading. */
  isOperator?: boolean
  operatorLoading?: boolean
  /** The app-wide thread list (Phase 156's Wave-1 bootstrap). */
  threads: Threads["threads"]
  /** Select a thread. */
  selectThread: Threads["selectThread"]
  /** Refetch the thread list. */
  loadThreads: Threads["loadThreads"]
  /** Delete a thread. */
  deleteThread: Threads["deleteThread"]
  /** Phase 299-02 (D-02): select a thread AND put its address on screen (one entry) —
   *  ChatLayout's `useThreadAddress().openThread`. Optional: absent, the pre-299 pair runs. */
  openThread?: (thread: Thread) => void
  /** Phase 299-02 (Pitfall 5): a thread address is on screen and its thread is not selected yet. */
  threadHolding?: boolean
  /** Phase 299-02 (D-03 / D-04): App's entity navigators — the linked workflow / Expert id. */
  entityLink?: EntityLink
}

/**
 * Phase 297 plan 01 (REG-09 / D-01) — the `ActiveView` mount switch, moved out of
 * `ChatLayout.tsx` VERBATIM along the seam `docs/HOT-FILE-LEDGER.md` §
 * `frontend/src/components/layout/ChatLayout.tsx` named.
 *
 * PURE: it owns no hooks. Every identifier the switch read in ChatLayout is a same-named prop
 * here, so the body below is the shipped expression byte-for-byte (only its enclosing JSX
 * braces changed) and every source fence over it still matches. ChatLayout keeps the state,
 * the one attention-registry read, the one canvas read, `doRun` and the drawer, and renders
 * this exactly where the expression used to be.
 *
 * ⛔ Binding invariants (fenced, see the ledger section): the trailing fallback stays the LAST
 * arm; exactly one comment-stripped `workflow-run` comparison; `canvasEnabled` is passed in,
 * never re-read here; the chat branch's grid and `<main>` class strings are pinned.
 *
 * Phase 297-02 (D-14 / D-19 / D-34 / D-35): the address states are arms of this switch. S1
 * (`AddressNotFound`) is the FIRST arm of the non-chat side and the chat condition excludes it;
 * the run hold sits inside the existing run arm; the admin arms hold on the operator probe, then
 * show S1 to a non-operator. Every hold lives HERE, never at App level (it would unmount streams).
 *
 * ⚠ CORRECTED 2026-10-27 (Phase 297-02) — KEPT RATHER THAN OVERWRITTEN: several comments below
 * say this app has "no router". Since 297-02 it has one: a single catch-all route, with the view
 * derived from the address (`lib/appRoutes.ts`). Those comments are true of the code they were
 * written beside on their own dates; the navigators they describe are unchanged, and tab
 * addresses (Settings, Library, Studio) are Phase 299.
 */
export function AppViewSwitch({
  activeView,
  onNavigate,
  panelState,
  togglePanel,
  expand,
  threadNavigation,
  selectedThread,
  newThread,
  patchThread,
  handleTitleUpdate,
  folders,
  prefillMessage,
  onSetPrefillMessage,
  setDrawerOpen,
  showAttention,
  attentionCount,
  historyCollapsed,
  setHistoryCollapsedPersisted,
  canvasEnabled,
  openRunSurface,
  activeRunId,
  doRun,
  libraryTab,
  attentionConditions,
  handleAskInChat,
  handleTryInChat,
  onTuneSkill,
  onOpenStudio,
  onReviewEvals,
  studioSkillId,
  studioTab,
  onStudioTabChange,
  operatorIdentity,
  threads,
  selectThread,
  loadThreads,
  deleteThread,
  addressNotFound = false,
  featuresLoading = false,
  isOperator = false,
  operatorLoading = false,
  openThread,
  threadHolding = false,
}: AppViewSwitchProps) {
  return (
      activeView === "chat" && !addressNotFound ? (
        // Phase 087-06: App-level chat|panel CSS grid (panel-shell.md D1). The
        // panel column resolves against the REAL row width (not the panel's own
        // indefinite flex width), so 1fr + clamp(...) always sums to the row —
        // zero horizontal overflow, flush-right panel, and the chat centers
        // within its own 1fr column (no dead band).
        // Phase 087-08: nav-style 2-state track — clamp(...) when open, 52px when
        // rail. NO 0 column: the rail is always present, so the panel is always
        // reopenable by mouse (incl. the empty/welcome screen).
        //
        // Phase 244-01 (SHELL-01 / BUG-260828-08): `min-h-0` here and on <main> below are
        // links 2 and 3 of a FOUR-link chain (ChatArea.tsx and MessageList.tsx carry 4 and
        // 5). A flex item's min-height defaults to `auto`, so `flex-1` alone does NOT bound
        // this track: it grew to the whole transcript, the PAGE ROOT scrolled instead of the
        // message list, and the nav rail travelled with it. Shipped analog copied rather than
        // invented: DocumentDetailPanel.tsx:257/300. Pinned by
        // layout/__tests__/ChatLayout.scrollFrame.test.tsx.
        <div
          className="grid min-w-0 min-h-0 flex-1 overflow-hidden motion-safe:transition-[grid-template-columns] motion-safe:duration-300"
          style={{
            gridTemplateColumns:
              "1fr " + (panelState === "open" ? "clamp(300px,30%,420px)" : "52px"),
          }}
        >
          <main className="min-w-0 min-h-0 overflow-hidden">
            {/* Phase 299-02 (Pitfall 5): a thread address whose thread is not selected yet holds
                here, never as the empty welcome composer (ChatArea with no thread). */}
            {threadHolding ? (
              <AddressHolding sentence="Opening the chat…" />
            ) : (
            <ThreadNavigationProvider value={threadNavigation}>
            <ChatArea
              thread={selectedThread}
              onCreateThread={newThread}
              // 267-REVIEW CR-01: an Expert change writes the server's thread back into this list.
              onThreadUpdated={patchThread}
              onTitleUpdate={handleTitleUpdate}
              folders={folders}
              prefillMessage={prefillMessage}
              onClearPrefill={() => onSetPrefillMessage(null)}
              onOpenDrawer={() => setDrawerOpen(true)}
              // Phase 235 plan 09 (SURF-03): a CLOSED drawer must still signal, so the
              // control that OPENS it carries a dot. Same one read as the rail and the
              // drawer row — a count, never a second poll.
              attentionCount={showAttention ? attentionCount : 0}
              // The composer's Connectors flyout needs a REAL navigator: this app has no
              // router (SEED-185), so its three buttons set a URL hash nothing reads — and
              // one called an undefined `navigate` and threw ReferenceError. It goes to the
              // UNGOVERNED connections door, never to `settings`, which is operator-only.
              onOpenConnections={() => onNavigate("connections")}
              // Phase 262 plan 05 (PACK-11): the composer's second door into the catalog,
              // wired exactly like the connections door above. ⭐ Deliberate redundancy —
              // the rail entry is the triad's third leg; this one exists because BUS-303
              // named both, and because a person wanting an Expert is usually mid-thread.
              onBrowseExperts={() => onNavigate("experts")}
              // Phase 156 REFINEMENT: the ▷ reopen handle shows only while collapsed.
              onReopenHistory={historyCollapsed ? () => setHistoryCollapsedPersisted(false) : undefined}
            />
            </ThreadNavigationProvider>
            )}
          </main>
          <WorkspacePanel
            selectedThread={selectedThread}
            state={panelState}
            onToggle={togglePanel}
            onExpand={expand}
            // CR-05: the receipt is the OTHER door into the run home, so the kill switch
            // owns it too. The panel renders NOTHING without this callback (its own suite
            // fences that), so withholding it removes the affordance entirely rather than
            // leaving a control that opens the positional fallback.
            onOpenRun={canvasEnabled ? openRunSurface : undefined}
          />
        </div>
      ) : (
        // 262-UAT 1.2: the ONLY mobile drawer trigger lived in ChatArea, so every view on this
        // side stranded a phone user. One md:hidden bar, reusing the drawer this file owns —
        // no new state. `<main>`'s class string is pinned by ChatLayout.launch.test.tsx.
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="md:hidden flex shrink-0 items-center border-b border-border/30 px-4 py-2">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        <main className="flex-1 overflow-hidden">
          {/* ⚠ NOTHING GOES BETWEEN THE BRANCH BELOW AND ITS MOUNT. `renameFence.test.ts`
              asserts that key link inside a 120-character window, so a comment in the gap
              breaks a fence about the Documents→Library rename — which has nothing to do
              with whatever the comment was saying. Phase 235-08: `libraryTab` is
              `undefined` on every ordinary entry, so the Library keeps its own default; it
              is set only by App's `handleOpenLibraryHealth`. */}
          {addressNotFound ? (
            <AddressNotFound onGoHome={() => onNavigate("chat")} />
          ) : activeView === "documents" ? (
            <LibraryPage onNavigate={onNavigate} initialTab={libraryTab} attentionConditions={attentionConditions} onAskInChat={handleAskInChat} />
          ) : activeView === "skills" ? (
            <SkillsPage
              onTryInChat={handleTryInChat}
              onTuneSkill={onTuneSkill}
              onOpenStudio={onOpenStudio}
              onReviewEvals={onReviewEvals}
            />
          ) : activeView === "connections" ? (
            // The ungoverned Connections door (`nav-items.ts`) — its OWN page since
            // 2026-09-01, no longer `<SettingsPage initialTab="5" />`.
            //
            // ⚠ THE PIN WAS THE BUG. Mounting SettingsPage here rendered the whole tab
            // strip either way, so `Settings` and `Connections` were two rail entries
            // onto ONE page differing only by which tab was pre-selected — invisible to a
            // member (whose Settings entry vanishes) and a plain duplicate for an
            // operator, who sees both. The comment this replaces said as much:
            // *"`initialTab` is a pin, not a lock"*. One home per concern now means one
            // home, not one page wearing two labels. See `ConnectionsPage.tsx`.
            <ConnectionsPage />
          ) : activeView === "settings" ? (
            // 293-04: API keys activity opens a run in the SAME run room the workflows page uses.
            <SettingsPage onOpenRun={canvasEnabled ? openRunSurface : undefined} />
          ) : activeView === "workflows" ? (
            // Phase 103-06 (REQ-7): the Workflows page mounts here (additive branch
            // BEFORE the trailing KnowledgeHealthPage else — the existing chat +
            // documents/skills/settings render paths are untouched). It hosts the
            // Builder + the publish gauntlet as intra-view state (three-homes, no
            // router); onLaunch = doRun (the existing-kickoff launcher).
            // SEED-190 — `onOpenRun` is the SAME `openRunSurface` the workspace panel's run
            // seam already uses, threaded down so the run log opens the existing run room
            // rather than a second one. Canvas-gated exactly as the panel's seam is: with the
            // layer off the log renders rows that are not controls, because the room they
            // would open does not exist.
            <WorkflowsPage
              folders={folders}
              onLaunch={doRun}
              onOpenRun={canvasEnabled ? openRunSurface : undefined}
              // SEED-218 / D-27: the describe door's connect control → the UNGOVERNED Connections
              // door, never operator-only `settings`. Not canvas-gated: Connections always exists.
              onOpenConnections={() => onNavigate("connections")}
              // 293-04 (D-18): a published card's ⋯ "New API key…" → Settings → API keys with that
              // workflow pre-picked. No URL, no router (three homes): the pre-pick rides
              // sessionStorage and the tab rides the same localStorage key Settings reads.
              onOpenApiKeys={(s) => {
                writeApiKeyPrepick({ workflowId: s.id, name: s.name })
                localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, "7")
                onNavigate("settings")
              }}
            />
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
            // Phase 297-02 (D-35): reachable by ADDRESS now, so the probe gates the render — a
            // hold while it loads, then S1 (the unknown-address words) for a non-operator.
            operatorLoading ? (
              <AddressHolding sentence={ADMIN_HOLD_COPY} />
            ) : isOperator ? (
              <ControlRoomPage identity={operatorIdentity} onBack={() => onNavigate("chat")} />
            ) : (
              <AddressNotFound onGoHome={() => onNavigate("chat")} />
            )
          ) : activeView === "org-admin" ? (
            // Phase 166 Plan 05 (ADMIN-01 / D-166-05): the org-admin shell full-surface
            // mounts here (additive branch BEFORE the trailing KnowledgeHealthPage else —
            // the ControlRoomPage precedent). Reached ONLY via the indigo canManage-gated
            // Shield-mirror (NavPanel footer + the mobile drawer); the shell self-sources
            // everything from useOrg()/useTechnicalNames() — its only prop is onBack. This
            // closes the reachability triad (App union [Plan 02] + this mount + the NavPanel
            // entry — all owned in-phase; the Phase-118 built-but-unreachable lesson).
            <OrgAdminShell onBack={() => onNavigate("chat")} />
          ) : activeView === "workflow-run" && (canvasEnabled || featuresLoading) ? (
            // Phase 188 Plan 09 (RUNVIZ-03 / SPEC Req 6 / D-188-10): the run's own room
            // mounts here as the FOURTH home — additive branch placed IMMEDIATELY BEFORE
            // the trailing KnowledgeHealthPage (the governance/skill-studio/control-room
            // precedent). ⚠ That trailing element is a POSITIONAL FALLBACK, not a
            // `default:` that throws: an ActiveView member with no branch of its own
            // silently renders Knowledge Health, so the branch MUST precede it (the
            // Phase-118 built-but-unreachable lesson). The reachability triad — the
            // App.tsx union member + this mount + doRun's navigation — is owned in-phase.
            //
            // Entered WITH a `workflow_runs.id` (never a producer `runs.run_id`), set by
            // doRun below. `onBack` returns to the Workflows library; `onOpenThread` is
            // D-188-13's bidirectional seam back into the run's chat thread, resolved off
            // the already-loaded app-wide `threads` list (Phase 156's Wave-1 bootstrap)
            // because `selectThread` takes a Thread, not an id.
            //
            // ⚠ CR-05: the branch condition carries `&& canvasEnabled`, so a STALE
            // activeView cannot resurrect this home after the operator flips the switch —
            // it falls through to the positional fallback, which is how every other
            // unclaimed member behaves and is therefore the byte-identical answer. This
            // closes the render-guard assertion Phase 181 deferred to "the first canvas
            // ActiveView render branch". Gating the render alone would strand a launch on
            // the fallback, which is why doRun is gated too.
            //
            // NO nav-rail item claims this view: while activeView === "workflow-run" no
            // rail item carries aria-current (188-UI-SPEC § Copywriting Contract). This
            // home is reached by launching or by the thread's run receipt, never from the
            // rail — so `nav-items.ts` is deliberately untouched.
            //
            // The message list, the composer and the workspace panel all live inside the
            // `activeView === "chat" ?` branch above, so a view on THIS side renders none
            // of them. That is what makes SPEC Req 6's "no message list and no composer" a
            // structural property of the layout rather than a discipline — and the reason
            // the run surface renders its own deliverable list (Plan 10).
            // ⚠ Those two components are named in WORDS, never as JSX tags: the source
            // fence in ChatLayout.launch.test.tsx measures that their tags appear ONLY
            // before the split point, and prose spelling a tag would break a real
            // measurement (the 187-24 lesson, met three times in this phase alone).
            //
            // Phase 297-02 (D-19 / D-34): a COLD run address arrives before the features read
            // answers, when the canvas flag still reads off. Hold here, in this same arm (so the
            // comparison count stays one), with the page's own loading sentence; once the read
            // answers, the flag decides between the page and the trailing fallback as before.
            canvasEnabled ? (
              <WorkflowRunPage
                runId={activeRunId}
                onBack={() => onNavigate("workflows")}
                onOpenThread={(tid) => {
                  const t = threads.find((x) => x.id === tid)
                  if (t) selectThread(t)
                  onNavigate("chat")
                }}
              />
            ) : (
              <AddressHolding sentence={COPY_LOADING} />
            )
          ) : activeView === "admin-spend" ? (
            // Phase 297-02 (D-35): the same probe gate as the Control Room above.
            operatorLoading ? (
              <AddressHolding sentence={ADMIN_HOLD_COPY} />
            ) : isOperator ? (
              <AdminSpendPage onBack={() => onNavigate("control-room")} />
            ) : (
              <AddressNotFound onGoHome={() => onNavigate("chat")} />
            )
          ) : activeView === "experts" ? (
            // Phase 262 plan 05 (PACK-11 / PACK-13 / D-262-03): the Expert catalog — the
            // LAST-BUT-ONE arm, deliberately, so the trailing positional fallback stays last.
            //
            // ⛔ THAT POSITION IS THE WHOLE LEG. The trailing element is a POSITIONAL
            // fallback, not a `default:` that throws, and `as never` is always a legal
            // assertion — so a member whose branch landed AFTER it would be dead code that
            // compiles and typechecks clean. Two independent fences now measure this:
            // `lib/activeViewReachability.ts` (AST: every member has a branch, and the
            // fallback is last) and `ChatLayout.launch.test.tsx`'s positional index check.
            //
            // ⭐ `folders` is `useFolders()`'s ONE read, already threaded to three mounts
            // above — this is a fourth consumer and ZERO new fetches. The page itself makes
            // exactly one list call and reaches for no other client function.
            //
            // The start control's five seams are this component's own: the thread creator,
            // the shipped expert PATCH, the list refetch, the selection, and the navigation.
            // ⛔ The refetch BEFORE the selection is load-bearing, not tidiness — the created
            // row's expert column is null and the thread hook exposes no updater for it, so
            // without it the history list would disagree with the server the moment the
            // person clicks that thread again. `startScopedChat`'s docblock owns that rule.
            <ExpertCatalogPage
              folders={folders}
              // 267 (D-267-08): a missing required connection's Connect control uses the SAME
              // shipped door the composer uses above — no per-service deep link.
              onOpenConnections={() => onNavigate("connections")}
              onStartChat={async (expert) => {
                // ⛔ THE CATCH IS NOT DECORATION, AND IT IS NOT A SWALLOW EITHER. `startScopedChat`
                // REJECTS when the PATCH is refused, precisely so a failed start never dresses
                // itself as a scoped chat (T-262-15) — and the page's handler discards the
                // returned promise, so an uncaught rejection here would surface as an unhandled
                // rejection and nothing else. The refusal already did its job by the time this
                // runs: no navigation happened and no thread was selected, so the person stays
                // on the catalog looking at the control they pressed.
                // ⚠ RECORDED AS A GAP RATHER THAN GLOSSED: this app ships no toast surface and
                // the catalog page's props are fixed at `{ folders, onStartChat, onInspect? }`,
                // so the only honest report available at this seam is the console — which is
                // exactly what the composer's own invite door does one register over
                // (`MessageInput.handleSelectExpert`). A visible failure state needs a prop the
                // page does not have; that is a contract change, not a line here.
                try {
                  await startScopedChat(
                    {
                      createThread: newThread,
                      setExpert: setThreadActiveExpert,
                      refreshThreads: loadThreads,
                      // Phase 299-02 (D-02): with `openThread` the selection writes the thread's
                      // address (one entry) and the navigate step has nothing left to do.
                      selectThread: openThread ?? selectThread,
                      navigate: openThread ? () => {} : () => onNavigate("chat"),
                      // 262-UAT 3.6: a refused scoping PATCH no longer leaves an empty thread.
                      discardThread: deleteThread,
                    },
                    expert,
                  )
                } catch (err) {
                  console.error("Failed to start a scoped chat with this Expert:", err)
                  // 262-UAT 3.6: re-thrown so the catalog can SHOW the failure (the gap
                  // recorded above is closed by the page, not by a toast surface).
                  throw err
                }
              }}
            />
          ) : (
            <UnknownViewFallback view={activeView as never} />
          )}
        </main>
        </div>
      )
  )
}
