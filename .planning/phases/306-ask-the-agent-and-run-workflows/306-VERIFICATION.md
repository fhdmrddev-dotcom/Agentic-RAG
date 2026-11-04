---
phase: 306-ask-the-agent-and-run-workflows
verified: 2026-11-01T00:00:00Z
reverified: 2026-11-01T00:00:00Z
verification_mode: self-verified   # OV-SOLO-01 - NEVER "reviewed". No independent reviewer exists.
status: human_needed
score: 5/5 roadmap success criteria verified in code; lived / cross-provider / burst / G-4 rows OWED
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "CR-01 folder wall (read_ask no longer relays content from a continued run)"
    - "CR-02 end_reason through the outbound guard and defanged"
  gaps_remaining: []
  regressions: []
gaps: []
resolved_gaps:   # history of the first verdict, kept visible; both closed by quick task 261101-4y9
  - truth: "A key reads only what its narrowing allows: a folder-narrowed key never receives content from outside its folders (D-10/D-30, MCP-04 design; SC#2/SC#4 narrowing intent)"
    status: RESOLVED
    original_reason: "CR-01: start_ask persists no folder scope on the thread; an in-app Continue re-resolves scope unscoped (run_producer _resolve_thread_scoping), keeps the same run_id and finalizes completed; read_ask then returned content + citations to the key."
    resolution: "read_ask now selects COALESCE(r.continues_used,0); a completed run with continues_used > 0 returns status answered_in_app (chat link only) before the messages read. Cap-pause check still runs first."
  - truth: "Everything returned to the AI tool goes through the outbound guard and defanging (GUARD-03 from 305, applied to SC#4's get_workflow_run result)"
    status: RESOLVED
    original_reason: "CR-02: RunRead.end_reason was plain str and run_tools passed read.end_reason undefanged."
    resolution: "RunRead.end_reason is RedactableText | None; run_tools._shape defangs it in both the failed and stopped arms."
known_accepted:
  - "A member's own in-app Continue on an MCP-origin thread still runs without the key's folder narrowing. Accepted: the result stays in the app, which the member can already fully see, and the key can no longer read it. Follow-up: persist the ask scope on the thread so the continuation inherits the wall."
carried_debt:
  - "WR-01..WR-06 from 306-REVIEW.md (incl. WR-02 unshielded cancellation cleanup, WR-03 in-app DB read at Seam B, WR-04 include_external not applied to workflows, WR-05 over-attribution of in-app follow-ups to the key, WR-06 orphan thread on partial failure). Not success-criteria failures."
human_verification:
  - test: "8-row native roster + OpenRouter MCP ask, audit shows read-only tools only, even when the prompt asks for power tools (SC#2)"
    expected: "No execute_code / web / write / memory / skill save in any row's audit; rows blocked recorded with reason"
    why_human: "Live providers and keys; scripts/uat-306-ask-roster.py exists, rows OWED in 306-VALIDATION.md"
  - test: "Burst of outside starts vs a simultaneous in-app chat (SC#5)"
    expected: "Outside gets 'try again in N s' / 429 Retry-After; in-app not slowed; Redis down -> outside refused, in-app continues"
    why_human: "Needs live Redis and concurrent load; scripts/burst-306-outside-starts.py, rows OWED"
  - test: "G-4 lived-experience: MCP ask shows in thread history with the MCP mark and question bubble (SC#3); waiting-on-person link for a paused run (SC#4)"
    expected: "Recognisable mark in ChatHistoryColumn; link opens the chat/run in the app"
    why_human: "Visual UI, Chrome MCP drive"
  - test: "Client wait-budget behaviour in Claude Code / Cursor (SC#1)"
    expected: "ask_agent returns within about 30 s or a handle; get_answer reads later; same idempotency key returns same run"
    why_human: "Real MCP client timeouts (IN-05 notes budget plus post-work approaches 52 s at the 45 s ceiling)"
  - test: "Live cap-pause -> in-app Continue -> get_answer with a folder-narrowed key reads answered_in_app (CR-01 end to end)"
    expected: "Key gets only the chat sentence and link, no content or citations"
    why_human: "Unit tests drive read_ask with a stubbed pool; the live Continue path is not driven"
---

# Phase 306: Ask the Agent and Run Workflows - Verification Report

**Phase Goal:** From an MCP client, a member can ask the agent a question and get a cited answer, and can start a published workflow and follow it to its result, under admission limits that leave in-app users unaffected, with no path from an outside prompt to the sandbox, the web or any write.
**Status:** human_needed (all automated criteria hold; owed live rows remain)
**Re-verification:** Yes, after quick task 261101-4y9 (CR-01 + CR-02). The first verdict (gaps_found) is retained below as history.

