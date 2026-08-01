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
  PUBLISHED_CONFLICT_MESSAGE,
  type PersistState,
} from "./useDraftPersistence"
import {
  createWorkflowDraft,
  listDraftWorkflows,
  updateWorkflowDraft,
  WorkflowConflictError,
  WorkflowDraftUnreadableError,
  WorkflowNotFoundError,
  WorkflowStaleTokenError,
  type WorkflowDraftRow,
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
const mockedList = vi.mocked(listDraftWorkflows)

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

function harness(
  opts: {
    draftId?: string | null
    token?: string | null
    /**
     * F20's flag (186-13). Mounted, not flipped after the fact: the claim under test is
     * about a session that runs with `visual_workflow_canvas` OFF from the first render,
     * and a hook that starts enabled and is switched off later has already had one pass
     * of every effect with the flag on. Defaulted to `true`, so every pre-existing call
     * site of this harness is unchanged.
     */
    enabled?: boolean
    /**
     * F17's receipt recorder (186-09). Invoked AT THE INSTANT the receipt is filed and
     * BEFORE the real action runs, so a test can record what the store held versus what
     * had actually been sent. Optional and defaulted away, so every pre-existing call
     * site of this harness is unchanged.
     */
    onReceipt?: (store: ReturnType<typeof createBuilderStore>) => void
  } = {},
) {
  const store = createBuilderStore(draft())

  // `markSaved` is replaced through `setState`, not through a property spy: zustand
  // rebuilds the state object on every set, and only a value written INTO the state
  // survives that. The real action still runs, so `dirty` behaves exactly as it ships.
  const markSaved = vi.fn()
  const realMarkSaved = store.getState().markSaved
  store.setState({
    markSaved: () => {
      markSaved()
      opts.onReceipt?.(store)
      realMarkSaved()
    },
  })

  const created = vi.fn()
  const initialProps: Props = {
    definition: selectDefinition(store.getState()),
    enabled: opts.enabled ?? true,
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
  mockedList.mockReset()
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

// ── F17 — a receipt names the payload it actually wrote (GAP-1 / CR-01) ───────

/**
 * Phase 186-09 — the interleaving F9 above does NOT cover, and the reason it does not.
 *
 * F9's second edit MATURES ITS OWN TIMER while the first write is held open. That branch
 * works and always did: a matured timer that finds `inFlightRef.current` true sets
 * `pendingRef`, and the drain reads that flag before deciding whether to file a receipt.
 *
 * F17 drives the branch that did not work. The second edit's timer is deliberately left
 * IMMATURE when the first write resolves — only `AUTOSAVE_DEBOUNCE_MS / 2` is advanced. An
 * edit rescheduling the debounce effect (deps `[definition, enabled]`) arms nothing; the
 * re-check of `inFlightRef` happens at FIRE time, a full second later, and a PATCH round
 * trip is normally far shorter than that. So the completed write found a clear
 * `pendingRef`, filed `Saved ✓` for a payload that predated the edit, and cleared `dirty` —
 * after which the orphaned timer read `if (!store.getState().dirty) return` and dropped the
 * edit on the floor. This is the common shape (type, pause about a second, resume, stop),
 * not an edge case, and it also disarms `beforeunload`, the in-app leave guard and the blur
 * rescue, all of which key on `dirty`.
 *
 * THE RED NUMBERS, so a future reader can re-observe them by reverting the fix:
 *   F17a — the recorded pair is { storePhases: 4, sentPhases: 3 }: `[3]` where `[4]` is
 *          expected. The receipt named a payload the store had already moved past.
 *   F17b — `updateWorkflowDraft` was called 1 time where 2 are expected, and
 *          `mock.calls[1]` does not exist. The second edit never reached the server.
 *   F17c — also 1 where 2 are expected, for the SAME upstream reason: the orphaned timer
 *          found `dirty` already cleared and issued nothing at all. Its real job is the
 *          other direction — once the count reaches 2 it guards against over-correcting
 *          into a third, duplicate write when the stale timer finally matures.
 *
 * The lesson is T-185-04-01's, a second time: an invariant guard scoped to the wrong thing
 * is green and worthless. The old guard was scoped to a QUEUE FLAG; the property that
 * matters is WHAT WAS WRITTEN.
 */
describe("useDraftPersistence — F17: a receipt names the payload it actually wrote (CR-01)", () => {
  interface Receipt {
    storePhases: number
    sentPhases: number | null
  }

  /**
   * The interleaving, driven once per assertion so each property fails on its own terms.
   * `draft()` starts at 2 phases, so edit #1 leaves 3 and edit #2 leaves 4.
   */
  async function driveMidFlightEdit(): Promise<{
    h: ReturnType<typeof harness>
    receipts: Receipt[]
  }> {
    const receipts: Receipt[] = []
    const first = deferred<WorkflowDraftWriteResult>()
    mockedUpdate
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => Promise.resolve(write("T2")))

    const h = harness({
      onReceipt: (store) => {
        const calls = mockedUpdate.mock.calls
        const last = calls.length > 0 ? calls[calls.length - 1] : null
        receipts.push({
          storePhases: store.getState().phases.length,
          sentPhases: last ? (last[1] as unknown as BuilderDefinition).phases.length : null,
        })
      },
    })

    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)

    // Write #1 is issued and HELD OPEN by the deferred, carrying the 3-phase definition.
    expect(mockedUpdate).toHaveBeenCalledTimes(1)
    expect(mockedUpdate.mock.calls[0][2]).toBe(TOKEN_0)
    expect(sentDefinition(0).phases).toHaveLength(3)

    // The author keeps typing. The store now holds 4 phases and is dirty, and the debounce
    // effect has re-armed with a FRESH timer.
    h.edit()

    // ★ THE LOAD-BEARING LINE OF THIS WHOLE SUITE. HALF the debounce, deliberately: the
    //   second edit's own timer has NOT matured, so nothing anywhere arms `pendingRef`.
    //   Advancing a full AUTOSAVE_DEBOUNCE_MS here would turn this back into F9.
    await advance(AUTOSAVE_DEBOUNCE_MS / 2)

    first.resolve(write("T1"))
    await flush()

    return { h, receipts }
  }

  it("F17a — at the instant the receipt is filed, the sent payload IS the store's payload", async () => {
    const { receipts } = await driveMidFlightEdit()

    expect(receipts).toHaveLength(1)
    // Compared as lists so the failure output prints the pair: RED reads [3] vs [4].
    expect(receipts.map((r) => r.sentPhases)).toEqual(receipts.map((r) => r.storePhases))
  })

  it("F17b — an edit made mid-flight, before its own timer matures, is written not discarded", async () => {
    const { h } = await driveMidFlightEdit()

    expect(mockedUpdate).toHaveBeenCalledTimes(2)
    expect(sentDefinition(1).phases).toHaveLength(4)
    // Stated over the STORE rather than over the literal 4: whatever the author has, the
    // server was told about.
    expect(sentDefinition(1).phases).toHaveLength(h.store.getState().phases.length)
    // …and the follow-up is guarded by the token the first write returned, not the stale one.
    expect(mockedUpdate.mock.calls[1][2]).toBe("T1")
  })

  it("F17c — the orphaned timer maturing later issues NO extra write", async () => {
    await driveMidFlightEdit()

    await advance(AUTOSAVE_DEBOUNCE_MS * 3)
    await flush()

    expect(mockedUpdate).toHaveBeenCalledTimes(2)
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

  it("a PUBLISHED row keeps the sentence that names the way out (186-07 closes 186-06's debt)", async () => {
    // The 184-11 / D-184-16-debt-3 line. It lived on the page until 186-07 moved the write
    // seam here; if this branch were missing, a published-row save would fall into the
    // cause-neutral arm and a person on a frozen row would be told nothing they could act
    // on. Falsifiable by deleting the `WorkflowConflictError` branch in `refusalOf`.
    mockedUpdate.mockRejectedValue(new WorkflowConflictError())

    const h = harness()
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)
    await flush()

    expect(stateOf(h.view)).toEqual({ kind: "error", sentence: PUBLISHED_CONFLICT_MESSAGE })
    // …and it is NOT the generic line, which is the whole point of the branch.
    expect(PUBLISHED_CONFLICT_MESSAGE).not.toBe(SAVE_FAILED_SENTENCE)
    // A refusal is still a refusal: no receipt, still dirty.
    expect(h.markSaved).not.toHaveBeenCalled()
    expect(h.store.getState().dirty).toBe(true)
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

// ── F20 — with the canvas flag OFF the loop writes NOTHING automatically ──────

/**
 * Phase 186-13 (GAP-3 / WR-03) — the flag-off write leak, and why it is not theoretical.
 *
 * D-181-01 is this milestone's HARD gate #1: with `visual_workflow_canvas` OFF the product
 * is byte-identical to the one that shipped before the canvas existed. Autosave is net-new
 * behaviour, so `enabled` carries the flag (`WorkflowBuilderPage.tsx:812` —
 * `canvasEnabled && builderPhase === "drafted"`) and the debounce effect bails on it.
 *
 * THE HOLD-RELEASE EFFECT DID NOT READ IT, and the hold is reachable with the flag off:
 *
 *   • `renderPublish` — and therefore `setPublishInFlight`, which is the sole input to the
 *     publish half of `holdReason` — is mounted UNCONDITIONALLY at
 *     `WorkflowBuilderPage.tsx:1700-1702`. Publish is a pre-186 door and correctly is not
 *     behind the canvas flag.
 *   • `BuilderSaveRegion`'s Save-draft button is likewise unconditional, and `saveNow`
 *     is not gated on `enabled` either (that is D-186-03 + D-186-08, and it is deliberate).
 *     Only the quiet status LINE is hidden by the flag.
 *
 * So a flag-off session that edits and then publishes reaches `{kind:"held"}`, and when the
 * gauntlet resolves the release fired `performWrite()` — an AUTOMATIC PATCH, in a session
 * where the person had switched the whole feature off. That is a write past the revert
 * switch, which is the one thing the revert switch exists to make impossible.
 *
 * THE RED NUMBERS, so a future reader can re-observe them by reverting the fix:
 *   F20a — `updateWorkflowDraft` called 1 time where 0 are expected.
 *   F20a (create variant) — `createWorkflowDraft` called 1 time where 0 are expected. The
 *          claim is ZERO NETWORK CALLS, not zero PATCHes, and the create branch is reachable
 *          whenever the session started without a draft row.
 *   F20b — 1 where 0 are expected. Pressing Save while held arms `heldPendingRef`, which is
 *          the OTHER trigger of the release flush, so it has to be driven separately.
 *
 * F20c is the contrast control, and it is the reason this describe cannot pass by simply
 * breaking the flush: with the flag ON the identical drive must still produce exactly one
 * write carrying both edits.
 */
describe("useDraftPersistence — F20: with the canvas flag OFF the loop writes nothing automatically (D-181-01)", () => {
  /** The flag-off reachability drive: edit, publish, release. Verbatim the F11 arrangement,
   *  so the only difference between this describe and that one is `enabled`. */
  async function editThroughAPublish(h: ReturnType<typeof harness>): Promise<void> {
    h.set({ publishInFlight: true })
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS * 5)

    // A second edit accumulates while the gauntlet runs — the common shape.
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS * 5)

    h.set({ publishInFlight: false })
    await flush()
    // Well past every timer the release could have armed.
    await advance(AUTOSAVE_DEBOUNCE_MS * 5)
    await flush()
  }

  it("F20a — flag off: edit, publish, release ⇒ ZERO network calls", async () => {
    mockedUpdate.mockResolvedValue(write("T-SHOULD-NEVER-BE-SENT"))
    mockedCreate.mockResolvedValue(write("T-SHOULD-NEVER-BE-CREATED"))

    const h = harness({ enabled: false })
    await editThroughAPublish(h)

    expect(mockedUpdate).not.toHaveBeenCalled()
    expect(mockedCreate).not.toHaveBeenCalled()
    // The work is not lost, it is simply not SENT: the draft stays dirty, so the leave
    // guard still fires and the explicit Save button still has something to do.
    expect(h.store.getState().dirty).toBe(true)
    expect(h.markSaved).not.toHaveBeenCalled()
  })

  it("F20a — the same claim on a session with no draft row yet: no CREATE either", async () => {
    // `createWorkflowDraft` is the other half of "zero network calls", and it is reachable
    // exactly when the session started without a row (three of the Builder's four entry
    // routes create). Asserting only on PATCHes would leave this path unmeasured.
    mockedUpdate.mockResolvedValue(write("T-SHOULD-NEVER-BE-SENT"))
    mockedCreate.mockResolvedValue(write("T-SHOULD-NEVER-BE-CREATED"))

    const h = harness({ enabled: false, draftId: null, token: null })
    await editThroughAPublish(h)

    expect(mockedCreate).not.toHaveBeenCalled()
    expect(mockedUpdate).not.toHaveBeenCalled()
    expect(h.created).not.toHaveBeenCalled()
  })

  it("F20b — flag off: Save pressed WHILE held, then release ⇒ still nothing automatic", async () => {
    mockedUpdate.mockResolvedValue(write("T-SHOULD-NEVER-BE-SENT"))
    mockedCreate.mockResolvedValue(write("T-SHOULD-NEVER-BE-CREATED"))

    const h = harness({ enabled: false })
    h.set({ publishInFlight: true })
    h.edit()

    // The press is the OTHER way `heldPendingRef` gets armed, and the release reads it as
    // "there is unsent work" — so this path has to be driven separately from F20a's.
    let ok = true
    await act(async () => {
      ok = await h.view.result.current.saveNow()
    })
    expect(ok).toBe(false)
    expect(mockedUpdate).not.toHaveBeenCalled()

    h.set({ publishInFlight: false })
    await flush()
    await advance(AUTOSAVE_DEBOUNCE_MS * 5)
    await flush()

    // A press the person made is honoured; a flush nobody asked for is not. The release
    // must not turn the earlier press into a write the person did not authorise NOW.
    expect(mockedUpdate).not.toHaveBeenCalled()
    expect(mockedCreate).not.toHaveBeenCalled()
    expect(h.store.getState().dirty).toBe(true)
  })

  it("F20c — the flag-ON behaviour is UNCHANGED: one write, carrying both edits", async () => {
    // The contrast control. Without it, deleting the flush outright would pass F20a/F20b.
    mockedUpdate.mockResolvedValue(write("T1"))

    const h = harness()
    await editThroughAPublish(h)

    expect(mockedUpdate).toHaveBeenCalledTimes(1)
    expect(sentDefinition(0).phases).toHaveLength(4)
    expect(h.markSaved).toHaveBeenCalledTimes(1)
  })

  it("F20d — the hold READING is still reachable flag-off: Save reports it rather than saving", async () => {
    // The half that must NOT be gated. `saveNow` is user-initiated, so it keeps working on
    // the flag-off surface (D-186-03) — and when it cannot write, it says so. WR-04 is that
    // this sentence never reached the DOM there; `BuilderSaveRegion.test.tsx` owns that half.
    mockedUpdate.mockResolvedValue(write("T-SHOULD-NEVER-BE-SENT"))

    const h = harness({ enabled: false })
    h.set({ publishInFlight: true })

    let ok = true
    await act(async () => {
      ok = await h.view.result.current.saveNow()
    })

    expect(ok).toBe(false)
    expect(stateOf(h.view).kind).toBe("held")
    expect(mockedUpdate).not.toHaveBeenCalled()
  })
})

// ── F10 — a conflict halts the loop, and both exits exist ─────────────────────

describe("useDraftPersistence — F10: a stale token halts the loop dead", () => {
  it("issues nothing across three further edits after the refusal", async () => {
    mockedUpdate.mockRejectedValueOnce(new WorkflowStaleTokenError("T-SERVER"))
    mockedUpdate.mockResolvedValue(write("T-SHOULD-NEVER-BE-SENT"))

    const h = harness()
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)
    await flush()

    expect(stateOf(h.view)).toEqual({ kind: "conflict", currentToken: "T-SERVER" })
    const atConflict = mockedUpdate.mock.calls.length

    for (let i = 0; i < 3; i += 1) {
      h.edit()
      await advance(AUTOSAVE_DEBOUNCE_MS * 3)
      await flush()
    }

    expect(mockedUpdate).toHaveBeenCalledTimes(atConflict)
    expect(h.markSaved).not.toHaveBeenCalled()
  })

  it("overwrite is ONE deliberate PATCH carrying the token the refusal returned", async () => {
    mockedUpdate
      .mockRejectedValueOnce(new WorkflowStaleTokenError("T-SERVER"))
      .mockResolvedValueOnce(write("T-NEXT"))

    const h = harness()
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)
    await flush()
    expect(stateOf(h.view).kind).toBe("conflict")

    await act(async () => {
      await h.view.result.current.overwrite()
    })

    expect(mockedUpdate).toHaveBeenCalledTimes(2)
    expect(mockedUpdate.mock.calls[1][2]).toBe("T-SERVER")
    expect(stateOf(h.view)).toEqual({ kind: "saved", at: expect.any(Number) })
    expect(h.markSaved).toHaveBeenCalledTimes(1)
  })

  it("an overwrite that loses a SECOND race stays in conflict, with the NEWER token", async () => {
    mockedUpdate
      .mockRejectedValueOnce(new WorkflowStaleTokenError("T-SERVER"))
      .mockRejectedValueOnce(new WorkflowStaleTokenError("T-NEWER"))

    const h = harness()
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)
    await flush()

    await act(async () => {
      await h.view.result.current.overwrite()
    })

    expect(stateOf(h.view)).toEqual({ kind: "conflict", currentToken: "T-NEWER" })
    expect(h.markSaved).not.toHaveBeenCalled()
  })

  it("the hook never decides to overwrite by itself", async () => {
    mockedUpdate.mockRejectedValue(new WorkflowStaleTokenError("T-SERVER"))

    const h = harness()
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)
    await flush()

    // Everything a person could do EXCEPT choosing an exit: more edits, more time.
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS * 20)
    await flush()

    expect(mockedUpdate).toHaveBeenCalledTimes(1)
    expect(stateOf(h.view).kind).toBe("conflict")
  })

  it("reload adopts the server's row AND its token; the next autosave carries the reloaded one", async () => {
    mockedUpdate.mockRejectedValueOnce(new WorkflowStaleTokenError("T-SERVER"))
    mockedUpdate.mockResolvedValue(write("T-AFTER"))

    const h = harness()
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)
    await flush()
    expect(stateOf(h.view).kind).toBe("conflict")

    const serverRow: WorkflowDraftRow = {
      id: DRAFT_ID,
      slug: "risk-register",
      version: 1,
      name: "Risk register",
      definition: { ...draft(), phases: [phase("server-side", 0)] },
      token: "T-RELOADED",
    }
    mockedList.mockResolvedValue([serverRow])

    await act(async () => {
      await h.view.result.current.reload()
    })

    expect(mockedList).toHaveBeenCalledTimes(1)
    expect(h.store.getState().phases).toHaveLength(1)
    expect(h.store.getState().dirty).toBe(false)
    expect(stateOf(h.view)).toEqual({ kind: "idle" })

    // The loop resumes, guarded by the token the reload adopted — not the pre-conflict one.
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)
    await flush()

    const calls = mockedUpdate.mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[1][2]).toBe("T-RELOADED")
  })

  it("a reload whose row is gone lands in an honest error, never silently", async () => {
    mockedUpdate.mockRejectedValueOnce(new WorkflowStaleTokenError("T-SERVER"))

    const h = harness()
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)
    await flush()

    mockedList.mockResolvedValue([])
    await act(async () => {
      await h.view.result.current.reload()
    })

    expect(stateOf(h.view).kind).toBe("error")
  })
})

