/**
 * Phase 186-06 — the draft-persistence loop's proofs.
 *
 * SHAPE: `useLiveValidation.test.tsx`, copied deliberately — the co-located hook test whose
 * module mock SPREADS the real `@/lib/api` and overrides only the exports under test. A
 * hand-written replacement object is the shipped mock-completeness failure mode (every
 * symbol the path reaches has to be re-listed, and a forgotten one fails far from its
 * cause); spreading makes completeness automatic AND means the named refusals thrown in
 * these suites are the REAL classes from `lib/api.ts`. A drift between the name a class
 * assigns itself and the name the hook branches on becomes a failing test here rather than
 * a silent mis-classification in front of a person.
 *
 * THE STORE IS REAL, NOT A STUB. The hook reads its payload through `store.getState()` at
 * FIRE time (the shipped `onPersist` idiom), so a stubbed store would let a test assert a
 * payload the production path could never produce. Driving a real `createBuilderStore` is
 * what makes the "carries the LATEST definition" assertions mean something.
 *
 * F9 IS THE LOAD-BEARING ONE HERE. It is written so it can only pass on the single-flight
 * queue: the first write is held open with a `deferred`, a second edit matures its own
 * timer while that one is outstanding, and the call count must NOT move. Falsified before
 * it was trusted — with the in-flight guard removed it reads "expected 1 times, but got 2
 * times" (recorded in the plan SUMMARY).
 */
import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vitest"
import { act, renderHook } from "@testing-library/react"

import hookSource from "./useDraftPersistence?raw"
import {
  useDraftPersistence,
  AUTOSAVE_DEBOUNCE_MS,
  HOLD_PUBLISHING,
  HOLD_UNREADABLE,
  SAVE_FAILED_SENTENCE,
  type PersistState,
} from "./useDraftPersistence"
import {
  createWorkflowDraft,
  updateWorkflowDraft,
  WorkflowDraftUnreadableError,
  WorkflowNotFoundError,
  type WorkflowDraftWriteResult,
} from "@/lib/api"
import { createBuilderStore, selectDefinition } from "@/components/workflows/builderStore"
import type { PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"
import type { BuilderDefinition } from "@/pages/WorkflowBuilderPage"

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    createWorkflowDraft: vi.fn(),
    updateWorkflowDraft: vi.fn(),
    listDraftWorkflows: vi.fn(),
  }
})

const mockedCreate = vi.mocked(createWorkflowDraft)
const mockedUpdate = vi.mocked(updateWorkflowDraft)

// ── Local infrastructure (the analog's three helpers) ─────────────────────────

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

/** A promise whose settlement is controlled from OUTSIDE the executor, so a test can hold
 *  one write open and prove the next one is not issued while it is. */
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Advance the fake clock inside `act`, so React flushes the state updates the timers
 *  cause. The ASYNC form is required — the sync form does not flush the awaited
 *  microtasks between a timer firing and its promise resolving. */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

/** Flush pending microtasks (a settled deferred, and the follow-up write it releases)
 *  without moving the clock. Twice, because the queue drain is itself awaited. */
async function flush(): Promise<void> {
  await advance(0)
  await advance(0)
}

// ── Fixtures, hand-authored inline (the shipped corpus stays untouched) ───────

function phase(slug: string, index: number, type = "llm_single"): PhaseSpecJSON {
  return { slug, phase_index: index, config: { phase_type: type } }
}

function draft(): BuilderDefinition {
  return {
    slug: "risk-register",
    version: 1,
    business_requirement: "Summarise the week's risks.",
    project_folder_id: null,
    phases: [phase("search", 0, "llm_agent"), phase("write", 1)],
  }
}

const DRAFT_ID = "11111111-1111-1111-1111-111111111111"
const TOKEN_0 = "2026-08-01 12:00:00.123456+00"

function write(token: string): WorkflowDraftWriteResult {
  return { id: DRAFT_ID, version: 1, token }
}

/** The internals a rejected shape-check carries. NONE of this may reach a rendered value. */
const RAW_422_BODY = {
  detail: [
    {
      loc: ["body", "phases", 0, "config", "grounding_zzz"],
      msg: "PYDANTIC-INTERNAL-MARKER-DO-NOT-RENDER",
      type: "extra_forbidden",
    },
  ],
}

