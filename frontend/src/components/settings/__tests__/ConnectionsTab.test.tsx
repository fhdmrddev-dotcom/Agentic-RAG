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
  CONNECTIONS_EMPTY_BODY,
  CONNECTIONS_EMPTY_HEADING,
  CONNECTIONS_FILTERED_TO_ZERO,
  CONNECTIONS_NON_ADMIN_NOTE,
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
