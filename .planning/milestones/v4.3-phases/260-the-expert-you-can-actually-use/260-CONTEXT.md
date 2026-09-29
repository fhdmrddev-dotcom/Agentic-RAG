# Phase 260: The Expert You Can Actually Use - Context

**Gathered:** 2026-09-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Selecting an Expert in a chat thread **visibly scopes that thread** (retrieval and tools) and guides onboarding via "Try asking…" prompt action tiles. Proves the complete slice end-to-end with the first-party Financial Analyzer, answering from documents or refusing, driven as a real conversation against real documents (`PACK-02`, `PACK-03`, `PACK-05`).

### In Scope
- **PACK-02 (Thread Scoping & Legibility)**:
  - Invite an Expert mid-thread from the existing composer `+` menu.
  - Active Expert renders as a dismissible chip `[✨ Financial Analyzer · Restricted ✕]` in the existing `Using:` chips row (`data-testid="active-connector-chips"`) with subtle ambient violet composer glow.
  - Migration 188: Adds `active_expert_id uuid REFERENCES public.expert_bundles(id) ON DELETE SET NULL` to `public.threads`.
  - Scoping is resolved as data handed to `RunContext` prior to `run_agent_loop`, restricting `folder_subtree_ids` and `active_tools` while preserving conversation history. Zero `if expert:` branches inside `agent_loop.py` (`PACK-01` / `EXT-01` red line).
  - Dismissing via `✕` sets `threads.active_expert_id = NULL` and returns the composer and thread to neutral general scope.
- **PACK-03 (Onboarding Affordance & "Try asking…")**:
  - Implementation of the operator-ratified **G-2 Option 1 (Action Tiles)**:
    - Zero lecturing prose.
    - Hero visual spotlight card with glowing icon gem and clean identity tags (`[📁 SEC Filings]`, `[🧰 ratio_calculator]`, `[Restricted]`).
    - 3 large, tappable visual Action Tiles (`📈 Q3 Revenue Growth YoY`, `⚖️ Gross Margin Comparison`, `💵 Operating Cash Flow`).
    - Immediate 1-click execution: Tapping a tile sends the message immediately and starts the agent run.
- **PACK-05 (First-Party Financial Analyzer Proof Slice)**:
  - Migration 188 seeds a dedicated sample financial folder (`Financial Reports & SEC Filings`) containing a real 10-K/earnings document fixture, populates `knowledge_folder_ids` in `financial-analyzer`, and bundles ratio calculation skills.
  - Answers financial inquiries with grounded document citations.
  - Explicitly refuses out-of-scope queries (e.g. non-financial questions) under Phase 185 graded governance.
  - Verified by live conversation testing against real documents.

### Out of Scope
- URL Routing (`/experts/<slug>`): Deferred to a dedicated phase to keep `App.tsx` byte-fenced.
- New composer top-level controls: UI budget is strictly zero new top-level controls.
- Custom Expert Authoring & Catalog Directory UI (Phase 261 / post-v4.3).
- Multiple concurrent active experts on a single thread.

</domain>

<decisions>
## Implementation Decisions

### 1. Consultant Interaction Model (D-259-07 Ratification)
- **D-260-01: Mid-Thread Invitation & Sticky Presence.**
  An Expert is a consultant invited into an existing or new thread. It remains active until explicitly dismissed via the `✕` button on the composer chip.
- **D-260-02: Zero New Composer Controls.**
  - The invite trigger lives inside the existing `+` dropdown menu alongside attachment doors and connectors (`✨ Invite Expert...`).
  - The active Expert renders inside the existing `Using:` chips container (`data-testid="active-connector-chips"`) as a sibling to `ActiveConnectorChips` and file attachment chips.
  - An ambient violet/indigo frame glow decorates the composer border while an Expert is active.
- **D-260-03: Scoping Semantic (Retrieval & Tools Only).**
  The Expert scopes document retrieval (`folder_subtree_ids`) and available tools (`available_tools`). It never truncates or masks conversation history; the model retains full context of what was said prior to invitation.

