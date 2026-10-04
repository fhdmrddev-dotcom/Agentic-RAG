// Phase 276-03 (DOCS-05, D-04, G4-3) — the changelog renders the REAL generated release list
// (parseHistory over docs/history, not a fixture): newest first, v4.5 dated "—" and badged
// "Not yet released", chapters filter via ?chapter=n, and no documentary column while the
// episode slots are empty.
import { fireEvent, screen, within } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import docsContent from "../../../../scripts/lib/docs-content.cjs"
import { Changelog } from "../pages/Changelog"
import { ChangelogVersion } from "../pages/ChangelogVersion"
import type { Chapter, Release } from "../types"
import { fixtureData, renderWithDocs } from "./helpers/docsFixture"

const repoRoot = docsContent.findRepoRoot()
const changelog = docsContent.parseHistory(`${repoRoot}/docs/history`) as Release[]
const chapters = docsContent.parseChapters(`${repoRoot}/docs/history`) as Chapter[]
const data = fixtureData([], {}, { changelog, chapters })

afterEach(() => {
  window.history.replaceState(null, "", "/")
})

function releaseLinks(): HTMLAnchorElement[] {
  return screen
    .getAllByRole("link")
    .filter((a) => /^\/docs\/changelog\/v\d+\.\d+$/.test(a.getAttribute("href") ?? "")) as HTMLAnchorElement[]
}

describe("Changelog page (P5)", () => {
  it("renders the hero and every release newest first", () => {
    renderWithDocs(<Changelog />, data)
    expect(screen.getByRole("heading", { level: 1, name: "Shipped, not promised." })).toBeInTheDocument()
    expect(screen.getByText("Every release, what it changed for you, and what has not shipped yet.")).toBeInTheDocument()
    const versions = releaseLinks().map((a) => a.getAttribute("href")!.replace("/docs/changelog/", ""))
    expect(changelog.length).toBeGreaterThanOrEqual(27)
    expect(versions).toEqual(changelog.map((r) => r.version))
    expect(versions[0]).toBe("v4.5")
  })

  it("dates v4.5 '—' and badges it Not yet released; a shipped row shows its date", () => {
    renderWithDocs(<Changelog />, data)
    const v45 = releaseLinks().find((a) => a.getAttribute("href") === "/docs/changelog/v4.5")!
    expect(within(v45).getByText("—")).toBeInTheDocument()
    expect(within(v45).getByText("Not yet released")).toBeInTheDocument()
    const v44 = releaseLinks().find((a) => a.getAttribute("href") === "/docs/changelog/v4.4")!
    expect(within(v44).getAllByText("2026-09-29").length).toBeGreaterThan(0)
    expect(within(v44).queryByText("Not yet released")).toBeNull()
  })

  it("filters by chapter with aria-pressed chips mirrored to ?chapter=n", () => {
    renderWithDocs(<Changelog />, data)
    const group = screen.getByRole("group", { name: "Filter by chapter" })
    const chips = within(group).getAllByRole("button")
    expect(chips.map((c) => c.textContent)).toEqual(["All releases", ...chapters.map((c) => `${c.n}. ${c.title}`)])
    expect(within(group).getByRole("button", { name: "All releases" }).getAttribute("aria-pressed")).toBe("true")

    fireEvent.click(within(group).getByRole("button", { name: `3. ${chapters[2].title}` }))
    expect(window.location.search).toBe("?chapter=3")
    expect(within(group).getByRole("button", { name: `3. ${chapters[2].title}` }).getAttribute("aria-pressed")).toBe("true")
    const shown = releaseLinks().map((a) => a.getAttribute("href")!.replace("/docs/changelog/", ""))
    const expected = changelog.filter((r) => r.chapter.n === 3).map((r) => r.version)
    expect(expected.length).toBeGreaterThan(0)
    expect(shown).toEqual(expected)

    fireEvent.click(within(group).getByRole("button", { name: "All releases" }))
    expect(window.location.search).toBe("")
    expect(releaseLinks()).toHaveLength(changelog.length)
  })

  it("reads ?chapter=n on load", () => {
    window.history.replaceState(null, "", "/docs/changelog?chapter=5")
    renderWithDocs(<Changelog />, data)
    const shown = releaseLinks().map((a) => a.getAttribute("href")!.replace("/docs/changelog/", ""))
    expect(shown).toEqual(changelog.filter((r) => r.chapter.n === 5).map((r) => r.version))
  })

  it("renders no documentary slot while the chapter episodes have no video", () => {
    renderWithDocs(<Changelog />, data)
    expect(screen.queryByRole("button", { name: /Play video/ })).toBeNull()
    expect(document.querySelector("iframe")).toBeNull()
  })
})

describe("Changelog version page", () => {
  it("v4.4 renders its release date and what shipped", () => {
    renderWithDocs(<ChangelogVersion version="v4.4" />, data)
    expect(screen.getByRole("heading", { level: 1, name: "v4.4 — Experts That Actually Work" })).toBeInTheDocument()
    expect(screen.getByText("Released 2026-09-29")).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "What shipped" })).toBeInTheDocument()
    expect(screen.queryByText("Not yet released")).toBeNull()
  })

  it("v4.5 renders Not yet released and the exact callout", () => {
    renderWithDocs(<ChangelogVersion version="v4.5" />, data)
    expect(screen.getByText("Not yet released")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Not yet released. This is part of v4.5, which has not shipped. Nothing on this page is in Syrel today.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/^Released /)).toBeNull()
  })
})
