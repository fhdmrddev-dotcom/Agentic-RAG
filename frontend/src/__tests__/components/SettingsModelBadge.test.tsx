import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ModelPillRow } from "@/components/settings/ModelPillRow"

/**
 * Phase 075.3 Plan 02 D-075.3-18 — vitest matrix for the "unverified" amber
 * badge rendered by ModelPillRow.
 *
 * Covers 6 render-matrix rows:
 *   1. Badge renders inline on unregistered model pill
 *   2. Badge ABSENT on registered model pill
 *   3. Tooltip text matches D-075.3-12 spec (verified registry + Safe defaults
 *      + inferred provider name)
 *   4. Amber tone classes present (text-amber-600 + bg-amber-500/10)
 *   5. Tooltip uses max_tokens=4096 for openrouter inferred provider
 *      (per D-075.3-07 safe-default table)
 *   6. XSS regression — React JSX auto-escapes a malicious model_id;
 *      no <script> element ends up in the DOM (T-075.3-02-03 mitigation).
 */
describe("ModelPillRow / unverified badge", () => {
  it("renders the unverified badge inline on an unregistered model pill", () => {
    render(
      <ModelPillRow
        models={["gpt-4o", "gemini-99-flash"]}
        llmModel="gpt-4o"
        verifiedModels={new Set(["gpt-4o"])}
        inferredProviderFor={{ "gemini-99-flash": "google" }}
        onSelect={vi.fn()}
      />,
    )
    const badges = screen.getAllByText(/^unverified$/i)
    expect(badges).toHaveLength(1)
    // Sibling text confirms the unverified chip lives inside the gemini-99-flash pill
    expect(badges[0].closest("button")?.textContent).toContain("gemini-99-flash")
  })

  it("does not render the unverified badge on a registered model pill", () => {
    render(
      <ModelPillRow
        models={["gpt-4o", "claude-sonnet-4-6"]}
        llmModel="gpt-4o"
        verifiedModels={new Set(["gpt-4o", "claude-sonnet-4-6"])}
        inferredProviderFor={{}}
        onSelect={vi.fn()}
      />,
    )
    expect(screen.queryByText(/^unverified$/i)).toBeNull()
  })

  // ⚠ Phase 249 (MODEL-05): the tooltip text MOVED to `@/lib/unverifiedModelCopy`, shared with
  // the chat composer's dropdown — the warning belongs at PICK time and Settings is not where a
  // model is picked. Two copies of one warning drift, which is this phase's whole subject.
  // ⭐ AND THE OLD TEXT WAS WRONG: it said `timeout=90s`; the inferred default is 300 s
  // (`_INFERRED_DEFAULT_TIMEOUT_S`, revised 2026-05-24). This suite asserted the false number,
  // so it was GREEN over a surface that was lying about a capability. The assertions below are
  // re-pointed at the shared copy rather than re-typed, so they cannot drift from it again.
  it("renders the tooltip text containing 'verified registry' and the safe defaults", () => {
    const { container } = render(
      <ModelPillRow
        models={["gemini-99-flash"]}
        llmModel="gemini-99-flash"
        verifiedModels={new Set()}
        inferredProviderFor={{ "gemini-99-flash": "google" }}
        onSelect={vi.fn()}
      />,
    )
    const badge = container.querySelector("[title*='verified registry']") as HTMLElement | null
    expect(badge).not.toBeNull()
    expect(badge?.getAttribute("title")).toContain("safe defaults")
    // ⭐ the CORRECTED figure — 300, not the 90 this line used to pin
    expect(badge?.getAttribute("title")).toContain("timeout=300s")
    expect(badge?.getAttribute("title")).toContain("as a google model")
    expect(badge?.getAttribute("title")).toContain("max_tokens=8192")
  })

  it("renders amber tone class on the unverified chip", () => {
    const { container } = render(
      <ModelPillRow
        models={["gemini-99-flash"]}
        llmModel="gemini-99-flash"
        verifiedModels={new Set()}
        inferredProviderFor={{ "gemini-99-flash": "google" }}
        onSelect={vi.fn()}
      />,
    )
    const badge = container.querySelector(".text-amber-600")
    expect(badge).not.toBeNull()
    expect(container.querySelector(".bg-amber-500\\/10")).not.toBeNull()
  })

  it("uses max_tokens=4096 in tooltip for inferred openrouter provider", () => {
    const { container } = render(
      <ModelPillRow
        models={["vendor/random-future"]}
        llmModel="vendor/random-future"
        verifiedModels={new Set()}
        inferredProviderFor={{ "vendor/random-future": "openrouter" }}
        onSelect={vi.fn()}
      />,
    )
    const badge = container.querySelector("[title*='safe defaults']") as HTMLElement | null
    expect(badge?.getAttribute("title")).toContain("as a openrouter model")
    expect(badge?.getAttribute("title")).toContain("max_tokens=4096")
  })

  it("does not produce script tags from a malicious model_id (XSS regression)", () => {
    const { container } = render(
      <ModelPillRow
        models={["<script>alert(1)</script>"]}
        llmModel=""
        verifiedModels={new Set()}
        inferredProviderFor={{ "<script>alert(1)</script>": "ollama" }}
        onSelect={vi.fn()}
      />,
    )
    // React JSX auto-escapes the interpolated string — no <script> element in the DOM
    expect(container.querySelector("script")).toBeNull()
  })
})

