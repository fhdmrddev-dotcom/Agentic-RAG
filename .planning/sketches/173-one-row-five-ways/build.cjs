#!/usr/bin/env node
/**
 * SKETCH 173 — BUILD. The decisions card's ROW ANATOMY, drawn three ways across all five
 * D-07 rows and every state each row can actually be in.
 *
 * ── IT READS 172's DUMP RATHER THAN EMITTING ITS OWN ──
 * The shipped copy this card must not contradict — `UNBOUND_KB_INVITATION`,
 * `REQUIREMENT_INVITATION`, `REQUIREMENT_AI_MARK_LABEL` and its explanation, and the real
 * `AI-proposed` mark markup — all live in sketch 172's `dom.generated.json`, which was
 * emitted from the REAL rendered `WorkflowBuilderPage`. Re-emitting a second 156 KB copy
 * would create two dumps that can disagree; reading 172's cannot. The dependency is
 * asserted, so this build fails loudly rather than silently drawing invented copy.
 *
 * ── WHAT IS PROPOSED HERE, SAID PLAINLY ──
 * Almost everything. The decisions card exists in no component, so unlike 172 — whose
 * central surfaces ship — 173 is a DRAWING and must be read as one. What keeps it honest
 * is that every SENTENCE THE PRODUCT ALREADY OWNS is read from the dump, and every
 * sentence this sketch proposes is marked. `build.cjs` asserts the ratio rather than
 * asking a reader to trust it.
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

assert(fs.existsSync(DUMP), "sketch 172's dump is present — 173 reads it rather than re-emitting")
const dom = fs.existsSync(DUMP) ? JSON.parse(fs.readFileSync(DUMP, "utf8")) : {}

/* ── The shipped copy, PARSED, never re-typed. ── */
function parse(re, label, src) {
  const m = (src || "").match(re)
  assert(!!m, label)
  return m ? m[1] : ""
}

const KB_INVITATION = parse(
  /<option value="">([^<]*)<\/option>/,
  "UNBOUND_KB_INVITATION parsed from the real select",
  dom.headerEmpty,
)
const REQUIREMENT_INVITATION = parse(
  /data-testid="business-requirement-input"[^>]*placeholder="([^"]*)"/,
  "REQUIREMENT_INVITATION parsed from the real input",
  dom.headerEmpty,
)
const AI_MARK = parse(
  /data-testid="business-requirement-ai-mark"[^>]*>([^<]*)</,
  "REQUIREMENT_AI_MARK_LABEL parsed from the real mark",
  dom.headerAnswered,
)
const AI_MARK_TITLE = parse(
  /data-testid="business-requirement-ai-mark"[^>]*title="([^"]*)"/,
  "REQUIREMENT_AI_MARK_EXPLANATION parsed from the real mark",
  dom.headerAnswered,
)
const REQUIREMENT_VALUE = parse(
  /data-testid="business-requirement-input"[^>]*value="([^"]*)"/,
  "the requirement's live value parsed from the real input",
  dom.headerAnswered,
)
const RECEIPT_CLOSE = parse(
  /data-testid="seed-receipt-close"[^>]*>([^<]*)</,
  "SEED_RECEIPT_NOTHING_COMMITTED parsed from the real receipt",
  dom.receipt,
)
const RECEIPT_HEADING = parse(
  /data-testid="seed-receipt-heading"[^>]*>([^<]*)</,
  "the receipt's heading parsed from the real card",
  dom.receipt,
)

/* The real mark's own markup, lifted whole so row 3 wears the SHIPPED badge rather than a
   redraw of it — the one node on this page that is not a proposal. */
const AI_MARK_HTML = (() => {
  const m = (dom.headerAnswered || "").match(/<span data-testid="business-requirement-ai-mark"[\s\S]*?<\/span>/)
  assert(!!m, "the shipped AI-proposed mark markup is lifted whole")
  return m ? m[0] : ""
})()

assert(AI_MARK === "AI-proposed", "the mark's label is the shipped string")
assert(
  !/\b(good|correct|durable|verified|approved)\b/i.test(AI_MARK_TITLE),
  "D-16: the shipped explanation claims AUTHORSHIP, never quality — this page inherits that floor",
)

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/* ─────────────────────── the five rows × their real states ─────────────────────── */

