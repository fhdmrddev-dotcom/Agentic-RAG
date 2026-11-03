// Phase 297-04 (LINK-08 / D-26, D-41) — the routing-layer evaluators, shared by the parity suite
// (appRouteParity.test.ts) and the docs routing suite (src/docs/__tests__/docsVercelRouting.test.ts).
//
// ⛔ PURE AND TYPED, NO node:fs. Callers read the config files with `?raw` (typed by vite/client)
// and pass the TEXT in, so nothing here adds node types to the app typecheck (Pitfall 11).
// It lives under __tests__, so it is never a product file and carries no ledger obligation.
//
// ⭐ D-41: `resolveVercel` IS the evaluator docsVercelRouting.test.ts carried since Phase 276-02 —
// `sourceRegex`, `hostMatches`, `resolve` and the FILESYSTEM set moved here verbatim, with the
// parsed config now a parameter. One evaluator, not a copy.

type HostHas = { type: string; value: string }
export type VercelRule = { source: string; destination: string; has?: HostHas[]; permanent?: boolean }
// Phase 307-04 (P-5): Vercel `headers` entries — the consent route's anti-framing headers.
export type VercelHeaderRule = { source: string; has?: HostHas[]; headers: { key: string; value: string }[] }
export type VercelConfig = {
  redirects?: VercelRule[]
  rewrites?: VercelRule[]
  headers?: VercelHeaderRule[]
  cleanUrls?: boolean
}

// The static output a `vite build` produces (the three entries + emitted docs assets).
export const FILESYSTEM = new Set([
  "/index.html",
  "/app.html",
  "/docs.html",
  "/docs-assets/search-index.json",
  "/docs-assets/openapi.public.json",
  "/vo/clip-chat.wav",
  "/assets/index-abc.js",
])

// Vercel sources here use only literal segments and `(.*)` groups.
export function sourceRegex(source: string): RegExp {
  return new RegExp("^" + source + "$")
}

function hostMatches(rule: { has?: HostHas[] }, host: string): boolean {
  if (!rule.has) return true
  return rule.has.every((h) => h.type !== "host" || new RegExp("^(?:" + h.value + ")$").test(host))
}

export type VercelOutcome =
  | { kind: "redirect"; to: string }
  | { kind: "file"; path: string }
  | { kind: "rewrite"; to: string }
  | { kind: "404" }

/** Vercel's documented precedence: redirects → filesystem → rewrites (in array order). */
export function resolveVercel(config: VercelConfig, host: string, pathname: string): VercelOutcome {
  for (const r of config.redirects ?? []) {
    if (sourceRegex(r.source).test(pathname) && hostMatches(r, host)) return { kind: "redirect", to: r.destination }
  }
  const filePath = pathname === "/" ? "/index.html" : pathname
  if (FILESYSTEM.has(filePath)) return { kind: "file", path: filePath }
  for (const r of config.rewrites ?? []) {
    if (sourceRegex(r.source).test(pathname) && hostMatches(r, host)) return { kind: "rewrite", to: r.destination }
  }
  return { kind: "404" }
}

/**
 * Phase 307-04 (P-5): the response headers Vercel attaches to a path — every `headers` entry whose
 * source (same pattern logic as rewrites) and host `has` rule match, merged in array order (a later
 * entry's key wins, as on Vercel). Kept apart from `resolveVercel` so its outcome shape — which the
 * 297 parity rows and the 276 docs rows compare with `toEqual` — is unchanged.
 */
export function vercelHeadersFor(config: VercelConfig, host: string, pathname: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const r of config.headers ?? []) {
    if (!sourceRegex(r.source).test(pathname) || !hostMatches(r, host)) continue
    for (const h of r.headers) out[h.key] = h.value
  }
  return out
}

/**
 * Where the first matching redirect actually sends the browser: `$N` from the source's groups and
 * `:name` from the host `has` rule's named groups substituted, the way Vercel substitutes them.
 * `null` when no redirect matches.
 */
export function followVercelRedirect(config: VercelConfig, host: string, pathname: string): { host: string; pathname: string } | null {
  for (const r of config.redirects ?? []) {
    const match = sourceRegex(r.source).exec(pathname)
    if (!match || !hostMatches(r, host)) continue
    let destination = r.destination.replace(/\$(\d+)/g, (_, n: string) => match[Number(n)] ?? "")
    for (const h of r.has ?? []) {
      if (h.type !== "host") continue
      const groups = new RegExp("^(?:" + h.value + ")$").exec(host)?.groups ?? {}
      for (const [name, value] of Object.entries(groups)) destination = destination.split(":" + name).join(value ?? "")
    }
    const url = new URL(destination)
    return { host: url.host, pathname: url.pathname }
  }
  return null
}

/**
 * Phase 307-04 (P-5) — what nginx DOES for a path, from the conf TEXT:
 * - `try_files`: the document served (`target`) and the response headers it carries;
 * - `proxy`: `proxy_pass` to `target`, with `rewrite` lines recorded so a test can pin "no rewrite";
 * - `return`: `return <code>` (and `=404` when no location matches at all).
 *
 * Precedence (nginx docs): an exact `location = /x` match wins; otherwise the longest matching
 * prefix (`^~` only additionally stops the regex search, and there are no regex locations).
 * ⛔ This file has no regex locations, and the evaluator does not model them — so a regex
 * (`~` / `~*`) location THROWS rather than being ignored, and a future one reds the parity suite
 * instead of being silently mis-evaluated.
 *
 * `try_files` is evaluated against FILESYSTEM. ⚠ F-10 is MODELLED, not assumed: when no candidate
 * is a file and the last argument is a URI, nginx makes an INTERNAL REDIRECT to it and re-matches
 * locations — so the original location's `add_header` lines are LOST. Only a document served in the
 * matched location itself (e.g. `try_files /app.html =404`) keeps that location's headers.
 */
