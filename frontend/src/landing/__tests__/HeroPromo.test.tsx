// Phase 276-05 (D-10, D-15, D-19, UI-SPEC V4, G4-2) — the landing hero promo.
//   - nothing is imported on mount, nor on visibility alone: it needs window load + a first scroll
//     + the slot ≥ 50% visible ("never on first paint", even on a tall screen)
//   - it plays MUTED, looping, with no default controls; Pause and Unmute are always there
//   - no audio is requested until Unmute (musicSrc stays null until then)
//   - < 25% visible pauses; under prefers-reduced-motion it never autoplays and offers a play button
import { act, createElement, forwardRef, useImperativeHandle } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { HeroSection } from "../components/HeroSection"

const h = vi.hoisted(() => ({
  promoImport: vi.fn(),
  playerImport: vi.fn(),
  playerProps: [] as Record<string, unknown>[],
  methods: {
    play: vi.fn(),
    pause: vi.fn(),
    mute: vi.fn(),
    unmute: vi.fn(),
    isPlaying: vi.fn(() => true),
  },
}))

vi.mock("@remotion/player", () => {
  h.playerImport()
  const Player = forwardRef<unknown, Record<string, unknown>>(function Player(props, ref) {
    h.playerProps.push(props)
    useImperativeHandle(ref, () => h.methods)
    return createElement("div", { "data-testid": "promo-player" })
  })
  return { Player }
})
vi.mock("@video/promo/SyrelPromo", () => ({
  PROMO_DURATION: 1005,
  PromoBody: (p: { musicSrc?: string | null }) => createElement("div", { "data-music": String(p.musicSrc) }),
}))
// The real kit pulls remotion + transitions (seconds to import on a loaded box); the promo only
// needs its two contexts here.
vi.mock("@video/energetic/kit", async () => {
  const { createContext } = await import("react")
  return { AudioOn: createContext(true), SfxOn: createContext(true) }
})
vi.mock("../components/HeroPromo", async (importOriginal) => {
  h.promoImport()
  return importOriginal()
})

type IOCallback = (entries: { target: Element; intersectionRatio: number; isIntersecting: boolean }[]) => void
const observers: { cb: IOCallback; targets: Element[]; disconnected: boolean }[] = []

class MockIntersectionObserver {
  private rec: { cb: IOCallback; targets: Element[]; disconnected: boolean }
  constructor(cb: IOCallback) {
    this.rec = { cb, targets: [], disconnected: false }
    observers.push(this.rec)
  }
  observe(el: Element) {
    this.rec.targets.push(el)
  }
  unobserve() {}
  disconnect() {
    this.rec.disconnected = true
  }
  takeRecords() {
    return []
  }
}

function fireIntersection(target: Element, ratio: number) {
  act(() => {
    for (const o of observers) {
      if (o.disconnected) continue
      if (o.targets.some((t) => t === target || t.contains(target) || target.contains(t))) {
        o.cb([{ target: o.targets[0], intersectionRatio: ratio, isIntersecting: ratio > 0 }])
      }
    }
  })
}

