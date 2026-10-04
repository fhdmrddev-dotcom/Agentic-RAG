// Phase 276-03 — the manifest as a React context. DocsApp feeds it from virtual:docs-manifest;
// every page and component reads it through useDocs(), so components never import the virtual
// module themselves and tests render them with plain fixture data.
import { createContext, useContext, type ReactNode } from "react"
import type { Chapter, PageMeta, Release, Section } from "./types"

export interface DocsData {
  sections: Section[]
  pages: PageMeta[]
  changelog: Release[]
  chapters: Chapter[]
  loadPage(slug: string): Promise<string>
}

const DocsDataContext = createContext<DocsData | null>(null)

export function DocsDataProvider({ value, children }: { value: DocsData; children: ReactNode }) {
  return <DocsDataContext.Provider value={value}>{children}</DocsDataContext.Provider>
}

export function useDocs(): DocsData {
  const v = useContext(DocsDataContext)
  if (!v) throw new Error("useDocs() needs a <DocsDataProvider>")
  return v
}

/** The page's own section, or null. */
export function sectionOf(data: DocsData, id: string | undefined): Section | null {
  return (id && data.sections.find((s) => s.id === id)) || null
}

export function pageBySlug(data: DocsData, slug: string | null | undefined): PageMeta | null {
  return (slug && data.pages.find((p) => p.slug === slug)) || null
}

/** Pages of a section in IA order (sections.json), skipping slugs with no file yet. */
export function sectionPages(data: DocsData, sectionId: string): PageMeta[] {
  const s = sectionOf(data, sectionId)
  if (!s) return []
  return s.slugs.map((slug) => pageBySlug(data, slug)).filter((p): p is PageMeta => p !== null)
}

export const docsUrl = (slug: string) => `/docs/${slug}`
