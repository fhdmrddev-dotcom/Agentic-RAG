// Phase 276 — module declarations for the virtual modules frontend/plugins/docsContent.ts serves.

declare module "virtual:docs-manifest" {
  import type { Chapter, PageMeta, Release, Section } from "@/docs/types"

  /** The 11 IA sections, in IA order (docs/public/sections.json). */
  export const sections: Section[]
  /** Metadata for every page (written and stub); bodies load lazily via loadPage. */
  export const pages: PageMeta[]
  /** Every docs/history release, newest first. */
  export const changelog: Release[]
  /** The five chapters from docs/history/README.md. */
  export const chapters: Chapter[]
  /** The Markdown body of one page, as its own lazy chunk. Rejects for an unknown slug. */
  export function loadPage(slug: string): Promise<string>
}

declare module "virtual:docs-page/*" {
  const body: string
  export default body
}
