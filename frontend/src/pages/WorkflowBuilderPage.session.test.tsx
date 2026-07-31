/**
 * Phase 184-11 Task 3 (R6 · D-184-03 · D-184-16) — the authoring SESSION's proof.
 *
 * A NET-NEW suite. It absorbs, replaces and re-implements nothing: `WorkflowBuilderPage
 * .test.tsx` (15) is the describe-first regression net and `.canvas.test.tsx` (31) is the
 * canvas door plus this plan's payload/silence/flag proofs. Both keep their own pins in
 * `scripts/vitest-count-gate.cjs`, which exists because Phase 177 shipped a "net-new" file
 * that quietly replaced an existing suite and a failures-only differential could not see it.
 *
 * WHAT THIS FILE IS ABOUT is the edges of a session rather than any one edit:
 *
 *   R6        one create, then PATCHes — and NO autosave. A structural edit writes
 *             nothing; only the explicit Save button does. The saved surface says
 *             `Saved · still a draft` and never a word that implies published.
 *   D-184-03  undo crosses the save boundary, re-arms `dirty`, and issues ZERO server
 *             writes. An undo that auto-PATCHed is exactly the surprise a no-autosave
 *             phase exists to prevent.
 *   D-184-16  the three session-edge debts: the unsaved-work leave guard (breadcrumb +
 *             `beforeunload`), WR-09-01/02 on ALL THREE dismissal paths, and the 409's
 *             own honest sentence.
 *
 * ── HOW `dirty` IS OBSERVED, and why that is not a cheat ─────────────────────────────
 *
 * Phase 184-11 renders no dirty INDICATOR — the canvas toolbar that shows one is 184-13's.
 * What the surface does with `dirty` today is exactly one thing: it refuses to be left
 * without asking. So `dirty` is read through the leave guard, which is the user-visible
 * consequence rather than a private field, and `window.confirm` is spied on so "it asked"
 * and "it did not ask" are both assertions rather than inferences.
 *
 * ── THE DRIVERS ─────────────────────────────────────────────────────────────────────
 *
 * `fireEvent` for anything inside the React Flow plane (a `user-event` click dispatches a
 * real `mousedown`, which reaches d3-zoom, whose d3-drag dereferences a null `event.view`
 * under jsdom and exits the process 1 with every assertion green). `user-event` is used
 * only for controls outside the plane, where its focus fidelity is the point — the ✕ test
 * NEEDS a driver that moves focus the way a browser does.
 *
 * The api client is mocked as a WHOLE module, enumerating every symbol the render paths of
 * the Builder, `WorkflowsPage` and `PublishGauntlet` reach; a factory mock that omits one
 * hands back `undefined` and the failure surfaces far from its cause.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

// FILE-LOCAL, never `setupTests.ts` — the helper patches HTMLElement.prototype and a
// global install would perturb every suite and destroy the phase's count differential.
import { mockReactFlow } from "@/test-utils/mockReactFlow"

const {
  mockGenerate,
  mockCreate,
  mockUpdate,
  mockListFolders,
  mockListSkills,
  mockValidate,
  mockBundle,
  mockPublish,
  mockListPublished,
  mockListStarters,
  mockListDrafts,
  mockDeletePreview,
  mockDeleteCascade,
  callLog,
} = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockListFolders: vi.fn(),
  mockListSkills: vi.fn(),
  mockValidate: vi.fn(),
  mockBundle: vi.fn(),
  mockPublish: vi.fn(),
  mockListPublished: vi.fn(),
  mockListStarters: vi.fn(),
  mockListDrafts: vi.fn(),
  mockDeletePreview: vi.fn(),
  mockDeleteCascade: vi.fn(),
  /** The ORDERED persistence call log — the R6 assertion is about sequence, not counts. */
  callLog: [] as string[],
}))

