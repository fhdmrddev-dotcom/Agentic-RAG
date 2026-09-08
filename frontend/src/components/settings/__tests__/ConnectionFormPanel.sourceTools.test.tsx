/**
 * Phase 239 (D-239-01 / D-239-02) — the file-source binding, as a thing a person can SEE.
 *
 * ⭐ WHAT THIS SUITE IS FOR. `connector_connections.config["source_tools"]` is what makes
 * "adding a source is rows, not code" true. Auto-detection writes it on discovery; this panel
 * is the only place a human can read what was guessed and correct it. Every case below guards
 * a way that could be true in the wire format and false on the screen.
 *
 * ⚠ CONTENT, NEVER PRESENCE. Phase 235's finding, applied: a fence that asserts a block exists
 * by `data-testid` cannot see the content drift inside it. So the options are compared as a
 * SET of strings, the fallback labels are compared against the adapter's own constants read
 * out of the shipped Python, and the saved payload is compared key by key.
 *
 * ⭐ THE CASE THAT MATTERS MOST is `the binding survives a rename`. `configFromDraft` rebuilds
 * the whole config object and `update_connection` writes that column WHOLE — so a panel that
 * did not carry `source_tools` and `root_path` in its draft would silently delete an
 * auto-detected binding every time somebody edited the connection's NAME. Nothing else in the
 * tree can observe that.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup, within, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ConnectionFormPanel } from "../ConnectionFormPanel"
import {
  SOURCE_TOOLS_HEADING,
  SOURCE_TOOLS_HELP,
  SOURCE_TOOLS_LIST_LABEL,
  SOURCE_TOOLS_READ_LABEL,
  SOURCE_TOOLS_DEFAULT_LIST,
  SOURCE_TOOLS_DEFAULT_READ,
  sourceToolUnsetLabel,
  sourceToolsWithheldNote,
  SOURCE_TOOL_MUTATION_WORDS,
  configFromDraft,
  draftFromConnection,
  EMPTY_DRAFT,
} from "../connectionFormCopy"
// The ADAPTER's own source, through Vite's `?raw` loader — the shipped house idiom for a
// fence the rendered DOM cannot express (`ConnectionFormPanel.test.tsx:55`). This is what
// stops the two copies of `list_directory` drifting: the panel tells a person what will
// happen if they leave a slot empty, and only the Python decides what actually happens.
import mcpSourceSource from "../../../../../backend/app/services/sources/adapters/mcp_source.py?raw"
// …and the SERVICE's own source, for the mutation-word list the picker must not drift from.
// The server decides what is REFUSED at the boundary; this module decides what is OFFERED.
import connectorServiceSource from "../../../../../backend/app/services/connector_service.py?raw"
import type { ConnectorConnection, McpDiscoveredTool } from "@/lib/api"

const noop = () => {}

const DISCOVERED: McpDiscoveredTool[] = [
  { name: "list_directory", description: "List a directory." },
  { name: "read_file", description: "Read a file." },
  { name: "execute_command", description: "Run a shell command." },
]

function mcpConnection(overrides: Partial<ConnectorConnection> = {}): ConnectorConnection {
  return {
    id: "conn-mcp-1",
    org_id: "org-1",
    service_id: "custom_mcp",
    name: "Team file server",
    auth_type: "mcp",
    mcp_server_url: "https://files.example.com/mcp",
    config: {},
    is_enabled: true,
    discovered_tools: DISCOVERED,
    ...overrides,
  } as ConnectorConnection
}

function renderEdit(
  props: Partial<React.ComponentProps<typeof ConnectionFormPanel>> = {},
) {
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

/** The saved `config`, whatever the panel actually sent. */
async function savedConfig(onUpdate: ReturnType<typeof vi.fn>) {
  await waitFor(() => expect(onUpdate).toHaveBeenCalled())
  return onUpdate.mock.calls[0][1].config as Record<string, unknown>
}

async function save(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /save/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => cleanup())

