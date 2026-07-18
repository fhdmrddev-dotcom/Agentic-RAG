# Phase 150 — Secrets at Rest: Security Audit (SECURITY.md)

**Phase:** 150 — secrets-at-rest (SEC-01)
**Audited:** 2026-07-13
**ASVS Level:** 1
**block_on:** high
**Register origin:** authored at plan time across 150-01..05 `<threat_model>` blocks (19 threats, deduplicated). Verification only — no new register constructed.
**Result:** SECURED — 19/19 threats CLOSED, 0 OPEN. No unregistered flags.

The audit adopted the FORCE stance: every mitigation was treated as absent until a grep/read
match proved it present at the exact seam. The load-bearing CR-01 SQL-injection fix was traced
through the ACTUAL SQL `SET`-clause build (not a helper-scoped test) per the Phase-149 false-green
lesson. Both halves of CR-01, and the WR-01 / WR-02 / D-150-07 fix commits, are present in code.

---

## Threat Verification

| Threat ID | Category | Disposition | Status | Evidence (file:line) |
|-----------|----------|-------------|--------|----------------------|
| T-150-01  | Information Disclosure | mitigate | CLOSED | Encrypt-on-write in `save_app_settings` — `backend/app/models/user_settings.py:345-350` (`get_cipher()` → `encrypt_secret` over `SECRET_COLUMNS` before the `UPDATE` at :361). Raw-read proof `backend/tests/integration/test_150_ciphertext_at_rest.py`. `Fernet(` confined to `secret_cipher.py`. |
| T-150-01b | Information Disclosure | mitigate | CLOSED | Decrypt on a shallow COPY — `user_settings.py:647` (`out = dict(row)`); the 30s cache stores the RAW ciphertext row — `user_settings.py:259` (`_settings_cache = dict(row)`). Cache never mutated. |
| T-150-02  | Information Disclosure | mitigate | CLOSED | All crypto/seam/sweep/boot logs emit column NAMES + counts + env-var NAME only: `secret_cipher.py:150-154,158-161,209-218`; `user_settings.py:306-309,314-317,654-657`; `main.py:244-247,329-332`. No value/token interpolation found. |
| T-150-02b | Information Disclosure | mitigate | CLOSED | `encryption_status` returns only `state` string + integer counters (`columns_unreadable`/`columns_plaintext`) — `secret_cipher.py:219-234`; surfaced verbatim in `admin.py:201,218`. No values/tokens/key material. |
| T-150-03  | Information Disclosure | mitigate | CLOSED | Single decrypt seam is the FIRST statement of `_build_settings_from_row` — `user_settings.py:667` (`row = _decrypt_secret_columns(row)`); all consumers read the decrypted copy. |
| T-150-03b | Information Disclosure | mitigate | CLOSED | Status read is fed the RAW ciphertext row (`_load_settings_from_db`, not `load_app_settings`) — `admin.py:197-201`; classifies by prefix + decrypt attempt but emits only pass/fail counts — `secret_cipher.py:193-234`. |
| T-150-04  | Denial of Service | mitigate | CLOSED | Undecryptable column dropped to `None` → existing `_val` DB>env fallback — `user_settings.py:653-658`. Platform stays up (no raise). `test_150_read_seam.py::test_failsoft_to_env`. |
| T-150-04a | Denial of Service | mitigate | CLOSED | Migration is Wave-1 `[BLOCKING]` (150-02, `wave: 1`) preceding the Wave-2 write seam (150-03/04, `wave: 2`); `supabase/migrations/100_secret_key_columns.sql` present + applied (10 real columns) so encrypt-on-write targets real columns. |
| T-150-05  | Tampering / Repudiation | mitigate | CLOSED | Boot key gate called UN-wrapped (NOT in try/except) — `main.py:324` (`_validate_and_report_cipher()`); malformed key re-raises `ValueError` at `Fernet(k)` — `secret_cipher.py:76`, propagated (`get_cipher()` not caught) → refuse start. |
| T-150-06  | Denial of Service | mitigate | CLOSED | `sweep_row` rotates non-primary tokens under the primary before old key drop — `secret_cipher.py:132-148`. **WR-01 fix present:** rotate wrapped in its own try/except that logs by-name + `continue`s past a poisoned column instead of aborting the pass — `secret_cipher.py:146-155`. |
| T-150-07  | Information Disclosure | mitigate | CLOSED | Migration adds `text` columns default NULL, no `DEFAULT`, no backfill/plaintext write — `100_secret_key_columns.sql:43-52`. |
| T-150-07b | Tampering | mitigate | CLOSED | `ADD COLUMN IF NOT EXISTS` on every statement — `100_secret_key_columns.sql:43-52`; re-run never errors or drops data. |
| T-150-08  | Tampering | mitigate | CLOSED | Fernet is authenticated (HMAC) → `InvalidToken` on tamper → fail-soft to env, never silent accept — `decrypt_secret` `secret_cipher.py:90-97`; read seam drops to `None` on `InvalidToken` — `user_settings.py:653-658`. |
| T-150-09  | Denial of Service | mitigate | CLOSED | Eager sweep is best-effort (try/except → log + continue) so a sweep blip never blocks startup — `main.py:326-334`; idempotent prefix check + rotate-only-when-needed — `secret_cipher.py:122-155`. |
| T-150-10  | Repudiation | mitigate | CLOSED | `update_settings` raises HTTP 500 on `save_app_settings==False` BEFORE the audit write (:471) and re-embed kick (:490) — `settings.py:468-469`. Test-mock D-150-07 regression fix (32c6366f) — `save_app_settings` returns `True` on success (`user_settings.py:324,367`). `test_150_settings_error.py` 3/3. |
| T-150-11  | Repudiation / honesty | mitigate | CLOSED | `SECRETS_DOT`: `encrypted`→`bg-success`, `plaintext`(no key)→`bg-muted-foreground/40` (NEUTRAL), `error`→`bg-destructive`, `unknown`→`bg-muted-foreground/25` (NEUTRAL) — `HealthSignals.tsx:160-164`; absent/loading → `unknown` neutral placeholder (:210). **WR-02 fix present:** empty/cold-cache row → `{"state": "unknown"}` (never false-green `encrypted`) — `secret_cipher.py:231-232`. |
| T-150-P5  | Information Disclosure | mitigate | CLOSED | Key read ONLY from `SECRETS_ENCRYPTION_KEY` env via `_load_keys` — `secret_cipher.py:61-64`; bound at `config.py:934` (`secrets_encryption_key: str = ""`); never stored in DB / never auto-generated. `.env.example:129` holds a blank placeholder (no real key). |
| T-150-SC  | Tampering (supply chain) | mitigate | CLOSED | `cryptography>=44.0.0` declared/pinned — `requirements.txt:68`; PyCA reference lib. RESEARCH §Package Legitimacy Audit = VERIFIED; no postinstall network risk (Python). |
| T-150-V4  | Elevation of Privilege (access) | accept (inherited) | CLOSED (accepted) | Router-level `require_operator` gate — `admin.py:128-132` (`dependencies=[Depends(require_operator)]`); `GET /admin/backpressure` inherits it (`admin.py:135`). Phase adds no new endpoint/auth surface — only an additive payload key. See Accepted Risks Log below. |

