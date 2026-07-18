/**
 * Phase 155 Plan 05 Task 1 — FeatureVisibility a11y contract (WCAG 2.1 AA / D-01, D-05).
 *
 * The 069-A audience rows are a PURE PRESENTATIONAL LEAF (props in, DOM out; the shell
 * owns the audience map + server write). It has no fetch, so its honest states are the
 * enum values themselves: all-Everyone, an Operators-only card, and ⌥ Technical names
 * revealed. This suite locks the D-12 zero-STRUCTURAL-violations bar across those states
 * plus the D-05 audience-control contract:
 *   - each card's audience control is a role="radiogroup" ("Audience") with two
 *     role="radio" options ("Everyone" / "⛨ Operators only") reachable by name, whose
 *     aria-checked reflects the enum value (SEED-115 — an enum, never a boolean);
 *   - the state is a visible WORD (the radio labels + the Operators-only consequence
 *     line), never colour-alone.
 *
 * STRUCTURAL rules only (no contrast assertion).
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import { axe } from "vitest-axe"

import { FeatureVisibility } from "../FeatureVisibility"
import type { FeatureAudience, GovernedFeature } from "@/lib/api"

const ALL_EVERYONE: Record<GovernedFeature, FeatureAudience> = {
  skill_studio: "everyone",
  model_management: "everyone",
  workflow_authoring: "everyone",
  governance_health: "everyone",
}

const MIXED: Record<GovernedFeature, FeatureAudience> = {
  ...ALL_EVERYONE,
  model_management: "operators",
}

function renderVisibility(
  visibility: Record<GovernedFeature, FeatureAudience>,
  showTechnical = false,
) {
  return render(
    <FeatureVisibility
      visibility={visibility}
      onSetVisibility={vi.fn().mockResolvedValue(undefined)}
      showTechnical={showTechnical}
    />,
  )
}

/** The card wrapper carries `data-feature`/`data-audience` — the row-scoping handle. */
function cardFor(container: HTMLElement, key: GovernedFeature): HTMLElement {
  return container.querySelector<HTMLElement>(`[data-feature="${key}"]`)!
}

afterEach(() => {
  cleanup()
})

describe("FeatureVisibility a11y — WCAG 2.1 AA (structural) across honest states", () => {
  it("no aXe structural violations — all Everyone (calm default)", async () => {
    const { container } = renderVisibility(ALL_EVERYONE)
    await screen.findByText("Skill Studio")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — an Operators-only card (consequence line shown)", async () => {
    const { container } = renderVisibility(MIXED)
    await screen.findByText(/end users no longer see model management/i)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — ⌥ Technical names revealed (route prefixes appear)", async () => {
    const { container } = renderVisibility(MIXED, true)
    // The raw route prefixes sit behind the ⌥ reveal, inside the enforcement <dl>.
    await screen.findByText(/\/settings \(model_management endpoints\)/i)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("FeatureVisibility a11y — D-05 audience control (enum radiogroup, role + name)", () => {
  it("each card's audience control is a named radiogroup with two role=radio options", () => {
    const { container } = renderVisibility(ALL_EVERYONE)
    const card = cardFor(container, "skill_studio")
    const group = within(card).getByRole("radiogroup", { name: /audience/i })
    expect(within(group).getByRole("radio", { name: /^everyone$/i })).toBeInTheDocument()
    expect(within(group).getByRole("radio", { name: /operators only/i })).toBeInTheDocument()
  })

  it("aria-checked reflects the enum value (everyone vs operators) — never colour-alone", () => {
    const { container } = renderVisibility(MIXED)

    // model_management is Operators-only → the Operators radio is checked.
    const opCard = cardFor(container, "model_management")
    expect(within(opCard).getByRole("radio", { name: /operators only/i })).toHaveAttribute(
      "aria-checked",
      "true",
    )
    expect(within(opCard).getByRole("radio", { name: /^everyone$/i })).toHaveAttribute(
      "aria-checked",
      "false",
    )

    // skill_studio stays Everyone → the Everyone radio is checked.
    const everyoneCard = cardFor(container, "skill_studio")
    expect(within(everyoneCard).getByRole("radio", { name: /^everyone$/i })).toHaveAttribute(
      "aria-checked",
      "true",
    )
  })

  it("the Operators-only state announces its API-enforced consequence as visible WORDS", () => {
    const { container } = renderVisibility(MIXED)
    const opCard = cardFor(container, "model_management")
    // Not colour-alone: the amber card carries an explicit sentence.
    expect(
      within(opCard).getByText(/their api calls to it are refused server-side, not just hidden/i),
    ).toBeInTheDocument()
  })
})
