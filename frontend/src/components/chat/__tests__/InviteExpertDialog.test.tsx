/**
 * Phase 267 plan 04 (PACK-22 / PACK-24 / PACK-25 · D-267-06 / D-267-13 / D-267-16 / D-267-18 /
 * D-267-19 / D-267-27 · UI-SPEC §5.2-5.3, §6.3, §7) — the invite dialog's R1-R10 row matrix.
 *
 * ⛔ THE COST IS STATED BEFORE IT CAN BE ACCEPTED. A restricted row fetches its preview on open and
 * offers NO invite control until the preview answers; the "Won't use · N" heading reads the server's
 * `excluded_count`, never the list's length (the list is capped at five names).
 *
 * ⛔ CONTENT, NOT PRESENCE, AND AT REST. Every asserted string is rendered text, checked visible
 * without a hover, a click or a disclosure. Test ids only anchor.
 *
 * ⛔ A SECOND THREAD CANNOT BE CREATED BY ACCIDENT (R9 / T-267-42). While "New chat with …" is in
 * flight the button is busy, every other action is aria-disabled and inert, and the dialog refuses
 * to close. A refusal (R10) always ends "Nothing was created."
 *
 * The API is mocked at the `@/lib/api/experts` module boundary: `@/lib/api` re-exports that module,
 * so the one mock covers `listExperts` on either import path and `getExpertScopePreview`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ExpertBundle } from "@/types"
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import scopePreviewRaw from "../../../../../backend/tests/fixtures/phase267/scope_preview.json?raw"

const { mockListExperts, mockGetExpertScopePreview } = vi.hoisted(() => ({
  mockListExperts: vi.fn(),
  mockGetExpertScopePreview: vi.fn(),
}))
vi.mock("@/lib/api/experts", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api/experts")>()
  return { ...actual, listExperts: mockListExperts, getExpertScopePreview: mockGetExpertScopePreview }
})

import { InviteExpertDialog } from "../InviteExpertDialog"
import { INSTALL_COPY } from "@/components/experts/catalog/expertCatalog"

const preview = JSON.parse(scopePreviewRaw as string)

function expert(over: Partial<ExpertBundle>): ExpertBundle {
  return {
    id: "e-x",
    name: "Expert",
    slug: "expert",
    description: "Helps.",
    scope_mode: "biased",
    member_skills: [],
    required_connections: [],
    knowledge_folder_ids: [],
    prompt_suggestions: [],
    visibility: "org",
    is_system: false,
    is_enabled: true,
    ...over,
  }
}

const FA = expert({ id: "e-fa", name: "Financial Analyzer", slug: "financial-analyzer", knowledge_folder_ids: ["f1"] })
const HR = expert({
  id: preview.expert_id,
  name: "HR Advisor",
  slug: "hr-advisor",
  scope_mode: "restricted",
  knowledge_folder_ids: ["f2"],
})
const CR = expert({ id: "e-cr", name: "Contract Reviewer", slug: "contract-reviewer" })
const hubspot = (canConnect: boolean) =>
  expert({
    id: "e-rfp",
    name: "RFP Responder",
    slug: "rfp-responder",
    scope_mode: "restricted",
    member_skills: ["rfp_outline"],
    required_connections: ["hubspot", "notion"],
    connection_state: [
      { slug: "hubspot", name: "HubSpot", connected: false },
      { slug: "notion", name: "Notion", connected: true },
    ],
    can_connect: canConnect,
  })

const HIDING = ["sr-only", "hidden", "invisible", "opacity-0"]
function atRest(el: HTMLElement) {
  expect(el).toBeVisible()
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    for (const cls of HIDING) expect(n.classList.contains(cls), `<${n.tagName}> has ${cls}`).toBe(false)
  }
}

interface Opts {
  experts?: ExpertBundle[]
  currentExpertId?: string | null
  currentExpertName?: string | null
  threadId?: string | null
  threadFolderName?: string | null
  hasMessages?: boolean
  onHandoff?: (e: ExpertBundle) => Promise<void>
  onOpenConnections?: () => void
}

async function open(opts: Opts = {}) {
  mockListExperts.mockResolvedValue(opts.experts ?? [FA, HR, CR])
  const onOpenChange = vi.fn()
  const onSelectExpert = vi.fn()
  const user = userEvent.setup()
  render(
    <InviteExpertDialog
      open
      onOpenChange={onOpenChange}
      onSelectExpert={onSelectExpert}
      currentExpertId={opts.currentExpertId ?? null}
      currentExpertName={opts.currentExpertName ?? null}
      threadId={opts.threadId === undefined ? "t-1" : opts.threadId}
      threadFolderName={opts.threadFolderName ?? null}
      hasMessages={opts.hasMessages ?? false}
      onHandoff={opts.onHandoff}
      onOpenConnections={opts.onOpenConnections}
    />,
  )
  await screen.findByTestId(`expert-card-${(opts.experts ?? [FA])[0].slug}`)
  return { onOpenChange, onSelectExpert, user }
}

const row = (slug: string) => screen.getByTestId(`expert-card-${slug}`)

beforeEach(() => {
  vi.clearAllMocks()
  mockGetExpertScopePreview.mockResolvedValue(preview)
})

describe("the dialog frame", () => {
  it("(1) the context line names the thread's folder in mono; the false tool sentence is gone", async () => {
    await open({ threadFolderName: "Client ACME" })
    const dialog = screen.getByTestId("invite-expert-dialog")
    expect(dialog.className).toContain("max-w-lg")
    expect(dialog.textContent).not.toContain("The expert scopes document search and tools")
    const folder = within(dialog).getByText("/Client ACME")
    expect(folder.className).toContain("font-mono")
    expect(folder.parentElement!.textContent).toBe("This chat · /Client ACME")
    atRest(folder)
  })

  it("(2) no folder → 'This chat · All your documents'", async () => {
    await open({ threadFolderName: null })
    atRest(screen.getByText("This chat · All your documents"))
  })

  it("(3) empty list → the heading and the next step", async () => {
    mockListExperts.mockResolvedValue([])
    render(<InviteExpertDialog open onOpenChange={vi.fn()} onSelectExpert={vi.fn()} />)
    atRest(await screen.findByText("No Experts available yet"))
    atRest(screen.getByText("An org admin can add one from the Experts catalog."))
  })

  it("(4) list error → 'Couldn't load Experts. {reason}'", async () => {
    mockListExperts.mockRejectedValue(new Error("Failed to list experts"))
    render(<InviteExpertDialog open onOpenChange={vi.fn()} onSelectExpert={vi.fn()} />)
    atRest(await screen.findByText("Couldn't load Experts. Failed to list experts"))
  })
})

describe("R2 / R3 — the gates", () => {
  it("(5) R3 admin: Brings/Missing ledger, the gate line, and Connect closes + navigates", async () => {
    const onOpenConnections = vi.fn()
    const { onOpenChange, user } = await open({ experts: [hubspot(true)], onOpenConnections })
    const r = row("rfp-responder")
    atRest(within(r).getByText("Brings"))
    atRest(within(r).getByText("Notion"))
    atRest(within(r).getByText("Missing"))
    atRest(within(r).getByText("HubSpot"))
    const line = within(r).getByTestId("connection-gate-line")
    expect(line.textContent).toBe("Requires HubSpot — not connected")
    atRest(line)
    const connect = within(r).getByTestId("connection-gate-connect")
    expect(connect.textContent).toContain("Connect HubSpot →")
    await user.click(connect)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onOpenConnections).toHaveBeenCalledTimes(1)
    // a row that cannot be invited is never previewed, and offers no invite
    expect(mockGetExpertScopePreview).not.toHaveBeenCalled()
    expect(within(r).queryByTestId("invite-expert-btn-rfp-responder")).toBeNull()
  })

  it("(6) R3 member: the ask sentence and no button", async () => {
    await open({ experts: [hubspot(false)], onOpenConnections: vi.fn() })
    const r = row("rfp-responder")
    atRest(within(r).getByTestId("connection-gate-ask"))
    expect(within(r).getByTestId("connection-gate-ask").textContent).toBe(
      "Ask an org admin to connect HubSpot.",
    )
    expect(within(r).queryByRole("button")).toBeNull()
  })

  it("(7) R2 wins over R3: an install that is not ready is the only reason shown", async () => {
    const both = {
      ...hubspot(true),
      install: {
        state: "not_installed" as const,
        folder_id: null,
        cause: null,
        cause_source: null,
        can_install: true,
        updated_at: "2026-09-24T00:00:00Z",
      },
    }
    await open({ experts: [both] })
    const r = row("rfp-responder")
    atRest(within(r).getByText(INSTALL_COPY.inviteNotInstalled))
    expect(within(r).queryByTestId("connection-gate-line")).toBeNull()
    expect(mockGetExpertScopePreview).not.toHaveBeenCalled()
  })
})

describe("R4 / R5 / R6 — the restricted-cost preview", () => {
  it("(8) fetched once per restricted row, with the thread; pending shows 'Checking…' and NO invite", async () => {
    let resolve!: (v: unknown) => void
    mockGetExpertScopePreview.mockReturnValue(new Promise((r) => (resolve = r)))
    // 267-REVIEW WR-06: on a chat WITH a folder a biased row never narrows, so it is not previewed.
    // (On a chat with no folder it is — the D-267-35 statement; see the WR-06 describe below.)
    await open({ threadId: "t-9", threadFolderName: "Client ACME" })
    expect(mockGetExpertScopePreview).toHaveBeenCalledTimes(1)
    expect(mockGetExpertScopePreview).toHaveBeenCalledWith(HR.id, "t-9")
    const r = row("hr-advisor")
    const status = within(r).getByTestId("scope-preview-loading")
    expect(status).toHaveAttribute("role", "status")
    expect(status.textContent).toContain("Checking what HR Advisor will read…")
    atRest(status)
    expect(within(r).queryByTestId("invite-expert-btn-hr-advisor")).toBeNull()
    // the biased rows are not previewed and invite as shipped
    expect(within(row("financial-analyzer")).getByTestId("invite-expert-btn-financial-analyzer")).toBeTruthy()
    resolve(preview)
    await within(r).findByTestId("invite-expert-btn-hr-advisor")
  })

  it("(9) resolved (the backend fixture): 'Will use' + 'Won't use · 4', names at rest", async () => {
    await open()
    const r = row("hr-advisor")
    await within(r).findByText("Will use")
    atRest(within(r).getByText("HR Policies"))
    atRest(within(r).getByText("Chat attachments"))
    atRest(within(r).getByText("Won't use · 4"))
    for (const name of preview.excluded_names as string[]) atRest(within(r).getByText(name))
    atRest(within(r).getByTestId("invite-expert-btn-hr-advisor"))
  })

  it("(10) the heading count is excluded_count, not the list: 7 excluded, 5 names → '· 7' and 'and 2 more'", async () => {
    mockGetExpertScopePreview.mockResolvedValue({
      ...preview,
      excluded_count: 7,
      excluded_names: ["a.pdf", "b.pdf", "c.pdf", "d.pdf", "e.pdf"],
    })
    await open()
    const r = row("hr-advisor")
    atRest(await within(r).findByText("Won't use · 7"))
    atRest(within(r).getByText("and 2 more"))
  })

  it("(11) nothing excluded → 'Will use' alone, never a 'Won't use · 0' box", async () => {
    mockGetExpertScopePreview.mockResolvedValue({ ...preview, excluded_count: 0, excluded_names: [], thread_folder: null })
    await open()
    const r = row("hr-advisor")
    await within(r).findByText("Will use")
    expect(within(r).queryByText(/Won't use/)).toBeNull()
    expect(within(r).queryByTestId("scope-ledger-col-no")).toBeNull()
  })

  it("(12) a restricted Expert with no folders says it cannot answer from documents, and has no invite", async () => {
    mockGetExpertScopePreview.mockResolvedValue({ ...preview, expert_folders: [], excluded_count: 0, excluded_names: [] })
    await open()
    const r = row("hr-advisor")
    atRest(
      await within(r).findByText(
        "HR Advisor has no knowledge folders yet, so it cannot answer from documents.",
      ),
    )
    expect(within(r).queryByTestId("invite-expert-btn-hr-advisor")).toBeNull()
  })

  it("(13) a failed preview is an alert with 'Try again', which re-requests ONLY that row", async () => {
    const HR2 = { ...HR, id: "e-hr2", name: "HR Two", slug: "hr-two" }
    mockGetExpertScopePreview.mockImplementation((id: string) =>
      id === HR.id ? Promise.reject(new Error("boom")) : Promise.resolve({ ...preview, expert_id: id }),
    )
    const { user } = await open({ experts: [FA, HR, HR2] })
    const r = row("hr-advisor")
    const alert = await within(r).findByTestId("scope-preview-error")
    expect(alert).toHaveAttribute("role", "alert")
    expect(alert.textContent).toContain("Couldn't check which documents HR Advisor will skip.")
    expect(within(r).queryByTestId("invite-expert-btn-hr-advisor")).toBeNull()
    const callsFor = (id: string) => mockGetExpertScopePreview.mock.calls.filter((c) => c[0] === id).length
    expect(callsFor(HR.id)).toBe(1)
    expect(callsFor("e-hr2")).toBe(1)
    mockGetExpertScopePreview.mockImplementation(() => Promise.resolve(preview))
    await user.click(within(r).getByRole("button", { name: "Try again" }))
    await within(r).findByText("Won't use · 4")
    expect(callsFor(HR.id)).toBe(2)
    expect(callsFor("e-hr2")).toBe(1)
  })

  it("(14) R6: with no Expert active, 'Invite to Thread' selects and closes", async () => {
    const { onSelectExpert, onOpenChange, user } = await open()
    await user.click(screen.getByTestId("invite-expert-btn-contract-reviewer"))
    expect(onSelectExpert).toHaveBeenCalledWith(CR)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("(15) R1: the active restricted row keeps its ledger at rest beside the Active pill", async () => {
    await open({ currentExpertId: HR.id, currentExpertName: "HR Advisor", hasMessages: true })
    const r = row("hr-advisor")
    atRest(await within(r).findByText("Won't use · 4"))
    atRest(within(r).getByText("Active"))
    expect(within(r).queryByText(/is active here/)).toBeNull()
  })
})

describe("R7 / R8 — a second Expert", () => {
  it("(16) R7: the active line, 'Replace …' and 'New chat with … →'", async () => {
    const onHandoff = vi.fn().mockResolvedValue(undefined)
    const { onSelectExpert, user } = await open({
      currentExpertId: FA.id,
      currentExpertName: "Financial Analyzer",
      hasMessages: true,
      onHandoff,
    })
    const r = row("contract-reviewer")
    atRest(within(r).getByText("Financial Analyzer is active here."))
    const replace = within(r).getByTestId("expert-replace-btn-contract-reviewer")
    atRest(replace)
    expect(replace.textContent).toBe("Replace Financial Analyzer")
    const handoff = within(r).getByTestId("expert-handoff-btn-contract-reviewer")
    atRest(handoff)
    expect(handoff.textContent).toBe("New chat with Contract Reviewer →")
    await user.click(replace)
    expect(onSelectExpert).toHaveBeenCalledWith(CR)
  })

  it("(17) R8: an empty thread offers Replace only", async () => {
    await open({ currentExpertId: FA.id, currentExpertName: "Financial Analyzer", hasMessages: false, onHandoff: vi.fn() })
    const r = row("contract-reviewer")
    atRest(within(r).getByTestId("expert-replace-btn-contract-reviewer"))
    expect(within(r).queryByTestId("expert-handoff-btn-contract-reviewer")).toBeNull()
  })
})

describe("R9 / R10 — the handoff in flight, and its refusal", () => {
  const second = { currentExpertId: FA.id, currentExpertName: "Financial Analyzer", hasMessages: true }

  it("(18) R9: one call, a busy button, inert siblings, and a dialog that will not close", async () => {
    let settle!: () => void
    const onHandoff = vi.fn(() => new Promise<void>((r) => (settle = r)))
    const { onSelectExpert, onOpenChange, user } = await open({ ...second, onHandoff })
    await within(row("hr-advisor")).findByTestId("expert-replace-btn-hr-advisor")
    const btn = within(row("contract-reviewer")).getByTestId("expert-handoff-btn-contract-reviewer")
    await user.click(btn)
    expect(onHandoff).toHaveBeenCalledTimes(1)
    expect(onHandoff).toHaveBeenCalledWith(CR)
    const busy = within(row("contract-reviewer")).getByTestId("expert-handoff-btn-contract-reviewer")
    expect(busy.textContent).toContain("Summarising this chat…")
    expect(busy).toBeDisabled()
    expect(busy).toHaveAttribute("aria-busy", "true")
    // every other row's actions are aria-disabled and ignore clicks
    const other = within(row("hr-advisor")).getByTestId("expert-replace-btn-hr-advisor")
    expect(other).toHaveAttribute("aria-disabled", "true")
    await user.click(other)
    expect(onSelectExpert).not.toHaveBeenCalled()
    // a second click is a no-op; Escape does not close
    await user.click(busy)
    expect(onHandoff).toHaveBeenCalledTimes(1)
    await user.keyboard("{Escape}")
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    settle()
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it("(19) R10: a refusal names the reason and ends 'Nothing was created.'; the buttons re-enable", async () => {
    const onHandoff = vi.fn().mockRejectedValue(new Error("This chat could not be summarised."))
    const { onOpenChange, user } = await open({ ...second, onHandoff })
    await user.click(within(row("contract-reviewer")).getByTestId("expert-handoff-btn-contract-reviewer"))
    const alert = await within(row("contract-reviewer")).findByTestId("handoff-refusal")
    expect(alert).toHaveAttribute("role", "alert")
    expect(alert.textContent).toBe(
      "Couldn't start a new chat with Contract Reviewer. This chat could not be summarised. Nothing was created.",
    )
    atRest(alert)
    const again = within(row("contract-reviewer")).getByTestId("expert-handoff-btn-contract-reviewer")
    expect(again).not.toBeDisabled()
    expect(again.textContent).toBe("New chat with Contract Reviewer →")
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it("(20) R10: a network failure reads 'The server could not be reached.'", async () => {
    const onHandoff = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    const { user } = await open({ ...second, onHandoff })
    await user.click(within(row("contract-reviewer")).getByTestId("expert-handoff-btn-contract-reviewer"))
    const alert = await within(row("contract-reviewer")).findByTestId("handoff-refusal")
    expect(alert.textContent).toBe(
      "Couldn't start a new chat with Contract Reviewer. The server could not be reached. Nothing was created.",
    )
  })
})

// 267-REVIEW WR-06 (D-267-35) — a biased Expert on a chat with NO folder reads only its own folders.
// That narrowing is kept on condition it is STATED; the dialog stated nothing for biased rows.
describe("WR-06 — the biased narrowing is stated before the invite", () => {
  const narrowing = {
    expert_id: "e-fa",
    expert_name: "Financial Analyzer",
    mode: "biased",
    expert_folders: [{ id: "f1", name: "Financial Reports" }],
    thread_folder: null,
    excluded_count: 0,
    excluded_names: [],
  }

  it("(W6) a biased row on a chat with no folder shows Will use / Won't use · All your documents at rest", async () => {
    mockGetExpertScopePreview.mockImplementation((id: string) =>
      Promise.resolve(id === FA.id ? narrowing : preview),
    )
    await open({ threadFolderName: null })
    expect(mockGetExpertScopePreview).toHaveBeenCalledWith(FA.id, "t-1")
    const r = row("financial-analyzer")
    const wont = await within(r).findByTestId("scope-ledger-col-no")
    expect(wont.textContent).toContain("Won't use")
    atRest(within(wont).getByText("All your documents"))
    atRest(within(r).getByText("Financial Reports"))
    // the statement never blocks the invite
    atRest(within(r).getByTestId("invite-expert-btn-financial-analyzer"))
  })
})

// 267-REVIEW IN-02 — the R1 "Active" pill carried `onClick={onInvite}`, so clicking it re-PATCHed the
// Expert that is already bound (and refetched the transcript). It is a status, not a control.
describe("IN-02 — the Active pill does nothing", () => {
  it("(I2) clicking Active selects nothing and closes nothing, and the pill is not a button", async () => {
    const { onSelectExpert, onOpenChange, user } = await open({
      currentExpertId: FA.id,
      currentExpertName: "Financial Analyzer",
      threadFolderName: "Client ACME",
    })
    const pill = within(row("financial-analyzer")).getByText("Active")
    await user.click(pill)
    expect(onSelectExpert).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    expect(within(row("financial-analyzer")).queryByRole("button", { name: /active/i })).toBeNull()
  })
})
