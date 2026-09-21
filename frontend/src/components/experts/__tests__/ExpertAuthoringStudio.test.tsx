import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ExpertAuthoringStudio } from "../ExpertAuthoringStudio"
import type { ExpertDraftOutput, SuggestedNewSkill } from "@/lib/api/experts"
import type { Skill } from "@/types"

// Phase 263-04: the studio now mounts `SkillFormDialog`, which imports `@/lib/api`
// (the barrel) and therefore `@/lib/supabase`. Mocked here rather than left to the
// environment — the shape is copied from `SkillFormDialog.test.tsx:19-30`.
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

// ⛔ SHAPE B (`importActual` spread), converted from the CLOSED literal factories this
// file used before 263-04. The closed shape is the Phase-196 `failed 249` landmine: a
// literal return REPLACES the whole module, so (a) any export the studio newly imports
// is `undefined` at mount and (b) `lib/api.ts` re-exports names BY NAME from these two
// modules, so the barrel itself fails to load. Both were live the moment this suite
// mounted the dialog. Shape B passes unmocked exports through — including the REAL
// `ExpertMemberSkillsUnknownError` / `SkillBodyDisabledError` classes, which matters
// because the studio branches on `instanceof`.
vi.mock("@/lib/api/experts", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/experts")>("@/lib/api/experts")
  return {
    ...actual,
    createExpert: vi.fn(),
    updateExpert: vi.fn(),
    draftExpert: vi.fn(),
    getExpertGrants: vi.fn().mockResolvedValue([]),
    addExpertGrant: vi.fn(),
    removeExpertGrant: vi.fn(),
    draftSkillBody: vi.fn(),
  }
})

vi.mock("@/lib/api/documents", () => ({
  listFolders: vi.fn().mockResolvedValue([
    { id: "f1", name: "SEC Filings" },
    { id: "f2", name: "Internal Financials" },
  ]),
}))

vi.mock("@/lib/api/skills", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/skills")>("@/lib/api/skills")
  return {
    ...actual,
    listSkills: vi.fn().mockResolvedValue([
      { name: "ratio_calculator", description: "Calculates EBITDA" },
    ]),
    createSkill: vi.fn(),
  }
})

vi.mock("@/lib/api/connectors", () => ({
  listConnectorConnections: vi.fn().mockResolvedValue([
    { id: "c1", name: "Quickbooks" },
  ]),
}))

import {
  createExpert,
  updateExpert,
  draftExpert,
  draftSkillBody,
  ExpertMemberSkillsUnknownError,
  SkillBodyDisabledError,
} from "@/lib/api/experts"
import { listSkills, createSkill } from "@/lib/api/skills"

