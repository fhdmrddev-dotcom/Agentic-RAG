/**
 * Phase 184-09 Task 1 — R11's proof at the SOURCE of the palette.
 *
 * Shape: the co-located hook test with a module-mocked api client
 * (`useOperatorProbe.test.ts`), with 184-06's one deliberate change — the mock SPREADS the
 * real module and overrides exactly one export (the shipped `FailReason.test.tsx:40-48`
 * idiom), so mock completeness is automatic rather than an enumeration somebody has to
 * remember to extend.
 *
 * The load-bearing assertion is "change the mock, change the tools". R11 says the option
 * set comes from `GET /workflows/grounding-bundle` and from no frontend constant, and the
 * honest way to prove that is to move the server's answer and watch the hook's answer move
 * with it — a source grep for tool-name literals would false-positive on any display-LABEL
 * map (`PhaseFormPanel.friendlyToolName`) and force a docblock to omit the real identifiers
 * it is describing, which is the D-ITEM-183-02 trap this phase has now hit repeatedly.
 * The `?raw` fence below is therefore scoped to an ARRAY LITERAL of tool ids, and it
 * carries both a positive control (it finds a planted list) and a negative one (it leaves
 * a label map alone).
 */
import { describe, it, expect, beforeEach, vi } from "vitest"
import { renderHook, waitFor, act } from "@testing-library/react"

import { useGroundingBundle } from "./useGroundingBundle"
// The hook SOURCE via Vite's `?raw` loader — the shipped house idiom for a machine-checkable
// scope fence (`canvasModel.purity.test.ts:14-17`).
import useGroundingBundleSource from "./useGroundingBundle?raw"
import { getGroundingBundle, type GroundingBundle } from "@/lib/api"

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return { ...actual, getGroundingBundle: vi.fn() }
})

const mockedBundle = vi.mocked(getGroundingBundle)

