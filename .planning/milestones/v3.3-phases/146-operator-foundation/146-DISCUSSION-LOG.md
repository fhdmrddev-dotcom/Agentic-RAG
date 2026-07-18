# Phase 146: Operator Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-10
**Phase:** 146-operator-foundation
**Areas discussed:** Operator bootstrap, Audit guarantee, org_id stub sweep, Failure scenarios (G-4)

---

## Operator bootstrap

| Option | Description | Selected |
|--------|-------------|----------|
| Env-var seed on startup (Recommended) | `OPERATOR_EMAILS` in backend/.env — on boot the backend idempotently upserts matching auth users into `operator_users`. Works identically local + cloud (Coolify), replaces `BACKPRESSURE_ADMIN_USER_IDS` 1:1, survives DB wipes. DB is runtime source of truth; env is bootstrap-only. | ✓ |
| Manual SQL insert (runbook) | Operator pastes an INSERT into the Supabase SQL editor. Zero code, but friction on every fresh env/DB wipe. | |
| Both: env seed + documented SQL | Env-var paved path + documented SQL fallback. | |

**User's choice:** Env-var seed on startup

| Option | Description | Selected |
|--------|-------------|----------|
| Clean replace, no fail-open (Recommended) | Delete the env var + fail-open logic; `/admin/backpressure` behind `require_operator`; 404 for non-operators even in dev. Local behaves exactly like prod. | ✓ |
| Keep dev fail-open | In dev, any authenticated user counts as operator. Zero setup, but local diverges from prod. | |

**User's choice:** Clean replace, no fail-open

---

## Audit guarantee

| Option | Description | Selected |
|--------|-------------|----------|
| Auto floor + rich labels (Recommended) | The `require_operator` gate writes a row for EVERY /admin request (guarantee by construction); write-endpoints enrich with plain-sentence labels. | ✓ |
| Explicit per-endpoint calls only | Hand-crafted sentences per handler; a forgotten call silently skips the ledger. | |
| Auto-log only, no enrichment | Gate logs method+path; write receipts get generic. | |

**User's choice:** Auto floor + rich labels

| Option | Description | Selected |
|--------|-------------|----------|
| Manual refresh only (Recommended) | Load on entry + visible ↻ Refresh; every ledger row is a deliberate human action. Auto-poll arrives with 147's active-runs view. | ✓ |
| Auto-poll, exempt from ledger | 30s background polls marked and skipped by the audit floor — punches a hole in the by-construction guarantee day one. | |

**User's choice:** Manual refresh only

---

## org_id stub sweep

| Option | Description | Selected |
|--------|-------------|----------|
| New tables + core sweep (Recommended) | `operator_audit_log` ships with org_id (nullable, no FK — harness_audit pattern) PLUS one migration stubs the core user-data tables (exact list at planning). Metadata-only ALTERs. | ✓ |
| New tables only | Only the net-new table; v3.4 pays the sweep later. | |
| You decide at planning | Planner weighs it against the live schema. | |

**User's choice:** New tables + core sweep

---

## Failure scenarios (G-4)

| Option | Description | Selected |
|--------|-------------|----------|
| Adopt all 3 (Recommended) | The invisible door (non-operator byte-identical + plain 404) · the control-room zone feel (band/plain copy/honest locks) · the ledger-is-the-receipt (persistent row, no toast). | ✓ |
| Adopt 3 + restart resilience | Adds a backend-restart scenario (idempotent seed, surviving ledger). | |

**User's choice:** Adopt all 3

---

## Claude's Discretion

- Operator-probe endpoint shape (e.g., `GET /admin/me` 404s for non-operators)
- `operator_audit_log` column schema + action vocabulary (harness_audit precedent)
- Exact core-table list for the org_id sweep
- 404 indistinguishability mechanics
- `ActiveView` naming + component layout for the Control Room
- RLS posture on the new tables; migration split/numbering (next: 095)

## Deferred Ideas

- Auto-poll + audit-floor exemption design → Phase 147
- Operator add/remove management UI → Phase 148
- Impersonation ("Sign in as user") → Phase 148 STRETCH/named-trigger
- Audit browser search/filters/CSV → Phase 148
- Todo `spike-nl-workflow-authoring.md` reviewed, not folded → Phases 151/152
