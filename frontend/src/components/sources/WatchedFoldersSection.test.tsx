/**
 * `WatchedFoldersSection` — Phase 234 (LIB-08 / SURF-01 / VIS-05 / SC#3) carried forward, and
 * Phase 235 plan 10 (SURF-02 / LIB-10 · variant B) added.
 *
 * ── WHAT PHASE 234 PINNED AND THIS FILE MUST NOT LOSE ────────────────────────────────
 * - The cadence invariant (SURF-01): the exact copy `checked every N minutes`.
 * - The absence of misleading real-time copy: the two push-subscription words are forbidden.
 * - Lifecycle actions: Sync now · Purge missing files · Pause/Resume · Delete.
 *
 * ── ⭐ WHAT PHASE 235 ADDS ──────────────────────────────────────────────────────────
 * - VARIANT B (operator, 2026-09-06): a HEALTHY source is ONE LINE and opens on click.
 *   ⛔ A stopped, paused or unreadable source is a full card and is NEVER collapsed.
 * - The stopped card says WHAT HAPPENED (the cause's own sentence) and offers exactly ONE
 *   control — resolved from `CONTROL_FOR_CAUSE` by TABLE LOOKUP, asserted as a loop over all
 *   four causes so a new cause needs a table row and no edit to the card.
 * - The raw `last_error` never reaches the screen (T-235-12 / T-235-33).
 *
 * ── ⚠ THE FIXTURE MOVED TO THE MEASURED STATUS SET ──────────────────────────────────
 * It used `"completed"` and `"disconnected"` — statuses production NEVER writes (RESEARCH
 * C-6). The measured set is `{running, success, failed, paused}`, and a suite that exercises
 * states the server cannot produce is proving something about nothing.
 *
 * ── ⛔ TWO SEPARATE `vi.mock` FACTORIES, AND THAT IS NOT AN ACCIDENT ────────────────
 * `@/lib/api/sources` is NOT re-exported by the `@/lib/api` barrel (RESEARCH P-10), so
 * `vi.mock("@/lib/api")` alone intercepts NOTHING from it. And the sources factory MUST now
 * declare `listSyncRuns` and `getSourceHealth`: a factory that omits an export makes this
 * suite throw AT MOUNT about a missing export rather than about the thing under test — Phase
 * 196-08's nine-suite, 249-case failure mode.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { WatchedFoldersSection } from "./WatchedFoldersSection"
import * as sourcesApi from "@/lib/api/sources"
import type {
  ConnectorWatch,
  ConnectorWatchDetail,
  ConnectorWatchItem,
  StoppedSource,
} from "@/lib/api/sources"
import {
  CONTROL_FOR_CAUSE,
  FILE_FAILURE_HEADING,
  FILE_FAILURE_MORE,
  FILE_FAILURE_SCOPE_NOTE,
  SENTENCE_FOR_CAUSE,
  SENTENCE_FOR_FILE_FAILURE,
  type SourceFailureCause,
} from "./sourceHealthVocabulary"

// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import watchedFoldersSource from "./WatchedFoldersSection.tsx?raw"

vi.mock("@/lib/api/sources", () => ({
  listWatches: vi.fn(),
  triggerWatchSync: vi.fn(),
  updateWatch: vi.fn(),
  deleteWatch: vi.fn(),
  purgeWatchFiles: vi.fn(),
  createWatch: vi.fn(),
  // ⭐ The two Phase-235 additions. Without them the mount throws about a missing export.
  listSyncRuns: vi.fn(),
  getSourceHealth: vi.fn(),
  // ⭐ Plan 17's addition — the shipped per-item read the card finally calls.
  getWatch: vi.fn(),
}))

vi.mock("@/lib/api", () => ({
  listConnectorConnections: vi.fn().mockResolvedValue([]),
}))

vi.mock("@/hooks/useFolders", () => ({
  useFolders: () => ({
    folders: [
      { id: "lib-folder-1", name: "Procurement Invoices", is_org_shared: false },
      { id: "lib-folder-2", name: "Executive Briefs", is_org_shared: true },
    ],
  }),
}))

const mockListWatches = vi.mocked(sourcesApi.listWatches)
const mockTriggerWatchSync = vi.mocked(sourcesApi.triggerWatchSync)
const mockUpdateWatch = vi.mocked(sourcesApi.updateWatch)
const mockDeleteWatch = vi.mocked(sourcesApi.deleteWatch)
const mockPurgeWatchFiles = vi.mocked(sourcesApi.purgeWatchFiles)
const mockListSyncRuns = vi.mocked(sourcesApi.listSyncRuns)
const mockGetWatch = vi.mocked(sourcesApi.getWatch)

/**
 * ⚠ `last_status` values come from the MEASURED production set only.
 * `watch-1` is healthy (a LINE); `watch-2` has failed (a CARD, never collapsed).
 */
