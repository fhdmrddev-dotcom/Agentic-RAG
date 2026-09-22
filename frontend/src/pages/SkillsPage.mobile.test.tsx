/**
 * 262-UAT follow-up (operator, 2026-09-23) — the Skills page at phone width.
 *
 * Driven at 500px: the list got 154px while an EMPTY 340px detail rail ("Select a skill to
 * view details") took the rest. Below `md` the page is now one pane at a time: the list, or
 * the selected skill's details with a way back. jsdom cannot evaluate media queries, so the
 * layout itself is verified live; this suite pins the one BEHAVIOUR the change adds — the
 * back control returns to the list.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import type { Skill } from "@/types"

vi.mock("@/lib/supabase", () => ({ supabase: {} }))

const SKILL = { id: "sk-1", name: "quarterly-brief", description: "d" } as unknown as Skill

vi.mock("@/hooks/useSkills", () => ({
  useSkills: () => ({
    skills: [SKILL],
    loading: false,
    loadSkills: vi.fn(),
    createSkill: vi.fn(),
    updateSkill: vi.fn(),
    deleteSkill: vi.fn(),
    toggleEnabled: vi.fn(),
    toggleOrgShared: vi.fn(),
  }),
}))
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u-1" } }) }))
vi.mock("@/components/skills/SkillCard", () => ({
  SkillCard: ({ skill, onSelect }: { skill: Skill; onSelect: (s: Skill) => void }) => (
    <button type="button" onClick={() => onSelect(skill)}>
      open {skill.name}
    </button>
  ),
}))
vi.mock("@/components/skills/SkillFormDialog", () => ({
  SkillDetailPanel: ({ skill }: { skill: Skill | null }) => (
    <div data-testid="detail-stub">{skill?.name ?? "new"}</div>
  ),
}))

import { SkillsPage } from "./SkillsPage"

describe("SkillsPage at phone width (262-UAT follow-up)", () => {
  it("a selected skill offers 'Back to skills', which returns to the list", () => {
    render(<SkillsPage />)
    expect(screen.queryByRole("button", { name: "Back to skills" })).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "open quarterly-brief" }))
    expect(screen.getByTestId("detail-stub")).toHaveTextContent("quarterly-brief")

    fireEvent.click(screen.getByRole("button", { name: "Back to skills" }))
    expect(screen.queryByTestId("detail-stub")).toBeNull()
    expect(screen.getByText("Select a skill to view details")).toBeInTheDocument()
  })
})
