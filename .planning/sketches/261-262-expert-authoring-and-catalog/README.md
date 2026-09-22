---
sketch: 261-262
name: expert-authoring-and-catalog
question: "How should the Expert Card unify authoring (Phase 261) and discovery (Phase 262) across AI-drafted creation, access control, and normal-user catalog browsing without breaching G-8 or fragmenting UI?"
winner: "Unified 5-Element Expert Card + Pop-up Detail Modal + Non-Ingestion AI Drafting + Strict Visibility Grids"
tags: [experts, authoring, catalog, discovery, cards, pack-07, pack-08, pack-09, pack-10, pack-11, pack-12, pack-13, g-8]
---

# Sketch 261 & 262: The Expert Card, Authoring & Discovery Catalog

## Design Core: Why Sketch Together, Build Apart

The operator and roadmap mandated sketching Phase 261 (*An Expert You Can Author*) and Phase 262 (*An Expert You Can Discover*) together:

> *"Building them together breaches G-8; designing them apart ships two different cards."*

- **G-8 Enforcement (Build Apart)**: A plan is a wave-sized unit of work (target 3–5 plans per phase, max 6). Merging Authoring (admin CRUD, AI drafting engine, ephemeral file upload, grant tables, RLS) with Discovery (browsable catalog, search, filters, honest visibility enforcement, detail modal, 1-click execution) would create an 8–10 plan runaway phase. Overhead is per plan (worktrees, summaries, merges, gates); splitting build execution into Phase 261 then Phase 262 preserves velocity and safety.
- **Design Unification (Sketch Together)**: The **Expert Card** is the single shared visual and conceptual unit across both phases:
  - In **Phase 261 (Authoring)**: The creator needs a live reactive preview of the exact card and detail modal being authored.
  - In **Phase 262 (Discovery)**: The normal user browses a catalog of these exact cards, filters by category, and taps into the detail modal.
  - In **Phase 260 (Chat Runtime)**: The hero Spotlight Card (`ExpertSpotlightCard.tsx`) in the chat thread shares the same identity gem, scope mode badge, and 3 Action Tiles.

---

## 1. The 5-Element Visual-First Expert Card Anatomy

The Expert Card delivers immediate comprehension with **"less text, more visuals"** (zero lecturing prose on the card face):

1. **Identity & Glowing Gem**:
   - Clean vector icon gem (crisp Lucide-style SVG: Chart, Scale, Shield, Briefcase, Truck, Terminal).
   - Title (bold, high contrast, e.g. "Financial Analyzer").
   - Category Tag (`Finance & Accounting`, `Legal & Compliance`, `Platform & Dev`, `HR & Ops`).
   - Disentangled Badges:
     - **Knowledge Scope Axis**: `+ Union Scope` (Default: thread folder + expert folders searched together, S4) vs `🔒 Strict Isolation` (Opt-in: reads expert folders exclusively, ignores thread folder, S5).
     - **Access Grant Axis**: `👥 Org-Wide` vs `🛡️ Role-Gated: HR` (PACK-10) vs `👤 Named Users`.
2. **Visual Focus & Elevated Action Tiles**:
   - Lecturing paragraphs ("When to use: ...") are completely eliminated from the card face and reserved for the Pop-up Details Modal.
   - The card face is led by the glowing gem and the 3 Action Tiles.
3. **Grounded Scope Envelope**:
   - Bounded resources pills:
     - Folders: `📁 SEC 10-K & Q3`
     - Additive Tool Floor (SEED-303 S6): `🧰 ratio_calculator`, `💻 execute_code`, `📄 workspace_write`
     - Connections (Precondition check, S7): `🔌 Edgar MCP — Connected` / `HubSpot — Not connected`
4. **3 Large Visual Action Tiles (`PACK-03` / `D-260-06`)**:
   - Prominently rendered prompt triggers with vector glyphs (`📈 Q3 Revenue Growth YoY`, `⚖️ Gross Margin Comparison`, `💵 Operating Cash Flow`).
   - Immediate 1-click execution (`PACK-13`).
5. **Dual-Action Footer**:
   - `🔍 Inspect Details`: Opens the pop-up detail modal.
   - `✨ Start Chat` / `📑 Clone & Customise` (SEED-303 S8): Launches a scoped conversation or clones a canonical system template into a tenant-customized expert.

---

## 2. Phase 262: Discovery Catalog & Detail Modal

### Catalog Experience (`PACK-11`)
- **Location**:
  - Accessible via top-level navigation (`NavPanel.tsx` icon `✨ Experts`) and via the composer `+` menu (`✨ Browse Expert Catalog...`).
- **Toolbar & Filtering**:
  - Full-text search over name, description, when-to-use, and member tools.
  - Category pills: `All`, `Finance & Accounting`, `Legal & Compliance`, `Platform & Dev`, `HR & Ops`.
- **Honesty Rule (`PACK-11`)**:
  - A normal user sees **every Expert they may actually use, and none they may not**.
  - A catalog advertising locked Experts is a brochure for a locked door. If Jane Doe does not hold the HR grant, the "Executive Compensation Advisor" card does not appear.
- **Clone-on-Customise (SEED-303 S8)**:
  - System templates (e.g. Financial Analyzer) are immutable; clicking "Clone & Customise" creates an editable tenant-scoped expert row bound to the client's own folders.

