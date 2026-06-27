/**
 * Phase 128 Plan 04 (CTC-01 / CTC-02) — RunCard tool-card header logo swap.
 *
 * The brand-pulse avatar in the RunCard header (RunCard.tsx:280-288) now renders
 * the REAL per-provider `@lobehub/icons` mark via `providerLogo(message.provider)`
 * on the existing `gradient-primary` backing, with the `<Bot>` fallback for any
 * unmapped provider (D-08). The `animate-brandPulse` ring STAYS while streaming
 * (D-01) — only the inner glyph changes.
 *
 * jsdom note: jsdom renders SVG components structurally (no layout). These tests
 * assert STRUCTURE — the presence/absence of the Lucide `<Bot>` glyph (which
 * carries the `lucide-bot` class) inside the avatar, and the `animate-brandPulse`
 * class on the avatar wrapper. The live per-provider visual is covered by the
 * D-06 manual UAT (Plan 05).
 */
import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { RunCard } from "@/components/chat/RunCard"
import type { Message } from "@/types"

const NOW = new Date().toISOString()

/**
 * A tool-bearing assistant message — RunCard renders its header (with the
 * brand-pulse avatar) whenever it is mounted. `provider`/`runStatus` are the
 * per-test knobs.
 */
function makeRunMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "assistant",
    content: "",
    created_at: NOW,
    updated_at: NOW,
    model: "test-model",
    tool_calls: [
      {
        id: "tc-1",
        name: "search_documents",
        args: {},
        status: "running",
      },
    ],
    ...overrides,
  } as Message
}

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe("RunCard — CTC-01 tool-card header provider logo", () => {
  it("Test 1 — a mapped provider renders the provider mark (NOT the Bot fallback)", () => {
    const { getByTestId } = renderWithTooltip(
      <RunCard message={makeRunMessage({ provider: "google", runStatus: "streaming" })} />,
    )
    const avatar = getByTestId("run-card-avatar")
    // The lobehub mark is an <svg> with no `lucide-bot` class; the Bot fallback
    // carries `lucide-bot`. A mapped provider → the mark, so no Bot glyph.
    expect(avatar.querySelector(".lucide-bot")).toBeNull()
    // The avatar still renders an SVG (the provider mark) inside the backing.
    expect(avatar.querySelector("svg")).not.toBeNull()
  })

  it("Test 1b — a second mapped provider (zhipu) also renders a mark (NOT Bot)", () => {
    const { getByTestId } = renderWithTooltip(
      <RunCard message={makeRunMessage({ provider: "zhipu", runStatus: "streaming" })} />,
    )
    const avatar = getByTestId("run-card-avatar")
    expect(avatar.querySelector(".lucide-bot")).toBeNull()
    expect(avatar.querySelector("svg")).not.toBeNull()
  })

  it("Test 2 — an unmapped provider (lmstudio) renders the Bot fallback", () => {
    const { getByTestId } = renderWithTooltip(
      <RunCard message={makeRunMessage({ provider: "lmstudio", runStatus: "streaming" })} />,
    )
    const avatar = getByTestId("run-card-avatar")
    expect(avatar.querySelector(".lucide-bot")).not.toBeNull()
  })

  it("Test 2b — an undefined provider (legacy/loading) renders the Bot fallback", () => {
    const { getByTestId } = renderWithTooltip(
      <RunCard message={makeRunMessage({ provider: undefined, runStatus: "streaming" })} />,
    )
    const avatar = getByTestId("run-card-avatar")
    expect(avatar.querySelector(".lucide-bot")).not.toBeNull()
  })

  it("Test 3 — animate-brandPulse is present on the avatar while streaming", () => {
    const { getByTestId } = renderWithTooltip(
      <RunCard message={makeRunMessage({ provider: "google", runStatus: "streaming" })} />,
    )
    const avatar = getByTestId("run-card-avatar")
    expect(avatar.className).toContain("animate-brandPulse")
    // The gradient-primary backing is preserved alongside the pulse.
    expect(avatar.className).toContain("gradient-primary")
  })

  it("Test 3b — animate-brandPulse is ABSENT on a terminal run", () => {
    const { getByTestId } = renderWithTooltip(
      <RunCard message={makeRunMessage({ provider: "google", runStatus: "completed" })} />,
    )
    const avatar = getByTestId("run-card-avatar")
    expect(avatar.className).not.toContain("animate-brandPulse")
    // The gradient-primary backing stays even when not streaming.
    expect(avatar.className).toContain("gradient-primary")
  })
})
