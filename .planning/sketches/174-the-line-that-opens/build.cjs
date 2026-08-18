#!/usr/bin/env node
/**
 * SKETCH 174 — THE ARRIVAL MOMENT, DRAWN AS A SCREEN.
 *
 * ── WHY THIS PAGE EXISTS (operator, 2026-08-18) ──
 * 172 and 173 are analysis pages: tables, provenance contracts, measurement readouts.
 * The operator's read was that they *"included a lot of information"* and did not
 * *"represent what the thing looks like"* — a request for the user-friendly version with
 * **the control that does not break the workflow.** This page is the picture.
 *
 * ── AND THEN THE OPERATOR CAUGHT THE REAL DEFECT, WHICH THIS FILE NOW ANSWERS ──
 * The first cut of this page drew **two cards**: the shipped receipt (*"Here's what I
 * built — 5 steps"*) and a new one (*"I made 5 decisions for you"*). Their observation,
 * recorded because it is the correct one:
 *
 *   > *"you produce two cards … this means the spine [gets] a limited area … the area is
 *   > very tight, with exception of the one version where I can collapse … we always have
 *   > to think about not over-complicating the information … information should not be
 *   > dense but be enough for the user to know what is happening."*
 *
 * **Both cards say the same kind of thing — here is what the AI just did.** Splitting one
 * thought across two containers spends the graph's space on chrome, and collapsing the
 * second one only hides that. So the recommended shape is now **ONE card** with two
 * openable sections, and the two-card version is kept beside it as the evidence for why.
 *
 * ⚠ **THIS IS A COMPOSITION CHANGE, NOT A CHARTER CHANGE — the distinction is load-bearing
 * against D-02.** `197-CONTEXT.md` refuses to widen `SeedReceipt`, and correctly: its
 * docblock is fenced (*"authors no sentence of its own"*, *"declares no predicate of its
 * own"*, *"imports nothing from the API client"*) and widening its charter costs exactly
 * the guarantees that make it checkable. Nothing here widens it. `SeedReceipt` stays the
 * leaf it is; a PARENT composes its output and the decisions list into one visual card.
 * One card in the UI, two components underneath — which is what D-02 asked for and what
 * the operator is asking for at the same time.
 *
 * Every fragment of the receipt below is the REAL rendered DOM, extracted by its own
 * `data-testid` and re-framed, never redrawn — and the extraction is asserted piece by
 * piece so a missing fragment fails the build instead of quietly vanishing from the card.
 */
const fs = require("node:fs")
const path = require("node:path")

const HERE = __dirname
const DUMP = path.join(HERE, "..", "172-where-the-five-decisions-live", "dom.generated.json")

const failures = []
let checks = 0
function assert(cond, label) {
  checks += 1
  if (!cond) failures.push(label)
}

assert(fs.existsSync(DUMP), "sketch 172's dump is present — 174 renders the real screen from it")
const dom = fs.existsSync(DUMP) ? JSON.parse(fs.readFileSync(DUMP, "utf8")) : {}

/** Depth-counting element extractor — the one 172 needed after a regex silently stopped a
 *  nesting level early. */
function extractElement(html, marker, tag) {
  const at = (html || "").indexOf(marker)
  if (at === -1) return null
  const start = html.lastIndexOf(`<${tag}`, at)
  if (start === -1) return null
  const open = new RegExp(`<${tag}[\\s>]`, "g")
  const close = new RegExp(`</${tag}>`, "g")
  let depth = 0
  let i = start
  while (i < html.length) {
    open.lastIndex = i
    close.lastIndex = i
    const o = open.exec(html)
    const c = close.exec(html)
    if (!c) return null
    if (o && o.index < c.index) {
      depth += 1
      i = o.index + 1
    } else {
      depth -= 1
      i = c.index + 1
      if (depth === 0) return html.slice(start, c.index + tag.length + 3)
    }
  }
  return null
}

const HEADER = dom.headerAnswered || ""
const RECEIPT = dom.receipt || ""
const TOGGLE = extractElement(dom.gridAnswered, 'data-testid="builder-view-toggle"', "div") || ""
const SPINE = extractElement(dom.gridAnswered, 'aria-label="Workflow phase spine', "section") || ""

assert(HEADER.includes('data-testid="project-folder-picker"'), "the real header is present")
assert(RECEIPT.includes('data-testid="seed-receipt"'), "the real receipt is present")
assert(TOGGLE.includes("Spine") && TOGGLE.includes("Canvas"), "the real view toggle is present")
assert(SPINE.length > 5000, "the REAL spine graph is present — this is what makes it look like the product")
assert(SPINE.includes("Pull the vendor filings"), "the spine renders the draft's real steps")

