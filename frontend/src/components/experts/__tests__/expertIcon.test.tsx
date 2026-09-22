/**
 * Phase 262 plan 02 task 1 (D-262-06 / RESEARCH R-3, R-7) — the ONE home of expert-icon
 * resolution.
 *
 * Before this file there were THREE deciders of what glyph an Expert wears:
 *   · `OrgExpertsTab.tsx:30-46`   — `ICON_MAP` + `renderExpertIcon`, reading the `icon` COLUMN
 *   · `InviteExpertDialog.tsx:27-37` — `getExpertIcon`, guessing from `slug`/`name`
 *   · `ExpertSpotlightCard.tsx:70-81` — the SAME guessing function, duplicated VERBATIM
 *
 * Only the first read the value the author actually filled in. This suite pins the surviving
 * home: it resolves through a CLOSED map keyed by the `icon` column, and it cannot see a name.
 */

import { render } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { BarChart3, Scale, Sparkles } from "lucide-react"

import { EXPERT_ICON_MAP, ExpertIcon } from "../expertIcon"

/** Render a lucide component directly, for an exact-markup comparison. */
function markupOf(node: React.ReactElement): string {
  return render(node).container.innerHTML
}

describe("expertIcon — the one home of expert-icon resolution (Phase 262 / D-262-06)", () => {
  it("(1) `icon=\"scale\"` renders the Scale glyph, byte-identical to rendering Scale directly", () => {
    expect(markupOf(<ExpertIcon icon="scale" />)).toBe(markupOf(<Scale className="h-5 w-5" />))
    // …and it is NOT merely the fallback in disguise.
    expect(markupOf(<ExpertIcon icon="scale" />)).not.toBe(markupOf(<Sparkles className="h-5 w-5" />))
  })

  it("(2) `icon=\"chart\"` renders BarChart3 — the key OrgExpertsTab shipped for the one seeded Expert", () => {
    expect(markupOf(<ExpertIcon icon="chart" />)).toBe(markupOf(<BarChart3 className="h-5 w-5" />))
  })

  it("(3) an icon key absent from the closed map falls back to Sparkles — it never renders author-controlled markup (T-262-05)", () => {
    // The `icon` column is author-controlled free text. Resolution is a LOOKUP, never
    // `React.createElement(userString)` and never an `<img src>`: an unknown key is a
    // fallback, not an injection point.
    expect(markupOf(<ExpertIcon icon="definitely-not-a-key" />)).toBe(
      markupOf(<Sparkles className="h-5 w-5" />),
    )
    expect(markupOf(<ExpertIcon icon="<script>alert(1)</script>" />)).toBe(
      markupOf(<Sparkles className="h-5 w-5" />),
    )
  })

  it("(4) THE BEHAVIOUR CHANGE — an Expert named \"Financial Whatever\" with NO icon gets the neutral fallback, not a name-derived guess", () => {
    // The retired `getExpertIcon` returned 📊 for ANY expert whose slug was
    // "financial-analyzer" or whose name merely CONTAINED "financial" — so a brand-new
    // Expert called "Financial Whatever", authored by someone who never chose an icon,
    // wore the seeded demo Expert's glyph. The extra `name`/`slug` keys below are passed
    // DELIBERATELY: they are exactly what the retired function matched on, and the new
    // home must ignore them.
    const namedButIconless = { name: "Financial Whatever", slug: "financial-analyzer" } as {
      icon?: string
    }
    expect(markupOf(<ExpertIcon {...namedButIconless} />)).toBe(
      markupOf(<Sparkles className="h-5 w-5" />),
    )
    expect(markupOf(<ExpertIcon {...namedButIconless} />)).not.toBe(
      markupOf(<BarChart3 className="h-5 w-5" />),
    )
  })

  it("(5) the eleven keys `OrgExpertsTab.tsx:30-46` shipped survived the move — a silent drop is visible here", () => {
    // The move out of OrgExpertsTab is a MOVE. Pinning the key SET (not a count) means
    // dropping one, or renaming one, reds this case rather than silently degrading an
    // Expert whose author picked that key to the Sparkles fallback.
    expect(Object.keys(EXPERT_ICON_MAP).sort()).toEqual(
      [
        "book",
        "briefcase",
        "chart",
        "cpu",
        "database",
        "file-text",
        "scale",
        "shield",
        "sparkles",
        "terminal",
        "truck",
      ].sort(),
    )
  })

  it("(6) `className` defaults to the shipped `h-5 w-5` and an explicit value overrides it", () => {
    // `renderExpertIcon(iconName?, className = "h-5 w-5")` carried this default; the
    // spotlight/dialog gems size their own glyph, so the override has to work.
    const { container } = render(<ExpertIcon icon="scale" />)
    expect(container.querySelector("svg")?.getAttribute("class")).toContain("h-5 w-5")

    const sized = render(<ExpertIcon icon="scale" className="h-3 w-3 text-violet-400" />)
    expect(sized.container.querySelector("svg")?.getAttribute("class")).toContain("h-3 w-3")
  })
})
