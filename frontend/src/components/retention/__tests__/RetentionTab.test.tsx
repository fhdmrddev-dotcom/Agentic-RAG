/**
 * Phase 275 plan 04 Task 3 (S1 / D-01 / D-29) — Org admin → Retention: the posture line, the
 * sub-tabs, and the Policies table.
 *
 * Each case prices a lived failure:
 *   · a posture line that claims a healthy schedule while sweeps are switched off (D-29 ships off);
 *   · a load blip that blanks the tab instead of keeping what it knew;
 *   · a Waiting-for-you pill that is red with nothing waiting, or silent with work waiting (D-01:
 *     the pill is the ONLY signal);
 *   · a sub line that hard-codes the sweep time instead of reading the server's cadence;
 *   · policy rows that are not reachable by keyboard.
 * Assertions read RENDERED WORDS.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import type { PolicyList, RetentionSummary } from "@/lib/api/retention"

const m = vi.hoisted(() => ({
  getRetentionSummary: vi.fn(),
  listPolicies: vi.fn(),
  listHolds: vi.fn(),
  listQueue: vi.fn(),
  listHistory: vi.fn(),
  listDocumentTypes: vi.fn(),
  previewPolicy: vi.fn(),
  createPolicy: vi.fn(),
}))

vi.mock("@/lib/api/retention", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/retention")>()
  return { ...actual, ...m }
})
vi.mock("@/hooks/useFolders", () => ({ useFolders: () => ({ folders: [] }) }))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, listDocuments: vi.fn().mockResolvedValue([]) }
})

import { RetentionTab } from "../RetentionTab"

const dt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
const d = (iso: string) => {
  const mm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  const x = mm ? new Date(Number(mm[1]), Number(mm[2]) - 1, Number(mm[3])) : new Date(iso)
  return x.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
}

const HEALTHY: RetentionSummary = {
  sweep_enabled: true, sweep_hour_utc: 3, last_run_at: "2026-10-12T02:00:00Z", last_status: "ok",
  next_run_at: "2026-10-13T02:00:00Z", counts: { policies: 3, active_holds: 1, waiting: 4 },
}

const POLICIES: PolicyList = {
  evaluation_incomplete: false,
  policies: [
    {
      id: "p1", name: "Finance invoices", scope_kind: "folder", folder_id: "f1", folder_path: "/Finance/Invoices",
      include_subfolders: true, clock: "document_date", stage1_value: 7, stage1_unit: "years", stage1_action: "archive",
      revision: 1, scope_text: "All documents in /Finance/Invoices (and subfolders)", kept_for_text: "7 years after the document date",
      rule_text: "Kept 7 years after the document date, then archived.",
      tonight: { due_now: 4, undecidable: 1, next_due: "2032-04-08" },
    },
    {
      id: "p2", name: "Short archive", scope_kind: "class", document_type_norm: "report", include_subfolders: true,
      clock: "date_added", stage1_value: 1, stage1_unit: "days", stage1_action: "archive", stage2_value: 2, stage2_unit: "days",
      stage2_action: "delete", revision: 2, scope_text: "Reports anywhere",
      kept_for_text: "1 day after added to the Library, delete after 2 days", rule_text: "",
      tonight: { due_now: 0, undecidable: 0, next_due: null },
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  m.getRetentionSummary.mockResolvedValue(HEALTHY)
  m.listPolicies.mockResolvedValue(POLICIES)
  m.listHolds.mockResolvedValue({ active: [], released: [] })
  m.listQueue.mockResolvedValue({ batches: [], total: 0 })
  m.listHistory.mockResolvedValue({ rows: [], offset: 0, has_more: false })
  m.listDocumentTypes.mockResolvedValue([])
})

describe("RetentionTab — the posture line (S1 / D-29)", () => {
  it("healthy: last sweep finished, next sweep, and the counts", async () => {
    render(<RetentionTab />)
    const posture = await screen.findByTestId("posture")
    expect(posture).toHaveTextContent(`Last sweep ${dt("2026-10-12T02:00:00Z")} finished, nothing failed`)
    expect(posture).toHaveTextContent(`Next sweep ${dt("2026-10-13T02:00:00Z")}`)
    expect(posture).toHaveTextContent("3 policies · 1 legal hold")
  })

  it("one policy reads `1 policy`, never `1 policies` (275-05 G-4)", async () => {
    m.getRetentionSummary.mockResolvedValue({ ...HEALTHY, counts: { policies: 1, active_holds: 2, waiting: 0 } })
    render(<RetentionTab />)
    const posture = await screen.findByTestId("posture")
    expect(posture).toHaveTextContent("1 policy · 2 legal holds")
    expect(posture.textContent).not.toContain("1 policies")
  })

  it("sweeps switched off: the amber sentence REPLACES both sweep items", async () => {
    m.getRetentionSummary.mockResolvedValue({ ...HEALTHY, sweep_enabled: false })
    render(<RetentionTab />)
    const posture = await screen.findByTestId("posture")
    expect(posture).toHaveTextContent(
      "Scheduled sweeps are off. Nothing is archived or queued until they are turned on. Preview still works.",
    )
    expect(posture.textContent).not.toMatch(/Last sweep|Next sweep/)
  })

  it("never run, and a sweep that did not finish", async () => {
    m.getRetentionSummary.mockResolvedValue({ ...HEALTHY, last_run_at: null, last_status: null })
    const { unmount } = render(<RetentionTab />)
    expect(await screen.findByTestId("posture")).toHaveTextContent(
      "No sweep has run yet. Preview a policy to see what the first one would do.",
    )
    unmount()
    m.getRetentionSummary.mockResolvedValue({ ...HEALTHY, last_status: "incomplete" })
    render(<RetentionTab />)
    expect(await screen.findByTestId("posture")).toHaveTextContent(
      `Last sweep ${dt("2026-10-12T02:00:00Z")} did not finish. It changed nothing for the policies it could not complete.`,
    )
  })

  it("a load error says so with Try again, and a retry renders the posture", async () => {
    m.getRetentionSummary.mockRejectedValueOnce(new Error("down"))
    render(<RetentionTab />)
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Couldn't load retention. Try again.")
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }))
    expect(await screen.findByTestId("posture")).toBeInTheDocument()
  })
})

describe("RetentionTab — the sub-tabs (D-01)", () => {
  it("tablist with Policies selected by default; Waiting's accessible name carries the count; the pill is red at N > 0", async () => {
    render(<RetentionTab />)
    const list = screen.getByRole("tablist", { name: "Retention" })
    const tabs = within(list).getAllByRole("tab")
    expect(tabs.map((t) => t.textContent?.replace(/\d.*/, "").trim())).toEqual(["Policies", "Legal holds", "Waiting for you", "History"])
    expect(within(list).getByRole("tab", { name: /^Policies/ })).toHaveAttribute("aria-selected", "true")
    const waiting = await within(list).findByRole("tab", { name: "Waiting for you, 4 waiting" })
    expect(within(waiting).getByTestId("retention-count-waiting").className).toContain("bg-destructive/10")
    expect(within(list).getByTestId("retention-count-holds")).toHaveTextContent("1 active")
  })

  it("the pill is NOT red when nothing waits", async () => {
    m.getRetentionSummary.mockResolvedValue({ ...HEALTHY, counts: { policies: 3, active_holds: 1, waiting: 0 } })
    render(<RetentionTab />)
    const waiting = await screen.findByRole("tab", { name: "Waiting for you, 0 waiting" })
    expect(within(waiting).getByTestId("retention-count-waiting").className).not.toContain("bg-destructive")
  })

  it("arrow keys move the selection (roving focus)", async () => {
    render(<RetentionTab />)
    const policies = screen.getByRole("tab", { name: /^Policies/ })
    policies.focus()
    fireEvent.keyDown(policies, { key: "ArrowRight" })
    const holds = screen.getByRole("tab", { name: /^Legal holds/ })
    expect(holds).toHaveAttribute("aria-selected", "true")
    expect(holds).toHaveFocus()
    expect(await screen.findByText("No legal holds")).toBeInTheDocument()
    fireEvent.keyDown(holds, { key: "ArrowLeft" })
    expect(screen.getByRole("tab", { name: /^Policies/ })).toHaveAttribute("aria-selected", "true")
  })
})

