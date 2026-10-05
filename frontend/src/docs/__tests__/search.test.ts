// @vitest-environment node
//
// Phase 276-02 (D-08) — the build-time MiniSearch index. The plugin serialises with toJSON and
// the browser loads with loadJSON; MiniSearch requires the SAME options on both sides, so both
// import SEARCH_OPTIONS from one module. This suite proves the round trip with that module.
import MiniSearch from "minisearch"
import { describe, expect, it } from "vitest"
import docsContent from "../../../../scripts/lib/docs-content.cjs"
import { SEARCH_OPTIONS } from "../search/searchOptions"

const repoRoot = docsContent.findRepoRoot()
const FIXTURE_PUBLIC = `${repoRoot}/frontend/src/docs/__tests__/fixtures/public`

function buildIndex() {
  const { pages } = docsContent.loadAllPages(FIXTURE_PUBLIC)
  const sections = docsContent.readSections(`${FIXTURE_PUBLIC}/sections.json`)
  const changelog = docsContent.parseHistory(`${repoRoot}/docs/history`)
  const docs = docsContent.buildSearchDocs(pages, changelog, sections)
  const ms = new MiniSearch(SEARCH_OPTIONS)
  ms.addAll(docs)
  return { ms, docs, pages, changelog, sections }
}

describe("search index (D-08)", () => {
  it("covers every page (written and stub), every section and every changelog version", () => {
    const { docs, pages, changelog, sections } = buildIndex()
    const ids = new Set(docs.map((d) => d.id))
    for (const p of pages) expect(ids.has(`page:${p.slug}`), p.slug).toBe(true)
    for (const r of changelog) expect(ids.has(`changelog:${r.version}`), r.version).toBe(true)
    for (const s of sections) expect(ids.has(`section:${s.id}`), s.id).toBe(true)
    // + 1: the Build Story page (276-07, D-26)
    expect(docs).toHaveLength(pages.length + changelog.length + sections.length + 1)
  })

  it("indexes the Build Story page exactly once (D-26)", () => {
    const { docs, ms } = buildIndex()
    const story = docs.filter((d) => d.id === "story:build-story")
    expect(story).toHaveLength(1)
    expect(story[0].url).toBe("/docs/changelog/build-story")
    expect(story[0].title).toBe("Syrel: The Build Story")
    expect(story[0].body).toContain("A document chat that can be trusted")
    const loaded = MiniSearch.loadJSON(JSON.stringify(ms), SEARCH_OPTIONS)
    expect(loaded.search("build story").map((h) => h.id)).toContain("story:build-story")
  })

  it("truncates indexed body text to about 2 KB", () => {
    const { docs } = buildIndex()
    for (const d of docs) expect(d.body.length).toBeLessThanOrEqual(2048)
  })

  it("round-trips toJSON → loadJSON with the shared options", () => {
    const { ms } = buildIndex()
    const json = JSON.stringify(ms)
    const loaded = MiniSearch.loadJSON(json, SEARCH_OPTIONS)
    expect(loaded.documentCount).toBe(ms.documentCount)
    expect(loaded.search("composer").map((r) => r.id)).toEqual(ms.search("composer").map((r) => r.id))
  })

  it("finds the stub page by a word in its title or summary", () => {
    const { ms } = buildIndex()
    const loaded = MiniSearch.loadJSON(JSON.stringify(ms), SEARCH_OPTIONS)
    const hits = loaded.search("modes")
    expect(hits.map((h) => h.slug)).toContain("use/chat-modes")
    const stub = hits.find((h) => h.slug === "use/chat-modes")!
    expect(stub.status).toBe("stub")
    expect(stub.url).toBe("/docs/use/chat-modes")
  })

  it("finds the v4.5 changelog entry, marked unreleased", () => {
    const { ms } = buildIndex()
    const loaded = MiniSearch.loadJSON(JSON.stringify(ms), SEARCH_OPTIONS)
    const hits = loaded.search("v4.5")
    expect(hits[0].id).toBe("changelog:v4.5")
    expect(hits[0].url).toBe("/docs/changelog/v4.5")
    expect(hits[0].release).toBe("v4.5")
  })
})
