#!/usr/bin/env node
/**
 * Phase 276-05 (G4-2 / T-276-21) — Landing first-paint guard over the BUILT output.
 *
 * Reads frontend/dist/.vite/manifest.json (vite.config.ts sets `build.manifest: true`), starts at
 * the landing entry (`index.html`) and follows each chunk's `imports` — the chunks a browser loads
 * for first paint — and NEVER `dynamicImports` (those load later, behind import(): the hero promo,
 * which is allowed to carry Remotion). Every reachable chunk file is read; none may contain a
 * forbidden marker (Remotion, the Player's licence prop, Scalar, MiniSearch).
 *
 * The source-level twin is frontend/src/landing/__tests__/landingFirstPaintFence.test.ts (a static
 * import crawl). This script proves the same property on what Rollup actually emitted, which is
 * the only place a shared-chunk hoist would show up.
 *
 * Usage:
 *   node scripts/check-landing-first-paint.cjs                 # after `npx vite build` in frontend/
 *   node scripts/check-landing-first-paint.cjs --dist <dir>    # another build output
 *   node scripts/check-landing-first-paint.cjs --self-test     # drives a planted defect, see below
 *
 * Exit codes:
 *   0 — Clean: no first-paint chunk carries a forbidden marker.
 *   1 — Finding: a chunk reachable through `imports` from the landing entry carries one.
 *   2 — Harness error: the manifest is missing/unparseable, the landing entry is absent, a
 *       reachable chunk file is missing, or the walk visited nothing.
 */

const fs = require("fs")
const os = require("os")
const path = require("path")

function findRepoRoot() {
  let cur = __dirname
  while (cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, ".git"))) return cur
    cur = path.dirname(cur)
  }
  return path.resolve(__dirname, "..")
}

const LANDING_ENTRY = "index.html"
/** Markers that must never appear in a landing first-paint chunk. */
const FORBIDDEN_MARKERS = ["@remotion", "acknowledgeRemotionLicense", "remotion.media", "scalar", "minisearch"]

class HarnessError extends Error {}

/**
 * Walk the manifest from the landing entry through `imports` only.
 * @returns {{ visited: string[], findings: { file: string, marker: string }[] }}
 */
function checkDist(distDir) {
  const manifestPath = path.join(distDir, ".vite", "manifest.json")
  if (!fs.existsSync(manifestPath)) {
    throw new HarnessError(`missing ${manifestPath} — run \`npx vite build\` in frontend/ (build.manifest must be true)`)
  }
  let manifest
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  } catch (err) {
    throw new HarnessError(`could not parse ${manifestPath}: ${err.message}`)
  }
  const entry = manifest[LANDING_ENTRY]
  if (!entry || !entry.isEntry) {
    throw new HarnessError(`the manifest has no "${LANDING_ENTRY}" entry — is the landing still the index.html input?`)
  }

  const visited = []
  const findings = []
  const seen = new Set()
  const queue = [LANDING_ENTRY]
  while (queue.length > 0) {
    const key = queue.shift()
    if (seen.has(key)) continue
    seen.add(key)
    const chunk = manifest[key]
    if (!chunk) throw new HarnessError(`manifest key "${key}" is imported but not defined`)
    const files = [chunk.file, ...(chunk.css || [])].filter(Boolean)
    for (const rel of files) {
      const abs = path.join(distDir, rel)
      if (!fs.existsSync(abs)) throw new HarnessError(`reachable chunk ${rel} is missing from ${distDir}`)
      visited.push(rel)
      const text = fs.readFileSync(abs, "utf8")
      for (const marker of FORBIDDEN_MARKERS) {
        if (text.includes(marker)) findings.push({ file: rel, marker })
      }
    }
    for (const next of chunk.imports || []) queue.push(next) // imports only — never dynamicImports
  }
  if (visited.length === 0) throw new HarnessError("the walk visited no chunk files")
  return { visited, findings }
}

