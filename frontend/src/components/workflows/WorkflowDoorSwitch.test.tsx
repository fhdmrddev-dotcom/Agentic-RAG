/**
 * Phase 124-02 Task 2 (WUX-02, sketch 047-A variant A / D-01 / D-05) —
 * WorkflowDoorSwitch tests.
 *
 * These pin the locked two-door contract:
 *  - the "both" chooser renders BOTH door cards side by side.
 *  - the describe door shows the switch-to-govern strip + a WorkflowSoul preview,
 *    and the `both-doors` return control returns to the chooser.
 *  - GOVERN-DOOR DELEGATION (the G-5 ?raw source-grep, mirroring
 *    PhaseSpineGraph.test.tsx:153-159): the source IMPORTS and renders
 *    <WorkflowBuilderPage> and does NOT re-implement the advanced governance
 *    controls inline (no own citation_policy editor / gate-chip / deriveTier
 *    re-derivation). A shallow render asserts the Builder mounts in the govern door.
 *  - llm_judge_rubric renders LOCKED / non-removable in the govern door.
 *  - the shell adds NO new api fetch path and NO local tier re-derivation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react"
// Read the component SOURCE via Vite's ?raw loader (the idiomatic vitest way — the
// G-5 grep precedent at PhaseSpineGraph.test.tsx:16-19,153-159).
import workflowDoorSwitchSource from "./WorkflowDoorSwitch?raw"
// Phase 193-05 (D-24(a)): the SECOND swept source, and the module the needles are read OFF.
// A namespace import is correct HERE and wrong in a component: the fence is about the WHOLE
// table, so it must enumerate it rather than name 21 identifiers it would then have to keep
// in step by hand.
import doorHeaderStripSource from "./DoorHeaderStrip?raw"
// 193 REVIEW WR-01: the THIRD `doorVocabulary` consumer. It was outside the sweep while it held
// the ungoverned copy the phase had to fix — see the note on SWEPT_SOURCES below.
import builderPageSource from "@/pages/WorkflowBuilderPage?raw"
// 193.1-05 (D-14): the FOURTH swept source. It is added in the SAME COMMIT that creates the
// module — see the note on SWEPT_SOURCES below for why a new module on this surface joins the
// list even though it imports nothing from `doorVocabulary` today.
import templateFirstDraftSource from "./useTemplateFirstDraft?raw"
// 193.1-06 (D-14): the FIFTH and SIXTH swept sources, both added in the SAME COMMIT that
// creates them. The component is a real `doorVocabulary` CONSUMER — it renders the 22nd
// governed id — so it would join this list under the WR-01 rule alone. The vocabulary module
// joins it for a reason stated on `SWEPT_SOURCES` below, and it is the higher-risk of the two.
import describeTemplateRowSource from "./DescribeTemplateRow?raw"
import templateFirstVocabularySource from "./templateFirstVocabulary?raw"
import * as doorVocabulary from "./doorVocabulary"

// The govern door mounts the real WorkflowBuilderPage, which fetches folders + skills
// on mount (103-ux name maps) and owns the generate→draft flow. Mock the api seam so
// the unit render is offline; the generate mock backstops the CR-01 auto-draft path.
const {
  mockGenerateWorkflow,
  mockListFolders,
  mockListSkills,
  // 193.1-08: the two seams the pre-draft row's hosts reach. The FIRST is the one this
  // plan's zero-request claim is measured on — it must be a real spy so its call COUNT is
  // observable, not merely its effect.
  mockReadPlaceholders,
  mockUploadTemplate,
  mockListConnections,
} = vi.hoisted(() => ({
  mockGenerateWorkflow: vi.fn(),
  mockListFolders: vi.fn(),
  mockListSkills: vi.fn(),
  mockReadPlaceholders: vi.fn(),
  mockUploadTemplate: vi.fn(),
  mockListConnections: vi.fn(),
}))
vi.mock("@/lib/api", () => ({
  // 204-03 (SCHED-01) — THE MEASURED MOCK BUDGET, SPENT IN THE COMMIT THAT ADDED THE EXPORTS.
  // A whole-module `vi.mock("@/lib/api")` factory that omits a newly-added RUNTIME export makes
  // every suite reaching it throw AT MOUNT, far from the cause: `196-08` cost 249 red tests
  // exactly this way. `WorkflowsPage` now mounts `WorkflowScheduleModal`, which imports these
  // six. They resolve to empty/no-op answers because no case here opens the schedules dialog —
  // their job is to EXIST.
  listSchedules: () => Promise.resolve([]),
  listWorkflowSchedules: () => Promise.resolve([]),
  createWorkflowSchedule: () => Promise.resolve({}),
  updateSchedule: () => Promise.resolve({}),
  deleteSchedule: () => Promise.resolve(undefined),
  triggerSchedule: () => Promise.resolve({ launched: false }),
  generateWorkflow: mockGenerateWorkflow,
  createWorkflowDraft: vi.fn(),
  updateWorkflowDraft: vi.fn(),
  listFolders: mockListFolders,
  listSkills: mockListSkills,
  // 214-13 (STEP-06) — ALREADY DECLARED BEFORE THIS PHASE (206.2's connection work), and now
  // reached by a SECOND consumer: the describe door mounts `DescribeServicePicker`. Promoted
  // from a fixed `[]` to a hoisted mock so a case can drive the picker's real arms.
  //
  // ⚠ ITS ABSENCE WOULD NOT HAVE BEEN LOUD, which is why this is recorded rather than assumed
  // lucky. The picker's read sits inside the shipped best-effort `try/catch`, so an undeclared
  // export does NOT throw the visible *"No export is defined on the @/lib/api mock"* — it is
  // SWALLOWED and the picker silently renders its "we could not ask" arm. That is the 196-08
  // mock-budget trap wearing a disguise, and it DID fire one file over
  // (`WorkflowDoorSwitch.baseline.test.tsx`, whose factory had no entry at all).
  listConnectorConnections: mockListConnections,
  discoverConnectorTools: () => Promise.resolve([]),
  updateConnectorGrants: () => Promise.resolve({}),
  readTemplatePlaceholdersFromFile: mockReadPlaceholders,
  uploadWorkflowTemplate: mockUploadTemplate,
  // 196-08 (AUTH-04) — see the note in `WorkflowBuilderPage.describe.test.tsx`: the hosted
  // Builder reads the author model registry at mount and this factory must declare it.
  getAuthorModelRegistry: () => Promise.resolve({ models: [], run_default_model: null }),
}))

import { WorkflowDoorSwitch } from "./WorkflowDoorSwitch"

/** A strict definition (citation_policy 'strict' + the full gate set) for the soul preview. */
const strictDef = {
  slug: "vendor-risk",
  version: 2,
  name: "Vendor-risk review",
  business_requirement: "Review a vendor's risk posture and produce a cited report.",
  phases: [
    { slug: "pull", phase_index: 0, name: "Pull", config: { phase_type: "programmatic" } },
    {
      slug: "emit",
      phase_index: 1,
      name: "Render report",
      config: { phase_type: "llm_emit", citation_policy: "strict" },
      validators: [{ kind: "citations_required" }, { kind: "llm_judge_rubric" }],
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListFolders.mockResolvedValue([])
  mockListSkills.mockResolvedValue([])
  // The Builder's generate→draft seam — resolve to a valid drafted definition so the
  // CR-01 auto-draft hand-off completes cleanly.
  mockGenerateWorkflow.mockResolvedValue({ ok: true, definition: { slug: "vendor-risk", phases: [] } })
  // 214-13 — the describe door's service picker. EMPTY is the honest default here: no case
  // below is about connections, and the picker's empty arm adds no control and no gate.
  mockListConnections.mockResolvedValue([])
})

describe("WorkflowDoorSwitch — the 'both' chooser (047-A variant A)", () => {
  it("renders BOTH door cards side by side at the default 'both' state", () => {
    render(<WorkflowDoorSwitch def={strictDef} onDescribeDraft={vi.fn()} />)
    expect(screen.getByTestId("workflow-doors")).toBeInTheDocument()
    const describeDoor = screen.getByTestId("door-card-describe")
    const governDoor = screen.getByTestId("door-card-govern")
    // Phase 193-08 RE-CAPTURE (2026-08-13, words only): these two read `/describe & run/i` and
    // `/author & govern/i` until variant D landed. They are now READ OFF `doorVocabulary`
    // rather than re-typed at column D — a literal here would be a second home for the copy
    // (D-11) and would go stale silently at the next reword.
    //
    // ⚠ ASSERTED IN BOTH DIRECTIONS, because a name-only check on a composite card is exactly
    // the vacuous shape `doorVocabulary.test.ts` rule 2 bans: each card must name ITS OWN door
    // and must NOT name the other one.
    expect(describeDoor).toHaveTextContent(doorVocabulary.DOOR_A_NAME)
    expect(describeDoor).not.toHaveTextContent(doorVocabulary.DOOR_B_NAME)
    expect(governDoor).toHaveTextContent(doorVocabulary.DOOR_B_NAME)
    expect(governDoor).not.toHaveTextContent(doorVocabulary.DOOR_A_NAME)
  })

  it("defaults to 'both' but honours initialDoor='govern' (Open/Tweak land in govern)", () => {
    render(<WorkflowDoorSwitch def={strictDef} initialDoor="govern" />)
    expect(screen.getByTestId("door-govern")).toBeInTheDocument()
    expect(screen.queryByTestId("workflow-doors")).not.toBeInTheDocument()
  })
})

describe("WorkflowDoorSwitch — the describe door (loose, D-05)", () => {
  it("opening the describe door shows the switch-to-govern strip AND a WorkflowSoul preview", () => {
    render(<WorkflowDoorSwitch def={strictDef} onDescribeDraft={vi.fn()} />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    expect(screen.getByTestId("door-describe")).toBeInTheDocument()
    // The one-click `switch-strip` to the strict door (D-05).
    expect(screen.getByTestId("switch-strip")).toBeInTheDocument()
    // Phase 193-08 RE-CAPTURE (2026-08-13, words only): was `/author & govern/i`. Asserted as
    // the WHOLE string now, not a fragment — `SWITCH_CTA` is `DOOR_B_NAME` plus a chevron, so a
    // fragment check on the name cannot tell the CTA from the card or from the govern strip.
    expect(screen.getByTestId("switch-to-govern").textContent).toBe(doorVocabulary.SWITCH_CTA)
    // The soul PREVIEW of the current draft/definition.
    const preview = screen.getByTestId("describe-soul-preview")
    expect(within(preview).getByTestId("workflow-soul").getAttribute("data-scale")).toBe("card")
    // The describe box (the 018-A lineage).
    expect(screen.getByTestId("describe-box")).toBeInTheDocument()
  })

  it("the persistent `both-doors` return control brings the describe door back to the chooser", () => {
    render(<WorkflowDoorSwitch def={strictDef} onDescribeDraft={vi.fn()} />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    expect(screen.getByTestId("door-describe")).toBeInTheDocument()
    fireEvent.click(screen.getByTestId("both-doors"))
    expect(screen.getByTestId("workflow-doors")).toBeInTheDocument()
    expect(screen.queryByTestId("door-describe")).not.toBeInTheDocument()
  })

  it("the switch strip opens the govern door (advanced one click away — nothing removed)", () => {
    render(<WorkflowDoorSwitch def={strictDef} onDescribeDraft={vi.fn()} />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    fireEvent.click(screen.getByTestId("switch-to-govern"))
    expect(screen.getByTestId("door-govern")).toBeInTheDocument()
  })

  it("the describe CTA forwards the describe text to the existing draft path then opens govern", () => {
    const onDescribeDraft = vi.fn()
    render(<WorkflowDoorSwitch def={strictDef} onDescribeDraft={onDescribeDraft} />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "Summarise weekly vendor risk" },
    })
    fireEvent.click(screen.getByTestId("describe-draft"))
    expect(onDescribeDraft).toHaveBeenCalledWith("Summarise weekly vendor risk")
    // The govern door (the existing Builder) owns the actual generate→draft flow.
    expect(screen.getByTestId("door-govern")).toBeInTheDocument()
  })

  it("the describe CTA SEEDS the Builder and auto-runs the draft with the typed text (CR-01 — no data-loss dead-end)", async () => {
    // No onDescribeDraft handler passed — proves the door is self-sufficient and the
    // typed requirement survives the hand-off WITHOUT a parent callback (the gap CR-01
    // flagged: the only production call site never wired onDescribeDraft).
    render(<WorkflowDoorSwitch />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "Summarise weekly vendor risk" },
    })
    fireEvent.click(screen.getByTestId("describe-draft"))
    // The govern door's Builder auto-runs the EXISTING generate→draft flow with the
    // seeded text — the requirement is NOT dropped on the floor.
    await waitFor(() =>
      expect(mockGenerateWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ describe: "Summarise weekly vendor risk" }),
      ),
    )
  })

  it("the switch-to-govern strip seeds the typed text but does NOT auto-draft (configure-first path)", async () => {
    render(<WorkflowDoorSwitch />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "Configure strictness first" },
    })
    fireEvent.click(screen.getByTestId("switch-to-govern"))
    expect(screen.getByTestId("door-govern")).toBeInTheDocument()
    // Choosing the strict door is the configure-first path — no premature generate.
    expect(mockGenerateWorkflow).not.toHaveBeenCalled()
  })

  it("the soul preview reflects the typed business requirement live (WR-01)", () => {
    // No def passed → fresh build. The preview must track what the user types instead
    // of staying frozen on the honest empty-state.
    render(<WorkflowDoorSwitch />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "Draft a cited vendor-risk report" },
    })
    const preview = screen.getByTestId("describe-soul-preview")
    expect(within(preview).getByTestId("soul-purpose")).toHaveTextContent("Draft a cited vendor-risk report")
  })
})

