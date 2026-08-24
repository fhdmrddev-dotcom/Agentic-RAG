/* Headless drive for sketch 160 — proves the variants render and the controls work. */
const path = require("path");
const fs = require("fs");
const { JSDOM } = require(path.join("C:/Vibe Apps/Agentic RAG/frontend/node_modules/jsdom"));

const FILE = process.argv[2];
const dir = path.dirname(FILE);
let html = fs.readFileSync(FILE, "utf8");

// inline the fixture <script src> so jsdom needs no resource loader
html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => {
  const p = path.resolve(dir, src);
  return "<script>" + fs.readFileSync(p, "utf8") + "</script>";
});

const errs = [];
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole: new (require(path.join("C:/Vibe Apps/Agentic RAG/frontend/node_modules/jsdom")).VirtualConsole)()
    .on("jsdomError", (e) => errs.push("jsdomError: " + e.message))
    .on("error", (e) => errs.push("error: " + e)),
});
const { window } = dom;
const doc = window.document;
const $ = (s) => doc.querySelector(s);
const $$ = (s) => Array.from(doc.querySelectorAll(s));

const results = [];
function check(name, fn) {
  try { const v = fn(); results.push([v === true ? "PASS" : "FAIL", name, v === true ? "" : String(v)]); }
  catch (e) { results.push(["ERR", name, e.message]); }
}
function click(el) { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }
function change(el, v) { el.value = v; el.dispatchEvent(new window.Event("change", { bubbles: true })); }
function input(el, v) { el.value = v; el.dispatchEvent(new window.Event("input", { bubbles: true })); }

const tabs = $$(".variant-tab");
check("4 variant tabs", () => tabs.length === 4 || `got ${tabs.length}`);
check("fixture loaded", () => !!window.LIB192 || "LIB192 missing");
check("fixture audit: 107 rows / 14 dup names", () => {
  const a = window.LIB192.audit();
  return (a.rows === 107 && a.duplicatedNames === 14) || JSON.stringify(a);
});

// each tab renders a full grid of 107
for (const t of tabs) {
  const v = t.getAttribute("data-v");
  click(t);
  check(`tab ${v}: renders 107 cards`, () => {
    const n = $$(".card").length;
    return n === 107 || `got ${n}`;
  });
  check(`tab ${v}: every card has a primary verb`, () => {
    const bad = $$(".card").filter((c) => !c.querySelector(".btn-run,.btn-open"));
    return bad.length === 0 || `${bad.length} cards without a verb`;
  });
  check(`tab ${v}: no draft exposes a Run affordance`, () => {
    const bad = $$(".card.is-draft").filter((c) => c.querySelector(".btn-run"));
    return bad.length === 0 || `${bad.length} draft cards with Run`;
  });
  check(`tab ${v}: every card keeps all 5 soul atoms`, () => {
    const bad = $$(".card").filter(
      (c) => !(c.querySelector(".purpose") && c.querySelector(".spine") && c.querySelector(".tier") && c.querySelector(".soulfoot"))
    );
    return bad.length === 0 || `${bad.length} cards missing an atom`;
  });
}

// the identity treatments actually differ
click(tabs.find((t) => t.getAttribute("data-v") === "today"));
const todayIdent = $$(".card .lineage, .card .disc, .card .solo").length;
check("Today has NO identity treatment", () => todayIdent === 0 || `got ${todayIdent}`);

click(tabs.find((t) => t.getAttribute("data-v") === "a"));
check("A: 107 lineage lines", () => $$(".card .lineage").length === 107 || `got ${$$(".card .lineage").length}`);
check("A: originals labelled, forks name a parent", () => {
  const orig = $$(".card .lineage .orig").length;
  const of = $$(".card .lineage .of").length;
  return (orig + of === 107 && orig === 27 && of === 80) || `orig=${orig} of=${of}`;
});

click(tabs.find((t) => t.getAttribute("data-v") === "b"));
check("B: singleton names get NO strip (the calm control)", () => {
  const solo = $$(".card .solo").length;
  return solo === 13 || `got ${solo} (expected 13 singletons)`;
});
check("B: colliding rows get a computed strip", () => {
  const disc = $$(".card .disc").length;
  return disc === 94 || `got ${disc} (expected 94 rows under a duplicated name)`;
});
check("B: strips are NOT all identical (computed, not templated)", () => {
  const texts = new Set($$(".card .disc").map((d) => d.textContent));
  return texts.size > 8 || `only ${texts.size} distinct strips`;
});

