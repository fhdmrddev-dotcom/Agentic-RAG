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
const { listMock } = vi.hoisted(() => ({ listMock: vi.fn() }))
vi.mock("@/lib/api", () => ({ listConnectorConnections: listMock }))

import connectionPickerSource from "./ConnectionPicker?raw"
import {
  ConnectionPicker,
  CONNECTION_PICKER_FAILING_REFUSAL,
  CONNECTION_PICKER_LABEL,
  CONNECTION_PICKER_LOADING,
  CONNECTION_PICKER_NONE_OPTION,
  CONNECTION_PICKER_NOTHING_BOUND_FOOTER,
  CONNECTION_PICKER_READ_FAILED,
  CONNECTION_STATE_FAILED,
  CONNECTION_STATE_NOT_CHECKED,
  SLACK_FIXED_DESTINATION,
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
