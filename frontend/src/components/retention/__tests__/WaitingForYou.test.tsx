/**
 * Phase 275 plan 04 Task 2 (S4 / D-03 / D-10 / D-11 / T-275-31) — Waiting for you: delete batches
 * confirmed by typing the count, and review batches decided per row.
 *
 * Each case prices a lived failure:
 *   · a destructive button that works before the count is typed, or keeps an old count after the
 *     person changed what is ticked (accidental mass delete);
 *   · an untick that silently does nothing, or a keep that needs a typed count;
 *   · a review row pre-decided for the person (D-10);
 *   · a late hold that drops a document without saying so; a failure that hides partial work.
 * Assertions read RENDERED WORDS and the exact confirm body sent.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { ConfirmResult, QueueBatch, QueueList } from "@/lib/api/retention"
import { ApiRefusal } from "@/lib/api/refusal"

const m = vi.hoisted(() => ({ listQueue: vi.fn(), confirmBatch: vi.fn() }))

vi.mock("@/lib/api/retention", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/retention")>()
  return { ...actual, listQueue: m.listQueue, confirmBatch: m.confirmBatch }
})

import { WaitingForYou } from "../WaitingForYou"
import { DeleteBatchCard } from "../DeleteBatchCard"

const DELETE_BATCH: QueueBatch = {
  policy_id: "p-del", policy_name: "Expired contracts", kind: "delete",
  scope_text: "All documents in /Contracts/Expired (and subfolders)", kept_for_text: "10 years after the document date",
  found_at: "2026-10-12T02:00:00Z",
  rows: [
    { document_id: "c1", name: "Brightwater Office Lease", folder_path: "/Contracts/Expired", document_date: "2013-06-18", due_since: "2023-06-18", kind: "delete" },
    { document_id: "c2", name: "Kessler Services Agreement", folder_path: "/Contracts/Expired", document_date: "2014-09-30", due_since: "2024-09-30", kind: "delete" },
    { document_id: "c3", name: "Olsen Consulting SOW", folder_path: "/Contracts/Expired", document_date: "2015-01-12", due_since: "2025-01-12", kind: "delete" },
  ],
  held: [{ name: "Halvorsen Supply Agreement", why: "Halvorsen v. Halden & Co." }],
  undecidable: [{ name: "Fjord Logistics MSA", why: "no document date" }],
}

const REVIEW_BATCH: QueueBatch = {
  policy_id: "p-rev", policy_name: "Personnel records", kind: "review",
  scope_text: "Personnel records anywhere", kept_for_text: "6 years after the document date",
  found_at: "2026-10-11T02:00:00Z",
  rows: [
    { document_id: "h1", name: "Personnel file — E. Lindqvist", folder_path: "/HR/Personnel", document_date: "2014-02-01", due_since: "2020-02-01", kind: "review" },
    { document_id: "h3", name: "Personnel file — T. Brandt", folder_path: "/HR/Personnel", document_date: "2016-04-11", due_since: "2022-04-11", kind: "review" },
  ],
  held: [],
  undecidable: [],
}

const EMPTY_RESULT: ConfirmResult = { deleted: [], did_not_delete: [], kept: [], archived: [], not_found: [], skipped: [] }

beforeEach(() => {
  vi.clearAllMocks()
  m.listQueue.mockResolvedValue({ batches: [REVIEW_BATCH, DELETE_BATCH], total: 5 } satisfies QueueList)
})

const deleteCard = async () => screen.findByTestId("delete-batch")
const reviewCard = async () => screen.findByTestId("review-batch")

describe("WaitingForYou — the list", () => {
  it("one card per policy, newest sweep first; the crumb; the skipped and re-check notes", async () => {
    render(<WaitingForYou />)
    const cards = await screen.findAllByRole("article")
    expect(cards[0]).toHaveAttribute("data-testid", "delete-batch") // 12 Oct before 11 Oct
    expect(cards[1]).toHaveAttribute("data-testid", "review-batch")
    expect(screen.getByText("Retention › Waiting for you")).toBeInTheDocument()
    const card = cards[0]
    expect(card).toHaveTextContent("Delete · needs approval")
    expect(card).toHaveTextContent("Expired contracts")
    expect(card).toHaveTextContent(
      "Not in this list: 1 on legal hold (Halvorsen Supply Agreement) · 1 that can't be decided (Fjord Logistics MSA — no document date). Those are never deleted.",
    )
    expect(card).toHaveTextContent(
      "Every document is checked again at the moment you confirm. Anything put on hold, moved or edited since the sweep is dropped, not deleted.",
    )
    expect(card).toHaveTextContent("All documents in /Contracts/Expired (and subfolders) · kept 10 years after the document date · found by the sweep on")
  })

  it("empty: 'Nothing is waiting for approval.'", async () => {
    m.listQueue.mockResolvedValue({ batches: [], total: 0 })
    render(<WaitingForYou />)
    expect(await screen.findByText("Nothing is waiting for approval.")).toBeInTheDocument()
  })

  it("reports the live waiting count to the tab", async () => {
    const onCountChange = vi.fn()
    render(<WaitingForYou onCountChange={onCountChange} />)
    await waitFor(() => expect(onCountChange).toHaveBeenCalledWith(5))
  })
})

describe("DeleteBatchCard — type the count (D-03 / T-275-31)", () => {
  it("every row starts ticked; the button is disabled until the typed value equals N", async () => {
    render(<WaitingForYou />)
    const card = await deleteCard()
    for (const cb of within(card).getAllByRole("checkbox")) expect(cb).toBeChecked()
    const button = within(card).getByRole("button", { name: "Delete 3 documents permanently" })
    expect(button).toBeDisabled()
    const input = within(card).getByRole("textbox", { name: "Type 3 to confirm" })
    expect(input).toHaveAttribute("inputmode", "numeric")
    expect(card).toHaveTextContent("This can't be undone. Type 3 to confirm.")
    const describedBy = document.getElementById(input.getAttribute("aria-describedby") ?? "")
    expect(describedBy).toHaveTextContent("This can't be undone.")
    await userEvent.type(input, "2")
    expect(button).toBeDisabled()
    await userEvent.clear(input)
    await userEvent.type(input, "3")
    expect(button).toBeEnabled()
  })

  it("unticking strikes the row, shows the D-11 note and CLEARS the typed count", async () => {
    render(<WaitingForYou />)
    const card = await deleteCard()
    const input = within(card).getByRole("textbox", { name: "Type 3 to confirm" })
    await userEvent.type(input, "3")
    await userEvent.click(within(card).getByRole("checkbox", { name: "Kessler Services Agreement" }))
    const row = within(card).getByText("Kessler Services Agreement").closest("tr") as HTMLElement
    expect(row.className).toContain("line-through")
    expect(card).toHaveTextContent(
      "Unticked documents are kept. They are not proposed again unless the policy is edited or the document changes.",
    )
    const input2 = within(card).getByRole("textbox", { name: "Type 2 to confirm" })
    expect(input2).toHaveValue("")
    expect(within(card).getByRole("button", { name: "Delete 2 documents permanently" })).toBeDisabled()
  })

  it("Enter submits only when enabled; the body sends ticked as deletes and unticked as keeps", async () => {
    m.confirmBatch.mockResolvedValue({ ...EMPTY_RESULT, deleted: [{ document_id: "c1", name: "Brightwater Office Lease" }, { document_id: "c3", name: "Olsen Consulting SOW" }] })
    const onRecorded = vi.fn()
    render(<WaitingForYou onRecorded={onRecorded} />)
    const card = await deleteCard()
    await userEvent.click(within(card).getByRole("checkbox", { name: "Kessler Services Agreement" }))
    const input = within(card).getByRole("textbox", { name: "Type 2 to confirm" })
    await userEvent.type(input, "1{Enter}")
    expect(m.confirmBatch).not.toHaveBeenCalled()
    await userEvent.clear(input)
    await userEvent.type(input, "2{Enter}")
    await waitFor(() =>
      expect(m.confirmBatch).toHaveBeenCalledWith("p-del", {
        delete_ids: ["c1", "c3"], keep_ids: ["c2"], archive_ids: [], typed_count: 2,
      }),
    )
    const banner = await screen.findByRole("status")
    expect(within(banner).getByText("Done")).toBeInTheDocument()
    expect(banner).toHaveTextContent(
      "Deleted 2 documents. One audit record per document names the document, the policy, the action, who approved it and when.",
    )
    expect(banner).toHaveFocus()
    expect(onRecorded).toHaveBeenCalledTimes(1)
  })

  it("names a late-hold drop in amber in the result banner", async () => {
    m.confirmBatch.mockResolvedValue({
      ...EMPTY_RESULT,
      deleted: [{ document_id: "c1", name: "Brightwater Office Lease" }, { document_id: "c3", name: "Olsen Consulting SOW" }],
      did_not_delete: [{ document_id: "c2", name: "Kessler Services Agreement", reason: "held", held_since: "2026-10-12T10:42:00Z" }],
    })
    render(<WaitingForYou />)
    const card = await deleteCard()
    await userEvent.type(within(card).getByRole("textbox", { name: "Type 3 to confirm" }), "3")
    await userEvent.click(within(card).getByRole("button", { name: "Delete 3 documents permanently" }))
    const banner = await screen.findByRole("status")
    expect(banner).toHaveTextContent(
      "Deleted 2 documents. Kept 1: Kessler Services Agreement went on legal hold after the sweep, so it was dropped at confirm.",
    )
  })

  it("275-REVIEW F-WR-03: the banner accounts for EVERY approved document — changed, gone, failed, and unremoved files", async () => {
    m.confirmBatch.mockResolvedValue({
      ...EMPTY_RESULT,
      deleted: [{ document_id: "c1", name: "Brightwater Office Lease" }],
      did_not_delete: [{ document_id: "c2", name: "Kessler Services Agreement", reason: "changed", held_since: null }],
      not_found: [{ document_id: "c3" }], // the server sends no name here: the card's row names it
      failed: [{ document_id: "c4", name: "Nordic Freight Contract", decision: "delete", error: "PostgresError" }],
      bytes_not_removed: ["org/u/brightwater.pdf"],
    })
    render(<WaitingForYou />)
    const card = await deleteCard()
    await userEvent.type(within(card).getByRole("textbox", { name: "Type 3 to confirm" }), "3")
    await userEvent.click(within(card).getByRole("button", { name: "Delete 3 documents permanently" }))
    const banner = await screen.findByRole("status")
    expect(within(banner).getByText("Done")).toBeInTheDocument()
    expect(banner).toHaveTextContent("Deleted 1 document.")
    expect(banner).toHaveTextContent("Not done, changed since the sweep: Kessler Services Agreement.")
    expect(banner).toHaveTextContent("Not done, no longer waiting: Olsen Consulting SOW.")
    expect(banner).toHaveTextContent(
      "Couldn't finish, so these are still waiting: Nordic Freight Contract. Nothing was changed for them.",
    )
    expect(banner).toHaveTextContent("1 stored file of the deleted documents could not be removed.")
  })

  it("275-REVIEW F-WR-03: when every approved action was dropped there is no green Done and no 'Deleted 0'", async () => {
    m.confirmBatch.mockResolvedValue({
      ...EMPTY_RESULT,
      did_not_delete: [
        { document_id: "c1", name: "Brightwater Office Lease", reason: "changed", held_since: null },
        { document_id: "c2", name: "Kessler Services Agreement", reason: "changed", held_since: null },
        { document_id: "c3", name: "Olsen Consulting SOW", reason: "held", held_since: "2026-10-12T10:42:00Z" },
      ],
    })
    render(<WaitingForYou />)
    const card = await deleteCard()
    await userEvent.type(within(card).getByRole("textbox", { name: "Type 3 to confirm" }), "3")
    await userEvent.click(within(card).getByRole("button", { name: "Delete 3 documents permanently" }))
    const banner = await screen.findByRole("status")
    expect(within(banner).queryByText("Done")).toBeNull()
    expect(within(banner).getByText("Nothing done")).toBeInTheDocument()
    expect(banner).not.toHaveTextContent("Deleted 0")
    expect(banner.className).not.toContain("bg-success")
    expect(banner).toHaveTextContent("Not done, changed since the sweep: Brightwater Office Lease, Kessler Services Agreement.")
    expect(banner).toHaveTextContent("Kept 1: Olsen Consulting SOW went on legal hold after the sweep, so it was dropped at confirm.")
  })

  it("every row unticked → 'Keep 3 documents' (outline), no count needed; keeps all", async () => {
    m.confirmBatch.mockResolvedValue({ ...EMPTY_RESULT, kept: [{ document_id: "c1" }, { document_id: "c2" }, { document_id: "c3" }] })
    render(<WaitingForYou />)
    const card = await deleteCard()
    for (const cb of within(card).getAllByRole("checkbox")) await userEvent.click(cb)
    expect(within(card).queryByRole("textbox")).toBeNull()
    const keep = within(card).getByRole("button", { name: "Keep 3 documents" })
    expect(keep.className).not.toMatch(/bg-destructive/)
    await userEvent.click(keep)
    await waitFor(() =>
      expect(m.confirmBatch).toHaveBeenCalledWith("p-del", {
        delete_ids: [], keep_ids: ["c1", "c2", "c3"], archive_ids: [], typed_count: 0,
      }),
    )
    expect(await screen.findByRole("status")).toHaveTextContent("Kept 3 documents.")
  })

  it("confirm failure is honest about partial work and offers Reload", async () => {
    m.confirmBatch.mockRejectedValue(new Error("x"))
    render(<WaitingForYou />)
    const card = await deleteCard()
    await userEvent.type(within(card).getByRole("textbox", { name: "Type 3 to confirm" }), "3")
    await userEvent.click(within(card).getByRole("button", { name: "Delete 3 documents permanently" }))
    const alert = await within(card).findByRole("alert")
    expect(alert).toHaveTextContent(
      "Couldn't confirm the batch. Some documents may already be deleted. History shows exactly which. Reload this list before trying again.",
    )
    await userEvent.click(within(alert).getByRole("button", { name: "Reload" }))
    await waitFor(() => expect(m.listQueue).toHaveBeenCalledTimes(2))
  })

  it.each([
    [422, "Type 3 to confirm.", "Type 3 to confirm. Nothing was deleted, archived or kept."],
    [404, "That policy no longer exists.", "That policy no longer exists. Nothing was deleted, archived or kept."],
    [
      503,
      "Couldn't read every document in this organization, so nothing can be decided right now. Nothing was changed.",
      "Couldn't read every document in this organization, so nothing can be decided right now. Nothing was changed.",
    ],
  ])("275-REVIEW F-WR-01: a pre-write refusal (%i) renders the server's sentence — never 'may already be deleted'", async (status, sentence, shown) => {
    m.confirmBatch.mockRejectedValue(new ApiRefusal(status, "", sentence))
    render(<WaitingForYou />)
    const card = await deleteCard()
    await userEvent.type(within(card).getByRole("textbox", { name: "Type 3 to confirm" }), "3")
    await userEvent.click(within(card).getByRole("button", { name: "Delete 3 documents permanently" }))
    const alert = await within(card).findByRole("alert")
    expect(alert.textContent).toBe(`${shown}Reload`)
    expect(alert).not.toHaveTextContent("Some documents may already be deleted")
  })

  it("275-REVIEW F-WR-01: a 5xx where the server said nothing keeps the honest partial-work copy", async () => {
    m.confirmBatch.mockRejectedValue(new ApiRefusal(500, "", "Couldn't confirm the batch."))
    render(<WaitingForYou />)
    const card = await deleteCard()
    await userEvent.type(within(card).getByRole("textbox", { name: "Type 3 to confirm" }), "3")
    await userEvent.click(within(card).getByRole("button", { name: "Delete 3 documents permanently" }))
    expect(await within(card).findByRole("alert")).toHaveTextContent("Some documents may already be deleted.")
  })

  it("keep failure keeps the rows unticked and says nothing was kept", async () => {
    m.confirmBatch.mockRejectedValue(new Error("x"))
    render(<WaitingForYou />)
    const card = await deleteCard()
    for (const cb of within(card).getAllByRole("checkbox")) await userEvent.click(cb)
    await userEvent.click(within(card).getByRole("button", { name: "Keep 3 documents" }))
    expect(await within(card).findByRole("alert")).toHaveTextContent(
      "Couldn't record your decisions. Nothing was archived or kept. Reload this list before trying again.",
    )
    for (const cb of within(card).getAllByRole("checkbox")) expect(cb).not.toBeChecked()
  })
})

describe("275-REVIEW F-CR-01 — Reload never pre-unticks a row the admin did not see", () => {
  it("a row that appears on Reload starts TICKED and is never sent as keep_ids", async () => {
    // First read: c1-c3. The confirm fails, the admin presses Reload, and the sweep has meanwhile
    // replaced the list with ONE new row (c4). The second read is held open so the remount timing
    // is observable.
    let resolveSecond: (q: QueueList) => void = () => {}
    m.listQueue
      .mockResolvedValueOnce({ batches: [DELETE_BATCH], total: 3 } satisfies QueueList)
      .mockImplementationOnce(() => new Promise<QueueList>((r) => { resolveSecond = r }))
    m.confirmBatch.mockRejectedValueOnce(new Error("x"))
    render(<WaitingForYou />)
    const card = await deleteCard()
    await userEvent.type(within(card).getByRole("textbox", { name: "Type 3 to confirm" }), "3")
    await userEvent.click(within(card).getByRole("button", { name: "Delete 3 documents permanently" }))
    await userEvent.click(within(await within(card).findByRole("alert")).getByRole("button", { name: "Reload" }))

    resolveSecond({
      batches: [{
        ...DELETE_BATCH,
        rows: [{ document_id: "c4", name: "Nordic Freight Contract", folder_path: "/Contracts/Expired", document_date: "2015-03-01", due_since: "2025-03-01", kind: "delete" }],
      }],
      total: 1,
    })
    const fresh = await screen.findByRole("checkbox", { name: "Nordic Freight Contract" })
    expect(fresh).toBeChecked()
    const card2 = await deleteCard()
    // ⛔ The all-unticked keep path must never be offered for a row nobody unticked.
    expect(within(card2).queryByRole("button", { name: /^Keep/ })).toBeNull()
    expect(card2).not.toHaveTextContent("Unticked documents are kept.")
    m.confirmBatch.mockResolvedValueOnce({ ...EMPTY_RESULT, deleted: [{ document_id: "c4", name: "Nordic Freight Contract" }] })
    await userEvent.type(within(card2).getByRole("textbox", { name: "Type 1 to confirm" }), "1")
    await userEvent.click(within(card2).getByRole("button", { name: "Delete 1 document permanently" }))
    await waitFor(() =>
      expect(m.confirmBatch).toHaveBeenLastCalledWith("p-del", {
        delete_ids: ["c4"], keep_ids: [], archive_ids: [], typed_count: 1,
      }),
    )
  })

  it("DeleteBatchCard: a row added to the batch prop without a remount starts ticked and resets the count", async () => {
    const { rerender } = render(<DeleteBatchCard batch={DELETE_BATCH} onReload={() => {}} />)
    const card = screen.getByTestId("delete-batch")
    await userEvent.click(within(card).getByRole("checkbox", { name: "Kessler Services Agreement" }))
    await userEvent.type(within(card).getByRole("textbox", { name: "Type 2 to confirm" }), "2")
    // c3 leaves, c4 arrives: N stays 2, so a stale typed "2" would arm a delete of an unseen row.
    rerender(
      <DeleteBatchCard
        batch={{
          ...DELETE_BATCH,
          rows: [
            DELETE_BATCH.rows[0],
            DELETE_BATCH.rows[1],
            { document_id: "c4", name: "Nordic Freight Contract", folder_path: "/Contracts/Expired", document_date: "2015-03-01", due_since: "2025-03-01", kind: "delete" },
          ],
        }}
        onReload={() => {}}
      />,
    )
    expect(within(card).getByRole("checkbox", { name: "Nordic Freight Contract" })).toBeChecked()
    expect(within(card).getByRole("checkbox", { name: "Kessler Services Agreement" })).not.toBeChecked()
    expect(within(card).getByRole("textbox", { name: "Type 2 to confirm" })).toHaveValue("")
    expect(within(card).getByRole("button", { name: "Delete 2 documents permanently" })).toBeDisabled()
  })
})

describe("ReviewBatchCard — a person decides each row (D-10)", () => {
  it("nothing is pre-selected; the footer counts; 'Apply {a+b} decisions' with no deletes", async () => {
    m.confirmBatch.mockResolvedValue({ ...EMPTY_RESULT, archived: [{ document_id: "h1" }], kept: [{ document_id: "h3" }] })
    render(<WaitingForYou />)
    const card = await reviewCard()
    expect(card).toHaveTextContent("Review")
    for (const radio of within(card).getAllByRole("radio")) expect(radio).not.toBeChecked()
    expect(within(card).getByTestId("review-footer")).toHaveTextContent("0 to keep · 0 to archive · 0 to delete · 2 undecided")
    expect(within(card).getByRole("button", { name: "Apply 0 decisions" })).toBeDisabled()

    const lind = within(card).getByRole("radiogroup", { name: "Personnel file — E. Lindqvist" })
    const brandt = within(card).getByRole("radiogroup", { name: "Personnel file — T. Brandt" })
    await userEvent.click(within(lind).getByRole("radio", { name: "Archive" }))
    await userEvent.click(within(brandt).getByRole("radio", { name: "Keep" }))
    expect(within(card).getByTestId("review-footer")).toHaveTextContent("1 to keep · 1 to archive · 0 to delete · 0 undecided")
    await userEvent.click(within(card).getByRole("button", { name: "Apply 2 decisions" }))
    await waitFor(() =>
      expect(m.confirmBatch).toHaveBeenCalledWith("p-rev", {
        delete_ids: [], keep_ids: ["h3"], archive_ids: ["h1"], typed_count: 0,
      }),
    )
    expect(await screen.findByRole("status")).toHaveTextContent("Archived 1 document. Kept 1 document.")
  })

  it("a delete decision needs the typed count over the deletes only", async () => {
    m.confirmBatch.mockResolvedValue({ ...EMPTY_RESULT, deleted: [{ document_id: "h1" }] })
    render(<WaitingForYou />)
    const card = await reviewCard()
    const lind = within(card).getByRole("radiogroup", { name: "Personnel file — E. Lindqvist" })
    const brandt = within(card).getByRole("radiogroup", { name: "Personnel file — T. Brandt" })
    await userEvent.click(within(lind).getByRole("radio", { name: "Delete" }))
    await userEvent.click(within(brandt).getByRole("radio", { name: "Keep" }))
    const button = within(card).getByRole("button", { name: "Apply decisions and delete 1 permanently" })
    expect(button).toBeDisabled()
    fireEvent.change(within(card).getByRole("textbox", { name: "Type 1 to confirm" }), { target: { value: "1" } })
    expect(button).toBeEnabled()
    await userEvent.click(button)
    await waitFor(() =>
      expect(m.confirmBatch).toHaveBeenCalledWith("p-rev", {
        delete_ids: ["h1"], keep_ids: ["h3"], archive_ids: [], typed_count: 1,
      }),
    )
  })

  it("275-REVIEW F-WR-01: a review refusal with deletes chosen renders the server's sentence, not 'may already be deleted'", async () => {
    m.confirmBatch.mockRejectedValue(new ApiRefusal(422, "", "A document can have only one decision."))
    render(<WaitingForYou />)
    const card = await reviewCard()
    const lind = within(card).getByRole("radiogroup", { name: "Personnel file — E. Lindqvist" })
    await userEvent.click(within(lind).getByRole("radio", { name: "Delete" }))
    fireEvent.change(within(card).getByRole("textbox", { name: "Type 1 to confirm" }), { target: { value: "1" } })
    await userEvent.click(within(card).getByRole("button", { name: "Apply decisions and delete 1 permanently" }))
    const alert = await within(card).findByRole("alert")
    expect(alert).toHaveTextContent("A document can have only one decision. Nothing was deleted, archived or kept.")
    expect(alert).not.toHaveTextContent("may already be deleted")
  })

  it("a decisions-only failure keeps the choices and uses the decisions copy", async () => {
    m.confirmBatch.mockRejectedValue(new Error("x"))
    render(<WaitingForYou />)
    const card = await reviewCard()
    const lind = within(card).getByRole("radiogroup", { name: "Personnel file — E. Lindqvist" })
    await userEvent.click(within(lind).getByRole("radio", { name: "Archive" }))
    await userEvent.click(within(card).getByRole("button", { name: "Apply 1 decision" }))
    expect(await within(card).findByRole("alert")).toHaveTextContent(
      "Couldn't record your decisions. Nothing was archived or kept. Reload this list before trying again.",
    )
    expect(within(lind).getByRole("radio", { name: "Archive" })).toBeChecked()
  })
})
