/**
 * Phase 211-05 Task 1(b) — ⭐ THE FRONTEND HALF OF THE SEAM: THE RENDER GATE.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS FILE EXISTS, AND WHY IT IS IN PLAN 211-05 RATHER THAN 211-04
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * **A BACKEND TEST CANNOT SEE A RENDER GATE.** Revision iteration 1 of this phase caught a
 * PROPOSED gate — *"render the card only when `discovered_tools.length > 0`"* — that reads
 * like the honest form of D-211-12 and would have made **every row that existed before
 * migration 127 §2b unreachable through the UI**: empty list → card returns `null` → the
 * Refresh control (which lives below the gate) never renders → nothing can populate the list
 * → the card never renders. No amount of green backend automation contradicts that, because
 * a backend test observes a stored SHAPE and never a rendered surface.
 *
 * THIS PHASE HAS TWO SEAMS, NOT ONE, AND THIS FILE COVERS THE SECOND:
 *
 *   · **backend ↔ frontend (the wire)** — proved by
 *     `backend/tests/integration/test_211_service_shape_seam.py`, which mocks NEITHER side
 *     and drives the real routes against the real local Postgres. **That file cannot see
 *     anything below.**
 *   · **data shape ↔ render gate (this file)** — the shape a row in the REAL database
 *     carries, reaching a RENDERED surface. **That file's docstring names this one, and this
 *     docblock names it. Neither is the whole seam; each states which half it is.**
 *
 * A third file, `settings/__tests__/connectionVerbFence.test.ts`, proves SC#3's ABSENCE in
 * source across both surface trees. Three files, three different properties.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE TIER THIS FILE IS — and how it differs from `McpToolPicker.reachability.test.tsx`
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * `McpToolPicker.reachability.test.tsx` states the tier discipline in full (T1 props-by-hand,
 * T2 import-graph sweep, T3 the data path). **This file is T3, like that file's leg (b), and
 * it deliberately does NOT duplicate leg (b).** Leg (b) asks *"does the production chain
 * mount this component at all?"* — an EDGE question, answered once. This file asks a
 * different question that leg (b) cannot: **"for each of the FOUR row shapes that really sit
 * in the database, what does the gate DO?"** Same chain, different property.
 *
 * ⚠ NOT ONE `McpToolPicker` PROP IS CONSTRUCTED IN THIS FILE. The only thing supplied is the
 * WIRE RESPONSE of `GET /connectors/connections`. That is asserted mechanically at the bottom
 * against this file's own `?raw` source, in the shape `McpToolPicker.reachability.test.tsx`
 * records (a STATIC self-import, never `import.meta.glob` — Vite excludes the importing file
 * from its own glob, so a glob-based self-fence passes for the wrong reason).
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE FOUR ROW SHAPES ARE THE REAL ONES, MEASURED — not invented fixtures
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * Read from the live local database on 2026-08-26, after migration 127 was applied:
 *
 *   service_id            capability      mcp_server_url                  discovered_tools
 *   ─────────────────     ─────────────   ─────────────────────────────   ────────────────
 *   slack                 post_message    (null)                          length 1
 *   jira                  create_ticket   (null)                          length 1
 *   mcp.deepwiki.com      (null)          https://mcp.deepwiki.com/mcp    length 3
 *
 * Shape 1 below (**legacy · EMPTY**) is the one shape that is NOT on disk today, and it is
 * the most important case in the file: it is what every shipped row carried BEFORE migration
 * 127 §2b backfilled it, and what a failed descriptor write still produces. ⭐ **A
 * pre-populated fixture cannot see the closed loop.** Shape 4 (**service-only**) is CONN-08's
 * whole row and did not exist anywhere before this phase.
 *
 * ⚠ RED OBSERVED BEFORE THIS FILE WAS TRUSTED. Case 1 was driven against the PRE-211-04 gate
 * (`if (!connection?.mcp_server_url) return null`, planted back into `McpToolPicker.tsx`) and
 * failed; the plant was removed and the file restored md5-identical. The transcript is quoted
 * verbatim in `211-05-SUMMARY.md`. **A control that has never been observed failing is not a
 * control.**
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"

// ONLY the API module is faked. No provider is mocked, no component is stubbed, and no prop
// of the component under proof is supplied.
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

// ⚠ A STATIC `?raw` SELF-IMPORT, NOT `import.meta.glob` — see the docblock.
import selfSource from "./connectionCardReachability.test.tsx?raw"
import { ExternalActionSection } from "../ExternalActionSection"
import { BuilderStoreProvider } from "../BuilderStoreProvider"
import { SelectedPhaseSlugProvider } from "../SelectedPhaseSlugContext"
import { createBuilderStore, type BuilderStore } from "../builderStore"
import {
  MCP_DISCOVER_BUTTON_LABEL,
  MCP_NO_TOOLS_DISCOVERED,
} from "../McpToolPicker"

const SLUG = "notify-owner"

/** The one-element descriptor migration 127 §2b writes onto a capability row, in the byte
 *  shape plan 211-01's `descriptor_for` emits. The `name` IS the capability — that is what
 *  lets ONE action list serve both shapes without inventing a third concept. */
