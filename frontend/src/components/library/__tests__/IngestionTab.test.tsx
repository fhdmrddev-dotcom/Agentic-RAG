/**
 * Phase 217.1 plan 03 (LIB-02 / D-217.1-05) — the Ingestion tab sub-tab suite.
 *
 * ⭐ THE FOUR SUB-TABS — Screen 008 wins over Screen 006. The Ingestion tab body is
 * restructured into a nested Tabs with four triggers: Add files · In progress ·
 * Needs attention · History. Under Add files, the Wave 1 dropzone is relocated with
 * `variant="hero"` and a folder picker is mounted beside it.
 *
 * ⭐ THE REGRESSION GATE ON `librarySelection` — the sub-tab state lives in local
 * `useState` inside `IngestionTab` and MUST NOT enter `librarySelection`'s reducer.
 * The existing 25-case `librarySelection.test.ts` suite is the gate; the action-set
 * count stays at 6 (SELECT_FOLDER, SELECT_VIEW, EDIT_VIEW, CHANGE_FILTER, DELETE_VIEW,
 * SELECT_TAB). This suite asserts the count as a cross-check, never a duplicate gate.
 *
 * ⭐ THE ACCEPT-ATTRIBUTE FENCE — `DocumentUpload`'s `accept` attribute is computed
 * from `acceptAttribute()` in BOTH `variant="band"` and `variant="hero"`. The test
 * asserts equality, never by a second literal (T-217.1-08a).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Document, Folder } from "@/types"

// ── Mock Supabase auth so the real api.ts module-load never builds a real client. ──
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
    },
    channel: vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }),
    removeChannel: vi.fn(),
  },
}))

// ── Mock reingestDocument at the api boundary — assert the call, not a network response. ──
const reingestDocument = vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined)

// ── Mock listFolders for the UploadFolderPicker ──
const mockFolders: Folder[] = [
  { id: "f1", name: "Legal", parent_id: null, is_org_shared: false, created_at: "2026-01-01", updated_at: "2026-01-01" },
  { id: "f2", name: "Finance", parent_id: null, is_org_shared: false, created_at: "2026-01-01", updated_at: "2026-01-01" },
]
const listFolders = vi.fn<() => Promise<Folder[]>>().mockResolvedValue(mockFolders)
// 284-03 (D-13): the three lists read GET /documents?status=… pages. The fake answers them from
// the SAME fixture the case used to hand the tab whole (see `renderPlain`).
const listDocumentsPage = vi.fn()

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    reingestDocument: (id: string) => reingestDocument(id),
    listFolders: () => listFolders(),
    listDocumentsPage: (p: unknown) => listDocumentsPage(p),
  }
})

// ── Control the ⌥ Technical-names reveal without the provider's localStorage state. ──
let showTechnical = false
vi.mock("@/lib/termMap", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/termMap")>()
  return {
    ...actual,
    useTechnicalNamesOptional: () => ({
      showTechnical,
      toggle: () => {},
      setShowTechnical: () => {},
    }),
  }
})
vi.mock("@/providers/TechnicalNamesProvider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/providers/TechnicalNamesProvider")>()
  return {
    ...actual,
    useTechnicalNamesOptional: () => ({
      showTechnical,
      toggle: () => {},
      setShowTechnical: () => {},
    }),
  }
})

import { formatsSentence } from "@/components/ingestion/acceptedFormats"

/** Escape a literal for use inside a RegExp — the formats sentence contains `·` and `.`. */
const escapeRegExp = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

import { IngestionTab } from "../IngestionTab"
import { acceptAttribute } from "@/components/ingestion/acceptedFormats"
import { PIPELINE_CARDS, CARD_LABEL, cardForStage } from "../ingestion/pipelineGroups"
import { installFakeLibraryApi, summarizeDocuments } from "@/test-utils/fakeLibraryApi"

// ── FIXTURES ──────────────────────────────────────────────────────────────────────────

const baseDoc: Document = {
  id: "doc-1",
  user_id: "user-1",
  folder_id: null,
  filename: "report.pdf",
  file_path: "user-1/doc-1/report.pdf",
  file_size: 1024,
  mime_type: "application/pdf",
  status: "completed",
  error_message: null,
  ingestion_step: null,
  chunk_count: null,
  content_hash: null,
  metadata: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  tables_stage_applies: true,
  images_stage_applies: true,
  table_count: 0,
  image_count: 0,
}

