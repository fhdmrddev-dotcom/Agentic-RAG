/**
 * Phase 307-05 (D-08, D-51; UI-SPEC Surface 5; A-18, A-19, A-25) — Control Room → Controls →
 * "AI tool sign-in: return addresses".
 *
 * Prices the ways a policy list can lie: guessed rows after a failed read, a row that appears
 * before the server stored it, input silently rewritten on the client, a one-click remove of a
 * global setting, and a write with no visible record. Assertions read RENDERED WORDS.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import cardRaw from "../McpSignInHostsCard.tsx?raw"

const m = vi.hoisted(() => ({
  getSignInHosts: vi.fn(),
  allowSignInHost: vi.fn(),
  removeSignInHost: vi.fn(),
}))

vi.mock("@/lib/api/oauth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/oauth")>()
  return { ...actual, ...m }
})

import { McpSignInHostsCard } from "../McpSignInHostsCard"
import { TechnicalNamesProvider, useTechnicalNames } from "@/providers/TechnicalNamesProvider"
import { ApiError } from "@/lib/api/_core"

const BUILT_IN = [
  { host: "claude.ai", built_in: true, added_by_name: null, added_at: null },
  { host: "claude.com", built_in: true, added_by_name: null, added_at: null },
]
const ADDED = { host: "chat.example.com", built_in: false, added_by_name: "op@syrel.example", added_at: "2026-11-01T10:00:00Z" }

beforeEach(() => {
  m.getSignInHosts.mockReset()
  m.allowSignInHost.mockReset()
  m.removeSignInHost.mockReset()
  window.localStorage.clear()
})

describe("307-05 McpSignInHostsCard", () => {
  it("loads, then lists hosts with built in / added by, and the hint", async () => {
    m.getSignInHosts.mockResolvedValue({ hosts: [...BUILT_IN, ADDED] })
    render(<McpSignInHostsCard />)
    expect(screen.getByText("Loading…")).toBeInTheDocument()
    const card = await screen.findByTestId("mcp-sign-in-hosts")
    expect(within(card).getByText("AI tool sign-in: return addresses")).toBeInTheDocument()
    expect(card).toHaveTextContent(
      "After someone signs in, an app may only send them back to one of these addresses. Apps on the person's own computer (localhost) are always allowed and are not listed.",
    )
    const row = await within(card).findByTestId("sign-in-host-claude.ai")
    expect(row).toHaveTextContent("built in")
    expect(within(card).getByTestId("sign-in-host-chat.example.com")).toHaveTextContent(/added by op@syrel\.example on/)
    expect(within(card).getByRole("button", { name: "Remove claude.ai" })).toBeInTheDocument()
    expect(card).toHaveTextContent("A host name only, like claude.ai. No https://, path, port or *.")
  })

  it("a failed read shows no rows and no add control, only Retry", async () => {
    m.getSignInHosts.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce({ hosts: BUILT_IN })
    render(<McpSignInHostsCard />)
    expect(await screen.findByText("Couldn't load this setting.")).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Address to allow" })).toBeNull()
    expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByTestId("sign-in-host-claude.ai")).toBeInTheDocument()
  })

  it("Allow address sends the typed value VERBATIM; the row appears from the server's answer and the band pulses", async () => {
    m.getSignInHosts.mockResolvedValue({ hosts: BUILT_IN })
    let finish: (v: unknown) => void = () => {}
    m.allowSignInHost.mockReturnValue(new Promise((r) => (finish = r)))
    const onRecorded = vi.fn()
    render(<McpSignInHostsCard onRecorded={onRecorded} />)
    const input = await screen.findByRole("textbox", { name: "Address to allow" })
    expect(input).toHaveAttribute("placeholder", "e.g. claude.ai")
    await userEvent.type(input, "chat.example.com{Enter}")
    expect(m.allowSignInHost).toHaveBeenCalledWith("chat.example.com")
    expect(screen.queryByTestId("sign-in-host-chat.example.com")).toBeNull() // never optimistic
    finish({ hosts: [...BUILT_IN, ADDED] })
    expect(await screen.findByTestId("sign-in-host-chat.example.com")).toBeInTheDocument()
    expect(onRecorded).toHaveBeenCalledTimes(1)
  })

  it("a refusal shows the server's sentence under the add row and keeps the typed value", async () => {
    m.getSignInHosts.mockResolvedValue({ hosts: BUILT_IN })
    m.allowSignInHost.mockRejectedValue(new ApiError("Type the host name only, without https://.", 422))
    const onRecorded = vi.fn()
    render(<McpSignInHostsCard onRecorded={onRecorded} />)
    const input = await screen.findByRole("textbox", { name: "Address to allow" })
    await userEvent.type(input, "https://Chat.example.com")
    await userEvent.click(screen.getByRole("button", { name: "Allow address" }))
    expect(m.allowSignInHost).toHaveBeenCalledWith("https://Chat.example.com") // no client rewrite
    const msg = await screen.findByTestId("sign-in-hosts-failure")
    expect(msg).toHaveAttribute("role", "status")
    expect(msg).toHaveTextContent("Couldn't save it. Type the host name only, without https://.")
    expect(input).toHaveValue("https://Chat.example.com")
    expect(onRecorded).not.toHaveBeenCalled()
  })

  it("Remove arms first (focus on Keep), Esc disarms, and only Remove {host} writes", async () => {
    m.getSignInHosts.mockResolvedValue({ hosts: BUILT_IN })
    m.removeSignInHost.mockResolvedValue({ hosts: [BUILT_IN[1]] })
    const onRecorded = vi.fn()
    render(<McpSignInHostsCard onRecorded={onRecorded} />)
    await userEvent.click(await screen.findByRole("button", { name: "Remove claude.ai" }))
    expect(m.removeSignInHost).not.toHaveBeenCalled()
    const armed = screen.getByTestId("sign-in-host-armed")
    expect(armed).toHaveAttribute("aria-live", "polite")
    expect(armed).toHaveTextContent(
      "Stop sending sign-ins to claude.ai? Apps that return there can't connect until it is added again. Apps already connected keep working.",
    )
    const keep = within(armed).getByRole("button", { name: "Keep claude.ai on the list" })
    await waitFor(() => expect(keep).toHaveFocus())
    await userEvent.keyboard("{Escape}")
    expect(screen.queryByTestId("sign-in-host-armed")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Remove claude.ai" }))
    await userEvent.click(within(screen.getByTestId("sign-in-host-armed")).getByRole("button", { name: "Remove claude.ai" }))
    expect(m.removeSignInHost).toHaveBeenCalledWith("claude.ai")
    await waitFor(() => expect(screen.queryByTestId("sign-in-host-claude.ai")).toBeNull())
    expect(onRecorded).toHaveBeenCalledTimes(1)
  })

  it("an empty list says only apps on a person's own computer can sign in", async () => {
    m.getSignInHosts.mockResolvedValue({ hosts: [] })
    render(<McpSignInHostsCard />)
    expect(await screen.findByText("No web app can sign in. Only apps on a person's own computer can.")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Address to allow" })).toBeInTheDocument()
  })

  it("the technical-names reveal shows the app_settings key", async () => {
    m.getSignInHosts.mockResolvedValue({ hosts: BUILT_IN })
    function Reveal() {
      const { setShowTechnical } = useTechnicalNames()
      return (
        <button type="button" onClick={() => setShowTechnical(true)}>
          reveal
        </button>
      )
    }
    render(
      <TechnicalNamesProvider>
        <Reveal />
        <McpSignInHostsCard />
      </TechnicalNamesProvider>,
    )
    await screen.findByTestId("sign-in-host-claude.ai")
    expect(screen.queryByText("mcp_oauth_redirect_hosts")).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "reveal" }))
    expect(screen.getByText("mcp_oauth_redirect_hosts")).toBeInTheDocument()
  })

  it("no word is typed in the component", () => {
    expect(cardRaw).not.toMatch(/>\s*[A-Z][a-z]+ [a-z]+[^<{]*</)
    expect(cardRaw).not.toMatch(/dangerouslySetInnerHTML/)
  })
})
