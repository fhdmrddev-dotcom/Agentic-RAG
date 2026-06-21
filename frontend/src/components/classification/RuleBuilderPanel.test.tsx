/**
 * Phase 118 Plan 06 Task 1 — RuleBuilderPanel behavior tests.
 *
 * Locks the rules-authoring builder contract of the locked G-2 sketch 037-A
 * (Winner A — list + right-side push/split builder):
 *  - chip-strip condition row (field op value) with a +condition affordance (flat AND),
 *    reusing the 029/114 ViewCondition grammar (ConditionPopover).
 *  - the action selector offers 📁 folder ONLY — NO 🏷 tag radio (D-118-1).
 *  - the scope segmented control offers 👤 Only me / 🌐 Global (G); default = Only me.
 *  - editing the condition triggers a "would match N of M" preview that calls
 *    resolveAdHoc(count_only:true) — NOT a new count fn.
 *  - the forward-only honesty line renders ("existing docs aren't moved — rules
 *    suggest on new uploads only").
 *  - Save calls createRule(name, match_expr, suggest_folder_id) with a body that
 *    OMITS is_global; editing an existing rule calls updateRule.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { ClassificationRule, Folder } from "@/types"

// ── Mock only the api functions the builder calls (everything else untouched). ──
const resolveAdHoc = vi.fn()
const createRule = vi.fn()
const updateRule = vi.fn()
vi.mock("@/lib/api", () => ({
  resolveAdHoc: (...a: unknown[]) => resolveAdHoc(...a),
  createRule: (...a: unknown[]) => createRule(...a),
  updateRule: (...a: unknown[]) => updateRule(...a),
}))

import { RuleBuilderPanel } from "./RuleBuilderPanel"

const folders: Folder[] = [
  {
    id: "folder-fin",
    user_id: "user-1",
    name: "Finance Inbox",
    parent_id: null,
    is_global: false,
    created_at: "",
    updated_at: "",
  },
  {
    id: "folder-legal",
    user_id: "user-1",
    name: "Legal",
    parent_id: null,
    is_global: false,
    created_at: "",
    updated_at: "",
  },
]

beforeEach(() => {
  resolveAdHoc.mockReset()
  createRule.mockReset()
  updateRule.mockReset()
  resolveAdHoc.mockResolvedValue({ total: 7 })
  createRule.mockResolvedValue({ id: "rule-new" } as ClassificationRule)
  updateRule.mockResolvedValue({ id: "rule-1" } as ClassificationRule)
})

/** Compose one `title is invoice` condition through the chip-strip popover. */
function addTitleIsInvoice() {
  fireEvent.click(screen.getByText("condition"))
  fireEvent.change(screen.getByLabelText("Value"), { target: { value: "invoice" } })
  fireEvent.click(screen.getByText("Apply"))
}

describe("RuleBuilderPanel", () => {
  it("renders the chip-strip condition row with a +condition affordance", () => {
    render(<RuleBuilderPanel folders={folders} onSaved={vi.fn()} onCancel={vi.fn()} />)
    // The +condition affordance is the chip-strip add control (reused from 114).
    expect(screen.getByText("condition")).toBeInTheDocument()
    // Adding a condition produces a plain-language chip.
    addTitleIsInvoice()
    expect(screen.getByText(/title is invoice/i)).toBeInTheDocument()
  })

  it("offers a 📁 folder action ONLY — there is NO 🏷 tag radio (D-118-1)", () => {
    render(<RuleBuilderPanel folders={folders} onSaved={vi.fn()} onCancel={vi.fn()} />)
    // The folder action picker is present…
    expect(screen.getByLabelText(/suggested folder/i)).toBeInTheDocument()
    // …and there is NO tag action control anywhere.
    expect(screen.queryByLabelText(/tag/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("radio", { name: /tag/i })).not.toBeInTheDocument()
  })

  it("scope segmented control offers Only me / Global, default Only me", () => {
    render(<RuleBuilderPanel folders={folders} onSaved={vi.fn()} onCancel={vi.fn()} />)
    const onlyMe = screen.getByRole("radio", { name: /only me/i })
    const global = screen.getByRole("radio", { name: /global/i })
    expect(onlyMe).toBeInTheDocument()
    expect(global).toBeInTheDocument()
    // Default selection = Only me.
    expect(onlyMe).toBeChecked()
    expect(global).not.toBeChecked()
  })

  it("editing the condition triggers a 'would match N of M' preview via resolveAdHoc(count_only)", async () => {
    render(<RuleBuilderPanel folders={folders} onSaved={vi.fn()} onCancel={vi.fn()} debounceMs={10} />)
    addTitleIsInvoice()
    await waitFor(() => {
      expect(resolveAdHoc).toHaveBeenCalled()
    })
    // It reuses the EXISTING resolveAdHoc with count_only:true (no new count fn).
    expect(resolveAdHoc).toHaveBeenLastCalledWith(
      { op: "and", conditions: [{ field: "title", op: "eq", value: "invoice" }] },
      { count_only: true },
    )
    await waitFor(() => {
      expect(screen.getByText(/would match/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/7/)).toBeInTheDocument()
  })

  it("renders the forward-only honesty line", () => {
    render(<RuleBuilderPanel folders={folders} onSaved={vi.fn()} onCancel={vi.fn()} />)
    expect(
      screen.getByText(/existing docs aren't moved — rules suggest on new uploads only/i),
    ).toBeInTheDocument()
  })

  it("Save calls createRule(name, match_expr, suggest_folder_id) and OMITS is_global", async () => {
    const onSaved = vi.fn()
    render(<RuleBuilderPanel folders={folders} onSaved={onSaved} onCancel={vi.fn()} />)
    addTitleIsInvoice()
    fireEvent.change(screen.getByLabelText(/rule name/i), { target: { value: "Acme Invoices" } })
    fireEvent.change(screen.getByLabelText(/suggested folder/i), { target: { value: "folder-fin" } })
    fireEvent.click(screen.getByRole("button", { name: /save rule/i }))
    await waitFor(() => {
      expect(createRule).toHaveBeenCalledTimes(1)
    })
    // Exactly (name, match_expr, suggest_folder_id) — the body never carries is_global.
    expect(createRule).toHaveBeenCalledWith(
      "Acme Invoices",
      { op: "and", conditions: [{ field: "title", op: "eq", value: "invoice" }] },
      "folder-fin",
    )
    // No 4th argument (no is_global piggy-backed onto the call).
    expect(createRule.mock.calls[0]).toHaveLength(3)
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
  })

  it("editing an existing rule calls updateRule instead of createRule", async () => {
    const existing: ClassificationRule = {
      id: "rule-1",
      user_id: "user-1",
      name: "Old Name",
      match_expr: { op: "and", conditions: [{ field: "author", op: "contains", value: "Acme" }] },
      suggest_folder_id: "folder-legal",
      is_global: false,
      enabled: true,
    }
    const onSaved = vi.fn()
    render(
      <RuleBuilderPanel folders={folders} rule={existing} onSaved={onSaved} onCancel={vi.fn()} />,
    )
    // Pre-filled with the existing rule's name + condition.
    expect((screen.getByLabelText(/rule name/i) as HTMLInputElement).value).toBe("Old Name")
    expect(screen.getByText(/author contains Acme/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /save rule/i }))
    await waitFor(() => {
      expect(updateRule).toHaveBeenCalledTimes(1)
    })
    expect(updateRule).toHaveBeenCalledWith("rule-1", expect.objectContaining({ name: "Old Name" }))
    expect(createRule).not.toHaveBeenCalled()
  })
})
