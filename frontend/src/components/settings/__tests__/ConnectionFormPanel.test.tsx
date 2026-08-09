/**
 * Phase 190-17 (CONN-02 / CONN-03 / D-23 / D-26 / D-27, UI-SPEC §3a–§3e, §9, §12, §14) —
 * the add/edit panel's contract.
 *
 * WHAT THIS SUITE IS FOR, one sentence per group: every assertion below guards a §14
 * "how we'd know this failed" condition that NOTHING ELSE in the tree can see.
 *
 *   1. FOCUS TRAP — §14 verbatim: *"the panel traps focus nowhere (Tab escapes into the
 *      table behind it)"*. Asserted through `document.activeElement`, NEVER by the presence
 *      of a handler: a handler that exists and does the wrong thing passes the second
 *      check and fails a keyboard user.
 *   2. FOCUS RESTORE — §14's other half, *"restores focus nowhere on close"*. Asserted for
 *      BOTH exits: Escape, and a close that follows a successful save.
 *   3. THE LIST STAYS VISIBLE — the entire reason 156-A beat a dialog. A dialog would have
 *      scrimmed the table away; this container must not, and must not `aria-hidden` it.
 *   4. 375px — the panel becomes a bottom sheet below 768px and the tallest content (the
 *      notice blocks) must stay reachable.
 *   5. FIELD COUNTS — exactly 4 / 5 / 3 (§3b). An extra field is a surface nobody
 *      threat-modelled (D-32 / T-190-17-SCOPE), so it fails loudly.
 *   6. THE FOOTER IS UNCONDITIONAL — present on the FIRST render, before a keystroke, and
 *      updated as the host changes (§3c / T-190-17-DEST).
 *   7. THE SECRET IS WRITE-ONLY ON EDIT — no `input[type=password]` exists, the dots are a
 *      `<span>`, and no node in the tree holds a value resembling a stored secret
 *      (§3d / T-190-17-SECRET).
 *   8. NO `title` ATTRIBUTE anywhere in the rendered output (142-B / the 184-07 lesson).
 *   9. READ-ONLY FOR A NON-ADMIN — and, the half a `toBeDisabled()` assertion cannot see,
 *      the controls are ABSENT rather than inert (U-02 / T-190-17-U02).
 *
 * Plus the two this plan added because they are the ones that would ship a LIE:
 *  10. THE `live_connectors` OFF STATE — the amended §9 notice renders, and every write
 *      affordance is REMOVED. This is the owed half of D-190-DEF-07, paid here.
 *  11. D-23 — `ConnectionFormPanel` never imports from `PhaseFormPanel`, asserted on the
 *      SOURCE via `?raw`, because an import is invisible to the rendered DOM.
 *
 * ⚠ `userEvent.setup({ delay: null })` EVERYWHERE, and it is not a style choice. 190-16
 * measured that the DEFAULT per-keystroke delay in a new suite inside the count gate red
 * SIX unrelated shipped suites as bare timeouts — a phantom regression that costs an hour
 * to attribute. Recorded in the gate's own map; kept true here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, within, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ConnectionFormPanel } from "../ConnectionFormPanel"
import { ConnectionsTabView } from "../ConnectionsTab"
// The panel's SOURCE via Vite's `?raw` loader — the shipped house idiom for a fence the
// rendered DOM cannot express (`ConnectionPicker.test.tsx:31`, `ConnectionsTab.test.tsx:47`).
import panelSource from "../ConnectionFormPanel?raw"
import {
  CAPABILITY_LOCKED_NOTE,
  FIELD_COUNTS,
  FIELD_SLACK_CHANNEL_HELP,
  FIELD_SMTP_HOST_HELP,
  FOOTER_NOTHING_YET,
  FOOTER_TAG_FIXED,
  FOOTER_TAG_IMPLICIT_TLS,
  FOOTER_TAG_REFUSED,
  FOOTER_TAG_STARTTLS,
  PANEL_NON_ADMIN_NOTE,
  PANEL_OFF_BODY,
  PANEL_OFF_FOOTER,
  PANEL_OFF_HEADING,
  PANEL_SAVE_CREATE,
  PANEL_SAVE_EDIT,
  SECRET_DOTS,
  SECRET_REPLACE_LABEL,
  SECRET_STORED_NOTE,
  SLACK_ENDPOINT,
  destinationFooterOf,
  orgSharedLine,
  refusalOf,
  tlsModeOf,
  EMPTY_DRAFT,
} from "../connectionFormCopy"
import type { ConnectorCapability, ConnectorConnection } from "@/lib/api"

// ── Fixtures ─────────────────────────────────────────────────────────────────────────

const SENTINEL_SECRET = "xoxb-SENTINEL-CREDENTIAL-MUST-NEVER-REACH-THE-DOM-190-17"

function makeConnection(overrides: Partial<ConnectorConnection> = {}): ConnectorConnection {
  return {
    id: "conn-1",
    org_id: "org-1",
    capability: "send_email",
    name: "Ops mailbox",
    config: {
      host: "smtp.fastmail.com",
      port: 465,
      from_address: "ops@northwind.co",
      tls: "implicit",
    },
    is_enabled: true,
    last_checked_at: "2026-08-03T09:00:00Z",
    last_check_verdict: "ok",
    created_at: "2026-08-03T09:00:00Z",
    updated_at: "2026-08-03T09:00:00Z",
    ...overrides,
  }
}

const noop = () => {}

function renderPanel(
  props: Partial<React.ComponentProps<typeof ConnectionFormPanel>> = {},
) {
  return render(
    <ConnectionFormPanel
      open
      mode="create"
      isOrgAdmin
      liveConnectorsOn
      orgName="Northwind"
      onClose={noop}
      onCreate={vi.fn().mockResolvedValue(undefined)}
      onUpdate={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />,
  )
}

/** jsdom reports `innerWidth = 1024`; drive the real hook rather than stubbing the
 *  component's own branch, so the assertion measures the shipped code path. */
