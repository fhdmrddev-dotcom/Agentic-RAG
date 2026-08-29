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
  src("frontend/src/pages/LibraryPage.tsx") !== null,
  `looked under ${REPO}`)

// ═══════════════════════════════════════════════════════════════════════════════════════
// §A · THE SKETCH AGREES WITH WHAT SHIPS  (these read the live source tree)
// ═══════════════════════════════════════════════════════════════════════════════════════
const PAGE = src("frontend/src/pages/LibraryPage.tsx") || ""
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
ok("A2 · LibraryPage sheds nth-child(n+3)..(-n+5)",
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
// ⚠ NARROWED 2026-08-28, and the original is recorded rather than replaced silently.
// It read `!/last 7 days|\(7d\)|RETRIEVED \(7D\)/` over the WHOLE surface, and fired when the
// Views tab drew a saved view whose RULE is "added in the last 7 days". That is a filter a user
// wrote, not a claim about the retrieval window — the fence had conflated two different sevens.
// What must stay true: no RETRIEVAL COUNT is labelled with a window other than the shipped 30.
const RETRIEVAL_WINDOW_CLAIMS = SURFACE.match(/(?:found by a search|returned by a search|retrieved|searches)[^.]{0,40}?\blast (\d+) days/gi) || []
ok("A6e · every retrieval count the sketch labels is labelled 30 days",
  RETRIEVAL_WINDOW_CLAIMS.every((c) => /last 30 days/i.test(c)),
  RETRIEVAL_WINDOW_CLAIMS.filter((c) => !/last 30 days/i.test(c)).join(" | ") || "none")
ok("A6e2 · and the 7d/90d chart range control is a RANGE PICKER, not a counted window",
  /7d[\s\S]{0,80}30d[\s\S]{0,80}90d/.test(SURFACE),
  "the picker is legitimate; a TILE claiming a 7-day retrieval count would not be")

// A7 — the rename is front-end only, and the IA is already decided
ok("A7 · ActiveView already carries \"documents\" (there is no route to change)",
  /ActiveView\s*=[\s\S]{0,400}"documents"/.test(APP))
// ⚠ REWRITTEN 2026-08-29 (Phase 217 plan 04) when the rename SHIPPED. The first version
// asserted the shipped label and h1 read "Documents", which correctly fired the moment they
// became "Library". A verbatim shipped-state check cannot tell a RENAME from a LOSS — the
// `A9c` precedent below. So each is now a rename map: the old word is GONE, the new word is
// PRESENT, and COPY still records what was replaced. Deleting them would be a lost guarantee.
ok("A7b · the nav entry now ships as label \"Library\" — and the KEY did not move",
  /view:\s*"documents",[^}]*label:\s*"Library"/.test(NAV) &&
    !/view:\s*"documents",[^}]*label:\s*"Documents"/.test(NAV),
  "the `view` key stays \"documents\" (never printed); only the label is renamed")
ok("A7b2 · COPY still records the label this replaced, so the diff stays visible",
  COPY.SHIPPED_PAGE_TITLE === "Documents")
ok("A7c · the page h1 now ships as \"Library\", and the old one is gone",
  PAGE.includes(">Library</h1>") && !PAGE.includes(">Documents</h1>"))
ok("A7c2 · and the page subtitle is the contract's, not the one it replaced",
  PAGE.includes(COPY.PAGE_SUB) && !PAGE.includes(COPY.SHIPPED_PAGE_SUB),
  `expected ${JSON.stringify(COPY.PAGE_SUB)}`)
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
// ⚠ REWRITTEN 2026-08-28 when Governance was merged in too. The first version asserted the four
// shipped tab names appeared VERBATIM — which correctly fired the moment three were renamed to
// resolve the "Low Confidence" collision. A verbatim check cannot tell a RENAME from a LOSS.
// So the rename is now declared in COPY.SIGNAL_RENAMES and the fence proves the map is TOTAL:
// every shipped signal is mapped, and every target is actually on the surface.
const SHIPPED_SIGNALS = [...COPY.SHIPPED_HEALTH_TABS, ...COPY.SHIPPED_GOVERNANCE_CARDS]
ok("A9c · every shipped signal is MAPPED — a rename is allowed, a loss is not",
  SHIPPED_SIGNALS.every((sig) => COPY.SIGNAL_RENAMES[sig]),
  SHIPPED_SIGNALS.filter((sig) => !COPY.SIGNAL_RENAMES[sig]).join(", ") || "all mapped")
