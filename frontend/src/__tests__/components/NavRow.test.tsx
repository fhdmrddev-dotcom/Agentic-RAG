/**
 * Tests for the shared NavRow primitive (Phase 114 Plan 04, D-114-13).
 *
 * NavRow is the single row that BOTH Folders and Views build from. These tests
 * lock the debt-fix contract: a count on every row, a tooltip-labeled G pill,
 * a keyboard/touch-reachable action trigger (NOT opacity-0 hover-only), and the
 * inline-rename idiom (Enter saves, Esc cancels).
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Folder as FolderIcon } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { NavRow } from "@/components/ingestion/NavRow"

function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

describe("NavRow", () => {
  it("renders the icon, name, and count slot", () => {
    const { container } = renderWithTooltip(
      <NavRow icon={FolderIcon} name="Invoices" count={47} />,
    )
    expect(screen.getByText("Invoices")).toBeInTheDocument()
    // The count renders on the row (not just a Root special-case).
    expect(screen.getByText("47")).toBeInTheDocument()
    // The icon is a lucide svg.
    expect(container.querySelectorAll("svg").length).toBeGreaterThan(0)
  })

  it("renders a count of 0 (count slot is present on every row)", () => {
    renderWithTooltip(<NavRow icon={FolderIcon} name="Empty" count={0} />)
    expect(screen.getByText("0")).toBeInTheDocument()
  })

  it("applies selected styling when isSelected is true", () => {
    const { container } = renderWithTooltip(
      <NavRow icon={FolderIcon} name="Sel" count={1} isSelected />,
    )
    const row = container.querySelector(".bg-primary\\/10")
    expect(row).toBeInTheDocument()
  })

  it("does NOT apply selected styling when isSelected is false", () => {
    const { container } = renderWithTooltip(
      <NavRow icon={FolderIcon} name="Unsel" count={1} />,
    )
    expect(container.querySelector(".bg-primary\\/10")).not.toBeInTheDocument()
  })

  it("calls onSelect when the row is clicked", () => {
    const onSelect = vi.fn()
    renderWithTooltip(
      <NavRow icon={FolderIcon} name="Click me" count={1} onSelect={onSelect} />,
    )
    fireEvent.click(screen.getByText("Click me"))
    expect(onSelect).toHaveBeenCalled()
  })

  it("inline rename: commits on Enter with the trimmed value", () => {
    const onCommitRename = vi.fn()
    renderWithTooltip(
      <NavRow
        icon={FolderIcon}
        name="Old"
        isEditing
        onCommitRename={onCommitRename}
      />,
    )
    const input = screen.getByRole("textbox")
    fireEvent.change(input, { target: { value: "  New name  " } })
    fireEvent.keyDown(input, { key: "Enter" })
    expect(onCommitRename).toHaveBeenCalledWith("New name")
  })

  it("inline rename: cancels on Escape", () => {
    const onCancelRename = vi.fn()
    renderWithTooltip(
      <NavRow
        icon={FolderIcon}
        name="Old"
        isEditing
        onCancelRename={onCancelRename}
      />,
    )
    const input = screen.getByRole("textbox")
    fireEvent.keyDown(input, { key: "Escape" })
    expect(onCancelRename).toHaveBeenCalled()
  })

  it("shows the tooltip-labeled G pill when isGlobal is true", () => {
    const { container } = renderWithTooltip(
      <NavRow icon={FolderIcon} name="Shared" count={3} isGlobal />,
    )
    // The G pill renders...
    const pill = Array.from(container.querySelectorAll(".rounded-full")).find(
      (el) => el.textContent === "G",
    )
    expect(pill).toBeTruthy()
    // ...and it is wrapped in a Tooltip (a Radix TooltipTrigger stamps data-state on
    // the pill), so the bare letter is no longer opaque — hovering/focusing reveals
    // the "Global — shared with everyone" label. cursor-help signals the affordance.
    expect(pill).toHaveAttribute("data-state")
    expect(pill?.className).toContain("cursor-help")
  })

  it("reveals the labeled G pill tooltip text on hover", async () => {
    renderWithTooltip(<NavRow icon={FolderIcon} name="Shared" count={3} isGlobal />)
    const pill = screen.getByText("G")
    fireEvent.mouseEnter(pill)
    fireEvent.focus(pill)
    // Radix renders the tooltip content (possibly multiple mirror nodes) once shown.
    const labels = await screen.findAllByText("Global — shared with everyone")
    expect(labels.length).toBeGreaterThan(0)
  })

  it("does NOT show the G pill when isGlobal is false", () => {
    const { container } = renderWithTooltip(
      <NavRow icon={FolderIcon} name="Private" count={1} />,
    )
    const hasGPill = Array.from(container.querySelectorAll(".rounded-full")).some(
      (el) => el.textContent === "G",
    )
    expect(hasGPill).toBe(false)
  })

  it("action menu trigger is reachable: present + focusable, not opacity-0-only", () => {
    const { container } = renderWithTooltip(
      <NavRow
        icon={FolderIcon}
        name="Has actions"
        count={2}
        actions={<button aria-label="Row actions">⋯</button>}
      />,
    )
    // The trigger is in the DOM (touch-reachable, not removed when not hovered).
    const trigger = screen.getByRole("button", { name: "Row actions" })
    expect(trigger).toBeInTheDocument()
    // It is focusable (a real button, not a hidden/aria-hidden node).
    trigger.focus()
    expect(trigger).toHaveFocus()
    // The wrapper is NOT gated behind opacity-0 alone — it is faint-at-rest
    // (opacity-25) and revealed on hover/focus-within.
    const wrapper = trigger.parentElement
    expect(wrapper?.className).toContain("opacity-25")
    expect(wrapper?.className).toContain("focus-within:opacity-100")
    expect(wrapper?.className).not.toContain("opacity-0")
    expect(container).toBeTruthy()
  })

  it("renders a leading slot (e.g. an expand chevron) when provided", () => {
    renderWithTooltip(
      <NavRow
        icon={FolderIcon}
        name="With chevron"
        count={1}
        leading={<button aria-label="expand">▸</button>}
      />,
    )
    expect(screen.getByRole("button", { name: "expand" })).toBeInTheDocument()
  })
})
