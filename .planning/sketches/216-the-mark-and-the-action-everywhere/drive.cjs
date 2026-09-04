#!/usr/bin/env node
/**
 * ⭐ THE DRIVE SCRIPT — sketch 216, Phase 214 (STEP-04 / STEP-05, SC#4).
 *
 *   node drive.cjs           run the assertions
 *   node drive.cjs --emit    ALSO write BUILD-CONTRACT.generated.md FROM the running sketch
 *
 * ⚠ The single most important assertion in this file is §2: **every step identity on every
 * surface is the SAME element**. D-214-16's whole point is that coverage becomes a consequence
 * of one component existing rather than a list somebody keeps in sync — and a list is exactly
 * what `SEED-206` measured going stale.
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

// The surface minus its own annotation, minus §5 (whose whole job is to EXHIBIT the broken
// sentences beside the fixed ones — a fence over it would fire on the exhibit).
const SURFACE_HTML = HTML
  .replace(/<(style|script)[\s\S]*?<\/\1>/g, " ")
  .replace(/<(h2|h3|p|div|span)\b[^>]*\bdata-anno\b[^>]*>[\s\S]*?<\/\1>/g, " ")
  .replace(/<section id="variant-clause"[\s\S]*?<\/section>/, " ")
const SURFACE = norm(SURFACE_HTML)

ok("positive control — the surface is not empty", SURFACE.length > 1500, `${SURFACE.length} chars`)
ok("positive control — the surface carries a real identity", SURFACE.includes("Post a message"))
ok("positive control — §5's broken exhibits are out of the surface", !SURFACE.includes("through post_message"))

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 · COPY -> HTML
// ═══════════════════════════════════════════════════════════════════════════════════════
const literals = Object.entries(COPY).filter(([, v]) => typeof v === "string")
for (const [k, v] of literals) ok(`COPY.${k} appears`, TEXT.includes(norm(v)), `missing: "${v}"`)

const composed = [
  ["STEP_IDENTITY", COPY.STEP_IDENTITY("Post a message", "Aether Slack")],
  ["STEP_IDENTITY_SERVICE_UNKNOWN", COPY.STEP_IDENTITY_SERVICE_UNKNOWN("Post a message")],
  ["ASK_WILL_RUN", COPY.ASK_WILL_RUN("Send an email", "Aether Mail")],
  ["RECEIPT_SENT", COPY.RECEIPT_SENT("Post a message", "Aether Slack")],
  ["RECEIPT_REFUSED", COPY.RECEIPT_REFUSED("Create an issue", "Aether Jira")],
]
for (const [k, r] of composed) ok(`COPY.${k}() renders`, TEXT.includes(norm(r)), `looked for: "${norm(r)}"`)
for (const [k, v] of literals) ok(`COPY.${k} uses no hyphen-as-dash`, !/ - /.test(v), `in: "${v}"`)

// ⚠ THE SHIPPED SENTINEL IS REPRODUCED CHARACTER FOR CHARACTER (`PhaseCard.tsx:253`). It is an
// HONESTY MECHANISM: its condition narrows, its words do not change.
ok(
  "the failure sentinel is the SHIPPED string, unchanged",
  COPY.FAILED_REASON_UNKNOWN ===
    "Failure reason not captured by the backend — surfaced explicitly so the run is never shown as an empty success.",
)

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 · ⭐ ONE ELEMENT, FIVE SURFACES, FOUR SIZES — D-214-16's REAL TEST
// ═══════════════════════════════════════════════════════════════════════════════════════
const sids = [...HTML.matchAll(/<span class="sid"([^>]*)>([\s\S]*?)<\/span>\s*<\/(?:div|span|dd|li)>|<span class="sid"([^>]*)>/g)]
const sidOpens = [...HTML.matchAll(/<span class="sid"([^>]*)>/g)].map((m) => m[1])
ok("step identities are rendered", sidOpens.length >= 14, `found ${sidOpens.length}`)

// ⚠ EVERY identity declares a size, and the size is a MODIFIER — never a fork. A second class
// name here would be a second component in disguise.
const SIZES = ["xs", "sm", "md", "lg"]
for (const attrs of sidOpens) {
  ok(`identity declares a size`, /data-size="(xs|sm|md|lg)"/.test(attrs), attrs)
  ok(`identity declares its service`, /data-service="[a-z]+"/.test(attrs), attrs)
}
const used = [...new Set(sidOpens.map((a) => (a.match(/data-size="([a-z]+)"/) || [])[1]))]
ok("all four sizes are exercised", SIZES.every((s) => used.includes(s)), `used: ${used.join(" · ")}`)
// ⚠ AND THE SIZE RULES ARE A MODIFIER SET ON ONE SELECTOR, not four independent components.
for (const s of SIZES) {
  ok(`.sid[data-size="${s}"] is a modifier rule`, new RegExp(`\\.sid\\[data-size="${s}"\\]`).test(HTML))
}
ok("there is exactly one base .sid rule", (HTML.match(/^\s*\.sid \{/m) || []).length === 1)

// EVERY surface named by D-214-16 is present. ⚠ `SEED-206`'s own warning is that a PARTIAL
// answer leaves the seed live for the next phase to rediscover.
const SURFACES = [
  ["panel PhaseCard", /class="phasecard"/],
  ["chat RunCard", /class="runcard"/],
  ["WorkflowRunPage RunSpine", /class="spine"/],
  ["WorkflowRunPage RunStepList", /class="steplist"/],
  ["the approval pause", /class="ask"/],
]
for (const [name, re] of SURFACES) ok(`surface present: ${name}`, re.test(HTML))

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 · ⛔ SC#4 — THE MARK *AND* THE ACTION'S REAL NAME. NEVER A WIRE ID.
// ═══════════════════════════════════════════════════════════════════════════════════════
// Variant B is deliberately spare and is the ONLY place an identity may omit the action —
// it exists to make the cost visible. Everywhere else, both.
const spareCount = [...HTML.matchAll(/<span class="sid"[^>]*data-spare[^>]*>/g)].length
ok("the spare variant exists as a counter-example", spareCount >= 2, `found ${spareCount}`)
const richOpens = sidOpens.filter((a) => !/data-spare/.test(a))
ok("most identities are rich", richOpens.length >= 12, `${richOpens.length} rich of ${sidOpens.length}`)

// Every rich identity carries an `.action`; the roster cells carry action without service by
// design (they are a mark roster, not a run surface), so service is checked on run surfaces only.
const richBlocks = [...HTML.matchAll(/<span class="sid"((?:(?!data-spare)[^>])*)>([\s\S]*?)<\/span>\s*<\/(span|div|dd)>/g)]
ok("rich identity blocks parsed", richBlocks.length >= 10, `found ${richBlocks.length}`)
for (const [, , body] of richBlocks) {
  ok("a rich identity names the action", /class="action"/.test(body) || /class="mark"/.test(body))
}
// ⚠ NEVER A WIRE ID ON A RUN SURFACE. The person reads names; the ids are wire values.
for (const id of ["send_email", "create_ticket", "post_message", "ask_question", "external_action"]) {
  ok(`the wire id "${id}" is not rendered on the surface`, !SURFACE.includes(id))
}
ok('the words "external action" never appear on the surface', !/external action/i.test(SURFACE))
// ⚠ AND THE SEPARATOR IS THE HOUSE MIDDLE DOT, not a dash or a slash — the same one the shipped
// canvas node subtitle uses, so the identity reads identically at all four sizes.
ok("the identity separator is the middle dot", COPY.STEP_IDENTITY("A", "B") === "A · B")
ok("the separator is rendered as its own element, not baked into a string", /class="dot"/.test(HTML))

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 · THE INK CONTRACT — connectionMark.tsx's THREE ARMS, NOT A COLOUR PREFERENCE
// ═══════════════════════════════════════════════════════════════════════════════════════
const marks = [...HTML.matchAll(/<span class="mark" data-ink="([a-z]+)">/g)].map((m) => m[1])
ok("every mark declares its ink", marks.length === sidOpens.length, `${marks.length} marks, ${sidOpens.length} identities`)
ok("both ink arms are exercised", new Set(marks).has("self") && new Set(marks).has("stroke"))
// ⚠ `self` MEANS NOTHING IS APPLIED. Slack's four elements and Jira's three carry their OWN
// fills, so a colour utility is inert and a fill utility flattens four brand colours into one.
ok(
  "the self-ink rule applies no colour",
  /\.sid \.mark\[data-ink="self"\] svg \{[^}]*\}/.test(HTML) &&
    !/\.sid \.mark\[data-ink="self"\] svg \{[^}]*(?:fill|stroke):\s*(?!none)/.test(HTML),
)
// ⚠ `stroke` NEVER TAKES A FILL. lucide sets `fill="none" stroke="currentColor"` as PRESENTATION
// ATTRIBUTES, and a CSS rule on the same element BEATS a presentation attribute — a fill utility
// here fills the outline into a solid blob.
ok(
  "the stroke-ink rule sets fill: none explicitly",
  /\.sid \.mark\[data-ink="stroke"\] svg \{[^}]*fill:\s*none/.test(HTML),
)
// A vendorless shape is drawn in the interface's own ink — never a borrowed logo.
ok("the vendorless services take a stroke mark", /data-service="smtp"[\s\S]{0,220}data-ink="stroke"/.test(HTML))
ok("the unmapped service takes the NAMED neutral", /data-service="unknown"[\s\S]{0,220}data-ink="stroke"/.test(HTML))
// ⚠ AND NO SERVICE BORROWS ANOTHER'S MARK. `logos` carries no SMTP mark at all; its only
// mail-shaped names are vendors, and using one would be the "a logo is approximated" failure.
// ⚠ THE FENCE RUNS OVER THE SURFACE, NOT THE FILE. The annotation names `google-gmail` in order
// to explain why it must never be used — a fence that cannot tell an exhibit from a shipment
// fires on the sentence forbidding the thing.
ok("no Gmail mark stands in for SMTP", !/gmail/i.test(SURFACE_HTML))
ok("positive control — the annotation that names it is still in the file", /google-gmail/.test(HTML))

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5 · ⭐ THE APPROVAL PAUSE SHOWS THE *RESOLVED* OBJECT — D-214-15's DEFECT, PRE-EMPTED
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ `_external_action_clause` renders `config.tool_args`, which under D-214-01 holds ONLY the
// FIXED values. Left alone the pause names the constants and SILENTLY OMITS exactly the
// arguments that vary — on an approval surface, worse than showing nothing.
const askBlock = HTML.match(/<div class="ask">[\s\S]*?<\/div>\s*<\/div>\s*<p class="note"/)
ok("the approval pause is rendered", !!askBlock)
const dd = [...HTML.matchAll(/<dd data-src="([a-z]+)">/g)].map((m) => m[1])
ok("the pause lists every argument", dd.length >= 3, `listed ${dd.length}`)
// ⭐ ALL THREE SOURCE KINDS ARE PRESENT. A pause showing only `fixed` is the defect.
for (const src of ["fixed", "ask", "upstream"]) {
  ok(`the pause shows an argument sourced "${src}"`, dd.includes(src), `sources: ${dd.join(" · ")}`)
}
ok("the pause is not fixed-only", new Set(dd).size >= 3, `sources: ${[...new Set(dd)].join(" · ")}`)
// ⚠ AND THEY RENDER IDENTICALLY. Per-argument source annotation was considered and REJECTED
// under D-214-15 — the pause's question is *what leaves*, not *who chose it*.
ok(
  "no per-argument source annotation is rendered",
  !/<dd data-src="[a-z]+"[^>]*>[^<]*<(?:span|em|small)/.test(HTML),
)
// The pause states both halves of the honesty contract.
ok("the pause says nothing has been sent", TEXT.includes(COPY.ASK_NOTHING_SENT))
ok("the pause says it is not recorded", TEXT.includes(COPY.ASK_NOT_RECORDED))
// ⚠ NO COUNTDOWN, NO TIMER, NO PROGRESSBAR — a person's decision time is unknowable (213's rule).
ok("the pause has no countdown or timer", !/countdown|progressbar|role="timer"/i.test(HTML))
// Two arms, and the decline is not styled as destructive — declining a send is a safe act.
ok("the pause offers approve and decline", /class="approve"/.test(HTML) && /class="decline"/.test(HTML))
ok("the decline arm is not destructive-coloured", !/\.ask \.decline\s*\{[^}]*--color-danger/.test(HTML))

// ═══════════════════════════════════════════════════════════════════════════════════════
// 6 · THE FAILED STEP SAYS *ITS OWN* REASON — `BUG-260826-05`
// ═══════════════════════════════════════════════════════════════════════════════════════
const fails = [...HTML.matchAll(/<div class="fail(?: sentinel)?" data-reason="([a-z]+)">([\s\S]*?)<\/div>\s*<\/div>/g)]
ok("failure blocks are rendered", fails.length >= 3, `found ${fails.length}`)
for (const [, kind, body] of fails) {
  ok(`failure[${kind}] carries a label`, body.includes(COPY.FAILED_REASON_LABEL))
  ok(`failure[${kind}] carries a reason`, /class="freason"/.test(body))
}
// ⭐ THE ADAPTER'S OWN SENTENCE, not a generic one — this is the bug closed.
ok(
  "a real failure shows the adapter's own words",
  /Channel #urgent-feedback-escalations not found or bot lacks permission to post\./.test(HTML),
)
// ⚠ THE SENTINEL IS RENDERED *AND* VISUALLY DISTINCT FROM A REAL REASON. It is an honesty
// mechanism, and one that looks identical to a real reason teaches readers to distrust both.
ok("the sentinel is rendered", TEXT.includes(norm(COPY.FAILED_REASON_UNKNOWN)))
ok("the sentinel has its own quieter treatment", /\.fail\.sentinel\s*\{/.test(HTML))
ok(
  "the sentinel is not painted as a real failure",
  /\.fail\.sentinel\s*\{[^}]*border-color:\s*var\(--color-border\)/.test(HTML),
)
// Exactly one sentinel — a surface showing two would mean the condition is too wide.
ok("exactly one sentinel is rendered", fails.filter(([, k]) => k === "unknown").length === 1)

// ═══════════════════════════════════════════════════════════════════════════════════════
// 7 · HOUSE FENCES
// ═══════════════════════════════════════════════════════════════════════════════════════
const titles = [...HTML.matchAll(/\stitle="([^"]*)"/g)].map((m) => m[1]).filter((t) => t.trim())
ok("no [title] carries user-facing copy", titles.every((t) => t === "theme"), titles.join(" | "))
// ⚠ AT MOST THREE STATE COLOURS. `--color-danger` is spent here — on a step that genuinely
// FAILED, which is what it is for — so warning and danger and success is the ceiling, and the
// pause borrows warning rather than adding a fourth.
ok("the pause uses warning, not a fourth colour", /\.ask\s*\{[^}]*var\(--color-warning\)/.test(HTML))
ok("no <textarea> on any run surface", !/<textarea/i.test(HTML))

// ═══════════════════════════════════════════════════════════════════════════════════════
const total = pass + failures.length
console.log(`\n  sketch 216 — the mark and the action, everywhere`)
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
    .map(([k, fn]) => `| \`${k}(…)\` | ${JSON.stringify(fn("«action»", "«service»"))} |`)
    .join("\n")
  const out = `# BUILD CONTRACT — sketch 216, the mark and the action, everywhere

⚠ **GENERATED by \`node drive.cjs --emit\` FROM the running sketch. Do not hand-edit.**

**State at generation: ${pass} passed, ${failures.length} failed (${total} assertions).**
Step identities rendered: **${sidOpens.length}** across **${SURFACES.length}** surfaces and
**${used.length}** sizes · marks: **${marks.length}** · failure blocks: **${fails.length}**.

---

## 1 · The vocabulary that ports

Becomes \`frontend/src/components/workflows/stepIdentityVocabulary.ts\`.
⚠ **Most of this surface is NOT copy** — it is a mark plus two names the system already holds.
That is D-214-17: *the mark is a reuse, not a new decision.*

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
| 1 | **one element, five surfaces, four sizes** — size is a modifier, never a fork | one \`<StepIdentity>\`; assert each of the five surfaces renders it, and that the size prop selects a class rather than a branch |
| 2 | every identity declares **size and service** | assert the props are required (types) and rendered |
| 3 | ⭐ **all five surfaces present** — panel \`PhaseCard\`, chat \`RunCard\`, \`RunSpine\`, \`RunStepList\`, the approval pause | ⚠ \`SEED-206\`'s warning: a **partial** answer leaves the seed live. Assert per surface, not once |
| 4 | **no wire id reaches any run surface** — \`send_email\` / \`create_ticket\` / \`post_message\` / \`ask_question\` / \`external_action\` | extend the shipped \`ExternalActionSection.test.tsx\` fence to the run surfaces |
| 5 | the separator is the **house middle dot**, rendered as its own node | assert the composed string and the element |
| 6 | **ink \`self\` applies no colour; ink \`stroke\` sets \`fill: none\`** | port \`connectionMark.test.tsx\`'s resolved-but-INVISIBLE assertion — the import fence structurally cannot catch it |
| 7 | a vendorless shape takes the **named neutral**, never a borrowed logo | assert SMTP and an unmapped service both resolve to the neutral, and that no Gmail mark appears |
| 8 | ⭐ **the pause lists arguments from all three sources** | seed a step with one fixed, one \`Ask at launch\`, one upstream; assert **all three** are in the pause. ⚠ Asserting only \`tool_args\` reproduces the defect |
| 9 | **no per-argument source annotation** | rejected under D-214-15; assert the \`dd\` carries text only |
| 10 | the pause says **nothing sent** and **not recorded** | assert both strings |
| 11 | **no countdown, timer or progressbar** in the pause | a person's decision time is unknowable (213's rule) |
| 12 | a failed step shows **the adapter's own sentence** | seed \`workflow_phases.error\`; assert the verbatim reason, not the sentinel |
| 13 | the sentinel is **rendered, distinct, and singular** | assert its quieter treatment and that a known reason does **not** produce it |

---

## 3 · ⚠ The measured tautology this closes

Driven verbatim on both shapes at Phase 213's close:

| shape | today | after |
|---|---|---|
| capability row | \`It will run "post_message" through post_message.\` | It will run Post a message through Aether Slack. |
| MCP row | \`It will run "ask_question".\` — **no service at all** | It will run Ask the wiki through DeepWiki. |
| service unresolvable | — | It will run Post a message. **Not "Unknown service".** |

\`_external_action_clause\` fills the service slot from \`config.capability\` — the same value it
puts in the tool slot on a capability row — and an MCP row carries \`capability = None\`, so the
clause is omitted entirely. **The service a person needs sits on the connection row and was never
read.**

D-214-14's fix keeps the composer **pure**: the engine already holds a pool and already reads that
connection, so it resolves the display name and hands it in **as an argument**.
⚠ **Rejected: storing the service name on the step config** — a stored copy of a derived fact goes
stale the moment the connection is renamed, and D-213-02 rejected exactly this shape.
⚠ **An absent name still omits the service clause** — *never draw a name the system cannot know.*

---

## 4 · ⚠ D-214-18 — measure before fixing \`BUG-260826-05\`

The bug names its run: \`e2c0db68-dc94-4864-b7bd-afd0e163f69b\`. **Read \`workflow_phases.error\`
for that failed phase and compare it against the \`run_failed\` frame.**

- **Column populated** ⇒ the defect is in *what the event carries*. Fix the emitter;
  \`PhaseCard.tsx:253\` needs nothing.
- **Column empty too** ⇒ the defect is in the *executor's failure path*.

⚠ **Deciding before measuring is how the phase fixes the wrong half** — and the sentinel is an
*honesty mechanism*, so firing it when the reason is known trains readers to distrust it.
**Its condition narrows; its words do not change.**
`
  fs.writeFileSync(path.join(DIR, "BUILD-CONTRACT.generated.md"), out)
  console.log("  ✎ BUILD-CONTRACT.generated.md written from the running sketch\n")
}