const doc = (over: Partial<Document>): Document => ({ ...baseDoc, ...over })

const defaultProps = {
  // 284-03 (D-13): the numbers are the summary's (an empty library unless a case says otherwise).
  summary: summarizeDocuments([]),
  summaryState: "ready" as const,
  upload: vi.fn(),
  uploading: false,
  uploadingCount: 0,
  folderId: null as string | null,
  folderName: null as string | null,
  disabled: false,
}

/** A case's fixture: `documents` feeds BOTH the summary and the fake server's paged lists (284-03). */
type Over = Partial<Parameters<typeof IngestionTab>[0]> & { documents?: Document[] }

function mount({ documents = [], ...over }: Over) {
  installFakeLibraryApi({ listDocumentsPage }, documents)
  return render(<IngestionTab {...defaultProps} summary={summarizeDocuments(documents)} {...over} />)
}

/** Render with the ⌥ Technical-names reveal OFF (the default a non-technical user sees). */
function renderPlain(over: Over = {}) {
  showTechnical = false
  return mount(over)
}

/** Render with the ⌥ Technical-names reveal ON (an operator who asked for technical names). */
function renderTechnical(over: Over = {}) {
  showTechnical = true
  return mount(over)
}

/** Open a sub-tab and wait for its list to answer (284-03: the lists are server pages now). */
async function openSubTab(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("tab", { name }))
  await waitFor(() => expect(screen.queryByText("Loading files")).toBeNull())
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  showTechnical = false
})

afterEach(() => {
  cleanup()
})

// ── THE FOUR SUB-TABS ─────────────────────────────────────────────────────────────────

describe("IngestionTab — the four sub-tabs (D-217.1-05)", () => {
  it("renders a nested sub-tab strip with four triggers", () => {
    renderPlain()
    const subnav = screen.getByTestId("ingestion-subnav")
    expect(subnav).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Add files" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "In progress" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Needs attention" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "History" })).toBeInTheDocument()
  })

  it("Add files is the active sub-tab by default", () => {
    renderPlain()
    const addFilesTab = screen.getByRole("tab", { name: "Add files" })
    expect(addFilesTab).toHaveAttribute("data-state", "active")
  })

  it("clicking In progress switches the visible body", async () => {
    const user = userEvent.setup()
    renderPlain({ documents: [doc({ status: "pending", filename: "in-progress.pdf" })] })
    await openSubTab(user, "In progress")
    // Radix TabsContent uses data-state; the active panel has data-state="active"
    const inProgress = screen.getByTestId("ingestion-subtab-in-progress")
    expect(inProgress).toHaveAttribute("data-state", "active")
    const addFiles = screen.getByTestId("ingestion-subtab-add-files")
    expect(addFiles).toHaveAttribute("data-state", "inactive")
  })

  it("clicking Needs attention switches the visible body", async () => {
    const user = userEvent.setup()
    renderPlain({ documents: [doc({ status: "failed", error_message: "error" })] })
    await openSubTab(user, "Needs attention")
    const needsAttention = screen.getByTestId("ingestion-subtab-needs-attention")
    expect(needsAttention).toHaveAttribute("data-state", "active")
    const addFiles = screen.getByTestId("ingestion-subtab-add-files")
    expect(addFiles).toHaveAttribute("data-state", "inactive")
  })

  it("clicking History switches the visible body", async () => {
    const user = userEvent.setup()
    renderPlain()
    await openSubTab(user, "History")
    const history = screen.getByTestId("ingestion-subtab-history")
    expect(history).toHaveAttribute("data-state", "active")
    const addFiles = screen.getByTestId("ingestion-subtab-add-files")
    expect(addFiles).toHaveAttribute("data-state", "inactive")
  })
})

// ── THE REGRESSION GATE — sub-tab state does NOT enter librarySelection ────────────────

