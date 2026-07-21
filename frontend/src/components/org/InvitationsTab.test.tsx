/**
 * Phase 167 Plan 05 Task 3 (INV-01 / D-167-03 / D-167-07) — InvitationsTab tests.
 *
 * The Invitations & Roles home is a PURE LEAF (props in, DOM out; the shell owns the
 * fetch + the re-fetch-on-mutation). These tests lock the load-bearing beats:
 *   - a "Send invite" affordance that opens the invite modal — shown ONLY to `org:invite`
 *     holders (honest-absent otherwise, never a disabled button that lies);
 *   - the invitation list with per-row status chips (pending / accepted / …);
 *   - resend/revoke actions on PENDING invites (via callbacks) — absent on terminal rows;
 *   - the invite modal's role picker offers Member + Org-admin with Dept-admin GREYED
 *     (D-167-03 — not an active choice).
 *
 * `@/lib/api` is mocked (the invite modal imports `sendInvitation`/`ApiError`) so the test
 * never loads the real supabase-bearing client — the mutations under test are callbacks.
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { InvitationsTab } from "./InvitationsTab"
import type { Invitation } from "@/lib/api"

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

const PENDING_INV: Invitation = {
  id: "i1",
  email: "pending@acme.test",
  role: "member",
  status: "pending",
  expires_at: "2026-07-27T00:00:00Z",
  created_at: "2026-07-20T00:00:00Z",
}

const ACCEPTED_INV: Invitation = {
  id: "i2",
  email: "accepted@acme.test",
  role: "org-admin",
  status: "accepted",
  expires_at: null,
  created_at: "2026-07-10T00:00:00Z",
}

function makeProps(overrides: Partial<React.ComponentProps<typeof InvitationsTab>> = {}) {
  return {
    invitations: [PENDING_INV, ACCEPTED_INV] as Invitation[] | null,
    canInvite: true,
    onSent: vi.fn(),
    onResend: vi.fn().mockResolvedValue("https://app.test/invite?token=fresh"),
    onRevoke: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("InvitationsTab — send affordance (INV-01, org:invite-gated render)", () => {
  it("renders the Send invite affordance for an inviter", () => {
    render(<InvitationsTab {...makeProps()} />)
    expect(screen.getByRole("button", { name: /send invite/i })).toBeInTheDocument()
  })

  it("hides the Send invite affordance for a non-inviter (honest-absent, not disabled)", () => {
    render(<InvitationsTab {...makeProps({ canInvite: false })} />)
    expect(screen.queryByRole("button", { name: /send invite/i })).toBeNull()
  })
})

describe("InvitationsTab — invitation list + status chips", () => {
  it("renders each invitation's email + status chip (pending / accepted)", () => {
    render(<InvitationsTab {...makeProps()} />)
    expect(screen.getByText("pending@acme.test")).toBeInTheDocument()
    expect(screen.getByText("accepted@acme.test")).toBeInTheDocument()
    expect(screen.getByText("Pending")).toBeInTheDocument()
    expect(screen.getByText("Accepted")).toBeInTheDocument()
  })

  it("shows the loading placeholder for a null list and the empty state for []", () => {
    const { rerender } = render(<InvitationsTab {...makeProps({ invitations: null })} />)
    expect(screen.getByText(/loading invitations/i)).toBeInTheDocument()
    rerender(<InvitationsTab {...makeProps({ invitations: [] })} />)
    expect(screen.getByText(/no invitations yet/i)).toBeInTheDocument()
  })
})

describe("InvitationsTab — resend/revoke on pending rows only", () => {
  it("offers Resend + Revoke on a pending invite and calls the callbacks", async () => {
    const props = makeProps()
    render(<InvitationsTab {...props} />)

    const resend = screen.getByRole("button", { name: /resend invitation to pending@acme.test/i })
    const revoke = screen.getByRole("button", { name: /revoke invitation to pending@acme.test/i })
    expect(resend).toBeInTheDocument()
    expect(revoke).toBeInTheDocument()

    await userEvent.click(resend)
    expect(props.onResend).toHaveBeenCalledWith("i1")
    // The fresh link-first URL surfaces inline to copy (D-167-02).
    await waitFor(() =>
      expect(screen.getByTestId("invitation-fresh-link")).toBeInTheDocument(),
    )

    await userEvent.click(revoke)
    expect(props.onRevoke).toHaveBeenCalledWith("i1")
  })

  it("offers NO resend/revoke on a terminal (accepted) invite", () => {
    render(<InvitationsTab {...makeProps()} />)
    expect(
      screen.queryByRole("button", { name: /resend invitation to accepted@acme.test/i }),
    ).toBeNull()
    expect(
      screen.queryByRole("button", { name: /revoke invitation to accepted@acme.test/i }),
    ).toBeNull()
  })

  it("offers NO resend/revoke for a non-inviter", () => {
    render(<InvitationsTab {...makeProps({ canInvite: false })} />)
    expect(screen.queryByRole("button", { name: /resend invitation/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /revoke invitation/i })).toBeNull()
  })
})

describe("InvitationsTab — invite modal role picker (D-167-03)", () => {
  it("opens the modal and greys out Dept-admin (Member + Org-admin selectable)", async () => {
    render(<InvitationsTab {...makeProps()} />)
    await userEvent.click(screen.getByRole("button", { name: /send invite/i }))

    // Member + Org-admin are real choices; Dept-admin is a greyed/disabled option.
    const member = await screen.findByRole("button", { name: /^Member/i })
    const orgAdmin = screen.getByRole("button", { name: /^Org-admin/i })
    const deptAdmin = screen.getByRole("button", { name: /dept-admin/i })
    expect(member).toBeEnabled()
    expect(orgAdmin).toBeEnabled()
    expect(deptAdmin).toBeDisabled()
  })
})
