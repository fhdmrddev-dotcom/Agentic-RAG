// Phase 276-03 — shared test fixtures for the docs component suites. Not a test file itself.
// Components read the manifest through DocsDataProvider (DocsApp feeds it from
// virtual:docs-manifest), so a suite renders with plain fixture data and never needs the plugin.
import type { ReactElement } from "react"
import { render } from "@testing-library/react"
import { DocsDataProvider, type DocsData } from "../../docsData"
import type { PageMeta, Section } from "../../types"

export function makePage(over: Partial<PageMeta> & { slug: string }): PageMeta {
  const written = (over.status ?? "written") === "written"
  return {
    title: over.slug,
    section: over.slug.split("/")[0],
    audience: "user",
    status: "written",
    release: "shipped",
    covers: ["A5"],
    unreleased: [],
    summary: null,
    nearest: null,
    video: null,
    reviewed: written ? "2026-10-04" : null,
    updated: null,
    headings: [],
    readMinutes: 3,
    ...over,
  }
}

export const SECTIONS: Section[] = [
  { id: "get-started", title: "Get started", purpose: "Your first answer.", slugs: ["get-started/quickstart"] },
  {
    id: "use",
    title: "Use Syrel",
    purpose: "Chat, the Library and the workspace.",
    groups: [
      { title: "Using Syrel", slugs: ["use/chat", "use/chat-modes"] },
      { title: "Library", slugs: ["use/library/find"] },
    ],
    slugs: ["use/chat", "use/chat-modes", "use/library/find"],
  },
  {
    id: "connect",
    title: "Connect",
    purpose: "Bring your tools in.",
    slugs: ["connect/overview", "connect/connections", "connect/drive"],
  },
  { id: "changelog", title: "Changelog", purpose: "Every release.", slugs: [] },
]

export function fixtureData(pages: PageMeta[], bodies: Record<string, string> = {}, extra: Partial<DocsData> = {}): DocsData {
  return {
    sections: SECTIONS,
    pages,
    changelog: [],
    chapters: [],
    loadPage: (slug: string) =>
      slug in bodies ? Promise.resolve(bodies[slug]) : Promise.reject(new Error("Unknown docs page: " + slug)),
    ...extra,
  }
}

export function renderWithDocs(ui: ReactElement, data: DocsData) {
  return render(<DocsDataProvider value={data}>{ui}</DocsDataProvider>)
}
