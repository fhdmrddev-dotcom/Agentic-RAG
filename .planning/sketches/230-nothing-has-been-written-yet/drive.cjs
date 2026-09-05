#!/usr/bin/env node
/**
 * drive.cjs — sketch 230 · nothing has been written yet
 *
 * Asserts the four clauses this surface exists to answer, and — deliberately —
 * CROSS-CHECKS sketch 229's fixture, so the two sketches cannot come to disagree
 * about the same folder. A preview and its confirm that disagree is the exact
 * failure mode the ROADMAP names ("the preview and the real import disagree
 * about counts, or about where a file lands").
 *
 *   node drive.cjs
 */
const fs = require("fs");
const path = require("path");

const HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const SIB = path.join(__dirname, "..", "229-the-four-buckets", "index.html");

let pass = 0, fail = 0;
const fails = [];
const ok = (name, cond, detail) => {
  if (cond) pass++;
  else { fail++; fails.push(name + (detail ? "  — " + detail : "")); }
};

/* ── the resolution fixture ── */
const m = HTML.match(/var RESOLVE = (\[[\s\S]*?\n\]);/);
ok("fixture RESOLVE is extractable from index.html", !!m);
if (!m) { console.log("cannot continue"); process.exit(2); }
const RESOLVE = eval(m[1]);

/* ── 1. SC#5 — every guessed-at file has a TERMINAL outcome, and there are only three ── */
const TERMINAL = ["added", "here", "refused"];
RESOLVE.forEach(r => {
  ok(`"${r.n}" resolves to a terminal outcome`, TERMINAL.includes(r.outcome), r.outcome);
  ok(`"${r.n}" carries a readable detail`, typeof r.detail === "string" && r.detail.length > 20, r.detail);
});
ok("there is no fourth outcome value (\"silently in neither\" is unrepresentable)",
   RESOLVE.every(r => TERMINAL.includes(r.outcome)));
ok("at least one unknown is REFUSED (the honest bad case is demonstrated)",
   RESOLVE.some(r => r.outcome === "refused"));
ok("at least one unknown resolves to 'already here' (tier-2 sha256 doing its job)",
   RESOLVE.some(r => r.outcome === "here"));

/* ── 2. a refusal must be NAMED, not counted ── */
RESOLVE.filter(r => r.outcome === "refused").forEach(r => {
  ok(`refusal for "${r.n}" names a cause`,
     /—|because|cannot|no |not /i.test(r.detail) && !/^\d+ files? failed/i.test(r.detail), r.detail);
  ok(`refusal for "${r.n}" says it was not imported`, /not imported/i.test(r.detail), r.detail);
});

/* ── 3. SC#4 — the reconciliation arithmetic closes ── */
const ADDED = parseInt((HTML.match(/var ADDED = (\d+);/) || [0, 0])[1], 10);
ok("the bulk-add count is the preview's own 'will be added' count", ADDED === 12, String(ADDED));

let SIBCOUNTS = null;
if (fs.existsSync(SIB)) {
  const sibHtml = fs.readFileSync(SIB, "utf8");
  const sm = sibHtml.match(/var FILES = (\[[\s\S]*?\n\]);/);
  if (sm) {
    const FILES = eval(sm[1]);
    SIBCOUNTS = ["add", "here", "uns", "unk"].reduce((a, b) => (a[b] = FILES.filter(f => f.b === b).length, a), {});
    ok("229 and 230 agree on the 'will be added' count", SIBCOUNTS.add === ADDED,
       `229 says ${SIBCOUNTS.add}, 230 says ${ADDED}`);
    ok("229 and 230 agree on how many files are unknown", SIBCOUNTS.unk === RESOLVE.length,
       `229 says ${SIBCOUNTS.unk}, 230 resolves ${RESOLVE.length}`);
    const total = SIBCOUNTS.add + SIBCOUNTS.here + SIBCOUNTS.uns + SIBCOUNTS.unk;
    const finalAdded = SIBCOUNTS.add + RESOLVE.filter(r => r.outcome === "added").length;
    const finalHere = SIBCOUNTS.here + RESOLVE.filter(r => r.outcome === "here").length;
    const refused = RESOLVE.filter(r => r.outcome === "refused").length;
    const accounted = finalAdded + finalHere + SIBCOUNTS.uns + refused;
    ok("every file is accounted for after the resolution (0 unaccounted)", accounted === total,
       `${accounted} accounted of ${total}`);
    ok("the confirmed document count matches added-after-resolution",
       new RegExp('\\["C-w-doc",' + finalAdded + '\\]').test(HTML),
       `expected C-w-doc target ${finalAdded}`);
  }
} else {
  ok("sibling sketch 229 is present for cross-check", false, SIB);
}

