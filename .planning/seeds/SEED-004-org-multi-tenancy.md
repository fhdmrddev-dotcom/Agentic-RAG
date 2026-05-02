---
id: SEED-004
status: dormant
planted: 2026-05-02
planted_during: v2.5 (after Phase 059 ship, before Phase 060 kickoff)
trigger_when: planning a v3.x or later milestone scoped to "tenancy", "organizations", "teams", "departments", "RBAC", "roles", "enterprise", or any milestone that touches the per-user data model or the global-vs-private folder visibility model
scope: Large
---

# SEED-004: Org / Department / Role Multi-Tenancy

## Why This Matters

Today the visibility model is a binary: data is either **per-user** (private, owned by `user_id`) or **global** (shared with every authenticated user via the `is_global` flag on folders). This is enough for a single user or a tiny team where everything-shared and everything-private cover all cases. It is not enough for any real organization.

Real organizations have:

- **Departments** (Legal, HR, Engineering, Finance, …) with disjoint document sets and disjoint relevance contexts
- **Roles within departments** (analyst, manager, reviewer, admin) with different read/write permissions on the same documents
- **Cross-department visibility** that is neither global nor private — e.g., an HR policy document that all employees can read but only HR can edit
- **Different document types per department** (Legal sees contracts; Finance sees invoices; Engineering sees specs) — and each type benefits from different ingestion, different metadata, different retention rules
- **Department-targeted skills and automations** — "summarize this contract per Legal's review template" should be available to Legal users without polluting Engineering's catalog, and vice versa

The deferred memory note (`project_org_level_deferred.md`) and the PROJECT.md "Out of Scope" row already acknowledge this is coming but unresolved. What that note does **not** capture, and what this seed adds:

- Departments and roles are a separate axis from "isolated vs co-tenant" — even a single-org install needs intra-org structure
- Skill/automation deployment is org-aware: a skill built by Legal for Legal should not appear in Engineering's catalog (today everything global is global to everyone)
- The data model needs to support both "small org with no departments" (single dept, default) and "large org with many" without a schema rewrite between them — this is a v1 design decision, not a v2 evolution

## When to Surface

**Trigger:** planning a milestone with scope or description mentioning any of:
- "tenancy" / "multi-tenant" / "tenants"
- "organizations" / "orgs"
- "teams" / "departments" / "groups"
- "RBAC" / "roles" / "permissions"
- "enterprise" (deployment context — pair with SEED-003)
- Any change to the `is_global` flag on folders
- Any change to per-user RLS that breaks the assumption "user_id = auth.uid()"
- Any user-facing requirement to "show me documents for my team" / "give my department its own skills"

This seed should be surfaced **alongside** SEED-003 (deployment flexibility) when the milestone is "enterprise" — they intersect at the deployment-shape level (isolated-tenant deployments are packaged differently from shared-tenant deployments).

## Scope (when triggered)

This is a multi-phase milestone (probably 6–10 phases). Likely scope:

1. **Tenancy model decision (D-tenant)**
   Resolve the deferred decision in `project_org_level_deferred.md`:
   - **Isolated**: each org gets its own Supabase project (or its own schema). Strong isolation, simple RLS, harder cross-org ops, more infra per org.
   - **Co-tenant**: shared schema, `org_id` partitioning everywhere, RLS via membership. Simpler infra, harder isolation guarantees, requires careful query review.
   - **Hybrid**: free / small orgs co-tenant; enterprise orgs isolated. Most flexible, most complex.

   This decision shapes everything else and must come first. Recommend structured ADR with concrete tradeoffs against current and projected scale.

2. **Org / Department / Role data model**
   Once tenancy is decided:
   - `organizations` (id, name, settings, …)
   - `departments` (id, org_id, name, parent_id for nesting if needed, …)
   - `roles` (id, org_id or system, name, permission_set)
   - `org_memberships` (user_id, org_id, dept_id?, role_id, …)
   - Migration strategy from current per-user model (every existing user becomes a single-member single-dept org? Or stays user-scoped with org-scoped optional?)

3. **RLS shift**
   - From `user_id = auth.uid()` to org/dept/role membership checks
   - Retire `is_global` on folders — replace with org-scoped + dept-scoped + role-scoped visibility
   - Audit every `SECURITY DEFINER` RPC (e.g., `match_document_chunks`) for tenancy correctness — they currently bypass RLS by design
   - Cross-tenant query isolation guarantees (no `org_id` predicate in WHERE = bug, not feature)

4. **Document type taxonomy per department**
   - Departments declare which document types they own (Legal: contracts, NDAs, policies; Finance: invoices, contracts, statements)
   - Document type drives default ingestion settings (chunk size, metadata schema, embedding model preference)
   - Department + document type drives default routing on upload ("Legal user uploads a PDF → suggest Contracts folder by default")

5. **Department-targeted skill & automation deployment**
   This is the part that does **not** exist today and is genuinely new architectural work:
   - Skills get an `availability` field: `private` (the user) | `department` (specified depts) | `org` (all depts in the org) | `global` (truly cross-org, system skills only — like `skill-creator`)
   - Skill catalog injection becomes org/dept-aware (composes naturally with SKILL-01/02 — relevance-based filtering — so the catalog is "skills available to me, filtered by relevance to this query")
   - Automations (whatever shape they take by then — likely scheduled or trigger-based skill runs) inherit the same availability model
   - Skill marketplace within the org: HR publishes a skill to all employees; Legal publishes a skill only to Legal; an analyst builds a personal skill that stays personal

