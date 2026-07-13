# Phase 150: Secrets at Rest - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 150-secrets-at-rest
**Areas discussed:** Missing master-key behavior, Migrating existing plaintext keys, Wrong-key / decrypt-failure handling, Key rotation scope

---

## Missing master-key behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Boot plaintext + loud warning | Platform boots and behaves exactly as today (secrets stay/save plaintext). Prominent startup log warns 'secrets are NOT encrypted — set the key env var to enable'. Encryption turns on the moment the operator adds the key. | ✓ |
| Refuse to start | Fail-hard: no key, no boot. Strongest guarantee but breaks every existing deployment + fresh local dev at upgrade. | |
| Auto-generate a key | Generate at first boot, persist to a local file. Zero friction, but Coolify's ephemeral container FS loses the key on redeploy and bricks every stored secret. | |

**User's choice:** Boot plaintext + loud warning (Recommended)
**Notes:** Honors SC#4 ("existing deployments keep working unchanged") literally.

### Follow-up: warning surface

| Option | Description | Selected |
|--------|-------------|----------|
| Log + Control Plane signal | Startup log AND a small honest field on the existing Phase-147 /admin dependency-health board ('Secrets: encrypted ✓ / plaintext ⚠'). | ✓ |
| Log only | Purely backend, but easy to miss on managed hosting. | |

**User's choice:** Log + Control Plane signal (Recommended)

---

## Migrating existing plaintext keys

| Option | Description | Selected |
|--------|-------------|----------|
| Eager startup sweep | First boot with the key present encrypts every plaintext secret column in place (idempotent, WORKER_COUNT=2-safe — Phase 146 seed precedent). One DB row, trivial sweep. | ✓ |
| Lazy — encrypt on next save | Only re-encrypt on re-save; untouched keys stay plaintext indefinitely (SC#1 stays false for existing deployments). | |

**User's choice:** Eager startup sweep (Recommended)

---

## Wrong-key / decrypt-failure handling

### Stored value fails to decrypt

| Option | Description | Selected |
|--------|-------------|----------|
| Treat as unset + env fallback | Unreadable column behaves as empty; env fallback takes over; platform stays up; loud per-column logs; Control Plane shows 'N secrets unreadable'. | ✓ |
| Hard error on read | Refuse settings when any secret fails to decrypt — effectively platform-down over one bad column. | |

**User's choice:** Treat as unset + env fallback (Recommended)

### Malformed key in env at boot

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse to start | Explicit-but-broken key is a config error; fail at lifespan startup with clear message + key-generation hint (075.4 raise-at-startup precedent). | ✓ |
| Warn + run plaintext | Operator believes secrets are encrypted while they're not — the silent-success class SEC-01 exists to eliminate. | |

**User's choice:** Refuse to start (Recommended)

---

## Key rotation scope

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-key env + sweep re-encrypt | Comma-separated key list (MultiFernet): first key encrypts, older keys decrypt-only; the eager sweep re-encrypts anything on an old key. Rotation = edit env var + reboot. | ✓ |
| Single key, format-ready only | Version-tagged format, rotation tooling deferred as a seed. | |
| Full rotation tooling in-phase | Dedicated admin endpoint/CLI to rotate without reboot — real extra scope for a rarely-exercised capability. | |

**User's choice:** Multi-key env + sweep re-encrypt (Recommended)

---

## Claude's Discretion

- Cipher choice within the locked `cryptography` library (Fernet/MultiFernet vs AESGCM)
- Exact env var name + stored-value envelope/marker format (encrypted-vs-plaintext detection)
- Seam placement (encrypt in `save_app_settings`, decrypt at the single row-load/build seam)
- Disposition of the legacy `_migrate_settings_override()` plaintext write path in `main.py`
- Test strategy incl. the raw-SQL ciphertext proof

## Deferred Ideas

- HashiCorp Vault / external secret-store adapters — already in REQUIREMENTS.md Future Requirements (post-SEC-01)
- Rotate-without-reboot admin action — rejected for this phase; re-open trigger: zero-downtime rotation actually needed (multi-tenancy/SLA, v3.4+)
