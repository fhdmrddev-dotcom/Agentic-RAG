#!/usr/bin/env node
/**
 * SKETCH 164 BUILDER — assembles index.html + BUILD-CONTRACT.generated.md.
 *
 * ── THE ANTI-DRIFT MECHANISM, ONE STEP STRONGER THAN 163 ─────────────────────
 * Sketch 163 emitted its contract FROM THE RUNNING SKETCH. That leaves one hole,
 * and 192.1's UAT row U8 fell straight through it: the sketch drew a bordered
 * counter pill the shipped card STRUCTURALLY CANNOT render, and no amount of
 * generated contract could catch it, because the sketch was still the source.
 *
 * 164 inverts the direction. `dom.generated.json` is the **real rendered DOM** of
 * the real `WorkflowDoorSwitch` and the real `library/RunModal`, captured under
 * jsdom by `emit.test.tsx.src`. Variant A is that DOM byte-for-byte. Variants B
 * and C are the SAME DOM with nothing changed but the text nodes in the COPY
 * table below.
 *
 * ⇒ Layout drift between sketch and build is IMPOSSIBLE for the doors panel,
 *   because the sketch's layout IS the build's layout. Only words can differ,
 *   and every word that differs is named in the contract with its exact
 *   shipped-string counterpart.
 *
 * ── WHAT THIS STILL CANNOT PROVE, SAID PLAINLY ───────────────────────────────
 * 1. The TEMPLATE panel (AUTH-03) is a PROPOSAL, not a generated dump — it adds
 *    nodes that do not exist in any component yet, so there was nothing to
 *    render. It is labelled as a proposal on the page and its contract entries
 *    are marked NEW rather than SHIPPED. Do not read it as drift-proof.
 * 2. The HEADER-STRIP peer problem (SEED-147 suspect #2) is STRUCTURAL, not
 *    copy. This sketch can reword `‹ both doors` so it reads as an escape rather
 *    than a noun, but it cannot restack the strip. That is recorded as an open
 *    decision for CONTEXT.md, not silently "fixed" by wording.
 * 3. Hover/focus states and pixel spacing. Those stay a human comparison at UAT.
 */
const fs = require("node:fs")
const path = require("node:path")

const HERE = __dirname
const dom = JSON.parse(fs.readFileSync(path.join(HERE, "dom.generated.json"), "utf8"))

/**
 * THE COPY TABLE — the single declaration of every string this sketch varies.
 *
 * `shipped` is the exact text as it appears in the rendered DOM today (HTML
 * entities are applied at substitution time, so `&` is written plainly here).
 * A variant that omits a key inherits the shipped string unchanged.
 *
 * `where` names the JSX site so the build ports the string rather than hunting
 * for it. Line numbers are deliberately NOT recorded — this project has
 * corrected stale line numbers in five of six waves of Phase 192 alone; the
 * anchor is the testid or the surrounding element.
 */
