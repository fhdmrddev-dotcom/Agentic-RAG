// Phase 276-03 (D-01, D-04, G4-3, T-276-11) — a written guide: breadcrumbs, meta pills, the
// "On this page" pill only with >= 3 H2s, the partial-unreleased callout, heading ids that match
// the build's headingId(), and Markdown that can never become live HTML or a javascript: link.
import { fireEvent, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import docsContent from "../../../../scripts/lib/docs-content.cjs"
import { headingId } from "../headingId"
import { Article } from "../pages/Article"
import { fixtureData, makePage, renderWithDocs } from "./helpers/docsFixture"

vi.mock("../video/VideoSlot", () => ({
  VideoSlot: ({ slot }: { slot: string | null }) => (slot ? <div>video-slot:{slot}</div> : null),
}))

const THREE = "Intro line.\n\n## The composer\n\nType.\n\n## Stopping a run\n\nStop.\n\n## Citations and `sources`\n\nRead.\n"
const TWO = "Intro.\n\n## One\n\nA.\n\n## Two\n\nB.\n"
const HOSTILE = [
  "Before.",
  "",
  "<script>alert(1)</script>",
  "",
  'Inline <img src="x" onerror="alert(2)"> html.',
  "",
  "[click me](javascript:alert(3))",
  "",
  "## Only",
  "",
  "After.",
].join("\n")

const chat = makePage({
  slug: "use/chat",
  title: "Chatting with Syrel",
  summary: "Ask a question and read the cited answer.",
  readMinutes: 4,
  reviewed: "2026-10-04",
  headings: [
    { id: "the-composer", text: "The composer" },
    { id: "stopping-a-run", text: "Stopping a run" },
    { id: "citations-and-sources", text: "Citations and sources" },
  ],
})
const two = makePage({
  slug: "use/library/find",
  title: "Finding a document",
  headings: [
    { id: "one", text: "One" },
    { id: "two", text: "Two" },
  ],
  unreleased: ["A19"],
})
const hostile = makePage({ slug: "connect/drive", title: "Google Drive", headings: [{ id: "only", text: "Only" }] })
const stub = makePage({ slug: "use/chat-modes", title: "Deep mode", status: "stub", nearest: "use/chat", summary: "s" })

const data = fixtureData([chat, stub, two, hostile], {
  "use/chat": THREE,
  "use/library/find": TWO,
  "connect/drive": HOSTILE,
})

describe("Article page (P2)", () => {
  it("renders breadcrumbs, meta pills and an On this page pill listing the 3 H2s", async () => {
    renderWithDocs(<Article slug="use/chat" />, data)
    const crumbs = screen.getByRole("navigation", { name: "Breadcrumb" })
    expect(crumbs.textContent).toMatch(/Docs\s*›\s*Use Syrel\s*›\s*Chatting with Syrel/)
    expect(within(crumbs).getByText("Chatting with Syrel").closest("[aria-current='page']")).not.toBeNull()
    expect(screen.getByText("4 min read")).toBeInTheDocument()
    expect(screen.getByText("Last reviewed 2026-10-04")).toBeInTheDocument()

    const toc = screen.getByRole("button", { name: /On this page/ })
    expect(toc.getAttribute("aria-expanded")).toBe("false")
    fireEvent.click(toc)
    expect(toc.getAttribute("aria-expanded")).toBe("true")
    const list = document.getElementById("toc-list") as HTMLElement
    const items = within(list).getAllByRole("link")
    expect(items.map((a) => a.textContent)).toEqual(["The composer", "Stopping a run", "Citations and sources"])

    // body H2s carry the same ids as the build's headingId()
    const h2 = await screen.findByRole("heading", { level: 2, name: /Citations and/ })
    expect(h2.id).toBe("citations-and-sources")
    expect(screen.getAllByRole("link", { name: "Link to this section" }).length).toBe(3)
  })

  it("renders no TOC pill with only 2 H2s, and the partial-unreleased callout", async () => {
    renderWithDocs(<Article slug="use/library/find" />, data)
    await screen.findByRole("heading", { level: 2, name: "Two" })
    expect(screen.queryByRole("button", { name: /On this page/ })).toBeNull()
    expect(screen.getByText(/Part of this page is not yet released/)).toBeInTheDocument()
    expect(screen.getByText(/A19/)).toBeInTheDocument()
    expect(screen.queryByText(/Nothing on this page is in Syrel today/)).toBeNull()
  })

  it("renders raw HTML as text and never renders a javascript: href", async () => {
    const { container } = renderWithDocs(<Article slug="connect/drive" />, data)
    await screen.findByText("After.")
    expect(container.querySelector("script")).toBeNull()
    expect(container.querySelector("img[onerror]")).toBeNull()
    expect(container.textContent).toContain("<script>alert(1)</script>")
    for (const a of Array.from(container.querySelectorAll("a"))) {
      expect((a.getAttribute("href") ?? "").toLowerCase().startsWith("javascript:")).toBe(false)
    }
  })

  it("an unreleased written page shows the badge and the exact callout", async () => {
    const v45 = makePage({ slug: "use/library/find", title: "Find", release: "v4.5" })
    renderWithDocs(<Article slug="use/library/find" />, fixtureData([v45], { "use/library/find": TWO }))
    expect(screen.getByText("Not yet released")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Not yet released. This is part of v4.5, which has not shipped. Nothing on this page is in Syrel today.",
      ),
    ).toBeInTheDocument()
  })
})

describe("headingId parity with the build", () => {
  it("matches scripts/lib/docs-content.cjs headingId for every sample", () => {
    const samples = ["The composer", "Citations and `sources`", "What's **new** in v4.5?", "  Edge -- case  ", "Ünïcode & co"]
    for (const s of samples) expect(headingId(s)).toBe(docsContent.headingId(s))
  })
})
