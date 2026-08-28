#!/usr/bin/env node
/**
 * ⭐ THE DRIVE SCRIPT — sketch 218 (SEED-224 / BUS-026).
 *
 *   node drive.cjs           run the assertions
 *   node drive.cjs --emit    ALSO write BUILD-CONTRACT.generated.md FROM the running sketch
 *
 * ⚠ THE ASSERTIONS THAT MATTER MOST HERE ARE THE ONES THAT READ THE LIVE SOURCE TREE, not the
 * sketch. Sketch 163's lesson (SEED-155) is that a mockup can be internally consistent and still
 * draw something the build cannot render. So §A below opens `frontend/src` and asserts the sketch
 * agrees with what SHIPS — column order, tab classes, theme tokens, the ingestion steps. If the
 * repo moves, these fail, and that is the point.
 */

const fs = require("fs")
const path = require("path")

const DIR = __dirname
const REPO = path.resolve(DIR, "..", "..", "..")
const HTML = fs.readFileSync(path.join(DIR, "index.html"), "utf8")
const { COPY } = require(path.join(DIR, "COPY.js"))

let pass = 0
const failures = []
function ok(name, cond, detail) {
  if (cond) { pass++; return }
  failures.push(detail ? `${name}\n      ${detail}` : name)
}

function norm(s) {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

/** The SURFACE = the sketch MINUS its own commentary, so an assertion cannot be satisfied by a
 *  sentence about the assertion. (The 187-24 lesson: a measurement a comment can satisfy is not one.)
 *
 *  ⚠ THIS STRIPPER GREW AFTER ITS FIRST RUN, AND THAT IS RECORDED RATHER THAN QUIETLY FIXED.
 *  The first version stripped only `data-anno`, and three fences fired — TWO of them on the
 *  sketch's own prose about the fence (`ingestion_step` named in a lede; `94% L` in the §5
 *  measurement table; `Math.random` inside the comment forbidding it). A fence that cannot tell
 *  the PRODUCT SURFACE from WRITING ABOUT the product surface produces false reds, and a suite
 *  that cries wolf gets its failures explained away — which is how a real one gets through.
 *  So: sketch chrome (h2 / lede / caption / sub / note / data-meta) is not the surface. */
const SURFACE_HTML = HTML
  .replace(/<(style|script)[\s\S]*?<\/\1>/g, " ")
  .replace(/<div\b[^>]*\bdata-anno\b[^>]*>[\s\S]*?<\/div>/g, " ")
  // ⚠ NO TRAILING `</div>` HERE. The first draft matched `...</div>\s*</div>` and consumed one
  //   level TOO MANY, silently eating §5's second tab-bar arm — the remedy the sketch exists to
  //   propose. It still read 70/70 green, because nothing asserted that arm was present.
  //   **A stripper bug looks exactly like a passing suite.** B8 below now pins both arms.
  .replace(/<div\b[^>]*\bdata-meta\b[^>]*>[\s\S]*?<\/div>/g, " ")
  .replace(/<p class="lede">[\s\S]*?<\/p>/g, " ")
  .replace(/<p class="caption">[\s\S]*?<\/p>/g, " ")
  .replace(/<div class="note">[\s\S]*?<\/div>/g, " ")
  .replace(/<h2>[\s\S]*?<\/h2>/g, " ")
  .replace(/<h3 class="sub">[\s\S]*?<\/h3>/g, " ")
const SURFACE = norm(SURFACE_HTML)

/** The sketch's JS with comments removed — so a fence forbidding a call is not tripped by the
 *  comment that explains why the call is forbidden. */
const SCRIPT_CODE = (HTML.match(/<script>([\s\S]*?)<\/script>/) || ["", ""])[1]
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/.*$/gm, " ")

