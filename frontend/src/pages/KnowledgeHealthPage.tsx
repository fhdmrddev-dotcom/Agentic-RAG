import { useCallback, useEffect, useState } from "react"
import { RefreshCw, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  getHealthOverview,
  getRetrievalTrend,
  getMostRetrieved,
  getNeverRetrieved,
  getStaleDocs,
  getLowConfidenceDocs,
  getLowConfidenceQueries,
  getFeedbackStats,
} from "@/lib/api"
import type {
  HealthOverview,
  RetrievalTrendPoint,
  PaginatedResponse,
  MostRetrievedDoc,
  NeverRetrievedDoc,
  StaleDoc,
  LowConfidenceDoc,
  LowConfidenceQuery,
  FeedbackStats,
} from "@/lib/api"
import { HealthScoreGauge } from "@/components/health/HealthScoreGauge"
import { RetrievalTrendChart } from "@/components/health/RetrievalTrendChart"
import { PaginationControls } from "@/components/health/PaginationControls"
import { HealthEmptyState } from "@/components/health/HealthEmptyState"
import { HealthDocumentRow } from "@/components/health/HealthDocumentRow"
import { FeedbackStatsPanel } from "@/components/health/FeedbackStatsPanel"

function formatDaysOld(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000)
  return `${days}d old`
}

function ConfidenceChip({ similarity }: { similarity: number }) {
  const pct = Math.round(similarity * 100)
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-amber-400 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  )
}