vi.mock("@/lib/api", () => {
  /** The real 409's shape. Declared inside the factory (a module mock cannot close over
   *  a top-level import) with the same `name` the shipped class sets, because the page
   *  classifies on the NAME — the `useLiveValidation.causeOf` idiom, which survives a
   *  module or realm boundary that `instanceof` does not. */
  class WorkflowConflictError extends Error {
    constructor(message = "workflow is published and cannot be modified") {
      super(message)
      this.name = "WorkflowConflictError"
    }
  }
  class WorkflowNotFoundError extends Error {
    constructor(message = "workflow not found") {
      super(message)
      this.name = "WorkflowNotFoundError"
    }
  }
  /** Phase 186-07: the stale-token refusal, same shape as the shipped class — the NAME
   *  the hook branches on plus the `currentToken` Overwrite adopts. Declared here for the
   *  same reason the two above are: a module mock cannot close over a top-level import. */
  class WorkflowStaleTokenError extends Error {
    currentToken: string | null
    constructor(currentToken: string | null = null) {
      super("this draft changed somewhere else")
      this.name = "WorkflowStaleTokenError"
      this.currentToken = currentToken
    }
  }
  class WorkflowDraftUnreadableError extends Error {
    constructor() {
      super("the draft's shape could not be read")
      this.name = "WorkflowDraftUnreadableError"
    }
  }
  return {
    generateWorkflow: mockGenerate,
    createWorkflowDraft: mockCreate,
    updateWorkflowDraft: mockUpdate,
    listFolders: mockListFolders,
    listSkills: mockListSkills,
    validateWorkflow: mockValidate,
    getGroundingBundle: mockBundle,
    publishWorkflow: mockPublish,
    listPublishedWorkflows: mockListPublished,
    listStarterWorkflows: mockListStarters,
    listDraftWorkflows: mockListDrafts,
    getWorkflowDeletePreview: mockDeletePreview,
    deleteWorkflowCascade: mockDeleteCascade,
    WorkflowConflictError,
    WorkflowNotFoundError,
    WorkflowStaleTokenError,
    WorkflowDraftUnreadableError,
  }
})

/**
 * Reach the per-mount store by wrapping ONE export of the real module and letting the
 * page render against the genuine article (the 184-10 idiom). The alternative — exporting
 * a test hook from the page — would put a seam in production code that exists only for a
 * test, and the undo affordance this would otherwise be driven through is 184-13's.
 */
const { storeRef } = vi.hoisted(() => ({
  storeRef: { current: null as null | import("@/components/workflows/builderStore").BuilderStore },
}))
vi.mock("@/components/workflows/builderStore", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/workflows/builderStore")>()
  return {
    ...actual,
    createBuilderStore: (initial: Parameters<typeof actual.createBuilderStore>[0]) => {
      const store = actual.createBuilderStore(initial)
      storeRef.current = store
      return store
    },
  }
})

import {
  WorkflowBuilderPage,
  PUBLISHED_CONFLICT_MESSAGE,
  type BuilderDefinition,
} from "./WorkflowBuilderPage"
// 186-07: the cause-neutral refusal now has ONE home, in the hook that chooses it. The
// suite reads the constant rather than a copied literal, so a re-wording cannot leave a
// green test asserting a sentence the product no longer says.
import { SAVE_FAILED_SENTENCE } from "@/hooks/useDraftPersistence"
import { WorkflowsPage } from "./WorkflowsPage"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"

mockReactFlow()

/** Hand-authored, so `__fixtures__/canvasFixtures.ts` stays untouched (D-184-17: that
 *  corpus belongs to the snapshot + round-trip suites and carries its own provenance
 *  rules). Two steps, one of them an agent so the panel renders an Instructions field. */
const definition: BuilderDefinition = {
  slug: "vendor-brief",
  version: 1,
  status: "draft",
  business_requirement: "summarize vendor risk",
  phases: [
    { slug: "research", phase_index: 0, name: "Research", config: { phase_type: "llm_agent", prompt: "" } },
    { slug: "summarize", phase_index: 1, name: "Summarize", config: { phase_type: "llm_single", prompt: "" } },
  ],
}

const FLAG_ON = { features: { visual_workflow_canvas: true }, loading: false } as const

/** The lazy canvas chunk resolves on a dynamic import; under a parallel run that
 *  transform can outlive Testing Library's 1 s default. */
const LAZY = { timeout: 10_000 } as const

let canLeave: (() => boolean) | null = null
const registerCanLeave = (fn: (() => boolean) | null) => {
  canLeave = fn
}

