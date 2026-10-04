// Phase 276-03 (D-07, D-04, G4-3, SC#6) — a stub page renders its summary, its honesty badges and
// callouts, its frontmatter video slot, and "Read next" links to the nearest finished page.
// Assertions are on rendered WORDS: a presence assertion by testid cannot see the copy drift.
import { screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { Stub } from "../pages/Stub"
import { fixtureData, makePage, renderWithDocs } from "./helpers/docsFixture"

vi.mock("../video/VideoSlot", () => ({
  VideoSlot: ({ slot }: { slot: string | null }) => (slot ? <div>video-slot:{slot}</div> : null),
}))

const written = makePage({ slug: "connect/connections", title: "Connections", headings: [] })
const writtenSibling = makePage({ slug: "connect/drive", title: "Google Drive" })
const v45Stub = makePage({
  slug: "connect/overview",
  title: "Connecting your tools",
  status: "stub",
  release: "v4.5",
  summary: "Connections bring outside services into Syrel. Each one is set up once by an admin.",
  nearest: "connect/connections",
  video: "clip.connections",
})
const shippedStub = makePage({
  slug: "use/chat-modes",
  title: "Deep mode and Workflow mode",
  status: "stub",
  summary: "Syrel has two chat modes.",
  nearest: "use/chat",
})
const chat = makePage({ slug: "use/chat", title: "Chatting with Syrel" })

const data = fixtureData([written, writtenSibling, v45Stub, shippedStub, chat])

describe("Stub page (P3)", () => {
  it("renders the stub words, the unreleased badge + exact callout, and the summary", () => {
    renderWithDocs(<Stub slug="connect/overview" />, data)
    expect(screen.getByRole("heading", { level: 1, name: "Connecting your tools" })).toBeInTheDocument()
    expect(screen.getByText("Full guide coming")).toBeInTheDocument()
    expect(screen.getByText("Not yet released")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Not yet released. This is part of v4.5, which has not shipped. Nothing on this page is in Syrel today.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText(/Connections bring outside services into Syrel\./)).toBeInTheDocument()
    expect(screen.getByText("This page is a short summary. The full guide is being written.")).toBeInTheDocument()
  })

  it("links Read next to the nearest written page and back to the section", () => {
    renderWithDocs(<Stub slug="connect/overview" />, data)
    const heading = screen.getByRole("heading", { name: "Read next" })
    expect(heading).toBeInTheDocument()
    const links = screen.getAllByRole("link").map((a) => a.getAttribute("href"))
    expect(links).toContain("/docs/connect/connections")
    // the nearest page comes first
    const readNext = heading.parentElement as HTMLElement
    const first = within(readNext).getAllByRole("link")[0]
    expect(first.getAttribute("href")).toBe("/docs/connect/connections")
    expect(screen.getByRole("link", { name: /All of Connect/ }).getAttribute("href")).toBe("/docs/connect")
  })

  it("renders its frontmatter video slot (SC#6)", () => {
    renderWithDocs(<Stub slug="connect/overview" />, data)
    expect(screen.getByText("video-slot:clip.connections")).toBeInTheDocument()
  })

  it("has no TOC pill and no pager", () => {
    renderWithDocs(<Stub slug="connect/overview" />, data)
    expect(screen.queryByText("On this page")).toBeNull()
    expect(screen.queryByText("Previous")).toBeNull()
    expect(screen.queryByText("Next")).toBeNull()
  })

  it("a shipped stub carries no unreleased badge or callout", () => {
    renderWithDocs(<Stub slug="use/chat-modes" />, data)
    expect(screen.getByText("Full guide coming")).toBeInTheDocument()
    expect(screen.queryByText("Not yet released")).toBeNull()
    expect(screen.queryByText(/Nothing on this page is in Syrel today/)).toBeNull()
    expect(screen.getByRole("link", { name: /Chatting with Syrel/ }).getAttribute("href")).toBe("/docs/use/chat")
  })
})
