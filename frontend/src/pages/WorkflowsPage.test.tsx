/**
 * Phase 103-06 (REQ-7 / WFAUTH-04) — WorkflowsPage tests.
 *
 * The project-filtered browse + launch home. These tests pin the locked contracts:
 *  - selecting a project re-queries listPublishedWorkflows with that
 *    project_folder_id; "All projects" calls it with no project filter.
 *  - NO draft row exposes a Run affordance; runnable rows DO.
 *  - the tier badge is CLIENT-derived (a draft-policy def renders a different tier
 *    than a strict-policy def) with no extra fetch for the badge.
 *  - the create affordance switches the page view to the Builder.
 *  - Run opens a modal (read-only folder chip + one textarea + hint; enabled on
 *    empty) and clicking Run calls onLaunch(def, kickoff).
 *  - Tweak calls createWorkflowDraft with version = def.version + 1, same slug,
 *    status 'draft' (INSERT — never an UPDATE of the published row), then opens the
 *    Builder.
 *
 * ── Phase 192-10 (D-02) — WHAT THIS FILE'S RESTRUCTURE DID, AND WHAT IT DELIBERATELY
 *    DID NOT DO ──────────────────────────────────────────────────────────────────────
 * 157-B replaced three labelled shelves with ONE flat list under ONE persistent toolbar,
 * so the page's DOM changed underneath every case here. The classification applied was
 * RESEARCH's, and it is worth stating because the distinction is the difference between
 * a real regression and a plan task:
 *
 *   • TWO tests were DELETED, and only two: the pair that asserted the DOM ORDER OF THE
 *     THREE SECTIONS (the published-above-drafts case, and the full
 *     Starters → Published → Drafts case). Both pin a contract D-02 deliberately removes,
 *     and there are no sections left to order. A deletion here is an AUTHORIZED ACT — it
 *     rides in the same commit as the count-gate pin lowering that permits it, with the
 *     reason named there too. (Their old titles are quoted in that commit's message rather
 *     than here: the deletion's own mechanical check is a raw source count of the word
 *     those titles are built on, so quoting them would satisfy the grep that proves them
 *     gone — the trap 192-06, 192-08 and 192-09 each hit once in three other files.)
 *   • FOUR tests were REWRITTEN in the way RESEARCH predicted (the project re-query, the
 *     create affordance, the draft-has-no-Run contract, the starter row).
 *   • ⚠ SEVEN MORE NEEDED THEIR INTERACTION REWRITTEN TOO, and RESEARCH's table did not
 *     predict that — it classified by CONTRACT and those seven contracts are all intact.
 *     What moved was the click target: the fork verb is now ONE WORD inside the card's
 *     `⋯` overflow (D-09/D-12) rather than two differently-labelled buttons on two
 *     different card faces, and the fresh-build entry is the toolbar's. Every assertion
 *     in those seven is unchanged; only the route to it is. Measured, not assumed: the
 *     restructure turned 13 of 23 red, against a predicted 6.
 *   • ONE test was ADDED — the `allSettled` partial-failure path, and it is the most
 *     important row in this file. See its own comment.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

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
  mockDeleteDraft,
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
  mockDeleteDraft: vi.fn(),
}))

// Mock the api seam. The page consumes listPublishedWorkflows + listDraftWorkflows
// + createWorkflowDraft; the hosted Builder consumes generate/create/update +
// listFolders/listSkills (103-ux folder/skill name maps); the Gauntlet consumes publish.
// Phase 143 (WF-01): the curated starters feed consumes listStarterWorkflows.
//
// ⚠ 192-10 (D-18): `deleteWorkflowDraft` is listed because THIS FACTORY IS EXHAUSTIVE — it
// replaces the whole module, so every api symbol the page or anything it mounts imports has
// to appear or the reference throws. `WorkflowCard` is mounted by this page now and reaches
// that client for the draft delete grade. The other five suites that mount this page were
// each RE-RUN rather than pre-emptively edited, and all five stayed green, so none of them
// gained a line it did not need.
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
  deleteWorkflowDraft: mockDeleteDraft,
}))

import { WorkflowsPage } from "./WorkflowsPage"
import type { Folder } from "@/types"

const folders: Folder[] = [
  {
    id: "folder-aaa",
    user_id: "u1",
    name: "DBA Chapters",
    parent_id: null,
    is_org_shared: false,
    created_at: "",
    updated_at: "",
  },
]

/** A strict published def (llm_emit citation_policy 'strict' + the full gate set). */
const strictPublished = {
  id: "pub-1",
  slug: "vendor-risk",
  name: "Vendor-risk review",
  definition: {
    slug: "vendor-risk",
    version: 2,
    project_folder_id: "folder-aaa",
    inputs: [{ key: "kickoff_prompt" }],
    phases: [
      { slug: "pull", phase_index: 0, name: "Pull", config: { phase_type: "programmatic" } },
      {
        slug: "emit",
        phase_index: 1,
        name: "Render report",
        config: { phase_type: "llm_emit", citation_policy: "strict" },
        validators: [
          { kind: "citations_required" },
          { kind: "output_file_valid" },
          { kind: "structure_check" },
          { kind: "freshness" },
          { kind: "llm_judge_rubric" },
        ],
      },
    ],
  },
}

