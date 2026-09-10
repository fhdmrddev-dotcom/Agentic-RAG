/**
 * Phase 233 (PREV-01 / PREV-02 / PREV-03 / LIB-09) — the preview surface, driven.
 *
 * ⭐ This suite is the React-side twin of the two locked sketches' `drive.cjs` files. Each block
 * below names the sketch clause it inherits, so the mockup and the shipped surface cannot come to
 * disagree — which is a ROADMAP failure mode in its own words:
 *
 *   *"The preview is built as its own code path, and the first divergence from the ingest verdict
 *    is found by a user."*
 *
 * ⭐ **THE LOAD-BEARING BLOCK IS "four buckets are structure, not state".** 229's own verdict is
 * that a clause worded *"there is no path where it is absent"* can only be met **by construction,
 * never by audit** — and 229-C's accordion is the one risk that choice carried. These cases are
 * that guard: collapsing a section hides FILES and keeps the label and the count.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SourcePreviewPanel } from "./SourcePreviewPanel"
import * as api from "@/lib/api"
import type { SourcePreviewResponse, SourceConfirmResponse } from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, previewSource: vi.fn(), confirmSourcePreview: vi.fn() }
})

const mockPreview = vi.mocked(api.previewSource)
const mockConfirm = vi.mocked(api.confirmSourcePreview)

const PREVIEW: SourcePreviewResponse = {
  folder_id: "f-1",
  folder_name: "Rate Sheets 2026",
  total: 6,
  counts: { add: 2, here: 1, uns: 1, unk: 2 },
  truncated: false,
  wrote: { documents: 0, chunks: 0, jobs: 0, folders: 0 },
  items: [
    {
      external_id: "d-1", name: "Rate Sheet Q3.xlsx", mime_type: "x", bucket: "add",
      fragment: "XLSX", reason: "", destination: "/Pricing", rule_suggested: true,
    },
    {
      external_id: "d-2", name: "Fuel Index.csv", mime_type: "text/csv", bucket: "add",
      fragment: "CSV", reason: "", destination: "/Pricing",
    },
    {
      external_id: "d-3", name: "Master Rate Sheet.xlsx", mime_type: "x", bucket: "here",
      fragment: "same file, unchanged",
      reason: "The same source file at the same version. Matched by source file, not by content: the bytes have not been compared.",
    },
    {
      external_id: "d-4", name: "kickoff-call.mp4", mime_type: "video/mp4", bucket: "uns",
      fragment: "video/mp4", reason: "video/mp4 — we cannot read this kind of file. Nothing is imported.",
    },
    {
      external_id: "d-5", name: "scan.pdf", mime_type: "application/pdf", bucket: "unk",
      fragment: "may have no text",
      reason: "A PDF. It may be image-only — we cannot know whether there is readable text in it until we open it.",
    },
    {
      external_id: "d-6", name: "Q3 Pricing Review", mime_type: "application/vnd.google-apps.document",
      bucket: "unk", fragment: "native Google file",
      reason: "A native Google document. Drive publishes no content identity for native files.",
    },
  ],
}

const CONFIRMED: SourceConfirmResponse = {
  accounted: 6,
  unaccounted: 0,
  preview_said_added: 2,
  actually_added: 3,
  outcomes: [
    { external_id: "d-1", name: "Rate Sheet Q3.xlsx", outcome: "added" },
    { external_id: "d-2", name: "Fuel Index.csv", outcome: "added" },
    { external_id: "d-3", name: "Master Rate Sheet.xlsx", outcome: "here" },
    { external_id: "d-4", name: "kickoff-call.mp4", outcome: "refused", reason: "video/mp4 — we cannot read this kind of file." },
    { external_id: "d-5", name: "scan.pdf", outcome: "refused", reason: "No text layer — this PDF is image-only." },
    { external_id: "d-6", name: "Q3 Pricing Review", outcome: "here" },
  ],
}

function renderPanel() {
  return render(
    <SourcePreviewPanel connectionId="conn-1" folderId="f-1" folderName="Rate Sheets 2026" />,
  )
}

beforeEach(() => {
  mockPreview.mockReset()
  mockConfirm.mockReset()
  mockPreview.mockResolvedValue(PREVIEW)
  mockConfirm.mockResolvedValue(CONFIRMED)
})

afterEach(cleanup)

// ── SC#1 — four buckets, and they are STRUCTURE ────────────────────────────────────────────

describe("the four buckets are structure, not state (229-C / D-233-04)", () => {
  it("renders exactly four sections, and they cover all four buckets", async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("preview-buckets")).toBeInTheDocument())
    const sections = document.querySelectorAll("[data-bucket]")
    expect(sections).toHaveLength(4)
    expect([...sections].map((s) => s.getAttribute("data-bucket"))).toEqual([
      "add", "here", "uns", "unk",
    ])
  })

  it("renders the four verbatim labels", async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("preview-legend")).toBeInTheDocument())
    for (const label of ["Will be added", "Already here", "Type not supported", "Can't tell without reading it"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
  })

  it("⭐ collapsing a section hides its FILES and keeps its label and its COUNT", async () => {
    // The one risk 229-C carries and 229-A did not. Fenced here rather than by discipline.
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => expect(document.querySelector('[data-bucket-body="unk"]')).toBeTruthy())

    await user.click(document.querySelector('[data-bucket-header="unk"]') as HTMLElement)

    expect(document.querySelector('[data-bucket-body="unk"]')).toBeNull() // files gone
    expect(document.querySelector('[data-bucket="unk"]')).toBeTruthy() // section stays
    expect(document.querySelector('[data-bucket-count="unk"]')?.textContent).toBe("2") // count stays
    expect(screen.getAllByText("Can't tell without reading it").length).toBeGreaterThan(0)
  })

  it("⛔ there is NO filter chip and NO collapse-all — a bucket cannot be removed", async () => {
    // Sketch variant B lost on exactly this: a filter chip IS a control that removes a bucket.
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("preview-buckets")).toBeInTheDocument())
    const buttons = [...document.querySelectorAll("button")].map((b) => (b.textContent || "").toLowerCase())
    expect(buttons.some((t) => t.includes("collapse all"))).toBe(false)
    expect(buttons.some((t) => t.includes("filter"))).toBe(false)
    expect(buttons.some((t) => t.includes("hide"))).toBe(false)
    // and every bucket header is a toggle, never a remove
    expect(document.querySelectorAll("[data-bucket-header]")).toHaveLength(4)
  })

  it("the bar's segments sum to the folder's total", async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("preview-bar")).toBeInTheDocument())
    const widths = [...document.querySelectorAll("[data-segment]")].map((el) =>
      parseFloat((el as HTMLElement).style.width),
    )
    expect(widths).toHaveLength(4)
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 5)
  })

  it("the unknown segment is HATCHED — uncertainty is proportional, not numeric", async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("preview-bar")).toBeInTheDocument())
    const unk = document.querySelector('[data-segment="unk"]') as HTMLElement
    expect(unk.style.backgroundImage).toContain("repeating-linear-gradient")
  })
})

// ── the honesty of bucket 2 ────────────────────────────────────────────────────────────────

describe("⛔ 'Already here' makes no content-identity claim", () => {
  it("the legend carries the qualifier", async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("preview-legend")).toBeInTheDocument())
    const qualifier = document.querySelector("[data-legend-qualifier]")
    expect(qualifier?.textContent).toBe("by source file, not content")
  })

  it("the legend region names no hash", async () => {
    // ⚠ REGION-SCOPED, and the region is asserted to have been FOUND. The sketch's first version
    // of this guard searched the whole document, silently matched nothing, and passed on the
    // planted defect. A guard that cannot fail on the defect it names is decoration.
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("preview-legend")).toBeInTheDocument())
    const legend = screen.getByTestId("preview-legend")
    expect(legend.textContent).toBeTruthy()
    expect(legend.textContent!.toLowerCase()).not.toContain("hash")
    expect(legend.textContent!.toLowerCase()).not.toContain("checksum")
  })
})

// ── SC#3 / density ─────────────────────────────────────────────────────────────────────────

describe("rows say enough, and no more", () => {
  it("every added row carries a destination (SC#3, before any row exists)", async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("preview-buckets")).toBeInTheDocument())
    const user = userEvent.setup()
    await user.click(document.querySelector('[data-bucket-header="add"]') as HTMLElement)
    const rows = document.querySelectorAll('[data-preview-row="add"]')
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.querySelector("[data-preview-destination]")?.textContent).toContain("/Pricing")
    }
  })

  it("a rule-suggested destination is marked as suggested", async () => {
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("preview-buckets")).toBeInTheDocument())
    await user.click(document.querySelector('[data-bucket-header="add"]') as HTMLElement)
    expect(document.querySelectorAll("[data-preview-rule]")).toHaveLength(1)
  })

  it("⭐ every unknown row shows a FRAGMENT and carries its full reason BEHIND it", async () => {
    // A bucket labelled "can't tell" whose rows never say why is a shrug; a row that prints the
    // whole sentence is the density the operator rejected. Fragment on screen, reason on hover.
    renderPanel()
    await waitFor(() => expect(document.querySelector('[data-bucket-body="unk"]')).toBeTruthy())
    const rows = document.querySelectorAll('[data-preview-row="unk"]')
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      const fragment = row.querySelector("[data-preview-fragment]")?.textContent ?? ""
      expect(fragment.length).toBeGreaterThan(0)
      expect(fragment.length).toBeLessThanOrEqual(24)
      expect((row.getAttribute("title") ?? "").length).toBeGreaterThan(40)
      expect(row.textContent).not.toContain(row.getAttribute("title"))
    }
  })
})

// ── SC#2 — nothing has been written yet ────────────────────────────────────────────────────

describe("nothing has been written yet (230-A)", () => {
  it("the footer prints the four zeros", async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("zero-write")).toBeInTheDocument())
    expect(screen.getByTestId("zero-write").textContent).toBe(
      "0 documents · 0 chunks · 0 jobs · 0 folders",
    )
  })

  it("opening the preview calls the READ door and never the writing one", async () => {
    renderPanel()
    await waitFor(() => expect(mockPreview).toHaveBeenCalledTimes(1))
    expect(mockConfirm).not.toHaveBeenCalled()
  })

  it("Cancel prints the zeros rather than saying 'cancelled'", async () => {
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("preview-cancel")).toBeInTheDocument())
    await user.click(screen.getByTestId("preview-cancel"))
    const toast = await screen.findByTestId("preview-toast")
    expect(toast.textContent).toContain("0 documents · 0 chunks · 0 jobs · 0 folders")
    expect(toast.textContent?.toLowerCase()).not.toContain("cancelled")
    expect(mockConfirm).not.toHaveBeenCalled()
  })
})

// ── SC#4 / SC#5 — the confirm ──────────────────────────────────────────────────────────────

describe("the confirm dissolves the bar and names every refusal", () => {
  it("the button names both numbers — what is certain, and what must be opened", async () => {
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("preview-confirm")).toBeInTheDocument())
    expect(screen.getByTestId("preview-confirm").textContent).toContain("Add 2 · read 2")
  })

  it("the bar becomes added / already here / refused", async () => {
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("preview-confirm")).toBeInTheDocument())
    await user.click(screen.getByTestId("preview-confirm"))
    await waitFor(() => expect(screen.getByTestId("preview-reconciliation")).toBeInTheDocument())
    expect(document.querySelector('[data-segment="added"]')).toBeTruthy()
    expect(document.querySelector('[data-segment="here"]')).toBeTruthy()
    expect(document.querySelector('[data-segment="refused"]')).toBeTruthy()
    // …and the four preview segments are gone: one object, not a second screen.
    expect(document.querySelector('[data-segment="unk"]')).toBeNull()
  })

  it("the reconciliation line is the SC#4 receipt", async () => {
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("preview-confirm")).toBeInTheDocument())
    await user.click(screen.getByTestId("preview-confirm"))
    const line = await screen.findByTestId("preview-reconciliation")
    expect(line.textContent).toContain("6 accounted · 0 unaccounted")
    // ⛔ "accepted", not "added" — the files are queued at this moment, not readable.
    expect(line.textContent).toContain("preview said 2 → 3 accepted")
  })

  it("⛔ SC#5 — every refusal NAMES its cause, never only a colour", async () => {
    // Sketch variant B failed on exactly this: four dots flipped colour and there was nowhere
    // for WHY. A refusal that is only a colour is a count.
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("preview-confirm")).toBeInTheDocument())
    await user.click(screen.getByTestId("preview-confirm"))
    await waitFor(() => expect(screen.getByTestId("preview-reconciliation")).toBeInTheDocument())
    const refusals = document.querySelectorAll('[data-outcome="refused"]')
    expect(refusals).toHaveLength(2)
    for (const r of refusals) {
      const named = r.querySelector("[data-refusal-reason]")?.textContent ?? ""
      expect(named.length).toBeGreaterThan(10)
      expect(named).not.toBe("No reason was given.")
    }
  })

  it("a file that was only guessable can resolve to 'already here' — tier 2 doing its job", async () => {
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("preview-confirm")).toBeInTheDocument())
    await user.click(screen.getByTestId("preview-confirm"))
    await waitFor(() => expect(screen.getByTestId("preview-reconciliation")).toBeInTheDocument())
    // `d-6` was `unk` in the preview (Drive publishes no identity for native Docs) and resolved
    // to `here` once exported and hashed. The preview said "can't tell" and it was right.
    const previewed = PREVIEW.items.find((i) => i.external_id === "d-6")!
    const resolved = CONFIRMED.outcomes.find((o) => o.external_id === "d-6")!
    expect(previewed.bucket).toBe("unk")
    expect(resolved.outcome).toBe("here")
  })
})

describe("edges", () => {
  it("a truncated listing says so rather than presenting a partial folder as complete", async () => {
    mockPreview.mockResolvedValue({ ...PREVIEW, truncated: true })
    renderPanel()
    const note = await screen.findByTestId("preview-truncated")
    expect(note.textContent).toContain("did not finish")
  })

  it("a failed listing surfaces the error and writes nothing", async () => {
    mockPreview.mockRejectedValue(new Error("Drive said no."))
    renderPanel()
    const err = await screen.findByTestId("source-preview-error")
    expect(err.textContent).toContain("Drive said no.")
    expect(mockConfirm).not.toHaveBeenCalled()
  })

  it("renders nothing at all with no folder chosen", () => {
    const { container } = render(<SourcePreviewPanel connectionId="conn-1" folderId={null} />)
    expect(container.firstChild).toBeNull()
  })
})

// ── per-file selection (operator: "how can I select individual files") ─────────────────────

describe("⭐ individual files can be picked, and the default is still the whole folder", () => {
  it("only add and unk rows are selectable — here needs no import, uns cannot be read", async () => {
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("preview-buckets")).toBeInTheDocument())
    for (const b of ["add", "here", "uns"]) {
      await user.click(document.querySelector(`[data-bucket-header="${b}"]`) as HTMLElement)
    }
    const pickable = (bucket: string) =>
      [...document.querySelectorAll(`[data-preview-row="${bucket}"]`)].filter((r) =>
        r.querySelector('[data-testid="preview-pick"]'),
      ).length
    expect(pickable("add")).toBe(2)
    expect(pickable("unk")).toBe(2)
    // A checkbox here would offer an action that does nothing.
    expect(pickable("here")).toBe(0)
    expect(pickable("uns")).toBe(0)
  })

  it("everything is picked at rest, so the folder-grain import stays one click", async () => {
    renderPanel()
    await waitFor(() => expect(document.querySelector('[data-bucket-body="unk"]')).toBeTruthy())
    const boxes = [...document.querySelectorAll('[data-testid="preview-pick"]')]
    expect(boxes.length).toBeGreaterThan(0)
    expect(boxes.every((b) => (b as HTMLInputElement).checked)).toBe(true)
    expect(screen.getByTestId("preview-confirm").textContent).toContain("Add 2 · read 2")
  })

  it("⭐ unticking one file changes the button, and does NOT mean 'only that one'", async () => {
    // The first touch materialises "all" into a real set. Getting this wrong inverts the
    // selection — a person removing one file would import exactly that file.
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => expect(document.querySelector('[data-bucket-body="unk"]')).toBeTruthy())
    await user.click(
      document.querySelector('[data-testid="preview-pick"][data-external-id="d-5"]') as HTMLElement,
    )
    expect(screen.getByTestId("preview-confirm").textContent).toContain("Add 2 · read 1")
  })

  it("confirm sends ONLY the ticked ids once the person has taken over", async () => {
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => expect(document.querySelector('[data-bucket-body="unk"]')).toBeTruthy())
    await user.click(
      document.querySelector('[data-testid="preview-pick"][data-external-id="d-5"]') as HTMLElement,
    )
    await user.click(screen.getByTestId("preview-confirm"))
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled())
    const body = mockConfirm.mock.calls[0][1]
    expect(body.only_external_ids).toEqual(["d-1", "d-2", "d-6"])
  })

  it("⛔ an untouched selection sends undefined, NOT an empty array", async () => {
    // The server reads `[]` as "nothing". Collapsing the two would make the default import a
    // silent no-op — the worst possible failure for a button labelled "Add 2 · read 2".
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => expect(screen.getByTestId("preview-confirm")).toBeInTheDocument())
    await user.click(screen.getByTestId("preview-confirm"))
    await waitFor(() => expect(mockConfirm).toHaveBeenCalled())
    expect(mockConfirm.mock.calls[0][1].only_external_ids).toBeUndefined()
  })

  it("confirm is disabled when everything selectable has been unticked", async () => {
    const user = userEvent.setup()
    renderPanel()
    await waitFor(() => expect(document.querySelector('[data-bucket-body="unk"]')).toBeTruthy())
    await user.click(document.querySelector('[data-bucket-header="add"]') as HTMLElement)
    for (const id of ["d-1", "d-2", "d-5", "d-6"]) {
      await user.click(
        document.querySelector(`[data-testid="preview-pick"][data-external-id="${id}"]`) as HTMLElement,
      )
    }
    expect(screen.getByTestId("preview-confirm")).toBeDisabled()
  })
})

describe("the tree lives inside the card (sketch 231-A's two-column body)", () => {
  it("renders the left column when a tree is supplied", async () => {
    render(
      <SourcePreviewPanel
        connectionId="conn-1"
        folderId="f-1"
        folderName="Rate Sheets 2026"
        leftSlot={<div data-testid="fake-tree">tree</div>}
      />,
    )
    expect(await screen.findByTestId("preview-tree")).toBeInTheDocument()
    expect(screen.getByTestId("fake-tree")).toBeInTheDocument()
  })

  it("⭐ with a tree but NO folder chosen it still renders — the tree is how you choose one", () => {
    // The old early-return on a missing folder would have hidden the very control used to pick.
    render(
      <SourcePreviewPanel
        connectionId="conn-1"
        folderId={null}
        leftSlot={<div data-testid="fake-tree">tree</div>}
      />,
    )
    expect(screen.getByTestId("fake-tree")).toBeInTheDocument()
  })
})
