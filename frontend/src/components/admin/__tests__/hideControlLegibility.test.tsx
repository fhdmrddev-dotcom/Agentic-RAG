/**
 * Phase 249 Plan 01 (MODEL-07 / BUG-260908-03) — the hide-ish controls explain themselves.
 *
 * ── WHAT THIS FENCES, AND WHY IT IS NOT A LABEL TEST ────────────────────────────────
 *
 * An operator who wanted a model gone from the chat picker reached for `deprecated`, which
 * DELIBERATELY keeps it selectable, while `Enabled` — the control that actually hides it — went
 * unnoticed one column away. Verbatim: *"It is actually called deprecated and when toggled, it is
 * still showing in the selector but with a deprecated tag."*
 *
 * ⚠ The capability they wanted ALREADY EXISTED. Nothing in the backend was broken. And the
 * obvious fix had already been built and had already failed: the `Users see` column + its
 * `CouplingChip` ARE the "enabled→picker coupling made visible" affordance, and the row was still
 * misread. So the words go ON the control, not into a fourth passive column.
 *
 * ── ASSERTIONS ARE ON RENDERED CONTENT, NEVER ON PRESENCE ───────────────────────────
 *
 * Phase 235 measured a green `data-testid` presence fence coexisting with the shipped defect,
 * because presence assertions cannot see content drift. Every case below reads the text a person
 * (or a screen reader) actually receives.
 *
 * ── ⛔ AND ONE CASE PINS WHAT MUST *NOT* CHANGE ─────────────────────────────────────
 *
 * `deprecated`'s semantics are a shipped decision (D-149-04): a deprecated row stays enabled and
 * selectable. The last case fails if a future "fix" quietly couples the two — which would be a
 * behaviour change wearing a legibility change's clothes.
 */
import { afterEach, describe, expect, it } from "vitest"
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react"

import type { ReactElement } from "react"

import { ModelRegistryTab } from "../ModelRegistryTab"
import type { ModelRegistryRow } from "@/lib/api"

afterEach(cleanup)

const noop = () => Promise.resolve()

/** Render and OPEN every provider section — the shipped tab lands FOLDED, so a test that queries
 *  a row control has to expand first, exactly as a person does. Scoped to provider headers so the
 *  add-by-ID disclosure is not silently opened too. */
function renderTab(ui: ReactElement) {
  const result = render(ui)
  document
    .querySelectorAll<HTMLButtonElement>('[data-provider] > button[aria-expanded="false"]')
    .forEach((btn) => fireEvent.click(btn))
  return result
}

function makeRow(overrides: Partial<ModelRegistryRow> = {}): ModelRegistryRow {
  return {
    model_id: "gpt-5.6-sol",
    provider: "openai",
    capability_source: "registry",
    enabled: true,
    deprecated: false,
    context_window_tokens: 400000,
    max_output_tokens: 128000,
    native_tools: true,
    llm_call_timeout_seconds: 600,
    is_default: false,
    is_locked: false,
    emit_tier: null,
    overridden_fields: [],
    ...overrides,
  }
}

/** The element a control's `aria-describedby` points at, resolved through the DOM rather than
 *  guessed — so a fence cannot pass against a description the control does not actually reference. */
function describedTextFor(label: string): string {
  const control = screen.getByLabelText(label)
  const id = control.getAttribute("aria-describedby")
  expect(id, `"${label}" has no aria-describedby — nothing tells the operator what it does`).toBeTruthy()
  const note = document.getElementById(id!)
  expect(note, `aria-describedby="${id}" points at nothing`).toBeTruthy()
  return note!.textContent ?? ""
}

describe("MODEL-07 — each hide-ish control says what it does, where it is reached", () => {
  it("the deprecated control says it does NOT hide the model, and names Enabled", () => {
    renderTab(
      <ModelRegistryTab
        rows={[makeRow()]}
        onSetCapability={noop}
        onLock={noop}
        showTechnical={false}
      />,
    )

    const text = describedTextFor("Deprecated for gpt-5.6-sol")

    // It stays in the picker — the exact fact the operator got wrong.
    expect(text).toMatch(/stays in the picker/i)
    // …and it points at the control that DOES hide it, by name.
    expect(text).toMatch(/\bEnabled\b/)
  })

  it("the deprecated note also names Remove — the third answer the bug report predates", () => {
    // `Remove` arrived with migration 179, AFTER BUG-260908-03 was filed. An operator asking
    // "how do I get rid of this?" has three answers and should see all three at once rather
    // than discovering the third later.
    renderTab(
      <ModelRegistryTab rows={[makeRow()]} onSetCapability={noop} onLock={noop} showTechnical={false} />,
    )

    expect(describedTextFor("Deprecated for gpt-5.6-sol")).toMatch(/\bRemove\b/)
  })

  it("the deprecated note is VISIBLE, not hidden behind a hover", () => {
    // ⚠ The loud half of this fix must not be a `title=`. The operator arriving with the wrong
    // mental model will not hover a switch to have it corrected.
    renderTab(
      <ModelRegistryTab rows={[makeRow()]} onSetCapability={noop} onLock={noop} showTechnical={false} />,
    )

    const note = document.getElementById("deprecated-note-gpt-5.6-sol")
    expect(note).toBeTruthy()
    expect(note!.className).not.toMatch(/\bsr-only\b/)
  })

  it("the Enabled control says what turning it off does to the picker", () => {
    renderTab(
      <ModelRegistryTab rows={[makeRow()]} onSetCapability={noop} onLock={noop} showTechnical={false} />,
    )

    const text = describedTextFor("Enabled for gpt-5.6-sol")
    expect(text).toMatch(/disappears from the picker/i)
  })

  it("⛔ the deprecated note never CLAIMS to hide the model", () => {
    // The negative arm. A reword that accidentally turned the redirect into "this hides the
    // model" would satisfy case 1's /stays in the picker/ only by luck; this pins the claim
    // itself rather than hunting a substring.
    renderTab(
      <ModelRegistryTab rows={[makeRow()]} onSetCapability={noop} onLock={noop} showTechnical={false} />,
    )

    const text = describedTextFor("Deprecated for gpt-5.6-sol")
    expect(text).not.toMatch(/(hides|removes|takes) it (from|out of) the picker/i)
  })

  it("⛔ deprecated STILL does not change the coupling chip (D-149-04 unchanged)", () => {
    // The behaviour pin. A deprecated row stays enabled and selectable; this phase changed the
    // words and nothing else, and a future "fix" that couples them fails here.
    const { container } = renderTab(
      <ModelRegistryTab
        rows={[makeRow({ deprecated: true, enabled: true })]}
        onSetCapability={noop}
        onLock={noop}
        showTechnical={false}
      />,
    )

    const row = container.querySelector('[data-model="gpt-5.6-sol"]')!
    expect(row.getAttribute("data-coupling")).toBe("shown")
    expect(within(row as HTMLElement).getByText(/in picker/)).toBeTruthy()
  })
})
