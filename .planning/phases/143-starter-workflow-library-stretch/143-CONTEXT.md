# Phase 143: Starter Workflow Library (STRETCH) - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning

<domain>
## Phase Boundary

A curated, fork-able **Starters** shelf on the Workflows page: a set of `is_global`
published starter workflow definitions the user can fork into a **personal copy**
instead of starting from a blank "describe it" box.

**RED LINE (from ROADMAP + SEED-084): no new runtime.** The starters are authored on
the existing generic primitives (same phase types, same run path). The deliverable is
**one shelf section + a fork path + curated content authoring** — nothing more.

**In scope:**
- A **Starters** shelf section rendering curated `is_global` published defs.
- A **fresh-copy fork** path (distinct from the existing same-slug Tweak).
- **3 seeded starters** authored as a SQL seed migration.
- **Fold BUG-260628-01** — fix the shelf sort so published/starters aren't buried under drafts.
- A **competitor-gallery research directive** for the phase researcher (additive, to strengthen the shelf UX — see `<decisions>` D-143-6).

**Out of scope (explicitly deferred — see `<deferred>`):**
- Run-time template/file upload (a new run-input surface + threat model) → elevated to a **v3.3 phase candidate**.
- Workflow delete + cascade lifecycle → **seeded**.
- Any change to the NL-describe-first birth path (that path stays as-is; the shelf is the *second* birth path).

</domain>

<decisions>
## Implementation Decisions

### Fork model
- **D-143-1 (fresh personal copy — RED-LINE correctness):** Forking a starter creates a
  **brand-new workflow the caller owns** — a NEW auto-generated slug (`<starter-slug>-<short-hash>`),
  `version = 1`, `created_by = caller`, `is_global = false`. It is a **distinct fork path**, NOT the
  existing same-slug Tweak→`v(N+1)`. **Why:** `workflow_definitions_slug_version_unique
  UNIQUE(slug, version)` (mig 056) is **global across all users** — if two users forked a shared
  starter via the same-slug Tweak, both would produce `<slug> v2` and the second INSERT would hit a
  UNIQUE violation. SEED-084's "reuse Tweak verbatim" assumption is therefore WRONG for a shared
  starter; a fresh identity is required. The same-slug Tweak stays the path for tweaking your OWN
  published workflow.
- **D-143-1a (fork UX):** The fork **auto-suffixes the slug** (no name prompt) and **opens the copy
  in the Builder** to edit/rename — the SAME landing as today's Tweak, just with a fresh identity.
  Reuses `createWorkflowDraft` + the `setBuilderInitial` → `pageView="builder"` flow in
  `WorkflowsPage.tsx` (`onTweak`), differing only in the slug/version it constructs.

### Curation — starter vs dev/harness templates
- **D-143-2 (curated JSONB marker):** Seeded starters carry `definition.category = 'starter'`. The
  Starters shelf renders `status='published' AND is_global = true AND
  definition->>'category' = 'starter'` — a **JSONB-path predicate** mirroring the existing
  `definition->>'project_folder_id'` precedent in `list_published_workflows` (NO new table column,
  NO expression index, ZERO migration to the table itself). Chosen over a hardcoded slug allowlist
  (which drifts from the DB and needs a code edit per starter).
- **D-143-2a (hide the 5 dev scaffolds + de-dupe consequence):** The 5 existing `is_global`
  scaffolds seeded by mig 061 (`research_summarize`, `plan_execute_verify`, `literature_review`,
  `doc_qa_human`, `eval_coverage`) lack the `category='starter'` marker → they do NOT appear in the
  Starters shelf. **Consequence to resolve in planning:** the existing **Published** shelf currently
  renders `is_global OR created_by=me`, so those scaffolds show there today AND starters would
  double-render (Starters shelf + Published shelf). The Published shelf should switch to
  **`created_by = me` only** (drop the bare `is_global`) so scaffolds vanish from the user-facing
  page and starters live ONLY in the Starters shelf. (Planner: decide whether this is a new
  endpoint/query param for starters + a narrowed Published query, or a client-side split — but the
  end state is: Published = my own; Starters = curated global.)

### Content — which starters ship
- **D-143-3 (3 starters — promote 2 + author 1):** Ship **3** curated starters for v3.2:
  1. **Risk Register** — promote from `pm-risk-register` (copy its `definition` JSONB).
  2. **Weekly Status Report** — promote from `pm-weekly-status-report` (copy its `definition` JSONB).
  3. **Compliance Gap Report** — author **fresh** per SEED-084.
