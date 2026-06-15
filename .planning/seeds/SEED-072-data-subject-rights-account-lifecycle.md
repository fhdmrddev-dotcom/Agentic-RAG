---
seed_id: SEED-072
title: Data-Subject Rights & Account Lifecycle — deletion / right-to-erasure / portability export vs the immutable audit model
status: planted
planted: 2026-06-10
phase_origin: "Phase 101 plan-phase — future-milestone alignment sweep 2026-06-10 (workflow wf_13ed5033)"
category: security / compliance / multi-tenancy — a data-lifecycle + erasure-reconciliation seam across the org-scoped tables, NOT a new user-facing feature
related_seeds: [SEED-075, SEED-079, SEED-004, SEED-005, SEED-012, SEED-024, SEED-069]
related_memories: [project_target_scale, project_org_level_deferred, project_v3_roadmap_locked, project_v3_milestone, feedback_apply_migrations_via_sql_editor]
related_decisions:
  - "D-09 (harness_audit run_id is a PLAIN uuid, NO FK — audit row survives run deletion: NEVER CASCADE) — migration 059_harness_audit_and_threads_col.sql:6,16"
  - "D-10 (harness_audit / audit_log are INSERT-only: no UPDATE/DELETE policy → RLS denies all mutation, tamper-proof) — migration 059:5,40-41,53; pattern set by migration 030_missing_tables.sql audit_log"
  - "D-PRD-02 (hybrid tenancy via deployment shape, not data layer — both co-tenant SaaS and dedicated/on-prem installs exist) — the company is the data processor for the co-tenant tier, which carries direct DSAR obligations"
re_open_triggers:
  - The v3.2 Multi-Tenancy member-removal / offboarding flow is scoped (today DELETE /orgs/{org_id}/members/{user_id} only drops a membership ROW — the underlying data-deletion mechanism is uncaptured). The RLS rewrite on the 18 org-scoped tables is the natural, far-cheaper place to add cascade/anonymize logic — co-design it, do not retrofit.
  - The first GDPR / HIPAA / EU enterprise customer (or any procurement-security questionnaire asking about right-to-erasure, data-subject-access, or data-portability) lands.
  - The lighter hosted multi-tenant SaaS subscription line is scoped — as data processor the company owns DSAR fulfilment directly, not as a contractual pass-through.
  - The SCIM phase (v3.2 deferred — `.planning/PRDs/v3.2.md:150,410`) is scoped — SCIM is automated IdP de-provisioning, a SUPERSET trigger that calls the (still-missing) underlying deletion mechanism.
  - A SEED-005 / DM document-lifecycle or retention-policy phase is scoped — per-document retention is meaningless without the per-user/per-org erasure + export primitive underneath it.
priority: high — a genuinely homeless, cross-hunter-confirmed compliance gap (raised independently by the Multi-tenancy, Security, and Deployment hunters — the strongest cross-hunter signal in the 2026-06-10 register) with an unreconciled tension against the immutable-audit model. Not load-bearing for v2.9, but a hard enterprise-procurement blocker the moment a co-tenant or EU customer exists.
suggested_phase: v3.2 Multi-Tenancy scope candidate, co-designed WITH the membership-keyed RLS rewrite (migrations 081-085). Possibly bundled into an "Enterprise / Compliance Readiness" milestone between v3.1 and v3.2 alongside SEED-075 (backup/DR) and SEED-079 (PII/DLP). NOT v2.9.
---

# SEED-072 — Data-Subject Rights & Account Lifecycle

## The gap

The platform has rich **onboarding** (JIT provisioning, email/link invitations,
SSO) but **zero** data-subject-rights tooling on the inverse lifecycle. A grep of
`backend/app` for `delete-account` / `export-data` / `gdpr` / `dsar` / `erasure`
returns nothing; a grep across all six PRDs returns nothing. The only GDPR capture
anywhere is the v3.2-close **GDPR DPA template + technical-measures checklist**
(`.planning/PRDs/v3.2.md:509`) — a customer-facing **legal document**, not a working
erasure/export pipeline. Three independent hunters surfaced this in the 2026-06-10
sweep (Multi-tenancy, Security, Deployment), making it the strongest cross-hunter
signal in the register. The hole has three distinct faces:

