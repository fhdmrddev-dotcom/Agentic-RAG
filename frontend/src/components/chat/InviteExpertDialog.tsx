/**
 * Phase 260 (PACK-02 / D-260-02 / 260-UI-SPEC §2.1) — Invite Expert Dialog.
 *
 * Modal dialog for browsing and selecting domain experts to advise on the active thread.
 *
 * ── Phase 267 plan 04 (PACK-22 / PACK-24 / PACK-25 · D-267-06 / D-267-13 / D-267-16 / D-267-18 /
 *    D-267-27 · 267-UI-SPEC §5.2-5.3, §6.3) ─────────────────────────────────────────────────────
 *
 * ⭐ THE ROW STATES ITS COST BEFORE IT CAN BE ACCEPTED. A restricted row fetches
 * `GET /threads/expert-scope-preview` on open and offers NO invite control until it answers; its
 * `Will use` / `Won't use · N` ledger comes from that ONE response (`previewLedgerColumns`). A row
 * missing a required connection shows `Brings` / `Missing` and the gate line instead (R3), and is
 * never previewed — it cannot be invited.
 *
 * ⛔ G-5, THE NAMED SEAM TAKEN: the per-row action area is ONE internal component,
 * `ExpertRowActions`, which evaluates the UI-SPEC's R1-R10 matrix top to bottom. The dialog body
 * stays a list. Every word comes from `expertCatalog.ts` (`PREVIEW_COPY`, `CONNECTION_COPY`,
 * `LEDGER_COPY`); the dialog spells none of them and decides no gate itself (`inviteBlock`).
 *
 * ⛔ A SECOND THREAD CANNOT BE CREATED BY ACCIDENT (R9 / T-267-42). "New chat with …" calls the
 * caller's `onHandoff` once; while it is in flight the button is busy, every other action is
 * `aria-disabled` and inert, and the dialog ignores every request to close. A rejection (R10) is
 * stated with its reason — the server's own sentence, or the network reason — and always ends with
 * the guarantee that nothing was created. The buttons re-enable, so clicking again is the retry.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import { Sparkles, Check, Loader2, Folder, Wrench, Shield } from "lucide-react"
import { ExpertIcon } from "@/components/experts/expertIcon"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { listExperts } from "@/lib/api"
import { getExpertScopePreview, type ExpertScopePreview } from "@/lib/api/experts"
import type { ExpertBundle } from "@/types"
import {
  CONNECTION_COPY,
  PREVIEW_COPY,
  connectionLedgerColumns,
  inviteBlock,
  narrowingLedgerColumns,
  previewLedgerColumns,
  type InviteBlock,
} from "@/components/experts/catalog/expertCatalog"
import { ScopeLedger } from "@/components/experts/ScopeLedger"
import { cn } from "@/lib/utils"

interface InviteExpertDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectExpert: (expert: ExpertBundle) => void
  currentExpertId?: string | null
  // ── Phase 267 plan 04 — all optional: an absent door renders no control (D-262-02) ──────────
  /** The active Expert's name, for "{active} is active here." / "Replace {active}". */
  currentExpertName?: string | null
  /** The thread the preview is computed against; absent on a brand-new chat. */
  threadId?: string | null
  /** The thread's folder name, for the context line. */
  threadFolderName?: string | null
  /** 267-REVIEW WR-07: the folder a brand-new chat (no `threadId` yet) was scoped to, so its
   *  preview states what the thread about to be created will exclude. Ignored with a thread. */
  threadFolderId?: string | null
  /** True when the thread has ≥ 1 message — only then is there anything to hand off (R8). */
  hasMessages?: boolean
  /** "New chat with …" — resolves once the new thread is open; rejects with the reason. */
  onHandoff?: (expert: ExpertBundle) => Promise<void>
  /** The shipped Connections door (R3 admin). */
  onOpenConnections?: () => void
}

type PreviewState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; preview: ExpertScopePreview }

