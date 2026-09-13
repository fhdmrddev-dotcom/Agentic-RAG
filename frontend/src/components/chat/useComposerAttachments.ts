/**
 * Phase 244 plan 06 (SHELL-04 / G-5) — THE COMPOSER'S ATTACHMENT SEAM, EXTRACTED.
 *
 * ⛔ THIS EXTRACTION IS OWED, NOT OPTIONAL. `MessageInput.tsx` fires G-5 (15 phases), and
 * `244-05` grew it `643 → 855` while explicitly refusing to write *"honoured by construction"*.
 * It NAMED the seam instead — `useComposerAttachments` + a chips row — and recorded the rule
 * this file discharges: *"the next plan whose `files_modified` names this file must propose the
 * extraction FIRST"* (the `retrieval_service.py` / SEED-224 precedent). `244-06` is that plan,
 * so the cloud door lands HERE and `MessageInput.tsx` SHRINKS rather than growing a third time.
 *
 * ⭐ WHAT THIS OWNS: the two doors' state and their three verbs. Both doors — the hard drive
 * and the cloud — write a thread-scoped `workspace_files` row and **no `documents` row at all**,
 * which is what makes *"not in the KB"* structurally true rather than a promise (D-244-03/05).
 * ⛔ WHAT IT DOES NOT OWN: the draft text. A composer must never edit the person's typed words
 * (D-244-02's rejected arm), so nothing in this file can reach `setValue`, by construction.
 *
 * ⚠ `refusal` carries the server's OWN sentence and the name of the file it refused — both
 * atoms, because the approved mockup draws both (D-244-27). It is never paraphrased: a refusal
 * that softens the reason cannot be acted on.
 *
 * ⛔ **NO THREAD IS A REFUSAL, NEVER A RETURN (`244-07` / CR-01).** Both verbs opened with a bare
 * `if (!threadId) return`, and `ChatArea` renders this composer with `threadId={null}` on its
 * welcome screen — so on the first chat anybody opens, a pick produced no chip, no request and
 * no word. The cloud half was worse: returning `undefined` rather than throwing made the picker
 * take its SUCCESS path and close identically to a real attach.
 *
 * ⚠ **THE ARM NOT TAKEN, recorded rather than left implicit:** creating the thread at ATTACH
 * time. It is the nicer product, and it was refused here because it is not a defect fix — it
 * needs `onCreateThread` threaded down through `MessageInput`, and `MessageInput`'s draft-key
 * effect calls `clear()` on every `threadId` change, so the chip the person just made would be
 * wiped by the thread its own creation produced. That is a phase, with its own fences. This
 * commit's contract is narrower and absolute: **a door may never do nothing.**
 */
import { useCallback, useState } from "react"
import { attachConnectionFileToThread, uploadWorkspaceTemplate } from "@/lib/api"
import { COPY } from "./composerCopy"
import type { WorkspaceFile } from "@/types"
import { detachAttachment } from "./ChatAttachmentChip"
import { useStreamActions } from "@/providers/StreamsProvider"

export interface ComposerRefusal {
  fileName: string
  message: string
}

export interface ComposerAttachments {
  /** Attached but not yet SENT. Composer-local: a reload must not resurrect a draft as sent. */
  pending: WorkspaceFile[]
  refusal: ComposerRefusal | null
  /** The hard-drive door. */
  attachLocalFile: (file: File) => Promise<void>
  /** The cloud door — the SAME destination, by D-244-05. */
  attachCloudFile: (connectionId: string, fileId: string, displayName: string) => Promise<void>
  removeAttachment: (file: WorkspaceFile) => void
  dismissRefusal: () => void
  /** Thread switch, or a successful send: the composer lets its chips go. */
  clear: () => void
}

