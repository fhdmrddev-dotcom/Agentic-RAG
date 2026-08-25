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
// The container's SOURCE via Vite's `?raw` loader — the shipped house idiom for a fence the
// rendered DOM cannot express (`ConnectionPicker.test.tsx:31`, `CanvasToolbar.test.tsx:32`).
import connectionsTabSource from "../ConnectionsTab?raw"
import {
  CONNECTIONS_ADD_CTA,
  CONNECTIONS_BANNER_HEADING,
  CONNECTIONS_COLUMNS,
  CONNECTIONS_EMPTY_BODY,
  CONNECTIONS_EMPTY_HEADING,
  CONNECTIONS_FILTERED_TO_ZERO,
  CONNECTIONS_NON_ADMIN_NOTE,
  CONNECTION_FIXED_TAG,
  CONNECTION_STATE_WORDS,
  LIVE_CONNECTORS_FEATURE_KEY,
  RECEIPT_DELETED,
  RECEIPT_DISABLED,
  RECEIPT_ENABLED,
  connectionsCountLabel,
  moreActionsLabel,
  usageCountsFrom,
  usedByLabel,
} from "../connectionsCopy"
import type { ConnectorConnection, PublishedWorkflow } from "@/lib/api"

// ── Fixtures ─────────────────────────────────────────────────────────────────────────

