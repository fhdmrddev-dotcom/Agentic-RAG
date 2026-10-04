// Phase 276-05 (G4-2, T-276-21) — the landing's FIRST PAINT pulls no Remotion, no Scalar, no
// MiniSearch, no video composition and no docs code. The hero promo is allowed only behind
// import() (HeroSection → import("./HeroPromo")), so this crawl follows STATIC edges only.
//
// The crawler is COPIED from landingBundleFence.test.ts (deliberately not shared) with two changes:
// it skips import() edges, and it also follows @video/ and ../video/ specifiers into video/src so
// a composition pulled in statically would be visited and named. Its build-output twin is
// scripts/check-landing-first-paint.cjs (the Vite manifest walk, imports only).
import { describe, expect, it, vi } from "vitest"

const nodeFs = await vi.importActual<{
  readFileSync(path: string, encoding: string): string
  existsSync(path: string): boolean
  statSync(path: string): { isFile(): boolean }
}>("node:fs")

const nodePath = await vi.importActual<{
  resolve(...paths: string[]): string
  dirname(path: string): string
}>("node:path")

const SRC_DIR = (() => {
  const here = decodeURIComponent(import.meta.url).replace(/^file:\/\/\/?/, "")
  const marker = "/src/landing/__tests__/"
  const at = here.indexOf(marker)
  if (at === -1) throw new Error(`cannot locate src dir in: ${here}`)
  return `${here.slice(0, at)}/src`
})()
const VIDEO_SRC = nodePath.resolve(SRC_DIR, "..", "..", "video", "src")

/** Package specifiers that must never be in the landing's static graph. */
const FORBIDDEN_PACKAGE_PREFIXES = ["remotion", "@remotion/", "@scalar/", "minisearch", "mediabunny", "@video/"]
/** Resolved paths that must never be in the landing's static graph. */
const FORBIDDEN_PATHS = ["/src/docs/", "/video/src/"]

function resolveModulePath(currentFile: string, spec: string): string | null {
  let base: string
  if (spec.startsWith("@/")) base = nodePath.resolve(SRC_DIR, spec.slice(2))
  else if (spec.startsWith("@video/")) base = nodePath.resolve(VIDEO_SRC, spec.slice("@video/".length))
  else if (spec.startsWith(".")) base = nodePath.resolve(nodePath.dirname(currentFile), spec)
  else return null
  if (nodeFs.existsSync(base) && nodeFs.statSync(base).isFile()) return base
  for (const ext of [".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts", "/index.jsx", "/index.js"]) {
    const candidate = base + ext
    if (nodeFs.existsSync(candidate) && nodeFs.statSync(candidate).isFile()) return candidate
  }
  return null
}

const STATIC_IMPORT = /(?:^|[\s;])(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
}

function crawlStatic(entryFile: string): { visited: string[]; edges: { from: string; spec: string }[] } {
  const visited = new Set<string>()
  const edges: { from: string; spec: string }[] = []
  const queue = [entryFile]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    if (!nodeFs.existsSync(current)) continue
    // import() is not matched by STATIC_IMPORT ("import(" has no whitespace before the quote),
    // so dynamic edges are skipped by construction.
    const content = stripComments(nodeFs.readFileSync(current, "utf-8"))
    for (const m of content.matchAll(STATIC_IMPORT)) {
      edges.push({ from: current, spec: m[1] })
      const resolved = resolveModulePath(current, m[1])
      if (resolved && !visited.has(resolved)) queue.push(resolved)
    }
  }
  return { visited: [...visited].map((f) => f.replace(/\\/g, "/")), edges }
}

const LANDING_ENTRY = `${SRC_DIR}/landing/main.tsx`

describe("Landing first-paint fence (G4-2)", () => {
  it("the static graph from src/landing/main.tsx reaches no Remotion, Scalar, MiniSearch, video or docs code", () => {
    expect(nodeFs.existsSync(LANDING_ENTRY)).toBe(true)
    const { visited, edges } = crawlStatic(LANDING_ENTRY)
    // non-vacuity: the crawl really walked the landing (sections, scenes, facts)
    expect(visited.length).toBeGreaterThanOrEqual(15)
    expect(visited.some((f) => f.endsWith("/src/landing/components/HeroSection.tsx"))).toBe(true)
    expect(visited.some((f) => f.endsWith("/src/landing/facts.ts"))).toBe(true)

    for (const { from, spec } of edges) {
      for (const p of FORBIDDEN_PACKAGE_PREFIXES) {
        expect(spec === p.replace(/\/$/, "") || spec.startsWith(p), `${from} STATICALLY imports ${spec}`).toBe(false)
      }
      expect(/(^|\/)video\/src\//.test(spec), `${from} STATICALLY imports ${spec}`).toBe(false)
    }
    for (const f of visited) {
      for (const bad of FORBIDDEN_PATHS) {
        expect(f.includes(bad), `landing first paint reaches ${f}`).toBe(false)
      }
    }
  })

  it("the promo is reachable, but only behind import() (positive control)", () => {
    const hero = nodeFs.readFileSync(`${SRC_DIR}/landing/components/HeroSection.tsx`, "utf-8")
    expect(hero).toMatch(/import\(\s*["']\.\/HeroPromo["']\s*\)/)
    const promoPath = `${SRC_DIR}/landing/components/HeroPromo.tsx`
    expect(nodeFs.existsSync(promoPath)).toBe(true)
    // HeroPromo itself is allowed its heavy static imports — and the crawl must SEE them when it
    // starts there, or the fence above could pass for a crawler that never looks.
    const { edges } = crawlStatic(promoPath)
    expect(edges.some((e) => e.spec === "@remotion/player")).toBe(true)
    expect(edges.some((e) => e.spec.startsWith("@video/"))).toBe(true)
    const { visited } = crawlStatic(LANDING_ENTRY)
    expect(visited.some((f) => f.endsWith("/src/landing/components/HeroPromo.tsx"))).toBe(false)
  })
})