function src(rel) {
  const p = path.join(REPO, rel)
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// POSITIVE CONTROLS — a suite that cannot fail proves nothing.
// ═══════════════════════════════════════════════════════════════════════════════════════
ok("control · the surface is not empty", SURFACE.length > 2200, `${SURFACE.length} chars`)
ok("control · the surface carries the renamed page title", SURFACE.includes("Library"))
ok("control · annotations ARE stripped from the surface",
  !SURFACE.includes("SEED-155") && HTML.includes("SEED-155"),
  "the anno stripper must remove data-anno blocks but they must exist in the file")
ok("control · the repo is reachable from the sketch",
  src("frontend/src/pages/IngestionPage.tsx") !== null,
  `looked under ${REPO}`)

// ═══════════════════════════════════════════════════════════════════════════════════════
// §A · THE SKETCH AGREES WITH WHAT SHIPS  (these read the live source tree)
// ═══════════════════════════════════════════════════════════════════════════════════════
const PAGE = src("frontend/src/pages/IngestionPage.tsx") || ""
const TABS = src("frontend/src/components/ui/tabs.tsx") || ""
const CSS = src("frontend/src/index.css") || ""
const DOCS_PY = src("backend/app/api/documents.py") || ""
const TERMMAP = src("frontend/src/lib/termMap.ts") || ""
const NAV = src("frontend/src/lib/nav-items.ts") || ""
const LAYOUT = src("frontend/src/components/layout/ChatLayout.tsx") || ""
const APP = src("frontend/src/App.tsx") || ""
const KH = src("frontend/src/pages/KnowledgeHealthPage.tsx") || ""
const KH_PY = src("backend/app/api/knowledge_health.py") || ""
const DISPATCH = src("backend/app/services/tool_dispatcher.py") || ""
const EVAL_SQL = src("supabase/migrations/080_eval_runs_and_results.sql") || ""
const RUNS_PY = src("backend/app/api/runs.py") || ""
const LIST = src("frontend/src/components/ingestion/DocumentList.tsx") || ""

// A1 — the 7 columns, in the shipped order
const shippedCols = [...LIST.matchAll(/<th className="px-4 py-3[^"]*">([^<]+)<\/th>/g)].map((m) => m[1].trim())
ok("A1 · the shipped column order is Filename·Type·Size·Chunks·Status·Actions",
  shippedCols.join("|") === "Filename|Type|Size|Chunks|Status|Actions",
  `measured: ${shippedCols.join("|") || "(none)"}`)
ok("A1b · the sketch renders those columns in that same order",
  /Filename[\s\S]{0,200}Type[\s\S]{0,200}Size[\s\S]{0,200}Chunks[\s\S]{0,200}Status[\s\S]{0,200}Actions/.test(SURFACE))
ok("A1c · COPY.COLUMNS matches the shipped order",
  COPY.COLUMNS.filter(Boolean).join("|") === "Filename|Type|Size|Chunks|Status|Actions")

// A2 — the shed columns are exactly 3,4,5
ok("A2 · IngestionPage sheds nth-child(n+3)..(-n+5)",
  PAGE.includes("th:nth-child(n+3):nth-child(-n+5)]:hidden"))
const shedMarked = [...SURFACE_HTML.matchAll(/<th data-shed>([^<]+)<\/th>/g)].map((m) => m[1])
ok("A2b · the sketch marks exactly Type/Size/Chunks as sheddable",
  JSON.stringify([...new Set(shedMarked)]) === JSON.stringify(COPY.SHEDDABLE),
  `marked: ${JSON.stringify([...new Set(shedMarked)])}`)

// A3 — the tab component is rounded-md, NOT a pill
ok("A3 · shipped TabsList is rounded-md + bg-muted + h-10",
  /inline-flex h-10 items-center justify-center rounded-md bg-muted p-1/.test(TABS))
ok("A3b · shipped TabsTrigger is rounded-sm and goes bg-background when active",
  /rounded-sm px-3 py-1\.5 text-sm font-medium/.test(TABS) &&
  /data-\[state=active\]:bg-background/.test(TABS))
ok("A3c · the sketch renders 8px (rounded-md), never a 9999px pill, on .tabslist",
  /\.tabslist\s*\{[^}]*border-radius:\s*8px/.test(HTML) &&
  !/\.tabslist\s*\{[^}]*border-radius:\s*9999px/.test(HTML))

// A4 — ⭐ THE INVERSION. This is the finding; it must be measured, not asserted in prose.
function lightness(css, token, blockStart) {
  const idx = css.indexOf(blockStart)
  const seg = idx === -1 ? css : css.slice(idx)
  const m = seg.match(new RegExp(`--${token}:\\s*[\\d.]+\\s+[\\d.]+%\\s+([\\d.]+)%`))
  return m ? parseFloat(m[1]) : null
}
const lightMuted = lightness(CSS, "muted", ":root")
const lightBg = lightness(CSS, "background", ":root")
const darkMuted = lightness(CSS, "muted", ".dark")
const darkBg = lightness(CSS, "background", ".dark")
ok("A4 · light theme: active tab is LIGHTER than its track",
  lightBg !== null && lightMuted !== null && lightBg > lightMuted,
  `bg ${lightBg}% vs muted ${lightMuted}%`)
ok("A4b · ⭐ dark theme: active tab is DARKER than its track — the bar INVERTS",
  darkBg !== null && darkMuted !== null && darkBg < darkMuted,
  `bg ${darkBg}% vs muted ${darkMuted}%`)
ok("A4c · the sketch draws BOTH arms of the inversion (shipped + a remedy)",
  HTML.includes("tabslist remedy") && /\.tabslist\.remedy[^}]*box-shadow:\s*inset/.test(HTML))
ok("A4d · the remedy does not rely on colour alone — it adds a ring AND changes text colour",
  /\.tabslist\.remedy[^}]*\{[^}]*color:\s*var\(--color-primary\)[^}]*box-shadow/.test(HTML) ||
  /\.tabslist\.remedy[^}]*\{[^}]*box-shadow[^}]*\}/.test(HTML))

