/**
 * Phase 276-06 (D-24 / D-27) — the Iris assistant avatar, sketch 276-iris-avatar variant D.
 *
 * Two halves:
 *  1. The RENDERING CONTRACT: one aria-hidden `span.iris.chip` whose data-state / data-motion /
 *     data-tone / data-lit attributes are what the `.iris` CSS block keys on, with per-instance
 *     gradient ids that always resolve inside their own SVG (T-276-32).
 *  2. A CSS FENCE that reads the real `frontend/src/index.css` and pins the seamless-loop
 *     invariant the sketch measured in Chrome (README §"D's loop seam"): the ring turns a FULL
 *     360°, its period is an integer multiple of the wave period, the glow period divides it,
 *     and the per-petal delays are negative and spaced by period/6. Change a timing and this
 *     fails before a user can feel the stutter.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render } from "@testing-library/react"
import { IrisAvatar } from "../IrisAvatar"
import type { IrisState } from "../irisState"
import { ORBIT_MS, orbitPos, resetPhaseClock } from "../irisMotion"

const nodeFs = await vi.importActual<any>("node:fs")

const FRONTEND_DIR: string = (() => {
  const here = decodeURIComponent(import.meta.url).replace(/^file:\/\/\/?/, "")
  const marker = "/src/components/chat/__tests__/"
  const at = here.indexOf(marker)
  if (at === -1) throw new Error(`cannot locate frontend dir in: ${here}`)
  return here.slice(0, at)
})()

function stubReducedMotion(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

const savedGetAnimations = (Element.prototype as any).getAnimations

beforeEach(() => {
  stubReducedMotion(false)
})

afterEach(() => {
  ;(Element.prototype as any).getAnimations = savedGetAnimations
})

function irisOf(container: HTMLElement): HTMLSpanElement {
  const all = container.querySelectorAll("span.iris")
  expect(all).toHaveLength(1)
  return all[0] as HTMLSpanElement
}

describe("IrisAvatar — rendering contract", () => {
  it("renders one aria-hidden span.iris.chip carrying data-state", () => {
    const { container } = render(<IrisAvatar state="thinking" />)
    const el = irisOf(container)
    expect(el.classList.contains("chip")).toBe(true)
    expect(el.getAttribute("data-state")).toBe("thinking")
    expect(el.getAttribute("aria-hidden")).toBe("true")
  })

  it("draws the variant-D SVG: 6 base petals, 6 wave petals, one core, one glow", () => {
    const { container } = render(<IrisAvatar state="idle" />)
    const svg = container.querySelector("span.iris svg")!
    expect(svg).not.toBeNull()
    expect(svg.querySelectorAll(".base ellipse")).toHaveLength(6)
    expect(svg.querySelectorAll("ellipse.wv")).toHaveLength(6)
    expect(svg.querySelectorAll("circle.core")).toHaveLength(1)
    expect(svg.querySelectorAll("circle.glow")).toHaveLength(1)
  })

  it.each<[IrisState, "work" | "rest"]>([
    ["thinking", "work"],
    ["tool", "work"],
    ["streaming", "work"],
    ["idle", "rest"],
    ["waiting", "rest"],
    ["error", "rest"],
    ["cancelled", "rest"],
  ])("state %s renders data-motion=%s", (state, motion) => {
    const { container } = render(<IrisAvatar state={state} />)
    expect(irisOf(container).getAttribute("data-motion")).toBe(motion)
  })

  it.each<[IrisState, string | null]>([
    ["waiting", "amber"],
    ["error", "red"],
    ["cancelled", "dim"],
    ["idle", null],
    ["thinking", null],
    ["tool", null],
    ["streaming", null],
  ])("state %s renders data-tone=%s", (state, tone) => {
    const { container } = render(<IrisAvatar state={state} />)
    expect(irisOf(container).getAttribute("data-tone")).toBe(tone)
  })

  it("under reduced motion a working state is still (rest) with a lit core; idle is not lit", () => {
    stubReducedMotion(true)
    const working = render(<IrisAvatar state="tool" />)
    const w = irisOf(working.container)
    expect(w.getAttribute("data-motion")).toBe("rest")
    expect(w.hasAttribute("data-lit")).toBe(true)
    working.unmount()

    const idle = render(<IrisAvatar state="idle" />)
    expect(irisOf(idle.container).hasAttribute("data-lit")).toBe(false)
  })

  it("two instances have disjoint gradient ids, every url(#…) resolves in its own svg, ids are safe", () => {
    const { container } = render(
      <div>
        <IrisAvatar state="thinking" />
        <IrisAvatar state="idle" />
      </div>,
    )
    const svgs = Array.from(container.querySelectorAll("span.iris svg"))
    expect(svgs).toHaveLength(2)
    const idSets = svgs.map((svg) => {
      const ids = Array.from(svg.querySelectorAll("[id]")).map((n) => n.getAttribute("id")!)
      expect(ids.length).toBeGreaterThanOrEqual(4)
      for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]+$/)
      const refs: string[] = []
      for (const n of Array.from(svg.querySelectorAll("*"))) {
        for (const attr of Array.from(n.attributes)) {
          const m = attr.value.match(/url\(#([^)]+)\)/)
          if (m) refs.push(m[1])
        }
      }
      expect(refs.length).toBeGreaterThanOrEqual(13) // 12 petals + the glow
      for (const ref of refs) expect(ids).toContain(ref)
      return new Set(ids)
    })
    const overlap = [...idSets[0]].filter((id) => idSets[1].has(id))
    expect(overlap).toEqual([])
  })

  it("size={64} renders a 64px box", () => {
    const { container } = render(<IrisAvatar state="idle" size={64} />)
    const el = irisOf(container)
    expect(el.style.width).toBe("64px")
    expect(el.style.height).toBe("64px")
  })

  it("working → idle → waiting does not throw without getAnimations (jsdom) and ends at rest", () => {
    ;(Element.prototype as any).getAnimations = undefined
    const { container, rerender } = render(<IrisAvatar state="thinking" />)
    expect(irisOf(container).getAttribute("data-motion")).toBe("work")
    rerender(<IrisAvatar state="idle" />)
    expect(irisOf(container).getAttribute("data-motion")).toBe("rest")
    rerender(<IrisAvatar state="waiting" />)
    const el = irisOf(container)
    expect(el.getAttribute("data-state")).toBe("waiting")
    expect(el.getAttribute("data-motion")).toBe("rest")
  })

  it("renders when window.matchMedia is absent (guarded)", () => {
    Object.defineProperty(window, "matchMedia", { configurable: true, writable: true, value: undefined })
    const { container } = render(<IrisAvatar state="streaming" />)
    expect(irisOf(container).getAttribute("data-motion")).toBe("work")
  })

  it("is a React.memo component", () => {
    expect((IrisAvatar as any).$$typeof).toBe(Symbol.for("react.memo"))
  })
})

/**
 * 276 G4-avatar — measured live: ~2.6 s into `thinking` the ring snapped 14.6° → 0° in one frame.
 * The live row's key moves from `temp-…` to `run-${runId}` when the send POST resolves
 * (MessageList.tsx), so a NEW IrisAvatar mounts and its CSS loops began at 0. jsdom has no WAAPI,
 * so this stubs the browser faithfully: each avatar's 8 loop animations (ring, glow, 6 wave
 * petals) are CSSAnimations that AUTO-START at the timeline time they are created, as a real CSS
 * animation does, and `document.timeline.currentTime` is a controllable clock.
 */
