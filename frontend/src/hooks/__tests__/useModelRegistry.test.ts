/**
 * Phase 196 Plan 05 Task 3 (AUTH-04 / D-06) — the ONE registry fetch, and its honesty.
 *
 * Shape: the co-located hook test with a module-stubbed api client
 * (`useGroundingBundle.test.ts`), whose stub SPREADS the real module and overrides exactly
 * one export — so completeness is automatic rather than an enumeration somebody has to
 * remember to extend.
 *
 * ⚠ THE LOAD-BEARING CASE IS THE THIRD ONE, AND IT IS THE ONLY ONE THAT CANNOT BE WRITTEN
 * AS A SHAPE ASSERTION. A failed read must resolve to a DISTINCT member and not to an
 * empty success, because an empty `models` array from a failed fetch is indistinguishable
 * from a genuinely empty registry — and the picker consuming it would then render a
 * perfectly calm control offering nothing but its inherit option. That failure LOOKS like
 * a correct render, which is exactly why it needs a test rather than a reviewer.
 *
 * ⚠ THE COMPONENT'S SUITE STUBS NOTHING, ON PURPOSE, AND THIS ONE STUBS. That asymmetry is
 * the architecture, made visible: `ModelField` takes rows as a prop and therefore cannot
 * fetch; this hook is the one place that can.
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"

import { getAuthorModelRegistry, type AuthorModelRow } from "@/lib/api"

import { useModelRegistry } from "../useModelRegistry"

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return { ...actual, getAuthorModelRegistry: vi.fn() }
})

const mockedRegistry = vi.mocked(getAuthorModelRegistry)

function row(over: Partial<AuthorModelRow> & { model_id: string }): AuthorModelRow {
  return {
    provider: "openai",
    capability_source: "registry",
    enabled: true,
    deprecated: false,
    emit_tier: null,
    ...over,
  }
}

const ROWS: AuthorModelRow[] = [
  row({ model_id: "gpt-5.5", capability_source: "code", emit_tier: "force_strict" }),
  row({ model_id: "kimi-k2.6", provider: "moonshot", emit_tier: "coerce" }),
  row({ model_id: "gpt-5.2", enabled: false, emit_tier: "force_strict" }),
]

/** The id the server RESOLVED. Not a house model: the three real candidates measured on
 *  this tree disagree with each other, which is the argument for computing it server-side
 *  in the first place. What is asserted is that whatever the server said comes through. */
const RESOLVED_DEFAULT = "deepseek-v4-flash"

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

/** A promise settled from OUTSIDE the executor, so a test can observe the in-flight state. */
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

beforeEach(() => {
  mockedRegistry.mockReset()
})

describe("useModelRegistry — the successful read", () => {
  it("exposes the server's rows and its resolved run default", async () => {
    mockedRegistry.mockResolvedValue({ models: ROWS, run_default_model: RESOLVED_DEFAULT })

    const { result } = renderHook(() => useModelRegistry())

    await waitFor(() => expect(result.current.kind).toBe("ready"))
    if (result.current.kind !== "ready") throw new Error("unreachable — narrowed above")
    // By IDENTITY, not merely by value: the hook hands the array on, it does not rebuild
    // one — the same rule `useGroundingBundle` keeps for its tool list.
    expect(result.current.models).toBe(ROWS)
    expect(result.current.runDefaultModel).toBe(RESOLVED_DEFAULT)
  })

  it("CHANGE THE STUB, CHANGE THE ROWS — the hook declares no registry of its own", async () => {
    mockedRegistry.mockResolvedValue({ models: ROWS, run_default_model: RESOLVED_DEFAULT })
    const first = renderHook(() => useModelRegistry())
    await waitFor(() => expect(first.result.current.kind).toBe("ready"))
    const before = first.result.current.kind === "ready" ? first.result.current.models : null
    first.unmount()

    // The ONLY thing that changed between the two mounts is what the server said.
    const grown = [...ROWS, row({ model_id: "glm-4.7-flash", provider: "zhipu" })]
    mockedRegistry.mockResolvedValue({ models: grown, run_default_model: null })
    const second = renderHook(() => useModelRegistry())
    await waitFor(() => expect(second.result.current.kind).toBe("ready"))
    const after = second.result.current.kind === "ready" ? second.result.current.models : null

    expect(before).toHaveLength(3)
    expect(after).toHaveLength(4)
    expect(after).not.toEqual(before)
  })

  it("carries a NULL run default through as null — an honest absence, never a guess", async () => {
    // The server fails SOFT here: when its own resolution chain produces nothing it returns
    // null rather than 500ing, and the picker degrades its label instead of vanishing.
    mockedRegistry.mockResolvedValue({ models: ROWS, run_default_model: null })

    const { result } = renderHook(() => useModelRegistry())

    await waitFor(() => expect(result.current.kind).toBe("ready"))
    if (result.current.kind !== "ready") throw new Error("unreachable — narrowed above")
    expect(result.current.runDefaultModel).toBeNull()
    // …and the rows still came through: a missing default is not a missing registry.
    expect(result.current.models).toHaveLength(3)
  })
})