/** Every string reachable from the state, so "the raw body is not shown" is checked over
 *  the whole reachable graph rather than over the two fields we happened to think of. */
function reachableStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value)
  else if (Array.isArray(value)) for (const v of value) reachableStrings(v, out)
  else if (value && typeof value === "object")
    for (const v of Object.values(value)) reachableStrings(v, out)
  return out
}

// ── The mount harness ─────────────────────────────────────────────────────────

interface Props {
  definition: BuilderDefinition | null
  enabled: boolean
  publishInFlight: boolean
  validationCause: "unreadable" | "unreachable" | null
}

function harness(opts: { draftId?: string | null; token?: string | null } = {}) {
  const store = createBuilderStore(draft())

  // `markSaved` is replaced through `setState`, not through a property spy: zustand
  // rebuilds the state object on every set, and only a value written INTO the state
  // survives that. The real action still runs, so `dirty` behaves exactly as it ships.
  const markSaved = vi.fn()
  const realMarkSaved = store.getState().markSaved
  store.setState({
    markSaved: () => {
      markSaved()
      realMarkSaved()
    },
  })

  const created = vi.fn()
  const initialProps: Props = {
    definition: selectDefinition(store.getState()),
    enabled: true,
    publishInFlight: false,
    validationCause: null,
  }

  const view = renderHook(
    (p: Props) =>
      useDraftPersistence({
        definition: p.definition,
        enabled: p.enabled,
        initialDraftId: opts.draftId === undefined ? DRAFT_ID : opts.draftId,
        initialToken: opts.token === undefined ? TOKEN_0 : opts.token,
        store,
        publishInFlight: p.publishInFlight,
        validationCause: p.validationCause,
        onDraftCreated: created,
      }),
    { initialProps },
  )

  let props = initialProps
  const set = (patch: Partial<Props>) => {
    props = { ...props, ...patch }
    act(() => {
      view.rerender(props)
    })
  }

  /** One author edit: a structural change in the store (which arms `dirty` the way it
   *  ships) followed by the new `definition` identity the page's memo would produce. */
  const edit = () => {
    act(() => {
      store.getState().addPhaseOfType("llm_single")
    })
    set({ definition: selectDefinition(store.getState()) })
  }

  return { store, markSaved, created, view, set, edit }
}

function stateOf(view: ReturnType<typeof harness>["view"]): PersistState {
  return view.result.current.state
}

function sentDefinition(callIndex: number): BuilderDefinition {
  return mockedUpdate.mock.calls[callIndex][1] as unknown as BuilderDefinition
}

let warnSpy: MockInstance

beforeEach(() => {
  vi.useFakeTimers()
  mockedCreate.mockReset()
  mockedUpdate.mockReset()
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  warnSpy.mockRestore()
  vi.useRealTimers()
})

// ── F9 — single flight, and the token chain ───────────────────────────────────

