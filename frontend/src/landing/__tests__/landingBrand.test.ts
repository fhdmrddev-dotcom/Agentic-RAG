/**
 * Phase 276 (DOCS-06, D-14 / SC#6) — the public landing says "Syrel", never the old product name.
 *
 * Scans every .ts / .tsx / .css file under src/landing (recursively, this file included — it
 * builds the forbidden string at runtime so it does not match itself) plus frontend/index.html,
 * whose <title> and description are what a browser tab and a search result show.
 *
 * Non-vacuity: refuses to pass if fewer than 20 files were scanned — a broken path resolution
 * that scans nothing must fail, not pass.
 *
 * ── 276-07 (D-27, 276-LOGO-INVENTORY §E): the scope now also covers the APP ──────────────────
 * Every .ts / .tsx file under src/components and src/pages (excluding *.test.*, *.testutil.* and
 * anything under __tests__/) is scanned too. WHY: 276-01's landing-only scope let three
 * user-visible "Added to <old name>" labels survive in the app (DocumentFileFacts.tsx,
 * findState.ts, StructurePopovers.tsx). An identifier cannot contain a space, so the two-word
 * phrase can only match a string, JSX text or a comment — and comments are removed first with
 * the shared `stripComments`, so historical prose does not trip the fence.
 *
 * ⚠ stripComments' caveat: it does not parse strings. It never ADDS text, so it can never
 * manufacture an offender; at worst a string containing a block-comment opener could hide an
 * offender that follows it on the way to the next closer. Accepted — the planted case below
 * proves the matcher fires, and the ≥ 300 floor proves the walk is not vacuous.
 */
import { describe, it, expect, vi } from "vitest"
import { stripComments } from "@/lib/stripComments.testutil"

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

/** App source walker: .ts/.tsx only, never a test, a testutil, or anything under __tests__/. */
function walkApp(dir: string, out: string[]) {
  for (const entry of nodeFs.readdirSync(dir, { withFileTypes: true })) {
    const full = nodePath.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== "__tests__") walkApp(full, out)
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|testutil)\./.test(entry.name)) {
      out.push(full)
    }
  }
}

/**
 * The matcher both the real scan and the planted case use — one rule, two inputs.
 * stripComments deletes a block comment INCLUDING its newlines, which shifts every later line
 * number; so block comments are first reduced to just their line breaks (same regex), and
 * stripComments then removes the full-line `//` comments. Reported line numbers stay true.
 */
function offendersIn(label: string, source: string): string[] {
  const out: string[] = []
  const lineKept = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\r\n]/g, ""))
  stripComments(lineKept)
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (line.includes(OLD_NAME)) out.push(`${label}:${i + 1}`)
    })
  return out
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

  it(`no app source under src/components or src/pages says "${OLD_NAME}" outside a comment (276-07)`, () => {
    const files: string[] = []
    walkApp(nodePath.join(FRONTEND_DIR, "src", "components"), files)
    walkApp(nodePath.join(FRONTEND_DIR, "src", "pages"), files)

    expect(files.length).toBeGreaterThanOrEqual(300)

    const offenders: string[] = []
    for (const f of files) {
      const rel = nodePath.relative(FRONTEND_DIR, f).split(nodePath.sep).join("/")
      offenders.push(...offendersIn(rel, nodeFs.readFileSync(f, "utf-8")))
    }
    expect(offenders).toEqual([])
  })

  it("the app matcher can fire: a planted label is reported exactly once, a comment is not", () => {
    const planted = [
      "// a line comment naming " + OLD_NAME + " is history, not copy",
      "/* so is a block comment: " + OLD_NAME + " */",
      `export const SORT = [{ value: "added", label: "Added to ${OLD_NAME}" }]`,
    ].join("\n")
    expect(offendersIn("planted.ts", planted)).toEqual(["planted.ts:3"])
  })
})
