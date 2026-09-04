#!/usr/bin/env node
/**
 * ⭐ THE DRIVE SCRIPT — Phase 213 sketch.
 *
 * ⚠ ITS ASSERTIONS **ARE** THE BUILD CONTRACT, IN EXECUTABLE FORM. `feedback_sketch_to_build_drift`
 * records the cause of drift four times over and it is mechanical, never carelessness: a sketch is
 * HTML/CSS, the build is React + Tailwind + shadcn, **nothing transfers automatically**, and prose
 * does not typecheck. So the invariants that matter are asserted here, and `README.md` maps each one
 * to the React equivalent Phase 213's own suite must reproduce.
 *
 *   node drive.cjs           run the assertions
 *   node drive.cjs --emit    ALSO write BUILD-CONTRACT.generated.md FROM the running sketch
 *
 * ⚠ The contract is GENERATED, never transcribed — that is what stops it going stale by being
 * forgotten. Do not hand-edit `BUILD-CONTRACT.generated.md`.
 *
 * No dependencies: regex over the source, deliberately. A DOM library would be a second thing to
 * install before anyone can check the sketch, and every invariant below is a textual fact.
 */

const fs = require("fs")
const path = require("path")

const DIR = __dirname
const HTML = fs.readFileSync(path.join(DIR, "index.html"), "utf8")
const { COPY } = require(path.join(DIR, "COPY.js"))

let pass = 0
const failures = []
function ok(name, cond, detail) {
  if (cond) { pass++; return }
  failures.push(detail ? `${name}\n      ${detail}` : name)
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 · THE SKETCH RENDERS NOTHING NOT DECLARED IN `COPY.js`
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ THE DIRECTION THAT MATTERS IS COPY -> HTML. Asserting the reverse would only prove the
// table is big enough; this proves the sketch did not invent a sentence the build cannot import.
const literals = Object.entries(COPY).filter(([, v]) => typeof v === "string")
for (const [key, value] of literals) {
  ok(`COPY.${key} appears in the sketch`, HTML.includes(value), `missing: "${value}"`)
}

// The composed strings, each with a worked example — the build must reproduce the FUNCTION,
// not the rendered instance, so both are recorded.
const composed = [
  ["SEARCH_PLACEHOLDER", COPY.SEARCH_PLACEHOLDER(44)],
  ["ASK_ALWAYS", COPY.ASK_ALWAYS("create_pull_request")],
  ["ASK_ARGS_MORE", COPY.ASK_ARGS_MORE(9)],
  ["REFUSED_HEADLINE", COPY.REFUSED_HEADLINE("delete_repository")],
  ["REFUSED_BECAUSE_DENIED", COPY.REFUSED_BECAUSE_DENIED("delete_repository")],
]
// ⚠ BOTH SIDES ARE TAG-STRIPPED, and the first draft of this check stripped only ONE.
// The sketch renders `Always allow <span class="mono">create_pull_request</span> on this
// connection` — a tag splits the sentence, so a raw `HTML.includes()` of the composed string
// fails on copy that is perfectly correct. Comparing rendered TEXT to rendered TEXT is the
// property actually wanted; comparing source markup to a plain string never was.
// ⚠ AND THE USER-VISIBLE ATTRIBUTES ARE APPENDED, because stripping tags erases them and they
// are COPY. `placeholder="Search 44 actions"` is a sentence a person reads; so is `aria-label`.
// The second draft of this matcher failed on exactly that — a copy table that cannot see
// placeholder text is blind to a whole class of user-facing strings, which is worse than the
// tag-splitting bug it had just fixed.
const ATTR_COPY = [...HTML.matchAll(/(?:placeholder|aria-label)="([^"]*)"/g)].map((m) => m[1]).join(" | ")
const TEXT = (HTML.replace(/<[^>]+>/g, " ") + " | " + ATTR_COPY).replace(/\s+/g, " ")
for (const [key, rendered] of composed) {
  const stripped = rendered.replace(/<\/?[a-z][^>]*>/g, "").replace(/\s+/g, " ").trim()
  ok(`COPY.${key}() renders`, TEXT.includes(stripped), `looked for: "${stripped}"`)
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 · ⭐ THE OVERRIDE EDGE IS ONE COLOUR, AND IT IS THE PRIMARY
// ═══════════════════════════════════════════════════════════════════════════════════════
// This is the sketch's deliberate DEPARTURE from Stitch and the single most portable decision
// in the file, so it is asserted three ways rather than described once.
const overriddenRule = /\.arow\.overridden\s*\{([^}]*)\}/.exec(HTML)
ok("`.arow.overridden` exists", !!overriddenRule)
if (overriddenRule) {
  const body = overriddenRule[1]
  ok(
    "the override edge is --primary",
    /border-left-color:\s*hsl\(var\(--primary\)\)/.test(body),
    body.trim(),
  )
  ok(
    "the override tint is --primary at low alpha",
    /background:\s*hsl\(var\(--primary\)\s*\/\s*\.0?\d+\)/.test(body),
    body.trim(),
  )
  ok(
    "the override rule spends NO state colour",
    !/--success|--destructive|--warning/.test(body),
    body.trim(),
  )
}

// ⚠ THE EDGE LANE IS ALWAYS RESERVED. If `.arow` had no transparent border-left, toggling a row
// between inherited and overridden would shift its text by 2px — a jitter no test would catch
// and every scrolling eye would.
const arowRule = /\.arow\s*\{([^}]*)\}/.exec(HTML)
ok(
  "`.arow` reserves the edge lane with a transparent border",
  arowRule && /border-left:\s*2px solid transparent/.test(arowRule[1]),
)

