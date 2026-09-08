/**
 * Phase 239 plan 07 — `SEED-259`'s argument mapping, as a thing a person can SEE.
 *
 * ⭐ WHAT THIS SUITE IS FOR. `239-06` made a tool's ARGUMENT SHAPE a row: `arg_path` names
 * the argument that carries the path, `arg_static.<name>` supplies a fixed value for each
 * other required argument. Both live inside the existing `source_tools` dict. Until this
 * plan, the only door onto those keys was a hand-written `PATCH` — so the capability half of
 * `SEED-259` was unreachable through the product and SC#2 could not be scored.
 *
 * ⚠ CONTENT, NEVER PRESENCE — Phase 235's finding, and this card's own rule. The rows are
 * compared as a SET OF NAMES, the refusal sentence is compared as a STRING that names every
 * unfilled argument, and the two key families are read out of the shipped Python. A fence
 * that asserted `getByTestId("connection-source-args")` exists would stay green while the
 * card offered the wrong argument names.
 *
 * ⛔ NO VENDOR NAME REACHES THIS SUITE'S FIXTURES. The vocabulary below — `enumerate_vault`,
 * `holder`, `vault`, `trail` — appears nowhere else in this repository, exactly as the
 * backend's `test_the_refusal_holds_for_a_server_NOBODY_PREDICTED` does. A card that renders
 * these rows correctly cannot be reading a table of servers it was told about, because it was
 * never told about this one. The grep-shaped half of the same fence is §5.
 *
 * ⚠ THE FIXTURE'S PREMISE IS ASSERTED, NOT ASSUMED. Twice in this phase a case passed
 * vacuously because its fixture was wrong. So `enumerate_vault` / `fetch_entry` are asserted
 * to survive the picker's mutation-word filter (§0) — if a later widening of
 * `SOURCE_TOOL_MUTATION_WORDS` swallowed one of them, every binding case below would be
 * driving an unbindable tool and would pass for the wrong reason.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ConnectionFormPanel } from "../ConnectionFormPanel"
import {
  SOURCE_ARGS_HEADING,
  SOURCE_ARGS_HELP,
  SOURCE_ARGS_NONE_NEEDED,
  SOURCE_ARGS_UNDESCRIBED,
  SOURCE_ARG_DEFAULT_PATH,
  SOURCE_ARG_KEY_MAX,
  SOURCE_ARG_PATH_KEY,
  SOURCE_ARG_STATIC_PREFIX,
  SOURCE_ARG_VALUE_MAX,
  SOURCE_PATH_ARG_LABEL,
  SOURCE_PATH_ARG_HELP,
  SOURCE_TOOLS_LIST_LABEL,
  SOURCE_TOOLS_READ_LABEL,
  looksLikeSourceToolMutation,
  sourceArgRowNote,
  sourceArgsIncompleteNote,
  sourceArgsUnstorableNote,
  sourceArgumentModel,
  sourcePathArgUnsetLabel,
  sourceToolsFromDraft,
  configFromDraft,
  draftFromConnection,
  EMPTY_DRAFT,
} from "../connectionFormCopy"
// The ADAPTER's own source, through Vite's `?raw` loader — this card's shipped idiom for a
// fence the DOM cannot express. The panel tells a person which key carries their answer; only
// `mcp_source.py` decides which key is actually read.
import mcpSourceSource from "../../../../../backend/app/services/sources/adapters/mcp_source.py?raw"
// …and the SHIPPED FRONTEND files, for §5's negative scan.
// ⚠ 239-08 — THE THIRD ENTRY IS THE WHOLE POINT OF THIS COMMENT. The card was EXTRACTED out
// of `ConnectionFormPanel.tsx` into `SourceToolsCard.tsx`, and a fence that scans only the
// panel would have kept passing over source that no longer contains the thing it forbids —
// green, vacuous, and weaker than the day it was written. The negative scan below runs over
// EVERY file the card's markup can live in, so moving code between them cannot buy silence.
import panelSource from "../ConnectionFormPanel.tsx?raw"
import cardSource from "../SourceToolsCard.tsx?raw"
import copySource from "../connectionFormCopy.ts?raw"
import type { ConnectorConnection, McpDiscoveredTool } from "@/lib/api"

const noop = () => {}

/** A server that asks for three arguments, in a vocabulary this repository has never seen.
 *
 *  ⚠ `required` sits INSIDE `inputSchema`, because `inputSchema` IS the JSON Schema —
 *  `_required_params` reads `input_schema.get("required")` and nothing else. */
