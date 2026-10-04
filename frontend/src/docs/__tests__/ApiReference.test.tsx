// Phase 276-03 (DOCS-03, D-16, T-276-13) — the public API reference: a lazy Scalar mount over the
// static openapi.public.json with telemetry off, the AI agent disabled and the test-request /
// client buttons hidden, under the exact "No API keys today." callout. The page never calls a
// live backend.
import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ApiReference } from "../pages/ApiReference"

const captured: { configuration: Record<string, unknown> }[] = []

vi.mock("@scalar/api-reference-react", () => ({
  ApiReferenceReact: (props: { configuration: Record<string, unknown> }) => {
    captured.push(props)
    return <div>scalar-mounted</div>
  },
}))

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  captured.length = 0
  fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("API reference page (P6)", () => {
  it("shows the loading line first, the callout and links, then mounts Scalar with the privacy config", async () => {
    render(<ApiReference />)
    expect(screen.getByRole("status").textContent).toBe("Loading the API reference…")
    expect(screen.getByRole("heading", { level: 1, name: "Syrel API" })).toBeInTheDocument()
    expect(screen.getByText("No API keys today.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "see what's planned" }).getAttribute("href")).toBe(
      "/docs/api/roadmap-open-platform",
    )
    expect(screen.getByRole("link", { name: "Authentication" }).getAttribute("href")).toBe(
      "/docs/api/concepts/authentication",
    )
    expect(screen.getByRole("link", { name: "Download the OpenAPI file" }).getAttribute("href")).toBe(
      "/docs-assets/openapi.public.json",
    )
    expect(screen.getByRole("link", { name: "Operator API" }).getAttribute("href")).toBe("/docs/api/reference/operator")

    expect(await screen.findByText("scalar-mounted")).toBeInTheDocument()
    expect(screen.queryByText("Loading the API reference…")).toBeNull()
    const cfg = captured[captured.length - 1].configuration
    expect(cfg.url).toBe("/docs-assets/openapi.public.json")
    expect(cfg.telemetry).toBe(false)
    expect(cfg.agent).toEqual({ disabled: true })
    expect(cfg.hideTestRequestButton).toBe(true)
    expect(cfg.hideClientButton).toBe(true)
    expect(cfg.withDefaultFonts).toBe(false)
    expect(cfg.forceDarkModeState).toBe("dark")
    expect(cfg.hideDarkModeToggle).toBe(true)
    // the only request the page itself makes is the static spec check — never a live backend
    for (const call of fetchMock.mock.calls) expect(String(call[0])).toBe("/docs-assets/openapi.public.json")
  })

  it("renders the exact error copy when the reference cannot load", async () => {
    render(<ApiReference load={() => Promise.reject(new Error("chunk failed"))} />)
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain(
      "The API reference couldn't load. Refresh the page, or download the OpenAPI file.",
    )
    expect(screen.queryByText("scalar-mounted")).toBeNull()
  })

  it("renders the error state when the spec file is missing (dev answers 404)", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response("missing", { status: 404 })))
    render(<ApiReference />)
    expect(await screen.findByRole("alert")).toBeInTheDocument()
    expect(screen.queryByText("scalar-mounted")).toBeNull()
  })
})
