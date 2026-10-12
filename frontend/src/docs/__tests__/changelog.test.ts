// @vitest-environment node
//
// Phase 276-02 (DOCS-05) — the changelog model is GENERATED from docs/history/v*.md and the
// README's "arc in five chapters" table. The release count is derived with readdirSync, never
// a constant (the IA's "25 files" was already stale at 27 when this phase was planned).
import { describe, expect, it, vi } from "vitest"
import docsContent from "../../../../scripts/lib/docs-content.cjs"

const nodeFs = await vi.importActual<any>("node:fs")
const nodePath = await vi.importActual<any>("node:path")
const nodeOs = await vi.importActual<any>("node:os")

const repoRoot = docsContent.findRepoRoot()
const HISTORY = `${repoRoot}/docs/history`
const FIXTURES = `${repoRoot}/frontend/src/docs/__tests__/fixtures`

describe("parseHistory — the real docs/history", () => {
  const releases = docsContent.parseHistory(HISTORY)
  const historyFiles = docsContent.listHistoryFiles(HISTORY)

  it("returns one entry per v*.md (README excluded), newest first", () => {
    expect(historyFiles.length).toBeGreaterThanOrEqual(27)
    expect(historyFiles).not.toContain("README.md")
    expect(releases).toHaveLength(historyFiles.length)
    expect(releases[0].version).toBe("v4.5")
    expect(releases[releases.length - 1].version).toBe("v1.0")
    const order = releases.map((r) => r.version.slice(1).split(".").map(Number))
    for (let i = 1; i < order.length; i++) {
      const [a, b] = [order[i - 1], order[i]]
      expect(a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])).toBe(true)
    }
  })

  // ~~marks v4.5 unreleased with no date~~ — v4.5 shipped 2026-10-12. The unreleased arm is driven
  // below against a temp copy whose Shipped line does not start with a date.
  it("marks v4.5 released 2026-10-12, and v4.4 released with a date", () => {
    const v45 = releases.find((r) => r.version === "v4.5")!
    expect(v45.released).toBe(true)
    expect(v45.date).toBe("2026-10-12")
    expect(v45.name).toBe("Find It, Show It")
    const v44 = releases.find((r) => r.version === "v4.4")!
    expect(v44.released).toBe(true)
    expect(v44.date).toBe("2026-09-29")
    expect(v44.name).toBe("Experts That Actually Work")
  })

  it("carries only public fields: no How it works, Video beats or Sources text", () => {
    for (const r of releases) {
      const text = JSON.stringify(r)
      expect(text).not.toMatch(/How it works|Video beats|## Sources/)
      expect(text).not.toMatch(/So far on the development branch/)
      expect(r.oneLiner.length).toBeGreaterThan(10)
      expect(r.shipped.length).toBeGreaterThan(0)
      expect(r.note).toBeNull()
    }
  })

  it("assigns every release a chapter from the README table", () => {
    const chapters = docsContent.parseChapters(HISTORY)
    expect(chapters.map((c) => c.n)).toEqual([1, 2, 3, 4, 5])
    // 276-07 (D-26): the README's third column ("What changed for the user") is the chapter summary.
    expect(chapters[0]).toEqual({
      n: 1,
      title: "A document chat that can be trusted",
      range: "v1.0 – v2.4",
      summary:
        "Folders, agent exploration, skills, sandboxed code, citations and confidence, audit log, memory, tables and images",
    })
    for (const c of chapters) expect(c.summary.length, `chapter ${c.n}`).toBeGreaterThan(10)
    for (const r of releases) {
      expect(r.chapter, r.version).toBeTruthy()
    }
    expect(releases.find((r) => r.version === "v1.0")!.chapter.n).toBe(1)
    expect(releases.find((r) => r.version === "v2.5")!.chapter.n).toBe(2)
    expect(releases.find((r) => r.version === "v3.4")!.chapter.n).toBe(4)
    expect(releases.find((r) => r.version === "v4.5")!.chapter.n).toBe(5)
    // a release's chapter carries the same summary as the README row
    expect(releases.find((r) => r.version === "v1.0")!.chapter.summary).toBe(chapters[0].summary)
  })
})

describe("parseHistory — an unreleased release", () => {
  it("marks a release whose Shipped line does not start with a date unreleased, with no date", () => {
    const dir = nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "history-"))
    for (const f of nodeFs.readdirSync(HISTORY)) nodeFs.copyFileSync(`${HISTORY}/${f}`, nodePath.join(dir, f))
    const file = nodePath.join(dir, "v4.5-find-it-show-it.md")
    const before = nodeFs.readFileSync(file, "utf8")
    const after = before.replace(/^> \*\*Shipped:\*\* 2026-10-12/m, "> **Shipped:** in progress")
    expect(after).not.toBe(before)
    nodeFs.writeFileSync(file, after)
    const v45 = docsContent.parseHistory(dir).find((r: { version: string }) => r.version === "v4.5")!
    expect(v45.released).toBe(false)
    expect(v45.date).toBeNull()
    nodeFs.rmSync(dir, { recursive: true, force: true })
  })
})

describe("parseHistory — refusals", () => {
  it("throws when fewer than 20 history files parse", () => {
    expect(() => docsContent.parseHistory(`${FIXTURES}/history`)).toThrow(/fewer than 20|2 /)
  })

  it("applies overrides.json notes by version", () => {
    const releases = docsContent.parseHistory(HISTORY, `${FIXTURES}/overrides/good.json`)
    expect(releases.find((r) => r.version === "v4.4")!.note).toBe("Fixture correction: Experts only add capability.")
    expect(releases.find((r) => r.version === "v4.3")!.note).toBeNull()
  })

  it("throws on an override for a version that does not exist", () => {
    expect(() => docsContent.parseHistory(HISTORY, `${FIXTURES}/overrides/unknown-version.json`)).toThrow(/v9\.9/)
  })

  it("treats a missing overrides file as no overrides", () => {
    expect(() => docsContent.parseHistory(HISTORY, `${FIXTURES}/overrides/absent.json`)).not.toThrow()
  })
})
