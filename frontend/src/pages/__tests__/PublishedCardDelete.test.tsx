/**
 * Phase 152 Plan 04 Task 3 (WFIN-03 / D-LOCK-03/04/05) — PublishedCard delete contract.
 *
 * The deterministic frontend backstop for the net-new delete surface. It renders the
 * LIVE WorkflowsPage (PublishedCard is internal to it), opens the net-new ⋯-menu off a
 * published card, and pins the victim-naming Sheet's honesty + lifecycle:
 *
 *   1. ⋯ → "Delete workflow…" opens the Sheet and fetches getWorkflowDeletePreview for
 *      THIS workflow's definition id (never a guess — D-LOCK-03).
 *   2. the sheet renders the EXACT mocked counts (Removed group + Kept reassurance),
 *      including the always-rendered 0-threads variant ("No chat threads to keep.").
 *   3. the amber cancel-first banner shows ONLY when the preview reports a live run
 *      (in_flight > 0 — D-LOCK-05).
 *   4. Delete forever calls deleteWorkflowCascade and drives the in-place Deleting… →
 *      Deleted · recorded lifecycle with NO optimistic card removal (D-LOCK-04, no undo).
 *   5. a rejected cascade surfaces "Couldn't delete the workflow" + a Try again control.
 *
 * api.ts is mocked; NO network is hit. The LIVE destructive UAT (real DB counts,
 * cancel-first, no orphans) is the row in 152-VALIDATION.md — NOT duplicated here.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, waitFor, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const {
  mockListPublished,
  mockListDrafts,
  mockCreateDraft,
  mockGenerate,
  mockUpdate,
  mockPublish,
  mockListFolders,
  mockListSkills,
  mockListStarters,
  mockPreview,
  mockDelete,
} = vi.hoisted(() => ({
  mockListPublished: vi.fn(),
  mockListDrafts: vi.fn(),
  mockCreateDraft: vi.fn(),
  mockGenerate: vi.fn(),
  mockUpdate: vi.fn(),
  mockPublish: vi.fn(),
  mockListFolders: vi.fn(),
  mockListSkills: vi.fn(),
  mockListStarters: vi.fn(),
  mockPreview: vi.fn(),
  mockDelete: vi.fn(),
}))

// Mock the api seam (the WorkflowsPage.test harness set + the two 152-04 delete clients).
vi.mock("@/lib/api", () => ({
  listPublishedWorkflows: mockListPublished,
  listDraftWorkflows: mockListDrafts,
  createWorkflowDraft: mockCreateDraft,
  generateWorkflow: mockGenerate,
  updateWorkflowDraft: mockUpdate,
  publishWorkflow: mockPublish,
  listFolders: mockListFolders,
  listSkills: mockListSkills,
  listStarterWorkflows: mockListStarters,
  getWorkflowDeletePreview: mockPreview,
  deleteWorkflowCascade: mockDelete,
}))

import { WorkflowsPage } from "../WorkflowsPage"
import type { Folder } from "@/types"

const folders: Folder[] = [
  { id: "folder-aaa", user_id: "u1", name: "DBA Chapters", parent_id: null, is_org_shared: false, created_at: "", updated_at: "" },
]

/** One published workflow — its `id` (pub-1) is the definition id the preview + cascade
 *  clients must be called with (owner-gated server-side). */
const boundPublished = {
  id: "pub-1",
  slug: "vendor-risk",
  name: "Vendor-risk review",
  definition: {
    slug: "vendor-risk",
    version: 2,
    project_folder_id: "folder-aaa",
    inputs: [{ key: "kickoff_prompt" }],
    phases: [{ slug: "emit", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "draft" } }],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  // Radix DropdownMenu uses pointer-capture + scrollIntoView APIs jsdom does not
  // implement; stub them so the ⋯-menu opens under user-event (the standard shim).
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
  mockListPublished.mockResolvedValue([boundPublished])
  mockListDrafts.mockResolvedValue([])
  mockListStarters.mockResolvedValue([])
  mockListFolders.mockResolvedValue(folders)
  mockListSkills.mockResolvedValue([])
})

/** Render the page, open the ⋯-menu on the first published card, click "Delete
 *  workflow…", and return the opened victim-naming Sheet (role="dialog"). */
async function openDeleteSheet() {
  const user = userEvent.setup()
  render(<WorkflowsPage folders={folders} onLaunch={vi.fn().mockResolvedValue(undefined)} />)
  const cards = await screen.findAllByTestId("published-card")
  await user.click(within(cards[0]).getByRole("button", { name: /workflow actions/i }))
  await user.click(await screen.findByTestId("published-delete"))
  const dialog = await screen.findByRole("dialog")
  return { user, dialog }
}

describe("PublishedCard delete (WFIN-03) — victim-naming sheet + exact counts", () => {
  it("⋯ → Delete opens the sheet and fetches the preview for THIS workflow's id", async () => {
    mockPreview.mockResolvedValue({ name: "Vendor-risk review", versions: 2, runs: 5, threads: 3, in_flight: 0 })
    const { dialog } = await openDeleteSheet()
    expect(within(dialog).getByText("Delete this workflow?")).toBeInTheDocument()
    // The counts come from the server preview keyed by the definition id — never guessed.
    expect(mockPreview).toHaveBeenCalledWith("pub-1")
  })

  it("renders the EXACT server counts + the Kept reassurance", async () => {
    mockPreview.mockResolvedValue({ name: "Vendor-risk review", versions: 2, runs: 5, threads: 3, in_flight: 0 })
    const { dialog } = await openDeleteSheet()
    await within(dialog).findByText("Permanently removed")
    await waitFor(() => {
      expect(dialog).toHaveTextContent("Vendor-risk review")
      expect(dialog).toHaveTextContent("2 versions")
      expect(dialog).toHaveTextContent("5 run records")
    })
    expect(dialog).toHaveTextContent("3 chat threads become normal chats")
    expect(dialog).toHaveTextContent("Your knowledge base is untouched.")
    // The audit-receipt honesty footer always renders.
    expect(dialog).toHaveTextContent("Recorded with your name in the audit log.")
  })

  it("the Kept sentence ALWAYS renders — the 0-threads variant reads 'No chat threads to keep.'", async () => {
    mockPreview.mockResolvedValue({ name: "Vendor-risk review", versions: 1, runs: 0, threads: 0, in_flight: 0 })
    const { dialog } = await openDeleteSheet()
    expect(await within(dialog).findByText("No chat threads to keep.")).toBeInTheDocument()
    expect(dialog).not.toHaveTextContent("become normal chats")
  })
})