/** A draft-policy published def (citation_policy 'draft', no floor-raising gate). */
const loosePublished = {
  id: "pub-2",
  slug: "quick-notes",
  name: "Quick notes",
  definition: {
    slug: "quick-notes",
    version: 1,
    project_folder_id: null,
    phases: [{ slug: "emit", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "draft" } }],
  },
}

const draftRow = {
  id: "draft-1",
  slug: "contract-clause",
  version: 1,
  name: "Contract clause review",
  definition: {
    slug: "contract-clause",
    version: 1,
    phases: [{ slug: "draft", phase_index: 0, config: { phase_type: "llm_agent" } }],
  },
}

/**
 * Phase 143 (WF-01) — a curated starter (is_system_global published, category='starter').
 * A two-phase KB→document def: retrieve (llm_agent) → emit (llm_emit strict). The
 * fresh-copy fork (D-143-1) mints a NEW suffixed slug + v1 off this seeded slug.
 */
const starterRow = {
  id: "starter-1",
  slug: "risk-register",
  name: "Risk Register",
  definition: {
    slug: "risk-register",
    version: 1,
    name: "Risk Register",
    status: "published",
    category: "starter",
    phases: [
      { slug: "retrieve", phase_index: 0, config: { phase_type: "llm_agent" } },
      {
        slug: "emit",
        phase_index: 1,
        config: { phase_type: "llm_emit", citation_policy: "strict" },
      },
    ],
  },
}

/**
 * 192-10 (D-05) — pick a project through the TOOLBAR'S SELECT.
 *
 * The 200px rail is gone and its `FilterItem` toggles with it, so `click(getByText(name))`
 * now lands on an `<option>` — which fires no `change` event in jsdom and would leave the
 * selection silently unmoved. Driving the `<select>` is the honest equivalent of what the
 * rail click used to do, and every assertion built on it is unchanged.
 */
function selectProject(value: string) {
  fireEvent.change(screen.getByTestId("library-project-select"), { target: { value } })
}

/**
 * 192-10 (D-09 / D-12) — reach the fork verb.
 *
 * The fork is no longer a button on a card face: D-09 gives each row ONE primary verb and
 * puts everything else behind a quiet `⋯`, and D-12 keeps the two fork HANDLERS separate
 * behind ONE shared word. So the route to `published-tweak` / `use-starter` is now: open the
 * row's overflow, then pick the item. The shim below is the shipped one — Radix's menu uses
 * pointer-capture and `scrollIntoView`, neither of which jsdom implements.
 */
async function openOverflow(card: HTMLElement) {
  const user = userEvent.setup()
  await user.click(within(card).getByRole("button", { name: /workflow actions/i }))
  await screen.findByRole("menu")
  return user
}

beforeEach(() => {
  vi.clearAllMocks()
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
  mockListPublished.mockResolvedValue([strictPublished, loosePublished])
  mockListDrafts.mockResolvedValue([draftRow])
  mockListStarters.mockResolvedValue([starterRow])
  mockCreateDraft.mockResolvedValue({ id: "new-draft", version: 3 })
  // The hosted Builder fetches folders + skills on mount (103-ux name maps).
  mockListFolders.mockResolvedValue(folders)
  mockListSkills.mockResolvedValue([])
})