### Pop-Up Detail Modal (`PACK-12` & `PACK-13`)
Because the application has **no client-side router** (all navigation is state-based in `App.tsx`), the pop-up modal sidesteps router dependencies entirely while fulfilling the operator's ask:
- **Header**: Icon gem, name, category, scope mode badge (`Union Scope` / `Strict Isolation`), template provenance (`System Template` vs `Org Custom`).
- **What it does**: Comprehensive functional explanation.
- **When to use it**: Specific scenarios and triggers (relocated here from card face to preserve calm card layout).
- **Knowledge Scope**: Bounded folders with document count indicators. Under `Strict Isolation`, surfaces the honest cost notice: *"Reads [Folder] only; documents in this chat's folder will not be used."*
- **Tools & Skills**: Bound skills and external MCP connectors, highlighting the additive deliverable tool floor (`execute_code`, `workspace_write`, `render_template`, `ask_user` per SEED-303 S6).
- **One-Click Action Prompts**: 3 Action Tiles with 1-click run (`PACK-13`).
- **Sample Deliverable Output**: Collapsible preview showing a representative Markdown table or structured analysis.
- **Primary CTA**: `✨ Start Scoped Chat with Expert` / `➕ Invite into Current Thread`.

---

## 3. Phase 261: Authoring Studio & AI-Assisted Drafting

### AI-Assisted Drafting (`PACK-09`)
- Reuses the `generate_workflow` / `workflow_authoring.py` architectural seam.
- **Brainstorm File Upload**:
  - Creator can upload reference PDFs, SOPs, or schemas to brainstorm the draft.
  - **Honesty Guarantee**: Explicitly badged in the UI:
    > *"🛡️ Uploaded brainstorm files are analyzed ephemerally in a sandbox to synthesize this draft row. They are NEVER silently ingested into your permanent knowledge library and will be discarded after drafting unless explicitly attached to a folder."*
- **Draft Row Review**:
  - AI emits a **DRAFT ROW** (never auto-publishes).
  - Creator edits every field in the form while a live preview of the Expert Card updates synchronously on the right.

### Manual Configurator (`PACK-07`)
- Full CRUD over `/experts`:
  - Name, slug, icon, category, when-to-use, description.
  - **Knowledge Scope Selector**: `Union Scope` (Default: thread folder + expert folders) vs `Strict Isolation` (Opt-in: expert folders exclusively).
  - **Tool Floor Preservation (SEED-303 S6)**: Explicit toggle preserving artifact/deliverable generation tools (`execute_code`, `workspace_write`, `render_template`, `ask_user`).
  - Resource multi-pickers: folders, skills, connections.
  - Action Tiles editor (icon, title, full prompt).

### Access & Grants Model (`PACK-10`)
- **Who may author is DATA (`PACK-08`)**:
  - Gated via `role_permissions(role, 'experts:manage')`, checking `super-admin`, `org-admin`, etc.
- **Access Grants (`PACK-10`)**:
  - Visibility levels:
    - `org`: Available to all members of the organization (`👥 Org-Wide`).
    - `roles`: Restricted to specific roles (`🛡️ Role-Gated`, e.g. `['org-admin', 'hr']`).
    - `users`: Restricted to specific user UUIDs (`👤 Named Users`).
    - `private`: Creator only.
- **Runtime Binding Invariant**:
  - Zero `if expert:` branches inside `agent_loop.py` (`PACK-01`, `EXT-01`).
  - Knowledge union, scope mode, and tool floors resolve upstream in `run_producer.py` and arrive strictly as generic `RunContext` fields.

---

## 4. Schema & Data Model: Migration 189

The current `public.expert_bundles` table (Migration 187) lacks presentation fields and granular grant relationships. Migration 189 resolves both:

```sql
-- Migration 189: Presentation fields & access grants
ALTER TABLE public.expert_bundles
  ADD COLUMN IF NOT EXISTS icon text NOT NULL DEFAULT 'chart',
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS when_to_use text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS example_output text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tool_floor_enabled boolean NOT NULL DEFAULT true;

-- Granular access grants table (PACK-10)
CREATE TABLE IF NOT EXISTS public.expert_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expert_id uuid NOT NULL REFERENCES public.expert_bundles(id) ON DELETE CASCADE,
  grantee_type text NOT NULL CHECK (grantee_type IN ('user', 'role')),
  grantee_id text NOT NULL, -- user uuid or role slug
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_expert_grant UNIQUE (expert_id, grantee_type, grantee_id)
);

CREATE INDEX IF NOT EXISTS idx_expert_grants_lookup 
  ON public.expert_grants (grantee_type, grantee_id, expert_id);

ALTER TABLE public.expert_grants ENABLE ROW LEVEL SECURITY;
```

---

## 5. Operator Decision Points for Ratification

1. **Catalog Navigation Home (Phase 262)**:
   - **Option A (Recommended)**: Dedicated top-level nav item `✨ Experts` in `NavPanel.tsx` (view: `"experts"` in `ActiveView`), plus mid-thread summon via composer `+` menu (`✨ Browse Expert Catalog...`).
   - **Option B**: Modal-only discovery from Chat (no new nav item in `NavPanel.tsx`).
2. **Access Model Scope (Phase 261)**:
   - **Option A (Recommended)**: Role + User grants via `expert_grants` table (allows "HR-only", "Finance-only", or specific user access).
   - **Option B**: Coarse visibility only (`org` vs `private`).
3. **Approval Lifecycle**:
   - **Option A (Recommended)**: Admin Save publishes directly (no multi-stage review gauntlet needed for initial authoring).
   - **Option B**: Explicit "Draft" vs "Published" toggle on bundle rows.
