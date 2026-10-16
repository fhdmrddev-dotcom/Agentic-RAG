/**
 * Phase 284-03 Task 3 (FIX-11 / D-17 / UI-SPEC S9) — the Chunks section pages by scrolling.
 *
 * A 2,500-chunk document reads 2,500 in its header (the server's exact total, not the 1,000-row
 * cap), shows its first 200, and loads the next 200 when the end of the bounded region scrolls
 * into view. ⛔ There is NO "Show all" and NO "Load more" button (the Phase 283 rule), the region
 * stays ONE Tab stop, and it carries no overscroll containment.
 *
 * ⛔ `IntersectionObserver` is stubbed FILE-LOCALLY and its callback is fired by hand — never in
 * `setupTests.ts` (the `mockReactFlow.ts` rule: a global stub would reach every suite).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, render, screen, within } from "@testing-library/react"
import type { DocumentChunkPage, DocumentChunkRow } from "@/types"

const listDocumentChunksPage = vi.fn<(id: string, page?: { offset?: number; limit?: number }) => Promise<DocumentChunkPage>>()
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    listDocumentChunksPage: (...a: unknown[]) => listDocumentChunksPage(...(a as [string])),
  }
})

import { DocumentChunksSection } from "../DocumentChunksSection"

// ── the file-local IntersectionObserver stub ────────────────────────────────────────────────
interface FakeObserver {
  callback: IntersectionObserverCallback
  options: IntersectionObserverInit | undefined
  targets: Element[]
  disconnect: ReturnType<typeof vi.fn>
}
let observers: FakeObserver[] = []
class StubIntersectionObserver {
  readonly record: FakeObserver
  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.record = { callback, options, targets: [], disconnect: vi.fn() }
    observers.push(this.record)
  }
  observe(el: Element) {
    this.record.targets.push(el)
  }
  unobserve() {}
  disconnect() {
    this.record.disconnect()
  }
  takeRecords() {
    return []
  }
}
const originalIO = globalThis.IntersectionObserver

/** The observer watching the sentinel right now (the newest live one). */
function liveObserver(): FakeObserver {
  const live = observers.filter((o) => o.targets.length > 0 && o.disconnect.mock.calls.length === 0)
  const last = live.at(-1)
  if (!last) throw new Error("no live IntersectionObserver is watching a sentinel")
  return last
}

/** Scroll the sentinel into view — fire the observer by hand. */
async function scrollToEnd() {
  const o = liveObserver()
  await act(async () => {
    o.callback(
      o.targets.map((target) => ({ isIntersecting: true, target }) as IntersectionObserverEntry),
      {} as IntersectionObserver,
    )
  })
}

function chunk(i: number): DocumentChunkRow {
  return {
    id: `c${i}`,
    chunk_index: i,
    content: `chunk body ${i}`,
    embedding_model: "text-embedding-3-small",
    embedding_dimensions: 1536,
  } as DocumentChunkRow
}

const TOTAL = 2500
function pageOf(offset: number, limit: number): DocumentChunkPage {
  const end = Math.min(offset + limit, TOTAL)
  return {
    chunks: Array.from({ length: end - offset }, (_, k) => chunk(offset + k)),
    total: TOTAL,
    offset,
    limit,
  }
}

beforeEach(() => {
  observers = []
  ;(globalThis as { IntersectionObserver: unknown }).IntersectionObserver = StubIntersectionObserver
  listDocumentChunksPage.mockImplementation(async (_id, page) => pageOf(page?.offset ?? 0, page?.limit ?? 200))
})

afterEach(() => {
  ;(globalThis as { IntersectionObserver: unknown }).IntersectionObserver = originalIO
  vi.clearAllMocks()
})