describe("WorkflowsPage — project filter (live ?project_folder_id= re-query)", () => {
  it("'All projects' calls listPublishedWorkflows with no project filter on mount", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    await waitFor(() => expect(mockListPublished).toHaveBeenCalled())
    // First call (All projects, the default) is invoked with a null/undefined project arg.
    const firstArg = mockListPublished.mock.calls[0][0]
    expect(firstArg == null).toBe(true)
  })

  it("selecting a project re-queries listPublishedWorkflows with that project_folder_id", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    await waitFor(() => expect(mockListPublished).toHaveBeenCalled())
    mockListPublished.mockClear()
    // 192-10 (D-05): the instrument changed from a rail toggle to one toolbar select. The
    // CONTRACT below — which arguments the re-query is made with — is byte-for-byte the one
    // this case has always asserted.
    selectProject("folder-aaa")
    // Phase 143 (D-143-2a): the Workflows-page published feed opts into scope:"mine"
    // (mine-only de-dupe). The project folder id stays the FIRST arg; scope rides in the
    // 3rd options arg so the composer picker / WorkspacePanel (no scope) stay unchanged.
    await waitFor(() =>
      expect(mockListPublished).toHaveBeenCalledWith("folder-aaa", undefined, { scope: "mine" }),
    )
  })

  it("latest-wins: a STALE earlier response never paints over the current selection", async () => {
    // The "All projects" (mount) fetch resolves SLOWLY; the project fetch resolves
    // FIRST. The rendered list must match the LATER selection, not the stale mount one.
    let releaseAll: (rows: unknown[]) => void = () => {}
    const slowAll = new Promise<unknown[]>((r) => (releaseAll = r))
    // First call (All projects, mount) → the slow promise; second (project) → fast.
    mockListPublished.mockReset()
    mockListPublished
      .mockReturnValueOnce(slowAll) // mount: All projects (7 imaginary rows) — stale
      .mockResolvedValueOnce([strictPublished]) // project filter: exactly 1 row

    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    // Switch to the project BEFORE the mount fetch resolves.
    //
    // ⚠ 192-10: THIS ROW IS WHY THE TOOLBAR MOUNTS DURING THE FIRST LOAD RATHER THAN AFTER
    // IT. The state under test is precisely "the mount fetch has not returned and the
    // selection moves anyway", so a toolbar withheld until the first settle would make the
    // project control unreachable in the one state this guard exists to cover. RESEARCH
    // classified this case as "must stay green" WITHOUT a rewrite; measured, its interaction
    // had to change for the same reason the case above it did.
    selectProject("folder-aaa")
    // The project (later) fetch resolves first → 1 published row.
    await waitFor(() => expect(screen.getAllByTestId("published-card")).toHaveLength(1))
    // Now the stale mount fetch finally resolves with a DIFFERENT (larger) list.
    releaseAll([strictPublished, loosePublished])
    // It must be DROPPED — the rendered list stays at the current selection (1 row).
    await waitFor(() => expect(mockListPublished).toHaveBeenCalledTimes(2))
    expect(screen.getAllByTestId("published-card")).toHaveLength(1)
  })
})

// ── 192-10 (D-16, T-192-03) — THE MERGE TRAP, PROVED RATHER THAN ARGUED ────────────────