### 2. Thread Persistence & Agent Loop Seam (Area 1)
- **D-260-04: Durable Thread-Level Persistence (Migration 188).**
  `public.threads` gains `active_expert_id uuid REFERENCES public.expert_bundles(id) ON DELETE SET NULL`. Inviting updates `threads.active_expert_id`; dismissing via `✕` sets it to `NULL`. State survives page refreshes, tab changes, and cross-device sessions.
- **D-260-05: Closed-Core Seam Architecture (No `if expert:` in `agent_loop.py`).**
  In `run_producer.py` (or message dispatch setup), if `threads.active_expert_id` is present, `expert_service.resolve_expert_bundle` resolves the effective folders and tools. The resolved scoping is passed directly as data fields (`effective_folder_ids`, `effective_tools`) into `RunContext`. `run_agent_loop` simply applies the provided context data, keeping `agent_loop.py` strictly closed-core with zero `if expert:` branches (`PACK-01` / `EXT-01`).

### 3. Action Tiles Onboarding & 1-Click Dispatch (Area 2)
- **D-260-06: Ratified G-2 Option 1 (Action Tiles) UI.**
  - Stream announcement renders a hero spotlight card featuring the Expert icon gem, title, and visual scope badges.
  - Zero lecturing prose.
  - 3 large, tappable visual Action Tiles (`PACK-03`).
- **D-260-07: Immediate 1-Click Send.**
  Clicking an Action Tile immediately posts the prompt text to the thread and starts the agent run, providing instant, frictionless onboarding.

### 4. Financial Analyzer Seed & Real Documents (Area 3 / PACK-05)
- **D-260-08: Migration 188 First-Party Knowledge & Skill Population.**
  Migration 188 creates a system knowledge folder with a real sample financial 10-K/earnings document, populates `financial-analyzer.knowledge_folder_ids` with this folder UUID, and links financial calculation skills.
- **D-260-09: Live Conversation Proof (PACK-05).**
  Financial Analyzer is driven as a real conversation:
  1. Answering a financial question (e.g. Q3 revenue growth / EBITDA) with verified document citations.
  2. Answering a follow-up calculation question.
  3. Refusing an out-of-scope query (e.g. employee vacation policy) honestly without hallucinating.

### Claude's Discretion
- Visual styling tokens for the ambient violet glow on the composer frame matching the existing Tailwind/theme variables.
- Specific icon choices for the 3 Action Tiles (`📈`, `⚖️`, `💵`).
- Exact payload structure of `effective_folder_ids` / `effective_tools` inside `RunContext`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Rules & Architecture
- `AGENTS.md` — Agent roles, bus coordination protocol, and review separation.
- `CLAUDE.md` — Hot-file ledger (G-5) and closed-core invariant rules.
- `.planning/phases/259-an-expert-is-a-bundle-not-a-runtime/259-CONTEXT.md` — Phase 259 bundle architecture, RLS policies, and entitlement gating.
- `.planning/phases/259-an-expert-is-a-bundle-not-a-runtime/259-DISCUSSION-LOG.md` — `D-259-07` consultant model foundation and rationale.

### G-2 Sketch & Design Contract
- `.planning/sketches/260-the-expert-you-can-actually-use/README.md` — Sketch 260 design question, variants, and operator ratification.
- `.planning/sketches/260-the-expert-you-can-actually-use/index.html` — Interactive component prototype of Option 1 (Action Tiles).
- `.planning/sketches/MANIFEST.md` — Sketch registry with row 260 marked as ratified winner.

### Database & Migrations
- `supabase/migrations/187_expert_bundles.sql` — Table `expert_bundles` and initial `financial-analyzer` seed.
- `supabase/migrations/188_expert_chat_scoping.sql` (to be created) — `threads.active_expert_id` column and financial knowledge/skill population.
- `backend/app/db/experts.py` — Database queries for expert bundles.

### Backend Services & Seam
- `backend/app/services/expert_service.py` — `resolve_expert_bundle` two-phase member boundary and cross-org scrubbing.
- `backend/app/services/run_producer.py` — Pre-loop setup and `RunContext` construction.
- `backend/app/services/agent_loop.py` — Closed-core agent loop (receives data; zero `if expert:` branches).
- `backend/app/services/tool_dispatcher.py` — `ToolContext` carrying `folder_subtree_ids` and `available_tools`.

