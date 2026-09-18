/**
 * ConnectionGrantsList Unit Tests — Phase 213 (GRANT-01 · GRANT-02 / BUILD-CONTRACT §3).
 *
 * Verifies all measured invariants from BUILD-CONTRACT.generated.md against the React component.
 */

import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ConnectionGrantsList } from "../ConnectionGrantsList"
import { GRANTS_COPY } from "../grantsVocabulary"
import type { McpDiscoveredTool } from "@/lib/api"

const mockTools: McpDiscoveredTool[] = [
  {
    name: "search_code",
    title: "Search Code",
    description: "Search across your repositories.",
    readOnlyHint: true,
  },
  {
    name: "read_repository_metadata",
    title: "Read Repo Metadata",
    description: "Read stars, forks and descriptions.",
    readOnlyHint: true,
  },
  {
    name: "create_issue",
    title: "Create Issue",
    description: "Open a new issue.",
    readOnlyHint: false,
  },
  {
    name: "list_webhooks",
    title: "List Webhooks",
    description: "List the webhooks configured on a repository.",
    readOnlyHint: undefined,
  },
  {
    name: "delete_repository",
    title: "Delete Repository",
    description: "Permanently delete a repository.",
    readOnlyHint: false,
  },
]

describe("ConnectionGrantsList Component (BUILD-CONTRACT §3 Invariants)", () => {
  it("Invariant 1 & 2: .arow reserves 2px edge lane and overridden row uses primary edge without state colours", () => {
    render(
      <ConnectionGrantsList
        tools={mockTools}
        toolGrants={{ read_repository_metadata: "allow" }}
        defaultPosture="ask"
        onChangeDefaultPosture={vi.fn()}
        onChangeToolGrant={vi.fn()}
        onResetToolGrant={vi.fn()}
      />,
    )

    const inheritedRow = screen.getByTestId("action-row-search_code")
    const overriddenRow = screen.getByTestId("action-row-read_repository_metadata")

    // Invariant 2: 2px edge lane reserved on both
    expect(inheritedRow.className).toContain("border-l-2")
    expect(inheritedRow.className).toContain("border-l-transparent")
    expect(overriddenRow.className).toContain("border-l-2")

    // Invariant 1: overridden row uses primary edge, not success/destructive/warning
    expect(overriddenRow.className).toContain("border-l-primary")
    expect(overriddenRow.className).not.toContain("border-l-destructive")
    expect(overriddenRow.className).not.toContain("border-l-warning")
    expect(overriddenRow.className).not.toContain("border-l-success")
  })

  it("Invariant 3: every posture control group has exactly three arms, exactly one pressed", () => {
    render(
      <ConnectionGrantsList
        tools={mockTools}
        toolGrants={{ read_repository_metadata: "allow", delete_repository: "deny" }}
        defaultPosture="ask"
        onChangeDefaultPosture={vi.fn()}
        onChangeToolGrant={vi.fn()}
        onResetToolGrant={vi.fn()}
      />,
    )

    // The default control + 5 tool row controls = 6 groups
    const groups = screen.getAllByRole("group")
    expect(groups).toHaveLength(6)

    for (const group of groups) {
      const buttons = group.querySelectorAll("button")
      expect(buttons).toHaveLength(3)
      const pressed = Array.from(buttons).filter((b) => b.getAttribute("aria-pressed") === "true")
      expect(pressed).toHaveLength(1)
    }
  })

  it("Invariant 4: the chosen Deny arm uses destructive token, never primary", () => {
    render(
      <ConnectionGrantsList
        tools={mockTools}
        toolGrants={{ delete_repository: "deny" }}
        defaultPosture="ask"
        onChangeDefaultPosture={vi.fn()}
        onChangeToolGrant={vi.fn()}
        onResetToolGrant={vi.fn()}
      />,
    )

    const deleteRow = screen.getByTestId("action-row-delete_repository")
    const denyBtn = Array.from(deleteRow.querySelectorAll("button")).find(
      (b) => b.textContent === GRANTS_COPY.POSTURE_DENY,
    )

    expect(denyBtn).toBeDefined()
    expect(denyBtn?.getAttribute("aria-pressed")).toBe("true")
    expect(denyBtn?.className).toContain("bg-destructive")
    expect(denyBtn?.className).not.toContain("bg-primary")
  })

  it("Invariant 7: an unknown direction says 'Unknown' and explains itself in real DOM text", () => {
    render(
      <ConnectionGrantsList
        tools={mockTools}
        toolGrants={{}}
        defaultPosture="ask"
        onChangeDefaultPosture={vi.fn()}
        onChangeToolGrant={vi.fn()}
        onResetToolGrant={vi.fn()}
      />,
    )

    // The TAG is a fact about ONE action, so it stays on the row.
    const webhookRow = screen.getByTestId("action-row-list_webhooks")
    expect(webhookRow).toHaveTextContent(GRANTS_COPY.DIRECTION_UNKNOWN)

    // ⚠ AMENDED 2026-08-27, OPERATOR-DRIVEN. The EXPLANATION is a fact about the SERVER,
    // and it used to render inside every unknown row: *"directing the user is good but
    // contaminating the UI is not"*. `readOnlyHint` is measured ABSENT on the one server we
    // can reach, so on a 44-tool connection this sentence was printed ~44 times.
    //
    // The invariant is UNCHANGED — an unknown direction still explains itself in real DOM
    // text. What is pinned now is that it does so ONCE, and the COUNT is asserted so a
    // regression back to per-row cannot pass. That is a stronger test than the one it
    // replaces, which would have been satisfied by either shape.
    expect(webhookRow).not.toHaveTextContent(GRANTS_COPY.DIRECTION_UNKNOWN_HELP)
    expect(screen.getAllByTestId("grants-unknown-direction-help")).toHaveLength(1)
    expect(screen.getByTestId("grants-unknown-direction-help")).toHaveTextContent(
      GRANTS_COPY.DIRECTION_UNKNOWN_HELP,
    )
  })

  it("the unknown-direction explanation is ABSENT when every action states its direction", () => {
    // NEGATIVE CONTROL. Without it, a sentence rendered unconditionally would satisfy every
    // assertion above while telling a person their server is silent when it is not.
    render(
      <ConnectionGrantsList
        tools={mockTools.filter((t) => t.readOnlyHint != null)}
        toolGrants={{}}
        defaultPosture="ask"
        onChangeDefaultPosture={vi.fn()}
        onChangeToolGrant={vi.fn()}
        onResetToolGrant={vi.fn()}
      />,
    )
    expect(screen.queryByTestId("grants-unknown-direction-help")).toBeNull()
  })

  it("Invariant 8: zero [title] attributes in the rendered output", () => {
    const { container } = render(
      <ConnectionGrantsList
        tools={mockTools}
        toolGrants={{ read_repository_metadata: "allow" }}
        defaultPosture="ask"
        onChangeDefaultPosture={vi.fn()}
        onChangeToolGrant={vi.fn()}
        onResetToolGrant={vi.fn()}
      />,
    )

    const elementsWithTitle = container.querySelectorAll("[title]")
    expect(elementsWithTitle).toHaveLength(0)
  })

  it("Invariant 10: an overridden row offers a RESET, and an inherited one does not", () => {
    // ⚠ NOISE AUDIT 2026-08-31 (operator, item C1). This asserted the words "You
    // changed this" on every overridden row — a tag printed beside a reset link that
    // ONLY EXISTS on an overridden row, so the link already carried the fact. Down a
    // 44-action list that was two controls where one means something.
    //
    // ⚠ THE INVARIANT ITSELF SURVIVES, and it is the stronger half: an overridden row
    // must be DISTINGUISHABLE from an inherited one. That is now asserted on the
    // affordance rather than on a sentence — a control a person can act on, not words
    // they must read. A tooltip was tried and rejected: Invariant 8 forbids `title`.
    render(
      <ConnectionGrantsList
        tools={mockTools}
        toolGrants={{ read_repository_metadata: "allow" }}
        defaultPosture="ask"
        onChangeDefaultPosture={vi.fn()}
        onChangeToolGrant={vi.fn()}
        onResetToolGrant={vi.fn()}
      />,
    )

    const overriddenRow = screen.getByTestId("action-row-read_repository_metadata")
    const inheritedRow = screen.getByTestId("action-row-search_code")

    // The affordance, not a sentence: a control a person can act on.
    expect(within(overriddenRow).getByTestId("grant-reset")).toBeTruthy()
    expect(within(inheritedRow).queryByTestId("grant-reset")).toBeNull()
  })

  it("search filtering filters rows and displays empty state when no tool matches", async () => {
    const user = userEvent.setup({ delay: null })
    render(
      <ConnectionGrantsList
        tools={mockTools}
        toolGrants={{}}
        defaultPosture="ask"
        onChangeDefaultPosture={vi.fn()}
        onChangeToolGrant={vi.fn()}
        onResetToolGrant={vi.fn()}
      />,
    )

    const searchInput = screen.getByPlaceholderText(GRANTS_COPY.SEARCH_PLACEHOLDER(5))
    expect(searchInput).toBeInTheDocument()

    // Filter for "search"
    await user.type(searchInput, "search")
    expect(screen.getByTestId("action-row-search_code")).toBeInTheDocument()
    expect(screen.queryByTestId("action-row-create_issue")).toBeNull()

    // Filter for non-matching query
    await user.clear(searchInput)
    await user.type(searchInput, "nonexistent_action_xyz")
    expect(screen.getByText(GRANTS_COPY.LIST_EMPTY)).toBeInTheDocument()
  })

  it("clicking an arm triggers onChangeToolGrant and reset button triggers onResetToolGrant", async () => {
    const user = userEvent.setup({ delay: null })
    const onChangeToolGrant = vi.fn()
    const onResetToolGrant = vi.fn()

    render(
      <ConnectionGrantsList
        tools={mockTools}
        toolGrants={{ read_repository_metadata: "allow" }}
        defaultPosture="ask"
        onChangeDefaultPosture={vi.fn()}
        onChangeToolGrant={onChangeToolGrant}
        onResetToolGrant={onResetToolGrant}
      />,
    )

    // Click Deny on search_code
    const searchRow = screen.getByTestId("action-row-search_code")
    const denyBtn = Array.from(searchRow.querySelectorAll("button")).find(
      (b) => b.textContent === GRANTS_COPY.POSTURE_DENY,
    )
    if (denyBtn) await user.click(denyBtn)
    expect(onChangeToolGrant).toHaveBeenCalledWith("search_code", "deny")

    // Click Reset on read_repository_metadata (CRED-02: forward action wording)
    expect(GRANTS_COPY.OVERRIDDEN_RESET).toBe("Follow the default instead")
    expect(screen.getByText("Follow the default instead")).toBeInTheDocument()
    expect(screen.queryByText("Use the default")).toBeNull()
    const resetBtn = screen.getByText(GRANTS_COPY.OVERRIDDEN_RESET)
    await user.click(resetBtn)
    expect(onResetToolGrant).toHaveBeenCalledWith("read_repository_metadata")
  })
})