/**
 * D-07's five, each with the states it can ACTUALLY be in — which differ per row, and
 * that asymmetry is the whole reason this sketch exists. Rows 1–3 have a stored field and
 * an empty state. Row 4 has a stored field and no control. Row 5 has NO FIELD AT ALL.
 *
 * `ask` is this sketch's proposal for D-09's vocabulary module.
 * `answered` / `empty` are what the row shows; where the product owns the words, they are
 * the parsed constants above.
 */
const ROWS = [
  {
    key: "kb",
    ask: "Which knowledge base should this search?",
    caption: "Knowledge base",
    answered: "Vendor contracts",
    empty: KB_INVITATION,
    emptyIsShipped: true,
    mark: false,
    kind: "stored",
    home: "header · project-folder-picker",
    note: "The shipped empty state already says what unbound MEANS — 'searches everything' — which is a fact about configuration, not a warning. A row that re-words it would be a second truth-teller.",
  },
  {
    key: "template",
    ask: "Is there a template it has to fill?",
    caption: "Template",
    answered: "pm-weekly-status-report.docx · 8 fields",
    empty: "Nothing attached — it writes its own format",
    emptyIsShipped: false,
    mark: false,
    kind: "elsewhere",
    home: "step panel · TemplateAttachSection",
    note: "The only row whose control lives on another surface. Its answered state is the one place this card could usefully show a COUNT, because the count is what tells you the draft was aimed at the right questions (SEED-157).",
  },
  {
    key: "requirement",
    ask: "What must this workflow deliver?",
    caption: "Business requirement",
    answered: REQUIREMENT_VALUE,
    empty: REQUIREMENT_INVITATION,
    emptyIsShipped: true,
    mark: true,
    kind: "stored",
    home: "header · business-requirement-input",
    note: "The publish gate's own predicate (grounding.py business_requirement_missing). D-12 says the row reads the SERVER's source, never a copy. It is also the only row that ships a provenance mark today.",
  },
  {
    key: "name",
    ask: "What should this be called?",
    caption: "Name",
    answered: "Vendor-risk review",
    empty: "Untitled workflow",
    emptyIsShipped: false,
    mark: true,
    kind: "no-control",
    home: "nowhere — the header shows the slug",
    note: "⚠ The drafted view shows the workflow's NAME nowhere at all (measured in sketch 172 — the header renders the slug). So this row is not adding a second control; it is adding the FIRST display.",
  },
  {
    key: "deliverable",
    ask: "What does it produce?",
    caption: "Deliverable",
    answered: "A file, at the last step — Produce the vendor-risk brief",
    empty: "An answer in chat",
    emptyIsShipped: false,
    mark: false,
    kind: "derived",
    home: "derived — no field to write",
    note: "⚠ There is NO FIELD. soulDeliverable() derives this from whether a terminal llm_emit exists. 'Answering' it means editing a step, so an Edit control here would write a cheque the store cannot cash.",
  },
]

assert(ROWS.length === 5, "D-07: five rows")
assert(ROWS.filter((r) => r.emptyIsShipped).length === 2, "two rows' empty states are SHIPPED sentences")
assert(ROWS.filter((r) => r.kind === "derived").length === 1, "exactly one row has no field at all")
assert(ROWS.filter((r) => r.mark).length === 2, "two rows carry a provenance mark (187 name, 193.2 requirement)")

const LIMIT_LINE =
  "Changing an answer does not re-write the steps that were built around the old one."

/* ─────────────────────── three treatments ─────────────────────── */

function markHtml(row, treatment) {
  if (!row.mark) return ""
  // Row 3 wears the SHIPPED mark markup. Row 4's flag (`name_seeded_by_ai`) shipped in 187
  // but has never been RENDERED anywhere, so its badge is a proposal drawn in the shipped
  // mark's own shape — marked NEW, never passed off as existing.
  return row.key === "requirement"
    ? AI_MARK_HTML
    : `<span data-s173="NEW" title="${esc(AI_MARK_TITLE)}" class="shrink-0 rounded border border-border px-1 py-px font-mono text-[9px] font-medium text-muted-foreground">${esc(AI_MARK)}</span>`
}

function control(row) {
  if (row.kind === "derived") {
    return `<span data-s173="NEW" class="shrink-0 font-mono text-[10px] text-muted-foreground/70">no field — set by the last step</span>`
  }
  if (row.kind === "elsewhere") {
    return `<button type="button" data-s173="NEW" class="shrink-0 rounded border border-border px-1.5 py-px text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary">In the step panel</button>`
  }
  return `<button type="button" data-s173="NEW" class="shrink-0 rounded border border-border px-1.5 py-px text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary">Edit</button>`
}

