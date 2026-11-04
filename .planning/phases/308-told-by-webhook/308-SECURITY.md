---
phase: 308
slug: told-by-webhook
status: verified
threats_open: 0
asvs_level: 1
created: 2026-11-04
register_authored_at_plan_time: true
---

# Phase 308 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register source: the `<threat_model>` blocks of 308-01..06-PLAN.md (44 rows, 25 unique ids) plus the
> one SUMMARY threat flag (308-02, httpx log disclosure). Verified by `gsd-security-auditor` (opus)
> on 2026-11-04 — mitigations checked to file:line and the test that proves each; no new-threat scan.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Member browser → `/webhooks` API | A member saves, edits, tests, rolls and deletes their own endpoints | receiver URL (may hold a token in path/query/host), signing secret once at create/roll |
| Org admin → `/org/webhooks` API | An admin lists, turns off/on and deletes members' endpoints | host + masked path + has_query only — never the URL or a secret |
| Postgres triggers → outbox | `run.finished` / `run.waiting` / `document.ingested` emitted by SECURITY DEFINER functions | ids, status, links — no content |
| Drainer → the public internet | Signed POST to a receiver via pinned egress (SSRF-checked at save AND at send) | text-free typed payload, Standard Webhooks v1 HMAC headers; response body discarded |
| Client roles (`anon` / `authenticated`) → webhook tables | Must be refused entirely | endpoint rows, ciphertext, deliveries |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation (evidence) | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-308-01 | Tampering / Info disclosure | SSRF at save | mitigate | `api/webhooks.py:137-154` `check_webhook_url` + `run_in_threadpool(egress.validate_destination, "webhook", …)` on create and PATCH; one sentence, no reason/IP. `test_308_ssrf_corpus` (≥ 18 cases), `test_308_routes::test_create_refuses_an_internal_address_without_naming_why`. UAT row 4 drove it live. | closed |
| T-308-02 | Tampering | DNS rebinding save→send | mitigate | `egress.py:778-786` re-resolve + pin on every send, SNI restored `:824`. `test_a_dns_flip_between_save_and_send_is_refused_at_send` | closed |
| T-308-03 | Tampering | 302 to an internal host | mitigate | `egress.py:807,830,833-846` no redirects → `redirected`; `webhook_sender.py:161,168-169` classified `redirect`, not retried. `test_a_302_is_a_redirect_not_retried` | closed |
| T-308-04 | Info disclosure | userinfo / Basic auth | mitigate | `webhook_urls.py:65-66` at create/PATCH, re-checked before send `webhook_sender.py:211-217`, DB CHECK `225:67`. `test_a_url_failing_the_rules_never_reaches_egress` | closed |
| T-308-05 | Spoofing | forged / replayed delivery | mitigate | `webhook_signer.py:36-60` v1 HMAC-SHA256, `msg_<event id>`, per-attempt timestamp (`webhook_drainer.py:428-438`). `test_308_signer_interop` (reference library); UAT row 1 verified a real capture + tamper refusal. | closed |
| T-308-06 | Info disclosure | secret at rest / API / browser | mitigate | CHECK `enc:v1:%` `225:73-74`; `_ENDPOINT_COLUMNS` carries no ciphertext (`db/webhooks.py:40-52`); read models have no secret; 503 before minting without a cipher; browser holds it in a prop only. `test_create_shows_the_secret_once_and_stores_only_ciphertext`, `WebhookSecretOnce.test`. Note: outbox CLAIM/RENEW SQL also project ciphertext — server-internal signing paths only. | closed |
| T-308-07 | Elevation | old secret lives forever | mitigate | previous secret used only while unexpired (`webhook_drainer.py:459`, `api/webhooks.py:402`); hourly erase `webhook_outbox.py:266-271`. live `test_a_rolled_secret_signs_twice_in_its_overlap_and_once_after_and_is_erased` | closed |
| T-308-08 | Info disclosure | cross-org / private item via an event | mitigate | org-scoped candidates, owner-only run events (`webhook_outbox.py:80-89,310-316`); visibility at fan-out and send (`webhook_drainer.py:305-340,406-409`). live `test_308_visibility_live` (5 cases) | closed |
| T-308-09 | Elevation | ex-member keeps receiving | mitigate | `principal_still_allowed(kind="webhook")` at fan-out and send (`webhook_drainer.py:135-141,312-317,401-405`). live `test_an_owner_removed_*`. Residual R-308-01 below. | closed |
| T-308-10 | Info disclosure | anon / another member reads tables | mitigate | RLS on, REVOKE PUBLIC/anon/authenticated/service_role, GRANT service_role, no policy (`225:98-211`). live `test_anon_select_on_webhook_endpoints_is_refused`. Cloud `get_advisors(security)` after the paste is a deploy precondition (D-33). | closed (local) |
| T-308-11 | Elevation | definer functions callable by clients | mitigate | `225:313-320` revoke PUBLIC first. live `test_no_client_role_may_execute_an_emit_function` | closed |
| T-308-12 | Denial of service | trigger error breaks a writer | mitigate | `EXCEPTION WHEN OTHERS THEN RAISE WARNING` `225:225-256,276-292`. live `test_a_planted_trigger_failure_is_swallowed_and_warned` | closed |
| T-308-13 | Info disclosure | body / response / headers / URL stored or logged | mitigate | no body columns (`225:148-198`); `SendOutcome` has no body (`webhook_sender.py:80-88`); `test_308_no_body_scan` (SQL + DDL + logger AST). Also closes the 308-02 log-disclosure flag: `main.py:37` pins httpx at WARNING, driven under the INFO file sink with a non-vacuous control. | closed |
| T-308-14 | Info disclosure | payload content / PII | mitigate | typed frozen text-free models (`models/webhook.py:36-96`); `outbound_guard(textless_ok=True)`, fail closed → `redaction_failed`. `test_switch_on_with_textless_ok_gives_byte_identical_bytes` | closed |
| T-308-15 | Info disclosure | receiver token shown to admins / on screen | mitigate | **Closed by the CR-01 fix (D-59):** `webhook_urls.py:101-126` `admin_display` hides every path and the query, masks token-looking host labels; `OrgWebhookRead` has no `url`. `test_cr01_a_real_zapier_catch_hook_never_reaches_the_admin`; UAT row 5 confirmed the token absent from the admin page's whole HTML. | closed |
| T-308-16 | Denial of service | Test / Resend hammering a third party | mitigate | `rate_limit.py:241-267` 5 tests / 20 resends per member-minute, fail closed 503; cap 10 endpoints under an advisory lock. `test_the_sixth_test_in_a_minute_is_refused`. Residual R-308-02 below. | closed |
| T-308-17 | Tampering | duplicate events / deliveries / sends | mitigate | partial UNIQUE + UNIQUE (endpoint_id, event_id) (`225:132,164`); SKIP LOCKED with in-transaction flip. live `test_two_drainers_send_one_event_exactly_once`; UAT row 2 = exactly one each. | closed |
| T-308-18 | Info disclosure | notice / audit leaks a query or secret | mitigate | notice title `split_part(…,'?',1)` (`db/notifications.py:234`); audit metadata exactly `{actor, endpoint_id, host}`. `test_audit_metadata_never_carries_the_query_or_path` | closed |
| T-308-19 | Denial of service | event storm / dead receiver | mitigate | EXISTS gate (`225:242-285`); 20 claims/tick, 2 per endpoint, 6-attempt cap, auto-disable at 5, bounded hourly purge. live `test_five_failures_turn_the_endpoint_off_with_one_notice`; UAT row 3 drove it live. | closed |
| T-308-20 | Elevation | cross-member action / re-enabling an admin-off endpoint | mitigate | owner predicate in every member statement; `require_org_manage` on all 4 org routes; owner re-enable of admin-off → 403. `test_owner_cannot_turn_on_an_admin_off_endpoint`; UAT row 5 saw Turn on disabled. | closed |
| T-308-21 | Repudiation | admin action unrecorded | mitigate | one audit row per confirmed write, `actor:"admin"`, explicit org_id; 9 labels in both audit tabs. `test_admin_turn_off_sets_reason_admin_and_audits_once`. Residual R-308-03 below. | closed |
| T-308-22 | Tampering / XSS | markup from owner names / addresses | mitigate | no `href={`, `dangerouslySetInnerHTML` or `innerHTML` in the webhooks folder or `OrgWebhooks.tsx` (grep); `OrgWebhooks.test:244` | closed |
| T-308-23 | Spoofing (UX) | refusal leaking internals | mitigate | one server sentence, no code/IP (`api/webhooks.py:141-153`); `WebhookEndpointForm.test` | closed |
| T-308-24 | Info disclosure | Waiting door switches org / leaks another org's endpoint | mitigate | door writes the hint and navigates only (`ChatLayout.tsx:611-615`); `switchOrg` only on the user's click; notice list recipient + membership scoped. `webhookWaitingRow.test` "never switches org" | closed |
| T-308-SC | Data loss / Tampering (supply chain) | migration 225 apply; `standardwebhooks` | mitigate | Local: applied twice idempotently, regen without `--reset`, `check-migration-225-live.py` reports live. Dependency pinned `standardwebhooks==1.1.0` in `requirements-dev.txt` only (runtime image installs `requirements.txt`). Cloud paste 220→225 is a deploy precondition. Human ratification of the package: see R-308-05. | closed (local) |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

