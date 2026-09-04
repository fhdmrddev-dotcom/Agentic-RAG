import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

import { ConnectionFormPanel } from "../ConnectionFormPanel"
import { shapeForService } from "../connectionFormCopy"
import { connectionStateOf, credentialReadingOf } from "../connectionsCopy"
import type { ConnectorConnection } from "@/lib/api"
import * as api from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    createOAuthAuthorizeUrl: vi.fn().mockResolvedValue({
      authorization_url: "https://accounts.google.com/o/oauth2/v2/auth?client_id=google-123",
      state: "test-state-123",
    }),
    getConnectionOAuthToken: vi.fn().mockResolvedValue({
      id: "tok-1",
      connection_id: "conn-g-1",
      account_email: "alex@company.com",
      status: "active",
    }),
  }
})

describe("Phase 215 — BYO OAuth Frontend Components & Copy Derivations", () => {
  it("shapeForService resolves Google and Microsoft to 'oauth'", () => {
    expect(shapeForService("google")).toBe("oauth")
    expect(shapeForService("microsoft")).toBe("oauth")
    expect(shapeForService("slack")).toBe("post_message")
    expect(shapeForService("github")).toBe("mcp")
  })

  it("connectionStateOf accurately classifies revoked and active OAuth connections", () => {
    const revokedConn: ConnectorConnection = {
      id: "conn-1",
      org_id: "org-1",
      service_id: "google",
      name: "Google Drive",
      auth_type: "oauth_byo",
      status: "revoked",
      config: {},
      is_enabled: true,
    }
    expect(connectionStateOf(revokedConn)).toBe("revoked")

    // ⚠ AMENDED BY PHASE 221 (D-221-12). This assertion used to read `ready` on a fixture
    // carrying NO `discovered_tools` at all — which is exactly the defect the operator
    // reported on the live Microsoft 365 row: `OAuth connected · ✓ Ready` while the
    // connection advertised zero actions and could do nothing. The fixture modelled the
    // bug, so the fixture is what changes.
    const activeConn: ConnectorConnection = {
      ...revokedConn,
      status: "active",
      discovered_tools: [{ name: "search_files" }],
    }
    expect(connectionStateOf(activeConn)).toBe("ready")

    // ...and the same row WITHOUT actions is not Ready. It reads `not_checked` rather than
    // `unusable` because nothing has run discovery on it — Phase 206.1's AR-03: an empty
    // discovery is not evidence.
    const activeButEmpty: ConnectorConnection = { ...revokedConn, status: "active" }
    expect(connectionStateOf(activeButEmpty)).toBe("not_checked")

    // Discovery HAS run and still found nothing — now it is a measurement, and the word
    // for it is `unusable`.
    expect(
      connectionStateOf({ ...activeButEmpty, last_check_verdict: "ok" } as ConnectorConnection),
    ).toBe("unusable")
  })

  it("credentialReadingOf renders account email and revoked state", () => {
    const activeConn: ConnectorConnection = {
      id: "conn-1",
      org_id: "org-1",
      service_id: "google",
      name: "Google Drive",
      auth_type: "oauth_byo",
      account_email: "alex@company.com",
      status: "active",
      config: {},
      is_enabled: true,
    }
    expect(credentialReadingOf(activeConn)).toBe("alex@company.com")

    const revokedConn: ConnectorConnection = {
      ...activeConn,
      status: "revoked",
    }
    expect(credentialReadingOf(revokedConn)).toBe("OAuth (revoked)")
  })

  it("ConnectionFormPanel renders OAuth authorization card for Google service", () => {
    render(
      <ConnectionFormPanel
        open={true}
        mode="create"
        presetServiceId="google"
        onClose={() => {}}
        canManage={true}
      />
    )

    expect(screen.getByText(/OAuth 2\.0 Authorization/i)).toBeInTheDocument()
    expect(screen.getByTestId("connection-oauth-authorize-btn")).toBeInTheDocument()
    expect(screen.getByText(/Connect with Google Workspace/i)).toBeInTheDocument()
    // Password input should NOT be rendered for OAuth shape
    expect(screen.queryByLabelText(/App password|API key|Secret/i)).not.toBeInTheDocument()
  })

  it("ConnectionFormPanel displays Reconnect badge when status is revoked", () => {
    const revokedConn: ConnectorConnection = {
      id: "conn-rev-1",
      org_id: "org-1",
      service_id: "google",
      name: "Google Workspace",
      auth_type: "oauth_byo",
      account_email: "engineer@company.com",
      status: "revoked",
      config: {},
      is_enabled: true,
    }

    render(
      <ConnectionFormPanel
        open={true}
        mode="edit"
        connection={revokedConn}
        onClose={() => {}}
        canManage={true}
      />
    )

    expect(screen.getByText(/Authorization Revoked/i)).toBeInTheDocument()
    expect(screen.getByText(/engineer@company\.com/i)).toBeInTheDocument()
    expect(screen.getByText(/Reconnect with Google Workspace/i)).toBeInTheDocument()
  })
})