/** A complete bundle by default; every test names only the field it is about. */
function bundleOf(over: Partial<GroundingBundle> = {}): GroundingBundle {
  return {
    tools: [],
    folders: [],
    skills: [],
    template_placeholders: [],
    degraded: [],
    ...over,
  }
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

/** A promise settled from OUTSIDE the executor, so a test can unmount mid-flight. */
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe("useGroundingBundle — the palette's only caller", () => {
  beforeEach(() => {
    mockedBundle.mockReset()
  })

  it("enabled:false issues ZERO calls and stays idle", async () => {
    const { result } = renderHook(() => useGroundingBundle(false))

    await waitFor(() => expect(result.current).toEqual({ kind: "idle" }))
    expect(mockedBundle).not.toHaveBeenCalled()
  })

  it("a 200 naming no failed registry yields ready, carrying the server's EXACT tool array", async () => {
    const tools = ["search_documents", "execute_code", "read_document"]
    mockedBundle.mockResolvedValue(bundleOf({ tools }))

    const { result } = renderHook(() => useGroundingBundle(true))

    await waitFor(() => expect(result.current.kind).toBe("ready"))
    if (result.current.kind !== "ready") throw new Error("unreachable — narrowed above")
    // By IDENTITY, not just by value: the hook hands the array on, it does not rebuild one.
    expect(result.current.tools).toBe(tools)
    expect(result.current.degraded).toEqual([])
    expect(mockedBundle).toHaveBeenCalledTimes(1)
  })

  it("carries the folders and the skills through untouched", async () => {
    const folders = [{ id: "f1", name: "Vendors", parent_id: null }]
    const skills = [{ id: "s1", name: "Risk Scoring Rubric" }]
    mockedBundle.mockResolvedValue(bundleOf({ folders, skills }))

    const { result } = renderHook(() => useGroundingBundle(true))

    await waitFor(() => expect(result.current.kind).toBe("ready"))
    if (result.current.kind !== "ready") throw new Error("unreachable — narrowed above")
    expect(result.current.folders).toBe(folders)
    expect(result.current.skills).toBe(skills)
  })

  it("R11: CHANGE THE MOCK, CHANGE THE TOOLS — the option set is the server's answer", async () => {
    mockedBundle.mockResolvedValue(bundleOf({ tools: ["search_documents", "execute_code"] }))
    const first = renderHook(() => useGroundingBundle(true))
    await waitFor(() => expect(first.result.current.kind).toBe("ready"))
    const before = first.result.current.kind === "ready" ? first.result.current.tools : null
    first.unmount()

    // The ONLY thing that changed between the two mounts is what the server said.
    mockedBundle.mockResolvedValue(bundleOf({ tools: ["list_folders"] }))
    const second = renderHook(() => useGroundingBundle(true))
    await waitFor(() => expect(second.result.current.kind).toBe("ready"))
    const after = second.result.current.kind === "ready" ? second.result.current.tools : null

    expect(before).toEqual(["search_documents", "execute_code"])
    expect(after).toEqual(["list_folders"])
    expect(after).not.toEqual(before)
  })

  it("a 200 that NAMES a failed registry is never ready — it is unavailable/degraded", async () => {
    mockedBundle.mockResolvedValue(bundleOf({ degraded: ["folders"] }))

    const { result } = renderHook(() => useGroundingBundle(true))

    await waitFor(() => expect(result.current.kind).toBe("unavailable"))
    if (result.current.kind !== "unavailable") throw new Error("unreachable — narrowed above")
    expect(result.current.reason).toBe("degraded")
    expect(result.current.degraded).toEqual(["folders"])
  })

  it("a degraded read STILL carries whatever tools came back", async () => {
    mockedBundle.mockResolvedValue(
      bundleOf({ tools: ["search_documents"], degraded: ["skills"] }),
    )

    const { result } = renderHook(() => useGroundingBundle(true))

    await waitFor(() => expect(result.current.kind).toBe("unavailable"))
    if (result.current.kind !== "unavailable") throw new Error("unreachable — narrowed above")
    // "We could not load everything" must not be flattened into "you have nothing".
    expect(result.current.tools).toEqual(["search_documents"])
  })

  it("a rejected call yields unavailable/unreachable with an empty tool set", async () => {
    mockedBundle.mockRejectedValue(new Error("network down"))

    const { result } = renderHook(() => useGroundingBundle(true))

    await waitFor(() => expect(result.current.kind).toBe("unavailable"))
    if (result.current.kind !== "unavailable") throw new Error("unreachable — narrowed above")
    expect(result.current.reason).toBe("unreachable")
    expect(result.current.tools).toEqual([])
  })

  it("a 404 (the flag was flipped mid-session) lands in the SAME unreachable class", async () => {
    // `getGroundingBundle` throws a plain Error on any non-2xx; the client cannot and must
    // not distinguish "gated" from "unbuilt" from "offline".
    mockedBundle.mockRejectedValue(new Error("Failed to load the grounding bundle (status 404)"))

    const { result } = renderHook(() => useGroundingBundle(true))

    await waitFor(() => expect(result.current.kind).toBe("unavailable"))
    if (result.current.kind !== "unavailable") throw new Error("unreachable — narrowed above")
    expect(result.current.reason).toBe("unreachable")
  })

  it("an abort caused by unmount produces no state update and no error", async () => {
    const warn = vi.spyOn(console, "error").mockImplementation(() => {})
    const d = deferred<GroundingBundle>()
    mockedBundle.mockReturnValue(d.promise)

    const { result, unmount } = renderHook(() => useGroundingBundle(true))
    await waitFor(() => expect(result.current.kind).toBe("loading"))

    unmount()
    // The reply lands AFTER the cleanup aborted the controller — the post-await guard
    // drops it silently rather than setting state on an unmounted hook.
    await act(async () => {
      d.resolve(bundleOf({ tools: ["search_documents"] }))
      await d.promise
    })

    expect(result.current.kind).toBe("loading")
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it("issues exactly ONE request while `enabled` stays true across re-renders (no polling)", async () => {
    mockedBundle.mockResolvedValue(bundleOf({ tools: ["search_documents"] }))

    const { result, rerender } = renderHook(({ on }: { on: boolean }) => useGroundingBundle(on), {
      initialProps: { on: true },
    })
    await waitFor(() => expect(result.current.kind).toBe("ready"))

    rerender({ on: true })
    rerender({ on: true })

    expect(mockedBundle).toHaveBeenCalledTimes(1)
  })
})

// ── The source fence (§S2 — the `?raw` house idiom) ───────────────────────────────────

/**
 * Worded as "no ARRAY LITERAL of two or more tool ids", never as a blanket token grep.
 * A blanket grep would forbid this module's own docblock from naming the identifiers it
 * exists to describe, and would flag any display-LABEL map — which is exactly the guard
 * shape that has cost this phase several forced docblock edits.
 */
const HARDCODED_TOOL_ARRAY = /\[\s*["'][a-z][a-z0-9_]*["']\s*,\s*["'][a-z][a-z0-9_]*["']/

describe("useGroundingBundle — the no-frontend-constant fence", () => {
  it("declares no hardcoded tool list of its own", () => {
    expect(useGroundingBundleSource).not.toMatch(HARDCODED_TOOL_ARRAY)
  })

  it("the fence is a REAL control — it FINDS a planted list and LEAVES a label map alone", () => {
    const plantedList = 'const TOOLS = ["search_documents", "execute_code"]'
    expect(HARDCODED_TOOL_ARRAY.test(plantedList)).toBe(true)

    // The negative control: `friendlyToolName`'s shape must survive a fence like this one.
    const plantedLabelMap = 'const LABELS = { search_documents: "Search documents" }'
    expect(HARDCODED_TOOL_ARRAY.test(plantedLabelMap)).toBe(false)
  })
})