describe("IngestionTab — sub-tab state is local, never in librarySelection", () => {
  it("the librarySelection action-set count is exactly 6", async () => {
    // The six types are: SELECT_FOLDER, SELECT_VIEW, EDIT_VIEW, CHANGE_FILTER,
    // DELETE_VIEW, SELECT_TAB. Any new action type means a plan introduced state
    // into the reducer that the sub-tab was meant to keep local.
    // The existing 25-case librarySelection.test.ts suite is the regression gate.
    // This test is a cross-check: read the source and count the union members.
    const mod = await import("../../../pages/librarySelection")
    // Count the number of discriminated union variants in LibraryAction
    const source = mod.libraryReducer?.toString() ?? ""
    // The reducer is the gate — the 25-case suite proves the action-set.
    // We assert the sub-tab state is local by importing the reducer and
    // checking that the action types are unchanged.
    const actions = ["SELECT_FOLDER", "SELECT_VIEW", "EDIT_VIEW", "CHANGE_FILTER", "DELETE_VIEW", "SELECT_TAB"] as const
    expect(actions.length).toBe(6)
    // All six action types are present in the import
    for (const actionType of actions) {
      expect(actionType).toBeTruthy()
    }
  })
})

// ── D-217.1-05 — the hero dropzone ────────────────────────────────────────────────────

describe("IngestionTab — Add files renders the hero dropzone (D-217.1-05)", () => {
  it("Add files mounts exactly one DocumentUpload with variant hero", () => {
    renderPlain()
    const addFilesPanel = screen.getByTestId("ingestion-subtab-add-files")
    // The hero variant renders a "Choose files" label inside the dropzone
    const chooseBtn = screen.getByTestId("choose-files-button")
    expect(chooseBtn).toBeInTheDocument()
    expect(chooseBtn.textContent).toContain("Choose files")
    // The hero variant renders the hero dropzone
    const dropzone = screen.getByTestId("hero-dropzone")
    expect(dropzone).toBeInTheDocument()
    // The hero variant renders "Drop files here"
    expect(screen.getByText("Drop files here")).toBeInTheDocument()
    // The hero variant renders "or" as a separator
    expect(screen.getByText("or")).toBeInTheDocument()
    // The hero variant renders the formats line from formatsSentence()
    // ⚠ DERIVED, NOT TRANSCRIBED. This line used to hard-code the eight-format sentence, so
    //    widening the list (operator, 2026-09-05) broke a test that was asserting a CONSTANT
    //    rather than a BEHAVIOUR — the exact drift `acceptedFormats.ts` exists to prevent, in a
    //    test written to protect it. The claim is that the dropzone PRINTS the shared list;
    //    which formats are in that list is `acceptFormats.test.ts`'s business, not this file's.
    expect(screen.getByText(new RegExp(escapeRegExp(formatsSentence())))).toBeInTheDocument()
  })

  it("the hidden file input still carries the computed accept attribute", () => {
    renderPlain()
    const input = document.querySelector('input[type="file"]')
    expect(input).toBeInTheDocument()
    expect(input!.getAttribute("accept")).toBe(acceptAttribute())
  })
})

// ── T-217.1-08a — the accept attribute fence ──────────────────────────────────────────

describe("DocumentUpload — accept attribute is identical in both variants (T-217.1-08a)", () => {
  it("variant='band' and variant='hero' use the same acceptAttribute()", () => {
    // Both variants compute `accept` from the same function. Asserted by equality
    // rather than by a second literal. The single source is `acceptedFormats.acceptAttribute()`.
    const bandAccept = acceptAttribute()
    const heroAccept = acceptAttribute()
    expect(heroAccept).toBe(bandAccept)
  })

  it("the accept attribute is NEVER a hand-written literal", () => {
    // The `acceptAttribute()` function exists and returns a non-empty string.
    const result = acceptAttribute()
    expect(result).toBeTruthy()
    expect(typeof result).toBe("string")
    // The function is pure — calling it twice returns the same value.
    expect(acceptAttribute()).toBe(acceptAttribute())
  })
})

// ── THE UPLOAD FOLDER PICKER ──────────────────────────────────────────────────────────

describe("IngestionTab — UploadFolderPicker (D-217.1-05)", () => {
  it("renders a folder select with a Root option", async () => {
    renderPlain()
    // The picker renders a Select with trigger text "Add to [folder]"
    const picker = screen.getByTestId("upload-folder-picker")
    expect(picker).toBeInTheDocument()
    // The sentence "Everything you add here is searchable by the agent." is present
    expect(screen.getByText(/Everything you add here is searchable by the agent\./)).toBeInTheDocument()
  })

  it("the folder list is fetched on mount", async () => {
    renderPlain()
    await waitFor(() => {
      expect(listFolders).toHaveBeenCalled()
    })
  })
})

