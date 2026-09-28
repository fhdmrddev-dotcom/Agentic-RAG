/**
 * API client for Spend & Metering (Phase 257 / METER-07).
 */

import { API_BASE, getAuthHeaders } from "@/lib/api/_core"
import type {
  SpendSummaryData,
  SpendRunItem,
  ModelRateItem,
  ModelSpendShare,
  ExpertSpendLine,
} from "@/types/spend"

/** A USD string from the API, or null when the server said "not priced". Never NaN. */
function usdOrNull(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

const MODEL_COLORS = [
  "hsl(239 84% 67%)", // indigo
  "hsl(187 92% 55%)", // cyan
  "hsl(270 95% 75%)", // violet
  "hsl(142 71% 45%)", // emerald
  "hsl(38 92% 50%)",  // amber
  "hsl(330 81% 60%)", // pink
]

export async function getSpendSummary(params?: {
  orgId?: string
  startTime?: string
  endTime?: string
  /** Phase 268 (D-268-08): `<uuid>` | `none` | `unrecorded`; absent = every run. */
  expert?: string
}): Promise<SpendSummaryData> {
  const headers = await getAuthHeaders()
  const search = new URLSearchParams()
  if (params?.orgId) search.set("org_id", params.orgId)
  if (params?.startTime) search.set("start_time", params.startTime)
  if (params?.endTime) search.set("end_time", params.endTime)
  if (params?.expert) search.set("expert", params.expert)

  const url = `${API_BASE}/admin/spend/summary${search.toString() ? `?${search.toString()}` : ""}`
  const res = await fetch(url, { headers })
  if (!res.ok) {
    throw new Error(`Failed to fetch spend summary: ${res.status} ${res.statusText}`)
  }
  const data = await res.json()

  // Calculate percentages for model breakdown
  const totalSpend = parseFloat(data.total_spend_usd) || 0
  const modelBreakdown: ModelSpendShare[] = (data.model_breakdown || []).map((m: any, idx: number) => {
    const spend = m.spend_usd !== null ? parseFloat(m.spend_usd) : null
    const pct = totalSpend > 0 && spend !== null ? Math.round((spend / totalSpend) * 100) : 0
    return {
      modelId: m.model_name,
      provider: m.provider,
      spendUsd: spend,
      percentage: pct,
      color: MODEL_COLORS[idx % MODEL_COLORS.length],
      runCount: m.run_count,
      ratedCount: m.rated_count,
      unratedCount: m.unrated_count,
      isRated: m.is_rated,
      totalTokens: m.total_tokens,
      inputTokens: m.input_tokens,
      outputTokens: m.output_tokens,
    }
  })

  // Format daily spend
  const dailySpend = (data.daily_spend || []).map((d: any) => {
    const dateObj = new Date(d.date + "T00:00:00Z")
    const dayLabel = isNaN(dateObj.getTime())
      ? d.date
      : dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    return {
      date: d.date,
      dayLabel,
      spendUsd: parseFloat(d.spend_usd) || 0,
      unratedCount: d.unrated_runs || 0,
      ratedCount: d.rated_runs || 0,
    }
  })

  return {
    totalSpendUsd: totalSpend,
    ratedRunsCount: data.rated_runs_count || 0,
    unratedRunsCount: data.unrated_runs_count || 0,
    unmeasuredRunsCount: data.unmeasured_runs_count || 0,
    incompleteCoverageCount: data.incomplete_coverage_count || 0,
    totalInputTokens: data.total_input_tokens || 0,
    totalOutputTokens: data.total_output_tokens || 0,
    dailySpend,
    modelBreakdown,
    hasUnratedRuns: data.has_unrated_runs ?? (data.unrated_runs_count > 0),
    hasIncompleteCoverage: data.has_incomplete_coverage ?? (data.incomplete_coverage_count > 0),
    expertBreakdown: (data.expert_breakdown || []).map(
      (l: any): ExpertSpendLine => ({
        key: String(l.key),
        expertId: l.expert_id ?? null,
        name: l.name ?? null,
        deleted: Boolean(l.deleted),
        scopeMode: l.scope_mode ?? null,
        runCount: l.run_count || 0,
        inputTokens: l.input_tokens || 0,
        outputTokens: l.output_tokens || 0,
        spendUsd: usdOrNull(l.spend_usd),
        unratedCount: l.unrated_count || 0,
      }),
    ),
    windowTotalUsd: usdOrNull(data.window_total_usd),
    windowRunCount: data.window_run_count || 0,
    unpricedSubagents: data.unpriced_subagents || 0,
  }
}

export async function getSpendRuns(params?: {
  orgId?: string
  limit?: number
  offset?: number
  filterStatus?: string
  timeRange?: string
  /** Phase 268 (D-268-08): the SAME param as getSpendSummary's — one filter, both calls. */
  expert?: string
}): Promise<{ runs: SpendRunItem[]; totalCount: number }> {
  const headers = await getAuthHeaders()
  const search = new URLSearchParams()
  if (params?.orgId) search.set("org_id", params.orgId)
  if (params?.limit) search.set("limit", String(params.limit))
  if (params?.offset) search.set("offset", String(params.offset))
  if (params?.filterStatus) search.set("filter_status", params.filterStatus)
  if (params?.timeRange) search.set("time_range", params.timeRange)
  if (params?.expert) search.set("expert", params.expert)

  const url = `${API_BASE}/admin/spend/runs${search.toString() ? `?${search.toString()}` : ""}`
  const res = await fetch(url, { headers })
  if (!res.ok) {
    throw new Error(`Failed to fetch spend runs: ${res.status} ${res.statusText}`)
  }
  const data = await res.json()

  const runs: SpendRunItem[] = (data.runs || []).map((r: any) => ({
    id: r.run_id,
    runId: r.run_id,
    threadId: r.thread_id,
    model: r.model,
    provider: r.provider,
    status: r.status,
    createdAt: r.started_at || new Date().toISOString(),
    startedAt: r.started_at,
    completedAt: r.completed_at,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    costUsd: r.cost_usd !== null ? parseFloat(r.cost_usd) : null,
    isRated: r.is_rated,
    tokenCoverage: r.token_coverage,
    isCoverageComplete: r.is_coverage_complete,
    expertId: r.expert_id ?? null,
    expertName: r.expert_name ?? null,
    expertDeleted: Boolean(r.expert_deleted),
    expertAttributed: Boolean(r.expert_attributed),
    subagentCount: r.subagent_count || 0,
  }))

  return {
    runs,
    totalCount: data.total_count || 0,
  }
}

export async function getModelRates(orgId?: string): Promise<ModelRateItem[]> {
  const headers = await getAuthHeaders()
  const search = new URLSearchParams()
  if (orgId) search.set("org_id", orgId)

  const url = `${API_BASE}/admin/spend/rates${search.toString() ? `?${search.toString()}` : ""}`
  const res = await fetch(url, { headers })
  if (!res.ok) {
    throw new Error(`Failed to fetch model rates: ${res.status} ${res.statusText}`)
  }
  const data = await res.json()
  return (data.rates || []).map((r: any) => ({
    id: r.id,
    modelName: r.model_name,
    provider: r.provider,
    inputCostPerMillion: r.input_cost_per_million,
    outputCostPerMillion: r.output_cost_per_million,
    effectiveFrom: r.effective_from,
    effectiveTo: r.effective_to,
    orgId: r.org_id,
    createdAt: r.created_at,
  }))
}

export async function repriceModel(payload: {
  model_id: string
  input_cost_per_million: number | string
  output_cost_per_million: number | string
  provider?: string | null
  effective_from?: string | null
  org_id?: string | null
}): Promise<any> {
  const headers = await getAuthHeaders()
  const search = new URLSearchParams()
  if (payload.org_id) search.set("org_id", payload.org_id)

  const url = `${API_BASE}/admin/spend/rates${search.toString() ? `?${search.toString()}` : ""}`
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model_id: payload.model_id,
      input_cost_per_million: String(payload.input_cost_per_million),
      output_cost_per_million: String(payload.output_cost_per_million),
      provider: payload.provider || null,
      effective_from: payload.effective_from || null,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Failed to reprice model: ${res.status}`)
  }
  return res.json()
}
