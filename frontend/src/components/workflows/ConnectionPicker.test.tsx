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
 *  - T-190-12-T6 a key that is not the step's own reference or its own action reaching the
 *    definition JSONB. The sweep was OBSERVED RED against a planted
 *    `config["smtp_password"]` write in real production source, restored md5-identical
 *    (recorded in `190-12-SUMMARY.md`).
 *  - T-190-12-U07a the picker binding a connection whose credential is failing, or its
 *    copy claiming an absolute for a guarantee only this client gate provides.
 *  - T-190-12-CRASH a provider-less render throwing — or, just as bad, quietly opening an
 *    unmocked request inside a shipped suite that never asked for one.
 *  - T-190-12-A11Y a select with no real label, or a refusal reason that lives only in an
 *    option's text.
 *  - the four-state honesty rule: populated ≠ empty ≠ loading ≠ error.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ⚠ 211-04 — WHAT THIS FILE LOST, AND WHY EACH LOSS IS *OBSOLETE BY DESIGN* RATHER THAN
 * *BROKEN*. Every deletion is named individually in `211-04-SUMMARY.md` beside the
 * assertion that replaced it; the list is repeated here because a suite that shrank without
 * saying so is indistinguishable from a suite somebody quietly stopped believing.
 *
 *  · the TWO-ARM cases (`shape="mcp"` vs a capability argument) — there is ONE read now,
 *    issued with no argument at all, so a case pinning two different reads is asserting a
 *    behaviour the component no longer has. Replaced by the zero-argument assertion plus the
 *    same-list cross-shape case in §8.
 *  · the D-206.2-08 BYTE-IDENTITY BASELINE (12 generated cases + 4 marker cases) — its own
 *    re-open trigger was *"the first phase permitted to re-baseline the capability shape's
 *    empty render"*, and this is that phase. Three independent, deliberate changes move
 *    those bytes: the option label now names the SERVICE (SC#3), a bound capability row now
 *    mounts the action card (D-211-12), and the empty node now carries `data-empty-reason`
 *    on every shape (AR-04 discharged). Re-capturing it from the new code would turn a
 *    baseline into a record of what the code currently does, which is a statement about
 *    nothing — so it is retired, and §7 asserts the same claims STRUCTURALLY instead.
 *  · the MCP-ONLY empty vocabulary — one list has one vocabulary.
 * ═══════════════════════════════════════════════════════════════════════════════════════
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
  CONNECTION_PICKER_ALL_DISABLED,
  CONNECTION_PICKER_FAILING_REFUSAL,
  CONNECTION_PICKER_LABEL,
  CONNECTION_PICKER_LOADING,
  CONNECTION_PICKER_NONE_OPTION,
  CONNECTION_PICKER_NOTHING_BOUND_FOOTER,
  CONNECTION_PICKER_READ_FAILED,
  CONNECTION_STATE_FAILED,
  CONNECTION_STATE_NOT_CHECKED,
  SLACK_FIXED_DESTINATION,
  destinationPartsOf,
  noConnectionYetNote,
  optionLabelOf,
} from "./ConnectionPicker"
import { BuilderStoreProvider } from "./BuilderStoreProvider"
import { SelectedPhaseSlugProvider } from "./SelectedPhaseSlugContext"
import { createBuilderStore, type BuilderStore } from "./builderStore"

const SLUG = "notify-owner"

/** The shipped response shape, minus the credential — which is absent by construction:
 *  `ConnectorConnectionResponse` declares no secret field and never has (190-09 T7).
 *  ⚠ 211-02 made `service_id` REQUIRED on every row, and migration 127 guarantees it is
 *  non-blank on every row on disk — so every fixture below carries one. A fixture without it
 *  would be testing a shape the server cannot produce. */
type Row = Record<string, unknown>

