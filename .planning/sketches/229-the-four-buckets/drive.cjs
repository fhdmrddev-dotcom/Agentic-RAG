#!/usr/bin/env node
/**
 * drive.cjs — sketch 229 · the four buckets   (winner: C, the proportional spine)
 *
 * Asserts the honesty invariants against the sketch itself, so a later edit that
 * quietly drops a bucket, softens a label, or adds a control that can hide one FAILS
 * here rather than being noticed by a user.
 *
 *   node drive.cjs
 */
const fs = require("fs");
const path = require("path");

const HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const RDME = fs.readFileSync(path.join(__dirname, "README.md"), "utf8");
let pass = 0, fail = 0;
const fails = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; fails.push(n + (d ? "  — " + d : "")); } };

/* ── fixture, extracted from the running sketch rather than a copy of it ── */
const m = HTML.match(/var FILES = (\[[\s\S]*?\n\]);/);
ok("fixture FILES is extractable from index.html", !!m);
if (!m) { console.log("cannot continue"); process.exit(2); }
const FILES = eval(m[1]);

const BK = ["add", "here", "uns", "unk"];
const counts = BK.reduce((a, b) => (a[b] = FILES.filter(f => f.b === b).length, a), {});

/* ── 1. the arithmetic the whole surface rests on ── */
ok("every file carries a bucket", FILES.every(f => BK.includes(f.b)));
ok("bucket counts sum to the scan total",
   BK.reduce((s, b) => s + counts[b], 0) === FILES.length, JSON.stringify(counts));
ok("all four buckets are non-empty", BK.every(b => counts[b] > 0), JSON.stringify(counts));

/* ── 2. the fourth bucket is never a shrug ──
   The row shows a fragment (`wy`); the REASON lives in `full`, one hover away.
   Both are required: a fragment with no reason behind it is the shrug this guards. */
FILES.filter(f => f.b === "unk").forEach(f => {
  ok(`unknown "${f.n}" shows a short fragment`, typeof f.wy === "string" && f.wy.length <= 24, f.wy);
  ok(`unknown "${f.n}" carries the full reason behind it`,
     typeof f.full === "string" && f.full.length > 40, f.full);
});

/* ── 3. SC#3 at the row grain: an added file knows where it lands ── */
FILES.filter(f => f.b === "add").forEach(f => {
  ok(`added "${f.n}" carries a destination`, typeof f.dest === "string" && f.dest.startsWith("/"), f.dest);
});
ok("at least one destination is rule-suggested", FILES.some(f => f.b === "add" && f.rule));

/* ── 4. skipped / unsupported files state a reason too ── */
FILES.filter(f => f.b === "here" || f.b === "uns").forEach(f => {
  ok(`"${f.n}" carries a full reason`, typeof f.full === "string" && f.full.length > 20, f.full);
});