describe("WorkflowsPage — a refused feed subtracts ONLY itself (D-16, the RUN CARVE-OUT)", () => {
  it("a REJECTED /workflows/drafts still renders the published rows and the starter", async () => {
    // ⚠ THE SINGLE HIGHEST-RISK DEFECT THE D-16 MERGE CAN SHIP, and the only mechanical
    // guard against it.
    //
    // `GET /workflows/drafts` carries `require_visible("workflow_authoring")`. `GET
    // /workflows/published` and `GET /workflows/starters` carry NO dependency at all —
    // they are the Phase-148 RUN CARVE-OUT, the feeds that keep Run working for EVERY user,
    // and the backend says so verbatim at the route. A `Promise.all` plus one shared error
    // path therefore turns a 403 on the gated feed into an EMPTY LIBRARY: the gate
    // re-introduced client-side, on exactly the two feeds the carve-out withheld it from.
    //
    // A test in which all three feeds resolve does not test this AT ALL — it is green
    // against `all` and against `allSettled` alike. This one is not.
    mockListDrafts.mockRejectedValue(new Error("403 Forbidden"))

    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)

    // The two carve-out feeds render in full…
    await waitFor(() => expect(screen.getAllByTestId("published-card")).toHaveLength(2))
    expect(screen.getByTestId("starter-card")).toBeInTheDocument()
    // …the refused one degrades to ZERO DRAFTS, not to zero library…
    expect(screen.queryByTestId("draft-card")).toBeNull()
    // …and the failure is NAMED rather than folded into a page-wide error, so a partial
    // library is never presented as a complete one.
    expect(screen.getByTestId("library-source-failed-draft")).toBeInTheDocument()
    // The two feeds that succeeded say nothing, because nothing went wrong with them.
    expect(screen.queryByTestId("library-source-failed-published")).toBeNull()
    expect(screen.queryByTestId("library-source-failed-starter")).toBeNull()

    // ── ⚠ AND THE SHAPE, BECAUSE THE BEHAVIOURAL HALF ABOVE CANNOT SEE IT ──────────────
    // This was MEASURED, not assumed. Swapping the aggregate to `Promise.all` and driving
    // the case above leaves it GREEN — because the isolation that actually saves the
    // library is the PER-SOURCE try/catch inside each refetch, and the aggregate's only
    // remaining job is to settle without throwing. (The plant that DOES redden the case
    // above is the real defect: gating the list on "no source failed", which is the single
    // shared error path RESEARCH names. It was driven RED and restored md5-identical.)
    //
    // So the keyword is pinned separately, on the source, rather than claimed by a
    // behavioural assertion that cannot distinguish it. `Promise.all` must never reappear
    // here: the day the aggregate acquires a consumer again — a settle-gated spinner, a
    // telemetry hook — `all` would silently re-introduce exactly the coupling the carve-out
    // exists to prevent, and no behavioural test would notice.
    const pageSource = (await import("./WorkflowsPage?raw")).default as string
    expect(pageSource.length).toBeGreaterThan(10000) // non-vacuity: an empty `?raw` proves nothing
    expect(pageSource).toContain("Promise.allSettled(")
    expect(pageSource).not.toContain("Promise.all(")
  })
})

/**
 * ⚠ TWO TESTS WERE DELETED HERE, AND THE DELETION IS THE POINT OF THE COMMENT.
 *
 *   1. the published-above-drafts DOM-order case (BUG-260628-01 fold, D-143-5), which lived
 *      in this block;
 *   2. the full Starters → Published → Drafts order case (SC-e), which lived in the starter
 *      block below.
 *
 * Both asserted an ORDER OF SECTIONS, and D-02 deletes the sections. There is no ordering
 * left to be right or wrong about — one flat list has one order — and the taxonomy those
 * three sections carried survives as three of the toolbar's six chips.
 *
 * The BUG they folded is NOT un-fixed by removing them. BUG-260628-01 was "runnable work is
 * buried under drafts"; 157-B's answer is stronger than re-ordering three sections, because a
 * user who wants runnable rows now says so with the *Ready to run* chip and gets exactly the
 * count that chip promised — which `libraryFilter.test.ts` proves as arithmetic, per chip.
 *
 * These two deletions are the ONLY ones in this file, and they are what authorizes the ONE
 * count-gate pin lowering this phase makes. The lowering rides in the same commit, at a
 * number read from the gate's own `actual` column — never to make a red gate go quiet.
 */