const COPY = [
  // ── The chooser (door === "both") ──────────────────────────────────────────
  { id: "chooser.h1", where: "WorkflowDoorSwitch.tsx — chooser <h1>", shipped: "How do you want to build this?", B: "How do you want to start?", C: "Two ways to build this" },
  { id: "chooser.sub", where: "WorkflowDoorSwitch.tsx — chooser sub-<p>", shipped: "Pick the fast path or full control — nothing is locked, you can switch anytime.", B: "Both end up in the same place. You can switch between them at any time.", C: "The difference is how much you decide yourself. Nothing is locked either way." },

  { id: "doorA.tier", where: 'testid="door-card-describe" — uppercase tier <span>', shipped: "loose · fastest path", B: "quickest · the AI writes the first draft", C: "you write one paragraph" },
  { id: "doorA.name", where: 'testid="door-card-describe" — name <span>', shipped: "Describe & run", B: "Draft it for me", C: "Describe it" },
  { id: "doorA.desc", where: 'testid="door-card-describe" — description <span>', shipped: "Say what recurring work this should do — the AI drafts the phases and sets the strictness.", B: "Describe the recurring work in plain language. The AI writes the steps, sets how strict it is, and asks you about anything it had to guess.", C: "Write a paragraph about the recurring work. The AI turns it into steps and picks the settings — then you review what it chose." },
  { id: "doorA.note", where: 'testid="door-card-describe" — italic footnote <span>', shipped: "nothing locked — switch to Author & govern anytime", B: "you can open the full editor at any point — nothing is locked in", C: "review and change anything afterwards" },

  { id: "doorB.tier", where: 'testid="door-card-govern" — uppercase tier <span>', shipped: "power · full control", B: "full control · you set every step", C: "you decide every setting" },
  { id: "doorB.name", where: 'testid="door-card-govern" — name <span>', shipped: "Author & govern", B: "Build it myself", C: "Set it up yourself" },
  { id: "doorB.desc", where: 'testid="door-card-govern" — description <span>', shipped: "Open the full Builder — every advanced control, the live strictness tier, the locked judge.", B: "Open the editor and set each step yourself — what it must cite, which checks have to pass, and which model runs each step.", C: "Add each step by hand and choose its settings — sources to cite, checks that must pass, model per step." },
  { id: "doorB.note", where: 'testid="door-card-govern" — italic footnote <span>', shipped: "citation policy · gate set · per-phase scope & model", B: "what it must cite · required checks · per-step sources & model", C: "for work with rules you already know" },

  // ── The describe door ──────────────────────────────────────────────────────
  { id: "strip.back", where: 'testid="both-doors" — the return control, BOTH open doors', shipped: "‹ both doors", B: "‹ Change how I start", C: "‹ Back to both options" },
  // ── THE 21st ID, added 2026-08-13 (193-04 / D-23) ──────────────────────────
  // It was MISSING, and the miss was invisible: `strip.label` above is scoped to the
  // DESCRIBE door's label, the emitter never rendered the govern door, and so
  // `dom.generated.json` never held this string for the audit to check. After variant
  // D ships, `🔧 Author & govern` would be the ONE surviving instance in the product of
  // the exact wording SEED-147 reports as illegible — sitting on the door whose card now
  // reads "Build it myself". That is the AUTH-01 failure inverted.
  //
  // ⚠ It is DELIBERATELY NOT in `D_FROM_C` below: it takes its B value like every other
  //   id, which is what keeps variant D derived rather than hand-written (D-02).
  // ⚠ `C` is deliberately ABSENT, so the contract renders *(inherit)* for column C. The
  //   operator's ruling was about the shipped→D transition; inventing a C value would be
  //   exactly the re-typing D-02 forbids.
  // ⚠ The longest-first sort in `applyVariant` is what makes this safe: `🔧 Author &
  //   govern` is LONGER than `doorB.name`'s `Author & govern`, so it takes its turn first
  //   and cannot be clobbered from the inside.
  { id: "strip.labelGovern", where: "govern-door header — the current-door label <span>", shipped: "🔧 Author & govern", B: "Build it myself" },
  { id: "strip.label", where: "describe-door header — the current-door label <span>", shipped: "⚡ Describe & run", B: "⚡ Drafting it for you", C: "⚡ Describing it" },
  { id: "describe.h1", where: "describe door — <h1>", shipped: "What recurring work should this automate?" },
  { id: "describe.cta", where: 'testid="describe-draft" — the CTA button', shipped: "Draft the workflow", B: "Write the first draft", C: "Turn this into steps" },
  { id: "describe.hint", where: 'testid="describe-hint" — composed of 3 <b> spans', shipped: null, note: "Composed string — the three bolded fragments are 'drafts the phases', 'sets the strictness', 'asks about anything it had to guess'. Varied fragment-by-fragment below." },
  { id: "hint.frag1", where: 'testid="describe-hint" — <b> #1', shipped: "drafts the phases", B: "writes the steps", C: "turns it into steps" },
  { id: "hint.frag2", where: 'testid="describe-hint" — <b> #2', shipped: "sets the strictness", B: "sets how strict it is", C: "chooses the settings" },
  { id: "hint.frag3", where: 'testid="describe-hint" — <b> #3', shipped: "asks about anything it had to guess", B: "asks about anything it had to guess", C: "tells you what it guessed" },
  { id: "switch.prompt", where: 'testid="switch-strip" — the prompt <span>', shipped: "Need citation policy, gates, or per-phase scope?", B: "Need to set citations, checks, or per-step sources yourself?", C: "Rather choose the settings yourself?" },
  { id: "switch.cta", where: 'testid="switch-to-govern" — the button', shipped: "Author & govern ›", B: "Build it myself ›", C: "Set it up yourself ›" },
  { id: "soul.label", where: 'testid="describe-soul-preview" — the uppercase label', shipped: "This workflow's soul", B: "What this will do", C: "What this will do" },
]

