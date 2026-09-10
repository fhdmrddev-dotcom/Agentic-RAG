/**
 * Phase 235 plan 11 (SURF-03 / LIB-10 · D-235-01 / D-235-17) —
 * THE HEALTH TAB LISTS ONLY WHAT IS WRONG, AND HANDS THE PERSON BACK TO THE FIX.
 *
 * ── ⛔ THE DIVISION OF LABOUR IS THE POINT (D-235-17) ──────────────────────────────────
 *
 *   Ingestion = every source and everything it did.
 *   Health    = only what is wrong.
 *
 * Rendering the run history here TOO was explicitly REJECTED at scoping — two homes for one
 * truth, even with a shared component. So this suite asserts the ABSENCE of the history as
 * hard as it asserts the presence of the rows, and `RunHistoryList` is never mounted here.
 *
 * ── ⛔ THE ROW IS A DOOR, NOT A REPAIR ────────────────────────────────────────────────
 *
 * The sketch's first variant fork was *where the fix lives* — and it was REFUTED by
 * measurement (248 characters of ~30,000 differed; the landing screens were pixel-identical).
 * The fix location was then settled BY RULE: **one home, on the source card**, in both
 * variants. So the Health row says `Go to source` and offers no `Reconnect`, no
 * `Pick a different folder` and no `Retry now` — asserted NEGATIVELY, by name, because an
 * absence nobody tests for is an absence nobody notices being filled in.
 *
 * ── ⛔ THREE STATES, THREE TRUTHS (SEED-248 / T-235-39) ────────────────────────────────
 *
 * "nothing is wrong", "we have not looked yet" and "we could not ask" are three different
 * facts and each gets its own named case below. A section that renders an empty list for all
 * three is indistinguishable from a broken section.
 *
 * ── ⛔ `@/lib/api/sources` IS MOCKED SEPARATELY ────────────────────────────────────────
 *
 * It is NOT in the `@/lib/api` barrel (RESEARCH P-10), so `vi.mock("@/lib/api")` alone never
 * intercepts it. The factory declares `listSyncRuns` AND `getSourceHealth` — a factory that
 * omits an export makes the mount throw about a missing export rather than about the thing
 * under test (Phase 196-08's nine-suite, 249-case failure mode).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react"

import { COPY, SENTENCE_FOR_CAUSE, CONTROL_FOR_CAUSE } from "@/components/sources/sourceHealthVocabulary"
import type { StoppedSource } from "@/lib/api/sources"

const { mockGetSourceHealth } = vi.hoisted(() => ({ mockGetSourceHealth: vi.fn() }))

vi.mock("@/lib/api/sources", () => ({
  listWatches: vi.fn().mockResolvedValue([]),
  getWatch: vi.fn(),
  createWatch: vi.fn(),
  updateWatch: vi.fn(),
  deleteWatch: vi.fn(),
  triggerWatchSync: vi.fn(),
  purgeWatchFiles: vi.fn(),
  listSyncRuns: vi.fn().mockResolvedValue([]),
  getSourceHealth: mockGetSourceHealth,
}))

// The Health tab's four shipped siblings each fetch on mount. They are mocked so a rejected
// probe in ONE of them cannot be mistaken for the fail-quiet property this suite measures.
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  const empty = vi.fn().mockResolvedValue({ items: [], total: 0 })
  return {
    ...actual,
    getHealthOverview: vi.fn().mockResolvedValue({
      health_score: 0.87,
      high_confidence_rate: 0.9,
      total_documents: 1,
      retrieved_this_month: 1,
      never_retrieved_count: 0,
    }),
    getRetrievalTrend: vi.fn().mockResolvedValue([]),
    getMostRetrieved: empty,
    getNeverRetrieved: empty,
    getLowConfidenceQueries: empty,
    getStaleDocs: empty,
    getGovBroken: empty,
    getGovUnclassified: empty,
    getGovLowConfidence: empty,
    listCheckedQueries: vi.fn().mockResolvedValue([]),
  }
})

vi.mock("@/lib/supabase", () => ({
  SUPABASE_CLIENT_REHYDRATED: "supabase:client-rehydrated",
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    channel: vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }),
    removeChannel: vi.fn(),
  },
}))

import { SourcesAttentionSection } from "../SourcesAttentionSection"
import { HealthTab } from "../HealthTab"

const HOUR = 3_600_000

/**
 * Two stopped sources, two DIFFERENT causes — the contract's own number (`attentionRow: 2`).
 *
 * ⚠ `last_good_at` is deliberately `null` on the second row. `/sources/health` reads it over a
 * FIVE-ROW window (plan 06), so a null there does NOT mean "never succeeded" — and a case
 * below proves the section never turns that null into a "has not read yet" claim.
 */
const STOPPED_TOKEN: StoppedSource = {
  watch_id: "watch-legal",
  source_folder_name: "Contracts / Executed",
  connection_name: "Legal SharePoint",
  cause: "token_revoked",
  hard: true,
  stopped_since: new Date(Date.now() - 3 * HOUR).toISOString(),
  last_good_at: new Date(Date.now() - 26 * HOUR).toISOString(),
}