const SAMPLE_WATCHES: ConnectorWatch[] = [
  {
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
    last_run_at: new Date(Date.now() - 4 * 60_000).toISOString(),
    last_status: "success",
    item_count: 14,
  },
  {
    id: "watch-2",
    user_id: "user-1",
    connection_id: "conn-2",
    connection_name: "Google Drive (Procurement)",
    service_id: "google",
    source_folder_id: "gdrive-fld-2",
    source_folder_name: "Vendor Contracts 2026",
    library_folder_id: "lib-folder-2",
    interval_minutes: 60,
    is_active: true,
    last_run_at: new Date(Date.now() - 90 * 60_000).toISOString(),
    last_status: "failed",
    last_error: "Connection unauthorized: refresh token revoked",
    item_count: 8,
  },
]

const STOPPED_TOKEN_REVOKED: StoppedSource[] = [
  {
    watch_id: "watch-2",
    source_folder_name: "Vendor Contracts 2026",
    connection_name: "Google Drive (Procurement)",
    cause: "token_revoked",
    hard: true,
    stopped_since: new Date(Date.now() - 90 * 60_000).toISOString(),
    last_good_at: new Date(Date.now() - 26 * 60 * 60_000).toISOString(),
  },
]

/** One watch, in whatever state the case needs. */
function only(over: Partial<ConnectorWatch>): ConnectorWatch[] {
  return [{ ...SAMPLE_WATCHES[0], ...over }]
}

/** One stored per-file row, in whatever state the case needs. */
function item(over: Partial<ConnectorWatchItem> & { id: string }): ConnectorWatchItem {
  return {
    watch_id: "watch-1",
    external_id: `ext-${over.id}`,
    name: `${over.id}.pdf`,
    path_hint: "/",
    state: "present",
    ...over,
  }
}

/** The `GET /sources/watches/{id}` reply the card reads its per-file rows from. */
function detail(items: ConnectorWatchItem[], base = SAMPLE_WATCHES[0]): ConnectorWatchDetail {
  return { ...base, items }
}

