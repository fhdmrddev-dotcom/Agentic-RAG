#!/usr/bin/env node
/**
 * SKETCH 165 BUILDER — assembles body.generated.html + BUILD-CONTRACT.generated.md.
 *
 * ── THE MECHANISM (inherited from 164, unchanged) ────────────────────────────
 * `dom.generated.json` is the REAL rendered DOM of the real `WorkflowDoorSwitch`
 * (describe door) and the real `TemplateAttachSection`, captured under jsdom by
 * `emit.test.tsx.src`. Variant A is that DOM byte-for-byte. B and C are the SAME
 * DOM with a block SPLICED IN at one anchor.
 *
 * ── WHAT IS DIFFERENT ABOUT 165, AND IT MATTERS ──────────────────────────────
 * 164's template panel was a pure PROPOSAL — it drew nodes no component had, and
 * said so. 165's central surface is NOT a proposal: `TemplateAttachSection.tsx`
 * shipped in Phase 193 and grew its fields list in quick task 260814-q5r. So the
 * "what this template asks for" region on this page is the SHIPPED component's own
 * DOM, with the SHIPPED eight keys of the real `pm-weekly-status-report.docx`.
 *
 * ⇒ Variant B is not a drawing of what mounting that component would look like.
 *   It IS that component, mounted. Including its costs.
 *
 * ── EVERY ANCHOR IS ASSERTED BEFORE IT IS USED ───────────────────────────────
 * A splice into a string that is not there fails silently and produces a variant
 * that quietly equals the baseline — a green-looking sketch showing nothing. So
 * every anchor is checked for presence AND for uniqueness, and the build exits
 * non-zero on either failure. That is this sketch's analogue of 164's substitution
 * audit, moved from copy to structure because this sketch varies structure.
 *
 * ── WHAT THIS STILL CANNOT PROVE, SAID PLAINLY ───────────────────────────────
 * 1. The ATTACH CONTROL on the pre-draft screen (`📎 Filling in a template?`) and
 *    the stateless read behind it exist in NO component. Marked NEW in the
 *    contract. Ordinary sketch-drift risk applies there and nowhere else.
 * 2. Variant C RE-SCALES the shipped section's type. Its field STRINGS are parsed
 *    out of the real dump (so the data cannot drift), but its wrapper is a
 *    proposed `scale` prop on the shipped component, marked CHANGE. C is a
 *    proposal about presentation; B is a measurement of the status quo.
 * 3. Hover/focus states and pixel spacing stay a human comparison at UAT.
 */
const fs = require("node:fs")
const path = require("node:path")

const HERE = __dirname
const dom = JSON.parse(fs.readFileSync(path.join(HERE, "dom.generated.json"), "utf8"))

/* ── The audit ledger. Every assertion this build makes, recorded so the contract
      reports what was checked rather than asserting that checking happened. ── */
const audit = []
function assertAnchor(haystackName, needle, label) {
  const n = dom[haystackName].split(needle).length - 1
  audit.push({ label, anchor: needle.slice(0, 72), inDump: haystackName, count: n, ok: n === 1 })
  if (n !== 1) {
    console.error(
      `ANCHOR FAILURE [${label}] — expected exactly 1 occurrence in dumps.${haystackName}, found ${n}\n  ${needle}`,
    )
    process.exitCode = 1
  }
  return needle
}

/**
 * THE SPLICE POINT. The CTA group (`Write the first draft` + the hint) is the block
 * that follows the KB picker in the describe column, so inserting immediately BEFORE
 * it puts the new control exactly where the operator placed it on 2026-08-14: under
 * the knowledge-base picker, above the draft button.
 *
 * ⚠ Anchored on the CTA GROUP rather than on the KB picker's own closing tag, and the
 *   reason is mechanical: the picker's `</label>` is not unique in the document, and an
 *   anchor that matches twice splices into whichever came first. Line numbers are
 *   deliberately not used anywhere in this file — this project has corrected stale line
 *   numbers in five of six waves of Phase 192 alone.
 */
