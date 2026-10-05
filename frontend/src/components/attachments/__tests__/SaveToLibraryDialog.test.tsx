/**
 * Phase 274 plan 03 Task 2 (D-09 / D-10 / D-12 / D-13 / D-14) — THE ONE Save-to-Library dialog.
 *
 * Sketch 274 (winner A) draws: title · one-line sub · file chip · folder list (no Root) · ONE slot
 * for the version warning OR the refusal · [required hint] Cancel + `Save to Library`, disabled
 * until a folder is picked. After confirm, a same-bytes copy shows WHERE the existing copy lives.
 *
 * ⛔ Every word asserted here is read from the port (`saveToLibraryCopy`), which is itself fenced
 * against the sketch's `COPY.js`. ⛔ The result screen renders the POST answer, never a preview.
 */
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import type { Folder, WorkspaceFile } from "@/types"

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))

vi.mock("@/lib/api/documents", () => ({ listFolders: vi.fn() }))

vi.mock("@/lib/api/attachments", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/attachments")>("@/lib/api/attachments")
  return { ...actual, getPromotePreview: vi.fn(), promoteAttachment: vi.fn() }
})

vi.mock("@/lib/citationNav", () => ({ useCitationNavOptional: vi.fn() }))

import { listFolders } from "@/lib/api/documents"
import {
  PromoteError,
  getPromotePreview,
  promoteAttachment,
  type PromotePreview,
  type PromoteResult,
} from "@/lib/api/attachments"
import { useCitationNavOptional } from "@/lib/citationNav"
import { formatBytes } from "@/lib/formatBytes"
import { SaveToLibraryDialog } from "../SaveToLibraryDialog"
import { COPY } from "../saveToLibraryCopy"

function folder(id: string, name: string, parent_id: string | null): Folder {
  return {
    id,
    user_id: "u-1",
    name,
    parent_id,
    is_org_shared: false,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
  }
}

const FOLDERS: Folder[] = [
  folder("c1", "Contracts", null),
  folder("f3", "Finance", null),
  folder("f4", "Q4 2026 review", "f3"),
  folder("s1", "Suppliers", null),
  folder("s2", "Meridian", "s1"),
  folder("s3", "Pricing", "s2"),
]

const FILE: WorkspaceFile = {
  id: "wf-1",
  path: "1a2b3c4d-Meridian-Q4-pricing.xlsx",
  size_bytes: 86_016,
  mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  kind: "template_input",
  expires_at: null,
}

function preview(over: Partial<PromotePreview> = {}): PromotePreview {
  return {
    promotable: true,
    refusal: null,
    filename: "Meridian-Q4-pricing.xlsx",
    duplicate_of: null,
    next_version: 1,
    ...over,
  }
}

function result(over: Partial<PromoteResult> = {}): PromoteResult {
  return {
    outcome: "saved",
    document_id: "doc-1",
    folder_id: "s3",
    document_status: "pending",
    filename: "Meridian-Q4-pricing.xlsx",
    version_number: 1,
    ...over,
  }
}

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const openDocument = vi.fn()

function renderDialog(over: { onSaved?: () => void; onClose?: () => void } = {}) {
  const onSaved = over.onSaved ?? vi.fn()
  const onClose = over.onClose ?? vi.fn()
  render(<SaveToLibraryDialog open onClose={onClose} threadId="t-1" file={FILE} onSaved={onSaved} />)
  return { onSaved, onClose }
}

async function pick(fullPath: string) {
  const options = await screen.findAllByRole("option")
  const target = options.find((o) => o.textContent === fullPath)
  if (!target) throw new Error(`no option ${fullPath}`)
  fireEvent.mouseDown(target)
}

function confirmButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: COPY.shared.confirm }) as HTMLButtonElement
}

