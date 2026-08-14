#!/usr/bin/env node
/**
 * SKETCH 166 BUILDER — assembles body.generated.html + BUILD-CONTRACT.generated.md.
 *
 * ── THE MECHANISM (inherited from 164/165) ───────────────────────────────────
 * `dom.generated.json` is the REAL rendered DOM of the real `WorkflowDoorSwitch`
 * describe door and of the real `TemplateAttachSection` in ALL FIVE of its reading
 * states. Every variant on this page is that DOM with one block spliced in at one
 * asserted anchor.
 *
 * ── THE QUESTION, STATED SO IT CANNOT BE MISREAD ─────────────────────────────
 * The five shipped sentences are NOT under review. They are honest, they are
 * exported identifiers, and two of them carry a docblock warning that they may
 * never merge. This sketch does not touch a character of them.
 *
 * The question is what the *DRAFT* says about itself on the four arms where there
 * are no eight fields. Today the answer is NOTHING — the fields region reports on
 * the template and falls silent, and the draft proceeds exactly as it would have
 * with no template at all. That is `SEED-157`'s defect recurring with a control on
 * screen, which is strictly worse than not having the control: the author has been
 * shown a sentence about their file and has no way to know the draft ignored it.
 *
 * ── WHAT THIS BUILD ASSERTS BEFORE IT DRAWS ──────────────────────────────────
 * That every arm's own testid is present in its own dump AND absent from the other
 * four. That is the mechanical form of "these sentences may never merge": if a
 * future refactor made `none` and `unavailable` render the same node, this build
 * would exit non-zero rather than draw a page that quietly lost the distinction.
 */
const fs = require("node:fs")
const path = require("node:path")

const HERE = __dirname
const dom = JSON.parse(fs.readFileSync(path.join(HERE, "dom.generated.json"), "utf8"))

const audit = []
function assert(label, detail, ok, found) {
  audit.push({ label, detail, ok, found })
  if (!ok) {
    console.error(`ASSERTION FAILURE [${label}] — ${detail} (found ${found})`)
    process.exitCode = 1
  }
}

/* ── The five arms, and the testid each one is REQUIRED to render and required NOT
      to share. This table is the whole safety net of this sketch. ── */
const ARMS = [
  {
    key: "armFields",
    id: "fields",
    testid: "template-fields",
    label: "fields",
    file: "pm-weekly-status-report.docx",
    server: '`ok`, 8 keys',
    means: "We opened it and it asks for these eight things.",
  },
  {
    key: "armLoading",
    id: "loading",
    testid: "template-fields-loading",
    label: "loading",
    file: "pm-weekly-status-report.docx",
    server: "in flight",
    means: "We are still opening it. This is a real reading, not a flash — the fields settle after the filename does.",
  },
  {
    key: "armNone",
    id: "none",
    testid: "template-fields-none",
    label: "none",
    file: "weekly-report-blank.docx",
    server: '`ok`, 0 keys',
    means:
      "We opened it and it carries no fill-in fields. ⚠ SEED-158: this is the COMMON real-world case — a client template written in plain language with no {{ }} tokens anywhere.",
  },
  {
    key: "armNotWord",
    id: "not-word",
    testid: "template-fields-not-word",
    label: "not-word",
    file: "qbr-deck.pptx",
    server: '`ok`, 0 keys + a non-.docx filename',
    means:
      "The same server answer as `none`, reached through a different sentence because the parser only reads Word documents. Two of the three accepted upload types land here.",
  },
  {
    key: "armUnavailable",
    id: "unavailable",
    testid: "template-fields-unavailable",
    label: "unavailable",
    file: "pm-weekly-status-report.docx",
    server: "`unreadable` / unreachable",
    means:
      "⚠ We NEVER OPENED IT. This says nothing about the document. It may never be worded like `none` — the whole defect being prevented is an author concluding their template is field-less when we never looked.",
  },
]