// ⚠ RETIRED (262-02 / D-262-06 / RESEARCH R-7): the per-Expert icon guesser that lived here
// — a `slug`/`name` string-match returning one of four emoji, duplicated VERBATIM into
// `ExpertSpotlightCard.tsx`. Two copies of one decision is a one-home-per-concern violation on
// its own, and neither copy read the `icon` column.
//
// ⭐ IT SHIPPED FOR A REAL REASON. At Phase 260 there was one seeded demo Expert (migration
// 188) and no read path for the presentation columns — migration 189 had not landed — so a
// guess from the name was the only way this list could show more than a single glyph.
//
// ⛔ IT IS NOW A LIE. `ExpertAuthoringStudio` writes `icon`, and an author who chose one got
// the guess anyway; an Expert merely NAMED "Financial …" inherited the demo Expert's face.
// Resolution now has exactly one home: `@/components/experts/expertIcon`, which reads the
// column and falls back to a neutral glyph — never to a name.

/** The shipped button class, copied verbatim so new controls match their neighbours. */
const BTN = "text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-150 flex items-center gap-1.5"
const PRIMARY = "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
const GHOST = "border border-border/60 text-foreground hover:bg-muted/60"
const PAIR = "min-h-[44px] sm:min-h-0 w-full sm:w-auto justify-center"
const INERT = "aria-disabled:opacity-50 aria-disabled:cursor-not-allowed disabled:opacity-70"
const ALERT = "p-3 text-xs rounded-lg bg-destructive/10 border border-destructive/30 text-destructive"

/** A label whose Expert name truncates at 20ch while the words around it stay whole. */
function NameInLabel({ label, name }: { label: string; name: string }) {
  const at = name ? label.indexOf(name) : -1
  if (at < 0) return <span>{label}</span>
  return (
    <>
      {label.slice(0, at)}
      <span className="max-w-[20ch] truncate">{name}</span>
      {label.slice(at + name.length)}
    </>
  )
}

interface RowActionsProps {
  expert: ExpertBundle
  isCurrent: boolean
  block: InviteBlock | null
  preview: PreviewState | undefined
  activeName: string | null
  hasMessages: boolean
  canHandoff: boolean
  /** The expert id whose handoff is in flight, if any. */
  busyId: string | null
  refusal: string | null
  onInvite: () => void
  onHandoff: () => void
  onConnect: (() => void) | null
  onRetry: () => void
}

/**
 * The R1-R10 matrix (267-UI-SPEC §5.2), evaluated top to bottom; the first match draws the row's
 * action area. The statement above it (a ledger, the preview's loading / failure / no-folders line)
 * belongs to the same decision, so it is drawn here too.
 */
