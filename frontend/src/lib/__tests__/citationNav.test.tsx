/**
 * Phase 153 Plan 02 Task 1 (TDD) — the shared citation-interaction contract.
 *
 * `citationNav.tsx` is the interface-first foundation the Wave-2/3 citation
 * plans (footer 153-03, cited-markdown/peek 153-05) all consume, so its surface
 * is fixed BEFORE its consumers:
 *
 *   - `CitationNavProvider` + `useCitationNav()` — the cross-view nav hook. Its
 *     `openDocument(documentId)` records a one-shot pending-document intent AND
 *     fires the injected `navigate` callback with the documents view, so the
 *     "Open document" affordance can switch to the documents surface and pre-
 *     select the cited doc through the EXISTING owner/RLS-scoped fetch (SC#2 /
 *     T-153-02-01 — no new unscoped fetch by raw document_id).
 *   - `flashCitationRow` / `flashCitationMarker` — the marker↔row bidirectional
 *     flash contract: a single shared DOM attribute + flash/active class pair so
 *     markers and footer rows link two-way without a shared prop.
 *   - `CITATION_ROW_ATTR` / `CITATION_MARKER_ATTR` / `CITATION_FLASH_CLASS` /
 *     `CITATION_ACTIVE_CLASS` — the single source of truth both surfaces import
 *     (no divergent attribute names across parallel plans).
 *
 * Security (T-153-02-02): the flash helpers coerce `n` to a positive integer and
 * scope the querySelector to a container — a missing/invalid `n` is a no-op,
 * never an unscoped or injectable selector.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import type { ReactNode } from "react"
import {
  CitationNavProvider,
  useCitationNav,
  useCitationNavOptional,
  flashCitationRow,
  flashCitationMarker,
  CITATION_ROW_ATTR,
  CITATION_MARKER_ATTR,
  CITATION_FLASH_CLASS,
  CITATION_ACTIVE_CLASS,
} from "../citationNav"

describe("citationNav — shared DOM constants", () => {
  it("exports the attribute + class names as stable strings", () => {
    expect(CITATION_ROW_ATTR).toBe("data-citation-row")
    expect(CITATION_MARKER_ATTR).toBe("data-citation-marker")
    expect(typeof CITATION_FLASH_CLASS).toBe("string")
    expect(CITATION_FLASH_CLASS.length).toBeGreaterThan(0)
    expect(typeof CITATION_ACTIVE_CLASS).toBe("string")
    expect(CITATION_ACTIVE_CLASS.length).toBeGreaterThan(0)
  })
})

describe("useCitationNav — provider contract", () => {
  it("throws a clear error when used outside a provider", () => {
    // Silence the expected React error boundary console noise.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    expect(() => renderHook(() => useCitationNav())).toThrow(/CitationNavProvider/i)
    spy.mockRestore()
  })

  it("returns an openDocument function inside a provider", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CitationNavProvider navigate={vi.fn()}>{children}</CitationNavProvider>
    )
    const { result } = renderHook(() => useCitationNav(), { wrapper })
    expect(typeof result.current.openDocument).toBe("function")
  })

  it("records the last requested documentId and fires navigate('documents')", () => {
    const navigate = vi.fn()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CitationNavProvider navigate={navigate}>{children}</CitationNavProvider>
    )
    const { result } = renderHook(() => useCitationNav(), { wrapper })

    act(() => {
      result.current.openDocument("doc-42")
    })

    expect(navigate).toHaveBeenCalledWith("documents")
    expect(result.current.pendingDocumentId).toBe("doc-42")
  })

  it("also fires the optional selectDocument injection when provided", () => {
    const navigate = vi.fn()
    const selectDocument = vi.fn()
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CitationNavProvider navigate={navigate} selectDocument={selectDocument}>
        {children}
      </CitationNavProvider>
    )
    const { result } = renderHook(() => useCitationNav(), { wrapper })

    act(() => {
      result.current.openDocument("doc-7")
    })

    expect(selectDocument).toHaveBeenCalledWith("doc-7")
  })

  it("consumePendingDocument clears the one-shot intent (re-open works)", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CitationNavProvider navigate={vi.fn()}>{children}</CitationNavProvider>
    )
    const { result } = renderHook(() => useCitationNav(), { wrapper })

    act(() => {
      result.current.openDocument("doc-1")
    })
    expect(result.current.pendingDocumentId).toBe("doc-1")

    act(() => {
      result.current.consumePendingDocument()
    })
    expect(result.current.pendingDocumentId).toBeNull()

    // Re-requesting the SAME doc after consumption records it again (one-shot).
    act(() => {
      result.current.openDocument("doc-1")
    })
    expect(result.current.pendingDocumentId).toBe("doc-1")
  })
})

describe("useCitationNavOptional — non-throwing accessor", () => {
  it("returns null outside a provider (consumers can render in isolation)", () => {
    const { result } = renderHook(() => useCitationNavOptional())
    expect(result.current).toBeNull()
  })

  it("returns the context value inside a provider", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CitationNavProvider navigate={vi.fn()}>{children}</CitationNavProvider>
    )
    const { result } = renderHook(() => useCitationNavOptional(), { wrapper })
    expect(result.current).not.toBeNull()
    expect(typeof result.current?.openDocument).toBe("function")
  })
})

describe("flashCitationRow / flashCitationMarker — marker↔row DOM contract", () => {
  beforeEach(() => {
    document.body.innerHTML = ""
    // jsdom does not implement scrollIntoView — stub it so the helper can call it.
    Element.prototype.scrollIntoView = vi.fn()
  })

  function mount(): HTMLElement {
    const container = document.createElement("div")
    container.innerHTML = `
      <p>
        answer text <sup ${CITATION_MARKER_ATTR}="1">1</sup> more
        <sup ${CITATION_MARKER_ATTR}="2">2</sup>
      </p>
      <div ${CITATION_ROW_ATTR}="1">row one</div>
      <div ${CITATION_ROW_ATTR}="2">row two</div>
    `
    document.body.appendChild(container)
    return container
  }

  it("flashCitationRow adds the flash class to the matching row and scrolls it into view", () => {
    const container = mount()
    const row = container.querySelector(`[${CITATION_ROW_ATTR}="2"]`) as HTMLElement

    flashCitationRow(2, container)

    expect(row.classList.contains(CITATION_FLASH_CLASS)).toBe(true)
    expect(row.scrollIntoView).toHaveBeenCalled()
  })

  it("flashCitationMarker adds the active class to the matching marker", () => {
    const container = mount()
    const marker = container.querySelector(`[${CITATION_MARKER_ATTR}="1"]`) as HTMLElement

    flashCitationMarker(1, container)

    expect(marker.classList.contains(CITATION_ACTIVE_CLASS)).toBe(true)
  })

  it("is a no-op (no throw) for a non-existent n", () => {
    const container = mount()
    expect(() => flashCitationRow(99, container)).not.toThrow()
    expect(() => flashCitationMarker(99, container)).not.toThrow()
  })

  it("is a no-op for an invalid n (never builds an injectable selector)", () => {
    const container = mount()
    // Hostile / non-integer inputs must not throw and must not match anything.
    expect(() => flashCitationRow(NaN as unknown as number, container)).not.toThrow()
    expect(() => flashCitationRow(-1, container)).not.toThrow()
    expect(
      () => flashCitationRow('1"] , [data-x="' as unknown as number, container),
    ).not.toThrow()
    // No row should have been flashed by the injection attempt.
    expect(container.querySelectorAll(`.${CITATION_FLASH_CLASS}`).length).toBe(0)
  })

  it("scopes the query to the given container (no cross-container bleed)", () => {
    const a = mount()
    const b = mount()
    flashCitationRow(1, a)
    const aRow = a.querySelector(`[${CITATION_ROW_ATTR}="1"]`) as HTMLElement
    const bRow = b.querySelector(`[${CITATION_ROW_ATTR}="1"]`) as HTMLElement
    expect(aRow.classList.contains(CITATION_FLASH_CLASS)).toBe(true)
    expect(bRow.classList.contains(CITATION_FLASH_CLASS)).toBe(false)
  })
})

// ── Phase 305-02 (D-17 / D-52; UI-SPEC Surface 4) — the document address arrival.
describe("CitationNavProvider — the /app/library/<uuid> arrival (305-02)", () => {
  const DOC_A = "5b0c1d2e-3f40-4a51-8b62-7c83d94ea5f6"
  const DOC_B = "0a1b2c3d-4e5f-4061-8273-8495a6b7c8d9"

  function harness(initial: string | null) {
    const navigate = vi.fn()
    const leave = vi.fn()
    const state: { document: string | null } = { document: initial }
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CitationNavProvider navigate={navigate} entityLink={{ document: state.document, leave }}>
        {children}
      </CitationNavProvider>
    )
    const hook = renderHook(() => useCitationNav(), { wrapper })
    const arrive = (next: string | null) => {
      state.document = next
      hook.rerender()
    }
    return { hook, navigate, leave, arrive }
  }

  it("a document arrival sets the pending document once per distinct id, without leaving the address", () => {
    const { hook, navigate, arrive } = harness(DOC_A)
    expect(hook.result.current.pendingDocumentId).toBe(DOC_A)
    // UI-SPEC Surface 4: the address stays as opened while the panel shows it, so no navigate
    expect(navigate).not.toHaveBeenCalled()
    act(() => hook.result.current.consumePendingDocument())
    arrive(DOC_A) // the same id again: not re-opened
    expect(hook.result.current.pendingDocumentId).toBeNull()
    arrive(DOC_B)
    expect(hook.result.current.pendingDocumentId).toBe(DOC_B)
  })

  it("no arrival leaves the pending intent alone", () => {
    const { hook } = harness(null)
    expect(hook.result.current.pendingDocumentId).toBeNull()
  })

  it("leaveDocumentAddress REPLACES the document address with the Library (leave({view: 'documents'}))", () => {
    const { hook, leave } = harness(DOC_A)
    act(() => hook.result.current.leaveDocumentAddress())
    expect(leave).toHaveBeenCalledTimes(1)
    expect(leave).toHaveBeenCalledWith({ view: "documents" })
  })

  it("off a document address leaveDocumentAddress writes nothing", () => {
    const { hook, leave } = harness(null)
    act(() => hook.result.current.leaveDocumentAddress())
    expect(leave).not.toHaveBeenCalled()
  })

  it("without the prop the provider is unchanged (every existing host)", () => {
    const wrapper = ({ children }: { children: ReactNode }) => <CitationNavProvider>{children}</CitationNavProvider>
    const { result } = renderHook(() => useCitationNav(), { wrapper })
    expect(result.current.pendingDocumentId).toBeNull()
    expect(() => result.current.leaveDocumentAddress()).not.toThrow()
  })
})
