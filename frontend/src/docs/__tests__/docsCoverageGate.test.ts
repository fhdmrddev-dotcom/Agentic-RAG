// @vitest-environment node
// Phase 276-05 (DOCS-02 / SC#2, T-276-22) — the docs coverage gate, driven against PLANTED defects.
//
// Every arm copies the REAL inputs (docs/public, the coverage inventory, the code sources the code
// keys are derived from, scripts/lib/docs-content.cjs) into a fresh os.tmpdir() root, plants one
// defect there, and runs `node scripts/check-docs-coverage.cjs --root <tmp>`. The floors apply
// under --root exactly as on the real tree (no flag can lower them), and the real tree is never
// written: every write passes a containment guard, and `git status --porcelain docs/public` is
// compared before and after.
//
// Node built-ins come through vi.importActual with local interfaces (tsconfig.app.json carries no
// node types; adding them would grow the app typecheck's base error set — 276-02's finding).
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"

const fs = await vi.importActual<{
  readFileSync(p: string, enc: string): string
  writeFileSync(p: string, data: string): void
  existsSync(p: string): boolean
  mkdirSync(p: string, o: { recursive: boolean }): void
  mkdtempSync(prefix: string): string
  readdirSync(p: string, o: { withFileTypes: true }): { name: string; isDirectory(): boolean }[]
  copyFileSync(a: string, b: string): void
  rmSync(p: string, o: { recursive: boolean; force: boolean }): void
  unlinkSync(p: string): void
}>("node:fs")
const nodePath = await vi.importActual<{
  join(...p: string[]): string
  resolve(...p: string[]): string
  dirname(p: string): string
  sep: string
}>("node:path")
const os = await vi.importActual<{ tmpdir(): string }>("node:os")
const cp = await vi.importActual<{
  spawnSync(
    cmd: string,
    args: string[],
    o: { cwd?: string; encoding: "utf8"; timeout?: number },
  ): { status: number | null; stdout: string; stderr: string }
}>("node:child_process")
const proc = (globalThis as unknown as { process: { execPath: string } }).process

const REPO = (() => {
  const here = decodeURIComponent(import.meta.url).replace(/^file:\/\/\/?/, "")
  const marker = "/frontend/src/docs/__tests__/"
  const at = here.indexOf(marker)
  if (at === -1) throw new Error(`cannot locate the repo root in: ${here}`)
  return here.slice(0, at)
})()
const GATE = `${REPO}/scripts/check-docs-coverage.cjs`

const COPY_FILES = [
  ".planning/research/docs-coverage-inventory.md",
  "scripts/lib/docs-content.cjs",
  "frontend/src/lib/nav-items.ts",
  "frontend/src/App.tsx",
  "frontend/src/pages/SettingsPage.tsx",
  "backend/app/services/tool_dispatcher.py",
  "backend/app/main.py",
]
const COPY_DIRS_RECURSIVE = ["docs/public"]
const COPY_DIRS_PY = ["backend/app/services/harness"]

let TMP_BASE = ""
let gitBefore = ""

function within(root: string, rel: string): string {
  const abs = nodePath.resolve(root, rel)
  const r = nodePath.resolve(root)
  if (abs !== r && !abs.startsWith(r + nodePath.sep)) throw new Error(`refusing to touch outside ${r}: ${abs}`)
  if (!nodePath.resolve(abs).startsWith(nodePath.resolve(TMP_BASE))) throw new Error(`refusing to touch outside the temp base: ${abs}`)
  return abs
}

function copyTree(srcAbs: string, dstRoot: string, rel: string) {
  for (const ent of fs.readdirSync(srcAbs, { withFileTypes: true })) {
    const s = nodePath.join(srcAbs, ent.name)
    const r = `${rel}/${ent.name}`
    if (ent.isDirectory()) copyTree(s, dstRoot, r)
    else {
      const d = within(dstRoot, r)
      fs.mkdirSync(nodePath.dirname(d), { recursive: true })
      fs.copyFileSync(s, d)
    }
  }
}

let n = 0
function freshRoot(): string {
  const root = nodePath.join(TMP_BASE, `root-${++n}`)
  within(TMP_BASE === "" ? root : root, ".")
  for (const rel of COPY_FILES) {
    const d = within(root, rel)
    fs.mkdirSync(nodePath.dirname(d), { recursive: true })
    fs.copyFileSync(`${REPO}/${rel}`, d)
  }
  for (const rel of COPY_DIRS_RECURSIVE) copyTree(`${REPO}/${rel}`, root, rel)
  for (const rel of COPY_DIRS_PY) {
    for (const ent of fs.readdirSync(`${REPO}/${rel}`, { withFileTypes: true })) {
      if (ent.isDirectory() || !ent.name.endsWith(".py")) continue
      const d = within(root, `${rel}/${ent.name}`)
      fs.mkdirSync(nodePath.dirname(d), { recursive: true })
      fs.copyFileSync(`${REPO}/${rel}/${ent.name}`, d)
    }
  }
  return root
}

