# Phase 292 — Validation (plan 292-03)

Rows are filled from PERSISTED data (`message_artifacts`, `messages.tool_calls`, `runs`, the
GET `/threads/{id}/messages` reload) and from the shipped frontend guard run over that data. Raw
evidence lives under `evidence/`: `board/` (one JSON per board run, plus the long-message run),
`g4/` (the D-21..D-23 prompts, one thread each), `parallel/`, `crafted/`, `probes/`, `roster.txt`,
`seed.txt`, `board-summary.json`, `board-reload-check.json`, `g4-reload-check.json`. Method and gate
lines: `292-UAT-LOG.md`.

Status (2026-10-24): **board, probes and API-level reload FILLED; every BROWSER observation is OWED**
to the orchestrator's Chrome drive (this executor had no Chrome MCP tools). Verdict words are literal:
PASS = measured and met · OBSERVATION = measured, not a pass/fail criterion · OWED = not measured yet
· ⛔ = blocked, with the reason. The operator sign-off column reads `owed` until signed.

Today for every date computation below: **24 Oct 2026** (local machine date at the run).

## 1. Success criteria

| SC | What | Result | Evidence |
|---|---|---|---|
| SC#1 | The closed set is six; nothing from D-02's rejected list shipped | PASS — `ComponentName` = chart, table, metric, diagram, comparison, timeline on both stacks (`artifactParity292.fence.test.ts`); live CHECKs list the same six (migration 213 VERIFY 8/8); SEED-337 reads `partially-answered` (A shipped, B open) | `292-UAT-LOG.md` §Gates 1; `.planning/seeds/SEED-337-…md` |
| SC#2 | The agent shows each new type and it renders; a type outside the registry is refused | Backend + guard halves PASS: 8/8 required rows emitted all three types, every reloaded record passes `parseArtifactRecord` (11/11 uat cases); `mindmap` refused in words with keys `status/reason/detail`; the crafted bad row is refused by the guard with `broken-link`. **Browser half OWED** (G4-1..G4-4) | §2, §4 |
| SC#3 | Same artifacts on reload, on at least two native providers | API half PASS on 9 board files + 6 G-4 files across 8 providers (spec, caption, label, row_count byte-identical to the first reload and to the DB). **Browser half OWED** (G4-5) | `evidence/board-reload-check.json`, `evidence/g4-reload-check.json` |
| SC#4 | 30 tools on the merged tree; pins unedited | PASS — closed-core pins `63 passed`; only 292-01's `test_273_tool_wiring.py` enum edit differs from base | `292-UAT-LOG.md` §Gates 5 |

## 2. SC#10 board (D-26) — 8 required rows, derived at run time

Roster: `scripts/run-292-board.py --roster` (run-273's `derive_roster` over the effective registry;
newest enabled, non-deprecated id per provider). Quoted in `292-UAT-LOG.md` §Roster.

Prompt (one turn per row, per-request `model` + `provider`, a fresh thread, no setting mutated):
*"Using our documents: show how invoice approval works as a flow diagram; compare the Atlas and
Borealis contracts on termination, liability and renewal; and show the Atlas contract's history and
upcoming deadlines as a timeline."* Preceded by `--seed`: three generated fixtures ingested
(`completed`), and the real `retrieval_service.search_documents` finds each (`SEED verdict: OK`).

Verdicts per type, from persisted data:
- **V1 emitted** — a `show_artifact` call, status done, not refused, whose result names an artifact id
  that is a `message_artifacts` row of that component carrying this run's `run_id`; run `completed`.
- **V2 rendered** — (a) backend half: the GET reload returns that record (never `{missing: true}`) and
  the reload count equals the thread's rows; (b) guard half:
  `ARTIFACT_BOARD_EVIDENCE_292=… npx vitest run uat/292-board-render.test.ts` → **1 file, 11 tests
  passed** (non-vacuity + 9 evidence files + the crafted row refused); (c) browser half: **OWED**.
- **Sources** — elements carrying a resolved source / elements (observation).