/**
 * ── VARIANT D — THE OPERATOR'S PICK (2026-08-13) ───────────────────────────
 *
 * D is NOT a fourth hand-written set of strings. It is DERIVED: variant B
 * everywhere, EXCEPT the two uppercase tier labels, which come from C.
 *
 * Deriving rather than re-typing is the whole point. A hand-typed D would be a
 * THIRD copy of every string, free to drift from B and C the moment either is
 * touched — the exact failure mode this sketch's generate-from-the-build
 * mechanism exists to make impossible. There is no string below that does not
 * already appear in the table above.
 *
 * The reasoning, recorded so a later reader does not have to reconstruct it:
 * B's door NAMES answer "who does the work" (`Draft it for me` / `Build it
 * myself`), which is the question SEED-147's operator actually had. C's TIER
 * labels state the price concretely (`you write one paragraph` / `you decide
 * every setting`) where B's state a benefit — and benefits are what made the
 * shipped wording vague in the first place.
 */
const D_FROM_C = new Set(["doorA.tier", "doorB.tier"])
for (const c of COPY) {
  const src = D_FROM_C.has(c.id) ? c.C : c.B
  if (src) c.D = src
}

const VARIANTS = [
  { key: "A", name: "Today (shipped)", axis: "The baseline. Zero substitutions — this is the real component's real DOM.", tone: "baseline" },
  { key: "B", name: "Plain verbs", axis: "Attacks SEED-147 suspect #1: “govern” is the product's word, not the user's. One plain verb per door, and the return control reads as an escape (“‹ Change how I start”) rather than a noun that looks like a third door.", tone: "b" },
  { key: "C", name: "Name the cost", axis: "Attacks SEED-147 suspect #3 on its real ground: the chooser DOES state a consequence today, but it states it as a FEATURE LIST. This states what YOU have to supply — one paragraph vs every setting.", tone: "c" },
  { key: "D", name: "THE PICK — plain verbs, named cost", axis: "The operator's pick, 2026-08-13. DERIVED, not re-typed: B everywhere, except the two uppercase tier labels which come from C. B's names say who does the work; C's tiers say what it costs YOU. This is the acceptance bar for Phase 193 — A, B and C remain on the page as the comparison that produced it, not as live options.", tone: "d" },
]

const esc = (s) => s.replace(/&/g, "&amp;")

/** Substitute a variant's copy into the real DOM. Longest shipped string first,
 *  so "Author & govern" cannot clobber the inside of "switch to Author & govern
 *  anytime" before that longer string has had its turn. */
function applyVariant(html, key) {
  if (key === "A") return html
  const subs = COPY.filter((c) => c.shipped && c[key] && c[key] !== c.shipped)
    .sort((a, b) => b.shipped.length - a.shipped.length)
  let out = html
  const applied = []
  for (const c of subs) {
    const from = esc(c.shipped)
    const to = esc(c[key])
    if (!out.includes(from)) {
      applied.push({ id: c.id, ok: false })
      continue
    }
    out = out.split(from).join(to)
    applied.push({ id: c.id, ok: true })
  }
  return { html: out, applied }
}

/**
 * The Run modal's real root is `fixed inset-0 z-[9000] grid place-items-center
 * bg-black/60 backdrop-blur-sm` — a VIEWPORT overlay. Dumped verbatim into an
 * inline stage it does two wrong things: it collapses to zero height (there is no
 * viewport box to fill inside a stage) and, being `fixed` at z-9000, it would
 * cover this entire sketch page.
 *
 * So the backdrop wrapper is stripped and the REAL dialog card inside it is what
 * gets embedded. Nothing inside the card is altered — this removes a positioning
 * shell, not content. Recorded in the contract so no reader concludes the modal
 * ships without its backdrop.
 */
function unwrapDialog(html) {
  const open = html.indexOf(">") + 1
  const close = html.lastIndexOf("</div>")
  const inner = html.slice(open, close)
  if (!inner.startsWith("<div class=\"w-[min(560px,92%)]")) {
    throw new Error(
      "unwrapDialog: the RunModal root is no longer a single backdrop div wrapping the " +
        "dialog card. Re-derive before trusting this sketch. Got: " + inner.slice(0, 120),
    )
  }
  return inner
}
const runModalCard = unwrapDialog(dom.runModal)

