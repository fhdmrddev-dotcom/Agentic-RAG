---
phase: 175-cross-provider-streaming-fidelity
verified: 2026-07-22T18:19:35Z
status: human_needed
score: 15/15 must-haves verified (automated); SC#10 4-axis live-UAT still manual
overrides_applied: 0
human_verification:
  - test: "gpt-5.6-class model + tool prompt in Deep chat (real OpenAI endpoint)"
    expected: "Run completes with no 400; reasoning stays on; tools execute via STRUCTURED/XML path"
    why_human: "Live provider endpoint constraint — the actual gpt-5.6 400 can only be reproduced against the real OpenAI API, not a mock"
  - test: "gpt-5.6 Deep chat with 2+ tools in one prompt (e.g. search_documents + execute_code)"
    expected: "Both tools execute correctly via the STRUCTURED XML-injection path, no 400"
    why_human: "Real multi-tool execution across the XML-injection path; SC#10 multi-tool axis"
  - test: "A long DeepSeek turn (~26+ tool calls) that naturally triggers the DSML leak"
    expected: "No dirty `<｜｜DSML｜｜...>` markup rendered in the chat; if a leak occurs, the honest notice appears inline and persists after reload/reconnect"
    why_human: "The leak is length/timing-dependent — a wire-format mock cannot reproduce the real long-turn trigger; SC#10 long-message axis"
  - test: "Thread A streaming a long DeepSeek turn while Thread B accepts a new prompt (title-gen fires)"
    expected: "No cross-thread interference; Thread B's title-gen resolves independently while Thread A keeps streaming"
    why_human: "Concurrency + timing cannot be verified via static code read; SC#10 parallel-thread axis"
  - test: "First message on each SAFE reasoning provider (DeepSeek / Kimi-k2.6 / GLM-5.2) produces a real 4-6 word title; Google gemini-3.x and MiniMax-M2.x (UNSAFE) still derive a title with no regression"
    expected: "SAFE providers show a real generated title (not the degenerate first-few-words fallback); UNSAFE providers show the existing derived title unchanged"
    why_human: "Real per-provider title quality can't be mocked; SC#10 cross-provider + XPROV-04 axis"
---

# Phase 175: Cross-Provider Streaming Fidelity Verification Report

