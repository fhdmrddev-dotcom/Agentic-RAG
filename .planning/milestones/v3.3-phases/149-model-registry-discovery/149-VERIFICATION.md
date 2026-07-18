---
phase: 149-model-registry-discovery
verified: 2026-07-13T00:00:00Z
status: passed
score: 9/9 code-level must-haves verified (0 failed); residual human-verification (live re-run of rows 1+7) COMPLETED 2026-07-13 — both PASS, wire-confirmed (runs a0cb6241 openai/gpt-5.4-mini 1 tool_call + c1f3dbab minimax clean chips); see 149-HUMAN-UAT.md (status complete, 12/12) + 149-SECURITY.md (threats_open 0)
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: "14/14 code-level must-haves verified (0 failed); 1 residual human-verification requirement"
  gaps_closed:
    - "SC#1 second half (row-1 major, round-2 live UAT) — with native_tools OFF on a compat-path model, the chat now STILL WORKS via the prompt-injected structured path. `_should_pre_inject_structured` (agent_loop.py:768) fires TOOL_USAGE_INSTRUCTIONS pre-injection before the first stream when the effective calling mode resolves STRUCTURED for a compat provider (any provider except anthropic/google), closing the hallucinated-zero-tool-call failure mode. Wired into `run_agent_loop` at :1610-1614 with a cache-warming await before the sync gate read. Byte-identical for the no-override native path (D-14) and the anthropic/google native-SDK boundary (WR-05)."
    - "Follow-up suggestion chips no longer leak raw <think> reasoning markup on compat-path reasoning-model replies (row-7 incidental minor, round-2 live UAT). `_strip_think_blocks` (suggestion_service.py:23) strips closed and unclosed-trailing think blocks from the completion BEFORE the line-parse/clamp-to-3 (suggestion_service.py:128, ahead of :130's split)."
  gaps_remaining:
    - "Both fixes are code-verified (25 passing regression tests: 9 gate tests in test_149_native_tools_routing.py + 4 strip tests in test_149_suggestion_strip.py + 12 carried clamp tests) and code-review-traced (149-REVIEW.md round 3: 0 critical, 2 warnings, wiring manually traced sound) but have NOT been re-run live against real provider accounts since landing — 149-HUMAN-UAT.md rows 1 and 7 still reflect the PRE-fix round-2 result (row 1: major issue: zero tool calls on 'list the top-level folders'; row 7: pass with an incidental minor think-leak note). This is the disclosed residual human-verification requirement, not a code gap."
  regressions: []
human_verification:
  - test: "Re-run 149-HUMAN-UAT.md / 149-VALIDATION.md row 1 (native_tools OFF on a compat-path model, e.g. gpt-5.4-mini or gpt-5.6) live against a real OpenAI-compat provider account"
    expected: "With native_tools toggled OFF in the Model Registry tab, a tool-requiring prompt (e.g. 'list the top-level folders') now FIRES a real tool call via the structured/prompt-injected path and returns an actual folder listing — NOT the previously observed hallucinated non-answer ('No folder listing is available from the current context') with zero tool_calls. Toggle back ON still routes NATIVE as before."
    why_human: "Requires a live streaming turn against a real provider account to observe whether TOOL_USAGE_INSTRUCTIONS actually reaches the model and produces a parsed tool call on iteration 0 — this is the exact wire-level behavior that green unit tests masked twice already in this phase (round-1 and round-2 CR-01-class failures). 149-REVIEW.md's own WR-01 finding confirms the current test suite is helper-scoped only (calls `_should_pre_inject_structured` directly) and would stay green even if the wiring at agent_loop.py:1610-1614 were reverted — static/unit verification cannot substitute for the served-artifact proof here."
  - test: "Re-run 149-HUMAN-UAT.md / 149-VALIDATION.md row 7 (parallel-thread disabled-model fallback) live, specifically checking the follow-up suggestion chips on the MiniMax-served (or any compat reasoning-model) fallback reply"
    expected: "The follow-up suggestion chips under the fallback reply contain only clean, plain questions — no '<think>' tag and no chain-of-thought sentences leaking into a chip."
    why_human: "Requires a live reasoning-model completion (MiniMax/DeepSeek/GLM-class inline <think> emission) to confirm the strip fires on the actual served response, not just the synthetic canned completions used in test_149_suggestion_strip.py."
---

# Phase 149: Model Registry & Discovery Verification Report

