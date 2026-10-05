// Phase 276-03 (G4-4, UI-SPEC "Routing and loading contract") — the docs root: an unknown /docs/*
// path renders the not-found page INSIDE the docs shell, document.title follows the route, and a
// same-origin /docs link navigates client-side (no full page load) and lands focus on the new H1.
import { act, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

// 276-REVIEW B-CR-02: a test can hold a page body back (a deferred loadPage), the way the real
// per-page dynamic import arrives after the navigation effect has already run.
const bodyGate = vi.hoisted(() => ({ wait: null as Promise<void> | null }))

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
      loadPage: async (slug: string) => {
        if (bodyGate.wait) await bodyGate.wait
        return slug === "use/chat" ? "Body.\n\n## One\n\nText.\n" : ""
      },
    },
  }
})

const { DocsApp, DocsRootBoundary, safeDecode, titleFor } = await import("../DocsApp")

afterEach(() => {
  window.history.replaceState(null, "", "/")
  bodyGate.wait = null
  vi.unstubAllGlobals()
})

function holdBodies(): () => Promise<void> {
  let release!: () => void
  bodyGate.wait = new Promise<void>((res) => (release = res))
  return async () => {
    await act(async () => {
      release()
      await Promise.resolve()
    })
  }
}

function stubScrolling() {
  const scrolled: Element[] = []
  const intoView = vi.fn(function (this: Element) {
    scrolled.push(this)
  })
  Object.defineProperty(Element.prototype, "scrollIntoView", { value: intoView, configurable: true, writable: true })
  const scrollTo = vi.fn()
  vi.stubGlobal("scrollTo", scrollTo)
  return { scrolled, scrollTo }
}

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

  it("scrolls a first-load #section deep link once the deferred body has rendered (B-CR-02)", async () => {
    const { scrolled } = stubScrolling()
    const release = holdBodies()
    window.history.replaceState(null, "", "/docs/use/chat#one")
    render(<DocsApp />)
    await screen.findByRole("heading", { level: 1, name: "Chatting with Syrel" })
    // the body is still loading: the H2 does not exist and nothing has scrolled yet
    expect(document.getElementById("one")).toBeNull()
    expect(scrolled).toEqual([])
    await release()
    const h2 = await screen.findByRole("heading", { level: 2, name: "One" })
    expect(h2.id).toBe("one")
    expect(scrolled).toContain(h2)
  })

  it("lands a cross-page navigation to /docs/x#y on the section, not the top (B-CR-02)", async () => {
    const { scrolled, scrollTo } = stubScrolling()
    window.history.replaceState(null, "", "/docs/use")
    render(<DocsApp />)
    const release = holdBodies()
    const { navigate } = await import("../router")
    act(() => navigate("/docs/use/chat#one"))
    await screen.findByRole("heading", { level: 1, name: "Chatting with Syrel" })
    expect(scrollTo).toHaveBeenCalledWith(0, 0) // starts at the top while the body loads ...
    expect(scrolled).toEqual([])
    await release()
    const h2 = await screen.findByRole("heading", { level: 2, name: "One" })
    expect(scrolled).toContain(h2) // ... then lands on the section once it exists
  })

  it("survives a malformed percent sequence in the hash instead of blanking the docs (B-WR-04)", async () => {
    expect(safeDecode("100%")).toBe("100%")
    expect(safeDecode("%E0%A4%A")).toBe("%E0%A4%A")
    expect(safeDecode("caf%C3%A9")).toBe("café")
    window.history.replaceState(null, "", "/docs/use/chat#100%")
    render(<DocsApp />)
    expect(await screen.findByRole("heading", { level: 1, name: "Chatting with Syrel" })).toBeInTheDocument()
  })

  it("the root boundary shows a recovery message instead of a blank page (B-WR-04)", () => {
    const Boom = () => {
      throw new Error("boom")
    }
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    render(
      <DocsRootBoundary>
        <Boom />
      </DocsRootBoundary>,
    )
    spy.mockRestore()
    expect(screen.getByRole("alert").textContent).toContain("Something went wrong showing this page.")
    expect(screen.getByRole("link", { name: "Go to the docs home" }).getAttribute("href")).toBe("/docs")
  })

  it("renders the home page with the hero search box and no header search trigger", () => {
    window.history.replaceState(null, "", "/docs")
    render(<DocsApp />)
    expect(screen.getByRole("heading", { level: 1, name: /Everything Syrel does,/ })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Search the docs" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Search docs/ })).toBeNull()
    expect(document.title).toBe("Syrel Docs")
  })

  it("links the Build Story from the home page's chapter section (D-26)", () => {
    window.history.replaceState(null, "", "/docs")
    render(<DocsApp />)
    const link = screen.getByRole("link", { name: "Read Syrel: The Build Story" })
    expect(link.getAttribute("href")).toBe("/docs/changelog/build-story")
  })

  it("routes /docs/changelog/build-story to the Build Story page and titles it (D-26)", () => {
    const data = { sections: [], pages: [], changelog: [], chapters: [], loadPage: () => Promise.resolve("") }
    expect(titleFor({ kind: "build-story", sectionId: "changelog" }, data)).toBe("Syrel: The Build Story · Syrel Docs")
    window.history.replaceState(null, "", "/docs/changelog/build-story")
    render(<DocsApp />)
    expect(screen.getByRole("heading", { level: 1, name: "Syrel: The Build Story" })).toBeInTheDocument()
    expect(document.title).toBe("Syrel: The Build Story · Syrel Docs")
  })
})
