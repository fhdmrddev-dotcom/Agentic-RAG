import React from "react"
import { AlertTriangle } from "lucide-react"

export interface RunCostBadgeProps {
  costUsd?: number | null
  isRated?: boolean | null
  unratedModel?: string | null
  tokenCoverage?: string[] | null
  className?: string
  size?: "sm" | "md"
}

const REQUIRED_LEGS = ["agent", "single", "batch", "emit"]

export const RunCostBadge: React.FC<RunCostBadgeProps> = ({
  costUsd,
  // ⛔ NO DEFAULT. Phase 257 review (Claude, reviewer). This read `isRated = true`, which
  // turns "the caller said nothing" into "the caller asserted this model is rated" — and
  // that is the difference between the two no-cost states below. An absent flag is an
  // ABSENCE OF EVIDENCE; only an explicit `true` licenses the "rate exists, tokens don't"
  // reading. Driven: with the default, `<RunCostBadge costUsd={null} />` rendered
  // "No tokens recorded" instead of "Unrated" and failed 257-04's own case
  // "renders amber Unrated badge when costUsd is null even if isRated is not specified".
  isRated,
  unratedModel,
  tokenCoverage,
  className = "",
  size = "sm",
}) => {
  // STRICT INVARIANT (D-257-05): Under NO circumstance may an unrated run render $0.00
  //
  // ⛔ THERE ARE **THREE** STATES HERE, NOT TWO — Phase 257 review (Claude, reviewer).
  // `pricing_service.compute_token_cost_usd` returns THREE distinct shapes, and the first
  // draft of this component collapsed the last two into one:
  //   1. rate present, tokens measured -> is_rated=True,  cost_usd=<Decimal>
  //   2. NO rate for the model         -> is_rated=False, cost_usd=None
  //   3. rate present, tokens NOT      -> is_rated=TRUE,  cost_usd=None
  //      recorded (both counts None)
  // State 3 was rendering the state-2 badge, whose tooltip reads "no rate registered in
  // model_rates" — a statement that is FALSE about a model which is in fact rated. The
  // run is not unpriced because nobody priced the model; it is unpriced because nobody
  // measured the tokens. On a feature whose whole promise (METER-07) is that the view
  // states what it CANNOT SEE, naming the wrong cause is the failure, not a nicety.
  const hasNoCost = costUsd === null || costUsd === undefined
  const isUnratedModel = isRated === false
  const isRatedButUnmeasured = isRated === true && hasNoCost

  const sizeClasses = size === "sm" ? "text-xs py-0.5 px-2" : "text-sm py-1 px-2.5"

  if (isRatedButUnmeasured) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md font-mono font-semibold bg-slate-500/15 text-slate-300 border border-slate-400/30 shadow-sm ${sizeClasses} ${className}`}
        title={
          unratedModel
            ? `Model '${unratedModel}' HAS a registered rate, but this run recorded no token counts — so its cost cannot be attributed. This is a measurement gap, not a missing price.`
            : "This model has a registered rate, but the run recorded no token counts — a measurement gap, not a missing price."
        }
        data-testid="unmeasured-cost-badge"
      >
        <AlertTriangle className={size === "sm" ? "h-3 w-3 flex-shrink-0" : "h-3.5 w-3.5 flex-shrink-0"} />
        <span>No tokens recorded</span>
      </span>
    )
  }

  if (isUnratedModel || hasNoCost) {
    const tooltipText = unratedModel
      ? `Model '${unratedModel}' has no registered rate`
      : "Unrated model: no rate registered in model_rates"

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md font-mono font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm ${sizeClasses} ${className}`}
        title={tooltipText}
        data-testid="unrated-cost-badge"
      >
        <AlertTriangle className={size === "sm" ? "h-3 w-3 flex-shrink-0" : "h-3.5 w-3.5 flex-shrink-0"} />
        <span>Unrated</span>
      </span>
    )
  }

  // ⛔ ABSENT COVERAGE IS NOT INCOMPLETE COVERAGE. Phase 257.1 (reviewer).
  // This read `isCoverageComplete = Array.isArray(tokenCoverage) && every(...)`, so a caller
  // that does not TRACK coverage was scored identically to one that tracks it and found it
  // partial — and the badge appended its `*` "Incomplete token coverage: lower bound" marker
  // to EVERY such cost. `token_coverage` lives on `workflow_runs`; the chat surface reads
  // `runs`, which has no such column, so wiring chat cost without this change would have
  // stamped a false incompleteness claim on every message in the product.
  //
  // ⛔ `undefined` and `null` are DIFFERENT ANSWERS HERE, and conflating them is the bug:
  //   undefined -> the caller does not TRACK coverage (chat reads `runs`, which has no such
  //                column) -> make NO claim, render no marker.
  //   null / [] -> the caller DOES track coverage and recorded none -> genuinely incomplete
  //                -> render the `*` lower-bound marker. (257-04's own case asserts this,
  //                and it was right: `null` from `workflow_runs` means partial, not unknown.)
  const coverageKnown = tokenCoverage !== undefined
  const isCoverageIncomplete =
    coverageKnown &&
    !(Array.isArray(tokenCoverage) && REQUIRED_LEGS.every((leg) => tokenCoverage.includes(leg)))

  const formattedCost = `$${costUsd.toFixed(4)}`

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md font-mono font-medium bg-card/60 text-emerald-400 border border-border/60 ${sizeClasses} ${className}`}
      data-testid="rated-cost-badge"
    >
      <span>{formattedCost}</span>
      {isCoverageIncomplete && (
        <span
          className="text-amber-400 font-bold ml-0.5 cursor-help"
          title="Incomplete token coverage: lower bound"
          data-testid="incomplete-coverage-asterisk"
        >
          *
        </span>
      )}
    </span>
  )
}
