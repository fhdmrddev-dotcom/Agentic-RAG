#!/usr/bin/env node
/**
 * ⭐ THE DRIVE SCRIPT — sketch 215, Phase 214 (STEP-03 / SC#3).
 *
 * ⚠ ITS ASSERTIONS **ARE** THE BUILD CONTRACT, IN EXECUTABLE FORM. A sketch is HTML/CSS, the
 * build is React + Tailwind + shadcn, nothing transfers automatically, and prose does not
 * typecheck.
 *
 *   node drive.cjs           run the assertions
 *   node drive.cjs --emit    ALSO write BUILD-CONTRACT.generated.md FROM the running sketch
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

const ATTR = [...HTML.matchAll(/(?:placeholder|aria-label|value)="([^"]*)"/g)].map((m) => m[1]).join(" | ")
/**
 * ⚠ TAG-STRIPPING INSERTS A SPACE WHERE A TAG WAS, AND THE SENTENCES HERE PUT TAGS *INSIDE*
 * QUOTATION MARKS — `“<span class="qs">Email the weekly summary</span>”` strips to
 * `“ Email the weekly summary ”`, so a raw `includes()` of the composed string fails on copy
 * that is perfectly correct. Comparing rendered TEXT to rendered TEXT is the property actually
 * wanted; comparing source markup to a plain string never was.
 *
 * `norm` closes the space a stripped tag opened against the punctuation it sat beside.
 * ⚠ IT RUNS ON BOTH SIDES. Normalising only one is 213's measured first-draft bug.
 */
function norm(s) {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/([“(])\s+/g, "$1")
    .replace(/\s+([”).,;:])/g, "$1")
    .trim()
}
const TEXT = norm(HTML + " | " + ATTR)

// ⚠ THE SURFACE IS THE SKETCH MINUS ITS OWN ANNOTATION. This sketch quotes the very sentences
// it is cutting (§3 shows them struck through), so a fence over the whole document would fire on
// the exhibit rather than on the product. `data-anno` marks annotation; §3's struck-through
// demos are marked by class instead, because they are DELIBERATE NEGATIVE EXHIBITS.
const SURFACE_HTML = HTML
  .replace(/<(style|script)[\s\S]*?<\/\1>/g, " ")
  .replace(/<div id="variant-nav"[\s\S]*?<\/div>\s*(?=<!--)/, " ")
  .replace(/<(h2|h3|p|div|span)\b[^>]*\bdata-anno\b[^>]*>[\s\S]*?<\/\1>/g, " ")
  .replace(/<section id="variant-cuts"[\s\S]*?<\/section>/, " ")
const SURFACE = SURFACE_HTML.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

// A stripper is a thing that can silently remove everything.
ok("positive control — the surface is not empty", SURFACE.length > 1200, `${SURFACE.length} chars`)
ok("positive control — the surface still carries a refusal", SURFACE.includes("Email the weekly summary"))
ok("positive control — §3's negative exhibits are out of the surface", !SURFACE.includes("Publication blocked"))

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 · COPY -> HTML. The sketch invented no sentence the build cannot import.
// ═══════════════════════════════════════════════════════════════════════════════════════
const literals = Object.entries(COPY).filter(([, v]) => typeof v === "string")
for (const [k, v] of literals) ok(`COPY.${k} appears`, TEXT.includes(v), `missing: "${v}"`)

const REFUSALS = [
  ["REFUSE_NO_SOURCE", COPY.REFUSE_NO_SOURCE("Email the weekly summary", "to"), "no-source"],
  ["REFUSE_ASK_UNDECLARED", COPY.REFUSE_ASK_UNDECLARED("File the escalation", "summary"), "ask-undeclared"],
  ["REFUSE_UPSTREAM_UNREACHABLE", COPY.REFUSE_UPSTREAM_UNREACHABLE("Post the digest", "text", "Score the sentiment"), "upstream-unreachable"],
  ["REFUSE_SHAPE_UNKNOWN", COPY.REFUSE_SHAPE_UNKNOWN("Open the pull request"), "shape-unknown"],
  ["REFUSE_UNRENDERABLE", COPY.REFUSE_UNRENDERABLE("Commit the changelog", "files"), "unrenderable"],
]
for (const [key, rendered] of REFUSALS) {
  ok(`COPY.${key}() renders`, TEXT.includes(norm(rendered)), `looked for: "${norm(rendered)}"`)
}
ok("COPY.REFUSE_COUNT_MANY() renders", TEXT.includes(COPY.REFUSE_COUNT_MANY(2)))
ok("COPY.REFUSE_REST_OK() renders", TEXT.includes(COPY.REFUSE_REST_OK(4)))

