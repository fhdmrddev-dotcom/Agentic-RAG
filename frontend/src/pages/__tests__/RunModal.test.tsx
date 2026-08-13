/**
 * Phase 152 Plan 03 Task 3 (WFIN-01 / WFIN-02) — RunModal run-input contract.
 *
 * The frontend Nyquist backstop for the Run modal's two new run inputs. It renders
 * the LIVE WorkflowsPage (the modal is internal to it), opens the modal off a
 * published card, and pins the modal→onLaunch contract deterministically:
 *
 *   1. the KB-scope <select> renders "All documents" → the author-default option
 *      tagged "workflow default" → other owner folders, in order; and the whole
 *      control HIDES when there are no folders (matches ChatArea's guard).
 *   2. picking another folder + launching calls onLaunch with that folderId override.
 *   3. staging a template File + launching calls onLaunch with that templateFile.
 *   4. the default no-input launch (no upload, folder on the "workflow default")
 *      passes NO override — { templateFile: null, folderId: null } (D-06).
 *
 * onLaunch is mocked; NO network is hit. The cross-provider SC#10 proof is the LIVE
 * UAT in 152-VALIDATION.md — it is NOT duplicated here.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react"

const {
  mockListPublished,
  mockListDrafts,
  mockCreateDraft,
  mockGenerate,
  mockUpdate,
  mockPublish,
  mockListFolders,
  mockListSkills,
  mockListStarters,
} = vi.hoisted(() => ({
  mockListPublished: vi.fn(),
  mockListDrafts: vi.fn(),
  mockCreateDraft: vi.fn(),
  mockGenerate: vi.fn(),
  mockUpdate: vi.fn(),
  mockPublish: vi.fn(),
  mockListFolders: vi.fn(),
  mockListSkills: vi.fn(),
  mockListStarters: vi.fn(),
}))

// Mock the api seam (same set the WorkflowsPage.test harness mocks). The modal stages
// a File + a folder pick locally; onLaunch (the ChatLayout doRun) is a prop mock — no
// api call fires from the modal itself.
vi.mock("@/lib/api", () => ({
  listPublishedWorkflows: mockListPublished,
  listDraftWorkflows: mockListDrafts,
  createWorkflowDraft: mockCreateDraft,
  generateWorkflow: mockGenerate,
  updateWorkflowDraft: mockUpdate,
  publishWorkflow: mockPublish,
  listFolders: mockListFolders,
  listSkills: mockListSkills,
  listStarterWorkflows: mockListStarters,
}))

import { WorkflowsPage } from "../WorkflowsPage"
import type { Folder } from "@/types"

/** The author default (folder-aaa) + a distinct override target (folder-bbb). */
const folders: Folder[] = [
  { id: "folder-aaa", user_id: "u1", name: "DBA Chapters", parent_id: null, is_org_shared: false, created_at: "", updated_at: "" },
  { id: "folder-bbb", user_id: "u1", name: "Contracts", parent_id: null, is_org_shared: false, created_at: "", updated_at: "" },
]

/** A published workflow BOUND to folder-aaa, with NO per-phase folder_scope (so every
 *  owner folder is an eligible override — the A4 guard is exercised separately). */
const boundPublished = {
  id: "pub-1",
  slug: "vendor-risk",
  name: "Vendor-risk review",
  definition: {
    slug: "vendor-risk",
    version: 2,
    project_folder_id: "folder-aaa",
    inputs: [{ key: "kickoff_prompt" }],
    phases: [{ slug: "emit", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "draft" } }],
  },
}

/** An UNBOUND workflow (no project_folder_id) — here folderId:null genuinely means
 *  whole-KB, so the "" option truthfully reads "All documents" (WR-05). */
const unboundPublished = {
  id: "pub-2",
  slug: "open-scan",
  name: "Open scan",
  definition: {
    slug: "open-scan",
    version: 1,
    project_folder_id: null,
    inputs: [{ key: "kickoff_prompt" }],
    phases: [{ slug: "emit", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "draft" } }],
  },
}

/** Project P with children A and B (the backend 152-06 P/A/B shape). */
const phaseScopedFolders: Folder[] = [
  { id: "folder-p", user_id: "u1", name: "Project P", parent_id: null, is_org_shared: false, created_at: "", updated_at: "" },
  { id: "folder-a", user_id: "u1", name: "Team A", parent_id: "folder-p", is_org_shared: false, created_at: "", updated_at: "" },
  { id: "folder-b", user_id: "u1", name: "Team B", parent_id: "folder-p", is_org_shared: false, created_at: "", updated_at: "" },
]

/** A workflow declaring two per-phase folder_scopes [A] and [B]. An override of A would
 *  empty phase-2 (folder_scope=[B] ∩ subtree(A) = ∅) and vice-versa, while P covers both
 *  (subtree(P) ⊇ {A,B}) — the exact WR-03 / backend-A4 case (152-06). */
const phaseScopedPublished = {
  id: "pub-3",
  slug: "two-phase",
  name: "Two-phase scan",
  definition: {
    slug: "two-phase",
    version: 1,
    project_folder_id: null, // unbound → "" is "All documents"; overrides are the offered folders
    inputs: [{ key: "kickoff_prompt" }],
    phases: [
      { slug: "p1", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "draft", folder_scope: ["folder-a"] } },
      { slug: "p2", phase_index: 1, config: { phase_type: "llm_emit", citation_policy: "draft", folder_scope: ["folder-b"] } },
    ],
  },
}

/** Ancestor-override tree (152-08 / D-04): R ─ P ─ A1, plus an unrelated SIBLING P2 under R.
 *  subtree(P)={P,A1}; subtree(R)={R,P,A1,P2} — so R (a strict ancestor of the bound project)
 *  trivially satisfies the per-phase folder_scope=[A1] yet WIDENS retrieval to the sibling P2. */
const ancestorFolders: Folder[] = [
  { id: "folder-r", user_id: "u1", name: "Workspace root", parent_id: null, is_org_shared: false, created_at: "", updated_at: "" },
  { id: "folder-p", user_id: "u1", name: "Project P", parent_id: "folder-r", is_org_shared: false, created_at: "", updated_at: "" },
  { id: "folder-a1", user_id: "u1", name: "Team A1", parent_id: "folder-p", is_org_shared: false, created_at: "", updated_at: "" },
  { id: "folder-p2", user_id: "u1", name: "Project P2", parent_id: "folder-r", is_org_shared: false, created_at: "", updated_at: "" },
]

/** A workflow BOUND to P (project_folder_id: "folder-p") declaring phase folder_scope=[A1].
 *  The Run modal must NEVER offer R (the escaping ancestor) or P2 (the unrelated sibling) —
 *  only A1 (the in-project descendant). The client mirror of scope.py's restored A4 check. */
const ancestorScopedPublished = {
  id: "pub-4",
  slug: "ancestor-scan",
  name: "Ancestor scan",
  definition: {
    slug: "ancestor-scan",
    version: 1,
    project_folder_id: "folder-p", // BOUND to P → authorDefaultFolderId is "folder-p"
    inputs: [{ key: "kickoff_prompt" }],
    phases: [
      { slug: "p1", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "draft", folder_scope: ["folder-a1"] } },
    ],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockListPublished.mockResolvedValue([boundPublished])
  mockListDrafts.mockResolvedValue([])
  mockListStarters.mockResolvedValue([])
  mockListFolders.mockResolvedValue(folders)
  mockListSkills.mockResolvedValue([])
})

async function openModal(pageFolders: Folder[], onLaunch = vi.fn().mockResolvedValue(undefined)) {
  render(<WorkflowsPage folders={pageFolders} onLaunch={onLaunch} />)
  const cards = await screen.findAllByTestId("published-card")
  fireEvent.click(within(cards[0]).getByTestId("published-run"))
  const modal = await screen.findByTestId("run-modal")
  return { modal, onLaunch }
}

describe("RunModal — KB-scope <select> truthful label (WR-05 / WFIN-02)", () => {
  it("bound + author folder visible: the '' option reads 'Workflow default — 📁 {folder}', with NO 'All documents'", async () => {
    const { modal } = await openModal(folders)
    const scope = within(modal).getByTestId("run-scope-select") as HTMLSelectElement
    const opts = Array.from(scope.options)
    // The author default is no longer a separate option — the "" option IS the workflow
    // default (truthful: selecting it resolves to the author default server-side, D-06).
    expect(opts.map((o) => o.value)).toEqual(["", "folder-bbb"])
    expect(opts[0].textContent).toContain("Workflow default")
    expect(opts[0].textContent).toContain("DBA Chapters")
    // WR-05: a bound workflow NEVER shows the dishonest "All documents" option.
    expect(opts.some((o) => o.textContent === "All documents")).toBe(false)
    expect(opts[1].textContent).toContain("Contracts")
    expect(opts[1].textContent).not.toContain("workflow default")
    // Initial selection is now "" (truthfully = the workflow default for a bound wf).
    expect(scope.value).toBe("")
  })

  it("bound + author folder NOT visible: the '' option reads bare 'Workflow default' (never mislabelled whole-KB)", async () => {
    // boundPublished binds folder-aaa, but this runner only sees folder-bbb — the exact
    // mislabel case WR-05 fixes: the old code defaulted to "All documents" while the run
    // was actually author-scoped to the invisible folder.
    const { modal } = await openModal([folders[1]])
    const scope = within(modal).getByTestId("run-scope-select") as HTMLSelectElement
    const opts = Array.from(scope.options)
    expect(opts[0].value).toBe("")
    expect(opts[0].textContent).toBe("Workflow default")
    expect(opts.some((o) => o.textContent === "All documents")).toBe(false)
    expect(scope.value).toBe("")
  })

  it("unbound workflow (no project_folder_id): the '' option truthfully reads 'All documents'", async () => {
    mockListPublished.mockResolvedValue([unboundPublished])
    const { modal } = await openModal(folders)
    const scope = within(modal).getByTestId("run-scope-select") as HTMLSelectElement
    const opts = Array.from(scope.options)
    expect(opts[0].value).toBe("")
    expect(opts[0].textContent).toBe("All documents")
    // No author default to exclude → every owner folder is an override option.
    expect(opts.map((o) => o.value)).toEqual(["", "folder-aaa", "folder-bbb"])
    expect(scope.value).toBe("")
  })

  it("hides the whole scope control when there are no folders (matches ChatArea's guard)", async () => {
    const { modal } = await openModal([])
    expect(within(modal).queryByTestId("run-scope-select")).not.toBeInTheDocument()
    expect(within(modal).queryByTestId("run-scope")).not.toBeInTheDocument()
  })
})

