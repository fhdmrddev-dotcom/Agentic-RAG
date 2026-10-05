/**
 * Phase 276-06 (D-24 / D-27) — the Iris assistant avatar, sketch 276-iris-avatar variant D
 * "Orbit + wave". A port of the sketch's `irisSVG(u)` + `class Iris` (D path only); the
 * acceptance bar is `.planning/sketches/276-iris-avatar/` (README + index.html).
 *
 * What moves, and why it never stutters (README §"D's loop seam", measured in Chrome):
 *  - CSS owns the loops (`.iris` block in index.css): the ring turns 360° in 4.8 s linear =
 *    3 wave periods of 1.6 s; each wave petal has a NEGATIVE delay spaced by period/6; the
 *    glow's 1.6 s divides 4.8 s. At 360° every petal maps to itself, so the wrap is invisible.
 *  - This component owns only TRANSITIONS, through the ref (never through React state):
 *      · spin-up: playbackRate tweens 0.2 → RATE[state] over 560 ms;
 *      · working → working: playbackRate tweens to the new RATE over 650 ms, nothing restarts,
 *        and ONE rate drives ring + wave + glow so they stay phase-locked;
 *      · settle: the live pose is captured, the ring coasts FORWARD to the next 120° stop
 *        (identical to rest by the gradients' symmetry) at a matched starting speed, and
 *        data-motion goes "fade" → "rest" while the wave layer fades out by CSS transition.
 *  - Under prefers-reduced-motion nothing moves; a working state shows a steady lit core.
 *
 * `data-motion` is rendered ONCE (its initial value) and owned by the effect afterwards, so a
 * re-render can never overwrite "fade" mid-settle. `data-state` / `data-tone` / `data-lit` are
 * plain props. Colour changes are `stop-color` / `fill` transitions, never an animated
 * property, so "settles and turns amber" runs both at once.
 *
 * Known edge, accepted as the sketch records it: re-entering work DURING a settle restarts the
 * ring from its coast pose to 0°.
 *
 * Cost (T-276-31): React.memo, no store reads, only transform/opacity animate, will-change on
 * the ring only while working, and a settled avatar runs no animations at all.
 */
import { memo, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react"
import type { IrisState } from "./irisState"
import { settleCoast } from "./irisMotion"

const WORK: ReadonlySet<IrisState> = new Set<IrisState>(["thinking", "tool", "streaming"])
/** playbackRate per working state: tool ×1.45 (≈1.1 s), streaming ×0.8 (≈2 s, the text moves). */
const RATE: Partial<Record<IrisState, number>> = { thinking: 1, tool: 1.45, streaming: 0.8 }
const TONE: Partial<Record<IrisState, "amber" | "red" | "dim">> = {
  waiting: "amber",
  error: "red",
  cancelled: "dim",
}
const REDUCED_QUERY = "(prefers-reduced-motion: reduce)"
const PETALS = [0, 1, 2, 3, 4, 5]

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    !!window.matchMedia(REDUCED_QUERY)?.matches
  )
}

interface Live {
  first: boolean
  rampToken: number
  raf: number
  rampTimer: ReturnType<typeof setTimeout> | undefined
  fadeTimer: ReturnType<typeof setTimeout> | undefined
  settling: Animation[]
}

/** The loop animations only (our own WAAPI settle animations are not CSSAnimations). */
function cssAnimations(el: HTMLElement): CSSAnimation[] {
  if (typeof CSSAnimation === "undefined") return []
  return el.getAnimations({ subtree: true }).filter((a): a is CSSAnimation => a instanceof CSSAnimation)
}

function targetOf(a: Animation): Element | null {
  const effect = a.effect as KeyframeEffect | null
  return effect?.target ?? null
}

