import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { MessageList } from "./MessageList"
import { MessageInput } from "./MessageInput"
import { ChatToolApprovalCard, type ApprovalDecision } from "./ChatToolApprovalCard"
import { useMessages } from "@/hooks/useMessages"
import { useStreamsStore } from "@/stores/streamsStore"
import {
  useStreamingForThread,
  useLoadingForThread,
  useReconcileErrorForThread,
  useFallbackNoticeForThread,
  useFailedSendDraftForThread,
  useWorkflowLockForThread,
  useStreamActions,
} from "@/providers/StreamsProvider"
import {
  getThreadWorkflow,
  getExpert,
  setThreadActiveExpert,
  setThreadFolder,
  getScopeEffect,
  ApiError,
} from "@/lib/api"
import { handoffThread, type ScopeEffect } from "@/lib/api/threads"
import { PREVIEW_COPY } from "@/components/experts/catalog/expertCatalog"
import { useComposerModel } from "@/hooks/useComposerModel"
import { useThreadNavigation } from "./threadNavigation"
import { ExpertSpotlightCard } from "./ExpertSpotlightCard"
import { ScopeChip } from "./ScopeChip"
import { SCOPE_COPY, chipLabel } from "./scopeCopy"
import type { Folder, Thread, ExpertBundle } from "@/types"
import { Clock, Menu, Sparkles, PanelLeftOpen } from "lucide-react"

interface Props {
  thread: Thread | null
  /** Phase 267 (D-267-21): the second argument creates the thread WITH its Expert, so an Expert
   *  invited on a brand-new chat scopes the first run instead of being cleared by hydration. */
  onCreateThread: (folderId?: string | null, activeExpertId?: string | null) => Promise<Thread>
  /** 267-REVIEW CR-01: the server's thread after an Expert change, for the owner of the thread list.
   *  Optional: suites that mount ChatArea from their own props keep compiling. */
  onThreadUpdated?: (thread: Thread) => void
  onTitleUpdate?: (threadId: string, title: string) => void
  folders: Folder[]
  prefillMessage?: string | null
  onClearPrefill?: () => void
  onOpenDrawer?: () => void
  /** Take the person to the connections surface — see `ConnectorsFlyout`. */
  onOpenConnections?: () => void
  // Phase 262 plan 05 (PACK-11): the composer's second door into the Expert catalog. Pure
  // pass-through — this component decides nothing about it. Optional at every hop, for the
  // reason `MessageInput`'s own Props docblock gives: four shipped suites mount these
  // components from their own prop objects and a required prop would redden a typecheck
  // baseline that has zero headroom.
  onBrowseExperts?: () => void
  // Phase 156 REFINEMENT (operator 2026-07-16): reopens the folded-away chat-history
  // column (sketch Variant A #reopenA — the ▷ handle in the chat top-bar). Provided by
  // ChatLayout ONLY while the history is collapsed; undefined otherwise, so the handle
  // renders exactly when there's a hidden column to bring back.
  onReopenHistory?: () => void
  // ── Phase 235 plan 09 (SURF-03) ──────────────────────────────────────────────────────
  //
  // How many app-level conditions need a person right now. ⛔ ChatArea DERIVES NOTHING and
  // FETCHES NOTHING: `ChatLayout` resolves the count once from the attention registry and
  // hands it down, so the rail badge, the drawer badge and this dot can never disagree
  // (D-235-05). `undefined` and `0` both render nothing.
  //
  // ⚠ G-5 POSTURE, STATED RATHER THAN ASSUMED. This file is a G-5-firing hot file
  // (67 / 32 / 595) and this change is honoured BY CONSTRUCTION, by arithmetic rather than
  // argument: ONE optional prop, ONE decorative element rendered at the two shipped
  // drawer-trigger sites, ZERO new `useState`, ZERO new `useEffect`, and no branch beyond the
  // dot's own render guard. It is the shape `IngestionTab.tsx:220-231` uses for the same
  // claim — a mount, not a rewrite.
  attentionCount?: number
}