/* ── The receipt, taken apart by its OWN test ids. Each piece stays byte-real. ── */
const R = {
  heading: extractElement(RECEIPT, 'data-testid="seed-receipt-heading"', "h2"),
  dismiss: extractElement(RECEIPT, 'data-testid="seed-receipt-dismiss"', "button"),
  grounding: extractElement(RECEIPT, 'data-testid="seed-receipt-grounding"', "p"),
  carried: extractElement(RECEIPT, 'data-testid="seed-receipt-carried"', "p"),
  list: extractElement(RECEIPT, 'data-testid="seed-receipt-grounded-list"', "ul"),
  close: extractElement(RECEIPT, 'data-testid="seed-receipt-close"', "p"),
}
for (const [k, v] of Object.entries(R)) {
  assert(!!v && v.length > 20, `receipt fragment "${k}" extracted from the real DOM`)
}
assert(
  (R.list.match(/<li /g) || []).length === 3,
  "the sealed-step list carries its real 3 rows — a re-framed receipt must lose nothing",
)
const SEALED_COUNT = (RECEIPT.match(/data-grounded-count="(\d+)"/) || [])[1]
assert(SEALED_COUNT === "3", "the sealed count is read from the real card, never re-typed")

/* ── The shipped copy, parsed. Nothing on this page re-types a product sentence. ── */
function parse(re, label, src) {
  const m = (src || "").match(re)
  assert(!!m, label)
  return m ? m[1] : ""
}
const AI_MARK = parse(
  /data-testid="business-requirement-ai-mark"[^>]*>([^<]*)</,
  "the AI-proposed label is parsed from the real mark",
  HEADER,
)
const AI_MARK_TITLE = parse(
  /data-testid="business-requirement-ai-mark"[^>]*title="([^"]*)"/,
  "its explanation is parsed from the real mark",
  HEADER,
)
const REQUIREMENT_VALUE = parse(
  /data-testid="business-requirement-input"[^>]*value="([^"]*)"/,
  "the requirement's live value is parsed from the real input",
  HEADER,
)
const AI_MARK_HTML = extractElement(HEADER, 'data-testid="business-requirement-ai-mark"', "span") || ""
assert(!!AI_MARK_HTML, "the shipped mark markup is lifted whole")

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/* ─────────────────────── the five decisions ─────────────────────── */

const ROWS = [
  { key: "kb", ask: "Knowledge base", answer: "Vendor contracts", act: "Change", mark: false },
  { key: "template", ask: "Template to fill", answer: "None — it writes its own format", act: "Attach one", mark: false },
  { key: "requirement", ask: "What it must deliver", answer: REQUIREMENT_VALUE, act: "Change", mark: true },
  { key: "name", ask: "Name", answer: "Vendor-risk review", act: "Rename", mark: true },
  { key: "deliverable", ask: "What it produces", answer: "A file, at the last step", act: null, mark: false },
]
assert(ROWS.length === 5, "five decisions (D-07)")

function decisionRow(r) {
  const mark = r.mark
    ? r.key === "requirement"
      ? AI_MARK_HTML
      : `<span title="${esc(AI_MARK_TITLE)}" class="shrink-0 rounded border border-border px-1 py-px font-mono text-[9px] font-medium text-muted-foreground">${esc(AI_MARK)}</span>`
    : ""
  const act = r.act
    ? `<button type="button" data-jump="${r.key}" class="shrink-0 rounded px-1.5 py-px text-[11.5px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary">${esc(r.act)}</button>`
    : `<span class="shrink-0 text-[11px] text-muted-foreground/60">set by the last step</span>`
  return `<li class="flex items-baseline gap-2 py-[5px] text-[12.5px]">
  <span class="w-[128px] shrink-0 text-muted-foreground">${esc(r.ask)}</span>
  <span class="min-w-0 flex-1 truncate font-medium text-foreground">${esc(r.answer)}</span>
  ${mark}
  ${act}
</li>`
}

const DECISION_ROWS = `<ul class="flex flex-col divide-y divide-border/50">
${ROWS.map(decisionRow).join("\n")}
</ul>
<p class="mt-2 text-[11.5px] leading-[1.5] text-muted-foreground">Changing one of these updates the draft. It won't re-write the steps that were built around the old answer.</p>`

/* ─────────────────────── the ONE card ─────────────────────── */

/**
 * One disclosure line. The SUMMARY is what the operator's rule asks for: enough to know
 * what happened without being dense — a fact and a count, never a wall.
 */
function fold(id, summary, verb, inner, open) {
  return `<div data-fold="${id}" class="border-t border-border/50 first:border-t-0">
  <button type="button" data-fold-toggle class="flex w-full items-center gap-2 py-[7px] text-left focus:outline-none focus:ring-1 focus:ring-primary">
    <span aria-hidden="true" class="shrink-0 text-[10px] text-muted-foreground" style="${open ? "transform:rotate(90deg)" : ""}">▸</span>
    <span class="min-w-0 flex-1 text-[12.5px] text-foreground">${summary}</span>
    <span class="shrink-0 text-[11.5px] text-muted-foreground">${open ? "hide" : verb}</span>
  </button>
  <div data-fold-body class="pb-2 pl-[18px]" ${open ? "" : "hidden"}>${inner}</div>
</div>`
}

