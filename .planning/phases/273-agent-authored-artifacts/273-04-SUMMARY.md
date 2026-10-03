---
phase: 273-agent-authored-artifacts
plan: 04
subsystem: agent-loop
tags: [agent-loop, history, reload, rls, streaming, structured-mode, sse]

requires:
  - phase: 273-01
    provides: "models/artifact.py result contract (artifact_id_from_result, is_refusal_result, ROWS_PLACEHOLDER_*), ToolContext.turn_tool_calls, message_artifacts table + RLS"
provides:
  - "backend/app/services/artifact_history.py — redact_artifact_args (the loop's one persist hook) + attach_artifacts (reload)"
  - "backend/app/services/structured_text_holdback.py — StructuredTextHoldback, the STRUCTURED-path delta gate"
  - "MessageResponse.artifacts on GET /messages and GET /snapshot"
  - "turn_tool_calls=persisted_tool_calls in both agent_loop ToolContext builds (caption source for 273-03)"
affects: [273-03, 273-05, 273-06, frontend reload mapper]

tech-stack:
  added: []
  patterns:
    - "Persist-time redaction of model-authored inline data: a pure pass over completed_tools before the row is written"
    - "Reload attach keyed by the id parsed from the persisted tool RESULT, never by call id or run"
    - "Gate EMISSION, never ACCUMULATION: the parser sees exactly the text it saw before"

key-files:
  created:
    - backend/app/services/artifact_history.py
    - backend/app/services/structured_text_holdback.py
    - backend/tests/unit/test_273_artifact_history.py
    - backend/tests/unit/test_273_reload_attach.py
    - backend/tests/unit/test_273_loop_wiring.py
    - backend/tests/unit/test_273_structured_holdback.py
  modified:
    - backend/app/services/agent_loop.py
    - backend/app/api/threads.py
    - backend/app/models/message.py
    - backend/tests/unit/test_bug_260912_01_turn_boundary_event.py

key-decisions:
  - "A show_artifact result cut at 2000 chars is no longer valid JSON; the id is read from the result PREFIX when the whole object does not parse (the id is the first key precisely so the cut keeps it)"
  - "rows that are a list but whose result is neither stored nor refused (a dispatch error) become '<not stored, N rows>' — still redacted, still built from ROWS_PLACEHOLDER_NOT_STORED"
  - "The holdback holds from the first complete opener to stream end; a non-tool ```json block is flushed at the end, byte-for-byte"
  - "The STRUCTURED fold is guarded on non-whitespace released text, so a call with no preamble opens no empty fold"

patterns-established:
  - "Every turn_boundary emit site is guarded on streamed text to fold AND precedes a full_content reset — fenced at every site, not just the first"

requirements-completed: [ART-02, ART-03, ART-05]

duration: ~70min
completed: 2026-10-03
---

# Phase 273 Plan 04: Artifacts in history, on reload, and out of the STRUCTURED stream — Summary

**Every `show_artifact` call's inline rows are replaced at persist time by a reference built from
the 273-01 placeholders (stored or refused), reload attaches the stored records to the right
messages by the artifact id parsed from the persisted result through one RLS-bound select, and on
the STRUCTURED calling path a tool-call block is never streamed as answer text — the preamble
folds like native narration and NATIVE delta sequences are byte-identical.**

## Base

Worktree started on `master` (`86d9559bb`, the known agent-worktree quirk) and was reset to the
expected base `a692f5cc8` (develop, wave 1 merged) before any edit.

## Task Commits

1. **Task 1 RED** — `ad2b9a6e6` test(273-04): failing tests for args redaction, reload attach and loop wiring
2. **Task 1 GREEN** — `ab94a87f1` feat(273-04): persist-time args redaction, caption-source kwargs and reload attach
3. **Task 2 RED** — `380ce1cd2` test(273-04): failing tests for the STRUCTURED-path tool-call holdback
4. **Task 2 GREEN** — `5b4b4f96d` fix(273-04): hold STRUCTURED-path tool-call text out of the streamed answer

## Every agent_loop.py hunk (line numbers at `5b4b4f96d`)