// ── self-test: a temp build output with a clean graph, then planted defects ──────────────────────
function selfTest() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "landing-first-paint-"))
  const inTmp = (p) => {
    const abs = path.resolve(tmpRoot, p)
    if (abs !== tmpRoot && !abs.startsWith(tmpRoot + path.sep)) throw new Error(`refusing to write outside ${tmpRoot}: ${abs}`)
    return abs
  }
  const write = (p, text) => {
    const abs = inTmp(p)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, text)
  }
  const results = []
  const expect = (name, got, want) => results.push({ name, ok: got === want, got, want })
  const run = (dir) => {
    try {
      return checkDist(dir).findings.length > 0 ? 1 : 0
    } catch (err) {
      if (err instanceof HarnessError) return 2
      throw err
    }
  }
  try {
    const base = (name, manifest, files) => {
      const dir = inTmp(name)
      write(`${name}/.vite/manifest.json`, JSON.stringify(manifest))
      for (const [rel, text] of Object.entries(files)) write(`${name}/${rel}`, text)
      return dir
    }
    const cleanManifest = {
      "index.html": { file: "assets/landing.js", isEntry: true, imports: ["_react.js"], dynamicImports: ["src/landing/components/HeroPromo.tsx"] },
      "_react.js": { file: "assets/react.js" },
      "src/landing/components/HeroPromo.tsx": { file: "assets/HeroPromo.js", isDynamicEntry: true },
    }
    const cleanFiles = {
      "assets/landing.js": "console.log('landing')",
      "assets/react.js": "export const React = {}",
      // the dynamic promo chunk MAY carry Remotion — it is never walked
      "assets/HeroPromo.js": "Player({acknowledgeRemotionLicense:true}) // @remotion/player",
    }
    expect("clean graph (Remotion only behind dynamicImports) → 0", run(base("clean", cleanManifest, cleanFiles)), 0)

    const planted = JSON.parse(JSON.stringify(cleanManifest))
    planted["index.html"].imports.push("_hoisted.js")
    planted["_hoisted.js"] = { file: "assets/hoisted.js" }
    expect(
      "planted reachable chunk containing acknowledgeRemotionLicense → 1",
      run(base("planted", planted, { ...cleanFiles, "assets/hoisted.js": "x={acknowledgeRemotionLicense:!0}" })),
      1,
    )
    expect("missing manifest → 2", run(inTmp("nothing-here")), 2)
    const noEntry = { "app.html": { file: "assets/app.js", isEntry: true } }
    expect("landing entry absent → 2", run(base("no-entry", noEntry, { "assets/app.js": "" })), 2)
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  }
  for (const r of results) console.log(`${r.ok ? "ok  " : "FAIL"}  ${r.name}${r.ok ? "" : ` (got ${r.got}, want ${r.want})`}`)
  const failed = results.filter((r) => !r.ok).length
  console.log(failed === 0 ? `self-test OK — ${results.length}/${results.length} arms behaved` : `self-test FAILED — ${failed} arm(s)`)
  return failed === 0 ? 0 : 1
}

function main(argv) {
  if (argv.includes("--self-test")) return selfTest()
  const at = argv.indexOf("--dist")
  const distDir = at !== -1 && argv[at + 1] ? path.resolve(argv[at + 1]) : path.join(findRepoRoot(), "frontend", "dist")
  let result
  try {
    result = checkDist(distDir)
  } catch (err) {
    if (err instanceof HarnessError) {
      console.error(`[HARNESS ERROR] ${err.message}`)
      return 2
    }
    throw err
  }
  if (result.findings.length > 0) {
    for (const f of result.findings) console.log(`[first-paint] ${f.file} contains "${f.marker}"`)
    console.log(`landing first paint FAILED — ${result.findings.length} finding(s) across ${result.visited.length} first-paint files`)
    return 1
  }
  console.log(`landing first paint OK — ${result.visited.length} first-paint files from ${LANDING_ENTRY}, none carries ${FORBIDDEN_MARKERS.join(" / ")}`)
  return 0
}

process.exit(main(process.argv.slice(2)))