describe("IrisAvatar — working avatars are phase-locked to one page clock (G4-avatar)", () => {
  let now = 0
  const savedCSSAnimation = (globalThis as any).CSSAnimation
  const savedTimeline = Object.getOwnPropertyDescriptor(document, "timeline")

  class FakeCSSAnimation {
    startTime: number | null
    private rate = 1
    readonly effect: { target: Element; getComputedTiming: () => object }
    readonly animationName: string
    constructor(animationName: string, target: Element) {
      this.animationName = animationName
      this.startTime = now // auto-play: a CSS animation starts at the time it is created
      this.effect = { target, getComputedTiming: () => ({}) }
    }
    get currentTime(): number | null {
      return this.startTime == null ? null : (now - this.startTime) * this.rate
    }
    get playbackRate() {
      return this.rate
    }
    set playbackRate(r: number) {
      // WAAPI: changing the rate keeps the current time
      const ct = this.currentTime
      this.rate = r
      if (ct != null) this.startTime = now - ct / r
    }
    cancel() {}
  }

  const animsOf = new WeakMap<Element, FakeCSSAnimation[]>()
  function loops(el: Element): FakeCSSAnimation[] {
    let list = animsOf.get(el)
    if (!list) {
      list = [
        new FakeCSSAnimation("irisGlowSoft", el.querySelector(".glow")!),
        new FakeCSSAnimation("irisOrbitTurn", el.querySelector(".spin")!),
        ...Array.from(el.querySelectorAll(".wv")).map((w) => new FakeCSSAnimation("irisWaveBump", w)),
      ]
      animsOf.set(el, list)
    }
    return list
  }
  /** The ring's position, ms into the orbit cycle (asserting all 8 loops share it). */
  function phaseOf(el: Element): number {
    const list = loops(el)
    const ring = list.find((a) => a.animationName === "irisOrbitTurn")!
    for (const a of list) expect(a.currentTime).toBeCloseTo(ring.currentTime!, 6)
    return orbitPos(ring.currentTime!)
  }

  beforeEach(() => {
    resetPhaseClock()
    now = 1000
    ;(globalThis as any).CSSAnimation = FakeCSSAnimation
    Object.defineProperty(document, "timeline", {
      configurable: true,
      value: {
        get currentTime() {
          return now
        },
      },
    })
    ;(Element.prototype as any).getAnimations = function (this: Element) {
      return this.matches("span.iris") ? loops(this) : []
    }
  })

  afterEach(() => {
    ;(globalThis as any).CSSAnimation = savedCSSAnimation
    if (savedTimeline) Object.defineProperty(document, "timeline", savedTimeline)
    else delete (document as any).timeline
    resetPhaseClock()
  })

  it("two avatars mounted 2.6 s apart in `thinking` report the same orbit phase", () => {
    const a = render(<IrisAvatar state="thinking" />)
    const elA = irisOf(a.container)
    now = 3600
    const b = render(<IrisAvatar state="thinking" />)
    const elB = irisOf(b.container)
    expect(phaseOf(elA)).not.toBe(0)
    expect(phaseOf(elB)).toBeCloseTo(phaseOf(elA), 6)
    now = 3600 + 1234
    expect(phaseOf(elB)).toBeCloseTo(phaseOf(elA), 6) // and they stay locked
  })

  it("the live row's temp → run key remount lands where the old avatar was, never at 0", () => {
    const { container, rerender } = render(<IrisAvatar key="temp-1" state="thinking" />)
    const before = irisOf(container)
    now = 3600 // ~2.6 s into thinking, as measured
    const oldPhase = phaseOf(before)
    rerender(<IrisAvatar key="run-1" state="thinking" />)
    const after = irisOf(container)
    expect(after).not.toBe(before) // a genuine remount
    expect(oldPhase).toBeGreaterThan(0)
    expect(phaseOf(after)).toBeCloseTo(oldPhase, 6)
  })

  it.each<[IrisState, number]>([
    ["tool", 1.45],
    ["streaming", 0.8],
  ])("%s: a later mount shares the phase AND keeps the rate multiplier ×%s", (state, rate) => {
    const a = render(<IrisAvatar state={state} />)
    now = 1000 + 2600
    const b = render(<IrisAvatar state={state} />)
    const elA = irisOf(a.container)
    const elB = irisOf(b.container)
    expect(phaseOf(elB)).toBeCloseTo(phaseOf(elA), 6)
    for (const anim of loops(elB)) expect(anim.playbackRate).toBe(rate)
    now += 700
    expect(phaseOf(elB)).toBeCloseTo(phaseOf(elA), 6)
  })

  it("a later mount picks up a rate change the earlier avatar made (the clock re-reads on every rate set)", () => {
    const a = render(<IrisAvatar state="thinking" />)
    now = 2000
    // jsdom has rAF; the 650 ms tween's final rate also lands by timer
    vi.useFakeTimers()
    try {
      a.rerender(<IrisAvatar state="tool" />)
      now = 2000 + 650 + 80
      vi.advanceTimersByTime(650 + 80)
    } finally {
      vi.useRealTimers()
    }
    const elA = irisOf(a.container)
    for (const anim of loops(elA)) expect(anim.playbackRate).toBe(1.45)
    now = 5000
    const b = render(<IrisAvatar state="tool" />)
    expect(phaseOf(irisOf(b.container))).toBeCloseTo(phaseOf(elA), 6)
  })

  it("reduced motion stays static — the loops are never re-timed", () => {
    stubReducedMotion(true)
    const a = render(<IrisAvatar state="thinking" />)
    const el = irisOf(a.container)
    expect(el.getAttribute("data-motion")).toBe("rest")
    // never queried, so never created/re-timed by the avatar
    expect(animsOf.has(el)).toBe(false)
  })
})

