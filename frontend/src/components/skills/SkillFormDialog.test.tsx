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
    is_org_shared: false,
    is_system: false,
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
      />,
    )

    await waitFor(() => expect(screen.getByText(/not evaled yet/i)).toBeInTheDocument())
  })

  it("no longer renders an Open studio button in the status section (relocated to the panel header)", async () => {
    listTestCases.mockResolvedValue([{ id: "c1" }])
    const skill = mkSkill({ id: "skill-77" })
    render(
      <SkillDetailPanel
        skill={skill}
        onSave={vi.fn(async (): Promise<Skill> => mkSkill())}
        onDiscard={vi.fn()}
        currentUserId="user-1"
      />,
    )

    // The status section stays (stepper + counts); its studio-entry button is GONE —
    // the sole "Open Studio" entry now lives at the top of the SkillsPage panel header.
    await waitFor(() => expect(screen.getByText("Gate")).toBeInTheDocument())
    expect(screen.queryByRole("button", { name: /open studio/i })).not.toBeInTheDocument()
  })
})

/**
 * Phase 263-04 Task 1 (PACK-14 / PACK-15 · D-263-01 / D-263-04) — the `initialValues`
 * pre-fill that lets an Expert proposal open THIS dialog already filled in.
 *
 * ⛔ The load-bearing property is that pre-filling must NOT turn the dialog into an EDIT
 * dialog. Passing a synthetic object as `skill` would flip `const isEdit = !!skill`,
 * change the title, fire `listSkillFiles(skill.id)` against an id that does not exist,
 * and make the save read as an update. The three `??` reads inside the EXISTING reset
 * effect are the whole change — and the cases below are what make that falsifiable
 * rather than merely asserted.
 *
 * ⭐ Content, not presence: every case asserts the RENDERED VALUE of each field, because
 * the words in the box ARE the deliverable here. A fence asserting only that a textbox
 * exists cannot see a pre-fill that silently lands empty (Phase 235's finding).
 */
