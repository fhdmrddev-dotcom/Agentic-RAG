/**
 * Phase 276 (DOCS-06, D-14 / SC#6) — the public landing says "Syrel", never the old product name.
 *
 * Scans every .ts / .tsx / .css file under src/landing (recursively, this file included — it
 * builds the forbidden string at runtime so it does not match itself) plus frontend/index.html,
 * whose <title> and description are what a browser tab and a search result show.
 *
 * Non-vacuity: refuses to pass if fewer than 20 files were scanned — a broken path resolution
 * that scans nothing must fail, not pass.
 */
import { describe, it, expect, vi } from "vitest"

const nodeFs = await vi.importActual<any>("node:fs")
const nodePath = await vi.importActual<any>("node:path")

const LANDING_DIR: string = (() => {
  const here = decodeURIComponent(import.meta.url).replace(/^file:\/\/\/?/, "")
  const marker = "/src/landing/__tests__/"
  const at = here.indexOf(marker)
  if (at === -1) throw new Error(`cannot locate landing dir in: ${here}`)
  return `${here.slice(0, at)}/src/landing`
})()
const FRONTEND_DIR: string = nodePath.resolve(LANDING_DIR, "..", "..")

const OLD_NAME = ["Agentic", "RAG"].join(" ")

function walk(dir: string, out: string[]) {
  for (const entry of nodeFs.readdirSync(dir, { withFileTypes: true })) {
    const full = nodePath.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (/\.(ts|tsx|css)$/.test(entry.name)) out.push(full)
  }
}

describe("landing brand fence (DOCS-06)", () => {
  it(`no file under src/landing, nor index.html, says "${OLD_NAME}"`, () => {
    const files: string[] = []
    walk(LANDING_DIR, files)
    files.push(nodePath.join(FRONTEND_DIR, "index.html"))

    expect(files.length).toBeGreaterThanOrEqual(20)

    const offenders: string[] = []
    for (const f of files) {
      const lines = nodeFs.readFileSync(f, "utf-8").split(/\r?\n/)
      lines.forEach((line: string, i: number) => {
        if (line.includes(OLD_NAME)) offenders.push(`${nodePath.relative(FRONTEND_DIR, f)}:${i + 1}`)
      })
    }
    expect(offenders).toEqual([])
  })

  it("index.html's browser title says Syrel", () => {
    const html = nodeFs.readFileSync(nodePath.join(FRONTEND_DIR, "index.html"), "utf-8")
    expect(html).toMatch(/<title>Syrel — /)
  })
})
