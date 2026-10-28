/**
 * Phase 299-02 (LINK-02 / D-03; T-299-19) — A WORKFLOW OPENS FROM ITS ADDRESS.
 *
 * `/app/workflows/<id>` opens an OWNED DRAFT in the Builder through the page's existing
 * `onOpenDraft` (so the drafts row's opaque concurrency token is carried by construction), and a
 * VISIBLE PUBLISHED workflow as its library card — project filter cleared first, then scrolled
 * into view, focused and marked for two seconds.
 *
 * ⛔ OPENING NEVER WRITES (D-03 / T-299-19). The whole client API module is auto-mocked here and
 * every one of its functions is asserted uncalled in every case: the hook may only change local
 * state (`onOpenDraft`), move focus, and clear a filter.
 *
 * ⛔ AND IT DECIDES NOTHING ABOUT AN ID IT CANNOT SEE. An id in neither list is left alone — the
 * "can't be opened" / "switch org" decision is plan 299-03's gate.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"

vi.mock("@/lib/api")
vi.mock("@/lib/api/workflows")

import * as api from "@/lib/api"
import * as workflowsApi from "@/lib/api/workflows"
import type { WorkflowDraftRow } from "@/lib/api"
import type { LibraryRow } from "../libraryRow"
import { useWorkflowLinkTarget, LINK_TARGET_MARK_MS } from "../useWorkflowLinkTarget"
import hookSource from "../useWorkflowLinkTarget.ts?raw"
import cardSource from "../WorkflowCard.tsx?raw"

const DRAFT_ID = "7e1d3b0f-4c2a-4d7e-9f8b-2a3b4c5d6e01"
const PUBLISHED_ID = "7e1d3b0f-4c2a-4d7e-9f8b-2a3b4c5d6e02"
const OTHER_ID = "7e1d3b0f-4c2a-4d7e-9f8b-2a3b4c5d6e03"

const draft: WorkflowDraftRow = {
  id: DRAFT_ID,
  slug: "vendor-risk",
  version: 2,
  name: "Vendor risk",
  definition: null,
  token: "2026-10-28 09:00:00.123456+00",
} as WorkflowDraftRow

function row(id: string, provenance: LibraryRow["provenance"]): LibraryRow {
  return { id, slug: `slug-${id.slice(-2)}`, name: `Row ${id.slice(-2)}`, version: 1, def: undefined, provenance } as LibraryRow
}

interface Args {
  id: string | null
  drafts: WorkflowDraftRow[]
  rows: LibraryRow[]
  loading: boolean
}

function setup(initial: Args) {
  const onOpenDraft = vi.fn()
  const clearProjectFilter = vi.fn()
  const view = renderHook(
    (a: Args) => useWorkflowLinkTarget({ ...a, onOpenDraft, clearProjectFilter }),
    { initialProps: initial },
  )
  return { onOpenDraft, clearProjectFilter, view }
}

/** Every client function, write or read, must stay uncalled — opening is local only. */
function expectNoApiCall() {
  for (const mod of [api, workflowsApi]) {
    for (const [name, fn] of Object.entries(mod)) {
      if (typeof fn === "function" && vi.isMockFunction(fn)) {
        expect(fn, `${name} must not be called by opening a link`).not.toHaveBeenCalled()
      }
    }
  }
}

function plantCard(id: string): HTMLElement {
  const el = document.createElement("div")
  el.setAttribute("data-row-id", id)
  el.textContent = "card"
  document.body.appendChild(el)
  return el
}

const scrollIntoView = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  Element.prototype.scrollIntoView = scrollIntoView
})
afterEach(() => {
  document.body.innerHTML = ""
  vi.useRealTimers()
})

describe("useWorkflowLinkTarget — an owned draft opens in the Builder (D-03)", () => {
  it("calls onOpenDraft once with the drafts row itself (the token travels with it)", () => {
    const { onOpenDraft, clearProjectFilter } = setup({ id: DRAFT_ID, drafts: [draft], rows: [row(DRAFT_ID, "draft")], loading: false })
    expect(onOpenDraft).toHaveBeenCalledTimes(1)
    expect(onOpenDraft.mock.calls[0][0]).toBe(draft)
    expect(onOpenDraft.mock.calls[0][0].token).toBe(draft.token)
    expect(clearProjectFilter).not.toHaveBeenCalled()
    expectNoApiCall()
  })

  it("fires once per id: a re-render or a list refetch does not re-open the Builder", () => {
    const { onOpenDraft, view } = setup({ id: DRAFT_ID, drafts: [draft], rows: [], loading: false })
    view.rerender({ id: DRAFT_ID, drafts: [{ ...draft }], rows: [], loading: false })
    view.rerender({ id: DRAFT_ID, drafts: [draft], rows: [row(OTHER_ID, "published")], loading: false })
    expect(onOpenDraft).toHaveBeenCalledTimes(1)
  })

  it("an uppercase id still finds the lowercase row", () => {
    const { onOpenDraft } = setup({ id: DRAFT_ID.toUpperCase(), drafts: [draft], rows: [], loading: false })
    expect(onOpenDraft).toHaveBeenCalledTimes(1)
  })
})

