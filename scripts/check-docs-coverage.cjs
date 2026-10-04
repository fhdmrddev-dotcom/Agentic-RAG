#!/usr/bin/env node
/**
 * Phase 276-05 (DOCS-02 / SC#2) — Docs coverage gate.
 *
 * Every capability the product ships must have a page under docs/public/ that names it in its
 * `covers:` frontmatter (a stub counts — D-07). The scan set is DERIVED FROM CODE, never typed
 * here: the seven code-key extractors live in scripts/lib/docs-content.cjs (extractCodeKeys —
 * nav items, ActiveView members, agent tools, workflow step types, validators, API routers,
 * Settings tabs), and the inventory IDs come from .planning/research/docs-coverage-inventory.md
 * through the same library (parseInventory). Pages are read by the same library too
 * (loadAllPages + validatePages): there is ONE frontmatter parser in this repo.
 *
 * Findings (exit 1):
 *   [uncovered] <key>             a code key or inventory ID that no page covers
 *   [stale-cover] <slug>: <key>   a page covers a code key / inventory ID that no longer exists
 *   [release-mismatch] <slug>: <ID>  a release: shipped page covers a v4.5 inventory row without
 *                                 listing it under `unreleased:`
 *   [stale-exclusion] <ID>        an exclusion below names an ID the inventory no longer has
 *   plus every validatePages / loadAllPages finding ([bad-frontmatter], [unlisted-page],
 *   [missing-page], [unreadable])
 *
 * Harness errors (exit 2) — a gate that passes over nothing hides drift (T-276-22):
 *   a code source parses below its MIN_* floor (docs-content.cjs throws naming the file to
 *   re-point); fewer than MIN_INVENTORY_IDS inventory rows; fewer than MIN_PAGES pages; the docs
 *   root, sections.json or the inventory cannot be read.
 *
 * `--root <dir>` changes only WHERE the files are read (the planted-defect test points it at a
 * temp copy). No flag lowers a floor.
 *
 * Exit codes:
 *   0 — Clean.
 *   1 — Findings.
 *   2 — Harness error.
 *
 * Primary guard: .claude/hooks/docs-coverage-guard.js (PostToolUse, fires in the turn the edit is
 * made). Backstop: .github/workflows/docs-coverage.yml.
 */

const fs = require("fs")
const path = require("path")
const docs = require("./lib/docs-content.cjs")

/** Inventory rows: the inventory measured 261 at Phase 276; a collapse below this is a parse failure. */
const MIN_INVENTORY_IDS = 250
/** Pages: docs/public held 119 at Phase 276 (31 written + 88 stubs). */
const MIN_PAGES = 100

/** IDs deliberately left without a public page. Every entry carries its reason. */
const EXCLUSIONS = {
  I20: "internal hosted pipeline, not public by decision",
}

/** extractCodeKeys() field → covers: prefix. */
const PREFIX = {
  nav: "nav",
  view: "view",
  tool: "tool",
  step: "step",
  check: "check",
  router: "router",
  settingsTab: "settings-tab",
}

class HarnessError extends Error {}

function parseArgs(argv) {
  const at = argv.indexOf("--root")
  if (at !== -1) {
    if (!argv[at + 1]) throw new HarnessError("--root needs a directory")
    return { root: path.resolve(argv[at + 1]) }
  }
  return { root: path.resolve(__dirname, "..") }
}

function readOrHarness(abs, what) {
  try {
    return fs.readFileSync(abs, "utf8")
  } catch (err) {
    throw new HarnessError(`could not read ${what} (${abs}): ${err.message}`)
  }
}

