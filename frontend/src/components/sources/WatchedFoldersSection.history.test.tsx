/**
 * Phase 235 plan 10 task 2 (SURF-02 · `BUG-260906-02` / D-235-14 / D-235-16 / SEED-248) —
 * THE HISTORY ON THE CARD, AND THE SYNC BUTTON'S HONESTY.
 *
 * ── WHAT THIS SUITE IS ABOUT ────────────────────────────────────────────────────────
 *
 *  1. Every run a source has made is ONE CLICK away, on the source itself (D-235-17). The
 *     history is fetched on FIRST EXPANSION — twelve cards must not fire twelve requests to
 *     render a list nobody has opened.
 *  2. The fold is RENDERING, never storage (D-235-07): 17 stored ticks with 14 consecutive
 *     quiet ones render as 3 `run` blocks plus one `quiet-fold`, and expand to all 17.
 *     ⚠ Those are the SKETCH's own fixture numbers, and `runCollapsed: 3` counts `run`
 *     BLOCKS — the fold is a fourth ROW beside them (plan 04's recorded finding).
 *  3. The Sync button reports the OUTCOME rather than the request. `/sync` answers `asked` or
 *     `refused`; between the click and the tick the card says what was ASKED and when the next
 *     pass is due, and it flips to the real outcome only once `last_run_at` has advanced PAST
 *     the click. A refusal is not a queue.
 *  4. SEED-248 — a surface that is still loading must SAY so. An empty list and "there is
 *     nothing here" look identical and mean opposite things.
 *
 * ── ⚠ EVERY `?raw` FENCE CARRIES ITS OWN NON-VACUITY ASSERTION ─────────────────────
 *
 * An import that resolved empty, or a regex that matched nothing, yields "" — and "" satisfies
 * every `not.toContain` below while looking green.
 *
 * ── ⛔ TWO SEPARATE `vi.mock` FACTORIES ────────────────────────────────────────────
 *
 * `@/lib/api/sources` is NOT in the `@/lib/api` barrel (RESEARCH P-10), and its factory must
 * declare `listSyncRuns` and `getSourceHealth` or the mount throws about a missing export
 * rather than about the thing under test (Phase 196-08).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { WatchedFoldersSection } from "./WatchedFoldersSection"
import * as sourcesApi from "@/lib/api/sources"
import type { ConnectorWatch, SyncRun } from "@/lib/api/sources"
import { COPY } from "./sourceHealthVocabulary"

// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import watchedFoldersSource from "./WatchedFoldersSection.tsx?raw"
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import watchRowCardSource from "./WatchRowCard.tsx?raw"

const combinedSource = watchedFoldersSource + "\n" + watchRowCardSource

vi.mock("@/lib/api/sources", () => ({
  listWatches: vi.fn(),
  triggerWatchSync: vi.fn(),
  updateWatch: vi.fn(),
  deleteWatch: vi.fn(),
  purgeWatchFiles: vi.fn(),
  createWatch: vi.fn(),
  listSyncRuns: vi.fn(),
  getSourceHealth: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  listConnectorConnections: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/hooks/useFolders", () => ({
  useFolders: () => ({ folders: [{ id: "lib-folder-1", name: "Procurement Invoices" }] }),
}))

const mockListWatches = vi.mocked(sourcesApi.listWatches)
const mockListSyncRuns = vi.mocked(sourcesApi.listSyncRuns)
const mockTriggerWatchSync = vi.mocked(sourcesApi.triggerWatchSync)

const FOUR_MIN_AGO = () => new Date(Date.now() - 4 * 60_000).toISOString()

function watch(over: Partial<ConnectorWatch> = {}): ConnectorWatch {
  return {
    id: "watch-1",
    user_id: "user-1",
    connection_id: "conn-1",
    connection_name: "Google Drive (Finance)",
    service_id: "google",
    source_folder_id: "gdrive-fld-1",
    source_folder_name: "Q3 Vendor Bills",
    library_folder_id: "lib-folder-1",
    interval_minutes: 30,
    is_active: true,
    last_run_at: FOUR_MIN_AGO(),
    last_status: "success",
    item_count: 6,
    ...over,
  }
}

function run(over: Partial<SyncRun> & { id: string }): SyncRun {
  return {
    watch_id: "watch-1",
    started_at: FOUR_MIN_AGO(),
    finished_at: null,
    status: "success",
    failure_cause: null,
    last_error: null,
    listing_complete: true,
    count_new: 0,
    count_modified: 0,
    count_renamed: 0,
    count_missing: 0,
    count_restored: 0,
    count_errors: 0,
    ...over,
  }
}

/**
 * ⭐ THE SKETCH'S OWN RUN FIXTURE — 17 stored ticks, 14 of them quiet AND CONSECUTIVE.
 * Only consecutive quiet ticks fold, so the ordering here is load-bearing, not decorative.
 */
