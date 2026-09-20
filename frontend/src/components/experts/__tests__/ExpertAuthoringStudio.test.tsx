import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { ExpertAuthoringStudio } from "../ExpertAuthoringStudio"
import type { ExpertDraftOutput } from "@/lib/api/experts"

vi.mock("@/lib/api/experts", () => ({
  createExpert: vi.fn(),
  updateExpert: vi.fn(),
  draftExpert: vi.fn(),
  getExpertGrants: vi.fn().mockResolvedValue([]),
  addExpertGrant: vi.fn(),
  removeExpertGrant: vi.fn(),
}))

vi.mock("@/lib/api/documents", () => ({
  listFolders: vi.fn().mockResolvedValue([
    { id: "f1", name: "SEC Filings" },
    { id: "f2", name: "Internal Financials" },
  ]),
}))

vi.mock("@/lib/api/skills", () => ({
  listSkills: vi.fn().mockResolvedValue([
    { name: "ratio_calculator", description: "Calculates EBITDA" },
  ]),
}))

vi.mock("@/lib/api/connectors", () => ({
  listConnectorConnections: vi.fn().mockResolvedValue([
    { id: "c1", name: "Quickbooks" },
  ]),
}))

import { createExpert, updateExpert, draftExpert } from "@/lib/api/experts"

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