// A row marked overridden must ALSO carry the words. Colour is never the only carrier.
const overriddenRows = (HTML.match(/class="arow overridden"/g) || []).length
const mineTags = (HTML.match(/class="tag mine"/g) || []).length
ok("at least three overridden rows are demonstrated", overriddenRows >= 3, `found ${overriddenRows}`)
ok(
  "every overridden row in section 1 says its word",
  mineTags >= 2,
  `"${COPY.OVERRIDDEN_LABEL}" tags found: ${mineTags}`,
)

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 · THE THREE-WAY CONTROL — THREE ARMS, NEVER TWO
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ A CHECKBOX CANNOT EXPRESS THIS, and that is the whole reason Phase 213 exists rather than
// being a `tool_grants` boolean edit. Asserted structurally so a build that "simplifies" it to a
// switch fails here first.
const segGroups = HTML.split(/<div class="seg"/).slice(1)
ok("the three-way control is used at least six times", segGroups.length >= 6, `found ${segGroups.length}`)
let allThree = true
let exactlyOnePressed = true
for (const g of segGroups) {
  const chunk = g.slice(0, g.indexOf("</div>"))
  const buttons = (chunk.match(/<button/g) || []).length
  if (buttons !== 3) allThree = false
  const pressed = (chunk.match(/aria-pressed="true"/g) || []).length
  if (pressed !== 1) exactlyOnePressed = false
}
ok("every control has exactly three arms", allThree)
ok("exactly one arm is chosen per control", exactlyOnePressed)
ok(`the arms are "${COPY.POSTURE_ALLOW}" / "${COPY.POSTURE_ASK}" / "${COPY.POSTURE_DENY}"`,
  HTML.includes(`>${COPY.POSTURE_ALLOW}<`) &&
  HTML.includes(`>${COPY.POSTURE_ASK}<`) &&
  HTML.includes(`>${COPY.POSTURE_DENY}<`))

