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
  /**
   * Phase 268 (METER-08). The Spend by Expert lines for the WINDOW — computed with the Expert
   * filter OFF, whatever is selected (D-268-10: the table is the navigator). Always carries a
   * `none` line; carries `unrecorded` only when it has runs.
   */
  expertBreakdown: ExpertSpendLine[];
  /** The window's org total, unfiltered — what the recon footer compares the lines against. */
  windowTotalUsd: number | null;
  windowRunCount: number;
  /** D-268-25: sub-agents with no rate under a rated root, folded into the unrated disclosure. */
  unpricedSubagents: number;
}

/** One Spend by Expert line. `key` is an Expert uuid, `none` or `unrecorded`. */
export interface ExpertSpendLine {
  key: string;
  expertId: string | null;
  name: string | null;
  /** An Expert id whose org-constrained name join found nothing — "Deleted Expert {id8}". */
  deleted: boolean;
  scopeMode: string | null;
  runCount: number;
  inputTokens: number;
  outputTokens: number;
  /** `null` when no run on the line was priced — never a confident $0.0000 (257 CR-06). */
  spendUsd: number | null;
  unratedCount: number;
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
  /**
   * Phase 268 attribution (D-268-04/06). `expertAttributed` false = Not recorded (before 268);
   * attributed with no id = No Expert; an id with `expertDeleted` = Deleted Expert.
   */
  expertId: string | null;
  expertName: string | null;
  expertDeleted: boolean;
  expertAttributed: boolean;
  /** D-268-09: sub-agent rows rolled into this root's tokens and cost. */
  subagentCount: number;
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
