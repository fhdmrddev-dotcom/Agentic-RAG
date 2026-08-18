#!/usr/bin/env node
/**
 * SKETCH 174 — THE RECOMMENDATION, DRAWN AS A SCREEN.
 *
 * ── WHY THIS PAGE EXISTS (operator, 2026-08-18) ──
 * Sketches 172 and 173 are analysis pages: tables, provenance contracts, measurement
 * readouts, three stages per tab. The operator's words: *"included a lot of information
 * and for me this was not — it represents what the king looks like. I need the
 * user-friendly version, but the control that does not break the workflow."*
 *
 * That is a fair read. 172 and 173 answer "which shape is right and how do we know";
 * they do not show anyone what the product looks like. **This page shows only the
 * screen.** All of the reasoning stays where it belongs — in the two READMEs — and
 * nothing here is a table.
 *
 * ── AND IT IS ALSO THE ANSWER TO 172's OWN MEASUREMENT ──
 * 172 measured that a second full card leaves the canvas 25 px at a 700 px column. All
 * three of its variants stack a ~370 px card above the graph, so all three pay that. The
 * shape drawn here is the one that does not: the decisions arrive as ONE LINE under the
 * receipt and open on demand. Collapsed it costs the canvas ~40 px instead of ~370 px.
 *
 * Everything on this page except the decisions line is the REAL rendered DOM dumped by
 * sketch 172's emitter — the header, the receipt, the view toggle and the whole spine
 * graph. That is what makes it look like the product rather than like a drawing of it.
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

/** Depth-counting element extractor — the same one 172 needed after a regex silently
 *  stopped a nesting level early. */
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

const SUMMARY = "I made 5 decisions for you"
const SUMMARY_HINT = "review them"

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
  <span class="w-[132px] shrink-0 text-muted-foreground">${esc(r.ask)}</span>
  <span class="min-w-0 flex-1 truncate font-medium text-foreground">${esc(r.answer)}</span>
  ${mark}
  ${act}
</li>`
}

/** COLLAPSED — one line. This is the whole recommendation. */
function strip(open) {
  return `<section data-decisions class="w-full max-w-[720px] rounded-[14px] border border-border bg-card px-[18px] ${open ? "py-3" : "py-2.5"}">
  <button type="button" data-toggle-decisions class="flex w-full items-center gap-2 text-left focus:outline-none focus:ring-1 focus:ring-primary">
    <span aria-hidden="true" class="shrink-0 text-[11px] text-muted-foreground transition-transform" style="${open ? "transform:rotate(90deg)" : ""}">▸</span>
    <span class="min-w-0 flex-1 text-[12.5px] font-medium text-foreground">${esc(SUMMARY)}</span>
    <span class="shrink-0 text-[11.5px] text-muted-foreground">${open ? "hide" : esc(SUMMARY_HINT)}</span>
  </button>
  <div data-decisions-body ${open ? "" : "hidden"}>
    <ul class="mt-2 flex flex-col divide-y divide-border/50 border-t border-border/50 pt-1">
${ROWS.map(decisionRow).join("\n")}
    </ul>
    <p class="mt-2.5 text-[11.5px] leading-[1.5] text-muted-foreground">Changing one of these updates the draft. It won't re-write the steps that were built around the old answer.</p>
  </div>
</section>`
}

/** The alternative, for comparison only — a full always-open card, i.e. what 172's three
 *  variants all cost. */
const FULL_CARD = `<section data-decisions class="w-full max-w-[720px] rounded-[14px] border border-border bg-card px-[18px] py-4 shadow-lg">
  <div class="flex items-start gap-3">
    <h2 class="min-w-0 flex-1 text-[13.5px] font-semibold text-foreground">Here's what I decided for you — 5 things you can change</h2>
    <button type="button" aria-label="Dismiss" class="inline-grid h-5 w-5 shrink-0 place-items-center rounded text-[11px] text-muted-foreground hover:bg-accent/40"><span aria-hidden="true">✕</span></button>
  </div>
  <ul class="mt-3 flex flex-col divide-y divide-border/50">