describe("ExpertAuthoringStudio (Phase 261 / PACK-07 / PACK-09 / PACK-10)", () => {
  const onClose = vi.fn()
  const onSaved = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders authoring studio form, non-ingestion badge, and live reactive preview", async () => {
    render(<ExpertAuthoringStudio onClose={onClose} onSaved={onSaved} />)

    // Header
    await waitFor(() => {
      expect(screen.getByText("Author New Domain Expert")).toBeInTheDocument()
    })

    // Non-ingestion guarantee badge (PACK-09)
    expect(screen.getByText(/Ephemeral In-Memory Guarantee/i)).toBeInTheDocument()
    expect(screen.getByText("NEVER")).toBeInTheDocument()
    expect(screen.getByText(/ingested into your permanent library/i)).toBeInTheDocument()

    // Live reactive preview title (defaults to Untitled Expert)
    expect(screen.getByText("Untitled Expert")).toBeInTheDocument()
    expect(screen.getByText("Live Reactive Card Preview (G-2)")).toBeInTheDocument()

    // Action tiles preview default
    expect(screen.getByText("Review Report")).toBeInTheDocument()
  })

  it("updates live preview synchronously when typing name, category, and scope mode", async () => {
    render(<ExpertAuthoringStudio onClose={onClose} onSaved={onSaved} />)

    await waitFor(() => {
      expect(screen.getByText("Author New Domain Expert")).toBeInTheDocument()
    })

    // 1. Change name
    const nameInput = screen.getByPlaceholderText(/e\.g\. financial analyzer/i)
    fireEvent.change(nameInput, { target: { value: "Legal Eagle" } })

    // Name should appear in the form AND live preview simultaneously
    const titles = screen.getAllByText("Legal Eagle")
    expect(titles.length).toBeGreaterThanOrEqual(1)

    // Slug should auto-generate
    expect(screen.getByDisplayValue("legal-eagle")).toBeInTheDocument()

    // 2. Change scope mode to strict isolation
    const strictRadio = screen.getByLabelText(/strict isolation/i)
    fireEvent.click(strictRadio)

    // Preview badge updates to Strict Isolation
    const strictBadges = screen.getAllByText(/strict isolation/i)
    expect(strictBadges.length).toBeGreaterThanOrEqual(1)
  })

  it("calls draftExpert and populates form from synthesized candidate draft (PACK-09)", async () => {
    const mockDraft: ExpertDraftOutput = {
      name: "Tax Strategy Consultant",
      slug: "tax-strategy",
      description: "Advises on corporate tax strategy and deductions",
      icon: "scale",
      category: "Finance",
      when_to_use: "When structuring corporate transactions for tax efficiency",
      example_output: "Tax benefit: $1.2M",
      scope_mode: "biased",
      member_skills: ["ratio_calculator"],
      required_connections: ["Quickbooks"],
      knowledge_folder_ids: ["f1"],
      prompt_suggestions: [
        { title: "Tax Exposure", prompt: "Identify tax exposures" },
      ],
      tool_floor_enabled: true,
      // Phase 263 (263-02): REQUIRED on ExpertDraftOutput now, and may be empty. ⚠ A mock
      // omitting it does NOT surface as a ValidationError on the server path — the drafter
      // builds ExpertDraftOutput(**emitted) inside a try whose except falls to the fallback,
      // so what goes red is an unrelated *name* assertion. Here it is a plain TS2741.
      suggested_new_skills: [],
    }
    vi.mocked(draftExpert).mockResolvedValue(mockDraft)

    render(<ExpertAuthoringStudio onClose={onClose} onSaved={onSaved} />)

    const promptTextarea = screen.getByPlaceholderText(/senior financial analyst focused on/i)
    fireEvent.change(promptTextarea, { target: { value: "Need a tax consultant" } })

    const draftBtn = screen.getByRole("button", { name: /generate candidate draft/i })
    fireEvent.click(draftBtn)

    await waitFor(() => {
      expect(draftExpert).toHaveBeenCalledWith("Need a tax consultant", [])
    })

    // Form fields populated
    await waitFor(() => {
      expect(screen.getByDisplayValue("Tax Strategy Consultant")).toBeInTheDocument()
      expect(screen.getByDisplayValue("tax-strategy")).toBeInTheDocument()
      expect(screen.getByDisplayValue("When structuring corporate transactions for tax efficiency")).toBeInTheDocument()
      expect(screen.getByDisplayValue("Tax benefit: $1.2M")).toBeInTheDocument()
    })

    // Live preview updated
    expect(screen.getByText("Tax Strategy Consultant")).toBeInTheDocument()
    expect(screen.getByText("Tax Exposure")).toBeInTheDocument()
    expect(screen.getAllByText(/Tax benefit: \$1\.2M/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/⚡ ratio_calculator/)).toBeInTheDocument()
  })

  it("saves new expert and dispatches createExpert on submit (PACK-07)", async () => {
    vi.mocked(createExpert).mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000099",
      name: "Risk Officer",
      slug: "risk-officer",
      description: "Risk assessment",
      icon: "shield",
      category: "Operations",
      when_to_use: "Risk questions",
      scope_mode: "biased",
      tool_floor_enabled: true,
      member_skills: [],
      required_connections: [],
      knowledge_folder_ids: [],
      prompt_suggestions: [{ title: "Assess Risk", prompt: "Risk prompt" }],
      visibility: "org",
      is_system: false,
      is_enabled: true,
    })

    render(<ExpertAuthoringStudio onClose={onClose} onSaved={onSaved} />)

    await waitFor(() => {
      expect(screen.getByText("Author New Domain Expert")).toBeInTheDocument()
    })

    const nameInput = screen.getByPlaceholderText(/e\.g\. financial analyzer/i)
    fireEvent.change(nameInput, { target: { value: "Risk Officer" } })

    const submitBtn = screen.getByRole("button", { name: /save & publish expert/i })
    fireEvent.click(submitBtn)

    await waitFor(() => {
      expect(createExpert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Risk Officer",
          slug: "risk-officer",
          scope_mode: "biased",
          tool_floor_enabled: true,
        }),
      )
      expect(onSaved).toHaveBeenCalled()
      expect(onClose).toHaveBeenCalled()
    })
  })
})

