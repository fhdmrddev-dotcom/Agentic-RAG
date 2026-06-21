/**
 * Phase 118 Plan 05 Task 1 — ClassificationSection behavior tests.
 *
 * Asserts the load-bearing honesty of the locked G-2 sketch 036-A (Winner A — on the
 * doc, panel card) + CONTEXT:
 *  - PROVENANCE not %: a "suggested" doc shows rule_name + condition_summary + a
 *    "→ {suggested_folder_name}" target; NO confidence % anywhere (the 028/036 rule).
 *  - "suggested" reads as NOT yet moved (distinct from an accepted receipt).
 *  - an "accepted" suggestion renders the audit receipt + an Undo control.
 *  - honest-states matrix: no _classification → calm no-match (role NOT alert),
 *    distinct from a re-fetch beat (role=status).
 *  - re-fetch-NOT-optimistic: Accept calls acceptClassification then onChanged
 *    (the parent re-fetch); Dismiss calls dismissClassification then onChanged;
 *    Undo calls moveDocument(id, prior_folder_id).
 *  - onTotalChange fires 1 when a "suggested" exists, else 0/undefined.
 *  - a11y: accept/dismiss/Undo are buttons with aria-label; panel-AA tokens.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, within, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ClassificationSuggestion, Document } from "@/types"

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

// ── Partial-mock the api client: accept/dismiss/move observable; everything else real. ──
const acceptClassification = vi.fn<() => Promise<Document>>()
const dismissClassification = vi.fn<() => Promise<Document>>()
const moveDocument = vi.fn<() => Promise<Document>>()
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    acceptClassification: (...a: unknown[]) => acceptClassification(...(a as [])),
    dismissClassification: (...a: unknown[]) => dismissClassification(...(a as [])),
    moveDocument: (...a: unknown[]) => moveDocument(...(a as [])),
  }
})

import { ClassificationSection } from "./ClassificationSection"

const suggested: ClassificationSuggestion = {
  rule_id: "rule-1",
  rule_name: "Acme Invoices Rule",
  condition_summary: 'document_type is "invoice"',
  suggested_folder_id: "folder-fin",
  suggested_folder_name: "Finance Inbox",
  status: "suggested",
}

const accepted: ClassificationSuggestion = {
  ...suggested,
  status: "accepted",
  prior_folder_id: "folder-inbox",
}

const okDoc = { id: "doc-1" } as Document

beforeEach(() => {
  acceptClassification.mockResolvedValue(okDoc)
  dismissClassification.mockResolvedValue(okDoc)
  moveDocument.mockResolvedValue(okDoc)
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("ClassificationSection — provenance, never a confidence %", () => {
  it("renders rule_name + condition_summary + the → folder target for a suggested doc", () => {
    render(<ClassificationSection docId="doc-1" suggestion={suggested} />)
    // The matched rule name appears as provenance.
    expect(screen.getByText(/Acme Invoices Rule/)).toBeInTheDocument()
    // The human-readable AST render (frozen condition_summary).
    expect(screen.getByText(/document_type is "invoice"/)).toBeInTheDocument()
    // The suggested folder target.
    expect(screen.getByText(/Finance Inbox/)).toBeInTheDocument()
  })

  it("renders NO confidence percentage anywhere", () => {
    const { container } = render(
      <ClassificationSection docId="doc-1" suggestion={suggested} />,
    )
    // A rule match is deterministic — there is never a fabricated "92%".
    expect(container.textContent).not.toMatch(/\d+\s*%/)
    expect(container.textContent || "").not.toMatch(/confidence/i)
  })
})

describe("ClassificationSection — honest states (suggested ≠ accepted ≠ no-match)", () => {
  it("a suggested doc reads as NOT yet moved (distinct from a receipt)", () => {
    render(<ClassificationSection docId="doc-1" suggestion={suggested} />)
    // "not moved yet" / "suggestion" language — the file is still where uploaded.
    expect(screen.getByText(/not moved yet/i)).toBeInTheDocument()
    // It is NOT the accepted receipt.
    expect(screen.queryByText(/audit logged/i)).not.toBeInTheDocument()
  })

  it("an accepted suggestion renders the audit receipt + an Undo control", () => {
    render(<ClassificationSection docId="doc-1" suggestion={accepted} />)
    expect(screen.getByText(/audit logged/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /undo/i })).toBeInTheDocument()
    // The "not moved yet" suggested language is gone in the accepted state.
    expect(screen.queryByText(/not moved yet/i)).not.toBeInTheDocument()
  })

  it("no _classification → a calm no-match state (role NOT alert)", () => {
    render(<ClassificationSection docId="doc-1" suggestion={undefined} />)
    expect(screen.getByText(/no rule matched/i)).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})

describe("ClassificationSection — re-fetch-not-optimistic mutations", () => {
  it("Accept calls acceptClassification then onChanged (the parent re-fetch)", async () => {
    const user = userEvent.setup()
    const onChanged = vi.fn()
    render(<ClassificationSection docId="doc-1" suggestion={suggested} onChanged={onChanged} />)

    await user.click(screen.getByRole("button", { name: /accept/i }))

    await waitFor(() => expect(acceptClassification).toHaveBeenCalledWith("doc-1"))
    // Re-fetch (not an optimistic local splice) — the authoritative reconcile.
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it("Dismiss calls dismissClassification then onChanged", async () => {
    const user = userEvent.setup()
    const onChanged = vi.fn()
    render(<ClassificationSection docId="doc-1" suggestion={suggested} onChanged={onChanged} />)

    await user.click(screen.getByRole("button", { name: /dismiss/i }))

    await waitFor(() => expect(dismissClassification).toHaveBeenCalledWith("doc-1"))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it("Undo calls moveDocument(id, prior_folder_id) then onChanged", async () => {
    const user = userEvent.setup()
    const onChanged = vi.fn()
    render(<ClassificationSection docId="doc-1" suggestion={accepted} onChanged={onChanged} />)

    await user.click(screen.getByRole("button", { name: /undo/i }))

    await waitFor(() => expect(moveDocument).toHaveBeenCalledWith("doc-1", "folder-inbox"))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })
})

describe("ClassificationSection — onTotalChange count-lift", () => {
  it("fires 1 when a suggested exists", () => {
    const onTotalChange = vi.fn()
    render(
      <ClassificationSection docId="doc-1" suggestion={suggested} onTotalChange={onTotalChange} />,
    )
    expect(onTotalChange).toHaveBeenCalledWith(1)
  })

  it("fires 0 when there is no suggestion", () => {
    const onTotalChange = vi.fn()
    render(
      <ClassificationSection docId="doc-1" suggestion={undefined} onTotalChange={onTotalChange} />,
    )
    expect(onTotalChange).toHaveBeenCalledWith(0)
  })

  it("fires 0 for an accepted suggestion (no longer a pending suggestion)", () => {
    const onTotalChange = vi.fn()
    render(
      <ClassificationSection docId="doc-1" suggestion={accepted} onTotalChange={onTotalChange} />,
    )
    expect(onTotalChange).toHaveBeenCalledWith(0)
  })
})

describe("ClassificationSection — a11y", () => {
  it("accept/dismiss carry an accessible name and are buttons", () => {
    render(<ClassificationSection docId="doc-1" suggestion={suggested} />)
    const accept = screen.getByRole("button", { name: /accept/i })
    const dismiss = screen.getByRole("button", { name: /dismiss/i })
    expect(accept).toHaveAttribute("aria-label")
    expect(dismiss).toHaveAttribute("aria-label")
  })

  it("the Undo control carries an accessible name", () => {
    render(<ClassificationSection docId="doc-1" suggestion={accepted} />)
    const undo = screen.getByRole("button", { name: /undo/i })
    expect(within(undo).queryByText).toBeDefined()
    expect(undo).toHaveAttribute("aria-label")
  })
})
