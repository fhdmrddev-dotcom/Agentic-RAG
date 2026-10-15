---
phase: 282-the-slow-run-and-the-paused-run
plan: 03
type: validation
authored: 2026-10-15
authored_before_drives: true
requirements: [FIX-06, FIX-07]
---

# Phase 282 — Validation (UAT rows)

The rows below are authored BEFORE any live drive (CLAUDE.md "UAT scoreboard recipe": UAT rows live
here, not in PLAN.md tasks). Results go in `282-LIVE-EVIDENCE.md`, one block per row. Every row is
either PASS with pasted DOM / DB reads and run ids, or ⛔ / OWED with a reason and an issue id
("n/a — configuration" when no issue exists). **No row is ever omitted** — a board that lists only
what passed is not a board.

## Manual UAT rows (SC#10 + G-4)

### Method (applies to every row)

- **Drive:** `POST /threads/{id}/messages` with a per-request `model` + `provider`, authenticated as the
  operator's signed-in user (JWT read from the Chrome session the operator signed into; never written to a
  file; never a service-role write). **No global setting is mutated** by any board row.
- **Pause prompt (two options):** "Before answering, use the ask_user tool to ask me which colour I
  prefer: Red or Blue. Then reply with one sentence naming my choice."
- **Answer:** option **Blue**, via `POST /runs/{run_id}/ask_user_response` (the path `answerAskUser` uses)
  or the UI.
- **Verdict reads:** the `runs` row (status, error, created_at, updated/completed time), the final assistant
  `messages` row, and the ask's own request/response events. A screenshot or a testid's presence alone is
  never evidence.
