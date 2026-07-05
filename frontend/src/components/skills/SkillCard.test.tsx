/**
 * Phase 137.2-03 Task 3 (CREATE-01 / D-01) — SkillCard "Built-in" badge + read-only reflection.
 *
 * Two behavioral proofs for the frontend half of the Built-in trust badge:
 *  (a) a system skill (`is_system`) renders a single "Built-in" pill; a non-system
 *      GLOBAL skill still renders "Global" (the ternary's else branch) — never both.
 *  (b) owner-only actions (edit / delete / share / export) are HIDDEN when the viewer
 *      is not the owner (`isOwner` false) — the reflect-not-enforce protection
 *      (T-137.2-01), already correct because the system-owned built-in's `user_id`
 *      never matches a real current user. No `is_system`-aware guard exists or is needed.
 *
 * Authored fresh in the PublishGateDialog.test.tsx style (MEMORY project_frontend_vitest_rot
 * — deliberately not leaning on the rotted vitest siblings). `@/lib/api` + `@/lib/supabase`
 * are mocked because SkillCard embeds a (closed-by-default) PublishGateDialog.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import type { Skill } from "@/types"
import { TooltipProvider } from "@/components/ui/tooltip"

// SkillCard embeds a closed-by-default <PublishGateDialog>, which calls getPublishGate
// ONLY when open. Mock it defensively so a plain render never touches the network
// (matches PublishGateDialog.test.tsx). PublishGateDialog imports only getPublishGate
// from @/lib/api, so a full-module replacement is safe. SkillCard imports neither
// @/lib/api nor @/lib/supabase directly — the supabase mock is pure defense-in-depth.
vi.mock("@/lib/api", () => ({
  getPublishGate: vi.fn(),
}))
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

import { SkillCard } from "./SkillCard"

// Copied from SkillFormDialog.test.tsx:67-80 with `is_system: false` added to the
// defaults so `mkSkill({ is_system: true })` exercises the Built-in pill.
function mkSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-1",
    user_id: "user-1",
    name: "Risk Register",
    description: "Risk register.",
    instructions: "Build a spreadsheet…",
    is_enabled: true,
    is_global: false,
    is_system: false,
    created_at: "2026-06-23T00:00:00Z",
    updated_at: "2026-06-23T00:00:00Z",
    ...overrides,
  }
}

// Required SkillCard handlers — inert stubs; these are pure render assertions.
const handlers = {
  onEdit: vi.fn(),
  onSelect: vi.fn(),
  onDelete: vi.fn().mockResolvedValue(undefined),
  onToggleEnabled: vi.fn().mockResolvedValue(undefined),
  onToggleGlobal: vi.fn().mockResolvedValue(undefined),
  onTryInChat: vi.fn(),
  onExport: vi.fn().mockResolvedValue(undefined),
}

function renderCard(skill: Skill, currentUserId: string) {
  return render(
    <TooltipProvider>
      <SkillCard skill={skill} currentUserId={currentUserId} {...handlers} />
    </TooltipProvider>,
  )
}

afterEach(() => cleanup())

describe("SkillCard — Built-in badge (137.2-03 / CREATE-01 / D-01)", () => {
  it("renders a single 'Built-in' pill for a system skill (never 'Global' too)", () => {
    // The real built-in is BOTH is_system and is_global — the ternary must render
    // exactly one pill, and Built-in wins.
    renderCard(mkSkill({ is_system: true, is_global: true }), "user-1")

    expect(screen.getByText(/built-in/i)).toBeInTheDocument()
    expect(screen.queryByText(/^global$/i)).not.toBeInTheDocument()
  })

  it("a non-system GLOBAL skill still shows 'Global', not 'Built-in' (the else branch)", () => {
    renderCard(mkSkill({ is_system: false, is_global: true }), "user-1")

    expect(screen.getByText(/^global$/i)).toBeInTheDocument()
    expect(screen.queryByText(/built-in/i)).not.toBeInTheDocument()
  })
})

describe("SkillCard — owner actions reflect ownership (137.2-03 / T-137.2-01)", () => {
  // The owner-only buttons carry a lucide icon and NO accessible name, so we assert
  // on lucide's stable icon-marker classes (lucide-react v0.577 emits `lucide-<kebab>`).
  // Each of these icons appears ONLY inside the `{isOwner && …}` owner block.
  const OWNER_ICONS = [".lucide-pencil", ".lucide-trash-2", ".lucide-globe", ".lucide-download"]

  it("hides edit/delete/share/export for the system-owned built-in when the viewer is not the owner", () => {
    const { container } = renderCard(
      mkSkill({ user_id: "00000000-0000-0000-0000-000000000001", is_system: true, is_global: true }),
      "someone-else",
    )

    for (const sel of OWNER_ICONS) {
      expect(container.querySelector(sel)).toBeNull()
    }
  })

  it("shows those same owner actions when the viewer IS the owner (control)", () => {
    const { container } = renderCard(mkSkill({ user_id: "user-1" }), "user-1")

    for (const sel of OWNER_ICONS) {
      expect(container.querySelector(sel)).not.toBeNull()
    }
  })
})