function run(root) {
  // ── 1. code keys (floors throw inside docs-content.cjs → harness error naming the file) ──────
  let codeKeys
  try {
    codeKeys = docs.extractCodeKeys(root)
  } catch (err) {
    throw new HarnessError(err.message)
  }
  const codeKeySet = new Set()
  for (const [field, prefix] of Object.entries(PREFIX)) {
    const list = codeKeys[field]
    if (!Array.isArray(list)) throw new HarnessError(`extractCodeKeys returned no "${field}" list`)
    for (const k of list) codeKeySet.add(`${prefix}:${k}`)
  }

  // ── 2. inventory ──────────────────────────────────────────────────────────────────────────
  const inventory = docs.parseInventory(readOrHarness(path.join(root, docs.INVENTORY_PATH), "the coverage inventory"))
  const invById = new Map(inventory.map((r) => [r.id, r]))
  if (invById.size < MIN_INVENTORY_IDS) {
    throw new HarnessError(
      `${docs.INVENTORY_PATH}: parsed ${invById.size} inventory IDs, below the floor of ${MIN_INVENTORY_IDS} (MIN_INVENTORY_IDS) — the tables moved or the parser rotted`,
    )
  }

  // ── 3. pages ──────────────────────────────────────────────────────────────────────────────
  const docsRoot = path.join(root, "docs", "public")
  const loaded = docs.loadAllPages(docsRoot)
  if (loaded.readError) throw new HarnessError(loaded.readError)
  if (loaded.pages.length < MIN_PAGES) {
    throw new HarnessError(
      `docs/public: loaded ${loaded.pages.length} pages, below the floor of ${MIN_PAGES} (MIN_PAGES) — refusing to call an empty tree covered`,
    )
  }
  let sections
  try {
    sections = docs.readSections(path.join(docsRoot, "sections.json"))
  } catch (err) {
    throw new HarnessError(`docs/public/sections.json: ${err.message}`)
  }

  const findings = []
  for (const f of loaded.findings) findings.push(docs.formatFinding(f))
  for (const f of docs.validatePages(loaded.pages, sections)) findings.push(docs.formatFinding(f))

  // ── 4. coverage ───────────────────────────────────────────────────────────────────────────
  const covered = new Set()
  for (const p of loaded.pages) {
    for (const c of p.covers) {
      covered.add(c)
      const isInventory = /^[A-I]\d+$/.test(c)
      if (isInventory ? !invById.has(c) : !codeKeySet.has(c)) findings.push(`[stale-cover] ${p.slug}: ${c}`)
    }
    if (p.release === "shipped") {
      const unreleased = new Set(p.unreleased)
      for (const c of p.covers) {
        const row = invById.get(c)
        if (row && docs.inventoryStatusKind(row.status) === "v4.5" && !unreleased.has(c)) {
          findings.push(`[release-mismatch] ${p.slug}: ${c} is v4.5 in the inventory — list it under unreleased: or mark the page release: v4.5`)
        }
      }
    }
  }
  for (const key of [...codeKeySet].sort()) {
    if (!covered.has(key)) findings.push(`[uncovered] ${key}`)
  }
  for (const row of inventory) {
    if (EXCLUSIONS[row.id]) continue
    if (!covered.has(row.id)) findings.push(`[uncovered] ${row.id} (${row.surface.replace(/`/g, "")})`)
  }
  for (const id of Object.keys(EXCLUSIONS)) {
    if (!invById.has(id)) findings.push(`[stale-exclusion] ${id} — the inventory no longer has it; drop the exclusion`)
  }

  const written = loaded.pages.filter((p) => p.status === "written").length
  const summary = `${codeKeySet.size} code keys · ${invById.size} inventory IDs · ${loaded.pages.length} pages (${written} written / ${loaded.pages.length - written} stubs)`
  return { findings, summary }
}

function main(argv) {
  let result
  try {
    const { root } = parseArgs(argv)
    result = run(root)
  } catch (err) {
    if (err instanceof HarnessError) {
      console.error(`[HARNESS ERROR] ${err.message}`)
      return 2
    }
    throw err
  }
  for (const f of result.findings) console.log(f)
  console.log(result.summary)
  if (result.findings.length > 0) {
    console.log(`docs coverage FAILED — ${result.findings.length} finding(s). Fix the page's covers: in docs/public (never by adding an exclusion).`)
    return 1
  }
  console.log(`docs coverage OK — every code key and inventory ID has a page (excluded by decision: ${Object.keys(EXCLUSIONS).join(", ")}).`)
  return 0
}

process.exit(main(process.argv.slice(2)))