ok("A9c2 · and every mapped target is actually rendered",
  SHIPPED_SIGNALS.every((sig) => SURFACE.includes(COPY.SIGNAL_RENAMES[sig])),
  SHIPPED_SIGNALS.filter((sig) => !SURFACE.includes(COPY.SIGNAL_RENAMES[sig]))
    .map((sig) => `${sig} → ${COPY.SIGNAL_RENAMES[sig]}`).join(", ") || "all rendered")
ok("A9c3 · ⭐ the two 'low confidence' signals map to DIFFERENT words",
  COPY.SIGNAL_RENAMES["Low Confidence"] !== COPY.SIGNAL_RENAMES["Low-confidence metadata"],
  "retrieval similarity (0.38) and extraction confidence (0.5) must not share a label")
ok("A9c4 · the shipped Governance page really does carry those three cards",
  COPY.SHIPPED_GOVERNANCE_CARDS.every((c) =>
    (src("frontend/src/pages/GovernancePage.tsx") || "").includes(`title: "${c}"`)),
  "measured against GovernancePage's CARD_META, never transcribed")
ok("A9c5 · the chips are grouped, not a flat row of seven",
  Object.keys(COPY.HEALTH_GROUPS).length === 2 &&
  COPY.HEALTH_FILTERS.length === 7 &&
  Object.keys(COPY.HEALTH_GROUPS).every((g) => SURFACE.includes(g)),
  `${COPY.HEALTH_FILTERS.length} chips in ${Object.keys(COPY.HEALTH_GROUPS).length} groups`)
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
  // ⚠ REWRITTEN 2026-08-28 — THE SCOPE CHANGED, THE SKETCH DID NOT DRIFT.
  // This read /SharePoint|Zendesk|Confluence|Google Drive/ over the whole surface, and it was
  // right while connectors were cut. The operator has since put cloud-storage connectors IN
  // scope for this milestone, so a connected drive is now a designed surface and MUST appear.
  // What is still forbidden is the thing that was actually dishonest: a Source column on the
  // DOCUMENT TABLE implying documents arrived from systems we cannot connect.
  ["a service we cannot actually connect", /Zendesk|Confluence|Salesforce Files/i],
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
// §D · THE FRONT DOOR, AND THE BURIED-CAPABILITY AUDIT
//
// ⚠ Operator, 2026-08-28: *"I did not see for example where I can upload documents"* and
// *"we have a lot of things that we can show but it is hidden and buried"*. §D pins both.
// ═══════════════════════════════════════════════════════════════════════════════════════
const UPLOAD = src("frontend/src/components/ingestion/DocumentUpload.tsx") || ""

// D1 — upload is a first-class surface, not a corner button
ok("D1 · the sketch draws a full-width dropzone with its own icon and a browse control",
  /class="dropbig"/.test(SURFACE_HTML) && /Drop files here/.test(SURFACE) && /Choose files/.test(SURFACE))
ok("D1b · it names the folder the files land in — upload is folder-scoped today",
  /Add to/.test(SURFACE) && /Engineering/.test(SURFACE))

// D2 — ⚠ the accepted formats are MEASURED from the shipped input, never invented
const acceptAttr = (UPLOAD.match(/accept="([^"]+)"/) || ["", ""])[1]
const exts = acceptAttr.split(",").map((x) => x.trim()).filter((x) => x.startsWith("."))
ok("D2 · the shipped input accepts 8 extensions",
  exts.length === 8, `measured: ${exts.join(" ") || "(none)"}`)
ok("D2b · every format the dropzone advertises is one the input actually accepts",
  exts.every((e) => SURFACE.toUpperCase().includes(e.slice(1).toUpperCase())),
  exts.filter((e) => !SURFACE.toUpperCase().includes(e.slice(1).toUpperCase())).join(",") || "all listed")
