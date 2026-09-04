/**
 * Phase 217.1 plan 10 (LIB-01 / D-217.1-27 / WR-02 close) — the IndexingTab gate.
 *
 * ⭐ T-217.1-02's NEGATIVE CONTROL: with `model_management` false, no gated action button
 * exists in the DOM — so the client fn `kickReembed` can never be reached from any rendered
 * control (a client-side bypass attempt has no target).
 *
 * ⭐ ONE FETCH: `getIndexSummary()` is called exactly once and feeds all three cards;
 * `ReembedStatusCard` keeps its own self-fetch and is untouched.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import type { IndexSummary } from "@/lib/api"

// ── Control the feature gate via a hoisted var so each test picks its arm. ──
let featuresModelManagement = false
vi.mock("@/providers/EffectiveFeaturesProvider", () => ({
  useEffectiveFeaturesOptional: () => ({
    features: { model_management: featuresModelManagement },
    loading: false,
    refetch: () => {},
  }),
}))

const getIndexSummary = vi.fn<() => Promise<IndexSummary>>()
const kickReembed = vi.fn()
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    getIndexSummary: () => getIndexSummary(),
    kickReembed: (...a: unknown[]) => kickReembed(...(a as [])),
  }
})

// ReembedStatusCard self-fetches getReembedProgress — stub it to idle so the card renders
// nothing and the test doesn't need the full settings mock.
const getReembedProgress = vi.fn()
vi.mock("@/components/settings/ReembedStatusCard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/settings/ReembedStatusCard")>()
  return {
    ...actual,
    ReembedStatusCard: (props: { id?: string }) => (
      <div data-testid="reembed-status-card" id={props?.id} />
    ),
    getReembedProgress: () => getReembedProgress(),
  }
})

import { IndexingTab } from "../IndexingTab"

const summary: IndexSummary = {
  vectors: 224,
  chunks_total: 224,
  documents_without_vectors: 0,
  last_indexed: "2026-08-29T10:00:00Z",
  model: "text-embedding-3-small",
  dimensions: 1536,
  provider: "openai",
  folders: [],
}

beforeEach(() => {
  vi.clearAllMocks()
  featuresModelManagement = false
  getIndexSummary.mockResolvedValue(summary)
})

describe("IndexingTab — the facts render for every user", () => {
  it("renders the three cards' facts from one getIndexSummary fetch", async () => {
    render(<IndexingTab />)
    expect(await screen.findByText("Vector store")).toBeInTheDocument()
    expect(screen.getByText("Embedding model")).toBeInTheDocument()
    expect(screen.getByText("Folders")).toBeInTheDocument()
    await waitFor(() => expect(getIndexSummary).toHaveBeenCalledTimes(1))
  })

  it("ReembedStatusCard still mounts with id reembed-status-card, unchanged", () => {
    render(<IndexingTab />)
    const card = screen.getByTestId("reembed-status-card")
    expect(card.id).toBe("reembed-status-card")
  })

  it("an unreachable source is stated, never rendered as a zero", async () => {
    getIndexSummary.mockRejectedValue(new Error("network"))
    render(<IndexingTab />)
    expect(
      await screen.findByText("Could not read the indexing facts just now."),
    ).toBeInTheDocument()
  })
})

describe("IndexingTab — T-217.1-02 the VANISH gate (WR-02 close)", () => {
  it("with model_management false, Change model is ABSENT (not disabled)", async () => {
    render(<IndexingTab />)
    await screen.findByText("Embedding model")
    expect(screen.queryByTestId("change-model")).not.toBeInTheDocument()
  })

  it("with model_management true, Change model renders", async () => {
    featuresModelManagement = true
    render(<IndexingTab />)
    await screen.findByText("Embedding model")
    expect(screen.getByTestId("change-model")).toBeInTheDocument()
  })

  it("⭐ NEGATIVE CONTROL — with model_management false, kickReembed is never reachable (no control exists)", async () => {
    render(<IndexingTab />)
    await screen.findByText("Embedding model")
    // No Change-model button, no Re-index button — nothing that could call the gated fn.
    expect(screen.queryByTestId("change-model")).not.toBeInTheDocument()
    expect(screen.queryByTestId(/reindex-/)).not.toBeInTheDocument()
    expect(kickReembed).not.toHaveBeenCalled()
  })
})