describe("useWorkflowLinkTarget — a published workflow is focused as its card (D-03)", () => {
  it("clears the project filter, scrolls the card into view, focuses it and marks it for 2 s", () => {
    vi.useFakeTimers()
    const card = plantCard(PUBLISHED_ID)
    const { clearProjectFilter, onOpenDraft } = setup({ id: PUBLISHED_ID, drafts: [], rows: [row(PUBLISHED_ID, "published")], loading: false })
    expect(clearProjectFilter).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(card)
    expect(card.className).toContain("ring-2")
    expect(onOpenDraft).not.toHaveBeenCalled()
    vi.advanceTimersByTime(LINK_TARGET_MARK_MS - 1)
    expect(card.className).toContain("ring-2")
    vi.advanceTimersByTime(1)
    expect(card.className).not.toContain("ring-2")
    expect(LINK_TARGET_MARK_MS).toBe(2000)
    expectNoApiCall()
  })

  it("a card not rendered yet (the cleared filter is still re-querying) is focused once it appears — still once", () => {
    const { clearProjectFilter, view } = setup({ id: PUBLISHED_ID, drafts: [], rows: [row(PUBLISHED_ID, "published")], loading: false })
    expect(clearProjectFilter).toHaveBeenCalledTimes(1)
    expect(scrollIntoView).not.toHaveBeenCalled()
    const card = plantCard(PUBLISHED_ID)
    view.rerender({ id: PUBLISHED_ID, drafts: [], rows: [row(PUBLISHED_ID, "published"), row(OTHER_ID, "published")], loading: false })
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(card)
    view.rerender({ id: PUBLISHED_ID, drafts: [], rows: [row(PUBLISHED_ID, "published")], loading: false })
    expect(scrollIntoView).toHaveBeenCalledTimes(1)
    expect(clearProjectFilter).toHaveBeenCalledTimes(1)
  })

  it("a starter row is focused the same way (it is a visible definition too)", () => {
    const card = plantCard(PUBLISHED_ID)
    setup({ id: PUBLISHED_ID, drafts: [], rows: [row(PUBLISHED_ID, "starter")], loading: false })
    expect(document.activeElement).toBe(card)
  })
})

describe("useWorkflowLinkTarget — it decides nothing it cannot see", () => {
  it("while the lists are loading it does nothing", () => {
    plantCard(PUBLISHED_ID)
    const { onOpenDraft, clearProjectFilter } = setup({ id: DRAFT_ID, drafts: [draft], rows: [row(PUBLISHED_ID, "published")], loading: true })
    expect(onOpenDraft).not.toHaveBeenCalled()
    expect(clearProjectFilter).not.toHaveBeenCalled()
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it("an id in neither list does nothing (299-03's gate owns that answer)", () => {
    plantCard(OTHER_ID)
    const { onOpenDraft, clearProjectFilter } = setup({ id: OTHER_ID, drafts: [draft], rows: [row(PUBLISHED_ID, "published")], loading: false })
    expect(onOpenDraft).not.toHaveBeenCalled()
    expect(clearProjectFilter).not.toHaveBeenCalled()
    expect(scrollIntoView).not.toHaveBeenCalled()
    expectNoApiCall()
  })

  it("no id does nothing", () => {
    const { onOpenDraft, clearProjectFilter } = setup({ id: null, drafts: [draft], rows: [row(DRAFT_ID, "draft")], loading: false })
    expect(onOpenDraft).not.toHaveBeenCalled()
    expect(clearProjectFilter).not.toHaveBeenCalled()
  })

  it("a NEW id is handled on its own (the once-per-id memory is keyed on the id)", () => {
    const card = plantCard(PUBLISHED_ID)
    const { onOpenDraft, view } = setup({ id: DRAFT_ID, drafts: [draft], rows: [row(PUBLISHED_ID, "published")], loading: false })
    expect(onOpenDraft).toHaveBeenCalledTimes(1)
    view.rerender({ id: PUBLISHED_ID, drafts: [draft], rows: [row(PUBLISHED_ID, "published")], loading: false })
    expect(document.activeElement).toBe(card)
    expect(onOpenDraft).toHaveBeenCalledTimes(1)
  })
})

/** Line-anchored comment stripper (`renameFence.test.ts`). */
const codeOf = (src: string) =>
  src.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

describe("useWorkflowLinkTarget — as source (D-03, F4)", () => {
  it("imports no client API module and never names the page", () => {
    const code = codeOf(hookSource)
    expect(code).toContain("export function useWorkflowLinkTarget")
    expect(code).not.toMatch(/@\/lib\/api/)
    expect(code).not.toContain("WorkflowsPage")
  })

  it("WorkflowCard's root carries data-row-id={row.id} beside data-provenance", () => {
    const code = codeOf(cardSource)
    expect(code.match(/data-row-id=\{row\.id\}/g)).toHaveLength(1)
    expect(code).toMatch(/data-provenance=\{row\.provenance\}\s+data-row-id=\{row\.id\}/)
  })
})
