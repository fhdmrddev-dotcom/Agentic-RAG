// Phase 276-03 (T-276-14) — the docs entry is PUBLIC: it may never pull app code (auth, Supabase,
// providers, the app's component library), and the heavy optional packages (Scalar, Remotion, the
// video compositions) may only arrive behind a dynamic import(), never in the first-paint graph.
//
// The crawler is COPIED from src/landing/__tests__/landingBundleFence.test.ts and re-rooted at
// src/docs/main.tsx (deliberately not shared: each fence must be able to change on its own).
// Two crawls:
//   all edges (static + import())  → no forbidden app path anywhere in the docs graph
//   static edges only              → no @scalar/*, @remotion/*, @video/* specifier
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
  const marker = "/src/docs/__tests__/"
  const at = here.indexOf(marker)
  if (at === -1) throw new Error(`cannot locate src dir in: ${here}`)
  return `${here.slice(0, at)}/src`
})()

const FORBIDDEN_SUBSTRINGS = ["src/lib/", "src/components/", "src/providers", "src/hooks/useAuth", "src/stores/", "src/pages/"]
const FORBIDDEN_PACKAGES = ["@supabase/supabase-js"]
const DYNAMIC_ONLY_PREFIXES = ["@scalar/", "@remotion/", "@video/", "remotion", "mediabunny"]

function resolveModulePath(currentFile: string, importPath: string): string | null {
  if (importPath.startsWith("~icons/") || (!importPath.startsWith(".") && !importPath.startsWith("@/"))) return null
  const resolved = importPath.startsWith("@/")
    ? nodePath.resolve(SRC_DIR, importPath.slice(2))
    : nodePath.resolve(nodePath.dirname(currentFile), importPath)
  if (nodeFs.existsSync(resolved) && nodeFs.statSync(resolved).isFile()) return resolved
  for (const ext of [".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts", "/index.jsx", "/index.js"]) {
    const candidate = resolved + ext
    if (nodeFs.existsSync(candidate) && nodeFs.statSync(candidate).isFile()) return candidate
  }
  return null
}

const STATIC_IMPORT = /(?:^|[\s;])(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g
const DYNAMIC_IMPORT = /import\(\s*['"]([^'"]+)['"]\s*\)/g

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
}

interface Edge {
  from: string
  spec: string
  dynamic: boolean
}

function crawl(entryFile: string, followDynamic: boolean): { visited: Set<string>; edges: Edge[] } {
  const visited = new Set<string>()
  const edges: Edge[] = []
  const queue = [entryFile]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current)) continue
    visited.add(current)
    if (!nodeFs.existsSync(current)) continue
    const content = stripComments(nodeFs.readFileSync(current, "utf-8"))
    const found: Edge[] = []
    for (const m of content.matchAll(STATIC_IMPORT)) found.push({ from: current, spec: m[1], dynamic: false })
    for (const m of content.matchAll(DYNAMIC_IMPORT)) found.push({ from: current, spec: m[1], dynamic: true })
    for (const e of found) {
      if (e.dynamic && !followDynamic) continue
      edges.push(e)
      const resolved = resolveModulePath(current, e.spec)
      if (resolved && !visited.has(resolved)) queue.push(resolved)
    }
  }
  return { visited, edges }
}

const DOCS_ENTRY = `${SRC_DIR}/docs/main.tsx`

describe("Docs bundle fence (T-276-14)", () => {
  it("the whole docs graph (static + dynamic) never reaches app code or Supabase", () => {
    expect(nodeFs.existsSync(DOCS_ENTRY)).toBe(true)
    const { visited, edges } = crawl(DOCS_ENTRY, true)
    const files = [...visited].map((f) => f.replace(/\\/g, "/"))
    // non-vacuity: the crawl really walked the docs tree, the shared header and the lazy page
    expect(files.length).toBeGreaterThanOrEqual(20)
    expect(files.some((f) => f.endsWith("/src/landing/components/Navigation.tsx"))).toBe(true)
    expect(files.some((f) => f.endsWith("/src/docs/pages/ApiReference.tsx"))).toBe(true)

    for (const f of files) {
      for (const bad of FORBIDDEN_SUBSTRINGS) {
        expect(f.includes(bad), `docs module ${f} is under forbidden path ${bad}`).toBe(false)
      }
    }
    for (const { from, spec } of edges) {
      expect(FORBIDDEN_PACKAGES.includes(spec), `${from} imports ${spec}`).toBe(false)
      expect(spec.startsWith("@/lib") || spec.startsWith("@/components") || spec.startsWith("@/providers"), `${from} imports ${spec}`).toBe(false)
    }
  })

  it("Scalar, Remotion and the video compositions only arrive behind import()", () => {
    const { edges } = crawl(DOCS_ENTRY, false)
    for (const { from, spec } of edges) {
      for (const p of DYNAMIC_ONLY_PREFIXES) {
        expect(spec === p || spec.startsWith(p), `${from} STATICALLY imports ${spec} (must be import())`).toBe(false)
      }
    }
    // positive control: the API reference page exists and loads Scalar dynamically
    const all = crawl(DOCS_ENTRY, true).edges
    expect(all.some((e) => e.dynamic && e.spec === "@scalar/api-reference-react")).toBe(true)
    // 276-REVIEW B-CR-01: Scalar's stylesheet is imported by the host (the package injects
    // none) — and only behind import(), so it never joins the docs first paint
    expect(all.some((e) => e.dynamic && e.spec === "@scalar/api-reference-react/style.css")).toBe(true)
  })

  it("docs main.tsx mounts no auth, stream or org provider", () => {
    const content = nodeFs.readFileSync(DOCS_ENTRY, "utf-8")
    expect(content).not.toMatch(/<AuthProvider/i)
    expect(content).not.toMatch(/<StreamsProvider/i)
    expect(content).not.toMatch(/<OrgProvider/i)
    expect(content).not.toMatch(/useAuth/i)
  })
})