| Face | Current state | Evidence |
|---|---|---|
| **Deactivate / suspend** (keep data, freeze access for audit) | No flow. The inverse of onboarding is one line — `DELETE /orgs/{org_id}/members/{user_id}` removes a **membership row**, not the user's data | v3.2 ORG-INVITE-01 / SSO-FALLBACK cover onboarding only; offboarding uncaptured |
| **Hard-delete / cascade-or-anonymize** the ~18 tables of user-owned rows (documents, threads, messages, runs, skills, memory, code executions) | No orchestrated flow. `ON DELETE CASCADE` on `auth.users` exists at the table level but as a **physical-delete side effect**, not an auditable, user-initiated, reversible-window workflow | `030_missing_tables.sql:9,40,63,86,111`; `059_harness_audit_and_threads_col.sql:15` |
| **Right-to-erasure + portability export** (GDPR Art. 15/17/20) | No path. No per-user or per-org export bundle (threads / messages / documents / skills / audit) in any portable format | `prd-reset/PLAN.md:192` asked "per-user export, per-org backup — where?"; only the backup half got a (stale) routing → SEED-075 |

### The unreconciled tension (the part nobody has resolved)

The audit model is deliberately **immutable**. `harness_audit` and `audit_log` are
**INSERT-only** — they ship a SELECT(owner) + INSERT(owner) policy and **no
UPDATE/DELETE policy**, so RLS denies all mutation, making rows tamper-proof
(**D-10** — `059:5,40-41,53`; pattern set by `030` audit_log). And `harness_audit.run_id`
is a **PLAIN uuid with NO FK**, deliberately so the audit row **survives run deletion**
(**D-09 — NEVER CASCADE** — `059:6,16`).

Yet the **same** `harness_audit` table declares
`user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE` (`059:15`), as
does `audit_log` (`030:9`). So deleting an `auth.users` row would **physically wipe the
very audit rows D-09/D-10 say must outlive everything**. "Erase the user" and "keep
the immutable audit trail" are in direct conflict, and there is **no resolution** — no
choice made between **anonymize-in-place** (scrub PII columns, keep the immutable row
with a tombstoned subject) versus **hard-delete-with-tombstone**. An incidental
`ON DELETE CASCADE` is doing, by accident, the opposite of what the audit-immutability
principle requires.

## Why it matters at the product's target scale

The product must **serve any scale from one codebase**, is **B2B-first**, and may run a
**lighter hosted multi-tenant SaaS subscription** alongside dedicated/on-prem installs;
infrastructure is left to the buying company against **published requirements**
(`project_target_scale`). Tenancy is hybrid **via deployment shape, not the data layer**
(D-PRD-02). Two consequences make DSAR load-bearing, not polish:

- **Co-tenant SaaS makes the company the data processor.** In the hosted tier the
  company holds direct GDPR Art. 15/17/20 obligations (access / erasure / portability) —
  they cannot be passed through to the buyer the way a dedicated/on-prem install can.
- **B2B + EU/regulated buyers gate procurement on this.** Right-to-erasure, clean
  offboarding, and "let a customer take their data and leave" appear in essentially every
  enterprise security/procurement questionnaire and in the legal/finance/healthcare
  verticals on the v3.5+ roadmap. A missing flow is a hard sales blocker and a standing
  legal exposure.

**Which milestones it shapes:** **v3.2 Multi-Tenancy** (the org-scoped tables + RLS
rewrite are the natural home — erasure must be org-scoped); **v3.1 Operator UX** (an
admin-triggered export/erasure is an operator affordance); **SEED-005 / DM** (per-document
retention is meaningless without the per-user/per-org erasure + export primitive
underneath it); **v3.4 DM Tier B** (retention/lifecycle audit).

## Why it is deferred / not now

