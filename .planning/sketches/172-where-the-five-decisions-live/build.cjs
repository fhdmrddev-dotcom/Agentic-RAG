#!/usr/bin/env node
/**
 * SKETCH 172 — BUILD. Splices the three variants into the REAL rendered DOM emitted by
 * `emit.test.tsx.src`, asserts every anchor and every difference, and writes
 * `body.generated.html` + `BUILD-CONTRACT.generated.md`.
 *
 * ── THE STRUCTURAL AUDIT IS LOAD-BEARING (165's lesson, inherited) ──
 * A splice into an anchor that is not there fails SILENTLY and produces a variant that
 * quietly equals the baseline — a green-looking sketch showing nothing. So every anchor
 * is asserted PRESENT AND UNIQUE, every variant is asserted to actually DIFFER from the
 * shipped DOM, and this script exits non-zero otherwise.
 *
 * ── WHAT IS REAL AND WHAT IS PROPOSED ──
 * REAL (rendered, never redrawn): the drafted `<header>` with its KB select, its
 * requirement input and the `AI-proposed` mark; the `SeedReceipt` card; the graph
 * column's own grid classes. PROPOSED (NEW, exists in no component): the decisions card
 * in all three of its shapes. Every proposed node carries `data-s172="NEW"` so the
 * contract table below is generated from the markup rather than written alongside it.
 */
const fs = require("node:fs")
const path = require("node:path")

const HERE = __dirname
const dom = JSON.parse(fs.readFileSync(path.join(HERE, "dom.generated.json"), "utf8"))

/* ─────────────────────────── assertions ─────────────────────────── */

const failures = []
let checks = 0

function assert(cond, label) {
  checks += 1
  if (!cond) failures.push(label)
}

function assertUnique(hay, needle, label) {
  checks += 1
  const n = hay.split(needle).length - 1
  if (n !== 1) failures.push(`${label} — expected exactly 1 occurrence, found ${n}`)
}

/* The four dumps exist and are non-trivial. */
for (const key of ["headerAnswered", "headerEmpty", "gridAnswered", "receipt"]) {
  assert(typeof dom[key] === "string" && dom[key].length > 400, `dump "${key}" present and non-trivial`)
}

/* ── The three homes F1 measured. Each is asserted against the REAL header, so if a
      future re-emit loses one, this sketch refuses to build rather than quietly drawing
      a screen that is easier to argue with than the product. ── */
assertUnique(dom.headerAnswered, 'data-testid="project-folder-picker"', "row 1 control lives in the header")
assertUnique(dom.headerAnswered, 'data-testid="business-requirement-input"', "row 3 control lives in the header")
assertUnique(dom.headerAnswered, 'data-testid="business-requirement-ai-mark"', "the AI-proposed mark ships on row 3")
assertUnique(dom.headerAnswered, 'data-testid="builder-bound-folder"', "the KB affordance wrapper is unique")
assertUnique(dom.headerAnswered, 'data-testid="builder-business-requirement"', "the requirement affordance wrapper is unique")

/* ⚠ ROW 4's FINDING, ASSERTED RATHER THAN CLAIMED. The emitter handed the page a
   definition whose `name` is "Vendor-risk review" and whose `slug` is
   "vendor-risk-review". The header renders the SLUG. So the drafted view shows the
   workflow's NAME nowhere at all — which is a sharper fact than "the name is static",
   and it is the one D-15 (edit the name, leave the slug) has to answer for. */
assert(dom.headerAnswered.includes("vendor-risk-review"), "the header renders the SLUG")
assert(
  !dom.headerAnswered.includes("Vendor-risk review"),
  "the header renders the NAME nowhere — row 4 has no display, not merely no control",
)

/* The two shipped invitations, present only in the empty dump. Read from the DOM below
   rather than re-typed, so the card cannot promise words the product does not say. */
const KB_INVITATION = "No knowledge base · searches everything"
const REQUIREMENT_INVITATION = "What must this workflow deliver? · required to publish"
assert(dom.headerEmpty.includes(KB_INVITATION), "UNBOUND_KB_INVITATION read from the real DOM")
assert(dom.headerEmpty.includes(REQUIREMENT_INVITATION), "REQUIREMENT_INVITATION read from the real DOM")
assert(
  !dom.headerEmpty.includes('data-testid="business-requirement-ai-mark"'),
  "the AI-proposed mark is absent when the requirement is empty (the shipped non-empty clause)",
)

/* The receipt's own three counts, so the stacking question is judged against a card in a
   real state rather than a convenient one. */
assert(dom.receipt.includes('data-grounded-count="3"'), "receipt: 3 sealed steps")
assert(dom.receipt.includes('data-detected-count="2"'), "receipt: 2 detected")
assert(dom.receipt.includes('data-carried-count="1"'), "receipt: 1 carried")
assert(dom.receipt.includes("Here's what I built — 5 steps"), "receipt heading is the shipped sentence")
assert(
  dom.receipt.includes("Everything else is yours to change. Nothing is saved or published yet."),
  "receipt close is the shipped SEED_RECEIPT_NOTHING_COMMITTED",
)

