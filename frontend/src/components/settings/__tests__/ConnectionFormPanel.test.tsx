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
import { render, screen, cleanup, within, act, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ConnectionFormPanel } from "../ConnectionFormPanel"
import { ConnectionsTabView } from "../ConnectionsTab"
// The panel's SOURCE via Vite's `?raw` loader — the shipped house idiom for a fence the
// rendered DOM cannot express (`ConnectionPicker.test.tsx:31`, `ConnectionsTab.test.tsx:47`).
import panelSource from "../ConnectionFormPanel?raw"
// ── 190-18: the BACKEND's own source, through the same `?raw` loader, and deliberately NOT
//    through `node:fs`. `PublishGauntlet.test.tsx:34-46` records the measured reason:
//    `tsconfig.app.json` sets `types: ["vite/client"]` and nothing else on purpose, so three
//    `node:*` imports would add NEW `tsc` errors to the baseline this phase measures every
//    plan against — and the `new URL(…, import.meta.url)` spelling that pairs with them is
//    statically rewritten by Vite into an asset reference, which throws before a test runs.
import egressSource from "../../../../../backend/app/security/egress.py?raw"
import phaseTypesSource from "../../../../../backend/app/services/harness/phase_types.py?raw"
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
import * as REFUSAL_COPY from "../connectionRefusalCopy"
import {
  CHECK_FAILURE_SENTENCE,
  CHECK_INFLIGHT_BODY,
  CHECK_INFLIGHT_BUTTON,
  CHECK_INFLIGHT_FOOTER,
  CHECK_INFLIGHT_HEADING,
  CHECK_NEGATION_BY_CAPABILITY,
  CHECK_NOT_RUN_HEADING,
  CHECK_SUCCESS_FOOTER,
  CHECK_SUCCESS_HEADLINE,
  CHECK_UNAVAILABLE_DISABLED,
  CHECK_VERBATIM_LABEL,
  CIPHER_UNAVAILABLE_BLOCK,
  CIPHER_UNAVAILABLE_HEADING,
  CIPHER_UNAVAILABLE_SAVE_DISABLED_REASON,
  EGRESS_REFUSAL_REASONS,
  REFUSAL_AUDIT_LINE,
  REFUSAL_HEADINGS,
  REFUSAL_LOOKUP_HEADING,
  REFUSAL_ORDERING_LINE,
  REFUSAL_REASON_BODIES,
  capabilityWordOf,
  checkPlatformBody,
  checkRejectedReachedLine,
  checkSuccessBody,
  refusalBodyFor,
  refusalUnknownBody,
  vendorOf,
  type RefusalParts,
} from "../connectionRefusalCopy"
import {
  CONNECTIONS_ACTION_CHECK,
  CONNECTIONS_ACTION_DELETE,
  CONNECTIONS_ACTION_DISABLE,
  RECEIPT_DELETED,
  RECEIPT_DISABLED,
  deleteConfirmLabel,
  deleteSheetBody,
  disableSheetBody,
} from "../connectionsCopy"
import { ConnectorApiError } from "@/lib/api"
import type {
  ConnectorCapability,
  ConnectorCheckResult,
  ConnectorConnection,
} from "@/lib/api"

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

// ── 190-18 fixtures ──────────────────────────────────────────────────────────────────

/** A check verdict. `ok` by default; every failing case names its own bucket, because the
 *  bucket IS what §4d keeps apart and a default would let a case pass on the wrong one. */
function makeCheckResult(overrides: Partial<ConnectorCheckResult> = {}): ConnectorCheckResult {
  return {
    ok: true,
    verdict: "ok",
    identity: "ops@northwind.co",
    host: "smtp.fastmail.com",
    port: 465,
    checked_at: "2026-08-09T06:00:00Z",
    bucket: null,
    provider_message: "",
    reason_code: null,
    ...overrides,
  }
}

/** An editable EDIT-mode panel with every 190-18 handler wired — the state in which the
 *  refusals, the check and the graded guards are all reachable. */
function renderEditable(
  props: Partial<React.ComponentProps<typeof ConnectionFormPanel>> = {},
) {
  return renderPanel({
    mode: "edit",
    connection: makeConnection(),
    onCheck: vi.fn().mockResolvedValue(makeCheckResult()),
    onDelete: vi.fn().mockResolvedValue(undefined),
    onSetEnabled: vi.fn().mockResolvedValue(undefined),
    ...props,
  })
}

/** Drive one check and wait for its outcome block. */
async function runCheck(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("connection-check-button"))
}

/**
 * The three absolute phrasings §14 names, SPELLED EXACTLY ONCE IN THIS REPOSITORY'S CLIENT
 * CODE — here, in the fence.
 *
 * `connectionRefusalCopy.ts` deliberately describes them rather than quoting them, because a
 * fence that greps for a phrase is unable to be described using that phrase (the 190-15
 * finding, met for the third time in this phase). §14: *"§5b's middle paragraph regains an
 * absolute verb … THIS IS THE U-07a DEFECT AND IT IS THE SINGLE MOST LIKELY REGRESSION IN
 * THIS SECTION, because the absolute reads stronger and nothing in the type system objects."*
 */
const ABSOLUTE_VERB_FENCE = ["cannot pick", "no step will be allowed", "never bound"] as const

/** §4a-2's nine banned terms. The audience is an org admin, not an engineer reading a threat
 *  model. Spelled here for the same reason as above. */
