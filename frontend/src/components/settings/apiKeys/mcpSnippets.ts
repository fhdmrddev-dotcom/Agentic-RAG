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
 *   · Claude.ai and Claude Desktop      Phase 307 (D-29, D-52): a custom connector with the ADDRESS
 *     only, then sign-in — no key, no header, no env var. The 304 local bridge this tab carried
 *     "until sign-in ships" is retired with its version pin (D-45), because sign-in shipped.
 *
 * The Claude Code terminal form is `claude mcp add-json` in SINGLE quotes with `--scope project`:
 * single quotes so the shell never expands the variable into the stored config, project scope so
 * it lands in `.mcp.json`, where the docs state `${VAR}` expansion applies (research A1).
 * Claude Code can also skip the key and sign in (307 D-52): `claudeCodeSignInCommand` below.
 */

export const SYREL_MCP_ENV = "SYREL_MCP_KEY"

/** The server's name in every client config. */
export const MCP_SERVER_NAME = "syrel"

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

/** A safe address or a throw: the sign-in blocks are built from the URL alone, so they refuse
 *  anything `safeMcpUrl` would not show (the screen never reaches here with one). */
function requireSafeUrl(mcpUrl: string): string {
  const url = safeMcpUrl(mcpUrl)
  if (url === null) throw new Error("mcpSnippets: expected a plain http(s) MCP address")
  return url
}

/**
 * Phase 307 (D-29): the Claude.ai and Desktop block — the connector's address and nothing else. The
 * builder keeps the shared `(mcpUrl, envVarName)` shape (and still refuses a value that is not a
 * variable name), but no variable, header or key appears in what it returns.
 */
export function desktopConnectorAddress(mcpUrl: string, envVarName: string): string {
  envName(envVarName)
  return requireSafeUrl(mcpUrl)
}

const SHELL_SAFE = /^[A-Za-z0-9:/._~%+@=,-]+$/

/** Phase 307 (D-52): Claude Code's sign-in form — the address with no header, then `/mcp`. */
export function claudeCodeSignInCommand(mcpUrl: string): string {
  const url = requireSafeUrl(mcpUrl)
  return `claude mcp add --transport http ${MCP_SERVER_NAME} ${SHELL_SAFE.test(url) ? url : shellSingleQuoted(url)}`
}

/** The builder per client tab, in tab order. */
export const MCP_SNIPPET_BUILDERS: Record<McpClient, (mcpUrl: string, envVarName: string) => string> = {
  claudeCode: claudeCodeSnippet,
  cursor: cursorSnippet,
  vscode: vscodeSnippet,
  desktop: desktopConnectorAddress,
}
