/**
 * Phase 190-12 Task 3 — the ConnectionPicker's proofs.
 *
 * ⚠ THIS FILE IS REGISTERED WITH `scripts/vitest-count-gate.cjs` IN THE COMMIT THAT
 * CREATES IT, the rule `ExternalActionSection.test.tsx:12` states verbatim.
 * `src/components/workflows` is already a TARGETS **directory** entry, so this suite RUNS
 * the moment it exists; the BASELINE pin is what makes it GUARDED rather than merely
 * executed. An unpinned file is not lightly guarded — it is unguarded (188-12).
 *
 * FIVE THINGS THIS SUITE EXISTS TO CATCH, each a named threat:
 *  - T-190-12-T6 a key that is not `connection_id` reaching the definition JSONB. The
 *    sweep was OBSERVED RED against a planted `config["smtp_password"]` write in real
 *    production source, restored md5-identical (recorded in `190-12-SUMMARY.md`).
 *  - T-190-12-U07a the picker binding a connection whose credential is failing, or its
 *    copy claiming an absolute for a guarantee only this client gate provides.
 *  - T-190-12-CRASH a provider-less render throwing — or, just as bad, quietly opening an
 *    unmocked request inside a shipped suite that never asked for one.
 *  - T-190-12-A11Y a select with no real label, or a refusal reason that lives only in an
 *    option's text.
 *  - the four-state honesty rule: populated ≠ empty ≠ loading ≠ error.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

// HOISTED — `vi.mock` is lifted above the imports, so a `const` declared below it would be
// in its temporal dead zone at factory time. Only ONE symbol is faked: the read this
// component owns. Nothing else in `@/lib/api` is replaced, because nothing else is used.
const { listMock, discoverMock, grantsMock } = vi.hoisted(() => ({
  listMock: vi.fn(),
  discoverMock: vi.fn().mockResolvedValue([]),
  grantsMock: vi.fn().mockResolvedValue({}),
}))
vi.mock("@/lib/api", () => ({
  listConnectorConnections: listMock,
  discoverConnectorTools: discoverMock,
  updateConnectorGrants: grantsMock,
}))

import connectionPickerSource from "./ConnectionPicker?raw"
import {
  ConnectionPicker,
  CONNECTION_PICKER_FAILING_REFUSAL,
  CONNECTION_PICKER_LABEL,
  CONNECTION_PICKER_LOADING,
  CONNECTION_PICKER_MCP_ALL_DISABLED,
  CONNECTION_PICKER_NONE_OPTION,
  CONNECTION_PICKER_NOTHING_BOUND_FOOTER,
  CONNECTION_PICKER_NO_MCP_NOTE,
  CONNECTION_PICKER_READ_FAILED,
  CONNECTION_STATE_FAILED,
  CONNECTION_STATE_NOT_CHECKED,
  SLACK_FIXED_DESTINATION,
  destinationPartsOf,
  noConnectionYetNote,
} from "./ConnectionPicker"
import { BuilderStoreProvider } from "./BuilderStoreProvider"
import { SelectedPhaseSlugProvider } from "./SelectedPhaseSlugContext"
import { createBuilderStore, type BuilderStore } from "./builderStore"

const SLUG = "notify-owner"

/** The shipped response shape, minus the credential — which is absent by construction:
 *  `ConnectorConnectionResponse` declares no secret field and never has (190-09 T7). */
type Row = Record<string, unknown>

const mailbox = (over: Row = {}): Row => ({
  id: "conn-ok",
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
  last_check_verdict: "ok",
  ...over,
})

const FAILING = mailbox({ id: "conn-failing", name: "Stale mailbox", last_check_verdict: "failed" })
const UNCHECKED = mailbox({
  id: "conn-unchecked",
  name: "New mailbox",
  last_check_verdict: "not_checked",
})
const DISABLED = mailbox({ id: "conn-disabled", name: "Retired mailbox", is_enabled: false })

const JIRA: Row = {
  id: "conn-jira",
  org_id: "org-1",
  capability: "create_ticket",
  name: "Northwind Jira",
  config: {
    base_url: "northwind.atlassian.net",
    project_key: "OPS",
    account_email: "ops@northwind.co",
  },
  is_enabled: true,
  last_check_verdict: "ok",
}

const SLACK: Row = {
  id: "conn-slack",
  org_id: "org-1",
  capability: "post_message",
  name: "#ops-alerts",
  config: { default_channel: "ops-alerts" },
  is_enabled: true,
  last_check_verdict: "ok",
}

/** A store already in the DRAFTED view — `patchConfig` bails otherwise, so a store built
 *  from `null` could never record the write this suite is about. */
function draftedStore(config: Record<string, unknown> = {}): BuilderStore {
  return createBuilderStore({
    slug: "vendor-brief",
    version: 1,
    phases: [
      {
        slug: SLUG,
        phase_index: 0,
        config: { phase_type: "external_action", capability: "send_email", ...config },
      },
    ],
  })
}

function renderPicker(
  opts: {
    capability?: string
    config?: Record<string, unknown>
    rows?: Row[]
    reject?: boolean
    pending?: boolean
  } = {},
) {
  const store = draftedStore(opts.config)
  const patch = vi.spyOn(store.getState(), "patchConfig")
  if (opts.pending) listMock.mockReturnValue(new Promise<Row[]>(() => {}))
  else if (opts.reject) listMock.mockRejectedValue(new Error("read failed"))
  else listMock.mockResolvedValue(opts.rows ?? [])
  const view = render(
    <BuilderStoreProvider store={store}>
      <SelectedPhaseSlugProvider slug={SLUG}>
        <ConnectionPicker capability={opts.capability ?? "send_email"} />
      </SelectedPhaseSlugProvider>
    </BuilderStoreProvider>,
  )
  return { store, patch, unmount: view.unmount, container: view.container }
}

const select = (): HTMLSelectElement =>
  screen.getByTestId("connection-picker-select") as HTMLSelectElement

beforeEach(() => {
  listMock.mockReset()
})

// ── 1. THE DISCONNECTED RENDER — the case that protects two shipped suites ───────────

describe("ConnectionPicker — degrades, never throws", () => {
  it("renders with NO store and NO provider, and opens no request at all", () => {
    // `ExternalActionSection.test.tsx` and `PhaseFormPanel.rails.test.tsx` both render
    // their subject standalone. A throw here would turn a shipped suite red for a reason
    // that has nothing to do with connections; an unguarded fetch would give it a network
    // call it never mocked. Both halves are asserted, because only the first is obvious.
    expect(() => render(<ConnectionPicker capability="send_email" />)).not.toThrow()
    expect(screen.getByTestId("connection-picker")).toHaveAttribute("data-state", "disconnected")
    expect(listMock).not.toHaveBeenCalled()
    // It still says something TRUE about the step rather than nothing.
    expect(screen.getByTestId("connection-picker-footer")).toHaveTextContent(
      CONNECTION_PICKER_NOTHING_BOUND_FOOTER,
    )
  })
})

