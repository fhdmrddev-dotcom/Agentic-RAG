/**
 * Quick task (SC#2 · LIB-10 · D-235-11) — THE ONE CONTROL MUST RENDER, AND MUST ACT.
 *
 * ── ⛔ THE DEFECT THIS PINS, AND WHY EVERY OTHER SUITE MISSED IT ────────────────────
 *
 * Phase 235 shipped the cause→control map as correct DATA and **no user could press it**.
 * `WatchedFoldersSection` gates the button on
 *
 *     canReconnect = Boolean(onNavigateToConnections)
 *     showFix      = control.action !== "reconnect" || canReconnect
 *
 * …and nothing in the mount chain passed `onNavigateToConnections`. `LibraryPage` had
 * `onNavigate` and forwarded it to `IndexingTab` only; `IngestionTab` neither accepted nor
 * relayed it. So EVERY reconnect-shaped cause — `token_revoked` and `connection_disabled`,
 * the two HARD causes that stop a source on the FIRST failure — rendered a stopped sentence
 * with no button beside it. SC#2's word is *fixes*, and nothing fixed anything.
 *
 * ⚠ **`WatchedFoldersSection.test.tsx` could not catch this**: it mounts the component
 * DIRECTLY and passes `onNavigateToConnections` itself, so the gate was always satisfied
 * there. The prop chain is only observable from the TAB up. That is the whole reason this
 * file mounts `IngestionTab` rather than adding cases one level down.
 *
 * ⚠ **The composition fence could not catch it either** — it asserts `sources-fix` is
 * PRESENT by testid, and in every fixture it drives the prop IS passed. Presence assertions
 * cannot see a prop that is absent only in the real tree.
 *
 * ── ⛔ `@/lib/api/sources` IS MOCKED SEPARATELY ─────────────────────────────────────
 * It is not in the `@/lib/api` barrel, and the factory must declare `listSyncRuns` and
 * `getSourceHealth` or the mount throws about a missing export instead of about the thing
 * under test (Phase 196-08's nine-suite failure mode).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Document } from "@/types"

import { CONTROL_FOR_CAUSE } from "@/components/sources/sourceHealthVocabulary"

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
  getWatch: vi.fn().mockResolvedValue({ items: [] }),
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

const WATCH_ID = "w-stopped"

const STOPPED_WATCH = {
  id: WATCH_ID,
  user_id: "user-1",
  connection_id: "conn-1",
  connection_name: "Google Drive (Finance)",
  service_id: "google",
  source_folder_id: "src-1",
  source_folder_name: "Finance",
  library_folder_id: null,
  interval_minutes: 30,
  is_active: true,
  last_run_at: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  last_status: "failed",
  item_count: 6,
}

const defaultProps = {
  documents: [] as Document[],
  upload: vi.fn(),
  uploading: false,
  uploadingCount: 0,
}

/** A stopped verdict for one HARD, reconnect-shaped cause. */
function stoppedVerdict(cause: string) {
  return {
    stopped: [
      {
        watch_id: WATCH_ID,
        cause,
        stopped_since: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        last_good_at: new Date(Date.now() - 4 * 86_400_000).toISOString(),
        connection_name: "Google Drive (Finance)",
        source_folder_name: "Finance",
      },
    ],
    reader_running: true,
    poll_interval_seconds: 60,
  }
}

