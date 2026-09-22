/**
 * Phase 262 plan 03 (PACK-11) — the Expert catalog.
 *
 * ⛔ THIS PAGE OWNS NO VISIBILITY OPINION. It renders `filterExperts(experts, …)` over exactly
 * what the shipped grant-aware list read returned and nothing else. There is no second variant
 * of a card, no disabled row and no second list of Experts-you-could-have — PACK-11's vanish IS
 * the server's list arriving shorter, and the page must have no mechanism by which a row could
 * be re-added. That is why it makes exactly ONE read, with its defaults, and reaches for no
 * other client function (D-262-07: no new endpoint, no second one).
 *
 * ⛔ TWO OTHER READS ARE DELIBERATELY NOT USED, and they are named in `262-03-SUMMARY.md`
 * rather than here — the acceptance greps that prove this page never reaches either of them
 * would be satisfied by a comment spelling them, which is the trap plan 02 recorded. In words:
 * the list function's MANAGEMENT arm returns the unfiltered roster and requires `experts:manage`,
 * a different question entirely; and the per-Expert RESOLVER endpoint returns a shape carrying
 * none of the four presentation columns migration 189 added.
 *
 * ⚠ THE REFUSAL STATE RENDERS THE SERVER'S OWN SENTENCE. `handleResponse`
 * (`lib/api/experts.ts:155-175`) already folds `detail.detail` and then `detail.upgrade_hint`
 * into the thrown `Error.message`, so a non-enterprise org's tier refusal arrives as prose
 * written by the API. It is rendered verbatim beside ZERO cards. This is D-262-10's flagged
 * edge, taken deliberately: D-262-02 governs what the catalog LISTS, and the shipped
 * `InviteExpertDialog.tsx:102-106` already renders the same string in the same situation, so a
 * second refusal vocabulary here would make two surfaces disagree about one fact. Raised at
 * phase close; cheap to reverse.
 *
 * ⚠ `folders` is declared on the props interface HERE so plans 04 and 05 wire against a stated
 * contract rather than guessing — but it is deliberately NOT destructured, because its first
 * CONSUMER is the detail modal in plan 04. `tsconfig.app.json` sets `noUnusedParameters`, and an
 * unused destructured binding raises `TS6133`. The prop ships; only the binding waits.
 */

import { useEffect, useState } from "react"
import { AlertCircle, Search, Sparkles } from "lucide-react"
import { listExperts } from "@/lib/api"
import type { ExpertBundle, Folder } from "@/types"
import { cn } from "@/lib/utils"
import { ExpertCard } from "./ExpertCard"
import { ALL_CATEGORIES, categoriesOf, filterExperts } from "./expertCatalog"

export interface ExpertCatalogPageProps {
  /**
   * The caller's visible folders, for naming an Expert's knowledge scope. Consumed by the
   * detail modal (plan 04) via `resolveFolderNames`; declared now so the contract is one place.
   */
  folders: Folder[]
  /** Start a scoped conversation with this Expert (PACK-13, wired in plan 05). */
  onStartChat: (expert: ExpertBundle) => void | Promise<void>
  /** Open the Expert's detail view (PACK-12, built in plan 04). */
  onInspect?: (expert: ExpertBundle) => void
}

export function ExpertCatalogPage(props: ExpertCatalogPageProps) {
  const [experts, setExperts] = useState<ExpertBundle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState(ALL_CATEGORIES)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    // ⛔ The ONE read. Defaults only — the grant-aware arm.
    listExperts()
      .then((data) => {
        if (!mounted) return
        setExperts(data)
        setLoading(false)
      })
      .catch((err) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : "Failed to load experts")
        setExperts([])
        setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const categories = categoriesOf(experts)
  const visible = filterExperts(experts, { query, category })
  const handleInspect = (expert: ExpertBundle) => props.onInspect?.(expert)
  const handleStartChat = (expert: ExpertBundle) => {
    void props.onStartChat(expert)
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-6">
      <div className="border-b border-border/60 pb-5">
        <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground">
          <Sparkles className="h-5 w-5 text-primary" />
          <span>Expert Catalog</span>
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Domain specialists you can consult. Every Expert shown here is one you can actually use.
        </p>
      </div>

      {/* ── toolbar: free-text search + DERIVED category pills ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            aria-label="Search experts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, topic, or capability..."
            className="w-full rounded-lg border border-input bg-background/80 py-1.5 pl-9 pr-3 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {!loading && !error && experts.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Showing <strong>{visible.length}</strong> of {experts.length} expert
            {experts.length === 1 ? "" : "s"}
          </div>
        )}
      </div>

      {/* ⛔ One pill per category PRESENT IN THE ROWS, plus the All control. An empty catalog
          renders no pills at all — a pill menu nobody authored would advertise a shape the data
          does not have. */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[ALL_CATEGORIES, ...categories].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors",
                category === c
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/70 bg-muted/30 text-muted-foreground hover:text-foreground",
              )}
            >
              {c === ALL_CATEGORIES ? "All" : c}
            </button>
          ))}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
          <Sparkles className="h-4 w-4 animate-spin text-primary" />
          Loading the expert catalog...
        </div>
      )}

      {!loading && error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 flex-none" />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && experts.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/80 p-12 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm text-muted-foreground">
            No Experts are available to you yet.
          </p>
        </div>
      )}

      {!loading && !error && experts.length > 0 && visible.length === 0 && (
        <div className="rounded-xl border border-dashed border-border/80 p-12 text-center text-xs text-muted-foreground">
          No Expert matched that search.
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((expert) => (
            <ExpertCard
              key={expert.id}
              expert={expert}
              onInspect={handleInspect}
              onStartChat={handleStartChat}
            />
          ))}
        </div>
      )}
    </div>
  )
}
