// @vitest-environment node
/**
 * Phase 276 (DOCS-03, D-16 / D-17) — the public "Syrel API" spec.
 *
 * `scripts/build-public-openapi.cjs` filters `docs/public/api/openapi.snapshot.json` into
 * `docs/public/api/openapi.public.json`, which the docs API reference page renders. Everything
 * in that file is world-readable, so this suite asserts the filter's CONTENT (titles, badges,
 * absences), never mere presence. The failure arms (a missing v4.5 op, an ungrouped tag, a
 * drifted committed file) are driven against TEMP copies — the committed files are never
 * mutated.
 */
import { describe, it, expect, vi } from "vitest"

const nodeFs = await vi.importActual<any>("node:fs")
const nodePath = await vi.importActual<any>("node:path")
const nodeOs = await vi.importActual<any>("node:os")
const nodeModule = await vi.importActual<any>("node:module")
const childProcess = await vi.importActual<any>("node:child_process")
// via importActual, not the `process` global: tsconfig.app.json has no node types
const nodeProcess = await vi.importActual<any>("node:process")

const REPO_ROOT: string = (() => {
  const here = decodeURIComponent(import.meta.url).replace(/^file:\/\/\/?/, "")
  const marker = "/frontend/src/docs/__tests__/"
  const at = here.indexOf(marker)
  if (at === -1) throw new Error(`cannot locate repo root from: ${here}`)
  return here.slice(0, at)
})()

const SCRIPT = nodePath.join(REPO_ROOT, "scripts", "build-public-openapi.cjs")
const SNAPSHOT = nodePath.join(REPO_ROOT, "docs", "public", "api", "openapi.snapshot.json")
const PUBLIC = nodePath.join(REPO_ROOT, "docs", "public", "api", "openapi.public.json")
const HISTORY = nodePath.join(REPO_ROOT, "docs", "history")

const requireCjs = nodeModule.createRequire(import.meta.url)
const lib = requireCjs(SCRIPT)

const readJson = (p: string) => JSON.parse(nodeFs.readFileSync(p, "utf-8"))
const pub = readJson(PUBLIC)
const METHODS = ["get", "put", "post", "delete", "patch", "options", "head", "trace"]

function ops(doc: any): Array<{ method: string; path: string; op: any }> {
  const out: Array<{ method: string; path: string; op: any }> = []
  for (const [path, item] of Object.entries<any>(doc.paths)) {
    for (const method of METHODS) if (item[method]) out.push({ method, path, op: item[method] })
  }
  return out
}

const badgeNames = (op: any): string[] => (op["x-badges"] ?? []).map((b: any) => b.name)

function runCli(args: string[]) {
  return childProcess.spawnSync(nodeProcess.execPath, [SCRIPT, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  })
}

function tmpDir(): string {
  return nodeFs.mkdtempSync(nodePath.join(nodeOs.tmpdir(), "pubopenapi-"))
}