const SLACK_DESCRIPTOR = {
  name: "post_message",
  title: "Post message",
  description: "Post one plain-text message to the channel configured on this connection.",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: ["text"],
    properties: { text: { type: "string" } },
  },
}

/** ⭐ SHAPE 1 — **legacy · EMPTY**. A capability, no endpoint, and NO ACTION LIST. This is
 *  what every shipped row carried before migration 127 §2b, and it is the closed loop. */
const LEGACY_EMPTY = {
  id: "row-legacy-empty",
  org_id: "org-1",
  service_id: "jira",
  capability: "create_ticket",
  name: "Northwind Jira",
  config: { base_url: "https://northwind.atlassian.net", project_key: "KAN" },
  is_enabled: true,
  last_check_verdict: "ok",
  mcp_server_url: null,
  tool_grants: {},
  discovered_tools: [] as unknown[],
}

/** SHAPE 2 — **legacy · POPULATED**. The same shape after the §2b backfill: exactly what the
 *  live database holds for `slack` and `jira` today (length 1, name == capability). */
const LEGACY_POPULATED = {
  id: "row-legacy-populated",
  org_id: "org-1",
  service_id: "slack",
  capability: "post_message",
  name: "Slack-rag-test",
  config: { default_channel: "ops-alerts" },
  is_enabled: true,
  last_check_verdict: "ok",
  mcp_server_url: null,
  tool_grants: {},
  discovered_tools: [SLACK_DESCRIPTOR],
}

/** SHAPE 3 — **MCP · EMPTY**. A remote server whose list has not been fetched yet. The
 *  regression 211-04 Task 1(d) guards, re-asserted here at the seam: a brand-new MCP row
 *  legitimately starts at `[]` and the Refresh control is its ONLY affordance. */
const MCP_EMPTY = {
  id: "row-mcp-empty",
  org_id: "org-1",
  service_id: "mcp.deepwiki.com",
  capability: null,
  name: "DeepWiki",
  config: {},
  is_enabled: true,
  last_check_verdict: "ok",
  mcp_server_url: "https://mcp.deepwiki.com/mcp",
  tool_grants: {},
  discovered_tools: [] as unknown[],
}

/** ⭐ SHAPE 4 — **SERVICE-ONLY** (CONN-08). Neither capability nor endpoint, no credential,
 *  and an empty action list. Migration 127's `shape_is_not_ambiguous` PERMITS both to be
 *  NULL by design, and plan 211-03's create body emits no `capability` key for an
 *  unrecognised service — so this row is creatable, listable and bindable as of today.
 *
 *  ⚠ SEE `211-VALIDATION.md` § "Known gap — the service-only run-time seam" AND
 *  `.planning/reported-bugs/BUG-260826-06-*.md`. Binding THIS shape to a native
 *  external_action step is recorded-and-not-sent at run time with an INACCURATE sentence.
 *  That is a BACKEND seam and is deliberately NOT fixed in this phase; the render gate — the
 *  only thing this file is about — is correct for it, which is what the case below proves. */
const SERVICE_ONLY = {
  id: "row-service-only",
  org_id: "org-1",
  service_id: "notion",
  capability: null,
  name: "Notion workspace",
  config: {},
  is_enabled: true,
  last_check_verdict: "not_checked",
  mcp_server_url: null,
  tool_grants: {},
  discovered_tools: [] as unknown[],
}

const ALL_SHAPES = [LEGACY_EMPTY, LEGACY_POPULATED, MCP_EMPTY, SERVICE_ONLY]

function draftedStore(): BuilderStore {
  return createBuilderStore({
    slug: "vendor-brief",
    version: 1,
    phases: [
      { slug: SLUG, phase_index: 0, config: { phase_type: "external_action" } },
    ],
  })
}

