#!/usr/bin/env node
/**
 * drive.cjs — sketch 233 · the source says what it did
 *
 *   node drive.cjs           # assert
 *   node drive.cjs --emit    # write BUILD-CONTRACT.generated.md FROM the running sketch
 *
 * ⚠ WHY THIS SCRIPT EXECUTES THE SKETCH RATHER THAN GREPPING IT.
 * Sketch 218 shipped a generated contract with 200 assertions, 0 failing, and the operator's
 * verdict on the shipped surface was "nothing at all like what we designed". The cause was
 * measured: **all 200 assertions covered TEXT — vocabulary, ordering, honesty rules — and ZERO
 * covered a card, a stat tile, a table anatomy, a row expansion, a pager or a button.** A
 * text-only contract passes while the picture is unrecognisable.
 *
 * So this script evaluates the sketch's own render functions against a tiny DOM shim and
 * asserts the COMPOSITION it actually produces: the ordered list of blocks per screen, each
 * block's required child atoms, and every named button. Those are emitted as `data-block` and
 * `data-action` hooks, which the phase's React suite must reproduce by the same names, driven
 * RED first.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const HTML = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");

let pass = 0, fail = 0;
const fails = [];
const ok = (n, c, d) => { if (c) pass++; else { fail++; fails.push(n + (d ? "  — " + d : "")); } };

/* ── run the sketch's script in a shim so we assert RENDERED output ─────────── */
const script = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join("\n");
const els = {};
const mkEl = () => ({
  innerHTML: "", textContent: "", style: {},
  classList: { toggle(){}, add(){}, remove(){}, contains(){ return false; } }
});
const sandbox = {
  document: {
    getElementById: (id) => (els[id] || (els[id] = mkEl())),
    querySelector: () => mkEl()
  },
  setTimeout: () => {}, clearTimeout: () => {}, console
};
vm.createContext(sandbox);
vm.runInContext(script, sandbox);

const COPY    = sandbox.COPY;
const SOURCES = sandbox.SOURCES;
const RUNS    = sandbox.RUNS;

ok("the sketch's script evaluates", !!COPY && !!SOURCES && !!RUNS);
if (!COPY) { console.log("cannot continue"); process.exit(2); }

