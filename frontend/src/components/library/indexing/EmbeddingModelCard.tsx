/**
 * Phase 217.1 plan 10 (LIB-01 / BE-2 / D-217.1-27) — the Embedding model card.
 *
 * Renders Model · Dimensions · Provider from `GET /library/index-summary`, plus the gated
 * `Change model` button. The FACTS render for every user; `Change model` renders ONLY when
 * `canManage` (the VANISH convention — absent, never disabled).
 *
 * ⛔ `Change model` does NOT open a second picker. It routes to Settings' shipped picker
 * via the exact `onNavigate("settings")` + scroll-into-view shape `LibraryPage.tsx:585-597`
 * already uses, targeting the existing `#reembed-status-card` id.
 */
import { useState } from "react"
import type React from "react"
import type { IndexSummary } from "@/lib/api"
import { kickReembed } from "@/lib/api"
import type { ActiveView } from "@/App"
import { Cpu } from "lucide-react"
import { AnimatedNumber } from "@/components/ui/AnimatedNumber"

const UNKNOWN = "Not known yet"

function Fact({ label, value, loading }: { label: string; value?: React.ReactNode; loading?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 px-1 rounded-md hover:bg-muted/30 transition-colors duration-150">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {loading ? (
        <div className="h-4 w-16 animate-pulse bg-muted/30 rounded" />
      ) : (
        <span className="min-w-0 truncate font-mono text-sm font-medium text-foreground" title={typeof value === "string" ? value : undefined}>
          {value ?? UNKNOWN}
        </span>
      )}
    </div>
  )
}

export function EmbeddingModelCard({
  summary,
  canManage,
  onNavigate,
}: {
  summary: IndexSummary | null
  /** `features.model_management === true` — gates the Change model button (VANISH). */
  canManage: boolean
  /** Routes to Settings' shipped model picker — never a second picker here. */
  /** ⚠ NARROWED 2026-08-31 — this was `(view: string) => void`, which is WIDER than
   *  the `(view: ActiveView) => void` `LibraryPage` actually passes, so tsc refused the
   *  assignment and the tab shipped with a live type error. `ActiveView` is the closed
   *  set of routes; a `string` here could name a view that does not exist. */
  onNavigate?: (view: ActiveView) => void
}) {
  const [reindexing, setReindexing] = useState(false)
  const loading = summary === null
  const model = summary?.model
  const dimensions = summary?.dimensions
  const provider = summary?.provider

  return (
    <div className="group relative rounded-xl border border-border/50 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-sm p-4 shadow-sm card-interactive overflow-hidden">
      {/* Subtle top accent gradient */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-primary">
            <Cpu className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-sm font-semibold leading-tight text-foreground">Embedding model</h3>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="change-model"
              onClick={() => {
                onNavigate?.("settings")
                // Scroll the Settings re-embed card into view — the same shape
                // LibraryPage.tsx:585-597 already uses for its deep-link.
                setTimeout(() => {
                  document
                    .getElementById("reembed-status-card")
                    ?.scrollIntoView({ behavior: "smooth", block: "center" })
                }, 100)
              }}
              className="rounded-lg border border-border/60 bg-card/60 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all duration-200 active:scale-95 shadow-sm"
            >
              Change model
            </button>
            {/* 217.1-18 — the sketch's "Re-index everything" (index.html:852), a sibling
                of Change model in the Embedding model card. Unscoped re-index — the
                same kickReembed the Settings card's "Re-index everything" fires. */}
            <button
              type="button"
              data-testid="reindex-everything"
              disabled={reindexing}
              onClick={async () => {
                setReindexing(true)
                try {
                  await kickReembed()
                } finally {
                  setTimeout(() => setReindexing(false), 2000)
                }
              }}
              className="rounded-lg border border-border/60 bg-card/60 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all duration-200 disabled:opacity-60 active:scale-95 shadow-sm"
            >
              {reindexing ? "Starting..." : "Re-index everything"}
            </button>
          </div>
        )}
      </div>
      <div className="mt-1 divide-y divide-border/20">
        <Fact label="Model" value={model} loading={loading} />
        <Fact label="Dimensions" value={dimensions == null ? undefined : <AnimatedNumber value={dimensions} />} loading={loading} />
        <Fact label="Provider" value={provider} loading={loading} />
      </div>
    </div>
  )
}
