/**
 * SEED-190 — the guard that makes `runLogTone.ts`'s duplication SAFE rather than merely
 * confessed.
 *
 * ⚠ WHY THE DUPLICATION EXISTS AT ALL, and why it could not be extracted in the commit that
 * created it: `library/gutterTokens.fences.test.ts` reads `WorkflowCard.tsx`'s OWN SOURCE,
 * requires it to contain `const GUTTER_TONE` and `const RUN_TONE`, walks each opening brace
 * to its match and pins the exact shape of the bodies it finds (`TONE_SHAPE = { entries: 12,
 * unique: 10, perMap: 6 }`). Extracting those two tables into a shared leaf — the
 * `cardFace.ts` move, and the right one — empties both bodies and reds that fence. That fence
 * exists because `bg-warning` once compiled to NOTHING and shipped unguarded, so it is not a
 * guard to weaken while passing through on other business.
 *
 * ⚠ SO THE MIRROR IS ASSERTED INSTEAD. This file reads BOTH sources and compares the two
 * tables entry for entry. A drift is a failing test here rather than two surfaces quietly
 * disagreeing about what `failed` looks like — the `_AUDIT_EVENT_TYPES` ↔ migration-CHECK
 * lockstep, one layer up.
 *
 * ⚠ IT COMPARES THE CARD'S SOURCE, NOT ITS EXPORTS, and it has to: the card's tables are
 * module-private `const`s with no export, which is precisely the state that forced the copy.
 * The parse is the same walk-to-the-matching-brace the gutter fence performs, and it carries
 * the same protections: a POSITIVE CONTROL proving the parser really finds entries, and a
 * FALSIFICATION proving a planted disagreement is caught. Without both, a regex that silently
 * matched nothing would compare two empty maps and pass forever.
 *
 * ⚠ RE-OPEN TRIGGER, so this does not become permanent: the next phase that touches
 * `gutterTokens.fences.test.ts` or the card's tone maps owes the extraction — one leaf, both
 * consumers, `runLogTone.ts` deleted and this file with it.
 */
import { describe, it, expect } from "vitest"

import cardSource from "@/components/workflows/library/WorkflowCard.tsx?raw"
import { LOG_GUTTER_TONE, LOG_RUN_TONE } from "./runLogTone"

/**
 * Pull one `const <name> = { … }` object body out of a source string and parse its
 * `key: "value"` pairs.
 *
 * ⚠ IT THROWS ON A MISS RATHER THAN RETURNING `{}`. A parser that quietly returned an empty
 * map would turn every comparison below into `{} vs {}` — the vacuous-fence failure this
 * subtree has now met more than once, and the reason `gutterTokens.fences.test.ts` says so in
 * its own header.
 */
function parseToneMap(source: string, name: string): Record<string, string> {
  const open = source.indexOf(`const ${name} = {`)
  if (open === -1) throw new Error(`could not find \`const ${name} = {\` in the card's source`)
  const bodyStart = source.indexOf("{", open)
  let depth = 0
  let end = -1
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1
    else if (source[i] === "}") {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end === -1) throw new Error(`could not carve \`${name}\`'s body — the brace never closed`)

  const body = source.slice(bodyStart + 1, end)
  const out: Record<string, string> = {}
  // `key: "value"` and `"quoted-key": "value"` — the two spellings both maps really use.
  for (const match of body.matchAll(/(?:"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*"([^"]*)"/g)) {
    out[match[1] ?? match[2]] = match[3]
  }
  if (Object.keys(out).length === 0) {
    throw new Error(`parsed \`${name}\` and found no entries — the parser, not the map, moved`)
  }
  return out
}

describe("runLogTone — the parser can actually see the card's tables (positive control)", () => {
  it("the card's source is real and non-trivial", () => {
    // Without this a `?raw` import that silently resolved to nothing would satisfy everything
    // below, because a throw-on-empty parser never runs on a haystack that was never read.
    expect(cardSource.length).toBeGreaterThan(1000)
    expect(cardSource).toContain("const GUTTER_TONE")
    expect(cardSource).toContain("const RUN_TONE")
  })

  it("it parses SIX entries out of each of the card's two maps", () => {
    // Six is the card's own arm count and `gutterTokens.fences.test.ts` pins it as
    // `TONE_SHAPE.perMap`. A parser reading five would be silently comparing a subset.
    expect(Object.keys(parseToneMap(cardSource, "GUTTER_TONE"))).toHaveLength(6)
    expect(Object.keys(parseToneMap(cardSource, "RUN_TONE"))).toHaveLength(6)
  })

  it("a name that is not there THROWS, rather than yielding an empty map", () => {
    expect(() => parseToneMap(cardSource, "NO_SUCH_TONE_MAP")).toThrow()
  })

  it("a map with no string entries THROWS — the vacuity guard, driven", () => {
    expect(() => parseToneMap("const EMPTY_TONE = {\n} as const", "EMPTY_TONE")).toThrow(
      /found no entries/,
    )
  })
})

describe("runLogTone — the log's tables MIRROR the card's, entry for entry", () => {
  it("the fill table agrees", () => {
    expect({ ...LOG_GUTTER_TONE }).toEqual(parseToneMap(cardSource, "GUTTER_TONE"))
  })

  it("the word-colour table agrees", () => {
    expect({ ...LOG_RUN_TONE }).toEqual(parseToneMap(cardSource, "RUN_TONE"))
  })

  it("both tables cover the SAME six arms, so a new arm cannot get a fill and lose a word", () => {
    // The card's own `RUN_TONE` docblock states this invariant in prose; this is the log's
    // half of it, asserted.
    expect(Object.keys(LOG_GUTTER_TONE).sort()).toEqual(Object.keys(LOG_RUN_TONE).sort())
  })

  it("FALSIFICATION — a planted disagreement is caught", () => {
    // ⚠ WITHOUT THIS THE THREE CASES ABOVE ARE UNFALSIFIED. It proves the comparison is
    // sensitive to a single changed utility, which is the only kind of drift that would
    // realistically happen: somebody re-tones `failed` on the card and not here.
    const drifted = { ...LOG_GUTTER_TONE, failed: "bg-destructive/70" }
    expect(drifted).not.toEqual(parseToneMap(cardSource, "GUTTER_TONE"))
  })

  it("`unknown` is UNPAINTED on both — no mark for no information", () => {
    // The one arm whose value is load-bearing rather than merely matching: a grey bar there
    // would make *the wire did not say* look like a fact we hold.
    expect(LOG_GUTTER_TONE.unknown).toBe("bg-transparent")
  })

  it("`not-by-you` takes NO outcome colour on either table", () => {
    // DEC-11-C: the caller has no outcome to report, so a success/failure/warning colour there
    // would be a fabricated one.
    for (const value of [LOG_GUTTER_TONE["not-by-you"], LOG_RUN_TONE["not-by-you"]]) {
      expect(value).not.toContain("success")
      expect(value).not.toContain("destructive")
      expect(value).not.toContain("warning")
    }
  })
})