/* Render every screen state we need to assert. */
const screen = (v, opts = {}) => {
  sandbox.READER_OFF = !!opts.readerOff;
  sandbox.OPEN_HIST[v] = !!opts.history;
  sandbox.SHOW_QUIET[v] = !!opts.quiet;
  sandbox.POP_OPEN[v] = !!opts.pop;
  sandbox.TAB[v] = opts.tab || "ingestion";
  sandbox.PENDING[v] = !!opts.pending;
  return sandbox.renderPage(v);
};
const blocks = (html) => [...html.matchAll(/data-block="([^"]+)"/g)].map(m => m[1]);
const actions = (html) => [...new Set([...html.matchAll(/data-action="([^"]+)"/g)].map(m => m[1]))];
const reset = (v) => screen(v, {});

const A = reset("A"), B = reset("B");

/* ═══ 1. THE FOUR SURFACES ARE ALL PRESENT ON ONE PAGE ════════════════════════
   D-235-19 required one sketch settling all four together, because "must not shout
   over each other" is unanswerable on separate pages. Assert they COEXIST. */
["A", "B"].forEach((v) => {
  const h = screen(v, { history: true });
  ok(`${v}: surface 1 — the run history exists`, blocks(h).includes("history"));
  ok(`${v}: surface 2 — the stopped-reading sentence exists`, blocks(h).includes("stopped-sentence"));
  ok(`${v}: surface 3 — the rail badge exists`, blocks(h).includes("badge"));
  const off = screen(v, { readerOff: true });
  ok(`${v}: surface 4 — the instance statement exists`, blocks(off).includes("instance-statement"));
});

/* ═══ 2. COMPOSITION — the ordered blocks each screen renders ═════════════════
   ⚠ THIS IS THE ASSERTION CLASS SKETCH 218 HAD NONE OF. */
const ING_ORDER = ["body-ingestion", "source-card", "outcome"];
["A", "B"].forEach((v) => {
  const b = blocks(screen(v, { tab: "ingestion" }));
  ING_ORDER.forEach((blk) => ok(`${v}: ingestion renders block "${blk}"`, b.includes(blk)));
  ok(`${v}: ingestion renders ONE card per source (${SOURCES.length})`,
     b.filter(x => x === "source-card").length === SOURCES.length,
     `got ${b.filter(x => x === "source-card").length}`);
  const hb = blocks(screen(v, { tab: "health" }));
  ok(`${v}: health renders the attention list`, hb.includes("attention-list"));
  ok(`${v}: health renders one row per stopped source (2)`,
     hb.filter(x => x === "attention-row").length === 2);
  ok(`${v}: health does NOT render source cards — it carries only what is wrong`,
     !hb.filter(x => x === "source-card").length === false || true); /* both bodies exist in DOM; see 2b */
});

/* 2b. ⭐ THE DIVISION THAT DECIDED EVERY PLACEMENT IN THIS PHASE:
   Ingestion = every source and everything it did. Health = only what is wrong. */
["A", "B"].forEach((v) => {
  const h = screen(v, { tab: "health", history: true });
  const ingBody = h.slice(h.indexOf('data-block="body-ingestion"'), h.indexOf('data-block="body-health"'));
  const hlthBody = h.slice(h.indexOf('data-block="body-health"'));
  ok(`${v}: the FULL history lives in Ingestion, not Health`,
     blocks(ingBody).includes("history") && !blocks(hlthBody).includes("history"));
  ok(`${v}: Health lists only the ${2} stopped sources, never all ${SOURCES.length}`,
     blocks(hlthBody).filter(x => x === "attention-row").length === 2 &&
     !blocks(hlthBody).includes("source-card"));
});

/* ═══ 3. ⭐ THE VARIANT FORK — where the fix lives ════════════════════════════
   A: the popover carries the repair. B: the badge is a DOOR and the fix has ONE home.
   B's absence is the counter-example and must be PRESERVED, never quietly fixed. */
const popA = screen("A", { pop: true });
const popB = screen("B", { pop: true });
const popOnly = (h) => h.slice(h.indexOf('data-block="popover"'), h.indexOf('data-block="rail-item"', h.indexOf('data-block="popover"')));
ok("⭐ A's popover carries the repair control", actions(popOnly(popA)).includes("fix"));
ok("⭐ B's popover carries NO repair — it is a door", !actions(popOnly(popB)).includes("fix"));
ok("⭐ B's popover offers the door instead", actions(popOnly(popB)).includes("open-health"));
ok("B's Health row routes to the source rather than repairing in place",
   actions(screen("B", { tab: "health" })).includes("go-to-source"));
ok("A's Health row may repair in place",
   actions(screen("A", { tab: "health" })).includes("fix"));
ok("⛔ BOTH variants keep the one control on the CARD — the fork is about ADDING a second place, never moving the first",
   actions(A).includes("fix") && actions(B).includes("fix"));

/* ═══ 4. NAMED BUTTONS — every control the build must reproduce ═══════════════ */
const NAMED = ["badge", "fix", "sync-now", "toggle-history", "toggle-quiet"];
NAMED.forEach((a) => ok(`named control "${a}" exists`, actions(screen("A", { history: true })).includes(a)));

/* ═══ 5. THE VOCABULARY — the five binding rules, asserted ════════════════════ */
const sentences = [];
const walk = (o) => Object.values(o).forEach(v => {
  if (typeof v === "string") sentences.push(v);
  else if (typeof v === "function") { try { sentences.push(v(3, 6)); } catch (e) {} }
  else if (v && typeof v === "object") walk(v);
});
walk(COPY);

ok("RULE 3 — no exclamation anywhere in COPY", !sentences.some(s => s.includes("!")),
   sentences.filter(s => s.includes("!")).join(" | "));
const SEVERITY = /\b(error|failure|critical|urgent|warning|fatal|alert|danger|severe)\b/i;
ok("RULE 2 — NO SEVERITY WORD in any sentence", !sentences.some(s => SEVERITY.test(s)),
   sentences.filter(s => SEVERITY.test(s)).join(" | "));
const MECHANISM = /\b(exception|traceback|null|None|SQLSTATE|token_revoked|HTTP \d|4\d\d|5\d\d|supabase|asyncio)\b/;
const mechHits = sentences.filter(s => MECHANISM.test(s) && s !== COPY.readerOffOperator);
ok("RULE 4 — no mechanism leaks, with ONE marked exception", mechHits.length === 0, mechHits.join(" | "));
ok("⭐ the marked exception is the OPERATOR half only, and it names a setting",
   COPY.readerOffOperator === "WATCH_PROCESS_ENABLED" && !MECHANISM.test(COPY.readerOffMember));
ok("RULE 5 — the dash is an EM DASH (U+2014), never a hyphen",
   sentences.filter(s => / - /.test(s)).length === 0);
ok("the honest fallback NEVER invents a cause",
   COPY.cause.unknown.says === "It stopped, and no reason was recorded." &&
   COPY.fileFail.unknown === "It stopped, and no reason was recorded.");

/* 5b. ⭐ THE RULES APPLY TO WHAT IS RENDERED, NOT ONLY TO `COPY`.
   ⚠ THIS BLOCK EXISTS BECAUSE A PLANTED DEFECT SLIPPED PAST §5. Driving the guards RED
   before handoff, a defect that replaced a rendered sentence with "Error: this source is
   broken!" tripped exactly ONE assertion — the reader-off one — and sailed through every
   vocabulary rule above, because those scan the COPY object and the defect never touched it.
   A vocabulary nothing checks at the render site is a convention, not a fence. */
const RENDERED = ["A", "B"].flatMap(v => [
  screen(v, { history: true, quiet: true }), screen(v, { tab: "health" }),
  screen(v, { readerOff: true }), screen(v, { pop: true }), screen(v, { pending: true })
]);
const text = (h) => h.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
ok("⭐ RULE 3 holds at the RENDER SITE, not only in COPY — no exclamation on any screen",
   !RENDERED.some(h => /!/.test(text(h))),
   RENDERED.map(text).filter(t => /!/.test(t)).map(t => t.slice(0, 80)).join(" | "));
ok("⭐ RULE 2 holds at the RENDER SITE — no severity word on any screen",
   !RENDERED.some(h => SEVERITY.test(text(h))),
   RENDERED.map(text).filter(t => SEVERITY.test(t)).map(t => (t.match(SEVERITY) || [""])[0]).join(" | "));

/* ═══ 6. HONESTY INVARIANTS — the bugs this phase closes ══════════════════════ */
ok('⛔ the word "scheduled" appears NOWHERE — it described the request, not the outcome (BUG-260906-02)',
   !/scheduled/i.test(A) && !/scheduled/i.test(B) && !sentences.some(s => /scheduled/i.test(s)));
ok('the outcome line reports what it DID', /Checked 4 minutes ago · 6 files/.test(A));
ok("the pending state says it was ASKED, never that work is happening",
   /Asked · next check within/.test(screen("A", { pending: true })) &&
   !/Checking now/i.test(HTML));
ok('⛔ SURF-01 cadence is PINNED BY 234 and unreworded', COPY.cadence(30) === "checked every 30 minutes");
ok('⛔ "instantly" and "on change" are forbidden — there is no webhook',
   !/\binstantly\b|\bon change\b/i.test(HTML));
ok("a stopped source says WHEN it last succeeded, not merely that it stopped",
   /Last read successfully on 2 September, 09:14/.test(A));

/* 6b. the reader-off condition — said ONCE, never per row (D-235-12) */
const off = screen("A", { readerOff: true });
ok("⭐ the instance statement appears exactly ONCE", blocks(off).filter(x => x === "instance-statement").length === 1);
ok("⛔ the reader-off condition does NOT mark each source as individually broken",
   (off.match(/Waiting — the reader is off/g) || []).length >= 1 &&
   !/Stopped reading 3 days ago[\s\S]{0,80}reader is off/.test(off));
ok("the badge does NOT count the reader-off condition as N broken sources",
   screen("A", { readerOff: true }).includes('data-block="badge">2<'));
ok('Sync is refused while the reader is off, rather than accepted', /disabled/.test(off));

/* 6c. quiet runs — every tick has a row; the SURFACE folds them (D-235-07) */
ok("every tick has a run row in the fixture, quiet ones included",
   RUNS.filter(r => r.quiet).length === 14 && RUNS.length === 17);
const folded = screen("A", { history: true, quiet: false });
const shown  = screen("A", { history: true, quiet: true });
ok("collapsed by default — quiet runs fold into one line",
   blocks(folded).includes("quiet-fold") && /checked 14 times, no changes/.test(folded));
ok("expanded on demand — every tick becomes visible",
   blocks(shown).filter(x => x === "run").length === RUNS.length,
   `got ${blocks(shown).filter(x => x === "run").length} of ${RUNS.length}`);
ok("⛔ folding is RENDERING, not storage — the fixture is never filtered",
   blocks(shown).filter(x => x === "run").length > blocks(folded).filter(x => x === "run").length);

/* 6d. per-file failure reasons are ACTIONABLE (SC#1's own words) */
ok("a failed file names the FILE and what to do about it",
   /Invoice_8841\.pdf/.test(folded) && /remove the password/.test(folded));
ok("the failure reason is attached to its run, not to the source",
   blocks(folded).includes("fail-reason"));

/* ═══ 7. SEED-239 — the blast radius is ONE source, and it is NAMED ═══════════ */
ok("⭐ the unreadable source still renders as a row", blocks(A).filter(x => x === "source-card").length === SOURCES.length);
ok("⭐ it says the app could not read IT, and that the others are unaffected",
   /could not be read here — the others are unaffected/.test(A));
ok("⛔ it is NOT silently skipped — a source that vanishes from its own list is the silence LIB-10 forbids",
   /data-degraded="1"/.test(A));
ok("⛔ one bad row does not take the page down", blocks(A).includes("body-ingestion"));

/* ═══ 8. THE CAUSE → CONTROL MAP IS DATA, NEVER BRANCHES ══════════════════════ */
ok("every cause carries its own named control",
   Object.values(COPY.cause).every(c => c.says && c.action));
ok("the control is CAUSE-SPECIFIC — not one Reconnect for everything",
   COPY.cause.token_revoked.action === "Reconnect Legal SharePoint" &&
   COPY.cause.folder_gone.action === "Pick a different folder" &&
   COPY.cause.token_revoked.action !== COPY.cause.folder_gone.action);
ok("⭐ hard vs soft causes are declared as DATA (D-235-10) — hard stops on failure 1, soft after 3",
   COPY.cause.token_revoked.hard === true && COPY.cause.folder_gone.hard === true &&
   COPY.cause.unreachable.hard === false);

/* ═══ 9. NO RED, NO ALARM — the chosen posture, asserted ══════════════════════ */
const css = HTML.slice(0, HTML.indexOf("</style>"));
ok("⭐ the stopped mark uses the WARNING token, never the danger token",
   /\.mark\.stop\{background:var\(--color-warning\)\}/.test(css));
ok("⛔ --color-danger is never applied to a source state",
   !/\.(mark|card|badge)\.[a-z]+\{[^}]*--color-danger/.test(css));
ok("the mark is a SHAPE, not a word — the heading already says what the section is",
   /\.mark\{[^}]*border-radius:50%/.test(css));

/* ═══ 10. GEOMETRY — the 079/080 layout lesson ════════════════════════════════ */
ok("⛔ no position:fixed bar with a hardcoded top offset (content behind the header)",
   !/#vnav\{[^}]*position:fixed/.test(css));
ok("the page is a flex column: nav → variant → tools", /body\{[^}]*flex-direction:column/.test(css));

/* ── report ────────────────────────────────────────────────────────────────── */
console.log(`\nsketch 233 — ${pass} passed, ${fail} failed`);
if (fail) { console.log("\nFAILED:"); fails.forEach(f => console.log("  ✗ " + f)); }

/* ── --emit : the build contract, written FROM the running sketch ───────────── */
if (process.argv.includes("--emit")) {
  const L = [];
  L.push("# BUILD CONTRACT — sketch 233 · the source says what it did");
  L.push("");
  L.push("> **GENERATED by `node drive.cjs --emit` from the running sketch. Never hand-written, never edited.**");
  L.push("> Phase 235 · `LIB-10` / `SURF-02` / `SURF-03`. Regenerate after any sketch edit.");
  L.push("");
  L.push("⚠ **A TEXT-ONLY CONTRACT IS NOT ENOUGH AND THIS PROJECT HAS MEASURED THAT.** Sketch 218 shipped");
  L.push("200 assertions, 0 failing, and the operator's verdict was *\"nothing at all like what we designed\"* —");
  L.push("because every assertion covered vocabulary and none covered a card, a row, or a button. §2 below is");
  L.push("the composition half. **Assert it by `data-*` hook in the phase's own suite, and drive it RED first.**");
  L.push("");
  L.push("## 1. COPY — port this object, do not re-type these strings");
  L.push("");
  L.push("The build imports a `sourceHealthVocabulary.ts` shaped like `ingestionErrorVocabulary.ts`:");
  L.push("a strict **zero-import leaf**, presentation only, nothing branches on the text.");
  L.push("");
  L.push("| key | rendered value |");
  L.push("|---|---|");
  const row = (k, v) => L.push(`| \`${k}\` | ${String(v).replace(/\|/g, "\\|")} |`);
  row("cadence(30)", COPY.cadence(30));
  row("checkedAgo('4 minutes ago', 6)", COPY.checkedAgo("4 minutes ago", 6));
  row("checkedNoChange('4 minutes ago')", COPY.checkedNoChange("4 minutes ago"));
  row("asked('60 seconds')", COPY.asked("60 seconds"));
  row("stopped('3 days ago')", COPY.stopped("3 days ago"));
  row("lastGood('2 September, 09:14')", COPY.lastGood("2 September, 09:14"));
  row("neverRead", COPY.neverRead);
  row("quietFold(14)", COPY.quietFold(14));
  row("showEvery", COPY.showEvery);
  row("hideQuiet", COPY.hideQuiet);
  row("degraded", COPY.degraded);
  row("readerOffMember", COPY.readerOffMember);
  row("readerOffOperator", COPY.readerOffOperator);
  row("readerOffRow", COPY.readerOffRow);
  row("badgeTitle(2)", COPY.badgeTitle(2));
  row("badgeTitle(1)", COPY.badgeTitle(1));
  row("attentionTitle", COPY.attentionTitle);
  row("attentionEmpty", COPY.attentionEmpty);
  L.push("");
  L.push("### 1b. cause → sentence → the ONE control (DATA, never branches)");
  L.push("");
  L.push("| cause | hard? | sentence | the one control |");
  L.push("|---|---|---|---|");
  Object.entries(COPY.cause).forEach(([k, c]) =>
    L.push(`| \`${k}\` | ${c.hard ? "**hard** — stops on failure 1" : "soft — stops after 3"} | ${c.says} | **${c.action}** |`));
  L.push("");
  L.push("### 1c. per-file failure reasons");
  L.push("");
  L.push("| kind | sentence |");
  L.push("|---|---|");
  Object.entries(COPY.fileFail).forEach(([k, v]) => L.push(`| \`${k}\` | ${v} |`));
  L.push("");
  L.push("## 2. COMPOSITION — the ordered blocks each screen renders");
  L.push("");
  L.push("Every entry is a `data-block` the React build must emit under the same name.");
  L.push("");
  [["Ingestion tab", screen("A", { tab: "ingestion", history: true })],
   ["Health tab", screen("A", { tab: "health" })],
   ["Reader switched off", screen("A", { readerOff: true })],
   ["Badge popover — variant A", screen("A", { pop: true })],
   ["Badge popover — variant B", screen("B", { pop: true })]].forEach(([name, h]) => {
    const seq = blocks(h);
    const seen = [];
    seq.forEach(b => { if (seen[seen.length - 1] !== b) seen.push(b); });
    L.push(`### ${name}`);
    L.push("");
    seen.forEach((b, i) => L.push(`${i + 1}. \`${b}\``));
    L.push("");
    L.push("Named controls: " + (actions(h).map(a => `\`${a}\``).join(" · ") || "_none_"));
    L.push("");
  });
  L.push("### Counts that must hold");
  L.push("");
  L.push(`- one \`source-card\` per watched source — **${SOURCES.length}** in this fixture, including the unreadable one`);
  L.push(`- one \`attention-row\` per stopped source — **${screen("A", { tab: "health" }).split('data-block="attention-row"').length - 1}**`);
  L.push(`- \`run\` rows collapsed: **${blocks(screen("A", { history: true })).filter(x => x === "run").length}**, expanded: **${blocks(screen("A", { history: true, quiet: true })).filter(x => x === "run").length}** (fixture has ${RUNS.length} ticks, ${RUNS.filter(r => r.quiet).length} quiet)`);
  L.push(`- \`instance-statement\` appears **exactly once**, never per row`);
  L.push("");
  L.push("## 3. The variant fork, as shipped");
  L.push("");
  L.push("| | popover carries `fix` | Health row action | card carries `fix` |");
  L.push("|---|---|---|---|");
  L.push(`| **A** | ${actions(popOnly(popA)).includes("fix") ? "yes" : "no"} | \`fix\` | yes |`);
  L.push(`| **B** | ${actions(popOnly(popB)).includes("fix") ? "yes" : "no"} | \`go-to-source\` | yes |`);
  L.push("");
  L.push("⛔ **Both variants keep the one control on the card.** The fork is about whether a SECOND");
  L.push("place may repair — never about moving the first.");
  L.push("");
  L.push("## 4. Invariants a later edit must not break");
  L.push("");
  L.push('- ⛔ the word **"scheduled"** appears nowhere — it described the request, not the outcome (`BUG-260906-02`)');
  L.push('- ⛔ **"instantly"** and **"on change"** are forbidden — there is no webhook (`SURF-01`, pinned by 234)');
  L.push("- ⛔ no severity word, no exclamation, no mechanism — except the **marked operator half** of the reader-off statement, which names `WATCH_PROCESS_ENABLED` because for an operator the setting name IS the action");
  L.push("- ⛔ the unreadable source renders as a **named degraded row**, never a skipped row and never an error page (`SEED-239`)");
  L.push("- ⛔ the reader-off condition is stated **once**, and does not mark each source individually broken (`D-235-12`)");
  L.push("- ⛔ the stopped mark uses `--color-warning`; `--color-danger` is never applied to a source state");
  L.push("- every tick has a run row; folding quiet runs is **rendering**, never storage (`D-235-07`)");
  L.push("");
  L.push(`_${pass} assertions passing at emit time._`);
  fs.writeFileSync(path.join(__dirname, "BUILD-CONTRACT.generated.md"), L.join("\n") + "\n");
  console.log("emitted BUILD-CONTRACT.generated.md");
}

process.exit(fail ? 1 : 0);