// ── The AUTH-03 template proposal — NEW nodes, no component to render ────────
const TEMPLATE_PROPOSAL = [
  {
    id: "card.templateMark",
    status: "NEW",
    where: "library/WorkflowCard.tsx — a mark in the row's existing provenance region",
    text: "needs a template",
    rule: "Rendered when, and ONLY when, the definition admits `render_template` in a phase tool whitelist (backend/app/services/harness/phase_types.py:388 is the authority). Absent — not greyed, not disabled — otherwise.",
  },
  {
    id: "run.templateLabel",
    status: "NEW",
    where: 'library/RunModal.tsx — a label above testid="run-template-upload"',
    text: "Template to fill",
    rule: "Only for a workflow whose definition admits `render_template`. Turns a nameless quiet button into a named, expected input.",
  },
  {
    id: "run.templateAbsent",
    status: "CHANGE",
    where: 'library/RunModal.tsx — the wrapper around testid="run-template-upload"',
    text: "(control not rendered)",
    rule: "TODAY the upload renders on EVERY workflow unconditionally. The ~100 rows that never fill a template each carry a control they cannot use, which is the discoverability problem inverted. Proposal: render nothing for them.",
  },
  {
    id: "run.provenance",
    status: "SHIPPED — keep verbatim",
    where: 'library/RunModal.tsx — testid="run-provenance"',
    text: "Stored untrusted — never run as code, never fed to the fill engine.",
    rule: "This sentence is load-bearing security honesty from Phase 152 (a template_input file is NEVER routed to the Jinja engine). It must survive any promotion of the control unchanged.",
  },
]

// ── Assemble ────────────────────────────────────────────────────────────────
//
// ⚠ THE AUDIT IS AGGREGATED ACROSS DUMPS ON PURPOSE, and the first run of this
// script is why the comment exists. Most COPY entries live in exactly ONE of the
// door surfaces — `chooser.h1` is not in the describe door, `switch.cta` is not in
// the chooser, `strip.labelGovern` is in neither — so a per-dump audit reported 37
// "misses" that were nothing of the kind. A real miss is an entry that matched in
// **no** dump: that, and only that, means the COPY table has drifted away from the
// component.
//
// ⚠ THE GOVERN DUMP IS AUDITED BUT NOT STAGED, and the asymmetry is deliberate rather
//   than an oversight. `strip.labelGovern` (D-23) exists in NO other dump, so without
//   auditing `dom.govern` the audit would report a MISS on the very id this change adds
//   — an audit that cannot see the string it governs is the failure this whole mechanism
//   exists to prevent. It is not rendered as a page stage because the govern door IS the
//   whole `WorkflowBuilderPage`: staging it would put a second full app surface on a page
//   whose question is about WORDS on the doors. Its layout is therefore NOT claimed
//   drift-proof by this sketch — only the one string is governed. Said in the contract
//   too, so no reader has to infer it from this comment.
const panels = {}
const applyLog = {}
for (const v of VARIANTS) {
  if (v.key === "A") {
    panels[v.key] = { chooser: dom.chooser, describe: dom.describe }
    applyLog[v.key] = []
    continue
  }
  const c = applyVariant(dom.chooser, v.key)
  const d = applyVariant(dom.describe, v.key)
  const g = applyVariant(dom.govern, v.key)
  panels[v.key] = { chooser: c.html, describe: d.html }
  const all = [...c.applied, ...d.applied, ...g.applied]
  const matched = new Set(all.filter((l) => l.ok).map((l) => l.id))
  const attempted = new Set(all.map((l) => l.id))
  applyLog[v.key] = [...attempted].map((id) => ({ id, ok: matched.has(id) }))
}

const tabBtn = (id, label, active) =>
  `<button type="button" class="s164-tab${active ? " s164-tab-on" : ""}" data-tab="${id}">${label}</button>`