describe("WorkflowsPage — the create affordance and the draft-cannot-Run contract", () => {
  it("the toolbar create affordance opens the two-door chooser (WUX-02)", async () => {
    // 192-10 (D-02): the dashed build-card was the first cell of the THIRD grid and died
    // with the shelves; SC#4's fix is structural, not a promotion — create now LEADS a
    // persistent toolbar and cannot drift back down a grid because there is no grid above
    // it. The half of this case that matters is the seam to Phase 193, and it is untouched:
    // a fresh build still lands at the two-door chooser, not at the describe screen.
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const create = await screen.findByTestId("library-create")
    expect(create).toBeInTheDocument()
    fireEvent.click(create)
    expect(await screen.findByTestId("workflow-doors")).toBeInTheDocument()
    expect(screen.getByTestId("door-card-describe")).toBeInTheDocument()
    expect(screen.getByTestId("door-card-govern")).toBeInTheDocument()
  })

  it("NO draft row exposes a Run affordance, in its face OR its menu; runnable rows DO", async () => {
    // ⚠ THE LOAD-BEARING HALF, REWRITTEN RATHER THAN DELETED. "A draft cannot be Run
    // (publish is the test)" is stated in the page's own docblock and this is the only
    // page-level mechanical guard on it. D-09 keeps the invariant exactly; what changed is
    // that `Publish…` is GONE (D-10 — it was a button that opened the editor, so its label
    // lied), and the draft's one verb is `✎ Open`.
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const draftCard = await screen.findByTestId("draft-card")
    expect(within(draftCard).queryByTestId("published-run")).not.toBeInTheDocument()
    expect(within(draftCard).getByTestId("draft-open")).toBeInTheDocument()
    // D-10: the button that lied is gone from the row entirely.
    expect(within(draftCard).queryByTestId("draft-publish")).not.toBeInTheDocument()
    // …and it is not hiding in the overflow either — an absence proved only on the face
    // would be satisfied by a Run that merely moved behind the `⋯`.
    await openOverflow(draftCard)
    const menu = screen.getByRole("menu")
    expect(within(menu).queryByTestId("published-run")).not.toBeInTheDocument()
    expect(within(menu).queryByTestId("draft-publish")).not.toBeInTheDocument()

    // The runnable rows carry Run.
    const published = await screen.findAllByTestId("published-card")
    expect(within(published[0]).getByTestId("published-run")).toBeInTheDocument()
  })
})

describe("WorkflowsPage — card renders the shared WorkflowSoul (WUX-01, D10, no extra fetch)", () => {
  it("a published card renders a WorkflowSoul (the card-scale soul + its derived tier chip)", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    // The shared soul mounts at card scale (replacing the old TierBadge/PhaseChain trio).
    const soul = within(cards[0]).getByTestId("workflow-soul")
    expect(soul.getAttribute("data-scale")).toBe("card")
    // And it carries the soul's derived tier chip + glyph-dot spine.
    expect(within(cards[0]).getByTestId("soul-tier")).toBeInTheDocument()
    expect(within(cards[0]).getByTestId("soul-spine")).toBeInTheDocument()
    // The OLD ad-hoc trio is gone from the card body.
    expect(within(cards[0]).queryByTestId("tier-badge")).not.toBeInTheDocument()
    expect(within(cards[0]).queryByTestId("phase-chain")).not.toBeInTheDocument()
  })

  it("a strict-policy def renders a different soul tier chip than a draft-policy def (derived, no per-card fetch)", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    const strictTier = within(cards[0]).getByTestId("soul-tier")
    const looseTier = within(cards[1]).getByTestId("soul-tier")
    expect(strictTier.getAttribute("data-tier")).toBe("STRICT")
    expect(looseTier.getAttribute("data-tier")).toBe("LOOSE")
    expect(strictTier.getAttribute("data-tier")).not.toBe(looseTier.getAttribute("data-tier"))
    // The tier is derived: listPublishedWorkflows was the ONLY fetch (no per-card call).
    expect(mockListPublished).toHaveBeenCalledTimes(1)
  })
})

describe("WorkflowsPage — soul tier picks the STRICTEST emit policy (WR-03, order-independent)", () => {
  it("a [flag, strict, partial] multi-emit def derives STRICT regardless of phase order", async () => {
    // Old logic only overwrote on 'strict' after the first emit set the policy, so a
    // 'partial' following a 'flag' was dropped and order mattered. The shared soulData
    // derivation uses a deterministic stricter-wins comparison: the strict emit wins.
    const multiEmit = {
      id: "pub-multi",
      slug: "multi-emit",
      name: "Multi emit",
      definition: {
        slug: "multi-emit",
        version: 1,
        project_folder_id: null,
        phases: [
          { slug: "e1", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "flag" } },
          { slug: "e2", phase_index: 1, config: { phase_type: "llm_emit", citation_policy: "strict" } },
          { slug: "e3", phase_index: 2, config: { phase_type: "llm_emit", citation_policy: "partial" } },
        ],
      },
    }
    mockListPublished.mockResolvedValue([multiEmit])
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const card = await screen.findByTestId("published-card")
    expect(within(card).getByTestId("soul-tier").getAttribute("data-tier")).toBe("STRICT")
  })
})