function ExpertRowActions({
  expert,
  isCurrent,
  block,
  preview,
  activeName,
  hasMessages,
  canHandoff,
  busyId,
  refusal,
  onInvite,
  onHandoff,
  onConnect,
  onRetry,
}: RowActionsProps) {
  const restricted = expert.scope_mode === "restricted"
  const busy = busyId !== null
  const mineInFlight = busyId === expert.id
  // Every action on a row that is NOT the in-flight one is inert while a handoff runs (R9).
  const guard = (fn: () => void) => () => {
    if (busy) return
    fn()
  }
  const inert = busy && !mineInFlight ? { "aria-disabled": true as const } : {}

  /** What the preview says about a restricted row, in its four states. */
  const previewStatement = (): { node: ReactNode; canInvite: boolean } => {
    if (!restricted) {
      // 267-REVIEW WR-06 (D-267-35): on a chat with no folder a biased Expert reads only its own
      // folders — stated when the preview says so. It never blocks the invite (biased adds its
      // folders' focus; nothing the person asked for is refused), so loading/failure add nothing.
      const cols = preview?.status === "ready" ? narrowingLedgerColumns(preview.preview) : null
      return { node: cols ? <ScopeLedger columns={cols} /> : null, canInvite: true }
    }
    if (!preview || preview.status === "loading") {
      return {
        node: (
          <p
            data-testid="scope-preview-loading"
            role="status"
            className="mt-3 flex items-center gap-1 text-[11px] leading-snug text-muted-foreground"
          >
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            {PREVIEW_COPY.checking(expert.name)}
          </p>
        ),
        canInvite: false,
      }
    }
    if (preview.status === "error") {
      return {
        node: (
          <div
            data-testid="scope-preview-error"
            role="alert"
            className={cn(ALERT, "mt-3 flex flex-wrap items-center justify-between gap-2")}
          >
            <span>{PREVIEW_COPY.checkFailed(expert.name)}</span>
            <button type="button" onClick={guard(onRetry)} {...inert} className={cn(BTN, GHOST, INERT)}>
              {PREVIEW_COPY.tryAgain}
            </button>
          </div>
        ),
        canInvite: false,
      }
    }
    if ((preview.preview.expert_folders ?? []).length === 0) {
      // 266 CR-01 refuses this run (`ExpertScopeUnavailable`); say so before it (UI-SPEC §9-D5).
      return {
        node: (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {PREVIEW_COPY.noFolders(expert.name)}
          </p>
        ),
        canInvite: false,
      }
    }
    return { node: <ScopeLedger columns={previewLedgerColumns(preview.preview)} />, canInvite: true }
  }

  // ── R1: the active Expert — the shipped Active pill, and its ledger if restricted ─────────────
  if (isCurrent) {
    return (
      <>
        {previewStatement().node}
        <div className="mt-3 flex justify-end">
          {/* 267-REVIEW IN-02: a status, not a control — it re-PATCHed the bound Expert on click. */}
          <span
            data-testid={`invite-expert-btn-${expert.slug}`}
            className={cn(BTN, "bg-violet-500/20 text-violet-700 dark:text-violet-200 border border-violet-500/40 cursor-default")}
          >
            <Check className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
            Active
          </span>
        </div>
      </>
    )
  }

  // ── R2: the 266 install reason — shipped, unchanged ──────────────────────────────────────────
  if (block?.kind === "install") {
    return (
      <div className="mt-3 flex justify-end">
        <p className="text-right text-[11px] italic text-muted-foreground">{block.line}</p>
      </div>
    )
  }

  // ── R3: a missing required connection — Brings / Missing, the gate line, Connect or the ask ──
  if (block?.kind === "connection") {
    const { gate } = block
    const names = gate.missing.map((m) => m.name)
    return (
      <>
        <ScopeLedger columns={connectionLedgerColumns(expert, "dialog")} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p data-testid="connection-gate-line" className="text-xs leading-relaxed text-rose-700 dark:text-rose-300">
            {gate.line}
          </p>
          {gate.action && onConnect ? (
            <button
              type="button"
              data-testid="connection-gate-connect"
              onClick={guard(onConnect)}
              {...inert}
              className={cn(BTN, GHOST, PAIR, INERT)}
            >
              {gate.action.label}
            </button>
          ) : (
            <p data-testid="connection-gate-ask" className="w-full text-xs leading-relaxed text-muted-foreground">
              {gate.ask ?? CONNECTION_COPY.memberAsk(names)}
            </p>
          )}
        </div>
      </>
    )
  }

  // ── R4 / R5 / no-folders: a restricted row whose cost is not yet stated cannot be invited ───
  const statement = previewStatement()
  if (!statement.canInvite) return <>{statement.node}</>

  // ── R6: no Expert active — the shipped invite ────────────────────────────────────────────────
  if (!activeName) {
    return (
      <>
        {statement.node}
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            data-testid={`invite-expert-btn-${expert.slug}`}
            onClick={guard(onInvite)}
            {...inert}
            className={cn(BTN, PRIMARY, INERT)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Invite to Thread
          </button>
        </div>
      </>
    )
  }

  // ── R7 / R8 (+ R9 / R10): another Expert is active ──────────────────────────────────────────
  const offerHandoff = hasMessages && canHandoff
  const replaceLabel = PREVIEW_COPY.replace(activeName)
  const handoffLabel = PREVIEW_COPY.newChatWith(expert.name)
  return (
    <>
      {statement.node}
      <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
        {PREVIEW_COPY.activeHere(activeName)}
      </p>
      <div className="mt-2 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          data-testid={`expert-replace-btn-${expert.slug}`}
          aria-label={replaceLabel}
          onClick={guard(onInvite)}
          {...(busy ? { "aria-disabled": true as const } : {})}
          className={cn(BTN, offerHandoff ? GHOST : PRIMARY, PAIR, INERT)}
        >
          <NameInLabel label={replaceLabel} name={activeName} />
        </button>
        {offerHandoff && (
          <button
            type="button"
            data-testid={`expert-handoff-btn-${expert.slug}`}
            aria-label={mineInFlight ? PREVIEW_COPY.summarising : handoffLabel}
            onClick={guard(onHandoff)}
            disabled={mineInFlight}
            aria-busy={mineInFlight ? "true" : undefined}
            {...inert}
            className={cn(BTN, PRIMARY, PAIR, INERT)}
          >
            {mineInFlight ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                {PREVIEW_COPY.summarising}
              </>
            ) : (
              <NameInLabel label={handoffLabel} name={expert.name} />
            )}
          </button>
        )}
      </div>
      {refusal && (
        <div data-testid="handoff-refusal" role="alert" className={cn(ALERT, "mt-2")}>
          {refusal}
        </div>
      )}
    </>
  )
}

