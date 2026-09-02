import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
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

describe("Landing Page Facts (SEED-241 / D-226-04 / F-2)", () => {
  it("exports authoritative counts measured at HEAD", () => {
    expect(MODEL_PROVIDERS).toHaveLength(8)
    expect(LOCAL_RUNTIMES).toHaveLength(2)
    expect(INGEST_FORMATS).toHaveLength(11)
    expect(EXTRACT_CAPABILITIES).toHaveLength(7)
    expect(PRODUCE_FORMATS).toHaveLength(9)
    expect(GAUNTLET_STAGES).toHaveLength(10)
    expect(BUILTIN_TOOL_COUNT).toBe(29)
    expect(CONNECTOR_CATALOG).toHaveLength(13)
    expect(SURFACE_TABS.library).toHaveLength(5)
    expect(SURFACE_TABS.settings).toHaveLength(5)
    expect(SURFACE_TABS.controlRoom).toHaveLength(5)
    expect(SURFACE_TABS.orgAdmin).toHaveLength(7)
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
    const repoRoot = path.resolve(__dirname, "../../../../")

    for (const q of VERBATIM_QUOTES) {
      const fullPath = path.join(repoRoot, q.source)
      expect(fs.existsSync(fullPath), `Source file ${q.source} must exist`).toBe(true)
      const content = fs.readFileSync(fullPath, "utf-8")
      expect(
        content.includes(q.quote),
        `Quote "${q.quote}" must exist verbatim in ${q.source}`
      ).toBe(true)
    }
  })

  it("JSX text-node fence: no hardcoded product claim numbers in landing JSX copy", () => {
    const landingDir = path.resolve(__dirname, "..")
    const subdirs = ["components", "scenes"]
    const trackedClaimNumerals = new Set(["8", "10", "11", "13", "29"])

    // Match text nodes between > and <
    const textNodeRegex = />([^<]+)</g

    for (const subdir of subdirs) {
      const dirPath = path.join(landingDir, subdir)
      if (!fs.existsSync(dirPath)) continue

      const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".tsx") && !f.includes(".test."))
      for (const file of files) {
        const fullPath = path.join(dirPath, file)
        const content = fs.readFileSync(fullPath, "utf-8")

        let match: RegExpExecArray | null
        while ((match = textNodeRegex.exec(content)) !== null) {
          const text = match[1].trim()
          if (!text || text.startsWith("{/*") || text.startsWith("{")) continue

          // Tokenize words
          const words = text.split(/\s+/)
          for (const word of words) {
            const clean = word.replace(/[^0-9]/g, "")
            if (trackedClaimNumerals.has(clean)) {
              // Fail if a claim number is written directly as text instead of imported from facts
              expect.fail(
                `Found hardcoded claim number "${clean}" in ${file}: "${text}". Import from facts.ts instead.`
              )
            }
          }
        }
      }
    }
  })
})
