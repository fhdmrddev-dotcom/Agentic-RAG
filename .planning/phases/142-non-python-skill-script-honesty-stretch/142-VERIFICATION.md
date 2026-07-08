---
phase: 142-non-python-skill-script-honesty-stretch
verified: 2026-07-08T03:39:12Z
status: human_needed
score: 8/8 automated must-haves verified
overrides_applied: 0
human_verification:
  - test: "Cross-provider honest narration on a real runtime-gap failure"
    expected: "For each of OpenAI, Anthropic, Google (Gemini), and OpenRouter — load a skill that drives a known-missing binary (soffice/markitdown) or a bundled .js step, and confirm: (a) the sandbox is touched at most once per gap token this run, (b) the model tells the user honestly that the step can't run here instead of narrating fake success or silently misrunning it as Python, (c) the model does not keep retrying after the pre-flight short-circuit fires."
    why_human: "Model narration in response to the reshaped runtime_gap payload is provider-behavioral (LLM free-text response to a tool result), not deterministic — 142-VALIDATION.md explicitly flags this as a Manual-Only Verification and it is still unchecked. No HUMAN-UAT.md exists for this phase and 142-VALIDATION.md's 3 manual rows are all unstarted ([ ])."
  - test: "D-03 / BUG-260707-02 stock-skill loop-cap proof"
    expected: "Re-import the UNMODIFIED stock Anthropic pptx skill (referencing soffice/markitdown, not the per-user hand-patched instructions), run a task that drives its office-conversion step, and confirm the agent does not repeat the 8-round retry loop — it stops at <=1 real dead sandbox call per token and either uses the in-memory alternative or tells the user, generically (not because of the one-off user-level instruction rewrite)."
    why_human: "The automated test_pptx_soffice_loop_capped proves the cap by construction against a MOCKED sandbox session; it does not prove the mechanism actually fires against the real stock skill content + a real model's tool-call sequencing. 142-VALIDATION.md lists this as a required manual-only row, still unchecked."
  - test: "Multi-tool row: load_skill flag + execute_code reshape in one live turn"
    expected: "One prompt that loads a skill bundling a non-Python script (surfacing the load_skill runtime_note) AND drives that skill's dead sandbox step (surfacing the execute_code runtime_gap reshape) in the same turn; confirm both signals reach the model and both are narrated honestly."
    why_human: "Exercises two D-05/D-06 proactive+reactive surfaces together end-to-end against a live provider; 142-VALIDATION.md flags this as manual-only and it is unchecked."
---

# Phase 142: Non-Python Skill-Script Honesty (STRETCH) Verification Report

