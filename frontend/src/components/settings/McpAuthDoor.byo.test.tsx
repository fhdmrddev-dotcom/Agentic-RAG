import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { McpAuthDoor } from "./McpAuthDoor"
import { EMPTY_DRAFT } from "./connectionFormCopy"
import * as api from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    probeMcpAuth: vi.fn(),
    createMcpOAuthAuthorizeUrl: vi.fn(),
  }
})

/**
 * ⭐ BUG-260902-01 — THE BYO ARM WAS DEAD, AND THE SCREEN SAID OTHERWISE.
 *
 * `registration_required: true` means the server does NOT do RFC 7591 dynamic registration,
 * so the operator must bring a client id and secret. The door renders those two inputs on
 * `regRequired` (`:327`) and enables the button only once both are filled (`:367`) — but the
 * SUBMIT handler keyed on `draft.authType === "custom_app"`, and `ConnectionDraft.authType`
 * is `"static_key" | "oauth_byo" | "mcp"`. **There is no `"custom_app"`.**
 *
 * ⚠ SO THE CONDITION WAS ALWAYS FALSE and neither the client id nor the secret was ever
 * sent. A person filled both fields, the button lit, they clicked, and `/authorize` received
 * a connection with no `custom_client_id` against a server advertising no registration
 * endpoint — the one combination it cannot proceed from. Nothing errored on the way.
 *
 * ⚠ `tsc` HAD ALREADY SAID SO, IN THOSE WORDS: *"This comparison appears to be unintentional
 * because the types … and '\"custom_app\"' have no overlap"* (TS2367, three times). The
 * baseline was 66 and the tree measured 81. **A typecheck that nobody reads is a test that
 * nobody runs**, which is why the count-gate rule pairs it with a number.
 *
 * The fix keys the handler on the same fact the render keys on: the probe's own
 * `registration_required`. One source for what the door shows and what the door sends.
 */
/** A COMPLETE row, spread by both edit fixtures. ⚠ Deliberately not a `as ConnectorConnection`
 *  cast: a cast makes a partial fixture compile while hiding exactly the drift this phase kept
 *  finding between the wire types and the models. `capability` is NULL because an MCP row has
 *  none by construction (migration 126). */
const ROW = {
  id: "conn-1",
  org_id: "org-1",
  service_id: "example",
  name: "Example",
  capability: null,
  mcp_server_url: "https://mcp.example.com/mcp",
  is_enabled: true,
} as const

describe("BUG-260902-01 · the BYO arm actually sends what it collected", () => {
  const BYO_PROBE = {
    kind: "oauth" as const,
    authorization_host: "auth.example.com",
    registration_required: true,
    code_challenge_methods: ["S256"],
    detail: null,
    resource_status: 401,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // ⚠ `window.open` must return a truthy stub: the door now REFUSES before any async work
    // when it is null (BUS-053), so a null here would make every assertion below vacuous.
    vi.stubGlobal(
      "open",
      vi.fn(() => ({ location: { href: "" }, close: vi.fn() })),
    )
  })

  async function probeThen(mode: "create" | "edit", extra: Record<string, unknown>) {
    vi.mocked(api.probeMcpAuth).mockResolvedValue(BYO_PROBE)
    vi.mocked(api.createMcpOAuthAuthorizeUrl).mockResolvedValue({
      authorize_url: "https://auth.example.com/authorize?x=1",
      authorization_host: "auth.example.com",
    })
    render(
      <McpAuthDoor
        draft={{
          ...EMPTY_DRAFT,
          mcpServerUrl: "https://mcp.example.com/mcp",
          name: "Example",
          serviceId: "example",
          customClientId: "operator-client-id",
          customClientSecret: "operator-client-secret",
        }}
        onDraftChange={vi.fn()}
        mode={mode}
        canWrite
        isOrgAdmin
        liveConnectorsOn
        {...extra}
      />,
    )
    fireEvent.click(screen.getByTestId("connection-probe-mcp-btn"))
    await waitFor(() => expect(api.probeMcpAuth).toHaveBeenCalled())
  }

  it("⭐ create: the operator's client id reaches config and the secret reaches secret", async () => {
    const onCreate = vi.fn().mockResolvedValue({ id: "conn-new" })
    await probeThen("create", { onCreate })

    fireEvent.click(await screen.findByTestId("mcp-oauth-connect-btn"))
    await waitFor(() => expect(onCreate).toHaveBeenCalled())

    const body = onCreate.mock.calls[0][0]
    // ⚠ Asserted on the BODY, not on the button being enabled. The button was already
    // enabled under the defect; what was missing was everything behind it.
    expect(body.config?.custom_client_id).toBe("operator-client-id")
    expect(body.secret).toBe("operator-client-secret")
  })

  it("⭐ edit: the same, and the EXISTING config survives (BUS-053)", async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    await probeThen("edit", {
      onUpdate,
      connection: {
        ...ROW,
        id: "conn-1",
        // A key the door did not author. `update_connection` REPLACES the column
        // (`connector_service.py:1041`), so anything not spread here is destroyed.
        config: { headers: { "X-Existing": "kept" } },
      },
    })

    fireEvent.click(await screen.findByTestId("mcp-oauth-connect-btn"))
    await waitFor(() => expect(onUpdate).toHaveBeenCalled())

    const body = onUpdate.mock.calls[0][1]
    expect(body.config?.custom_client_id).toBe("operator-client-id")
    expect(body.config?.headers).toEqual({ "X-Existing": "kept" })
    expect(body.secret).toBe("operator-client-secret")
  })

  it("a DCR server (registration_required false) sends NO config key at all", async () => {
    // ⚠ THE NEGATIVE HALF, and it is the one that protects Notion's live row. An absent key
    // is not written at all (`exclude_unset`), so the registered `custom_client_id` survives.
    // Sending `config: {}` here is what destroyed it before BUS-053.
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    vi.mocked(api.probeMcpAuth).mockResolvedValue({
      ...BYO_PROBE,
      registration_required: false,
    })
    vi.mocked(api.createMcpOAuthAuthorizeUrl).mockResolvedValue({
      authorize_url: "https://auth.example.com/authorize",
      authorization_host: "auth.example.com",
    })
    render(
      <McpAuthDoor
        draft={{ ...EMPTY_DRAFT, mcpServerUrl: "https://mcp.notion.com/mcp", name: "Notion" }}
        onDraftChange={vi.fn()}
        mode="edit"
        canWrite
        isOrgAdmin
        liveConnectorsOn
        onUpdate={onUpdate}
        connection={{
          ...ROW,
          id: "conn-notion",
          config: { custom_client_id: "bD78Ksp3xBJew1kL" },
        }}
      />,
    )
    fireEvent.click(screen.getByTestId("connection-probe-mcp-btn"))
    await waitFor(() => expect(api.probeMcpAuth).toHaveBeenCalled())
    fireEvent.click(await screen.findByTestId("mcp-oauth-connect-btn"))
    await waitFor(() => expect(onUpdate).toHaveBeenCalled())

    expect(onUpdate.mock.calls[0][1].config).toBeUndefined()
  })
})