Non-blocking residuals the auditor found next to closed mitigations. None breaks a declared mitigation.
Accepted by the orchestrator under the operator's standing end-to-end delegation; R-308-01/02/03/05 **ratified by the operator in chat on 2026-11-04**. R-308-04 was fixed instead.

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-308-01 | T-308-09 | `principal_still_allowed` inherits `_is_banned`'s fail-open read: if the `auth.users` read fails, a banned owner keeps receiving. Membership still fails closed. Review IN-03, skipped as larger than a safe edit; already routed to a 309 seed. | orchestrator (delegated); **ratified by operator** | 2026-11-04 |
| R-308-02 | T-308-16 | Send test works as a rate-limited port probe of PUBLIC hosts (any port; answer shows connect/tls/timeout + latency). Internal addresses stay blocked. Unregistered surface, WARNING level. Follow-up: restrict ports or flatten the error words. | orchestrator (delegated); **ratified by operator** | 2026-11-04 |
| R-308-03 | T-308-21 | A Test that sent nothing (redaction failure / unreadable key) still writes an attempt row and a `test_sent` audit (review IN-02). Accuracy, not a leak. | orchestrator (delegated); **ratified by operator** | 2026-11-04 |
| R-308-04 | T-308-15 / T-308-13 | **FIXED 2026-11-04** — both sender log lines now name `webhook_urls.display_host(url)`, so a Pipedream/ngrok-style token label is masked to `…`; egress still pins to the real host. Test `test_308_sender::test_r308_04_logs_mask_a_token_looking_host_label` (RED before, GREEN after). Pre-CR-01 audit rows with unmasked hosts remain in the LOCAL DB only (308 not deployed). | fixed — no ratification needed | 2026-11-04 |
| R-308-05 | T-308-SC | The plan said the `standardwebhooks` human verify would "never be auto-approved"; it was resolved by the orchestrator under delegation (`STATE.md:132`) on the evidence in `308-standardwebhooks-evidence.md`. Dev/test-only dependency. | orchestrator (delegated); **ratified by operator** | 2026-11-04 |

