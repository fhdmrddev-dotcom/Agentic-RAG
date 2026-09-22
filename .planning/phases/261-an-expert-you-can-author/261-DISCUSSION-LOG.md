# Phase 261: An Expert You Can Author - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered and ratified decisions.

**Date:** 2026-09-20
**Phase:** 261-an-expert-you-can-author
**Areas discussed:** Access & Grant Model, AI Drafting & Brainstorm Uploads, Runtime Scoping & Tool Floor (BUG-260920-01 / SEED-303), Authoring UI Home.

---

## Area 1: Access & Grant Model (PACK-08 / PACK-10)

| Option | Description | Selected |
|--------|-------------|----------|
| Granular Role + User Grants Table (Migration 189) | Migration 189 adds `public.expert_grants` table (`grantee_type IN ('user', 'role')`) with RLS. Who may author is data (`role_permissions(role, 'experts:manage')`), seeded for `super-admin` and `org-admin`. | ✓ |
| Coarse visibility only (`org` vs `private`) | Reuses existing `visibility` column without granular role/user targeting. Cannot support "HR-only" or "Finance-only" experts. | |

**User's choice:** Granular Role + User Grants Table (Migration 189).
**Notes:** D-261-02 and D-261-03 locked. Satisfies PACK-08 (data-driven authoring gate) and PACK-10 (role/user access restrictions).

---

## Area 2: AI Drafting & Brainstorm Uploads (PACK-09)

| Option | Description | Selected |
|--------|-------------|----------|
| Ephemeral in-memory drafting with non-ingestion guarantee | Creator uploads brainstorm files; text is extracted in-memory to synthesize a draft row via `forced_emit`. Files are NEVER ingested into permanent knowledge base (`documents`/`chunks`). Emits draft row for human review/edit. | ✓ |
| Ingest files to temp folder in knowledge base | Ingests brainstorm files into a hidden system folder and runs vector search. Risks polluting the corpus and leaking into other chats. | |

**User's choice:** Ephemeral in-memory drafting with non-ingestion guarantee.
**Notes:** D-261-04 and D-261-05 locked. Fulfills PACK-09 while protecting corpus integrity.

---

## Area 3: Runtime Scoping & Additive Tool Floor (BUG-260920-01 / SEED-303)

| Option | Description | Selected |
|--------|-------------|----------|
| Union by default + Additive Tool Floor (Ratified D-v4.3-01 & D-v4.3-02) | Binding != usage. Thread folder + expert folders compose by union (`scope_mode=biased`). Strict isolation (`scope_mode=restricted`) is opt-in and states cost at invite. Deliverable tools (`execute_code`, `workspace_write`, `render_template`, `ask_user`) are preserved as an additive floor. Zero `if expert:` branches in `agent_loop.py`. | ✓ |
| Total replacement of tools and folders | Strips 21 of 31 tools and wipes out thread folder retrieval, disabling deliverable production. | |

**User's choice:** Union by default + Additive Tool Floor (Ratified D-v4.3-01 & D-v4.3-02).
**Notes:** D-261-07 locked. Formally closes BUG-260920-01 and fulfills SEED-303 (S4, S5, S6).

---

## Area 4: Authoring Studio UI Home (PACK-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated "Experts" tab in `OrgAdminShell.tsx` | Mounted as a live tab in `OrgAdminShell.tsx` (the org-admin home reached via indigo shield). Includes list, CRUD actions, and full authoring studio with live 5-element reactive card preview. | ✓ |
| Floating modal from Chat only | Limits authoring to a modal without a dedicated administrative management surface. | |

**User's choice:** Dedicated "Experts" tab in `OrgAdminShell.tsx`.
**Notes:** D-261-08 locked. Fulfills PACK-07 using existing application navigation patterns.
