/**
 * Phase 184-06 Task 3 — R7's proofs for the live validation loop.
 *
 * Shape: the co-located hook test with a module-mocked api client
 * (`useOperatorProbe.test.ts`), with ONE deliberate change. That suite replaces the whole
 * module with a hand-written object, which is the shipped mock-completeness failure mode:
 * every symbol the render path reaches has to be re-listed, and one that is forgotten
 * fails far from its cause. This suite spreads the REAL module and overrides exactly one
 * export (the shipped `FailReason.test.tsx:40-48` idiom), so completeness is automatic AND
 * the typed shape-rejection error under test is the REAL class from `lib/api.ts` — a drift
 * between the name that class assigns itself and the name the hook branches on becomes a
 * failing test here rather than a silent mis-classification in front of a user.
 *
 * THE LOAD-BEARING ONE IS THE OUT-OF-ORDER CASE. It is written so it can only pass on the
 * monotonic sequence guard: the superseded call is resolved (never aborted-and-rejected)
 * AFTER the newer one, which is exactly the situation `AbortController` cannot cover — a
 * response already sitting in the network buffer when the abort fires still resolves. The
 * falsification (drop the applied-sequence check, watch this go red) is recorded in the
 * plan SUMMARY.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { act, renderHook } from "@testing-library/react"

import {
  useLiveValidation,
  VALIDATE_DEBOUNCE_MS,
  CHECKING_MIN_VISIBLE_MS,
  type ValidationState,
} from "./useLiveValidation"
import {
  validateWorkflow,
  WorkflowValidateUnreadableError,
  type ValidateResponse,
  type Verdict,
  type WorkflowDefinitionJSON,
} from "@/lib/api"

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return { ...actual, validateWorkflow: vi.fn() }
})

const mockedValidate = vi.mocked(validateWorkflow)

// ── Local infrastructure ──────────────────────────────────────────────────────

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

/** A promise whose settlement is controlled from OUTSIDE the executor, so a test can
 *  choose the order two in-flight replies land in. File-local until a second suite needs it. */
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

/** Flush pending microtasks (a settled deferred) without moving the clock. */
async function flush(): Promise<void> {
  await advance(0)
}

function mount(initial: { def: WorkflowDefinitionJSON | null; enabled: boolean }) {
  return renderHook(({ def, enabled }) => useLiveValidation(def, enabled), {
    initialProps: initial,
  })
}

const DEF_A: WorkflowDefinitionJSON = { slug: "w", phases: [{ slug: "a", phase_index: 0 }] }
const DEF_B: WorkflowDefinitionJSON = {
  slug: "w",
  phases: [
    { slug: "a", phase_index: 0 },
    { slug: "b", phase_index: 1 },
  ],
}
const DEF_C: WorkflowDefinitionJSON = { slug: "w", phases: [{ slug: "c", phase_index: 0 }] }

const OLDER_VERDICT: Verdict = {
  code: "no_terminal",
  phase: null,
  message: "the older answer",
  severity: "incomplete",
}
const NEWER_VERDICT: Verdict = {
  code: "orphan_phase",
  phase: "b",
  message: "the newer answer",
  severity: "error",
}
const OLDER: ValidateResponse = { ok: false, verdicts: [OLDER_VERDICT] }
const NEWER: ValidateResponse = { ok: false, verdicts: [NEWER_VERDICT] }
const CLEAN: ValidateResponse = { ok: true, verdicts: [] }

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

/** Every string reachable from the state, so "the body is not shown" is checked over the
 *  whole reachable graph rather than over the two fields we happened to think of. */
function reachableStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value)
  else if (Array.isArray(value)) for (const v of value) reachableStrings(v, out)
  else if (value && typeof value === "object")
    for (const v of Object.values(value)) reachableStrings(v, out)
  return out
}

function verdictsOf(state: ValidationState): Verdict[] {
  return state.kind === "verdicts" || state.kind === "degraded" ? state.verdicts : []
}

let warnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  mockedValidate.mockReset()
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  warnSpy.mockRestore()
  vi.useRealTimers()
})

// ── 1. The load-bearing one: out-of-order replies ─────────────────────────────