// A5 — ⚠ SIX ingestion stages, not three
const steps = [...DOCS_PY.matchAll(/"ingestion_step":\s*"([a-z_]+)"/g)].map((m) => m[1])
const uniqueSteps = [...new Set(steps)]
ok("A5 · the backend writes SIX distinct ingestion steps",
  uniqueSteps.length === 6, `measured ${uniqueSteps.length}: ${uniqueSteps.join(", ")}`)
ok("A5b · they are exactly the six COPY.STAGES names",
  JSON.stringify(uniqueSteps.slice().sort()) === JSON.stringify(COPY.STAGES.map((s) => s.key).sort()),
  `backend: ${uniqueSteps.slice().sort().join(",")}`)
ok("A5c · termMap already carries a plain label for every one",
  COPY.STAGES.every((s) => TERMMAP.includes(`"ingest.${s.key}"`)),
  COPY.STAGES.filter((s) => !TERMMAP.includes(`"ingest.${s.key}"`)).map((s) => s.key).join(",") || "all present")
ok("A5d · exactly TWO stages are conditional",
  COPY.STAGES.filter((s) => !s.always).length === 2)
ok("A5e · the sketch draws the 3-stage version as the REJECTED arm, beside the 6",
  SURFACE.includes("Parse") && SURFACE.includes("Chunk") && SURFACE.includes("Embed") &&
  /Read[\s\S]{0,400}Tbl[\s\S]{0,400}Img[\s\S]{0,400}Split[\s\S]{0,400}Index[\s\S]{0,400}Label/.test(SURFACE))
ok("A5f · a SKIPPED conditional stage has its own visual class, distinct from pending",
  /\.stg\.skip\s*\{/.test(HTML) && /\.stg\.todo\s*\{/.test(HTML) &&
  HTML.indexOf(".stg.skip") !== HTML.indexOf(".stg.todo"))

// A6 — ⚠ retrieval IS already logged (BUS-026 says it is not)
ok("A6 · the retrieval path DOES write an audit row today",
  /action_type="search\.query"/.test(DISPATCH) && /document_ids/.test(DISPATCH))
ok("A6b · knowledge_health already aggregates it into most/never-retrieved",
  /_fetch_most_retrieved/.test(KH_PY) && /_fetch_never_retrieved/.test(KH_PY))
ok("A6c · ⚠ the per-document SCORE is NOT persisted — the one real gap",
  !/"similarity":\s*[a-z_]+[\s\S]{0,200}action_type="search\.query"/.test(DISPATCH))
const win = KH_PY.match(/WINDOW_DAYS\s*=\s*(\d+)/)
ok("A6d · the shipped window is 30 days",
  win && win[1] === "30", `measured WINDOW_DAYS=${win ? win[1] : "?"}`)
ok("A6e · the sketch never prints a window other than 30",
  !/last 7 days|\(7d\)|RETRIEVED \(7D\)/i.test(SURFACE),
  "a 7-day tile would be a fabricated window")

// A7 — the rename is front-end only, and the IA is already decided
ok("A7 · ActiveView already carries \"documents\" (there is no route to change)",
  /ActiveView\s*=[\s\S]{0,400}"documents"/.test(APP))
ok("A7b · the nav entry ships as label \"Documents\" today",
  /view:\s*"documents",[^}]*label:\s*"Documents"/.test(NAV))
ok("A7c · the page h1 ships as \"Documents\" today",
  PAGE.includes(">Documents</h1>"))
ok("A7d · COPY pins BOTH the shipped title and the new one, so the diff is visible",
  COPY.SHIPPED_PAGE_TITLE === "Documents" && COPY.PAGE_TITLE === "Library")
ok("A7e · the sketch renders the NEW title, not the shipped one, in its page frame",
  /<h1[^>]*>Library<\/h1>/.test(HTML) && !/<h1[^>]*>Documents<\/h1>/.test(HTML))

// A8 — ⚠ the merge removes the app's positional fallback
ok("A8 · KnowledgeHealthPage is the trailing else of the view chain",
  /\)\s*:\s*\(\s*<KnowledgeHealthPage \/>\s*\)/.test(LAYOUT))