describe("an OAuth row does not wear capability-shaped controls", () => {
  /**
   * ⚠ ALL THREE OF THESE WERE ON SCREEN AT ONCE, ON A CONNECTION THAT WAS WORKING, and the
   * operator reported them as "a lot of fake information that is not needed":
   *
   *   · "Check credential" answered "The check did not run ... nothing_to_check_yet".
   *     An OAuth connection has NO HOST to probe; the question worth asking of it is
   *     "is the token live", which is a different check this panel does not implement.
   *   · The destination footer read "sends to nothing yet - fill the fields above",
   *     pointing at fields that do not exist on an OAuth row.
   *   · A refusal banner explained a failure that had not happened.
   *
   * The guard on the check button was `!connection.mcp_server_url` — correct when there
   * were two shapes and a remote server was the only credential-less one. Phase 215 added
   * a third and nothing widened.
   */
  const oauthConn: ConnectorConnection = {
    id: "conn-oauth-1",
    org_id: "org-1",
    service_id: "google",
    name: "Google Workspace",
    config: { provider: "google" } as ConnectorConnection["config"],
    auth_type: "oauth_byo",
    status: "active",
    account_email: "engineer@company.com",
    is_enabled: true,
    capability: null,
    mcp_server_url: null,
    discovered_tools: [],
    tool_grants: {},
  }

  function renderOAuth() {
    render(
      <ConnectionFormPanel
        open={true}
        mode="edit"
        connection={oauthConn}
        onClose={() => {}}
        canManage={true}
        onCheck={vi.fn()}
      />
    )
  }

  // ⚠ THERE IS NO "offers no Check credential control" CASE HERE, AND ITS ABSENCE IS A
  // FINDING RATHER THAN AN OVERSIGHT. It was written, and driven against the pre-fix panel
  // to see it fail — and it PASSED, because this harness does not satisfy the button's
  // other preconditions (a live platform among them), so the control was missing for a
  // reason that had nothing to do with the guard. A test that cannot fail is worse than no
  // test: it reports a property it never examined. The button guard is real — it is the
  // `!isOAuthRow` term added beside `!connection.mcp_server_url` — but proving it needs a
  // harness that can render the button at all, which is owed rather than faked here.

  it("claims no destination", () => {
    renderOAuth()
    expect(screen.queryByTestId("connection-destination-footer")).toBeNull()
    expect(screen.queryByText(/fill the fields above/i)).toBeNull()
  })

  it("still shows what an OAuth row IS", () => {
    // The cleanup removes noise, not information. ⚠ This one passes on the OLD panel too —
    // it is a NEGATIVE control against over-removal, not a fence for the change.
    renderOAuth()
    expect(screen.getByText(/engineer@company\.com/i)).toBeInTheDocument()
    expect(screen.getByText(/OAuth 2\.0 Authorization/i)).toBeInTheDocument()
  })

  it("leaves a capability row untouched", () => {
    // The guard is by SHAPE, not a blanket removal: a Slack row still has a host to probe
    // and a destination to state, and both must survive.
    render(
      <ConnectionFormPanel
        open={true}
        mode="edit"
        connection={{
          ...oauthConn,
          id: "conn-slack-1",
          service_id: "slack",
          name: "Slack",
          auth_type: "static_key",
          account_email: null,
          capability: "post_message",
          config: { default_channel: "#ops" } as ConnectorConnection["config"],
        }}
        onClose={() => {}}
        canManage={true}
        onCheck={vi.fn()}
      />
    )
    // ⚠ THE FOOTER, NOT THE CHECK BUTTON, AND THE DIFFERENCE IS DELIBERATE. The button
    // carries further preconditions this harness does not satisfy (a live platform among
    // them), so asserting its presence here would be testing the harness rather than the
    // shape guard. The footer depends on the guard alone, which is the property in
    // question: it VANISHES for OAuth and SURVIVES for a capability row.
    expect(screen.getByTestId("connection-destination-footer")).toBeInTheDocument()
  })
})
