/** Phase 217.1-12 — the coverage ring, copied from HealthScoreGauge.tsx geometry
 *  with the grade word DELETED and numerator-and-denominator in its place.
 *
 *  ⛔ No 0-100 grade word ("Healthy"/"Needs Attention"/"At Risk") anywhere in this
 *  component — the sketch bans a bare proportion as quality grade.
 */

import { useId } from "react"

import { AnimatedNumber } from "@/components/ui/AnimatedNumber"

interface Props {
  retrieved: number
  total: number
  size?: "lg" | "sm"
  /**
   * What the proportion MEANS. Defaults to the shipped wording so the original mount is
   * byte-equivalent.
   *
   * ⚠ It became a prop on 2026-09-06 because this ring was reused for signals that are
   * HEALTH rather than DEMAND. "found by a search" was the only label for a long time, and a
   * red arc carrying it read as "61% of your library is broken" when it meant "61% has not
   * been needed yet".
   */
  label?: string
  /**
   * Invert the colour scale for a ring where LOW is good (none today; kept explicit so a
   * future caller cannot get red/green backwards by accident).
   */
  lowIsGood?: boolean
}

export function CoverageRing({
  retrieved,
  total,
  size = "lg",
  label = "found by a search",
  lowIsGood = false,
}: Props) {
  /**
   * ⛔ SVG ids are DOCUMENT-GLOBAL. This was keyed on `size`, which was safe only while
   * exactly one ring of each size existed on a page. The moment a second `lg` ring mounts,
   * both `<defs>` declare the same id, the browser keeps the FIRST, and the second ring
   * silently renders the first ring's colour — a wrong colour, never a missing one, so it
   * looks like a design choice rather than a bug. `useId` makes the id per-instance.
   */
  const uid = useId().replace(/:/g, "")
  const pct = total > 0 ? Math.max(0, Math.min(100, (retrieved / total) * 100)) : 0

  const scored = lowIsGood ? 100 - pct : pct
  const strokeColor = scored >= 80 ? "#34d399" : scored >= 60 ? "#fbbf24" : "#f87171"
  const isLg = size === "lg"

  const SIZE = isLg ? 176 : 96
  const cx = SIZE / 2
  const cy = SIZE / 2
  const sw = isLg ? 14 : 9
  const r = cx - sw / 2 - 2
  const circ = 2 * Math.PI * r
  const fill = (pct / 100) * circ

  return (
    <div className="flex flex-col items-center">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <defs>
            <linearGradient id={`covGrad-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="1" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.8" />
            </linearGradient>
            <filter id={`covGlow-${uid}`} x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor={strokeColor} floodOpacity="0.3" />
            </filter>
          </defs>
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="hsl(var(--muted) / 0.4)"
            strokeWidth={sw}
          />
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={`url(#covGrad-${uid})`}
            filter={`url(#covGlow-${uid})`}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeDasharray={`${fill} ${circ}`}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`font-bold font-headline tabular-nums leading-none text-foreground ${isLg ? "text-2xl" : "text-lg"}`}>
            <AnimatedNumber value={retrieved} />
            <span className="text-muted-foreground">/<AnimatedNumber value={total} /></span>
          </span>
          <span className={`font-medium text-muted-foreground mt-0.5 ${isLg ? "text-xs" : "text-[9px]"}`}>
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}