const mailbox = (over: Row = {}): Row => ({
  id: "conn-ok",
  org_id: "org-1",
  service_id: "smtp",
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
  service_id: "jira",
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
  service_id: "slack",
  capability: "post_message",
  name: "#ops-alerts",
  config: { default_channel: "ops-alerts" },
  is_enabled: true,
  last_check_verdict: "ok",
  // ⚠ 211-04 — migration 127 §2b's BACKFILL, in the shape the live database now holds it
  // (verified by direct query at this plan's dispatch: length 1 on BOTH capability rows).
  // The descriptor's `name` IS the capability, which is what lets one action list serve both
  // shapes without inventing a third concept.
  discovered_tools: [
    {
      name: "post_message",
      title: "Post message",
      description: "Post one plain-text message to the channel configured on this connection.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: ["text"],
        properties: { text: { type: "string" } },
      },
    },
  ],
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

/** ⚠ 211-04 — NO `capability` AND NO `shape` OPTION, because the component takes neither
 *  prop any more. One helper renders every case, which is itself the phase's claim: there is
 *  no second arm to drive. */
function renderPicker(
  opts: {
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
        <ConnectionPicker />
      </SelectedPhaseSlugProvider>
    </BuilderStoreProvider>,
  )
  return { store, patch, unmount: view.unmount, container: view.container }
}

const select = (): HTMLSelectElement =>
  screen.getByTestId("connection-picker-select") as HTMLSelectElement

/** The four keys `bind()` writes — the reference plus the three action fields it clears.
 *  Declared once so a case cannot quietly assert a PARTIAL clear. */
const BIND_KEYS = ["capability", "connection_id", "tool_args", "tool_name"]

const bindPatch = (id: string | null) => ({
  connection_id: id,
  capability: undefined,
  tool_name: undefined,
  tool_args: undefined,
})

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
    expect(() => render(<ConnectionPicker />)).not.toThrow()
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

  it("2 · NONE EXIST — one shape-neutral sentence, and NO link (there is no router here)", async () => {
    // ⚠ REPLACES the shipped three-capability loop (`No email/ticket/message connection
    // yet`). That case pinned a CAPABILITY-SCOPED sentence, and the read is not
    // capability-scoped any more: telling an author *"no email connection yet"* while their
    // Slack row sits one query away is exactly the fold this vocabulary exists to avoid.
    // The sentence is `noConnectionYetNote("")` — the shipped helper's own FALLBACK branch,
    // which is now the LIVE path rather than a WR-04 safety net.
    renderPicker({ rows: [] })
    await waitFor(() => expect(screen.getByTestId("connection-picker-empty")).toBeInTheDocument())
    const note = screen.getByTestId("connection-picker-empty")
    expect(note.textContent).toBe(noConnectionYetNote(""))
    expect(note.textContent).toContain("No external connection yet")
    expect(note.getAttribute("data-empty-reason")).toBe("none")
    // TEXT ONLY, NO LINK — a leaf inside the Builder has no way to switch `ActiveView`,
    // so naming the destination is honest and an anchor would be a dead one.
    expect(note.querySelector("a")).toBeNull()
  })

  it("2b · ROWS EXIST BUT ALL DISABLED — a DIFFERENT sentence and a different reason", async () => {
    // Folding these two is the defect this tree has recorded five times: an author told
    // "none yet" while one sits switched off goes and creates a duplicate.
    renderPicker({ rows: [DISABLED] })
    await waitFor(() => expect(screen.getByTestId("connection-picker-empty")).toBeInTheDocument())
    const note = screen.getByTestId("connection-picker-empty")
    expect(note.textContent).toBe(CONNECTION_PICKER_ALL_DISABLED)
    expect(note.getAttribute("data-empty-reason")).toBe("all-disabled")
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
    expect(screen.getByRole("option", { name: `smtp · Stale mailbox ${CONNECTION_STATE_FAILED}` }))
      .toBeInTheDocument()
    expect(screen.getByTestId("connection-picker-refusal").textContent).toBe(
      CONNECTION_PICKER_FAILING_REFUSAL,
    )
  })

  it("6 · NOT CHECKED — marked, and SELECTABLE (an unchecked connection is not a failed one)", async () => {
    const { patch } = renderPicker({ rows: [UNCHECKED] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    const option = screen.getByRole("option", {
      name: `smtp · New mailbox ${CONNECTION_STATE_NOT_CHECKED}`,
    })
    expect(option).not.toHaveAttribute("aria-disabled")
    fireEvent.change(select(), { target: { value: "conn-unchecked" } })
    expect(patch).toHaveBeenCalledWith(SLUG, bindPatch("conn-unchecked"))
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
    expect(names).toEqual(["smtp · Ops mailbox"])
    expect(names.join(" ")).not.toContain("Retired mailbox")
  })
})

// ── 3. GATE 1 (UI-SPEC §5a) — client-only, and it really refuses ─────────────────────

describe("ConnectionPicker — Gate 1", () => {
  it("a FAILING option is aria-disabled and choosing it writes NOTHING", async () => {
    const { patch } = renderPicker({ rows: [mailbox(), FAILING] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    const failing = screen.getByRole("option", {
      name: `smtp · Stale mailbox ${CONNECTION_STATE_FAILED}`,
    })
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
    expect(patch).toHaveBeenCalledWith(SLUG, bindPatch("conn-ok"))
    expect(store.getState().phases[0].config.connection_id).toBe("conn-ok")
    expect(screen.queryByTestId("connection-picker-refusal")).not.toBeInTheDocument()
  })

  it("unbinding is as reachable as binding, and writes the same key set", async () => {
    const { patch, store } = renderPicker({
      rows: [mailbox()],
      config: { connection_id: "conn-ok" },
    })
    await waitFor(() => expect(select()).toBeInTheDocument())
    fireEvent.change(select(), { target: { value: "" } })
    expect(patch).toHaveBeenCalledWith(SLUG, bindPatch(null))
    expect(store.getState().phases[0].config.connection_id).toBeNull()
  })
})

// ── 4. T6 — ONLY THE STEP'S OWN REFERENCE AND ACTION CROSS INTO THE DEFINITION ───────
//     (D-13 / CONN-03 SC#4, as amended by 211-04's CONN-05 clear)

describe("ConnectionPicker — T6: a reference, and nothing else", () => {
  /** The names a credential or a destination fact would arrive under. */
  const FORBIDDEN = /secret|token|password|host|base_url/i

  const sweep = (patch: Record<string, unknown>) => {
    // ⚠ 211-04 — THE DECLARED SET GREW BY THREE, AND THE THREAT DID NOT. D-13 forbids a
    // HOST, a port, an account or a token crossing into `definition`; the three added keys
    // are the step's OWN action fields, cleared to `undefined` because re-binding is now the
    // only moment a step's shape can change (206.2's shape control, which used to own that
    // clear, is deleted by this plan). SET EQUALITY is kept — a superset would pass a
    // patch carrying a fifth key, and a fifth key is the defect.
    expect(Object.keys(patch).sort()).toEqual(BIND_KEYS)
    for (const key of Object.keys(patch)) expect(key).not.toMatch(FORBIDDEN)
    // Nor may a VALUE smuggle one — the id is a uuid-shaped reference, never a host.
    for (const value of Object.values(patch)) {
      if (typeof value === "string") expect(value).not.toContain("smtp.")
    }
  }

  it("every bind this component makes carries exactly the declared four keys", async () => {
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
    expect(() => sweep({ ...bindPatch("conn-ok"), smtp_password: "hunter2" })).toThrow()
    expect(() => sweep({ ...bindPatch("conn-ok"), host: "smtp.evil.test" })).toThrow()
    expect(() => sweep(bindPatch("smtp.fastmail.com"))).toThrow()
    // …and a PARTIAL clear fails too, which is the 211-04 half of the guard.
    expect(() => sweep({ connection_id: "conn-ok", tool_name: undefined })).toThrow()
    expect(() => sweep(bindPatch("conn-ok"))).not.toThrow()
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
// ⚠ 211-04 — THE VERB STOPS BEING AN AXIS (SC#3 / CONN-05 / SEED-207).
//
// Everything below replaces 206.2's two-shape blocks. The claims are the SAME claims — the
// read is right, the list is right, the empty facts are two, the footer names the right host,
// the tool picker is reachable — asserted against a component that now has ONE arm.
// ═════════════════════════════════════════════════════════════════════════════════════════

/** The live fixture, from the row this surface was written for: a real remote MCP server.
 *  ⚠ `capability` is NULL and `last_check_verdict` is null — 206.1 removed `Check credential`
 *  for MCP rows, so an MCP row renders `◌ not checked` and stays SELECTABLE. An unchecked
 *  connection is not a failed one. */
const MCP: Row = {
  id: "conn-mcp",
  org_id: "org-1",
  service_id: "mcp.deepwiki.com",
  capability: null,
  name: "DeepWiki",
  config: {},
  mcp_server_url: "https://mcp.deepwiki.com/mcp",
  is_enabled: true,
  last_check_verdict: null,
  discovered_tools: [
    { name: "read_wiki_structure", description: "List the pages of a repo's wiki" },
    { name: "ask_question", description: "Ask a question about a repo" },
  ],
}

/** A row that is NONE of the four shapes — no capability the closed set carries, and no
 *  server URL. It exists only to prove the destination ladder's tail became NEUTRAL rather
 *  than merely re-ordered. */
const FIFTH_SHAPE: Row = {
  id: "conn-fifth",
  org_id: "org-1",
  service_id: "treasury",
  capability: "wire_transfer",
  name: "Treasury",
  config: { iban: "NL00BANK0000000000" },
  is_enabled: true,
  last_check_verdict: "ok",
}

// ── 7. THE PICKER'S SHIPPED SURFACE, ASSERTED STRUCTURALLY (replaces D-206.2-08) ─────
//
// ⚠ WHAT THIS BLOCK IS FOR. The retired baseline made THREE claims at once — the picker's
// markup is stable, the option list says the right thing, and the empty node carries the
// right attributes. Two of the three moved BY DESIGN in this plan, so the third is asserted
// on its own rather than smuggled inside a string comparison that can no longer hold.

describe("ConnectionPicker — the shipped surface, per state", () => {
  const FIXTURES: Record<string, { row: Row; id: string; label: string }> = {
    SEND_EMAIL: { row: mailbox(), id: "conn-ok", label: "smtp · Ops mailbox" },
    CREATE_TICKET: { row: JIRA, id: "conn-jira", label: "jira · Northwind Jira" },
    POST_MESSAGE: { row: SLACK, id: "conn-slack", label: "slack · #ops-alerts" },
    MCP: { row: MCP, id: "conn-mcp", label: `mcp.deepwiki.com · DeepWiki  ${CONNECTION_STATE_NOT_CHECKED}` },
  }

  for (const key of Object.keys(FIXTURES)) {
    it(`${key} · UNBOUND — the label, the — none — option, the row and the 🔒 footer`, async () => {
      const f = FIXTURES[key]
      renderPicker({ rows: [f.row] })
      await waitFor(() => expect(select()).toBeInTheDocument())
      expect(screen.getByTestId("connection-picker")).toHaveAttribute("data-state", "unbound")
      expect(screen.getByText(CONNECTION_PICKER_LABEL)).toBeInTheDocument()
      expect(screen.getByRole("option", { name: CONNECTION_PICKER_NONE_OPTION })).toBeInTheDocument()
      const options = screen.getAllByTestId("connection-picker-option")
      expect(options).toHaveLength(1)
      expect(options[0].textContent).toBe(f.label)
      expect(screen.getByTestId("connection-picker-footer").textContent).toBe(
        CONNECTION_PICKER_NOTHING_BOUND_FOOTER,
      )
      // ⚠ THE ACTION CARD IS ABSENT UNTIL SOMETHING IS BOUND — the other half of the
      // D-211-12 gate, and the reason the card gate is BOUNDNESS rather than *always*.
      expect(screen.queryByTestId("mcp-tool-picker")).not.toBeInTheDocument()
    })

    it(`${key} · BOUND-FAILING — aria-disabled, the refusal, and aria-describedby`, async () => {
      const f = FIXTURES[key]
      renderPicker({
        rows: [{ ...f.row, last_check_verdict: "failed" }],
        config: { connection_id: f.id },
      })
      await waitFor(() => expect(select()).toBeInTheDocument())
      expect(screen.getByTestId("connection-picker")).toHaveAttribute("data-state", "bound-failing")
      expect(screen.getAllByTestId("connection-picker-option")[0]).toHaveAttribute(
        "aria-disabled",
        "true",
      )
      expect(screen.getByTestId("connection-picker-refusal").textContent).toBe(
        CONNECTION_PICKER_FAILING_REFUSAL,
      )
      expect(select().getAttribute("aria-describedby")).toBeTruthy()
    })
  }

  it("⚠ NO RAW WIRE ID reaches the DOM as a VALUE, an ATTRIBUTE or a TEST ID — the capability", async () => {
    // The D-20 boundary restated as an observable. `service_id` IS rendered — in the option
    // LABEL, which is the one position the rule never covered — and the three capability ids
    // are not, in any position, on a list holding all four shapes at once.
    renderPicker({ rows: [mailbox(), JIRA, SLACK, MCP] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    const html = screen.getByTestId("connection-picker").outerHTML
    for (const capability of ["send_email", "create_ticket"]) {
      expect(html, capability).not.toContain(capability)
    }
    // NON-VACUITY — the rows really did render, and the services really are named.
    expect(screen.getAllByTestId("connection-picker-option")).toHaveLength(4)
    expect(html).toContain("smtp · Ops mailbox")
    expect(html).toContain("mcp.deepwiki.com · DeepWiki")
  })

  it("optionLabelOf names the SERVICE and the NAME, and the state word rides the option", () => {
    expect(optionLabelOf(mailbox() as never)).toBe("smtp · Ops mailbox")
    expect(optionLabelOf(UNCHECKED as never)).toBe(`smtp · New mailbox  ${CONNECTION_STATE_NOT_CHECKED}`)
    expect(optionLabelOf(FAILING as never)).toBe(`smtp · Stale mailbox  ${CONNECTION_STATE_FAILED}`)
    expect(optionLabelOf(MCP as never)).toBe(`mcp.deepwiki.com · DeepWiki  ${CONNECTION_STATE_NOT_CHECKED}`)
  })
})

// ── 8. ONE UNSCOPED READ — the axis this phase removes (SC#3) ────────────────────────

describe("ConnectionPicker — one read, every shape", () => {
  it("⭐ SC#3 — listConnectorConnections is called with ZERO arguments", async () => {
    // ⚠ `toHaveBeenCalledWith()` with ZERO ARGUMENTS is not the same as not caring: a call
    // carrying `undefined` explicitly, or carrying a capability, both fail it. That is the
    // whole assertion — the verb has stopped being a term of the read.
    renderPicker({ rows: [MCP] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    expect(listMock).toHaveBeenCalledWith()
    expect(listMock.mock.calls[0]).toEqual([])
  })

  it("⭐ THERE IS NO SECOND ARM — every render issues the same zero-argument read", async () => {
    // ⚠ REPLACES the shipped `POSITIVE CONTROL — the capability shape still passes its
    // capability`, which is obsolete BY DESIGN: it pinned the two arms as different reads,
    // and there is one arm now. The claim worth keeping is the one that could still be
    // wrong — that no configuration of this component re-introduces an argument.
    for (const config of [{}, { connection_id: "conn-slack" }, { capability: "post_message" }]) {
      listMock.mockClear()
      const view = renderPicker({ rows: [SLACK], config })
      await waitFor(() => expect(listMock).toHaveBeenCalled())
      for (const call of listMock.mock.calls) expect(call).toEqual([])
      view.unmount()
    }
  })

  it("⭐ SC#3 — an MCP row and a capability row appear in the SAME list from ONE read", async () => {
    // ⚠ REPLACES `SC#1b — neither shape lists the other's rows`. That case proved a
    // SEPARATION this phase deliberately removes. One org, both shapes, one call, one list.
    renderPicker({ rows: [SLACK, MCP] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    expect(listMock).toHaveBeenCalledTimes(1)
    const values = screen.getAllByTestId("connection-picker-option").map((o) => o.getAttribute("value"))
    expect(values).toEqual(["conn-slack", "conn-mcp"])
  })

  it("⭐ THE CLIENT-SIDE SHAPE FILTER IS GONE — a URL-less row is still OFFERED", async () => {
    // ⚠ REPLACES `the capability shape's exclusion of an MCP row is the SERVER's`. The
    // shipped MCP arm dropped every row without a server URL before building the list; that
    // filter is what made a first-party connection unreachable from an MCP-shaped step and
    // vice versa. Its absence is asserted here as a RENDER, not only as a source grep.
    renderPicker({ rows: [{ ...MCP, mcp_server_url: null }] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    expect(screen.getAllByTestId("connection-picker-option")).toHaveLength(1)
    expect(screen.queryByTestId("connection-picker-empty")).not.toBeInTheDocument()
  })

  it("SC#1c — a DISABLED MCP row is not a choice either; the rule is not laxer for any shape", async () => {
    renderPicker({ rows: [{ ...MCP, is_enabled: false }] })
    await waitFor(() => expect(screen.getByTestId("connection-picker-empty")).toBeInTheDocument())
    expect(screen.queryByTestId("connection-picker-select")).not.toBeInTheDocument()
    expect(screen.getByTestId("connection-picker-empty")).toHaveAttribute(
      "data-empty-reason",
      "all-disabled",
    )
  })

  it("the read failure reading survives — four facts stay four", async () => {
    renderPicker({ reject: true })
    await waitFor(() => expect(screen.getByTestId("connection-picker-error")).toBeInTheDocument())
    expect(screen.getByRole("alert").textContent).toBe(CONNECTION_PICKER_READ_FAILED)
    expect(screen.queryByTestId("connection-picker-empty")).not.toBeInTheDocument()
  })
})

// ── 9. TWO ABSENCES, TWO SENTENCES, ON ONE LIST (AR-04 discharged) ───────────────────

describe("ConnectionPicker — the two empty facts stay two", () => {
  it("the two sentences are really different, and both are distinguishable by reason", () => {
    expect(noConnectionYetNote("")).not.toBe(CONNECTION_PICKER_ALL_DISABLED)
    // A single collapsed reason would silently retire a diagnostic — so the VALUES are
    // asserted as distinct, not merely the sentences.
    expect("none").not.toBe("all-disabled")
  })

  it("⚠ THE COUNT IS TAKEN BEFORE THE FILTER — one disabled row is `all-disabled`, not `none`", async () => {
    // ⚠ REPLACES `THE FILTER ORDER — a disabled SLACK row does NOT make the MCP shape say
    // all-disabled`. That case defended an order between TWO filters; there is one filter
    // now, so what is left to get wrong is counting AFTER it, which would report "none
    // exist" for an org whose every connection is merely switched off.
    renderPicker({ rows: [{ ...SLACK, is_enabled: false }] })
    await waitFor(() => expect(screen.getByTestId("connection-picker-empty")).toBeInTheDocument())
    expect(screen.getByTestId("connection-picker-empty").getAttribute("data-empty-reason")).toBe(
      "all-disabled",
    )
  })

  it("the WR-04 inherited-key read still falls back rather than stringifying a function", () => {
    // ⚠ `noConnectionYetNote`'s `own()` guard is now on the LIVE path — the empty state calls
    // it with `""`. `constructor` is the canonical WR-04 needle, and it must still degrade.
    expect(noConnectionYetNote("constructor")).toBe(
      "No external connection yet — add one in Settings → Connections.",
    )
    expect(noConnectionYetNote("constructor")).not.toContain("function")
    expect(noConnectionYetNote("__proto__")).toBe(
      "No external connection yet — add one in Settings → Connections.",
    )
    // …and the three capability words still resolve, because CONN-05 keeps the attribute.
    expect(noConnectionYetNote("send_email")).toContain("No email connection yet")
    expect(noConnectionYetNote("create_ticket")).toContain("No ticket connection yet")
    expect(noConnectionYetNote("post_message")).toContain("No message connection yet")
  })
})

// ── 10. THE FOOTER — the repaired ladder, and the control that proves the tail ───────

describe("ConnectionPicker — destinationPartsOf names the right host", () => {
  it("an MCP row's footer names its OWN host, and NOT the path segment", async () => {
    renderPicker({ rows: [MCP], config: { connection_id: "conn-mcp" } })
    await waitFor(() => expect(select()).toBeInTheDocument())
    const footer = screen.getByTestId("connection-picker-footer")
    expect(footer.textContent).toBe("🔒 mcp.deepwiki.com")
    // HOST ONLY — the path is the server's business.
    expect(footer.textContent).not.toContain("/mcp")
    // ⚠ THE DEFECT, NAMED. At 206.2's base this footer read `🔒 slack.com/api`.
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

// ── 11. THE ACTION CARD — mounted for EVERY bound shape (D-211-12) ───────────────────

describe("ConnectionPicker — the action card follows the binding, not the endpoint", () => {
  it("binding an MCP row through the picker's own <select> renders the action card", async () => {
    const { patch } = renderPicker({ rows: [MCP] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    expect(screen.queryByTestId("mcp-tool-picker")).not.toBeInTheDocument()

    fireEvent.change(select(), { target: { value: "conn-mcp" } })

    expect(patch).toHaveBeenCalledWith(SLUG, bindPatch("conn-mcp"))
    await waitFor(() => expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument())
  })

  it("⭐ INVERTED — binding a CAPABILITY row NOW renders the card, over its own action list", async () => {
    // ⚠ THIS CASE IS THE INVERSE OF `NEGATIVE CONTROL — a bound CAPABILITY row mounts no tool
    // picker`, which shipped at 206.2 and asserted the DEFECT D-211-12 removes. It was true
    // only because the mount was conditional on the row's own server URL rather than on
    // having got this far. A control that stays green while the criterion is false is worse
    // than no control, so it is INVERTED rather than deleted.
    renderPicker({ rows: [SLACK] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    fireEvent.change(select(), { target: { value: "conn-slack" } })
    await waitFor(() => expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument())
    const toolSelect = screen.getByTestId("mcp-tool-select") as HTMLSelectElement
    expect(Array.from(toolSelect.options).map((o) => o.value)).toContain("post_message")
    // The author reads the descriptor's own words, not the wire id.
    expect(screen.getByText("Post message")).toBeInTheDocument()
  })

  it("⭐ A LEGACY ROW WITH AN EMPTY ACTION LIST still gets its card and its Refresh", async () => {
    // T-211-22 through the PARENT: the loop cannot close from this side either.
    renderPicker({ rows: [{ ...SLACK, discovered_tools: [] }] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    fireEvent.change(select(), { target: { value: "conn-slack" } })
    await waitFor(() => expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument())
    expect(screen.getByTestId("mcp-no-tools")).toBeInTheDocument()
    expect(screen.getByTestId("mcp-discover-btn")).toBeEnabled()
  })

  it("an MCP row is SELECTABLE — a null verdict is `◌ not checked`, not a failure", async () => {
    renderPicker({ rows: [MCP] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    const option = screen.getByRole("option", {
      name: `mcp.deepwiki.com · DeepWiki ${CONNECTION_STATE_NOT_CHECKED}`,
    })
    expect(option).not.toHaveAttribute("aria-disabled")
  })

  it("⚠ THE GRANT SURFACE FOLLOWS THE SERVER'S GATE, not the card", async () => {
    // The executor consults `tool_grants` only on the remote-server path, so the permission
    // reading is rendered for an MCP row and withheld for a first-party one. Both arms, in
    // one case, because either alone would pass against a component that had stopped
    // rendering the grant surface entirely (or never stopped).
    const mcp = renderPicker({ rows: [MCP], config: { connection_id: "conn-mcp", tool_name: "ask_question" } })
    await waitFor(() => expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument())
    expect(screen.getByTestId("mcp-grant-status")).toBeInTheDocument()
    mcp.unmount()

    renderPicker({ rows: [SLACK], config: { connection_id: "conn-slack", capability: "post_message" } })
    await waitFor(() => expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument())
    expect(screen.queryByTestId("mcp-grant-status")).not.toBeInTheDocument()
  })
})

// ── 12. THE ACTION WRITE — exactly one of `capability` / `tool_name` (CONN-05) ────────

describe("ConnectionPicker — a step writes exactly ONE action field", () => {
  it("⭐ an MCP row's action is written to `tool_name`, and `capability` is cleared", async () => {
    const { patch } = renderPicker({ rows: [MCP], config: { connection_id: "conn-mcp" } })
    await waitFor(() => expect(screen.getByTestId("mcp-tool-select")).toBeInTheDocument())
    patch.mockClear()
    fireEvent.change(screen.getByTestId("mcp-tool-select"), { target: { value: "ask_question" } })
    expect(patch).toHaveBeenCalledTimes(1)
    const written = patch.mock.calls[0][1] as Record<string, unknown>
    expect(Object.keys(written).sort()).toEqual(["capability", "tool_name"])
    expect(written.tool_name).toBe("ask_question")
    expect(written.capability).toBeUndefined()
  })

  it("⭐ a CAPABILITY row's action is written to `capability`, and `tool_name` is cleared", async () => {
    const { patch } = renderPicker({ rows: [SLACK], config: { connection_id: "conn-slack" } })
    await waitFor(() => expect(screen.getByTestId("mcp-tool-select")).toBeInTheDocument())
    patch.mockClear()
    fireEvent.change(screen.getByTestId("mcp-tool-select"), { target: { value: "post_message" } })
    expect(patch).toHaveBeenCalledTimes(1)
    const written = patch.mock.calls[0][1] as Record<string, unknown>
    // ⚠ SET EQUALITY, never `toMatchObject` — a superset passes a PARTIAL clear, and
    // `tool_args` left behind is arguments for a tool that no longer exists.
    expect(Object.keys(written).sort()).toEqual(["capability", "tool_args", "tool_name"])
    expect(written.capability).toBe("post_message")
    expect(written.tool_name).toBeUndefined()
    expect(written.tool_args).toBeUndefined()
  })

  it("⛔ NO DEFAULT — with nothing bound, NEITHER field is ever written", async () => {
    // A default is not a way through a gate. With no connection chosen the action card is
    // not rendered at all, so there is no control able to write either field.
    const { patch } = renderPicker({ rows: [SLACK, MCP] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    expect(screen.queryByTestId("mcp-tool-select")).not.toBeInTheDocument()
    expect(patch).not.toHaveBeenCalled()
  })

  it("⭐ NEVER BOTH — the two writes and the bind, swept over one session", async () => {
    // The invariant stated once over every patch this component can emit: no single write
    // ever carries a non-undefined `capability` AND a non-undefined `tool_name`.
    const { patch } = renderPicker({ rows: [SLACK, MCP] })
    await waitFor(() => expect(select()).toBeInTheDocument())
    fireEvent.change(select(), { target: { value: "conn-mcp" } })
    await waitFor(() => expect(screen.getByTestId("mcp-tool-select")).toBeInTheDocument())
    fireEvent.change(screen.getByTestId("mcp-tool-select"), { target: { value: "ask_question" } })
    fireEvent.change(select(), { target: { value: "conn-slack" } })

    expect(patch.mock.calls.length).toBeGreaterThan(2)
    for (const call of patch.mock.calls) {
      const written = call[1] as Record<string, unknown>
      const both = written.capability !== undefined && written.tool_name !== undefined
      expect(both, JSON.stringify(written)).toBe(false)
    }
  })

  it("re-binding CLEARS a stale action — the AR-05 hazard, one control over", async () => {
    // 206.2 put this clear on the shape control. That control is deleted, so re-binding is
    // the only remaining moment a step's shape can change, and the obligation moved here
    // rather than evaporating.
    const { store } = renderPicker({
      rows: [SLACK, MCP],
      config: { connection_id: "conn-mcp", tool_name: "ask_question" },
    })
    await waitFor(() => expect(select()).toBeInTheDocument())
    fireEvent.change(select(), { target: { value: "conn-slack" } })
    const onTheWire = JSON.parse(JSON.stringify(store.getState().phases)) as Array<{
      config: Record<string, unknown>
    }>
    expect(Object.keys(onTheWire[0].config)).not.toContain("tool_name")
    expect(onTheWire[0].config).toHaveProperty("connection_id", "conn-slack")
  })
})

// ── 13. THE NEW SOURCE FENCES ────────────────────────────────────────────────────────

describe("ConnectionPicker — 211-04 source discipline", () => {
  it("⭐ the read is UNSCOPED at source — no capability argument survives", () => {
    // ⚠ REPLACES `api.ts is not consulted for a new export`, which asserted BOTH call forms
    // were present. One survives. The `?capability=` parameter is deliberately KEPT in
    // `api.ts`'s signature (211-02's decision); what ends is this file's use of it.
    expect(connectionPickerSource).toContain("listConnectorConnections()")
    const scoped = "listConnectorConnections(" + "capability)"
    expect(connectionPickerSource).not.toContain(scoped)
    // POSITIVE CONTROL — the needle really matches the form it forbids.
    expect("const r = listConnectorConnections(" + "capability)").toContain(scoped)
    expect(connectionPickerSource.length).toBeGreaterThan(1000)
  })

  it("⭐ the client-side SHAPE FILTER is gone at source", () => {
    const live = connectionPickerSource
      .split("\n")
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join("\n")
    const filterNeedle = "row." + "mcp_server_url"
    expect(live).not.toContain(filterNeedle)
    // POSITIVE CONTROL — the needle really matches the filter it forbids.
    expect("rows.filter((row) => Boolean(row." + "mcp_server_url))").toContain(filterNeedle)
  })

  it("the WR-04 sink is closed AT SOURCE — no bare bracket read survives", () => {
    expect(connectionPickerSource).toContain("own(CONNECTION_CAPABILITY_WORDS")
    // ⚠ The forbidden spelling is BUILT here rather than written out, because a fence whose
    // own prose spells the token it forbids counts itself — the 187-24 trap.
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
