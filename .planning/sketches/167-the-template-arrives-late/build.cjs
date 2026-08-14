#!/usr/bin/env node
/**
 * SKETCH 167 BUILDER — assembles body.generated.html + BUILD-CONTRACT.generated.md.
 *
 * ── THE QUESTION ─────────────────────────────────────────────────────────────
 * SC#3: *"A template attached to an ALREADY-DRAFTED workflow surfaces any mismatch
 * between that draft and the template's fields, rather than binding silently."*
 *
 * Draft-then-attach is the path Phase 193 SHIPPED. Without SC#3 it inherits the very
 * defect 193.1 exists to remove — the steps were designed before anyone knew what the
 * document asks for, and attaching the document changes nothing about them.
 *
 * ── ⚠ THE HONESTY PROBLEM AT THE CENTRE OF THIS SKETCH ───────────────────────
 * MEASURED, not assumed: **nothing in the app can compute a true coverage verdict at
 * attach time.** `check_coverage` (`template_render_service.py:416-460`) is the real
 * computation, and it runs over an ACTUAL emitted field map — at RUN time, after the
 * model has produced values. At attach time there are no values.
 *
 * What CAN be compared is names: the template's placeholder keys against what the draft
 * declares — `phases[].config.output_keys`, phase slugs, and `input_keys` (the set
 * `reachability.py:85` already reasons over for its INPUT_UNSATISFIED lint).
 *
 * ⇒ A name comparison is a HEURISTIC, never a guarantee, and this sketch is built so
 *   that fact is visible rather than buried. The fixture below is chosen to make the
 *   heuristic visibly cry wolf: `project_name` and `reporting_period` are legitimately
 *   supplied as RUN INPUTS, not produced by any step, so a naive "nothing produces this"
 *   check flags two fields that are perfectly fine.
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

assert(
  "the shipped attach section rendered with its fields list",
  'data-testid="template-fields" in dumps.afterAttach',
  dom.afterAttach.includes('data-testid="template-fields"'),
  dom.afterAttach.includes('data-testid="template-fields"') ? 1 : 0,
)
assert(
  "the before-attach state renders the shipped 'nothing attached' note",
  'data-testid="template-none" in dumps.beforeAttach',
  dom.beforeAttach.includes('data-testid="template-none"'),
  dom.beforeAttach.includes('data-testid="template-none"') ? 1 : 0,
)

/** The eight keys, PARSED from the real dump — never re-typed. */
const FIELDS = [...dom.afterAttach.matchAll(/<li class="break-all">([^<]+)<\/li>/g)].map((m) => m[1])
assert("the eight keys were PARSED, not re-typed", FIELDS.join(", "), FIELDS.length === 8, FIELDS.length)

/**
 * THE DRAFT THIS TEMPLATE LANDED ON. A realistic three-phase draft of the kind
 * `/workflows/generate` actually returns for "write the weekly client status report" —
 * written, as every draft is today, without ever seeing the document.
 *
 * ⚠ `input_keys` is deliberately populated. It is what makes the name check's false
 *   alarm visible instead of theoretical.
 */
const DRAFT = {
  name: "Weekly client status report",
  input_keys: ["project_name", "reporting_period"],
  phases: [
    {
      slug: "gather_updates",
      type: "retrieval",
      name: "Gather last week's updates",
      output_keys: ["project_updates"],
    },
    {
      slug: "summarise",
      type: "llm_analysis",
      name: "Summarise the week",
      output_keys: ["summary", "accomplishments"],
    },
    { slug: "emit", type: "llm_emit", name: "Write the report", output_keys: [] },
  ],
}

/** Everything the draft NAMES: phase slugs + declared output_keys + run input_keys. */
const NAMED = new Set([
  ...DRAFT.phases.map((p) => p.slug),
  ...DRAFT.phases.flatMap((p) => p.output_keys),
  ...DRAFT.input_keys,
])