describe("useLiveValidation — last-write-wins when replies land out of order (D-184-13)", () => {
  it("renders the NEWER verdict when the newer reply resolves FIRST and the older LAST", async () => {
    const first = deferred<ValidateResponse>()
    const second = deferred<ValidateResponse>()
    mockedValidate.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const { result, rerender } = mount({ def: DEF_A, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS) // request seq 1 issued
    rerender({ def: DEF_B, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS) // request seq 2 issued
    expect(mockedValidate).toHaveBeenCalledTimes(2)

    // The NEWER reply lands first…
    second.resolve(NEWER)
    await flush()
    expect(verdictsOf(result.current)).toEqual([NEWER_VERDICT])

    // …and the superseded one lands AFTER it. It is RESOLVED, not rejected: this is
    // precisely the case abort cannot cover, so only the sequence guard can drop it.
    first.resolve(OLDER)
    await flush()

    expect(result.current.kind).toBe("verdicts")
    expect(verdictsOf(result.current)).toEqual([NEWER_VERDICT])
    expect(verdictsOf(result.current)).not.toContainEqual(OLDER_VERDICT)
  })

  it("still applies the newer reply when the two land in the expected order", async () => {
    const first = deferred<ValidateResponse>()
    const second = deferred<ValidateResponse>()
    mockedValidate.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const { result, rerender } = mount({ def: DEF_A, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS)
    rerender({ def: DEF_B, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS)

    first.resolve(OLDER)
    await flush()
    second.resolve(NEWER)
    await flush()

    expect(verdictsOf(result.current)).toEqual([NEWER_VERDICT])
  })

  it("hands the call an AbortSignal, so the belt half is actually wired", async () => {
    mockedValidate.mockResolvedValue(CLEAN)
    mount({ def: DEF_A, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS)

    expect(mockedValidate).toHaveBeenCalledTimes(1)
    expect(mockedValidate.mock.calls[0]?.[0]).toBe(DEF_A)
    expect(mockedValidate.mock.calls[0]?.[1]).toBeInstanceOf(AbortSignal)
  })
})

// ── 2. The debounce ───────────────────────────────────────────────────────────

describe("useLiveValidation — one 500 ms debounce over every definition change", () => {
  it("issues exactly ONE call for three definitions inside the window", async () => {
    mockedValidate.mockResolvedValue(CLEAN)

    const { rerender } = mount({ def: DEF_A, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS - 200)
    rerender({ def: DEF_B, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS - 200)
    rerender({ def: DEF_C, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS - 200)

    // An edit inside the window issues ZERO requests, not a cancelled one.
    expect(mockedValidate).not.toHaveBeenCalled()

    await advance(VALIDATE_DEBOUNCE_MS)
    expect(mockedValidate).toHaveBeenCalledTimes(1)
    // …and the one call carries the LAST definition, never an intermediate one.
    expect(mockedValidate.mock.calls[0]?.[0]).toBe(DEF_C)
  })

  it("issues nothing more after unmount — every timer is cleaned up", async () => {
    mockedValidate.mockResolvedValue(CLEAN)
    const { unmount } = mount({ def: DEF_A, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS - 100)
    unmount()
    await advance(VALIDATE_DEBOUNCE_MS * 4)
    expect(mockedValidate).not.toHaveBeenCalled()
  })
})

// ── 3. D-184-15 — nothing fires before the first edit ─────────────────────────

describe("useLiveValidation — no call before the first edit (D-184-15)", () => {
  it("issues nothing and stays idle while disabled, however long the clock runs", async () => {
    mockedValidate.mockResolvedValue(CLEAN)
    const { result } = mount({ def: DEF_A, enabled: false })

    await advance(VALIDATE_DEBOUNCE_MS * 10)

    expect(mockedValidate).not.toHaveBeenCalled()
    expect(result.current).toEqual({ kind: "idle" })
  })

  it("issues nothing and stays idle while there is no definition", async () => {
    mockedValidate.mockResolvedValue(CLEAN)
    const { result } = mount({ def: null, enabled: true })

    await advance(VALIDATE_DEBOUNCE_MS * 10)

    expect(mockedValidate).not.toHaveBeenCalled()
    expect(result.current).toEqual({ kind: "idle" })
  })

  it("takes over the moment the first edit enables it", async () => {
    mockedValidate.mockResolvedValue(NEWER)
    const { result, rerender } = mount({ def: DEF_A, enabled: false })
    await advance(VALIDATE_DEBOUNCE_MS * 2)
    expect(mockedValidate).not.toHaveBeenCalled()

    rerender({ def: DEF_B, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS)
    await flush()

    expect(mockedValidate).toHaveBeenCalledTimes(1)
    expect(verdictsOf(result.current)).toEqual([NEWER_VERDICT])
  })
})

// ── 4. A failed check is fail-closed, and holds the previous answer ───────────

describe("useLiveValidation — a check that did not run never reads clean (D-184-14)", () => {
  it("degrades on a rejected call, keeps the previous verdicts, and exposes no ok", async () => {
    mockedValidate.mockResolvedValueOnce(NEWER)
    const { result, rerender } = mount({ def: DEF_A, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS)
    await flush()
    expect(result.current.kind).toBe("verdicts")

    mockedValidate.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    rerender({ def: DEF_B, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS)
    await flush()

    expect(result.current.kind).toBe("degraded")
    expect(result.current).toMatchObject({ cause: "unreachable" })
    // Held stale, not cleared — clearing makes every mark flicker on every keystroke.
    expect(verdictsOf(result.current)).toEqual([NEWER_VERDICT])
    // There is no path from a failed check to a clean reading: `ok` is not merely false,
    // it is absent from the shape, so "degraded but clean" cannot be constructed at all.
    expect("ok" in result.current).toBe(false)
  })

  it("degrades the very first check with nothing to hold", async () => {
    mockedValidate.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    const { result } = mount({ def: DEF_A, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS)
    await flush()

    expect(result.current).toMatchObject({ kind: "degraded", cause: "unreachable" })
    expect(verdictsOf(result.current)).toEqual([])
  })
})

// ── 5. The two causes differ; the rejected body never travels ────────────────

describe("useLiveValidation — the shape rejection and the unreachable check are told apart", () => {
  it("classifies a shape rejection as unreadable and a network failure as unreachable", async () => {
    mockedValidate.mockRejectedValueOnce(new WorkflowValidateUnreadableError(RAW_422_BODY))
    const { result, rerender } = mount({ def: DEF_A, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS)
    await flush()

    const shapeCause = result.current.kind === "degraded" ? result.current.cause : null
    expect(result.current.kind).toBe("degraded")
    expect(shapeCause).toBe("unreadable")

    mockedValidate.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    rerender({ def: DEF_B, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS)
    await flush()

    const networkCause = result.current.kind === "degraded" ? result.current.cause : null
    expect(result.current.kind).toBe("degraded")
    expect(networkCause).toBe("unreachable")

    // Same fail-closed behaviour, DIFFERENT cause — so the caller can word them apart and
    // a reproducible shape rejection is never dressed up as "try again".
    expect(shapeCause).not.toBe(networkCause)
  })

  it("logs the rejected body at the api boundary and lets none of it reach the state", async () => {
    mockedValidate.mockRejectedValueOnce(new WorkflowValidateUnreadableError(RAW_422_BODY))
    const { result } = mount({ def: DEF_A, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS)
    await flush()

    // Logged: once, at the boundary that received it, with the body itself.
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy.mock.calls[0]?.[1]).toBe(RAW_422_BODY)

    // Not shown: no string anywhere in the reachable state carries the internals.
    const strings = reachableStrings(result.current)
    expect(strings.length).toBeGreaterThan(0)
    for (const s of strings) {
      expect(s).not.toContain("PYDANTIC-INTERNAL-MARKER-DO-NOT-RENDER")
      expect(s).not.toContain("extra_forbidden")
      expect(s).not.toContain("grounding_zzz")
    }
  })

  it("the reachable-string walk is a real control — it FINDS a planted internal", () => {
    const planted = { kind: "degraded", verdicts: [{ message: "extra_forbidden" }] }
    expect(reachableStrings(planted)).toContain("extra_forbidden")
  })
})

// ── 6/7. The client classifies nothing ───────────────────────────────────────

describe("useLiveValidation — every verdict is rendered as the server sent it (VALID-03)", () => {
  it("treats the degraded-grounding verdict as a verdict, never as a success or an idle", async () => {
    const unavailable: Verdict = {
      code: "grounding_unavailable",
      phase: null,
      message: "the grounding registries could not be read",
      severity: "error",
    }
    mockedValidate.mockResolvedValueOnce({ ok: false, verdicts: [unavailable] })

    const { result } = mount({ def: DEF_A, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS)
    await flush()

    expect(result.current.kind).toBe("verdicts")
    expect(result.current).toMatchObject({ ok: false })
    expect(verdictsOf(result.current)).toEqual([unavailable])
  })

  it("passes an unrecognised code through verbatim — nothing dropped, nothing reclassified", async () => {
    const future: Verdict = {
      code: "some_future_code",
      phase: "a",
      message: "a rule this client has never heard of",
      severity: "error",
    }
    const known: Verdict = {
      code: "bad_index",
      phase: "a",
      message: "the indexes are not contiguous",
      severity: "incomplete",
    }
    mockedValidate.mockResolvedValueOnce({ ok: false, verdicts: [future, known] })

    const { result } = mount({ def: DEF_A, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS)
    await flush()

    // Same objects, same order, both severities untouched.
    expect(verdictsOf(result.current)).toEqual([future, known])
    expect(verdictsOf(result.current)[0]?.code).toBe("some_future_code")
    expect(verdictsOf(result.current)[0]?.severity).toBe(future.severity)
    expect(verdictsOf(result.current)[1]?.severity).toBe(known.severity)
  })
})

// ── 8. An abort caused by a newer edit is silent ─────────────────────────────

describe("useLiveValidation — a superseded call is dropped silently, never degraded", () => {
  it("does not degrade when the superseded call rejects with an abort", async () => {
    const first = deferred<ValidateResponse>()
    const second = deferred<ValidateResponse>()
    mockedValidate.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const { result, rerender } = mount({ def: DEF_A, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS)
    rerender({ def: DEF_B, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS)

    const aborted = new Error("The operation was aborted.")
    aborted.name = "AbortError"
    first.reject(aborted)
    await flush()

    expect(result.current.kind).not.toBe("degraded")

    second.resolve(NEWER)
    await flush()
    expect(verdictsOf(result.current)).toEqual([NEWER_VERDICT])
  })

  it("also drops an abort-shaped rejection that is not an Error instance", async () => {
    mockedValidate.mockRejectedValueOnce({ name: "AbortError", message: "aborted" })
    const { result } = mount({ def: DEF_A, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS)
    await flush()

    expect(result.current.kind).not.toBe("degraded")
  })
})

// ── 9. The checking beat cannot strobe ───────────────────────────────────────

describe("useLiveValidation — the checking beat has a minimum visible duration", () => {
  it("keeps checking true for a reply that lands well inside the minimum", async () => {
    const first = deferred<ValidateResponse>()
    mockedValidate.mockReturnValueOnce(first.promise)

    const { result } = mount({ def: DEF_A, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS)
    // The first-ever check has no previous answer to hold, and claims nothing.
    expect(result.current).toEqual({ kind: "checking" })

    first.resolve(NEWER)
    await flush()
    expect(result.current).toMatchObject({ kind: "verdicts", checking: true })

    await advance(CHECKING_MIN_VISIBLE_MS)
    expect(result.current).toMatchObject({ kind: "verdicts", checking: false })
  })

  it("holds the previous verdicts, dimmed, while the next check is in flight", async () => {
    mockedValidate.mockResolvedValueOnce(NEWER)
    const { result, rerender } = mount({ def: DEF_A, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS)
    await flush()
    await advance(CHECKING_MIN_VISIBLE_MS)
    expect(result.current).toMatchObject({ kind: "verdicts", checking: false })

    const next = deferred<ValidateResponse>()
    mockedValidate.mockReturnValueOnce(next.promise)
    rerender({ def: DEF_B, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS)

    expect(result.current).toMatchObject({ kind: "verdicts", checking: true })
    expect(verdictsOf(result.current)).toEqual([NEWER_VERDICT])

    next.resolve(CLEAN)
    await flush()
    await advance(CHECKING_MIN_VISIBLE_MS)
    expect(result.current).toMatchObject({ kind: "verdicts", ok: true, checking: false })
    expect(verdictsOf(result.current)).toEqual([])
  })

  it("keeps checking true past a degraded reply too, then releases it", async () => {
    mockedValidate.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    const { result } = mount({ def: DEF_A, enabled: true })
    await advance(VALIDATE_DEBOUNCE_MS)
    await flush()

    expect(result.current).toMatchObject({ kind: "degraded", checking: true })
    await advance(CHECKING_MIN_VISIBLE_MS)
    expect(result.current).toMatchObject({ kind: "degraded", checking: false })
  })
})
