/* Headless drive for sketch 163 — the acceptance bar. Also EMITS the build contract. */
const path = require("path");
const fs = require("fs");
const JSDOM_DIR = "C:/Vibe Apps/Agentic RAG/frontend/node_modules/jsdom";
const { JSDOM, VirtualConsole } = require(JSDOM_DIR);

const FILE = "C:/Vibe Apps/Agentic RAG/.planning/sketches/163-the-assembled-card/index.html";
const dir = path.dirname(FILE);
let html = fs.readFileSync(FILE, "utf8");
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) =>
  "<script>" + fs.readFileSync(path.resolve(dir, src), "utf8") + "</script>");
const errs = [];
const vc = new VirtualConsole()
  .on("jsdomError", (e) => errs.push("jsdomError: " + e.message))
  .on("error", (e) => errs.push("error: " + e));
const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom, doc = window.document;
const $ = (s) => doc.querySelector(s), $$ = (s) => Array.from(doc.querySelectorAll(s));
const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
const input = (el, v) => { el.value = v; el.dispatchEvent(new window.Event("input", { bubbles: true })); };

const results = [];
function check(name, fn) {
  try { const v = fn(); results.push([v === true ? "PASS" : "FAIL", name, v === true ? "" : String(v)]); }
  catch (e) { results.push(["ERR", name, e.message]); }
}
const tabs = $$(".variant-tab");
const tab = (v) => tabs.find((t) => t.getAttribute("data-v") === v);

check("163: 3 tabs", () => tabs.length === 3 || `got ${tabs.length}`);
click(tab("assembled"));
check("assembled: 107 cards", () => $$(".card").length === 107 || `got ${$$(".card").length}`);
check("assembled: every card keeps all 5 soul atoms", () => {
  const bad = $$(".card").filter((c) =>
    !(c.querySelector(".purpose") && c.querySelector(".spine") && c.querySelector(".tier") && c.querySelector(".soulfoot")));
  return bad.length === 0 || `${bad.length} missing`;
});
check("assembled: exactly ONE sentence node per runnable card, ZERO on drafts", () => {
  const bad = $$(".card").filter((c) => {
    const n = c.querySelectorAll('[data-testid="fork-consequence"]').length;
    return c.classList.contains("is-draft") ? n !== 0 : n !== 1;
  });
  return bad.length === 0 || `${bad.length} wrong`;
});
check("assembled: the sentence text is UNCHANGED from shipped", () => {
  const p = $('[data-testid="fork-consequence"]');
  return p.textContent === window.LIB192.FORK_CONSEQUENCE || `got "${p.textContent}"`;
});
check("assembled: identity line on every card (quiet mode)", () =>
  $$('[data-testid="row-identity"]').length === 107 || `got ${$$('[data-testid="row-identity"]').length}`);
check("assembled: NEVER more than 2 computed segments", () => {
  const bad = $$('[data-testid="row-identity"]').filter((l) => l.querySelectorAll(".seg").length > 2);
  return bad.length === 0 || `${bad.length} lines with >2 segments`;
});
check("assembled: '1 of N' appears ONLY on colliding names", () => {
  const withOf = $$('[data-testid="row-identity"]').filter((l) => l.querySelector(".ofn")).length;
  return withOf === 94 || `got ${withOf} (expected the 94 rows under a duplicated name)`;
});
check("assembled: unique-name rows carry NO discriminator segment", () => {
  const solo = $$('[data-testid="row-identity"]').filter((l) => !l.querySelector(".ofn"));
  const bad = solo.filter((l) => l.querySelectorAll(".seg").length > 0 &&
    !/Copy of|v\d+ of/.test(l.textContent));
  return bad.length === 0 || `${bad.length} unique rows carrying a discriminator`;
});
check("assembled: identity lines are COMPUTED, not templated", () => {
  const t = new Set($$('[data-testid="row-identity"]').map((l) => l.textContent));
  return t.size > 20 || `only ${t.size} distinct lines`;
});
check("assembled: identity line sits at DOM position 2, above the folder chip", () => {
  const bad = $$(".card").filter((c) => {
    const kids = Array.from(c.querySelector(".left").children);
    const iIdx = kids.findIndex((k) => k.getAttribute("data-testid") === "row-identity");
    const fIdx = kids.findIndex((k) => k.classList.contains("folder"));
    if (iIdx === -1) return false;
    return !(iIdx === 1 && (fIdx === -1 || fIdx > iIdx));
  });
  return bad.length === 0 || `${bad.length} cards with the line out of order`;
});
check("assembled: no draft exposes a Run affordance", () => {
  const bad = $$(".card.is-draft").filter((c) => c.querySelector('[data-testid="published-run"]'));
  return bad.length === 0 || `${bad.length}`;
});
check("assembled: the two fork testids stay DISTINCT", () => {
  click(tab("assembled"));
  const a = $$('[data-testid="published-tweak"]').length, b = $$('[data-testid="use-starter"]').length;
  return (a > 0 && b > 0) || `published-tweak=${a} use-starter=${b}`;
});
check("assembled: no owner display NAME leaks (Yours/Shared only)", () => {
  const owns = new Set($$('[data-testid="row-identity"] .own').map((o) => o.textContent));
  return (owns.size <= 2 && [...owns].every((o) => o === "Yours" || o === "Shared")) || `got ${[...owns]}`;
});