const SEVENTEEN_RUNS: SyncRun[] = [
  run({ id: "run-1", count_new: 3, count_modified: 1 }),
  ...Array.from({ length: 14 }, (_, i) => run({ id: `run-quiet-${i + 1}` })),
  run({ id: "run-16", status: "failed", count_errors: 1, last_error: "connection timed out" }),
  run({ id: "run-17", count_new: 12, count_missing: 2 }),
]

/** Open the one healthy source's card. Variant B keeps it a line until asked. */
async function openCard(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByTestId("sources-source-line")).toBeInTheDocument())
  await user.click(screen.getByTestId("sources-source-line").querySelector("button")!)
}

describe("WatchedFoldersSection — the history, and what Sync now says", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("confirm", vi.fn(() => true))
    mockListWatches.mockResolvedValue([watch()])
    mockListSyncRuns.mockResolvedValue(SEVENTEEN_RUNS)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  // ══ NON-VACUITY ══════════════════════════════════════════════════════════════════
  it("non-vacuity — the `?raw` import carries this component's live source", () => {
    expect(watchedFoldersSource.length).toBeGreaterThan(5000)
    expect(watchedFoldersSource).toContain("WatchedFoldersSection")
    expect(watchedFoldersSource).toContain("triggerWatchSync")
  })

  // ══ ⭐ THE HISTORY ═══════════════════════════════════════════════════════════════
  describe("every run a source has made is one click away", () => {
    it("does NOT fetch the history until it is asked for", async () => {
      const user = userEvent.setup()
      render(<WatchedFoldersSection />)
      await openCard(user)

      expect(mockListSyncRuns).not.toHaveBeenCalled()
      expect(screen.queryByTestId("sources-history")).not.toBeInTheDocument()
    })

    it("fetches ONCE on first expansion and renders the history", async () => {
      const user = userEvent.setup()
      render(<WatchedFoldersSection />)
      await openCard(user)

      await user.click(screen.getByTestId("sources-toggle-history"))
      await waitFor(() => expect(screen.getByTestId("sources-history")).toBeInTheDocument())
      expect(mockListSyncRuns).toHaveBeenCalledWith("watch-1")
      expect(mockListSyncRuns).toHaveBeenCalledTimes(1)

      // Closing and re-opening must not re-ask — the answer is already held.
      await user.click(screen.getByTestId("sources-toggle-history"))
      await user.click(screen.getByTestId("sources-toggle-history"))
      expect(mockListSyncRuns).toHaveBeenCalledTimes(1)
    })

    it("the control's name flips between `History` and `Hide history`", async () => {
      const user = userEvent.setup()
      render(<WatchedFoldersSection />)
      await openCard(user)

      expect(screen.getByTestId("sources-toggle-history")).toHaveTextContent(COPY.history)
      await user.click(screen.getByTestId("sources-toggle-history"))
      await waitFor(() =>
        expect(screen.getByTestId("sources-toggle-history")).toHaveTextContent(COPY.hideHistory),
      )
    })

    it("⭐ 17 stored ticks render as 3 `run` blocks collapsed, and 17 expanded", async () => {
      const user = userEvent.setup()
      render(<WatchedFoldersSection />)
      await openCard(user)

      await user.click(screen.getByTestId("sources-toggle-history"))
      await waitFor(() => expect(screen.getByTestId("sources-history")).toBeInTheDocument())

      expect(screen.getAllByTestId("sources-run")).toHaveLength(3)
      expect(screen.getAllByTestId("sources-quiet-fold")).toHaveLength(1)
      expect(screen.getByTestId("sources-quiet-fold")).toHaveTextContent(COPY.quietFold(14))

      await user.click(screen.getByTestId("sources-toggle-quiet"))
      expect(screen.getAllByTestId("sources-run")).toHaveLength(17)
      expect(screen.queryAllByTestId("sources-quiet-fold")).toHaveLength(0)
    })

    it("a failed tick carries a `fail-reason` — a sentence, never the raw error", async () => {
      const user = userEvent.setup()
      render(<WatchedFoldersSection />)
      await openCard(user)

      await user.click(screen.getByTestId("sources-toggle-history"))
      await waitFor(() => expect(screen.getByTestId("sources-fail-reason")).toBeInTheDocument())
      expect(screen.getByTestId("sources-fail-reason").textContent).not.toContain(
        "connection timed out",
      )
    })

    /**
     * ⚠ SEED-248 — an empty list and "we have not asked yet" render identically and mean
     * opposite things. The surface must SAY it is loading, and not with a bare spinner.
     */
    it("⚠ while the history is loading it SAYS so", async () => {
      let release: (runs: SyncRun[]) => void = () => {}
      mockListSyncRuns.mockReturnValue(
        new Promise<SyncRun[]>((resolve) => {
          release = resolve
        }),
      )
      const user = userEvent.setup()
      render(<WatchedFoldersSection />)
      await openCard(user)

      await user.click(screen.getByTestId("sources-toggle-history"))
      expect(screen.getByTestId("sources-history-loading")).toBeInTheDocument()
      expect(screen.getByTestId("sources-history-loading").textContent?.trim().length).toBeGreaterThan(
        0,
      )

      release(SEVENTEEN_RUNS)
      await waitFor(() => expect(screen.getByTestId("sources-history")).toBeInTheDocument())
      expect(screen.queryByTestId("sources-history-loading")).not.toBeInTheDocument()
    })
  })

  // ══ ⭐ THE OUTCOME LINE (D-235-14) ═══════════════════════════════════════════════
  describe("the card renders the outcome, not the request", () => {
    it("says how many files the last check dealt with when something changed", async () => {
      render(<WatchedFoldersSection />)
      await waitFor(() => expect(screen.getByTestId("sources-outcome")).toBeInTheDocument())
      expect(screen.getByTestId("sources-outcome")).toHaveTextContent(/Checked .* · 6 files/)
    })

    it("says `no changes` when the last check changed nothing", async () => {
      mockListWatches.mockResolvedValue([watch({ item_count: 0 })])
      render(<WatchedFoldersSection />)
      await waitFor(() => expect(screen.getByTestId("sources-outcome")).toBeInTheDocument())
      expect(screen.getByTestId("sources-outcome")).toHaveTextContent(/· no changes$/)
    })

    it("a source that has never ticked says so, rather than inventing a time", async () => {
      mockListWatches.mockResolvedValue([watch({ last_run_at: null, last_status: "pending" })])
      render(<WatchedFoldersSection />)
      await waitFor(() => expect(screen.getByTestId("sources-outcome")).toBeInTheDocument())
      expect(screen.getByTestId("sources-outcome")).toHaveTextContent(COPY.neverRead)
    })
  })

  // ══ ⭐ THE PENDING STATE (BUG-260906-02 part 3 / D-235-16) ═══════════════════════
  describe("between the click and the tick", () => {
    it("says what was ASKED and when the next pass is due", async () => {
      mockTriggerWatchSync.mockResolvedValue({
        status: "asked",
        message: "ok",
        next_check_within_seconds: 60,
        reader_running: true,
      })
      const user = userEvent.setup()
      render(<WatchedFoldersSection />)
      await openCard(user)

      await user.click(screen.getByTestId("sources-sync-now"))
      await waitFor(() =>
        expect(screen.getByTestId("sources-outcome")).toHaveTextContent(COPY.asked("60 seconds")),
      )
      // ⛔ Nothing claims work is happening — only that it was asked for.
      expect(screen.getByTestId("sources-outcome").textContent).not.toMatch(/checking/i)
    })

    it("⭐ flips to the real outcome once `last_run_at` advances past the click", async () => {
      mockTriggerWatchSync.mockResolvedValue({
        status: "asked",
        message: "ok",
        next_check_within_seconds: 60,
        reader_running: true,
      })
      const user = userEvent.setup()
      render(<WatchedFoldersSection />)
      await openCard(user)

      await user.click(screen.getByTestId("sources-sync-now"))
      await waitFor(() =>
        expect(screen.getByTestId("sources-outcome")).toHaveTextContent(COPY.asked("60 seconds")),
      )

      // The tick lands elsewhere; the list re-asks and sees an advanced instant.
      mockListWatches.mockResolvedValue([
        watch({ last_run_at: new Date(Date.now() + 1_000).toISOString(), item_count: 9 }),
      ])
      await user.click(screen.getByTestId("sources-sync-now"))

      await waitFor(() =>
        expect(screen.getByTestId("sources-outcome")).toHaveTextContent(/· 9 files/),
      )
      expect(screen.getByTestId("sources-outcome").textContent).not.toContain("Asked")
    })

    it("⛔ a REFUSAL is not a queue — it shows the refusal and never `Asked`", async () => {
      mockTriggerWatchSync.mockResolvedValue({
        status: "refused",
        message:
          "Automatic reading is switched off on this server, so this check cannot be asked for.",
        reader_running: false,
      })
      const user = userEvent.setup()
      render(<WatchedFoldersSection />)
      await openCard(user)

      await user.click(screen.getByTestId("sources-sync-now"))
      await waitFor(() => expect(screen.getByTestId("sources-refusal")).toBeInTheDocument())
      expect(screen.getByTestId("sources-refusal")).toHaveTextContent(/switched off on this server/)
      expect(screen.getByTestId("sources-outcome").textContent).not.toContain("Asked")
    })
  })

  // ══ ⛔ SOURCE FENCES OVER THE LIVE FILE ══════════════════════════════════════════
  describe("the words this file may never say", () => {
    /**
     * ⛔ `BUG-260906-02` — the Sync feedback announced that a check had been put on a
     * timetable. That described the REQUEST, not the outcome, and it was true with the reader
     * switched off too. ⚠ The forbidden word is not spelled in this suite's prose either, for
     * the same Pitfall-8 reason the component's docblock avoids it: only the assertion holds it.
     */
    it("⛔ the request-timetable word appears nowhere in the component", () => {
      expect(watchedFoldersSource).toContain("triggerWatchSync") // non-vacuity
      expect(combinedSource.toLowerCase()).not.toContain("sched" + "uled")
    })

    it("⛔ no optimistic present-tense progress claim survives", () => {
      expect(watchedFoldersSource).toContain("COPY.asked") // non-vacuity
      expect(combinedSource).not.toContain("Check" + "ing now")
    })

    it("⛔ SURF-01 — neither push-subscription word appears", () => {
      expect(watchRowCardSource).toContain("interval_minutes") // non-vacuity
      expect(combinedSource.toLowerCase()).not.toContain("instant" + "ly")
      expect(combinedSource.toLowerCase()).not.toContain("on " + "change")
    })

    it("⭐ the pinned SURF-01 cadence sentence is byte-identical", () => {
      expect(watchRowCardSource).toContain(
        "<span>checked every {watch.interval_minutes} minutes</span>",
      )
      expect(watchRowCardSource).toContain("SURF-01: Exact copy 'checked every N minutes'")
    })
  })
})