**Phase Goal:** Newer reasoning models and non-OpenAI providers stream cleanly — correct request params (no 400s), no tool-call markup leaking into visible content, and honest title-generation fallback — all handled at the gateway/adapter/sanitizer boundary with the shared path unforked.
**Verified:** 2026-07-22T18:19:35Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | (SC#1/XPROV-01) gpt-5.6-class rows carry a capability-keyed `reasoning_first` marker, never a hardcoded id-list | VERIFIED | `backend/app/config.py:279-281` — `gpt-5.6-sol/terra/luna` each carry `"reasoning_first": True`; `test_reasoning_capability_markers.py::test_reasoning_first_is_not_set_anywhere_else` locks the marker to exactly these 3 rows |
| 2 | (SC#1/XPROV-01) `resolve_calling_mode` returns STRUCTURED when `reasoning_first` is set → no `tools`/`reasoning_effort` param sent → no gpt-5.6 400 | VERIFIED | `backend/app/services/openai_service.py:1675-1676` (`if cap.get("reasoning_first"): return CallingMode.STRUCTURED`), placed above `db_native` resolution (Open Q2 ordering); `test_reasoning_first_routing.py` (4/4 pass, incl. reasoning_first-wins-over-operator-db_native=True) |
| 3 | (D-04) The gpt-5.6 reasoning-tools-unsupported 400 gets a dedicated honest ErrorKind instead of generic `bad_request`, with no raw-detail interpolation | VERIFIED | `backend/app/services/provider_gateway/errors.py:69,192-193,245-249` — `reasoning_tools_unsupported` kind + fixed copy; `_has_reasoning_tools_signature` anchors on the structured `body["error"]["message"]` (WR-02 fixed — no longer trips on `param=="reasoning_effort"` alone); `test_errors.py` green |
| 4 | (SC#2/XPROV-02) DeepSeek tool-call markup never leaks into visible content across chunk boundaries and long turns; stream-end flush prevents silent content loss | VERIFIED | `backend/app/services/provider_gateway/openai_compat.py:450-451` (guarded flush after the loop, `if _dsml_pending and not _dsml_leaking`); `test_openai_compat_dsml_strip.py` (12/12 incl. `test_stream_end_flush_long_turn_floor_holds`, `test_non_deepseek_never_flushes_and_is_byte_identical`) |
| 5 | (SC#2/XPROV-02) A detected leak surfaces exactly one honest signal that PERSISTS in the finalized message (not silently incomplete) | VERIFIED (post-review) | `backend/app/services/agent_loop.py:2175-2194` — CR-01-fixed: notice is appended to `full_content` (persists on reconnect/reload) AND emitted as a `delta` (visible live), NOT the terminal `error` event (avoids the `api.ts:838` terminal-mismatch the code review caught); `test_dsml_leak_signal.py` (7/7) asserts against the real hook's contract |
| 6 | (SC#3/XPROV-03) A cross-provider `sub_agent_model` override is dropped BEFORE the provider call → no 404 → no misleading `fallback_model` banner | VERIFIED | `backend/app/services/thread_title.py:128-141`, `backend/app/services/suggestion_service.py:76-87` — both wrap the raw override with `provider_safe_utility_model`; `test_threads_title_gen.py` + `test_utility_model_guard.py` (23 tests) green |
| 7 | (D-04) A genuine same-provider substitution still emits `fallback_model` honestly (suppress-when-fine is not suppress-always) | VERIFIED | `thread_title.py`'s existing 404-fallback branch (unchanged) still sets `fallback_info`; asserted by `test_threads_title_gen.py`'s genuine-substitution case |
| 8 | (XPROV-03 blind spot) `provider_safe_utility_model`/`resolve_sub_agent_model_safely` fire even when `available_models` is empty (list-membership gate is a no-op there) | VERIFIED | `sub_agent_models.py:172-200` folded gate fires on `_inferred_provider != _active_provider` independent of list population; `test_utility_model_guard.py::test_empty_available_models_cross_provider_falls_to_default` passes |
| 9 | (WR-01 code-review fix) The two XPROV-03 guards no longer disagree on unrecognised/fallback-bucket candidates | VERIFIED | `sub_agent_models.py:92-115` (`provider_safe_utility_model`) now carries the same fallback-bucket carve-out as `resolve_sub_agent_model_safely` (commit `bbe8ee03`); legacy empty-active still drops a recognised cross-provider id, by documented design |
| 10 | (XPROV-04/D-05) A SAFE reasoning-off model's title call injects the correct provider param (extra_body thinking-disabled or reasoning_effort=none), driven generically off the registry marker, never a hardcoded list | VERIFIED | `backend/app/config.py` — 13 rows marked (`279-281` reasoning_first excluded; 11 `thinking_disabled` + 2 `effort_none` rows at `317-318,339-340,347-348,363,371-376`); `thread_title.py:170-177` reads `get_model_capability(model).get("reasoning_off")` generically; `test_title_reasoning_off.py` (9/9) proves ≥2 distinct thinking_disabled models + the effort_none model + 2 UNSAFE negatives |
| 11 | (D-05/D-14) Title budget (30/160) and inline-await ordering stay byte-identical; empty/refusal on a SAFE provider still derives a title | VERIFIED | `test_title_reasoning_off.py::test_budget_30_for_non_google_safe_model`, `test_budget_160_for_google_safe_model`, `test_empty_response_on_safe_provider_still_derives_title` all pass; `_title_max_tokens` line unchanged in diff |
| 12 | (SC#4/D-14) Absent markers / non-reasoning_first models / same-provider or flexible-provider overrides / non-deepseek streams are byte-identical to pre-phase behavior | VERIFIED | `test_reasoning_first_routing.py::test_non_reasoning_first_model_is_byte_identical`, `test_openai_compat_dsml_strip.py::test_non_deepseek_never_flushes_and_is_byte_identical`, `test_utility_model_guard.py` same-provider/flexible cases, `test_sub_agent_routing.py` (unchanged, still green) all pass |
| 13 | Full backend unit suite shows zero net-new regressions from this phase | VERIFIED | Live re-run: `1370 passed, 63 failed` — identical count to the documented pre-existing-rot baseline (SEED-056/075.4-TEST-TRIAGE); the one inspected failure (`test_get_model_capability_inference.py::test_infer_openai_from_gpt_prefix`) fails on an unrelated `llm_call_timeout_seconds` default, not on any phase-175 touched field |
| 14 | No debt markers (TODO/FIXME/HACK/PLACEHOLDER) introduced in any phase-touched file | VERIFIED | `git diff f872bf8f HEAD` on all 8 touched source files — zero matches for TODO/FIXME/HACK/XXX/TBD/placeholder |
| 15 | Diff scope matches the plans' declared `files_modified` exactly (no stray/unexpected production files touched) | VERIFIED | `git diff --stat f872bf8f HEAD -- backend/` — 18 files, all within the 4 plans' declared `files_modified` + their direct downstream test contracts (`test_085_task_service.py`, `test_suggestions.py`) |

**Score:** 15/15 automated truths verified. SC#10's mandatory 4-axis live-UAT (cross-provider, multi-tool, parallel-thread, long-message) remains unexecuted against real provider endpoints — this is expected (authored as MANUAL in 175-VALIDATION.md) and is the sole reason status is `human_needed` rather than `passed`.

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | WR-03 (forced-emission path bypasses the `reasoning_first` gate; gpt-5.6 forced-emission rows are self-contradictory) | SEED-127 | `175-REVIEW.md` resolution block: "WR-03: deferred → SEED-127 (latent/pre-GA — forced-emission path on a reasoning_first model)"; `.planning/seeds/SEED-127-reasoning-first-forced-emission-gap.md` exists. Bounded severity — gpt-5.6 is preview/not-GA and not currently selectable as a forced-emission utility model in production defaults. |
| 2 | IN-02 (gpt-5.6 itself carries no `reasoning_off`, so its own utility calls fall to derived-title fallback) | Noted — folds into SEED-040 | `175-REVIEW.md`: "revisit the SAFE set once gpt-5.6 is GA and `effort_none` is docs-confirmed for it." Default-inert, no regression — OpenAI was deliberately outside the docs-confirmed SAFE set at phase time. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/config.py` | `reasoning_first` on 3 gpt-5.6 rows + `reasoning_off` on full docs-confirmed SAFE set | VERIFIED | 3 `reasoning_first: True` rows + 13 `reasoning_off` rows (11 `thinking_disabled` + 2 `effort_none`); UNSAFE negatives unmarked (locked by `test_reasoning_capability_markers.py`) |
| `backend/app/services/sub_agent_models.py` | `provider_safe_utility_model` + folded inferred-provider gate | VERIFIED | Both present; `sub_agent_service.py` untouched (D-085-16 byte-frozen, confirmed absent from diff) |
| `backend/app/services/provider_gateway/openai_compat.py` | Stream-end flush + `dsml_leaked` flag | VERIFIED | `:200` init, `:322-332` flag set, `:450-451` flush |
| `backend/app/services/agent_loop.py` | Post-drain hook consuming `dsml_leaked` | VERIFIED | `:2175-2194` — CR-01-fixed shape (delta + persist, not terminal error) |
| `backend/app/services/openai_service.py` | `reasoning_first` STRUCTURED gate | VERIFIED | `:1675-1676`, above `db_native` resolution |
| `backend/app/services/provider_gateway/errors.py` | `reasoning_tools_unsupported` ErrorKind + narrow signature match | VERIFIED | WR-02-fixed narrow message-signature match |
| `backend/app/services/thread_title.py` | D-03 guard + D-05 reasoning-off injection | VERIFIED | `:128-141` guard, `:170-183` injection |
| `backend/app/services/suggestion_service.py` | D-03 guard | VERIFIED | `:79-87` |
| `backend/tests/unit/test_reasoning_capability_markers.py` | SAFE/UNSAFE marker-matrix guard | VERIFIED | 12 tests, all pass |
| `backend/tests/unit/test_utility_model_guard.py` | Inferred-provider guard proof | VERIFIED | 9 tests, all pass |
| `backend/tests/unit/test_openai_compat_dsml_strip.py` | Strip + flush proof | VERIFIED | 12 tests, all pass |
| `backend/tests/unit/test_dsml_leak_signal.py` | Leak-signal proof | VERIFIED | 7 tests, all pass — assertions updated to the CR-01 delta contract |
| `backend/tests/unit/test_reasoning_first_routing.py` | STRUCTURED gate + ordering proof | VERIFIED | 4 tests, all pass |
| `backend/app/services/provider_gateway/test_errors.py` | Error-classification proof | VERIFIED | Extended, all pass (incl. WR-02 regression case) |
| `backend/tests/unit/test_title_reasoning_off.py` | Reasoning-off injection matrix | VERIFIED | 9 tests, all pass |
| `backend/tests/unit/test_threads_title_gen.py` | Title-gen guard regression | VERIFIED | Extended, all pass |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `config.py` (`reasoning_off`) | `thread_title.py` | `get_model_capability(model).get("reasoning_off")` at title-call build | WIRED | `thread_title.py:170` reads the marker generically |
| `sub_agent_models.py` (`provider_safe_utility_model`) | `thread_title.py`, `suggestion_service.py` | explicit import + call | WIRED | Both sites import and call it before the provider call |
| `sub_agent_models.py` (folded gate) | `task_service.py` | inherited via `resolve_sub_agent_model_safely` (existing caller, unmodified call site) | WIRED | `task_service.py:84` calls `resolve_sub_agent_model_safely(...)`, which now contains the folded gate at `:172-200` |
| `config.py` (`reasoning_first`) | `openai_service.py` | `cap.get("reasoning_first")` at `resolve_calling_mode` | WIRED | `openai_service.py:1662,1675-1676` |
| `openai_compat.py` (`stream.dsml_leaked`) | `agent_loop.py` | `getattr(stream, "dsml_leaked", False)` post-drain | WIRED | `agent_loop.py:2175`; consumer-side contract re-verified against `frontend/src/lib/api.ts:838-848`'s terminal-`error` handling, which is exactly why CR-01 moved to `delta` |

### Data-Flow Trace (Level 4)

Not applicable in the conventional sense — this phase is backend request-shaping / classification / registry-data, not UI-rendered dynamic data. The closest analog (does the `reasoning_off`/`reasoning_first` marker data actually reach the outbound request kwargs) is covered by the Key Link table above and the `test_title_reasoning_off.py` assertions on the mock client's recorded `create(...)` kwargs (real dict inspection, not a rendered prop).

### Behavioral Spot-Checks

Not run as live curl/process checks — this phase's runtime behavior (provider 400 avoidance, DSML leak, real title quality) requires a live provider endpoint and cannot be exercised in-process within the spot-check time budget. Covered instead by the full phase-touched unit-test re-run (Section below) and routed to human_verification for the live-endpoint-dependent behaviors (SC#10).

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes exist for this phase (not a migration/CLI-tooling phase); none declared in PLAN/SUMMARY. SKIPPED per Step 7c.

### Test Re-Run Evidence (independent, not trusted from SUMMARY)

```
cd backend && venv/Scripts/python -m pytest \
  tests/unit/test_reasoning_capability_markers.py tests/unit/test_utility_model_guard.py \
  tests/unit/test_sub_agent_routing.py tests/unit/test_085_task_service.py \
  tests/unit/test_openai_compat_dsml_strip.py tests/unit/test_dsml_leak_signal.py \
  tests/unit/test_reasoning_first_routing.py app/services/provider_gateway/test_errors.py \
  tests/unit/test_title_reasoning_off.py tests/unit/test_threads_title_gen.py \
  tests/test_149_native_tools_routing.py -q
→ 214 passed

cd backend && venv/Scripts/python -m pytest tests/unit -q
→ 1370 passed, 63 failed, 2 xfailed, 2 xpassed  (matches the documented pre-existing-rot baseline; zero net-new)
```

`git diff --stat f872bf8f HEAD -- backend/` shows exactly the 18 files declared across the 4 plans' `files_modified` + their direct downstream test contracts — no scope creep.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| XPROV-01 | 175-01, 175-03 | Newer reasoning models send correct request params — no model-parameter 400s on chat or with tools | SATISFIED (automated) / live-endpoint 400-avoidance and multi-tool axis → human_verification | `resolve_calling_mode` STRUCTURED gate + honest error copy, both unit-proven; REQUIREMENTS.md marks Complete |
| XPROV-02 | 175-02 | DeepSeek tool-call markup never leaks into visible content; strip guard holds on long turns | SATISFIED (automated) / real long-turn leak repro → human_verification | Stream-end flush + honest post-drain signal, both unit-proven; REQUIREMENTS.md marks Complete |
| XPROV-03 | 175-01, 175-04 | Title-gen cross-provider fallback is honest — no misleading banner | SATISFIED (automated) | `provider_safe_utility_model` guard applied at both sites, unit-proven; REQUIREMENTS.md marks Complete |
| XPROV-04 (folded, not a formal REQ-ID) | 175-01, 175-04 | Per-model reasoning-off title-gen quality (BUG-260722-01) | SATISFIED (automated) / real per-provider title quality → human_verification | Injection matrix unit-proven across ≥2 SAFE models + 1 effort_none + 2 UNSAFE negatives |

**Orphaned requirements check:** REQUIREMENTS.md's `### XPROV` section lists only XPROV-01/02/03 mapped to Phase 175 (all marked `[x]` Complete, all traced to the row `| XPROV-0N | Phase 175 | Complete |`). No REQUIREMENTS.md entry maps an ID to Phase 175 that is absent from the plans' `requirements:` frontmatter — all 3 formal IDs are claimed across the 4 plans (`XPROV-01`: 175-01/175-03; `XPROV-02`: 175-02; `XPROV-03`: 175-01/175-04). XPROV-04 is explicitly a folded BUG-260722-01 item per the roadmap ("XPROV-04 (BUG-260722-01) folded in per D-05") and correctly has no independent REQUIREMENTS.md row — not orphaned, by design.

### Anti-Patterns Found

None. `git diff f872bf8f HEAD` on all 8 touched production source files shows zero matches for TODO/FIXME/HACK/XXX/TBD/placeholder/"not yet implemented"/"coming soon". No stub returns (`return null`/`return {}`/`return []`/empty handlers) introduced. No hardcoded-empty props or console.log-only implementations.

### Human Verification Required

SC#10's 4-axis mandate (cross-provider × multi-tool × parallel-thread × long-message) requires real provider endpoints and cannot be exercised by static code review or mocked unit tests. These are the same 5 rows harvested from `175-VALIDATION.md`'s "Manual-Only Verifications" table:

1. **gpt-5.6-class model + tool prompt in Deep chat**
   **Test:** Send a message to a gpt-5.6-class model in Deep chat that requires a tool call (real OpenAI endpoint).
   **Expected:** Run completes with no 400; reasoning stays on; the tool executes via the STRUCTURED/XML path.
   **Why human:** The actual 400 (and its avoidance) can only be reproduced against the live OpenAI API — no mock reproduces the real endpoint's parameter validation.

2. **gpt-5.6 with 2+ tools in one prompt (multi-tool axis)**
   **Test:** Prompt gpt-5.6 with something requiring both `search_documents` and `execute_code`.
   **Expected:** Both tools execute correctly via the XML-injection path; no 400.
   **Why human:** Real tool execution across the XML-injection path; SC#10 mandatory axis.

3. **Long DeepSeek tool-chain turn (~26+ tool calls) — long-message axis**
   **Test:** Drive a DeepSeek conversation long enough to naturally trigger the DSML leak.
   **Expected:** No dirty `<｜｜DSML｜｜...>` markup ever renders; if a leak occurs, the honest notice appears inline live AND survives reload/reconnect (persisted in the message).
   **Why human:** The leak is length/timing-dependent — cannot be reproduced by a wire-format mock; SC#10 mandatory axis.

4. **Parallel-thread isolation**
   **Test:** Thread A streams a long DeepSeek turn while Thread B accepts a new prompt (triggering title-gen).
   **Expected:** No cross-thread interference; Thread B resolves its title independently while Thread A keeps streaming.
   **Why human:** Concurrency + timing; SC#10 mandatory axis.

5. **Real per-provider title quality (cross-provider axis)**
   **Test:** Send a first message on DeepSeek, Kimi-k2.6, and GLM-5.2 (SAFE); also on a Gemini-3.x and a MiniMax-M2.x model (UNSAFE controls).
   **Expected:** SAFE providers produce a real 4-6 word title (not the degenerate first-few-words fallback); UNSAFE providers still derive a title with no regression.
   **Why human:** Real per-provider title quality/model behavior can't be mocked; SC#10 + XPROV-04 axis.

### Gaps Summary

No blocking gaps. All automated must-haves (registry markers, routing gate, error classification, DSML flush + honest leak signal, cross-provider utility-model guard, per-model reasoning-off injection) are implemented, wired, and unit-proven — including the post-summary code-review fixes (CR-01 DSML delta/persist, WR-01 fallback-bucket carve-out parity, WR-02 narrow error-signature match), which were independently re-verified against the CURRENT code (not the stale SUMMARY.md text). The full backend unit suite shows zero net-new regressions (1370 passed / 63 failed, matching the documented pre-existing-rot baseline). WR-03 (forced-emission bypass on reasoning-first models) is intentionally deferred to SEED-127 — bounded/pre-GA, not a phase-175 must-have. The only outstanding item is the mandatory SC#10 4-axis live-provider UAT, which by its nature requires a human operator against real endpoints and was correctly authored as MANUAL in 175-VALIDATION.md rather than an automatable gap.

---

_Verified: 2026-07-22T18:19:35Z_
_Verifier: Claude (gsd-verifier)_
