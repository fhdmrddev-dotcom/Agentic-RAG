---
phase: 122-cross-provider-trust-honesty-parity
audited: 2026-06-23
asvs_level: 1
state: B
threats_total: 18
threats_closed: 18
threats_open: 0
mitigate: 13
accept: 5
transfer: 0
unregistered_flags: 0
status: SECURED
---

# Phase 122 — Cross-Provider Trust & Honesty Parity: Security Audit

**Audited:** 2026-06-23
**ASVS Level:** L1
**State:** B (no prior SECURITY.md — register authored at plan time, verified against shipped implementation)
**Disposition:** SECURED — 18/18 threats closed, threats_open = 0

The threat register was authored at plan time (4 plan `<threat_model>` blocks). This audit verified each declared mitigation against the shipped code by source-read + grep + git-diff + the load-bearing tests — it did NOT scan for new vulnerabilities. The 4 SUMMARY files each report `## Threat Flags: None`; the REVIEW reports 0 critical / 4 warning. No new attack surface was introduced (no new endpoint, auth path, file access, or schema change). The phase is FE-clean and migration-free; the only adapter-boundary edits are subtractive (removed gate + removed inert strict flag).

## Threat Verification

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-122-01-01 | Information Disclosure | accept | `git diff` of Phase 122 over `openai_service.py` touches ONLY the forcing-translation lines (`import copy` removal, `_fn["strict"]=True` loop removal, `and provider=="openai"` gate removal). The 111.1 local-provider routing (`resolve_llm_provider`/`ollama`/`lmstudio`, `create_adaptive_streaming_chat:1457`) and the DeepSeek thinking-off block (`:1520-1525`) show NO `+/-` lines — injection/local-provider routing unaltered. Acceptance holds. |
| T-122-01-02 | Tampering | mitigate | `openai_service.py:1546-1572`: with the function-level `strict` flag removed, the strict `json_schema` `response_format` is still built whenever `strict_response_format` is true (`:1564-1572`). `test_gateway_forcing.py::test_openai_force_strict_preserved` (A4) PASSES — OpenAI force_strict still emits json_schema; removing the inert flag did not weaken OpenAI. |
| T-122-01-03 | Spoofing | mitigate | `config.py:200-203` documents default-SAFE `coerce` on a registry miss; `forced_emit.py:376-378` reads `cap.get("emit_tier","coerce")` + a boundary guard coercing unknown values to `coerce`. `test_config_registry.py::test_force_strict_is_openai_only` + `test_no_non_openai_force_strict` + `test_deepseek_is_force` PASS (14 force_strict, all OpenAI; 0 non-OpenAI; both DeepSeek = force). No non-OpenAI row can claim token-level strict. |
| T-122-01-SC | Tampering | mitigate | SUMMARY `tech-stack.added: []`. Phase 122 diff is first-party edits to `config.py`/`openai_service.py`; no package install. |
| T-122-02-01 | Spoofing | mitigate | `forced_emit.py:481-502`: every rung calls `_extract_or_recover` (validates via `_validate_args`/`recover_narrated_emission` against the Pydantic `schema_model`); a non-validating result sets `last_failure` and the loop descends. After all rungs, `_failure(...)` floor (`:507-513`) returns `emitted=None` (never silent, never prose-as-artifact). `test_forced_emit.py::test_ladder_descent_strict_to_coerce` proves the descent reaches the honest path non-vacuously. |
| T-122-02-02 | Tampering | mitigate | `forced_emit.py:485-490`: the only write on a winning rung is `logger.info("emit_rung=…")` (identifier-only). No assignment back into `MODEL_CAPABILITIES` anywhere in the loop (grep-confirmed; REVIEW corroborates "no write path back into MODEL_CAPABILITIES"). Pure runtime recovery. |
| T-122-02-03 | Information Disclosure | accept | `forced_emit.py:386-426` (the 111.1 cross-provider key/base_url injection block) shows NO `+/-` lines in the Phase 122 diff (last touched in 111.1 commit `5e628ddf`). Key resolution unchanged — TARGET-provider key injected onto a `model_copy`, not the shared settings. Acceptance holds. |
| T-122-02-04 | Information Disclosure | mitigate | The two ladder log statements (`:467-470` descend, `:487-490` win) emit `rung_name`, `emit_tier`, `provider` ONLY — never `messages`/args content (T-073-04). Source-verified. |
| T-122-02-SC | Tampering | mitigate | SUMMARY `tech-stack.added: []`. First-party edit to `forced_emit.py` + test; no package install. |
| T-122-03-01 | Tampering | mitigate | `eval_cross_provider.py:1827`: `assert_localhost_only()` fires in `main()` BEFORE the `args.forced_emit` dispatch (`:1840`); `run_forced_emit_matrix` opens no DB/HTTP before the gate. `:431` fails closed via `sys.exit(1)` when SUPABASE_URL is not localhost. `test_eval_forced_emit.py::test_localhost_gate_raises_systemexit_on_cloud_url` PASSES. |
| T-122-03-02 | Information Disclosure | mitigate | `report_env_presence` (`:390-411`) prints `set`/`MISSING` only, never values. `_drive_forced_emit_cell` (`:1547`) uses `os.getenv(key_env)` as a presence-only bool; the exception path (`:1577`) logs `type(e).__name__` only. The scoreboard writer (`emit_forced_emit_scoreboard:1630-1701`) dumps `cells` = provider/model/difficulty/tier/axes/winning_rung/documented — model NAMES + verdicts only, no key material. |
| T-122-03-03 | Tampering | mitigate | The `--forced-emit` matrix is a direct-call harness with no DB read; no new dynamic SQL was added. The existing `_COUNT_QUERIES` (`:111-114`) remain fixed constant strings with parameterized `%s` (no identifier interpolation, T-088-02-04). |
| T-122-03-04 | Authentication | accept | `get_bearer_token` (`:595-633`) mints a bearer for the documented LOCAL test user via the existing Supabase password grant; explicitly never prints the token (`:625` does not echo the response body; the token is returned, never logged). The new `--forced-emit` mode mints NO bearer (direct-call, no agent run) — strictly less auth surface. Acceptance holds. |
| T-122-03-SC | Tampering | mitigate | SUMMARY `tech-stack.added: []`. The eval imports already-pinned venv deps (psycopg2/requests/python-dotenv); no install. |
| T-122-04-01 | Tampering | mitigate | The nudge is present at `agent_loop.py:502-504` ("ALWAYS set `description` to a short, specific label … never a generic phrase like 'Run code' — the user sees this label live in their workspace panel"). `test_system_prompt.py::test_system_prompt_has_execute_code_label_nudge` pins the fragments (`description`/`specific label`/`run code`/`workspace panel`) — a silent deletion fails CI. PASSES. |
| T-122-04-02 | Information Disclosure | accept | The model-authored `description` flows through the pre-existing `tool_args_progress` → `humanize()` (`workspacePanel.ts:178-186`) → panel path. No new data path; the panel already renders model output. Acceptance holds. |
| T-122-04-03 | Tampering | accept | The nudge is a static string literal embedded directly in the SHARED `SYSTEM_PROMPT` (`agent_loop.py:502-504`), author-controlled, not user input. `test_execute_code_nudge_is_provider_agnostic` confirms no provider-name branch leaked. No new injection surface. Acceptance holds. |
| T-122-04-SC | Tampering | mitigate | SUMMARY `tech-stack.added: []`. One prompt string + two test files; the `humanize` export is a one-word visibility tweak. No package install. |

