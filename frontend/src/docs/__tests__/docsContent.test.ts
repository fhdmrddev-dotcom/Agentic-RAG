// @vitest-environment node
//
// Phase 276-02 — scripts/lib/docs-content.cjs, the ONE home of the docs frontmatter parser and the
// code-key extractors (the Vite plugin and 276-05's coverage gate both consume it).
// Every directory is a PARAMETER, so the same code is pointed at fixtures here and at the real
// tree in production — never a second implementation.
import { describe, expect, it } from "vitest"
import docsContent from "../../../../scripts/lib/docs-content.cjs"

const repoRoot = docsContent.findRepoRoot()
const FIXTURES = `${repoRoot}/frontend/src/docs/__tests__/fixtures`
const FIXTURE_PUBLIC = `${FIXTURES}/public`

const GOOD_WRITTEN = `---
title: A page
slug: use/a-page
section: use
audience: user
status: written
release: shipped
covers: [A5]
reviewed: 2026-10-04
---

Body.
`

function findingsFor(text: string, relPath = "use/a-page.md") {
  return docsContent.parsePage(text, relPath).findings.map(docsContent.formatFinding)
}

describe("parsePage — the frontmatter contract", () => {
  it("parses the three fixtures into typed metadata", () => {
    const { pages, findings } = docsContent.loadAllPages(FIXTURE_PUBLIC)
    expect(findings).toEqual([])
    const bySlug = Object.fromEntries(pages.map((p) => [p.slug, p]))
    expect(Object.keys(bySlug).sort()).toEqual(["get-started/quickstart", "use/chat", "use/chat-modes"])

    const chat = bySlug["use/chat"]
    expect(chat.title).toBe("Chatting with Syrel")
    expect(chat.section).toBe("use")
    expect(chat.audience).toBe("user")
    expect(chat.status).toBe("written")
    expect(chat.release).toBe("shipped")
    expect(chat.covers).toEqual(["A5", "A9", "nav:chat", "tool:search_documents"])
    expect(chat.video).toBe("clip.chat")
    expect(chat.reviewed).toBe("2026-10-04")
    expect(chat.summary).toBe("Ask a question, watch the agent work, and read the cited answer.")
    expect(chat.headings).toEqual([
      { id: "the-composer", text: "The composer" },
      { id: "stopping-a-run", text: "Stopping a run" },
    ])
    expect(chat.readMinutes).toBeGreaterThanOrEqual(1)
    expect(chat.body).toContain("## The composer")
    expect(chat.body).not.toContain("title:")

    const stub = bySlug["use/chat-modes"]
    expect(stub.status).toBe("stub")
    expect(stub.nearest).toBe("use/chat")
    expect(stub.summary).toBe(
      "Syrel has two chat modes. Deep mode lets the agent improvise across tools, and Workflow mode follows a published workflow step by step.",
    )
    expect(bySlug["get-started/quickstart"].updated).toBe("v4.4")
  })

  it("accepts a minimal written page with no findings", () => {
    expect(findingsFor(GOOD_WRITTEN)).toEqual([])
  })

  it("flags a slug that does not match the file path", () => {
    expect(findingsFor(GOOD_WRITTEN, "use/other.md")).toEqual([
      expect.stringMatching(/^\[bad-frontmatter\] use\/other\.md: slug/),
    ])
  })

  it("flags an unknown key, naming it", () => {
    const text = GOOD_WRITTEN.replace("reviewed:", "author: me\nreviewed:")
    expect(findingsFor(text)).toEqual([expect.stringMatching(/^\[bad-frontmatter\] use\/a-page\.md: author/)])
  })

  it("flags a bad enum value, naming the key", () => {
    expect(findingsFor(GOOD_WRITTEN.replace("audience: user", "audience: everyone"))).toEqual([
      expect.stringMatching(/^\[bad-frontmatter\] use\/a-page\.md: audience/),
    ])
    expect(findingsFor(GOOD_WRITTEN.replace("status: written", "status: draft"))).toEqual(
      expect.arrayContaining([expect.stringMatching(/: status/)]),
    )
    expect(findingsFor(GOOD_WRITTEN.replace("release: shipped", "release: v4.6"))).toEqual([
      expect.stringMatching(/: release/),
    ])
  })

  it("flags a stub without summary or nearest", () => {
    const stub = GOOD_WRITTEN.replace("status: written", "status: stub").replace("reviewed: 2026-10-04\n", "")
    const f = findingsFor(stub)
    expect(f).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^\[bad-frontmatter\] use\/a-page\.md: summary/),
        expect.stringMatching(/^\[bad-frontmatter\] use\/a-page\.md: nearest/),
      ]),
    )
  })

  it("flags a written page without reviewed", () => {
    expect(findingsFor(GOOD_WRITTEN.replace("reviewed: 2026-10-04\n", ""))).toEqual([
      expect.stringMatching(/^\[bad-frontmatter\] use\/a-page\.md: reviewed/),
    ])
  })

  it("flags YAML forms outside the subset instead of guessing", () => {
    const nested = GOOD_WRITTEN.replace("covers: [A5]", "covers:\n  - A5")
    expect(findingsFor(nested).length).toBeGreaterThan(0)
    expect(findingsFor(nested).every((s) => s.startsWith("[bad-frontmatter]"))).toBe(true)
  })

  it("flags a missing frontmatter block", () => {
    expect(findingsFor("# Just a heading\n")).toEqual([expect.stringMatching(/^\[bad-frontmatter\] use\/a-page\.md: frontmatter/)])
  })
})