describe("DocumentChunksSection — paged by scrolling (S9)", () => {
  it("asks for the first 200, and lifts the server's EXACT total to the header", async () => {
    const onTotalChange = vi.fn()
    render(<DocumentChunksSection docId="doc-big" onTotalChange={onTotalChange} />)
    const region = await screen.findByRole("region", { name: "Chunk list, 2,500 chunks, 200 loaded" })
    expect(listDocumentChunksPage).toHaveBeenCalledTimes(1)
    expect(listDocumentChunksPage).toHaveBeenCalledWith("doc-big", { offset: 0, limit: 200 })
    expect(onTotalChange).toHaveBeenLastCalledWith(2500)
    expect(within(region).getAllByRole("listitem")).toHaveLength(200)
  })

  it("the observer's root is the region, and the sentinel scrolling into view appends the next 200", async () => {
    render(<DocumentChunksSection docId="doc-big" />)
    const region = await screen.findByRole("region", { name: /^Chunk list/ })
    expect(liveObserver().options?.root).toBe(region)
    await scrollToEnd()
    expect(listDocumentChunksPage).toHaveBeenLastCalledWith("doc-big", { offset: 200, limit: 200 })
    expect(await screen.findByRole("region", { name: "Chunk list, 2,500 chunks, 400 loaded" })).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: /^Chunk list/ })).getAllByRole("listitem")).toHaveLength(400)
  })

  it("while the next page loads: one skeleton bar and 'Loading more chunks', the loaded chunks stay", async () => {
    render(<DocumentChunksSection docId="doc-big" />)
    await screen.findByRole("region", { name: /^Chunk list/ })
    listDocumentChunksPage.mockReturnValueOnce(new Promise(() => {}))
    await scrollToEnd()
    const region = screen.getByRole("region", { name: /^Chunk list/ })
    const status = within(region).getByRole("status")
    expect(status).toHaveTextContent("Loading more chunks")
    expect(region.querySelectorAll(".animate-pulse")).toHaveLength(1)
    expect(within(region).getAllByRole("listitem")).toHaveLength(200)
  })

  it("a failed next page keeps the chunks, says so, and Try again is the ONLY focusable thing added", async () => {
    render(<DocumentChunksSection docId="doc-big" />)
    await screen.findByRole("region", { name: /^Chunk list/ })
    listDocumentChunksPage.mockRejectedValueOnce(new Error("boom"))
    await scrollToEnd()
    const region = screen.getByRole("region", { name: /^Chunk list/ })
    const alert = await within(region).findByRole("alert")
    expect(alert).toHaveTextContent("Couldn’t load more chunks")
    expect(within(region).getAllByRole("listitem")).toHaveLength(200)
    const focusables = region.querySelectorAll("button, a[href], input, select, textarea, [tabindex]")
    expect(Array.from(focusables).map((el) => el.textContent)).toEqual(["Try again"])
    await act(async () => {
      within(region).getByRole("button", { name: "Try again" }).click()
    })
    expect(await screen.findByRole("region", { name: "Chunk list, 2,500 chunks, 400 loaded" })).toBeInTheDocument()
  })

  it("everything loaded: the name drops 'loaded', and the observer asks for nothing more", async () => {
    listDocumentChunksPage.mockImplementation(async () => ({
      chunks: [chunk(0), chunk(1)],
      total: 2,
      offset: 0,
      limit: 200,
    }))
    render(<DocumentChunksSection docId="doc-small" />)
    expect(await screen.findByRole("region", { name: "Chunk list, 2 chunks" })).toBeInTheDocument()
    for (const o of observers) {
      await act(async () => {
        o.callback(o.targets.map((target) => ({ isIntersecting: true, target }) as IntersectionObserverEntry), {} as IntersectionObserver)
      })
    }
    expect(listDocumentChunksPage).toHaveBeenCalledTimes(1)
  })

  it("⛔ no 'Show all' / 'Load more' button, one tabIndex, no overscroll — at every point", async () => {
    render(<DocumentChunksSection docId="doc-big" />)
    const region = await screen.findByRole("region", { name: /^Chunk list/ })
    const check = () => {
      expect(screen.queryByRole("button", { name: /show all|load more/i })).toBeNull()
      expect(region).toHaveAttribute("tabindex", "0")
      expect(region.querySelectorAll("[tabindex]")).toHaveLength(0)
      expect(region.className.split(/\s+/).filter((t) => t.startsWith("overscroll"))).toEqual([])
    }
    check()
    await scrollToEnd()
    await screen.findByRole("region", { name: "Chunk list, 2,500 chunks, 400 loaded" })
    check()
  })

  it("the observer is disconnected on unmount", async () => {
    const { unmount } = render(<DocumentChunksSection docId="doc-big" />)
    await screen.findByRole("region", { name: /^Chunk list/ })
    const o = liveObserver()
    unmount()
    expect(o.disconnect).toHaveBeenCalled()
  })

  it("a document switch discards an in-flight page for the old document", async () => {
    let release!: (v: DocumentChunkPage) => void
    const { rerender } = render(<DocumentChunksSection docId="doc-big" />)
    await screen.findByRole("region", { name: /^Chunk list/ })
    listDocumentChunksPage.mockReturnValueOnce(new Promise((r) => (release = r)))
    await scrollToEnd()
    listDocumentChunksPage.mockImplementation(async () => ({ chunks: [chunk(9)], total: 1, offset: 0, limit: 200 }))
    rerender(<DocumentChunksSection docId="doc-other" />)
    expect(await screen.findByRole("region", { name: "Chunk list, 1 chunk" })).toBeInTheDocument()
    await act(async () => release(pageOf(200, 200)))
    const region = screen.getByRole("region", { name: /^Chunk list/ })
    expect(within(region).getAllByRole("listitem")).toHaveLength(1)
    expect(region).toHaveTextContent("chunk body 9")
  })
})