/**
 * THE RECOMMENDED SHAPE. One card, the receipt's own heading and its own closing
 * sentence, and two folds between them.
 *
 * The card frame is `SeedReceipt`'s own class string minus its entrance animation — so a
 * built version is the shipped frame, not a second card treatment.
 */
function oneCard(open) {
  const governance = `${R.grounding}\n${R.carried}\n${R.list}`
  return `<section data-arrival class="w-full max-w-[720px] rounded-[14px] border border-border bg-card px-[18px] py-3 shadow-lg">
  <div class="flex items-start gap-3 pb-1">
    ${R.heading}
    ${R.dismiss}
  </div>
  <div class="border-t border-border/50">
    ${fold("gov", `<strong class="font-semibold">${SEALED_COUNT} steps</strong> must prove their sources`, "why", governance, open.gov)}
    ${fold("dec", `<strong class="font-semibold">${ROWS.length} decisions</strong> I made for you`, "review", DECISION_ROWS, open.dec)}
  </div>
  ${R.close}
</section>`
}

/** The two-card shape — the first cut of this page, kept as the evidence for the change. */
function twoCards(decisionsOpen) {
  const strip = `<section data-arrival class="w-full max-w-[720px] rounded-[14px] border border-border bg-card px-[18px] ${decisionsOpen ? "py-3" : "py-2.5"}">
  <button type="button" data-fold-toggle class="flex w-full items-center gap-2 text-left focus:outline-none focus:ring-1 focus:ring-primary">
    <span aria-hidden="true" class="shrink-0 text-[11px] text-muted-foreground" style="${decisionsOpen ? "transform:rotate(90deg)" : ""}">▸</span>
    <span class="min-w-0 flex-1 text-[12.5px] font-medium text-foreground">I made 5 decisions for you</span>
    <span class="shrink-0 text-[11.5px] text-muted-foreground">${decisionsOpen ? "hide" : "review"}</span>
  </button>
  <div data-fold-body class="mt-2 border-t border-border/50 pt-1" ${decisionsOpen ? "" : "hidden"}>${DECISION_ROWS}</div>
</section>`
  return `<div class="flex flex-col gap-2">${RECEIPT}${strip}</div>`
}

/* ─────────────────────── the screen ─────────────────────── */

function screen(arrival) {
  return `<div class="flex h-full min-h-0 flex-col bg-background">
  ${HEADER}
  <div class="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden [&>*:last-child]:row-start-3">
    ${TOGGLE}
    <div class="px-4 py-3">${arrival}</div>
    ${SPINE}
  </div>
</div>`
}

const screens = {
  one: screen(oneCard({ gov: false, dec: false })),
  oneOpen: screen(oneCard({ gov: false, dec: true })),
  two: screen(twoCards(false)),
  twoOpen: screen(twoCards(true)),
}

assert(screens.one !== screens.oneOpen, "the one-card collapsed and opened states differ")
assert(screens.one !== screens.two, "the one-card and two-card shapes differ")
assert(screens.one.includes("Workflow phase spine"), "the spine is on the screen")
assert(
  screens.one.includes(R.list),
  "the one card carries the receipt's REAL sealed-step list, unchanged",
)
assert(
  screens.one.includes(R.close),
  "the one card keeps the receipt's own closing sentence, unchanged",
)
assert(
  (screens.one.match(/data-arrival/g) || []).length === 1,
  "the recommended screen has exactly ONE arrival card — this is the whole point",
)
assert(
  (screens.two.match(/data-arrival|data-testid="seed-receipt"/g) || []).length === 2,
  "the comparison screen has two",
)

/* ─────────────────────── the page ─────────────────────── */

