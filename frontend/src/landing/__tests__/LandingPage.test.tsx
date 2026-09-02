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
})