**Phase Goal:** Model Registry & Discovery — write UI over `model_capabilities_overrides` + `model_discovery_service` propose-only (MODEL-01, MODEL-02)
**Verified:** 2026-07-12T21:36:57Z
**Status:** human_needed
**Re-verification:** Yes — round 3, after gap-closure plans 149-11 (structured-path pre-injection) and 149-12 (suggestion think-leak strip) executed on top of round-2's already-verified 14/14 code-level truths

## Goal Achievement

### Observable Truths

This round focuses on the two round-2 live-UAT gaps (row 1 major, row 7 incidental minor) and their closing plans (149-11, 149-12). Round-2's other 12 truths (ROADMAP SC#1-4, namespaced-route fix, honest fallback wiring, deprecated-badge parity, security posture, requirements traceability) are carried forward with a regression-only check since the round-3 diff (`git diff 493a12c1..HEAD`) touches only `agent_loop.py`, `suggestion_service.py`, and their two test files — none of the files those truths depend on (`admin.py`, `threads.py`, `openai_service.py`'s DB-aware routing, `ModelRegistryTab.tsx`, `ModelDiscoveryPanel.tsx`, `MessageItem.tsx`) were touched this round.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ROADMAP SC#1 — operator can edit a model's capabilities and the change takes effect on the next request with no restart (regression check) | ✓ VERIFIED | Unaffected by round-3 diff. `pytest tests/test_149_*.py -q` → 89 passed, 0 failed (was 81 in round 2; +8 = the 4 new gate tests + 4 new strip tests). |
| 2 | ROADMAP SC#2/SC#3/SC#4 — discovery propose-only, non-operator gated (regression check) | ✓ VERIFIED | Unaffected by round-3 diff; same 89/89 suite covers `test_149_discovery.py`, `test_149_discover_endpoint.py`, `test_149_model_gate.py`. |
| 3 | Row-1 gap-closure — with `native_tools` OFF on a compat-path model, the structured path pre-injects `TOOL_USAGE_INSTRUCTIONS` so tools still fire (SC#1 "still works" half) | ✓ VERIFIED (code-level) | `_should_pre_inject_structured(active_provider, effective_model, user_settings)` (`agent_loop.py:768-803`) returns True when the effective calling mode resolves STRUCTURED for any compat provider (excludes anthropic/google per WR-05). Wired at `agent_loop.py:1610-1614`: `_effective_model` computed, cache warmed via `await get_model_capability_async(_effective_model)`, then the sync gate read replaces the old inline openrouter+xml-only expression. Injection site (`:1799-1808`) and post-stream fallback (`:2097`-ish) left untouched. `pytest tests/test_149_native_tools_routing.py` → 9/9 green (5 pre-existing DB-aware-routing tests + 4 new gate tests: A openai-STRUCTURED→True, B no-override→False/D-14, C anthropic/google excluded→False/WR-05, D openrouter-xml preserved). **Live-serve proof (row 1 re-run) still pending — see Human Verification.** |
| 4 | Row-7 incidental gap-closure — follow-up suggestion chips never leak raw `<think>` reasoning markup regardless of which model served the reply | ✓ VERIFIED (code-level) | `_strip_think_blocks` (`suggestion_service.py:23-47`, verbatim closed-block + unclosed-trailing-think removal) applied to `content` at `:128`, immediately before the `content.split("\n")` clamp-to-3 at `:130`. Covers both the primary completion and the `NotFoundError` fallback-retry response (strip sits after the try/except). `pytest tests/test_149_suggestion_strip.py` → 4/4 green (A MiniMax-style leak stripped, B no-think byte-identical, C unclosed-trailing stripped, D strip-precedes-clamp so real questions survive). **Live-serve proof (row 7 re-run) still pending — see Human Verification.** |
| 5 | No backend regression introduced by the round-3 diff | ✓ VERIFIED | `pytest tests/test_149_*.py -q` → **89 passed**, 0 failed (round 2 was 81; delta of +8 matches the 4+4 new tests exactly, no other test count drift). `pytest tests/test_149_native_tools_routing.py tests/test_149_suggestion_strip.py tests/test_149_clamp.py -q` → 25 passed (targeted re-run). Both touched files parse cleanly (`ast.parse`, UTF-8) and import cleanly. |
| 6 | No debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) introduced in the round-3 diff | ✓ VERIFIED | Grepped `agent_loop.py`, `suggestion_service.py`, `test_149_native_tools_routing.py`, `test_149_suggestion_strip.py` — zero matches. |
| 7 | All round-3 SUMMARY-claimed commits actually exist and match their described content | ✓ VERIFIED | `git show --stat` confirmed all 5 commits present with matching messages: `a91cb334` (test RED, 149-11), `b6d1d6cf` (feat GREEN, 149-11), `22161913` (feat wiring, 149-11), `a85eb20a` (test RED, 149-12), `01b92536` (feat GREEN, 149-12). HEAD is `48fd7cda` (round-3 review doc commit), one commit past the plan-12 STATE/ROADMAP update — all committed, `git status --short` on the phase-149 surface is empty. |
| 8 | Round-3 code review (149-REVIEW.md) resolved with no blocking findings | ✓ VERIFIED (with disclosed warnings) | `149-REVIEW.md`: 0 Critical, 2 Warnings, 4 Info. **WR-01** (test-coverage gap: the 4 new gate tests are helper-scoped — `run_agent_loop`'s wiring at `:1610-1614` could be reverted and the suite would stay green; the reviewer manually traced the wiring correct by source inspection, which this verification independently reconfirmed by reading `agent_loop.py:1610-1614` and `:768-803`, but no automated test locks it). **WR-02** (the suggestion_service docstring's "mirrors threads.py verbatim" claim is false — the threads.py sibling has a pre-existing dead-condition bug (`"<\think>"` tab-escape typo) OUTSIDE this diff, unrelated to phase 149's MODEL-01/MODEL-02 scope, already filed for follow-up per commit history note in STATE.md). Neither warning blocks MODEL-01/MODEL-02 goal achievement; both are surfaced in Anti-Patterns below. |
| 9 | Requirements MODEL-01/MODEL-02 traceable to shipped code across all 12 plans including 11/12 | ✓ VERIFIED | `.planning/REQUIREMENTS.md:30-31` maps both to Phase 149. Plan 11 declares `requirements: [MODEL-01]` (closes SC#1's routing-AND-still-works half); plan 12 declares `requirements: [MODEL-02]` (closes the discovery/fallback-adjacent suggestion-honesty surface touched by D-149-10). No orphaned requirement IDs. |

**Score:** 9/9 code-level truths verified. Both round-2 gaps (row 1 major, row 7 incidental minor) have landed fixes with passing regression coverage and a clean code review. Per this phase's own explicitly-recorded convention (repeated twice already: round-1 and round-2 each had a green-unit-tests-masked-a-wire-level-bug incident), **green tests alone do not close MODEL-01/MODEL-02 for a request-path fix** — the closing gate is the live re-run of UAT rows 1 and 7 against real provider accounts.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/agent_loop.py` | `_should_pre_inject_structured` pure gate + wiring in `run_agent_loop` | ✓ VERIFIED | Helper at `:768-803`; wiring at `:1610-1614`; injection site (`:1799-1808`) and fallback injection left untouched per plan directive. |
| `backend/tests/test_149_native_tools_routing.py` | Gate regression coverage (4 new cases) | ✓ VERIFIED | 9/9 green (5 carried + 4 new: A/B/C/D). |
| `backend/app/services/suggestion_service.py` | `_strip_think_blocks` applied before the line-parse | ✓ VERIFIED | Helper at `:23-47`; applied at `:128`, before `:130`'s split. |
| `backend/tests/test_149_suggestion_strip.py` | Strip regression coverage (new file, 4 cases) | ✓ VERIFIED | New file, 4/4 green (A/B/C/D). |
| `.planning/phases/149-model-registry-discovery/149-REVIEW.md` | Round-3 review findings + resolution | ✓ VERIFIED | `status: issues_found` (0 critical / 2 warnings / 4 info) — findings independently reconfirmed against source above, none blocking. |
| `.planning/phases/149-model-registry-discovery/149-11-SUMMARY.md`, `149-12-SUMMARY.md` | Executor summaries for both gap-closure plans | ✓ VERIFIED | Both present, both self-checks PASSED, claims cross-checked against actual source and commits (not taken on trust). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `_should_pre_inject_structured` branch (b) | `resolve_calling_mode` | direct sync call | ✓ WIRED | Confirmed at `agent_loop.py:801`: `resolve_calling_mode(effective_model, user_settings) == CallingMode.STRUCTURED`. |
| `run_agent_loop`'s `_needs_pre_injection` | `_should_pre_inject_structured` | direct call replacing the old inline tuple | ✓ WIRED | Confirmed at `agent_loop.py:1612-1614`. |
| `run_agent_loop`'s pre-loop cache warm | `_model_overrides_cache` (read by the sync gate) | `await get_model_capability_async(_effective_model)` immediately before the sync gate read | ✓ WIRED | Confirmed at `agent_loop.py:1611`, one line before the gate call — the review additionally traced this covers the `body.provider`-set branch where `threads.py`'s own warm-read is skipped. |
| `generate_suggestions`'s `content` | `_strip_think_blocks` | direct call before the split | ✓ WIRED | Confirmed at `suggestion_service.py:128`, `content.split("\n")` at `:130` — strip precedes parse on both the primary and `NotFoundError`-fallback-retry response paths (strip sits after the shared try/except). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `_should_pre_inject_structured`'s `resolve_calling_mode` read | `db_native: bool \| None` via `_resolve_db_native_tools` | the warm `_model_overrides_cache`, populated by the awaited `get_model_capability_async` immediately before the sync read | Yes — real DB-backed cache, not static | ✓ FLOWING |
| `generate_suggestions`'s stripped `content` | `resp.choices[0].message.content` | live (non-streaming) provider completion call — `client.chat.completions.create(...)` | Yes — real API response | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Round-3 targeted regression (gate + strip + clamp) | `pytest tests/test_149_native_tools_routing.py tests/test_149_suggestion_strip.py tests/test_149_clamp.py -q` | `25 passed, 1 warning` | ✓ PASS |
| Full phase-149 backend suite | `pytest tests/test_149_*.py -q` | `89 passed, 3 warnings` | ✓ PASS |
| Both round-3 files parse and import cleanly | `python -c "import ast; ast.parse(open(f, encoding='utf-8').read())"` for both files | `agent_loop.py parses OK`, `suggestion_service.py parses OK` | ✓ PASS |
| No debt markers in the 4 round-3-touched files | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` per file | 0 matches | ✓ PASS |
| Round-3 diff scope is backend-only (no unaccounted frontend drift) | `git diff --stat 493a12c1..HEAD` | 2 source files + 2 test files + planning docs only | ✓ PASS |
| All 5 SUMMARY-claimed commits exist with matching messages | `git show --stat <hash>` × 5 | all 5 present, messages match | ✓ PASS |
| Phase-149 surface fully committed (no uncommitted WIP) | `git status --short -- backend/app frontend/src .planning/phases/149-model-registry-discovery supabase/migrations` | empty output | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared or discovered for this phase. SKIPPED (no probes applicable) — unchanged from prior rounds.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| MODEL-01 | 149-01,03-09,11 | Operator can edit model capabilities from the admin shell; changes take effect without restart, INCLUDING native_tools routing AND the structured-path tool mechanism it now requires | ✓ SATISFIED (code-level) | Round-2 closed the routing half (DB-aware `resolve_calling_mode`); round-3 plan 11 closes the "still works" half (`_should_pre_inject_structured`). Both verified above. `.planning/REQUIREMENTS.md:30` marked `[x]`. |
| MODEL-02 | 149-01,02,04,06-08,10,12 | Operator can run live model discovery; propose-only; discovery-adjacent honesty surfaces (fallback notice, suggestion chip cleanliness) hold under compat-path reasoning models | ✓ SATISFIED (code-level) | Round-3 plan 12 closes the suggestion think-leak surfaced by the D-149-10 fallback path. `.planning/REQUIREMENTS.md:31` still shows `[ ]` — the known `phase.complete` stale-tracking-row quirk (project memory), a bookkeeping lag, not a code gap. |

No orphaned requirements — `.planning/REQUIREMENTS.md` maps only MODEL-01/MODEL-02 to Phase 149.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/tests/test_149_native_tools_routing.py` | 69-152 | WR-01 (149-REVIEW.md): the 4 new gate tests call `_should_pre_inject_structured` directly with a `SimpleNamespace` stub — no test drives `run_agent_loop` itself, so the wiring at `agent_loop.py:1610-1614` could regress (reverted to the old inline gate, or the cache-warm call deleted) and the suite would stay green | ⚠️ Warning | Non-blocking this round — the wiring was independently confirmed correct by direct source inspection (this verification) and by the round-3 reviewer's manual trace. But it is a real gap in the regression safety net for a request-path fix in a phase that has already hit this exact failure mode twice (round-1 and round-2 CR-01). Recommend an integration-style test (asserting the first `open_stream` call's rendered system message) as a near-term follow-up, though not a gate for this phase's closure. |
| `backend/app/services/suggestion_service.py` | 31-33 | WR-02 (149-REVIEW.md): docstring claims `_strip_think_blocks` "mirrors app.api.threads._strip_think_blocks verbatim"; the threads.py sibling has a pre-existing dead-condition bug (`"<\think>"` — a TAB-escape typo — instead of `"</think>"`) that the new copy silently corrected without flagging | ℹ️ Info | Pre-existing bug OUTSIDE this diff (in `threads.py:761`, the title-generation path), not introduced by phase 149's round-3 work and not part of MODEL-01/MODEL-02's success criteria. The docstring's factual claim should be corrected in a follow-up to avoid a future maintainer "syncing" the suggestion_service copy back to the broken version. Does not block this phase. |
| `.planning/REQUIREMENTS.md` | 31, 90 | MODEL-02 tracking checkbox still `[ ]` despite code-level SATISFIED status | ℹ️ Info | Known `phase.complete` stale-tracking-row quirk (project memory) — bookkeeping only. |
| `.planning/STATE.md` | 25-32 | Stale tracking: "Phase: 149 ... EXECUTING / Plan: 2 of 12" despite all 12 plans having SUMMARYs | ℹ️ Info | Orchestrator-owned bookkeeping (per CLAUDE.md, STATE.md writes are the orchestrator's responsibility) — will be corrected on the next orchestrator pass, not a verification gap. |

### Human Verification Required

### 1. Live re-run of UAT row 1 — native_tools OFF still-works proof

**Test:** Toggle `native_tools` OFF on an OpenAI-compat model (e.g. gpt-5.4-mini or gpt-5.6) in the Model Registry tab, wait for the TTL cache to reflect it (~30s, no restart), then send a tool-requiring prompt such as "list the top-level folders" in a NEW chat turn.
**Expected:** The model FIRES a real tool call via the structured/prompt-injected path and returns an actual folder listing — not the previously observed hallucinated non-answer ("No folder listing is available from the current context") with zero recorded `tool_calls`. Toggling back ON should route NATIVE again (unaffected regression check).
**Why human:** This is a live-wire behavior (does the injected system-prompt text actually reach the model and produce a parseable tool call on the very first iteration) that unit tests cannot substitute for — and this exact class of failure (green tests, broken wire) has already happened twice in this phase. 149-REVIEW.md's own WR-01 finding confirms no automated test currently locks the `run_agent_loop` wiring itself.

### 2. Live re-run of UAT row 7 — suggestion chip cleanliness on a compat reasoning-model fallback reply

**Test:** Re-trigger the parallel-thread disabled-model fallback scenario (Thread A streaming, Thread B hits a just-disabled model and falls back to a compat reasoning-model org default such as MiniMax), and inspect the follow-up suggestion chips rendered under the fallback reply.
**Expected:** All follow-up chips are clean, plain questions — no `<think>` tag, no chain-of-thought sentences leaking into a chip.
**Why human:** Requires an actual reasoning-model completion emitting inline `<think>` markup in production to confirm the strip fires on the real served response; the synthetic canned completions in `test_149_suggestion_strip.py` cannot substitute for that live confirmation.

### Gaps Summary

Both round-2 live-UAT gaps have code fixes landed and verified in this round:

- **Row 1 (major):** `_should_pre_inject_structured` closes the "still works" half of SC#1 — a DB-flipped `native_tools=False` model on a compat provider now gets `TOOL_USAGE_INSTRUCTIONS` pre-injected before the first stream, giving it a real tool mechanism instead of silently stripping all tools. Wiring independently confirmed correct by direct source inspection (not just SUMMARY claims) at `agent_loop.py:768-803` and `:1610-1614`.
- **Row 7 (incidental minor):** `_strip_think_blocks` closes the suggestion-chip think-leak — applied before the line-parse/clamp so reasoning markup from compat-path reasoning models never becomes a user-visible chip. Confirmed wired at `suggestion_service.py:128`.

No regressions: full `test_149_*.py` suite 89/89 (up from 81, delta matches exactly the 8 new tests), targeted 25/25, no debt markers, all commits verified present, phase-149 surface fully committed.

**Following this phase's own explicitly-documented convention** (recorded in STATE.md and reiterated in every 149-08 through 149-12 SUMMARY, born from two prior incidents in this same phase where green unit tests masked a wire-level bug): code-level verification and a clean code review are NOT sufficient to close MODEL-01/MODEL-02 for a request-path fix. The live re-run of 149-HUMAN-UAT.md rows 1 and 7 against real provider accounts is the disclosed, intentional closing gate. This verification therefore routes to `human_needed` rather than `passed`, even though all 9 code-level must-haves for this round are VERIFIED with 0 failures.

---

_Verified: 2026-07-12T21:36:57Z_
_Verifier: Claude (gsd-verifier)_
