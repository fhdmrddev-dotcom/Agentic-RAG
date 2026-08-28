#!/usr/bin/env node
/**
 * ⭐ THE DRIVE SCRIPT — sketch 214, Phase 214.
 *
 * ⚠ ITS ASSERTIONS **ARE** THE BUILD CONTRACT, IN EXECUTABLE FORM. `feedback_sketch_to_build_drift`
 * records the cause of drift four times over and it is mechanical, never carelessness: a sketch is
 * HTML/CSS, the build is React + Tailwind + shadcn, **nothing transfers automatically**, and prose
 * does not typecheck.
 *
 *   node drive.cjs           run the assertions
 *   node drive.cjs --emit    ALSO write BUILD-CONTRACT.generated.md FROM the running sketch
 *
 * ⚠ The contract is GENERATED, never transcribed. Do not hand-edit `BUILD-CONTRACT.generated.md`.
 *
 * No dependencies: regex over the source, deliberately — a DOM library would be a second thing to
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

// Rendered TEXT, tags stripped, PLUS the user-visible attributes — a copy table that cannot see
// `placeholder` / `aria-label` is blind to a whole class of user-facing strings. (213's measured
// lesson, ported.)
const ATTR_COPY = [...HTML.matchAll(/(?:placeholder|aria-label|title)="([^"]*)"/g)].map((m) => m[1]).join(" | ")
const TEXT = (HTML.replace(/<[^>]+>/g, " ") + " | " + ATTR_COPY).replace(/\s+/g, " ")

// ⚠ `SURFACE` IS THE SKETCH MINUS ITS OWN ANNOTATION, AND THE DISTINCTION IS LOAD-BEARING.
// A sketch that explains itself in prose ("no key/value rows, no JSON") would otherwise trip
// its own SC#1 fence on the sentence saying the surface is clean. Annotation carries
// `data-anno`; it is for the reader of the sketch and is never copy the build ports.
//
// ⚠ THE FENCE THAT RUNS OVER THE WHOLE FILE (the `<textarea>` one) DELIBERATELY DOES NOT USE
// THIS. A textarea hidden inside a note would still be a textarea.
const SURFACE_HTML = HTML
  .replace(/<(style|script)[\s\S]*?<\/\1>/g, " ")
  .replace(/<div id="variant-nav"[\s\S]*?<\/div>\s*(?=<!--)/, " ")
  .replace(/<(h2|h3|p|div)\b[^>]*\bdata-anno\b[^>]*>[\s\S]*?<\/\1>/g, " ")
const SURFACE = (SURFACE_HTML.replace(/<[^>]+>/g, " ") +
  // ⚠ `value` IS HARVESTED TOO, AND THE POSITIVE CONTROL BELOW IS WHAT FOUND THAT IT WAS NOT.
  // A JSON blob sitting in a pre-filled input is exactly the surface SC#1 forbids, and a fence
  // that reads only labels cannot see it.
  " | " + [...SURFACE_HTML.matchAll(/(?:placeholder|aria-label|value)="([^"]*)"/g)].map((m) => m[1]).join(" | ")
).replace(/\s+/g, " ")

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 · THE SKETCH RENDERS NOTHING NOT DECLARED IN `COPY.js`
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ THE DIRECTION THAT MATTERS IS COPY -> HTML. Asserting the reverse would only prove the
// table is big enough; this proves the sketch did not invent a sentence the build cannot import.
const literals = Object.entries(COPY).filter(([, v]) => typeof v === "string")
for (const [key, value] of literals) {
  ok(`COPY.${key} appears in the sketch`, TEXT.includes(value), `missing: "${value}"`)
}

const composed = [
  ["ARG_READING_ASK", COPY.ARG_READING_ASK("subject")],
  ["ARG_READING_UPSTREAM", COPY.ARG_READING_UPSTREAM("Draft the summary")],
  ["ARG_UNRENDERABLE", COPY.ARG_UNRENDERABLE("files")],
  ["ARG_LEFTOVER", COPY.ARG_LEFTOVER("cc")],
  ["ARG_STEP_IDENTITY", COPY.ARG_STEP_IDENTITY("Aether Mail", "Send an email")],
]
for (const [key, rendered] of composed) {
  const stripped = rendered.replace(/<\/?[a-z][^>]*>/g, "").replace(/\s+/g, " ").trim()
  ok(`COPY.${key}() renders`, TEXT.includes(stripped), `looked for: "${stripped}"`)
}

// ⚠ EVERY DASH IN THE TABLE IS AN EM DASH (U+2014). `doorVocabulary.test.ts` asserts the
// codepoint over its whole table and this vocabulary inherits the rule — a hyphen sneaking in
// is invisible in review and visible on screen.
for (const [key, value] of literals) {
  ok(`COPY.${key} uses no hyphen-as-dash`, !/ - /.test(value), `found " - " in: "${value}"`)
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 · ⛔ SC#1's HARD FENCE — NO JSON ARGUMENT SURFACE, ANYWHERE, UNDER ANY NAME
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ THIS IS THE MOST LOAD-BEARING ASSERTION IN THE FILE. D-214-06: *"a JSON box for the hard
// cases is the surface SC#1 forbids under a different name, and once it exists every hard case
// routes to it — which is exactly how `Tool Arguments (JSON)` became the only surface."*
//
// It fences the SKETCH. The React equivalent fences `PhaseFormPanel` + `McpToolPicker` and
// must ALSO assert the deletion of `MCP_TOOL_ARGS_LABEL` from `McpToolPicker.tsx:68`.
ok(
  "no <textarea> anywhere in the sketch",
  !/<textarea/i.test(HTML),
  "a textarea is the JSON box's shape whatever its label says",
)
const JSON_WORDS = [/Tool Arguments/i, /\bJSON\b/, /key\s*\/\s*value/i, /\braw\s+args?\b/i]
for (const re of JSON_WORDS) {
  ok(`no argument surface named ${re}`, !re.test(SURFACE), `matched on the surface: ${re}`)
}
// ⚠ AND NO "ADVANCED" DOOR — the escape hatch's usual disguise.
ok("no “Advanced” disclosure over the arguments", !/>\s*Advanced\s*</.test(SURFACE_HTML))
// ⚠ THE ANNOTATION-STRIPPER MUST ITSELF BE PROVED, or this whole fence quietly measures an
// empty string. A POSITIVE CONTROL: the surface still carries the argument rows and the copy.
ok("positive control — the surface is not empty", SURFACE.length > 2000, `${SURFACE.length} chars`)
ok("positive control — the surface still carries a real argument row", SURFACE.includes("procurement@aether.ai"))
ok("positive control — annotation really was removed", !SURFACE.includes("path of least resistance"))

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 · THE THREE SOURCE ARMS — EXACTLY THREE, EXACTLY ONE PRESSED PER GROUP
// ═══════════════════════════════════════════════════════════════════════════════════════
const groups = [...HTML.matchAll(/<(?:div|span) class="srcpick"[^>]*>([\s\S]*?)<\/(?:div|span)>/g)].map((m) => m[1])
ok("at least 9 source-picker groups rendered", groups.length >= 9, `found ${groups.length}`)
groups.forEach((g, i) => {
  const buttons = [...g.matchAll(/<button[^>]*>/g)]
  const pressed = [...g.matchAll(/aria-pressed="true"/g)]
  ok(`source group ${i} has exactly three arms`, buttons.length === 3, `has ${buttons.length}`)
  ok(`source group ${i} has at most one pressed arm`, pressed.length <= 1, `has ${pressed.length}`)
})
// Every group carries the three arms in the SAME ORDER — a control whose arms reorder between
// rows is a control a person has to re-read every time.
groups.forEach((g, i) => {
  const labels = [...g.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1].trim())
  ok(
    `source group ${i} arms are in the canonical order`,
    labels.join("|") === [COPY.ARG_SOURCE_FIXED, COPY.ARG_SOURCE_ASK, COPY.ARG_SOURCE_UPSTREAM].join("|"),
    `got: ${labels.join(" | ")}`,
  )
})
// Each group is a NAMED group, not three loose buttons — the accessible name is the question.
const namedGroups = [...HTML.matchAll(/class="srcpick"[^>]*role="group"[^>]*aria-label="([^"]*)"/g)].map((m) => m[1])
ok("every source picker is role=group", namedGroups.length === groups.length, `${namedGroups.length} of ${groups.length}`)
ok(
  "every source group is named by the question, not by a mechanism word",
  namedGroups.every((n) => n === COPY.ARG_SOURCE_GROUP_LABEL),
  `distinct names: ${[...new Set(namedGroups)].join(" · ")}`,
)

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 · THE GUTTER LANE IS ALWAYS RESERVED — NO ROW SHIFTS WHEN A SOURCE IS CHOSEN
// ═══════════════════════════════════════════════════════════════════════════════════════
// The 213 precedent, ported: without a reserved lane the row jumps when the state changes, a
// jitter no test catches and every scrolling eye does. Here the lane is a grid COLUMN that is
// `0` at rest and `118px` under `.gutter-on` — the transition is on the grid, so the label
// column's own offset rule is a single declaration in both states.
ok(
  ".arow reserves a zero-width gutter column at rest",
  /\.arow\s*\{[^}]*grid-template-columns:\s*0\s+minmax\(0,1fr\)/.test(HTML),
)
ok(
  ".gutter-on widens the SAME column rather than inserting one",
  /\.gutter-on \.arow\s*\{\s*grid-template-columns:\s*118px\s+minmax\(0,1fr\)/.test(HTML),
)
ok(
  "the gutter column is animated, not toggled",
  /\.arow\s*\{[^}]*transition:\s*grid-template-columns/.test(HTML),
)

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5 · D-214-02 — THE UPSTREAM BINDING IS STRUCTURALLY INCAPABLE OF BECOMING AN EXPRESSION
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ NO DOTTED PATHS, NO `{{ }}`, NO OUTPUT-KEY SUB-PICKER. This is what keeps D-09 intact
// (`_adapter_args`: *"No expression language, no templating surface … a closed two-column
// lookup"*). The React equivalent asserts the STORED SHAPE is a bare phase slug.
ok("no {{ }} templating anywhere", !/\{\{/.test(HTML))
ok("no dotted output path in rendered text", !/\bprior_run\.|\boutputs?\.[a-z_]+\b/.test(TEXT))
ok(
  "the upstream binding renders the AUTHOR'S OWN NAME for the step",
  TEXT.includes("Draft the summary"),
)
// ⚠ AND IT MUST NOT RENDER A SLUG. A slug on this surface is the mechanism talking, and it is
// also how an author comes to believe there is a path to type.
ok("no phase slug rendered beside the binding", !/draft[-_]the[-_]summary/i.test(HTML))
ok(
  "the upstream chip carries no field selector",
  !/Draft the summary\s*(?:\.|→|›)\s*[a-z_]+/i.test(TEXT),
)

// ═══════════════════════════════════════════════════════════════════════════════════════
// 6 · THE ARGUMENTS ARE THE ADAPTER'S OWN — NOT INVENTED, NOT STITCH'S
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⭐ THE FINDING THIS SKETCH EXISTS TO CATCH. Stitch drew `Cc` and `Reply to` rows.
// `smtp_adapter.INPUT_SCHEMA` declares EXACTLY three properties under
// `additionalProperties: False`, so a `cc` argument does not merely go unsupported — the
// adapter REFUSES THE WHOLE SEND. A sketch that drew five fields would have specified a form
// the backend structurally cannot accept.
const SEND_EMAIL_PROPS = ["to", "subject", "body"] // smtp_adapter.py:296-315, verbatim
for (const p of SEND_EMAIL_PROPS) {
  ok(`send_email argument "${p}" is rendered`, new RegExp(`data-arg="${p}"`).test(HTML))
}
ok(
  'no "cc" or "reply_to" is drawn as a FILLABLE send_email row',
  ![...HTML.matchAll(/data-arg="(cc|reply_to|replyTo)"/g)].length,
  "the adapter refuses an undeclared key — a field for one specifies an impossible form",
)
// It IS allowed to appear as a leftover the author can remove (D-214-08) — and it does.
ok('"cc" appears only as a removable leftover', TEXT.includes(COPY.ARG_LEFTOVER("cc")))
// Every argument row states whether it is required. An unmarked row is a row whose refusal
// arrives later, at publish, for a reason nobody could see here.
const rows = [...HTML.matchAll(/<div class="arow"([^>]*)>/g)].map((m) => m[1])
ok(
  "every argument row declares data-required",
  rows.every((r) => /data-required="(yes|no)"/.test(r)),
  `${rows.filter((r) => !/data-required=/.test(r)).length} row(s) without it`,
)
ok(
  "every argument row declares data-source",
  rows.every((r) => /data-source="(fixed|ask|upstream|none)"/.test(r)),
)
ok("at least one row is in the unsourced state", rows.some((r) => /data-source="none"/.test(r)))

// ═══════════════════════════════════════════════════════════════════════════════════════
// 7 · THE FOUR HARD STATES ARE ALL PRESENT, AND NONE OF THEM IS A BLANK
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ "Unknown" and "satisfied" must not look the same (D-214-07). Each state SAYS something.
const STATES = [
  ["nothing supplies this yet", COPY.ARG_NO_SOURCE],
  ["cannot draw a field for it", COPY.ARG_UNRENDERABLE("files")],
  ["required + unrenderable ⇒ unusable", COPY.ARG_UNRENDERABLE_REQUIRED],
  ["optional + unrenderable ⇒ still runs", COPY.ARG_UNRENDERABLE_OPTIONAL],
  ["schema unknown", COPY.ARG_SCHEMA_UNKNOWN],
  ["leftover key", COPY.ARG_LEFTOVER("cc")],
]
for (const [name, sentence] of STATES) {
  ok(`state present: ${name}`, TEXT.includes(sentence.replace(/\s+/g, " ")))
}
// ⚠ EACH REFUSING STATE NAMES A NEXT ACTION. The ROADMAP's own words: *a refusal is only honest
// if it names the next action.*
ok("the unknown-schema state offers a next action", TEXT.includes(COPY.ARG_SCHEMA_UNKNOWN_NEXT))
ok("the leftover-key state offers a next action", TEXT.includes(COPY.ARG_LEFTOVER_NEXT))
// ⭐ AND THAT NEXT ACTION IS THE SHIPPED LABEL, CHARACTER FOR CHARACTER — `McpToolPicker.tsx:58`
// already ships `MCP_DISCOVER_BUTTON_LABEL = "Refresh actions"`. Two doors onto one act must not
// acquire two names.
ok(
  "re-discovery reuses the SHIPPED MCP_DISCOVER_BUTTON_LABEL",
  COPY.ARG_SCHEMA_UNKNOWN_NEXT === "Refresh actions",
  `got "${COPY.ARG_SCHEMA_UNKNOWN_NEXT}", shipped is "Refresh actions"`,
)

// ═══════════════════════════════════════════════════════════════════════════════════════
// 8 · D-214-03 — THE SILENT AUTO-FILL IS NOW VISIBLE, AND IT IS STILL CHANGEABLE
// ═══════════════════════════════════════════════════════════════════════════════════════
// `_BODY_ARG_FOR_CAPABILITY` fills `body` from the previous phase today and says nothing
// (`phase_types.py:2151`). The BEHAVIOUR is unchanged; the SILENCE is what ends. ⚠ An invisible
// rule is what `BUG-260826-01` was.
const bodyRow = HTML.match(/<div class="arow" data-arg="body"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/)
ok("the body row exists", !!bodyRow)
ok("the body row is pre-set to the upstream step", /data-arg="body"[^>]*data-source="upstream"/.test(HTML))
ok("the pre-set is stated, not silent", TEXT.includes(COPY.ARG_PRESET_NOTE))
// It must still be an ordinary row: three arms, none of them disabled.
ok(
  "the pre-set row's control is not disabled",
  !/data-arg="body"[\s\S]{0,1400}<button[^>]*disabled/.test(HTML),
)

// ═══════════════════════════════════════════════════════════════════════════════════════
// 9 · THE TWO PANEL TRACKS, BOTH DRAWN, BOTH NAMED
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ THE FORK IS JUDGED BY LOOKING, NOT BY ARGUMENT — so both must actually be in the file, over
// identical content. §4 is the comparison; A and B are the full surfaces.
ok("the shipped 400px track is drawn", /grid-template-columns:\s*minmax\(0,1fr\)\s*400px/.test(HTML))
ok(
  "the Settings clamp track is drawn",
  /grid-template-columns:\s*minmax\(0,1fr\)\s*clamp\(480px,\s*38%,\s*640px\)/.test(HTML),
)
// ⚠ 480 IS NOT A NEW MAGIC NUMBER — it is `ConnectionsTab.tsx:387`, shipped since Phase 213.
ok("the clamp is named as the shipped house pattern", /ConnectionsTab\.tsx:387/.test(HTML))
// ⚠ AND THE PIN THAT WOULD HAVE TO CHANGE IS NAMED IN THE SKETCH. Phase 213 discovered
// `ConnectionFormPanel.test.tsx:571` pinned 400px only when the plan was already running.
ok("the at-risk width pin is named", /WorkflowBuilderPage\.tsx:2817/.test(HTML))

// ═══════════════════════════════════════════════════════════════════════════════════════
// 10 · THE HOUSE FENCES THAT APPLY TO ANY SURFACE IN THIS APP
// ═══════════════════════════════════════════════════════════════════════════════════════
// The shipped §12 fence, already asserted in `ConnectionFormPanel.test.tsx`: a `title` is a
// tooltip a keyboard and a phone never see, so copy must never live in one.
const titles = [...HTML.matchAll(/\stitle="([^"]*)"/g)].map((m) => m[1]).filter((t) => t.trim() !== "")
ok(
  "no [title] carries user-facing copy",
  titles.every((t) => t === "theme"),
  `found: ${titles.filter((t) => t !== "theme").join(" | ")}`,
)
// The raw capability id never reaches the DOM from an authoring surface
// (`ExternalActionSection.tsx`'s own rule). The author reads sentences; the ids are wire values.
for (const id of ["send_email", "create_ticket", "post_message"]) {
  ok(`the capability id "${id}" is not rendered to the author`, !TEXT.includes(id))
}
// ⚠ AT MOST THREE STATE COLOURS ON SCREEN AT ONCE — the house ceiling, and 213's measured
// reason for recolouring the override mark. Here: primary (authored), warning (unsatisfied),
// and the neutral ink. `--color-danger` is reserved for genuinely irreversible acts and an
// unfilled argument is not one.
ok(
  "the argument form spends no destructive colour",
  !/\.a(row|gutter|label|slot)[^{]*\{[^}]*--color-danger/.test(HTML),
)
ok("--color-danger is unused in this sketch", !/var\(--color-danger/.test(HTML))

// ═══════════════════════════════════════════════════════════════════════════════════════
// 11 · SC#4 ONE SCREEN EARLY — THE STEP NAMES ITS SERVICE AND ITS ACTION
// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ Never "external action". The identity a person needs is the SERVICE and the ACTION, and
// the authoring surface is the first place it has to be true.
ok("the step identity names the service", TEXT.includes("Aether Mail"))
ok("the step identity names the action in words", TEXT.includes("Send an email"))
ok('the words "external action" never appear', !/external action/i.test(TEXT))

// ═══════════════════════════════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════════════════════════════
const total = pass + failures.length
console.log(`\n  sketch 214 — argument form and its source`)
console.log(`  ${pass} passed, ${failures.length} failed  (${total} assertions)\n`)
if (failures.length) {
  for (const f of failures) console.log(`   ✗  ${f}`)
  console.log("")
  process.exitCode = 1
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// --emit · THE BUILD CONTRACT, GENERATED FROM THE RUNNING SKETCH
// ═══════════════════════════════════════════════════════════════════════════════════════
if (process.argv.includes("--emit")) {
  const copyRows = literals
    .map(([k, v]) => `| \`${k}\` | ${JSON.stringify(v)} |`)
    .join("\n")
  const composedRows = Object.entries(COPY)
    .filter(([, v]) => typeof v === "function")
    .map(([k, fn]) => `| \`${k}(…)\` | ${JSON.stringify(fn("«x»", "«y»"))} |`)
    .join("\n")

  const out = `# BUILD CONTRACT — sketch 214, the argument form and its source

⚠ **GENERATED by \`node drive.cjs --emit\` FROM the running sketch. Do not hand-edit.**
Regenerate after any change to \`index.html\` or \`COPY.js\`.

**State at generation: ${pass} passed, ${failures.length} failed (${total} assertions).**
Argument rows rendered: **${rows.length}** · source-picker groups: **${groups.length}**.

---

## 1 · The vocabulary that ports

Becomes \`frontend/src/components/workflows/argumentVocabulary.ts\`, beside the shipped
\`phaseVocabulary.ts\` / \`doorVocabulary.ts\`. ⚠ **The build imports these ids; it does not retype
the sentences.** A sentence living inside a component is a sentence nobody can test for drift.

| id | value |
|---|---|
${copyRows}

### Composed

| id | shape |
|---|---|
${composedRows}

---

## 2 · Each invariant → the React equivalent Phase 214's suite must reproduce

| # | invariant asserted here | React equivalent |
|---|---|---|
| 1 | **no \`<textarea>\`, no "JSON", no "Tool Arguments", no key/value, no "Advanced"** anywhere | a \`?raw\` source fence over \`PhaseFormPanel\` + \`McpToolPicker\` + the new argument component, **with a positive control** — and an assertion that \`MCP_TOOL_ARGS_LABEL\` no longer exists |
| 2 | every source group has **exactly three arms, at most one pressed** | \`getAllByRole("radio")\` is length 3 per group; \`{checked:true}\` is length ≤ 1 |
| 3 | the three arms are in the **same order in every group** | assert the accessible names in order, per group |
| 4 | every group's accessible name is \`${JSON.stringify(COPY.ARG_SOURCE_GROUP_LABEL)}\` | \`getByRole("radiogroup", {name})\` per row |
| 5 | the gutter lane is a **grid column that widens**, never one that is inserted | assert an unsourced and a sourced row have **identical** label-column offsets |
| 6 | **no \`{{ }}\`, no dotted path, no slug** beside the binding | assert the stored value is a bare phase slug **and** that the slug never reaches the DOM |
| 7 | the upstream chip carries the **author's own name** for the step | render a phase whose name ≠ its slug; assert the name |
| 8 | exactly the adapter's own properties are drawn — \`${SEND_EMAIL_PROPS.join("`, `")}\` for \`send_email\` | drive the renderer from \`inputSchema\` (\`descriptors.py:169\`) and assert **no field exists for an undeclared key** |
| 9 | a leftover key renders as **removable**, never dropped | seed \`tool_args\` with \`cc\`; assert it is visible and has a remove control |
| 10 | every row declares **required** and **source** | assert both are derivable from the DOM for every row |
| 11 | the \`body\` row is **pre-set and still changeable** | assert the pre-set source, the stated note, and that the control is enabled |
| 12 | **no \`[title]\` carries copy** | the shipped §12 fence |
| 13 | **no capability id reaches the DOM** — \`send_email\` / \`create_ticket\` / \`post_message\` | the shipped fence in \`ExternalActionSection.test.tsx\`, extended to the argument form |
| 14 | the form spends **no destructive colour** | assert \`--destructive\` is absent from the argument rules |
| 15 | the step names its **service and action**, never "external action" | assert both strings; assert the phrase is absent |

---

## 3 · ⚠ What this sketch found that Stitch could not

⭐ **Stitch drew \`Cc\` and \`Reply to\` rows for \`send_email\`.** The shipped
\`smtp_adapter.INPUT_SCHEMA\` (\`smtp_adapter.py:293-311\`) declares **exactly three** properties —
\`to\`, \`subject\`, \`body\` — under \`additionalProperties: False\`, and the adapter **raises
\`SmtpArgumentsInvalid\` on any undeclared key**. A \`cc\` field would not be an unsupported nicety;
it would specify a form whose every submission the backend refuses outright.

That is the whole argument for step 4 existing: **Stitch renders zero shipped components, so it
cannot know what the backend accepts.** The sketch does, and the difference showed up in the first
row it drew.

---

## 4 · The open fork this sketch does NOT decide

**The panel track.** Both are drawn over identical content (§4). ⚠ **The consequence is
conditional, and the plan must carry whichever half the operator picks:**

- **400px** ⇒ the source **gutter is dropped** and variant **C**'s inline control is the shape.
  No width pin changes.
- **\`clamp(480px, 38%, 640px)\`** ⇒ variant **B**'s gutter ships, and
  \`WorkflowBuilderPage.tsx:2817\` **and whatever pins it** change in the same commit — the exact
  shape of Phase 213's \`ConnectionFormPanel.test.tsx:571\`, which pinned \`400px\` and was
  discovered only once the plan was already running.
`
  fs.writeFileSync(path.join(DIR, "BUILD-CONTRACT.generated.md"), out)
  console.log("  ✎ BUILD-CONTRACT.generated.md written from the running sketch\n")
}
