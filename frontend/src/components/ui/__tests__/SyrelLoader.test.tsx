/**
 * quick-261016-u3w (SEED-359 part A) — behaviour fence for SyrelLoader, the one shared branded
 * loader built on the Syrel Iris mark (IrisAvatar, Phase 276-06).
 *
 * Pins: exactly one polite status, its accessible name (label or "Loading"), the size → Iris
 * pixel map (section 20 / panel 32 / page 48), the Iris in its working state, the reduced-motion
 * still mark with a lit core, and className merging onto the root.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { SyrelLoader } from "../SyrelLoader"
import { resetPhaseClock } from "@/components/chat/irisMotion"

const savedMatchMedia = window.matchMedia

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

beforeEach(() => {
  resetPhaseClock()
  stubReducedMotion(false)
})

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: savedMatchMedia,
  })
})

function irisOf(container: HTMLElement): HTMLSpanElement {
  const all = container.querySelectorAll("span.iris")
  expect(all).toHaveLength(1)
  return all[0] as HTMLSpanElement
}

describe("SyrelLoader", () => {
  it("renders exactly one polite status root with the shared test id", () => {
    render(<SyrelLoader />)
    const statuses = screen.getAllByRole("status")
    expect(statuses).toHaveLength(1)
    const root = statuses[0]
    expect(root.getAttribute("aria-live")).toBe("polite")
    expect(root.getAttribute("data-testid")).toBe("syrel-loader")
  })

  it("without a label: accessible name is 'Loading' and no visible text renders", () => {
    render(<SyrelLoader />)
    const root = screen.getByRole("status", { name: "Loading" })
    expect(root.getAttribute("aria-label")).toBe("Loading")
    expect((root.textContent ?? "").trim()).toBe("")
  })

  it("with a label: the words are visible AND are the accessible name", () => {
    render(<SyrelLoader label="Loading rules…" />)
    const root = screen.getByRole("status", { name: "Loading rules…" })
    expect(root.textContent).toContain("Loading rules…")
  })

  it.each([
    ["section", 20],
    ["panel", 32],
    ["page", 48],
  ] as const)("size %s maps to a %ipx Iris and is recorded on data-size", (size, px) => {
    const { container } = render(<SyrelLoader size={size} />)
    const root = screen.getByTestId("syrel-loader")
    expect(root.getAttribute("data-size")).toBe(size)
    const iris = irisOf(container)
    expect(iris.style.width).toBe(`${px}px`)
    expect(iris.style.height).toBe(`${px}px`)
  })

  it("defaults to the panel size", () => {
    const { container } = render(<SyrelLoader />)
    expect(screen.getByTestId("syrel-loader").getAttribute("data-size")).toBe("panel")
    expect(irisOf(container).style.width).toBe("32px")
  })

  it("shows the Iris in its working state, hidden from assistive tech", () => {
    const { container } = render(<SyrelLoader />)
    const iris = irisOf(container)
    expect(iris.getAttribute("data-state")).toBe("thinking")
    expect(iris.getAttribute("aria-hidden")).toBe("true")
  })

  it("under reduced motion the Iris rests with a lit core", () => {
    stubReducedMotion(true)
    const { container } = render(<SyrelLoader label="Loading folders…" />)
    const iris = irisOf(container)
    expect(iris.getAttribute("data-motion")).toBe("rest")
    expect(iris.hasAttribute("data-lit")).toBe(true)
  })

  it("merges a caller className onto the root", () => {
    render(<SyrelLoader className="py-8 text-sm" />)
    const root = screen.getByTestId("syrel-loader")
    expect(root.classList.contains("py-8")).toBe(true)
    expect(root.classList.contains("text-sm")).toBe(true)
  })
})
