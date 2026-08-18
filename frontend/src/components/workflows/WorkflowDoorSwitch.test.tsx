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
} = vi.hoisted(() => ({
  mockGenerateWorkflow: vi.fn(),
  mockListFolders: vi.fn(),
  mockListSkills: vi.fn(),
  mockReadPlaceholders: vi.fn(),
  mockUploadTemplate: vi.fn(),
}))
vi.mock("@/lib/api", () => ({
  generateWorkflow: mockGenerateWorkflow,
  createWorkflowDraft: vi.fn(),
  updateWorkflowDraft: vi.fn(),
  listFolders: mockListFolders,
  listSkills: mockListSkills,
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

/** Open the describe door with folders on offer and wait for the picker to land. */
async function openDescribeDoorWithFolders() {
  mockListFolders.mockResolvedValue([KB_POLICIES, KB_CONTRACTS])
  render(<WorkflowDoorSwitch />)
  fireEvent.click(screen.getByTestId("door-card-describe"))
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
    expect(screen.queryByTestId("project-folder-picker")).toBeNull()
    // The describe box and the CTA are untouched by the picker's absence.
    expect(screen.getByTestId("describe-box")).toBeInTheDocument()
    expect(screen.getByTestId("describe-draft")).toBeInTheDocument()
  })
})

describe("WorkflowDoorSwitch — THE PICKER NEVER BLOCKS (the fast path keeps its promise)", () => {
  it("with NOTHING chosen the CTA is enabled by TEXT ALONE, and one click still hands off", async () => {
    await openDescribeDoorWithFolders()

    const cta = screen.getByTestId("describe-draft")
    // Empty box ⇒ disabled, exactly as it ships. The picker did not change that rule.
    expect(cta).toBeDisabled()

    fireEvent.change(screen.getByTestId("describe-box"), {
      target: { value: "Summarise weekly vendor risk" },
    })
    // Text alone enables it — no knowledge base was chosen and none was asked for.
    expect(cta).toBeEnabled()
    expect((screen.getByTestId("project-folder-picker") as HTMLSelectElement).value).toBe("")

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

    const again = (await screen.findByTestId("project-folder-picker")) as HTMLSelectElement
    expect(again.value).toBe(KB_POLICIES.id)
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

    const again = (await screen.findByTestId("project-folder-picker")) as HTMLSelectElement
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
  const plain = value as string
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
    expect(new Set(NEEDLES.map((n) => n.id)).size).toBe(22)
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
    "%s carries none of the 22 governed words, in either spelling",
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
