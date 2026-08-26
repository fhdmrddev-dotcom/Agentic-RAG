/**
 * Phase 206.2-04 (SEED-200 / D-206.2-07 / D-206.2-12) — THE TWO-LEGGED REACHABILITY GUARD.
 * Phase 211-04 (D-211-12 / T-211-23) — RE-POINTED AT THE NEW CHAIN, NEVER DELETED.
 *
 * ── THE TIER DISCIPLINE THIS FILE EXISTS TO ENFORCE ──
 *
 *  T1 — a component test that constructs the component's props by hand.
 *       ⚠ THIS IS THE TIER THAT SHIPPED THE DEFECT. `McpToolPicker.test.tsx` was green, and
 *       running, the entire time nothing in production could mount the component: the read
 *       one level up passed a capability, an MCP row's capability is NULL, so the mount was
 *       dead code behind a filter. A test that builds its own props is structurally unable
 *       to see that nothing builds them.
 *
 *  T2 — LEG (a) below: an import-graph sweep. It proves an import EDGE exists and cannot
 *       prove anything about the PROPS that travel it.
 *       ⚠ AND IT WAS GREEN AT 206.2's BASE, AGAINST THE DEFECT — `ConnectionPicker.tsx`
 *       already imported and already mounted the component while the feature was
 *       unreachable. *A guard satisfied by the defect it was written to catch is worse than
 *       no guard, because it reads as coverage.* Leg (a) is the cheap third leg, never the
 *       evidence.
 *
 *  T3 — LEG (b) below: the data path. The PRODUCTION parent, a real store, only `@/lib/api`
 *       mocked, and NOT ONE `McpToolPicker` PROP CONSTRUCTED ANYWHERE IN THIS FILE. The only
 *       thing supplied is the WIRE RESPONSE. ⚠ THIS IS THE LEG THAT WOULD HAVE FAILED BEFORE
 *       206.2, and it was OBSERVED RED against the pre-phase read before being trusted.
 *
 * ⚠ A FUTURE EDITOR WHO DELETES LEG (b) HAS DELETED THE GUARD. Leg (a) alone is vacuous, and
 * it will keep saying so in green.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ⚠ 211-04 — FOUR MECHANICAL CONSEQUENCES, EACH HANDLED BY NAME RATHER THAN BY DELETION.
 *
 *  1. `pressMcpShape()` STOPPED WORKING. It pressed the SECOND of exactly two shape segments
 *     and asserted there were two; there are none. Replaced by `bindRow()`, which drives the
 *     NEW chain: render, wait for the ONE unscoped read, then bind a row on
 *     `connection-picker-select`. The file's defining property is preserved — NOT ONE
 *     `McpToolPicker` PROP IS CONSTRUCTED HERE, still asserted mechanically against this
 *     file's own `?raw` source. ⚠ The deleted control's test id is spelled NOWHERE in this
 *     file, which is itself an acceptance sweep of this plan.
 *
 *  2. ⭐ "POSITIVE CONTROL 2" IS **INVERTED**. It asserted that a bound CAPABILITY row mounts
 *     NO tool picker — which was true only because the mount was conditional on the row's own
 *     server URL rather than on having got this far. THAT IS THE DEFECT THIS PHASE REMOVES,
 *     and a control that stays green while the criterion is false is worse than no control.
 *     Its old and new assertions are both quoted in `211-04-SUMMARY.md`.
 *
 *  3. "POSITIVE CONTROL" NEEDED A NEW FALSIFICATION. It stripped `mcp_server_url` from
 *     `MCP_ROW` and asserted the row was never OFFERED — which relied on the client-side
 *     shape filter 211-04 deletes, so under the new model that row IS offered and the old
 *     form became UNFALSIFIABLE. Re-pointed at an EMPTY wire response, which still yields
 *     `connection-picker-empty` with its reason and no `mcp-tool-select`. ⚠ Deleting it
 *     instead would have left leg (b) without a falsification, i.e. the vacuous leg (a) this
 *     file warns about.
 *
 *  4. THE TWO CAPABILITY-ARM CASES asserted the read carries a capability, and that the
 *     capability shape's exclusion of an MCP row is the SERVER's. Both are obsolete BY
 *     DESIGN — there is one unscoped read and no exclusion. Replaced by the single
 *     zero-argument assertion plus the same-list cross-shape case.
 * ═══════════════════════════════════════════════════════════════════════════════════════
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

// ONLY the API module is faked. No provider is mocked, no component is stubbed, and no prop
// of the component under proof is supplied — that is the whole point of leg (b).
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

// ⚠ A STATIC `?raw` SELF-IMPORT, NOT `import.meta.glob`. Vite EXCLUDES THE IMPORTING FILE
// FROM ITS OWN GLOB — measured here, where the glob lookup returned `undefined` and the
// assertion read *expected undefined to be defined*. A fence that cannot see itself is a
// fence that passes for the wrong reason.
import selfSource from "./McpToolPicker.reachability.test.tsx?raw"
import { ExternalActionSection } from "./ExternalActionSection"
import { BuilderStoreProvider } from "./BuilderStoreProvider"
import { SelectedPhaseSlugProvider } from "./SelectedPhaseSlugContext"
import { createBuilderStore, type BuilderStore } from "./builderStore"

const SLUG = "notify-owner"

/** The WIRE shape of an MCP row, exactly as `GET /connectors/connections` returns it —
 *  `capability` is NULL, which is the single fact that made this whole surface unreachable
 *  before 206.2. ⚠ `service_id` is REQUIRED since 211-02, and migration 127 guarantees a
 *  non-blank value on every row on disk. */
