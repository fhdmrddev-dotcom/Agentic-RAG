import { useCallback, useRef, useState } from "react"
import { listPublishedWorkflows, type PublishedWorkflow } from "@/lib/api"
import { useStreamActions } from "@/providers/StreamsProvider"
import { launchInputFields, type DefShape } from "@/components/workflows/soulData"
import { useStreamsStore } from "@/stores/streamsStore"
import { COPY } from "./composerCopy"

/** 296-04 (287-WR-02 / 287-IN-03): why an in-thread start did not run, worded for the person. */
export interface StartFailure {
  kind: "locked" | "inputs" | "folder" | "refused" | "failed"
  message: string
}

/**
 * 302-02 (FE-IN-01 / D-09): the start of the server's paused 409 (workflow_kickoff.py). A WIRE
 * match, not copy — the person reads `composerCopy.shared.startPaused`. Cross-pinned by a ?raw test.
 */
export const WORKFLOW_PAUSED_DETAIL_PREFIX = "This thread's workflow is paused"

function statusOf(err: unknown): number | null {
  const s = (err as { status?: unknown } | null)?.status
  return typeof s === "number" ? s : null
}

/**
 * One sentence per cause, from `composerCopy` (never server text) — with ONE recorded exception.
 *
 * 298-02 (D-14 / UI-D12): a 422 carrying the code `folder_in_other_org` shows the server's
 * sentence. It is authored server-side for exactly this surface: it names the folder, and its
 * org only when the person can see that folder, so the client has nothing to add and no safe
 * way to say it better. The CODE decides, never the prose; every other 422 keeps its sentence.
 *
 * 302-02 (D-26 / FE-IN-01): the SECOND recorded exception — a 409 that is neither the lock nor a
 * pause shows the server's sentence, because those (the org mismatches, 299 D-18 / D-38, 279-02)
 * are authored for this person on the server. The lock is told by the CODE the provider stamps,
 * never by prose; a pause by the server's wire prefix, worded here by `startPaused`.
 */
function failureFor(err: unknown, name: string): StartFailure {
  const status = statusOf(err)
  const code = (err as { code?: unknown } | null)?.code
  if (status === 409) {
    const sentence = err instanceof Error ? err.message : ""
    if (code === "workflow_locked") return { kind: "locked", message: COPY.shared.startLocked(name) }
    if (sentence.startsWith(WORKFLOW_PAUSED_DETAIL_PREFIX)) {
      return { kind: "locked", message: COPY.shared.startPaused(name) }
    }
    if (sentence) return { kind: "refused", message: COPY.shared.startRefusedWith(name, sentence) }
    return { kind: "failed", message: COPY.shared.startFailed(name) }
  }
  if (status === 422 && code === "folder_in_other_org" && err instanceof Error && err.message) {
    return { kind: "folder", message: err.message }
  }
  if (status === 422) return { kind: "inputs", message: COPY.shared.startInputsRefused(name) }
  return { kind: "failed", message: COPY.shared.startFailed(name) }
}

/**
 * Phase 287-03 (START-01 / A-01, A-09, D-07) - start a published workflow INSIDE an open thread.
 *
 * ── WHAT IT DOES ──
 *
 * Lists the published workflows ONLY when opened (T-287-12: no mount-time fetch in every chat),
 * decides per workflow whether the person owes a launch form (declared inputs) or not, and then
 * hands the kickoff to the provider's own `sendMessage` for THIS thread id - the run attaches to
 * the thread the person is already in.
 *
 * ── ⛔ WHAT IT MUST NEVER DO ──
 *
 *  - It reads nothing from the conversation. The kickoff text is the fixed string `Run <name>`
 *    and the inputs are exactly what the person typed into the form (D-07, T-287-09). A stripped
 *    source fence in `ThreadWorkflowPicker.test.tsx` enforces the absence with a positive control.
 *  - It never makes a new thread; the thread already exists and its id is the argument.
 *  - It never awaits the send: `sendMessage` resolves only when the WHOLE stream ends, so
 *    awaiting it would hold the control hostage for the length of the run.
 *
 * The server's 409 stays the authority on "a workflow is already running here"; the `locked`
 * prop and `starting` flag only stop the person reaching it.
 */