/* Each arm renders ITS testid… */
for (const arm of ARMS) {
  const n = dom[arm.key].split(`data-testid="${arm.testid}"`).length - 1
  assert(
    `arm '${arm.id}' renders its own node`,
    `data-testid="${arm.testid}" in dumps.${arm.key}`,
    n === 1,
    n,
  )
}
/* …and NOT any other arm's. This is "the two sentences that may never merge", mechanised. */
for (const arm of ARMS) {
  for (const other of ARMS) {
    if (other.id === arm.id) continue
    // `template-fields` is a prefix of `template-fields-loading` etc, so compare the
    // full attribute rather than the bare id — otherwise every arm would "contain" it.
    const n = dom[arm.key].split(`data-testid="${other.testid}"`).length - 1
    if (n !== 0) {
      assert(
        `arm '${arm.id}' does NOT render arm '${other.id}'s node`,
        `data-testid="${other.testid}" absent from dumps.${arm.key}`,
        false,
        n,
      )
    }
  }
}
assert(
  "no arm renders any other arm's node",
  "every pair checked — the mechanised form of 'these sentences may never merge'",
  audit.every((a) => a.ok),
  ARMS.length * (ARMS.length - 1),
)

const CTA_GROUP = '<div class="flex flex-col items-center gap-3">'
{
  const n = dom.describe.split(CTA_GROUP).length - 1
  assert("the CTA group is a unique splice anchor", CTA_GROUP, n === 1, n)
}

const FIELDS = [...dom.armFields.matchAll(/<li class="break-all">([^<]+)<\/li>/g)].map((m) => m[1])
assert(
  "the eight keys were PARSED from the real dump, not re-typed",
  FIELDS.join(", "),
  FIELDS.length === 8,
  FIELDS.length,
)

/* ══════════════════════════════════════════════════════════════════════════════
   THE PROPOSED COPY — every new string, once.
   ══════════════════════════════════════════════════════════════════════════════ */

const FOOTING = {
  fields: `Your draft will be built to fill these ${FIELDS.length} fields.`,
  loading: "Reading the template — the draft will be built to whatever it asks for.",
  none: "This template has no fill-in fields, so your draft will be written from your description alone.",
  "not-word":
    "We can only read fields from Word documents, so your draft will be written from your description alone.",
  unavailable:
    "We could not read this template's fields, so your draft will be written from your description alone.",
}

const CTA = {
  fields: `Write the first draft to these ${FIELDS.length} fields`,
  loading: "Write the first draft",
  none: "Write the first draft from your description",
  "not-word": "Write the first draft from your description",
  unavailable: "Write the first draft from your description",
}

const SHIPPED_CTA = "Write the first draft"