- **D-143-3a (REVISED post-research 2026-07-10 — all 3 are template-fill; keep the →document path):**
  Research (`143-RESEARCH.md` Pitfall 1) found `render_template` is the **only** registered emitter —
  there is **no template-free file-producing path**, so every "→document" starter IS template-fill.
  The intended reading of "no template needed" is **no *run-time uploaded* template** (that gap =
  SEED-110, deferred) — the template is instead **bound in the definition**. Operator confirmed
  2026-07-10: **keep real documents** (faithful to WF-01's "produce a document"), NOT chat-answer
  starters. See D-143-4b for the transform + storage-seed this requires.
- **D-143-3b ("promote" = copy into a seed, not flip user rows):** `pm-risk-register` /
  `pm-weekly-status-report` are `created_by=<the user>`, `is_global=false`. "Promote" means **copy
  their definition JSONB into the seed migration** as a system-owned (`created_by = <system seed
  user>`), `is_global=true`, `status='published'`, `category='starter'` row — we do NOT flip the
  user's own rows (RLS forbids self-setting `is_global` anyway).

### Authoring & validation
- **D-143-4 (seed-migration authoring):** Starters are authored as **SQL seed-migration INSERTs**
  (the ONLY path that can set `is_global=true` — mig 056 RLS forbids users self-setting it),
  mirroring the mig 061 pattern verbatim (`INSERT INTO public.workflow_definitions (...) VALUES
  (..., created_by=<system user>, is_global=true)`). The mig 056 system-seed user satisfies the
  `created_by` FK. Apply the new migration via the Supabase SQL editor (never `db push`/`db reset`),
  then regenerate `full-schema.sql`.
- **D-143-4a (trusted seed, manual run check — NOT gauntlet-enforced):** Seeded starters **bypass
  the 8-stage publish gauntlet by construction** (a direct `status='published'` INSERT), exactly
  like every existing `is_global` def. SEED-084's "they pass the same gauntlet — no special-casing"
  is **aspirational, not literally enforced for seeds** (a seed has no user/KB to golden-run
  against). Trust model: **author + manually run each starter once during UAT** to confirm it works
  end-to-end. (Planner: no gauntlet wiring — the trust is authoring discipline + the UAT run.)

### Shelf placement & bug fold
- **D-143-5 (Starters on top + fold the sort bug):** The **Starters** shelf sits at the **TOP** of
  the Workflows page (discovery-first), above the Drafts and Published shelves. **BUG-260628-01 is
  folded** — the shelf sort must stop burying runnable published/starters under drafts (a
  status-aware / published-first ordering). See `<canonical_refs>` for the bug.

### Research directive (competitor galleries)
- **D-143-6 (fold competitor research into the phase researcher — additive):** The phase researcher
  should study how established products present **starter/template galleries** and clone-vs-fork UX,
  to strengthen (NOT replace) our shelf: **n8n** & **Activepieces** template libraries, **Zapier** /
  **Gumloop** popular-workflow galleries, **Glean** agent/assistant catalog, **beam.ai** agent
  catalog. Look specifically at: category/tag organization, "use this template" (clone) vs
  fork/versioning UX, empty-state + discovery, and how they distinguish official/curated vs
  user-made. Findings inform the shelf layout, the fork affordance copy, and the `category` taxonomy
  — they do NOT expand scope beyond the one shelf section.

### Post-Research Reconciliation (added 2026-07-10 after `143-RESEARCH.md`)
- **D-143-4b (promote = transform + storage seed, NOT a verbatim copy):** "Promote" copies each source
  row's `definition` JSONB **with transforms**: (1) strip `project_folder_id` and every per-phase
  `folder_scope` (so retrieval runs over the *forker's own* KB, not the operator's private "PM Demo
  Project" folder); (2) re-home each `.docx` template to the **seed-system-user** Storage prefix
  (`00000000-…-01/_library/<slug>.docx`) and repoint `assets[].asset_id` there; (3) set the curation
  fields (`created_by=<seed user>`, `is_global=true`, `status='published'`, `category='starter'`).
  Because a SQL migration **cannot place Storage bytes**, this phase ALSO ships a **Python storage-seed
  script** (mirror `scripts/seed-pm-pack.py:upload_template`) that uploads the 3 re-homed templates via
  a service-role client. Two committed source templates already exist at `scripts/pm-pack/templates/`
  (Risk Register, Weekly Status); the **Compliance Gap Report `.docx` must be authored fresh** via a
  `make_pm_templates.py`-style python-docx builder (Pitfall-4-safe: one Jinja tag per run/cell,
  `{%tr %}` loop in dedicated rows). Idempotent seed = fixed uuid + `ON CONFLICT (id) DO NOTHING`
  (never UPDATE a published row — immutability trigger raises `23514`).
- **D-143-2b (scoped narrowing — do NOT blanket-narrow the shared helper):** D-143-2a's "drop the bare
  `is_global`" must NOT be applied to the shared `list_published_workflows` helper — it also feeds the
  composer Harness picker, the run-surface soul (`WorkspacePanel.tsx`), and `threads.py` kickoff, all of
  which NEED global rows (Pitfall 3). Instead add an **additive `owned_only`/`scope=mine` param**
  (default off, keeps every existing caller byte-identical) used ONLY by the Workflows-page Published
  shelf; the Starters shelf gets its own `list_starter_workflows` / `GET /workflows/starters`.
- **D-143-7 (citation policy = strict):** All 3 starters keep `citation_policy: strict` +
  `citations_required(on_failure=fail_run)` (operator confirmed 2026-07-10) — an honest failure on an
  empty/mismatched KB over a fabricated deliverable. UAT (D-143-4a) runs each starter against a
  populated KB (the PM demo corpus is the natural fixture).
- **D-143-8 (curated-vs-mine visual + fork CTA copy — from D-143-6 competitor synthesis, in-scope):**
  Add a small **"Starter"/"Official" chip** on the starter card (reuse existing pill chrome — Glean's
  verified-badge analog) so curated ≠ user-made is visible at a glance; use **"Use this starter"** as
  the fork-affordance copy (Zapier's clone-CTA analog) rather than "Fork/Tweak". No new card component
  (G-2 waived). Shelf order: **Starters (top) → Published (mine) → Drafts & seeds** (folds
  BUG-260628-01); keep the Build-card discoverable (Drafts shelf, optionally a header "Build a
  workflow" affordance — minor UX, Claude's discretion).

### Claude's Discretion
- Exact slug-suffix scheme (short hash vs counter) and the exact Builder header caption for a forked
  starter — pick the cleanest consistent-with-Tweak approach.
- Whether the starters query is a new endpoint (`GET /workflows/starters`), a query param on the
  existing published endpoint, or a client-side split — planner/researcher's call, subject to the
  D-143-2a end state (Published = my own; Starters = curated global).
- The Compliance Gap Report starter's exact phase composition — author it on existing primitives to
  a credible, runnable shape.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The seed / requirement source
- `.planning/seeds/SEED-084-starter-workflow-library.md` — the originating seed: fork-a-starter
  concept, the "author as `is_global=true` published + one shelf section" implementation sketch, and
  the (now-corrected) "reuse Tweak verbatim" assumption. **Note the D-143-1 correction: Tweak does
  NOT survive multi-user forks; use a fresh-copy fork.**
- `.planning/REQUIREMENTS.md` §WF-01 — the requirement text this phase satisfies.

### Backend — workflow definitions substrate
- `backend/app/db/workflows.py` — `list_published_workflows` (the `is_global OR created_by=$1`
  RLS-mirroring query + the `definition->>'project_folder_id'` JSONB-path precedent to mirror for
  `category='starter'`), `create_workflow_definition` (hard-sets `is_global=false` — the fork INSERT
  path), `get_definition`, `delete_workflow_definition` (drafts-only, no cascade — the deferred gap).
- `backend/app/api/workflows.py` — the published-list + publish endpoints (where a starters
  query/param would live).
- `supabase/migrations/056_workflow_definitions.sql` — `UNIQUE(slug, version)` (the collision
  driver behind D-143-1), the RLS policies (`WITH CHECK is_global=false` — why only seeds set it),
  the immutability-on-publish trigger, and the **system-seed user** that satisfies the `created_by`
  FK for global seeds.
- `supabase/migrations/061_harness_seed_templates.sql` — **the exact `is_global` seed-INSERT
  pattern to mirror** for D-143-4 (and the 5 dev scaffolds D-143-2a hides).

### Frontend — the Workflows page
- `frontend/src/pages/WorkflowsPage.tsx` — the two-shelf layout (Drafts above Published), `onTweak`
  (the fork flow to fork from for D-143-1a), `PublishedCard`, the `refetchPublished`/latest-wins
  guards, and the shelf sort BUG-260628-01 targets.
- `frontend/src/components/workflows/WorkflowSoul.tsx` + `frontend/src/components/workflows/soulData.ts`
  — the shared card-scale "soul" atoms a Starter card reuses (no new card design needed).
- `frontend/src/lib/api.ts` — `listPublishedWorkflows`, `createWorkflowDraft` (the fork INSERT
  client), `listDraftWorkflows`.

### Reported bug (folded)
- `.planning/reported-bugs/BUG-260628-01.md` — drafts always sorted above published regardless of
  filter; runnable workflows buried. **Folded into Phase 143 (D-143-5).**

### Design system
- Project skill `sketch-findings-agentic-rag` — the built Workflows page library+launch patterns
  (card, shelf, soul). The Starters shelf reuses these (G-2 sketch judged unnecessary — additive
  section on existing patterns).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`onTweak` fork flow** (`WorkflowsPage.tsx`): the fresh-copy fork (D-143-1a) is a small variant —
  same `createWorkflowDraft` + `setBuilderInitial` → Builder landing, differing only in the
  slug/version constructed (new slug + v1 instead of same slug + v(N+1)).
- **`PublishedCard` + `WorkflowSoul` (`scale="card"`)**: the Starter card renders with the existing
  card chrome + soul atoms — no new card component.
- **`list_published_workflows`'s `definition->>'project_folder_id'` JSONB-path filter**: the exact
  precedent for the `definition->>'category'='starter'` predicate (D-143-2). `$N`-only, narrows-not-widens.
- **mig 061 seed-INSERT block**: copy/paste template for the starter seed migration (D-143-4).

### Established Patterns
- **`is_global` is seed-only** (mig 056 RLS `WITH CHECK ... is_global=false`): there is NO app path
  to author a global starter — it MUST be a seed migration. This is a hard constraint, not a choice.
- **`UNIQUE(slug, version)` is global**, not per-user (mig 056) — the reason the fork must mint a new
  slug (D-143-1).
- **Immutability-on-publish trigger** freezes published rows: a forked/promoted starter row is
  frozen once published; edits happen on a new draft.
- **Migration workflow** (CLAUDE.md): numbered SQL under `supabase/migrations/`, apply via SQL
  editor (never `db push`/`reset`), then `bash scripts/regenerate-full-schema.sh`.

### Integration Points
- New starters query (endpoint or param) in `backend/app/api/workflows.py` +
  `backend/app/db/workflows.py`, consumed by a new `listStarters`-style client in
  `frontend/src/lib/api.ts`.
- New **Starters shelf `<section>`** in `WorkflowsPage.tsx` above the existing Drafts/Published
  sections; Published section query narrowed to `created_by=me` (D-143-2a).
- New seed migration under `supabase/migrations/` (next free number).

</code_context>

<specifics>
## Specific Ideas

- The 3 concrete starters: **Risk Register** (from `pm-risk-register`), **Weekly Status Report**
  (from `pm-weekly-status-report`), **Compliance Gap Report** (fresh). All KB→document.
- Fork produces a copy the user OWNS and can freely edit/delete — "each user gets their own copy,"
  per the D-143-1 preview the user approved (`risk-register-a1b2 v1 (mine)`).
- Competitor references named by the user to study: **Glean**, **beam.ai**, and open-source
  workflow tools — to make ours more efficient/strong, "not replace it."

</specifics>

<deferred>
## Deferred Ideas

- **Run-time template/file upload → SEED-110 (elevated to v3.3 PHASE CANDIDATE).** The Run modal is
  a single kickoff textarea + read-only KB chip — no file input; a template-fill workflow has
  nowhere to hand over the template. This is a NEW run-input surface (upload → storage → threat
  model → wiring into the agent's `render_template` path), too big to fold and gated behind its own
  threat model + SC#10. Does NOT block Phase 143 (the 3 chosen starters are KB→document, no template
  needed). **Re-open trigger:** a template-fill starter/skill ships OR users ask to hand a template
  to a workflow run. **Cross-link:** overlaps Phase 144 (agent-driven skill file attachment) but is
  distinct — 144 attaches files to a SKILL during authoring; this uploads a template as a RUN INPUT.
  MUST be surfaced at the `/gsd:new-milestone` v3.3 sweep (do not let it rot as a dormant seed).
- **Workflow delete + cascade → SEED-111.** No user-facing delete on the Workflows page (draft cards
  = Open+Publish; published = Tweak+Run). Backend `delete_workflow_definition` is drafts-only with
  no cascade to runs/threads; published rows are frozen. Lifecycle hygiene, unrelated to the starter
  shelf. **Re-open trigger:** orphaned drafts / abandoned runs become a real annoyance, OR a
  Workflows-lifecycle/UX phase is scoped. A small standalone `/gsd:quick`-scale phase later.
- **Forked-from-starter provenance** (track which starter a copy was forked from) — nice-to-have,
  not required for the fork to work. Revisit if users want "made from Risk Register" lineage.
- **Growing the starter library beyond 3** — a later content pass / v3.x content milestone (SEED-084's
  original "content pack" framing).

### Reviewed Reported Bugs (not folded)
- **BUG-260610-01** (workflow run nav timer reset / duplicate avatar) — `harness/workflow-ui` but on
  the **run** surface, not the library/shelf. Left **open**; out of this phase's domain.

</deferred>

---

*Phase: 143-starter-workflow-library-stretch*
*Context gathered: 2026-07-10*