describe("Phase 239 — the file source mapping a person can see and correct", () => {
  // ── 1 · it renders, and it renders for the right connections ────────────────────────

  it("shows the binding editor for an MCP connection whose tools are known", () => {
    renderEdit()
    const section = screen.getByTestId("connection-source-tools")

    // CONTENT, not presence: the heading, the sentence, and both slot labels.
    expect(within(section).getByText(SOURCE_TOOLS_HEADING)).toBeInTheDocument()
    expect(within(section).getByText(SOURCE_TOOLS_HELP)).toBeInTheDocument()
    expect(within(section).getByLabelText(SOURCE_TOOLS_LIST_LABEL)).toBeInTheDocument()
    expect(within(section).getByLabelText(SOURCE_TOOLS_READ_LABEL)).toBeInTheDocument()
  })

  it("shows nothing at all before a single tool has been discovered", () => {
    // POSITIVE CONTROL FIRST. Without it this case is vacuously green on a tree where the
    // section does not exist at all — which is exactly what it measured at RED.
    renderEdit()
    expect(screen.getByTestId("connection-source-tools")).toBeInTheDocument()
    cleanup()

    renderEdit({ connection: mcpConnection({ discovered_tools: [] }) })
    expect(screen.queryByTestId("connection-source-tools")).not.toBeInTheDocument()
  })

  it("⛔ never offers the binding on a capability connection, however its tools are named", () => {
    // POSITIVE CONTROL, same reason.
    renderEdit()
    expect(screen.getByTestId("connection-source-tools")).toBeInTheDocument()
    cleanup()

    // THE HIJACK, from the client side. `sources/base.CONFIG_PROTOCOL_MARKERS` resolves ANY
    // connection carrying a non-empty `source_tools` to `McpSourceAdapter` — so a Slack row
    // that acquired the key would be handed to the MCP adapter and asked to call a tool over
    // a server URL it does not have. The picker must not be the thing that puts it there.
    renderEdit({
      connection: mcpConnection({
        service_id: "slack",
        auth_type: "static_key",
        capability: "post_message",
        mcp_server_url: undefined,
        config: { default_channel: "#ops" },
      } as Partial<ConnectorConnection>),
    })
    expect(screen.queryByTestId("connection-source-tools")).not.toBeInTheDocument()
  })

  // ── 2 · the options are the server's own names, and nothing else ────────────────────

  it("⛔ offers ONLY names the server actually reported (TM-239-05, client half)", () => {
    renderEdit()
    const section = screen.getByTestId("connection-source-tools")

    for (const label of [SOURCE_TOOLS_LIST_LABEL, SOURCE_TOOLS_READ_LABEL]) {
      const select = within(section).getByLabelText(label) as HTMLSelectElement
      const offered = Array.from(select.options).map((o) => o.value)
      expect(offered.filter(Boolean).sort()).toEqual(
        ["execute_command", "list_directory", "read_file"],
      )
    }
  })

  // ── 2b · Phase 239 gap-closure round 1 (CR-01, UI half) — A DESTRUCTIVE TOOL IS NOT A
  //         FILE READER, AND MUST NOT BE OFFERED AS ONE ──────────────────────────────────
  //
  // ⭐ WHAT THIS COSTS IF IT IS WRONG. The label says *"File content tool"*, the dropdown was
  // an unordered dump of the server's entire tool list, and `delete_file` sat in it. A person
  // with `org:manage` mis-clicking one row down binds it; `McpSourceAdapter.check()` reports
  // **ok** (the tool exists); and `watch_service` then calls `read_file(conn, item.id)` — i.e.
  // `tools/call {"name": "delete_file"}` — on every new and every modified file, unattended,
  // on every cycle. Data loss on the connected server behind a green health probe.
  //
  // ⚠ THE JSX COMMENT ASSERTED THE BACKEND WAS THE BACKSTOP AND THAT WAS FALSE FOR THIS
  // CLASS. `reject_unoffered_source_tools` checked only that the name was OFFERED, never that
  // it was safe. That half is the backend's to close; this is the surface that proposed it,
  // and a UI that offers a destructive tool under a reading label is its own defect.

  /** A filesystem-ish server: real readers, and the destructive neighbours a mis-click away. */
  const DESTRUCTIVE: McpDiscoveredTool[] = [
    { name: "list_directory", description: "List a directory." },
    { name: "read_file", description: "Read a file." },
    { name: "delete_file", description: "Delete a file at the given path." },
    { name: "write_file", description: "Write content to a file." },
    { name: "move_file", description: "Move a file." },
  ]

  const optionsFor = (label: string) => {
    const section = screen.getByTestId("connection-source-tools")
    const select = within(section).getByLabelText(label) as HTMLSelectElement
    return Array.from(select.options).map((o) => o.value).filter(Boolean)
  }

  it("⛔ CR-01 — a destructive tool is NEVER offered under `File content tool`", () => {
    renderEdit({ connection: mcpConnection({ discovered_tools: DESTRUCTIVE }) })
    for (const label of [SOURCE_TOOLS_LIST_LABEL, SOURCE_TOOLS_READ_LABEL]) {
      const offered = optionsFor(label)
      expect(offered).toEqual(["list_directory", "read_file"])
      expect(offered).not.toContain("delete_file")
      expect(offered).not.toContain("write_file")
      expect(offered).not.toContain("move_file")
    }
  })

  it("⚠ …and the withholding is STATED on screen, never silent", () => {
    // A person who came looking for a tool they can see in the actions list must be told why
    // it is absent here. An unexplained absence is read as a bug in the discovery, and the
    // repair a person then reaches for is a hand-crafted PATCH — the one door with no guard.
    renderEdit({ connection: mcpConnection({ discovered_tools: DESTRUCTIVE }) })
    const section = screen.getByTestId("connection-source-tools")
    expect(section.textContent).toContain(sourceToolsWithheldNote(3))
  })

  it("⚠ nothing is withheld when nothing is destructive — the note is ABSENT, not empty", () => {
    renderEdit()
    const section = screen.getByTestId("connection-source-tools")
    expect(section.textContent).not.toContain("not offered here")
  })

  it("⛔ a binding ALREADY stored on a mutating tool stays VISIBLE — opening cannot rewrite it", async () => {
    // ⚠ THE TRAP IN THE OBVIOUS FIX. A `<select>` whose value is not among its options renders
    // as unselected, so a filter alone would make merely OPENING the panel and pressing Save
    // silently re-point a stored binding — the exact wipe class HI-02 is about, introduced by
    // its own remedy. So the stored value is always offered, and a person can SEE what is
    // bound and change it. The refusal to store it belongs at the backend boundary.
    const user = userEvent.setup({ delay: null })
    const { onUpdate } = renderEdit({
      connection: mcpConnection({
        discovered_tools: DESTRUCTIVE,
        config: { source_tools: { list_tool: "list_directory", read_tool: "delete_file" } },
      } as Partial<ConnectorConnection>),
    })
    const section = screen.getByTestId("connection-source-tools")
    const reader = within(section).getByLabelText(SOURCE_TOOLS_READ_LABEL) as HTMLSelectElement

    expect(optionsFor(SOURCE_TOOLS_READ_LABEL)).toContain("delete_file")
    expect(reader.value).toBe("delete_file")

    await save(user)
    expect((await savedConfig(onUpdate)).source_tools).toEqual({
      list_tool: "list_directory",
      read_tool: "delete_file",
    })
  })

  it("⛔ WHOLE TOKENS, NEVER SUBSTRINGS — `list_assets` and `read_dataset` stay offered", () => {
    // ⚠ ME-04, avoided rather than mirrored. The server-side `_looks_like_a_mutation` matches
    // SUBSTRINGS, so `set` ⊂ `assets` and `put` ⊂ `input` silently remove legitimate readers.
    // Doing that here would empty the picker for a server whose tools are named its own way —
    // which is the failure this whole surface exists to prevent.
    renderEdit({
      connection: mcpConnection({
        discovered_tools: [
          { name: "list_assets" }, { name: "read_dataset" }, { name: "input_file" },
          { name: "delete_asset" },
        ] as McpDiscoveredTool[],
      } as Partial<ConnectorConnection>),
    })
    const offered = optionsFor(SOURCE_TOOLS_READ_LABEL)
    expect(offered).toEqual(["list_assets", "read_dataset", "input_file"])
    expect(offered).not.toContain("delete_asset")
  })

  it("⚠ SAME-COMMIT SYNC — the withheld words are the SERVER'S list, read out of its source", () => {
    // Two copies of one judgement. The server's `_MUTATION_WORDS` decides what is refused at
    // the boundary; this one decides what is offered. They must not drift, and a comment
    // saying so is what already failed once on this surface.
    const block = connectorServiceSource.match(
      /_MUTATION_WORDS: tuple\[str, \.\.\.\] = \(([^)]*)\)/,
    )
    expect(block).not.toBeNull()
    const serverWords = [...block![1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]).sort()
    // NON-VACUITY CONTROL — an empty `?raw` or a failed match would satisfy an equality of
    // two empty arrays.
    expect(serverWords).toContain("delete")
    expect(serverWords.length).toBeGreaterThanOrEqual(15)
    expect([...SOURCE_TOOL_MUTATION_WORDS].sort()).toEqual(serverWords)
  })

  it("names the fallback the ADAPTER will really use, pinned against its own source", () => {
    // ⚠ Two copies of one fact. The panel tells a person what happens if they leave a slot
    // empty; only `mcp_source.py` decides what actually happens. Read the Python.
    expect(mcpSourceSource).toContain(`DEFAULT_LIST_TOOL = "${SOURCE_TOOLS_DEFAULT_LIST}"`)
    expect(mcpSourceSource).toContain(`DEFAULT_READ_TOOL = "${SOURCE_TOOLS_DEFAULT_READ}"`)

    renderEdit()
    const section = screen.getByTestId("connection-source-tools")
    const lister = within(section).getByLabelText(SOURCE_TOOLS_LIST_LABEL) as HTMLSelectElement
    const reader = within(section).getByLabelText(SOURCE_TOOLS_READ_LABEL) as HTMLSelectElement

    expect(lister.options[0].textContent).toBe(sourceToolUnsetLabel(SOURCE_TOOLS_DEFAULT_LIST))
    expect(reader.options[0].textContent).toBe(sourceToolUnsetLabel(SOURCE_TOOLS_DEFAULT_READ))
  })

  it("shows the binding the row already carries, rather than an empty guess", () => {
    renderEdit({
      connection: mcpConnection({
        config: { source_tools: { list_tool: "list_directory", read_tool: "read_file" } },
      } as Partial<ConnectorConnection>),
    })
    const section = screen.getByTestId("connection-source-tools")
    expect(
      (within(section).getByLabelText(SOURCE_TOOLS_LIST_LABEL) as HTMLSelectElement).value,
    ).toBe("list_directory")
    expect(
      (within(section).getByLabelText(SOURCE_TOOLS_READ_LABEL) as HTMLSelectElement).value,
    ).toBe("read_file")
  })

  // ── 3 · what gets SAVED ─────────────────────────────────────────────────────────────

  it("sends the chosen tools inside config.source_tools", async () => {
    const user = userEvent.setup({ delay: null })
    const { onUpdate } = renderEdit()
    const section = screen.getByTestId("connection-source-tools")

    await user.selectOptions(
      within(section).getByLabelText(SOURCE_TOOLS_LIST_LABEL), "list_directory",
    )
    await user.selectOptions(
      within(section).getByLabelText(SOURCE_TOOLS_READ_LABEL), "read_file",
    )
    await save(user)

    expect((await savedConfig(onUpdate)).source_tools).toEqual({
      list_tool: "list_directory",
      read_tool: "read_file",
    })
  })

  it("⭐ THE WIPE — an auto-detected binding survives a plain rename", async () => {
    // `update_connection` writes `config` as a WHOLE COLUMN. A panel that rebuilt the object
    // from a draft that never held the binding would delete a working file source every time
    // somebody corrected a typo in the connection's name — with a 200 and no receipt.
    const user = userEvent.setup({ delay: null })
    const { onUpdate } = renderEdit({
      connection: mcpConnection({
        config: { source_tools: { list_tool: "ls", read_tool: "cat", root_path: "/srv/docs" } },
        discovered_tools: [{ name: "ls" }, { name: "cat" }] as McpDiscoveredTool[],
      } as Partial<ConnectorConnection>),
    })

    const nameField = screen.getByDisplayValue("Team file server")
    await user.clear(nameField)
    await user.type(nameField, "Team file server (EU)")
    await save(user)

    expect((await savedConfig(onUpdate)).source_tools).toEqual({
      list_tool: "ls",
      read_tool: "cat",
      root_path: "/srv/docs",
    })
  })

  it("omits source_tools entirely when nothing is bound, rather than sending {}", async () => {
    // ⚠ `{}` IS NOT NOTHING. `CONFIG_PROTOCOL_MARKERS` keys off the presence of a non-empty
    // `source_tools`, and `McpConfig` documents the same distinction: absent means nobody
    // bound this connection to a file surface; empty means somebody looked and named nothing.
    const user = userEvent.setup({ delay: null })
    const { onUpdate } = renderEdit()
    await save(user)
    expect(await savedConfig(onUpdate)).not.toHaveProperty("source_tools")
  })

  it("clearing a slot removes that key rather than sending an empty tool name", async () => {
    const user = userEvent.setup({ delay: null })
    const { onUpdate } = renderEdit({
      connection: mcpConnection({
        config: { source_tools: { list_tool: "list_directory", read_tool: "read_file" } },
      } as Partial<ConnectorConnection>),
    })
    const section = screen.getByTestId("connection-source-tools")
    await user.selectOptions(within(section).getByLabelText(SOURCE_TOOLS_READ_LABEL), "")
    await save(user)

    const config = await savedConfig(onUpdate)
    expect(config.source_tools).toEqual({ list_tool: "list_directory" })
  })

  // ── 4 · TM-239-06 — the binding carries names and nothing else ──────────────────────

  it("⛔ never carries a secret, a URL or a credential into config.source_tools", async () => {
    const user = userEvent.setup({ delay: null })
    const { onUpdate } = renderEdit({
      connection: mcpConnection({
        config: { source_tools: { list_tool: "ls", read_tool: "cat" } },
      } as Partial<ConnectorConnection>),
    })
    await save(user)

    const bound = (await savedConfig(onUpdate)).source_tools as Record<string, string>
    expect(Object.keys(bound).sort()).toEqual(["list_tool", "read_tool"])
    const serialized = JSON.stringify(bound)
    for (const forbidden of ["http", "://", "secret", "token", "Bearer", "files.example.com"]) {
      expect(serialized).not.toContain(forbidden)
    }
  })

  // ── 5 · the pure derivations, driven directly ───────────────────────────────────────

  it("configFromDraft keeps the MCP key set closed — headers, and the binding when bound", () => {
    // ⚠ `McpConfig` is `extra="forbid"`. This object's KEY SET is the contract, and a key it
    // does not declare is a 422 no client type can see (SEED-239's outage mode, one over).
    expect(configFromDraft({ ...EMPTY_DRAFT, capability: "mcp" })).toEqual({ headers: {} })
    expect(
      configFromDraft({
        ...EMPTY_DRAFT,
        capability: "mcp",
        sourceListTool: "ls",
        sourceReadTool: "cat",
        sourceRootPath: "/srv",
      }),
    ).toEqual({ headers: {}, source_tools: { list_tool: "ls", read_tool: "cat", root_path: "/srv" } })
  })

  it("draftFromConnection hydrates the binding, so a save can carry it back", () => {
    const draft = draftFromConnection(
      mcpConnection({
        config: { source_tools: { list_tool: "ls", read_tool: "cat", root_path: "/srv" } },
      } as Partial<ConnectorConnection>),
    )
    expect(draft.sourceListTool).toBe("ls")
    expect(draft.sourceReadTool).toBe("cat")
    expect(draft.sourceRootPath).toBe("/srv")
  })

  it("a row with no binding hydrates to empty strings, never to the defaults", () => {
    // ⚠ Seeding the draft with `list_directory` would turn "nobody has bound this" into
    // "somebody chose the reference server's names" on the next save — a claim the person
    // never made, and the thing that makes an unbound row indistinguishable from a bound one.
    const draft = draftFromConnection(mcpConnection())
    expect(draft.sourceListTool).toBe("")
    expect(draft.sourceReadTool).toBe("")
    expect(draft.sourceRootPath).toBe("")
  })

  // ── 6 · Phase 239 gap-closure round 1 (HI-02) — THE SAME WIPE, ON THE OTHER ARM ──────
  //
  // ⭐ EVERY CASE IN §3 ABOVE USED `auth_type: "mcp"`, AND THAT IS WHY THE WIPE SURVIVED.
  // `store_oauth_tokens` sets `auth_type = "oauth_byo"` on the row after an MCP OAuth round
  // trip, and `draftFromConnection` maps that to `capability: "oauth"` BEFORE it looks at
  // `mcp_server_url`. `configFromDraft`'s oauth arm never called `sourceToolsFromDraft`, so
  // every save on an MCP server connected by OAuth — the flow the *Custom MCP Server* door
  // pushes you into whenever the server advertises OAuth — dropped the binding. `config` is
  // a WHOLE-COLUMN replace, so a rename deleted a working file source with a 200.
  //
  // ⚠ THIS FILE'S OWN HEADER NAMED THE RULE THE ARM BREAKS. "THE WIPE" is §3's starred case.
  // The mechanism was understood, fixed on one arm, and left standing on the other.

  /** The same server, connected by OAuth instead of a static key. Everything else is equal
   *  to `mcpConnection()`, so a diff between the two cases is the auth arm and nothing else. */
  function oauthMcpConnection(overrides: Partial<ConnectorConnection> = {}): ConnectorConnection {
    return mcpConnection({
      id: "conn-mcp-oauth",
      name: "OAuth file server",
      auth_type: "oauth_byo",
      ...overrides,
    } as Partial<ConnectorConnection>)
  }

  it("⭐ HI-02 THE OAUTH WIPE — an MCP-over-OAuth binding survives a plain rename", async () => {
    const user = userEvent.setup({ delay: null })
    const { onUpdate } = renderEdit({
      connection: oauthMcpConnection({
        config: { source_tools: { list_tool: "ls", read_tool: "cat", root_path: "/srv/docs" } },
        discovered_tools: [{ name: "ls" }, { name: "cat" }] as McpDiscoveredTool[],
      } as Partial<ConnectorConnection>),
    })

    const nameField = screen.getByDisplayValue("OAuth file server")
    await user.clear(nameField)
    await user.type(nameField, "OAuth file server (EU)")
    await save(user)

    expect((await savedConfig(onUpdate)).source_tools).toEqual({
      list_tool: "ls",
      read_tool: "cat",
      root_path: "/srv/docs",
    })
  })

  it("⭐ HI-02 — and a binding CHOSEN in the picker on an OAuth row is actually saved", async () => {
    // ⚠ THE HALF THAT MAKES IT UNRECOVERABLE. The review reasoned the picker was HIDDEN for
    // these rows; it is not (see the case below). It renders, a person can select in it, and
    // the selection was then discarded on save — so the one repair available in the UI
    // silently did nothing, which is worse than an absent control.
    const user = userEvent.setup({ delay: null })
    const { onUpdate } = renderEdit({ connection: oauthMcpConnection() })
    const section = screen.getByTestId("connection-source-tools")

    await user.selectOptions(
      within(section).getByLabelText(SOURCE_TOOLS_LIST_LABEL), "list_directory",
    )
    await user.selectOptions(
      within(section).getByLabelText(SOURCE_TOOLS_READ_LABEL), "read_file",
    )
    await save(user)

    expect((await savedConfig(onUpdate)).source_tools).toEqual({
      list_tool: "list_directory",
      read_tool: "read_file",
    })
  })

  it("⚠ the picker DOES render on an MCP-over-OAuth row — the panel reads the ROW, not the draft", () => {
    // Recorded as a fact rather than assumed: `ConnectionFormPanel`'s local `capability` is
    // derived from `connection.mcp_server_url`, not from `draft.capability`, so the card is
    // visible here. Only the SAVE path consults `draft.capability`. If a later change moves
    // the render gate onto the draft, this case fails and names the regression.
    renderEdit({ connection: oauthMcpConnection() })
    expect(screen.getByTestId("connection-source-tools")).toBeInTheDocument()
  })

  it("⛔ a NON-MCP oauth row still sends no `source_tools` — the arm did not widen", () => {
    // The containment claim. A Google/Microsoft `oauth_byo` row has no binding to carry, and
    // `OAuthConnectionConfig` does not declare the key; adding it unconditionally would be a
    // 422 for every first-party OAuth connection in the org.
    expect(
      configFromDraft({ ...EMPTY_DRAFT, capability: "oauth", customClientId: "abc.apps" }),
    ).toEqual({ custom_client_id: "abc.apps" })
  })

  it("⛔ …and an oauth arm that IS bound keeps its client id alongside the binding", () => {
    expect(
      configFromDraft({
        ...EMPTY_DRAFT,
        capability: "oauth",
        customClientId: "abc.apps",
        sourceListTool: "ls",
        sourceReadTool: "cat",
      }),
    ).toEqual({
      custom_client_id: "abc.apps",
      source_tools: { list_tool: "ls", read_tool: "cat" },
    })
  })
})