const variantSection = (v) => `
<section class="s164-panel" data-panel="doors-${v.key}"${v.key === "A" ? "" : ' hidden'}>
  <div class="s164-axis">
    <span class="s164-badge s164-badge-${v.tone}">Variant ${v.key}</span>
    <div><strong>${v.name}</strong><p>${v.axis}</p></div>
  </div>
  <h3 class="s164-h3">1 · The chooser — what a fresh <code>Create</code> actually lands on</h3>
  <p class="s164-note">Measured: <code>onCreate={openBuilderFresh}</code> → <code>builderInitial=null</code> → <code>initialDoor="both"</code>. The chooser <em>is</em> reachable; SEED-147 did not claim otherwise, but nothing had checked.</p>
  <div class="s164-stage s164-stage-tall dark">${panels[v.key].chooser}</div>
  <h3 class="s164-h3">2 · The fast door, once opened — incl. the header strip SEED-147 suspect #2 is about</h3>
  <p class="s164-note">The strip is <code>‹ both doors</code> + the current-door label. In the <em>govern</em> door it is those two plus <code>🔒 judge always-on</code> — three items reading as visual peers, which is what the operator listed as "the other one".</p>
  <div class="s164-stage s164-stage-tall dark">${panels[v.key].describe}</div>
</section>`

const contractRows = COPY.filter((c) => c.shipped)
  .map(
    (c) => `<tr><td><code>${c.id}</code></td><td class="s164-where">${c.where}</td><td>${c.shipped
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")}</td><td>${(c.B || "—").replace(/&/g, "&amp;")}</td><td>${(c.C || "—").replace(/&/g, "&amp;")}</td><td><strong>${(c.D || "—").replace(/&/g, "&amp;")}</strong>${c.D && D_FROM_C.has(c.id) ? ' <span class="s164-badge s164-badge-c">from C</span>' : ""}</td></tr>`,
  )
  .join("\n")

const proposalRows = TEMPLATE_PROPOSAL.map(
  (p) =>
    `<tr><td><code>${p.id}</code></td><td><span class="s164-status s164-status-${p.status.split(" ")[0].toLowerCase()}">${p.status}</span></td><td class="s164-where">${p.where}</td><td><strong>${p.text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</strong><br><span class="s164-rule">${p.rule.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span></td></tr>`,
).join("\n")