click(tabs.find((t) => t.getAttribute("data-v") === "c"));
check("C: time buckets appear", () => $$(".timegroup").length >= 2 || `got ${$$(".timegroup").length}`);
check("C: recency is flagged net-new on every row", () => {
  const n = $$(".card .netnew").length;
  return n === 107 || `got ${n}`;
});
check("C: sort control exists", () => $$(".libbar select").length === 2 || `got ${$$(".libbar select").length}`);
check("C: switching sort to name flattens the buckets", () => {
  const sels = $$(".libbar select");
  change(sels[1], "name");
  const tg = $$(".timegroup").length;
  change(sels[1], "recent");
  return tg === 0 || `still ${tg} buckets`;
});

// the SHAPE switch — the point of the sketch
check("shape switch: distinct names removes every duplicate", () => {
  change($("#shapeSel"), "distinct");
  const txt = $("#shapebar").textContent;
  const ok = /duplicated names\s*0/.test(txt.replace(/\s+/g, " ")) || txt.includes("duplicated names 0");
  const dup = txt.replace(/\s+/g, " ");
  change($("#shapeSel"), "real");
  return ok || `shapebar said: ${dup}`;
});

// search + chips + project
click(tabs.find((t) => t.getAttribute("data-v") === "b"));
check("search filters", () => {
  input($(".searchbox input"), "meridian");
  const n = $$(".card").length;
  input($(".searchbox input"), "");
  return (n === 8) || `got ${n} for "meridian" (expected 8)`;
});
check("search: nonsense shows the honest empty state", () => {
  input($(".searchbox input"), "zzzzz");
  const e = !!$(".empty");
  input($(".searchbox input"), "");
  return e || "no empty state rendered";
});
check("chip filters and counts are reachable", () => {
  const chips = $$(".chip");
  if (chips.length !== 6) return `got ${chips.length} chips`;
  click(chips[3]); // Starters
  const n = $$(".card").length;
  click($$(".chip")[3]);
  return n === 3 || `starters chip gave ${n} (expected 3)`;
});
check("project select narrows", () => {
  const sel = $$(".libbar select")[0];
  change(sel, "p-fin");
  const n = $$(".card").length;
  change($$(".libbar select")[0], "");
  return n > 0 && n < 107 || `got ${n}`;
});
check("scale switch to 12", () => {
  change($("#scaleSel"), "12");
  const n = $$(".card").length;
  change($("#scaleSel"), "107");
  return n === 12 || `got ${n}`;
});

// menu opens
check("⋯ menu opens", () => {
  const kb = $(".card .kebab");
  click(kb);
  return !!$(".card .menu.open") || "menu did not open";
});

// the D-14 rule: zero hover-only tooltip attributes anywhere
check("ZERO hover-only tooltip attributes in the rendered DOM", () => {
  const n = $$("[title]").length;
  return n === 0 || `${n} found`;
});
// positive control — prove the selector can find one
check("positive control: the [title] selector DOES find a planted one", () => {
  const p = doc.createElement("span");
  p.setAttribute("title", "planted");
  doc.body.appendChild(p);
  const found = $$("[title]").length === 1;
  p.remove();
  return found || "selector is blind — the fence above proves nothing";
});

// jsdom does not implement window.scrollTo / matchMedia; those are jsdom gaps, not
// sketch defects, so they are excluded BY NAME rather than by silencing the channel.
const JSDOM_GAPS = /Not implemented: (Window's scrollTo|window\.matchMedia|window\.scroll)/;
check("no script errors (jsdom's own unimplemented APIs excluded by name)", () => {
  const real = errs.filter((e) => !JSDOM_GAPS.test(e));
  return real.length === 0 || real.join(" | ");
});
check("positive control: the error channel DOES capture a real throw", () => {
  const before = errs.length;
  const s = doc.createElement("script");
  s.textContent = "throw new Error('planted-error')";
  doc.body.appendChild(s);
  s.remove();
  return errs.length > before || "error channel is deaf — the check above proves nothing";
});

const pass = results.filter((r) => r[0] === "PASS").length;
const fail = results.filter((r) => r[0] !== "PASS");
results.forEach((r) => console.log(`${r[0].padEnd(5)} ${r[1]}${r[2] ? "  → " + r[2] : ""}`));
console.log(`\n${pass}/${results.length} passed`);
if (fail.length) process.exitCode = 1;