describe("useDraftPersistence — F9: at most ONE PATCH is outstanding per draft", () => {
  it("holds the second edit rather than issuing a second PATCH, then sends it with the token the first write returned", async () => {
    const first = deferred<WorkflowDraftWriteResult>()
    let outstanding = 0
    let peak = 0
    const tracked = (p: Promise<WorkflowDraftWriteResult>) => {
      outstanding += 1
      peak = Math.max(peak, outstanding)
      return p.finally(() => {
        outstanding -= 1
      })
    }
    mockedUpdate
      .mockImplementationOnce(() => tracked(first.promise))
      .mockImplementationOnce(() => tracked(Promise.resolve(write("T2"))))

    const h = harness()
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)

    expect(mockedUpdate).toHaveBeenCalledTimes(1)
    expect(mockedUpdate.mock.calls[0][2]).toBe(TOKEN_0)

    // An edit lands while that write is still outstanding, and its OWN timer matures.
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS * 3)

    // THE INVARIANT: at every instant the number of outstanding writes for this draft is ≤ 1.
    expect(mockedUpdate).toHaveBeenCalledTimes(1)
    expect(peak).toBe(1)

    first.resolve(write("T1"))
    await flush()

    expect(mockedUpdate).toHaveBeenCalledTimes(2)
    // The follow-up carries the token the immediately preceding successful write returned.
    expect(mockedUpdate.mock.calls[1][2]).toBe("T1")
    // …and the LATEST definition, not the one current when the first timer matured.
    expect(sentDefinition(1).phases).toHaveLength(4)
    expect(peak).toBe(1)
  })

  it("files no receipt for a save a newer edit already superseded", async () => {
    const first = deferred<WorkflowDraftWriteResult>()
    mockedUpdate
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => Promise.resolve(write("T2")))

    const h = harness()
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)

    first.resolve(write("T1"))
    // Only the FINAL turn of the drain may clear `dirty` — a confirmed write whose payload
    // is already stale is not a receipt for what is on screen.
    await flush()
    expect(h.markSaved).toHaveBeenCalledTimes(1)
    expect(stateOf(h.view)).toEqual({ kind: "saved", at: expect.any(Number) })
  })

  it("creates the draft EXACTLY once, adopts its token, and names the new id to the caller", async () => {
    const create = deferred<WorkflowDraftWriteResult>()
    mockedCreate.mockImplementationOnce(() => create.promise)
    mockedUpdate.mockResolvedValue(write("T-after"))

    const h = harness({ draftId: null, token: null })
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)
    expect(mockedCreate).toHaveBeenCalledTimes(1)

    // A second edit while the create is in flight must NOT re-create (the UNIQUE(slug,
    // version) storm the shipped `creatingRef` collapses).
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS * 3)
    expect(mockedCreate).toHaveBeenCalledTimes(1)

    create.resolve({ id: "new-draft", version: 1, token: "T-created" })
    await flush()

    expect(mockedCreate).toHaveBeenCalledTimes(1)
    expect(h.created).toHaveBeenCalledWith("new-draft")
    expect(h.view.result.current.draftId).toBe("new-draft")
    // The queued follow-up PATCHes the row just created, guarded by ITS token.
    expect(mockedUpdate).toHaveBeenCalledTimes(1)
    expect(mockedUpdate.mock.calls[0][0]).toBe("new-draft")
    expect(mockedUpdate.mock.calls[0][2]).toBe("T-created")
  })

  it("writes nothing at all on mount — only a real change is worth a request", async () => {
    mockedUpdate.mockResolvedValue(write("T1"))
    harness()
    await advance(AUTOSAVE_DEBOUNCE_MS * 5)
    expect(mockedUpdate).not.toHaveBeenCalled()
    expect(mockedCreate).not.toHaveBeenCalled()
  })
})

// ── F15 — the token is opaque: this module cannot parse it ────────────────────

const PARSES_A_DATE = /new Date\(|Date\.parse\(/

describe("useDraftPersistence — F15: the source fence (the `?raw` house idiom)", () => {
  it("names no date-parsing call form anywhere in the module", () => {
    expect(hookSource).not.toMatch(PARSES_A_DATE)
  })

  it("the fence is a REAL control — it FINDS a planted parse and LEAVES prose alone", () => {
    // Positive control.
    expect(PARSES_A_DATE.test("const d = new Date(token)")).toBe(true)
    expect(PARSES_A_DATE.test("const t = Date.parse(token)")).toBe(true)
    // NEGATIVE control (the `useGroundingBundle.test.ts:294-316` warning): a blanket grep
    // would forbid this module's own docblock from naming the hazard it exists to describe.
    expect(
      PARSES_A_DATE.test("// NEVER parse this into a JS Date — microseconds are lost"),
    ).toBe(false)
  })

  it("cancels no write — the abort belt `useLiveValidation` uses is deliberately absent", () => {
    expect(hookSource).not.toMatch(/AbortController/)
  })
})

// ── F8 — never a false receipt ────────────────────────────────────────────────

describe("useDraftPersistence — F8: a refusal never files a receipt", () => {
  it("a 422 leaves the draft dirty, calls no receipt action, and shows none of the raw body", async () => {
    mockedUpdate.mockRejectedValue(new WorkflowDraftUnreadableError(RAW_422_BODY))

    const h = harness()
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)
    await flush()

    expect(stateOf(h.view)).toEqual({ kind: "error", sentence: HOLD_UNREADABLE })
    expect(stateOf(h.view).kind).not.toBe("saved")
    // The receipt action itself was never reached — not merely "the state is not saved".
    expect(h.markSaved).not.toHaveBeenCalled()
    expect(h.store.getState().dirty).toBe(true)

    const shown = reachableStrings(stateOf(h.view)).join("   ")
    expect(shown).toContain(HOLD_UNREADABLE)
    for (const internal of reachableStrings(RAW_422_BODY)) {
      expect(shown).not.toContain(internal)
    }
  })

  it("a 404 gets the generic sentence — a missing row is not an unreadable shape", async () => {
    mockedUpdate.mockRejectedValue(new WorkflowNotFoundError())

    const h = harness()
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)
    await flush()

    expect(stateOf(h.view)).toEqual({ kind: "error", sentence: SAVE_FAILED_SENTENCE })
    expect(h.markSaved).not.toHaveBeenCalled()
  })

  it("a dropped connection gets the generic sentence too", async () => {
    mockedUpdate.mockRejectedValue(new TypeError("Failed to fetch"))

    const h = harness()
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)
    await flush()

    expect(stateOf(h.view)).toEqual({ kind: "error", sentence: SAVE_FAILED_SENTENCE })
    expect(h.store.getState().dirty).toBe(true)
  })
})

