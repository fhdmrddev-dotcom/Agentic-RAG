/**
 * Phase 155 Plan 06 Task 3 — MessageInput composer a11y contract (154 surface, WCAG 2.1 AA).
 *
 * The composer mode helpers (General/Explorer + their one-line plain helper text) are a
 * net-new v3.3 surface (LANG-01 / Surface C, D-03). This suite locks the D-01 zero-
 * STRUCTURAL-violations bar and asserts the D-09 scenario-4 composer contract:
 *   - the composer's controls (mode selector trigger, Send/Stop) are reachable by
 *     role + accessible name;
 *   - opening the mode dropdown exposes General/Explorer as named menuitems whose
 *     one-line helper text is ASSOCIATED/announced (the helper lives INSIDE the
 *     menuitem, so it is part of the item's accessible name — never orphaned).
 *
 * `usePlainLabel` reads the OPTIONAL technical-names context (falls back to plain), so
 * the composer renders without a provider. STRUCTURAL axe rules only (no contrast).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, within, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"
import { MessageInput, _resetComposerDraftsForTest } from "../MessageInput"

beforeEach(() => {
  _resetComposerDraftsForTest()
  // Radix DropdownMenu uses pointer-capture + scrollIntoView APIs jsdom does not
  // implement; stub them so the mode menu opens under user-event (the standard shim).
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
})

afterEach(() => {
  cleanup()
})

const providers = [
  { id: "anthropic", name: "Anthropic", models: ["claude-sonnet-4-6", "claude-opus-4"], is_active: true },
  { id: "openai", name: "OpenAI", models: ["gpt-5.5-pro"], is_active: false },
]

function renderComposer(overrides: Record<string, unknown> = {}) {
  return render(
    <MessageInput
      onSend={vi.fn()}
      disabled={false}
      threadId="thread-A"
      providers={providers}
      selectedProvider="anthropic"
      onProviderChange={vi.fn()}
      models={["claude-sonnet-4-6", "claude-opus-4"]}
      selectedModel="claude-sonnet-4-6"
      onModelChange={vi.fn()}
      agentMode="default"
      onAgentModeChange={vi.fn()}
      {...overrides}
    />,
  )
}

describe("MessageInput a11y — WCAG 2.1 AA (structural) across honest states", () => {
  it("no aXe structural violations — the idle composer (send state)", async () => {
    const { container } = render(<MessageInput onSend={vi.fn()} disabled={false} threadId="thread-A" />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — the full composer (provider/model/mode + send)", async () => {
    const { container } = renderComposer()
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — streaming (Stop control shown)", async () => {
    const { container } = render(
      <MessageInput onSend={vi.fn()} onStop={vi.fn()} disabled={true} threadId="thread-A" />,
    )
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("MessageInput a11y — D-09 scenario-4 composer controls reachable by role+name", () => {
  it("the textarea + Send button are reachable by role/name", () => {
    renderComposer()
    expect(screen.getByRole("textbox")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument()
  })

  it("the Stop control is a named button while streaming", () => {
    render(<MessageInput onSend={vi.fn()} onStop={vi.fn()} disabled={true} threadId="thread-A" />)
    expect(screen.getByRole("button", { name: "Stop generation" })).toBeInTheDocument()
  })

  it("the agent-mode selector trigger is reachable by its accessible name", () => {
    renderComposer()
    // The mode trigger names itself with the active mode (default → "General").
    expect(screen.getByRole("button", { name: /General/ })).toBeInTheDocument()
  })
})

describe("MessageInput a11y — composer mode helpers associated/announced", () => {
  it("opening the mode menu exposes General/Explorer menuitems with associated helper text", async () => {
    const user = userEvent.setup()
    renderComposer()
    await user.click(screen.getByRole("button", { name: /General/ }))

    // Both modes surface as named menuitems…
    const general = await screen.findByRole("menuitem", { name: /General/ })
    const explorer = screen.getByRole("menuitem", { name: /Explorer/ })
    expect(general).toBeInTheDocument()
    expect(explorer).toBeInTheDocument()

    // …and the one-line helper text is INSIDE each item (part of its accessible name,
    // never an orphaned/unannounced label).
    expect(within(general).getByText("Quick, direct answers.")).toBeInTheDocument()
    expect(
      within(explorer).getByText("Digs deeper — searches your documents across multiple steps."),
    ).toBeInTheDocument()
    expect(general).toHaveTextContent("Quick, direct answers.")
    expect(explorer).toHaveTextContent("Digs deeper")
  })
})
