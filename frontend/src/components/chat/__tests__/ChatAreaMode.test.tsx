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
// Phase 194.1 Plan 04: the composer's Stop now dispatches the STORE action rather
// than a prop, so the Cancel-reachability case below asserts on the store.
import { useStreamsStore } from "@/stores/streamsStore"

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
  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * ⚠ SUPERSEDED BY PHASE 194.1 PLAN 04 (R1 / D-05) — 2026-08-16. The original,
   * VERBATIM:
   *
   *     it("with disabled/streaming, composer-stop renders and clicking it calls onStop", () => {
   *       const onStop = vi.fn()
   *       render(
   *         <MessageInput onSend={() => {}} onStop={onStop} disabled
   *           onAgentModeChange={() => {}} {...MODEL_PROPS} />,
   *       )
   *       // The post-removal Cancel is the existing right-side Stop button — no new chrome.
   *       const stop = screen.getByTestId("composer-stop")
   *       expect(stop).toBeInTheDocument()
   *       fireEvent.click(stop)
   *       expect(onStop).toHaveBeenCalledTimes(1)
   *     })
   *
   * ⚠ TWO THINGS CHANGED AND ONLY ONE OF THEM IS COSMETIC.
   *
   *  1. The composer carries no Stop dispatcher prop any more — `<StopControl>`
   *     calls `stopThread(threadId)` off the StreamsProvider store. So the press is
   *     now asserted on the STORE ACTION, which is strictly stronger: the original
   *     could only see that the composer invoked whatever the page handed it, and
   *     CONTEXT D-22 measured that what the page handed it went to `stopStream`
   *     rather than `stopThread`.
   *
   *  2. ⚠ **`threadId` IS NOW REQUIRED FOR THE CONTROL TO RENDER AT ALL**, and this
   *     case is the one that would catch it if that were wrong. The original passed
   *     none. It loses no live case — `ChatArea.tsx` derives `disabled` from
   *     `useStreamingForThread(thread?.id ?? null)`, which is false without a
   *     thread, so `disabled === true` implies a thread exists — but the D-01
   *     property this case guards ("Cancel stays reachable after the front-door
   *     removal") is now conditional on the page passing `threadId`, and that is
   *     recorded rather than discovered later.
   * ═══════════════════════════════════════════════════════════════════════════
   */
  it("with disabled/streaming + a threadId, composer-stop renders and dispatches stopThread", () => {
    const stopThread = vi.fn()
    useStreamsStore.setState((s) => ({ actions: { ...s.actions, stopThread } }))

    render(
      <MessageInput
        onSend={() => {}}
        disabled
        threadId="thread-cancel-reach"
        onAgentModeChange={() => {}}
        {...MODEL_PROPS}
      />,
    )
    // The post-removal Cancel is the existing right-side Stop button — no new chrome.
    const stop = screen.getByTestId("composer-stop")
    expect(stop).toBeInTheDocument()
    fireEvent.click(stop)
    expect(stopThread).toHaveBeenCalledTimes(1)
    expect(stopThread).toHaveBeenCalledWith("thread-cancel-reach")
  })

  /** The complement, and it is a real product statement rather than defensive
   *  padding: with no thread there is no run to stop, so no inert control renders.
   *  An inert Stop is the exact thing Phase 194.1 exists to remove.
   *
   *  ⚠ `MODEL_PROPS` is deliberately NOT spread here. Every render in this file that
   *  spreads it contributes one PRE-EXISTING `TS2322` (its `readonly` tuples are not
   *  assignable to `Props`' mutable arrays) — four of them are in the tree's baseline
   *  of 33. Adding a fifth would have moved the typecheck count for a reason having
   *  nothing to do with this plan, which is exactly the drift `194.1-BASELINE.md` §11
   *  exists to make visible. This case needs no model props to say what it says. */
  it("with NO threadId the composer renders no Stop control at all", () => {
    render(<MessageInput onSend={() => {}} disabled />)
    expect(screen.queryByTestId("composer-stop")).toBeNull()
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
