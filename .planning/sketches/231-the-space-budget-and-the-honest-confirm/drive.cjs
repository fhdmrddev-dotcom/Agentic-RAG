#!/usr/bin/env node
/**
 * drive.cjs — sketch 231 · the space budget and the honest confirm
 *
 * Asserts the invariants against the sketch itself, so a later edit that re-narrows the page,
 * puts the breadcrumb back, restacks the tabs, or lets "added" mean "queued" FAILS here rather
 * than being noticed by a user.
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

/* ── fixture, extracted from the running sketch rather than copied ── */
const m = HTML.match(/var FILES = (\[[\s\S]*?\n\]);/);
ok("fixture FILES is extractable", !!m);
if (!m) { console.log("cannot continue"); process.exit(2); }
const FILES = eval(m[1]);

const BK = ["add", "here", "uns", "unk"];
const counts = BK.reduce((a, b) => (a[b] = FILES.filter(f => f.b === b).length, a), {});

const vX = HTML.slice(HTML.indexOf('id="vX"'), HTML.indexOf('id="vA"'));
const vA = HTML.slice(HTML.indexOf('id="vA"'), HTML.indexOf('id="vB"'));
const vB = HTML.slice(HTML.indexOf('id="vB"'), HTML.indexOf('id="vC"'));
const vC = HTML.slice(HTML.indexOf('id="vC"'), HTML.indexOf('</div>\n\n<div class="tip"'));

/* ── 1. THE WIDTH. The reverted decision must stay reverted. ──────────────────────
   Sketches 229/230 declared `--measure:1152px` and Phase 233 shipped it on LibraryPage.
   The operator reverted it the same day. A sketch that quietly re-narrows the page would
   re-propose a decision that has already been made and unmade. */
ok("⛔ NO --measure token is declared (the Library is full-width)",
   !/--measure\s*:/.test(HTML));
ok("⛔ no max-width literal on the app frame",
   !/\.app\{[^}]*max-width/.test(HTML));
ok("the reversal is EXPLAINED in the stylesheet, not merely absent",
   /full-width|FULL WIDTH/i.test(HTML.slice(0, HTML.indexOf("</style>"))));

/* ── 2. THE SPACE RECLAIM, and it is arithmetic rather than an impression ────────── */
ok("variant X exists as the measured BEFORE", vX.includes("deadzone"));
ok("X names the dead band in numbers", /212px/.test(vX) && /48%/.test(vX));
ok("X shows FOUR stacked blocks (title, sub, crumb, and two strips)",
   /class="crumb"/.test(vX) && /class="strip1"/.test(vX) && /class="strip2"/.test(vX));

["A", "B", "C"].forEach((v, i) => {
  const src = [vA, vB, vC][i];
  ok(`${v} deletes the breadcrumb`, !/class="crumb"/.test(src));
  ok(`${v} has NO stacked second tab strip`, !/class="strip2"/.test(src));
  ok(`${v} keeps the dropzone SLIM (no .dz.big)`, !/class="dz big"/.test(src));
  ok(`${v} gives the folder rail its own scroll region`, /class="rail"/.test(src) && /class="rb"/.test(src));
  ok(`${v} shows the source tree with real nesting`, /class="tn d2"/.test(src));
});

/* ── 3. ⭐ THE DECIDING CLAUSE — can it still tell the truth after you navigate away? ──
   The queue finishes LATER. A variant whose only signal lives inside the panel forgets the
   work the moment the panel unmounts. That is the axis, and B is the counter-example. */
ok("⭐ A carries the queue on the SHELL (a header pill)", /id="A-pill"/.test(vA));
ok("⭐ C carries the queue on the SHELL (a strip above the tabs)", /id="C-strip"/.test(vC));
ok("⛔ B has NEITHER — the counter-example is preserved, not quietly fixed",
   !/id="B-pill"/.test(vB) && !/id="B-strip"/.test(vB) && !/class="cstrip"/.test(vB));
ok("B's failure is NAMED in its own notes rather than left for the reader to find",
   /FAILS THE DECIDING CLAUSE/.test(vB));