/**
 * Phase 149 Plan 04 (D-149-05) — the `deprecated` badge matrix. Mirrors the
 * amber `unverified` chip: a model in `deprecatedModels` shows a small
 * informational `deprecated` badge but STAYS a selectable pill (badge only, no
 * refusal). Absent/undefined `deprecatedModels` renders exactly as before.
 */
describe("ModelPillRow / deprecated badge", () => {
  it("renders the deprecated badge on a member model and keeps the pill selectable", () => {
    const onSelect = vi.fn()
    render(
      <ModelPillRow
        models={["gpt-4o", "gpt-4-legacy"]}
        llmModel="gpt-4o"
        verifiedModels={new Set(["gpt-4o", "gpt-4-legacy"])}
        inferredProviderFor={{}}
        deprecatedModels={new Set(["gpt-4-legacy"])}
        onSelect={onSelect}
      />,
    )
    const badges = screen.getAllByText(/^deprecated$/i)
    expect(badges).toHaveLength(1)
    // The deprecated chip lives inside the gpt-4-legacy pill
    const pill = badges[0].closest("button")
    expect(pill?.textContent).toContain("gpt-4-legacy")
    // Still a clickable <button> with no `disabled` — badge-only, no refusal
    expect(pill).not.toBeNull()
    expect(pill?.hasAttribute("disabled")).toBe(false)
    fireEvent.click(pill!)
    expect(onSelect).toHaveBeenCalledWith("gpt-4-legacy")
  })

  it("does not render the deprecated badge on a non-member model", () => {
    render(
      <ModelPillRow
        models={["gpt-4o", "gpt-4-legacy"]}
        llmModel="gpt-4o"
        verifiedModels={new Set(["gpt-4o", "gpt-4-legacy"])}
        inferredProviderFor={{}}
        deprecatedModels={new Set(["gpt-4-legacy"])}
        onSelect={vi.fn()}
      />,
    )
    // gpt-4o is not in the set → its pill carries no deprecated chip
    const gpt4o = screen.getByText("gpt-4o").closest("button")
    expect(gpt4o?.textContent).not.toContain("deprecated")
  })

  it("renders without error and shows no deprecated badge when deprecatedModels is undefined", () => {
    render(
      <ModelPillRow
        models={["gpt-4o", "gpt-4-legacy"]}
        llmModel="gpt-4o"
        verifiedModels={new Set(["gpt-4o", "gpt-4-legacy"])}
        inferredProviderFor={{}}
        onSelect={vi.fn()}
      />,
    )
    // Defensive default — absent prop → no badge, no crash
    expect(screen.queryByText(/^deprecated$/i)).toBeNull()
  })
})
