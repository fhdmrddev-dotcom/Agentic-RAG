/**
 * A donut that shows a COMPOSITION — many segments, many colours.
 *
 * ⭐ WHY THIS EXISTS ALONGSIDE `CoverageRing`. That ring draws ONE proportion, so on a healthy
 * library it is a filled circle: one variable rendered as a donut, in one colour. Colour there
 * carries a threshold verdict (green/amber/red) and nothing else. This component is the other
 * shape — each segment IS a value, and colour identifies WHICH value rather than grading it.
 *
 * ⛔ NO GRADE WORD and no threshold colouring here. A composition has no "good" split; a library
 * that is 60% PDF is not thereby unhealthy. Callers that need a verdict want `CoverageRing`.
 */

import { useId } from "react"

export interface DonutSegment {
  label: string
  value: number
  color: string
}

interface Props {
  segments: DonutSegment[]
  /** Big number in the middle. Defaults to the segment total. */
  centerValue?: number | string
  centerLabel: string
  size?: "lg" | "sm"
}

export function SegmentDonut({ segments, centerValue, centerLabel, size = "lg" }: Props) {
  const uid = useId().replace(/:/g, "")
  const shown = segments.filter((s) => s.value > 0)
  const total = shown.reduce((n, s) => n + s.value, 0)

  const isLg = size === "lg"
  const SIZE = isLg ? 176 : 120
  const cx = SIZE / 2
  const cy = SIZE / 2
  const sw = isLg ? 14 : 10
  const r = cx - sw / 2 - 2
  const circ = 2 * Math.PI * r

  /**
   * ⚠ Offsets accumulate so segments ABUT rather than overlap. Drawing each from 0 would stack
   * them and the last colour would win — a ring that looks single-valued again, which is the
   * exact failure this component exists to avoid.
   */
  let acc = 0
  const arcs = shown.map((s) => {
    const frac = total > 0 ? s.value / total : 0
    const len = frac * circ
    const arc = { ...s, len, offset: acc }
    acc += len
    return arc
  })

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--muted) / 0.4)" strokeWidth={sw} />
          {arcs.map((a) => (
            <circle
              key={`${uid}-${a.label}`}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={a.color}
              strokeWidth={sw}
              strokeDasharray={`${a.len} ${circ}`}
              strokeDashoffset={-a.offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1)" }}
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-bold font-headline tabular-nums leading-none text-foreground ${
              isLg ? "text-2xl" : "text-xl"
            }`}
          >
            {centerValue ?? total}
          </span>
          <span
            className={`font-medium text-muted-foreground mt-0.5 ${isLg ? "text-xs" : "text-[10px]"}`}
          >
            {centerLabel}
          </span>
        </div>
      </div>

      {/*
        ⚠ THE LEGEND IS NOT OPTIONAL. A multi-colour ring with no key is decoration — the reader
        can see that something is divided and not what into. Values are shown, not just names.
      */}
      <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 max-w-[200px]">
        {shown.map((s) => (
          <li key={s.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className="inline-block h-2 w-2 rounded-sm shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="whitespace-nowrap">
              {s.label} <span className="tabular-nums text-foreground/80">{s.value}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * One palette, used by every composition chart on this surface so a format is the SAME colour
 * in the donut and in the bar. Two charts colouring "PDF" differently is worse than no colour.
 */
export const TYPE_PALETTE = [
  "#818cf8",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#22d3ee",
  "#a78bfa",
  "#fb923c",
  "#94a3b8",
]

export function typeColor(index: number): string {
  return TYPE_PALETTE[index % TYPE_PALETTE.length]
}

/**
 * Fold a long tail into ONE NAMED bucket instead of dropping it.
 *
 * ⛔ THE POINT IS THAT NOTHING VANISHES. A first version of this surface kept the top 8 formats
 * and silently discarded the rest — measured against real data, that removed DXF, PNG, WebP,
 * HTML, TIFF, JPEG, Outlook and EPUB: eight formats and fourteen documents, gone from "what is
 * in my library" with nothing saying so. A person who uploads a DXF and cannot find it in the
 * chart has been told something false by omission.
 *
 * `Other` carries its own count AND how many formats it stands for, so the reader can tell a
 * fat tail from a thin one and knows to go look.
 */
export function foldTail<T extends { value: number }>(
  items: T[],
  keep: number,
  makeOther: (value: number, count: number) => T,
): T[] {
  if (items.length <= keep) return items
  const head = items.slice(0, keep)
  const tail = items.slice(keep)
  const total = tail.reduce((n, t) => n + t.value, 0)
  return total > 0 ? [...head, makeOther(total, tail.length)] : head
}