### Frontend Chat Components
- `frontend/src/components/chat/MessageInput.tsx` — Composer with `+` menu and chips container.
- `frontend/src/components/chat/ActiveConnectorChips.tsx` — Precedent for active chip rendering in composer.
- `frontend/src/components/chat/ChatArea.tsx` — Thread message stream where spotlight card and action tiles render.
- `frontend/src/types/index.ts` — Type definitions for threads and experts.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/components/chat/MessageInput.tsx`: Existing `+` menu (`DropdownMenuContent`) and `Using:` chips row container (`data-testid="active-connector-chips"`).
- `backend/app/services/expert_service.py::resolve_expert_bundle`: Resolves bundle members and strips unauthorized resources under multi-tenant isolation.
- `backend/app/services/tool_dispatcher.py::ToolContext`: Already carries `folder_subtree_ids: list[str] | None` and `available_tools: list[str]`.
- `backend/app/services/agent_loop.py::RunContext`: Frozen dataclass for stable per-run inputs.

### Established Patterns
- **Closed Core Registries**: Never modify `phase_types.py` or `agent_loop.py` with feature-specific branch conditions.
- **Additive RunContext Inputs**: Previous phases (092, 133, 135) added inputs to `RunContext` with default-off/neutral values.
- **Fail-Closed Tenancy**: Expert member assets are verified against active tenant org before being handed to execution.

### Integration Points
- `supabase/migrations/188_*.sql`: Next sequential migration slot.
- `backend/app/api/threads.py`: Thread PATCH / GET endpoints supporting `active_expert_id`.
- `frontend/src/components/chat/MessageInput.tsx`: Mount `✨ Invite Expert...` in `+` menu and `ActiveExpertChip` in chips row.
- `frontend/src/components/chat/ChatArea.tsx`: Render `ExpertSpotlightCard` with Action Tiles when Expert joins.

</code_context>

<guardrails>
## Hot-File Ledger & Guardrail Dispositions (G-5)

### 1. `frontend/src/components/chat/MessageInput.tsx`
- **Measured Triple**: `32 commits / 16 phases / 876 lines`.
- **Disposition**: Extract `ActiveExpertChip` and `InviteExpertItem` into dedicated leaf components (`frontend/src/components/chat/ActiveExpertChip.tsx`, `frontend/src/components/chat/InviteExpertDialog.tsx`). `MessageInput.tsx` only renders the extracted components within existing slots.

### 2. `frontend/src/components/chat/ChatArea.tsx`
- **Measured Triple**: `76 commits / 37 phases / 796 lines`.
- **Disposition**: Extract `ExpertSpotlightCard.tsx` (containing the Hero card and Action Tiles) into a separate modular component; `ChatArea.tsx` imports and places it when an active expert event or thread start is detected.

### 3. `backend/app/services/agent_loop.py`
- **Measured Triple**: `108 commits / 49 phases / 3442 lines`.
- **Disposition**: **Zero logic branches.** Scoping is passed into `RunContext` as pre-resolved data. `agent_loop.py` consumes `ctx.effective_folder_ids` / `ctx.effective_tools` directly in existing assignment points without adding any `if expert:` conditions.

</guardrails>

<specifics>
## Specific Ideas

- **Option 1 Action Tiles**: Minimalist, visual-forward UI with high typography clarity, vibrant icon gems, and zero preaching text.
- **One-Click Trial**: User clicks `[📈 Q3 Revenue Growth YoY]` -> query immediately executes and answers with citations from the seeded 10-K document.

</specifics>

<deferred>
## Deferred Ideas

- **URL Routing (`/experts/<slug>`)**: Dedicated phase for app router infrastructure.
- **Custom Expert Authoring Studio**: Org-created bundles and marketplace (Phase 261 / post-v4.3).
- **Multi-Expert Thread Collaboration**: Multiple experts participating in a single conversation.

</deferred>

---

*Phase: 260-the-expert-you-can-actually-use*
*Context gathered: 2026-09-20*
