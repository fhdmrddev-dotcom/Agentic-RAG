/**
 * Phase 217.1 plan 02 (LIB-03 / D-217.1-20 / D-217.1-21 / D-217.1-22) — the Ingestion tab
 * behavior suite.
 *
 * ⭐ THE FOUR DEFECTS THIS SUITE PINS:
 *
 *   D-217.1-20 — a Postgres error dict object NEVER reaches the rendered DOM as text by
 *                 default; the classified plain sentence does. The raw string is reachable
 *                 ONLY behind the ⌥ Technical-names reveal.
 *
 *   D-217.1-21 — the Needs attention row renders a `● Failed` badge, the plain sentence,
 *                 the file size, and a `Try again` button that calls `reingestDocument`
 *                 with the document's id.
 *
 *   D-217.1-22 — the tab mounts exactly one `DocumentUpload` and it renders the dropzone.
 *
 * ⚠ THE REINGEST MOCK ASSERTS THE CALL, NOT A NETWORK RESPONSE. `reingestDocument` is
 * mocked at the `@/lib/api` boundary; the test asserts the verb was called with the right
 * id, never that a real reingest succeeded — the backend's Realtime UPDATE reconciles the
 * row, and that is not this plan's surface.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Document } from "@/types"

// ── Mock Supabase auth so the real api.ts module-load never builds a real client. ──
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

// ── Mock reingestDocument at the api boundary — assert the call, not a network response. ──
const reingestDocument = vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined)
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    reingestDocument: (id: string) => reingestDocument(id),
  }
})

// ── Control the ⌥ Technical-names reveal without the provider's localStorage state. ──
// `IngestionTab` reads the reveal through `useTechnicalNamesOptional` (re-exported via
// `@/lib/termMap`). Mocking the provider's hook lets each test choose the audience without
// the provider's persistence layer or its children-re-render semantics.
let showTechnical = false
vi.mock("@/providers/TechnicalNamesProvider", async () => {
  const actual = await vi.importActual<typeof import("@/providers/TechnicalNamesProvider")>(
    "@/providers/TechnicalNamesProvider",
  )
  return {
    ...actual,
    useTechnicalNamesOptional: () =>
      ({
        showTechnical,
        toggle: () => {},
        setShowTechnical: () => {},
      }) as unknown,
  }
})

import { IngestionTab } from "../IngestionTab"

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
  documents: [] as Document[],
  upload: vi.fn(),
  uploading: false,
  uploadingCount: 0,
  folderId: null as string | null,
  folderName: null as string | null,
  disabled: false,
}

/** Render with the ⌥ Technical-names reveal OFF (the default a non-technical user sees). */
function renderPlain(over: Partial<Parameters<typeof IngestionTab>[0]> = {}) {
  showTechnical = false
  return render(<IngestionTab {...defaultProps} {...over} />)
}

/** Render with the ⌥ Technical-names reveal ON (an operator who asked for technical names). */
function renderTechnical(over: Partial<Parameters<typeof IngestionTab>[0]> = {}) {
  showTechnical = true
  return render(<IngestionTab {...defaultProps} {...over} />)
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  showTechnical = false
})

afterEach(() => {
  cleanup()
})

// ── D-217.1-22 — the dropzone ─────────────────────────────────────────────────────────

describe("IngestionTab — mounts a DocumentUpload (D-217.1-22)", () => {
  it("mounts exactly one DocumentUpload dropzone", () => {
    renderPlain()
    // DocumentUpload renders a <button> with aria-label "Upload to Root" or "Upload to <name>"
    const dropzones = screen.getAllByRole("button", { name: /upload to/i })
    expect(dropzones).toHaveLength(1)
  })

  it("the dropzone is the first element in the tab body", () => {
    renderPlain()
    const tab = screen.getByTestId("ingestion-tab")
    const firstChild = tab.firstElementChild
    expect(firstChild?.querySelector('button[aria-label^="Upload to"]')).not.toBeNull()
  })

  it("threads the folder name into the dropzone label", () => {
    renderPlain({ folderName: "My Folder" })
    expect(screen.getByRole("button", { name: /upload to my folder/i })).toBeInTheDocument()
  })
})

// ── D-217.1-20 — the raw error dict never reaches the DOM by default ─────────────────

