/**
 * v4.3 audit (257 SC#3 / METER-02) — the frontend never converts tokens to dollars.
 *
 * The one conversion home is backend `pricing_service.py` (Python + its generated SQL
 * spelling). The backend fence walks `backend/app/` only; 257-REVIEW F-3 recorded that a
 * frontend conversion would trip nothing. The UI must RENDER `cost_usd` the server computed,
 * never derive one. This fence reads every non-test source file as text and fails on
 * rate-per-million arithmetic, or a one-million divisor on a line that talks about money.
 * (A token COUNT rendered as "1.2M" is not money and is not flagged.)
 */
import { describe, expect, it } from "vitest"

const SOURCES = import.meta.glob(["/src/**/*.{ts,tsx}", "!/src/**/*.test.{ts,tsx}", "!/src/**/__tests__/**"], {
  query: "?raw", import: "default", eager: true,
}) as Record<string, string>

const RATE_ARITH = /(per_?million|PerMillion)\w*\s*[/*]|[/*]\s*\w*(per_?million|PerMillion)/
const MILLION_DIVISOR = /\/\s*1_?000_?000(\.0+)?\b|\*\s*1e-6\b|\/\s*1e6\b/
const MONEY = /\b\w*(usd|USD|Usd|cost|Cost|price|Price|rate|Rate|dollar|Dollar)\w*\b/

export function findConversions(files: Record<string, string>): string[] {
  const hits: string[] = []
  for (const [path, text] of Object.entries(files)) {
    text.split("\n").forEach((line, i) => {
      if (RATE_ARITH.test(line) || (MILLION_DIVISOR.test(line) && MONEY.test(line))) {
        hits.push(`${path}:${i + 1}: ${line.trim()}`)
      }
    })
  }
  return hits
}

describe("no token->USD conversion in the frontend", () => {
  it("reads a non-trivial source set (non-vacuity)", () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(200)
  })
  it("fires on a planted conversion and ignores a token-count format", () => {
    expect(findConversions({ "p.ts": "const usd = tokens * inputCostPerMillion / 1_000_000" })).toHaveLength(1)
    expect(findConversions({ "p.ts": "const c = (t * r.input_cost_per_million) / 1e6" })).toHaveLength(1)
    expect(findConversions({ "p.ts": "`${(totalTokens / 1_000_000).toFixed(2)}M`" })).toHaveLength(0)
  })
  it("the real tree has none", () => {
    expect(findConversions(SOURCES)).toEqual([])
  })
})
