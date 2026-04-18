import { useState } from "react"
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { submitFeedback } from "@/lib/api"

interface Props {
  messageId: string
}

type RatingState = "positive" | "negative" | null

const REASONS: Array<{ label: string; value: string }> = [
  { label: "Wrong answer", value: "wrong_answer" },
  { label: "Not from my documents", value: "not_from_documents" },
  { label: "Incomplete", value: "incomplete" },
  { label: "Other", value: "other" },
]

export function MessageFeedback({ messageId }: Props) {
  const [ratingState, setRatingState] = useState<RatingState>(null)
  const [showReasonSelector, setShowReasonSelector] = useState(false)
  const [pendingRating, setPendingRating] = useState<"positive" | "negative" | null>(null)

  // Interaction contract (040-UI-SPEC.md): fire-and-forget, never block conversation.
  // Optimistic state set before await. Revert on non-409 error. Silent on 409.

  async function handlePositive() {
    if (ratingState !== null || pendingRating !== null) return
    setPendingRating("positive")
    setRatingState("positive") // optimistic
    try {
      const res = await submitFeedback({ message_id: messageId, rating: "positive" })
      if (res.status === 409) return // already rated — keep optimistic state
      if (!res.ok) setRatingState(null) // non-409 error — revert
    } catch {
      setRatingState(null) // network error — revert
    } finally {
      setPendingRating(null)
    }
  }

  function handleNegativeClick() {
    if (ratingState !== null || pendingRating !== null) return
    // Do NOT submit yet — show reason selector first (040-UI-SPEC.md Reason Selector Flow step 2-3)
    setShowReasonSelector(true)
  }

  async function handleReasonSelect(reason: string | null) {
    setShowReasonSelector(false)
    setPendingRating("negative")
    setRatingState("negative") // optimistic
    try {
      const res = await submitFeedback({
        message_id: messageId,
        rating: "negative",
        reason,
      })
      if (res.status === 409) return
      if (!res.ok) setRatingState(null)
    } catch {
      setRatingState(null)
    } finally {
      setPendingRating(null)
    }
  }

  const isRated = ratingState !== null

  // After rating: always visible. Before rating: hidden until parent row hover (group-hover).
  const containerClass = cn(
    "flex items-center gap-1 mt-2",
    isRated ? "opacity-100" : "opacity-0 group-hover:opacity-100 transition-opacity"
  )

  return (
    <div>
      <div className={containerClass}>
        {/* Thumbs Up */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 w-7 p-0",
                ratingState === "positive"
                  ? "text-primary"
                  : ratingState === "negative"
                    ? "text-muted-foreground opacity-40"
                    : "text-muted-foreground hover:text-foreground"
              )}
              onClick={handlePositive}
              disabled={isRated || pendingRating !== null}
            >
              {pendingRating === "positive" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ThumbsUp className={cn("h-3.5 w-3.5", ratingState === "positive" && "fill-primary")} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Good response</TooltipContent>
        </Tooltip>

        {/* Thumbs Down */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 w-7 p-0",
                ratingState === "negative"
                  ? "text-destructive"
                  : ratingState === "positive"
                    ? "text-muted-foreground opacity-40"
                    : "text-muted-foreground hover:text-foreground"
              )}
              onClick={handleNegativeClick}
              disabled={isRated || pendingRating !== null}
            >
              {pendingRating === "negative" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ThumbsDown className={cn("h-3.5 w-3.5", ratingState === "negative" && "fill-destructive")} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Poor response</TooltipContent>
        </Tooltip>
      </div>

      {/* ReasonSelector — slides in after thumbs-down click, before submission */}
      {showReasonSelector && (
        <div className="animate-fadeSlideUp">
          <p className="text-xs text-muted-foreground mb-2 mt-2">
            Why was this response unhelpful?
          </p>
          <div className="flex flex-wrap gap-2">
            {REASONS.map(({ label, value }) => (
              <Button
                key={value}
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2 hover:bg-primary/10 hover:text-primary hover:border-primary/40"
                onClick={() => handleReasonSelect(value)}
              >
                {label}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 text-muted-foreground"
              onClick={() => handleReasonSelect(null)}
            >
              Skip for now
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