const BANNED_VOCABULARY = [
  "SSRF",
  "RFC1918",
  "CIDR",
  "link-local",
  "NAT64",
  "SIIT",
  "TOCTOU",
  "metadata endpoint",
  "allow-list",
] as const

const SAMPLE_PARTS: RefusalParts = {
  host: "smtp.fastmail.com",
  ip: "10.0.0.4",
  vendor: "Jira",
  capabilityWord: "email",
  allowed: "atlassian.net",
}

/** Every string any export of `connectionRefusalCopy` can produce, walked structurally so a
 *  NEW export is fenced the day it is added rather than the day someone remembers it. */
function stringsOfModule(): string[] {
  const seen: string[] = []
  const walk = (value: unknown, depth: number): void => {
    if (depth > 4) return
    if (typeof value === "string") {
      seen.push(value)
      return
    }
    if (Array.isArray(value)) {
      value.forEach((v) => walk(v, depth + 1))
      return
    }
    if (typeof value === "function") {
      try {
        walk((value as (...args: unknown[]) => unknown)(SAMPLE_PARTS), depth + 1)
      } catch {
        // A signature this walker does not fit; its output is covered by an explicit case.
      }
      return
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach((v) => walk(v, depth + 1))
    }
  }
  walk(REFUSAL_COPY, 0)
  // The six §4c templates take `(parts)`, so the structural walk above already invoked each
  // of them — but name them again explicitly, because THEY are the sentences this fence
  // exists for and a silently-skipped one would leave the fence green over nothing.
  for (const code of EGRESS_REFUSAL_REASONS) seen.push(REFUSAL_REASON_BODIES[code](SAMPLE_PARTS))
  seen.push(refusalUnknownBody("some_new_code", "mail.example.com"))
  seen.push(checkPlatformBody("connection_disabled"))
  seen.push(checkPlatformBody("something_unmapped"))
  seen.push(checkPlatformBody(null))
  seen.push(
    checkSuccessBody({
      identity: "u", host: "h", port: 1, capability: "send_email",
    }),
  )
  seen.push(checkRejectedReachedLine("h", 1))
  return seen
}

/**
 * Does `needle` reach any place a person or a tool could read it?
 *
 * ⚠ SCOPE, STATED RATHER THAN IMPLIED: this sweeps rendered TEXT, `innerHTML`, every `data-*`
 * attribute, every `aria-label` and every `title`. It deliberately does NOT treat an
 * `<input type="password">`'s own `value` as a leak — that is the secret the PERSON is
 * typing into their own form, which §3d ships on purpose and which no refusal copy put there.
 * The threat (T-190-18-T5) is a credential surfacing in a REASON, an attribute or a tooltip.
 */
