/**
 * Phase 206.2-04 (SEED-200 / D-206.2-07 / D-206.2-12) — THE TWO-LEGGED REACHABILITY GUARD.
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
 *       ⚠ AND IT WAS GREEN AT THIS PHASE'S BASE, AGAINST THE DEFECT — `ConnectionPicker.tsx`
 *       already imported and already mounted the component while the feature was
 *       unreachable. *A guard satisfied by the defect it was written to catch is worse than
 *       no guard, because it reads as coverage.* Leg (a) is the cheap third leg, never the
 *       evidence.
 *
 *  T3 — LEG (b) below: the data path. The PRODUCTION parent, a real store, only `@/lib/api`
 *       mocked, and NOT ONE `McpToolPicker` PROP CONSTRUCTED ANYWHERE IN THIS FILE. The only
 *       thing supplied is the WIRE RESPONSE. ⚠ THIS IS THE LEG THAT WOULD HAVE FAILED BEFORE
 *       THIS PHASE, and it was OBSERVED RED against the pre-phase read before being trusted
 *       (the counterfactual and its md5 restoration are recorded in `206.2-04-SUMMARY.md`).
 *
 * ⚠ A FUTURE EDITOR WHO DELETES LEG (b) HAS DELETED THE GUARD. Leg (a) alone is vacuous, and
 * it will keep saying so in green.
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
 *  `capability` is NULL, which is the single fact that made this whole surface unreachable. */
