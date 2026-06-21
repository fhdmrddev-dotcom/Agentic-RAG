/**
 * Phase 118 Plan 06 Task 2 — ClassificationRulesPage behavior tests.
 *
 * Locks the dedicated rules page of the locked G-2 sketch 037-A (Winner A — the
 * rules list + a right-side push/split builder):
 *  - lists rules from listRules() and opens RuleBuilderPanel in the right-side
 *    push/split panel on "new rule" / edit (no router; state-switch).
 *  - honest empty/loading/error states (loading ≠ error).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { ClassificationRule, Folder } from "@/types"

// Radix DropdownMenu (the AutomationGroup kebab) needs pointer-capture +
// scrollIntoView jsdom shims to open under user-event (the standard Radix + jsdom
// shim, mirrored from ViewsGroup.test).
beforeEach(() => {
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
})

const listRules = vi.fn()
const listFolders = vi.fn()
const listMetadataFields = vi.fn()
// updateRule/deleteRule are exercised by the AutomationGroup child; stub them so the
// real module never builds a client.
const updateRule = vi.fn()
const deleteRule = vi.fn()
vi.mock("@/lib/api", () => ({
  listRules: (...a: unknown[]) => listRules(...a),
  listFolders: (...a: unknown[]) => listFolders(...a),
  listMetadataFields: (...a: unknown[]) => listMetadataFields(...a),
  updateRule: (...a: unknown[]) => updateRule(...a),
  deleteRule: (...a: unknown[]) => deleteRule(...a),
  // RuleBuilderPanel imports these but is not driven to call them in this suite.
  createRule: vi.fn(),
  resolveAdHoc: vi.fn().mockResolvedValue({ total: 0 }),
}))

import { ClassificationRulesPage } from "./ClassificationRulesPage"

const rules: ClassificationRule[] = [
  {
    id: "rule-1",
    user_id: "user-1",
    name: "Acme Invoices",
    match_expr: { op: "and", conditions: [{ field: "document_type", op: "eq", value: "invoice" }] },
    suggest_folder_id: "folder-fin",
    is_global: false,
    enabled: true,
  },
]

const folders: Folder[] = [
  { id: "folder-fin", user_id: "user-1", name: "Finance", parent_id: null, is_global: false, created_at: "", updated_at: "" },
]

function renderPage() {
  return render(
    <TooltipProvider>
      <ClassificationRulesPage />
    </TooltipProvider>,
  )
}

beforeEach(() => {
  listRules.mockReset()
  listFolders.mockReset()
  listMetadataFields.mockReset()
  listRules.mockResolvedValue(rules)
  listFolders.mockResolvedValue(folders)
  listMetadataFields.mockResolvedValue([])
})

describe("ClassificationRulesPage", () => {
  it("lists rules from listRules()", async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText("Acme Invoices")).toBeInTheDocument())
    expect(listRules).toHaveBeenCalled()
  })

  it("shows a loading state distinct from error", async () => {
    // A never-resolving listRules keeps the page in loading.
    listRules.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("shows an honest error state when listRules rejects", async () => {
    listRules.mockRejectedValue(new Error("boom"))
    renderPage()
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument())
  })

  it("shows an honest empty state when there are no rules", async () => {
    listRules.mockResolvedValue([])
    renderPage()
    await waitFor(() =>
      expect(screen.getByText(/no classification rules yet/i)).toBeInTheDocument(),
    )
  })

  it("opens RuleBuilderPanel in the push/split panel on 'New rule'", async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText("Acme Invoices")).toBeInTheDocument())
    // No builder until the user opens one.
    expect(screen.queryByText(/new classification rule/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /new rule/i }))
    // The builder panel appears (state-switch, no router).
    expect(await screen.findByText(/new classification rule/i)).toBeInTheDocument()
    // The Rule name field (owned by RuleBuilderPanel) is present.
    expect(screen.getByLabelText(/rule name/i)).toBeInTheDocument()
  })

  it("opens the builder pre-filled for edit", async () => {
    const user = userEvent.setup()
    renderPage()
    await waitFor(() => expect(screen.getByText("Acme Invoices")).toBeInTheDocument())
    // Open the kebab and choose Edit (user-event fires the pointer events Radix needs).
    await user.click(screen.getByRole("button", { name: /actions for Acme Invoices/i }))
    await user.click(await screen.findByText("Edit rule"))
    expect(await screen.findByText(/edit rule/i)).toBeInTheDocument()
    expect((screen.getByLabelText(/rule name/i) as HTMLInputElement).value).toBe("Acme Invoices")
  })
})
