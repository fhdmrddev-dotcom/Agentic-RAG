/**
 * Phase 214.1-01 Task 2 (STEP-02 · D-214.1-01 · D-214.1-03 · D-214.1-06) — the
 * declared-input editor, its gated mount, and THE SAVE PATH DRIVEN RATHER THAN ASSUMED.
 *
 * ⭐ SECTION B IS THE LOAD-BEARING HALF OF THIS FILE, AND IT IS NOT A DOM TEST.
 * `BUG-260828-02`'s own shape is *"a mechanism whose three quarters all work"* — an editor
 * that renders beautifully and whose value never reaches the PATCH body fails IDENTICALLY to
 * having no editor at all, one level up. So the claim is asserted on
 * `JSON.parse(fetchMock.mock.calls[n][1].body)`: the real `updateWorkflowDraft`, the real
 * `useDraftPersistence`, a real store, and `globalThis.fetch` as the ONLY stub.
 *
 * ⚠ `@/lib/api` IS SPREAD FROM THE ACTUAL MODULE, never replaced by a hand-written object.
 * `updateWorkflowDraft` is deliberately left REAL — mocking it is exactly what stopped the
 * shipped `useDraftPersistence.test.tsx` from ever being able to answer the question this
 * file exists to answer. Only the page's inert mount-time reads are overridden, and the
 * spread makes mock completeness automatic (the `196-08` 249-failure trap).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react"

import { mockReactFlow } from "@/test-utils/mockReactFlow"

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

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    // The page's mount-time reads, made inert. ⚠ `updateWorkflowDraft` is NOT in this list
    // and must never be: Section B's whole point is that the SHIPPED client builds the body.
    generateWorkflow: vi.fn(),
    createWorkflowDraft: vi.fn().mockResolvedValue({ id: "created-1", version: 1, token: "t" }),
    listFolders: vi.fn().mockResolvedValue([]),
    listSkills: vi.fn().mockResolvedValue([]),
    listDraftWorkflows: vi.fn().mockResolvedValue([]),
    listConnectorConnections: vi.fn().mockResolvedValue([]),
    discoverConnectorTools: vi.fn().mockResolvedValue([]),
    validateWorkflow: vi.fn().mockResolvedValue({ ok: true, verdicts: [] }),
    getGroundingBundle: vi
      .fn()
      .mockResolvedValue({ tools: [], folders: [], skills: [], degraded: [] }),
    getAuthorModelRegistry: vi.fn().mockResolvedValue({ models: [], run_default_model: null }),
    publishWorkflow: vi.fn(),
  }
})

import { DeclaredInputsEditor } from "./DeclaredInputsEditor"
import { BuilderStoreProvider } from "./BuilderStoreProvider"
import { createBuilderStore, selectDefinition } from "./builderStore"
import { declaredInputFor, type DeclaredInput } from "./declaredInputs"
import {
  DECLARED_INPUTS_EMPTY,
  DECLARED_INPUT_REFUSE_DUPLICATE,
  DECLARED_INPUT_REFUSE_EMPTY,
  DECLARED_INPUT_REFUSE_RESERVED,
} from "./declaredInputsVocabulary"
import type { PhaseSpecJSON } from "./phaseVocabulary"
import { useDraftPersistence, AUTOSAVE_DEBOUNCE_MS } from "@/hooks/useDraftPersistence"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
import type { EffectiveFeatures } from "@/lib/api"
import { WorkflowBuilderPage, type BuilderDefinition } from "@/pages/WorkflowBuilderPage"

mockReactFlow()

// ── Fixtures ──────────────────────────────────────────────────────────────────────────

function phase(slug: string, index: number, type = "llm_single"): PhaseSpecJSON {
  return { slug, phase_index: index, config: { phase_type: type } }
}

/** A step that ASKS for a value at launch — the shape `undeclaredAskKeys` derives from. */
function askingPhase(): PhaseSpecJSON {
  return {
    slug: "act",
    phase_index: 1,
    config: {
      phase_type: "external_action",
      arg_sources: { to: { source: "ask", ask_key: "recipient" } },
    },
  } as unknown as PhaseSpecJSON
}

function draft(phases: PhaseSpecJSON[] = [phase("write", 0)]) {
  return {
    slug: "risk-register",
    version: 1,
    business_requirement: "Summarise the week's risks.",
    project_folder_id: null,
    phases,
  }
}

