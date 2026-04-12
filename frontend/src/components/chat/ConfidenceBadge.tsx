import { cn } from "@/lib/utils"
import type { ConfidenceResult } from "@/types"

interface Props {
  confidence: ConfidenceResult
}

const colourMap: Record<string, string> = {
  high: "text-green-500",
  medium: "text-amber-500",
  low: "text-red-500",
}

export function ConfidenceBadge({ confidence }: Props) {
  return (
    <div className="mt-2">
      <span
        className={cn(
          "text-xs flex items-center gap-1",
          colourMap[confidence.level]
        )}
      >
        ●{" "}
        {confidence.level.charAt(0).toUpperCase() + confidence.level.slice(1)}{" "}
        confidence
      </span>
      {confidence.disclaimer && (
        <p className="text-xs text-muted-foreground italic mt-0.5">
          {confidence.disclaimer}
        </p>
      )}
    </div>
  )
}
