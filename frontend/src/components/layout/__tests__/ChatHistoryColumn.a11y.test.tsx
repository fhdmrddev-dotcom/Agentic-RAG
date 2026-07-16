/**
 * Phase 156 (POLISH-01) — ChatHistoryColumn a11y do-no-harm contract (A11Y-01).
 *
 * Wave-0 `it.todo` scaffold (Nyquist target). Waves 1-2 replace each todo with a
 * live vitest-axe test (the `expect(await axe(container)).toHaveNoViolations()`
 * idiom, mirroring RelationshipsSection.a11y.test.tsx). The todos lock the
 * Phase-155 A11Y-01 invariants the MOVE must preserve: no axe AA violations across
 * states, real <button> rows, and the actions reveal is CSS-gated on
 * group-focus-within (keyboard-reachable), never render-gated.
 *
 * Deliberately imports NOTHING from ../ChatHistoryColumn — the component does not
 * exist yet; `it.todo` takes only a string, so this file collects GREEN (pending).
 */
import { describe, it } from "vitest"

describe("ChatHistoryColumn a11y — no axe AA violations across states (A11Y-01)", () => {
  it.todo("axe(container) reports no violations — populated")
  it.todo("axe(container) reports no violations — empty")
  it.todo("axe(container) reports no violations — filtered (mid-search)")
})

describe("ChatHistoryColumn a11y — keyboard-reachable rows + actions (A11Y-01 / D-09)", () => {
  it.todo("every thread row is a real <button> (keyboard-operable primary target)")
  it.todo("the Stop/options actions are siblings of the row button (never nested buttons)")
  it.todo("the row actions container is CSS-gated on group-focus-within — revealed by keyboard focus, never render-gated on mouse state")
})

// Wave 1/2 replaces each it.todo with a live render test importing the component.
