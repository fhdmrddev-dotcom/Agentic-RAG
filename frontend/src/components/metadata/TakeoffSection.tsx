/**
 * TakeoffSection — CAD Drawing Quantities & Grounded BOQ Table (Phase 220, TAKEOFF-04).
 */
import { useEffect, useState } from "react"
import { Calculator, Download, AlertTriangle, CheckCircle2, Loader2, FileSpreadsheet } from "lucide-react"
import { listDocuments } from "@/lib/api"
import {
  fetchDocumentTakeoff,
  matchDocumentTakeoff,
  resolveDocumentTakeoffItem,
  type DocumentTakeoffPayload,
} from "@/lib/api/takeoff"
import type { Document } from "@/types"
import { cn } from "@/lib/utils"

interface TakeoffSectionProps {
  doc: Document
  onTotalChange?: (count: number) => void
  onRefresh?: () => void
}

export function TakeoffSection({ doc, onTotalChange, onRefresh }: TakeoffSectionProps) {
  const [takeoff, setTakeoff] = useState<DocumentTakeoffPayload | null>(() => {
    return (doc.metadata?._takeoff as DocumentTakeoffPayload) || null
  })
  const [loading, setLoading] = useState<boolean>(!takeoff)
  const [error, setError] = useState<string | null>(null)

  // Rate sheet selection & matching state
  const [rateDocs, setRateDocs] = useState<Document[]>([])
  const [selectedRateDocId, setSelectedRateDocId] = useState<string>(() => {
    return takeoff?.rate_sheet_document_id || ""
  })
  const [matching, setMatching] = useState<boolean>(false)
  const [resolvingKey, setResolvingKey] = useState<string | null>(null)

  // Fetch takeoff if missing on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const data = await fetchDocumentTakeoff(doc.id)
        if (!cancelled) {
          setTakeoff(data)
          if (data.rate_sheet_document_id) {
            setSelectedRateDocId(data.rate_sheet_document_id)
          }
          const itemCount = data.boq?.items?.length || Object.keys(data.blocks || {}).length
          onTotalChange?.(itemCount)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to load takeoff"
          setError(msg)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (!takeoff || !takeoff.blocks) {
      load()
    } else {
      const itemCount = takeoff.boq?.items?.length || Object.keys(takeoff.blocks || {}).length
      onTotalChange?.(itemCount)
    }
    return () => {
      cancelled = true
    }
  }, [doc.id])

  // Fetch available rate sheets (.xlsx, .xls, .csv)
  useEffect(() => {
    let cancelled = false
    async function fetchSheets() {
      try {
        const allDocs = await listDocuments()
        if (!cancelled) {
          const sheets = allDocs.filter((d) => {
            const name = d.filename.toLowerCase()
            return (
              name.endsWith(".xlsx") ||
              name.endsWith(".xls") ||
              name.endsWith(".csv") ||
              d.mime_type?.includes("spreadsheet") ||
              d.mime_type?.includes("csv")
            )
          })
          setRateDocs(sheets)
          if (!selectedRateDocId && sheets.length > 0) {
            setSelectedRateDocId(sheets[0].id)
          }
        }
      } catch {
        // Non-blocking
      }
    }
    fetchSheets()
    return () => {
      cancelled = true
    }
  }, [])

  const handleMatch = async () => {
    if (!selectedRateDocId) return
    try {
      setMatching(true)
      setError(null)
      const boq = await matchDocumentTakeoff(doc.id, selectedRateDocId)
      setTakeoff((prev) => (prev ? { ...prev, boq, rate_sheet_document_id: selectedRateDocId } : null))
      onTotalChange?.(boq.items.length)
      onRefresh?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to match rate sheet"
      setError(msg)
    } finally {
      setMatching(false)
    }
  }

  const handleResolve = async (itemKey: string, chosenCode: string) => {
    if (!chosenCode) return
    try {
      setResolvingKey(itemKey)
      const updatedBoq = await resolveDocumentTakeoffItem(doc.id, itemKey, chosenCode)
      setTakeoff((prev) => (prev ? { ...prev, boq: updatedBoq } : null))
      onRefresh?.()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to resolve item"
      setError(msg)
    } finally {
      setResolvingKey(null)
    }
  }

  const handleExportCSV = () => {
    const boq = takeoff?.boq
    if (!boq || !boq.items || boq.items.length === 0) return

    const headers = ["Item Key", "Category", "Source Text", "Rate Code", "Description", "Quantity", "Unit", "Rate", "Amount", "Basis", "Status"]
    const rows = boq.items.map((i) => [
      `"${i.item_key}"`,
      `"${i.category}"`,
      `"${(i.source_text || "").replace(/"/g, '""')}"`,
      `"${i.rate_code || ""}"`,
      `"${(i.description || "").replace(/"/g, '""')}"`,
      i.quantity,
      `"${i.unit || ""}"`,
      i.rate !== null ? i.rate : "",
      i.amount !== null ? i.amount : "",
      `"${i.basis}"`,
      `"${i.status}"`,
    ])

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `takeoff_${doc.filename.replace(/\.dxf$/i, "")}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-panel-muted-foreground text-xs gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Reading CAD geometry and block counts...
      </div>
    )
  }

  if (error && !takeoff) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
        <p className="font-medium">Takeoff Error</p>
        <p className="mt-1">{error}</p>
      </div>
    )
  }

  if (!takeoff) {
    return (
      <div className="py-6 text-center text-xs text-panel-muted-foreground">
        No CAD takeoff data extracted for this file.
      </div>
    )
  }

  const boq = takeoff.boq
  const isRefused = takeoff.refused || boq?.refused

  return (
    <div className="space-y-4 text-xs">
      {/* Unitless Refusal Alert (Invariant G-6) */}
      {isRefused && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-600 dark:text-amber-400">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 flex-none mt-0.5" />
            <div>
              <p className="font-semibold">Drawing Declares No Units ($INSUNITS=0)</p>
              <p className="mt-0.5 text-[11px] opacity-90">
                {takeoff.refusal_reason || "Refusing to price: drawing units cannot be assumed safely."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border/40 bg-card/60 p-2.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Total Estimated Cost
          </span>
          <div className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {boq?.totals?.total_estimated_cost !== undefined
              ? `$${boq.totals.total_estimated_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : "Unpriced"}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {boq ? `${boq.totals.matched_count} of ${boq.totals.total_items} items priced` : "Needs rate sheet match"}
          </span>
        </div>

        <div className="rounded-lg border border-border/40 bg-card/60 p-2.5 flex flex-col justify-between">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Ambiguity & Review
            </span>
            <div className="mt-1 flex items-center gap-1.5">
              {boq?.totals?.ambiguous_count ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                  <AlertTriangle className="h-3 w-3" />
                  {boq.totals.ambiguous_count} need review
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                  <CheckCircle2 className="h-3 w-3" />
                  No ambiguities
                </span>
              )}
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground mt-1">
            Units: <span className="font-mono text-foreground">{takeoff.units || "unknown"}</span>
          </span>
        </div>
      </div>

      {/* Rate Sheet Matcher Bar */}
      <div className="rounded-lg border border-border/40 bg-card/40 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
            Reference Rate Sheet
          </span>
          {boq && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              <Download className="h-3 w-3" />
              Export CSV
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedRateDocId}
            onChange={(e) => setSelectedRateDocId(e.target.value)}
            disabled={matching || rateDocs.length === 0}
            className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Select reference rate sheet"
          >
            {rateDocs.length === 0 ? (
              <option value="">No Excel rate sheets found in Library</option>
            ) : (
              rateDocs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.filename}
                </option>
              ))
            )}
          </select>

          <button
            type="button"
            onClick={handleMatch}
            disabled={matching || !selectedRateDocId}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-medium text-xs hover:bg-primary/90 disabled:opacity-50 transition-colors flex-none"
          >
            {matching ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Matching...
              </>
            ) : (
              <>
                <Calculator className="h-3 w-3" />
                {boq ? "Re-Match" : "Match Rates"}
              </>
            )}
          </button>
        </div>

        {error && <p className="text-[11px] text-destructive mt-1">{error}</p>}
      </div>

      {/* BOQ Items Table */}
      {boq && boq.items.length > 0 ? (
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-foreground">
            Bill of Quantities ({boq.items.length} lines)
          </span>

          <div className="max-h-[360px] overflow-auto rounded-lg border border-border/50 divide-y divide-border/30 bg-card/20">
            {boq.items.map((item) => (
              <div key={item.item_key} className="p-2.5 hover:bg-muted/30 transition-colors space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs font-semibold text-foreground truncate">
                      {item.source_text}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {item.description || "Unmatched CAD element"}
                    </p>
                  </div>

                  <div className="text-right flex-none">
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {item.amount !== null ? `$${item.amount.toFixed(2)}` : "—"}
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      {item.quantity} {item.unit} {item.rate !== null && `@ $${item.rate.toFixed(2)}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 gap-2">
                  {/* Basis Badge */}
                  <span
                    className={cn(
                      "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border",
                      item.basis === "read" && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                      item.basis === "matched" && "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
                      item.basis === "ambiguous" && "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                      item.basis === "unpriced" && "bg-muted text-muted-foreground border-border",
                    )}
                  >
                    {item.basis === "read"
                      ? "READ (EXACT)"
                      : item.basis === "matched"
                        ? "MATCHED"
                        : item.basis === "ambiguous"
                          ? "NEEDS REVIEW"
                          : "UNPRICED"}
                  </span>

                  {/* Disambiguation Action for Ambiguous Rows */}
                  {item.status === "ambiguous" && item.candidates.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <select
                        onChange={(e) => handleResolve(item.item_key, e.target.value)}
                        disabled={resolvingKey === item.item_key}
                        defaultValue=""
                        className="rounded border border-amber-500/40 bg-background px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none"
                        aria-label={`Resolve candidate for ${item.source_text}`}
                      >
                        <option value="" disabled>
                          Select rate code...
                        </option>
                        {item.candidates.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.code} — {c.desc.slice(0, 24)} (${c.rate}/{c.unit})
                          </option>
                        ))}
                      </select>
                      {resolvingKey === item.item_key && <Loader2 className="h-3 w-3 animate-spin text-amber-500" />}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Raw extracted block list if not matched yet */
        takeoff.blocks && Object.keys(takeoff.blocks).length > 0 && (
          <div className="space-y-2">
            <span className="text-[11px] font-semibold text-foreground">
              Counted CAD Blocks ({Object.keys(takeoff.blocks).length} unique)
            </span>
            <div className="rounded-lg border border-border/50 divide-y divide-border/30 bg-card/20 p-2 space-y-1">
              {Object.entries(takeoff.blocks).map(([bname, qty]) => (
                <div key={bname} className="flex items-center justify-between py-1 text-xs font-mono">
                  <span className="text-foreground">{bname}</span>
                  <span className="text-muted-foreground">{qty} count</span>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}