/** A — ASK FIRST, uniform. The question leads on every row, in every state. */
function rowA(row, state) {
  const value = state === "empty" ? row.empty : row.answered
  const dim = state === "empty" ? " text-muted-foreground/70 italic" : ""
  return `<li data-s173="NEW" data-row="${row.key}" data-state="${state}" class="flex items-start gap-2 text-[12.5px] text-foreground">
  <span aria-hidden="true" data-s173="NEW" class="mt-[1px] grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full border border-border text-[11px] leading-none text-muted-foreground">?</span>
  <span class="min-w-0 flex-1">
    <span data-s173="NEW" class="text-muted-foreground">${esc(row.ask)}</span>
    <div class="mt-[2px] flex flex-wrap items-center gap-1.5">
      <strong class="min-w-0 font-semibold${dim}">${esc(value)}</strong>
      ${state === "empty" ? "" : markHtml(row, "a")}
      ${control(row)}
    </div>
  </span>
</li>`
}

/** B — QUIET WHEN ANSWERED. A row with a value collapses to a fact; a row without one keeps
 *  the full question.
 *
 *  ⚠ THE LINE THIS VARIANT MUST NOT CROSS, and it is D-07's own reasoning. "Quiet when
 *  answered" is allowed ONLY if "answered" means THE FIELD IS NON-EMPTY — a server-side
 *  fact. It may NEVER mean "the AI got it right": D-07 rejected a needs-attention row set
 *  precisely because no such predicate exists (SEED-163 measured gpt-5.5 naming one-run
 *  parameters in 5 of 5 requirements, all 20 still correctly stamped). So B's quiet state
 *  is a statement about EMPTINESS, never about quality — which is also why the AI-proposed
 *  mark survives into the quiet state rather than being treated as a resolved warning. */
function rowB(row, state) {
  const value = state === "empty" ? row.empty : row.answered
  if (state === "empty") return rowA(row, state)
  return `<li data-s173="NEW" data-row="${row.key}" data-state="${state}" class="flex items-start gap-2 text-[12.5px] text-foreground">
  <span aria-hidden="true" data-s173="NEW" class="mt-[1px] grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full text-[11px] leading-none text-muted-foreground">·</span>
  <span class="min-w-0 flex-1">
    <div class="flex flex-wrap items-baseline gap-1.5">
      <span data-s173="NEW" class="shrink-0 text-muted-foreground">${esc(row.caption)}</span>
      <strong class="min-w-0 font-semibold">${esc(value)}</strong>
      ${markHtml(row, "b")}
      ${control(row)}
    </div>
  </span>
</li>`
}

/** C — ANSWER FIRST. The decision leads; the question is the caption underneath it. */
function rowC(row, state) {
  const value = state === "empty" ? row.empty : row.answered
  const dim = state === "empty" ? " text-muted-foreground/70 italic" : ""
  return `<li data-s173="NEW" data-row="${row.key}" data-state="${state}" class="flex items-start gap-2 text-[12.5px] text-foreground">
  <span aria-hidden="true" data-s173="NEW" class="mt-[3px] h-[7px] w-[7px] shrink-0 rounded-full border border-border"></span>
  <span class="min-w-0 flex-1">
    <div class="flex flex-wrap items-center gap-1.5">
      <strong class="min-w-0 text-[13px] font-semibold${dim}">${esc(value)}</strong>
      ${state === "empty" ? "" : markHtml(row, "c")}
      ${control(row)}
    </div>
    <div data-s173="NEW" class="mt-[1px] text-[11.5px] text-muted-foreground">${esc(row.ask)}</div>
  </span>
</li>`
}

const TREATMENTS = { a: rowA, b: rowB, c: rowC }

const CARD_FRAME =
  "w-full max-w-[720px] rounded-[14px] border border-border bg-card px-[18px] py-4 shadow-lg"