ok("D2c · ⚠ .msg is NOT accepted today, so the dropzone must not advertise it",
  !exts.includes(".msg") && !/\bMSG\b/.test(SURFACE),
  "a dropzone listing a format the input rejects sends the user to a dead end")

// D3 — ⛔ there is NO upload progress to report, so no percentage is drawn
ok("D3 · the shipped upload path reports no byte progress",
  !/onUploadProgress|progressEvent/.test(UPLOAD),
  "if this ever becomes false, a real percentage becomes honest and this fence should be revisited")
ok("D3b · so the queue shows STAGES, and no upload percentage anywhere",
  !/\b\d{1,3}%\s*(uploaded|upload)/i.test(SURFACE) &&
  !(SURFACE_HTML.match(/Upload[^<]{0,20}\d+%/g) || []).length)

// D4 — ⭐ the buried-capability audit is present, and it is a MEASUREMENT
// ⚠ THIS WALKS THE TREE IN JS RATHER THAN SHELLING OUT TO grep.
// The first version used `execSync("grep -rl …")`, which printed "The system cannot find the
// path specified" on this box and returned [] — so the assertion PASSED VACUOUSLY. A fence
// that reports "zero references" because its search failed is worse than no fence: it
// manufactures the exact finding it was meant to verify.
function walk(dir, out) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return out }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== "node_modules") walk(full, out) }
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(full)
  }
  return out
}
const FE_FILES = walk(path.join(REPO, "frontend", "src"), [])
ok("D4-control · the frontend tree walk actually found files",
  FE_FILES.length > 200, `${FE_FILES.length} non-test .ts/.tsx files`)
function feMentions(needle) {
  return FE_FILES.filter((f) => {
    try { return fs.readFileSync(f, "utf8").includes(needle) } catch { return false }
  }).map((f) => path.relative(REPO, f))
}
// positive control for the walker: a column that IS surfaced must be found.
ok("D4-control2 · the walker finds a column that IS surfaced (table_count)",
  feMentions("table_count").length > 0, "if this is 0 the walker is broken, not the codebase")

const buried = feMentions("full_markdown")
ok("D4 · ⭐ documents.full_markdown is stored and has ZERO non-test frontend references",
  buried.length === 0, `frontend refs: ${buried.join(", ") || "none"}`)
ok("D4b · …and the schema really does store it",
  /full_markdown text/.test(src("supabase/full-schema.sql") || ""))
// ⚠ the audit TABLE is `data-meta` by design — it is analysis about the product, not a
// product surface — so this asserts against the sketch FILE, not the stripped surface.
ok("D4c · the sketch names it as a buried capability",
  HTML.includes("full_markdown"))

const SCHEMA = src("supabase/full-schema.sql") || ""
ok("D5 · document_tables stores real headers AND rows, not just a count",
  /headers jsonb/.test(SCHEMA) && /rows jsonb/.test(SCHEMA))
ok("D5b · document_images stores a written description",
  /CREATE TABLE public\.document_images[\s\S]{0,400}description text/.test(SCHEMA))
ok("D5c · the frontend renders only COUNTS of them today",
  /table_count/.test(src("frontend/src/components/ingestion/DocumentList.tsx") || ""))
ok("D5d · the sketch RENDERS the buried content — a real table and real descriptions",
  /class="xtable"/.test(SURFACE_HTML) && /class="figrow"/.test(SURFACE_HTML) &&
  /Region[\s\S]{0,80}EMEA/.test(SURFACE))

ok("D6 · documents.extractor is stored",
  /\n    extractor text/.test(SCHEMA))
ok("D6b · and the sketch names it as unsurfaced", HTML.includes("documents.extractor"))
ok("D7 · document_chunks carries a per-chunk embedding_model",
  /CREATE TABLE public\.document_chunks[\s\S]{0,600}embedding_model text/.test(SCHEMA))

