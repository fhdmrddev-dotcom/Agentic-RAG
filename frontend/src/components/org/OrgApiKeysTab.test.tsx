/**
 * Phase 293-04 (D-03, D-18, T-293-24) — Org admin → API keys: every member's keys, revoke any.
 *
 * Prices UI-SPEC failure 5 (the admin's revoke sheet on Priya's key does not name Priya, or the
 * band marker does not pulse) and the admin-only rules: no New key button (an admin makes keys in
 * Settings like anyone), owner on every card, run links only on the admin's OWN keys.
 * Assertions read RENDERED WORDS.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ApiKeyList } from "@/lib/api/apiKeys"
import { makeCall, makeKey } from "@/components/settings/apiKeys/__tests__/fixtures"

const m = vi.hoisted(() => ({
  listOrgApiKeys: vi.fn(),
  revokeOrgApiKey: vi.fn(),
}))

vi.mock("@/lib/api/apiKeys", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/apiKeys")>()
  return { ...actual, ...m }
})

import { OrgApiKeysTab } from "./OrgApiKeysTab"

const LIMITS = { starts_per_minute: 10, reads_per_minute: 120 }
const MINE = makeKey({ id: "mine", label: "my-script", owner_name: "Dana Kim", owner_is_you: true, calls: [makeCall()] })
const PRIYAS = makeKey({
  id: "priya",
  label: "n8n-prod",
  owner_name: "Priya Shah",
  owner_is_you: false,
  calls: [makeCall({ run_id: "abcdef12-0000" })],
})
const ORG: ApiKeyList = { keys: [MINE, PRIYAS], limits: LIMITS }

beforeEach(() => {
  m.listOrgApiKeys.mockReset()
  m.revokeOrgApiKey.mockReset()
})

describe("293-04 OrgApiKeysTab", () => {
  it("loading, then the header, admin note, limits line and every member's key with its owner", async () => {
    m.listOrgApiKeys.mockResolvedValue(ORG)
    render(<OrgApiKeysTab orgName="Acme Inc" />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading the organisation's keys…")
    expect(await screen.findByText("API keys · whole organisation")).toBeInTheDocument()
    expect(screen.getByText("Every key in Acme Inc. Runs started with a key run as the member who made it.")).toBeInTheDocument()
    expect(screen.getByText("You can see and revoke every member's keys. You can't see their secrets; nobody can.")).toBeInTheDocument()
    expect(screen.getByTestId("api-keys-limits")).toHaveTextContent("Each key: 10 starts and 120 status reads a minute.")
    const metas = screen.getAllByTestId("api-key-meta").map((el) => el.textContent ?? "")
    expect(metas.some((t) => t.startsWith("owner Dana Kim (you)"))).toBe(true)
    expect(metas.some((t) => t.startsWith("owner Priya Shah") && !t.includes("(you)"))).toBe(true)
    expect(screen.queryByRole("button", { name: "New key" })).toBeNull()
  })

  it("a failed read says so and Retry reads again", async () => {
    const user = userEvent.setup()
    m.listOrgApiKeys.mockRejectedValueOnce(new Error("Forbidden.")).mockResolvedValueOnce(ORG)
    render(<OrgApiKeysTab orgName="Acme Inc" />)
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Couldn't load the organisation's keys. Forbidden.")
    await user.click(within(alert).getByRole("button", { name: "Retry" }))
    expect(await screen.findAllByTestId("api-key-card")).toHaveLength(2)
  })

  it("empty names the org and offers no button", async () => {
    m.listOrgApiKeys.mockResolvedValue({ keys: [], limits: LIMITS })
    render(<OrgApiKeysTab orgName="Acme Inc" />)
    expect(await screen.findByText("No member of Acme Inc has made an API key yet.")).toBeInTheDocument()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("run ids are links only on the admin's own keys", async () => {
    const user = userEvent.setup()
    m.listOrgApiKeys.mockResolvedValue(ORG)
    render(<OrgApiKeysTab orgName="Acme Inc" onOpenRun={vi.fn()} />)
    const cards = await screen.findAllByTestId("api-key-card")
    const mine = cards.find((c) => within(c).getByTestId("api-key-label").textContent === "my-script")!
    const hers = cards.find((c) => within(c).getByTestId("api-key-label").textContent === "n8n-prod")!
    await user.click(within(mine).getByRole("button", { name: "Show activity" }))
    await user.click(within(hers).getByRole("button", { name: "Show activity" }))
    expect(within(mine).getByRole("button", { name: "run 7f3a91" })).toBeInTheDocument()
    expect(within(hers).queryByRole("button", { name: "run abcdef" })).toBeNull()
    expect(within(hers).getByText("run abcdef")).toBeInTheDocument()
  })

  it("revoking someone else's key names the owner, re-fetches, then pulses the band", async () => {
    const user = userEvent.setup()
    const onRecorded = vi.fn()
    m.listOrgApiKeys.mockResolvedValueOnce(ORG)
    m.revokeOrgApiKey.mockResolvedValue({ ...PRIYAS, state: "revoked" })
    render(<OrgApiKeysTab orgName="Acme Inc" onRecorded={onRecorded} />)
    await user.click(await screen.findByRole("button", { name: "Revoke n8n-prod" }))
    const sheet = await screen.findByRole("alertdialog")
    expect(within(sheet).getByTestId("revoke-sub")).toHaveTextContent(
      "This key belongs to Priya Shah. They will see that an admin revoked it.",
    )
    m.listOrgApiKeys.mockResolvedValueOnce({
      keys: [MINE, { ...PRIYAS, state: "revoked", revoked_at: PRIYAS.created_at, revoked_by_name: "Dana Kim", revoked_by_admin: true }],
      limits: LIMITS,
    })
    await user.click(within(sheet).getByRole("button", { name: "Revoke n8n-prod" }))
    await waitFor(() => expect(m.revokeOrgApiKey).toHaveBeenCalledWith("priya"))
    expect(await screen.findByTestId("api-key-receipt")).toHaveTextContent("✎ Revoked by Dana Kim, an admin")
    expect(m.listOrgApiKeys).toHaveBeenCalledTimes(2)
    expect(onRecorded).toHaveBeenCalledTimes(1)
  })

  it("a refused revoke records nothing and keeps the sheet open", async () => {
    const user = userEvent.setup()
    const onRecorded = vi.fn()
    m.listOrgApiKeys.mockResolvedValue(ORG)
    m.revokeOrgApiKey.mockRejectedValue(new Error("Not found."))
    render(<OrgApiKeysTab orgName="Acme Inc" onRecorded={onRecorded} />)
    await user.click(await screen.findByRole("button", { name: "Revoke n8n-prod" }))
    const sheet = await screen.findByRole("alertdialog")
    await user.click(within(sheet).getByRole("button", { name: "Revoke n8n-prod" }))
    expect(await within(sheet).findByRole("alert")).toHaveTextContent("The key still works.")
    expect(onRecorded).not.toHaveBeenCalled()
  })

  it("the audit link goes to the org Audit tab", async () => {
    const user = userEvent.setup()
    const onOpenAudit = vi.fn()
    m.listOrgApiKeys.mockResolvedValue(ORG)
    render(<OrgApiKeysTab orgName="Acme Inc" onOpenAudit={onOpenAudit} />)
    const card = (await screen.findAllByTestId("api-key-card"))[0]
    await user.click(within(card).getByRole("button", { name: "Show activity" }))
    await user.click(within(card).getByRole("button", { name: "All in the audit log →" }))
    expect(onOpenAudit).toHaveBeenCalledTimes(1)
  })
})
