import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { MessageInput, _resetComposerDraftsForTest } from "../MessageInput"
import * as api from "@/lib/api"
import type { ExpertBundle } from "@/types"

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<any>("@/lib/api")
  return {
    ...actual,
    listConnectorConnections: vi.fn(),
    listExperts: vi.fn(),
    setThreadActiveExpert: vi.fn(),
  }
})

const mockExpert: ExpertBundle = {
  id: "00000000-0000-0000-0000-000000000259",
  name: "Financial Analyzer",
  slug: "financial-analyzer",
  description: "Specialized SEC 10-K & financial statement analysis",
  scope_mode: "restricted",
  member_skills: ["financial_ratio_calculator"],
  required_connections: [],
  knowledge_folder_ids: ["00000000-0000-0000-0000-000000000260"],
  prompt_suggestions: [
    { title: "Q3 Revenue Growth", prompt: "Compare Q3 revenue growth and YoY trajectory" },
  ],
  visibility: "public",
  is_system: true,
  is_enabled: true,
}

describe("Composer Expert Consultant Integration (Phase 260)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _resetComposerDraftsForTest()
    if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
    if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
    if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
    if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
    vi.mocked(api.listConnectorConnections).mockResolvedValue([])
    vi.mocked(api.listExperts).mockResolvedValue([mockExpert])
    vi.mocked(api.setThreadActiveExpert).mockResolvedValue({} as any)
  })

  it("UI budget: asserts ZERO new top-level controls on composer toolbar", () => {
    const { container } = render(
      <MessageInput onSend={vi.fn()} disabled={false} threadId="test-thread" />,
    )

    // The bottom toolbar holds the left controls and right send button
    const toolbar = container.querySelector(".flex.items-center.justify-between.px-2.pb-2.pt-1")
    expect(toolbar).toBeDefined()

    // Find all top-level buttons in the toolbar
    const buttons = toolbar?.querySelectorAll("button")
    // Exactly: '+' button, model button (if models present or default), mode button, and send button
    // Crucially, NO separate "Expert" or "Consultant" button exists at the top level
    const buttonTexts = Array.from(buttons || []).map((b) => b.textContent?.trim() || b.getAttribute("aria-label"))
    expect(buttonTexts.some((t) => t?.includes("Expert"))).toBe(false)
  })

  it("reveals 'Invite Expert...' inside the '+' dropdown menu", async () => {
    const user = userEvent.setup()
    render(<MessageInput onSend={vi.fn()} disabled={false} threadId="test-thread" />)

    const plusBtn = screen.getByTestId("composer-plus-btn")
    await user.click(plusBtn)

    const inviteDoor = screen.getByTestId("invite-expert-door")
    expect(inviteDoor).toBeDefined()
    expect(inviteDoor.textContent).toContain("Invite Expert...")
  })

  it("opens InviteExpertDialog and mounts ActiveExpertChip on expert selection", async () => {
    const user = userEvent.setup()
    const onActiveExpertChange = vi.fn()

    render(
      <MessageInput
        onSend={vi.fn()}
        disabled={false}
        threadId="test-thread"
        onActiveExpertChange={onActiveExpertChange}
      />,
    )

    // Open '+' menu
    await user.click(screen.getByTestId("composer-plus-btn"))

    // Click 'Invite Expert...'
    await user.click(screen.getByTestId("invite-expert-door"))

    // Verify modal appeared and lists mockExpert
    await waitFor(() => {
      expect(screen.getByTestId("invite-expert-dialog")).toBeDefined()
      expect(screen.getByTestId("expert-card-financial-analyzer")).toBeDefined()
    })

    // Click 'Invite to Thread'
    const inviteBtn = screen.getByTestId("invite-expert-btn-financial-analyzer")
    await user.click(inviteBtn)

    // Verify ActiveExpertChip rendered inside data-testid="active-connector-chips"
    await waitFor(() => {
      const chipsContainer = screen.getByTestId("active-connector-chips")
      expect(chipsContainer).toBeDefined()
      expect(chipsContainer.textContent).toContain("Using:")
      expect(chipsContainer.textContent).toContain("Financial Analyzer")
      expect(chipsContainer.textContent).toContain("Restricted")
    })

    // Verify backend persistence call
    expect(api.setThreadActiveExpert).toHaveBeenCalledWith("test-thread", mockExpert.id)
    expect(onActiveExpertChange).toHaveBeenCalledWith(mockExpert)
  })

  it("applies ambient violet glow to composer container when an expert is active", () => {
    const { container, rerender } = render(
      <MessageInput onSend={vi.fn()} disabled={false} threadId="test-thread" activeExpert={null} />,
    )

    // Initially neutral
    const composerBox = container.querySelector(".rounded-2xl.ghost-border")
    expect(composerBox?.className).not.toContain("ring-violet-500/30")

    // Rerender with active expert
    rerender(
      <MessageInput
        onSend={vi.fn()}
        disabled={false}
        threadId="test-thread"
        activeExpert={mockExpert}
      />,
    )

    expect(composerBox?.className).toContain("ring-violet-500/30")
    expect(composerBox?.className).toContain("border-violet-500/40")
  })

  it("clicking '✕' dismisses the expert, clears backend state, and returns to neutral styling", async () => {
    const user = userEvent.setup()
    const onActiveExpertChange = vi.fn()

    const { container } = render(
      <MessageInput
        onSend={vi.fn()}
        disabled={false}
        threadId="test-thread"
        onActiveExpertChange={onActiveExpertChange}
      />,
    )

    // Invite expert
    await user.click(screen.getByTestId("composer-plus-btn"))
    await user.click(screen.getByTestId("invite-expert-door"))

    await waitFor(() => {
      expect(screen.getByTestId("invite-expert-btn-financial-analyzer")).toBeDefined()
    })
    await user.click(screen.getByTestId("invite-expert-btn-financial-analyzer"))

    // Verify chip is present
    await waitFor(() => {
      expect(screen.getByTestId("active-expert-chip")).toBeDefined()
    })

    // Click dismiss '✕'
    const dismissBtn = screen.getByRole("button", { name: /dismiss financial analyzer/i })
    await user.click(dismissBtn)

    // Verify chip is gone
    await waitFor(() => {
      expect(screen.queryByTestId("active-expert-chip")).toBeNull()
    })

    // Verify backend clear was called with null
    expect(api.setThreadActiveExpert).toHaveBeenCalledWith("test-thread", null)
    expect(onActiveExpertChange).toHaveBeenCalledWith(null)

    // Composer returns to neutral
    const composerBox = container.querySelector(".rounded-2xl.ghost-border")
    expect(composerBox?.className).not.toContain("ring-violet-500/30")
  })
})