function edit(root: string, rel: string, fn: (s: string) => string) {
  const p = within(root, rel)
  const before = fs.readFileSync(p, "utf8")
  const after = fn(before)
  if (after === before) throw new Error(`planting into ${rel} changed nothing — the anchor moved`)
  fs.writeFileSync(p, after)
}

function runGate(root: string) {
  const r = cp.spawnSync(proc.execPath, [GATE, "--root", root], { encoding: "utf8", timeout: 60000 })
  return { status: r.status, out: `${r.stdout}\n${r.stderr}` }
}

function gitStatusDocs(): string {
  const r = cp.spawnSync("git", ["status", "--porcelain", "docs/public"], { cwd: REPO, encoding: "utf8" })
  return r.stdout
}

beforeAll(() => {
  gitBefore = gitStatusDocs()
  TMP_BASE = fs.mkdtempSync(nodePath.join(os.tmpdir(), "docs-coverage-"))
})
afterAll(() => {
  if (TMP_BASE && TMP_BASE.startsWith(nodePath.resolve(os.tmpdir()))) fs.rmSync(TMP_BASE, { recursive: true, force: true })
})

describe("check-docs-coverage.cjs (DOCS-02)", { timeout: 60000 }, () => {
  it("passes on a faithful copy of the real tree and prints the summary line", () => {
    const { status, out } = runGate(freshRoot())
    expect(out).toMatch(/\d+ code keys · \d+ inventory IDs · \d+ pages \(\d+ written \/ \d+ stubs\)/)
    expect(status, out).toBe(0)
  })

  it("a planted tool with no covers: page fails with [uncovered] tool:planted_tool", () => {
    const root = freshRoot()
    edit(root, "backend/app/services/tool_dispatcher.py", (s) =>
      s.replace(/(_TOOL_REGISTRY:\s*dict\[str,\s*Callable\]\s*=\s*\{\r?\n)/, `$1    "planted_tool": _handle_x,\n`),
    )
    const { status, out } = runGate(root)
    expect(out).toContain("[uncovered] tool:planted_tool")
    expect(status, out).toBe(1)
  })

  it("a planted router with no covers: page fails with [uncovered] router:planted", () => {
    const root = freshRoot()
    edit(root, "backend/app/main.py", (s) => `${s}\napp.include_router(planted.router)\n`)
    const { status, out } = runGate(root)
    expect(out).toContain("[uncovered] router:planted")
    expect(status, out).toBe(1)
  })

  it("an emptied tool registry is a harness error (exit 2), never a pass", () => {
    const root = freshRoot()
    edit(root, "backend/app/services/tool_dispatcher.py", (s) =>
      s.replace(/(_TOOL_REGISTRY:\s*dict\[str,\s*Callable\]\s*=\s*\{)[\s\S]*?(\r?\n\})/, "$1$2"),
    )
    const { status, out } = runGate(root)
    expect(out).toMatch(/tool_dispatcher\.py/)
    expect(status, out).toBe(2)
  })

  it("no pages at all is a harness error (exit 2)", () => {
    const root = freshRoot()
    const walk = (rel: string) => {
      for (const ent of fs.readdirSync(within(root, rel), { withFileTypes: true })) {
        const r = `${rel}/${ent.name}`
        if (ent.isDirectory()) walk(r)
        else if (ent.name.endsWith(".md") && r !== "docs/public/README.md") fs.unlinkSync(within(root, r))
      }
    }
    walk("docs/public")
    const { status, out } = runGate(root)
    expect(out).toMatch(/pages/i)
    expect(status, out).toBe(2)
  })

  it("a cover naming a key that no longer exists fails with [stale-cover]", () => {
    const root = freshRoot()
    edit(root, "docs/public/use/chat.md", (s) => s.replace(/^covers:\s*\[/m, "covers: [tool:removed_tool, "))
    const { status, out } = runGate(root)
    expect(out).toMatch(/\[stale-cover\] use\/chat: tool:removed_tool/)
    expect(status, out).toBe(1)
  })

  it("a v4.5 row on a release: shipped page with no unreleased entry fails with [release-mismatch]", () => {
    const root = freshRoot()
    edit(root, "docs/public/use/library/find.md", (s) => s.replace(/^release:\s*v4\.5\s*$/m, "release: shipped"))
    const { status, out } = runGate(root)
    expect(out).toMatch(/\[release-mismatch\] use\/library\/find: [A-I]\d+/)
    expect(status, out).toBe(1)
  })

  it("never mutates the real docs tree", () => {
    expect(gitStatusDocs()).toBe(gitBefore)
  })
})