export function ChatArea({ thread, onCreateThread, onThreadUpdated, onTitleUpdate, folders, prefillMessage, onClearPrefill, onOpenDrawer, onOpenConnections, onBrowseExperts, onReopenHistory, attentionCount }: Props) {
  // Plan 075.4-01 D-075.4-A1: useMessages still exposes the viewed-thread
  // values (isStreaming, fallbackNotice) for back-compat — but the composer
  // disabled prop and per-thread surfaces go through the direct selectors
  // below so cross-thread isolation is preserved regardless of which thread
  // is currently being viewed.
  const {
    messages,
    loadMessages,
    sendMessage,
    clearMessages,
    setViewingThread,
    resumeFromFailed,
  } = useMessages()
  // Phase 196 Plan 07 (D-18 / BUG-260718-04) — THE COMPOSER'S PROVIDER/MODEL MACHINE LIVES
  // IN THE LEAF HOOK IMPORTED AT THE TOP OF THIS FILE. Five useState declarations
  // (providers, selectedProvider, models, selectedModel, deprecatedModels), the
  // getProviders load effect and the provider-change handler all moved there, taking this
  // file's `useState` 7 → 2 and `useEffect` 4 → 3. That reduction is how G-5 is honoured on
  // the ledger's strongest frontend extraction case: by arithmetic, not by argument. Do not
  // move this state back, and do not add a per-thread effect here — the restore rung lives
  // in the hook precisely so this file's counts stay where they landed.
  //
  // ⚠ The hook's name is spelled in exactly two places in this file — the import and the
  // destructure immediately below — and deliberately NOT in this sentence, so a raw
  // `grep -c` stays DISCRIMINATING and reads 2. Do not "tidy" this by naming it here.
  const {
    providers,
    selectedProvider,
    models,
    selectedModel,
    setSelectedModel,
    deprecatedModels,
    // Phase 249 (MODEL-05) — PASS-THROUGH ONLY. Three values read from the hook and handed to
    // MessageInput beside `deprecatedModels`. ⛔ This plan adds NO state hook and NO effect hook
    // to this file: its G-5 discharge is recorded as ARITHMETIC, and a derivation here would
    // spend that discharge on a prop pass.
    //
    // ⚠ The two hook names are deliberately NOT spelled in this comment. They are counted by a
    // raw `grep -c` over this file, so naming them in prose inflates the count and makes the
    // discharge unverifiable — a trap this file's own docblock already warns about, and one
    // this comment tripped on its first draft.
    verifiedModels,
    inferredProviderFor,
    toolsLostModels,
    handleProviderChange,
  } = useComposerModel(thread?.id ?? null, messages)
  const [agentMode, setAgentMode] = useState<"default" | "explorer">("default")
  const [scopeFolderId, setScopeFolderId] = useState<string | null>(null)
  // Phase 260 (PACK-02 / PACK-03): active expert consultant state
  const [activeExpert, setActiveExpert] = useState<ExpertBundle | null>(null)
  // Phase 267 plan 04 (D-267-12): the server's sentence when an Expert change is refused. One line
  // above the composer, cleared by the next change.
  const [expertChangeError, setExpertChangeError] = useState<string | null>(null)
  // Phase 268 (CHAT-08 · D-268-12c): the thread's at-rest ScopeEffect — the ONE payload the chip's
  // `held` reads. `null` = not loaded (the chip then claims nothing, S5).
  const [scopeEffect, setScopeEffect] = useState<ScopeEffect | null>(null)
  // Phase 268 (UI-SPEC §5.4): the receipt of a scope change made while THIS thread streams — the
  // transcript does not refetch mid-stream, so without it the change has no receipt at rest.
  const [scopePendingNote, setScopePendingNote] = useState<string | null>(null)
  const scopeReqRef = useRef(0)
  // Phase 267 plan 04 (D-267-16): the no-router door ChatLayout provides — `null` outside it, and
  // then no "New chat with …" control is offered at all.
  const threadNav = useThreadNavigation()
  const justCreatedThreadRef = useRef<string | null>(null)

  // Plan 075.4-01 D-075.4-A1: thread-scoped reads. The composer disable
  // (BUG-260523-01 close), MessageList streaming prop, and reconcile/
  // fallback banners all derive from THIS thread's state — Thread A
  // streaming no longer disables Thread B's composer.
  const isStreaming = useStreamingForThread(thread?.id ?? null)
  const fallbackNotice = useFallbackNoticeForThread(thread?.id ?? null)
  const reconcileError = useReconcileErrorForThread(thread?.id ?? null)
  // 099-08 (UAT L10): refusals the user cannot fix by retrying the SAME send —
  // the gate-refusal status set (400/403/404/422) + the 409 lock-refusal. The
  // banner hides Retry for these (Retry on a gate refusal is misleading).
  const NON_RETRYABLE = new Set([400, 403, 404, 409, 422])
  const hideRetry =
    reconcileError instanceof ApiError && NON_RETRYABLE.has(reconcileError.status)
  // 099-08 (UAT L10): the per-thread stashed prompt from a send refusal. When
  // present it pre-fills the composer (preferred over the parent prefill prop)
  // so the user's typed prompt is recoverable, then is cleared on consume.
  const failedDraft = useFailedSendDraftForThread(thread?.id ?? null)
  // Phase 092 (MODE-02 — SC#3): the per-thread workflow lock, keyed by the
  // OWNING thread id (thread?.id) — never viewedThreadId or a global flag, so a
  // background workflow on another thread cannot lock THIS composer. Drives the
  // disable-with-tooltip on both selectors (D-03/D-05).
  const workflowLock = useWorkflowLockForThread(thread?.id ?? null)
  // ── Phase 244-03 (SHELL-02 / BUG-260904-05 / D-244-08 arm 2) — A CAP-PAUSE IS NOT A
  //    RUNNING WORKFLOW, and the composer must be able to tell them apart.
  //
  // The shipped expression was `workflowLock !== null`. The reconcile branch at :184 below
  // sets a lock for a DEEP run paused at its iteration cap, so that read disabled the
  // composer the message on screen was telling the operator to use ("Start a new message to
  // keep going", MessageItem.tsx:576). The UI instructed an action it forbade.
  //
  // ⛔ C-1 — D-244-08's FIRST proposal is a NO-OP, recorded here beside the decision rather
  // than overwriting it. It offered `workflowLock?.mode === "harness"`. Measured:
  // `WorkflowLock.mode` is the LITERAL type `"harness"` (streamsStore.ts:89) with exactly one
  // member, and the cap-paused branch at :184-192 HARD-CODES `mode: "harness"` for a Deep
  // run — so that gate is TRUE for precisely the run it was meant to unlock. `capPaused` is
  // the only working discriminator on the shipped type, which is the decision's second arm.
  //
  // ⛔ NOTHING ELSE IN THE CHAIN CHANGES. MessageInput.tsx:287/337-339 key `canSend`, the
  // placeholder, the `title` and `disabled` off this ONE boolean, so D-244-10 ("the harness
  // copy is untouched") holds by construction rather than by a second branch — a genuine
  // harness run still reads "Workflow running — Cancel to switch back" on both axes.
  // Fenced in `__tests__/ChatArea.capPausedComposer.test.tsx`.
  //
  // ⚠ The CLIENT half alone would have shipped the same defect one level down: the server's
  // cap_paused read was unbounded in time, so the lock returned on the next reconcile. The
  // other half is in `backend/app/api/threads.py`'s `runs` probe.
  //
  // ── Phase 244-13 (review finding WR-07 / UAT gap G-1) — C-1's MEASUREMENT STANDS, AND
  //    THE TYPE IT MEASURED IS WHAT CHANGED ────────────────────────────────────────────
  //
  // ⛔ The C-1 paragraph directly above is KEPT VERBATIM rather than corrected, because it
  // was RIGHT when written: with `WorkflowLock.mode` a one-member literal and every writer
  // hard-coding it, `workflowLock?.mode === "harness"` really was a no-op. `244-13` made
  // `mode` a REAL discriminator (`streamsStore.ts` — `"harness" | "cap_paused"`, set from
  // the server's own `ThreadWorkflowState.mode` at all six write sites), which is what
  // makes `D-244-08`'s FIRST arm correct after all.
  //
  // ⛔ WHY THE SECOND ARM ALONE WAS NOT ENOUGH — this is WR-07, and it is a real hole
  // rather than a tidy-up. `workflowLock !== null && !workflowLock.capPaused` unlocks the
  // composer for a GENUINE harness run that is itself cap-paused. The person types, sends,
  // and `workflow_kickoff.preflight_workflow_kickoff:174` answers 409 "Thread is
  // workflow-locked" — the exact "UI instructs an action it forbids" inversion this phase
  // exists to remove, one branch over. ⚠ The RECONCILE route to that state is latent (no
  // writer of `'cap_paused'` onto `workflow_runs.status` was found), but the SSE route is
  // NOT: `StreamsProvider.tsx:1193`'s `onCapPaused` sets `capPaused: true` on whatever lock
  // the thread holds, including the kickoff-seeded harness lock. Site 1 now INHERITS
  // `"harness"` there, and this expression is what turns that inheritance into a locked
  // composer. Fenced by `__tests__/ChatArea.capPausedComposer.test.tsx` D5, and the writer
  // itself by `__tests__/ThreadRunLineKickoff.test.tsx` D5b(a).
  //
  // ⛔ NOTHING ELSE IN THE COMPOSER CHAIN CHANGES, still: `MessageInput.tsx:287/337-339`
  // key `canSend`, the placeholder, the `title` and `disabled` off this ONE boolean, so
  // D-244-10 holds by construction rather than by a second branch.
  const workflowLocked = workflowLock !== null && workflowLock.mode === "harness"
  const streamActions = useStreamActions()
  // Phase 068.5 Gap-01: true when this thread has a loadMessages fetch in
  // flight. Passed to MessageList so the cold-load skeleton only renders when
  // we're actually waiting on data (not on new/empty threads with no fetch).
  // Plan 075.4-01 D-075.4-A1: thread-scoped loadingThreads selector.
  const isLoadingThisThread = useLoadingForThread(thread?.id ?? null)
  const handleRetryReconcile = useCallback(() => {
    // Plan 075.4-01 D-075.4-A1: per-thread reconcileErrors — clear this
    // thread's entry only (no cross-thread bleed).
    if (thread) {
      useStreamsStore.setState((s) => {
        if (!s.reconcileErrors.has(thread.id)) return {}
        const next = new Map(s.reconcileErrors)
        next.delete(thread.id)
        return { reconcileErrors: next }
      })
      loadMessages(thread.id).catch(console.error)
    }
  }, [thread, loadMessages])
  const dismissReconcileError = useCallback(() => {
    // Plan 075.4-01 D-075.4-A1: per-thread reconcileErrors clear.
    if (!thread) return
    useStreamsStore.setState((s) => {
      const hasErr = s.reconcileErrors.has(thread.id)
      // 099-08 (UAT L10): clear the stashed draft symmetrically so dismissing
      // the banner does not leave a stale draft that re-fills the composer.
      const hasDraft = s.failedSendDrafts.has(thread.id)
      if (!hasErr && !hasDraft) return {}
      const patch: Partial<typeof s> = {}
      if (hasErr) {
        const next = new Map(s.reconcileErrors)
        next.delete(thread.id)
        patch.reconcileErrors = next
      }
      if (hasDraft) {
        const nextDrafts = new Map(s.failedSendDrafts)
        nextDrafts.delete(thread.id)
        patch.failedSendDrafts = nextDrafts
      }
      return patch
    })
  }, [thread])

  useEffect(() => {
    setAgentMode("default")
    setScopeFolderId(null)
    // 267-REVIEW WR-02: a refusal is about the thread it was made on, never the next one.
    setExpertChangeError(null)
    // Phase 268: a scope payload and its pending note are about the thread they were read on.
    setScopeEffect(null)
    setScopePendingNote(null)
  }, [thread?.id])

  /**
   * Phase 268 (D-268-12c) — read the thread's at-rest ScopeEffect. Latest wins: a slow answer for a
   * previous thread or state is dropped. A failed read leaves the chip claiming nothing (S5). The
   * call is made inside the promise chain so a synchronous throw is a rejection, never a crash.
   */
  const refreshScopeEffect = useCallback((tid: string): Promise<ScopeEffect | null> => {
    const req = ++scopeReqRef.current
    return new Promise<ScopeEffect>((resolve) => resolve(getScopeEffect(tid)))
      .then((effect) => {
        if (req === scopeReqRef.current) setScopeEffect(effect)
        return effect
      })
      .catch((err) => {
        console.error("Failed to read the thread's scope:", err)
        if (req === scopeReqRef.current) setScopeEffect(null)
        return null
      })
  }, [])

  // Re-read on load and whenever the server's thread changes its folder or its Expert.
  useEffect(() => {
    if (thread?.id) void refreshScopeEffect(thread.id)
  }, [thread?.id, thread?.folder_id, thread?.active_expert_id, refreshScopeEffect])

  // UI-SPEC §5.4: the pending note clears when that run ends (the run-end reconcile brings the card).
  useEffect(() => {
    if (!isStreaming) setScopePendingNote(null)
  }, [isStreaming])

  // Phase 260 (PACK-02 / PACK-03): sync active expert consultant with thread
  useEffect(() => {
    const expertId = thread?.active_expert_id
    if (!expertId) {
      setActiveExpert(null)
      return
    }
    let cancelled = false
    getExpert(expertId)
      .then((exp) => {
        if (!cancelled) setActiveExpert(exp)
      })
      .catch((err) => {
        console.error("Failed to load active expert:", err)
      })
    return () => {
      cancelled = true
    }
  }, [thread?.id, thread?.active_expert_id])

  // Phase 092 (SC#5 / D-v2.5-03): mount-time reconcile of the workflow lock +
  // Continue state from GET /threads/{id}/workflow — the SOURCE OF TRUTH, never
  // a stale Realtime/SSE hint. Runs on every thread switch. A locked, non-stale
  // run sets the per-thread lock (keyed by THIS thread id); a stale/terminal
  // anchor or Deep mode clears it. This is what survives a page reload (SC#5).
  useEffect(() => {
    const tid = thread?.id
    if (!tid) return
    const controller = new AbortController()
    getThreadWorkflow(tid, controller.signal)
      .then((state) => {
        if (controller.signal.aborted) return
        if (state.locked && !state.lock_is_stale && state.active_workflow_run_id) {
          streamActions.setWorkflowLockForThread(tid, {
            runId: state.active_workflow_run_id,
            // 244-13 — WRITE SITE 5 of 6. Genuinely harness, said EXPLICITLY: this arm
            // requires a live, non-stale `active_workflow_run_id`, which is the server's
            // own definition of harness (`threads.py:1195`).
            mode: "harness",
            // ⛔ ALWAYS `false` ON THIS BRANCH — `T-244-03-01` / 244-08. This read
            // `capPaused: state.cap_paused`, and `244-03`'s own declared mitigation says the
            // discriminator is *"set only on the `state.cap_paused` reconcile branch"* below.
            // It was set on both, and `workflowLocked` at :140 is
            // `workflowLock !== null && !workflowLock.capPaused` — so a run that is locked AND
            // paused UNLOCKED THE COMPOSER MID-RUN.
            //
            // ⚠ THAT STATE IS LATENT, NOT IMPOSSIBLE, WHICH IS WHY THIS IS FAIL-CLOSED RATHER
            // THAN DELETED AS UNREACHABLE. No writer of `'cap_paused'` onto
            // `workflow_runs.status` has been found — but the value is schema-valid
            // (`063_dual_mode_continue.sql:57` adds it to BOTH status columns),
            // `threads.py:1238` sets `cap_paused` straight off that column, and
            // `_TERMINAL_WORKFLOW_STATUSES` (`threads.py:1095`) does not contain it. So the
            // server can answer `locked: true, cap_paused: true` today.
            //
            // ⚠ WHAT IT COSTS IF THAT ARM EVER GOES LIVE, stated rather than discovered later:
            // a harness run paused at its own cap keeps the composer locked, so the person
            // clicks Cancel instead of typing. That is the cheap direction. Unlocking during a
            // live harness run is the elevation this threat names — and the ordinary Deep
            // cap-pause, which is the case `BUG-260904-05` was actually about, has no
            // `active_workflow_run_id` and so still takes the branch below.
            capPaused: false,
            continuesRemaining: state.continues_remaining,
          })
        } else if (state.cap_paused) {
          const runId = (state.active_workflow_run_id || state.latest_producer_run_id || "") as string
          if (runId) {
            streamActions.setWorkflowLockForThread(tid, {
              runId,
              // ⛔ 244-13 — WRITE SITE 6 of 6, AND THE PHANTOM'S SOURCE. This line used to
              // hard-code the harness discriminator (named by ROLE, not respelled — a prose
              // copy moves the acceptance grep, the 187-24 lesson) for a DEEP run that has
              // no workflow and never had one. That is what `244-PATTERNS.md` C-1 measured,
              // and what made UAT gap G-1's phantom live run line render 41px under a card
              // saying the run is stopped.
              // DERIVED FROM THE WIRE — `threads.py:1195` already computed it; a second
              // client-side derivation of one fact is how the drift happened.
              mode: state.mode === "harness" ? "harness" : "cap_paused",
              capPaused: true,
              continuesRemaining: state.continues_remaining,
            })
          } else {
            streamActions.clearWorkflowLockForThread(tid)
          }
        } else {
          // Deep, or a stale/terminal anchor (SC#5 self-heal) — never leave a
          // dangling lock on this thread.
          streamActions.clearWorkflowLockForThread(tid)
        }
      })
      .catch((err) => {
        if (!(err instanceof Error && err.name === "AbortError")) {
          console.error("getThreadWorkflow reconcile failed:", err)
        }
      })
    return () => controller.abort()
  }, [thread?.id, streamActions])

  // D-067.2-02 / Phase 068 D-068-07/D-068-08: useLayoutEffect commits the
  // activeThreadIdRef write SYNCHRONOUSLY (inside <StreamsProvider>'s
  // setViewingThread action) after DOM mutation but BEFORE any sibling
  // useEffect runs. Two guarantees flow from that:
  //   1. activeThreadIdRef.current === thread.id before the provider's
  //      reconciliation listeners can fire — the D-068-08 null-gate never
  //      spuriously short-circuits on a real thread switch.
  //   2. setViewingThread's own reconciliation fire (Phase 068 Task 2c —
  //      lives in StreamsProvider.tsx now, NOT in this component) sees the
  //      freshly written ref, so guardedSetMessages at the provider's
  //      bucket writer does NOT no-op the replay-from-offset-0 events on
  //      F5 / mid-stream navigation.
  // D-068-07 / D-068-08: reconciliation listeners + the per-thread-change
  // reconciliation fire live inside <StreamsProvider>; this component owns
  // only the setViewingThread call below (Phase 068 Plan 3 deleted
  // ChatArea's listener block — D-068-07 single-owner gate).
  // D-060-08: setViewingThread remains the SOLE writer of activeThreadIdRef
  // per D-060-01 (assignment count == 1, enforced by Plan 1 Task 3 grep gate).
  useLayoutEffect(() => {
    setViewingThread(thread?.id ?? null)
  }, [thread?.id])

  useEffect(() => {
    if (!thread) {
      clearMessages()
      return
    }
    // Skip clear+load when handleSend just created this thread — sendMessage is
    // already streaming into it and clearMessages() would wipe the optimistic
    // messages, causing a blank chat.
    if (justCreatedThreadRef.current === thread.id) {
      justCreatedThreadRef.current = null
      return
    }
    // D-063.1-07 / Gap-003 (PRESERVED — DO NOT RE-ADD abortStream() HERE):
    // abortStream() is DELIBERATELY NOT called in this effect. Letting the
    // in-flight sendMessage SSE consumer survive thread switch is load-bearing:
    // the consumer keeps writing through the guardedSetMessages no-op
    // (D-063.1-08) until the user navigates back. Cleanup of consumer-side
    // sockets remains owned by:
    //   1. loadAbortRef.current?.abort() inside loadMessages — cancels stale
    //      getMessages fetches; UNCHANGED.
    //   2. Hook unmount effect (useMessages.ts) — aborts all subscriptions
    //      on hook teardown (logout/route); UNCHANGED.
    //   3. onTerminal cleanup in sendMessage / reconcile — deletes from
    //      subscriptionsRef when SSE actually terminates server-side; UNCHANGED.
    // abortStream STAYS exported from useMessages — still used by genuine
    // timeout cases (loadMessages's loadAbortRef path).
    //
    // Phase 067.3 (D-067.3-R1-01) per-thread store now LIVE: useMessages.ts
    // holds messagesByThread: Map<string, Message[]>. Deltas write to their
    // streamingThreadIdRef bucket regardless of viewing thread; the visible
    // `messages` array derives via useMemo against viewedThreadId. The race
    // this comment used to flag (cross-thread switch loses streamed-into
    // thread's render) is structurally closed.
    //
    // Phase 068.5 (RESEARCH §Finding #5): clearMessages() DELETED here.
    // bucketsBySurface is per-thread keyed (Phase 067.3 D-067.3-R1-01) — the
    // new viewing thread reads from its own bucket entry; the old viewing
    // thread's bucket entry stays warm for switch-back. Branch D-3 guard at
    // StreamsProvider.tsx:411-427 protects streaming buckets; reconcile-merge
    // at the loadMessages call below (L-068.5-02 MERGE 3-clause filter)
    // replaces stale non-streaming non-temp DB rows on the server response.
    // The unconditional clearMessages() was the literal in-app cause of the
    // BUG-260513-01 blank window. Deletion regression cost: zero — no
    // existing test asserts the call (verified during Plan 01 authoring).
    //
    // Phase 075.1 Plan 04 — Test 2 / MESSAGES-DEBUG agent's single-line fix
    // (Test 2 dual-`/messages` after `/snapshot` closure):
    // setViewingThread (in StreamsProvider) already fires reconcile internally
    // (StreamsProvider.tsx:495-501 — Phase 068 Task 2c). The prior
    // loadMessages(thread.id) here was a duplicate trigger producing a second
    // /messages request per thread switch. Snapshot-based reconcile is now
    // the sole data source post-Phase-075 — the dedicated /messages endpoint
    // is no longer called from ChatArea on mount. Retry handler at line ~61
    // still calls loadMessages for the manual Retry button — intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread?.id])

  // Phase 068 Plan 3 (D-068-07 / D-068-08): the reconciliation listeners and
  // the per-thread-change reconciliation fire moved into <StreamsProvider>
  // (see StreamsProvider.tsx — the listener useEffect near the bottom of the
  // component, plus the setViewingThread action body). The provider is now
  // the SOLE owner of those listeners (Phase 063 Pattern 2 + CONTEXT.md
  // "Reconciliation Hook Ordering" mandate satisfied at the provider
  // boundary). The old WR-07/WR-08 ref indirection ChatArea used to keep
  // listener identities stable is obsolete: post-lift, `reconcile` is a
  // Zustand action with stable identity, and the listener wiring no longer
  // lives in this component anyway. The `reconcile` destructure was dropped
  // from the useMessages() call above — no remaining consumer in this file.

  // Plan 075.4-04 D-075.4-SC#6 — stabilize callbacks for React.memo(MessageItem)
  // shallow-eq path. handleSend is the chat-input wired callback; onSendMessage
  // is the stable identity passed to MessageList → MessageItem (suggestion
  // pill onSelect). onResume mirrors the same useCallback-stabilization
  // pattern for the Resume button on failed/timed_out assistant messages.
  const handleSend = useCallback(async (content: string, activeConnectorIds?: string[]) => {
    let activeThread = thread
    if (!activeThread) {
      // Phase 267 plan 04 (D-267-21): the Expert invited on this brand-new chat travels WITH the
      // create, so the thread exists scoped before the first run starts.
      try {
        activeThread = await onCreateThread(scopeFolderId, activeExpert?.id ?? null)
      } catch (err) {
        // 267-REVIEW WR-01: POST /threads runs the binding gate, so an ordinary gate outcome (no
        // org, tier, revoked access) refuses the create. State the server's sentence and resolve
        // `false` — "not sent" — so the composer puts the typed message back. Nothing is sent.
        setExpertChangeError(
          err instanceof Error && err.message.trim() ? err.message : "The chat could not be created.",
        )
        return false
      }
      justCreatedThreadRef.current = activeThread.id
      // D-067.2-01: synchronously align activeThreadIdRef BEFORE sendMessage
      // begins. sendMessage sets streamingThreadIdRef.current = threadId at
      // useMessages.ts:513 and the first onDelta arrives ms later;
      // guardedSetMessages at useMessages.ts:623-628 no-ops the delta unless
      // streamingThreadIdRef === activeThreadIdRef. Without this line the
      // useLayoutEffect at the top of this component does not fire until the
      // parent re-renders with the new `thread` prop (50-500ms after
      // onCreateThread resolves), and every delta in the gap is silently
      // dropped — the empty-until-end-of-run user-observable failure.
      //
      // Phase 176-04 (RENDER-03 / D-10.1): mark the just-created thread pending-send
      // BEFORE setViewingThread fires its reconcile, so that nav reconcile preserves
      // the optimistic temp sendMessage is about to write. markThreadPendingSend adds
      // ONLY to pendingSendThreadsRef (not sendingThreadsRef), so sendMessage's
      // duplicate-guard is untripped and the real send below still dispatches; the
      // provider releases the pending flag when the send resolves/aborts.
      streamActions.markThreadPendingSend(activeThread.id)
      setViewingThread(activeThread.id)
    }
    await sendMessage(
      activeThread.id,
      content,
      selectedModel || undefined,
      onTitleUpdate,
      agentMode,
      selectedProvider || undefined,
      undefined,
      activeConnectorIds,
    )
  }, [thread, scopeFolderId, activeExpert, onCreateThread, selectedModel, onTitleUpdate, agentMode, selectedProvider, sendMessage, setViewingThread, streamActions])

  // Phase 260 (PACK-03 / D-260-07): 1-click execution for action tiles
  const handlePromptSelect = useCallback(
    (prompt: string) => {
      void handleSend(prompt)
    },
    [handleSend],
  )

  /**
   * Phase 267 plan 04 (PACK-23 · D-267-12) — THE ONE HOME of every Expert change on a thread.
   *
   * Add, swap and remove all land here: the composer and the spotlight only REPORT a choice. With a
   * thread, the PATCH is sent once; a refusal reverts the chip to the Expert that is still bound
   * and states the server's own sentence. A success refetches the transcript so the persisted
   * event row (written in the same transaction as the change) appears without a reload — except
   * while THIS thread is streaming, where a refetch would race the live bucket and the run-end
   * reconcile brings the row in (RESEARCH pitfall 11). Without a thread there is nothing to write:
   * the choice rides the create call (D-267-21).
   */
  const applyExpertChange = useCallback(
    async (next: ExpertBundle | null) => {
      const previous = activeExpert
      const tid = thread?.id
      // 267-REVIEW WR-04: while THIS thread streams, a change would be recorded ABOVE the answer
      // the current Expert is still producing. Refused here with a visible reason (the server
      // answers 409 for the same state), and nothing on the chip moves.
      if (tid && useStreamsStore.getState().streamingThreads.has(tid)) {
        setExpertChangeError(PREVIEW_COPY.waitForAnswer)
        return
      }
      setExpertChangeError(null)
      setActiveExpert(next)
      if (!tid) return
      try {
        // 267-REVIEW CR-01: the answer is the thread as the server now holds it. It goes back to
        // the list owner, or returning to this thread would hydrate the Expert it no longer has.
        const updated = await setThreadActiveExpert(tid, next?.id ?? null)
        onThreadUpdated?.(updated)
      } catch (err) {
        setActiveExpert(previous)
        setExpertChangeError(
          err instanceof Error && err.message.trim() ? err.message : "The Expert could not be changed.",
        )
        return
      }
      // Phase 268 (§6.2): the Expert changes what the thread's folder does — a Restricted Expert
      // leaving returns the chip to S1 with the saved folder. No second scope card is written.
      void refreshScopeEffect(tid)
      if (!useStreamsStore.getState().streamingThreads.has(tid)) {
        loadMessages(tid).catch(console.error)
      }
    },
    [activeExpert, thread?.id, loadMessages, onThreadUpdated, refreshScopeEffect],
  )

  /**
   * Phase 268 (CHAT-08 · D-268-12 / D-268-12a / D-268-12d / D-268-23) — THE ONE HOME of a scope
   * change on a thread, beside the Expert one.
   *
   * ⛔ NO STREAMING REFUSAL, unlike the Expert arm above: research proved the loop reads the thread's
   * folder once per run, so a change applies from the NEXT message and the answer in progress keeps
   * its scope (a `cap_paused` run's Continue picks the new scope up, D-268-23). The server records
   * `during_run` so the card says so.
   *
   * A refusal REJECTS with the reason sentence — the picker states it, and the chip never moved.
   * Success → the server's thread to the list owner, the ScopeEffect re-read, then the transcript
   * refetch (the persisted card) — except while THIS thread streams, where a refetch would race the
   * live bucket (267 pitfall 11); the pending note is the receipt until that run ends.
   */
  const applyScopeChange = useCallback(
    async (next: string | null) => {
      const tid = thread?.id
      if (!tid) return
      const before = chipLabel(thread?.folder_id ?? null, folders).full
      let updated: Thread
      try {
        updated = await setThreadFolder(tid, next)
      } catch (err) {
        throw new Error(
          err instanceof ApiError && err.message.trim() ? err.message : SCOPE_COPY.networkReason,
        )
      }
      onThreadUpdated?.(updated)
      const effect = refreshScopeEffect(tid)
      if (useStreamsStore.getState().streamingThreads.has(tid)) {
        const after = chipLabel(next, folders).full
        const held = await effect
        setScopePendingNote(
          held?.held && held.expert
            ? SCOPE_COPY.pendingHeld(after, held.expert.name)
            : SCOPE_COPY.pending(before, after),
        )
      } else {
        loadMessages(tid).catch(console.error)
      }
    },
    [thread?.id, thread?.folder_id, folders, onThreadUpdated, refreshScopeEffect, loadMessages],
  )

  const handleDismissExpert = useCallback(() => {
    void applyExpertChange(null)
  }, [applyExpertChange])

  /**
   * Phase 267 plan 04 (PACK-24 · D-267-14 / D-267-16) — "New chat with <Expert>": ONE request, then
   * the list is refreshed BEFORE the new thread is opened (the `startScopedChat` order — a selected
   * row the list does not hold yet would disagree with the server). A refusal propagates to the
   * dialog, which states it; nothing navigates. ⛔ Once the server has created the thread, a failed
   * list refresh must NOT surface as a refusal ("nothing was created" would be false) — the new
   * thread is still opened.
   */
  const handleExpertHandoff = useCallback(
    async (expert: ExpertBundle) => {
      if (!thread?.id || !threadNav) return
      const created = await handoffThread(thread.id, expert.id, {
        model: selectedModel || undefined,
        provider: selectedProvider || undefined,
      })
      try {
        await threadNav.refreshThreads()
      } catch (err) {
        console.error("Thread list refresh after handoff failed:", err)
      }
      threadNav.openThread(created)
    },
    [thread?.id, threadNav, selectedModel, selectedProvider],
  )

  // Plan 075.4-04 D-075.4-SC#6 — onSendMessage is the stable identity passed
  // to MessageList → MessageItem (SuggestionPills onSelect). Wraps handleSend
  // unchanged; rename-to-onSendMessage solely so the memo'd MessageItem sees a
  // ref-stable prop across parent re-renders.
  const onSendMessage = useCallback(
    (content: string) => { void handleSend(content) },
    [handleSend],
  )

  // Plan 075.4-04 D-075.4-SC#6 — onResume stabilization. resumeFromFailed
  // already has stable identity from the StreamsProvider Zustand action layer,
  // but wrapping in useCallback here makes the dependency contract explicit
  // and protects against future re-binding inside the provider.
  const onResume = useCallback(
    (message: Parameters<typeof resumeFromFailed>[0]) => resumeFromFailed(message),
    [resumeFromFailed],
  )

  // Phase 224 Plan 03 (BUG-260902-04 / D-224-02):
  // Dock pending approval card directly above MessageInput so it is always reachable in the viewport.
  const [settledCallIds, setSettledCallIds] = useState<Set<string>>(() => new Set())

  const pendingApproval = useMemo(() => {
    if (!isStreaming) return null
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.toolApproval && !m.toolApproval.decision && !settledCallIds.has(m.toolApproval.callId)) {
        return m.toolApproval
      }
    }
    return null
  }, [messages, isStreaming, settledCallIds])

  const handleApprovalDecision = useCallback(
    (decision: ApprovalDecision) => {
      if (pendingApproval) {
        pendingApproval.decision = decision
        setSettledCallIds((prev) => new Set(prev).add(pendingApproval.callId))
      }
    },
    [pendingApproval],
  )

  // Plan 075.4-01 D-075.4-A1: thread-scoped composer enablement; closes
  // BUG-260523-01 at the `disabled` prop below. `isStreaming` here is the
  // value of useStreamingForThread(thread?.id ?? null) (declared at the top
  // of this component), so Thread A streaming will NOT disable Thread B's
  // composer.
  // Phase 267 plan 04: what the invite dialog states about this chat before an invite.
  const dialogFolderId = thread ? thread.folder_id : scopeFolderId
  const dialogFolderName = dialogFolderId
    ? (folders.find((f) => f.id === dialogFolderId)?.name ?? "Folder")
    : null
  const inputBar = (
    <>
    {expertChangeError && (
      <div
        data-testid="expert-change-error"
        role="alert"
        className="mx-4 mb-2 p-3 text-xs rounded-lg bg-destructive/10 border border-destructive/30 text-destructive"
      >
        {expertChangeError}
      </div>
    )}
    <MessageInput
      activeExpert={activeExpert}
      onActiveExpertChange={(exp) => void applyExpertChange(exp)}
      threadFolderName={dialogFolderName}
      // 267-REVIEW WR-07: the folder id too, so a brand-new chat's preview states its real cost.
      threadFolderId={dialogFolderId}
      hasMessages={messages.some((m) => m.role === "user" || m.role === "assistant")}
      onExpertHandoff={thread && threadNav ? handleExpertHandoff : undefined}
      onOpenConnections={onOpenConnections}
      onBrowseExperts={onBrowseExperts}
      // Phase 268 (D-268-12d): the scope chip — only on an existing thread; a new chat keeps the
      // shipped `<select>` below. Its words come from the server's ScopeEffect.
      scopeSlot={
        thread ? (
          <ScopeChip
            threadId={thread.id}
            folderId={thread.folder_id ?? null}
            folders={folders}
            effect={scopeEffect}
            streaming={isStreaming}
            onApply={applyScopeChange}
          />
        ) : undefined
      }
      scopeNote={
        thread && scopePendingNote ? (
          <div
            data-testid="scope-pending-note"
            role="status"
            aria-live="polite"
            className="flex items-center gap-1 px-4 pt-1 text-[11px] leading-snug text-amber-700 dark:text-amber-300"
          >
            <Clock className="h-3 w-3 flex-none" aria-hidden="true" />
            {scopePendingNote}
          </div>
        ) : undefined
      }
      onSend={handleSend}
      /* Phase 194.1 Plan 04 (RUN-01 / D-05/D-22) — THE STOP-DISPATCHER PROP IS GONE
         from this element. The composer's Stop is `StopControl` (written WITHOUT its
         JSX angle bracket on purpose — that token is a fence needle counting real
         mounts, and this page must contain zero), which calls
         `stopThread(threadId)` off the StreamsProvider store; this page no longer
         threads a dispatcher down, and `stopStreaming` is no longer destructured
         from `useMessages` above.

         ⚠ The prop's name is spelled nowhere in this file, including in this
         sentence explaining its absence — so a raw grep for it stays DISCRIMINATING
         and any occurrence means it came back. Same discipline as `MessageInput`'s
         `Props` docblock; do not "tidy" this by naming it.

         ⚠ `stopStream` itself SURVIVES on `useMessages`' action surface — removing
         it is a Deep-path change, deferred with the trigger *"a phase that touches
         `useMessages`' action surface"*. */
      disabled={isStreaming}
      threadId={thread?.id ?? null}
      messages={messages}
      providers={providers}
      selectedProvider={selectedProvider}
      onProviderChange={handleProviderChange}
      models={models}
      selectedModel={selectedModel}
      onModelChange={setSelectedModel}
      deprecatedModels={deprecatedModels}
      verifiedModels={verifiedModels}
      inferredProviderFor={inferredProviderFor}
      toolsLostModels={toolsLostModels}
      agentMode={agentMode}
      onAgentModeChange={setAgentMode}
      prefillMessage={failedDraft ?? prefillMessage}
      onClearPrefill={() => {
        // 099-08 (UAT L10): clear the stashed draft once the composer consumes
        // it so it pre-fills exactly once per refusal (not on every render).
        if (thread?.id) {
          useStreamsStore.setState((s) => {
            if (!s.failedSendDrafts.has(thread.id)) return {}
            const next = new Map(s.failedSendDrafts)
            next.delete(thread.id)
            return { failedSendDrafts: next }
          })
        }
        onClearPrefill?.()
      }}
      workflowLocked={workflowLocked}
    />
    </>
  )

  // Phase 156 REFINEMENT: the ▷ "Show chat history" handle (sketch #reopenA). Desktop-
  // only (mobile uses the drawer); rendered only when the history is collapsed
  // (onReopenHistory provided). Reused in both the welcome and the active-thread header.
  const reopenHistoryButton = onReopenHistory ? (
    <button
      type="button"
      onClick={onReopenHistory}
      title="Show chat history"
      aria-label="Show chat history"
      className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <PanelLeftOpen className="w-[18px] h-[18px]" aria-hidden="true" />
    </button>
  ) : null

  // Phase 235 plan 09 (SURF-03): the closed-drawer signal. `NavPanel` is `hidden md:flex`, so
  // at mobile width the rail badge does not exist — the control that OPENS the drawer is the
  // only thing on screen that can say something needs a person. One element, defined once,
  // mounted at the two shipped drawer-trigger sites.
  //
  // ⛔ `aria-hidden`: the triggers carry `aria-label="Open navigation"` and a dot must not
  // rename them. It carries no count and no word — the drawer's own Library badge carries the
  // number, and this one only has to be noticeable enough to make somebody open the drawer.
  // The warning tone, never the danger one.
  const attentionDot = (attentionCount ?? 0) > 0 ? (
    <span
      data-testid="drawer-trigger-dot"
      aria-hidden="true"
      className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-warning ring-2 ring-background"
    />
  ) : null

  if (!thread) {
    return (
      // Phase 244-01 (SHELL-01): the WELCOME branch is the same column root as the thread
      // branch below and carries the same link-4 obligation. ⚠ Found by the fence, not by
      // the plan — `ChatArea.tsx` has TWO roots with this class list and the plan named one.
      <div className="flex flex-col h-full min-h-0 bg-background">
        {/* Phase 156 REFINEMENT: desktop reopen handle for the welcome state — only when
            history is collapsed (so an empty chat can still bring the list back). */}
        {reopenHistoryButton && (
          <div className="hidden md:flex px-4 py-2 items-center border-b border-border/30">
            {reopenHistoryButton}
          </div>
        )}
        {/* Mobile nav trigger for welcome state */}
        <div className="md:hidden px-4 py-2 flex items-center border-b border-border/30">
          <button
            type="button"
            className="relative flex items-center justify-center w-11 h-11 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            aria-label="Open navigation"
            onClick={onOpenDrawer}
          >
            <Menu className="w-5 h-5" />
            {attentionDot}
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
          {activeExpert ? (
            <div className="w-full max-w-2xl animate-fadeSlideUp">
              <ExpertSpotlightCard
                expert={activeExpert}
                onSelectPrompt={handlePromptSelect}
                onDismiss={handleDismissExpert}
                // 267-REVIEW WR-06 (D-267-35): no folder picked → state the biased narrowing.
                unscopedChat={!scopeFolderId}
              />
            </div>
          ) : (
            <div className="text-center space-y-5 max-w-md px-6 animate-fadeSlideUp">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="font-headline font-bold text-xl text-foreground">How can I help you?</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Ask me anything, or upload documents and I'll answer based on their content.
                </p>
              </div>
              {folders.length > 0 && (
                <div className="mt-3">
                  <select
                    value={scopeFolderId ?? ""}
                    onChange={(e) => setScopeFolderId(e.target.value || null)}
                    className="text-sm rounded-lg px-4 py-2 bg-card text-foreground ghost-border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                  >
                    <option value="">All documents</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    Scope this conversation to a specific folder
                  </p>
                </div>
              )}

              {/* Phase 216 (CAT-04): Starter Prompts */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => void handleSend("Search recent files in connected cloud storage and summarize key points")}
                  className="text-xs bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full border border-border/50 transition-colors"
                >
                  📁 Search connected files
                </button>
                <button
                  type="button"
                  onClick={() => void handleSend("Draft a team status update")}
                  className="text-xs bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full border border-border/50 transition-colors"
                >
                  💬 Draft a team update
                </button>
              </div>
            </div>
          )}
        </div>
        {inputBar}
      </div>
    )
  }

  return (
    // Phase 244-01 (SHELL-01 / BUG-260828-08): link 4 of the four-link `min-h-0` chain
    // (ChatLayout's grid track and <main> are 2 and 3; MessageList's ScrollArea is 5).
    // `h-full` sets this column's height, but its own flex CHILD — the message list — has
    // `min-height: auto` unless this container's chain is zeroed, so the column grew to the
    // transcript and the page root scrolled. Analog: DocumentDetailPanel.tsx:257.
    <div className="flex flex-col h-full min-h-0 bg-background">
      <div className="px-6 py-3 bg-background/80 backdrop-blur-md flex items-center gap-2.5 border-b border-border/30">
        {/* Phase 156 REFINEMENT: the ▷ reopen-history handle (desktop, collapsed-only). */}
        {reopenHistoryButton}
        {/* Mobile menu trigger */}
        <button
          type="button"
          className="relative md:hidden flex items-center justify-center w-11 h-11 rounded-xl text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          aria-label="Open navigation"
          onClick={onOpenDrawer}
        >
          <Menu className="w-5 h-5" />
          {attentionDot}
        </button>
        <h2 className="font-headline font-semibold text-sm truncate text-foreground">{thread.title}</h2>
        {/* Phase 268 (UI-SPEC §9-D6): the header folder pill is REMOVED — the composer's scope chip
            is the one home of scope. The pill could not express `held`, so under a Restricted
            Expert it named a folder that is not searched, beside a chip that says it is not. */}
        {/* Phase 087-08 (operator directive 2026-05-29): the chat-header
            "Toggle workspace" button was REMOVED. The workspace panel now has a
            single nav-style in-panel toggle (collapse-to-rail); the always-present
            rail's Expand control is the sole reopen-by-mouse affordance and hosts
            the pulsing-amber-dot pending indicator. No workspace control lives in
            the chat header. */}
      </div>
      {fallbackNotice && (
        <div className="text-xs text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-md mx-3 my-1">
          {fallbackNotice}
        </div>
      )}
      {/* Phase 068.5 D-068.5-08..10: silent-1s-then-banner retry banner. Renders
          over cached content when loadMessages fails twice in a row. Dismissable
          (Retry re-fires reconcile; × clears state). Pattern S2 amber-400 chrome,
          sibling of fallbackNotice slot.

          Plan 075.4-01 D-075.4-A1: thread-scoped useReconcileErrorForThread
          returns null for any thread other than thread?.id by construction
          (per-thread Map keyed by threadId), so the legacy
          threadId-equality predicate is no longer needed. The selector
          naturally scopes — no cross-thread bleed. */}
      {reconcileError && (
        <div
          className="text-xs text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-md mx-3 my-1 flex items-center justify-between"
          data-testid={
            reconcileError instanceof ApiError && reconcileError.status === 409
              ? "workflow-lock-error-banner"
              : "reconcile-error-banner"
          }
          role="status"
          aria-live="polite"
        >
          {/* 099-08 (UAT L10): any ApiError (the 409 lock copy OR a server gate
              detail, e.g. a disabled-skill 400) shows its server-provided
              message. Rendered as React text children — never HTML
              (T-099-08-01). A plain reconcile Error (no status) keeps the
              cached-version copy + Retry. */}
          {/* Phase 244-11 (SHELL-01 / UAT gap G-3): the non-ApiError arm's sentence is a
              claim ABOUT THE SCREEN, so it depends on what is actually on it. With an
              EMPTY transcript there is no cached version, and telling the person there is
              one is how BUG-260911-02's reporter read an empty pane as an empty
              conversation and typed into it. ⛔ ONE new state only — the non-empty
              sentence is byte-unchanged, and the ApiError arm (099-08's server-detail
              copy, T-099-08-01) is untouched. ⛔ The literal names no status code, no
              exception type and no dependency: say what is true of the THING, never what
              the code experienced. `messages` is the same value the composer and
              MessageList already read — no new state, no new effect, no new prop. */}
          <span>
            {reconcileError instanceof ApiError
              ? reconcileError.message
              : messages.length === 0
                ? "Couldn't load this conversation. It's still there — try again."
                : "Couldn't load latest messages. Showing cached version."}
          </span>
          <span className="flex gap-2 items-center">
            {!hideRetry && (
              <button
                type="button"
                onClick={handleRetryReconcile}
                className="underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 rounded px-1"
                aria-label="Retry loading messages"
              >
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={dismissReconcileError}
              className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40 rounded px-1"
              aria-label="Dismiss"
            >
              ×
            </button>
          </span>
        </div>
      )}
      {/* Phase 194.1 Plan 06 (RUN-01 / D-15) — `threadId` is the ONE prop this plan
          threads, and it is the SAME expression this file already computes for the
          composer one screen up and for every per-thread store selector at the top of
          the component. Reused rather than re-derived, so the transcript and the
          composer can never disagree about which thread they are looking at.

          It is what lets `MessageList` mount the run-anchored line at LIST level. No
          state is added here: the line owns its own read and its own clock, which is
          why this file's `useState` / `useEffect` counts were unmoved by Phase 194.1.

          ⚠ THE FIGURE THIS SENTENCE USED TO QUOTE — "unmoved at 7 / 4" — IS NO LONGER THE
          READING, and it is corrected here rather than left to rot, because on this file the
          measurement IS the guardrail: a stale count answers the next auditor with a number
          that was true once and stops the audit. Phase 196-07 took the composer's
          provider/model machine out to a leaf hook, so the counts are now `useState` 2 and
          `useEffect` 3. Re-derive them, never copy them forward. */}
      {activeExpert && messages.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl animate-fadeSlideUp">
            <ExpertSpotlightCard
              expert={activeExpert}
              onSelectPrompt={handlePromptSelect}
              onDismiss={handleDismissExpert}
              // 267-REVIEW WR-06 (D-267-35): an empty thread with no folder (e.g. a catalog Start
              // Chat) gets no event (D-267-12), so the spotlight states the biased narrowing.
              unscopedChat={!thread?.folder_id}
            />
          </div>
        </div>
      ) : (
        <>
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            isLoading={isLoadingThisThread}
            onSendMessage={onSendMessage}
            showSuggestions={agentMode !== "explorer"}
            onResume={onResume}
            threadId={thread?.id ?? null}
          />
          {/* 267-UI-REVIEW #2 (UI-SPEC §9-D6): the transient spotlight that used to mount here is
              GONE. This branch renders only when the thread already has messages, and a change on
              it writes a persisted expert_changed event that applyExpertChange refetches — that
              event card IS the announcement, and the spotlight announced the same change a second
              time, louder. Empty threads keep their spotlight (the branch above, D-267-12). */}
        </>
      )}
      {pendingApproval && (
        <div
          data-testid="docked-tool-approval"
          className="mx-4 mb-2 p-1 rounded-xl border border-amber-500/40 bg-card/95 backdrop-blur shadow-lg z-10 animate-fadeSlideUp"
        >
          <ChatToolApprovalCard
            threadId={thread?.id ?? ""}
            approval={pendingApproval}
            onDecision={handleApprovalDecision}
          />
        </div>
      )}
      {inputBar}
    </div>
  )
}
