---
seed_id: SEED-075
title: Backup, Restore & Disaster Recovery — published per-tier RTO/RPO; the "deferred to v3.2" routing is provably unfulfilled
status: planted
planted: 2026-06-10
phase_origin: "Phase 101 plan-phase — future-milestone alignment sweep 2026-06-10 (workflow wf_13ed5033)"
category: deployment / disaster-recovery / enterprise-procurement — a published-requirements + responsibility-split artifact plus an operational data-loss guarantee, NOT a new user-facing feature
related_seeds: [SEED-072, SEED-079, SEED-003, SEED-004, SEED-005, SEED-012, SEED-024, SEED-048, SEED-065, SEED-001]
related_memories: [project_target_scale, project_org_level_deferred, project_v3_roadmap_locked, project_v2_milestone, feedback_apply_migrations_via_sql_editor]
related_decisions:
  - "PRD-reset lateral pass asked it (PLAN.md:192 'Backup/restore UX (per-user export, per-org backup) — where?'; PLAN.md:193 'Disaster recovery + data retention policy — where?') and the answer (SUMMARY.md:88 'Backup/restore UX | DEFERRED to v3.2') is stale/unfulfilled"
  - "D-09 / D-10 (audit immutability: INSERT-only, NEVER-CASCADE on run deletion) — the audit tables a DR restore must bring back consistently with the run/thread tables; the same erasure-vs-immutable tension SEED-072 owns"
trigger_when:
  - First paying customer / pre-launch readiness review — the moment a real data-loss exposure exists rather than operator self-test data
  - Any enterprise-sales / procurement conversation that asks about RTO/RPO, data-loss guarantees, or a DR runbook (it appears in every security questionnaire)
  - v3.1 Operator UX deployment-preset / operator-runbook scoping — the natural build home (presets ship per-tier defaults but no DR runbook)
  - v3.2 Multi-Tenancy new-milestone — per-org backup/restore/export was assumed to live here but no REQ exists; co-design with the RLS rewrite
  - A co-tenant hosted-SaaS tier the company itself operates is scoped — backup becomes platform-owned and a real data-loss liability, not the buyer's problem
  - The stale SUMMARY.md:88 routing is touched at any milestone gate (fix the line so the gap stops hiding behind "deferred to v3.2")
priority: high — a hard enterprise-procurement blocker AND a real data-loss exposure for any co-tenant tier the company operates; currently invisible because the only routing that ever existed is provably unfulfilled, so no milestone gate will surface it on its own.
suggested_phase: a future enterprise/compliance-readiness milestone (likely v3.1 operator-runbook scoping for the published per-tier matrix + responsibility split, with the per-org restore/export half co-designed alongside the v3.2 RLS rewrite). NOT v2.9.
surface: Agentic-RAG
---

# SEED-075 — Backup, Restore & Disaster Recovery

## The gap

There is **no backup, restore, point-in-time-recovery (PITR), or RTO/RPO
requirement anywhere in the six PRDs** — and the one routing that ever existed is
stale. A future-milestone alignment sweep on 2026-06-10 (workflow `wf_13ed5033`)
traced the full paper trail:

| Step | What it says | Evidence |
|---|---|---|
| The question was asked | "Backup/restore UX (per-user export, per-org backup) — where?" and "Disaster recovery + data retention policy — where?" | `.planning/prd-reset/PLAN.md:192-193` |
| The answer given | Backup/restore UX → **"DEFERRED to v3.2"** | `.planning/prd-reset/SUMMARY.md:88` (line 8 of the open-questions table) |
| Where it actually went | v3.2 ships only data-**retention** policy; the retention tables (`dm_retention_policies`) are in fact **reserved for v3.4**, with the sweeper deferred there too | `.planning/prd-reset/MIGRATION-RESERVATIONS.md:24` (v3.4 = `dm_retention_policies` + lifecycle); `SUMMARY.md:143` (v3.4 = "DM retention/check-in/out…") |
| Net result | **Retention-policy was conflated with backup/DR.** No backup/restore/PITR/RTO/RPO REQ exists in any PRD, and there is no seed — so nothing surfaces it at a milestone gate. | grep of all six PRDs for backup/restore/PITR/RTO/RPO → none |

The closest thing that *does* ship is **run-resume / checkpoint durability**
(v3.4 `agent_checkpoints` + resume) — that protects a long agent run across a
restart, but it is **not** a backup or a DR story for the corpus.

What an actual backup/DR story has to cover (and currently does not exist for any
of the three deployment shapes — co-tenant SaaS, dedicated, on-prem):