**Phase Goal:** A skill bundling a non-Python script yields an honest "cannot execute this skill type" signal instead of silent failure / fake narration.
**Verified:** 2026-07-08T03:39:12Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC#1: importing a skill bundling a non-Python script (e.g. `.js`) still succeeds and the user sees an honest, non-blocking note; an all-Python ZIP produces no note | VERIFIED | `backend/app/api/skills.py:302-412` — static `SCRIPT_EXTS` scan over `_sanitize_zip_name`-validated entries; `notes[]` on both the 201 sync and 202 background bodies. `SkillsPage.tsx:38-53` `buildImportMessage` appends `Note: {note}` to the existing muted line; wired at `handleImport` (:95) and rendered at :139-140. Backend: `pytest tests/integration/test_skills_import_export.py -q` → 21 passed. Frontend: `npm run test -- SkillsPage.import` → 5 passed. `npx tsc --noEmit` → clean. |
| 2 | SC#2: a known runtime-gap execute_code failure fails cleanly with a specific message instead of silently running non-Python as Python or narrating fake success — mechanism-level | VERIFIED (mechanism); narration itself is human-needed (see truth #8) | `tool_dispatcher.py:1375-1398` — post-hoc `_classify_runtime_gap` gated on `actual_exit_code != 0`; on a hit, a permanent-framed `runtime_gap` note rides `llm_content`. Pre-flight guard (`:980-1012`) short-circuits a re-referenced dead token BEFORE the sandbox is touched, capping real dead sandbox calls at <=1/token. `pytest tests/unit/test_142_runtime_gap.py tests/unit/test_142_repeat_guard.py -q` → 23 passed. |
| 3 | SC#3 (optional): `read_skill_file` returns a bundled non-Python file as honest reference text, not a misleading "binary" error, and is byte-symmetric with the 099 snapshot path | VERIFIED | `tool_dispatcher.py:840-901` — `_decode_skill_file_bytes` gained a `SCRIPT_EXTS` branch (inside the ONE shared decoder used by both the live read `:904+` and the 099 snapshot read) returning caveat-prefixed plain text; true-binary else-branch untouched. `pytest tests/unit/test_142_read_skill_file.py tests/test_099_skill_composition.py -q` → 30 passed (incl. `test_byte_symmetry_live_equals_snapshot`). |
| 4 | T-142-01 (the single most important property): the classifier NEVER suppresses a genuine error — never reshapes on error-type/exit-code alone | VERIFIED | Code review (`142-REVIEW.md`) found CR-01 (2 violations: bare-substring match on generic tokens + `"not found"`, reshape running on exit-0 successes, JS false-positive via `"let "`/comment substrings) and CR-02 (repeat-guard bare-substring poisoning). Fix commits `330453f3` / `6904701c` / `017e7000` / `8ba38181` confirmed present in `tool_dispatcher.py` (word-boundary binary regex `:2164-2171`, exit!=0 gate `:1389-1393`, comment-stripped JS check `:2174-2258`, G-A narrowed to `scripts/`/`assets/`/`resources/` `:2097-2102`, `2260-2279`). Adversarial regression tests exist (`test_cr01_*`, `test_wr01_*`, `test_cr02_*`, `test_exit0_success_never_reshaped_or_recorded`) — all pass. **Independently re-verified** with hand-written adversarial calls outside the test suite (genuine `ValueError` w/ "node"+"not found", exit-1 non-boundary "node" match, JS token only inside a `#` comment) — all correctly return `None` (pass through unchanged). |
| 5 | CR-02: the run-scoped repeat-guard never poisons unrelated legitimate calls via bare-substring match | VERIFIED | `_code_references_dead_token` (`tool_dispatcher.py:2296-2311`) uses `\b`-anchored regex for binary/module identifiers; independently re-verified `node` inside `node_list`/`annotate` does NOT match while `subprocess.run(['node', ...])` DOES. `test_cr02_word_boundary_match`, `test_cr02_soffice_repeat_and_benign_node_substring` pass. |
| 6 | WR-02: the repeat-guard short-circuit still emits matching SSE lifecycle events so the UI code-card resolves | VERIFIED | `tool_dispatcher.py:999-1012` emits `code_execution_start` + `code_execution_complete` before returning the short-circuit result. `test_wr02_short_circuit_emits_lifecycle_events` passes. |
| 7 | D-05a/D-14: `execute_code` tool description carries generic Python-only capability facts (available + NOT-available tokens), delivered on the single-source tool contract, NOT on `SYSTEM_PROMPT` — Deep Mode byte-identical | VERIFIED | `openai_service.py:581-602` `EXECUTE_CODE_TOOL.description` extended in place (single concatenation); `get_tools()` (:1050) is the single source translated by every provider gateway. `grep SYSTEM_PROMPT agent_loop.py` shows no touch; `git diff 4d0be751..HEAD -- backend/app/services/sandbox_service.py backend/Dockerfile.sandbox` = empty. `pytest tests/unit/test_sandbox_tools.py -q` → 5/5 (incl. `test_execute_code_capability_facts`). |
| 8 | Cross-provider live narration + the D-03 generic stock-skill loop-cap proof | **NEEDS HUMAN** | 142-VALIDATION.md's "Manual-Only Verifications" table lists exactly these 3 rows, all still `[ ]` unstarted; no `142-HUMAN-UAT.md` exists in the phase directory. The backend mechanism (loop-cap, reshape) is deterministic and unit-proven against a MOCKED sandbox, but whether each live provider (OpenAI/Anthropic/Google/OpenRouter) actually narrates the reshaped `runtime_gap` honestly instead of fabricating success, and whether the real stock pptx skill's 8-round loop is generically capped end-to-end, has not been exercised live. |

