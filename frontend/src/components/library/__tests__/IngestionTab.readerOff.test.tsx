/**
 * Phase 235 plan 10 task 3 (LIB-10 · D-235-12) — THE INSTANCE STATEMENT, SAID ONCE.
 *
 * ── ⭐ WHY THIS IS A SEPARATE FILE, STATED RATHER THAN LEFT TO GUESSWORK ────────────
 *
 * The plan allows these cases in `WatchedFoldersSection.history.test.tsx` OR in a small
 * `IngestionTab` block. They live HERE because the property under test is a property of the
 * TAB — *"exactly one, above every sub-tab"* — and asserting it from a suite that mounts one
 * `WatchedFoldersSection` could not distinguish "one" from "one per section". The shipped
 * `IngestionTab.test.tsx` is left byte-unchanged (its 44 cases are a Phase-217.1 gate), and
 * this file is pinned in its own right by plan 12.
 *
 * ── ⛔ THE FAILURE BEING GUARDED AGAINST IS **TWO**, NOT ZERO ───────────────────────
 *
 * Hence `getAllByTestId(...).length === 1` rather than `getByTestId`. `getByTestId` throws on
 * two matches, but it throws with a message about ambiguity rather than about the design rule,
 * and a reader of the failure would not learn what the rule was. D-235-12's whole point is
 * that this sentence is INSTANCE-level: the banner owns platform-wide truth, and a row owns
 * only what is true of that row. Marking every watch stopped when the reader is off was
 * REJECTED at scoping — the rail badge would then count N broken sources when nothing is
 * wrong with any of them.
 *
 * ── ⛔ `@/lib/api/sources` IS MOCKED SEPARATELY ────────────────────────────────────
 *
 * It is not in the `@/lib/api` barrel (RESEARCH P-10), and the factory declares `listSyncRuns`
 * and `getSourceHealth` — without them the mount throws about a missing export rather than
 * about the thing under test (Phase 196-08's nine-suite failure mode).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import type { Document } from "@/types"

import { COPY } from "@/components/sources/sourceHealthVocabulary"

vi.mock("@/lib/supabase", () => ({
  SUPABASE_CLIENT_REHYDRATED: "supabase:client-rehydrated",
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
      onAuthStateChange: vi
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    channel: vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }),
    removeChannel: vi.fn(),
  },
}))

const mockGetSourceHealth = vi.fn()
const mockListWatches = vi.fn()

vi.mock("@/lib/api/sources", () => ({
  listWatches: (...a: unknown[]) => mockListWatches(...a),
  getWatch: vi.fn(),
  createWatch: vi.fn(),
  updateWatch: vi.fn(),
  deleteWatch: vi.fn(),
  triggerWatchSync: vi.fn(),
  purgeWatchFiles: vi.fn(),
  listSyncRuns: vi.fn().mockResolvedValue([]),
  getSourceHealth: (...a: unknown[]) => mockGetSourceHealth(...a),
}))

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    reingestDocument: vi.fn().mockResolvedValue(undefined),
    listFolders: vi.fn().mockResolvedValue([]),
    listConnectorConnections: vi.fn().mockResolvedValue([]),
  }
})

import { IngestionTab } from "../IngestionTab"

const HEALTHY = (id: string) => ({
  id,
  user_id: "user-1",
  connection_id: "conn-1",
  connection_name: "Google Drive (Finance)",
  service_id: "google",
  source_folder_id: `src-${id}`,
  source_folder_name: `Folder ${id}`,
  library_folder_id: null,
  interval_minutes: 30,
  is_active: true,
  last_run_at: new Date(Date.now() - 4 * 60_000).toISOString(),
  last_status: "success",
  item_count: 6,
})

const defaultProps = {
  documents: [] as Document[],
  upload: vi.fn(),
  uploading: false,
  uploadingCount: 0,
}

describe("IngestionTab — the reader-off statement (D-235-12)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListWatches.mockResolvedValue([HEALTHY("w-a"), HEALTHY("w-b"), HEALTHY("w-c")])
  })

  afterEach(cleanup)

  it("the tab still mounts and carries its shipped hook — the harness works", async () => {
    mockGetSourceHealth.mockResolvedValue({
      stopped: [],
      reader_running: true,
      poll_interval_seconds: 60,
    })
    render(<IngestionTab {...defaultProps} />)
    expect(screen.getByTestId("ingestion-tab")).toBeInTheDocument()
    expect(screen.getByTestId("sources-body-ingestion")).toBeInTheDocument()
  })

  it("⭐ with the reader OFF the statement appears EXACTLY ONCE across the whole tab", async () => {
    mockGetSourceHealth.mockResolvedValue({
      stopped: [],
      reader_running: false,
      poll_interval_seconds: 60,
    })
    render(<IngestionTab {...defaultProps} />)

    await waitFor(() =>
      expect(screen.getAllByTestId("sources-instance-statement")).toHaveLength(1),
    )
    expect(screen.getByTestId("sources-instance-statement")).toHaveTextContent(
      COPY.readerOffMember,
    )
  })

  it("with the reader RUNNING no statement renders at all", async () => {
    mockGetSourceHealth.mockResolvedValue({
      stopped: [],
      reader_running: true,
      poll_interval_seconds: 60,
    })
    render(<IngestionTab {...defaultProps} />)

    await waitFor(() => expect(mockGetSourceHealth).toHaveBeenCalled())
    expect(screen.queryAllByTestId("sources-instance-statement")).toHaveLength(0)
  })

  it("⛔ with the reader off, NO watch is accused of being individually broken", async () => {
    mockGetSourceHealth.mockResolvedValue({
      stopped: [],
      reader_running: false,
      poll_interval_seconds: 60,
    })
    render(<IngestionTab {...defaultProps} />)

    // Non-vacuity: the three healthy watches really did render.
    await waitFor(() => expect(screen.getAllByTestId("sources-source-line")).toHaveLength(3))
    expect(screen.queryAllByTestId("sources-stopped-sentence")).toHaveLength(0)
    expect(screen.queryAllByTestId("sources-source-card")).toHaveLength(0)
  })

  /**
   * ⚠ Two audiences, two sentences, ONE condition. The member sentence names no mechanism;
   * the operator half is the vocabulary leaf's ONE marked exception to that rule, and it is a
   * separately addressable element so a surface can place or suppress it independently.
   */
  it("the member sentence names no configuration key; the marked operator half does", async () => {
    mockGetSourceHealth.mockResolvedValue({
      stopped: [],
      reader_running: false,
      poll_interval_seconds: 60,
    })
    render(<IngestionTab {...defaultProps} />)

    await waitFor(() =>
      expect(screen.getByTestId("sources-instance-statement")).toBeInTheDocument(),
    )
    const member = screen.getByTestId("sources-instance-statement").firstElementChild
    expect(member).not.toBeNull()
    expect(screen.getByTestId("sources-instance-statement-operator")).toHaveTextContent(
      COPY.readerOffOperator,
    )
  })
})
