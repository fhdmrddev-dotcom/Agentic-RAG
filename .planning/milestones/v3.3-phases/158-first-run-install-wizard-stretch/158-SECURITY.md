# 158-SECURITY.md — First-Run Install Wizard (STRETCH)

**Phase:** 158 — First-Run Install Wizard (DEPLOY-02, STRETCH)
**Audit date:** 2026-07-17
**Auditor:** gsd-security-auditor (FORCE stance — every mitigation assumed absent until proven in code)
**ASVS Level:** 2 (inferred — no explicit `<config>` block supplied; this is a pre-auth surface that writes secrets, runs SQL, and mints the first operator, so V1/V2/V4/V6/V7 L2 controls apply per 158-RESEARCH "Security Domain")
**Verdict:** **SECURED**

```
threats_open: 0
```

**Threats Closed:** 11 / 11 canonical (T-158-01 .. T-158-11) + 6 / 6 auxiliary sub-threats
**Unregistered flags:** none
**CRITICAL / HIGH findings:** none

---

## Method

Each threat was verified by its declared disposition. For every `mitigate` threat I grepped/read the
cited file for the actual mitigation call — no threat marked CLOSED on documentation or structure alone.
The pre-auth wall (T-158-01) was verified by an **independent route-decorator enumeration**, not by
trusting the executor's self-report. Beyond static proof, all **60 backend setup contract tests pass**
(`test_setup_{token,gate,finalize,idempotent,probe,operator,provider,status,smoke,detect,boot_tolerant,overlay}.py`
→ 41 + 19 green), which empirically exercise 401/409/429, constant-time compare, sanitized probes,
encrypt-on-write, the dual finalize marker, and the byte-identical no-op.

Read-only contract honored: **no implementation file was modified.** Only this SECURITY.md was written.

---

## Independent CRITICAL proof — no un-gated write (T-158-01)

The executor self-reported "UN-TOKENED WRITE HOLES: NONE". Verified independently by enumerating every
route decorator in `backend/app/api/setup.py`:

| Route | Method | Gate |
|-------|--------|------|
| `/setup/status` | GET | open (read-only status booleans — no secret, no write) |
| `/public-config` | GET | open (read-only, exactly 2 public values) |
| `/setup/detect` | POST | `Depends(require_setup_token)` ✓ |
| `/setup/validate` | POST | `Depends(require_setup_token)` ✓ |
| `/setup/schema-bootstrap` | POST | `Depends(require_setup_token)` ✓ |
| `/setup/operator` | POST | `Depends(require_setup_token)` ✓ |
| `/setup/provider-key` | POST | `Depends(require_setup_token)` ✓ |
| `/setup/smoke` | POST | `Depends(require_setup_token)` ✓ |
| `/setup/finalize` | POST | `Depends(require_setup_token)` ✓ |

**7 write routes / 7 gated. 0 PUT/PATCH/DELETE. The two open routes are read-only and leak no secret.**
`require_setup_token` (setup.py:112-137) enforces the load-bearing order: **409 finalize-latch → 429
rate-limit → 401 constant-time token**. This is the sole access control (no RLS backstop, v3.3 red line)
and it is present on every write. CONFIRMED accurate.

---

## Threat Verification — canonical register (T-158-01 .. T-158-11)

