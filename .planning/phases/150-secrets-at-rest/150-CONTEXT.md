# Phase 150: Secrets at Rest - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Provider API keys stored in the `app_settings` DB row (the 12 secret columns: 9 `{provider}_api_key` + `embedding_api_key` + `rerank_api_key` + `tavily_api_key` — the canonical list is `_API_KEY_COLUMNS` at `backend/app/main.py:125-130`) are encrypted at rest using app-layer `cryptography` (Fernet/AESGCM — **NOT pgsodium**, which Supabase is deprecating). The env-var fallback precedence (`DB row > env`) is preserved exactly; key saves become round-trip-verified so a failed save surfaces an error instead of silently returning 200; existing deployments and local dev keep working with **zero manual key re-entry**.

**Backend-only phase** — no new UI surface, not sketch-gated. The single UI touch is one small honest field on the EXISTING Phase-147 Control Plane health board (see D-02). SEC-01 is the only requirement (see `.planning/REQUIREMENTS.md`); ROADMAP Success Criteria #1–4 are the acceptance anchor.

Out of scope (locked in REQUIREMENTS.md): HashiCorp Vault / external secret stores (future, after SEC-01 proves the abstraction), pgsodium, encrypting non-secret settings values.

</domain>

<decisions>
## Implementation Decisions

### Missing master-key behavior (no encryption env var set)
- **D-150-01:** Fail-open with a loud warning. When the encryption-key env var is absent, the platform boots and behaves exactly as today — secrets stay/save plaintext. A prominent startup log warns that secrets are NOT encrypted and names the env var to set. Encryption activates on the next boot after the operator sets the key. This honors SC#4 ("existing deployments keep working unchanged") literally; encryption is one env var away. Auto-generating a key was REJECTED (Coolify container FS is ephemeral — a redeploy would lose the key and brick every stored secret).
- **D-150-02:** The secrets-encryption state is operator-visible in TWO places: backend startup logs AND a small honest field on the existing `/admin` Control Plane dependency-health surface (Phase 147 board: Redis/Supabase/sandbox). States: `encrypted ✓` / `plaintext ⚠ (no key set)` / error state per D-150-05. This is the phase's only frontend touch — one field on an existing tile board, no new surface.

