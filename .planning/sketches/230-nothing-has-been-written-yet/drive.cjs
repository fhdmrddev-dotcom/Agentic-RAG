#!/usr/bin/env node
/**
 * drive.cjs — sketch 230 · nothing has been written yet
 *
 * Asserts the four clauses this surface answers, and CROSS-CHECKS sketch 229's
 * fixture so the preview and the confirm cannot come to disagree about the same
 * folder — a ROADMAP failure mode in its own words.
 *
 *   node drive.cjs
 */
const fs = require("fs");
const path = require("path");

const HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const SIB = path.join(__dirname, "..", "229-the-four-buckets", "index.html");
let pass = 0, fail = 0;
const fails = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; fails.push(n + (d ? "  — " + d : "")); } };

const m = HTML.match(/var RESOLVE=(\[[\s\S]*?\n\]);/);
ok("fixture RESOLVE is extractable from index.html", !!m);
if (!m) { console.log("cannot continue"); process.exit(2); }
const RESOLVE = eval(m[1]);

/* ── 1. SC#5 — every guessed-at file has a TERMINAL outcome, and there are only three ── */
const TERMINAL = ["added", "here", "refused"];
RESOLVE.forEach(r => {
  ok(`"${r.n}" resolves to a terminal outcome`, TERMINAL.includes(r.outcome), r.outcome);
  ok(`"${r.n}" shows a short outcome fragment`, typeof r.out === "string" && r.out.length <= 26, r.out);
  ok(`"${r.n}" carries the full sentence behind it`, typeof r.full === "string" && r.full.length > 30, r.full);
});
ok('there is no fourth outcome value ("silently in neither" is unrepresentable)',
   RESOLVE.every(r => TERMINAL.includes(r.outcome)));
ok("at least one unknown is REFUSED (the honest bad case is demonstrated)",
   RESOLVE.some(r => r.outcome === "refused"));
ok("at least one unknown resolves to 'already here' (tier-2 sha256 doing its job)",
   RESOLVE.some(r => r.outcome === "here"));
ok("the tier-2 row says it was not embedded again",
   RESOLVE.some(r => r.outcome === "here" && /not embedded again/i.test(r.full)));

/* ── 2. a refusal must be NAMED, not counted ── */
RESOLVE.filter(r => r.outcome === "refused").forEach(r => {
  ok(`refusal for "${r.n}" names a cause`,
     /cannot|no |not /i.test(r.full) && !/^\d+ files? failed/i.test(r.full), r.full);
  ok(`refusal for "${r.n}" says it was not imported`, /not imported/i.test(r.full), r.full);
});

/* ── 3. SC#4 — the reconciliation arithmetic closes, and 229 agrees ── */
const BASE = eval("(" + (HTML.match(/var BASE=(\{[^}]*\})/) || [0, "{}"])[1] + ")");
const ADDED = parseInt((HTML.match(/ADDED\s*=\s*(\d+)/) || [0, 0])[1], 10);
ok("the bulk-add count is the preview's own 'will be added' count", ADDED === BASE.add, `${ADDED} vs ${BASE.add}`);

let SIBC = null;
if (fs.existsSync(SIB)) {
  const sm = fs.readFileSync(SIB, "utf8").match(/var FILES = (\[[\s\S]*?\n\]);/);
  if (sm) {
    const F = eval(sm[1]);
    SIBC = ["add", "here", "uns", "unk"].reduce((a, b) => (a[b] = F.filter(x => x.b === b).length, a), {});
    ok("229 and 230 agree on 'will be added'", SIBC.add === BASE.add, `229:${SIBC.add} 230:${BASE.add}`);
    ok("229 and 230 agree on 'already here'", SIBC.here === BASE.here, `229:${SIBC.here} 230:${BASE.here}`);
    ok("229 and 230 agree on 'type not supported'", SIBC.uns === BASE.uns, `229:${SIBC.uns} 230:${BASE.uns}`);
    ok("229 and 230 agree on how many are unknown", SIBC.unk === RESOLVE.length,
       `229:${SIBC.unk} 230 resolves ${RESOLVE.length}`);
    const total = SIBC.add + SIBC.here + SIBC.uns + SIBC.unk;
    const fAdd = SIBC.add + RESOLVE.filter(r => r.outcome === "added").length;
    const fHere = SIBC.here + RESOLVE.filter(r => r.outcome === "here").length;
    const fRef = RESOLVE.filter(r => r.outcome === "refused").length;
    ok("every file is accounted for after the resolution (0 unaccounted)",
       fAdd + fHere + SIBC.uns + fRef === total, `${fAdd + fHere + SIBC.uns + fRef} of ${total}`);
    ok("the confirmed document count matches added-after-resolution",
       new RegExp(fAdd + " documents").test(HTML), `expected "${fAdd} documents"`);
    ok("the reconciliation line states the total and zero unaccounted",
       new RegExp(total + " accounted").test(HTML) && /0 unaccounted/.test(HTML));
    ok("the reconciliation line states preview-said vs actually-added",
       new RegExp("preview said " + SIBC.add + " &rarr; " + SIBC.add + " added").test(HTML));
  }
} else ok("sibling sketch 229 is present for cross-check", false, SIB);