| Threat ID | Category | Disp. | Verdict | Evidence (file:line) |
|-----------|----------|-------|---------|----------------------|
| T-158-01 | Spoofing / Elevation — first-run hijack | mitigate | **CLOSED** | `api/setup.py:112-137` require_setup_token on all 7 writes (`:238,244,258,292,315,328,352`); token = `secrets.token_urlsafe(32)` (256-bit) `services/setup_store.py:127`; announced once to stdout `setup_store.py:133-143` + `main.py:311`; frontend attaches `X-Setup-Token`, never `getAuthHeaders` (`lib/setupApi.ts` — 3 hits / 0 hits) |
| T-158-02 | Tampering — config write after finalize | mitigate | **CLOSED** | `require_setup_token` asserts `setup_finalized()` → 409 FIRST `api/setup.py:123-126`; finalize re-runs smoke server-side and 409s unless `all_green` (client can't force) `api/setup.py:387-396`; sticky file-marker latch `setup_store.py:101-114`; post-finalize `/setup` renders `FinalizedLockout` (no config field) |
| T-158-03 | Info Disclosure / SSRF — submitted-value probes | mitigate | **CLOSED** | Every probe returns only `type(exc).__name__` `services/setup_service.py:76,84,104,122,344,356,361`; THROWAWAY conns (`asyncpg.connect`/`from_url`/`create_client`), never the singletons (`grep get_pg_pool\|get_redis` = 0); bounded 3s timeout `:48,73,100,118`; provider-key probe reuses the allowlisted `discover_all` (no client URL reaches the HTTP client) `:328-348` |
| T-158-04 | Info Disclosure — secret leakage | mitigate | **CLOSED** | `/public-config` returns EXACTLY `{supabase_url, supabase_anon_key}` `api/setup.py:160-173`; provider key persists only via `save_app_settings` `setup_service.py:298-318` and `{provider}_api_key` + `embedding_api_key` are in `SECRET_COLUMNS` (encrypt-on-write) `security/secret_cipher.py:47-51`; `/setup/status` returns `has_token` as a **bool**, never the token `setup_service.py:179`; frontend consumes only the 2 public values `lib/supabase.ts:58-66` |
| T-158-05 | DoS — DB blip bounces live users into wizard | mitigate | **CLOSED** | `setup_finalized()` reads only the FILE marker + sticky latch, never the DB `setup_store.py:101-114`; middleware `_is_finalized()` file-only `middleware/setup.py:42-57` (`grep setup_complete\|load_app_settings` in gate = 0); `main.py:304` `_setup_mode` derived from the file marker, never a DB read; `getSetupStatus` fail-safes to `needs_setup:false` on any error |
| T-158-06 | Spoofing — weak/duplicate operator creds | mitigate | **CLOSED** | `admin.create_user({..."email_confirm":True})` via `run_in_threadpool` `setup_service.py:265-271`; duplicate email → `{already_exists:true}` (no 500) `:273-276`; weak password re-raised verbatim → router maps to **400** `api/setup.py:311-312`; `operator_users` upsert `ON CONFLICT (user_id) DO NOTHING` `setup_service.py:283-287`; password policy delegated to GoTrue |
| T-158-07 | DoS — boot crash-loop hides the token | mitigate | **CLOSED** | `_setup_mode` guards the sole un-wrapped DB hard-fail `main.py:380-382` (`assert_action_types_synced`) + all 4 reconciler spawns `:405,429,452,485`; token announced in setup mode `:311`, announce itself best-effort-wrapped so a store blip can't crash boot `:310-313` |
| T-158-08 | Elevation — token brute-force | mitigate | **CLOSED** | `hmac.compare_digest` constant-time verify `setup_store.py:146-154`; empty token rejected without compare `:152-153`; in-process failed-attempt sliding window → 429 on 20 failures/60s, cleared on success `api/setup.py:91-137`; atop the 256-bit token |
| T-158-09 | Info Disclosure — `/data/setup.json` at rest | mitigate | **CLOSED** | `write_store` = tmp in same dir → `os.chmod(tmp,0o600)` BEFORE `os.replace` (atomic, never briefly world-readable, never partial) `setup_store.py:72-93`; temp-file cleanup on failure `:88-92`; store secrets/token logged ONLY in `announce_token_if_unfinalized` `:133-143` (single boot line) |
| T-158-10 | Info Disclosure / XSS — masked UI + no HTML sink | mitigate | **CLOSED** | `grep dangerouslySetInnerHTML` across `components/setup/*.tsx` + `pages/SetupWizard.tsx` = **0**; masked inputs (`type=password` + Eye/EyeOff) in all 4 secret-bearing components — ConnectionBindStep (4 keys + DSN + Redis), OperatorBootstrapStep (password/confirm), ProviderKeyStep (provider key), SetupTokenGate (token → last-4) |
| T-158-11 | Tampering / Elevation — client-side branch | mitigate | **CLOSED** | The `App.tsx` pre-auth branch is UX-only; the real wall is `SetupMiddleware` + `require_setup_token` (both verified above) — a forged client state that renders the wizard cannot write config without the token, and post-finalize the server 409s every write; finalized `/setup` renders the no-re-entry `FinalizedLockout` (SC#2) |

## Threat Verification — auxiliary sub-threats (appear in per-plan `<threat_model>` blocks)

| Threat ID | Component | Disp. | Verdict | Evidence |
|-----------|-----------|-------|---------|----------|
| T-158-07-schema | auto-runner DDL | mitigate | **CLOSED** | `run_schema_bootstrap` is schema-absent-gated by the caller + `async with conn.transaction()` all-or-nothing wrap + `SchemaBootstrapPrivilegeError` → guide fallback `setup_service.py:427-471`; router only calls it when `schema_present` is false `api/setup.py:258-289` |
| T-158-mig | migration 102 apply | mitigate | **CLOSED (deferred apply)** | `102_setup_complete.sql` uses `ADD COLUMN IF NOT EXISTS` (idempotent) + `('global') ON CONFLICT DO NOTHING`; live apply is operator-gated (158-12). See Operational Notes. |
| T-158-09 (volume) | `setup_data:/data` compose volume | mitigate | **CLOSED** | `docker-compose.prod.yml` mounts `setup_data:/data` (0600 store home); the app writes 0600 (T-158-09); never enters the image or logs |
| T-158-whitescreen | placeholder `VITE_*` | mitigate | **CLOSED** | `lib/supabase.ts` defensive `createClient` (`export let supabase`, placeholder-safe `safeUrl`) — the SPA + `/setup` mount even with placeholder creds so the wizard is always reachable |
| T-158-drift | 157-artifact drift | mitigate | **CLOSED** | `scripts/check-deploy-drift.sh` (4 checks + `OMITTED_FROM_ONEBOX` allowlist) + CI job + CLAUDE.md same-commit rule |
| T-158-SC | pip / npm installs | accept | **CLOSED (accepted)** | Zero new packages across all 12 plans (stdlib `secrets/hmac/json/tempfile` + already-vendored asyncpg/redis/supabase/fastapi/@supabase-js). Documented in every plan `<threat_model>`; matches 158-RESEARCH Package Legitimacy Audit ("none proposed"). |

---

## Unregistered Flags

**None.** All 11 execution summaries were swept for `## Threat Flags` / new attack surface:
- 158-09-SUMMARY and 158-11-SUMMARY carry explicit `## Threat Flags: None` sections, each mapping their
  change back to an existing threat ID (T-158-10 masked UI / T-158-03 sanitized reason / T-158-11 UX branch).
- 158-02/04/06 explicitly state "no new threat flags" / "no new security surface beyond the threat model".
- No new endpoint, auth path, file-access, or schema surface appeared during implementation that lacks a
  threat mapping. Every new route is one of the 9 enumerated above; every new secret path funnels through
  the Phase-150 `save_app_settings` seam.

---

## Observations (non-blocking — do not open any declared threat)

1. **Finalize DB-flag write is best-effort, not a hard 500** (`api/setup.py:401-421`, documented deviation
   in 158-06-SUMMARY). The file marker (`store_finalize`) is written unconditionally after the server-side
   smoke gate passes and IS the gate authority (D-05); the auditable `app_settings.setup_complete` DB flag
   is written best-effort and reported honestly as `setup_complete_persisted`. This is **more** correct than
   the plan's literal "file-first then hard-500": under restart-to-apply the app pool is still on placeholder
   config, so a hard 500 would falsely fail finalize AND be unrecoverable (the marker now 409s a retry).
   `setup_complete()` reads default-False-safe. Does not weaken T-158-02 or T-158-05.

2. **Rate-limit is per-process / in-memory** (`api/setup.py:91-105`). Under `WORKER_COUNT=2` each worker
   throttles independently (~40 failed attempts/min effective). This is explicitly defense-in-depth atop the
   256-bit token + constant-time compare — the primary control. Against a 256-bit token, brute-force remains
   infeasible regardless. Note: behind nginx, `request.client.host` may collapse to the proxy IP, which makes
   the bucket **stricter** (all callers share it), not weaker — a fail-safe direction. Matches the declared
   T-158-08 mitigation ("rate-limited atop the 256-bit token"). Not a gap.

3. **Provider-key encryption is column-scoped.** `persist_provider_key` writes `{provider}_api_key`; this is
   encrypted only for the 9 providers enumerated in `SECRET_COLUMNS`. A hypothetical unknown provider name
   would store plaintext. The provider set is constrained by the frontend `ProviderPicker` to exactly those
   known providers, so no live path reaches an un-encrypted column. Noted for future provider additions:
   any new provider must be added to `SECRET_COLUMNS` in the same change.

---

## Operational Notes (deferred / operator-gated — not code gaps)

- **Migration 102 live apply + `full-schema.sql` regen** (158-12) is operator-gated and may be pending on
  the live local DB. This affects only the *auditable* `setup_complete` DB flag, not any of the 11 threats —
  the file marker is the gate authority and `setup_complete()` fails soft to False. No threat is open on it.
- **Cloud parity pending:** migs 099/100/101 + `SECRETS_ENCRYPTION_KEY` (150) + **102** must reach cloud
  Supabase at the next production push. `SECRETS_ENCRYPTION_KEY` is load-bearing for T-158-04 in cloud — if
  absent, provider keys pass through in plaintext (Phase-150 fail-open). Ensure it is set in the cloud backend
  env before the wizard is exercised against a cloud deploy.
- **Deferred live end-to-end operator UAT** (D-18, analog of 157's D-09 smoke): a human running the wizard
  from a fresh `docker compose -f docker-compose.prod.yml up --build`, reading the token from
  `docker compose logs backend`, finalizing, restarting, and logging in as operator — is the SC#1/2/3
  lived-experience proof. It is operator-gated; code + tests are complete and green.

---

## Conclusion

All 11 canonical threats (T-158-01 .. T-158-11) and all 6 auxiliary sub-threats are **CLOSED** with the
declared mitigation located in shipped code and confirmed by 60 passing contract tests. The pre-auth wall was
independently proven hole-free (7/7 writes token-gated). No CRITICAL/HIGH finding, no un-gated write, no
secret leak in `/public-config`, no `==` token compare, no XSS sink. No unregistered attack surface.

**`threats_open: 0` — phase may ship.**
