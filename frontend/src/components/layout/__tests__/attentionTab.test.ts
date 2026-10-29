/**
 * Phase 244 plan 04 Task 1 (SHELL-05 · BUG-260911-03 · C-5) —
 * THE CONDITION LEARNS ITS TAB, AND NOTHING ELSE MOVES.
 *
 * ── ⭐ THE QUESTION BUG-260911-03 ASKED, ANSWERED FROM SOURCE ─────────────────────────
 *
 * The report said: *"the likely shape is that `attentionConditions` already knows what KIND
 * each condition is … **verify that before building anything** — this report asserts the
 * symptom, not the cause."* **Verified, and it does NOT.** `AttentionCondition` shipped four
 * fields (`id` / `title` / `detail` / `onOpen`) and carries no kind at all. The kind lives one
 * level up, on `AttentionProducer.key`, and on `StoppedSource.cause` — which
 * `useStoppedSourceConditions` **consumes and discards** into the `detail` sentence.
 *
 * So the cheapest honest route is one OPTIONAL field on the condition, set by the producer
 * that already exists. This suite is what makes that change safe rather than merely small:
 * every constraint the change could have broken is asserted HERE, in this plan's own file,
 * so it travels with the edit instead of living only in a neighbour's suite.
 *
 * ── ⛔ WHAT THIS FILE FENCES ──────────────────────────────────────────────────────────
 *
 *  1. The producer sets `tab: "health"` on every condition it emits. (RED before the edit.)
 *  2. The field is OPTIONAL — a future producer with no Library home must not be forced to
 *     lie, and a condition without it still renders.
 *  3. `ATTENTION_PRODUCERS.length === 1` and its key is `stopped-sources` — D-235-03.
 *     `NavPanel.badge.test.tsx` asserts this too; it is re-asserted here deliberately, because
 *     the change under test is *in the registry file* and a constraint that lives only in a
 *     neighbour's suite is a constraint the next author edits without reading.
 *  4. `detail` is BYTE-IDENTICAL to the shipped sentences, asserted against the RENDERED text
 *     for every member of `SourceFailureCause`. ⚠ A key check would pass over a `detail` that
 *     had quietly become a raw `cause` string — a presence assertion cannot see content drift.
 *  5. The `?raw` reader inventory is UNMOVED. ⛔ Arm 1 of `attentionConditions.ts`'s own
 *     three-part re-open trigger is *a third concurrent reader*; the tab attribution is
 *     threaded as DATA precisely so that arm stays unfired by this plan.
 *
 * ⚠ **A MEASURED CORRECTION TO THIS PLAN'S OWN BRIEF.** `244-04-PLAN.md` Task 1 Test 5 asks
 * for *"exactly TWO `useSourceAttention()` call sites in `src/`"*. Measured at this base,
 * there are **THREE** — `attentionConditions.ts`, `library/IngestionTab.tsx` and
 * `library/SourcesAttentionSection.tsx` — which is exactly what the shipped fence in
 * `ChatLayout.badge.test.tsx` pins. **TWO is the count of CONCURRENT readers** (the shell,
 * plus whichever Library tab body is mounted — the last two are mutually exclusive by tab and
 * `tabs.tsx` has no `forceMount`). The plan conflated call sites with concurrent readers; the
 * fence below asserts the measured set of three and says why, rather than pinning a number
 * that would have been red on an untouched tree.
 *
 * ── THE FILE IS `.ts`, NOT `.tsx` ────────────────────────────────────────────────────
 *
 * Deliberate, and it is the plan's own filename. The two cases that need a tree build it with
 * `createElement`, which costs two lines and keeps the suite next to the module it guards.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { createElement } from "react"
import { render, renderHook, screen, cleanup } from "@testing-library/react"

import {
  SENTENCE_FOR_CAUSE,
  type SourceFailureCause,
} from "@/components/sources/sourceHealthVocabulary"
import type { StoppedSource } from "@/lib/api/sources"

// ⛔ `@/lib/api/sources` IS NOT IN THE `@/lib/api` BARREL (235-RESEARCH P-10), so a
// `vi.mock("@/lib/api", …)` never intercepts it. `useSourceAttention` polls through this
// module; the factory below is what keeps the hook's own network out of this suite.
const stoppedFixture: StoppedSource[] = [
  {
    watch_id: "watch-1",
    source_folder_name: "Q4 rate sheets",
    connection_name: "Ops Drive",
    cause: "folder_gone",
    hard: true,
    stopped_since: "2026-09-10T09:00:00Z",
    last_good_at: "2026-09-09T09:00:00Z",
  },
  {
    watch_id: "watch-2",
    source_folder_name: "Contracts",
    connection_name: "Ops Drive",
    cause: "token_revoked",
    hard: true,
    stopped_since: "2026-09-10T10:00:00Z",
    last_good_at: null,
  },
]

vi.mock("@/lib/api/sources", () => ({
  getSourceHealth: vi.fn().mockResolvedValue({
    stopped: [
      {
        watch_id: "watch-1",
        source_folder_name: "Q4 rate sheets",
        connection_name: "Ops Drive",
        cause: "folder_gone",
        hard: true,
        stopped_since: "2026-09-10T09:00:00Z",
        last_good_at: "2026-09-09T09:00:00Z",
      },
      {
        watch_id: "watch-2",
        source_folder_name: "Contracts",
        connection_name: "Ops Drive",
        cause: "token_revoked",
        hard: true,
        stopped_since: "2026-09-10T10:00:00Z",
        last_good_at: null,
      },
    ],
    reader_running: true,
    poll_interval_seconds: 60,
  }),
  listSyncRuns: vi.fn().mockResolvedValue([]),
}))

// Phase 301-02 (D-11 / D-14) — the SECOND tenant reads `useWaitingNotices()`. It is mocked by its
// own path so each case can hand the producer an exact hook state, and so this suite never opens
// a Realtime channel or fetches. `waitingState.current` is what the hook returns on every render.
const waitingState = vi.hoisted(() => ({
  current: {
    notices: [] as WaitingNotice[],
    total: 0,
    loading: false,
    verdictKnown: true,
    failedSinceLast: false,
    refresh: () => {},
  },
}))
vi.mock("@/hooks/useWaitingNotices", () => ({
  useWaitingNotices: () => waitingState.current,
}))

import {
  ATTENTION_PRODUCERS,
  conditionsForMark,
  useStoppedSourceConditions,
  useWaitingRunConditions,
  waitingTotal,
  attentionCountByTab,
  type AttentionCondition,
  type AttentionContext,
} from "../attentionConditions"
import { AttentionPopover } from "../AttentionPopover"
import type { WaitingNotice } from "@/lib/api/notifications"

/** Phase 301-02 (D-13): producers take ONE context object, never a bare callback. */
function ctx(over: Partial<AttentionContext> = {}): AttentionContext {
  return { openLibraryHealth: vi.fn(), openRun: vi.fn(), ...over }
}

