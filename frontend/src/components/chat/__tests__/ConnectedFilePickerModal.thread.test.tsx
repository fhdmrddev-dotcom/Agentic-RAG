/**
 * Phase 244 plan 06 Task 3 (SHELL-04 / D-244-05 / D-244-23 / D-244-27 / BUG-260905-01) —
 * THE COMPOSER'S CLOUD DOOR MEANS *THIS CONVERSATION*.
 *
 * ⛔ THE NEGATIVE IS THE POINT OF THIS FILE. The ROADMAP's named failure mode for `SHELL-04` is
 * *"a local attach that quietly writes to the Library anyway"*, and a positive-only test — "the
 * workspace client was called" — cannot see it, because BOTH calls succeeding also passes. Test 1
 * therefore asserts that `importCloudFile` (the Library minter's client) is **not called at all**.
 *
 * ⛔ AND THE COMPOSITION, NOT ONLY THE VOCABULARY (`D-244-27`). The 2026-08-29 correction recorded
 * **200 green assertions** over a surface the operator called *"nothing at all like what we
 * designed"*, because the contract asserted words and never order. Sketch 236's § Build Contract
 * names this block as *title · source line · file list with single-select · cancel + confirm*, and
 * `index.html` § `modalHTML` draws exactly that (`.mtop` → `<h3>` + `<p>`, then `.flist`, then
 * `.mbot` with **cancel BEFORE confirm**). Tests 7 + 8 fence it by DOM order.
 *
 * ⛔ NEVER `getAllByTestId(...)[0]` — that is QUERY order, not DOCUMENT order, and the two agree
 * often enough to make a reordering bug invisible.
 */
import { render, screen, waitFor, within, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ConnectedFilePickerModal } from "../ConnectedFilePickerModal"
import { MessageInput, _resetComposerDraftsForTest } from "../MessageInput"
import { COPY } from "../composerCopy"
import * as api from "@/lib/api"

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<any>("@/lib/api")
  return {
    ...actual,
    listConnectorConnections: vi.fn(),
    listCloudFiles: vi.fn(),
    importCloudFile: vi.fn(),
    attachConnectionFileToThread: vi.fn(),
    uploadWorkspaceTemplate: vi.fn(),
  }
})

/** `a` comes BEFORE `b` in document order. The primitive, stated once. */
function precedes(a: Element, b: Element): boolean {
  return Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
}

const CLOUD_CONN = {
  id: "conn-cloud",
  org_id: "org-1",
  name: "Meridian Supply",
  service_id: "google_workspace",
  capability: null,
  is_enabled: true,
  config: {},
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
}

const CLOUD_FILES = [
  { id: "cf-1", name: "Meridian-Q4-pricing.xlsx", size: 86_016, modified_at: "2026-09-01T00:00:00Z" },
  { id: "cf-2", name: "Supply-agreement.pdf", size: 240_128, modified_at: "2026-09-02T00:00:00Z" },
  { id: "cf-3", name: "Notes.md", size: 1_024, modified_at: "2026-09-03T00:00:00Z" },
]

const ATTACHED = {
  id: "wf-cloud-1",
  path: "Meridian-Q4-pricing.xlsx",
  size_bytes: 86_016,
  mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  kind: "template_input",
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 23 * 3_600_000).toISOString(),
}

function seedPointerShims() {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
}

/** Open the composer's `+` menu and click the cloud door. */
async function openCloudDoorFromComposer(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId(COPY.engine.PLUS_BTN_TESTID))
  await user.click(await screen.findByText(COPY.a.itemCloud))
  return screen.findByTestId("cloud-file-picker")
}