describe("WorkflowDoorSwitch — the govern door delegates to the existing Builder (D-05, T-124-07)", () => {
  it("the govern door mounts WorkflowBuilderPage (the Builder is mounted, not cloned)", () => {
    render(<WorkflowDoorSwitch def={strictDef} initialDoor="govern" />)
    // The Builder's own fresh-describe screen renders inside the govern door (the
    // runtime companion to the source-grep — the Builder mounts, not a re-implementation).
    expect(screen.getByTestId("door-govern")).toBeInTheDocument()
    expect(screen.getByTestId("describe-hint")).toBeInTheDocument()
  })

  it("the govern door renders the llm_judge_rubric as LOCKED / always-on (non-removable)", () => {
    render(<WorkflowDoorSwitch def={strictDef} initialDoor="govern" />)
    const lock = screen.getByTestId("judge-locked")
    expect(lock).toHaveTextContent(/judge always-on/i)
    // It is a locked affordance, NOT a removable toggle (no checkbox / switch role).
    expect(lock.querySelector('input[type="checkbox"]')).toBeNull()
    expect(lock.getAttribute("role")).not.toBe("switch")
  })

  it("GOVERN-DOOR DELEGATION source-grep (G-5): imports + renders WorkflowBuilderPage, no inline governance clone", () => {
    const src = workflowDoorSwitchSource
    // It IMPORTS and RENDERS the existing Builder (delegation, not re-implementation).
    expect(src).toMatch(/import .*WorkflowBuilderPage/)
    expect(src).toMatch(/<WorkflowBuilderPage/)
    // It does NOT re-implement the advanced governance controls inline: no own
    // citation_policy editor, no gate-chip clone, no deriveTier re-derivation.
    expect(src).not.toMatch(/citation_policy/)
    expect(src).not.toMatch(/deriveTier|tierForDefinition/)
    expect(src).not.toMatch(/PhaseFormPanel/)
  })

  it("the shell adds NO new api fetch path and NO local tier re-derivation", () => {
    const src = workflowDoorSwitchSource
    // No direct api-client import (it delegates the draft/generate path via a handler).
    expect(src).not.toMatch(/from ["']@\/lib\/api["']/)
    // No local deriveTier / tierForDefinition (tier display is delegated to WorkflowSoul).
    expect(src).not.toMatch(/deriveTier\(|tierForDefinition\(/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════
// Phase 187-26 Task 2 (VOCAB-02 / VOCAB-03 · GAP A) — THE KB PICKER, MOUNTED, AND THE
// CHOICE CARRIED THROUGH TO THE REQUEST THE CLIENT ACTUALLY SENDS.
//
// APPENDED, never interleaved. Not one assertion above this line moves.
//
// THE MEASURED BEFORE-STATE. The operator probed this door's DOM for
// `project-folder-picker` at 1.5 s / 3 s / 5 s and found it ABSENT, with ZERO `/folders`
// requests recorded on the screen. Re-derived at HEAD before this block was written: the
// first case below was observed RED on the unmodified shell.
//
// THE FENCE THE UAT ASKS FOR is the round-trip one, and it is asserted on the REQUEST —
// `generateWorkflow`'s own argument — never on a prop being present. A prop can be
// threaded, renamed, shadowed or dropped one hop later and still look wired; the request
// is the only thing the server sees.
// ══════════════════════════════════════════════════════════════════════════════════

/** Two folders in the live `Folder` shape (`types/index.ts:470`). */
const kbFolder = (id: string, name: string) => ({
  id,
  user_id: "u-1",
  name,
  parent_id: null,
  is_org_shared: false,
  created_at: "2026-08-04T00:00:00Z",
  updated_at: "2026-08-04T00:00:00Z",
})

const KB_POLICIES = kbFolder("f-policies", "Policies")
const KB_CONTRACTS = kbFolder("f-contracts", "Contracts")

/**
 * Open the describe door with folders on offer and wait for the picker to land.
 *
 * ⚠ SKETCH 200 — THE SELECT IS DISCLOSED, NOT ALWAYS-ON. The picker's resting arm is a dashed
 * add control; pressing it reveals the shipped `select` under the shipped test id. Every case
 * below still asserts the same PROPERTY it always did — only the route to the control moved.
 */
async function openDescribeDoorWithFolders() {
  mockListFolders.mockResolvedValue([KB_POLICIES, KB_CONTRACTS])
  render(<WorkflowDoorSwitch />)
  fireEvent.click(screen.getByTestId("door-card-describe"))
  return revealKbSelect()
}

/** Reveal the picker's `select` from whichever arm is currently showing. */
async function revealKbSelect(): Promise<HTMLSelectElement> {
  const already = screen.queryByTestId("project-folder-picker")
  if (already) return already as HTMLSelectElement
  fireEvent.click(await screen.findByTestId("describe-kb-choose"))
  return (await screen.findByTestId("project-folder-picker")) as HTMLSelectElement
}

describe("WorkflowDoorSwitch — the describe door can bind a knowledge base (GAP A)", () => {
  it("renders a KB picker ON THE DESCRIBE DOOR — the control the operator probed for and did not find", async () => {
    const select = await openDescribeDoorWithFolders()
    // Inside the describe door, not somewhere else on the page.
    expect(screen.getByTestId("door-describe").contains(select)).toBe(true)
    // …offering the opt-out first and then the real folders.
    const options = Array.from(select.querySelectorAll("option"))
    expect(options[0].value).toBe("")
    expect(options.map((o) => o.value)).toContain(KB_POLICIES.id)
  })

  it("offers NOTHING when there are no folders — the door stays exactly as it ships", async () => {
    mockListFolders.mockResolvedValue([])
    render(<WorkflowDoorSwitch />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    await waitFor(() => expect(mockListFolders).toHaveBeenCalled())
    // ⚠ STILL NO SELECT AND STILL NO OPTION — the property this case guards is untouched.
    // What changed under sketch 200 is that the door now SAYS there are none instead of
    // rendering one silence for two different causes (see `DescribeKbPicker.test.tsx`).
    expect(screen.queryByTestId("project-folder-picker")).toBeNull()
    expect(screen.getByTestId("door-describe").querySelectorAll("option")).toHaveLength(0)
    // The describe box and the CTA are untouched by the picker's absence.
    expect(screen.getByTestId("describe-box")).toBeInTheDocument()
    expect(screen.getByTestId("describe-draft")).toBeInTheDocument()
  })
})

describe("WorkflowDoorSwitch — THE PICKER NEVER BLOCKS (the fast path keeps its promise)", () => {
  it("with NOTHING chosen the CTA is enabled by TEXT ALONE, and one click still hands off", async () => {
    const select = await openDescribeDoorWithFolders()

    const cta = screen.getByTestId("describe-draft")
    // Empty box ⇒ disabled, exactly as it ships. The picker did not change that rule.
    expect(cta).toBeDisabled()

    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "Summarise weekly vendor risk" },
    })
    // Text alone enables it — no knowledge base was chosen and none was asked for.
    expect(cta).toBeEnabled()
    expect(select.value).toBe("")

    fireEvent.click(cta)
    expect(screen.getByTestId("door-govern")).toBeInTheDocument()
  })

  it("choosing NOTHING sends NO project_folder_id key at all — absent, not undefined, not ''", async () => {
    await openDescribeDoorWithFolders()
    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "Summarise weekly vendor risk" },
    })
    fireEvent.click(screen.getByTestId("describe-draft"))

    await waitFor(() => expect(mockGenerateWorkflow).toHaveBeenCalled())
    const request = mockGenerateWorkflow.mock.calls[0][0] as Record<string, unknown>
    expect(request.describe).toBe("Summarise weekly vendor risk")
    // The shipped `...(projectFolderId ? … : {})` spread's own property: the KEY is absent.
    expect(Object.prototype.hasOwnProperty.call(request, "project_folder_id")).toBe(false)
  })
})

describe("WorkflowDoorSwitch — THE ROUND TRIP: a loose-door workflow can be born BOUND", () => {
  it("a folder chosen on the door reaches generateWorkflow's project_folder_id", async () => {
    const select = await openDescribeDoorWithFolders()

    fireEvent.change(select, { target: { value: KB_CONTRACTS.id } })
    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "Summarise weekly vendor risk" },
    })
    fireEvent.click(screen.getByTestId("describe-draft"))

    // Asserted on the REQUEST the client sends — the only thing the server sees.
    await waitFor(() =>
      expect(mockGenerateWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({
          describe: "Summarise weekly vendor risk",
          project_folder_id: KB_CONTRACTS.id,
        }),
      ),
    )
    const request = mockGenerateWorkflow.mock.calls[0][0] as Record<string, unknown>
    expect(request.project_folder_id).toBe(KB_CONTRACTS.id)
    // Never the NAME, which the wire would silently fail to bind.
    expect(request.project_folder_id).not.toBe(KB_CONTRACTS.name)
  })

  it("the choice SURVIVES a look around the chooser — a pick is not lost by curiosity", async () => {
    const select = await openDescribeDoorWithFolders()
    fireEvent.change(select, { target: { value: KB_POLICIES.id } })
    fireEvent.change(screen.getByTestId("describe-box"), { target: { value: "Look around first" } })

    // Back to the chooser and in again. The one-shot draft hand-off clears (today's
    // behaviour, unchanged); the folder choice does NOT. Pinned so it is CHOSEN rather
    // than inherited.
    fireEvent.click(screen.getByTestId("both-doors"))
    expect(screen.getByTestId("workflow-doors")).toBeInTheDocument()
    fireEvent.click(screen.getByTestId("door-card-describe"))

    // ⚠ THE PICK IS NOW VISIBLE WITHOUT OPENING ANYTHING — sketch 200's arm 2 NAMES the
    // chosen folder on the face of the door, where the shipped surface required reading a
    // `select`'s DOM property. That is a STRONGER reading of the same fact: the name is
    // resolved by looking the surviving id up in the freshly-fetched folder list, so a pick
    // that did not survive could not produce it.
    expect(await screen.findByTestId("describe-kb-chosen")).toHaveTextContent(KB_POLICIES.name)
    // …and it is the chosen arm, not the offer arm: nothing is being offered to re-pick.
    expect(screen.queryByTestId("describe-kb-choose")).toBeNull()
    // …and the returning trip did NOT re-fire the generate hand-off.
    expect(mockGenerateWorkflow).not.toHaveBeenCalled()
  })

  // ── CR-R5-01 — the fence that protects THE WIRE, not just the component ──
  //
  // The case above pins that a pick survives curiosity. Its shadow is the defect: a pick
  // that survives into a world where the folder is no longer offered would be SENT while
  // no control on screen could show it, and `POST /workflows/generate` mints
  // `unbound_retrieval` on `project_folder_id is None` — so a dead id suppresses the
  // verdict and unblocks Publish. These two assert on the REQUEST, which is the only
  // thing the server sees, and they are the reason the picker retracts.

  it("a pick whose folder is GONE on re-entry never reaches the wire", async () => {
    const select = await openDescribeDoorWithFolders()
    fireEvent.change(select, { target: { value: KB_POLICIES.id } })

    // Out and back in — and this time the server no longer offers that folder
    // (deleted, or scoped away by RLS between the two visits).
    fireEvent.click(screen.getByTestId("both-doors"))
    mockListFolders.mockResolvedValue([KB_CONTRACTS])
    fireEvent.click(screen.getByTestId("door-card-describe"))

    // The dead id is surrendered, so the door falls back to arm 1 (nothing chosen) and the
    // folder that vanished is named nowhere.
    await screen.findByTestId("describe-kb-choose")
    expect(screen.queryByTestId("describe-kb-chosen")).toBeNull()
    const again = await revealKbSelect()
    await waitFor(() => expect(again.value).toBe(""))

    fireEvent.change(screen.getByTestId("describe-box"), { target: { value: "Vendor risk" } })
    fireEvent.click(screen.getByTestId("describe-draft"))

    await waitFor(() => expect(mockGenerateWorkflow).toHaveBeenCalled())
    const request = mockGenerateWorkflow.mock.calls[0][0] as Record<string, unknown>
    expect(Object.prototype.hasOwnProperty.call(request, "project_folder_id")).toBe(false)
  })

  it("a pick survived into a FAILED re-fetch never reaches the wire either", async () => {
    const select = await openDescribeDoorWithFolders()
    fireEvent.change(select, { target: { value: KB_POLICIES.id } })

    // The harder half: the list could not be fetched at all, so NO picker renders and
    // the author has nothing on screen that could show or clear the binding.
    fireEvent.click(screen.getByTestId("both-doors"))
    mockListFolders.mockRejectedValue(new Error("network"))
    fireEvent.click(screen.getByTestId("door-card-describe"))

    await waitFor(() => expect(screen.queryByTestId("project-folder-picker")).toBeNull())

    fireEvent.change(screen.getByTestId("describe-box"), { target: { value: "Vendor risk" } })
    fireEvent.click(screen.getByTestId("describe-draft"))

    await waitFor(() => expect(mockGenerateWorkflow).toHaveBeenCalled())
    const request = mockGenerateWorkflow.mock.calls[0][0] as Record<string, unknown>
    expect(Object.prototype.hasOwnProperty.call(request, "project_folder_id")).toBe(false)
  })

  it("SOURCE: the door mounts the picker component and wires the id to the govern mount", () => {
    const src = workflowDoorSwitchSource
    expect(src).toMatch(/<DescribeKbPicker/)
    expect(src).toMatch(/import .*DescribeKbPicker/)
    expect(src).toMatch(/initialProjectFolderId=/)
    // Still no second folder source on the shell itself — the picker owns the request.
    expect(src).not.toMatch(/from ["']@\/lib\/api["']/)
    expect(src).not.toMatch(/listFolders/)
  })

  it("POSITIVE CONTROL — every source needle above matches a planted literal", () => {
    expect('<DescribeKbPicker value={x} onChange={y} />').toMatch(/<DescribeKbPicker/)
    expect('import { DescribeKbPicker } from "./DescribeKbPicker"').toMatch(/import .*DescribeKbPicker/)
    expect('<WorkflowBuilderPage initialProjectFolderId={kb} />').toMatch(/initialProjectFolderId=/)
    expect('import { listFolders } from "@/lib/api"').toMatch(/from ["']@\/lib\/api["']/)
    expect('const f = await listFolders()').toMatch(/listFolders/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════
// Phase 193-05 Task 3 (AUTH-01 · D-24(a) · T-193-17 / T-193-18) — THE COPY FENCE:
// NO GOVERNED DOOR WORD MAY SURVIVE AS A LITERAL OUTSIDE `doorVocabulary.ts`.
//
// APPENDED, never interleaved. Not one assertion above this line moves.
//
// ⚠ THIS FENCE SPELLS ZERO DOOR LITERALS, AND THAT IS THE WHOLE TRICK. A fence that must
// name 21 forbidden strings, written the obvious way, READS ITSELF and reds — the 187-24
// trap in its inverted form, met three times in this project already. So the needles are
// READ OFF THE MODULE AT RUNTIME (`runVocabulary.test.ts:110-118`'s idiom): nothing below
// is re-typed, the list re-derives itself when `193-08` swaps in column D, and a 22nd id is
// swept the moment it is exported.
//
// ⚠ IT SWEEPS THE **COMPONENTS**, NEVER A TEST FILE. `doorVocabulary.test.ts` legitimately
// spells values — that is its falsification property — so a sweep that reached it would be
// forbidding the one file allowed to speak. The exclusion is asserted, not merely intended
// (`librarySubtree.fences.test.ts:186-188`).
//
// ⚠ BOTH SPELLINGS, because the two homes disagree by construction: JSX writes
// `&amp;` where a TypeScript string writes `&`. A sweep for the plain form alone would miss
// a re-typed literal in JSX — which is precisely the shape a future edit would take.
//
// ⚠ AND IT IS A **RAW** SWEEP, PROSE INCLUDED, ON PURPOSE. The alternative was the AST form
// (`librarySubtree.fences.test.ts` F1, which parses so comments are excluded by
// construction). It was measured and rejected: a docblock quoting a governed word is ALSO a
// second home for it — it will read FALSE the moment `193-08` lands column D — so catching
// prose is the fence working, not the fence misfiring. Both components were cleaned of such
// quotes in the 193-05 rewire (they now name words by IDENTIFIER), which is what makes the
// raw form achievable at zero hits. If a future author needs to discuss a door word in a
// comment there, the answer is to name its identifier, never to weaken this sweep.
// ══════════════════════════════════════════════════════════════════════════════════

/**
 * The component sources this fence is about. Paths are labels for the failure message.
 *
 * ⚠ **THE THIRD ENTRY IS THE WHOLE POINT, AND IT WAS ADDED LATE — 193 REVIEW WR-01.**
 * This list held exactly TWO files while `WorkflowBuilderPage.tsx` sat outside it holding a
 * SECOND, ungoverned copy of five governed ids. That gap is Phase 193's own headline defect
 * (fixed in `294a2ac8`), and the fence could not have caught it, because **a fence cannot see a
 * file that is not in its list** — the same structural blindness that let `WorkflowsPage.tsx`
 * escape G-5 for ten consecutive phases. Re-typing `"Write the first draft"` onto the page
 * would have reproduced the defect with this suite green.
 *
 * So: **any file that imports from `doorVocabulary` belongs here.** Adding the import without
 * adding the entry re-opens the exact hole this list exists to close.
 *
 * ⚠ **AND SO DOES ANY NEW MODULE ON THIS SURFACE, WHETHER OR NOT IT IMPORTS `doorVocabulary`
 * YET — which is what the FOURTH entry is (193.1-05, D-14).** `useTemplateFirstDraft.ts` is the
 * pre-draft describe→generate concern, cut off the Builder page under G-5; it imports NOTHING
 * from `doorVocabulary` today, and it is swept anyway. Two reasons, both measured rather than
 * cautious:
 *
 *   1. **The sweep is RAW, so prose counts.** That module's docblocks discuss the CTA and the
 *      describe screen at length. Naming one of those words instead of `DESCRIBE_CTA` would
 *      put a second home for a governed string one directory away from the module that owns
 *      them — the same defect as a re-typed JSX literal, in a comment.
 *   2. **WR-01 proved the list is the fence.** The entry above this one was added LATE, after
 *      a file had quietly become a third consumer while sitting outside the sweep. Waiting for
 *      the import to appear is exactly the policy that produced that gap, and a module created
 *      in the same phase that widens this list is the cheapest possible moment to close it.
 *
 * The entry was driven RED against a real planted literal in that file before being trusted.
 *
 * ⚠ **THE FIFTH AND SIXTH ENTRIES (193.1-06, D-14), AND THE SIXTH IS A CORRECTION TO THE PLAN
 * THAT COMMISSIONED IT — STATED HERE RATHER THAN SMOOTHED.** `193.1-06`'s acceptance criterion
 * says this list goes to FIVE: the plan counted `DescribeTemplateRow.tsx` and did not count
 * `templateFirstVocabulary.ts`, which the same plan creates in the same wave. Measured against
 * the rule two paragraphs up — *any new module on this surface, whether or not it imports
 * `doorVocabulary` yet* — that leaves the HIGHER-RISK of the two files outside the sweep:
 *
 *   • `DescribeTemplateRow.tsx` is a genuine consumer (it renders the 22nd governed id) and
 *     joins under the WR-01 rule with nothing to argue about.
 *   • `templateFirstVocabulary.ts` is a VOCABULARY MODULE — the single most likely place in
 *     this repository for a governed sentence to be re-typed, because re-typing strings is
 *     literally what the file is for. A copy fence that sweeps the component rendering the
 *     words and skips the module DECLARING them is the WR-01 shape exactly: the fence swept
 *     the files someone thought of, and the defect landed in the one they did not.
 *
 * Going to six is therefore a STRENGTHENING of the plan's stated criterion, never a departure
 * from its intent, and both new entries were driven RED against a real planted literal in
 * their own file before being trusted. Six is the honest count and the count is asserted below.
 */
const SWEPT_SOURCES: { path: string; source: string }[] = [
  { path: "./WorkflowDoorSwitch.tsx", source: workflowDoorSwitchSource },
  { path: "./DoorHeaderStrip.tsx", source: doorHeaderStripSource },
  { path: "@/pages/WorkflowBuilderPage.tsx", source: builderPageSource },
  { path: "./useTemplateFirstDraft.ts", source: templateFirstDraftSource },
  { path: "./DescribeTemplateRow.tsx", source: describeTemplateRowSource },
  { path: "./templateFirstVocabulary.ts", source: templateFirstVocabularySource },
]

/**
 * Every governed word in BOTH spellings, derived from the module. `escaped` is omitted when
 * it is identical to `plain` (no ampersand in that value), so the needle count is honest
 * rather than padded.
 */
const NEEDLES: { id: string; spelling: "plain" | "escaped"; text: string }[] = Object.entries(
  doorVocabulary,
).flatMap(([id, value]) => {
  // ⚠ A COMPOSED entry is a FUNCTION, not a string, and this sweep is about governed
  // WORDS in source. Phase 214-03 added three composed ids to this module and the old
  // `value as string` then called .replace on them, which threw at module scope and took the
  // WHOLE suite (44 cases) to zero runs — a count-gate decrease, not a visible failure.
  // Skipping non-strings keeps the needle set honest: a template has no fixed literal to
  // sweep for, so it contributes no needle rather than a wrong one.
  if (typeof value !== "string") return []
  const plain = value
  const escaped = plain.replace(/&/g, "&amp;")
  const rows: { id: string; spelling: "plain" | "escaped"; text: string }[] = [
    { id, spelling: "plain", text: plain },
  ]
  if (escaped !== plain) rows.push({ id, spelling: "escaped", text: escaped })
  return rows
})

/** Which needles a source carries, labelled so a failure NAMES the string it found. */
const hitsIn = (source: string): string[] =>
  NEEDLES.filter((n) => source.includes(n.text)).map((n) => `${n.id}/${n.spelling}`)

describe("D-24(a) — SCOPE: could this fence fire at all? (T-193-18, the 192.1 E-2 lesson)", () => {
  it("all six swept sources really loaded, and every needle is a real non-empty string", () => {
    // NON-VACUITY FIRST, BEFORE ANY NEGATIVE. A `?raw` import of a moved or renamed module
    // yields the EMPTY STRING in some resolvers rather than throwing, and `"".includes(x)` is
    // false for every x — so the whole fence would pass green while defending nothing. This
    // is the exact defect `/gsd:secure-phase 192.1` found: a fence swept against the empty
    // string, with the property holding and NOTHING guarding it.
    // 193.1-05 (D-14): 3 → 4. 193.1-06 (D-14): 4 → 6. Bumped DELIBERATELY, in the same commit
    // as the entries — a count that moved on its own is a list nobody checked.
    expect(SWEPT_SOURCES).toHaveLength(6)
    for (const { path, source } of SWEPT_SOURCES) {
      // ⚠ The 1000-CHARACTER FLOOR IS A REAL CONSTRAINT ON A NEW ENTRY, and it was MEASURED
      // before the fourth was added rather than assumed: `wc -c useTemplateFirstDraft.ts` →
      // 14062. A thin module would red here, and the answer would be to say so, never to
      // quietly lower the floor. Measured again before the fifth and sixth:
      // `DescribeTemplateRow.tsx` → 13323, `templateFirstVocabulary.ts` → 10508. Both clear it
      // comfortably, and both are dominated by the docblocks recording WHY each string is the
      // string it is — which is the same prose the RAW sweep below reads.
      expect(source.length, `${path} did not load`).toBeGreaterThan(1000)
    }
    // …and the needle list covers every governed id, so a partially-populated namespace
    // cannot shrink the sweep silently. 193.1-06 (D-21 / D-28): 21 → 22, moved in the SAME
    // COMMIT as `GOVERNED_ID_COUNT` in `doorVocabulary.test.ts`, since the two numbers are the
    // same fact read from two files.
    // 199-08 (DES-01): 22 → 23, again in the SAME COMMIT as `GOVERNED_ID_COUNT` in
    // `doorVocabulary.test.ts` — the two numbers are one fact read from two files, and a count
    // that moved on its own is a table nobody checked.
    // Sketch 200: 23 → 24 (`DESCRIBE_CTA_REFUSED`), same commit, same rule, third time.
    // Sketch 217 (214-03): 24 → 36 — twelve flat ids added at once. ⚠ FOURTH TIME, AND THE
    // FIRST TIME THE TWO NUMBERS MOVED IN DIFFERENT COMMITS: `GOVERNED_ID_COUNT` went to 36
    // in `doorVocabulary.test.ts`, this half did not, and the arithmetic 24 + 12 = 36 is what
    // proves the gap is the twelve additions rather than an unexplained drift. The three
    // COMPOSED ids added in the same commit contribute 0 needles by construction — a function
    // has no fixed literal to sweep for — so 36 is flat ids only, and `COMPOSED_ID_COUNT` is
    // the sibling suite’s to hold.
    expect(new Set(NEEDLES.map((n) => n.id)).size).toBe(36)
    for (const n of NEEDLES) expect(n.text.length, `${n.id}/${n.spelling} is empty`).toBeGreaterThan(0)
    // …and the SECOND spelling is not a no-op: at least one id really differs between the
    // two, which is the only thing that makes sweeping twice worth the line.
    expect(NEEDLES.filter((n) => n.spelling === "escaped").length).toBeGreaterThan(0)
  })

  it("sweeps NO test file — the one home allowed to spell these values is left alone", () => {
    expect(SWEPT_SOURCES.filter((f) => /\.test\.tsx?$/.test(f.path))).toEqual([])
  })

  it("POSITIVE CONTROL — a planted literal IS caught, in both spellings", () => {
    // A synthetic source, built from the module so this file still spells nothing. Without
    // this, a broken `hitsIn` reads exactly like a fence that holds.
    const plain = NEEDLES.find((n) => n.spelling === "plain")!
    const escaped = NEEDLES.find((n) => n.spelling === "escaped")!
    expect(hitsIn(`const x = <span>${plain.text}</span>`)).toContain(`${plain.id}/plain`)
    expect(hitsIn(`const x = <span>${escaped.text}</span>`)).toContain(`${escaped.id}/escaped`)
    // …and a source with none of them is clean, so the detector is not simply always-true.
    expect(hitsIn("const x = <span>{SOME_IDENTIFIER}</span>")).toEqual([])
  })
})

describe("D-24(a) — no governed door word survives as a literal in any swept module", () => {
  it.each(SWEPT_SOURCES.map((f) => [f.path, f.source] as const))(
    "%s carries none of the 24 governed words, in either spelling",
    (_path, source) => {
      expect(hitsIn(source)).toEqual([])
    },
  )
})

// ══════════════════════════════════════════════════════════════════════════════════════
// 193-09 (D-22) — THE TWO DOORS AGREE ABOUT THEIR OWN ESCAPE HATCH
//
// D-04 demoted the govern strip's return control: the box and the 1px outline went, so the
// escape stops reading as a peer of the door you are standing in. D-22 extends the DEMOTION —
// and only the demotion — to this shell's describe band, because demoting one door's escape
// and not the other's manufactures a NEW inconsistency one click apart.
//
// "Identical" is the claim, and the only honest way to hold it is to READ BOTH CLASS STRINGS
// OUT OF THE TWO SOURCES and compare them. By eye is how two literals drift; a third literal
// written here would be a third home for the same fact and would go stale silently.
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * The `both-doors` control's class string, as DECLARED in a component source.
 *
 * Anchored on the testid and non-greedy to the next `className`, which in both files is two
 * attributes later. It is a source-shape read, deliberately: the two controls live in two
 * different components that never render together, so no single DOM can compare them.
 */
const RETURN_CONTROL_CLASS = /data-testid="both-doors"[\s\S]*?className="([^"]+)"/

const returnControlClassOf = (source: string, where: string): string => {
  const m = RETURN_CONTROL_CLASS.exec(source)
  if (!m) throw new Error(`${where} no longer declares a both-doors control with a className`)
  return m[1]
}

describe("193-09 (D-22) — both doors demote their escape hatch identically", () => {
  it("the extractor really extracts, both sources are really loaded, and each declares ONE control", () => {
    // POSITIVE CONTROL, inline and first: an extractor that silently returned "" would make
    // every equality below pass while comparing nothing (the 192.1 E-2 lesson).
    expect(
      returnControlClassOf(
        '<button type="button" data-testid="both-doors" onClick={x} className="a b c">',
        "synthetic",
      ),
    ).toBe("a b c")
    // …and a source WITHOUT the control throws rather than returning a silent empty string.
    expect(() =>
      returnControlClassOf('<button data-testid="something-else" className="z">', "synthetic"),
    ).toThrow(/no longer declares/)

    // NON-VACUITY on the two real subjects: a `?raw` import of a moved or renamed module yields
    // the empty string in some resolvers rather than throwing.
    expect(doorHeaderStripSource.length).toBeGreaterThan(500)
    expect(workflowDoorSwitchSource.length).toBeGreaterThan(500)

    // EXACTLY ONE control per source, so the non-greedy match cannot be reading across a second
    // one into a neighbour's class list — which is precisely how this kind of fence starts
    // measuring the wrong element without anybody noticing.
    expect(doorHeaderStripSource.split('data-testid="both-doors"')).toHaveLength(2)
    expect(workflowDoorSwitchSource.split('data-testid="both-doors"')).toHaveLength(2)
  })

  it("the two return-control class strings are EQUAL, character for character", () => {
    const govern = returnControlClassOf(doorHeaderStripSource, "DoorHeaderStrip.tsx")
    const describeDoor = returnControlClassOf(workflowDoorSwitchSource, "WorkflowDoorSwitch.tsx")
    expect(describeDoor).toBe(govern)

    // …and BOTH are really demoted. Without this the equality is also satisfied by two
    // identical BOXES agreeing with each other, which is the state D-22 exists to end.
    for (const cls of [govern, describeDoor]) {
      const tokens = cls.split(" ")
      expect(tokens).not.toContain("border")
      expect(tokens).not.toContain("border-border")
      expect(tokens).not.toContain("rounded-md")
      // POSITIVE half of the same pair — the string is a real class list, not an empty one.
      expect(tokens).toContain("text-muted-foreground")
    }
  })

  it("the describe band carries NO divider — there is nothing on that side to divide", () => {
    // D-22 is explicit: the demotion is the box drop and the muted treatment, NOTHING else. No
    // locked-judge badge lives on this door, so a rule here would be a mark dividing one thing
    // from nothing.
    render(<WorkflowDoorSwitch def={strictDef} initialDoor="describe" />)
    const band = screen.getByTestId("door-describe").firstElementChild as HTMLElement
    const kids = Array.from(band.children)
    // LENGTH FIRST — [return control] [door label], and nothing between them.
    expect(kids).toHaveLength(2)
    expect(kids[0].getAttribute("data-testid")).toBe("both-doors")
    expect(kids[1].tagName).toBe("SPAN")
    expect(kids[1].textContent!.length).toBeGreaterThan(0)
    // No rule node by class, and no decorative node by role — a divider would be both.
    expect(band.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0)
    for (const n of kids) {
      expect(n.className.split(" ")).not.toContain("w-px")
    }
  })

  it("POSITIVE CONTROL — the SAME two queries DO find the divider on the govern door", () => {
    // Without this, the row above passes on a broken band lookup: an element that was never
    // found has no `aria-hidden` children and no `w-px` token either. The govern band is the
    // one place in this shell that legitimately carries a rule, so it is the honest control.
    render(<WorkflowDoorSwitch def={strictDef} initialDoor="govern" />)
    const band = screen.getByTestId("door-govern").firstElementChild as HTMLElement
    expect(band.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0)
    const rules = Array.from(band.children).filter((n) => n.className.split(" ").includes("w-px"))
    expect(rules).toHaveLength(1)
    expect(rules[0].getAttribute("aria-hidden")).toBe("true")
  })

  it("the describe band was NOT folded into the extracted govern strip — a deliberate non-action", () => {
    // D-05's constraint is one component for the two GOVERN header variants. This band is a
    // different band, with no badge and its own host-lead slot, so folding it in would be a
    // structural change with neither a decision nor a mockup behind it. Recorded as an
    // assertion so the absence reads as a choice rather than as an oversight — and so a later
    // author who folds it must delete this row and say why.
    // The region is bounded BY CONTENT — the describe door's root to the describe box that
    // follows its band — never by a character count. A fixed window silently starts measuring
    // the wrong span the first time anybody writes a paragraph inside it (measured: it did,
    // while this very case was being written).
    const bandStart = workflowDoorSwitchSource.indexOf('data-testid="door-describe"')
    const bandEnd = workflowDoorSwitchSource.indexOf('data-testid="describe-box"')
    expect(bandStart).toBeGreaterThan(-1)
    expect(bandEnd).toBeGreaterThan(bandStart)
    const bandRegion = workflowDoorSwitchSource.slice(bandStart, bandEnd)
    expect(bandRegion).toContain('data-testid="both-doors"')
    expect(bandRegion).not.toContain("<DoorHeaderStrip")
    // POSITIVE CONTROL: the component IS mounted elsewhere in this file, so the negative above
    // is about WHERE it is used and not about a component nobody imports.
    expect(workflowDoorSwitchSource).toContain("<DoorHeaderStrip")
  })
})

// ══════════════════════════════════════════════════════════════════════════════════
// Phase 193.1-08 (D-24 / SC#1 / SC#4 / D-07) — THE PRE-DRAFT ATTACH ROW ON **THIS
// FILE'S** DESCRIBE DOOR, AND THE READING THAT CROSSES THE HAND-OFF.
//
// ⚠ EVERY CASE NAMES THIS FILE IN ITS TITLE AND ASSERTS A NODE ONLY THIS SURFACE HAS.
// There are two near-identical pre-draft describe screens and the splice anchor
// `<div className="flex flex-col items-center gap-3">` occurs in BOTH of them — it was
// unique only inside sketch 165's DUMP, which is all its build script ever asserted. A
// case that said "the row is on the describe screen" would pass against the wrong
// component. `switch-strip` exists in `WorkflowDoorSwitch.tsx` and nowhere else, so it
// is the discriminator; `door-describe` is the second.
// ══════════════════════════════════════════════════════════════════════════════════

/** A held document, in the shape the row's native picker hands over. */
function docxFile(name = "weekly-status.docx"): File {
  return new File(["PK"], name, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  })
}

/** Open the loose door and pick a document through the row's own input. */
function openDescribeAndPick(file: File) {
  fireEvent.click(screen.getByTestId("door-card-describe"))
  fireEvent.change(screen.getByTestId("describe-template-input"), { target: { files: [file] } })
}

describe("WorkflowDoorSwitch.tsx — the pre-draft attach row on the LOOSE door", () => {
  it("WorkflowDoorSwitch.tsx: the row renders on THIS door, between its KB picker and its CTA group", () => {
    render(<WorkflowDoorSwitch def={strictDef} initialDoor="describe" />)

    // The surface, first — this is the door switch's screen and not the Builder's.
    expect(screen.getByTestId("switch-strip")).toBeInTheDocument()
    expect(screen.getByTestId("door-describe")).toBeInTheDocument()

    const row = screen.getByTestId("describe-template-row")
    const cta = screen.getByTestId("describe-draft")
    const ctaGroup = cta.parentElement!
    // OUTSIDE the CTA group — the sketch's own splice puts the block BEFORE it, never in it.
    expect(ctaGroup.contains(row)).toBe(false)
    // …and in document order: KB picker, then the row, then the CTA group.
    const column = row.parentElement!
    const order = Array.from(column.children).map((n) => n.getAttribute("data-testid"))
    const iRow = order.indexOf("describe-template-row")
    expect(iRow).toBeGreaterThan(-1)
    // The picker's own state marker is this door's KB control (`DescribeKbPicker`), and it
    // sits ABOVE the row exactly as the govern door's `<select>` does above its own mount.
    expect(order.indexOf("describe-kb-state")).toBeLessThan(iRow)
    expect(order.indexOf("switch-strip")).toBeGreaterThan(iRow)
  })

  it("WorkflowDoorSwitch.tsx: SC#4 — with no document held the door is exactly as it was", () => {
    render(<WorkflowDoorSwitch def={strictDef} initialDoor="describe" />)

    // The reading is `idle`, so no reading block, no footing, no clear control…
    expect(screen.queryByTestId("describe-template-fields-region")).toBeNull()
    expect(screen.queryByTestId("describe-template-footing")).toBeNull()
    // …and NOT ONE request. D-08 is the absence of a read, not a read that answers quickly.
    expect(mockReadPlaceholders).toHaveBeenCalledTimes(0)

    // The shipped CTA rule is untouched: empty box disabled, typed box enabled.
    expect(screen.getByTestId("describe-draft")).toBeDisabled()
    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "Summarise supplier risk every Monday." },
    })
    expect(screen.getByTestId("describe-draft")).toBeEnabled()
  })

  it("WorkflowDoorSwitch.tsx: the CTA is DISABLED while the read is in flight — the hand-off cannot fire mid-read (D-07)", async () => {
    // A read that never settles, so the in-flight arm is observed rather than raced.
    mockReadPlaceholders.mockImplementation(() => new Promise(() => {}))
    render(<WorkflowDoorSwitch def={strictDef} initialDoor="describe" />)

    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "Summarise supplier risk every Monday." },
    })
    // Enabled on text alone FIRST, so the disable below is attributable to the read.
    expect(screen.getByTestId("describe-draft")).toBeEnabled()

    fireEvent.change(screen.getByTestId("describe-template-input"), {
      target: { files: [docxFile()] },
    })

    await waitFor(() => expect(mockReadPlaceholders).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId("describe-draft")).toBeDisabled())
    // ⚠ THIS DOOR'S CTA MAKES NO NETWORK CALL — it hands off and arms the Builder's one-shot.
    // So the proof that the blind draft is impossible is that we are still on this door and
    // the Builder was never mounted, rather than that `/generate` was not called.
    expect(screen.getByTestId("door-describe")).toBeInTheDocument()
    expect(screen.queryByTestId("door-govern")).toBeNull()
    expect(mockGenerateWorkflow).toHaveBeenCalledTimes(0)
  })

  it("WorkflowDoorSwitch.tsx: the reading CROSSES the hand-off — ZERO further reads, and the first `/generate` carries the fields", async () => {
    /**
     * ⚠ THE ZERO IS THE ASSERTION, not a nicety. The Builder auto-fires `onDraft()` ONCE on
     * hand-off; if it re-read the document its reading would be `loading` at that instant and
     * the fields would be missing from the only `/generate` call the fast path ever makes —
     * a blind draft arriving through the door the row was supposed to close. The seed is what
     * makes that unreachable, and this case measures the seed rather than trusting it.
     */
    mockReadPlaceholders.mockResolvedValue({
      read: "ok",
      placeholders: ["project_name", "overall_rag_status"],
    })
    render(<WorkflowDoorSwitch def={strictDef} onDescribeDraft={vi.fn()} />)

    openDescribeAndPick(docxFile())
    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "Summarise supplier risk every Monday." },
    })
    await screen.findByTestId("describe-template-fields")
    expect(mockReadPlaceholders).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByTestId("describe-draft"))

    // The Builder mounted and its one-shot fired.
    await waitFor(() => expect(mockGenerateWorkflow).toHaveBeenCalledTimes(1))
    // ⚠ STILL ONE. The Builder SEEDED its reading; it did not re-read.
    expect(mockReadPlaceholders).toHaveBeenCalledTimes(1)
    // …and the very first body carries the fields of the document the author supplied on
    // the OTHER screen, which is the whole of D-24's crossing.
    expect(mockGenerateWorkflow.mock.calls[0][0]).toMatchObject({
      template_placeholders: ["project_name", "overall_rag_status"],
    })
  })

  it("WorkflowDoorSwitch.tsx: with NO document the hand-off is byte-identical to today — no key, no read", async () => {
    render(<WorkflowDoorSwitch def={strictDef} onDescribeDraft={vi.fn()} />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "Summarise supplier risk every Monday." },
    })
    fireEvent.click(screen.getByTestId("describe-draft"))

    await waitFor(() => expect(mockGenerateWorkflow).toHaveBeenCalledTimes(1))
    expect(mockReadPlaceholders).toHaveBeenCalledTimes(0)
    // The KEY SET, not merely the absence of a value: `template_placeholders: undefined`
    // would satisfy a `toBeUndefined` and would still be a changed body on the wire.
    expect(Object.keys(mockGenerateWorkflow.mock.calls[0][0]).sort()).toEqual(["describe"])
  })

  it("WorkflowDoorSwitch.tsx: the two crossing props are genuinely ABSENT when nothing is supplied — a spread-conditional, not a default", () => {
    /**
     * The shape, asserted at the source. `initialTemplateFile={x}` with `x` undefined would
     * satisfy every behavioural case above and would still hand the Builder a present key —
     * the exact distinction the `headerLead` / `headerTrail` idiom in this file exists for.
     */
    const i = workflowDoorSwitchSource.indexOf("initialTemplateFile")
    expect(i).toBeGreaterThan(-1)
    // The occurrence sits inside a spread-conditional…
    const window = workflowDoorSwitchSource.slice(Math.max(0, i - 200), i + 200)
    expect(window).toMatch(/\{\.\.\.\(\s*templateAnswer/)
    // …and there is no bare always-present form of either prop anywhere in the file.
    expect(workflowDoorSwitchSource).not.toMatch(/\n\s*initialTemplateFile=\{/)
    expect(workflowDoorSwitchSource).not.toMatch(/\n\s*initialTemplateRead=\{/)
    // POSITIVE CONTROL — the needle above really does find that shape when it exists.
    expect(`\n            initialTemplateFile={templateFile}`).toMatch(
      /\n\s*initialTemplateFile=\{/,
    )
  })

  it("WorkflowDoorSwitch.tsx: `goBoth` does NOT drop the held document — the shipped `kbFolderId` rule, followed", async () => {
    /**
     * `kbFolderId` is deliberately not cleared by `goBoth` (`WorkflowDoorSwitch.tsx:160-166`):
     * the hand-off is a one-shot and must not re-fire, but a considered pick is not undone by
     * looking around. The held document follows that rule rather than acquiring a second one.
     */
    mockReadPlaceholders.mockResolvedValue({ read: "ok", placeholders: ["project_name"] })
    render(<WorkflowDoorSwitch def={strictDef} initialDoor="describe" />)

    fireEvent.change(screen.getByTestId("describe-template-input"), {
      target: { files: [docxFile()] },
    })
    await screen.findByTestId("describe-template-fields")

    // Back to the chooser and in again.
    fireEvent.click(screen.getByTestId("both-doors"))
    expect(screen.getByTestId("workflow-doors")).toBeInTheDocument()
    fireEvent.click(screen.getByTestId("door-card-describe"))

    // Still held, still answered, and NOT re-read.
    expect(screen.getByTestId("describe-template-filename")).toHaveTextContent("weekly-status.docx")
    expect(within(screen.getByTestId("describe-template-fields")).getByText("project_name")).toBeInTheDocument()
    expect(mockReadPlaceholders).toHaveBeenCalledTimes(1)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// Phase 199-08 Task 1 (DES-01 · sheet `c9-doors-describe`) — THE PRE-CHANGE RESTING
// INVENTORY, AND THE MECHANICAL HALF OF THE RECONCILIATION.
//
// APPENDED, never interleaved. Not one assertion above this line moves.
//
// WHY AN INVENTORY AT ALL. This phase re-presents; it does not add. The only way to prove
// "renders no MORE at rest than before" after the fact is to have written down what `before`
// was, as LITERALS, in a commit that predates the change (the 188.1 lesson, re-used by
// `199-03`). A subtraction is then proved by INVERTING one of these assertions from present
// to absent — never by deleting it. Zero assertion deletions is the target for this plan.
//
// ⚠ THIS FILE IS ALLOWED TO SPELL GOVERNED DOOR WORDS AND THE COMPONENTS ARE NOT. The
// D-24(a) copy fence above asserts its own exclusion of test files; that exclusion is what
// makes an inventory pinned as LITERALS possible at all. A pin that named identifiers would
// re-derive itself from the module and could never falsify a reword.
// ══════════════════════════════════════════════════════════════════════════════════════

const nodeFs199 = await vi.importActual<{ readFileSync(path: string, encoding: string): string }>(
  "node:fs",
)

/** `file:///C:/…/frontend/src/components/workflows/<this file>` → `…/frontend/`. */
const FRONTEND_ROOT_199 = (() => {
  const here = decodeURIComponent(import.meta.url).replace(/^file:\/\/\/?/, "")
  const marker = "/src/components/workflows/"
  const at = here.indexOf(marker)
  if (at === -1) throw new Error(`199-08 inventory cannot locate its own subtree in: ${here}`)
  return `${here.slice(0, at)}/`
})()

const tailwindConfigSource199 = nodeFs199.readFileSync(
  `${FRONTEND_ROOT_199}tailwind.config.js`,
  "utf8",
)

/** The chooser's resting atoms, spelled out. */
const CHOOSER_ATOMS_199 = [
  "How do you want to start?",
  "Both end up in the same place. You can switch between them at any time.",
  "you write one paragraph",
  "Draft it for me",
  "you can open the full editor at any point — nothing is locked in",
  "you decide every setting",
  "Build it myself",
  "what it must cite · required checks · per-step sources & model",
]

/** The describe door's resting atoms, spelled out. */
const DESCRIBE_ATOMS_199 = [
  "‹ Change how I start",
  "⚡ Drafting it for you",
  "What recurring work should this automate?",
  "Write the first draft",
  "Need to set citations, checks, or per-step sources yourself?",
  "Build it myself ›",
  "What this will do",
  "Have a document to fill in?",
  "Attach a template",
  "Word, PowerPoint or Excel — .docx, .pptx or .xlsx, up to 10 MB.",
]

describe("199-08 Task 1 — the RESTING inventory of the door surface (pinned PRESENT)", () => {
  it("the chooser's eight resting atoms are all on screen, as literals", () => {
    render(<WorkflowDoorSwitch />)
    // NON-VACUITY FIRST: the chooser really rendered, so the `getByText` list below is a claim
    // about a surface rather than a claim about an empty container.
    expect(screen.getByTestId("workflow-doors")).toBeInTheDocument()
    expect(CHOOSER_ATOMS_199).toHaveLength(8)
    for (const atom of CHOOSER_ATOMS_199) {
      expect(screen.getByText(atom), `chooser atom missing: ${atom}`).toBeInTheDocument()
    }
  })

  it("the describe door's ten resting atoms are all on screen, as literals", async () => {
    render(<WorkflowDoorSwitch />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    expect(screen.getByTestId("door-describe")).toBeInTheDocument()
    await waitFor(() => expect(mockListFolders).toHaveBeenCalled())
    expect(DESCRIBE_ATOMS_199).toHaveLength(10)
    for (const atom of DESCRIBE_ATOMS_199) {
      expect(screen.getByText(atom), `describe atom missing: ${atom}`).toBeInTheDocument()
    }
  })

  it("the describe door's resting CONTROL set is exactly these five testids — no more", async () => {
    render(<WorkflowDoorSwitch />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    await waitFor(() => expect(mockListFolders).toHaveBeenCalled())
    const door = screen.getByTestId("door-describe")
    const controls = Array.from(
      door.querySelectorAll("button, input, textarea, select, a[href]"),
    ).map((n) => n.getAttribute("data-testid"))
    /**
     * ⚠ THE SET IS UNCHANGED — STILL EXACTLY FIVE, AND STILL THE SAME FIVE. Only the ORDER
     * moved, and it moved because sketch 200 puts the draft control inside the describe box's
     * own section (right-aligned under the textarea) and the template question in a labelled
     * section of its own further down the column. The original expectation is kept here so the
     * move is legible rather than absorbed:
     *
     *     both-doors · describe-box · describe-template-input · describe-draft · switch-to-govern
     *
     * ⚠ AND THE COUNT IS THE PART THAT GUARDS SOMETHING. The picker adds no sixth control on
     * this render: with no folders offered it renders arm 3, whose way-out is gated on an
     * `onUploadDocuments` this mount does not supply, so the door gains a SENTENCE and not a
     * control. That is asserted directly below rather than left implied by the list.
     *
     * ── ⚠ RE-BASELINED BY 200-WIRE — FIVE BECOMES SIX, AND THE ADDITION IS DELIBERATE ────
     *
     * The original list is kept VERBATIM above (both its shipped order and the pre-200 one),
     * because a re-baseline that overwrites what it replaced destroys the only evidence of
     * what the surface used to be. What changed:
     *
     *     + starter-door-trigger        ← the SIXTH control
     *
     * ⚠ IT IS A MOUNT, NOT A NEW CONTROL. `doors.html:307-319` draws a starter shelf on this
     * door and the port silently omitted it — not as one of its seven recorded refusals, but
     * by mapping the sheet's `<!-- Template Row -->` section onto the shipped attach-a-document
     * row and rendering neither of the two things it actually needed. `StarterTemplatePicker`
     * has shipped since 187-14 and was already mounted on the GOVERN door; this door, which is
     * the fast path most authors land on, had zero mounts of it.
     *
     * ⚠ THE PROPERTY THE COUNT GUARDED IS UNCHANGED AND STILL ASSERTED. The paragraph above
     * says the count exists to prove the KB picker's empty arm adds no control — that claim is
     * about `describe-kb-upload`, and its own assertion is directly below, byte-untouched and
     * still passing. Six is not five-plus-drift: it is five plus one named, sourced control,
     * and the KB assertion is what makes that distinction machine-checkable rather than
     * rhetorical. ⚠ `describe-kb-upload` REMAINS ABSENT ON PURPOSE — 200-WIRE measured that
     * the app has NO navigation seam reachable from this component (no router, and
     * `WorkflowsPage` is handed no `onNavigate`), so supplying a destination would mean
     * threading a new prop through four files. That is plumbing, not wiring, and it was
     * declined rather than faked.
     */
    expect(controls).toEqual([
      "both-doors",
      "describe-box",
      "describe-draft",
      "describe-template-input",
      "starter-door-trigger",
      "switch-to-govern",
    ])
    expect(controls).toHaveLength(6)
    expect(screen.queryByTestId("describe-kb-upload")).toBeNull()
  })
})

describe("199-08 Task 1 — THE REFUSAL ROW: does a gating predicate already exist?", () => {
  it("IT DOES — the CTA is gated on trimmed length in SOURCE, so saying so out loud is presentation", () => {
    // The shipped rule, read off the component rather than inferred from behaviour alone.
    expect(workflowDoorSwitchSource).toContain("describe.trim().length > 0")
    // POSITIVE CONTROL — the source really loaded, so the `toContain` is not passing on air.
    expect(workflowDoorSwitchSource.length).toBeGreaterThan(1000)
  })

  it("…and the predicate BEHAVES: empty refuses, whitespace-only refuses, real text passes", async () => {
    render(<WorkflowDoorSwitch />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    await waitFor(() => expect(mockListFolders).toHaveBeenCalled())
    const box = screen.getByTestId("describe-box")
    const cta = screen.getByTestId("describe-draft")

    expect(cta).toBeDisabled()
    fireEvent.change(box, { target: { value: "   \n\t  " } })
    expect(cta).toBeDisabled()
    fireEvent.change(box, { target: { value: "Summarise weekly vendor risk" } })
    expect(cta).toBeEnabled()
  })

  it("⚠ IT NO LONGER REFUSES IN SILENCE — the sentence is THERE (INVERTED by Task 2, not deleted)", async () => {
    render(<WorkflowDoorSwitch />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    await waitFor(() => expect(mockListFolders).toHaveBeenCalled())
    fireEvent.change(screen.getByTestId("describe-box"), { target: { value: "   " } })
    // NON-VACUITY: the refusing state really is on screen and really is refusing.
    expect(screen.getByTestId("describe-draft")).toBeDisabled()
    // ⚠ THE INVERSION. Task 1 committed this same query asserting `toBeNull()` one commit
    // earlier; the POLARITY moved and the query did not. That is what makes this a proof of
    // the change rather than a description of it.
    expect(screen.getByTestId("describe-refusal")).toBeInTheDocument()
  })

  it("the SECOND gating term already speaks for itself — an in-flight read says so out loud", () => {
    // `templateRead.kind !== "loading"` is the other half of `canDraft`, and the row it comes
    // from renders a loading sentence of its own. Recorded so the reconciliation's refusal row
    // covers BOTH terms rather than only the one the sheet drew.
    expect(workflowDoorSwitchSource).toContain('templateRead.kind !== "loading"')
    expect(describeTemplateRowSource).toContain("FOOTING_LOADING")
    expect(describeTemplateRowSource).toContain("TEMPLATE_FIELDS_LOADING")
  })
})

describe("199-08 Task 1 — the knowledge picker's THREE readings, as they ship", () => {
  it("READING 1 — none chosen: the control is offered and its value is the opt-out", async () => {
    const select = await openDescribeDoorWithFolders()
    expect(select.value).toBe("")
    expect(within(select).getByText("No specific knowledge base")).toBeInTheDocument()
  })

  it("READING 2 — one chosen: the door NAMES the chosen folder, not just its id", async () => {
    // ⚠ THE TITLE MOVED AND THE PROPERTY GOT STRONGER. It read "the control carries the chosen
    // folder's id", which was all the shipped surface could offer: the id lived in a `select`'s
    // DOM property and never reached the markup. Sketch 200's arm 2 puts the folder's NAME on
    // the face of the door, so the reading is now something a person can have. The id is still
    // asserted, through the same `select`, one disclosure away.
    const select = await openDescribeDoorWithFolders()
    fireEvent.change(select, { target: { value: KB_CONTRACTS.id } })
    const row = await screen.findByTestId("describe-kb-chosen")
    // The NAME is what a person reads, and it can only appear by resolving the written ID
    // against the offered list — so this asserts the id reached the parent, through the face.
    expect(row).toHaveTextContent(KB_CONTRACTS.name)
    expect(row).not.toHaveTextContent(KB_POLICIES.name)
  })

  it("READING 3 — none available: still NO control, and now the door SAYS SO", async () => {
    mockListFolders.mockResolvedValue([])
    render(<WorkflowDoorSwitch />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    await waitFor(() => expect(mockListFolders).toHaveBeenCalled())
    expect(screen.queryByTestId("project-folder-picker")).toBeNull()
    const marker = await screen.findByTestId("describe-kb-state")
    expect(marker.getAttribute("data-state")).toBe("none")
    // The marker is still `hidden` + `aria-hidden` — it is a probe, not a surface.
    expect(marker.hasAttribute("hidden")).toBe(true)
    expect(marker.getAttribute("aria-hidden")).toBe("true")
    /**
     * ⚠ THE FINDING THIS CASE RECORDED IS CLOSED, AND ITS ORIGINAL WORDING IS KEPT SO THE
     * CLOSURE IS LEGIBLE RATHER THAN SILENT:
     *
     *     "⚠ THE FINDING THE SHEET IS ABOUT: nothing on screen SAYS there are none. The
     *      marker is `hidden` + `aria-hidden`, so it reaches a test and never a person."
     *
     * Sketch 200 draws the third arm, the operator named the sketch as the absolute
     * reference, and it is now built. A PERSON is told.
     */
    expect(screen.getByTestId("describe-kb-empty")).toBeInTheDocument()
  })

  it("READING 3b — 'we could not ask' is a FOURTH state, and it no longer LOOKS like the third", async () => {
    mockListFolders.mockRejectedValue(new Error("offline"))
    render(<WorkflowDoorSwitch />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    // ⚠ RE-QUERIED RATHER THAN HELD. Sketch 200 renders each arm as its own subtree, so the
    // state marker is a DIFFERENT DOM NODE once the request settles; a held reference reports
    // the arm it was captured in forever.
    await waitFor(() =>
      expect(screen.getByTestId("describe-kb-state").getAttribute("data-state")).toBe(
        "unavailable",
      ),
    )
    expect(screen.queryByTestId("project-folder-picker")).toBeNull()
    // ⚠ AND IT MAY NOT BORROW THE THIRD ARM'S CLAIM. A failed read knows nothing about how
    // many folders exist, so the door says something else — asserted in BOTH directions,
    // because a single shared sentence would satisfy either half alone.
    expect(screen.getByTestId("describe-kb-unavailable")).toBeInTheDocument()
    expect(screen.queryByTestId("describe-kb-empty")).toBeNull()
  })
})

describe("199-08 Task 1 — sheet c9's COLOUR TOKENS, resolved against the shipped config", () => {
  /**
   * ⚠ THE PHASE-WIDE MEASUREMENT, RE-DERIVED HERE FOR THIS SHEET RATHER THAN INHERITED.
   * A Tailwind class naming a key the config does not carry compiles to NOTHING and renders
   * identically to an arm that is deliberately unpainted — the `bg-warning` silent no-op that
   * shipped unguarded in 192.2. So the sheet's palette is checked BEFORE any of it is copied.
   */
  const SHEET_C9_TOKENS = [
    "background",
    "error",
    "error-container",
    "on-background",
    "on-surface",
    "on-surface-variant",
    "outline",
    "outline-variant",
    "primary",
    "primary-container",
    "primary-fixed",
    "surface",
    "surface-container-high",
    "surface-container-low",
    "surface-container-lowest",
    "surface-variant",
    "tertiary-fixed-dim",
  ]

  /** A colour key really declared in the shipped Tailwind config's `colors` block. */
  const declares = (token: string): boolean =>
    new RegExp(`(^|\\n)\\s*(?:"|')?${token.replace(/-/g, "\\-")}(?:"|')?\\s*:`, "m").test(
      tailwindConfigSource199,
    )

  it("the config really loaded, and the detector really detects (POSITIVE + NEGATIVE control)", () => {
    expect(tailwindConfigSource199.length).toBeGreaterThan(1000)
    expect(declares("background")).toBe(true)
    expect(declares("destructive")).toBe(true)
    expect(declares("no-such-colour-key")).toBe(false)
  })

  it("⚠ FIFTEEN of the sheet's SEVENTEEN colour tokens compile to NOTHING here", () => {
    expect(SHEET_C9_TOKENS).toHaveLength(17)
    const resolves = SHEET_C9_TOKENS.filter(declares)
    expect(resolves.sort()).toEqual(["background", "primary"])
    expect(SHEET_C9_TOKENS.length - resolves.length).toBe(15)
  })

  it("every token THIS plan spends is a shipped one that RESOLVES", () => {
    for (const token of ["destructive", "border", "muted", "foreground", "primary", "card"]) {
      expect(declares(token), `${token} does not resolve`).toBe(true)
    }
  })
})

describe("199-08 Task 1 — the 199-09 SEAM, recorded rather than assumed", () => {
  it("there are TWO pre-draft describe boxes and this plan owns exactly one of them", () => {
    // THIS file's box carries a testid; the Builder's pre-draft box does not, and both spell
    // the same placeholder. That is the duplication sheet c9's header strip designs out, and
    // it is SHIPPED — this phase neither introduces it nor closes it.
    expect(workflowDoorSwitchSource).toContain('data-testid="describe-box"')
    expect(builderPageSource).toContain('placeholder="Describe the goal in plain language…"')
    expect(builderPageSource).not.toContain('data-testid="describe-box"')
  })

  it("✅ INVERTED BY 199-09 — the Builder's box now takes THE SAME constant, by import", () => {
    // ⚠ POLARITY FLIPPED, QUERY UNCHANGED — this case was authored by `199-08` in wave 2
    // precisely so that wave 3 would flip it rather than delete it, and its original words
    // are preserved directly below. Wave 2 read: *"the Builder's box is UNGATED BY ANY
    // SENTENCE today — 199-09's inheritance, pinned … Wave 3 imports the SAME refusal
    // constant this plan lands, rather than spelling a second one. The proof that it has
    // not already done so is here, in wave 2."*
    //
    // It did. `199-09` measured that the Builder's pre-draft CTA carries the identical
    // `describe.trim().length > 0` term this door's gate carries — the question `199-08`
    // deliberately left open — so saying the refusal out loud there is presentation, and it
    // was built rather than reported.
    expect(builderPageSource).toContain("DESCRIBE_REFUSAL")
    // ⚠ AND THE HALF THAT ACTUALLY MATTERS: it arrives by IMPORT, never as a second
    // spelling. `WorkflowBuilderPage.tsx` is a swept source of the D-24(a) copy fence, so a
    // literal there would turn that fence red — but this states it directly rather than
    // relying on another suite to notice.
    expect(builderPageSource).toContain('} from "@/components/workflows/doorVocabulary"')
    expect(builderPageSource).not.toContain(doorVocabulary.DESCRIBE_REFUSAL)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// Phase 199-08 Task 2 (DES-01 · sheet `c9-doors-describe` §3) — THE REFUSAL, SAID OUT LOUD.
//
// APPENDED, never interleaved. The ONE assertion this plan moves is the polarity of the
// absence Task 1 committed a commit earlier; nothing is deleted anywhere.
// ══════════════════════════════════════════════════════════════════════════════════════

describe("199-08 Task 2 — the describe box refuses OUT LOUD, and adds no rule doing it", () => {
  /** The describe door, open, with the picker's request settled. */
  async function openDescribeDoor() {
    render(<WorkflowDoorSwitch />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    await waitFor(() => expect(mockListFolders).toHaveBeenCalled())
    return screen.getByTestId("describe-box") as HTMLTextAreaElement
  }

  it("the sentence is the GOVERNED one, reached by import — never a literal in the component", async () => {
    const box = await openDescribeDoor()
    fireEvent.change(box, { target: { value: "  \t " } })
    // The words come from the module. The D-24(a) fence above independently proves the
    // component does not spell them; this proves the module's value is what renders.
    expect(screen.getByTestId("describe-refusal")).toHaveTextContent(
      doorVocabulary.DESCRIBE_REFUSAL,
    )
    // …and it announces itself as a standing condition rather than an interruption.
    expect(screen.getByTestId("describe-refusal").getAttribute("role")).toBe("status")
  })

  it("⚠ IT NEVER GREETS ANYONE — an untouched box is refused in silence, exactly as it ships", async () => {
    await openDescribeDoor()
    // The SAME rule refuses an empty box, and captioning that would put a refusal on the first
    // screen an author meets. This is the reason the trigger carries a `length > 0` term.
    expect(screen.getByTestId("describe-draft")).toBeDisabled()
    expect(screen.queryByTestId("describe-refusal")).toBeNull()
    expect(screen.getByTestId("describe-box")).not.toHaveAttribute("aria-invalid")
  })

  it("it CLEARS the moment there is something to draft from, and on the way back to empty", async () => {
    const box = await openDescribeDoor()

    fireEvent.change(box, { target: { value: "   " } })
    expect(screen.getByTestId("describe-refusal")).toBeInTheDocument()

    fireEvent.change(box, { target: { value: "Summarise weekly vendor risk" } })
    expect(screen.queryByTestId("describe-refusal")).toBeNull()
    expect(screen.getByTestId("describe-draft")).toBeEnabled()

    // …and clearing the box RIGHT back to empty returns it to the resting silence rather than
    // leaving a refusal standing over a screen nobody has touched.
    fireEvent.change(box, { target: { value: "" } })
    expect(screen.queryByTestId("describe-refusal")).toBeNull()
  })

  it("NO RULE MOVED — enablement is byte-for-byte the shipped predicate on every arm", async () => {
    const box = await openDescribeDoor()
    const cta = screen.getByTestId("describe-draft")
    for (const [value, enabled] of [
      ["", false],
      ["   ", false],
      ["\n\t", false],
      ["a", true],
      [" a ", true],
    ] as const) {
      fireEvent.change(box, { target: { value } })
      expect(cta.hasAttribute("disabled"), `enablement moved for ${JSON.stringify(value)}`).toBe(
        !enabled,
      )
    }
  })

  it("the box is marked invalid ONLY while refusing — an attribute, never a colour alone", async () => {
    const box = await openDescribeDoor()
    fireEvent.change(box, { target: { value: " " } })
    expect(box).toHaveAttribute("aria-invalid", "true")
    fireEvent.change(box, { target: { value: "Summarise weekly vendor risk" } })
    // ⚠ ABSENT, not `"false"`. A spread-conditional rather than a default is what keeps the
    // resting markup identical to the markup three suites pin byte for byte.
    expect(box).not.toHaveAttribute("aria-invalid")
  })

  it("⚠ THE RESTING CLASS LIST IS CHARACTER-FOR-CHARACTER THE PORTED ONE", async () => {
    const box = await openDescribeDoor()
    /**
     * ⚠ RE-BASELINED BY SKETCH 200, DECLARED RATHER THAN ABSORBED. The previous literal is
     * kept verbatim so the diff is readable and so nobody has to trust that only the intended
     * tokens moved:
     *
     *   "w-full resize-none rounded-lg border border-border bg-card px-4 py-4 text-[15px] " +
     *   "leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-1 " +
     *   "focus:ring-primary"
     *
     * FOUR TOKENS MOVED, AND EACH IS THE SHEET'S:
     *   · `resize-none` → `resize-y`      the sheet lets the author grow the box, which is the
     *                                      complaint the whole screen exists to answer
     *   · `rounded-lg`  → `rounded`        the sheet's 2px `DEFAULT` radius
     *   · `px-4 py-4`   → `p-4`            same padding, the sheet's single-axis spelling
     *   · `text-[15px] leading-relaxed` → `text-[14px] leading-[1.5]`   the sheet's body size
     *   · `focus:ring-1 focus:ring-primary` → `focus:ring-0`   the sheet draws the focused
     *                                      border WITHOUT a second ring
     *
     * ⚠ WHAT THIS PIN ACTUALLY GUARDS IS UNCHANGED AND STILL ASSERTED BELOW: the class list is
     * a CONCATENATION with three refusing slots, so the resting arm resolves character for
     * character and exactly three tokens differ when it refuses. That property — not the
     * particular tokens — is what a re-baseline could destroy, and it is re-proved here.
     */
    const RESTING =
      "w-full resize-y rounded border border-border bg-card p-4 text-[14px] " +
      "leading-[1.5] text-foreground focus:border-primary focus:outline-none focus:ring-0"
    expect(box.getAttribute("class")).toBe(RESTING)

    // …and the refusing arm really does differ, so the concatenation is not a no-op dressed up
    // as a conditional. TWO slots move and NOTHING else does.
    //
    // ⚠ IT WAS THREE, AND THE THIRD DID NOT DISAPPEAR QUIETLY: sketch 200 draws this box with
    // NO focus ring (`focus:ring-0` on both arms), so `focus:ring-destructive` has nothing left
    // to swing against. The property this half guards — same token COUNT, exactly the named
    // slots differing, nothing else drifting — is unchanged and is still what is asserted.
    //
    // ⚠ 214-13 — THE TWO TOKENS ARE NOW `warning`, AND THIS IS AN ARGUED CHANGE RATHER THAN A
    // RE-BASELINE TO MAKE A RED GO GREEN. Plan 214-03 recorded the ruling in
    // `doorVocabulary.ts` ("THE COLOUR RULING"): sketch 217 invariant #11 says the refusal
    // spends WARNING and never destructive, and sketches 214 #14 / 215 #9 assert
    // `--destructive` is ABSENT from the new surfaces — so leaving the SHIPPED arm destructive
    // while the new service arm is warning would make ONE mechanism read as TWO severities.
    // The PROPERTY this half guards is untouched and is what still fails on a mistake: the same
    // token COUNT, exactly the named slots differing, nothing else drifting. Only the token
    // NAMES moved, and the negative assertions below prove `destructive` is genuinely gone
    // rather than merely unasserted.
    fireEvent.change(box, { target: { value: " " } })
    const refusing = (box.getAttribute("class") ?? "").split(" ")
    expect(refusing).toContain("border-warning")
    expect(refusing).toContain("focus:border-warning")
    expect(refusing).not.toContain("border-destructive")
    expect(refusing).not.toContain("focus:border-destructive")
    expect(refusing).not.toContain("border-border")
    expect(refusing).not.toContain("focus:border-primary")
    expect(refusing.length).toBe(RESTING.split(" ").length)
    // …and the ring really is off on BOTH arms, which is what makes two the right number.
    expect(refusing).toContain("focus:ring-0")
    expect(RESTING.split(" ")).toContain("focus:ring-0")
  })

  it("the sentence claims NOTHING the product cannot compute — no vagueness verdict", () => {
    // Sheet c9 captions this state with a vagueness judgement over a real sentence. No
    // predicate in this product reads an input for vagueness, so that caption would print a
    // verdict nothing computes. Swept over the shipped string rather than promised in prose.
    const words = /vague|too short|too long|invalid|unclear|error|quality|specific enough/i
    expect(words.test(doorVocabulary.DESCRIBE_REFUSAL)).toBe(false)
    // POSITIVE CONTROL — the sweep really fires on the sheet's own caption.
    expect(words.test("Request too vague - Needs a goal and a source.")).toBe(true)
  })
})


// ── 214-13 (STEP-06 · D-214-21 · sketch 217) — THE SECOND ARM ON THE ONE REFUSAL MECHANISM ──
//
// THE PROPERTY: the door refuses BY NAME when the author's prose names a service they have not
// connected, offers exactly two next actions, drafts NOTHING, and points at their own words
// only when it can do so unambiguously.
describe("WorkflowDoorSwitch — the describe door refuses an unconnected service", () => {
  /** A granted Slack connection, narrowed to what the picker and the refusal read. */
  const slackConnection = {
    id: "conn-slack",
    org_id: "o1",
    service_id: "slack",
    name: "Acme Slack",
    config: {},
    is_enabled: true,
    discovered_tools: [{ name: "post_message" }],
    tool_grants: { post_message: "allow" },
  }

  async function openDoorAndType(text: string) {
    render(<WorkflowDoorSwitch />)
    fireEvent.click(screen.getByTestId("door-card-describe"))
    // The picker's read must SETTLE before the refusal is meaningful — until it does, the door
    // knows of no connections and would refuse a service the author may well have.
    await screen.findByTestId("describe-services")
    fireEvent.change(screen.getByTestId("describe-box"), { target: { value: text } })
    return screen.getByTestId("describe-box") as HTMLTextAreaElement
  }

  it("names the service, ANCHORS the author's own word, and drafts nothing", async () => {
    await openDoorAndType("Every Monday, post the summary to Slack.")

    const refusal = screen.getByTestId("describe-refusal")
    expect(refusal).toHaveAttribute("role", "status")
    // The SENTENCE is the governed one, composed — never a literal in the component.
    expect(screen.getByTestId("describe-refusal-service")).toHaveTextContent(
      doorVocabulary.DOOR_REFUSAL({ service: "Slack" }),
    )
    // The ANCHOR marks the author's own characters (#11/#12) …
    expect(screen.getByTestId("describe-refusal-anchor")).toHaveTextContent("Slack")
    // … and its tag is in the accessibility tree WITH NO HOVER EVENT FIRED (#12).
    expect(screen.getByTestId("describe-refusal-anchor-tag")).toHaveTextContent(
      doorVocabulary.DOOR_REFUSAL_ANCHOR,
    )
    // NOTHING IS DRAFTED (D-214-21) — the CTA is disabled and the generate seam is untouched.
    expect(screen.getByTestId("describe-draft")).toBeDisabled()
    expect(mockGenerateWorkflow).not.toHaveBeenCalled()
  })

  it("offers EXACTLY TWO next actions (#5), and the revise one keeps the author here", async () => {
    const box = await openDoorAndType("Open a Jira ticket for each finding.")
    const refusal = screen.getByTestId("describe-refusal")
    expect(within(refusal).getAllByRole("button")).toHaveLength(2)
    expect(screen.getByTestId("describe-refusal-connect")).toHaveTextContent(
      doorVocabulary.DOOR_REFUSAL_CONNECT({ service: "Jira" }),
    )
    expect(screen.getByTestId("describe-refusal-revise")).toHaveTextContent(
      doorVocabulary.DOOR_REFUSAL_REVISE,
    )
    // "The way to stay" lands them back in the box rather than dismissing a sentence.
    fireEvent.click(screen.getByTestId("describe-refusal-revise"))
    expect(document.activeElement).toBe(box)
  })

  it("the DISABLED CTA carries its reason and NAMES NO SERVICE (#3)", async () => {
    await openDoorAndType("Every Monday, post the summary to Slack.")
    const cta = screen.getByTestId("describe-draft")
    expect(cta).toHaveTextContent(doorVocabulary.DOOR_CTA_REFUSED_SERVICE)
    // The accessible name carries the reason and not the detail.
    const name = cta.textContent ?? ""
    expect(name).not.toMatch(/slack/i)
    expect(name).not.toMatch(/jira|notion|github/i)
  })

  it("TWO services named ⇒ the UNANCHORED refusal — a mis-anchor is worse than no anchor", async () => {
    await openDoorAndType("Read the Notion page and post it to Slack.")
    // It still refuses, and still names a service …
    expect(screen.getByTestId("describe-refusal-service")).toHaveTextContent(
      doorVocabulary.DOOR_REFUSAL({ service: "Notion" }),
    )
    // … but the MARK is withheld, which is sketch 217 §4's fallback.
    expect(screen.queryByTestId("describe-refusal-anchor")).toBeNull()
    expect(screen.queryByTestId("describe-refusal-echo")).toBeNull()
    // Two next actions either way.
    expect(within(screen.getByTestId("describe-refusal")).getAllByRole("button")).toHaveLength(2)
  })

  it("a SUBSTRING hit refuses NOTHING, and the CTA is the ordinary one", async () => {
    await openDoorAndType("Notionally this runs every Monday and writes a summary.")
    expect(screen.queryByTestId("describe-refusal")).toBeNull()
    const cta = screen.getByTestId("describe-draft")
    expect(cta).toHaveTextContent(doorVocabulary.DESCRIBE_CTA)
    expect(cta).toBeEnabled()
  })

  it("a CONNECTED service is not refused — the picker's read is what makes it true", async () => {
    mockListConnections.mockResolvedValue([slackConnection])
    await openDoorAndType("Every Monday, post the summary to Slack.")
    expect(screen.queryByTestId("describe-refusal")).toBeNull()
    expect(screen.getByTestId("describe-draft")).toBeEnabled()
  })

  it("⭐ THE PRECEDENCE RULE — an EMPTY box with nothing connected reads the THINNESS reason", async () => {
    // Sketch 217 §3: a workflow with no external step is perfectly legitimate, so refusing on
    // the connection here would refuse for a reason that is NOT BINDING.
    await openDoorAndType("   ")
    expect(screen.getByTestId("describe-refusal")).toHaveTextContent(
      doorVocabulary.DESCRIBE_REFUSAL,
    )
    const cta = screen.getByTestId("describe-draft")
    expect(cta).toHaveTextContent(doorVocabulary.DESCRIBE_CTA_REFUSED)
    expect(cta).not.toHaveTextContent(doorVocabulary.DOOR_CTA_REFUSED_SERVICE)
    // POSITIVE CONTROL — the SERVICE arm is reachable from this very door, so the assertion
    // above is the ordering doing the work rather than an arm that never renders at all.
    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "post the summary to Slack" },
    })
    expect(screen.getByTestId("describe-draft")).toHaveTextContent(
      doorVocabulary.DOOR_CTA_REFUSED_SERVICE,
    )
  })

  it("⚠ THE ANCHOR SPENDS `warning` AND NOT `--destructive` (#11), and it is an UNDERLINE", async () => {
    await openDoorAndType("Every Monday, post the summary to Slack.")
    const anchor = screen.getByTestId("describe-refusal-anchor")
    const tokens = (anchor.getAttribute("class") ?? "").split(" ")

    // ⚠ READ AS TOKENS, NOT AS A COMPUTED COLOUR, AND THE LIMIT IS STATED RATHER THAN HIDDEN.
    // jsdom compiles no Tailwind, so `getComputedStyle(anchor).textDecorationLine` is `""` for
    // a utility class and a computed-style assertion here would be vacuous — this file's own
    // sibling records that "fifteen of this sheet's seventeen colour tokens compile to nothing
    // here and would render identically to an arm nobody painted". So the token is asserted at
    // the class list AND proved to RESOLVE in the real config below, which is the shipped
    // discipline (`WorkflowDoorSwitch.tsx`'s own note: "verified rather than assumed").
    expect(tokens).toContain("underline")
    expect(tokens).toContain("decoration-warning")
    expect(tokens.some((t) => t.includes("destructive"))).toBe(false)
    // POSITIVE CONTROL — the destructive predicate really fires on a class list carrying it.
    expect("underline decoration-destructive".split(" ").some((t) => t.includes("destructive"))).toBe(
      true,
    )
  })

  it("the whole refusal block spends `warning` and carries no destructive token", async () => {
    await openDoorAndType("Every Monday, post the summary to Slack.")
    const html = screen.getByTestId("describe-refusal").outerHTML
    expect(html).toContain("border-l-warning")
    expect(html).not.toContain("destructive")
    // POSITIVE CONTROL for the negative half.
    expect('<div class="border-l-destructive"></div>').toContain("destructive")
  })

  it("`warning` RESOLVES in the real Tailwind config — a token that compiles to nothing is unpainted", async () => {
    // The shipped verification habit, not a new one: 192.2 WR-01 measured `bg-warning` /
    // `text-warning` compiling to NOTHING across four surfaces because the KEY was missing
    // while the CSS variable existed. Read the config itself rather than trusting the name.
    const config = (await import("../../../tailwind.config.js?raw")).default as string
    expect(config).toContain("--warning")
    expect(/warning:\s*\{/.test(config)).toBe(true)
    // POSITIVE CONTROL — the needle shape can fail.
    expect(/notacolour:\s*\{/.test(config)).toBe(false)
  })

  it("the author's prose is rendered as TEXT — no raw-HTML sink on this door (T-124-05)", async () => {
    await openDoorAndType('<img src=x onerror="alert(1)"> post to Slack')
    // The echo carries the literal characters; nothing was parsed as markup.
    const echo = screen.getByTestId("describe-refusal-echo")
    expect(echo.textContent).toContain('<img src=x onerror="alert(1)">')
    expect(echo.querySelector("img")).toBeNull()
    // …and the component names the raw-HTML PROP nowhere (the 214-03 anchor: on the `=`, since
    // this file's own docblock PROMISES never to use it and a bare-word grep would count that).
    expect(workflowDoorSwitchSource).not.toContain("dangerouslySetInnerHTML=")
    expect("<p dangerouslySetInnerHTML={x} />").toContain("dangerouslySetInnerHTML=")
  })
})