function renderBuilder(props: Partial<React.ComponentProps<typeof WorkflowBuilderPage>> = {}) {
  return render(
    <EffectiveFeaturesProvider value={{ ...FLAG_ON, refetch: vi.fn() }}>
      <div style={{ width: 1200, height: 800 }}>
        <WorkflowBuilderPage
          initial={{ definition, draftId: "draft-1" }}
          registerCanLeave={registerCanLeave}
          {...props}
        />
      </div>
    </EffectiveFeaturesProvider>,
  )
}

/** Open the panel on `research` from the Spine (outside the plane — no driver hazard). */
async function openPanel() {
  fireEvent.click(await screen.findByTestId("spine-node-research"))
  return (await screen.findByLabelText(/instructions/i)) as HTMLTextAreaElement
}

/** The definition as the page would serialize it right now. */
function currentPhases() {
  const state = storeRef.current!.getState()
  return state.phases
}

beforeEach(() => {
  vi.clearAllMocks()
  callLog.length = 0
  canLeave = null
  storeRef.current = null
  window.localStorage.clear()

  mockListFolders.mockResolvedValue([])
  mockListSkills.mockResolvedValue([])
  mockValidate.mockResolvedValue({ ok: true, verdicts: [] })
  mockBundle.mockResolvedValue({ tools: [], folders: [], skills: [], degraded: [] })
  mockListPublished.mockResolvedValue([])
  mockListStarters.mockResolvedValue([])
  mockListDrafts.mockResolvedValue([])

  mockCreate.mockImplementation(async () => {
    callLog.push("createWorkflowDraft")
    return { id: "created-1", version: 1 }
  })
  mockUpdate.mockImplementation(async () => {
    callLog.push("updateWorkflowDraft")
    return {}
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// ── 1-3. R6 — one create, then PATCHes; no autosave; honest wording ────────────────

describe("WorkflowBuilderPage session — R6: exactly one POST, then PATCH", () => {
  it("a whole session's api call log is [create, update, update] — one create, patches after", async () => {
    mockGenerate.mockResolvedValue({ ok: true, definition })
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()

    render(
      <EffectiveFeaturesProvider value={{ ...FLAG_ON, refetch: vi.fn() }}>
        <WorkflowBuilderPage registerCanLeave={registerCanLeave} />
      </EffectiveFeaturesProvider>,
    )

    // Describe → draft → the drafted editing view.
    await user.type(screen.getByRole("textbox", { name: /business requirement/i }), "vendor risk")
    await user.click(screen.getByRole("button", { name: /draft the workflow/i }))
    await screen.findByTestId("spine-node-research")

    // First explicit save → CREATE.
    await user.click(screen.getByTestId("builder-save-draft"))
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))

    // Edit, save again → PATCH the id the create returned.
    const field = await openPanel()
    fireEvent.change(field, { target: { value: "search the vendor corpus" } })
    await user.click(screen.getByTestId("builder-save-draft"))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))

    fireEvent.change(field, { target: { value: "search the vendor corpus twice" } })
    await user.click(screen.getByTestId("builder-save-draft"))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2))

    expect(callLog).toEqual([
      "createWorkflowDraft",
      "updateWorkflowDraft",
      "updateWorkflowDraft",
    ])
    expect(mockUpdate.mock.calls.every((c) => c[0] === "created-1")).toBe(true)
  })

  it("two rapid saves before the create resolves still issue exactly ONE create", async () => {
    // The shipped `creatingRef` guard against the UNIQUE(slug, version) 500. The create is
    // held open on purpose: the collision this prevents is a RACE, so a test that lets the
    // first call settle first would be green on a page with no guard at all.
    mockGenerate.mockResolvedValue({ ok: true, definition })
    let release: (v: { id: string; version: number }) => void = () => {}
    mockCreate.mockImplementation(
      () =>
        new Promise((resolve) => {
          callLog.push("createWorkflowDraft")
          release = resolve
        }),
    )

    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    render(
      <EffectiveFeaturesProvider value={{ ...FLAG_ON, refetch: vi.fn() }}>
        <WorkflowBuilderPage registerCanLeave={registerCanLeave} />
      </EffectiveFeaturesProvider>,
    )
    await user.type(screen.getByRole("textbox", { name: /business requirement/i }), "vendor risk")
    await user.click(screen.getByRole("button", { name: /draft the workflow/i }))
    await screen.findByTestId("spine-node-research")

    const save = screen.getByTestId("builder-save-draft")
    fireEvent.click(save)
    fireEvent.click(save)
    fireEvent.click(save)
    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1))
    await act(async () => {
      release({ id: "created-1", version: 1 })
    })

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(callLog.filter((c) => c === "createWorkflowDraft")).toHaveLength(1)
  })

  /**
   * 186-07 RETARGET — the NAME changed, the assertions did not.
   *
   * 184-11 read this as *"there is no autosave"*, and that was true of 184. 186-07 makes
   * one edit burst issue ONE write about a second after the author stops (D-186-01), so
   * the sentence this row can still honestly prove is the other half of the same rule:
   * three structural edits in a burst produce ZERO writes WHILE the window is open. The
   * burst is not written per-edit, and it is not written per-keystroke.
   *
   * The half that used to be missing — that the write does eventually happen, on its own
   * — is asserted in the 186-07 autosave block further down. Deleting this row instead
   * would have removed the only guard on the coalescing side of the rule.
   */
  it("three structural edits in a burst issue ZERO writes while the window is open", async () => {
    renderBuilder()
    await screen.findByTestId("spine-node-research")

    act(() => storeRef.current!.getState().addPhaseOfType("llm_single"))
    act(() => storeRef.current!.getState().reorderPhase("summarize", 0))
    act(() => storeRef.current!.getState().removePhaseBySlug("summarize"))

    // Well past the config-coalescing window, and inside the autosave one.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700))
    })
    expect(callLog).toEqual([])
    expect(mockCreate).toHaveBeenCalledTimes(0)
    expect(mockUpdate).toHaveBeenCalledTimes(0)
  })

  it("a saved draft says `Saved · still a draft` and no word in the region implies published", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    renderBuilder()
    await screen.findByTestId("spine-node-research")

    await user.click(screen.getByTestId("builder-save-draft"))
    const confirm = await screen.findByTestId("builder-save-confirm")
    expect(confirm.textContent).toBe("Saved · still a draft")

    const region = screen.getByTestId("builder-save-state")
    expect(region.textContent ?? "").not.toMatch(/publish|published|live|shipped/i)
  })
})