const CTA_GROUP = assertAnchor(
  "describe",
  '<div class="flex flex-col items-center gap-3">',
  "the CTA group — splice point for the template control",
)

/* The KB picker must actually be on screen, or the placement question is unjudgeable. */
assertAnchor("describe", 'data-testid="project-folder-picker"', "the KB picker is rendered")
assertAnchor("describe", 'data-testid="describe-box"', "the describe box is rendered")
assertAnchor("describe", 'data-testid="switch-strip"', "the switch-to-govern strip is rendered")

/* The shipped fields region, and the eight real keys inside it. */
assertAnchor("fieldsOk", 'data-testid="template-fields"', "the shipped fields list is rendered")
assertAnchor("unsaved", 'data-testid="template-unsaved"', "the shipped unsaved refusal is rendered")

/**
 * THE EIGHT FIELD NAMES, PARSED OUT OF THE REAL DUMP rather than re-typed here.
 * Re-typing them would create a second copy free to drift from the component that
 * rendered them — the same failure `doorVocabulary.ts` exists to prevent. Variant C
 * re-presents this data; it does not re-author it.
 */
const FIELDS = [...dom.fieldsOk.matchAll(/<li class="break-all">([^<]+)<\/li>/g)].map((m) => m[1])
audit.push({
  label: "the eight keys were PARSED from the real dump, not re-typed",
  anchor: FIELDS.join(", "),
  inDump: "fieldsOk",
  count: FIELDS.length,
  ok: FIELDS.length === 8,
})
if (FIELDS.length !== 8) {
  console.error(`FIELD PARSE FAILURE — expected 8 keys from dumps.fieldsOk, got ${FIELDS.length}`)
  process.exitCode = 1
}

const TEMPLATE_FILENAME = "pm-weekly-status-report.docx"

/* ══════════════════════════════════════════════════════════════════════════════
   THE NEW NODES — every one of them declared here, once, and rendered into the
   contract from this same table. Nothing user-visible is typed into the HTML
   below that is not in this list.
   ══════════════════════════════════════════════════════════════════════════════ */
const NEW_COPY = {
  ctrlLabel: "Filling in a template?",
  ctrlNote: "Attach the document this should fill in — the draft is built to its fields.",
  ctrlButton: "Attach a template",
  ctrlTypes: "Word, PowerPoint or Excel — .docx, .pptx or .xlsx, up to 10 MB.",
  specHeading: "What this template asks for",
  specPromise: "The draft will be built to fill these 8 fields.",
  specFilenameLead: "Drafting to",
  ctaWithTemplate: "Write the first draft",
  hintWithTemplate:
    "The AI writes the steps that gather what these fields need — then you review what it chose.",
}

