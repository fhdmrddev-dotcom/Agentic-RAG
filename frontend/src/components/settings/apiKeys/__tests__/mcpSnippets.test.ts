/**
 * Phase 304-05 (D-27, D-28, D-45; T-304-38) — the per-client MCP setup snippets.
 * Phase 307-04 (D-29, D-52): the Claude.ai and Desktop tab is the connector ADDRESS only (sign-in,
 * no key, no bridge); the mcp-remote bridge and its version pin are retired; Claude Code gains the
 * sign-in command `claude mcp add --transport http syrel <url>`.
 *
 * The ROADMAP failure this prices: "a snippet puts the key in a URL". Every builder takes the
 * server's MCP URL and an environment-variable NAME, never a secret, so a key cannot be inlined;
 * each snippet reads the key through that client's own env syntax (304-RESEARCH §Client snippets,
 * read from each client's docs) and sends it in a header.
 */
import { describe, expect, it } from "vitest"
import snippetsRaw from "../mcpSnippets.ts?raw"
import * as snippetsModule from "../mcpSnippets"
import {
  MCP_SNIPPET_BUILDERS,
  SYREL_MCP_ENV,
  claudeCodeCliSnippet,
  claudeCodeSignInCommand,
  claudeCodeSnippet,
  cursorSnippet,
  desktopConnectorAddress,
  safeMcpUrl,
  vscodeSnippet,
} from "../mcpSnippets"

const URL = "https://syrel.example.com/mcp"
const JSON_BUILDERS = { claudeCodeSnippet, cursorSnippet, vscodeSnippet }
const ALL_BUILDERS = { ...JSON_BUILDERS, claudeCodeCliSnippet, desktopConnectorAddress }

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
})

describe("307-04 Claude.ai and Desktop — the connector address, by sign-in (D-29, D-52)", () => {
  it("the desktop builder is the address only: no header, no env var, no key, no bridge", () => {
    expect(MCP_SNIPPET_BUILDERS.desktop).toBe(desktopConnectorAddress)
    expect(desktopConnectorAddress(URL, SYREL_MCP_ENV)).toBe(URL)
    const text = desktopConnectorAddress(URL, SYREL_MCP_ENV)
    expect(text).not.toContain(SYREL_MCP_ENV)
    expect(text).not.toMatch(/Bearer|Authorization|npx|mcp-remote/)
  })

  it("the desktop builder refuses an unsafe address through safeMcpUrl", () => {
    expect(() => desktopConnectorAddress("https://x/mcp?key=abc", SYREL_MCP_ENV)).toThrow()
    expect(() => desktopConnectorAddress("javascript:alert(1)", SYREL_MCP_ENV)).toThrow()
  })

  it("the bridge is retired: no mcp-remote, no version pin, no bridge builder (no dead exports)", () => {
    const exported = Object.keys(snippetsModule)
    for (const gone of ["MCP_REMOTE_VERSION", "mcpRemotePackage", "desktopBridgeSnippet"]) {
      expect(exported, gone).not.toContain(gone)
    }
    expect(snippetsRaw).not.toMatch(/mcp-remote|npx/)
  })
})

describe("307-04 Claude Code — sign in instead of a key (D-29, D-52)", () => {
  it("is `claude mcp add --transport http syrel <url>`: no header, no env reference, no key", () => {
    const cmd = claudeCodeSignInCommand(URL)
    expect(cmd).toBe(`claude mcp add --transport http syrel ${URL}`)
    expect(cmd).not.toMatch(/--header|Authorization|Bearer|\$\{|SYREL_MCP_KEY|srl_/)
    expect(claudeCodeSignInCommand.length).toBe(1)
  })

  it("quotes an address that carries a shell character", () => {
    expect(claudeCodeSignInCommand("https://x.example/a;b/mcp")).toBe("claude mcp add --transport http syrel 'https://x.example/a;b/mcp'")
  })

  it("refuses an unsafe address through safeMcpUrl", () => {
    expect(() => claudeCodeSignInCommand("https://x/mcp?key=abc")).toThrow()
    expect(() => claudeCodeSignInCommand("")).toThrow()
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
