/**
 * Phase 087 Wave 0 — WorkspacePanel contract (PANEL-01).
 *
 * GREEN-only scaffolding: WorkspacePanel is not built yet (Plan 02 lands it).
 * The `it.todo(...)` strings below are the concrete assertions Plan 02 MUST flip
 * to live tests when it builds the shell. Fixtures are imported so the wire
 * contract is anchored here even before the component exists.
 */
import { describe, it } from "vitest"
import {
  mockUseTodos,
  mockUseWorkspaceFiles,
  mockUseAskUserPrompt,
  mockViewingThread,
} from "./fixtures"

// Anchor the hook-mock contract so Plan 02 wires these exact returns.
void mockUseTodos
void mockUseWorkspaceFiles
void mockUseAskUserPrompt
void mockViewingThread

describe("WorkspacePanel (PANEL-01) — toggle state machine + empty short-circuit", () => {
  it.todo("renders the three-state toggle: open → rail → hidden via the header button")
  it.todo("toggles open ↔ collapsed on ⌘. / Ctrl+. keydown")
  it.todo("collapsed rail shows count badges (todos / files) and an amber warn dot when an ask_user is pending")
  it.todo("short-circuits to a single <PanelEmpty/> when todos, files, and asks are all empty (no four empty headers)")
  it.todo("renders all four stacked-accordion sections when any section has data")
  it.todo("pins the pending ask_user card to the very top of the panel scroll")
  it.todo("renders as a bottom-sheet (Sheet primitive) below the 768px breakpoint")
  it.todo("reads useViewingThread + the four Phase 086 hooks reactively (no page refresh)")
})
