/**
 * Phase 094 Plan 05 Task 1 (D-02) — the DISPLAYED mode label reads SERVER TRUTH.
 *
 * The bug (finding #5): the composer's Deep/Harness pill rendered the local
 * `workflowMode` launch-toggle useState, which goes stale before the mount-time
 * `getThreadWorkflow` reconcile — so a running Harness workflow could show as
 * "Deep". The fix points the DISPLAYED label at a new `displayedMode` prop the
 * parent derives from `workflowLocked` (the server-truth lock reconciled from
 * `active_workflow_run_id`), while the launch toggle + kickoff staging keep
 * reading `workflowMode` (the user's intent for the NEXT kickoff).
 *
 * This file unit-tests MessageInput's pill in isolation: when the displayed mode
 * is "harness" (server truth) the badge MUST read "Harness" regardless of the
 * local `workflowMode` toggle; when "deep" it reads "Deep".
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import { MessageInput } from "../MessageInput"

afterEach(() => cleanup())

/** The Deep/Harness toggle button — keyed off its stable data-testid. */
function modePill(): HTMLElement {
  return screen.getByTestId("workflow-mode-selector")
}

describe("MessageInput mode label (D-02 — server truth, finding #5)", () => {
  it("reads 'Harness' when displayedMode is harness even if the local workflowMode toggle is 'deep'", () => {
    render(
      <MessageInput
        onSend={() => {}}
        disabled={false}
        // Server truth: a workflow is running → harness. The local toggle is
        // stale at "deep" (the finding-#5 condition).
        displayedMode="harness"
        workflowMode="deep"
        workflowLocked
        onWorkflowModeChange={() => {}}
        onAgentModeChange={() => {}}
      />,
    )
    // Server truth wins — the displayed badge reads "Harness", NOT "Deep".
    expect(within(modePill()).getByText("Harness")).toBeInTheDocument()
    expect(within(modePill()).queryByText("Deep")).not.toBeInTheDocument()
  })

  it("reads 'Deep' when displayedMode is deep (no active run)", () => {
    render(
      <MessageInput
        onSend={() => {}}
        disabled={false}
        displayedMode="deep"
        workflowMode="deep"
        workflowLocked={false}
        onWorkflowModeChange={() => {}}
        onAgentModeChange={() => {}}
      />,
    )
    expect(within(modePill()).getByText("Deep")).toBeInTheDocument()
    expect(within(modePill()).queryByText("Harness")).not.toBeInTheDocument()
  })

  it("falls back to workflowMode for the displayed label when displayedMode is absent (back-compat)", () => {
    render(
      <MessageInput
        onSend={() => {}}
        disabled={false}
        // No displayedMode prop → the label defaults to the workflowMode toggle.
        workflowMode="harness"
        onWorkflowModeChange={() => {}}
        onAgentModeChange={() => {}}
      />,
    )
    expect(within(modePill()).getByText("Harness")).toBeInTheDocument()
  })
})