const STOPPED_FOLDER: StoppedSource = {
  watch_id: "watch-ops",
  source_folder_name: "Site Photos / Tower B",
  connection_name: "Ops Drive",
  cause: "folder_gone",
  hard: true,
  stopped_since: new Date(Date.now() - 30 * HOUR).toISOString(),
  last_good_at: null,
}

const TWO_STOPPED = [STOPPED_TOKEN, STOPPED_FOLDER]

function verdict(stopped: StoppedSource[]) {
  return { stopped, reader_running: true, poll_interval_seconds: 60 }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSourceHealth.mockResolvedValue(verdict(TWO_STOPPED))
})

afterEach(cleanup)

// ══ §0 NON-VACUITY — asserted FIRST, before any property rests on the fixture ══════════
describe("SourcesAttentionSection — §0 the fixture is worth asserting against", () => {
  it("carries at least two stopped sources and at least two DISTINCT causes", () => {
    expect(TWO_STOPPED.length).toBeGreaterThanOrEqual(2)
    expect(new Set(TWO_STOPPED.map((s) => s.cause)).size).toBeGreaterThanOrEqual(2)
    // …and both causes really are keys of the table the rows read.
    for (const s of TWO_STOPPED) expect(SENTENCE_FOR_CAUSE[s.cause]).toBeTypeOf("function")
  })
})

// ══ §1 ONLY WHAT IS WRONG ══════════════════════════════════════════════════════════════
describe("SourcesAttentionSection — §1 only what is wrong", () => {
  it("renders the three contract blocks, and exactly one `attention-row` per stopped source", async () => {
    render(<SourcesAttentionSection onGoToSource={vi.fn()} />)

    expect(await screen.findByTestId("health-attention-list")).toBeInTheDocument()
    expect(screen.getAllByTestId("health-body-health")).toHaveLength(1)
    expect(screen.getAllByTestId("health-attention-list")).toHaveLength(1)
    expect(screen.getAllByTestId("health-attention-row")).toHaveLength(TWO_STOPPED.length)
  })

  it("each row names its folder and says what is true of it, from the vocabulary table", async () => {
    render(<SourcesAttentionSection onGoToSource={vi.fn()} />)

    const rows = await screen.findAllByTestId("health-attention-row")
    for (const [i, source] of TWO_STOPPED.entries()) {
      expect(rows[i]).toHaveTextContent(source.source_folder_name)
      expect(rows[i]).toHaveTextContent(
        SENTENCE_FOR_CAUSE[source.cause](source.connection_name ?? ""),
      )
    }
  })

  it("⛔ carries NO run history — Ingestion owns every tick, Health owns only what is wrong", async () => {
    render(<SourcesAttentionSection onGoToSource={vi.fn()} />)

    await screen.findByTestId("health-attention-list")
    expect(screen.queryAllByTestId("sources-history")).toHaveLength(0)
    expect(screen.queryAllByTestId("sources-run")).toHaveLength(0)
    expect(screen.queryAllByTestId("sources-toggle-history")).toHaveLength(0)
    expect(screen.queryAllByTestId("sources-source-card")).toHaveLength(0)
  })
})

// ══ §2 THE DOOR, AND THE REPAIRS IT DOES NOT CARRY ═════════════════════════════════════
describe("SourcesAttentionSection — §2 a door, never a repair", () => {
  it("offers exactly one `Go to source` per row, and it hops to THAT watch", async () => {
    const onGoToSource = vi.fn()
    render(<SourcesAttentionSection onGoToSource={onGoToSource} />)

    const controls = await screen.findAllByTestId("health-go-to-source")
    expect(controls).toHaveLength(TWO_STOPPED.length)
    for (const c of controls) expect(c).toHaveTextContent(COPY.goToSource)

    fireEvent.click(controls[1])
    expect(onGoToSource).toHaveBeenCalledTimes(1)
    expect(onGoToSource).toHaveBeenCalledWith(STOPPED_FOLDER.watch_id)
  })

  /**
   * ⚠ The forbidden labels are read from `CONTROL_FOR_CAUSE` rather than re-typed, so a
   * reworded repair label cannot slip past this case. The non-empty check first is what stops
   * the loop being vacuous.
   */
  it("⛔ offers NO repair — every `CONTROL_FOR_CAUSE` label is absent from this surface", async () => {
    render(<SourcesAttentionSection onGoToSource={vi.fn()} />)
    await screen.findByTestId("health-attention-list")

    const causes = Object.keys(CONTROL_FOR_CAUSE) as (keyof typeof CONTROL_FOR_CAUSE)[]
    expect(causes.length).toBeGreaterThan(0)
    for (const cause of causes) {
      const label = CONTROL_FOR_CAUSE[cause].label("Legal SharePoint")
      expect(screen.queryByText(label)).toBeNull()
    }
    expect(screen.queryAllByTestId("sources-fix")).toHaveLength(0)
    expect(screen.queryAllByTestId("sources-sync-now")).toHaveLength(0)
  })

  it("⛔ with no `onGoToSource` the control is ABSENT — never a dead click", async () => {
    render(<SourcesAttentionSection />)

    // Non-vacuity: the rows themselves DID render, so the absence below is about the control.
    expect(await screen.findAllByTestId("health-attention-row")).toHaveLength(2)
    expect(screen.queryAllByTestId("health-go-to-source")).toHaveLength(0)
  })
})

