// Phase 276-03 (D-08) — search over the BUILD-TIME index: nothing is fetched until the first focus,
// then exactly one fetch; the combobox follows WAI-ARIA 1.2; empty / error states use the exact copy.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import MiniSearch from "minisearch"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { SearchBox } from "../components/SearchBox"
import { resetSearchIndexCache } from "../search/searchIndex"
import { SEARCH_INDEX_URL, SEARCH_OPTIONS, type SearchDoc } from "../search/searchOptions"

function doc(over: Partial<SearchDoc> & { id: string; title: string; url: string }): SearchDoc {
  return {
    headings: "",
    summary: "",
    body: "",
    slug: over.url.replace("/docs/", ""),
    section: "Use Syrel",
    status: "written",
    release: "shipped",
    ...over,
  }
}

const DOCS: SearchDoc[] = [
  doc({ id: "page:use/chat", title: "Chatting with Syrel", url: "/docs/use/chat", summary: "Ask a question in chat." }),
  doc({
    id: "page:use/chat-modes",
    title: "Deep mode and Workflow mode",
    url: "/docs/use/chat-modes",
    summary: "Two chat modes.",
    body: "chat modes",
    status: "stub",
  }),
  doc({
    id: "page:use/library/find",
    title: "Finding a document",
    url: "/docs/use/library/find",
    summary: "Find from chat.",
    release: "v4.5",
  }),
]

function indexJson(): string {
  const ms = new MiniSearch(SEARCH_OPTIONS)
  ms.addAll(DOCS)
  return JSON.stringify(ms)
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  resetSearchIndexCache()
  fetchMock = vi.fn(() => Promise.resolve(new Response(indexJson(), { status: 200 })))
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  window.history.replaceState(null, "", "/")
})

const input = () => screen.getByRole("combobox")

async function type(text: string) {
  fireEvent.change(input(), { target: { value: text } })
}

describe("SearchBox", () => {
  it("fetches nothing before focus, then exactly one fetch of the index on first focus", async () => {
    render(<SearchBox />)
    expect(screen.getByPlaceholderText("Search guides, features, errors…")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.focus(input())
    fireEvent.blur(input())
    fireEvent.focus(input())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toBe(SEARCH_INDEX_URL)
    expect(SEARCH_INDEX_URL).toBe("/docs-assets/search-index.json")
  })

  it("renders nothing for one character, and up to 8 options for 'chat' with the stub badged", async () => {
    render(<SearchBox />)
    fireEvent.focus(input())
    await type("c")
    await act(() => new Promise((r) => setTimeout(r, 200)))
    expect(screen.queryAllByRole("option")).toHaveLength(0)

    await type("chat")
    const options = await screen.findAllByRole("option")
    expect(options.length).toBeGreaterThan(0)
    expect(options.length).toBeLessThanOrEqual(8)
    expect(input().getAttribute("aria-expanded")).toBe("true")
    const stubRow = options.find((o) => o.textContent?.includes("Deep mode and Workflow mode")) as HTMLElement
    expect(within(stubRow).getByText("Full guide coming")).toBeInTheDocument()
    const v45Row = options.find((o) => o.textContent?.includes("Finding a document")) as HTMLElement
    expect(within(v45Row).getByText("Not yet released")).toBeInTheDocument()
    expect(screen.getByText(`${options.length} results`)).toBeInTheDocument()
  })

  it("shows the exact no-results copy", async () => {
    render(<SearchBox />)
    fireEvent.focus(input())
    await type("zzzz")
    expect(await screen.findByText('No pages match "zzzz"')).toBeInTheDocument()
    expect(screen.getByText("Try a feature name, like workflows, connections or Experts.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Browse every section" })).toBeInTheDocument()
    expect(screen.getByText("No results")).toBeInTheDocument()
  })

  it("shows the exact error copy as an alert when the index cannot load", async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error("offline")))
    render(<SearchBox />)
    fireEvent.focus(input())
    await type("chat")
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toBe("Search couldn't load. Refresh the page, or browse the sections below.")
  })

  it("ArrowDown + Enter navigates to the highlighted result", async () => {
    render(<SearchBox />)
    fireEvent.focus(input())
    await type("chat")
    const options = await screen.findAllByRole("option")
    fireEvent.keyDown(input(), { key: "ArrowDown" })
    expect(input().getAttribute("aria-activedescendant")).toBe(options[0].id)
    expect(options[0].getAttribute("aria-selected")).toBe("true")
    const target = options[0].getAttribute("data-url")
    fireEvent.keyDown(input(), { key: "Enter" })
    expect(window.location.pathname).toBe(target)
  })
})