*Accepted risks do not resurface in future audit runs.*

### Deploy preconditions (deferred, not gaps)

- ✅ **DONE 2026-11-04:** migrations 220→221→222→223→224→225 applied to production via the Supabase MCP, each under its own operator approval in chat; every migration's VERIFY block read PASS (220 8/8, 221 8/8, 222 8/8, 223 7/7, 224 8/8, 225 PASS). Pre-flights: prod rows satisfied every new CHECK; 225 keeps all 40 live audit literals. No Postgres crash/recovery line in the 24 h log after 221 (BUG-261031-01 watch).
- ✅ **DONE 2026-11-04:** `get_advisors(security)` on production — no ERROR. New entries are INFO `rls_enabled_no_policy` on the six new deny-all tables (intended: mcp_usage, oauth_clients, oauth_tokens, webhook_endpoints/events/deliveries/delivery_attempts). Every WARN (mutable search_path ×7, vector in public, 9 authenticated-callable SECURITY DEFINER helpers, leaked-password protection off) predates 220–225.
- Still owed for the 308 deploy itself: the operator's deploy instruction (304–308 code is not on `production`).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-04 | 25 (+1 SUMMARY flag, mapped to T-308-13) | 25 | 0 | gsd-security-auditor (opus); unit `-k 308` 516 passed, webhooks vitest 111 + 10 passed; live suites 154 passed in UAT row 6 |
| 2026-11-04 | R-308-04 fix | — | 0 | orchestrator; unit `-k 308` 517 passed |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-04 — R-308-04 fixed; R-308-01/02/03/05 ratified by the operator 2026-11-04