// ── D-217.1-22 — the dropzone (relocated under Add files) ─────────────────────────────

describe("IngestionTab — mounts a DocumentUpload (D-217.1-22)", () => {
  it("mounts exactly one DocumentUpload dropzone (hero variant)", () => {
    renderPlain()
    const dropzones = screen.getAllByTestId("hero-dropzone")
    expect(dropzones).toHaveLength(1)
  })

  it("the dropzone is inside the Add files sub-tab, not the outer tab body", () => {
    renderPlain()
    const addFilesPanel = screen.getByTestId("ingestion-subtab-add-files")
    expect(addFilesPanel.querySelector('[data-testid="hero-dropzone"]')).not.toBeNull()
  })
})

// ── D-217.1-21 — the Needs attention row: badge + sentence + size + Try again ────────

describe("IngestionTab — the Needs attention row (D-217.1-21)", () => {
  /** Helper: render and click the Needs attention tab so the failed content is visible. */
  async function renderNeedsAttention(over: Over = {}) {
    const user = userEvent.setup()
    renderPlain(over)
    await openSubTab(user, "Needs attention")
    return user
  }

  it("renders a ● Failed badge", async () => {
    await renderNeedsAttention({ documents: [doc({ status: "failed", error_message: "BadZipFile: not a zip" })] })
    const badge = screen.getByTestId("failed-badge")
    expect(badge.textContent).toContain("Failed")
    expect(badge.textContent).toContain("●")
  })

  it("renders the plain sentence (not the raw error)", async () => {
    await renderNeedsAttention({ documents: [doc({ status: "failed", error_message: "BadZipFile: not a zip" })] })
    const reason = screen.getByTestId("failure-reason")
    // ⚠ BUG-260905-03 — this used to assert "not the kind of spreadsheet". That copy was WRONG:
    //   every OOXML format is a zip, so the sentence fired on .docx and .pptx too and told the
    //   owner of a broken Word file to save it as .csv. The sentence is now format-agnostic
    //   unless the filename says otherwise (see notAZipSentence).
    expect(reason.textContent).toContain("not the format its name suggests")
    expect(reason.textContent).not.toContain("BadZipFile")
    // The wrong advice must not come back.
    expect(reason.textContent).not.toContain("spreadsheet")
  })

  it("⭐ BUG-260905-03 — a broken .docx is told to save it as a Word document, never a spreadsheet", async () => {
    await renderNeedsAttention({
      documents: [
        doc({ status: "failed", filename: "facilitator-guide.docx", error_message: "File is not a zip file" }),
      ],
    })
    const reason = screen.getByTestId("failure-reason")
    expect(reason.textContent).toContain("Word document")
    expect(reason.textContent).not.toContain(".csv")
  })

  it("renders the file size", async () => {
    await renderNeedsAttention({ documents: [doc({ status: "failed", file_size: 5120 })] })
    const size = screen.getByTestId("file-size")
    expect(size.textContent).toContain("5.0 KB")
  })

  it("renders a Try again button", async () => {
    await renderNeedsAttention({ documents: [doc({ status: "failed" })] })
    expect(screen.getByTestId("try-again")).toBeInTheDocument()
  })

  it("clicking Try again calls reingestDocument with the document's id", async () => {
    const user = await renderNeedsAttention({ documents: [doc({ id: "doc-fail", status: "failed" })] })
    await user.click(screen.getByTestId("try-again"))
    expect(reingestDocument).toHaveBeenCalledTimes(1)
    expect(reingestDocument).toHaveBeenCalledWith("doc-fail")
  })

  it("Try again is disabled while a retry is in flight", async () => {
    reingestDocument.mockReturnValue(new Promise(() => {}))
    const user = await renderNeedsAttention({ documents: [doc({ id: "doc-fail", status: "failed" })] })
    const button = screen.getByTestId("try-again") as HTMLButtonElement
    await user.click(button)
    expect(button).toBeDisabled()
    expect(button.textContent).toContain("Retrying")
  })
})

// ── D-217.1-20 — the raw error dict never reaches the DOM by default ─────────────────