const NEW_ROWS = [
  {
    id: "ctrl.label",
    status: "NEW",
    where: "describe door — a new row directly below the KB picker's <label>",
    text: NEW_COPY.ctrlLabel,
    rule: "A QUESTION, not a noun. The KB picker above it already asks a question ('Which knowledge base should this use?'); a bare 'Template' label would read as a third field to fill rather than an optional branch. It must also be ignorable at a glance — SC#4 says the fast door stays fast.",
  },
  {
    id: "ctrl.note",
    status: "NEW",
    where: "describe door — sub-note under ctrl.label",
    text: NEW_COPY.ctrlNote,
    rule: "States the CONSEQUENCE, which is the whole reason the phase exists: attaching changes what gets drafted. Without this sentence the control reads as a file upload that happens early, and SEED-157's defect (a draft built blind) survives with a control on screen.",
  },
  {
    id: "ctrl.button",
    status: "NEW",
    where: "describe door — the file input's label",
    text: NEW_COPY.ctrlButton,
    rule: "⚠ DELIBERATELY THE SHIPPED `TEMPLATE_ATTACH_LABEL` STRING, character for character. Two doors onto the same act must not have two names for it. If this phase changes the word, it changes it in `TemplateAttachSection.tsx` and both move.",
  },
  {
    id: "ctrl.types",
    status: "SHIPPED",
    where: "TemplateAttachSection.tsx — TEMPLATE_TYPES_NOTE",
    text: NEW_COPY.ctrlTypes,
    rule: "Inherited verbatim. The accepted set is a server rule; a second copy of it here would be free to drift from the gate that actually refuses (D-182-06).",
  },
  {
    id: "spec.heading",
    status: "SHIPPED",
    where: "TemplateAttachSection.tsx — TEMPLATE_FIELDS_HEADING",
    text: NEW_COPY.specHeading,
    rule: "Inherited verbatim. This heading already ships on the rail; the pre-draft screen showing the SAME words for the same list is what makes the two surfaces read as one fact rather than two features.",
  },
  {
    id: "spec.promise",
    status: "NEW",
    where: "describe door — one line under the fields list (variants B and C)",
    text: NEW_COPY.specPromise,
    rule: "⚠ THE ONE SENTENCE THAT MAKES SC#2 VISIBLE. Everything else on this screen says what the TEMPLATE contains; only this says what the DRAFT will be aimed at. ⚠ It states a COUNT, so it must be derived from the list rendered above it and never hardcoded — a '8' beside a list of 5 is the exact class of silent lie SEED-157 is about.",
  },
  {
    id: "spec.filenameLead",
    status: "NEW",
    where: "describe door — variant C's spec-block header, before the filename",
    text: NEW_COPY.specFilenameLead,
    rule: "C only. Names the relationship rather than restating the file: the rail's own `📄 filename` line answers 'what is attached', this answers 'what is it FOR'.",
  },
  {
    id: "hint.withTemplate",
    status: "CHANGE",
    where: 'testid="describe-hint" — replaces the three-fragment sentence WHEN a template is attached',
    text: NEW_COPY.hintWithTemplate,
    rule: "⚠ A CHANGE TO A GOVERNED STRING. The shipped hint is composed of three `<b>` fragments carried in `doorVocabulary.ts` and pinned byte-exact by `WorkflowBuilderPage.describe.test.tsx`. Replacing it conditionally means a SECOND sentence in that module and a second pinned capture — it is not a copy edit, and it is called out here so planning prices it. If the phase declines it, the shipped sentence stays and this row is dropped: the screen still works, it just promises less.",
  },
  {
    id: "cta.withTemplate",
    status: "SHIPPED",
    where: 'testid="describe-draft"',
    text: NEW_COPY.ctaWithTemplate,
    rule: "⚠ DELIBERATELY UNCHANGED, and this is a decision rather than an omission. The button does the same thing whether or not a template is attached; a second verb ('Draft to this template') would suggest a second code path to a user who has one path. What changed is the INPUT, and the input is what the screen above the button now shows.",
  },
]

/* ══════════════════════════════════════════════════════════════════════════════
   THE SPLICED BLOCKS
   ══════════════════════════════════════════════════════════════════════════════ */

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/**
 * VARIANT B — the shipped `TemplateAttachSection`, mounted on the describe screen
 * with nothing changed. This is the "path of least resistance" variant the sketch
 * workflow requires, and it is here to be MEASURED rather than to win: it imports
 * the rail's 10.5px/11px type ramp onto a screen whose own smallest text is 13px.
 */
function blockB(sectionHtml, withPromise) {
  const promise = withPromise
    ? `<p class="mt-1.5 text-[10.5px] leading-snug text-muted-foreground" data-s165="spec.promise">${esc(
        NEW_COPY.specPromise,
      )}</p>`
    : ""
  // The promise line is injected INSIDE the shipped section, immediately after its
  // fields list — the only place it can sit without claiming a count for a list that
  // is not directly above it.
  const withLine = withPromise
    ? sectionHtml.replace("</ul></div>", `</ul>${promise}</div>`)
    : sectionHtml
  return `<div data-s165="block-b" class="flex flex-col gap-1.5"><span class="text-[13px] text-muted-foreground" data-s165="ctrl.label">${esc(
    NEW_COPY.ctrlLabel,
  )}</span>${withLine}</div>`
}

/**
 * VARIANT C — the same DATA, presented at the describe screen's own scale and framed
 * as a spec the draft is aimed at. The field strings come from `FIELDS`, parsed out of
 * the real dump; only the presentation is proposed.
 */
