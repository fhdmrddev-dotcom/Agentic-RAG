# Phase 259: An Expert Is a Bundle, Not a Runtime - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-19
**Phase:** 259-an-expert-is-a-bundle-not-a-runtime
**Areas discussed:** Scope Semantics (Operator Decision #3), Thread Concurrency (Operator Decision #4), Database Modeling (Migration 187), Cross-Org Member Security (PACK-04 / SEED-125), Entitlement Enforcement (PACK-06), Authoring vs. Installation (Operator Decision #5).

---

## Operator Decision #3: Scope Semantics (Restrict vs. Bias)

| Option | Description | Selected |
|--------|-------------|----------|
| Declared per Expert (`scope_mode: 'restricted' \| 'biased'`) | Default to 'restricted' for high-governance domains (e.g. Financial Analyzer where out-of-scope tools and docs are refused), but allow 'biased' for general assistant personas that prioritize member assets while retaining baseline agent tools | ✓ |
| Strict Restriction Only | Selecting an Expert strictly locks the scope — the agent can only invoke member skills, required connections, and search within member folders | |
| Biasing / Priming Only | An Expert injects system prompt instructions and primes member skills/folders to top priority, but never disarms or excludes standard tools | |

**User's choice:** Declared per Expert (`scope_mode: 'restricted' | 'biased'`)
**Notes:** D-259-01 locked. Resolves Operator Decision #3.

---

## Operator Decision #4: Thread Concurrency (Single Active vs. Multiple)

| Option | Description | Selected |
|--------|-------------|----------|
| Single Active Expert per Thread (Strict 1:1) | A chat thread can bind at most one active expert (`threads.expert_id uuid REFERENCES expert_bundles`). Avoids contradictory system prompts, tool conflict explosion, and ambiguous attribution | ✓ |
| Multiple Active Experts per Thread (`threads.expert_ids uuid[]`) | A thread can combine multiple experts simultaneously, merging their skills, connections, and folders additively | |

**User's choice:** Single Active Expert per Thread (Strict 1:1)
**Notes:** D-259-02 locked. Resolves Operator Decision #4.

---

## Database Modeling (PACK-01 / Migration 187)

| Option | Description | Selected |
|--------|-------------|----------|
| Relational Core Table with Structured Member Arrays/JSONB | Table `expert_bundles` with name, slug, description, scope_mode, member_skills (text[]), required_connections (text[]), knowledge_folder_ids (uuid[]), prompt_suggestions (jsonb), visibility, is_system, and org_id with RLS. Clean, fast O(1) reads without multi-table join overhead | ✓ |
| Normalized Multi-Table Schema | Table `expert_bundles` plus separate junction tables (`expert_skills`, `expert_connections`, `expert_folders`) | |

**User's choice:** Relational Core Table with Structured Member Arrays/JSONB
**Notes:** D-259-03 locked. Migration 187 will implement this table structure.

---

## Cross-Org Tenancy Defense (PACK-04 / SEED-125)

| Option | Description | Selected |
|--------|-------------|----------|
| Two-Phase Member Boundary Check (Bundle RLS + Independent Member Evaluation) | Resolving an Expert verifies the bundle row, then independently evaluates each referenced skill, connection, and folder against the caller's active org_id. Foreign org member references are stripped and logged with a security audit event, never passed to runtime. Driven RED against a planted cross-org member reference | ✓ |
| Strict Bundle Rejection | If ANY member reference (skill, connection, folder) belongs to another org and is not a system resource, the entire bundle lookup is rejected with HTTP 403 Forbidden | |

**User's choice:** Two-Phase Member Boundary Check
**Notes:** D-259-04 locked. Defense against SEED-125 leak pattern.

---

## Entitlement Enforcement (PACK-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Full Entitlement Gating on Expert API via Phase 258 | Wire `require_capability('experts')` across Expert endpoints (creation, listing, updating, selection). Standard orgs receive structured HTTP 403 naming 'enterprise' tier and upgrade hint. Zero ad-hoc tier checks | ✓ |
| Gate Creation / Authoring Only | Allow all tiers to list and inspect built-in experts, but require 'experts' capability to create custom experts or bind an expert to a chat thread | |

**User's choice:** Full Entitlement Gating on Expert API via Phase 258
**Notes:** D-259-05 locked. Fulfills PACK-06.

---

## Operator Decision #5: Install vs Author (RAISED AT REVIEW, ANSWERED 2026-09-20)

⚠ **This decision was never asked during discuss-phase** — it appears nowhere above, neither
asked nor deferred. **Migration 187 had already answered it implicitly** (`is_system` + `org_id`,
a reference model with no install or copy path). Surfaced by the independent review and put to the
operator rather than left encoded by accident — the same failure mode `SEED-294` describes for
pricing metrics, one subsystem over.

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only reference | A client org points at the first-party Expert and cannot change it. Updates are pushed centrally and reach everyone. What migration 187 already built. | ✓ |
| Editable copy on install | The org receives its own copy to edit; needs a copy-on-install mechanism plus a `source_bundle_id` column. Your later updates stop reaching anyone who customised. | |
| Defer to Phase 260 | Leave open but written down as deliberately deferred. | |

**User's choice:** Read-only reference — decided now, not deferred.
**Notes:** D-259-06 locked. Confirms the shape migration 187 already carries, so **no schema change
is owed**. ⚠ If customisation is ever wanted, it is an **additive** migration (a copy mechanism
plus provenance column), not a rewrite — recorded so a future phase does not treat it as blocked.

---

## Claude's Discretion

- First-party Financial Analyzer seed details: Prompt suggestions and schema parameters configured in Migration 187 (`is_system = true`).
- Inventory fence design: Using an AST parser to assert closed registries in `phase_types.py`, `tool_dispatcher.py`, and `emitters.py`.

---

## Deferred Ideas

- **Phase 260**: Chat thread integration, picker modal, and onboarding chips (`PACK-02`, `PACK-03`, `PACK-05`).
- **SEED-244**: Agency-agents 230+ persona catalog expansion deferred to future milestone.
