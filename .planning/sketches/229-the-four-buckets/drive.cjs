#!/usr/bin/env node
/**
 * drive.cjs — sketch 229 · the four buckets
 *
 * Asserts the HONESTY invariants of the sketch against the sketch itself, so that a
 * later edit that quietly drops a bucket, softens a label, or adds a control that can
 * hide one, FAILS here instead of being noticed by a user.
 *
 * The 218 pattern: a sketch that cannot be driven is a picture.
 *
 *   node drive.cjs
 */
const fs = require("fs");
const path = require("path");

const HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
let pass = 0, fail = 0;
const fails = [];

function ok(name, cond, detail) {
  if (cond) { pass++; }
  else { fail++; fails.push(name + (detail ? "  — " + detail : "")); }
}

/* ── extract the fixture from the running sketch, never a copy of it ── */
const m = HTML.match(/var FILES = (\[[\s\S]*?\n\]);/);
ok("fixture FILES is extractable from index.html", !!m);
if (!m) { report(); process.exit(2); }
const FILES = eval(m[1]);

const BUCKETS = ["add", "here", "uns", "unk"];
const count = b => FILES.filter(f => f.b === b).length;
const counts = { add: count("add"), here: count("here"), uns: count("uns"), unk: count("unk") };

/* ── 1. the arithmetic the whole surface rests on ── */
ok("every file carries a bucket", FILES.every(f => BUCKETS.includes(f.b)),
   "offenders: " + FILES.filter(f => !BUCKETS.includes(f.b)).map(f => f.n).join(", "));
ok("bucket counts sum to the scan total",
   counts.add + counts.here + counts.uns + counts.unk === FILES.length,
   `${counts.add}+${counts.here}+${counts.uns}+${counts.unk} != ${FILES.length}`);
ok("all four buckets are non-empty (a zero bucket cannot demonstrate the case)",
   BUCKETS.every(b => counts[b] > 0), JSON.stringify(counts));

/* ── 2. the fourth bucket must never be a shrug ── */
FILES.filter(f => f.b === "unk").forEach(f => {
  ok(`unknown "${f.n}" names why we cannot tell`,
     typeof f.why === "string" && f.why.length > 25, f.why);
});

/* ── 3. SC#3 at the row grain: an added file knows where it lands ── */
FILES.filter(f => f.b === "add").forEach(f => {
  ok(`added "${f.n}" carries a destination`,
     typeof f.dest === "string" && f.dest.startsWith("/"), f.dest);
});
ok("at least one destination is rule-suggested (SC#3 names rules explicitly)",
   FILES.some(f => f.b === "add" && f.rule));

/* ── 4. skipped and unsupported files state their reason too ── */
FILES.filter(f => f.b === "here" || f.b === "uns").forEach(f => {
  ok(`"${f.n}" states its reason`, typeof f.why === "string" && f.why.length > 8, f.why);
});

/* ── 5. the four labels are verbatim deliverables ── */
const LABELS = [
  "Will be added",
  "Already here",
  "Type not supported",
  "Can&rsquo;t tell without reading it"
];
LABELS.forEach(l => ok(`label present verbatim: "${l.replace('&rsquo;', "'")}"`, HTML.includes(l)));

/* ── 6. the "already here" claim must not overclaim ──
   ⚠ REGION-SCOPED, and it asserts the region was FOUND. The first version of this
   check searched the whole document, so rewriting variant A's copy to "matched by
   content hash" still passed — the phrase survived in variant C and in the footnotes,
   and the sub-region regex silently matched nothing. Driven RED, then fixed. A guard
   that cannot fail on the defect it names is decoration. */
const vA = HTML.slice(HTML.indexOf('id="vA"'), HTML.indexOf('id="vB"'));
const vC = HTML.slice(HTML.indexOf('id="vC"'));

const hereLane = (vA.match(/data-b="here">([\s\S]*?)<div class="lane-rows"/) || [])[1];
ok('variant A\'s "already here" lane copy is locatable', !!hereLane);
ok('variant A\'s "already here" is qualified — matched by source file, not by content',
   !!hereLane && /not by content/.test(hereLane), hereLane && hereLane.replace(/\s+/g, " ").slice(0, 150));
ok('variant A\'s "already here" makes NO hash claim',
   !!hereLane && !/hash/i.test(hereLane), hereLane && hereLane.replace(/\s+/g, " ").slice(0, 150));

const cLegend = (vC.match(/<div class="legend">([\s\S]*?)<\/div>\s*<div class="acc"/) || [])[1];
ok("variant C's legend is locatable", !!cLegend);
ok("variant C's legend carries the same qualifier",
   !!cLegend && /matched by source file, not by content/.test(cLegend));
ok("variant C's legend makes NO hash claim", !!cLegend && !/hash/i.test(cLegend));

/* ── 7. VARIANT A: four lanes, and NO control that removes one ── */
const laneMatches = vA.match(/class="lane [a-z]+" data-b="(add|here|uns|unk)"/g) || [];
ok("variant A renders exactly four lanes", laneMatches.length === 4, "found " + laneMatches.length);
ok("variant A's lanes cover all four buckets",
   BUCKETS.every(b => vA.includes(`data-b="${b}"`)));
ok("variant A contains NO filter chip (a bucket cannot be removed)", !/class="fchip/.test(vA));
ok("variant A contains no bucket-hiding handler",
   !/onclick="[^"]*toggle/i.test(vA) && !/hidden-by-filter/.test(vA));

/* ── 8. VARIANT B: the counter-example is PRESERVED, not quietly deleted ── */
const vB = HTML.slice(HTML.indexOf('id="vB"'), HTML.indexOf('id="vC"'));
ok("variant B still demonstrates the filter failure (4 chips)",
   (vB.match(/class="fchip/g) || []).length === 4);
ok("variant B warns when a bucket goes off screen", vB.includes('id="B-leak"'));

/* ── 9. the zero-write footer appears on every variant ── */
ok("every variant carries the zero-write footer",
   (HTML.match(/Nothing has been written/g) || []).length >= 3,
   "found " + (HTML.match(/Nothing has been written/g) || []).length);

/* ── 10. Tier-1 identity is named and not called a hash ── */
ok("tier-1 identity key is named verbatim",
   HTML.includes("(source_system, external_id, source_version)"));
ok("the sketch says the equality is not called a hash",
   /never calls it a hash/i.test(HTML));

/* ── 11. motion exists and is bound to the fourth bucket ── */
ok("the unknown lane has a persistent unsettled treatment",
   /\.lane\.unk\{background:/.test(HTML) && /settled \.lane\.unk \.lane-n\{animation:breathe/.test(HTML));
ok("files animate into their lane (the sort is watchable)", HTML.includes("function fly("));

function report() {
  const line = "─".repeat(62);
  console.log(line);
  console.log("sketch 229 · the four buckets — drive");
  console.log(line);
  console.log(`  files in fixture : ${FILES ? FILES.length : "?"}`);
  if (FILES) console.log(`  buckets          : add ${counts.add} · here ${counts.here} · uns ${counts.uns} · unk ${counts.unk}`);
  console.log(line);
  if (fail) {
    fails.forEach(f => console.log("  ✕ " + f));
    console.log(line);
  }
  console.log(`  ${pass} passed · ${fail} failed`);
  console.log(line);
}
report();
process.exit(fail ? 1 : 0);
