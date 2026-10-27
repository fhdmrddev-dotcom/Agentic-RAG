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
export type VercelConfig = { redirects?: VercelRule[]; rewrites?: VercelRule[]; cleanUrls?: boolean }

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

function hostMatches(rule: VercelRule, host: string): boolean {
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
 * The document nginx serves for a path, from the conf TEXT.
 *
 * Precedence (nginx docs): an exact `location = /x` match wins; otherwise the longest matching
 * prefix. ⛔ This file has no regex locations, and the evaluator does not model them — so a regex
 * (`~` / `~*`) location THROWS rather than being ignored, and a future one reds the parity suite
 * instead of being silently mis-evaluated. Blocks with no `try_files` (the `/api/` proxy) are
 * skipped. `try_files` is evaluated against FILESYSTEM: route paths are never files, so for every
 * app address the answer is the last argument (the fallback).
 */
export function resolveNginx(confText: string, pathname: string): string {
  const path = pathname.split("?")[0]
  const text = confText.replace(/#[^\n]*/g, "")
  const exact: { loc: string; args: string[] }[] = []
  const prefix: { loc: string; args: string[] }[] = []
  const locationRe = /location\s+(?:(=|\^~|~\*|~)\s*)?(\S+)\s*\{([^}]*)\}/g
  for (const m of text.matchAll(locationRe)) {
    const [, modifier, loc, body] = m
    if (modifier === "~" || modifier === "~*") throw new Error(`nginx evaluator: regex location "${modifier} ${loc}" is not modelled`)
    const tryFiles = /try_files\s+([^;]+);/.exec(body)
    if (!tryFiles) continue
    const entry = { loc, args: tryFiles[1].trim().split(/\s+/) }
    if (modifier === "=") exact.push(entry)
    else prefix.push(entry)
  }
  const hit =
    exact.find((e) => e.loc === path) ??
    prefix.filter((e) => path.startsWith(e.loc)).sort((a, b) => b.loc.length - a.loc.length)[0]
  if (!hit) return "=404"
  const candidates = hit.args.slice(0, -1).map((a) => a.split("$uri").join(path))
  return candidates.find((c) => FILESYSTEM.has(c)) ?? hit.args[hit.args.length - 1]
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