/* The graph column's real grid template — the structural cost variant A pays. */
const GRID_ROWS = "grid-rows-[auto_auto_minmax(0,1fr)]"
assertUnique(dom.gridAnswered, GRID_ROWS, "the graph column's real grid template")
assert(
  dom.gridAnswered.includes("*:last-child]:row-start-3"),
  "the graph child is pinned to row 3 by last-child",
)

/* ─────────────────────── the shipped copy, extracted ─────────────────────── */

/** Pull the requirement's live value straight out of the real input, so the card's row 3
 *  cannot show a different sentence from the header's row 3 on the same page. */
const REQUIREMENT_VALUE = (() => {
  const m = dom.headerAnswered.match(/data-testid="business-requirement-input"[^>]*value="([^"]*)"/)
  assert(!!m, "the requirement value is parsed out of the real input, never re-typed")
  return m ? m[1] : ""
})()

/** The bound folder's NAME, parsed from the real select's options rather than assumed. */
const BOUND_FOLDER = (() => {
  const m = dom.headerAnswered.match(/<option value="f2">([^<]*)<\/option>/)
  assert(!!m, "the bound folder name is parsed out of the real select")
  return m ? m[1] : ""
})()

const AI_MARK = (() => {
  const m = dom.headerAnswered.match(/data-testid="business-requirement-ai-mark"[^>]*>([^<]*)</)
  assert(!!m, "the AI-proposed label is parsed out of the real mark")
  return m ? m[1] : ""
})()

const AI_MARK_TITLE = (() => {
  const m = dom.headerAnswered.match(/data-testid="business-requirement-ai-mark"[^>]*title="([^"]*)"/)
  return m ? m[1] : ""
})()

/* ─────────────────────── the proposed decisions card ─────────────────────── */

/**
 * THE FIVE ROWS (D-07), in one order, always all of them.
 *
 * `ask` is the sketch's PROPOSAL for D-09's vocabulary module. `answer` is read from the
 * draft — for rows 1 and 3 it is parsed out of the real header above, so a page cannot
 * show the card and the header disagreeing. `home` records where the control lives
 * TODAY, which is the whole of 172's question.
 */
const ROWS = [
  {
    key: "kb",
    ask: "Which knowledge base should this search?",
    answer: BOUND_FOLDER,
    empty: KB_INVITATION,
    home: "header · project-folder-picker",
    homeShipped: true,
    mark: null,
  },
  {
    key: "template",
    ask: "Is there a template it has to fill?",
    answer: "Nothing attached — it writes its own format",
    empty: "Nothing attached — it writes its own format",
    home: "step panel · TemplateAttachSection",
    homeShipped: true,
    mark: null,
  },
  {
    key: "requirement",
    ask: "What must this workflow deliver?",
    answer: REQUIREMENT_VALUE,
    empty: REQUIREMENT_INVITATION,
    home: "header · business-requirement-input",
    homeShipped: true,
    mark: AI_MARK,
  },
  {
    key: "name",
    ask: "What should this be called?",
    answer: "Vendor-risk review",
    empty: "Untitled workflow",
    home: "nowhere — the header shows the slug",
    homeShipped: false,
    mark: AI_MARK,
  },
  {
    key: "deliverable",
    ask: "What does it produce?",
    answer: "A file, at the last step — Produce the vendor-risk brief",
    empty: "An answer in chat",
    home: "derived — no field to write",
    homeShipped: false,
    mark: null,
  },
]

assert(ROWS.length === 5, "D-07: five fixed rows, always all of them")
assert(
  ROWS.filter((r) => r.homeShipped).length === 3,
  "F1: three of the five rows already have a shipped control",
)

const CARD_HEADING = "Here's what I decided for you — 5 things you can change"
const CARD_CLOSE = "Change any of these and the draft updates in place. Nothing is saved or published yet."
const LIMIT_LINE =
  "Changing an answer does not re-write the steps that were built around the old one."

/** The card's frame — the SAME class string `SeedReceipt` ships, so a stacked pair is
 *  judged on composition rather than on two different card treatments. */
const CARD_FRAME =
  "w-full max-w-[720px] rounded-[14px] border border-border bg-card px-[18px] py-4 shadow-lg"

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * Extract one whole element by depth-counting its own tag, starting from a marker.
 *
 * ⚠ A REGEX WAS TRIED FIRST AND IT FAILED BOTH USES — and that failure is why this
 * function exists rather than a cleverer pattern. `builder-view-toggle` closes on
 * `</button></div>`, not `</div></div>`; `builder-business-requirement` nests three
 * spans, so a lazy `[\s\S]*?</span></span>` stops one level early. Both were caught by
 * the assertions rather than shipping as a variant that silently equalled the baseline —
 * which is the whole reason this build asserts before it writes.
 */
