/**
 * Phase 068.5 (D-068.5-11 + D-068.5-12): cold-load placeholder.
 *
 * Renders 3 alternating skeleton bubbles (user-right, assistant-left,
 * assistant-left) using the existing `animate-shimmer` keyframe at
 * `index.css:202-211` — reused, not duplicated. The brand-pulse keyframe
 * (D-068.5-05) lands in Plan 02; Plan 01 only ships the cold-load skeleton.
 *
 * D-068.5-12: clears the instant `messages.length > 0` (see MessageList
 * empty-state ternary).
 *
 * Wrapper carries `data-testid="message-skeleton"` for the Vitest gate.
 */
export function MessageSkeleton(): JSX.Element {
  return (
    <div
      data-testid="message-skeleton"
      className="space-y-3 px-6 py-6 max-w-4xl mx-auto animate-fadeSlideUp"
    >
      {/* User bubble (right-aligned) */}
      <div className="flex justify-end">
        <div className="w-3/5 h-12 rounded-2xl rounded-br-md animate-shimmer" />
      </div>
      {/* Assistant bubble (left-aligned) */}
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full animate-shimmer flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded animate-shimmer" />
          <div className="h-4 w-1/2 rounded animate-shimmer" />
        </div>
      </div>
      {/* Second assistant bubble — gives the eye three rhythmic rows */}
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full animate-shimmer flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 rounded animate-shimmer" />
        </div>
      </div>
    </div>
  )
}