/* ── 4. SC#2 — the pre-confirm ledger reads zero on EVERY counter ── */
["C-w-doc", "C-w-chunk", "C-w-job", "C-w-folder", "C-w-bytes"].forEach(id => {
  ok(`ledger counter ${id} starts at 0`,
     new RegExp('id="' + id + '">0<').test(HTML));
});
ok("the zero-write sentence is present", /Nothing has been written yet/.test(HTML));
ok("cancel prints the zeros rather than saying 'cancelled'",
   (HTML.match(/0 documents/g) || []).length >= 3);
ok("cancel handlers name what was NOT written",
   /onclick="toast\('Closed\. 0 documents/.test(HTML) || /onclick="toast\('Closed\. 0 rows written/.test(HTML));

/* ── 5. rule evaluation is a READ (the naive-implementation trap) ── */
ok("the ledger shows rule evaluation as a read with dry_run=True",
   /dry_run=True/.test(HTML) && /0 folders minted/.test(HTML));
ok("the sketch names the trap it is guarding against",
   /creating the destination folder up front/i.test(HTML));

/* ── 6. the re-embed cost is stated BEFORE the confirm, not after ── */
const receipt = HTML.slice(HTML.indexOf('id="A-receipt"'), HTML.indexOf('id="A-stage"'));
ok("the receipt says nothing is embedded again", /embedded again/i.test(receipt));
ok("the receipt states all four consequences",
   (receipt.match(/class="rrow (add|here|uns|unk)"/g) || []).length === 4,
   "found " + (receipt.match(/class="rrow /g) || []).length);
ok("the unknown row promises a terminal outcome for each of the four",
   /either <b>in the Library<\/b> or in a <b>named refusal/.test(receipt));
ok("the unknown row forbids the 'neither' case explicitly",
   /can end up in neither/.test(receipt));

/* ── 7. a projected row must be visibly not a row (variant B) ── */
ok("projected library rows are dashed ghosts, not facts", /\.ghost\{[^}]*border:1px dashed/.test(HTML));
ok("projected rows use a 'would' verb", /would add/.test(HTML));
ok("projected folder counts render as a transition, not a new total", /→ "\+\(p\[0\]\+p\[1\]\)\+" docs/.test(HTML) || /p\[0\]\+" → "/.test(HTML));

function report() {
  const line = "─".repeat(62);
  console.log(line);
  console.log("sketch 230 · nothing has been written yet — drive");
  console.log(line);
  console.log(`  unknowns resolved : ${RESOLVE.length}`);
  console.log(`  outcomes          : ` + RESOLVE.map(r => r.outcome).join(" · "));
  if (SIBCOUNTS) console.log(`  229 cross-check   : add ${SIBCOUNTS.add} · here ${SIBCOUNTS.here} · uns ${SIBCOUNTS.uns} · unk ${SIBCOUNTS.unk}`);
  console.log(line);
  if (fail) { fails.forEach(f => console.log("  ✕ " + f)); console.log(line); }
  console.log(`  ${pass} passed · ${fail} failed`);
  console.log(line);
}
report();
process.exit(fail ? 1 : 0);
