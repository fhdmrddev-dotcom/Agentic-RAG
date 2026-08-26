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
  // 204-03 (SCHED-01) — THE MEASURED MOCK BUDGET, SPENT IN THE COMMIT THAT ADDED THE EXPORTS.
  // A whole-module `vi.mock("@/lib/api")` factory that omits a newly-added RUNTIME export makes
  // every suite reaching it throw AT MOUNT, far from the cause: `196-08` cost 249 red tests
  // exactly this way. `WorkflowsPage` now mounts `WorkflowScheduleModal`, which imports these
  // six. They resolve to empty/no-op answers because no case here opens the schedules dialog —
  // their job is to EXIST.
  listSchedules: () => Promise.resolve([]),
  listWorkflowSchedules: () => Promise.resolve([]),
  createWorkflowSchedule: () => Promise.resolve({}),
  updateSchedule: () => Promise.resolve({}),
  deleteSchedule: () => Promise.resolve(undefined),
  triggerSchedule: () => Promise.resolve({ launched: false }),
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
      await within(dialog).findByText("Checking what this will remove…")
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
 *
 * ── ⚠ RE-CAPTURED 2026-08-20 — THE SKETCH-200 PORT, WHICH IS THE ONE LEGITIMATE REASON
 *    THE PARAGRAPH ABOVE ALREADY NAMES ("a deliberate, reviewed redesign of the Sheet") ──
 *
 * All seven strings were re-taken through `sheetHtml()`, the same helper the assertions
 * call, dumped to a file and substituted by script. Not one character hand-edited.
 *
 * WHAT MOVED, and the sheet section each delta comes from
 * (`.planning/sketches/200-journey-interactive/screens/fork-delete.html`):
 *   · §2 LOADING — a spinner beside the wait, and the sentence becomes *"Checking what
 *     this will remove…"*. It says WHY there is a wait instead of naming the mechanism.
 *   · §2 LOADED — the two group captions become quiet uppercase mono; the victim moves into
 *     a RAISED BOX with its name on its own line and the counts beneath; the Kept group
 *     gets the sheet's transparent box; both action buttons take the sheet's `h-10`.
 *   · §3 — *"spends danger colour: yes, ON THE BUTTON ONLY"*, so the `Permanently removed`
 *     caption loses `text-destructive`. `Delete forever` keeps `bg-destructive` and is now
 *     the only red thing in the dialog. ⚠ THIS IS THE DELTA MOST EASILY MISREAD AS A
 *     WEAKENING AND IT IS THE OPPOSITE: red on a caption made the one irreversible control
 *     compete with a label for the strongest signal the surface has.
 *   · §2 footer — the receipt line goes right-aligned and italic. The ✎ STAYS though the
 *     sheet drops it: it is the shipped 146-148 audit mark and forking that vocabulary for
 *     one dialog would cost more than the sheet's tidiness gains.
 *
 * WHAT DID NOT MOVE, AND IS WHY THE LADDER IS STILL INTACT — every one of these is asserted
 * by a case in this file that was NOT edited: the victim is still named exactly once from
 * the server preview (`namesItsVictim`), the EXACT counts are still stated (`\d+ versions` /
 * `\d+ run records` — deliberately NOT pluralised to "1 version", because the sheet's "1
 * version • 17 run records" is its fixture data and not a claim about wording), no count and
 * no destructive control render while the preview is in flight, the amber cancel-first
 * banner is unchanged byte for byte, and the receipt still renders in all five loaded
 * states. `gradeOf(html)` still reads 4, and the fork prompt still reads 0.
 */
const DELETE_SHEET_HTML_BASELINE: Record<SheetState, string> = {
  loading:
    "<button type=\"button\" aria-label=\"Dismiss\" class=\"mx-auto mt-2 mb-1 flex h-5 w-full max-w-[120px] cursor-grab items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring\"><span class=\"sheet-grip block h-1.5 w-10 rounded-full bg-border\"></span></button><div class=\"flex-1 overflow-y-auto\"><div class=\"flex flex-col space-y-1.5 px-4 pb-2 text-left\"><h2 id=\"radix-USEID\" class=\"text-lg font-semibold leading-none tracking-tight\">Delete this workflow?</h2></div><div id=\"wf-delete-pub-1\" class=\"px-4 pb-4\"><p role=\"status\" class=\"flex items-center gap-2 text-sm text-muted-foreground\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-loader-circle h-4 w-4 flex-none animate-spin\" aria-hidden=\"true\"><path d=\"M21 12a9 9 0 1 1-6.219-8.56\"></path></svg>Checking what this will remove…</p></div></div><button type=\"button\" class=\"absolute right-4 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-x h-4 w-4\" aria-hidden=\"true\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg><span class=\"sr-only\">Close</span></button>",
  loadedZeroThreads:
    "<button type=\"button\" aria-label=\"Dismiss\" class=\"mx-auto mt-2 mb-1 flex h-5 w-full max-w-[120px] cursor-grab items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring\"><span class=\"sheet-grip block h-1.5 w-10 rounded-full bg-border\"></span></button><div class=\"flex-1 overflow-y-auto\"><div class=\"flex flex-col space-y-1.5 px-4 pb-2 text-left\"><h2 id=\"radix-USEID\" class=\"text-lg font-semibold leading-none tracking-tight\">Delete this workflow?</h2></div><div id=\"wf-delete-pub-1\" class=\"px-4 pb-4\"><div><p class=\"font-mono text-[11px] uppercase tracking-wider text-muted-foreground\">Permanently removed</p><p class=\"mt-1.5 flex flex-col gap-0.5 rounded-md border border-border bg-muted/40 p-4\"><span class=\"text-sm font-medium text-foreground\">Vendor-risk review</span><span class=\"text-[12px] text-muted-foreground\">1 versions · 0 run records</span></p></div><div class=\"mt-6\"><p class=\"font-mono text-[11px] uppercase tracking-wider text-muted-foreground\">Kept — not touched</p><p class=\"mt-1.5 rounded-md border border-border bg-transparent p-4 text-[12px] text-muted-foreground\">No chat threads to keep.</p></div><div class=\"mt-5 flex items-center justify-end gap-2\"><button type=\"button\" class=\"h-10 rounded-md border border-border px-4 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground\">Keep it</button><button type=\"button\" data-testid=\"delete-forever\" class=\"h-10 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90\">Delete forever</button></div><p class=\"mt-4 text-right text-[12px] italic text-muted-foreground\">✎ Recorded with your name in the audit log.</p></div></div><button type=\"button\" class=\"absolute right-4 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-x h-4 w-4\" aria-hidden=\"true\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg><span class=\"sr-only\">Close</span></button>",
  loadedInFlight:
    "<button type=\"button\" aria-label=\"Dismiss\" class=\"mx-auto mt-2 mb-1 flex h-5 w-full max-w-[120px] cursor-grab items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring\"><span class=\"sheet-grip block h-1.5 w-10 rounded-full bg-border\"></span></button><div class=\"flex-1 overflow-y-auto\"><div class=\"flex flex-col space-y-1.5 px-4 pb-2 text-left\"><h2 id=\"radix-USEID\" class=\"text-lg font-semibold leading-none tracking-tight\">Delete this workflow?</h2></div><div id=\"wf-delete-pub-1\" class=\"px-4 pb-4\"><div><p class=\"font-mono text-[11px] uppercase tracking-wider text-muted-foreground\">Permanently removed</p><p class=\"mt-1.5 flex flex-col gap-0.5 rounded-md border border-border bg-muted/40 p-4\"><span class=\"text-sm font-medium text-foreground\">Vendor-risk review</span><span class=\"text-[12px] text-muted-foreground\">2 versions · 5 run records</span></p></div><div class=\"mt-6\"><p class=\"font-mono text-[11px] uppercase tracking-wider text-muted-foreground\">Kept — not touched</p><p class=\"mt-1.5 rounded-md border border-border bg-transparent p-4 text-[12px] text-muted-foreground\">3 chat threads become normal chats — transcripts &amp; files stay. Your knowledge base is untouched.</p></div><div role=\"status\" data-testid=\"delete-inflight-banner\" class=\"mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-400\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-triangle-alert mt-0.5 h-4 w-4 flex-none\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"></path><path d=\"M12 9v4\"></path><path d=\"M12 17h.01\"></path></svg><span>1 run is still in progress. It’s cancelled safely first, then the workflow is deleted.</span></div><div class=\"mt-5 flex items-center justify-end gap-2\"><button type=\"button\" class=\"h-10 rounded-md border border-border px-4 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground\">Keep it</button><button type=\"button\" data-testid=\"delete-forever\" class=\"h-10 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90\">Delete forever</button></div><p class=\"mt-4 text-right text-[12px] italic text-muted-foreground\">✎ Recorded with your name in the audit log.</p></div></div><button type=\"button\" class=\"absolute right-4 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-x h-4 w-4\" aria-hidden=\"true\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg><span class=\"sr-only\">Close</span></button>",
  deleting:
    "<button type=\"button\" aria-label=\"Dismiss\" class=\"mx-auto mt-2 mb-1 flex h-5 w-full max-w-[120px] cursor-grab items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring\"><span class=\"sheet-grip block h-1.5 w-10 rounded-full bg-border\"></span></button><div class=\"flex-1 overflow-y-auto\"><div class=\"flex flex-col space-y-1.5 px-4 pb-2 text-left\"><h2 id=\"radix-USEID\" class=\"text-lg font-semibold leading-none tracking-tight\">Delete this workflow?</h2></div><div id=\"wf-delete-pub-1\" class=\"px-4 pb-4\"><div><p class=\"font-mono text-[11px] uppercase tracking-wider text-muted-foreground\">Permanently removed</p><p class=\"mt-1.5 flex flex-col gap-0.5 rounded-md border border-border bg-muted/40 p-4\"><span class=\"text-sm font-medium text-foreground\">Vendor-risk review</span><span class=\"text-[12px] text-muted-foreground\">2 versions · 5 run records</span></p></div><div class=\"mt-6\"><p class=\"font-mono text-[11px] uppercase tracking-wider text-muted-foreground\">Kept — not touched</p><p class=\"mt-1.5 rounded-md border border-border bg-transparent p-4 text-[12px] text-muted-foreground\">3 chat threads become normal chats — transcripts &amp; files stay. Your knowledge base is untouched.</p></div><div class=\"mt-5 flex items-center justify-end gap-2\"><span role=\"status\" class=\"inline-flex items-center gap-1.5 text-sm text-muted-foreground\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-loader-circle h-4 w-4 animate-spin\" aria-hidden=\"true\"><path d=\"M21 12a9 9 0 1 1-6.219-8.56\"></path></svg>Deleting…</span></div><p class=\"mt-4 text-right text-[12px] italic text-muted-foreground\">✎ Recorded with your name in the audit log.</p></div></div><button type=\"button\" class=\"absolute right-4 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-x h-4 w-4\" aria-hidden=\"true\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg><span class=\"sr-only\">Close</span></button>",
  deleted:
    "<button type=\"button\" aria-label=\"Dismiss\" class=\"mx-auto mt-2 mb-1 flex h-5 w-full max-w-[120px] cursor-grab items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring\"><span class=\"sheet-grip block h-1.5 w-10 rounded-full bg-border\"></span></button><div class=\"flex-1 overflow-y-auto\"><div class=\"flex flex-col space-y-1.5 px-4 pb-2 text-left\"><h2 id=\"radix-USEID\" class=\"text-lg font-semibold leading-none tracking-tight\">Delete this workflow?</h2></div><div id=\"wf-delete-pub-1\" class=\"px-4 pb-4\"><div><p class=\"font-mono text-[11px] uppercase tracking-wider text-muted-foreground\">Permanently removed</p><p class=\"mt-1.5 flex flex-col gap-0.5 rounded-md border border-border bg-muted/40 p-4\"><span class=\"text-sm font-medium text-foreground\">Vendor-risk review</span><span class=\"text-[12px] text-muted-foreground\">2 versions · 5 run records</span></p></div><div class=\"mt-6\"><p class=\"font-mono text-[11px] uppercase tracking-wider text-muted-foreground\">Kept — not touched</p><p class=\"mt-1.5 rounded-md border border-border bg-transparent p-4 text-[12px] text-muted-foreground\">3 chat threads become normal chats — transcripts &amp; files stay. Your knowledge base is untouched.</p></div><div class=\"mt-5 flex items-center justify-end gap-2\"><span role=\"status\" class=\"inline-flex items-center gap-1.5 text-sm font-medium text-foreground\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-check h-4 w-4 text-success\" aria-hidden=\"true\"><path d=\"M20 6 9 17l-5-5\"></path></svg>Deleted · recorded</span></div><p class=\"mt-4 text-right text-[12px] italic text-muted-foreground\">✎ Recorded with your name in the audit log.</p></div></div><button type=\"button\" class=\"absolute right-4 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-x h-4 w-4\" aria-hidden=\"true\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg><span class=\"sr-only\">Close</span></button>",
  error:
    "<button type=\"button\" aria-label=\"Dismiss\" class=\"mx-auto mt-2 mb-1 flex h-5 w-full max-w-[120px] cursor-grab items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring\"><span class=\"sheet-grip block h-1.5 w-10 rounded-full bg-border\"></span></button><div class=\"flex-1 overflow-y-auto\"><div class=\"flex flex-col space-y-1.5 px-4 pb-2 text-left\"><h2 id=\"radix-USEID\" class=\"text-lg font-semibold leading-none tracking-tight\">Delete this workflow?</h2></div><div id=\"wf-delete-pub-1\" class=\"px-4 pb-4\"><div><p class=\"font-mono text-[11px] uppercase tracking-wider text-muted-foreground\">Permanently removed</p><p class=\"mt-1.5 flex flex-col gap-0.5 rounded-md border border-border bg-muted/40 p-4\"><span class=\"text-sm font-medium text-foreground\">Vendor-risk review</span><span class=\"text-[12px] text-muted-foreground\">2 versions · 5 run records</span></p></div><div class=\"mt-6\"><p class=\"font-mono text-[11px] uppercase tracking-wider text-muted-foreground\">Kept — not touched</p><p class=\"mt-1.5 rounded-md border border-border bg-transparent p-4 text-[12px] text-muted-foreground\">3 chat threads become normal chats — transcripts &amp; files stay. Your knowledge base is untouched.</p></div><div class=\"mt-5 flex items-center justify-end gap-2\"><div class=\"flex items-center gap-2\"><span role=\"status\" class=\"text-sm text-destructive\">Couldn’t delete the workflow</span><button type=\"button\" data-testid=\"delete-retry\" class=\"inline-flex items-center rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive transition-colors hover:bg-destructive/20\">Try again</button></div></div><p class=\"mt-4 text-right text-[12px] italic text-muted-foreground\">✎ Recorded with your name in the audit log.</p></div></div><button type=\"button\" class=\"absolute right-4 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-x h-4 w-4\" aria-hidden=\"true\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg><span class=\"sr-only\">Close</span></button>",
  previewError:
    "<button type=\"button\" aria-label=\"Dismiss\" class=\"mx-auto mt-2 mb-1 flex h-5 w-full max-w-[120px] cursor-grab items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring\"><span class=\"sheet-grip block h-1.5 w-10 rounded-full bg-border\"></span></button><div class=\"flex-1 overflow-y-auto\"><div class=\"flex flex-col space-y-1.5 px-4 pb-2 text-left\"><h2 id=\"radix-USEID\" class=\"text-lg font-semibold leading-none tracking-tight\">Delete this workflow?</h2></div><div id=\"wf-delete-pub-1\" class=\"px-4 pb-4\"><div><p role=\"alert\" class=\"text-sm text-destructive\">Preview unavailable</p><div class=\"mt-4 flex justify-end\"><button type=\"button\" class=\"h-10 rounded-md border border-border px-4 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground\">Keep it</button></div></div></div></div><button type=\"button\" class=\"absolute right-4 top-3 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-x h-4 w-4\" aria-hidden=\"true\"><path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path></svg><span class=\"sr-only\">Close</span></button>",
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
    // ⚠ RE-BASELINED BY THE SKETCH-200 PORT (2026-08-20). The previous literal is kept here
    // rather than overwritten: it read `Loading the exact counts`. Sheet 200's §2 loading
    // specimen words this moment as *"Checking what this will remove…"* — which says WHY
    // there is a wait (the guard is fetching the exact victim before it will offer the
    // button) instead of naming the mechanism. The PROPERTY this case guards is untouched
    // and is the two absences below it, not the sentence.
    expect(loading).toContain("Checking what this will remove")
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

// ── 199-10 Task 3 — THE GRADED ACTION-GUARD LADDER, ASSERTED RATHER THAN ARGUED ──────

/**
 * Phase 199-10 Task 3 (DES-01) — sheet `c6-library-dialogs`'s delete sheet, and the thing a
 * presentation pass most easily breaks without noticing.
 *
 * ── THE PROBLEM THIS BLOCK EXISTS FOR ───────────────────────────────────────────────────
 * `WorkflowDeleteSheet.tsx`'s docblock states that TWO other live decisions are arguments
 * made BY REFERENCE to this guard — D-15 (the fork ships no confirm sheet, because a heavy
 * guard on a harmless action spends the vocabulary THIS one relies on) and D-18 (the draft
 * delete must be demonstrably LIGHTER) — and that both *"become false the moment this one
 * quietly weakens."*
 *
 * ⚠ UNTIL THIS BLOCK, THAT RELATIONSHIP LIVED ONLY IN PROSE. Each surface's own suite
 * asserted its own properties in isolation: the delete sheet's counts here, the fork's
 * confirm-freedom in `ForkNameDialog.test.tsx`. **Nothing in the repository compared them**,
 * so a re-presentation could have lightened the delete and left every suite green — which is
 * precisely the risk a phase whose PREMISE IS REMOVAL introduces. Removing text is this
 * phase's job. Removing a safety GRADE is not, and the difference is now machine-checkable.
 *
 * ⚠ THE COMPARISON IS ONE-DIRECTIONAL AND STRICT. It is not enough that the delete sheet is
 * heavy; it must be heavier THAN THE FORK, on every atom, with the fork scoring zero. A
 * "both are heavy" reading would be satisfied by exactly the drift D-15 forbids.
 */

import { ForkNameDialog } from "@/components/workflows/library/ForkNameDialog"

/**
 * The four atoms that MAKE a guard heavy, as detectors run over rendered markup. Each is a
 * property the 146-148 graded-action-guards rule assigns to the victim-naming grade and to no
 * lighter one. They are functions rather than inline regexes so the positive controls below
 * exercise the REAL detector rather than a copy of it.
 */
const GUARD_ATOMS = {
  /** EXACT server counts, stated before the destructive action is offered (D-LOCK-03). */
  statesExactCounts: (html: string) => /\d+ versions/.test(html) && /\d+ run records/.test(html),
  /** The victim named inside the removal claim, not merely mentioned somewhere. */
  namesItsVictim: (html: string) =>
    /Permanently removed/.test(html) && /Vendor-risk review/.test(html),
  /**
   * Destructive weight on the single irreversible control, AT REST.
   *
   * ⚠ THE VARIANT-PREFIX EXCLUSION IS LOAD-BEARING AND WAS MEASURED, NOT ANTICIPATED. The
   * first draft of this detector was a bare `/bg-destructive/` and it PASSED against a
   * deliberate plant that stripped the resting `bg-destructive` from the Delete-forever
   * control — because `hover:bg-destructive/90` survived on the same element and satisfied
   * the substring. A guard whose danger colour exists only on HOVER is no guard at all on
   * a touch device (D-14: touch has no hover), so the detector now requires the utility to
   * stand at a class boundary with no variant prefix in front of it. Re-driven against the
   * same plant afterwards, it went red.
   */
  wearsDestructiveWeight: (html: string) =>
    /(?:^|[\s"])bg-destructive(?=[\s"\/]|$)/.test(html),
  /** The audit receipt — the ✎ convention, consequence ≠ receipt (146-148). */
  carriesAnAuditReceipt: (html: string) => /✎/.test(html),
} as const

const gradeOf = (html: string): number =>
  Object.values(GUARD_ATOMS).filter((detect) => detect(html)).length

/** Render the fork prompt in isolation and read its markup. */
function forkHtml(): string {
  const rendered = render(
    <ForkNameDialog
      open
      sourceName="Vendor-risk review"
      onCancel={vi.fn()}
      onCreate={vi.fn()}
      isClash={() => false}
    />,
  )
  const html = screen.getByTestId("fork-name-dialog").outerHTML
  rendered.unmount()
  return html
}

describe("199-10 — the delete sheet is DEMONSTRABLY the heaviest grade, and the fork the lightest", () => {
  it("POSITIVE CONTROL — every detector fires on markup that carries its atom", () => {
    // Without this, a fork scoring 0 proves nothing: four broken detectors score 0 too.
    expect(GUARD_ATOMS.statesExactCounts("x · 3 versions · 12 run records")).toBe(true)
    expect(GUARD_ATOMS.namesItsVictim("<p>Permanently removed</p><b>Vendor-risk review</b>")).toBe(
      true,
    )
    expect(GUARD_ATOMS.wearsDestructiveWeight('<button class="bg-destructive">x</button>')).toBe(
      true,
    )
    // ⚠ THE CONTROL THAT MATTERS — a hover-only danger colour must NOT count as weight.
    expect(
      GUARD_ATOMS.wearsDestructiveWeight('<button class="bg-muted hover:bg-destructive/90">x</button>'),
    ).toBe(false)
    // …and the shipped shape, which carries BOTH, still does.
    expect(
      GUARD_ATOMS.wearsDestructiveWeight('<button class="bg-destructive hover:bg-destructive/90">x</button>'),
    ).toBe(true)
    expect(GUARD_ATOMS.carriesAnAuditReceipt("<p>✎ Recorded with your name</p>")).toBe(true)
    // NEGATIVE CONTROL — and none of them fires on markup that carries none of it.
    expect(gradeOf("<div>Name your copy</div>")).toBe(0)
  })

  it("the delete sheet scores FOUR of four — all four guard properties, re-asserted after the phase", async () => {
    const html = await sheetHtml("loadedZeroThreads")
    expect(html.length).toBeGreaterThan(500) // non-vacuity before any grade is read
    // Named individually rather than only as a total, so a failure says WHICH property went.
    expect(GUARD_ATOMS.statesExactCounts(html), "exact server counts").toBe(true)
    expect(GUARD_ATOMS.namesItsVictim(html), "names its victim").toBe(true)
    expect(GUARD_ATOMS.wearsDestructiveWeight(html), "destructive weight").toBe(true)
    expect(GUARD_ATOMS.carriesAnAuditReceipt(html), "audit receipt").toBe(true)
    expect(gradeOf(html)).toBe(4)
  })

  it("the counts are FETCHED BEFORE the destructive action is offered — never rendered alongside a guess", async () => {
    // The fourth property's ordering half, which a static read of the loaded state cannot see.
    // While the preview is in flight the sheet offers NO destructive control at all, and shows
    // no number: a placeholder count beside an armed Delete is the failure D-LOCK-03 prevents.
    const loading = await sheetHtml("loading")
    expect(loading.length).toBeGreaterThan(300)
    expect(loading).not.toContain("delete-forever")
    expect(loading).not.toMatch(/\d+ versions/)
    expect(loading).not.toMatch(/\d+ run records/)
    // …and the loaded state DOES offer it, so the absence above is ordering, not a dead control.
    expect(await sheetHtml("loadedZeroThreads")).toContain("delete-forever")
  })

  it("the amber cancel-first banner is raised ONLY when a run is live, and it is amber not red", async () => {
    const quiet = await sheetHtml("loadedZeroThreads")
    const live = await sheetHtml("loadedInFlight")
    expect(quiet).not.toContain("delete-inflight-banner")
    expect(live).toContain("delete-inflight-banner")
    // Amber, never red — the graded rule spends danger colour on the ACTION, not on the notice.
    expect(live).toMatch(/delete-inflight-banner[\s\S]{0,200}amber-/)
  })

  it("the fork prompt scores ZERO of four — it is not a lighter guard, it is outside the ladder", () => {
    const html = forkHtml()
    expect(html.length).toBeGreaterThan(300) // non-vacuity: it really rendered
    expect(html).toContain("Name your copy") // …and it really is the fork prompt
    expect(GUARD_ATOMS.statesExactCounts(html), "fork states counts").toBe(false)
    expect(GUARD_ATOMS.namesItsVictim(html), "fork names a victim").toBe(false)
    expect(GUARD_ATOMS.wearsDestructiveWeight(html), "fork wears destructive weight").toBe(false)
    expect(GUARD_ATOMS.carriesAnAuditReceipt(html), "fork carries a receipt").toBe(false)
    expect(gradeOf(html)).toBe(0)
  })

  it("THE ORDERING ITSELF — delete > fork, strictly, on the same scale", async () => {
    // The assertion D-15 and D-18 have been leaning on in prose since Phase 192.
    const heavy = gradeOf(await sheetHtml("loadedZeroThreads"))
    const light = gradeOf(forkHtml())
    expect(heavy).toBeGreaterThan(light)
    expect(heavy - light).toBe(4)
  })

  /**
   * SKETCH 200 §3, "WHY THEY LOOK DIFFERENT", DRIVEN AS A TABLE.
   *
   * The sheet does not merely draw two dialogs — it publishes the four rules that make them
   * unequal, one row each, with a yes/no per dialog. Those four rows ARE the four detectors
   * above, in the sheet's own order, so the port can be checked against the reference rather
   * than against a memory of it. If a later change levels the ladder, this is the case that
   * names WHICH rule went, in the sheet's own words.
   *
   * ⚠ ROW 3 IS THE ONE THE PORT ACTUALLY CHANGED, AND ITS WORDING IS THE POINT: the sheet
   * says *"yes, ON THE BUTTON ONLY"*, not simply "yes". The pre-port sheet spent red twice —
   * on the `Permanently removed` caption AND on the control — so the caption competed with
   * the only irreversible thing in the dialog. The second half of this case measures the
   * "only" by counting resting `bg-destructive` / `text-destructive` occurrences in the AT-REST
   * loaded state, where the sheet's answer is exactly one.
   */
  it("sketch 200 §3 — the four rules, as a table, with the sheet's own yes/no per dialog", async () => {
    const heavyHtml = await sheetHtml("loadedZeroThreads")
    const lightHtml = forkHtml()
    // Non-vacuity before any row is read — two empty strings satisfy four `false`s.
    expect(heavyHtml.length).toBeGreaterThan(500)
    expect(lightHtml.length).toBeGreaterThan(300)

    const RULES = [
      ["Names what it affects", GUARD_ATOMS.namesItsVictim],
      ["States exact numbers first", GUARD_ATOMS.statesExactCounts],
      ["Spends danger colour", GUARD_ATOMS.wearsDestructiveWeight],
      ["Leaves a receipt", GUARD_ATOMS.carriesAnAuditReceipt],
    ] as const
    for (const [rule, detect] of RULES) {
      expect(detect(heavyHtml), `deleting — ${rule}`).toBe(true)
      expect(detect(lightHtml), `making a copy — ${rule}`).toBe(false)
    }

    // Row 3's qualifier, measured: at rest, the loaded delete dialog spends its danger
    // colour on ONE element. `hover:` variants are excluded because the rule is about what
    // a person sees before they reach for anything (D-14 — touch has no hover).
    const restingRed = (heavyHtml.match(/(?:^|[\s"])(?:bg|text)-destructive(?=[\s"/]|$)/g) ?? [])
    expect(restingRed).toHaveLength(1)
    // POSITIVE CONTROL — the counter really does find a second one when there is one.
    expect(
      ('<p class="text-destructive">x</p><button class="bg-destructive">y</button>'.match(
        /(?:^|[\s"])(?:bg|text)-destructive(?=[\s"/]|$)/g,
      ) ?? []).length,
    ).toBe(2)
    // …and the one it found is on the CONTROL, not on a label.
    expect(heavyHtml).toMatch(/data-testid="delete-forever"[^>]*class="[^"]*\bbg-destructive\b/)
  })

  it("no optimistic vanish and no undo — re-asserted as a PROPERTY OF THE MARKUP after the phase", async () => {
    // The behavioural halves are driven elsewhere in this file (the cascade + re-fetch cases).
    // What is added here is the negative a re-presentation could introduce without touching
    // behaviour at all: an "Undo" affordance on the terminal state.
    const done = await sheetHtml("deleted")
    expect(done.length).toBeGreaterThan(300)
    expect(done).toContain("Deleted · recorded")
    expect(done).not.toMatch(/\bundo\b/i)
    expect(done).not.toMatch(/\brestore\b/i)
    // POSITIVE CONTROL — the matcher does find those words when they are there.
    expect("<button>Undo</button>").toMatch(/\bundo\b/i)
  })
})

/**
 * ── SHEET c6's DELETE DRAWING, RECONCILED ───────────────────────────────────────────────
 *
 * The sheet's whole consequence line is *"This will permanently remove 12 historical runs and
 * 5 configured phases."* — ALREADY-SHIPPED, and the shipped one is HEAVIER: it splits Removed
 * from KEPT, states the exact server counts for both, and adds the audit receipt the drawing
 * has no concept of.
 *
 * ⚠ ITS ONE GENUINELY DIFFERENT MOVE — naming the victim in the TITLE (*"Delete Daily Summary
 * Extraction?"* against the shipped *"Delete this workflow?"*) — IS REFUSED, and the reason is
 * mechanical rather than aesthetic. The title renders BEFORE the preview resolves, so it could
 * only be fed from `wf.name`: the LIST FEED's cached copy. The victim in the consequence line
 * is fed from `preview.name`, which is fetched at open time. Adopting the sheet would put TWO
 * sources for one victim's name on one surface, and the earlier, larger, more prominent one
 * would be the STALE one — a guard whose headline can name a different workflow than its
 * consequence is weaker than one that names it once, from the server, at the moment of asking.
 * Asserted below rather than left as a claim in a summary.
 */
describe("199-10 — the victim is named ONCE, from the server, at the moment of asking", () => {
  it("the headline makes no claim about WHICH workflow; the consequence line does, from the preview", async () => {
    const html = await sheetHtml("loadedZeroThreads")
    // The generic headline is deliberate: it cannot go stale because it names nothing.
    expect(html).toContain("Delete this workflow?")
    // And the name appears exactly once, inside the Removed group.
    const occurrences = html.split("Vendor-risk review").length - 1
    expect(occurrences).toBe(1)
    expect(html).toMatch(/Permanently removed[\s\S]{0,300}Vendor-risk review/)
  })

  it("while the preview is in flight the sheet names NO victim at all — it has not been told one yet", async () => {
    const loading = await sheetHtml("loading")
    expect(loading).toContain("Delete this workflow?")
    expect(loading).not.toContain("Vendor-risk review")
  })
})