// ── 4. D-184-03 — undo crosses the save boundary and never writes ─────────────────

describe("WorkflowBuilderPage session — D-184-03: undo re-arms dirty and writes nothing", () => {
  it("an undo AFTER a save makes the draft dirty again and issues zero api calls", async () => {
    const confirmSpy = vi.fn(() => true)
    vi.stubGlobal("confirm", confirmSpy)

    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    renderBuilder()
    const field = await openPanel()

    fireEvent.change(field, { target: { value: "a sentence worth undoing" } })
    // Commit the coalescing run so there is a history entry to step back through.
    act(() => storeRef.current!.getState().flushHistory())

    await user.click(screen.getByTestId("builder-save-draft"))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    // A confirmed save is the ONLY thing that clears dirty — the guard now lets go.
    await waitFor(() => expect(canLeave!()).toBe(true))
    expect(confirmSpy).not.toHaveBeenCalled()

    const callsBefore = callLog.length
    act(() => storeRef.current!.temporal.getState().undo())

    // A save is NOT a barrier: stepping back past it makes the in-memory definition
    // differ from what was PATCHed, so the surface honestly asks again. The guard is the
    // observable consequence of `dirty` on this surface, so "it asked" IS the assertion.
    expect(canLeave!()).toBe(true) // the stub confirms, so leaving is allowed…
    expect(confirmSpy).toHaveBeenCalledTimes(1) // …but only because it ASKED.

    // …and the undo itself reached no server at all.
    expect(callLog).toHaveLength(callsBefore)
    expect(mockCreate).toHaveBeenCalledTimes(0)
  })
})

// ── 5. D-184-16 debt 1 — the leave guard, both halves ────────────────────────────

