/**
 * ExpertSpotlightCard — Phase 260 (PACK-03 / D-260-06 / 260-UI-SPEC §2.3-2.4), REWRITTEN at
 * Phase 262 plan 02 (D-262-06 / RESEARCH R-7, P-7).
 *
 * ⛔ THIS FILE IS A RETIREMENT, NOT A DELETION (the `SEED-177` rule, precedent `D-206-07`).
 *
 * Four of the five cases below replace assertions that pinned HARDCODED demo-Expert content:
 * three verbatim SEC-filing prompt titles, the literal folder name "SEC Filings & Reports", the
 * literal skill name "ratio_calculator", and an emoji chosen by string-matching `slug`/`name`.
 * Those assertions were CORRECT when written. At Phase 260 there was one seeded Expert
 * (migration 188) and no read path for the presentation columns — migration 189 had not landed —
 * so hardcoding was the only way the hero card could render anything at all, and pinning the
 * hardcodes was the only way to prove the card rendered.
 *
 * Migration 189 landed and `ExpertAuthoringStudio` writes `icon` and `prompt_suggestions`. The
 * hardcodes became a lie: any Expert whose name merely contained "financial" inherited the demo
 * Expert's face, its three prompts, its folder name and its skill. Each case below states, in its
 * own body, which assertion it replaces and why that assertion existed — and the fixture keeps the
 * old demo slug ON PURPOSE, so every case doubles as proof that the slug no longer decides
 * anything.
 *
 * The pre-rewrite GREEN was `5 passed`; the post-change RED was `3 failed | 2 passed`, with the
 * three failing case names quoted in `262-02-SUMMARY.md`. The count-gate pin is a FLOOR, not a
 * ceiling: this file lands above it.
 */

import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi } from "vitest"
import { ExpertSpotlightCard } from "../ExpertSpotlightCard"
import type { ExpertBundle } from "@/types"

/**
 * The seeded demo Expert of migration 188, with the presentation columns migration 189 added.
 * ⚠ `slug` and `name` are deliberately the ones the retired string-matches fired on.
 */
const mockFinancialExpert: ExpertBundle = {
  id: "00000000-0000-0000-0000-000000000259",
  name: "Financial Analyzer",
  slug: "financial-analyzer",
  description: "Specialized SEC 10-K & financial statement analysis",
  scope_mode: "restricted",
  member_skills: ["financial_ratio_calculator"],
  required_connections: [],
  knowledge_folder_ids: ["00000000-0000-0000-0000-000000000260"],
  prompt_suggestions: [],
  visibility: "public",
  is_system: true,
  is_enabled: true,
  icon: "scale",
}