// the singleton toggle
check("toggle: 'absent' removes the line from unique-name rows only", () => {
  const sel = doc.getElementById("soloSel");
  sel.value = "absent"; sel.dispatchEvent(new window.Event("change", { bubbles: true }));
  const n = $$('[data-testid="row-identity"]').length;
  sel.value = "quiet"; sel.dispatchEvent(new window.Event("change", { bubbles: true }));
  const back = $$('[data-testid="row-identity"]').length;
  return (n < 107 && n >= 94 && back === 107) || `absent=${n} quiet=${back}`;
});

// 162-B dialog
check("162-B: the fork menu item opens the name prompt", () => {
  click($(".card .kebab"));
  const item = $('[data-testid="published-tweak"], [data-testid="use-starter"]');
  if (!item) return "no fork item";
  click(item);
  return $("#scrim").classList.contains("open") || "dialog did not open";
});
check("162-B: OK is disabled until named", () => doc.getElementById("dlgOk").disabled === true || "not disabled");
check("162-B: a colliding name WARNS but does NOT block", () => {
  input(doc.getElementById("dlgInput"), "Compliance Gap Report");
  const h = doc.getElementById("dlgHint");
  return (/not be able to tell them apart/.test(h.textContent) && doc.getElementById("dlgOk").disabled === false) ||
    `hint="${h.textContent}" disabled=${doc.getElementById("dlgOk").disabled}`;
});
check("162-B: a free name confirms", () => {
  input(doc.getElementById("dlgInput"), "Q3 EU gap review");
  return /No other workflow/.test(doc.getElementById("dlgHint").textContent) ||
    doc.getElementById("dlgHint").textContent;
});
check("162-B: the dialog states the fork consequence VERBATIM", () =>
  doc.getElementById("dlgConseq").textContent === window.LIB192.FORK_CONSEQUENCE ||
  `got "${doc.getElementById("dlgConseq").textContent}"`);
check("162-B: the primary button is 'Create my copy', NOT 'Confirm'", () => {
  const t = doc.getElementById("dlgOk").textContent;
  return (t === "Create my copy" && !/confirm/i.test(t)) || `got "${t}"`;
});
check("162-B: creating adds a row under the typed name", () => {
  click(doc.getElementById("dlgOk"));
  const closed = !$("#scrim").classList.contains("open");
  const found = $$(".card .cname .t").some((t) => t.textContent === "Q3 EU gap review");
  return (closed && found) || `closed=${closed} found=${found}`;
});
check("162-B: Escape closes without creating", () => {
  click($(".card .kebab"));
  const item = $('[data-testid="published-tweak"], [data-testid="use-starter"]');
  click(item);
  const before = $$(".card").length;
  doc.getElementById("dlgInput").dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  return (!$("#scrim").classList.contains("open") && $$(".card").length === before) || "escape misbehaved";
});

// today tab = the delta
click(tab("today"));
check("today: NO identity line (the delta is exactly one atom)", () =>
  $$('[data-testid="row-identity"]').length === 0 || `got ${$$('[data-testid="row-identity"]').length}`);
// 108, not 107: the 162-B test above really created a row ("Q3 EU gap review"),
// and it persists across tabs because the library is one dataset. Asserted at the
// exact expected number rather than loosened to >=, so a stray extra row still fails.
check("today: 107 + the 1 row this drive forked = 108, sentence intact", () => {
  const n = $$(".card").length, s = $$('[data-testid="fork-consequence"]').length;
  const forked = $$(".card .cname .t").filter((t) => t.textContent === "Q3 EU gap review").length;
  return (n === 108 && forked === 1 && s > 0) || `cards=${n} forked=${forked} sentences=${s}`;
});