/** Classify each template field against the draft. THREE buckets, never two. */
const CLASSIFIED = FIELDS.map((f) => {
  if (DRAFT.phases.some((p) => p.output_keys.includes(f))) {
    const p = DRAFT.phases.find((q) => q.output_keys.includes(f))
    return { field: f, bucket: "produced", by: p.name, note: `declared by “${p.name}”` }
  }
  if (DRAFT.input_keys.includes(f)) {
    return {
      field: f,
      bucket: "run-input",
      by: "supplied at run time",
      note: "⚠ a RUN INPUT — nothing produces it and nothing needs to. A name check that calls this a gap is crying wolf.",
    }
  }
  return {
    field: f,
    bucket: "unnamed",
    by: null,
    note: "nothing in the draft names this — it may still be covered by a step whose name differs",
  }
})

const COUNTS = {
  produced: CLASSIFIED.filter((c) => c.bucket === "produced").length,
  runInput: CLASSIFIED.filter((c) => c.bucket === "run-input").length,
  unnamed: CLASSIFIED.filter((c) => c.bucket === "unnamed").length,
}
assert(
  "the fixture actually produces a three-bucket split (a two-bucket one could not show the false alarm)",
  `produced=${COUNTS.produced} run-input=${COUNTS.runInput} unnamed=${COUNTS.unnamed}`,
  COUNTS.produced > 0 && COUNTS.runInput > 0 && COUNTS.unnamed > 0,
  COUNTS.produced + COUNTS.runInput + COUNTS.unnamed,
)
assert(
  "every parsed field was classified exactly once",
  "no field lost or double-counted",
  COUNTS.produced + COUNTS.runInput + COUNTS.unnamed === FIELDS.length,
  COUNTS.produced + COUNTS.runInput + COUNTS.unnamed,
)

/* ══════════════════════════════════════════════════════════════════════════════
   THE PROPOSED COPY
   ══════════════════════════════════════════════════════════════════════════════ */

const COPY = {
  cHeading: "This draft was written before the template arrived",
  cLead: `Nothing in the steps names ${COUNTS.unnamed} of the ${FIELDS.length} fields.`,
  cDisclaim:
    "This is a name check, not a coverage check — a step may already gather a field under a different name. We cannot know until the workflow runs.",
  cRunInputNote: `${COUNTS.runInput} more are supplied when the workflow runs, so they need no step.`,
  cAction: "Ask the AI to reconcile",
  bHeading: "This draft was written before the template arrived",
  bLead: "Let the AI read both and propose what to change.",
  bAction: "Reconcile the steps with this template",
  bBusy: "Reading the draft and the template…",
  bResultLead: "Proposed changes — nothing is applied until you accept.",
  bAccept: "Apply these changes",
  bReject: "Keep the draft as it is",
  bNoChange: "The AI read both and proposes no changes.",
}

/** The reconcile proposal variant B shows. A PROPOSAL of a proposal — no component
 *  computes this today, and it is marked NEW throughout. */
const PROPOSED_CHANGES = [
  {
    verb: "add",
    what: "a step that gathers the week's risks and blockers",
    why: "the template asks for risks_blockers and no step names it",
  },
  {
    verb: "add",
    what: "a step that reads the milestone tracker",
    why: "the template asks for milestones and planned_next",
  },
  {
    verb: "change",
    what: "“Summarise the week” to also produce an overall RAG status",
    why: "the template asks for overall_rag_status",
  },
  {
    verb: "keep",
    what: "project_name and reporting_period as run inputs",
    why: "the workflow already asks for both when it starts — no step needed",
  },
]