/**
 * Phase 263-04 Task 2 (PACK-14 / PACK-15 / PACK-16) — sketch 263 variant A.
 *
 * The shipped `Bound Knowledge & Capabilities` card splits into two headed groups, a
 * proposal becomes real one human approval at a time through the dialog that already
 * exists, and Save is held while the blueprint claims something the library does not have.
 *
 * ⭐ Where the WORDS are the deliverable these cases assert the RENDERED CONTENT, never
 * block presence by `data-testid` alone — Phase 235 shipped a defect behind a fence that
 * asserted presence while the content drifted.
 */
const PROPOSALS: SuggestedNewSkill[] = [
  {
    name: "systematic-search-strategy",
    description: "Design and document a reproducible multi-database search.",
    why_needed: "The library has no protocol-driven search skill.",
  },
  {
    name: "prisma-screening",
    description: "Screen titles and abstracts against PRISMA inclusion criteria.",
    why_needed: "Nothing in the library screens studies against a protocol.",
  },
]

function mkDraft(overrides: Partial<ExpertDraftOutput> = {}): ExpertDraftOutput {
  return {
    name: "PhD Literature Review Expert",
    slug: "phd-literature-review-expert",
    description: "Runs protocol-driven doctoral literature reviews.",
    icon: "book",
    category: "General",
    when_to_use: "When a systematic review must follow PRISMA.",
    example_output: "A PRISMA flow diagram plus a synthesis matrix.",
    scope_mode: "biased",
    member_skills: [],
    required_connections: [],
    knowledge_folder_ids: [],
    prompt_suggestions: [{ title: "Screen studies", prompt: "Screen these abstracts" }],
    tool_floor_enabled: true,
    suggested_new_skills: PROPOSALS,
    ...overrides,
  }
}

function mkCreatedSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-new-1",
    user_id: "user-1",
    name: "prisma-screening",
    description: "Screen titles and abstracts against PRISMA inclusion criteria.",
    instructions: "1. Read the protocol.",
    is_enabled: true,
    is_org_shared: false,
    is_system: false,
    created_at: "2026-09-21T00:00:00Z",
    updated_at: "2026-09-21T00:00:00Z",
    lint_warnings: [],
    ...overrides,
  }
}

const saveButton = () => screen.getByRole("button", { name: /save & publish expert/i })
const proposalCards = () => screen.queryAllByTestId("proposed-skill-card")

afterEach(() => cleanup())