describe("PublishedCard delete — amber cancel-first banner (D-LOCK-05)", () => {
  it("hides the banner when the preview reports NO live run", async () => {
    mockPreview.mockResolvedValue({ name: "Vendor-risk review", versions: 2, runs: 5, threads: 3, in_flight: 0 })
    const { dialog } = await openDeleteSheet()
    await within(dialog).findByText("Permanently removed")
    expect(within(dialog).queryByTestId("delete-inflight-banner")).not.toBeInTheDocument()
  })

  it("shows the amber banner ONLY when the preview reports a live run", async () => {
    mockPreview.mockResolvedValue({ name: "Vendor-risk review", versions: 2, runs: 5, threads: 3, in_flight: 1 })
    const { dialog } = await openDeleteSheet()
    const banner = await within(dialog).findByTestId("delete-inflight-banner")
    expect(banner).toHaveTextContent("still in progress")
  })
})

describe("PublishedCard delete — in-place lifecycle (D-LOCK-04, no undo)", () => {
  it("Delete forever calls the cascade + drives Deleting… → Deleted · recorded with NO optimistic removal", async () => {
    mockPreview.mockResolvedValue({ name: "Vendor-risk review", versions: 2, runs: 5, threads: 3, in_flight: 0 })
    // A deferred cascade so the in-flight "Deleting…" terminal is observable before resolve.
    let resolveDelete!: () => void
    mockDelete.mockReturnValue(new Promise<void>((r) => { resolveDelete = () => r() }))

    const { user, dialog } = await openDeleteSheet()
    await within(dialog).findByText("Permanently removed")
    await user.click(within(dialog).getByTestId("delete-forever"))

    // In flight: the honest Deleting… state, the server round-trip fired for THIS id…
    expect(await within(dialog).findByText(/Deleting/)).toBeInTheDocument()
    expect(mockDelete).toHaveBeenCalledWith("pub-1")
    // …and the card is NOT optimistically removed while the delete is pending.
    expect(screen.getByTestId("published-card")).toBeInTheDocument()

    // Server confirms → the recorded terminal (the card leaves the list only on re-fetch).
    resolveDelete()
    await waitFor(() => expect(dialog).toHaveTextContent("Deleted · recorded"))
  })

  it("a rejected cascade surfaces the honest error + a Try again control", async () => {
    mockPreview.mockResolvedValue({ name: "Vendor-risk review", versions: 2, runs: 5, threads: 3, in_flight: 0 })
    mockDelete.mockRejectedValue(new Error("boom"))

    const { user, dialog } = await openDeleteSheet()
    await within(dialog).findByText("Permanently removed")
    await user.click(within(dialog).getByTestId("delete-forever"))

    expect(await within(dialog).findByText(/Couldn.t delete the workflow/i)).toBeInTheDocument()
    expect(within(dialog).getByTestId("delete-retry")).toBeInTheDocument()
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
 * Phase 192 Plan 04 Task 1 (D-01) — THE PRE-MOVE CHARACTERIZATION BASELINE.
 *
 * WHY THIS BLOCK EXISTS. D-01 moves the WFIN-03 victim-naming delete Sheet
 * verbatim into `frontend/src/components/workflows/library/WorkflowDeleteSheet.tsx`.
 * The 188.1 lesson is binding: a characterization baseline only proves anything if
 * it PREDATES the change. This block was committed at
 *
 *     capture SHA = 14b309b4bd3b04ad5718caa821c24ddb613e2d3f
 *
 * at which commit
 *
 *     git show 14b309b4:frontend/src/components/workflows/library/WorkflowDeleteSheet.tsx
 *     → fatal: path '…' does not exist in 'HEAD'      (exit 128)
 *
 * That non-zero exit is the proof, and it is re-runnable rather than asserted.
 *
 * ── THE MEASURED EXTENT OF THE MOVE (read this before cutting anything) ──
 * The Sheet is NOT a self-contained JSX block. CONTEXT.md scopes it at `:872-1003`
 * (132 lines of JSX + its comment), and a cut of only that range reads self-contained
 * and is not: the block CLOSES OVER state declared ~100 lines above it, inside
 * `PublishedCard` — the component D-01 DELETES. Measured at the capture SHA with
 * `grep -n` over `frontend/src/pages/WorkflowsPage.tsx` (1407 L), FOUR spans move as
 * ONE unit:
 *
 *   :743        1 L    `type DeletePhase = "idle" | "deleting" | "deleted" | "error"`
 *   :756-759    4 L    the `onDeleted` prop + its D-LOCK-04 docblock on PublishedCard
 *   :768-799   32 L    `sheetOpen`/`preview`/`previewError`/`deletePhase` + `descId`
 *                      (:768-772), `openDeleteSheet` (:774-786, fetches the preview),
 *                      `handleDelete` (:788-799, cascade → onDeleted)
 *   :872-1003 132 L    the `<Sheet>` JSX (comment from :872, element from :877)
 *                      ─────
 *                       169 L
 *
 * ⚠ THE 169 IS RE-DERIVED HERE, NOT QUOTED. RESEARCH.md states "≈169" without its
 * span list; summing the three spans it names gives 165. The missing 4 are the
 * `onDeleted` prop + docblock at :756-759, which cannot stay behind either (it is the
 * D-LOCK-04 re-fetch seam). 1 + 4 + 32 + 132 = 169 — the figure reconciles exactly
 * once the fourth span is named. A later executor inherits the SPANS, not the number.
 *
 * ── THE WRAPPER IS THE ACCEPTED DELTA (PATTERNS § 2, from 188.2) ──
 * The moved bodies are JSX FRAGMENTS, not a whole component, so to live in a file of
 * their own they MUST acquire a component wrapper, a props destructure and a props
 * type. Byte-identity is chased for THE RENDERED DOM (this block) and for the JSX
 * element bodies + their comments — NEVER for the wrapper. A diff in the wrapper is
 * expected; a diff in the captures below is not.
 * ══════════════════════════════════════════════════════════════════════════════ */

/** The seven render states of the Sheet, declared ONCE so capture props and assertion
 *  props cannot drift apart (the `PhaseNodeCard.test.tsx:2597-2616` mechanism). */
type SheetState =
  | "loading"
  | "loadedZeroThreads"
  | "loadedInFlight"
  | "deleting"
  | "deleted"
  | "error"
  | "previewError"

const PREVIEW_ZERO = { name: "Vendor-risk review", versions: 1, runs: 0, threads: 0, in_flight: 0 }
const PREVIEW_LIVE = { name: "Vendor-risk review", versions: 2, runs: 5, threads: 3, in_flight: 1 }
const PREVIEW_READY = { name: "Vendor-risk review", versions: 2, runs: 5, threads: 3, in_flight: 0 }

interface SheetRow {
  /** Configures the api seam for this state. Runs after `beforeEach`. */
  setup: () => void
  /** Drives the opened sheet into this state and RESOLVES ONLY when it is on screen. */
  settle: (ctx: { user: ReturnType<typeof userEvent.setup>; dialog: HTMLElement }) => Promise<void>
}

const SHEET_ROWS: Record<SheetState, SheetRow> = {
  loading: {
    // The preview never resolves — `preview === null`, `previewError === null`.
    setup: () => mockPreview.mockReturnValue(new Promise(() => {})),
    settle: async ({ dialog }) => {
      await within(dialog).findByText("Loading the exact counts…")
    },
  },
  loadedZeroThreads: {
    // in_flight = 0, threads = 0 — the ALWAYS-rendered "No chat threads to keep." variant.
    setup: () => mockPreview.mockResolvedValue(PREVIEW_ZERO),
    settle: async ({ dialog }) => {
      await within(dialog).findByText("No chat threads to keep.")
    },
  },
  loadedInFlight: {
    // in_flight > 0 — the amber cancel-first banner (D-LOCK-05), plus the threads > 0
    // Kept sentence, so BOTH branches of the Kept group are captured across the seven.
    setup: () => mockPreview.mockResolvedValue(PREVIEW_LIVE),
    settle: async ({ dialog }) => {
      await within(dialog).findByTestId("delete-inflight-banner")
    },
  },
  deleting: {
    setup: () => {
      mockPreview.mockResolvedValue(PREVIEW_READY)
      // Deferred and NEVER resolved — the in-flight terminal is the state under capture.
      mockDelete.mockReturnValue(new Promise<void>(() => {}))
    },
    settle: async ({ user, dialog }) => {
      await within(dialog).findByText("Permanently removed")
      await user.click(within(dialog).getByTestId("delete-forever"))
      await within(dialog).findByText(/Deleting/)
    },
  },
  deleted: {
    setup: () => {
      mockPreview.mockResolvedValue(PREVIEW_READY)
      mockDelete.mockResolvedValue(undefined)
    },
    settle: async ({ user, dialog }) => {
      await within(dialog).findByText("Permanently removed")
      await user.click(within(dialog).getByTestId("delete-forever"))
      await waitFor(() => expect(dialog).toHaveTextContent("Deleted · recorded"))
    },
  },
  error: {
    setup: () => {
      mockPreview.mockResolvedValue(PREVIEW_READY)
      mockDelete.mockRejectedValue(new Error("boom"))
    },
    settle: async ({ user, dialog }) => {
      await within(dialog).findByText("Permanently removed")
      await user.click(within(dialog).getByTestId("delete-forever"))
      await within(dialog).findByTestId("delete-retry")
    },
  },
  previewError: {
    setup: () => mockPreview.mockRejectedValue(new Error("Preview unavailable")),
    settle: async ({ dialog }) => {
      await within(dialog).findByText("Preview unavailable")
    },
  },
}

/**
 * THE ONE AND ONLY NORMALIZATION APPLIED TO THE CAPTURES — narrow, named, and stated
 * rather than hidden, because a silent normalization is how a baseline stops meaning
 * anything.
 *
 * Radix's `SheetTitle` (`ui/sheet.tsx:105-118` → `DialogPrimitive.Title`) is given an
 * `id` generated by React's `useId` — observed here as `radix-_r_3_`. That value is
 * POSITION-DERIVED: it depends on where the hook sits in the React tree, not on
 * anything a user can see. It is perfectly stable run-to-run (the two capture runs
 * agreed byte for byte WITHOUT this normalization), but D-01 moves this JSX into a
 * component of its own, which CHANGES THE TREE POSITION and therefore changes the
 * token — for a reason PATTERNS § 2 already classifies as the ACCEPTED wrapper delta.
 * Left raw, all seven captures would go red on the move for a non-behavioural reason,
 * and an executor would "fix" them by re-capturing, which destroys the baseline.
 *
 * ⚠ THE LINKAGE IS NOT LOST BY NORMALIZING IT. The id is what `aria-labelledby` on
 * `SheetContent` points at, so it is load-bearing for accessibility even though its
 * VALUE is not. That round trip is asserted separately and on the LIVE DOM (see
 * "the title round trip" below), where a dangling id fails loudly. Nothing else in
 * any capture is touched: no whitespace collapsing, no attribute sorting, no text
 * folding.
 */
const USE_ID_TOKEN = /radix-(?:_r_[0-9a-z]+_|:r[0-9a-z]+:)/g
const normalizeUseId = (html: string): string => html.replace(USE_ID_TOKEN, "radix-USEID")

/** THE ONE SHARED HELPER. Capture and assertion both call it — a second render path
 *  would let the recorded literal and the asserted DOM drift without either failing. */
async function sheetHtml(state: SheetState): Promise<string> {
  SHEET_ROWS[state].setup()
  const user = userEvent.setup()
  const rendered = render(<WorkflowsPage folders={folders} onLaunch={vi.fn().mockResolvedValue(undefined)} />)
  const cards = await screen.findAllByTestId("published-card")
  await user.click(within(cards[0]).getByRole("button", { name: /workflow actions/i }))
  await user.click(await screen.findByTestId("published-delete"))
  const dialog = await screen.findByRole("dialog")
  await SHEET_ROWS[state].settle({ user, dialog })
  const html = normalizeUseId(dialog.innerHTML)
  rendered.unmount()
  return html
}

/**
 * ⚠ THIS LITERAL IS A CAPTURE, NOT AN EXPECTATION.
 *
 * Every character below was READ OUT of the rendered DOM by `sheetHtml()` — the SAME
 * helper the assertions call — on the UNCHANGED tree at capture SHA `14b309b4`, at
 * which commit `library/WorkflowDeleteSheet.tsx` does not exist. It was OBSERVED TWICE
 * and the two runs agreed BYTE FOR BYTE (they agreed both before and after the single
 * `useId` normalization documented above). Nothing here was authored, tidied, wrapped
 * or pretty-printed.
 *
 * A DIFF AGAINST THIS RECORD IS A BEHAVIOUR CHANGE TO EXPLAIN — IT IS NOT A TEST TO
 * UPDATE. If D-01's move reds one of these seven, the move changed the rendered DOM,
 * and the correct response is to fix the move, not to re-capture the literal. The one
 * legitimate reason to re-record is a deliberate, reviewed redesign of the Sheet — and
 * that is a different phase from a verbatim move.
 *
 * NOT VACUOUS — PROVED, NOT ASSERTED. Driven RED at capture time against a real plant:
 * renaming the shipped `Delete forever` control to `Delete forever now` in
 * `WorkflowsPage.tsx` failed exactly `loadedZeroThreads` and `loadedInFlight` (2 of 19)
 * — the only two states that render that control — and the plant was reverted with the
 * suite back at 19/19.
 */
const DELETE_SHEET_HTML_BASELINE: Record<SheetState, string> = {
  loading:
    "<button type=\"button\" aria-label=\"Dismiss\" class=\"mx-auto mt-2 mb-1 flex h-5 w-full max-w-[120px] cursor-grab items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring\"><span class=\"sheet-grip block h-1.5 w-10 rounded-full bg-border\"></span></button><div class=\"flex-1 overflow-y-auto\"><div class=\"flex flex-col space-y-1.5 px-4 pb-2 text-left\"><h2 id=\"radix-USEID\" class=\"text-lg font-semibold leading-none tracking-tight\">Delete this workflow?</h2></div><div id=\"wf-delete-pub-1\" class=\"px-4 pb-4\"><p role=\"status\" class=\"text-sm text-muted-foreground\">Loading the exact counts…</p></div></div><button type=\"button\" class=\"absolute right-4 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-x h-4 w-4\" aria-hidden=\"true\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg><span class=\"sr-only\">Close</span></button>",
  loadedZeroThreads:
    "<button type=\"button\" aria-label=\"Dismiss\" class=\"mx-auto mt-2 mb-1 flex h-5 w-full max-w-[120px] cursor-grab items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring\"><span class=\"sheet-grip block h-1.5 w-10 rounded-full bg-border\"></span></button><div class=\"flex-1 overflow-y-auto\"><div class=\"flex flex-col space-y-1.5 px-4 pb-2 text-left\"><h2 id=\"radix-USEID\" class=\"text-lg font-semibold leading-none tracking-tight\">Delete this workflow?</h2></div><div id=\"wf-delete-pub-1\" class=\"px-4 pb-4\"><div><p class=\"text-[13px] font-semibold text-destructive\">Permanently removed</p><p class=\"mt-1 text-sm text-foreground\"><span class=\"font-medium\">Vendor-risk review</span> · 1 versions · 0 run records</p></div><div class=\"mt-6\"><p class=\"text-[13px] font-semibold text-foreground\">Kept — not touched</p><p class=\"mt-1 text-sm text-muted-foreground\">No chat threads to keep.</p></div><div class=\"mt-5 flex items-center justify-end gap-2\"><button type=\"button\" class=\"rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground\">Keep it</button><button type=\"button\" data-testid=\"delete-forever\" class=\"rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90\">Delete forever</button></div><p class=\"mt-4 text-[12px] text-muted-foreground\">✎ Recorded with your name in the audit log.</p></div></div><button type=\"button\" class=\"absolute right-4 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-x h-4 w-4\" aria-hidden=\"true\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg><span class=\"sr-only\">Close</span></button>",
  loadedInFlight:
    "<button type=\"button\" aria-label=\"Dismiss\" class=\"mx-auto mt-2 mb-1 flex h-5 w-full max-w-[120px] cursor-grab items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring\"><span class=\"sheet-grip block h-1.5 w-10 rounded-full bg-border\"></span></button><div class=\"flex-1 overflow-y-auto\"><div class=\"flex flex-col space-y-1.5 px-4 pb-2 text-left\"><h2 id=\"radix-USEID\" class=\"text-lg font-semibold leading-none tracking-tight\">Delete this workflow?</h2></div><div id=\"wf-delete-pub-1\" class=\"px-4 pb-4\"><div><p class=\"text-[13px] font-semibold text-destructive\">Permanently removed</p><p class=\"mt-1 text-sm text-foreground\"><span class=\"font-medium\">Vendor-risk review</span> · 2 versions · 5 run records</p></div><div class=\"mt-6\"><p class=\"text-[13px] font-semibold text-foreground\">Kept — not touched</p><p class=\"mt-1 text-sm text-muted-foreground\">3 chat threads become normal chats — transcripts &amp; files stay. Your knowledge base is untouched.</p></div><div role=\"status\" data-testid=\"delete-inflight-banner\" class=\"mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-400\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-triangle-alert mt-0.5 h-4 w-4 flex-none\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"></path><path d=\"M12 9v4\"></path><path d=\"M12 17h.01\"></path></svg><span>1 run is still in progress. It’s cancelled safely first, then the workflow is deleted.</span></div><div class=\"mt-5 flex items-center justify-end gap-2\"><button type=\"button\" class=\"rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground\">Keep it</button><button type=\"button\" data-testid=\"delete-forever\" class=\"rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90\">Delete forever</button></div><p class=\"mt-4 text-[12px] text-muted-foreground\">✎ Recorded with your name in the audit log.</p></div></div><button type=\"button\" class=\"absolute right-4 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-x h-4 w-4\" aria-hidden=\"true\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg><span class=\"sr-only\">Close</span></button>",
  deleting:
    "<button type=\"button\" aria-label=\"Dismiss\" class=\"mx-auto mt-2 mb-1 flex h-5 w-full max-w-[120px] cursor-grab items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring\"><span class=\"sheet-grip block h-1.5 w-10 rounded-full bg-border\"></span></button><div class=\"flex-1 overflow-y-auto\"><div class=\"flex flex-col space-y-1.5 px-4 pb-2 text-left\"><h2 id=\"radix-USEID\" class=\"text-lg font-semibold leading-none tracking-tight\">Delete this workflow?</h2></div><div id=\"wf-delete-pub-1\" class=\"px-4 pb-4\"><div><p class=\"text-[13px] font-semibold text-destructive\">Permanently removed</p><p class=\"mt-1 text-sm text-foreground\"><span class=\"font-medium\">Vendor-risk review</span> · 2 versions · 5 run records</p></div><div class=\"mt-6\"><p class=\"text-[13px] font-semibold text-foreground\">Kept — not touched</p><p class=\"mt-1 text-sm text-muted-foreground\">3 chat threads become normal chats — transcripts &amp; files stay. Your knowledge base is untouched.</p></div><div class=\"mt-5 flex items-center justify-end gap-2\"><span role=\"status\" class=\"inline-flex items-center gap-1.5 text-sm text-muted-foreground\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-loader-circle h-4 w-4 animate-spin\" aria-hidden=\"true\"><path d=\"M21 12a9 9 0 1 1-6.219-8.56\"></path></svg>Deleting…</span></div><p class=\"mt-4 text-[12px] text-muted-foreground\">✎ Recorded with your name in the audit log.</p></div></div><button type=\"button\" class=\"absolute right-4 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-x h-4 w-4\" aria-hidden=\"true\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg><span class=\"sr-only\">Close</span></button>",
  deleted:
    "<button type=\"button\" aria-label=\"Dismiss\" class=\"mx-auto mt-2 mb-1 flex h-5 w-full max-w-[120px] cursor-grab items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring\"><span class=\"sheet-grip block h-1.5 w-10 rounded-full bg-border\"></span></button><div class=\"flex-1 overflow-y-auto\"><div class=\"flex flex-col space-y-1.5 px-4 pb-2 text-left\"><h2 id=\"radix-USEID\" class=\"text-lg font-semibold leading-none tracking-tight\">Delete this workflow?</h2></div><div id=\"wf-delete-pub-1\" class=\"px-4 pb-4\"><div><p class=\"text-[13px] font-semibold text-destructive\">Permanently removed</p><p class=\"mt-1 text-sm text-foreground\"><span class=\"font-medium\">Vendor-risk review</span> · 2 versions · 5 run records</p></div><div class=\"mt-6\"><p class=\"text-[13px] font-semibold text-foreground\">Kept — not touched</p><p class=\"mt-1 text-sm text-muted-foreground\">3 chat threads become normal chats — transcripts &amp; files stay. Your knowledge base is untouched.</p></div><div class=\"mt-5 flex items-center justify-end gap-2\"><span role=\"status\" class=\"inline-flex items-center gap-1.5 text-sm font-medium text-foreground\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-check h-4 w-4 text-success\" aria-hidden=\"true\"><path d=\"M20 6 9 17l-5-5\"></path></svg>Deleted · recorded</span></div><p class=\"mt-4 text-[12px] text-muted-foreground\">✎ Recorded with your name in the audit log.</p></div></div><button type=\"button\" class=\"absolute right-4 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-x h-4 w-4\" aria-hidden=\"true\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg><span class=\"sr-only\">Close</span></button>",
  error:
    "<button type=\"button\" aria-label=\"Dismiss\" class=\"mx-auto mt-2 mb-1 flex h-5 w-full max-w-[120px] cursor-grab items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring\"><span class=\"sheet-grip block h-1.5 w-10 rounded-full bg-border\"></span></button><div class=\"flex-1 overflow-y-auto\"><div class=\"flex flex-col space-y-1.5 px-4 pb-2 text-left\"><h2 id=\"radix-USEID\" class=\"text-lg font-semibold leading-none tracking-tight\">Delete this workflow?</h2></div><div id=\"wf-delete-pub-1\" class=\"px-4 pb-4\"><div><p class=\"text-[13px] font-semibold text-destructive\">Permanently removed</p><p class=\"mt-1 text-sm text-foreground\"><span class=\"font-medium\">Vendor-risk review</span> · 2 versions · 5 run records</p></div><div class=\"mt-6\"><p class=\"text-[13px] font-semibold text-foreground\">Kept — not touched</p><p class=\"mt-1 text-sm text-muted-foreground\">3 chat threads become normal chats — transcripts &amp; files stay. Your knowledge base is untouched.</p></div><div class=\"mt-5 flex items-center justify-end gap-2\"><div class=\"flex items-center gap-2\"><span role=\"status\" class=\"text-sm text-destructive\">Couldn’t delete the workflow</span><button type=\"button\" data-testid=\"delete-retry\" class=\"inline-flex items-center rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/20\">Try again</button></div></div><p class=\"mt-4 text-[12px] text-muted-foreground\">✎ Recorded with your name in the audit log.</p></div></div><button type=\"button\" class=\"absolute right-4 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-x h-4 w-4\" aria-hidden=\"true\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg><span class=\"sr-only\">Close</span></button>",
  previewError:
    "<button type=\"button\" aria-label=\"Dismiss\" class=\"mx-auto mt-2 mb-1 flex h-5 w-full max-w-[120px] cursor-grab items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring\"><span class=\"sheet-grip block h-1.5 w-10 rounded-full bg-border\"></span></button><div class=\"flex-1 overflow-y-auto\"><div class=\"flex flex-col space-y-1.5 px-4 pb-2 text-left\"><h2 id=\"radix-USEID\" class=\"text-lg font-semibold leading-none tracking-tight\">Delete this workflow?</h2></div><div id=\"wf-delete-pub-1\" class=\"px-4 pb-4\"><div><p role=\"alert\" class=\"text-sm text-destructive\">Preview unavailable</p><div class=\"mt-4 flex justify-end\"><button type=\"button\" class=\"rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground\">Keep it</button></div></div></div></div><button type=\"button\" class=\"absolute right-4 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-x h-4 w-4\" aria-hidden=\"true\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg><span class=\"sr-only\">Close</span></button>",
}

const SHEET_STATES = Object.keys(SHEET_ROWS) as SheetState[]

describe("delete Sheet — the pre-move whole-innerHTML capture (D-01, seven states)", () => {
  it("the capture table covers EXACTLY the seven declared states — no state may be dropped", () => {
    // Without this, deleting a row from SHEET_ROWS would silently shrink the baseline
    // and every remaining case would still pass.
    expect(SHEET_STATES).toHaveLength(7)
    expect(Object.keys(DELETE_SHEET_HTML_BASELINE).sort()).toEqual([...SHEET_STATES].sort())
  })

  it.each(SHEET_STATES)(
    "%s renders byte-identically to the pre-move capture",
    async (state) => {
      // NON-VACUITY FIRST: byte-identity is also satisfied by a row that rendered
      // nothing at all, so the recorded string must be proved non-empty before it is
      // allowed to certify anything.
      expect(DELETE_SHEET_HTML_BASELINE[state].length).toBeGreaterThan(0)
      expect(await sheetHtml(state)).toBe(DELETE_SHEET_HTML_BASELINE[state])
    },
    20000,
  )
})

describe("delete Sheet — what the captures must CONTAIN (read off the committed strings)", () => {
  // Byte-identity says "unchanged"; it does not say "correct". These read the recorded
  // literals themselves, so they fail if a future re-capture quietly launders the
  // victim-naming counts out of the Sheet — which is the property D-15 and D-18 both
  // lean on when they argue this is the HEAVIEST of the three shipped guard grades.
  it("the loaded captures name the EXACT mocked server counts, never a guess or a placeholder", () => {
    // in_flight = 0, threads = 0 → versions/runs from PREVIEW_ZERO, plus the
    // always-rendered zero-threads variant of the Kept sentence.
    const zero = DELETE_SHEET_HTML_BASELINE.loadedZeroThreads
    expect(zero).toContain(PREVIEW_ZERO.name)
    expect(zero).toContain(`${PREVIEW_ZERO.versions} versions`)
    expect(zero).toContain(`${PREVIEW_ZERO.runs} run records`)
    expect(zero).toContain("No chat threads to keep.")
    expect(zero).not.toContain("become normal chats")

    // in_flight > 0 → the same exact-count contract, the threads > 0 branch of the
    // Kept sentence, and the amber cancel-first banner naming the live run count.
    const live = DELETE_SHEET_HTML_BASELINE.loadedInFlight
    expect(live).toContain(`${PREVIEW_LIVE.versions} versions`)
    expect(live).toContain(`${PREVIEW_LIVE.runs} run records`)
    expect(live).toContain(`${PREVIEW_LIVE.threads} chat threads become normal chats`)
    expect(live).toContain("delete-inflight-banner")
    expect(live).toContain(`${PREVIEW_LIVE.in_flight} run is still in progress`)
  })

  it("the loading capture shows NO counts at all — a count during load would be a lie", () => {
    const loading = DELETE_SHEET_HTML_BASELINE.loading
    expect(loading).toContain("Loading the exact counts")
    expect(loading).not.toContain("Permanently removed")
    expect(loading).not.toContain("run records")
    expect(loading).not.toContain("delete-forever")
  })

  it("every capture carries the Sheet's own heading, and only the loaded ones offer the destructive control", () => {
    for (const state of SHEET_STATES) {
      expect(DELETE_SHEET_HTML_BASELINE[state]).toContain("Delete this workflow?")
    }
    // The destructive-weighted control exists only in the two idle+loaded states —
    // never while loading, never mid-flight, never after a terminal.
    expect(DELETE_SHEET_HTML_BASELINE.loadedZeroThreads).toContain("delete-forever")
    expect(DELETE_SHEET_HTML_BASELINE.loadedInFlight).toContain("delete-forever")
    for (const state of ["loading", "deleting", "deleted", "error", "previewError"] as SheetState[]) {
      expect(DELETE_SHEET_HTML_BASELINE[state]).not.toContain("delete-forever")
    }
  })

  it("the terminal captures each show their own honest terminal, and the audit receipt rides with the loaded ones", () => {
    expect(DELETE_SHEET_HTML_BASELINE.deleting).toContain("Deleting")
    expect(DELETE_SHEET_HTML_BASELINE.deleted).toContain("Deleted · recorded")
    expect(DELETE_SHEET_HTML_BASELINE.error).toContain("delete-retry")
    expect(DELETE_SHEET_HTML_BASELINE.previewError).toContain("Preview unavailable")
    expect(DELETE_SHEET_HTML_BASELINE.deleted).toContain("Recorded with your name in the audit log.")
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
 * Phase 192 Plan 04 Task 2 (D-01 / T-192-11) — THE TWO GRADED-GUARD INVARIANTS.
 *
 * ⚠ THESE ARE INVARIANTS, NOT CAPTURES, and they must never be re-derived from the
 * seven `innerHTML` literals above. The captures answer "does it still RENDER the
 * same?"; these answer "does it still REFUSE the same?" — a different question, and
 * the one that actually matters. A guard proved only on its happy path is not proved:
 * every byte of every capture could stay identical while `onOpenChange` quietly stopped
 * refusing mid-delete, or while the card started vanishing optimistically.
 *
 * WHY THIS IS LOAD-BEARING BEYOND THIS FILE. The recorded 146-148 rule grades an action
 * guard BY CONSEQUENCE — victim-naming sheet / arm-to-confirm / direct flip — and this
 * Sheet is the HEAVIEST of the three shipped grades (`192-PATTERNS.md` § S-5). Two other
 * live decisions are argued against it and are false the moment it weakens:
 *   · D-15  the fork ships NO confirm sheet, because a heavy guard on a harmless action
 *           spends the vocabulary THIS one relies on;
 *   · D-18  the draft delete must be DEMONSTRABLY LIGHTER than this Sheet, never the
 *           reverse — "lighter than X" is meaningless if X drifts.
 *
 * BOTH INVARIANTS WERE OBSERVED RED BEFORE THEY WERE TRUSTED — against real plants in
 * real shipped source, not against synthetic fixtures:
 *
 *   PLANT A — deleted the line `if (!o && deletePhase === "deleting") return`
 *             (`WorkflowsPage.tsx:882`). Result: 2 failed / 24 passed. Exactly the two
 *             refusal cases reddened; all FOUR positive controls stayed green, which is
 *             what distinguishes "refuses correctly" from "never closes".
 *   PLANT B — moved `onDeleted()` to BEFORE `await deleteWorkflowCascade(wf.id)`
 *             (`WorkflowsPage.tsx:788-799`), i.e. an optimistic vanish. Result:
 *             2 failed / 24 passed — exactly the two invariant-2 cases, including the
 *             rejected-cascade one, which is the half a happy-path test would miss.
 *
 * Both plants were reverted (`git checkout -- src/pages/WorkflowsPage.tsx`) and the
 * suite returned to 26/26. NO source file is modified by Phase 192 Plan 04.
 * ══════════════════════════════════════════════════════════════════════════════ */
describe("delete Sheet — invariant 1: it NEVER dismisses mid-delete", () => {
  /** Drive the sheet to `deleting` with a cascade that is deliberately never resolved. */
  async function intoDeleting() {
    mockPreview.mockResolvedValue(PREVIEW_READY)
    mockDelete.mockReturnValue(new Promise<void>(() => {}))
    const { user, dialog } = await openDeleteSheet()
    await within(dialog).findByText("Permanently removed")
    await user.click(within(dialog).getByTestId("delete-forever"))
    await within(dialog).findByText(/Deleting/)
    return { user, dialog }
  }

  it("Escape does NOT close the sheet while the delete is in flight", async () => {
    const { user, dialog } = await intoDeleting()
    await user.keyboard("{Escape}")
    // The action is in flight; the surface that named the victim must stay on screen.
    expect(dialog).toBeInTheDocument()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(dialog).toHaveTextContent("Deleting")
  })

  it("the grip/close affordances do NOT close it mid-delete either — the refusal is on onOpenChange, so EVERY path funnels through it", async () => {
    const { user, dialog } = await intoDeleting()
    // The grip row is a Radix Close (`ui/sheet.tsx:76-81`), as is the ✕ — both request
    // onOpenChange(false), which is exactly where the mid-delete refusal lives.
    await user.click(within(dialog).getByRole("button", { name: /dismiss/i }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: /^close$/i }))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(dialog).toHaveTextContent("Deleting")
  })

  it("POSITIVE CONTROL — Escape DOES close the sheet when no delete is in flight", async () => {
    // Without this, both assertions above are satisfied by a sheet that never closes at
    // all, which would be a different (and worse) defect wearing the same green tick.
    mockPreview.mockResolvedValue(PREVIEW_READY)
    const { user, dialog } = await openDeleteSheet()
    await within(dialog).findByText("Permanently removed")
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("POSITIVE CONTROL — Escape closes it again once the delete reaches its TERMINAL state", async () => {
    // The refusal is scoped to `deletePhase === "deleting"` only. A confirmed delete is
    // no longer in flight, so the user regains control of the surface.
    mockPreview.mockResolvedValue(PREVIEW_READY)
    mockDelete.mockResolvedValue(undefined)
    const { user, dialog } = await openDeleteSheet()
    await within(dialog).findByText("Permanently removed")
    await user.click(within(dialog).getByTestId("delete-forever"))
    await waitFor(() => expect(dialog).toHaveTextContent("Deleted · recorded"))
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("the title round trip — aria-labelledby resolves to a real heading (the linkage the useId normalization does NOT cover)", async () => {
    // The capture normalizes the generated id's VALUE; this asserts the LINK, on the
    // live DOM. A dangling aria-labelledby passes a naive attribute assertion.
    mockPreview.mockResolvedValue(PREVIEW_READY)
    const { dialog } = await openDeleteSheet()
    const labelledBy = dialog.getAttribute("aria-labelledby")
    expect(labelledBy).toBeTruthy()
    const heading = document.getElementById(labelledBy as string)
    expect(heading).not.toBeNull()
    expect(heading?.textContent).toBe("Delete this workflow?")
    // …and the describedby half, whose id is derived from the row id (never generated).
    expect(dialog.getAttribute("aria-describedby")).toBe("wf-delete-pub-1")
    expect(document.getElementById("wf-delete-pub-1")).not.toBeNull()
  })
})

describe("delete Sheet — invariant 2: NO optimistic vanish (D-LOCK-04)", () => {
  it("the card leaves the list ONLY after the server confirms, and only via the re-fetch", async () => {
    mockPreview.mockResolvedValue(PREVIEW_READY)
    let resolveDelete!: () => void
    mockDelete.mockReturnValue(new Promise<void>((r) => { resolveDelete = () => r() }))

    const { user, dialog } = await openDeleteSheet()
    await within(dialog).findByText("Permanently removed")

    // The feed is emptied BEFORE the click. If the list were filtered locally, or if any
    // stray re-fetch ran ahead of confirmation, the card would vanish on its own.
    mockListPublished.mockResolvedValue([])
    const fetchesBeforeClick = mockListPublished.mock.calls.length

    await user.click(within(dialog).getByTestId("delete-forever"))
    await within(dialog).findByText(/Deleting/)

    // In flight: the row is still on screen and NOTHING has been re-fetched.
    expect(screen.getByTestId("published-card")).toBeInTheDocument()
    expect(mockListPublished.mock.calls.length).toBe(fetchesBeforeClick)

    // Server confirms → onDeleted() re-fetches → the (now empty) feed removes the card.
    resolveDelete()
    await waitFor(() => expect(screen.queryByTestId("published-card")).toBeNull())
    expect(mockListPublished.mock.calls.length).toBeGreaterThan(fetchesBeforeClick)
  })

  it("a REJECTED cascade leaves the card present and surfaces the error — a failed delete never vanishes a row", async () => {
    mockPreview.mockResolvedValue(PREVIEW_READY)
    mockDelete.mockRejectedValue(new Error("boom"))

    const { user, dialog } = await openDeleteSheet()
    await within(dialog).findByText("Permanently removed")
    // Same trap as above: an empty feed is armed, so a stray re-fetch would be visible.
    mockListPublished.mockResolvedValue([])
    const fetchesBeforeClick = mockListPublished.mock.calls.length

    await user.click(within(dialog).getByTestId("delete-forever"))
    await within(dialog).findByTestId("delete-retry")

    expect(screen.getByTestId("published-card")).toBeInTheDocument()
    expect(dialog).toHaveTextContent("Couldn’t delete the workflow")
    expect(mockListPublished.mock.calls.length).toBe(fetchesBeforeClick)
  })
})

/* ══════════════════════════════════════════════════════════════════════════════
 * Phase 192 Plan 08 Task 2 (D-01) — THE CUT HAS ONE DIRECTION, AND THE GUARD WENT
 * WITH ITS STATE.
 *
 * The 26 rows above are the pre-move contract and they all still pass, un-re-captured,
 * on the SAME render path they were captured from — which is exactly why this cut was
 * scheduled while `PublishedCard` still exists. What they CANNOT see is the shape of
 * the extraction itself: seven byte-identical captures are equally satisfied by a move
 * that left `sheetOpen` on the page, by a re-export shim that preserved the coupling,
 * and by a module that imports the page straight back. These rows read source.
 *
 * ⚠ THE FAILURE MODE THIS BLOCK IS AIMED AT is not "the Sheet broke" — it is "the Sheet
 * was SPLIT". `192-PATTERNS.md` § 2 names it: the JSX block reads self-contained and is
 * not, because it closes over five hooks declared ~100 lines above it inside the very
 * component D-01 deletes. A split passes every capture above and hands `192-09` a piece
 * of the heaviest shipped action guard to re-implement by hand.
 * ══════════════════════════════════════════════════════════════════════════════ */

/** Types only — `typeof import(…)` is a type expression and adds no runtime import. */
type SheetModule = typeof import("@/components/workflows/library/WorkflowDeleteSheet")
type SheetProps = Parameters<SheetModule["WorkflowDeleteSheet"]>[0]
/** Type-only, therefore erased: the handle the card holds, without a runtime import. */
import type { WorkflowDeleteSheetHandle } from "@/components/workflows/library/WorkflowDeleteSheet"

/** A published row for the ISOLATED render. Deliberately NOT `boundPublished`: that one
 *  exists to drive the page's feed, and reusing it would blur whether the Sheet or the
 *  page is under test — which is the whole point of these rows. */
const isolatedWf: SheetProps["wf"] = {
  id: "iso-1",
  slug: "isolated",
  name: "Isolated sheet",
}

describe("WorkflowDeleteSheet 192-08 — the cut has one direction", () => {
  it("the Sheet's ONE host imports it, the page declares none of its four spans, and no shim exists", async () => {
    const pageSource = (await import("../WorkflowsPage?raw")).default as string
    // 192-10 (D-01/D-09): THE HOST MOVED ON, AND THIS ROW MOVED WITH IT. When 192-08 wrote
    // this case the Sheet's host was `PublishedCard`, declared INSIDE the page — so "the page
    // imports the Sheet" was the same claim as "exactly one host imports the Sheet". 192-09
    // built the ONE card and 192-10 deleted the three it replaces, so the host is now
    // `WorkflowCard` and the page names the Sheet nowhere at all. The PROPERTY this row
    // guards is unchanged — one host, a real import edge, no re-export shim, the trigger
    // testid carried — and only its subject is re-pointed. Both sources are read, so the
    // negatives below still bind to the page.
    const cardSource = (
      await import("@/components/workflows/library/WorkflowCard?raw")
    ).default as string

    // NON-VACUITY FIRST: a `?raw` import that silently resolved to "" would satisfy every
    // negative below forever, and would look exactly like a clean cut.
    expect(pageSource.length).toBeGreaterThan(10000)
    expect(cardSource.length).toBeGreaterThan(5000)

    // The edge exists, and it points at the library module — from the card that mounts it.
    expect(cardSource).toMatch(
      /WorkflowDeleteSheet,?\s*[\s\S]{0,160}from ["']\.\/WorkflowDeleteSheet["']/,
    )
    // The page's edge is GONE, which is strictly stronger than 192-08 could assert: the page
    // does not mount the guard, so it must not name the module either.
    expect(pageSource).not.toContain("library/WorkflowDeleteSheet")

    // …and all four moved spans are GONE from the page. One assertion per span, so a
    // partial cut names WHICH piece stayed behind rather than failing anonymously.
    expect(pageSource).not.toContain("type DeletePhase")           // span A
    expect(pageSource).not.toContain("const [sheetOpen")            // span C — the state
    expect(pageSource).not.toContain("const descId")                // span C — the a11y id
    expect(pageSource).not.toContain("getWorkflowDeletePreview")    // span C — the preview
    expect(pageSource).not.toContain("deleteWorkflowCascade")       // span C — the cascade
    expect(pageSource).not.toContain("<SheetContent")               // span D — the JSX

    // No shim, in either spelling. A shim keeps exactly the coupling the cut removes while
    // every negative above stays green.
    expect(pageSource).not.toContain("export { WorkflowDeleteSheet")
    expect(pageSource).not.toContain("export * from")

    // The trigger survived BOTH cuts. `published-delete` is what every row above drives, and
    // `192-09` carried it across verbatim — which is why those rows are still green against a
    // card that did not exist when they were written. It is now emitted by the card.
    expect(cardSource).toContain('data-testid="published-delete"')
    expect(pageSource).not.toContain('data-testid="published-delete"')
  })

  it("the module owns the state AND the JSX — the split that would pass every capture above", async () => {
    const sheetSource = (
      await import("@/components/workflows/library/WorkflowDeleteSheet?raw")
    ).default as string
    expect(sheetSource.length).toBeGreaterThan(5000)

    // All five hooks, `descId` and both handlers live HERE. Byte-identity of the rendered
    // DOM says nothing about which file declared the state that produced it.
    for (const owned of [
      "const [sheetOpen",
      "const [preview",
      "const [previewError",
      "const [deletePhase",
      "const descId",
      "const openDeleteSheet",
      "const handleDelete",
    ]) {
      expect(sheetSource).toContain(owned)
    }

    // The two invariant comments came across, not just the code they guard. They are the
    // written record of WHY the guard refuses, and D-15 and D-18 are both arguments made by
    // reference to it — a re-typed comment is how a guard quietly loses its reason.
    expect(sheetSource).toContain('if (!o && deletePhase === "deleting") return')
    expect(sheetSource).toContain("Never dismiss mid-delete (the action is in flight)")
    expect(sheetSource).toContain(
      "// Server-confirmed: re-fetch the shelf so the card leaves the list ONLY now",
    )

    // F4's own subject, asserted from this side too: no path back to the page.
    expect(sheetSource).not.toMatch(/from\s+["'][^"']*WorkflowsPage(\.[jt]sx?)?["']/)
  })
})

describe("WorkflowDeleteSheet 192-08 — the guard refuses on its OWN, with no page around it", () => {
  /** Render the Sheet alone and open it through the handle the card now holds. */
  async function renderIsolatedSheet() {
    const { WorkflowDeleteSheet } = await import(
      "@/components/workflows/library/WorkflowDeleteSheet"
    )
    const onDeleted = vi.fn()
    const ref: { current: WorkflowDeleteSheetHandle | null } = { current: null }
    const rendered = render(
      <WorkflowDeleteSheet ref={ref} wf={isolatedWf} onDeleted={onDeleted} />,
    )
    // The handle is the ONLY way in — if the imperative wiring were broken, nothing below
    // could open, which is itself the assertion.
    await act(async () => {
      ref.current?.openDeleteSheet()
    })
    const dialog = await screen.findByRole("dialog")
    return { onDeleted, dialog, rendered }
  }

  it("opens through the handle and names THIS row's counts — no page state involved", async () => {
    mockPreview.mockResolvedValue(PREVIEW_READY)
    const { dialog, rendered } = await renderIsolatedSheet()
    await within(dialog).findByText("Permanently removed")
    // Keyed by the isolated row's id, and the describedby id is derived from it — the
    // `wf-delete-${wf.id}` shape moved with the code (D-14's precedent on this page).
    expect(mockPreview).toHaveBeenCalledWith("iso-1")
    expect(dialog.getAttribute("aria-describedby")).toBe("wf-delete-iso-1")
    rendered.unmount()
  })

  it("Escape mid-delete does NOT close it — the refusal is the module's own, not the page's", async () => {
    // Nothing but this component exists in the tree, so no page-level handler can be
    // producing the refusal. This is the row that proves the guard was MOVED, not split.
    mockPreview.mockResolvedValue(PREVIEW_READY)
    mockDelete.mockReturnValue(new Promise<void>(() => {}))
    const user = userEvent.setup()
    const { dialog, rendered } = await renderIsolatedSheet()
    await within(dialog).findByText("Permanently removed")
    await user.click(within(dialog).getByTestId("delete-forever"))
    await within(dialog).findByText(/Deleting/)

    await user.keyboard("{Escape}")
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(dialog).toHaveTextContent("Deleting")
    rendered.unmount()
  })

  it("POSITIVE CONTROL — the same Escape DOES close it when no delete is in flight", async () => {
    // Without this, the row above is satisfied by a Sheet that never closes at all — a
    // different and worse defect wearing the same green tick.
    mockPreview.mockResolvedValue(PREVIEW_READY)
    const user = userEvent.setup()
    const { dialog, rendered } = await renderIsolatedSheet()
    await within(dialog).findByText("Permanently removed")
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(dialog).toBeDefined()
    rendered.unmount()
  })

  it("no optimistic call — onDeleted fires ONLY after the cascade resolves", async () => {
    // The other half of the graded guard, asserted at the seam rather than through the
    // page's feed: `onDeleted` is the re-fetch trigger, so calling it early IS the
    // optimistic vanish, wherever the list happens to live.
    mockPreview.mockResolvedValue(PREVIEW_READY)
    let resolveDelete!: () => void
    mockDelete.mockReturnValue(new Promise<void>((r) => { resolveDelete = () => r() }))
    const user = userEvent.setup()
    const { onDeleted, dialog, rendered } = await renderIsolatedSheet()
    await within(dialog).findByText("Permanently removed")
    await user.click(within(dialog).getByTestId("delete-forever"))
    await within(dialog).findByText(/Deleting/)

    expect(onDeleted).not.toHaveBeenCalled()
    await act(async () => {
      resolveDelete()
    })
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1))
    rendered.unmount()
  })
})