const NEW_ROWS = [
  {
    id: "reconcile.heading",
    status: "NEW",
    where: "rail — above the attach section, both B and C",
    text: COPY.cHeading,
    rule: "States the ORDER OF EVENTS, which is the whole fact. Not “mismatch found” — the app cannot honestly claim a mismatch, only that the steps predate the document.",
  },
  {
    id: "reconcile.disclaim",
    status: "NEW",
    where: "rail — variant C, directly under the field list",
    text: COPY.cDisclaim,
    rule: "⚠ THE LOAD-BEARING SENTENCE OF VARIANT C. `check_coverage` runs at RUN time over an actual field map; at attach time there are no values, so a name comparison is all that exists. Without this sentence C asserts a coverage verdict it cannot compute — the exact class of dishonesty SEED-159 is about.",
  },
  {
    id: "reconcile.runInputNote",
    status: "NEW",
    where: "rail — variant C, beside the run-input bucket",
    text: COPY.cRunInputNote,
    rule: `⚠ THE FALSE-ALARM GUARD. In this fixture ${COUNTS.runInput} of the ${FIELDS.length} fields are run inputs — nothing produces them and nothing should. A two-bucket check would list them as gaps and train the author to ignore the whole panel. Three buckets, never two.`,
  },
  {
    id: "reconcile.action",
    status: "NEW",
    where: "rail — the button, both variants",
    text: COPY.bAction,
    rule: "Names what happens, not what is wrong. ⚠ It is an EXPLICIT act in both variants — nothing re-writes a draft the author has been editing without being asked (the D-118 never-silently-moves precedent).",
  },
  {
    id: "reconcile.resultLead",
    status: "NEW",
    where: "rail — variant B, above the proposed changes",
    text: COPY.bResultLead,
    rule: "⚠ 'nothing is applied until you accept' is not reassurance copy — it is the contract. A reconcile that edited the canvas directly would be a second writer on the definition JSONB, which is the discipline Phase 186's If-Match token exists to protect.",
  },
  {
    id: "reconcile.noChange",
    status: "NEW",
    where: "rail — variant B, the empty result",
    text: COPY.bNoChange,
    rule: "The honest empty state. It must read as an ANSWER, not as an absence — 'no changes proposed' is a result the author paid a model call for.",
  },
]

/* ══════════════════════════════════════════════════════════════════════════════
   THE BLOCKS
   ══════════════════════════════════════════════════════════════════════════════ */

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const BUCKET_MARK = { produced: "✓", "run-input": "◇", unnamed: "○" }
const BUCKET_CLASS = {
  produced: "text-[hsl(var(--success))]",
  "run-input": "text-muted-foreground",
  unnamed: "text-[hsl(38_92%_70%)]",
}

/** Variant C — the name check, with its disclaimer and its three buckets. */
function blockC() {
  const rows = CLASSIFIED.map(
    (c) =>
      `<li class="flex items-start gap-1.5 text-[10.5px] leading-snug"><span aria-hidden="true" class="${
        BUCKET_CLASS[c.bucket]
      }">${BUCKET_MARK[c.bucket]}</span><span class="min-w-0 flex-1"><span class="font-mono break-all text-foreground">${esc(
        c.field,
      )}</span>${
        c.by ? `<span class="text-muted-foreground"> — ${esc(c.by)}</span>` : ""
      }</span></li>`,
  ).join("")
  return `<section data-s167="reconcile-c" class="mt-3 rounded border border-[hsl(38_92%_60%/0.34)] bg-[hsl(38_92%_60%/0.07)] px-2.5 py-2">
<h3 class="text-[11px] font-medium text-foreground">${esc(COPY.cHeading)}</h3>
<p class="mt-1.5 text-[10.5px] leading-snug text-muted-foreground">${esc(COPY.cLead)}</p>
<ul class="mt-2 flex flex-col gap-1">${rows}</ul>
<p class="mt-2 text-[10.5px] leading-snug text-muted-foreground">${esc(COPY.cRunInputNote)}</p>
<p data-s167="disclaim" class="mt-2 border-t border-border/60 pt-1.5 text-[10.5px] leading-snug text-muted-foreground">${esc(
    COPY.cDisclaim,
  )}</p>
<button type="button" class="mt-2 w-full rounded border border-border bg-card px-2 py-1.5 text-[11px] font-medium text-foreground hover:bg-accent/40">${esc(
    COPY.cAction,
  )}</button>
</section>`
}

/** Variant B — ask the model, show a diff, apply nothing until accepted. */
function blockBIdle() {
  return `<section data-s167="reconcile-b-idle" class="mt-3 rounded border border-[hsl(38_92%_60%/0.34)] bg-[hsl(38_92%_60%/0.07)] px-2.5 py-2">
<h3 class="text-[11px] font-medium text-foreground">${esc(COPY.bHeading)}</h3>
<p class="mt-1.5 text-[10.5px] leading-snug text-muted-foreground">${esc(COPY.bLead)}</p>
<button type="button" class="mt-2 w-full rounded bg-primary px-2 py-1.5 text-[11px] font-medium text-primary-foreground">${esc(
    COPY.bAction,
  )}</button>
</section>`
}

