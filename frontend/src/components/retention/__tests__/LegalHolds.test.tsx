/**
 * Phase 275 plan 04 Task 2 (S3 / D-05 / D-35 / 066 graded guard) — placing, extending and
 * releasing legal holds.
 *
 * Each case prices a lived failure:
 *   · a hold card that hides who placed it, what it covers, or how many documents it holds today;
 *   · a hold dialog that lets a person place a hold covering nothing, or shows "0 documents" when
 *     the count simply failed (D-35: never a fake 0);
 *   · a failed place that throws away what was typed;
 *   · a release that names nothing, is red, or closes on failure while the hold is still in force.
 * Assertions read RENDERED WORDS.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { Document, Folder } from "@/types"
import type { HoldList, LegalHold } from "@/lib/api/retention"
import { ApiRefusal } from "@/lib/api/refusal"

const m = vi.hoisted(() => ({
  listHolds: vi.fn(),
  createHold: vi.fn(),
  addHoldCoverage: vi.fn(),
  releaseHold: vi.fn(),
  countHoldCoverage: vi.fn(),
  listDocuments: vi.fn(),
  useFolders: vi.fn(),
}))

vi.mock("@/lib/api/retention", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/retention")>()
  return {
    ...actual,
    listHolds: m.listHolds,
    createHold: m.createHold,
    addHoldCoverage: m.addHoldCoverage,
    releaseHold: m.releaseHold,
    countHoldCoverage: m.countHoldCoverage,
  }
})

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, listDocuments: m.listDocuments }
})

vi.mock("@/hooks/useFolders", () => ({ useFolders: m.useFolders }))

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

import { LegalHoldsList } from "../LegalHoldsList"

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })

const ACTIVE: LegalHold = {
  id: "h1", name: "Halvorsen v. Halden & Co.",
  reason: "Litigation — preserve everything about the Halvorsen supply relationship.",
  created_by_name: "Amira Sato", created_at: "2026-08-03T09:00:00Z", active: true,
  document_count: 2, folder_ids: ["f-atlas"], folder_paths: ["/Projects/Atlas"], held_today: 4,
}
const RELEASED: LegalHold = {
  id: "h2", name: "2024 tax audit", reason: "Tax authority audit of FY2024.", created_by_name: "Jonas Weber",
  created_at: "2026-01-09T09:00:00Z", released_at: "2026-03-12T09:00:00Z", active: false,
  document_count: 0, folder_ids: ["f-rep"], folder_paths: ["/Finance/Reports"], held_today: null,
}

const FOLDERS: Folder[] = [
  { id: "f-fin", user_id: "u", name: "Finance", parent_id: null, is_org_shared: true, created_at: "", updated_at: "" },
  { id: "f-inv", user_id: "u", name: "Invoices", parent_id: "f-fin", is_org_shared: true, created_at: "", updated_at: "" },
]
const DOCS = [
  { id: "d1", filename: "Kessler Services Agreement.pdf" },
  { id: "d2", filename: "Olsen Consulting SOW.pdf" },
] as Document[]

beforeEach(() => {
  vi.clearAllMocks()
  m.listHolds.mockResolvedValue({ active: [ACTIVE], released: [RELEASED] } satisfies HoldList)
  m.countHoldCoverage.mockResolvedValue({ count: 7 })
  m.listDocuments.mockResolvedValue(DOCS)
  m.useFolders.mockReturnValue({ folders: FOLDERS })
})

describe("LegalHoldsList — the hold cards (S3)", () => {
  it("an active card reads Holding + matter + reason + placer, coverage and the held-today count", async () => {
    render(<LegalHoldsList />)
    const card = (await screen.findAllByTestId("hold-card"))[0]
    expect(card).toHaveTextContent("Holding")
    expect(card).toHaveTextContent("Halvorsen v. Halden & Co.")
    expect(card).toHaveTextContent("Litigation — preserve everything about the Halvorsen supply relationship.")
    expect(card).toHaveTextContent(
      `Placed by Amira Sato on ${fmt("2026-08-03T09:00:00Z")} · covers 2 documents + /Projects/Atlas (and anything added to it later) · 4 documents held today`,
    )
    expect(within(card).getByRole("button", { name: "Add documents…" })).toBeInTheDocument()
    expect(within(card).getByRole("button", { name: "Release hold…" })).toBeInTheDocument()
    expect(screen.getByText("1 active")).toBeInTheDocument()
  })

  it("released holds sit under '1 released hold', dimmed, with a Released chip and NO buttons", async () => {
    render(<LegalHoldsList />)
    const summary = await screen.findByText("1 released hold")
    const released = summary.closest("details") as HTMLElement
    const card = within(released).getByTestId("hold-card")
    expect(card).toHaveTextContent(`Released ${fmt("2026-03-12T09:00:00Z")}`)
    expect(card.className).toContain("opacity-70")
    expect(within(card).queryAllByRole("button")).toHaveLength(0)
    // held_today null → the honest sentence, never 0.
    expect(card).toHaveTextContent("Couldn't count the documents yet.")
  })

  it("the empty state", async () => {
    m.listHolds.mockResolvedValue({ active: [], released: [] })
    render(<LegalHoldsList />)
    expect(await screen.findByText("No legal holds")).toBeInTheDocument()
    expect(screen.getByText("Place a hold to stop any document or folder from being deleted, by a person or by a policy.")).toBeInTheDocument()
  })

  it("a failed read says so with Try again, and a retry renders the holds", async () => {
    m.listHolds.mockRejectedValueOnce(new Error("down"))
    render(<LegalHoldsList />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load retention. Try again.")
    expect(screen.queryByText("No legal holds")).toBeNull() // never a false empty state
    await userEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Halvorsen v. Halden & Co.")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).toBeNull()
  })
})

describe("LegalHoldDialog — place a hold (D-05 / D-35)", () => {
  async function openNew() {
    render(<LegalHoldsList onRecorded={vi.fn()} />)
    await screen.findAllByTestId("hold-card")
    await userEvent.click(screen.getByRole("button", { name: "+ New hold" }))
    return screen.findByRole("dialog")
  }

  it("Place hold is held back with a VISIBLE reason until something is picked", async () => {
    const dialog = await openNew()
    expect(within(dialog).getByTestId("hold-count-line")).toHaveTextContent("Pick at least one folder or document.")
    const place = within(dialog).getByRole("button", { name: "Place hold" })
    expect(place).toHaveAttribute("aria-disabled", "true")
    await userEvent.click(place)
    expect(m.createHold).not.toHaveBeenCalled()
  })

  it("the folder picker is an indented tree; the live line is the SERVER's count", async () => {
    const dialog = await openNew()
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Invoices" }))
    await waitFor(() =>
      expect(within(dialog).getByTestId("hold-count-line")).toHaveTextContent(
        "7 documents will be held today. Anything added to these folders later is held too.",
      ),
    )
    expect(m.countHoldCoverage).toHaveBeenLastCalledWith({ document_ids: [], folder_ids: ["f-inv"] })
    const invoices = within(dialog).getByRole("checkbox", { name: "Invoices" }).closest("li") as HTMLElement
    expect(invoices.style.paddingLeft).toBe("16px")
  })

  it("a failed count reads 'Couldn't count the documents yet.' — never 0", async () => {
    m.countHoldCoverage.mockRejectedValue(new Error("x"))
    const dialog = await openNew()
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Finance" }))
    await waitFor(() => expect(within(dialog).getByTestId("hold-count-line")).toHaveTextContent("Couldn't count the documents yet."))
    expect(within(dialog).getByTestId("hold-count-line").textContent).not.toMatch(/\b0\b/)
  })

  it("documents are picked by name as chips, each ✕ labelled 'Remove {doc} from the hold'", async () => {
    const dialog = await openNew()
    await userEvent.type(within(dialog).getByLabelText("Documents"), "kess")
    await userEvent.click(await within(dialog).findByRole("button", { name: "Kessler Services Agreement.pdf" }))
    const remove = within(dialog).getByRole("button", { name: "Remove Kessler Services Agreement.pdf from the hold" })
    expect(remove).toBeInTheDocument()
    await waitFor(() => expect(m.countHoldCoverage).toHaveBeenLastCalledWith({ document_ids: ["d1"], folder_ids: [] }))
    await userEvent.click(remove)
    expect(within(dialog).queryByRole("button", { name: "Remove Kessler Services Agreement.pdf from the hold" })).toBeNull()
  })

  it("names the missing matter and reason inline, and sends nothing", async () => {
    const dialog = await openNew()
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Finance" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Place hold" }))
    expect(within(dialog).getByText("Name the matter.")).toBeInTheDocument()
    expect(within(dialog).getByText("Say why it is held.")).toBeInTheDocument()
    expect(m.createHold).not.toHaveBeenCalled()
  })

  it("success places the hold directly (no confirm), records, and re-reads the list", async () => {
    m.createHold.mockResolvedValue({ ...ACTIVE, id: "h3" })
    const onRecorded = vi.fn()
    render(<LegalHoldsList onRecorded={onRecorded} />)
    await screen.findAllByTestId("hold-card")
    await userEvent.click(screen.getByRole("button", { name: "+ New hold" }))
    const dialog = await screen.findByRole("dialog")
    await userEvent.type(within(dialog).getByLabelText("Matter name"), "Kessler dispute")
    await userEvent.type(within(dialog).getByLabelText("Reason"), "Counsel asked.")
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Finance" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Place hold" }))
    await waitFor(() =>
      expect(m.createHold).toHaveBeenCalledWith({
        name: "Kessler dispute", reason: "Counsel asked.", document_ids: [], folder_ids: ["f-fin"],
      }),
    )
    expect(onRecorded).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(m.listHolds).toHaveBeenCalledTimes(2))
  })

  it("failure keeps every field and says nothing is held yet", async () => {
    m.createHold.mockRejectedValue(new ApiRefusal(422, "", "x"))
    const dialog = await openNew()
    await userEvent.type(within(dialog).getByLabelText("Matter name"), "Kessler dispute")
    await userEvent.type(within(dialog).getByLabelText("Reason"), "Counsel asked.")
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Finance" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Place hold" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Couldn't place the hold. Nothing changed. Nothing is held yet.")
    expect(within(dialog).getByLabelText("Matter name")).toHaveValue("Kessler dispute")
    expect(within(dialog).getByLabelText("Reason")).toHaveValue("Counsel asked.")
    expect(within(dialog).getByRole("checkbox", { name: "Finance" })).toBeChecked()
  })

  it("Add mode: titled 'Add to “{matter}”', primary 'Add to hold', failure keeps the old coverage sentence", async () => {
    m.addHoldCoverage.mockRejectedValue(new Error("x"))
    render(<LegalHoldsList />)
    const card = (await screen.findAllByTestId("hold-card"))[0]
    await userEvent.click(within(card).getByRole("button", { name: "Add documents…" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Add to “Halvorsen v. Halden & Co.”")).toBeInTheDocument()
    expect(within(dialog).queryByLabelText("Matter name")).toBeNull()
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Invoices" }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Add to hold" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Couldn't add to the hold. Nothing changed. The hold still covers what it did before.",
    )
    expect(m.addHoldCoverage).toHaveBeenCalledWith("h1", { document_ids: [], folder_ids: ["f-inv"] })
  })
})

describe("ReleaseHoldDialog — victim-naming, not red, Keep hold focused (066)", () => {
  async function openRelease() {
    render(<LegalHoldsList />)
    const card = (await screen.findAllByTestId("hold-card"))[0]
    await userEvent.click(within(card).getByRole("button", { name: "Release hold…" }))
    return screen.findByRole("alertdialog")
  }

  it("titles the matter, says how many lose protection, names the coverage, and focuses Keep hold", async () => {
    const sheet = await openRelease()
    expect(within(sheet).getByText("Release “Halvorsen v. Halden & Co.”?")).toBeInTheDocument()
    expect(sheet).toHaveTextContent(
      "4 documents will no longer be protected. Policies can archive them or queue them for deletion at the next sweep. Documents still covered by another hold stay held.",
    )
    expect(within(sheet).getByTestId("release-victims")).toHaveTextContent("/Projects/Atlas")
    await waitFor(() => expect(within(sheet).getByRole("button", { name: "Keep hold" })).toHaveFocus())
    const release = within(sheet).getByRole("button", { name: "Release hold" })
    expect(release.className).not.toMatch(/bg-destructive/)
    expect(release.className).toContain("dark:text-warning")
  })

  it("names at most 8, then 'and {N} more'", async () => {
    const paths = Array.from({ length: 11 }, (_, i) => `/Matter/F${i + 1}`)
    m.listHolds.mockResolvedValue({ active: [{ ...ACTIVE, folder_paths: paths, document_count: 0 }], released: [] })
    const sheet = await openRelease()
    const list = within(sheet).getByTestId("release-victims")
    expect(within(list).getAllByRole("listitem")).toHaveLength(9)
    expect(list).toHaveTextContent("and 3 more")
  })

  it("failure keeps the sheet open: the hold is still in force", async () => {
    m.releaseHold.mockRejectedValue(new Error("x"))
    const sheet = await openRelease()
    await userEvent.click(within(sheet).getByRole("button", { name: "Release hold" }))
    expect(await within(sheet).findByRole("alert")).toHaveTextContent("Couldn't release the hold. It is still in force.")
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
  })

  it("success releases, records and re-reads", async () => {
    m.releaseHold.mockResolvedValue({ ...ACTIVE, active: false })
    const onRecorded = vi.fn()
    render(<LegalHoldsList onRecorded={onRecorded} />)
    const card = (await screen.findAllByTestId("hold-card"))[0]
    await userEvent.click(within(card).getByRole("button", { name: "Release hold…" }))
    const sheet = await screen.findByRole("alertdialog")
    await userEvent.click(within(sheet).getByRole("button", { name: "Release hold" }))
    await waitFor(() => expect(m.releaseHold).toHaveBeenCalledWith("h1"))
    expect(onRecorded).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
  })
})