function card(treatment, state, opts = {}) {
  const fn = TREATMENTS[treatment]
  const rows = ROWS.map((r) => fn(r, opts.perRowState ? opts.perRowState[r.key] || state : state)).join("\n")
  const limit = opts.limit
    ? `<p data-s173="NEW" class="mt-3 text-[12.5px] leading-[1.5] text-muted-foreground">${esc(LIMIT_LINE)}</p>`
    : ""
  return `<section data-s173="NEW" data-testid="s173-card" data-treatment="${treatment}" class="${CARD_FRAME}">
  <div class="flex items-start gap-3">
    <h2 data-s173="NEW" class="min-w-0 flex-1 text-[13.5px] font-semibold text-foreground">${esc(opts.heading || "Here's what I decided for you — 5 things you can change")}</h2>
    <button type="button" data-s173="NEW" aria-label="Dismiss" class="inline-grid h-5 w-5 shrink-0 place-items-center rounded text-[11px] text-muted-foreground hover:bg-accent/40 hover:text-foreground focus:outline-none focus:ring-1 focus:ring-primary"><span aria-hidden="true">✕</span></button>
  </div>
  <ul data-s173="NEW" class="mt-3 flex flex-col gap-[9px]">
${rows}
  </ul>
  ${limit}
  <p data-s173="NEW" class="mt-3 text-[12.5px] leading-[1.5] text-muted-foreground">${esc(opts.close || RECEIPT_CLOSE)}</p>
</section>`
}

/** The realistic mixed state — what a real fresh generation actually looks like. Measured
 *  basis: SEED-163 says the requirement IS now proposed on every generation; the KB is set
 *  only if the author picked one pre-draft; a template is attached only on the template
 *  door; the name is always AI-chosen; the deliverable is derived. */
const MIXED = {
  kb: "answered",
  template: "empty",
  requirement: "answered",
  name: "answered",
  deliverable: "answered",
}

const cardsA = { answered: card("a", "answered", { limit: true }), empty: card("a", "empty", { limit: true }), mixed: card("a", "answered", { limit: true, perRowState: MIXED }) }
const cardsB = { answered: card("b", "answered", { limit: true }), empty: card("b", "empty", { limit: true }), mixed: card("b", "answered", { limit: true, perRowState: MIXED }) }
const cardsC = { answered: card("c", "answered", { limit: true }), empty: card("c", "empty", { limit: true }), mixed: card("c", "answered", { limit: true, perRowState: MIXED }) }

assert(cardsA.answered !== cardsB.answered, "A and B differ in the answered state")
assert(cardsB.answered !== cardsC.answered, "B and C differ in the answered state")
assert(cardsA.answered !== cardsC.answered, "A and C differ in the answered state")
/* B's definition is that an EMPTY row keeps A's full question. Asserted per ROW, not per
   card: the two cards necessarily differ in their `data-treatment` attribute, so a
   whole-card comparison would fail for a reason that has nothing to do with the claim. */
assert(
  ROWS.every((r) => rowB(r, "empty") === rowA(r, "empty")),
  "B FALLS BACK to A's row in the empty state — that is B's definition, not an oversight",
)
assert(
  ROWS.some((r) => rowB(r, "answered") !== rowA(r, "answered")),
  "…and B genuinely differs from A once a row IS answered",
)
assert(cardsA.answered !== cardsA.empty, "the answered and empty states differ")
assert(
  cardsA.mixed.includes(esc(KB_INVITATION)) === false,
  "the mixed state has the KB answered, so the shipped invitation is absent there",
)
assert(
  cardsA.empty.includes(esc(KB_INVITATION)) && cardsA.empty.includes(esc(REQUIREMENT_INVITATION)),
  "the empty state renders BOTH shipped invitations",
)
assert(
  cardsA.answered.includes(AI_MARK_HTML),
  "row 3 wears the SHIPPED mark markup, not a redraw",
)
assert(
  cardsB.answered.includes(AI_MARK_HTML),
  "B keeps the provenance mark in the quiet state — quiet means 'not empty', never 'resolved'",
)

const NEW_COUNT = (cardsA.answered.match(/data-s173="NEW"/g) || []).length

/* ─────────────────────── the page ─────────────────────── */

function tabButton(id, label) {
  return `<button class="s173-tab" data-tab="${id}">${label}</button>`
}

