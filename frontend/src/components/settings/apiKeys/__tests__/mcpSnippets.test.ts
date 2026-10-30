/**
 * Phase 304-05 (D-27, D-28, D-45; T-304-38) — the per-client MCP setup snippets.
 *
 * The ROADMAP failure this prices: "a snippet puts the key in a URL". Every builder takes the
 * server's MCP URL and an environment-variable NAME, never a secret, so a key cannot be inlined;
 * each snippet reads the key through that client's own env syntax (304-RESEARCH §Client snippets,
 * read from each client's docs) and sends it in a header.
 */
import { describe, expect, it } from "vitest"
import snippetsRaw from "../mcpSnippets.ts?raw"
import {
  MCP_REMOTE_VERSION,
  SYREL_MCP_ENV,
  claudeCodeCliSnippet,
  claudeCodeSnippet,
  cursorSnippet,
  desktopBridgeSnippet,
  mcpRemotePackage,
  safeMcpUrl,
  vscodeSnippet,
} from "../mcpSnippets"

const URL = "https://syrel.example.com/mcp"
const JSON_BUILDERS = { claudeCodeSnippet, cursorSnippet, vscodeSnippet, desktopBridgeSnippet }
const ALL_BUILDERS = { ...JSON_BUILDERS, claudeCodeCliSnippet }

describe("304-05 mcpSnippets — no secret can travel", () => {
  it("the env var is SYREL_MCP_KEY", () => {
    expect(SYREL_MCP_ENV).toBe("SYREL_MCP_KEY")
  })

  it.each(Object.entries(ALL_BUILDERS))("%s takes (mcpUrl, envVarName) only", (_name, build) => {
    expect(build.length).toBe(2)
  })

  it.each(Object.entries(ALL_BUILDERS))("%s carries no key, no query string, and the URL only as itself", (_name, build) => {
    const text = build(URL, SYREL_MCP_ENV)
    expect(text).not.toContain("srl_")
    expect(text).not.toMatch(/\?[a-z_]+=/i)
    expect(text).toContain(URL)
    expect(text).not.toContain(`${URL}?`)
    expect(text).not.toContain(`${URL}/`)
  })

  it.each(Object.entries(ALL_BUILDERS))("%s refuses a value that is not an env var name (a pasted secret)", (_name, build) => {
    expect(() => build(URL, "srl_mcp_abc123SECRET")).toThrow()
    expect(() => build(URL, "")).toThrow()
  })

  it("the module has no secret parameter anywhere", () => {
    const code = snippetsRaw
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join("\n")
    expect(code).not.toMatch(/secret/i)
  })
})

describe("304-05 mcpSnippets — each client's own syntax (D-27)", () => {
  it.each(Object.entries(JSON_BUILDERS))("%s parses as JSON", (_name, build) => {
    expect(() => JSON.parse(build(URL, SYREL_MCP_ENV))).not.toThrow()
  })

  it("Claude Code: .mcp.json mcpServers, type http, Bearer ${SYREL_MCP_KEY} in a header", () => {
    const cfg = JSON.parse(claudeCodeSnippet(URL, SYREL_MCP_ENV))
    expect(cfg).toEqual({
      mcpServers: { syrel: { type: "http", url: URL, headers: { Authorization: "Bearer ${SYREL_MCP_KEY}" } } },
    })
  })

  it("Claude Code CLI: add-json in single quotes, project scope, so the shell never expands the variable", () => {
    const cli = claudeCodeCliSnippet(URL, SYREL_MCP_ENV)
    expect(cli.startsWith("claude mcp add-json ")).toBe(true)
    expect(cli).toContain("--scope project")
    const json = cli.match(/'(\{.*\})'/)?.[1]
    expect(json).toBeDefined()
    expect(JSON.parse(json!)).toEqual({ type: "http", url: URL, headers: { Authorization: "Bearer ${SYREL_MCP_KEY}" } })
    expect(cli).not.toContain('"$SYREL_MCP_KEY')
  })

  it("Cursor: mcpServers with ${env:SYREL_MCP_KEY}", () => {
    expect(JSON.parse(cursorSnippet(URL, SYREL_MCP_ENV))).toEqual({
      mcpServers: { syrel: { url: URL, headers: { Authorization: "Bearer ${env:SYREL_MCP_KEY}" } } },
    })
  })

  it("VS Code: top-level servers, type http, ${env:SYREL_MCP_KEY}", () => {
    const cfg = JSON.parse(vscodeSnippet(URL, SYREL_MCP_ENV))
    expect(cfg.mcpServers).toBeUndefined()
    expect(cfg).toEqual({
      servers: { syrel: { type: "http", url: URL, headers: { Authorization: "Bearer ${env:SYREL_MCP_KEY}" } } },
    })
  })

  it("Claude Desktop: the mcp-remote bridge, header from AUTH_HEADER (no space in the arg), a placeholder for the key", () => {
    const cfg = JSON.parse(desktopBridgeSnippet(URL, SYREL_MCP_ENV))
    const server = cfg.mcpServers.syrel
    expect(server.command).toBe("npx")
    expect(server.args).toEqual(["-y", mcpRemotePackage(MCP_REMOTE_VERSION), URL, "--header", "Authorization:${AUTH_HEADER}"])
    expect(server.args.every((a: string) => !a.includes(" "))).toBe(true)
    expect(server.env.AUTH_HEADER).toMatch(/^Bearer <.*SYREL_MCP_KEY.*>$/)
  })
})

describe("304-05 mcpSnippets — D-45 the bridge version", () => {
  it("a verified version is pinned; an unverified one is not", () => {
    expect(mcpRemotePackage("0.15.2")).toBe("mcp-remote@0.15.2")
    expect(mcpRemotePackage(null)).toBe("mcp-remote")
  })

  it("the verified version is the one recorded at execution (npm + repository, 2026-10-31)", () => {
    expect(MCP_REMOTE_VERSION).toBe("0.15.2")
  })
})

describe("304-05 safeMcpUrl — a URL that could carry anything else is not shown", () => {
  it("passes an https or http URL with no query or fragment", () => {
    expect(safeMcpUrl(URL)).toBe(URL)
    expect(safeMcpUrl("http://localhost:8000/mcp")).toBe("http://localhost:8000/mcp")
  })

  it.each([null, "", "   ", "ftp://x/mcp", "https://x/mcp?key=abc", "https://x/mcp#k", "javascript:alert(1)", "not a url"])(
    "%s → null",
    (u) => {
      expect(safeMcpUrl(u)).toBeNull()
    },
  )
})