describe("WorkflowBuilderPage session — the unsaved-work leave guard (D-184-16)", () => {
  it("a DIRTY draft asks before leaving, and a refusal means it does not leave", async () => {
    const confirmSpy = vi.fn(() => false)
    vi.stubGlobal("confirm", confirmSpy)

    renderBuilder()
    const field = await openPanel()
    fireEvent.change(field, { target: { value: "unsaved work" } })

    await waitFor(() => expect(canLeave).not.toBeNull())
    expect(canLeave!()).toBe(false)
    expect(confirmSpy).toHaveBeenCalledTimes(1)
  })

  it("a CLEAN draft leaves immediately and is never asked", async () => {
    const confirmSpy = vi.fn(() => true)
    vi.stubGlobal("confirm", confirmSpy)

    renderBuilder()
    await screen.findByTestId("spine-node-research")

    await waitFor(() => expect(canLeave).not.toBeNull())
    expect(canLeave!()).toBe(true)
    expect(confirmSpy).not.toHaveBeenCalled()
  })

  it("beforeunload is armed ONLY while dirty, and disarmed the moment it is clean", async () => {
    /**
     * Asserted on the OBSERVABLE effect rather than on `addEventListener` call counts: a
     * cancelled `beforeunload` is what makes the browser show its "leave site?" dialog, and
     * a spy on the registration would still pass if the handler forgot to cancel. So the
     * event is really dispatched and `defaultPrevented` is read.
     */
    const beforeUnloadCancelled = () => {
      const event = new Event("beforeunload", { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }

    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    renderBuilder()
    const field = await openPanel()

    // At rest (clean) no listener exists — the gated-listener shape costs nothing.
    expect(beforeUnloadCancelled()).toBe(false)

    fireEvent.change(field, { target: { value: "unsaved work" } })
    await waitFor(() => expect(beforeUnloadCancelled()).toBe(true))

    // A confirmed save disarms it again — a saved session must not be nagged on close.
    await user.click(screen.getByTestId("builder-save-draft"))
    await waitFor(() => expect(beforeUnloadCancelled()).toBe(false))
  })

  it("the ← Workflows breadcrumb leaves EXACTLY AS TODAY when no Builder has registered", async () => {
    // The absent-registration case, which is what keeps this change additive: the
    // fresh-build entry opens the two-door CHOOSER, so no Builder is mounted, nothing is
    // registered, and the breadcrumb behaves byte-for-byte as it did before 184-11.
    const confirmSpy = vi.fn(() => false)
    vi.stubGlobal("confirm", confirmSpy)

    render(
      <EffectiveFeaturesProvider value={{ ...FLAG_ON, refetch: vi.fn() }}>
        <div style={{ width: 1200, height: 800 }}>
          <WorkflowsPage folders={[]} onLaunch={vi.fn()} />
        </div>
      </EffectiveFeaturesProvider>,
    )

    fireEvent.click(await screen.findByTestId("build-card"))
    await screen.findByTestId("workflow-doors")

    fireEvent.click(screen.getByTestId("builder-back"))
    expect(confirmSpy).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByTestId("builder-back")).toBeNull())
    expect(screen.getByTestId("drafts-shelf")).toBeInTheDocument()
  })

  it("the ← Workflows breadcrumb REFUSES to leave a DIRTY Builder, and leaves once confirmed", async () => {
    // The whole seam end to end: `WorkflowsPage` owns the breadcrumb, the Builder owns the
    // dirty state, and there is NO ROUTER between them — the guard is a registered
    // predicate, consulted at click time.
    const confirmSpy = vi.fn(() => false)
    vi.stubGlobal("confirm", confirmSpy)

    mockListDrafts.mockResolvedValue([
      { id: "draft-1", slug: "vendor-brief", version: 1, name: "Vendor brief", definition },
    ])

    render(
      <EffectiveFeaturesProvider value={{ ...FLAG_ON, refetch: vi.fn() }}>
        <div style={{ width: 1200, height: 800 }}>
          <WorkflowsPage folders={[]} onLaunch={vi.fn()} />
        </div>
      </EffectiveFeaturesProvider>,
    )

    // Opening a DRAFT lands straight in the govern door with a real Builder on it.
    fireEvent.click(await screen.findByTestId("draft-open"))
    await screen.findByTestId("door-govern")
    const field = await openPanel()
    fireEvent.change(field, { target: { value: "five edits deep, nothing saved" } })

    // Refused: the view does not change and nothing is refetched.
    fireEvent.click(screen.getByTestId("builder-back"))
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId("door-govern")).toBeInTheDocument()
    expect(screen.queryByTestId("drafts-shelf")).toBeNull()

    // …and once the author says yes, it leaves.
    confirmSpy.mockReturnValue(true)
    fireEvent.click(screen.getByTestId("builder-back"))
    expect(confirmSpy).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.getByTestId("drafts-shelf")).toBeInTheDocument())
  })
})