const NEW_ROWS = [
  {
    id: "footing.fields",
    status: "NEW",
    where: "describe door — one line under the fields region (variant B)",
    text: FOOTING.fields,
    rule: "⚠ STATES A COUNT, so in build it must be derived from the list rendered directly above it and never hardcoded. A hardcoded 8 beside a list of 5 is exactly the class of silent lie this phase exists to remove.",
  },
  {
    id: "footing.none",
    status: "NEW",
    where: "describe door — same line, `none` arm (variant B)",
    text: FOOTING.none,
    rule: "⚠ THE MOST IMPORTANT STRING ON THIS PAGE. SEED-158 says the plain-language client template is the COMMON case. Without this line the author attaches a real template, reads a sentence about it, and is never told the draft ignored it — SEED-157 recurring with a control on screen. It states the CONSEQUENCE ('written from your description alone'), never merely the fact.",
  },
  {
    id: "footing.notWord",
    status: "NEW",
    where: "describe door — same line, `not-word` arm (variant B)",
    text: FOOTING["not-word"],
    rule: "Separate from `footing.none` for the same reason the shipped sentences are separate: two of the three accepted upload types land here, and telling a .pptx author their deck has no fields would be a flat lie.",
  },
  {
    id: "footing.unavailable",
    status: "NEW",
    where: "describe door — same line, `unavailable` arm (variant B)",
    text: FOOTING.unavailable,
    rule: "⚠ MUST NOT MERGE WITH `footing.none`, mirroring the shipped rule one level up. `none` is a fact about the document; this is a fact about us. The consequence for the draft happens to be identical, which is exactly why the wording must not be.",
  },
  {
    id: "footing.loading",
    status: "NEW",
    where: "describe door — same line, `loading` arm (variant B)",
    text: FOOTING.loading,
    rule: "⚠ AND IT EXPOSES A RACE THIS SKETCH DOES NOT SETTLE — see the open question below. The sentence promises the draft will use the template; nothing today stops the author pressing Draft before the read returns.",
  },
  {
    id: "cta.toFields",
    status: "CHANGE",
    where: 'testid="describe-draft" (variant C)',
    text: CTA.fields,
    rule: `⚠ CHANGES A GOVERNED STRING. The shipped CTA is "${SHIPPED_CTA}", carried in doorVocabulary.ts and settled by the operator as variant D of sketch 164 — three weeks ago. Variant C reopens it. It also makes the button's width depend on a number read from a document, which is a layout consequence, not just a copy one.`,
  },
  {
    id: "cta.fromDescription",
    status: "CHANGE",
    where: 'testid="describe-draft" (variant C, all three no-fields arms)',
    text: CTA.none,
    rule: "Same cost as above. Its virtue is that the promise lands on the control the author is about to press rather than in a line they may not read; its risk is that a button which changes its own verb reads as two different actions.",
  },
]

/* ══════════════════════════════════════════════════════════════════════════════
   THE SPLICES
   ══════════════════════════════════════════════════════════════════════════════ */

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const CTRL_LABEL = "Filling in a template?"

/** The shipped section, wrapped exactly as sketch 165 variant B wraps it. */
function sectionBlock(sectionHtml, footingLine) {
  const footing = footingLine
    ? `<p data-s166="footing" class="mt-2 border-t border-border/60 pt-2 text-[12.5px] leading-snug text-foreground/90">${esc(
        footingLine,
      )}</p>`
    : ""
  return `<div data-s166="block" class="flex flex-col gap-1.5"><span class="text-[13px] text-muted-foreground">${esc(
    CTRL_LABEL,
  )}</span>${sectionHtml}${footing}</div>`
}

function withCta(html, text) {
  if (text === SHIPPED_CTA) return html
  return html.replace(
    `>${SHIPPED_CTA}</button>`,
    ` data-s166="cta">${esc(text)}</button>`,
  )
}

const splice = (block) => dom.describe.replace(CTA_GROUP, block + CTA_GROUP)

/** variant → arm → full-door HTML */
const V = { a: {}, b: {}, c: {} }
for (const arm of ARMS) {
  const section = dom[arm.key]
  V.a[arm.id] = splice(sectionBlock(section, null))
  V.b[arm.id] = splice(sectionBlock(section, FOOTING[arm.id]))
  V.c[arm.id] = withCta(splice(sectionBlock(section, null)), CTA[arm.id])
}

/* Variant C must actually have changed the button on the four arms where its copy
   differs from the shipped string — a `replace` that missed would silently give
   variant A back. */
for (const arm of ARMS) {
  if (CTA[arm.id] === SHIPPED_CTA) continue
  const n = V.c[arm.id].split('data-s166="cta"').length - 1
  assert(
    `variant C actually re-worded the CTA on arm '${arm.id}'`,
    `expected the shipped "${SHIPPED_CTA}" to be replaced`,
    n === 1,
    n,
  )
}
/* Variant B must carry a footing line on every arm; variant A on none. */
for (const arm of ARMS) {
  const nb = V.b[arm.id].split('data-s166="footing"').length - 1
  assert(`variant B carries a footing line on arm '${arm.id}'`, "one line per arm", nb === 1, nb)
  const na = V.a[arm.id].split('data-s166="footing"').length - 1
  assert(`variant A carries NO footing line on arm '${arm.id}'`, "silence is the point", na === 0, na)
}

