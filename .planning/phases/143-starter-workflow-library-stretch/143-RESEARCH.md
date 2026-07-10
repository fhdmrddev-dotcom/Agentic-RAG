# Phase 143: Starter Workflow Library (WF-01, STRETCH) - Research

**Researched:** 2026-07-10
**Domain:** Curated content authoring on existing workflow primitives + one additive shelf section + a fresh-copy fork path (React/FastAPI/Supabase; no new runtime)
**Confidence:** HIGH (all mechanics verified against live code + the live local DB + storage)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim)
- **D-143-1 (fresh personal copy — RED-LINE correctness):** Forking a starter creates a brand-new workflow the caller owns — a NEW auto-generated slug (`<starter-slug>-<short-hash>`), `version = 1`, `created_by = caller`, `is_global = false`. A DISTINCT fork path, NOT the existing same-slug Tweak→`v(N+1)`. Driver: `workflow_definitions_slug_version_unique UNIQUE(slug, version)` (mig 056) is global across all users.
- **D-143-1a (fork UX):** Auto-suffix the slug (no name prompt) and open the copy in the Builder to edit/rename — SAME landing as today's Tweak. Reuses `createWorkflowDraft` + `setBuilderInitial` → `pageView="builder"` in `WorkflowsPage.tsx` (`onTweak`), differing only in slug/version.
- **D-143-2 (curated JSONB marker):** Seeded starters carry `definition.category = 'starter'`. Starters shelf renders `status='published' AND is_global=true AND definition->>'category'='starter'` — a JSONB-path predicate mirroring the `definition->>'project_folder_id'` precedent. No new column, no expression index, zero migration to the table.
- **D-143-2a (hide 5 dev scaffolds + de-dupe):** The 5 mig-061 scaffolds lack the marker → absent from Starters. End state: Published shelf = `created_by=me` only; Starters = curated global. (Planner: new endpoint/param vs client split — Claude's discretion, subject to that end state.)
- **D-143-3 (3 starters — promote 2 + author 1):** Risk Register (from `pm-risk-register`), Weekly Status Report (from `pm-weekly-status-report`), Compliance Gap Report (fresh).
- **D-143-3a (all 3 KB→document, NOT template-fill; none needs a user-uploaded template).** ⚠️ **See Pitfall 1 — this decision's premise conflicts with the live source-row shape and must be reconciled at plan time.**
- **D-143-3b ("promote" = copy into a seed, not flip user rows):** Copy the definition JSONB into the seed as a system-owned (`created_by=<system seed user>`), `is_global=true`, `status='published'`, `category='starter'` row. Do not flip the user's own rows.
- **D-143-4 (seed-migration authoring):** Author starters as SQL seed-INSERTs mirroring mig 061 verbatim. Apply via Supabase SQL editor (never `db push`/`db reset`), then regenerate `full-schema.sql`.
- **D-143-4a (trusted seed, manual run check — NOT gauntlet-enforced):** Seeded starters bypass the 8-stage publish gauntlet by construction. Trust model: author + manually run each starter once during UAT.
- **D-143-5 (Starters on top + fold BUG-260628-01):** Starters shelf at the TOP of the Workflows page. Fix the shelf sort so runnable published/starters aren't buried under drafts (status-aware / published-first ordering).
- **D-143-6 (competitor-gallery research directive — additive):** Study how established products present starter/template galleries + clone-vs-fork UX (n8n, Activepieces, Zapier, Gumloop, Glean, beam.ai). Findings inform shelf layout, fork-affordance copy, and the `category` taxonomy — they do NOT expand scope. **→ See "State of the Art — Competitor Gallery Findings".**

### Claude's Discretion (verbatim)
- Exact slug-suffix scheme (short hash vs counter) and the Builder header caption for a forked starter — cleanest consistent-with-Tweak approach.
- Whether the starters query is a new endpoint (`GET /workflows/starters`), a query param on the existing published endpoint, or a client-side split — subject to the D-143-2a end state.
- The Compliance Gap Report starter's exact phase composition — author it on existing primitives to a credible, runnable shape.

### Deferred Ideas (OUT OF SCOPE)
- Run-time template/file upload → SEED-110 (v3.3 phase candidate). The Run modal has no file input.
- Workflow delete + cascade → SEED-111.
- Forked-from-starter provenance (lineage tracking).
- Growing the starter library beyond 3.
- BUG-260610-01 (workflow run nav timer / duplicate avatar) — run surface, not the shelf. Left open.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WF-01 | A curated set of fork-able starter workflows available on the Workflows page as an `is_global` published shelf; users fork a starter into a personal draft instead of starting from a blank description. No new runtime — one shelf section + content authoring. | Fork path = a small delta on the existing `onTweak`/`createWorkflowDraft` flow (verified). Curated shelf = one JSONB-path query mirroring the `project_folder_id` precedent (verified). Content = seed-INSERT + storage-seed mirroring `seed-pm-pack.py` (verified precedent). Sort fold = JSX section reorder (verified). **The only non-trivial work is re-homing the bound templates + stripping private folder binding so a forker's run actually works — see Pitfall 1.** |
</phase_requirements>

## Summary

This phase is **content authoring + one additive shelf + a fresh-copy fork path**, all on primitives that already ship. There is no new engine, no new table, no new provider surface. Every mechanic the CONTEXT locked (JSONB-path curation, seed-INSERT authoring, immutability freeze, the fresh-copy fork) is verified sound against the live code, the live local Postgres (:54322), and live Storage.

**One finding materially changes the shape of the work.** The two "promote" source rows (`pm-risk-register`, `pm-weekly-status-report`) are NOT the template-free "KB→document" workflows D-143-3a assumes. They are two-phase `llm_agent(search_documents) → llm_emit(render_template)` **template-fill** workflows, each bound to (a) a `.docx` template that lives in **the operator's private Storage prefix** (`d8a54002…/_library/…`) and (b) a **hardcoded private project folder** (`1564da7e…`, "PM Demo Project", owned by that same operator). `render_template` is the **only** registered emitter — there is no template-free file-producing path. Copying these definitions verbatim into a global seed (the literal "copy its definition JSONB" instruction) would produce starters that (1) reach into one real user's Storage for their template and (2) scope retrieval to a folder no forker can see, so a forker's run returns zero evidence and the strict `citations_required` gate **fails the run**. That breaks Success Criterion "a fork runs end-to-end."

**Primary recommendation:** Keep the honest "→document" path (there is no other), but treat "promote" as a **transform, not a copy**: for each seeded starter (1) strip `project_folder_id` and every per-phase `folder_scope` so retrieval runs over the forker's own KB; (2) re-home the template `.docx` to the **seed-system-user** prefix (`00000000-0000-0000-0000-000000000001/_library/<slug>.docx`) and repoint `assets[].asset_id` there; (3) set `created_by=<seed user>`, `is_global=true`, `status='published'`, `category='starter'`. This requires a **storage seed** (upload 3 `.docx` files) in addition to the SQL seed — a SQL migration alone cannot place Storage bytes. The exact precedent for all of this already exists in `scripts/seed-pm-pack.py` (which is how the source rows were seeded in the first place). Separately, do **not** blanket-narrow the shared `list_published_workflows` helper for D-143-2a — it also feeds the composer Harness picker + the run-surface soul; scope the narrowing with a param used only by the Workflows-page Published shelf.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Curated starter identity (`is_global`, `category='starter'`) | Database / seed migration | — | mig 056 RLS forbids app-level `is_global=true`; only a seed (SQL-editor superuser) can set it. Hard constraint, not a choice. |
| Starter template bytes | Database / Storage (`workspace-files` bucket) | Seed script | `render_template` resolves the template by raw Storage path; the bytes must physically exist at the seeded path. |
| Starters shelf query | API / Backend (`db/workflows.py` + `api/workflows.py`) | — | RLS-mirroring read; the JSONB predicate lives in the DB layer, the endpoint is a thin delegate. |
| Published-shelf de-dupe (mine-only) | API / Backend (scoped param) | Frontend (which shelf calls which) | Must NOT change the shared helper's default (picker/run-soul depend on global rows). |
| Fresh-copy fork | Frontend (`WorkflowsPage.tsx`) | API (`POST /workflows` — unchanged) | The fork is a client-constructed definition (new slug + v1); the existing create route already forces `is_global=false`/`draft`/`created_by`. |
| Shelf ordering (BUG-260628-01) | Frontend (`WorkflowsPage.tsx` JSX section order) | — | The bug is section order (drafts shelf above runnable), not a within-list sort. |
| Starter card render | Frontend (`PublishedCard` + `WorkflowSoul scale="card"`) | — | Reuse existing card chrome + soul atoms; no new card component (G-2 sketch waived). |

## Standard Stack

**No new libraries.** This phase ships entirely on the installed stack. All "stack" items below are already present and verified in use.

### Core (all existing)
| Component | Where | Purpose | Why standard |
|-----------|-------|---------|--------------|
| `workflow_definitions` table + RLS + immutability trigger | `supabase/migrations/056_workflow_definitions.sql` | The substrate a starter row lives in | The only place `is_global` starters can exist [VERIFIED: mig 056:55-57, 81-99] |
| `llm_agent` → `llm_emit(render_template)` phase types | `backend/app/models/harness.py`, `backend/app/services/harness/emitters.py` | The KB→document composition | `render_template` is the ONLY registered emitter [VERIFIED: emitters.py:61,183] |
| `seed-pm-pack.py` seed pattern | `scripts/seed-pm-pack.py` | Upload template `.docx` to `{uid}/_library/` + DELETE-then-INSERT published defs | The exact mechanic that seeded the two source rows [VERIFIED: script header + upload_template:292-311] |
| `PublishedCard` + `WorkflowSoul(scale="card")` | `frontend/src/pages/WorkflowsPage.tsx`, `frontend/src/components/workflows/WorkflowSoul.tsx` | Starter card render | Shared soul atoms; no new card design [VERIFIED] |
| `onTweak` fork flow | `WorkflowsPage.tsx:151-177` | The fork-into-Builder landing to adapt | Fresh-copy fork = a small delta (new slug + v1) [VERIFIED] |
| python-docx template authoring | `scripts/pm-pack/make_pm_templates.py` | Author the fresh Compliance Gap Report `.docx` | Reproducible, Pitfall-4-safe docxtpl authoring precedent [VERIFIED] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `render_template` (needs a template) | A template-free file emitter | **Does not exist** — `EMITTER_REGISTRY` has exactly one entry. Building one is new runtime (RED LINE). Rejected. |
| llm_emit → document | `llm_agent` + `execute_code` writing a `.docx` via python-docx in the sandbox | Loses the citation/integrity gates + the honest soul "produces: file" derivation; a weaker, un-gated pattern. Rejected. |
| Bound library template | Chat-answer starters (no `llm_emit`) | Genuinely template-free, zero storage seed — but the soul reads "produces: answer in chat", not "→document". A real fallback if the user wants to drop templates entirely (see Open Question 1). |

## Package Legitimacy Audit

**N/A — this phase installs no external packages.** No `npm install`, no `pip install`, no new dependency of any ecosystem. All code sits on already-installed libraries (React/Vite/shadcn, FastAPI/asyncpg/Supabase, python-docx/docxtpl already in the sandbox image). The slopcheck / registry-verification gate does not apply. If the planner later decides to add a helper (not anticipated), run the Package Legitimacy Gate then.

## Architecture Patterns

### System Architecture Diagram

```
AUTHORING (one-time, operator-run seed)
  scripts/pm-pack/templates/*.docx (committed, reproducible via make_pm_templates.py)
  + a NEW compliance-gap-report.docx (author fresh, python-docx)
        │  upload (service-role Supabase client)
        ▼
  Storage: workspace-files bucket  →  00000000-…-01/_library/<slug>.docx   ← re-homed to SEED USER
        │
  SQL seed migration (supabase/migrations/<next>_starter_workflows.sql)
        │  DELETE-then-INSERT (immutability trigger blocks UPDATE of published rows)
        ▼
  workflow_definitions rows:  is_global=true, status='published',
                              created_by=<seed user>, definition.category='starter',
                              assets[].asset_id → seed-user template path,
                              project_folder_id=NULL, no folder_scope   ← STRIPPED

READ / SHELF (per user, live)
  WorkflowsPage.tsx
    ├─ GET /workflows/starters ──────► list_starter_workflows(pool)
    │     status='published' AND is_global=true AND definition->>'category'='starter'
    │     → Starters shelf (TOP)
    ├─ GET /workflows/published?scope=mine ──► list_published_workflows(owned_only=true)
    │     status='published' AND created_by=$1        (drops the bare is_global)
    │     → Published shelf (mine only)   ← de-dupes scaffolds + starters
    └─ GET /workflows/drafts ──────────► Drafts & seeds shelf (mine, + Build-card)

  (unchanged) composer Harness picker + WorkspacePanel run-soul + threads.py kickoff
     still call list_published_workflows WITHOUT scope → keep global rows

FORK (per user, live)
  Starter card "Use this starter" ─► onUseStarter(starter)
     forked = { ...starter.definition, slug: `${slug}-${shortHash}`, version: 1, status: 'draft' }
     createWorkflowDraft(forked)  ──► POST /workflows
        create_workflow_definition() forces is_global=false, status='draft', created_by=caller
     setBuilderInitial({ definition: forked, draftId, label }) → pageView='builder'
        → forker edits their OWN copy; the published starter row stays frozen

RUN (per user, live — unchanged engine)
  Fork → Publish (own gauntlet) → Run  OR  run a forked draft after publish
     retrieve: search_documents over the FORKER's KB (no hardcoded folder_scope)
     emit: render_template resolves the seed-user template (service-role Storage read)
```

### Recommended Project Structure (files this phase touches)
```
supabase/migrations/
  └── <next>_starter_workflows.sql   # NEW — 3 seed-INSERT rows (category='starter')
scripts/
  └── seed-starters.py               # NEW (or extend seed-pm-pack.py) — upload 3 .docx + DELETE-INSERT
scripts/pm-pack/templates/
  └── compliance-gap-report.docx     # NEW — authored via a make_*_templates.py-style builder
backend/app/db/workflows.py          # + list_starter_workflows(); + owned_only param on list_published_workflows
backend/app/api/workflows.py         # + GET /workflows/starters; + scope=mine on GET /workflows/published
frontend/src/lib/api.ts              # + listStarterWorkflows(); listPublishedWorkflows(scope?)
frontend/src/pages/WorkflowsPage.tsx # + Starters shelf (top) + onUseStarter fork + section reorder (BUG fold)
```

### Pattern 1: JSONB-path curation predicate (mirror the shipped precedent)
**What:** Filter published globals to starters via a `definition->>'category'` predicate — zero migration to the table.
**When:** The Starters shelf query.
**Example:**
```python
# backend/app/db/workflows.py — mirrors the project_folder_id JSONB precedent (workflows.py:197)
async def list_starter_workflows(pool: asyncpg.Pool) -> list[dict]:
    """Curated global starters (the Starters shelf). No user scope: is_global rows are
    world-readable by the mig-056 SELECT policy; category='starter' narrows to curated."""
    rows = await pool.fetch(
        "SELECT id, slug, name, definition FROM workflow_definitions "
        "WHERE status = 'published' AND is_global = true "
        "AND definition->>'category' = 'starter' "  # $-free literal is fine (constant, not user input)
        "ORDER BY name"
    )
    return [dict(r) for r in rows]
```

### Pattern 2: Scoped narrowing (NOT a blanket change) for the Published shelf de-dupe
**What:** Add an `owned_only` param so the Workflows-page Published shelf shows mine-only, while the shared picker/run-soul keep global rows.
**Why:** `list_published_workflows` has 3 consumers that NEED global rows (see Pitfall 3).
**Example:**
```python
# db/workflows.py — additive param; default False keeps every existing caller byte-identical
async def list_published_workflows(pool, *, user_id, project_folder_id=None, owned_only=False):
    if owned_only:
        sql = "SELECT id, slug, name, definition FROM workflow_definitions WHERE status='published' AND created_by = $1"
    else:
        sql = "SELECT id, slug, name, definition FROM workflow_definitions WHERE status='published' AND (is_global = true OR created_by = $1)"
    # …project_folder_id AND-append + ORDER BY name unchanged…
```
```typescript
// WorkflowsPage.tsx Published shelf → listPublishedWorkflows(projectArg, { ownedOnly: true })
// composer picker / WorkspacePanel → listPublishedWorkflows(...)  (no ownedOnly — keep globals)
```

### Pattern 3: Fresh-copy fork (the small delta on onTweak)
**What:** Mint a brand-new owned workflow (new slug + v1) instead of a same-slug v(N+1).
**Example:**
```typescript
// WorkflowsPage.tsx — a sibling of onTweak. The ONLY deltas: new suffixed slug + version:1.
const onUseStarter = useCallback(async (starter: PublishedWorkflow) => {
  const def = (starter.definition ?? {}) as Record<string, unknown>
  const shortHash = Math.random().toString(36).slice(2, 8)      // discretion: hash vs counter
  const forked = { ...def, slug: `${starter.slug}-${shortHash}`, version: 1, status: "draft" } as WorkflowDefinitionJSON
  try {
    const created = await createWorkflowDraft(forked)            // POST /workflows forces is_global=false/draft/created_by=caller
    await refetchDrafts()
    setBuilderInitial({ definition: forked, draftId: created.id, label: `From starter · ${starter.name}` })
    setPageView("builder")
  } catch (e) {
    // 409 UniqueViolation (astronomically unlikely hash collision) → retry with a fresh hash.
    console.error("[WorkflowsPage] starter fork failed", e)
  }
}, [refetchDrafts])
```

### Anti-Patterns to Avoid
- **Copying the source `definition` JSONB verbatim into the seed** — carries the private folder binding + private template path → non-runnable for forkers (Pitfall 1). "Promote" is a transform.
- **Blanket-narrowing `list_published_workflows` to `created_by=me`** — regresses the composer picker, the run-surface soul, and threads.py kickoff (Pitfall 3).
- **Assuming the SQL migration alone seeds a runnable starter** — the template bytes must be uploaded to Storage separately (Pitfall 1 / Runtime State Inventory).
- **UPDATE-ing a published starter row to re-author it** — the immutability trigger raises `23514`; use DELETE-then-INSERT (Pitfall 4).
- **A hardcoded slug allowlist for the shelf** — drifts from the DB; the `category` marker is the chosen mechanism (D-143-2).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Set `is_global=true` from the app | A new "publish as global" route / RLS relaxation | A seed migration (SQL-editor superuser) | mig 056 RLS `WITH CHECK is_global=false` reserves globals to seeds [VERIFIED 056:55-57]. An app path here is a security regression. |
| Produce a document deliverable | A bespoke doc generator / execute_code writer | `llm_emit(render_template)` + a bound template | The only gated, honest file path; new emitters are new runtime (RED LINE). |
| Upload the template bytes | Base64-in-SQL / manual Word authoring | `seed-pm-pack.py`'s `upload_template()` + python-docx builder | Proven byte-round-trip seed; python-docx templates are Pitfall-4-safe. |
| Author the starter card | A new StarterCard component | `PublishedCard` + `WorkflowSoul(scale="card")` | Shared soul; G-2 sketch waived. Add at most an "Official/Starter" chip. |
| Fork into an owned copy | A new fork endpoint | `createWorkflowDraft` (existing `POST /workflows`) | Already forces `is_global=false`/`draft`/`created_by` server-side [VERIFIED workflows.py:288-289]. |
| De-dupe scaffolds from the page | Deleting/altering the mig-061 rows | The `category` marker + a scoped Published query | Non-destructive; scaffolds still serve the composer picker. |

**Key insight:** Every "build" in this phase is really a "reuse + a tiny delta." The one genuinely new artifact is a single `.docx` template (Compliance Gap Report) and a seed script — both have exact precedents in the repo.

## Runtime State Inventory

> This is a **seed/promote/rename-shaped** phase. A SQL migration seeds rows; it does NOT seed Storage bytes or fix folder ownership. All five categories answered explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | Two source `workflow_definitions` rows in the live DB: `pm-risk-register` v1 (published) and `pm-weekly-status-report` v1 + v3 (published), both `is_global=false`, `created_by=d8a54002…` (the operator's own account). Each `definition.assets[0].asset_id` points at `d8a54002…/_library/<slug>.docx`; each hardcodes `project_folder_id` + per-phase `folder_scope = 1564da7e…` ("PM Demo Project", owned by d8a54002). [VERIFIED: live :54322 query] | **Data migration (transform-on-copy):** into the seed row — strip `project_folder_id`, remove every `folder_scope`, repoint `assets[].asset_id` to the seed-user path, set `created_by=<seed user>`, `is_global=true`, `category='starter'`. Do NOT copy verbatim. |
| **Live service config (state not in git)** | Storage: `workspace-files` bucket objects under `_library/` exist ONLY under `d8a54002…` (3 objects; 2 are the PM templates). Bucket `public=false` (RLS-protected). [VERIFIED: storage.objects + storage.buckets query] | **Storage seed:** upload `risk-register.docx`, `weekly-status-report.docx` (both committed at `scripts/pm-pack/templates/`) and the new `compliance-gap-report.docx` to `00000000-…-01/_library/<slug>.docx` via a service-role client (mirror `seed-pm-pack.py:upload_template`). A SQL migration cannot do this. |
| **OS-registered state** | None — no cron, no Task Scheduler, no pm2/systemd registrations touched by this phase. Verified: phase is web-app content only. | None. |
| **Secrets / env vars** | None renamed. The seed script reads `SUPABASE_URL` / service-role key / DB DSN NAME-ONLY from `backend/.env` (same as `seed-pm-pack.py`); no new secret, no key rename. | None (reuse the existing name-only bootstrap). |
| **Build artifacts / installed packages** | `supabase/full-schema.sql` (the single-file bootstrap artifact) will drift once the new seed migration is applied. python-docx/docxtpl already installed (sandbox image + backend venv). | **Regenerate** `full-schema.sql` via `bash scripts/regenerate-full-schema.sh` (no `--reset`) AFTER applying the migration; commit both (CLAUDE.md rule). |

**The canonical question — after every repo file is updated, what runtime state still holds the old shape?** The template `.docx` bytes (must be uploaded to the seed prefix) and the folder/ownership binding inside the copied JSONB (must be stripped). Both are invisible to a grep of the migration file.

## Common Pitfalls

### Pitfall 1: "Promote = copy the definition JSONB" produces starters that don't run for forkers  ⚠️ HIGHEST IMPACT
**What goes wrong:** The two source rows are `llm_agent(search_documents) → llm_emit(render_template)` template-fill workflows bound to (a) a template in the operator's private Storage prefix and (b) a private `project_folder_id`/`folder_scope` (`1564da7e…`). Copied verbatim into a global seed, a forker's run scopes `search_documents` to a folder they can't see → zero retrieved evidence → the strict `citations_required` validator (`on_failure: fail_run`) **fails the run**. The template also silently depends on one real user's Storage.
**Why it happens:** D-143-3a's premise ("KB→document, NOT template-fill, no template needed") does not match the live rows. `render_template` is the ONLY emitter — every file-producing workflow IS template-fill. The nuance the CONTEXT likely intended is "no *run-time uploaded* template" (SEED-110); the template is instead *bound in the definition* — but a bound template still has to physically exist at a resolvable, non-private path.
**How to avoid:** Treat promote as a transform (strip folder binding, re-home template, set curation fields) + add the Storage seed. Verify each starter runs end-to-end during UAT against a KB that actually contains matching content (the PM demo corpus is the natural fixture).
**Warning signs:** A seeded starter's `definition` still contains `project_folder_id` or `folder_scope`, or an `asset_id` beginning with a real user UUID rather than `00000000-…-01`.

### Pitfall 2: A starter run over an empty KB fails by strict-citation design
**What goes wrong:** Even after fixing folder binding, a forker whose KB has no relevant documents gets `citations_required` → `fail_run`. This looks like a broken starter but is the honest strict-gate behavior.
**Why it happens:** The source workflows set `citation_policy: strict` + `citations_required(on_failure=fail_run)` — correct for a grounded deliverable, unforgiving of an empty KB.
**How to avoid:** For UAT (D-143-4a "run each once"), run against a KB with content. Document to users that starters retrieve from *their* knowledge base. Optionally consider `citation_policy: flag` for starters (delivers with visible gaps rather than failing) — a product judgment for the planner/user (Open Question 2).
**Warning signs:** Every starter UAT run fails at the emit phase with a citations block on a fresh/empty account.

### Pitfall 3: Blanket-narrowing `list_published_workflows` regresses the picker + run-soul
**What goes wrong:** D-143-2a says "drop the bare `is_global`". Doing that in the shared DB helper removes global rows from the composer Harness picker, the run-surface soul recovery (`WorkspacePanel.tsx` → `listPublishedWorkflows`), and the `threads.py` kickoff resolution — all of which need to see global scaffolds/starters.
**Why it happens:** `list_published_workflows` is consumed in 3 places, not just the Workflows page. [VERIFIED: `threads.py:51`, `api/workflows.py:126`, `WorkspacePanel.tsx:125`]
**How to avoid:** Add an `owned_only`/`scope=mine` param (default off) used ONLY by the Workflows-page Published shelf. Keep the default (global OR mine) for everyone else.
**Warning signs:** The composer Harness dropdown or a running global workflow's soul goes blank after the change.

### Pitfall 4: The immutability trigger blocks re-authoring a published seed row
**What goes wrong:** A second `supabase` seed apply, or an attempt to correct a starter, that UPDATEs a `status='published'` row raises Postgres `23514` (`workflow_definitions_block_published`).
**Why it happens:** mig 056's trigger freezes any published row [VERIFIED 056:81-99].
**How to avoid:** Make the seed idempotent with a FIXED uuid + `ON CONFLICT (id) DO NOTHING` (mig 061 pattern), OR use DELETE-then-INSERT (the `seed-pm-pack.py` pattern) when re-authoring during development. Never UPDATE a published starter.
**Warning signs:** `CheckViolationError` / `23514` on re-apply.

### Pitfall 5: Slug/version uniqueness on the fork
**What goes wrong:** The fresh-copy fork mints `<slug>-<hash>` v1; a hash collision (or a re-fork producing the same suffix) hits `UNIQUE(slug, version)` → the create route returns 409 [VERIFIED workflows.py:243-250].
**Why it happens:** `UNIQUE(slug, version)` is global [VERIFIED 056:29].
**How to avoid:** Use a random short hash (collision ~1 in 2B for 6 base36 chars); on the 409 the client already surfaces, retry with a fresh hash. Keep both the top-level columns and the in-JSONB `slug`/`version` in agreement (create_workflow_definition binds `definition.slug`/`definition.version`).
**Warning signs:** A 409 on fork; two forks with the same suffix.

### Pitfall 6: BUG-260628-01 is a section-order bug, not a within-list sort
**What goes wrong:** Trying to "sort" cards inside a shelf won't fix it — the whole Drafts shelf `<section>` renders before the Published `<section>` [VERIFIED WorkflowsPage.tsx:350-413].
**How to avoid:** Reorder the JSX sections: Starters (top) → Published (runnable, mine) → Drafts & seeds (mine, holds the Build-card). This is the "published-first" ordering D-143-5 asks for. Keep the Build-card discoverable (it currently lives in the Drafts shelf — consider also a header "Build a workflow" affordance if pushing Drafts down hurts create-discovery; minor UX call).
**Warning signs:** Published still below drafts after a within-list sort change.

### Pitfall 7: `full-schema.sql` drift + wrong apply path
**What goes wrong:** Applying via `supabase db push`/`db reset` wipes local dev data; forgetting to regenerate `full-schema.sql` leaves the bootstrap artifact stale.
**How to avoid:** Apply the migration by pasting into the Supabase SQL editor; then `bash scripts/regenerate-full-schema.sh` (no `--reset`); commit both (CLAUDE.md). Filename must match `<digits>_name.sql` (no letter suffixes).

## Code Examples

### Seed-INSERT shape (mirror mig 061, with the transforms applied)
```sql
-- supabase/migrations/<next>_starter_workflows.sql  (author-only; apply via SQL editor)
-- Mirrors 061 verbatim EXCEPT: definition.category='starter', project_folder_id stripped,
-- no folder_scope, assets[].asset_id → seed-user _library path. Fixed uuid + ON CONFLICT = idempotent.
INSERT INTO public.workflow_definitions (id, slug, version, name, status, definition, created_by, is_global)
VALUES (
  '00000000-0000-0000-0000-0000000000c1',
  'pm-risk-register', 1, 'Risk Register', 'published',
  '{ "slug":"pm-risk-register","version":1,"name":"Risk Register","status":"published",
     "category":"starter",
     "business_requirement":"Produce a cited project risk register from your knowledge base …",
     "assets":[{"kind":"template","mime":"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "asset_id":"00000000-0000-0000-0000-000000000001/_library/pm-risk-register.docx",
                "filename":"risk-register.docx"}],
     "phases":[
       {"slug":"retrieve","phase_index":0,"config":{"phase_type":"llm_agent",
         "prompt":"Search the knowledge base for all identified project risks …",
         "available_tools":["search_documents"]},"validators":[]},
       {"slug":"emit","phase_index":1,"config":{"phase_type":"llm_emit","emitter":"render_template",
         "prompt":"Fill the risk-register template from the retrieved KB evidence …",
         "citation_policy":"strict","integrity_policy":"strict"},
        "validators":[
          {"kind":"citations_required","config":{"mode":"deterministic"},"on_failure":"fail_run"},
          {"kind":"output_file_valid","config":{},"on_failure":"fail_run"}]}
     ] }'::jsonb,
  '00000000-0000-0000-0000-000000000001',   -- seed system user (mig 056/061)
  true
)
ON CONFLICT (id) DO NOTHING;
-- NOTE: project_folder_id + folder_scope INTENTIONALLY ABSENT (runs over the forker's own KB).
```

### Storage seed (mirror seed-pm-pack.py:upload_template — a SQL migration cannot do this)
```python
# scripts/seed-starters.py  (operator-run; service-role client; local Supabase up)
SEED_UID = "00000000-0000-0000-0000-000000000001"
BUCKET = "workspace-files"
def upload_starter_template(supabase, local_path: Path, slug: str) -> str:
    data = local_path.read_bytes()
    path = f"{SEED_UID}/_library/{slug}.docx"          # this path string IS the AssetRef.asset_id
    supabase.storage.from_(BUCKET).upload(path, data,
        {"content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "upsert": "true"})
    assert len(supabase.storage.from_(BUCKET).download(path)) == len(data)  # byte round-trip
    return path
```

### Compliance Gap Report — a credible fresh composition (KB→document, on existing primitives)
```
Phase 0  retrieve  (llm_agent, tools=[search_documents]):
  "Search the knowledge base for stated compliance obligations (policies, controls,
   regulatory clauses) and the evidence of whether each is met. For each obligation
   gather: requirement, source clause, current state, gap description, severity, owner —
   with the source passages supporting each."
Phase 1  emit  (llm_emit, emitter=render_template, citation_policy=strict, integrity_policy=strict):
  template compliance-gap-report.docx = a {%tr for r in rows %} table with cited columns
  {{ r.requirement.value }} {{ r.source_clause.value }} {{ r.current_state.value }}
  {{ r.gap.value }} {{ r.severity.value }} {{ r.owner.value }}  + a scalar header block.
  validators: citations_required(fail_run), output_file_valid(fail_run).
  business_requirement: "Produce a cited compliance gap report from the knowledge base:
   one row per obligation with its source clause, current state, gap, severity, and owner —
   every cell grounded in the KB; leave a cell null where sources don't support it."
```
Author the `.docx` with a `make_pm_templates.py`-style python-docx builder (each Jinja tag in its own single-run paragraph/cell; the `{%tr %}` loop in dedicated open/content/close rows — the Pitfall-4-safe conventions [VERIFIED make_pm_templates.py header]).

## State of the Art — Competitor Gallery Findings (D-143-6)

> Additive research to strengthen (NOT replace) the one shelf. Findings inform shelf layout, fork-affordance copy, and the `category` taxonomy — no scope expansion.

**Glean Agent Library (the closest analog — an enterprise knowledge-grounded agent catalog):** a single-page catalog with a top search bar + filters by **creator, verification status, and category**. Admin-curated agents wear a **"Verified / company" badge** ("created or curated by admins … an official, trusted agent"); personal ones show the author's name and are filterable as **"By you."** Categories (Sales, Engineering, HR, IT, Support…) are admin-curated. Usage signals (view/run counts) aid discovery. [CITED: docs.glean.com/agents/concepts/agent-library, glean.com/agent-library]
→ **Direct mapping for us:** our seeded starters ARE the "verified/official" tier (`is_global` + `category='starter'`); user forks are "By you." Add a small **"Official"/"Starter" chip** on the starter card (reuse the existing pill chrome) so curated ≠ user-published is visible at a glance — the one honest visual distinction the current page lacks.

**Zapier templates:** every template carries a **"Use this workflow" / "Use this template" CTA** — one click clones a Zap with apps + core fields **pre-selected**; the user then connects their own accounts and finishes config. Two tiers: "simple" (apps/events pre-selected, settings default) vs "developer" (fully pre-configured). [CITED: platform.zapier.com/publish/zap-templates, zapier.com/templates]
→ **Fork-affordance copy:** prefer an explicit verb like **"Use this starter"** over "Fork/Tweak" (clearer to non-technical users); land the user in the Builder with the definition pre-filled (which our fresh-copy fork already does). The "clone into my copy, then finish it" mental model matches ours exactly.

**n8n & Activepieces:** both separate **official/curated** from **community/user-made** and organize by **category + collections/tags**; "use template" imports a full definition you then customize. Activepieces is explicit that community pieces are user-contributed vs. core-team-maintained. [CITED: docs.n8n.io/workflows/templates, activepieces.com/templates]
→ **Taxonomy:** `category='starter'` is sufficient for 3 starters now; the field is free-form JSONB, so a later content pass can add sub-categories (e.g., `category` values or a `tags[]`) with zero migration — keep the predicate `definition->>'category'='starter'` and don't over-engineer a taxonomy for 3 items.

**beam.ai:** a large "ready-to-deploy" template catalog organized by department/industry (finance, compliance, HR, IT…), "customize in minutes and deploy." Reinforces department/use-case categorization + a prominent curated gallery as the primary entry, with "build custom" as the secondary path. [CITED: beam.ai/agents]
→ **Layout:** curated gallery on top, "build your own" secondary — validates D-143-5 (Starters shelf at the TOP; Build-card can move below the runnable shelves).

**Empty-state / discovery:** none of the sources detail an empty-state, but the consistent pattern is: curated gallery is *always populated* (that is its purpose) and is the page's hero. Our Starters shelf is seed-backed so it is never empty — the honest empty-state risk is instead the **Published (mine)** shelf on a fresh account (already handled: "No published workflows yet").

**Synthesis (what to adopt, staying in scope):** (1) an **"Official/Starter" chip** to distinguish curated from user-made (Glean); (2) **"Use this starter"** as the fork CTA copy (Zapier); (3) **Starters gallery on top**, Build-card secondary (beam.ai/Zapier/Glean); (4) keep `category='starter'` as the single marker, extensible later (n8n/Activepieces). Nothing here adds a surface beyond the one shelf + the fork button.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The harness engine's `ctx.supabase` is the **service-role** client, so a re-homed seed-prefix template resolves for any forker's run despite `workspace-files` being RLS-protected. | Summary / Diagram | If it were user-scoped, a cross-user Storage read would 404 and the emit would fail. Evidence is strong (publish_service header calls it "the service-role supabase"; `get_supabase()` fallback; engine "bypasses RLS" file header) but not executed end-to-end this session. **Verify with one UAT fork-run by a non-operator account.** [ASSUMED — high confidence] |
| A2 | The intended reading of D-143-3a is "no *run-time uploaded* template" (SEED-110), not "no bound template at all". | Pitfall 1 | If the user truly meant zero templates, the 3 starters must become chat-answer workflows (no `llm_emit`) — a different deliverable. Needs user confirmation. [ASSUMED] |
| A3 | Running a seeded starter over a populated KB (e.g., the PM demo corpus) satisfies the strict `citations_required` gate. | Pitfall 2 | The pm-pack corpus was ingested for the operator's demo folder; a forker without content will fail the strict gate by design. [ASSUMED — verify at UAT] |
| A4 | `scripts/pm-pack/templates/risk-register.docx` + `weekly-status-report.docx` are the byte-source for the re-homed templates. | Runtime State | If the committed files diverged from what's in the operator's `_library/`, the seeded starter renders a different template than the source row. Low risk (both reproducible via `make_pm_templates.py`). [VERIFIED files exist; content parity ASSUMED] |

## Open Questions

1. **Document starters vs chat-answer starters (reconcile D-143-3a).**
   - What we know: `render_template` is the only file emitter; a "→document" starter must bind a template (re-homed) and needs the Storage seed.
   - What's unclear: whether the user accepts the added storage-seed step for genuine documents, or would prefer template-free chat-answer starters.
   - Recommendation: keep the document path (faithful to WF-01's "→document" + the ROADMAP wording); it is well-precedented and modest work. Surface the storage-seed step explicitly at plan time so it isn't a surprise.

2. **Citation policy for starters: `strict` (fail on gaps) vs `flag` (deliver with visible gaps).**
   - What we know: the source rows are `strict`; strict fails on an empty/mismatched KB.
   - Recommendation: keep `strict` for fidelity to the source and to the "grounded deliverable" value prop, but call it out — the user may prefer `flag` for starters so a first run always produces *something*. A one-line change per emit phase if they choose `flag`.

3. **Where the Build-card lands after the section reorder.**
   - What we know: BUG-260628-01 wants runnable above drafts; the Build-card currently lives in the Drafts shelf.
   - Recommendation: Starters → Published → Drafts; keep the Build-card in Drafts, and (optional) add a header "Build a workflow" button so create-discovery doesn't regress. Minor UX; G-2 sketch waived.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase (Postgres :54322 + Storage) | Apply the seed migration + upload templates | ✓ | Postgres 15 (local CLI stack) | — (must be `supabase start` for the operator step) |
| Service-role Supabase client (seed script) | Upload to `_library/` + DELETE-INSERT published rows | ✓ | key in `backend/.env` (name-only) | — |
| `backend/venv` python + python-docx/docxtpl | Author `compliance-gap-report.docx` | ✓ | installed (sandbox image + venv) | — |
| Committed source templates | Re-home Risk Register + Weekly Status | ✓ | `scripts/pm-pack/templates/*.docx` | Regenerate via `make_pm_templates.py` |
| `scripts/regenerate-full-schema.sh` | Refresh `full-schema.sql` after apply | ✓ | present | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the Compliance Gap Report `.docx` must be *authored* (it does not exist yet) — build it with a python-docx script mirroring `make_pm_templates.py`.

## Validation Architecture

> `workflow.nyquist_validation: true` — section required.

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest (`backend/tests/unit`, `backend/tests/integration`) |
| Frontend framework | Vitest + Testing Library (`*.test.tsx`; note ~14-17 pre-existing rot tests — baseline-fail, ignore) |
| Backend quick run | `backend/venv/Scripts/python.exe -m pytest backend/tests/unit/test_<new>.py -x` |
| Frontend quick run | `cd frontend && npx vitest run src/pages/WorkflowsPage.test.tsx` |
| Full backend suite | `backend/venv/Scripts/python.exe -m pytest backend/tests -q` |

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated command | File Exists? |
|----------|----------|-----------|-------------------|--------------|
| SC-a | `list_starter_workflows` returns ONLY curated globals (`category='starter'`), NOT the 5 mig-061 scaffolds | unit (db, live/mock pool) | `pytest backend/tests/unit/test_starter_workflows.py::test_starters_query_excludes_scaffolds -x` | ❌ Wave 0 |
| SC-b | Published shelf query with `owned_only=true` returns `created_by=me` only (no global double-render); default keeps globals for the picker | unit | `pytest …::test_published_owned_only_and_default -x` | ❌ Wave 0 |
| SC-c | Fresh-copy fork mints new slug + v1 + `is_global=false` + `created_by=caller`; opens Builder; does not mutate the starter | frontend unit + manual | `npx vitest run src/pages/WorkflowsPage.test.tsx` | ⚠️ extend existing |
| SC-c (backend) | `POST /workflows` forces `is_global=false`/`draft`/`created_by`; 409 on slug/version collision | integration | `pytest backend/tests/integration/test_workflows_routes.py -k fork -x` | ⚠️ extend |
| SC-d | Each of the 3 seeded starters runs end-to-end KB→document against a populated KB | **manual UAT** (D-143-4a — seeds bypass the gauntlet by construction; no golden run) | operator fork → bind KB with content → Run → verify `.docx` output + citations | manual |
| SC-e | Shelf order: Starters → Published → Drafts (published/starters no longer buried) | frontend unit + manual | `npx vitest run src/pages/WorkflowsPage.test.tsx` (assert section order) | ⚠️ extend |
| Starters shelf endpoint | `GET /workflows/starters` returns the 3 rows; `GET /workflows/published?scope=mine` narrows | integration | `pytest backend/tests/integration/test_workflows_routes.py -k "starters or scope" -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the relevant quick-run (`pytest -x` for the touched db/route test; `vitest run WorkflowsPage.test.tsx` for the shelf/fork).
- **Per wave merge:** full backend unit + integration for `workflows`; frontend `WorkflowsPage` + `WorkspacePanel` (regression check for Pitfall 3).
- **Phase gate:** full suite green + the SC-d manual UAT (all 3 starters run to a document) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_starter_workflows.py` — covers SC-a, SC-b (`list_starter_workflows`; `owned_only` param).
- [ ] `backend/tests/integration/test_workflows_routes.py` additions — `GET /workflows/starters`, `?scope=mine`, fork 409.
- [ ] `frontend/src/pages/WorkflowsPage.test.tsx` additions — Starters shelf render, `onUseStarter` fork (new slug + v1), section order.
- [ ] Manual UAT script/checklist for SC-d (fork → bind KB → run → document) — the D-143-4a trust check.
- [ ] (Not required by G-4: no live streaming/agent-loop change — SC#10 4-axis UAT does NOT apply; this phase does not touch streaming/provider routing/UI run-state.)

## Security Domain

> `security_enforcement` absent in config → enabled. Global starters are the sanctioned shared-scope exception; access-control (V4) is the star axis.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard control (existing) |
|---------------|---------|------------------------------|
| V2 Authentication | no | No new auth surface. |
| V3 Session Management | no | No change. |
| **V4 Access Control** | **yes** | RLS on `workflow_definitions` (view own+global; insert forces `is_global=false`); `create_workflow_definition` binds `created_by`/`is_global=false` server-side [VERIFIED 056:43-65, workflows.py:288]. The fork route is unchanged and already owner-safe. The Starters query returns only `is_global=true` published rows (world-readable by policy) — no private leak. |
| V5 Input Validation | yes | `WorkflowDefinition` is `extra='forbid'` (422 on junk); path/body UUIDs coerced by FastAPI (422 on malformed); the JSONB predicate uses a constant literal, not user input. |
| V6 Cryptography | no | None. |
| Storage access | yes | `workspace-files` is RLS-protected (`public=false`); the engine's service-role read is the only cross-user path (A1). Re-homing the template to the **seed-user** prefix (not a real user) removes the cross-user dependency on a real account's private storage. |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| A user self-publishing a global starter | Elevation of privilege | mig 056 RLS `WITH CHECK is_global=false` — only seeds set it [VERIFIED]. No app path added. |
| Fork reads/edits another user's row | Info disclosure / Tampering | Fork is a fresh INSERT (`created_by=caller`); the frozen starter row is never UPDATEd (immutability trigger) [VERIFIED]. |
| Starter definition smuggling code via `emitter`/`fn` | Tampering / RCE | Closed registries: `resolve_emitter` / `PROGRAMMATIC_PHASE_REGISTRY` RAISE on unknown names — never eval/getattr/import [VERIFIED emitters.py:82-95]. The seed only names `render_template`. |
| De-dupe change leaking or hiding rows incorrectly | Info disclosure | Scoped `owned_only` narrows-not-widens; default path unchanged for picker/run-soul (Pitfall 3). |
| Starter template points at a real user's private Storage | Info disclosure / fragility | Re-home to seed-user prefix (Runtime State). |

## Sources

### Primary (HIGH confidence — live code + live DB + live Storage, this session)
- `supabase/migrations/056_workflow_definitions.sql` — UNIQUE(slug,version):29; RLS insert `is_global=false`:55-57; immutability trigger:81-99; seed user `00000000-…-01`:107-117.
- `supabase/migrations/061_harness_seed_templates.sql` — the seed-INSERT pattern + the 5 scaffolds.
- `backend/app/db/workflows.py` — published predicate:191-192; JSONB precedent:197; fork INSERT `is_global=false`:288-289.
- `backend/app/api/workflows.py` — GET /workflows/published:104; create 409:243-250; publish:166.
- `backend/app/services/harness/emitters.py` — `render_template` is the ONLY emitter:61,183; closed-registry raise:82-95.
- `backend/app/services/harness/phase_types.py` — emit executor uses `ctx.supabase` → `resolve_template_source`:1120-1122.
- `backend/app/services/template_asset_service.py` — Branch-1 raw-path Storage read:145-180.
- `backend/app/services/workspace_service.py` — `_read_from_storage` service download:169-172.
- `frontend/src/pages/WorkflowsPage.tsx` — `onTweak`:151-177; shelf section order (drafts above published):350-413; PublishedCard/WorkflowSoul.
- `frontend/src/lib/api.ts` — `listPublishedWorkflows`:1203; `createWorkflowDraft`:3076; `PublishedWorkflow` shape (no created_by/is_global):1178.
- `frontend/src/components/panel/WorkspacePanel.tsx:125` + `backend/app/api/threads.py:51` — shared consumers of the published query.
- `scripts/seed-pm-pack.py` — the seed precedent (upload_template:292-311; DELETE-then-INSERT; service-role; :54322).
- `scripts/pm-pack/make_pm_templates.py` — python-docx template authoring conventions.
- Live DB (:54322) queries — 38 `workflow_definitions` rows; the two source rows' full JSONB (bound assets + private `project_folder_id`/`folder_scope`); `workspace-files` bucket `public=false`; `_library/` objects only under `d8a54002…`; folder `1564da7e…` = "PM Demo Project", owner d8a54002.

### Secondary (MEDIUM — official docs, competitor galleries)
- Glean Agent Library — docs.glean.com/agents/concepts/agent-library; glean.com/agent-library (verified badge, creator/verification/category filters).
- Zapier — platform.zapier.com/publish/zap-templates; zapier.com/templates ("Use this workflow" clone; simple vs developer pre-fill).
- n8n — docs.n8n.io/workflows/templates (categories/collections; official vs community).
- Activepieces — activepieces.com/templates; resources.activepieces.com/glossary/community-pieces (core-team vs community).
- beam.ai — beam.ai/agents (department/industry catalog; curated-first layout).

### Tertiary (LOW — training knowledge, flagged)
- A1 (engine supabase is service-role): inferred from code comments + fallback, not executed end-to-end — verify at UAT.

## Metadata

**Confidence breakdown:**
- Standard stack / mechanics: HIGH — every claim verified against live code, live DB, and live Storage.
- Content authoring (promote transform + storage seed): HIGH — the exact precedent (`seed-pm-pack.py`) and source templates are in the repo.
- The D-143-3a reconciliation (Pitfall 1): HIGH on the facts, MEDIUM on the intended resolution — needs a one-line user confirmation (A2 / Open Q1).
- Competitor findings: MEDIUM — official pages + docs, cross-checked across 5 products.

**Research date:** 2026-07-10
**Valid until:** ~2026-08-10 (stable domain; the only volatile item is the live DB row shape — re-verify the two source rows if the operator re-seeds the PM pack before planning).
