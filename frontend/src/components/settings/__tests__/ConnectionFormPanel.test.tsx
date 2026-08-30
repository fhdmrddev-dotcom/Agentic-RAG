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
  FIELD_COUNTS,
  FIELD_SLACK_CHANNEL_HELP,
  FIELD_SMTP_HOST_HELP,
  FOOTER_NOTHING_YET,
  FOOTER_TAG_FIXED,
  FOOTER_TAG_IMPLICIT_TLS,
  FOOTER_TAG_REFUSED,
  FOOTER_TAG_STARTTLS,
  FOOTER_TAG_TLS,
  PANEL_NON_ADMIN_NOTE,
  PANEL_OFF_BODY,
  PANEL_OFF_FOOTER,
  PANEL_OFF_HEADING,
  PANEL_SAVE_CREATE,
  PANEL_SAVE_EDIT,
  SECRET_DOTS,
  SECRET_REPLACE_LABEL,
  SECRET_STORED_NOTE,
  SERVICE_LABEL,
  SERVICE_LOCKED_NOTE,
  SLACK_ENDPOINT,
  destinationFooterOf,
  orgSharedLine,
  refusalOf,
  tlsModeOf,
  EMPTY_DRAFT,
  type ConnectionDraft,
} from "../connectionFormCopy"
// ⚠ ALSO AS A NAMESPACE, and the reason is recorded in section 22's banner: 206.1's new
// identifiers are reached through `FORM_COPY.*` so that a RED commit fails on each new
// claim rather than on a whole-file load error. It is ALSO what section 24's extended
// string sweep walks — `stringsOfModule()` walks `connectionRefusalCopy` ONLY.
import * as FORM_COPY from "../connectionFormCopy"
import * as CONNECTIONS_COPY from "../connectionsCopy"
import * as REFUSAL_COPY from "../connectionRefusalCopy"
import { GRANTS_COPY } from "../grantsVocabulary"
import { connectionMark } from "@/lib/connectionMark"
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
import * as api from "@/lib/api"
import { ConnectorApiError } from "@/lib/api"
import type {
  ConnectorCapability,
  ConnectorCheckResult,
  ConnectorConnection,
  ConnectorConnectionCreate,
} from "@/lib/api"

// ── Fixtures ─────────────────────────────────────────────────────────────────────────

const SENTINEL_SECRET = "xoxb-SENTINEL-CREDENTIAL-MUST-NEVER-REACH-THE-DOM-190-17"

