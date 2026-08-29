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
import type { IndexSummary } from "@/lib/api"

const UNKNOWN = "Not known yet"

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-mono text-sm text-foreground" title={value}>
        {value}
      </span>
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
  onNavigate?: (view: string) => void
}) {
  const model = summary?.model
  const dimensions = summary?.dimensions
  const provider = summary?.provider

  return (
    <div className="rounded-xl bg-card/50 ghost-border px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-tight">Embedding model</h3>
        {canManage && (
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
            className="rounded-lg border border-border bg-card/50 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent/40 transition-colors"
          >
            Change model
          </button>
        )}
      </div>
      <div className="mt-1">
        <Fact label="Model" value={model ?? UNKNOWN} />
        <Fact label="Dimensions" value={dimensions == null ? UNKNOWN : String(dimensions)} />
        <Fact label="Provider" value={provider ?? UNKNOWN} />
      </div>
    </div>
  )
}