function blockBResult() {
  const rows = PROPOSED_CHANGES.map((c) => {
    const tone =
      c.verb === "add"
        ? "text-[hsl(var(--success))]"
        : c.verb === "change"
          ? "text-[hsl(var(--primary))]"
          : "text-muted-foreground"
    return `<li class="text-[10.5px] leading-snug"><span class="font-mono font-bold uppercase ${tone}">${esc(
      c.verb,
    )}</span> <span class="text-foreground">${esc(c.what)}</span><br><span class="text-muted-foreground">${esc(
      c.why,
    )}</span></li>`
  }).join("")
  return `<section data-s167="reconcile-b-result" class="mt-3 rounded border border-[hsl(38_92%_60%/0.34)] bg-[hsl(38_92%_60%/0.07)] px-2.5 py-2">
<h3 class="text-[11px] font-medium text-foreground">${esc(COPY.bHeading)}</h3>
<p data-s167="result-lead" class="mt-1.5 text-[10.5px] leading-snug text-muted-foreground">${esc(
    COPY.bResultLead,
  )}</p>
<ul class="mt-2 flex flex-col gap-2">${rows}</ul>
<div class="mt-2.5 flex gap-1.5"><button type="button" class="flex-1 rounded bg-primary px-2 py-1.5 text-[11px] font-medium text-primary-foreground">${esc(
    COPY.bAccept,
  )}</button><button type="button" class="rounded border border-border bg-card px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground">${esc(
    COPY.bReject,
  )}</button></div>
</section>`
}

const RAIL = (inner) =>
  `<div class="s167-rail"><div class="s167-rail-head">step · Write the report <span>llm_emit</span></div>${inner}</div>`

const STAGES = {
  a: RAIL(dom.afterAttach),
  bIdle: RAIL(dom.afterAttach + blockBIdle()),
  bResult: RAIL(dom.afterAttach + blockBResult()),
  c: RAIL(dom.afterAttach + blockC()),
  before: RAIL(dom.beforeAttach),
}

for (const [k, v] of Object.entries(STAGES)) {
  if (k === "a" || k === "before") continue
  assert(
    `stage '${k}' actually adds a reconcile block`,
    "a variant identical to A would be an invisible failure",
    v.length > STAGES.a.length,
    v.length - STAGES.a.length,
  )
}

/* ══════════════════════════════════════════════════════════════════════════════
   THE PAGE
   ══════════════════════════════════════════════════════════════════════════════ */

const TABS = [
  { id: "a", label: "A · Bind silently (today)", badge: "baseline" },
  { id: "b", label: "B · Ask the AI to reconcile", badge: "b" },
  { id: "c", label: "C · Name check, no claim", badge: "c" },
  { id: "why", label: "⚠ Why a verdict is impossible", badge: "p" },
  { id: "contract", label: "The contract", badge: "p" },
]

function draftTable() {
  return `<table class="s167-table"><thead><tr><th>phase</th><th>type</th><th>declares</th></tr></thead><tbody>${DRAFT.phases
    .map(
      (p) =>
        `<tr><td>${esc(p.name)}<div class="s167-where"><code>${esc(p.slug)}</code></div></td><td><code>${esc(
          p.type,
        )}</code></td><td>${
          p.output_keys.length
            ? p.output_keys.map((k) => `<code>${esc(k)}</code>`).join(" ")
            : '<span class="s167-where">—</span>'
        }</td></tr>`,
    )
    .join("")}<tr><td colspan="2"><strong>run inputs</strong> — asked for when the workflow starts</td><td>${DRAFT.input_keys
    .map((k) => `<code>${esc(k)}</code>`)
    .join(" ")}</td></tr></tbody></table>`
}