describe("SkillFormDialog — initialValues pre-fill (263-04 / D-263-04)", () => {
  beforeEach(() => {
    listSkillFiles.mockClear()
    listSkillFiles.mockResolvedValue([])
  })

  const PROPOSAL = {
    name: "prisma-screening",
    description: "Screen titles and abstracts against PRISMA inclusion criteria.",
    instructions: "1. Read the protocol.\n2. Apply the inclusion criteria.\n3. Record exclusions.",
  }

  const descBox = () => screen.getByPlaceholderText(/one sentence describing what this skill does/i)
  const instBox = () => screen.getByPlaceholderText(/step-by-step instructions/i)

  it("pre-fills name, description and instructions from initialValues when there is no skill", () => {
    render(
      <SkillFormDialog
        open
        onOpenChange={() => {}}
        onSave={vi.fn(async (): Promise<Skill> => mkSkill())}
        initialValues={PROPOSAL}
      />,
    )

    expect(screen.getByLabelText("Name")).toHaveValue("prisma-screening")
    expect(descBox()).toHaveValue(PROPOSAL.description)
    expect(instBox()).toHaveValue(PROPOSAL.instructions)
  })

  it("stays in CREATE mode when pre-filled — create wording, and listSkillFiles is never called", async () => {
    render(
      <SkillFormDialog
        open
        onOpenChange={() => {}}
        onSave={vi.fn(async (): Promise<Skill> => mkSkill())}
        initialValues={PROPOSAL}
      />,
    )

    // The title and the primary button carry the CREATE wording, not the edit wording.
    expect(screen.getByText("New Skill")).toBeInTheDocument()
    expect(screen.queryByText("Edit Skill")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /save skill/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /update skill/i })).not.toBeInTheDocument()

    // ⛔ The synthetic-`skill` shortcut would have fired this against an id that does not exist.
    await waitFor(() => expect(listSkillFiles).toHaveBeenCalledTimes(0))
  })

  it("lets a real skill WIN over initialValues when both are supplied", () => {
    render(
      <SkillFormDialog
        open
        onOpenChange={() => {}}
        skill={mkSkill()}
        onSave={vi.fn(async (): Promise<Skill> => mkSkill())}
        currentUserId="user-1"
        initialValues={PROPOSAL}
      />,
    )

    expect(screen.getByLabelText("Name")).toHaveValue("Risk Register")
    expect(descBox()).toHaveValue("Risk register.")
    expect(instBox()).toHaveValue("Build a spreadsheet…")
  })

  it("behaves exactly as today when neither skill nor initialValues is given", () => {
    render(
      <SkillFormDialog
        open
        onOpenChange={() => {}}
        onSave={vi.fn(async (): Promise<Skill> => mkSkill())}
      />,
    )

    expect(screen.getByLabelText("Name")).toHaveValue("")
    expect(descBox()).toHaveValue("")
    expect(instBox()).toHaveValue("")
  })

  it("shows the SECOND proposal's values when initialValues changes without unmounting", async () => {
    const { rerender } = render(
      <SkillFormDialog
        open
        onOpenChange={() => {}}
        onSave={vi.fn(async (): Promise<Skill> => mkSkill())}
        initialValues={PROPOSAL}
      />,
    )
    expect(screen.getByLabelText("Name")).toHaveValue("prisma-screening")

    // The studio opens a DIFFERENT proposal in the SAME mounted dialog. Without
    // `initialValues` in the reset effect's dependency array this still reads the first one.
    const second = {
      name: "thematic-synthesis",
      description: "Synthesise findings into themes across the included studies.",
      instructions: "1. Code the extracts.\n2. Cluster the codes into themes.",
    }
    rerender(
      <SkillFormDialog
        open
        onOpenChange={() => {}}
        onSave={vi.fn(async (): Promise<Skill> => mkSkill())}
        initialValues={second}
      />,
    )

    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue("thematic-synthesis"))
    expect(descBox()).toHaveValue(second.description)
    expect(instBox()).toHaveValue(second.instructions)
  })
})

// 262-UAT follow-up (operator read the backend log): opening a built-in skill logged
// `GET /publish-gate|/test-cases|/versions → 403` every time. Those three reads are OWNER-ONLY
// server-side, so a non-owner request can only ever be refused — the panel must not issue it.
describe("SkillDetailPanel — owner-only lifecycle reads", () => {
  beforeEach(() => {
    listSkillFiles.mockResolvedValue([])
    getPublishGate.mockReset().mockResolvedValue(mkGate())
    listTestCases.mockReset().mockResolvedValue([])
    listSkillVersions.mockReset().mockResolvedValue([])
  })

  it("a skill the caller does NOT own issues none of the three owner-only reads", async () => {
    render(
      <SkillDetailPanel
        skill={mkSkill({ id: "sys-1", user_id: "system-user", is_system: true })}
        onSave={vi.fn(async (): Promise<Skill> => mkSkill())}
        onDiscard={vi.fn()}
        currentUserId="user-1"
      />,
    )
    await waitFor(() => expect(listSkillFiles).toHaveBeenCalled())
    expect(getPublishGate).not.toHaveBeenCalled()
    expect(listTestCases).not.toHaveBeenCalled()
    expect(listSkillVersions).not.toHaveBeenCalled()
  })

  it("POSITIVE CONTROL — the owner's skill still issues all three", async () => {
    render(
      <SkillDetailPanel
        skill={mkSkill()}
        onSave={vi.fn(async (): Promise<Skill> => mkSkill())}
        onDiscard={vi.fn()}
        currentUserId="user-1"
      />,
    )
    await waitFor(() => expect(getPublishGate).toHaveBeenCalledWith("skill-1"))
    expect(listTestCases).toHaveBeenCalledWith("skill-1")
    expect(listSkillVersions).toHaveBeenCalledWith("skill-1")
  })
})