// ── F19 — single flight is a property of the WRITER (GAP-2 / WR-01) ───────────

/**
 * Phase 186-12 — the difference between a PATCH test and a PROPERTY test.
 *
 * F9 above pins "at most one PATCH is outstanding" for exactly ONE caller: the debounce
 * timer. That is a patch test. It passes because the timer happens to carry its own
 * `inFlightRef` check, and it says nothing whatsoever about the other callers — which is
 * how `overwrite()` and `reload()` shipped without one. F19 pins the same invariant for the
 * whole caller SET, so the property survives a caller F9 never imagined.
 *
 * THE TWO CALLERS F9 NEVER EXERCISED ARE THE ESCAPE HATCHES. `overwrite` and `reload` are
 * the mechanism built specifically to RESOLVE a concurrency conflict, and before 186-12
 * neither of them was concurrency-safe: an ordinary double-click on Overwrite issued two
 * concurrent PATCHes carrying the SAME token, the server refused the loser `stale_token`,
 * and the loop raised a conflict banner for a conflict that had never happened. The
 * conflict resolver manufacturing conflicts is the T-185-04-01 lesson met a third time —
 * an invariant that each caller has to remember is not an invariant.
 *
 * THE RED NUMBERS, so a future reader can re-observe them by reverting the fix:
 *   F19a — three rows (the debounce timer, `saveNow`, the hold release) are GREEN before the
 *          fix, because those callers carry their own check. The `overwrite()` row reports
 *          a peak of 2.
 *   F19b — `updateWorkflowDraft` is called 2 times after the conflict where 1 is expected,
 *          and the surface reads `conflict` while the resolution is still in flight.
 *   F19c — `listDraftWorkflows` is called 2 times where 1 is expected.
 *   F19d — the next request carries `T-STALE-RACE`, the token minted by the racing second
 *          overwrite that completed LAST, rather than `T-FRESH` from the write the person
 *          actually authorised.
 *
 * The tracking idiom below (`outstanding` / `peak` / `tracked`) is F9's, reused rather than
 * reinvented: one counter pair incremented at CALL time and decremented in a `.finally`, so
 * `peak` records the true simultaneous maximum rather than a count of requests.
 */
