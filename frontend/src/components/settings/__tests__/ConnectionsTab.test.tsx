/**
 * Phase 190-16 (CONN-02 / D-25 / D-26 / D-27, UI-SPEC §2c–§2h, §12, §14) —
 * the Settings → Connections contract.
 *
 * WHAT THIS SUITE IS FOR, in one sentence per case: every assertion below guards a
 * §14 "how we'd know this failed" condition that NOTHING ELSE in the tree can see.
 *
 *   1. The two empty states are DIFFERENT strings — §2d's named risk is conflating
 *      "no connection matches this filter" with "you have no connections". Both are
 *      plain text with no type system behind them.
 *   2. All four states carry a GLYPH **and** a WORD (WCAG 1.4.1). A colour-only state
 *      is invisible to a greyscale reader and to a colour-blind one, and a class
 *      assertion cannot tell the difference — so the WORD is asserted in `textContent`,
 *      independently of any class.
 *   3. The `⋯` trigger's accessible name carries the row's OWN name. Radix supplies no
 *      name for a glyph child, and 24 nodes announcing as "button, more" is the exact
 *      failure §12 exists to prevent — so THREE rows are rendered and three DISTINCT
 *      names asserted, which a single-row test could never catch.
 *   4. The OFF banner appears EXACTLY ONCE and NEVER on a row (D-26). At 24 rows a
 *      per-row notice is 24 identical amber lines — sketch 155's `tell it` finding.
 *   5. U-02: for a non-admin the Add button is ABSENT FROM THE DOM, not merely
 *      `disabled`. `toBeDisabled()` would pass on the defect this row guards.
 *   6. The destructive guards are GRADED (§2g) and the victim is named IN THE BUTTON
 *      LABEL, not only in the prose above it.
 *   7. A write lands as a RECEIPT (`role="status"`), never a toast, and the persistent
 *      state chip beside it is a separate thing (`consequence ≠ receipt`).
 *   8. NO `title` attribute anywhere in the rendered output (142-B / the 184-07 lesson).
 *
 * Plus the four this plan added because they are the ones that would ship a LIE:
 *   9. D-190-DEF-07's structural half — with `live_connectors` off, every write
 *      affordance is REMOVED. A rendered button the API refuses is the mirror image of
 *      the hidden button the API honours, and this surface must ship neither.
 *  10. The technical name renders inside a real `<code>` (§2h) — asserted on the RENDERED
 *      tag, which is stronger than the plan's source grep because it survives the string
 *      being sourced from the copy module.
 *  11. `Used by` is derived from a REAL published-definition payload, including the
 *      own-property guard (a definition is author-supplied JSONB).
 *  12. T-190-16-T7 — no secret-shaped key reaches the rendered DOM.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ConnectionsTabView } from "../ConnectionsTab"
import { CATALOG_SERVICES } from "../servicesCatalog"
// The container's SOURCE via Vite's `?raw` loader — the shipped house idiom for a fence the
// rendered DOM cannot express (`ConnectionPicker.test.tsx:31`, `CanvasToolbar.test.tsx:32`).
import connectionsTabSource from "../ConnectionsTab?raw"
import {
  CONNECTIONS_ADD_CTA,
  CONNECTIONS_BANNER_HEADING,
  CONNECTIONS_COLUMNS,
  CONNECTIONS_DENSE_LABEL_CREDENTIAL,
  CONNECTIONS_DENSE_LABEL_USED_BY,
  CONNECTIONS_EMPTY_BODY,
  CONNECTIONS_EMPTY_HEADING,
  CONNECTIONS_FILTERED_TO_ZERO,
  CONNECTIONS_NON_ADMIN_NOTE,
  CONNECTION_FIXED_TAG,
  CONNECTION_STATE_WORDS,
  CREDENTIAL_NO_CHECK_FOR_KIND,
  LIVE_CONNECTORS_FEATURE_KEY,
  SLACK_FIXED_HOST,
  RECEIPT_DELETED,
  RECEIPT_DISABLED,
  RECEIPT_ENABLED,
  connectionsCountLabel,
  destinationFactsOf,
  moreActionsLabel,
  usageCountsFrom,
  usedByLabel,
  connectionStateOf,
} from "../connectionsCopy"
import type { ConnectorConnection, PublishedWorkflow } from "@/lib/api"

// ── Fixtures ─────────────────────────────────────────────────────────────────────────

function makeConnection(overrides: Partial<ConnectorConnection> = {}): ConnectorConnection {
  return {
    id: "conn-1",
    org_id: "org-1",
    capability: "send_email",
    // ⚠ REQUIRED since 211-02 — migration 127's `connector_connections_has_a_service_identity`
    // guarantees a non-blank value on every row, so a fixture without one models a row the
    // server cannot produce. The row-level surface reads it in Phase 212, not here.
    service_id: "smtp",
    name: "Ops mailbox",
    config: { host: "smtp.fastmail.com", port: 465, from_address: "ops@northwind.co", tls: "implicit" },
    is_enabled: true,
    last_checked_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    last_check_verdict: "ok",
    ...overrides,
  }
}

/** Three rows with three DIFFERENT names — case 3 is unfalsifiable on one row. */
const THREE_ROWS: ConnectorConnection[] = [
  makeConnection({ id: "conn-1", name: "Ops mailbox" }),
  makeConnection({
    id: "conn-2",
    name: "Northwind Jira",
    capability: "create_ticket",
    config: { base_url: "northwind.atlassian.net", project_key: "NW", account_email: "ops@northwind.co" },
    last_checked_at: null,
    last_check_verdict: "not_checked",
  }),
  makeConnection({
    id: "conn-3",
    name: "#ops-alerts",
    capability: "post_message",
    config: { default_channel: "#ops-alerts" },
    last_check_verdict: "failed",
  }),
]

const handlers = {
  onDelete: vi.fn().mockResolvedValue(undefined),
  onSetEnabled: vi.fn().mockResolvedValue(undefined),
}

function renderTab(
  props: Partial<React.ComponentProps<typeof ConnectionsTabView>> = {},
) {
  return render(
    <ConnectionsTabView
      connections={THREE_ROWS}
      catalogServices={[]}
      usageCounts={{}}
      isOrgAdmin
      liveConnectorsOn
      {...handlers}
      {...props}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  // Radix DropdownMenu uses pointer-capture + scrollIntoView APIs jsdom does not
  // implement; stub them so the ⋯-menu opens under user-event (the standard shim, the
  // `PublishedCardDelete.test.tsx:90-95` precedent).
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
})

afterEach(() => {
  cleanup()
})

