/**
 * Phase 087 Wave 0 — Chat↔Panel Seam contract (D-05, sketch 007).
 *
 * GREEN-only scaffolding: the seam renderers (SeamPointer / SeamCard /
 * PausedRunCue) are not built yet (later wave). The `it.todo(...)` strings are
 * the concrete assertions that wave MUST flip to live tests.
 *
 * Mental model (LOCKED): panel = now, chat = happened. Live runs render quiet
 * one-line pointers in chat; reloaded history resolves to self-contained cards.
 * The seam additions are ADDITIVE — they must NOT modify RunCard / ToolCallPanel
 * internals (BUG-260529-02 kept SEPARATE).
 */
import { describe, it } from "vitest"
import { mockPendingAskWithRunId, mockWorkspaceFiles } from "./fixtures"

void mockPendingAskWithRunId
void mockWorkspaceFiles

describe("Chat↔Panel Seam (D-05) — live pointer vs reload card", () => {
  it.todo("live mode → renders SeamPointer: a quiet one-line 'Answer in panel →' pointer, NOT a rich duplicate card")
  it.todo("reload mode → renders SeamCard: a self-contained card carrying the resolved Q&A (closes the ask_user reload gap)")
  it.todo("never renders raw JSON / a raw byte dump for a panel-owned tool (write_todos / workspace_write / ask_user)")
  it.todo("renders the same data in exactly one surface — live in panel, history in transcript — never richly in both")
  it.todo("PausedRunCue is additive: it does not modify RunCard / ToolCallPanel internals (BUG-260529-02 stays separate)")
  it.todo("a panel SSE event does not re-render / flicker the chat message list (PANEL-06 isolation)")
})