## Accepted Risks Log

| Threat ID | Risk | Rationale (verified against code) |
|-----------|------|-----------------------------------|
| T-122-01-01 | Cross-provider key/base_url injection at the forcing seam | Phase 122 git-diff over `openai_service.py` touches only the forcing-translation lines; the 111.1 local-provider routing + DeepSeek thinking-off blocks are untouched (0 `+/-` lines). The gate removal cannot have altered key resolution. |
| T-122-02-03 | Cross-provider key leakage at the forcing seam | The `forced_emit.py:386-426` injection block (TARGET-provider key on a settings `model_copy`) shows 0 `+/-` lines in the Phase 122 diff. The ladder re-uses it unchanged; key resolution is byte-identical. |
| T-122-03-04 | Eval bearer mint | `get_bearer_token` mints a LOCAL-test-user bearer via the existing password grant and never prints token material. The new `--forced-emit` mode mints no bearer at all (direct-call) — net-zero new auth surface. |
| T-122-04-02 | Model-authored description leaking sensitive content into the panel | The description rides the existing `tool_args_progress` → panel path; no new data egress. The panel already renders model output; the nudge only changes WHAT the model labels, not WHERE it flows. |
| T-122-04-03 | The nudge as a prompt-injection vector | Static, author-controlled string in the shared SYSTEM_PROMPT — not user input. Provider-agnostic (test-guarded). No new injection surface. |

## Unregistered Flags

None. All 4 SUMMARY `## Threat Flags` sections report `None`. No new attack surface (endpoint / auth path / file access / schema change) appeared during implementation — the phase is migration-free, FE-clean, and the adapter-boundary edits are subtractive (removed gate + removed inert flag). The 4 REVIEW warnings (WR-01..04) are quality/robustness issues in the eval `recovery` axis + stale docstrings; none maps to an OPEN threat or a new security surface, and none alters a declared mitigation.

## Note on the live-UAT eval-input-shape fixes

The live UAT added two small fixes to `scripts/eval_cross_provider.py` — a `"type":"function"` key on the tool fixtures (`:1344`/`:1363`) and a non-empty `_FORCED_EMIT_SYSTEM` system prompt (`:1406-1409`) — plus 2 guard tests. Confirmed: both are static test-fixture string literals. They do NOT touch the localhost gate (`assert_localhost_only`), env reporting (`report_env_presence`), the bearer mint (`get_bearer_token`), or any SQL path. They introduce no new secret-handling, SQL, or auth surface.

## Verification Method

- Source-read of every cited seam (`config.py`, `forced_emit.py`, `openai_service.py`, `eval_cross_provider.py`, `agent_loop.py`, `workspacePanel.ts`) at the exact threat-cited line ranges.
- `git diff` of the Phase 122 commit range over `forced_emit.py` + `openai_service.py` to prove the ACCEPT-disposition seams (injection block, local-provider routing, thinking-off) carry 0 `+/-` lines.
- Load-bearing tests run green in the backend venv: `test_config_registry.py` (force_strict ⊆ OpenAI invariant), `test_gateway_forcing.py` (gate removal + A4 preservation), `test_forced_emit.py` (non-vacuous strict→coerce descent + tier-scoping + default), `test_eval_forced_emit.py` (localhost SystemExit gate), `test_system_prompt.py` (nudge string-presence guard) — 54 passed.

**Result: SECURED. threats_open = 0. Phase 122 may ship from a security standpoint.**