function trio(cards, label) {
  return `
  <h3 class="s173-h3">The realistic mixed state — what a fresh generation actually looks like</h3>
  <p class="s173-note">KB set pre-draft, requirement proposed by the model (<code>SEED-163</code> measured this now happens on
  every generation), name AI-chosen, deliverable derived, <strong>no template</strong> — the common case on the describe door.
  <strong>Judge ${label} here first;</strong> the all-answered and all-empty boards below are diagnostics, not screens a user meets.</p>
  <div class="s173-stage">${cards.mixed}</div>

  <h3 class="s173-h3">Every row answered</h3>
  <div class="s173-stage">${cards.answered}</div>

  <h3 class="s173-h3">Every row empty</h3>
  <p class="s173-note">Two of these five sentences are the product's own (<code>UNBOUND_KB_INVITATION</code>,
  <code>REQUIREMENT_INVITATION</code>); three are proposals. The shipped pair set the register the other three have to match.</p>
  <div class="s173-stage">${cards.empty}</div>`
}

const rowTable = ROWS.map(
  (r) => `<tr>
  <td><code>${esc(r.key)}</code></td>
  <td class="s173-rule">${esc(r.ask)}</td>
  <td>${r.kind === "stored" ? "stored field" : r.kind === "derived" ? "<strong>no field</strong>" : r.kind === "no-control" ? "stored, no control" : "stored, elsewhere"}</td>
  <td>${r.emptyIsShipped ? '<span class="s173-status s173-status-shipped">SHIPPED</span>' : '<span class="s173-status s173-status-new">PROPOSED</span>'}</td>
  <td class="s173-where">${esc(r.note)}</td>
</tr>`,
).join("\n")

