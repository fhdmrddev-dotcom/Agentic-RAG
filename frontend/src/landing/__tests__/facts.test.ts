import { describe, it, expect, vi } from "vitest"
import {
  MODEL_PROVIDERS,
  LOCAL_RUNTIMES,
  INGEST_FORMATS,
  EXTRACT_CAPABILITIES,
  PRODUCE_FORMATS,
  GAUNTLET_STAGES,
  BUILTIN_TOOL_COUNT,
  TOOL_GROUPS,
  CONNECTOR_CATALOG,
  SURFACE_TABS,
  VERBATIM_QUOTES,
  HERO_FACTS,
} from "../facts"

const nodeFs = await vi.importActual<{
  readFileSync(path: string, encoding: string): string
  existsSync(path: string): boolean
  readdirSync(path: string): string[]
}>("node:fs")

const nodePath = await vi.importActual<{
  join(...paths: string[]): string
  resolve(...paths: string[]): string
}>("node:path")

const LANDING_DIR = (() => {
  const here = decodeURIComponent(import.meta.url).replace(/^file:\/\/\/?/, "")
  const marker = "/src/landing/__tests__/"
  const at = here.indexOf(marker)
  if (at === -1) throw new Error(`cannot locate landing dir in: ${here}`)
  return `${here.slice(0, at)}/src/landing`
})()

const REPO_ROOT = (() => {
  const here = decodeURIComponent(import.meta.url).replace(/^file:\/\/\/?/, "")
  const marker = "/frontend/src/landing/__tests__/"
  const at = here.indexOf(marker)
  if (at === -1) throw new Error(`cannot locate repo root in: ${here}`)
  return here.slice(0, at)
})()

describe("Landing Page Facts (SEED-241 / D-226-04 / F-2)", () => {
  it("exports authoritative counts measured at HEAD", () => {
    expect(MODEL_PROVIDERS).toHaveLength(8)
    expect(LOCAL_RUNTIMES).toHaveLength(2)
    expect(INGEST_FORMATS).toHaveLength(19)
    expect(EXTRACT_CAPABILITIES).toHaveLength(7)
    expect(PRODUCE_FORMATS).toHaveLength(9)
    expect(GAUNTLET_STAGES).toHaveLength(10)
    expect(BUILTIN_TOOL_COUNT).toBe(29)
    expect(CONNECTOR_CATALOG).toHaveLength(13)
    expect(SURFACE_TABS.library).toHaveLength(5)
    expect(SURFACE_TABS.settings).toHaveLength(5)
    expect(SURFACE_TABS.controlRoom).toHaveLength(5)
    expect(SURFACE_TABS.orgAdmin).toHaveLength(8) // 8 since 261 added the Experts tab (synced at the v4.3 audit)
    expect(VERBATIM_QUOTES).toHaveLength(6)
  })

  it("hero facts derive directly from component arrays", () => {
    expect(HERO_FACTS.checksCount).toBe(GAUNTLET_STAGES.length)
    expect(HERO_FACTS.toolsCount).toBe(BUILTIN_TOOL_COUNT)
    expect(HERO_FACTS.providersCount).toBe(MODEL_PROVIDERS.length)
    expect(HERO_FACTS.localRuntimesCount).toBe(LOCAL_RUNTIMES.length)
    expect(HERO_FACTS.citationCoverage).toBe("100%")
  })

  it("tool groups sum to the exact built-in tool count", () => {
    const sum = TOOL_GROUPS.reduce((acc, g) => acc + g.count, 0)
    expect(sum).toBe(BUILTIN_TOOL_COUNT)
  })

  it("all verbatim quotes exist verbatim in their respective source files", () => {
    for (const q of VERBATIM_QUOTES) {
      const fullPath = nodePath.join(REPO_ROOT, q.source)
      expect(nodeFs.existsSync(fullPath), `Source file ${q.source} must exist`).toBe(true)
      const content = nodeFs.readFileSync(fullPath, "utf-8")
      expect(
        content.includes(q.quote),
        `Quote "${q.quote}" must exist verbatim in ${q.source}`
      ).toBe(true)
    }
  })

  it("literal fence: no hardcoded product claim numbers in landing JSX copy, index.html, or app.html", () => {
    const subdirs = ["components", "scenes"]
    const trackedClaimNumerals = new Set(["8", "10", "11", "13", "29"])

    // Match text nodes between > and <
    const textNodeRegex = />([^<]+)</g

    const scanFile = (filePath: string, fileName: string) => {
      const content = nodeFs.readFileSync(filePath, "utf-8")
      let match: RegExpExecArray | null
      while ((match = textNodeRegex.exec(content)) !== null) {
        const text = match[1].trim()
        if (!text || text.startsWith("{/*") || text.startsWith("{")) continue

        // Tokenize words
        const words = text.split(/\s+/)
        for (const word of words) {
          const clean = word.trim()
          // Match only tokens that are entirely digits to avoid false-positives on 'v1.0' or '$10k'
          if (/^\d+$/.test(clean) && trackedClaimNumerals.has(clean)) {
            expect.fail(
              `Found hardcoded claim number "${clean}" in ${fileName}: "${text}". Import from facts.ts instead.`
            )
          }
        }
      }
    }

    // 1. Scan components and scenes
    for (const subdir of subdirs) {
      const dirPath = nodePath.join(LANDING_DIR, subdir)
      if (!nodeFs.existsSync(dirPath)) continue

      const files = nodeFs.readdirSync(dirPath).filter((f: string) => f.endsWith(".tsx") && !f.includes(".test."))
      for (const file of files) {
        scanFile(nodePath.join(dirPath, file), file)
      }
    }

    // 2. Scan index.html and app.html
    const frontendDir = nodePath.resolve(LANDING_DIR, "..", "..")
    for (const htmlFile of ["index.html", "app.html"]) {
      const htmlPath = nodePath.join(frontendDir, htmlFile)
      if (nodeFs.existsSync(htmlPath)) {
        scanFile(htmlPath, htmlFile)
      }
    }
  })
})
