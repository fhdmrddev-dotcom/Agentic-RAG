/**
 * Phase 244 plan 05 Tasks 2+3 (SHELL-04 / D-244-26 / D-244-27) —
 * THE ORDERED-BLOCK COMPOSITION FENCE for the composer's attach door.
 *
 * ⛔ A TEXT-ONLY CONTRACT IS NOT SUFFICIENT, and this suite exists because of a measured failure,
 * not a preference. The 2026-08-29 correction recorded **200 green assertions** over a surface the
 * operator called *"nothing at all like what we designed"* — because the contract asserted
 * VOCABULARY and never COMPOSITION. So sketch 236's README names the ordered blocks and their
 * required atoms, and this file asserts them **by DOM order**, with `compareDocumentPosition`.
 *
 * ⛔ NEVER `getAllByTestId(...)[0]`. That is QUERY order, not DOCUMENT order, and the two agree
 * often enough to make a reordering bug invisible.
 *
 * ⛔ EVERY WORD IS READ FROM THE PORT (`composerCopy`), which is itself fenced against the
 * sketch's `COPY.js` by `ChatAttachmentChip.states.test.tsx` Test 5.
 */
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { MessageInput, _resetComposerDraftsForTest } from "../MessageInput"
import { COPY } from "../composerCopy"
import * as api from "@/lib/api"

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<any>("@/lib/api")
  return {
    ...actual,
    listConnectorConnections: vi.fn(),
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
  name: "Google Workspace",
  service_id: "google_workspace",
  capability: null,
  is_enabled: true,
  config: {},
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
}

const SLACK_CONN = { ...CLOUD_CONN, id: "conn-slack", name: "Slack Ops", service_id: "slack" }

const UPLOADED = {
  id: "wf-1",
  path: "Meridian-Q4-pricing.xlsx",
  size_bytes: 86_016,
  mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  kind: "template_input",
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 23 * 3_600_000).toISOString(),
}

function pickFile(name = "Meridian-Q4-pricing.xlsx") {
  const input = screen.getByTestId("composer-attach-input") as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File(["x"], name)] } })
  return input
}

