/**
 * Phase 087 Wave 0 — PendingAskCard contract (PANEL-04, D-03/D-04).
 *
 * GREEN-only scaffolding: PendingAskCard is not built yet (Plan 05). The
 * `it.todo(...)` strings are the concrete assertions Plan 05 MUST flip to live
 * tests. Fixtures anchor both the GET-reconciled prompt (run_id present) and the
 * pure-SSE prompt (run_id ABSENT — A2 / Pitfall 1: submit must be gated).
 */
import { describe, it } from "vitest"
import { mockPendingAskWithRunId, mockPendingAskNoRunId } from "./fixtures"

void mockPendingAskWithRunId
void mockPendingAskNoRunId

describe("PendingAskCard (PANEL-04) — answer + resume", () => {
  it.todo("renders the prompt text + the amber needs-you treatment")
  it.todo("renders choice chips above the free-text field only when options are supplied")
  it.todo("always renders the free-text field even when options is [] (no-options trap, D3)")
  it.todo("disables Submit until the user picks a chip or types free-text")
  it.todo("calls answerAskUser(run_id, { tool_call_id, response_text, choice_index }) on submit with run_id present")
  it.todo("gates submit (disabled / triggers reconcile) when PendingAsk.run_id is undefined (A2 / Pitfall 1)")
  it.todo("flips to the green 'Answered · agent resumed' state after a successful submit (D4)")
  it.todo("renders the calm '.expired' state on timeout, never an opaque crash (D5)")
  it.todo("stacks multiple pending asks — newest pinned on top, each its own amber card (D-03)")
})
