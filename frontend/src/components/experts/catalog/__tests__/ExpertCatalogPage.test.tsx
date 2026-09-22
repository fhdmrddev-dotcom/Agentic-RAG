/**
 * Phase 262 plan 03 — PACK-11's honesty criterion, driven at the surface a person actually uses.
 *
 * ⛔ EVERY FIXTURE IS `visibility: "granted"`, AND THAT IS NOT DECORATION. RESEARCH §6 traced the
 * predicate: the grant check bites for `'granted'` ALONE — a bundle at `'org'` or `'public'` is
 * visible to every org member no matter what grants exist. A fixture set to `'org'` that expected
 * a vanish would be asserting something the data does not say, and would pass while proving
 * nothing. The same trap will sink the G-4 UAT row if the operator authors the wrong visibility.
 *
 * ⛔ THE VANISH IS ASSERTED OVER RENDERED TEXT, never over the absence of a `data-testid`. The
 * criterion is what a person sees, and this repository's recorded finding is that presence
 * assertions cannot see content drift.
 *
 * ⛔ AND THE POSITIVE CONTROL IS LOAD-BEARING: without case (1), the vanish would pass against a
 * page that renders nothing at all.
 */

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { ExpertCatalogPage } from "../ExpertCatalogPage"
import * as api from "@/lib/api"
import type { ExpertBundle } from "@/types"

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<any>("@/lib/api")
  return {
    ...actual,
    listExperts: vi.fn(),
  }
})

function bundle(over: Partial<ExpertBundle> & { name: string; slug: string }): ExpertBundle {
  return {
    id: over.slug,
    description: "",
    scope_mode: "biased",
    member_skills: [],
    required_connections: [],
    knowledge_folder_ids: [],
    prompt_suggestions: [],
    // ⛔ granted — the ONLY visibility the grant predicate filters on (RESEARCH §6).
    visibility: "granted",
    is_system: false,
    is_enabled: true,
    ...over,
  }
}

const A = bundle({
  name: "Contract Reviewer",
  slug: "contract-reviewer",
  description: "Reads master services agreements",
  category: "Legal",
})
const B = bundle({
  name: "Margin Watcher",
  slug: "margin-watcher",
  description: "Tracks unit economics",
  category: "Finance",
  member_skills: ["ratio_tool"],
})
/** The sketch's own honesty demo: "Jane does not hold the HR grant → the card vanishes." */
const C = bundle({
  name: "Executive Compensation Advisor",
  slug: "executive-compensation-advisor",
  description: "Board-level pay benchmarking",
  category: "HR",
})

const FORBIDDEN = ["locked", "unlock", "upgrade", "not available to you", "request access"]

function cardCount(container: HTMLElement): number {
  return container.querySelectorAll('[data-testid^="expert-card-"]').length
}

function renderCatalog() {
  return render(
    <ExpertCatalogPage folders={[]} onStartChat={vi.fn()} onInspect={vi.fn()} />,
  )
}

describe("ExpertCatalogPage · PACK-11 honesty", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("(1) THE POSITIVE CONTROL — when the server DOES return the granted Expert, its card renders", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([A, B, C])
    const { container } = renderCatalog()
    expect(await screen.findByText("Executive Compensation Advisor")).toBeInTheDocument()
    expect(cardCount(container)).toBe(3)
  })

  it("(2) THE VANISH — an Expert the caller holds no grant for does not appear at all", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([A, B])
    const { container } = renderCatalog()
    expect(await screen.findByText("Contract Reviewer")).toBeInTheDocument()
    expect(screen.getByText("Margin Watcher")).toBeInTheDocument()
    // Not the name, not the slug, not a placeholder row.
    expect(screen.queryByText("Executive Compensation Advisor")).toBeNull()
    expect(container.textContent).not.toContain("executive-compensation-advisor")
    expect(cardCount(container)).toBe(2)
  })

  it("(3) NO CONSOLATION PRIZE — the vanished Expert leaves no grey-out, no badge and no upsell", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([A, B])
    const { container } = renderCatalog()
    await screen.findByText("Contract Reviewer")
    const text = (container.textContent ?? "").toLowerCase()
    for (const word of FORBIDDEN) {
      expect(text).not.toContain(word)
    }
    expect(container.querySelectorAll("button:disabled")).toHaveLength(0)
  })

  it("(4) THE REFUSAL — the server's own sentence renders beside ZERO cards", async () => {
    const sentence = "Upgrade to Enterprise to use experts."
    vi.mocked(api.listExperts).mockRejectedValue(new Error(sentence))
    const { container } = renderCatalog()
    expect(await screen.findByText(sentence)).toBeInTheDocument()
    expect(cardCount(container)).toBe(0)
  })

  it("(5) SEARCH narrows the grid, driven through the real control", async () => {
    const user = userEvent.setup()
    vi.mocked(api.listExperts).mockResolvedValue([A, B, C])
    const { container } = renderCatalog()
    await screen.findByText("Contract Reviewer")

    await user.type(screen.getByLabelText("Search experts"), "margin")
    await waitFor(() => expect(cardCount(container)).toBe(1))
    expect(screen.getByText("Margin Watcher")).toBeInTheDocument()
    expect(screen.queryByText("Contract Reviewer")).toBeNull()

    await user.clear(screen.getByLabelText("Search experts"))
    await waitFor(() => expect(cardCount(container)).toBe(3))
  })

  it("(6) CATEGORY pills are DERIVED from the rows and narrow the grid", async () => {
    const user = userEvent.setup()
    vi.mocked(api.listExperts).mockResolvedValue([A, B, C])
    const { container } = renderCatalog()
    await screen.findByText("Contract Reviewer")

    // One pill per category PRESENT, plus the All control — and nothing the rows never carried.
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Finance" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Legal" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "HR" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Platform & Dev" })).toBeNull()

    await user.click(screen.getByRole("button", { name: "Legal" }))
    await waitFor(() => expect(cardCount(container)).toBe(1))
    expect(screen.getByText("Contract Reviewer")).toBeInTheDocument()
  })

  it("(7) an empty-but-successful load renders an honest line and ZERO cards — and no pills", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([])
    const { container } = renderCatalog()
    expect(await screen.findByText("No Experts are available to you yet.")).toBeInTheDocument()
    expect(cardCount(container)).toBe(0)
    expect(screen.queryByRole("button", { name: "All" })).toBeNull()
  })

  it("(8) the read is the grant-aware one: called ONCE, with no arguments", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([A])
    renderCatalog()
    await screen.findByText("Contract Reviewer")
    expect(api.listExperts).toHaveBeenCalledTimes(1)
    // ⛔ No argument is passed, so the management arm cannot be reached from this surface.
    expect(vi.mocked(api.listExperts).mock.calls[0]).toEqual([])
  })
})