describe("ExpertSpotlightCard (Phase 260 / PACK-03 / D-260-06 — retired at 262-02 / D-262-06)", () => {
  it("renders expert name and scope badges without lecturing prose — the acceptance bar Phase 260 set, kept verbatim", () => {
    // UNCHANGED HALF of the original case 1. The operator's Phase 260 mandate was "Less text,
    // more visuals", and these three negative assertions are the only executable statement of
    // it. Nothing in the retirement touches them, so they are carried over untouched.
    const { container } = render(
      <ExpertSpotlightCard
        expert={mockFinancialExpert}
        onSelectPrompt={vi.fn()}
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByText("Financial Analyzer")).toBeInTheDocument()
    expect(screen.getByTestId("expert-scope-tag")).toHaveTextContent("Restricted")

    const cardText = container.textContent || ""
    expect(cardText).not.toContain("retrieval boundary")
    expect(cardText).not.toContain("chat history retention")
    expect(cardText).not.toContain("this consultant will")
  })

  it("THE RETIREMENT — the identity gem comes from the `icon` COLUMN, not from a slug or name match", () => {
    // REPLACES: the original case 1's implicit acceptance of a gem chosen by string-matching
    // `slug === "financial-analyzer"` / `name` containing "financial", which always produced 📊.
    // That existed because the `icon` column had no reader anywhere in chat. It now has exactly
    // one — `@/components/experts/expertIcon` — and this fixture asks for `scale`.
    const { container } = render(
      <ExpertSpotlightCard expert={mockFinancialExpert} onSelectPrompt={vi.fn()} />,
    )

    // The row says `scale`. The name says "Financial". The row wins.
    expect(container.querySelector("svg.lucide-scale")).not.toBeNull()
    expect(container.textContent).not.toContain("📊")
  })

  it("THE RETIREMENT — an Expert with NO icon gets the neutral fallback, even when its name would have matched", () => {
    // REPLACES: nothing — this is the behaviour change stated as a test at the surface that
    // shipped it. The retired guesser returned 📊 for an iconless Expert merely NAMED
    // "Financial …", so a customer's brand-new Expert wore the demo Expert's face.
    const iconless: ExpertBundle = { ...mockFinancialExpert, icon: undefined }
    const { container } = render(
      <ExpertSpotlightCard expert={iconless} onSelectPrompt={vi.fn()} />,
    )

    expect(container.querySelector("svg.lucide-sparkles")).not.toBeNull()
    expect(container.querySelector("svg.lucide-chart-column")).toBeNull()
    expect(container.textContent).not.toContain("📊")
  })

  it("THE RETIREMENT — the badges read the Expert's OWN folder count and OWN first skill, never the seeded Expert's names", () => {
    // REPLACES: `expect(screen.getByText("SEC Filings & Reports")).toBeInTheDocument()` and
    // `expect(screen.getByText("ratio_calculator")).toBeInTheDocument()` (original case 1).
    // Both literals named the SEEDED Expert's folder and skill. They were true for it and a
    // fabrication for every Expert authored since — this card claimed a customer's Expert
    // searched SEC filings and carried a skill it does not have.
    //
    // ⛔ The folder pill stays a COUNT here by design: this is a hero summary, and the folder
    // NAMES are PACK-12's job in the detail modal (plan 04).
    render(<ExpertSpotlightCard expert={mockFinancialExpert} onSelectPrompt={vi.fn()} />)

    expect(screen.getByText("1 Folder")).toBeInTheDocument()
    expect(screen.getByText("financial_ratio_calculator")).toBeInTheDocument()

    expect(screen.queryByText("SEC Filings & Reports")).toBeNull()
    expect(screen.queryByText("ratio_calculator")).toBeNull()
  })

  it("THE RETIREMENT — two folders read \"2 Folders\" and a skill-less Expert shows NO skill chip", () => {
    // ⚠ CORRECTED (262-UAT R.3): this case used to assert `getByText("domain_tools")` — it
    // PINNED an invented skill name as correct behaviour. Driven live, an Expert with no skills
    // showed a `domain_tools` chip while the detail modal and the admin tab said 0 skills.
    const twoFolders: ExpertBundle = {
      ...mockFinancialExpert,
      knowledge_folder_ids: ["a", "b"],
      member_skills: [],
    }
    render(<ExpertSpotlightCard expert={twoFolders} onSelectPrompt={vi.fn()} />)

    expect(screen.getByText("2 Folders")).toBeInTheDocument()
    expect(screen.queryByText("domain_tools")).toBeNull()
    expect(screen.queryByTestId("expert-spotlight-skill-chip")).toBeNull()
  })

  it("262-UAT R.3 — an Expert with ZERO folders and ZERO skills states neither, and never '1 Folders'", () => {
    // Driven live: `knowledge_folder_ids?.length || 1` turned 0 into "1 Folders".
    const bare: ExpertBundle = {
      ...mockFinancialExpert,
      knowledge_folder_ids: [],
      member_skills: [],
    }
    render(<ExpertSpotlightCard expert={bare} onSelectPrompt={vi.fn()} />)

    expect(screen.queryByText(/\d+ Folders?/)).toBeNull()
    expect(screen.queryByTestId("expert-spotlight-folder-chip")).toBeNull()
    expect(screen.queryByTestId("expert-spotlight-skill-chip")).toBeNull()
  })

  it("THE RETIREMENT — an Expert that authored no prompts gets ONE honest tile, not three invented ones", () => {
    // REPLACES the whole of original case 2, which asserted all three default tile titles and
    // prompts VERBATIM against this very fixture (`prompt_suggestions: []`). That case existed
    // to prove the hero grid rendered three tiles at all, and it was the only executable
    // description of the demo content. Those three prompts were SEC-filing questions the
    // Expert never authored — shown to every Expert the name-match caught.
    //
    // One true tile beats three invented ones: the honest state is the "Explore Scope" tile
    // this component already rendered for every other Expert, derived from the Expert's name.
    render(<ExpertSpotlightCard expert={mockFinancialExpert} onSelectPrompt={vi.fn()} />)

    const tile0 = screen.getByTestId("action-tile-0")
    expect(tile0).toHaveTextContent("Explore Scope")
    expect(tile0).toHaveTextContent(
      "What documents and analysis are available under Financial Analyzer?",
    )

    // The invented grid is gone — there is no second or third tile to find.
    expect(screen.queryByTestId("action-tile-1")).toBeNull()
    expect(screen.queryByTestId("action-tile-2")).toBeNull()
    expect(screen.queryByText("Q3 Revenue Growth YoY")).toBeNull()
    expect(screen.queryByText("Gross Margin Comparison")).toBeNull()
    expect(screen.queryByText("Operating Cash Flow")).toBeNull()
  })

  it("renders custom prompt suggestions when provided by expert bundle — the shipped GOOD path, unchanged", () => {
    // UNCHANGED (original case 5). This arm always read the row and was always honest; the
    // retirement must not disturb it, which is precisely why it is carried over as written.
    const customExpert: ExpertBundle = {
      ...mockFinancialExpert,
      prompt_suggestions: [
        { title: "Custom Metric 1", prompt: "Explain the variance in operating expenses" },
        { title: "Custom Metric 2", prompt: "Summarize debt maturity schedule" },
      ],
    }

    const onSelectPrompt = vi.fn()
    render(
      <ExpertSpotlightCard
        expert={customExpert}
        onSelectPrompt={onSelectPrompt}
        onDismiss={vi.fn()}
      />,
    )

    expect(screen.getByText("Custom Metric 1")).toBeInTheDocument()
    expect(screen.getByText("Explain the variance in operating expenses")).toBeInTheDocument()
    expect(screen.getByText("Custom Metric 2")).toBeInTheDocument()

    fireEvent.click(screen.getByTestId("action-tile-0"))
    expect(onSelectPrompt).toHaveBeenCalledWith("Explain the variance in operating expenses")
  })

  it("triggers onSelectPrompt with 1-click execution when an Action Tile is clicked", () => {
    // REPLACES original case 3, which clicked tiles 0 and 1 and asserted two of the invented
    // SEC prompts came back. The BEHAVIOUR it pinned — one click, one prompt, exactly once —
    // is unchanged and is the point of PACK-03; only the content it fired with was a
    // fabrication. Driven here against the Expert's OWN authored prompts.
    const onSelectPrompt = vi.fn()
    const authored: ExpertBundle = {
      ...mockFinancialExpert,
      prompt_suggestions: [
        { title: "Own Prompt A", prompt: "Summarise this quarter against the last four" },
        { title: "Own Prompt B", prompt: "List the risks flagged more than once" },
      ],
    }
    render(<ExpertSpotlightCard expert={authored} onSelectPrompt={onSelectPrompt} />)

    fireEvent.click(screen.getByTestId("action-tile-0"))
    expect(onSelectPrompt).toHaveBeenCalledTimes(1)
    expect(onSelectPrompt).toHaveBeenCalledWith("Summarise this quarter against the last four")

    fireEvent.click(screen.getByTestId("action-tile-1"))
    expect(onSelectPrompt).toHaveBeenCalledWith("List the risks flagged more than once")
  })

  it("triggers onDismiss when close button is clicked", () => {
    // UNCHANGED (original case 4). Dismissal never touched the hardcodes.
    const onDismiss = vi.fn()
    render(
      <ExpertSpotlightCard
        expert={mockFinancialExpert}
        onSelectPrompt={vi.fn()}
        onDismiss={onDismiss}
      />,
    )

    const dismissBtn = screen.getByRole("button", { name: /dismiss financial analyzer/i })
    fireEvent.click(dismissBtn)

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
