#!/usr/bin/env node
/**
 * ⭐ THE DRIVE SCRIPT — sketch 217, Phase 214 (STEP-06, SC#5). Closes `SEED-208`.
 *
 *   node drive.cjs           run the assertions
 *   node drive.cjs --emit    ALSO write BUILD-CONTRACT.generated.md FROM the running sketch
 *
 * ⚠ THE MOST IMPORTANT ASSERTION HERE IS A NEGATIVE ONE (§4): **the refusal must not render at
 * rest.** `doorVocabulary.ts` states it as a MECHANICAL requirement rather than a taste one —
 * `WorkflowDoorSwitch.baseline.test.tsx` pins all six resting states byte for byte, so a
 * refusal that leaks into the resting DOM breaks a shipped pin as well as a first impression.
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

function norm(s) {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/([“(])\s+/g, "$1")
    .replace(/\s+([”).,;:])/g, "$1")
    .trim()
}
const ATTR = [...HTML.matchAll(/(?:placeholder|aria-label|value)="([^"]*)"/g)].map((m) => m[1]).join(" | ")
const TEXT = norm(HTML + " | " + ATTR)

const SURFACE_HTML = HTML
  .replace(/<(style|script)[\s\S]*?<\/\1>/g, " ")
  .replace(/<(h2|h3|h4|p|div|span)\b[^>]*\bdata-anno\b[^>]*>[\s\S]*?<\/\1>/g, " ")
const SURFACE = norm(SURFACE_HTML)
ok("positive control — the surface is not empty", SURFACE.length > 1200, `${SURFACE.length} chars`)
ok("positive control — the surface carries the describe text", SURFACE.includes("Every Monday"))

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 · COPY -> HTML
// ═══════════════════════════════════════════════════════════════════════════════════════
const literals = Object.entries(COPY).filter(([, v]) => typeof v === "string")
for (const [k, v] of literals) ok(`COPY.${k} appears`, TEXT.includes(norm(v)), `missing: "${v}"`)

const composed = [
  ["DOOR_REFUSAL", COPY.DOOR_REFUSAL("Salesforce")],
  ["DOOR_REFUSAL(2)", COPY.DOOR_REFUSAL("Zendesk")],
  ["DOOR_REFUSAL_CONNECT", COPY.DOOR_REFUSAL_CONNECT("Salesforce")],
  ["SERVICE_ACTIONS(1)", COPY.SERVICE_ACTIONS(1)],
  ["SERVICE_ACTIONS(12)", COPY.SERVICE_ACTIONS(12)],
]
for (const [k, r] of composed) ok(`COPY.${k} renders`, TEXT.includes(norm(r)), `looked for: "${norm(r)}"`)
// ⚠ THE SINGULAR IS ITS OWN BRANCH. "1 actions" is a seam a person notices and a test never does.
ok("SERVICE_ACTIONS pluralises", COPY.SERVICE_ACTIONS(1) === "1 action" && COPY.SERVICE_ACTIONS(2) === "2 actions")

// ⚠ EM DASH, asserted over the whole table — `doorVocabulary.test.ts`'s rule, inherited.
for (const [k, v] of literals) ok(`COPY.${k} uses no hyphen-as-dash`, !/ - /.test(v), `in: "${v}"`)
ok("the refusal's dash is an em dash", COPY.DOOR_REFUSAL("X").includes(" — "))

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 · ⭐ THE SHIPPED STRINGS ARE REPRODUCED, NOT REWORDED
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ Rewording a governed literal Phase 187 settled is what D-13 and the 166-C precedent already
// declined, TWICE. The new refusal joins the existing mechanism; it does not displace it.
ok(
  "DESCRIBE_CTA is the shipped string",
  COPY.SHIPPED_DESCRIBE_CTA === "Write the first draft",
)
ok(
  "DESCRIBE_CTA_REFUSED is the shipped string",
  COPY.SHIPPED_DESCRIBE_CTA_REFUSED === "Too thin to draft",
)
ok(
  "DESCRIBE_REFUSAL is the shipped string",
  COPY.SHIPPED_DESCRIBE_REFUSAL ===
    "There is nothing here to draft from yet — describe the work in a sentence.",
)
// Both CTA reasons are actually rendered — the old arm and the new one, side by side.
ok("the shipped thinness reason renders", TEXT.includes(COPY.SHIPPED_DESCRIBE_CTA_REFUSED))
ok("the new connection reason renders", TEXT.includes(COPY.DOOR_CTA_REFUSED_SERVICE))
ok("the shipped ready CTA renders", TEXT.includes(COPY.SHIPPED_DESCRIBE_CTA))

// ⭐ THE DISABLED CONTROL ALWAYS CARRIES ITS REASON — never a greyed-out mystery.
const ctas = [...HTML.matchAll(/<button class="cta"([^>]*)>([^<]*)<\/button>/g)]
ok("CTAs are rendered", ctas.length >= 4, `found ${ctas.length}`)
const REASONS = [COPY.SHIPPED_DESCRIBE_CTA_REFUSED, COPY.DOOR_CTA_REFUSED_SERVICE]
for (const [, attrs, label] of ctas) {
  if (/disabled/.test(attrs)) {
    ok(`a disabled CTA carries its reason: "${label}"`, REASONS.includes(label.trim()), label)
  } else {
    ok(`an enabled CTA reads the shipped CTA: "${label}"`, label.trim() === COPY.SHIPPED_DESCRIBE_CTA)
  }
}
// ⚠ AND THE DISABLED CTA NAMES NO SERVICE. The control is ONE control and there may be two
// missing — naming one of two would be arbitrary, naming both puts a list on a button.
ok(
  "no CTA names a service",
  !ctas.some(([, , l]) => /Salesforce|Zendesk|Slack|Jira/.test(l)),
)

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 · D-214-21 — THE REFUSAL NAMES THE SERVICE AND *TWO* REAL NEXT ACTIONS
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ *A refusal is only honest if it names the next action* — the ROADMAP's own words.
const refusalBlocks = [...HTML.matchAll(/<div class="drefusal"[^>]*>([\s\S]*?)<\/div>\s*<div class="ctarow"/g)]
ok("refusal blocks are rendered", refusalBlocks.length >= 4, `found ${refusalBlocks.length}`)
// Every refusal SENTENCE names its service; every refusal with actions offers both arms.
// ⚠ THERE ARE TWO KINDS OF REFUSAL ON THIS DOOR AND THE FENCE MUST TELL THEM APART. The first
// draft asserted "every refusal names a service" and fired on the SHIPPED thinness refusal, which
// correctly names none — a fence that cannot distinguish two arms of one mechanism would have
// pressured the sketch into making the shipped string name something it must not.
const allSentences = [...HTML.matchAll(/<div class="dr-text" data-kind="([a-z]+)"[^>]*>([^<]*)<\/div>/g)]
ok("refusal sentences are labelled by kind", allSentences.length >= 6, `found ${allSentences.length}`)
ok("no refusal sentence is unlabelled", !/class="dr-text"(?! data-kind)/.test(HTML))
const sentences = allSentences.filter(([, k]) => k === "service").map(([, , t]) => t.trim())
const thin = allSentences.filter(([, k]) => k === "thin").map(([, , t]) => t.trim())
ok("service refusals are rendered", sentences.length >= 5, `found ${sentences.length}`)
ok("the shipped thinness refusal is rendered too", thin.length === 1, `found ${thin.length}`)
ok("the thinness refusal is the shipped string, unchanged", thin[0] === COPY.SHIPPED_DESCRIBE_REFUSAL)
// ⭐ AND IT NAMES NO SERVICE, CORRECTLY — its next action is the box itself.
ok("the thinness refusal names no service", !/Salesforce|Zendesk/.test(thin[0] || ""))
for (const s of sentences) {
  ok(`refusal names a service: "${s.slice(0, 34)}…"`, /^(Salesforce|Zendesk) is not connected/.test(s))
  ok(`refusal names where to connect it`, /in Settings/.test(s))
  ok(`refusal names the other way out`, /describe this step without it/.test(s))
}
const actBlocks = [...HTML.matchAll(/<div class="dr-acts">([\s\S]*?)<\/div>/g)].map((m) => m[1])
ok("refusal action rows are rendered", actBlocks.length >= 4, `found ${actBlocks.length}`)
for (const b of actBlocks) {
  const buttons = [...b.matchAll(/<button>([^<]*)<\/button>/g)].map((m) => m[1])
  ok(`a refusal offers exactly two next actions`, buttons.length === 2, buttons.join(" | "))
  ok(`one arm connects the named service`, buttons.some((x) => /^Connect /.test(x)))
  ok(`one arm stays here`, buttons.includes(COPY.DOOR_REFUSAL_REVISE))
}
// ⚠ NO INLINE-CONNECT ARM. A connection is a CREDENTIAL, and a credential form on a drafting
// screen is a new outbound trust surface with no prior review cycle. Rejected under D-214-21.
ok("no credential field on the door", !/type="password"|api[_ ]?key|token/i.test(SURFACE_HTML))
// ⚠ AND THE REFUSAL DRAFTS NOTHING — no partial workflow, no "we removed that step for you".
ok("the refusal drafts nothing", !/we (?:removed|dropped|skipped)/i.test(SURFACE))

// ⚠ NO SEVERITY WORD, NO EXCLAMATION, NO MECHANISM — `DESCRIBE_REFUSAL`'s own rule, inherited.
for (const s of sentences) {
  ok(`refusal has no exclamation: "${s.slice(0, 30)}…"`, !s.includes("!"))
  ok(`refusal has no severity word: "${s.slice(0, 30)}…"`, !/\b(error|invalid|failed|fatal|warning)\b/i.test(s))
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 · ⛔ THE REFUSAL MUST NOT RENDER AT REST — MECHANICAL, NOT TASTE
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ An untouched empty box is refused by the same rule, and captioning THAT would put a red
// sentence on the first screen an author meets before they had done anything at all.
// `WorkflowDoorSwitch.baseline.test.tsx` pins all six resting states BYTE FOR BYTE.
ok("the refusal is display:none by default", /\.drefusal\s*\{[^}]*display:\s*none/.test(HTML))
ok("it is shown only under an explicit refusing state", /\.door\.refusing \.drefusal\s*\{\s*display:\s*block/.test(HTML))
// The resting doors in §3 exist and are NOT refusing — the sketch proves the gate by having
// both on one page, rather than asserting a CSS rule nobody exercises.
const doors = [...HTML.matchAll(/<div class="door( refusing)?"[^>]*id="([a-z0-9-]+)"/g)]
ok("doors are rendered", doors.length >= 5, `found ${doors.length}`)
const resting = doors.filter(([, r]) => !r)
const refusing = doors.filter(([, r]) => r)
ok("at least two doors are at rest", resting.length >= 2, resting.map((d) => d[2]).join(" · "))
ok("at least two doors are refusing", refusing.length >= 2, refusing.map((d) => d[2]).join(" · "))
// ⚠ AND THE ANCHOR TAG IS VISIBLE WHILE REFUSING, NOT ONLY ON HOVER. Hover-only is a tooltip,
// and a tooltip is a thing a keyboard and a phone never see — the same reason the house fence
// forbids copy in a `[title]`.
ok(
  "the anchor tag shows while refusing, not only on hover",
  /\.anchor:hover \.anchor-tag,\s*\.door\.refusing \.anchor \.anchor-tag/.test(HTML),
)

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5 · D-214-20 — THE PICKER, AND THE GRANT GRAIN
// ═══════════════════════════════════════════════════════════════════════════════════════
const chips = [...HTML.matchAll(/<button class="schip"([^>]*)>/g)].map((m) => m[1])
ok("service chips are rendered", chips.length >= 8, `found ${chips.length}`)
for (const c of chips) {
  ok("a chip declares its pressed state", /aria-pressed="(true|false)"/.test(c), c)
  ok("a chip declares its grant state", /data-grants="(some|none)"/.test(c), c)
  ok("a chip declares its service", /data-service="[a-z]+"/.test(c), c)
}
// ⭐ THE GRANT GRAIN IS THE VOCABULARY GRAIN — a connected service with NO granted tool has
// genuinely nothing to offer the generator. It is present, not selectable, and it SAYS WHY.
const ungranted = chips.filter((c) => /data-grants="none"/.test(c))
ok("an ungranted service is drawn", ungranted.length >= 2, `found ${ungranted.length}`)
ok("an ungranted service is never pre-selected", ungranted.every((c) => /aria-pressed="false"/.test(c)))
ok("an ungranted service says why", TEXT.includes(COPY.SERVICE_NO_GRANTS))
ok("an ungranted service offers the fix", TEXT.includes(COPY.SERVICE_NO_GRANTS_NEXT))
ok("the ungranted chip is visibly not selectable", /\.schip\[data-grants="none"\]\s*\{[^}]*cursor:\s*default/.test(HTML))
// ⚠ AND IT IS NOT HIDDEN. An absent control is indistinguishable from one that does not exist,
// and an author who connected DeepWiki would wonder where it went.
ok("the ungranted service is present rather than hidden", !/\.schip\[data-grants="none"\]\s*\{[^}]*display:\s*none/.test(HTML))
// The empty state names the next action too.
ok("the empty picker says so", TEXT.includes(COPY.SERVICES_EMPTY))
ok("the empty picker offers the next action", TEXT.includes(COPY.SERVICES_EMPTY_NEXT))
// The picker's own label states the rule it enforces — the vocabulary IS the ticked set.
ok("the picker states its own rule", TEXT.includes(COPY.SERVICES_HINT))

// ═══════════════════════════════════════════════════════════════════════════════════════
// 6 · THE ANCHOR — B's ADDITION, AND ITS COLOUR RULE
// ═══════════════════════════════════════════════════════════════════════════════════════
const anchors = [...HTML.matchAll(/<span class="anchor"[^>]*>([^<]*)<span class="anchor-tag">([^<]*)<\/span>/g)]
ok("anchors are rendered", anchors.length >= 3, `found ${anchors.length}`)
for (const [, word, tag] of anchors) {
  ok(`the anchor marks a service name: "${word}"`, /^(Salesforce|Zendesk)$/.test(word.trim()))
  ok(`the anchor is labelled`, tag.trim() === COPY.DOOR_REFUSAL_ANCHOR)
}
// ⚠ THE MARK IS AN UNDERLINE, NOT A HIGHLIGHT. A filled block behind running text at headline
// size reads as an ERROR IN THE SENTENCE — and the sentence is not wrong; it names something
// the account does not have.
ok("the anchor is an underline", /\.anchor\s*\{[^}]*border-bottom:\s*2px solid var\(--color-warning\)/.test(HTML))
ok("the anchor is not a filled highlight", !/\.anchor\s*\{[^}]*background/.test(HTML))
// ⚠ AND IT SPENDS WARNING, NEVER DESTRUCTIVE. Naming a service you have not connected yet is an
// ordinary thing to do, and red is reserved for irreversible acts.
ok("the whole door spends no destructive colour", !/var\(--color-danger\)/.test(HTML))

// ═══════════════════════════════════════════════════════════════════════════════════════
// 7 · HOUSE FENCES
// ═══════════════════════════════════════════════════════════════════════════════════════
const titles = [...HTML.matchAll(/\stitle="([^"]*)"/g)].map((m) => m[1]).filter((t) => t.trim())
ok("no [title] carries user-facing copy", titles.every((t) => t === "theme"), titles.join(" | "))
for (const id of ["send_email", "create_ticket", "post_message", "external_action"]) {
  ok(`the wire id "${id}" is not rendered`, !SURFACE.includes(id))
}
ok("no JSON surface anywhere on the door", !/<textarea|\bJSON\b/.test(SURFACE_HTML))
// The refusal is announced, not merely drawn — it appears after a person acts, so a screen
// reader has to be told.
ok('the refusal is a live region', /class="drefusal"[^>]*role="status"/.test(HTML))

// ═══════════════════════════════════════════════════════════════════════════════════════
const total = pass + failures.length
console.log(`\n  sketch 217 — the door that knows your services`)
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
    .map(([k, fn]) => `| \`${k}(…)\` | ${JSON.stringify(fn("«service»"))} |`)
    .join("\n")
  const out = `# BUILD CONTRACT — sketch 217, the door that knows your services

⚠ **GENERATED by \`node drive.cjs --emit\` FROM the running sketch. Do not hand-edit.**

**State at generation: ${pass} passed, ${failures.length} failed (${total} assertions).**
Doors rendered: **${doors.length}** (${resting.length} at rest, ${refusing.length} refusing) ·
service chips: **${chips.length}** · refusal sentences: **${sentences.length}** ·
anchors: **${anchors.length}**.

---

## 1 · The vocabulary that ports

⚠ **NOT a new module.** These are **additions to the shipped
\`frontend/src/components/workflows/doorVocabulary.ts\`**, whose \`DESCRIBE_REFUSAL\` is a
**sibling** rather than merely a precedent: the describe screen already refuses in a governed
vocabulary, and this phase gives it a second reason to.

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
| 1 | ⛔ **the refusal never renders at rest** | ⚠ MECHANICAL: \`WorkflowDoorSwitch.baseline.test.tsx\` pins all six resting states **byte for byte**. Assert the resting DOM is unchanged, with a positive control that the refusing DOM is not |
| 2 | the three **shipped** strings are reproduced, never reworded | import them from \`doorVocabulary.ts\`; assert character identity. D-13 and the 166-C precedent already declined rewording a governed literal, twice |
| 3 | **every disabled CTA carries its reason**, and names no service | assert the accessible name of the disabled control is one of the two reasons; assert no service name appears in it |
| 4 | every refusal names **the service, where to connect it, and the way to stay** | assert all three fragments per sentence |
| 5 | every refusal offers **exactly two** next actions | \`within(refusal).getAllByRole("button")\` is 2 |
| 6 | **no credential field on the door** | ⚠ rejected under D-214-21 — a credential form on a drafting screen is a new outbound trust surface with no prior review cycle |
| 7 | **no severity word, no exclamation** | \`DESCRIBE_REFUSAL\`'s own rule, inherited |
| 8 | every chip declares **pressed · grants · service** | assert from props, and that an ungranted chip is never pre-selected |
| 9 | ⭐ an **ungranted** service is present, not selectable, and **says why** | ⚠ the grant grain IS the vocabulary grain (STEP-06 depends on Phase 213). Assert it is rendered and that clicking it does not select it |
| 10 | the empty picker **states itself and offers the next action** | assert both strings |
| 11 | the anchor is an **underline**, spends warning, never destructive | assert the computed style token |
| 12 | the anchor tag is visible **while refusing**, not only on hover | assert it is in the accessibility tree without a hover event |
| 13 | \`SERVICE_ACTIONS\` **pluralises** | assert \`(1)\` and \`(2)\` |
| 14 | the refusal is a **live region** | \`role="status"\` — it appears after a person acts |

---

## 3 · ⭐ The shipped shape this reuses rather than inventing

\`\`\`
DESCRIBE_CTA          = "Write the first draft"
DESCRIBE_CTA_REFUSED  = "Too thin to draft"
DESCRIBE_REFUSAL      = "There is nothing here to draft from yet — describe the work in a sentence."
\`\`\`

⚠ **The door already draws its disabled control CARRYING ITS REASON** — that is what
\`DESCRIBE_CTA_REFUSED\` is. Stitch arrived at the same idea independently (*"Waiting for
connection"*), which is a **confirmation, not a discovery**. So the new refusal is **a second arm
on one mechanism**, never a second mechanism beside it.

⚠ **And the two reasons do not compete.** With an empty box AND nothing connected, the CTA reads
the **thinness** reason — a workflow with no external step is perfectly legitimate, so naming the
connection there would refuse for a reason that is not binding.

---

## 4 · ⚠ What variant B costs, and the rule that bounds it

Marking a span in the author's prose means **finding the service name in free text** — a match, and
therefore a thing that can be wrong. **A mis-anchor is worse than no anchor**, because it claims a
precision the system does not have.

**The safe rule:** mark only an exact, case-insensitive **whole-word** match against a name in the
catalog, and **fall back to variant A's unanchored refusal** when there is no unambiguous single
match. A plan choosing B must carry that fallback, or it has shipped a guess wearing a mark.

---

## 5 · Why the picker, and not post-draft validation

SC#5's own words name the failure: *"an invented step that validates and fails at 03:00."*

**Post-draft validation alone was rejected because it is a model-behaviour guarantee** — it depends
on the model, or a checker, noticing. The picker makes the failure **structurally impossible**: the
generator's vocabulary *is* the ticked set, so a step naming an unconnected service cannot be
drafted rather than being caught after it was.

⭐ **Granted tools, not merely discovered ones** — which is exactly why STEP-06's stated dependency
is Phase 213.
`
  fs.writeFileSync(path.join(DIR, "BUILD-CONTRACT.generated.md"), out)
  console.log("  ✎ BUILD-CONTRACT.generated.md written from the running sketch\n")
}
