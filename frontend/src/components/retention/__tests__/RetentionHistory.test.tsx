/**
 * Phase 275 plan 04 Task 3 (S5 / 062-A / D-12 / D-13) — the retention receipts.
 *
 * Each case prices a lived failure:
 *   · a ✎ on a READ (a dry run), or a write without one;
 *   · a deleted document's receipt rendered as a link to something that no longer exists;
 *   · an actor rendered blank because the account is gone;
 *   · a late-hold drop that does not say why it was not deleted;
 *   · a pager that re-reads page one instead of the next 50.
 * Assertions read RENDERED WORDS.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { HistoryRow } from "@/lib/api/retention"

const m = vi.hoisted(() => ({ listHistory: vi.fn() }))
vi.mock("@/lib/api/retention", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/retention")>()
  return { ...actual, listHistory: m.listHistory }
})

import { RetentionHistory, receiptSentence } from "../RetentionHistory"

const dt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

let n = 0
function row(over: Partial<HistoryRow>): HistoryRow {
  n += 1
  return { id: `r${n}`, action: "archived", written: true, actor_name: "Nightly sweep", detail: {}, created_at: "2026-10-12T02:00:00Z", ...over }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("receiptSentence — one plain sentence per event (S5 table)", () => {
  const cases: Array<[string, Partial<HistoryRow>, string]> = [
    ["sweep archive", { action: "archived", document_name: "Invoice INV-0412", policy_name: "Finance invoices" },
      "Archived **Invoice INV-0412** under “Finance invoices”"],
    ["review → archive", { action: "archived", document_name: "Personnel file", policy_name: "Personnel records", detail: { decided_by: "Amira Sato" } },
      "Archived **Personnel file** under “Personnel records”, decided by Amira Sato"],
    ["confirmed delete", { action: "deleted", document_name: "Brightwater Office Lease", policy_name: "Expired contracts", actor_name: "Amira Sato" },
      "Deleted **Brightwater Office Lease** under “Expired contracts”, approved by Amira Sato"],
    ["queued delete", { action: "queued_delete", document_name: "Olsen Consulting SOW", policy_name: "Expired contracts" },
      "Queued **Olsen Consulting SOW** for deletion under “Expired contracts”"],
    ["kept", { action: "kept", document_name: "Meridian Mutual NDA", policy_name: "Expired contracts", actor_name: "Jonas Weber" },
      "Kept **Meridian Mutual NDA** under “Expired contracts”, kept by Jonas Weber"],
    ["un-archive", { action: "unarchived", document_name: "Invoice INV-0412", policy_name: "Finance invoices" },
      "Un-archived **Invoice INV-0412**. “Finance invoices” skips it until the policy or the document changes"],
    ["hold placed", { action: "hold_placed", hold_name: "Halvorsen v. Halden & Co.", detail: { documents: 2, folders: 1 } },
      "Placed legal hold **Halvorsen v. Halden & Co.** on 2 documents and 1 folder"],
    ["hold extended", { action: "hold_extended", hold_name: "Kessler dispute", detail: { documents: 1, folders: 0 } },
      "Added 1 document and 0 folders to legal hold **Kessler dispute**"],
    ["hold released", { action: "hold_released", hold_name: "2024 tax audit", detail: { released_count: 6 } },
      "Released legal hold **2024 tax audit** (6 documents no longer held)"],
    ["policy saved", { action: "policy_saved", policy_name: "Finance invoices" }, "Saved policy **Finance invoices**"],
    ["policy removed", { action: "policy_deleted", policy_name: "Old rule" }, "Removed policy **Old rule**"],
    ["dry run", { action: "dry_run", written: false, policy_name: "Expired contracts", detail: { action: "delete", counts: { act: 4, hold: 2, undecidable: 1 } } },
      "Ran a dry run of **Expired contracts**: 4 would be deleted, 2 held, 1 undecidable"],
    // 275-05 G-4 FAIL-1: this row rendered as the raw key `delete_refused`.
    ["delete refused by hold", { action: "delete_refused", document_name: "g4-hold-1.txt", hold_name: "275 G4 matter" },
      "Refused to delete **g4-hold-1.txt**: on legal hold"],
  ]
  for (const [label, over, sentence] of cases) {
    it(label, () => {
      expect(receiptSentence(row(over))).toBe(sentence)
    })
  }

  it("a late-hold drop says why, and since when", () => {
    const s = receiptSentence(
      row({ action: "did_not_delete", document_name: "Kessler Services Agreement", detail: { reason: "held", held_since: "2026-10-12T10:42:00Z" } }),
    )
    expect(s).toBe(`Did not delete **Kessler Services Agreement**: put on legal hold after the sweep (on hold since ${dt("2026-10-12T10:42:00Z")})`)
  })

  // 275 G-4 re-look OBS-R2a: a document moved before confirm rendered "Did not delete not recorded"
  // — no name and no reason. Every recorded reason gets its own words; a nameless row never reads as a date.
  it("a drop because the document changed says so", () => {
    expect(receiptSentence(row({ action: "did_not_delete", document_name: "rl-life-b.txt", detail: { reason: "changed" } })))
      .toBe("Did not delete **rl-life-b.txt**: changed since the sweep")
  })

  it("a drop because the document is no longer waiting says so", () => {
    expect(receiptSentence(row({ action: "did_not_delete", document_name: "rl-life-b.txt", detail: { reason: "not_found" } })))
      .toBe("Did not delete **rl-life-b.txt**: no longer waiting")
  })

  it("a drop with no recorded name never reads 'not recorded'", () => {
    const s = receiptSentence(row({ action: "did_not_delete", document_name: null, detail: { reason: "changed" } }))
    expect(s).toBe("Did not delete **a document that no longer exists**: changed since the sweep")
    expect(s).not.toContain("not recorded")
  })
})

describe("RetentionHistory — the ledger (062-A)", () => {
  it("newest first as sent; ✎ only on writes; stored names are never links; the actor is never blank", async () => {
    m.listHistory.mockResolvedValue({
      offset: 0,
      has_more: false,
      rows: [
        row({ action: "deleted", document_name: "Brightwater Office Lease", policy_name: "Expired contracts", actor_name: "a former member", created_at: "2026-10-12T10:44:00Z" }),
        row({ action: "dry_run", written: false, policy_name: "Expired contracts", actor_name: "Amira Sato", detail: { action: "delete", counts: { act: 4, hold: 2, undecidable: 1 } } }),
      ],
    })
    render(<RetentionHistory />)
    const rows = await screen.findAllByTestId("history-row")
    expect(rows[0]).toHaveTextContent("Deleted Brightwater Office Lease under “Expired contracts”, approved by a former member")
    expect(rows[0]).toHaveTextContent(`${dt("2026-10-12T10:44:00Z")} · a former member`)
    expect(within(rows[0]).getByTestId("write-mark")).toHaveTextContent("✎")
    expect(within(rows[1]).getByTestId("write-mark")).toHaveTextContent("")
    expect(within(rows[1]).getByTestId("write-mark").textContent).toBe("")
    expect(screen.queryAllByRole("link")).toHaveLength(0)
    expect(m.listHistory).toHaveBeenCalledWith(0, 50)
  })

  it("Show older reads the NEXT page and appends it", async () => {
    m.listHistory
      .mockResolvedValueOnce({ offset: 0, has_more: true, rows: [row({ document_name: "A", policy_name: "P" })] })
      .mockResolvedValueOnce({ offset: 1, has_more: false, rows: [row({ document_name: "B", policy_name: "P" })] })
    render(<RetentionHistory />)
    await screen.findByText("A")
    await userEvent.click(screen.getByRole("button", { name: "Show older" }))
    await waitFor(() => expect(screen.getAllByTestId("history-row")).toHaveLength(2))
    expect(m.listHistory).toHaveBeenLastCalledWith(1, 50)
    expect(screen.queryByRole("button", { name: "Show older" })).toBeNull()
  })

  it("275-REVIEW F-WR-12: receipts written meanwhile never show a row twice, and the next page continues past them", async () => {
    const a = row({ document_name: "A", policy_name: "P" })
    const b = row({ document_name: "B", policy_name: "P" })
    const c = row({ document_name: "C", policy_name: "P" })
    const d = row({ document_name: "D", policy_name: "P" })
    // Page 1 = [A, B]. Then ONE new receipt lands at the top, so offset 2 now starts at B again.
    m.listHistory
      .mockResolvedValueOnce({ offset: 0, has_more: true, rows: [a, b] })
      .mockResolvedValueOnce({ offset: 2, has_more: true, rows: [b, c] })
      .mockResolvedValueOnce({ offset: 4, has_more: false, rows: [d] })
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})
    render(<RetentionHistory />)
    await screen.findByText("A")
    await userEvent.click(screen.getByRole("button", { name: "Show older" }))
    await waitFor(() => expect(screen.getAllByTestId("history-row")).toHaveLength(3))
    expect(screen.getAllByText("B")).toHaveLength(1)
    await userEvent.click(screen.getByRole("button", { name: "Show older" }))
    await waitFor(() => expect(screen.getAllByTestId("history-row")).toHaveLength(4))
    // The cursor advances by what the SERVER returned (2 + 2), never by the de-duplicated count.
    expect(m.listHistory).toHaveBeenLastCalledWith(4, 50)
    expect(errors.mock.calls.flat().join(" ")).not.toMatch(/same key/)
    errors.mockRestore()
  })

  it("the empty ledger", async () => {
    m.listHistory.mockResolvedValue({ offset: 0, has_more: false, rows: [] })
    render(<RetentionHistory />)
    expect(
      await screen.findByText("No retention actions yet. Every archive, delete, hold and policy change will be listed here."),
    ).toBeInTheDocument()
  })
})
