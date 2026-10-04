// Phase 276 — the docs entry's content model, as the browser sees it (virtual:docs-manifest).
// The Node side (scripts/lib/docs-content.cjs) produces these shapes; the frontmatter contract
// that feeds them is docs/public/README.md. Keep the three in step.

export type Audience = "user" | "admin" | "operator" | "developer"
export type PageStatus = "written" | "stub"
export type PageRelease = "shipped" | "v4.5"

export interface Heading {
  id: string
  text: string
}

export interface PageMeta {
  slug: string
  title: string
  section: string
  audience: Audience
  status: PageStatus
  release: PageRelease
  covers: string[]
  unreleased: string[]
  summary: string | null
  nearest: string | null
  video: string | null
  reviewed: string | null
  updated: string | null
  headings: Heading[]
  readMinutes: number
}

export interface SectionGroup {
  title: string
  slugs: string[]
}

export interface Section {
  id: string
  title: string
  purpose: string
  groups?: SectionGroup[]
  slugs: string[]
}

export interface Chapter {
  n: number
  title: string
  range: string
}

export interface Release {
  version: string
  name: string
  date: string | null
  released: boolean
  chapter: Chapter
  oneLiner: string
  shipped: string[]
  note: string | null
}

export type RouteKind =
  | "home"
  | "article"
  | "stub"
  | "section"
  | "changelog"
  | "changelog-version"
  | "api-reference"
  | "not-found"

export interface Route {
  kind: RouteKind
  slug?: string
  version?: string
  sectionId?: string
}

/** What resolveRoute needs from the manifest. */
export interface RouteManifest {
  pages: PageMeta[]
  sections: Section[]
  changelog: Release[]
}