const MCP_ROW: Record<string, unknown> = {
  id: "conn-deepwiki",
  org_id: "org-1",
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

/** A capability row, for the cross-shape negatives. */
const SLACK_ROW: Record<string, unknown> = {
  id: "conn-slack",
  org_id: "org-1",
  capability: "post_message",
  name: "#ops-alerts",
  config: { default_channel: "ops-alerts" },
  is_enabled: true,
  last_check_verdict: "ok",
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
 * section is reached the way an author reaches it: by pressing a control.
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

/** Press the SECOND shape segment — *a tool on an MCP server*. */
function pressMcpShape() {
  const segments = screen.getAllByTestId("external-action-shape-option")
  expect(segments).toHaveLength(2)
  fireEvent.click(segments[1])
}

beforeEach(() => {
  listMock.mockReset()
  discoverMock.mockClear()
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// LEG (b) — THE DATA PATH. The one that would have failed.
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("LEG (b) · the MCP tool picker is reachable through the PRODUCTION chain", () => {
  it("⭐ the MCP read is issued with NO ARGUMENT — the single line SEED-200 is about", async () => {
    // ⚠ THIS ASSERTION IS THE PHASE. The shipped read passed a capability; an MCP row's
    // capability is NULL; so an MCP connection was filtered out of every read this picker
    // ever performed, the `bound?.mcp_server_url` mount could never be true, and every green
    // test above tier 3 was describing a component nothing could reach.
    //
    // `toHaveBeenCalledWith()` with ZERO ARGUMENTS is not the same as not caring: a call
    // carrying `undefined` explicitly, or carrying a capability, both fail it.
    renderChain([MCP_ROW, SLACK_ROW])
    pressMcpShape()
    await waitFor(() => expect(listMock).toHaveBeenCalled())
    expect(listMock).toHaveBeenCalledWith()
  })

  it("⭐ …and the tool picker REACHES THE DOM, mounted by nothing this file wrote", async () => {
    renderChain([MCP_ROW])
    pressMcpShape()
    const select = (await screen.findByTestId("connection-picker-select")) as HTMLSelectElement
    // Binding is the author's act, driven as the author drives it.
    fireEvent.change(select, { target: { value: "conn-deepwiki" } })
    await waitFor(() => expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument())
    const toolSelect = screen.getByTestId("mcp-tool-select") as HTMLSelectElement
    const options = Array.from(toolSelect.options).map((o) => o.value)
    expect(options).toContain("read_wiki_structure")
    expect(options).toContain("ask_question")
  })

  it("POSITIVE CONTROL — strip the server URL from the WIRE ROW and the whole surface disappears", async () => {
    // A real falsification, not a regex smoke test: the same chain, the same press, ONE field
    // changed on the response. If this were green too, the case above would be proving that a
    // div exists rather than that a data path produces it.
    //
    // ⚠ AND THE FIRST DRAFT OF THIS CONTROL WAS WRONG, WHICH IS WHY IT IS WORDED THIS WAY. It
    // tried to bind the stripped row and assert the tool picker was absent; the row is never
    // OFFERED, because the MCP arm's own shape filter drops it before the list is built. The
    // observable consequence is one step earlier — the field reads EMPTY, and names the
    // absence rather than showing a bindable choice.
    renderChain([{ ...MCP_ROW, mcp_server_url: null }])
    pressMcpShape()
    const empty = await screen.findByTestId("connection-picker-empty")
    expect(empty).toHaveAttribute("data-empty-reason", "none")
    expect(screen.queryByTestId("connection-picker-select")).not.toBeInTheDocument()
    expect(screen.queryByTestId("mcp-tool-picker")).not.toBeInTheDocument()
  })

  it("POSITIVE CONTROL 2 — on the CAPABILITY shape a bound row mounts NO tool picker", async () => {
    // The other half of the same falsification: the chain reaches a BOUND connection and the
    // tool picker still does not appear, because the mount is conditional on the row's own
    // server URL rather than on having got this far.
    renderChain([SLACK_ROW], "post_message")
    const select = (await screen.findByTestId("connection-picker-select")) as HTMLSelectElement
    fireEvent.change(select, { target: { value: "conn-slack" } })
    await waitFor(() =>
      expect(screen.getByTestId("connection-picker")).toHaveAttribute("data-state", "bound"),
    )
    expect(screen.queryByTestId("mcp-tool-picker")).not.toBeInTheDocument()
  })

  it("the CAPABILITY shape still calls the read WITH its capability — both arms, one file", async () => {
    // The counterpart assertion, in the same file on purpose: the no-argument call above is
    // only meaningful beside a call that DOES carry one. A single arm proves the read fires;
    // two arms prove the read fires DIFFERENTLY, which is the change wave 2 made.
    renderChain([SLACK_ROW], "post_message")
    await waitFor(() => expect(listMock).toHaveBeenCalledWith("post_message"))
    expect(listMock).not.toHaveBeenCalledWith()
  })

  it("CROSS-SHAPE NEGATIVE — the MCP shape lists no capability row", async () => {
    renderChain([MCP_ROW, SLACK_ROW])
    pressMcpShape()
    const select = (await screen.findByTestId("connection-picker-select")) as HTMLSelectElement
    const labels = Array.from(select.options).map((o) => o.textContent ?? "")
    expect(labels.some((l) => l.includes("DeepWiki"))).toBe(true)
    expect(labels.some((l) => l.includes("#ops-alerts"))).toBe(false)
  })

  it("⚠ the capability shape's exclusion of an MCP row is the SERVER's, and that is stated not assumed", async () => {
    // ⚠ THE OBVIOUS NEGATIVE HERE IS UNSATISFIABLE AND SAYING SO IS THE HONEST MOVE. The
    // capability arm applies exactly ONE client-side filter (`is_enabled`) and relies on the
    // server's `?capability=` query for the rest — so feeding an MCP row into the response
    // and then asserting it is not listed would be measuring a filter that does not exist,
    // and it would fail. What CAN be measured on this side is the argument that makes the
    // server exclude it, plus the shape switch that re-issues the read.
    renderChain([SLACK_ROW], "post_message")
    await waitFor(() => expect(listMock).toHaveBeenCalledWith("post_message"))
    const select = (await screen.findByTestId("connection-picker-select")) as HTMLSelectElement
    expect(Array.from(select.options).some((o) => (o.textContent ?? "").includes("#ops-alerts"))).toBe(true)
    // …and pressing the MCP segment re-asks WITHOUT the capability, which is the client half.
    pressMcpShape()
    await waitFor(() => expect(listMock).toHaveBeenCalledWith())
  })

  it("⚠ NO COMPONENT PROP IS CONSTRUCTED IN THIS FILE — leg (b)'s defining property", async () => {
    // Asserted MECHANICALLY rather than promised in a comment, because the failure mode is a
    // future editor "fixing" a red case by handing the picker a connection object. A test
    // that constructs its own props is the T1 tier wearing a different file name.
    const self = selfSource
    expect(self.length).toBeGreaterThan(2000)
    // ⚠ THE NEEDLE IS ASSEMBLED AT RUNTIME. Spelling it whole would make this file contain
    // the very token it counts and the assertion would fail against itself — the 187-24 trap,
    // which has now fired thirteen times in this tree.
    const propNeedle = "connection" + "={"
    expect(self.split(propNeedle).length - 1).toBe(0)
    // A POSITIVE CONTROL for the needle, so a typo cannot pass as a clean sweep.
    expect(("<X " + propNeedle + "row} />").split(propNeedle).length - 1).toBe(1)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// LEG (a) — THE IMPORT GRAPH. The cheap third leg. ⚠ GREEN AT THIS PHASE'S BASE.
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