function setViewport(width: number) {
  Object.defineProperty(window, "innerWidth", { value: width, configurable: true })
  act(() => {
    window.dispatchEvent(new Event("resize"))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  setViewport(1024)
})

afterEach(() => {
  cleanup()
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 · THE FOCUS TRAP — §14's condition, inverted
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the focus trap (§3a / §12 — net-new, because `Dialog` was not used)", () => {
  it("Tab from the LAST focusable control returns to the FIRST, and focus never leaves the panel", async () => {
    const user = userEvent.setup({ delay: null })
    // A control OUTSIDE the panel — the thing Tab must never reach. Without this node the
    // test could pass on a panel that simply has one focusable child.
    render(
      <button type="button" data-testid="outside-control">
        outside
      </button>,
    )
    renderPanel()

    const panel = screen.getByTestId("connection-form-panel")
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>("button, input, select, textarea, [tabindex]"),
    ).filter((n) => n.getAttribute("tabindex") !== "-1")
    expect(focusables.length).toBeGreaterThan(2)

    const last = focusables[focusables.length - 1]
    last.focus()
    expect(document.activeElement).toBe(last)

    await user.tab()

    // The PROPERTY: focus is still inside the panel, and it wrapped to the first control.
    expect(panel.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).toBe(focusables[0])
    expect(document.activeElement).not.toBe(screen.getByTestId("outside-control"))
  })

  it("Shift+Tab from the FIRST focusable control goes to the LAST, still inside the panel", async () => {
    const user = userEvent.setup({ delay: null })
    render(
      <button type="button" data-testid="outside-control">
        outside
      </button>,
    )
    renderPanel()

    const panel = screen.getByTestId("connection-form-panel")
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>("button, input, select, textarea, [tabindex]"),
    ).filter((n) => n.getAttribute("tabindex") !== "-1")

    focusables[0].focus()
    await user.tab({ shift: true })

    expect(panel.contains(document.activeElement)).toBe(true)
    expect(document.activeElement).toBe(focusables[focusables.length - 1])
    expect(document.activeElement).not.toBe(screen.getByTestId("outside-control"))
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 · THE FOCUS RESTORE — both exits, because they are two different code paths
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the focus restore (§3a / §12)", () => {
  it("Escape closes and focus returns to the element that opened the panel", async () => {
    const user = userEvent.setup({ delay: null })
    const onClose = vi.fn()

    const opener = document.createElement("button")
    opener.setAttribute("data-testid", "opener")
    document.body.appendChild(opener)
    opener.focus()
    expect(document.activeElement).toBe(opener)

    const view = renderPanel({ onClose })
    // Opening moved focus INTO the panel — otherwise "restore" would be vacuous.
    expect(document.activeElement).toBe(screen.getByTestId("connection-form-title"))

    await user.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalledTimes(1)

    // The parent honours the close; the restore fires on the transition out of `open`.
    view.rerender(
      <ConnectionFormPanel
        open={false}
        mode="create"
        isOrgAdmin
        liveConnectorsOn
        onClose={onClose}
      />,
    )
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it("a close that follows a SUCCESSFUL SAVE restores focus the same way", async () => {
    const user = userEvent.setup({ delay: null })
    const onCreate = vi.fn().mockResolvedValue(undefined)
    let open = true
    const onClose = vi.fn(() => {
      open = false
    })

    const opener = document.createElement("button")
    document.body.appendChild(opener)
    opener.focus()

    const view = renderPanel({ onClose, onCreate })
    await user.click(screen.getByTestId("connection-form-save"))
    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(open).toBe(false)

    view.rerender(
      <ConnectionFormPanel
        open={false}
        mode="create"
        isOrgAdmin
        liveConnectorsOn
        onClose={onClose}
        onCreate={onCreate}
      />,
    )
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 · THE LIST STAYS VISIBLE — the whole reason 156-A beat a dialog
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the push/split container (§3a / D-27)", () => {
  it("with the panel open the connections table is STILL in the DOM and is not aria-hidden", () => {
    render(
      <ConnectionsTabView
        connections={[makeConnection()]}
        usageCounts={{}}
        isOrgAdmin
        liveConnectorsOn
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onSetEnabled={vi.fn().mockResolvedValue(undefined)}
        panel={
          <ConnectionFormPanel
            open
            mode="create"
            isOrgAdmin
            liveConnectorsOn
            onClose={noop}
            onCreate={vi.fn().mockResolvedValue(undefined)}
          />
        }
      />,
    )

    const table = screen.getByTestId("connections-header")
    expect(table).toBeInTheDocument()
    expect(screen.getAllByTestId("connections-row")).toHaveLength(1)
    // A dialog would have scrimmed it away. Walk UP from the table: nothing between it and
    // the document may be `aria-hidden`, which is what a portal-backed modal would set.
    for (let node: HTMLElement | null = table; node; node = node.parentElement) {
      expect(node.getAttribute("aria-hidden")).not.toBe("true")
    }
    // And the track really is the 400px split, not a full-width takeover.
    expect(screen.getByTestId("connections-split").style.gridTemplateColumns).toContain("400px")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 · 375px — the bottom sheet, and nothing unreachable
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("375px (§3a / §12)", () => {
  it("below 768px the panel becomes a bottom SHEET and the split track collapses to one column", () => {
    setViewport(375)
    render(
      <ConnectionsTabView
        connections={[makeConnection()]}
        usageCounts={{}}
        isOrgAdmin
        liveConnectorsOn
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onSetEnabled={vi.fn().mockResolvedValue(undefined)}
        panel={
          <ConnectionFormPanel
            open
            mode="create"
            isOrgAdmin
            liveConnectorsOn={false}
            onClose={noop}
          />
        }
      />,
    )

    expect(screen.getByTestId("connection-form-panel").getAttribute("data-layout")).toBe("sheet")
    // No 400px track beside a 375px viewport — that is the horizontal overflow, expressed
    // as the thing that would CAUSE it rather than as a geometry jsdom cannot measure.
    expect(screen.getByTestId("connections-split").style.gridTemplateColumns).not.toContain("400px")
  })

  it("the tallest content — the OFF notice — sits inside the panel's scroll container, so it stays reachable", () => {
    setViewport(375)
    renderPanel({ liveConnectorsOn: false, mode: "create" })

    const body = screen.getByTestId("connection-form-body")
    // The body is the scroller. If the notice lived outside it, a 375px sheet capped at
    // 85vh would clip it with no way to reach it.
    expect(body.className).toContain("overflow-y-auto")
    expect(body).toContainElement(screen.getByTestId("connection-form-off-notice"))
    expect(body).toContainElement(screen.getByTestId("connection-org-shared"))
    // And the panel itself is height-capped rather than allowed to run off the screen.
    expect(screen.getByTestId("connection-form-panel").className).toContain("max-h-[85vh]")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5 · THE FIELD COUNTS — 4 / 5 / 3, so an extra field fails loudly
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the per-capability field sets (§3b / D-32 / T-190-17-SCOPE)", () => {
  const cases: ConnectorCapability[] = ["send_email", "create_ticket", "post_message"]

  it.each(cases)("%s renders exactly its bound number of fields and nothing beyond it", async (capability) => {
    const user = userEvent.setup({ delay: null })
    renderPanel()
    await user.selectOptions(screen.getByLabelText("What this connection does"), capability)

    expect(screen.getAllByTestId("connection-field")).toHaveLength(FIELD_COUNTS[capability])
  })

  it("Slack says OUT LOUD that it has nothing to type, verbatim (D-02 told to the person)", async () => {
    const user = userEvent.setup({ delay: null })
    renderPanel()
    await user.selectOptions(screen.getByLabelText("What this connection does"), "post_message")

    expect(screen.getByText(FIELD_SLACK_CHANNEL_HELP)).toBeInTheDocument()
    expect(FIELD_SLACK_CHANNEL_HELP).toContain(
      "it cannot be pointed anywhere else, by you or by a workflow",
    )
    // …and there is no URL / host / webhook field to point anywhere (§3b: "and NOTHING else").
    expect(screen.queryByLabelText("Jira site")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("SMTP host and port")).not.toBeInTheDocument()
  })

  it("SMTP states the plaintext refusal BEFORE a person can trip it, verbatim", () => {
    renderPanel()
    expect(screen.getByText(FIELD_SMTP_HOST_HELP)).toBeInTheDocument()
    expect(FIELD_SMTP_HOST_HELP).toContain(
      "Plain smtp:// is refused, including for addresses inside this network.",
    )
  })

  it("on EDIT the capability is static text with a stated reason — never a control", () => {
    renderPanel({ mode: "edit", connection: makeConnection() })
    expect(screen.queryByLabelText("What this connection does")).not.toBeInTheDocument()
    expect(screen.getByTestId("connection-capability-static")).toBeInTheDocument()
    expect(screen.getByText(CAPABILITY_LOCKED_NOTE)).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 6 · THE FOOTER IS UNCONDITIONAL AND DERIVED DURING RENDER
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the always-on 🔒 destination footer (§3c / T-190-17-DEST)", () => {
  it("is present on the FIRST render, before a single keystroke", () => {
    renderPanel()
    const footer = screen.getByTestId("connection-destination-footer")
    expect(footer).toBeInTheDocument()
    expect(within(footer).getByTestId("connection-destination-value")).toHaveTextContent(
      FOOTER_NOTHING_YET,
    )
  })

  it("updates AS YOU TYPE — the host and the TLS-mode tag both move with the fields", async () => {
    const user = userEvent.setup({ delay: null })
    renderPanel()

    await user.type(screen.getByLabelText("SMTP host and port"), "smtp.fastmail.com")
    const portInput = screen
      .getByTestId("connection-form-body")
      .querySelector<HTMLInputElement>('input[placeholder="465"]')!
    await user.type(portInput, "465")

    expect(screen.getByTestId("connection-destination-value")).toHaveTextContent(
      "smtp.fastmail.com:465",
    )
    expect(
      screen.getAllByTestId("connection-destination-tag").map((n) => n.textContent),
    ).toContain(FOOTER_TAG_IMPLICIT_TLS)

    // Change the port and the MODE follows — the derivation is live, not a stored value.
    await user.clear(portInput)
    await user.type(portInput, "587")
    expect(
      screen.getAllByTestId("connection-destination-tag").map((n) => n.textContent),
    ).toContain(FOOTER_TAG_STARTTLS)
  })

  it("a provably-refused destination is marked refused and carries the destructive border", async () => {
    const user = userEvent.setup({ delay: null })
    renderPanel()
    await user.type(screen.getByLabelText("SMTP host and port"), "smtp://10.0.0.4")

    const footer = screen.getByTestId("connection-destination-footer")
    expect(footer.getAttribute("data-refused")).toBe("true")
    expect(footer.className).toContain("border-destructive/50")
    expect(
      screen.getAllByTestId("connection-destination-tag").map((n) => n.textContent),
    ).toContain(FOOTER_TAG_REFUSED)
    expect(screen.getByTestId("connection-destination-refused-reason")).toBeInTheDocument()
  })

  it("Slack's destination is the real endpoint and is tagged as fixed in code (D-02)", async () => {
    const user = userEvent.setup({ delay: null })
    renderPanel()
    await user.selectOptions(screen.getByLabelText("What this connection does"), "post_message")

    expect(screen.getByTestId("connection-destination-value")).toHaveTextContent(SLACK_ENDPOINT)
    expect(
      screen.getAllByTestId("connection-destination-tag").map((n) => n.textContent),
    ).toContain(FOOTER_TAG_FIXED)
  })

  it("the derivations themselves are total and honest (the unit half)", () => {
    // `refusalOf` only claims what it can PROVE from the text — copy rule 5.
    expect(refusalOf("smtp.fastmail.com")).toBeNull()
    expect(refusalOf("northwind.atlassian.net")).toBeNull()
    expect(refusalOf("smtp://mail.example.com")).not.toBeNull()
    expect(refusalOf("localhost")).not.toBeNull()
    expect(refusalOf("192.168.1.9")).not.toBeNull()
    expect(refusalOf("https://slack.com")).toBeNull()
    // The TLS mode is a pure function of the port, never a hidden fifth field.
    expect(tlsModeOf("465")).toBe("implicit")
    expect(tlsModeOf("587")).toBe("starttls")
    expect(tlsModeOf("")).toBe("starttls")
    // The footer never returns an empty destination — it degrades to a WORD.
    expect(destinationFooterOf(EMPTY_DRAFT).destination).toBe(FOOTER_NOTHING_YET)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 7 · THE SECRET IS WRITE-ONLY ON EDIT
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the write-only secret (§3d / T-190-17-SECRET)", () => {
  it("edit mode holds NO password input, and the dots are a <span> — never a fake value", () => {
    const { container } = renderPanel({ mode: "edit", connection: makeConnection() })

    expect(container.querySelectorAll('input[type="password"]')).toHaveLength(0)
    const dots = screen.getByTestId("connection-secret-dots")
    expect(dots.tagName).toBe("SPAN")
    expect(dots).toHaveTextContent(SECRET_DOTS)
    expect(screen.getByText(SECRET_STORED_NOTE)).toBeInTheDocument()
  })

  it("no node in the edit tree holds a value resembling a stored secret", () => {
    // A row whose config is deliberately polluted with secret-shaped keys: the panel's
    // readers are an explicit ALLOW-LIST, so nothing here may surface.
    const { container } = renderPanel({
      mode: "edit",
      connection: makeConnection({
        config: {
          host: "smtp.fastmail.com",
          port: 465,
          from_address: "ops@northwind.co",
          tls: "implicit",
          // @ts-expect-error — deliberately outside the declared config union; the server
          // could never send this (extra='forbid'), and the panel must not render it if it did.
          secret_ciphertext: `enc:v1:${SENTINEL_SECRET}`,
        },
      }),
    })

    expect(screen.queryAllByDisplayValue(SECRET_DOTS)).toHaveLength(0)
    expect(screen.queryAllByDisplayValue(SENTINEL_SECRET)).toHaveLength(0)
    const markup = container.innerHTML
    for (const needle of ["xoxb-", "enc:v1:", "secret_ciphertext", "ciphertext"]) {
      expect(markup).not.toContain(needle)
    }
  })

  it("Replace opens the ONE password input, and says the check verdict is cleared", async () => {
    const user = userEvent.setup({ delay: null })
    const { container } = renderPanel({ mode: "edit", connection: makeConnection() })

    await user.click(screen.getByRole("button", { name: SECRET_REPLACE_LABEL }))
    const inputs = container.querySelectorAll('input[type="password"]')
    expect(inputs).toHaveLength(1)
    expect((inputs[0] as HTMLInputElement).value).toBe("")
    expect(screen.getByText(/clears the last credential check/i)).toBeInTheDocument()
  })

  it("saving an edit without pressing Replace sends NO secret — an empty one would destroy a working credential", async () => {
    const user = userEvent.setup({ delay: null })
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderPanel({ mode: "edit", connection: makeConnection(), onUpdate })

    await user.click(screen.getByRole("button", { name: PANEL_SAVE_EDIT }))
    expect(onUpdate).toHaveBeenCalledTimes(1)
    const [, body] = onUpdate.mock.calls[0]
    expect(body).not.toHaveProperty("secret")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 8 · NO `title` ATTRIBUTE ANYWHERE
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("no `title` attribute (§12 / 142-B)", () => {
  it("neither the create nor the edit render puts a reason in a tooltip", () => {
    const create = renderPanel()
    expect(create.container.querySelectorAll("[title]")).toHaveLength(0)
    cleanup()

    const edit = renderPanel({ mode: "edit", connection: makeConnection() })
    expect(edit.container.querySelectorAll("[title]")).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 9 · READ-ONLY FOR A NON-ADMIN (U-02 / T-190-17-U02)
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the non-admin branch (U-02)", () => {
  it("renders static text, no Replace and no Save — ABSENT, not disabled", () => {
    const { container } = renderPanel({
      mode: "edit",
      connection: makeConnection(),
      isOrgAdmin: false,
    })

    // ⚠ ABSENCE, not `toBeDisabled()`. 190-16's plant C shipped the exact defect a
    // disabled-assertion PASSES on: a control that could never do anything must be removed.
    expect(screen.queryByTestId("connection-form-save")).not.toBeInTheDocument()
    expect(screen.queryByTestId("connection-secret-replace")).not.toBeInTheDocument()
    expect(container.querySelectorAll("input")).toHaveLength(0)
    expect(screen.getAllByTestId("connection-field-static").length).toBeGreaterThan(0)
    expect(screen.getByText(PANEL_NON_ADMIN_NOTE)).toBeInTheDocument()
  })

  it("POSITIVE CONTROL — an admin on a live platform DOES get all three", () => {
    const { container } = renderPanel({ mode: "edit", connection: makeConnection() })
    expect(screen.getByTestId("connection-form-save")).toBeInTheDocument()
    expect(screen.getByTestId("connection-secret-replace")).toBeInTheDocument()
    expect(container.querySelectorAll("input").length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 10 · THE `live_connectors` OFF STATE — the owed half of D-190-DEF-07, paid here
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the kill-switch OFF state (D-26 / §9 / D-190-DEF-07)", () => {
  it("renders the AMENDED notice and footer — neither promises a save the API refuses", () => {
    renderPanel({ liveConnectorsOn: false })

    expect(screen.getByText(PANEL_OFF_HEADING)).toBeInTheDocument()
    // Character-identity, so a re-softened sentence cannot slip back in.
    expect(screen.getByText(PANEL_OFF_BODY)).toBeInTheDocument()
    expect(screen.getByTestId("connection-form-off-footer")).toHaveTextContent(PANEL_OFF_FOOTER)

    // The two false promises, asserted as ABSENT from the rendered text.
    const text = screen.getByTestId("connection-form-panel").textContent ?? ""
    expect(text).not.toContain("You can save this connection")
    expect(text).not.toContain("will save · will not send")
  })

  it("every WRITE affordance is REMOVED while the switch is off, for an org admin", () => {
    const { container } = renderPanel({
      mode: "edit",
      connection: makeConnection(),
      isOrgAdmin: true,
      liveConnectorsOn: false,
    })

    expect(screen.queryByTestId("connection-form-save")).not.toBeInTheDocument()
    expect(screen.queryByTestId("connection-secret-replace")).not.toBeInTheDocument()
    expect(container.querySelectorAll("input")).toHaveLength(0)
    // And the disabled-shaped defect is named directly: nothing inert is left behind.
    expect(container.querySelectorAll("[disabled]")).toHaveLength(0)
  })

  it("NON-VACUITY — with the switch ON the notice is absent and the writes are back", () => {
    renderPanel({ mode: "edit", connection: makeConnection(), liveConnectorsOn: true })
    expect(screen.queryByTestId("connection-form-off-notice")).not.toBeInTheDocument()
    expect(screen.getByTestId("connection-form-save")).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 11 · D-23 — the lineage is READ, never imported
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the D-23 fence and the org-shared line", () => {
  it("`ConnectionFormPanel` imports NOTHING from `PhaseFormPanel` — a source fence, because an import is invisible to the DOM", () => {
    const importLines = panelSource
      .split("\n")
      .filter((line) => /^\s*import\b/.test(line) || /^\s*}\s*from\s+["']/.test(line))
      .join("\n")
    expect(importLines).not.toContain("PhaseFormPanel")
    // Positive control: the fence can actually see an import path at all.
    expect(importLines).toContain("connectionFormCopy")
  })

  it("the org-shared line renders verbatim with the org's own name, and degrades without one", () => {
    renderPanel({ orgName: "Northwind" })
    expect(screen.getByTestId("connection-org-shared")).toHaveTextContent(
      orgSharedLine("Northwind"),
    )
    expect(orgSharedLine("Northwind")).toContain("It is never visible to another organisation.")
    cleanup()

    renderPanel({ orgName: null })
    expect(screen.getByTestId("connection-org-shared")).toHaveTextContent(
      "Shared with everyone in your organisation",
    )
  })

  it("the create branch offers Save with the create wording, and the edit branch with the edit wording", () => {
    renderPanel()
    expect(screen.getByTestId("connection-form-save")).toHaveTextContent(PANEL_SAVE_CREATE)
    cleanup()
    renderPanel({ mode: "edit", connection: makeConnection() })
    expect(screen.getByTestId("connection-form-save")).toHaveTextContent(PANEL_SAVE_EDIT)
  })
})
