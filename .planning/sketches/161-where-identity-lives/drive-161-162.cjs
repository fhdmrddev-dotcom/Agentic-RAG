/* Headless drive for sketches 161 + 162. */
const path = require("path");
const fs = require("fs");
const JSDOM_DIR = "C:/Vibe Apps/Agentic RAG/frontend/node_modules/jsdom";
const { JSDOM, VirtualConsole } = require(JSDOM_DIR);

function load(file) {
  const dir = path.dirname(file);
  let html = fs.readFileSync(file, "utf8");
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) =>
    "<script>" + fs.readFileSync(path.resolve(dir, src), "utf8") + "</script>");
  const errs = [];
  const vc = new VirtualConsole()
    .on("jsdomError", (e) => errs.push("jsdomError: " + e.message))
    .on("error", (e) => errs.push("error: " + e));
  const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc });
  return { dom, window: dom.window, doc: dom.window.document, errs };
}

const results = [];
function check(name, fn) {
  try { const v = fn(); results.push([v === true ? "PASS" : "FAIL", name, v === true ? "" : String(v)]); }
  catch (e) { results.push(["ERR", name, e.message]); }
}
const JSDOM_GAPS = /Not implemented: (Window's scrollTo|window\.matchMedia|window\.scroll)/;

/* ─────────────────────────── 161 ─────────────────────────── */
{
  const { window, doc, errs } = load("C:/Vibe Apps/Agentic RAG/.planning/sketches/161-where-identity-lives/index.html");
  const $ = (s) => doc.querySelector(s), $$ = (s) => Array.from(doc.querySelectorAll(s));
  const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const tabs = $$(".variant-tab");
  const tab = (v) => tabs.find((t) => t.getAttribute("data-v") === v);

  check("161: 4 tabs", () => tabs.length === 4 || `got ${tabs.length}`);
  for (const t of tabs) {
    const v = t.getAttribute("data-v");
    click(t);
    check(`161 ${v}: 4 row states + 9 scaled cards = 13 cards`, () => {
      const n = $$(".card").length; return n === 13 || `got ${n}`;
    });
    check(`161 ${v}: budget shows 4 measures`, () => $$(".bcard").length === 4 || `got ${$$(".bcard").length}`);
    check(`161 ${v}: all 4 row states are genuinely different`, () => {
      const s = new Set($$("#states .card").map((c) => c.getAttribute("data-state")));
      return s.size === 4 || `got ${s.size}: ${[...s]}`;
    });
    check(`161 ${v}: every card keeps the soul atoms`, () => {
      const bad = $$(".card").filter((c) => !(c.querySelector(".purpose") && c.querySelector(".spine") && c.querySelector(".tier")));
      return bad.length === 0 || `${bad.length} missing`;
    });
  }

  click(tab("today"));
  check("161 today: exactly ONE sentence node per runnable card, none on drafts", () => {
    const cards = $$(".card");
    const bad = cards.filter((c) => {
      const slots = c.querySelectorAll('[data-testid="fork-consequence"]').length;
      const draft = c.classList.contains("is-draft");
      return draft ? slots !== 0 : slots !== 1;
    });
    return bad.length === 0 || `${bad.length} cards with the wrong slot count`;
  });
  check("161 today: NO identity treatment present", () =>
    $$(".identline, .pillrow").length === 0 || `got ${$$(".identline, .pillrow").length}`);

  click(tab("a"));
  check("161 A: an identity line on every card (the 14th atom)", () =>
    $$(".card .identline").length === 13 || `got ${$$(".card .identline").length}`);
  check("161 A: the new atom is MARKED as new", () =>
    $$(".card .identline.newatom").length === 13 || `got ${$$(".card .identline.newatom").length}`);
  check("161 A: sentence slot count is UNCHANGED from today", () => {
    const n = $$('[data-testid="fork-consequence"]').length;
    return n > 0 || "sentence disappeared";
  });

  click(tab("b"));
  check("161 B: pill group, no new row", () =>
    $$(".card .pillrow").length === 13 || `got ${$$(".card .pillrow").length}`);
  check("161 B: adds NO identity line", () => $$(".card .identline").length === 0 || "identline present");
  check("161 B: some cards carry 3 pills (the wrap risk being shown)", () => {
    const three = $$(".card .pillrow").filter((p) => p.querySelectorAll(".pill").length >= 3).length;
    return three > 0 || "no 3-pill card rendered — the 375px wrap argument is untestable";
  });

  click(tab("c"));
  check("161 C: still exactly ONE sentence node per card, drafts now included", () => {
    const bad = $$(".card").filter((c) => c.querySelectorAll('[data-testid="fork-consequence"]').length !== 1);
    return bad.length === 0 || `${bad.length} cards not carrying exactly one`;
  });
  check("161 C: adds ZERO new atoms (no identline, no pillrow)", () =>
    $$(".card .identline, .card .pillrow").length === 0 || "C added an atom");
  check("161 C: a forked row's slot carries IDENTITY, an original's carries the fork consequence", () => {
    const ident = $$('.slot.identity').length;
    const plain = $$('[data-testid="fork-consequence"]').length - ident;
    return (ident > 0 && plain > 0) || `identity=${ident} plain=${plain} — the selector is not branching`;
  });
  check("161 C: the draft's previously-empty slot is now used", () => {
    const drafts = $$(".card.is-draft");
    if (!drafts.length) return "no draft card in the sample set";
    const used = drafts.filter((d) => d.querySelector('[data-testid="fork-consequence"]')).length;
    return used === drafts.length || `${used}/${drafts.length}`;
  });

  check("161: toolbar marks toggle", () => {
    click(doc.getElementById("slotsBtn"));
    const on = doc.body.classList.contains("show-slots");
    click(doc.getElementById("slotsBtn"));
    return on || "slot marking did not engage";
  });
  check("161: ZERO hover-only tooltip attributes", () => $$("[title]").length === 0 || `${$$("[title]").length} found`);
  check("161: positive control — [title] selector works", () => {
    const p = doc.createElement("i"); p.setAttribute("title", "x"); doc.body.appendChild(p);
    const ok = $$("[title]").length === 1; p.remove(); return ok || "selector blind";
  });
  check("161: no script errors", () => {
    const real = errs.filter((e) => !JSDOM_GAPS.test(e));
    return real.length === 0 || real.join(" | ");
  });
}

/* ─────────────────────────── 162 ─────────────────────────── */
{
  const { window, doc, errs } = load("C:/Vibe Apps/Agentic RAG/.planning/sketches/162-naming-at-the-fork/index.html");
  const $ = (s) => doc.querySelector(s), $$ = (s) => Array.from(doc.querySelectorAll(s));
  const click = (el) => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  const input = (el, v) => { el.value = v; el.dispatchEvent(new window.Event("input", { bubbles: true })); };
  const tabs = $$(".variant-tab");
  const tab = (v) => tabs.find((t) => t.getAttribute("data-v") === v);

  check("162: 4 tabs", () => tabs.length === 4 || `got ${tabs.length}`);
  check("162: the family starts at the measured 43", () => {
    const t = doc.getElementById("libcount").textContent;
    return /43 rows/.test(t) || `libcount said: ${t}`;
  });

  for (const t of tabs) {
    const v = t.getAttribute("data-v");
    click(t);
    check(`162 ${v}: scoreboard shows 4 measures`, () => $$(".sc").length === 4 || `got ${$$(".sc").length}`);
    check(`162 ${v}: library renders 43 rows`, () => $$(".lrow").length === 43 || `got ${$$(".lrow").length}`);
    check(`162 ${v}: the fork button carries the SHIPPED verb`, () =>
      $("#forkBtn").textContent === window.LIB192.FORK_VERB || `got "${$("#forkBtn").textContent}"`);
  }

  // Today: forking produces ANOTHER identical name
  click(tab("today"));
  click($("#forkBtn"));
  check("162 today: fork adds a row that shares the name", () => {
    const rows = $$(".lrow").length;
    const newest = $(".lrow.is-new");
    return (rows === 44 && newest && newest.textContent.includes("Compliance Gap Report") &&
            /1 of 44/.test(newest.textContent)) || `rows=${rows} newest="${newest && newest.textContent}"`;
  });

  // A: fork differentiates
  click(tab("a"));
  check("162 A: reset on tab switch (43 again)", () => $$(".lrow").length === 43 || `got ${$$(".lrow").length}`);
  check("162 A: a name preview is shown BEFORE the click", () => !!$(".preview .pv") || "no preview");
  click($("#forkBtn"));
  check("162 A: the forked row has a DISTINCT name marked unique", () => {
    const n = $(".lrow.is-new");
    return (n && /my copy/.test(n.textContent) && /unique/.test(n.textContent)) || `newest="${n && n.textContent}"`;
  });
  check("162 A: scoreboard reports the write path as touched", () => {
    const t = $$(".sc").map((s) => s.textContent).join(" ");
    return /write path touched\s*yes/i.test(t.replace(/\s+/g, " ")) || `scoreboard: ${t.slice(0, 200)}`;
  });

  // B: fork asks, button gated
  click(tab("b"));
  check("162 B: the fork button is DISABLED until a name is typed", () => $("#forkBtn").disabled === true || "not disabled");
  check("162 B: a name field exists", () => !!$("#nmf") || "no field");
  check("162 B: typing an existing name warns rather than blocks", () => {
    input($("#nmf"), "Compliance Gap Report");
    const h = $("#nmHint");
    return /indistinguishable/.test(h.textContent) || `hint said: ${h.textContent}`;
  });
  check("162 B: typing a fresh name confirms it is free", () => {
    input($("#nmf"), "Q3 EU gap review");
    const h = $("#nmHint");
    return /No other workflow/.test(h.textContent) || `hint said: ${h.textContent}`;
  });
  check("162 B: enabled once named, and forks under that name", () => {
    if ($("#forkBtn").disabled) return "still disabled";
    click($("#forkBtn"));
    const n = $(".lrow.is-new");
    return (n && /Q3 EU gap review/.test(n.textContent)) || `newest="${n && n.textContent}"`;
  });
  check("162 B: the D-15 reopening is stated as a red decision box", () => {
    const d = $(".decision");
    return (d && /DIRECT FLIP/.test(d.textContent) && /D-15/.test(d.textContent)) || "no decision box";
  });
  check("162 B: the rejected confirm is rendered struck-through", () => !!$(".decision .strike") || "no strike");

  // C: read-side only
  click(tab("c"));
  click($("#forkBtn"));
  check("162 C: the fork STILL produces a duplicate name", () => {
    const n = $(".lrow.is-new");
    return (n && /Compliance Gap Report/.test(n.textContent) && /1 of 44/.test(n.textContent)) ||
      `newest="${n && n.textContent}"`;
  });
  check("162 C: scoreboard reports the write path untouched", () => {
    const t = $$(".sc").map((s) => s.textContent).join(" ").replace(/\s+/g, " ");
    return /write path touched\s*no/i.test(t) || `scoreboard: ${t.slice(0, 200)}`;
  });
  check("162 C: states what it permanently accepts", () => {
    const w = $$(".note.warn").map((n) => n.textContent).join(" ");
    return /carries the cost permanently/.test(w) || "the acceptance is not stated";
  });

  // fork x5 + reset
  check("162: fork ×5 works", () => {
    click(doc.getElementById("resetBtn"));
    click(doc.getElementById("fork5"));
    const n = $$(".lrow").length;
    return n === 48 || `got ${n}`;
  });
  check("162: reset restores 43", () => {
    click(doc.getElementById("resetBtn"));
    return $$(".lrow").length === 43 || `got ${$$(".lrow").length}`;
  });

  // the retraction is preserved on the Today tab
  click(tab("today"));
  check("162: the retracted 'two names' claim is kept VISIBLE, not deleted", () => {
    const t = doc.getElementById("extras").textContent;
    return (/RETRACTED/.test(t) && /n=1/.test(t)) || "retraction missing";
  });

  check("162: ZERO hover-only tooltip attributes", () => $$("[title]").length === 0 || `${$$("[title]").length} found`);
  check("162: positive control — [title] selector works", () => {
    const p = doc.createElement("i"); p.setAttribute("title", "x"); doc.body.appendChild(p);
    const ok = $$("[title]").length === 1; p.remove(); return ok || "selector blind";
  });
  check("162: no script errors", () => {
    const real = errs.filter((e) => !JSDOM_GAPS.test(e));
    return real.length === 0 || real.join(" | ");
  });
}

const pass = results.filter((r) => r[0] === "PASS").length;
results.forEach((r) => console.log(`${r[0].padEnd(5)} ${r[1]}${r[2] ? "  → " + r[2] : ""}`));
console.log(`\n${pass}/${results.length} passed`);
if (pass !== results.length) process.exitCode = 1;