// ── 6-7. D-184-16 debt 2 — WR-09-01 / WR-09-02 on ALL THREE dismissal paths ───────

describe("WorkflowBuilderPage session — every dismissal commits and none of them PATCHes", () => {
  /** Type into the panel WITHOUT blurring, then dismiss. Returns the typed sentence. */
  async function typeWithoutBlurring(text: string) {
    const field = await openPanel()
    field.focus()
    fireEvent.change(field, { target: { value: text } })
    expect(document.activeElement).toBe(field)
    return text
  }

  function promptOf(slug: string): unknown {
    return currentPhases().find((p) => p.slug === slug)?.config.prompt
  }

  it("✕ — the pending value is in the definition and ZERO PATCHes were issued", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    renderBuilder()
    const text = await typeWithoutBlurring("dismissed by the close button")

    // `user-event` on purpose here: it moves focus the way a browser does, which is the
    // exact mechanism that used to turn this dismissal into a PATCH.
    await user.click(screen.getByTestId("phase-form-close"))
    await waitFor(() => expect(screen.getByTestId("phase-form-rail")).toBeInTheDocument())

    expect(promptOf("research")).toBe(text)
    expect(mockUpdate).toHaveBeenCalledTimes(0)
    expect(mockCreate).toHaveBeenCalledTimes(0)
  })

  it("Escape — the pending value is in the definition and ZERO PATCHes were issued", async () => {
    renderBuilder()
    const text = await typeWithoutBlurring("dismissed by escape")

    fireEvent.keyDown(window, { key: "Escape" })
    await waitFor(() => expect(screen.getByTestId("phase-form-rail")).toBeInTheDocument())

    expect(promptOf("research")).toBe(text)
    expect(mockUpdate).toHaveBeenCalledTimes(0)
    expect(mockCreate).toHaveBeenCalledTimes(0)
  })

  it("pane click — the pending value is in the definition and ZERO PATCHes were issued", async () => {
    const { container } = renderBuilder()
    // The pane only exists on the canvas, so switch views first — the panel and its
    // selection survive the swap (the D-183-05 one-selection contract).
    const text = await typeWithoutBlurring("dismissed by a click on the plane")
    fireEvent.click(screen.getByTestId("builder-view-canvas"))
    await waitFor(() => expect(container.querySelector(".react-flow__pane")).not.toBeNull(), LAZY)

    fireEvent.click(container.querySelector(".react-flow__pane")!)
    await waitFor(() => expect(screen.getByTestId("phase-form-rail")).toBeInTheDocument())

    expect(promptOf("research")).toBe(text)
    expect(mockUpdate).toHaveBeenCalledTimes(0)
    expect(mockCreate).toHaveBeenCalledTimes(0)
  })

  it("the ✕ suppresses the focus transfer — the MECHANISM that used to mint the PATCH", async () => {
    // jsdom does not move focus on mousedown, so the three rows above cannot themselves
    // prove the browser case; this one reads the mechanism directly. Remove the
    // `onMouseDown` preventDefault and this row goes red while those three stay green.
    renderBuilder()
    await typeWithoutBlurring("still focused after the press")

    const notPrevented = fireEvent.mouseDown(screen.getByTestId("phase-form-close"))
    expect(notPrevented).toBe(false)
  })

  it("a dismissal COMMITS the coalescing run — the undo entry exists at dismissal time", async () => {
    // The falsifiable half of "commit before unmount": the typed value reaches the
    // definition on the keystroke (every field is controlled), but the HISTORY entry sat
    // in a 500 ms timer. Drop `flushHistory()` from `clearSelection` and this goes red.
    renderBuilder()
    await typeWithoutBlurring("one sentence, one undo")

    expect(storeRef.current!.temporal.getState().pastStates).toHaveLength(0)
    fireEvent.keyDown(window, { key: "Escape" })
    await waitFor(() => expect(screen.getByTestId("phase-form-rail")).toBeInTheDocument())
    expect(storeRef.current!.temporal.getState().pastStates).toHaveLength(1)
  })
})

// ── 8. D-184-16 debt 3 — the 409's own honest sentence ────────────────────────────