/** Open one row's ⋯ menu by its OWN accessible name. */
async function openRowMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole("button", { name: moreActionsLabel(name) }))
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 · The two empty states are DIFFERENT facts and must not borrow each other's copy
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the two empty states (§2d / §2e)", () => {
  it("the filtered-to-zero string and the genuinely-empty body are NOT the same string", () => {
    // The whole risk in one assertion: if a later edit points one branch at the other's
    // constant, every render test below still passes and this one does not.
    expect(CONNECTIONS_FILTERED_TO_ZERO).not.toBe(CONNECTIONS_EMPTY_BODY)
    expect(CONNECTIONS_FILTERED_TO_ZERO).not.toBe(CONNECTIONS_EMPTY_HEADING)
  })

  it("genuinely empty renders the 155-C block, with the load-bearing SECOND sentence intact", () => {
    renderTab({ connections: [] })
    const empty = screen.getByTestId("connections-empty")
    expect(empty).toHaveTextContent(CONNECTIONS_EMPTY_HEADING)
    // Character-identity, not a substring probe: the second sentence is the
    // armed-checkpoint promise (189 D-04) and §2e forbids trimming it.
    expect(empty.textContent).toContain(CONNECTIONS_EMPTY_BODY)
    expect(CONNECTIONS_EMPTY_BODY).toContain(
      "Nothing sends until a person approves it in the run.",
    )
    expect(screen.queryByTestId("connections-filtered-empty")).toBeNull()
  })

  it("filtered to zero renders the OTHER string, and never the empty-state copy", async () => {
    const user = userEvent.setup({ delay: null })
    renderTab()
    await user.type(screen.getByTestId("connections-filter-input"), "zzzz-no-such-row")

    const filteredEmpty = await screen.findByTestId("connections-filtered-empty")
    expect(filteredEmpty).toHaveTextContent(CONNECTIONS_FILTERED_TO_ZERO)
    // The empty state must NOT appear — the org has three connections; only the filter
    // is empty, and saying "No connections yet" here would be a false statement of fact.
    expect(screen.queryByTestId("connections-empty")).toBeNull()
    expect(document.body.textContent).not.toContain(CONNECTIONS_EMPTY_BODY)
  })

  it("the live count reads {N} connections unfiltered and {N} of {total} filtered (§2d)", async () => {
    const user = userEvent.setup({ delay: null })
    renderTab()
    expect(screen.getByTestId("connections-count")).toHaveTextContent(
      connectionsCountLabel(3, 3, false),
    )
    await user.type(screen.getByTestId("connections-filter-input"), "Ops mailbox")
    expect(screen.getByTestId("connections-count")).toHaveTextContent(
      connectionsCountLabel(1, 3, true),
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 · Every state is a GLYPH and a WORD — it must read with colour removed
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the four state words (155-C locked / WCAG 1.4.1)", () => {
  it("all four render glyph AND word, and the word is in textContent independently of any class", () => {
    renderTab({
      connections: [
        makeConnection({ id: "a", name: "A", last_check_verdict: "ok" }),
        makeConnection({ id: "b", name: "B", last_check_verdict: "not_checked" }),
        makeConnection({ id: "c", name: "C", last_check_verdict: "failed" }),
        makeConnection({ id: "d", name: "D", is_enabled: false }),
      ],
    })

    const chips = screen.getAllByTestId("connections-row-state")
    expect(chips).toHaveLength(4)

    const rendered = chips.map((chip) => chip.textContent)
    expect(rendered).toEqual([
      CONNECTION_STATE_WORDS.ready,
      CONNECTION_STATE_WORDS.not_checked,
      CONNECTION_STATE_WORDS.failed,
      CONNECTION_STATE_WORDS.disabled,
    ])

    // The GLYPH half and the WORD half, asserted separately — a chip that lost its glyph
    // would still satisfy a bare "contains Ready".
    const expectations: Array<[string, string]> = [
      ["✓", "Ready"],
      ["◌", "Not checked"],
      ["✕", "Credential failed"],
      ["⏻", "Disabled"],
    ]
    expectations.forEach(([glyph, word], index) => {
      expect(rendered[index]).toContain(glyph)
      expect(rendered[index]).toContain(word)
    })
  })

  it("a DISABLED connection reads Disabled even when its last check passed (the ordering)", () => {
    // The over-claim this guards: `is_enabled: false` + `verdict: ok` reading `✓ Ready`
    // would tell a person a connection is ready when it sends nothing.
    renderTab({
      connections: [makeConnection({ id: "x", name: "X", is_enabled: false, last_check_verdict: "ok" })],
    })
    expect(screen.getByTestId("connections-row-state")).toHaveTextContent(
      CONNECTION_STATE_WORDS.disabled,
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 · The icon-only ⋯ trigger carries THREE DISTINCT accessible names
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the row-overflow trigger's accessible name (§12)", () => {
  it("three rows expose three DISTINCT accessible names, each naming its own connection", () => {
    renderTab()
    const triggers = screen.getAllByTestId("connections-row-more")
    expect(triggers).toHaveLength(3)

    const names = triggers.map((trigger) => trigger.getAttribute("aria-label"))
    expect(names).toEqual([
      moreActionsLabel("Ops mailbox"),
      moreActionsLabel("Northwind Jira"),
      moreActionsLabel("#ops-alerts"),
    ])
    // DISTINCT — the whole point. Three buttons that all announce as "more" would pass a
    // bare "has an aria-label" assertion.
    expect(new Set(names).size).toBe(3)
    names.forEach((name) => expect(name).not.toBe("More actions"))
  })

  it("each trigger is reachable BY that name through the accessibility tree, not just by attribute", () => {
    renderTab()
    expect(
      screen.getByRole("button", { name: moreActionsLabel("Northwind Jira") }),
    ).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 · The OFF banner: exactly ONE node, and ZERO per-row notices (D-26)
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the live_connectors OFF banner (D-26 / §2h)", () => {
  it("renders EXACTLY ONCE above the card and ZERO times on any row", () => {
    renderTab({ liveConnectorsOn: false })

    // Exactly one banner node.
    expect(screen.getAllByTestId("connections-off-banner")).toHaveLength(1)
    // …and the heading appears exactly once in the whole document, which is the assertion
    // that actually catches a per-row copy: three rows would give three headings.
    expect(screen.getAllByText(CONNECTIONS_BANNER_HEADING)).toHaveLength(1)

    // ZERO rows carry it. At 24 rows a per-row notice is 24 identical amber lines.
    const rows = screen.getAllByTestId("connections-row")
    expect(rows).toHaveLength(3)
    rows.forEach((row) => {
      expect(row.textContent).not.toContain(CONNECTIONS_BANNER_HEADING)
      expect(row.textContent).not.toContain(LIVE_CONNECTORS_FEATURE_KEY)
      expect(within(row).queryByTestId("connections-off-banner")).toBeNull()
    })
  })

  it("with the switch ON the banner is ABSENT (the non-vacuity control)", () => {
    // Without this, the case above would pass on a component that always renders a banner
    // in exactly one place — including on a platform that IS sending.
    renderTab({ liveConnectorsOn: true })
    expect(screen.queryByTestId("connections-off-banner")).toBeNull()
    expect(screen.queryByText(CONNECTIONS_BANNER_HEADING)).toBeNull()
  })

  it("the technical name renders inside a real <code>, exactly once (§2h)", () => {
    renderTab({ liveConnectorsOn: false })
    const flag = screen.getByText(LIVE_CONNECTORS_FEATURE_KEY)
    // Asserted on the RENDERED tag rather than by a source grep: the string is sourced
    // from the copy module, so only the DOM can prove where it landed.
    expect(flag.tagName).toBe("CODE")
    expect(screen.getAllByText(LIVE_CONNECTORS_FEATURE_KEY)).toHaveLength(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5 · U-02 — the Add button is REMOVED for a non-admin, not disabled
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the org-admin gate, render side (U-02)", () => {
  it("a non-admin gets NO Add button in the DOM at all, plus the one explanation line", () => {
    renderTab({ isOrgAdmin: false, onAdd: vi.fn() })

    // ABSENT, not disabled — `toBeDisabled()` would pass on the very defect this guards.
    expect(screen.queryByTestId("connections-add")).toBeNull()
    expect(screen.queryByText(CONNECTIONS_ADD_CTA)).toBeNull()
    expect(document.body.textContent).not.toContain(CONNECTIONS_ADD_CTA)

    expect(screen.getByTestId("connections-non-admin-note")).toHaveTextContent(
      CONNECTIONS_NON_ADMIN_NOTE,
    )
  })

  it("an ADMIN with a handler DOES get the button (the non-vacuity control)", () => {
    renderTab({ isOrgAdmin: true, onAdd: vi.fn() })
    expect(screen.getByTestId("connections-add")).toBeInTheDocument()
    expect(screen.queryByTestId("connections-non-admin-note")).toBeNull()
  })

  it("a non-admin still gets NO row-overflow trigger — reading is org-wide, writing is not", () => {
    renderTab({ isOrgAdmin: false })
    expect(screen.queryAllByTestId("connections-row-more")).toHaveLength(0)
    // …but the table itself still renders: the reads are deliberately NOT gated, so the
    // tab is a real surface for a member rather than a dead page (plan 190-09 decision 2).
    expect(screen.getAllByTestId("connections-row")).toHaveLength(3)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 6 · D-190-DEF-07's STRUCTURAL half — OFF removes every write affordance
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the OFF state removes writes rather than offering them (D-190-DEF-07, branch b)", () => {
  it("an org ADMIN gets no Add and no ⋯ while live_connectors is off", () => {
    renderTab({ isOrgAdmin: true, liveConnectorsOn: false, onAdd: vi.fn() })
    // The API refuses these writes (require_visible on all three write endpoints), so a
    // rendered control here would be a button the server declines — the mirror image of
    // the hidden-button defect the 069-A contract exists to prevent.
    expect(screen.queryByTestId("connections-add")).toBeNull()
    expect(screen.queryAllByTestId("connections-row-more")).toHaveLength(0)
  })

  it("the empty state offers no Add while the switch is off either", () => {
    renderTab({ connections: [], isOrgAdmin: true, liveConnectorsOn: false, onAdd: vi.fn() })
    expect(screen.getByTestId("connections-empty")).toBeInTheDocument()
    expect(screen.queryByTestId("connections-add-empty")).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 7 · The graded destructive guards (§2g), with the victim named in the BUTTON LABEL
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("destructive grading (§2g — 146–148, locked)", () => {
  it("Delete ALWAYS opens the victim-naming sheet — even at zero known victims", async () => {
    const user = userEvent.setup({ delay: null })
    renderTab({ usageCounts: {} })

    await openRowMenu(user, "Ops mailbox")
    await user.click(await screen.findByTestId("connections-action-delete"))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Delete Ops mailbox?")).toBeInTheDocument()
    // The victim is named IN THE BUTTON LABEL, not only in the prose above it.
    expect(within(dialog).getByRole("button", { name: "Delete Ops mailbox" })).toBeInTheDocument()
    // Nothing fires until Confirm.
    expect(handlers.onDelete).not.toHaveBeenCalled()
  })

  it("Disable opens the sheet ONLY when Used by > 0", async () => {
    const user = userEvent.setup({ delay: null })
    renderTab({ usageCounts: { "conn-1": 4 } })

    await openRowMenu(user, "Ops mailbox")
    await user.click(await screen.findByTestId("connections-action-disable"))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByText("Disable Ops mailbox?")).toBeInTheDocument()
    expect(within(dialog).getByRole("button", { name: "Disable Ops mailbox" })).toBeInTheDocument()
    expect(dialog).toHaveTextContent("4 published workflow steps send through this connection.")
    expect(handlers.onSetEnabled).not.toHaveBeenCalled()
  })

  it("Disable with NO known victim flips DIRECT — no sheet at all", async () => {
    const user = userEvent.setup({ delay: null })
    renderTab({ usageCounts: {} })

    await openRowMenu(user, "Ops mailbox")
    await user.click(await screen.findByTestId("connections-action-disable"))

    expect(screen.queryByRole("dialog")).toBeNull()
    expect(handlers.onSetEnabled).toHaveBeenCalledWith(
      expect.objectContaining({ id: "conn-1" }),
      false,
    )
  })

  it("Enable is RESTORATIVE and flips DIRECT (the deliberate 068-A asymmetry)", async () => {
    const user = userEvent.setup({ delay: null })
    renderTab({
      connections: [makeConnection({ id: "off-1", name: "Paused mailbox", is_enabled: false })],
      usageCounts: { "off-1": 9 },
    })

    await openRowMenu(user, "Paused mailbox")
    await user.click(await screen.findByTestId("connections-action-enable"))

    // Nine victims and STILL no sheet — restoring is not the destructive direction.
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(handlers.onSetEnabled).toHaveBeenCalledWith(
      expect.objectContaining({ id: "off-1" }),
      true,
    )
  })

  it("Check credential is REMOVED, not inert, while no handler exists (owed by 190-15)", async () => {
    const user = userEvent.setup({ delay: null })
    renderTab()
    await openRowMenu(user, "Ops mailbox")
    await screen.findByTestId("connections-action-delete")
    expect(screen.queryByTestId("connections-action-check")).toBeNull()

    cleanup()
    const onCheck = vi.fn().mockResolvedValue(undefined)
    renderTab({ onCheck })
    await openRowMenu(user, "Ops mailbox")
    expect(await screen.findByTestId("connections-action-check")).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 8 · Receipt, never toast — and `consequence ≠ receipt`
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the write receipt (062-A)", () => {
  it("a confirmed delete produces the ✎ … · recorded receipt as a role=status node", async () => {
    const user = userEvent.setup({ delay: null })
    renderTab({ usageCounts: {} })

    await openRowMenu(user, "Ops mailbox")
    await user.click(await screen.findByTestId("connections-action-delete"))
    await user.click(await screen.findByTestId("connections-confirm-delete"))

    const receipt = await screen.findByTestId("connections-receipt")
    expect(receipt).toHaveTextContent(RECEIPT_DELETED)
    expect(receipt).toHaveAttribute("role", "status")
    expect(RECEIPT_DELETED).toMatch(/^✎ .+ · recorded$/)
    expect(handlers.onDelete).toHaveBeenCalledTimes(1)
  })

  it("NO toast component is mounted anywhere — the ledger row is the receipt", async () => {
    const user = userEvent.setup({ delay: null })
    renderTab({ usageCounts: {} })

    await openRowMenu(user, "Ops mailbox")
    await user.click(await screen.findByTestId("connections-action-disable"))
    await screen.findByTestId("connections-receipt")

    // This app ships no toast library at all (`package.json` names none), and this surface
    // must not be the one that introduces a floating one.
    const toastish = document.querySelectorAll(
      "[data-sonner-toast],[data-sonner-toaster],[data-radix-toast-root],[data-radix-toast-viewport],.Toastify__toast,[data-testid='toast']",
    )
    expect(toastish).toHaveLength(0)
  })

  it("consequence ≠ receipt: the direct disable reports the DISABLED verb, not the enable one", async () => {
    const user = userEvent.setup({ delay: null })
    renderTab({ usageCounts: {} })
    await openRowMenu(user, "Ops mailbox")
    await user.click(await screen.findByTestId("connections-action-disable"))
    const receipt = await screen.findByTestId("connections-receipt")
    expect(receipt).toHaveTextContent(RECEIPT_DISABLED)
    expect(RECEIPT_DISABLED).not.toBe(RECEIPT_ENABLED)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 9 · No `title` attribute anywhere, and no secret-shaped key in the DOM
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the surface's two absence properties", () => {
  it("renders ZERO elements carrying a title attribute (142-B / the 184-07 lesson)", async () => {
    const user = userEvent.setup({ delay: null })
    const { container } = renderTab({ usageCounts: { "conn-1": 2 }, onAdd: vi.fn(), onOpen: vi.fn() })
    expect(container.querySelectorAll("[title]")).toHaveLength(0)

    // …including with a menu and a sheet open, which is where a tooltip would be tempting.
    await openRowMenu(user, "Ops mailbox")
    await user.click(await screen.findByTestId("connections-action-delete"))
    await screen.findByRole("dialog")
    expect(document.querySelectorAll("[title]")).toHaveLength(0)
  })

  it("no secret-shaped key reaches the rendered DOM (T-190-16-T7)", () => {
    // The response model carries no ciphertext (plan 190-09), and this surface must not
    // invent one: a `secret`, a token shape or a `cipher` string in the markup would be a
    // disclosure whatever produced it.
    const { container } = renderTab({ usageCounts: { "conn-1": 2 } })
    const markup = container.innerHTML.toLowerCase()
    for (const needle of ["secret", "ciphertext", "password", "xoxb-", "api_token", "enc:v1:"]) {
      expect(markup).not.toContain(needle)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 10 · `Used by` — derived from a real definition payload, with the own-property guard
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the Used by derivation (§2c — the count that names the victims)", () => {
  const workflows: PublishedWorkflow[] = [
    {
      id: "wf-1",
      slug: "vendor-risk",
      name: "Vendor risk",
      definition: {
        phases: [
          { slug: "a", config: { phase_type: "external_action", connection_id: "conn-1" } },
          { slug: "b", config: { phase_type: "llm_emit" } },
          { slug: "c", config: { phase_type: "external_action", connection_id: "conn-1" } },
        ],
      },
    },
    {
      id: "wf-2",
      slug: "alerts",
      name: "Alerts",
      definition: {
        phases: [{ slug: "a", config: { phase_type: "external_action", connection_id: "conn-3" } }],
      },
    },
    // A definition with no phases at all, and one with a null definition — both real
    // shapes in the corpus (`PublishedWorkflow.definition` is optional and nullable).
    { id: "wf-3", slug: "empty", name: "Empty", definition: null },
    { id: "wf-4", slug: "nophases", name: "No phases", definition: {} },
  ]

  it("counts every reference across published definitions, per connection", () => {
    expect(usageCountsFrom(workflows)).toEqual({ "conn-1": 2, "conn-3": 1 })
  })

  it("an INHERITED key is not a binding (the WR-04 own-property guard)", () => {
    // A definition is author-supplied JSONB. `config["connection_id"]` read without an
    // own-property guard picks up nothing here, but `constructor` proves the class of bug:
    // a bare `in`/prototype read counts a member nobody wrote.
    const hostile: PublishedWorkflow[] = [
      {
        id: "wf-x",
        slug: "x",
        name: "X",
        definition: { phases: [{ slug: "a", config: Object.create({ connection_id: "conn-9" }) }] },
      },
    ]
    expect(usageCountsFrom(hostile)).toEqual({})
  })

  it("an empty string is not a binding, and a non-string is not a binding", () => {
    const odd: PublishedWorkflow[] = [
      {
        id: "wf-y",
        slug: "y",
        name: "Y",
        definition: {
          phases: [
            { slug: "a", config: { connection_id: "" } },
            { slug: "b", config: { connection_id: 7 } },
            { slug: "c", config: null },
          ],
        },
      },
    ]
    expect(usageCountsFrom(odd)).toEqual({})
  })

  it("zero reads as NOTHING, never as a bare `0 steps` — and never as a repeated sentence", () => {
    // The read is OWNER-scoped, so zero is a FLOOR: `0 steps` would claim nothing depends
    // on this connection, which this read cannot support. That reasoning is unchanged.
    //
    // ⚠ NOISE AUDIT 2026-08-31 (operator, item B1). What changed is the SPELLING. Zero
    // used to render the words `none you can see`, and on the operator's install SEVEN
    // consecutive rows said exactly that — one identical sentence per connected service,
    // in a column where every value was the same. The scoping caveat it was carrying is
    // said ONCE below the table (`CONNECTIONS_USED_BY_SCOPE_NOTE`), which is where a
    // caveat about a whole column belongs; the per-row echo was that fact said eight times.
    expect(usedByLabel(0)).toBe("")
    expect(usedByLabel(1)).toBe("1 step")
    expect(usedByLabel(4)).toBe("4 steps")

    renderTab({ usageCounts: { "conn-1": 1 } })
    const cells = screen.getAllByTestId("connections-row-usedby").map((c) => c.textContent)
    expect(cells).toEqual(["1 step", "", ""])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 11 · The columns ARE the contract, and the honest four-state read
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the 155-C column contract and the read's four states", () => {
  it("renders the five column headings, in the locked order, with no <table> element", () => {
    const { container } = renderTab()
    const header = screen.getByTestId("connections-header")
    expect(
      Array.from(header.querySelectorAll("[data-column]")).map((el) => el.textContent),
    ).toEqual(["Connection", "Sends to", "Used by", "Credential", "State"])
    // §15: no `table` primitive is introduced on this one surface.
    expect(container.querySelector("table")).toBeNull()
  })

  it("the Sends to cell carries the real host — and `fixed` only on Slack", () => {
    renderTab()
    const cells = screen.getAllByTestId("connections-row-destination")
    expect(cells[0].textContent).toContain("smtp.fastmail.com:465")
    expect(cells[1].textContent).toContain("northwind.atlassian.net")
    expect(cells[2].textContent).toContain("slack.com/api")
    cells.forEach((cell) => expect(cell.textContent).toContain(""))
    expect(cells[0].textContent).not.toContain("fixed")
    expect(cells[2].textContent).toContain("fixed")
  })

  it("Credential reads `never checked` rather than a fabricated time", () => {
    renderTab()
    const cells = screen.getAllByTestId("connections-row-credential").map((c) => c.textContent)
    expect(cells[1]).toBe("never checked")
    expect(cells[0]).toMatch(/^checked /)
  })

  it("loading, error and populated are three DIFFERENT renders", () => {
    const { rerender } = renderTab({ connections: null })
    expect(screen.getByTestId("connections-loading")).toHaveAttribute("aria-busy", "true")

    rerender(
      <ConnectionsTabView
        connections={[]}
        readFailed
        usageCounts={{}}
        isOrgAdmin
        liveConnectorsOn
        {...handlers}
      />,
    )
    // A read failure must never render as "you have no connections" — that would tell a
    // person to create something they may already have.
    expect(screen.getByTestId("connections-read-failed")).toHaveAttribute("role", "alert")
    expect(screen.queryByTestId("connections-empty")).toBeNull()
  })
})

// ── the container actually SUPPLIES onCheck (plan 190-15) ─────────────────────────────────
// The two cases above this comment prove the VIEW removes the item without a handler and
// renders it with one. Neither can see whether the CONTAINER ever passes one — and while it
// did not (190-16, deliberately, because the endpoint did not exist yet) both were green with
// `Check credential` absent from the running app. That gap is what these two close.
describe("the container wires the credential check", () => {
  it("passes onCheck to the view, so the menu item is not permanently removed", () => {
    expect(connectionsTabSource).toMatch(/onCheck=\{handleCheck\}/)
    expect(connectionsTabSource).not.toMatch(/`onCheck` → plan 190-15/)
  })

  it("the handler calls the check endpoint and RE-FETCHES rather than flipping a chip", () => {
    const handler = connectionsTabSource.slice(
      connectionsTabSource.indexOf("const handleCheck"),
      connectionsTabSource.indexOf("return (", connectionsTabSource.indexOf("const handleCheck")),
    )
    expect(handler).toContain("await checkConnectorConnection(connection.id)")
    // The Credential chip is the SERVER's persisted verdict (the 068-A rule the other two
    // writes already follow). A handler that set local state from the response would show a
    // verdict the database may not have accepted.
    expect(handler).toContain("reload()")
    expect(handler).not.toMatch(/set[A-Z]\w*\(/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 13 · Phase 206.1-01 (item 3 · SC#3) — every row wears its OWN service's mark
//
// ⚠ ADDED, NEVER RE-BASELINED. Every case above this banner is untouched by 206.1: an
// `<svg>` contributes ZERO textContent, and `renderTab` passes no `panel`, so swapping the
// three fluent-emoji glyphs for the shared map moved no shipped assertion. If one of the
// 36 had gone red, that would have been a real finding rather than a licence to edit it.
//
// WHY THESE CASES EXIST AT ALL, given `connectionMark.test.tsx` already pins the module:
// that suite proves the RESOLVER is right. These prove the CALL SITE hands it the whole
// connection. An MCP row has no capability at all, so a call site passing `capability`
// alone would send every MCP row to the neutral — a quieter version of the ROADMAP's named
// *"the MCP row borrows another service's mark"* failure, and invisible to the unit suite.
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("SC#3 — the marks reach the row, and they are each their own", () => {
  /** Four rows: the three capabilities plus the shape that has none. */
  const FOUR_SHAPES: ConnectorConnection[] = [
    ...THREE_ROWS,
    makeConnection({
      id: "conn-4",
      name: "DeepWiki MCP",
      capability: null,
      // ⚠ ITS OWN IDENTITY, 2026-08-28. This inherited `makeConnection`'s default
      // `service_id: "smtp"` while being an MCP row — a combination the server cannot
      // produce (an SMTP identity implies the `send_email` capability, and this row has
      // none). It was inert until `connectionMark` learned to let a KNOWN identity outrank
      // the transport for capability-less rows; then the fixture resolved to the mail glyph
      // and this suite's own distinctness assertion caught it. The fixture was wrong, not
      // the ladder — and an uncurated hostname is what a real custom-MCP row carries.
      service_id: "mcp.deepwiki.com",
      mcp_server_url: "https://mcp.deepwiki.com/mcp",
      config: { headers: {} },
      last_checked_at: null,
      last_check_verdict: "not_checked",
    }),
  ]

  /** The row's FIRST `<svg>` is cell 1's mark — the name cell leads every row. */
  function rowMarkBodies() {
    return screen.getAllByTestId("connections-row").map((row) => {
      const svg = row.querySelector("svg")
      expect(svg).not.toBeNull()
      return svg!.innerHTML
    })
  }

  it("all four rows render a NON-EMPTY mark, and the four are PAIRWISE DISTINCT", () => {
    renderTab({ connections: FOUR_SHAPES })

    // Non-vacuity control FIRST: without it, zero rows would satisfy every claim below.
    const rows = screen.getAllByTestId("connections-row")
    expect(rows).toHaveLength(4)

    const bodies = rowMarkBodies()
    bodies.forEach((body) => expect(body.length).toBeGreaterThan(0))
    expect(new Set(bodies).size).toBe(4)
  })

  it("⚠ the MCP row's mark is neither Slack's nor Jira's nor the SMTP one", () => {
    // The ROADMAP's named failure, asserted where it would actually be seen. This is the
    // case that fails if the call site ever narrows to `connection.capability`.
    renderTab({ connections: FOUR_SHAPES })
    const [smtp, jira, slack, mcp] = rowMarkBodies()
    expect(mcp).not.toBe(slack)
    expect(mcp).not.toBe(jira)
    expect(mcp).not.toBe(smtp)
  })

  it("the `All` chip wears NO mark; the three state chips (All, Connected, Not connected) render without service marks", () => {
    // State chips filter by connection readiness rather than capability, so none wear service marks.
    renderTab({ connections: FOUR_SHAPES })
    const chips = screen.getAllByTestId("connections-filter-chip")
    expect(chips).toHaveLength(3)
    expect(chips[0].querySelectorAll("svg")).toHaveLength(0)
    expect(chips[0].textContent).toContain("All")
    expect(chips[1].textContent).toContain("Connected")
    expect(chips[2].textContent).toContain("Not connected")
    chips.forEach((chip) => expect(chip.querySelectorAll("svg")).toHaveLength(0))
  })

  it("no secret-shaped needle rides in on the newly inlined SVG bodies (T-190-16-T7)", () => {
    // Case 12 above scans the THREE-row render. This re-runs the same scan over a render
    // containing all four marks, so the `logos` path data, gradient ids and titles this
    // phase inlines are inside the swept markup rather than beside it.
    const { container } = renderTab({ connections: FOUR_SHAPES })
    expect(screen.getAllByTestId("connections-row")).toHaveLength(4)
    const markup = container.innerHTML.toLowerCase()
    for (const needle of ["secret", "ciphertext", "password", "xoxb-", "api_token", "enc:v1:"]) {
      expect(markup).not.toContain(needle)
    }
  })

  it("the marks come from ONE module — this file imports no icon set directly", () => {
    // The icon convention's actual prohibition is a SECOND HOME for a mark, not a second
    // package. A future edit that re-adds a `~icons/...` import here fails this case.
    expect(connectionsTabSource).not.toContain("~icons/")
    expect(connectionsTabSource).toContain("ConnectionMarkGlyph")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 14 · Phase 206.1-02 Task 1 — THE WIDE RENDER, PINNED BYTE-FOR-BYTE
// ═══════════════════════════════════════════════════════════════════════════════════════

// ⚠ RE-BASELINED 2026-08-31 (noise audit, item B2). These captures are a byte-identity
// fence, so an INTENTIONAL visual change must re-record them or the fence pins the past.
// What changed: the 🔒 that opened every `Sends to` cell was removed — it was on every
// row, so it distinguished nothing. The captures below differ from their 206.1-02
// originals by exactly that one `<span aria-hidden="true">🔒</span>` per row, and by
// nothing else; that narrowness is the point of re-recording rather than deleting.
describe("the WIDE row render is pinned byte-for-byte (206.1-02 Task 1)", () => {
  const CAPTURE_NOW = Date.parse("2026-08-25T12:00:00.000Z")
  const CAPTURE_CHECKED_AT = "2026-08-22T12:00:00.000Z"

  const CAPTURE_ROWS: Record<string, ConnectorConnection> = {
    SEND_EMAIL: makeConnection({
      id: "cap-1",
      name: "Ops mailbox",
      capability: "send_email",
      service_id: "smtp",
      config: {
        host: "smtp.eu-west.fastmail-business.example.com",
        port: 465,
        from_address: "ops@northwind.co",
        tls: "implicit",
      },
      last_checked_at: CAPTURE_CHECKED_AT,
      last_check_verdict: "ok",
    }),
    POST_MESSAGE: makeConnection({
      id: "cap-2",
      name: "#ops-alerts",
      capability: "post_message",
      service_id: "slack",
      config: { default_channel: "#ops-alerts" },
      last_checked_at: CAPTURE_CHECKED_AT,
      last_check_verdict: "ok",
    }),
    CREATE_TICKET: makeConnection({
      id: "cap-3",
      name: "Northwind Jira",
      capability: "create_ticket",
      service_id: "jira",
      config: {
        base_url: "northwind.atlassian.net",
        project_key: "NW",
        account_email: "ops@northwind.co",
      },
      last_checked_at: CAPTURE_CHECKED_AT,
      last_check_verdict: "ok",
    }),
  }

  const RADIX_ID = /id="radix-[^"]*"/g
  const RADIX_ID_NORMALIZED = 'id="radix-NORMALIZED"'

  function normalizeRadixIds(html: string): { html: string; replaced: number } {
    let replaced = 0
    const out = html.replace(RADIX_ID, () => {
      replaced += 1
      return RADIX_ID_NORMALIZED
    })
    return { html: out, replaced }
  }

  function wideCapture(connection: ConnectorConnection): {
    row: string
    header: string
    rowRadixIds: number
  } {
    const rendered = render(
      <ConnectionsTabView
        connections={[connection]}
        usageCounts={{ [connection.id]: 2 }}
        isOrgAdmin
        liveConnectorsOn
        now={CAPTURE_NOW}
        onOpen={() => {}}
        {...handlers}
      />,
    )
    const row = normalizeRadixIds(
      rendered.container.querySelector('[data-testid="connections-row"]')!.outerHTML,
    )
    const header = normalizeRadixIds(
      rendered.container.querySelector('[data-testid="connections-header"]')!.outerHTML,
    )
    rendered.unmount()
    expect(header.replaced).toBe(0)
    return { row: row.html, header: header.html, rowRadixIds: row.replaced }
  }

  const WIDE_HTML_BASELINE: Record<string, { row: string; header: string }> = {
    SEND_EMAIL: {
      row: "<div data-testid=\"connections-row\" data-state=\"ready\" class=\"flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3\"><div class=\"flex min-w-0 flex-[2] flex-col gap-0.5\"><div class=\"flex items-center gap-2 min-w-0\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-mail h-4 w-4 flex-none text-muted-foreground\" aria-hidden=\"true\"><path d=\"m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7\"></path><rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\"></rect></svg><button type=\"button\" data-testid=\"connections-row-name\" class=\"truncate text-left text-[13px] font-medium text-foreground hover:underline\">Ops mailbox</button></div><span data-testid=\"connection-tagline\" class=\"truncate text-[11px] text-muted-foreground\">Direct outbound notifications via standard mail servers.</span></div><div data-testid=\"connections-row-destination\" class=\"flex min-w-0 flex-[2] items-center gap-1.5 truncate font-mono text-[11px] text-muted-foreground\"><span class=\"truncate\">smtp.eu-west.fastmail-business.example.com:465</span></div><div data-testid=\"connections-row-usedby\" class=\"w-24 flex-none whitespace-nowrap text-[11px] text-muted-foreground\">2 steps</div><div data-testid=\"connections-row-credential\" class=\"w-32 flex-none whitespace-nowrap font-mono text-[11px] text-muted-foreground\">checked 3d ago</div><div class=\"w-36 flex-none flex items-center gap-1.5 text-[11px]\"><span data-testid=\"connections-row-state\" class=\"inline-flex items-center gap-1.5 text-[11px] font-medium text-success\"><span class=\"h-1.5 w-1.5 rounded-full flex-none bg-success\" aria-hidden=\"true\"></span>✓ Ready</span></div><div class=\"flex w-8 flex-none items-center justify-end\"><button type=\"button\" aria-label=\"More actions for Ops mailbox\" data-testid=\"connections-row-more\" class=\"inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground\" id=\"radix-NORMALIZED\" aria-haspopup=\"menu\" aria-expanded=\"false\" data-state=\"closed\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-ellipsis h-4 w-4\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"1\"></circle><circle cx=\"19\" cy=\"12\" r=\"1\"></circle><circle cx=\"5\" cy=\"12\" r=\"1\"></circle></svg></button></div></div>",
      header: "<div data-testid=\"connections-header\" class=\"flex items-center gap-x-3 border-b border-border bg-muted/20 px-3.5 py-2\"><div data-column=\"Connection\" class=\"text-[11px] font-medium text-muted-foreground flex-[2] min-w-0\">Connection</div><div data-column=\"Sends to\" class=\"text-[11px] font-medium text-muted-foreground flex-[2] min-w-0\">Sends to</div><div data-column=\"Used by\" class=\"text-[11px] font-medium text-muted-foreground w-24 flex-none\">Used by</div><div data-column=\"Credential\" class=\"text-[11px] font-medium text-muted-foreground w-32 flex-none\">Credential</div><div data-column=\"State\" class=\"text-[11px] font-medium text-muted-foreground w-36 flex-none\">State</div><div class=\"w-8 flex-none\" aria-hidden=\"true\"></div></div>",
    },
    POST_MESSAGE: {
      row: "<div data-testid=\"connections-row\" data-state=\"ready\" class=\"flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3\"><div class=\"flex min-w-0 flex-[2] flex-col gap-0.5\"><div class=\"flex items-center gap-2 min-w-0\"><svg viewBox=\"0 0 256 256\" width=\"1.2em\" height=\"1.2em\" aria-hidden=\"true\" class=\"h-4 w-4 flex-none\"><path fill=\"#e01e5a\" d=\"M53.841 161.32c0 14.832-11.987 26.82-26.819 26.82S.203 176.152.203 161.32c0-14.831 11.987-26.818 26.82-26.818H53.84zm13.41 0c0-14.831 11.987-26.818 26.819-26.818s26.819 11.987 26.819 26.819v67.047c0 14.832-11.987 26.82-26.82 26.82c-14.83 0-26.818-11.988-26.818-26.82z\"></path><path fill=\"#36c5f0\" d=\"M94.07 53.638c-14.832 0-26.82-11.987-26.82-26.819S79.239 0 94.07 0s26.819 11.987 26.819 26.819v26.82zm0 13.613c14.832 0 26.819 11.987 26.819 26.819s-11.987 26.819-26.82 26.819H26.82C11.987 120.889 0 108.902 0 94.069c0-14.83 11.987-26.818 26.819-26.818z\"></path><path fill=\"#2eb67d\" d=\"M201.55 94.07c0-14.832 11.987-26.82 26.818-26.82s26.82 11.988 26.82 26.82s-11.988 26.819-26.82 26.819H201.55zm-13.41 0c0 14.832-11.988 26.819-26.82 26.819c-14.831 0-26.818-11.987-26.818-26.82V26.82C134.502 11.987 146.489 0 161.32 0s26.819 11.987 26.819 26.819z\"></path><path fill=\"#ecb22e\" d=\"M161.32 201.55c14.832 0 26.82 11.987 26.82 26.818s-11.988 26.82-26.82 26.82c-14.831 0-26.818-11.988-26.818-26.82V201.55zm0-13.41c-14.831 0-26.818-11.988-26.818-26.82c0-14.831 11.987-26.818 26.819-26.818h67.25c14.832 0 26.82 11.987 26.82 26.819s-11.988 26.819-26.82 26.819z\"></path></svg><button type=\"button\" data-testid=\"connections-row-name\" class=\"truncate text-left text-[13px] font-medium text-foreground hover:underline\">#ops-alerts</button></div><span data-testid=\"connection-tagline\" class=\"truncate text-[11px] text-muted-foreground\">Post updates and read channels in your workspace.</span></div><div data-testid=\"connections-row-destination\" class=\"flex min-w-0 flex-[2] items-center gap-1.5 truncate font-mono text-[11px] text-muted-foreground\"><span class=\"truncate\">slack.com/api · #ops-alerts</span><span class=\"flex-none rounded border border-border px-1 text-[11px] text-muted-foreground\">fixed</span></div><div data-testid=\"connections-row-usedby\" class=\"w-24 flex-none whitespace-nowrap text-[11px] text-muted-foreground\">2 steps</div><div data-testid=\"connections-row-credential\" class=\"w-32 flex-none whitespace-nowrap font-mono text-[11px] text-muted-foreground\">checked 3d ago</div><div class=\"w-36 flex-none flex items-center gap-1.5 text-[11px]\"><span data-testid=\"connections-row-state\" class=\"inline-flex items-center gap-1.5 text-[11px] font-medium text-success\"><span class=\"h-1.5 w-1.5 rounded-full flex-none bg-success\" aria-hidden=\"true\"></span>✓ Ready</span></div><div class=\"flex w-8 flex-none items-center justify-end\"><button type=\"button\" aria-label=\"More actions for #ops-alerts\" data-testid=\"connections-row-more\" class=\"inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground\" id=\"radix-NORMALIZED\" aria-haspopup=\"menu\" aria-expanded=\"false\" data-state=\"closed\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-ellipsis h-4 w-4\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"1\"></circle><circle cx=\"19\" cy=\"12\" r=\"1\"></circle><circle cx=\"5\" cy=\"12\" r=\"1\"></circle></svg></button></div></div>",
      header: "<div data-testid=\"connections-header\" class=\"flex items-center gap-x-3 border-b border-border bg-muted/20 px-3.5 py-2\"><div data-column=\"Connection\" class=\"text-[11px] font-medium text-muted-foreground flex-[2] min-w-0\">Connection</div><div data-column=\"Sends to\" class=\"text-[11px] font-medium text-muted-foreground flex-[2] min-w-0\">Sends to</div><div data-column=\"Used by\" class=\"text-[11px] font-medium text-muted-foreground w-24 flex-none\">Used by</div><div data-column=\"Credential\" class=\"text-[11px] font-medium text-muted-foreground w-32 flex-none\">Credential</div><div data-column=\"State\" class=\"text-[11px] font-medium text-muted-foreground w-36 flex-none\">State</div><div class=\"w-8 flex-none\" aria-hidden=\"true\"></div></div>",
    },
    CREATE_TICKET: {
      row: "<div data-testid=\"connections-row\" data-state=\"ready\" class=\"flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3\"><div class=\"flex min-w-0 flex-[2] flex-col gap-0.5\"><div class=\"flex items-center gap-2 min-w-0\"><svg viewBox=\"0 0 256 256\" width=\"1.2em\" height=\"1.2em\" aria-hidden=\"true\" class=\"h-4 w-4 flex-none\"><defs><linearGradient id=\"SVGSBI7obaC\" x1=\"98.031%\" x2=\"58.888%\" y1=\".161%\" y2=\"40.766%\"><stop offset=\"18%\" stop-color=\"#0052cc\"></stop><stop offset=\"100%\" stop-color=\"#2684ff\"></stop></linearGradient><linearGradient id=\"SVGHifZlbzE\" x1=\"100.665%\" x2=\"55.402%\" y1=\".455%\" y2=\"44.727%\"><stop offset=\"18%\" stop-color=\"#0052cc\"></stop><stop offset=\"100%\" stop-color=\"#2684ff\"></stop></linearGradient></defs><path fill=\"#2684ff\" d=\"M244.658 0H121.707a55.5 55.5 0 0 0 55.502 55.502h22.649V77.37c.02 30.625 24.841 55.447 55.466 55.467V10.666C255.324 4.777 250.55 0 244.658 0\"></path><path fill=\"url(#SVGSBI7obaC)\" d=\"M183.822 61.262H60.872c.019 30.625 24.84 55.447 55.466 55.467h22.649v21.938c.039 30.625 24.877 55.43 55.502 55.43V71.93c0-5.891-4.776-10.667-10.667-10.667\"></path><path fill=\"url(#SVGHifZlbzE)\" d=\"M122.951 122.489H0c0 30.653 24.85 55.502 55.502 55.502h22.72v21.867c.02 30.597 24.798 55.408 55.396 55.466V133.156c0-5.891-4.776-10.667-10.667-10.667\"></path></svg><button type=\"button\" data-testid=\"connections-row-name\" class=\"truncate text-left text-[13px] font-medium text-foreground hover:underline\">Northwind Jira</button></div><span data-testid=\"connection-tagline\" class=\"truncate text-[11px] text-muted-foreground\">Raise and track issues for your team.</span></div><div data-testid=\"connections-row-destination\" class=\"flex min-w-0 flex-[2] items-center gap-1.5 truncate font-mono text-[11px] text-muted-foreground\"><span class=\"truncate\">northwind.atlassian.net · NW</span></div><div data-testid=\"connections-row-usedby\" class=\"w-24 flex-none whitespace-nowrap text-[11px] text-muted-foreground\">2 steps</div><div data-testid=\"connections-row-credential\" class=\"w-32 flex-none whitespace-nowrap font-mono text-[11px] text-muted-foreground\">checked 3d ago</div><div class=\"w-36 flex-none flex items-center gap-1.5 text-[11px]\"><span data-testid=\"connections-row-state\" class=\"inline-flex items-center gap-1.5 text-[11px] font-medium text-success\"><span class=\"h-1.5 w-1.5 rounded-full flex-none bg-success\" aria-hidden=\"true\"></span>✓ Ready</span></div><div class=\"flex w-8 flex-none items-center justify-end\"><button type=\"button\" aria-label=\"More actions for Northwind Jira\" data-testid=\"connections-row-more\" class=\"inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground\" id=\"radix-NORMALIZED\" aria-haspopup=\"menu\" aria-expanded=\"false\" data-state=\"closed\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-ellipsis h-4 w-4\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"1\"></circle><circle cx=\"19\" cy=\"12\" r=\"1\"></circle><circle cx=\"5\" cy=\"12\" r=\"1\"></circle></svg></button></div></div>",
      header: "<div data-testid=\"connections-header\" class=\"flex items-center gap-x-3 border-b border-border bg-muted/20 px-3.5 py-2\"><div data-column=\"Connection\" class=\"text-[11px] font-medium text-muted-foreground flex-[2] min-w-0\">Connection</div><div data-column=\"Sends to\" class=\"text-[11px] font-medium text-muted-foreground flex-[2] min-w-0\">Sends to</div><div data-column=\"Used by\" class=\"text-[11px] font-medium text-muted-foreground w-24 flex-none\">Used by</div><div data-column=\"Credential\" class=\"text-[11px] font-medium text-muted-foreground w-32 flex-none\">Credential</div><div data-column=\"State\" class=\"text-[11px] font-medium text-muted-foreground w-36 flex-none\">State</div><div class=\"w-8 flex-none\" aria-hidden=\"true\"></div></div>",
    },
  }

  /**
   * ── ⚠ 206.1-02 TASK 2 — THE ONE DECLARED DELTA AGAINST THE THREE CAPTURES ABOVE ────────
   *
   * ⚠ NOT ONE CHARACTER OF THE THREE CAPTURE LITERALS IS EDITED, AND THAT IS THE WHOLE
   * DESIGN OF THIS BLOCK. Their own docblock says a diff against them "IS A BEHAVIOUR
   * CHANGE IN THE WIDE ROW — and NOT A TEST TO UPDATE", and re-capturing them would delete
   * the only evidence anybody has that the wide row still renders what it rendered.
   *
   * ⚠ AND TASK 2 MAKES EXACTLY ONE DELIBERATE CHANGE TO THE WIDE ROW, WHICH IS A REAL
   * CONFLICT THIS PLAN CONTAINED AND WHICH IS RESOLVED HERE RATHER THAN PAPERED OVER. The
   * plan requires BOTH that `data-dense` be "always present, both values" on the row
   * (D-206.1-12 — an absent attribute reads as falsy to every consumer, which is the
   * "0 is a fact, absence is a different one" trap) AND that this capture "pass UNEDITED".
   * Those two cannot both be literally true: adding an attribute to the wide row changes
   * the wide row's DOM by definition.
   *
   * The house answer is neither to re-capture nor to abandon the attribute: it is to keep
   * the captures VERBATIM and declare the delta as a NAMED, SINGULAR, MACHINE-CHECKED
   * transformation of them. That precedent lives in `PhaseNodeCard.test.tsx` — the same
   * file this whole capture idiom was imported from — under its own "199-01 Task 2 — THE
   * ONE DECLARED DELTA" heading, for exactly this situation.
   *
   * THE ARITHMETIC CLOSES WITH NO RESIDUAL, which is what separates a declared change from
   * drift: shipped == captured + exactly this term, at exactly one position, on exactly the
   * `connections-row` element. All three conditions are ASSERTED below, not asserted in
   * prose — and the delta is proved REAL (the capture predates the attribute) and SINGULAR
   * (one anchor occurrence) before it is applied, so a second `data-dense` appearing
   * anywhere, or the attribute silently vanishing, fails rather than passes.
   *
   * ⚠ THE HEADER CAPTURE TAKES NO DELTA AT ALL and is compared verbatim: `data-dense` is a
   * ROW attribute. A header that acquired one would be new surface and must go red.
   */
  const WIDE_DELTA_ANCHOR = ' data-state="ready"'
  const WIDE_DELTA_TERM = ' data-dense="false"'

  function withDeclaredDelta(captured: string): string {
    expect(captured).not.toContain("data-dense")
    expect(captured.split(WIDE_DELTA_ANCHOR)).toHaveLength(2)
    return captured.replace(WIDE_DELTA_ANCHOR, WIDE_DELTA_ANCHOR + WIDE_DELTA_TERM)
  }

  for (const key of Object.keys(CAPTURE_ROWS)) {
    it(`the wide ${key} row renders byte-for-byte what it rendered at 206.1-02's base`, () => {
      // ── NON-VACUITY FIRST. Byte-identity against an empty capture passes forever. ──
      expect(WIDE_HTML_BASELINE[key].row.length).toBeGreaterThan(0)
      expect(WIDE_HTML_BASELINE[key].header.length).toBeGreaterThan(0)

      const actual = wideCapture(CAPTURE_ROWS[key])
      // The normalization above is non-vacuous: exactly one ⋯ trigger id was replaced.
      expect(actual.rowRadixIds).toBe(1)
      expect(actual.row).toBe(withDeclaredDelta(WIDE_HTML_BASELINE[key].row))
      // ⚠ verbatim — the header takes no delta.
      expect(actual.header).toBe(WIDE_HTML_BASELINE[key].header)
    })
  }

  // ── THE MARKER ROWS ──────────────────────────────────────────────────────────────────
  // Byte-identity alone is compatible with a row that quietly rendered nothing: an empty
  // capture equals an empty render forever, and the non-vacuity lines above only prove the
  // string is non-empty, not that it holds the cells. These say WHAT each capture contains,
  // so a row that stopped painting a cell is a failure rather than a pass. They read the
  // COMMITTED baseline strings, never a fresh render — the claim being pinned is about what
  // was captured. (`PhaseNodeCard.test.tsx:2792-2825`.)

  it("every capture holds all five cells and the ⋯ — D-206.1-13 stated at the baseline", () => {
    for (const key of Object.keys(WIDE_HTML_BASELINE)) {
      const html = WIDE_HTML_BASELINE[key].row
      for (const testId of [
        "connections-row-name",
        "connections-row-destination",
        "connections-row-usedby",
        "connections-row-credential",
        "connections-row-state",
        "connections-row-more",
      ]) {
        expect(html).toContain(`data-testid="${testId}"`)
      }
    }
  })

  it("SEND_EMAIL captured the destination and NOT the Slack-only `fixed` tag", () => {
    const html = WIDE_HTML_BASELINE.SEND_EMAIL.row
    expect(html).toContain("connections-row-destination")
    expect(html).not.toContain(CONNECTION_FIXED_TAG)
  })

  it("POST_MESSAGE captured the `fixed` tag — the one shape that carries it", () => {
    expect(WIDE_HTML_BASELINE.POST_MESSAGE.row).toContain(CONNECTION_FIXED_TAG)
  })

  it("CREATE_TICKET captured the author's own word in the name cell", () => {
    const html = WIDE_HTML_BASELINE.CREATE_TICKET.row
    expect(html).toContain("connections-row-name")
    expect(html).toContain("Northwind Jira")
  })

  it("every captured header holds the five locked column words, in order", () => {
    for (const key of Object.keys(WIDE_HTML_BASELINE)) {
      const header = WIDE_HTML_BASELINE[key].header
      let cursor = -1
      for (const column of CONNECTIONS_COLUMNS) {
        const at = header.indexOf(`data-column="${column}"`)
        expect(at).toBeGreaterThan(cursor)
        cursor = at
      }
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 15 · Phase 206.1-02 Task 2 — THE DENSE ROW SHAPE (SC#2a, the SHAPE half)
//
// ⚠ THIS BLOCK IS NOT SC#2's PROOF AND MUST NEVER BE RECORDED AS IT (D-206.1-14). Measured
// in this repo: jsdom returns `scrollWidth 0 / clientWidth 0 / offsetWidth 0` and
// `getBoundingClientRect().width 0` for every element, so
// `expect(el.scrollWidth <= el.clientWidth).toBe(true)` PASSES VACUOUSLY on markup that
// overflows by ~400px in a real browser. No alternative box metric rescues it. What this
// block can prove is the SHAPE — that both variants exist, that no cell was deleted, that
// the destination is no longer `nowrap`, and that the wide render did not move. The
// GEOMETRY half is a real browser, at 1280 and 1536, with a `bodyClientW > 0` control, and
// it lives in this plan's Task 3.
//
// ⚠ MEASURED BEFORE THIS BLOCK WAS WRITTEN: `renderTab` never passes `panel`, so NOT ONE of
// the shipped cases exercised the dense shape — it had no coverage at all, which is why the
// helper below drives the REAL condition (`panel && !isMobile`) rather than poking a prop.
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("SC#2a — the dense row shape, and the five columns that survive it", () => {
  /** A fixed clock so `credentialLabel` reads the same in both shapes within one case. */
  const DENSE_NOW = Date.parse("2026-08-25T12:00:00.000Z")

  /** All four states, so the WCAG 1.4.1 glyph-and-word readings can be compared shape to
   *  shape rather than sampled. `disabled` outranks the verdict, hence the fourth row. */
  const FOUR_STATES: ConnectorConnection[] = [
    makeConnection({
      id: "st-ready",
      name: "Ops mailbox",
      last_checked_at: "2026-08-22T12:00:00.000Z",
      last_check_verdict: "ok",
    }),
    makeConnection({
      id: "st-not-checked",
      name: "Northwind Jira",
      capability: "create_ticket",
      config: {
        base_url: "northwind.atlassian.net",
        project_key: "NW",
        account_email: "ops@northwind.co",
      },
      last_checked_at: null,
      last_check_verdict: "not_checked",
    }),
    makeConnection({
      id: "st-failed",
      name: "#ops-alerts",
      capability: "post_message",
      config: { default_channel: "#ops-alerts" },
      last_checked_at: "2026-08-22T12:00:00.000Z",
      last_check_verdict: "failed",
    }),
    makeConnection({
      id: "st-disabled",
      name: "Retired mailbox",
      is_enabled: false,
      last_checked_at: "2026-08-22T12:00:00.000Z",
      last_check_verdict: "ok",
    }),
  ]

  /** ⚠ DENSE IS DRIVEN THROUGH THE REAL CONDITION, never through a prop poke. `dense` is
   *  the SAME expression that opens the 400px track (`panel && !isMobile`), so a helper
   *  that set the flag directly could pass while the one condition had quietly forked into
   *  two. jsdom's `window.innerWidth` is 1024 here, i.e. above the 768 mobile breakpoint,
   *  which is what makes `panel` alone sufficient. */
  function renderDense(
    props: Partial<React.ComponentProps<typeof ConnectionsTabView>> = {},
  ) {
    return renderTab({
      now: DENSE_NOW,
      panel: <div data-testid="fake-panel" />,
      ...props,
    })
  }

  function renderWide(
    props: Partial<React.ComponentProps<typeof ConnectionsTabView>> = {},
  ) {
    return renderTab({ now: DENSE_NOW, ...props })
  }

  /** The six things D-206.1-13 says survive the reflow. Named once so both renders are
   *  swept by the SAME list — a hand-written second list is how one of them goes missing. */
  const ROW_TESTIDS = [
    "connections-row-name",
    "connections-row-destination",
    "connections-row-usedby",
    "connections-row-credential",
    "connections-row-state",
    "connections-row-more",
  ] as const

  it("`data-dense` carries BOTH values — an absent attribute is a different fact from false", () => {
    // ⚠ The "0 is a fact, absence is a different one" trap: an attribute that is simply
    // missing in the wide shape would read as falsy to every consumer and would make this
    // assertion unfalsifiable. Both renders must SPELL it.
    renderDense()
    const dense = screen.getAllByTestId("connections-row")
    expect(dense.length).toBeGreaterThan(0)
    dense.forEach((row) => expect(row.getAttribute("data-dense")).toBe("true"))

    cleanup()
    renderWide()
    const wide = screen.getAllByTestId("connections-row")
    expect(wide.length).toBeGreaterThan(0)
    wide.forEach((row) => expect(row.getAttribute("data-dense")).toBe("false"))
  })

  it("⚠ D-206.1-13 — all five columns AND the ⋯ resolve in BOTH shapes", () => {
    // Deleting a column is the ROADMAP's NAMED failure mode: "the destination is the one
    // column a person reads to approve a send, and hiding it is worse than truncating it."
    // So this is asserted by QUERYING every testid in both renders, never by inspection.
    // ⚠ `PhaseCard.tsx` — the stacked-identity analog whose markup the dense row copies —
    // FOLDS A FACT AWAY at higher density. The markup is copied; that decision is not.
    renderDense({ usageCounts: { "st-ready": 2 } })
    for (const testId of ROW_TESTIDS) {
      expect(screen.getAllByTestId(testId).length).toBe(THREE_ROWS.length)
    }

    cleanup()
    renderWide({ usageCounts: { "st-ready": 2 } })
    for (const testId of ROW_TESTIDS) {
      expect(screen.getAllByTestId(testId).length).toBe(THREE_ROWS.length)
    }
  })

  it("⚠ the dense destination carries NO `truncate` — on the cell OR on the value span", () => {
    // ⚠ THIS IS WHERE SC#2 IS WON OR LOST. `truncate` is `white-space: nowrap`, under which
    // `scrollWidth` is the FULL un-wrapped text width — so `scrollWidth <= clientWidth` is
    // UNSATISFIABLE BY WIDENING ALONE, and a dense layout that merely hands the cell more
    // room fails SC#2 silently. `truncate` ships TWICE today (cell AND inner span), so
    // removing one leaves the other and the geometry does not move at all.
    renderDense()
    const cells = screen.getAllByTestId("connections-row-destination")
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of cells) {
      expect(cell.className.split(/\s+/)).not.toContain("truncate")
      const span = cell.querySelector("span:not([aria-hidden])")
      expect(span).not.toBeNull()
      const tokens = span!.className.split(/\s+/)
      expect(tokens).not.toContain("truncate")
      expect(tokens).toContain("whitespace-normal")
      // ⚠ `break-all`, NOT `break-words`: a URL has no spaces, so `break-words` will not
      // break it and the cell overflows exactly as before while looking fixed.
      expect(tokens).toContain("break-all")
      expect(tokens).not.toContain("break-words")
    }
  })

  it("the WIDE destination still truncates — the dense change is ADDITIVE, not a swap", () => {
    // The mirror of the case above. Without it, deleting `truncate` outright would pass
    // that one and silently change the shipped wide row (which Task 1's capture also
    // catches — two independent guards on the same claim, deliberately).
    renderWide()
    const cells = screen.getAllByTestId("connections-row-destination")
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of cells) {
      expect(cell.className.split(/\s+/)).toContain("truncate")
    }
  })

  it("D-206.1-20 — the five-word HEADER is the ONE thing dense drops", () => {
    // Stacked cells form no columns, so a five-word header would label a grid that is not
    // there. `CONNECTIONS_COLUMNS` keeps its character identity in the wide shape.
    renderDense()
    expect(screen.queryByTestId("connections-header")).toBeNull()

    cleanup()
    renderWide()
    const header = screen.getByTestId("connections-header")
    expect(
      Array.from(header.querySelectorAll("[data-column]")).map((el) => el.textContent),
    ).toEqual([...CONNECTIONS_COLUMNS])
  })

  it("⚠ the credential cell's textContent is CHARACTER-IDENTICAL in both shapes", () => {
    // This is what forces the new inline label to be a SIBLING node, outside the testid'd
    // one: `:640` asserts `.toBe("never checked")` by EXACT EQUALITY and `:641` anchors
    // `/^checked /` at the start. Putting the label inside would force a re-baseline — of a
    // pin, on the surface whose whole lesson is that re-baselined pins are not evidence.
    renderDense({ connections: FOUR_STATES })
    const dense = screen
      .getAllByTestId("connections-row-credential")
      .map((c) => c.textContent)

    cleanup()
    renderWide({ connections: FOUR_STATES })
    const wide = screen
      .getAllByTestId("connections-row-credential")
      .map((c) => c.textContent)

    expect(dense.length).toBe(FOUR_STATES.length)
    expect(dense).toEqual(wide)
    expect(dense[1]).toBe("never checked")
    expect(dense[0]).toMatch(/^checked /)
  })

  it("the four state readings are unchanged in dense — glyph AND word, in both shapes", () => {
    renderDense({ connections: FOUR_STATES })
    const dense = screen.getAllByTestId("connections-row-state").map((c) => c.textContent)

    cleanup()
    renderWide({ connections: FOUR_STATES })
    const wide = screen.getAllByTestId("connections-row-state").map((c) => c.textContent)

    expect(dense).toEqual(wide)
    expect(dense).toEqual([
      CONNECTION_STATE_WORDS.ready,
      CONNECTION_STATE_WORDS.not_checked,
      CONNECTION_STATE_WORDS.failed,
      CONNECTION_STATE_WORDS.disabled,
    ])
  })

  it("the two inline labels are DERIVED from the column tuple, never re-typed", () => {
    // Asserted against the imported constants rather than against literals, and then a
    // second time as an identity — so the header word and the inline label are
    // STRUCTURALLY unable to disagree rather than merely equal today.
    expect(CONNECTIONS_DENSE_LABEL_USED_BY).toBe(CONNECTIONS_COLUMNS[2])
    expect(CONNECTIONS_DENSE_LABEL_CREDENTIAL).toBe(CONNECTIONS_COLUMNS[3])

    // ⚠ SCOPED TO THE ROW, NOT THE CONTAINER — measured: a container-wide `toContain`
    // passes VACUOUSLY today, because the five-word HEADER already spells both words. The
    // claim is that the label reaches the ROW once that header is gone, so the row is where
    // it has to be read.
    renderDense()
    const rows = screen.getAllByTestId("connections-row")
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.textContent).toContain(CONNECTIONS_DENSE_LABEL_USED_BY)
      expect(row.textContent).toContain(CONNECTIONS_DENSE_LABEL_CREDENTIAL)
    }
  })

  it("the inline labels are NOT aria-hidden — they read for AT exactly as for the eye", () => {
    // "Credential checked 3d ago" is the reading, and it is the reading for everyone. A
    // decorative label would leave a screen reader with a bare relative time and no noun.
    renderDense()
    const rows = screen.getAllByTestId("connections-row")
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const hidden = Array.from(row.querySelectorAll('[aria-hidden="true"]')).map(
        (el) => el.textContent ?? "",
      )
      for (const label of [CONNECTIONS_DENSE_LABEL_USED_BY, CONNECTIONS_DENSE_LABEL_CREDENTIAL]) {
        for (const text of hidden) expect(text).not.toContain(label)
      }
    }
  })

  it("ZERO `[title]` nodes in the DENSE render, with a menu AND a sheet open", async () => {
    // ⚠ The shipped fence (`:505-515`) extended to the new shape. A tooltip is FORBIDDEN
    // here, and that prohibition is exactly WHY wrapping had to be the answer: the cheap
    // fix was never available.
    const user = userEvent.setup({ delay: null })
    const { container } = renderDense({
      usageCounts: { "conn-1": 2 },
      onAdd: vi.fn(),
      onOpen: vi.fn(),
    })
    expect(container.querySelectorAll("[title]")).toHaveLength(0)

    await openRowMenu(user, "Ops mailbox")
    await user.click(await screen.findByTestId("connections-action-delete"))
    await screen.findByRole("dialog")
    expect(document.querySelectorAll("[title]")).toHaveLength(0)
  })

  it("the ⋯ / receipt either-or survives in dense — one action cell, two occupants", async () => {
    const user = userEvent.setup({ delay: null })
    renderDense({ usageCounts: {} })
    expect(screen.getAllByTestId("connections-row-more").length).toBe(THREE_ROWS.length)

    await openRowMenu(user, "Ops mailbox")
    await user.click(await screen.findByTestId("connections-action-disable"))
    const receipt = await screen.findByTestId("connections-receipt")
    expect(receipt).toHaveTextContent(RECEIPT_DISABLED)
    // The row that received the write no longer shows its ⋯ — the shipped either-or.
    expect(screen.getAllByTestId("connections-row-more").length).toBe(THREE_ROWS.length - 1)
  })

  it("`canWrite` still REMOVES the ⋯ in dense — never renders it inert", () => {
    // The shipped removed-not-disabled rule, asserted on the second render path. A
    // `toBeDisabled()` assertion was measured unable to see plant C at 190-16, which is why
    // this is an absence claim.
    renderDense({ isOrgAdmin: false })
    expect(screen.queryAllByTestId("connections-row-more")).toHaveLength(0)

    cleanup()
    renderDense({ liveConnectorsOn: false })
    expect(screen.queryAllByTestId("connections-row-more")).toHaveLength(0)
  })

  it("the source names none of the three things the dense shape refuses (187-24-safe)", () => {
    // ⚠ THREE SOURCE FENCES, and each is written so the SOURCE FILE never spells the token
    // it forbids — which is the 187-24 trap, and it fired THREE times inside plan 01 of
    // this phase and TWICE more inside this one. A fence that greps a file for a needle the
    // file's own prose must name is a fence that can only go red.
    //
    // 1 · The CSS container-query route (D-206.1-12): refused because the Tailwind plugin
    //     is not installed AND because jsdom evaluates no layout, so a width-driven shape
    //     would be untestable by this very suite.
    expect(connectionsTabSource).not.toContain("@container")
    expect(connectionsTabSource).not.toContain("container-type")
    expect(connectionsTabSource).not.toContain("tailwindcss/container-queries")

    // 2 · The word-boundary break variant. A URL contains no spaces, so it would never
    //     break and the cell would overflow exactly as before while looking fixed.
    expect(connectionsTabSource).not.toContain(`break-${"words"}`)

    // 3 · A `title` tooltip. The rendered-DOM fence above already asserts zero `[title]`
    //     nodes; this catches an attribute added on a branch no fixture reaches.
    expect(connectionsTabSource).not.toContain("title=")

    // NON-VACUITY CONTROL — without it, a `?raw` import that silently resolved to the empty
    // string would satisfy all six claims above forever. (Measured precedent:
    // `gutterTokens.fences.test.ts` found exactly that failure mode for CSS under vitest.)
    expect(connectionsTabSource.length).toBeGreaterThan(1000)
    expect(connectionsTabSource).toContain("data-dense")
    expect(connectionsTabSource).toContain(`break-${"all"}`)
  })

  it("no `<table>` primitive in EITHER shape (§15)", () => {
    const denseRender = renderDense()
    expect(denseRender.container.querySelector("table")).toBeNull()

    cleanup()
    const wideRender = renderWide()
    expect(wideRender.container.querySelector("table")).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⭐ 206.1 · AN MCP ROW ON THE TABLE — REMOVED, NOT DISABLED (D-206.1-19 / AR-05)
//
// ⚠ EVERY CLAIM HERE IS ASSERTED IN **BOTH** ROW SHAPES. Plan 02 split this component into
// two interiors, and `renderTab` still defaults to WIDE — so a change made in one branch and
// not the other passes any suite that renders only one of them. Both helpers below drive the
// same props through the SAME one condition that opens the 400px track.
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("206.1 · an MCP row's affordances and credential reading, in BOTH shapes", () => {
  const MCP_NOW = Date.parse("2026-08-25T12:00:00.000Z")
  const MCP_URL = "https://mcp.deepwiki.com/mcp"

  const MCP_ROW: ConnectorConnection = makeConnection({
    id: "conn-mcp",
    name: "DeepWiki",
    capability: null,
    config: { headers: {} },
    mcp_server_url: MCP_URL,
    last_checked_at: null,
    last_check_verdict: "not_checked",
  })

  /** A capability row beside it, so every negative below has a POSITIVE CONTROL rendered in
   *  the same tree rather than in a different test. */
  const CAPABILITY_ROW: ConnectorConnection = makeConnection({
    id: "conn-smtp",
    name: "Ops mailbox",
    last_checked_at: null,
    last_check_verdict: "not_checked",
  })

  const BOTH_ROWS = [MCP_ROW, CAPABILITY_ROW]

  function renderMcpWide(props: Partial<React.ComponentProps<typeof ConnectionsTabView>> = {}) {
    return renderTab({ connections: BOTH_ROWS, now: MCP_NOW, onCheck: vi.fn(), ...props })
  }

  /** ⚠ DENSE THROUGH THE REAL CONDITION — `panel && !isMobile`, never a prop poke. */
  function renderMcpDense(props: Partial<React.ComponentProps<typeof ConnectionsTabView>> = {}) {
    return renderMcpWide({ panel: <div data-testid="fake-panel" />, ...props })
  }

  const SHAPES = [
    ["wide", renderMcpWide],
    ["dense", renderMcpDense],
  ] as const

  function rowById(id: string): HTMLElement {
    const row = screen
      .getAllByTestId("connections-row")
      .find((r) => within(r).queryByText(id === "conn-mcp" ? "DeepWiki" : "Ops mailbox"))
    if (!row) throw new Error(`row ${id} not found`)
    return row
  }

  it.each(SHAPES)(
    "[%s] an MCP row's ⋯ offers NO `Check credential`, and a capability row's still does",
    async (_shape, renderIt) => {
      const user = userEvent.setup({ delay: null })
      renderIt()

      // ⚠ REMOVED, NOT DISABLED. The check path is capability-shaped (an SMTP login, a Jira
      // auth, a Slack `auth.test`) and has no MCP arm, so a rendered control the API refuses
      // is exactly the defect this surface's rule exists to prevent — and 190-16's plant C
      // measured that a `toBeDisabled()` assertion cannot see it.
      await user.click(within(rowById("conn-mcp")).getByTestId("connections-row-more"))
      expect(screen.queryByTestId("connections-action-check")).not.toBeInTheDocument()
      // The other three items are untouched: the removal is scoped to the one that cannot work.
      expect(screen.getByTestId("connections-action-disable")).toBeInTheDocument()
      expect(screen.getByTestId("connections-action-delete")).toBeInTheDocument()
      await user.keyboard("{Escape}")

      // POSITIVE CONTROL, in the same tree.
      await user.click(within(rowById("conn-smtp")).getByTestId("connections-row-more"))
      expect(screen.getByTestId("connections-action-check")).toBeInTheDocument()
    },
  )

  it.each(SHAPES)(
    "[%s] an MCP row's credential cell reads `no check for this kind`; a capability row's reads `never checked`",
    (_shape, renderIt) => {
      renderIt()
      expect(
        within(rowById("conn-mcp")).getByTestId("connections-row-credential").textContent,
      ).toBe(CREDENTIAL_NO_CHECK_FOR_KIND)
      // ⚠ EXACT EQUALITY, unchanged from the shipped pin — the dense inline label is a SIBLING
      // of this node, which is what lets that pin hold in both shapes rather than be
      // re-baselined.
      expect(
        within(rowById("conn-smtp")).getByTestId("connections-row-credential").textContent,
      ).toBe("never checked")
    },
  )

  it.each(SHAPES)(
    "[%s] an MCP row's destination is its OWN host — never Slack's, which is the defect this repair fixed",
    (_shape, renderIt) => {
      renderIt()
      const destination = within(rowById("conn-mcp")).getByTestId("connections-row-destination")
      expect(destination.textContent).toContain("mcp.deepwiki.com")
      // Seen on screen in live UAT on 2026-08-25, before `147f3c57`: an MCP row describing
      // itself as sending to Slack's API host.
      expect(destination.textContent).not.toContain(SLACK_FIXED_HOST)
      expect(destination.textContent).not.toContain(CONNECTION_FIXED_TAG)
    },
  )

  it.each(SHAPES)(
    "[%s] an MCP row still reads `◌ Not checked` — AR-03: no fifth state word was invented",
    (_shape, renderIt) => {
      renderIt()
      // Literally true: no check has happened. The WHY is carried by the Credential cell,
      // at zero cost to the character-identity assertion over `CONNECTION_STATE_WORDS`.
      expect(within(rowById("conn-mcp")).getByTestId("connections-row-state").textContent).toBe(
        CONNECTION_STATE_WORDS.not_checked,
      )
    },
  )

  it("⚠ with no `onCheck` at all, NEITHER row offers the item — the shipped guard is not replaced", async () => {
    const user = userEvent.setup({ delay: null })
    renderTab({ connections: BOTH_ROWS, now: MCP_NOW, onCheck: undefined })
    await user.click(within(rowById("conn-smtp")).getByTestId("connections-row-more"))
    expect(screen.queryByTestId("connections-action-check")).not.toBeInTheDocument()
  })

  it("⚠ `destinationFactsOf` REGRESSION CONTROL — a synthetic fifth shape yields [] and never Slack's host", () => {
    // SC#4's named subject. The arms are already explicit and the tail already neutral (the
    // `147f3c57` repair); this is the guard that keeps them so.
    for (const capability of ["not_a_capability", "send_emails", "constructor", "__proto__", ""]) {
      const facts = destinationFactsOf(
        makeConnection({
          capability: capability as unknown as ConnectorConnection["capability"],
          config: { default_channel: "#ops" } as unknown as ConnectorConnection["config"],
          mcp_server_url: null,
        }),
      )
      expect(facts).toEqual([])
      expect(facts.join(" ")).not.toContain(SLACK_FIXED_HOST)
    }
    // POSITIVE CONTROL — the three real shapes and the MCP shape still resolve their own.
    expect(
      destinationFactsOf(makeConnection({ capability: "post_message", config: { default_channel: "#ops" } })),
    ).toContain(SLACK_FIXED_HOST)
    expect(
      destinationFactsOf(
        makeConnection({ capability: null, config: { headers: {} }, mcp_server_url: MCP_URL }),
      ),
    ).toEqual(["mcp.deepwiki.com"])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// Phase 209 (Item 3) · State-based filter chips and search matching
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("Phase 209 (Item 3) — state-based filter chips and query matcher", () => {
  const TEST_ROWS: ConnectorConnection[] = [
    makeConnection({
      id: "conn-ready-slack",
      name: "Slack Alerts",
      capability: "post_message",
      is_enabled: true,
      last_check_verdict: "ok",
    }),
    makeConnection({
      id: "conn-ready-mcp",
      name: "DeepWiki Search",
      capability: null,
      mcp_server_url: "https://mcp.deepwiki.com/mcp",
      is_enabled: true,
      last_check_verdict: "ok",
    }),
    makeConnection({
      id: "conn-failed-jira",
      name: "Jira Tracker",
      capability: "create_ticket",
      is_enabled: true,
      last_check_verdict: "failed",
    }),
    makeConnection({
      id: "conn-disabled-smtp",
      name: "Old Mailer",
      capability: "send_email",
      is_enabled: false,
      last_check_verdict: "ok",
    }),
  ]

  it("renders state-based filter chips: All, Connected, Not connected", () => {
    renderTab({ connections: TEST_ROWS })
    const chips = screen.getAllByTestId("connections-filter-chip")
    expect(chips).toHaveLength(3)
    expect(chips[0]).toHaveTextContent("All")
    expect(chips[1]).toHaveTextContent("Connected")
    expect(chips[2]).toHaveTextContent("Not connected")
  })

  it("filtering by Connected shows configured connections", async () => {
    const user = userEvent.setup({ delay: null })
    renderTab({ connections: TEST_ROWS })
    const chips = screen.getAllByTestId("connections-filter-chip")
    await user.click(chips[1]) // Connected

    expect(screen.getByText("Slack Alerts")).toBeInTheDocument()
    expect(screen.getByText("DeepWiki Search")).toBeInTheDocument()
    expect(screen.getByText("Jira Tracker")).toBeInTheDocument()
    expect(screen.getByText("Old Mailer")).toBeInTheDocument()
  })

  it("filtering by Not connected hides configured connections when rendered without catalog services", async () => {
    const user = userEvent.setup({ delay: null })
    renderTab({ connections: TEST_ROWS })
    const chips = screen.getAllByTestId("connections-filter-chip")
    await user.click(chips[2]) // Not connected

    expect(screen.queryByText("Slack Alerts")).not.toBeInTheDocument()
    expect(screen.queryByText("DeepWiki Search")).not.toBeInTheDocument()
    expect(screen.queryByText("Jira Tracker")).not.toBeInTheDocument()
    expect(screen.queryByText("Old Mailer")).not.toBeInTheDocument()
  })

  it("search input matches name, capability, and mcp_server_url without hiding MCP rows", async () => {
    const user = userEvent.setup({ delay: null })
    renderTab({ connections: TEST_ROWS })
    const input = screen.getByTestId("connections-filter-input")

    await user.type(input, "deepwiki")
    expect(screen.getByText("DeepWiki Search")).toBeInTheDocument()
    expect(screen.queryByText("Slack Alerts")).not.toBeInTheDocument()

    await user.clear(input)
    await user.type(input, "create_ticket")
    expect(screen.getByText("Jira Tracker")).toBeInTheDocument()
    expect(screen.queryByText("DeepWiki Search")).not.toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// Phase 212 (Gap Closure) — browsable catalog, group headers, and one-click Connect
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("Phase 212 (Gap Closure) — browsable catalog, group headers, and one-click Connect", () => {
  it("renders browsable catalog of services with Popular and All services group headers when connections = []", () => {
    render(
      <ConnectionsTabView
        connections={[]}
        catalogServices={CATALOG_SERVICES}
        usageCounts={{}}
        isOrgAdmin
        liveConnectorsOn
        {...handlers}
      />,
    )

    // Table header rendered, not empty state block
    expect(screen.getByTestId("connections-header")).toBeInTheDocument()
    expect(screen.queryByTestId("connections-empty")).toBeNull()

    // Group headers per Sketch 203 Section 4
    expect(screen.getByTestId("connections-group-popular")).toHaveTextContent("Popular")
    expect(screen.getByTestId("connections-group-all")).toHaveTextContent("All services")

    // Curated popular services present (in cards and table)
    expect(screen.getAllByText("Slack").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("GitHub").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Notion").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Jira").length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Email (SMTP)").length).toBeGreaterThanOrEqual(1)

    // Curated other services present
    expect(screen.getByText("Figma")).toBeInTheDocument()
    expect(screen.getByText("Linear")).toBeInTheDocument()
    expect(screen.getByText("Sentry")).toBeInTheDocument()
  })

  it("unconfigured catalog rows render Mark, Name, Tagline, default host with , —, Not set, Not connected, and Connect button", () => {
    const onAdd = vi.fn()
    render(
      <ConnectionsTabView
        connections={[]}
        catalogServices={CATALOG_SERVICES}
        usageCounts={{}}
        isOrgAdmin
        liveConnectorsOn
        onAdd={onAdd}
        {...handlers}
      />,
    )

    // GitHub row
    const githubButtons = screen.getAllByRole("button", { name: "GitHub" })
    expect(githubButtons.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Track code changes and manage pull requests.")).toBeInTheDocument()
    expect(screen.getByText("api.github.com")).toBeInTheDocument()

    // Connect button
    const connectButtons = screen.getAllByTestId("connections-catalog-connect")
    expect(connectButtons.length).toBeGreaterThan(0)
    expect(connectButtons[0]).toHaveTextContent("Connect")

    // State word & indicator
    const stateChips = screen.getAllByTestId("connections-row-state")
    expect(stateChips[0]).toHaveTextContent("Not connected")
  })

  it("clicking Connect button or service name on an unconfigured catalog service invokes onAdd with the preset serviceId", async () => {
    const user = userEvent.setup({ delay: null })
    const onAdd = vi.fn()
    render(
      <ConnectionsTabView
        connections={[]}
        catalogServices={CATALOG_SERVICES}
        usageCounts={{}}
        isOrgAdmin
        liveConnectorsOn
        onAdd={onAdd}
        {...handlers}
      />,
    )

    // Find GitHub row's Connect button in the table
    const githubRow = screen.getAllByRole("button", { name: "GitHub" })[0].closest('[data-testid="connections-row"]') as HTMLElement
    const githubConnect = within(githubRow).getByTestId("connections-catalog-connect")
    await user.click(githubConnect)
    expect(onAdd).toHaveBeenCalledWith("github")

    // Click Notion name in the table
    const notionButtons = screen.getAllByRole("button", { name: "Notion" })
    await user.click(notionButtons[0])
    expect(onAdd).toHaveBeenCalledWith("notion")
  })

  it("filtering by Not connected displays all unconfigured catalog services and hides all configured connections (SC#2)", async () => {
    const user = userEvent.setup({ delay: null })
    render(
      <ConnectionsTabView
        connections={THREE_ROWS}
        catalogServices={CATALOG_SERVICES}
        usageCounts={{}}
        isOrgAdmin
        liveConnectorsOn
        {...handlers}
      />,
    )

    const chips = screen.getAllByTestId("connections-filter-chip")
    await user.click(chips[2]) // Not connected

    // Unconfigured services appear
    expect(screen.getByText("GitHub")).toBeInTheDocument()
    expect(screen.getByText("Notion")).toBeInTheDocument()
    expect(screen.getByText("Google Workspace")).toBeInTheDocument()

    // Configured connections from THREE_ROWS are all hidden under Not connected
    expect(screen.queryByText("Ops mailbox")).not.toBeInTheDocument()
    expect(screen.queryByText("#ops-alerts")).not.toBeInTheDocument()
    expect(screen.queryByText("ENG Jira")).not.toBeInTheDocument()
  })

  it("filtering by Connected shows configured connections (including MCP/unchecked) and hides unconfigured catalog services", async () => {
    const user = userEvent.setup({ delay: null })
    const mcpRow = makeConnection({
      id: "conn-deepwiki",
      service_id: "mcp.deepwiki.com",
      name: "DeepWiki",
      capability: null,
      mcp_server_url: "https://mcp.deepwiki.com/sse",
      last_check_verdict: null,
    })

    render(
      <ConnectionsTabView
        connections={[...THREE_ROWS, mcpRow]}
        catalogServices={CATALOG_SERVICES}
        usageCounts={{}}
        isOrgAdmin
        liveConnectorsOn
        {...handlers}
      />,
    )

    const chips = screen.getAllByTestId("connections-filter-chip")
    await user.click(chips[1]) // Connected

    // Configured connections (including DeepWiki MCP) are visible
    expect(screen.getByText("Ops mailbox")).toBeInTheDocument()
    expect(screen.getByText("#ops-alerts")).toBeInTheDocument()
    expect(screen.getByText("DeepWiki")).toBeInTheDocument()

    // Unconfigured catalog services are hidden
    expect(screen.queryByText("GitHub")).not.toBeInTheDocument()
    expect(screen.queryByText("Notion")).not.toBeInTheDocument()
  })

  it("searching for a catalog service filters to the matching service row", async () => {
    const user = userEvent.setup({ delay: null })
    render(
      <ConnectionsTabView
        connections={[]}
        catalogServices={CATALOG_SERVICES}
        usageCounts={{}}
        isOrgAdmin
        liveConnectorsOn
        {...handlers}
      />,
    )

    const input = screen.getByTestId("connections-filter-input")
    await user.type(input, "Figma")

    expect(screen.getByText("Figma")).toBeInTheDocument()
    expect(screen.queryByText("Linear")).not.toBeInTheDocument()
    expect(screen.queryByText("Slack")).not.toBeInTheDocument()
  })

  it("when a service is already connected in the database, it renders as a configured row without duplicating", () => {
    const customSlackRow = makeConnection({
      id: "conn-slack-custom",
      service_id: "slack",
      name: "Team Slack Channel",
      capability: "post_message",
      config: { default_channel: "#general" },
      last_check_verdict: "ok",
    })

    render(
      <ConnectionsTabView
        connections={[customSlackRow]}
        catalogServices={CATALOG_SERVICES}
        usageCounts={{}}
        isOrgAdmin
        liveConnectorsOn
        {...handlers}
      />,
    )

    // Configured row appears
    expect(screen.getByText("Team Slack Channel")).toBeInTheDocument()

    // Unconfigured Slack row does NOT duplicate
    expect(screen.queryByText("Post updates and read channels in your workspace.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Slack" })).toBeNull()
  })

  it("renders Popular cards row above the filter bar per Screenshot 2026-08-24 202011.png and lets user connect from card", async () => {
    const user = userEvent.setup({ delay: null })
    const onAdd = vi.fn()
    render(
      <ConnectionsTabView
        connections={[]}
        catalogServices={CATALOG_SERVICES}
        usageCounts={{}}
        isOrgAdmin
        liveConnectorsOn
        onAdd={onAdd}
        {...handlers}
      />,
    )

    // Popular card section exists
    const popularSection = screen.getByTestId("connections-popular-section")
    expect(popularSection).toBeInTheDocument()
    expect(within(popularSection).getByText("Popular")).toBeInTheDocument()

    // Cards exist inside
    const cards = within(popularSection).getAllByTestId("connections-popular-card")
    expect(cards.length).toBe(3)

    // Clicking connect on a popular card triggers onAdd with service ID
    const firstCard = cards[0]
    const cardConnect = within(firstCard).getByTestId("connections-popular-connect")
    await user.click(cardConnect)
    expect(onAdd).toHaveBeenCalled()
  })

  it("renders ZERO elements carrying a title attribute across full catalog render", () => {
    const { container } = render(
      <ConnectionsTabView
        connections={[]}
        catalogServices={CATALOG_SERVICES}
        usageCounts={{}}
        isOrgAdmin
        liveConnectorsOn
        {...handlers}
      />,
    )

    const withTitle = container.querySelectorAll("[title]")
    expect(withTitle.length).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// An MCP row's evidence is its DISCOVERY — operator-driven, 2026-08-28
//
// Reported: a GitHub connection that had just discovered its tools still read
// "◌ Not checked". That was not a stale badge, it was a PERMANENT one:
// `POST /connections/{id}/check` refuses an MCP row with a 409 by design
// (`check_not_available_for_mcp`), so `last_check_verdict` can NEVER become "ok" on this
// shape. Every MCP connection ever made was pinned to "Not checked" for life.
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("connectionStateOf — an MCP row reads its discovery", () => {
  const mcpRow = (over: Partial<ConnectorConnection> = {}): ConnectorConnection =>
    ({
      id: "c1",
      is_enabled: true,
      last_check_verdict: "not_checked",
      mcp_server_url: "https://mcp.example.com/mcp",
      discovered_tools: [{ name: "search_code" }],
      ...over,
    }) as ConnectorConnection

  it("a discovered MCP connection is READY — the server answered, and that is the evidence", () => {
    expect(connectionStateOf(mcpRow())).toBe("ready")
  })

  it("⚠ an EMPTY discovery is NOT evidence — absence read as success is the old defect", () => {
    expect(connectionStateOf(mcpRow({ discovered_tools: [] }))).toBe("not_checked")
    expect(connectionStateOf(mcpRow({ discovered_tools: undefined }))).toBe("not_checked")
  })

  it("NEGATIVE CONTROL — discovery does NOT outrank a real failure or a disable", () => {
    // Without this, the new arm could paint a disabled or failing row green, which is the
    // over-claim `is_enabled` is deliberately ordered first to prevent.
    expect(connectionStateOf(mcpRow({ is_enabled: false }))).toBe("disabled")
    expect(connectionStateOf(mcpRow({ last_check_verdict: "failed" }))).toBe("failed")
  })

  it("NEGATIVE CONTROL — a CAPABILITY row is untouched by the new arm", () => {
    // It has no `mcp_server_url`, so its ladder is byte-identical to what shipped: an
    // unchecked Slack row is still "not_checked" no matter what it has discovered.
    const slack = {
      id: "c2",
      is_enabled: true,
      last_check_verdict: "not_checked",
      capability: "post_message",
      discovered_tools: [{ name: "post_message" }],
    } as unknown as ConnectorConnection
    expect(connectionStateOf(slack)).toBe("not_checked")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// The Popular strip reads the connections it used to ignore — operator-driven, 2026-08-28
//
// Reported: *"the applications in the popular section … still showing connect and when I
// press connect it is opening a new form empty even though those applications are already
// connected"*. The strip mapped `catalogServices` and consulted `connections` NOWHERE, so
// it could only say "Connect", and `onAdd` opens a CREATE panel — hence the empty form.
// The directory below it had been reading this correctly all along, so one screen
// disagreed with itself about whether GitHub was connected.
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the Popular strip knows what is already connected", () => {
  const githubRow = (over: Partial<ConnectorConnection> = {}): ConnectorConnection =>
    makeConnection({
      id: "conn-gh",
      name: "GitHub",
      capability: null,
      service_id: "github",
      mcp_server_url: "https://mcp.github.com/mcp",
      ...over,
    })

  function popularCardFor(name: string) {
    return screen
      .getAllByTestId("connections-popular-card")
      .find((card) => within(card).queryByText(name))
  }

  it("a CONNECTED popular service offers Manage, not Connect", () => {
    renderTab({
      connections: [githubRow()],
      catalogServices: CATALOG_SERVICES,
      onOpen: vi.fn(),
      onAdd: vi.fn(),
    })
    const card = popularCardFor("GitHub")
    expect(card).toBeDefined()
    expect(within(card!).queryByTestId("connections-popular-connect")).toBeNull()
    expect(within(card!).getByTestId("connections-popular-manage")).toBeInTheDocument()
  })

  it("Manage opens the EXISTING row — it does not open an empty create form", () => {
    // The half the operator actually felt. `onAdd` is asserted NOT called, because calling it
    // is precisely what produced the blank panel.
    const onOpen = vi.fn()
    const onAdd = vi.fn()
    const row = githubRow()
    renderTab({ connections: [row], onOpen, onAdd, catalogServices: CATALOG_SERVICES })

    within(popularCardFor("GitHub")!).getByTestId("connections-popular-manage").click()

    expect(onOpen).toHaveBeenCalledWith(row)
    expect(onAdd).not.toHaveBeenCalled()
  })

  it("it says HOW MANY, because a service may hold several (D-212-03)", () => {
    renderTab({
      connections: [githubRow(), githubRow({ id: "conn-gh-2", name: "GitHub CI" })],
      catalogServices: CATALOG_SERVICES,
    })
    expect(
      within(popularCardFor("GitHub")!).getByTestId("connections-popular-configured"),
    ).toHaveTextContent("2 connections")
  })

  it("NEGATIVE CONTROL — an UNCONFIGURED popular service still offers Connect", () => {
    // Without this, hiding Connect unconditionally would pass every assertion above and
    // leave nobody able to connect anything.
    renderTab({
      connections: [],
      catalogServices: CATALOG_SERVICES,
      onOpen: vi.fn(),
      onAdd: vi.fn(),
    })
    const card = popularCardFor("GitHub")
    expect(card).toBeDefined()
    expect(within(card!).getByTestId("connections-popular-connect")).toBeInTheDocument()
    expect(within(card!).queryByTestId("connections-popular-configured")).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 19 · Phase 239 (D-239-08 / BUG-260907-01) — THE ROW THAT WORKS AND SAYS IT DOES NOT
//
// ⚠ EVERY CASE HERE ASSERTS THE RENDERED WORD, never the presence of a block. Phase 235
// shipped a defect underneath a green fence that checked a `data-testid` existed while the
// content drifted — and on this surface the WORDS ARE THE DELIVERABLE. `⚠ Not usable` on a
// connection that browsed six real folders the same session is the entire bug.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** What `GET /connectors/source-families` publishes at Phase 239 — measured in
 *  `239-02-SUMMARY.md` §F-1, not invented here. */
const SOURCE_FAMILIES = [
  "custom_mcp",
  "google",
  "google_workspace",
  "mcp",
  "microsoft",
  "microsoft_graph",
]

/** The live row from the bug report: OAuth completed, check returned ok, ZERO action tools,
 *  and `browse()` returned six real folders in the same session. */
const ONEDRIVE_ROW: ConnectorConnection = makeConnection({
  id: "conn-onedrive",
  name: "Microsoft 365",
  service_id: "microsoft",
  capability: null,
  auth_type: "oauth_byo",
  status: "active",
  config: {},
  discovered_tools: [],
  last_check_verdict: "ok",
})

/** An MCP file server: `service_id` is whatever the person setting it up typed, so the row
 *  resolves by TRANSPORT on the server and cannot resolve by name on the client. */
const MCP_FILES_ROW: ConnectorConnection = makeConnection({
  id: "conn-mcp-files",
  name: "Acme files",
  service_id: "mcp.acme.internal",
  capability: null,
  auth_type: "mcp",
  status: "active",
  mcp_server_url: "https://mcp.acme.internal/mcp",
  config: {},
  discovered_tools: [],
  last_check_verdict: "ok",
})

const stateWordFor = (name: string) =>
  within(
    screen.getAllByTestId("connections-row").find((r) => r.textContent?.includes(name))!,
  ).getByTestId("connections-row-state").textContent

describe("§19 · a source-only connection reads `✓ Ready as source` (BUG-260907-01)", () => {
  it("⭐ THE BUG: the OneDrive row says Ready as source, and NEVER says Not usable", () => {
    renderTab({ connections: [ONEDRIVE_ROW], sourceFamilies: SOURCE_FAMILIES })
    expect(stateWordFor("Microsoft 365")).toBe("✓ Ready as source")
    expect(screen.queryByText("⚠ Not usable")).toBeNull()
  })

  it("⭐ an MCP file server with no action tools says it too — resolved by transport", () => {
    renderTab({ connections: [MCP_FILES_ROW], sourceFamilies: SOURCE_FAMILIES })
    expect(stateWordFor("Acme files")).toBe("✓ Ready as source")
  })

  it("⛔ TM-239-07 — with the families list UNKNOWN the row keeps its old, honest word", () => {
    // The default. A green manufactured out of a pending fetch is the false positive this
    // threat names, and it would appear on EVERY row for the first paint of the page.
    renderTab({ connections: [ONEDRIVE_ROW] })
    expect(stateWordFor("Microsoft 365")).toBe("⚠ Not usable")
    expect(screen.queryByText("✓ Ready as source")).toBeNull()
  })

  it("⛔ TM-239-07 — a REVOKED source-capable row says Revoked, never Ready as source", () => {
    renderTab({
      connections: [makeConnection({ ...ONEDRIVE_ROW, status: "revoked" })],
      sourceFamilies: SOURCE_FAMILIES,
    })
    expect(stateWordFor("Microsoft 365")).toBe("⚠ Revoked")
  })

  it("⛔ TM-239-07 — a DISABLED source-capable row says Disabled", () => {
    renderTab({
      connections: [makeConnection({ ...ONEDRIVE_ROW, is_enabled: false })],
      sourceFamilies: SOURCE_FAMILIES,
    })
    expect(stateWordFor("Microsoft 365")).toBe("⏻ Disabled")
  })

  it("⛔ the three capability rows in the same table are untouched by the new input", () => {
    // Rendered TOGETHER with a source row, because the containment claim is about one table
    // holding both kinds — which is exactly the screen the bug was reported from.
    renderTab({
      connections: [...THREE_ROWS, ONEDRIVE_ROW],
      sourceFamilies: SOURCE_FAMILIES,
    })
    expect(stateWordFor("Ops mailbox")).toBe("✓ Ready")
    expect(stateWordFor("Northwind Jira")).toBe("◌ Not checked")
    expect(stateWordFor("#ops-alerts")).toBe("✕ Credential failed")
    expect(stateWordFor("Microsoft 365")).toBe("✓ Ready as source")
  })

  it("the state carries a GLYPH and a WORD, and the dot is the success tone (case 2)", () => {
    // §14's greyscale rule: colour is reinforcement, the word is the carrier. `source_only`
    // is a GOOD state, so its dot must not read as the warning `bg-warning` that `unusable`
    // takes — a person scanning the column by colour would still see a problem row.
    renderTab({ connections: [ONEDRIVE_ROW], sourceFamilies: SOURCE_FAMILIES })
    const chip = screen.getByTestId("connections-row-state")
    expect(chip.textContent).toContain("✓")
    expect(chip.textContent).toContain("Ready as source")
    expect(chip.querySelector("span")?.className).toContain("bg-success")
    expect(chip.querySelector("span")?.className).not.toContain("bg-warning")
  })

  it("the CONTAINER fetches the families and fails CLOSED when the read fails", () => {
    // The cases above prove the VIEW renders the word when told. None can see whether the
    // container ever asks — the identical gap `onCheck` has its own source fence for.
    expect(connectionsTabSource).toMatch(/listSourceFamilies\(\)/)
    expect(connectionsTabSource).toMatch(/sourceFamilies=\{sourceFamilies\}/)
    // ⚠ THE FAILURE ARM IS THE SECURITY-BEARING HALF. A `.catch` that left a stale list, or
    // one that set `[]` — which reads as "the server published nothing" rather than "we were
    // not told" — is the difference between a row that stays honest and a table that guesses.
    const effect = connectionsTabSource.slice(
      connectionsTabSource.indexOf("listSourceFamilies()"),
    )
    expect(effect.slice(0, 400)).toContain("setSourceFamilies(null)")
    // NON-VACUITY CONTROL — a `?raw` import resolving to "" would satisfy all three above.
    expect(connectionsTabSource.length).toBeGreaterThan(1000)
  })
})