function classTable() {
  return `<table class="s167-table"><thead><tr><th>the template asks for</th><th>bucket</th><th>what that means</th></tr></thead><tbody>${CLASSIFIED.map(
    (c) =>
      `<tr><td><code>${esc(c.field)}</code></td><td><span class="s167-status s167-status-${c.bucket.replace(
        "-",
        "",
      )}">${BUCKET_MARK[c.bucket]} ${esc(c.bucket)}</span></td><td class="s167-rule">${esc(c.note)}</td></tr>`,
  ).join("")}</tbody></table>`
}

function contractTable() {
  return `<table class="s167-table"><thead><tr><th>id</th><th></th><th>Where</th><th>Text</th><th>Rule</th></tr></thead><tbody>${NEW_ROWS.map(
    (r) =>
      `<tr><td><code>${esc(r.id)}</code></td><td><span class="s167-status s167-status-new">${
        r.status
      }</span></td><td class="s167-where">${esc(r.where)}</td><td>${esc(r.text)}</td><td class="s167-rule">${esc(
        r.rule,
      )}</td></tr>`,
  ).join("")}</tbody></table>`
}

function auditTable() {
  return `<table class="s167-table"><thead><tr><th>#</th><th>Asserted</th><th>Detail</th><th>Found</th><th></th></tr></thead><tbody>${audit
    .map(
      (a, i) =>
        `<tr><td>${i + 1}</td><td>${esc(a.label)}</td><td class="s167-where"><code>${esc(
          String(a.detail),
        )}</code></td><td>${a.found}</td><td>${
          a.ok
            ? '<span class="s167-status s167-status-shipped">ok</span>'
            : '<span class="s167-status s167-status-unnamed">FAIL</span>'
        }</td></tr>`,
    )
    .join("")}</tbody></table>`
}

const body = `
<div class="s167-root">
  <header class="s167-head">
    <div class="s167-kicker">Sketch 167 · Phase 193.1 · AUTH-03 · SC#3</div>
    <h1>The template arrives late</h1>
    <p class="s167-lede">The draft already exists. The document turns up afterwards and asks for eight things nobody knew about when the steps were written. What does the app say — and what is it actually entitled to claim?</p>
    <div class="s167-mech">
      <strong>Draft-then-attach is the path Phase 193 shipped.</strong>
      <p>Without SC#3 it inherits the exact defect 193.1 exists to remove: the steps were designed before anyone knew what the document asks for, and attaching the document changes nothing about them. Sketches 165 and 166 fix the <em>new</em> workflow. This one is the safety net for every workflow that already exists.</p>
      <p><strong>⚠ Measured, and it constrains every variant below: nothing in the app can compute a coverage verdict at attach time.</strong> <code>check_coverage</code> is the real computation and it runs at <em>run</em> time over an actual emitted field map. At attach time there are no values. All that exists is a comparison of <em>names</em> — and a name comparison is a heuristic, never a guarantee.</p>
      <p class="s167-caveat"><strong>The section in every stage is the real <code>TemplateAttachSection</code>, rendered.</strong> The reconcile blocks below it are proposals — no component computes them today, and every string is marked <code>NEW</code>. <strong>The enclosing <code>PhaseFormPanel</code> is NOT rendered</strong> (1095 lines, large prop surface — drawing it would put a second full app surface on a page about one section inside it), so this sketch makes <strong>no layout claim about the panel</strong>. Only the 320&nbsp;px rail width is borrowed. Same limit sketch&nbsp;164 declared for its govern dump.</p>
    </div>
  </header>

  <nav class="s167-tabs">${TABS.map(
    (t) =>
      `<button class="s167-tab${t.id === "a" ? " s167-tab-on" : ""}" data-tab="${t.id}">${esc(t.label)}</button>`,
  ).join("")}</nav>

  <section class="s167-panel" data-panel="a">
    <div class="s167-axis"><span class="s167-badge s167-badge-baseline">A · today</span><div><strong>It binds, and says nothing.</strong><p>This is the shipped behaviour, rendered. The attach succeeds, the eight fields are listed honestly — and not one thing on this rail relates them to the three steps sitting on the canvas beside it. <strong>SC#3 is unmet by exactly this much.</strong></p></div></div>
    <h3 class="s167-h3">Before, and after</h3>
    <p class="s167-note">Left: the drafted workflow’s emit step with nothing attached. Right: the same step after the client’s template arrives. Everything that changed is a fact about the <em>document</em>; nothing changed about the <em>workflow</em>.</p>
    <div class="s167-pair">${STAGES.before}${STAGES.a}</div>
    <h3 class="s167-h3">The draft this template landed on</h3>
    <p class="s167-note">A realistic three-phase draft of the kind <code>/workflows/generate</code> returns for “write the weekly client status report” — written, as every draft is today, without ever seeing the document.</p>
    ${draftTable()}
  </section>

  <section class="s167-panel" data-panel="b" hidden>
    <div class="s167-axis"><span class="s167-badge s167-badge-b">B · ask the model</span><div><strong>Show the AI both, and let it propose the diff.</strong><p>It makes no name-matching claim, because it does not do name matching — it reads the draft and the placeholders and says what it would change. <strong>Nothing is applied until the author accepts</strong>, which is not reassurance copy but the contract: a reconcile that edited the canvas directly would be a second writer on the definition JSONB.<br><strong>The cost, stated:</strong> a second model call, a diff surface, an accept/reject path, and a new failure mode — a reconcile that proposes nonsense on a draft the author was happy with.</p></div></div>
    <h3 class="s167-h3">The offer, and the answer</h3>
    <p class="s167-note">Left: the moment after attaching. Right: what came back. Read the <code>KEEP</code> row last — it is the model declining to flag the two run inputs, which is the thing variant C has to be taught.</p>
    <div class="s167-pair">${STAGES.bIdle}${STAGES.bResult}</div>
  </section>

  <section class="s167-panel" data-panel="c" hidden>
    <div class="s167-axis"><span class="s167-badge s167-badge-c">C · name check</span><div><strong>Compare names, and say plainly that is all it is.</strong><p>Cheap and immediate — no model call, computed from the definition the page already holds. <strong>Three buckets, never two:</strong> produced by a step · supplied as a run input · named nowhere. And a disclaimer that is load-bearing rather than decorative, because without it the panel asserts a coverage verdict it cannot compute.<br><strong>The risk, made visible rather than described:</strong> in this fixture ${
      COUNTS.runInput
    } of the ${
      FIELDS.length
    } fields are run inputs. A two-bucket check would call them gaps, and an author who is told twice that a correct workflow is broken stops reading the panel.</p></div></div>
    <h3 class="s167-h3">The rail</h3>
    <div class="s167-pair">${STAGES.a}${STAGES.c}</div>
    <h3 class="s167-h3">Every field, classified</h3>
    <p class="s167-note">Derived in <code>build.cjs</code> from the parsed keys against the draft above — not hand-authored, so the page cannot show a classification the rule would not produce.</p>
    ${classTable()}
  </section>

  <section class="s167-panel" data-panel="why" hidden>
    <div class="s167-axis"><span class="s167-badge s167-badge-p">the constraint</span><div><strong>Why no variant here says “this template is covered”.</strong><p>Because nothing can. The distinction below is not pedantry — it is the difference between a panel an author trusts and one they learn to dismiss.</p></div></div>
    <table class="s167-table"><thead><tr><th></th><th>at ATTACH time</th><th>at RUN time</th></tr></thead><tbody>
      <tr><td><strong>what exists</strong></td><td>the template’s placeholder keys; the draft’s declared <code>output_keys</code>, phase slugs and <code>input_keys</code></td><td>an actual emitted field map with values and citations</td></tr>
      <tr><td><strong>what can be computed</strong></td><td>whether a field name appears anywhere in the draft — <strong>a heuristic</strong></td><td><code>check_coverage</code> — <code>covered_keys</code>, <code>covers_template</code>, <code>null_leaf_count</code>. <strong>A verdict.</strong></td></tr>
      <tr><td><strong>how it fails</strong></td><td>a step named <code>gather_status</code> legitimately feeding <code>overall_rag_status</code> reads as a gap; a run input reads as a gap</td><td>it does not — it is measuring what actually happened</td></tr>
      <tr><td><strong>so the copy may say</strong></td><td>“nothing in the steps <em>names</em> these”</td><td>“these fields came back empty”</td></tr>
    </tbody></table>
    <p class="s167-note"><strong>⚠ And the run-time half is already a known gap of its own.</strong> <code>SEED-159</code>: a field with no evidence renders as an <em>empty cell</em> — <code>build_context</code> blanks null leaves to <code>''</code> “for clean cells” while <code>check_coverage</code> computes exactly the information being thrown away. That is a different phase’s problem, named here so nobody solves it in this one by accident.</p>
    <h3 class="s167-h3">The open question this sketch does not settle</h3>
    <p class="s167-note"><strong>Where does the reconcile live?</strong> Every stage on this page puts it on the rail, beside the attach control, because that is where the template arrives. But the changes it proposes are about the <em>canvas</em> — adding and editing steps — and the rail is 320&nbsp;px wide. A four-row diff fits; a fifteen-row one does not. Whether a large reconcile escalates to the canvas, to a modal, or is capped with a “show all” is a decision for CONTEXT.md, and no variant here should be read as having answered it.</p>
  </section>

  <section class="s167-panel" data-panel="contract" hidden>
    <div class="s167-axis"><span class="s167-badge s167-badge-p">contract</span><div><strong>Every proposed string, with the rule that produced it.</strong><p>All <code>NEW</code> — nothing on this page’s reconcile blocks exists in any component today. The section they sit under is real and is inherited unchanged.</p></div></div>
    ${contractTable()}
    <h3 class="s167-h3">The audit</h3>
    ${auditTable()}
  </section>