export function InviteExpertDialog({
  open,
  onOpenChange,
  onSelectExpert,
  currentExpertId,
  currentExpertName,
  threadId,
  threadFolderName,
  threadFolderId,
  hasMessages = false,
  onHandoff,
  onOpenConnections,
}: InviteExpertDialogProps) {
  const [experts, setExperts] = useState<ExpertBundle[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({})
  const [busyId, setBusyId] = useState<string | null>(null)
  const [refusals, setRefusals] = useState<Record<string, string>>({})
  // Bumped on every open (and on close), so a response from an earlier opening is dropped — the
  // shipped mounted-guard, widened to the per-row preview requests.
  const generationRef = useRef(0)
  // Synchronous twin of `busyId`: a second click in the same tick must see the lock (T-267-42).
  const inFlightRef = useRef(false)

  const loadPreview = useCallback(
    (expertId: string, generation: number) => {
      setPreviews((p) => ({ ...p, [expertId]: { status: "loading" } }))
      // 267-REVIEW WR-07: no thread yet → the picked folder is what the new thread will carry.
      const request =
        !threadId && threadFolderId
          ? getExpertScopePreview(expertId, null, threadFolderId)
          : getExpertScopePreview(expertId, threadId ?? null)
      request
        .then((preview) => {
          if (generationRef.current === generation) {
            setPreviews((p) => ({ ...p, [expertId]: { status: "ready", preview } }))
          }
        })
        .catch(() => {
          if (generationRef.current === generation) {
            setPreviews((p) => ({ ...p, [expertId]: { status: "error" } }))
          }
        })
    },
    [threadId, threadFolderId],
  )

  useEffect(() => {
    if (!open) return
    const generation = ++generationRef.current
    setLoading(true)
    setError(null)
    setPreviews({})
    setRefusals({})

    listExperts(true, true)
      .then((data) => {
        if (generationRef.current !== generation) return
        setExperts(data)
        setLoading(false)
        // UI-SPEC §5.3: one request per restricted row that could be invited — and the ACTIVE
        // restricted row (R1) — in parallel, on open. Not cached across openings: the thread's
        // folder contents can change.
        for (const e of data) {
          // 267-REVIEW WR-06 (D-267-35): a BIASED row is previewed only on a chat with no folder —
          // the one place it narrows (to its own folders), which must be stated.
          if (e.scope_mode !== "restricted" && threadFolderName) continue
          if (e.id === currentExpertId || inviteBlock(e) === null) loadPreview(e.id, generation)
        }
      })
      .catch((err) => {
        if (generationRef.current === generation) {
          setError(err instanceof Error ? err.message : "Failed to load experts")
          setLoading(false)
        }
      })

    return () => {
      generationRef.current++
    }
    // The shipped effect keyed on `open` alone; the preview inputs are read as of the opening.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // R9: while a handoff is in flight the dialog cannot be dismissed (Esc, overlay, ✕).
  const handleOpenChange = (next: boolean) => {
    if (!next && inFlightRef.current) return
    onOpenChange(next)
  }

  const startHandoff = async (expert: ExpertBundle) => {
    if (!onHandoff || inFlightRef.current) return
    inFlightRef.current = true
    setBusyId(expert.id)
    setRefusals((r) => {
      const next = { ...r }
      delete next[expert.id]
      return next
    })
    try {
      await onHandoff(expert)
      inFlightRef.current = false
      setBusyId(null)
      onOpenChange(false)
    } catch (err) {
      inFlightRef.current = false
      setBusyId(null)
      const reason =
        err instanceof TypeError
          ? PREVIEW_COPY.networkReason
          : err instanceof Error && err.message.trim()
            ? err.message
            : PREVIEW_COPY.summaryFailedReason
      setRefusals((r) => ({ ...r, [expert.id]: PREVIEW_COPY.refusal(expert.name, reason) }))
    }
  }

  const activeName =
    currentExpertId
      ? (currentExpertName ?? experts.find((e) => e.id === currentExpertId)?.name ?? null)
      : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid="invite-expert-dialog"
        className="max-w-lg bg-card/95 border-border/80 backdrop-blur-md shadow-2xl p-6 rounded-2xl"
      >
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-700 dark:text-violet-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <DialogTitle className="text-base font-semibold text-foreground">
              Invite an Expert
            </DialogTitle>
          </div>
          {/* Phase 267 (UI-SPEC §5.2): the shipped sentence claimed the Expert scopes TOOLS, which
              is false after D-267-01 — it is replaced by what this chat reads today. */}
          {threadFolderName ? (
            <DialogDescription className="text-xs text-muted-foreground">
              {PREVIEW_COPY.contextPrefix}
              <span className="font-mono">{PREVIEW_COPY.contextFolder(threadFolderName)}</span>
            </DialogDescription>
          ) : (
            <DialogDescription className="text-xs text-muted-foreground">
              {PREVIEW_COPY.contextPrefix + PREVIEW_COPY.contextAll}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* 267-UI-REVIEW #3: 380px was sized for the pre-ledger rows; a row with its ledger is
            ~360px, so the dialog showed one Expert and the R7 decision sat below the fold.
            Viewport-relative: 702px of list on a 900px screen, and the dialog still fits. */}
        <div
          data-testid="invite-expert-list"
          className="mt-4 space-y-3 max-h-[min(78vh,720px)] overflow-y-auto pr-1"
        >
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-violet-600 dark:text-violet-400" />
              <span className="text-xs">{PREVIEW_COPY.listLoading}</span>
            </div>
          )}

          {error && (
            <div role="alert" className={ALERT}>
              {PREVIEW_COPY.listError(error)}
            </div>
          )}

          {!loading && !error && experts.length === 0 && (
            <div className="py-10 text-center text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">{PREVIEW_COPY.emptyHeading}</p>
              <p>{PREVIEW_COPY.emptyBody}</p>
            </div>
          )}

          {!loading &&
            !error &&
            experts.map((expert) => {
              const isCurrent = expert.id === currentExpertId
              const isRestricted = expert.scope_mode === "restricted"
              // Phase 266 → 267: the first blocking fact, install before connection.
              const block = inviteBlock(expert)
              // R3's ledger REPLACES the meta line — one statement, not two.
              const showMeta = isCurrent || block?.kind !== "connection"

              return (
                <div
                  key={expert.id}
                  data-testid={`expert-card-${expert.slug}`}
                  className={cn(
                    "group relative p-3.5 rounded-xl border transition-all duration-200",
                    isCurrent
                      ? "bg-violet-500/10 border-violet-500/40 ring-1 ring-violet-500/30"
                      : "bg-muted/30 hover:bg-muted/60 border-border/60 hover:border-violet-500/30",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/30 flex items-center justify-center text-lg shrink-0">
                      <ExpertIcon icon={expert.icon} className="h-4 w-4 text-violet-700 dark:text-violet-200" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {expert.name}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded-full uppercase tracking-wider",
                            isRestricted
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20",
                          )}
                        >
                          {isRestricted ? "Restricted" : "Biased"}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {expert.description || "Specialized domain assistant with scoped access."}
                      </p>

                      {showMeta && (
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-muted-foreground/80">
                          {expert.knowledge_folder_ids?.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Folder className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                              {expert.knowledge_folder_ids.length} folder{expert.knowledge_folder_ids.length > 1 ? "s" : ""}
                            </span>
                          )}
                          {expert.member_skills?.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Wrench className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                              {expert.member_skills.length} skill{expert.member_skills.length > 1 ? "s" : ""}
                            </span>
                          )}
                          {expert.required_connections?.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Shield className="h-3 w-3 text-violet-600 dark:text-violet-400" />
                              {expert.required_connections.length} conn
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <ExpertRowActions
                    expert={expert}
                    isCurrent={isCurrent}
                    block={block}
                    preview={previews[expert.id]}
                    activeName={activeName}
                    hasMessages={hasMessages}
                    canHandoff={!!onHandoff && !!threadId}
                    busyId={busyId}
                    refusal={refusals[expert.id] ?? null}
                    onInvite={() => {
                      onSelectExpert(expert)
                      onOpenChange(false)
                    }}
                    onHandoff={() => void startHandoff(expert)}
                    onConnect={
                      onOpenConnections
                        ? () => {
                            onOpenChange(false)
                            onOpenConnections()
                          }
                        : null
                    }
                    onRetry={() => loadPreview(expert.id, generationRef.current)}
                  />
                </div>
              )
            })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
