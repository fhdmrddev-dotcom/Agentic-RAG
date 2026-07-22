# Phase 168 — SSO (SAML 2.0 CORE): Security Audit (SECURITY.md)

**Audited:** 2026-07-22
**Auditor:** gsd-security-auditor (mitigation-verification mode — register authored at plan-time)
**ASVS Level:** 2
**Block policy:** `block_on: high`
**Status:** SECURED — 11/11 threats CLOSED (10 plan-time + T-168-11 metadata_url SSRF, fixed in commit `78794c08`); `threats_open: 0`. WR-01 and WR-03 remain accepted residual robustness risks (no security bearing).

Verification mode: each registered threat was confirmed by grep/read against the cited implementation file — documentation and intent were not accepted as evidence. The three code-review WARNINGs (168-REVIEW.md) were each adjudicated to a disposition.

---

## Threat Verification — Full register (11/11 CLOSED)

| Threat ID | Category | Disposition | Verdict | Evidence (file:line) |
|-----------|----------|-------------|---------|----------------------|
| T-168-01 | Spoofing/Elevation — domain routing | mitigate | CLOSED | `113_sso_configs_firming.sql:59-68` (status default `pending_approval` + 3-value CHECK + `sso_configs_email_domain_lower_unique` partial unique index); routing gated on `status='active'` at `org.py:940-941` (route) and `org.py:975` (provision); operator-only activation at `admin.py:1691-1693` |
| T-168-02 | Elevation — public domain at create | mitigate | CLOSED | `org.py:722-726` calls `sso_domain_blocklist.is_public_domain(email_domain)` and 422s BEFORE `create_provider` at `org.py:730`; also re-checked on update at `org.py:807-811`; blocklist defined `sso_domain_blocklist.py:18-56` |
| T-168-03 | Elevation — JIT role assignment | mitigate | CLOSED | `invitation_service.py:244-250` — role is the HARDCODED literal `"member"` as the `$3` bind; `provision_sso_membership` signature (`invitation_service.py:198-200`) has NO `role` parameter; `build_body` attribute-mapping allowlist is first_name/last_name only, no role/group (`sso_provider_service.py:46,134-140`) |
| T-168-04 | Info Disclosure — management token at rest | mitigate | CLOSED | `secret_cipher.py:50-59` — `supabase_management_token` is in `SECRET_COLUMNS` (swept + encrypted at boot via `sweep_row`); decrypted ONLY at call time in `sso_provider_service.get_management_token` (`sso_provider_service.py:62-94`); logs by column NAME only (`sso_provider_service.py:75-78,153-155`); never serialized to client (`_sso_config_public` omits it, `org.py:691-699`) |
| T-168-05 | Tampering — concurrent first-login race | mitigate | CLOSED | `invitation_service.py:237-251` — `pg_advisory_xact_lock(hashtext(org_id||user_id))` + `INSERT … ON CONFLICT (org_id, user_id) DO NOTHING` inside one transaction; backed by mig-104 `UNIQUE(org_id,user_id)` |
| T-168-05a | Tampering — provider-create failure | mitigate | CLOSED | `sso_provider_service.py:150-181` — `_raise_for_status` raises `SsoProviderError` on any non-2xx (and on a 2xx with no id); `org.py:728-740` writes NO `sso_configs` row when the create raises (create is FIRST, INSERT only on success) |
| T-168-06 | Info Disclosure/Tampering — cross-org access | mitigate | CLOSED | `require_sso_manage` uses STRICT `get_active_org_id` + `_has_org_permission(active_org,'sso:manage')` (`dependencies.py:772-799`); all writes/reads run on the caller user-JWT connection `get_user_pg_connection` (`org.py:742,777,813,833,876,896`) so mig-104 RLS scopes to `current_user_org_ids()`; org_id server-pinned to `request.state.active_org` (`org.py:718`); grant is org-admin-only (`113_sso_configs_firming.sql:52-54`), never widened; browser render-flag is fail-CLOSED (`useOrgPermissionsProbe.ts:29-36,102`, `api.ts:4705` `?? false`) |
| T-168-07 | Denial of Service — login path | accept | CLOSED (accepted) | `SignInForm.tsx:71` password `onSubmit(email,password)` path retained; fail-OPEN to password on ANY `getSsoRoute` error (`SignInForm.tsx:42-46`) and on redirect failure (`SignInForm.tsx:51-56`); `signInWithPassword` untouched. Logged in Accepted Risks below |
| T-168-08 | Tampering — duplicate-email conflation | mitigate | CLOSED | `invitation_service.py:245-250` — membership key is `(org_id, user_id)` UUID; no email in the key or the ON CONFLICT target; provision resolves user by `current_user["id"]` (`org.py:985`), never by email |
| T-168-09 | Tampering — delete path | mitigate | CLOSED | `org.py:886-894` — `sso_provider_service.delete_provider(provider_id)` is issued FIRST; a non-2xx raises → 502 and the row is KEPT (`org.py:890-894`); `delete_provider` (`sso_provider_service.py:213-223`) targets `<base>/<provider_id>`. (Partial-failure edge tracked as WR-01 below.) |
| T-168-10 | Info Disclosure — pre-auth /org/sso/route | mitigate | CLOSED | `org.py:919-944` — `sso_route` declares NO auth/`get_current_user`/active-org dependency (fully public, never 403s anonymous); returns strictly `{"sso": bool}` keyed on `lower(email_domain)=lower($1) AND status='active'`; no provider_id/org_id/account-existence leak; client fn is a bare pre-auth fetch (`api.ts:4779-4813`) |
| T-168-11 (was WR-02) | SSRF — metadata_url server-side fetch | mitigate | CLOSED | `org.py:674-711` (`_validate_metadata_url`, field_validator — runs at model construction, BEFORE any provider-CRUD call): requires `https` scheme (`:690-691`), rejects empty host + `localhost`/`*.localhost` (`:692-697`), and for IP literals rejects loopback/private/link-local/reserved/multicast/unspecified (`:698-710`, covers 127.0.0.1, ::1, 169.254.169.254, 10/8, 172.16/12, 192.168/16, fe80::/10, 0.0.0.0); imports `ipaddress`/`urlparse` (`org.py:22,25`); regression `test_168_metadata_url_ssrf.py` (18 cases: 3 public-https accepted incl. a public IP literal; 15 SSRF/loopback/RFC-1918/IPv6/non-https/malformed rejected). Fixed commit `78794c08` |

