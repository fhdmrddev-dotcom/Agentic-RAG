/**
 * Phase 123-06 Task 1 (TRIG-03 / sketch 044-A) — inline lint warning + "Tune this".
 *
 * Asserts the locked authoring-loop contract (D-09/D-11/D-12):
 *  - a save that RETURNS lint_warnings renders the SPECIFIC reason text inline
 *    under the Description field AND a "Tune this" button (never silent);
 *  - empty/absent lint_warnings render NO warning (silent-when-healthy);
 *  - the save STILL COMPLETES with warnings present (advisory — never blocks);
 *  - clicking "Tune this" fires onTuneSkill with the skill's id (handoff → Tuner).
 *
 * The shared `SkillForm` renders the warning in ONE place, so covering the modal
 * `SkillFormDialog` covers the 3-pane `SkillDetailPanel` too.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Skill, SkillCreate, SkillUpdate } from "@/types"

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

const listSkillFiles = vi.fn().mockResolvedValue([])
const uploadSkillFile = vi.fn()
const deleteSkillFile = vi.fn()
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    listSkillFiles: (...a: unknown[]) => listSkillFiles(...(a as [])),
    uploadSkillFile: (...a: unknown[]) => uploadSkillFile(...(a as [])),
    deleteSkillFile: (...a: unknown[]) => deleteSkillFile(...(a as [])),
  }
})

import { SkillFormDialog } from "./SkillFormDialog"

function mkSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "skill-1",
    user_id: "user-1",
    name: "Risk Register",
    description: "Risk register.",
    instructions: "Build a spreadsheet…",
    is_enabled: true,
    is_global: false,
    created_at: "2026-06-23T00:00:00Z",
    updated_at: "2026-06-23T00:00:00Z",
    ...overrides,
  }
}

afterEach(() => cleanup())

describe("SkillFormDialog — inline lint warning + Tune this (123-06)", () => {
  beforeEach(() => {
    listSkillFiles.mockClear()
    listSkillFiles.mockResolvedValue([])
  })

  it("renders the specific reason text + a Tune this button when the save returns lint_warnings", async () => {
    const user = userEvent.setup()
    const skill = mkSkill()
    const onSave = vi.fn(
      async (_body: SkillCreate | SkillUpdate): Promise<Skill> =>
        mkSkill({
          lint_warnings: [
            { code: "name_echo", message: "echoes the skill name, adds nothing" },
            { code: "no_trigger_verb", message: "no trigger verb (build / generate / write…)" },
          ],
        }),
    )
    const onTuneSkill = vi.fn()

    render(
      <SkillFormDialog
        open
        onOpenChange={() => {}}
        skill={skill}
        onSave={onSave}
        currentUserId="user-1"
        onTuneSkill={onTuneSkill}
      />,
    )

    await user.click(screen.getByRole("button", { name: /update skill/i }))

    await waitFor(() => {
      expect(screen.getByText(/echoes the skill name/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/no trigger verb/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /tune this/i })).toBeInTheDocument()
  })

  it("renders NO warning when the save returns empty/absent lint_warnings (silent-when-healthy)", async () => {
    const user = userEvent.setup()
    const skill = mkSkill()
    const onSave = vi.fn(
      async (_body: SkillCreate | SkillUpdate): Promise<Skill> =>
        mkSkill({ lint_warnings: [] }),
    )

    render(
      <SkillFormDialog
        open
        onOpenChange={() => {}}
        skill={skill}
        onSave={onSave}
        currentUserId="user-1"
        onTuneSkill={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("button", { name: /update skill/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalled())

    expect(screen.queryByRole("button", { name: /tune this/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/weak trigger description/i)).not.toBeInTheDocument()
  })

  it("still completes the save when warnings are present (advisory — never blocks)", async () => {
    const user = userEvent.setup()
    const skill = mkSkill()
    const onSave = vi.fn(
      async (_body: SkillCreate | SkillUpdate): Promise<Skill> =>
        mkSkill({ lint_warnings: [{ code: "too_short", message: "very short — under the useful length" }] }),
    )

    render(
      <SkillFormDialog
        open
        onOpenChange={() => {}}
        skill={skill}
        onSave={onSave}
        currentUserId="user-1"
        onTuneSkill={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("button", { name: /update skill/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    // The warning surfaced (the save proceeded and returned warnings) — not blocked.
    await waitFor(() => expect(screen.getByText(/very short/i)).toBeInTheDocument())
  })

  it("fires onTuneSkill with the skill's id when Tune this is clicked", async () => {
    const user = userEvent.setup()
    const skill = mkSkill({ id: "skill-xyz" })
    const onSave = vi.fn(
      async (_body: SkillCreate | SkillUpdate): Promise<Skill> =>
        mkSkill({ id: "skill-xyz", lint_warnings: [{ code: "generic", message: "too generic to disambiguate" }] }),
    )
    const onTuneSkill = vi.fn()

    render(
      <SkillFormDialog
        open
        onOpenChange={() => {}}
        skill={skill}
        onSave={onSave}
        currentUserId="user-1"
        onTuneSkill={onTuneSkill}
      />,
    )

    await user.click(screen.getByRole("button", { name: /update skill/i }))
    const tuneBtn = await screen.findByRole("button", { name: /tune this/i })
    await user.click(tuneBtn)

    expect(onTuneSkill).toHaveBeenCalledWith("skill-xyz")
  })
})
