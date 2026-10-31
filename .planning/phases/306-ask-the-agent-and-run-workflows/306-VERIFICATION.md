---
phase: 306-ask-the-agent-and-run-workflows
verified: 2026-11-01T00:00:00Z
verification_mode: self-verified   # OV-SOLO-01 - NEVER "reviewed". No independent reviewer exists.
status: gaps_found
score: 3/5 roadmap success criteria fully verified in code (SC#2 and SC#4 carry gaps; SC#1, SC#3, SC#5 verified structurally)
overrides_applied: 0
gaps:
  - truth: "A key reads only what its narrowing allows: a folder-narrowed key never receives content from outside its folders (D-10/D-30, MCP-04 design; SC#2/SC#4 narrowing intent)"
    status: failed
    reason: "CR-01 CONFIRMED against code. start_ask inserts the thread with only origin_kind/origin_label/origin_ref (no folder_id, no expert); the folder wall exists only in memory as ThreadScoping(list(scope_folder_ids), None, None, None, None) for the first run_producer call. The continuation path (run_producer.py ~1126) re-resolves scope via _resolve_thread_scoping, which returns ThreadScoping(None,...) for a thread with no active_expert_id (run_producer.py:534-535), i.e. no folder filter. continue keeps the same run_id and finalizes it completed; read_ask (outside_ask.py:379-411) then passes _ACCESS_SQL and returns msg content + citations to the key. No 306 test drives cap-pause -> Continue -> get_answer."
    artifacts:
      - path: "backend/app/services/outside_ask.py"
        issue: "scope not persisted; read_ask relays content produced by an in-app continuation"
      - path: "backend/app/services/run_producer.py"
        issue: "_resolve_thread_scoping returns unscoped for an mcp-origin thread on continue"
    missing:
      - "Fail-closed fix in read_ask: if continues_used > 0 and status completed, return a pointer to the chat (answered_in_app), never the content (a few lines; G-3 fast-fix)"
      - "Test driving cap pause -> in-app Continue -> get_answer with a narrowed key"
  - truth: "Everything returned to the AI tool goes through the outbound guard and defanging (GUARD-03 from 305, applied to SC#4's get_workflow_run result)"
    status: failed
    reason: "CR-02 CONFIRMED. results.py:302 declares end_reason: str | None (not RedactableText); run_tools.py:279 and :281 pass read.end_reason with no R.defang. The guard rewrites only RedactableText fields, so a failed/stopped run's reason (often LLM-written from document content) leaves unredacted and undefanged."
    artifacts:
      - path: "backend/app/mcp/results.py"
        issue: "line 302 end_reason plain str"
      - path: "backend/app/mcp/run_tools.py"
        issue: "lines 279/281 no defang"
    missing:
      - "end_reason: RedactableText | None and R.defang(...) on both arms (about 3 lines; G-3 fast-fix) plus a redaction test"
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
---

# Phase 306: Ask the Agent and Run Workflows - Verification Report

**Phase Goal:** From an MCP client, a member can ask the agent a question and get a cited answer, and can start a published workflow and follow it to its result, under admission limits that leave in-app users unaffected, with no path from an outside prompt to the sandbox, the web or any write.
**Status:** gaps_found (two confirmed review criticals; both small fast-fixes)
**Re-verification:** No, initial.

## Success Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | ask_agent answer + citations + confidence within budget; handle; idempotent retry | VERIFIED in code, UAT owed | ask_tools.py has idempotency claim (line ~104), wait budget, get_answer; tools.py registers both; read_ask returns citations/confidence_level/disclaimer; outside_admission.py idempotency claims hash the key bound to credential. Client timeout measurement owed (IN-05). |
| 2 | Read-only tools only on every provider; needs-person ends as "needs input in the app" + link | PARTIAL: tool closure VERIFIED; folder-wall hole (CR-01) | Seam B in tool_dispatcher is the first branch with a durable thread-origin read (review confirms all dispatch sites incl. resume and sub-agents); needs_input via run_is_cap_paused with chat_link. Roster rows OWED. CR-01 means a narrowed key can receive out-of-folder content after an in-app Continue. |
| 3 | Ask appears in thread history marked MCP | VERIFIED structurally | start_ask stamps origin_kind='mcp', origin_label, origin_ref at thread INSERT (outside_ask.py:224-231); migration 223 applied locally; frontend RunOriginLine / UserMessageBubble / outsideAskEnvelope in review file list. G-4 drive owed. WR-06 (orphan thread on partial failure) is a warning. |
| 4 | list/run/get workflow run; waiting shows person + link, not answerable; key reads only its runs; out-of-scope refused | PARTIAL | run_tools.py implements all three; waiting arm returns defanged who + link; folder-subset check present (IN-04 narrow race, WR-04 include_external gap are warnings). CR-02: end_reason unredacted/undefanged on failed/stopped runs. |
| 5 | Admission: try again in N s / 429 Retry-After; in-app unaffected; Redis down refuses outside, in-app continues; spend by org and key | VERIFIED structurally, UAT owed | inbound.py:311 Retry-After header; outside_admission.py fail-closed on any Redis error (D-17), single Lua script ZSET leases; rates.py spend CTE carries api_key_id/tool. WR-05 notes over-attribution of in-app follow-ups to the key; WR-03 notes an in-app DB read at Seam B. Burst rows OWED. |

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| MCP-04 | PARTIAL | Implemented; CR-01 weakens the narrowing guarantee |
| MCP-05 | SATISFIED (code) | origin stamp + UI mark; G-4 owed |
| MCP-06 | PARTIAL | implemented; CR-02 on result text; WR-04 |
| GUARD-01 | SATISFIED (code) | admission + 429 + spend; live burst owed |

All four IDs are claimed by plans and mapped to Phase 306 in REQUIREMENTS.md (lines 112-114, 126); no orphans. REQUIREMENTS.md checkboxes remain unticked.

## Findings Driven Against Code

- **CR-01: CONFIRMED** (see gap 1). Not mitigated by Seam B, which only holds the tool allow-list, not the folder wall.
- **CR-02: CONFIRMED** (see gap 2). results.py:302 and run_tools.py:279/281 read directly.
- Warnings WR-01..06 and IN-01..06 in 306-REVIEW.md not independently re-driven; they are not success-criterion breaks. WR-02 (unshielded cancellation cleanup) and WR-04 (include_external not applied to workflows) are worth triage in the same fix round.

## Behavioral Spot-Check

`pytest tests/unit -q -k 306`: all passed (no failures). No test covers CR-01 or CR-02, so green here does not contradict them.

## Gap-Closure Triage (G-7 / G-3)

No ROADMAP criterion is wholly unmet, but both criticals are small and security-bearing: sized as /gsd:fast-class fixes (about 3 lines and about 6 lines, no schema or API surface). Fix both, plus tests, rather than opening a planned round. WR-04 and WR-02 are candidates to fold in; the rest can be accepted or deferred.

## Human Verification

See frontmatter: roster, burst/admission, G-4 history mark, client timeouts. Migration 223 cloud paste is an operator-gated deploy step, not a gap.

---
_Verified: 2026-11-01_
_Verifier: Claude (gsd-verifier)_