describe("SaveToLibraryDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
    vi.mocked(listFolders).mockResolvedValue(FOLDERS)
    vi.mocked(getPromotePreview).mockResolvedValue(preview())
    vi.mocked(useCitationNavOptional).mockReturnValue({
      openDocument,
      pendingDocumentId: null,
      consumePendingDocument: vi.fn(),
    } as never)
  })

  it("opens on the pick screen: title, sub, file chip, disabled confirm, required hint, never Attach/Import", async () => {
    renderDialog()
    await screen.findAllByRole("option")
    expect(screen.getByRole("heading", { name: COPY.shared.dialogTitle })).toBeTruthy()
    expect(screen.getByText(COPY.shared.dialogSub)).toBeTruthy()
    const chip = screen.getByTestId("save-to-library-file-chip")
    expect(within(chip).getByText("Meridian-Q4-pricing.xlsx")).toBeTruthy()
    expect(within(chip).getByText(formatBytes(86_016))).toBeTruthy()
    expect(confirmButton().disabled).toBe(true)
    expect(screen.getByTestId("save-to-library-required").textContent).toBe(COPY.shared.folderRequired)
    expect(screen.queryByText("Attach")).toBeNull()
    expect(screen.queryByText("Import")).toBeNull()
    for (const o of screen.getAllByRole("option")) expect(o.textContent).not.toMatch(/root/i)
  })

  it("picking a folder requests ONE preview for it and enables confirm; the required hint goes", async () => {
    renderDialog()
    await pick("Suppliers/Meridian/Pricing")
    await waitFor(() => expect(getPromotePreview).toHaveBeenCalledTimes(1))
    expect(getPromotePreview).toHaveBeenCalledWith("t-1", "wf-1", "s3")
    expect(confirmButton().disabled).toBe(false)
    expect(screen.queryByTestId("save-to-library-required")).toBeNull()
  })

  it("a same-name file there → the version warning BEFORE confirming (D-14)", async () => {
    vi.mocked(getPromotePreview).mockResolvedValue(preview({ next_version: 2 }))
    renderDialog()
    await pick("Suppliers/Meridian/Pricing")
    expect(
      await screen.findByText(
        COPY.shared.versionWarn("Meridian-Q4-pricing.xlsx", "Suppliers/Meridian/Pricing", 2),
      ),
    ).toBeTruthy()
  })

  it("next_version 1 → no warning", async () => {
    renderDialog()
    await pick("Suppliers/Meridian/Pricing")
    await waitFor(() => expect(getPromotePreview).toHaveBeenCalled())
    await Promise.resolve()
    expect(screen.queryByTestId("save-to-library-version-warn")).toBeNull()
  })

  it("a duplicate in the preview is NOT a version warning (the result screen says it, after POST)", async () => {
    vi.mocked(getPromotePreview).mockResolvedValue(
      preview({ next_version: 2, duplicate_of: { document_id: "doc-9", folder_id: "f4" } }),
    )
    renderDialog()
    await pick("Suppliers/Meridian/Pricing")
    await waitFor(() => expect(getPromotePreview).toHaveBeenCalled())
    await Promise.resolve()
    expect(screen.queryByTestId("save-to-library-version-warn")).toBeNull()
  })

  it("latest wins: A then B picked fast, A answers LAST → only B's answer renders", async () => {
    const a = deferred<PromotePreview>()
    const b = deferred<PromotePreview>()
    vi.mocked(getPromotePreview).mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
    renderDialog()
    await pick("Suppliers/Meridian/Pricing")
    await pick("Suppliers/Meridian")
    await waitFor(() => expect(getPromotePreview).toHaveBeenCalledTimes(2))
    b.resolve(preview({ next_version: 3 }))
    await screen.findByText(COPY.shared.versionWarn("Meridian-Q4-pricing.xlsx", "Suppliers/Meridian", 3))
    a.resolve(preview({ next_version: 2 }))
    await a.promise
    await Promise.resolve()
    expect(
      screen.queryByText(
        COPY.shared.versionWarn("Meridian-Q4-pricing.xlsx", "Suppliers/Meridian/Pricing", 2),
      ),
    ).toBeNull()
    expect(
      screen.getByText(COPY.shared.versionWarn("Meridian-Q4-pricing.xlsx", "Suppliers/Meridian", 3)),
    ).toBeTruthy()
  })

  it("confirm → Saving… and disabled in flight; saved → onSaved once, then close", async () => {
    const post = deferred<PromoteResult>()
    vi.mocked(promoteAttachment).mockReturnValue(post.promise)
    const { onSaved, onClose } = renderDialog()
    await pick("Suppliers/Meridian/Pricing")
    fireEvent.click(confirmButton())
    const saving = await screen.findByRole("button", { name: COPY.shared.saving })
    expect((saving as HTMLButtonElement).disabled).toBe(true)
    expect(promoteAttachment).toHaveBeenCalledWith("t-1", "wf-1", "s3")
    const saved = result()
    post.resolve(saved)
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1))
    expect(onSaved).toHaveBeenCalledWith(saved)
    expect(onClose).toHaveBeenCalled()
  })

  it("already, in ANOTHER folder → says where it lives and that the pick was not used; Open it opens the doc", async () => {
    const already = result({ outcome: "already", folder_id: "f4", document_id: "doc-9" })
    vi.mocked(promoteAttachment).mockResolvedValue(already)
    const { onSaved, onClose } = renderDialog()
    await pick("Suppliers/Meridian")
    fireEvent.click(confirmButton())
    expect(await screen.findByText(COPY.shared.alreadyTitle)).toBeTruthy()
    expect(screen.getByText(COPY.shared.alreadyBody("Finance/Q4 2026 review"))).toBeTruthy()
    expect(screen.getByText(COPY.shared.alreadyDiffFolder("Suppliers/Meridian"))).toBeTruthy()
    expect(screen.getByRole("button", { name: COPY.shared.done })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: COPY.shared.openDoc }))
    expect(openDocument).toHaveBeenCalledWith("doc-9")
    expect(onClose).toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledWith(already)
  })

  it("already, in the SAME folder → no picked-elsewhere line; Done → onSaved + close", async () => {
    const already = result({ outcome: "already", folder_id: "s3" })
    vi.mocked(promoteAttachment).mockResolvedValue(already)
    const { onSaved, onClose } = renderDialog()
    await pick("Suppliers/Meridian/Pricing")
    fireEvent.click(confirmButton())
    await screen.findByText(COPY.shared.alreadyTitle)
    expect(screen.queryByText(COPY.shared.alreadyDiffFolder("Suppliers/Meridian/Pricing"))).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: COPY.shared.done }))
    expect(onSaved).toHaveBeenCalledWith(already)
    expect(onClose).toHaveBeenCalled()
  })

  it("no document navigator in the tree → no Open it button", async () => {
    vi.mocked(useCitationNavOptional).mockReturnValue(null)
    vi.mocked(promoteAttachment).mockResolvedValue(result({ outcome: "already", folder_id: "f4" }))
    renderDialog()
    await pick("Suppliers/Meridian")
    fireEvent.click(confirmButton())
    await screen.findByText(COPY.shared.alreadyTitle)
    expect(screen.queryByRole("button", { name: COPY.shared.openDoc })).toBeNull()
  })

  it("a 403 → the plain lead and the SERVER's sentence verbatim, in an alert; stays on pick; confirm re-enabled", async () => {
    vi.mocked(promoteAttachment).mockRejectedValue(
      new PromoteError(403, "Cannot upload to a folder you do not own"),
    )
    const { onSaved, onClose } = renderDialog()
    await pick("Suppliers/Meridian")
    fireEvent.click(confirmButton())
    const alert = await screen.findByRole("alert")
    expect(within(alert).getByText(COPY.shared.refuseLead)).toBeTruthy()
    expect(within(alert).getByText("Cannot upload to a folder you do not own")).toBeTruthy()
    expect(screen.getByRole("listbox")).toBeTruthy()
    await waitFor(() => expect(confirmButton().disabled).toBe(false))
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it("folders fail to load → the load-failed line in an alert, confirm disabled", async () => {
    vi.mocked(listFolders).mockRejectedValue(new Error("boom"))
    renderDialog()
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toContain(COPY.netNew.loadFoldersFailed)
    expect(confirmButton().disabled).toBe(true)
  })
})
