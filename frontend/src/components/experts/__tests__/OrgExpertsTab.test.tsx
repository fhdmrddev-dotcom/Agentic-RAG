import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { OrgExpertsTab } from "../../org/OrgExpertsTab"
import type { ExpertBundle } from "@/types"

const mockExperts: ExpertBundle[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Financial Analyzer",
    slug: "financial-analyzer",
    description: "Financial modeling & 10-K analysis",
    icon: "chart",
    category: "Finance",
    when_to_use: "When reviewing 10-K filings and variance models",
    scope_mode: "biased",
    tool_floor_enabled: true,
    member_skills: ["ratio_calculator"],
    required_connections: ["slack"],
    knowledge_folder_ids: ["f1", "f2"],
    prompt_suggestions: [{ title: "YoY Growth", prompt: "Compute YoY" }],
    visibility: "org",
    is_system: true,
    is_enabled: true,
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "HR Compliance Advisor",
    slug: "hr-compliance",
    description: "Confidential employee handbook advisor",
    icon: "shield",
    category: "Human Resources",
    when_to_use: "For employee leave questions and compliance",
    scope_mode: "restricted",
    tool_floor_enabled: true,
    member_skills: [],
    required_connections: [],
    knowledge_folder_ids: ["f3"],
    prompt_suggestions: [{ title: "Leave Policy", prompt: "Summarize leave" }],
    visibility: "granted",
    is_system: false,
    is_enabled: true,
  },
]

// Phase 263-04: this tab mounts `ExpertAuthoringStudio`, which now mounts
// `SkillFormDialog`, which imports the `@/lib/api` barrel and therefore `@/lib/supabase`.
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

// ⛔ SHAPE B, converted from CLOSED literal factories in 263-04. This suite does not
// render the studio directly and reds anyway the moment it mounts anything importing a
// symbol the literal omits — the Phase-196 `failed 249` shape. `lib/api.ts` also
// re-exports names BY NAME from both modules, so a literal breaks the barrel itself.
vi.mock("@/lib/api/experts", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/experts")>("@/lib/api/experts")
  return {
    ...actual,
    listExperts: vi.fn(),
    deleteExpert: vi.fn(),
    getExpertGrants: vi.fn().mockResolvedValue([]),
    createExpert: vi.fn(),
    updateExpert: vi.fn(),
    draftExpert: vi.fn(),
    addExpertGrant: vi.fn(),
    removeExpertGrant: vi.fn(),
    draftSkillBody: vi.fn(),
  }
})

vi.mock("@/lib/api/documents", () => ({
  listFolders: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/lib/api/skills", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/skills")>("@/lib/api/skills")
  return {
    ...actual,
    listSkills: vi.fn().mockResolvedValue([]),
    createSkill: vi.fn(),
  }
})

vi.mock("@/lib/api/connectors", () => ({
  listConnectorConnections: vi.fn().mockResolvedValue([]),
}))

import { listExperts, deleteExpert } from "@/lib/api/experts"

describe("OrgExpertsTab (Phase 261 / PACK-07)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listExperts).mockResolvedValue(mockExperts)
  })

  it("renders expert list with names, category, scope mode and grant badges", async () => {
    render(<OrgExpertsTab />)

    await waitFor(() => {
      expect(screen.getByText("Financial Analyzer")).toBeInTheDocument()
      expect(screen.getByText("HR Compliance Advisor")).toBeInTheDocument()
    })

    // Scope mode badges
    expect(screen.getByText("+ Union Scope")).toBeInTheDocument()
    expect(screen.getByText("Strict Isolation")).toBeInTheDocument()

    // Grant badges
    expect(screen.getByText("Org-Wide")).toBeInTheDocument()
    expect(screen.getByText("Granted")).toBeInTheDocument()

    // Subtitle / When-to-use
    expect(
      screen.getByText(/When reviewing 10-K filings and variance models/i),
    ).toBeInTheDocument()
  })

  it("filters experts by search query", async () => {
    render(<OrgExpertsTab />)

    await waitFor(() => {
      expect(screen.getByText("Financial Analyzer")).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText(/search experts/i)
    fireEvent.change(searchInput, { target: { value: "compliance" } })

    expect(screen.queryByText("Financial Analyzer")).not.toBeInTheDocument()
    expect(screen.getByText("HR Compliance Advisor")).toBeInTheDocument()
  })

  it("opens authoring studio on '+ Author New Expert' button click", async () => {
    render(<OrgExpertsTab />)

    await waitFor(() => {
      expect(screen.getByText("Financial Analyzer")).toBeInTheDocument()
    })

    const authorBtn = screen.getByRole("button", { name: /author new expert/i })
    fireEvent.click(authorBtn)

    await waitFor(() => {
      expect(screen.getByText("Author New Domain Expert")).toBeInTheDocument()
      expect(screen.getByText("Back to Experts")).toBeInTheDocument()
    })
  })

  it("opens authoring studio in edit mode when clicking 'Edit'", async () => {
    render(<OrgExpertsTab />)

    await waitFor(() => {
      expect(screen.getByText("HR Compliance Advisor")).toBeInTheDocument()
    })

    const editButtons = screen.getAllByRole("button", { name: /edit/i })
    fireEvent.click(editButtons[1]) // HR Compliance Advisor

    await waitFor(() => {
      expect(
        screen.getByText("Edit Expert: HR Compliance Advisor"),
      ).toBeInTheDocument()
      expect(screen.getByDisplayValue("HR Compliance Advisor")).toBeInTheDocument()
    })
  })

  it("prompts confirmation and deletes an expert bundle", async () => {
    vi.mocked(deleteExpert).mockResolvedValue({ deleted: true, id: "00000000-0000-0000-0000-000000000002" })

    render(<OrgExpertsTab />)

    await waitFor(() => {
      expect(screen.getByText("HR Compliance Advisor")).toBeInTheDocument()
    })

    // System templates have no delete button, so there is exactly 1 delete button for tenant expert
    const deleteBtn = screen.getByRole("button", { name: "" })
    fireEvent.click(deleteBtn)

    expect(screen.getByText("Delete Expert Bundle?")).toBeInTheDocument()

    const confirmBtn = screen.getByRole("button", { name: "Delete Expert" })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(deleteExpert).toHaveBeenCalledWith("00000000-0000-0000-0000-000000000002")
    })
  })
})
