/**
 * Phase 155 Plan 05 Task 2 — ModelRegistryTab a11y contract (WCAG 2.1 AA / D-01, D-05).
 *
 * The 070-A instrument table is a PURE PRESENTATIONAL LEAF (props in, DOM out; the shell
 * owns the fetch + writes). Its honest states are loading (`rows === null` → role="status"),
 * empty (`[]`), and populated (provider-grouped rows). This suite locks the D-12
 * zero-STRUCTURAL-violations bar across those states plus the D-05 registry-row control
 * contract:
 *   - the editable-column controls carry associated accessible names: the numeric cells
 *     are role="button" ("Edit <col> for <id>"), the capability toggles are role="switch"
 *     ("Native tools / Enabled / Deprecated for <id>"), the Reset is named, and the
 *     inline number editor is a role="spinbutton" ("<col> for <id>");
 *   - the icon-only lock control carries an aria-label ("Lock <id> as org default" /
 *     "Unlock <id>") — never glyph/colour-alone;
 *   - the provider brand icons are DECORATIVE (no unnamed role="img") — the meaningful
 *     name lives on the enclosing provider-section button (the Phase-127 icon convention);
 *   - the enabled→picker coupling reads as a visible WORD ("in picker" / "hidden").
 *
 * D-14 DOCUMENTED EXCLUSION (confirmed false-positive — mirrored in 155-VALIDATION.md):
 * the trailing actions column uses `<th aria-label="Row actions" />` (an intentionally
 * text-less action column). axe's `empty-table-header` rule (tag: best-practice — NOT a
 * WCAG A/AA rule) flags it because the header has no VISIBLE text, yet the column header
 * IS accessibly named via aria-label ("Row actions"), so the barrier the rule guards (an
 * unnamed column header) does not exist for AT users. Per D-14 this is a per-rule
 * exclusion scoped to ONLY the two states that render the table (populated + ⌥ technical);
 * every WCAG-AA structural rule stays ON, and the header's accessible name is asserted
 * positively below so the exclusion can never hide a genuinely unnamed header.
 * Selector: th[aria-label="Row actions"]. NEVER a global disable.
 *
 * STRUCTURAL rules only (no contrast assertion).
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"

import { ModelRegistryTab } from "../ModelRegistryTab"
import type { ModelRegistryRow } from "@/lib/api"

const noop = () => Promise.resolve()

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
    // Phase 196 (AUTH-04): `null` = the shipped state for every pre-migration-120 row.
    emit_tier: null,
    overridden_fields: [],
    ...overrides,
  }
}

const ROWS: ModelRegistryRow[] = [
  makeRow({ model_id: "gpt-5.6-sol", enabled: true, overridden_fields: ["context_window_tokens"] }),
  makeRow({ model_id: "gpt-5.6-nova", enabled: false, is_locked: false }),
]

/** D-14 per-rule exclusion (see the file header) — applied ONLY to the two table-
 *  rendering scans. `empty-table-header` is an axe best-practice rule (not WCAG A/AA);
 *  the flagged `th[aria-label="Row actions"]` IS accessibly named, asserted positively. */
const AXE_TABLE_OPTS = { rules: { "empty-table-header": { enabled: false } } } as const

function renderRegistry(rows: ModelRegistryRow[] | null, showTechnical = false) {
  return render(
    <ModelRegistryTab
      rows={rows}
      onSetCapability={noop}
      onLock={noop}
      showTechnical={showTechnical}
    />,
  )
}

/** Assert every provider/model brand icon is decorative-or-labeled: no SVG exposes an
 *  image-semantics role without an accessible name (the axe svg-img-alt condition made
 *  explicit — the Phase-127 @lobehub convention keeps the mark decorative). */