/* ══════════════════════════════════════════════════════════════════════════════
   THE PAGE
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * ✅ THE OPERATOR'S PICK — 2026-08-14: VARIANT B, the footing line.
 *
 * Recorded with its two rejections, because both are reasons rather than preferences:
 *
 *   A was rejected because silence is `SEED-157` recurring WITH A CONTROL ON SCREEN,
 *   which is strictly worse than having no control — the author has been shown a
 *   sentence about their file and has no way to learn the draft ignored it.
 *
 *   C was rejected on COST, not on clarity. It reopens `Write the first draft`, a
 *   string the operator settled three weeks ago as variant D of sketch 164, and it
 *   makes a button's rendered width depend on a number read out of an uploaded
 *   document. B buys most of C's honesty for five new strings and touches nothing
 *   governed.
 *
 * A and C STAY ON THE PAGE as the comparison that produced the pick — evidence, not
 * live options.
 */
const WINNER = "b"

const TABS = [
  { id: "a", label: "A · Silence (what you get free)", badge: "baseline" },
  { id: "b", label: "B · The draft states its footing", badge: "b" },
  { id: "c", label: "C · The button says it", badge: "c" },
  { id: "five", label: "The five shipped sentences", badge: "p" },
  { id: "contract", label: "The contract", badge: "p" },
].map((t) => (t.id === WINNER ? { ...t, label: `★ ${t.label}`, won: true } : t))

function stage(html, tall = true) {
  return `<div class="s166-stage${tall ? " s166-stage-tall" : ""}">${html}</div>`
}

/** A compact strip: just the spliced region for each arm, side by side. */
function armStrip(variant) {
  return `<div class="s166-strip">${ARMS.map((arm) => {
    const full = V[variant][arm.id]
    const start = full.indexOf('<div data-s166="block"')
    const block = full.slice(start, full.indexOf(CTA_GROUP, start))
    const ctaText = variant === "c" ? CTA[arm.id] : SHIPPED_CTA
    return `<figure class="s166-cell"><figcaption><code>${esc(arm.id)}</code><span>${esc(
      arm.file,
    )}</span></figcaption><div class="s166-mini">${block}</div><div class="s166-cta">${esc(
      ctaText,
    )}</div></figure>`
  }).join("")}</div>`
}

function fiveTable() {
  return `<table class="s166-table"><thead><tr><th>arm</th><th>testid</th><th>server answered</th><th>the shipped sentence</th><th>what it means</th></tr></thead><tbody>${ARMS.map(
    (a) => {
      const m = dom[a.key].match(
        new RegExp(`data-testid="${a.testid}"[^>]*>([^<]*)<`),
      )
      const sentence =
        a.id === "fields"
          ? `(the list itself — ${FIELDS.length} keys)`
          : m
            ? m[1]
            : "—"
      return `<tr><td><code>${esc(a.id)}</code></td><td><code>${esc(a.testid)}</code></td><td>${esc(
        a.server,
      )}</td><td>${esc(sentence)}</td><td class="s166-rule">${esc(a.means)}</td></tr>`
    },
  ).join("")}</tbody></table>`
}

function contractTable() {
  return `<table class="s166-table"><thead><tr><th>id</th><th></th><th>Where</th><th>Text</th><th>Rule</th></tr></thead><tbody>${NEW_ROWS.map(
    (r) =>
      `<tr><td><code>${esc(r.id)}</code></td><td><span class="s166-status s166-status-${r.status.toLowerCase()}">${
        r.status
      }</span></td><td class="s166-where">${esc(r.where)}</td><td>${esc(r.text)}</td><td class="s166-rule">${esc(
        r.rule,
      )}</td></tr>`,
  ).join("")}</tbody></table>`
}