describe("IngestionTab — the raw error dict is gated behind the ⌥ reveal (D-217.1-20)", () => {
  // A Postgres driver dict repr — what `str(exc)[:500]` produces for a supabase-py failure.
  const pgDict =
    '{"code": "23505", "message": "duplicate key value violates unique constraint", "hint": null, "details": null}'

  it("a Postgres error dict NEVER reaches the rendered DOM as text by default", () => {
    renderPlain({ documents: [doc({ status: "failed", error_message: pgDict, file_size: 2048 })] })
    const reason = screen.getByTestId("failure-reason")
    // The classified sentence — NOT the raw dict.
    expect(reason.textContent).not.toContain("23505")
    expect(reason.textContent).not.toContain("duplicate key value")
    expect(reason.textContent).not.toContain('"code"')
    expect(reason.textContent).not.toContain("hint")
  })

  it("the classified plain sentence is what the row shows by default", () => {
    renderPlain({ documents: [doc({ status: "failed", error_message: pgDict })] })
    const reason = screen.getByTestId("failure-reason")
    // 23505 → duplicate → its own sentence.
    expect(reason.textContent).toContain("already in your library")
  })

  it("with Technical-names ON, the raw error_message string IS rendered", () => {
    renderTechnical({ documents: [doc({ status: "failed", error_message: pgDict })] })
    const reason = screen.getByTestId("failure-reason")
    expect(reason.textContent).toContain("23505")
    expect(reason.textContent).toContain("duplicate key value")
  })

  it("a null error_message shows the honest fallback by default", () => {
    renderPlain({ documents: [doc({ status: "failed", error_message: null })] })
    const reason = screen.getByTestId("failure-reason")
    expect(reason.textContent).toContain("It stopped, and no reason was recorded")
  })
})

// ── D-217.1-21 — the Needs attention row: badge + sentence + size + Try again ────────

describe("IngestionTab — the Needs attention row (D-217.1-21)", () => {
  it("renders a ● Failed badge", () => {
    renderPlain({ documents: [doc({ status: "failed", error_message: "BadZipFile: not a zip" })] })
    const badge = screen.getByTestId("failed-badge")
    expect(badge.textContent).toContain("Failed")
    expect(badge.textContent).toContain("●")
  })

  it("renders the plain sentence (not the raw error)", () => {
    renderPlain({ documents: [doc({ status: "failed", error_message: "BadZipFile: not a zip" })] })
    const reason = screen.getByTestId("failure-reason")
    expect(reason.textContent).toContain("not the kind of spreadsheet")
    expect(reason.textContent).not.toContain("BadZipFile")
  })

  it("renders the file size", () => {
    renderPlain({ documents: [doc({ status: "failed", file_size: 5120 })] })
    const size = screen.getByTestId("file-size")
    // 5120 bytes → 5.0 KB
    expect(size.textContent).toContain("5.0 KB")
  })

  it("renders a Try again button", () => {
    renderPlain({ documents: [doc({ status: "failed" })] })
    expect(screen.getByTestId("try-again")).toBeInTheDocument()
  })

  it("clicking Try again calls reingestDocument with the document's id", async () => {
    const user = userEvent.setup()
    renderPlain({ documents: [doc({ id: "doc-fail", status: "failed" })] })
    await user.click(screen.getByTestId("try-again"))
    expect(reingestDocument).toHaveBeenCalledTimes(1)
    expect(reingestDocument).toHaveBeenCalledWith("doc-fail")
  })

  it("Try again is disabled while a retry is in flight", async () => {
    // Make reingestDocument hang so the button stays in its "retrying" state.
    reingestDocument.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()
    renderPlain({ documents: [doc({ id: "doc-fail", status: "failed" })] })
    const button = screen.getByTestId("try-again") as HTMLButtonElement
    await user.click(button)
    expect(button).toBeDisabled()
    expect(button.textContent).toContain("Retrying")
  })
})

// ── the empty state ───────────────────────────────────────────────────────────────────

describe("IngestionTab — the empty arms say the thing they mean", () => {
  it("the queue is empty — 'Nothing is being read right now'", () => {
    renderPlain()
    expect(screen.getByText("Nothing is being read right now.")).toBeInTheDocument()
  })

  it("needs attention is empty — 'Nothing needs attention'", () => {
    renderPlain()
    expect(screen.getByText("Nothing needs attention.")).toBeInTheDocument()
  })
})