function mountEditor(store: ReturnType<typeof createBuilderStore>) {
  return render(
    <BuilderStoreProvider store={store}>
      <DeclaredInputsEditor />
    </BuilderStoreProvider>,
  )
}

/** Open the dialog — every editing case starts here. */
function openEditor(store: ReturnType<typeof createBuilderStore>) {
  const view = mountEditor(store)
  fireEvent.click(screen.getByTestId("declared-inputs-affordance"))
  return view
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

// ══ SECTION A — the editor surface ═══════════════════════════════════════════════════

describe("DeclaredInputsEditor — the affordance", () => {
  it("renders with a count of zero when nothing is declared", () => {
    mountEditor(createBuilderStore(draft()))
    expect(screen.getByTestId("declared-inputs-affordance")).toBeInTheDocument()
    expect(screen.getByTestId("declared-inputs-count")).toHaveTextContent("0")
  })

  it("counts the declared inputs the definition already carries", () => {
    const store = createBuilderStore(draft())
    act(() => {
      store.getState().setDeclaredInputs([declaredInputFor("recipient"), declaredInputFor("subject")])
    })
    mountEditor(store)
    expect(screen.getByTestId("declared-inputs-count")).toHaveTextContent("2")
  })

  it("owns its own open state — the dialog is absent until the affordance is pressed", () => {
    const store = createBuilderStore(draft())
    mountEditor(store)
    expect(screen.queryByTestId("declared-inputs-modal")).toBeNull()

    fireEvent.click(screen.getByTestId("declared-inputs-affordance"))
    expect(screen.getByTestId("declared-inputs-modal")).toBeInTheDocument()

    fireEvent.click(screen.getByTestId("declared-inputs-modal-close"))
    expect(screen.queryByTestId("declared-inputs-modal")).toBeNull()
  })
})

describe("DeclaredInputsEditor — the list", () => {
  it("lists each declared input with its key, its label field and its Required control", () => {
    const store = createBuilderStore(draft())
    act(() => {
      store.getState().setDeclaredInputs([declaredInputFor("recipient")])
    })
    openEditor(store)

    expect(screen.getByTestId("declared-input-row-recipient")).toBeInTheDocument()
    expect(screen.getByTestId("declared-input-key-recipient")).toHaveTextContent("recipient")
    expect(screen.getByTestId("declared-input-label-recipient")).toHaveValue("recipient")
    expect(screen.getByTestId("declared-input-required-recipient")).toBeInTheDocument()
  })

  it("shows the honest empty state when nothing is declared and nothing is offered", () => {
    openEditor(createBuilderStore(draft()))
    expect(screen.getByTestId("declared-inputs-empty")).toHaveTextContent(DECLARED_INPUTS_EMPTY)
  })

  it("editing a label writes through setDeclaredInputs and keeps the other three keys", () => {
    const store = createBuilderStore(draft())
    act(() => {
      store.getState().setDeclaredInputs([declaredInputFor("recipient")])
    })
    openEditor(store)

    fireEvent.change(screen.getByTestId("declared-input-label-recipient"), {
      target: { value: "Who to email" },
    })

    const inputs = store.getState().meta.inputs as DeclaredInput[]
    expect(inputs).toEqual([
      { key: "recipient", label: "Who to email", type: "text", required: true },
    ])
  })

  it("toggling Required writes false and back to true", () => {
    const store = createBuilderStore(draft())
    act(() => {
      store.getState().setDeclaredInputs([declaredInputFor("recipient")])
    })
    openEditor(store)

    fireEvent.click(screen.getByTestId("declared-input-required-recipient"))
    expect((store.getState().meta.inputs as DeclaredInput[])[0].required).toBe(false)

    fireEvent.click(screen.getByTestId("declared-input-required-recipient"))
    expect((store.getState().meta.inputs as DeclaredInput[])[0].required).toBe(true)
  })

  it("removing an entry calls setDeclaredInputs with that entry absent", () => {
    const store = createBuilderStore(draft())
    act(() => {
      store.getState().setDeclaredInputs([declaredInputFor("a"), declaredInputFor("b")])
    })
    openEditor(store)

    fireEvent.click(screen.getByTestId("declared-input-remove-a"))

    expect((store.getState().meta.inputs as DeclaredInput[]).map((i) => i.key)).toEqual(["b"])
    expect(screen.queryByTestId("declared-input-row-a")).toBeNull()
  })
})

describe("DeclaredInputsEditor — the three refusals are SHOWN, with their reason", () => {
  /** Type a key into the add control and press Add. */
  function typeAndAdd(key: string) {
    fireEvent.change(screen.getByTestId("declared-input-new-key"), { target: { value: key } })
    fireEvent.click(screen.getByTestId("declared-input-add"))
  }

  it("refuses a RESERVED key, shows why, and writes nothing", () => {
    const store = createBuilderStore(draft())
    const setSpy = vi.fn()
    const real = store.getState().setDeclaredInputs
    store.setState({
      setDeclaredInputs: (i) => {
        setSpy(i)
        real(i)
      },
    })
    openEditor(store)

    typeAndAdd("kickoff_prompt")

    expect(screen.getByTestId("declared-input-refusal")).toHaveTextContent(
      DECLARED_INPUT_REFUSE_RESERVED,
    )
    expect(setSpy).toHaveBeenCalledTimes(0)
    expect(store.getState().meta.inputs).toBeUndefined()

    // ⚠ POSITIVE CONTROL, in the SAME suite and on the SAME spy: a non-reserved key calls it
    // exactly once. Without this the assertion above would pass just as happily against a
    // door whose Add control was wired to nothing at all.
    typeAndAdd("recipient")
    expect(setSpy).toHaveBeenCalledTimes(1)
    expect((store.getState().meta.inputs as DeclaredInput[]).map((i) => i.key)).toEqual([
      "recipient",
    ])
    expect(screen.queryByTestId("declared-input-refusal")).toBeNull()
  })

  it("refuses a DUPLICATE key with its own reason", () => {
    const store = createBuilderStore(draft())
    act(() => {
      store.getState().setDeclaredInputs([declaredInputFor("recipient")])
    })
    openEditor(store)

    typeAndAdd("recipient")

    expect(screen.getByTestId("declared-input-refusal")).toHaveTextContent(
      DECLARED_INPUT_REFUSE_DUPLICATE,
    )
    expect(store.getState().meta.inputs).toHaveLength(1)
  })

  it("refuses an EMPTY key with its own reason", () => {
    const store = createBuilderStore(draft())
    openEditor(store)

    typeAndAdd("   ")

    expect(screen.getByTestId("declared-input-refusal")).toHaveTextContent(
      DECLARED_INPUT_REFUSE_EMPTY,
    )
    expect(store.getState().meta.inputs).toBeUndefined()
  })
})

describe("DeclaredInputsEditor — the offers derived from the definition's own steps", () => {
  it("offers an undeclared ask key, and the offer DISAPPEARS once declared", () => {
    const store = createBuilderStore(draft([phase("write", 0), askingPhase()]))
    openEditor(store)

    // NON-VACUITY: the offer is really there before the click.
    expect(screen.getByTestId("declared-input-offer-recipient")).toBeInTheDocument()
    expect(screen.queryByTestId("declared-inputs-empty")).toBeNull()

    fireEvent.click(screen.getByTestId("declared-input-offer-recipient"))

    // The derivation re-runs against the new `inputs`, so the offer is gone.
    expect(screen.queryByTestId("declared-input-offer-recipient")).toBeNull()
    expect(screen.getByTestId("declared-input-row-recipient")).toBeInTheDocument()
  })

  it("the one-click declare mints EXACTLY the four keys, with label === key", () => {
    const store = createBuilderStore(draft([phase("write", 0), askingPhase()]))
    openEditor(store)

    fireEvent.click(screen.getByTestId("declared-input-offer-recipient"))

    const inputs = store.getState().meta.inputs as Array<Record<string, unknown>>
    expect(inputs).toHaveLength(1)
    expect(Object.keys(inputs[0]).sort()).toEqual(["key", "label", "required", "type"])
    expect(inputs[0].label).toBe(inputs[0].key)
    expect(inputs[0].label).toBe("recipient")
  })
})

// ══ SECTION B — WHAT THE SAVE PATH ACTUALLY SENDS ════════════════════════════════════
//
// ⭐ The DIAGNOSIS `BUG-260828-02` asks for. Its own text records *"`lib/api/workflows.ts`
// never sends `inputs`: zero occurrences"* — a TRUE grep. Whether it is a true CONCLUSION is
// a different question, because `updateWorkflowDraft`'s body is `JSON.stringify(def)` with no
// field whitelist and `def` is `selectDefinition(snapshot)` WHOLE.
//
// Nothing below reads the DOM. The assertion is on the parsed request body.

const DRAFT_ID = "11111111-1111-1111-1111-111111111111"

interface PersistProps {
  definition: BuilderDefinition | null
}

describe("the save path — what a declared input actually puts on the wire", () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: DRAFT_ID, version: 1, token: "tok-1" }),
    })
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Every PATCH body this run produced, parsed. */
  const patchBodies = (mock: ReturnType<typeof vi.fn>) =>
    mock.mock.calls
      .filter((c) => (c[1] as RequestInit | undefined)?.method === "PATCH")
      .map((c) => JSON.parse(String((c[1] as RequestInit).body)) as Record<string, unknown>)

  it("carries inputs[] into the PATCH body of the REAL updateWorkflowDraft", async () => {
    vi.useFakeTimers()
    const store = createBuilderStore(draft())

    const view = renderHook(
      (p: PersistProps) =>
        useDraftPersistence({
          definition: p.definition,
          enabled: true,
          initialDraftId: DRAFT_ID,
          initialToken: "tok-0",
          store,
          publishInFlight: false,
          validationCause: null,
          onDraftCreated: () => {},
        }),
      { initialProps: { definition: selectDefinition(store.getState()) } as PersistProps },
    )

    act(() => {
      store.getState().setDeclaredInputs([declaredInputFor("recipient")])
    })
    act(() => {
      view.rerender({ definition: selectDefinition(store.getState()) })
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(AUTOSAVE_DEBOUNCE_MS + 50)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    const bodies = patchBodies(fetchMock)
    // NON-VACUITY: a run that issued no PATCH at all would make every claim below vacuous.
    expect(bodies.length).toBeGreaterThan(0)

    const last = bodies[bodies.length - 1]
    expect(last).toHaveProperty("inputs")
    expect(last.inputs).toEqual([
      { key: "recipient", label: "recipient", type: "text", required: true },
    ])

    // ⚠ And the OTHER half of the same measurement: the body carries no key the strict
    // definition model would refuse — a stray key is a 422 that destroys the write.
    for (const entry of last.inputs as Array<Record<string, unknown>>) {
      expect(Object.keys(entry).sort()).toEqual(["key", "label", "required", "type"])
    }

    // The request really was the PATCH this client issues, not something else.
    const patchCall = fetchMock.mock.calls.find(
      (c) => (c[1] as RequestInit | undefined)?.method === "PATCH",
    )
    expect(String(patchCall?.[0])).toContain(`/workflows/${DRAFT_ID}`)
  })
})

