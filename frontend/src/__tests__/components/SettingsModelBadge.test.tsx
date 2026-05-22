import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
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

  it("renders the tooltip text containing 'verified registry' / 'Safe defaults applied'", () => {
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
    expect(badge?.getAttribute("title")).toContain("Safe defaults applied")
    expect(badge?.getAttribute("title")).toContain("inferred provider: google")
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
    const badge = container.querySelector("[title*='Safe defaults applied']") as HTMLElement | null
    expect(badge?.getAttribute("title")).toContain("inferred provider: openrouter")
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
