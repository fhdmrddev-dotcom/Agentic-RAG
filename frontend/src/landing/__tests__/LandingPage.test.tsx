import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { LandingPage } from "../LandingPage"

// Mock window.matchMedia for tests
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

describe("LandingPage Assembly & Interactivity", () => {
  it("renders the main page root and primary navigation", () => {
    render(<LandingPage />)

    // Primary brand header
    const brandElements = screen.getAllByText(/Agentic RAG/i)
    expect(brandElements.length).toBeGreaterThan(0)

    // Navigation anchor links
    const nav = screen.getByRole("navigation", { name: /main navigation/i })
    expect(nav).toBeDefined()
    expect(screen.getAllByText("Features").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Tour").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Workflows").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Compare").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Security").length).toBeGreaterThan(0)

    // Sign in links should point to /app (per F-1)
    const signIns = screen.getAllByText("Sign in")
    expect(signIns.length).toBeGreaterThan(0)
    expect(signIns[0].getAttribute("href")).toBe("/app")
  })

  it("renders hero section with verified claim facts", () => {
    render(<LandingPage />)

    // H1 headline
    expect(
      screen.getByText(
        "An AI agent that knows your documents, does the work, and asks before it acts.",
      ),
    ).toBeDefined()

    // Facts strip
    expect(screen.getByText("model providers, cloud and local")).toBeDefined()
    expect(
      screen.getByText("checks a workflow must pass before it publishes"),
    ).toBeDefined()
    expect(screen.getByText("of tables under row-level security")).toBeDefined()
  })

  it("supports switching tabs in the product tour", () => {
    render(<LandingPage />)

    // Initial tab is Chat
    expect(
      screen.getByText(
        "The front door. An agent with thirty tools and your documents behind it.",
      ),
    ).toBeDefined()

    // Switch to Workflows tab
    const workflowsTab = screen.getByRole("tab", { name: "Workflows" })
    fireEvent.click(workflowsTab)

    expect(
      screen.getByText(
        "Recurring work, described once, run on a schedule, proven before it ships.",
      ),
    ).toBeDefined()

    // Switch to Skills tab
    const skillsTab = screen.getByRole("tab", { name: "Skills" })
    fireEvent.click(skillsTab)

    expect(
      screen.getByText(
        "Teach it once. It keeps the procedure, versions it, and knows when to use it.",
      ),
    ).toBeDefined()

    // Switch to Library tab
    const libraryTab = screen.getByRole("tab", { name: "Library" })
    fireEvent.click(libraryTab)

    expect(
      screen.getByText(
        "Your knowledge base — with the honesty layer most tools skip.",
      ),
    ).toBeDefined()
  })

  it("renders compare table and expands full 30-row matrix on toggle", () => {
    render(<LandingPage />)

    // Category comparison table
    expect(
      screen.getByText("Where it sits next to what you already use."),
    ).toBeDefined()
    expect(screen.getByText("General chat assistant")).toBeDefined()

    // Click to expand full matrix
    const toggleBtn = screen.getByRole("button", {
      name: /view full 30-point matrix/i,
    })
    fireEvent.click(toggleBtn)

    expect(
      screen.getByText("Thirty things, five ways of getting them."),
    ).toBeDefined()
    expect(screen.getByText("Workflow platform")).toBeDefined()
    expect(screen.getByText("In-house build")).toBeDefined()

    // Toggle button changes text
    expect(
      screen.getByRole("button", { name: /hide full comparison/i }),
    ).toBeDefined()
  })

  it("renders files and use cases sections", () => {
    render(<LandingPage />)

    expect(screen.getByText("What goes in, what comes out.")).toBeDefined()
    expect(screen.getAllByText("PDF").length).toBeGreaterThan(0)
    expect(screen.getAllByText("DOCX").length).toBeGreaterThan(0)

    expect(screen.getByText("Who uses it, and for what.")).toBeDefined()
    expect(screen.getByText("Construction & engineering")).toBeDefined()
    expect(screen.getByText("Legal & compliance")).toBeDefined()
  })

  it("structural assertions: Orbit orbs, WorksWith tiles, and Features card counts match catalog facts", async () => {
    const { container } = render(<LandingPage />)
    const { MODEL_PROVIDERS, LOCAL_RUNTIMES, CONNECTOR_CATALOG } = await import("../facts")

    // 1. Orbit orbs count matches MODEL_PROVIDERS + LOCAL_RUNTIMES (10 orbs)
    const orbs = container.querySelectorAll(".orbit .orb")
    expect(orbs.length).toBe(MODEL_PROVIDERS.length + LOCAL_RUNTIMES.length)

    // 2. WorksWith tiles count matches CONNECTOR_CATALOG (13 tiles)
    const appTiles = container.querySelectorAll(".appgrid .apptile")
    expect(appTiles.length).toBe(CONNECTOR_CATALOG.length)

    // 3. Features capability tiles count matches 12 cards
    const featCards = container.querySelectorAll("#features .card")
    expect(featCards.length).toBe(12)

    // 4. How it works section renders 3 steps
    const howItWorksCards = container.querySelectorAll("#how-it-works .card")
    expect(howItWorksCards.length).toBe(3)
  })

  it("responsive overflow invariant: cmp-scroll wrappers have no inline overflow style and page-root has no root clip", () => {
    const { container } = render(<LandingPage />)

    // Expand the 30-row matrix so both cmp-scroll wrappers are mounted
    const toggleBtn = screen.getByRole("button", { name: /view full 30-point matrix/i })
    fireEvent.click(toggleBtn)

    // Blocker 16: Ensure neither cmp-scroll wrapper has inline overflow: hidden
    const cmpScrollElements = container.querySelectorAll(".cmp-scroll")
    expect(cmpScrollElements.length).toBe(2)
    for (const el of cmpScrollElements) {
      const inlineStyle = el.getAttribute("style") || ""
      expect(inlineStyle).not.toContain("overflow")
    }

    // Advisory 17: Ensure page-root does not rely on overflow-x: clip
    const pageRoot = container.querySelector(".page-root")
    expect(pageRoot).toBeDefined()
    const pageRootStyle = pageRoot?.getAttribute("style") || ""
    expect(pageRootStyle).not.toContain("clip")
  })
})
