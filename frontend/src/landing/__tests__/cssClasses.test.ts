import { describe, it, expect, vi } from "vitest"

const nodeFs = await vi.importActual<any>("node:fs")
const nodePath = await vi.importActual<any>("node:path")

describe("CSS Class Coverage Fence (BUS-081 Item 15)", () => {
  const LANDING_DIR = (() => {
    const here = decodeURIComponent(import.meta.url).replace(/^file:\/\/\/?/, "")
    const marker = "/src/landing/__tests__/"
    const at = here.indexOf(marker)
    if (at === -1) throw new Error(`cannot locate landing dir in: ${here}`)
    return `${here.slice(0, at)}/src/landing`
  })()
  const FRONTEND_SRC = nodePath.resolve(LANDING_DIR, "..")

  // Read CSS files and collect all defined class names
  const cssFiles = [
    nodePath.join(LANDING_DIR, "landing.css"),
    nodePath.join(LANDING_DIR, "scenes", "scenes.css"),
    nodePath.join(FRONTEND_SRC, "index.css"),
  ]

  const definedClasses = new Set<string>()

  for (const cssFile of cssFiles) {
    if (nodeFs.existsSync(cssFile)) {
      const content = nodeFs.readFileSync(cssFile, "utf-8")
      // Extract class selectors (e.g. .ucviz, .apptile, .pip)
      const matches = content.matchAll(/\.([a-zA-Z0-9_-]+)/g)
      for (const m of matches) {
        definedClasses.add(m[1])
      }
    }
  }

  // Explicitly allow-listed classes (scene hook anchors, sample data anchors, Tailwind utilities)
  const SCENE_HOOK_ANCHORS = new Set<string>([
    "sc-chat",
    "sc-cx",
    "sc-cr",
    "sc-lib",
    "sc-org",
    "sc-st",
    "sc-sk",
    "sc-wf",
    "w-pips",
    "r-vitals",
    "mock-scene-hide",
    "page-root",
  ])

  // Predicate to check if a token is a standard Tailwind CSS utility
  function isTailwindUtility(token: string): boolean {
    if (token.startsWith("text-") || token.startsWith("bg-") || token.startsWith("border-")) return true
    if (token.startsWith("font-") || token.startsWith("tracking-") || token.startsWith("leading-")) return true
    if (token.startsWith("p-") || token.startsWith("px-") || token.startsWith("py-")) return true
    if (token.startsWith("m-") || token.startsWith("mx-") || token.startsWith("my-")) return true
    if (token.startsWith("w-") || token.startsWith("h-") || token.startsWith("min-") || token.startsWith("max-")) return true
    if (token.startsWith("flex") || token.startsWith("grid") || token.startsWith("gap-")) return true
    if (token.startsWith("rounded") || token.startsWith("shadow") || token.startsWith("opacity-")) return true
    if (token.startsWith("space-") || token.startsWith("items-") || token.startsWith("justify-")) return true
    if (token === "antialiased" || token === "relative" || token === "absolute" || token === "hidden") return true
    if (token.includes(":")) return true // Tailwind variant prefixes like hover:, selection:
    return false
  }

  it("every className token in src/landing matches a rule in landing.css, scenes.css, or index.css", () => {
    const unstyledClasses: { file: string; token: string }[] = []

    function walkDir(dir: string) {
      const entries = nodeFs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = nodePath.join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name !== "__tests__" && entry.name !== "node_modules") {
            walkDir(fullPath)
          }
        } else if (entry.isFile() && entry.name.endsWith(".tsx") && !entry.name.includes(".test.")) {
          const content = nodeFs.readFileSync(fullPath, "utf-8")

          // Match className="..." and className={`...`} and className={'...'}
          const classAttrRegex = /className=(?:["']([^"']+)["']|\{`([^`]+)`\}|\{["']([^"']+)["']\})/g
          let match: RegExpExecArray | null

          while ((match = classAttrRegex.exec(content)) !== null) {
            const rawString = match[1] || match[2] || match[3] || ""
            // Remove JSX interpolation syntax like ${...} to get literal tokens
            const cleaned = rawString.replace(/\$\{[^}]+\}/g, " ")
            const tokens = cleaned.split(/\s+/).filter(Boolean)

            for (const token of tokens) {
              if (
                !definedClasses.has(token) &&
                !SCENE_HOOK_ANCHORS.has(token) &&
                !isTailwindUtility(token)
              ) {
                unstyledClasses.push({ file: nodePath.relative(LANDING_DIR, fullPath), token })
              }
            }
          }
        }
      }
    }

    walkDir(LANDING_DIR)

    if (unstyledClasses.length > 0) {
      const formatted = unstyledClasses
        .map((u) => `  • ${u.file}: className="${u.token}" has no matching rule in CSS`)
        .join("\n")
      expect.fail(`Found ${unstyledClasses.length} unstyled class names in src/landing:\n${formatted}`)
    }

    expect(unstyledClasses).toHaveLength(0)
  })
})