// ⚠ EVERY DASH IS AN EM DASH — the `doorVocabulary.test.ts` rule, inherited.
for (const [k, v] of literals) ok(`COPY.${k} uses no hyphen-as-dash`, !/ - /.test(v), `in: "${v}"`)

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 · ⭐ THE REFUSAL CONTRACT — EVERY ONE NAMES THE STEP, THE ARGUMENT, AND A NEXT ACTION
// ═══════════════════════════════════════════════════════════════════════════════════════
// D-214-09: *"refused, naming the step and the argument."*
// The ROADMAP: ***a refusal is only honest if it names the next action.***
const items = [...SURFACE_HTML.matchAll(/<div class="ritem"[^>]*data-kind="([^"]*)"[^>]*>([\s\S]*?)(?=<div class="ritem"|<\/div>\s*<div class="gauntlet"|<\/div>\s*<div class="refusal-foot")/g)]
ok("refusal items are rendered", items.length >= 7, `found ${items.length}`)
for (const [, kind, body] of items) {
  // ⚠ THE STEP IS NAMED IN THE AUTHOR'S OWN WORDS — a `.qs` span, never a slug.
  ok(`refusal[${kind}] names the step`, /class="qs"/.test(body))
  // ⚠ AND IT NAMES A NEXT ACTION. A refusal with no way out is a dead end wearing a sentence.
  // ⚠ THE CLASS MATCH IS `\b`-ANCHORED ON PURPOSE. On the canvas the way out is merged into the
  // step's own name (`rgo rgo-quiet`), because a *"go to the step"* offered to someone already
  // looking at the step points at where they are. Same role, same affordance, different noun —
  // and a fence written as `class="rgo"` would have read that as *no way out at all*.
  ok(`refusal[${kind}] offers a next action`, /class="rgo\b/.test(body))
  // ⚠ NO SECOND SENTENCE RESTATING THE FIRST. The headline plus one control is the whole thing.
  const heads = [...body.matchAll(/class="rhead"/g)]
  ok(`refusal[${kind}] has exactly one headline`, heads.length === 1, `has ${heads.length}`)
}
// Four of the five name the ARGUMENT too. `REFUSE_SHAPE_UNKNOWN` deliberately does not —
// ⚠ when the shape is unknown there IS no argument name to give, and inventing one would be
// the "never draw a name the system cannot know" rule broken on a refusal surface.
const argNamed = items.filter(([, , body]) => /class="arg"/.test(body))
ok(
  "every refusal that CAN name its argument does",
  argNamed.length === items.length - items.filter(([, k]) => k === "shape-unknown").length,
  `${argNamed.length} of ${items.length} name an argument`,
)
ok(
  "the unknown-shape refusal names no argument it cannot know",
  !items.filter(([, k]) => k === "shape-unknown").some(([, , b]) => /class="arg"/.test(b)),
)

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 · ⛔ WHAT THE REFUSAL MUST NOT SAY — THE FOUR CUTS, FENCED
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ These run over the SURFACE, so §3's struck-through exhibits do not trip their own fence.
ok("no filler second line", !/Publication blocked/i.test(SURFACE))
ok("no “Configuration Error”", !/Configuration Error/i.test(SURFACE))
ok("no internal id printed on the canvas", !/\bID:\s*[a-z]_\d+/i.test(SURFACE))
// ⚠ NO STAGE NAME IN A HEADLINE. `BUG-260815-06`'s complaint, fenced where it can be fenced:
// the stage rows are allowed, and a `.rhead` naming one is not.
const heads = [...SURFACE_HTML.matchAll(/class="rhead"[^>]*>([\s\S]*?)<\/div>/g)].map((m) => m[1])
ok("refusal headlines exist", heads.length >= 7, `found ${heads.length}`)
const STAGE_NAMES = ["Owner", "Valid", "Goal", "Structure", "Pause", "Grounding", "Golden run", "Citations", "Judge", "Commit"]
// ⚠ THE AUTHOR'S OWN STEP NAME IS NOT OUR STAGE VOCABULARY, AND THE FIRST DRAFT OF THIS FENCE
// COULD NOT TELL THE DIFFERENCE. A step legitimately named *"Commit the changelog"* tripped the
// `Commit` check — a false positive that, left in, would have pressured the sketch to rename real
// content to satisfy a guard. The `.qs` spans carry names WE DID NOT WRITE, so they come out
// before the fence reads the headline. Everything left is ours, and the rule binds only that.
const OURS = heads.map((h) => h.replace(/<span class="qs">[\s\S]*?<\/span>/g, " "))
for (const s of STAGE_NAMES) {
  ok(
    `no headline names the “${s}” stage`,
    !OURS.some((h) => h.includes(s)),
    `“${s}” appeared in words the product wrote`,
  )
}
// ⚠ THE EXCLUSION MUST ITSELF BE PROVED, or the fence quietly reads an empty string.
ok("positive control — an author name is present before the exclusion", heads.some((h) => h.includes("Email the weekly summary")))
ok("positive control — and gone after it", !OURS.some((h) => h.includes("Email the weekly summary")))
ok("positive control — the product's own words survive it", OURS.some((h) => h.includes("Nothing supplies")))
// ⚠ NO SEVERITY WORD AND NO EXCLAMATION IN ANY HEADLINE — `DESCRIBE_REFUSAL`'s own rule:
// *"No severity word, no exclamation, no mechanism."*
// ⚠ SAME EXCLUSION, SAME REASON: an author may legitimately name a step *"Handle the error"*.
// The rule binds the words the PRODUCT writes, never the ones it was handed.
for (const h of OURS) {
  ok(`headline has no exclamation: ${norm(h).slice(0, 38)}…`, !h.includes("!"))
  ok(`headline has no severity word: ${norm(h).slice(0, 38)}…`, !/\b(error|invalid|failed|fatal|warning)\b/i.test(h))
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 · A REFUSAL IS COMPETENCE, NOT AN ALARM — THE COLOUR RULE
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ `--color-danger` is reserved for genuinely irreversible acts. Spending it on *"this step
// is not finished yet"* — an ordinary, safe, expected state — is what stops red meaning
// anything. That is 213's override-mark argument applied one surface over.
ok("the refusal surface spends no destructive colour", !/var\(--color-danger\)/.test(HTML))
ok("the refusal mark uses warning", /\.ritem \.rmark\s*\{[^}]*var\(--color-warning\)/.test(HTML))
ok("the blocked node uses warning", /\.node\.blocked\s*\{[^}]*var\(--color-warning\)/.test(HTML))
// ⚠ THE BLOCKED MARK IS ON THE EDGE, NOT THE CORNER — D-185 claimed the card's top-right for
// the governance seal, and two marks in one slot is one too many.
ok("the blocked mark is an edge lane, not a corner badge", /\.node \.nblock\s*\{[^}]*left:\s*-1px/.test(HTML))
ok("the blocked mark is not top-right", !/\.node \.nblock\s*\{[^}]*right:\s*0/.test(HTML))

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5 · THE WALL DID A FULL JOB — COUNT, REMAINDER, AND EVERY OFFENDER LISTED
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ Stopping at the first problem teaches an author to publish repeatedly to discover the rest.
ok("the refusal states a count", TEXT.includes(COPY.REFUSE_COUNT_MANY(2)))
ok("the refusal states what is ready", TEXT.includes(COPY.REFUSE_REST_OK(4)))
// The count must AGREE with the list rendered beside it — a headline saying 2 over a list of 1
// is a lie the build would ship silently.
const variantA = HTML.match(/<section id="variant-a"[\s\S]*?<\/section>/)[0]
const aItems = [...variantA.matchAll(/data-kind="/g)].length
const aCount = Number((variantA.match(/(\d+) steps cannot run as written/) || [])[1])
ok("variant A's count matches its list", aItems === aCount, `${aCount} claimed, ${aItems} listed`)
const variantK = HTML.match(/<section id="variant-kinds"[\s\S]*?<\/section>/)[0]
const kItems = [...variantK.matchAll(/data-kind="/g)].length
const kCount = Number((variantK.match(/(\d+) steps cannot run as written/) || [])[1])
ok("§4's count matches its list", kItems === kCount, `${kCount} claimed, ${kItems} listed`)
// ⚠ AND ALL FIVE KINDS ARE PRESENT — one per way an arm can be unproved (D-214-09).
for (const [, , kind] of REFUSALS) {
  ok(`refusal kind rendered: ${kind}`, HTML.includes(`data-kind="${kind}"`))
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 6 · THE GAUNTLET SPINE — SHIPPED, UNCHANGED, AND BELOW THE CAUSE
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ THE ORDER IS THE ASSERTION. A stage row above the cause is the stage-naming failure by
// layout instead of by wording.
const aRefusalHead = variantA.indexOf('class="refusal-head"')
const aFirstCause = variantA.indexOf('class="rhead"')
const aFirstStage = variantA.indexOf('class="gauntlet"')
ok("the cause comes before the stage spine", aFirstCause > -1 && aFirstStage > aFirstCause)
ok("the count comes before the cause", aRefusalHead > -1 && aRefusalHead < aFirstCause)
// exactly one blocked pip, and everything after it is not-reached — a spine that shows a later
// stage as passed after a block is claiming a check that never ran.
const rows = [...variantA.matchAll(/<div class="grow" data-state="([a-z-]+)"/g)].map((m) => m[1])
ok("exactly one stage is blocked", rows.filter((r) => r === "blocked").length === 1, rows.join(" · "))
const blockedAt = rows.indexOf("blocked")
ok(
  "no stage after the block claims to have been checked",
  rows.slice(blockedAt + 1).every((r) => r === "not-reached"),
  rows.join(" · "),
)

// ═══════════════════════════════════════════════════════════════════════════════════════
// 7 · D-214-11 / D-214-12 — THE TWO PROMISES THE SURFACE MUST MAKE OUT LOUD
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⭐ D-16's no-send line is UNTOUCHED, and it is SAID — an author watching a publish check an
// email step has every reason to wonder whether it just emailed someone.
ok("the golden run says nothing was sent", TEXT.includes(COPY.GOLDEN_NO_SEND))
// ⚠ NOTHING RETROACTIVE. Refusing to RUN already-published workflows would un-run live rows
// without warning, so the gate binds the NEXT publish and the surface says so.
ok("the surface states the gate is not retroactive", TEXT.includes(COPY.ALREADY_PUBLISHED_NOTE))

// ═══════════════════════════════════════════════════════════════════════════════════════
// 8 · HOUSE FENCES
// ═══════════════════════════════════════════════════════════════════════════════════════
const titles = [...HTML.matchAll(/\stitle="([^"]*)"/g)].map((m) => m[1]).filter((t) => t.trim())
ok("no [title] carries user-facing copy", titles.every((t) => t === "theme"), titles.join(" | "))
for (const id of ["send_email", "create_ticket", "post_message", "external_action"]) {
  ok(`the wire id "${id}" is not rendered`, !TEXT.includes(id))
}
ok('the words "external action" never appear', !/external action/i.test(TEXT))
// Never a slug where a name belongs.
ok("no phase slug rendered", !/[a-z]+[-_][a-z]+[-_][a-z]+/.test(SURFACE.replace(/[a-z]+@[a-z.]+/g, " ")))

// ═══════════════════════════════════════════════════════════════════════════════════════
const total = pass + failures.length
console.log(`\n  sketch 215 — publish refuses by name`)
console.log(`  ${pass} passed, ${failures.length} failed  (${total} assertions)\n`)
if (failures.length) {
  for (const f of failures) console.log(`   ✗  ${f}`)
  console.log("")
  process.exitCode = 1
}

if (process.argv.includes("--emit")) {
  const rowsCopy = literals.map(([k, v]) => `| \`${k}\` | ${JSON.stringify(v)} |`).join("\n")
  const rowsFn = Object.entries(COPY)
    .filter(([, v]) => typeof v === "function")
    .map(([k, fn]) => `| \`${k}(…)\` | ${JSON.stringify(fn("«step»", "«arg»", "«upstream»"))} |`)
    .join("\n")
  const out = `# BUILD CONTRACT — sketch 215, publish refuses by name

⚠ **GENERATED by \`node drive.cjs --emit\` FROM the running sketch. Do not hand-edit.**

**State at generation: ${pass} passed, ${failures.length} failed (${total} assertions).**
Refusal items rendered: **${items.length}** · refusal kinds: **${REFUSALS.length}**.

---

## 1 · The vocabulary that ports

Becomes \`frontend/src/components/workflows/publishRefusalVocabulary.ts\`, beside
\`doorVocabulary.ts\` — whose \`DESCRIBE_REFUSAL\` is this table's direct precedent.

| id | value |
|---|---|
${rowsCopy}

### Composed

| id | shape |
|---|---|
${rowsFn}

---

## 2 · Each invariant → the React equivalent Phase 214's suite must reproduce

| # | invariant asserted here | React equivalent |
|---|---|---|
| 1 | every refusal names **the step in the author's own words** | render a phase whose name ≠ its slug; assert the name and assert the slug is absent |
| 2 | every refusal that CAN name its argument does; **the unknown-shape one does not** | assert per kind — and assert the unknown-shape refusal invents no argument name |
| 3 | every refusal offers **exactly one headline and at least one next action** | \`getAllByTestId("refusal-headline")\` is 1 per item; a button exists per item |
| 4 | **no headline names a gauntlet stage** — all ten checked | assert each of the ten stage labels is absent from every headline node |
| 5 | **no exclamation, no severity word** in any headline | regex over the rendered headline text |
| 6 | the **count agrees with the list** | seed N failures; assert the headline's number === the rendered item count |
| 7 | the stage spine sits **below** the cause | assert DOM order |
| 8 | **exactly one blocked stage**, and every later stage reads *not reached* | assert per-row state; a later stage reading *checked* claims a check that never ran |
| 9 | the surface spends **no destructive colour** | assert \`--destructive\` absent from the refusal rules |
| 10 | the blocked node's mark is an **edge lane**, never the top-right corner | assert the class/position — D-185 claimed the corner for the governance seal |
| 11 | the golden run **says nothing was sent** | assert \`GOLDEN_NO_SEND\` renders on a passing golden-run row |
| 12 | the surface states the gate is **not retroactive** | assert \`ALREADY_PUBLISHED_NOTE\` renders |
| 13 | **no wire id reaches the DOM** — \`send_email\` / \`create_ticket\` / \`post_message\` / \`external_action\` | the shipped \`ExternalActionSection.test.tsx\` fence, extended |

---

## 3 · Where the gate lives, and the trap already in the code

D-214-10 puts the check in the **pre-golden-run lint**, which short-circuits before anything runs
(\`publish_service.py:175\`) — so a refusal costs no model call and no wall-clock.

⚠ **\`reachability.py:67\` already does this shape of check against
\`_KNOWN_RUN_INPUT_KEYS = frozenset({"kickoff_prompt", "topic"})\`, and that allowlist is exactly
why nothing sees the defect today** — an adapter's \`INPUT_SCHEMA\` requirements are not
\`input_keys\`. Whether the gate extends stage 2 or becomes a sibling lint is discretionary; being
**cheap and before the golden run** is not.

---

## 4 · ⚠ Five refusals, not one — and why that is not over-design

Each source arm is proved **on its own terms** (D-214-09), so each failure is a different fact
about the world:

| kind | what is actually wrong | why it needs its own sentence |
|---|---|---|
| \`no-source\` | no arm chosen, or *Set here* left empty | the author has done nothing yet |
| \`ask-undeclared\` | *Ask at launch* chosen, key absent from \`inputs[]\` | ⭐ **\`BUG-260826-01\` itself** — a declared intention no launcher can honour. This gate exists because that exact shape shipped once already |
| \`upstream-unreachable\` | the named phase exists but is not upstream | the fix is the graph, not the form |
| \`shape-unknown\` | the action's schema was never discovered | the fix is re-discovery, not an edit — and it is the one refusal that must **not** name an argument |
| \`unrenderable\` | a required argument this form structurally cannot fill (D-214-06) | the fix is a different action; ⚠ **not** a JSON box |

A single *"this step is invalid"* headline would collapse all five — which is
\`BUG-260815-06\`'s stage-naming failure in a new costume.
`
  fs.writeFileSync(path.join(DIR, "BUILD-CONTRACT.generated.md"), out)
  console.log("  ✎ BUILD-CONTRACT.generated.md written from the running sketch\n")
}