- **What is backed up** — Postgres (including pgvector `document_chunks`), Supabase
  **Storage** objects (the uploaded documents themselves), the Redis run-buffer
  (`run:{run_id}` streams / `runs:active` — best-effort, may be DR-skippable), and
  the **secrets table** (the pgsodium-encrypted provider keys / DSNs that v3.1
  PROV-KEY-01 introduces — a restore that loses these is unusable).
- **Cadence + PITR** — backup frequency and a point-in-time-recovery window.
- **Published RTO/RPO targets per scale tier** — the numbers an enterprise infra
  team sizes against and a procurement questionnaire demands.
- **A tested restore drill** — a backup nobody has restored is not a backup; a DR
  runbook that has never been exercised is not a DR plan.
- **Operator-vs-platform responsibility split per deployment shape** — managed
  Supabase PITR vs self-hosted `pg_dump`/WAL archiving vs a co-tenant SaaS tier where
  backup is **platform-owned**.

A subtle consistency constraint the design must respect: a DR restore has to bring
back the **append-only audit tables** (`audit_log` / `harness_audit`, INSERT-only,
NEVER-CASCADE per D-09/D-10) consistently with the run/thread tables they reference —
the same immutable-audit surface SEED-072 reconciles for erasure must restore
coherently, or a recovered system has dangling or orphaned audit rows.

## Why it matters at the product's target scale

The product must **serve any scale from one codebase** — a small company on one box
up to multi-thousand-user organizations — with **infrastructure left to the buying
company against PUBLISHED requirements** (`project_target_scale`). It is
**B2B-first**, with a possible **lighter hosted multi-tenant SaaS subscription**
alongside. The single-VPS Phase 080 plan was operator self-testing ONLY, never the
product target.

Against that vision a missing backup/DR story is the sharpest gap in the deployment
dimension on two independent axes:

- **Enterprise-procurement blocker.** RTO/RPO and "what is your DR plan / data-loss
  guarantee" appear in **every** security questionnaire. For a B2B-first product
  whose whole posture is "here are our published requirements, you bring the infra,"
  there is nothing to publish — no per-tier RTO/RPO, no responsibility-split doc, no
  restore drill. This blocks the sale.
- **Real data-loss exposure for the SaaS tier.** The moment the company operates a
  co-tenant hosted SaaS subscription, backup is **platform-owned**: a lost Storage
  bucket or un-PITR'd Postgres is the company's liability across all tenants, not the
  buyer's.

Affected milestones (from the sweep):
- **v3.1 Operator UX** — deployment presets + operator runbooks ship without a DR
  runbook; v3.1 is the natural build home for the published per-tier matrix and the
  responsibility-split doc (it already owns presets, the install wizard, and
  health/metrics — see SEED-003 / SEED-012).
- **v3.2 Multi-Tenancy** — per-org backup/restore/export was *assumed* to live here
  (that was the stale "deferred to v3.2" routing) but no REQ exists; the per-org slice
  is an order of magnitude cheaper to design alongside the v3.2 RLS rewrite of the 18
  org-scoped tables than to retrofit.
- **SEED-005 Enhanced Document Structure (the operator-confirmed NEXT milestone) / DM**
  — document lifecycle, check-in/out, and retention are meaningless without an
  underlying backup guarantee; a "living document" loop (SEED-069) you can't recover
  is a liability.

## Why it is deferred / not now

- **Not a v2.9 concern.** v2.9 Workflow Studio ships features against the same data; it
  does not change the backup posture. Phase 101 (template-fill) inherits whatever
  guarantee exists and adds none.
- **No real exposure yet.** Today the only data at risk is operator self-test data on a
  local Supabase. The data-loss cost is ~zero until a first paying customer or a
  co-tenant tier exists — which is exactly why the re-open triggers are pinned to those
  moments, not to a calendar.
- **It is a published-artifact + responsibility-split decision, not a feature build.**
  The bulk of the value is a *document* (per-tier RTO/RPO, responsibility matrix) plus a
  *tested drill* — work that belongs at v3.1 operator-readiness / v3.2 tenancy scoping,
  co-planned with the deployment-shape and tenancy decisions it depends on (SEED-003 /
  SEED-004), not invented in isolation now.

## Likely shape if promoted

Co-plan with SEED-003 (deployment shapes / published-requirements artifact),
SEED-004 (tenancy), and the v3.2 RLS rewrite. Candidate scope, ordered:

1. **Fix the stale routing first.** Correct `SUMMARY.md:88` so backup/DR no longer
   hides behind "deferred to v3.2," and split it cleanly from retention (retention =
   v3.4 `dm_retention_policies`; backup/DR = this seed; **per-user/per-org export =
   SEED-072's portability half**, kept distinct so it isn't lost under a backup/retention
   conflation again).
