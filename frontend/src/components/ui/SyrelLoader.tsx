/**
 * quick-261016-u3w (SEED-359 part A) — the ONE shared branded loader: the Syrel Iris mark in its
 * working state, used wherever a page, panel, section, list or dialog body waits for data.
 *
 * Sizes: `section` (20px Iris, beside the words, a row) · `panel` (32px, above the words, the
 * default) · `page` (48px, centred in the whole area). The Iris is reused as-is from IrisAvatar,
 * never forked or restyled; reduced motion is handled inside it (a still mark with a lit core).
 *
 * Exactly one polite status per loading block: the root carries role="status" and its accessible
 * name is the visible label, or "Loading" when there are no words. Text size/colour come from the
 * caller's className; the label span has none of its own.
 */
import { IrisAvatar } from "@/components/chat/IrisAvatar"
import { cn } from "@/lib/utils"

export type SyrelLoaderSize = "section" | "panel" | "page"

const PX: Record<SyrelLoaderSize, number> = { section: 20, panel: 32, page: 48 }

const LAYOUT: Record<SyrelLoaderSize, string> = {
  section: "flex items-center gap-2",
  panel: "flex flex-col items-center justify-center gap-3",
  page: "flex h-full w-full flex-col items-center justify-center gap-3",
}

export function SyrelLoader({
  size = "panel",
  label,
  className,
}: {
  size?: SyrelLoaderSize
  label?: string
  className?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label ?? "Loading"}
      data-testid="syrel-loader"
      data-size={size}
      className={cn(LAYOUT[size], className)}
    >
      <IrisAvatar state="thinking" size={PX[size]} />
      {label ? <span>{label}</span> : null}
    </div>
  )
}