describe("Composer attach — the ordered blocks sketch 236 draws", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetComposerDraftsForTest()
    if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
    if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
    if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
    vi.mocked(api.listConnectorConnections).mockResolvedValue([CLOUD_CONN] as any)
    vi.mocked(api.uploadWorkspaceTemplate).mockResolvedValue(UPLOADED as any)
  })

  // ── Block: the `+` menu ────────────────────────────────────────────────────────────────
  it("1 — the menu renders local -> cloud -> connectors, in THAT order, with COPY.a's words", async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={vi.fn()} disabled={false} threadId="t-1" />)
    await waitFor(() => expect(api.listConnectorConnections).toHaveBeenCalled())

    await user.click(screen.getByTestId(COPY.engine.PLUS_BTN_TESTID))

    const local = await screen.findByText(COPY.a.itemLocal)
    const cloud = await screen.findByText(COPY.a.itemCloud)
    const connectors = await screen.findByText(COPY.a.itemConnectors)

    // ⛔ DOCUMENT order, not query order.
    expect(precedes(local, cloud)).toBe(true)
    expect(precedes(cloud, connectors)).toBe(true)
  })

  it("2 — the ONE-ITEM case: no cloud connection, no orphaned divider, the local item reads alone", async () => {
    vi.mocked(api.listConnectorConnections).mockResolvedValue([SLACK_CONN] as any)
    const user = userEvent.setup()
    render(<MessageInput onSend={vi.fn()} disabled={false} threadId="t-1" />)
    await waitFor(() => expect(api.listConnectorConnections).toHaveBeenCalled())

    await user.click(screen.getByTestId(COPY.engine.PLUS_BTN_TESTID))

    const local = await screen.findByText(COPY.a.itemLocal)
    expect(local).toBeDefined()
    // D-244-26: `hasCloudStorage` is false, so the cloud door is ABSENT entirely.
    expect(screen.queryByText(COPY.a.itemCloud)).toBeNull()
    // …and the local item must still read correctly BY ITSELF — it is the first child of the
    // file group, with nothing dangling above it.
    const group = screen.getByTestId("composer-attach-group")
    expect(within(group).queryByText(COPY.a.itemCloud)).toBeNull()
    expect(group.children.length).toBe(1)
  })

  it("3 — variant A's menu is PLAIN: no header and no footer (B's arm cannot drift in)", async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={vi.fn()} disabled={false} threadId="t-1" />)
    await user.click(screen.getByTestId(COPY.engine.PLUS_BTN_TESTID))
    await screen.findByText(COPY.a.itemLocal)

    // The two strings D-244-23 records in the sketch and does NOT ship.
    expect(screen.queryByText("Add a file to this chat")).toBeNull()
    expect(
      screen.queryByText("Files here stay in this chat. The Library is for files you keep."),
    ).toBeNull()
  })

  // ── Block: the composer chips row ──────────────────────────────────────────────────────
  it("4 — the HOISTED row: an attachment with NO connectors still renders the chip", async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={vi.fn()} disabled={false} threadId="t-1" />)
    await waitFor(() => expect(api.listConnectorConnections).toHaveBeenCalled())

    await user.click(screen.getByTestId(COPY.engine.PLUS_BTN_TESTID))
    await user.click(await screen.findByText(COPY.a.itemLocal))
    pickFile()

    // ⛔ THIS IS THE RULING'S EXECUTABLE FORM. `ActiveConnectorChips` returns `null` when no
    // connector is armed, so a `children` slot INSIDE it would make the attachment chip vanish
    // for a person with no connector — precisely the case D-244-26 orders checked. The row
    // container is therefore owned by `MessageInput`, and the chips component is bare.
    const chip = await screen.findByTestId("chat-attachment-chip")
    const row = screen.getByTestId("active-connector-chips")
    expect(row.contains(chip)).toBe(true)
    expect(screen.queryByTestId("active-connector-chip-conn-cloud")).toBeNull()
  })

  it("5 — a connector with NO attachment renders the row exactly as today; NEITHER renders nothing", async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={vi.fn()} disabled={false} threadId="t-1" />)
    await waitFor(() => expect(api.listConnectorConnections).toHaveBeenCalled())

    // S-2: with neither an attachment nor a connector, there is NO row and no reserved space.
    expect(screen.queryByTestId("active-connector-chips")).toBeNull()

    await user.click(screen.getByTestId(COPY.engine.PLUS_BTN_TESTID))
    await user.click(await screen.findByTestId("connector-toggle-conn-cloud"))

    const row = await screen.findByTestId("active-connector-chips")
    expect(within(row).getByTestId("active-connector-chip-conn-cloud")).toBeDefined()
    // The shipped label, unchanged by the hoist.
    expect(row.textContent).toContain("Using:")
    expect(screen.queryByTestId("chat-attachment-chip")).toBeNull()
  })

  // ── Block: the refusal ─────────────────────────────────────────────────────────────────
  it("6 — a refusal renders the SERVER's sentence verbatim, for all three 422s", async () => {
    const sentences = [
      COPY.engine.REFUSE_TYPE(".pdf", [...COPY.engine.ALLOWED_EXT].sort().join(", ")),
      COPY.engine.REFUSE_SIZE,
      COPY.engine.REFUSE_EMPTY,
    ]
    for (const sentence of sentences) {
      vi.mocked(api.uploadWorkspaceTemplate).mockRejectedValueOnce(new Error(sentence))
      const { unmount } = render(<MessageInput onSend={vi.fn()} disabled={false} threadId="t-1" />)
      pickFile("Meridian-contract-signed.pdf")

      const alert = await screen.findByRole("alert")
      // ⛔ the SENTENCE, not "an error element exists".
      expect(alert.textContent).toContain(sentence)
      unmount()
    }
  })

  it("6b — the refusal's THREE atoms, in DOCUMENT order: filename -> sentence -> dismiss", async () => {
    const sentence = COPY.engine.REFUSE_TYPE(".pdf", ".csv, .docx")
    vi.mocked(api.uploadWorkspaceTemplate).mockRejectedValueOnce(new Error(sentence))
    render(<MessageInput onSend={vi.fn()} disabled={false} threadId="t-1" />)
    pickFile("Meridian-contract-signed.pdf")

    const alert = await screen.findByRole("alert")
    const name = alert.querySelector("[data-refusal-file]")
    const dismiss = alert.querySelector("[data-refusal-dismiss]")
    const said = alert.querySelector("[data-refusal-sentence]")

    // ⚠ The approved mockup DRAWS all three (`index.html` § refuseHTML: <b> filename, <code>
    // sentence, <button class="ok">). None is optional and none may be dropped as "redundant" —
    // a silent narrowing here is the precise failure D-244-27 was written to stop.
    expect(name).not.toBeNull()
    expect(said).not.toBeNull()
    expect(dismiss).not.toBeNull()

    expect(name!.textContent).toContain("Meridian-contract-signed.pdf")
    expect(said!.textContent).toBe(sentence)
    expect(dismiss!.textContent).toContain(COPY.shared.refusalDismiss)

    expect(precedes(name!, said!)).toBe(true)
    expect(precedes(said!, dismiss!)).toBe(true)
  })

  it("6c — the dismiss WORKS: clicking it removes the refusal region entirely", async () => {
    const user = userEvent.setup()
    vi.mocked(api.uploadWorkspaceTemplate).mockRejectedValueOnce(new Error(COPY.engine.REFUSE_SIZE))
    render(<MessageInput onSend={vi.fn()} disabled={false} threadId="t-1" />)
    pickFile("huge.xlsx")

    const alert = await screen.findByRole("alert")
    await user.click(alert.querySelector("[data-refusal-dismiss]") as HTMLElement)

    // ⛔ asserted on the REGION's absence, never on a state variable.
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull())
    // …and the composer is still usable.
    expect(screen.getByPlaceholderText(COPY.shared.composerPlaceholder)).toBeDefined()
  })

  it("7 — re-selecting the SAME file fires the change handler again", async () => {
    render(<MessageInput onSend={vi.fn()} disabled={false} threadId="t-1" />)
    const input = pickFile()
    await waitFor(() => expect(api.uploadWorkspaceTemplate).toHaveBeenCalledTimes(1))

    // The `e.target.value = ""` reset from `TemplateUpload` — a real bug a build drops silently:
    // without it the browser fires no `change` for an identical second selection.
    expect(input.value).toBe("")

    fireEvent.change(input, { target: { files: [new File(["x"], "Meridian-Q4-pricing.xlsx")] } })
    await waitFor(() => expect(api.uploadWorkspaceTemplate).toHaveBeenCalledTimes(2))
  })

  it("7b — the accept attribute is the FENCED constant, never a hand-typed list", async () => {
    render(<MessageInput onSend={vi.fn()} disabled={false} threadId="t-1" />)
    const input = screen.getByTestId("composer-attach-input") as HTMLInputElement
    // 244-02 collapsed three hand-typed copies into one `?raw`-fenced constant. A fourth here
    // would be invisible to that fence.
    expect(input.getAttribute("accept")).toBe([...COPY.engine.ALLOWED_EXT].join(","))
  })
})