| Lines | Task | What | Authority |
|---|---|---|---|
| 64 | 1 | `from app.services.artifact_history import redact_artifact_args` | D-15 |
| 1981 | 1 | `completed_tools = redact_artifact_args(completed_tools)` inside `_persist_assistant_message`, immediately before `row["tool_calls"] = _strip_nul(completed_tools)` | D-15 (the one persist hook) |
| 2176 | 1 | `turn_tool_calls=persisted_tool_calls,` in the RESUME ToolContext build | D-15 |
| 3078 | 1 | `turn_tool_calls=persisted_tool_calls,` in the MAIN ToolContext build | D-15 |
| 65 | 2 | `from app.services.structured_text_holdback import StructuredTextHoldback` | **OV-273-04** |
| 2339-2340 | 2 | `_structured_holdback: StructuredTextHoldback \| None = None`, reset per provider attempt beside `tool_calls_buffer` | **OV-273-04** |
| 2388-2395 | 2 | the `delta` emit: `full_content += _text` UNCHANGED; `None` holdback → `_emit(... content=_text)` exactly as before; otherwise emit `feed(_text)` when non-empty | **OV-273-04** |
| 2621-2623 | 2 | in the OpenAI-compat branch after `open_stream`, `if calling_mode == CallingMode.STRUCTURED: _structured_holdback = StructuredTextHoldback()` | **OV-273-04** |
| 2692-2701 | 2 | at the STRUCTURED parse: `finish(bool(structured_calls))`; parsed + released preamble → `_emit('turn_boundary')` BEFORE the `tool_preparing` emits and BEFORE `full_content = ""`; unparsed → flush the held text as one `delta` | **OV-273-04** |

`git diff --stat a692f5cc8 HEAD -- backend/app/services/agent_loop.py` → `28 insertions, 1 deletion`. Task 1 touched
exactly the import, the hook and the two kwargs (`+4`). The in-turn assistant message still uses
the raw `tc["arguments"]` string (fenced). `SYSTEM_PROMPT` is byte-identical to PHASE_BASE
(sha256 `7265842c…49c23`, 11,844 chars, fenced). The anthropic/google branch, the DSML leak path,
the persisted content and every native branch are unchanged.

**OV-273-03 stays OWED:** the prompt-assembly seam in `agent_loop.py` was not taken; guidance lives
in the tool description (273-03).

## threads.py hunks (zero send-path branches)

| Lines | What |
|---|---|
| 88 | `from app.services.artifact_history import attach_artifacts` |
| 600 | `get_snapshot`: `messages = await attach_artifacts(...)` directly after `_enrich_messages_with_runs` |
| 1509 | `get_messages`: the same, directly after `_enrich_messages_with_runs` |

Added non-comment lines: **3** (≤ 4). AST fence: `attach_artifacts` is called exactly twice, once in
each read route, never in `send_message`.

## The STRUCTURED-mode drive result