| # | Provider | Model (derived) | diagram V1 / V2(a,b) | comparison V1 / V2(a,b) | timeline V1 / V2(a,b) | sourced d · c · t | first-try refusals (all retried to success) | Evidence (thread) |
|---|---|---|---|---|---|---|---|---|
| 1 | anthropic | claude-opus-5-5 | PASS / PASS | PASS / PASS | PASS / PASS | 12/12 · 10/10 · 8/8 | diagram: a step name is over 48 characters | `1b65b231-ee3e-448f-b832-02c60677e355`; `board/anthropic-f430de8c-….json` |
| 2 | deepseek | deepseek-v4-pro | PASS / PASS | PASS / PASS | PASS / PASS | 11/11 · 8/8 · 8/8 | none | `4a7c5232-25f9-4ef0-bec0-ffd1a8f78424`; `board/deepseek-b2f898c2-….json` |
| 3 | google | gemini-3.8-flash | PASS / PASS | PASS / PASS | PASS / PASS | 0/10 · 0/10 · 0/8 | none | `8e68079c-12b5-41bd-b4c5-a96750a90fe7`; `board/google-620b2edf-….json` |
| 4 | minimax | MiniMax-M3 | PASS / PASS | PASS / PASS | PASS / PASS | 12/12 · 24/24 · 9/9 (excerpt null on all) | diagram: its settings weren't valid (`nodes` top-level); diagram: a step name is over 48 characters | `a3cd6b54-748a-4f01-8cf3-aa624854bd27`; `board/minimax-dcfee604-….json` |
| 5 | moonshot | kimi-k3 | PASS / PASS | PASS / PASS | PASS / PASS | 0/11 · 0/14 · 0/8 | diagram: a step name is over 48 characters; comparison: a comparison was sent another artifact type's fields (`transform`) | `da6a928b-e498-420e-adbd-99928da4ebaf`; `board/moonshot-fadb07de-….json` |
| 6 | openai | gpt-5.6-luna | PASS / PASS | PASS / PASS | PASS / PASS | 11/11 · 10/10 · 8/8 | diagram: a step name is over 48 characters; a link label is over 24 characters; two links join the same two steps | `249ca06b-4fb3-46eb-ad1c-f417972117f7`; `board/openai-3452108c-….json` |
| 7 | zhipu | glm-5.3-flash | PASS / PASS | PASS / PASS | PASS / PASS | 11/11 · 12/12 · 8/8 | diagram: a step name is over 48 characters; a link label is over 24 characters | `8732c1c2-dbc9-4f41-a57b-efc0e580bac8`; `board/zhipu-6f228661-….json` |
| 8 | openrouter | z-ai/glm-5.3-flash | PASS / PASS | PASS / PASS | PASS / PASS | 12/12 · 6/12 · 8/8 | diagram: a step name is over 48 characters; comparison: its settings weren't valid (`options` top-level); diagram: a link label is over 24 characters | `31c9b505-f1e5-462c-8993-8bf2155df8a6`; `board/openrouter-839fc4a8-….json` |
| x | lmstudio (EXTRA, self-hosted) | qwen-agentworld-35b-a3b | ⛔ | ⛔ | ⛔ | — | ⛔ extra self-hosted group, not one of the 8 required; not driven unless named in `--providers` | — |

**Totals (8 required rows):** V1 24/24 PASS · V2 (a) 24/24 PASS · V2 (b) all reloaded records parse
· V2 (c) OWED · runs completed 8/8 · artifact rows per thread 3, reload records 3, missing 0 on every
row.

Observations (not pass/fail):
- **O-1 The 48-character step-name cap is the most common first-try refusal**: 7 of 8 rows sent a
  longer node label first and recovered on the worded refusal. The refusal loop works as designed
  (273 D-12); the tool description could state the cap more prominently if first-try success matters.
