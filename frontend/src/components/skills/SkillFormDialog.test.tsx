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
import { render, screen, waitFor, within, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Skill, SkillCreate, SkillUpdate, PublishGate } from "@/types"

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
// Phase 137-07 (PANEL-01): the slim panel fetches the SAME gate/case/version data
// the shared LifecycleStepper consumes. Mock them so the panel renders offline.
const getPublishGate = vi.fn()
const listTestCases = vi.fn().mockResolvedValue([])
const listSkillVersions = vi.fn().mockResolvedValue([])
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    listSkillFiles: (...a: unknown[]) => listSkillFiles(...(a as [])),
    uploadSkillFile: (...a: unknown[]) => uploadSkillFile(...(a as [])),
    deleteSkillFile: (...a: unknown[]) => deleteSkillFile(...(a as [])),
    getPublishGate: (...a: unknown[]) => getPublishGate(...(a as [string])),
    listTestCases: (...a: unknown[]) => listTestCases(...(a as [string])),
    listSkillVersions: (...a: unknown[]) => listSkillVersions(...(a as [string])),
  }
})

function mkGate(overrides: Partial<PublishGate> = {}): PublishGate {
  return {
    met: false,
    state: "never_evaled",
    measured: null,
    passed: null,
    passing_run_id: null,
    reason: "This skill has never had a completed eval.",
    last_override: null,
    ...overrides,
  }
}

import { SkillFormDialog, SkillDetailPanel } from "./SkillFormDialog"

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

describe("SkillDetailPanel — Expand full-size instructions editor (sketch 046-C)", () => {
  beforeEach(() => {
    listSkillFiles.mockClear()
    listSkillFiles.mockResolvedValue([])
    // Phase 137-07: the panel now fetches gate/case/version on mount — stub them so
    // this pre-existing Expand test renders offline.
    getPublishGate.mockReset()
    getPublishGate.mockResolvedValue(mkGate())
    listTestCases.mockReset()
    listTestCases.mockResolvedValue([])
    listSkillVersions.mockReset()
    listSkillVersions.mockResolvedValue([])
  })

  it("opens a focused editor bound to the same instructions value and keeps edits on close", async () => {
    const user = userEvent.setup()
    const skill = mkSkill({ instructions: "line one\nline two" })

    render(
      <SkillDetailPanel
        skill={skill}
        onSave={vi.fn(async (): Promise<Skill> => mkSkill())}
        onDiscard={vi.fn()}
        currentUserId="user-1"
      />,
    )

    // The inline editor shows the seeded instructions.
    expect(screen.getByPlaceholderText(/step-by-step instructions/i)).toHaveValue("line one\nline two")

    // Open the full-size editor — it binds the SAME value.
    await user.click(screen.getByRole("button", { name: /expand/i }))
    const dialog = await screen.findByRole("dialog")
    const big = within(dialog).getByRole("textbox")
    expect(big).toHaveValue("line one\nline two")

    // Edit in the big editor; "Done" closes it and the edit survives in the form.
    await user.clear(big)
    await user.type(big, "rewritten in the big editor")
    await user.click(within(dialog).getByRole("button", { name: /done/i }))

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument())
    expect(screen.getByPlaceholderText(/step-by-step instructions/i)).toHaveValue(
      "rewritten in the big editor",
    )
  })
})

describe("SkillDetailPanel — slimmed panel: shared stepper + Open studio, sections removed (137-07)", () => {
  beforeEach(() => {
    listSkillFiles.mockClear()
    listSkillFiles.mockResolvedValue([])
    getPublishGate.mockReset()
    getPublishGate.mockResolvedValue(mkGate())
    listTestCases.mockReset()
    listTestCases.mockResolvedValue([])
    listSkillVersions.mockReset()
    listSkillVersions.mockResolvedValue([])
  })

  it("removes the heavy SkillTestCasesSection + SkillEvalSection and renders the shared LifecycleStepper", async () => {
    const skill = mkSkill()
    render(
      <SkillDetailPanel
        skill={skill}
        onSave={vi.fn(async (): Promise<Skill> => mkSkill())}
        onDiscard={vi.fn()}
        currentUserId="user-1"
        onOpenStudio={vi.fn()}
      />,
    )

    // The shared full-variant stepper is mounted (its 4 stage names render).
    await waitFor(() => expect(screen.getByText("Published")).toBeInTheDocument())
    expect(screen.getByText("Gate")).toBeInTheDocument()
    expect(screen.getByText("Cases")).toBeInTheDocument()

    // The two heavy sections are gone (their distinctive controls are absent).
    expect(screen.queryByText(/eval test cases/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^run eval$/i })).not.toBeInTheDocument()
  })

  it("renders an honest 'not evaled yet' counts line when the gate has no measured run", async () => {
    listTestCases.mockResolvedValue([{ id: "c1" }, { id: "c2" }])
    const skill = mkSkill()
    render(
      <SkillDetailPanel
        skill={skill}
        onSave={vi.fn(async (): Promise<Skill> => mkSkill())}
        onDiscard={vi.fn()}
        currentUserId="user-1"
        onOpenStudio={vi.fn()}
      />,
    )

    await waitFor(() => expect(screen.getByText(/not evaled yet/i)).toBeInTheDocument())
  })

  it("Open studio button calls onOpenStudio with (skillId, 'evals') — the sole studio entry", async () => {
    const user = userEvent.setup()
    const onOpenStudio = vi.fn()
    const skill = mkSkill({ id: "skill-77" })
    render(
      <SkillDetailPanel
        skill={skill}
        onSave={vi.fn(async (): Promise<Skill> => mkSkill())}
        onDiscard={vi.fn()}
        currentUserId="user-1"
        onOpenStudio={onOpenStudio}
      />,
    )

    const btn = await screen.findByRole("button", { name: /open studio/i })
    await user.click(btn)

    expect(onOpenStudio).toHaveBeenCalledWith("skill-77", "evals")
  })
})