describe("WorkflowBuilderPage session — the 409 is told honestly (D-184-16)", () => {
  it("a published-row conflict names the row AND the way out", async () => {
    const { WorkflowConflictError } = await import("@/lib/api")
    mockUpdate.mockRejectedValue(new WorkflowConflictError())

    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    renderBuilder()
    await screen.findByTestId("spine-node-research")

    await user.click(screen.getByTestId("builder-save-draft"))
    const error = await screen.findByTestId("builder-save-error")
    expect(error.textContent).toBe(
      "This version is published and can't be edited — use Tweak to start a new draft",
    )
    expect(screen.queryByTestId("builder-save-confirm")).toBeNull()
  })

  /**
   * 186-07 RETARGET, recorded here as well as in the SUMMARY.
   *
   * The expected LITERAL moved from `Couldn't save` to the write loop's own cause-neutral
   * sentence, and nothing else did. `GENERIC_SAVE_ERROR` was retired when the seam moved:
   * `useDraftPersistence` already ships a cause-neutral line, chosen by the same branch
   * that chooses the other two, and keeping both would have left ONE situation with TWO
   * spellings — the failure 186-04 retired the store's parallel save enum for.
   *
   * The assertion's PURPOSE is unchanged and still measured, in both halves: a 404 or a
   * dead network reads as itself, and it is never told the workflow is published.
   */
  it("any OTHER failure keeps a generic line — a 404 is not a publish", async () => {
    mockUpdate.mockRejectedValue(new Error("network down"))

    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    renderBuilder()
    await screen.findByTestId("spine-node-research")

    await user.click(screen.getByTestId("builder-save-draft"))
    const error = await screen.findByTestId("builder-save-error")
    expect(error.textContent).toBe(SAVE_FAILED_SENTENCE)
    expect(error.textContent).not.toMatch(/published/i)
    // …and the two sentences really are different strings, so the row above measures a
    // branch rather than a constant that happens to be shared.
    expect(SAVE_FAILED_SENTENCE).not.toBe(PUBLISHED_CONFLICT_MESSAGE)
  })
})

// ── 9. 186-07 — the token reaches the wire from the route that carries one ────────

describe("WorkflowBuilderPage session 186-07 — the concurrency token rides every write", () => {
  it("an OPENED draft echoes the drafts-row token VERBATIM on its first PATCH", async () => {
    // The whole seam end to end and the reason Task 1 exists: `WorkflowsPage` reads the
    // token off the drafts row, carries it through `BuilderInitial`, and the write loop
    // echoes it as-is. Drop `token` from the pass-through cast in `WorkflowsPage` and this
    // goes red with `undefined` — which is a Builder autosaving with NO guard at all, the
    // failure mode that has no visible symptom until it clobbers something.
    const ROW_TOKEN = "2026-08-01 12:00:00.123456+00"
    mockListDrafts.mockResolvedValue([
      {
        id: "draft-1",
        slug: "vendor-brief",
        version: 1,
        name: "Vendor brief",
        definition,
        token: ROW_TOKEN,
      },
    ])

    render(
      <EffectiveFeaturesProvider value={{ ...FLAG_ON, refetch: vi.fn() }}>
        <div style={{ width: 1200, height: 800 }}>
          <WorkflowsPage folders={[]} onLaunch={vi.fn()} />
        </div>
      </EffectiveFeaturesProvider>,
    )

    fireEvent.click(await screen.findByTestId("draft-open"))
    await screen.findByTestId("door-govern")

    const field = await openPanel()
    fireEvent.change(field, { target: { value: "an edit worth guarding" } })
    fireEvent.click(screen.getByTestId("builder-save-draft"))

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))
    expect(mockUpdate.mock.calls[0][0]).toBe("draft-1")
    expect(mockUpdate.mock.calls[0][2]).toBe(ROW_TOKEN)
    // Echoed as BYTES. The microsecond tail is exactly what a parsed-and-re-rendered
    // token would lose, and a truncated token matches zero rows.
    expect(mockUpdate.mock.calls[0][2]).toContain(".123456")
  })

  it("the token is CHAINED — the second write carries what the first one returned", async () => {
    mockUpdate.mockImplementation(async () => {
      callLog.push("updateWorkflowDraft")
      return { id: "draft-1", version: 1, token: "tok-after-first-patch" }
    })

    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    renderBuilder({ initial: { definition, draftId: "draft-1", token: "tok-seeded" } })
    const field = await openPanel()

    fireEvent.change(field, { target: { value: "first" } })
    await user.click(screen.getByTestId("builder-save-draft"))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1))

    fireEvent.change(field, { target: { value: "second" } })
    await user.click(screen.getByTestId("builder-save-draft"))
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2))

    expect(mockUpdate.mock.calls[0][2]).toBe("tok-seeded")
    // A write that ignored the response's token would re-send the seeded one and be
    // refused as stale against the person's OWN change.
    expect(mockUpdate.mock.calls[1][2]).toBe("tok-after-first-patch")
  })
})