/* ── 5. the four labels are verbatim deliverables ── */
[["Will be added", 3], ["Already here", 3], ["Type not supported", 3], ["Can&rsquo;t tell without reading it", 3]]
  .forEach(([l, min]) => {
    const n = (HTML.match(new RegExp(l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
    ok(`label "${l.replace("&rsquo;", "'")}" appears in all three variants`, n >= min, "found " + n);
  });

/* ── 6. the "already here" claim must not overclaim ──
   ⚠ REGION-SCOPED, and it asserts the region was FOUND. The first version of this
   check searched the whole document, so rewriting one variant's copy to "matched by
   content hash" still passed: the phrase survived elsewhere and the sub-region regex
   silently matched nothing. Driven RED, then fixed. A guard that cannot fail on the
   defect it names is decoration. */
const vC = HTML.slice(HTML.indexOf('id="vC"'), HTML.indexOf('id="vA"'));
const vA = HTML.slice(HTML.indexOf('id="vA"'), HTML.indexOf('id="vB"'));
const vB = HTML.slice(HTML.indexOf('id="vB"'));

const cHere = (vC.match(/<div class="lgi here">([\s\S]*?)<\/div>\s*<div class="lgi uns">/) || [])[1];
ok("C's 'already here' legend item is locatable", !!cHere);
ok("C's 'already here' is qualified — by source file, not content",
   !!cHere && /not content/.test(cHere), cHere && cHere.replace(/\s+/g, " "));
ok("C's 'already here' makes NO hash claim", !!cHere && !/hash/i.test(cHere), cHere && cHere.replace(/\s+/g, " "));

const aHere = (vA.match(/<div class="ln here" data-b="here">([\s\S]*?)<div class="lr"/) || [])[1];
ok("A's 'already here' lane is locatable", !!aHere);
ok("A's 'already here' is qualified", !!aHere && /not content/.test(aHere));
ok("A's 'already here' makes NO hash claim", !!aHere && !/hash/i.test(aHere));

/* ── 7. VARIANT C (the winner): four legend items, four sections, no removal control ── */
ok("C renders four legend items", (vC.match(/class="lgi (add|here|uns|unk)"/g) || []).length === 4);
ok("C renders four accordion sections", (vC.match(/class="as[^"]*" data-b="(add|here|uns|unk)"/g) || []).length === 4);
ok("C's sections cover all four buckets", BK.every(b => vC.includes(`data-b="${b}"`)));
ok("C has NO filter chip (a bucket cannot be removed)", !/class="fc\b/.test(vC));
ok("C has no bucket-hiding handler", !/\.hid\b/.test(vC) && !/B\.tog/.test(vC));
ok("C's bar has a hatched, animating unknown segment",
   /\.sg\.unk\{[\s\S]*?animation:hatch/.test(HTML));
ok("C's unknown count keeps breathing after the scan settles",
   /\.settled \.lgi\.unk \.n\{animation:br/.test(HTML));

/* ── 8. VARIANT A: four lanes, no removal control ── */
ok("A renders exactly four lanes", (vA.match(/class="ln [a-z]+" data-b="(add|here|uns|unk)"/g) || []).length === 4);
ok("A has NO filter chip", !/class="fc\b/.test(vA));

/* ── 9. VARIANT B: the counter-example is PRESERVED, not quietly deleted ── */
ok("B still demonstrates the filter failure (4 chips)", (vB.match(/class="fc on"/g) || []).length === 4);
ok("B warns when a bucket goes off screen", vB.includes('id="B-leak"'));

/* ── 10. the zero-write footer appears on every variant ── */
const zeros = (HTML.match(/0 documents &middot; 0 chunks &middot; 0 jobs &middot; 0 folders/g) || []).length;
ok("every variant carries the zero-write footer", zeros >= 3, "found " + zeros);
ok("cancel prints the zeros rather than saying 'cancelled'",
   (HTML.match(/Closed\. 0 documents/g) || []).length >= 3);

/* ── 11. density: the reasons are BEHIND the rows, not printed on them ── */
ok("full reasons are delivered by hover, not rendered at rest", /data-full=/.test(HTML) && /class="tip"/.test(HTML));
ok("annotations are OFF by default", /\.note\{display:none/.test(HTML) && /body\.notes \.note\{display:block/.test(HTML));
ok("only one variant is on screen at a time", /\.v\{display:none\}/.test(HTML));

/* ── 12. the winner is recorded where a reader will look ── */
ok("README records the winner as C", /^winner: "C"/m.test(RDME));
ok("README names tier-1 identity and refuses to call it a hash",
   /\(source_system, external_id, source_version\)/.test(RDME) && /never called a hash/.test(RDME));
ok("the superseded recommendation is preserved, not overwritten",
   /Superseded recommendation/.test(RDME));

const line = "─".repeat(62);
console.log(line);
console.log("sketch 229 · the four buckets — drive   (winner: C)");
console.log(line);
console.log(`  files in fixture : ${FILES.length}`);
console.log(`  buckets          : add ${counts.add} · here ${counts.here} · uns ${counts.uns} · unk ${counts.unk}`);
console.log(line);
if (fail) { fails.forEach(f => console.log("  ✕ " + f)); console.log(line); }
console.log(`  ${pass} passed · ${fail} failed`);
console.log(line);
process.exit(fail ? 1 : 0);
