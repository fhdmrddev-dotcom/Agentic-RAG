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

    const activeConn: ConnectorConnection = {
      ...revokedConn,
      status: "active",
    }
    expect(connectionStateOf(activeConn)).toBe("ready")
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