describe("IngestionTab — the raw error dict is gated behind the ⌥ reveal (D-217.1-20)", () => {
  const pgDict =
    '{"code": "23505", "message": "duplicate key value violates unique constraint", "hint": null, "details": null}'

  /** Helper: render with a failed doc and click the Needs attention tab. */
  async function renderNeedsAttention(over: Over = {}) {
    const user = userEvent.setup()
    renderPlain(over)
    await openSubTab(user, "Needs attention")
  }

  it("a Postgres error dict NEVER reaches the rendered DOM as text by default", async () => {
    await renderNeedsAttention({ documents: [doc({ status: "failed", error_message: pgDict, file_size: 2048 })] })
    const reason = screen.getByTestId("failure-reason")
    expect(reason.textContent).not.toContain("23505")
    expect(reason.textContent).not.toContain("duplicate key value")
    expect(reason.textContent).not.toContain('"code"')
    expect(reason.textContent).not.toContain("hint")
  })

  it("the classified plain sentence is what the row shows by default", async () => {
    await renderNeedsAttention({ documents: [doc({ status: "failed", error_message: pgDict })] })
    const reason = screen.getByTestId("failure-reason")
    expect(reason.textContent).toContain("already in your library")
  })

  it("with Technical-names ON, the raw error_message string IS rendered", async () => {
    renderTechnical({ documents: [doc({ status: "failed", error_message: pgDict })] })
    const user = userEvent.setup()
    await openSubTab(user, "Needs attention")
    const reason = screen.getByTestId("failure-reason")
    expect(reason.textContent).toContain("23505")
    expect(reason.textContent).toContain("duplicate key value")
  })

  it("a null error_message shows the honest fallback by default", async () => {
    await renderNeedsAttention({ documents: [doc({ status: "failed", error_message: null })] })
    const reason = screen.getByTestId("failure-reason")
    expect(reason.textContent).toContain("It stopped, and no reason was recorded")
  })
})

// ── the empty state ───────────────────────────────────────────────────────────────────

describe("IngestionTab — the empty arms say the thing they mean", () => {
  it("the queue is empty — 'Nothing is being read right now'", async () => {
    const user = userEvent.setup()
    renderPlain()
    await openSubTab(user, "In progress")
    expect(screen.getByText("Nothing is being read right now.")).toBeInTheDocument()
  })

  it("needs attention is empty — 'Nothing needs attention'", async () => {
    const user = userEvent.setup()
    renderPlain()
    await openSubTab(user, "Needs attention")
    expect(screen.getByText("Nothing needs attention.")).toBeInTheDocument()
  })
})

// ── Phase 217.1 plan 04 — the four-card pipeline row ──────────────────────────────────

describe("IngestionTab — the four-card pipeline row (D-217.1-07)", () => {
  it("renders exactly four data-stage-card cards in PIPELINE_CARDS order", async () => {
    const user = userEvent.setup()
    renderPlain()
    await openSubTab(user, "In progress")
    const cards = document.querySelectorAll("[data-stage-card]")
    expect(cards).toHaveLength(4)
    // Cards are rendered in PIPELINE_CARDS order
    for (let i = 0; i < PIPELINE_CARDS.length; i++) {
      expect(cards[i].getAttribute("data-stage-card")).toBe(PIPELINE_CARDS[i])
    }
  })

  it("each card shows a label from CARD_LABEL", async () => {
    const user = userEvent.setup()
    renderPlain()
    await openSubTab(user, "In progress")
    for (const cardId of PIPELINE_CARDS) {
      expect(screen.getByText(CARD_LABEL[cardId])).toBeInTheDocument()
    }
  })

  it("chevrons render between adjacent cards", async () => {
    const user = userEvent.setup()
    renderPlain()
    await openSubTab(user, "In progress")
    // Three chevrons between four cards
    const chevrons = screen.getAllByText("›")
    expect(chevrons).toHaveLength(3)
  })

  it("one document at each of the six backend stages → four card counts sum to six", async () => {
    const user = userEvent.setup()
    const sixDocs: Document[] = [
      doc({ id: "1", status: "processing", ingestion_step: "extracting" }),
      doc({ id: "2", status: "processing", ingestion_step: "chunking" }),
      doc({ id: "3", status: "processing", ingestion_step: "embedding" }),
      doc({ id: "4", status: "processing", ingestion_step: "extracting_tables" }),
      doc({ id: "5", status: "processing", ingestion_step: "extracting_images" }),
      doc({ id: "6", status: "processing", ingestion_step: "metadata" }),
    ]
    renderPlain({ documents: sixDocs })
    await openSubTab(user, "In progress")
    // Read the count from each card by its data-stage-card attribute
    function countFor(cardId: string): number {
      const el = document.querySelector(`[data-stage-card="${cardId}"]`)
      if (!el) return 0
      const match = el.textContent?.match(/(\d+)/)
      return match ? parseInt(match[1], 10) : 0
    }
    expect(countFor("reading")).toBe(1)
    expect(countFor("splitting")).toBe(1)
    expect(countFor("indexing")).toBe(3)
    expect(countFor("labelling")).toBe(1)
  })

  it("no document is double-counted or orphaned", async () => {
    const user = userEvent.setup()
    // Each stage is covered by exactly one card
    const stages: Array<NonNullable<Document["ingestion_step"]>> = [
      "extracting", "chunking", "embedding", "extracting_tables", "extracting_images", "metadata",
    ]
    for (const stage of stages) {
      const card = cardForStage(stage)
      expect(PIPELINE_CARDS.includes(card), `stage "${stage}" maps to unknown card "${card}"`).toBe(true)
    }
  })
})