function blockCEmpty() {
  return `<label data-s165="block-c-empty" class="flex flex-col gap-1.5"><span class="text-[13px] text-muted-foreground" data-s165="ctrl.label">${esc(
    NEW_COPY.ctrlLabel,
  )}</span><div class="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border bg-card/40 px-3 py-2.5"><span aria-hidden="true" class="text-[15px]">📎</span><button type="button" class="rounded-md border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-accent/40" data-s165="ctrl.button">${esc(
    NEW_COPY.ctrlButton,
  )}</button><span class="text-[11.5px] leading-snug text-muted-foreground" data-s165="ctrl.types">${esc(
    NEW_COPY.ctrlTypes,
  )}</span></div><span class="text-[11.5px] leading-snug text-muted-foreground" data-s165="ctrl.note">${esc(
    NEW_COPY.ctrlNote,
  )}</span></label>`
}

function blockCFilled() {
  const items = FIELDS.map(
    (f) =>
      `<li class="flex items-center gap-1.5 text-[12.5px] leading-snug text-foreground/90"><span aria-hidden="true" class="text-[10px] text-primary">◆</span><span class="font-mono break-all">${esc(
        f,
      )}</span></li>`,
  ).join("")
  return `<div data-s165="block-c-filled" class="rounded-lg border border-primary/35 bg-primary/[0.04] px-4 py-3"><div class="flex flex-wrap items-baseline gap-2"><span class="text-[10px] font-bold uppercase tracking-wider text-primary" data-s165="spec.filenameLead">${esc(
    NEW_COPY.specFilenameLead,
  )}</span><span class="flex items-center gap-1.5 text-[13px] font-medium text-foreground"><span aria-hidden="true">📄</span><span class="break-all">${esc(
    TEMPLATE_FILENAME,
  )}</span></span><button type="button" class="ml-auto text-[11.5px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">Replace</button></div><p class="mt-2.5 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground" data-s165="spec.heading">${esc(
    NEW_COPY.specHeading,
  )}</p><ul class="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">${items}</ul><p class="mt-2.5 border-t border-primary/20 pt-2 text-[12px] leading-snug text-foreground/80" data-s165="spec.promise">${esc(
    NEW_COPY.specPromise,
  )}</p></div>`
}

/** Swap the shipped three-fragment hint for the template-aware one (row `hint.withTemplate`). */
function withTemplateHint(html) {
  const open = '<p data-testid="describe-hint" class="text-center text-[13px] text-muted-foreground">'
  const start = html.indexOf(open)
  if (start === -1) return html
  const end = html.indexOf("</p>", start)
  return (
    html.slice(0, start) +
    open +
    esc(NEW_COPY.hintWithTemplate) +
    html.slice(end)
  )
}

const splice = (block) => dom.describe.replace(CTA_GROUP, block + CTA_GROUP)

const STAGES = {
  a: dom.describe,
  bEmpty: splice(blockB(dom.fieldsIdle, false)),
  bFilled: withTemplateHint(splice(blockB(dom.fieldsOk, true))),
  cEmpty: splice(blockCEmpty()),
  cFilled: withTemplateHint(splice(blockCFilled())),
  wall: splice(blockB(dom.unsaved, false)),
}

/* Every splice must have CHANGED the baseline. A variant that silently equals A is
   the exact failure mode a green build would otherwise hide. */