export function useComposerAttachments(threadId?: string | null): ComposerAttachments {
  const [pending, setPending] = useState<WorkspaceFile[]>([])
  const [refusal, setRefusal] = useState<ComposerRefusal | null>(null)
  const { setWorkspaceFileForThread } = useStreamActions()

  /** One landing for both doors, so they cannot drift on reconcile or on refusal shape. */
  const land = useCallback(
    (uploaded: WorkspaceFile) => {
      if (threadId) setWorkspaceFileForThread(threadId, uploaded) // optimistic (no refresh)
      setPending((prev) => [...prev, uploaded])
      setRefusal(null)
    },
    [threadId, setWorkspaceFileForThread],
  )

  /**
   * ── THE LOCAL ATTACH DOOR (244-05 T2) ────────────────────────────────────────────────
   * Shape copied from `components/panel/TemplateUpload.tsx`, which already drives the same
   * route. ⭐ THE CAUGHT MESSAGE IS THE SERVER'S OWN 422: `uploadWorkspaceTemplate` throws
   * `new Error(err.detail)` and `err.detail` is `workspace.py`'s verbatim sentence
   * (`COPY.engine.REFUSE_TYPE` / `REFUSE_SIZE` / `REFUSE_EMPTY`).
   *
   * ⛔ NO CLIENT-SIDE SIZE OR TYPE GATE. `accept=` is a UX hint (T-244-05-01); the real
   * boundary is `validate_upload`'s magic-byte + container checks, and the cap is enforced
   * server-side three times including BEFORE body materialisation (WR-04 / T-244-05-04). A
   * second client cap could only ever disagree with the server.
   */
  const attachLocalFile = useCallback(
    async (f: File) => {
      if (!threadId) {
        setRefusal({ fileName: f.name, message: COPY.shared.refuseNoThread })
        return
      }
      try {
        land(await uploadWorkspaceTemplate(threadId, f))
      } catch (e) {
        setRefusal({ fileName: f.name, message: e instanceof Error ? e.message : "Upload failed" })
      }
    },
    [threadId, land],
  )

  /**
   * ── THE CLOUD ATTACH DOOR (244-06 T3 / D-244-05 / BUG-260905-01) ──────────────────────
   * ⛔ NOT `importCloudFile`. That client drives the LIBRARY's single-file import and mints a
   * `documents` row — which is precisely the inversion the operator reported: *"anything in
   * the chat should stay temporarily in that thread, not in the Library itself."* This one
   * posts to `POST /threads/{id}/workspace/files/from-connection`, a module that imports
   * neither the minter nor the splice, so a chat cloud pick CANNOT reach the Library.
   *
   * ⭐ The refusal lands in the SAME `refusal` state the local door uses — one vocabulary for
   * one fact, never two shapes for the same sentence.
   */
  const attachCloudFile = useCallback(
    async (connectionId: string, fileId: string, displayName: string) => {
      if (!threadId) {
        // ⛔ THROWN, not returned. `ConnectedFilePickerModal.handleConfirm` branches on this
        // promise: a resolve is a SUCCESS, and an early `return undefined` therefore closed the
        // dialog exactly as a real attach does (CR-01). The refusal is set FIRST so the
        // composer's strip is already rendered by the time the modal unmounts itself.
        const refused = new Error(COPY.shared.refuseNoThread)
        setRefusal({ fileName: displayName, message: refused.message })
        throw refused
      }
      try {
        land(await attachConnectionFileToThread(threadId, connectionId, fileId))
      } catch (e) {
        setRefusal({
          fileName: displayName,
          message: e instanceof Error ? e.message : "Attach failed",
        })
        // ⚠ RE-THROWN so the modal knows the pick did not take. It renders nothing itself —
        // the refusal above is the only place this is said.
        throw e
      }
    },
    [threadId, land],
  )

  /**
   * ⚠ REMOVE IS A DETACH, NOT A DELETE, AND THE UI MUST NOT IMPLY OTHERWISE.
   *
   * `backend/app/api/workspace.py` ships SEVEN routes and **none of them is a DELETE**
   * (measured at this base: two POSTs, five GETs). So the bytes stay in `workspace_files`
   * until the TTL read gate hides them, and `244-02`'s sandbox hydration will still surface
   * them to the agent for this thread. Removing the chip therefore means: *this file is not
   * part of the message I am about to send.* It is recorded in the session-scoped detach
   * registry so the transcript's association rule skips it too.
   *
   * ⛔ Do NOT "fix" this by adding a client-side hide that claims the file is gone. The honest
   * close is a DELETE route, which is backend scope no plan in this phase carries.
   */
  const removeAttachment = useCallback(
    (file: WorkspaceFile) => {
      if (threadId) detachAttachment(threadId, file.path)
      setPending((prev) => prev.filter((f) => f.path !== file.path))
    },
    [threadId],
  )

  const dismissRefusal = useCallback(() => setRefusal(null), [])

  /**
   * ⛔ An attachment belongs to the conversation it was attached IN. Unlike the draft text and
   * the connector set, pending attachments are NOT carried across a thread switch — a chip
   * that followed you into another chat would be saying `this chat only` about a chat it is
   * not in, which is the one sentence this surface exists to make true. The bytes are not
   * lost: they remain in the thread they were uploaded to.
   */
  const clear = useCallback(() => {
    setPending([])
    setRefusal(null)
  }, [])

  return {
    pending,
    refusal,
    attachLocalFile,
    attachCloudFile,
    removeAttachment,
    dismissRefusal,
    clear,
  }
}