- **O-2 Sources depend on which retrieval tool the model used.** Rows that retrieved with
  `search_documents` carry excerpts on every sourced element. MiniMax (query_documents / grep /
  analyze_document) resolves every source to a document with `excerpt: null`. Google (query_documents
  + read_document) and Moonshot sent no source numbers (0 sourced). The guard accepts all of these.
- **O-3 Borealis renewal.** The fixture has no renewal clause. Rows 1, 5, 6 rendered at least one
  `q` (Not stated) cell; rows 2, 3, 4, 7, 8 wrote a `n`/`m` verdict with text instead (0 `q` cells).

## 3. The 4-axis bandwidth (CLAUDE.md UAT scoreboard recipe)

| Axis | Row | Result | Evidence |
|---|---|---|---|
| Cross-provider | The 8-row board above (full native roster + OpenRouter) | PASS on the backend + guard halves; browser half OWED | §2 |
| Multi-tool | The board turn itself: every row called a retrieval tool and three or more `show_artifact` calls in ONE turn (e.g. openai: 4 × `search_documents`, 6 × `show_artifact`, `write_todos`) | PASS | `board/*.json` → `score.tool_call_names` |
| Parallel-thread | `--parallel --providers deepseek`: thread A's board turn sent, thread B's timeline turn sent while A's run read `streaming`; both `completed`; A's diagram / comparison / timeline (`a_bmdx11tz1s`, `a_zjf7qohyo1`, `a_8lmetdadsx`) carry thread A `838fdecf-eafb-4ac4-96f8-e96202a06a2a`, B's timeline `a_71l0vjmekm` carries thread B `938bfa44-15de-419c-9543-1c04f05c3d8c` | API PASS; **Chrome drive OWED** (the plan wants it typed in the browser) | `parallel/deepseek-parallel.json`, `probes/parallel.txt` |
| Long-message | `--long --providers openai`: 5195-byte prompt (the three fixtures inlined + the board ask) | PASS — diagram, comparison, timeline all V1/V2 PASS (thread `1fd310c2-5cc0-4124-bf0a-66373482333e`; sources 0, as the content was inline) | `board/openai-long-69764a21-….json` |

## 4. G-4 lived scenarios (D-21..D-25)

The threads below were created by `scripts/run-292-board.py --g4` on two native rows with the
D-21..D-23 prompts. For each, the stored spec gives the expected observables, computed by the script
independently of the frontend code (`expected_observables` in each evidence file). The orchestrator
drives each in Chrome at **375px, the default chat column and a wide window**, per UI-SPEC §"G-4
observables", and fills the Result column.

### F-1 — the verbatim D-22 prompt does not produce a comparison (finding)

*"Compare these two contracts on termination, liability and renewal: the Atlas Logistics MSA and the
Borealis Freight MSA."* → **no `show_artifact` call on 3 runs across 2 native providers**
(anthropic ×2: `c4c6bd2d-f05a-46f6-9933-69cf3f1683b2`, `b589517c-84d5-45b2-934d-db9fa139e4dc`;
openai ×1: `49bbac20-1b04-4a8e-8002-da3fc71142e2`). Each answered with a markdown table after
`query_documents` / `analyze_document`. The same ask with *"Show it side by side."* appended produced
a comparison on both rows (G4-2b below), as did the board prompt on all 8 rows. Whether a plain
"compare" should trigger the matrix is a product decision (tool-description steering), not fixed
here. G4-2's browser drive uses the G4-2b threads.

