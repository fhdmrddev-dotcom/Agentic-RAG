/**
 * Spend and metering data models for Phase 257 (METER-01, METER-02, METER-07).
 */

export interface DailySpendPoint {
  date: string;
  dayLabel: string;
  spendUsd: number;
  unratedCount: number;
  ratedCount?: number;
}

export interface ModelSpendShare {
  modelId: string;
  spendUsd: number | null;
  percentage: number;
  color: string;
  runCount: number;
  ratedCount: number;
  unratedCount: number;
  isRated: boolean;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  provider?: string | null;
}

export interface SpendSummaryData {
  totalSpendUsd: number;
  ratedRunsCount: number;
  unratedRunsCount: number;
  /**
   * Runs that HAVE a registered rate but recorded no tokens — priceable in principle,
   * unpriced in fact. Phase 257 CR-06: `cost_usd IS NULL` meant both "no rate" and "no
   * tokens", so 343 runs were counted as unrated under copy saying they had no rate.
   * `ratedRunsCount` now means a rate EXISTS (matching the ledger's `is_rated`), and this
   * is the subset of it that produced no figure. priced = rated - unmeasured.
   */
  unmeasuredRunsCount: number;
  incompleteCoverageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  dailySpend: DailySpendPoint[];
  modelBreakdown: ModelSpendShare[];
  hasUnratedRuns?: boolean;
  hasIncompleteCoverage?: boolean;
}

export interface SpendRunItem {
  id: string;
  name?: string;
  runId?: string;
  threadId?: string | null;
  model: string;
  provider: string | null;
  status: string;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  isRated: boolean;
  tokenCoverage: string[] | null;
  isCoverageComplete?: boolean;
}

export interface ModelRateItem {
  id: string;
  modelName: string;
  provider: string | null;
  inputCostPerMillion: string;
  outputCostPerMillion: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  orgId: string | null;
  createdAt: string | null;
}