describe("WatchedFoldersSection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal("confirm", vi.fn(() => true))
    mockListSyncRuns.mockResolvedValue([])
    // ⚠ The default is an ANSWERED fetch carrying no failing file, so every pre-existing case
    //   renders exactly the surface it rendered before this plan.
    mockGetWatch.mockResolvedValue(detail([]))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  // ══ NON-VACUITY — the `?raw` fences below assert over "" and look green otherwise ══
  it("non-vacuity — the `?raw` import carries this component's live source", () => {
    expect(watchedFoldersSource.length).toBeGreaterThan(5000)
    expect(watchedFoldersSource).toContain("WatchedFoldersSection")
  })

  // ══ SURF-01 — the pinned Phase 234 invariant ═════════════════════════════════════
  it("renders watched folders list with exact cadence copy (SURF-01)", async () => {
    mockListWatches.mockResolvedValue(SAMPLE_WATCHES)
    render(<WatchedFoldersSection />)

    await waitFor(() => {
      expect(screen.getByText("Q3 Vendor Bills")).toBeInTheDocument()
      expect(screen.getByText("Vendor Contracts 2026")).toBeInTheDocument()
    })

    // SURF-01: Exact copy 'checked every N minutes'
    expect(screen.getByText(/checked every 30 minutes/i)).toBeInTheDocument()
    expect(screen.getByText(/checked every 60 minutes/i)).toBeInTheDocument()

    // SURF-01: Absence of forbidden words
    const sectionText = document.body.textContent?.toLowerCase() || ""
    expect(sectionText).not.toContain("instantly")
    expect(sectionText).not.toContain("on change")
  })

  // ══ ⭐ VARIANT B ═════════════════════════════════════════════════════════════════
  describe("variant B — a healthy source is one line", () => {
    it("renders a healthy source as a `source-line` and NOT as a card", async () => {
      mockListWatches.mockResolvedValue(only({}))
      render(<WatchedFoldersSection />)

      await waitFor(() => expect(screen.getByTestId("sources-source-line")).toBeInTheDocument())
      expect(screen.queryByTestId("sources-source-card")).not.toBeInTheDocument()
    })

    it("opens the line into a full card on click, and closes it again", async () => {
      mockListWatches.mockResolvedValue(only({}))
      render(<WatchedFoldersSection />)
      const user = userEvent.setup()

      await waitFor(() => expect(screen.getByTestId("sources-source-line")).toBeInTheDocument())
      await user.click(screen.getByTestId("sources-source-line").querySelector("button")!)

      expect(screen.getByTestId("sources-source-card")).toBeInTheDocument()
      expect(screen.queryByTestId("sources-source-line")).not.toBeInTheDocument()

      await user.click(screen.getByTestId("sources-collapse"))
      expect(screen.getByTestId("sources-source-line")).toBeInTheDocument()
    })

    it("⛔ NEVER collapses a stopped source — it is a card, with no collapse control", async () => {
      mockListWatches.mockResolvedValue(SAMPLE_WATCHES)
      render(<WatchedFoldersSection stoppedSources={STOPPED_TOKEN_REVOKED} />)

      await waitFor(() => expect(screen.getByTestId("sources-source-card")).toBeInTheDocument())
      // One line (the healthy one) and one card (the stopped one) — every source once.
      expect(screen.getAllByTestId("sources-source-line")).toHaveLength(1)
      expect(screen.getAllByTestId("sources-source-card")).toHaveLength(1)
      expect(screen.queryByTestId("sources-collapse")).not.toBeInTheDocument()
    })

    it("⛔ NEVER collapses a paused source either — it is not reading", async () => {
      mockListWatches.mockResolvedValue(only({ is_active: false, last_status: "paused" }))
      render(<WatchedFoldersSection />)

      await waitFor(() => expect(screen.getByTestId("sources-source-card")).toBeInTheDocument())
      expect(screen.queryByTestId("sources-source-line")).not.toBeInTheDocument()
    })

    it("carries `watch-card-{id}` as BOTH an id and a testid — `getElementById` cannot see a testid", async () => {
      mockListWatches.mockResolvedValue(only({}))
      render(<WatchedFoldersSection />)

      await waitFor(() => expect(screen.getByTestId("watch-card-watch-1")).toBeInTheDocument())
      expect(document.getElementById("watch-card-watch-1")).not.toBeNull()
    })
  })

  // ══ ⭐ THE STOPPED CARD — what happened, and the ONE thing that fixes THAT cause ══
  describe("a stopped source says what happened and offers one control", () => {
    /**
     * ⭐ D-235-11 asserted as a LOOP over the whole table, not as four hand-written cases. A
     * new cause therefore needs a row in `CONTROL_FOR_CAUSE` and no edit here — which is the
     * property "the map is DATA, never a branch in the card" actually means.
     */
    const CAUSES = Object.keys(CONTROL_FOR_CAUSE) as SourceFailureCause[]

    it("the table it loops over is non-empty and carries all six causes", () => {
      // ⚠ RE-BASELINED 4 → 5 (plan 13, gap-closure round 1) — a THIRD non-vacuity pin on the
      //   cause union, found by running the wider suite rather than by reading the plan's file
      //   list, which named only the two pins in `sourceHealthVocabulary.test.ts`.
      // ⭐ AND THE RE-BASELINE IS THE ONLY EDIT THIS FILE NEEDED. The generated case for the
      //   fifth cause PASSED FIRST TIME against an unmodified `WatchedFoldersSection.tsx` —
      //   which is D-235-11 ("the map is DATA, never a branch in the card") demonstrated at the
      //   render level rather than asserted, and is worth more than the count itself.
      // ⚠ RE-BASELINED 5 → 6 (BUG-260912-01, 2026-09-12), and the sentence above held a
      //   SECOND time: the sixth cause's generated case passed first time against an
      //   unmodified card. Two independent demonstrations that the map is data.
      //   ⚠ It was found the same way — by running the wider suite, not by reading a file
      //     list. This pin is invisible from `sourceHealthVocabulary.test.ts`.
      expect(CAUSES).toHaveLength(6)
    })

    for (const cause of CAUSES) {
      it(`\`${cause}\` renders its own sentence and exactly one control`, async () => {
        mockListWatches.mockResolvedValue([SAMPLE_WATCHES[1]])
        render(
          <WatchedFoldersSection
            onNavigateToConnections={vi.fn()}
            stoppedSources={[{ ...STOPPED_TOKEN_REVOKED[0], cause }]}
          />,
        )

        await waitFor(() =>
          expect(screen.getByTestId("sources-stopped-sentence")).toBeInTheDocument(),
        )
        expect(screen.getAllByTestId("sources-stopped-sentence")).toHaveLength(1)
        expect(screen.getByTestId("sources-stopped-sentence")).toHaveTextContent(
          SENTENCE_FOR_CAUSE[cause]("Google Drive (Procurement)"),
        )

        const fixes = screen.getAllByTestId("sources-fix")
        expect(fixes).toHaveLength(1)
        expect(fixes[0]).toHaveTextContent(
          CONTROL_FOR_CAUSE[cause].label("Google Drive (Procurement)"),
        )
      })
    }

    it("`token_revoked`'s control navigates through `onNavigate`, never a page load", async () => {
      mockListWatches.mockResolvedValue([SAMPLE_WATCHES[1]])
      const onNavigate = vi.fn()
      render(
        <WatchedFoldersSection
          onNavigateToConnections={onNavigate}
          stoppedSources={STOPPED_TOKEN_REVOKED}
        />,
      )

      await waitFor(() => expect(screen.getByTestId("sources-fix")).toBeInTheDocument())
      await userEvent.click(screen.getByTestId("sources-fix"))
      expect(onNavigate).toHaveBeenCalledTimes(1)
    })

    it("⛔ with NO navigator the Reconnect control is ABSENT, not a dead click", async () => {
      mockListWatches.mockResolvedValue([SAMPLE_WATCHES[1]])
      render(<WatchedFoldersSection stoppedSources={STOPPED_TOKEN_REVOKED} />)

      await waitFor(() =>
        expect(screen.getByTestId("sources-stopped-sentence")).toBeInTheDocument(),
      )
      expect(screen.queryByTestId("sources-fix")).not.toBeInTheDocument()
    })

    it("`unreachable`'s control retries through the same sync path as Sync now", async () => {
      mockListWatches.mockResolvedValue([SAMPLE_WATCHES[1]])
      mockTriggerWatchSync.mockResolvedValue({
        status: "asked",
        message: "ok",
        next_check_within_seconds: 60,
      })
      render(
        <WatchedFoldersSection
          stoppedSources={[{ ...STOPPED_TOKEN_REVOKED[0], cause: "unreachable" }]}
        />,
      )

      await waitFor(() => expect(screen.getByTestId("sources-fix")).toBeInTheDocument())
      await userEvent.click(screen.getByTestId("sources-fix"))
      expect(mockTriggerWatchSync).toHaveBeenCalledWith("watch-2")
    })

    it("says when it last read successfully", async () => {
      mockListWatches.mockResolvedValue([SAMPLE_WATCHES[1]])
      render(<WatchedFoldersSection stoppedSources={STOPPED_TOKEN_REVOKED} />)

      await waitFor(() => expect(screen.getByTestId("sources-last-good")).toBeInTheDocument())
      expect(screen.getByTestId("sources-last-good")).toHaveTextContent(/Last read successfully/i)
    })

    /**
     * ⚠ `/sources/health` reads `last_good_at` over a FIVE-ROW window (plan 06), so a null
     * there does NOT mean "never succeeded". Claiming `neverRead` from that null would be an
     * invented fact.
     */
    it("⛔ a null `last_good_at` does NOT become 'it has never read'", async () => {
      mockListWatches.mockResolvedValue([SAMPLE_WATCHES[1]])
      render(
        <WatchedFoldersSection
          stoppedSources={[{ ...STOPPED_TOKEN_REVOKED[0], last_good_at: null }]}
        />,
      )

      await waitFor(() =>
        expect(screen.getByTestId("sources-stopped-sentence")).toBeInTheDocument(),
      )
      expect(screen.queryByTestId("sources-last-good")).not.toBeInTheDocument()
    })
  })

  // ══ ⭐ THE NAMED DEGRADED ROW (SEED-239 / D-235-13) ══════════════════════════════
  describe("an unreadable row is NAMED, never skipped", () => {
    it("renders a degraded row with its own sentence and the report control", async () => {
      mockListWatches.mockResolvedValue(
        only({ degraded: true, degraded_reason: "projection_failed:RuntimeError" }),
      )
      render(<WatchedFoldersSection />)

      await waitFor(() => expect(screen.getByTestId("sources-degraded")).toBeInTheDocument())
      expect(screen.getByTestId("sources-source-card")).toBeInTheDocument()
      expect(screen.getByTestId("sources-report-source")).toBeInTheDocument()
    })

    /**
     * ⚠ A degraded row's `item_count` / `connection_name` / `last_run_at` / `last_status` are
     * MODEL DEFAULTS, not measurements (plan 07). None of them may be rendered as fact.
     */
    it("⛔ renders NO outcome for a degraded row — its counts are defaults, not measurements", async () => {
      mockListWatches.mockResolvedValue(
        only({ degraded: true, item_count: 0, connection_name: null, last_status: "pending" }),
      )
      render(<WatchedFoldersSection />)

      await waitFor(() => expect(screen.getByTestId("sources-degraded")).toBeInTheDocument())
      expect(screen.queryByTestId("sources-outcome")).not.toBeInTheDocument()
    })
  })

  // ══ ⭐ D-235-12 — reader off is an INSTANCE fact, never a per-row accusation ══════
  it("⛔ with the reader off, no card is marked stopped or broken", async () => {
    mockListWatches.mockResolvedValue([
      { ...SAMPLE_WATCHES[0], id: "w-a" },
      { ...SAMPLE_WATCHES[0], id: "w-b" },
      { ...SAMPLE_WATCHES[0], id: "w-c" },
    ])
    render(<WatchedFoldersSection readerRunning={false} />)

    await waitFor(() => expect(screen.getAllByTestId("sources-source-line")).toHaveLength(3))
    expect(screen.queryByTestId("sources-stopped-sentence")).not.toBeInTheDocument()
    expect(screen.queryAllByTestId("sources-source-card")).toHaveLength(0)
    // The row says only what is true of the row: it is waiting, not broken.
    expect(screen.getAllByTestId("sources-state")[0]).toHaveTextContent(/waiting/i)
  })

  // ══ ⭐ PLAN 17 — THE FILES IT COULD NOT READ, AS THEY STAND NOW ══════════════════
  //
  // `SENTENCE_FOR_FILE_FAILURE` was written in plan 02, pinned by its own suite, and consumed
  // by NOTHING for the whole phase. `connector_watch_items` has carried each file's state and
  // name since migration 169, and `getWatch` has returned them since Phase 234 — so the reason
  // a file could not be read has been in the database all along and has never reached a person.
  //
  // ⛔ AND IT IS CURRENT STATE, NOT A RUN. An item carries ONE `state`, so a file that failed
  //    in two checks can only ever be attributed to the later one. The block therefore renders
  //    OUTSIDE the history, says so on the screen, and is asserted never to sit inside a run.
  describe("the files it could not read are named, scoped to how they stand NOW", () => {
    const PASSWORDED = item({
      id: "i-1",
      name: "Vendor NDA (signed).pdf",
      state: "failed",
      last_error: "The document is password-protected and could not be opened.",
    })

    /** Open the one healthy source's card. Variant B keeps it a line until asked. */
    async function openCard() {
      const user = userEvent.setup()
      await waitFor(() => expect(screen.getByTestId("sources-source-line")).toBeInTheDocument())
      await user.click(screen.getByTestId("sources-source-line").querySelector("button")!)
      return user
    }

    /**
     * ⭐ THE REASONS ARE DISCLOSED, NOT LED WITH (operator, 2026-09-09, during UAT row M-2).
     *
     * ⚠ THESE TESTS WERE EDITED, AND THE EDIT IS THE POINT RATHER THAN AN ANNOYANCE. This
     * project's own rule is that a pin needing an edit means behaviour changed — and here it
     * changed ON PURPOSE, on the operator's instruction: the row now opens with a count and
     * the per-file sentences sit one click behind it. Every assertion below is UNCHANGED; the
     * only thing added is the click that a person now makes. If any of them had had to be
     * WEAKENED, that would have been the failure.
     */
    async function revealFailures(user: ReturnType<typeof userEvent.setup>) {
      await waitFor(() =>
        expect(screen.getByTestId("sources-file-failure-summary")).toBeInTheDocument(),
      )
      await user.click(screen.getByTestId("sources-file-failure-summary"))
    }

    it("⭐ the row leads with a COUNT and the reasons wait for a click", async () => {
      /**
       * ⛔ THE OPERATOR ASKED FOR THIS AFTER SEEING THE OTHER SHAPE (2026-09-09, UAT row M-2):
       * *"in the watch folder menu we can just put like two files failed ... and if I clicked
       * I should see the reason"*. The section opened with a heading, a scope note and a
       * sentence per file, inside a place a person opens to learn whether a watch is healthy.
       *
       * ⚠ IT ASSERTS BOTH HALVES. A test that only checked the summary appears would stay
       * green if the list never collapsed at all — which is the state this change exists to
       * leave behind.
       */
      mockListWatches.mockResolvedValue(only({}))
      mockGetWatch.mockResolvedValue(detail([PASSWORDED, PASSWORDED]))
      render(<WatchedFoldersSection />)
      const user = await openCard()

      await waitFor(() =>
        expect(screen.getByTestId("sources-file-failure-summary")).toBeInTheDocument(),
      )
      expect(screen.getByTestId("sources-file-failure-summary")).toHaveTextContent(
        "2 files could not be read",
      )
      expect(screen.queryByTestId("sources-file-failure")).not.toBeInTheDocument()
      expect(screen.queryByTestId("sources-file-failure-scope")).not.toBeInTheDocument()

      await user.click(screen.getByTestId("sources-file-failure-summary"))
      expect(screen.getAllByTestId("sources-file-failure").length).toBeGreaterThan(0)
      expect(screen.getByTestId("sources-file-failure-scope")).toBeInTheDocument()
    })

    it("⭐ names the FILE and prints its own sentence — the orphan is mounted", async () => {
      mockListWatches.mockResolvedValue(only({}))
      mockGetWatch.mockResolvedValue(detail([PASSWORDED]))
      render(<WatchedFoldersSection />)
      const user = await openCard()
      await revealFailures(user)

      await waitFor(() => expect(screen.getByTestId("sources-file-failures")).toBeInTheDocument())
      const rows = screen.getAllByTestId("sources-file-failure")
      expect(rows).toHaveLength(1)
      // ⚠ CONTENT, not presence. The composition fence missed the original gap entirely
      //   because the right testids were present while rendering the wrong thing.
      expect(rows[0]).toHaveTextContent("Vendor NDA (signed).pdf")
      expect(rows[0]).toHaveTextContent(SENTENCE_FOR_FILE_FAILURE.password)
      expect(screen.getByText(FILE_FAILURE_HEADING)).toBeInTheDocument()
    })

    it("⭐ the scope note is ON THE SCREEN — its absence is what makes this surface honest", async () => {
      mockListWatches.mockResolvedValue(only({}))
      mockGetWatch.mockResolvedValue(detail([PASSWORDED]))
      render(<WatchedFoldersSection />)
      const user = await openCard()
      await revealFailures(user)

      await waitFor(() =>
        expect(screen.getByTestId("sources-file-failure-scope")).toBeInTheDocument(),
      )
      expect(screen.getByTestId("sources-file-failure-scope")).toHaveTextContent(
        FILE_FAILURE_SCOPE_NOTE,
      )
    })

    it("⛔ the block NEVER renders inside a run row, and never inside the history", async () => {
      mockListWatches.mockResolvedValue(only({}))
      mockGetWatch.mockResolvedValue(detail([PASSWORDED]))
      mockListSyncRuns.mockResolvedValue([
        {
          id: "run-1",
          watch_id: "watch-1",
          started_at: new Date(Date.now() - 4 * 60_000).toISOString(),
          finished_at: null,
          status: "failed",
          failure_cause: null,
          last_error: null,
          listing_complete: true,
          count_new: 0,
          count_modified: 0,
          count_renamed: 0,
          count_missing: 0,
          count_restored: 0,
          count_errors: 1,
        },
      ])
      render(<WatchedFoldersSection />)
      const user = await openCard()
      await user.click(screen.getByTestId("sources-toggle-history"))

      await waitFor(() => expect(screen.getByTestId("sources-file-failures")).toBeInTheDocument())
      const block = screen.getByTestId("sources-file-failures")
      // A run row is a per-CHECK claim; this list cannot make one. Structural, so a later
      // refactor cannot slide it into a run and silently re-acquire the false attribution.
      expect(block.closest('[data-testid="sources-run"]')).toBeNull()
      const history = document.querySelector('[data-testid="sources-history"]')
      expect(history).not.toBeNull()
      expect(history!.contains(block)).toBe(false)
    })

    it("⛔ an `unauthorized`-only source renders NO per-file block", async () => {
      // That writer marks EVERY item at once when the source loses access, so rendering it per
      // file would print one SOURCE-level truth N times, beside a stopped sentence that has
      // already said it once.
      mockListWatches.mockResolvedValue(only({}))
      mockGetWatch.mockResolvedValue(
        detail([
          item({ id: "u-1", state: "unauthorized" }),
          item({ id: "u-2", state: "unauthorized" }),
          item({ id: "u-3", state: "unauthorized" }),
        ]),
      )
      render(<WatchedFoldersSection />)
      await openCard()

      await waitFor(() => expect(mockGetWatch).toHaveBeenCalled())
      expect(screen.queryByTestId("sources-file-failures")).not.toBeInTheDocument()
    })

    it("⛔ a provider-shaped item error never reaches the DOM (T-235c-11)", async () => {
      mockListWatches.mockResolvedValue(only({}))
      mockGetWatch.mockResolvedValue(
        detail([
          item({
            id: "leak-1",
            name: "Quarterly board pack.pdf",
            state: "failed",
            last_error:
              'a driver failure at https://drive.example/files/x?token=ya29.SECRET {"code": 403, "message": "insufficient scopes"}',
          }),
        ]),
      )
      render(<WatchedFoldersSection />)
      const user = await openCard()
      await revealFailures(user)

      await waitFor(() => expect(screen.getByTestId("sources-file-failures")).toBeInTheDocument())
      const text = document.body.textContent ?? ""
      expect(text).toContain("Quarterly board pack.pdf")
      expect(text).not.toContain("https://")
      expect(text).not.toContain("ya29")
      expect(text).not.toContain('"code": 403')
      expect(text).not.toContain("insufficient scopes")
      // Unrecognised ⇒ the honest fallback, never a guessed reason.
      expect(screen.getByTestId("sources-file-failure")).toHaveTextContent(
        SENTENCE_FOR_FILE_FAILURE.unknown,
      )
    })

    it("⛔ `present` and `missing` are not failures — the block renders NOTHING", async () => {
      mockListWatches.mockResolvedValue(only({}))
      mockGetWatch.mockResolvedValue(
        detail([item({ id: "p-1" }), item({ id: "m-1", state: "missing" })]),
      )
      render(<WatchedFoldersSection />)
      await openCard()

      await waitFor(() => expect(mockGetWatch).toHaveBeenCalled())
      expect(screen.queryByTestId("sources-file-failures")).not.toBeInTheDocument()
      // ⛔ No heading, no empty state. This is not the source's own attention state.
      expect(screen.queryByText(FILE_FAILURE_HEADING)).not.toBeInTheDocument()
    })

    it("a size skip reads as the too_big sentence", async () => {
      mockListWatches.mockResolvedValue(only({}))
      mockGetWatch.mockResolvedValue(
        detail([item({ id: "big-1", name: "Site survey scans.pdf", state: "skipped_size" })]),
      )
      render(<WatchedFoldersSection />)
      const user = await openCard()
      await revealFailures(user)

      await waitFor(() => expect(screen.getByTestId("sources-file-failure")).toBeInTheDocument())
      expect(screen.getByTestId("sources-file-failure")).toHaveTextContent(
        SENTENCE_FOR_FILE_FAILURE.too_big,
      )
    })

    it("shows five and counts the remainder", async () => {
      mockListWatches.mockResolvedValue(only({}))
      mockGetWatch.mockResolvedValue(
        detail(
          Array.from({ length: 8 }, (_, i) =>
            item({ id: `f-${i}`, name: `report-${i}.pdf`, state: "failed" }),
          ),
        ),
      )
      render(<WatchedFoldersSection />)
      const user = await openCard()
      await revealFailures(user)

      await waitFor(() => expect(screen.getByTestId("sources-file-failures")).toBeInTheDocument())
      expect(screen.getAllByTestId("sources-file-failure")).toHaveLength(5)
      expect(screen.getByTestId("sources-file-failure-more")).toHaveTextContent(
        FILE_FAILURE_MORE(3),
      )
    })

    it("asks ONCE per expanded card, and does not re-ask on collapse and re-open", async () => {
      mockListWatches.mockResolvedValue(only({}))
      mockGetWatch.mockResolvedValue(detail([PASSWORDED]))
      render(<WatchedFoldersSection />)
      const user = await openCard()

      await waitFor(() => expect(mockGetWatch).toHaveBeenCalledWith("watch-1"))
      expect(mockGetWatch).toHaveBeenCalledTimes(1)

      await user.click(screen.getByTestId("sources-collapse"))
      await user.click(screen.getByTestId("sources-source-line").querySelector("button")!)
      expect(mockGetWatch).toHaveBeenCalledTimes(1)
    })

    it("⛔ does NOT ask while the source is a closed line — a healthy list costs nothing", async () => {
      mockListWatches.mockResolvedValue(only({}))
      render(<WatchedFoldersSection />)

      await waitFor(() => expect(screen.getByTestId("sources-source-line")).toBeInTheDocument())
      expect(mockGetWatch).not.toHaveBeenCalled()
    })

    it("a stopped card asks WITHOUT being opened — a stopped card never collapses", async () => {
      mockListWatches.mockResolvedValue([SAMPLE_WATCHES[1]])
      mockGetWatch.mockResolvedValue(detail([PASSWORDED], SAMPLE_WATCHES[1]))
      render(<WatchedFoldersSection stoppedSources={STOPPED_TOKEN_REVOKED} />)

      await waitFor(() => expect(mockGetWatch).toHaveBeenCalledWith("watch-2"))
    })

    it("⛔ a rejected fetch renders nothing and leaves the rest of the card intact", async () => {
      mockListWatches.mockResolvedValue(only({}))
      mockGetWatch.mockRejectedValue(new Error("the mirror could not be read"))
      render(<WatchedFoldersSection />)
      await openCard()

      await waitFor(() => expect(mockGetWatch).toHaveBeenCalled())
      expect(screen.queryByTestId("sources-file-failures")).not.toBeInTheDocument()
      // Fail-quiet: the card's own sentences are untouched.
      expect(screen.getByTestId("sources-source-card")).toBeInTheDocument()
      expect(screen.getByTestId("sources-outcome")).toBeInTheDocument()
      expect(screen.queryByText(/mirror could not be read/i)).not.toBeInTheDocument()
    })
  })

  // ══ SOURCE FENCES — properties of the SHIPPED file, read as text ═════════════════
  describe("the invariants a later edit must not break", () => {
    it("⛔ the raw `last_error` is only ever handed to the vocabulary leaf", () => {
      // ⚠ WIDENED BY PLAN 17, deliberately and with the reason recorded rather than by
      //   loosening the regex to nothing. `fileFailureKind` is the SAME leaf, and its whole
      //   return type is a three-value key — a message cannot survive it. The render-level
      //   proof that nothing leaks is the planted-URL case above, not this grep.
      const codeHits = watchedFoldersSource
        .split("\n")
        .filter((line: string) => !line.trim().startsWith("*") && line.includes("last_error"))
      expect(codeHits.length).toBeGreaterThan(0) // non-vacuity
      for (const line of codeHits) {
        expect(line).toMatch(
          /(classifySourceFailure|sourceFailureSentence)\(\s*watch\.last_error|fileFailureKind\(\s*item\.state,\s*item\.last_error/,
        )
      }
    })

    it("⛔ the scope note ships WITH the block — a silent list would overclaim", () => {
      // ⭐ The licence for this surface to exist. If a later edit removes the note but keeps
      //   the list, THIS reds — the rendered case above proves it is drawn, and this proves
      //   the two cannot be separated by an edit that only touches markup.
      // ⛔ RESTORED TO A TIGHT WINDOW, AND THE RELAXATION IS THE FINDING (code review WR-08).
      //    The disclosure commit widened this 800 → 2600 — a 3.25× relaxation of the only
      //    structural guarantee that the scope note lives INSIDE the failures block — in the
      //    same diff whose new docstring says "if any of them had had to be WEAKENED, that
      //    would have been the failure." It had been, by me, in that commit.
      // ⭐ The window did not need to grow: almost all of the new distance was COMMENT PROSE,
      //    which the fence never stripped. Stripping comments first (the shape
      //    `RunHistoryList.test.tsx` already uses) restores a bound near the original AND
      //    makes it stronger than before, because a comment can no longer pad the gap.
      const code = watchedFoldersSource
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
      expect(code).toContain("sources-file-failures") // non-vacuity
      // ⚠ 1300, MEASURED — not guessed and not flattering. The comment-stripped distance is
      //   1249 characters of genuine JSX (the disclosure button), against 1679 raw. So the
      //   real relaxation this commit needed was ~1300, and 2600 was twice what the change
      //   actually cost. The bound is now the code, and a comment can no longer pad it.
      expect(code).toMatch(/sources-file-failures[\s\S]{0,1300}?FILE_FAILURE_SCOPE_NOTE/)
    })

    it("⛔ no per-file row is built with raw HTML", () => {
      // T-235c-12 — a hostile external FILE NAME is rendered as a text child and React escapes
      // it. Nothing in this file may opt out of that.
      expect(watchedFoldersSource).not.toContain("dangerouslySetInnerHTML")
    })

    it("⛔ no full page load survives — this app has no router (SEED-185)", () => {
      expect(watchedFoldersSource).toContain("onNavigateToConnections") // non-vacuity
      expect(watchedFoldersSource).not.toContain("window.location")
    })

    it("⛔ the alarm token is never applied to a source state", () => {
      expect(watchedFoldersSource).toContain("last_status") // the anchor
      expect(watchedFoldersSource).not.toMatch(
        /last_status\s*===\s*"failed"[\s\S]{0,200}?destructive/,
      )
    })
  })

  // ══ LIFECYCLE ACTIONS — Phase 234's, carried forward onto the opened card ════════
  it("triggers sync now on user action", async () => {
    mockListWatches.mockResolvedValue(SAMPLE_WATCHES)
    mockTriggerWatchSync.mockResolvedValue({
      status: "asked",
      message: "ok",
      next_check_within_seconds: 60,
    })
    render(<WatchedFoldersSection />)
    const user = userEvent.setup()

    await waitFor(() => expect(screen.getByText("Q3 Vendor Bills")).toBeInTheDocument())
    // ⚠ Variant B: the healthy source's toolbar lives behind its one line.
    await user.click(screen.getAllByTestId("sources-source-line")[0].querySelector("button")!)
    await user.click(screen.getAllByTestId("sources-sync-now")[0])

    expect(mockTriggerWatchSync).toHaveBeenCalledWith("watch-1")
  })

  it("triggers purge missing files on user action (VIS-05 / SC#3)", async () => {
    mockListWatches.mockResolvedValue(SAMPLE_WATCHES)
    mockPurgeWatchFiles.mockResolvedValue({ status: "ok", purged_count: 2, message: "Purged 2 files." })
    render(<WatchedFoldersSection />)
    const user = userEvent.setup()

    await waitFor(() => expect(screen.getByText("Q3 Vendor Bills")).toBeInTheDocument())
    await user.click(screen.getAllByTestId("sources-source-line")[0].querySelector("button")!)
    await user.click(screen.getAllByRole("button", { name: /purge missing files/i })[0])

    expect(mockPurgeWatchFiles).toHaveBeenCalledWith("watch-1")
  })

  it("triggers watch deletion on user action", async () => {
    mockListWatches.mockResolvedValue(SAMPLE_WATCHES)
    mockDeleteWatch.mockResolvedValue(undefined)
    render(<WatchedFoldersSection />)
    const user = userEvent.setup()

    await waitFor(() => expect(screen.getByText("Q3 Vendor Bills")).toBeInTheDocument())
    await user.click(screen.getAllByTestId("sources-source-line")[0].querySelector("button")!)
    await user.click(screen.getAllByRole("button", { name: /delete watch/i })[0])

    expect(mockDeleteWatch).toHaveBeenCalledWith("watch-1")
  })

  it("toggles pause and resume on user action", async () => {
    mockListWatches.mockResolvedValue(SAMPLE_WATCHES)
    mockUpdateWatch.mockResolvedValue({ ...SAMPLE_WATCHES[0], is_active: false })
    render(<WatchedFoldersSection />)
    const user = userEvent.setup()

    await waitFor(() => expect(screen.getByText("Q3 Vendor Bills")).toBeInTheDocument())
    await user.click(screen.getAllByTestId("sources-source-line")[0].querySelector("button")!)
    await user.click(screen.getAllByTitle(/pause watch/i)[0])

    expect(mockUpdateWatch).toHaveBeenCalledWith("watch-1", { is_active: false })
  })
})
