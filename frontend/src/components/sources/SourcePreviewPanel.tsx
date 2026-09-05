/**
 * Phase 233 (PREV-01 / PREV-02 / PREV-03 / LIB-09) — the preview surface.
 *
 * ⭐ **THIS IS THE MILESTONE'S DIFFERENTIATOR, AND ITS ENTIRE VALUE IS HOW HONESTLY IT READS.**
 * Two operator-locked sketches are the acceptance bar, and this component is both of them:
 *
 *   • **229-C, the proportional spine** — at rest. ONE segmented bar that always sums to the
 *     folder, a four-item legend, four accordions beneath. *"A count of 4 beside a count of 12 is
 *     arithmetic; a hatched sixth of a bar is a feeling."*
 *   • **230-A, the bar dissolves** — on confirm. The bar you were READING becomes the bar you are
 *     WATCHING: the hatched segment shrinks into `added` / `already here` / a red `refused`.
 *     **No second screen and no new object.**
 *
 * ── ⛔ FOUR BUCKETS ARE STRUCTURE, NOT STATE (D-233-04) ───────────────────────────────────
 *
 * SC#1's clause is *"sees four lists"*, and the ROADMAP names the failure mode itself: *"A bucket
 * is dropped to make the screen tidier — three buckets is the version that lies."* A clause
 * worded that way can only be met **by construction, never by audit** — so:
 *
 *   • the four `<section>`s are rendered UNCONDITIONALLY, empty or not;
 *   • there is **no filter chip** (that is exactly why sketch variant **B** lost);
 *   • there is **no "collapse all"**;
 *   • ⭐ collapsing a section hides its **files**, never its **label or its count** — the header
 *     stays rendered in both states, which is what keeps SC#1 met once the accordion exists.
 *     That is the one risk C carries and A did not, and it is fenced by a test rather than by
 *     discipline.
 *
 * ── ⛔ A REFUSAL IS A NAME, NOT A COLOUR (SC#5) ───────────────────────────────────────────
 *
 * Sketch variant **B** failed on exactly this: four dots flipped colour, so you could see THAT two
 * were refused and there was nowhere for WHY. Every refusal row here renders its cause.
 *
 * ── DENSITY: REASONS LIVE BEHIND THE ROW ─────────────────────────────────────────────────
 *
 * Both sketches were REBUILT after the operator's *"too dense … a lot of text that's very messy"*.
 * A row shows a 3-4 word fragment; the full sentence is one hover away (`title`). Named, not
 * printed.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronRight, Loader2, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { previewSource, confirmSourcePreview } from "@/lib/api"
import type {
  SourcePreviewResponse,
  SourcePreviewItem,
  SourceConfirmResponse,
  PreviewBucket,
} from "@/lib/api"
import {
  BUCKET_ORDER,
  BUCKET_LABEL,
  BUCKET_BLURB,
  HERE_QUALIFIER,
  ZERO_WRITE_LINE,
  CANCEL_TOAST,
  OUTCOME_LABEL,
  reconciliationLine,
  confirmLabel,
  PREVIEW_TITLE,
  PREVIEW_EMPTY,
  PREVIEW_TRUNCATED,
  SCANNING,
  CANCEL_LABEL,
} from "./previewVocabulary"

export interface SourcePreviewPanelProps {
  connectionId: string
  folderId: string | null
  folderName?: string | null
  /** The Library folder the person chose. `null` = root. */
  destinationFolderId?: string | null
  destinationFolderName?: string | null
  onClose?: () => void
  onImported?: (result: SourceConfirmResponse) => void
  className?: string
}

/** The bar's colour per bucket. ⚠ `unk` is HATCHED, and the hatch is load-bearing, not decoration. */
const SEG_CLASS: Record<PreviewBucket, string> = {
  add: "bg-emerald-500/70",
  here: "bg-sky-500/50",
  uns: "bg-muted-foreground/30",
  unk: "bg-amber-500/40",
}

const DOT_CLASS: Record<PreviewBucket, string> = {
  add: "bg-emerald-500",
  here: "bg-sky-500",
  uns: "bg-muted-foreground/60",
  unk: "bg-amber-500",
}

/**
 * The hatch, inline so it needs no stylesheet edit and cannot be dropped by a Tailwind purge.
 * ⭐ Three lanes settle; the fourth does not. You WATCH the preview decline to guess — the honesty
 * claim made kinetic instead of written in a caption nobody reads.
 */
const HATCH_STYLE: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(45deg, rgba(245,158,11,0.55) 0 6px, rgba(245,158,11,0.12) 6px 12px)",
}