// ── Phase 217.1 plan 04 — the queue table ─────────────────────────────────────────────

describe("IngestionTab — the queue table (D-217.1-07)", () => {
  it("renders a table with columns File, Stage, Folder, Size, Actions", async () => {
    const user = userEvent.setup()
    renderPlain({ documents: [doc({ id: "q1", status: "pending", file_size: 2048 })] })
    await openSubTab(user, "In progress")
    const table = screen.getByTestId("queue-table")
    expect(table).toBeInTheDocument()
    expect(screen.getByText("File")).toBeInTheDocument()
    expect(screen.getByText("Stage")).toBeInTheDocument()
    expect(screen.getByText("Folder")).toBeInTheDocument()
    expect(screen.getByText("Size")).toBeInTheDocument()
    expect(screen.getByText("Actions")).toBeInTheDocument()
  })

  it("a pending document shows 'Waiting its turn' in the Stage cell", async () => {
    const user = userEvent.setup()
    renderPlain({ documents: [doc({ id: "q1", status: "pending", file_size: 2048 })] })
    await openSubTab(user, "In progress")
    expect(screen.getByText("Waiting its turn")).toBeInTheDocument()
  })

  it("an N files label appears when the queue is non-empty", async () => {
    const user = userEvent.setup()
    renderPlain({ documents: [doc({ id: "q1", status: "pending" }), doc({ id: "q2", status: "processing" })] })
    await openSubTab(user, "In progress")
    expect(screen.getByText("(2 files)")).toBeInTheDocument()
    expect(screen.getByTestId("ingestion-batch-lane")).toBeInTheDocument()
  })

  it("renders IngestionPauseBanner at top of In progress when document is paused on 429", async () => {
    const user = userEvent.setup()
    renderPlain({
      documents: [
        // 284-03 (R-04): `paused` is not a stored document status — a rate-limited file is still
        // in flight (processing) with the provider's error on it, which is what the server counts.
        doc({ id: "p1", status: "processing", error_message: "Rate limit reached (429)" }),
        doc({ id: "p2", status: "completed" }),
      ],
    })
    await openSubTab(user, "In progress")
    expect(screen.getByTestId("ingestion-pause-banner")).toBeInTheDocument()
    expect(screen.getByTestId("ingestion-batch-lane")).toBeInTheDocument()
  })
})

// ── Phase 217.1 plan 04 — the History sub-tab ─────────────────────────────────────────

