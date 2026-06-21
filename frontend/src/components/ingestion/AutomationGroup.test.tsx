/**
 * Phase 118 Plan 06 Task 2 — AutomationGroup behavior tests.
 *
 * Locks the sidebar "Automation" group of the locked G-2 sketch 037-A:
 *  - renders an "Automation" group header.
 *  - each rule row uses the SHARED NavRow with the 037-A anatomy (● name, G pill
 *    when is_global, condition summary, → folder action, enabled toggle, ⋯ kebab).
 *  - the enabled toggle calls updateRule(id, {enabled}); the kebab offers edit + delete
 *    (delete → deleteRule).
 *  - the G pill shows only for is_global rules.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { ClassificationRule } from "@/types"

// Radix DropdownMenu uses pointer-capture + scrollIntoView APIs jsdom does not
// implement; stub them so the menu opens under user-event (the standard Radix +
// jsdom shim, mirrored from ViewsGroup.test). Without these the trigger click is a
// no-op and the kebab items never mount into the portal.
beforeEach(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {}
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {}
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

const updateRule = vi.fn()
const deleteRule = vi.fn()
vi.mock("@/lib/api", () => ({
  updateRule: (...a: unknown[]) => updateRule(...a),
  deleteRule: (...a: unknown[]) => deleteRule(...a),
}))

import { AutomationGroup } from "./AutomationGroup"

const privateEnabled: ClassificationRule = {
  id: "rule-1",
  user_id: "user-1",
  name: "Acme Invoices",
  match_expr: { op: "and", conditions: [{ field: "document_type", op: "eq", value: "invoice" }] },
  suggest_folder_id: "folder-fin",
  is_global: false,
  enabled: true,
}

const globalDisabled: ClassificationRule = {
  id: "rule-2",
  user_id: "user-2",
  name: "Global Contracts",
  match_expr: { op: "and", conditions: [{ field: "document_type", op: "eq", value: "contract" }] },
  suggest_folder_id: "folder-legal",
  is_global: true,
  enabled: false,
}

function renderGroup(props: Partial<React.ComponentProps<typeof AutomationGroup>> = {}) {
  return render(
    <TooltipProvider>
      <AutomationGroup
        rules={[privateEnabled, globalDisabled]}
        onEditRule={vi.fn()}
        onToggled={vi.fn()}
        onDeleted={vi.fn()}
        folderNames={{ "folder-fin": "Finance", "folder-legal": "Legal" }}
        {...props}
      />
    </TooltipProvider>,
  )
}

beforeEach(() => {
  updateRule.mockReset()
  deleteRule.mockReset()
  updateRule.mockResolvedValue({ ...privateEnabled, enabled: false })
  deleteRule.mockResolvedValue(undefined)
})

describe("AutomationGroup", () => {
  it("renders an Automation group header", () => {
    renderGroup()
    expect(screen.getByText(/automation/i)).toBeInTheDocument()
  })

  it("lists each rule by name with its condition summary and folder action", () => {
    renderGroup()
    expect(screen.getByText("Acme Invoices")).toBeInTheDocument()
    expect(screen.getByText("Global Contracts")).toBeInTheDocument()
    // The 037-A row carries the condition summary (mono) → folder action.
    expect(screen.getByText(/document_type is invoice/i)).toBeInTheDocument()
    expect(screen.getByText(/Finance/)).toBeInTheDocument()
  })

  it("the G pill shows only for is_global rules", () => {
    renderGroup()
    // Exactly one global rule → exactly one G pill.
    const pills = screen.getAllByText("G")
    expect(pills).toHaveLength(1)
  })

  it("the enabled toggle calls updateRule(id, {enabled})", async () => {
    const onToggled = vi.fn()
    renderGroup({ onToggled })
    // The private rule is enabled → its toggle is labeled "Disable…" and flipping it
    // PATCHes enabled:false.
    const toggle = screen.getByRole("switch", { name: /disable rule Acme Invoices/i })
    expect(toggle).toBeChecked()
    fireEvent.click(toggle)
    await waitFor(() => expect(updateRule).toHaveBeenCalledTimes(1))
    expect(updateRule).toHaveBeenCalledWith("rule-1", { enabled: false })
    await waitFor(() => expect(onToggled).toHaveBeenCalled())
  })

  it("the kebab offers edit + delete; delete calls deleteRule", async () => {
    const user = userEvent.setup()
    const onEditRule = vi.fn()
    const onDeleted = vi.fn()
    renderGroup({ onEditRule, onDeleted })
    // Open the kebab for the first rule (user-event fires the pointer events Radix
    // listens for — fireEvent.click alone does not open a Radix menu in jsdom).
    await user.click(screen.getByRole("button", { name: /actions for Acme Invoices/i }))
    const edit = await screen.findByText("Edit rule")
    expect(edit).toBeInTheDocument()
    await user.click(edit)
    expect(onEditRule).toHaveBeenCalledWith(privateEnabled)

    // Re-open + delete (confirm).
    await user.click(screen.getByRole("button", { name: /actions for Acme Invoices/i }))
    await user.click(await screen.findByText("Delete"))
    // The inline confirm → Delete.
    fireEvent.click(await screen.findByRole("button", { name: /^delete$/i }))
    await waitFor(() => expect(deleteRule).toHaveBeenCalledWith("rule-1"))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("rule-1"))
  })

  it("honest empty state when there are no rules", () => {
    renderGroup({ rules: [] })
    expect(screen.getByText(/no classification rules yet/i)).toBeInTheDocument()
  })
})