const body = `
<div class="s174-root">
  <div class="s174-head">
    <div class="s174-kicker">Sketch 174 · Phase 197 · the arrival moment, as a screen</div>
    <h1>One card, not two</h1>
    <p class="s174-lede">When the draft lands, one card says what happened: <em>here's what I built</em>, and inside it two
    lines you can open — <strong>what must prove its sources</strong>, and <strong>the ${ROWS.length} decisions I made for you</strong>.
    Each decision takes you to the control that is already on the screen. Closed, it is four lines. Your workflow stays visible.</p>
  </div>

  <div class="s174-tabs">
    <button class="s174-tab" data-tab="one">1 · One card, just landed</button>
    <button class="s174-tab" data-tab="oneOpen">2 · Opened the decisions</button>
    <button class="s174-tab" data-tab="two">3 · Two cards (what I drew first)</button>
    <button class="s174-tab" data-tab="twoOpen">4 · Two cards, opened</button>
  </div>

  <p class="s174-cap" data-cap>—</p>
  <div class="s174-screen" data-screen="one">${screens.one}</div>
  <div class="s174-screen" data-screen="oneOpen" hidden>${screens.oneOpen}</div>
  <div class="s174-screen" data-screen="two" hidden>${screens.two}</div>
  <div class="s174-screen" data-screen="twoOpen" hidden>${screens.twoOpen}</div>

  <p class="s174-measure" data-measure>Measuring…</p>

  <p class="s174-foot">Everything except the decisions rows is the <strong>real</strong> product — the header, the receipt's own
  heading, sentences, sealed-step list and closing line, the view toggle, and the whole step graph are rendered from the running
  code. The receipt is <strong>re-framed, not rewritten</strong>: one card in the UI, two components underneath, so the receipt
  keeps the guarantees that make it checkable. Reasoning: sketches <strong>172</strong> and <strong>173</strong>.</p>
</div>

<script>
(function(){
  var caps = {
    one: "The moment the draft arrives. One card, four lines. Everything else on screen is your workflow.",
    oneOpen: "You opened the decisions. Press a link on any row and watch the control light up in the header — nothing is duplicated.",
    two: "What I drew first: two cards, both saying 'here is what the AI just did'. Even collapsed, the second frame costs space and splits one thought in half.",
    twoOpen: "Two cards with the decisions open. This is the tight area you spotted."
  };
  var tabs = document.querySelectorAll(".s174-tab");
  var screens = document.querySelectorAll(".s174-screen");
  function show(id){
    tabs.forEach(function(t){ t.classList.toggle("s174-tab-on", t.dataset.tab === id); });
    screens.forEach(function(s){ s.hidden = s.dataset.screen !== id; });
    document.querySelector("[data-cap]").textContent = caps[id];
    measure();
  }
  tabs.forEach(function(t){ t.addEventListener("click", function(){ show(t.dataset.tab); }); });

  // Every fold really opens.
  document.addEventListener("click", function(e){
    var b = e.target.closest("[data-fold-toggle]");
    if(!b) return;
    var body = b.parentElement.querySelector("[data-fold-body]");
    if(!body) return;
    var open = body.hidden;
    body.hidden = !open;
    b.querySelector("span[aria-hidden]").style.transform = open ? "rotate(90deg)" : "";
    var verb = b.lastElementChild;
    verb.dataset.verb = verb.dataset.verb || verb.textContent;
    verb.textContent = open ? "hide" : verb.dataset.verb;
    measure();
  });

  // A row really takes you to the shipped control.
  document.addEventListener("click", function(e){
    var b = e.target.closest("[data-jump]");
    if(!b) return;
    var scr = b.closest(".s174-screen");
    var map = { kb: "project-folder-picker", requirement: "business-requirement-input" };
    var id = map[b.getAttribute("data-jump")];
    var t = id ? scr.querySelector('[data-testid="' + id + '"]') : null;
    if(!t) return;
    t.focus();
    t.style.outline = "2px solid hsl(var(--primary))";
    t.style.outlineOffset = "2px";
    setTimeout(function(){ t.style.outline = ""; }, 1800);
  });

  // How much of the screen is your workflow? Measured, not claimed.
  function measure(){
    var scr = document.querySelector(".s174-screen:not([hidden])");
    var note = document.querySelector("[data-measure]");
    if(!scr || !note) return;
    var spine = scr.querySelector('[aria-label^="Workflow phase spine"]');
    if(!spine) return;
    var total = Math.round(scr.getBoundingClientRect().height);
    var got = Math.round(spine.getBoundingClientRect().height);
    var cards = 0;
    scr.querySelectorAll('[data-arrival], [data-testid="seed-receipt"]').forEach(function(c){
      cards += Math.round(c.getBoundingClientRect().height);
    });
    note.textContent = "Measured on this screen: the arrival card" +
      (scr.dataset.screen.indexOf("two") === 0 ? "s take " : " takes ") + cards +
      " px, and your workflow gets " + got + " px of " + total + " px — " +
      Math.round(100 * got / total) + "% of the screen.";
  }

  show("one");
})();
</script>
`

if (failures.length) {
  console.error(`\n✗ ${failures.length} of ${checks} assertions FAILED:\n`)
  for (const f of failures) console.error(`   · ${f}`)
  process.exit(1)
}

fs.writeFileSync(path.join(HERE, "body.generated.html"), body, "utf8")
console.log(`✓ ${checks} assertions, 0 failing`)
console.log(`  body.generated.html  ${(body.length / 1024).toFixed(1)} KB`)