function BucketRow({ item }: { item: SourcePreviewItem }) {
  return (
    <div
      data-preview-row={item.bucket}
      data-external-id={item.external_id}
      /* ⭐ The full sentence lives HERE — behind the row, one hover away. Never printed at rest. */
      title={item.reason || undefined}
      className="flex items-center gap-3 border-t border-border/40 px-3 py-1.5 text-xs first:border-t-0"
    >
      <span className="min-w-0 flex-1 truncate text-foreground">{item.name}</span>
      {item.fragment && (
        <span data-preview-fragment className="shrink-0 text-[11px] text-muted-foreground">
          {item.fragment}
        </span>
      )}
      {item.destination && (
        <span
          data-preview-destination
          className="shrink-0 rounded bg-muted/60 px-1.5 py-0.5 text-[11px] text-muted-foreground"
        >
          {item.destination}
          {item.rule_suggested && (
            <span data-preview-rule className="ml-1 text-primary">
              rule
            </span>
          )}
        </span>
      )}
    </div>
  )
}

export function SourcePreviewPanel({
  connectionId,
  folderId,
  folderName,
  destinationFolderId = null,
  destinationFolderName = null,
  onClose,
  onImported,
  className,
}: SourcePreviewPanelProps) {
  const [preview, setPreview] = useState<SourcePreviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<SourceConfirmResponse | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  /** ⚠ Open/closed is about FILES. The header — label and count — renders either way. */
  const [open, setOpen] = useState<Record<string, boolean>>({ unk: true })

  useEffect(() => {
    if (!connectionId || !folderId) {
      setPreview(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    setResult(null)
    previewSource(connectionId, {
      folder_id: folderId,
      folder_name: folderName ?? null,
      destination_folder_id: destinationFolderId,
      destination_folder_name: destinationFolderName,
    })
      .then((res) => {
        if (!cancelled) setPreview(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not read that folder.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [connectionId, folderId, folderName, destinationFolderId, destinationFolderName])

  const counts = useMemo(() => {
    const base: Record<string, number> = { add: 0, here: 0, uns: 0, unk: 0 }
    for (const b of BUCKET_ORDER) base[b] = preview?.counts?.[b] ?? 0
    return base
  }, [preview])

  const total = preview?.total ?? 0

  /** After a confirm, the outcomes drive the bar instead of the buckets — 230-A's dissolve. */
  const outcomeCounts = useMemo(() => {
    if (!result) return null
    return {
      added: result.outcomes.filter((o) => o.outcome === "added").length,
      here: result.outcomes.filter((o) => o.outcome === "here").length,
      refused: result.outcomes.filter((o) => o.outcome === "refused").length,
    }
  }, [result])

  const handleCancel = useCallback(() => {
    /* ⭐ Not "Cancelled" — the four numbers. Saying nothing happened is a promise; naming the
       zeros is a receipt. */
    setToast(CANCEL_TOAST)
    onClose?.()
  }, [onClose])

  const handleConfirm = useCallback(async () => {
    if (!connectionId || !folderId) return
    setConfirming(true)
    setError(null)
    try {
      const res = await confirmSourcePreview(connectionId, {
        folder_id: folderId,
        folder_name: folderName ?? null,
        destination_folder_id: destinationFolderId,
        destination_folder_name: destinationFolderName,
      })
      setResult(res)
      onImported?.(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : "The import could not be started.")
    } finally {
      setConfirming(false)
    }
  }, [connectionId, folderId, folderName, destinationFolderId, destinationFolderName, onImported])

  if (!folderId) return null

  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)

  return (
    <div
      data-testid="source-preview"
      className={cn(
        "rounded-xl border border-border/60 bg-card/60 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {/* ── header ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 border-b border-border/40 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{PREVIEW_TITLE}</div>
          <div className="truncate text-xs text-muted-foreground">
            {folderName || "Selected folder"}
          </div>
        </div>
        {loading && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {SCANNING}
          </span>
        )}
        {!loading && preview && (
          <span className="shrink-0 text-xs text-muted-foreground">{total} files</span>
        )}
      </div>

      {error && (
        <div
          data-testid="source-preview-error"
          className="flex items-start gap-2 px-4 py-3 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {preview && (
        <div className="px-4 py-3">
          {preview.truncated && (
            <div data-testid="preview-truncated" className="mb-2 text-xs text-amber-600">
              {PREVIEW_TRUNCATED}
            </div>
          )}

          {/* ── the bar: ONE object, always summing to the folder ──────────────── */}
          <div
            data-testid="preview-bar"
            className="flex h-7 w-full overflow-hidden rounded-md border border-border/50"
          >
            {!outcomeCounts &&
              BUCKET_ORDER.map((b) => (
                <div
                  key={b}
                  data-segment={b}
                  style={{
                    width: `${pct(counts[b])}%`,
                    ...(b === "unk" ? HATCH_STYLE : {}),
                  }}
                  className={cn(
                    "flex items-center justify-center transition-[width] duration-500",
                    b === "unk" ? "animate-pulse" : SEG_CLASS[b],
                  )}
                />
              ))}
            {outcomeCounts && (
              <>
                <div
                  data-segment="added"
                  style={{ width: `${pct(outcomeCounts.added)}%` }}
                  className="bg-emerald-500/70 transition-[width] duration-700"
                />
                <div
                  data-segment="here"
                  style={{ width: `${pct(outcomeCounts.here)}%` }}
                  className="bg-sky-500/50 transition-[width] duration-700"
                />
                <div
                  data-segment="refused"
                  style={{ width: `${pct(outcomeCounts.refused)}%` }}
                  className="bg-destructive/60 transition-[width] duration-700"
                />
              </>
            )}
          </div>

          {/* ── the legend: the four labels, verbatim ───────────────────────────── */}
          <div data-testid="preview-legend" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {BUCKET_ORDER.map((b) => (
              <div key={b} data-legend={b} className="min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT_CLASS[b])} />
                  <span className="text-lg font-semibold tabular-nums text-foreground">
                    {counts[b]}
                  </span>
                </div>
                <div className="truncate text-xs text-foreground">{BUCKET_LABEL[b]}</div>
                {b === "here" && (
                  <div data-legend-qualifier className="text-[11px] text-muted-foreground">
                    {HERE_QUALIFIER}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── the four accordions. Rendered unconditionally; no control removes one ── */}
          <div data-testid="preview-buckets" className="mt-4 space-y-1.5">
            {BUCKET_ORDER.map((b) => {
              const rows = (preview.items ?? []).filter((i) => i.bucket === b)
              const isOpen = !!open[b]
              return (
                <section
                  key={b}
                  data-bucket={b}
                  data-open={isOpen ? "true" : "false"}
                  className="overflow-hidden rounded-lg border border-border/50"
                >
                  {/* ⭐ The header renders in BOTH states. Collapsing hides files, never the count. */}
                  <button
                    type="button"
                    data-bucket-header={b}
                    onClick={() => setOpen((s) => ({ ...s, [b]: !s[b] }))}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/40"
                  >
                    <ChevronRight
                      className={cn("h-3.5 w-3.5 shrink-0 transition-transform", isOpen && "rotate-90")}
                    />
                    <span className="font-medium text-foreground">{BUCKET_LABEL[b]}</span>
                    <span
                      data-bucket-count={b}
                      className="ml-auto shrink-0 tabular-nums text-muted-foreground"
                    >
                      {counts[b]}
                    </span>
                  </button>
                  {isOpen && (
                    <div data-bucket-body={b}>
                      <div className="border-t border-border/40 px-3 py-1.5 text-[11px] text-muted-foreground">
                        {BUCKET_BLURB[b]}
                      </div>
                      {rows.map((item) => (
                        <BucketRow key={item.external_id} item={item} />
                      ))}
                    </div>
                  )}
                </section>
              )
            })}
          </div>

          {/* ── the confirm receipt ─────────────────────────────────────────────── */}
          {result && (
            <div data-testid="preview-reconciliation" className="mt-4 space-y-1.5">
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-foreground">
                {reconciliationLine(
                  result.accounted,
                  result.unaccounted,
                  result.preview_said_added,
                  result.actually_added,
                )}
              </div>
              {result.outcomes
                .filter((o) => o.outcome === "refused")
                .map((o) => (
                  <div
                    key={o.external_id}
                    data-outcome="refused"
                    title={o.reason ?? undefined}
                    className="flex items-center gap-2 rounded-md border border-destructive/40 px-3 py-1.5 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate text-foreground">{o.name}</span>
                    <span className="shrink-0 text-destructive">{OUTCOME_LABEL.refused}</span>
                    {/* ⛔ SC#5: the cause is NAMED on the row, not left to the colour. */}
                    <span
                      data-refusal-reason
                      className="max-w-[45%] shrink-0 truncate text-[11px] text-muted-foreground"
                    >
                      {o.reason || "No reason was given."}
                    </span>
                  </div>
                ))}
            </div>
          )}

          {total === 0 && !loading && (
            <div className="mt-3 text-xs text-muted-foreground">{PREVIEW_EMPTY}</div>
          )}
        </div>
      )}

      {/* ── the footer: the zero-write receipt ─────────────────────────────────── */}
      <div className="flex items-center gap-3 border-t border-border/40 px-4 py-2.5">
        <span data-testid="zero-write" className="text-[11px] tabular-nums text-muted-foreground">
          {ZERO_WRITE_LINE}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleCancel} data-testid="preview-cancel">
            {CANCEL_LABEL}
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={!preview || confirming || !!result || counts.add + counts.unk === 0}
            data-testid="preview-confirm"
          >
            {confirming && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {confirmLabel(counts.add, counts.unk)}
          </Button>
        </div>
      </div>

      {toast && (
        <div data-testid="preview-toast" className="px-4 pb-3 text-[11px] text-muted-foreground">
          {toast}
        </div>
      )}
    </div>
  )
}