| Row | Scenario | Threads / artifacts | Independently computed expectations (from the stored spec) | Claude's result | Evidence | Operator sign-off |
|---|---|---|---|---|---|---|
| G4-1 | Diagram (D-21) | anthropic `937db3b1-00ed-413b-a883-4f39d9a0c784` · `a_6zmv3disqf` (diagram 1); openai `4f2e3c27-39ea-44bb-bec7-6fbdfc5a1b2f` · `a_evukjb6vu0` | anthropic: caption `· 10 steps · 11 links`; 1 back edge (`rej->match`) → 1 dashed path; degree per node: Invoice received 1, Three-way match 3, Does the invoice match the PO? 3, Rejected 2, Budget holder approves 2, Invoice above €10,000? 3, Finance controller sign-off 2, Scheduled 3, Paid 2, Filed 1. openai: `· 12 steps · 13 links`, 1 back edge (`resubmit->match`). Every label's words appear in the policy document (coverage ≥ 0.75 per label); every sourced node names `292-invoice-approval-policy.md` and its excerpt is a substring of that document (10/10 anthropic, 11/12 openai) | Backend + guard PASS (both rows emitted, both parse, reload identical). **Browser OWED: kind chip `Flow diagram`; label chip `diagram 1`; pairwise node-rect intersection = 0 at 3 widths; `scrollWidth <= clientWidth` at 375px (body and page); hover AND focus each node → highlighted path count == degree above; dashed path count == back-edge count above; tooltip document + excerpt as above; caption text as above** | `g4/anthropic-G4-1-diagram-….json`, `g4/openai-G4-1-diagram-….json` | owed |
| G4-2 | Comparison (D-22, via G4-2b) | anthropic `a3e4c7e3-cc78-4002-951f-a0347ad101c8` · `a_gdk3d2vnw4` (comparison 1); openai `3e0c408c-97e6-4ec3-950c-af74ce1cfa20` · `a_91uke5giiv` | anthropic: 2 options × 9 terms, 18 cells, **4 `q` (Not stated)**, **N = 1** identical term (`Indemnities`). openai: 2 × 7, 14 cells, **2 `q`**, **N = 1** (`Indemnities`). Second caption line: `Verdicts are the agent's reading. Hover or focus a cell for its clause.` All cell sources resolve to the right contract with `excerpt: null` (O-2), so the tooltip should name the document only | Backend + guard PASS. **Browser OWED: kind chip `Comparison`; exactly one glyph badge per option cell with an sr-only word from the four; no blank `td`; ≥ 1 italic `Not stated` (`getComputedStyle().fontStyle`); toggle drops exactly N rows, `aria-pressed="true"`, `{N} identical term(s) hidden` with N above; second caption line verbatim; sticky term column at 375px; what the tooltip shows for a null excerpt.** Alternative with excerpts: board openai `249ca06b-…` · `a_d9gad5mrif` (N = 0 → toggle disabled; 1 `q`) | `g4/*G4-2b-sidebyside-comparison-*.json`; F-1 files `g4/*G4-2-comparison-*.json` | owed |
| G4-3 | Timeline (D-23) | anthropic `3f591838-f667-4a2e-8c2f-6672c52c5238` · `a_cnsv8wlx9b` (timeline 1); openai `48c78b9e-e978-4131-ae74-5d4dd9244913` · `a_tw7gmutb35` | Rail, top to bottom (both rows): filled `14 Mar 2023` MSA signed · filled `1 Apr 2023` · **gap 10 months** · filled `9 Feb 2024` · **gap 9 months** · filled `Nov 2024` · filled `15 Jan 2025` · **gap 15 months** · filled `1 Apr 2026` · **Today `24 Oct 2026`** · hollow `15 Dec 2026` renewal notice deadline, amber, **`in 52 days`** · hollow `15 Mar 2027` end of term, deadline, **`in 142 days`**. 8 events, sorted ascending | Backend + guard PASS. **Browser OWED: kind chip `Timeline`; rendered dates ascending == the order above; exactly one Today row reading `24 Oct 2026` (or the drive-day date, recomputed); filled vs hollow dots by computed `background-color`; amber ring + `in N days` with N recomputed for the drive day; gap rows exactly as above. Negative-UTC run (`America/Los_Angeles`): emulate if the Chrome MCP can, else ⛔ with the reason** | `g4/anthropic-G4-3-timeline-….json`, `g4/openai-G4-3-timeline-….json` | owed |
| G4-4 | Unknown type refused (D-24) | Probe: direct `handle_show_artifact` (no thread write). Crafted row: thread `8ef83b95-201c-4219-8e2a-188533fd192c`, assistant message `ce0f4811-6087-4ce6-aaf4-9f597b5adf32`, artifact `a_rvhc2e8nbd` (diagram 1, edge `ok → zz`, node `zz` absent), tool call `call_292crafted7401b003` | Probe payloads (verbatim): `mindmap` → `{"status": "refused", "reason": "\"mindmap\" is not an artifact type", "detail": "`component` must be one of chart, table, metric, diagram, comparison, timeline. Use a table for anything else."}`; `flowchart` → reason `something other than a chart, table, metric, diagram, comparison or timeline`; diagram `from_artifact: "table 1"` → reason `a table can't be turned into a diagram; send the data again`. Keys exactly `detail, reason, status` on all three; 0 events emitted; `message_artifacts` 22 → 22 (no write) | Probe PASS. Guard half PASS: the crafted record is refused with `broken-link` (uat runner). **Browser OWED: the crafted thread shows only `artifact-notice` reading `its saved data links to a step that isn't in it (zz). Ask the agent to draw it again.` plus the answer text `Invoices are matched against the purchase order, then approved and paid.`; page text, the rail's expanded body and the parameters area contain none of `{"`, `nodes`, `edges`, `verdict`, `events`, `component`. A live rail refusal step can be checked on any board thread with a first-try refusal (e.g. openai `249ca06b-…`: amber `refused · a step name is over 48 characters`)** | `probes/refusal-probe.txt`, `probes/craft-bad-row.txt`, `crafted/crafted-bad-row.json` | owed |
| G4-5 | Reload identical (D-25 / SC#3) | The G4-1..G4-3 threads above (anthropic + openai = two native providers), plus every board thread | API half: `--reload-check` re-fetched GET `/threads/{id}/messages` and compared `label`, `component`, `spec`, `caption`, `row_count` with the first reload AND the DB row: **identical on all 9 board files and all 6 G-4 files that have an artifact** (the three F-1 files have none, by construction) | API PASS. **Browser OWED: for each G-4 thread on both providers, every card's `textContent` before == after a page reload; screenshots at the same viewport and date; captions and label chips byte-identical; one reload screenshot per non-blocked board row at `evidence/board/<provider>-reload.png`** | `evidence/board-reload-check.json`, `evidence/g4-reload-check.json` | owed |

## 5. Owed to the orchestrator (Chrome drive), in order

1. **G4-4 crafted row** (thread `8ef83b95-…`) — the cheapest and the one whose failure would be a
   leak; then a live amber refusal step on board openai `249ca06b-…`.
2. **G4-1** on both diagram threads at 375 / default / wide.
3. **G4-3** on both timeline threads, then the `America/Los_Angeles` run or ⛔.
4. **G4-2** on both G4-2b threads (record what the tooltip shows for a null excerpt).
5. **G4-5** reload comparison on the G-4 threads (two native providers) and one reload screenshot per
   board row under `evidence/board/`.
6. **Parallel-thread in the browser**: start the board prompt in a new thread A, send a prompt in a
   new thread B while A streams; each artifact must land in its own thread (`message_artifacts.thread_id`).

Then the operator signs the G4 rows.

## 6. Orchestrator — final gates after the review fixes, and the Chrome drives (2026-10-24)

**Final gates on develop @ b76727282 (all review fixes in):**
- Backend unit gate: `70 failed, 9246 passed, 1 skipped, 2 xfailed, 2 xpassed` — ceiling 71; 0 phase-292/artifact tests among the 70.
- Vitest count gate (quiet machine, `GSD_VITEST_MAX_WORKERS=2`): `total 11878 · failed 0 · count gate OK — 504/504 pinned files present, no per-file decrease`. The plan-03 red (`WorkflowBuilderPage.canvas.test.tsx` 6.3 s timeout under board load) did not recur: confirmed a load flake, not a regression.
- Frontend typecheck `tsc -p tsconfig.app.json`: 63 errors at HEAD == 63 at base; 0 in phase-292 files.

**Chrome drives (Chrome MCP, dev operator account):**

## G4-4 PASS
- Crafted thread 8ef83b95 (a_rvhc2e8nbd): only artifact-notice "This artifact can't be shown / its saved data links to a step that isn't in it (zz). Ask the agent to draw it again. / The rest of the answer is unaffected."; answer text present; leak tokens {" nodes edges verdict events component: none in main innerText, also with the rail expanded. Rail line "Flow diagram · 3 steps, 3 links". Screenshot: C:\Users\fhdmr\AppData\Local\Temp\claude-chrome-screenshots-kYzCgb\screenshot-1792807446010-25.jpg
- Live refusal steps, board openai 249ca06b: three amber (text-amber-700, rgb(180,83,9)) rail lines "refused · a step name is over 48 characters", "refused · a link label is over 24 characters", "refused · two links join the same two steps", then Flow diagram · 11 steps, 11 links / Comparison · 2 options × 5 terms / Timeline · 8 events rendered. No leak tokens. Screenshot: ...screenshot-1792807496031-26.jpg
## G4-3 anthropic 3f591838 (a_cnsv8wlx9b) PASS
- chips Timeline + timeline 1; caption "Data: search_documents · 8 events"; 12 rows in order: 14 Mar 2023, 1 Apr 2023, "10 months later", 9 Feb 2024, "9 months later", Nov 2024, 15 Jan 2025, "15 months later", 1 Apr 2026, Today "Today, 24 Oct 2026 … everything below hasn't happened yet", 15 Dec 2026 Deadline "in 52 days", 15 Mar 2027 Deadline "in 142 days". Matches expectations exactly.
- dots: past bg rgb(107,114,128) filled; Today rgb(79,70,229) (indigo-600, UI-D-292-23 light theme); upcoming bg white (hollow) border amber rgb(217,119,6) class border-2 (computed 1.6px = 2px snapped at DPR 1.25); pills rgb(180,83,9) amber.
- screenshots ...-27.jpg (top) ...-28.jpg (Today + deadlines)
- 375px: Chrome MCP resize_window is a no-op here (innerWidth stays 1536, window maximized) → viewport 375 ⛔ not emulable. Container emulation: artifact host max-width 343px (375 − 2×16) → fig 343, scrollWidth==clientWidth (341), 0 elements outside the frame; only sr-only spans clip (by design). Screenshot ...-30.jpg. Media-query (sm:) behaviour NOT covered by this emulation.
- America/Los_Angeles run ⛔: Chrome MCP has no timezone emulation (no CDP Emulation.setTimezoneOverride); covered only by unit tests (timelineModel parses integer parts, no new Date(iso)).
## G4-3 openai 48c78b9e (a_tw7gmutb35) PASS — identical 12-row order, Today 24 Oct 2026, deadlines, caption "Data: search_documents · 8 events".
## G4-2 anthropic a3e4c7e3 (a_gdk3d2vnw4) PASS
- chip Comparison / comparison 1; headers Term | Atlas Logistics MSA | Borealis Freight MSA; 9 rows, 18 cells, 0 blank td; sr-only words {Favourable, Unfavourable, Neutral, Not stated}; 4 visible italic "Not stated" (== 4 q expected); caption 2nd line verbatim "Verdicts are the agent's reading. Hover or focus a cell for its clause."
- toggle: aria-pressed false→true, rows 9→8, "1 identical term hidden" (Indemnities) == N=1.
- null-excerpt tooltip: shows the document name only ("292-borealis-msa.md"). Screenshot ...-31.jpg
## G4-2 openai 3e0c408c (a_91uke5giiv) PASS — 7 rows, 14 cells, 0 blank, 2 italic Not stated (== 2), toggle 7→6 "1 identical term hidden", aria-pressed true.
## G4-5 reload (browser) — timeline + comparison threads, anthropic + openai (two native providers): every <figure>'s textContent captured, full page reload, thread reopened, compared: IDENTICAL on all 4 (timeline anthropic 1099 chars, timeline openai 1292, comparison anthropic 1466, comparison openai 1450). (First post-reload read of 2 threads raced the initial load and read 0 chars; re-read with a poll → identical.) Diagram threads: pending (after the review fixes).

**Blocked at the time of writing:** the backend (uvicorn --reload, reloader PID 70864) hung after the fixer's edits — its worker (PID 81012, started 06:19:42) predates the last fix commits and `/health` does not answer. Standing rule: Claude never kills or starts the operator's backend. Owed after the operator restarts it: F-1 live re-check, G4-1 diagrams, the two diagram reloads (G4-5), the browser parallel-thread row.

### 6b. After the operator restarted the backend (2026-10-24 08:28, worker started after every fix commit)

- **F-1 live re-check — PASS (after a WR-02 revision).** Verbatim D-22 prompt, plain "compare":
  - anthropic: thread `d86ed98f-af52-49c0-a13e-07b6d577cb00` → `a_s3linno6w0` comparison 1 (9 terms, 5 Not stated, N = 1), after one WR-02 refusal it retried itself.
  - openai first try: thread `757df2e2-95b8-410d-86ba-96d483fdda11` → it now CALLED show_artifact comparison (the F-1 steering works) but hit the WR-02 refusal "a cell marked not stated cites a source" and abandoned the artifact (no retry). **Finding → fix:** WR-02 changed from refuse to drop (`65e48efd7` RED, `637a1f3cf` GREEN): a q cell's source is set to None by both the args and the stored model, the same neutralisation the frontend guard applies. Targeted suites: backend 598 passed, frontend fences + artifacts 288 passed.
  - openai after the fix: thread `ce2a8536-c4f5-4379-9435-54ec294407dd` → `a_v0ku01ley6` comparison 1, **0 refusals**.
- **G4-1 diagrams — PASS.**
  - anthropic `937db3b1` (`a_6zmv3disqf`): chips `Flow diagram` / `diagram 1`; caption `… · 10 steps · 11 links`; 10 nodes, 0 pairwise overlaps; 1 dashed path (== 1 back edge); focus on each node lights exactly its degree **1,3,3,2,2,3,2,3,2,1** (== the independently computed list); tooltip shows `292-invoice-approval-policy.md` + the excerpt; no sideways scroll (scrollWidth == clientWidth 731). At a 343px container: 10 nodes, 0 overlaps, 0 elements outside the frame (edge labels included, WR-04), 1 dashed. Screenshot `screenshot-1792816198757-32.jpg`.
  - openai `4f2e3c27` (`a_evukjb6vu0`): caption `… · 12 steps · 13 links`; 12 nodes, 0 overlaps, 1 dashed; lit-edge degrees sum to 26 (== 2 × 13 links); no sideways scroll.
  - Cosmetic observation (not a defect against UI-SPEC): tooltip excerpts are raw chunk text, so markdown markers such as `**Decision: …**` show literally. Safe (React text). Candidate polish: strip markdown emphasis in `excerpt_for`.
- **G4-5 diagram reloads — PASS.** Both diagram threads: every figure's textContent identical before/after a full page reload (476 / 473 chars). G4-5 is now 6/6 G-4 threads on two native providers in the browser, plus the API half on all board rows.
- **Parallel-thread in the browser — PASS.** Thread A2 `44df5135` (three-type board prompt) ran 04:37:37–04:38:27 UTC; thread B2 `8e4721ce` was sent at 04:37:49 **while A2 streamed** (sidebar read "2 running") and finished 04:38:03. A2 holds `diagram 1` / `comparison 1` / `timeline 1`; B2 holds its own `timeline 1`; every `message_artifacts.thread_id` matches its thread. A2 renders all three cards, 0 notices, 0 leak tokens. (A first attempt with a short prompt finished A before B was sent — overlap not proven, so it was redone.)
- **Still ⛔:** a real 375px viewport and America/Los_Angeles (Chrome MCP limits; container emulation passed).
- **Still owed:** operator sign-off on G4-1..G4-5.
