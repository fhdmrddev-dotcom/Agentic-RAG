// Phase 276-03 (G4-4, UI-SPEC "Routing and loading contract") — the docs root: an unknown /docs/*
// path renders the not-found page INSIDE the docs shell, document.title follows the route, and a
// same-origin /docs link navigates client-side (no full page load) and lands focus on the new H1.
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// The plugin is not part of the vitest config, so the one module that imports the virtual
// manifest (docsManifest.ts) is replaced here.
vi.mock("../docsManifest", () => {
  const page = (slug: string, title: string, status: "written" | "stub") => ({
    slug,
    title,
    section: slug.split("/")[0],
    audience: "user",
    status,
    release: "shipped",
    covers: ["A5"],
    unreleased: [],
    summary: status === "stub" ? "A short summary." : "Lead.",
    nearest: status === "stub" ? "use/chat" : null,
    video: null,
    reviewed: status === "written" ? "2026-10-04" : null,
    updated: null,
    headings: [],
    readMinutes: 2,
  })
  return {
    DOCS_DATA: {
      sections: [
        { id: "use", title: "Use Syrel", purpose: "Chat and the Library.", slugs: ["use/chat", "use/chat-modes"] },
        { id: "changelog", title: "Changelog", purpose: "Every release.", slugs: [] },
      ],
      pages: [page("use/chat", "Chatting with Syrel", "written"), page("use/chat-modes", "Deep mode", "stub")],
      changelog: [],
      chapters: [],
      loadPage: (slug: string) => Promise.resolve(slug === "use/chat" ? "Body.\n\n## One\n\nText.\n" : ""),
    },
  }
})

const { DocsApp } = await import("../DocsApp")

afterEach(() => {
  window.history.replaceState(null, "", "/")
})

describe("DocsApp", () => {
  it("renders an unknown /docs path as the docs not-found page, inside the shell", () => {
    window.history.replaceState(null, "", "/docs/nope")
    render(<DocsApp />)
    expect(screen.getByRole("heading", { level: 1, name: "This page isn't in the docs" })).toBeInTheDocument()
    expect(screen.getByText("It may have moved or been renamed. Search the docs, or start from the docs home.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Go to the docs home" }).getAttribute("href")).toBe("/docs")
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe("#content")
    expect(document.title).toBe("Page not found · Syrel Docs")
  })

  it("navigates a /docs link client-side, updates the title and focuses the new H1", async () => {
    window.history.replaceState(null, "", "/docs/use")
    render(<DocsApp />)
    expect(document.title).toBe("Use Syrel · Syrel Docs")
    const link = screen.getByRole("link", { name: /Chatting with Syrel/ })
    const notPrevented = fireEvent.click(link)
    expect(notPrevented).toBe(false) // the click was intercepted (no full page load)
    expect(window.location.pathname).toBe("/docs/use/chat")
    const h1 = await screen.findByRole("heading", { level: 1, name: "Chatting with Syrel" })
    expect(document.title).toBe("Chatting with Syrel · Syrel Docs")
    expect(document.activeElement).toBe(h1)
  })

  it("renders the home page with the hero search box and no header search trigger", () => {
    window.history.replaceState(null, "", "/docs")
    render(<DocsApp />)
    expect(screen.getByRole("heading", { level: 1, name: /Everything Syrel does,/ })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Search the docs" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Search docs/ })).toBeNull()
    expect(document.title).toBe("Syrel Docs")
  })
})