### Migrating existing plaintext keys
- **D-150-03:** Eager startup sweep. On every boot where a valid key is present, an idempotent sweep encrypts any plaintext values in the secret columns in place. `app_settings` is a single `id='global'` row, so the sweep is trivial (read row → encrypt plaintext secret columns → write back). Must be WORKER_COUNT=2-safe + idempotent (Phase 146 `seed_operators_from_env` precedent — both workers encrypting the same plaintext concurrently is harmless; already-encrypted values are detected and skipped). Sweep failure = log + continue (the read path tolerates plaintext), retry next boot. Lazy encrypt-on-save was REJECTED (keys nobody re-saves would stay plaintext indefinitely — SC#1 would be false for existing deployments).

### Wrong-key / decrypt-failure handling
- **D-150-04:** Failure polarity is intent-based, mirroring the codebase's D-Q4 convention:
  - **No key set** → plaintext + warn (operator hasn't opted in) — D-150-01.
  - **Key set but malformed** (invalid Fernet/base64, typo) → REFUSE TO START at lifespan startup with a clear error message + key-generation hint. Explicit-but-broken key is a config error; mirrors the Phase 075.4 `UnknownProviderError` raise-at-startup precedent. Silently running plaintext would betray explicit operator intent.
  - **Key valid but a stored value won't decrypt** (DB restored under a different key, corrupted value) → fail-soft per column: treat that column as unset so the EXISTING env-fallback chain takes over; platform stays up; loud per-column log; Control Plane signal shows the error state (e.g., "N secrets unreadable").
- **D-150-05:** A decrypt failure must NEVER take the platform down — settings reads sit on nearly every request path, and the project's uniform posture is fail-soft/last-known-good on settings blips (`_load_settings_from_db`, FLAG-01 helpers).

### Key rotation
- **D-150-06:** Multi-key env from day one (MultiFernet pattern): the env var accepts a comma-separated key list — FIRST key encrypts, older keys decrypt-only. The D-150-03 sweep additionally re-encrypts any value not encrypted with the current primary key. Rotation procedure = prepend new key to env var → reboot (sweep re-encrypts) → remove old key. Full rotation capability with ~zero extra code; NO new admin endpoint, NO CLI tooling, NO rotate-without-reboot.

### Round-trip verification (SC#2 — locked by roadmap, shape confirmed by scouting)
- **D-150-07:** The known silent-success bug is real and in scope: `update_settings` (`backend/app/api/settings.py:453`) calls `save_app_settings` and ignores the returned bool — a failed key save returns HTTP 200 today. Phase 150 must surface a failed save as a real HTTP error (Phase 147 CR-02 precedent: `set_flag` raises 500 with no false audit row). "Round-trip verified" = after an encrypted save, the value must decrypt back to what was submitted before the save is reported successful.

### Claude's Discretion
- Cipher choice within the locked library (Fernet vs AESGCM — Fernet/MultiFernet is the natural fit given D-150-06, but researcher confirms), exact env var name (something like `SECRETS_ENCRYPTION_KEY`), stored-value envelope/marker format for distinguishing encrypted from plaintext values (Fernet's `gAAAAA` prefix vs an explicit `enc:v1:` wrapper — pick one that keeps D-150-03 idempotence and future format versioning clean).
- Where the encrypt/decrypt seam lives — the natural single seams are `save_app_settings()` (encrypt-on-write) and `_load_settings_from_db()` / `_build_settings_from_row()` (decrypt-on-read) in `backend/app/models/user_settings.py`; keep it to ONE seam per direction so no caller ever sees ciphertext.
- Whether the legacy one-shot `_migrate_settings_override()` path in `main.py` (writes plaintext keys from `settings_override.json`; renamed `.migrated` after first run — mostly dead) gets the encryption treatment or a comment + reliance on the D-150-03 sweep next boot.
- Test strategy, including the SC-level proof that a psql/SQL-editor read of `app_settings` shows ciphertext not plaintext.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement + roadmap anchor
- `.planning/REQUIREMENTS.md` — SEC-01 (line ~32): the locked requirement incl. NOT-pgsodium + env-fallback + round-trip-verified; "Out of Scope" table row on pgsodium; Future Requirements note that Vault adapters come AFTER SEC-01's abstraction proves out
- `.planning/ROADMAP.md` — Phase 150 section: goal + the 4 Success Criteria (encrypted at rest / round-trip verified / env-only still works / no re-entry)

### The code this phase changes (read before planning)
- `backend/app/models/user_settings.py` — THE settings substrate: `save_app_settings()` (single write seam, sentinel + `_is_valid_api_key` guard, returns bool), `_load_settings_from_db()` (30s TTL per-worker cache), `_build_settings_from_row()` + `_val()` (the DB-over-env fallback chain SC#3 protects), `KEY_PLACEHOLDER` ("***" = keep) convention
- `backend/app/api/settings.py` — `update_settings` PUT route: builds the `{pid}_api_key` updates dict, IGNORES `save_app_settings`'s bool (the D-150-07 bug), redacts `_key`/`_secret` in audit metadata (`:454`)
- `backend/app/main.py` — `_API_KEY_COLUMNS` (:125-130, the canonical 12 secret columns); `_migrate_settings_override()` legacy plaintext write path; `lifespan()` startup hooks incl. the Phase 146 `seed_operators_from_env` idempotent-seed precedent (:258-268) the D-150-03 sweep should mirror
- `backend/app/services/health_probe.py` — the Phase 147 dependency-health probe surface the D-150-02 Control Plane signal extends

### Conventions that bind this phase
- `CLAUDE.md` — "env vars are for secrets and infra only" (master key = env var); migrations = numbered SQL applied via Supabase SQL editor (if any migration is even needed — the secret columns already exist; likely none); multi-worker `WORKER_COUNT=2` default + D-PRD-12 singleton audit
- `docs/DEPLOYMENT-WORKFLOW.md` — cloud parity checklist: the new env var must be documented for Coolify at promotion; note mig 099 (Phase 149) is still pending on cloud

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `save_app_settings()` already returns `bool` (Phase 147 CR-02) — the round-trip-verify plumbing has its foundation; the caller-side surfacing is what's missing
- `invalidate_settings_cache()` — cache-bust on write already exists; encryption doesn't change the caching story
- Phase 146 `seed_operators_from_env` — the proven idempotent, WORKER_COUNT=2-safe startup-write pattern for the D-150-03 sweep
- Phase 147 health probes + Control Plane tile board — the D-150-02 signal slots into an existing surface
- `_is_valid_api_key` / `_SENTINEL_VALUES` guard — encryption composes AFTER this guard on the write path (validate plaintext, then encrypt)

### Established Patterns
- Uniform in-process 30s-TTL settings cache, per worker, no cross-worker invalidation (Phase 149 WR-03 lesson: fresh-read-at-decision, not Redis) — decrypt-on-read must live below the cache so cached values are plaintext in memory (cache stores the row dict; decide whether to decrypt at row-load or at `_build_settings_from_row` — one seam only)
- Fail-soft settings posture: `_load_settings_from_db` returns stale/empty on a blip; FLAG-01 helpers have explicit cold-read polarity — D-150-04/05 continue this
- Raise-at-startup for config errors (075.4 `UnknownProviderError`) — the malformed-key fail-hard mirrors this
- Audit redaction: `update_settings` already redacts `_key`/`_secret` values in audit metadata; never log secret values (T-081.1-04)

### Integration Points
- Write: `save_app_settings()` in `user_settings.py` (+ decide on the legacy `_migrate_settings_override` path)
- Read: `_load_settings_from_db()` / `_build_settings_from_row()` → every consumer (`_build_providers`, `_resolve_llm`, embedding/rerank/tavily reads) gets decryption transparently — no consumer changes
- Startup: `lifespan()` in `main.py` — key validation (fail-hard on malformed) + eager sweep, after pool init, alongside the operator seed
- Health: `/admin/backpressure` probe payload + Control Plane tile for the D-150-02 signal
- `cryptography` is NOT yet in `backend/requirements.txt` — new dependency (the phase's only one)

</code_context>

<specifics>
## Specific Ideas

- The failure-polarity table (D-150-04) was the operator's through-line: silence is only acceptable when the operator hasn't opted in; explicit intent that can't be honored fails LOUD (boot refusal); data that can't be read fails SOFT (env fallback) with an honest signal. Match this polarity everywhere in the phase.
- Rotation must stay "edit env var + reboot" — no new operational surface for it.

</specifics>

<deferred>
## Deferred Ideas

- **HashiCorp Vault / external secret-store adapters** — already tracked in REQUIREMENTS.md Future Requirements (enterprise tier, after SEC-01's backend abstraction proves out). D-150-06's multi-key + single-seam design is the abstraction it builds on.
- **Rotate-without-reboot admin action** — explicitly rejected for this phase (D-150-06). Re-open trigger: an operator actually needs zero-downtime rotation (e.g., >1 org / SLA constraints in v3.4+ multi-tenancy).

</deferred>

---

*Phase: 150-secrets-at-rest*
*Context gathered: 2026-07-13*