for (const [name, html] of Object.entries(STAGES)) {
  if (name === "a") continue
  const changed = html !== dom.describe && html.length > dom.describe.length
  audit.push({
    label: `stage '${name}' actually differs from the shipped baseline`,
    anchor: `${dom.describe.length}B → ${html.length}B`,
    inDump: "describe",
    count: html.length - dom.describe.length,
    ok: changed,
  })
  if (!changed) {
    console.error(`SPLICE FAILURE [${name}] — variant is byte-identical to the baseline`)
    process.exitCode = 1
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   THE PAGE
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * ✅ THE OPERATOR'S PICK — 2026-08-14: VARIANT C, the spec block.
 *
 * The deciding reason is recorded because it is not the obvious one: B is cheaper and is
 * the path of least resistance, and it was rejected on a MEASUREMENT rather than a taste.
 * At intake — before a single variant existed — the operator chose "the fields ARE the
 * visible spec" over a quiet "8 fields found" receipt. B renders those fields at 10.5 px
 * under a 14 px knowledge-base picker (measured in the browser, not estimated), which
 * makes the most consequential thing on the screen also the quietest. B does not
 * contradict C on style; it contradicts the decision that produced the sketch.
 *
 * A and B STAY ON THE PAGE. They are the comparison that produced the pick — evidence,
 * not live options — and B in particular is the record of what "just mount it" costs.
 */
const WINNER = "c"

const TABS = [
  { id: "a", label: "A · Today (shipped)", badge: "baseline" },
  { id: "b", label: "B · Mount the shipped section", badge: "b" },
  { id: "c", label: "C · The spec block", badge: "c" },
  { id: "wall", label: "⚠ The wall", badge: "w" },
  { id: "contract", label: "The contract", badge: "p" },
].map((t) => (t.id === WINNER ? { ...t, label: `★ ${t.label}`, won: true } : t))

function stage(html, tall = true) {
  return `<div class="s165-stage${tall ? " s165-stage-tall" : ""}">${html}</div>`
}

function auditTable() {
  return `<table class="s165-table"><thead><tr><th>#</th><th>What was asserted</th><th>Against</th><th>Found</th><th></th></tr></thead><tbody>${audit
    .map(
      (a, i) =>
        `<tr><td>${i + 1}</td><td>${esc(a.label)}<div class="s165-where"><code>${esc(
          a.anchor,
        )}</code></div></td><td><code>dumps.${a.inDump}</code></td><td>${a.count}</td><td>${
          a.ok ? '<span class="s165-status s165-status-shipped">ok</span>' : '<span class="s165-status s165-status-new">FAIL</span>'
        }</td></tr>`,
    )
    .join("")}</tbody></table>`
}

function contractTable() {
  return `<table class="s165-table"><thead><tr><th>id</th><th></th><th>Where</th><th>Text</th><th>Why it is worded that way</th></tr></thead><tbody>${NEW_ROWS.map(
    (r) =>
      `<tr><td><code>${esc(r.id)}</code></td><td><span class="s165-status s165-status-${r.status.toLowerCase()}">${
        r.status
      }</span></td><td class="s165-where">${esc(r.where)}</td><td>${esc(r.text)}</td><td class="s165-rule">${esc(
        r.rule,
      )}</td></tr>`,
  ).join("")}</tbody></table>`
}

const body = `
<div class="s165-root">
  <header class="s165-head">
    <div class="s165-kicker">Sketch 165 · Phase 193.1 · AUTH-03 (re-opened) · G-2 gate</div>
    <h1>The template lands first</h1>
    <p class="s165-lede">Where does “I have a template” live on the pre-draft screen, and how do its fields become a spec the author can see the draft aimed at — without slowing down the person who has no template at all?</p>
    <div class="s165-mech">
      <strong>Generated FROM the build, not toward it.</strong>
      <p>Every door on this page is the <em>real</em> <code>WorkflowDoorSwitch</code> describe door, rendered under jsdom and dumped byte-for-byte. Variant&nbsp;A is that DOM unmodified. B and C are the same DOM with one block spliced in at one asserted anchor. <strong>Layout drift is impossible for everything that already ships</strong>, because the sketch’s layout <em>is</em> the build’s layout.</p>
      <p><strong>The fields list is not a drawing either.</strong> <code>TemplateAttachSection.tsx</code> shipped in Phase&nbsp;193 and grew its “what this template asks for” list in quick task <code>260814-q5r</code>. Variant&nbsp;B is that component <em>mounted</em>, not a picture of it. The eight keys are the real ones parsed from <code>pm-weekly-status-report.docx</code> — and they are parsed out of the dump by <code>build.cjs</code> rather than re-typed, so this page cannot show a field the component did not render.</p>
      <p class="s165-caveat"><strong>⚠ What is still an ordinary proposal:</strong> the attach <em>control</em> on this screen exists in no component (marked <code>NEW</code>), and variant&nbsp;C re-scales the shipped section’s type (marked <code>CHANGE</code>). C is a proposal about presentation; B is a <em>measurement</em> of what mounting the shipped thing here actually looks like. Judge them differently.</p>
    </div>
  </header>

  <div class="s165-winner"><strong>★ Winner — variant C, the spec block</strong> <span>operator, 2026-08-14</span><p>Chosen over the cheaper B on a <em>measurement</em>, not a taste: at intake — before any variant existed — the decision was that <strong>the fields ARE the visible spec</strong>, and B renders them at <strong>10.5 px under a 14 px picker</strong>, making the most consequential thing on the screen also the quietest. A and B stay on this page as the comparison that produced the pick — <strong>evidence, not live options</strong>. B in particular is the record of what “just mount it” costs.</p></div>

  <nav class="s165-tabs">${TABS.map(
    (t) =>
      `<button class="s165-tab${t.id === WINNER ? " s165-tab-on" : ""}${
        t.won ? " s165-tab-won" : ""
      }" data-tab="${t.id}">${esc(t.label)}</button>`,
  ).join("")}</nav>

  <section class="s165-panel" data-panel="a" hidden>
    <div class="s165-axis"><span class="s165-badge s165-badge-baseline">baseline</span><div><strong>Today, byte-identical.</strong><p>The shipped describe door with a real requirement typed in and real folders loaded. There is no template control anywhere on this screen, and none behind it either: the draft call sends <code>{describe, project_folder_id?}</code> and nothing else. A person whose deliverable is a fixed client format has no way to say so — and gets a workflow designed to answer a different question. That is <code>SEED-157</code>, and it is invisible: nothing fails.</p></div></div>
    ${stage(STAGES.a)}
  </section>

  <section class="s165-panel" data-panel="b" hidden>
    <div class="s165-axis"><span class="s165-badge s165-badge-b">B · least resistance</span><div><strong>Mount the shipped section, unchanged.</strong><p>The cheapest honest build: <code>TemplateAttachSection</code> already renders the attach control, the filename, the fields list and four honest failure arms. Put it on the describe screen and the work is mostly wiring.<br><strong>⚠ Look at the type.</strong> That section was built for the 320&nbsp;px inspector rail — its text is 10.5&nbsp;px and 11&nbsp;px, on a screen whose own smallest text is 13&nbsp;px. Mounted here, the most consequential thing on the page is also the quietest. That is the cost of least resistance, shown rather than described.</p></div></div>
    <h3 class="s165-h3">Before a template is attached</h3>
    <p class="s165-note">This is the state <strong>SC#4</strong> is about: the person with no template must be able to ignore this entirely. Ask yourself whether the eye still goes to the draft button.</p>
    ${stage(STAGES.bEmpty)}
    <h3 class="s165-h3">After — the eight real fields</h3>
    <p class="s165-note">The list, the heading and every sentence here are the shipped component’s own. Only the one line under the list — <code>spec.promise</code> — is new, and it is the only thing on screen that says what the <em>draft</em> will be aimed at.</p>
    ${stage(STAGES.bFilled)}
  </section>

  <section class="s165-panel" data-panel="c">
    <div class="s165-axis"><span class="s165-badge s165-badge-c">C · the spec block</span><div><strong>The same data, at this screen’s scale, framed as a contract.</strong><p>The fields stop being a note under a file picker and become the thing the draft is measured against — two columns, monospace keys, a rule above the promise line. The field strings are still the real eight, parsed from the same dump B renders.<br><strong>The cost, stated:</strong> this needs a <code>scale</code> prop on the shipped component (or a second presentation of one list, which is two homes and two homes drift). It is a real change to a file that shipped three weeks ago, not a mount.</p></div></div>
    <h3 class="s165-h3">Before a template is attached</h3>
    <p class="s165-note">A dashed, quiet affordance — deliberately lighter than the KB picker above it, because it branches rather than configures. <strong>SC#4 lives here:</strong> if this row makes the no-template author hesitate, C has failed regardless of how good the filled state looks.</p>
    ${stage(STAGES.cEmpty)}
    <h3 class="s165-h3">After — the fields as the spec</h3>
    <p class="s165-note">Compare against B’s filled state directly. Same eight keys, same promise sentence, same position on the page — the whole difference is how loudly the screen says <em>this is what your draft is for</em>.</p>
    ${stage(STAGES.cFilled)}
  </section>

  <section class="s165-panel" data-panel="wall" hidden>
    <div class="s165-axis"><span class="s165-badge s165-badge-p">the wall</span><div><strong>What the shipped component actually does at describe time — and why this phase needs a route that does not exist yet.</strong><p>At describe time <em>no workflow row exists</em>. The shipped upload route is <code>POST /workflows/{definition_id}/template</code> and is keyed on a saved definition, so <code>TemplateAttachSection</code> mounted here renders its <code>definitionId === null</code> arm: an amber refusal, and <strong>no file input at all</strong>.<br>The sentence below is not a mock. It is <code>TEMPLATE_UNSAVED_REFUSAL</code>, shipped, rendered: <em>“Save this draft first — a template attaches to a saved workflow. Use Save draft above, then attach.”</em> On a screen where there is nothing to save yet, that is a dead end.</p></div></div>
    <p class="s165-note"><strong>⚠ This is the scope-defining question the ROADMAP flags, drawn rather than argued.</strong> Three ways through it: a <strong>stateless read</strong> route that takes the bytes and returns the fields, persisting nothing until save (the recommendation on record — it keeps the “one writer on the definition JSONB” discipline and commits the author to nothing); <strong>creating an empty draft up front</strong> (collides with 186-07’s concurrency token and litters the library with abandoned rows); or a third shape. <strong>Variants B and C above assume the stateless read.</strong> If planning picks differently, both filled states change — which is why this tab exists instead of a footnote.</p>
    ${stage(STAGES.wall)}
  </section>

  <section class="s165-panel" data-panel="contract" hidden>
    <div class="s165-axis"><span class="s165-badge s165-badge-p">contract</span><div><strong>Every new or changed string, with the rule that produced it.</strong><p><code>SHIPPED</code> rows are inherited verbatim from <code>TemplateAttachSection.tsx</code> and must not be re-typed into new JSX — they are already exported identifiers. <code>NEW</code> rows have no component today. <code>CHANGE</code> rows touch something that already ships and are priced accordingly.</p></div></div>
    ${contractTable()}
    <h3 class="s165-h3">The structural audit — what this build checked before it drew anything</h3>
    <p class="s165-note">A splice into an anchor that is not there fails <em>silently</em> and produces a variant that quietly equals the baseline: a green-looking sketch showing nothing. So every anchor is asserted present <strong>and unique</strong>, the eight keys are asserted parsed rather than typed, and every stage is asserted to actually differ from the shipped DOM. The build exits non-zero on any row below reading <code>FAIL</code>.</p>
    ${auditTable()}
    <h3 class="s165-h3">What this sketch does NOT cover</h3>
    <p class="s165-note">Stated so a later reader does not over-trust the page — the <code>SEED-155</code> exposure in its “draws none” form.</p>
    <table class="s165-table"><thead><tr><th>Surface</th><th>Mockup here</th><th>Where it is settled</th></tr></thead><tbody>
      <tr><td>The template read <em>failing</em>, or finding no fields at all (<code>SEED-158</code>’s plain template)</td><td><strong>none</strong></td><td>Sketch <strong>166</strong></td></tr>
      <tr><td>A template attached to an <em>already-drafted</em> workflow, and the mismatch it exposes (SC#3)</td><td><strong>none</strong></td><td>Sketch <strong>167</strong></td></tr>
      <tr><td>The govern door</td><td><strong>none</strong>, deliberately</td><td>Out of scope — the govern door <em>is</em> the whole Builder, and this phase’s question is the describe side. Same limit sketch&nbsp;164 declared.</td></tr>
      <tr><td>Hover, focus and pixel spacing</td><td>not judgeable from a static page</td><td>A human comparison at UAT, driven <em>by looking</em> (D-27)</td></tr>
    </tbody></table>
  </section>
</div>
<script>
(function(){
  var tabs=[].slice.call(document.querySelectorAll('.s165-tab'));
  var panels=[].slice.call(document.querySelectorAll('.s165-panel'));
  tabs.forEach(function(t){
    t.addEventListener('click',function(){
      tabs.forEach(function(x){x.classList.remove('s165-tab-on')});
      t.classList.add('s165-tab-on');
      var id=t.getAttribute('data-tab');
      panels.forEach(function(p){p.hidden = p.getAttribute('data-panel')!==id});
      window.scrollTo({top:0,behavior:'smooth'});
    });
  });
})();
</script>
`

fs.writeFileSync(path.join(HERE, "body.generated.html"), body, "utf8")

/* ── The contract file, emitted from the SAME tables the page renders from, so it
      cannot go stale by being forgotten. ── */
const md = `<!-- GENERATED by build.cjs — do not hand-edit. Re-run the chain in README.md. -->
# Sketch 165 — build contract

Every user-visible string this sketch introduces or changes, with the rule behind it.
Emitted from \`build.cjs\`'s own \`NEW_ROWS\` table — the same table the page renders — so
the contract and the page cannot disagree.

## Status key

| status | meaning |
|---|---|
| \`SHIPPED\` | already an exported identifier in \`TemplateAttachSection.tsx\`. **Inherit it — do not re-type it into new JSX.** |
| \`NEW\` | no component renders this today. Ordinary sketch-drift risk applies. |
| \`CHANGE\` | touches something that already ships and is pinned by an existing test. Price it. |

## The rows

| id | status | where | text | rule |
|---|---|---|---|---|
${NEW_ROWS.map(
  (r) =>
    `| \`${r.id}\` | ${r.status} | ${r.where} | ${r.text.replace(/\|/g, "\\|")} | ${r.rule.replace(/\|/g, "\\|")} |`,
).join("\n")}