// anatomy tab
click(tab("anatomy"));
check("anatomy: renders the strings table", () => {
  const t = doc.getElementById("surface").textContent;
  return (/FORK_DIALOG_TITLE/.test(t) && /row-identity/.test(t) && /Negative fences/.test(t)) || "table incomplete";
});
check("anatomy: the DOM-order contract names position 2", () =>
  /row-identity/.test(doc.getElementById("surface").textContent) || "missing");

click(tab("assembled"));
check("ZERO hover-only tooltip attributes", () => $$("[title]").length === 0 || `${$$("[title]").length} found`);
check("positive control: [title] selector works", () => {
  const p = doc.createElement("i"); p.setAttribute("title", "x"); doc.body.appendChild(p);
  const ok = $$("[title]").length === 1; p.remove(); return ok || "selector blind";
});
const GAPS = /Not implemented: (Window's scrollTo|window\.matchMedia|window\.scroll)/;
check("no script errors", () => {
  const real = errs.filter((e) => !GAPS.test(e));
  return real.length === 0 || real.join(" | ");
});

const pass = results.filter((r) => r[0] === "PASS").length;
results.forEach((r) => console.log(`${r[0].padEnd(5)} ${r[1]}${r[2] ? "  → " + r[2] : ""}`));
console.log(`\n${pass}/${results.length} passed`);

/* ── EMIT THE BUILD CONTRACT from the RUNNING sketch ─────────────────────── */
if (process.argv[2] === "--emit") {
  const C = window.__SKETCH163.COPY;
  const rows = window.LIB192.rows;
  const strings = Object.keys(C).filter((k) => typeof C[k] === "string")
    .map((k) => `| \`${k}\` | ${JSON.stringify(C[k])} |`).join("\n");
  const fns = Object.keys(C).filter((k) => typeof C[k] === "function")
    .map((k) => {
      const ex = k === "LINEAGE_VERSION_OF" ? C[k](3, 2) : k === "ONE_OF" ? C[k](43) : C[k]("Compliance Gap Report");
      return `| \`${k}(…)\` | ${JSON.stringify(ex)} |`;
    }).join("\n");

  click(tab("assembled"));
  const samples = ["a colliding copy-fork", "a colliding version-fork", "a unique name", "a shared starter"];
  const lines = [];
  const seen = new Set();
  $$(".card").forEach((c) => {
    const idl = c.querySelector('[data-testid="row-identity"]');
    if (!idl) return;
    const key = (idl.querySelector(".ofn") ? "collide" : "unique") + "|" + c.getAttribute("data-provenance");
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(`| ${c.querySelector(".cname .t").textContent} | \`${idl.textContent.replace(/\s+/g, " ").trim()}\` |`);
  });

  fs.writeFileSync(
    "C:/Vibe Apps/Agentic RAG/.planning/sketches/163-the-assembled-card/BUILD-CONTRACT.generated.md",
    `<!-- GENERATED by drive163.cjs --emit from the RUNNING sketch. Do not hand-edit. -->
# Build contract — generated from sketch 163

Extracted from the running mockup, not transcribed. Regenerate with:
\`node drive163.cjs --emit\`

## Exact strings

| Key | Value |
|---|---|
${strings}

## Composed strings

| Key | Example |
|---|---|
${fns}

## Rendered identity lines (one per distinct row shape)

| Workflow | Rendered line |
|---|---|
${lines.join("\n")}

## Measured invariants at 107 rows

| Invariant | Value |
|---|---|
| cards rendered | ${$$(".card").length} |
| identity lines (quiet mode) | ${$$('[data-testid="row-identity"]').length} |
| lines carrying \`1 of N\` | ${$$('[data-testid="row-identity"]').filter((l) => l.querySelector(".ofn")).length} |
| max computed segments on any line | ${Math.max(...$$('[data-testid="row-identity"]').map((l) => l.querySelectorAll(".seg").length))} |
| sentence nodes per runnable card | 1 |
| hover-only tooltip attributes | ${$$("[title]").length} |
| distinct owner words | ${JSON.stringify([...new Set($$('[data-testid="row-identity"] .own').map((o) => o.textContent))])} |
`);
  console.log("\nemitted BUILD-CONTRACT.generated.md");
}
if (pass !== results.length) process.exitCode = 1;