6. **Roles-based admin UX**
   - Org admin: manages org settings, departments, members, billing
   - Dept admin: manages dept settings, members within dept, dept skills
   - Member: uses the app; visibility scoped by membership
   - Audit log already exists per-user; extend to per-org-admin view

7. **Org-level audit & compliance**
   - The current Out of Scope row says "Org-level audit / SIEM integration — Single-user audit sufficient; no multi-tenant yet" — this milestone flips that
   - Org admin sees audit log across all org members (not cross-org)
   - Optional SIEM export if enterprise demand emerges

## Why This Seed Avoids Doing It Now

This is the largest single architectural shift in the project's future. Premature commitment costs:

- The tenancy model decision is one-way — once isolated-vs-co-tenant ships, migrating between them is painful
- Skill catalog architecture (full-inject today, planned relevance-filtering in Skill Studio) interacts with availability filtering. Doing both at once is a bigger surface than doing relevance first, then layering availability on a working foundation
- Document management features (SEED-005) intersect with departments (e.g., dept-specific retention rules, dept-specific approval workflows) — better to land DM features against a single-tenant model first, then extend, than to design DM and tenancy simultaneously
- Deployment story (SEED-003) needs to know whether it's packaging an isolated-tenant install or a co-tenant SaaS — but doesn't need to know yet

The right time is **after** Skill Studio (SEED-002) ships and SKILL-01/02 are resolved, **after** SEED-005 ships at least basic DM features against the existing tenancy model, and **before or alongside** the SEED-003 deployment milestone.

## Companion Documents

- `.planning/PROJECT.md` — Out of Scope: "Multi-tenancy / Org-level transform: Requires clarity on isolated vs co-tenant architecture and auth/billing model" — this seed addresses both halves
- `.planning/PROJECT.md` — Out of Scope: "Organisation-level audit view / SIEM integration" — folded into this seed
- `.planning/PROJECT.md` — Out of Scope: "Team-based folder sharing with access controls", "Folder-level permissions" — replaced by org/dept/role visibility model when this seed triggers
- Memory: `~/.claude/projects/C--Vibe-Apps-Agentic-RAG/memory/project_org_level_deferred.md` — captures the deferred schema decision; this seed extends it with departments + roles + skill availability
- `.planning/seeds/SEED-002-skill-studio-milestone-prep.md` — Skill Studio resolves SKILL-01/02 (relevance filtering). This seed adds availability filtering on top.
- `.planning/seeds/SEED-003-deployment-flexibility-install-ux.md` — packaging story depends on tenancy model
- `.planning/seeds/SEED-005-document-management-capabilities.md` — DM features should land against single-tenant first, then extend with dept-awareness here

## Decision Triggers

Surface this seed during `/gsd:new-milestone` if any of the following are true:
- Milestone version is v3.x or later AND scope mentions tenancy, orgs, teams, departments, roles, RBAC, or enterprise
- A user/customer asks for departmental visibility, role-based access, or "skills only my team can see"
- Any planning conversation considers changing the `is_global` flag semantics
- A deployment / packaging milestone (SEED-003) is being scoped — surface together
- An enterprise sales/partnership conversation requires a tenancy story

## Notes

**Suggested entry plan when this seed surfaces:**

1. **Phase 0 — ADR for tenancy model decision (D-tenant)**: structured comparison of isolated / co-tenant / hybrid against concrete projected scale, expected cross-org features (likely none), ops burden, and pricing model. Half a phase, mostly research and writing.

2. **Phase 1 — Schema foundation**: organizations, departments, roles, memberships tables. Migration that turns every existing user into a single-member single-dept "personal" org so nothing breaks. RLS still per-user but layered on top.

3. **Phase 2 — RLS shift to membership-based**: this is the risky one. Should be its own phase with its own verification harness. Audit every `SECURITY DEFINER` RPC.

4. **Phase 3 — `is_global` retirement**: replace with org-scoped folder visibility. Existing global folders become "system" or are migrated into a "default" org. This is data migration, not just code.

5. **Phase 4 — Skill availability model**: depends on Skill Studio's relevance filtering being in place (SEED-002). Layer availability on top: private / department / org / global.

6. **Phase 5 — Admin UX**: org admin, dept admin, member roles. Settings UI gets a new tier above end-user settings (operator/admin scope).

7. **Phase 6 — Org-level audit view**: extend existing per-user audit to per-org-admin view.

**Why surface this distinct from SEED-003:**
SEED-003 is about *how* we ship the app to different deployment shapes. SEED-004 is about *who* uses it once shipped and how their data is isolated. They intersect at the enterprise tier but are independently planable: a single-org install still needs departments; a co-tenant SaaS still needs deployment packaging for the SaaS itself.

**The genuinely-new piece:**
Department-targeted skill & automation deployment (item 5 in scope) is not in PROJECT.md, not in memory, not in any existing seed. This is the part of your message that triggered a new seed rather than just refining an existing decision. Worth pulling forward as a discussion topic when this seed surfaces — it has real implications for the Skill Studio data model.

---
*Planted 2026-05-02 between Phase 059 ship and Phase 060 kickoff. User flagged that the deferred multi-tenancy note (`project_org_level_deferred.md`) covers schema isolation but not departments, roles, document-type taxonomy by department, or department-targeted skill/automation deployment. Those four are genuinely new architectural work and need to be on the seed roster, not just floating in conversation memory.*
