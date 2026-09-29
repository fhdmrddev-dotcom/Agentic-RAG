/**
 * Phase 268 (UI-SPEC §5.6, D-268-08) — the Expert pill group on /admin/spend.
 * Every word is asserted VISIBLE at rest (266 UI-3): never title-only, never hover-only.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ExpertFilterPills, filterPillClass } from "../ExpertFilterPills"
import type { ExpertSpendLine } from "@/types/spend"

afterEach(cleanup)

const HR = "11111111-1111-4111-8111-111111111111"
const FA = "22222222-2222-4222-8222-222222222222"
const GONE = "9f3c2a71-0000-4000-8000-000000000000"

function line(key: string, over: Partial<ExpertSpendLine> = {}): ExpertSpendLine {
  return {
    key,
    expertId: key === "none" || key === "unrecorded" ? null : key,
    name: null,
    deleted: false,
    scopeMode: null,
    runCount: 1,
    inputTokens: 10,
    outputTokens: 5,
    spendUsd: 0.1,
    unratedCount: 0,
    ...over,
  }
}

const LINES: ExpertSpendLine[] = [
  line(FA, { name: "Financial Analyzer", scopeMode: "biased", spendUsd: 0.9 }),
  line(HR, { name: "HR Advisor", scopeMode: "restricted", spendUsd: 0.2 }),
  line(GONE, { deleted: true, spendUsd: 0.1 }),
  line("none", { spendUsd: 1.1 }),
  line("unrecorded", { spendUsd: 0.05, runCount: 5 }),
]

describe("ExpertFilterPills", () => {
  it("lists All, every Expert by the server's order, then No Expert and Not recorded", () => {
    render(<ExpertFilterPills lines={LINES} selected={null} selectedLabel={null} onSelect={() => {}} />)
    const group = screen.getByTestId("spend-expert-filter")
    expect(within(group).getByText("Expert:")).toBeVisible()
    const names = within(group)
      .getAllByRole("button")
      .map((b) => b.textContent)
    expect(names).toEqual([
      "All",
      "Financial Analyzer",
      "HR Advisor",
      `Deleted Expert ${GONE.slice(0, 8)}`,
      "No Expert",
      "Not recorded (before 268)",
    ])
    expect(screen.getByTestId("spend-expert-pill-all")).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByTestId(`spend-expert-pill-${HR}`)).toHaveAttribute("aria-pressed", "false")
    // Deleted Experts keep an id suffix so two of them never merge visually (§9-D11).
    expect(within(screen.getByTestId(`spend-expert-pill-${GONE}`)).getByText(GONE.slice(0, 8))).toBeVisible()
  })

  it("always shows No Expert, and Not recorded only when its line exists", () => {
    render(
      <ExpertFilterPills
        lines={[line("none", { runCount: 0, spendUsd: 0 })]}
        selected={null}
        selectedLabel={null}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByTestId("spend-expert-pill-none")).toHaveTextContent("No Expert")
    expect(screen.queryByTestId("spend-expert-pill-unrecorded")).not.toBeInTheDocument()
  })

  it("a click selects that ONE filter; All clears it", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ExpertFilterPills lines={LINES} selected={HR} selectedLabel="HR Advisor" onSelect={onSelect} />)
    expect(screen.getByTestId(`spend-expert-pill-${HR}`)).toHaveAttribute("aria-pressed", "true")
    await user.click(screen.getByTestId("spend-expert-pill-none"))
    expect(onSelect).toHaveBeenLastCalledWith("none")
    await user.click(screen.getByTestId("spend-expert-pill-all"))
    expect(onSelect).toHaveBeenLastCalledWith(null)
  })

  it("while loading or after a failed load, keeps All plus the selected pill so the operator can clear", () => {
    render(<ExpertFilterPills lines={null} selected={HR} selectedLabel="HR Advisor" onSelect={() => {}} />)
    const names = within(screen.getByTestId("spend-expert-filter"))
      .getAllByRole("button")
      .map((b) => b.textContent)
    expect(names).toEqual(["All", "HR Advisor"])
  })

  it("keeps a selected Expert with no runs in the new window visible as a pill", () => {
    render(
      <ExpertFilterPills
        lines={[line("none")]}
        selected={HR}
        selectedLabel="HR Advisor"
        onSelect={() => {}}
      />,
    )
    expect(screen.getByTestId(`spend-expert-pill-${HR}`)).toHaveTextContent("HR Advisor")
    expect(screen.getByTestId(`spend-expert-pill-${HR}`)).toHaveAttribute("aria-pressed", "true")
  })

  it("above six Experts shows the top five plus More, and promotes a selected overflow Expert", () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      line(`${i}0000000-0000-4000-8000-000000000000`, { name: `Expert ${i}`, spendUsd: 8 - i }),
    )
    const { rerender } = render(
      <ExpertFilterPills lines={[...many, line("none")]} selected={null} selectedLabel={null} onSelect={() => {}} />,
    )
    const visible = () =>
      within(screen.getByTestId("spend-expert-filter"))
        .getAllByRole("button")
        .map((b) => b.textContent)
    expect(visible()).toEqual(["All", "Expert 0", "Expert 1", "Expert 2", "Expert 3", "Expert 4", "More", "No Expert"])

    rerender(
      <ExpertFilterPills
        lines={[...many, line("none")]}
        selected={many[7].key}
        selectedLabel="Expert 7"
        onSelect={() => {}}
      />,
    )
    expect(visible()).toEqual([
      "All", "Expert 0", "Expert 1", "Expert 2", "Expert 3", "Expert 4", "Expert 7", "More", "No Expert",
    ])
  })

  it("filterPillClass is the ONE light-safe pill style (§9-D8)", () => {
    const on = filterPillClass(true).split(/\s+/)
    for (const c of ["text-indigo-700", "dark:text-indigo-300", "border-indigo-600/40", "dark:border-indigo-500/40", "font-semibold"]) {
      expect(on).toContain(c)
    }
    const off = filterPillClass(false).split(/\s+/)
    expect(off).toContain("text-muted-foreground")
    expect(off).not.toContain("text-indigo-700")
  })
})