function makeConnection(overrides: Partial<ConnectorConnection> = {}): ConnectorConnection {
  return {
    id: "conn-1",
    org_id: "org-1",
    capability: "send_email",
    // ⚠ REQUIRED since 211-02 — migration 127 guarantees a non-blank identity on every
    // row, so a fixture without one models a row the server cannot produce.
    service_id: "smtp",
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

/**
 * ⭐ THE ONE WAY THIS SUITE REACHES A SHAPE IN CREATE MODE (Phase 211 / SC#1).
 *
 * The three-verb chooser is GONE FROM THE SOURCE — not hidden — so every case that used to
 * `selectOptions` a capability now types the SERVICE whose field set it wants. The identity
 * is what the person supplies; the field set follows from it, through `SERVICE_TO_SHAPE`.
 */
async function chooseService(
  user: ReturnType<typeof userEvent.setup>,
  serviceId: string,
) {
  const field = screen.getByLabelText(SERVICE_LABEL)
  await user.clear(field)
  await user.type(field, serviceId)
}

/** The identity that resolves to each shipped capability's field set. Data, not a branch —
 *  it mirrors `SERVICE_TO_SHAPE` and migration 127's own backfill. */
const SERVICE_FOR_CAPABILITY: Record<ConnectorCapability, string> = {
  send_email: "smtp",
  create_ticket: "jira",
  post_message: "slack",
}

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

/**
 * ⚠ THE TRAP'S OWN DEFINITION OF FOCUSABLE, MIRRORED RATHER THAN APPROXIMATED.
 *
 * `focusablesIn` (`ConnectionFormPanel.tsx`) excludes `[disabled]` and `aria-hidden` nodes.
 * This helper used to spell a looser selector, which was harmless only while no DISABLED
 * control could be last in DOM order. Phase 211 made one possible — Save is off on a create
 * form that has not named a service yet — and the looser list then ended on a node the trap
 * correctly skips, so the case failed for a reason it is not about. Mirroring the shipped
 * selector is what keeps this assertion measuring the CONTRACT rather than a coincidence.
 */
function focusablesOf(root: HTMLElement): HTMLElement[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    '[tabindex]:not([tabindex="-1"])',
  ].join(",")
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (node) => node.getAttribute("aria-hidden") !== "true",
  )
}

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
    const focusables = focusablesOf(panel)
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
    const focusables = focusablesOf(panel)

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
    // ⚠ 211 — a create form saves once it has BOTH facts. Save is off before that, which is
    // the point of the new reason node; this case is about the focus restore, so it supplies
    // them rather than asserting the refusal a dedicated case already owns.
    await chooseService(user, "my_custom_wiki")
    await user.type(screen.getByLabelText("Name"), "The team wiki")
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

    // ⚠ THE HANDLE MOVED IN 206.1-02, THE CLAIM DID NOT — and the difference matters.
    // This case reads "the list is still there and was not scrimmed away" (D-27, the whole
    // reason 156-A beat a dialog). It used to reach for `connections-header` as its handle
    // on "the table". That header is now deliberately ABSENT whenever the panel is open:
    // D-206.1-20 drops the five-word column header in the dense shape, because stacked
    // cells form no columns for a header to head — and this is the ONLY shipped case in the
    // settings suites that renders with `panel`, i.e. the only one that reaches the dense
    // shape at all. So the handle is re-pointed to the ROW, which is present in BOTH shapes
    // by D-206.1-13 and is a strictly better handle for a claim about "the list".
    // ⚠ This is NOT a re-baselined pin: not one assertion below changed, and the header's
    // absence is asserted POSITIVELY here rather than quietly lost, so this case now
    // documents the interaction instead of stopping at a missing node.
    expect(screen.queryByTestId("connections-header")).toBeNull()
    const rows = screen.getAllByTestId("connections-row")
    expect(rows).toHaveLength(1)
    expect(rows[0]).toBeInTheDocument()
    expect(rows[0].getAttribute("data-dense")).toBe("true")
    // A dialog would have scrimmed it away. Walk UP from the list: nothing between it and
    // the document may be `aria-hidden`, which is what a portal-backed modal would set.
    for (let node: HTMLElement | null = rows[0]; node; node = node.parentElement) {
      expect(node.getAttribute("aria-hidden")).not.toBe("true")
    }
    // And the track really is the clamp(480px, 38%, 640px) split, not a full-width takeover.
    expect(screen.getByTestId("connections-split").style.gridTemplateColumns).toContain("clamp(480px, 38%, 640px)")
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
    // No split track beside a 375px viewport — that is the horizontal overflow, expressed
    // as the thing that would CAUSE it rather than as a geometry jsdom cannot measure.
    expect(screen.getByTestId("connections-split").style.gridTemplateColumns).not.toContain("clamp")
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
    await chooseService(user, SERVICE_FOR_CAPABILITY[capability])

    expect(screen.getAllByTestId("connection-field")).toHaveLength(FIELD_COUNTS[capability])
  })

  it("⭐ SC#1 — the three-verb chooser is ABSENT from the create flow, for every audience", () => {
    // ⚠ ABSENCE OF THE CONTROL, asserted for each audience the suite parametrises. The
    // source fence in section 25 is the other half: this one proves it does not RENDER,
    // that one proves the panel no longer SPELLS it.
    for (const props of [
      {},
      { isOrgAdmin: false },
      { liveConnectorsOn: false },
    ] as Array<Partial<React.ComponentProps<typeof ConnectionFormPanel>>>) {
      renderPanel(props)
      expect(screen.queryByTestId("connection-capability-chooser")).toBeNull()
      expect(screen.queryByLabelText("What this connection does")).toBeNull()
      cleanup()
    }
  })

  it("⭐ SC#1 — the create flow's FIRST question is which service, and it is bound to the draft", async () => {
    const user = userEvent.setup({ delay: null })
    renderPanel()
    const block = screen.getByTestId("connection-service-field")
    expect(block).toBeInTheDocument()

    const input = screen.getByLabelText(SERVICE_LABEL) as HTMLInputElement
    expect(block).toContainElement(input)
    await user.type(input, "notion")
    // BOUND, not merely present: the value the person typed is the value the control holds.
    expect(input.value).toBe("notion")
  })

  it("⭐ CONN-08 — a service NOBODY here has heard of binds Name and the Service, and nothing else", async () => {
    const user = userEvent.setup({ delay: null })
    renderPanel()
    await chooseService(user, "a-service-nobody-here-has-heard-of")

    // The service shape's bound count, read from the module rather than retyped.
    expect(screen.getAllByTestId("connection-field")).toHaveLength(FIELD_COUNTS.service)
    // ⚠ NO CREDENTIAL FIELD. An identified row with no reachable path has nothing to
    // authenticate with until OAuth lands — offering a password box would be a lie.
    expect(screen.queryByLabelText("App password")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Bot token")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("API token")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("SMTP host and port")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Jira site")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Channel")).not.toBeInTheDocument()
  })

  it("⭐ D-5 — curated Popular MCP services (github, notion) reveal MCP URL and Access token fields", async () => {
    const user = userEvent.setup({ delay: null })
    for (const serviceId of ["github", "notion"]) {
      renderPanel()
      await chooseService(user, serviceId)

      expect(screen.getByLabelText("MCP server URL")).toBeInTheDocument()
      expect(screen.getByTestId("connection-probe-mcp-btn")).toBeInTheDocument()
      expect(screen.getByLabelText("Access token")).toBeInTheDocument()
      expect(screen.getAllByTestId("connection-field")).toHaveLength(FIELD_COUNTS.mcp)
      cleanup()
    }
  })

  it("⭐ D-215 — curated OAuth services (google) reveal OAuth authorization card", async () => {
    const user = userEvent.setup({ delay: null })
    renderPanel()
    await chooseService(user, "google")

    expect(screen.getByText(/OAuth 2\.0 Authorization/i)).toBeInTheDocument()
    expect(screen.getByTestId("connection-oauth-authorize-btn")).toBeInTheDocument()
    expect(screen.getByText(/Connect with Google Workspace/i)).toBeInTheDocument()
    cleanup()
  })

  it("⭐ D-5's NEGATIVE CONTROL — an UNCURATED identity still binds the service shape, so the catalog did not swallow CONN-08", async () => {
    // ⚠ THIS CASE IS THE ONE THAT COULD HAVE BEEN GOT WRONG. `getServiceCatalogEntry` is TOTAL
    // and synthesizes a fallback entry carrying `markKey: "mcp"`, so a shape derivation keyed
    // on IT would turn every unknown `service_id` into an MCP row and delete the service-only
    // shape outright. Without this control, that regression passes every other case in the file.
    const user = userEvent.setup({ delay: null })
    renderPanel()
    await chooseService(user, "a-service-nobody-here-has-heard-of")

    expect(screen.getAllByTestId("connection-field")).toHaveLength(FIELD_COUNTS.service)
    expect(screen.queryByLabelText("MCP server URL")).not.toBeInTheDocument()
    expect(screen.queryByTestId("connection-probe-mcp-btn")).not.toBeInTheDocument()
  })

  it("⭐ D-5 — the three ADAPTER-BACKED identities are NOT swept into the MCP shape by the catalog arm", async () => {
    // `slack`, `jira` and `smtp` are catalog entries too. They must keep their capability field
    // sets — an adapter-backed row silently becoming an MCP row is a credential pointed at the
    // wrong wire, which is why `SERVICE_TO_SHAPE` is read BEFORE the catalog.
    const user = userEvent.setup({ delay: null })
    for (const [serviceId, shape] of [
      ["slack", "post_message"],
      ["jira", "create_ticket"],
      ["smtp", "send_email"],
    ] as const) {
      renderPanel()
      await chooseService(user, serviceId)
      expect(screen.getAllByTestId("connection-field")).toHaveLength(FIELD_COUNTS[shape])
      expect(screen.queryByLabelText("MCP server URL")).not.toBeInTheDocument()
      cleanup()
    }
  })

  it("⚠ the suggestion list is a SUGGESTION — its options are a `<datalist>`, never a closed control", () => {
    const { container } = renderPanel()
    const input = screen.getByLabelText(SERVICE_LABEL) as HTMLInputElement
    // A `<select>` here would make the curated set a CONSTRAINT, which is the exact defect
    // D-211-01 rejected: every unknown service invisible or squeezed into a known name.
    expect(input.tagName).toBe("INPUT")
    const listId = input.getAttribute("list")
    expect(listId).toBeTruthy()
    const list = container.querySelector(`#${CSS.escape(listId!)}`)
    expect(list).not.toBeNull()
    expect(list!.tagName).toBe("DATALIST")
    expect(list!.querySelectorAll("option").length).toBe(FORM_COPY.SERVICE_SUGGESTIONS.length)
  })

  it("Slack says OUT LOUD that it has nothing to type, verbatim (D-02 told to the person)", async () => {
    const user = userEvent.setup({ delay: null })
    renderPanel()
    await chooseService(user, "slack")

    expect(screen.getByText(FIELD_SLACK_CHANNEL_HELP)).toBeInTheDocument()
    expect(FIELD_SLACK_CHANNEL_HELP).toContain(
      "it cannot be pointed anywhere else, by you or by a workflow",
    )
    // …and there is no URL / host / webhook field to point anywhere (§3b: "and NOTHING else").
    expect(screen.queryByLabelText("Jira site")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("SMTP host and port")).not.toBeInTheDocument()
  })

  it("SMTP states the plaintext refusal BEFORE a person can trip it, verbatim", async () => {
    const user = userEvent.setup({ delay: null })
    renderPanel()
    await chooseService(user, "smtp")
    expect(screen.getByText(FIELD_SMTP_HOST_HELP)).toBeInTheDocument()
    expect(FIELD_SMTP_HOST_HELP).toContain(
      "Plain smtp:// is refused, including for addresses inside this network.",
    )
  })

  it("on EDIT the SERVICE is static text with a stated reason — never a control", () => {
    renderPanel({ mode: "edit", connection: makeConnection() })
    expect(screen.queryByLabelText(SERVICE_LABEL)).not.toBeInTheDocument()
    const staticBlock = screen.getByTestId("connection-capability-static")
    expect(staticBlock).toBeInTheDocument()
    // ⚠ It READS the identity and does not offer to change it: editing identity is CONN-07
    // and Phase 212 owns it — 211-02 deliberately left `ConnectorConnectionUpdate` without
    // the field, so a control here would compose a body the model discards.
    expect(staticBlock).toHaveTextContent(FORM_COPY.serviceLabelOf("smtp"))
    expect(screen.getByText(SERVICE_LOCKED_NOTE)).toBeInTheDocument()
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
    await chooseService(user, "smtp")

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
    await chooseService(user, "smtp")
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
    await chooseService(user, "slack")

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

// ═══════════════════════════════════════════════════════════════════════════════════════
// 22 · ⭐ THE MCP SHAPE, IN THE COPY LAYER (206.1 item 1 — D-206.1-03 / -04 / -22, SC#4)
//
// Phase 206 shipped a complete MCP connector path — client, SSRF defense, discovery,
// per-tool grants, executor dispatch, audit — and shipped NO DOOR ONTO IT. This section is
// the copy layer's half of that door, plus the live edit-mode defect research found while
// measuring it.
//
// ⚠ THE NEW IDENTIFIERS ARE REACHED THROUGH THE MODULE NAMESPACE (`FORM_COPY.*`), NOT BY
// NAMED IMPORT, and that is deliberate rather than stylistic: a named import of an export
// that does not exist yet reddens the WHOLE FILE as a load failure, which would have made
// this plan's RED commit report 63 shipped cases failing for a reason none of them is
// about. Through the namespace each new claim fails on its own sentence, which is what a
// RED is for. The named-import block above is left exactly as the shipped cases need it.
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * A draft in an arbitrary shape.
 *
 * ⚠ CAST THROUGH `unknown` ON PURPOSE. At RED `ConnectionDraft.capability` is
 * `ConnectorCapability` and carries no `mcpServerUrl`, so a fixture spelled in the obvious
 * way would add `tsc` errors to the baseline this phase measures every plan against — plan
 * 02 recorded paying exactly that cost for one commit (its deviation 3), and it is avoidable.
 * The cast survives GREEN unchanged, so nothing here is re-typed once the type widens.
 */
function draftOfShape(capability: string, over: Record<string, unknown> = {}): ConnectionDraft {
  return {
    ...EMPTY_DRAFT,
    capability,
    mcpServerUrl: "",
    serviceId: "",
    ...over,
  } as unknown as ConnectionDraft
}

/**
 * ⚠ THE SYNTHETIC FIFTH SHAPE — the negative control all four positional ladders are armed
 * against (SC#4, deliberately extended past its own wording).
 *
 * A ladder whose LAST ARM IS ALSO ITS FALLBACK answers an unknown shape with Slack's facts.
 * That is not hypothetical: it shipped in `destinationFactsOf`, and on 2026-08-25 a live UAT
 * screen showed a connection pointed at an MCP server describing itself as sending to
 * Slack's API host. This is `runFacts.test.ts:168-213`'s three-part shape — near-miss values,
 * the prototype-key set, and an explicit POSITIVE CONTROL beside each.
 */
const SYNTHETIC_SHAPES = [
  "not_a_capability",
  // Near-misses: one character away from a real member, which is how a `startsWith` or a
  // truthiness test would let one through while an equality arm does not.
  "send_emails",
  "mcp_server",
  "MCP",
  "",
] as const

/** Inherited keys are never own properties, but they ARE truthy on a bracket read — the
 *  `modelFitness.ts` / `toolNames.ts` finding, applied to a ladder rather than to a map. */
const PROTOTYPE_KEYS = [
  "constructor",
  "toString",
  "__proto__",
  "hasOwnProperty",
  "valueOf",
] as const

const ACCEPTED_MCP_URL = "https://mcp.deepwiki.com/mcp"

/**
 * ⚠ THE RETIRED CHOOSER CONSTANT'S NAME, COMPOSED FROM FRAGMENTS AND NEVER SPELLED.
 *
 * Two fences below assert this identifier is absent — from the copy module's exports, and
 * from the panel's source. The acceptance check for the same property is a `grep -r` over
 * `frontend/src`, and a fence that spells its own needle is a fence that makes that count
 * lie. This is `ownProperty.ts`'s recorded discipline ("both identifiers are left unspelled
 * in this paragraph on purpose"), applied to a deletion instead of to a guard.
 */
const RETIRED_CHOOSER_CONSTANT = ["CAPABILITY", "CHOICES"].join("_")

describe("211 · the service lookup replaces the chooser data (SC#1 / D-211-01 / D-211-02)", () => {
  it("⭐ the three-verb option constant DOES NOT EXIST — the data is deleted, not hidden", () => {
    // SC#1 names this constant. Deleting the DATA is what makes the source fence below
    // meaningful: a hidden control is one prop away from coming back.
    expect(RETIRED_CHOOSER_CONSTANT in FORM_COPY).toBe(false)
    expect("capabilityLabelOf" in FORM_COPY).toBe(false)
    expect("CAPABILITY_CHOICE_MCP_LABEL" in FORM_COPY).toBe(false)
  })

  it("`SERVICE_SUGGESTIONS` covers migration 127's three backfilled identities plus a custom endpoint", () => {
    const ids = FORM_COPY.SERVICE_SUGGESTIONS.map((s) => s.service_id)
    for (const backfilled of ["slack", "jira", "smtp"]) {
      expect(ids).toContain(backfilled)
    }
    // The one entry that opens the endpoint field — the zero-engineering custom door.
    expect(ids).toContain("custom")
    // Every entry carries a human label, and no label is the raw identifier wearing a hat.
    for (const suggestion of FORM_COPY.SERVICE_SUGGESTIONS) {
      expect(suggestion.label.length).toBeGreaterThan(2)
      expect(suggestion.label).not.toBe(suggestion.service_id)
    }
  })

  it("⭐ `serviceLabelOf` degrades a MISS to the RAW IDENTIFIER — never a placeholder, never blank", () => {
    expect(FORM_COPY.serviceLabelOf("slack")).toBe(
      FORM_COPY.SERVICE_SUGGESTIONS.find((s) => s.service_id === "slack")!.label,
    )
    // Catalog services return their human labels
    expect(FORM_COPY.serviceLabelOf("notion")).toBe("Notion")
    expect(FORM_COPY.serviceLabelOf("github")).toBe("GitHub")
    // D-211-02: a miss degrades. It is a SUGGESTION list, so an unknown identity reads back
    // as itself rather than as "unknown", and never as a refusal.
    expect(FORM_COPY.serviceLabelOf("a-service-nobody-here-has-heard-of")).toBe(
      "a-service-nobody-here-has-heard-of",
    )
  })

  it("⚠ `shapeForService` is TOTAL — catalog MCP services resolve to mcp, an unknown identity and PROTOTYPE keys resolve to service", () => {
    expect(FORM_COPY.shapeForService("smtp", "")).toBe("send_email")
    expect(FORM_COPY.shapeForService("jira", "")).toBe("create_ticket")
    expect(FORM_COPY.shapeForService("slack", "")).toBe("post_message")
    expect(FORM_COPY.shapeForService("custom", "")).toBe("mcp")
    expect(FORM_COPY.shapeForService("notion", "")).toBe("mcp")
    expect(FORM_COPY.shapeForService("github", "")).toBe("mcp")
    expect(FORM_COPY.shapeForService("a-service-nobody-here-has-heard-of", "")).toBe("service")
    expect(FORM_COPY.shapeForService("", "")).toBe("service")
    // ⚠ T-211-15a — an inherited key is TRUTHY on a bracket read and would hand back a
    // FUNCTION typed as `ConnectionShape`. The map must be read through `own(MAP, key)`.
    for (const key of PROTOTYPE_KEYS) {
      expect(FORM_COPY.shapeForService(key, "")).toBe("service")
    }
  })

  it("⚠ SEED-215 — a vendor's own LOGO does not change its WIRE. The two are separate facts.", () => {
    // THE REGRESSION THIS EXISTS FOR, and it is not hypothetical: it happened.
    // `shapeForService` arm 2 used to read `curated?.markKey === "mcp"`, which worked only
    // while every MCP-backed vendor happened to be drawing the generic MCP plug. Giving
    // `github`, `notion` and `google` their OWN marks — a purely visual change, in another
    // file — made all three miss that test and resolve to the `"service"` shape, whose field
    // set is Name and NOTHING ELSE. The panel opened with nowhere to type a URL or a token:
    // byte-for-byte Phase 212's D-5 defect, caused by a logo.
    //
    // The catalog now carries `shape` beside `markKey`, and this pins that they are read
    // independently. It fails the moment someone keys a wire off a picture again.
    for (const vendor of ["github", "notion", "figma", "linear", "sentry", "intercom", "miro"]) {
      expect(FORM_COPY.shapeForService(vendor, "")).toBe("mcp")
      expect(connectionMark({ service_id: vendor }).key).toBe(vendor)
    }
    for (const vendor of ["google", "microsoft"]) {
      expect(FORM_COPY.shapeForService(vendor, "")).toBe("oauth")
      expect(connectionMark({ service_id: vendor }).key).toBe(vendor)
    }
    // The adapter-backed three are untouched by any of it — arm 1 still answers first.
    expect(FORM_COPY.shapeForService("slack", "")).toBe("post_message")
    expect(connectionMark({ service_id: "slack" }).key).toBe("slack")
  })

  it("the ONE explicit override — an `https://` endpoint selects the remote-server shape", () => {
    expect(FORM_COPY.shapeForService("mcp.deepwiki.com", ACCEPTED_MCP_URL)).toBe("mcp")
    // And it is HTTPS-shaped, not merely non-empty: a plaintext address selects nothing.
    expect(FORM_COPY.shapeForService("a-service-nobody-here-has-heard-of", "http://mcp.example.com/mcp")).toBe("service")
  })

  it("`FIELD_COUNTS` is TOTAL over all SIX shapes and binds MCP at exactly 3", () => {
    expect(FORM_COPY.FIELD_COUNTS.mcp).toBe(3)
    for (const shape of ["send_email", "create_ticket", "post_message", "mcp", "service", "oauth"] as const) {
      expect(typeof FORM_COPY.FIELD_COUNTS[shape]).toBe("number")
    }
    expect(Object.keys(FORM_COPY.FIELD_COUNTS).sort()).toEqual([
      "create_ticket",
      "mcp",
      "oauth",
      "post_message",
      "send_email",
      "service",
    ])
  })

  it("⭐ `EMPTY_DRAFT` starts in the SERVICE shape — the create form has NO capability default", () => {
    expect((EMPTY_DRAFT as unknown as Record<string, unknown>).mcpServerUrl).toBe("")
    expect((EMPTY_DRAFT as unknown as Record<string, unknown>).serviceId).toBe("")
    // ⚠ IT USED TO BE `send_email`. A default is not a way through a gate: a form that
    // starts pointed at one of the three verbs is a form that can submit one nobody chose.
    expect(EMPTY_DRAFT.capability).toBe("service")
    expect(EMPTY_DRAFT.capability).not.toBe("send_email")
  })

  it("the validity arm — a service draft is savable on a name and an identity, with NO secret and NO config", () => {
    const named = draftOfShape("service", { name: "The team wiki", serviceId: "my_custom_wiki" })
    expect(FORM_COPY.draftIsSavable(named)).toBe(true)
    // …and it composed nothing to authenticate with, which is what makes that true.
    expect(FORM_COPY.configFromDraft(named)).toEqual({})
    expect(named.secret).toBe("")
    // Either half missing, and it is not savable — blank-but-present is what the server's
    // `btrim` refuses, so a whitespace identity must fail here too.
    expect(FORM_COPY.draftIsSavable(draftOfShape("service", { name: "x", serviceId: "" }))).toBe(false)
    expect(FORM_COPY.draftIsSavable(draftOfShape("service", { name: "", serviceId: "my_custom_wiki" }))).toBe(false)
    expect(FORM_COPY.draftIsSavable(draftOfShape("service", { name: "x", serviceId: "   " }))).toBe(false)
  })
})

describe("206.1 · LADDER 1 — `configFromDraft` names its arms (SC#4)", () => {
  it("an MCP draft composes EXACTLY one key — the key SET, not merely the shape", () => {
    const config = FORM_COPY.configFromDraft(
      draftOfShape("mcp", { mcpServerUrl: ACCEPTED_MCP_URL }),
    )
    // ⚠ KEY SET, ASSERTED. `McpConfig` is `extra="forbid"` with exactly one field, so a
    // second key is a 422 that no client-side type can see.
    expect(Object.keys(config as unknown as Record<string, unknown>).sort()).toEqual(["headers"])
    expect(config).toEqual({ headers: {} })
  })

  it("POSITIVE CONTROL — the three shipped capabilities still compose their own configs", () => {
    expect(FORM_COPY.configFromDraft(draftOfShape("post_message", { channel: "#ops" }))).toEqual({
      default_channel: "#ops",
    })
    expect(
      FORM_COPY.configFromDraft(
        draftOfShape("create_ticket", {
          baseUrl: "northwind.atlassian.net",
          projectKey: "NW",
          accountEmail: "ops@northwind.co",
        }),
      ),
    ).toEqual({
      base_url: "northwind.atlassian.net",
      project_key: "NW",
      account_email: "ops@northwind.co",
    })
    const email = FORM_COPY.configFromDraft(
      draftOfShape("send_email", {
        host: "smtp.fastmail.com",
        port: "465",
        fromAddress: "ops@northwind.co",
      }),
    ) as unknown as Record<string, unknown>
    expect(email.host).toBe("smtp.fastmail.com")
    expect(email.tls).toBe("implicit")
  })

  it("⚠ the SYNTHETIC FIFTH SHAPE gets a NEUTRAL config — never Slack's empty-channel one", () => {
    for (const shape of SYNTHETIC_SHAPES) {
      const config = FORM_COPY.configFromDraft(
        draftOfShape(shape, { channel: "#ops" }),
      ) as unknown as Record<string, unknown>
      // ⚠ THAT LITERAL IS THE LIVE 422. `default_channel` is `NonEmpty` at the model, so a
      // trailing positional arm turns an unrecognised shape into a refused save with a
      // generic failure sentence and no attributable cause.
      expect(config).not.toHaveProperty("default_channel")
      expect(config).not.toHaveProperty("host")
      expect(config).not.toHaveProperty("base_url")
    }
  })

  it("⭐ a `service` draft composes an EMPTY config and NO capability key (CONN-08 / D-211-02)", () => {
    const config = FORM_COPY.configFromDraft(
      draftOfShape("service", { serviceId: "my_custom_wiki", channel: "#ops", host: "smtp.fastmail.com" }),
    ) as unknown as Record<string, unknown>
    // ⚠ KEY SET. An identified row with no reachable path asserts NOTHING about a
    // destination — and it must not inherit a neighbouring shape's facts on the way out.
    expect(Object.keys(config)).toEqual([])
    expect(config).not.toHaveProperty("default_channel")
    expect(config).not.toHaveProperty("host")
    expect(config).not.toHaveProperty("headers")
  })

  it("⚠ a prototype key as the shape is ALSO neutral — an inherited key is truthy on a bracket read", () => {
    for (const key of PROTOTYPE_KEYS) {
      const config = FORM_COPY.configFromDraft(
        draftOfShape(key, { channel: "#ops" }),
      ) as unknown as Record<string, unknown>
      expect(config).not.toHaveProperty("default_channel")
    }
  })
})

describe("206.1 · LADDER 2 — `destinationFooterOf` names its arms (SC#4)", () => {
  it("an MCP draft with no URL yet still renders a footer — it degrades to a WORD", () => {
    const footer = FORM_COPY.destinationFooterOf(draftOfShape("mcp"))
    expect(footer.destination).toBe(FOOTER_NOTHING_YET)
    expect(footer.tags).toEqual([])
    expect(footer.refusedReason).toBeNull()
  })

  it("an accepted https address reads back as itself, tagged from the SHIPPED vocabulary", () => {
    const footer = FORM_COPY.destinationFooterOf(
      draftOfShape("mcp", { mcpServerUrl: ACCEPTED_MCP_URL }),
    )
    expect(footer.destination).toBe(ACCEPTED_MCP_URL)
    expect(footer.tags).toEqual([FOOTER_TAG_TLS])
    expect(footer.refusedReason).toBeNull()
    // No new footer tag was invented for this shape.
    expect(footer.tags.every((t) => [FOOTER_TAG_TLS, FOOTER_TAG_REFUSED].includes(t))).toBe(true)
  })

  it("a refused address carries the refused tag AND `refusalOf`'s OWN reason", () => {
    for (const url of [
      "http://mcp.example.com/mcp",
      "https://localhost/mcp",
      "https://192.168.1.9/mcp",
    ]) {
      const footer = FORM_COPY.destinationFooterOf(draftOfShape("mcp", { mcpServerUrl: url }))
      expect(footer.tags).toEqual([FOOTER_TAG_REFUSED])
      // ⚠ COMPARED AGAINST A DIRECT `refusalOf` CALL, never against a re-typed sentence: a
      // second URL validator on this surface is a SECOND ANSWER, and the two would drift.
      expect(footer.refusedReason).toBe(refusalOf(url))
      expect(footer.refusedReason).not.toBeNull()
    }
  })

  it("POSITIVE CONTROL — a `send_email` draft still gets the SMTP footer with its TLS-mode tag", () => {
    const footer = FORM_COPY.destinationFooterOf(
      draftOfShape("send_email", {
        host: "smtp.fastmail.com",
        port: "587",
        fromAddress: "ops@northwind.co",
      }),
    )
    expect(footer.destination).toBe("smtp.fastmail.com:587")
    expect(footer.tags).toEqual([FOOTER_TAG_STARTTLS])
    expect(footer.detail).toBe("· from ops@northwind.co")
  })

  it("a `service` draft's footer degrades to the WORD — it names no destination it does not have", () => {
    const footer = FORM_COPY.destinationFooterOf(
      draftOfShape("service", { serviceId: "my_custom_wiki", host: "smtp.fastmail.com", port: "465" }),
    )
    expect(footer.destination).toBe(FOOTER_NOTHING_YET)
    expect(footer.tags).toEqual([])
    expect(footer.detail).toBeNull()
    expect(footer.refusedReason).toBeNull()
  })

  it("⚠ the SYNTHETIC FIFTH SHAPE gets a NEUTRAL footer — not the SMTP one", () => {
    for (const shape of [...SYNTHETIC_SHAPES, ...PROTOTYPE_KEYS]) {
      const footer = FORM_COPY.destinationFooterOf(
        draftOfShape(shape, {
          host: "smtp.fastmail.com",
          port: "587",
          fromAddress: "ops@northwind.co",
        }),
      )
      expect(footer.destination).toBe(FOOTER_NOTHING_YET)
      expect(footer.tags).toEqual([])
      // ⚠ Today the trailing arm IS the SMTP arm, so an unknown shape claims a TLS mode and
      // names a `from` address it was never given.
      expect(footer.tags).not.toContain(FOOTER_TAG_STARTTLS)
      expect(footer.detail).toBeNull()
    }
  })
})

describe("206.1 · `draftFromConnection` — the EDIT shape (D-206.1-22, a live defect)", () => {
  /** An MCP row exactly as the server sends it: a URL, an `McpConfig`, and NO capability. */
  function mcpConnection(overrides: Partial<ConnectorConnection> = {}): ConnectorConnection {
    return makeConnection({
      capability: null,
      name: "DeepWiki",
      config: { headers: {} },
      mcp_server_url: ACCEPTED_MCP_URL,
      last_checked_at: null,
      last_check_verdict: "not_checked",
      ...overrides,
    })
  }

  it("an MCP row seeds the MCP shape and its own URL — today it seeds the SMTP form", () => {
    const draft = FORM_COPY.draftFromConnection(mcpConnection()) as unknown as Record<string, unknown>
    expect(draft.capability).toBe("mcp")
    expect(draft.mcpServerUrl).toBe(ACCEPTED_MCP_URL)
  })

  it("POSITIVE CONTROL — a `send_email` row still seeds `send_email` and its SMTP facts", () => {
    const draft = FORM_COPY.draftFromConnection(makeConnection())
    expect(draft.capability).toBe("send_email")
    expect(draft.host).toBe("smtp.fastmail.com")
    expect(draft.port).toBe("465")
  })

  it("⚠ ABSENCE ALONE IS NOT MCP — a capability-less row with NO url keeps the empty draft's default", () => {
    // D-206.1-11: absence read as a default is the defect, and detecting MCP from
    // `capability === null` would be the same mistake pointed the other way.
    const draft = FORM_COPY.draftFromConnection(
      makeConnection({ capability: null, mcp_server_url: null }),
    )
    expect(draft.capability).toBe(EMPTY_DRAFT.capability)
    expect(draft.capability).not.toBe("mcp")
  })

  it("⚠ a row carrying BOTH seeds MCP — the URL wins, because MCP is a SHAPE and not a capability", () => {
    const draft = FORM_COPY.draftFromConnection(
      mcpConnection({ capability: "send_email" }),
    ) as unknown as Record<string, unknown>
    expect(draft.capability).toBe("mcp")
    expect(draft.mcpServerUrl).toBe(ACCEPTED_MCP_URL)
  })

  it("an MCP draft still carries NO secret — there was never anything to copy", () => {
    expect(FORM_COPY.draftFromConnection(mcpConnection()).secret).toBe("")
  })

  it("⭐ 211 — the draft carries the ROW'S OWN service identity, verbatim", () => {
    const draft = FORM_COPY.draftFromConnection(
      makeConnection({ service_id: "smtp" }),
    ) as unknown as Record<string, unknown>
    expect(draft.serviceId).toBe("smtp")
    // ⚠ NOT DERIVED FROM THE URL. D-211-01 rejected URL-derived identity outright; a row
    // whose identity disagrees with its host still reads back its own stored value.
    const odd = FORM_COPY.draftFromConnection(
      mcpConnection({ service_id: "github" }),
    ) as unknown as Record<string, unknown>
    expect(odd.serviceId).toBe("github")
  })

  it("⚠ a capability-less row with NO url edits as the SERVICE shape — the third shape, read back", () => {
    const draft = FORM_COPY.draftFromConnection(
      makeConnection({ capability: null, mcp_server_url: null, service_id: "my_custom_wiki" }),
    )
    expect(draft.capability).toBe("service")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 23 · AR-05 — `no check for this kind` is a DIFFERENT FACT from `never checked`
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("206.1 · AR-05 — the credential reading for a row that can never be checked", () => {
  const CHECKED_AT = "2026-08-25T00:00:00Z"
  const NOW = Date.parse("2026-08-25T03:00:00Z")
  const MCP_URL = "https://mcp.deepwiki.com/mcp"

  it("an MCP row reads `no check for this kind`, and NOT `never checked`", () => {
    const reading = CONNECTIONS_COPY.credentialReadingOf(
      makeConnection({ capability: null, mcp_server_url: MCP_URL, last_checked_at: null }),
      NOW,
    )
    expect(reading).toBe(CONNECTIONS_COPY.CREDENTIAL_NO_CHECK_FOR_KIND)
    // ⚠ *nobody has checked it* and *it CANNOT be checked* are two different facts, and
    // folding them into one word is the `runFacts.ts` CR-01 / `DecisionsList` D-20 defect
    // for the fifth recorded time.
    expect(reading).not.toBe(CONNECTIONS_COPY.CREDENTIAL_NEVER_CHECKED)
  })

  it("⚠ and it reads so UNCONDITIONALLY — a stale timestamp on an MCP row is not a check", () => {
    expect(
      CONNECTIONS_COPY.credentialReadingOf(
        makeConnection({
          capability: null,
          mcp_server_url: MCP_URL,
          last_checked_at: CHECKED_AT,
        }),
        NOW,
      ),
    ).toBe(CONNECTIONS_COPY.CREDENTIAL_NO_CHECK_FOR_KIND)
  })

  it("POSITIVE CONTROL — a capability row's reading is byte-identical to the shipped one", () => {
    const never = makeConnection({ last_checked_at: null })
    expect(CONNECTIONS_COPY.credentialReadingOf(never, NOW)).toBe("never checked")
    const checked = makeConnection({ last_checked_at: CHECKED_AT })
    expect(CONNECTIONS_COPY.credentialReadingOf(checked, NOW)).toMatch(/^checked /)
    // ⚠ EQUAL TO `credentialLabel`'s OWN OUTPUT, so the new function is a router and not a
    // second implementation — this is what keeps every pinned unit call on `credentialLabel`
    // and the wide row's byte-identity capture intact.
    expect(CONNECTIONS_COPY.credentialReadingOf(checked, NOW)).toBe(
      CONNECTIONS_COPY.credentialLabel(checked.last_checked_at, NOW),
    )
  })

  it("`credentialLabel` itself is untouched — its three shipped readings still hold", () => {
    expect(CONNECTIONS_COPY.credentialLabel(null, NOW)).toBe("never checked")
    expect(CONNECTIONS_COPY.credentialLabel(CHECKED_AT, NOW)).toBe("checked 3h ago")
    expect(CONNECTIONS_COPY.credentialLabel("not-a-date", NOW)).toBe("never checked")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 24 · ⚠ THE STRING SWEEP, EXTENDED TO `connectionFormCopy` — it was NEVER covered
//
// `stringsOfModule()` above walks `connectionRefusalCopy` ONLY. Measured: the nine-banned-
// terms fence (section 19) and the absolute-verb fence (section 16) therefore say NOTHING
// about `connectionFormCopy`'s strings, and never have. Item 1 adds seven of them. Rather
// than record them as unswept, the sweep is EXTENDED here — cheap, and the alternative is a
// SUMMARY sentence claiming coverage that does not exist.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Every string any export of `connectionFormCopy` can produce. Structural, so a NEW export
 *  is fenced the day it is added rather than the day someone remembers it. */
function stringsOfFormCopyModule(): string[] {
  const seen: string[] = []
  // Arguments broad enough to reach every signature this module actually declares: a draft,
  // a connection, an org name, and a timestamp. A function this does not fit throws and is
  // caught — the seven identifiers item 1 adds are named explicitly in the case below, so a
  // silently-skipped one leaves the fence red rather than green over nothing.
  const ARGS: unknown[] = [
    draftOfShape("mcp", { mcpServerUrl: ACCEPTED_MCP_URL }),
    makeConnection(),
    "Northwind",
    "2026-08-03T09:00:00Z",
  ]
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
      for (const arg of ARGS) {
        try {
          walk((value as (...args: unknown[]) => unknown)(arg), depth + 1)
        } catch {
          // A signature this walker does not fit.
        }
      }
      return
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach((v) => walk(v, depth + 1))
    }
  }
  walk(FORM_COPY, 0)
  return seen
}

describe("206.1 · the banned-term and absolute-verb fences, extended to the panel's copy module", () => {
  it("the sweep is NON-VACUOUS and reaches item 1's seven new strings by identity", () => {
    const all = stringsOfFormCopyModule()
    expect(all.length).toBeGreaterThan(40)
    // ⚠ NON-VACUITY FIRST. A walker that reached nothing would satisfy every absence claim
    // below forever — the `gutterTokens.fences.test.ts` lesson, one module over.
    for (const added of [
      FORM_COPY.SERVICE_CUSTOM_ENDPOINT_LABEL,
      FORM_COPY.SERVICE_LABEL,
      FORM_COPY.SERVICE_HELP,
      FORM_COPY.SERVICE_LOCKED_NOTE,
      FORM_COPY.FIELD_MCP_URL_LABEL,
      FORM_COPY.FIELD_MCP_URL_PLACEHOLDER,
      FORM_COPY.FIELD_MCP_URL_HELP,
      FORM_COPY.FIELD_MCP_SECRET_LABEL,
      FORM_COPY.FIELD_MCP_SECRET_OPTIONAL_NOTE,
      FORM_COPY.MCP_SAVE_DISABLED_REASON,
    ]) {
      expect(all).toContain(added)
    }
  })

  it("no string this module can produce carries any of the nine banned terms", () => {
    const all = stringsOfFormCopyModule()
    for (const term of BANNED_VOCABULARY) {
      expect(all.filter((s) => s.toLowerCase().includes(term.toLowerCase()))).toEqual([])
    }
    // POSITIVE CONTROL — the fence sees a banned term when one is present.
    expect(
      [...all, "refused: the address fell inside an RFC1918 range"].filter((s) =>
        s.toLowerCase().includes("rfc1918"),
      ),
    ).toHaveLength(1)
  })

  it("no string this module can produce carries one of the three absolutes", () => {
    const all = stringsOfFormCopyModule()
    for (const phrase of ABSOLUTE_VERB_FENCE) {
      expect(all.filter((s) => s.toLowerCase().includes(phrase))).toEqual([])
    }
  })

  it("⚠ `MCP_SAVE_DISABLED_REASON`'s SECOND CLAUSE is load-bearing and may not be trimmed", () => {
    // The panel's check is a COURTESY, never the security boundary: the model raises on a
    // non-HTTPS `mcp_server_url` and `validate_mcp_destination` refuses again at call time,
    // after the address resolves. This sentence is the ONLY place a person can see that.
    expect(FORM_COPY.MCP_SAVE_DISABLED_REASON).toContain("https://")
    expect(FORM_COPY.MCP_SAVE_DISABLED_REASON).toContain("the server refuses it again")
  })

  it("the optional-credential note is AFFIRMATIVE — D-206.1-06 forbids presenting absence as an error", () => {
    const note = FORM_COPY.FIELD_MCP_SECRET_OPTIONAL_NOTE
    expect(note).toContain("Optional")
    // No destructive tone and no warning register: an MCP server may legitimately ask for
    // no credential at all, and a form that treats that as a fault is telling a lie.
    for (const alarm of ["error", "invalid", "must", "required", "warning"]) {
      expect(note.toLowerCase()).not.toContain(alarm)
    }
  })

  it("the URL placeholder names a RESERVED example domain, never a live third party", () => {
    // A placeholder naming a real vendor's endpoint is an endorsement the form is not
    // entitled to make — and `example.com` is reserved by RFC 2606 for exactly this.
    expect(FORM_COPY.FIELD_MCP_URL_PLACEHOLDER).toContain("example.com")
    expect(FORM_COPY.FIELD_MCP_URL_PLACEHOLDER.startsWith("https://")).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 25 · ⭐ THE MCP SHAPE, IN THE PANEL (206.1 item 1 — the create door and the edit fix)
//
// Section 22 proved the copy layer. This one proves the SURFACE: a fourth option, exactly
// three fields, a create body whose key set the server will actually accept, a Save that
// refuses a plaintext address with a reason in real DOM text, and — the defect research found
// while measuring all of that — an EDIT path that renders the MCP shape instead of the SMTP
// form (D-206.1-22).
// ═══════════════════════════════════════════════════════════════════════════════════════

/** An MCP row as the server sends it: a URL, an `McpConfig`, and NO capability.
 *  ⚠ Its identity is the one migration 127 backfilled onto the live row — the HOST, derived
 *  ONCE at migration for rows that predate the column. Nothing downstream re-derives it. */
function makeMcpConnection(overrides: Partial<ConnectorConnection> = {}): ConnectorConnection {
  return makeConnection({
    id: "conn-mcp",
    capability: null,
    service_id: "mcp.deepwiki.com",
    name: "DeepWiki",
    config: { headers: {} },
    mcp_server_url: ACCEPTED_MCP_URL,
    last_checked_at: null,
    last_check_verdict: "not_checked",
    ...overrides,
  })
}

/**
 * ⚠ AN MCP ROW WHOSE CONFIG ALSO CARRIES AN SMTP HOST.
 *
 * The server could never send this (`McpConfig` is `extra="forbid"`), and that is exactly why
 * it is the right fixture for LADDER 3: `draftFromConnection` reads `host` off the config for
 * every shape, so this makes `draft.host` NON-EMPTY on an MCP draft. Without it, "typedHost is
 * not the SMTP host" would pass on an empty string and prove nothing.
 */
function makeMcpConnectionWithStrayHost(): ConnectorConnection {
  return makeMcpConnection({
    config: { headers: {}, host: "smtp.fastmail.com", port: 465 } as unknown as ConnectorConnection["config"],
  })
}

/**
 * ⚠ THE SYNTHETIC FIFTH SHAPE, REACHED THROUGH THE RENDER.
 *
 * `typedHost` and `secretLabel` live INSIDE the component, and the plan forbids widening the
 * module's export surface to make a test easier — so the only honest way in is a row whose
 * `capability` is a value the closed set will never hold. It carries a full SMTP config, so
 * every "not the SMTP one" assertion below is falsifiable rather than vacuous.
 */
function makeUnknownShapeConnection(): ConnectorConnection {
  return makeConnection({
    id: "conn-unknown",
    name: "Something new",
    capability: "not_a_capability" as unknown as ConnectorCapability,
    // ⚠ An identity the suggestion list does not hold, so every "not the SMTP one" assertion
    // below stays about the LADDER rather than about a lookup hit.
    service_id: "something-new",
    mcp_server_url: null,
  })
}

/** The custom-endpoint door: the one suggestion whose identity opens the endpoint field. */
async function chooseMcp(user: ReturnType<typeof userEvent.setup>) {
  await chooseService(user, "custom")
}

describe("211 · the custom-endpoint door and the three-field MCP block (SC#1a)", () => {
  it("naming the custom endpoint renders exactly `FIELD_COUNTS.mcp` fields — Name, the URL and the token", async () => {
    const user = userEvent.setup({ delay: null })
    renderPanel()
    await chooseMcp(user)

    expect(screen.getAllByTestId("connection-field")).toHaveLength(FORM_COPY.FIELD_COUNTS.mcp)
    expect(screen.getByLabelText(FORM_COPY.FIELD_MCP_URL_LABEL)).toBeInTheDocument()
    expect(screen.getByLabelText(FORM_COPY.FIELD_MCP_SECRET_LABEL)).toBeInTheDocument()
    expect(screen.getByText(FORM_COPY.FIELD_MCP_URL_HELP)).toBeInTheDocument()
  })

  it("the URL input is `font-mono` — a machine value — while its label and help are prose", async () => {
    const user = userEvent.setup({ delay: null })
    renderPanel()
    await chooseMcp(user)

    const input = screen.getByLabelText(FORM_COPY.FIELD_MCP_URL_LABEL)
    expect(input.className).toContain("font-mono")
    // ⚠ ONE INPUT, ONE COLUMN. The `1fr 92px` grid exists for host+port; an MCP URL has no
    // second part, and borrowing that shape would leave a 92px hole beside the field.
    expect(input.className).not.toContain("92px")
    expect(screen.getByText(FORM_COPY.FIELD_MCP_URL_HELP).className).not.toContain("font-mono")
  })

  it("⚠ the MCP block does NOT leak into the other three renders", async () => {
    const user = userEvent.setup({ delay: null })
    renderPanel()
    for (const capability of ["send_email", "create_ticket", "post_message"] as const) {
      await chooseService(user, SERVICE_FOR_CAPABILITY[capability])
      expect(screen.queryByLabelText(FORM_COPY.FIELD_MCP_URL_LABEL)).not.toBeInTheDocument()
      expect(screen.getAllByTestId("connection-field")).toHaveLength(FIELD_COUNTS[capability])
    }
  })

  it("…and the other three blocks do not leak into the MCP render", async () => {
    const user = userEvent.setup({ delay: null })
    renderPanel()
    await chooseMcp(user)

    // The two labels the shipped case at section 5 asserts absent — the collision the MCP
    // label was deliberately chosen to avoid.
    expect(screen.queryByLabelText("Jira site")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("SMTP host and port")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Channel")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Send from")).not.toBeInTheDocument()
  })

  it("the optional-credential note renders BESIDE the encryption promise, never instead of it", async () => {
    const user = userEvent.setup({ delay: null })
    renderPanel()
    await chooseMcp(user)

    // D-206.1-06: the credential is optional for this shape and only for it — but the
    // encryption promise is told for EVERY kind, so both sentences are present.
    expect(screen.getByText(FORM_COPY.FIELD_MCP_SECRET_OPTIONAL_NOTE)).toBeInTheDocument()
    expect(screen.getByTestId("connection-secret-create-help")).toHaveTextContent(
      "Encrypted before it touches the database",
    )
  })

  it("POSITIVE CONTROL — the note is absent for a capability shape, which still REQUIRES a secret", async () => {
    const user = userEvent.setup({ delay: null })
    renderPanel()
    await chooseService(user, "slack")
    expect(screen.queryByText(FORM_COPY.FIELD_MCP_SECRET_OPTIONAL_NOTE)).not.toBeInTheDocument()
  })
})

describe("206.1 · the create body — the KEY SET the server accepts (D-206.1-04)", () => {
  async function saveMcp(
    user: ReturnType<typeof userEvent.setup>,
    onCreate: ReturnType<typeof vi.fn>,
    opts: { url?: string; secret?: string } = {},
  ) {
    renderPanel({ onCreate: onCreate as unknown as (body: ConnectorConnectionCreate) => Promise<void> })
    await chooseMcp(user)
    await user.type(screen.getByLabelText("Name"), "DeepWiki")
    await user.type(
      screen.getByLabelText(FORM_COPY.FIELD_MCP_URL_LABEL),
      opts.url ?? ACCEPTED_MCP_URL,
    )
    if (opts.secret) {
      await user.type(screen.getByLabelText(FORM_COPY.FIELD_MCP_SECRET_LABEL), opts.secret)
    }
    await user.click(screen.getByTestId("connection-form-save"))
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    return onCreate.mock.calls[0][0] as Record<string, unknown>
  }

  it("an MCP save sends EXACTLY `{config, mcp_server_url, name, service_id}` — the key set, not a subset match", async () => {
    const user = userEvent.setup({ delay: null })
    const body = await saveMcp(user, vi.fn().mockResolvedValue(undefined))
    // ⚠ `Object.keys(...).sort()`, NEVER `toMatchObject`: an extra key is a 422 the client's
    // own types cannot see, and a subset match would pass straight through it.
    // ⚠ `service_id` is REQUIRED on every shape since 211-02 — the model and migration 127's
    // `connector_connections_has_a_service_identity` agree exactly.
    expect(Object.keys(body).sort()).toEqual([
      "config",
      "default_approval_posture",
      "mcp_server_url",
      "name",
      "service_id",
    ])
    expect(body.service_id).toBe("custom")
    expect(body.mcp_server_url).toBe(ACCEPTED_MCP_URL)
    expect(body.config).toEqual({ headers: {} })
  })

  it("⚠ the body carries NO `capability` KEY AT ALL — present-and-null is not absent", async () => {
    const user = userEvent.setup({ delay: null })
    const body = await saveMcp(user, vi.fn().mockResolvedValue(undefined))
    // `_validate_connection_shape` branches on `mcp_server_url` FIRST and returns before the
    // capability arm; the model is `extra`-strict and `"mcp"` is not a member of the server's
    // closed `ConnectorCapability`. Absence is the contract, so absence is what is asserted.
    expect("capability" in body).toBe(false)
  })

  it("a typed credential adds `secret`; ⚠ an EMPTY one OMITS the key rather than sending an empty string", async () => {
    const user = userEvent.setup({ delay: null })
    const withSecret = await saveMcp(user, vi.fn().mockResolvedValue(undefined), {
      secret: "mcp-token-abc",
    })
    expect(Object.keys(withSecret).sort()).toEqual([
      "config",
      "default_approval_posture",
      "mcp_server_url",
      "name",
      "secret",
      "service_id",
    ])
    expect(withSecret.secret).toBe("mcp-token-abc")
    cleanup()

    const withoutSecret = await saveMcp(user, vi.fn().mockResolvedValue(undefined))
    // ⚠ `secret: ""` is a PRESENT value, and the server's `NonEmpty` rejects it — so an
    // optional credential left blank must not travel at all. It is also a pointless plaintext
    // round trip for a value that is not there.
    expect("secret" in withoutSecret).toBe(false)
  })

  it("POSITIVE CONTROL — a Slack save still sends `capability` and a channel config (CONN-05)", async () => {
    const user = userEvent.setup({ delay: null })
    const onCreate = vi.fn().mockResolvedValue(undefined)
    renderPanel({ onCreate })
    await chooseService(user, "slack")
    await user.type(screen.getByLabelText("Name"), "#ops-alerts")
    await user.type(screen.getByLabelText("Channel"), "#ops-alerts")
    await user.type(screen.getByLabelText("Bot token"), "xoxb-real")
    await user.click(screen.getByTestId("connection-form-save"))
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))

    const body = onCreate.mock.calls[0][0] as Record<string, unknown>
    // ⚠ THE VERB SURVIVES AS AN ATTRIBUTE. CONN-05 is "keeps working unchanged": naming a
    // service is how you REACH the capability, and the capability still travels.
    expect(body.capability).toBe("post_message")
    expect(body.service_id).toBe("slack")
    expect(body.config).toEqual({ default_channel: "#ops-alerts" })
    expect("mcp_server_url" in body).toBe(false)
  })

  it("⭐ SC#4 / CONN-08 — a service nobody here has heard of SAVES, with NO `capability` key at all", async () => {
    const user = userEvent.setup({ delay: null })
    const onCreate = vi.fn().mockResolvedValue(undefined)
    renderPanel({ onCreate })
    await chooseService(user, "my_custom_wiki")
    await user.type(screen.getByLabelText("Name"), "The team wiki")
    await user.click(screen.getByTestId("connection-form-save"))
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))

    const body = onCreate.mock.calls[0][0] as Record<string, unknown>
    expect(Object.keys(body).sort()).toEqual(["config", "name", "service_id"])
    expect(body.service_id).toBe("my_custom_wiki")
    // ⚠ KEY ABSENCE, never a value comparison — `capability: null` is a PRESENT value and a
    // different thing from absence, and only absence is what the server's shape arm reads.
    expect(body).not.toHaveProperty("capability")
    expect(body).not.toHaveProperty("mcp_server_url")
    expect(body).not.toHaveProperty("secret")
  })

  it("⭐ NEGATIVE CONTROL — no submit path produces a capability the person did not reach by naming a service", async () => {
    const user = userEvent.setup({ delay: null })
    // Four identities the lookup does not hold, including two one character from a real
    // one, plus a prototype key — the shape a `MAP[key]` read would let through.
    for (const identity of ["my_custom_wiki", "slac", "smtpx", "constructor"]) {
      const onCreate = vi.fn().mockResolvedValue(undefined)
      renderPanel({ onCreate })
      await chooseService(user, identity)
      await user.type(screen.getByLabelText("Name"), "Whatever it is")
      await user.click(screen.getByTestId("connection-form-save"))
      await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
      const body = onCreate.mock.calls[0][0] as Record<string, unknown>
      // ⚠ `send_email` is what a positional fallback would produce, and it is the exact
      // defect `phase_types.py`'s preamble records: a default is not a way through a gate.
      expect(body).not.toHaveProperty("capability")
      expect(body.service_id).toBe(identity)
      cleanup()
    }
  })

  it("⚠ a body may never carry BOTH a capability and an endpoint — the DB refuses it by name", async () => {
    // `connector_connections_shape_is_not_ambiguous` (migration 127) and 211-02's model arm
    // both refuse such a row; the panel must not be the thing that discovers that.
    const user = userEvent.setup({ delay: null })
    const onCreate = vi.fn().mockResolvedValue(undefined)
    renderPanel({ onCreate })
    await chooseMcp(user)
    await user.type(screen.getByLabelText("Name"), "DeepWiki")
    await user.type(screen.getByLabelText(FORM_COPY.FIELD_MCP_URL_LABEL), ACCEPTED_MCP_URL)
    await user.click(screen.getByTestId("connection-form-save"))
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1))
    const body = onCreate.mock.calls[0][0] as Record<string, unknown>
    expect("mcp_server_url" in body && "capability" in body).toBe(false)
  })
})

describe("206.1 · the disabled Save and its OWN reason id (D-206.1-05)", () => {
  async function renderMcpWithUrl(url: string) {
    const user = userEvent.setup({ delay: null })
    const view = renderPanel()
    await chooseMcp(user)
    if (url) await user.type(screen.getByLabelText(FORM_COPY.FIELD_MCP_URL_LABEL), url)
    return view
  }

  it.each(["", "http://mcp.example.com/mcp", "ftp://mcp.example.com", "mcp.example.com"])(
    "a non-https address (%s) leaves Save DISABLED with the reason in real DOM text",
    async (url) => {
      await renderMcpWithUrl(url)
      expect(screen.getByTestId("connection-form-save")).toBeDisabled()
      const reason = screen.getByTestId("connection-mcp-save-disabled-reason")
      expect(reason.textContent).toBe(FORM_COPY.MCP_SAVE_DISABLED_REASON)
      expect(reason.className).toContain("text-destructive")
    },
  )

  it("a valid https address ENABLES Save and removes the reason node entirely", async () => {
    await renderMcpWithUrl(ACCEPTED_MCP_URL)
    expect(screen.getByTestId("connection-form-save")).not.toBeDisabled()
    expect(screen.queryByTestId("connection-mcp-save-disabled-reason")).not.toBeInTheDocument()
  })

  it("`aria-describedby` RESOLVES to the MCP reason node, and the node sits ABOVE the Save button", async () => {
    const { container } = await renderMcpWithUrl("http://mcp.example.com/mcp")
    const save = screen.getByTestId("connection-form-save")
    const describedBy = save.getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    const node = container.querySelector(`#${CSS.escape(describedBy!)}`)
    expect(node).not.toBeNull()
    expect(node!.textContent).toBe(FORM_COPY.MCP_SAVE_DISABLED_REASON)
    // A reason a person must scroll PAST the button to find is a reason they will not read.
    expect(
      node!.compareDocumentPosition(save) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it("⚠ the two disabled-Save reason ids are DISTINCT — the shipped CIPHER resolution is asserted in the SAME run", async () => {
    // `ConnectionFormPanel.test.tsx`'s cipher case resolves `aria-describedby` with
    // `container.querySelector`, which returns the FIRST match. Two simultaneously-rendered
    // nodes sharing one id would break that resolution SILENTLY — the shipped assertion would
    // still find A node and still read A sentence, just not the right one.
    const user = userEvent.setup({ delay: null })
    const onUpdate = vi
      .fn()
      .mockRejectedValue(new ConnectorApiError("no key", 503, "no_encryption_key"))
    const cipher = renderEditable({ onUpdate })
    await user.click(screen.getByTestId("connection-form-save"))
    await waitFor(() =>
      expect(screen.getByTestId("connection-cipher-refusal")).toBeInTheDocument(),
    )
    const cipherId = screen.getByTestId("connection-form-save").getAttribute("aria-describedby")!
    expect(
      cipher.container.querySelector(`#${CSS.escape(cipherId)}`)!.textContent,
    ).toBe(CIPHER_UNAVAILABLE_SAVE_DISABLED_REASON)
    cleanup()

    const mcp = await renderMcpWithUrl("http://mcp.example.com/mcp")
    const mcpId = screen.getByTestId("connection-form-save").getAttribute("aria-describedby")!
    expect(mcp.container.querySelector(`#${CSS.escape(mcpId)}`)!.textContent).toBe(
      FORM_COPY.MCP_SAVE_DISABLED_REASON,
    )
    // ⭐ THE PROPERTY: two different reasons, two different ids.
    expect(mcpId).not.toBe(cipherId)
  })

  it("⚠ ZERO `[title]` nodes in the MCP create render AND the MCP edit render", async () => {
    const create = await renderMcpWithUrl("http://mcp.example.com/mcp")
    expect(create.container.querySelectorAll("[title]")).toHaveLength(0)
    cleanup()

    const edit = renderPanel({ mode: "edit", connection: makeMcpConnection() })
    expect(edit.container.querySelectorAll("[title]")).toHaveLength(0)
  })

  it("⭐ 211 — an UNNAMED service leaves Save off with its OWN reason, and its own id", async () => {
    const user = userEvent.setup({ delay: null })
    const { container } = renderPanel()

    // Before a single keystroke: the shape is `service`, and neither fact is present yet.
    const save = screen.getByTestId("connection-form-save")
    expect(save).toBeDisabled()
    const reason = screen.getByTestId("connection-service-save-disabled-reason")
    expect(reason.textContent).toBe(FORM_COPY.SERVICE_SAVE_DISABLED_REASON)
    // The wiring RESOLVES — an id pointing at nothing is the defect a `toBeDisabled()` plus
    // a `getByText()` would both miss.
    const describedBy = save.getAttribute("aria-describedby")!
    expect(container.querySelector(`#${CSS.escape(describedBy)}`)!.textContent).toBe(
      FORM_COPY.SERVICE_SAVE_DISABLED_REASON,
    )
    // ⚠ A THIRD DISTINCT ID — never the MCP one's, never the cipher one's.
    expect(describedBy).toContain("service-save-disabled-reason")

    // Both facts supplied, and the reason node is REMOVED rather than emptied.
    await chooseService(user, "my_custom_wiki")
    await user.type(screen.getByLabelText("Name"), "The team wiki")
    expect(screen.getByTestId("connection-form-save")).not.toBeDisabled()
    expect(
      screen.queryByTestId("connection-service-save-disabled-reason"),
    ).not.toBeInTheDocument()
  })

  it("⚠ a BLANK identity is refused too — `'   '` is a present value the database's btrim declines", async () => {
    const user = userEvent.setup({ delay: null })
    renderPanel()
    await user.type(screen.getByLabelText("Name"), "The team wiki")
    await user.type(screen.getByLabelText(SERVICE_LABEL), "   ")
    expect(screen.getByTestId("connection-form-save")).toBeDisabled()
    expect(screen.getByTestId("connection-service-save-disabled-reason")).toBeInTheDocument()
  })

  it("POSITIVE CONTROL — the three capability shapes are UNGATED, byte-for-byte as shipped", async () => {
    const user = userEvent.setup({ delay: null })
    for (const capability of ["send_email", "create_ticket", "post_message"] as const) {
      renderPanel()
      await chooseService(user, SERVICE_FOR_CAPABILITY[capability])
      // ⚠ NO completeness gate was added to them: that would be a behaviour change with no
      // defect behind it, and their refusals already arrive through §4b with a readable cause.
      expect(screen.getByTestId("connection-form-save")).not.toBeDisabled()
      expect(
        screen.queryByTestId("connection-service-save-disabled-reason"),
      ).not.toBeInTheDocument()
      cleanup()
    }
  })

  it("the Save button is DISABLED, not REMOVED — removal is reserved for a different fact", async () => {
    await renderMcpWithUrl("http://mcp.example.com/mcp")
    const save = screen.getByTestId("connection-form-save")
    expect(save).toBeInTheDocument()
    expect(save.className).toContain("disabled:opacity-60")
  })
})

describe("206.1 · the EDIT path renders the MCP shape (D-206.1-22 — a live defect, pinned)", () => {
  it("an MCP row's panel names its SERVICE statically and seeds its own URL", () => {
    renderPanel({ mode: "edit", connection: makeMcpConnection() })

    const staticKind = screen.getByTestId("connection-capability-static")
    // ⚠ THE SERVICE, NOT THE VERB — and a miss degrades to the raw identifier rather than
    // to a placeholder, which is what makes the curated set a suggestion (D-211-02).
    expect(staticKind).toHaveTextContent("mcp.deepwiki.com")
    expect(screen.getByText(SERVICE_LOCKED_NOTE)).toBeInTheDocument()
    expect(
      (screen.getByLabelText(FORM_COPY.FIELD_MCP_URL_LABEL) as HTMLInputElement).value,
    ).toBe(ACCEPTED_MCP_URL)
  })

  it("⚠ FOUR REGRESSION PINS, all four live today: no SMTP kind, no host/port, no `App password`, no SMTP footer", () => {
    renderPanel({ mode: "edit", connection: makeMcpConnection() })

    // 1 — the kind. Today `capability ?? "send_email"` renders `Send an email`.
    expect(screen.queryByText("Send an email")).not.toBeInTheDocument()
    // 2 — the SMTP fields.
    expect(screen.queryByLabelText("SMTP host and port")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Send from")).not.toBeInTheDocument()
    // 3 — the secret's label. Today it reads SMTP's word; it must read MCP's.
    // ⚠ `queryByText`, NOT `queryByLabelText`. On EDIT the secret is a `<span>` of dots with
    // NO control, so its `<label>` associates with nothing and `queryByLabelText` returns null
    // whether the label is present or not — the negative would be VACUOUS. Measured, not
    // predicted: the positive control below failed on exactly this before it was corrected.
    expect(screen.queryByText("App password")).not.toBeInTheDocument()
    expect(screen.queryByText("Bot token")).not.toBeInTheDocument()
    expect(screen.getByText(FORM_COPY.FIELD_MCP_SECRET_LABEL)).toBeInTheDocument()
    // 4 — the footer. The destination is the row's own URL, and no SMTP TLS-mode tag.
    expect(screen.getByTestId("connection-destination-value")).toHaveTextContent(ACCEPTED_MCP_URL)
    const tags = screen.queryAllByTestId("connection-destination-tag").map((n) => n.textContent)
    expect(tags).not.toContain(FOOTER_TAG_STARTTLS)
    expect(tags).not.toContain(FOOTER_TAG_IMPLICIT_TLS)
  })

  it("the MCP update body is `{name, mcp_server_url, config}` — the panel is the ONLY guard here", async () => {
    // ⚠ `ConnectorConnectionUpdate` performs NO cross-field validation, so a wrong body is
    // accepted at the model and refused (or worse, stored) downstream.
    const user = userEvent.setup({ delay: null })
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderPanel({ mode: "edit", connection: makeMcpConnection(), onUpdate })

    await user.click(screen.getByTestId("connection-form-save"))
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
    const [, body] = onUpdate.mock.calls[0]
    expect(Object.keys(body as Record<string, unknown>).sort()).toEqual([
      "config",
      "default_approval_posture",
      "mcp_server_url",
      "name",
    ])
    expect((body as Record<string, unknown>).config).toEqual({ headers: {} })
    expect((body as Record<string, unknown>).mcp_server_url).toBe(ACCEPTED_MCP_URL)
  })

  it("POSITIVE CONTROL — editing a `send_email` row still renders the SMTP form unchanged", () => {
    renderPanel({ mode: "edit", connection: makeConnection() })
    expect(screen.getByTestId("connection-capability-static")).toHaveTextContent(
      FORM_COPY.serviceLabelOf("smtp"),
    )
    expect(screen.getByLabelText("SMTP host and port")).toBeInTheDocument()
    // ⚠ `getByText` — see the note above: on EDIT this label has no control to point at.
    expect(screen.getByText("App password")).toBeInTheDocument()
    expect(screen.queryByLabelText(FORM_COPY.FIELD_MCP_URL_LABEL)).not.toBeInTheDocument()
  })
})

describe("206.1 · LADDERS 3 and 4, driven through the RENDER (SC#4 extended)", () => {
  it("LADDER 4 — an MCP draft's secret is labelled `Access token`, never Slack's word", async () => {
    const user = userEvent.setup({ delay: null })
    renderPanel()
    await chooseMcp(user)
    expect(screen.getByLabelText(FORM_COPY.FIELD_MCP_SECRET_LABEL)).toBeInTheDocument()
    // ⚠ Today an MCP draft falls to `secretLabel`'s trailing arm — `FIELD_SLACK_SECRET_LABEL`.
    expect(screen.queryByLabelText("Bot token")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("App password")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("API token")).not.toBeInTheDocument()
  })

  it("POSITIVE CONTROL — the three shipped shapes still resolve their own secret labels", async () => {
    const user = userEvent.setup({ delay: null })
    renderPanel()
    for (const [capability, label] of [
      ["send_email", "App password"],
      ["create_ticket", "API token"],
      ["post_message", "Bot token"],
    ] as const) {
      await chooseService(user, SERVICE_FOR_CAPABILITY[capability])
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
  })

  it("LADDER 3 — an MCP save-path refusal names the URL's HOST, and NOT the stray SMTP host", async () => {
    const user = userEvent.setup({ delay: null })
    const onUpdate = vi
      .fn()
      .mockRejectedValue(new ConnectorApiError("refused", 400, "address_not_public"))
    renderPanel({ mode: "edit", connection: makeMcpConnectionWithStrayHost(), onUpdate })

    await user.click(screen.getByTestId("connection-form-save"))
    await waitFor(() => expect(screen.getByTestId("connection-save-refusal")).toBeInTheDocument())

    const body = screen.getByTestId("connection-save-refusal-body").textContent ?? ""
    expect(body).toContain("mcp.deepwiki.com")
    // ⚠ THE FALSIFIABLE HALF: the fixture's config carries `smtp.fastmail.com`, so
    // `draft.host` is NON-EMPTY. Today the ladder's trailing arm reports it.
    expect(body).not.toContain("smtp.fastmail.com")
  })

  it("⚠ the SYNTHETIC FIFTH SHAPE gets NEUTRAL answers from both panel ladders", async () => {
    const user = userEvent.setup({ delay: null })
    const onUpdate = vi
      .fn()
      .mockRejectedValue(new ConnectorApiError("refused", 400, "address_not_public"))
    renderPanel({ mode: "edit", connection: makeUnknownShapeConnection(), onUpdate })

    // LADDER 4 — a neutral noun, never Slack's. (`getByText`: EDIT mode, unassociated label.)
    expect(screen.getByText(FORM_COPY.FIELD_SECRET_LABEL_NEUTRAL)).toBeInTheDocument()
    expect(screen.queryByText("Bot token")).not.toBeInTheDocument()

    // No per-shape field block at all: Name and the secret, and nothing invented.
    expect(screen.getAllByTestId("connection-field")).toHaveLength(2)
    expect(screen.queryByLabelText("SMTP host and port")).not.toBeInTheDocument()
    expect(screen.queryByLabelText(FORM_COPY.FIELD_MCP_URL_LABEL)).not.toBeInTheDocument()

    // The footer degrades to the WORD rather than claiming SMTP's facts.
    expect(screen.getByTestId("connection-destination-value")).toHaveTextContent(FOOTER_NOTHING_YET)
    expect(
      screen.queryAllByTestId("connection-destination-tag").map((n) => n.textContent),
    ).not.toContain(FOOTER_TAG_IMPLICIT_TLS)

    // LADDER 3 — the refusal names no host it was not given.
    await user.click(screen.getByTestId("connection-form-save"))
    await waitFor(() => expect(screen.getByTestId("connection-save-refusal")).toBeInTheDocument())
    expect(screen.getByTestId("connection-save-refusal-body").textContent ?? "").not.toContain(
      "smtp.fastmail.com",
    )
  })
})

describe("206.1 · the MCP write affordances are REMOVED, not disabled (T-206.1-03-EL)", () => {
  it("a non-admin gets no service field, no custom-endpoint door and no Save", () => {
    const { container } = renderPanel({ isOrgAdmin: false })
    expect(screen.queryByLabelText(SERVICE_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByText(FORM_COPY.SERVICE_CUSTOM_ENDPOINT_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByTestId("connection-form-save")).not.toBeInTheDocument()
    // ⚠ ABSENCE, not `toBeDisabled()` — 190-16's plant C shipped the exact defect a disabled
    // assertion PASSES on.
    expect(container.querySelectorAll("[disabled]")).toHaveLength(0)
    expect(screen.getByText(PANEL_NON_ADMIN_NOTE)).toBeInTheDocument()
  })

  it("with `live_connectors` OFF the service field, the endpoint block and Save are all gone", () => {
    const { container } = renderPanel({ liveConnectorsOn: false })
    expect(screen.queryByLabelText(SERVICE_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(FORM_COPY.FIELD_MCP_URL_LABEL)).not.toBeInTheDocument()
    expect(screen.queryByTestId("connection-form-save")).not.toBeInTheDocument()
    expect(screen.queryByTestId("connection-mcp-save-disabled-reason")).not.toBeInTheDocument()
    expect(container.querySelectorAll("[disabled]")).toHaveLength(0)
  })

  it("an MCP row opened while the kill-switch is off is READ-ONLY and still renders the MCP kind", () => {
    renderPanel({ mode: "edit", connection: makeMcpConnection(), liveConnectorsOn: false })
    expect(screen.getByTestId("connection-capability-static")).toHaveTextContent(
      "mcp.deepwiki.com",
    )
    expect(screen.getByText(PANEL_OFF_HEADING)).toBeInTheDocument()
    expect(screen.queryByTestId("connection-form-save")).not.toBeInTheDocument()
  })
})

describe("206.1 · the two shipped SOURCE fences still hold over the widened panel", () => {
  it("the panel still authors NO sentence of its own — every MCP string is an imported identifier", () => {
    for (const sentence of [
      FORM_COPY.SERVICE_CUSTOM_ENDPOINT_LABEL,
      FORM_COPY.SERVICE_LABEL,
      FORM_COPY.SERVICE_HELP,
      FORM_COPY.SERVICE_LOCKED_NOTE,
      FORM_COPY.FIELD_MCP_URL_LABEL,
      FORM_COPY.FIELD_MCP_URL_HELP,
      FORM_COPY.FIELD_MCP_SECRET_LABEL,
      FORM_COPY.FIELD_MCP_SECRET_OPTIONAL_NOTE,
      FORM_COPY.MCP_SAVE_DISABLED_REASON,
      FORM_COPY.FIELD_MCP_URL_PLACEHOLDER,
    ]) {
      expect(panelSource).not.toContain(sentence)
    }
    // Positive control: the fence can see a string in this source at all.
    expect(panelSource).toContain("connection-mcp-save-disabled-reason")
  })

  it("⭐ SC#1 SOURCE FENCE — the panel no longer SPELLS the three-verb chooser anywhere", () => {
    // ⚠ THE SOURCE, not the DOM. A control removed from a render is one prop away from
    // returning; a control whose data and test id are gone from the file is not.
    expect(panelSource).not.toContain("connection-capability-chooser")
    expect(panelSource).not.toContain(RETIRED_CHOOSER_CONSTANT)
    // POSITIVE CONTROL — the fence can see the id that REPLACED it, in this same source.
    expect(panelSource).toContain("connection-service-field")
  })

  it("the panel still imports NOTHING from `PhaseFormPanel`, and spells no tooltip attribute", () => {
    // ⚠ IMPORT-SCOPED, NEVER A BARE GREP OVER THE WHOLE SOURCE — the 187-24 trap, measured
    // here as this plan's own eleventh recorded firing. This file's header docblock NAMES
    // `PhaseFormPanel` seven times to explain the lineage it deliberately does not import, so
    // a whole-file grep expecting 0 is UNSATISFIABLE AT ITS OWN BASE and would go red on the
    // prose that forbids the thing. The shipped fence at section 11 already got this right;
    // this is the same filter, re-applied over the widened panel.
    const importLines = panelSource
      .split("\n")
      .filter((line) => /^\s*import\b/.test(line) || /^\s*}\s*from\s+["']/.test(line))
      .join("\n")
    expect(importLines).not.toContain("PhaseFormPanel")
    expect(importLines).toContain("connectionFormCopy")
    // The tooltip refusal IS satisfiable over the whole source, and measured 0 at base.
    expect(panelSource).not.toContain("title=")
  })
})

describe("Phase 212 · interactive discovery in MCP mode (D-4 / D-5)", () => {
  it("probes MCP server and renders discovered tools list with auto-populated name in create mode", async () => {
    const user = userEvent.setup({ delay: null })
    const mockProbe = vi.fn().mockResolvedValue({
      server_url: "https://mcp.github.com",
      tools: [
        { name: "github_search", description: "Search repositories and code", inputSchema: {} },
        { name: "github_issue", description: "Create issues", inputSchema: {} },
      ],
      count: 2,
    })
    vi.spyOn(api, "probeMcpServer").mockImplementation(mockProbe)

    renderPanel({ mode: "create", presetServiceId: "custom_mcp" })
    const urlInput = screen.getByPlaceholderText(FORM_COPY.FIELD_MCP_URL_PLACEHOLDER)
    await user.type(urlInput, "https://mcp.github.com/v1")

    const probeBtn = screen.getByTestId("connection-probe-mcp-btn")
    expect(probeBtn).toBeInTheDocument()
    await user.click(probeBtn)

    await waitFor(() => {
      expect(screen.getByTestId("connection-discovered-tools")).toBeInTheDocument()
    })
    expect(screen.getByPlaceholderText(GRANTS_COPY.SEARCH_PLACEHOLDER(2))).toBeInTheDocument()
    expect(screen.getByText("github_search")).toBeInTheDocument()
    expect(screen.getByText("github_issue")).toBeInTheDocument()
    expect(mockProbe).toHaveBeenCalledWith({
      mcp_server_url: "https://mcp.github.com/v1",
      secret: undefined,
    })
  })

  it("⭐ D-4 — in edit mode, Discover tools calls `discoverConnectorTools(connection.id)` to decrypt stored credential server-side", async () => {
    const user = userEvent.setup({ delay: null })
    const mockDiscover = vi.fn().mockResolvedValue([
      { name: "add_issue_comment", description: "Add issue comment", inputSchema: {} },
      { name: "create_pull_request", description: "Create PR", inputSchema: {} },
    ])
    const mockProbe = vi.fn()
    vi.spyOn(api, "discoverConnectorTools").mockImplementation(mockDiscover)
    vi.spyOn(api, "probeMcpServer").mockImplementation(mockProbe)

    const connection = makeMcpConnection({ id: "conn_github_123", service_id: "github" })
    renderPanel({ mode: "edit", connection })

    const probeBtn = screen.getByTestId("connection-probe-mcp-btn")
    expect(probeBtn).toBeInTheDocument()
    await user.click(probeBtn)

    await waitFor(() => {
      expect(screen.getByTestId("connection-discovered-tools")).toBeInTheDocument()
    })
    expect(mockDiscover).toHaveBeenCalledWith("conn_github_123")
    expect(mockProbe).not.toHaveBeenCalled()
    expect(screen.getByPlaceholderText(GRANTS_COPY.SEARCH_PLACEHOLDER(2))).toBeInTheDocument()
    expect(screen.getByText("add_issue_comment")).toBeInTheDocument()
  })

  it("⭐ D-4 — a TYPED secret does NOT send an existing row back to the probe: a saved row always reports on what is STORED", async () => {
    // ⚠ THE FIRST DRAFT OF THE D-4 FIX GATED ON `!draft.secret.trim()`, so typing a replacement
    // token sent an EXISTING connection back to `probeMcpServer`. That reports on a credential
    // the row does not hold — a green result for a token Save might never write — and it is a
    // different verdict from the one `Check credentials` gives for the same row one control
    // over. Two controls on one row that can disagree about the same credential is the defect.
    const user = userEvent.setup({ delay: null })
    const mockDiscover = vi.fn().mockResolvedValue([
      { name: "add_issue_comment", description: "Add issue comment", inputSchema: {} },
    ])
    const mockProbe = vi.fn()
    vi.spyOn(api, "discoverConnectorTools").mockImplementation(mockDiscover)
    vi.spyOn(api, "probeMcpServer").mockImplementation(mockProbe)

    renderPanel({ mode: "edit", connection: makeMcpConnection({ id: "conn-mcp-typed" }) })

    // Replace the stored secret, then discover WITHOUT saving.
    await user.click(screen.getByTestId("connection-secret-replace"))
    await user.type(screen.getByLabelText("Access token"), "ghp_a_freshly_typed_token")
    await user.click(screen.getByTestId("connection-probe-mcp-btn"))

    await waitFor(() => expect(mockDiscover).toHaveBeenCalledWith("conn-mcp-typed"))
    expect(mockProbe).not.toHaveBeenCalled()
  })

  it("⭐ D-4b — a CAPABILITY row in edit mode offers `Refresh actions`, and it calls the SAVED-ROW endpoint", async () => {
    // ⚠ THE OPERATOR FOUND THIS BY DRIVING, AFTER D-4 WAS ALREADY FIXED: "for the old
    // connections like JIRA and email and slack it does not show discover tools, it is only
    // showing check credentials." `discover_connection_tools` has served the capability shape
    // since Phase 211 — from the adapter's static descriptor, with NO network call — and no
    // control was ever rendered for it, so the arm was unreachable from the UI.
    const user = userEvent.setup({ delay: null })
    const mockDiscover = vi.fn().mockResolvedValue([
      { name: "send_email", description: "Send an email", inputSchema: {} },
    ])
    const mockProbe = vi.fn()
    vi.spyOn(api, "discoverConnectorTools").mockImplementation(mockDiscover)
    vi.spyOn(api, "probeMcpServer").mockImplementation(mockProbe)

    // The default fixture IS a capability row: `send_email`, no `mcp_server_url`.
    renderPanel({ mode: "edit", connection: makeConnection({ id: "conn-smtp-1" }) })

    await user.click(screen.getByTestId("connection-refresh-actions-btn"))

    await waitFor(() => expect(mockDiscover).toHaveBeenCalledWith("conn-smtp-1"))
    // ⚠ AND NOT THE PROBE. A capability row has an EMPTY `mcpServerUrl`, so the probe would
    // have been a 422 about a field this shape does not have.
    expect(mockProbe).not.toHaveBeenCalled()
    expect(screen.getByTestId("connection-discovered-tools")).toBeInTheDocument()
    expect(screen.getByText("send_email")).toBeInTheDocument()
  })

  it("⭐ a capability row's actions ARE grantable — the D-4b absence is CLOSED, not preserved", async () => {
    // ── SUPERSEDES Phase 212's D-4b assertion, 2026-08-28 ────────────────────────────────
    // The test this replaces asserted an ABSENCE and a note explaining it:
    //
    //   "a capability row's actions render WITHOUT a Granted checkbox, because `handleSave`
    //    would drop it … an affordance unable to act is REMOVED, never rendered inert."
    //
    // ⚠ THAT WAS THE HONEST RENDERING OF `BUG-260827-02`, NEVER A FIX FOR IT, and the bug
    // report says so in as many words. The absence was correct only while `handleSave` and
    // `grantsArePersisted` both gated on the `mcp` shape. Both gates are gone: the backend
    // never required them (no shape guard on `PATCH /grants`, no shape branch in
    // `update_connection_grants`, and `create_connection` already stores
    // `static_descriptors_for_capability` into `discovered_tools`).
    //
    // So the property flips from "the control is absent" to "the control is present AND it
    // persists". Asserting the old absence today would pin the defect in place.
    const user = userEvent.setup({ delay: null })
    vi.spyOn(api, "discoverConnectorTools").mockResolvedValue([
      { name: "send_email", description: "Send an email", inputSchema: {} },
    ])
    renderPanel({ mode: "edit", connection: makeConnection({ id: "conn-smtp-2" }) })
    await user.click(screen.getByTestId("connection-refresh-actions-btn"))
    await waitFor(() =>
      expect(screen.getByTestId("connection-discovered-tools")).toBeInTheDocument(),
    )

    // The three-arm posture control is REACHABLE and ENABLED on a capability row.
    const row = screen.getByTestId("action-row-send_email")
    const deny = within(row).getByRole("button", { name: GRANTS_COPY.POSTURE_DENY })
    expect(deny).toBeEnabled()

    // …and the note that explained the absence is GONE, because it now says the opposite of
    // what the screen does.
    expect(screen.queryByTestId("connection-actions-not-grantable")).toBeNull()
  })

  it("⭐ D-4b — a capability DRAFT offers NO refresh control, because there is no row to refresh from", () => {
    // Removed rather than disabled: the endpoint reads a row by id, and a draft has none.
    renderPanel({ mode: "create" })
    expect(screen.queryByTestId("connection-refresh-actions-btn")).not.toBeInTheDocument()
  })

  it("⭐ D-4b — a discovery REFUSAL renders on a capability row, which it could not while the error node lived inside the `mcp` arm", async () => {
    const user = userEvent.setup({ delay: null })
    // The route's real worded 409 for a shape with nothing to reach — carried by the client
    // since this phase, and previously replaced by the fixed string "Failed to discover tools".
    vi.spyOn(api, "discoverConnectorTools").mockRejectedValue(
      new api.ConnectorApiError(
        "This connection names a service but no way to reach it yet, so there are no actions to list.",
        409,
        "nothing_to_discover_yet",
      ),
    )
    renderPanel({ mode: "edit", connection: makeConnection({ id: "conn-smtp-3" }) })
    await user.click(screen.getByTestId("connection-refresh-actions-btn"))

    const node = await screen.findByTestId("connection-probe-error")
    expect(node).toHaveTextContent("no way to reach it yet")
  })

  it("pre-fills form when opened with presetServiceId from catalog", () => {
    renderPanel({ mode: "create", presetServiceId: "slack" })
    expect(screen.getByDisplayValue("Slack")).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 213-07 · THE SAVE ORDERING — operator-driven, 2026-08-27
//
// Reported: *"when I change any permission for tools, it is not reflecting directly once I
// click save. When I navigate to another connection and go back, changes are reflected."*
//
// CAUSE: `onUpdate` is `ConnectionsTab.handleUpdate`, which calls `reload()`. With the
// grants write AFTER it, the refetch captured the row BEFORE the grants landed, so the
// parent's list kept the old `tool_grants` and the panel re-seeded from that stale object.
//
// ⚠ HOW THIS PINS IT WITHOUT MOCKING THE API. `updateConnectorGrants` is the REAL function
// here (this file mocks no modules) and there is no `fetch` in jsdom, so it REJECTS. That
// makes the ordering observable through props alone: written FIRST, its rejection means
// `onUpdate` is never reached. If a future edit puts it back after `onUpdate`, `onUpdate`
// runs and this test goes red — which is the regression it exists to catch.
// ═══════════════════════════════════════════════════════════════════════════════════════
describe("213-07 · a permission change is written BEFORE the parent reloads", () => {
  const withTools = () =>
    makeMcpConnection({
      discovered_tools: [
        { name: "search_code", description: "Search", readOnlyHint: true },
        { name: "create_issue", description: "Create", readOnlyHint: false },
      ],
      tool_grants: { search_code: "allow" },
    } as Partial<ConnectorConnection>)

  it("writes the grants first, so a failed grant write never lets a stale reload run", async () => {
    const user = userEvent.setup({ delay: null })
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderPanel({ mode: "edit", connection: withTools(), onUpdate })

    // Change a permission — `create_issue` from its inherited default to Deny.
    const row = screen.getByTestId("action-row-create_issue")
    await user.click(within(row).getByRole("button", { name: GRANTS_COPY.POSTURE_DENY }))

    await user.click(screen.getByTestId("connection-form-save"))

    // ⚠ THE ASSERTION IS ON ORDERING, NOT ON THE REFUSAL UI. `saveRefusalFrom` keys off the
    // SERVER's own reason code, so a bare network rejection may carry none and render no
    // banner — that is its documented behaviour, not a defect, and pinning the banner here
    // would be testing the wrong thing. What must hold is that the grant write ran FIRST:
    // it rejected, so `onUpdate` — and the `reload()` inside it — was never reached.
    await waitFor(() => expect(screen.getByTestId("connection-form-save")).toBeEnabled())
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it("⭐ a CAPABILITY row's posture change is written too — no shape gate (BUG-260827-02)", async () => {
    // The UI half of BUG-260827-02, pinned as a WRITE rather than as an enabled control.
    // `handleSave` gated the grants write on `draft.capability === "mcp"`, so a Slack, Jira or
    // SMTP posture was accepted by the screen and dropped on the floor — *"a switch Save
    // drops is a lie"*.
    //
    // Same mechanism as the ordering test above: `updateConnectorGrants` is the REAL function
    // and jsdom has no `fetch`, so it rejects. Reaching it at all is the property — under the
    // old shape gate it was never called, `onUpdate` ran, and this would be green for the
    // wrong reason. `onUpdate` NOT being called is what proves the write was attempted.
    const user = userEvent.setup({ delay: null })
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(api, "discoverConnectorTools").mockResolvedValue([
      { name: "send_email", description: "Send an email", inputSchema: {} },
    ])
    renderPanel({ mode: "edit", connection: makeConnection({ id: "conn-smtp-3" }), onUpdate })

    await user.click(screen.getByTestId("connection-refresh-actions-btn"))
    await waitFor(() =>
      expect(screen.getByTestId("connection-discovered-tools")).toBeInTheDocument(),
    )

    const row = screen.getByTestId("action-row-send_email")
    await user.click(within(row).getByRole("button", { name: GRANTS_COPY.POSTURE_DENY }))
    await user.click(screen.getByTestId("connection-form-save"))

    await waitFor(() => expect(screen.getByTestId("connection-form-save")).toBeEnabled())
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it("NEGATIVE CONTROL — an untouched permission set does not write grants at all", async () => {
    // Without this, "grants are written first" would be satisfied by writing them on EVERY
    // save — which is what the first draft of this fix did, and it let a refused grant write
    // block a plain rename. Here nothing about the permissions changed, so the grant write
    // must not happen and `onUpdate` must be reached normally.
    const user = userEvent.setup({ delay: null })
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderPanel({ mode: "edit", connection: withTools(), onUpdate })

    await user.click(screen.getByTestId("connection-form-save"))

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1))
    expect(screen.queryByTestId("connection-save-refusal")).toBeNull()
  })
})