// ── F11 — one hold mechanism, two sentences ───────────────────────────────────

describe("useDraftPersistence — F11: writes hold while a publish runs, and flush on release", () => {
  it("issues nothing while publishing, says why, then flushes EXACTLY ONE write carrying the latest definition", async () => {
    mockedUpdate.mockResolvedValue(write("T1"))

    const h = harness()
    h.set({ publishInFlight: true })
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS * 5)

    expect(mockedUpdate).not.toHaveBeenCalled()
    expect(stateOf(h.view)).toEqual({ kind: "held", sentence: HOLD_PUBLISHING })

    // A second edit accumulates as dirty while held — no timer is burned for it.
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS * 5)
    expect(mockedUpdate).not.toHaveBeenCalled()

    h.set({ publishInFlight: false })
    await flush()

    expect(mockedUpdate).toHaveBeenCalledTimes(1)
    // BOTH edits, not the one that was current when the first timer matured.
    expect(sentDefinition(0).phases).toHaveLength(4)
    expect(h.markSaved).toHaveBeenCalledTimes(1)
  })

  it("holds on an `unreadable` verdict with the OTHER sentence — one mechanism, two words", async () => {
    mockedUpdate.mockResolvedValue(write("T1"))

    const h = harness()
    h.set({ validationCause: "unreadable" })
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS * 3)

    expect(mockedUpdate).not.toHaveBeenCalled()
    expect(stateOf(h.view)).toEqual({ kind: "held", sentence: HOLD_UNREADABLE })

    h.set({ validationCause: null })
    await flush()
    expect(mockedUpdate).toHaveBeenCalledTimes(1)
  })

  it("does NOT hold on `unreachable` — an unreachable check must not stall autosave", async () => {
    mockedUpdate.mockResolvedValue(write("T1"))

    const h = harness()
    h.set({ validationCause: "unreachable" })
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)
    await flush()

    expect(mockedUpdate).toHaveBeenCalledTimes(1)
  })

  it("publishing outranks unreadable — one reason is shown, and it is the publish one", async () => {
    const h = harness()
    h.set({ publishInFlight: true, validationCause: "unreadable" })
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)

    expect(stateOf(h.view)).toEqual({ kind: "held", sentence: HOLD_PUBLISHING })
  })
})

// ── The explicit Save-draft affordance (D-186-03) ─────────────────────────────

describe("useDraftPersistence — saveNow, the deliberate commit-now", () => {
  it("writes immediately without waiting for the debounce", async () => {
    mockedUpdate.mockResolvedValue(write("T1"))

    const h = harness()
    let ok = false
    await act(async () => {
      ok = await h.view.result.current.saveNow()
    })

    expect(ok).toBe(true)
    expect(mockedUpdate).toHaveBeenCalledTimes(1)
    expect(h.markSaved).toHaveBeenCalledTimes(1)
  })

  it("refuses to pretend while held — it reports the hold instead of a save", async () => {
    mockedUpdate.mockResolvedValue(write("T1"))

    const h = harness()
    h.set({ publishInFlight: true })
    let ok = true
    await act(async () => {
      ok = await h.view.result.current.saveNow()
    })

    expect(ok).toBe(false)
    expect(mockedUpdate).not.toHaveBeenCalled()
    expect(stateOf(h.view)).toEqual({ kind: "held", sentence: HOLD_PUBLISHING })
  })
})
