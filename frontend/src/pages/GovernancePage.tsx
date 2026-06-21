/**
 * Phase 119 Plan 02 Task 1 — GovernancePage (DGOV-01 / DGOV-02 / UX-01).
 *
 * The Governance top-level home: "Library Health, three different lists,
 * read-only, link-out instead of inline-remove." A counter header + THREE
 * STACKED HealthPanel-styled cards (D-119-7 — NOT Tabs): broken relationships /
 * unclassified documents / low-confidence metadata. Each card fetches its signal
 * independently behind the D-119-9 initializedTabsRef infinite-loop guard, and
 * each row is a pure link-out to the document's DocumentDetailPanel (DGOV-02 —
 * the fix actions live in the panel's Relationships / Classification / Metadata
 * sections; this surface never mutates, D-119-6).
 *
 * Three-homes / no-router: self-fetching, no props (exactly like
 * ClassificationRulesPage). Mounted by the ChatLayout `activeView === "governance"`
 * branch (Task 2) — see the D-119-2 navigation triad.
 *
 * A5 (RESEARCH Pitfall 4): the lighter reuse — each card renders the first
 * MAX_ROWS rows of its signal and surfaces the TRUE `total` in the card header /
 * counter, rather than full PaginationControls. D-119-7/8 favor the lighter
 * HealthPanel-style reuse; the count stays honest.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Link2Off, Wand2, AlertTriangle, RefreshCw, type LucideIcon } from "lucide-react"
import { HealthEmptyState } from "@/components/health/HealthEmptyState"
import { GovernanceRow } from "@/components/health/GovernanceRow"
import { ConfidenceChip } from "@/components/metadata/ConfidenceChip"
import { DocumentDetailPanel } from "@/components/metadata/DocumentDetailPanel"
import {
  getGovBroken,
  getGovUnclassified,
  getGovLowConfidence,
  listDocuments,
  type GovBrokenItem,
  type GovUnclassifiedItem,
  type GovLowConfidenceItem,
} from "@/lib/api"
import type { Document } from "@/types"

// The lighter A5 reuse: show the first N rows of each signal; the header count is
// the TRUE total. (No PaginationControls — D-119-7/8 favor the lighter reuse.)
const MAX_ROWS = 10

type CardKey = "broken" | "unclassified" | "low-confidence"
const CARD_KEYS: readonly CardKey[] = ["broken", "unclassified", "low-confidence"] as const

interface CardState<T> {
  loading: boolean
  error: string | null
  items: T[]
  total: number
}

const EMPTY_CARD = { loading: true, error: null, items: [], total: 0 } as const

interface CardMeta {
  title: string
  icon: LucideIcon
  iconClassName: string
  emptyHeading: string
  emptyBody: string
}

const CARD_META: Record<CardKey, CardMeta> = {
  broken: {
    title: "Broken relationships",
    icon: Link2Off,
    iconClassName: "text-[hsl(0_80%_80%)]",
    emptyHeading: "No broken links",
    emptyBody: "Every document relationship still points at a readable document.",
  },
  unclassified: {
    title: "Unclassified documents",
    icon: Wand2,
    iconClassName: "text-primary",
    emptyHeading: "Nothing to triage",
    emptyBody: "No documents have a pending classification suggestion.",
  },
  "low-confidence": {
    title: "Low-confidence metadata",
    icon: AlertTriangle,
    iconClassName: "text-[hsl(var(--panel-status-active))]",
    emptyHeading: "Metadata looks solid",
    emptyBody: "No document has an extracted field below the low-confidence tier.",
  },
}

export function GovernancePage() {
  const [broken, setBroken] = useState<CardState<GovBrokenItem>>({ ...EMPTY_CARD, items: [] })
  const [unclassified, setUnclassified] = useState<CardState<GovUnclassifiedItem>>({ ...EMPTY_CARD, items: [] })
  const [lowConf, setLowConf] = useState<CardState<GovLowConfidenceItem>>({ ...EMPTY_CARD, items: [] })

  // The page OWNS its own detail-panel mount + selectedDocId (it is a top-level
  // home, NOT inside IngestionPage). DocumentDetailPanel needs a FULL Document
  // (carries .metadata) — the governance signals carry only ids, so we hold the
  // caller's docs (listDocuments) and resolve the clicked id to its Document.
  const [documents, setDocuments] = useState<Document[]>([])
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const selectedDoc = useMemo(
    () => (selectedDocId === null ? null : documents.find((d) => d.id === selectedDocId) ?? null),
    [selectedDocId, documents],
  )

  const loadDocuments = useCallback(() => {
    listDocuments()
      .then(setDocuments)
      .catch(() => {
        /* degrade: the cards still render + count; a click just can't resolve a Document */
      })
  }, [])

  const fetchCard = useCallback((key: CardKey) => {
    if (key === "broken") {
      setBroken((s) => ({ ...s, loading: true, error: null }))
      getGovBroken(0, MAX_ROWS)
        .then((res) => setBroken({ loading: false, error: null, items: res.items, total: res.total }))
        .catch(() => setBroken({ loading: false, error: "Couldn't load broken relationships.", items: [], total: 0 }))
    } else if (key === "unclassified") {
      setUnclassified((s) => ({ ...s, loading: true, error: null }))
      getGovUnclassified(0, MAX_ROWS)
        .then((res) => setUnclassified({ loading: false, error: null, items: res.items, total: res.total }))
        .catch(() => setUnclassified({ loading: false, error: "Couldn't load unclassified documents.", items: [], total: 0 }))
    } else {
      setLowConf((s) => ({ ...s, loading: true, error: null }))
      getGovLowConfidence(0, MAX_ROWS)
        .then((res) => setLowConf({ loading: false, error: null, items: res.items, total: res.total }))
        .catch(() => setLowConf({ loading: false, error: "Couldn't load low-confidence metadata.", items: [], total: 0 }))
    }
  }, [])

  // D-119-9 (BUG-260516-02 landmine): track which cards we've already initialized
  // via a ref so an empty (total:0) API response does NOT trigger an infinite
  // re-fetch loop. The ref doesn't trigger re-renders; the effect fires each card's
  // fetch exactly once. Carried verbatim from KnowledgeHealthPage.tsx:243-251.
  const initializedTabsRef = useRef<Set<CardKey>>(new Set())

  useEffect(() => {
    loadDocuments()
    for (const key of CARD_KEYS) {
      if (!initializedTabsRef.current.has(key)) {
        initializedTabsRef.current.add(key)
        fetchCard(key)
      }
    }
  }, [fetchCard, loadDocuments])

  // Refresh: clear the init ref then re-trigger all 3 fetches (+ the doc list).
  // Carried from KnowledgeHealthPage.tsx:385-390.
  const handleRefresh = useCallback(() => {
    initializedTabsRef.current.clear()
    loadDocuments()
    for (const key of CARD_KEYS) {
      initializedTabsRef.current.add(key)
      fetchCard(key)
    }
  }, [fetchCard, loadDocuments])

  const counts = {
    broken: broken.total,
    unclassified: unclassified.total,
    "low-confidence": lowConf.total,
  }

  function renderCardBody(key: CardKey) {
    const meta = CARD_META[key]
    const state =
      key === "broken" ? broken : key === "unclassified" ? unclassified : lowConf

    if (state.loading) {
      return (
        <div role="status" aria-live="polite" className="flex items-center justify-center py-10 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
          Loading…
        </div>
      )
    }
    if (state.error) {
      return (
        <div role="alert" className="flex flex-col items-center gap-2 py-8 px-4 text-center">
          <p className="text-sm text-destructive">{state.error}</p>
          <Button variant="outline" size="sm" onClick={() => fetchCard(key)}>
            Try again
          </Button>
        </div>
      )
    }
    if (state.total === 0) {
      return <HealthEmptyState heading={meta.emptyHeading} body={meta.emptyBody} variant="positive" />
    }

    return (
      <div className="divide-y divide-border/30">
        {key === "broken" &&
          broken.items.map((item) => {
            const openId = item.document_id ?? item.readable_doc_id
            const doc = openId ? documents.find((d) => d.id === openId) : undefined
            const filename = doc?.filename ?? "Linked document"
            return (
              <GovernanceRow
                key={item.relationship_id}
                docId={openId}
                filename={filename}
                chip={
                  <span className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground shrink-0">
                    {item.rel_type}
                  </span>
                }
                onOpen={setSelectedDocId}
              />
            )
          })}

        {key === "unclassified" &&
          unclassified.items.map((item) => (
            <GovernanceRow
              key={item.document_id}
              docId={item.document_id}
              filename={item.filename}
              chip={
                item.suggested_folder_name ? (
                  <span className="text-[10px] uppercase tracking-wider font-mono text-primary shrink-0">
                    → {item.suggested_folder_name}
                  </span>
                ) : undefined
              }
              onOpen={setSelectedDocId}
            />
          ))}

        {key === "low-confidence" &&
          lowConf.items.map((item) => (
            <GovernanceRow
              key={item.document_id}
              docId={item.document_id}
              filename={item.filename}
              chip={<ConfidenceChip score={item.min_confidence} />}
              onOpen={setSelectedDocId}
            />
          ))}

        {state.total > state.items.length && (
          <p className="text-xs text-muted-foreground text-center py-2 px-4">
            Showing {state.items.length} of {state.total} — open a document to act on it.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="h-full overflow-hidden grid" style={{ gridTemplateColumns: selectedDoc ? "minmax(0,1fr) 430px" : "minmax(0,1fr)" }}>
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 space-y-5">
          {/* Counter header — distinct from "Library Health" (D-119-1). */}
          <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-headline font-bold">Document Governance</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {counts.broken} broken {counts.broken === 1 ? "link" : "links"} · {counts.unclassified}{" "}
                unclassified · {counts["low-confidence"]} low-confidence
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 self-start" onClick={handleRefresh}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Refresh
            </Button>
          </header>

          {/* 3 STACKED HealthPanel-styled cards (D-119-7 — NOT Tabs). Mobile-stacks
              naturally (single column always; max-w caps desktop width). */}
          {CARD_KEYS.map((key) => {
            const meta = CARD_META[key]
            const Icon = meta.icon
            return (
              <Card key={key} className="ghost-border bg-card/50 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${meta.iconClassName}`} aria-hidden="true" />
                    <CardTitle className="text-base font-headline font-bold">{meta.title}</CardTitle>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {counts[key]} {counts[key] === 1 ? "document" : "documents"}
                  </span>
                </CardHeader>
                <CardContent className="p-0">{renderCardBody(key)}</CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* DGOV-02 link-out: the page owns its own DocumentDetailPanel mount. The fix
          actions live in the panel's Relationships / Classification / Metadata
          sections — governance itself stays read-only (D-119-6). */}
      {selectedDoc && (
        <DocumentDetailPanel
          doc={selectedDoc}
          onClose={() => setSelectedDocId(null)}
          onReconcile={handleRefresh}
        />
      )}
    </div>
  )
}