**Score:** 7/8 truths fully VERIFIED by codebase evidence; 1 requires live human/provider verification (truth #8, folding in truth #2's narration half).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/tool_dispatcher.py` — `_classify_runtime_gap` + constants | Pure classifier, G-A/G-B/G-C, T-142-01 pass-through | VERIFIED | Present at :2205-2281; constants at :2085-2147; 15/15 `test_142_runtime_gap.py` incl. CR-01/WR-01 regressions green. |
| `backend/app/services/tool_dispatcher.py` — `ToolContext.dead_gap_tokens_in_run` + reshape/guard | Post-hoc reshape + pre-flight repeat-guard | VERIFIED | Field at :106; reshape at :1375-1398; guard at :980-1012; 8/8 `test_142_repeat_guard.py` incl. CR-02/WR-02 regressions green. |
| `backend/app/services/agent_loop.py` — run-scoped threading | init once + both ToolContext builds | VERIFIED | 3 references (`grep -c` = init :1593, builds :1645/:2429); Deep byte-identity preserved (guarded `is not None`, +10 lines only). |
| `backend/app/services/task_service.py` — sub-agent fresh set | fresh `set()`, not parent reference | VERIFIED | 1 reference at :608 (`dead_gap_tokens_in_run=set()`). |
| `backend/app/services/tool_dispatcher.py` — `_decode_skill_file_bytes` SCRIPT_EXTS branch | reference-text caveat, byte-symmetric | VERIFIED | Branch at :887-895; both call sites (:904 live, 099 snapshot) unchanged in diff — symmetry structural. |
| `backend/app/services/tool_dispatcher.py` — `_skill_runtime_note` / `_handle_load_skill` flag | present-only-when-non-null runtime_note | VERIFIED | Helper at :690-704; wired at :766-775. |
| `backend/app/services/openai_service.py` — `EXECUTE_CODE_TOOL.description` | capability facts, single source | VERIFIED | :581-602; `get_tools()` single source confirmed. |
| `backend/app/api/skills.py` — import-time `notes[]` | static ext-scan, both 201/202 paths | VERIFIED | :302-412; `notes` key on both branches. |
| `frontend/src/lib/api.ts` — `SkillImportResult.notes?` | optional additive field | VERIFIED | :4-11; response has no `response_model=` filter on the FastAPI route, so the field reaches the client unfiltered. |
| `frontend/src/pages/SkillsPage.tsx` — `buildImportMessage` + render | appended to muted line, no new component | VERIFIED | :38-53 (pure helper) + :95 (call site) + :139-140 (render); no new component file. |
| `backend/tests/unit/test_142_*.py` + `test_skills_import_export.py` + `SkillsPage.import.test.tsx` | full test coverage incl. adversarial regressions | VERIFIED | 66 unit + 21 integration + 5 frontend = 92 new/extended tests, all green. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `_classify_runtime_gap` | `GAP_MESSAGES` | token → permanent-framed message lookup | WIRED | Confirmed by direct read + adversarial calls. |
| `_handle_execute_code` pre-flight guard | `ctx.dead_gap_tokens_in_run` | word-boundary/containment membership check → short-circuit before sandbox | WIRED | :993-1012; sandbox never touched on a hit (verified via mocked-session call-count assertions in `test_142_repeat_guard.py`). |
| `agent_loop` run-scoped init | both `ToolContext` builds | by-reference kwarg | WIRED | 3 refs confirmed. |
| `_handle_load_skill` | `_skill_runtime_note(file_names)` | SCRIPT_EXTS scan → additive JSON key | WIRED | :766-775. |
| `_decode_skill_file_bytes` (live AND snapshot) | `SCRIPT_EXTS` branch | shared decoder → free byte-symmetry | WIRED | Single function, both call sites unmodified. |
| `import_skill` per-skill loop | `notes[]` on 201 and 202 responses | SCRIPT_EXTS ext scan of sanitized basenames | WIRED | :302-412; both branches carry the key. |
| `SkillsPage.handleImport` | `result.notes` | append to `importMessage.text` (muted, non-error) | WIRED | :95 calls `buildImportMessage`; :139-140 renders `importMessage`. |
| `EXECUTE_CODE_TOOL.description` | `get_tools()` → all provider gateways | uniform tool-schema translation | WIRED | Single source, no per-provider fork; SYSTEM_PROMPT untouched. |

### Data-Flow Trace (Level 4)

Not applicable in the traditional dashboard sense — this phase's "data flow" is model-facing text payloads (tool-result JSON, tool-description strings), not a UI rendering pipeline. Traced anyway: `runtime_gap` flows from `_classify_runtime_gap` → `_llm_payload["runtime_gap"]` → `llm_content` → the model's context (confirmed by code, not by capturing a live model turn — see human_verification). The one true UI data-flow (`notes[]` → `SkillImportResult` → `buildImportMessage` → `importMessage` → JSX) is FLOWING: confirmed live end-to-end in the frontend unit test (`SkillsPage.import.test.tsx`, 5/5 passing) and by reading the render call site.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Classifier never false-positives on a generic-token genuine error | Direct Python call: `_classify_runtime_gap(code='raise ValueError("config node \'db\' not found")', ...)` | Returned `None` | PASS |
| Classifier never false-positives on JS token inside a Python comment | Direct Python call with `# let me handle this` + real `SyntaxError` | Returned `None` | PASS |
| Repeat-guard never poisons a benign later cell containing a dead-token substring | Direct Python call: `_code_references_dead_token('node_list = [1]; annotate(node_list)', 'node')` | Returned `False` | PASS |
| Repeat-guard still blocks a genuine re-reference at a real word boundary | Direct Python call: `_code_references_dead_token("subprocess.run(['node','app.js'])", 'node')` | Returned `True` | PASS |
| Full 142 unit+integration test surface | `pytest tests/unit/test_142_*.py tests/unit/test_sandbox_tools.py tests/unit/test_tool_dispatcher.py tests/test_099_skill_composition.py tests/integration/test_skills_import_export.py -q` | 87 passed | PASS |
| Frontend import-note render | `npm run test -- SkillsPage.import` | 5 passed | PASS |
| `tsc --noEmit` | `npx tsc --noEmit` | 0 errors | PASS |
| Full backend unit suite baseline-rot check | `pytest tests/unit -q` (with and without the 142 test files) | 60 failed / 1154 passed both ways (same failure count regardless of 142 test presence) | PASS — confirms the 60 failures are pre-existing cross-test-pollution rot, not caused by Phase 142 (composition of the 60 varies by run/inclusion order — a known suite-fragility issue, not scoped to this phase's files) |

### Probe Execution

No `scripts/*/tests/probe-*.sh` probes declared or discovered for this phase. SKIPPED (no runnable probe entry points — this is a backend service + frontend page phase, not a migration/tooling phase).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SRH-01 | 142-01, 142-02, 142-03, 142-04, 142-05 (phase-spanning) | Honest "cannot execute this skill type" signal instead of silent failure / fake narration | **NEEDS HUMAN** (mechanism SATISFIED; narration-across-providers unverified) | All 5 plans' automated must-haves verified in code + tests (see truths #1-7). REQUIREMENTS.md top-level checklist shows SRH-01 as `[x]` (line 48) but the Requirement Traceability table (line 90) still shows "Pending (gated)" — these two locations disagree. Per this verification, SRH-01 should NOT be marked fully complete until the human_needed items (cross-provider narration + D-03 stock-skill proof) are exercised, since 142-VALIDATION.md itself flags them as required manual verifications that are still unstarted. |

**Orphaned requirements check:** `grep -E "Phase 142" .planning/REQUIREMENTS.md` returns no rows beyond the SRH-01 entry already covered above — no orphaned requirements.

### Anti-Patterns Found

None found in the phase's touched files. Scanned for `TBD`/`FIXME`/`XXX` (zero hits), `TODO`/`HACK`/`PLACEHOLDER` (zero load-bearing hits — matches on `_PLACEHOLDER_TOKEN_RE`/`placeholder_keys` etc. are pre-existing Phase 101 template-fill code, unrelated), `console.log`-only handlers (none), and hardcoded-empty stub props (none). The two REVIEW.md `info`-level findings (IN-01 inconsistent extension-extraction idiom between `_decode_skill_file_bytes`'s `rsplit` and `_skill_runtime_note`'s `splitext`; IN-02 stale docstring claiming "MUST stay identical to pre-099" + a redundant `NOT_FOUND_PHRASES` entry) remain unaddressed but are cosmetic/non-blocking — they do not affect correctness for any current `SCRIPT_EXTS` member and were explicitly dispositioned as `info` (not `critical`/`warning`) by the code reviewer.

### Human Verification Required

### 1. Cross-provider honest narration on a real runtime-gap failure

**Test:** For each of OpenAI, Anthropic, Google (Gemini), and (best-effort) OpenRouter — load a skill that drives a known-missing binary (`soffice`/`markitdown`) or bundles a `.js` step, prompt a task that exercises it, and observe the agent's behavior.
**Expected:** The sandbox is invoked at most once per gap token in the run; the model tells the user honestly that the step can't run here (using the in-sandbox alternative or saying it's unavailable) instead of narrating fake success, silently mis-running the script as Python, or retrying indefinitely.
**Why human:** Model narration in response to the reshaped `runtime_gap` tool result is provider-behavioral free text, not deterministic — this is exactly what 142-VALIDATION.md's Manual-Only Verifications table calls out, and it is still unstarted (no `142-HUMAN-UAT.md`, all 3 rows unchecked).

### 2. D-03 / BUG-260707-02 stock-skill generic loop-cap proof

**Test:** Re-import the UNMODIFIED stock Anthropic pptx skill (the one that originally triggered the 8-round soffice/markitdown retry loop), run a task that drives its office-conversion step, and watch the agent's tool-call sequence.
**Expected:** The loop does not repeat 8 rounds — it stops at <=1 real dead sandbox call per token, generically (not because of the prior per-user hand-patched instruction rewrite, which is now belt-and-suspenders per D-03).
**Why human:** `test_pptx_soffice_loop_capped` proves the cap by construction against a mocked sandbox session; it does not prove the real stock skill content + a live model's actual tool-call sequencing produce the same result end-to-end.

### 3. Multi-tool row: load_skill flag + execute_code reshape together

**Test:** One live prompt that both loads a skill bundling a non-Python script (surfacing the `load_skill` `runtime_note`) AND drives that skill's dead sandbox step (surfacing the `execute_code` `runtime_gap` reshape) in the same turn.
**Expected:** Both signals reach the model and both are narrated honestly in the same turn.
**Why human:** Exercises the D-05 proactive + D-06 reactive surfaces together against a live provider; flagged as manual-only in 142-VALIDATION.md, unstarted.

### Gaps Summary

No coded gaps. All automated must-haves across all 5 plans are present, substantive, and correctly wired — including full verification that the 4 code-review fix commits (`330453f3` CR-01, `6904701c` CR-02, `017e7000` WR-01, `8ba38181` WR-02) are genuinely present in the codebase and independently re-provable via hand-written adversarial calls outside the existing test suite. The backend unit suite's 60 pre-existing failures were confirmed unrelated to this phase (identical failure count with and without the 142 test files present).

The phase is withheld from `passed` status only because its own validation strategy (142-VALIDATION.md) explicitly requires 3 live/manual verifications — cross-provider honest narration, the D-03 generic stock-skill loop-cap proof, and a multi-tool live row — that have not been exercised. These are exactly the kind of "does the model actually narrate honestly" behaviors that cannot be settled by mocked unit tests, and the phase's own planning artifacts already flagged this. SRH-01 should not be marked fully complete in REQUIREMENTS.md until these are run (or the operator explicitly accepts the mechanism-only verification as sufficient).

---

_Verified: 2026-07-08T03:39:12Z_
_Verifier: Claude (gsd-verifier)_