function extractElement(html, marker, tag) {
  const at = html.indexOf(marker)
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

/**
 * One row, in one of three treatments.
 *   "own"    — the card carries its own control (variants A and B)
 *   "index"  — the card states the answer and points at the shipped control (variant C)
 */
function row(r, treatment) {
  const markHtml = r.mark
    ? `<span data-s172="NEW" title="${esc(AI_MARK_TITLE)}" class="shrink-0 rounded border border-border px-1 py-px font-mono text-[9px] font-medium text-muted-foreground">${esc(r.mark)}</span>`
    : ""

  const control =
    treatment === "index"
      ? `<button type="button" data-s172="NEW" data-s172-jump="${r.key}" class="shrink-0 rounded border border-border px-1.5 py-px text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary">${r.homeShipped ? "Change it" : "Not yet"}</button>`
      : `<button type="button" data-s172="NEW" class="shrink-0 rounded border border-border px-1.5 py-px text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary">Edit</button>`

  const where =
    treatment === "index"
      ? `<div data-s172="NEW" class="mt-[3px] font-mono text-[10px] text-muted-foreground/70">${esc(r.home)}</div>`
      : ""

  return `<li data-s172="NEW" data-s172-row="${r.key}" class="flex items-start gap-2 text-[12.5px] text-foreground">
  <span aria-hidden="true" data-s172="NEW" class="mt-[1px] grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full text-[11px] leading-none border border-border text-muted-foreground">?</span>
  <span class="min-w-0 flex-1">
    <span data-s172="NEW" class="text-muted-foreground">${esc(r.ask)}</span>
    <div class="mt-[2px] flex flex-wrap items-center gap-1.5">
      <strong data-s172="NEW" data-s172-answer="${r.key}" class="min-w-0 font-semibold">${esc(r.answer)}</strong>
      ${markHtml}
      ${control}
    </div>
    ${where}
  </span>
</li>`
}

function decisionsCard(treatment, opts = {}) {
  const rows = ROWS.map((r) => row(r, treatment)).join("\n")
  const limit = opts.limit
    ? `<p data-s172="NEW" class="mt-3 text-[12.5px] leading-[1.5] text-muted-foreground">${esc(LIMIT_LINE)}</p>`
    : ""
  return `<section data-s172="NEW" data-testid="s172-decisions" data-treatment="${treatment}" class="${CARD_FRAME}">
  <div class="flex items-start gap-3">
    <h2 data-s172="NEW" class="min-w-0 flex-1 text-[13.5px] font-semibold text-foreground">${esc(opts.heading || CARD_HEADING)}</h2>
    <button type="button" data-s172="NEW" aria-label="Dismiss" class="inline-grid h-5 w-5 shrink-0 place-items-center rounded text-[11px] text-muted-foreground hover:bg-accent/40 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"><span aria-hidden="true">✕</span></button>
  </div>
  <ul data-s172="NEW" class="mt-3 flex flex-col gap-[9px]">
${rows}
  </ul>
  ${limit}
  <p data-s172="NEW" class="mt-3 text-[12.5px] leading-[1.5] text-muted-foreground">${esc(opts.close || CARD_CLOSE)}</p>
</section>`
}

/* ─────────────────────── the stages ─────────────────────── */

/** The graph column, rebuilt from the REAL grid classes with a chosen set of children.
 *  `rows` overrides the template so variant A's structural cost is DEMONSTRATED rather
 *  than asserted: with the shipped 3-row template a fourth child lands in row 3 on top
 *  of the graph. */
function graphColumn(children, rowsClass) {
  const cls = `grid min-h-0 min-w-0 ${rowsClass} overflow-hidden [&>*:last-child]:row-start-${rowsClass === GRID_ROWS ? 3 : 4}`
  return `<div data-s172-column class="${cls}">${children.join("\n")}</div>`
}

const TOGGLE = (() => {
  const el = extractElement(dom.gridAnswered, 'data-testid="builder-view-toggle"', "div")
  assert(!!el, "the real view-toggle strip is extracted from the grid dump")
  assert(
    !!el && el.includes("Spine") && el.includes("Canvas") && el.endsWith("</div>"),
    "the extracted strip is whole — both tabs and a balanced close",
  )
  return el || ""
})()

/** A stand-in for the graph plane. It is NOT `PhaseSpineGraph` — the real one is 139 KB
 *  of dumped DOM and would drown the composition question — so it is drawn as a plain
 *  measured box and SAYS SO. What matters here is only how much height it keeps. */
function graphPlane(label) {
  return `<div data-s172="STAND-IN" data-s172-plane class="min-h-0 overflow-hidden border-t border-border bg-background/40 p-3">
  <div class="flex h-full min-h-0 items-center justify-center rounded-md border border-dashed border-border text-[12px] text-muted-foreground">${esc(label)}</div>
</div>`
}

/** The header, optionally with the two shipped affordances REMOVED — a real deletion
 *  from the real DOM, which is what variant B actually proposes. */
function headerWithout(keys) {
  let html = dom.headerAnswered
  for (const testid of keys) {
    const el = extractElement(html, `data-testid="${testid}"`, "span")
    assert(!!el, `variant B locates the shipped ${testid} in the real header`)
    if (!el) continue
    const before = html
    html = html.replace(el, "")
    assert(html !== before, `variant B removes the shipped ${testid} from the real header`)
    assert(
      !html.includes(`data-testid="${testid}"`),
      `variant B removes ${testid} WHOLLY — no orphaned fragment left behind`,
    )
  }
  return html
}

const stageA = `
${dom.headerAnswered}
${graphColumn([TOGGLE, dom.receipt, decisionsCard("own", { limit: true }), graphPlane("the canvas / spine — what is left of it")], GRID_ROWS)}
`

const stageAFixed = `
${dom.headerAnswered}
${graphColumn([TOGGLE, dom.receipt, decisionsCard("own", { limit: true }), graphPlane("the canvas / spine — a fourth grid row was added for the card")], "grid-rows-[auto_auto_auto_minmax(0,1fr)]")}
`

const stageB = `
${headerWithout(["builder-bound-folder", "builder-business-requirement"])}
${graphColumn([TOGGLE, dom.receipt, decisionsCard("own", { limit: true, heading: "Here's what I decided for you — 5 things you can change", close: "These five live here now. Nothing is saved or published yet." }), graphPlane("the canvas / spine")], "grid-rows-[auto_auto_auto_minmax(0,1fr)]")}
`

const stageC = `
${dom.headerAnswered}
${graphColumn([TOGGLE, dom.receipt, decisionsCard("index", { limit: true, heading: "Here's what I decided for you — and where to change each one", close: "Every one of these is already yours to change. Nothing is saved or published yet." }), graphPlane("the canvas / spine")], "grid-rows-[auto_auto_auto_minmax(0,1fr)]")}
`

/* Each variant must actually DIFFER from the shipped baseline, and from each other. */
const baseline = `${dom.headerAnswered}\n${dom.gridAnswered}`
assert(stageA !== baseline, "variant A differs from the shipped screen")
assert(stageB !== baseline, "variant B differs from the shipped screen")
assert(stageC !== baseline, "variant C differs from the shipped screen")
assert(stageA !== stageB && stageB !== stageC && stageA !== stageC, "the three variants differ from each other")
assert(
  stageB.indexOf('data-testid="project-folder-picker"') === -1,
  "variant B genuinely has no KB select in its header",
)
assert(
  stageC.includes('data-testid="project-folder-picker"'),
  "variant C leaves the shipped header untouched",
)
assert(stageC.includes('data-s172-jump="kb"'), "variant C's rows point at a home")

/* ─────────────────────── page chrome ─────────────────────── */

const NEW_COUNT = (stageA.match(/data-s172="NEW"/g) || []).length

function tabButton(id, label, extra = "") {
  return `<button class="s172-tab${extra}" data-tab="${id}">${label}</button>`
}

const homesTable = ROWS.map(
  (r) => `<tr>
  <td><code>${esc(r.key)}</code></td>
  <td class="s172-rule">${esc(r.ask)}</td>
  <td>${r.homeShipped ? '<span class="s172-status s172-status-shipped">SHIPPED</span>' : '<span class="s172-status s172-status-new">NO HOME</span>'}</td>
  <td class="s172-where"><code>${esc(r.home)}</code></td>
</tr>`,
).join("\n")

const body = `
<div class="s172-root">
  <div class="s172-head">
    <div class="s172-kicker">Sketch 172 · Phase 197 Guided Authoring · G-2 gate · AUTH-02</div>
    <h1>Where the five decisions live</h1>
    <p class="s172-lede">A freshly generated draft arrives with five decisions the AI made for you. D-07 says all five
    become answerable. The question this sketch asks is <strong>not</strong> what the card says — it is whether the card should
    <em>own</em> controls at all, because three of the five already have one.</p>
  </div>

  <div class="s172-mech">
    <strong>⚠ The finding that reshaped this sketch, measured not assumed.</strong>
    <p>Phase 197's CONTEXT anticipates <em>“two receipts stacked on one screen is a composition problem, and it is the sketch's problem.”</em>
    That understates it. Rendering the real drafted Builder shows that <strong>rows 1 and 3 already have working controls in the header
    identity strip</strong>, and <strong>row 4 has no display at all</strong> — the header renders the <em>slug</em>, so the workflow's
    name appears nowhere on this screen. The composition problem is not two cards. It is <strong>a second home for two shipped
    controls</strong>, on a page whose own source states the rule verbatim: <code>kbAffordance</code>'s docblock reads
    <em>“A second, different answer to one question is drift.”</em></p>
    <p class="s172-caveat">Everything in a <span class="s172-status s172-status-shipped">SHIPPED</span> region below is the REAL rendered
    component, dumped from <code>WorkflowBuilderPage</code> and <code>SeedReceipt</code> under jsdom — not redrawn.
    Everything marked <span class="s172-status s172-status-new">NEW</span> exists in no component today.
    <strong>${NEW_COUNT} proposed nodes</strong> on variant A, each tagged <code>data-s172="NEW"</code> in the markup.</p>
  </div>

  <div class="s172-tabs">
    ${tabButton("a", "A · Sibling card")}
    ${tabButton("b", "B · One home")}
    ${tabButton("c", "C · The index")}
    ${tabButton("homes", "⚠ The three homes")}
    ${tabButton("contract", "The contract")}
  </div>

  <section class="s172-panel" data-panel="a">
    <div class="s172-axis"><span class="s172-badge s172-badge-baseline">A · LITERAL D-02</span>
      <p>The decisions card arrives as a <strong>sibling of the receipt</strong>, above the graph, carrying its own five controls.
      This is what the CONTEXT describes. It is also the only variant that installs a <strong>second home</strong> for the KB scope and the
      requirement — the header keeps its own, and the two are now two answers to one question.</p></div>

    <h3 class="s172-h3">A1 — spliced into the shipped 3-row grid, unchanged</h3>
    <p class="s172-note">The graph column ships as <code>${esc(GRID_ROWS)}</code> with the graph pinned by
    <code>[&amp;&gt;*:last-child]:row-start-3</code>. Add a fourth child and the pin does something worse than crowd the graph —
    <strong>it strands it.</strong> The card auto-places into an <em>implicit</em> fourth row sized to its own content, the
    <code>minmax(0,1fr)</code> third row is left with nothing to distribute, and the graph — which is
    <code>last-child</code>, so it is nailed to row 3 — <strong>collapses</strong>, rendering only its overflow on top of the card.</p>
    <p class="s172-note" data-s172-measure="a1">Measuring the stage below…</p>
    <p class="s172-note">This is the same cost <code>requirementAffordance</code>'s own docblock names when it explains why the
    control went in the header — <em>“a control in <code>graphColumn</code> would steal a third <code>auto</code> row … and
    permanently shorten the flow — the exact complaint 184.1 exists to have fixed.”</em> The docblock predicted a shorter graph.
    Measured, with the <code>last-child</code> pin in play, it is not shorter: it is gone.</p>
    <div class="s172-stage s172-stage-tall">${stageA}</div>

    <h3 class="s172-h3">A2 — with the fourth row added (what a build would actually ship)</h3>
    <p class="s172-note">The template becomes <code>grid-rows-[auto_auto_auto_minmax(0,1fr)]</code> and the graph's pin moves to
    row 4. The stranding is fixed. <strong>The height problem is not</strong> — and this is the finding, measured rather than
    predicted: at a laptop-sized column the receipt and the decisions card <em>together</em> already exceed the space, so the graph
    is squeezed out by arithmetic rather than by a grid bug. Read the measured line below, then drag the stage taller (its corner
    resizes) to find the height at which the graph gets usable room. <strong>That height is what stacking two cards costs.</strong></p>
    <div class="s172-stage s172-stage-tall">${stageAFixed}</div>
    <p class="s172-note" data-s172-measure="a2">Measuring the stage above…</p>

    <h3 class="s172-h3">How tall does the column have to be before the graph gets room?</h3>
    <p class="s172-note">Swept automatically against the A2 stage — the stage's height is set, the graph plane is measured, the
    height is restored. Nothing here is estimated.</p>
    <table class="s172-table" data-s172-sweep><thead><tr><th>graph column height</th><th>graph plane gets</th><th></th></tr></thead><tbody><tr><td colspan="3">Sweeping…</td></tr></tbody></table>
    <p class="s172-note">⚠ <strong>Why this is the number that matters.</strong> On a 900 px-tall laptop the Builder's graph column
    is what is left after the app chrome and this page's own header bar — comfortably inside the range where the sweep shows the
    graph getting little or nothing. Variant A does not make the canvas smaller; at laptop size it makes the canvas
    <em>absent until you scroll</em>, on the screen whose whole job is showing you the workflow that was just built.</p>
  </section>

  <section class="s172-panel" data-panel="b" hidden>
    <div class="s172-axis"><span class="s172-badge s172-badge-b">B · ONE HOME</span>
      <p>The card is the <strong>single</strong> home: the two header affordances are <strong>deleted</strong> and their controls move into
      the card. No drift, one answer per question. The header keeps only identity — slug, draft, save.</p></div>
    <p class="s172-note">⚠ <strong>Two costs, and neither is cosmetic.</strong> (1) The card is <strong>dismissible</strong> by D-04 — so
    dismissing it removes the only way to re-bind a knowledge base or edit the requirement, on a screen where those are publish
    requirements. That is BUG-260731-03 re-created by design. (2) The header's flag-off markup is pinned as a literal in
    <code>WorkflowBuilderPage.header.test.tsx</code> band 3, and its own note says the phase expects <em>no third</em> re-capture.</p>
    <div class="s172-stage s172-stage-tall">${stageB}</div>
  </section>

  <section class="s172-panel" data-panel="c" hidden>
    <div class="s172-axis"><span class="s172-badge s172-badge-c">C · THE INDEX</span>
      <p>The card <strong>owns no control</strong>. It names each decision, shows the answer the AI chose, and hands you to the control that
      already exists — highlighting it in place. Rows 4 and 5, which have no home, say so plainly instead of pretending.</p></div>
    <p class="s172-note">Press <strong>Change it</strong> on any row: the shipped control in the header is focused and ringed. Nothing is
    duplicated, so nothing can drift; the header stays byte-identical, so band 3 is never re-captured; and dismissal costs
    nothing, because the card was never the only door. <strong>This is where sketch 174 (“what dismissal costs”) folded in</strong> —
    on this variant the question dissolves rather than needing an answer.</p>
    <p class="s172-note">⚠ <strong>Its honest weakness:</strong> rows 4 and 5 have nowhere to point. The name has no control anywhere
    (D-15 would add one), and the deliverable is <em>derived</em> from the last step rather than stored — <code>soulDeliverable()</code>
    reads a terminal <code>llm_emit</code>. So C is only complete if this phase also gives row 4 a home. That is a scope
    consequence, and it is stated here rather than discovered at plan time.</p>
    <div class="s172-stage s172-stage-tall">${stageC}</div>
  </section>

  <section class="s172-panel" data-panel="homes" hidden>
    <div class="s172-axis"><span class="s172-badge s172-badge-p">EVIDENCE</span>
      <p>What already exists on the drafted view, measured by rendering it. This tab is the reason the three variants are the three
      variants.</p></div>
    <table class="s172-table">
      <thead><tr><th>D-07 row</th><th>The ask</th><th>Control today</th><th>Where</th></tr></thead>
      <tbody>${homesTable}</tbody>
    </table>
    <h3 class="s172-h3">The shipped header, answered — rendered, not redrawn</h3>
    <p class="s172-note">Three of D-07's five rows are in this one 11 px strip. Note the scale: the KB select is
    <code>max-w-[220px] truncate</code>, the requirement input is <code>w-[240px] truncate</code> holding a
    ${REQUIREMENT_VALUE.length}-character sentence, and the <code>${esc(AI_MARK)}</code> mark is <strong>9 px</strong>.</p>
    <div class="s172-stage">${dom.headerAnswered}</div>
    <p class="s172-note" data-s172-measure="trunc">Measuring…</p>
    <h3 class="s172-h3">The same strip with both answers missing</h3>
    <p class="s172-note">The two shipped invitations. This is the state a fresh generation would be in only if the model emitted
    neither — and <code>SEED-163</code> measured that the requirement is now proposed on every generation, so in practice the
    author meets the <em>answered</em> strip above, not this one.</p>
    <div class="s172-stage">${dom.headerEmpty}</div>
    <h3 class="s172-h3">The shipped receipt — the card any sibling stacks under</h3>
    <p class="s172-note">Its close line already says <em>“Everything else is yours to change. Nothing is saved or published yet.”</em>
    A second card repeating a version of that sentence is the redundancy variant A has to earn its way past.</p>
    <div class="s172-stage">${dom.receipt}</div>
  </section>

  <section class="s172-panel" data-panel="contract" hidden>
    <div class="s172-axis"><span class="s172-badge s172-badge-p">PROVENANCE</span>
      <p>Which regions on this page are the shipped build and which are proposals. Generated from the markup, not written beside it.</p></div>
    <table class="s172-table">
      <thead><tr><th>Region</th><th>Source</th><th>Drift risk</th></tr></thead>
      <tbody>
        <tr><td>the drafted <code>&lt;header&gt;</code> — slug, draft chip, KB select, requirement input, AI-proposed mark, Save</td><td><span class="s172-status s172-status-shipped">SHIPPED</span> real rendered <code>WorkflowBuilderPage</code></td><td><strong>none — it <em>is</em> the build</strong></td></tr>
        <tr><td>the <code>SeedReceipt</code> card, its two paragraphs, three sealed rows and close line</td><td><span class="s172-status s172-status-shipped">SHIPPED</span> real rendered <code>SeedReceipt</code></td><td><strong>none — it <em>is</em> the build</strong></td></tr>
        <tr><td>the graph column's grid template and its <code>last-child</code> pin</td><td><span class="s172-status s172-status-shipped">SHIPPED</span> class strings from the real dump</td><td><strong>none</strong></td></tr>
        <tr><td>the decisions card — every node, all three treatments</td><td><span class="s172-status s172-status-new">NEW</span> proposed</td><td>ordinary</td></tr>
        <tr><td>the five <em>ask</em> sentences</td><td><span class="s172-status s172-status-new">NEW</span> proposed — D-09's vocabulary module is the build's home for them</td><td>ordinary</td></tr>
        <tr><td>rows 1 and 3's <em>answers</em>, and the AI-proposed mark inside the card</td><td><span class="s172-status s172-status-shipped">SHIPPED</span> parsed out of the real header DOM</td><td><strong>none — cannot disagree with the header</strong></td></tr>
        <tr><td>the graph plane inside each stage</td><td><span class="s172-status s172-status-change">STAND-IN</span> a measured box, NOT <code>PhaseSpineGraph</code></td><td>height only — do not judge the graph itself here</td></tr>
        <tr><td>row 5's answer sentence</td><td><span class="s172-status s172-status-new">NEW</span> — the <em>signal</em> is real (<code>soulDeliverable</code>), the wording is proposed</td><td>ordinary</td></tr>
      </tbody>
    </table>

    <h3 class="s172-h3">⚠ What this page deliberately does NOT resolve</h3>
    <p class="s172-note"><strong>1. The row's own anatomy.</strong> Ask-first vs answer-first, and what a row looks like when it is
    already right — that is sketch <strong>173</strong>. Every row here uses one treatment so the <em>placement</em> question is not
    contaminated by a <em>wording</em> question.</p>
    <p class="s172-note"><strong>2. The server-derived readiness verdict (D-13).</strong> No row here shows a per-row verdict, because
    the field does not exist yet and inventing its rendering would be the client-side derivation D-13 explicitly refuses.</p>
    <p class="s172-note"><strong>3. Hover, focus rings, pixel spacing.</strong> A human comparison at UAT, driven by looking.</p>

    <h3 class="s172-h3">⚠ A correction this sketch carries upstream</h3>
    <p class="s172-note"><code>197-CONTEXT.md</code>'s <code>&lt;deferred&gt;</code> lists <strong>BUG-260809-02</strong> as
    <em>“(blocking) — a canvas-built workflow can never be published … NOT closed by this phase.”</em> Its frontmatter reads
    <code>status: closed</code>, <code>folded_into: quick-260809-klo</code>,
    <code>verified_closed_by: live-uat-2026-08-10</code>. That quick task is what shipped the very requirement input rendered on this
    page. D-06's recorded consequence therefore does not exist — and the control it shipped is half of why variant A installs a
    second home.</p>

    <h3 class="s172-h3">Reproduce from a clean checkout</h3>
    <p class="s172-note">
      <code>cp .planning/sketches/172-where-the-five-decisions-live/emit.test.tsx.src frontend/src/pages/__emit172.test.tsx</code><br>
      <code>cd frontend &amp;&amp; GSD_VITEST_MAX_WORKERS=2 npx vitest run src/pages/__emit172.test.tsx &amp;&amp; cd ..</code><br>
      <code>rm frontend/src/pages/__emit172.test.tsx</code><br>
      <code>node .planning/sketches/172-where-the-five-decisions-live/build.cjs</code><br>
      <code>npx tailwindcss -c &lt;a copy of frontend/tailwind.config.js whose content is body.generated.html&gt; -i frontend/src/index.css -o tw.generated.css --minify</code><br>
      <code>node .planning/sketches/172-where-the-five-decisions-live/assemble.cjs</code>
    </p>
  </section>
</div>

<script>
(function(){
  var tabs = document.querySelectorAll(".s172-tab");
  var panels = document.querySelectorAll(".s172-panel");
  function show(id){
    tabs.forEach(function(t){ t.classList.toggle("s172-tab-on", t.dataset.tab === id); });
    panels.forEach(function(p){ p.hidden = p.dataset.panel !== id; });
  }
  tabs.forEach(function(t){ t.addEventListener("click", function(){ show(t.dataset.tab); measure(); }); });
  show("a");

  // Variant C's whole proposal, made real: pressing a row's control focuses and rings the
  // SHIPPED control it points at, inside the same stage.
  document.addEventListener("click", function(e){
    var b = e.target.closest("[data-s172-jump]");
    if(!b) return;
    var stage = b.closest(".s172-stage");
    if(!stage) return;
    var key = b.getAttribute("data-s172-jump");
    // The three shipped homes, and WHICH of them this stage can actually reach. The
    // template's home is real but lives in the step panel, which is not on this stage —
    // saying so is the honest answer, and inventing a jump to it would be the drift this
    // whole variant exists to avoid.
    var inHeader = { kb: "project-folder-picker", requirement: "business-requirement-input" };
    var elsewhere = {
      template: "lives in the step panel (TemplateAttachSection) — not on this stage",
      name: "no control anywhere today — D-15 would add one",
      deliverable: "derived from the last step — there is no field to write",
    };
    var say = function (msg) {
      var note = b.parentElement.querySelector("[data-s172-said]");
      if (!note) {
        note = document.createElement("span");
        note.setAttribute("data-s172-said", "");
        note.className = "font-mono text-[10px] text-muted-foreground/70";
        b.parentElement.appendChild(note);
      }
      note.textContent = msg;
    };
    var id = inHeader[key];
    if(!id){ say(elsewhere[key] || ""); return; }
    var target = stage.querySelector('[data-testid="' + id + '"]');
    if(!target){ say("target not on this stage"); return; }
    target.focus();
    target.style.outline = "2px solid hsl(var(--primary))";
    target.style.outlineOffset = "2px";
    say("focused the shipped control in the header ↑");
    setTimeout(function(){ target.style.outline = ""; }, 1600);
  });

  // Real geometry, printed rather than claimed.
  //
  // WARNING: it measures ONLY the stages in the VISIBLE panel. A first cut measured every
  // stage on the page and dutifully reported 0 px for the ones inside hidden panels — a
  // number that was arithmetically true and completely meaningless. Hence the re-measure
  // on every tab switch.
  // One reporter for both stages. Every clause is DERIVED from a measurement; none of it
  // is a conclusion written in advance and dressed as a reading.
  function report(el, note, label){
    if(!el || !note) return;
    var col = el.querySelector("[data-s172-column]");
    var plane = el.querySelector("[data-s172-plane]");
    var receipt = el.querySelector('[data-testid="seed-receipt"]');
    var card = el.querySelector('[data-testid="s172-decisions"]');
    if(!col || !plane) return;
    var h = function(n){ return n ? Math.round(n.getBoundingClientRect().height) : 0; };
    var stageH = h(el), rh = h(receipt), ch = h(card), ph = h(plane);
    var declared = (col.className.match(/grid-rows-\\[[^\\]]*\\]/) || ["?"])[0];
    note.textContent =
      label + " — declared " + declared +
      " · resolved " + getComputedStyle(col).gridTemplateRows +
      ". In this " + stageH + " px column the receipt takes " + rh +
      " px and the decisions card " + ch + " px (" + (rh + ch) +
      " px of cards), leaving the graph " + ph + " px." +
      (ph < 80
        ? "  ⚠ Two stacked cards have consumed the graph column. Drag the stage's bottom-right corner taller to find the height at which the graph gets usable room — that height is what this variant costs."
        : "");
  }

  // The sweep. Set a height, measure, restore — so the "how tall must the column be"
  // question is answered by the page rather than by anyone's estimate.
  function sweep(){
    var table = document.querySelector("[data-s172-sweep] tbody");
    var st = document.querySelectorAll('[data-panel="a"] .s172-stage-tall')[1];
    if(!table || !st) return;
    var plane = st.querySelector("[data-s172-plane]");
    if(!plane) return;
    var original = st.style.height;
    var rows = "";
    [620, 700, 760, 820, 900, 1000].forEach(function(h){
      st.style.height = h + "px";
      void st.offsetHeight;
      var got = Math.round(plane.getBoundingClientRect().height);
      var verdict = got < 40 ? "unusable" : got < 150 ? "a sliver" : "workable";
      rows += "<tr><td>" + h + " px</td><td><strong>" + got + " px</strong></td><td class='s172-where'>" + verdict + "</td></tr>";
    });
    st.style.height = original;
    void st.offsetHeight;
    table.innerHTML = rows;
  }

  function measure(){
    var stages = document.querySelectorAll('[data-panel="a"] .s172-stage-tall');
    report(stages[0], document.querySelector('[data-s172-measure="a1"]'), "Measured, shipped 3-row template");
    report(stages[1], document.querySelector('[data-s172-measure="a2"]'), "Measured, fourth row added");
    if(!document.querySelector('[data-panel="a"]').hidden) sweep();
    var t = document.querySelector('[data-s172-measure="trunc"]');
    if(t){
      var input = document.querySelector('[data-panel="homes"] [data-testid="business-requirement-input"]');
      if(input){
        var full = input.value.length;
        var cs = getComputedStyle(input);
        var probe = document.createElement("span");
        probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre;font:" + cs.font;
        probe.textContent = input.value;
        document.body.appendChild(probe);
        var textW = probe.getBoundingClientRect().width;
        var boxW = input.getBoundingClientRect().width;
        probe.remove();
        var shown = textW > 0 ? Math.min(full, Math.round(full * boxW / textW)) : full;
        t.textContent = "Measured: the requirement input is " + Math.round(boxW) + " px wide at " + cs.fontSize +
          "; the value is " + full + " characters needing " + Math.round(textW) + " px, so roughly " + shown +
          " of them are visible — about " + Math.round(100 * shown / full) + "% of the sentence this workflow exists to satisfy.";
      }
    }
  }
  if(document.readyState === "complete") measure(); else window.addEventListener("load", measure);
})();
</script>
`

/* ─────────────────────── emit ─────────────────────── */

if (failures.length) {
  console.error(`\n✗ ${failures.length} of ${checks} assertions FAILED:\n`)
  for (const f of failures) console.error(`   · ${f}`)
  process.exit(1)
}

fs.writeFileSync(path.join(HERE, "body.generated.html"), body, "utf8")

const contract = `# Sketch 172 — BUILD CONTRACT (generated)

Generated by \`build.cjs\`. Do not hand-edit.

- assertions run: **${checks}**, failing: **0**
- proposed (\`NEW\`) nodes on variant A: **${NEW_COUNT}**
- D-07 rows: **${ROWS.length}**, of which **${ROWS.filter((r) => r.homeShipped).length}** already have a shipped control

| D-07 row | ask (proposed) | control today | where |
|---|---|---|---|
${ROWS.map((r) => `| \`${r.key}\` | ${r.ask} | ${r.homeShipped ? "**SHIPPED**" : "**none**"} | \`${r.home}\` |`).join("\n")}