describe("IngestionTab — the one control renders and acts (SC#2)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListWatches.mockResolvedValue([STOPPED_WATCH])
  })

  afterEach(cleanup)

  /**
   * ⭐ NON-VACUITY FIRST. If the stopped source never renders, every assertion below would
   * pass over nothing — the failure mode that let a green fence coexist with this defect.
   */
  it("the harness works — a stopped source really does render its sentence", async () => {
    mockGetSourceHealth.mockResolvedValue(stoppedVerdict("token_revoked"))
    render(<IngestionTab {...defaultProps} onNavigateToConnections={vi.fn()} />)

    await waitFor(() =>
      expect(screen.getByTestId("sources-stopped-sentence")).toBeInTheDocument(),
    )
  })

  /**
   * ⛔ THE REGRESSION ITSELF. Without the prop the button is absent — this case is what makes
   * the two below meaningful, and it fails if someone ever ungates `showFix`.
   */
  it("⛔ WITHOUT onNavigateToConnections the reconnect control does NOT render", async () => {
    mockGetSourceHealth.mockResolvedValue(stoppedVerdict("token_revoked"))
    render(<IngestionTab {...defaultProps} />)

    await waitFor(() =>
      expect(screen.getByTestId("sources-stopped-sentence")).toBeInTheDocument(),
    )
    expect(screen.queryByTestId("sources-fix")).not.toBeInTheDocument()
  })

  it.each(["token_revoked", "connection_disabled"])(
    "⭐ %s — the control RENDERS when the tab is given its navigator",
    async (cause) => {
      mockGetSourceHealth.mockResolvedValue(stoppedVerdict(cause))
      render(<IngestionTab {...defaultProps} onNavigateToConnections={vi.fn()} />)

      const fix = await screen.findByTestId("sources-fix")
      expect(fix).toBeInTheDocument()
      // The LABEL comes from the map, not from this suite — a new cause needs no edit here.
      expect(fix).toHaveTextContent(
        CONTROL_FOR_CAUSE[cause as keyof typeof CONTROL_FOR_CAUSE].label(
          "Google Drive (Finance)",
        ),
      )
    },
  )

  /**
   * ⭐ RENDERS is not ENOUGH — SC#2's word is *fixes*. A button that appears and does nothing
   * satisfies a presence assertion and not the requirement.
   */
  it("⭐ pressing it ACTS — the navigator is called exactly once", async () => {
    const onNavigateToConnections = vi.fn()
    mockGetSourceHealth.mockResolvedValue(stoppedVerdict("token_revoked"))
    render(
      <IngestionTab {...defaultProps} onNavigateToConnections={onNavigateToConnections} />,
    )

    await userEvent.click(await screen.findByTestId("sources-fix"))
    expect(onNavigateToConnections).toHaveBeenCalledTimes(1)
  })
})

/**
 * ⭐⭐ THE LINK THE CASES ABOVE CANNOT SEE — AND IT IS THE ONE THAT ACTUALLY BROKE.
 *
 * Every case above mounts `IngestionTab` and hands it the navigator itself, so they cover
 * `IngestionTab → WatchedFoldersSection` and are BLIND to `LibraryPage → IngestionTab`.
 * That was measured, not assumed: deleting the `IngestionTab` forward turned 3 of 5 red,
 * and deleting the `LibraryPage` forward left all 5 GREEN — while the button vanished from
 * the real product. The production defect was the link the behaviour suite could not reach.
 *
 * Mounting `LibraryPage` here would drag in folders, documents, realtime and five tab bodies
 * to assert one prop, so this is a SOURCE FENCE instead — the shipped `?raw` idiom. It is
 * weaker than a render (it reads text, not behaviour) and it is the right strength for a
 * wiring link that has exactly one correct spelling.
 */
describe("LibraryPage forwards the navigator into IngestionTab (the unreachable link)", () => {
  it("⛔ LibraryPage passes onNavigateToConnections to IngestionTab", async () => {
    const src = (await import("@/pages/LibraryPage.tsx?raw")).default as string

    // Non-vacuity: prove we actually read the file and found the mount, so the assertion
    // below cannot pass over an empty string or a moved import.
    expect(src.length).toBeGreaterThan(2000)
    expect(src).toContain("<IngestionTab")

    expect(src).toContain("onNavigateToConnections=")
    // …and that it is wired to the page's own navigator rather than a stub.
    expect(src).toMatch(/onNavigateToConnections=\{[^}]*onNavigate[^}]*\}/)
  })
})
