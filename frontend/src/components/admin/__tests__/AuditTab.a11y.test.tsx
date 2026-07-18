/**
 * Phase 155 Plan 05 Task 1 — AuditTab a11y contract (WCAG 2.1 AA / D-01, D-05).
 *
 * The 067-A one-browser-two-ledgers audit surface is a PRESENTATIONAL LEAF (the shell
 * owns the fetch; this leaf holds the local FILTER state + renders). Its honest states
 * are: operator source populated / empty, platform source loading / populated / empty,
 * and the over-cap export refusal. This suite locks the D-12 zero-STRUCTURAL-violations
 * bar across those states plus the D-05 chip-filter role/name contract:
 *   - the source switch is a role="tablist" ("Audit source") with two role="tab"
 *     buttons whose aria-selected reflects the active ledger;
 *   - the chip-filter controls (the action-type + date chips, their clear ✕ buttons)
 *     are reachable by role + accessible NAME — icon-only clears carry aria-label;
 *   - the export refusal is announced as role="alert" (visible WORDS, never
 *     colour-alone);
 *   - a write row exposes an sr-only "Change:" label beside the aria-hidden ✎ mark
 *     (accessible ledger-row structure).
 *
 * The open chip popover + its aria-hidden backdrop are NOT axe-scanned (the scans keep
 * every popover closed — the backdrop only renders while a chip is open); the roles/
 * names are asserted separately. STRUCTURAL rules only (no contrast assertion).
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"

import { AuditTab, type AuditSource } from "../AuditTab"
import type { OperatorAuditRow, PlatformAuditPage } from "@/lib/api"

const OPERATOR_ROWS: OperatorAuditRow[] = [
  {
    id: "op-1",
    action: "user.disable",
    label: "Disabled a user",
    is_write: true,
    target_type: "user",
    target_id: "u-9",
    created_at: "2026-07-15T10:00:00Z",
  },
  {
    id: "op-2",
    action: "audit.view",
    label: "Viewed the audit log",
    is_write: false,
    target_type: null,
    target_id: null,
    created_at: "2026-07-15T09:00:00Z",
  },
]

const PLATFORM_PAGE: PlatformAuditPage = {
  entries: [
    {
      id: "pl-1",
      user_id: "user-abcd1234ef",
      action_type: "document.upload",
      metadata: null,
      created_at: "2026-07-15T08:00:00Z",
    },
  ],
  page: 1,
  page_size: 25,
  has_more: false,
}

interface AuditProps {
  source: AuditSource
  operatorRows: OperatorAuditRow[]
  platformResult: PlatformAuditPage | null
  platformLoading: boolean
  showTechnical: boolean
  onExportPlatform?: () => Promise<void>
}

function renderAudit(overrides: Partial<AuditProps> = {}) {
  const props: AuditProps = {
    source: "operator",
    operatorRows: OPERATOR_ROWS,
    platformResult: null,
    platformLoading: false,
    showTechnical: false,
    ...overrides,
  }
  return render(
    <AuditTab
      source={props.source}
      onSourceChange={vi.fn()}
      operatorRows={props.operatorRows}
      platformResult={props.platformResult}
      platformLoading={props.platformLoading}
      onQueryPlatform={vi.fn()}
      onExportPlatform={props.onExportPlatform ?? vi.fn().mockResolvedValue(undefined)}
      showTechnical={props.showTechnical}
      onToggleTechnical={vi.fn()}
    />,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("AuditTab a11y — WCAG 2.1 AA (structural) across honest states", () => {
  it("no aXe structural violations — operator source, populated", async () => {
    const { container } = renderAudit({ source: "operator" })
    await screen.findByText("Disabled a user")
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — operator source, empty", async () => {
    const { container } = renderAudit({ source: "operator", operatorRows: [] })
    await screen.findByText(/no actions yet/i)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — platform source, loading", async () => {
    const { container } = renderAudit({
      source: "platform",
      platformResult: null,
      platformLoading: true,
    })
    await screen.findByText(/loading platform activity/i)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — platform source, populated", async () => {
    const { container } = renderAudit({
      source: "platform",
      platformResult: PLATFORM_PAGE,
      platformLoading: false,
    })
    await screen.findByText(/uploaded a document/i)
    expect(await axe(container)).toHaveNoViolations()
  })

  it("no aXe structural violations — ⌥ Technical names revealed", async () => {
    const { container } = renderAudit({ source: "operator", showTechnical: true })
    await screen.findByText("user.disable") // the raw action code appears
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("AuditTab a11y — D-05 source switch + chip-filter roles + names", () => {
  it("the source switch is a named tablist with two role=tab controls (aria-selected reflects the ledger)", () => {
    renderAudit({ source: "operator" })
    const tablist = screen.getByRole("tablist", { name: /audit source/i })
    const opTab = within(tablist).getByRole("tab", { name: /operator actions/i })
    const platformTab = within(tablist).getByRole("tab", { name: /platform activity/i })
    expect(opTab).toHaveAttribute("aria-selected", "true")
    expect(platformTab).toHaveAttribute("aria-selected", "false")
  })

  it("the action-type + date chip triggers are reachable by role + accessible name", () => {
    renderAudit({ source: "operator" })
    // The default (unfiltered) chip labels are the queryable button names.
    expect(screen.getByRole("button", { name: /^any action$/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^any time$/i })).toBeInTheDocument()
  })

  it("an active filter's clear ✕ (icon-only) carries an aria-label — never colour/glyph-alone", async () => {
    const user = userEvent.setup()
    renderAudit({ source: "operator" })
    // Open the date chip and pick a preset so the clear ✕ renders.
    await user.click(screen.getByRole("button", { name: /^any time$/i }))
    await user.click(screen.getByRole("button", { name: /last 7 days/i }))
    // The icon-only clear button announces itself by name (the button-name sweep proof).
    expect(screen.getByRole("button", { name: /clear date filter/i })).toBeInTheDocument()
  })

  it("the export control + the ⌥ Technical-names toggle are reachable by role + name", () => {
    renderAudit({ source: "operator" })
    expect(screen.getByRole("button", { name: /export \d+ entr/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /technical names/i })).toHaveAttribute("aria-pressed", "false")
  })

  it("a write row exposes an sr-only 'Change:' label beside the aria-hidden ✎ mark (accessible ledger row)", () => {
    renderAudit({ source: "operator" })
    // The ✎ change mark is aria-hidden; the row still reads "Change:" to a screen reader.
    expect(screen.getByText(/^change:$/i)).toBeInTheDocument()
  })
})

describe("AuditTab a11y — cross-user read notice + export refusal (never colour-alone)", () => {
  it("the platform cross-user notice is a visible WORD, not colour-alone", () => {
    renderAudit({ source: "platform", platformResult: PLATFORM_PAGE })
    expect(screen.getByText(/looking at user activity is itself recorded/i)).toBeInTheDocument()
  })

  it("an over-cap export refusal is announced as role=alert (visible words)", async () => {
    const user = userEvent.setup()
    const onExportPlatform = vi.fn().mockRejectedValue({ status: 413 })
    renderAudit({
      source: "platform",
      platformResult: PLATFORM_PAGE,
      platformLoading: false,
      onExportPlatform,
    })

    await user.click(screen.getByRole("button", { name: /export \d+ entr/i }))

    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent(/narrow the filter/i)
  })
})