describe("WorkflowsPage — Run launch (D-103-1) reuses onLaunch", () => {
  it("Run opens the modal: an editable KB-scope <select> (author default tagged) + one textarea + a hint line", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    fireEvent.click(within(cards[0]).getByTestId("published-run"))
    const modal = await screen.findByTestId("run-modal")
    // Phase 152 (WFIN-02 / D-LOCK-01 + WR-05): the read-only chip is now an inline native
    // <select>. For a BOUND workflow (folder-aaa = "DBA Chapters") the leading "" option
    // is the truthful "Workflow default — 📁 {folder}" and is the resting selection —
    // never the dishonest "All documents" (which is unbound-only). NAME, never a path.
    const scope = within(modal).getByTestId("run-scope-select") as HTMLSelectElement
    expect(scope.value).toBe("")
    const optionText = Array.from(scope.options).map((o) => o.textContent)
    expect(optionText[0]).toContain("Workflow default")
    expect(optionText[0]).toContain("DBA Chapters")
    expect(optionText.some((t) => t === "All documents")).toBe(false)
    expect(scope.textContent).not.toMatch(/[/\\]/)
    // Exactly one textbox: the kickoff textarea (the <select> + file input aren't textboxes).
    expect(within(modal).getAllByRole("textbox")).toHaveLength(1)
    expect(within(modal).getByTestId("run-hint")).toBeInTheDocument()
  })

  it("the Run button is ENABLED even on empty input", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    fireEvent.click(within(cards[0]).getByTestId("published-run"))
    const confirm = await screen.findByTestId("run-confirm")
    expect(confirm).not.toBeDisabled()
  })

  it("clicking Run calls onLaunch(def, kickoff)", async () => {
    const onLaunch = vi.fn().mockResolvedValue(undefined)
    render(<WorkflowsPage folders={folders} onLaunch={onLaunch} />)
    const cards = await screen.findAllByTestId("published-card")
    fireEvent.click(within(cards[0]).getByTestId("published-run"))
    const textarea = await screen.findByTestId("run-kickoff")
    fireEvent.change(textarea, { target: { value: "review Acme Corp" } })
    fireEvent.click(screen.getByTestId("run-confirm"))
    await waitFor(() => expect(onLaunch).toHaveBeenCalledTimes(1))
    // Phase 152: onLaunch now carries the two run inputs. Default state = no template +
    // the folder on the "workflow default" (author default) → NO override (D-06).
    expect(onLaunch).toHaveBeenCalledWith(strictPublished, "review Acme Corp", {
      templateFile: null,
      folderId: null,
    })
  })

  it("D-01: the library-card Run path stays the Phase-121 launch (onLaunch), NOT wrapped by the door fork", async () => {
    // The two-door fork lives at the Studio authoring ENTRY only. The published-card
    // Run must reach onLaunch (doRun → createThread → postMessage → create_workflow_run)
    // directly — it is never routed through WorkflowDoorSwitch. Asserting Run still
    // opens the run modal + calls onLaunch (and does NOT mount the door chooser) pins it.
    const onLaunch = vi.fn().mockResolvedValue(undefined)
    render(<WorkflowsPage folders={folders} onLaunch={onLaunch} />)
    const cards = await screen.findAllByTestId("published-card")
    fireEvent.click(within(cards[0]).getByTestId("published-run"))
    // The run modal opens (the Phase-121 launch surface), NOT the two-door chooser.
    expect(await screen.findByTestId("run-modal")).toBeInTheDocument()
    expect(screen.queryByTestId("workflow-doors")).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId("run-confirm"))
    await waitFor(() => expect(onLaunch).toHaveBeenCalledTimes(1))
    // Phase 152: still onLaunch (never the door fork); the third arg is the default
    // no-input state (D-06 — no template, folder on the workflow default).
    expect(onLaunch).toHaveBeenCalledWith(strictPublished, "", {
      templateFile: null,
      folderId: null,
    })
  })

  it("WR-05: a double-tap of Run creates ONLY ONE launch (in-flight guard)", async () => {
    // onLaunch resolves only when we release it — the second click while in flight
    // must be ignored (one click = one thread).
    let release: () => void = () => {}
    const onLaunch = vi.fn().mockReturnValue(new Promise<void>((r) => (release = r)))
    render(<WorkflowsPage folders={folders} onLaunch={onLaunch} />)
    const cards = await screen.findAllByTestId("published-card")
    fireEvent.click(within(cards[0]).getByTestId("published-run"))
    const confirm = await screen.findByTestId("run-confirm")
    fireEvent.click(confirm) // first click → launch starts (still pending)
    fireEvent.click(confirm) // second tap while in flight → must be ignored
    fireEvent.click(confirm)
    expect(onLaunch).toHaveBeenCalledTimes(1)
    expect(confirm).toBeDisabled()
    release()
    await waitFor(() => expect(onLaunch).toHaveBeenCalledTimes(1))
  })
})