const TWO_WAITING: WaitingNotice[] = [
  {
    id: "n-1",
    run_id: "run-1",
    org_id: "org-a",
    org_name: "Acme",
    workflow_name: "Quarterly review",
    kind: "question",
    origin: "app",
    created_at: "2026-10-30T09:00:00Z",
  },
  {
    id: "n-2",
    run_id: "run-2",
    org_id: "org-b",
    org_name: "Beta",
    workflow_name: "Contract approval",
    kind: "approval",
    origin: "schedule",
    created_at: "2026-10-30T08:00:00Z",
  },
]

function setWaiting(over: Partial<typeof waitingState.current> = {}) {
  waitingState.current = {
    notices: TWO_WAITING,
    total: 7,
    loading: false,
    verdictKnown: true,
    failedSinceLast: false,
    refresh: () => {},
    ...over,
  }
}

afterEach(() => {
  cleanup()
  setWaiting({ notices: [], total: 0 })
})

// ══ NON-VACUITY FIRST ═════════════════════════════════════════════════════════════════
//
// Every case below reads conditions off the producer. A producer that emitted an empty array
// would make all of them vacuously green, so the control asks for the conditions themselves
// before any assertion about their shape runs.
describe("attention tab attribution — the harness", () => {
  it("the mocked verdict really reaches the producer — two conditions, named", async () => {
    const { result } = renderHook(() => useStoppedSourceConditions(ctx()))
    await vi.waitFor(() => expect(result.current.length).toBe(2))
    expect(result.current.map((c) => c.title)).toEqual(["Q4 rate sheets", "Contracts"])
  })
})