function makeConnection(overrides: Partial<ConnectorConnection> = {}): ConnectorConnection {
  return {
    id: "conn-1",
    org_id: "org-1",
    capability: "send_email",
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

  it("zero reads as `none you can see`, never as a bare `0 steps`", () => {
    // The read is OWNER-scoped, so zero is a FLOOR. `0 steps` would claim nothing depends
    // on this connection, which this read cannot support.
    expect(usedByLabel(0)).toBe("none you can see")
    expect(usedByLabel(1)).toBe("1 step")
    expect(usedByLabel(4)).toBe("4 steps")

    renderTab({ usageCounts: { "conn-1": 1 } })
    const cells = screen.getAllByTestId("connections-row-usedby").map((c) => c.textContent)
    expect(cells).toEqual(["1 step", "none you can see", "none you can see"])
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

  it("the Sends to cell carries the 🔒 mark and the real host — and `fixed` only on Slack", () => {
    renderTab()
    const cells = screen.getAllByTestId("connections-row-destination")
    expect(cells[0].textContent).toContain("smtp.fastmail.com:465")
    expect(cells[1].textContent).toContain("northwind.atlassian.net")
    expect(cells[2].textContent).toContain("slack.com/api")
    cells.forEach((cell) => expect(cell.textContent).toContain("🔒"))
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

  it("the `All` chip wears NO mark; the three capability chips each wear exactly one", () => {
    // `All` is the ABSENCE OF A FILTER, not a connection whose service is unknown. Handing
    // it to the resolver would give it the named neutral — right for a row, wrong here.
    renderTab({ connections: FOUR_SHAPES })
    const chips = screen.getAllByTestId("connections-filter-chip")
    expect(chips).toHaveLength(4)
    expect(chips[0].querySelectorAll("svg")).toHaveLength(0)
    expect(chips[0].textContent).toContain("All")
    chips.slice(1).forEach((chip) => expect(chip.querySelectorAll("svg")).toHaveLength(1))
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
//
// ⚠ CAPTURED AND COMMITTED BEFORE ONE LINE OF DENSE CODE EXISTS. A baseline only proves
// something if it PREDATES the change — the `cardFace.ts` precedent, where the
// characterization pin was committed ONE COMMIT BEFORE the seam existed and then passed
// with an empty `numstat`. Item 2 of this phase adds a SECOND row shape behind a `dense`
// prop; the only thing that can prove the FIRST shape did not move while that happened is
// a record taken while it was the only shape there was.
//
// PROVENANCE OF THE IDIOM: there is NO `outerHTML` capture anywhere in the settings suites
// today (measured — the only `innerHTML` uses here are needle scans), so this is IMPORTED
// from `frontend/src/components/workflows/PhaseNodeCard.test.tsx:2640-2647` (the capture
// helper), `:2649-2673` (the capture-rule docblock whose wording is copied below) and
// `:2792-2825` (the marker rows). It is not extended from a local example, and saying so
// is what stops a later reader treating it as this file's house style.
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the WIDE row render is pinned byte-for-byte (206.1-02 Task 1)", () => {
  /** ⚠ A FIXED CLOCK, not a reading of one. `ConnectionRow` renders
   *  `credentialLabel(connection.last_checked_at, now)`, so a capture taken against
   *  `Date.now()` is a record of the afternoon it was taken and differs tomorrow.
   *  `PhaseNodeCard`'s captures are safe only because a subtree fence forbids `Date.now`
   *  and `Math.random` across that whole tree; THIS file has no such fence, so the
   *  discipline has to live in the fixture. Both constants below are literals. */
  const CAPTURE_NOW = Date.parse("2026-08-25T12:00:00.000Z")
  const CAPTURE_CHECKED_AT = "2026-08-22T12:00:00.000Z"

  /**
   * Three shapes, each distinct so the baseline says something: a long SMTP destination, a
   * Slack row (the only shape that carries the `fixed` tag), and a Jira row.
   *
   * ⚠ THE CAPTURE SET DELIBERATELY CONTAINS NO MCP-SHAPED ROW, AND THAT ABSENCE IS A
   * DECISION — this sentence exists so a later phase does not "fix" it. Plan 03 of this
   * phase introduces `credentialReadingOf`, whose MCP arm returns
   * `CREDENTIAL_NO_CHECK_FOR_KIND` **unconditionally**: it ignores `last_checked_at`
   * entirely, by design, because an MCP row can never be checked. So an MCP-shaped
   * fixture's credential cell renders DIFFERENT TEXT once wave 3 lands, and no choice of
   * `last_checked_at` avoids it — the arm does not read that field. Pinning that cell here
   * would make this baseline booby-trapped by its own phase, and the philosophy below (a
   * diff against this record is a BEHAVIOUR CHANGE, not a test to update) only holds if the
   * record itself is not. A `create_ticket` row exercises the same five cells, the same
   * mark slot and the same ⋯, so the pin loses nothing it was measuring: its job is to
   * prove the WIDE row's shipped markup did not move when the dense branch arrived, not to
   * enumerate shapes. An MCP row's wide render is pinned by plan 03's own tests instead,
   * where the change to that cell is the thing under test rather than a collision.
   */
  const CAPTURE_ROWS: Record<string, ConnectorConnection> = {
    SEND_EMAIL: makeConnection({
      id: "cap-1",
      name: "Ops mailbox",
      capability: "send_email",
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
      config: { default_channel: "#ops-alerts" },
      last_checked_at: CAPTURE_CHECKED_AT,
      last_check_verdict: "ok",
    }),
    CREATE_TICKET: makeConnection({
      id: "cap-3",
      name: "Northwind Jira",
      capability: "create_ticket",
      config: {
        base_url: "northwind.atlassian.net",
        project_key: "NW",
        account_email: "ops@northwind.co",
      },
      last_checked_at: CAPTURE_CHECKED_AT,
      last_check_verdict: "ok",
    }),
  }

  /**
   * ⚠ THE ONE DECLARED NORMALIZATION — declared, and COUNTED, rather than done quietly.
   *
   * Radix's `DropdownMenuTrigger` sets `id={useId()}` on the ⋯ button, and React's `useId`
   * value is a function of HOW MANY components have rendered before it, not of the row's
   * own markup. Measured while taking these captures: the three rows below printed
   * `id="radix-_r_p3_"`, `id="radix-_r_pc_"` and `id="radix-_r_pl_"` for markup that is
   * otherwise character-identical, and that number MOVES when any case is added anywhere
   * above this block. A case added above is not a behaviour change in the wide row and must
   * not be able to redden this pin — so the id VALUE is normalized away.
   *
   * ⚠ AND THE NORMALIZATION IS ITSELF NON-VACUOUS: the substitution count is returned and
   * asserted at exactly ONE per row. A ⋯ trigger that stopped rendering yields ZERO
   * replacements and the case goes red, rather than quietly passing against a shorter
   * string. Normalizing without counting is how a pin stops watching the thing it names.
   */
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

  /** One render, the row's and the header's `outerHTML`, unmounted — shared by the capture
   *  and the assertion so both read the DOM the same way
   *  (`PhaseNodeCard.test.tsx:2640-2647`). */
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
    // The header holds no Radix control, so its own replacement count is expected to be 0
    // and is asserted here rather than carried: an id appearing there would be new surface.
    expect(header.replaced).toBe(0)
    return { row: row.html, header: header.html, rowRadixIds: row.replaced }
  }

  /**
   * ⚠ THESE LITERALS ARE A CAPTURE, NOT AN EXPECTATION. Every character below was READ OUT
   * of the rendered DOM of the tree as it stands at this commit — `ConnectionsTab.tsx`
   * unmoved, no `dense` prop in existence — by running `wideCapture` above and pasting what
   * it printed. Not one attribute here was typed from the source, computed by hand, or
   * reasoned about. That is the whole point: an expectation records what its author
   * BELIEVED the geometry to be, and a move that changed the geometry to match that belief
   * would pass it.
   *
   * OBSERVED TWICE on the unchanged tree before it was committed, and the two runs agreed
   * byte for byte — so it is a baseline rather than one sample of something that might vary.
   * The clock is a literal (see `CAPTURE_NOW`), which is what makes that stability a
   * property of the markup rather than of the hour.
   *
   * NOT ONE STRING BELOW WAS HAND-EDITED. Hand editing turns a capture back into an
   * expectation recording what its author believed the change did, and silently masks any
   * other attribute the edit disturbed.
   *
   * A DIFF AGAINST THIS RECORD IS A BEHAVIOUR CHANGE IN THE WIDE ROW — and NOT A TEST TO
   * UPDATE. Adding the dense shape is supposed to add a second branch, not move the first
   * one. If this goes red while the dense branch lands, the dense branch is wrong;
   * re-capturing it to make it green would delete the only evidence anybody has that the
   * wide row still renders what it rendered.
   */
  const WIDE_HTML_BASELINE: Record<string, { row: string; header: string }> = {
    SEND_EMAIL: {
      row: "<div data-testid=\"connections-row\" data-state=\"ready\" class=\"flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3\"><div class=\"flex min-w-0 flex-[2] items-center gap-2\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-mail h-4 w-4 flex-none text-muted-foreground\" aria-hidden=\"true\"><path d=\"m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7\"></path><rect x=\"2\" y=\"4\" width=\"20\" height=\"16\" rx=\"2\"></rect></svg><button type=\"button\" data-testid=\"connections-row-name\" class=\"truncate text-left text-[13px] font-medium text-foreground hover:underline\">Ops mailbox</button></div><div data-testid=\"connections-row-destination\" class=\"flex min-w-0 flex-[2] items-center gap-1.5 truncate font-mono text-[11px] text-muted-foreground\"><span aria-hidden=\"true\">🔒</span><span class=\"truncate\">smtp.eu-west.fastmail-business.example.com:465</span></div><div data-testid=\"connections-row-usedby\" class=\"w-24 flex-none whitespace-nowrap text-[11px] text-muted-foreground\">2 steps</div><div data-testid=\"connections-row-credential\" class=\"w-32 flex-none whitespace-nowrap font-mono text-[11px] text-muted-foreground\">checked 3d ago</div><div class=\"w-36 flex-none\"><span data-testid=\"connections-row-state\" class=\"inline-flex items-center text-[11px] font-medium text-success\">✓ Ready</span></div><div class=\"flex w-8 flex-none items-center justify-end\"><button type=\"button\" aria-label=\"More actions for Ops mailbox\" data-testid=\"connections-row-more\" class=\"inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground\" id=\"radix-NORMALIZED\" aria-haspopup=\"menu\" aria-expanded=\"false\" data-state=\"closed\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-ellipsis h-4 w-4\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"1\"></circle><circle cx=\"19\" cy=\"12\" r=\"1\"></circle><circle cx=\"5\" cy=\"12\" r=\"1\"></circle></svg></button></div></div>",
      header: "<div data-testid=\"connections-header\" class=\"flex items-center gap-x-3 border-b border-border bg-muted/20 px-3.5 py-2\"><div data-column=\"Connection\" class=\"text-[11px] font-medium text-muted-foreground flex-[2] min-w-0\">Connection</div><div data-column=\"Sends to\" class=\"text-[11px] font-medium text-muted-foreground flex-[2] min-w-0\">Sends to</div><div data-column=\"Used by\" class=\"text-[11px] font-medium text-muted-foreground w-24 flex-none\">Used by</div><div data-column=\"Credential\" class=\"text-[11px] font-medium text-muted-foreground w-32 flex-none\">Credential</div><div data-column=\"State\" class=\"text-[11px] font-medium text-muted-foreground w-36 flex-none\">State</div><div class=\"w-8 flex-none\" aria-hidden=\"true\"></div></div>",
    },
    POST_MESSAGE: {
      row: "<div data-testid=\"connections-row\" data-state=\"ready\" class=\"flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3\"><div class=\"flex min-w-0 flex-[2] items-center gap-2\"><svg viewBox=\"0 0 256 256\" width=\"1.2em\" height=\"1.2em\" aria-hidden=\"true\" class=\"h-4 w-4 flex-none\"><path fill=\"#e01e5a\" d=\"M53.841 161.32c0 14.832-11.987 26.82-26.819 26.82S.203 176.152.203 161.32c0-14.831 11.987-26.818 26.82-26.818H53.84zm13.41 0c0-14.831 11.987-26.818 26.819-26.818s26.819 11.987 26.819 26.819v67.047c0 14.832-11.987 26.82-26.82 26.82c-14.83 0-26.818-11.988-26.818-26.82z\"></path><path fill=\"#36c5f0\" d=\"M94.07 53.638c-14.832 0-26.82-11.987-26.82-26.819S79.239 0 94.07 0s26.819 11.987 26.819 26.819v26.82zm0 13.613c14.832 0 26.819 11.987 26.819 26.819s-11.987 26.819-26.82 26.819H26.82C11.987 120.889 0 108.902 0 94.069c0-14.83 11.987-26.818 26.819-26.818z\"></path><path fill=\"#2eb67d\" d=\"M201.55 94.07c0-14.832 11.987-26.82 26.818-26.82s26.82 11.988 26.82 26.82s-11.988 26.819-26.82 26.819H201.55zm-13.41 0c0 14.832-11.988 26.819-26.82 26.819c-14.831 0-26.818-11.987-26.818-26.82V26.82C134.502 11.987 146.489 0 161.32 0s26.819 11.987 26.819 26.819z\"></path><path fill=\"#ecb22e\" d=\"M161.32 201.55c14.832 0 26.82 11.987 26.82 26.818s-11.988 26.82-26.82 26.82c-14.831 0-26.818-11.988-26.818-26.82V201.55zm0-13.41c-14.831 0-26.818-11.988-26.818-26.82c0-14.831 11.987-26.818 26.819-26.818h67.25c14.832 0 26.82 11.987 26.82 26.819s-11.988 26.819-26.82 26.819z\"></path></svg><button type=\"button\" data-testid=\"connections-row-name\" class=\"truncate text-left text-[13px] font-medium text-foreground hover:underline\">#ops-alerts</button></div><div data-testid=\"connections-row-destination\" class=\"flex min-w-0 flex-[2] items-center gap-1.5 truncate font-mono text-[11px] text-muted-foreground\"><span aria-hidden=\"true\">🔒</span><span class=\"truncate\">slack.com/api · #ops-alerts</span><span class=\"flex-none rounded border border-border px-1 text-[11px] text-muted-foreground\">fixed</span></div><div data-testid=\"connections-row-usedby\" class=\"w-24 flex-none whitespace-nowrap text-[11px] text-muted-foreground\">2 steps</div><div data-testid=\"connections-row-credential\" class=\"w-32 flex-none whitespace-nowrap font-mono text-[11px] text-muted-foreground\">checked 3d ago</div><div class=\"w-36 flex-none\"><span data-testid=\"connections-row-state\" class=\"inline-flex items-center text-[11px] font-medium text-success\">✓ Ready</span></div><div class=\"flex w-8 flex-none items-center justify-end\"><button type=\"button\" aria-label=\"More actions for #ops-alerts\" data-testid=\"connections-row-more\" class=\"inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground\" id=\"radix-NORMALIZED\" aria-haspopup=\"menu\" aria-expanded=\"false\" data-state=\"closed\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-ellipsis h-4 w-4\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"1\"></circle><circle cx=\"19\" cy=\"12\" r=\"1\"></circle><circle cx=\"5\" cy=\"12\" r=\"1\"></circle></svg></button></div></div>",
      header: "<div data-testid=\"connections-header\" class=\"flex items-center gap-x-3 border-b border-border bg-muted/20 px-3.5 py-2\"><div data-column=\"Connection\" class=\"text-[11px] font-medium text-muted-foreground flex-[2] min-w-0\">Connection</div><div data-column=\"Sends to\" class=\"text-[11px] font-medium text-muted-foreground flex-[2] min-w-0\">Sends to</div><div data-column=\"Used by\" class=\"text-[11px] font-medium text-muted-foreground w-24 flex-none\">Used by</div><div data-column=\"Credential\" class=\"text-[11px] font-medium text-muted-foreground w-32 flex-none\">Credential</div><div data-column=\"State\" class=\"text-[11px] font-medium text-muted-foreground w-36 flex-none\">State</div><div class=\"w-8 flex-none\" aria-hidden=\"true\"></div></div>",
    },
    CREATE_TICKET: {
      row: "<div data-testid=\"connections-row\" data-state=\"ready\" class=\"flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3\"><div class=\"flex min-w-0 flex-[2] items-center gap-2\"><svg viewBox=\"0 0 256 256\" width=\"1.2em\" height=\"1.2em\" aria-hidden=\"true\" class=\"h-4 w-4 flex-none\"><defs><linearGradient id=\"SVGSBI7obaC\" x1=\"98.031%\" x2=\"58.888%\" y1=\".161%\" y2=\"40.766%\"><stop offset=\"18%\" stop-color=\"#0052cc\"></stop><stop offset=\"100%\" stop-color=\"#2684ff\"></stop></linearGradient><linearGradient id=\"SVGHifZlbzE\" x1=\"100.665%\" x2=\"55.402%\" y1=\".455%\" y2=\"44.727%\"><stop offset=\"18%\" stop-color=\"#0052cc\"></stop><stop offset=\"100%\" stop-color=\"#2684ff\"></stop></linearGradient></defs><path fill=\"#2684ff\" d=\"M244.658 0H121.707a55.5 55.5 0 0 0 55.502 55.502h22.649V77.37c.02 30.625 24.841 55.447 55.466 55.467V10.666C255.324 4.777 250.55 0 244.658 0\"></path><path fill=\"url(#SVGSBI7obaC)\" d=\"M183.822 61.262H60.872c.019 30.625 24.84 55.447 55.466 55.467h22.649v21.938c.039 30.625 24.877 55.43 55.502 55.43V71.93c0-5.891-4.776-10.667-10.667-10.667\"></path><path fill=\"url(#SVGHifZlbzE)\" d=\"M122.951 122.489H0c0 30.653 24.85 55.502 55.502 55.502h22.72v21.867c.02 30.597 24.798 55.408 55.396 55.466V133.156c0-5.891-4.776-10.667-10.667-10.667\"></path></svg><button type=\"button\" data-testid=\"connections-row-name\" class=\"truncate text-left text-[13px] font-medium text-foreground hover:underline\">Northwind Jira</button></div><div data-testid=\"connections-row-destination\" class=\"flex min-w-0 flex-[2] items-center gap-1.5 truncate font-mono text-[11px] text-muted-foreground\"><span aria-hidden=\"true\">🔒</span><span class=\"truncate\">northwind.atlassian.net · NW</span></div><div data-testid=\"connections-row-usedby\" class=\"w-24 flex-none whitespace-nowrap text-[11px] text-muted-foreground\">2 steps</div><div data-testid=\"connections-row-credential\" class=\"w-32 flex-none whitespace-nowrap font-mono text-[11px] text-muted-foreground\">checked 3d ago</div><div class=\"w-36 flex-none\"><span data-testid=\"connections-row-state\" class=\"inline-flex items-center text-[11px] font-medium text-success\">✓ Ready</span></div><div class=\"flex w-8 flex-none items-center justify-end\"><button type=\"button\" aria-label=\"More actions for Northwind Jira\" data-testid=\"connections-row-more\" class=\"inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground\" id=\"radix-NORMALIZED\" aria-haspopup=\"menu\" aria-expanded=\"false\" data-state=\"closed\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-ellipsis h-4 w-4\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"1\"></circle><circle cx=\"19\" cy=\"12\" r=\"1\"></circle><circle cx=\"5\" cy=\"12\" r=\"1\"></circle></svg></button></div></div>",
      header: "<div data-testid=\"connections-header\" class=\"flex items-center gap-x-3 border-b border-border bg-muted/20 px-3.5 py-2\"><div data-column=\"Connection\" class=\"text-[11px] font-medium text-muted-foreground flex-[2] min-w-0\">Connection</div><div data-column=\"Sends to\" class=\"text-[11px] font-medium text-muted-foreground flex-[2] min-w-0\">Sends to</div><div data-column=\"Used by\" class=\"text-[11px] font-medium text-muted-foreground w-24 flex-none\">Used by</div><div data-column=\"Credential\" class=\"text-[11px] font-medium text-muted-foreground w-32 flex-none\">Credential</div><div data-column=\"State\" class=\"text-[11px] font-medium text-muted-foreground w-36 flex-none\">State</div><div class=\"w-8 flex-none\" aria-hidden=\"true\"></div></div>",
    },
  }

  for (const key of Object.keys(CAPTURE_ROWS)) {
    it(`the wide ${key} row renders byte-for-byte what it rendered at 206.1-02's base`, () => {
      // ── NON-VACUITY FIRST. Byte-identity against an empty capture passes forever. ──
      expect(WIDE_HTML_BASELINE[key].row.length).toBeGreaterThan(0)
      expect(WIDE_HTML_BASELINE[key].header.length).toBeGreaterThan(0)

      const actual = wideCapture(CAPTURE_ROWS[key])
      // The normalization above is non-vacuous: exactly one ⋯ trigger id was replaced.
      expect(actual.rowRadixIds).toBe(1)
      expect(actual.row).toBe(WIDE_HTML_BASELINE[key].row)
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

  it("SEND_EMAIL captured the 🔒 destination and NOT the Slack-only `fixed` tag", () => {
    const html = WIDE_HTML_BASELINE.SEND_EMAIL.row
    expect(html).toContain("connections-row-destination")
    expect(html).toContain("🔒")
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