// ⚠ DENY DOES NOT WEAR THE ACCENT. A refusal rendered in the primary colour is what makes a
// person mis-click it while scanning 44 rows.
ok(
  "the chosen Deny arm uses --destructive, not --primary",
  /\.seg button\.deny\[aria-pressed="true"\]\s*\{[^}]*--destructive/.test(HTML),
)

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 · THE PANEL WIDTH — D-27 HELD, WIDENED, AND THE CLAMP IS A HOUSE PATTERN
// ═══════════════════════════════════════════════════════════════════════════════════════
const splitRule = /\.split\s*\{([^}]*)\}/.exec(HTML)
ok("`.split` exists", !!splitRule)
if (splitRule) {
  ok(
    "the panel track is a clamp, not a fixed pixel width",
    /grid-template-columns:\s*minmax\(0,1fr\)\s*clamp\(\s*480px\s*,\s*38%\s*,\s*640px\s*\)/.test(splitRule[1]),
    splitRule[1].trim(),
  )
  ok("the shipped 400px is gone", !/\b400px\b/.test(splitRule[1]))
}
// ⚠ D-27's PROTECTED PROPERTY, ASSERTED RATHER THAN ASSUMED: the connections list is still
// really there and really readable beside the open panel. This is the only reason A beat B.
ok("the list beside the panel renders real rows", (HTML.match(/class="conn-row/g) || []).length >= 5)
ok("the open connection is marked in the list", HTML.includes("conn-row is-open"))

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5 · HONESTY RULES — the ones this surface can actually break
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ DIRECTION HAS THREE ARMS. `readOnlyHint` was measured ABSENT in the wild; a hint from an
// untrusted server may never widen a permission, so an undeclared direction says "Unknown".
ok(`"${COPY.DIRECTION_UNKNOWN}" is demonstrated`, HTML.includes(COPY.DIRECTION_UNKNOWN))
ok("the unknown direction explains itself in real DOM text", HTML.includes(COPY.DIRECTION_UNKNOWN_HELP))

// ⚠ NO FABRICATED NUMBER. There is no progress signal in this product and a person's decision
// time is unknowable, so a countdown on the ask moment would be invented.
//
// ⚠ SCOPED TO THE COMPONENT, NOT THE DOCUMENT — and the first draft was not, so it FAILED on
// this sketch's own caption, which contains the sentence "No countdown — how long a person
// takes is unknowable." **A fence that fires on the prose explaining the fence is measuring the
// annotation instead of the surface.** Recorded rather than quietly widened: the fix is to
// narrow the SCOPE, never to soften the pattern.
const askBlock = /<div class="ask">([\s\S]*?)\n<\/section>/.exec(HTML)
ok("the ask component is findable", !!askBlock)
ok("no countdown / timer / progress inside the ask component",
  !!askBlock && !/countdown|expires in|seconds remaining|<progress|role="progressbar"/i.test(askBlock[1]))

// ⚠ NO `title` ATTRIBUTE ANYWHERE. The shipped panel asserts ZERO `[title]` nodes in its output
// (§12 / the 184-07 lesson), so a mark that needs a hover to be understood is unavailable here
// BY CONTRACT — which is precisely why the override edge also carries a word.
ok("no `title` attribute is used as an affordance", !/\stitle="/.test(HTML))

// ⚠ DENY IS FULL-SIZE AND BESIDE APPROVE, never a small grey link.
ok("Deny is a real button", /class="btn deny"/.test(HTML))
ok("Approve is a real button", /class="btn primary"/.test(HTML))
ok("the standing-change option says it is standing", HTML.includes(COPY.ASK_ALWAYS_NOTE))

// ⚠ THE REFUSAL NAMES ITS GRANT.
ok("the refusal names the next action", HTML.includes(COPY.REFUSED_NEXT))

// ═══════════════════════════════════════════════════════════════════════════════════════
// 6 · TOKENS — every colour comes from index.css, none is re-picked by eye
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ THIS IS WHAT SEPARATES THIS FILE FROM THE STITCH PASS. Stitch invented a palette in the
// right spirit; a sketch that hand-picks hex values is a drawing, not an acceptance bar.
const rawHex = (HTML.match(/#[0-9a-fA-F]{6}\b/g) || []).filter((h) => h.toLowerCase() !== "#fff")
const ALLOWED_RAW = new Set(["#ffffff"])
const strays = rawHex.filter((h) => !ALLOWED_RAW.has(h.toLowerCase()))
ok(
  "no stray hex colours — everything is hsl(var(--token))",
  strays.length === 0,
  strays.length ? `stray: ${[...new Set(strays)].join(", ")}` : "",
)

const TOKENS_FROM_INDEX_CSS = [
  "--background", "--foreground", "--card", "--primary", "--primary-foreground",
  "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
  "--destructive", "--warning", "--success", "--border",
]
for (const t of TOKENS_FROM_INDEX_CSS) {
  ok(`token ${t} is declared`, new RegExp(`${t}:`).test(HTML))
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════════════════════════════
console.log(`\n  sketch 213 — ${pass} passed, ${failures.length} failed\n`)
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`)
  console.log("")
  process.exit(1)
}
console.log("  sketch 213 drive OK — every invariant holds.\n")

// ── --emit ─────────────────────────────────────────────────────────────────────────────
if (process.argv.includes("--emit")) {
  // ⚠ THE LOOKAHEAD IS LOAD-BEARING. Splitting on the bare `<div class="arow` also split on
  // `arow-main`, `arow-name`, `arow-desc` and `arow-tags`, shredding every row into fragments
  // that matched no field — and the emitted table came out EMPTY while the script reported
  // success. **A generated contract that generates NOTHING is worse than a transcribed one,
  // because it looks generated.** `(?=["\s])` admits `arow"` and `arow ` and rejects `arow-`.
  // ⚠ SCOPED TO SECTION 1. Section 4 draws the Stitch-vs-this comparison out of the same
  // `.arow` class, and those rows are ILLUSTRATION with no control and no tags. Emitting them
  // put twelve rows of `— | —` into the contract, which reads as twelve shapes the build owes.
  // A contract must describe the surface, never the argument for the surface.
  const listOnly = HTML.slice(0, HTML.indexOf('<h2>2 '))
  const rows = listOnly.split(/<div class="arow(?=["\s])/).slice(1).map((chunk) => {
    const name = /class="arow-name mono">([^<]+)</.exec(chunk)
    const desc = /class="arow-desc">([^<]+)</.exec(chunk)
    const tags = [...chunk.matchAll(/class="tag[^"]*">([^<]+)</g)].map((m) => m[1])
    const chosen = /<button[^>]*aria-pressed="true"[^>]*>([^<]+)</.exec(chunk)
    return {
      overridden: chunk.startsWith(" overridden"),
      name: name ? name[1] : "—",
      desc: desc ? desc[1] : "",
      tags,
      posture: chosen ? chosen[1] : "—",
    }
  }).filter((r) => r.name !== "—")

  // ⚠ THE EMITTER GETS ITS OWN NON-VACUITY GUARD, because it HAD just produced an empty table
  // while reporting success. The drive assertions all passed; only a human reading the output
  // noticed the table had no rows. A contract nobody can tell is empty is not a contract — the
  // same lesson as a fence that cannot fire, one layer over.
  if (rows.length < 6) {
    console.log(`  emit ABORTED - parsed only ${rows.length} action rows, expected >= 6.`)
    console.log("  The row parser is broken; fix it rather than shipping an empty contract.\n")
    process.exit(1)
  }

  const out = `# BUILD CONTRACT — Phase 213 sketch (GENERATED)

⚠ **GENERATED BY \`drive.cjs --emit\` FROM THE RUNNING SKETCH. DO NOT HAND-EDIT.**
Re-emit after any change to \`index.html\` or \`COPY.js\`; a transcribed contract goes stale by
being forgotten, which is the whole reason this file is generated rather than written.

Generated from the sketch at **${rows.length}** rendered action rows.

## 1 · Exact strings — the build IMPORTS these, it does not retype them

Port \`COPY.js\` to \`frontend/src/components/settings/grantsVocabulary.ts\` and import it. Every
string below is asserted present in the sketch by \`drive.cjs\`.

${literals.map(([k, v]) => `- \`${k}\` — ${JSON.stringify(v)}`).join("\n")}

### Composed strings, with worked examples

${composed.map(([k, r]) => `- \`${k}(...)\` → ${JSON.stringify(r)}`).join("\n")}

## 2 · Rendered output, per distinct row shape

| overridden | action | posture | tags |
|---|---|---|---|
${rows.map((r) => `| ${r.overridden ? "**yes**" : "no"} | \`${r.name}\` | ${r.posture} | ${r.tags.join(" · ") || "—"} |`).join("\n")}

## 3 · Measured invariants the React suite must reproduce

| # | invariant | React equivalent |
|---|---|---|
| 1 | the override edge is \`--primary\`, and the rule spends **no** state colour | assert the overridden row's class list contains the primary edge token and none of success/destructive/warning |
| 2 | \`.arow\` reserves a 2px transparent edge lane | assert an inherited row and an overridden row have **identical** text offsets |
| 3 | every posture control has **exactly three** arms, exactly one pressed | \`getAllByRole("button", {pressed: true})\` is length 1 per group |
| 4 | the chosen Deny arm uses \`--destructive\`, never \`--primary\` | assert the pressed Deny arm's token |
| 5 | the panel track is \`clamp(480px,38%,640px)\` | assert \`gridTemplateColumns\` on \`connections-split\` — the shipped test already pins \`400px\` at \`ConnectionFormPanel.test.tsx:571\` and **must be updated in the same commit** |
| 6 | the connections list renders ≥5 real rows beside the open panel | D-27's protected property, asserted not assumed |
| 7 | an unknown direction says **"${COPY.DIRECTION_UNKNOWN}"** and explains itself in real DOM text | never infer a read from an absent \`readOnlyHint\` |
| 8 | **zero** \`[title]\` attributes in the rendered output | the shipped §12 fence, already asserted in \`ConnectionFormPanel.test.tsx\` |
| 9 | no countdown / timer / progressbar on the ask moment | a person's decision time is unknowable |
| 10 | every overridden row also carries the words "${COPY.OVERRIDDEN_LABEL}" | colour is never the only carrier |

## 4 · ⚠ What this contract CANNOT catch

Pixel spacing, Tailwind class choices, hover and focus states. Those stay a human comparison — so
**every G-4 UAT row must name this sketch file as its reference** and be driven by looking, never by
\`getElementById\` on a known id.
`
  fs.writeFileSync(path.join(DIR, "BUILD-CONTRACT.generated.md"), out)
  console.log("  wrote BUILD-CONTRACT.generated.md\n")
}
