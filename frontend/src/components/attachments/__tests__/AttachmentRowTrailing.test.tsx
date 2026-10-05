/**
 * Phase 274 plan 04 Task 3 (D-09 / D-11 / D-15 / D-19) — THE PANEL FILES ROW'S TRAILING SLOT for a
 * chat attachment / template input.
 *
 * Sketch 274 A, *Panel · Files*: a thread-life row reads `this chat only` and carries the `⋯`
 * (only the verb); once saved the FULL path is visible on the row — the panel is where the path
 * the chip only shows as a leaf can be read. A TTL row (a workflow template input) keeps its
 * `Template` badge and countdown exactly as shipped, and gains the `⋯`.
 *
 * ⛔ The `⋯` is `tabIndex=-1`: an interactive tab stop inside `role=option` breaks the listbox.
 * ⛔ Its click never reaches the row (the row's click opens the file preview).
 */
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { WorkspaceFile } from "@/types"

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))
vi.mock("@/components/panel/panelOpenSignal", () => ({ requestOpenPanel: vi.fn() }))
vi.mock("@/lib/citationNav", () => ({ useCitationNavOptional: vi.fn(() => null) }))
const linkState = vi.fn()
vi.mock("../useLibraryLinks", () => ({
  useLibraryLinks: () => ({ stateFor: (id: string | undefined) => linkState(id) }),
  refreshLibraryLinks: vi.fn(),
}))
vi.mock("../SaveToLibraryDialog", () => ({ SaveToLibraryDialog: () => null }))

// eslint-disable-next-line import/first
import { AttachmentRowTrailing } from "../AttachmentRowTrailing"
// eslint-disable-next-line import/first
import { COPY } from "../saveToLibraryCopy"

const HOUR = 3_600_000

function file(over: Partial<WorkspaceFile> = {}): WorkspaceFile {
  return {
    id: "wf-1",
    path: "a1b2c3d4-Meridian-Q4-pricing.xlsx",
    size_bytes: 86_016,
    mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    kind: "template_input",
    expires_at: null,
    ...over,
  }
}

function more(container: HTMLElement) {
  return container.querySelectorAll<HTMLButtonElement>(`button[aria-label="${COPY.a.moreLabel}"]`)
}

describe("AttachmentRowTrailing — the panel row's trailing slot", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    linkState.mockReturnValue({ promotable: true, link: null, leaf: null, path: null })
  })

  it("thread-life, unlinked → `this chat only` + the ⋯ (tabIndex -1), and no Template badge", () => {
    const { container } = render(<AttachmentRowTrailing threadId="t-1" file={file()} />)
    expect(container.textContent).toContain(COPY.engine.CHIP_SCOPE)
    expect(container.textContent).not.toContain("Template")
    expect(container.textContent).not.toMatch(/expires|expiry/)
    const triggers = more(container)
    expect(triggers).toHaveLength(1)
    expect(triggers[0].getAttribute("tabindex")).toBe("-1")
  })

  // 274 G-4 #3 (F-1, driven in Chrome 2026-10-05): the full-path pill took up to 65% of the row,
  // wrapped, inherited the row's 13px type and squeezed the FILE NAME to zero width. Sketch 274-A
  // draws the panel's mark as the chip's segment — the LEAF visible, the full path in the title.
  // The original assertion (full path VISIBLE on the row) is retired deliberately for that reason.
  it("thread-life, linked → the LEAF is visible (sketch A), the full path is in the title, compact, the name keeps its room, no ⋯", () => {
    linkState.mockReturnValue({
      promotable: true,
      link: {
        document_id: "doc-1",
        outcome: "saved",
        folder_id: "s3",
        document_status: "processing",
        filename: "Meridian-Q4-pricing.xlsx",
      },
      leaf: "Pricing",
      path: "Suppliers › Meridian › Pricing",
    })
    const { container } = render(<AttachmentRowTrailing threadId="t-1" file={file()} />)
    const seg = screen.getByTestId("library-link-segment")
    expect(seg.textContent).toContain(`${COPY.shared.inLibrary} · Pricing`)
    expect(seg.textContent).not.toContain(`${COPY.shared.inLibrary} · Suppliers`)
    expect(seg.getAttribute("title")).toBe("Suppliers › Meridian › Pricing")
    expect(seg.textContent).toContain(COPY.shared.indexing)
    expect(seg.className).toContain("text-[11px]")
    expect(seg.className).not.toContain("whitespace-normal")
    // The slot never claims a share of the row that the file name needs.
    expect(container.innerHTML).not.toContain("max-w-[65%]")
    expect(container.innerHTML).not.toContain("flex-wrap")
    // Measured live: on one line, `this chat only` + the mark + size + age left the 345px row's
    // name 0px wide. The slot STACKS scope over action (sketch A's two-line meta) so the name keeps
    // its room.
    expect((container.firstElementChild as HTMLElement).className).toContain("flex-col")
    expect(container.textContent).toContain(COPY.engine.CHIP_SCOPE)
    expect(more(container)).toHaveLength(0)
  })

  it("TTL row → the Template badge and countdown exactly as shipped, followed by the ⋯", () => {
    const { container } = render(
      <AttachmentRowTrailing threadId="t-1" file={file({ expires_at: new Date(Date.now() + 5 * HOUR).toISOString() })} />,
    )
    const badge = screen.getByText("Template")
    expect(badge.className).toBe(
      "rounded bg-accent px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-accent-foreground",
    )
    const caption = screen.getByText(/expires in \d+h/)
    expect(caption.className).toBe("font-mono text-[10px] text-panel-muted-foreground")
    const trigger = more(container)[0]
    expect(trigger).toBeTruthy()
    expect(Boolean(caption.compareDocumentPosition(trigger) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    expect(container.textContent).not.toContain(COPY.engine.CHIP_SCOPE)
  })

  it("TTL row under an hour → the caption keeps the amber needs-attention cue", () => {
    render(<AttachmentRowTrailing threadId="t-1" file={file({ expires_at: new Date(Date.now() + 0.5 * HOUR).toISOString() })} />)
    expect(screen.getByText(/expires in \d+m/).className).toMatch(/text-amber-500/)
  })

  it("clicking the ⋯ opens its menu and never reaches the row's click handler", async () => {
    const onRowClick = vi.fn()
    const { container } = render(
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events
      <div role="option" aria-selected={false} tabIndex={0} onClick={onRowClick}>
        <AttachmentRowTrailing threadId="t-1" file={file()} />
      </div>,
    )
    await userEvent.setup().click(more(container)[0])
    expect(onRowClick).not.toHaveBeenCalled()
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([COPY.netNew.saveVerbMenu])
  })

  it("no viewed thread → the scope word and no ⋯", () => {
    const { container } = render(<AttachmentRowTrailing threadId={null} file={file()} />)
    expect(container.textContent).toContain(COPY.engine.CHIP_SCOPE)
    expect(more(container)).toHaveLength(0)
  })
})
