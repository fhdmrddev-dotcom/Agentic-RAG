import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"

const FORBIDDEN_SUBSTRINGS = [
  "src/lib/api",
  "src/lib/supabase",
  "src/providers",
  "src/hooks/useAuth",
  "src/components/layout",
]

const FORBIDDEN_PACKAGES = [
  "@supabase/supabase-js",
]

function resolveModulePath(currentFile: string, importPath: string): string | null {
  // Ignore virtual or package modules
  if (importPath.startsWith("~icons/") || (!importPath.startsWith(".") && !importPath.startsWith("@/"))) {
    return null
  }

  let resolved = ""
  if (importPath.startsWith("@/")) {
    resolved = path.resolve(__dirname, "../../", importPath.slice(2))
  } else {
    resolved = path.resolve(path.dirname(currentFile), importPath)
  }

  const extensions = [".tsx", ".ts", ".jsx", ".js", "/index.tsx", "/index.ts", "/index.jsx", "/index.js"]
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return resolved
  }

  for (const ext of extensions) {
    const candidate = resolved + ext
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate
    }
  }

  return null
}

function crawlImports(entryFile: string): { visitedFiles: Set<string>; allImports: { from: string; importSpec: string }[] } {
  const visitedFiles = new Set<string>()
  const allImports: { from: string; importSpec: string }[] = []
  const queue: string[] = [entryFile]

  // Match: import ... from "..." or export ... from "..." or import("...")
  const importRegex = /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]|import\(['"]([^'"]+)['"]\)/g

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visitedFiles.has(current)) continue
    visitedFiles.add(current)

    if (!fs.existsSync(current)) continue
    const content = fs.readFileSync(current, "utf-8")

    let match: RegExpExecArray | null
    while ((match = importRegex.exec(content)) !== null) {
      const spec = match[1] || match[2]
      if (!spec) continue
      allImports.push({ from: current, importSpec: spec })

      const resolved = resolveModulePath(current, spec)
      if (resolved && !visitedFiles.has(resolved)) {
        queue.push(resolved)
      }
    }
  }

  return { visitedFiles, allImports }
}

describe("Landing Bundle Fence (SC#1 / D-226-01 / F-3)", () => {
  const landingEntry = path.resolve(__dirname, "../main.tsx")

  it("crawls the transitive dependency graph from src/landing/main.tsx with zero forbidden leaks", () => {
    expect(fs.existsSync(landingEntry)).toBe(true)

    const { visitedFiles, allImports } = crawlImports(landingEntry)

    // Check all visited files
    for (const file of visitedFiles) {
      const normalized = file.replace(/\\/g, "/")
      for (const forbidden of FORBIDDEN_SUBSTRINGS) {
        expect(
          normalized.includes(forbidden),
          `Transitive landing module ${normalized} imports forbidden path ${forbidden}`
        ).toBe(false)
      }
    }

    // Check all import specifiers
    for (const { from, importSpec } of allImports) {
      for (const forbiddenPkg of FORBIDDEN_PACKAGES) {
        expect(
          importSpec === forbiddenPkg,
          `Module ${from} directly imports forbidden package ${forbiddenPkg}`
        ).toBe(false)
      }
      for (const forbidden of FORBIDDEN_SUBSTRINGS) {
        const normalizedSpec = importSpec.replace(/\\/g, "/")
        expect(
          normalizedSpec.includes(forbidden) || normalizedSpec.startsWith("@/" + forbidden.replace("src/", "")),
          `Module ${from} imports forbidden specifier ${importSpec}`
        ).toBe(false)
      }
    }
  })

  it("landing main.tsx mounts without any auth context or stream provider", () => {
    const content = fs.readFileSync(landingEntry, "utf-8")
    expect(content).not.toMatch(/<AuthProvider/i)
    expect(content).not.toMatch(/<StreamsProvider/i)
    expect(content).not.toMatch(/<OrgProvider/i)
    expect(content).not.toMatch(/useAuth/i)
  })
})