describe("RetentionTab — the Policies table (S1)", () => {
  it("renders the server's text per column; the sub line reads the server's sweep hour, never a constant", async () => {
    render(<RetentionTab />)
    const row = await screen.findByRole("button", { name: "Finance invoices" })
    expect(row).toHaveTextContent("All documents in /Finance/Invoices (and subfolders)")
    expect(row).toHaveTextContent("7 years after the document date")
    expect(row).toHaveTextContent("Archive")
    expect(row).toHaveTextContent("4 due now")
    expect(row).toHaveTextContent("1 undecidable")
    expect(row).toHaveTextContent(`next: ${d("2032-04-08")}`)
    const two = screen.getByRole("button", { name: "Short archive" })
    expect(two).toHaveTextContent("Delete · needs approval") // the second stage's tag
    expect(two).toHaveTextContent("nothing else due")
    expect(screen.getByTestId("policies-sub")).toHaveTextContent(
      "Checked every night at 03:00 UTC. Archive happens on its own. Delete always waits for a person.",
    )
  })

  it("the empty state", async () => {
    m.listPolicies.mockResolvedValue({ policies: [], evaluation_incomplete: false })
    render(<RetentionTab />)
    expect(await screen.findByText("No retention policies yet")).toBeInTheDocument()
    expect(
      screen.getByText("Nothing in the Library is archived or deleted until a policy says so. Create one and preview it before it can run."),
    ).toBeInTheDocument()
  })

  it("Enter on a row opens the editor in place; Back to policies returns to the list", async () => {
    render(<RetentionTab />)
    const row = await screen.findByRole("button", { name: "Finance invoices" })
    row.focus()
    fireEvent.keyDown(row, { key: "Enter" })
    expect(await screen.findByText("Edit “Finance invoices”")).toBeInTheDocument()
    expect(screen.getByText("Retention › Policies ›")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Back to policies" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "Finance invoices" })).toHaveFocus())
  })

  it("a saved policy pulses the band (onRecorded) and re-reads the posture", async () => {
    m.previewPolicy.mockResolvedValue({
      draft_hash: "h", action: "archive", has_stage2: false, counts: {}, private_not_covered: 0,
      buckets: { act: [], hold: [], undecidable: [], kept: [], not_yet: [], already: [] },
    })
    m.createPolicy.mockResolvedValue(POLICIES.policies[0])
    m.listDocumentTypes.mockResolvedValue([{ value: "invoice", count: 9 }])
    const onRecorded = vi.fn()
    render(<RetentionTab onRecorded={onRecorded} />)
    await userEvent.click(await screen.findByRole("button", { name: "+ New policy" }))
    await userEvent.type(screen.getByLabelText("Name"), "Invoices")
    await screen.findByRole("option", { name: "Invoice (9)" })
    await userEvent.selectOptions(screen.getByLabelText("Document type"), "invoice")
    await userEvent.click(screen.getByRole("button", { name: "1 · Preview what this would do" }))
    await waitFor(() => expect(screen.getByRole("button", { name: "2 · Save policy" })).toHaveAttribute("aria-disabled", "false"))
    await userEvent.click(screen.getByRole("button", { name: "2 · Save policy" }))
    await waitFor(() => expect(onRecorded).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(m.getRetentionSummary).toHaveBeenCalledTimes(2))
  })
})
