import { describe, it, expect } from "vitest"
import fs from "node:fs"

// CR-01 regression fence: every count the panel derives per-document must be
// cleared when doc.id changes, because a COLLAPSED PanelSection never remounts
// to correct a stale badge.
describe("CR-01 · the per-document reset covers every derived count", () => {
  const src = fs.readFileSync("src/components/metadata/DocumentDetailPanel.tsx", "utf8")
  // Strip comments so a prose mention of a setter cannot satisfy this fence
  // (this phase measured that trap five times).
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

  const setters = [...code.matchAll(/const \[\w+, (set\w+)\] = useState<number \| null>/g)].map(m => m[1])
  const resetBlock = (code.match(/useEffect\(\(\) => \{([\s\S]*?)\}, \[doc\.id\]\)/) || ["", ""])[1]

  it("non-vacuity: the setters and the reset block were actually found", () => {
    expect(setters.length).toBeGreaterThan(3)
    expect(resetBlock.length).toBeGreaterThan(0)
  })

  it("every number|null count setter is reset on doc.id change", () => {
    const missing = setters.filter(s => !resetBlock.includes(`${s}(null)`))
    expect(missing).toEqual([])
  })
})