describe("useDraftPersistence — F19: single flight is a property of the WRITER (WR-01)", () => {
  let outstanding = 0
  let peak = 0

  beforeEach(() => {
    outstanding = 0
    peak = 0
  })

  function tracked(p: Promise<WorkflowDraftWriteResult>): Promise<WorkflowDraftWriteResult> {
    outstanding += 1
    peak = Math.max(peak, outstanding)
    return p.finally(() => {
      outstanding -= 1
    })
  }

  type Held = { h: ReturnType<typeof harness>; first: Deferred<WorkflowDraftWriteResult> }

  /** The shared arrangement: one autosave write issued and HELD OPEN by a deferred. */
  async function holdFirstWriteOpen(): Promise<Held> {
    const first = deferred<WorkflowDraftWriteResult>()
    mockedUpdate.mockImplementation(() => tracked(Promise.resolve(write("T-EXTRA"))))
    mockedUpdate.mockImplementationOnce(() => tracked(first.promise))

    const h = harness()
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)

    expect(mockedUpdate).toHaveBeenCalledTimes(1)
    expect(outstanding).toBe(1)
    return { h, first }
  }

  /**
   * The `overwrite` row needs its OWN arrangement, and the reason is structural rather than
   * incidental: `overwrite` is only reachable from a `conflict`, and a conflict is only
   * reachable from a REFUSED write. So this row spends its first request reaching the
   * conflict, takes the exit once to put a write in flight, and only then double-clicks.
   */
  async function conflictThenHoldTheOverwriteOpen(): Promise<Held> {
    const first = deferred<WorkflowDraftWriteResult>()
    mockedUpdate.mockImplementation(() => tracked(Promise.resolve(write("T-EXTRA"))))
    mockedUpdate
      .mockImplementationOnce(() =>
        tracked(Promise.reject(new WorkflowStaleTokenError("T-SERVER"))),
      )
      .mockImplementationOnce(() => tracked(first.promise))

    const h = harness()
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)
    await flush()
    expect(stateOf(h.view).kind).toBe("conflict")

    await act(async () => {
      void h.view.result.current.overwrite()
      await Promise.resolve()
    })
    expect(mockedUpdate).toHaveBeenCalledTimes(2)
    expect(outstanding).toBe(1)
    return { h, first }
  }

  const ROWS: {
    name: string
    arrange: () => Promise<Held>
    drive: (h: ReturnType<typeof harness>) => Promise<void>
  }[] = [
    {
      name: "the debounce timer",
      arrange: holdFirstWriteOpen,
      drive: async (h) => {
        h.edit()
        await advance(AUTOSAVE_DEBOUNCE_MS)
      },
    },
    {
      name: "saveNow()",
      arrange: holdFirstWriteOpen,
      drive: async (h) => {
        await act(async () => {
          await h.view.result.current.saveNow()
        })
      },
    },
    {
      name: "the hold release",
      arrange: holdFirstWriteOpen,
      drive: async (h) => {
        h.set({ publishInFlight: true })
        h.set({ publishInFlight: false })
        await flush()
      },
    },
    {
      name: "overwrite()",
      arrange: conflictThenHoldTheOverwriteOpen,
      drive: async (h) => {
        await act(async () => {
          void h.view.result.current.overwrite()
          await Promise.resolve()
        })
      },
    },
  ]

  for (const row of ROWS) {
    it(`F19a — ${row.name} adds no concurrent request while a write is outstanding`, async () => {
      const { h } = await row.arrange()

      await row.drive(h)
      // Time passes and the first write is deliberately NEVER resolved, so anything a
      // second entry point issued is still outstanding when the peak is read.
      await advance(AUTOSAVE_DEBOUNCE_MS * 2)

      expect(peak).toBe(1)
    })
  }

  it("F19b — a double-click on Overwrite is ONE PATCH, so no stale_token conflict is manufactured", async () => {
    const held = deferred<WorkflowDraftWriteResult>()
    // What the SERVER does to the loser of a same-token race. If a second PATCH is ever
    // issued, this is the refusal the loop turns back into a conflict banner.
    mockedUpdate.mockImplementation(() =>
      tracked(Promise.reject(new WorkflowStaleTokenError("T-SERVER-2"))),
    )
    mockedUpdate
      .mockImplementationOnce(() =>
        tracked(Promise.reject(new WorkflowStaleTokenError("T-SERVER"))),
      )
      .mockImplementationOnce(() => tracked(held.promise))

    const h = harness()
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)
    await flush()
    expect(stateOf(h.view).kind).toBe("conflict")
    // Counted as a DELTA: reaching a conflict costs one refused write, and that one is not
    // the subject here.
    const atConflict = mockedUpdate.mock.calls.length

    // The double-click: two presses inside one tick, before React can re-render anything.
    await act(async () => {
      void h.view.result.current.overwrite()
      void h.view.result.current.overwrite()
      await Promise.resolve()
    })
    await advance(0)

    // Before ANYTHING resolves, the surface is saving. In RED the racing second PATCH has
    // already been refused and the banner is back up for a conflict that never happened.
    expect(stateOf(h.view).kind).toBe("saving")

    held.resolve(write("T-NEXT"))
    await flush()

    expect(mockedUpdate.mock.calls.length - atConflict).toBe(1)
    expect(mockedUpdate.mock.calls[atConflict][2]).toBe("T-SERVER")
    expect(stateOf(h.view)).toEqual({ kind: "saved", at: expect.any(Number) })
  })

  it("F19c — a double-click on Reload is ONE read and ONE setDrafted", async () => {
    mockedUpdate.mockImplementationOnce(() =>
      tracked(Promise.reject(new WorkflowStaleTokenError("T-SERVER"))),
    )

    const h = harness()
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)
    await flush()
    expect(stateOf(h.view).kind).toBe("conflict")

    // Counted the way the harness counts `markSaved` — through `setState`, because zustand
    // rebuilds the state object and only a value written INTO it survives.
    const setDrafted = vi.fn()
    const realSetDrafted = h.store.getState().setDrafted
    h.store.setState({
      setDrafted: (d: BuilderDefinition) => {
        setDrafted(d)
        realSetDrafted(d)
      },
    })

    const rows: WorkflowDraftRow[] = [
      {
        id: DRAFT_ID,
        slug: "risk-register",
        version: 1,
        name: "Risk register",
        definition: { ...draft(), phases: [phase("server-side", 0)] },
        token: "T-RELOADED",
      },
    ]
    const listHeld = deferred<WorkflowDraftRow[]>()
    mockedList.mockImplementation(() => Promise.resolve(rows))
    mockedList.mockImplementationOnce(() => listHeld.promise)

    await act(async () => {
      void h.view.result.current.reload()
      void h.view.result.current.reload()
      await Promise.resolve()
    })

    listHeld.resolve(rows)
    await flush()

    expect(mockedList).toHaveBeenCalledTimes(1)
    expect(setDrafted).toHaveBeenCalledTimes(1)
    expect(h.store.getState().phases).toHaveLength(1)
    expect(stateOf(h.view)).toEqual({ kind: "idle" })
  })

  it("F19d — an exit taken while a write is outstanding adopts no token", async () => {
    // Two deferreds, resolved in the order the race would really settle: the write the
    // person authorised lands FIRST, and the racing one the loop should never have issued
    // lands LAST — which is precisely why a late loser can clobber `tokenRef`.
    const authorised = deferred<WorkflowDraftWriteResult>()
    const racing = deferred<WorkflowDraftWriteResult>()
    mockedUpdate.mockImplementation(() => tracked(Promise.resolve(write("T-EXTRA"))))
    mockedUpdate
      .mockImplementationOnce(() =>
        tracked(Promise.reject(new WorkflowStaleTokenError("T-CONFLICT"))),
      )
      .mockImplementationOnce(() => tracked(authorised.promise))
      .mockImplementationOnce(() => tracked(racing.promise))

    const h = harness()
    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)
    await flush()
    expect(stateOf(h.view).kind).toBe("conflict")

    await act(async () => {
      void h.view.result.current.overwrite()
      void h.view.result.current.overwrite()
      await Promise.resolve()
    })

    authorised.resolve(write("T-FRESH"))
    await flush()
    // Harmless in GREEN — the second exit never issued a request, so nothing awaits this.
    racing.resolve(write("T-STALE-RACE"))
    await flush()

    h.edit()
    await advance(AUTOSAVE_DEBOUNCE_MS)
    await flush()

    const last = mockedUpdate.mock.calls[mockedUpdate.mock.calls.length - 1]
    expect(last[2]).toBe("T-FRESH")
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