// ══ 1 · THE NEW FIELD ═════════════════════════════════════════════════════════════════
describe("attention tab attribution — the producer names the tab that owns the condition", () => {
  it("⛔ RED BEFORE THE EDIT: every stopped-source condition carries tab === 'health'", async () => {
    // The operator's complaint, in one assertion: *"the badge creates a question it then
    // refuses to answer"*. A stopped watched source is owned by the Library's Health tab —
    // and the producer is the only thing in this graph that has ever known that.
    const { result } = renderHook(() => useStoppedSourceConditions(ctx()))
    await vi.waitFor(() => expect(result.current.length).toBe(2))
    for (const condition of result.current) {
      // 301-02 (D-31): narrowed on the required mark — a wrong mark fails here too.
      expect(condition.mark === "library" && condition.tab).toBe("health")
    }
  })

  it("the tab is set from the producer's own kind, never from a client heuristic (D-235-05)", async () => {
    // ⛔ T-244-04-01. Both fixtures have DIFFERENT causes and both land on the same tab,
    // because the tab follows the PRODUCER, not the cause. A client that read the cause to
    // decide a destination would be a second decider — the thing D-235-05 exists to forbid.
    const { result } = renderHook(() => useStoppedSourceConditions(ctx()))
    await vi.waitFor(() => expect(result.current.length).toBe(2))
    expect(new Set(result.current.map((c) => c.mark === "library" && c.tab))).toEqual(new Set(["health"]))
    expect(new Set(stoppedFixture.map((s) => s.cause)).size).toBe(2)
  })
})

// ══ 2 · THE FIELD IS OPTIONAL ═════════════════════════════════════════════════════════
describe("attention tab attribution — a future producer is not forced to lie", () => {
  it("a condition with NO tab is a valid AttentionCondition and still renders", () => {
    // ⚠ Typed, not cast. If `tab` were required this object would not compile, and the
    // typecheck is where that failure would surface — which is the point of the annotation.
    //
    // ⚠ CORRECTED at Phase 301-02 (D-11 / D-31): this fixture used to be the "homeless" waiting
    // approval, named for SEED-231. That tenant now exists — it is `waiting-runs`, its register id
    // is SEED-281, and it carries its OWN mark (`"waiting"`) rather than a missing tab. What this
    // case still guards is the original property: a LIBRARY condition may have no tab and still
    // renders. So the fixture is now a tab-less library condition, with words that say so.
    const homeless: AttentionCondition = {
      mark: "library",
      id: "library-no-tab-1",
      title: "A Library condition with no tab",
      detail: "It belongs to the Library but to none of its tabs (the SEED-281 tenant has its own mark).",
      onOpen: vi.fn(),
    }
    render(
      createElement(AttentionPopover, {
        conditions: [homeless],
        onOpenLibraryHealth: vi.fn(),
      }),
    )
    // The popover renders its rows behind a Radix trigger; the trigger is the reachable proof
    // that a tab-less condition produced a real surface rather than a crash.
    expect(screen.getByTestId("rail-attention-trigger")).toBeInTheDocument()
  })
})