const body = `
<div class="s173-root">
  <div class="s173-head">
    <div class="s173-kicker">Sketch 173 · Phase 197 Guided Authoring · G-2 gate · AUTH-02 · D-07 / D-09 / D-16</div>
    <h1>One row, five ways</h1>
    <p class="s173-lede">Sketch 172 asks <em>where</em> the five decisions live. This one asks what <strong>one row</strong> looks
    like — and it draws all five rows in every state each can actually be in, because the five are not alike: two have shipped
    empty-state sentences, one has no control anywhere, and <strong>one has no field at all</strong>.</p>
  </div>

  <div class="s173-mech">
    <strong>⚠ Read this page as a DRAWING, unlike 172.</strong>
    <p>172's central surfaces ship, so it renders them. Here the decisions card exists in no component, so almost every node is a
    proposal — <strong>${NEW_COUNT} of them</strong>, each tagged <code>data-s173="NEW"</code>. What keeps it honest is that every
    sentence the product already owns is <strong>parsed out of sketch 172's dump of the real rendered
    <code>WorkflowBuilderPage</code></strong> rather than re-typed, and row 3 wears the <strong>shipped</strong>
    <code>${esc(AI_MARK)}</code> mark markup lifted whole. This build asserts that ratio rather than asking you to trust it.</p>
    <p class="s173-caveat"><strong>D-16 is the floor on every string here.</strong> The mark means <em>a model wrote this</em>. It
    never means <em>this is good</em> or <em>this is durable</em> — measured: <code>gpt-5.5</code> named one-run parameters in
    <strong>5 of 5</strong> QBR requirements and all 20 were still correctly stamped, because the stamp's question is the anti-echo
    one. The shipped explanation obeys this and is asserted to: <em>“${esc(AI_MARK_TITLE)}”</em></p>
  </div>

  <div class="s173-tabs">
    ${tabButton("a", "A · Ask first")}
    ${tabButton("b", "B · Quiet when answered")}
    ${tabButton("c", "C · Answer first")}
    ${tabButton("rows", "⚠ The five are not alike")}
    ${tabButton("limit", "The D-03 limit line")}
  </div>

  <section class="s173-panel" data-panel="a">
    <div class="s173-axis"><span class="s173-badge s173-badge-baseline">A · ASK FIRST</span>
      <p>The question leads on every row, in every state — the same words whether the answer is already right or not. Closest to
      <code>SeedReceipt</code>'s own grammar (a lead sentence, then the facts) and the least clever thing that could work.</p></div>
    ${trio(cardsA, "A")}
  </section>

  <section class="s173-panel" data-panel="b" hidden>
    <div class="s173-axis"><span class="s173-badge s173-badge-b">B · QUIET WHEN ANSWERED</span>
      <p>A row with a value collapses to a stated fact; a row without one keeps the full question. The card gets much shorter —
      which is the one thing that directly buys back what sketch 172 measured stacking to cost.</p></div>
    <p class="s173-note">⚠ <strong>The line B must not cross, and it is D-07's own reasoning.</strong> “Quiet when answered” is
    legitimate only if <strong>answered means the field is non-empty</strong> — a server-side fact. It may never mean
    <em>the AI got this right</em>: D-07 rejected a needs-attention row set precisely because <strong>no such predicate exists</strong>.
    That is why the <code>${esc(AI_MARK)}</code> mark <strong>survives into the quiet state</strong> here rather than disappearing
    like a resolved warning — asserted in <code>build.cjs</code>, because it is the exact place this variant would rot.</p>
    ${trio(cardsB, "B")}
  </section>

  <section class="s173-panel" data-panel="c" hidden>
    <div class="s173-axis"><span class="s173-badge s173-badge-c">C · ANSWER FIRST</span>
      <p>The decision leads at 13 px; the question becomes an 11.5 px caption under it. Reads as <em>“here is what I chose”</em>
      rather than <em>“here is what I am asking you”</em> — closer to a receipt, further from an interview.</p></div>
    <p class="s173-note">⚠ <strong>Its risk is SC#1.</strong> The ROADMAP criterion is that the author is <em>“asked the decisions
    that change the result, rather than receiving a finished draft in one shot.”</em> A card whose questions are captions may read
    as a better receipt rather than as being asked anything. Judge that against the mixed board, not the all-empty one.</p>
    ${trio(cardsC, "C")}
  </section>

  <section class="s173-panel" data-panel="rows" hidden>
    <div class="s173-axis"><span class="s173-badge s173-badge-p">EVIDENCE</span>
      <p>D-07 says five fixed rows, always all of them, always the same order. It does not say the five are alike — and they are
      not. This table is why a single row treatment has to survive five quite different shapes.</p></div>
    <table class="s173-table">
      <thead><tr><th>row</th><th>the ask (proposed)</th><th>what backs it</th><th>empty state</th><th>the catch</th></tr></thead>
      <tbody>${rowTable}</tbody>
    </table>
    <h3 class="s173-h3">⚠ Row 5 is the one that breaks a uniform treatment</h3>
    <p class="s173-note">There is <strong>no <code>deliverable</code> field.</strong> <code>soulDeliverable()</code> derives the
    answer from whether a terminal <code>llm_emit</code> step exists — so “answering” row 5 means <em>editing a step</em>, which
    D-03's write path (<code>builderStore</code>, one <code>set()</code>) does not express as a row edit. All three variants
    therefore give row 5 a <strong>stated fact instead of a control</strong>. If a build wants row 5 answerable, that is a
    different and larger change than the other four, and it should be priced before planning rather than discovered inside it.</p>
    <h3 class="s173-h3">⚠ Row 4 adds the FIRST display, not a second control</h3>
    <p class="s173-note">Sketch 172 measured it: the drafted header renders the workflow's <strong>slug</strong>, so the
    <em>name</em> appears nowhere on the screen. D-15 keeps the slug untouched — so after this phase the header would still show
    <code>vendor-risk-review</code> while this row edits <code>Vendor-risk review</code>. Two strings, one of them invisible.
    Worth deciding deliberately rather than inheriting.</p>
  </section>

  <section class="s173-panel" data-panel="limit" hidden>
    <div class="s173-axis"><span class="s173-badge s173-badge-p">CLAUDE'S DISCRETION</span>
      <p><code>197-CONTEXT.md</code> leaves open <em>“whether the surface states D-03's limit — and if so, in one line or per
      affected row.”</em> Both are drawn here so the choice is made by looking.</p></div>
    <p class="s173-note">The limit is real: answering a row writes into the draft, but <strong>the rest of the draft was built
    around the old answer</strong>. Changing the KB scope does not re-shape phases written for the old scope. D-03 locks that the
    surface must not silently discard the author's own edits; it does not lock whether the surface SAYS this.</p>

    <h3 class="s173-h3">One line, at the foot of the card</h3>
    <p class="s173-note">Cheap, honest, easy to miss — and it sits directly above the “nothing is committed” close, which is the
    same register. This is what every board on the other three tabs shows.</p>
    <div class="s173-stage">${card("a", "answered", { limit: true })}</div>

    <h3 class="s173-h3">Nowhere at all</h3>
    <p class="s173-note">The shortest card. Defensible on the grounds that the limit only bites on rows 1 and 2 (scope and
    template shape the retrieval steps), and that a caveat nobody can act on is noise. ⚠ But <code>SEED-157</code>'s whole finding
    was a draft built <em>blind to the template</em> — so a silent version of exactly that is the failure this phase exists to
    stop repeating.</p>
    <div class="s173-stage">${card("a", "answered", { limit: false })}</div>
  </section>
</div>

<script>
(function(){
  var tabs = document.querySelectorAll(".s173-tab");
  var panels = document.querySelectorAll(".s173-panel");
  function show(id){
    tabs.forEach(function(t){ t.classList.toggle("s173-tab-on", t.dataset.tab === id); });
    panels.forEach(function(p){ p.hidden = p.dataset.panel !== id; });
    measure();
  }
  tabs.forEach(function(t){ t.addEventListener("click", function(){ show(t.dataset.tab); }); });

  // Card height is the whole of B's argument, so it is measured rather than asserted.
  function measure(){
    var panel = document.querySelector(".s173-panel:not([hidden])");
    if(!panel) return;
    var note = panel.querySelector("[data-s173-h]");
    var cards = panel.querySelectorAll('[data-testid="s173-card"]');
    if(!cards.length) return;
    if(!note){
      note = document.createElement("p");
      note.className = "s173-note";
      note.setAttribute("data-s173-h", "");
      var axis = panel.querySelector(".s173-axis");
      if(axis && axis.nextSibling) panel.insertBefore(note, axis.nextSibling); else panel.appendChild(note);
    }
    var hs = [];
    cards.forEach(function(c){ hs.push(Math.round(c.getBoundingClientRect().height)); });
    // The label has to come from the panel, not from a constant: the three variant tabs
    // show mixed/answered/empty, while the limit tab shows with-line/without-line. A fixed
    // caption was wrong on that tab, which is precisely the kind of quietly-mislabelled
    // number this whole sketch set exists to avoid publishing.
    var label = panel.dataset.panel === "limit"
      ? "Measured card heights on this tab (one line at the foot · no line): "
      : "Measured card heights on this tab (mixed · all answered · all empty): ";
    note.textContent = label + hs.join(" px · ") +
      " px. Sketch 172 measured 662 px of chrome above the graph with a 370 px card — every px saved here is a px the canvas gets back.";
  }
  show("a");
})();
</script>
`