describe("useModelRegistry — ⚠ a FAILED read is not an empty success", () => {
  it("a rejected call resolves to the DISTINCT unavailable reading", async () => {
    mockedRegistry.mockRejectedValue(new Error("network down"))

    const { result } = renderHook(() => useModelRegistry())

    await waitFor(() => expect(result.current.kind).toBe("unavailable"))
    // The claim, stated as the thing it must NOT be: not a ready state at all, and
    // therefore not one carrying an empty list either.
    expect(result.current.kind).not.toBe("ready")
    expect(result.current).not.toHaveProperty("models")
  })

  it("a 401/404/500 all land in the SAME class — a client cannot tell them apart", async () => {
    // `getAuthorModelRegistry` throws on any non-2xx and the client neither can nor should
    // distinguish "not signed in" from "gated" from "offline": all three mean no answer.
    for (const message of ["status 401", "status 404", "status 500"]) {
      mockedRegistry.mockReset()
      mockedRegistry.mockRejectedValue(new Error(message))
      const { result, unmount } = renderHook(() => useModelRegistry())
      await waitFor(() => expect(result.current.kind).toBe("unavailable"))
      unmount()
    }
  })

  it("POSITIVE CONTROL — a GENUINELY EMPTY registry reads as READY, not as unavailable", async () => {
    // This is what makes the case above a measurement rather than a tautology. An empty
    // registry and a failed read are different facts, and the whole point of the distinct
    // member is that they render differently. Without this control, a hook that reported
    // `unavailable` for everything would pass every assertion above.
    mockedRegistry.mockResolvedValue({ models: [], run_default_model: null })

    const { result } = renderHook(() => useModelRegistry())

    await waitFor(() => expect(result.current.kind).toBe("ready"))
    if (result.current.kind !== "ready") throw new Error("unreachable — narrowed above")
    expect(result.current.models).toEqual([])
  })
})

describe("useModelRegistry — in flight is distinguishable from finished", () => {
  it("an outstanding read reads as loading, and an EMPTY completed one does not", async () => {
    const d = deferred<{ models: AuthorModelRow[]; run_default_model: string | null }>()
    mockedRegistry.mockReturnValue(d.promise)

    const { result } = renderHook(() => useModelRegistry())

    // Before the answer lands: waiting.
    expect(result.current.kind).toBe("loading")
    expect(result.current).not.toHaveProperty("models")

    await act(async () => {
      d.resolve({ models: [], run_default_model: null })
      await d.promise
    })

    // After it lands, with nothing in it: a DIFFERENT reading from the one above, even
    // though both carry no usable rows.
    await waitFor(() => expect(result.current.kind).toBe("ready"))
    expect(result.current.kind).not.toBe("loading")
  })

  it("the first reading is loading, before anything is awaited", () => {
    mockedRegistry.mockReturnValue(deferred<never>().promise)
    const { result } = renderHook(() => useModelRegistry())
    expect(result.current).toEqual({ kind: "loading" })
  })
})

describe("useModelRegistry — exactly ONE request per mount", () => {
  it("calls the client once, and re-renders do not re-issue it", async () => {
    mockedRegistry.mockResolvedValue({ models: ROWS, run_default_model: RESOLVED_DEFAULT })

    const { result, rerender } = renderHook(() => useModelRegistry())
    await waitFor(() => expect(result.current.kind).toBe("ready"))

    rerender()
    rerender()

    // ⚠ THE REASON THIS HOOK EXISTS. The picker mounts FOUR times inside one panel; the
    // read is a panel-level concern precisely so it happens once rather than four times.
    expect(mockedRegistry).toHaveBeenCalledTimes(1)
  })

  it("…and takes no arguments — there is no effect key that could change", async () => {
    mockedRegistry.mockResolvedValue({ models: ROWS, run_default_model: null })
    const { result } = renderHook(() => useModelRegistry())
    await waitFor(() => expect(result.current.kind).toBe("ready"))
    expect(mockedRegistry).toHaveBeenCalledWith()
  })

  it("an answer landing AFTER unmount produces no state update and no error", async () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {})
    const d = deferred<{ models: AuthorModelRow[]; run_default_model: string | null }>()
    mockedRegistry.mockReturnValue(d.promise)

    const { result, unmount } = renderHook(() => useModelRegistry())
    expect(result.current.kind).toBe("loading")

    unmount()
    await act(async () => {
      d.resolve({ models: ROWS, run_default_model: RESOLVED_DEFAULT })
      await d.promise
    })

    expect(result.current.kind).toBe("loading")
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