// ══ 3 · THE REGISTRY STILL HAS EXACTLY ONE TENANT ═════════════════════════════════════
describe("attention tab attribution — no second producer was smuggled in", () => {
  it("⛔ ATTENTION_PRODUCERS.length === 2 and its keys are 'stopped-sources', 'waiting-runs' (D-11)", () => {
    // Re-asserted in THIS plan's own suite on purpose. `SEED-231` (nobody is told an approval
    // is waiting) is topical for this phase and was deliberately NOT taken: the registry's
    // seam stays its intended future tenant, re-openable by a deliberate override with the
    // count argued — never as a fill-in while a neighbouring field was being added.
    //
    // ⚠ RE-BASELINED 1 → 2 at Phase 301-02 (D-11) — the original read `toBe(1)` and key [0] only.
    // This IS the deliberate override the paragraph above demanded: Phase 301 argued the count
    // against D-235-03 in its CONTEXT, and the tenant is SEED-281 (SEED-231 above is superseded).
    // The number is edited, never deleted, and BOTH keys are asserted, so a third tenant still has
    // to come here and argue.
    expect(ATTENTION_PRODUCERS.length).toBe(2)
    expect(ATTENTION_PRODUCERS.map((p) => p.key)).toEqual(["stopped-sources", "waiting-runs"])
  })
})

// ══ 3b · PHASE 301-02 — THE SECOND TENANT, THE MARK AND THE CONTEXT OBJECT ═══════════
describe("301-02 — the stopped-sources tenant under the context object (D-13, D-31)", () => {
  it("carries mark 'library' and tab 'health'; onOpen opens Library health, never a run", async () => {
    const c = ctx()
    const { result } = renderHook(() => useStoppedSourceConditions(c))
    await vi.waitFor(() => expect(result.current.length).toBe(2))
    for (const condition of result.current) {
      expect(condition.mark).toBe("library")
      if (condition.mark === "library") expect(condition.tab).toBe("health")
    }
    result.current[0].onOpen()
    expect(c.openLibraryHealth).toHaveBeenCalledTimes(1)
    expect(c.openRun).not.toHaveBeenCalled()
  })
})

describe("301-02 — the waiting-runs tenant (D-11, D-14, D-31)", () => {
  it("maps each notice to a waiting condition with no tab, and the server total on every row", () => {
    setWaiting()
    const { result } = renderHook(() => useWaitingRunConditions(ctx()))
    expect(result.current).toHaveLength(2)
    const [first, second] = result.current
    expect(first).toMatchObject({
      mark: "waiting",
      id: "n-1",
      runId: "run-1",
      orgId: "org-a",
      orgName: "Acme",
      since: "2026-10-30T09:00:00Z",
      kind: "question",
      origin: "app",
      total: 7,
      title: "Quarterly review",
      detail: "",
    })
    expect(second).toMatchObject({ mark: "waiting", id: "n-2", runId: "run-2", kind: "approval", total: 7 })
    // ⛔ A waiting run has no Library home, so it carries no tab KEY at all (D-12).
    for (const condition of result.current) expect("tab" in condition).toBe(false)
  })

  it("onOpen opens the run, never Library health", () => {
    setWaiting()
    const c = ctx()
    const { result } = renderHook(() => useWaitingRunConditions(c))
    result.current[1].onOpen()
    expect(c.openRun).toHaveBeenCalledWith("run-2")
    expect(c.openLibraryHealth).not.toHaveBeenCalled()
  })

  it("reports loading / failed / stale / answered from the hook's own flags", () => {
    const report = vi.fn()
    const cases: [Partial<typeof waitingState.current>, string][] = [
      [{ verdictKnown: false, loading: true, notices: [], total: 0 }, "loading"],
      [{ verdictKnown: false, loading: false, notices: [], total: 0 }, "failed"],
      [{ verdictKnown: true, failedSinceLast: true }, "stale"],
      [{ verdictKnown: true, failedSinceLast: false }, "answered"],
    ]
    for (const [state, expected] of cases) {
      setWaiting(state)
      report.mockClear()
      const { unmount } = renderHook(() => useWaitingRunConditions(ctx({ reportWaitingStatus: report })))
      expect(report).toHaveBeenLastCalledWith(expected)
      unmount()
    }
  })

  it("a context with no reportWaitingStatus does not throw", () => {
    setWaiting({ verdictKnown: false, loading: true })
    expect(() => renderHook(() => useWaitingRunConditions(ctx()))).not.toThrow()
  })
})