const html = `<div class="s164-root">
<header class="s164-head">
  <p class="s164-kicker">Sketch 164 · Phase 193 · AUTH-01 + AUTH-03 · the G-2 gate</p>
  <h1>Telling the doors apart</h1>
  <p class="s164-lede">Which wording lets someone who has never seen the Builder predict what each door does — <em>before</em> clicking?</p>
  <div class="s164-mech">
    <strong>Read this first — why this sketch cannot drift from the build.</strong>
    <p>Every door surface below is the <em>real</em> <code>WorkflowDoorSwitch</code>, rendered under jsdom and dumped to <code>dom.generated.json</code>. Variant A is that DOM byte-for-byte. B and C are the same DOM with <em>nothing changed but the text</em> in the COPY table. Layout drift is impossible here, because the sketch's layout <em>is</em> the build's layout — which is the one hole 163's contract still had, and the hole UAT row U8 fell through in 192.1.</p>
    <p class="s164-caveat"><strong>Two things this does NOT prove, stated rather than implied.</strong> (1) The <em>template</em> panel is a <strong>proposal</strong> — it adds nodes no component has yet, so there was nothing real to render. (2) The header-strip peer problem is <strong>structural</strong>; wording can make <code>‹ both doors</code> read as an escape, but it cannot restack the strip. That stays an open decision, not a silent fix.</p>
  </div>
</header>

<nav class="s164-tabs">
  ${VARIANTS.map((v, i) => tabBtn(`doors-${v.key}`, `${v.key} · ${v.name}`, i === 0)).join("\n  ")}
  ${tabBtn("template", "AUTH-03 · Where the template goes", false)}
  ${tabBtn("contract", "The contract", false)}
</nav>

${VARIANTS.map(variantSection).join("\n")}

<section class="s164-panel" data-panel="template" hidden>
  <div class="s164-axis">
    <span class="s164-badge s164-badge-p">Proposal</span>
    <div><strong>AUTH-03 — a user with a template to fill can find where to supply it</strong>
    <p>The capability shipped in Phase 152 and is <em>not</em> being rebuilt. What is wrong is placement: the control below renders on <strong>every</strong> workflow, deliberately "quiet", and nothing anywhere says which workflows actually want one.</p></div>
  </div>
  <h3 class="s164-h3">The shipped Run modal, as it really renders today</h3>
  <p class="s164-note">Real DOM, same emitter as the doors. Note the <code>Upload template</code> button: no label, 12px, and present on a workflow that does not fill a template. <em>The <code>fixed inset-0</code> backdrop shell is stripped so the card can sit inline — nothing inside the card is altered.</em></p>
  <div class="s164-stage s164-stage-pad dark">${runModalCard}</div>
  <h3 class="s164-h3">The proposal, as a build contract</h3>
  <p class="s164-note"><strong>The signal is derivable — this is the finding that makes AUTH-03 more than a copy change.</strong> A template-filling workflow declares itself: a fill phase admits <code>render_template</code> in its phase tool whitelist. So "does this workflow want a template?" is an honest question the app can answer, not a guess.</p>
  <table class="s164-table">
    <thead><tr><th>id</th><th>status</th><th>where</th><th>text + rule</th></tr></thead>
    <tbody>${proposalRows}</tbody>
  </table>
</section>

<section class="s164-panel" data-panel="contract" hidden>
  <h3 class="s164-h3">COPY table — every string this sketch varies</h3>
  <p class="s164-note">The build <strong>ports this table</strong> into a vocabulary module and imports it, mirroring the shipped <code>libraryVocabulary.ts</code> shape. It does not re-type strings out of JSX. A blank cell means the variant inherits the shipped string.</p>
  <table class="s164-table">
    <thead><tr><th>id</th><th>where</th><th>A · shipped</th><th>B · plain verbs</th><th>C · name the cost</th><th>D · THE PICK</th></tr></thead>
    <tbody>${contractRows}</tbody>
  </table>
  <h3 class="s164-h3">Substitution audit</h3>
  <p class="s164-note">Every substitution is verified to have actually matched the real DOM. A miss would mean the COPY table has drifted from the component — the failure this whole mechanism exists to catch.</p>
  <pre class="s164-pre">${VARIANTS.filter((v) => v.key !== "A")
    .map((v) => {
      const log = applyLog[v.key]
      const ok = log.filter((l) => l.ok).length
      const miss = log.filter((l) => !l.ok)
      return `Variant ${v.key}: ${ok} substitution(s) matched the real DOM${miss.length ? `\n  ⚠ MISSED: ${miss.map((m) => m.id).join(", ")}` : "\n  ✓ zero misses"}`
    })
    .join("\n")}</pre>
</section>
</div>

<script>
document.querySelectorAll(".s164-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = btn.dataset.tab
    document.querySelectorAll(".s164-tab").forEach((b) => b.classList.toggle("s164-tab-on", b === btn))
    document.querySelectorAll(".s164-panel").forEach((p) => { p.hidden = p.dataset.panel !== id })
  })
})
</script>`

fs.writeFileSync(path.join(HERE, "body.generated.html"), html, "utf8")

// ── BUILD-CONTRACT.generated.md — emitted, never transcribed ────────────────
const md = `# BUILD-CONTRACT — Sketch 164 (Phase 193 · AUTH-01 + AUTH-03)

> **GENERATED by \`build.cjs\`. Do not hand-edit.** Regenerate with
> \`node .planning/sketches/164-telling-the-doors-apart/build.cjs\`.
>
> **Direction of generation matters.** 163 emitted its contract *from the sketch*, which is
> why it could still describe an unbuildable atom (UAT U8 / SEED-155). This contract is
> emitted from the **real component's rendered DOM** (\`dom.generated.json\`, captured by
> \`emit.test.tsx.src\`). For the doors panel, the sketch's layout **is** the build's layout.

## What is drift-proof here, and what is not

| Panel | Source | Drift risk |
|---|---|---|
| The chooser | real \`WorkflowDoorSwitch\` DOM | **none for layout** — only the words below differ |
| The describe door | real \`WorkflowDoorSwitch\` DOM | **none for layout** |
| The govern door | real \`WorkflowDoorSwitch\` DOM — **audited, NOT staged** | ⚠ **layout NOT claimed** — the dump exists so \`strip.labelGovern\` can be verified against a real node (D-23). The door IS the whole Builder, so it is not drawn on the page and this sketch makes no layout claim about it. |
| The Run modal | real \`library/RunModal\` DOM | **none for layout** |
| The template signal | **PROPOSAL — nodes that do not exist yet** | ⚠ normal sketch risk; treat the rules below as the spec |
| Header-strip stacking | **not addressed** — structural, not copy | ⚠ open decision, see below |

## COPY table

The build MUST port this table into a vocabulary module and import it (the shipped
\`libraryVocabulary.ts\` shape), rather than re-typing strings into JSX. A blank variant cell
means: inherit the shipped string unchanged.

**Column D is the one the build ports.** A, B and C are kept beside it as the comparison that
produced the pick — they are evidence, not live options. A cell marked ⬅ is the one place D
takes C's string instead of B's.

| id | where | A · shipped | B · plain verbs | C · name the cost | **D · THE PICK** |
|---|---|---|---|---|---|
${COPY.filter((c) => c.shipped)
  .map((c) => `| \`${c.id}\` | ${c.where} | ${c.shipped} | ${c.B || "*(inherit)*"} | ${c.C || "*(inherit)*"} | ${c.D ? `**${c.D}**${D_FROM_C.has(c.id) ? " ⬅ from C" : ""}` : "*(inherit)*"} |`)
  .join("\n")}

