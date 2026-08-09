# Phase 162: Personal-Org Backfill - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning

<domain>
## Phase Boundary

A **one-time data migration** (MIG-01) that silently gives every *existing* user a **personal org + default department + org-admin membership**, then **backfills `org_id`** across every user-facing table that has the column — so the Phase-163 RLS crux can go live with **zero user action and zero data loss**. **No UI, no agent-loop/provider/retrieval change** — Deep Mode byte-identical (SC#4 / ADR per-phase enforcement: no deployment tier is made harder; co-tenant and isolated both run the same backfill).

**Requirement:** MIG-01.

**In scope:**
- **One personal org per existing user** — created via the mig-104 `create_org_with_default_dept()` SECDEF helper; idempotent (gate on "user has no personal org yet"), named `"{email}'s Organization"`, `subscription_tier = NULL`, default department `'General'`, and the user seeded as `org-admin` in `org_members`.
- **Forward-looking new-user hook** — extend the existing `handle_new_user` DEFINER trigger so **future** signups also get a personal org (closes the 163→167 org-less window). Idempotent; must never break signup.
- **Batched, idempotent `org_id` backfill** across every user-facing table with an `org_id` column (see D-10), resolving owner-less child tables through their parent FK, and shared/system rows to their owner's personal org (D-09).
- **`NOT NULL` flip** on the backfilled columns — self-verifying (RAISE-guarded) so it only happens after a proven zero-NULL state (SC#2).
- Delivered as an **idempotent numbered SQL migration at slot 105**, applied via the Supabase SQL editor; `full-schema.sql` regenerated + committed same-commit.

**Out of scope (explicitly):**
- **`document_chunks` + `skill_embeddings` `org_id` + backfill** → **Phase 163** (TEN-04 — the perf-gated denormalize + composite index alongside the vector index). 162 does NOT touch these two.
- **The membership RLS rewrite of the 38 existing tables + the per-request user-JWT client swap** → **Phase 163** (the atomic crux). RLS is still service-role-bypassed during/after 162.
- **`is_global` → `is_org_shared` rename** (and the `is_system_global` allow-list) → **Phase 165**. 162 is HANDS-OFF `is_global`/`is_system` (D-04/D-05).
- **Invitation / SSO "join an existing org" paths** → **167 / 168** (they add "also join org X" on top of 162's universal personal-org).
- **Tier semantics** (what `'free'`/`'solo'`/etc. mean) → **STRETCH 170 / ENT-01**.

</domain>

<decisions>
## Implementation Decisions

### Personal-Org Identity
- **D-01:** Each existing user gets **exactly one personal org** created via `create_org_with_default_dept(p_name, p_subscription_tier, p_default_dept_name)` (mig 104, `service_role`-only SECDEF), with:
  - **name = `"{email}'s Organization"`** (always available, unique per user, recognizable in the 166 org switcher + 148 roster — no dependency on a possibly-NULL display name),
  - **`subscription_tier = NULL`** (un-opinionated + forward-safe; the `_is_tier_pro_or_higher` stub returns `True` today; STRETCH 170/ENT-01 owns the real tier vocabulary and can default/backfill personal orgs then),
  - **default department = `'General'`** (the helper default),
  - the user seeded into **`org_members` with `role = 'org-admin'`** of their own personal org.
  - Idempotency: gate personal-org creation on **"this user has no personal org yet"**; `org_members` insert is `ON CONFLICT (org_id, user_id) DO NOTHING`.

### New-User Auto-Org Hook — the 162/167 seam (research-flagged UNRESOLVED; resolved here)
- **D-02:** **Ship the forward-looking personal-org auto-create in 162** (do NOT defer to 167). Rationale: 163 is where RLS starts *enforcing*; a signup in the 163→167 window with no org would hit enforced RLS and see an empty/broken app. 162 owns closing that gap (research: "P2-BACKFILL ships the `handle_new_user`/JIT auto-org hook OR hands it to P5-SSO").
- **D-03:** **Mechanism = extend the existing `handle_new_user` DEFINER trigger** (today it inserts only a `profiles` row — `full-schema.sql:120`) to ALSO create the personal org + default dept + `org-admin` membership, reusing the same `create_org_with_default_dept()` + membership-insert logic as the batch backfill. Requirements: **idempotent** (`ON CONFLICT DO NOTHING`; gate on no-existing-personal-org) and **minimal + defensive** so a failure can never abort the `auth.users` insert (a trigger error breaks signup). Chosen over app-layer because the trigger fires for **every** new `auth.users` row regardless of entry path (email/password now, the SSO-callback path 168 adds later), atomically, and is the established pattern. **Invitations (167) / SSO JIT (168) ADD "also join org X" on top of this universal personal-org — they do not replace it.**

### `is_global` Boundary — 162 vs 165 (resolved; the one real cross-phase knot)
- **D-04:** **162 is HANDS-OFF `is_global` / `is_system`** — the backfill never renames/drops/rewrites those columns. This **closes 162's "is_global data-loss" threat by construction**: nothing is touched, so no folder/skill/view sharing can be lost.
- **D-05 (HANDOFF NOTE — binding on the 163 + 165 planners):** The value-preserving rename stays in **165**, not 162/163, because renaming the *column* forces updating **every reader simultaneously** (`folder_utils.py` recursive-visibility mirror, the Storage `skill-files` bucket policy branch, retrieval, the frontend) — which is exactly 165's bundle; pulling it earlier bloats the security-critical crux for no benefit. Consequently:
  - **163 writes its membership-RLS predicates against the CURRENT column names `is_global` / `is_system`** — the roadmap's `is_org_shared` / `is_system_global` in 163 SC#1 is **forward-naming shorthand**, not the live column name at 163-time.
  - **165 performs the single atomic value-preserving `RENAME`** (`is_global`→`is_org_shared`; `is_system`→the `is_system_global` allow-list) across the SQL column **+ all readers + 163's flag-references in lockstep**, with **164's two-org isolation suite** as the regression backstop.

### Backfill Vehicle & Proof
- **D-06:** Delivery = an **idempotent numbered SQL migration at slot 105**, applied by pasting into the Supabase SQL editor (**never** `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no `--reset`) and commit the migration + regenerated `full-schema.sql` **same-commit** (CLAUDE.md discipline; deployment-artifact parity D-16 if it becomes seed-bearing).
- **D-07:** Batching = a **stored PROCEDURE** (NOT a `DO $$ … $$` block — a `DO` block runs in a single transaction and never releases locks) that loops `UPDATE <t> SET org_id = <resolved> WHERE org_id IS NULL … LIMIT ~10000` with a **`COMMIT` between batches** (Postgres 11+ / Supabase PG15+), `CALL`ed once and then dropped. Correct at cloud scale (the lock-storm mitigation of Pitfall 7); runs fast on the tiny local DB. Low-traffic window.
- **D-08:** NOT-NULL flip = **self-verifying within the same migration**: before each `ALTER TABLE … SET NOT NULL`, a guard — `IF EXISTS (SELECT 1 FROM <t> WHERE org_id IS NULL) THEN RAISE EXCEPTION …` — plus a `SELECT` of the remaining-NULL counts so the operator sees them. The **DB enforces SC#2's "verified zero-NULL check"** (the flip is impossible on incomplete data), and the whole file is re-paste-safe.
- **D-09:** `org_id` resolution = **the owning user's personal org**, resolved **directly via `user_id`** or **transitively via the parent FK** for owner-less child tables (e.g. `messages`→`threads`, `document_images`/`document_tables`→`documents`, `message_feedback`→`messages`, `sandbox_files`/`workspace_files`/`workspace_file_versions`→their owner/run parent, `code_executions`/`pdf_extraction_runs`→their parent). **GLOBAL / shared / `is_system` resources** (global folders, the seeded `skill-creator`, global views) get their **creating user's personal org** — cross-org reach stays an **orthogonal flag** (`is_global`→`is_org_shared` in 165 / `is_system_global`), **never a synthetic "system org."** Invariant: **`org_id` = home org; sharing flag = who else sees it.**

### Scope / Table Set
- **D-10:** 162 backfills **every user-facing table that has an `org_id` column, EXCEPT** `document_chunks` + `skill_embeddings` (→ 163) and the never-swept system/identity tables (`operator_users`, `profiles`, `app_settings`, `model_capabilities_overrides`). This is the **23 tables swept by mig 104** + the **~13 already-stubbed pre-104** (`documents`, `folders`, `threads`, `skills`, `classification_rules`, `document_relationships`, `document_views`, `harness_audit`, `metadata_field_definitions`, `workflow_definitions`, `workflow_phases`, `workflow_runs`, `operator_audit_log`). **RE-VERIFY the exact live set at plan time** against `supabase/full-schema.sql` head.
- **D-11 (OPEN — planner must resolve):** `audit_log` / `operator_audit_log` (and any other table with genuinely **org-agnostic** system/operator rows) may hold rows that don't resolve to any user's org — operator actions are org-agnostic by the `operator_users` one-way-door. **The planner decides per-table whether these get the NOT-NULL flip or stay nullable.** Default lean: **keep genuinely org-agnostic audit rows nullable** (do NOT force a synthetic org onto operator/system actions) and flip `NOT NULL` only where every row is genuinely user-owned. Note the interaction with 163's RLS: a nullable-`org_id` audit table needs its 163 RLS predicate to handle `NULL` explicitly.

### Claude's / Executor's Discretion
- Exact batch size (~10k), procedure/index/constraint names, the precise parent-FK resolution joins per child table, and the per-table NOT-NULL decision (within D-11's guidance) — executor discretion, as long as SC#1–4 (MIG-01) and D-01…D-11 hold.
- Idempotency idioms (`INSERT … ON CONFLICT DO NOTHING`, gate-on-no-existing-personal-org, `WHERE org_id IS NULL`) follow mig 104's established re-paste-safe style.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The requirement + roadmap
- `.planning/REQUIREMENTS.md` — **MIG-01** (this phase's single requirement, verbatim: personal org + default dept + org-admin membership; batched ~10k idempotent `WHERE org_id IS NULL`; owner-less children via parent FK; NOT-NULL only after verified zero-NULL).
- `.planning/ROADMAP.md` — **Phase 162 detail** (SC#1–4 verbatim) + the **"Guardrails, gates & sequencing (v3.4)"** block (data-dependency order 162→163→…→165; the threat-model list; the atomic-crux lock; the personal-org/JIT seam research flag; cloud-parity owed).

### The binding ADR + prior-phase decisions
- `.planning/phases/160-tenancy-model-adr/160-ADR.md` — **D-v3.4-01**: the `is_system_global` / `is_org_shared` naming locks (relevant to D-04/D-05), slot-104+ renumbering, and the **4-tier deployment-flexibility contract** (per-phase enforcement — 162 must not make any tier harder).
- `.planning/phases/161-org-dept-role-schema/161-CONTEXT.md` — the schema decisions this phase backfills into: **D-11** (the `create_org_with_default_dept()` construction guarantee — the helper 162 calls; the trigger-vs-app-layer creation-seam explicitly deferred to *this* phase), D-01 (`organizations.settings jsonb`), D-02/D-03 (permission catalog), D-08/D-09 (the 8 new tables are correct-from-birth, excluded from 163).
- `.planning/prd-reset/DECISIONS.md` — **D-PRD-02** (co-tenant posture), **D-14** (red line: Deep byte-identical; no new runtime), **D-16** (deployment-artifact same-commit parity), the **D-v3.4-01** pointer.

### The migration this phase extends (READ — the reusable substrate)
- `supabase/migrations/104_org_dept_role_schema.sql` — **`create_org_with_default_dept()`** (the org+default-dept construction helper 162 calls; `service_role`-only per CR-01), the **23-table nullable `org_id` + btree-index sweep** (162's backfill targets), the `org_members` 4-tier `role` CHECK + the CR-02 super-admin write-floor, and the re-paste-safe idempotency idioms to mirror.
- `supabase/full-schema.sql` — **RE-VERIFY at plan time**: the live `handle_new_user` DEFINER trigger (`:120`-ish — today inserts only `profiles`; D-03 extends it), the full live `org_id`-column set (D-10), and the parent-FK graph for owner-less child tables (D-09).
- `supabase/migrations/096_org_id_stub_sweep.sql` — the 4-owned-roots stub precedent ("child tables inherit org through their parent FK — NOT stubbed"), i.e. the child-table resolution 162 now performs.

### Research base (re-authored against live schema head 103 — highest-signal for this phase)
- `.planning/research/PITFALLS.md` — **Pitfall 7** (personal-org backfill: lock storms → batching w/ COMMIT; NOT-NULL-flip ordering; `is_global` data loss; non-idempotent re-runs; the `handle_new_user` auto-org hook) and its **Recommended pattern / anti-pattern / failure-signature** rows; the risk table (`is_global` sharing lost = HIGH; duplicate orgs = MEDIUM).
- `.planning/research/SUMMARY.md` — the two-front framing; the personal-org/JIT provisioning seam flagged as MEDIUM-confidence (trigger vs app-layer vs both — resolved here as D-03).
- `.planning/research/ARCHITECTURE.md` — the 38-user-facing-table map + the 12-already-stubbed vs ~26-remaining breakdown (context for D-10).

### Project conventions
- `CLAUDE.md` — numbered-migration rules (`<digits>_name.sql`; apply via SQL editor, **NOT** `db push`/`db reset`; regenerate `full-schema.sql`; deployment-artifact same-commit parity); multi-worker (`WORKER_COUNT=2`) idempotency (the `OPERATOR_EMAILS` startup-seed precedent D-03 mirrors); cloud-parity standing rule (migrations 099–104 + `SECRETS_ENCRYPTION_KEY` owed at next prod push — **105 joins that pending set**).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`create_org_with_default_dept(name, tier, dept_name='General')`** (mig 104, `service_role`-only SECDEF) — the exact helper the batch backfill AND the extended `handle_new_user` trigger both call to create one org + its one default department atomically (D-01/D-03).
- **`handle_new_user` DEFINER trigger** (`full-schema.sql`, on `auth.users`) — today inserts only a `profiles` row; D-03 extends it to also create the personal org + membership. The idempotency + defensive-minimalism model is the Phase-146 `OPERATOR_EMAILS` startup seed (idempotent, WORKER_COUNT=2-safe).
- **The mig-104 `org_id` sweep + btree indexes** — every backfill-target column + its index already exist (nullable); 162 only populates + flips NOT-NULL.
- **`current_user_org_ids()`** (mig 104 SECDEF) — not called by 162, but the reason the backfill matters: it returns each user's org set once memberships exist, powering 163's RLS.

### Established Patterns
- **Re-paste-safe migrations** (mig 104 style) — `CREATE … IF NOT EXISTS`, `CREATE OR REPLACE`, `INSERT … ON CONFLICT DO NOTHING`, drop-guard-then-create for policies. 162 adds: gate-on-no-existing-personal-org + `WHERE org_id IS NULL` for every write.
- **Batched write with lock-release** = stored procedure + per-batch `COMMIT` (D-07) — NOT a `DO` block (single transaction).
- **`org_id` = home org, sharing flag = reach** — the tenancy invariant that keeps global/system resources single-org-owned while still cross-org visible (D-09); avoids inventing a synthetic system principal.

### Integration Points
- **None active at runtime this phase** — pure data migration; Deep Mode / agent loop / retrieval byte-identical (RLS still service-role-bypassed until 163). The one *code* touch is the `handle_new_user` trigger body (SQL, DEFINER) — signup-path adjacent, must be regression-safe.
- **Decides-in-advance for downstream:** 163 (RLS/user-JWT crux) consumes populated `org_id` + memberships + `current_user_org_ids()`; 165 renames `is_global` (D-05 handoff); 167/168 layer invitations/SSO-join onto 162's universal personal-org.

</code_context>

<specifics>
## Specific Ideas

- Personal orgs are literally named **`"{email}'s Organization"`** — not "Personal" (indistinguishable) and not display-name-derived (may be NULL).
- The batch loop MUST be a **stored procedure with `COMMIT` between ~10k-row batches**, not a `DO` block — the `DO`-block-is-one-transaction trap is the single easiest way to *think* you batched while never releasing a lock.
- The NOT-NULL flip is **guarded by a `RAISE EXCEPTION` on any remaining NULL** in the same migration — the DB, not a human eyeball, is the "verified zero-NULL check."
- Global / `is_system` resources land in their **owner's personal org**; there is deliberately **no synthetic system org**.

</specifics>

<deferred>
## Deferred Ideas

- **`is_global` → `is_org_shared` rename + `is_system_global` allow-list** → **Phase 165** (D-04/D-05). 162 is hands-off.
- **`document_chunks` / `skill_embeddings` `org_id` denormalize + composite index + backfill** → **Phase 163** (TEN-04, perf-gated).
- **Membership RLS rewrite of the 38 existing tables + per-request user-JWT client swap** → **Phase 163** (the atomic crux). RLS is still bypassed after 162.
- **Invitation / SSO "join an existing org" onboarding** → **167 / 168** — layered on top of 162's universal personal-org, never replacing it.
- **Subscription-tier semantics** (`'free'`/`'solo'`/… meaning + gating) → **STRETCH 170 / ENT-01**; 162 sets personal-org tier to `NULL`.
- **Per-table NOT-NULL decision for org-agnostic audit/operator tables** (D-11) — surfaced here as an OPEN planning item; the *planner* resolves it (default lean: keep genuinely org-agnostic rows nullable).

### Reviewed Todos (not folded)
- **`spike-nl-workflow-authoring.md`** (`todo.match-phase` score 0.6, keyword false-positive on "run, before") — **reviewed, NOT folded.** Concerns NL→visual/no-code workflow authoring ([[SEED-123]], the deferred post-v3.4 UX/no-code-builder track); no relationship to a data-migration/backfill phase. Same false-positive Phases 160/161 reviewed-and-deferred.

### Reported-bugs cross-check (MANDATORY touchpoint — result)
- **No open `surface: Agentic-RAG` reported-bug folds into Phase 162.** All ~39 open reports are chat / streaming / provider / sandbox / model-registry / frontend surface — none overlap a no-UI backend data-migration's `affected_areas`. Per the ROADMAP guardrail + CLAUDE.md filter rule, the chat-surface backlog stays OUT of v3.4 (its own post-v3.3 chat-polish phase); only **SEED-091** folds into v3.4, landing in **Phase 164** (TEN-06), not here.

</deferred>

---

*Phase: 162-personal-org-backfill*
*Context gathered: 2026-07-18*