// ══ §3 THREE STATES, THREE TRUTHS ══════════════════════════════════════════════════════
describe("SourcesAttentionSection — §3 nothing wrong ≠ not looked yet ≠ could not ask", () => {
  it("EMPTY — every source is reading, said in words, with no list at all", async () => {
    mockGetSourceHealth.mockResolvedValue(verdict([]))
    render(<SourcesAttentionSection onGoToSource={vi.fn()} />)

    expect(await screen.findByTestId("health-attention-empty")).toHaveTextContent(
      COPY.attentionEmpty,
    )
    expect(screen.queryAllByTestId("health-attention-list")).toHaveLength(0)
    expect(screen.queryAllByTestId("health-attention-row")).toHaveLength(0)
  })

  it("LOADING — while the verdict is in flight it SAYS so, and claims nothing (SEED-248)", async () => {
    let release: (v: unknown) => void = () => {}
    mockGetSourceHealth.mockReturnValue(new Promise((r) => { release = r }))
    render(<SourcesAttentionSection onGoToSource={vi.fn()} />)

    const pending = await screen.findByTestId("health-attention-loading")
    expect(pending.textContent?.trim().length ?? 0).toBeGreaterThan(0)
    // ⛔ The all-clear must NOT be on screen while we are still asking.
    expect(screen.queryByText(COPY.attentionEmpty)).toBeNull()
    expect(screen.queryAllByTestId("health-attention-list")).toHaveLength(0)

    release(verdict([]))
    await waitFor(() => expect(screen.getByTestId("health-attention-empty")).toBeInTheDocument())
  })

  it("REJECTED — a failed probe never claims every source is reading", async () => {
    mockGetSourceHealth.mockRejectedValue(new Error("network down"))
    render(<SourcesAttentionSection onGoToSource={vi.fn()} />)

    expect(await screen.findByTestId("health-attention-unknown")).toBeInTheDocument()
    expect(screen.queryByText(COPY.attentionEmpty)).toBeNull()
    expect(screen.queryAllByTestId("health-attention-list")).toHaveLength(0)
  })

  it("⛔ a rejected probe does not take the rest of the Health tab down with it", async () => {
    mockGetSourceHealth.mockRejectedValue(new Error("network down"))
    render(<HealthTab />)

    // The shipped sibling is still there — the section fails quiet, as its idiom requires.
    /**
     * ⚠ WAS `health-coverage-ring`, which no longer exists. The "found by a search" ring was
     * REMOVED on 2026-09-06 (operator decision): it drew DEMAND on a red-to-green health scale,
     * so a library nobody had queried rendered a red arc meaning "not needed yet".
     *
     * The case's PROPERTY is unchanged and is the thing that matters — a rejected probe must not
     * take the rest of the Health tab down with it — so it now anchors on a block that is still
     * there. Re-anchoring, not weakening: this still fails if the tab stops rendering.
     */
    expect(await screen.findByTestId("health-freshness-donut")).toBeInTheDocument()
    expect(await screen.findByTestId("health-attention-unknown")).toBeInTheDocument()
  })
})

// ══ §4 THE `last_good_at` WINDOW — a null is not a "never" ══════════════════════════════
describe("SourcesAttentionSection — §4 the five-row window is not a claim", () => {
  it("names when a source last read when the server knows…", async () => {
    mockGetSourceHealth.mockResolvedValue(verdict([STOPPED_TOKEN]))
    render(<SourcesAttentionSection onGoToSource={vi.fn()} />)

    const row = await screen.findByTestId("health-attention-row")
    expect(row).toHaveTextContent(COPY.lastGood("yesterday"))
  })

  it("⛔ …and says NOTHING about it when the window did not reach a success", async () => {
    mockGetSourceHealth.mockResolvedValue(verdict([STOPPED_FOLDER]))
    render(<SourcesAttentionSection onGoToSource={vi.fn()} />)

    // Non-vacuity: the row is really on screen before the absence is asserted.
    const row = await screen.findByTestId("health-attention-row")
    expect(row).toHaveTextContent(STOPPED_FOLDER.source_folder_name)
    // ⛔ `/sources/health` reads `last_good_at` over five rows. A null is "we did not see one
    //    in the window", NEVER "it has never read" — the unbounded run list is the card's.
    expect(screen.queryByText(COPY.neverRead)).toBeNull()
    expect(row.textContent).not.toContain("Last read successfully")
  })
})