## The eight fields — parsed, never typed

\`\`\`
${FIELDS.join("\n")}
\`\`\`

Parsed by \`build.cjs\` out of \`dumps.fieldsOk\` (the real \`TemplateAttachSection\` render)
with \`/<li class="break-all">([^<]+)<\\/li>/g\`. **They are not re-typed anywhere in this
sketch**, so the page cannot display a field the shipped component did not render.
Source document: \`pm-weekly-status-report.docx\`, measured during quick task \`260814-q5r\`.

## The structural audit

${audit.length} assertions, ${audit.filter((a) => a.ok).length} passing, ${audit.filter((a) => !a.ok).length} failing.

| # | asserted | against | found | |
|---|---|---|---|---|
${audit
  .map(
    (a, i) =>
      `| ${i + 1} | ${a.label} — \`${a.anchor.replace(/\|/g, "\\|")}\` | \`dumps.${a.inDump}\` | ${a.count} | ${a.ok ? "ok" : "**FAIL**"} |`,
  )
  .join("\n")}

## Drift risk, per region

| region | source | drift risk |
|---|---|---|
| the describe door (header, box, KB picker, CTA, hint, switch strip) | real rendered DOM | **none** — it *is* the build |
| the fields list, its heading, the filename line, the failure copy | real rendered \`TemplateAttachSection\` | **none** — it *is* the build |
| the attach control on the pre-draft screen | proposed | **ordinary** |
| variant C's type scale and two-column grid | proposed (\`CHANGE\`) | **ordinary** |
| the stateless-read route the filled states assume | does not exist | **scope decision — see the ⚠ The wall tab** |
`

fs.writeFileSync(path.join(HERE, "BUILD-CONTRACT.generated.md"), md, "utf8")

console.log(
  `body.generated.html + BUILD-CONTRACT.generated.md written — ${audit.length} assertions, ${
    audit.filter((a) => !a.ok).length
  } failing, ${FIELDS.length} fields parsed`,
)