/**
 * 192-10 (D-09 / D-12) — the three cases below keep EVERY assertion they have always made.
 * Only the route changed: the fork is one word inside the row's `⋯` overflow now, shared
 * with the starter fork, and the two HANDLERS behind that one word stay separate siblings —
 * which is what the starter block below proves from the other side.
 */
describe("WorkflowsPage — Tweak forks a v(N+1) draft (INSERT, never UPDATE)", () => {
  it("Tweak calls createWorkflowDraft with version = def.version + 1, same slug, status 'draft'", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    const user = await openOverflow(cards[0])
    await user.click(screen.getByTestId("published-tweak"))
    await waitFor(() => expect(mockCreateDraft).toHaveBeenCalledTimes(1))
    const forked = mockCreateDraft.mock.calls[0][0]
    expect(forked.slug).toBe("vendor-risk")
    expect(forked.version).toBe(3) // published def.version (2) + 1
    expect(forked.status).toBe("draft")
    // It is an INSERT (createWorkflowDraft), never updateWorkflowDraft on the published row.
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it("Tweak opens the FORKED copy's existing steps in the Builder (NOT the describe screen)", async () => {
    // The fork mints draft id "new-draft" (beforeEach mock). The Builder must boot
    // straight into the editing view on the forked definition's existing phases —
    // never the empty describe box.
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    const user = await openOverflow(cards[0])
    await user.click(screen.getByTestId("published-tweak"))
    // The forked strict def's phases render as spine nodes (pull + emit).
    expect(await screen.findByTestId("spine-node-pull")).toBeInTheDocument()
    expect(screen.getByTestId("spine-node-emit")).toBeInTheDocument()
    // And NOT the describe-first empty screen.
    expect(screen.queryByTestId("describe-hint")).not.toBeInTheDocument()
  })

  it("Tweak seeds the Builder with the NEW forked draft id → its publish gauntlet mounts on that id", async () => {
    // draftId is pre-seeded from the fork ("new-draft"), so the publish gauntlet (gated
    // on a non-null draftId in renderPublish) renders immediately in the edit view.
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const cards = await screen.findAllByTestId("published-card")
    const user = await openOverflow(cards[0])
    await user.click(screen.getByTestId("published-tweak"))
    await screen.findByTestId("spine-node-pull")
    // The header carries the Tweak caption with the new version.
    expect(screen.getByText(/Tweak · vendor-risk v3/)).toBeInTheDocument()
  })
})

describe("WorkflowsPage — the starter row and its fresh-copy fork (WF-01, D-143-1/2/8)", () => {
  it("a starter row renders in the ONE list with its provenance mark and the fork verb", async () => {
    // 192-10 (D-02 / D-09): there is no curated section to render it in. What survives — and
    // what actually mattered in the deleted assertion — is that a curated row is
    // DISTINGUISHABLE from a user's own at a glance, and that the fork affordance is on it.
    // The distinction is now the row's own provenance mark plus a machine-readable
    // `data-provenance`, and the fork is the shared verb behind the `⋯`.
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const card = await screen.findByTestId("starter-card")
    // It sits in the one flat list, not in a section of its own.
    expect(within(screen.getByTestId("library-list")).getByTestId("starter-card")).toBe(card)
    expect(within(card).getByText("Risk Register")).toBeInTheDocument()
    // The curated-vs-mine distinction (D-143-8, Glean verified-badge analog), now carried by
    // the row itself rather than by the section it used to sit under.
    expect(card.getAttribute("data-provenance")).toBe("starter")
    expect(within(card).getByText(/starter|official/i)).toBeInTheDocument()
    // The fork affordance, reached the way D-09 puts it.
    await openOverflow(card)
    expect(screen.getByTestId("use-starter")).toBeInTheDocument()
  })

  it("onUseStarter forks a FRESH copy: new suffixed slug + v1 + draft (INSERT, never UPDATE the frozen starter)", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const card = await screen.findByTestId("starter-card")
    const user = await openOverflow(card)
    await user.click(screen.getByTestId("use-starter"))
    await waitFor(() => expect(mockCreateDraft).toHaveBeenCalledTimes(1))
    const forked = mockCreateDraft.mock.calls[0][0]
    // D-143-1: a brand-new owned identity — a NEW auto-suffixed slug off "risk-register".
    expect(forked.slug).toMatch(/^risk-register-[a-z0-9]{6}$/)
    expect(forked.version).toBe(1) // v1, NOT the same-slug Tweak's N+1
    expect(forked.status).toBe("draft")
    // It is an INSERT (createWorkflowDraft) — the frozen published starter is NEVER UPDATEd.
    expect(mockUpdate).not.toHaveBeenCalled()
    // ⚠ D-12, from the OTHER side, and this is the assertion the shared word makes
    // necessary: a starter's fork reached `onUseStarter`, so it minted a NEW slug at v1
    // rather than this slug at v(N+1). Merging the two handlers behind one label breaks the
    // GLOBAL `UNIQUE(slug, version)` constraint the moment two people fork one starter.
    expect(forked.slug).not.toBe("risk-register")
  })

  // ⚠ The section-order case that lived here was DELETED — see the block comment above the
  // create-affordance describe for the authorization and the reason.
})