function mockReducedMotion(reduce: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

const lastPlayer = () => h.playerProps[h.playerProps.length - 1] as Record<string, unknown> & {
  inputProps: { musicSrc: string | null }
}

beforeEach(() => {
  observers.length = 0
  h.playerProps.length = 0
  for (const m of Object.values(h.methods)) m.mockClear()
  ;(window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = MockIntersectionObserver
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe("Landing hero promo (V4)", { timeout: 60000 }, () => {
  // ⚠ ORDER-DEPENDENT BY DESIGN: the first test proves the FIRST import happens only after
  // load + scroll + ≥ 50% visibility (the module registry is shared across this file).
  it("imports nothing on mount or on visibility alone; starts muted after load + a scroll + ≥ 50%", async () => {
    mockReducedMotion(false)
    render(<HeroSection />)
    const slot = screen.getByRole("figure", { name: "Syrel promo video" })
    const poster = slot.querySelector("img") as HTMLImageElement
    expect(poster.getAttribute("src")).toBe("/docs-assets/posters/landing-promo.jpg")
    expect(poster.getAttribute("loading")).toBe("lazy")
    expect(h.promoImport).not.toHaveBeenCalled()

    act(() => {
      window.dispatchEvent(new Event("load"))
    })
    fireIntersection(slot, 0.6) // visible, but the reader has not scrolled yet
    await act(async () => {})
    expect(h.promoImport).not.toHaveBeenCalled()
    expect(h.playerImport).not.toHaveBeenCalled()

    act(() => {
      window.dispatchEvent(new Event("scroll"))
    })
    expect(await screen.findByTestId("promo-player", {}, { timeout: 30000 })).toBeInTheDocument()
    expect(h.promoImport).toHaveBeenCalledTimes(1)
    expect(h.playerImport).toHaveBeenCalledTimes(1)

    const p = lastPlayer()
    expect(p.initiallyMuted).toBe(true)
    expect(p.loop).toBe(true)
    expect(p.autoPlay).toBe(true)
    expect(p.controls).toBeFalsy()
    expect(p.acknowledgeRemotionLicense).toBe(true)
    expect(p.durationInFrames).toBe(1005)
    expect(p.inputProps.musicSrc).toBeNull() // no audio element, no audio request (D-19)
    expect(screen.getByRole("button", { name: "Pause promo" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Unmute promo" })).toBeInTheDocument()
  })

  it("Unmute switches in the web music copy; Pause sticks across a visibility change", async () => {
    mockReducedMotion(false)
    render(<HeroSection />)
    const slot = screen.getByRole("figure", { name: "Syrel promo video" })
    act(() => {
      window.dispatchEvent(new Event("load"))
      window.dispatchEvent(new Event("scroll"))
    })
    fireIntersection(slot, 0.9)
    await screen.findByTestId("promo-player", {}, { timeout: 30000 })
    expect(lastPlayer().inputProps.musicSrc).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Unmute promo" }))
    expect(lastPlayer().inputProps.musicSrc).toBe("music/syrel-pulse.mp3")
    expect(h.methods.unmute).toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Mute promo" }))
    expect(h.methods.mute).toHaveBeenCalled()

    // < 25% visible pauses
    h.methods.pause.mockClear()
    fireIntersection(slot, 0.1)
    expect(h.methods.pause).toHaveBeenCalled()
    h.methods.play.mockClear()
    fireIntersection(slot, 0.8)
    expect(h.methods.play).toHaveBeenCalled() // the reader had not pressed Pause → resumes

    // the reader's Pause wins over a return to view
    const pause = screen.getByRole("button", { name: "Pause promo" })
    fireEvent.click(pause)
    const play = screen.getByRole("button", { name: "Play promo" })
    expect(play.getAttribute("aria-pressed")).toBe("true")
    h.methods.play.mockClear()
    fireIntersection(slot, 0.1)
    fireIntersection(slot, 0.9)
    expect(h.methods.play).not.toHaveBeenCalled()
  })

  it("under reduced motion: never autoplays on scroll; a play button starts it muted with the controls", async () => {
    mockReducedMotion(true)
    render(<HeroSection />)
    const slot = screen.getByRole("figure", { name: "Syrel promo video" })
    act(() => {
      window.dispatchEvent(new Event("load"))
      window.dispatchEvent(new Event("scroll"))
    })
    fireIntersection(slot, 1)
    await act(async () => {})
    expect(screen.queryByTestId("promo-player")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Play the Syrel promo" }))
    expect(await screen.findByTestId("promo-player", {}, { timeout: 30000 })).toBeInTheDocument()
    expect(lastPlayer().initiallyMuted).toBe(true)
    expect(lastPlayer().inputProps.musicSrc).toBeNull()
    expect(screen.getByRole("button", { name: "Pause promo" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Unmute promo" })).toBeInTheDocument()
  })
})