describe("public Syrel API spec (DOCS-03)", () => {
  it("is titled Syrel API and states the no-API-keys truth", () => {
    expect(pub.info.title).toBe("Syrel API")
    expect(pub.info.description).toContain("no API keys")
    expect(pub.info.description).toContain("SEED-013")
    // A-WR-07: the live explorer is bearer-only in production — never promised as a browser page
    expect(pub.info.description).not.toContain("signed-in API explorer")
    expect(pub.info.description).toContain("/docs/api/reference")
    expect(pub.info.description).toContain("not a browser")
  })

  it("takes its version from the newest RELEASED docs/history file (derived, never typed)", () => {
    // 276-REVIEW A-WR-06: derived through parseHistory — the SAME parser the changelog uses —
    // never a second line-3 reader that could silently skip a file.
    const docsContent = requireCjs(nodePath.join(REPO_ROOT, "scripts", "lib", "docs-content.cjs"))
    const releases: Array<{ version: string; released: boolean }> = docsContent.parseHistory(HISTORY)
    expect(releases.length).toBeGreaterThanOrEqual(20)
    const newest = releases.find((r) => r.released)
    expect(newest).toBeDefined()
    expect(pub.info.version).toBe(newest!.version.slice(1))
    expect(lib.releasedVersion(HISTORY)).toBe(newest!.version.slice(1))
  })

  it("throws (never skips) when a history file cannot be parsed (A-WR-06)", () => {
    const dir = tmpDir()
    for (const f of nodeFs.readdirSync(HISTORY) as string[]) {
      nodeFs.copyFileSync(nodePath.join(HISTORY, f), nodePath.join(dir, f))
    }
    expect(lib.releasedVersion(dir)).toBe(pub.info.version)
    // A file with no parseable Shipped line is an error naming the file, never a silent skip.
    nodeFs.writeFileSync(nodePath.join(dir, "v9.9-broken.md"), "# v9.9 — Broken\n\nno shipped line here\n")
    expect(() => lib.releasedVersion(dir)).toThrow(/v9\.9-broken\.md/)
  })

  it("publishes zero /admin paths (D-16) and none of the hidden set", () => {
    const paths = Object.keys(pub.paths)
    expect(paths.filter((p) => p === "/admin" || p.startsWith("/admin/"))).toEqual([])
    const hidden = paths.filter(
      (p) =>
        p.startsWith("/setup/") ||
        p === "/public-config" ||
        p === "/connectors/oauth/callback" ||
        p === "/connectors/mcp/oauth/callback" ||
        p.startsWith("/evals/") ||
        p.startsWith("/api/sources/") ||
        p.startsWith("/__test__/"),
    )
    expect(hidden).toEqual([])
    // non-vacuity: the snapshot DID carry these, so the filter removed something real
    const snap = readJson(SNAPSHOT)
    expect(Object.keys(snap.paths).filter((p) => p.startsWith("/admin/")).length).toBeGreaterThan(0)
    expect(Object.keys(snap.paths)).toContain("/public-config")
  })

  it("flags /knowledge-health/* and the other UI-internal ops (D-17)", () => {
    const flagged = [
      "/workflows/grounding-bundle",
      "/workflows/validate",
      "/threads/{thread_id}/snapshot",
      "/threads/expert-scope-preview",
      "/library/index-summary",
    ]
    const kh = ops(pub).filter((o) => o.path.startsWith("/knowledge-health/"))
    expect(kh.length).toBeGreaterThan(0)
    for (const o of kh) expect(badgeNames(o.op)).toContain("UI-internal: may change")
    for (const p of flagged) {
      expect(pub.paths[p], p).toBeDefined()
      for (const o of ops(pub).filter((x) => x.path === p)) {
        expect(badgeNames(o.op), p).toContain("UI-internal: may change")
      }
    }
  })

  it("badges every V45 operation 'Not yet released'", () => {
    expect(lib.V45_OPERATIONS.length).toBeGreaterThanOrEqual(2)
    for (const key of lib.V45_OPERATIONS as string[]) {
      const [method, path] = key.split(" ")
      const op = pub.paths[path]?.[method]
      expect(op, key).toBeDefined()
      expect(badgeNames(op), key).toContain("Not yet released")
    }
  })

  it("exits 1 naming a V45 op the snapshot no longer has", () => {
    const snap = readJson(SNAPSHOT)
    delete snap.paths["/document-search"]
    const { findings } = lib.buildPublicSpec(snap, { historyDir: HISTORY })
    expect(findings).toContain("[missing-v45-op] post /document-search")

    const dir = tmpDir()
    const snapPath = nodePath.join(dir, "snap.json")
    nodeFs.writeFileSync(snapPath, JSON.stringify(snap))
    const res = runCli(["--snapshot", snapPath, "--out", nodePath.join(dir, "out.json")])
    expect(res.status).toBe(1)
    expect(res.stdout + res.stderr).toContain("[missing-v45-op] post /document-search")
  })

  it("puts every used tag in exactly one x-tagGroups group, and refuses an ungrouped tag", () => {
    const used = new Set<string>()
    for (const o of ops(pub)) for (const t of o.op.tags ?? []) used.add(t)
    expect(used.size).toBeGreaterThan(10)
    const groups: Array<{ name: string; tags: string[] }> = pub["x-tagGroups"]
    expect(groups.map((g) => g.name)).toEqual([
      "Chat & runs",
      "Documents",
      "Automation",
      "Connect",
      "Experts",
      "Account & org",
      "System",
    ])
    for (const t of used) {
      expect(groups.filter((g) => g.tags.includes(t)).length, t).toBe(1)
    }
    for (const o of ops(pub)) expect((o.op.tags ?? []).length, `${o.method} ${o.path}`).toBeGreaterThan(0)

    const snap = readJson(SNAPSHOT)
    snap.paths["/zz-unplanned"] = { get: { tags: ["zz-unplanned"], responses: {} } }
    const { findings } = lib.buildPublicSpec(snap, { historyDir: HISTORY })
    expect(findings).toContain("[ungrouped-tag] zz-unplanned")
  })

  it("keeps exactly the schemas reachable from surviving paths (no orphans)", () => {
    const PREFIX = "#/components/schemas/"
    const collect = (node: any, into: Set<string>) => {
      if (Array.isArray(node)) node.forEach((n) => collect(n, into))
      else if (node && typeof node === "object") {
        if (typeof node.$ref === "string" && node.$ref.startsWith(PREFIX)) into.add(node.$ref.slice(PREFIX.length))
        Object.values(node).forEach((v) => collect(v, into))
      }
    }
    const reach = new Set<string>()
    collect(pub.paths, reach)
    const pending = [...reach]
    while (pending.length) {
      const name = pending.pop() as string
      const nested = new Set<string>()
      collect(pub.components.schemas[name], nested)
      for (const n of nested) if (!reach.has(n)) { reach.add(n); pending.push(n) }
    }
    const kept = Object.keys(pub.components.schemas)
    expect(kept.length).toBeGreaterThan(50)
    expect(kept.filter((k) => !reach.has(k))).toEqual([])
    expect([...reach].filter((r) => !(r in pub.components.schemas))).toEqual([])
  })

  it("declares a reusable X-Org-Id header parameter and no servers entry", () => {
    const params = pub.components.parameters ?? {}
    const xorg = Object.values<any>(params).find((p) => p.name === "X-Org-Id")
    expect(xorg?.in).toBe("header")
    expect(pub.servers).toBeUndefined()
  })

  it("carries nothing secret-shaped", () => {
    const text = nodeFs.readFileSync(PUBLIC, "utf-8")
    expect(text).not.toMatch(/(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{8,}/)
    expect(text).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/)
    expect(text).not.toContain("supabase.co")
    expect(text).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/)
  })

  it("--check passes on the committed file and fails once a copy drifts", () => {
    expect(runCli(["--check"]).status).toBe(0)

    const dir = tmpDir()
    const copy = nodePath.join(dir, "openapi.public.json")
    const altered = readJson(PUBLIC)
    altered.info.title = "Agentic RAG API"
    nodeFs.writeFileSync(copy, JSON.stringify(altered, null, 2) + "\n")
    const res = runCli(["--check", "--out", copy])
    expect(res.status).toBe(1)
  })
})
