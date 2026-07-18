/**
 * Phase 155 Plan 05 Task 1 — UsersAndAccess a11y contract (WCAG 2.1 AA / D-01, D-05).
 *
 * The 068-A instrument roster is a PURE PRESENTATIONAL LEAF (props in, DOM out; the
 * shell owns the fetch + server writes). Its honest states are loading (`rows === null`
 * → aria-busy), empty (`[]` / no-search-match), and populated. This suite locks the
 * D-12 zero-STRUCTURAL-violations bar across those states plus the D-05 roster
 * action-control contract:
 *   - the disable / enable / grant / revoke controls are reachable by role="button" +
 *     accessible NAME (verb text — never colour-alone);
 *   - the self-row disable + remove-operator guards are exposed as DISABLED buttons
 *     with a courtesy reason (not merely hidden);
 *   - status ("Active" / "Disabled") + role ("Operator") read as visible WORDS;
 *   - opening the disable guard exposes the 064-B victim-naming role="dialog" with a
 *     named confirm <button> ("Disable <email>") — the destructive step is a named,
 *     keyboard-reachable control, never colour-alone.
 *
 * The Radix confirm SHEET's OPEN-state axe scan is deliberately NOT run (the plan
 * frames the sheet as the roles/names proof, not a structural scan of Radix portal
 * internals); the structural scans cover the three non-portal honest states.
 * STRUCTURAL rules only (no contrast assertion).
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"

import { UsersAndAccess } from "../UsersAndAccess"
import type { UserRosterRow } from "@/lib/api"

const FUTURE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()

function makeRow(overrides: Partial<UserRosterRow> = {}): UserRosterRow {
  return {
    id: "user-1",
    email: "maria@acme.io",
    created_at: "2026-01-10T00:00:00Z",
    last_sign_in_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago (recent)
    banned_until: null,
    is_operator: false,
    doc_count: 3,
    chat_count: 5,
    ...overrides,
  }
}

const ROWS: UserRosterRow[] = [
  makeRow({ id: "user-1", email: "maria@acme.io" }),
  makeRow({ id: "user-2", email: "sam@acme.io", is_operator: true }),
  makeRow({ id: "user-3", email: "leo@acme.io", banned_until: FUTURE }),
]

const handlers = {
  onDisable: vi.fn().mockResolvedValue(undefined),
  onEnable: vi.fn().mockResolvedValue(undefined),
  onGrantOperator: vi.fn().mockResolvedValue(undefined),
  onRevokeOperator: vi.fn().mockResolvedValue(undefined),
}

function renderRoster(rows: UserRosterRow[] | null, currentOperatorId: string | null = null) {
  return render(
    <UsersAndAccess rows={rows} currentOperatorId={currentOperatorId} {...handlers} />,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("UsersAndAccess a11y — WCAG 2.1 AA (structural) across honest states", () => {
  it("no aXe structural violations — loading (rows === null)", async () => {
    const { container } = renderRoster(null)
    await screen.findByText(/loading users/i)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — empty (no users yet)", async () => {
    const { container } = renderRoster([])
    await screen.findByText(/no users yet/i)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — populated (active + operator + disabled rows)", async () => {
    const { container } = renderRoster(ROWS)
    await screen.findByText("maria@acme.io")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("the loading placeholder exposes aria-busy (the leaf's real honest-loading signal)", () => {
    const { container } = renderRoster(null)
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })
})

describe("UsersAndAccess a11y — D-05 roster action controls (role + name, never colour-alone)", () => {
  it("the search field is reachable by role + accessible name", () => {
    renderRoster(ROWS)
    expect(screen.getByRole("searchbox", { name: /search users by email/i })).toBeInTheDocument()
  })

  it("disable / grant controls are reachable by role + name on a normal active row", () => {
    renderRoster(ROWS)
    const row = screen.getByText("maria@acme.io").closest("div.flex.flex-wrap") as HTMLElement
    expect(within(row).getByRole("button", { name: /^disable$/i })).toBeInTheDocument()
    expect(within(row).getByRole("button", { name: /^make operator$/i })).toBeInTheDocument()
  })

  it("a disabled user's row exposes an Enable (restorative) control by role + name", () => {
    renderRoster(ROWS)
    const row = screen.getByText("leo@acme.io").closest("div.flex.flex-wrap") as HTMLElement
    expect(within(row).getByRole("button", { name: /^enable$/i })).toBeInTheDocument()
  })

  it("an operator row exposes a Remove-operator control by role + name", () => {
    renderRoster(ROWS)
    const row = screen.getByText("sam@acme.io").closest("div.flex.flex-wrap") as HTMLElement
    expect(within(row).getByRole("button", { name: /^remove operator$/i })).toBeInTheDocument()
  })

  it("the self-row disable + remove-operator guards are DISABLED buttons with a courtesy reason", () => {
    // sam@acme.io is the signed-in operator → both self-row guards render disabled.
    renderRoster(ROWS, "user-2")
    const row = screen.getByText("sam@acme.io").closest("div.flex.flex-wrap") as HTMLElement
    const disableBtn = within(row).getByRole("button", { name: /^disable$/i })
    const removeOp = within(row).getByRole("button", { name: /^remove operator$/i })
    expect(disableBtn).toBeDisabled()
    expect(disableBtn).toHaveAttribute("title", expect.stringMatching(/cannot disable yourself/i))
    expect(removeOp).toBeDisabled()
    expect(removeOp).toHaveAttribute("title", expect.stringMatching(/cannot remove your own operator/i))
  })

  it("status + role read as visible WORDS (never colour-alone)", () => {
    renderRoster(ROWS)
    expect(screen.getAllByText(/^active$/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/^disabled$/i)).toBeInTheDocument()
    expect(screen.getByText(/^operator$/i)).toBeInTheDocument()
  })
})

describe("UsersAndAccess a11y — the disable victim-naming confirm is a named dialog control", () => {
  it("opening Disable exposes a role=dialog with a named confirm button (ARIA, not colour-alone)", async () => {
    const user = userEvent.setup()
    renderRoster(ROWS)
    const row = screen.getByText("maria@acme.io").closest("div.flex.flex-wrap") as HTMLElement

    await user.click(within(row).getByRole("button", { name: /^disable$/i }))

    const dialog = await screen.findByRole("dialog")
    // The victim-naming confirm NAMES the user and its destructive action button.
    expect(within(dialog).getByText(/disable maria@acme\.io\?/i)).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: /disable maria@acme\.io/i })).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: /keep active/i })).toBeInTheDocument()
  })
})
