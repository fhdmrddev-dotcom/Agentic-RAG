# Phase 273 — Validation (plan 273-06)

Rows are filled from PERSISTED data (`message_artifacts`, `messages.tool_calls`, `runs`, Redis
`run:{run_id}`) and from rendered content in a real browser — never from a transcript. Raw evidence:
`evidence/board/` (one JSON per run), `evidence/structured/`, `evidence/g4/`. Method and gate lines:
`273-UAT-LOG.md`.

Status at Task 1 close (2026-10-03): **skeleton only** — Task 3 fills §1-§4, Task 4 the sign-off.

## 1. SC#10 board (D-21 / SC#5) — 8 required rows, derived at run time

Roster: derived by `scripts/run-273-board.py --roster` from the EFFECTIVE registry (seed overlaid by
`model_capabilities_overrides`; enabled, not deprecated, not removed; newest per provider). The
Task 1 dry-run derivation is quoted in `273-UAT-LOG.md` §Roster.

Verdicts (all from persisted data):
- **V1 emitted** — run A: a `done` `show_artifact` call whose result is not a refusal, and a
  `message_artifacts` row with run A's `run_id`.
- **V2 rendered** — PASS needs all three: (a) board script: every `reload_artifacts` item is a record,
  never `{missing: true}`, count = the thread's rows; (b) `uat/273-board-render.test.ts` verdict line;
  (c) Chrome reload: `artifact-block` count = rows, `artifact-notice` = 0, screenshot
  `evidence/board/<provider>-reload.png`.
- **V3 by-reference** — run B created a row whose `parent_id` is run A's artifact, and run B made zero
  data-bearing / retrieval / `execute_code` calls.
- **Leak probe** (SC#2) — no Redis `delta` carries `show_artifact` or `"rows"`; no persisted ```json.

| # | Provider | Model (derived) | Mode | V1 | V2 (a / b / c) | V3 (B calls · parent) | refused A/B | empty / fallback | Leak probe | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | openai | OWED (Task 3) | | | | | | | | |
| 2 | anthropic | OWED (Task 3) | | | | | | | | |
| 3 | google | OWED (Task 3) | | | | | | | | |
| 4 | deepseek | OWED (Task 3) | | | | | | | | |
| 5 | zhipu | OWED (Task 3) | | | | | | | | |
| 6 | minimax | OWED (Task 3) | | | | | | | | |
| 7 | moonshot | OWED (Task 3) | | | | | | | | |
| 8 | openrouter | OWED (Task 3) | | | | | | | | |
| x | lmstudio (extra, self-hosted) | OWED (Task 3) | | | | | | | | |

### Structured-path observations (plan-check WARNING 9)

⚠ **Task 1 finding:** the effective roster predicts **no** derived row routes STRUCTURED — OpenRouter
resolves NATIVE under `openrouter_tool_strategy = quality` and every OpenRouter override row carries
`native_tools = true`. The only keyed, enabled STRUCTURED-routing id is
`lmstudio:nvidia_nvidia-nemotron-nano-9b-v2` (self-hosted). See `273-UAT-LOG.md` §Roster.

| Obs | Row | Prompt | Tool ran (persisted) | Call text in a `delta` | Rendered | Evidence |
|---|---|---|---|---|---|---|
| (i) search_documents turn | OWED | "What does our onboarding guide say about laptop setup?" | | | | |
| (ii) non-tool ```json reply | OWED | "Show me an example retention config as a JSON code block — do not call any tool." | — | delta == persisted? | live + reload | |

## 2. G-4 lived scenarios (D-17..D-20)

| Scenario | Claude result | Rendered-text quotes | Screenshots | Operator sign-off |
|---|---|---|---|---|
| G4-1 chart → "make it a bar chart" → "only Q3" (D-17) | OWED (Task 3) | | `evidence/g4/` | OWED (Task 4) |
| G4-2 reload identical — mid-session (D-18) | OWED (Task 3) | | | OWED (Task 4) |
| G4-2 reload identical — after backend restart (D-18) | OWED (Task 4) | | | OWED (Task 4) |
| G4-3 broken spec → notice only (D-19) | OWED (Task 3) | | | OWED (Task 4) |
| G4-4 PNG when asked, chart when asked (D-20) | OWED (Task 3) | | | OWED (Task 4) |

## 3. 4-axis UAT bandwidth

| Axis | Row that exercised it | Result |
|---|---|---|
| Cross-provider | §1 board | OWED |
| Multi-tool | G4-1 turn 1 (query_tables + show_artifact) | OWED |
| Parallel-thread | thread A's artifact run streams while thread B accepts a prompt | OWED |
| Long-message | board prompt A (inline CSV with a notes column, 6,567 bytes ≥ 5,120) | OWED |