function auditTable() {
  return `<table class="s166-table"><thead><tr><th>#</th><th>Asserted</th><th>Detail</th><th>Found</th><th></th></tr></thead><tbody>${audit
    .map(
      (a, i) =>
        `<tr><td>${i + 1}</td><td>${esc(a.label)}</td><td class="s166-where"><code>${esc(
          String(a.detail),
        )}</code></td><td>${a.found}</td><td>${
          a.ok
            ? '<span class="s166-status s166-status-shipped">ok</span>'
            : '<span class="s166-status s166-status-new">FAIL</span>'
        }</td></tr>`,
    )
    .join("")}</tbody></table>`
}

const body = `
<div class="s166-root">
  <header class="s166-head">
    <div class="s166-kicker">Sketch 166 · Phase 193.1 · AUTH-03 · SEED-158 · SEED-159</div>
    <h1>When there are no eight fields</h1>
    <p class="s166-lede">The read came back and it wasn’t a list. Does the screen still let the author believe their draft is built to their template — and where should the truth live?</p>
    <div class="s166-mech">
      <strong>The five shipped sentences are not under review.</strong>
      <p>Each arm below is the <em>real</em> <code>TemplateAttachSection</code>, rendered under jsdom in that exact reading state, spliced into the <em>real</em> describe door. Those five sentences are honest, they are exported identifiers, and two of them carry a docblock warning that they may never merge. <strong>This sketch does not change a character of them</strong>, and the build asserts every pair stays distinct — if a refactor ever made <code>none</code> and <code>unavailable</code> render the same node, this page would refuse to build.</p>
      <p><strong>The question is what the DRAFT says about itself.</strong> Today: nothing. The fields region reports on the template and falls silent, and generation proceeds exactly as it would with no template at all. That is <code>SEED-157</code>’s defect recurring <em>with a control on screen</em> — which is worse than not having the control, because the author has now been shown a sentence about their file.</p>
      <p class="s166-caveat"><strong>⚠ Judge tab A first and honestly.</strong> A is not a straw man — it is what variants B and C of sketch 165 give you for free, with no extra copy and no extra decisions. If A reads as acceptable, the phase gets smaller.</p>
    </div>
  </header>

  <div class="s166-winner"><strong>★ Winner — variant B, the footing line</strong> <span>operator, 2026-08-14</span><p><strong>A was rejected</strong> because silence is <code>SEED-157</code> recurring <em>with a control on screen</em> — worse than no control, since the author has been shown a sentence about their file and cannot learn the draft ignored it. <strong>C was rejected on cost, not on clarity</strong>: it reopens <code>Write the first draft</code>, settled three weeks ago as variant D of sketch 164, and makes a button’s width depend on a number read out of an uploaded document. A and C stay on this page as the comparison that produced the pick — <strong>evidence, not live options</strong>.</p></div>

  <nav class="s166-tabs">${TABS.map(
    (t) =>
      `<button class="s166-tab${t.id === WINNER ? " s166-tab-on" : ""}${
        t.won ? " s166-tab-won" : ""
      }" data-tab="${t.id}">${esc(t.label)}</button>`,
  ).join("")}</nav>

  <section class="s166-panel" data-panel="a" hidden>
    <div class="s166-axis"><span class="s166-badge s166-badge-baseline">A · silence</span><div><strong>The template speaks; the draft does not.</strong><p>Every arm renders its honest sentence about the document, and nothing anywhere says what will now be generated. The button reads <code>${esc(
      SHIPPED_CTA,
    )}</code> in all five states, and it means something different in each of them.</p></div></div>
    <h3 class="s166-h3">All five arms, side by side</h3>
    <p class="s166-note">The bar under each cell is what the draft button says in that state. In A it is the same five times.</p>
    ${armStrip("a")}
    <h3 class="s166-h3">The deciding one, full screen — <code>none</code></h3>
    <p class="s166-note"><strong><code>SEED-158</code>: this is the common real-world case.</strong> A client’s weekly-report template, written in plain language, with no <code>{{ }}</code> tokens in it. The author attached exactly the right file. Read this screen as they would and ask what they now expect to happen.</p>
    ${stage(V.a.none)}
  </section>

  <section class="s166-panel" data-panel="b">
    <div class="s166-axis"><span class="s166-badge s166-badge-b">B · the footing</span><div><strong>One line, always present, that says what the draft will be built from.</strong><p>It sits under the fields region and takes a different value on every arm — never merging the two that may not merge. The button is untouched, so nothing governed by sketch 164’s settled variant D moves.</p></div></div>
    <h3 class="s166-h3">All five arms, side by side</h3>
    <p class="s166-note">Read the added line in each cell. The two that matter most are <code>none</code> — which must say the draft falls back — and <code>unavailable</code>, whose consequence is identical but whose <em>cause</em> is not, and so must not borrow the other’s words.</p>
    ${armStrip("b")}
    <h3 class="s166-h3">The deciding one, full screen — <code>none</code></h3>
    ${stage(V.b.none)}
    <h3 class="s166-h3">And the one it must not sound like — <code>unavailable</code></h3>
    <p class="s166-note">Same consequence for the draft, different fact about the world. <em>“We could not read this template’s fields”</em> — we never opened it, so nothing here is a claim about the document.</p>
    ${stage(V.b.unavailable)}
  </section>

  <section class="s166-panel" data-panel="c" hidden>
    <div class="s166-axis"><span class="s166-badge s166-badge-c">C · the button</span><div><strong>The promise lands on the control the author is about to press.</strong><p>Hardest to miss, and most expensive: it reopens <code>${esc(
      SHIPPED_CTA,
    )}</code> — a string the operator settled three weeks ago as variant D of sketch 164 — and it makes the button’s width depend on a number read out of a document.</p></div></div>
    <h3 class="s166-h3">All five arms, side by side</h3>
    <p class="s166-note">Watch the bar under each cell, not the section above it. A button that changes its own verb is either the clearest thing on the screen or reads as two different actions — that is the judgement.</p>
    ${armStrip("c")}
    <h3 class="s166-h3">The deciding one, full screen — <code>none</code></h3>
    ${stage(V.c.none)}
    <h3 class="s166-h3">And with fields, for contrast</h3>
    ${stage(V.c.fields)}
  </section>

  <section class="s166-panel" data-panel="five" hidden>
    <div class="s166-axis"><span class="s166-badge s166-badge-p">shipped</span><div><strong>The five reading states, read out of the rendered DOM rather than transcribed.</strong><p>Every sentence in this table was extracted from the dump of the component rendering that state. None of it is under review here; it is the ground the three variants stand on.</p></div></div>
    ${fiveTable()}
    <h3 class="s166-h3">⚠ The open question this sketch does not settle</h3>
    <p class="s166-note"><strong>The <code>loading</code> arm is a race, and it is a real one.</strong> Nothing today prevents the author pressing <strong>${esc(
      SHIPPED_CTA,
    )}</strong> while the read is still in flight — in which case the generate call goes out with no <code>template_placeholders</code> and produces exactly the blind draft this phase exists to prevent, on a screen that just told them a template was attached. Three plausible answers, none drawn here: <strong>disable the button while reading</strong> (honest, but blocks the fast path on a slow request); <strong>let the draft wait for the read</strong> (invisible, but a spinner appears where none did before); <strong>let it through and say so afterwards</strong> (cheapest, and pushes the problem into sketch 167’s reconcile). <strong>It belongs in CONTEXT.md as a decision, not inside a chosen variant.</strong></p>
  </section>

  <section class="s166-panel" data-panel="contract" hidden>
    <div class="s166-axis"><span class="s166-badge s166-badge-p">contract</span><div><strong>Every proposed string, with the rule that produced it.</strong><p><code>NEW</code> rows have no component today. <code>CHANGE</code> rows touch a string that already ships and is already pinned by a test — priced, not free.</p></div></div>
    ${contractTable()}
    <h3 class="s166-h3">The audit — what this build checked before it drew anything</h3>
    <p class="s166-note">The pairwise check is the mechanised form of the shipped docblock’s rule that <em>“these two sentences may never merge”</em>: every arm must render its own node and none of the other four. The build exits non-zero on any row reading <code>FAIL</code>.</p>
    ${auditTable()}
  </section>