</div>
<script>
(function(){
  var tabs=[].slice.call(document.querySelectorAll('.s167-tab'));
  var panels=[].slice.call(document.querySelectorAll('.s167-panel'));
  tabs.forEach(function(t){
    t.addEventListener('click',function(){
      tabs.forEach(function(x){x.classList.remove('s167-tab-on')});
      t.classList.add('s167-tab-on');
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
# Sketch 167 — build contract

## ⚠ The constraint every variant is built under

**Nothing in the app can compute a coverage verdict at attach time.** \`check_coverage\`
(\`template_render_service.py:416-460\`) runs at RUN time over an actual emitted field map.
At attach time there are no values — only names.

| | at ATTACH time | at RUN time |
|---|---|---|
| what exists | placeholder keys; the draft's \`output_keys\`, slugs, \`input_keys\` | an emitted field map with values + citations |
| what can be computed | whether a name appears — **a heuristic** | \`check_coverage\` — **a verdict** |
| copy may say | "nothing in the steps *names* these" | "these fields came back empty" |

## The fixture draft

| phase | type | declares |
|---|---|---|
${DRAFT.phases.map((p) => `| ${p.name} (\`${p.slug}\`) | \`${p.type}\` | ${p.output_keys.map((k) => `\`${k}\``).join(" ") || "—"} |`).join("\n")}
| **run inputs** | — | ${DRAFT.input_keys.map((k) => `\`${k}\``).join(" ")} |

## The classification — derived, not authored

produced **${COUNTS.produced}** · run-input **${COUNTS.runInput}** · unnamed **${COUNTS.unnamed}** (of ${FIELDS.length})

| field | bucket | means |
|---|---|---|
${CLASSIFIED.map((c) => `| \`${c.field}\` | ${c.bucket} | ${c.note.replace(/\|/g, "\\|")} |`).join("\n")}

⚠ **The run-input bucket is the false-alarm guard.** ${COUNTS.runInput} of ${FIELDS.length}
fields are supplied when the workflow starts; nothing produces them and nothing should. A
two-bucket check would list them as gaps and train the author to dismiss the panel.
**Three buckets, never two.**

## Proposed strings

| id | status | where | text | rule |
|---|---|---|---|---|
${NEW_ROWS.map(
  (r) => `| \`${r.id}\` | ${r.status} | ${r.where} | ${r.text.replace(/\|/g, "\\|")} | ${r.rule.replace(/\|/g, "\\|")} |`,
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

## Declared limits

- The enclosing \`PhaseFormPanel\` is **not rendered**. No layout claim is made about the
  panel — only the 320 px rail width is borrowed. (Same limit sketch 164 declared.)
- **Where a LARGE reconcile lives is unsettled.** The rail is 320 px; a four-row diff fits,
  a fifteen-row one does not. Escalation to canvas / modal / capped list is a CONTEXT.md
  decision, and no variant here answers it.
- \`SEED-159\` (a null field renders as a blank cell that lies) is the RUN-time half of this
  honesty problem. Named so nobody solves it here by accident.
`

fs.writeFileSync(path.join(HERE, "BUILD-CONTRACT.generated.md"), md, "utf8")

console.log(
  `body.generated.html + BUILD-CONTRACT.generated.md written — ${audit.length} assertions, ${
    audit.filter((a) => !a.ok).length
  } failing · buckets produced=${COUNTS.produced} run-input=${COUNTS.runInput} unnamed=${COUNTS.unnamed}`,
)
