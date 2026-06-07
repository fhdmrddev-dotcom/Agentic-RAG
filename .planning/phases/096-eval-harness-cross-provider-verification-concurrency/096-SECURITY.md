---
phase: 096
slug: eval-harness-cross-provider-verification-concurrency
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-07
---

# Phase 096 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**ASVS Level:** L1
**Block-on:** open
**Verification date:** 2026-06-07
**Auditor:** gsd-security-auditor (claude-sonnet-4-6)

---

## Threat Verification Summary

**Total threats:** 28 (24 mitigate + 4 accept)
**Closed:** 28/28
**Open:** 0/28

---

## Mitigate Threats — All CLOSED

| Threat ID | Category | Component | Disposition | Evidence |
|-----------|----------|-----------|-------------|----------|
| T-096-01-01 | Tampering | migration 066 inserts | mitigate | `supabase/migrations/066_eval_coverage_seed.sql:29,55,127` — fixed UUID `0000000000c1` + `ON CONFLICT (id) DO NOTHING` on both seed-user and definition rows; no string interpolation in file |
| T-096-01-02 | Elevation | eval_slow_step registry | mitigate | `backend/app/services/harness/programmatic.py:36,128` — `PROGRAMMATIC_PHASE_REGISTRY` is a closed dict; `@register_programmatic("eval_slow_step")` at line 128; registered at module-load time only, never resolved dynamically/eval'd; pure async fn, no side effects beyond asyncio.sleep |
| T-096-02-01 | Info disclosure | CI logs | mitigate | `backend/tests/test_096_ci_workflow_regression.py` — grep `_API_KEY` = 0 matches (confirmed); no `import requests` for provider calls; test is fully offline with scripted fake gateway |
| T-096-02-02 | Tampering | whitelist guard | mitigate | `backend/tests/test_096_ci_workflow_regression.py:559` — `test_096_whitelist_refusal` function present; SUMMARY 096-02 confirms whitelist wiring fix (sub_ctx now carries phase_whitelist) shipped alongside this test as its regression lock |
| T-096-02-03 | Repudiation | double-executed phases | mitigate | `backend/tests/test_096_ci_workflow_regression.py:681,804,813,849` — `test_096_resume_two_phase_writes`; asserts second `mark_phase_active` appears in pool.calls for the same phase after the sweep; CAS claim precedes re-run |
| T-096-03-01 | IDOR | runs.py ask_user_response | mitigate | `096-03-SUMMARY.md:73,142` — `git diff backend/app/api/runs.py` confirmed empty; 404-never-403 posture byte-identical; runs.py untouched |
| T-096-03-02 | Info disclosure | /pending liveness JOINs | mitigate | `backend/app/api/panel.py:108,133,148,202` — `_prompt_run_is_live` post-filter; ownership gate (`_verify_thread_ownership`) unchanged and first; liveness joins only consult wr/dr status for prompts the authenticated user already owns |
| T-096-03-03 | SQLi | panel.py + harness_engine.py new SQL | mitigate | `backend/app/api/panel.py`: all queries use `$1`/`$2` asyncpg placeholders; no f-string SQL in file. `backend/app/services/harness_engine.py:199-237`: SELECT uses `$1`/`$2`; INSERT uses `$1`/`$2`/`$3`; grep for f-string SQL patterns returns 0 matches in harness_engine.py |
| T-096-03-04 | Repudiation | expiry writes | mitigate | `backend/app/services/harness_engine.py:227` — `INSERT INTO messages ...` only; no UPDATE statement in `_expire_pending_ask_user` function body (lines 179-237) |
| T-096-04-01 | XSS | PendingAskCard render | mitigate | `frontend/src/components/panel/PendingAskCard.tsx` — `dangerouslySetInnerHTML` count = 0; error strings at lines 243, 248 are constant string literals, not server-echoed text |
| T-096-04-02 | Info disclosure | 404 handling | mitigate | `frontend/src/components/panel/PendingAskCard.tsx:239-244` — 404 branch renders only constant string "This prompt has expired — the run is no longer active"; server response body is never read or rendered |
| T-096-05-01 | DoS | browser connection pool | mitigate | `frontend/src/providers/StreamsProvider.tsx:141` — `const STREAM_POOL_SIZE = 3`; `enforceStreamPool` at line 1059 evicts threads outside the keep-set; `isThreadInStreamPool` gate at 6 sites (1036, 1096, 1238, 1344, 1394, 1621/1689) |
| T-096-05-02 | Tampering | shared SSE/chunk path | mitigate | `096-05-SUMMARY.md` — `git diff backend/` confirmed EMPTY; only 2 frontend files modified; SSE vocabulary and all 8 provider paths byte-identical |
| T-096-06-01 | Tampering/DoS | eval vs cloud DB | mitigate | `scripts/eval_cross_provider.py:1347` — `assert_localhost_only()` called in `main()` BEFORE `report_env_presence()` and any DB/HTTP operations |
| T-096-06-02 | Info disclosure | script output | mitigate | `scripts/eval_cross_provider.py:390-413` — `report_env_presence()` prints only `set`/`MISSING` for each var name; capability table at `.planning/eval/` contains model names + metrics, no key values |
| T-096-06-03 | SQLi | plan-06 DB assertions | mitigate | `scripts/eval_cross_provider.py:111-272` — `_COUNT_QUERIES` and `_WORKFLOW_QUERIES` dicts hold constant strings; all dynamic values are single `%s` parameters; no f-string SQL |
| T-096-06-04 | Spoofing | ask_user auto-answer | mitigate | `scripts/eval_cross_provider.py:818-819` — uses `/runs/{workflow_run_id}/ask_user_response` (the panel's owner-scoped endpoint); comment documents runs.py:521-567 anchor-confirm is the server-side guard; no bypass added |
| T-096-07-01 | Tampering/DoS | plan-07 scripts vs cloud | mitigate | `scripts/restart_smoke.py:722` — `assert_localhost_only()` first in `main()` (line 718-722); `scripts/conc_probe.py:590` — same pattern (line 586-590); both gate BEFORE any DB/HTTP |
| T-096-07-02 | Info disclosure | script output | mitigate | `scripts/restart_smoke.py:186-205`, `scripts/conc_probe.py:166` — `report_env_presence()` in both; presence-only discipline ("secret VALUES are never printed"); markers carry slugs/metrics only |
| T-096-07-04 | SQLi | overlap/audit queries | mitigate | `scripts/restart_smoke.py:106,139` — `_SMOKE_QUERIES` constant-string dict; HAVING count query at line 139; `scripts/conc_probe.py:119-139` — `_CONC_QUERIES` constant strings with `%s` params |
| T-096-08-01 | Info disclosure | curation output/SUMMARY | mitigate | `scripts/curate_models.py:365` — "secret VALUES are never printed"; CURATE_LIVE/MISSING/STALE/DEFAULT/SKIP emit model IDs and env-var names only; `096-08-SUMMARY.md` contains no secret values |
| T-096-08-02 | Tampering | app_settings UPDATEs | mitigate | `scripts/curate_models.py:458-461` — `assert_localhost_only()` called before `load_settings_model_lists()` DB read; actual UPDATE executed as parameterized constant SQL (`UPDATE app_settings SET provider_model_lists = %s::jsonb, updated_at = now() WHERE id = 'global'`) — exact statement recorded in `096-08-SUMMARY.md:98-99` |
| T-096-08-03 | Tampering | registry edits | mitigate | `096-08-curation-output.txt:19,57,190` — `CURATE_LIVE openai gpt-5.5-pro`, `CURATE_LIVE anthropic claude-opus-4-8`, `CURATE_LIVE minimax MiniMax-M3` present; SUMMARY confirms post-apply CURATE_STALE = 0; operator checkpoint (Task 3 gate) approved before commit |
| T-096-08-04 | DoS | wrong model defaults | mitigate | `scripts/eval_cross_provider.py:861-998` — `model_effective` from sub-agent `runs.model` rows (Pitfall-1 backstop); operator approved curation diff at checkpoint before `e6a50e24` committed; `096-08-SUMMARY.md:121` — 14 config-touching tests pass, net-new failures 0 |

---

## Accept Threats — All CLOSED (rationale in plan files)

| Threat ID | Category | Disposition | Accepted Rationale |
|-----------|----------|-------------|-------------------|
| T-096-01-03 | Denial of service | accept | `096-01-PLAN.md:211` — bounded single asyncio.sleep in an async task (non-blocking); only reachable via the eval seed workflow on a dev box |
| T-096-04-03 | Spoofing | accept | `096-04-PLAN.md:184` — created_at from owner-scoped /pending (RLS-postured); worst case is a mis-timed countdown, no security impact |
| T-096-05-03 | Info disclosure | accept | `096-05-PLAN.md:187` — cursors are opaque per-user offsets into the user's own run buffers; replay re-auth happens at re-subscribe (existing auth path) |
| T-096-07-03 | Elevation | accept | `096-07-PLAN.md:172` — dev-local only by construction (localhost gate); /admin/backpressure production allow-list unchanged |

---

## Unregistered Threat Flags

SUMMARY.md `## Threat Flags` sections: plans 02, 03, 05, and 08 explicitly declare "None" (03 and 05 additionally re-affirm their plan threat models held). Plans 01, 04, 06, 07 contain no Threat Flags section. No unregistered flags to log.

---

## Notes

- The whitelist wiring fix in `backend/app/services/task_service.py` (sub_ctx now carries `phase_whitelist`) was discovered and shipped as part of Plan 02 — it is the mitigation that T-096-02-02's regression lock verifies. This was an auto-fixed Rule-2 deviation, not a new threat surface.
- The double-encoded jsonb discovery (DI-096-06-A) in `harness_audit.metadata` and `workflow_phases.output` was patched in the eval script's query layer (CASE normalization) without touching the shared harness write path. The underlying write-side encoding is deferred to a future phase (logged in deferred-items.md).
- `supabase/full-schema.sql` does not contain seed data rows by design (`pg_dump --schema-only`); the grep criterion `eval_coverage` in full-schema.sql is unsatisfiable by construction. The migration itself is the authoritative artifact. Documented as DI-096-01-A.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-096-01 | T-096-01-03 | Bounded single asyncio.sleep (20s) in an async task — non-blocking; only reachable via the eval seed workflow on a dev box | operator (plan approval) | 2026-06-07 |
| R-096-02 | T-096-04-03 | created_at from owner-scoped /pending (RLS-postured); worst case a mis-timed countdown — no security impact | operator (plan approval) | 2026-06-07 |
| R-096-03 | T-096-05-03 | Cursors are opaque per-user offsets into the user's own run buffers; replay re-auth happens at re-subscribe (existing auth path) | operator (plan approval) | 2026-06-07 |
| R-096-04 | T-096-07-03 | /admin/backpressure probing dev-local only by construction (localhost gate); production allow-list unchanged | operator (plan approval) | 2026-06-07 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-07 | 28 | 28 | 0 | gsd-security-auditor (claude-sonnet-4-6) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-07
