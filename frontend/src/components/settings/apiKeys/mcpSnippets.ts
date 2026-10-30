/**
 * Phase 304-05 (D-27, D-28, D-45; T-304-38) — the copy-ready MCP setup text per client. PURE, the
 * `curlExamples.ts` pattern.
 *
 * Every builder is `(mcpUrl, envVarName) => string` and NOTHING ELSE: there is no parameter a key
 * could travel in, so a snippet can never inline one, and the URL is the server's `list.mcp.url`
 * (D-28), used only as the server address. Each snippet reads the key from the environment
 * variable through that client's OWN syntax and sends it in a header, never in the URL. Syntax read
 * from each client's docs on 2026-10-30 (304-RESEARCH §"Client snippets (D-27)"):
 *   · Claude Code  `.mcp.json`          `mcpServers` · `"type": "http"` · `${VAR}`
 *   · Cursor       `.cursor/mcp.json`   `mcpServers` · `${env:VAR}`
 *   · VS Code      `.vscode/mcp.json`   top-level `servers` · `"type": "http"` · `${env:VAR}`
 *   · Claude Desktop                    the `mcp-remote` bridge; its config does not read the host
 *     environment, so the key goes in that local file in place of a placeholder (labelled).
 *
 * The Claude Code terminal form is `claude mcp add-json` in SINGLE quotes with `--scope project`:
 * single quotes so the shell never expands the variable into the stored config, project scope so
 * it lands in `.mcp.json`, where the docs state `${VAR}` expansion applies (research A1).
 *
 * D-45 (supply chain): `mcp-remote` is pinned to a version only after its npm ownership was
 * verified at execution (304-05 SUMMARY records the evidence). `MCP_REMOTE_VERSION = null` emits
 * the unpinned package and the Desktop tab says the version is unverified.
 */

export const SYREL_MCP_ENV = "SYREL_MCP_KEY"

/** The server's name in every client config. */
export const MCP_SERVER_NAME = "syrel"

/** D-45: verified 2026-10-31 — npm `mcp-remote` latest 0.15.2; repository `punkpeye/mcp-remote` is
 *  the same GitHub repository as `geelen/mcp-remote` (id 951601187, a transfer, not a fork); the
 *  npm maintainer is the repository's committer; the tag v0.15.2 exists there. */
export const MCP_REMOTE_VERSION: string | null = "0.15.2"

export type McpClient = "claudeCode" | "cursor" | "vscode" | "desktop"
export const MCP_CLIENTS: readonly McpClient[] = ["claudeCode", "cursor", "vscode", "desktop"]

const ENV_NAME = /^[A-Z_][A-Z0-9_]*$/

/** An env var NAME is upper-case letters, digits and `_`. Anything else (a pasted key is mixed
 *  case) is refused, so no caller can smuggle a value through the name. */
function envName(envVarName: string): string {
  if (!ENV_NAME.test(envVarName)) throw new Error("mcpSnippets: expected an environment variable name")
  return envVarName
}

/** The server's MCP URL when it is a plain http(s) address with no query or fragment, else null
 *  (the screen then shows the no-address line instead of a snippet). */
export function safeMcpUrl(url: string | null | undefined): string | null {
  const raw = (url ?? "").trim()
  if (!raw) return null
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return null
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null
  if (parsed.search || parsed.hash || raw.includes("?") || raw.includes("#")) return null
  return raw
}

const json = (value: unknown) => JSON.stringify(value, null, 2)

function bearerHeader(envRef: string) {
  return { Authorization: `Bearer ${envRef}` }
}

export function claudeCodeSnippet(mcpUrl: string, envVarName: string): string {
  const env = envName(envVarName)
  return json({ mcpServers: { [MCP_SERVER_NAME]: { type: "http", url: mcpUrl, headers: bearerHeader(`\${${env}}`) } } })
}

/** Text inside a single-quoted shell word: a `'` closes, escapes and reopens the quote. */
function shellSingleQuoted(text: string): string {
  return `'${text.replace(/'/g, `'\\''`)}'`
}

export function claudeCodeCliSnippet(mcpUrl: string, envVarName: string): string {
  const env = envName(envVarName)
  const server = JSON.stringify({ type: "http", url: mcpUrl, headers: bearerHeader(`\${${env}}`) })
  return `claude mcp add-json ${MCP_SERVER_NAME} ${shellSingleQuoted(server)} --scope project`
}

export function cursorSnippet(mcpUrl: string, envVarName: string): string {
  const env = envName(envVarName)
  return json({ mcpServers: { [MCP_SERVER_NAME]: { url: mcpUrl, headers: bearerHeader(`\${env:${env}}`) } } })
}

export function vscodeSnippet(mcpUrl: string, envVarName: string): string {
  const env = envName(envVarName)
  return json({ servers: { [MCP_SERVER_NAME]: { type: "http", url: mcpUrl, headers: bearerHeader(`\${env:${env}}`) } } })
}

/** `mcp-remote@{version}` when D-45 verification passed, the bare name otherwise. */
export function mcpRemotePackage(version: string | null): string {
  return version ? `mcp-remote@${version}` : "mcp-remote"
}

/** The README's Windows-safe form: no space inside an argument, the header value from `env`. */
export function desktopBridgeSnippet(mcpUrl: string, envVarName: string): string {
  const env = envName(envVarName)
  return json({
    mcpServers: {
      [MCP_SERVER_NAME]: {
        command: "npx",
        args: ["-y", mcpRemotePackage(MCP_REMOTE_VERSION), mcpUrl, "--header", "Authorization:${AUTH_HEADER}"],
        env: { AUTH_HEADER: `Bearer <your ${env} value>` },
      },
    },
  })
}

/** The builder per client tab, in tab order. */
export const MCP_SNIPPET_BUILDERS: Record<McpClient, (mcpUrl: string, envVarName: string) => string> = {
  claudeCode: claudeCodeSnippet,
  cursor: cursorSnippet,
  vscode: vscodeSnippet,
  desktop: desktopBridgeSnippet,
}