// ══ SECTION C — the mount is GATED, and that is measured on the real page ════════════

describe("the mount — one gated node on WorkflowBuilderPage", () => {
  const pageDefinition: BuilderDefinition = {
    slug: "vendor-brief",
    version: 1,
    status: "draft",
    business_requirement: "summarize vendor risk",
    phases: [phase("write", 0)],
  }

  function renderPage(canvas: boolean) {
    const features = { visual_workflow_canvas: canvas } as unknown as EffectiveFeatures
    return render(
      <EffectiveFeaturesProvider value={{ features, loading: false, refetch: vi.fn() }}>
        <div style={{ width: 1200, height: 800 }}>
          <WorkflowBuilderPage initial={{ definition: pageDefinition, draftId: "draft-1" }} />
        </div>
      </EffectiveFeaturesProvider>,
    )
  }

  it("POSITIVE CONTROL — with the canvas flag ON the affordance is in the DOM", async () => {
    renderPage(true)
    await waitFor(() =>
      expect(screen.getByTestId("declared-inputs-affordance")).toBeInTheDocument(),
    )
  })

  it("with the canvas flag OFF nothing from this feature is in the DOM", async () => {
    renderPage(false)
    // Wait for a node the flag-off header definitely renders, so the absence below is
    // measured on a MOUNTED page rather than on one that had not rendered yet.
    await waitFor(() => expect(screen.getByTestId("builder-grid")).toBeInTheDocument())
    expect(screen.queryByTestId("declared-inputs-affordance")).toBeNull()
    expect(screen.queryByTestId("declared-inputs-modal")).toBeNull()
  })
})
