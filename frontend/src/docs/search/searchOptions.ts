// Phase 276 (D-08) — the ONE definition of the docs search index options.
//
// MiniSearch requires loadJSON to be given the SAME options that were used to build the index
// it is loading, so the build side (frontend/plugins/docsContent.ts → toJSON) and the browser side
// (276-03's SearchBox → loadJSON) both import this constant. A second copy would drift silently
// and break search with no error.
import type { Options } from "minisearch"

/** One indexed document: a page (written or stub), a section index, or a changelog version. */
export interface SearchDoc {
  id: string
  title: string
  headings: string
  summary: string
  body: string
  slug: string
  section: string
  status: string
  release: string
  url: string
}

export const SEARCH_OPTIONS: Options<SearchDoc> = {
  fields: ["title", "headings", "summary", "body"],
  storeFields: ["title", "slug", "section", "status", "release", "summary", "url"],
  searchOptions: {
    boost: { title: 3, headings: 2 },
    prefix: true,
    fuzzy: 0.2,
  },
}

/** Where the built index is served from (never under /docs/ — see vercel.json). */
export const SEARCH_INDEX_URL = "/docs-assets/search-index.json"