describe("RunModal — onLaunch run-input payload (WFIN-01 / WFIN-02)", () => {
  it("picking another folder + launching passes that folderId override", async () => {
    const { modal, onLaunch } = await openModal(folders)
    fireEvent.change(within(modal).getByTestId("run-scope-select"), { target: { value: "folder-bbb" } })
    fireEvent.change(within(modal).getByTestId("run-kickoff"), { target: { value: "review Acme" } })
    fireEvent.click(within(modal).getByTestId("run-confirm"))
    await waitFor(() => expect(onLaunch).toHaveBeenCalledTimes(1))
    expect(onLaunch).toHaveBeenCalledWith(boundPublished, "review Acme", {
      templateFile: null,
      folderId: "folder-bbb",
    })
  })

  it("staging a template File + launching passes that templateFile", async () => {
    const { modal, onLaunch } = await openModal(folders)
    const file = new File(["stub"], "template.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
    const input = within(modal).getByLabelText("Upload template file")
    fireEvent.change(input, { target: { files: [file] } })
    // The staged-file card renders (name + remove control) — the button is replaced.
    expect(await within(modal).findByTestId("run-template-file")).toHaveTextContent("template.docx")
    expect(within(modal).queryByTestId("run-template-upload")).not.toBeInTheDocument()

    fireEvent.click(within(modal).getByTestId("run-confirm"))
    await waitFor(() => expect(onLaunch).toHaveBeenCalledTimes(1))
    const [, , extras] = onLaunch.mock.calls[0]
    expect(extras.templateFile).toBe(file)
    expect(extras.templateFile?.name).toBe("template.docx")
    // Folder left on the workflow default → no override alongside the template (D-06).
    expect(extras.folderId).toBeNull()
  })

  it("the remove control un-stages the file → the upload button returns", async () => {
    const { modal } = await openModal(folders)
    const file = new File(["stub"], "template.docx", { type: "text/plain" })
    fireEvent.change(within(modal).getByLabelText("Upload template file"), { target: { files: [file] } })
    await within(modal).findByTestId("run-template-file")
    fireEvent.click(within(modal).getByRole("button", { name: "Remove template" }))
    expect(within(modal).queryByTestId("run-template-file")).not.toBeInTheDocument()
    expect(within(modal).getByTestId("run-template-upload")).toBeInTheDocument()
  })

  it("D-06: the default no-input launch (no upload, folder on the workflow default) passes NO override", async () => {
    const { modal, onLaunch } = await openModal(folders)
    fireEvent.change(within(modal).getByTestId("run-kickoff"), { target: { value: "go" } })
    fireEvent.click(within(modal).getByTestId("run-confirm"))
    await waitFor(() => expect(onLaunch).toHaveBeenCalledTimes(1))
    expect(onLaunch).toHaveBeenCalledWith(boundPublished, "go", {
      templateFile: null,
      folderId: null,
    })
  })

  it("the honest provenance note renders verbatim, quiet", async () => {
    const { modal } = await openModal(folders)
    expect(within(modal).getByTestId("run-provenance")).toHaveTextContent(
      "Stored untrusted — never run as code, never fed to the fill engine.",
    )
  })
})

describe("RunModal — A4 per-phase override filter (WR-03 frontend mirror)", () => {
  it("drops any override whose subtree empties a declared phase folder_scope; keeps a candidate (P) that covers every phase", async () => {
    mockListPublished.mockResolvedValue([phaseScopedPublished])
    const { modal } = await openModal(phaseScopedFolders)
    const scope = within(modal).getByTestId("run-scope-select") as HTMLSelectElement
    const values = Array.from(scope.options).map((o) => o.value)
    // Phases scope [A] and [B]: offering A empties phase-2 and offering B empties phase-1
    // (subtree(A) ∩ [B] = ∅, subtree(B) ∩ [A] = ∅) → neither is a valid override.
    expect(values).not.toContain("folder-a")
    expect(values).not.toContain("folder-b")
    // Good path: P's subtree {P,A,B} intersects BOTH phase scopes → P survives the filter.
    expect(values).toContain("folder-p")
    // Unbound workflow → the "" option is the honest whole-KB "All documents" (WR-05).
    expect(values[0]).toBe("")
    expect(scope.options[0].textContent).toBe("All documents")
  })
})

describe("RunModal — A4 author-subtree containment (ancestor override not offered, 152-08)", () => {
  it("drops the escaping ancestor (R) and sibling (P2); keeps the in-project descendant (A1) for a BOUND folder_scope workflow", async () => {
    mockListPublished.mockResolvedValue([ancestorScopedPublished])
    const { modal } = await openModal(ancestorFolders)
    const scope = within(modal).getByTestId("run-scope-select") as HTMLSelectElement
    const values = Array.from(scope.options).map((o) => o.value)
    // R is a strict ANCESTOR of the bound project P (its subtree {R,P,A1,P2} also holds the
    // unrelated sibling P2), so offering it would WIDEN the bound run's retrieval beyond P —
    // the author-subtree containment mirror must NOT offer it as a selectable option.
    expect(values).not.toContain("folder-r")
    expect(values).not.toContain("folder-p2")
    // A1 is an in-project descendant (∈ subtree(P)) that satisfies phase folder_scope=[A1] → offered.
    expect(values).toContain("folder-a1")
    // Bound workflow → the "" option is the honest "Workflow default", never "All documents".
    expect(values[0]).toBe("")
    expect(scope.options[0].textContent).toContain("Workflow default")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Plan 192-03 Task 1 (D-01) — THE PRE-MOVE RUN-MODAL CAPTURE.
//
// Appended at the foot of the file as a PURE INSERTION. Nothing above was edited,
// renamed or re-described — not one line, not even an import. That is why the
// `EffectiveFeaturesProvider` below arrives through a dynamic `await import(…)`
// inside the helper (the shipped `WorkflowBuilderPage.canvas.test.tsx:656` idiom)
// rather than through a new top-of-file import line: every `it(` this file shipped
// before this block still reads exactly as it did, and `git diff` shows one
// contiguous addition.
//
// WHY A CAPTURE AND NOT AN EXPECTATION. Phase 192's D-01 moves `RunModal`
// (`WorkflowsPage.tsx:1054-1405`, 352 lines) VERBATIM into
// `frontend/src/components/workflows/library/RunModal.tsx`, and the phase's first
// contract on that move is "the modal renders exactly what it rendered". The cheap
// wrong way to check that is to hand-type the DOM the modal OUGHT to produce — which
// records only what its author believed the markup was, and would ratify a move that
// changed the markup whenever the change happened to match the belief. So this block
// CAPTURES the rendered DOM from the tree AS IT SHIPS.
//
// ⚠ THE BASELINE MUST PREDATE THE CHANGE. A baseline taken after the edit proves the
// edit against itself. This is not a preference: it is Phase 188.1's most expensive
// measured lesson, and 188.2 discharged it by showing every destination module
// answered "No such file or directory" at its capture commit. The same proof, run
// here and recorded rather than asserted:
//
//     $ git rev-parse HEAD
//     14b309b4bd3b04ad5718caa821c24ddb613e2d3f
//     $ git show HEAD:frontend/src/components/workflows/library/RunModal.tsx
//     fatal: path 'frontend/src/components/workflows/library/RunModal.tsx' does not
//       exist in 'HEAD'                                                    [exit 128]
//     $ ls frontend/src/components/workflows/library
//     ls: cannot access '…/library': No such file or directory             [exit 2]
//
// THIS PLAN MODIFIES NO SOURCE FILE. `git diff --name-only` over its two commits
// lists only this file and `RunModal.a11y.test.tsx` — a source edit inside the
// capture commit would destroy the very property the capture exists to establish.
// ═══════════════════════════════════════════════════════════════════════════════

/** The capture commit, recorded so the proof above is re-runnable rather than believed. */
const CAPTURE_SHA = "14b309b4bd3b04ad5718caa821c24ddb613e2d3f"

/**
 * ── 2026-08-13 · Plan `193-07` Task 3 — THE ONE DELIBERATE RE-CAPTURE, AND WHY IT IS
 *    LEGITIMATE HERE WHEN THE HEADER ABOVE SAYS IT NEVER IS. ──
 *
 * The block above is emphatic: *"re-capturing to make it green deletes the only evidence the
 * modal still renders what it rendered."* That sentence is right, and it is about a MOVE. A
 * capture defends the claim "nothing changed"; when a commit's whole purpose is that nothing
 * changed, re-capturing is circular and destroys the evidence. `192-03`'s captures and
 * `192-06`'s cut are exactly that case, and those baselines DID their job: they passed green
 * and UNEDITED through the cut, and through this phase's waves 1–3.
 *
 * `193-07` is the opposite kind of commit — the FIRST one that intentionally changes what this
 * modal renders. D-18 adds a label above the upload control. A capture cannot both record the
 * old render and ratify a deliberate new one, so it is re-taken ONCE, on purpose, with the
 * delta measured rather than asserted:
 *
 *   · WHAT CHANGED, per capture: ONE inserted node,
 *     `<p data-testid="run-template-label" class="px-0.5 text-[13px] font-medium
 *     text-foreground">Template to fill</p>` — +111 bytes in every one of the six, and after
 *     removing that single node each string is BYTE-IDENTICAL to the `192-03` capture it
 *     replaces. Verified per row before substitution (the six summaries are in
 *     193-07-SUMMARY.md); a difference anywhere else would have stopped the plan as a real
 *     regression rather than a re-capture.
 *   · WHY ALL SIX STILL SHOW THE BLOCK AT ALL: `boundPublished` and `unboundPublished` declare
 *     `config: { phase_type: "llm_emit", citation_policy: "draft" }` with NO `emitter` key, and
 *     an absent `emitter` IS `render_template` (the Pydantic default, D-25). So all six rows
 *     `admit`; D-17 removes nothing here. ⚠ Under a predicate demanding an explicit `emitter`
 *     all six would have read `does-not-admit` and every capture would have lost its whole
 *     template block — including TEMPLATE_STAGED and LAUNCH_ERROR, whose entire subject lives
 *     inside it. That is the concrete reason the default rule is load-bearing.
 *   · HOW: through `runModalCapture` above — the same helper the assertions call — dumped to a
 *     file and substituted by SCRIPT. Not one character was hand-edited, for the reason
 *     `188.1-02`, `188.2-03` and `192-03` all recorded: a hand-edit turns a capture back into
 *     an expectation recording what its author believed the change did. Observed TWICE, and the
 *     two runs agreed byte for byte.
 *   · ⚠ `LAUNCH_ERROR` IS THE ROW THAT PROVES THE CUT WENT AROUND THE ERROR NODE. `run-upload-
 *     error` keeps its exact DOM position — same parent, still between the control and the
 *     provenance line — because `showTemplate` gates the control and the provenance line and
 *     NOTHING else. Had the error node been re-homed as a sibling of the wrapper, this capture
 *     would have differed beyond the label and the check above would have refused it.
 *
 * The ORIGINAL `CAPTURE_SHA` stays above, unaltered. This repo corrects in the open: a later
 * reader can see both what was captured and when it was legitimately re-taken.
 */
const RECAPTURE_SHA_193_07 = "87889e13b6e7731edbc80cd4a296c14365e65d95"

type WorkflowsPageProps = Parameters<typeof WorkflowsPage>[0]
type LaunchFn = WorkflowsPageProps["onLaunch"]

/**
 * The three launch outcomes the capture needs, as PLAIN functions rather than `vi.fn()`s.
 * Deliberate: `beforeEach` calls `vi.clearAllMocks()`, and a row whose behaviour lived in a
 * mock implementation would be one `resetAllMocks` away from silently capturing a different
 * state than the one its key names.
 */
const resolvingLaunch: LaunchFn = async () => {}
const rejectingLaunch: LaunchFn = async () => {
  throw new Error("Template too large — 25 MB max")
}
/** Never settles — so `runSubmitting` stays true and the in-flight face is what is read. */
const pendingLaunch: LaunchFn = () => new Promise<void>(() => {})

type CaptureRow = {
  /** The single published row the page's feed returns for this capture. The union names
   *  BOTH shipped fixtures deliberately: `typeof boundPublished` alone narrows
   *  `project_folder_id` to `string`, which would make the UNBOUND row (its `null`) a type
   *  error — and the unbound case is precisely one of the six states being captured. */
  published: typeof boundPublished | typeof unboundPublished
  /** The page's `folders` prop — `[]` exercises the `WorkflowsPage.tsx:1250` scope guard. */
  folders: Folder[]
  /** Drives the REAL `useCanvasGate` through the REAL provider (no mock, no setting flipped). */
  canvasOn: boolean
  onLaunch?: LaunchFn
  /** Interaction driven on the OPEN modal before the DOM is read. */
  drive?: (modal: HTMLElement) => Promise<void>
  /** What to read off the open modal. Defaults to the modal's whole `innerHTML`. */
  read?: (modal: HTMLElement) => string
}

/**
 * ONE render → read → unmount, shared by the capture and by the assertion.
 *
 * A second helper is exactly how a capture and the assertion that guards it drift apart:
 * the assertion would then be measuring a render nobody captured. Every string in
 * `RUN_MODAL_HTML_BASELINE` and `RUN_DESTINATION_BASELINE` below came out of this function,
 * and every `expect` below calls this same function.
 *
 * The canvas gate is exercised through the REAL `EffectiveFeaturesProvider` carrying the
 * REAL `useCanvasGate` — no module mock and no `app_settings` flip. `useCanvasGate` reads
 * `useEffectiveFeaturesOptional()`, so an absent provider is the fail-CLOSED `false` the
 * rest of this file already renders under; the provider only makes the `true` half
 * reachable, and it makes it reachable through the shipped code path rather than around it.
 */
async function runModalCapture(row: CaptureRow): Promise<string> {
  const { EffectiveFeaturesProvider } = await import("@/providers/EffectiveFeaturesProvider")
  mockListPublished.mockResolvedValue([row.published])
  const rendered = render(
    <EffectiveFeaturesProvider
      value={{
        features: row.canvasOn ? { visual_workflow_canvas: true } : {},
        loading: false,
        refetch: () => {},
      }}
    >
      <WorkflowsPage folders={row.folders} onLaunch={row.onLaunch ?? resolvingLaunch} />
    </EffectiveFeaturesProvider>,
  )
  const cards = await screen.findAllByTestId("published-card")
  fireEvent.click(within(cards[0]).getByTestId("published-run"))
  const modal = await screen.findByTestId("run-modal")
  if (row.drive) await row.drive(modal)
  const html = (row.read ?? ((m: HTMLElement) => m.innerHTML))(modal)
  rendered.unmount()
  return html
}

/** Stage a template File → the `run-template-file` card replaces the upload button. */
async function stageTemplate(modal: HTMLElement) {
  const file = new File(["stub"], "template.docx", { type: "text/plain" })
  fireEvent.change(within(modal).getByLabelText("Upload template file"), {
    target: { files: [file] },
  })
  await within(modal).findByTestId("run-template-file")
}

/** Launch, and wait for the rejected launch's verbatim server message to surface. */
async function driveToLaunchError(modal: HTMLElement) {
  fireEvent.click(within(modal).getByTestId("run-confirm"))
  await within(modal).findByTestId("run-upload-error")
}

/** Launch against a never-settling promise, and wait for the in-flight face. */
async function driveToSubmitting(modal: HTMLElement) {
  fireEvent.click(within(modal).getByTestId("run-confirm"))
  await waitFor(() =>
    expect(within(modal).getByTestId("run-confirm")).toHaveTextContent("Running…"),
  )
}

const readDestination = (modal: HTMLElement): string =>
  (modal.querySelector('[data-testid="run-destination"]') as HTMLElement).innerHTML

/**
 * The SIX render states, declared ONCE so the props the baseline was captured from and the
 * props the assertion renders cannot diverge. A second copy of these rows at the assertion
 * site is how the fence quietly starts guarding a different modal.
 *
 *   · BOUND_WITH_FOLDERS      — a workflow bound to a visible author folder; the scope
 *                               `<select>` renders "Workflow default — 📁 …" plus one override.
 *   · UNBOUND_NO_PROJECT      — no `project_folder_id`; the "" option honestly reads
 *                               "All documents" and every owner folder is an override.
 *   · NO_FOLDERS_SCOPE_HIDDEN — `folders=[]`, which exercises the `WorkflowsPage.tsx:1250`
 *                               guard that hides the whole KB-scope control.
 *   · TEMPLATE_STAGED         — a staged template File: the file card is present and the
 *                               upload button is GONE. An absent block is as much a
 *                               behaviour to preserve as a present one.
 *   · LAUNCH_ERROR            — `launchError` set from a rejected launch; the server's
 *                               message renders VERBATIM inside `role="alert"`.
 *   · SUBMITTING              — a launch in flight: "Running…" / "Uploading…" and every
 *                               control disabled.
 */
const RUN_MODAL_HTML_ROWS: Record<string, CaptureRow> = {
  BOUND_WITH_FOLDERS: { published: boundPublished, folders, canvasOn: false },
  UNBOUND_NO_PROJECT: { published: unboundPublished, folders, canvasOn: false },
  NO_FOLDERS_SCOPE_HIDDEN: { published: boundPublished, folders: [], canvasOn: false },
  TEMPLATE_STAGED: { published: boundPublished, folders, canvasOn: false, drive: stageTemplate },
  LAUNCH_ERROR: {
    published: boundPublished,
    folders,
    canvasOn: false,
    onLaunch: rejectingLaunch,
    drive: driveToLaunchError,
  },
  SUBMITTING: {
    published: boundPublished,
    folders,
    canvasOn: false,
    onLaunch: pendingLaunch,
    drive: driveToSubmitting,
  },
}

/**
 * The `run-destination` line is the ONE place in the modal whose copy forks on
 * `useCanvasGate` (`WorkflowsPage.tsx:1369`), and it is the LAST thing a person reads before
 * committing to a run. Both sides are captured, because a move that quietly collapsed the
 * branch to one destination would still pass a capture of only the shipped-default side.
 */
const RUN_DESTINATION_ROWS: Record<string, CaptureRow> = {
  GATE_OFF: { published: boundPublished, folders, canvasOn: false, read: readDestination },
  GATE_ON: { published: boundPublished, folders, canvasOn: true, read: readDestination },
}

/**
 * ⚠ THIS LITERAL IS A CAPTURE, NOT AN EXPECTATION. Every character below was READ OUT of the
 * rendered DOM of the tree as it stands at `CAPTURE_SHA` — `RunModal` still declared inside
 * `WorkflowsPage.tsx`, `components/workflows/library/` still nonexistent — by running
 * `runModalCapture` above and writing what it produced into this file by SUBSTITUTION. Not
 * one attribute here was typed from the source, computed by hand, or reasoned about. That is
 * the whole point: an expectation records what its author believed the markup to be, and a
 * move that changed the markup to match that belief would pass it.
 *
 * OBSERVED TWICE on the unchanged tree before it was committed, and the two runs agreed byte
 * for byte — so it is a baseline rather than one sample of something that might vary. The
 * modal reads no clock, no randomness and no measurement API, so a capture that differed
 * between two runs would be a REAL FINDING to report and not flake to re-roll.
 *
 * NOT ONE STRING BELOW WAS HAND-EDITED, for the reason 188.1-02 and 188.2-03 both dumped
 * theirs to a file first: hand-editing turns a capture back into an expectation recording
 * what its author believed the change did, and silently masks every other attribute the edit
 * disturbed.
 *
 * A DIFF AGAINST THIS RECORD AFTER THE D-01 MOVE IS A BEHAVIOUR CHANGE TO EXPLAIN — the
 * phase's first contract broken — AND NOT A TEST TO UPDATE. The extraction is supposed to
 * move code, not move pixels. If this goes red during the move, the move is wrong;
 * re-capturing it to make it green would delete the only evidence anybody has that the modal
 * still renders what it rendered.
 *
 * ── WHAT IS AND IS NOT CLAIMED TO BE BYTE-IDENTICAL ────────────────────────────────────
 *
 * THE RENDERED DOM must be byte-identical. THE MOVED SOURCE need not be byte-identical in
 * its surroundings: `RunModal` is already a top-level function with eight props that closes
 * over no page state, so unlike 188.2's JSX fragments it needs no new wrapper — but it does
 * acquire a module docblock and its own import lines, and a diff-stat showing more
 * insertions than deletions on the destination side is therefore expected and is NOT
 * evidence of drift. A diff against the strings below is.
 */
const RUN_MODAL_HTML_BASELINE: Record<string, string> = {
  BOUND_WITH_FOLDERS: "<div class=\"w-[min(560px,92%)] overflow-hidden rounded-lg border border-border bg-card shadow-lg\"><div class=\"flex items-center gap-2 border-b border-border px-4 py-3\"><span aria-hidden=\"true\">📄</span><span class=\"text-[15px] font-semibold text-foreground\">Vendor-risk review</span></div><div class=\"flex flex-col gap-3 px-4 py-4\"><label data-testid=\"run-scope\" class=\"flex flex-col gap-1.5\"><span class=\"text-[13px] font-medium text-foreground\">Knowledge base:</span><select data-testid=\"run-scope-select\" class=\"rounded-md border border-border bg-card px-2.5 py-1.5 text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30\"><option value=\"\">Workflow default — 📁 DBA Chapters</option><option value=\"folder-bbb\">📁 Contracts</option></select></label><label class=\"flex flex-col gap-1.5\"><span class=\"text-[13px] font-medium text-foreground\">What should this run work on?</span><textarea data-testid=\"run-kickoff\" rows=\"3\" placeholder=\"Describe the task for this run…\" class=\"w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\"></textarea></label><div class=\"flex flex-col gap-1.5\"><p data-testid=\"run-template-label\" class=\"px-0.5 text-[13px] font-medium text-foreground\">Template to fill</p><input accept=\".docx,.pptx,.xlsx,.md,.json,.csv,.txt,.py,.js,.sh,.png,.jpg,.jpeg,.gif,.webp\" aria-label=\"Upload template file\" tabindex=\"-1\" class=\"hidden\" type=\"file\"><button type=\"button\" data-testid=\"run-template-upload\" class=\"flex items-center gap-1.5 self-start rounded-md border border-border px-2.5 py-1.5 text-[12px] font-medium text-foreground/80 transition-colors hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-upload h-3.5 w-3.5\" aria-hidden=\"true\"><path d=\"M12 3v12\"></path><path d=\"m17 8-5-5-5 5\"></path><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"></path></svg>Upload template</button><p data-testid=\"run-provenance\" class=\"px-0.5 text-[12px] text-muted-foreground\">Stored untrusted — never run as code, never fed to the fill engine.</p></div><p data-testid=\"run-hint\" class=\"text-[12px] text-muted-foreground\">This workflow expects: <span class=\"font-mono text-foreground\">kickoff_prompt</span></p></div><div class=\"flex items-center justify-between border-t border-border px-4 py-3\"><span class=\"text-[12px] text-muted-foreground\" data-testid=\"run-destination\">Run opens a <b class=\"text-foreground\">new chat thread</b> and streams there.</span><div class=\"flex items-center gap-2\"><button type=\"button\" class=\"rounded-md border border-border px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50\">Cancel</button><button type=\"button\" data-testid=\"run-confirm\" class=\"rounded-md bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60\">▶ Run workflow</button></div></div></div>",
  UNBOUND_NO_PROJECT: "<div class=\"w-[min(560px,92%)] overflow-hidden rounded-lg border border-border bg-card shadow-lg\"><div class=\"flex items-center gap-2 border-b border-border px-4 py-3\"><span aria-hidden=\"true\">📄</span><span class=\"text-[15px] font-semibold text-foreground\">Open scan</span></div><div class=\"flex flex-col gap-3 px-4 py-4\"><label data-testid=\"run-scope\" class=\"flex flex-col gap-1.5\"><span class=\"text-[13px] font-medium text-foreground\">Knowledge base:</span><select data-testid=\"run-scope-select\" class=\"rounded-md border border-border bg-card px-2.5 py-1.5 text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30\"><option value=\"\">All documents</option><option value=\"folder-aaa\">📁 DBA Chapters</option><option value=\"folder-bbb\">📁 Contracts</option></select></label><label class=\"flex flex-col gap-1.5\"><span class=\"text-[13px] font-medium text-foreground\">What should this run work on?</span><textarea data-testid=\"run-kickoff\" rows=\"3\" placeholder=\"Describe the task for this run…\" class=\"w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\"></textarea></label><div class=\"flex flex-col gap-1.5\"><p data-testid=\"run-template-label\" class=\"px-0.5 text-[13px] font-medium text-foreground\">Template to fill</p><input accept=\".docx,.pptx,.xlsx,.md,.json,.csv,.txt,.py,.js,.sh,.png,.jpg,.jpeg,.gif,.webp\" aria-label=\"Upload template file\" tabindex=\"-1\" class=\"hidden\" type=\"file\"><button type=\"button\" data-testid=\"run-template-upload\" class=\"flex items-center gap-1.5 self-start rounded-md border border-border px-2.5 py-1.5 text-[12px] font-medium text-foreground/80 transition-colors hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-upload h-3.5 w-3.5\" aria-hidden=\"true\"><path d=\"M12 3v12\"></path><path d=\"m17 8-5-5-5 5\"></path><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"></path></svg>Upload template</button><p data-testid=\"run-provenance\" class=\"px-0.5 text-[12px] text-muted-foreground\">Stored untrusted — never run as code, never fed to the fill engine.</p></div><p data-testid=\"run-hint\" class=\"text-[12px] text-muted-foreground\">This workflow expects: <span class=\"font-mono text-foreground\">kickoff_prompt</span></p></div><div class=\"flex items-center justify-between border-t border-border px-4 py-3\"><span class=\"text-[12px] text-muted-foreground\" data-testid=\"run-destination\">Run opens a <b class=\"text-foreground\">new chat thread</b> and streams there.</span><div class=\"flex items-center gap-2\"><button type=\"button\" class=\"rounded-md border border-border px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50\">Cancel</button><button type=\"button\" data-testid=\"run-confirm\" class=\"rounded-md bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60\">▶ Run workflow</button></div></div></div>",
  NO_FOLDERS_SCOPE_HIDDEN: "<div class=\"w-[min(560px,92%)] overflow-hidden rounded-lg border border-border bg-card shadow-lg\"><div class=\"flex items-center gap-2 border-b border-border px-4 py-3\"><span aria-hidden=\"true\">📄</span><span class=\"text-[15px] font-semibold text-foreground\">Vendor-risk review</span></div><div class=\"flex flex-col gap-3 px-4 py-4\"><label class=\"flex flex-col gap-1.5\"><span class=\"text-[13px] font-medium text-foreground\">What should this run work on?</span><textarea data-testid=\"run-kickoff\" rows=\"3\" placeholder=\"Describe the task for this run…\" class=\"w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\"></textarea></label><div class=\"flex flex-col gap-1.5\"><p data-testid=\"run-template-label\" class=\"px-0.5 text-[13px] font-medium text-foreground\">Template to fill</p><input accept=\".docx,.pptx,.xlsx,.md,.json,.csv,.txt,.py,.js,.sh,.png,.jpg,.jpeg,.gif,.webp\" aria-label=\"Upload template file\" tabindex=\"-1\" class=\"hidden\" type=\"file\"><button type=\"button\" data-testid=\"run-template-upload\" class=\"flex items-center gap-1.5 self-start rounded-md border border-border px-2.5 py-1.5 text-[12px] font-medium text-foreground/80 transition-colors hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-upload h-3.5 w-3.5\" aria-hidden=\"true\"><path d=\"M12 3v12\"></path><path d=\"m17 8-5-5-5 5\"></path><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"></path></svg>Upload template</button><p data-testid=\"run-provenance\" class=\"px-0.5 text-[12px] text-muted-foreground\">Stored untrusted — never run as code, never fed to the fill engine.</p></div><p data-testid=\"run-hint\" class=\"text-[12px] text-muted-foreground\">This workflow expects: <span class=\"font-mono text-foreground\">kickoff_prompt</span></p></div><div class=\"flex items-center justify-between border-t border-border px-4 py-3\"><span class=\"text-[12px] text-muted-foreground\" data-testid=\"run-destination\">Run opens a <b class=\"text-foreground\">new chat thread</b> and streams there.</span><div class=\"flex items-center gap-2\"><button type=\"button\" class=\"rounded-md border border-border px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50\">Cancel</button><button type=\"button\" data-testid=\"run-confirm\" class=\"rounded-md bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60\">▶ Run workflow</button></div></div></div>",
  TEMPLATE_STAGED: "<div class=\"w-[min(560px,92%)] overflow-hidden rounded-lg border border-border bg-card shadow-lg\"><div class=\"flex items-center gap-2 border-b border-border px-4 py-3\"><span aria-hidden=\"true\">📄</span><span class=\"text-[15px] font-semibold text-foreground\">Vendor-risk review</span></div><div class=\"flex flex-col gap-3 px-4 py-4\"><label data-testid=\"run-scope\" class=\"flex flex-col gap-1.5\"><span class=\"text-[13px] font-medium text-foreground\">Knowledge base:</span><select data-testid=\"run-scope-select\" class=\"rounded-md border border-border bg-card px-2.5 py-1.5 text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30\"><option value=\"\">Workflow default — 📁 DBA Chapters</option><option value=\"folder-bbb\">📁 Contracts</option></select></label><label class=\"flex flex-col gap-1.5\"><span class=\"text-[13px] font-medium text-foreground\">What should this run work on?</span><textarea data-testid=\"run-kickoff\" rows=\"3\" placeholder=\"Describe the task for this run…\" class=\"w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\"></textarea></label><div class=\"flex flex-col gap-1.5\"><p data-testid=\"run-template-label\" class=\"px-0.5 text-[13px] font-medium text-foreground\">Template to fill</p><input accept=\".docx,.pptx,.xlsx,.md,.json,.csv,.txt,.py,.js,.sh,.png,.jpg,.jpeg,.gif,.webp\" aria-label=\"Upload template file\" tabindex=\"-1\" class=\"hidden\" type=\"file\"><div data-testid=\"run-template-file\" class=\"flex items-center gap-2 self-start rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-[12px]\"><span class=\"text-foreground\">template.docx</span><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-check h-3.5 w-3.5 text-success\" aria-hidden=\"true\"><path d=\"M20 6 9 17l-5-5\"></path></svg><button type=\"button\" aria-label=\"Remove template\" class=\"text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-x h-3 w-3\" aria-hidden=\"true\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg></button></div><p data-testid=\"run-provenance\" class=\"px-0.5 text-[12px] text-muted-foreground\">Stored untrusted — never run as code, never fed to the fill engine.</p></div><p data-testid=\"run-hint\" class=\"text-[12px] text-muted-foreground\">This workflow expects: <span class=\"font-mono text-foreground\">kickoff_prompt</span></p></div><div class=\"flex items-center justify-between border-t border-border px-4 py-3\"><span class=\"text-[12px] text-muted-foreground\" data-testid=\"run-destination\">Run opens a <b class=\"text-foreground\">new chat thread</b> and streams there.</span><div class=\"flex items-center gap-2\"><button type=\"button\" class=\"rounded-md border border-border px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50\">Cancel</button><button type=\"button\" data-testid=\"run-confirm\" class=\"rounded-md bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60\">▶ Run workflow</button></div></div></div>",
  LAUNCH_ERROR: "<div class=\"w-[min(560px,92%)] overflow-hidden rounded-lg border border-border bg-card shadow-lg\"><div class=\"flex items-center gap-2 border-b border-border px-4 py-3\"><span aria-hidden=\"true\">📄</span><span class=\"text-[15px] font-semibold text-foreground\">Vendor-risk review</span></div><div class=\"flex flex-col gap-3 px-4 py-4\"><label data-testid=\"run-scope\" class=\"flex flex-col gap-1.5\"><span class=\"text-[13px] font-medium text-foreground\">Knowledge base:</span><select data-testid=\"run-scope-select\" class=\"rounded-md border border-border bg-card px-2.5 py-1.5 text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30\"><option value=\"\">Workflow default — 📁 DBA Chapters</option><option value=\"folder-bbb\">📁 Contracts</option></select></label><label class=\"flex flex-col gap-1.5\"><span class=\"text-[13px] font-medium text-foreground\">What should this run work on?</span><textarea data-testid=\"run-kickoff\" rows=\"3\" placeholder=\"Describe the task for this run…\" class=\"w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\"></textarea></label><div class=\"flex flex-col gap-1.5\"><p data-testid=\"run-template-label\" class=\"px-0.5 text-[13px] font-medium text-foreground\">Template to fill</p><input accept=\".docx,.pptx,.xlsx,.md,.json,.csv,.txt,.py,.js,.sh,.png,.jpg,.jpeg,.gif,.webp\" aria-label=\"Upload template file\" tabindex=\"-1\" class=\"hidden\" type=\"file\"><button type=\"button\" data-testid=\"run-template-upload\" class=\"flex items-center gap-1.5 self-start rounded-md border border-border px-2.5 py-1.5 text-[12px] font-medium text-foreground/80 transition-colors hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-upload h-3.5 w-3.5\" aria-hidden=\"true\"><path d=\"M12 3v12\"></path><path d=\"m17 8-5-5-5 5\"></path><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"></path></svg>Upload template</button><p data-testid=\"run-upload-error\" role=\"alert\" class=\"px-0.5 text-[11px] text-destructive\">Template too large — 25 MB max</p><p data-testid=\"run-provenance\" class=\"px-0.5 text-[12px] text-muted-foreground\">Stored untrusted — never run as code, never fed to the fill engine.</p></div><p data-testid=\"run-hint\" class=\"text-[12px] text-muted-foreground\">This workflow expects: <span class=\"font-mono text-foreground\">kickoff_prompt</span></p></div><div class=\"flex items-center justify-between border-t border-border px-4 py-3\"><span class=\"text-[12px] text-muted-foreground\" data-testid=\"run-destination\">Run opens a <b class=\"text-foreground\">new chat thread</b> and streams there.</span><div class=\"flex items-center gap-2\"><button type=\"button\" class=\"rounded-md border border-border px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50\">Cancel</button><button type=\"button\" data-testid=\"run-confirm\" class=\"rounded-md bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60\">▶ Run workflow</button></div></div></div>",
  SUBMITTING: "<div class=\"w-[min(560px,92%)] overflow-hidden rounded-lg border border-border bg-card shadow-lg\"><div class=\"flex items-center gap-2 border-b border-border px-4 py-3\"><span aria-hidden=\"true\">📄</span><span class=\"text-[15px] font-semibold text-foreground\">Vendor-risk review</span></div><div class=\"flex flex-col gap-3 px-4 py-4\"><label data-testid=\"run-scope\" class=\"flex flex-col gap-1.5\"><span class=\"text-[13px] font-medium text-foreground\">Knowledge base:</span><select data-testid=\"run-scope-select\" class=\"rounded-md border border-border bg-card px-2.5 py-1.5 text-[14px] text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30\"><option value=\"\">Workflow default — 📁 DBA Chapters</option><option value=\"folder-bbb\">📁 Contracts</option></select></label><label class=\"flex flex-col gap-1.5\"><span class=\"text-[13px] font-medium text-foreground\">What should this run work on?</span><textarea data-testid=\"run-kickoff\" rows=\"3\" placeholder=\"Describe the task for this run…\" class=\"w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary\"></textarea></label><div class=\"flex flex-col gap-1.5\"><p data-testid=\"run-template-label\" class=\"px-0.5 text-[13px] font-medium text-foreground\">Template to fill</p><input accept=\".docx,.pptx,.xlsx,.md,.json,.csv,.txt,.py,.js,.sh,.png,.jpg,.jpeg,.gif,.webp\" aria-label=\"Upload template file\" tabindex=\"-1\" class=\"hidden\" type=\"file\"><button type=\"button\" data-testid=\"run-template-upload\" class=\"flex items-center gap-1.5 self-start rounded-md border border-border px-2.5 py-1.5 text-[12px] font-medium text-foreground/80 transition-colors hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50\" disabled=\"\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-upload h-3.5 w-3.5\" aria-hidden=\"true\"><path d=\"M12 3v12\"></path><path d=\"m17 8-5-5-5 5\"></path><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"></path></svg>Uploading…</button><p data-testid=\"run-provenance\" class=\"px-0.5 text-[12px] text-muted-foreground\">Stored untrusted — never run as code, never fed to the fill engine.</p></div><p data-testid=\"run-hint\" class=\"text-[12px] text-muted-foreground\">This workflow expects: <span class=\"font-mono text-foreground\">kickoff_prompt</span></p></div><div class=\"flex items-center justify-between border-t border-border px-4 py-3\"><span class=\"text-[12px] text-muted-foreground\" data-testid=\"run-destination\">Run opens a <b class=\"text-foreground\">new chat thread</b> and streams there.</span><div class=\"flex items-center gap-2\"><button type=\"button\" class=\"rounded-md border border-border px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50\" disabled=\"\">Cancel</button><button type=\"button\" data-testid=\"run-confirm\" class=\"rounded-md bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60\" disabled=\"\">Running…</button></div></div></div>",
}

/** Same discipline, same provenance — read out of the DOM, never typed. */
const RUN_DESTINATION_BASELINE: Record<string, string> = {
  GATE_OFF: "Run opens a <b class=\"text-foreground\">new chat thread</b> and streams there.",
  GATE_ON: "Run opens this workflow's <b class=\"text-foreground\">run surface</b>. The chat thread is still created, and stays reachable from there.",
}

describe("RunModal 192-03 — the pre-move rendered DOM, byte for byte", () => {
  it("the capture commit is recorded, and the destination module does not exist in it", () => {
    // The mechanical half of the proof lives in the block comment above (the three commands
    // and their verbatim output) and in 192-03-SUMMARY.md. This pins the SHA those commands
    // were run at, so a later reader can re-run them rather than take the claim on trust.
    expect(CAPTURE_SHA).toMatch(/^[0-9a-f]{40}$/)
  })

  it("the 193-07 re-capture commit is recorded BESIDE the original, not instead of it", () => {
    // Both SHAs live in the file, so the history of these six strings is readable rather than
    // overwritten: taken at CAPTURE_SHA, re-taken once at RECAPTURE_SHA_193_07 for D-18's label.
    expect(RECAPTURE_SHA_193_07).toMatch(/^[0-9a-f]{40}$/)
    expect(RECAPTURE_SHA_193_07).not.toBe(CAPTURE_SHA)
  })

  for (const row of Object.keys(RUN_MODAL_HTML_ROWS)) {
    it(`${row} reproduces the DOM CAPTURED from the unmoved tree, byte for byte`, async () => {
      // NON-VACUITY, first: a `toBe` against an empty string would pass forever if the row
      // ever stopped rendering and the baseline were ever re-captured from that silence.
      expect(RUN_MODAL_HTML_BASELINE[row].length).toBeGreaterThan(0)
      expect(await runModalCapture(RUN_MODAL_HTML_ROWS[row])).toBe(RUN_MODAL_HTML_BASELINE[row])
    })
  }

  for (const row of Object.keys(RUN_DESTINATION_ROWS)) {
    it(`run-destination ${row} reproduces the CAPTURED copy, byte for byte`, async () => {
      expect(RUN_DESTINATION_BASELINE[row].length).toBeGreaterThan(0)
      expect(await runModalCapture(RUN_DESTINATION_ROWS[row])).toBe(
        RUN_DESTINATION_BASELINE[row],
      )
    })
  }

  // ── THE MARKER ROWS ────────────────────────────────────────────────────────────────
  // Byte-identity alone is compatible with a row that quietly rendered nothing: an empty
  // capture equals an empty render forever. These rows say WHAT each capture contains, so a
  // state that stopped painting its blocks is a failure rather than a pass. They read the
  // COMMITTED baseline strings, not a fresh render — the claim being pinned is about what
  // was captured.

  // ── 193-07: `run-template-label` JOINS THE MARKER ROWS. D-18's node is added to the states
  //    that carry it (every state here — all six fixtures `admit`), so the new node is covered
  //    by the "byte-identity cannot ratify a blank render" guard instead of living outside it.
  //    A future edit that dropped the label while the baselines were re-captured from that
  //    silence would pass byte-identity and fail here, which is the whole job of these rows.

  it("BOUND_WITH_FOLDERS captured the whole modal body — scope, kickoff, LABEL, upload, provenance, hint, destination", () => {
    const html = RUN_MODAL_HTML_BASELINE.BOUND_WITH_FOLDERS
    for (const testId of [
      "run-scope",
      "run-scope-select",
      "run-kickoff",
      "run-template-label",
      "run-template-upload",
      "run-provenance",
      "run-hint",
      "run-destination",
      "run-confirm",
    ]) {
      expect(html).toContain(`data-testid="${testId}"`)
    }
    // The bound workflow's honest "" label (WR-05) — never the whole-KB lie.
    expect(html).toContain("Workflow default")
    expect(html).not.toContain("All documents")
    // Idle: no staged file card and no launch error.
    expect(html).not.toContain('data-testid="run-template-file"')
    expect(html).not.toContain('data-testid="run-upload-error"')
    // D-18's label carries its words, not just its testid — an empty label is a label that
    // names nothing, and byte-identity would happily ratify one.
    expect(html).toContain(">Template to fill</p>")
  })

  it("EVERY captured state carries the LABEL and the provenance line — all six fixtures admit", () => {
    // The six fixtures all declare an `llm_emit` phase with no `emitter` key, so under D-25's
    // default rule every one of them ADMITS and D-17 hides nothing in any capture. Stated as a
    // row rather than as prose: if a later edit made any fixture read `does-not-admit`, its
    // capture would lose the whole block and this is what would say so.
    for (const [state, html] of Object.entries(RUN_MODAL_HTML_BASELINE)) {
      expect(html, state).toContain('data-testid="run-template-label"')
      expect(html, state).toContain("Template to fill")
      expect(html, state).toContain('data-testid="run-provenance"')
      expect(html, state).toContain(
        "Stored untrusted — never run as code, never fed to the fill engine.",
      )
      // The label precedes the control it names, in every state.
      const labelAt = html.indexOf('data-testid="run-template-label"')
      const controlAt = Math.max(
        html.indexOf('data-testid="run-template-upload"'),
        html.indexOf('data-testid="run-template-file"'),
      )
      expect(labelAt, state).toBeGreaterThan(-1)
      expect(controlAt, state).toBeGreaterThan(labelAt)
    }
  })

  it("UNBOUND_NO_PROJECT captured the honest whole-KB label — the other side of the WR-05 branch", () => {
    const html = RUN_MODAL_HTML_BASELINE.UNBOUND_NO_PROJECT
    expect(html).toContain("All documents")
    expect(html).not.toContain("Workflow default")
    expect(html).toContain('data-testid="run-scope-select"')
  })

  it("NO_FOLDERS_SCOPE_HIDDEN captured NO scope control at all — the folders.length guard", () => {
    const html = RUN_MODAL_HTML_BASELINE.NO_FOLDERS_SCOPE_HIDDEN
    expect(html).not.toContain('data-testid="run-scope"')
    expect(html).not.toContain('data-testid="run-scope-select"')
    // …and the rest of the modal is still there, so the row is a hidden control and not a
    // modal that failed to open.
    expect(html).toContain('data-testid="run-kickoff"')
    expect(html).toContain('data-testid="run-confirm"')
  })

  it("TEMPLATE_STAGED captured the file card AND the upload button's ABSENCE", () => {
    const html = RUN_MODAL_HTML_BASELINE.TEMPLATE_STAGED
    expect(html).toContain('data-testid="run-template-file"')
    expect(html).toContain("template.docx")
    expect(html).toContain('aria-label="Remove template"')
    // The button is REPLACED by the card, not accompanied by it.
    expect(html).not.toContain('data-testid="run-template-upload"')
  })

  it("LAUNCH_ERROR captured role='alert' carrying the server message VERBATIM", () => {
    const html = RUN_MODAL_HTML_BASELINE.LAUNCH_ERROR
    expect(html).toContain('data-testid="run-upload-error"')
    expect(html).toContain('role="alert"')
    expect(html).toContain("Template too large — 25 MB max")
  })

  it("SUBMITTING captured the in-flight face — 'Running…' and the disabled controls", () => {
    const html = RUN_MODAL_HTML_BASELINE.SUBMITTING
    expect(html).toContain("Running…")
    expect(html).toContain("Uploading…")
    expect(html).toContain("disabled")
    // The idle labels are gone, so this is genuinely the in-flight render.
    expect(html).not.toContain("▶ Run workflow")
  })

  it("the two run-destination captures DIFFER — the canvas-gate branch is real, and both sides are pinned", () => {
    const off = RUN_DESTINATION_BASELINE.GATE_OFF
    const on = RUN_DESTINATION_BASELINE.GATE_ON
    expect(off).not.toBe(on)
    expect(off).toContain("new chat thread")
    expect(on).toContain("run surface")
    // A collapse of the branch in either direction is caught: neither side may carry the
    // other's noun.
    expect(off).not.toContain("run surface")
    expect(on).not.toContain("new chat thread")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Plan 192-06 Task 2 (D-01) — THE CUT, AND THE GUARD THE CUT MADE TESTABLE.
//
// Appended as a PURE INSERTION, same discipline as the 192-03 block above: nothing
// already in this file was edited, renamed or re-described, and not one import line
// was widened. `RunModal` and the page's own source both arrive through dynamic
// `await import(…)` inside the blocks that use them.
//
// TWO THINGS ARE PINNED HERE, AND THEY ARE DIFFERENT KINDS OF CLAIM.
//
//  1. THE EDGE HAS ONE DIRECTION. The page imports the module, declares the
//     component nowhere, and left NO re-export shim. The third clause is the one
//     that is easy to skip and the one that matters: without it the two negatives
//     are also satisfied by two modules nobody uses, and a shim would quietly
//     preserve exactly the coupling the cut exists to remove while every other
//     assertion here stayed green (`WorkflowCanvas.test.tsx:756-763`).
//
//  2. F1 FROM 192-03 IS CLOSED. That summary recorded, BY PLANT, that the
//     mid-launch dismissal guard is DOUBLE — the modal's own `if (!submitting)`
//     and the page's `onCancel` (`if (runSubmitting) return`) — and that deleting
//     the MODAL's half ALONE left the a11y row GREEN, because the page's half
//     still refused. So no assertion in this repo covered the modal's own guard,
//     and D-01 moves the modal while LEAVING `onCancel` on the page: dropping the
//     inner guard during the move would have been invisible.
//
//     192-03 named the fix and named why it could not do it: closing this needs
//     `RunModal` rendered IN ISOLATION, which was impossible while the component
//     was a module-private function inside a 1407-line page. The cut is what makes
//     it possible, so the assertion lands in the same commit as the cut.
//
//     The rows below render the component DIRECTLY with an `onCancel` that has no
//     outer guard of any kind. Escape mid-launch must not reach it. Driven RED
//     against a real deletion of `if (!submitting)` in
//     `components/workflows/library/RunModal.tsx`, then restored — the observed
//     output is recorded in 192-06-SUMMARY.md rather than asserted here.
// ═══════════════════════════════════════════════════════════════════════════════

/** Types only — `typeof import(…)` is a type expression and adds no import line. */
type RunModalModule = typeof import("@/components/workflows/library/RunModal")
type RunModalPropsT = Parameters<RunModalModule["RunModal"]>[0]

/**
 * A minimal published row for the ISOLATED render. Deliberately NOT one of the fixtures
 * above: those exist to drive the page's feed, and reusing one here would blur whether the
 * modal or the page is under test — which is the entire point of these rows.
 */
const isolatedWf: RunModalPropsT["wf"] = {
  id: "iso-1",
  slug: "isolated",
  name: "Isolated modal",
}

/** Render `RunModal` alone, with NO page around it and NO outer guard on `onCancel`. */
async function renderIsolatedModal(submitting: boolean) {
  const { RunModal } = await import("@/components/workflows/library/RunModal")
  const onCancel = vi.fn()
  const rendered = render(
    <RunModal
      wf={isolatedWf}
      folders={[]}
      authorDefaultFolderId={null}
      kickoff=""
      submitting={submitting}
      onKickoffChange={() => {}}
      onCancel={onCancel}
      onRun={async () => {}}
    />,
  )
  return { onCancel, rendered }
}

describe("RunModal 192-06 — the cut has one direction", () => {
  it("the page imports the modal, declares it nowhere, and left no re-export shim", async () => {
    const pageSource = (await import("../WorkflowsPage?raw")).default as string

    // NON-VACUITY first: a `?raw` import that silently resolved to "" would satisfy every
    // negative below forever.
    expect(pageSource.length).toBeGreaterThan(10000)

    // The edge exists, and it points at the library module.
    expect(pageSource).toMatch(
      /import \{ RunModal \} from ["']@\/components\/workflows\/library\/RunModal["']/,
    )
    // The declaration is GONE from the page — this is a cut, not a copy.
    expect(pageSource).not.toContain("function RunModal(")
    // …and no shim was left behind, in either spelling.
    expect(pageSource).not.toContain("export { RunModal")
    expect(pageSource).not.toContain("export * from")

    // The render site survived the cut with its identity-forcing key: `key={runFor.id}` is
    // what resets the staged file and the scope pick between two different workflows, so a
    // cut that dropped it would be a real behaviour change no capture above could see (each
    // capture opens exactly one modal, exactly once).
    expect(pageSource).toContain("key={runFor.id}")
  })

  it("the page still exports the component the cut deleted 353 lines above", () => {
    // The delete range ended three lines above `export default WorkflowsPage`, so an
    // off-by-one would have taken the page's own export with it. Also pinned byte-exact in
    // `WorkflowBuilderPage.header.test.tsx` (which holds the signature line as a plant
    // target and is pinned at 32); this row is the cheap local tell.
    expect(typeof WorkflowsPage).toBe("function")
  })
})

describe("RunModal 192-06 — the modal's OWN mid-launch guard (192-03 F1, closed)", () => {
  it("Escape mid-launch does NOT reach onCancel — the modal refuses on its own", async () => {
    const { onCancel, rendered } = await renderIsolatedModal(true)
    await screen.findByTestId("run-modal")

    fireEvent.keyDown(document, { key: "Escape" })

    // No page wrapper exists here, so nothing but the component's own `if (!submitting)`
    // can be producing this. THIS is the assertion 192-03 measured it could not make.
    expect(onCancel).not.toHaveBeenCalled()
    rendered.unmount()
  })

  it("POSITIVE CONTROL — the same Escape DOES reach onCancel when no launch is in flight", async () => {
    // Without this the row above passes for a component that ignores Escape entirely, or
    // one whose keydown listener never attached — a guard proved by a broken wire.
    const { onCancel, rendered } = await renderIsolatedModal(false)
    await screen.findByTestId("run-modal")

    fireEvent.keyDown(document, { key: "Escape" })

    expect(onCancel).toHaveBeenCalledTimes(1)
    rendered.unmount()
  })

  it("the isolated render really is isolated — no page chrome came with it", async () => {
    // If `RunModal` had quietly kept a dependency on the page, the cheapest tell is page
    // furniture appearing around it. The modal is the whole tree here.
    const { rendered } = await renderIsolatedModal(false)
    const modal = await screen.findByTestId("run-modal")

    expect(screen.queryByTestId("published-card")).toBeNull()
    expect(within(modal).getByTestId("run-confirm")).toBeTruthy()
    expect(within(modal).getByTestId("run-kickoff")).toBeTruthy()
    rendered.unmount()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Plan 193-01 Task 2 (D-08 / D-17 / AUTH-03) — LAUNCH FAILURE IS VISIBLE ON A
// WORKFLOW THAT DOES NOT ADMIT A TEMPLATE.
//
// Appended as a PURE INSERTION, the same discipline as the 192-03 and 192-06 blocks
// above: nothing already in this file was edited, renamed or re-described, no import
// line was widened, and NOT ONE `*_BASELINE` literal was touched. `git diff --numstat`
// over this commit reports ZERO DELETIONS — a deletion here would mean a capture had
// been edited to agree with something.
//
// ⚠ WHY THIS CASE EXISTS, WHICH MATTERS MORE THAN WHAT IT DOES.
//
// `handleRun`'s catch sets `launchError` on **ANY** `onRun` rejection —
// `setLaunchError(e instanceof Error ? e.message : "Run failed")`. The comment beside
// it describes the server's `validate_upload` 422 because that is its COMMONEST cause,
// and reading that comment as the whole story is the trap: a scope failure, a network
// failure, a thread-creation failure or any other launch error lands in the SAME node.
// That node — `data-testid="run-upload-error"` `role="alert"` — lives INSIDE the
// `<div className="flex flex-col gap-1.5">` template block that Phase 193's D-17 hides
// on a workflow whose definition does not admit a template.
//
// So a naive cut — wrapping the whole block in the admission predicate — makes LAUNCH
// FAILURES SILENT on every non-template workflow: the run simply does not start and the
// modal says nothing. That is the WR-03 class of defect Phase 192's gap round had to
// repair on this very surface, and it is recorded in 193-CONTEXT.md as one of two
// inherited claims measured FALSE by research.
//
// This case is captured NOW, on the SHIPPED tree where the block always renders and the
// predicate does not yet exist, so that D-17's cut REDS A TEST THAT PREDATES IT rather
// than shipping a silence nobody sees. The correct cut renders the error node OUTSIDE
// the conditional wrapper; this row is what makes that a requirement rather than advice.
//
// It drives the modal DIRECTLY (the 192-06 isolated-render idiom) rather than through
// the page, so nothing here depends on the page's feed and no capture row is disturbed.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A published workflow whose definition contains NO `llm_emit` phase — the shape that will
 * read `does-not-admit` once D-21's predicate ships. Deliberately NOT one of the fixtures
 * above: every one of them declares `config: { phase_type: "llm_emit", citation_policy:
 * "draft" }` and would therefore ADMIT, which is the opposite of the state under test.
 */
const nonAdmittingWf: RunModalPropsT["wf"] = {
  id: "no-template-1",
  slug: "programmatic-only",
  name: "Programmatic only",
  definition: {
    slug: "programmatic-only",
    version: 1,
    project_folder_id: null,
    inputs: [{ key: "kickoff_prompt" }],
    phases: [{ slug: "pull", phase_index: 0, config: { phase_type: "programmatic" } }],
  },
}

/** A distinct, non-upload launch failure. The wording is deliberately NOT about templates:
 *  a message mentioning uploads would be indistinguishable from the 422 the neighbouring
 *  comment describes, which is precisely the conflation this case exists to break. */
const SCOPE_FAILURE = "scope unavailable"

describe("RunModal 193-01 — a launch failure is visible on a NON-admitting workflow", () => {
  it("a rejected launch renders run-upload-error with role=alert and the server's message, on a workflow with no llm_emit phase", async () => {
    // THE FIXTURE CANNOT SILENTLY DRIFT INTO ADMITTING. Asserted here rather than trusted,
    // because the whole case is about the NON-admitting branch: if someone later gives this
    // definition an `llm_emit` phase, the row would keep passing while testing nothing.
    const phases = (nonAdmittingWf.definition as { phases: { config: { phase_type: string } }[] })
      .phases
    // Non-vacuity first: an EMPTY phase list also has no `llm_emit` phase, and would make the
    // filter below trivially true against a workflow that is not a workflow.
    expect(phases.length).toBeGreaterThan(0)
    expect(phases.filter((p) => p.config.phase_type === "llm_emit")).toHaveLength(0)

    const { RunModal } = await import("@/components/workflows/library/RunModal")
    const rendered = render(
      <RunModal
        wf={nonAdmittingWf}
        folders={[]}
        authorDefaultFolderId={null}
        kickoff=""
        submitting={false}
        onKickoffChange={() => {}}
        onCancel={() => {}}
        onRun={async () => {
          throw new Error(SCOPE_FAILURE)
        }}
      />,
    )
    const modal = await screen.findByTestId("run-modal")

    fireEvent.click(within(modal).getByTestId("run-confirm"))

    const alert = await within(modal).findByTestId("run-upload-error")
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveAttribute("role", "alert")
    // VERBATIM, never a friendlier lie — and never the "Run failed" fallback, which would
    // mean the rejection arrived as something other than an Error.
    expect(alert).toHaveTextContent(SCOPE_FAILURE)
    expect(alert).not.toHaveTextContent("Run failed")

    // ⚠ WHERE IT LIVES IS THE POINT, and it is recorded as a MEASUREMENT of the shipped tree
    // rather than as prose: today the alert shares a parent with the upload control and the
    // provenance note, i.e. it sits inside the block D-17 conditionally removes. When that cut
    // lands, this relationship is expected to CHANGE (the alert must move out) — and the
    // assertions above are what force it to move rather than vanish.
    //
    // ── AMENDED BY `193-07` ON THE DAY THE CUT LANDED, EXACTLY AS THE PARAGRAPH ABOVE SAID IT
    //    WOULD BE. The original two lines read:
    //
    //        const provenance = within(modal).getByTestId("run-provenance")
    //        expect(alert.parentElement).toBe(provenance.parentElement)
    //
    //    and they are left visible here rather than deleted, because what they measured is the
    //    whole point of the case. On THIS fixture — a workflow with no `llm_emit` phase, i.e. a
    //    positive `does-not-admit` — D-17 now removes the upload control AND the provenance note
    //    that describes it, so `getByTestId("run-provenance")` throws and the old measurement
    //    cannot be evaluated at all. ⚠ `193-07-PLAN.md` asked for this case to pass UNEDITED and
    //    that acceptance criterion is FALSE on its own inputs: the co-parent line it required to
    //    survive is a measurement OF THE LAYOUT THE CUT REMOVES. The criterion's INTENT — the
    //    alert must MOVE OUT, never VANISH — is what the six assertions above enforce, and all
    //    six are byte-identical to the day `193-01` wrote them. Only this trailing measurement is
    //    restated, in the direction its own author predicted.
    //
    //    Restated: the provenance note is GONE (the control it describes is gone with it), and
    //    the alert is still here, still an alert, still carrying the server's words.
    expect(within(modal).queryByTestId("run-provenance")).toBeNull()
    expect(within(modal).queryByTestId("run-template-upload")).toBeNull()
    expect(modal.contains(alert)).toBe(true)

    rendered.unmount()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Plan 193-07 Task 2 (AUTH-03 / D-17 / D-18 / D-20 / D-21) — ALL FOUR ARMS OF THE
// ADMISSION PREDICATE, READ AT THE RENDERED SURFACE.
//
// WHAT IS VERIFIED, AND WHAT IS DELIBERATELY NOT. Every row below reads the DOM the
// modal produced. NOT ONE of them asserts that `templateAdmission` was CALLED, or
// spies on it, or re-implements it — that is the `192-10` lesson (verify the
// PROPERTY, not the patch): a suite that pins the call site stays green through a
// call site wired to the wrong branch. `templateAdmission` is asserted here in
// exactly one role — as a NON-VACUITY guard on each fixture, so a definition that
// later drifts into a different arm reds the row that names it rather than quietly
// testing the arm next door.
//
// ⚠ THE `unknown` ROW AND THE `admits` ROW CALL THE SAME HELPER, ON PURPOSE.
// D-20 says a definition the wire did not describe renders the control EXACTLY as
// today — the OPPOSITE fallback from the card's (D-15), because hiding here would
// remove a shipped capability (WFIN-01) from 110 of the 145 published rows, whose
// `phases: []` is a stub nobody authored rather than a statement that the workflow
// cannot fill a template. Two hand-written assertion lists would let those two arms
// drift apart one careless edit at a time and still read as "covered". One shared
// helper makes their identical treatment MECHANICAL: a change that weakens `unknown`
// necessarily weakens `admits` too, and `admits` is the arm nobody would dare weaken.
//
// The rows drive `RunModal` DIRECTLY (the `192-06` isolated-render idiom), so no page
// feed is involved and not one capture row above is disturbed.
// ═══════════════════════════════════════════════════════════════════════════════

/** A workflow that ADMITS: one `llm_emit` phase (no `emitter` key → the Pydantic
 *  `render_template` default, D-25) and NO bound library template. */
const admittingWf: RunModalPropsT["wf"] = {
  id: "admits-1",
  slug: "fills-a-template",
  name: "Fills a template",
  definition: {
    slug: "fills-a-template",
    version: 1,
    project_folder_id: null,
    inputs: [{ key: "kickoff_prompt" }],
    phases: [{ slug: "emit", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "draft" } }],
  },
}

/** UNKNOWN: `phases: []` — the shape 110 of 145 published rows carry. The wire said
 *  nothing, so nothing may be concluded, so nothing is taken away. */
const unknownWf: RunModalPropsT["wf"] = {
  id: "unknown-1",
  slug: "unauthored-stub",
  name: "Unauthored stub",
  definition: {
    slug: "unauthored-stub",
    version: 1,
    project_folder_id: null,
    inputs: [{ key: "kickoff_prompt" }],
    phases: [],
  },
}

/** D-21's BOUND arm: an emit phase that WOULD admit, made a positive no by a bound
 *  library template. `_exec_llm_emit` resolves `_emit_bound_asset_ref(definition)` first and
 *  `template_asset_service.py:144` returns UNCONDITIONALLY on that branch — nothing clears the
 *  ref because a user uploaded something — so the run-time upload here is unreachable code and
 *  `Template to fill` would promise what the engine discards. This is the arm a suite would
 *  otherwise never enter: it is invisible to both `admits` and the no-emit-phase no. */
const boundTemplateWf: RunModalPropsT["wf"] = {
  id: "bound-1",
  slug: "binds-a-template",
  name: "Binds a template",
  definition: {
    slug: "binds-a-template",
    version: 1,
    project_folder_id: null,
    inputs: [{ key: "kickoff_prompt" }],
    phases: [{ slug: "emit", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "draft" } }],
    assets: [{ kind: "template", asset_id: "asset-xyz" }],
  },
}

/** Render one workflow's modal in isolation and hand back its dialog root. */
async function renderModalFor(wf: RunModalPropsT["wf"]) {
  const { RunModal } = await import("@/components/workflows/library/RunModal")
  const rendered = render(
    <RunModal
      wf={wf}
      folders={[]}
      authorDefaultFolderId={null}
      kickoff=""
      submitting={false}
      onKickoffChange={() => {}}
      onCancel={() => {}}
      onRun={async () => {}}
    />,
  )
  const modal = await screen.findByTestId("run-modal")
  return { modal, rendered }
}

/**
 * THE SHARED ASSERTION — what "the control, exactly as today, plus its new label" means.
 *
 * Called by BOTH the `admits` row and the `unknown` row and by nothing else, which is what
 * makes D-20's "exactly as today" a mechanical property of this file rather than a promise in
 * a comment. The `expect` calls live here, once.
 */
function expectTemplateBlockPresent(modal: HTMLElement) {
  const label = within(modal).getByTestId("run-template-label")
  // D-18's string, byte-exact — and a TEXT NODE, never a `<label htmlFor>` bound to the
  // hidden `tabIndex={-1}` input (the tag is pinned in RunModal.a11y.test.tsx).
  expect(label).toHaveTextContent("Template to fill")
  expect(within(modal).getByTestId("run-template-upload")).toBeInTheDocument()
  // D-19, byte-exact and unreworded — the em dash and the terminal full stop included.
  expect(within(modal).getByTestId("run-provenance")).toHaveTextContent(
    "Stored untrusted — never run as code, never fed to the fill engine.",
  )
  // The label names the control it sits above: it must PRECEDE the upload button in the DOM,
  // otherwise it labels nothing a reader would connect it to.
  const upload = within(modal).getByTestId("run-template-upload")
  expect(label.compareDocumentPosition(upload) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
}

/** THE OTHER SIDE — absent, and absent in the strong sense D-17 requires. */
function expectTemplateBlockAbsent(modal: HTMLElement) {
  expect(within(modal).queryByTestId("run-template-label")).toBeNull()
  expect(within(modal).queryByTestId("run-template-upload")).toBeNull()
  expect(within(modal).queryByTestId("run-provenance")).toBeNull()
  // ⚠ ABSENT, NOT DISABLED, NOT GREYED (D-17). A disabled control still costs attention and
  // still cannot be used, so "the block is gone" is not satisfied by a survivor wearing
  // `disabled` or `aria-disabled`. Swept over the WHOLE dialog rather than over the testids
  // above, because a greyed survivor would most likely have kept a different testid.
  expect(modal.querySelector("[data-testid^='run-template']")).toBeNull()
  expect(modal.querySelector("[aria-disabled='true']")).toBeNull()
  // …and the modal is still a modal, so this is a hidden control and not a failed render.
  expect(within(modal).getByTestId("run-confirm")).toBeInTheDocument()
  expect(within(modal).getByTestId("run-kickoff")).toBeInTheDocument()
}

describe("RunModal 193-07 — the template block across all three admission states", () => {
  it("admits (an emit phase, nothing bound) → the labelled control, the button and the provenance line", async () => {
    const { templateAdmission } = await import("@/components/workflows/soulData")
    // NON-VACUITY: pin the fixture into the arm this row NAMES. Without it, a later edit to
    // the definition would move the row to a different arm and it would keep passing.
    expect(templateAdmission(admittingWf.definition)).toBe("admits")

    const { modal, rendered } = await renderModalFor(admittingWf)
    expectTemplateBlockPresent(modal)
    rendered.unmount()
  })

  it("unknown (phases: []) → the block renders EXACTLY as on admits — the same helper, deliberately", async () => {
    const { templateAdmission } = await import("@/components/workflows/soulData")
    expect(templateAdmission(unknownWf.definition)).toBe("unknown")

    const { modal, rendered } = await renderModalFor(unknownWf)
    // ⚠ THE SAME FUNCTION THE `admits` ROW CALLS. If this line ever calls a weaker helper,
    // D-20 has been quietly repealed. 110 of 145 published rows land here.
    expectTemplateBlockPresent(modal)
    rendered.unmount()
  })

  it("does-not-admit (no emit phase) → the block is ABSENT, not greyed and not disabled", async () => {
    const { templateAdmission } = await import("@/components/workflows/soulData")
    expect(templateAdmission(nonAdmittingWf.definition)).toBe("does-not-admit")

    const { modal, rendered } = await renderModalFor(nonAdmittingWf)
    expectTemplateBlockAbsent(modal)
    rendered.unmount()
  })

  it("does-not-admit by BINDING (D-21) → an emit phase whose template is already bound gets nothing", async () => {
    const { templateAdmission } = await import("@/components/workflows/soulData")
    // The arm that separates D-21 from the simpler "has an emit phase" predicate: WITHOUT the
    // bound-asset clause this fixture would read `admits` and this row would be a duplicate of
    // the first one. Asserted, so the distinction cannot rot into a coincidence.
    expect(templateAdmission(boundTemplateWf.definition)).toBe("does-not-admit")

    const { modal, rendered } = await renderModalFor(boundTemplateWf)
    expectTemplateBlockAbsent(modal)
    rendered.unmount()
  })

  it("the label is imported, not spelled — the rendered text IS libraryVocabulary's export", async () => {
    // A row that only checked for the words "Template to fill" would pass against a component
    // that hard-codes them, which is the drift `libraryVocabulary.ts` exists to forbid.
    const { RUN_TEMPLATE_LABEL } = await import("@/components/workflows/library/libraryVocabulary")
    expect(RUN_TEMPLATE_LABEL.length).toBeGreaterThan(0)
    const { modal, rendered } = await renderModalFor(admittingWf)
    expect(within(modal).getByTestId("run-template-label").textContent).toBe(RUN_TEMPLATE_LABEL)
    rendered.unmount()
  })
})