## Re-verification (2026-11-01)

### Fix checks against the original gap paths (code read, not SUMMARY)

- **CR-01 closed.** `backend/app/services/outside_ask.py` `_ACCESS_SQL` now selects `COALESCE(r.continues_used, 0) AS continues_used`. In `read_ask`, order is: access row (None if not the key's own run) -> status != completed returns status words -> **`continues_used > 0` returns `AskRead(status="answered_in_app", **base)`** -> only then the `messages` fetch. `base` carries no answer/citations, so no content path remains for a continued run. The cap-pause check (`run_is_cap_paused`) runs before the status branch, so a re-paused continued run still reads `needs_input` (tested). Premise confirmed: `app/api/runs.py` Continue increments `continues_used` on the same `runs` row keyed by run_id (lines 1371-1394), the same column `read_ask` reads. `answered_in_app` is in `AskStatus` and `_ASK_END`, so `render` emits only the chat-link sentence. Test `test_a_continued_run_reads_answered_in_app_and_never_reads_the_message` asserts no `FROM public.messages` call, answer None, citations [].
- **CR-02 closed.** `RunRead.end_reason` is `RedactableText | None` (results.py); `run_tools._shape` computes `R.defang(read.end_reason)` once and uses it in both the failed and stopped arms. New `test_306_cr02_end_reason_guard.py` asserts `"end_reason" in redactable_fields(R.RunRead)` (the guard's own walk), email masked with switch on, same object with switch off, defang in both arms, None preserved.
- Cosmetic: `msg =await pool.fetchrow(...)` (missing space) in outside_ask.py; valid Python, lint-only.

### Spot-check

`cd backend && venv/Scripts/python.exe -m pytest tests/unit -q -k "306 or 305"` -> **834 passed, 11030 deselected, 1 warning, 0 failures.** (Executor reported full backend gate 70 failed, all inherited, under the 71 ceiling; not re-run here.)

### Success criteria re-scored

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | ask_agent answer + citations + confidence within budget; handle; idempotent retry | VERIFIED in code, UAT owed | ask_tools idempotency claim + wait budget + get_answer; read_ask returns citations/confidence for uncontinued runs (test retained). Client timeout measurement owed. |
| 2 | Read-only tools only on every provider; needs-person ends as "needs input in the app" + link | VERIFIED in code, roster OWED | Seam B tool closure unchanged; needs_input via run_is_cap_paused with chat_link; the folder-wall hole is closed (CR-01). Known-accepted item below. |
| 3 | Ask appears in thread history marked MCP | VERIFIED structurally, G-4 owed | origin stamp at thread INSERT; frontend mark. |
| 4 | list/run/get workflow run; waiting shows person + link; key reads only its runs; out-of-scope refused | VERIFIED in code | run_tools implements all three; end_reason now guarded and defanged (CR-02). |
| 5 | Admission: try again in N s / 429 Retry-After; in-app unaffected; Redis down refuses outside; spend by org and key | VERIFIED structurally, burst OWED | inbound Retry-After, fail-closed Redis (D-17), Lua leases, spend CTE with api_key_id/tool. |

### Requirements

| Requirement | Status |
|-------------|--------|
| MCP-04 | SATISFIED (code); live roster owed |
| MCP-05 | SATISFIED (code); G-4 owed |
| MCP-06 | SATISFIED (code) |
| GUARD-01 | SATISFIED (code); live burst owed |

### Known and accepted (not a gap)

A member's own in-app Continue on an MCP-origin thread still runs without the key's folder narrowing. The result stays in the app, which the member can already fully see, and `read_ask` no longer relays it to the key. Follow-up: persist the ask scope on the thread so the continuation inherits the wall.

### Carried debt

WR-01..WR-06 from 306-REVIEW.md (and IN-01..06): not success-criteria failures; triage later.

## History: initial verification (gaps_found, now RESOLVED)

Initial verdict scored 3/5 with two confirmed review criticals: **CR-01** (a folder-narrowed key could receive out-of-folder content after an in-app Continue, because scope was never persisted and read_ask relayed the continued run's message) and **CR-02** (`end_reason` plain `str`, undefanged, bypassing the outbound guard). Both were sized as G-3 fast-fixes and closed by quick task 261101-4y9; see the re-verification section above. At that time `pytest -k 306` was green with no test covering either, which did not contradict them.

## Human Verification

See frontmatter: roster, burst/admission, G-4 history mark, client timeouts, and one live end-to-end drive of the CR-01 path. Migration 223 cloud paste is an operator-gated deploy step, not a gap.

---
_Verified: 2026-11-01 (initial), re-verified 2026-11-01_
_Verifier: Claude (gsd-verifier)_
