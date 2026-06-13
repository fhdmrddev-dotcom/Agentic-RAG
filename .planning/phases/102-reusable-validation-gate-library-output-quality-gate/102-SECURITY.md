---
phase: 102
slug: reusable-validation-gate-library-output-quality-gate
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-13
---

# Phase 102 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Phase 102 ships: a closed-registry validator library (9 kinds), deterministic KB-freshness
> checks, an LLM-judge rubric gate riding `forced_emit`, citation-policy modes
> (strict/flag/partial/draft), an ask_user pre-gate pause with governance receipts, and a
> `POST /workflows/{definition_id}/publish` endpoint that runs a real golden run + judge gate
> before flipping draft→published.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Author JSONB → Pydantic | Workflow definition JSONB crosses into strict-parse models (`_StrictBase extra='forbid'`). Unknown kinds or keys raise `ValidationError` before the engine runs. | Workflow definition payload (kind Literals, policy enums, business_requirement) |
| Code → Postgres CHECK | `_AUDIT_EVENT_TYPES` frozenset must mirror the `harness_audit_event_type_check` DB CHECK constraint or a receipt INSERT 23514s mid-run. Maintained in lockstep (plans 01/03). | Harness audit event_type strings (22 kinds, migration 070) |
| Engine → Validator Registry | ValidatorSpec.kind resolves only through the closed VALIDATOR_REGISTRY. An unregistered kind never executes. | Gate result (GateResult pass/fail + error_message) |
| Freshness → Postgres | KB-freshness queries bind folder_scope IDs via `$N` placeholders only — no f-string SQL, no prompt-supplied scope. | folder_id UUIDs, document created_at timestamps |
| Publish Endpoint → Ownership | `get_definition` owner-scopes all draft reads; cross-user and not-found both collapse to `None` → uniform 404. | definition_id + user_id (authenticated caller) |
| forced_emit → Judge Verdict | The judge emission is validated against `JudgeVerdict` schema; a failure/None result is an honest gate fail, never a silent pass. | LLM tool-call response (forced emission, schema-bound) |
| ask_user Pause → Receipt | A Proceed answer after a validator finding writes a `validator_ask_user_approved` governance receipt (INSERT-only); an unanswered/Abort disposition maps to `fail_run`. | User choice (Proceed / Abort), validator error_message |
| Publish Flip → Immutability | `publish_definition` flips `WHERE id=$1 AND status='draft'`; the DB immutability trigger blocks published→edit. A `-1` return (race loser) maps to `already_published`, no false receipt. | workflow_definitions.status transition |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-102-01-01 | Tampering | ValidatorSpec.kind injection | mitigate | `_StrictBase extra='forbid'` + closed 9-kind Literal in `models/harness.py:170` — unknown kind raises `ValidationError` before engine runs | closed |
| T-102-01-02 | Tampering | harness_audit CHECK / `_AUDIT_EVENT_TYPES` drift | mitigate | `_AUDIT_EVENT_TYPES` (22 kinds) at `db/workflows.py:45`; `write_audit` ValueError fail-fast at `:610`; CHECK constraint in migration `070:14` | closed |
| T-102-01-03 | Elevation of Privilege | is_golden_run column abuse | accept | See Accepted Risks Log — AR-102-01 | closed |
| T-102-01-04 | Information Disclosure | pre-102 JSONB row failing new field validation | mitigate | Every new field optional-with-default in `models/harness.py` (timing:`post`, citation_policy:`strict`, business_requirement:`None`) — old rows `model_validate()` unchanged | closed |
| T-102-02-01 | Tampering | Partial/failed migration apply leaving CHECK inconsistent | mitigate | Migration is additive-only ALTERs (no CREATE TABLE); `ADD COLUMN IF NOT EXISTS` is idempotent; full 22-kind CHECK in single statement at `070:13-26` | closed |
| T-102-02-02 | DoS | db reset wiping dev data | mitigate | Process control: migration is additive ALTER only (no destructive DDL); CLAUDE.md rule enforces SQL editor apply, never `db push`/`db reset`; confirmed in migration header comment at `070:7-11` | closed |
| T-102-03-01 | Spoofing/Repudiation | llm_judge_rubric silent pass on narrated/truncated verdict | mitigate | Judge rides `forced_emit`; failure/None → `GateResult(False, ...)`; `overall_passed` is schema-bound bool in `JudgeVerdict` at `validator_kinds.py:106`; failure guard at `:465-468` | closed |
| T-102-03-02 | Tampering | Prompt injection via business_requirement/KB coercing judge | mitigate | `JUDGE_RUBRIC_CORE` is a fixed prompt at `validator_kinds.py:120`; requirement/evidence woven as clearly-delimited DATA (`:133-136`); `overall_passed` derivation is schema-bound at `:490` — not narratable | closed |
| T-102-03-03 | DoS | Validator raising into the run loop | mitigate | Every kind returns `GateResult(False, ...)` on error; `except Exception` catchall at `validator_kinds.py:325` (output_file_valid) with WR-07 note; docstring at `:17-19` declares fail-CLOSED contract for all 5 kinds | closed |
| T-102-03-04 | Tampering (SSTI) | output_file_valid re-opening untrusted template | accept | See Accepted Risks Log — AR-102-02 | closed |
| T-102-03-05 | Information Disclosure | Freshness leaking cross-scope document metadata | mitigate | Both freshness queries use `ANY($1::uuid[])` with `$N` placeholders only; no f-string SQL; confirmed in `freshness.py:17,48,60,78,98` | closed |
| T-102-04-01 | DoS | ask_user disposition stranding a paused run | mitigate | `subscribe_for_response` returns `None` on timeout → `PhaseOutcome("fail_run", ...)` at `harness_engine.py:944-946`; unanswered path documented at `:932` | closed |
| T-102-04-02 | Repudiation | Proceed-on-stale with no audit trail | mitigate | `validator_ask_user_approved` receipt written at `harness_engine.py:986` (INSERT-only, run-owner bound); receipt includes choice + finding + version_ambiguity_v1_cut metadata | closed |
| T-102-04-03 | Spoofing | Non-strict policy silently passing off unverified data | mitigate | `flag` marks `[unverified]`, `partial` blanks + gap list, `draft` labels DRAFT; deterministic driver; policy summary surfaced on render success (`phase_types.py:1323`); T-102-04-03 referenced at `emit_policy.py:143` | closed |
| T-102-04-04 | Tampering | Strict path drifting from byte-identical | mitigate | Strict branch calls `_emit_failure_output("citation_gate_rejected", ...)` at `phase_types.py:1293-1295`; strict check at `:1284`; non-strict branch never reached on strict path | closed |
| T-102-04-05 | Elevation of Privilege | Pre-gate validator widening retrieval scope | accept | See Accepted Risks Log — AR-102-03 | closed |
| T-102-05-01 | Elevation of Privilege | Publishing another user's draft | mitigate | `get_definition` queries `WHERE id=$1 AND (created_by=$2 OR (is_global=true AND status='published'))` at `db/workflows.py:226`; non-owner → `None` → 404 at `api/workflows.py:129-131` | closed |
| T-102-05-02 | Spoofing/Repudiation | Gameable verdict silently passing bad output | mitigate | Judge rides `forced_emit` (real forced shot, no mocks); REAL golden run (`is_golden_run=True`); `publish_attempted`/`publish_succeeded`/`judge_verdict` receipts in `publish_service.py:16-17` | closed |
| T-102-05-03 | Tampering | Prompt injection via business_requirement/golden_input | mitigate | Fixed rubric core (`JUDGE_RUBRIC_CORE`) with delimited DATA sections; judge independent of run model (`resolve_judge_model` at `publish_service.py:666`); same schema-bound verdict | closed |
| T-102-05-04 | DoS | Publish spam (golden run cost vector) | mitigate | Owner-scope bounds (only the owner can initiate); wall-clock + step caps via `asyncio.wait_for(harness_publish_max_seconds)` at `publish_service.py:185,195`; rate-limit deferred, documented | closed |
| T-102-05-05 | Tampering | Publish flip bypassing immutability trigger | mitigate | `publish_definition` uses `WHERE id=$1 AND status='draft' RETURNING version` at `db/workflows.py:251-252`; DB trigger blocks published→edit | closed |
| T-102-05-06 | Information Disclosure | not_found leaking draft existence | mitigate | `get_definition` returns `None` for both not-found AND cross-user; uniform 404 at `api/workflows.py:129-131`; no-existence-leak noted at `db/workflows.py:215-216` | closed |
| T-102-06-01 | Tampering | forced_emit schema_model seam | mitigate | `_model = schema_model or EmitFieldMap` at `forced_emit.py:149`; `forced_emit` never imports `JudgeVerdict` (function-local import in callers); truncation guard (`is_truncated`) inherited via same validation loop | closed |
| T-102-06-02 | Elevation of Privilege | Judge model resolution (self-judge) | mitigate | `resolve_judge_model` resolves independent judge model from `Settings.harness_judge_model` at `validator_kinds.py:58`; `publish_service.py:666` uses the same helper — never the run model | closed |
| T-102-06-03 | Information Disclosure | owner_settings forwarded to judge | accept | See Accepted Risks Log — AR-102-04 | closed |
| T-102-07-01 | Information Disclosure | output_file_valid config[path] filesystem oracle | mitigate | config[path] resolved via `get_file_by_path` (owner-scoped workspace lookup) at `validator_kinds.py:299-301`; out-of-workspace → `GateResult(False, "...is not a workspace file")`; raw `{e}` text dropped at `:325-329` (WR-07) | closed |
| T-102-07-02 | Repudiation | validator_ask_user_approved receipt version-ambiguity | mitigate | Honest "Proceed despite version ambiguity" choice at `harness_engine.py:806`; `version_ambiguity_v1_cut` metadata added to receipt at `:978-982` | closed |
| T-102-07-03 | Spoofing | Freshness scope resolution | accept | See Accepted Risks Log — AR-102-05 | closed |
| T-102-08-01 | Tampering | Policy-aware render gate | mitigate | Gate weakens ONLY when `args.get("citation_policy_applied")` is truthy (server-set at `phase_types.py:1389`); strict path (no key) rejects byte-identical at `tool_dispatcher.py:1614-1615` (T-102-08-01 referenced at `:1613`) | closed |
| T-102-08-02 | Repudiation | Non-strict delivery honesty | mitigate | Policy summary surfaces ONLY after successful render; IN-03 note at `phase_types.py:1342-1344`; `policy_applied_summary` carried into render-success text at `:1323,1414-1416` | closed |
| T-102-08-03 | Tampering | Partial over-blanking cited data | mitigate | Matching on full `(location, field)` pair in `_offending_leaves` at `emit_policy.py:59-63`; no-op verdict fails back to strict at `:162-164`; WR-06 documented at `:41-47` | closed |
| T-102-09-01 | Elevation of Privilege | get_definition global-draft exposure | mitigate | Publish read restricted to `created_by=$2 OR (is_global=true AND status='published')` at `db/workflows.py:226`; bare `OR is_global=true` removed; T-102-09-01 referenced at `:208` | closed |
| T-102-09-02 | Repudiation | Concurrent double-publish false receipt | mitigate | `version==-1` sentinel → `already_published` block at `publish_service.py:304-313`; no false `publish_succeeded` receipt; WR-03 documented at `:298-303` | closed |
| T-102-09-03 | DoS | Unbounded synchronous golden run + interactive dead-end | mitigate | `asyncio.wait_for(harness_publish_max_seconds)` at `publish_service.py:185,195`; `_interactive_phase_failures` pre-block at `:161-168`; `harness_publish_max_seconds` setting at `config.py:972` | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-102-01 | T-102-01-03 | `is_golden_run` is an additive boolean DEFAULT false. No RLS surface is added (additive column, the 068 ADD COLUMN IF NOT EXISTS pattern). The `publish_definition` function (Plan 05) is the only writer that sets `is_golden_run=True`; ordinary run listings filter it out via the same owner-scoped queries. An attacker who could INSERT a workflow_run with `is_golden_run=True` via the API already has authenticated access as the run owner — the column adds no new privilege surface. The risk of a hidden run is bounded by the existing owner-scope RLS on `workflow_runs`. | developer (phase author) | 2026-06-13 |
| AR-102-02 | T-102-03-04 | `output_file_valid` wraps `assert_integrity` as a read-only oracle — it re-opens the produced file to check format validity but never renders it. The SSTI boundary is upstream in the `render_template` tool path (Phase 101) and is unchanged by this phase. The validator only receives a pre-produced file and calls a format-check primitive that does not evaluate template expressions. No new SSTI surface is introduced. | developer (phase author) | 2026-06-13 |
| AR-102-03 | T-102-04-05 | The pre-gate validator (freshness, with `timing="pre"`) operates over `accumulated_outputs` from prior phases using the same closed 9-kind VALIDATOR_REGISTRY and the same owner-bound folder_scope resolved by PROJ-02 (Phase 098 project-folder binding). The scope is server-resolved, not prompt-supplied; the freshness queries use `$N` parametrised SQL. No new retrieval widening path is introduced — the validator reads document metadata (created_at, filename), not document content. | developer (phase author) | 2026-06-13 |
| AR-102-04 | T-102-06-03 | `owner_settings` forwarded to the judge shot are the same settings the golden run itself used, loaded by `load_user_settings(str(user_id))` and owner-bound. The publish endpoint already verified ownership at stage 0 (get_definition owner-scope check). Forwarding owner settings to the judge does not widen the trust boundary — the same owner already drove the golden run. Degradation on load failure is graceful (falls back to None, judge resolves its own model). | developer (phase author) | 2026-06-13 |
| AR-102-05 | T-102-07-03 | Freshness scope (`folder_subtree_ids`) is server-resolved from the workflow definition's `project_folder_id` via `folder_subtree_ids` (PROJ-02, Phase 098) — never prompt-supplied or user-controllable at request time. The `freshness.py` queries bind this server-resolved list via `ANY($1::uuid[])`. There is no user-controlled injection point for the scope. | developer (phase author) | 2026-06-13 |

*Accepted risks do not resurface in future audit runs.*

---

## Threat Flags from SUMMARY.md

No unregistered threat flags were raised in any Plan 01–09 SUMMARY.md. The Plan 01 SUMMARY explicitly states: "No new network endpoint, auth path, or trust-boundary surface introduced — no threat flags." Plans 06–09 SUMMARY sections confirm their gap-closure changes fall within existing registered threat IDs (T-102-06-01, T-102-06-02, T-102-08-01, T-102-08-03, T-102-09-01, T-102-09-02, T-102-09-03).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-13 | 34 | 34 | 0 | gsd-security-auditor (claude-sonnet-4-6) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (5 entries: AR-102-01 through AR-102-05)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-13