It is genuinely homeless across all six PRDs **today**, and that is acceptable while the
install is single-operator / small-team on one host (the only data subjects are the
operator's own team, and there is no external data-processor relationship). Nothing in
v2.9 touches it. The right time is the **v3.2 RLS rewrite**: the cascade/anonymize logic
touches the **exact same 18 tables** v3.2 re-predicates from `user_id` to membership, so
designing erasure + export **alongside** that rewrite is an order of magnitude cheaper
than retrofitting after RLS ships. Building it before the tenant model exists would bake
in a user-scoped design the org-scoped rewrite then has to unwind.

## Likely shape if promoted

Co-design with the v3.2 membership-keyed RLS rewrite. Candidate scope:

1. **Lifecycle states, not a single DELETE.** Model `deactivate / suspend`
   (freeze access, retain data) → `scheduled-erasure` (reversible window) →
   `erased` (terminal), distinct from a membership-row removal. Org-scoped throughout.
2. **Resolve the erasure-vs-immutable-audit tension explicitly.** Pick **anonymize-in-place
   for audit tables** (scrub PII columns, retain the immutable INSERT-only row with a
   tombstoned subject id) and **hard-delete for content tables** (documents, threads,
   messages, skills, memory, code executions). This means **changing the `auth.users`
   `ON DELETE CASCADE` on `audit_log` (030:9) and `harness_audit` (059:15)** to a
   SET-NULL / tombstone path so D-09/D-10 stop being silently violated. The audit row
   keeps proving "an action happened" without re-identifying the erased subject.
3. **Cascade/anonymize map across all org-scoped tables.** A single source-of-truth
   table-by-table classification (hard-delete vs anonymize vs retain-tombstoned),
   authored once during the RLS rewrite, executed transactionally.
4. **Portability export bundle (Art. 20 / Art. 15).** Self-serve or admin-triggered export
   of a user's or org's threads, messages, documents, skills, and audit trail in a
   portable format — the user-facing counterpart that backup/DR (SEED-075) is explicitly
   NOT (export = compliance/portability; backup = operational data-loss protection).
5. **Audit the erasure itself.** Every deactivate/erase/export is an INSERT-only operator/
   audit-log event (it is itself a data-subject action that must be provable later).
6. **SCIM is the superset trigger.** When the deferred SCIM phase (`.planning/PRDs/v3.2.md:150,410`) lands, IdP
   de-provisioning calls this mechanism — so the mechanism must exist first.

## Deliberately NOT in scope (when it lands)

The GDPR/SOC2/HIPAA **certifications** themselves (acknowledged-deferred, SUMMARY §E.2 #3/#4 —
this is the *technical* erasure/export machinery, not the audit/cert); **PII detection &
redaction** before provider egress and in logs (that is **SEED-079** — orthogonal: 072 is
"remove a known subject's data on request", 079 is "never let PII leave the boundary in the
first place"); **operational backup / restore / PITR / DR** (that is **SEED-075** — adjacent
but a different guarantee); the **per-document READ-access trail** ("who read what" — a
distinct unrouted concern, naturally a SEED-005 item); building any of this **before** the
v3.2 tenant model + RLS rewrite are decided (would bake in a user-scoped shape the rewrite
unwinds).

## Links

### Code seams (verified)
- `supabase/migrations/059_harness_audit_and_threads_col.sql:6,16` — D-09 NEVER CASCADE (run_id plain uuid, no FK)
- `supabase/migrations/059_harness_audit_and_threads_col.sql:5,40-41,53` — D-10 INSERT-only (no UPDATE/DELETE policy)
- `supabase/migrations/059_harness_audit_and_threads_col.sql:15` — `harness_audit.user_id ... ON DELETE CASCADE` (the tension)
- `supabase/migrations/030_missing_tables.sql:9,40,63,86,111` — `audit_log` + sibling tables all `ON DELETE CASCADE` on `auth.users`; 030 audit_log is the INSERT-only pattern 059 mirrors
- `.planning/PRDs/v3.2.md:509` — GDPR DPA template (legal doc, not a flow); v3.2.md:150,410 SCIM (deferred superset trigger)
- `prd-reset/PLAN.md:192` — "per-user export, per-org backup — where?" (asked, only backup half routed → SEED-075)

### Seed cross-links — the compliance cluster (072 ↔ 075 ↔ 079)
- **SEED-075** — Backup, Restore & Disaster Recovery: the **operational** data-loss guarantee. 072's export is user-facing portability; 075's backup is operator-facing recovery. The two halves of `PLAN.md:192` were split here.
- **SEED-079** — PII detection / redaction (DLP): orthogonal — 079 prevents PII egress; 072 removes a known subject on request. Both share the org-scoped surface and co-design with the v3.2 RLS rewrite.
- **SEED-004** — org multi-tenancy: provides the tenant model erasure/export scope against; the RLS rewrite is the co-design window.
- **SEED-005** — Enhanced Document Structure (next milestone): per-document retention sits on top of this per-user/per-org primitive; the per-document READ-access trail is a sibling SEED-005 item.
- **SEED-012** (admin/operator UI) — admin-triggered export/erasure is an operator-shell affordance.
- **SEED-024** (settings unification) / **SEED-069** (living-document reingestion) — adjacent lifecycle surfaces that touch the same tables.

### Investigation
- Future-milestone alignment sweep 2026-06-10, workflow `wf_13ed5033` — 8-agent fan-out; this gap is the cross-hunter merge of the Multi-tenancy, Security, and Deployment hunters.

---
*Planted 2026-06-10 during the Phase 101 plan-phase future-milestone alignment sweep. The single strongest cross-hunter signal in the register: three hunters independently found that the platform has zero data-subject-rights tooling AND that the incidental `ON DELETE CASCADE` on `auth.users` silently violates the D-09/D-10 audit-immutability principle. The fix is far cheaper co-designed with the v3.2 RLS rewrite than retrofitted after it.*