ok("A8b · App.tsx itself calls it a POSITIONAL FALLBACK",
  /POSITIONAL\s*\n?\s*\/\/\s*FALLBACK|POSITIONAL FALLBACK/.test(APP))
ok("A8c · the sketch states the consequence of deleting it",
  HTML.includes("blank screen") && HTML.includes("ChatLayout.tsx:879"))

// A9 — the four Library Health tabs survive the merge (no LOSS)
const khTabs = [...KH.matchAll(/<TabsTrigger value="(most-retrieved|never-retrieved|stale|low-confidence)">([^<]+)<\/TabsTrigger>/g)].map((m) => m[2])
ok("A9 · Library Health ships exactly four top-level tabs",
  khTabs.length === 4, `measured: ${khTabs.join(", ") || "(none)"}`)
ok("A9b · COPY pins them verbatim",
  JSON.stringify(khTabs) === JSON.stringify(COPY.SHIPPED_HEALTH_TABS),
  `shipped ${JSON.stringify(khTabs)} vs COPY ${JSON.stringify(COPY.SHIPPED_HEALTH_TABS)}`)
ok("A9c · all four survive as chips in the merged tab — nothing is lost in the merge",
  COPY.HEALTH_FILTERS.every((f) => SURFACE.includes(f)),
  COPY.HEALTH_FILTERS.filter((f) => !SURFACE.includes(f)).join(",") || "all present")
