/**
 * Phase 121 (IA-01) — the 2-pill composer + the surviving Cancel + the
 * workflow-locked preserve.
 *
 * Plan 01 removed the in-chat Deep/Harness mode toggle (`workflow-mode-selector`)
 * and the in-chat workflow picker (`workflow-picker`) — the "one front door for
 * workflows" is now the Workflows page (D-04), not a composer pill. The composer
 * is therefore a 2-pill surface: the Model pill and the General/Explorer
 * `agent-mode-selector`. The Deep/Harness label that finding #5 worried about no
 * longer exists (it died by construction), so the old three tests in this file —
 * which asserted the removed pill's label — are obsolete and are replaced here.
 *
 * What this file pins post-removal (MessageInput rendered IN ISOLATION):
 *  - SC#1: exactly 2 pills — `workflow-mode-selector` is GONE, `workflow-picker`
 *    is GONE, `agent-mode-selector` STAYS, and the Model pill renders.
 *  - Cancel-reachability (D-01): the post-removal Cancel is the existing
 *    `composer-stop` Stop button. With `disabled` (streaming) it renders and a
 *    click calls `onStop` — no new composer chrome was added.
 *  - SC#3 preserve: with `workflowLocked` the textarea is disabled and shows the
 *    "Workflow running — Cancel to switch back" placeholder, and Send is gated.
 */
import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { MessageInput } from "../MessageInput"

afterEach(() => cleanup())

/** A single-provider/single-model render still surfaces the Model pill as a
 *  static label (the selector dropdown only appears with >1 option). Either
 *  shape satisfies "Model pill present". */
const MODEL_PROPS = {
  providers: [{ id: "openai", name: "OpenAI", models: ["gpt-test"], is_active: true }],
  selectedProvider: "openai",
  models: ["gpt-test"],
  selectedModel: "gpt-test",
} as const

describe("MessageInput — Phase 121 2-pill composer (SC#1)", () => {
  it("renders exactly the 2 surviving pills: the removed mode toggle + picker are GONE, agent-mode + Model stay", () => {
    render(
      <MessageInput
        onSend={() => {}}
        disabled={false}
        onAgentModeChange={() => {}}
        {...MODEL_PROPS}
      />,
    )
    // The two removed controls no longer render (the "one front door" removal).
    expect(screen.queryByTestId("workflow-mode-selector")).toBeNull()
    expect(screen.queryByTestId("workflow-picker")).toBeNull()
    // The General/Explorer pill survives (gated on its own onAgentModeChange).
    expect(screen.getByTestId("agent-mode-selector")).toBeInTheDocument()
    // The Model pill renders (single-model → the static "gpt-test" label).
    expect(screen.getByText("gpt-test")).toBeInTheDocument()
  })
})

describe("MessageInput — Cancel-reachability survives the removal (D-01)", () => {
  it("with disabled/streaming, composer-stop renders and clicking it calls onStop", () => {
    const onStop = vi.fn()
    render(
      <MessageInput
        onSend={() => {}}
        onStop={onStop}
        disabled
        onAgentModeChange={() => {}}
        {...MODEL_PROPS}
      />,
    )
    // The post-removal Cancel is the existing right-side Stop button — no new chrome.
    const stop = screen.getByTestId("composer-stop")
    expect(stop).toBeInTheDocument()
    fireEvent.click(stop)
    expect(onStop).toHaveBeenCalledTimes(1)
  })
})

describe("MessageInput — workflow-locked preserve (SC#3)", () => {
  it("with workflowLocked the textarea is disabled, shows the running placeholder, and Send is gated", () => {
    const onSend = vi.fn()
    render(
      <MessageInput
        onSend={onSend}
        disabled={false}
        workflowLocked
        onAgentModeChange={() => {}}
        {...MODEL_PROPS}
      />,
    )
    // The locked thread swaps the placeholder to the running copy …
    const textarea = screen.getByPlaceholderText("Workflow running — Cancel to switch back")
    // … and disables the textarea so a Deep message cannot be typed during a run.
    expect(textarea).toBeDisabled()
    // The default "Ask anything…" composer is NOT shown while locked.
    expect(screen.queryByPlaceholderText("Ask anything…")).toBeNull()
    // Send is gated: typing + Enter never reaches onSend while locked.
    fireEvent.change(textarea, { target: { value: "should not send" } })
    fireEvent.keyDown(textarea, { key: "Enter" })
    expect(onSend).not.toHaveBeenCalled()
  })

  it("when NOT locked the textarea is enabled with the default placeholder", () => {
    render(
      <MessageInput
        onSend={() => {}}
        disabled={false}
        workflowLocked={false}
        onAgentModeChange={() => {}}
        {...MODEL_PROPS}
      />,
    )
    const textarea = screen.getByPlaceholderText("Ask anything…")
    expect(textarea).not.toBeDisabled()
    expect(screen.queryByPlaceholderText("Workflow running — Cancel to switch back")).toBeNull()
  })
})