// ── 2. THE SEVEN STATES (UI-SPEC §6d) ────────────────────────────────────────────────

describe("ConnectionPicker — the seven states are seven", () => {
  it("1 · LOADING — one dim line, no control, no spinner", () => {
    renderPicker({ pending: true })
    expect(screen.getByTestId("connection-picker-loading")).toHaveTextContent(
      CONNECTION_PICKER_LOADING,
    )
    expect(screen.queryByTestId("connection-picker-select")).not.toBeInTheDocument()
  })

  it("2 · NONE EXIST — the plain capability word, and NO link (there is no router here)", async () => {
    for (const [capability, word] of [
      ["send_email", "email"],
      ["create_ticket", "ticket"],
      ["post_message", "message"],
    ]) {
      const { unmount } = renderPicker({ capability, rows: [] })
      await waitFor(() => expect(screen.getByTestId("connection-picker-empty")).toBeInTheDocument())
      const note = screen.getByTestId("connection-picker-empty")
      // CHARACTER-IDENTITY against the exported identifier, then the word it interpolates.
      expect(note.textContent).toBe(noConnectionYetNote(capability))
      expect(note.textContent).toContain(`No ${word} connection yet`)
      // TEXT ONLY, NO LINK — a leaf inside the Builder has no way to switch `ActiveView`,
      // so naming the destination is honest and an anchor would be a dead one.
      expect(note.querySelector("a")).toBeNull()
      unmount()
    }
  })

  it("3 · NOTHING BOUND — the `— none —` option is selected and the footer says so", async () => {
    renderPicker({ rows: [mailbox()] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    expect(select().value).toBe("")
    expect(screen.getByTestId("connection-picker")).toHaveAttribute("data-state", "unbound")
    expect(screen.getByRole("option", { name: CONNECTION_PICKER_NONE_OPTION })).toBeInTheDocument()
    expect(screen.getByTestId("connection-picker-footer")).toHaveTextContent(
      CONNECTION_PICKER_NOTHING_BOUND_FOOTER,
    )
  })

  it("4 · BOUND — the footer carries the 🔒 sends-to form, host:port · from", async () => {
    renderPicker({ rows: [mailbox()], config: { connection_id: "conn-ok" } })
    await waitFor(() => expect(select()).toBeInTheDocument())
    expect(select().value).toBe("conn-ok")
    expect(screen.getByTestId("connection-picker")).toHaveAttribute("data-state", "bound")
    expect(screen.getByTestId("connection-picker-footer").textContent).toBe(
      "🔒 smtp.fastmail.com:465 · from ops@northwind.co",
    )
  })

  it("4b · the same 🔒 shape for a ticket and for Slack's code-constant host", async () => {
    const jira = renderPicker({
      capability: "create_ticket",
      rows: [JIRA],
      config: { connection_id: "conn-jira" },
    })
    await waitFor(() => expect(select()).toBeInTheDocument())
    expect(screen.getByTestId("connection-picker-footer").textContent).toBe(
      "🔒 northwind.atlassian.net · OPS",
    )
    // The picker READS; it does not write on mount. A field that bound something merely by
    // being looked at would be the worst possible defect on this surface.
    expect(jira.patch).not.toHaveBeenCalled()
    jira.unmount()

    renderPicker({
      capability: "post_message",
      rows: [SLACK],
      config: { connection_id: "conn-slack" },
    })
    await waitFor(() => expect(select()).toBeInTheDocument())
    // D-02 — Slack stores a channel and no URL, so the destination is the server's own
    // constant read back, never a value an author could point elsewhere.
    expect(screen.getByTestId("connection-picker-footer").textContent).toBe(
      `🔒 ${SLACK_FIXED_DESTINATION} · #ops-alerts`,
    )
  })

  it("5 · BOUND AND FAILING — kept, marked, and the refusal is on screen PERSISTENTLY", async () => {
    // Reachable by design: Gate 2 accepts such a write (U-07a door (b)), and a binding
    // that predates the failure is kept rather than silently dropped. The author needs
    // the reason in front of them whenever the field is on screen — not only after a click.
    renderPicker({ rows: [FAILING], config: { connection_id: "conn-failing" } })
    await waitFor(() => expect(select()).toBeInTheDocument())
    expect(select().value).toBe("conn-failing")
    expect(screen.getByTestId("connection-picker")).toHaveAttribute("data-state", "bound-failing")
    expect(screen.getByRole("option", { name: `Stale mailbox ${CONNECTION_STATE_FAILED}` }))
      .toBeInTheDocument()
    expect(screen.getByTestId("connection-picker-refusal").textContent).toBe(
      CONNECTION_PICKER_FAILING_REFUSAL,
    )
  })

  it("6 · NOT CHECKED — marked, and SELECTABLE (an unchecked connection is not a failed one)", async () => {
    const { patch } = renderPicker({ rows: [UNCHECKED] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    const option = screen.getByRole("option", { name: `New mailbox ${CONNECTION_STATE_NOT_CHECKED}` })
    expect(option).not.toHaveAttribute("aria-disabled")
    fireEvent.change(select(), { target: { value: "conn-unchecked" } })
    expect(patch).toHaveBeenCalledWith(SLUG, { connection_id: "conn-unchecked" })
    expect(screen.queryByTestId("connection-picker-refusal")).not.toBeInTheDocument()
  })

  it("7 · READ FAILED — role=alert, and NOT the empty state (four facts stay four)", async () => {
    renderPicker({ reject: true })
    await waitFor(() => expect(screen.getByTestId("connection-picker-error")).toBeInTheDocument())
    const alert = screen.getByRole("alert")
    expect(alert.textContent).toBe(CONNECTION_PICKER_READ_FAILED)
    expect(screen.queryByTestId("connection-picker-empty")).not.toBeInTheDocument()
    expect(screen.queryByTestId("connection-picker-select")).not.toBeInTheDocument()
  })

  it("a DISABLED connection is not listed at all — it is not a choice", async () => {
    renderPicker({ rows: [mailbox(), DISABLED] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    const names = screen.getAllByTestId("connection-picker-option").map((o) => o.textContent)
    expect(names).toEqual(["Ops mailbox"])
    expect(names.join(" ")).not.toContain("Retired mailbox")
  })
})

// ── 3. GATE 1 (UI-SPEC §5a) — client-only, and it really refuses ─────────────────────

describe("ConnectionPicker — Gate 1", () => {
  it("a FAILING option is aria-disabled and choosing it writes NOTHING", async () => {
    const { patch } = renderPicker({ rows: [mailbox(), FAILING] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    const failing = screen.getByRole("option", { name: `Stale mailbox ${CONNECTION_STATE_FAILED}` })
    expect(failing).toHaveAttribute("aria-disabled", "true")

    fireEvent.change(select(), { target: { value: "conn-failing" } })

    expect(patch).not.toHaveBeenCalled()
    expect(select().value).toBe("")
    // The refusal is CHARACTER-IDENTICAL to the exported identifier, so a reworded
    // sentence is a red test rather than a quiet drift.
    expect(screen.getByTestId("connection-picker-refusal").textContent).toBe(
      CONNECTION_PICKER_FAILING_REFUSAL,
    )
  })

  it("POSITIVE CONTROL — the identical select DOES bind a healthy connection", async () => {
    // Without this, a picker that refused EVERYTHING would pass the case above.
    const { patch, store } = renderPicker({ rows: [mailbox(), FAILING] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    fireEvent.change(select(), { target: { value: "conn-ok" } })
    expect(patch).toHaveBeenCalledWith(SLUG, { connection_id: "conn-ok" })
    expect(store.getState().phases[0].config.connection_id).toBe("conn-ok")
    expect(screen.queryByTestId("connection-picker-refusal")).not.toBeInTheDocument()
  })

  it("unbinding is as reachable as binding, and writes the same ONE key", async () => {
    const { patch, store } = renderPicker({
      rows: [mailbox()],
      config: { connection_id: "conn-ok" },
    })
    await waitFor(() => expect(select()).toBeInTheDocument())
    fireEvent.change(select(), { target: { value: "" } })
    expect(patch).toHaveBeenCalledWith(SLUG, { connection_id: null })
    expect(store.getState().phases[0].config.connection_id).toBeNull()
  })
})

// ── 4. T6 — ONLY `connection_id` CROSSES INTO THE DEFINITION (D-13 / CONN-03 SC#4) ───

describe("ConnectionPicker — T6: a reference, and nothing else", () => {
  /** The names a credential or a destination fact would arrive under. */
  const FORBIDDEN = /secret|token|password|host|base_url/i

  const sweep = (patch: Record<string, unknown>) => {
    expect(Object.keys(patch)).toEqual(["connection_id"])
    for (const key of Object.keys(patch)) expect(key).not.toMatch(FORBIDDEN)
    // Nor may a VALUE smuggle one — the id is a uuid-shaped reference, never a host.
    for (const value of Object.values(patch)) {
      if (typeof value === "string") expect(value).not.toContain("smtp.")
    }
  }

  it("every write this component makes carries exactly the key `connection_id`", async () => {
    const { patch } = renderPicker({ rows: [mailbox(), UNCHECKED] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    fireEvent.change(select(), { target: { value: "conn-ok" } })
    fireEvent.change(select(), { target: { value: "conn-unchecked" } })
    fireEvent.change(select(), { target: { value: "" } })

    expect(patch).toHaveBeenCalledTimes(3)
    for (const call of patch.mock.calls) {
      expect(call[0]).toBe(SLUG)
      sweep(call[1] as Record<string, unknown>)
    }
  })

  it("POSITIVE CONTROL — the sweep really fires on a leaking patch", () => {
    // A typo in the regex, or an `Object.keys` compared against the wrong thing, would
    // leave the case above green while checking nothing. This is the plant, in-line.
    expect(() => sweep({ connection_id: "conn-ok", smtp_password: "hunter2" })).toThrow()
    expect(() => sweep({ connection_id: "conn-ok", host: "smtp.evil.test" })).toThrow()
    expect(() => sweep({ connection_id: "smtp.fastmail.com" })).toThrow()
    expect(() => sweep({ connection_id: "conn-ok" })).not.toThrow()
  })
})

// ── 5. ACCESSIBILITY (UI-SPEC §12) ───────────────────────────────────────────────────

describe("ConnectionPicker — a11y", () => {
  it("the control is ONE select with a REAL <label> that is actually associated", async () => {
    const { container } = renderPicker({ rows: [mailbox()] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    const labelled = screen.getByLabelText(CONNECTION_PICKER_LABEL)
    expect(labelled.tagName).toBe("SELECT")
    const label = container.querySelector("label")
    expect(label).not.toBeNull()
    expect(label?.getAttribute("for")).toBe(labelled.getAttribute("id"))
  })

  it("the failing option's reason is ADJACENT DOM TEXT wired by aria-describedby", async () => {
    // Not in the option label alone, and never in a tooltip attribute — 142-B, the 184-07
    // lesson. The reason must be readable without opening the control.
    renderPicker({ rows: [FAILING], config: { connection_id: "conn-failing" } })
    await waitFor(() => expect(select()).toBeInTheDocument())
    const described = select().getAttribute("aria-describedby")
    expect(described).toBeTruthy()
    const reason = document.getElementById(described as string)
    expect(reason?.textContent).toBe(CONNECTION_PICKER_FAILING_REFUSAL)
    expect(select().hasAttribute("title")).toBe(false)
  })
})

// ── 6. THE SOURCE FENCES (the shipped `?raw` house idiom) ────────────────────────────

describe("ConnectionPicker — source discipline", () => {
  it("carries NO title attribute anywhere — a reason may not regress into a tooltip", () => {
    expect(connectionPickerSource).not.toMatch(/title=/)
  })

  it("uses NO absolute verb for a guarantee only this client gate provides (copy rule 5)", () => {
    // U-07a is the single most likely regression on this surface, because the absolute
    // reads stronger and nothing in the type system objects. Gate 2 validates org and
    // `is_enabled` ONLY, so the copy says *the picker* and nothing wider.
    expect(connectionPickerSource).not.toMatch(/\bcannot\b/i)
    expect(connectionPickerSource).not.toMatch(/no step will be allowed/i)
    expect(connectionPickerSource).not.toMatch(/never bound/i)
  })

  it("those fences are real — each pattern matches its planted literal", () => {
    expect('<span title="why">x</span>').toMatch(/title=/)
    expect("a step cannot pick it").toMatch(/\bcannot\b/i)
    expect("no step will be allowed to use it").toMatch(/no step will be allowed/i)
    expect("it is never bound").toMatch(/never bound/i)
    // …and the haystack really is this component's source.
    expect(connectionPickerSource.length).toBeGreaterThan(1000)
    expect(connectionPickerSource).toContain("export function ConnectionPicker")
  })
})

// ═════════════════════════════════════════════════════════════════════════════════════════
// ⚠ ADDED, NEVER RE-BASELINED — every case above this banner is untouched by 206.2.
//
// Phase 206.2-02 tasks 1-3 (D-206.2-03 / D-206.2-08 / D-206.2-18 / D-206.2-20, UI-SPEC
// § Surface 2). The picker gained a SECOND SHAPE. Everything above this line is the
// capability shape's shipped proof and was neither edited nor re-ordered — the `shape` prop's
// default is what makes that possible, and the byte-identity block immediately below is what
// turns "makes that possible" into something a run is able to refute.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** The live fixture, from the row this phase was written for: a real remote MCP server.
 *  ⚠ `capability` is NULL and `last_check_verdict` is null — 206.1 removed `Check credential`
 *  for MCP rows, so an MCP row renders `◌ not checked` and stays SELECTABLE. An unchecked
 *  connection is not a failed one. */
const MCP: Row = {
  id: "conn-mcp",
  org_id: "org-1",
  capability: null,
  name: "DeepWiki",
  config: {},
  mcp_server_url: "https://mcp.deepwiki.com/mcp",
  is_enabled: true,
  last_check_verdict: null,
}

/** A row that is NONE of the four shapes — no capability the closed set carries, and no
 *  server URL. It exists only to prove the destination ladder's tail became NEUTRAL rather
 *  than merely re-ordered. */
const FIFTH_SHAPE: Row = {
  id: "conn-fifth",
  org_id: "org-1",
  capability: "wire_transfer",
  name: "Treasury",
  config: { iban: "NL00BANK0000000000" },
  is_enabled: true,
  last_check_verdict: "ok",
}

/** The MCP-shape render. A SEPARATE helper rather than an option on the shipped
 *  `renderPicker`, so not one shipped line moves. It passes NO `capability` at all, which is
 *  the production shape: an MCP step has none. */
function renderMcpPicker(
  opts: { config?: Record<string, unknown>; rows?: Row[]; reject?: boolean; pending?: boolean } = {},
) {
  const store = draftedStore(opts.config)
  const patch = vi.spyOn(store.getState(), "patchConfig")
  if (opts.pending) listMock.mockReturnValue(new Promise<Row[]>(() => {}))
  else if (opts.reject) listMock.mockRejectedValue(new Error("read failed"))
  else listMock.mockResolvedValue(opts.rows ?? [])
  const view = render(
    <BuilderStoreProvider store={store}>
      <SelectedPhaseSlugProvider slug={SLUG}>
        <ConnectionPicker shape="mcp" />
      </SelectedPhaseSlugProvider>
    </BuilderStoreProvider>,
  )
  return { store, patch, unmount: view.unmount, container: view.container }
}

// ── 7. THE CAPABILITY BRANCH IS BYTE-IDENTICAL (D-206.2-08 / SC#5) ───────────────────

describe("ConnectionPicker — the capability shape renders what it rendered at 206.2-02's base", () => {
  /**
   * ⚠ THE ONE DECLARED NORMALIZATION — declared, and COUNTED, rather than done quietly.
   *
   * `ConnectionPicker` calls `useId()` TWICE (`selectId`, `refusalId`) and BOTH reach the DOM:
   * `<label for>` + `<select id>`, and `<p id>` + `aria-describedby`. React's `useId` value is
   * a function of how many components rendered before it, not of this component's own markup,
   * so a case added ANYWHERE above this block moves those ids. A case added above is not a
   * behaviour change in the picker and must not be able to redden this pin — so the id VALUE
   * is normalized away.
   *
   * ⚠ THE ID FORM WAS READ OFF A REAL RENDER, NOT INHERITED. D-206.2-18 predicted React 19's
   * `«r0»` form. MEASURED on this tree at 206.2-02's base, the emitted form is **`_r_0_`** —
   * e.g. `for="_r_0_"`, `id="_r_2_"`, `aria-describedby="_r_3_"`. (Not the guillemet form, and
   * emphatically not `radix-…`, which is the DropdownMenu form `ConnectionsTab.test.tsx`
   * normalizes.) The needle below is written against what was PRINTED, which is the whole
   * point of the rule: the measurement is the authority, never the inherited assumption.
   *
   * ⚠ AND THE NORMALIZATION IS ITSELF NON-VACUOUS: the substitution count is returned and
   * asserted PER STATE — `unbound` 2, `bound` 2, `bound-failing` 4, `empty` 1, every one of
   * them measured rather than reasoned about. A render that stopped emitting an id yields a
   * lower count and goes RED, rather than quietly passing against a shorter string.
   * Normalizing without counting is how a pin stops watching the thing it names.
   */
  const USE_ID = /"_r_[^"]*"/g
  const USE_ID_NORMALIZED = '"_r_NORMALIZED_"'

  function normalizeUseIds(html: string): { html: string; replaced: number } {
    let replaced = 0
    const out = html.replace(USE_ID, () => {
      replaced += 1
      return USE_ID_NORMALIZED
    })
    return { html: out, replaced }
  }

  /** ONE render, the picker's `outerHTML`, unmounted — shared by the capture and the
   *  assertion so both read the DOM the same way (`ConnectionsTab.test.tsx:900-928`). */
  async function pickerCapture(opts: {
    capability: string
    rows: Row[]
    config?: Record<string, unknown>
  }): Promise<{ html: string; replaced: number }> {
    const view = renderPicker(opts)
    await waitFor(() =>
      expect(screen.getByTestId("connection-picker")).not.toHaveAttribute("data-state", "loading"),
    )
    const captured = normalizeUseIds(
      view.container.querySelector('[data-testid="connection-picker"]')!.outerHTML,
    )
    view.unmount()
    return captured
  }

  const CAPTURE_FIXTURES: Record<string, { capability: string; row: Row; id: string }> = {
    SEND_EMAIL: { capability: "send_email", row: mailbox(), id: "conn-ok" },
    CREATE_TICKET: { capability: "create_ticket", row: JIRA, id: "conn-jira" },
    POST_MESSAGE: { capability: "post_message", row: SLACK, id: "conn-slack" },
  }

  /** MEASURED, one per state, on a real render — never counted by hand off the source. */
  const EXPECTED_USE_IDS: Record<string, number> = {
    unbound: 2,
    bound: 2,
    "bound-failing": 4,
    empty: 1,
  }

  function optionsFor(
    key: string,
    state: string,
  ): { capability: string; rows: Row[]; config?: Record<string, unknown> } {
    const f = CAPTURE_FIXTURES[key]
    if (state === "unbound") return { capability: f.capability, rows: [f.row] }
    if (state === "bound") return { capability: f.capability, rows: [f.row], config: { connection_id: f.id } }
    if (state === "bound-failing")
      return {
        capability: f.capability,
        rows: [{ ...f.row, last_check_verdict: "failed" }],
        config: { connection_id: f.id },
      }
    return { capability: f.capability, rows: [] }
  }

  /**
   * ⚠ THESE LITERALS ARE A CAPTURE, NOT AN EXPECTATION. Every character below was READ OUT of
   * the rendered DOM of the component AS IT STOOD AT 206.2-02's BASE COMMIT (`c92c4af6`) —
   * before the `shape` prop, before the MCP arm, before the destination repair — by running
   * `pickerCapture` above through a throwaway harness and pasting what it printed. Not one
   * attribute here was typed from the source, computed by hand, or reasoned about. That is the
   * whole point: an expectation records what its author BELIEVED the markup to be, and a
   * change that moved the markup to match that belief would pass it.
   *
   * OBSERVED TWICE on the unchanged tree before any edit, and the two runs agreed byte for
   * byte — so it is a baseline rather than one sample of something that might vary.
   *
   * ⚠ NEVER RE-CAPTURED AFTERWARDS, and not one string below was hand-edited. Re-capturing
   * from the new code turns a baseline into a record of what the code now does, which is a
   * statement about nothing.
   *
   * A DIFF AGAINST THIS RECORD IS A BEHAVIOUR CHANGE IN THE CAPABILITY SHAPE — and NOT A TEST
   * TO UPDATE. 206.2 is supposed to add a second shape, not move the first one. If this goes
   * red, the new shape is wrong.
   */
  const PICKER_HTML_BASELINE: Record<string, Record<string, string>> = {
  SEND_EMAIL: {
    "unbound":
      "<div data-testid=\"connection-picker\" data-state=\"unbound\" class=\"mt-2 border-t border-border/60 pt-2\"><label class=\"peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] font-medium text-foreground\" for=\"_r_NORMALIZED_\">Where this sends</label><select id=\"_r_NORMALIZED_\" data-testid=\"connection-picker-select\" class=\"mt-1 h-7 w-full rounded border border-border bg-card px-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary\"><option value=\"\">— none —</option><option value=\"conn-ok\" data-testid=\"connection-picker-option\" data-verdict=\"ok\">Ops mailbox</option></select><p data-testid=\"connection-picker-footer\" class=\"mt-1.5 truncate font-mono text-[10.5px] leading-snug text-muted-foreground\">🔒 nothing bound — this step will record, not send</p></div>",
    "bound":
      "<div data-testid=\"connection-picker\" data-state=\"bound\" class=\"mt-2 border-t border-border/60 pt-2\"><label class=\"peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] font-medium text-foreground\" for=\"_r_NORMALIZED_\">Where this sends</label><select id=\"_r_NORMALIZED_\" data-testid=\"connection-picker-select\" class=\"mt-1 h-7 w-full rounded border border-border bg-card px-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary\"><option value=\"\">— none —</option><option value=\"conn-ok\" data-testid=\"connection-picker-option\" data-verdict=\"ok\">Ops mailbox</option></select><p data-testid=\"connection-picker-footer\" class=\"mt-1.5 truncate font-mono text-[10.5px] leading-snug text-muted-foreground\">🔒 smtp.fastmail.com:465 · from ops@northwind.co</p></div>",
    "bound-failing":
      "<div data-testid=\"connection-picker\" data-state=\"bound-failing\" class=\"mt-2 border-t border-border/60 pt-2\"><label class=\"peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] font-medium text-foreground\" for=\"_r_NORMALIZED_\">Where this sends</label><select id=\"_r_NORMALIZED_\" data-testid=\"connection-picker-select\" class=\"mt-1 h-7 w-full rounded border border-border bg-card px-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary\" aria-describedby=\"_r_NORMALIZED_\"><option value=\"\">— none —</option><option value=\"conn-ok\" data-testid=\"connection-picker-option\" data-verdict=\"failed\" aria-disabled=\"true\">Ops mailbox  ✕ credential failed</option></select><p id=\"_r_NORMALIZED_\" data-testid=\"connection-picker-refusal\" class=\"mt-1.5 text-[10.5px] leading-snug text-destructive\">This connection's credential is failing. Fix it in Settings → Connections, then pick it here.</p><p data-testid=\"connection-picker-footer\" class=\"mt-1.5 truncate font-mono text-[10.5px] leading-snug text-muted-foreground\">🔒 smtp.fastmail.com:465 · from ops@northwind.co</p></div>",
    "empty":
      "<div data-testid=\"connection-picker\" data-state=\"empty\" class=\"mt-2 border-t border-border/60 pt-2\"><label class=\"peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] font-medium text-foreground\" for=\"_r_NORMALIZED_\">Where this sends</label><p data-testid=\"connection-picker-empty\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">No email connection yet — add one in Settings → Connections.</p></div>",
  },
  CREATE_TICKET: {
    "unbound":
      "<div data-testid=\"connection-picker\" data-state=\"unbound\" class=\"mt-2 border-t border-border/60 pt-2\"><label class=\"peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] font-medium text-foreground\" for=\"_r_NORMALIZED_\">Where this sends</label><select id=\"_r_NORMALIZED_\" data-testid=\"connection-picker-select\" class=\"mt-1 h-7 w-full rounded border border-border bg-card px-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary\"><option value=\"\">— none —</option><option value=\"conn-jira\" data-testid=\"connection-picker-option\" data-verdict=\"ok\">Northwind Jira</option></select><p data-testid=\"connection-picker-footer\" class=\"mt-1.5 truncate font-mono text-[10.5px] leading-snug text-muted-foreground\">🔒 nothing bound — this step will record, not send</p></div>",
    "bound":
      "<div data-testid=\"connection-picker\" data-state=\"bound\" class=\"mt-2 border-t border-border/60 pt-2\"><label class=\"peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] font-medium text-foreground\" for=\"_r_NORMALIZED_\">Where this sends</label><select id=\"_r_NORMALIZED_\" data-testid=\"connection-picker-select\" class=\"mt-1 h-7 w-full rounded border border-border bg-card px-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary\"><option value=\"\">— none —</option><option value=\"conn-jira\" data-testid=\"connection-picker-option\" data-verdict=\"ok\">Northwind Jira</option></select><p data-testid=\"connection-picker-footer\" class=\"mt-1.5 truncate font-mono text-[10.5px] leading-snug text-muted-foreground\">🔒 northwind.atlassian.net · OPS</p></div>",
    "bound-failing":
      "<div data-testid=\"connection-picker\" data-state=\"bound-failing\" class=\"mt-2 border-t border-border/60 pt-2\"><label class=\"peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] font-medium text-foreground\" for=\"_r_NORMALIZED_\">Where this sends</label><select id=\"_r_NORMALIZED_\" data-testid=\"connection-picker-select\" class=\"mt-1 h-7 w-full rounded border border-border bg-card px-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary\" aria-describedby=\"_r_NORMALIZED_\"><option value=\"\">— none —</option><option value=\"conn-jira\" data-testid=\"connection-picker-option\" data-verdict=\"failed\" aria-disabled=\"true\">Northwind Jira  ✕ credential failed</option></select><p id=\"_r_NORMALIZED_\" data-testid=\"connection-picker-refusal\" class=\"mt-1.5 text-[10.5px] leading-snug text-destructive\">This connection's credential is failing. Fix it in Settings → Connections, then pick it here.</p><p data-testid=\"connection-picker-footer\" class=\"mt-1.5 truncate font-mono text-[10.5px] leading-snug text-muted-foreground\">🔒 northwind.atlassian.net · OPS</p></div>",
    "empty":
      "<div data-testid=\"connection-picker\" data-state=\"empty\" class=\"mt-2 border-t border-border/60 pt-2\"><label class=\"peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] font-medium text-foreground\" for=\"_r_NORMALIZED_\">Where this sends</label><p data-testid=\"connection-picker-empty\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">No ticket connection yet — add one in Settings → Connections.</p></div>",
  },
  POST_MESSAGE: {
    "unbound":
      "<div data-testid=\"connection-picker\" data-state=\"unbound\" class=\"mt-2 border-t border-border/60 pt-2\"><label class=\"peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] font-medium text-foreground\" for=\"_r_NORMALIZED_\">Where this sends</label><select id=\"_r_NORMALIZED_\" data-testid=\"connection-picker-select\" class=\"mt-1 h-7 w-full rounded border border-border bg-card px-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary\"><option value=\"\">— none —</option><option value=\"conn-slack\" data-testid=\"connection-picker-option\" data-verdict=\"ok\">#ops-alerts</option></select><p data-testid=\"connection-picker-footer\" class=\"mt-1.5 truncate font-mono text-[10.5px] leading-snug text-muted-foreground\">🔒 nothing bound — this step will record, not send</p></div>",
    "bound":
      "<div data-testid=\"connection-picker\" data-state=\"bound\" class=\"mt-2 border-t border-border/60 pt-2\"><label class=\"peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] font-medium text-foreground\" for=\"_r_NORMALIZED_\">Where this sends</label><select id=\"_r_NORMALIZED_\" data-testid=\"connection-picker-select\" class=\"mt-1 h-7 w-full rounded border border-border bg-card px-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary\"><option value=\"\">— none —</option><option value=\"conn-slack\" data-testid=\"connection-picker-option\" data-verdict=\"ok\">#ops-alerts</option></select><p data-testid=\"connection-picker-footer\" class=\"mt-1.5 truncate font-mono text-[10.5px] leading-snug text-muted-foreground\">🔒 slack.com/api · #ops-alerts</p></div>",
    "bound-failing":
      "<div data-testid=\"connection-picker\" data-state=\"bound-failing\" class=\"mt-2 border-t border-border/60 pt-2\"><label class=\"peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] font-medium text-foreground\" for=\"_r_NORMALIZED_\">Where this sends</label><select id=\"_r_NORMALIZED_\" data-testid=\"connection-picker-select\" class=\"mt-1 h-7 w-full rounded border border-border bg-card px-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary\" aria-describedby=\"_r_NORMALIZED_\"><option value=\"\">— none —</option><option value=\"conn-slack\" data-testid=\"connection-picker-option\" data-verdict=\"failed\" aria-disabled=\"true\">#ops-alerts  ✕ credential failed</option></select><p id=\"_r_NORMALIZED_\" data-testid=\"connection-picker-refusal\" class=\"mt-1.5 text-[10.5px] leading-snug text-destructive\">This connection's credential is failing. Fix it in Settings → Connections, then pick it here.</p><p data-testid=\"connection-picker-footer\" class=\"mt-1.5 truncate font-mono text-[10.5px] leading-snug text-muted-foreground\">🔒 slack.com/api · #ops-alerts</p></div>",
    "empty":
      "<div data-testid=\"connection-picker\" data-state=\"empty\" class=\"mt-2 border-t border-border/60 pt-2\"><label class=\"peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-[11px] font-medium text-foreground\" for=\"_r_NORMALIZED_\">Where this sends</label><p data-testid=\"connection-picker-empty\" class=\"mt-1.5 text-[10.5px] leading-snug text-muted-foreground\">No message connection yet — add one in Settings → Connections.</p></div>",
  },
  }

  for (const key of Object.keys(PICKER_HTML_BASELINE)) {
    for (const state of Object.keys(EXPECTED_USE_IDS)) {
      it(`the ${key} picker in state ${state} is byte-identical to 206.2-02's base`, async () => {
        // ── NON-VACUITY FIRST. Byte-identity against an empty capture passes forever. ──
        expect(PICKER_HTML_BASELINE[key][state].length).toBeGreaterThan(0)

        const actual = await pickerCapture(optionsFor(key, state))
        // The normalization is non-vacuous, and its count is the measured one for this state.
        expect(actual.replaced).toBe(EXPECTED_USE_IDS[state])
        expect(actual.html).toBe(PICKER_HTML_BASELINE[key][state])
      })
    }
  }

  // ── THE MARKER ROWS ────────────────────────────────────────────────────────────────
  // Byte-identity alone is compatible with a render that quietly stopped painting something:
  // the non-vacuity lines above prove only that the string is non-empty. These say WHAT each
  // capture CONTAINS, and they read the COMMITTED baseline strings, never a fresh render —
  // the claim being pinned is about what was captured at the base commit.

  it("every bound capture holds the label, the `— none —` option and the 🔒 footer", () => {
    for (const key of Object.keys(PICKER_HTML_BASELINE)) {
      const html = PICKER_HTML_BASELINE[key].bound
      expect(html).toContain(CONNECTION_PICKER_LABEL)
      expect(html).toContain(CONNECTION_PICKER_NONE_OPTION)
      expect(html).toContain('data-testid="connection-picker-select"')
      expect(html).toContain('data-testid="connection-picker-footer"')
      expect(html).toContain("🔒")
    }
  })

  it("the POST_MESSAGE capture named Slack's code-constant host — the arm 206.2 made EXPLICIT", () => {
    // ⚠ This is the arm that was a positional tail at the base commit. Its RENDERING is
    // unchanged; what changed is that it now names its own condition (D-206.2-20).
    expect(PICKER_HTML_BASELINE.POST_MESSAGE.bound).toContain(SLACK_FIXED_DESTINATION)
    expect(PICKER_HTML_BASELINE.SEND_EMAIL.bound).not.toContain(SLACK_FIXED_DESTINATION)
    expect(PICKER_HTML_BASELINE.CREATE_TICKET.bound).not.toContain(SLACK_FIXED_DESTINATION)
  })

  it("every bound-failing capture holds the refusal wired by aria-describedby", () => {
    for (const key of Object.keys(PICKER_HTML_BASELINE)) {
      const html = PICKER_HTML_BASELINE[key]["bound-failing"]
      expect(html).toContain("aria-describedby")
      expect(html).toContain(CONNECTION_PICKER_FAILING_REFUSAL)
      expect(html).toContain('aria-disabled="true"')
    }
  })

  it("⚠ NO capability capture carries `data-empty-reason` — AR-04's asymmetry, at the baseline", () => {
    // The attribute is MCP-shape only, deliberately: adding it here would change the very
    // bytes D-206.2-08 pins. The non-vacuity control for this claim is the live case in §9,
    // which asserts the MCP shape's node HAS one.
    for (const key of Object.keys(PICKER_HTML_BASELINE)) {
      for (const state of Object.keys(EXPECTED_USE_IDS)) {
        expect(PICKER_HTML_BASELINE[key][state]).not.toContain("data-empty-reason")
      }
    }
    // …and the empty captures really are the empty state, so the sweep above is not vacuous.
    for (const key of Object.keys(PICKER_HTML_BASELINE)) {
      expect(PICKER_HTML_BASELINE[key].empty).toContain('data-state="empty"')
    }
  })
})

// ── 8. THE MCP READ — the one line SEED-200 is about (SC#1a / SC#1b / SC#1c) ─────────

describe("ConnectionPicker — the MCP shape reads unfiltered", () => {
  it("SC#1a — the MCP shape calls listConnectorConnections() with ZERO arguments", async () => {
    // The shipped read passes a capability. An MCP row's capability is NULL, so it was
    // filtered out of every read this picker ever performed, `bound?.mcp_server_url` was
    // unsatisfiable, and the `McpToolPicker` mount was dead. That single argument is SEED-200.
    renderMcpPicker({ rows: [MCP] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    expect(listMock).toHaveBeenCalledWith()
    expect(listMock.mock.calls[0]).toEqual([])
  })

  it("POSITIVE CONTROL — the capability shape still passes its capability", async () => {
    // Without this, a picker that had simply stopped passing arguments at all would pass the
    // case above while breaking every shipped surface.
    renderPicker({ capability: "send_email", rows: [mailbox()] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    expect(listMock).toHaveBeenCalledWith("send_email")
  })

  it("SC#1b — neither shape lists the other's rows, from ONE org holding both", async () => {
    // ⚠ THE TWO HALVES ARE ENFORCED IN TWO DIFFERENT PLACES, AND SAYING SO IS THE POINT.
    // The MCP half is a CLIENT filter and is asserted directly below: the response really does
    // carry both rows, and the picker really does drop one. The capability half is the
    // SERVER's `?capability=` predicate — the client owes only the ARGUMENT there — so the
    // fake below applies that predicate exactly as `api.ts` builds it. A fake that ignored its
    // argument would let this case claim a client filter that does not exist.
    const ORG = [SLACK, MCP]
    listMock.mockImplementation((capability?: string) =>
      Promise.resolve(capability ? ORG.filter((row) => row.capability === capability) : ORG),
    )

    // Rendered directly rather than through either helper: both helpers set a fixed resolved
    // value, which would replace the server-shaped fake this case depends on.
    const mount = (node: React.ReactNode) =>
      render(
        <BuilderStoreProvider store={draftedStore()}>
          <SelectedPhaseSlugProvider slug={SLUG}>{node}</SelectedPhaseSlugProvider>
        </BuilderStoreProvider>,
      )

    const mcp = mount(<ConnectionPicker shape="mcp" />)
    await waitFor(() => expect(select()).toBeInTheDocument())
    // The unfiltered read returned BOTH rows — the client is what narrowed them.
    expect(listMock).toHaveBeenCalledWith()
    await expect(listMock.mock.results[0].value).resolves.toHaveLength(2)
    expect(screen.getAllByTestId("connection-picker-option").map((o) => o.getAttribute("value"))).toEqual([
      "conn-mcp",
    ])
    mcp.unmount()

    mount(<ConnectionPicker capability="post_message" />)
    await waitFor(() => expect(select()).toBeInTheDocument())
    expect(listMock).toHaveBeenLastCalledWith("post_message")
    expect(screen.getAllByTestId("connection-picker-option").map((o) => o.getAttribute("value"))).toEqual([
      "conn-slack",
    ])
  })

  it("SC#1c — a DISABLED MCP row is not a choice either; the rule is not laxer here", async () => {
    renderMcpPicker({ rows: [{ ...MCP, is_enabled: false }] })
    await waitFor(() => expect(screen.getByTestId("connection-picker-empty")).toBeInTheDocument())
    expect(screen.queryByTestId("connection-picker-select")).not.toBeInTheDocument()
  })

  it("a provider-less render opens NO request in the MCP shape either", () => {
    expect(() => render(<ConnectionPicker shape="mcp" />)).not.toThrow()
    expect(screen.getByTestId("connection-picker")).toHaveAttribute("data-state", "disconnected")
    expect(listMock).not.toHaveBeenCalled()
  })

  it("the MCP shape keeps the read-failure reading — four facts stay four", async () => {
    renderMcpPicker({ reject: true })
    await waitFor(() => expect(screen.getByTestId("connection-picker-error")).toBeInTheDocument())
    expect(screen.getByRole("alert").textContent).toBe(CONNECTION_PICKER_READ_FAILED)
    expect(screen.queryByTestId("connection-picker-empty")).not.toBeInTheDocument()
  })
})

// ── 9. THREE ABSENCES, THREE SENTENCES (UI-SPEC § Surface 2 / AR-04) ─────────────────

describe("ConnectionPicker — the MCP shape's two empty facts are two", () => {
  it('no MCP row at all ⇒ data-empty-reason="none" and its own sentence', async () => {
    // A capability row in the response is not an MCP row, so this is genuinely "none exist".
    renderMcpPicker({ rows: [SLACK] })
    await waitFor(() => expect(screen.getByTestId("connection-picker-empty")).toBeInTheDocument())
    const note = screen.getByTestId("connection-picker-empty")
    expect(note.getAttribute("data-empty-reason")).toBe("none")
    expect(note.textContent).toBe(CONNECTION_PICKER_NO_MCP_NOTE)
    // TEXT ONLY, NO LINK — the shipped rule, for the shipped reason.
    expect(note.querySelector("a")).toBeNull()
  })

  it("MCP rows exist but every one is switched off ⇒ a DIFFERENT sentence", async () => {
    // ⚠ Folding these two is the defect this tree has recorded five times. An author told
    // "none yet" while one sits disabled goes and creates a duplicate.
    renderMcpPicker({ rows: [{ ...MCP, is_enabled: false }, SLACK] })
    await waitFor(() => expect(screen.getByTestId("connection-picker-empty")).toBeInTheDocument())
    const note = screen.getByTestId("connection-picker-empty")
    expect(note.getAttribute("data-empty-reason")).toBe("all-disabled")
    expect(note.textContent).toBe(CONNECTION_PICKER_MCP_ALL_DISABLED)
  })

  it("the two sentences are really different, and neither is the capability sentence", () => {
    expect(CONNECTION_PICKER_NO_MCP_NOTE).not.toBe(CONNECTION_PICKER_MCP_ALL_DISABLED)
    expect(CONNECTION_PICKER_NO_MCP_NOTE).not.toBe(noConnectionYetNote(""))
    expect(CONNECTION_PICKER_NO_MCP_NOTE).not.toBe(noConnectionYetNote("send_email"))
  })

  it("⚠ THE FILTER ORDER — a disabled SLACK row does NOT make the MCP shape say `all-disabled`", async () => {
    // Counting before the shape filter would report "every MCP connection is switched off"
    // whenever the only disabled row in the org was a capability connection. This is the case
    // that makes the filter order load-bearing rather than incidental.
    renderMcpPicker({ rows: [{ ...SLACK, is_enabled: false }] })
    await waitFor(() => expect(screen.getByTestId("connection-picker-empty")).toBeInTheDocument())
    expect(screen.getByTestId("connection-picker-empty").getAttribute("data-empty-reason")).toBe("none")
  })

  it("NON-VACUITY CONTROL for AR-04 — the capability shape's empty node has NO such attribute", async () => {
    renderPicker({ capability: "send_email", rows: [] })
    await waitFor(() => expect(screen.getByTestId("connection-picker-empty")).toBeInTheDocument())
    const note = screen.getByTestId("connection-picker-empty")
    expect(note.hasAttribute("data-empty-reason")).toBe(false)
    expect(note.textContent).toBe(noConnectionYetNote("send_email"))
  })

  it("the WR-04 conversion changed no rendered word, and the inherited key now falls back", async () => {
    for (const [capability, word] of [
      ["send_email", "email"],
      ["create_ticket", "ticket"],
      ["post_message", "message"],
    ]) {
      const { unmount } = renderPicker({ capability, rows: [] })
      await waitFor(() => expect(screen.getByTestId("connection-picker-empty")).toBeInTheDocument())
      expect(screen.getByTestId("connection-picker-empty").textContent).toBe(
        `No ${word} connection yet — add one in Settings → Connections.`,
      )
      unmount()
    }
    // …and the inherited-key read that made the conversion necessary now returns the FALLBACK
    // rather than a stringified function. `constructor` is the canonical WR-04 needle.
    expect(noConnectionYetNote("constructor")).toBe(
      "No external connection yet — add one in Settings → Connections.",
    )
    expect(noConnectionYetNote("constructor")).not.toContain("function")
    expect(noConnectionYetNote("__proto__")).toBe(
      "No external connection yet — add one in Settings → Connections.",
    )
  })
})

// ── 10. THE FOOTER — the repaired ladder, and the control that proves the tail ───────

describe("ConnectionPicker — destinationPartsOf names the right host", () => {
  it("an MCP row's footer names its OWN host, and NOT the path segment", async () => {
    renderMcpPicker({ rows: [MCP], config: { connection_id: "conn-mcp" } })
    await waitFor(() => expect(select()).toBeInTheDocument())
    const footer = screen.getByTestId("connection-picker-footer")
    expect(footer.textContent).toBe("🔒 mcp.deepwiki.com")
    // HOST ONLY — the path is the server's business.
    expect(footer.textContent).not.toContain("/mcp")
    // ⚠ THE DEFECT, NAMED. At this plan's base this footer read `🔒 slack.com/api`.
    expect(footer.textContent).not.toContain(SLACK_FIXED_DESTINATION)
  })

  it("a malformed mcp_server_url renders the raw string rather than throwing", () => {
    // Degrade, never throw: the raw string is the truest thing available when it does not
    // split, and a footer that threw would take the whole step panel down.
    const malformed = { ...MCP, mcp_server_url: "not a url" } as never
    expect(() => destinationPartsOf(malformed)).not.toThrow()
    expect(destinationPartsOf(malformed)).toEqual(["not a url"])
  })

  it("⚠ THE SYNTHETIC FIFTH SHAPE — no destination at all, and specifically NOT Slack's", () => {
    // This is the control that proves the tail became NEUTRAL rather than merely re-ordered.
    // BOTH halves are asserted: "not Slack" alone would pass on a footer naming some other
    // wrong host, and "empty" alone would pass on a ladder that returned [] for everything —
    // which the positive control below refutes.
    const parts = destinationPartsOf(FIFTH_SHAPE as never)
    expect(parts).toEqual([])
    expect(parts.join(" · ")).not.toContain(SLACK_FIXED_DESTINATION)
  })

  it("POSITIVE CONTROL — the four known shapes still name their destinations", () => {
    expect(destinationPartsOf(mailbox() as never)).toEqual([
      "smtp.fastmail.com:465",
      "from ops@northwind.co",
    ])
    expect(destinationPartsOf(JIRA as never)).toEqual(["northwind.atlassian.net", "OPS"])
    expect(destinationPartsOf(SLACK as never)).toEqual([SLACK_FIXED_DESTINATION, "#ops-alerts"])
    expect(destinationPartsOf(MCP as never)).toEqual(["mcp.deepwiki.com"])
  })
})

// ── 11. THE MOUNT THAT WAS DEAD CODE AT THIS PLAN'S BASE ─────────────────────────────

describe("ConnectionPicker — the McpToolPicker mount becomes reachable", () => {
  it("binding an MCP row through the picker's own <select> renders the tool picker", async () => {
    // ⚠ THIS CASE IS **not SC#4's** EVIDENCE, AND THE LABEL IS THE POINT. It hands
    // `ConnectionPicker` a `shape` prop BY HAND, and a test that constructs its own props is
    // structurally unable to see that nothing constructs them in production — which is exactly
    // what SEED-200 is about. The two-legged guard (D-206.2-07 / D-206.2-12) belongs to
    // `206.2-04`, because its second leg must run through `ExternalActionSection` and
    // construct no component prop at all.
    const { patch } = renderMcpPicker({ rows: [MCP] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    expect(screen.queryByTestId("mcp-tool-picker")).not.toBeInTheDocument()

    fireEvent.change(select(), { target: { value: "conn-mcp" } })

    expect(patch).toHaveBeenCalledWith(SLUG, { connection_id: "conn-mcp" })
    await waitFor(() => expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument())
  })

  it("an MCP row is SELECTABLE — a null verdict is `◌ not checked`, not a failure", async () => {
    renderMcpPicker({ rows: [MCP] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    const option = screen.getByRole("option", { name: `DeepWiki ${CONNECTION_STATE_NOT_CHECKED}` })
    expect(option).not.toHaveAttribute("aria-disabled")
  })

  it("NEGATIVE CONTROL — a bound CAPABILITY row mounts no tool picker", async () => {
    renderPicker({ capability: "send_email", rows: [mailbox()], config: { connection_id: "conn-ok" } })
    await waitFor(() => expect(select()).toBeInTheDocument())
    expect(screen.queryByTestId("mcp-tool-picker")).not.toBeInTheDocument()
  })
})

// ── 12. THE NEW SOURCE FENCES ────────────────────────────────────────────────────────

describe("ConnectionPicker — 206.2 source discipline", () => {
  it("`api.ts` is not consulted for a new export — the MCP read is the SHIPPED function", () => {
    // The no-argument path already ships (`api.ts` builds an empty query string for a falsy
    // argument), so this is a call-site change. Phase 207 owns that file.
    expect(connectionPickerSource).toContain("listConnectorConnections()")
    expect(connectionPickerSource).toContain("listConnectorConnections(capability)")
    expect(connectionPickerSource.length).toBeGreaterThan(1000)
  })

  it("the WR-04 sink is closed AT SOURCE — no bare bracket read survives", () => {
    expect(connectionPickerSource).toContain("own(CONNECTION_CAPABILITY_WORDS")
    // ⚠ The forbidden spelling is BUILT here rather than written out, because a fence whose
    // own prose spells the token it forbids counts itself — the 187-24 trap, which has fired
    // eleven times in this tree.
    const forbidden = "CONNECTION_CAPABILITY_WORDS" + "["
    expect(connectionPickerSource).not.toContain(forbidden)
    // …and the needle is real: it matches the shape it names.
    expect("x = CONNECTION_CAPABILITY_WORDS[k]").toContain(forbidden)
  })

  it("the destination ladder's tail is NEUTRAL at source, and the Slack arm names itself", () => {
    expect(connectionPickerSource).toContain('connection.capability === "post_message"')
    expect(connectionPickerSource).toContain("if (connection.mcp_server_url)")
  })
})