function leaks(root: HTMLElement, needle: string): boolean {
  if ((root.textContent ?? "").includes(needle)) return true
  for (const node of Array.from(root.querySelectorAll<HTMLElement>("*"))) {
    for (const attr of Array.from(node.attributes)) {
      const relevant =
        attr.name.startsWith("data-") || attr.name === "aria-label" || attr.name === "title"
      if (relevant && attr.value.includes(needle)) return true
    }
  }
  return false
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

// ═══════════════════════════════════════════════════════════════════════════════════════
// ═══ PHASE 190-18 — the refusal copy, the check moments and the graded guards ═══════════
//
// Every group below guards a §14 "how we'd know this failed" condition, and each is written
// against the SHIPPED string rather than a re-typed one: a test that re-types the sentence
// it is guarding is unable to detect drift, which is the only thing these tests are for.
// ═══════════════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════════════
// 12 · THE CLOSED SET AGREES WITH THE GUARD'S OWN SOURCE (T-190-18-CODE)
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the closed six-row table is keyed off egress.py's OWN codes (§4c)", () => {
  /** Parse `REFUSAL_REASONS: frozenset[str] = frozenset({...})` out of the guard's source. */
  function parseEgressReasons(source: string): string[] {
    const block = /REFUSAL_REASONS:\s*frozenset\[str\]\s*=\s*frozenset\(\{([\s\S]*?)\}\)/.exec(
      source,
    )
    if (!block) return []
    return Array.from(block[1].matchAll(/"([a-z_]+)"/g)).map((m) => m[1])
  }

  it("the client's six codes ARE the six `egress.py` declares — read from source, not transcribed", () => {
    const fromSource = parseEgressReasons(egressSource)

    // NON-VACUITY FIRST. A parser that found nothing would make the comparison below pass
    // over two empty lists forever, which is the failure mode this whole file exists to
    // avoid one level up.
    expect(fromSource).toHaveLength(6)
    expect(fromSource).toContain("address_not_public")

    // FALSIFY THE PARSER before trusting it on the tree: over a mangled input it must NOT
    // return the six-row answer.
    expect(parseEgressReasons("REFUSAL_REASONS = something_else")).toEqual([])

    expect([...fromSource].sort()).toEqual([...EGRESS_REFUSAL_REASONS].sort())
    // …and the client carries a sentence and a heading for every one of them.
    expect(Object.keys(REFUSAL_REASON_BODIES).sort()).toEqual([...fromSource].sort())
  })

  it("every one of the six renders its OWN sentence — no two rows share a body", () => {
    const bodies = EGRESS_REFUSAL_REASONS.map((code) =>
      REFUSAL_REASON_BODIES[code](SAMPLE_PARTS),
    )
    expect(new Set(bodies).size).toBe(6)
    for (const body of bodies) expect(body.length).toBeGreaterThan(40)
    // The audit line is the ONE thing every row shares, by §4c's instruction.
    expect(REFUSAL_AUDIT_LINE).toContain("never the credential")
  })

  it("an UNMAPPED code surfaces loudly — an honest sentence carrying the server's own code, never a blank", () => {
    const body = refusalBodyFor("a_seventh_code_nobody_ratified", {
      host: "mail.example.com",
      capabilityWord: "email",
    })
    expect(body).not.toBe("")
    expect(body).toContain("mail.example.com")
    expect(body).toContain("a_seventh_code_nobody_ratified")
    expect(body).toBe(refusalUnknownBody("a_seventh_code_nobody_ratified", "mail.example.com"))
    // A null code still gets a sentence rather than the string "null".
    const noCode = refusalBodyFor(null, { host: "mail.example.com", capabilityWord: "email" })
    expect(noCode).not.toContain("null")
    expect(noCode.length).toBeGreaterThan(40)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 13 · ⭐ THE §4b ASYMMETRY — both directions, in one place, because the asymmetry IS the point
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("§4b — a refusal you can fix leaves the door open; one you are unable to fix closes it", () => {
  it("an EGRESS refusal leaves Save ENABLED, and renders the §4c sentence, D-06's line and the audit line", async () => {
    const user = userEvent.setup({ delay: null })
    const onUpdate = vi
      .fn()
      .mockRejectedValue(new ConnectorApiError("refused", 400, "address_not_public"))
    renderEditable({ onUpdate })

    await user.click(screen.getByTestId("connection-form-save"))
    await waitFor(() => expect(screen.getByTestId("connection-save-refusal")).toBeInTheDocument())

    // ⭐ THE HALF THAT MATTERS: the door stays open.
    expect(screen.getByTestId("connection-form-save")).not.toBeDisabled()
    expect(screen.getByTestId("connection-form-save")).not.toHaveAttribute("aria-describedby")

    const block = screen.getByTestId("connection-save-refusal")
    expect(within(block).getByTestId("connection-save-refusal-heading")).toHaveTextContent(
      REFUSAL_HEADINGS.refused.heading,
    )
    // Character identity against the IMPORTED template, never against a re-typed literal.
    expect(within(block).getByTestId("connection-save-refusal-body")).toHaveTextContent(
      REFUSAL_REASON_BODIES.address_not_public({
        host: "smtp.fastmail.com",
        vendor: vendorOf("send_email"),
        capabilityWord: capabilityWordOf("send_email"),
      }),
    )
    expect(within(block).getByText(REFUSAL_ORDERING_LINE)).toBeInTheDocument()
    expect(within(block).getByText(REFUSAL_HEADINGS.refused.nextStep!)).toBeInTheDocument()
    expect(within(block).getByText(REFUSAL_AUDIT_LINE)).toBeInTheDocument()
  })

  it("D-06's ordering line is PRESENT and verbatim — the n8n property told to a human", async () => {
    const user = userEvent.setup({ delay: null })
    renderEditable({
      onUpdate: vi.fn().mockRejectedValue(new ConnectorApiError("r", 400, "scheme_not_tls")),
    })
    await user.click(screen.getByTestId("connection-form-save"))
    await waitFor(() => expect(screen.getByTestId("connection-save-refusal")).toBeInTheDocument())

    expect(screen.getByText(REFUSAL_ORDERING_LINE)).toBeInTheDocument()
    // It is the sentence, not merely a sentence: assert the load-bearing clause too, so a
    // "tidier" rewrite that drops the ordering claim goes red rather than passing on length.
    expect(REFUSAL_ORDERING_LINE).toContain("before your password was read")
  })

  it("the CIPHER refusal DISABLES Save, and `aria-describedby` resolves to a node whose text IS the reason", async () => {
    const user = userEvent.setup({ delay: null })
    const onUpdate = vi
      .fn()
      .mockRejectedValue(new ConnectorApiError("no key", 503, "no_encryption_key"))
    const { container } = renderEditable({ onUpdate })

    await user.click(screen.getByTestId("connection-form-save"))
    await waitFor(() =>
      expect(screen.getByTestId("connection-cipher-refusal")).toBeInTheDocument(),
    )

    const save = screen.getByTestId("connection-form-save")
    // ⭐ THE OTHER HALF: the door closes — and this is the ONE control on this surface where
    // `disabled` is right, because it is meaningful and its refusal IS the message.
    expect(save).toBeDisabled()

    // The wiring RESOLVES — an id pointing at nothing is the defect a `toBeDisabled()` plus a
    // `getByText()` would both miss.
    const describedBy = save.getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    const reasonNode = container.querySelector(`#${CSS.escape(describedBy!)}`)
    expect(reasonNode).not.toBeNull()
    expect(reasonNode!.textContent).toBe(CIPHER_UNAVAILABLE_SAVE_DISABLED_REASON)

    // Block 9's four paragraphs, all by character identity.
    expect(screen.getByText(CIPHER_UNAVAILABLE_HEADING)).toBeInTheDocument()
    for (const paragraph of CIPHER_UNAVAILABLE_BLOCK) {
      expect(screen.getByText(paragraph)).toBeInTheDocument()
    }
    // §11d rule 4 — it names the SHIPPED state string, never a second phrase for it.
    expect(CIPHER_UNAVAILABLE_BLOCK[1]).toContain("Not sent — recorded")
  })

  it("a refusal with NO reason code falls to the generic branch — no cause is claimed that could not be read", async () => {
    const user = userEvent.setup({ delay: null })
    renderEditable({ onUpdate: vi.fn().mockRejectedValue(new Error("boom")) })

    await user.click(screen.getByTestId("connection-form-save"))
    await waitFor(() => expect(screen.getByTestId("connection-save-failed")).toBeInTheDocument())

    expect(screen.queryByTestId("connection-save-refusal")).not.toBeInTheDocument()
    expect(screen.queryByTestId("connection-cipher-refusal")).not.toBeInTheDocument()
    expect(screen.getByTestId("connection-form-save")).not.toBeDisabled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 14 · ⭐ §4d's TWO FORBIDDEN SWAPS — asserted for all three buckets
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("§4d — refused ≠ unreachable ≠ rejected (§14's two swaps)", () => {
  const BUCKETS = [
    { bucket: "refused" as const, reason_code: "address_not_public" },
    { bucket: "unreachable" as const, reason_code: null },
    { bucket: "rejected" as const, reason_code: null },
  ]

  it("a_refusal_never_renders_the_word_failed_and_an_unreachable_host_never_renders_refused", async () => {
    for (const { bucket, reason_code } of BUCKETS) {
      const user = userEvent.setup({ delay: null })
      renderEditable({
        onCheck: vi.fn().mockResolvedValue(
          makeCheckResult({
            ok: false,
            verdict: "failed",
            bucket,
            reason_code,
            provider_message: bucket === "rejected" ? "535 5.7.8 Authentication credentials invalid" : "",
          }),
        ),
      })
      await runCheck(user)
      await waitFor(() =>
        expect(screen.getByTestId("connection-check-outcome")).toBeInTheDocument(),
      )

      const text = screen.getByTestId("connection-check-outcome").textContent ?? ""

      // NON-VACUITY: the block really rendered this bucket's own heading.
      const expectedHeading =
        bucket === "refused" ? REFUSAL_HEADINGS.refused.heading : REFUSAL_HEADINGS[bucket].heading
      expect(text).toContain(expectedHeading)

      // ⭐ SWAP 1 — a refusal that says "failed" makes a security decision read as a bug.
      // ⚠ ASSERTED ON THE STEM `fail`, NOT ON THE WHOLE WORD `failed`, and the widening is a
      // MEASUREMENT rather than caution. §14 names the word "failed", so the first draft
      // asserted exactly that — and a plant that made the REFUSED branch render §5b's
      // sentence (*"…will fail on the next run…"*) stayed GREEN, because that sentence
      // carries "failing" and "fail" but never "failed". The flattening §14 is about had
      // happened and the fence saw nothing. Every string the refused branch can render is
      // free of the stem (asserted structurally below), so the wider fence costs nothing.
      if (bucket === "refused") expect(text.toLowerCase()).not.toContain("fail")
      // ⭐ SWAP 2 — an unreachable host that says "refused" makes a bug read as a policy.
      // Widened to the stem for the same reason: "refusal" and "refuses" are the same swap.
      if (bucket === "unreachable") expect(text.toLowerCase()).not.toContain("refus")

      cleanup()
    }
  })

  it("the three buckets keep three distinct headings and three distinct next steps", () => {
    const headings = Object.values(REFUSAL_HEADINGS).map((h) => h.heading)
    expect(new Set(headings).size).toBe(3)
    // `rejected` deliberately offers NO client next step: its next step is the vendor's own
    // words (§5b / 071-A), which no string here may paraphrase.
    expect(REFUSAL_HEADINGS.rejected.nextStep).toBeNull()
    expect(REFUSAL_HEADINGS.refused.nextStep).not.toBeNull()
    expect(REFUSAL_HEADINGS.unreachable.nextStep).not.toBeNull()
    // Refused leads with ⛔ (a decision); the other two with ✕ (something went wrong).
    expect(REFUSAL_HEADINGS.refused.glyph).toBe("⛔")
    expect(REFUSAL_HEADINGS.unreachable.glyph).toBe("✕")
  })

  it("the REJECTED bucket alone carries §5b and the host's words VERBATIM, untruncated", async () => {
    const user = userEvent.setup({ delay: null })
    const vendorWords = "535 5.7.8 Authentication credentials invalid — see https://example.test/smtp-auth for the full explanation of this rejection"
    renderEditable({
      onCheck: vi.fn().mockResolvedValue(
        makeCheckResult({
          ok: false,
          verdict: "failed",
          bucket: "rejected",
          provider_message: vendorWords,
        }),
      ),
    })
    await runCheck(user)
    await waitFor(() => expect(screen.getByTestId("connection-check-outcome")).toBeInTheDocument())

    expect(screen.getByTestId("connection-check-outcome-body")).toHaveTextContent(
      checkRejectedReachedLine("smtp.fastmail.com", 465),
    )
    expect(screen.getByText(CHECK_VERBATIM_LABEL)).toBeInTheDocument()
    const verbatim = screen.getByTestId("connection-check-verbatim")
    // Untruncated — the WHOLE string, character for character (071-A).
    expect(verbatim.textContent).toBe(vendorWords)
    expect(verbatim.className).toContain("font-mono")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 15 · U-05 — `unresolvable` reads as a LOOKUP FAILURE, not as a security refusal
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("U-05 — the one row that is deliberately not worded as a refusal (§4c)", () => {
  it("renders the LOOKUP heading, and its BODY borrows no refusal vocabulary", async () => {
    const user = userEvent.setup({ delay: null })
    renderEditable({
      onCheck: vi.fn().mockResolvedValue(
        makeCheckResult({
          ok: false,
          verdict: "failed",
          bucket: "refused",
          reason_code: "unresolvable",
          host: "smpt.fastmial.com",
        }),
      ),
    })
    await runCheck(user)
    await waitFor(() => expect(screen.getByTestId("connection-check-outcome")).toBeInTheDocument())

    expect(screen.getByTestId("connection-check-outcome-heading")).toHaveTextContent(
      REFUSAL_LOOKUP_HEADING,
    )
    expect(screen.getByTestId("connection-check-outcome-heading")).not.toHaveTextContent(
      REFUSAL_HEADINGS.refused.heading,
    )

    // ⚠ SCOPED TO THE BODY ON PURPOSE. §4c instructs that EVERY row closes with the same
    // audit line unchanged, and that line names a refusal RECORD — so the property being
    // asserted is about the sentence a person reads as the explanation, not about the block.
    const body = screen.getByTestId("connection-check-outcome-body").textContent ?? ""
    expect(body.toLowerCase()).not.toContain("refus")
    expect(body.toLowerCase()).not.toContain("failed")
    expect(body).toContain("Check the spelling")
    // The typo'd host is named, because that is the thing the person has to look at.
    expect(body).toContain("smpt.fastmial.com")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 16 · ⭐ §5b HAS NO ABSOLUTE VERB — §14's single most likely regression in this section
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("§5b / U-07a — the copy claims exactly Gate 1's reach and no more", () => {
  it("the rendered failure paragraph EQUALS `CHECK_FAILURE_SENTENCE`, character for character", async () => {
    const user = userEvent.setup({ delay: null })
    renderEditable({
      onCheck: vi.fn().mockResolvedValue(
        makeCheckResult({ ok: false, verdict: "failed", bucket: "rejected", provider_message: "535" }),
      ),
    })
    await runCheck(user)
    await waitFor(() =>
      expect(screen.getByTestId("connection-check-failure-sentence")).toBeInTheDocument(),
    )

    // EXACT equality against the IMPORTED identifier — not `toContain`, not a re-typed
    // literal. A drifted sentence is a defect on this surface, not a style change.
    expect(screen.getByTestId("connection-check-failure-sentence").textContent).toBe(
      CHECK_FAILURE_SENTENCE,
    )
  })

  it("neither the sentence nor ANY string this module can produce carries one of §14's three absolutes", () => {
    const all = stringsOfModule()
    expect(all.length).toBeGreaterThan(25)

    for (const phrase of ABSOLUTE_VERB_FENCE) {
      const offenders = all.filter((s) => s.toLowerCase().includes(phrase))
      expect(offenders).toEqual([])
    }

    // POSITIVE CONTROL — the fence can actually see one of these phrases when it is present.
    const planted = [...all, "a workflow author cannot pick it while it is failing"]
    expect(planted.some((s) => s.toLowerCase().includes(ABSOLUTE_VERB_FENCE[0]))).toBe(true)

    // And the shipped sentence says `the picker`, which is the mechanism that actually exists
    // (Gate 1). Gate 2 validates org + `is_enabled` only — plan 190-15 asserted that as a
    // POSITIVE test and measured `grep -c "last_check_verdict" phase_types.py` -> 0.
    expect(CHECK_FAILURE_SENTENCE).toContain("The picker will not offer it while it is failing")
    expect(CHECK_FAILURE_SENTENCE).toContain("rather than pretend")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 17 · ⭐ §5c — THE CHECK'S THREE MOMENTS, and the negation pinned against 189's OWN source
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("§5c — the check moments", () => {
  /** Parse `_EXTERNAL_ACTION_NEGATION: dict[str, str] = { ... }` out of 189's production source. */
  function parseNegations(source: string): Record<string, string> {
    const block = /_EXTERNAL_ACTION_NEGATION:\s*dict\[str,\s*str\]\s*=\s*\{([\s\S]*?)\n\}/.exec(
      source,
    )
    if (!block) return {}
    const out: Record<string, string> = {}
    for (const m of block[1].matchAll(/"([a-z_]+)":\s*"([^"]*)"/g)) out[m[1]] = m[2]
    return out
  }

  it("⭐ the closing negation comes from the CLOSED table 189 ALREADY SHIPS — read from source, not from any plan text", () => {
    const shipped = parseNegations(phaseTypesSource)

    // NON-VACUITY, then FALSIFICATION, then the comparison.
    expect(Object.keys(shipped)).toHaveLength(3)
    expect(parseNegations("_EXTERNAL_ACTION_NEGATION = {}")).toEqual({})

    expect(CHECK_NEGATION_BY_CAPABILITY).toEqual(shipped)

    // ⚠ THE ROW THAT HAD DRIFTED. Plan 190-18's own task text, and UI-SPEC §5c as originally
    // written, both quoted `send_email` as "No mail was delivered to anyone." — inside the
    // sentence forbidding improvisation. Plan 190-15 measured production source and corrected
    // the document. This assertion is what keeps it corrected.
    expect(CHECK_NEGATION_BY_CAPABILITY.send_email).toBe("No email was sent.")
    expect(CHECK_NEGATION_BY_CAPABILITY.send_email).not.toBe("No mail was delivered to anyone.")
  })

  it.each([
    ["send_email" as const],
    ["create_ticket" as const],
    ["post_message" as const],
  ])("the success headline closes with %s's own negation, and names WHO we authenticated as", async (capability) => {
    const user = userEvent.setup({ delay: null })
    renderEditable({
      connection: makeConnection({
        capability,
        config:
          capability === "send_email"
            ? { host: "smtp.fastmail.com", port: 465, from_address: "ops@northwind.co", tls: "implicit" }
            : capability === "create_ticket"
              ? { base_url: "northwind.atlassian.net", project_key: "NW", account_email: "ops@northwind.co" }
              : { default_channel: "#ops-alerts" },
      }),
      onCheck: vi.fn().mockResolvedValue(makeCheckResult({ identity: "bot@northwind" })),
    })
    await runCheck(user)
    await waitFor(() => expect(screen.getByTestId("connection-check-success")).toBeInTheDocument())

    expect(screen.getByTestId("connection-check-success-heading")).toHaveTextContent(
      CHECK_SUCCESS_HEADLINE,
    )
    expect(screen.getByTestId("connection-check-success-body")).toHaveTextContent(
      checkSuccessBody({
        identity: "bot@northwind",
        host: "smtp.fastmail.com",
        port: 465,
        capability,
      }),
    )
    expect(screen.getByTestId("connection-check-success-body")).toHaveTextContent(
      CHECK_NEGATION_BY_CAPABILITY[capability],
    )
    expect(screen.getByText(CHECK_SUCCESS_FOOTER)).toBeInTheDocument()
  })

  it("IN FLIGHT it says, before anything runs, that nothing is sent — and the button reads as busy", async () => {
    const user = userEvent.setup({ delay: null })
    let release: (r: ConnectorCheckResult) => void = () => {}
    const pending = new Promise<ConnectorCheckResult>((resolve) => {
      release = resolve
    })
    renderEditable({ onCheck: vi.fn().mockReturnValue(pending) })

    expect(screen.getByTestId("connection-check-button")).toHaveTextContent(CONNECTIONS_ACTION_CHECK)
    await runCheck(user)

    expect(screen.getByTestId("connection-check-inflight-heading")).toHaveTextContent(
      CHECK_INFLIGHT_HEADING,
    )
    expect(screen.getByText(CHECK_INFLIGHT_BODY)).toBeInTheDocument()
    expect(screen.getByText(CHECK_INFLIGHT_FOOTER)).toBeInTheDocument()
    const button = screen.getByTestId("connection-check-button")
    expect(button).toHaveTextContent(CHECK_INFLIGHT_BUTTON)
    expect(button).toBeDisabled()
    // §12 — the in-flight moment is a live region, so it is announced rather than merely drawn.
    expect(screen.getByTestId("connection-check-inflight")).toHaveAttribute("role", "status")

    await act(async () => {
      release(makeCheckResult())
      await pending
    })
    await waitFor(() => expect(screen.getByTestId("connection-check-success")).toBeInTheDocument())
  })

  it("a PLATFORM condition gets its own heading — it is not dressed as one of §4d's three", async () => {
    const user = userEvent.setup({ delay: null })
    renderEditable({
      onCheck: vi
        .fn()
        .mockRejectedValue(new ConnectorApiError("unreadable", 503, "credential_unreadable")),
    })
    await runCheck(user)
    await waitFor(() => expect(screen.getByTestId("connection-check-not-run")).toBeInTheDocument())

    expect(screen.getByTestId("connection-check-not-run-heading")).toHaveTextContent(
      CHECK_NOT_RUN_HEADING,
    )
    expect(screen.getByTestId("connection-check-not-run-body")).toHaveTextContent(
      checkPlatformBody("credential_unreadable"),
    )
    // It borrows NONE of §4d's three headings — that flattening is the same defect one level up.
    const text = screen.getByTestId("connection-check-not-run").textContent ?? ""
    for (const h of Object.values(REFUSAL_HEADINGS)) expect(text).not.toContain(h.heading)
  })

  it("the check affordance is REMOVED on a switched-off row, with a stated reason — never left to 409", () => {
    renderEditable({ connection: makeConnection({ is_enabled: false }) })
    expect(screen.queryByTestId("connection-check-button")).not.toBeInTheDocument()
    expect(screen.getByTestId("connection-check-unavailable")).toHaveTextContent(
      CHECK_UNAVAILABLE_DISABLED,
    )
  })

  it("the check is REMOVED entirely for a non-admin and while the kill-switch is off (U-02 / D-26)", () => {
    renderEditable({ isOrgAdmin: false })
    expect(screen.queryByTestId("connection-check-button")).not.toBeInTheDocument()
    cleanup()
    renderEditable({ liveConnectorsOn: false })
    expect(screen.queryByTestId("connection-check-button")).not.toBeInTheDocument()
    cleanup()
    // POSITIVE CONTROL — an admin on a live platform DOES get it.
    renderEditable()
    expect(screen.getByTestId("connection-check-button")).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 18 · ⭐ NO CREDENTIAL REACHES ANY RENDERED REASON (T-190-18-T5)
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("a credential never reaches a refusal, a check outcome or any attribute", () => {
  it("a refusal and a failed check, driven with a sentinel secret in scope, leak it nowhere", async () => {
    const user = userEvent.setup({ delay: null })
    const { container } = renderEditable({
      onUpdate: vi.fn().mockRejectedValue(
        // The server's own message deliberately does NOT carry the secret; the client would
        // be the one to leak it, by echoing a form value into a reason.
        new ConnectorApiError("refused", 400, "address_not_public"),
      ),
      onCheck: vi.fn().mockResolvedValue(
        makeCheckResult({
          ok: false,
          verdict: "failed",
          bucket: "rejected",
          provider_message: "535 5.7.8 Authentication credentials invalid",
        }),
      ),
    })

    // Put a real secret into the form, the way a person would.
    await user.click(screen.getByTestId("connection-secret-replace"))
    await user.type(screen.getByLabelText("App password"), SENTINEL_SECRET)

    // POSITIVE CONTROL FIRST — prove the sweep would find the sentinel if it were there.
    const decoy = document.createElement("span")
    decoy.setAttribute("data-decoy", SENTINEL_SECRET)
    container.appendChild(decoy)
    expect(leaks(container, SENTINEL_SECRET)).toBe(true)
    decoy.remove()
    expect(leaks(container, SENTINEL_SECRET)).toBe(false)

    // Now drive BOTH failure surfaces and sweep after each.
    await runCheck(user)
    await waitFor(() => expect(screen.getByTestId("connection-check-outcome")).toBeInTheDocument())
    expect(leaks(container, SENTINEL_SECRET)).toBe(false)
    expect(
      (screen.getByTestId("connection-check-outcome").innerHTML ?? "").includes(SENTINEL_SECRET),
    ).toBe(false)

    await user.click(screen.getByTestId("connection-form-save"))
    await waitFor(() => expect(screen.getByTestId("connection-save-refusal")).toBeInTheDocument())
    expect(leaks(container, SENTINEL_SECRET)).toBe(false)
    expect(
      (screen.getByTestId("connection-save-refusal").innerHTML ?? "").includes(SENTINEL_SECRET),
    ).toBe(false)

    // …and still no `title` anywhere, which is where a "helpful" tooltip would have put it.
    expect(container.querySelectorAll("[title]")).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 19 · §4a-2 — THE BANNED-VOCABULARY FENCE, over the copy module's EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("§4a-2 — the audience is an org admin, not an engineer reading a threat model", () => {
  it("no string this module can produce carries any of the nine banned terms", () => {
    const all = stringsOfModule()
    expect(all.length).toBeGreaterThan(25)

    for (const term of BANNED_VOCABULARY) {
      const offenders = all.filter((s) => s.toLowerCase().includes(term.toLowerCase()))
      expect(offenders).toEqual([])
    }

    // POSITIVE CONTROL — the fence sees a banned term when one is present.
    const planted = [...all, "the destination fell inside an RFC1918 CIDR block"]
    expect(
      planted.filter((s) => s.toLowerCase().includes("rfc1918")),
    ).toHaveLength(1)

    // And the register it DOES use is sketch 156's — measured, not assumed.
    expect(REFUSAL_REASON_BODIES.address_not_public(SAMPLE_PARTS)).toContain(
      "a private address inside the network this platform runs on",
    )
  })

  it("`host_not_allowed` names no permitted-host list of its own — §4c forbids re-typing one", () => {
    // ⚠ A HOST THAT DOES NOT ITSELF CONTAIN THE SUFFIX. The obvious spelling here is the
    // label-boundary CVE host `evilatlassian.net` (`egress.py:280` — the leading dot IS the
    // whole mechanism), but it CONTAINS `atlassian.net`, so the absence assertion below would
    // have failed on the fixture rather than on the property. Measured, not predicted: it did.
    const withoutAllowed = REFUSAL_REASON_BODIES.host_not_allowed({
      host: "tickets.northwind.example",
      vendor: vendorOf("create_ticket"),
      capabilityWord: capabilityWordOf("create_ticket"),
    })
    expect(withoutAllowed).toContain("Jira")
    expect(withoutAllowed).toContain("ticket")
    // The client holds no copy of the guard's own list…
    expect(withoutAllowed).not.toContain("atlassian.net")
    expect(withoutAllowed).not.toContain("slack.com")
    // …and §4c's literal wording renders the moment the server supplies one.
    expect(
      REFUSAL_REASON_BODIES.host_not_allowed({ ...SAMPLE_PARTS, host: "evilatlassian.net" }),
    ).toBe("evilatlassian.net is not a Jira address. A email connection may only send to atlassian.net.")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 20 · §2g — THE GRADED DESTRUCTIVE GUARDS, and the receipt vocabulary
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("§2g — graded by consequence, and every write lands as a receipt", () => {
  it("DELETE always takes the victim-naming sheet, and the victim is named in the BUTTON label", async () => {
    const user = userEvent.setup({ delay: null })
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const onClose = vi.fn()
    renderEditable({ onDelete, onClose, usedBy: 0 })

    // Not a direct flip, even at zero victims: the credential it destroys is unrecoverable.
    await user.click(screen.getByRole("button", { name: CONNECTIONS_ACTION_DELETE }))
    expect(onDelete).not.toHaveBeenCalled()
    expect(screen.getByTestId("connection-panel-delete-body")).toHaveTextContent(deleteSheetBody(0))

    await user.click(screen.getByRole("button", { name: deleteConfirmLabel("Ops mailbox") }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1))
    // The panel closes: a form over a row that no longer exists is a form over nothing.
    expect(onClose).toHaveBeenCalled()
  })

  it("DISABLE is graded honestly — a sheet when victims exist, a direct flip when none do", async () => {
    const user = userEvent.setup({ delay: null })
    const withVictims = vi.fn().mockResolvedValue(undefined)
    renderEditable({ onSetEnabled: withVictims, usedBy: 3 })

    await user.click(screen.getByRole("button", { name: CONNECTIONS_ACTION_DISABLE }))
    expect(withVictims).not.toHaveBeenCalled()
    expect(screen.getByTestId("connection-panel-disable-body")).toHaveTextContent(disableSheetBody(3))
    await user.click(screen.getByTestId("connection-panel-confirm-disable"))
    await waitFor(() => expect(withVictims).toHaveBeenCalledWith(expect.anything(), false))
    cleanup()

    const noVictims = vi.fn().mockResolvedValue(undefined)
    renderEditable({ onSetEnabled: noVictims, usedBy: 0 })
    await user.click(screen.getByRole("button", { name: CONNECTIONS_ACTION_DISABLE }))
    // DIRECT — no sheet at all when there is no victim to name.
    await waitFor(() => expect(noVictims).toHaveBeenCalledWith(expect.anything(), false))
    expect(screen.queryByTestId("connection-panel-confirm-disable")).not.toBeInTheDocument()
  })

  it("ENABLE flips direct — the restorative asymmetry 068-A ships", async () => {
    const user = userEvent.setup({ delay: null })
    const onSetEnabled = vi.fn().mockResolvedValue(undefined)
    renderEditable({ connection: makeConnection({ is_enabled: false }), onSetEnabled, usedBy: 9 })

    await user.click(screen.getByTestId("connection-panel-enable"))
    await waitFor(() => expect(onSetEnabled).toHaveBeenCalledWith(expect.anything(), true))
    expect(screen.queryByTestId("connection-panel-confirm-disable")).not.toBeInTheDocument()
  })

  it("every write lands as `✎ {verb} · recorded` — a receipt in a live region, not a transient pop-up", async () => {
    const user = userEvent.setup({ delay: null })
    renderEditable({ usedBy: 0 })

    await user.click(screen.getByRole("button", { name: CONNECTIONS_ACTION_DISABLE }))
    const receipt = await screen.findByTestId("connection-panel-receipt")
    expect(receipt).toHaveTextContent(RECEIPT_DISABLED)
    expect(receipt).toHaveAttribute("role", "status")
    // consequence ≠ receipt: the receipt lives INSIDE the panel, not in a portal, and the
    // persistent state chip that is the CONSEQUENCE lives on the table row.
    expect(screen.getByTestId("connection-form-panel")).toContainElement(receipt)
    expect(RECEIPT_DELETED).toMatch(/^✎ .+ · recorded$/)
  })

  it("REPLACE stays direct, and SAYS it clears the verdict — because the server does exactly that", async () => {
    const user = userEvent.setup({ delay: null })
    renderEditable()
    await user.click(screen.getByTestId("connection-secret-replace"))
    // No sheet: reversible by replacing again, and there is no victim.
    expect(screen.queryByTestId("connection-panel-confirm-delete")).not.toBeInTheDocument()
    expect(screen.getByText(/clears the last credential check/i)).toBeInTheDocument()
  })

  it("all three guards are REMOVED — not disabled — while the kill-switch is off", () => {
    const { container } = renderEditable({ liveConnectorsOn: false })
    expect(screen.queryByTestId("connection-panel-delete")).not.toBeInTheDocument()
    expect(screen.queryByTestId("connection-panel-disable")).not.toBeInTheDocument()
    expect(screen.queryByTestId("connection-check-button")).not.toBeInTheDocument()
    // ⚠ ABSENCE, not `toBeDisabled()` — 190-16's plant C shipped the exact defect a disabled
    // assertion PASSES on.
    expect(container.querySelectorAll("[disabled]")).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 21 · §9 — the OFF notice and its corrected footer, re-asserted from the panel's own render
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("§9's panel notice, alongside the 190-18 surfaces", () => {
  it("the notice renders and its footer reads `read-only · will not send`, never `will save`", () => {
    renderEditable({ liveConnectorsOn: false })
    expect(screen.getByText(PANEL_OFF_HEADING)).toBeInTheDocument()
    expect(screen.getByText(PANEL_OFF_BODY)).toBeInTheDocument()
    const footer = screen.getByTestId("connection-form-off-footer")
    expect(footer.textContent).toBe(PANEL_OFF_FOOTER)
    expect(PANEL_OFF_FOOTER).toBe("read-only · will not send")
    expect(screen.getByTestId("connection-form-panel").textContent ?? "").not.toContain(
      "will save · will not send",
    )
  })

  it("the panel authors NO sentence of its own — every refusal identifier is imported", () => {
    // The `REFUSAL_` / `CHECK_` / `CIPHER_UNAVAILABLE` identifiers are the mechanism, and a
    // source fence is the only thing that can see an inline literal that happens to match.
    expect(panelSource).toContain('from "@/components/settings/connectionRefusalCopy"')
    for (const phrase of ABSOLUTE_VERB_FENCE) {
      expect(panelSource.toLowerCase()).not.toContain(phrase)
    }
    // Positive control: the fence can see a phrase in this source at all.
    expect(panelSource).toContain("connectionFormCopy")
  })
})