describe("index.css — the variant-D seamless-loop fence", () => {
  const raw: string = nodeFs.readFileSync(`${FRONTEND_DIR}/src/index.css`, "utf8")
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, "")

  function block(start: number): string {
    const open = css.indexOf("{", start)
    let depth = 0
    for (let i = open; i < css.length; i++) {
      if (css[i] === "{") depth++
      else if (css[i] === "}") {
        depth--
        if (depth === 0) return css.slice(open + 1, i)
      }
    }
    throw new Error("unbalanced braces")
  }

  function keyframes(name: string): string {
    const at = css.search(new RegExp(`@keyframes\\s+${name}\\s*\\{`))
    expect(at, `@keyframes ${name} missing`).toBeGreaterThanOrEqual(0)
    return block(at)
  }

  function duration(name: string): number {
    const m = css.match(new RegExp(`animation:\\s*${name}\\s+([\\d.]+)s`))
    expect(m, `no animation rule uses ${name}`).not.toBeNull()
    return Number(m![1])
  }

  it("irisMotion's ORBIT_MS (the phase clock's cycle) equals the CSS irisOrbitTurn period", () => {
    expect(duration("irisOrbitTurn") * 1000).toBe(ORBIT_MS)
  })

  it("@keyframes irisOrbitTurn ends at rotate(360deg)", () => {
    const rotations = [...keyframes("irisOrbitTurn").matchAll(/rotate\(([\d.]+)deg\)/g)].map((m) => Number(m[1]))
    expect(rotations[rotations.length - 1]).toBe(360)
  })

  it("the orbit period is an integer multiple (≥ 1) of the wave period, and the glow period divides it", () => {
    const orbit = duration("irisOrbitTurn")
    const wave = duration("irisWaveBump")
    const glow = duration("irisGlowSoft")
    const k = orbit / wave
    expect(Math.abs(k - Math.round(k))).toBeLessThan(1e-9)
    expect(Math.round(k)).toBeGreaterThanOrEqual(1)
    const g = orbit / glow
    expect(Math.abs(g - Math.round(g))).toBeLessThan(1e-9)
  })

  it("the .wv delay is negative and evenly spaced by period/6", () => {
    const m = css.match(/\.wv\s*\{[^}]*animation:\s*irisWaveBump[^}]*animation-delay:\s*calc\(\(var\(--i\)\s*-\s*6\)\s*\*\s*([\d.]+)s\s*\/\s*6\)/)
    expect(m, "the .wv rule's negative period/6 delay").not.toBeNull()
    expect(Number(m![1])).toBe(duration("irisWaveBump"))
  })

  it("@keyframes brandPulse occurs exactly once — the surviving shrink-and-dim one", () => {
    expect(css.match(/@keyframes\s+brandPulse\b/g)).toHaveLength(1)
    expect(keyframes("brandPulse")).toContain("scale(0.82)")
  })

  it("a prefers-reduced-motion block stops .iris * and the shimmer bar", () => {
    const blocks: string[] = []
    const re = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g
    let m: RegExpExecArray | null
    while ((m = re.exec(css))) blocks.push(block(m.index))
    const hit = blocks.find(
      (b) => /\.iris \*/.test(b) && /\.tool-progress-bar::after/.test(b) && /animation:\s*none/.test(b),
    )
    expect(hit, "no reduced-motion block resets both .iris * and .tool-progress-bar::after").toBeDefined()
  })

  it("only variant D ships — no A/B/C keyframes or animation names", () => {
    for (const forbidden of [/irisBreathe/, /irisCore/, /irisOrbit\b/, /irisWave\b/, /irisGlow\b/]) {
      expect(css).not.toMatch(forbidden)
    }
  })
})
