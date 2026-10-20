import { useCallback, useRef, useState } from "react"
import { listPublishedWorkflows, type PublishedWorkflow } from "@/lib/api"
import { useStreamActions } from "@/providers/StreamsProvider"
import { launchInputFields, type DefShape } from "@/components/workflows/soulData"

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
      setOpen(false)
      // Deliberately NOT awaited - see the header. A failed send is rolled back inside the provider.
      void sendMessage(threadId, `Run ${def.name}`, {
        workflowDefinitionId: def.id,
        inputs,
        surfaceId: "chat",
      }).finally(() => {
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

  const cancelForm = useCallback(() => setPending(null), [])

  return { open, workflows, loading, error, pending, starting, openPicker, closePicker, pick, start, cancelForm }
}