const THREE_ARG_TOOLS: McpDiscoveredTool[] = [
  {
    name: "enumerate_vault",
    description: "Enumerate a vault.",
    inputSchema: {
      type: "object",
      properties: { holder: { type: "string" }, vault: { type: "string" }, trail: { type: "string" } },
      required: ["holder", "vault", "trail"],
    },
  },
  {
    name: "fetch_entry",
    description: "Fetch one entry.",
    inputSchema: {
      type: "object",
      properties: { holder: { type: "string" }, vault: { type: "string" }, trail: { type: "string" } },
      required: ["holder", "vault", "trail"],
    },
  },
]

/** A server that asks for a lone path — the reference shape, and §2's negative control. */
const LONE_PATH_TOOLS: McpDiscoveredTool[] = [
  {
    name: "enumerate_vault",
    inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
  {
    name: "fetch_entry",
    inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
]

/** A server that described NOTHING — no `inputSchema` at all. Different from "asks for
 *  nothing", and the card must not confuse the two. */
const UNDESCRIBED_TOOLS: McpDiscoveredTool[] = [
  { name: "enumerate_vault", description: "Enumerate a vault." },
  { name: "fetch_entry", description: "Fetch one entry." },
]

function mcpConnection(overrides: Partial<ConnectorConnection> = {}): ConnectorConnection {
  return {
    id: "conn-mcp-args",
    org_id: "org-1",
    service_id: "custom_mcp",
    name: "Team file server",
    auth_type: "mcp",
    mcp_server_url: "https://files.example.com/mcp",
    config: { source_tools: { list_tool: "enumerate_vault", read_tool: "fetch_entry" } },
    is_enabled: true,
    discovered_tools: THREE_ARG_TOOLS,
    ...overrides,
  } as ConnectorConnection
}

function renderEdit(props: Partial<React.ComponentProps<typeof ConnectionFormPanel>> = {}) {
  const onUpdate = vi.fn().mockResolvedValue(undefined)
  const result = render(
    <ConnectionFormPanel
      open
      mode="edit"
      isOrgAdmin
      liveConnectorsOn
      orgName="Northwind"
      onClose={noop}
      onCreate={vi.fn().mockResolvedValue(undefined)}
      onUpdate={onUpdate}
      connection={mcpConnection()}
      {...props}
    />,
  )
  return { ...result, onUpdate }
}

async function savedConfig(onUpdate: ReturnType<typeof vi.fn>) {
  await waitFor(() => expect(onUpdate).toHaveBeenCalled())
  return onUpdate.mock.calls[0][1].config as Record<string, unknown>
}

async function save(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /save/i }))
}

/** The names the argument card is asking for, read off the DOM in render order. */
function argRowNames(): string[] {
  return screen
    .queryAllByTestId("connection-source-arg-row")
    .map((row) => within(row).getByTestId("connection-source-arg-name").textContent ?? "")
}

/** The value box for one argument row, by the server's own name for it. */
function argInput(name: string): HTMLInputElement {
  return screen.getByLabelText(name) as HTMLInputElement
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => cleanup())

