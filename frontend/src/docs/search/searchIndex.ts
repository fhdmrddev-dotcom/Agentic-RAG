// Phase 276-03 (D-08) — loads the build-time search index ONCE, on the first focus of any search
// input. Both MiniSearch and the index JSON stay out of the first-paint payload: the library is a
// dynamic import and the index is a static file. A failed load is forgotten so a retry can work.
import type MiniSearch from "minisearch"
import { SEARCH_INDEX_URL, SEARCH_OPTIONS, type SearchDoc } from "./searchOptions"

export type DocsIndex = MiniSearch<SearchDoc>

let pending: Promise<DocsIndex> | null = null

export function loadSearchIndex(): Promise<DocsIndex> {
  if (!pending) {
    pending = (async () => {
      const res = await fetch(SEARCH_INDEX_URL)
      if (!res.ok) throw new Error(`search index: HTTP ${res.status}`)
      const json = await res.text()
      const { default: MiniSearchCtor } = await import("minisearch")
      return MiniSearchCtor.loadJSON<SearchDoc>(json, SEARCH_OPTIONS)
    })()
    pending.catch(() => {
      pending = null
    })
  }
  return pending
}

/** Test seam: forget the cached index between cases. */
export function resetSearchIndexCache(): void {
  pending = null
}

export interface SearchHit {
  id: string
  title: string
  section: string
  summary: string
  status: string
  release: string
  url: string
}

export const MAX_RESULTS = 8

export function runSearch(index: DocsIndex, query: string): SearchHit[] {
  return index
    .search(query)
    .slice(0, MAX_RESULTS)
    .map((r) => ({
      id: String(r.id),
      title: String(r.title ?? ""),
      section: String(r.section ?? ""),
      summary: String(r.summary ?? ""),
      status: String(r.status ?? ""),
      release: String(r.release ?? "shipped"),
      url: String(r.url ?? "/docs"),
    }))
}