/* ── 4. ⛔ "ADDED" MAY NOT MEAN "QUEUED" ──────────────────────────────────────────
   This is the defect the queue fix introduced in the shipped app: the reconciliation line
   said "12 added" when the files were merely enqueued. The sketch must distinguish
   ACCEPTED from READABLE, in words, or it re-draws the bug. */
ok("a LIVE vocabulary exists and is separate from the terminal outcomes", /var LIVE=/.test(HTML));
["queued", "reading", "readable", "refused"].forEach(k => {
  ok(`LIVE names "${k}"`, new RegExp(k + ":").test(HTML.match(/var LIVE=\{[^}]*\}/)[0]));
});
ok('⭐ "Readable" is qualified as searchable, not merely stored',
   /in the Library, searchable/.test(HTML));
ok('⭐ the in-flight state says the CONCURRENCY, so "still reading" has a reason',
   /5 at a time/.test(HTML));
ok("the confirm toast says the work continues after you leave",
   /you can leave this page/.test(HTML));

/* ⚠ THE TERMINAL OUTCOMES ARE STILL EXACTLY THREE. The queue adds a JOURNEY, not a fourth
   destination — SC#5's "never silently in neither" depends on that, and a sketch that quietly
   grew a fourth terminal state would have broken a shipped guarantee. */
const outcomes = (HTML.match(/added \| here \| refused/g) || []).length;
ok("⛔ the three terminal outcomes are stated and unchanged", outcomes >= 1);

/* ── 5. the four buckets survive from 229 — this sketch must not quietly drop one ── */
ok("every file carries a bucket", FILES.every(f => BK.includes(f.b)));
ok("bucket counts sum to the scan total",
   BK.reduce((s, b) => s + counts[b], 0) === FILES.length, JSON.stringify(counts));
ok("all four buckets are non-empty", BK.every(b => counts[b] > 0), JSON.stringify(counts));
[["Will be added"], ["Already here"], ["Type not supported"], ["Can’t tell without reading it"]]
  .forEach(([l]) => ok(`label "${l}" is verbatim from 229`, HTML.includes(l)));
ok("⛔ 'Already here' still makes NO content-identity claim",
   !/hash/i.test(HTML.match(/var LABEL=\{[^}]*\}/)[0]) &&
   /by source file, not content/.test(HTML));

/* ── 6. every unknown still says WHY, and the reason stays behind the row ────────── */
FILES.filter(f => f.b === "unk").forEach(f => {
  ok(`unknown "${f.n}" shows a short fragment`, typeof f.wy === "string" && f.wy.length <= 24, f.wy);
  ok(`unknown "${f.n}" carries the full reason behind it`,
     typeof f.full === "string" && f.full.length > 40);
});
ok("reasons are delivered by hover, not printed at rest",
   /data-full=/.test(HTML) && /class="tip"/.test(HTML));

/* ── 7. density — the operator rejected two prior sketches for this ──────────────── */
ok("annotations are OFF by default", /\.note\{display:none/.test(HTML) && /body\.notes \.note\{display:block/.test(HTML));
ok("only one variant is on screen at a time", /\.v\{display:none\}/.test(HTML));

/* ── 8. the zero-write receipt survives into the resting state ───────────────────── */
ok("the four-zero receipt is present",
   (HTML.match(/0 documents · 0 chunks · 0 jobs · 0 folders/g) || []).length >= 3);
ok("cancel prints the zeros rather than saying 'cancelled'", /Closed\. 0 documents/.test(HTML));

/* ── 9. the README records the question and the numbers ─────────────────────────── */
ok("README states the deciding clause", /navigate away/i.test(RDME));
ok("README records the space arithmetic", /212/.test(RDME));
ok("README records that the 1152 measure was REVERTED", /revert/i.test(RDME));

const line = "─".repeat(64);
console.log(line);
console.log("sketch 231 · the space budget and the honest confirm");
console.log(line);
console.log(`  files in fixture : ${FILES.length}`);
console.log(`  buckets          : add ${counts.add} · here ${counts.here} · uns ${counts.uns} · unk ${counts.unk}`);
console.log(line);
if (fail) { fails.forEach(f => console.log("  ✕ " + f)); console.log(line); }
console.log(`  ${pass} passed · ${fail} failed`);
console.log(line);
process.exit(fail ? 1 : 0);