</div>
<script>
(function(){
  var tabs=[].slice.call(document.querySelectorAll('.s166-tab'));
  var panels=[].slice.call(document.querySelectorAll('.s166-panel'));
  tabs.forEach(function(t){
    t.addEventListener('click',function(){
      tabs.forEach(function(x){x.classList.remove('s166-tab-on')});
      t.classList.add('s166-tab-on');
      var id=t.getAttribute('data-tab');
      panels.forEach(function(p){p.hidden = p.getAttribute('data-panel')!==id});
      window.scrollTo({top:0,behavior:'smooth'});
    });
  });
})();
</script>
`

fs.writeFileSync(path.join(HERE, "body.generated.html"), body, "utf8")

const md = `<!-- GENERATED by build.cjs — do not hand-edit. Re-run the chain in README.md. -->
# Sketch 166 — build contract

## The five shipped reading states — NOT under review

Extracted from the rendered DOM of \`TemplateAttachSection\` in each state.

| arm | testid | server answered | the shipped sentence |
|---|---|---|---|
${ARMS.map((a) => {
  const m = dom[a.key].match(new RegExp(`data-testid="${a.testid}"[^>]*>([^<]*)<`))
  const s = a.id === "fields" ? `(the list itself — ${FIELDS.length} keys)` : m ? m[1] : "—"
  return `| \`${a.id}\` | \`${a.testid}\` | ${a.server} | ${s} |`
}).join("\n")}

