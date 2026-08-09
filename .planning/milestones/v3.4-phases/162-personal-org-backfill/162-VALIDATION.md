---
phase: 162
slug: personal-org-backfill
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-18
---

# Phase 162 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **This is a SQL-migration-only phase — no app code, no UI, no pytest/jest harness.**
> Validation = **operator-run verification SQL** (Supabase SQL editor, or psycopg2 `:54322`).
> Source: `162-RESEARCH.md` → `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — verification SQL (this phase writes no application code) |
| **Config file** | none |
| **Quick run command** | Paste the SC#1–4 query pack (below) into the Supabase SQL editor, or run via psycopg2 `:54322` |
| **Full suite command** | The same pack, run **twice** — once after apply, once after a re-paste (SC#4 idempotency) |
| **Estimated runtime** | < 5 seconds on the local DB (largest target ≈ 5080 rows) |

> **Apply-path note (RESEARCH Pitfall 1):** the batched-`COMMIT` procedure fails with *"invalid transaction termination"* if the whole migration is pasted as one wrapping transaction. Apply via psycopg2 `autocommit=True` @ `:54322` (the proven mig-104 path) **or** paste with per-`CALL` execution. Both are safe; neither runs inside a single wrapping txn.

---

## Sampling Rate

- **After the migration applies:** run the full SC#1–4 query pack — every assertion must hold.
- **Before `/gsd:verify-work`:** re-paste the migration (SC#4) and re-run the pack — counts must be identical (idempotent).
- **Max feedback latency:** seconds (local DB is tiny).

> **Baseline capture is mandatory (Wave 0):** snapshot per-target row counts + the `is_global`/`is_system` census **before** applying migration 105 — the SC#3 "nothing disappeared" diff needs a before-image.

---

## Per-Task Verification Map

Because there is no unit-test framework, each Success Criterion maps to a **verification-SQL acceptance criterion** the executor embeds in the plan and the operator runs against the live DB. `SC#4` re-runs the whole pack after a re-paste.

| SC | Requirement | Secure Behavior | Test Type | Verification query (from RESEARCH §Validation Architecture) | Status |
|----|-------------|-----------------|-----------|-------------------------------------------------------------|--------|
| SC#1 (a) | MIG-01 | Every user → 1 personal org + `org-admin` membership | manual-SQL | `count(auth.users) == count(organizations)`; `count(org_members WHERE role='org-admin') >= users` | ⬜ pending |
| SC#1 (b) | MIG-01 | No duplicate orgs per user | manual-SQL | `SELECT user_id,count(*) FROM org_members GROUP BY user_id HAVING count(*)<>1` → **0 rows** | ⬜ pending |
| SC#1 (c) | MIG-01 | Exactly one default dept per org | manual-SQL | `departments` GROUP BY `org_id` HAVING `count(*) FILTER (WHERE is_default)<>1` → **0 rows** | ⬜ pending |
| SC#2 | MIG-01 | `org_id` non-NULL across all 35 targets; flip only after zero-NULL | manual-SQL | Pre-flip NULL census (UNION over 35 targets) → **all 0**; self-guard `RAISE EXCEPTION` makes a dirty flip structurally impossible (proven live) | ⬜ pending |
| SC#2 (nullable set) | MIG-01 / D-11 | Only genuinely org-agnostic tables stay nullable | manual-SQL | `information_schema.columns WHERE column_name='org_id' AND is_nullable='YES'` → only `operator_audit_log` (+ `metadata_field_definitions` iff kept nullable) | ⬜ pending |
| SC#3 (a) | MIG-01 | All data preserved (backfill UPDATEs only — never INSERT/DELETE target rows) | manual-SQL | Per-target `count(*)` **invariant** before vs after | ⬜ pending |
| SC#3 (b) | MIG-01 / D-04 | `is_global`/`is_system` reach unchanged (162 is HANDS-OFF) | manual-SQL | Census: `folders(is_global)=1`, `skills(is_global)=1`, `skills(is_system)=1`, `workflow_definitions(is_global)=15` — identical before/after | ⬜ pending |
| SC#4 (a) | MIG-01 | Re-run does not duplicate | manual-SQL | Re-paste → SC#1 org/member counts unchanged | ⬜ pending |
| SC#4 (b) | MIG-01 | Batching releases locks | manual-SQL | Procedure `RAISE NOTICE 'batch N → M rows'` with `M <= 10000` + `COMMIT` between batches (SQL-editor / psql notices) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **No test files needed** (SQL-only phase — intentional and correct for a data migration).
- [ ] **Baseline snapshot before applying migration 105:** capture per-target `count(*)` + the `is_global`/`is_system` census (SC#3 before-image). This is the one hard Wave-0 prerequisite.
- [ ] Author the SC#1–4 query pack (above) as executable acceptance criteria in the PLAN tasks.

*No framework install, no conftest, no unit tests — by design.*

---

## Manual-Only Verifications

Everything is manual-SQL for this phase (no automatable harness). The cloud-scale items can only be argued by construction — the local DB is too small to exercise the lock windows.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SC#1–4 query pack | MIG-01 | No test framework; DB-state assertions | Run the pack in the SQL editor / psycopg2 `:54322` after apply; every assertion must hold |
| Idempotent re-run (SC#4a) | MIG-01 | Requires a full second apply | Re-paste migration 105; re-run SC#1 counts — must be identical |
| **Lock-storm safety at cloud scale (SC#4c)** | MIG-01 | **(reason-only)** — local largest target = 5080 rows, completes in one batch; the 10k-row bounded lock window + `COMMIT`-releases-lock cannot be observed locally | Argue by construction + the live PG17.6 `COMMIT`-releases-lock proof captured in RESEARCH §Batched Backfill; verify the procedure loops with per-batch `COMMIT` and a `LIMIT` bound in code review |
| **`metadata_field_definitions` NOT-NULL decision** | MIG-01 / D-11 | Depends on whether **cloud** holds global system field-defs with no owning user | Self-guard forces the correct call at apply time; locally 0 NULL-owner rows, so it flips safely — do NOT hardcode "always flip" without the guard |

---

## Validation Sign-Off

- [x] All Success Criteria have a concrete verification query or an explicit reason-only justification
- [x] Sampling continuity: the full SC#1–4 pack runs after apply (SC#1/2/3 machine-gated in 162-02 Task 2) AND after a re-paste (SC#4)
- [ ] Wave 0 baseline snapshot captured before applying migration 105 *(execution-time — 162-02 Task 1)*
- [x] No watch-mode flags (N/A — no test runner)
- [x] Feedback latency < 5s (local DB)
- [x] `nyquist_compliant: true` set in frontmatter (plans embed the SC#1–4 query pack as machine-gated acceptance criteria — checker-confirmed)

**Approval:** approved 2026-07-18 (plan-phase — one unchecked box is the execution-time Wave-0 baseline)