---

## Code-review adjudication (168-REVIEW.md WARNINGs → dispositions)

### WR-02 — metadata_url server-side-fetch SSRF (NEW threat, T-168-11) → **CLOSED** (mitigate; fixed commit `78794c08`)

**This is the one plan-time threat modeling did not anticipate; the operator explicitly asked for it. Re-audited 2026-07-22 after the fix landed.**

- **Original gap (now closed):** `SsoProviderBody._validate_metadata_url` previously validated ONLY non-emptiness, and the value flowed verbatim to `sso_provider_service.create_provider`/`update_provider` → `build_body(...)["metadata_url"]` → GoTrue's server-side fetch — no scheme/host filtering. On self-hosted (`supabase_self_hosted=True`, `config.py:772`) an authenticated tenant org-admin could aim GoTrue at internal/loopback targets (`169.254.169.254` IMDS, `127.0.0.1`, RFC-1918, `file://`) — an authenticated SSRF primitive.
- **Verified fix (`org.py:674-711`, runs at model construction BEFORE any provider-CRUD call):**
  - `parsed.scheme.lower() != "https"` → reject (`org.py:690-691`) — blocks `http://`, `file://`, `ftp://`, etc.
  - empty host → reject (`org.py:692-694`); `localhost` / `*.localhost` → reject (`org.py:695-697`).
  - IP literal → reject if `is_loopback` / `is_private` / `is_link_local` / `is_reserved` / `is_multicast` / `is_unspecified` (`org.py:698-710`) — covers `127.0.0.1`, `::1`, `169.254.169.254`, `10/8`, `172.16/12`, `192.168/16`, `fe80::/10`, `0.0.0.0`.
  - new imports `ipaddress` (`org.py:22`) + `urlparse` (`org.py:25`).
- **Regression coverage:** `backend/tests/unit/test_168_metadata_url_ssrf.py` — 18 cases (3 public-https accepted incl. a public IP literal; 15 rejected: non-https, `file://`, `127.0.0.1`, `localhost`, `sub.localhost`, `169.254.169.254`, RFC-1918 ×3, `[::1]`, `[fe80::1]`, malformed). Coordinator reports full 168 backend suite = 46 passed, 0 regressions.
- **Residual (accepted, documented in the fix comment `org.py:683-685`):** a public DNS name that later resolves to an internal IP (DNS-rebinding) is not blocked at this sync validator — a blocking DNS resolve would violate the async-no-blocking-IO rule and still could not pin GoTrue's later resolution. Proportionate: the attacker is an authenticated org-admin, the fetch is blind, and rebinding to a stable internal target through GoTrue's own resolver is a materially harder path. Acceptable residual for ASVS L2.
- **Disposition:** **CLOSED (mitigate).** The declared boundary mitigation (https + host/loopback/link-local/RFC-1918 rejection before any provider call) is now present and regression-covered.

### WR-01 — non-atomic provider↔row coupling → **accept** (tracked residual robustness risk)