`run_agent_loop` driven for real (only I/O replaced: `open_stream` returns canned canonical events,
`dispatch_tool`, `insert_assistant_message`, aexec/pool/capability/timeout; `tool_parser._KNOWN_TOOLS`
pinned so the drive does not depend on 273-03's schema):

- **STRUCTURED show_artifact** (preamble + a 12-row fenced call, 7-char chunks, then a 5-char-chunk
  answer): no `delta` contains `show_artifact` or `"rows"`; the deltas join to exactly
  `preamble + answer`; exactly ONE `turn_boundary`, before the first `tool_preparing`; persisted
  content is the answer only; the persisted call's `args.rows` is `<stored in artifact a_k3j9x0p2qd, 12 rows>`.
- **STRUCTURED search_documents**: no delta carries the call; dispatched as `("search_documents", {"query": "revenue 2024"})`; one fold.
- **STRUCTURED call with no preamble**: no `turn_boundary` (no empty fold).
- **STRUCTURED non-tool ```json reply**: deltas join == persisted content, byte-for-byte; no fold; no dispatch.
- **NATIVE**: the emitted delta list equals the provider chunk list exactly (11-char chunks, including a fenced block).

At base the three STRUCTURED call drives were RED for the right reason (the call text streamed;
`turn_boundary` count 0); the NATIVE and non-tool-json drives were green at base — they are the
regression guards. The guarded-fold property was driven RED by a plant (`if structured_calls:`
without the `released_text` guard): `test_every_site_is_guarded_on_something_to_fold` and
`test_a_call_with_no_preamble_opens_no_fold` both failed; the file was restored md5-identical
(`8b3190f2…`).

**The live check of this fix is the OpenRouter board row in 273-06** (every OpenRouter registry
row is `native_tools: False`, so it is the STRUCTURED path in production).

## Verification

- `pytest test_273_artifact_history.py test_273_reload_attach.py test_273_loop_wiring.py test_075_5_google_native.py` → 53 passed
- `pytest test_273_structured_holdback.py test_273_artifact_history.py test_273_loop_wiring.py test_273_reload_attach.py test_bug_260912_01_turn_boundary_event.py` → 60 passed
- agent_loop / structured / turn_boundary / gateway suites (`test_250_run_honesty_agent_loop`, `test_reasoning_first_routing`, `test_provider_gateway_seam`, `test_262_provider_hint_inference`) → 111 passed
- Every suite that reads threads.py / agent_loop.py / ToolContext / `_reconstruct_history` / MessageResponse (71 files) → 12 failed / 1070 passed; **all 12 are in 273-BASELINES.md's SET** (chat_tool_approval, explorer_agent ×6, forced_emit, phase56, streaming_reliability, 071_1 ×2)
- `node scripts/check-hot-file-ledger.cjs .planning/phases/273-agent-authored-artifacts` → `ledger gate OK`
- **Backend unit gate, verbatim:**
  `71 failed, 6640 passed, 1 skipped, 2 xfailed, 2 xpassed, 44 warnings in 483.12s (0:08:03)` /
  `[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).`
  The failed SET was extracted (`grep "^FAILED " | sed … | sort -u`) and `diff`ed against
  273-BASELINES.md's 71: **identical**. passed `6585 → 6640` = `+55` = this plan's 52 new cases + 3
  new `TestEverySiteIsGuarded` cases — no residual.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `test_bug_260912_01_turn_boundary_event.py` located "the" boundary by first occurrence**
- **Found during:** Task 2 GREEN
- **Issue:** its cases used `src.index("turn_boundary")`. The plan-required STRUCTURED emit sits
  EARLIER in the file than the native one, so the index silently moved to the new site and two
  positional cases failed (window did not contain `if full_content:`; the reset was > 600 chars away).
- **Fix:** anchor the native site explicitly (the last emit site) so the three original cases keep
  their exact windows, and add `TestEverySiteIsGuarded` — exactly two sites; EVERY site guarded on
  `if full_content:` or `.released_text`; EVERY site followed by `full_content = ""`. Stronger than the
  single-site fence it replaces; driven RED by the plant above.
- **Files:** `backend/tests/unit/test_bug_260912_01_turn_boundary_event.py` (outside the plan's file list)
- **Commit:** `5b4b4f96d`

**2. [Rule 1 - Bug, own test] one holdback case asserted the wrong release**
- `test_a_trailing_partial_opener_is_held_then_released_when_disambiguated` (RED commit) expected a
  chunk ending in a closing ```` ``` ```` to be released whole; a trailing ```` ``` ```` can still become
  ```` ```json ```` and is correctly held until the next chunk. Expectation corrected in `5b4b4f96d`.

**3. [Rule 2 - Missing critical] a cut result would have lost the stored reference**
- The loop persists `result[:2000]`; a long success result is then invalid JSON and
  `artifact_id_from_result` returns None, so the redaction would have written `<not stored…>` over a
  stored artifact and reload would have attached nothing. `artifact_history._artifact_id` falls back
  to a prefix match on `{"artifact_id": "a_…"` (built from `RESULT_ID_KEY`). Pinned by
  `test_a_result_cut_at_2000_chars_still_yields_the_stored_reference`.

### Recorded edges (not changed)

- If a STRUCTURED stream both trips the DSML sanitizer AND leaves held text that does not parse, the
  DSML notice delta is emitted before the flushed held text (persisted order is held-then-notice).
  DSML is a DeepSeek NATIVE-path phenomenon; the DSML path was deliberately not touched.
- A transient provider retry mid-stream discards that attempt's held text from emission while
  `full_content` keeps it — the pre-existing retry behaviour for accumulated text, unchanged.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register: the reload read is the user-JWT client + explicit thread/user
filter (T-273-21), every show_artifact rows is redacted incl. refused (T-273-22), the holdback gates
the delta emit (T-273-23), a failed attach marks ids missing and never raises (T-273-25).

## Notes

- `graphify update .` NOT run in the worktree (`graphify-out/` is tracked and modified in the main
  checkout; updating here would manufacture a merge conflict). Run after the wave merges.
- The hot-file ledger rows for `agent_loop.py` / `threads.py` / `models/message.py` were NOT
  re-derived here — not in this plan's file list; the ledger gate reads OK.
- STATE.md / ROADMAP.md untouched (orchestrator-owned).

## TDD Gate Compliance

RED `ad2b9a6e6` → GREEN `ab94a87f1` (Task 1; RED failed at collection on the missing module + 7 fence
failures); RED `380ce1cd2` → GREEN `5b4b4f96d` (Task 2; 20 RED, the 2 regression guards green at base).

## Self-Check: PASSED

Files present: artifact_history.py, structured_text_holdback.py, the four test_273_* suites.
Commits present in `git log`: `ad2b9a6e6`, `ab94a87f1`, `380ce1cd2`, `5b4b4f96d`.