export function useStartWorkflowInThread(threadId: string) {
  const { sendMessage } = useStreamActions()
  const [open, setOpen] = useState(false)
  const [workflows, setWorkflows] = useState<PublishedWorkflow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<PublishedWorkflow | null>(null)
  const [starting, setStarting] = useState(false)
  const startingRef = useRef(false)
  // 296-04: the refused start, the attempt it refused (for Retry), and the values a 422 Retry
  // hands back to the form. The person typed these; nothing is read from the conversation.
  const [failure, setFailure] = useState<StartFailure | null>(null)
  const [pendingValues, setPendingValues] = useState<Record<string, string> | undefined>(undefined)
  const lastAttempt = useRef<{ def: PublishedWorkflow; inputs: Record<string, string> } | null>(null)

  const openPicker = useCallback(() => {
    setOpen(true)
    setError(null)
    setLoading(true)
    listPublishedWorkflows()
      .then((rows) => setWorkflows(rows))
      .catch(() => setError("Could not load your workflows. Try again."))
      .finally(() => setLoading(false))
  }, [])

  const closePicker = useCallback(() => setOpen(false), [])

  const start = useCallback(
    (def: PublishedWorkflow, inputs: Record<string, string>) => {
      if (startingRef.current) return
      startingRef.current = true
      setStarting(true)
      setPending(null)
      setPendingValues(undefined)
      setOpen(false)
      setFailure(null)
      lastAttempt.current = { def, inputs }
      const kickoff = `Run ${def.name}`
      // 296-04: the provider catches a refusal and records it per thread (`reconcileErrors`), and
      // stashes the sent text so the composer can offer it back. For a kickoff that text is not
      // the person's, so the refusal recorded by THIS send is the hook's to word.
      const before = useStreamsStore.getState().reconcileErrors.get(threadId)
      // Deliberately NOT awaited - see the header.
      void sendMessage(threadId, kickoff, {
        workflowDefinitionId: def.id,
        inputs,
        surfaceId: "chat",
      })
        .then(() => {
          // Only a refusal of THIS send: a new entry with a refusal status (the 400/422 arm, which
          // stashes no draft for a kickoff — FE-CR-01, or the 409 lock arm). A snapshot failure
          // (network / 5xx / 404) is not ours.
          const st = useStreamsStore.getState()
          const after = st.reconcileErrors.get(threadId)
          if (!after || after === before) return
          if ([400, 409, 422].includes(statusOf(after) ?? 0)) throw after
        })
        .catch((err: unknown) => {
          useStreamsStore.setState((st) => {
            const drafts = new Map(st.failedSendDrafts)
            if (drafts.get(threadId) === kickoff) drafts.delete(threadId)
            const errors = new Map(st.reconcileErrors)
            if (errors.get(threadId) === err) errors.delete(threadId)
            return { failedSendDrafts: drafts, reconcileErrors: errors }
          })
          setFailure(failureFor(err, def.name))
        })
        .finally(() => {
          startingRef.current = false
          setStarting(false)
        })
    },
    [sendMessage, threadId],
  )

  const pick = useCallback(
    (def: PublishedWorkflow) => {
      if (launchInputFields(def.definition as DefShape | undefined).length > 0) {
        setOpen(false)
        setPending(def)
        return
      }
      start(def, {})
    },
    [start],
  )

  const cancelForm = useCallback(() => {
    setPending(null)
    setPendingValues(undefined)
  }, [])

  const dismiss = useCallback(() => setFailure(null), [])

  /** 296-04: Retry. Locked offers none; a 422 re-opens the form with the typed values; anything
   *  else re-sends the same workflow with the same inputs. */
  const retry = useCallback(() => {
    const last = lastAttempt.current
    // 298-02: a folder refusal offers no Retry — the same published workflow is refused again.
    // 302-02: nor a refused 409 — the same start would be refused again.
    if (!failure || !last || failure.kind === "locked" || failure.kind === "folder" || failure.kind === "refused") return
    setFailure(null)
    if (failure.kind === "inputs") {
      setPendingValues(last.inputs)
      setPending(last.def)
      return
    }
    start(last.def, last.inputs)
  }, [failure, start])

  return {
    open,
    workflows,
    loading,
    error,
    pending,
    pendingValues,
    starting,
    failure,
    openPicker,
    closePicker,
    pick,
    start,
    cancelForm,
    retry,
    dismiss,
  }
}
