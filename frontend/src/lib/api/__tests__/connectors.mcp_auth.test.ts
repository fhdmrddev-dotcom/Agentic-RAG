import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("../_core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../_core")>()
  return {
    ...actual,
    getAuthHeaders: vi.fn().mockResolvedValue({
      Authorization: "Bearer tok-123",
      "X-Org-Id": "org-1",
    }),
  }
})

import {
  ConnectorApiError,
  createMcpOAuthAuthorizeUrl,
  probeMcpAuth,
} from "../connectors"

describe("Phase 222 — probeMcpAuth and createMcpOAuthAuthorizeUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe("probeMcpAuth", () => {
    it("returns probe result for kind: 'open'", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          kind: "open",
          authorization_host: null,
          registration_required: false,
          code_challenge_methods: [],
          detail: null,
          resource_status: 200,
        }),
      })
      vi.stubGlobal("fetch", mockFetch)

      const res = await probeMcpAuth("https://mcp.deepwiki.com/sse")
      expect(res.kind).toBe("open")
      expect(res.registration_required).toBe(false)
      expect(res.authorization_host).toBeNull()
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/connectors/mcp/probe-auth"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ server_url: "https://mcp.deepwiki.com/sse" }),
        }),
      )
    })

    it("returns probe result for kind: 'oauth' with DCR", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          kind: "oauth",
          authorization_host: "accounts.notion.com",
          registration_required: false,
          code_challenge_methods: ["S256"],
          detail: null,
          resource_status: 401,
        }),
      })
      vi.stubGlobal("fetch", mockFetch)

      const res = await probeMcpAuth("https://mcp.notion.com/mcp")
      expect(res.kind).toBe("oauth")
      expect(res.authorization_host).toBe("accounts.notion.com")
      expect(res.registration_required).toBe(false)
      expect(res.code_challenge_methods).toEqual(["S256"])
    })

    it("returns probe result for kind: 'token' with verbatim detail", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          kind: "token",
          authorization_host: null,
          registration_required: false,
          code_challenge_methods: [],
          detail: "This server did not advertise an authorization server. Enter a Personal Access Token or API key.",
          resource_status: 401,
        }),
      })
      vi.stubGlobal("fetch", mockFetch)

      const res = await probeMcpAuth("https://api.github.com/mcp")
      expect(res.kind).toBe("token")
      expect(res.detail).toContain("This server did not advertise")
    })

    it("returns probe result for kind: 'unreachable'", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          kind: "unreachable",
          authorization_host: null,
          registration_required: false,
          code_challenge_methods: [],
          detail: "Server connection failed: host unreachable",
          resource_status: 504,
        }),
      })
      vi.stubGlobal("fetch", mockFetch)

      const res = await probeMcpAuth("https://offline.example.com/mcp")
      expect(res.kind).toBe("unreachable")
      expect(res.detail).toContain("host unreachable")
    })

    it("extracts structured reason_code on 422 security policy refusal", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          detail: {
            reason_code: "address_not_public",
            message: "Connection refused by security policy: address_not_public",
          },
        }),
      })
      vi.stubGlobal("fetch", mockFetch)

      await expect(probeMcpAuth("http://192.168.1.1/mcp")).rejects.toSatisfy(
        (err: unknown) => {
          expect(err).toBeInstanceOf(ConnectorApiError)
          const apiErr = err as ConnectorApiError
          expect(apiErr.status).toBe(422)
          expect(apiErr.reasonCode).toBe("address_not_public")
          expect(apiErr.message).toContain("address_not_public")
          return true
        },
      )
    })

    it("handles 502 response too large error with human message", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({
          detail: "Authorization server metadata exceeded maximum allowed size",
        }),
      })
      vi.stubGlobal("fetch", mockFetch)

      await expect(probeMcpAuth("https://huge.example.com/mcp")).rejects.toSatisfy(
        (err: unknown) => {
          expect(err).toBeInstanceOf(ConnectorApiError)
          const apiErr = err as ConnectorApiError
          expect(apiErr.status).toBe(502)
          expect(apiErr.message).toContain("metadata exceeded maximum allowed size")
          return true
        },
      )
    })
  })

  describe("createMcpOAuthAuthorizeUrl", () => {
    it("returns authorize_url and authorization_host on success", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          authorize_url: "https://accounts.notion.com/oauth/authorize?response_type=code&client_id=dcr-123&state=handle-abc",
          authorization_host: "accounts.notion.com",
        }),
      })
      vi.stubGlobal("fetch", mockFetch)

      const res = await createMcpOAuthAuthorizeUrl("conn-notion-1")
      expect(res.authorize_url).toContain("https://accounts.notion.com/oauth/authorize")
      expect(res.authorization_host).toBe("accounts.notion.com")
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/connectors/mcp/oauth/authorize"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ connection_id: "conn-notion-1" }),
        }),
      )
    })

    it("throws ConnectorApiError on failure", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          detail: "Connection not found",
        }),
      })
      vi.stubGlobal("fetch", mockFetch)

      await expect(createMcpOAuthAuthorizeUrl("conn-missing")).rejects.toThrow(
        ConnectorApiError,
      )
    })
  })
})
