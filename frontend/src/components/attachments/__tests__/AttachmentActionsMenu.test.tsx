/**
 * Phase 274 plan 04 Task 1 (D-09 / D-11 / D-13 / D-15 / D-22 / D-23 / D-25) — THE `⋯` MENU AND
 * THE AFTER-MARK SEGMENT, shared by the sent chat chip and the panel's Files row.
 *
 * Sketch 274's winner A is the acceptance bar: an ALWAYS-visible `⋯` (touch has no hover) opening
 * `Save to Library…` / `Open in panel` on the chip and only the verb on the panel row; afterwards
 * the chip gains `In Library · <leaf>` (or `Already in Library · <leaf>`) with the FULL path in its
 * title and accessible name, `· indexing…` while the row is not yet searchable and, net-new under
 * D-25, `· couldn't index` when ingestion failed.
 *
 * Every expected string is read from `saveToLibraryCopy` (the port), never typed here.
 */
import { act, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { LibraryLinkInfo } from "@/lib/api/attachments"
import type { WorkspaceFile } from "@/types"

vi.mock("@/components/panel/panelOpenSignal", () => ({ requestOpenPanel: vi.fn() }))
vi.mock("@/lib/citationNav", () => ({ useCitationNavOptional: vi.fn() }))
vi.mock("../useLibraryLinks", () => ({ useLibraryLinks: vi.fn(), refreshLibraryLinks: vi.fn() }))
// The dialog is 274-03's and has its own suite; here it is a sentinel that exposes its props.
vi.mock("../SaveToLibraryDialog", () => ({
  SaveToLibraryDialog: ({
    open,
    file,
    threadId,
    onSaved,
  }: {
    open: boolean
    file: WorkspaceFile
    threadId: string
    onSaved: (r: unknown) => void
  }) =>
    open ? (
      <div data-testid="save-dialog">
        {threadId}:{file.id}
        <button type="button" onClick={() => onSaved({ outcome: "saved" })}>
          sentinel-saved
        </button>
      </div>
    ) : null,
}))

// eslint-disable-next-line import/first
import { requestOpenPanel } from "@/components/panel/panelOpenSignal"
// eslint-disable-next-line import/first
import { useCitationNavOptional } from "@/lib/citationNav"
// eslint-disable-next-line import/first
import { refreshLibraryLinks, useLibraryLinks } from "../useLibraryLinks"
// eslint-disable-next-line import/first
import { AttachmentActionsMenu, requestAttachmentMenu } from "../AttachmentActionsMenu"
// eslint-disable-next-line import/first
import { LibraryLinkSegment } from "../LibraryLinkSegment"
// eslint-disable-next-line import/first
import { COPY } from "../saveToLibraryCopy"

const FILE: WorkspaceFile = {
  id: "wf-1",
  path: "a1b2c3d4-Meridian-Q4-pricing.xlsx",
  size_bytes: 86_016,
  mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  kind: "template_input",
  expires_at: null,
}

type Linkish = { promotable: boolean; link: LibraryLinkInfo | null; leaf: string | null; path: string | null }

function storeReturns(state: Partial<Linkish> = {}) {
  const s: Linkish = { promotable: true, link: null, leaf: null, path: null, ...state }
  vi.mocked(useLibraryLinks).mockReturnValue({ stateFor: () => s } as never)
}

function link(over: Partial<LibraryLinkInfo> = {}): LibraryLinkInfo {
  return {
    document_id: "doc-1",
    outcome: "saved",
    folder_id: "s3",
    document_status: "completed",
    filename: "Meridian-Q4-pricing.xlsx",
    ...over,
  }
}

const openDocument = vi.fn()

function trigger(): HTMLButtonElement {
  return screen.getByRole("button", { name: COPY.a.moreLabel }) as HTMLButtonElement
}

describe("AttachmentActionsMenu — the ⋯ on the chip and the panel row", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeReturns()
    vi.mocked(useCitationNavOptional).mockReturnValue({
      openDocument,
      pendingDocumentId: null,
      consumePendingDocument: vi.fn(),
    } as never)
  })

  it("chip, promotable, unlinked → an always-present trigger opening Save to Library… and Open in panel", async () => {
    render(<AttachmentActionsMenu threadId="t-1" file={FILE} variant="chip" />)
    const btn = trigger()
    // Present WITHOUT hover (touch has none): it is in the DOM and not hidden by a hover class.
    expect(btn.getAttribute("aria-haspopup")).toBe("menu")
    expect(btn.getAttribute("type")).toBe("button")
    expect(btn.className).not.toMatch(/opacity-0|invisible|hidden/)

    await userEvent.setup().click(btn)
    const items = screen.getAllByRole("menuitem").map((i) => i.textContent)
    expect(items).toEqual([COPY.netNew.saveVerbMenu, COPY.shared.openInPanel])
  })

  it("Open in panel → requestOpenPanel once, and nothing else (D-23 reveal only)", async () => {
    const user = userEvent.setup()
    render(<AttachmentActionsMenu threadId="t-1" file={FILE} variant="chip" />)
    await user.click(trigger())
    await user.click(screen.getByRole("menuitem", { name: COPY.shared.openInPanel }))
    expect(requestOpenPanel).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId("save-dialog")).toBeNull()
  })

  it("Save to Library… opens the ONE dialog for THIS file; onSaved refreshes the thread's links once", async () => {
    const user = userEvent.setup()
    render(<AttachmentActionsMenu threadId="t-1" file={FILE} variant="chip" />)
    await user.click(trigger())
    await user.click(screen.getByRole("menuitem", { name: COPY.netNew.saveVerbMenu }))
    const dialog = await screen.findByTestId("save-dialog")
    expect(dialog.textContent).toContain("t-1:wf-1")
    await user.click(within(dialog).getByRole("button", { name: "sentinel-saved" }))
    expect(refreshLibraryLinks).toHaveBeenCalledTimes(1)
    expect(refreshLibraryLinks).toHaveBeenCalledWith("t-1")
  })

  it("panel variant → the menu offers ONLY the verb", async () => {
    render(<AttachmentActionsMenu threadId="t-1" file={FILE} variant="panel" triggerTabIndex={-1} />)
    expect(trigger().getAttribute("tabindex")).toBe("-1")
    await userEvent.setup().click(trigger())
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([COPY.netNew.saveVerbMenu])
  })

  it("promotable: false → the verb is DISABLED with the reason line, and activating it opens no dialog (D-22)", async () => {
    storeReturns({ promotable: false })
    const user = userEvent.setup()
    render(<AttachmentActionsMenu threadId="t-1" file={FILE} variant="chip" />)
    await user.click(trigger())
    const verb = screen.getByRole("menuitem", { name: COPY.netNew.saveVerbMenu })
    expect(verb.getAttribute("aria-disabled")).toBe("true")
    expect(screen.getByText(COPY.netNew.typeRefused)).toBeTruthy()
    await user.click(verb)
    expect(screen.queryByTestId("save-dialog")).toBeNull()
  })

  it("already linked → the verb is not offered (the segment is the after-state)", async () => {
    storeReturns({ link: link(), leaf: "Pricing", path: "Suppliers › Meridian › Pricing" })
    render(<AttachmentActionsMenu threadId="t-1" file={FILE} variant="chip" />)
    await userEvent.setup().click(trigger())
    const items = screen.getAllByRole("menuitem").map((i) => i.textContent)
    expect(items).not.toContain(COPY.netNew.saveVerbMenu)
    expect(items).toEqual([COPY.shared.openInPanel])
  })

  it("requestAttachmentMenu(fileId) opens THAT file's menu and no other (the panel row's keyboard arm)", async () => {
    render(
      <>
        <AttachmentActionsMenu threadId="t-1" file={FILE} variant="panel" />
        <AttachmentActionsMenu threadId="t-1" file={{ ...FILE, id: "wf-2" }} variant="panel" />
      </>,
    )
    expect(screen.queryAllByRole("menuitem")).toHaveLength(0)
    act(() => requestAttachmentMenu("wf-2"))
    expect(await screen.findAllByRole("menuitem")).toHaveLength(1)
    const [first, second] = screen.getAllByRole("button", { name: COPY.a.moreLabel, hidden: true })
    expect(first.getAttribute("aria-expanded")).toBe("false")
    expect(second.getAttribute("aria-expanded")).toBe("true")
  })

  it("renders nothing for a file with no id", () => {
    const { container } = render(
      <AttachmentActionsMenu threadId="t-1" file={{ ...FILE, id: undefined }} variant="chip" />,
    )
    expect(container.innerHTML).toBe("")
  })
})