## Proposed strings

| id | status | where | text | rule |
|---|---|---|---|---|
${NEW_ROWS.map(
  (r) =>
    `| \`${r.id}\` | ${r.status} | ${r.where} | ${r.text.replace(/\|/g, "\\|")} | ${r.rule.replace(/\|/g, "\\|")} |`,
).join("\n")}

## The audit

${audit.length} assertions, ${audit.filter((a) => a.ok).length} passing, ${audit.filter((a) => !a.ok).length} failing.

| # | asserted | detail | found | |
|---|---|---|---|---|
${audit
  .map(
    (a, i) =>
      `| ${i + 1} | ${a.label} | \`${String(a.detail).replace(/\|/g, "\\|")}\` | ${a.found} | ${a.ok ? "ok" : "**FAIL**"} |`,
  )
  .join("\n")}

## The open question this sketch does NOT settle

**The \`loading\` arm is a race.** Nothing prevents the author pressing the draft button
while the read is in flight, which sends a generate call with no \`template_placeholders\`
and produces the blind draft this phase exists to prevent — on a screen that just told
them a template was attached. Three answers, none drawn: disable while reading · let the
draft wait for the read · let it through and reconcile afterwards (sketch 167).
**This belongs in CONTEXT.md as a decision, not inside a chosen variant.**
`

fs.writeFileSync(path.join(HERE, "BUILD-CONTRACT.generated.md"), md, "utf8")

console.log(
  `body.generated.html + BUILD-CONTRACT.generated.md written — ${audit.length} assertions, ${
    audit.filter((a) => !a.ok).length
  } failing, ${ARMS.length} arms, ${FIELDS.length} fields parsed`,
)