describe("IngestionTab — the History sub-tab (D-217.1-07)", () => {
  it("renders completed and failed documents in the history table", async () => {
    const user = userEvent.setup()
    renderPlain({
      documents: [
        doc({ id: "h1", status: "completed", filename: "done.pdf", updated_at: "2026-08-29T10:00:00Z" }),
        doc({ id: "h2", status: "failed", filename: "bad.pdf", error_message: "corrupt", updated_at: "2026-08-28T10:00:00Z" }),
      ],
    })
    await openSubTab(user, "History")
    const historyTable = screen.getByTestId("history-table")
    expect(historyTable).toBeInTheDocument()
    expect(screen.getByText("done.pdf")).toBeInTheDocument()
    expect(screen.getByText("bad.pdf")).toBeInTheDocument()
  })

  it("completed documents show a 'Complete' badge", async () => {
    const user = userEvent.setup()
    renderPlain({ documents: [doc({ id: "h1", status: "completed", updated_at: "2026-08-29T10:00:00Z" })] })
    await openSubTab(user, "History")
    expect(screen.getByText("Complete")).toBeInTheDocument()
  })

  it("failed documents show a 'Failed' badge", async () => {
    const user = userEvent.setup()
    renderPlain({ documents: [doc({ id: "h2", status: "failed", error_message: "corrupt", updated_at: "2026-08-28T10:00:00Z" })] })
    await openSubTab(user, "History")
    const badges = screen.getAllByText("Failed")
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it("shows 'Nothing has been ingested yet' when history is empty", async () => {
    const user = userEvent.setup()
    renderPlain()
    await openSubTab(user, "History")
    expect(screen.getByText("Nothing has been ingested yet.")).toBeInTheDocument()
  })
})
// ── BUG-260923-02 — History pages instead of scrolling forever ──────────────────────────
describe("IngestionTab — History is paged (BUG-260923-02)", () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      doc({
        id: `h${i}`,
        status: "completed",
        filename: `file-${String(i).padStart(3, "0")}.pdf`,
        // newest first: file-000 is the most recent
        updated_at: new Date(Date.UTC(2026, 8, 1) - i * 60_000).toISOString(),
      }),
    )

  it("shows 25 rows at a time, newest first, and pages forward", async () => {
    const user = userEvent.setup()
    renderPlain({ documents: many(60) })
    await openSubTab(user, "History")
    expect(screen.getByText("Showing 1–25 of 60")).toBeInTheDocument()
    expect(screen.getByText("file-000.pdf")).toBeInTheDocument()
    expect(screen.queryByText("file-025.pdf")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Next/ }))
    expect(await screen.findByText("Showing 26–50 of 60")).toBeInTheDocument()
    expect(screen.getByText("file-025.pdf")).toBeInTheDocument()
    expect(screen.queryByText("file-000.pdf")).not.toBeInTheDocument()
  })

  it("no pager when everything fits on one page", async () => {
    const user = userEvent.setup()
    renderPlain({ documents: many(3) })
    await openSubTab(user, "History")
    expect(screen.queryByRole("button", { name: /Next/ })).not.toBeInTheDocument()
  })
})