const MCP_ROW: Record<string, unknown> = {
  id: "conn-deepwiki",
  org_id: "org-1",
  service_id: "mcp.deepwiki.com",
  capability: null,
  name: "DeepWiki",
  config: {},
  is_enabled: true,
  last_check_verdict: "ok",
  mcp_server_url: "https://mcp.deepwiki.com/mcp",
  tool_grants: {},
  discovered_tools: [
    { name: "read_wiki_structure", description: "List the pages of a repo's wiki" },
    { name: "ask_question", description: "Ask a question about a repo" },
  ],
}

/**
 * A capability row — and ⚠ 211-04 GAVE IT A `discovered_tools` OF ONE ELEMENT, IN THE
 * DESCRIPTOR'S REAL SHAPE. This is what migration 127 §2b writes and what the live local
 * database was verified to hold at this plan's dispatch (length 1 on BOTH capability rows).
 * The descriptor's `name` IS the capability, which is what lets ONE action list serve both
 * shapes without inventing a third concept.
 */
const SLACK_ROW: Record<string, unknown> = {
  id: "conn-slack",
  org_id: "org-1",
  service_id: "slack",
  capability: "post_message",
  name: "#ops-alerts",
  config: { default_channel: "ops-alerts" },
  is_enabled: true,
  last_check_verdict: "ok",
  tool_grants: {},
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

/**
 * ⭐ 211-04 · VALIDATION.md's WAVE-0 FIXTURE OBLIGATION — the LEGACY row that did not exist
 * anywhere in this phase's fixtures until now: a capability set, NO server URL, and an EMPTY
 * action list. It is the shape a row carried BEFORE migration 127 §2b, and the shape a failed
 * descriptor write still produces. Reached through the production chain like every other row
 * in this file.
 */
const LEGACY_EMPTY_ROW: Record<string, unknown> = {
  ...SLACK_ROW,
  id: "conn-jira-legacy",
  service_id: "jira",
  capability: "create_ticket",
  name: "Northwind Jira",
  discovered_tools: [],
}

function draftedStore(config: Record<string, unknown> = {}): BuilderStore {
  return createBuilderStore({
    slug: "vendor-brief",
    version: 1,
    phases: [
      {
        slug: SLUG,
        phase_index: 0,
        config: { phase_type: "external_action", ...config },
      },
    ],
  })
}

/**
 * THE PRODUCTION CHAIN, ASSEMBLED THE WAY THE PANEL ASSEMBLES IT.
 *
 * ⚠ The section is mounted, never the picker and never the tool picker. Everything below the
 * section is reached the way an author reaches it: by operating a control.
 */
function renderChain(rows: Record<string, unknown>[], capability = "") {
  const store = draftedStore()
  listMock.mockResolvedValue(rows)
  const view = render(
    <BuilderStoreProvider store={store}>
      <SelectedPhaseSlugProvider slug={SLUG}>
        <ExternalActionSection
          capability={capability}
          toolName=""
          onChange={(value) => {
            store.getState().patchConfig(SLUG, { capability: value })
          }}
          onChangeShape={(patch) => {
            store.getState().patchConfig(SLUG, patch)
          }}
          onPersist={() => store.getState().flushHistory()}
        />
      </SelectedPhaseSlugProvider>
    </BuilderStoreProvider>,
  )
  return { store, ...view }
}

/**
 * ⭐ 211-04 — THE REPLACEMENT FOR `pressMcpShape()`. The author's route to the action card is
 * now: the section renders the picker unconditionally → the ONE unscoped read settles → a row
 * is bound on the picker's own `<select>`. No shape is pressed, because there is no shape
 * question. Nothing is CONSTRUCTED here either — the id handed to the select comes from the
 * WIRE RESPONSE, which is the only thing this file supplies.
 */
async function bindRow(id: string) {
  const select = (await screen.findByTestId("connection-picker-select")) as HTMLSelectElement
  fireEvent.change(select, { target: { value: id } })
  return select
}

beforeEach(() => {
  listMock.mockReset()
  discoverMock.mockClear()
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// LEG (b) — THE DATA PATH. The one that would have failed.
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("LEG (b) · the action card is reachable through the PRODUCTION chain", () => {
  it("⭐ the read is issued with NO ARGUMENT — SEED-200's line, now on the ONLY arm", async () => {
    // ⚠ THIS ASSERTION IS THE PHASE. The shipped read passed a capability; an MCP row's
    // capability is NULL; so an MCP connection was filtered out of every read this picker
    // ever performed. 206.2 fixed that for ONE of two arms; 211-04 removes the second arm
    // entirely, so there is no configuration in which an argument is passed.
    //
    // `toHaveBeenCalledWith()` with ZERO ARGUMENTS is not the same as not caring: a call
    // carrying `undefined` explicitly, or carrying a capability, both fail it.
    renderChain([MCP_ROW, SLACK_ROW])
    await waitFor(() => expect(listMock).toHaveBeenCalled())
    expect(listMock).toHaveBeenCalledWith()
    for (const call of listMock.mock.calls) expect(call).toEqual([])
  })

  it("⭐ …and the action card REACHES THE DOM, mounted by nothing this file wrote", async () => {
    renderChain([MCP_ROW])
    await bindRow("conn-deepwiki")
    await waitFor(() => expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument())
    const toolSelect = screen.getByTestId("mcp-tool-select") as HTMLSelectElement
    const options = Array.from(toolSelect.options).map((o) => o.value)
    expect(options).toContain("read_wiki_structure")
    expect(options).toContain("ask_question")
  })

  it("POSITIVE CONTROL — an EMPTY wire response yields the empty reading and no card", async () => {
    // ⚠ RE-FALSIFIED BY 211-04. The shipped form stripped the server URL from `MCP_ROW` and
    // asserted the row was never OFFERED — which relied on the MCP arm's client-side shape
    // filter dropping it before the list was built. That filter is deleted, so a URL-less row
    // IS offered now and the old assertion became unfalsifiable rather than merely wrong.
    // What is still real: with nothing in the response there is nothing to bind, so the field
    // names the absence and no card can appear.
    renderChain([])
    const empty = await screen.findByTestId("connection-picker-empty")
    expect(empty).toHaveAttribute("data-empty-reason", "none")
    expect(screen.queryByTestId("connection-picker-select")).not.toBeInTheDocument()
    expect(screen.queryByTestId("mcp-tool-picker")).not.toBeInTheDocument()
    expect(screen.queryByTestId("mcp-tool-select")).not.toBeInTheDocument()
  })

  it("⭐ POSITIVE CONTROL 2 (INVERTED) — a bound CAPABILITY row DOES mount the card", async () => {
    // ⚠ THIS CASE USED TO ASSERT THE OPPOSITE, AND IT USED TO PASS. Its shipped text was
    // *"on the CAPABILITY shape a bound row mounts NO tool picker"*, justified as *"the mount
    // is conditional on the row's own server URL rather than on having got this far"*. THAT
    // CONDITION IS THE DEFECT D-211-12 removes: it is why plan 211-01's descriptors and plan
    // 211-02's backfill had no surface able to display them.
    //
    // A control that stays green while the criterion is false is worse than no control, so it
    // is INVERTED rather than deleted — it now fails if the defect returns.
    renderChain([SLACK_ROW], "post_message")
    await bindRow("conn-slack")
    await waitFor(() =>
      expect(screen.getByTestId("connection-picker")).toHaveAttribute("data-state", "bound"),
    )
    expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument()
    const toolSelect = screen.getByTestId("mcp-tool-select") as HTMLSelectElement
    // …and it lists the row's OWN action, by the descriptor's own words.
    expect(Array.from(toolSelect.options).map((o) => o.value)).toContain("post_message")
    expect(screen.getByText("Post message")).toBeInTheDocument()
  })

  it("⭐ THE LEGACY-EMPTY ROW — card, sentence and Refresh, through the production chain", async () => {
    // ⭐ VALIDATION.md's Wave-0 fixture obligation, and T-211-22's parent-side proof: the
    // state whose only remedy would have been a control that state hid. Reached the way an
    // author reaches it, with nothing constructed.
    renderChain([LEGACY_EMPTY_ROW])
    await bindRow("conn-jira-legacy")
    await waitFor(() => expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument())
    expect(screen.getByTestId("mcp-no-tools")).toBeInTheDocument()
    expect(screen.getByTestId("mcp-discover-btn")).toBeEnabled()
    expect(screen.queryByTestId("mcp-tool-select")).not.toBeInTheDocument()
  })

  it("⭐ CROSS-SHAPE — both shapes are in the SAME list, from ONE read", async () => {
    // ⚠ REPLACES `CROSS-SHAPE NEGATIVE — the MCP shape lists no capability row`, which
    // asserted a SEPARATION this phase deliberately removes, and the two capability-arm cases
    // that pinned the read as carrying a capability. One list, one read, every shape.
    renderChain([MCP_ROW, SLACK_ROW, LEGACY_EMPTY_ROW])
    await screen.findByTestId("connection-picker-select")
    const labels = screen
      .getAllByTestId("connection-picker-option")
      .map((o) => o.textContent ?? "")
    expect(labels.some((l) => l.includes("DeepWiki"))).toBe(true)
    expect(labels.some((l) => l.includes("#ops-alerts"))).toBe(true)
    expect(labels.some((l) => l.includes("Northwind Jira"))).toBe(true)
    expect(listMock).toHaveBeenCalledTimes(1)
  })

  it("⭐ THE ACTION WRITE LANDS IN THE FIELD THE EXECUTOR READS, through the chain", async () => {
    // Two shapes, two fields, never both — driven end to end rather than at the leaf.
    const capability = renderChain([SLACK_ROW])
    await bindRow("conn-slack")
    await waitFor(() => expect(screen.getByTestId("mcp-tool-select")).toBeInTheDocument())
    fireEvent.change(screen.getByTestId("mcp-tool-select"), { target: { value: "post_message" } })
    const capConfig = capability.store.getState().phases[0].config as unknown as Record<string, unknown>
    expect(capConfig.capability).toBe("post_message")
    expect(capConfig.tool_name).toBeUndefined()
    capability.unmount()

    const mcp = renderChain([MCP_ROW])
    await bindRow("conn-deepwiki")
    await waitFor(() => expect(screen.getByTestId("mcp-tool-select")).toBeInTheDocument())
    fireEvent.change(screen.getByTestId("mcp-tool-select"), { target: { value: "ask_question" } })
    const mcpConfig = mcp.store.getState().phases[0].config as unknown as Record<string, unknown>
    expect(mcpConfig.tool_name).toBe("ask_question")
    expect(mcpConfig.capability).toBeUndefined()
  })

  it("⭐ NO VERB IS OFFERED AS A CATEGORY ANYWHERE IN THE CHAIN (SC#3)", async () => {
    // The section's own suite asserts this against the leaf. Here it is asserted against the
    // ASSEMBLED surface, because a category could in principle be reintroduced by a child.
    renderChain([MCP_ROW, SLACK_ROW])
    await screen.findByTestId("connection-picker-select")
    // ⚠ ASSERTED BY ROLE, NEVER BY THE DELETED TEST IDS. The ids are swept out of this file
    // entirely (see the docblock); what must not come back is the QUESTION, and a future
    // control could reintroduce it under any id at all. `ExternalActionSection.test.tsx`
    // keeps the id-level negative against the leaf.
    expect(screen.queryAllByRole("radiogroup")).toHaveLength(0)
    expect(screen.queryAllByRole("radio")).toHaveLength(0)
  })

  it("⚠ NO COMPONENT PROP IS CONSTRUCTED IN THIS FILE — leg (b)'s defining property", async () => {
    // Asserted MECHANICALLY rather than promised in a comment, because the failure mode is a
    // future editor "fixing" a red case by handing the picker a connection object. A test
    // that constructs its own props is the T1 tier wearing a different file name.
    const self = selfSource
    expect(self.length).toBeGreaterThan(2000)
    // ⚠ THE NEEDLE IS ASSEMBLED AT RUNTIME. Spelling it whole would make this file contain
    // the very token it counts and the assertion would fail against itself — the 187-24 trap,
    // which has now fired fourteen times in this tree.
    const propNeedle = "connection" + "={"
    expect(self.split(propNeedle).length - 1).toBe(0)
    // A POSITIVE CONTROL for the needle, so a typo cannot pass as a clean sweep.
    expect(("<X " + propNeedle + "row} />").split(propNeedle).length - 1).toBe(1)
  })

  it("⚠ THE OLD SHAPE HELPER CANNOT COME BACK — its id is swept out of this file entirely", () => {
    // `pressMcpShape()` pressed a control that no longer exists, and this file's whole
    // account of the old chain has been rewritten rather than left describing it.
    //
    // ⚠ BOTH NEEDLES ARE ASSEMBLED AT RUNTIME, AND BOTH HAD TO BE: a `?raw` self-read makes
    // any spelled-out literal part of the very source being swept, so each arm of this case
    // fired the 187-24 trap in turn on its first run before being narrowed. The first draft
    // even kept the id in a NEGATIVE query and in the docblock, and the sweep counted both.
    const idNeedle = "external-action-" + "shape-option"
    expect(selfSource).not.toContain(idNeedle)
    expect(selfSource).not.toMatch(/function\s+pressMcpShape/)
    // POSITIVE CONTROLS — both needles really can match.
    expect('data-testid="external-action-' + 'shape-option"').toContain(idNeedle)
    expect("function " + "pressMcpShape() {}").toMatch(/function\s+pressMcpShape/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// LEG (a) — THE IMPORT GRAPH. The cheap third leg. ⚠ GREEN AT 206.2's BASE.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Production source only — a fence that swept its own test files would red on itself.
 *  ⚠ THE BROADER PREDICATE IS REQUIRED HERE: this component has THREE files, not two, so a
 *  hand-listed self-exclusion would go stale the next time a suite is added beside it. */
function productionOnly(mod: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(mod).filter(
      ([p]) => !p.includes("__tests__") && !/\.test\.tsx?$/.test(p),
    ),
  )
}

describe("LEG (a) · exactly ONE production importer — and this leg was GREEN at the base", () => {
  it("names its single importer by equality", () => {
    // ⚠ THIS ASSERTION PASSED AGAINST THE BROKEN TREE. `ConnectionPicker.tsx` imported and
    // mounted the component while the feature was unreachable, so an inverted `>= 1` sweep
    // is satisfied by the very defect SEED-200 reported. It is kept because it is a BUDGET:
    // a SECOND mount appearing anywhere reddens it, and that is a real property worth having
    // — it is simply not evidence for this phase, and saying so here is the point.
    const modules = import.meta.glob("/src/**/*.{ts,tsx}", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>
    // NON-VACUITY FIRST. `import.meta.glob` contributes the EMPTY STRING for an absent path
    // and never throws, so a mis-typed pattern yields a green sweep over nothing.
    expect(Object.keys(modules).length).toBeGreaterThan(200)
    const importers = Object.entries(productionOnly(modules))
      .filter(([path]) => !path.endsWith("McpToolPicker.tsx"))
      .filter(
        ([, src]) =>
          /from\s+["'][^"']*McpToolPicker["']/.test(src) || /<McpToolPicker[\s/>]/.test(src),
      )
      .map(([path]) => path)
    expect(importers.map((p) => p.split("/").pop())).toStrictEqual(["ConnectionPicker.tsx"])
    // The surfaces that must NOT grow a second mount are named, so the refusal is stated
    // rather than inferred from a list.
    expect(importers.some((p) => p.endsWith("ExternalActionSection.tsx"))).toBe(false)
    expect(importers.some((p) => p.endsWith("PhaseFormPanel.tsx"))).toBe(false)
  })

  it("POSITIVE CONTROL — both regexes really can find a mount", () => {
    const planted =
      'import { McpToolPicker } from "@/components/workflows/McpToolPicker"\n<McpToolPicker />'
    expect(/from\s+["'][^"']*McpToolPicker["']/.test(planted)).toBe(true)
    expect(/<McpToolPicker[\s/>]/.test(planted)).toBe(true)
  })

  it("NON-VACUITY — the sweep really can see the file it excludes", () => {
    const modules = import.meta.glob("/src/**/*.{ts,tsx}", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>
    const own = Object.keys(modules).filter((p) => p.endsWith("McpToolPicker.tsx"))
    expect(own).toHaveLength(1)
    expect(modules[own[0]].length).toBeGreaterThan(500)
  })
})
