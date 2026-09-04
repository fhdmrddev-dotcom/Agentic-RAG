---
phase: 227
from: claude (reviewer)
to: gemini (builder)
posted: 2026-09-03
head: 8416c8bed
purpose: "AGENTS.md §3.1 measurement pack — facts with no recommendation attached, supplied BEFORE discuss-phase opens. The builder decides what to do with them."
---

# Phase 227 — Measurement pack

Everything below is re-derived from the tree at `8416c8bed` on 2026-09-03. No cell is copied forward.

## 1 · Gate baselines (read the verdict line, never a summary)

| Gate | Command | Reading |
|---|---|---|
| Vitest count gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) | **FAIL `[failing-tests] 1 test(s) failed`** · total **7258** (224 close read 7234; +24 = the five landing suites pinned at 226's merge) · 1730 files. The one failure: `src/pages/WorkflowBuilderPage.canvas.test.tsx` → *"flag ON (D-183-01) clicking Canvas flips aria-selected…"*, `STACK_TRACE_ERROR`. That file is one of **SEED-171's five** cap-independent flaky suites and is **provably unmodified** — `git diff --numstat HEAD~6..HEAD -- frontend` names only `src/App.tsx` (9/1). Recorded as an observation, not proof of innocence; taken from the gate's persisted JSON before any re-run |
| TypeScript | `npx tsc -p tsconfig.app.json --noEmit` in `frontend/` | **66 errors** (baseline; Phase 224 and 225 both read 66) |
| Backend unit | `pytest tests/unit -q` in `backend/` | **71 failed / 3483 passed / 2 xfailed / 2 xpassed** (2026-09-03, 1m18s) — matches the 224 and 225 readings of 71 |
| Backend full tree | `pytest tests -q` in `backend/` | **265 failed / 5446 passed / 1 error** (2026-09-03, 8m02s) — none name oauth, connector or mcp; a different scope from the unit reading |

## 2 · G-5 triples, re-derived (`commits / phases / lines`)

| File | Re-derived today | CLAUDE.md row says | Drift |
|---|---|---|---|
| `frontend/src/components/chat/MessageItem.tsx` | **62 / 33 / 822** | 58 / 29 / 863 | +4 phases since the row was written; row reads *extraction due* |
| `frontend/src/components/chat/ToolCallPanel.tsx` | **50 / 22 / 1019** | 50 / 19 / 1019 | +3 phases; row reads *extraction due* |
| `frontend/src/components/chat/RunCard.tsx` | **25 / 11 / 693** | 24 / 10 / 688 | +1 phase; row reads *honoured by construction (194 / 214)* |
| `frontend/src/components/chat/ChatArea.tsx` | **68 / 33 / 633** | 67 / 32 / 595 | +1 phase |
| `frontend/src/components/chat/MessageList.tsx` | **19 / 8 / 267** | 19 / 8 / 267 | current |
| `frontend/src/components/panel/WorkspacePanel.tsx` | **16 / 10 / 646** | 16 / 10 / 646 | current |
| `frontend/src/providers/StreamsProvider.tsx` | **86 / 35 / 4174** | 85 / 34 / 4144 | +1 phase |
| `frontend/src/components/chat/FoldTrigger.tsx` | **1 / 1 / 76** | no row | new in 224-05 |

`SeamCard.tsx` and `TodosSection.tsx` do not exist at HEAD (224 deleted the seam card; the todos section lives elsewhere).

## 3 · Where the run frame is rendered today (line-anchored, for the seam audit)

- `MessageItem.tsx:468` mounts `<RunCard message isStreaming />`.
- `MessageItem.tsx:758` renders the terminal status sentence (`"Agent reached time limit"` / `"Response stopped"`) — OUTSIDE the `RunCard` mount, in `MessageItem`'s own terminal block (`:731-760`).
- `RunCard.tsx:264` builds the collapsed-row label `Run · N steps` from ONE integer (`:239-264`); `:391` mounts `<StepIdentity>`; `:445-449` documents the duplicate-row removal at 214.
- `ToolCallPanel.tsx` owns the step rows; `:420-430` carries the operator's 2026-08-31 noise audit that conflicts with the right-aligned result column (ROADMAP flag).
- The ROADMAP entry quotes `MessageItem.tsx:841` (*"ADDITIVE ONLY — a new sibling renderer …"*); at HEAD that file is 822 lines, so the quoted line number is stale — the comment moved or was deleted with the seam card in 224.

## 4 · Covering suites and where each stands with the count gate

The gate has TWO knobs: `TARGETS` decides what RUNS; `BASELINE` decides what is GUARDED. A suite can sit on the wrong side of exactly one.

| Suite | Mentions in `scripts/vitest-count-gate.cjs` |
|---|---|
| `chat/RunCard.test.tsx` | pinned (29) + targeted |
| `chat/RunCard.timer.test.tsx` | pinned (7) + targeted |
| `chat/__tests__/ChatArea.approval.test.tsx` | pinned + targeted (224-05) |
| `chat/__tests__/ChatArea.model.test.tsx` | 3 mentions |
| `__tests__/components/MessageItem.finalOutputs.test.tsx` | pinned (11, 195-02) + targeted |
| `chat/__tests__/MessageItem.test.tsx` | **0 mentions** |
| `chat/__tests__/MessageItem.blockedNotice.test.tsx` | **0** |
| `chat/__tests__/MessageItem.harnessBanner.test.tsx` | **0** |
| `chat/__tests__/ChatAreaBanner.test.tsx` | **0** |
| `chat/__tests__/ChatAreaMode.test.tsx` | **0** |
| `__tests__/components/MessageItem.{test,clamp,fallbackNotice,memo,sticky}.test.tsx` | **0** (five suites) |
| `__tests__/components/RunCard.logo.test.tsx` | **0** |
| `__tests__/components/ToolCallPanel.test.tsx` | **0** — the only suite named for `ToolCallPanel` |
| `__tests__/components/chat/MessageList.{test,dedup,runline.baseline}.test.tsx` | **0** (three suites) |
| `panel/__tests__/WorkspacePanel.{test,derived}.test.tsx` | 16 mentions (pinned) |

ROADMAP SC#5 for 227 reads *"the covering suites are in `TARGETS`/`BASELINE` before the refactor starts."* Fourteen of the suites above have zero mentions.

## 5 · Open reported bugs whose `affected_areas` touch this surface (`status: open`, `surface: Agentic-RAG`)

| Id | Title (file) | affected_areas |
|---|---|---|
| BUG-260902-01 | workspace panel shows in-progress for a run that timed out | frontend/panel, frontend/chat, run-honesty |
| BUG-260902-07 | references footer opens by default and its control is buried | frontend/chat, citations, reasoning, readability (224 closed both halves via `FoldTrigger`; status still reads `open`) |
| BUG-260828-07 | approval buttons absent in chat thread | PendingAskCard.tsx, ChatLayout.tsx |
| BUG-260828-08 | whole page scrolls in chat | ChatLayout.tsx |
| BUG-260823-01 | tool-call smooth scroll re-arms the pin | frontend/streaming, frontend/chat, UX/scroll |
| BUG-260823-02 | tool history replays staggered entrance as a blink wave | frontend/chat, UX/motion, a11y |
| BUG-260818-01 / -02 / -03 | resume replays the prompt · resume drops the model · iteration cap shows Stop not Continue | frontend/chat, streaming, run-lifecycle |
| BUG-260718-02 / -03 | chat/streaming/citations · chat/workspace-panel | — |
| BUG-260610-01 | workflow-run nav timer reset, duplicate avatar | frontend/streaming, run-honesty |
| BUG-260609-02 | — | frontend/panel, harness/sub-agents |

## 6 · Seeds naming `RunCard` / `MessageItem` / `ToolCallPanel` / the run frame (not shipped)

| Seed | status |
|---|---|
| SEED-030 streaming silence-gap UX | open (ROADMAP 224 SC#5 cites it) |
| SEED-128 collapsible reasoning run timeline | planted (224 requirement; check whether 224 flipped it) |
| SEED-169 RunCard file badge reads zero for a workflow deliverable | planted |
| SEED-148 workflow output files not surfaced | open |
| SEED-098 chat tool-card dedup / unified essence line | done |
| SEED-058 chat-surface UX polish | planted |
| SEED-033 inline citation source attribution | planted |
| SEED-092 app-wide WCAG AA contrast | planted |
| SEED-056 / SEED-049 / SEED-171 | test-infrastructure seeds (vitest baseline triage, e2e revival, flaky suites) |

## 7 · Things Phase 224 left for 227 (from `224-SUMMARY.md` / STATE)

- Two must-haves deferred with a trigger: the right-aligned step-result column and the terminal status line moving inside the frame. Both need a file outside 224's `files_modified`. ROADMAP says the column has an unresolved conflict with the 2026-08-31 noise audit and is deliberately NOT built in 227.
- Three 224 checks never ran live: the terminal-glyph removal (no stopped/timed-out run in the sample), the docked approval card (needs a live connector pause), the 300 px todo wrap.
- `test_chat_tool_approval.py::…_emits_event_and_pauses` fails on `KeyError: 'call_id'` — pre-existing, unowned.

## 8 · Constraints already on the record

- §3.1: *"Whoever built 224 must not review this — the two share their entire blast radius."* 224-01..03 were Gemini, 224-04/05 were Claude.
- G-2 in the unusual direction: the bar is visual and needs a before/after browser drive by the operator.
- No migration, no wire change, no new dependency.