- **Active org** is proven before each drive (DOM org switcher text + the user's memberships read) — the dev
  account is in two orgs.
- **Backend sha** is proven before the first drive (the operator names it; Claude compares it with
  `git rev-parse HEAD` on develop).

### SC#10 board — the full native roster plus OpenRouter (D-16)

Roster re-derived 2026-10-15 at `3c9bb11ab` from `app.config.MODEL_CAPABILITIES` grouped by `provider`
(eight groups; newest registry-backed id per group). It matches 282-RESEARCH R10 exactly.

| # | Provider | Model (registry-backed) | Note | Axis | FAIL if |
|---|---|---|---|---|---|
| 1 | OpenAI | `gpt-5.6-sol` | Responses surface (exercises the Responses client builder) | **multi-tool** | run not `completed`; final message does not name Blue; `runs.error` carries a provider/timeout error; any of `search_documents`, `execute_code`, `ask_user` absent from the run's tool events |
| 2 | Anthropic | `claude-sonnet-5` | native SDK (`_anthropic_client`) | **parallel-thread, Thread A** | as row 1 (pause + answer); for the axis: A's ask was not still pending when B completed (timestamps), or A did not then answer and complete |
| 3 | Google | `gemini-3.5-flash` | native genai (`_google_client`); one attempt | **parallel-thread, Thread B** | run not `completed` / no Blue / provider error; B did not complete while A's ask was pending |
| 4 | DeepSeek | `deepseek-v4-pro` | `strict_json_schema` inert | **long-message (≥ 5 KB prompt)** | prompt byte length < 5120; run not `completed` / no Blue / provider error |
| 5 | Zhipu | `glm-5.2` | | — | run not `completed` / no Blue / provider error |
| 6 | MiniMax | `MiniMax-M3` | | — | run not `completed` / no Blue / provider error |
| 7 | Moonshot | `kimi-k2.6` | `emit_tier: coerce` (weakest emission guarantee) | — | run not `completed` / no Blue / provider error |
| 8 | OpenRouter | `z-ai/glm-5.2` | `native_tools: False` — the non-native tool path | — | run not `completed` / no Blue / provider error |

- **Multi-tool (row 1):** one prompt that asks for a knowledge-base search, a short `execute_code`
  computation, and the ask_user pause. Each tool's call is recorded from the run's events. If the sandbox
  is disabled (`SANDBOX_ENABLED` false), `execute_code` cannot run and the axis is ⛔ with that reason.
- **Parallel-thread (rows 2 + 3):** Thread A (row 2) is driven to its pending ask and left unanswered;
  Thread B (row 3) is sent and driven to completion; then A is answered and completes. Recorded: A's ask
  `created`, B's `completed_at`, A's answer time, A's `completed_at`.
- **Long-message (row 4):** the prompt carries ≥ 5 KB of deterministic filler text (byte length recorded)
  ahead of the pause instruction.
- **If an axis's assigned row is ⛔** (no key, or a defect), the axis moves to the next keyed row and the
  move is recorded; the ⛔ row stays in the table with its reason.
- **Assumption A1 (LangSmith nesting):** for row 1 (Responses) and one OpenAI-compat row (5 or 7), if
  LangSmith is configured, record whether the `ChatOpenAI` span nests under the agent-loop run; otherwise
  "LangSmith off — A1 unverified".
- **Board-wide FAIL if** (roadmap "How we'd know this failed"): the board lists only the rows that passed;
  any row is blank; a global setting changed during the board.

### G-4 rows (D-17), Chrome at ≥ 1280 px, DOM state read via evaluate

| Row | Scenario | Reads (DOM / DB) | FAIL if |
|---|---|---|---|
| G4-1 | **Deep pause, panel open** (sketch 282 variant A, D-10). A cloud model raises the pause prompt with the workspace panel open. | count of buttons named "Send Answer" in `document`; `closest('[data-ask-home]')` of that button; `[data-testid="ask-pointer"]` present in the chat column; `[data-testid="ask-pointer-draft"]` text; after clicking `[data-testid="ask-pointer-go"]`: `document.activeElement.closest('[data-ask-home="panel"]') !== null` and the active element is the `[role="radio"][tabindex="0"]` chip; after ArrowDown: the `[aria-checked="true"]` chip's label and the pointer draft text | "Send Answer" count ≠ 1 (two inputs for one pause); the input is not inside `[data-ask-home="panel"]`; no pointer in chat; `Answer in panel →` does nothing or focus lands outside the card; the pointer draft ≠ the checked chip; the selected option can only be told apart by colour (the radio mark is absent) |
| G4-2 | **Workflow pause, panel on the rail** (BUG-260828-07). Run the workflow-pause candidate `fresh-pause-102uat-20a89243` (id `f59d361b-bc73-4f6c-b856-1a499195b59f`, its definition read first to confirm it raises a human pause; else another published workflow with one, recorded). Collapse the panel to the rail. | "Send Answer" count; its `[data-ask-home]` (must be `chat`); no `ask-pointer`. Select option 2 and type "because" in the chat card; open the panel: panel card's `aria-checked` option + textarea `value`, and the pointer draft; collapse again: chat card's `aria-checked` option + textarea `value` | no reachable input with the panel on the rail (the SHELL-03 failure a third time); "Send Answer" count ≠ 1 in either state; the checked option or the textarea value differs between renderings; the pointer draft ≠ the card's |
| G4-3 | **Two threads paused at once.** Raise pauses in Thread A and Thread B; choose different options (and type text in one). Switch A → B → A. | per thread, at each visit: the `aria-checked` option and textarea `value` | a draft is lost, changed or copied between threads on any switch |
| G4-4 | **Slow local model past 600 s** (D-09 part 3, D-26). LM Studio on :1234, a model with a 900 s Registry timeout, loaded on GPU; a prompt designed to make ONE model call run past 600 s. While it is in flight, send a short message in a second thread on a cloud model. | the run's start / end and the call's duration (run events or LM Studio server log); run status + final message; any SSE re-attach near 610 s (expected, not a failure); the second thread's streaming (live observation for BUG-261015-02) | the run fails with a timeout before 900 s; the call completes > 600 s but the run is not `completed` with the model's answer. **⛔ OWED, not FAIL,** if no prompt makes the call exceed 600 s on this hardware: the measured maximum is recorded and the SCALED automated test (`test_282_slow_stub_scaled.py`) stays the proof. A Resume button or flicker at re-attach is filed as a separate bug, not this row's failure |
| G4-5 | **Registry refusal on screen** (SC#1 live, read-only). Model Registry → edit a model's Timeout. | `[data-testid="timeout-help"]` text while editing (must equal `Between 1 and 1800 seconds. Local models and Google models are tried once. Other cloud providers retry quick failures up to 2 times.`); type 1801 + Enter; the row's `[data-model-error]` / `role=alert` text (must equal `Timeout must be between 1 and 1800 seconds, because a longer call would outlast the run watchdog, which ends a run that has been silent for 2400 s. 1801 was not saved.`); the model's stored `llm_call_timeout_seconds` before and after (DB read, unchanged) | the UI accepts 1801 (or 3600); a value is stored; the sentence differs; the help line is absent while editing |
| G4-6 | **The timeout sentence (optional — needs operator approval of ONE reversible local write).** Record a local model's current `llm_call_timeout_seconds`; set it to 20 in the Registry; run a prompt that takes longer; restore the recorded value and read it back. | `runs.error` (must start `timed_out:` and contain `did not answer within 20 s`); the restored value read back from the DB | the error lacks the prefix or the sentence; the prior value is not restored exactly. **Skipped (recorded as declined), not FAIL,** if the operator declines the write |

### UI-SPEC "Owed at G-4" (operator confirmation at Task 4)

1. Sketch 282 variant A itself (D-10, G4-1).
2. The 32 px pointer button height.
3. **Space selects only; Enter or click deselects** (D-24 supersedes the UI-SPEC's "Space deselects").
4. The chip focus ring raised from `ring-1` to `ring-2 ring-offset-2`.
5. The help line showing only while the Timeout cell is edited.
6. The pointer rendering nothing once the ask is settled.
7. Whether the run-failure sentence should become visible beyond the RunCard hover title (a follow-up, not
   this phase).

### Evidence-gated flips (Task 3)

- BUG-260918-01 → `closed` only if G4-1, G4-2 and G4-3 PASS.
- BUG-260916-01 → `closed` only if G4-4 and G4-5 PASS (G4-4 ⛔ OWED keeps it `folded`, naming the scaled test
  as the automated half).
- BUG-261015-02 → `closed` citing `test_282_open_off_loop.py` green on the merged sha, plus G4-4's
  second-thread observation when recorded.
- SEED-172 → stays `partially-answered`; findings #2 and #3 (timeout field) recorded as answered by 282,
  #4 open.

### Amendment at drive time (2026-10-15, recorded rather than silently changed)

The pause prompt above was driven verbatim in pass 1. Every native row's question expired after about 60 s,
before it could be answered, because the models chose that `timeout_seconds` (BUG-261015-03). **Pass 2**
appended "with timeout_seconds set to 1200" to the prompt and is the verdict pass. The FAIL conditions are
unchanged. Details are in `282-LIVE-EVIDENCE.md` under "Prompt amendment".