describe("301-02 — the leaf helpers partition by mark (D-12, F8)", () => {
  const library: AttentionCondition[] = [
    { mark: "library", id: "w-1", title: "Rate sheets", detail: "d", onOpen: vi.fn(), tab: "health" },
    { mark: "library", id: "w-2", title: "Contracts", detail: "d", onOpen: vi.fn(), tab: "health" },
  ]
  function waiting(): AttentionCondition[] {
    setWaiting()
    const { result, unmount } = renderHook(() => useWaitingRunConditions(ctx()))
    const out = result.current
    unmount()
    return out
  }

  it("conditionsForMark returns only the asked mark", () => {
    const mixed = [...library, ...waiting()]
    expect(conditionsForMark(mixed, "library").map((c) => c.id)).toEqual(["w-1", "w-2"])
    expect(conditionsForMark(mixed, "waiting").map((c) => c.id)).toEqual(["n-1", "n-2"])
  })

  it("waitingTotal reads the server total from a waiting row — never the row count", () => {
    const mixed = [...library, ...waiting()]
    expect(waitingTotal(mixed)).toBe(7)
    expect(waitingTotal(library)).toBe(0)
    expect(waitingTotal([])).toBe(0)
  })

  it("attentionCountByTab counts only library conditions", () => {
    expect(attentionCountByTab([...library, ...waiting()])).toEqual({ health: 2 })
  })
})

// ══ 4 · `detail` IS UNCHANGED — ASSERTED ON THE WORDS ═════════════════════════════════
describe("attention tab attribution — the cause is still spent into a sentence", () => {
  const CAUSES: SourceFailureCause[] = [
    "token_revoked",
    "folder_gone",
    "unreachable",
    "connection_disabled",
    "unknown",
  ]

  it("every cause still resolves to its vocabulary sentence, and none leaks a raw cause string", async () => {
    // ⛔ T-244-04-02. The new field is a `LibraryTab` union member and cannot carry free text;
    // this case proves the OLD field did not start carrying it either. ⚠ Asserted on the
    // rendered WORDS, never on the presence of a `detail` key — a presence assertion cannot
    // see content drift, and this project shipped 200 green assertions over a surface that was
    // "nothing at all like what we designed" for exactly that reason.
    const { result } = renderHook(() => useStoppedSourceConditions(ctx()))
    await vi.waitFor(() => expect(result.current.length).toBe(2))

    expect(result.current[0].detail).toBe(SENTENCE_FOR_CAUSE.folder_gone("Ops Drive"))
    expect(result.current[1].detail).toBe(SENTENCE_FOR_CAUSE.token_revoked("Ops Drive"))
    // …and no condition's detail is merely the machine token.
    for (const condition of result.current) {
      expect(CAUSES).not.toContain(condition.detail)
      expect(condition.detail.length).toBeGreaterThan(20)
    }
  })

  it("the five cause sentences are the ones the vocabulary leaf owns — non-vacuity for the pair above", () => {
    // If `SENTENCE_FOR_CAUSE` ever returned "" the assertions above would compare "" to ""
    // and pass. This is what reds instead.
    for (const cause of CAUSES) {
      expect(SENTENCE_FOR_CAUSE[cause]("Ops Drive").length).toBeGreaterThan(20)
    }
    expect(SENTENCE_FOR_CAUSE.folder_gone("Ops Drive")).toContain("no longer shared")
  })
})

