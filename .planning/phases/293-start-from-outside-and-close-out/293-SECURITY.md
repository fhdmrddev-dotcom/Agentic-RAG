---
phase: 293
slug: start-from-outside-and-close-out
status: verified
threats_open: 0
asvs_level: 1
created: 2026-10-26
---

# Phase 293 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

Verified against HEAD `afdd5e4d1`, after the review fixes (CR-01, CR-02, WR-01..WR-04) landed.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → /api-keys, /org/api-keys | signed-in member or admin; untrusted body | label, workflow ids, expiry |
| outside caller → resolve_api_key | unauthenticated network caller presenting a bearer string | API key secret (high) |
| backend → Postgres (asyncpg pool) | BYPASSRLS pool; the SQL predicate is the only owner scope | key rows, run rows |
| backend → Redis | shared limiter and link-token state across two uvicorn workers | counters, one-time file tokens |
| outside caller → /inbound/* | untrusted network caller; untrusted body text | workflow inputs (untrusted) |
| caller-supplied input text → model prompt | text that may carry instructions | prompt content (untrusted) |
| link holder → /inbound/files/{token} | anyone holding a URL for up to 300 s | run output files |
| unattended run → owner's knowledge scope | runs as the key's owner in the key's org | owner's documents |
| DB origin columns → every reader | a recorded fact rendered to owners and org colleagues | origin kind, key label, actor name |
| server → browser (create response) | the only moment a secret crosses into the browser | API key secret (high) |
| browser storage / URL / logs | persistent places a secret must never reach | none (enforced) |
| live keys → evidence files | real secrets exist during the drive | redacted 13-char prefix only |
| public docs → outside developers | the docs become the contract outside callers rely on | status codes, sentences |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-293-01 | Spoofing | resolve_api_key | mitigate | `security/api_key_auth.py:90` `token_urlsafe(32)`; `:289-303` digest lookup + `hmac.compare_digest`; `:306-314` per-call revoked/expired/member/banned re-check; `key_hash UNIQUE` (`215_…sql:55`); identical 401 pinned `test_293_key_auth.py:213` | closed |
| T-293-02 | Information disclosure | api_keys table + key reads | mitigate | column GRANT omits `key_hash` (`215_…sql:88-93`, verified live); `_KEY_COLUMNS` (`db/api_keys.py:38-47`); `secret` only on `ApiKeyCreated` (`models/api_key.py:92-94`); recursive scans `test_293_api_keys_routes.py:365,474,495`; mirrored `full-schema-supplement.sql:856-862` | closed |
| T-293-03 | Tampering | workflow_runs.origin_* | mitigate | immutability trigger `215_…sql:134-161`; EXECUTE revoked from PUBLIC/anon/authenticated `:165-168` (verified live) | closed |
| T-293-04 | Elevation of privilege | POST /api-keys | mitigate | `require_capability("workflows")` `api/api_keys.py:250`; unreadable/unpublished refused with one sentence `:263-292`; org-matched predicate `db/api_keys.py:252-254`; test `test_293_api_keys_routes.py:312` | closed |
| T-293-05 | Elevation of privilege | /org/api-keys | mitigate | `Depends(require_org_manage)` `api/api_keys.py:357,372`; member revoke scoped id+org+user `db/api_keys.py:174-175` | closed |
| T-293-06 | Denial of service | limiter | mitigate | Redis MULTI/EXEC INCR+EXPIRE `services/rate_limit.py:41-44`; Redis failure → 503 `:58-62`; no in-process admit path (CR-02 fallback only throttles audit rows) | closed |
| T-293-07 | Repudiation | key create/revoke/refusals | mitigate | audit writes `api/api_keys.py:317,342,384`, `api_key_auth.py:267-276`; `_audit_args` id/label/user/org only `:122-149`; literals `audit_service.py:36` | closed |
| T-293-08 | Information disclosure | logs | mitigate | 12-char fingerprint only `api_key_auth.py:297-300`; no header-logging middleware; test `test_293_key_auth.py:292` | closed |
| T-293-09 | Repudiation | unknown-key 401s | accept | see AR-01 | closed |
| T-293-10 | Denial of service | boot after deploy | mitigate | 215 live locally (`check-migration-215-live.py`); header `215_…sql:41-43` orders cloud apply before backend deploy | closed |
| T-293-SC | Tampering | package installs | accept | see AR-02 | closed |
| T-293-11 | Information disclosure | /inbound existence oracle | mitigate | single `_not_found()` `inbound.py:195-196`; byte-equality tests `test_293_inbound_start.py:135`, `test_293_inbound_status.py:88` | closed |
| T-293-12 | Elevation of privilege | cross-org start | mitigate | org stamp `unattended_launch.py:165-170`; `_SCOPE_SQL` `inbound.py:151-154,291`; owner re-check + published `:295-308` | closed |
| T-293-13 | Tampering | inputs override caps/folder/kickoff | mitigate | `inbound_inputs.py:114-168` declared-only, `_`/RESERVED refused; `extra="forbid"` `inbound.py:106`; caps + kickoff server-set `:356-362` | closed |
| T-293-14 | Elevation of privilege | prompt injection via inputs | mitigate | `model=None` `unattended_launch.py:182`; envelope `harness/phase_types.py:1023-1031`, `inbound_inputs.py:218-231`; WR-03 `programmatic.py:100-102`; flag excluded `phase_types.py:2119`; no pause-answer route | closed |
| T-293-15 | Information disclosure | run read by another key | mitigate | `origin_kind='key' AND origin_ref AND user_id` `inbound.py:157-165` on status + file paths; test `test_293_inbound_status.py:98` | closed |
| T-293-16 | Information disclosure | file link leak | mitigate | 300 s token `inbound.py:83,458-461`; GET+DEL in one MULTI `:597-600`; key/member/ban/origin/file-in-thread re-check `:609-649` | closed |
| T-293-17 | Denial of service | start flood / runaway spend | mitigate | `_limit` first `inbound.py:271,483`; default caps `:80-81` armed before drive `unattended_launch.py:206-237`; CR-01 kill switch `inbound.py:277`, `unattended_launch.py:147`, `scheduler_service.py:100` | closed |
| T-293-18 | Repudiation | inbound calls | mitigate | audit rows `inbound.py:376,559,663,206-225` with key id + label + run id; CR-02 coalesces repeated refusals per key/reason/minute with `detail.suppressed` | closed |
| T-293-19 | Spoofing | waiting_on wording | mitigate | `waiting_who(is_owner=False)` `inbound.py:536-538`, `run_read_words.py:36-49`; test `test_293_inbound_status.py:158` | closed |
| T-293-20 | Tampering | moved fences | mitigate | "Phase 293" reason paragraph in each of the three retargeted tests; base-vs-post 170/170 in 293-02 SUMMARY; all pass now | closed |
| T-293-21 | Information disclosure | ApiKeysTab / ApiKeySecretOnce | mitigate | secret only in `ApiKeysTab.tsx:69,122,137` state; `lib/api/apiKeys.ts:14` no cache; storage/href/unmount checks `ApiKeysTab.test.tsx:51-67,241,254` | closed |
| T-293-22 | Information disclosure | apiKeyPrepick | mitigate | two fields `apiKeyPrepick.ts:22`; read-once `:29-45`; planted-secret test `apiKeyPrepick.test.ts:47` | closed |
| T-293-23 | Elevation of privilege | OrgApiKeysTab | accept | see AR-03 | closed |
| T-293-24 | Spoofing | revoke sheet victim naming | mitigate | re-fetch, never optimistic `RevokeApiKeySheet.tsx:69-70`, `ApiKeysTab.tsx:244`, `OrgApiKeysTab.tsx:127-129`; owner naming test `RevokeApiKeySheet.test.tsx:95` | closed |
| T-293-25 | Tampering | curl example correctness | mitigate | `curlExamples.ts:15-49`; contract test `apiKeysContract.test.ts:74-84` vs `api_keys_contract.json` | closed |
| T-293-26 | Tampering | origin columns | mitigate | 215 trigger live; only writer is `create_workflow_run` `db/workflows.py:539` | closed |
| T-293-27 | Spoofing | origin sentence | mitigate | unknown kind → nothing `run_read_wire.py:148`, `runOriginVocabulary.ts:18-32`, `RunOriginLine.tsx:19-20`; single-origin rule `threads.py:408-423` | closed |
| T-293-28 | Information disclosure | key label on evidence report | accept | see AR-04 | closed |
| T-293-29 | Information disclosure | actor name | mitigate | app origins only `run_read_wire.py:153`; chat uses caller's own profile `threads.py:414-422` | closed |
| T-293-30 | Tampering | limit settings | mitigate | `_range_refusal_detail` `settings.py:832-868`, allow-list `:53-55`; DB CHECK `215_…sql:203-212` (live); PUT gated `require_visible("model_management")` `settings.py:644-647` | closed |
| T-293-31 | Information disclosure | drive script + evidence | mitigate | env-only keys `drive-293-inbound.py:587`; 13-char redaction `:64-67`; `git grep -E 'srl_live_[A-Za-z0-9_-]{20,}' HEAD` finds only dummy fixtures; evidence holds no `srl_live_` | closed |
| T-293-32 | Information disclosure | public docs | mitigate | docs say "one-way digest" only; no hash format, Redis key, internal table or real id | closed |
| T-293-33 | Tampering | production DB | mitigate | no Supabase MCP write; cloud 215 + `get_advisors(security)` owed in 293-05 SUMMARY, VALIDATION, VERIFICATION, migration header, ROADMAP flags | closed |
| T-293-34 | Repudiation | seed register | mitigate | `--require-settled` (`check-seeds-register.cjs:693,956`) "all 13 settled"; 9 edited seed bodies identical at base `5724f4227` and HEAD | closed |
| T-293-35 | Spoofing | two-org drive | mitigate | `X-Org-Id` `drive-293-inbound.py:87`; org proven from DB (VALIDATION line 25); control row precedes cross-org 404s (`evidence/drive-results-sc2.json`) | closed |
| T-293-36 | Information disclosure | key lists (293-05 D-4) | accept | see AR-05 | closed |
| T-293-37 | Denial of service | /inbound per-IP limit behind proxy | accept | see AR-06 | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

T-293-36 and T-293-37 were not in any plan's register. The 2026-10-26 audit surfaced them, and the operator accepted both the same day.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-293-09 | An unknown key has no user to attribute, and `audit_log.user_id` is NOT NULL, so unknown-key 401s are logged, not audited. Since CR-02, the per-address limit bounds them (`inbound.py:228-230`). | plan 293-01; re-verified by audit | 2026-10-26 |
| AR-02 | T-293-SC | No npm or PyPI package was added. The phase uses stdlib `secrets`/`hashlib`/`hmac` and the already-installed redis-py. No manifest or lockfile changed between `5724f4227` and HEAD. | plan 293-01; re-verified by audit | 2026-10-26 |
| AR-03 | T-293-23 | The UI hides the org tab from non-admins, but that is only convenience. The server enforces access with `require_org_manage` (`dependencies.py:1072-1089`), and a forged call gets 403 (test `test_293_api_keys_routes.py:455`). | plan 293-04; re-verified by audit | 2026-10-26 |
| AR-04 | T-293-28 | A key label is not a secret. The origin carries only kind, label and actor (`run_read_wire.py:150-154`), never the secret or prefix. | plan 293-03; re-verified by audit | 2026-10-26 |
| AR-05 | T-293-36 | The two key-list queries fall back to `auth.users.email` for owner and revoker names (`db/api_keys.py:94-109`). Org admins see member emails, and a member sees the email of the admin who revoked their key. This is the same exposure the org members roster already has. | operator | 2026-10-26 |
| AR-06 | T-293-37 | `enforce_ip_limit` keys on `request.client.host`. Behind the onebox nginx or Coolify's Traefik, every caller shares the proxy's address, so the 1,200/min limit acts as one shared ceiling, and a keyless flood can block `/inbound` for up to a minute. Per-key limits are unaffected. The app has no proxy-aware client-IP derivation anywhere (`api/setup.py` is the same). Re-open trigger: a proxy-aware client-IP helper is added to the app, or `/inbound` gets real outside traffic. | operator | 2026-10-26 |

*Accepted risks do not resurface in future audit runs.*

---

## Informational (no threat entry)

- **WR-01 link base from forwarded headers.** When `BACKEND_PUBLIC_URL` is a loopback address, the file-link base comes from format-checked forwarded headers. This affects only the caller's own response. The guidance is to set `BACKEND_PUBLIC_URL`.
- **IN-01 file link burned by a 429** (under T-293-16). The token is consumed before the limiter runs, so a rate-limited request burns the link. The next status read returns a fresh one. Deferred in 293-REVIEW.
- **Deploy parity owed** (T-293-33): apply migration 215 in cloud before the backend deploys, then run `get_advisors(security)`. STATE.md does not yet carry this item; add it at phase close.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-26 | 38 | 38 | 0 | gsd-security-auditor (opus), against HEAD `afdd5e4d1` |

Evidence the auditor ran:
- **Backend:** `pytest tests/unit -k 293` passed, 279 tests. It excluded `test_293_review_key_calls.py`, which writes a throwaway schema to the shared local DB. The three retargeted fence suites passed, 59 tests.
- **Frontend:** the vitest suites for apiKeys, RunOriginLine, runOriginVocabulary and ApiKeyLimits passed: 11 files, 113 tests, with `GSD_VITEST_MAX_WORKERS=2`.
- **Migration 215, local DB:** a SELECT-only catalog check confirmed the column grants, no anon access, the revoked trigger EXECUTE, the owner-SELECT-only RLS policy, both triggers and the CHECK range 1..60.
- **Seeds and secrets:** the seeds register is OK 381/381, and the HEAD secret scan is clean.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-26