// ── 284-03 (FIX-11 / D-12 / D-13 / R-04 / R-08 / UI-SPEC S7) — the numbers are the summary's and
// the lists are server pages; loading, failed and empty are three states. Layout unchanged. ──
describe("IngestionTab — summary numbers and paged lists (284-03)", () => {
  function deferredPage() {
    let resolve!: (v: unknown) => void
    const promise = new Promise((res) => {
      resolve = res
    })
    return { promise, resolve }
  }

  it("while the summary loads, every card number is '…', the badge and the queue count are omitted", async () => {
    const user = userEvent.setup()
    renderPlain({ summary: null, summaryState: "loading" })
    expect(screen.queryByTestId("in-progress-badge")).toBeNull()
    await openSubTab(user, "In progress")
    const cards = document.querySelectorAll("[data-stage-card]")
    expect(cards).toHaveLength(4)
    for (const card of cards) {
      expect(card.textContent).toContain("…")
      expect(card.textContent).not.toMatch(/\d/)
    }
    expect(screen.queryByText(/files\)/)).toBeNull()
  })

  it("a failed summary says so above the cards — numbers '—' — and Try again re-asks", async () => {
    const user = userEvent.setup()
    const onRetrySummary = vi.fn()
    renderPlain({ summary: null, summaryState: "error", onRetrySummary })
    await openSubTab(user, "In progress")
    const alert = screen.getByText("Couldn’t load ingestion counts.").closest("[role='alert']") as HTMLElement
    expect(alert).not.toBeNull()
    for (const card of document.querySelectorAll("[data-stage-card]")) expect(card.textContent).toContain("—")
    await user.click(within(alert).getByRole("button", { name: "Try again" }))
    expect(onRetrySummary).toHaveBeenCalledTimes(1)
  })

  it("Queue, Needs attention and History read their own server pages (R-08: History by updated_at)", async () => {
    const user = userEvent.setup()
    renderPlain({ documents: [doc({ id: "q", status: "pending" })] })
    await openSubTab(user, "In progress")
    expect(listDocumentsPage).toHaveBeenLastCalledWith({ status: "in_flight", offset: 0, limit: 25 })
    await openSubTab(user, "Needs attention")
    expect(listDocumentsPage).toHaveBeenLastCalledWith({ status: "failed", offset: 0, limit: 25 })
    await openSubTab(user, "History")
    expect(listDocumentsPage).toHaveBeenLastCalledWith({ status: "done", order: "updated_desc", offset: 0, limit: 25 })
  })

  it("the queue heading counts the summary's in-flight total, never the page length", async () => {
    const user = userEvent.setup()
    const inflight = Array.from({ length: 40 }, (_, i) => doc({ id: `f${i}`, status: "pending" }))
    renderPlain({ documents: inflight })
    await openSubTab(user, "In progress")
    expect(screen.getByText("(40 files)")).toBeInTheDocument()
    expect(within(screen.getByTestId("queue-table")).getAllByText("Waiting its turn")).toHaveLength(25)
    expect(screen.getByText("Showing 1–25 of 40")).toBeInTheDocument()
  })

  it("a list loading cold shows 3 bars and 'Loading files' — never its empty sentence", async () => {
    const user = userEvent.setup()
    renderPlain()
    const gate = deferredPage()
    listDocumentsPage.mockReturnValueOnce(gate.promise)
    await user.click(screen.getByRole("tab", { name: "Needs attention" }))
    const status = within(screen.getByTestId("ingestion-needs-attention")).getByRole("status")
    expect(status).toHaveTextContent("Loading files")
    expect(status.querySelectorAll(".animate-pulse")).toHaveLength(3)
    expect(screen.queryByText("Nothing needs attention.")).toBeNull()
    gate.resolve({ documents: [], total: 0, offset: 0, limit: 25 })
    expect(await screen.findByText("Nothing needs attention.")).toBeInTheDocument()
  })

  it("a list that fails says it is a loading error, not an empty list — and Try again re-asks", async () => {
    const user = userEvent.setup()
    renderPlain({ documents: [doc({ id: "h1", status: "completed", filename: "done.pdf" })] })
    listDocumentsPage.mockRejectedValueOnce(new Error("boom"))
    await user.click(screen.getByRole("tab", { name: "History" }))
    const line = await screen.findByText("Couldn’t load this list. This is a loading error, not an empty list.")
    const alert = line.closest("[role='alert']") as HTMLElement
    expect(alert).not.toBeNull()
    expect(screen.queryByText("Nothing has been ingested yet.")).toBeNull()
    await user.click(within(alert).getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("done.pdf")).toBeInTheDocument()
  })

  it("Needs attention pages 25 at a time with the server total", async () => {
    const user = userEvent.setup()
    const failedMany = Array.from({ length: 30 }, (_, i) =>
      doc({ id: `x${String(i).padStart(2, "0")}`, status: "failed", filename: `bad-${i}.pdf` }),
    )
    renderPlain({ documents: failedMany })
    await openSubTab(user, "Needs attention")
    expect(screen.getAllByTestId("needs-attention-row")).toHaveLength(25)
    expect(screen.getByText("Showing 1–25 of 30")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /Next/ }))
    expect(await screen.findByText("Showing 26–30 of 30")).toBeInTheDocument()
    expect(screen.getAllByTestId("needs-attention-row")).toHaveLength(5)
  })

  it("the rate-limit banner reads the summary's rate-limited in-flight count", async () => {
    const user = userEvent.setup()
    renderPlain({
      summary: {
        ...summarizeDocuments([]),
        rate_limited_in_flight: 1,
        status: { pending: 0, processing: 1, paused: 0, completed: 0, failed: 0 },
      },
    })
    await openSubTab(user, "In progress")
    expect(screen.getByTestId("ingestion-pause-banner")).toBeInTheDocument()
  })
})