// D8 — ⭐ the question list is a GROUP BY over rows already written
ok("D8 · the question text IS recorded on every search today",
  /"query_text":\s*args\["query"\]/.test(DISPATCH))
ok("D8b · the sketch renders the per-document question list",
  /Questions that found this document/.test(SURFACE))
ok("D8c · with a count per question — a list without frequency decides nothing",
  (SURFACE_HTML.match(/class="val">\d+×</g) || []).length >= 4)

// D9 — the library-wide stage cards are an aggregate we can actually produce
ok("D9 · the pipeline stage cards are drawn",
  /class="stagecards"/.test(SURFACE_HTML) &&
  (SURFACE_HTML.match(/class="scard"/g) || []).length === 4)
// ⚠ tests the RENDERED TEXT, not the raw markup: the bar carries a CSS width (--w:100%)
// which is not a number shown to anyone. A fence that reads style attributes as content
// fires on every progress bar in the file.
ok("D9b · each carries a COUNT of documents, not a percentage",
  !/\d+%/.test(norm((SURFACE_HTML.match(/<div class="stagecards">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/) || [""])[0])))
ok("D9c · the idle stage renders 0 and says 'waiting' — never a green tick",
  /class="ico idle"[\s\S]{0,200}>0<[\s\S]{0,120}waiting/.test(SURFACE_HTML))

// D10 — the richer palette is still OUR tokens, and never colour-only
ok("D10 · the chart palette uses five state tokens, no invented hex",
  [".s-primary", ".s-violet", ".s-success", ".s-warning", ".s-danger"].every((c) => HTML.includes(c)))
