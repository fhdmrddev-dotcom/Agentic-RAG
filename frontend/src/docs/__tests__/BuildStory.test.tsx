// Phase 276-07 (D-26) — "Syrel: The Build Story". The page renders the REAL generated chapters and
// releases (parseChapters / parseHistory over docs/history, never a fixture), in ascending chapter
// order, each with its summary, range, releases oldest first and its changelog.chapter-N VideoSlot.
//
// Honesty (plan-check blocker, D-12): while every changelog.chapter-N slot has youtubeId null the
// page renders no video frame and NO copy that says a documentary exists — the rendered text must
// not contain "documentar" (case-insensitive). A slot with an id renders a click-to-load poster for
// that one chapter, and nothing is fetched before the click.
import { fireEvent, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import docsContent from "../../../../scripts/lib/docs-content.cjs"
import { BuildStory } from "../pages/BuildStory"
import type { Chapter, Release } from "../types"
import { VIDEOS } from "../video/videos"
import { fixtureData, renderWithDocs } from "./helpers/docsFixture"

// A fresh copy of the registry, so one case can give chapter 1 an id and afterEach can put it back.
vi.mock("../video/videos", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../video/videos")>()
  return { ...actual, VIDEOS: { ...actual.VIDEOS } }
})

const repoRoot = docsContent.findRepoRoot()
const changelog = docsContent.parseHistory(`${repoRoot}/docs/history`) as Release[]
const chapters = docsContent.parseChapters(`${repoRoot}/docs/history`) as Chapter[]
const data = fixtureData([], {}, { changelog, chapters })

const ORIGINAL_CH1 = VIDEOS["changelog.chapter-1"]

afterEach(() => {
  VIDEOS["changelog.chapter-1"] = ORIGINAL_CH1
  vi.restoreAllMocks()
})

function chapterSections(): HTMLElement[] {
  return screen.getAllByRole("region").filter((el) => /^Chapter \d+: /.test(el.getAttribute("aria-label") ?? ""))
}

describe("Build Story page (D-26)", () => {
  it("renders the hero with neutral copy", () => {
    renderWithDocs(<BuildStory />, data)
    expect(screen.getByRole("heading", { level: 1, name: "Syrel: The Build Story" })).toBeInTheDocument()
    expect(screen.getByText("The five chapters of how Syrel was built, release by release.")).toBeInTheDocument()
  })

  it("lists the five chapters in ascending order, each with its title, summary and range", () => {
    renderWithDocs(<BuildStory />, data)
    const sections = chapterSections()
    expect(chapters).toHaveLength(5)
    expect(sections.map((s) => s.getAttribute("aria-label"))).toEqual(chapters.map((c) => `Chapter ${c.n}: ${c.title}`))
    sections.forEach((s, i) => {
      const c = chapters[i]
      expect(within(s).getByText(`Chapter ${c.n}`)).toBeInTheDocument()
      expect(within(s).getByText(c.summary)).toBeInTheDocument()
      expect(within(s).getByText(c.range)).toBeInTheDocument()
    })
  })

  it("lists exactly each chapter's releases, oldest first, each linking its changelog page", () => {
    renderWithDocs(<BuildStory />, data)
    const sections = chapterSections()
    let total = 0
    sections.forEach((s, i) => {
      const n = chapters[i].n
      const expected = changelog.filter((r) => r.chapter.n === n).map((r) => r.version).reverse()
      expect(expected.length, `chapter ${n}`).toBeGreaterThan(0)
      const shown = within(s)
        .getAllByRole("link")
        .map((a) => a.getAttribute("href")!)
        .filter((h) => /^\/docs\/changelog\/v\d+\.\d+$/.test(h))
        .map((h) => h.replace("/docs/changelog/", ""))
      expect(shown).toEqual(expected)
      total += shown.length
    })
    expect(total).toBe(changelog.length)
  })

  it("badges v4.5 Not yet released and no shipped release", () => {
    renderWithDocs(<BuildStory />, data)
    const v45 = screen.getAllByRole("link").find((a) => a.getAttribute("href") === "/docs/changelog/v4.5")!
    expect(within(v45).getByText("Not yet released")).toBeInTheDocument()
    const v44 = screen.getAllByRole("link").find((a) => a.getAttribute("href") === "/docs/changelog/v4.4")!
    expect(within(v44).queryByText("Not yet released")).toBeNull()
  })

  it("links each chapter to its filtered changelog view", () => {
    renderWithDocs(<BuildStory />, data)
    chapterSections().forEach((s, i) => {
      const link = within(s).getByRole("link", { name: "See these releases in the changelog" })
      expect(link.getAttribute("href")).toBe(`/docs/changelog?chapter=${chapters[i].n}`)
    })
  })

  it("while every chapter slot is empty: no frame, no poster, no youtube URL, and no documentary copy", () => {
    for (let n = 1; n <= 5; n++) expect(VIDEOS[`changelog.chapter-${n}`]).toMatchObject({ kind: "youtube", youtubeId: null })
    const { container } = renderWithDocs(<BuildStory />, data)
    expect(container.querySelector("iframe")).toBeNull()
    expect(screen.queryByRole("button", { name: /Play video/ })).toBeNull()
    expect(container.innerHTML).not.toMatch(/youtube/i)
    expect(container.textContent ?? "").not.toMatch(/documentar/i)
    expect(container.textContent ?? "").not.toMatch(/\bwatch\b/i)
  })

  it("renders one click-to-load poster once a chapter has an id, and fetches nothing before the click", () => {
    VIDEOS["changelog.chapter-1"] = {
      kind: "youtube",
      youtubeId: "abc123XYZ_-",
      poster: null,
      title: "Chapter 1: A document chat that can be trusted",
      durationSec: 600,
      aspect: "16:9",
    }
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const { container } = renderWithDocs(<BuildStory />, data)
    const buttons = screen.getAllByRole("button", { name: /^Play video/ })
    expect(buttons).toHaveLength(1)
    expect(within(chapterSections()[0]).getByRole("button", { name: /^Play video/ })).toBe(buttons[0])
    expect(container.querySelector("iframe")).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()

    fireEvent.click(buttons[0])
    const frame = container.querySelector("iframe")!
    expect(frame.getAttribute("src")).toContain("https://www.youtube-nocookie.com/embed/abc123XYZ_-")
    expect(frame.getAttribute("src")).toContain("autoplay=1") // only after the reader pressed play
  })
})