**Closed:** 19/19 (18 mitigate grep/read-verified + 1 accept-inherited).

---

## CR-01 (Critical SQLi) — Load-Bearing Verification

The code-review Critical (`150-REVIEW.md`) — client-controlled provider id spliced into the SQL
`SET` clause as a raw column name — is the load-bearing check for T-150-01 / T-150-08 (write-seam
integrity). Both defense-in-depth halves are present in the CURRENT served code (traced through the
actual `set_clause` build, not a helper-scoped test):

1. **API boundary (422):** `settings.py:335-336` — `if p.id not in KNOWN_PROVIDERS: raise HTTPException(422, ...)` before `updates[f"{p.id}_api_key"]` is built. `KNOWN_PROVIDERS` is populated from `_PROVIDER_BASE_URLS` (`user_settings.py:42-45`), so the allowlist is non-empty.
2. **SQL-path guard (load-bearing):** `save_app_settings` rejects any key that is not a legal lower-snake-case identifier BEFORE it can reach `clean` / the `SET` clause — `user_settings.py:305` (`if not isinstance(k, str) or not _VALID_COLUMN_NAME.match(k)`), regex `^[a-z_][a-z0-9_]*$` at `user_settings.py:69`. A crafted id containing spaces/quotes/`=`/`,` fails the regex and is skipped + logged by name. The `set_clause` at `user_settings.py:355` therefore only ever interpolates code-validated identifiers.

Fix commit c6963655 is reflected in code. The encrypt loop (`user_settings.py:346-350`) iterating
`SECRET_COLUMNS` is NOT conflated with the SQL guard (the comment at :334-337 explicitly says so).

---

## Accepted Risks Log

| Risk ID | Description | Disposition | Rationale / Control |
|---------|-------------|-------------|---------------------|
| T-150-V4 | `GET /admin/backpressure` exposure of the `secrets_encryption` state block to a caller | accept (inherited) | The endpoint is already operator/auth-gated at the router level (`require_operator`, Phase 146/147) — `backend/app/api/admin.py:128-132`. Phase 150 adds no new endpoint and no new auth surface; only an additive, value-free status field (state string + integer counts, never key material or secret values — see T-150-02b/T-150-03b). Inherited gate verified still present. No new residual risk introduced by this phase. |

---

## Unregistered Flags

None. No SUMMARY (150-01..05) declares a `## Threat Flags` section; `150-02-SUMMARY.md:91`
explicitly records "No new threat surface beyond the plan's `<threat_model>`." No new attack
surface appeared during implementation without a threat mapping.

---

## Deferred / Operational Notes (not blocking; carried by prior artifacts)

- **Cloud parity (operator-gated deploy half):** migrations 099 + 100 and the `SECRETS_ENCRYPTION_KEY`
  Coolify env var must land on cloud Supabase before Phase 150 ships live. This is a deploy-parity
  action, not a code gap — the migration file and env binding are present and correct in the repo.
- **IN-01 / IN-02 (code-review Info, non-blocking):** the `enc:v1:` prefix-collision on adversarial
  plaintext (fail-soft, no leak) and the cipher/encrypt call sitting just outside the DB try/except
  (unreachable post-boot given the fail-hard key gate) are documented informational findings, not
  declared threats in the register. No disposition required; no ship block.

---

_Audited by gsd-security-auditor. Implementation files read-only — no code modified._
