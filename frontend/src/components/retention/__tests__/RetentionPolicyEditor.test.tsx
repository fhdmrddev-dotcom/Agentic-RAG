/**
 * Phase 275 plan 04 Task 3 (S2 / D-02 / D-20 / D-22 / D-34 / T-275-32) — the policy editor and its
 * Preview gate.
 *
 * Each case prices a lived failure:
 *   · a Save that works before anyone saw what the policy does, or after they changed it (D-02);
 *   · a server 409 "Preview again before saving." swallowed into a generic failure;
 *   · a save failure that throws the preview away;
 *   · a third "Counted from" clock sneaking back (D-22), or a second stage offered for a delete;
 *   · a folder + type draft the server must refuse (275-03 deviation 4);
 *   · a remove that closes on failure while the policy is still active.
 * Assertions read RENDERED WORDS and the exact draft sent.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { PolicyPreview, RetentionPolicy } from "@/lib/api/retention"
import { ApiRefusal } from "@/lib/api/refusal"
import type { Folder } from "@/types"

const m = vi.hoisted(() => ({
  listDocumentTypes: vi.fn(),
  previewPolicy: vi.fn(),
  createPolicy: vi.fn(),
  updatePolicy: vi.fn(),
  removePolicy: vi.fn(),
}))

vi.mock("@/lib/api/retention", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/retention")>()
  return { ...actual, ...m }
})

const FOLDERS: Folder[] = [
  { id: "f-fin", user_id: "u", name: "Finance", parent_id: null, is_org_shared: true, created_at: "", updated_at: "" },
  { id: "f-inv", user_id: "u", name: "Invoices", parent_id: "f-fin", is_org_shared: true, created_at: "", updated_at: "" },
]
vi.mock("@/hooks/useFolders", () => ({ useFolders: () => ({ folders: FOLDERS }) }))

import { RetentionPolicyEditor } from "../RetentionPolicyEditor"

const PREVIEW: PolicyPreview = {
  draft_hash: "abc", action: "delete", has_stage2: false, counts: { act: 1 }, private_not_covered: 3,
  buckets: {
    act: [{ document_id: "c1", name: "Brightwater Office Lease", due_at: "2023-06-18", kind: "queue_delete", why: "", hold_names: [] }],
    hold: [{ document_id: "c7", name: "Halvorsen Amendment 1", kind: "held", why: "Halvorsen v. Halden & Co.", hold_names: ["Halvorsen v. Halden & Co."] }],
    undecidable: [
      { document_id: "c6", name: "Fjord Logistics MSA", kind: "no_date", why: "no document date", hold_names: [] },
      { document_id: "c9", name: "Ostrava Agreement", kind: "collision", why: "also under “All contracts”", hold_names: [] },
    ],
    kept: [{ document_id: "c5", name: "Meridian Mutual NDA", kind: "kept", why: "", hold_names: [], kept_by: "Amira Sato", kept_at: "2026-10-01T10:00:00Z" }],
    not_yet: [{ document_id: "c8", name: "Ostrava Distribution Agreement", due_at: "2027-05-22", kind: "not_due", why: "", hold_names: [] }],
    already: [],
  },
}

const d = (iso: string) => {
  const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const x = mm ? new Date(Number(mm[1]), Number(mm[2]) - 1, Number(mm[3])) : new Date(iso)
  return x.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

const POLICY: RetentionPolicy = {
  id: "p2", name: "Expired contracts", scope_kind: "class", document_type_norm: "contract", include_subfolders: true,
  clock: "document_date", stage1_value: 10, stage1_unit: "years", stage1_action: "delete", revision: 1,
  scope_text: "Contracts anywhere", kept_for_text: "10 years after the document date", rule_text: "",
}

beforeEach(() => {
  vi.clearAllMocks()
  m.listDocumentTypes.mockResolvedValue([
    { value: "invoice", count: 9 },
    { value: "contract", count: 8 },
  ])
  m.previewPolicy.mockResolvedValue(PREVIEW)
})

const save = () => screen.getByRole("button", { name: "2 · Save policy" })
const preview = () => screen.getByRole("button", { name: "1 · Preview what this would do" })

async function fillValidNew() {
  await userEvent.type(screen.getByLabelText("Name"), "Expired contracts")
  await screen.findByRole("option", { name: "Contract (8)" })
  await userEvent.selectOptions(screen.getByLabelText("Document type"), "contract")
  await userEvent.selectOptions(screen.getByLabelText("Then"), "delete")
}

describe("RetentionPolicyEditor — the form (D-20 / D-22)", () => {
  it("focuses Name on open; Counted from has EXACTLY two clocks; Then has three; units are days/months/years", async () => {
    render(<RetentionPolicyEditor policy={null} onBack={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByLabelText("Name")).toHaveFocus()
    expect(screen.getByText("New policy")).toBeInTheDocument()
    const clocks = within(screen.getByLabelText("Counted from")).getAllByRole("option").map((o) => o.textContent)
    expect(clocks).toEqual(["the document date", "the day it was added to the Library"])
    const thens = within(screen.getByLabelText("Then")).getAllByRole("option").map((o) => o.textContent)
    expect(thens).toEqual(["archive it", "delete it", "ask a person to decide"])
    const units = within(screen.getByRole("combobox", { name: "Keep for" })).getAllByRole("option").map((o) => o.textContent)
    expect(units).toEqual(["days", "months", "years"])
  })

  it("the second stage exists ONLY when Then = archive it (D-20)", async () => {
    render(<RetentionPolicyEditor policy={null} onBack={vi.fn()} onSaved={vi.fn()} />)
    expect(screen.getByLabelText("Then queue it for deletion")).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText("Then"), "review")
    expect(screen.queryByLabelText("Then queue it for deletion")).toBeNull()
  })

  it("one folder OR one type: picking one disables the other with the server's sentence", async () => {
    render(<RetentionPolicyEditor policy={null} onBack={vi.fn()} onSaved={vi.fn()} />)
    await userEvent.selectOptions(screen.getByLabelText("Folder"), "f-inv")
    expect(screen.getByLabelText("Document type")).toBeDisabled()
    expect(screen.getByText("A policy covers one folder or one document type. Make a second policy for the other.")).toBeInTheDocument()
    expect(within(screen.getByLabelText("Folder")).getByRole("option", { name: "/Finance/Invoices" })).toBeInTheDocument()
  })

  it("inline validation and NO preview request for an invalid draft", async () => {
    render(<RetentionPolicyEditor policy={null} onBack={vi.fn()} onSaved={vi.fn()} />)
    await userEvent.click(preview())
    expect(screen.getByText("Give the policy a name.")).toBeInTheDocument()
    expect(screen.getByText("A policy needs a document type, a folder, or both.")).toBeInTheDocument()
    expect(m.previewPolicy).not.toHaveBeenCalled()
  })

  it("a delete step that is not after the archive step is refused inline", async () => {
    render(<RetentionPolicyEditor policy={null} onBack={vi.fn()} onSaved={vi.fn()} />)
    await userEvent.type(screen.getByLabelText("Name"), "Lifecycle")
    await userEvent.selectOptions(screen.getByLabelText("Folder"), "f-fin")
    await userEvent.click(screen.getByLabelText("Then queue it for deletion"))
    // stage 1 = 1 year (default value 1, years); stage 2 = 1 year → not after
    await userEvent.click(preview())
    expect(screen.getByText("The delete step must come after the archive step.")).toBeInTheDocument()
    expect(m.previewPolicy).not.toHaveBeenCalled()
  })

  it("the G-4 LIFECYCLE draft: archive after 1 day, delete after 2 — sent exactly", async () => {
    render(<RetentionPolicyEditor policy={null} onBack={vi.fn()} onSaved={vi.fn()} />)
    await userEvent.type(screen.getByLabelText("Name"), "Lifecycle")
    await userEvent.selectOptions(screen.getByLabelText("Folder"), "f-fin")
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Keep for" }), "days")
    await userEvent.selectOptions(screen.getByLabelText("Counted from"), "date_added")
    await userEvent.click(screen.getByLabelText("Then queue it for deletion"))
    const later = screen.getByRole("spinbutton", { name: "Then queue it for deletion" })
    await userEvent.clear(later)
    await userEvent.type(later, "2")
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Then queue it for deletion after" }), "days")
    expect(screen.getByText("Counted from the same date. Deletion still waits for an org admin to confirm.")).toBeInTheDocument()
    await userEvent.click(preview())
    await waitFor(() =>
      expect(m.previewPolicy).toHaveBeenCalledWith(
        {
          name: "Lifecycle", document_type_norm: null, folder_id: "f-fin", include_subfolders: true, clock: "date_added",
          stage1_value: 1, stage1_unit: "days", stage1_action: "archive", stage2_value: 2, stage2_unit: "days",
        },
        null,
      ),
    )
  })
})

describe("275-REVIEW F-WR-08 — the editor never shows 'Any type/folder' over a stored scope", () => {
  it("a stored type missing from the live list (top 50, zero docs, or a failed load) is still shown", async () => {
    m.listDocumentTypes.mockResolvedValue([{ value: "invoice", count: 9 }])
    render(<RetentionPolicyEditor policy={POLICY} onBack={vi.fn()} onSaved={vi.fn()} />)
    await screen.findByRole("option", { name: "Invoice (9)" })
    const select = screen.getByLabelText("Document type") as HTMLSelectElement
    expect(select).toHaveValue("contract")
    expect(select.selectedOptions[0].textContent).toBe("Contract")
  })

  it("while the type list is still loading, the stored type is what the select shows", () => {
    m.listDocumentTypes.mockImplementation(() => new Promise(() => {}))
    render(<RetentionPolicyEditor policy={POLICY} onBack={vi.fn()} onSaved={vi.fn()} />)
    const select = screen.getByLabelText("Document type") as HTMLSelectElement
    expect(select).toHaveValue("contract")
    expect(select.selectedOptions[0].textContent).not.toBe("Any type")
  })

  it("a stored folder absent from the folder list shows the policy's own folder path", async () => {
    const folderPolicy: RetentionPolicy = {
      ...POLICY, scope_kind: "folder", document_type_norm: null, folder_id: "f-gone", folder_path: "/Archive/Old",
    }
    render(<RetentionPolicyEditor policy={folderPolicy} onBack={vi.fn()} onSaved={vi.fn()} />)
    const select = screen.getByLabelText("Folder") as HTMLSelectElement
    expect(select).toHaveValue("f-gone")
    expect(select.selectedOptions[0].textContent).toBe("/Archive/Old")
  })
})

describe("275-REVIEW F-WR-09 — Keep for is a whole number, never silently coerced", () => {
  it.each(["0", "1.5", "1e2", ""])("'%s' is refused inline and nothing is previewed", async (raw) => {
    render(<RetentionPolicyEditor policy={null} onBack={vi.fn()} onSaved={vi.fn()} />)
    await userEvent.type(screen.getByLabelText("Name"), "Lifecycle")
    await userEvent.selectOptions(screen.getByLabelText("Folder"), "f-fin")
    // Set the raw value as a browser would hold it (`type=number` accepts "1e2" and "1.5").
    fireEvent.change(screen.getByRole("spinbutton", { name: "Keep for" }), { target: { value: raw } })
    expect(screen.getByRole("spinbutton", { name: "Keep for" })).toHaveValue(raw === "" ? null : Number(raw))
    await userEvent.click(preview())
    expect(screen.getByText("Enter a whole number from 1 to 10000.")).toBeInTheDocument()
    expect(m.previewPolicy).not.toHaveBeenCalled()
  })

  it("the second stage's number is held to the same rule", async () => {
    render(<RetentionPolicyEditor policy={null} onBack={vi.fn()} onSaved={vi.fn()} />)
    await userEvent.type(screen.getByLabelText("Name"), "Lifecycle")
    await userEvent.selectOptions(screen.getByLabelText("Folder"), "f-fin")
    await userEvent.click(screen.getByLabelText("Then queue it for deletion"))
    const later = screen.getByRole("spinbutton", { name: "Then queue it for deletion" })
    await userEvent.clear(later)
    await userEvent.type(later, "2.5")
    await userEvent.click(preview())
    expect(screen.getByText("Enter a whole number from 1 to 10000.")).toBeInTheDocument()
    expect(m.previewPolicy).not.toHaveBeenCalled()
  })

  it("a whole number is sent exactly as typed", async () => {
    render(<RetentionPolicyEditor policy={null} onBack={vi.fn()} onSaved={vi.fn()} />)
    await userEvent.type(screen.getByLabelText("Name"), "Lifecycle")
    await userEvent.selectOptions(screen.getByLabelText("Folder"), "f-fin")
    const keep = screen.getByRole("spinbutton", { name: "Keep for" })
    await userEvent.clear(keep)
    await userEvent.type(keep, "12")
    await userEvent.click(preview())
    await waitFor(() => expect(m.previewPolicy).toHaveBeenCalledWith(expect.objectContaining({ stage1_value: 12 }), null))
  })
})

describe("RetentionPolicyEditor — the Preview gate (D-02 / T-275-32)", () => {
  it("Save is aria-disabled with its reason ON SCREEN until a Preview has run; clicking it sends nothing", async () => {
    render(<RetentionPolicyEditor policy={null} onBack={vi.fn()} onSaved={vi.fn()} />)
    expect(save()).toHaveAttribute("aria-disabled", "true")
    const reason = document.getElementById(save().getAttribute("aria-describedby") ?? "")
    expect(reason).toHaveTextContent("Preview first. A policy can't be saved until you've seen what it would do.")
    expect(screen.getByText("Nothing previewed yet.")).toBeInTheDocument()
    await userEvent.click(save())
    expect(m.createPolicy).not.toHaveBeenCalled()
  })

  it("Preview unlocks Save and renders the server's buckets, notes and the D-34 private count", async () => {
    render(<RetentionPolicyEditor policy={null} onBack={vi.fn()} onSaved={vi.fn()} />)
    await fillValidNew()
    await userEvent.click(preview())
    await waitFor(() => expect(save()).toHaveAttribute("aria-disabled", "false"))
    expect(screen.queryByText("Preview first. A policy can't be saved until you've seen what it would do.")).toBeNull()
    expect(screen.getByTestId("bucket-act")).toHaveTextContent("1would be queued for you to approve deletion")
    expect(screen.getByTestId("bucket-act")).toHaveTextContent(`Brightwater Office Lease · due ${d("2023-06-18")}`)
    expect(screen.getByTestId("bucket-act")).toHaveAttribute("open")
    expect(screen.getByTestId("bucket-hold")).toHaveTextContent("skipped — on legal hold")
    expect(screen.getByTestId("bucket-hold")).toHaveTextContent("Halvorsen Amendment 1 · Halvorsen v. Halden & Co.")
    expect(screen.getByTestId("bucket-undecidable")).toHaveTextContent("2can't be decided — nothing will happen to them")
    expect(screen.getByTestId("bucket-undecidable")).toHaveTextContent("Ostrava Agreement · also under “All contracts”")
    expect(screen.getByText(/Give these a document date, or count from “added to the Library” instead\./)).toBeInTheDocument()
    expect(screen.getByText(/A document under two policies that disagree is never touched: change one of them\./)).toBeInTheDocument()
    expect(screen.getByTestId("bucket-kept")).toHaveTextContent("kept by an admin — skipped until this policy or the document changes")
    expect(screen.getByTestId("bucket-kept")).toHaveTextContent(`Meridian Mutual NDA · kept by Amira Sato on ${d("2026-10-01T10:00:00Z")}`)
    expect(screen.getByTestId("bucket-not-yet")).toHaveTextContent(`not due yet · next: Ostrava Distribution Agreement, ${d("2027-05-22")}`)
    expect(screen.getByTestId("private-not-covered")).toHaveTextContent("3 private documents are not covered")
    expect(screen.getByText("Deletes never run on their own. Tonight's sweep lists what is due, and an org admin confirms each document by name.")).toBeInTheDocument()
  })

  it("an edit after Preview marks it stale and RE-LOCKS Save", async () => {
    render(<RetentionPolicyEditor policy={null} onBack={vi.fn()} onSaved={vi.fn()} />)
    await fillValidNew()
    await userEvent.click(preview())
    await waitFor(() => expect(save()).toHaveAttribute("aria-disabled", "false"))
    await userEvent.type(screen.getByLabelText("Name"), " v2")
    expect(screen.getByText("You changed the policy after the preview. Preview again before saving.")).toBeInTheDocument()
    expect(save()).toHaveAttribute("aria-disabled", "true")
    await userEvent.click(save())
    expect(m.createPolicy).not.toHaveBeenCalled()
  })

  it("a Preview that could not finish keeps Save locked and says nothing changed", async () => {
    m.previewPolicy.mockRejectedValue(new ApiRefusal(503, "", "incomplete"))
    render(<RetentionPolicyEditor policy={null} onBack={vi.fn()} onSaved={vi.fn()} />)
    await fillValidNew()
    await userEvent.click(preview())
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Preview couldn't finish, so this policy can't be saved yet. Nothing was changed.",
    )
    expect(save()).toHaveAttribute("aria-disabled", "true")
  })

  it("Save sends the previewed draft and reports the write", async () => {
    m.createPolicy.mockResolvedValue({ ...POLICY })
    const onSaved = vi.fn()
    render(<RetentionPolicyEditor policy={null} onBack={vi.fn()} onSaved={onSaved} />)
    await fillValidNew()
    await userEvent.click(preview())
    await waitFor(() => expect(save()).toHaveAttribute("aria-disabled", "false"))
    await userEvent.click(save())
    await waitFor(() =>
      expect(m.createPolicy).toHaveBeenCalledWith({
        name: "Expired contracts", document_type_norm: "contract", folder_id: null, include_subfolders: true,
        clock: "document_date", stage1_value: 1, stage1_unit: "years", stage1_action: "delete",
        stage2_value: null, stage2_unit: null,
      }),
    )
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it("a save failure keeps the preview AND keeps Save unlocked (nothing was edited)", async () => {
    m.createPolicy.mockRejectedValue(new ApiRefusal(500, "", "boom"))
    render(<RetentionPolicyEditor policy={null} onBack={vi.fn()} onSaved={vi.fn()} />)
    await fillValidNew()
    await userEvent.click(preview())
    await waitFor(() => expect(save()).toHaveAttribute("aria-disabled", "false"))
    await userEvent.click(save())
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the policy. Nothing changed. Your preview is still here.")
    expect(screen.getByTestId("bucket-act")).toBeInTheDocument()
    expect(save()).toHaveAttribute("aria-disabled", "false")
  })

  it("275-REVIEW IN-01: the locked Save LOOKS locked, and the 'Preview first' reason is not shown while saving", async () => {
    render(<RetentionPolicyEditor policy={null} onBack={vi.fn()} onSaved={vi.fn()} />)
    expect(save().className).toContain("aria-disabled:opacity-50")
    m.createPolicy.mockImplementation(() => new Promise(() => {}))
    await fillValidNew()
    await userEvent.click(preview())
    await waitFor(() => expect(save()).toHaveAttribute("aria-disabled", "false"))
    await userEvent.click(save())
    await waitFor(() => expect(save()).toHaveAttribute("aria-disabled", "true"))
    expect(screen.queryByText("Preview first. A policy can't be saved until you've seen what it would do.")).toBeNull()
  })

  it("the server's 409 'Preview again before saving.' is RENDERED and re-locks Save", async () => {
    m.createPolicy.mockRejectedValue(new ApiRefusal(409, "", "Preview again before saving."))
    render(<RetentionPolicyEditor policy={null} onBack={vi.fn()} onSaved={vi.fn()} />)
    await fillValidNew()
    await userEvent.click(preview())
    await waitFor(() => expect(save()).toHaveAttribute("aria-disabled", "false"))
    await userEvent.click(save())
    expect(await screen.findByRole("alert")).toHaveTextContent("Preview again before saving.")
    expect(save()).toHaveAttribute("aria-disabled", "true")
  })
})

describe("RetentionPolicyEditor — edit and remove", () => {
  it("edit mode previews with the policy id and saves through PUT", async () => {
    m.updatePolicy.mockResolvedValue({ ...POLICY })
    const onSaved = vi.fn()
    render(<RetentionPolicyEditor policy={POLICY} onBack={vi.fn()} onSaved={onSaved} />)
    expect(screen.getByText("Edit “Expired contracts”")).toBeInTheDocument()
    expect(screen.getByLabelText("Name")).toHaveValue("Expired contracts")
    await screen.findByRole("option", { name: "Contract (8)" })
    expect(screen.getByLabelText("Document type")).toHaveValue("contract")
    await userEvent.click(preview())
    await waitFor(() => expect(m.previewPolicy).toHaveBeenCalledWith(expect.objectContaining({ name: "Expired contracts" }), "p2"))
    await waitFor(() => expect(save()).toHaveAttribute("aria-disabled", "false"))
    await userEvent.click(save())
    await waitFor(() => expect(m.updatePolicy).toHaveBeenCalledWith("p2", expect.objectContaining({ stage1_value: 10 })))
    expect(onSaved).toHaveBeenCalled()
  })

  it("Remove policy…: a plain confirm, Keep policy focused, outline (not red); a failure keeps it open", async () => {
    m.removePolicy.mockRejectedValue(new Error("x"))
    render(<RetentionPolicyEditor policy={POLICY} onBack={vi.fn()} onSaved={vi.fn()} />)
    await userEvent.click(screen.getByRole("button", { name: "Remove policy…" }))
    const sheet = await screen.findByRole("alertdialog")
    expect(within(sheet).getByText("Remove “Expired contracts”?")).toBeInTheDocument()
    expect(sheet).toHaveTextContent(
      "No documents are deleted. Documents it already archived stay archived, and anything it queued leaves “Waiting for you”.",
    )
    await waitFor(() => expect(within(sheet).getByRole("button", { name: "Keep policy" })).toHaveFocus())
    const remove = within(sheet).getByRole("button", { name: "Remove policy" })
    expect(remove.className).not.toMatch(/bg-destructive/)
    await userEvent.click(remove)
    expect(await within(sheet).findByRole("alert")).toHaveTextContent("Couldn't remove the policy. It is still active.")
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  })

  it("275-REVIEW F-CR-02: an already-removed policy (404) says so and goes back to a fresh list — never 'still active'", async () => {
    m.removePolicy.mockRejectedValue(new ApiRefusal(404, "", "Policy not found."))
    const onSaved = vi.fn()
    const onGone = vi.fn()
    render(<RetentionPolicyEditor policy={POLICY} onBack={vi.fn()} onSaved={onSaved} onGone={onGone} />)
    await userEvent.click(screen.getByRole("button", { name: "Remove policy…" }))
    const sheet = await screen.findByRole("alertdialog")
    await userEvent.click(within(sheet).getByRole("button", { name: "Remove policy" }))
    const alert = await within(sheet).findByRole("alert")
    expect(alert).toHaveTextContent("This policy was already removed. Nothing changed.")
    expect(sheet).not.toHaveTextContent("It is still active.")
    expect(within(sheet).queryByRole("button", { name: "Remove policy" })).toBeNull()
    await userEvent.click(within(sheet).getByRole("button", { name: "Back to policies" }))
    expect(onGone).toHaveBeenCalledTimes(1) // the list re-reads; no band pulse — nothing was recorded
    expect(onSaved).not.toHaveBeenCalled()
  })

  it("275-REVIEW IN-10: Remove policy has a busy guard — a double click sends one DELETE", async () => {
    m.removePolicy.mockImplementation(() => new Promise(() => {}))
    render(<RetentionPolicyEditor policy={POLICY} onBack={vi.fn()} onSaved={vi.fn()} />)
    await userEvent.click(screen.getByRole("button", { name: "Remove policy…" }))
    const remove = within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove policy" })
    fireEvent.click(remove)
    fireEvent.click(remove)
    expect(m.removePolicy).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(remove).toBeDisabled())
  })

  it("a removed policy reports the write", async () => {
    m.removePolicy.mockResolvedValue({ id: "p2", name: "Expired contracts" })
    const onSaved = vi.fn()
    render(<RetentionPolicyEditor policy={POLICY} onBack={vi.fn()} onSaved={onSaved} />)
    await userEvent.click(screen.getByRole("button", { name: "Remove policy…" }))
    await userEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Remove policy" }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(m.removePolicy).toHaveBeenCalledWith("p2")
  })
})
