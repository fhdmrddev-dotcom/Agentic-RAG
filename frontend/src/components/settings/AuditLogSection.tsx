import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
// ⚠ THE BARREL, NEVER A `lib/api/` SUBMODULE. Every SettingsPage suite mocks `@/lib/api`; a
// submodule import would silently escape the mock and hit the network (283-01, T-283-03).
import { getAuditLogs, exportAuditLogs } from "@/lib/api"
import type { AuditEntry } from "@/lib/api"
import { Download, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { SyrelLoader } from "@/components/ui/SyrelLoader"

/**
 * The Audit Log tab body. Phase 283-01 (D-14) moved it VERBATIM out of `pages/SettingsPage.tsx`
 * (the `MemorySection.tsx` sibling shape: named export, no props). The only edit on the move
 * is the `export`; the helpers stay module-private.
 */

// ── Audit Log Section ─────────────────────────────────────────────────────────

const SINCE_OPTIONS = [
  { label: "All", value: undefined },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
  { label: "90d", value: "90d" },
] as const

const ACTION_TYPES = [
  "document.upload", "document.delete", "search.query",
  "code.execute", "skill.load", "thread.create",
  "thread.delete", "settings.update",
]

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function formatDetails(actionType: string, metadata: Record<string, unknown>): string {
  switch (actionType) {
    case "document.upload": {
      const fname = (metadata.filename as string) ?? ""
      const size = metadata.file_size as number | undefined
      return size !== undefined ? `${fname} (${formatBytes(size)})` : fname
    }
    case "document.delete":
      return (metadata.filename as string) ?? ""
    case "search.query": {
      let text = (metadata.query_text as string) ?? ""
      if (text.length > 60) text = text.slice(0, 60) + "\u2026"
      return `\u201c${text}\u201d`
    }
    case "code.execute":
      return (metadata.language as string) ?? ""
    case "skill.load":
      return (metadata.skill_name as string) ?? ""
    case "thread.create":
    case "thread.delete":
      return "\u2014"
    case "settings.update": {
      const newSettings = (metadata.new_settings as Record<string, unknown>) ?? {}
      return Object.keys(newSettings).join(", ")
    }
    default:
      return ""
  }
}

export function AuditLogSection() {
  const [page, setPage] = useState(1)
  const [since, setSince] = useState<string | undefined>(undefined)
  const [actionType, setActionType] = useState<string | undefined>(undefined)
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const pageSize = 50
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    setLoading(true)
    setError(null)
    getAuditLogs(page, since, actionType)
      .then(({ entries: e, total: t }) => { setEntries(e); setTotal(t) })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [page, since, actionType])

  const handleSinceChange = (value: string | undefined) => {
    setSince(value)
    setPage(1)
  }

  const handleActionTypeChange = (value: string) => {
    setActionType(value || undefined)
    setPage(1)
  }

  const handleExport = async () => {
    setExporting(true)
    setExportError(null)
    try {
      await exportAuditLogs(since, actionType)
    } catch {
      setExportError("Export failed. Please try again.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <Card className="ghost-border bg-card/60 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base font-headline font-bold">Audit Log</CardTitle>
          <CardDescription>Your account activity — all significant actions recorded for security and compliance.</CardDescription>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Button size="sm" className="gap-2 gradient-primary" onClick={handleExport} disabled={exporting || loading}>
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export CSV
          </Button>
          {exportError && (
            <p className="text-xs text-destructive mt-1">{exportError}</p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters row */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {SINCE_OPTIONS.map(opt => (
            <button
              key={opt.label}
              onClick={() => handleSinceChange(opt.value)}
              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                since === opt.value
                  ? "bg-primary/10 text-primary border border-primary/30 font-bold"
                  : "bg-muted/30 text-muted-foreground ghost-border"
              }`}
            >
              {opt.label}
            </button>
          ))}
          <select
            className="ml-auto text-sm rounded-md bg-muted/30 ghost-border px-2 h-8 focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={actionType ?? ""}
            onChange={e => handleActionTypeChange(e.target.value)}
          >
            <option value="">All types</option>
            {ACTION_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Table or state */}
        {error ? (
          <p className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-lg">
            Failed to load audit log. Refresh the page to try again.
          </p>
        ) : loading ? (
          <SyrelLoader size="panel" className="py-8" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-xs font-bold text-muted-foreground text-left pb-2 pr-4 w-40">Timestamp</th>
                <th className="text-xs font-bold text-muted-foreground text-left pb-2 pr-4 w-40">Action</th>
                <th className="text-xs font-bold text-muted-foreground text-left pb-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                    No entries found for this period.
                  </td>
                </tr>
              ) : entries.map(entry => (
                <tr key={entry.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                  <td className="py-2 pr-4 text-muted-foreground font-mono text-xs">{formatTimestamp(entry.created_at)}</td>
                  <td className="py-2 pr-4">
                    <span className="font-mono text-xs bg-muted/30 px-2 py-1 rounded ghost-border">{entry.action_type}</span>
                  </td>
                  <td className="py-2 text-muted-foreground">{formatDetails(entry.action_type, entry.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {!error && !loading && total > 0 && (
          <div className="flex items-center justify-end gap-2 mt-4">
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </Button>
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
              Next <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