- **Verified:** create is provider-first then a separate un-wrapped `INSERT` (`org.py:728-748`) with no compensating rollback; delete is provider-first then a separate `DELETE` (`org.py:886-900`). A partial failure between the two steps can orphan a GoTrue provider (create) or leave `status='active'` with no live provider → `/org/sso/route` reports `{"sso": true}` for a dead provider (delete).
- **Security assessment:** the CORE declared mitigations for T-168-09 (delete-provider-first ordering) and T-168-01 (`status='active'` routing filter) ARE present and correct; WR-01 is an edge-case non-atomicity, not an absent mitigation. Impact is availability/resource-leak (broken SSO flow, orphaned upstream provider), NOT confidentiality, integrity, or privilege escalation. Requires a transient DB error or the second-gate `UniqueViolationError` to trigger.
- **Disposition:** **accept** — residual robustness risk, below the security block bar. Recommended (non-blocking) fix: wrap the `sso_configs` write in try/except that best-effort undoes the GoTrue create and maps `UniqueViolationError` to a clean 409; on delete, treat "GoTrue gone, row remains" as recoverable (retry / mark `disabled`).

### WR-03 — silent failure on SSO-connection removal → **accept** (UX robustness, no security impact)

- **Verified:** `OrgAdminShell.handleSsoRemove` (`OrgAdminShell.tsx:285-294`) and `SsoConnectionRow.handleRemove` (`SsoTab.tsx:273-282`) both use `try/finally` with no `catch`; a `deleteSsoProvider` rejection (e.g. the 502 upstream-delete failure) becomes an unhandled promise rejection with no error surfaced to the user.
- **Security assessment:** no confidentiality/integrity/authz impact — the backend delete authz + ordering (T-168-09) are unaffected. Pure client-side error-surfacing defect (a destructive action fails silently; the header comment claims "swallows + re-fetches" but the code re-throws).
- **Disposition:** **accept** — UX robustness, no security bearing. Recommended fix: `catch` in `SsoConnectionRow.handleRemove` and render the message via the existing `text-sm text-destructive` slot.

---

## Accepted Risks Log

| ID | Risk | Disposition | Rationale |
|----|------|-------------|-----------|
| T-168-07 | Identifier-first login could lock users out if the route lookup fails | accept | Fail-OPEN to the retained password field on ANY `getSsoRoute` error and on redirect failure (`SignInForm.tsx:42-46,51-56`); `signInWithPassword`/`onSubmit` password path preserved (`SignInForm.tsx:71`). No lockout path. Enforcement (rate-limiting on the public `/org/sso/route`) deferred to ops per plan. |
| WR-01 | Partial-failure between GoTrue provider op and `sso_configs` row op (orphan provider / phantom-active route) | accept | Availability/resource-leak only; core T-168-09/T-168-01 mitigations present. Non-blocking fix recommended above. |
| WR-03 | Failed SSO-connection removal surfaces no error to the user | accept | Client-side UX only; no authz/confidentiality/integrity impact. Non-blocking fix recommended above. |

---

## Open Threats

None. `threats_open: 0` — all 11 threats (10 plan-time + T-168-11) are CLOSED.

---

## Unregistered Flags

- **T-168-11 (metadata_url SSRF)** — new attack surface surfaced by the code-review (WR-02), not present in the plan-time STRIDE register (the register delegated all SAML/metadata handling to Supabase and did not model GoTrue's server-side metadata fetch as an SSRF sink). Now registered and CLOSED (mitigate) via the boundary validator fixed in commit `78794c08`.

## Informational (168-REVIEW.md INFO items — no security-mitigation bearing)

IN-01 (dead `updateSsoProvider` export/endpoint), IN-02 (blocklist misses some EU/RU/KR consumer providers — mitigated by the operator-approval gate, the load-bearing anti-hijack control), IN-03 (latent perpetual spinner if `org:manage`/`sso:manage` diverge — currently unreachable), IN-04 (`split("@")[1]` vs `.pop()` domain extraction), IN-05 (`signInWithSSO` no-op on missing redirect url), IN-06 (`spMetadataBase` reads a private supabase-js field). None alter a registered threat's disposition; recommend addressing IN-02's blocklist gap and noting operator-approval as the primary control.

---

## Re-audit log

- **2026-07-22 (initial audit):** 10/10 plan-time threats CLOSED; T-168-11 (metadata_url SSRF, surfaced by review WR-02) OPEN — boundary scheme/host validation absent. WR-01, WR-03 accepted. Verdict: OPEN_THREATS (MEDIUM, below `high` hard-block bar).
- **2026-07-22 (re-audit after fix, commit `78794c08`):** re-read `SsoProviderBody._validate_metadata_url` (`org.py:674-711`) — https-only scheme, `localhost`/`*.localhost` rejection, and IP-literal loopback/private/link-local/reserved/multicast/unspecified rejection are present at model construction, before any provider-CRUD call; imports at `org.py:22,25`; 18-case regression `test_168_metadata_url_ssrf.py` exercises 127.0.0.1 / ::1 / 169.254.169.254 / RFC-1918 / fe80::1 / http:// / file://. T-168-11 flipped to **CLOSED (mitigate)**. Verdict: **SECURED, `threats_open: 0`**.