2. **Define what's backed up + cadence + PITR window**, per the inventory above
   (Postgres+pgvector, Storage objects, secrets table; Redis run-buffer treated as
   DR-skippable/best-effort, consistent with the "Realtime/Redis is a hint" posture).
3. **Publish per-tier RTO/RPO + a responsibility-split matrix** (managed-Supabase PITR
   vs self-hosted `pg_dump`/WAL vs platform-owned co-tenant SaaS) — this is the
   buyer-facing deliverable that slots into SEED-003's published-requirements artifact
   and the SEED-012 operator runbooks.
4. **A tested restore drill** as an executable runbook (and, ideally, a periodically
   exercised one), proving the backup restores into a coherent system — including the
   append-only audit tables (D-09/D-10) restoring consistently with the runs they
   reference, and the encrypted secrets restoring usable.
5. **Per-org restore / export hooks** (the v3.2 slice) — co-designed with the RLS
   rewrite so org-scoped restore and the SEED-072 portability export share one
   org-scoped traversal of the 18 tables rather than two retrofits.

## Deliberately NOT in scope (when it lands)

- **Per-user / per-org data export & portability** (GDPR Art. 15/20 subject-access &
  portability, the "take your data and leave" motion) — that is a distinct
  *compliance/exit* capability; it belongs to **SEED-072** (Data-Subject Rights &
  Account Lifecycle). Backup = operational data-loss protection; export = user-facing
  portability. Keep them distinct so the conflation that buried this gap doesn't recur —
  but co-plan the org-scoped traversal once.
- **Retention/lifecycle sweeping** — that is the v3.4 `dm_retention_policies` work, not
  backup/DR.
- **Compliance certifications** (SOC 2 / ISO 27001 / GDPR DPA / HIPAA BAA) — already
  on record as acknowledged-deferred (`SUMMARY.md:86`); a backup/DR control is an
  *input* to those audits but the cert program is separate.
- **Run-resume / checkpoint durability** — already covered by v3.4 `agent_checkpoints`;
  this seed does not re-own it.
- **Building DR before the deployment shapes (SEED-003) and tenancy model (SEED-004)
  are decided** — the responsibility split is undefined until those are.

## Links

`.planning/prd-reset/PLAN.md:192-193` (asked, never routed) ·
`.planning/prd-reset/SUMMARY.md:88` (stale "DEFERRED to v3.2" — fix this line) ·
`.planning/prd-reset/MIGRATION-RESERVATIONS.md:24` + `SUMMARY.md:143` (retention is v3.4 `dm_retention_policies`, NOT backup) ·
v3.1 PROV-KEY-01 secrets table (must be in the backup set) · D-09/D-10 audit immutability (restore consistency) ·
investigation: workflow `wf_13ed5033`

**Sibling-seed map (planted 2026-06-10 batch):**
- **Compliance cluster — 072 ↔ 075 ↔ 079.** SEED-072 (Data-Subject Rights & Account
  Lifecycle) owns the *export/erasure* half and the erasure-vs-immutable-audit
  reconciliation; this seed (backup/DR) shares the same 18-table org-scoped surface and
  the same audit-immutability constraint. SEED-079 (PII detection / DLP) is the third
  member — what flows into the backup is also what flows to providers/logs. All three
  are cheaper to design alongside the v3.2 RLS rewrite than to retrofit.
- **Existing scale/deploy neighbours.** SEED-003 (deployment flexibility / published
  requirements — the home for the per-tier RTO/RPO matrix + responsibility split);
  SEED-004 (org multi-tenancy — the per-org restore model); SEED-005 (next milestone —
  document lifecycle needs the backup guarantee underneath it); SEED-012 (operator UI /
  runbooks); SEED-024 (settings/secrets unification — the secrets backup set);
  SEED-048 (embeddings SPOF) / SEED-065 (load degradation, Redis) / SEED-001 (scale
  readiness) — adjacent reliability concerns that co-plan into the same operator-readiness
  arc.

---
*Planted 2026-06-10 during Phase 101 plan-phase, from a future-milestone alignment
sweep that found the only backup/restore/DR routing the project ever had —
SUMMARY.md:88 "deferred to v3.2" — is provably unfulfilled: v3.2 ships retention, not
backup, and the actual backup/DR work fell through the cracks with no seed and no REQ.
For a B2B-first product whose vision hands infra to the buyer against PUBLISHED
requirements, a missing backup/DR story is both a hard procurement blocker and a real
data-loss exposure for any co-tenant tier the company itself operates.*
