# Phase 261: An Expert You Can Author - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning

<domain>
## Phase Boundary

An org-admin authors an Expert inside the application — naming it, selecting its skills, connections, and knowledge scope, brainstorming the draft with AI from ephemerally uploaded files, and configuring granular access grants for specific roles or users (`PACK-07`, `PACK-08`, `PACK-09`, `PACK-10`). The phase also resolves the runtime desync and additive tool floor defects identified in `BUG-260920-01` and ratified under `D-v4.3-01` and `D-v4.3-02` (`SEED-303`).

### In Scope

- **PACK-07 (In-App Management Surface)**:
  - Dedicated "Experts" tab inside `OrgAdminShell.tsx`.
  - Full CRUD operations calling existing `/experts` endpoints (`POST`, `GET`, `PATCH`, `DELETE`).
  - Ability to edit title, slug, icon (SVG glyph), category, when-to-use, description, scope mode, tools, member folders, skills, connections, and 3 Action Tiles.
- **PACK-08 (Data-Driven Authoring Permissions)**:
  - Authoring permission checked via `role_permissions(role, 'experts:manage')`.
  - Migration 189 seeds `experts:manage` for `super-admin` and `org-admin`.
  - AST single-home fence ensures no second hardcoded role check exists, driven RED against a planted check.
- **PACK-09 (AI-Assisted Drafting & Ephemeral Brainstorming)**:
  - Brainstorming service reuses `forced_emit` substrate to generate candidate `ExpertDraftOutput`.
  - Emits a **DRAFT ROW** that the human reviews and edits before saving (never auto-publishes).
  - Uploaded brainstorm files are parsed ephemerally in-memory; strictly **NOT** ingested into permanent `documents` or `chunks`.
  - UI displays explicit non-ingestion guarantee badge.
  - Closed-core inventory fence asserts 7 phase types, 1 emitter, 29 tools, `EXPERT_CORE_TOOLS` 10.
- **PACK-10 (Granular Role & User Access Grants)**:
  - Migration 189 creates `public.expert_grants` table with RLS.
  - Grants support `grantee_type IN ('user', 'role')` and `grantee_id`.
  - Access resolution: users outside the granted roles/users cannot see or invite the Expert.
- **BUG-260920-01 & SEED-303 Resolution (Ratified D-v4.3-01 / D-v4.3-02)**:
  - Default knowledge composition is **Union** (`scope_mode='biased'`), combining thread folder + expert folders.
  - Strict isolation (`scope_mode='restricted'`) is opt-in and states its cost upfront at invite time.
  - `scoped_folder_path` is synchronized with effective folders to prevent prompt/retrieval desync.
  - Additive tool floor preserves deliverable-producing tools (`execute_code`, `workspace_write`, `render_template`, `ask_user`).
  - Strictly zero `if expert:` branches inside `agent_loop.py`.

### Out of Scope

- Client-side URL Router (`/experts/<slug>`): Deferred to dedicated routing infrastructure phase.
- Discovery catalog for normal users: Reserved for Phase 262.
- Multi-agent concurrent execution on a single thread: Single active consultant invariant holds.

</domain>

<decisions>
## Implementation Decisions

### 1. Visual-First 5-Element Card & Disentangled Axes
- **D-261-01: Shared 5-Element Card Locked (G-2).**
  Authoring studio features a live reactive preview of the exact 5-element Expert Card locked in the G-2 sketch, ensuring zero design divergence across 260, 261, and 262.
- **D-261-02: Disentangled Vocabulary.**
  - Knowledge Scope Axis: `+ Union Scope` (Default, S4) vs `🔒 Strict Isolation` (Opt-in, S5).
  - Access Grant Axis: `👥 Org-Wide` vs `🛡️ Role-Gated: <Role>` vs `👤 Named Users`.

### 2. Permissions & Data-Driven Authoring (PACK-08)
- **D-261-03: Data-Driven Authoring Permission Gate.**
  `POST /experts`, `PATCH /experts/{id}`, and `DELETE /experts/{id}` are guarded by `require_expert_manage`, which evaluates `_has_org_permission(..., 'experts:manage')` against `role_permissions`.
- **D-261-04: Single-Home Fence.**
  AST fence `test_261_single_expert_authoring_gate.py` asserts all expert mutations route through the single permission helper, driven RED against a planted check.

### 3. AI Drafting & Ephemeral Brainstorming (PACK-09)
- **D-261-05: Non-Ingesting AI Drafting Service.**
  Endpoint `POST /experts/draft` extracts text from uploaded brainstorm documents in memory, invokes `forced_emit` with `ExpertDraftOutput`, and discards the files.
- **D-261-06: Human-in-the-Loop Review.**
  The AI drafting response populates the authoring form as a draft row. The human creator reviews and edits before manually saving.

### 4. Granular Access Grants (PACK-10 & Migration 189)
- **D-261-07: Migration 189 Schema.**
  - Extends `expert_bundles` with `icon`, `category`, `when_to_use`, `example_output`, `tool_floor_enabled`.
  - Creates `public.expert_grants` table with compound unique index and RLS.
  - Seeds `role_permissions` for `experts:manage`.
- **D-261-08: Grant Enforcement.**
  `list_experts_service` and `resolve_expert_bundle` evaluate `expert_grants` for the caller's user UUID and role, filtering out inaccessible bundles.

### 5. Runtime Scoping & Additive Floor (BUG-260920-01 / D-v4.3-01 / D-v4.3-02)
- **D-261-09: Union Composition by Default.**
  In `run_producer.py`, when `scope_mode == 'biased'`, `effective_folder_ids` unifies thread folder with expert folders. `scoped_folder_path` is updated cleanly.
- **D-261-10: Additive Tool Floor.**
  Deliverable tools (`execute_code`, `workspace_write`, `render_template`, `ask_user`) are retained in `effective_tools` so experts can produce artifacts and compute answers.

</decisions>

<canonical_refs>
## Canonical References

### Project Rules & Architecture
- `AGENTS.md` — Agent roles and durable bus coordination.
- `CLAUDE.md` — Closed-core invariants and hot-file ledger rules.
- `.planning/PROJECT.md` — Ratified milestone decisions `D-v4.3-01` and `D-v4.3-02`.
- `.planning/seeds/SEED-303-an-expert-adds-scope-it-does-not-replace-it.md` — Usage vs binding separation and scenarios S1–S8.

### Design Contract
- `.planning/sketches/261-262-expert-authoring-and-catalog/README.md` — 5-element card anatomy and visual-first design guidelines.
- `.planning/sketches/261-262-expert-authoring-and-catalog/index.html` — Interactive component prototype.
- `.planning/sketches/MANIFEST.md` — Sketch registry entry.

### Database & Migrations
- `supabase/migrations/187_expert_bundles.sql` — Table `expert_bundles`.
- `supabase/migrations/188_expert_chat_scoping.sql` — Scoping column on threads.
- `supabase/migrations/189_expert_presentation_and_grants.sql` (to be created) — Presentation columns, `expert_grants` table, and `role_permissions` seed.
</canonical_refs>
