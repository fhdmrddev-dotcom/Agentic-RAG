/**
 * Phase 305-04 (GUARD-03, D-36, D-37; UI-SPEC Surface 1) — the org admin's PII redaction switch.
 *
 * Prices the ways a privacy switch can lie: a guessed value after a failed read, an optimistic
 * flip the server refused, a flip with no visible record, and a switch whose limits are only
 * readable AFTER flipping it. Assertions read RENDERED WORDS and the switch's aria state — never
 * `data-testid` presence alone.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const m = vi.hoisted(() => ({
  getOrgMcpAccess: vi.fn(),
  setOrgMcpAccess: vi.fn(),
  getOrgPiiRedaction: vi.fn(),
  setOrgPiiRedaction: vi.fn(),
}))

vi.mock("@/lib/api/apiKeys", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/apiKeys")>()
  return { ...actual, ...m }
})

import { OrgPiiRedactionCard } from "../OrgPiiRedactionCard"
import { OrgSettingsTab } from "../OrgSettingsTab"

const TITLE = "Remove personal data from AI tool results"
const SUB =
  "When on, search results and documents sent to members' AI tools in Acme Inc have email addresses, phone numbers, card numbers, IBANs and secrets such as API keys replaced with a short note, like [email removed]."
const NOT_COVERED =
  "Names are not covered. If a result can't be checked, it is withheld rather than sent. Document ids, citations and Open in Syrel links are never changed."

function expectBothSubLines(card: HTMLElement) {
  expect(within(card).getByText(SUB)).toBeInTheDocument()
  expect(within(card).getByText(NOT_COVERED)).toBeInTheDocument()
}

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset()
  m.getOrgMcpAccess.mockResolvedValue({ enabled: true })
})

describe("305-04 OrgPiiRedactionCard", () => {
  it("says Loading… with no switch, and both sub lines already read", async () => {
    m.getOrgPiiRedaction.mockReturnValue(new Promise(() => {}))
    render(<OrgPiiRedactionCard orgName="Acme Inc" />)
    const card = screen.getByTestId("org-pii-redaction")
    expect(within(card).getByText("Loading…")).toBeInTheDocument()
    expect(within(card).queryByRole("switch")).toBeNull()
    expectBothSubLines(card)
  })

  it("OFF is calm: switch unchecked, no tag, no armed colour, both sub lines", async () => {
    m.getOrgPiiRedaction.mockResolvedValue({ enabled: false })
    render(<OrgPiiRedactionCard orgName="Acme Inc" />)
    const sw = await screen.findByRole("switch", { name: TITLE })
    expect(sw).toHaveAttribute("aria-checked", "false")
    const card = screen.getByTestId("org-pii-redaction")
    expect(card).toHaveAttribute("data-on", "false")
    expect(card.className).not.toContain("destructive")
    expect(sw.className).not.toContain("destructive")
    expect(within(card).queryByText("on for Acme Inc")).toBeNull()
    expectBothSubLines(card)
  })

  it("the switch is described by the two sub lines", async () => {
    m.getOrgPiiRedaction.mockResolvedValue({ enabled: false })
    render(<OrgPiiRedactionCard orgName="Acme Inc" />)
    const sw = await screen.findByRole("switch", { name: TITLE })
    const ids = (sw.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean)
    expect(ids).toHaveLength(2)
    const described = ids.map((id) => document.getElementById(id)?.textContent)
    expect(described).toEqual([SUB, NOT_COVERED])
  })

  it("a failed read shows the words and Retry, NO switch, and the sub lines still read", async () => {
    const user = userEvent.setup()
    m.getOrgPiiRedaction.mockRejectedValueOnce(new Error("Forbidden.")).mockResolvedValueOnce({ enabled: true })
    render(<OrgPiiRedactionCard orgName="Acme Inc" />)
    expect(await screen.findByText("Couldn't load this setting.")).toBeInTheDocument()
    expect(screen.queryByRole("switch")).toBeNull()
    expectBothSubLines(screen.getByTestId("org-pii-redaction"))
    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByRole("switch", { name: TITLE })).toHaveAttribute("aria-checked", "true")
    expect(m.getOrgPiiRedaction).toHaveBeenCalledTimes(2)
  })

  it("turning it on is disabled in flight, then shows the SERVER's answer, the tag, and records once", async () => {
    const user = userEvent.setup()
    const onRecorded = vi.fn()
    m.getOrgPiiRedaction.mockResolvedValue({ enabled: false })
    let resolveWrite: (v: { enabled: boolean }) => void = () => {}
    m.setOrgPiiRedaction.mockImplementation(
      () => new Promise<{ enabled: boolean }>((r) => {
        resolveWrite = r
      }),
    )
    render(<OrgPiiRedactionCard orgName="Acme Inc" onRecorded={onRecorded} />)
    const sw = await screen.findByRole("switch", { name: TITLE })
    await user.click(sw)
    expect(m.setOrgPiiRedaction).toHaveBeenCalledWith(true)
    expect(sw).toHaveAttribute("aria-checked", "false") // never optimistic
    expect(sw).toBeDisabled()
    expect(onRecorded).not.toHaveBeenCalled()
    resolveWrite({ enabled: true })
    await waitFor(() => expect(sw).toHaveAttribute("aria-checked", "true"))
    expect(sw).not.toBeDisabled()
    expect(onRecorded).toHaveBeenCalledTimes(1)
    const card = screen.getByTestId("org-pii-redaction")
    expect(card).toHaveAttribute("data-on", "true")
    expect(within(card).getByText("on for Acme Inc")).toBeInTheDocument()
    expectBothSubLines(card)
  })

  it("shows what the server stored, even when it differs from the click", async () => {
    const user = userEvent.setup()
    m.getOrgPiiRedaction.mockResolvedValue({ enabled: false })
    m.setOrgPiiRedaction.mockResolvedValue({ enabled: false })
    render(<OrgPiiRedactionCard orgName="Acme Inc" />)
    const sw = await screen.findByRole("switch", { name: TITLE })
    await user.click(sw)
    await waitFor(() => expect(m.setOrgPiiRedaction).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(sw).not.toBeDisabled())
    expect(sw).toHaveAttribute("aria-checked", "false")
    expect(screen.queryByText("on for Acme Inc")).toBeNull()
  })

  it("turning it off is a direct flip with no impact line", async () => {
    const user = userEvent.setup()
    m.getOrgPiiRedaction.mockResolvedValue({ enabled: true })
    m.setOrgPiiRedaction.mockResolvedValue({ enabled: false })
    render(<OrgPiiRedactionCard orgName="Acme Inc" />)
    const sw = await screen.findByRole("switch", { name: TITLE })
    await user.click(sw)
    await waitFor(() => expect(sw).toHaveAttribute("aria-checked", "false"))
    expect(m.setOrgPiiRedaction).toHaveBeenCalledWith(false)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("a failed write stays put, says so as a status, and records nothing", async () => {
    const user = userEvent.setup()
    const onRecorded = vi.fn()
    m.getOrgPiiRedaction.mockResolvedValue({ enabled: false })
    m.setOrgPiiRedaction.mockRejectedValue(new Error("boom"))
    render(<OrgPiiRedactionCard orgName="Acme Inc" onRecorded={onRecorded} />)
    const sw = await screen.findByRole("switch", { name: TITLE })
    await user.click(sw)
    const status = await screen.findByRole("status")
    expect(status).toHaveTextContent("Couldn't change it. Try again.")
    expect(sw).toHaveAttribute("aria-checked", "false")
    expect(onRecorded).not.toHaveBeenCalled()
  })
})

describe("305-04 OrgSettingsTab mounts the card directly under the MCP switch", () => {
  it("renders the redaction card right after OrgMcpSwitchCard, with the org's name and onRecorded", async () => {
    const user = userEvent.setup()
    const onRecorded = vi.fn()
    m.getOrgPiiRedaction.mockResolvedValue({ enabled: false })
    m.setOrgPiiRedaction.mockResolvedValue({ enabled: true })
    render(<OrgSettingsTab orgName="Acme Inc" onRecorded={onRecorded} />)
    const mcp = screen.getByTestId("org-mcp-switch")
    const pii = screen.getByTestId("org-pii-redaction")
    expect(mcp.nextElementSibling).toBe(pii)
    expect(within(pii).getByText(SUB)).toBeInTheDocument()
    await user.click(await within(pii).findByRole("switch", { name: TITLE }))
    await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1))
  })
})