describe("ExpertAuthoringStudio — proposed capabilities (263-04 / sketch 263-A)", () => {
  const onClose = vi.fn()
  const onSaved = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listSkills).mockResolvedValue([
      { name: "ratio_calculator", description: "Calculates EBITDA" },
    ] as never)
  })

  async function renderAndDraft(draft: ExpertDraftOutput = mkDraft()) {
    vi.mocked(draftExpert).mockResolvedValue(draft)
    render(<ExpertAuthoringStudio onClose={onClose} onSaved={onSaved} />)
    fireEvent.change(screen.getByPlaceholderText(/senior financial analyst focused on/i), {
      target: { value: "A doctoral literature review expert" },
    })
    fireEvent.click(screen.getByRole("button", { name: /generate candidate draft/i }))
    await waitFor(() =>
      expect(proposalCards()).toHaveLength(draft.suggested_new_skills.length),
    )
  }

  it("names every domain skill the draft needs and the library does not have, with its description", async () => {
    await renderAndDraft()

    expect(screen.getByText(/Proposed for this Expert/i)).toBeInTheDocument()
    // ⭐ CONTENT, not presence: the name AND the one-line description are the deliverable.
    for (const p of PROPOSALS) {
      expect(screen.getByText(p.name)).toBeInTheDocument()
      expect(screen.getByText(p.description)).toBeInTheDocument()
    }
    expect(screen.getByText(/⬡ = does not exist/)).toBeInTheDocument()
    expect(
      screen.getByText(/2 named by the draft, none in your library yet/i),
    ).toBeInTheDocument()
  })

  it("renders a proposal as an opportunity — dashed violet tokens, and NEVER the destructive ones", async () => {
    await renderAndDraft()
    const card = proposalCards()[0]

    for (const token of ["border-dashed", "border-primary/40", "bg-primary/[0.06]", "text-primary"]) {
      expect(card.className).toContain(token)
    }
    // D-263-01: a proposal is an opportunity, not a failure.
    for (const token of ["bg-gradient-to-br", "border-destructive", "text-destructive"]) {
      expect(card.className).not.toContain(token)
    }
  })

  it("keeps the solid ⚡ library rail beside it, under its own In your library heading", async () => {
    await renderAndDraft(mkDraft({ member_skills: ["ratio_calculator"] }))

    expect(screen.getByText(/In your library/i)).toBeInTheDocument()
    expect(screen.getByText(/⚡ ratio_calculator/)).toBeInTheDocument()
  })

  it("holds Save while a proposal is open and names the count in a violet, non-destructive banner", async () => {
    await renderAndDraft()

    expect(saveButton()).toBeDisabled()
    const banner = screen.getByTestId("unresolved-capabilities-banner")
    expect(banner).toHaveTextContent(/2 capabilities are not real yet/i)
    expect(banner).toHaveTextContent(/stripped at run time/i)
    expect(banner.className).toContain("text-primary")
    expect(banner.className).not.toContain("text-destructive")
  })

  it("holds Save for a phantom name typed into the quick-add box, with ZERO proposals open", async () => {
    render(<ExpertAuthoringStudio onClose={onClose} onSaved={onSaved} />)
    await waitFor(() => expect(screen.getByText("ratio_calculator")).toBeInTheDocument())
    expect(proposalCards()).toHaveLength(0)
    expect(saveButton()).toBeEnabled()

    fireEvent.change(screen.getByPlaceholderText(/type a capability tag/i), {
      target: { value: "thesis-structuring" },
    })
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }))

    // ⛔ `handleAddCustomSkill` pushes ANY free-text string into memberSkills with no
    // library check — a fence watching only the draft path would leave this open.
    await waitFor(() => expect(saveButton()).toBeDisabled())
    expect(screen.getByTestId("unresolved-capabilities-banner")).toHaveTextContent(
      /1 capability is not real yet/i,
    )
  })

  it("enables Save when every named capability exists and no proposal is open", async () => {
    render(<ExpertAuthoringStudio onClose={onClose} onSaved={onSaved} />)
    const pick = await screen.findByRole("button", { name: "ratio_calculator" })
    fireEvent.click(pick)

    await waitFor(() => expect(screen.getByText(/⚡ ratio_calculator/)).toBeInTheDocument())
    expect(saveButton()).toBeEnabled()
    expect(screen.getByTestId("unresolved-capabilities-banner")).toHaveTextContent(
      /Every capability in this blueprint exists/i,
    )
  })

  it("drafts the body IN PLACE on the card, opens the pre-filled dialog, and creates through the existing POST /skills", async () => {
    await renderAndDraft()

    let release: (v: { instructions: string; summary: string }) => void = () => {}
    vi.mocked(draftSkillBody).mockReturnValue(
      new Promise((resolve) => {
        release = resolve
      }),
    )
    vi.mocked(createSkill).mockResolvedValue(mkCreatedSkill())

    const card = screen.getByText("prisma-screening").closest("[data-testid='proposed-skill-card']")!
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: /create this skill/i }))

    // ⛔ The busy state is IN PLACE on the card — no empty dialog appears first.
    await waitFor(() => expect(screen.getByText(/Drafting instructions/i)).toBeInTheDocument())
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    expect(draftSkillBody).toHaveBeenCalledTimes(1)
    expect(draftSkillBody).toHaveBeenCalledWith({
      skill_name: "prisma-screening",
      skill_description: PROPOSALS[1].description,
      why_needed: PROPOSALS[1].why_needed,
      expert_name: "PhD Literature Review Expert",
      expert_description: "Runs protocol-driven doctoral literature reviews.",
    })

    release({ instructions: "1. Apply the inclusion criteria.\n2. Record exclusions.", summary: "PRISMA screening" })

    const dialog = await screen.findByRole("dialog")
    await waitFor(() =>
      expect(within(dialog).getByPlaceholderText(/step-by-step instructions/i)).toHaveValue(
        "1. Apply the inclusion criteria.\n2. Record exclusions.",
      ),
    )
    expect(within(dialog).getByLabelText("Name")).toHaveValue("prisma-screening")

    fireEvent.click(within(dialog).getByRole("button", { name: /save skill/i }))

    await waitFor(() => expect(createSkill).toHaveBeenCalledTimes(1))
    expect(vi.mocked(createSkill).mock.calls[0][0]).toMatchObject({
      name: "prisma-screening",
      instructions: "1. Apply the inclusion criteria.\n2. Record exclusions.",
    })

    // The name moves OUT of the proposal group and INTO the ⚡ library rail.
    await waitFor(() => expect(screen.getByText(/⚡ prisma-screening/)).toBeInTheDocument())
    expect(proposalCards()).toHaveLength(1)
    expect(
      proposalCards().some((c) => c.textContent?.includes("prisma-screening")),
    ).toBe(false)
  })

  it("still opens the dialog with EMPTY instructions when drafting is switched off — manual creation is never blocked", async () => {
    await renderAndDraft()
    vi.mocked(draftSkillBody).mockRejectedValue(new SkillBodyDisabledError())

    const card = screen.getByText("prisma-screening").closest("[data-testid='proposed-skill-card']")!
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: /create this skill/i }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByLabelText("Name")).toHaveValue("prisma-screening")
    // ⛔ Never a fabricated body — the field is EMPTY and the reason is stated.
    expect(within(dialog).getByPlaceholderText(/step-by-step instructions/i)).toHaveValue("")
    expect(screen.getByTestId("skill-body-disabled-note")).toHaveTextContent(
      /drafting of skill instructions is turned off/i,
    )
  })

  it("Remove drops a proposal without creating anything", async () => {
    await renderAndDraft()

    const card = screen.getByText("prisma-screening").closest("[data-testid='proposed-skill-card']")!
    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: /^remove$/i }))

    await waitFor(() => expect(proposalCards()).toHaveLength(1))
    expect(createSkill).not.toHaveBeenCalled()
    expect(draftSkillBody).not.toHaveBeenCalled()
  })

  it("renders the SERVER's unknown_skills when a save is refused, not a re-derived list", async () => {
    render(<ExpertAuthoringStudio onClose={onClose} onSaved={onSaved} />)
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. financial analyzer/i), {
      target: { value: "Stale Client Expert" },
    })
    const pick = await screen.findByRole("button", { name: "ratio_calculator" })
    fireEvent.click(pick)
    await waitFor(() => expect(saveButton()).toBeEnabled())

    // D-263-10: a stale client walks past its own advisory fence; the SERVER refuses.
    vi.mocked(createExpert).mockRejectedValue(
      new ExpertMemberSkillsUnknownError(["prisma-screening", "thematic-synthesis"]),
    )
    fireEvent.click(saveButton())

    const banner = await screen.findByTestId("server-refusal-banner")
    expect(banner).toHaveTextContent("prisma-screening")
    expect(banner).toHaveTextContent("thematic-synthesis")
    expect(banner.className).toContain("destructive")
  })
})
