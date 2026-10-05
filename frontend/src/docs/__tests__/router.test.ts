// Phase 276-02 — resolveRoute maps a /docs pathname onto the manifest. Unknown slugs and unknown
// changelog versions are not-found INSIDE the docs shell (G4-4), never a fall-through to the app.
import { afterEach, describe, expect, it, vi } from "vitest"
import { navigate, resolveRoute } from "../router"
import type { PageMeta, Release, Section } from "../types"

function page(slug: string, status: "written" | "stub"): PageMeta {
  return {
    slug,
    title: slug,
    section: slug.split("/")[0],
    audience: "user",
    status,
    release: "shipped",
    covers: ["A5"],
    unreleased: [],
    summary: null,
    nearest: status === "stub" ? "use/chat" : null,
    video: null,
    reviewed: status === "written" ? "2026-10-04" : null,
    updated: null,
    headings: [],
    readMinutes: 1,
  }
}

const sections: Section[] = [
  { id: "use", title: "Use Syrel", purpose: "p", slugs: ["use/chat", "use/chat-modes"] },
  { id: "api", title: "API reference", purpose: "p", slugs: ["api/overview"] },
  { id: "changelog", title: "Changelog", purpose: "p", slugs: [] },
]
const pages: PageMeta[] = [page("use/chat", "written"), page("use/chat-modes", "stub"), page("api/overview", "written")]
const chapter = { n: 5, title: "A product you can sell", range: "v4.3 – v4.5", summary: "Metered usage and tiers" }
const changelog: Release[] = [
  { version: "v4.5", name: "Find It, Show It", date: null, released: false, chapter, oneLiner: "x", shipped: ["y"], note: null },
  { version: "v4.4", name: "Experts", date: "2026-09-29", released: true, chapter, oneLiner: "x", shipped: ["y"], note: null },
]
const manifest = { pages, sections, changelog }

describe("resolveRoute", () => {
  it("resolves the docs home with or without a trailing slash", () => {
    expect(resolveRoute("/docs", manifest)).toEqual({ kind: "home" })
    expect(resolveRoute("/docs/", manifest)).toEqual({ kind: "home" })
  })

  it("resolves a written page as an article and a stub page as a stub", () => {
    expect(resolveRoute("/docs/use/chat", manifest)).toEqual({ kind: "article", slug: "use/chat", sectionId: "use" })
    expect(resolveRoute("/docs/use/chat/", manifest)).toEqual({ kind: "article", slug: "use/chat", sectionId: "use" })
    expect(resolveRoute("/docs/use/chat-modes", manifest)).toEqual({ kind: "stub", slug: "use/chat-modes", sectionId: "use" })
  })

  it("resolves a section id as the section index", () => {
    expect(resolveRoute("/docs/use", manifest)).toEqual({ kind: "section", sectionId: "use" })
  })

  it("resolves the changelog and a known version", () => {
    expect(resolveRoute("/docs/changelog", manifest)).toEqual({ kind: "changelog", sectionId: "changelog" })
    expect(resolveRoute("/docs/changelog/v4.5", manifest)).toEqual({
      kind: "changelog-version",
      version: "v4.5",
      sectionId: "changelog",
    })
  })

  it("resolves the Build Story page before the version lookup (D-26)", () => {
    const story = { kind: "build-story", sectionId: "changelog" }
    expect(resolveRoute("/docs/changelog/build-story", manifest)).toEqual(story)
    expect(resolveRoute("/docs/changelog/build-story/", manifest)).toEqual(story)
    expect(resolveRoute("/docs/changelog/build-story?x=1#ch-2", manifest)).toEqual(story)
    // nothing else under changelog/ is shadowed
    expect(resolveRoute("/docs/changelog/v4.4", manifest)).toEqual({ kind: "changelog-version", version: "v4.4", sectionId: "changelog" })
    expect(resolveRoute("/docs/changelog/nope", manifest)).toEqual({ kind: "not-found" })
  })

  it("resolves the API reference shell, and /docs/api to the api/overview page", () => {
    expect(resolveRoute("/docs/api/reference", manifest)).toEqual({ kind: "api-reference", sectionId: "api" })
    expect(resolveRoute("/docs/api", manifest)).toEqual({ kind: "article", slug: "api/overview", sectionId: "api" })
  })

  it("resolves unknown slugs and unknown versions as not-found", () => {
    expect(resolveRoute("/docs/nope", manifest)).toEqual({ kind: "not-found" })
    expect(resolveRoute("/docs/changelog/v9.9", manifest)).toEqual({ kind: "not-found" })
    expect(resolveRoute("/docs/use/chat/extra", manifest)).toEqual({ kind: "not-found" })
    expect(resolveRoute("/elsewhere", manifest)).toEqual({ kind: "not-found" })
  })
})

describe("navigate", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/")
  })

  it("pushes the new URL and dispatches popstate so the app re-resolves", () => {
    const seen = vi.fn()
    window.addEventListener("popstate", seen)
    navigate("/docs/use/chat")
    window.removeEventListener("popstate", seen)
    expect(window.location.pathname).toBe("/docs/use/chat")
    expect(seen).toHaveBeenCalledTimes(1)
  })
})
