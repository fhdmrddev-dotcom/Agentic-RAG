# Phase 273 — Validation (plan 273-06)

Rows are filled from PERSISTED data (`message_artifacts`, `messages.tool_calls`, `runs`, Redis
`run:{run_id}`) and from rendered content in a real browser — never from a transcript. Raw evidence:
`evidence/board/` (one JSON per run + `board-summary.json`), `evidence/structured/`, `evidence/g4/`.
Method and gate lines: `273-UAT-LOG.md`.

Status (2026-10-04): **filled** — board run, G4-1..G4-4 driven, D-18 after-restart half done,
operator sign-off **"approved" (2026-10-04)**. One row is **OWED**: the live STRUCTURED-path leak
check (§1, Structured-path observations). Verdict words are used literally: PASS = measured and
met; OBSERVATION = measured, not a pass/fail criterion; OWED = not measured.

## 1. SC#10 board (D-21 / SC#5) — 8 required rows, derived at run time

Roster: derived by `scripts/run-273-board.py --roster` from the EFFECTIVE registry (seed overlaid by
`model_capabilities_overrides`; enabled, not deprecated, not removed; newest per provider). The
derivation is quoted in `273-UAT-LOG.md` §Roster.

Verdicts (all from persisted data):
- **V1 emitted** — run A: a `done` `show_artifact` call whose result is not a refusal, and a
  `message_artifacts` row with run A's `run_id`.
- **V2 rendered** — PASS needs all three: (a) board script: every `reload_artifacts` item is a record,
  never `{missing: true}`, count = the thread's rows; (b) `uat/273-board-render.test.ts` verdict line;
  (c) Chrome reload: `artifact-block` count = rows, `artifact-notice` = 0.
- **V3 by-reference** — run B created a row whose `parent_id` is run A's artifact, and run B made zero
  data-bearing / retrieval / `execute_code` calls.