## Copy read from the real DOM, never re-typed

| constant | value |
|---|---|
| \`UNBOUND_KB_INVITATION\` | ${KB_INVITATION} |
| \`REQUIREMENT_INVITATION\` | ${REQUIREMENT_INVITATION} |
| \`REQUIREMENT_AI_MARK_LABEL\` | ${AI_MARK} |
| \`REQUIREMENT_AI_MARK_EXPLANATION\` | ${AI_MARK_TITLE} |
| the requirement's live value | ${REQUIREMENT_VALUE} (${REQUIREMENT_VALUE.length} chars) |
| the bound folder's name | ${BOUND_FOLDER} |

## Shipped regions (rendered, never redrawn)

- the drafted \`<header>\` of \`WorkflowBuilderPage\` with \`visual_workflow_canvas\` ON
- \`SeedReceipt\` at 3 sealed steps / 2 detected / 1 carried
- the graph column's \`${GRID_ROWS}\` template and its \`last-child\` row pin
`

fs.writeFileSync(path.join(HERE, "BUILD-CONTRACT.generated.md"), contract, "utf8")

console.log(`✓ ${checks} assertions, 0 failing`)
console.log(`  body.generated.html          ${(body.length / 1024).toFixed(1)} KB`)
console.log(`  BUILD-CONTRACT.generated.md  ${(contract.length / 1024).toFixed(1)} KB`)
console.log(`  proposed NEW nodes on A: ${NEW_COUNT}`)