describe("Phase 239 / SEED-259 — the argument mapping a person can set", () => {
  // ── 0 · THE FIXTURE'S OWN PREMISE ───────────────────────────────────────────────────

  it("⚠ the fixture's tool names survive the picker's mutation filter — else every case below is vacuous", () => {
    // A fixture that could never be BOUND would make every "and it saves" case green while
    // measuring nothing. `SOURCE_TOOL_MUTATION_WORDS` has been widened twice on this surface.
    expect(looksLikeSourceToolMutation("enumerate_vault")).toBe(false)
    expect(looksLikeSourceToolMutation("fetch_entry")).toBe(false)
    // NON-VACUITY on the predicate itself: it does still withhold something.
    expect(looksLikeSourceToolMutation("delete_entry")).toBe(true)

    // …and the binding really is on screen with those names selected.
    renderEdit()
    const section = screen.getByTestId("connection-source-tools")
    expect(
      (within(section).getByLabelText(SOURCE_TOOLS_LIST_LABEL) as HTMLSelectElement).value,
    ).toBe("enumerate_vault")
    expect(
      (within(section).getByLabelText(SOURCE_TOOLS_READ_LABEL) as HTMLSelectElement).value,
    ).toBe("fetch_entry")
  })

  // ── 1 · WHICH ARGUMENT CARRIES THE PATH ─────────────────────────────────────────────

  it("offers the server's OWN argument names rather than a free-text box", () => {
    // ⭐ The product already holds `inputSchema`; asking a person to retype a name it knows is
    // how a typo pins every browse to one fixed directory — a COMPLETE listing of the wrong
    // folder, which is the `H-5` deletion signal wearing a success.
    renderEdit()
    const control = screen.getByLabelText(SOURCE_PATH_ARG_LABEL) as HTMLSelectElement
    expect(control.tagName).toBe("SELECT")
    const offered = [...control.options].map((o) => o.value).filter(Boolean)
    expect(offered.sort()).toEqual(["holder", "trail", "vault"])
  })

  it("names the card and says where the rows come from", () => {
    renderEdit()
    const section = screen.getByTestId("connection-source-args")
    expect(within(section).getByText(SOURCE_ARGS_HEADING)).toBeInTheDocument()
    expect(within(section).getByText(SOURCE_ARGS_HELP)).toBeInTheDocument()
    expect(within(section).getByText(SOURCE_PATH_ARG_HELP)).toBeInTheDocument()
  })

  it("⛔ RENDERS A STORED PATH ARGUMENT THE SCHEMA DOES NOT DECLARE", () => {
    // The non-negotiable. A `<select>` whose value is absent from its options renders as
    // UNSELECTED, so opening the panel and pressing Save would silently re-point the binding
    // back to the default — HI-02's defect, re-introduced by a filter meant to help.
    renderEdit({
      connection: mcpConnection({
        config: {
          source_tools: {
            list_tool: "enumerate_vault",
            read_tool: "fetch_entry",
            arg_path: "waypoint",
          },
        },
      } as never),
    })
    const control = screen.getByLabelText(SOURCE_PATH_ARG_LABEL) as HTMLSelectElement
    expect(control.value).toBe("waypoint")
    expect([...control.options].map((o) => o.value)).toContain("waypoint")
  })

  it("names the fallback the ADAPTER will really use, pinned against its own source", () => {
    // Two copies of one fact; only the Python decides what happens when the slot is empty.
    expect(mcpSourceSource).toContain(`DEFAULT_PATH_ARG = "${SOURCE_ARG_DEFAULT_PATH}"`)
    renderEdit()
    const control = screen.getByLabelText(SOURCE_PATH_ARG_LABEL) as HTMLSelectElement
    expect(control.options[0].textContent).toBe(sourcePathArgUnsetLabel())
    expect(control.options[0].textContent).toContain(SOURCE_ARG_DEFAULT_PATH)
  })

  it("falls back to free text when the server declared no argument names at all", () => {
    // POSITIVE CONTROL FIRST — on the described server it IS a select.
    renderEdit()
    expect((screen.getByLabelText(SOURCE_PATH_ARG_LABEL) as HTMLElement).tagName).toBe("SELECT")
    cleanup()

    // ⚠ A `<select>` with one option would TRAP a person on a server that published nothing.
    // The honest control is the one that matches what is knowable — HI-04's reasoning, one
    // field over, pointed the other way: there the server never publishes folders, here it
    // usually does publish argument names, and the control follows the evidence.
    renderEdit({
      connection: mcpConnection({
        discovered_tools: UNDESCRIBED_TOOLS,
        config: {
          source_tools: {
            list_tool: "enumerate_vault",
            read_tool: "fetch_entry",
            arg_path: "waypoint",
          },
        },
      } as never),
    })
    const control = screen.getByLabelText(SOURCE_PATH_ARG_LABEL) as HTMLInputElement
    expect(control.tagName).toBe("INPUT")
    expect(control.value).toBe("waypoint")
  })

  // ── 2 · THE ROWS, DERIVED FROM THE SERVER'S OWN SCHEMA ──────────────────────────────

  it("derives one row per required argument the path does not already carry", () => {
    renderEdit()
    // The path argument is unset, so it is `path` — which this server does not ask for, so
    // all three of its required arguments still need a value.
    expect(argRowNames().sort()).toEqual(["holder", "trail", "vault"])
  })

  it("⭐ choosing which argument carries the path REMOVES it from the rows", async () => {
    // The two namespaces are disjoint on the wire; they must be disjoint on screen too, or a
    // person supplies a static for the very argument the address is written into and pins
    // every browse to one folder.
    const user = userEvent.setup({ delay: null })
    renderEdit()
    await user.selectOptions(screen.getByLabelText(SOURCE_PATH_ARG_LABEL), "trail")
    expect(argRowNames().sort()).toEqual(["holder", "vault"])
  })

  it("⛔ STILL RENDERS A STORED STATIC THE SERVER NO LONGER ASKS FOR, and says why", () => {
    // Same non-negotiable as the path control. A row dropped from the screen is a row dropped
    // from the draft, and `configFromDraft` writes the column WHOLE.
    renderEdit({
      connection: mcpConnection({
        discovered_tools: LONE_PATH_TOOLS,
        config: {
          source_tools: {
            list_tool: "enumerate_vault",
            read_tool: "fetch_entry",
            "arg_static.holder": "northwind",
          },
        },
      } as never),
    })
    expect(argRowNames()).toEqual(["holder"])
    expect(argInput("holder").value).toBe("northwind")
    // …and the presence of a row nothing asked for is EXPLAINED rather than unexplained.
    expect(screen.getByText(sourceArgRowNote(false))).toBeInTheDocument()
  })

  it("marks a row the server itself says is required", () => {
    renderEdit()
    expect(screen.getAllByText(sourceArgRowNote(true))).toHaveLength(3)
  })

  it("says the bound tools ask for nothing beyond the path, when that is TRUE", () => {
    renderEdit({ connection: mcpConnection({ discovered_tools: LONE_PATH_TOOLS } as never) })
    expect(argRowNames()).toEqual([])
    expect(screen.getByText(SOURCE_ARGS_NONE_NEEDED)).toBeInTheDocument()
    // NEGATIVE CONTROL: it does not also claim the server said nothing.
    expect(screen.queryByText(SOURCE_ARGS_UNDESCRIBED)).not.toBeInTheDocument()
  })

  it("⚠ …and says something DIFFERENT when the server described nothing at all", () => {
    // *"asks for nothing"* and *"has not said"* are two different facts, and only one of them
    // is knowable here. Claiming the first over the second is the empty-listing lie in prose.
    renderEdit({ connection: mcpConnection({ discovered_tools: UNDESCRIBED_TOOLS } as never) })
    expect(screen.getByText(SOURCE_ARGS_UNDESCRIBED)).toBeInTheDocument()
    expect(screen.queryByText(SOURCE_ARGS_NONE_NEEDED)).not.toBeInTheDocument()
  })

  // ── 3 · THE REFUSAL, SAID BEFORE SOMEBODY HITS IT ───────────────────────────────────

  it("⛔ names every unfilled argument and says the call is REFUSED, not answered empty", async () => {
    // `239-06` made this a refusal by name instead of an empty listing. A person should read
    // that on the card that causes it, not in a 502 an hour later — the same shape the root
    // field already uses ("a blank root is refused rather than guessed").
    const user = userEvent.setup({ delay: null })
    renderEdit()
    await user.selectOptions(screen.getByLabelText(SOURCE_PATH_ARG_LABEL), "trail")
    await user.type(argInput("holder"), "northwind")

    const note = screen.getByTestId("connection-source-args-incomplete")
    expect(note).toHaveTextContent(sourceArgsIncompleteNote(["vault"]))
    // CONTENT: the unfilled one is named and the filled one is not.
    expect(note.textContent).toContain("vault")
    expect(note.textContent).not.toContain("holder")
  })

  it("…and the warning GOES AWAY once every required argument has a value", async () => {
    const user = userEvent.setup({ delay: null })
    renderEdit()
    // POSITIVE CONTROL: it is there to begin with.
    expect(screen.getByTestId("connection-source-args-incomplete")).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(SOURCE_PATH_ARG_LABEL), "trail")
    await user.type(argInput("holder"), "northwind")
    await user.type(argInput("vault"), "ledger")
    expect(screen.queryByTestId("connection-source-args-incomplete")).not.toBeInTheDocument()
  })

  it("⚠ an incomplete mapping does NOT block Save — the card informs, it does not gate", async () => {
    // Blocking would be a new failure mode: a person who cannot finish now could not record
    // what they have. The backend refuses at CALL time, which is where the refusal belongs.
    const user = userEvent.setup({ delay: null })
    const { onUpdate } = renderEdit()
    expect(screen.getByTestId("connection-source-args-incomplete")).toBeInTheDocument()
    await save(user)
    await waitFor(() => expect(onUpdate).toHaveBeenCalled())
  })

  // ── 4 · WHAT GETS SAVED ─────────────────────────────────────────────────────────────

  it("writes the mapping as `arg_path` and `arg_static.<name>` inside source_tools", async () => {
    const user = userEvent.setup({ delay: null })
    const { onUpdate } = renderEdit()
    await user.selectOptions(screen.getByLabelText(SOURCE_PATH_ARG_LABEL), "trail")
    await user.type(argInput("holder"), "northwind")
    await user.type(argInput("vault"), "ledger")
    await save(user)

    expect((await savedConfig(onUpdate)).source_tools).toEqual({
      list_tool: "enumerate_vault",
      read_tool: "fetch_entry",
      arg_path: "trail",
      "arg_static.holder": "northwind",
      "arg_static.vault": "ledger",
    })
  })

  it("⭐ THE WIPE — an argument mapping survives a plain rename", async () => {
    // `update_connection` writes `config` as a WHOLE COLUMN. Anything the draft forgets is
    // DELETED by an edit to the connection's NAME, with a 200 and no receipt. That is HI-02,
    // and it is the reason every new key must be carried, not merely rendered.
    const user = userEvent.setup({ delay: null })
    const { onUpdate } = renderEdit({
      connection: mcpConnection({
        config: {
          source_tools: {
            list_tool: "enumerate_vault",
            read_tool: "fetch_entry",
            root_path: "/srv/docs",
            arg_path: "trail",
            "arg_static.holder": "northwind",
            "arg_static.vault": "ledger",
          },
        },
      } as never),
    })

    const nameField = screen.getByDisplayValue("Team file server")
    await user.clear(nameField)
    await user.type(nameField, "Team file server (EU)")
    await save(user)

    expect((await savedConfig(onUpdate)).source_tools).toEqual({
      list_tool: "enumerate_vault",
      read_tool: "fetch_entry",
      root_path: "/srv/docs",
      arg_path: "trail",
      "arg_static.holder": "northwind",
      "arg_static.vault": "ledger",
    })
  })

  it("⭐ THE OAUTH WIPE — the same mapping survives a rename on the OAuth arm", async () => {
    // ⚠ HI-02 WAS LIVE SPECIFICALLY ON THE ARM NOBODY FIXED. `store_oauth_tokens` sets
    // `auth_type = "oauth_byo"` after an MCP OAuth round trip, so an MCP server connected by
    // OAuth arrives on `configFromDraft`'s oauth arm, not its mcp arm. Every arm, every time.
    const user = userEvent.setup({ delay: null })
    const { onUpdate } = renderEdit({
      connection: mcpConnection({
        id: "conn-mcp-oauth",
        name: "OAuth file server",
        auth_type: "oauth_byo",
        config: {
          source_tools: {
            list_tool: "enumerate_vault",
            read_tool: "fetch_entry",
            arg_path: "trail",
            "arg_static.holder": "northwind",
          },
        },
      } as never),
    })

    const nameField = screen.getByDisplayValue("OAuth file server")
    await user.clear(nameField)
    await user.type(nameField, "OAuth file server (EU)")
    await save(user)

    expect((await savedConfig(onUpdate)).source_tools).toEqual({
      list_tool: "enumerate_vault",
      read_tool: "fetch_entry",
      arg_path: "trail",
      "arg_static.holder": "northwind",
    })
  })

  it("⛔ an UNFILLED row is OMITTED, never written as an empty value", async () => {
    // ⚠ A DELIBERATE DIVERGENCE FROM THE ADAPTER, and the reason is the whole safety half.
    // `_static_args` KEEPS an empty value, because through the API it is a value somebody
    // typed. Here every derived row starts empty, so writing them would put `arg_static.*`
    // keys on the row for arguments nobody supplied — and `refuse_if_underspecified` would
    // then have NOTHING TO SAY, because the key IS present. Opening this panel would silently
    // disable the refusal for every argument at once.
    const user = userEvent.setup({ delay: null })
    const { onUpdate } = renderEdit()
    await user.type(argInput("holder"), "northwind")
    await save(user)

    const bound = (await savedConfig(onUpdate)).source_tools as Record<string, string>
    expect(bound["arg_static.holder"]).toBe("northwind")
    expect(Object.keys(bound)).not.toContain("arg_static.vault")
    expect(Object.keys(bound)).not.toContain("arg_static.trail")
  })

  it("clearing a stored static removes its key rather than sending an empty value", async () => {
    const user = userEvent.setup({ delay: null })
    const { onUpdate } = renderEdit({
      connection: mcpConnection({
        config: {
          source_tools: {
            list_tool: "enumerate_vault",
            read_tool: "fetch_entry",
            "arg_static.holder": "northwind",
          },
        },
      } as never),
    })
    await user.clear(argInput("holder"))
    await save(user)

    const bound = (await savedConfig(onUpdate)).source_tools as Record<string, string>
    expect(Object.keys(bound)).not.toContain("arg_static.holder")
  })

  it("respects the stored ceilings — 512 on a value, 64 on the whole key", () => {
    // `McpConfig.source_tools` is `dict[Annotated[str, max_length=64], Annotated[str,
    // max_length=512]]` (review ME-07). A box with no ceiling composes a body the model
    // refuses, and a 422 arrives wearing the generic "Couldn't save that".
    expect(SOURCE_ARG_KEY_MAX).toBe(64)
    expect(SOURCE_ARG_VALUE_MAX).toBe(512)
    expect(mcpSourceSource.length).toBeGreaterThan(0)

    renderEdit()
    expect(argInput("holder").maxLength).toBe(SOURCE_ARG_VALUE_MAX)
  })

  it("⚠ an argument name too long to STORE gets no box, and the absence is explained", () => {
    // A derived name whose `arg_static.` key would exceed 64 characters cannot be written at
    // all. Rendering a box for it would collect an answer the save then drops — the silent
    // wipe again, wearing a helpful face. It is named instead.
    const tooLong = "b".repeat(SOURCE_ARG_KEY_MAX - SOURCE_ARG_STATIC_PREFIX.length + 1)
    renderEdit({
      connection: mcpConnection({
        discovered_tools: [
          {
            name: "enumerate_vault",
            inputSchema: { type: "object", required: [tooLong], properties: { [tooLong]: {} } },
          },
          { name: "fetch_entry", inputSchema: { type: "object", required: [] } },
        ] as McpDiscoveredTool[],
      } as never),
    })
    expect(argRowNames()).toEqual([])
    expect(screen.getByTestId("connection-source-args-unstorable")).toHaveTextContent(
      sourceArgsUnstorableNote([tooLong]),
    )
  })

  it("⛔ shows the stored mapping as TEXT for a reader who cannot write, never blank", async () => {
    // The 185 rule this panel already follows: a control that could never do anything is
    // REMOVED, not disabled — but the VALUE must still be legible, or a read-only reader is
    // told the connection is unconfigured when it is not.
    renderEdit({
      isOrgAdmin: false,
      connection: mcpConnection({
        config: {
          source_tools: {
            list_tool: "enumerate_vault",
            read_tool: "fetch_entry",
            arg_path: "trail",
            "arg_static.holder": "northwind",
          },
        },
      } as never),
    })
    const section = await screen.findByTestId("connection-source-args")
    expect(section.textContent).toContain("trail")
    expect(section.textContent).toContain("northwind")
  })

  // ── 5 · THE FENCES — the keys are the SERVER'S, and no server is named ──────────────

  it("⚠ SAME-COMMIT SYNC — both key families are read out of the adapter's own source", () => {
    // Two copies of one fact. If `mcp_source.py` renames either prefix, this card writes keys
    // nothing reads — a mapping that saves, reports success, and changes nothing on the wire.
    expect(mcpSourceSource).toContain(`PATH_ARG_KEY = "${SOURCE_ARG_PATH_KEY}"`)
    expect(mcpSourceSource).toContain(`STATIC_ARG_PREFIX = "${SOURCE_ARG_STATIC_PREFIX}"`)
    // ⛔ DISJOINT, and asserted rather than assumed — the backend's whole naming argument.
    // `arg_static.` must never be a prefix of `arg_path`, in either direction.
    expect(SOURCE_ARG_PATH_KEY.startsWith(SOURCE_ARG_STATIC_PREFIX)).toBe(false)
    expect(SOURCE_ARG_STATIC_PREFIX.startsWith(SOURCE_ARG_PATH_KEY)).toBe(false)
  })

  it("⛔ NO VENDOR NAME AND NO ARGUMENT DEFAULT — a second server is rows, not code", () => {
    // The whole point of `SEED-259`'s ruling. The worked case that produced it needed three
    // arguments; if either of those names, or the server's, reached a literal in this surface,
    // the next server would need a code change. Scanned as STRING LITERALS so the prose above
    // (which legitimately discusses services by name) cannot make this fence lie.
    const forbidden = ['"owner"', '"repo"', '"branch"', "'owner'", "'repo'", "arg_static.owner"]
    for (const needle of forbidden) {
      expect(panelSource).not.toContain(needle)
      expect(cardSource).not.toContain(needle)
      expect(copySource).not.toContain(needle)
    }
    // NON-VACUITY: the same scan DOES find the generic key family, so the sources really were
    // read and really do carry this feature.
    expect(copySource).toContain(SOURCE_ARG_STATIC_PREFIX)
    // ⚠ 239-08 — THE POSITIVE CONTROL FOLLOWS THE MARKUP. `connection-source-args` used to be
    // spelled in the panel; the extraction moved it to `SourceToolsCard.tsx`, so asserting it
    // over the panel would now be FALSE and asserting it nowhere would make the negative scan
    // above unfalsifiable. It is asserted where the id actually lives.
    expect(cardSource).toContain("connection-source-args")
    // …and the PANEL's own scan is kept non-vacuous by the thing that replaced the markup: the
    // panel must still MOUNT the card. Without this, `panelSource` could resolve to "" and
    // every `not.toContain` above it would pass for free.
    expect(panelSource).toContain("<SourceToolsCard")
  })

  // ── 6 · THE PURE DERIVATIONS, DRIVEN DIRECTLY ───────────────────────────────────────

  it("draftFromConnection hydrates the mapping, so a save can carry it back", () => {
    const draft = draftFromConnection(
      mcpConnection({
        config: {
          source_tools: {
            list_tool: "enumerate_vault",
            read_tool: "fetch_entry",
            arg_path: "trail",
            "arg_static.holder": "northwind",
            "arg_static.vault": "ledger",
          },
        },
      } as never),
    )
    expect(draft.sourcePathArg).toBe("trail")
    expect(draft.sourceStaticArgs).toEqual({ holder: "northwind", vault: "ledger" })
  })

  it("a row with no mapping hydrates to empty, never to a guess", () => {
    const draft = draftFromConnection(mcpConnection({ config: {} } as never))
    expect(draft.sourcePathArg).toBe("")
    expect(draft.sourceStaticArgs).toEqual({})
  })

  it("sourceToolsFromDraft emits nothing for an unmapped draft", () => {
    expect(sourceToolsFromDraft({ ...EMPTY_DRAFT })).toBeUndefined()
  })

  it("⛔ a non-MCP shape never acquires the keys, however the draft is filled", () => {
    // Containment. `SendEmailConfig` is `extra="forbid"`; a stray `source_tools` there is a
    // 422 for a connection that has nothing to do with files.
    expect(
      configFromDraft({
        ...EMPTY_DRAFT,
        capability: "send_email",
        host: "smtp.example.com",
        port: "465",
        fromAddress: "a@example.com",
        sourcePathArg: "trail",
        sourceStaticArgs: { holder: "northwind" },
      }),
    ).not.toHaveProperty("source_tools")
    expect(
      configFromDraft({
        ...EMPTY_DRAFT,
        capability: "service",
        sourcePathArg: "trail",
        sourceStaticArgs: { holder: "northwind" },
      }),
    ).toEqual({})
  })

  it("⛔ an argument named like a prototype member reads as ABSENT, not as a function", () => {
    // T-211-15a's sink, on a fresh surface: these names arrive from a REMOTE server's schema,
    // and `TABLE[key] ?? ""` does not fire its fallback for an inherited member — it hands
    // back a function, which React then renders or refuses in ways nobody predicted.
    const model = sourceArgumentModel(
      [
        {
          name: "enumerate_vault",
          inputSchema: { type: "object", required: ["constructor", "__proto__"], properties: {} },
        },
      ] as McpDiscoveredTool[],
      { ...EMPTY_DRAFT, sourceListTool: "enumerate_vault", sourceReadTool: "enumerate_vault" },
    )
    for (const row of model.rows) {
      expect(typeof row.value).toBe("string")
    }
  })

  it("sourceArgumentModel reads the EFFECTIVE tools — the defaults apply when a slot is empty", () => {
    // `_resolve_binding` does `tools.get("list_tool") or DEFAULT_LIST_TOOL`, so an unbound
    // slot is not "no tool", it is the reference server's name. A model that treated it as
    // nothing would show no rows for a connection that will really be called.
    const model = sourceArgumentModel(
      [
        {
          name: "list_directory",
          inputSchema: { type: "object", required: ["holder"], properties: { holder: {} } },
        },
      ] as McpDiscoveredTool[],
      { ...EMPTY_DRAFT },
    )
    expect(model.rows.map((r) => r.name)).toEqual(["holder"])
    expect(model.missing).toEqual(["holder"])
  })
})