function assertIconsDecorativeOrLabeled(container: HTMLElement) {
  const imgRoleSvgs = Array.from(container.querySelectorAll("svg")).filter((s) =>
    ["img", "graphics-document", "graphics-symbol"].includes(s.getAttribute("role") ?? ""),
  )
  for (const svg of imgRoleSvgs) {
    const named =
      svg.hasAttribute("aria-label") ||
      svg.hasAttribute("aria-labelledby") ||
      svg.querySelector("title") != null
    expect(named).toBe(true)
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("ModelRegistryTab a11y — WCAG 2.1 AA (structural) across honest states", () => {
  it("no aXe structural violations — loading (rows === null, role=status)", async () => {
    const { container } = renderRegistry(null)
    await screen.findByRole("status")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — empty (no models yet)", async () => {
    const { container } = renderRegistry([])
    await screen.findByText(/no models in the registry yet/i)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — populated (enabled + disabled rows, provider-grouped)", async () => {
    const { container } = renderRegistry(ROWS)
    await screen.findByText("gpt-5.6-sol")
    expect(await axe(container, AXE_TABLE_OPTS)).toHaveNoViolations() // D-14: see file header
  })

  it("no aXe structural violations — ⌥ Technical names revealed (raw column names appear)", async () => {
    const { container } = renderRegistry(ROWS, true)
    await screen.findAllByText("context_window_tokens")
    expect(await axe(container, AXE_TABLE_OPTS)).toHaveNoViolations() // D-14: see file header
  })

  it("the loading state uses role=status (the leaf's honest in-flight signal)", () => {
    renderRegistry(null)
    expect(screen.getByRole("status")).toHaveTextContent(/loading the model registry/i)
  })

  it("the trailing actions column header IS accessibly named (the D-14 exclusion is honest — no unnamed header)", () => {
    renderRegistry(ROWS)
    // The `empty-table-header` exclusion above only holds because this header carries an
    // accessible name via aria-label — proving the exclusion never hides a real barrier.
    expect(screen.getByRole("columnheader", { name: /row actions/i })).toBeInTheDocument()
  })
})

describe("ModelRegistryTab a11y — D-05 editable-column controls have accessible names", () => {
  it("the numeric-cell edit buttons carry an accessible name per column", () => {
    renderRegistry(ROWS)
    expect(screen.getByRole("button", { name: /edit context for gpt-5\.6-sol/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /edit max out for gpt-5\.6-sol/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /edit timeout for gpt-5\.6-sol/i })).toBeInTheDocument()
  })

  it("the capability toggles are role=switch reachable by accessible name", () => {
    renderRegistry(ROWS)
    expect(screen.getByRole("switch", { name: /native tools for gpt-5\.6-sol/i })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: /^enabled for gpt-5\.6-sol/i })).toBeInTheDocument()
    expect(screen.getByRole("switch", { name: /deprecated for gpt-5\.6-sol/i })).toBeInTheDocument()
  })

  it("the inline number editor is a named role=spinbutton once opened", async () => {
    const user = userEvent.setup()
    renderRegistry(ROWS)
    await user.click(screen.getByRole("button", { name: /edit context for gpt-5\.6-sol/i }))
    expect(screen.getByRole("spinbutton", { name: /^context for gpt-5\.6-sol/i })).toBeInTheDocument()
  })

  it("a Reset (on an overridden field) is a named control", () => {
    renderRegistry(ROWS)
    // gpt-5.6-sol has context overridden → a named Reset appears for that field only.
    expect(screen.getByRole("button", { name: /reset context for gpt-5\.6-sol/i })).toBeInTheDocument()
  })
})

describe("ModelRegistryTab a11y — icon-only lock control + decorative brand icons", () => {
  it("the lock control carries an aria-label (icon-only, never glyph/colour-alone)", () => {
    renderRegistry(ROWS)
    // Enabled row → "Lock … as org default"; disabled row → same label but gated.
    expect(
      screen.getByRole("button", { name: /lock gpt-5\.6-sol as org default/i }),
    ).toBeInTheDocument()
    const gated = screen.getByRole("button", { name: /lock gpt-5\.6-nova as org default/i })
    expect(gated).toHaveAttribute("aria-disabled", "true")
  })

  it("the provider brand icons are decorative-or-labeled (no unnamed image-role SVG)", async () => {
    const { container } = renderRegistry(ROWS)
    await screen.findByText("gpt-5.6-sol")
    assertIconsDecorativeOrLabeled(container)
    // The meaningful name lives on the enclosing provider-section button.
    expect(screen.getByRole("button", { name: /openai/i })).toBeInTheDocument()
  })

  it("the enabled→picker coupling reads as a visible WORD (never colour-alone)", () => {
    const { container } = renderRegistry(ROWS)
    const shown = container.querySelector<HTMLElement>('[data-model="gpt-5.6-sol"]')!
    const hidden = container.querySelector<HTMLElement>('[data-model="gpt-5.6-nova"]')!
    expect(within(shown).getByText(/in picker/i)).toBeInTheDocument()
    expect(within(hidden).getByText(/hidden/i)).toBeInTheDocument()
  })
})