export type NginxOutcome =
  | { kind: "try_files"; target: string; headers: Record<string, string>; location: string }
  | { kind: "proxy"; target: string; rewrites: string[]; headers: Record<string, string>; location: string }
  | { kind: "return"; target: string; headers: Record<string, string>; location: string | null }

type NginxLocation = {
  modifier: string | undefined
  loc: string
  tryFiles: string[] | null
  proxyPass: string | null
  returnCode: string | null
  rewrites: string[]
  headers: Record<string, string>
}

function parseNginxLocations(confText: string): NginxLocation[] {
  // Strip comments, but not a `#` inside a quoted add_header value (none today — kept simple).
  const text = confText.replace(/#[^\n]*/g, "")
  const out: NginxLocation[] = []
  const locationRe = /location\s+(?:(=|\^~|~\*|~)\s*)?(\S+)\s*\{([^}]*)\}/g
  for (const m of text.matchAll(locationRe)) {
    const [, modifier, loc, body] = m
    if (modifier === "~" || modifier === "~*") throw new Error(`nginx evaluator: regex location "${modifier} ${loc}" is not modelled`)
    const headers: Record<string, string> = {}
    for (const h of body.matchAll(/add_header\s+(\S+)\s+(?:"([^"]*)"|'([^']*)'|([^\s;]+))(?:\s+always)?\s*;/g)) {
      headers[h[1]] = h[2] ?? h[3] ?? h[4] ?? ""
    }
    out.push({
      modifier,
      loc,
      tryFiles: /try_files\s+([^;]+);/.exec(body)?.[1].trim().split(/\s+/) ?? null,
      proxyPass: /proxy_pass\s+([^;]+);/.exec(body)?.[1].trim() ?? null,
      returnCode: /(?:^|\s)return\s+([^;]+);/.exec(body)?.[1].trim() ?? null,
      rewrites: [...body.matchAll(/rewrite\s+([^;]+);/g)].map((r) => r[1].trim()),
      headers,
    })
  }
  return out
}

export function resolveNginxLocation(confText: string, pathname: string, depth = 0): NginxOutcome {
  if (depth > 5) throw new Error("nginx evaluator: internal redirect loop")
  const path = pathname.split("?")[0]
  // A block that does nothing the evaluator models (no try_files / proxy_pass / return) is skipped.
  const locations = parseNginxLocations(confText).filter((l) => l.tryFiles || l.proxyPass || l.returnCode)
  const hit =
    locations.find((l) => l.modifier === "=" && l.loc === path) ??
    locations
      .filter((l) => l.modifier !== "=" && path.startsWith(l.loc))
      .sort((a, b) => b.loc.length - a.loc.length)[0]
  if (!hit) return { kind: "return", target: "404", headers: {}, location: null }
  if (hit.returnCode) return { kind: "return", target: hit.returnCode, headers: hit.headers, location: hit.loc }
  if (hit.proxyPass) {
    return { kind: "proxy", target: hit.proxyPass, rewrites: hit.rewrites, headers: hit.headers, location: hit.loc }
  }
  const args = hit.tryFiles as string[]
  const candidates = args.slice(0, -1).map((a) => a.split("$uri").join(path))
  const served = candidates.find((c) => FILESYSTEM.has(c))
  if (served) return { kind: "try_files", target: served, headers: hit.headers, location: hit.loc }
  const fallback = args[args.length - 1]
  if (fallback.startsWith("=")) return { kind: "return", target: fallback.slice(1), headers: hit.headers, location: hit.loc }
  // Internal redirect: re-matched from the top, the original location's headers are gone (F-10).
  return resolveNginxLocation(confText, fallback, depth + 1)
}

/**
 * The document nginx serves for a path, as one string — the projection the 297 parity rows use:
 * the served file for `try_files`, `=<code>` for a `return` (and for no match), `proxy:<upstream>`
 * for a proxy. Every pre-307 caller asserts on a served file, which is unchanged.
 */
export function resolveNginx(confText: string, pathname: string): string {
  const outcome = resolveNginxLocation(confText, pathname)
  if (outcome.kind === "try_files") return outcome.target
  if (outcome.kind === "proxy") return "proxy:" + outcome.target
  return "=" + outcome.target
}

/**
 * What frontend/middleware.ts does, read from its SOURCE text (comments stripped first, since its
 * docblock quotes the matcher): the `matcher` string literal (null when it is not one string),
 * and whether an `app.`-prefixed hostname is rewritten to /app.html.
 */
export function middlewareRewritesAppHost(sourceText: string): { matcher: string | null; rewritesAppHost: boolean } {
  const code = sourceText.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
  const matcher = /matcher:\s*["']([^"']*)["']/.exec(code)?.[1] ?? null
  const rewritesAppHost =
    /hostname\.startsWith\(\s*["']app\.["']\s*\)\s*\)\s*\{\s*return\s+rewrite\(\s*new\s+URL\(\s*["']\/app\.html["']/.test(code)
  return { matcher, rewritesAppHost }
}