// ── 10. 186-07 — autosave is live, and the two surfaces it earns ──────────────────

describe("WorkflowBuilderPage session 186-07 — autosave writes without being asked", () => {
  it("a structural edit PATCHes on its own about a second later — no button pressed", async () => {
    renderBuilder()
    await screen.findByTestId("spine-node-research")

    act(() => storeRef.current!.getState().addPhaseOfType("llm_single"))

    // Nothing yet: the burst is still coalescing, which is the D-186-01 rule.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300))
    })
    expect(mockUpdate).toHaveBeenCalledTimes(0)

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1), { timeout: 4000 })
    expect(mockUpdate.mock.calls[0][0]).toBe("draft-1")
    // …and it clears the guard, which is the observable consequence of `dirty`.
    await waitFor(() => expect(canLeave!()).toBe(true))
  })

  it("MOUNTING a draft and touching nothing writes NOTHING at all", async () => {
    // The dirty gate. Without it, merely opening a draft would PATCH it — bumping the row
    // and invalidating the token every other open tab holds, manufacturing exactly the
    // conflict this phase exists to prevent.
    renderBuilder()
    await screen.findByTestId("spine-node-research")

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2200))
    })
    expect(mockUpdate).toHaveBeenCalledTimes(0)
    expect(mockCreate).toHaveBeenCalledTimes(0)
  })

  it("a stale-token refusal raises the banner, offers Reload BEFORE Overwrite, and stops writing", async () => {
    const { WorkflowStaleTokenError } = await import("@/lib/api")
    mockUpdate.mockRejectedValue(new WorkflowStaleTokenError("newer-token"))

    renderBuilder()
    const field = await openPanel()
    fireEvent.change(field, { target: { value: "the losing tab's edit" } })

    const banner = await screen.findByTestId("builder-conflict-banner", undefined, {
      timeout: 4000,
    })
    expect(banner.getAttribute("role")).toBe("alert")
    // It states what happened in real DOM text, never a title attribute.
    expect(banner.textContent).toContain("changed somewhere else")

    // D-186-08 — RELOAD FIRST, OVERWRITE SECOND, in DOM order. Asserted positionally
    // rather than by looks: reading order and tab order are the recommendation.
    const reload = screen.getByTestId("builder-conflict-reload")
    const overwrite = screen.getByTestId("builder-conflict-overwrite")
    expect(
      reload.compareDocumentPosition(overwrite) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    const controls = [...banner.querySelectorAll<HTMLElement>("button")]
    expect(controls.indexOf(reload)).toBeLessThan(controls.indexOf(overwrite))

    // …and the loop is HALTED: further edits issue nothing at all, and no receipt exists.
    const callsAtConflict = mockUpdate.mock.calls.length
    fireEvent.change(field, { target: { value: "another edit while conflicted" } })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2200))
    })
    expect(mockUpdate.mock.calls.length).toBe(callsAtConflict)
    expect(screen.queryByTestId("builder-save-confirm")).toBeNull()
  })

  it("NEITHER exit is taken by itself — the banner waits for the person", async () => {
    const { WorkflowStaleTokenError } = await import("@/lib/api")
    mockUpdate.mockRejectedValue(new WorkflowStaleTokenError("newer-token"))

    renderBuilder()
    const field = await openPanel()
    fireEvent.change(field, { target: { value: "the losing tab's edit" } })
    await screen.findByTestId("builder-conflict-banner", undefined, { timeout: 4000 })

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2200))
    })
    // Reload re-reads the drafts list; Overwrite re-enters the writer. Neither happened.
    expect(mockListDrafts).not.toHaveBeenCalled()
    expect(screen.getByTestId("builder-conflict-banner")).toBeInTheDocument()
  })
})