if (failures.length) {
  console.error(`\n✗ ${failures.length} of ${checks} assertions FAILED:\n`)
  for (const f of failures) console.error(`   · ${f}`)
  process.exit(1)
}

fs.writeFileSync(path.join(HERE, "body.generated.html"), body, "utf8")

const contract = `# Sketch 173 — BUILD CONTRACT (generated)

Generated by \`build.cjs\`. Do not hand-edit.

- assertions run: **${checks}**, failing: **0**
- proposed (\`NEW\`) nodes in one card: **${NEW_COUNT}**
- ⚠ this sketch is a **DRAWING** — the decisions card exists in no component. Unlike 172, its
  central surface is not the build.

## Read from the real DOM (sketch 172's dump), never re-typed

| constant | value |
|---|---|
| \`UNBOUND_KB_INVITATION\` | ${KB_INVITATION} |
| \`REQUIREMENT_INVITATION\` | ${REQUIREMENT_INVITATION} |
| \`REQUIREMENT_AI_MARK_LABEL\` | ${AI_MARK} |
| \`REQUIREMENT_AI_MARK_EXPLANATION\` | ${AI_MARK_TITLE} |
| \`SEED_RECEIPT_NOTHING_COMMITTED\` | ${RECEIPT_CLOSE} |
| the receipt's heading | ${RECEIPT_HEADING} |
| the requirement's live value | ${REQUIREMENT_VALUE} |

Row 3 renders the **shipped** \`AI-proposed\` mark markup lifted whole from the dump — the one
node on the page that is not a proposal.

## The five rows are not alike

| row | backed by | empty state |
|---|---|---|
${ROWS.map((r) => `| \`${r.key}\` | ${r.kind === "derived" ? "**no field**" : r.kind === "no-control" ? "stored, no control" : r.kind === "elsewhere" ? "stored, control elsewhere" : "stored field"} | ${r.emptyIsShipped ? "**SHIPPED sentence**" : "proposed"} |`).join("\n")}
`

fs.writeFileSync(path.join(HERE, "BUILD-CONTRACT.generated.md"), contract, "utf8")

console.log(`✓ ${checks} assertions, 0 failing`)
console.log(`  body.generated.html          ${(body.length / 1024).toFixed(1)} KB`)
console.log(`  proposed NEW nodes per card: ${NEW_COUNT}`)