describe("WorkflowsPage — Open a draft loads it in the Builder (edit-in-place)", () => {
  it("Open passes the draft's definition + id → the Builder shows its steps, not the describe box", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    const draftCard = await screen.findByTestId("draft-card")
    fireEvent.click(within(draftCard).getByTestId("draft-open"))
    // The draftRow's existing phase ("draft" slug) renders as a spine node.
    expect(await screen.findByTestId("spine-node-draft")).toBeInTheDocument()
    // NOT the describe-first empty screen.
    expect(screen.queryByTestId("describe-hint")).not.toBeInTheDocument()
    // Edit-in-place: no fork (createWorkflowDraft) on Open.
    expect(mockCreateDraft).not.toHaveBeenCalled()
  })

  it("the create affordance opens a TRUE fresh build (the 'both' door chooser, no initial)", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    // 192-10 (D-02): same seam, new click target. `openBuilderFresh` →
    // `setBuilderInitial(null)` + `setPageView("builder")` is UNCHANGED — 192 must not move
    // Phase 193's authoring doors, only the affordance that reaches them.
    fireEvent.click(await screen.findByTestId("library-create"))
    // Fresh build → the chooser, NOT an already-loaded definition's spine nodes.
    expect(await screen.findByTestId("workflow-doors")).toBeInTheDocument()
    expect(screen.queryByTestId("spine-node-draft")).not.toBeInTheDocument()
  })
})

describe("WorkflowsPage — back-nav refreshes the library lists", () => {
  it("the ← Workflows back button refetches drafts + published", async () => {
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn()} />)
    // Enter the Builder host via a fresh build (does not itself refetch). The fresh
    // build opens the two-door chooser.
    fireEvent.click(await screen.findByTestId("library-create"))
    await screen.findByTestId("workflow-doors")
    mockListDrafts.mockClear()
    mockListPublished.mockClear()
    // Back to the library → both lists refresh (newly-created drafts appear w/o F5).
    fireEvent.click(screen.getByTestId("builder-back"))
    await waitFor(() => expect(mockListDrafts).toHaveBeenCalledTimes(1))
    expect(mockListPublished).toHaveBeenCalledTimes(1)
    // The library is back — witnessed by its persistent toolbar, which is what 157-B put in
    // the place three shelves used to occupy.
    expect(await screen.findByTestId("library-toolbar")).toBeInTheDocument()
  })
})
