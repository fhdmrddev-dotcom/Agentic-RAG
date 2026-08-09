/**
 * Tests for ViewsGroup (Phase 114 Plan 06, sketch 031-A / D-114-7/8/9).
 *
 * Locks the honest saved-filter contract:
 *  - view rows render through the SHARED NavRow with a FUNNEL icon (not the amber
 *    folder) — the differentiator a view reads as a saved filter, not a droppable
 *    folder;
 *  - the per-view count fetches LAZILY via the count-only resolve — called on
 *    first sight / on open, cached, never an eager all-counts sweep (SC#3);
 *  - the actions menu offers Edit / Rename / Delete (NO "New subfolder");
 *  - clicking a row fires onSelectView;
 *  - the tooltip-labeled G pill renders on a global view;
 *  - the empty state renders "filter documents and Save as view" — no "query".
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ViewsGroup } from "@/components/ingestion/ViewsGroup"
import type { SavedView } from "@/types"

// Radix DropdownMenu uses pointer-capture + scrollIntoView APIs jsdom does not
// implement; stub them so the menu opens under user-event (the standard Radix +
// jsdom shim). Without these the trigger click is a no-op and the items never
// mount into the portal.
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

/** Open a view row's actions menu via user-event (fires the pointer events Radix
 *  listens for — `fireEvent.click` alone does not open a Radix menu in jsdom). */
async function openMenu(viewName: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole("button", { name: `Actions for ${viewName}` }))
  return user
}

// Mock only the two api functions ViewsGroup calls.
const resolveView = vi.fn()
const deleteView = vi.fn()
vi.mock("@/lib/api", () => ({
  resolveView: (...args: unknown[]) => resolveView(...args),
  deleteView: (...args: unknown[]) => deleteView(...args),
}))

const sampleViews: SavedView[] = [
  {
    id: "v1",
    user_id: "user-1",
    name: "Invoices",
    filter_expr: { op: "and", conditions: [{ field: "document_type", op: "eq", value: "invoice" }] },
    is_system_global: false,
  },
  {
    id: "v2",
    user_id: null,
    name: "Expiring soon",
    filter_expr: { op: "and", conditions: [{ field: "date", op: "within_next", value: 90, unit: "days" }] },
    is_system_global: true,
  },
]