ok("D10b · every series colour resolves to a theme variable, never a literal hex",
  !/\.s-(primary|violet|success|warning|danger|dim)\s*\{\s*background:\s*#/.test(HTML))


// ═══════════════════════════════════════════════════════════════════════════════════════
// §E · CONNECTED SOURCES — the operator put cloud storage in scope on 2026-08-28.
//
// ⚠ THESE ARE THE HIGHEST-STAKES CLAIMS IN THE SKETCH. It asserts that four of SEED-142's
// five blockers have since shipped. If any of that is wrong, a planner defers or schedules
// work on a false premise — so every one is measured against the tree, never asserted.
// ═══════════════════════════════════════════════════════════════════════════════════════
const SCHED = src("backend/app/services/scheduler_service.py")
const ROADMAP = src(".planning/ROADMAP.md") || ""

// E1 — ⭐ the scheduler EXISTS (SEED-142 says it does not)
ok("E1 · a scheduler service ships today", SCHED !== null,
  "SEED-142 says 'a scheduler (none exists)' — that is the claim under test")
ok("E1b · with a durable schedule table carrying cron, interval and timezone",
  /CREATE TABLE public\.workflow_schedules/.test(SCHEMA) &&
  /cron_expression text/.test(SCHEMA) && /interval_seconds integer/.test(SCHEMA) &&
  /timezone text/.test(SCHEMA))
// ⚠ THIS FENCE WAS FOUND PASSING ON ITS OWN FALLBACK. Its first version read
//   src("…SEED-142-connectors-two-way-read-and-auto-ingest.md") || src("…SEED-142.md") || "none exists"
// and BOTH guessed filenames were wrong (the file is SEED-142-two-way-connectors-read-pull-auto-ingest.md),
// so the `|| "none exists"` default satisfied the regex and it went green having read nothing.
// This is the SECOND vacuous pass in this suite, from the same root cause: a fence whose failure
// mode is indistinguishable from its success. It now resolves the seed by GLOB and asserts it exists.
const SEED142_PATH = (() => {
  const dir = path.join(REPO, ".planning", "seeds")
  try { return (fs.readdirSync(dir).find((f) => f.startsWith("SEED-142")) || null) } catch { return null }
})()
ok("E1c-control · SEED-142 is actually found on disk",
  SEED142_PATH !== null, "the fence below is meaningless without this")
const SEED142 = SEED142_PATH ? fs.readFileSync(path.join(REPO, ".planning", "seeds", SEED142_PATH), "utf8") : ""
ok("E1c · ⚠ SEED-142 still carries the STALE 'no scheduler' claim, so the sketch must say so",
  /a scheduler\s*\n?\s*\(none exists/.test(SEED142),
  `read ${SEED142_PATH || "(nothing)"} — if this fails, the seed has been corrected and the sketch's note can be retired`)
ok("E1d · the sketch records the staleness rather than quietly relying on it",
  /STALE/.test(HTML) && /SEED-142/.test(HTML))

// E2 — OAuth is IN this milestone, not a future one
ok("E2 · the active milestone is the connections milestone",
  /v3\.9 Connections/.test(ROADMAP))
ok("E2b · and it contains a BYO OAuth phase", /BYO OAuth/.test(ROADMAP))

// E3 — per-file dedupe substrate exists (the dry run's 'already here' arm)
ok("E3 · documents carry a content hash, so 'already here' is a lookup not a guess",
  /content_hash text/.test(SCHEMA))
ok("E3b · and a version model for re-ingest-on-change",
  /version_number integer/.test(SCHEMA) && /is_latest boolean/.test(SCHEMA))
ok("E3c · the sketch says the match is by content, not by name",
  /matched by content, not by name/.test(SURFACE))

// E4 — ⛔ THE HONESTY FENCES. These are what stop the screen promising a mechanism.
ok("E4 · the sketch never promises instant / on-change sync",
  !/\b(instantly|in real ?time|as soon as|the moment)\b/i.test(SURFACE),
  "there is no change feed and no webhook — the scheduler polls")
ok("E4b · it states a polling interval in plain words instead",
  /checked every \d+ (minutes?|hour)/i.test(SURFACE) || /checked every hour/i.test(SURFACE))
ok("E4c · a source that stopped reading says WHEN it stopped and offers an action",
  /permission expired/i.test(SURFACE) && /Nothing has been read since/i.test(SURFACE) &&
  /Reconnect/.test(SURFACE))
ok("E4d · ⚠ the sketch never claims a removed remote file is deleted here",
  !/\bdeleted from (the |your )?library\b/i.test(SURFACE))

// E5 — the credential is NOT collected on this screen
ok("E5 · no credential field anywhere on the sources surface",
  !/type="password"|api[_ ]?key|client[_ ]secret|access[_ ]token/i.test(SURFACE_HTML),
  "a credential form on an ingestion screen is a new trust surface with no review cycle")
ok("E5b · connecting LEAVES for the shipped connections home",
  /Connect a source/.test(SURFACE) && /Settings › Connections|Settings . Connections/.test(HTML))

// E6 — two-way is a GRANT, rendered, not a separate feature
const GRANTS = (SURFACE_HTML.match(/class="grantrow"/g) || []).length
ok("E6 · the per-tool grant list is rendered", GRANTS >= 4, `${GRANTS} grant rows`)
// ⚠⚠ THIS FENCE FAILED TO FIRE ON ITS OWN PLANTED DEFECT, AND IT IS THE MOST SECURITY-BEARING
// ONE HERE. The first version read /Write a file back[\s\S]{0,220}Not allowed/ over the flattened
// SURFACE. Flipping the write grant to "Allowed" left it GREEN, because the 220-character window
// ran past the end of that row and matched the NEXT row's "Not allowed" (the delete grant).
// **A window-based regex across a repeated structure reads its neighbour's answer.** It now parses
// each grant row individually, so a row can only be judged by its own badge.
// a grant row closes at its FIRST </div> — its children are spans. Requiring two closing divs
// (as the first draft did) matched only the last row, which the control caught immediately.
const GRANT_ROWS = [...SURFACE_HTML.matchAll(/<div class="grantrow">([\s\S]*?)<\/div>/g)]
  .map((m) => norm(m[1]))
const grantOf = (name) => GRANT_ROWS.find((r) => r.startsWith(name)) || ""
ok("E6b-control · the grant rows parse individually",
  GRANT_ROWS.length >= 4 && grantOf("Write a file back").length > 0,
  `parsed ${GRANT_ROWS.length} rows: ${GRANT_ROWS.map((r) => r.slice(0, 26)).join(" | ")}`)
ok("E6b · the WRITE grant is shown OFF by default",
  /Not allowed$/.test(grantOf("Write a file back")),
  `write row reads: "${grantOf("Write a file back")}" — the operator's 'to and from' is this row switched ON by a person, and it must never default to on`)
ok("E6c · and the DELETE grant is off too",
  /Not allowed$/.test(grantOf("Delete a file")),
  `delete row reads: "${grantOf("Delete a file")}"`)
ok("E6d · while both READ grants are on — a source that cannot read is not a source",
  /Allowed$/.test(grantOf("See the file list")) && /Allowed$/.test(grantOf("Read a file")),
  "a positive control: the fence must distinguish allowed from not-allowed, not just find the word")

// E7 — ⭐ the dry run, and its three honest arms
ok("E7 · a first read shows what it WOULD add before adding it",
  /This is what it would add/.test(SURFACE))
ok("E7b · with three arms — added, already here, unsupported",
  /will be added/.test(SURFACE) && /already here/.test(SURFACE) && /type not supported/.test(SURFACE))
ok("E7c · the composition is one stacked bar, never a pie chart",
  /class="stackbar"/.test(SURFACE_HTML) && !/pie/i.test(SURFACE))

// E8 — ⚠ the standing CLAUDE.md rule this design fires
const CMD = src("CLAUDE.md") || ""
ok("E8 · CLAUDE.md still says ingestion is manual upload only",
  /manual file upload only/.test(CMD))
ok("E8b · and marks that rule DATED, with a same-commit change instruction",
  /Dated, not permanent/.test(CMD) && /changes this rule in the same commit/.test(CMD))
ok("E8c · the sketch names the rule it fires rather than leaving it to be discovered",
  /manual file upload only/.test(HTML) && /same commit/.test(HTML))

// ═══════════════════════════════════════════════════════════════════════════════════════
// §F · TAB 2 AND CHUNKING — the two surfaces the first pass left undrawn
// ═══════════════════════════════════════════════════════════════════════════════════════
ok("F1 · the Views tab has content of its own, not a copy of the sidebar",
  /class="vgrid"/.test(SURFACE_HTML) && (SURFACE_HTML.match(/class="vcard/g) || []).length >= 4)
ok("F1b · ⭐ a view that matches nothing says so on its face",
  /Matches nothing right now/.test(SURFACE))
ok("F1c · every view card shows the RULE that produced its count",
  (SURFACE_HTML.match(/class="vrule"/g) || []).length >= 4)
ok("F1d · the two-renderings build constraint is recorded",
  /One source of truth, two renderings/.test(HTML))

// F2 — chunking, and the units trap
const CFG = src("backend/app/config.py") || ""
const csize = (CFG.match(/chunk_size:\s*int\s*=\s*(\d+)/) || [])[1]
const coverlap = (CFG.match(/chunk_overlap:\s*int\s*=\s*(\d+)/) || [])[1]
ok("F2 · the shipped chunk size and overlap are measured, not invented",
  csize === "1000" && coverlap === "200", `measured ${csize} / ${coverlap}`)
ok("F2b · and the sketch prints those exact numbers",
  SURFACE.includes(`${csize} characters`) && SURFACE.includes(`${coverlap} characters`))
ok("F2c · ⚠ it says CHARACTERS — the reference says tokens, and that would be a units lie",
  /characters/.test(SURFACE) && !/\d+\s*tokens?\b/i.test(SURFACE.replace(/128 tokens|116 tokens/g, "")))
ok("F2d · the chunk-boundary shading is drawn on the source text",
  (SURFACE_HTML.match(/class="ck ck[12]"/g) || []).length >= 3)
ok("F2e · ⚠ and the sketch flags that these are env values, not Settings",
  /config\.py/.test(HTML) && /user_settings/.test(HTML))


// ═══════════════════════════════════════════════════════════════════════════════════════
// §G · COLOUR HAS A JOB — operator, 2026-08-28: "why is it one color?"
//
// ⭐ The answer is not "make it colourful". One colour for one series is correct; thirty bars
// of one measurement in thirty colours invites a reader to hunt for meaning that is not there
// — the same failure as the reference's "Embedding Quality 92%". So colour was given a JOB,
// and the job comes from a second dimension that is ALREADY IN THE DATA.
// ═══════════════════════════════════════════════════════════════════════════════════════

// G1 — ⭐ a search that found NOTHING is knowable today, with no new write
ok("G1 · the audit row is written whether or not anything was found",
  /_audit_doc_ids = list\(\{/.test(DISPATCH) && /for h in \(results or \[\]\)/.test(DISPATCH),
  "an empty result writes an empty document list — the row still exists, so a miss is countable")
// ⚠ the miss segment is created in JS (`ms.className = "miss"`), so it is NEVER a literal
// `class="miss"` attribute in the file. The first version of this fence looked for the
// attribute and failed on a sketch that was correct — testing the wrong artifact.
ok("G1b · the chart draws that second series",
  /className = "miss"/.test(SCRIPT_CODE) &&
  /var MISS = \[/.test(SCRIPT_CODE) &&
  /\.chart \.bar \.miss\s*\{/.test(HTML))
ok("G1c · and names it in words, not colour alone",
  /found nothing/.test(SURFACE) && /found something/.test(SURFACE))
ok("G1d · with both counts printed in the legend",
  (SURFACE_HTML.match(/class="li"/g) || []).length >= 5)

// G2 — the ring's remainder is a STATE, not empty track
ok("G2 · never-found is drawn as its own colour, not as bare background",
  /ring-never/.test(HTML))
ok("G2b · and both arms are labelled with their number",
  /never found/.test(SURFACE) && /137/.test(SURFACE))

// G3 — the per-document bars carry each document's state
ok("G3 · the most-retrieved bars are state-coloured, not one flat colour",
  (SURFACE_HTML.match(/class="hbar"><i class="s-(primary|violet|warning)"/g) || []).length >= 6)
ok("G3b · with a legend giving each colour its word",
  /re-indexing/.test(SURFACE) && /stale/.test(SURFACE))

// G4 — ⛔ the fence that stops this becoming decoration
ok("G4 · no chart uses more colours than it has named series",
  (HTML.match(/class="sw s-[a-z]+"/g) || []).length >= 5,
  "every swatch in a legend must correspond to a word; the count is the floor, not the ceiling")


// G5 — the third segment: searches that COULD NOT RUN
ok("G5 · Phase 210 ships the provider_error status",
  /"retrieval_status": "provider_error"/.test(DISPATCH))
ok("G5b · ⚠ but that path RETURNS before the audit write — an outage writes NO row today",
  DISPATCH.indexOf('"retrieval_status": "provider_error"') < DISPATCH.indexOf('action_type="search.query"'),
  "so the chart would dip toward zero with no explanation; one audit write on the error path fixes it")
ok("G5c · the sketch draws the outage as its own segment, and names the gap",
  /className = "err"/.test(SCRIPT_CODE) && /could not search/.test(SURFACE) &&
  /RETURNS BEFORE the audit write/.test(HTML))

// ═══════════════════════════════════════════════════════════════════════════════════════
// §H · THE GOVERNANCE MERGE — operator, 2026-08-28.
//
// ⚠ THE ASSERTION THAT MATTERS HERE IS A PERMISSION ONE. Governance is feature-gated and
// Documents is not; folding gated signals into an ungated tab SHOWS THEM TO PEOPLE THE MAP
// CURRENTLY HIDES THEM FROM. A merge that drops a gate is a leak, not a tidy-up.
// ═══════════════════════════════════════════════════════════════════════════════════════
const GOV = src("frontend/src/pages/GovernancePage.tsx") || ""

// H1 — the page really is document-scoped, which is what justifies the merge at all
ok("H1 · the Governance page's own heading is 'Document Governance'",
  /<h1[^>]*>Document Governance<\/h1>/.test(GOV))
ok("H1b · its own docblock calls it 'Library Health, three different lists'",
  /Library Health, three different lists/.test(GOV))
ok("H1c · and it never mutates — every row links out to the document panel",
  /this surface never mutates/.test(GOV))
ok("H1d · it carries exactly three signal cards",
  COPY.SHIPPED_GOVERNANCE_CARDS.length === 3 &&
  (GOV.match(/^\s{4}title: "/gm) || []).length === 3,
  `measured ${(GOV.match(/^\s{4}title: "/gm) || []).length} cards`)

// H2 — ⚠ THE GATE. Governance is governed; Documents is not.
ok("H2 · the Governance nav entry is feature-gated today",
  /view: "governance",[\s\S]{0,140}feature: "governance_health"/.test(NAV))
// ⚠ REWRITTEN 2026-08-29 (Phase 217 plan 04), same reason as A7b: this fence read the
// LABEL to prove a property about the GATE, so the rename broke it while the property it
// guards was never in question. It now asserts the STRUCTURE — the entry carries no
// `feature:` key — which is the thing the merge must not silently change.
ok("H2b · ⚠ while the Library (view: documents) entry is UNGATED — it carries no feature key",
  /\{ view: "documents", icon: FileText, label: "[^"]+" \}/.test(NAV),
  "this asymmetry is exactly why the merge must carry the gate explicitly")
ok("H2c · a governed entry VANISHES rather than rendering locked",
  /the sketch VANISH, never a locked\/disabled\/badged placeholder/.test(NAV))
ok("H2d · the sketch states that the gate must move with the signals",
  /governance_health/.test(HTML) && /A merge that drops a permission is a leak/.test(HTML))

// H3 — ⭐ the collision, measured on both sides rather than asserted
ok("H3 · Library Health's low-confidence is a RETRIEVAL similarity threshold",
  /LOW_CONF_THRESHOLD\s*=\s*0\.38/.test(KH_PY) && /avg similarity below this/.test(KH_PY))
const GOV_PY = src("backend/app/api/document_governance.py") || ""
ok("H3b · Governance's low-confidence is an EXTRACTION confidence tier",
  /ConfidenceChip TIER\.MED low cutoff \(0\.5\)/.test(GOV_PY))
ok("H3c · ⭐ so the two thresholds genuinely differ (0.38 vs 0.5)",
  /0\.38/.test(KH_PY) && /0\.5\)/.test(GOV_PY))
// ⚠ SCOPED TO THE CHIP LABELS. The first version forbade "similarity" anywhere on the surface
// and fired on the QUALIFIED `Match strength` tile — "average similarity of what searches
// returned" — which is the arm that exists precisely to say what a number measures. Plain
// language explaining a value is not "printing the mechanism"; a filter label carrying a
// threshold name would be. The fence tests the labels, not the whole page.
const CHIP_LABELS = [...SURFACE_HTML.matchAll(/<span class="chip[^"]*">([^<]*)<span class="b">/g)]
  .map((m) => m[1].trim())
ok("H3d-control · the chip labels parse",
  CHIP_LABELS.length === 7, `parsed ${CHIP_LABELS.length}: ${CHIP_LABELS.join(" · ")}`)
ok("H3d · the two are renamed apart, and no chip label names a mechanism",
  CHIP_LABELS.includes("Weak matches") && CHIP_LABELS.includes("Unsure metadata") &&
  !CHIP_LABELS.some((l) => /similarity|threshold|tier|confidence|score/i.test(l)),
  CHIP_LABELS.filter((l) => /similarity|threshold|tier|confidence|score/i.test(l)).join(", ") || "clean")

// H4 — the nav arithmetic the merge buys
const NAV_ENTRIES = (NAV.match(/\{ view: "/g) || []).length
ok("H4 · the primary nav has eight entries today",
  NAV_ENTRIES === 8, `measured ${NAV_ENTRIES}`)
ok("H4b · and the sketch claims exactly two of them retire into the Library",
  /eight entries to six/.test(HTML))
ok("H4c · ⚠ Classification is NOT folded in, and the sketch says why rather than staying silent",
  /Classification/.test(HTML) && /rules-authoring/.test(HTML),
  "it is a different KIND of surface; folding it unasked would be scope creep")

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