function StaleChip({ daysStale }: { daysStale: number }) {
  const colorClass =
    daysStale > 365
      ? "bg-red-400/10 text-red-400"
      : daysStale > 180
        ? "bg-orange-400/10 text-orange-400"
        : "bg-amber-400/10 text-amber-400"
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 tabular-nums ${colorClass}`}>
      {daysStale}d stale
    </span>
  )
}

function GaugeSkeleton() {
  return <div className="h-56 w-full animate-pulse bg-muted/30 rounded-lg" />
}

function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="ghost-border bg-card/50 rounded-lg p-4 space-y-2">
          <div className="animate-pulse bg-muted/30 h-3 w-20 rounded" />
          <div className="animate-pulse bg-muted/30 h-8 w-12 rounded" />
          <div className="animate-pulse bg-muted/30 h-3 w-24 rounded" />
        </div>
      ))}
    </div>
  )
}

function ChartSkeleton() {
  return (
    <div className="ghost-border bg-card/50 rounded-lg p-4 space-y-3 h-64">
      <div className="animate-pulse bg-muted/30 h-4 w-56 rounded" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="animate-pulse bg-muted/30 h-3 w-32 rounded" />
          <div className="animate-pulse bg-muted/30 h-5 rounded flex-1" style={{ maxWidth: `${60 - i * 10}%` }} />
        </div>
      ))}
    </div>
  )
}

function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="ghost-border bg-card/50 rounded-lg divide-y divide-border/30">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="animate-pulse bg-muted/30 h-4 w-4 rounded" />
          <div className="animate-pulse bg-muted/30 h-4 w-48 rounded" />
          <div className="animate-pulse bg-muted/30 h-4 w-16 rounded ml-auto" />
        </div>
      ))}
    </div>
  )
}

const TAB_LIMIT = 10

type TabKey = "most-retrieved" | "never-retrieved" | "stale" | "low-confidence-docs" | "low-confidence-queries"

interface TabState {
  items: any[]
  total: number
  offset: number
  limit: number
  loading: boolean
  error: string | null
}

const defaultTabState: TabState = {
  items: [],
  total: 0,
  offset: 0,
  limit: TAB_LIMIT,
  loading: false,
  error: null,
}

function getTabKey(activeTab: string, subTab: string): TabKey {
  if (activeTab === "low-confidence") {
    return subTab === "documents" ? "low-confidence-docs" : "low-confidence-queries"
  }
  return activeTab as TabKey
}

export function KnowledgeHealthPage() {
  const [overview, setOverview] = useState<HealthOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)

  const [trend, setTrend] = useState<RetrievalTrendPoint[]>([])
  const [trendLoading, setTrendLoading] = useState(true)
  const [trendError, setTrendError] = useState<string | null>(null)

  const [feedbackStats, setFeedbackStats] = useState<FeedbackStats | null>(null)
  const [feedbackLoading, setFeedbackLoading] = useState(true)
  const [feedbackError, setFeedbackError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState("most-retrieved")
  const [subTab, setSubTab] = useState<"documents" | "queries">("documents")

  const [tabData, setTabData] = useState<Record<TabKey, TabState>>({
    "most-retrieved": { ...defaultTabState },
    "never-retrieved": { ...defaultTabState },
    "stale": { ...defaultTabState },
    "low-confidence-docs": { ...defaultTabState },
    "low-confidence-queries": { ...defaultTabState },
  })

  const [refreshing, setRefreshing] = useState(false)

  const loadOverviewAndTrend = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    setOverviewLoading(true)
    setTrendLoading(true)
    setFeedbackLoading(true)
    setOverviewError(null)
    setTrendError(null)
    setFeedbackError(null)
    try {
      const [oRes, tRes, fRes] = await Promise.allSettled([
        getHealthOverview(),
        getRetrievalTrend(30),
        getFeedbackStats(),
      ])
      if (oRes.status === "fulfilled") setOverview(oRes.value)
      else setOverviewError("Health metrics could not be loaded. Refresh to try again.")
      if (tRes.status === "fulfilled") setTrend(tRes.value)
      else setTrendError("Retrieval trend could not be loaded.")
      if (fRes.status === "fulfilled") setFeedbackStats(fRes.value)
      else setFeedbackError("Feedback stats could not be loaded.")
    } finally {
      setOverviewLoading(false)
      setTrendLoading(false)
      setFeedbackLoading(false)
      setRefreshing(false)
    }
  }, [])

  const fetchTab = useCallback(async (key: TabKey, offset: number) => {
    setTabData((prev) => ({ ...prev, [key]: { ...prev[key], loading: true, error: null } }))
    try {
      let res: PaginatedResponse<any>
      switch (key) {
        case "most-retrieved":
          res = await getMostRetrieved(offset, TAB_LIMIT)
          break
        case "never-retrieved":
          res = await getNeverRetrieved(offset, TAB_LIMIT)
          break
        case "stale":
          res = await getStaleDocs(offset, TAB_LIMIT, 90)
          break
        case "low-confidence-docs":
          res = await getLowConfidenceDocs(offset, TAB_LIMIT)
          break
        case "low-confidence-queries":
          res = await getLowConfidenceQueries(offset, TAB_LIMIT)
          break
        default:
          return
      }
      setTabData((prev) => ({
        ...prev,
        [key]: { ...prev[key], items: res.items, total: res.total, offset: res.offset, loading: false },
      }))
    } catch {
      setTabData((prev) => ({
        ...prev,
        [key]: { ...prev[key], loading: false, error: "Failed to load data. Refresh to try again." },
      }))
    }
  }, [])

  useEffect(() => {
    loadOverviewAndTrend()
  }, [loadOverviewAndTrend])

  useEffect(() => {
    const key = getTabKey(activeTab, subTab)
    const data = tabData[key]
    if (data.items.length === 0 && !data.loading && !data.error) {
      fetchTab(key, 0)
    }
  }, [activeTab, subTab, fetchTab, tabData])

  function removeFromPanel(key: TabKey, id: string) {
    setTabData((prev) => {
      const tab = prev[key]
      if (!tab) return prev
      return {
        ...prev,
        [key]: {
          ...tab,
          items: tab.items.filter((d: any) => d.document_id !== id),
          total: Math.max(0, tab.total - 1),
        },
      }
    })
  }

  function handlePageChange(key: TabKey, newOffset: number) {
    fetchTab(key, newOffset)
  }

  function renderTabContent(key: TabKey) {
    const data = tabData[key]
    if (data.loading) return <TableSkeleton />
    if (data.error) {
      return (
        <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-lg">
          {data.error}
        </div>
      )
    }
    if (data.items.length === 0) {
      const emptyMessages: Record<TabKey, { heading: string; body: string }> = {
        "most-retrieved": {
          heading: "All quiet",
          body: "No documents were retrieved in the last 30 days.",
        },
        "never-retrieved": {
          heading: "Great coverage",
          body: "Every document in your library has been retrieved at least once.",
        },
        "stale": {
          heading: "Library is fresh",
          body: "All documents are newer than 90 days.",
        },
        "low-confidence-docs": {
          heading: "High quality matches",
          body: "No documents show consistently low similarity scores.",
        },
        "low-confidence-queries": {
          heading: "High quality matches",
          body: "No low-confidence queries recorded in the last 30 days.",
        },
      }
      const msg = emptyMessages[key]
      return <HealthEmptyState heading={msg.heading} body={msg.body} variant="positive" />
    }

    return (
      <>
        <div className="ghost-border bg-card/50 rounded-lg divide-y divide-border/30">
          {data.items.map((doc: any) => {
            if (key === "low-confidence-queries") {
              const q = doc as LowConfidenceQuery
              const pct = Math.round(q.avg_similarity * 100)
              return (
                <div key={q.query_text} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20">
                  <span className="text-sm font-medium truncate flex-1 min-w-0">{q.query_text}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-amber-400 tabular-nums w-8 text-right">{pct}%</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground shrink-0 tabular-nums">
                    {q.occurrence_count}x
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0 hidden lg:block max-w-[220px] truncate">
                    Consider adding documents about this topic.
                  </span>
                </div>
              )
            }
            const d = doc as MostRetrievedDoc | NeverRetrievedDoc | StaleDoc | LowConfidenceDoc
            let chip: React.ReactNode
            if (key === "most-retrieved") {
              chip = (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0 tabular-nums">
                  {(d as MostRetrievedDoc).retrieval_count}×
                </span>
              )
            } else if (key === "never-retrieved") {
              chip = (
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted/40 text-muted-foreground shrink-0 tabular-nums">
                  {formatDaysOld(d.created_at)}
                </span>
              )
            } else if (key === "stale") {
              chip = <StaleChip daysStale={(d as StaleDoc).days_stale} />
            } else {
              chip = <ConfidenceChip similarity={(d as LowConfidenceDoc).avg_similarity} />
            }
            return (
              <HealthDocumentRow
                key={d.document_id}
                doc={d}
                metricChip={chip}
                onRemove={(id) => removeFromPanel(key, id)}
              />
            )
          })}
        </div>
        <PaginationControls
          offset={data.offset}
          limit={data.limit}
          total={data.total}
          onChange={(newOffset) => handlePageChange(key, newOffset)}
        />
      </>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <header className="flex items-start justify-between">
          <div>
            <h1 className="font-headline font-bold text-xl">Library Health</h1>
            <p className="text-sm text-muted-foreground">Last 30 days · Stale threshold: 90 days</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground"
            onClick={() => loadOverviewAndTrend(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </header>

        {(overviewError || trendError) && (
          <div className="bg-destructive/10 text-destructive text-sm px-4 py-2 rounded-lg">
            {overviewError || trendError}
          </div>
        )}

        {/* Row 1: Gauge + KPIs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="ghost-border bg-card/50 rounded-lg p-6 flex flex-col items-center justify-center">
            {overviewLoading ? (
              <GaugeSkeleton />
            ) : (
              <HealthScoreGauge score={overview?.health_score ?? 0} />
            )}
          </div>
          <div className="lg:col-span-2">
            {overviewLoading ? (
              <StatCardsSkeleton />
            ) : (
              <div className="grid grid-cols-2 gap-3 h-full">
                <Card className="ghost-border bg-card/50 flex flex-col justify-center p-4">
                  <CardHeader className="p-0 pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Total Docs</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <p className="text-3xl font-bold font-headline tabular-nums leading-none">
                      {overview?.total_documents ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">documents in library</p>
                  </CardContent>
                </Card>
                <Card className="ghost-border bg-card/50 flex flex-col justify-center p-4">
                  <CardHeader className="p-0 pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Coverage %</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <p className="text-3xl font-bold font-headline tabular-nums leading-none text-primary">
                      {Math.round(overview?.coverage_percent ?? 0)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">unique docs retrieved / total</p>
                  </CardContent>
                </Card>
                <Card className="ghost-border bg-card/50 flex flex-col justify-center p-4">
                  <CardHeader className="p-0 pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Avg Confidence</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <p className="text-3xl font-bold font-headline tabular-nums leading-none">
                      {Math.round((overview?.avg_confidence ?? 0) * 100)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">average similarity score</p>
                  </CardContent>
                </Card>
                <Card className="ghost-border bg-card/50 flex flex-col justify-center p-4">
                  <CardHeader className="p-0 pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">Active This Month</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <p className="text-3xl font-bold font-headline tabular-nums leading-none text-emerald-400">
                      {overview?.retrieved_this_month ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">documents retrieved in 30 days</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {trendLoading ? <ChartSkeleton /> : <RetrievalTrendChart data={trend} />}
          </div>
          <div className="flex flex-col gap-3">
            {overviewLoading ? (
              <div className="ghost-border bg-card/50 rounded-lg p-4 space-y-2 h-full">
                <div className="animate-pulse bg-muted/30 h-3 w-20 rounded" />
                <div className="animate-pulse bg-muted/30 h-8 w-12 rounded" />
                <div className="animate-pulse bg-muted/30 h-3 w-24 rounded" />
              </div>
            ) : (
              <Card className="ghost-border bg-card/50 flex flex-col justify-center p-4 h-full">
                <CardHeader className="p-0 pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Coverage Trend</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-3xl font-bold font-headline tabular-nums leading-none text-primary">
                    {Math.round(overview?.coverage_percent ?? 0)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">of documents have been retrieved at least once</p>
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>{overview?.retrieved_this_month ?? 0} active this month</span>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Row 3: Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-2">
            <TabsTrigger value="most-retrieved">Most Retrieved</TabsTrigger>
            <TabsTrigger value="never-retrieved">Never Retrieved</TabsTrigger>
            <TabsTrigger value="stale">Stale</TabsTrigger>
            <TabsTrigger value="low-confidence">Low Confidence</TabsTrigger>
          </TabsList>

          <TabsContent value="most-retrieved">{renderTabContent("most-retrieved")}</TabsContent>
          <TabsContent value="never-retrieved">{renderTabContent("never-retrieved")}</TabsContent>
          <TabsContent value="stale">{renderTabContent("stale")}</TabsContent>

          <TabsContent value="low-confidence">
            <Tabs value={subTab} onValueChange={(v) => setSubTab(v as "documents" | "queries")}>
              <TabsList className="mb-2">
                <TabsTrigger value="documents">By Document</TabsTrigger>
                <TabsTrigger value="queries">By Query</TabsTrigger>
              </TabsList>
              <TabsContent value="documents">{renderTabContent("low-confidence-docs")}</TabsContent>
              <TabsContent value="queries">{renderTabContent("low-confidence-queries")}</TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>

        {/* Row 4: Feedback */}
        {feedbackError && (
          <div className="bg-destructive/10 text-destructive text-sm px-4 py-2 rounded-lg">
            {feedbackError}
          </div>
        )}
        {feedbackLoading ? (
          <div className="ghost-border bg-card/50 rounded-lg p-4 space-y-3">
            <div className="animate-pulse bg-muted/30 h-5 w-32 rounded" />
            <div className="animate-pulse bg-muted/30 h-8 w-20 rounded" />
            <div className="animate-pulse bg-muted/30 h-10 rounded" />
          </div>
        ) : (
          feedbackStats && (
            <FeedbackStatsPanel
              stats={feedbackStats}
              onRemoveDownvoted={(id) =>
                setFeedbackStats((prev) =>
                  prev
                    ? {
                        ...prev,
                        downvoted_documents: prev.downvoted_documents.filter((d) => d.document_id !== id),
                      }
                    : prev
                )
              }
            />
          )
        )}
      </div>
    </div>
  )
}
