import React from "react"
import { AlertTriangle } from "lucide-react"

export interface RunCostBadgeProps {
  costUsd?: number | null
  isRated?: boolean
  unratedModel?: string | null
  tokenCoverage?: string[] | null
  className?: string
  size?: "sm" | "md"
}

const REQUIRED_LEGS = ["agent", "single", "batch", "emit"]

export const RunCostBadge: React.FC<RunCostBadgeProps> = ({
  costUsd,
  isRated = true,
  unratedModel,
  tokenCoverage,
  className = "",
  size = "sm",
}) => {
  // STRICT INVARIANT (D-257-05): Under NO circumstance may an unrated run render $0.00
  const isActuallyUnrated = isRated === false || costUsd === null || costUsd === undefined

  const sizeClasses = size === "sm" ? "text-xs py-0.5 px-2" : "text-sm py-1 px-2.5"

  if (isActuallyUnrated) {
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

  // Check token coverage completeness
  const isCoverageComplete =
    Array.isArray(tokenCoverage) &&
    REQUIRED_LEGS.every((leg) => tokenCoverage.includes(leg))

  const formattedCost = `$${costUsd.toFixed(4)}`

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md font-mono font-medium bg-card/60 text-emerald-400 border border-border/60 ${sizeClasses} ${className}`}
      data-testid="rated-cost-badge"
    >
      <span>{formattedCost}</span>
      {!isCoverageComplete && (
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