describe("validatePages — cross-page rules", () => {
  it("flags nearest pointing at a stub, and reports unlisted/missing pages", () => {
    const { pages } = docsContent.loadAllPages(FIXTURE_PUBLIC)
    const sections = docsContent.readSections(`${FIXTURE_PUBLIC}/sections.json`)
    // The fixture sections list api/overview with no file behind it.
    expect(docsContent.validatePages(pages, sections).map(docsContent.formatFinding)).toEqual([
      expect.stringMatching(/^\[missing-page\] api\/overview/),
    ])

    const extra = docsContent.parsePage(
      GOOD_WRITTEN.replace("status: written", "status: stub")
        .replace("reviewed: 2026-10-04\n", "summary: >-\n  A stub.\nnearest: use/chat-modes\n"),
      "use/a-page.md",
    ).page
    expect(extra).not.toBeNull()
    const f = docsContent.validatePages([...pages, extra!], sections).map(docsContent.formatFinding)
    expect(f).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^\[bad-frontmatter\] use\/a-page\.md: nearest/),
        expect.stringMatching(/^\[unlisted-page\] use\/a-page/),
      ]),
    )
  })
})

describe("loadAllPages — parameterised, counted, read-only", () => {
  it("counts every skipped file and never treats non-pages as pages", () => {
    const res = docsContent.loadAllPages(FIXTURE_PUBLIC)
    expect(res.root).toBe(FIXTURE_PUBLIC)
    expect(res.pages).toHaveLength(3)
    // sections.json is skipped AND counted — an uncounted skip is how a gate reads "0 files · OK".
    expect(res.skipped).toEqual({ "not-markdown": 1 })
    expect(res.scanned).toBe(4)
  })

  it("reports a missing root instead of returning an empty success", () => {
    const res = docsContent.loadAllPages(`${FIXTURES}/does-not-exist`)
    expect(res.pages).toEqual([])
    expect(res.readError).toBeTruthy()
  })
})

describe("extractCodeKeys — the code-key scan set", () => {
  it("meets every floor on the real repository", () => {
    const keys = docsContent.extractCodeKeys(repoRoot)
    expect(keys.nav.length).toBeGreaterThanOrEqual(5)
    expect(keys.view.length).toBeGreaterThanOrEqual(8)
    expect(keys.tool.length).toBeGreaterThanOrEqual(25)
    expect(keys.step.length).toBeGreaterThanOrEqual(7)
    expect(keys.check.length).toBeGreaterThanOrEqual(8)
    expect(keys.router.length).toBeGreaterThanOrEqual(30)
    expect(keys.settingsTab.length).toBeGreaterThanOrEqual(3)
    expect(keys.nav).toContain("chat")
    expect(keys.tool).toContain("search_documents")
    expect(keys.router).toContain("threads")
    expect(keys.settingsTab).toContain("search")
  })

  it("throws naming tool_dispatcher.py when the _TOOL_REGISTRY block is emptied", () => {
    const realRead = (rel: string) => docsContent.readRepoFile(repoRoot, rel)
    const readFile = (rel: string) => {
      const text = realRead(rel)
      if (!rel.endsWith("tool_dispatcher.py")) return text
      return text.replace(/(_TOOL_REGISTRY:\s*dict\[str,\s*Callable\]\s*=\s*\{)[\s\S]*?\n\}/, "$1\n}")
    }
    expect(() => docsContent.extractCodeKeys(repoRoot, { readFile })).toThrow(/tool_dispatcher\.py/)
  })
})