// ══ 5 · THE READER INVENTORY IS UNMOVED ═══════════════════════════════════════════════
//
// ⛔ Arm 1 of `attentionConditions.ts`'s three-part re-open trigger is *a third concurrent
// reader*. This plan threads the attribution DOWN AS DATA specifically so that arm stays
// unfired. `ChatLayout.badge.test.tsx` carries the canonical sweep; this is the same property
// asserted in the file that changes, so the constraint travels with the edit.
describe("attention tab attribution — no new useSourceAttention() call site", () => {
  const RAW = import.meta.glob("../../../**/*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>

  /** `src/`-relative path for a glob key — Vite normalises keys to DIFFERENT depths. */
  const HERE = "src/components/layout/__tests__"
  const rel = (key: string): string => {
    const out = HERE.split("/")
    for (const seg of key.replace(/\\/g, "/").split("/")) {
      if (seg === "..") out.pop()
      else if (seg !== "." && seg !== "") out.push(seg)
    }
    return out.join("/").replace(/^src\//, "")
  }

  const isProductFile = (key: string) => {
    const p = rel(key)
    if (/\.test\.tsx?$/.test(p)) return false
    if (p.includes("__tests__/")) return false
    // The hook's own definition file — a declaration, never a call site.
    if (p === "hooks/useSourceAttention.ts") return false
    return true
  }

  /** ⛔ The line-anchored comment stripper. A code measurement satisfiable by a COMMENT is
   *  the 187-24 lesson, and this exact fence read `attentionConditions.ts` as THREE readers
   *  on its first cut because that file's docblock quotes the hook name in prose. */
  const codeOf = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

  const callSites = (src: string) => (codeOf(src).match(/useSourceAttention\s*\(/g) ?? []).length

  const inventory = Object.entries(RAW)
    .filter(([key]) => isProductFile(key))
    .map(([key, src]) => [rel(key), callSites(src)] as const)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))

  it("self-guard: the sweep really loaded the tree and the stripper really strips", () => {
    expect(Object.keys(RAW).length).toBeGreaterThan(200)
    const registry = Object.entries(RAW).find(
      ([k]) => rel(k) === "components/layout/attentionConditions.ts",
    )?.[1] as string
    expect(registry).toBeTypeOf("string")
    // Present in the prose, absent from the code — the pair that reds a broken stripper.
    expect(registry).toContain("MOUNTED SUBTREE")
    expect(codeOf(registry)).not.toContain("MOUNTED SUBTREE")
    expect(codeOf(registry)).toContain("ATTENTION_PRODUCERS")
  })

  it("⛔ EXACTLY THREE product call sites — and only TWO can be mounted at once", () => {
    // ⚠ THREE is measured; the plan's brief said two. TWO is the count of CONCURRENT readers:
    // the shell (through the registry), plus whichever Library tab body is mounted. The last
    // two entries are mutually exclusive BY TAB, which the `forceMount` case below is what
    // makes structural rather than lucky.
    expect(inventory).toEqual([
      ["components/layout/attentionConditions.ts", 1],
      ["components/library/IngestionTab.tsx", 1],
      ["components/library/SourcesAttentionSection.tsx", 1],
    ])
  })

  // ── Phase 301-02 (D-14) — the sibling fence: ONE `useWaitingNotices(` call site ─────────
  // Same glob, same stripper, same exclusions. A second reader of the waiting list would mean
  // a second subscription and a second poll — and, in time, two counts for one person.
  const waitingCallSites = (src: string) => (codeOf(src).match(/useWaitingNotices\s*\(/g) ?? []).length
  const waitingInventory = Object.entries(RAW)
    .filter(([key]) => isProductFile(key) && rel(key) !== "hooks/useWaitingNotices.ts")
    .map(([key, src]) => [rel(key), waitingCallSites(src)] as const)
    .filter(([, n]) => n > 0)
    .sort(([a], [b]) => a.localeCompare(b))

  it("self-guard: the waiting hook's own file is the definition the fence excludes", () => {
    const hook = Object.entries(RAW).find(([k]) => rel(k) === "hooks/useWaitingNotices.ts")?.[1] as string
    expect(hook).toBeTypeOf("string")
    expect(codeOf(hook)).toContain("export function useWaitingNotices(")
    expect(waitingInventory.map(([p]) => p)).not.toContain("hooks/useWaitingNotices.ts")
  })

  it("⛔ EXACTLY ONE product call site of useWaitingNotices( — the registry (D-14)", () => {
    expect(waitingInventory).toEqual([["components/layout/attentionConditions.ts", 1]])
  })

  it("⛔ the Library page receives the attribution as DATA — it does not fetch a verdict", () => {
    const page = Object.entries(RAW).find(([k]) => rel(k) === "pages/LibraryPage.tsx")?.[1] as string
    expect(page).toBeTypeOf("string")
    expect(callSites(page)).toBe(0)
    // Non-vacuity: it really is the page.
    expect(page).toContain("export function LibraryPage")
    // …and the two Library readers stay mutually exclusive by tab.
    expect(page).not.toContain("forceMount")
  })
})