- **Leak probe** (SC#2) — no Redis `delta` carries `show_artifact` or `"rows"`; no persisted ```json.

Command: `scripts/run-273-board.py --run --providers openai,anthropic,google,deepseek,zhipu,minimax,moonshot,openrouter,lmstudio`
→ exit 0. Preceded by `--seed`: upload HTTP 201, ingestion completed, `query_tables` read 16 rows,
all 16 values equal the fixture: `True`.

V2 (b), the frontend guard over every board evidence JSON:
`ARTIFACT_BOARD_EVIDENCE=… npx vitest run uat/273-board-render.test.ts` → **1 file, 19 tests passed**.

V2 (c), Chrome MCP: all 8 required board threads reloaded → **2 `artifact-block` each, 0
`artifact-notice`, no `{"` on the page**; re-checked AFTER the second backend restart (PID 62784):
identical (2 / 0 / no JSON for all 8). Screenshot saved for the openai row only:
`evidence/g4/board-openai-reload.jpg` — the other seven rows were measured by DOM count, without a
per-row screenshot (recorded as a deviation from the plan's one-screenshot-per-row, not hidden).

| # | Provider | Model (derived) | Mode | V1 | V2 (a / b / c) | V3 (B calls · parent) | refused A/B | empty / fallback | Leak probe | Evidence (thread) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | openai | gpt-5.6-luna | NATIVE | PASS | PASS (2/2 records, 0 missing / green / 2 blocks · 0 notices) | PASS ([show_artifact] · parent `a_gjbgqvcu6r`) | 0/0 | no / no | none | `605a8ca1-cd14-462d-a78d-d65356c5b6a5`; `board/openai-*.json` |
| 2 | anthropic | claude-opus-5-5 (overlay, DB-only row) | NATIVE (native SDK) | PASS | PASS (2/2, 0 missing / green / 2 · 0) | PASS ([show_artifact] · parent `a_njt2ih47n8`) | 0/0 | no / no | none | `7d368657-c9ba-47eb-a5d6-5c57c609d44a`; `board/anthropic-*.json` |
| 3 | google | gemini-3.8-flash | NATIVE (native SDK) | PASS | PASS (2/2, 0 missing / green / 2 · 0) | PASS ([show_artifact] · parent `a_j625o7tpsj`) | 0/0 | no / no | none | `f64563b6-8ad4-49ce-a70f-52c9e06cdf69`; `board/google-*.json` |
| 4 | deepseek | deepseek-v4-pro | NATIVE | PASS | PASS (2/2, 0 missing / green / 2 · 0) | **FAIL** ([show_artifact, show_artifact] · parent **NULL**) — see F-1 | 0/1 | no / no | none | `4cad1a72-a247-46e6-ac27-68a5178dc520`; `board/deepseek-*.json` |
| 5 | zhipu | glm-5.3-flash | NATIVE | PASS | PASS (2/2, 0 missing / green / 2 · 0) | PASS ([show_artifact] · parent `a_yy79vsfy4r`) | 0/0 | no / no | none | `808bede7-b2ad-4d34-8497-aa1d089fe7f2`; `board/zhipu-*.json` |
| 6 | minimax | MiniMax-M3 | NATIVE | PASS | PASS (2/2, 0 missing / green / 2 · 0) | PASS ([show_artifact] · parent `a_mtvvkas08f`) | 0/0 | no / no | none | `2cc80d64-ba37-47fa-ab9a-1a672553c5c8`; `board/minimax-*.json` |
| 7 | moonshot | kimi-k3 | NATIVE | PASS | PASS (2/2, 0 missing / green / 2 · 0) | PASS ([show_artifact] · parent `a_dof9x4xt2l`) | 0/0 | no / no | none | `61146467-36d4-4d1d-be31-e4215c53aa76`; `board/moonshot-*.json` |
| 8 | openrouter | z-ai/glm-5.3-flash | **NATIVE** (not STRUCTURED — see below) | PASS | PASS (2/2, 0 missing / green / 2 · 0) | PASS ([show_artifact] · parent `a_dys9ly59mj`) | 0/0 | no / no | none | `6b4a1162-c5bc-4869-a49b-52abb3290fca`; `board/openrouter-*.json` |
| x | lmstudio (EXTRA, self-hosted) | qwen-agentworld-35b-a3b | NATIVE | FAIL | FAIL (0 rows) | FAIL (no artifact to reference) | 0/0 | no / no | none | `e613a7d7-4e51-4bed-a12a-6ca650d3aa14`; `board/lmstudio-*.json` — model chose `execute_code`, no artifact. Extra row, not one of the 8 required |

**Totals (8 required rows):** V1 8/8 PASS · V2 8/8 PASS · V3 7/8 PASS (deepseek FAIL) · leak probe
`none` on all 8 (and on the extra row) · refused calls: 1 (deepseek turn B) · empty / fallback answer:
0 on every run (RESEARCH OQ2 observation: never observed).

**F-1 (deepseek V3 FAIL, root cause read from `messages.tool_calls`):** turn B call 1
`show_artifact(from_artifact=a_v99qzkgrki, …)` was REFUSED with reason *"its settings weren't valid"*,
detail *"`transform.chart` is not a show_artifact field. Use only the documented fields."* The retry
re-sent the rows INLINE (4 rows), so chart 2's `parent_id` is NULL. Turn B made **zero retrieval /
code calls** (SC#3's "no new retrieval or code call" holds on this row too), but D-06's by-reference
path was not used. Follow-up: the refusal detail should name where `chart` belongs (the top level) so
the model can self-correct by reference — small, not fixed here.

### Structured-path observations (plan-check WARNING 9) — SC#2 live holdback

⚠ **Task 1 finding, confirmed on the live board:** no derived row routes STRUCTURED — OpenRouter
resolves NATIVE under `openrouter_tool_strategy = quality` and every OpenRouter override row carries
`native_tools = true`. The OpenRouter row above is therefore a NATIVE row and cannot be the live
holdback check the plan assumed. **Operator ruling (2026-10-03, RESEARCH OQ1):** use the only keyed,
enabled STRUCTURED-routing id, `lmstudio:nvidia_nvidia-nemotron-nano-9b-v2`, per request.

| Obs | Row | Prompt | Tool ran (persisted) | Call text in a `delta` | Rendered | Evidence | Verdict |
|---|---|---|---|---|---|---|---|
| leak A/B (board prompts) | lmstudio nemotron-nano-9b (STRUCTURED) | board prompt A, then B | run never terminal (600 s timeout, `NOT TERMINAL (streaming)`); model never called `show_artifact` (turn B called `execute_code` / `query_tables`) | `delta_has_call_text: false` (deltas were newlines only) | — | `evidence/structured/lmstudio-nemotron-leak-A.json`, `-leak-B.json` | **OWED** — no STRUCTURED `show_artifact` turn was ever produced, so the holdback was not exercised |
| (i) search_documents turn | lmstudio nemotron-nano-9b | search prompt | run never terminal (600 s timeout); no persisted tool_calls | `delta_has_call_text: false` | — | `evidence/structured/lmstudio-nemotron-search.json` | **OWED** |
| (ii) non-tool ```json reply | — | "Show me an example retention config as a JSON code block — do not call any tool." | — | — | — | — | **OWED** — probe stopped before this observation |
| Gemini Continue probe (RESEARCH I-4 edge) | — | — | — | — | — | — | not probed — not driven this session |

**Verdict: the SC#2 / OV-273-04 live STRUCTURED holdback check is OWED.** It is proven by unit tests
only (`backend/tests/unit/test_273_structured_holdback.py`). Cause: the local 9B model is too slow to
finish a turn inside 600 s and never chose `show_artifact`. The NATIVE-path leak probe read `none` on
all 9 board rows. First thing to run when owed work resumes: a STRUCTURED row that can complete a
turn (e.g. a faster STRUCTURED-routing model registered for the purpose) — never by mutating a
global setting.

## 2. G-4 lived scenarios (D-17..D-20)

Driven with Chrome MCP as the dev user against the running frontend. Screenshots in `evidence/g4/`.

| Scenario | Claude result | Rendered-text quotes | Screenshots | Operator sign-off |
|---|---|---|---|---|
| G4-1 chart → "make it a bar chart" → "only Q3" (D-17) | **PASS.** Thread "Revenue by Quarter Line Chart" `c9b81979-698d-4eff-94a1-1000e7ab5d0d`, model `deepseek-v4-flash` (composer default). Turn 1 tools `[query_tables, show_artifact]` → chart 1 (line, 4 rows). Legend click on South → `aria-pressed="false"`, 3 lines visible; toggled back. Turn 2 tools `[show_artifact]` only → chart 2 (bar), `parent_id` = chart 1. Turn 3 tools `[show_artifact, show_artifact]` (first REFUSED, model self-corrected — D-12) → chart 3, parent = chart 2. Zero retrieval / code calls in turns 2-3. | Chart 1 caption: "Data: query_tables · 273-board-revenue.csv · 4 rows". Hover Q3: **East 1,459 · North 1,342 · West 1,203 · South 1,076** = fixture exactly. Chart 2: "Redrawn from chart 1 · same 4 rows · …". Chart 3: "From chart 2 · filtered to quarter = Q3 · 1 of 4 rows"; tooltip values equal the fixture. | `G4-1-chart1-hover-q3.png`, `G4-1-chart3-only-q3-hover.png` | **approved** (2026-10-04) |
| G4-2 reload identical — mid-session (D-18) | **PASS.** Page reload mid-session → 3/3 artifact blocks `innerText`-identical to the live capture (compared by text, not image hash), 0 notices, no raw JSON, captions intact. | captions as G4-1, byte-identical | `G4-2-reload-midsession.jpg` | **approved** (2026-10-04) |
| G4-2 reload identical — after backend restart (D-18) | **PASS.** After the backend restart (PID 62784, started 2026-10-04 00:17:04): 3/3 identical, the PNG output-file card present, 0 notices. | as above | `G4-2-after-backend-restart.jpg` | **approved** (2026-10-04) |
| G4-3 broken spec → notice only (D-19) | **PASS** for the two arms driven, by in-page `fetch` rewrite of the `/threads/{id}/snapshot` response (no DB rows written; the crafted-row path was NOT used): chart 1 `component` → `gauge_widget`, chart 2 `spec.chart.kind` → `pie`. Result: 2 notices, chart 3 still rendered, answer text intact, `gauge_widget` absent from the page, no `{"`. Fetch patch removed by page reload. **Not driven live:** the missing-column reason arm; the migration-202 CHECK violation for `gauge_widget` (I-1 belt) — no rows were inserted, so nothing needed deleting. Rail step / parameters-area expansion not separately reported. | "This artifact can't be shown it asked for something other than a chart, table or metric. The rest of the answer is unaffected." · "This artifact can't be shown it asked for a pie chart, which isn't one of the chart kinds we can draw. The rest of the answer is unaffected." | `G4-3-notice.jpg` | **approved** (2026-10-04) |
| G4-4 PNG when asked, chart when asked (D-20) | **PASS** (sandbox ON). "From 273-board-revenue.csv, give me a bar chart of Q3 revenue by region as a PNG file I can download." (landed in the G4-1 thread due to composer focus) → `execute_code` → output-file card `q3_revenue_by_region.png` 69.7 KB, **no new artifact** (still 3). "Show me a chart" → artifact-block (G4-1). | `q3_revenue_by_region.png` · 69.7 KB | `G4-4-png-in-progress.jpg` | **approved** (2026-10-04) |

Board sign-off: **approved** (2026-10-04), including the deepseek V3 FAIL (F-1) and the OWED
STRUCTURED check, which were presented as such.

### Observations (measured, not pass/fail criteria)

- **O-1 (G4-2, cosmetic, hidden tab only):** while the Chrome window was hidden
  (`document.visibilityState = hidden`), chart 1's direct end-of-line labels were absent and the DOM
  signature differed; with the window visible they render and the signature is identical.
- **O-2 (V2 c):** a thread's FIRST open after page load sometimes showed an empty thread for up to
  7 s — the whole thread blank including the user message, not artifact-specific; likely pre-existing
  snapshot latency.
- **O-3 (G4-1 turn 3):** the plan's observable says "exactly ONE rail step" per follow-up turn; turn
  3 had TWO `show_artifact` steps (the first refused, the model self-corrected per D-12). Zero
  retrieval / code steps held.
- **O-4 (G4-1 row counts):** the plan's caption examples assumed 16 rows; the agent's `query_tables`
  returned the table pivoted to 4 rows (one per quarter, one series per region), so captions read
  "same 4 rows" / "1 of 4 rows" — consistent with "or the chart the agent referenced".
- **SEED-335 watch:** no "Unmarked claims" footer was observed on artifact-led answers in these
  drives (observation only; the seed was not edited).

## 3. 4-axis UAT bandwidth

| Axis | Row that exercised it | Result |
|---|---|---|
| Cross-provider | §1 board — 8 required rows (7 native + OpenRouter) + 1 extra self-hosted | PASS (V1/V2 8/8; V3 7/8, deepseek F-1) |
| Multi-tool | G4-1 turn 1: `query_tables` + `show_artifact` in one prompt | PASS |
| Parallel-thread | G4-1 driven in the browser while the board run streamed other threads via the API; each artifact landed in its own thread | PASS |
| Long-message | board prompt A (inline CSV with a notes column, 6,567 bytes ≥ 5,120) | PASS |