${ROWS.map(decisionRow).join("\n")}
  </ul>
  <p class="mt-3 text-[12.5px] leading-[1.5] text-muted-foreground">Changing one of these updates the draft. It won't re-write the steps that were built around the old answer.</p>
  <p class="mt-2 text-[12.5px] leading-[1.5] text-muted-foreground">Everything else is yours to change. Nothing is saved or published yet.</p>
</section>`

/* ─────────────────────── the screen ─────────────────────── */

/** The whole Builder screen, at real proportions. `grid-rows` gains ONE auto row for the
 *  decisions element and the graph moves to row 4 — the minimum structural change. */
function screen(decisions) {
  return `<div class="flex h-full min-h-0 flex-col bg-background">
  ${HEADER}
  <div class="grid min-h-0 min-w-0 flex-1 grid-rows-[auto_auto_auto_minmax(0,1fr)] overflow-hidden [&>*:last-child]:row-start-4">
    ${TOGGLE}
    <div class="px-4 pt-3">${RECEIPT}</div>
    <div class="px-4 pb-3 pt-2">${decisions}</div>
    ${SPINE}
  </div>
</div>`
}

const screens = {
  landed: screen(strip(false)),
  opened: screen(strip(true)),
  card: screen(FULL_CARD),
}

assert(screens.landed !== screens.opened, "collapsed and opened differ")
assert(screens.opened !== screens.card, "opened and the full card differ")
assert(screens.landed.includes("Workflow phase spine"), "the spine is on the screen")

const body = `
<div class="s174-root">
  <div class="s174-head">
    <div class="s174-kicker">Sketch 174 · Phase 197 · the recommendation, as a screen</div>
    <h1>The line that opens</h1>
    <p class="s174-lede">The draft lands the way it does today. Under the receipt there is <strong>one line</strong> —
    <em>“${esc(SUMMARY)}”</em> — that opens into the five when you want it, and each one takes you to the control that is
    already on the screen. Nothing new blocks you, nothing is duplicated, and the workflow stays visible.</p>
  </div>

  <div class="s174-tabs">
    <button class="s174-tab" data-tab="landed">1 · The draft just landed</button>
    <button class="s174-tab" data-tab="opened">2 · You opened it</button>
    <button class="s174-tab" data-tab="card">3 · If it were a full card instead</button>
  </div>

  <p class="s174-cap" data-cap>—</p>
  <div class="s174-screen" data-screen="landed">${screens.landed}</div>
  <div class="s174-screen" data-screen="opened" hidden>${screens.opened}</div>
  <div class="s174-screen" data-screen="card" hidden>${screens.card}</div>

  <p class="s174-foot">Everything here except the decisions line is the <strong>real</strong> product — the header, the receipt
  and the whole step graph are rendered from the running code, not redrawn. The reasoning behind the choice lives in sketches
  <strong>172</strong> and <strong>173</strong>; this page is only the picture.</p>
</div>

<script>
(function(){
  var caps = {
    landed: "The moment the draft arrives. One line under the receipt — the graph keeps its room.",
    opened: "Opened. The five decisions, the AI's answers, and a way to change each one. Press a link and watch the control light up in the header.",
    card: "The same five as an always-open card. Look at how much of your workflow is left below it — this is what a second card costs."
  };
  var tabs = document.querySelectorAll(".s174-tab");
  var screens = document.querySelectorAll(".s174-screen");
  function show(id){
    tabs.forEach(function(t){ t.classList.toggle("s174-tab-on", t.dataset.tab === id); });
    screens.forEach(function(s){ s.hidden = s.dataset.screen !== id; });
    document.querySelector("[data-cap]").textContent = caps[id];
  }
  tabs.forEach(function(t){ t.addEventListener("click", function(){ show(t.dataset.tab); }); });
  show("landed");

  // The line really opens.
  document.addEventListener("click", function(e){
    var b = e.target.closest("[data-toggle-decisions]");
    if(!b) return;
    var sec = b.closest("[data-decisions]");
    var bodyEl = sec.querySelector("[data-decisions-body]");
    var chev = b.querySelector("span[aria-hidden]");
    var open = bodyEl.hidden;
    bodyEl.hidden = !open;
    chev.style.transform = open ? "rotate(90deg)" : "";
    b.lastElementChild.textContent = open ? "hide" : "${esc(SUMMARY_HINT)}";
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