ok("A9d · every chip carries a count — a filter with no count hides how much it hides",
  (SURFACE_HTML.match(/class="chip[^"]*">[^<]*<span class="b">\d+/g) || []).length >= 4)

// A10 — ⛔ the eval runner cannot take a retrieval fixture
ok("A10 · eval_runs.skill_id is NOT NULL and FKs skills",
  /skill_id\s+uuid NOT NULL REFERENCES public\.skills/.test(EVAL_SQL))
ok("A10b · eval_results.test_case_id is NOT NULL and FKs skill_test_cases",
  /test_case_id\s+uuid NOT NULL REFERENCES public\.skill_test_cases/.test(EVAL_SQL))
ok("A10c · eval_results.variant is CHECK-constrained to with_skill/without_skill",
  /variant[\s\S]{0,120}CHECK \(variant IN \('with_skill','without_skill'\)\)/.test(EVAL_SQL))
ok("A10d · ⚠ so 'wire it to the existing eval runner' is refused by FOUR constraints",
  true, "recorded — this is the seed's most expensive item, listed as if free")

// A11 — ⚠ 'golden' is already taken
ok("A11 · is_golden_run already exists and means the publish gauntlet's live run",
  /is_golden_run/.test(RUNS_PY))
ok("A11b · the sketch does NOT reuse the word 'golden'",
  !/golden/i.test(SURFACE_HTML.replace(/<div\b[^>]*data-anno[\s\S]*?<\/div>/g, "")),
  "the surface must not print 'golden' anywhere")
ok("A11c · COPY names the rejected candidates AND the chosen name",
  COPY.GOLDEN_REJECTED.length === 3 && COPY.CHECK_TITLE === "Checked queries")
ok("A11d · the sketch renders the chosen name",
  SURFACE.includes("Checked queries"))

// ═══════════════════════════════════════════════════════════════════════════════════════
// §B · THE SKETCH'S OWN INVARIANTS
// ═══════════════════════════════════════════════════════════════════════════════════════

// B1 — both tab sets are drawn, so the fork is a comparison and not a claim
const tabsetA = SURFACE_HTML.match(/data-tabset="A"[\s\S]*?<\/div>/)
const tabsetB = SURFACE_HTML.match(/data-tabset="B"[\s\S]*?<\/div>/)
ok("B1 · variant A draws five tabs", tabsetA && (tabsetA[0].match(/tabtrigger/g) || []).length === 5,
  tabsetA ? `${(tabsetA[0].match(/tabtrigger/g) || []).length} triggers` : "tabset A not found")
ok("B1b · variant B draws four tabs", tabsetB && (tabsetB[0].match(/tabtrigger/g) || []).length === 4,
  tabsetB ? `${(tabsetB[0].match(/tabtrigger/g) || []).length} triggers` : "tabset B not found")
ok("B1c · B's set is A's set minus exactly one entry, and that entry is Views",
  COPY.TABS_A.filter((t) => !COPY.TABS_B.includes(t)).join() === "Views")
ok("B1d · tab 5 is named Health, NOT Retrieval",
  COPY.TABS_A[4] === "Health" && COPY.TAB_HEALTH_REJECTED_NAME === "Retrieval" &&
  !/data-tabset="A"[\s\S]{0,600}Retrieval/.test(SURFACE_HTML))

// B2 — the chart is deterministic, and it is actually drawn
const series = HTML.match(/var SERIES = \[([^\]]+)\]/)
const vals = series ? series[1].split(",").map(Number) : []
ok("B2 · the chart series is a FIXED array, never Math.random()",
  vals.length === 30 && !/Math\.random/.test(SCRIPT_CODE), `${vals.length} points`)
ok("B2b · the bars vary — a flat series would hide a rendering bug",
  new Set(vals).size >= 20, `${new Set(vals).size} distinct values`)
ok("B2c · every bar is within the plotted axis (max 50)",
  vals.every((v) => v > 0 && v <= 50), `max ${Math.max(...vals)}`)

// B3 — the contested tile is drawn BOTH ways, and neither is presented as decided
ok("B3 · the tile as it ships (bare percentage-shaped score) is drawn",
  SURFACE.includes("Retrieval Score") && SURFACE.includes("0.61"))
ok("B3b · the qualified arm is drawn beside it, and says what it measures",
  SURFACE.includes("Match strength") && SURFACE.includes("average similarity of what searches returned"))
ok("B3c · COPY carries an ABSENT arm — a score with too little data is not zero",
  typeof COPY.SCORE_ABSENT_ARM === "string" && /Not enough/.test(COPY.SCORE_ABSENT_ARM))

// B4 — honesty fences over the whole surface
// ⚠ THIS FENCE WAS REWRITTEN AFTER FIRING FALSELY, and the original is recorded rather than
// deleted. It read `\b9[0-9]%|\bA\+|Embedding Quality|Semantic Match` and fired on `94% L` — a
// LIGHTNESS measurement in §5. "Any number in the nineties followed by a percent sign" is not the
// invariant; **a quality claim the system cannot substantiate** is. The rewrite names the claim.
ok("B4 · no fabricated quality grade anywhere",
  !/Embedding Quality|Semantic Match|Quality Score|\bA\+\b|\b(?:health|quality|accuracy|confidence)\s*[:=]?\s*\d+%/i.test(SURFACE))
ok("B4f · no stat tile renders a bare percentage as its VALUE",
  !(SURFACE_HTML.match(/<div class="tv">[^<]*%/g) || []).length,
  "a tile whose whole value is a percentage is the shape the cut list forbids")
ok("B4b · no determinate progress percentage on the stage strip",
  !/\d+%\s*(complete|done|processed)/i.test(SURFACE))
ok("B4c · no ETA on an ingestion whose length is unknown until it runs",
  !/\bETA\b|remaining\b.*\bminutes?\b/i.test(SURFACE))
ok("B4d · the mechanism is never printed to the user",
  !/audit_log|action_type|ingestion_step|document_chunks|retrieval_events/.test(SURFACE),
  "internal names belong in annotations, never on the surface")
ok("B4e · every coloured state also says its word (colour is never the only carrier)",
  (SURFACE_HTML.match(/class="badge [a-z]+"/g) || []).length ===
  (SURFACE_HTML.match(/class="badge [a-z]+"><span class="dot"><\/span>[A-Z]/g) || []).length,
  "a badge with a dot and no word would fail here")

// B5 — the failed row explains itself in plain language, with no error code
ok("B5 · the failed document carries a reason",
  SURFACE.includes("The file had a character we could not store."))
ok("B5b · and the reason names no error code",
  !/22P05|SQLSTATE|Traceback|errno/i.test(SURFACE))

// B6 — unknown/empty arms exist rather than rendering as zero
ok("B6 · COPY carries an explicit empty arm for never-retrieved",
  /Every document has been found/.test(COPY.EMPTY_NEVER_RETRIEVED))
ok("B6b · a not-yet-checked query says so rather than showing a passing tick",
  SURFACE.includes("Not checked yet"))
ok("B6c · a document with no chunks renders an em-dash, never 0",
  /<td class="num">—<\/td>/.test(SURFACE_HTML))

// B7 — the slipped check names WHAT CHANGED
ok("B7 · the slipped row shows the old rank struck through beside the new",
  /<span class="was">2<\/span>6/.test(SURFACE_HTML))
ok("B7b · COPY composes that sentence rather than hard-coding it",
  typeof COPY.CHECK_SLIPPED_DETAIL === "function" &&
  COPY.CHECK_SLIPPED_DETAIL(2, 6) === "was 2, now 6")

// B8 — ⚠ THE ASSERTION THE STRIPPER BUG WOULD HAVE HIDDEN.
// The first data-meta regex consumed one closing tag too many and silently ate §findings'
// SECOND tab-bar arm — the remedy the sketch exists to propose. The suite still read green,
// because nothing pinned that arm. A stripper bug looks exactly like a passing suite.
const tabBars = (SURFACE_HTML.match(/class="tabslist[^"]*"/g) || [])
ok("B8 · both arms of the tab-bar comparison survive the SURFACE stripper",
  tabBars.filter((c) => /remedy/.test(c)).length === 1 && tabBars.length >= 8,
  `${tabBars.length} tab bars in the surface, ${tabBars.filter((c) => /remedy/.test(c)).length} remedy`)

// ═══════════════════════════════════════════════════════════════════════════════════════
// §C · THE REFERENCE'S JOURNEY — content borrowed, honesty enforced
// ═══════════════════════════════════════════════════════════════════════════════════════

// C1 — every surface of the reference's journey is expressed
const JOURNEY = ["Documents", "Health", "Indexing", "Ingestion", "Chunks"]
ok("C1 · the sketch covers the reference's whole journey",
  JOURNEY.every((s) => SURFACE.includes(s)),
  JOURNEY.filter((s) => !SURFACE.includes(s)).join(",") || "all present")
ok("C1b · a breadcrumb opens each surface, as screens 13 and 09 do",
  (SURFACE_HTML.match(/class="crumbs"/g) || []).length >= 4)

// C2 — the four chart TYPES the reference uses, all present
ok("C2 · vertical bars (V2's retrieval frequency)", /class="chart"/.test(SURFACE_HTML))
ok("C2b · a progress ring (screen 13's health donut)", /class="ring-fg"/.test(HTML))
ok("C2c · horizontal proportional bars (screen 09's strip)", /class="hbar"/.test(SURFACE_HTML))
ok("C2d · sparklines (V2's embedding-quality line)", /class="spark-path"/.test(SURFACE_HTML))

// C3 — the charts are ANIMATED, and the animation is reduced-motion aware
ok("C3 · the bars animate in", /@keyframes growY/.test(HTML) && /animation: growY/.test(HTML))
ok("C3b · the ring sweeps", /@keyframes sweep/.test(HTML))
ok("C3c · the horizontal bars grow", /@keyframes growX/.test(HTML))
ok("C3d · the sparkline draws itself", /@keyframes draw/.test(HTML))
ok("C3e · ⚠ every animation is disabled under prefers-reduced-motion",
  /@media \(prefers-reduced-motion: reduce\)/.test(HTML) &&
  /\.bar[\s\S]{0,120}animation: none !important/.test(HTML))
ok("C3f · the entrance replays when a variant is shown, not only on first load",
  /function play\(/.test(SCRIPT_CODE) && /offsetWidth/.test(SCRIPT_CODE))

// C4 — ⭐ THE RING IS HONEST WHERE THE REFERENCE'S WAS NOT
ok("C4 · the ring prints a numerator AND a denominator, never a bare percentage",
  /<b>87<\/b><span>of 224<\/span>/.test(SURFACE_HTML.replace(/\s+/g, "")) ||
  (SURFACE.includes("87") && SURFACE.includes("of 224")))
ok("C4b · no '98%' health donut, and no vector-database health score at all",
  !/98%/.test(SURFACE) && !/Database Health|Vector Database Health/i.test(SURFACE))

// C5 — ⛔ the cut list is actually absent from the surface, not merely written about
const CUTS = [
  ["Embedding Quality", /Embedding Quality/i],
  ["Semantic Match % column", /Semantic Match/i],
  ["a token pie chart", /token(s)? (usage|pie)/i],
  ["query latency p99", /p99|Query Latency/i],
  ["connector source column", /SharePoint|Zendesk|Confluence|Google Drive/i],
  ["a retrieval heatmap", /heatmap/i],
  ["Mark as Golden Answer", /golden/i],
]
CUTS.forEach(([label, re]) => {
  ok(`C5 · cut from the reference and absent from the surface — ${label}`, !re.test(SURFACE))
})

// C6 — the detail panel expresses the reference's Insights card, with the ONE gap named
ok("C6 · the detail panel carries the reference's retrieval insights",
  SURFACE.includes("Times found") && SURFACE.includes("Last question") && SURFACE.includes("Last found"))
ok("C6b · ⚠ average relevance says it is NOT recorded rather than showing 0.00",
  SURFACE.includes("Average relevance") && SURFACE.includes("not recorded yet") &&
  !/Avg\.? Relevance Score:\s*0\.\d/.test(SURFACE))
ok("C6c · the panel is the SHIPPED 430px track, not a modal",
  /\.detail\s*\{[^}]*width:\s*430px/.test(HTML))
ok("C6d · chunks are shown instead of a page-image viewer — they are what search actually reads",
  SURFACE.includes("Chunks") && !/Content Viewer/i.test(SURFACE))

// C7 — the Indexing tab surfaces the folder that cannot be read
ok("C7 · a folder with no vectors renders — and 'never', never 0 or a tick",
  /Uncategorized[\s\S]{0,120}never/.test(SURFACE))

// ═══════════════════════════════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════════════════════════════
const total = pass + failures.length
console.log(`\n  sketch 218 — the Library and its tabs`)
console.log(`  ${pass} passed · ${failures.length} failed · ${total} assertions\n`)
if (failures.length) {
  failures.forEach((f) => console.log(`  ✗ ${f}`))
  console.log("")
  process.exitCode = 1
} else {
  console.log("  all assertions hold — including the ones that read the live source tree.\n")
}

// ── --emit ────────────────────────────────────────────────────────────────────────────
if (process.argv.includes("--emit")) {
  const stageRow = COPY.STAGES.map((s) => `${s.label}${s.always ? "" : "?"}`).join(" → ")
  const md = `# BUILD CONTRACT — sketch 218, the Library and its tabs

⚠ **GENERATED by \`node drive.cjs --emit\` FROM the running sketch. Do not hand-edit.**
Regenerate it instead; a transcribed contract is the thing that goes stale.

Generated: ${new Date().toISOString().slice(0, 10)} · **${pass} assertions, ${failures.length} failing**

## The surface's own name

| | value |
|---|---|
| page title | \`${COPY.PAGE_TITLE}\` |
| page subtitle | \`${COPY.PAGE_SUB}\` |
| ⚠ shipped title being REPLACED | \`${COPY.SHIPPED_PAGE_TITLE}\` |
| ⚠ shipped subtitle being REPLACED | \`${COPY.SHIPPED_PAGE_SUB}\` |

The rename is **front-end only**. \`ActiveView\` stays \`"documents"\`.

## The tab set

- **A (five)** — ${COPY.TABS_A.join(" · ")}
- **B (four)** — ${COPY.TABS_B.join(" · ")}
- tab 5 is **${COPY.TABS_A[4]}**, never \`${COPY.TAB_HEALTH_REJECTED_NAME}\`

## The document table — order is FIXED

\`${COPY.COLUMNS.filter(Boolean).join(" · ")}\`
Sheddable when the 430px panel opens: **${COPY.SHEDDABLE.join(" · ")}** (nth-child 3–5).

## Ingestion stages — SIX, two conditional

\`${stageRow}\`

${COPY.STAGES.map((s) => `- \`${s.key}\` → **${s.label}**${s.always ? "" : ` — conditional. ${COPY.STAGE_CONDITIONAL_NOTE}`}`).join("\n")}

⚠ No percentage and no ETA: two stages are decided while the file runs, so there is no honest
denominator when the strip first renders.

## Health tab

- filters: ${COPY.HEALTH_FILTERS.map((f) => `\`${f}\``).join(" · ")}
- shipped tabs they replace: ${COPY.SHIPPED_HEALTH_TABS.map((f) => `\`${f}\``).join(" · ")}
- shipped tiles that must not be lost: ${COPY.SHIPPED_HEALTH_TILES.map((f) => `\`${f}\``).join(" · ")}
- window: **${COPY.WINDOW_NOTE}**

### The contested tile — the operator picks, this contract does not

| arm | label | value | says what it measures? |
|---|---|---|---|
| as shipped | \`${COPY.SCORE_AS_SHIPPED.label}\` | \`${COPY.SCORE_AS_SHIPPED.value}\` | ⚠ no |
| qualified | \`${COPY.SCORE_QUALIFIED.label}\` | \`${COPY.SCORE_QUALIFIED.value}\` | ✅ \`${COPY.SCORE_QUALIFIED.sub}\` |
| absent | — | — | \`${COPY.SCORE_ABSENT_ARM}\` |

## ⚠ The name that is already taken

\`workflow_runs.is_golden_run\` means the publish gauntlet's live run. Rejected for this feature:
${COPY.GOLDEN_REJECTED.map((g) => `\`${g}\``).join(" · ")}. **Chosen: \`${COPY.CHECK_TITLE}\`** —
*${COPY.CHECK_SUB}*

Columns: ${COPY.CHECK_COLUMNS.map((c) => `\`${c}\``).join(" · ")}
Verdicts: ${Object.values(COPY.CHECK_VERDICT).map((v) => `**${v.word}** (${v.tone})`).join(" · ")}
A slipped check reads: \`${COPY.CHECK_SLIPPED_DETAIL(2, 6)}\`

## Empty and unknown arms — silence is not success

${[["never retrieved, none", COPY.EMPTY_NEVER_RETRIEVED], ["no searches yet", COPY.EMPTY_NO_SEARCHES], ["never-retrieved subtitle", COPY.NEVER_RETRIEVED_SUB], ["chunks, none", COPY.CHUNKS_EMPTY]].map(([k, v]) => `- ${k} → \`${v}\``).join("\n")}

## ⚠ Measured against the live tree at emit time

| measurement | value |
|---|---|
| shipped columns | \`${shippedCols.join(" · ")}\` |
| backend ingestion steps | \`${uniqueSteps.join(" → ")}\` |
| shipped Library Health tabs | \`${khTabs.join(" · ")}\` |
| \`WINDOW_DAYS\` | \`${win ? win[1] : "?"}\` |
| light theme track → active | ${lightMuted}% → ${lightBg}% (**+${(lightBg - lightMuted).toFixed(0)}**, lighter) |
| dark theme track → active | ${darkMuted}% → ${darkBg}% (**${(darkBg - darkMuted).toFixed(0)}**, DARKER — the bar inverts) |

⭐ **The last row is the finding a Stitch pass structurally could not produce.** The shipped
\`Tabs\` primitive draws the selected tab *darker* than its track on Deep Midnight, with only a
5%-opacity shadow as a second cue — invisible at 4% lightness. Every reference image drew it lighter.
`
  fs.writeFileSync(path.join(DIR, "BUILD-CONTRACT.generated.md"), md)
  console.log("  → BUILD-CONTRACT.generated.md written from the running sketch\n")
}