describe("The composer's cloud door — this conversation, not the Library", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetComposerDraftsForTest()
    seedPointerShims()
    vi.mocked(api.listConnectorConnections).mockResolvedValue([CLOUD_CONN] as any)
    vi.mocked(api.listCloudFiles).mockResolvedValue({ files: CLOUD_FILES } as any)
    vi.mocked(api.attachConnectionFileToThread).mockResolvedValue(ATTACHED as any)
  })

  afterEach(() => cleanup())

  // ── 1 · the NEGATIVE — no Library row is minted from the chat ──────────────────────────
  it("1 — confirming a cloud pick calls the THREAD-scoped path and NEVER the Library minter", async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={vi.fn()} disabled={false} threadId="t-1" />)
    await waitFor(() => expect(api.listConnectorConnections).toHaveBeenCalled())

    const modal = await openCloudDoorFromComposer(user)
    await within(modal).findByText(CLOUD_FILES[0].name)
    await user.click(within(modal).getByText(CLOUD_FILES[0].name))
    await user.click(within(modal).getByTestId("cloud-confirm"))

    await waitFor(() =>
      expect(api.attachConnectionFileToThread).toHaveBeenCalledWith("t-1", "conn-cloud", "cf-1"),
    )
    // ⛔ THE ROADMAP's named failure mode. A positive-only assertion cannot see this.
    expect(api.importCloudFile).not.toHaveBeenCalled()
  })

  // ── 2 · the person's typed words are their own ─────────────────────────────────────────
  it("2 — a cloud pick produces a CHIP and leaves the draft textarea byte-unchanged", async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={vi.fn()} disabled={false} threadId="t-1" />)
    await waitFor(() => expect(api.listConnectorConnections).toHaveBeenCalled())

    const textarea = screen.getByPlaceholderText(COPY.shared.composerPlaceholder) as HTMLTextAreaElement
    await user.type(textarea, "what does this say about pricing")
    const typed = textarea.value

    const modal = await openCloudDoorFromComposer(user)
    await within(modal).findByText(CLOUD_FILES[0].name)
    await user.click(within(modal).getByText(CLOUD_FILES[0].name))
    await user.click(within(modal).getByTestId("cloud-confirm"))

    const chip = await screen.findByTestId("chat-attachment-chip")
    expect(chip.textContent).toContain(ATTACHED.path)
    // ⛔ D-244-02's explicitly REJECTED arm: the composer must never edit the person's text.
    expect(textarea.value).toBe(typed)
    expect(textarea.value).not.toContain("Attached file:")
  })

  // ── 3 · the ported words, and the forbidden one ────────────────────────────────────────
  it("3 — title / source line / confirm read COPY.a, and the confirm is NOT `Import`", async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={vi.fn()} disabled={false} threadId="t-1" />)
    await waitFor(() => expect(api.listConnectorConnections).toHaveBeenCalled())

    const modal = await openCloudDoorFromComposer(user)
    expect(within(modal).getByTestId("cloud-title").textContent).toBe(COPY.a.cloudTitle)
    expect(within(modal).getByTestId("cloud-source").textContent).toBe(
      COPY.a.cloudSub("Google Drive", CLOUD_CONN.name),
    )
    const confirm = within(modal).getByTestId("cloud-confirm")
    expect(confirm.textContent).toBe(COPY.a.cloudConfirm)
    expect(confirm.textContent).not.toContain("Import")
    expect(within(modal).getByTestId("cloud-cancel").textContent).toBe(COPY.a.cloudCancel)
    // ⛔ D-244-23: `Import` is the LIBRARY door's word and must not appear on this path at all.
    expect(modal.textContent).not.toContain("Import")
  })

  // ── 3b · the port itself — `cloudSub` is the sketch's line, not a re-typing ────────────
  it("3b — COPY.a.cloudSub rebuilds the sketch's own literal", async () => {
    // The sketch's value is `From Google Drive · Meridian Supply` — scenario-flavoured, so the
    // port is a BUILDER. Feeding the scenario's own two nouns must reproduce it verbatim.
    expect(COPY.a.cloudSub("Google Drive", "Meridian Supply")).toBe(
      "From Google Drive · Meridian Supply",
    )
  })

  // ── 4 · variant B's arm is not taken ───────────────────────────────────────────────────
  it("4 — the modal renders NO destination chip (variant B, recorded not shipped)", async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={vi.fn()} disabled={false} threadId="t-1" />)
    await waitFor(() => expect(api.listConnectorConnections).toHaveBeenCalled())

    const modal = await openCloudDoorFromComposer(user)
    // B's title and its in-modal destination chip (`COPY.b.cloudTitle` = "Add to this chat",
    // `cloudConfirm` = "Add to this chat", the chip carrying the THREAD TITLE).
    expect(modal.textContent).not.toContain("Add to this chat")
    expect(within(modal).queryByTestId("cloud-destination")).toBeNull()
  })

  // ── 5 · one refusal vocabulary, not two ────────────────────────────────────────────────
  it("5 — a failure renders the SERVER's sentence in the composer's existing refusal region", async () => {
    const SERVER_422 = COPY.engine.REFUSE_TYPE(".key", ".csv, .docx")
    vi.mocked(api.attachConnectionFileToThread).mockRejectedValue(new Error(SERVER_422))
    const user = userEvent.setup()
    render(<MessageInput onSend={vi.fn()} disabled={false} threadId="t-1" />)
    await waitFor(() => expect(api.listConnectorConnections).toHaveBeenCalled())

    const modal = await openCloudDoorFromComposer(user)
    await within(modal).findByText(CLOUD_FILES[0].name)
    await user.click(within(modal).getByText(CLOUD_FILES[0].name))
    await user.click(within(modal).getByTestId("cloud-confirm"))

    const alert = await screen.findByTestId("composer-refusal")
    expect(alert.getAttribute("role")).toBe("alert")
    // ⭐ The SAME three atoms the local door's refusal renders — one vocabulary, not two.
    expect(alert.querySelector("[data-refusal-file]")?.textContent).toBe(CLOUD_FILES[0].name)
    expect(alert.querySelector("[data-refusal-sentence]")?.textContent).toBe(SERVER_422)
    expect(alert.querySelector("[data-refusal-dismiss]")).not.toBeNull()
  })

  // ── 6 · the BOTH-DOORS invariant — D-244-05's executable form ──────────────────────────
  it("6 — a chip from the CLOUD door carries `this chat only`, exactly as the local door's does", async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={vi.fn()} disabled={false} threadId="t-1" />)
    await waitFor(() => expect(api.listConnectorConnections).toHaveBeenCalled())

    const modal = await openCloudDoorFromComposer(user)
    await within(modal).findByText(CLOUD_FILES[0].name)
    await user.click(within(modal).getByText(CLOUD_FILES[0].name))
    await user.click(within(modal).getByTestId("cloud-confirm"))

    const chip = await screen.findByTestId("chat-attachment-chip")
    expect(chip.textContent).toContain(COPY.a.chipScope)
  })

  // ── 7 · THE ORDERED BLOCK (`D-244-27`) ─────────────────────────────────────────────────
  it("7 — title -> source line -> file list -> cancel -> confirm, in DOCUMENT order, single-select", async () => {
    const user = userEvent.setup()
    render(
      <ConnectedFilePickerModal open onOpenChange={vi.fn()} connections={[CLOUD_CONN] as any} onConfirm={vi.fn()} />,
    )
    const modal = await screen.findByTestId("cloud-file-picker")
    await within(modal).findByText(CLOUD_FILES[0].name)

    const title = within(modal).getByTestId("cloud-title")
    const source = within(modal).getByTestId("cloud-source")
    const list = within(modal).getByTestId("cloud-filelist")
    const cancel = within(modal).getByTestId("cloud-cancel")
    const confirm = within(modal).getByTestId("cloud-confirm")

    expect(precedes(title, source)).toBe(true)
    expect(precedes(source, list)).toBe(true)
    expect(precedes(list, cancel)).toBe(true)
    expect(precedes(cancel, confirm)).toBe(true) // ⛔ cancel BEFORE confirm — the mockup's order

    // SINGLE-SELECT, asserted by COUNT. ⛔ "the row I clicked is selected" would also pass on a
    // list that selected BOTH, which is exactly the drift this case exists to catch.
    await user.click(within(modal).getByText(CLOUD_FILES[0].name))
    expect(modal.querySelectorAll("[data-cloud-row-selected='true']").length).toBe(1)
    await user.click(within(modal).getByText(CLOUD_FILES[1].name))
    expect(modal.querySelectorAll("[data-cloud-row-selected='true']").length).toBe(1)
    expect(
      modal.querySelector("[data-cloud-row-selected='true']")?.textContent,
    ).toContain(CLOUD_FILES[1].name)
  })

  // ── 8 · the negative that makes 7 real ────────────────────────────────────────────────
  it("8 — the same order assertion FAILS on a fixture drawing the footer above the list", async () => {
    // ⛔ A fence nobody has seen fire is a presence assertion wearing a costume. This is Test 7's
    // ordered predicate run against a deliberately mis-composed block; it must NOT hold.
    function MisComposed() {
      return (
        <div data-testid="mis-composed">
          <h3 data-testid="x-title">t</h3>
          <p data-testid="x-source">s</p>
          <div data-testid="x-cancel">c</div>
          <div data-testid="x-confirm">k</div>
          <div data-testid="x-filelist">l</div>
        </div>
      )
    }
    render(<MisComposed />)
    const root = screen.getByTestId("mis-composed")
    const list = within(root).getByTestId("x-filelist")
    const cancel = within(root).getByTestId("x-cancel")
    expect(precedes(list, cancel)).toBe(false)
  })
})