export const IrisAvatar = memo(function IrisAvatar({ state, size = 32 }: { state: IrisState; size?: number }) {
  // React 19 ids are not guaranteed to be valid url(#…) fragments; keep [A-Za-z0-9_-] only.
  const uid = "iris" + useId().replace(/[^A-Za-z0-9_-]/g, "")
  const ref = useRef<HTMLSpanElement>(null)
  const reduced = prefersReducedMotion()
  const [initialMotion] = useState(() => (WORK.has(state) && !prefersReducedMotion() ? "work" : "rest"))
  const live = useRef<Live>({
    first: true,
    rampToken: 0,
    raf: 0,
    rampTimer: undefined,
    fadeTimer: undefined,
    settling: [],
  })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const s = live.current
    const instant = s.first
    s.first = false
    const isReduced = prefersReducedMotion()
    const canAnimate = typeof el.getAnimations === "function"
    const wasWork = el.dataset.motion === "work"

    const cancelSettle = () => {
      s.settling.forEach((a) => a.cancel())
      s.settling = []
    }

    // Tween playbackRate. Changing the rate keeps each animation's position, so nothing jumps.
    const ramp = (from: number | null, to: number, dur: number) => {
      const anims = cssAnimations(el)
      if (!anims.length) return
      const start = from == null ? anims[0].playbackRate : from
      const token = ++s.rampToken
      cancelAnimationFrame(s.raf)
      clearTimeout(s.rampTimer)
      if (!dur) {
        anims.forEach((a) => (a.playbackRate = to))
        return
      }
      const t0 = performance.now()
      // rAF pauses in background tabs; make sure the final rate still lands.
      s.rampTimer = setTimeout(() => {
        if (token === s.rampToken) anims.forEach((a) => (a.playbackRate = to))
      }, dur + 80)
      const step = (now: number) => {
        if (token !== s.rampToken) return
        const k = Math.min(1, Math.max(0, (now - t0) / dur))
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
        const r = start + (to - start) * e
        anims.forEach((a) => (a.playbackRate = r))
        if (k < 1) s.raf = requestAnimationFrame(step)
      }
      step(t0)
    }

    // Settle: capture the live pose, drop the loop, animate from that pose to rest. The ring
    // decelerates FORWARD to the next 120° (identical to rest by symmetry) at a matched speed.
    const settle = () => {
      s.rampToken++
      cancelAnimationFrame(s.raf)
      clearTimeout(s.rampTimer)
      const snaps = cssAnimations(el)
        .filter((a) => !targetOf(a)?.classList.contains("wv"))
        .map((a) => {
          const t = targetOf(a) as Element
          const cs = getComputedStyle(t)
          const tm = a.effect!.getComputedTiming()
          return {
            t,
            name: a.animationName,
            tr: cs.transform,
            op: cs.opacity,
            prog: tm.progress ?? 0,
            dur: Number(tm.duration) || 1,
            rate: a.playbackRate || 1,
          }
        })
      // The wave layer keeps running under "fade" while its container fades out (CSS transition).
      el.dataset.motion = "fade"
      clearTimeout(s.fadeTimer)
      s.fadeTimer = setTimeout(() => {
        if (el.dataset.motion === "fade") el.dataset.motion = "rest"
      }, 520)
      const out: Animation[] = []
      for (const snap of snaps) {
        if (!snap.t) continue
        if (snap.name === "irisOrbitTurn") {
          const ang = snap.prog * 360
          const v = (360 / snap.dur) * snap.rate // deg per ms right now
          const { target, dur, y1 } = settleCoast(ang, v)
          out.push(
            snap.t.animate([{ transform: `rotate(${ang}deg)` }, { transform: `rotate(${target}deg)` }], {
              duration: dur,
              easing: `cubic-bezier(.3,${y1.toFixed(3)},.6,1)`,
            }),
          )
        } else {
          const rest = getComputedStyle(snap.t)
          out.push(
            snap.t.animate(
              [
                { transform: snap.tr, opacity: snap.op },
                { transform: rest.transform, opacity: rest.opacity },
              ],
              { duration: 560, easing: "cubic-bezier(.2,0,0,1)" },
            ),
          )
        }
      }
      s.settling = out
    }

    if (isReduced) {
      s.rampToken++
      cancelSettle()
      clearTimeout(s.fadeTimer)
      el.dataset.motion = "rest"
      return
    }

    if (WORK.has(state)) {
      const rate = RATE[state] ?? 1
      cancelSettle()
      clearTimeout(s.fadeTimer)
      if (!canAnimate) {
        el.dataset.motion = "work"
        return
      }
      if (!wasWork) {
        el.dataset.motion = "work"
        ramp(instant ? rate : 0.2, rate, instant ? 0 : 560) // spin up from near-still
      } else {
        ramp(instant ? rate : null, rate, instant ? 0 : 650) // speed change, no restart
      }
      return
    }

    if (wasWork) {
      if (!canAnimate || instant) {
        cancelSettle()
        el.dataset.motion = "rest"
      } else {
        settle()
      }
    }
  }, [state])

  useEffect(() => {
    const s = live.current
    return () => {
      s.rampToken++
      cancelAnimationFrame(s.raf)
      clearTimeout(s.rampTimer)
      clearTimeout(s.fadeTimer)
      s.settling.forEach((a) => a.cancel())
      s.settling = []
    }
  }, [])

  const tone = TONE[state]
  const style = { width: size, height: size, "--sz": `${size}px` } as CSSProperties

  return (
    <span
      ref={ref}
      className="iris chip"
      style={style}
      aria-hidden="true"
      data-state={state}
      data-motion={initialMotion}
      data-tone={tone}
      data-lit={reduced && WORK.has(state) ? "" : undefined}
    >
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${uid}-a`} x1="0" y1="0" x2="1" y2="1">
            <stop className="sa1" offset="0" />
            <stop className="sa2" offset=".5" />
            <stop className="sa3" offset="1" />
          </linearGradient>
          <linearGradient id={`${uid}-b`} x1="1" y1="0" x2="0" y2="1">
            <stop className="sb1" offset="0" />
            <stop className="sb2" offset="1" />
          </linearGradient>
          <linearGradient id={`${uid}-w`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset=".55" stopColor="#D6D8FF" />
            <stop offset="1" stopColor="#A3A5FF" />
          </linearGradient>
          <radialGradient id={`${uid}-g`}>
            <stop offset="0" stopColor="#C9CBFF" stopOpacity=".95" />
            <stop offset=".55" stopColor="#8E91FF" stopOpacity=".35" />
            <stop offset="1" stopColor="#6467F2" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle className="glow" cx="32" cy="32" r="18" fill={`url(#${uid}-g)`} />
        <g className="spin">
          <g className="base">
            {PETALS.map((i) => (
              <g key={i} transform={`rotate(${i * 60} 32 32)`}>
                <ellipse
                  className="pt"
                  style={{ "--i": i } as CSSProperties}
                  cx="32"
                  cy="17"
                  rx="6.5"
                  ry="13"
                  fill={`url(#${uid}${i % 2 ? "-b" : "-a"})`}
                />
              </g>
            ))}
          </g>
          <g className="wave">
            {PETALS.map((i) => (
              <g key={i} transform={`rotate(${i * 60} 32 32)`}>
                <ellipse
                  className="wv"
                  style={{ "--i": i } as CSSProperties}
                  cx="32"
                  cy="17"
                  rx="6.5"
                  ry="13"
                  fill={`url(#${uid}-w)`}
                />
              </g>
            ))}
          </g>
        </g>
        <circle className="core" cx="32" cy="32" r="4.5" />
      </svg>
    </span>
  )
})