describe("LibraryLinkSegment — the after-mark", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useCitationNavOptional).mockReturnValue({
      openDocument,
      pendingDocumentId: null,
      consumePendingDocument: vi.fn(),
    } as never)
  })

  const PATH = "Suppliers › Meridian › Pricing"

  it("saved + completed, display leaf → `In Library · Pricing`, a check mark, the FULL path in title + name", () => {
    render(<LibraryLinkSegment link={link()} leaf="Pricing" path={PATH} display="leaf" />)
    const seg = screen.getByTestId("library-link-segment")
    expect(seg.textContent).toBe(`${COPY.shared.inLibrary} · Pricing`)
    expect(seg.querySelector(".lucide-check")).not.toBeNull()
    expect(seg.getAttribute("title")).toBe(PATH)
    expect(seg.getAttribute("aria-label")).toContain(PATH)
    expect(seg.getAttribute("data-outcome")).toBe("saved")
  })

  it("already → `Already in Library · <leaf>` and no check mark", () => {
    render(
      <LibraryLinkSegment
        link={link({ outcome: "already", folder_id: "f4" })}
        leaf="Q4 2026 review"
        path="Finance › Q4 2026 review"
        display="leaf"
      />,
    )
    const seg = screen.getByTestId("library-link-segment")
    expect(seg.textContent).toBe(`${COPY.shared.alreadyInLibrary} · Q4 2026 review`)
    expect(seg.querySelector(".lucide-check")).toBeNull()
  })

  it("pending / processing / paused → ends `· indexing…`; failed → `· couldn't index` (D-25)", () => {
    for (const s of ["pending", "processing", "paused"] as const) {
      const { unmount } = render(
        <LibraryLinkSegment link={link({ document_status: s })} leaf="Pricing" path={PATH} display="leaf" />,
      )
      expect(screen.getByTestId("library-link-segment").textContent!.endsWith(`· ${COPY.shared.indexing}`)).toBe(true)
      unmount()
    }
    render(<LibraryLinkSegment link={link({ document_status: "failed" })} leaf="Pricing" path={PATH} display="leaf" />)
    const seg = screen.getByTestId("library-link-segment")
    expect(seg.textContent!.endsWith(`· ${COPY.netNew.couldntIndex}`)).toBe(true)
    expect(seg.textContent).not.toContain(COPY.shared.indexing)
  })

  it("display path → the FULL path is VISIBLE (the tooltip is never its only home)", () => {
    render(<LibraryLinkSegment link={link()} leaf="Pricing" path={PATH} display="path" />)
    expect(screen.getByTestId("library-link-segment").textContent).toBe(`${COPY.shared.inLibrary} · ${PATH}`)
  })

  it("an unseen folder → no folder text is invented", () => {
    render(<LibraryLinkSegment link={link()} leaf={null} path={null} display="leaf" />)
    expect(screen.getByTestId("library-link-segment").textContent).toBe(COPY.shared.inLibrary)
  })

  it("clicking opens the document; with no navigator it is plain text, not a button", async () => {
    const { unmount } = render(<LibraryLinkSegment link={link()} leaf="Pricing" path={PATH} display="leaf" />)
    const seg = screen.getByTestId("library-link-segment")
    expect(seg.tagName).toBe("BUTTON")
    await userEvent.setup().click(seg)
    expect(openDocument).toHaveBeenCalledWith("doc-1")
    unmount()

    vi.mocked(useCitationNavOptional).mockReturnValue(null)
    render(<LibraryLinkSegment link={link()} leaf="Pricing" path={PATH} display="leaf" />)
    expect(screen.getByTestId("library-link-segment").tagName).toBe("SPAN")
    expect(screen.queryByRole("button")).toBeNull()
  })
})
