# Phase 269: Starter Expert Library - Context

**Gathered:** 2026-09-29
**Status:** Ready for planning

<domain>
## Phase Boundary

A new org opens the Expert catalog and finds a starter library of first-party Experts, each installable
through Phase 266's existing provisioning path and each proven by one live recorded conversation
(cited figure + one out-of-scope refusal). Requirements: PACK-26, PACK-27. No new install machinery.

</domain>

<decisions>
## Implementation Decisions

### Count + domains
- **D-269-01: Five starter Experts total** = the existing Financial Analyzer (mig 187) + four new.
- **D-269-02: Domains are business functions**, each chosen because its corpus carries verifiable cited
  figures and an obvious out-of-scope question (e.g. Legal/Contracts, HR/Policy, Sales/Ops,
  Compliance). Exact four picked by the researcher/planner; must be validated against the authored
  corpus BEFORE the domain is locked (ROADMAP failure line: count chosen before domains validated).
- **D-269-03: No persona import** from agency-agents (SEED-244 reuse #3 rejected here). The shape
  (identity + stated success metrics) may inform bundle copy only.

### Corpus source
- **D-269-04: Synthetic corpora authored by us**, fictional company, clearly labelled sample data, no
  licence exposure. Ships as files at `backend/app/experts/corpora/<slug>/` with `manifest.json`,
  content installed verbatim through the 266 pipeline (D-266-05, D-266-07).
- **D-269-05: Each corpus must contain checkable figures** the live transcript can cite, and must
  make at least one plausible question genuinely out of scope.

### Catalog first-run (G-2)
- **D-269-06: All five appear as Install cards** in the existing `ExpertCatalogPage`/`ExpertCard`.
  Admin sees Install; non-admin sees the reason (D-266-01/02). No hero, no domain grouping, no
  auto-install. G-2 sketch still applies to the first-run/installed states; new-org empty state must
  never be blank.

### Seeding
- **D-269-07: One numbered migration (198+; 197 is taken)** inserts the new bundle rows
  (`org_id NULL`, `is_system`), org-portable — no hardcoded org ids (mig 193 lesson). Knowledge stays
  as repo files; the migration seeds bundles only. Apply via SQL editor; regenerate full-schema.sql.
- **D-269-08: Installation uses the 266 path with no Expert-specific code or branch** (SC#2). A
  fence test drives this RED against a planted per-Expert branch.

### PACK-27 proof
- **D-269-09: Held back until proven.** An Expert enters the seeding migration only when its live
  transcript exists under the phase evidence dir: real org, installed via 266, answers with a cited
  corpus figure, refuses one out-of-scope question. Mock/fixture tests are not evidence (SC#4).
  If a domain fails, ship fewer than five and record it; do not weaken the gate.

### Claude's Discretion
- Exact four domains, fictional company names, corpus size, bundle copy/icons (from the closed
  11-key `expertIcon` map), and evidence file layout (mirror 266's `evidence/`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Install path and prior phases
- `.planning/phases/266-expert-knowledge-in-a-real-org/266-CONTEXT.md` — install trigger, corpus-as-files, `expert_installs`, D-266-01..13
- `.planning/phases/266-expert-knowledge-in-a-real-org/evidence/` — the shape of a recorded live proof
- `.planning/phases/267-an-expert-adds-scope/` — additive-scope semantics starter Experts inherit
- `backend/app/services/expert_install_service.py`, `backend/app/services/expert_corpus.py` — the install path (no forks)
- `backend/app/experts/corpora/financial-analyzer/` — corpus + manifest precedent
- `supabase/migrations/187_expert_bundles.sql`, `193_expert_seed_org_portable.sql`, `195_expert_installs_and_seed_retirement.sql` — seed shape and the portability lesson

### Catalog UI (G-5 audit)
- `frontend/src/components/experts/catalog/` — ExpertCatalogPage, ExpertCard, ExpertDetailModal, expertCatalog.ts
- `backend/app/db/experts.py` (FIRES), `backend/app/services/expert_service.py` — see `docs/HOT-FILE-LEDGER.md` sections

### Requirements / seeds
- `.planning/ROADMAP.md` §Phase 269 · `.planning/REQUIREMENTS.md` PACK-26, PACK-27
- `.planning/seeds/SEED-244-*.md` — origin of the library idea; its "import ten, not two hundred" curation warning
- `docs/EXTENSION-CONTRACT.md` — an Expert is DATA; never engine code

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- 266 install service + corpus loader + `expert_installs` table; catalog components already render Install/Installing/Ready/Failed.
- `expertIcon.tsx` closed icon map; `financial-analyzer` corpus as authoring template.

### Established Patterns
- Corpus = repo files keyed by slug; migrations seed bundle rows only; live-drive evidence in `evidence/NN-*.txt`.

### Integration Points
- `expert_service.resolve_expert_bundle` (per-org folders via installs); catalog via `expertCatalog.ts`.

</code_context>

<specifics>
## Specific Ideas

- Dev account is in TWO orgs — prove the active org before trusting any transcript (memory).
- G-4 scenarios at scope time: new org sees 5 cards; install one; ask cited question; ask out-of-scope.

</specifics>

<deferred>
## Deferred Ideas

- Persona import from agency-agents; domain grouping/featured layout past ~8 Experts; marketplace/packs (SEED-291..294).
- Seeds sweep found no phase dir at run time (no plans yet) — re-run `node scripts/check-seeds-register.cjs --phase 269` after planning. SEED-244 is this phase's origin; flip to `folded` at plan time.

</deferred>

---

*Phase: 269-starter-expert-library*
*Context gathered: 2026-09-29*
