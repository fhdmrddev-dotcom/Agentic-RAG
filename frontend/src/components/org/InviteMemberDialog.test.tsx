/**
 * Phase 300-05 (NOTE-06 / D-11, UI-D12; UI-SPEC S4) — the invite dialog's three result arms.
 *
 * The invite always succeeds and always yields a link (link-first, D-167-02); what changes is
 * whether the email went. `sent` → "Invitation sent"; `failed` → "Invitation created" with the D-11
 * sentence and Copy link focused; `not_configured` (or an older backend) → the shipped
 * "Invitation ready". No arm ever names the provider, an error code, or a retry (a retried invite
 * would mint a second link). Words are asserted as rendered content.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/api", () => ({
  sendInvitation: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

vi.mock("@/lib/api/_core", () => {
  class ApiError extends Error {
    readonly status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
      this.name = "ApiError"
    }
  }
  return {
    API_BASE: "http://api.test",
    ApiError,
    getAuthHeaders: () => Promise.resolve({ Authorization: "Bearer t" }),
  }
})

import { sendInvitation } from "@/lib/api"
import * as orgApi from "@/lib/api/org"
import { InviteMemberDialog } from "./InviteMemberDialog"

const mockSend = vi.mocked(sendInvitation)
const LINK = "https://app.test/invite?token=raw"
const EXPIRY =
  "The link expires in 7 days and can be used once. You can resend or revoke it from the invitations list."
const FAILED = "Invitation created, but the email didn't send. Copy the link and send it yourself."

function result(email_delivery: "sent" | "failed" | "not_configured") {
  return {
    link: LINK,
    invitation: { id: "i1", email: "new@acme.test", role: "member", status: "pending", expires_at: null },
    email_delivery,
    email_to_test_address: false,
  }
}

async function sendTo(email = "new@acme.test") {
  const user = userEvent.setup()
  render(<InviteMemberDialog open onClose={vi.fn()} onCreated={vi.fn()} />)
  await user.type(screen.getByLabelText("Email address"), email)
  await user.click(screen.getByRole("button", { name: "Send invite" }))
  await screen.findByTestId("invite-link")
  return screen.getByRole("dialog")
}

function noForbiddenWords(dialog: HTMLElement) {
  const text = dialog.textContent ?? ""
  for (const word of ["Resend", "SMTP", "500", "error code"]) expect(text).not.toContain(word)
  expect(text).not.toMatch(/try again/i)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("InviteMemberDialog — the three result arms (UI-D12)", () => {
  it("sent: 'Invitation sent' and the emailed sentence, with the link", async () => {
    mockSend.mockResolvedValue(result("sent"))
    const dialog = await sendTo()
    expect(within(dialog).getByRole("heading").textContent).toBe("Invitation sent")
    const body = within(dialog).getByText((_, el) =>
      el?.tagName === "P" &&
      el.textContent ===
        "We emailed an invitation to new@acme.test. You can also copy the link and send it yourself.",
    )
    expect(within(body).getByText("new@acme.test")).toHaveClass("font-semibold")
    expect(within(dialog).getByTestId("invite-link").textContent).toBe(LINK)
    expect(within(dialog).getByText(EXPIRY)).toBeInTheDocument()
    expect(within(dialog).queryByText(FAILED)).toBeNull()
    noForbiddenWords(dialog)
  })

  // 300-REVIEW IN-01: outside production a "sent" email went to the Settings test address.
  it("sent to the test address: says so, and never bolds the invitee as the recipient", async () => {
    mockSend.mockResolvedValue({ ...result("sent"), email_to_test_address: true })
    const dialog = await sendTo()
    expect(within(dialog).getByRole("heading").textContent).toBe("Invitation sent")
    const text = dialog.textContent ?? ""
    expect(text).not.toContain("We emailed an invitation to")
    expect(
      within(dialog).getByText((_, el) =>
        el?.tagName === "P" &&
        el.textContent ===
          "Outside production, the email went to the test address set in Settings, not to new@acme.test. Copy the link and send it yourself.",
      ),
    ).toBeInTheDocument()
    expect(within(dialog).getByTestId("invite-link").textContent).toBe(LINK)
    noForbiddenWords(dialog)
  })

  it("failed: 'Invitation created', the D-11 sentence in a status box, Copy link focused", async () => {
    mockSend.mockResolvedValue(result("failed"))
    const dialog = await sendTo()
    expect(within(dialog).getByRole("heading").textContent).toBe("Invitation created")
    const box = within(dialog).getByRole("status")
    expect(box.textContent).toBe(FAILED)
    expect(box.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
    expect(within(dialog).getByTestId("invite-link").textContent).toBe(LINK)
    expect(within(dialog).getByText(EXPIRY)).toBeInTheDocument()
    await waitFor(() =>
      expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Copy link" })),
    )
    noForbiddenWords(dialog)
  })

  it("not_configured: the shipped 'Invitation ready' panel, unchanged", async () => {
    mockSend.mockResolvedValue(result("not_configured"))
    const dialog = await sendTo()
    expect(within(dialog).getByRole("heading").textContent).toBe("Invitation ready")
    expect(
      within(dialog).getByText((_, el) =>
        el?.tagName === "P" &&
        el.textContent ===
          "Share this link with new@acme.test. They join your organization by opening it and signing in.",
      ),
    ).toBeInTheDocument()
    expect(within(dialog).getByText(EXPIRY)).toBeInTheDocument()
    expect(within(dialog).queryByRole("status")).toBeNull()
    noForbiddenWords(dialog)
  })

  it("an older backend with no email_delivery reads as not_configured, never a false failure", async () => {
    mockSend.mockResolvedValue({
      link: LINK,
      invitation: result("sent").invitation,
    } as unknown as Awaited<ReturnType<typeof sendInvitation>>)
    const dialog = await sendTo()
    expect(within(dialog).getByRole("heading").textContent).toBe("Invitation ready")
    expect(within(dialog).queryByText(FAILED)).toBeNull()
  })
})

describe("lib/api/org — email_delivery on the invite results (D-11)", () => {
  afterEach(() => vi.unstubAllGlobals())

  function stub(body: unknown) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })),
    )
  }

  it("sendInvitation carries the server's email_delivery", async () => {
    stub({ link: LINK, invitation: {}, email_delivery: "failed" })
    expect((await orgApi.sendInvitation("a@b.co", "member")).email_delivery).toBe("failed")
  })

  it("sendInvitation carries email_to_test_address, false when absent or not exactly true", async () => {
    stub({ link: LINK, invitation: {}, email_delivery: "sent", email_to_test_address: true })
    expect((await orgApi.sendInvitation("a@b.co", "member")).email_to_test_address).toBe(true)
    stub({ link: LINK, invitation: {}, email_delivery: "sent" })
    expect((await orgApi.sendInvitation("a@b.co", "member")).email_to_test_address).toBe(false)
    stub({ link: LINK, invitation: {}, email_delivery: "sent", email_to_test_address: "yes" })
    expect((await orgApi.sendInvitation("a@b.co", "member")).email_to_test_address).toBe(false)
  })

  it("sendInvitation from an older backend reads not_configured", async () => {
    stub({ link: LINK, invitation: {} })
    expect((await orgApi.sendInvitation("a@b.co", "member")).email_delivery).toBe("not_configured")
  })

  it("resendInvitation carries the server's email_delivery, and not_configured when absent", async () => {
    stub({ link: LINK, email_delivery: "sent" })
    expect(await orgApi.resendInvitation("i1")).toEqual({ link: LINK, email_delivery: "sent" })
    stub({ link: LINK })
    expect(await orgApi.resendInvitation("i1")).toEqual({
      link: LINK,
      email_delivery: "not_configured",
    })
  })
})