### Composed string

\`describe-hint\` is not one string — it is a sentence with three \`<b>\` fragments. Worked
example for each variant, so the build composes rather than guesses:

${VARIANTS.map((v) => {
  const f = (id) => {
    const c = COPY.find((x) => x.id === id)
    return v.key === "A" ? c.shipped : c[v.key] || c.shipped
  }
  return `- **${v.key}** — "You describe the goal — the AI **${f("hint.frag1")}**, **${f("hint.frag2")}**, and **${f("hint.frag3")}**."`
}).join("\n")}

## AUTH-03 — the template proposal

**The load-bearing finding: the signal is DERIVABLE.** A template-filling workflow declares
itself — a fill phase admits \`render_template\` in its phase tool whitelist
(\`backend/app/services/harness/phase_types.py:388\` is the authority; re-derive the exact
definition-side field name at plan time rather than trusting this sentence).

| id | status | where | text | rule |
|---|---|---|---|---|
${TEMPLATE_PROPOSAL.map((p) => `| \`${p.id}\` | ${p.status} | ${p.where} | ${p.text} | ${p.rule} |`).join("\n")}

## Substitution audit

${VARIANTS.filter((v) => v.key !== "A")
  .map((v) => {
    const log = applyLog[v.key]
    const miss = log.filter((l) => !l.ok)
    return `- **Variant ${v.key}** — ${log.filter((l) => l.ok).length} substitution(s) matched the real DOM; ${miss.length ? `⚠ **MISSED: ${miss.map((m) => m.id).join(", ")}** (the COPY table has drifted from the component)` : "**zero misses**"}`
  })
  .join("\n")}

## The open decision this sketch deliberately does NOT resolve

SEED-147 suspect #2 — *"the three controls sit in one strip in the header, so a return control
reads as a peer of the two doors."* Measured, the strip is \`‹ both doors\` + the current-door
label, plus \`🔒 judge always-on\` in the govern door. Wording can make the return control read
as an **escape** (variants B and C both do), but **restacking the strip is a structural change
this copy-only sketch cannot show**. It belongs in CONTEXT.md as its own decision — not as
something a chosen variant silently includes.

## What stays a human comparison at UAT

Pixel spacing, Tailwind class choices, hover/focus states. The G-4 rows MUST name this sketch
file as the reference and be driven **by looking**, never by \`getElementById\` on a known id —
the D-27 rule Phase 192's own re-drive broke and 192.1 restored.
`

fs.writeFileSync(path.join(HERE, "BUILD-CONTRACT.generated.md"), md, "utf8")

const misses = Object.entries(applyLog).flatMap(([k, log]) =>
  log.filter((l) => !l.ok).map((l) => `${k}:${l.id}`),
)
console.log(`body.generated.html + BUILD-CONTRACT.generated.md written`)
console.log(`substitutions: ${Object.values(applyLog).flat().filter((l) => l.ok).length} matched`)
if (misses.length) {
  console.error(`\n⚠ ${misses.length} MISSED substitution(s): ${misses.join(", ")}`)
  process.exitCode = 1
} else {
  console.log("zero missed substitutions — the COPY table agrees with the real DOM")
}