function renderGroup(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

const noop = () => {}
const noopAsync = async () => {}

beforeEach(() => {
  resolveView.mockReset()
  deleteView.mockReset()
  resolveView.mockResolvedValue({ total: 47 })
  deleteView.mockResolvedValue(undefined)
})

describe("ViewsGroup", () => {
  it("renders view rows with a FUNNEL icon (a saved filter, not the amber folder)", async () => {
    const { container } = renderGroup(
      <ViewsGroup
        views={sampleViews}
        selectedViewId={null}
        onSelectView={noop}
        onEditView={noop}
        onRenameView={noopAsync}
        onDeleted={noop}
      />,
    )
    expect(screen.getByText("Invoices")).toBeInTheDocument()
    expect(screen.getByText("Expiring soon")).toBeInTheDocument()
    // The funnel (lucide "Filter") icon distinguishes a view from a folder — its
    // path is rendered and there is NO amber folder icon class on a view row.
    expect(container.querySelector("svg.lucide-filter, svg.lucide-funnel")).toBeTruthy()
    expect(container.querySelector(".text-amber-500\\/70")).toBeFalsy()
  })

  it("fetches the per-view count LAZILY + cached — count-only, once per view, not eager-per-render", async () => {
    renderGroup(
      <ViewsGroup
        views={sampleViews}
        selectedViewId={null}
        onSelectView={noop}
        onEditView={noop}
        onRenameView={noopAsync}
        onDeleted={noop}
      />,
    )
    // The count is fetched via the count-only resolve...
    await waitFor(() => expect(resolveView).toHaveBeenCalled())
    expect(resolveView).toHaveBeenCalledWith("v1", { count_only: true })
    expect(resolveView).toHaveBeenCalledWith("v2", { count_only: true })
    // ...exactly once per view (cached — no eager re-fetch storm).
    expect(resolveView).toHaveBeenCalledTimes(2)
    // The resolved count renders on the row.
    await waitFor(() => expect(screen.getAllByText("47").length).toBeGreaterThan(0))

    // A re-render with the SAME views does NOT re-fetch the cached counts.
    resolveView.mockClear()
    fireEvent.click(screen.getByText("Invoices")) // selection-only; see force-refresh test
    // selection forces ONE refresh for the opened view, never a full re-sweep.
    await waitFor(() => expect(resolveView).toHaveBeenCalledTimes(1))
    expect(resolveView).toHaveBeenCalledWith("v1", { count_only: true })
  })

  it("does not fetch counts eagerly for a view it already has cached", async () => {
    const { rerender } = renderGroup(
      <ViewsGroup
        views={[sampleViews[0]]}
        selectedViewId={null}
        onSelectView={noop}
        onEditView={noop}
        onRenameView={noopAsync}
        onDeleted={noop}
      />,
    )
    await waitFor(() => expect(resolveView).toHaveBeenCalledTimes(1))
    resolveView.mockClear()
    // Adding a SECOND view fetches exactly one NEW count (v1 stays cached).
    rerender(
      <TooltipProvider>
        <ViewsGroup
          views={sampleViews}
          selectedViewId={null}
          onSelectView={noop}
          onEditView={noop}
          onRenameView={noopAsync}
          onDeleted={noop}
        />
      </TooltipProvider>,
    )
    await waitFor(() => expect(resolveView).toHaveBeenCalledTimes(1))
    expect(resolveView).toHaveBeenCalledWith("v2", { count_only: true })
  })

  it("clicking a view fires onSelectView with the view", async () => {
    const onSelectView = vi.fn()
    renderGroup(
      <ViewsGroup
        views={sampleViews}
        selectedViewId={null}
        onSelectView={onSelectView}
        onEditView={noop}
        onRenameView={noopAsync}
        onDeleted={noop}
      />,
    )
    fireEvent.click(screen.getByText("Invoices"))
    expect(onSelectView).toHaveBeenCalledWith(sampleViews[0])
  })

  it("the actions menu offers Edit / Rename / Delete (no 'New subfolder')", async () => {
    renderGroup(
      <ViewsGroup
        views={sampleViews}
        selectedViewId={null}
        onSelectView={noop}
        onEditView={noop}
        onRenameView={noopAsync}
        onDeleted={noop}
      />,
    )
    await openMenu("Invoices")
    expect(await screen.findByText("Edit filter")).toBeInTheDocument()
    expect(screen.getByText("Rename")).toBeInTheDocument()
    expect(screen.getByText("Delete")).toBeInTheDocument()
    // A view is a saved filter — it has NO "New subfolder" action.
    expect(screen.queryByText(/new subfolder/i)).toBeNull()
  })

  it("Edit fires onEditView so the page can reopen the bar pre-filled", async () => {
    const onEditView = vi.fn()
    renderGroup(
      <ViewsGroup
        views={sampleViews}
        selectedViewId={null}
        onSelectView={noop}
        onEditView={onEditView}
        onRenameView={noopAsync}
        onDeleted={noop}
      />,
    )
    const user = await openMenu("Invoices")
    await user.click(await screen.findByText("Edit filter"))
    expect(onEditView).toHaveBeenCalledWith(sampleViews[0])
  })

  it("Rename → inline edit → Enter commits the trimmed name via onRenameView", async () => {
    const onRenameView = vi.fn().mockResolvedValue(undefined)
    renderGroup(
      <ViewsGroup
        views={sampleViews}
        selectedViewId={null}
        onSelectView={noop}
        onEditView={noop}
        onRenameView={onRenameView}
        onDeleted={noop}
      />,
    )
    const user = await openMenu("Invoices")
    await user.click(await screen.findByText("Rename"))
    const input = await screen.findByRole("textbox")
    fireEvent.change(input, { target: { value: "  Paid invoices  " } })
    fireEvent.keyDown(input, { key: "Enter" })
    await waitFor(() => expect(onRenameView).toHaveBeenCalledWith("v1", "Paid invoices"))
  })

  it("Delete → confirm → calls deleteView and onDeleted", async () => {
    const onDeleted = vi.fn()
    renderGroup(
      <ViewsGroup
        views={sampleViews}
        selectedViewId={null}
        onSelectView={noop}
        onEditView={noop}
        onRenameView={noopAsync}
        onDeleted={onDeleted}
      />,
    )
    const user = await openMenu("Invoices")
    await user.click(await screen.findByText("Delete"))
    // An inline confirm appears; confirming calls the api + the page callback.
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))
    await waitFor(() => expect(deleteView).toHaveBeenCalledWith("v1"))
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("v1"))
  })

  it("shows the tooltip-labeled G pill on a global view", async () => {
    const { container } = renderGroup(
      <ViewsGroup
        views={sampleViews}
        selectedViewId={null}
        onSelectView={noop}
        onEditView={noop}
        onRenameView={noopAsync}
        onDeleted={noop}
      />,
    )
    const pill = Array.from(container.querySelectorAll(".rounded-full")).find(
      (el) => el.textContent === "G",
    )
    // Only the global view (v2) carries the pill.
    expect(pill).toBeTruthy()
    expect(pill).toHaveAttribute("data-state") // wrapped in a labeled Tooltip
    expect(pill?.className).toContain("cursor-help")
  })

  it("renders the empty state — 'filter documents and Save as view', never 'query'", async () => {
    renderGroup(
      <ViewsGroup
        views={[]}
        selectedViewId={null}
        onSelectView={noop}
        onEditView={noop}
        onRenameView={noopAsync}
        onDeleted={noop}
      />,
    )
    expect(screen.getByText("No saved views yet")).toBeInTheDocument()
    expect(screen.getByText(/filter documents and Save as view/i)).toBeInTheDocument()
    expect(within(document.body).queryByText(/query/i)).toBeNull()
    // No counts are fetched when there are no views.
    expect(resolveView).not.toHaveBeenCalled()
  })
})