/** THE PRODUCTION CHAIN, ASSEMBLED THE WAY THE PANEL ASSEMBLES IT. The section is mounted;
 *  the picker and the action card are REACHED, never rendered directly. */
function renderChain(rows: Record<string, unknown>[]) {
  const store = draftedStore()
  listMock.mockResolvedValue(rows)
  const view = render(
    <BuilderStoreProvider store={store}>
      <SelectedPhaseSlugProvider slug={SLUG}>
        <ExternalActionSection
          capability=""
          toolName=""
          onChange={(value) => store.getState().patchConfig(SLUG, { capability: value })}
          onChangeShape={(patch) => store.getState().patchConfig(SLUG, patch)}
          onPersist={() => store.getState().flushHistory()}
        />
      </SelectedPhaseSlugProvider>
    </BuilderStoreProvider>,
  )
  return { store, ...view }
}

/** Bind a row by OPERATING the control an author operates. No prop is constructed. */
async function bindRow(id: string) {
  const select = (await screen.findByTestId("connection-picker-select")) as HTMLSelectElement
  const { fireEvent } = await import("@testing-library/react")
  fireEvent.change(select, { target: { value: id } })
  await waitFor(() => expect(select.value).toBe(id))
}

beforeEach(() => {
  vi.clearAllMocks()
  discoverMock.mockResolvedValue([])
  grantsMock.mockResolvedValue({})
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 · ⭐ THE RENDER GATE, ON ALL FOUR REAL SHAPES
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("211-05 · the render gate, against the REAL row shapes (D-211-12 / T-211-22b)", () => {
  it("⭐ CASE 1 · LEGACY + EMPTY — the card, the in-words empty state AND an enabled Refresh", async () => {
    // ⭐ THE CLOSED LOOP, AND THE CASE THE WHOLE PLAN SET EXISTS TO KEEP OPEN. This is the
    // shape EVERY shipped row carried before migration 127 §2b. If the card returns null
    // here, the Refresh control below it never renders and the list can never be filled.
    renderChain(ALL_SHAPES)
    await bindRow(LEGACY_EMPTY.id)

    expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument()
    // …and it says so IN WORDS, rather than rendering an empty box.
    const note = screen.getByTestId("mcp-no-tools")
    expect(note).toHaveTextContent(MCP_NO_TOOLS_DISCOVERED)
    // …and the affordance that REPAIRS the state is present and PRESSABLE. A repair control
    // is never gated on the state it repairs.
    const refresh = screen.getByTestId("mcp-discover-btn")
    expect(refresh).toBeInTheDocument()
    expect(refresh).toBeEnabled()
    expect(refresh).toHaveTextContent(MCP_DISCOVER_BUTTON_LABEL)
    // The list itself is genuinely absent — the empty state is the empty state, not a
    // `<select>` with nothing in it.
    expect(screen.queryByTestId("mcp-tool-select")).toBeNull()
  })

  it("CASE 2 · LEGACY + POPULATED — the action list renders and names the capability", async () => {
    renderChain(ALL_SHAPES)
    await bindRow(LEGACY_POPULATED.id)

    expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument()
    const select = screen.getByTestId("mcp-tool-select") as HTMLSelectElement
    // The VALUE is the wire name; the LABEL is the descriptor's own `title`.
    const values = Array.from(select.options).map((o) => o.value)
    expect(values).toContain("post_message")
    expect(select).toHaveTextContent("Post message")
    // …and the empty sentence is NOT also on screen.
    expect(screen.queryByTestId("mcp-no-tools")).toBeNull()
  })

  it("CASE 3 · MCP + EMPTY — the Refresh control is still present (the 211-04 T1(d) regression)", async () => {
    renderChain(ALL_SHAPES)
    await bindRow(MCP_EMPTY.id)

    expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument()
    expect(screen.getByTestId("mcp-no-tools")).toBeInTheDocument()
    expect(screen.getByTestId("mcp-discover-btn")).toBeEnabled()
  })

  it("⭐ CASE 4 · SERVICE-ONLY (CONN-08) — the card renders with its empty sentence rather than vanishing", async () => {
    // Neither shape field is set. Before this phase such a row could neither EXIST (mig 126's
    // `shape_is_one_of_two`) nor be LISTED (the picker's client-side shape filter). Both halves
    // are new today, so this is the first render gate that has ever seen one.
    renderChain(ALL_SHAPES)
    await bindRow(SERVICE_ONLY.id)

    expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument()
    expect(screen.getByTestId("mcp-no-tools")).toHaveTextContent(MCP_NO_TOOLS_DISCOVERED)
    expect(screen.getByTestId("mcp-discover-btn")).toBeEnabled()
  })

  it("⚠ NEGATIVE CONTROL — nothing bound, nothing rendered", async () => {
    // Without this, every case above would be satisfied by a card that renders
    // unconditionally, which is a different defect wearing the same green.
    renderChain(ALL_SHAPES)
    await screen.findByTestId("connection-picker-select")
    expect(screen.queryByTestId("mcp-tool-picker")).toBeNull()
    expect(screen.queryByTestId("mcp-no-tools")).toBeNull()
    expect(screen.queryByTestId("mcp-discover-btn")).toBeNull()
  })

  it("⚠ SECOND NEGATIVE CONTROL — the card is DISMOUNTED when the binding is cleared", async () => {
    // A card that renders once and never leaves would pass case 1 and hide an unbind bug.
    renderChain(ALL_SHAPES)
    await bindRow(LEGACY_EMPTY.id)
    expect(screen.getByTestId("mcp-tool-picker")).toBeInTheDocument()
    await bindRow("")
    await waitFor(() => expect(screen.queryByTestId("mcp-tool-picker")).toBeNull())
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 · ONE LIST, EVERY SHAPE — the read that makes all four reachable at all
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("211-05 · all four shapes arrive through ONE unscoped read", () => {
  it("the read carries NO argument, and every shape is offered in the same list", async () => {
    renderChain(ALL_SHAPES)
    const select = (await screen.findByTestId("connection-picker-select")) as HTMLSelectElement
    // ⚠ Zero-argument, on every call. A capability argument here would re-create the axis
    // this phase deletes, and would silently hide the service-only row.
    for (const call of listMock.mock.calls) expect(call).toEqual([])
    expect(listMock).toHaveBeenCalled()
    const values = Array.from(select.options).map((o) => o.value)
    for (const row of ALL_SHAPES) expect(values).toContain(row.id)
  })

  it("⚠ NON-VACUITY — the four shapes really are four DIFFERENT shapes", async () => {
    // Four fixtures that happened to be the same shape would make §1 one case repeated.
    const shapeOf = (r: (typeof ALL_SHAPES)[number]) =>
      `${r.capability === null ? "-" : "cap"}/${r.mcp_server_url === null ? "-" : "url"}/${
        r.discovered_tools.length === 0 ? "empty" : "listed"
      }`
    expect(new Set(ALL_SHAPES.map(shapeOf)).size).toBe(4)
    // …and three of the four carry an EMPTY action list, which is the state the gate is about.
    expect(ALL_SHAPES.filter((r) => r.discovered_tools.length === 0)).toHaveLength(3)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 · THE FILE'S OWN DEFINING PROPERTY, ASSERTED MECHANICALLY
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("211-05 · this file constructs no component prop and states which half it covers", () => {
  it("NOT ONE ACTION-CARD PROP IS CONSTRUCTED HERE — only the wire response is supplied", () => {
    // ⚠ THE NEEDLE IS COMPOSED AT RUNTIME AND SPELLED NOWHERE, INCLUDING IN THIS COMMENT.
    // A `?raw` self-sweep makes any file that quotes its own needle count ITSELF: the first
    // draft of this case failed for exactly that reason, on its own POSITIVE CONTROL string.
    // That is the 187-24 trap, and this is its SIXTH recorded firing in this phase alone. The
    // fix is `ownProperty.ts`'s: describe the token, assemble it, never write it out.
    const OPENING_TAG = "<" + "Mcp" + "ToolPicker"
    expect(typeof selfSource).toBe("string")
    expect(selfSource.length).toBeGreaterThan(2000)
    // The component is never rendered here and never handed a prop.
    expect(selfSource).not.toContain(OPENING_TAG)
    expect(selfSource).not.toMatch(new RegExp("render\\(\\s*" + OPENING_TAG))
    // POSITIVE CONTROL — the needle really can match, on a haystack built the same way.
    expect(OPENING_TAG + " connection={x} />").toContain(OPENING_TAG)
  })

  it("⭐ it NAMES the half it cannot cover — the backend seam test, by path", () => {
    // A file that does not say what it is not proving reads as the whole proof.
    expect(selfSource).toContain("test_211_service_shape_seam.py")
    expect(selfSource).toContain("connectionVerbFence.test.ts")
  })
})