/* ── 4. SC#2 — the pre-confirm ledger reads zero, everywhere, before any confirm ── */
const zeros = (HTML.match(/0 documents &middot; 0 chunks &middot; 0 jobs/g) || []).length;
ok("every variant shows the zero-write line at rest", zeros >= 3, "found " + zeros);
ok("no non-zero write count is rendered at rest",
   !/>\s*[1-9]\d* documents/.test(HTML.slice(0, HTML.indexOf("<script"))));
ok("cancel prints the zeros rather than saying 'cancelled'",
   (HTML.match(/Closed\. 0 documents/g) || []).length >= 2);
ok("the surface is titled by the guarantee", /Nothing has been written yet/.test(HTML));

/* ── 5. rule evaluation is a READ — the naive-implementation trap ── */
ok("the ledger shows rule evaluation as a read with dry_run=True",
   /dry_run=True/.test(HTML) && /0 folders minted/.test(HTML));
ok("the sketch names the trap it guards against",
   /creating the destination folder up front/i.test(HTML));

/* ── 6. variant A: the bar dissolves — a refused segment exists and starts at zero ── */
const vA = HTML.slice(HTML.indexOf('id="vA"'), HTML.indexOf('id="vB"'));
ok("A reuses 229-C's segmented bar", /class="sg add"/.test(vA) && /class="sg unk"/.test(vA));
ok("A has a refused segment", /class="sg ref"/.test(vA));
ok("A's refused segment starts hidden at zero", /\.sg\.ref\{[^}]*width:0/.test(HTML));
ok("A's refused legend item starts hidden", /\.lgi\.ref\{opacity:0\}/.test(HTML));
ok("A's unknown segment is hatched and animating", /\.sg\.unk\{[\s\S]*?animation:hatch/.test(HTML));
ok("A resolves the unknowns one at a time", /i\*1300/.test(HTML));

/* ── 7. variant B is kept as the OTHER failure mode, not deleted ── */
const vB = HTML.slice(HTML.indexOf('id="vB"'), HTML.indexOf('id="vC"'));
ok("B is preserved as the too-spare counter-example", /class="dots"/.test(vB));
ok("B's note says why a colour is not a named refusal", /only a colour is a count/i.test(HTML));

/* ── 8. density: reasons behind the row, annotations off by default ── */
ok("outcome reasons are delivered by hover, not printed", /data-full/.test(HTML) && /class="tip"/.test(HTML));
ok("annotations are OFF by default", /\.note\{display:none/.test(HTML) && /body\.notes \.note\{display:block/.test(HTML));
ok("only one variant is on screen at a time", /\.v\{display:none\}/.test(HTML));

const line = "─".repeat(62);
console.log(line);
console.log("sketch 230 · nothing has been written yet — drive");
console.log(line);
console.log(`  unknowns resolved : ${RESOLVE.length}`);
console.log(`  outcomes          : ${RESOLVE.map(r => r.outcome).join(" · ")}`);
if (SIBC) console.log(`  229 cross-check   : add ${SIBC.add} · here ${SIBC.here} · uns ${SIBC.uns} · unk ${SIBC.unk}`);
console.log(line);
if (fail) { fails.forEach(f => console.log("  ✕ " + f)); console.log(line); }
console.log(`  ${pass} passed · ${fail} failed`);
console.log(line);
process.exit(fail ? 1 : 0);
