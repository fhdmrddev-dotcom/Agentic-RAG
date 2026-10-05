# Phase 269: Starter Expert Library - Research

**Researched:** 2026-09-29
**Domain:** First-party Expert seed data (corpora as repo files + one org-portable seed migration), the Phase 266 install path, and live-drive evidence
**Confidence:** HIGH on the install path and seed shape (read in code and in the local DB). MEDIUM on corpus and domain design (proposals, validated only by the live drive). One BLOCKING operator question: F-4, a new org's NULL tier.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Count + domains
- **D-269-01: Five starter Experts total** = the existing Financial Analyzer (mig 187) + four new.
- **D-269-02: Domains are business functions**, each chosen because its corpus carries verifiable cited
  figures and an obvious out-of-scope question (e.g. Legal/Contracts, HR/Policy, Sales/Ops,
  Compliance). Exact four picked by the researcher/planner; must be validated against the authored
  corpus BEFORE the domain is locked (ROADMAP failure line: count chosen before domains validated).
- **D-269-03: No persona import** from agency-agents (SEED-244 reuse #3 rejected here). The shape
  (identity + stated success metrics) may inform bundle copy only.

#### Corpus source
- **D-269-04: Synthetic corpora authored by us**, fictional company, clearly labelled sample data, no
  licence exposure. Ships as files at `backend/app/experts/corpora/<slug>/` with `manifest.json`,
  content installed verbatim through the 266 pipeline (D-266-05, D-266-07).
- **D-269-05: Each corpus must contain checkable figures** the live transcript can cite, and must
  make at least one plausible question genuinely out of scope.

#### Catalog first-run (G-2)
- **D-269-06: All five appear as Install cards** in the existing `ExpertCatalogPage`/`ExpertCard`.
  Admin sees Install; non-admin sees the reason (D-266-01/02). No hero, no domain grouping, no
  auto-install. G-2 sketch still applies to the first-run/installed states; new-org empty state must
  never be blank.

#### Seeding
- **D-269-07: One numbered migration (198+; 197 is taken)** inserts the new bundle rows
  (`org_id NULL`, `is_system`), org-portable — no hardcoded org ids (mig 193 lesson). Knowledge stays
  as repo files; the migration seeds bundles only. Apply via SQL editor; regenerate full-schema.sql.
- **D-269-08: Installation uses the 266 path with no Expert-specific code or branch** (SC#2). A
  fence test drives this RED against a planted per-Expert branch.

#### PACK-27 proof
- **D-269-09: Held back until proven.** An Expert enters the seeding migration only when its live
  transcript exists under the phase evidence dir: real org, installed via 266, answers with a cited
  corpus figure, refuses one out-of-scope question. Mock/fixture tests are not evidence (SC#4).
  If a domain fails, ship fewer than five and record it; do not weaken the gate.

### Claude's Discretion
- Exact four domains, fictional company names, corpus size, bundle copy/icons (from the closed
  11-key `expertIcon` map), and evidence file layout (mirror 266's `evidence/`).

### Deferred Ideas (OUT OF SCOPE)
- Persona import from agency-agents; domain grouping/featured layout past ~8 Experts; marketplace/packs (SEED-291..294).
- Seeds sweep found no phase dir at run time (no plans yet) — re-run `node scripts/check-seeds-register.cjs --phase 269` after planning. SEED-244 is this phase's origin; flip to `folded` at plan time.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PACK-26 | A new org opens the catalog to a starter library of first-party Experts (count and domains decided at the phase's discuss), each installable through the `PACK-18` path. | The install path is fully slug-driven. Adding a bundle row plus a corpus directory is the whole mechanism, so no code change is needed (§Measured facts M-1..M-3). ⛔ **"A new org" is BLOCKED by F-4**: a freshly signed-up org has `subscription_tier = NULL`, and the whole `/experts` router refuses it (M-4, Open Question 1). |
| PACK-27 | Every starter Expert has one recorded live conversation that answers from its own corpus in a real org, with no Expert shipped on mock evidence alone. | 266's `evidence/06-sc4-answer-refusal-flip.txt` is the proven shape: an API drive, then an `audit_log search.query` join to `documents.org_id`, then a chunk literal read. It extends to 5 Experts unchanged (§Pattern 4). Restricted scope plus a cross-corpus out-of-scope question gives the strongest refusal (§Pattern 3). |
</phase_requirements>

## Summary

The Phase 266 install path is **already fully generic, and this was checked in code, not assumed.** `install_expert` (`backend/app/services/expert_install_service.py:515-658`) reads nothing Expert-specific. It requires only `bundle.is_system` plus a `slug` for which `has_corpus(slug)` is true. It loads `backend/app/experts/corpora/<slug>/manifest.json`, mints every listed file through `ingest_splice.async_mint_document_row`, and queues it through the shared `_enqueue_or_splice`. The catalog list (`db/experts.py:228-303`) returns every enabled `is_system` row to every entitled org. `overlay_install_state` attaches an Install state to any system row that has a corpus. So SC#2 ("no Expert-specific install code") holds **by construction** once each new Expert is two pieces of data: a corpus directory and an `expert_bundles` row. The phase's code surface should be **zero `.py`/`.tsx` files**. Its deliverables are data (4 corpora, 1 migration), fences (unit tests), live evidence, and docs.

The real risks are not in the code. (1) **F-4 (BLOCKING):** a freshly signed-up org gets `subscription_tier = NULL` from `handle_new_user`. `experts` is enabled only for `enterprise` (mig 186), and `require_capability("experts")` fails closed on the router. A truly new org therefore sees the tier-refusal sentence, **not** the starter library, until someone sets a tier by hand. That is the ROADMAP failure line *"the catalog in a new org is empty until someone runs a migration by hand"* in a different form. 266 recorded this as an operator decision owed (`266-PROD-PARITY.md` §F), and no seed or phase has taken it. (2) **Evidence honesty:** Expert threads keep `web_search` (PACK-21 additive tool floor, `TAVILY_API_KEY` is set locally). A cited figure must also be one no model could know or guess. Otherwise a "cited" answer or a "refusal" can come from model or web knowledge instead of the corpus. (3) **Deploy ordering:** if migration 198 lands in an environment before the backend image that carries the new corpora, every new Expert shows a Start Chat card (the "no install" legacy arm) that refuses at run time. (4) **Greenfield:** `full-schema.sql` is `--schema-only`, and `docs/OPERATOR.md` Step-3 lists no Expert seed migration. A fresh box's catalog is empty today, even for the Financial Analyzer.

**Primary recommendation:** Ship the library as pure data through the existing path, with no code changes. Author 4 corpora (Contracts/Legal, HR Policy, Security & Compliance, Operations & Supply Chain) for the same fictional ACME Corporation as the Financial Analyzer. Every figure is company-specific and unguessable, and each Expert's out-of-scope question is answered by a *sibling* corpus, so the refusal also proves restricted isolation. Stage the bundle rows as a candidate SQL file in the phase directory. Drive each Expert live in a freshly signed-up org, then promote only the proven rows into `198_starter_expert_library.sql`. Get the operator's F-4 ruling before planning locks SC#1.

## Measured facts (claims checked against the code/DB on 2026-09-29)

| # | Claim / question | Measured | Source |
|---|---|---|---|
| M-1 | The install path has no Expert-specific branch | TRUE. `install_expert` gates on `is_system` + `slug` + `has_corpus(slug)`. The corpus, folder name and filenames all come from the manifest. The only Expert-specific literal under `backend/app` is `financial-analyzer` inside a **docstring** at `db/experts.py:20`. | [VERIFIED: codebase grep] |
| M-2 | A new `is_system` row appears in every entitled org's catalog automatically | TRUE. `list_expert_bundles_for_caller` uses `org_filter = "is_system = true OR org_id = $n"` and `visibility_clause` starts with `is_system = true`, ordered `is_system DESC, name ASC`. | [VERIFIED: `backend/app/db/experts.py:228-303`] |
| M-3 | Catalog/card/modal need no change for 5 Experts | TRUE. Rows render from the one list read. Category pills are **derived** from row `category` (`expertCatalog.ts`), so 5 categories produce 5 pills with no edit. The empty state is `"No Experts are available to you yet."` and a refusal renders the server sentence, never a blank page. | [VERIFIED: `ExpertCatalogPage.tsx:238-335`] |
| M-4 | "A newly created org sees the library" | ⛔ **FALSE today.** `handle_new_user` creates a personal org with `subscription_tier NULL`. `resolve_org_entitlement` fails closed on NULL (`db/entitlements.py:152-156`), and `experts` is `enterprise`-only (mig 186 rows). The router-level `require_capability("experts")` returns a 403 for the **list** too. Local DB: **12 of 50 orgs are NULL-tier**. 266 set `enterprise` by hand for its U1/U2/U3 (`evidence/00`). | [VERIFIED: code + local DB query] |
| M-5 | ROADMAP says 266 "Not started" | **The progress TABLE row is stale.** ROADMAP line 75 is `[x] … completed 2026-09-25`, all five 266 plans are `[x]`, and `266-VERIFICATION.md` reads `status: passed`. Migrations 195 and 197 are applied locally (`expert_installs` exists; `runs.expert_id` exists). Five orgs have the Financial Analyzer `installed`. This is the known `phase.complete` roadmap gap. | [VERIFIED: ROADMAP.md:75,219; local DB] |
| M-6 | 267 dependency status | 267 is **`human_needed`** (`267-VERIFICATION.md`): its independent review and operator G-4 confirmation are owed. Its code (the additive tool floor, D-267-01) is shipped, and 269 inherits it. | [VERIFIED: 267-VERIFICATION.md:1-8] |
| M-7 | Next migration number | **198** (latest is `197_runs_expert_attribution.sql`). D-269-07 is correct. | [VERIFIED: `ls supabase/migrations`] |
| M-8 | `regenerate-full-schema.sh` will carry the seed rows | **FALSE.** It runs `pg_dump --schema-only`. A data-only migration produces **zero diff** in `full-schema.sql`. Greenfield seed rows travel only through `docs/OPERATOR.md` Step-3, which lists 9 seeds up to `089`. **None of 186/187/189 is listed**, so a greenfield box has no Financial Analyzer and no `tier_capabilities` rows today. | [VERIFIED: `scripts/regenerate-full-schema.sh:99-102`, `docs/OPERATOR.md:178-207`, `check-deploy-drift.sh` output] |
| M-9 | Adding `198` to Step-3 is harmless | ⚠ **It is not.** `check-deploy-drift.sh` soft-warns only for seed-like migrations *above the highest listed seed*. Listing 198 raises the ceiling from 089 to 198, which **silences** the current WARN naming 25 unlisted seed-like migrations (including 186/187/189/195). `OPERATOR.md:269-272` records this trap itself. | [VERIFIED: `scripts/check-deploy-drift.sh:148-187`, run output] |
| M-10 | Financial Analyzer copy matches its corpus | ⚠ **FALSE.** Mig 189's `example_output` reads `EBITDA Margin: 24.3% (+180 bps YoY) / Operating Cash Flow: $412M`. The corpus says **30.8% (+380 bps)** and **$29.1M**. Its prompt suggestion "quarter-over-quarter revenue" is also unanswerable, because the corpus is YoY only. The detail view (SC#1 "working detail view") therefore shows figures the Expert cannot cite. | [VERIFIED: mig 189 §5 vs `acme_q3_2026_financial_report.md`] |
| M-11 | `web_search` is available inside an Expert thread | TRUE. PACK-21 made the Expert tool set a superset (`run_producer.py:511-514`), `web_search_enabled` is `bool(tavily_api_key)`, and the key is set in `backend/.env`. | [VERIFIED: `config.py:1253-1255`, `.env` key presence] |
| M-12 | A system row with no corpus on disk | The overlay sets `install: None` and `knowledge_folder_ids: []`, so the card draws **Start Chat** (the legacy "no install" arm). A run then fails with `ExpertScopeUnavailable("… has no knowledge installed … Install it from Experts first")`, **and there is no Install button to press.** | [VERIFIED: `expert_install_service.py:341-352`, `run_producer.py:484-489`, `ExpertCard.tsx:30`] |
| M-13 | Duplicate content across corpora | `async_mint_document_row(on_conflict="link")` dedups by content hash per (org, user). A corpus file byte-identical to any file the installer already holds elsewhere in the org raises `ExpertInstallConflict` (409). Each corpus file must therefore be unique content. | [VERIFIED: `expert_install_service.py:603-632`] |
| M-14 | Corpus format limits | Text only (`text/*` or `application/json`), `FILENAME_RE ^[A-Za-z0-9._-]+$`, `SLUG_RE ^[a-z0-9-]+$` (fullmatch), CRLF normalised. `.gitattributes` already pins `backend/app/experts/corpora/**/*.md` and `*.json` to `eol=lf`, so new directories are covered with no edit. No `.py` may exist under `backend/app/experts` (fenced by `test_266_corpus_verbatim.py:185-189`). | [VERIFIED: `expert_corpus.py`, `.gitattributes`] |
| M-15 | Frontend has an Expert-slug literal outside comments | ⚠ YES. `ExpertAuthoringStudio.tsx:740` contains `placeholder="financial-analyzer"`, a JSX string, not a comment. A frontend-wide slug fence would fire on it at birth. | [VERIFIED: grep] |
| M-16 | Reported bugs routed to 269 | None. No open `surface: Agentic-RAG` report names Experts, the catalog or install in `affected_areas`, and none has `folded_into: 269`. | [VERIFIED: `.planning/reported-bugs/` sweep] |
| M-17 | Seeds sweep | `check-seeds-register.cjs --phase 269` passes with **0 plans** ("phase declares NO surfaces"), which is vacuous. **Re-run after PLAN.md files exist.** SEED-244 (`status: planted`) is the origin; SEED-084 (starter *workflow* library) is the sibling, not folded. **No seed records F-4.** | [VERIFIED: script run] |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Starter Expert definitions (name, copy, icon, category, scope_mode, prompts) | Database / Storage (`expert_bundles` rows, `org_id NULL`, `is_system`) | — | An Expert is DATA (Extension Contract). The migration is the only writer; system rows are not tenant-writable (`expert_bundles_write_policy`). |
| Sample knowledge (corpora) | Repo files → API tier reads them | Database (per-org copy after install) | D-266-05: the repo is the tenant-free source. The per-org copy is written only at install. |
| Install (copy + ingest + embed) | API / Backend (existing `POST /experts/{id}/install`) | Database (`expert_installs`, `documents`, `document_chunks`) | Unchanged 266 path. The org comes only from the validated active org. |
| Catalog first-run / install states | Browser / Client (existing `ExpertCatalogPage` / `ExpertCard` / `ExpertDetailModal`) | API (list + overlay) | No client change. The client renders what the overlay derives. |
| Entitlement to see the catalog | API / Backend (`require_capability("experts")`) | Database (`organizations.subscription_tier`, `tier_capabilities`) | F-4 lives here. Not a UI problem and not an install problem. |
| Proof (PACK-27) | Live backend + real model, evidence joined in SQL | Browser (Chrome G-4 rows) | Mock and fixture tests are not evidence (SC#4). |

## Standard Stack

No new libraries, packages or services. Everything reuses shipped modules:

| Component | Location | Role in 269 |
|---|---|---|
| Corpus loader | `backend/app/services/expert_corpus.py` (183 L) | Reads the new corpora unchanged. |
| Installer | `backend/app/services/expert_install_service.py` (658 L) | Installs the new Experts unchanged. |
| Resolver | `backend/app/services/expert_service.py::resolve_expert_bundle` | Reads the caller org's install and yields the folder scope, unchanged. |
| Seed migration shape | `supabase/migrations/187_expert_bundles.sql` (INSERT … `ON CONFLICT (slug) WHERE is_system = true DO UPDATE`) + 189 (presentation columns) | The template for 198. |
| Backend tests | pytest in `backend/venv` (Python 3.12.6) | New unit fences. |
| Migration text tests | `backend/tests/unit/test_266_migration_196_shape.py` pattern | Template for the 198 shape test. |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed in this phase. slopcheck was not run, because there is nothing to check.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed:** none. **Packages flagged:** none.

## Architecture Patterns

### System Architecture Diagram

```
 repo: backend/app/experts/corpora/<slug>/{manifest.json, *.md}      migration 198 (candidate → promoted)
            │  (DATA, read never imported)                                   │ INSERT is_system rows, org_id NULL
            │                                                                 ▼
            │                                              public.expert_bundles (5 system rows)
            │                                                                 │
 new user ──┼─ signup → handle_new_user → personal org (tier NULL!) ──[F-4]──┤
            │                                                    tier set?   │ no → 403 entitlement sentence on /experts
            │                                                         yes    ▼
            │                              GET /experts → list_expert_bundles_for_caller (every is_system row)
            │                                   → overlay_install_state (has_corpus(slug)? → Install / not installable)
            │                                   → ExpertCatalogPage: 5 Install cards (admin) / reason pill (member)
            │                                                                 │ admin presses Install
            ▼                                                                 ▼
   load_corpus(slug) ◄──────────────── POST /experts/{id}/install → claim expert_installs(org,bundle)
            │                              → folder (is_org_shared, user JWT) → async_mint_document_row per file
            └──────────────► bytes ───────→ _enqueue_or_splice → ingest worker → chunks + embeddings (org-stamped)
                                                                              │ derived state: ready
 thread (active_expert_id = X) → run_producer → resolve_expert_bundle(X, active org)
      → install folder only (restricted) → compose_expert_scope → retrieval over that folder only
      → answer cites corpus figure  |  out-of-scope Q (sibling corpus) → 0 hits in X's folder → refusal
      → evidence: audit_log search.query ⋈ documents.org_id/folder_id ; chunk LIKE figure ; runs.org_id
```

### Recommended file layout

```
backend/app/experts/corpora/
├── financial-analyzer/          # existing — byte-unchanged (pinned verbatim to mig 188)
├── contract-reviewer/           # NEW  manifest.json + 2-3 .md files
├── hr-policy-advisor/           # NEW
├── security-compliance/         # NEW
└── operations-analyst/          # NEW
supabase/migrations/198_starter_expert_library.sql       # promoted after proof (proven rows only)
backend/tests/unit/test_269_starter_corpora.py            # corpus contract over the DERIVED slug set
backend/tests/unit/test_269_migration_198_shape.py        # org-portable, bijection, closed icon set
backend/tests/unit/test_269_no_expert_specific_code.py    # D-269-08 fence (RED-driven)
.planning/phases/269-starter-expert-library/
├── 269-candidate-bundles.sql     # staging only — see Pattern 2
└── evidence/00-…, 01-…, NN-<slug>-{install,cited,refusal}.txt (+ catalog PNGs)
```
(Slugs and names are proposals under Claude's Discretion. The planner may rename them before the corpora are authored, and never after a row is applied: `slug` is not updatable, `ExpertBundleUpdate` WR-03.)

### Pattern 1: An Expert = one corpus directory + one bundle row, and nothing else
**What:** A directory whose name equals the bundle `slug`, a `manifest.json` (`folder_name`, `files[{filename, mime_type}]`), and text files. The bundle row carries presentation fields only.
**Rules measured from the code:**
- `folder_name` must be **distinct per Expert**. It becomes the Library folder name and the `scoped_folder_path` the prompt names (`compose_expert_scope`).
- Filenames should be distinct across corpora, and **content must be distinct** (M-13).
- Put a first-line label in every new file, e.g. `> SAMPLE DATA: ACME Corporation is a fictional company. For demonstration only.` (D-269-04). ⛔ Never add it to `acme_q3_2026_financial_report.md`: that file is pinned byte-equal to migration 188 (`test_266_corpus_verbatim.py:62-69`).
- Keep files small (roughly 1.5 to 5 KB each, 2 to 3 files per Expert) and put the key figures in labelled Markdown tables. The Financial Analyzer's 2,359-byte file indexed as one chunk and was retrieved reliably (`evidence/06`, chunk_index 0).
- `required_connections = '{}'` and `member_skills = '{}'` for the four new Experts. A required connection would put the card in the 267 "Requires X, not connected" state, and a member skill would need a system skill row, which is a second seed.
- `scope_mode = 'restricted'`. The refusal proof depends on it, because a restricted scope means *the Expert's folders only* (`expert_scope.py:129-140`).
- `visibility = 'public'`, `is_enabled = true`, `created_by = '00000000-0000-0000-0000-000000000001'` (the sentinel; `created_by` has no FK, mig 187).
- `icon` from the closed map {`chart`,`scale`,`shield`,`briefcase`,`truck`,`terminal`,`cpu`,`database`,`book`,`file-text`,`sparkles`} (`expertIcon.tsx`). An unknown key silently renders `Sparkles`.
- Pydantic ceilings (`models/expert.py:48-63`): name ≤ 120, category ≤ 64, `when_to_use` ≤ 500, `example_output` ≤ 4000. `prompt_suggestions` is `[{title, prompt}]`.
- ⛔ `example_output` and every `prompt_suggestions[].prompt` must be answerable **from the corpus, with the corpus's own figures** (M-10 is the counter-example).

### Pattern 2: Candidate → prove → promote (honours D-269-09 literally and never edits an applied migration)
**The tension:** the 266 path installs only a bundle that already exists as a DB row, yet D-269-09 admits a row to the migration only after its live proof. Committing 198 early and editing it after a failed drive would mean **re-editing a migration already applied locally**, the anti-pattern recorded at Phase 163.
**Recommended mechanism:**
1. Commit all four candidate rows as `.planning/phases/269-starter-expert-library/269-candidate-bundles.sql`. It uses the exact 198 statement shape and is a planning artifact, not a migration: the ledger and drift gates exempt `.planning/`.
2. Apply it to the **local** DB, where the upsert is idempotent. It contains no install code, so this is not the "bespoke seed script" failure. Installation still runs only through `POST /experts/{id}/install`.
3. Drive each Expert live (Pattern 4).
4. Promote **only the proven rows**, verbatim, into `supabase/migrations/198_starter_expert_library.sql`, in the same commit as the evidence, then apply 198 locally (a no-op upsert over the candidate rows).
5. For a failed Expert: `DELETE FROM expert_bundles WHERE id = '<fixed id>' AND is_system` locally, remove its corpus directory (or keep it, and record that decision explicitly), and record the failure in the UAT log with its evidence (D-269-09: ship fewer, never weaken).

Alternative, if the operator prefers: commit 198 with the candidates up front and accept a post-apply edit. **Not recommended.**

### Pattern 3: Refusal by sibling corpus (the strongest out-of-scope proof)
For Expert X, pick an out-of-scope question whose answer **is present in another starter corpus installed in the same org** (sibling Y). Because X is `restricted`, its retrieval reads only X's install folder, so a correct refusal shows two things at once: X refused, and X could not read Y even though Y's answer sits in the same org. The 266 Financial Analyzer refusal ("What is the employee vacation policy?") becomes this test for free once the HR Expert is installed.
⚠ **Pass condition:** the answer must not contain Y's figure literal; the window's `search.query` rows must return 0 ids or only X's folder ids; and **no `web_search` call** may appear in the assistant message's `messages.tool_calls` (M-11). A refusal that consults the web and then answers is a **FAIL**, not a pass.

### Pattern 4: Live evidence per Expert (the 266 shape, reused)
Precedent: `266-UAT-LOG.md` and `evidence/00`, `01`, `06`. Driven through the public API against the live local backend, with the helper script and tokens kept in the session scratchpad and never in the repo.
- **00-users-and-orgs:** a fresh user created through public `POST /auth/v1/signup` (anon key from `GET /public-config`). Record `org_members` and the personal org's `subscription_tier` **before and after** whatever F-4 ruling applies. Prove the active org: send `X-Org-Id` on every request and never trust "the dev account", which is in two orgs.
- **catalog:** `GET /experts` shows 5 rows, each `install.state = not_installed`, `can_install` true for the admin. Add one member-role user showing the reason pill. Chrome G-4 screenshot of the 5 cards.
- **install (per Expert):** `POST /experts/{id}/install` returns 202, then poll until `ready`. SQL: `expert_installs` row `installed`; the install folder's documents `completed`, `chunk_count > 0`; `count(*) FROM document_chunks WHERE document_id = ANY(…) AND embedding IS NOT NULL` > 0 (266 failure line: "complete with zero embeddings"); every row carries the test org's `org_id`.
- **cited (per Expert):** `PATCH /threads/{id}` `{active_expert_id}`, then `POST /threads/{id}/messages` with an explicit `model` + `provider`. Regex the figure literal in the answer. Join `audit_log(action_type='search.query').metadata->'document_ids'` to `documents` (org_id = the test org, folder_id = the install folder). Read `document_chunks … LIKE '%<figure>%'`. Check `runs.org_id` (SEED-314 is answered, so this should now match the active org).
- **refusal (per Expert):** as Pattern 3.
- Record `model`, `provider` and the embedding model in every file (LM Studio can silently serve a different embedding model, per project memory).

### Anti-Patterns to Avoid
- **An Expert-specific branch anywhere** (`if slug == …`, a per-Expert manifest reader, a special folder). This is ROADMAP failure line 1. Fenced by `test_269_no_expert_specific_code.py`.
- **Hardcoded org ids in 198** (the mig 188 → 193 lesson). 198 must not reference any org at all.
- **Seeding documents/chunks/folders in SQL** (mig 188's retired approach: one seed org, failed status, zero embeddings, cross-tenant read). Knowledge moves only through install.
- **Figures that general knowledge or the web can answer.** "GDPR requires breach notification within 72 hours" proves nothing about retrieval. Use invented, company-specific numbers.
- **Editing `acme_q3_2026_financial_report.md`.** It is pinned verbatim.
- **Listing only 198 in OPERATOR Step-3** (M-9): that silences the drift WARN for 25 real gaps.
- **Touching the catalog components for copy or layout.** `ExpertCard.tsx`, `ExpertDetailModal.tsx` and `expertCatalog.ts` crossed the G-5 threshold in 267, so "the next phase proposes a refactor first". 269 needs none of them. Keep it that way.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Getting sample knowledge into an org | A seed script, SQL document/chunk inserts, a per-Expert loader | `POST /experts/{id}/install` (266) | Org stamping, RLS writer, dedup, re-install idempotency, embeddings: all solved, all fenced. |
| Deciding if an Expert is installable / ready | A stored flag or per-Expert state | `overlay_install_state` / `derive_install_state` | Readiness is derived from documents (D-266-03), with one writer per fact. |
| Proving retrieval came from the org's copy | Trusting the answer text | `audit_log search.query` ⋈ `documents.org_id` + chunk literal (266 evidence 06) | The answer can cite a figure the model guessed. The join is what proves provenance. |
| Stripping comments/docstrings in fences | Regex over source text | Python `ast` (skip `Expr(Constant(str))` docstrings); TS `frontend/src/lib/stripComments.testutil.ts` | 266/242 lessons: a fence satisfied by a comment is vacuous. |
| Icon rendering | A new icon key | The closed 11-key `EXPERT_ICON_MAP` | The key set is pinned (`expertIcon.test.tsx` case 5); an unknown key falls back to `Sparkles`. |

**Key insight:** every hard part of this phase already exists and is fenced. The failure modes left are *honesty* failures (unprovable figures, a vacuous fence, a gate that cannot see F-4), not engineering failures.

## Proposed domains (Claude's Discretion; validate each before locking, D-269-02)

All proposals are **[ASSUMED]** design, not verified facts. They become locked only when the authored corpus contains the figure (unit test) **and** the live drive passes. One fictional company, **ACME Corporation**, keeps the library coherent with the Financial Analyzer (whose corpus already names three Tier-1 SE-Asia suppliers). The new corpora must not contradict it.

| # | Name / slug | icon · category | Corpus (2-3 files) | Candidate cited figure (invented, unguessable) | Out-of-scope Q (answered by sibling) |
|---|---|---|---|---|---|
| 1 | Financial Analyzer / `financial-analyzer` (exists) | chart · Finance | unchanged | `$124.5` / `+18.2%` (266-proven) | "What is ACME's paid-time-off allowance?" → HR |
| 2 | Contract Reviewer / `contract-reviewer` | scale · Legal | MSA summary with a fictional customer; renewal & termination schedule; clause playbook | e.g. liability cap `$2.35M`; termination notice `75 days` | "What is ACME's on-time delivery rate?" → Ops |
| 3 | HR Policy Advisor / `hr-policy-advisor` | book · HR | employee handbook excerpt; leave & benefits table; travel/expense policy | e.g. `23 days` PTO; `18 weeks` parental leave; `$1,850` learning stipend | "What is the liability cap in the customer MSA?" → Legal |
| 4 | Security & Compliance / `security-compliance` | shield · Compliance | incident-response policy; control-test results; access-review standard | e.g. customer notice within `36 hours`; RTO `4 hours` / RPO `15 minutes`; `14 of 16` controls passed | "What was ACME's Q3 revenue?" → Finance |
| 5 | Operations Analyst / `operations-analyst` | truck · Operations | supplier scorecard; fulfilment KPIs; inventory report | e.g. on-time delivery `94.7%`; supplier lead time `38 days`; top-supplier share `41%` | "How many weeks of parental leave?" → HR |

Rule for every figure: it appears in **exactly one** corpus (a unit test enforces this), in a labelled table row, and is not a well-known public constant. Rule for every out-of-scope question: phrase it about **ACME's own internal documents** ("our", "ACME's"), so neither the web nor general knowledge can answer it.
**Validation order per domain (D-269-02):** author corpus → unit test asserts the figure literals are present → install locally → drive → only then promote the row into 198.

## Common Pitfalls

### Pitfall 1: F-4 makes SC#1 unreachable for a truly new org
**What goes wrong:** the new org sees *"Capability 'experts' requires 'enterprise' tier (current tier: 'unassigned')"* instead of the library.
**Why:** `handle_new_user` → NULL tier; `experts` is `enterprise`-only; the check fails closed (D-258-06, deliberately).
**How to avoid:** get an operator ruling before planning (Open Question 1). Never set a tier silently in a drive and call SC#1 passed. If the ruling is "operator assigns tiers" (status quo, option b), SC#1's evidence must record the tier write as a named step, and the ROADMAP SC#1 wording should be qualified in the same commit.
**Warning signs:** an evidence file that begins after the tier was set; a drive whose 00-file does not print `subscription_tier` before and after.

### Pitfall 2: A "cited" answer or "refusal" that came from the model or the web
**What goes wrong:** the answer contains the figure, but retrieval never touched the corpus; or the refusal was actually a web answer.
**How to avoid:** invented figures (§Proposed domains); the `search.query` ⋈ `documents` join; inspect `messages.tool_calls` for `web_search`; out-of-scope questions about ACME-internal facts.
**Warning signs:** a `search.query` row with 0 ids but an answer carrying the figure; any `web_search` entry on a refusal turn.

### Pitfall 3: Deploy order — rows before corpora
**What goes wrong:** 198 is applied (to prod, or locally) while the running backend has no `corpora/<slug>/`. Each new Expert then shows **Start Chat** and refuses at run time, with no Install button (M-12).
**How to avoid:** the prod parity checklist orders it: backend image carrying the corpora **live first**, then 198. 195/196/197 must precede both (266/268 parity docs). Locally, the corpora are committed before the candidate SQL is applied.
**Warning signs:** a catalog card with `install: null` for a new system row.

### Pitfall 4: A vacuous "no Expert-specific code" fence
**What goes wrong:** the fence greps text, matches nothing (or matches a docstring), and passes forever.
**How to avoid:** derive the slug set with `CORPORA_ROOT.iterdir()` (never a constant) plus the fixed bundle ids from 198. Scan `backend/app/**/*.py` with `ast`, flagging any `Constant(str)` equal to or containing a slug or id, **excluding docstrings**, and assert the scanned-file count is > 0. For the frontend, scan with `stripComments` and **allowlist exactly** `ExpertAuthoringStudio.tsx`'s `placeholder="financial-analyzer"` with a stated reason (M-15), or scope the scan to `components/experts/catalog/` + `lib/api/experts.ts`. **Drive it RED**: plant `if bundle.get("slug") == "<a starter slug>": ...` in a copy of `expert_install_service.py`, show the failure, restore, and prove the file md5-identical.
**Warning signs:** a fence that was never seen failing.

### Pitfall 5: The OPERATOR Step-3 ceiling silences the drift warning (M-9)
**How to avoid:** if 198 is added to Step-3, add the seeds a greenfield Expert catalog actually needs in the same commit (**186** `tier_capabilities`, **187** Financial Analyzer row, **189** presentation backfill + `experts:manage` role permissions, **198**). All four were read and are idempotent: `IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `ON CONFLICT`. Otherwise record an explicit decision and plant a seed for the greenfield seed-row gap; none exists today. Do **not** expand 269 into fixing the whole greenfield story (the drift WARN names 25 migrations, including role/permission seeds).

### Pitfall 6: SQL text traps in 198
- Apostrophes must be doubled (`ACME''s`). Prefer dollar-quoting (`$json$…$json$::jsonb`) for `prompt_suggestions`.
- **No `--` inside string literals.** The shape-test precedent strips `--` line comments naively (`test_266_migration_196_shape.py:25-33`), and the em-dash `—` is safe.
- `ON CONFLICT (slug) WHERE is_system = true DO UPDATE` needs the partial unique index `idx_expert_bundles_system_slug`, which exists.
- Use fixed UUIDs for the new rows (e.g. `…000000002691`..`…2694`) so evidence and tests can reference them. Check that they do not collide with `…0259`..`…0264`.

### Pitfall 7: The Financial Analyzer's detail view advertises uncitable figures (M-10)
**What goes wrong:** SC#1 requires a *working* detail view, but the Financial Analyzer's sample output shows `24.3%` / `$412M`, which its corpus contradicts.
**How to avoid:** an operator decision (Open Question 2). A one-row `UPDATE` in 198 would correct `example_output` and the quarter-over-quarter prompt to corpus figures (`30.8%`, `$29.1M`, YoY).

### Pitfall 8: Vacuous gates at zero plans / zero watched files
`check-seeds-register --phase 269` and `check-hot-file-ledger.cjs` both need PLAN.md files. The ledger gate exempts `.md/.json/.sql`, migrations and `.planning/`, so a data-only phase legitimately reads "watched: 0". The plan should state that expectation, so the result is not read as a skipped audit.

## Code Examples

### 198 row shape (from mig 187 + 189 columns; values illustrative)
```sql
-- Source: supabase/migrations/187_expert_bundles.sql (INSERT/ON CONFLICT), 189 (presentation columns)
INSERT INTO public.expert_bundles (
    id, org_id, created_by, name, slug, description, scope_mode,
    member_skills, required_connections, knowledge_folder_ids, prompt_suggestions,
    visibility, is_system, is_enabled, icon, category, when_to_use, example_output
) VALUES (
    '00000000-0000-0000-0000-000000002692'::uuid,
    NULL,                                                   -- org-portable: no org is ever named
    '00000000-0000-0000-0000-000000000001'::uuid,           -- sentinel author, no FK (mig 187)
    'HR Policy Advisor', 'hr-policy-advisor',
    'Answers questions about ACME''s employee handbook, leave and benefits. Answers strictly from the installed sample documents or says it cannot find it.',
    'restricted', '{}'::text[], '{}'::text[], '{}'::uuid[],
    $json$[{"title":"Parental leave","prompt":"How many weeks of parental leave does ACME offer, and who is eligible?"}]$json$::jsonb,
    'public', true, true,
    'book', 'HR',
    'When you need a policy answer from the employee handbook, with the section it came from.',
    'Parental leave: 18 weeks paid (handbook §4.2)'
)
ON CONFLICT (slug) WHERE is_system = true DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description, scope_mode = EXCLUDED.scope_mode,
    prompt_suggestions = EXCLUDED.prompt_suggestions, visibility = EXCLUDED.visibility,
    is_enabled = EXCLUDED.is_enabled, icon = EXCLUDED.icon, category = EXCLUDED.category,
    when_to_use = EXCLUDED.when_to_use, example_output = EXCLUDED.example_output, updated_at = now();
```

### manifest.json (the loader reads only these keys)
```json
{ "folder_name": "HR Policies & Handbook",
  "files": [ { "filename": "acme_employee_handbook_2026.md", "mime_type": "text/markdown" },
             { "filename": "acme_leave_and_benefits_2026.md", "mime_type": "text/markdown" } ] }
```

### Corpus contract test over the DERIVED set (sketch)
```python
# Source pattern: backend/tests/unit/test_266_corpus_verbatim.py
from app.services.expert_corpus import CORPORA_ROOT, load_corpus

SLUGS = sorted(p.name for p in CORPORA_ROOT.iterdir() if p.is_dir())
assert len(SLUGS) >= 2, "derived set collapsed — a fence over nothing is vacuous"

EXPECTED_FIGURES = {  # per-slug literals the live transcript will cite (C-7: assert only what the file contains)
    "financial-analyzer": [b"$124.5", b"+18.2%"],
    # "hr-policy-advisor": [b"18 weeks", ...], ...
}

def test_every_corpus_loads_and_is_text():
    for s in SLUGS:
        c = load_corpus(s)
        assert all(b"\r" not in f.raw for f in c.files)

def test_folder_names_filenames_and_hashes_are_unique_across_corpora():
    corpora = [load_corpus(s) for s in SLUGS]
    folders = [c.folder_name for c in corpora]
    names = [f.filename for c in corpora for f in c.files]
    hashes = [f.sha256 for c in corpora for f in c.files]
    assert len(set(folders)) == len(folders) and len(set(names)) == len(names) and len(set(hashes)) == len(hashes)

def test_each_cited_figure_lives_in_exactly_one_corpus():
    raw = {s: b"\n".join(f.raw for f in load_corpus(s).files) for s in SLUGS}
    for slug, figs in EXPECTED_FIGURES.items():
        for fig in figs:
            assert [s for s in SLUGS if fig in raw[s]] == [slug], (slug, fig)
```

### Evidence join (from 266 evidence/06, verbatim shape)
```sql
SELECT a.created_at, a.metadata->>'query_text' AS query_text, d.id, d.org_id, d.folder_id, d.filename
FROM audit_log a
CROSS JOIN LATERAL jsonb_array_elements_text(a.metadata->'document_ids') x(doc)
JOIN documents d ON d.id = x.doc::uuid
WHERE a.action_type = 'search.query' AND a.user_id = $user AND a.created_at > $turn_start
ORDER BY a.created_at;
```

## Guardrail dispositions (for the planner)

| Rule | Status | Recommendation |
|---|---|---|
| G-2 sketch-first | FIRES (ROADMAP) | No new component, so the approval target is the **first-run catalog with 5 cards** (admin: 5× Install; member: 5× reason pill; one Installing; one Ready) using the real bundle copy. The existing sketch `.planning/sketches/261-262-expert-authoring-and-catalog` has the card shape. A lightweight `/gsd:sketch` variant with realistic copy, approved by the operator, before planning. |
| G-4 lived-experience | FIRES | Scenarios from CONTEXT: (1) a new org opens Experts and sees 5 cards, never blank; (2) install one and watch Installing → Ready; (3) ask a cited question and see the figure plus the source file; (4) ask out-of-scope and get a refusal naming what it searched. Drive in Chrome. |
| G-5 hot files | Audit | Recommended scope touches **no** watched source file. `db/experts.py` (6/4/749, FIRES), `expert_service.py` (12/7/625), `ExpertCard.tsx` (4/3/295), `ExpertDetailModal.tsx` (5/3/530), `expertCatalog.ts` (11/3/478, ledger row stale at `8/3/455`) are **honoured by not modifying them**. If a plan must touch one, propose the refactor first (267's ledger note). |
| G-8 plan count | Target 3 | See "Suggested plan shape". |
| SC#10 cross-provider | Does not fire | No streaming, agent-loop, provider-routing or UI-state change. PACK-27 asks for *one* live conversation per Expert. Record model + provider and state this disposition in VALIDATION/UAT explicitly. |
| security_enforcement | ON | See Security Domain. |

## Suggested plan shape (G-8: 3 plans, 3 waves)

1. **269-01 Corpora + fences (TDD).** Author 4 corpora and manifests. Write RED-first unit fences: corpus contract, figure uniqueness, the slug/id AST fence (driven RED with a plant, then restored md5-identical), and the candidate-SQL shape (org-portable, no org UUID literal, closed icon set, restricted, empty connections/skills, bijection with the corpus directories). Commit `269-candidate-bundles.sql`. Apply the candidate SQL locally.
2. **269-02 Live proof + promote.** Fresh signup org → the F-4 step as ruled → Chrome G-4 (5 cards, admin vs member) → install ×4 (plus the Financial Analyzer in the same org) → cited + refusal drives per Expert (Pattern 4) → evidence files. Promote proven rows into `198_starter_expert_library.sql`, add the evidence-gate test (every slug seeded in 198 has its three evidence files), apply 198 locally, and run `regenerate-full-schema.sh` (expect zero diff, M-8). Handle any failed Expert per D-269-09.
3. **269-03 Closeout.** OPERATOR.md Step-3 (per Pitfall 5 ruling), `269-PROD-PARITY.md` (order: 195→196→197 → backend with corpora → 198 → `get_advisors(security)` → F-4 per ruling), registers (SEED-244 → `folded`/answered with routing; fix the stale ROADMAP 266 progress row; STATE), gates (backend baseline ≤ 71, drift, seeds `--phase 269`, ledger).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Seed knowledge as SQL rows in one seed org (mig 188) | Corpus as repo files, copied per org at install (mig 195 / 266) | 2026-09-24 | 269 must never seed documents or chunks. |
| `is_system_folder` bypass (global folder for every org) | Resolver reads the caller org's `expert_installs` row | 266-01 | New Experts are scoped per org automatically. |
| Expert tool set filtered to a floor | Expert ⊇ plain thread tools (PACK-21) | 267-01 | `web_search` is available in Expert threads, so refusal evidence must check for it. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The four proposed domains, names, slugs, icons and invented figures | Proposed domains | Low: Claude's discretion; validated by the drive before locking |
| A2 | ACME Corporation as the one fictional company for all five | Proposed domains | Low: operator may prefer distinct companies; the web-search risk is somewhat higher with a common name like "ACME" |
| A3 | Candidate SQL in the phase directory is an acceptable staging mechanism (not a "bespoke seed script") | Pattern 2 | Medium: if the operator reads it as a bespoke script, the fallback is committing 198 early and accepting a post-apply edit |
| A4 | 2-3 small files per Expert retrieve as reliably as the Financial Analyzer's single file | Pattern 1 | Medium: a figure split across chunks may not be retrieved; the drive catches it |
| A5 | `messages.tool_calls` is where a `web_search` call on the refusal turn is visible | Pattern 3/4 | Low: the column exists (`full-schema.sql:2184`); its per-call shape was not inspected |
| A6 | A lightweight sketch (not a full UI-SPEC) satisfies G-2 for an unchanged component set | Guardrails | Low: operator call |

## Open Questions

1. **F-4: how does a newly created org get a tier? (BLOCKING for SC#1)**
   - What we know: every signup org is NULL-tier; the whole Expert router refuses it; `experts` is enterprise-only; mig 194 made the tier non-client-writable; 266 left this as an operator decision (`266-PROD-PARITY.md` §F, options a/b/c). No seed or phase owns it.
   - What's unclear: whether SC#1's "newly created org" means a fresh signup (which needs a default-tier or capability change, a pricing one-way door per TIER-02) or a new org **after** the operator assigns its tier (status quo).
   - Recommendation: ask the operator before planning. Default recommendation: (b) keep operator-assigned tiers, qualify SC#1 to "a newly created org **with an Experts-entitled tier**", make the tier write a named, evidenced step in the drive, and plant a seed for option (a). A default-tier migration is a pricing decision and is out of this phase's scope.
2. **Fix the Financial Analyzer's uncitable `example_output` / quarter-over-quarter prompt in 198?** Recommendation: yes, one additional `UPDATE … WHERE slug='financial-analyzer' AND is_system` in 198, because SC#1 requires a working detail view. This needs operator confirmation, since it touches a shipped row.
3. **OPERATOR Step-3 breadth.** Recommendation: list 186, 187, 189 and 198 together (all idempotent), or record why not, and plant the greenfield-seed-gap seed either way.
4. **267's `human_needed` status.** 269 inherits 267's shipped behaviour, but 267's G-4 confirmation and independent review are owed. Recommendation: state the dependency in 269's VALIDATION/UAT, and do not claim 267 verified.
5. **Held-back corpora.** If a domain fails, delete its corpus directory, or keep it unseeded? Recommendation: delete it from the commit (dead data invites a later silent seed) and keep the attempt's evidence in `evidence/`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase Postgres :54322 | apply candidate/198, evidence SQL | ✓ (TCP accept) | — | — |
| Backend :8000 | live drives | ✓ (port open; operator starts backend per memory, so confirm it is the current code) | — | — |
| Redis :6379 | run buffer | ✓ | — | — |
| backend venv Python | tests, asyncpg apply | ✓ | 3.12.6 | — |
| Node | gates | ✓ | v24.19.0 | — |
| LLM key (DeepSeek, 266's drive model) | cited/refusal drives | ✓ key set | — | OpenAI key also set |
| Embedding provider | install → chunks | ✓ `EMBEDDING_*` set | — | — |
| Tavily (`web_search`) | *risk*, not a need | ✓ set | — | Refusal evidence must check `tool_calls` |
| Docker exec (`regenerate-full-schema.sh`) | full-schema regen | ✗ in the agent shell (memory: docker DENIED) | — | Operator runs `! bash scripts/regenerate-full-schema.sh`; expected zero diff |
| Chrome MCP | G-4 rows | assumed available (used in 266/267/268) | — | Operator drives the browser |

**Missing with no fallback:** none. **Migration apply path:** per the 266 precedent, the operator pastes into the SQL editor, or the orchestrator applies through the venv asyncpg `settings.postgres_dsn` **only with explicit operator consent** (the 266 memory records the operator granting that once, not as a standing rule).

## Testing approach (tdd_mode: on; nyquist_validation: off, so no Validation Architecture section)

- **Framework:** pytest via `backend/venv`. Quick run: `cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/test_269_*.py tests/unit/test_266_corpus_verbatim.py -q`. Gate: `node scripts/check-backend-unit-baseline.cjs` (ceiling **71 failed, zero headroom**; re-derive the pass count rather than quoting CLAUDE.md's 3497, since 266 measured 5650).
- **Order:** each fence is written and seen RED before the data that satisfies it (for example, the figure test is RED until the corpus contains the literal; the slug fence is RED against a planted branch). ⛔ Never commit a red test: it breaks the zero-headroom baseline. The evidence-gate test lands in the same commit as the evidence it checks.
- **No frontend change**, so the vitest count gate is unaffected. If any `.tsx` is touched, run `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root and `npx tsc -p tsconfig.app.json --noEmit` as a set diff.
- **Mock tests are not PACK-27 evidence** (SC#4). `test_260_financial_analyzer_conversation.py` is a unit test and proves nothing live.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | Unchanged: `require_capability("experts")` + `require_expert_manage` on install; `expert_bundles_write_policy` keeps system rows non-tenant-writable; `expert_installs` backend-write-only (mig 195); restricted scope isolation, proven live by the sibling-corpus refusal. |
| V5 Input Validation | yes | `expert_corpus` slug/filename fullmatch + path containment + text-only mime (unchanged, already fenced). |
| V6 Cryptography | no | — |

| Threat | STRIDE | Mitigation |
|---|---|---|
| Seed migration binds a specific org (mig 188 class) | Tampering / Info disclosure | 198 has `org_id NULL` only. Shape test: no UUID literal other than the declared bundle ids and the sentinel `…0001`. |
| Cross-tenant read via a starter Expert | Info disclosure | Per-org copy (266); the resolver reads the caller org's install. Evidence joins `documents.org_id` = the test org. |
| Restricted Expert with no install searching everything (266 CR-01) | Info disclosure | `ExpertScopeUnavailable` guard (`run_producer.py:484`) is unchanged. Pitfall 3 ordering prevents the no-corpus state. |
| Prompt injection inside a shipped corpus | Tampering | Corpora are authored by us and reviewed as data. Keep them to plain factual prose and tables, with no imperative "instructions to the assistant". |
| New migration granting `anon` / `PUBLIC` | Elevation | 198 is data-only, with no GRANT or function. Still run `get_advisors(security)` in the prod parity checklist (standing rule). |

## Sources

### Primary (HIGH confidence, read in this session)
- `backend/app/services/expert_install_service.py`, `expert_corpus.py`, `expert_service.py` (resolver), `expert_scope.py` (`compose_expert_scope`), `run_producer.py:455-545`, `api/experts.py:420-672`, `db/experts.py`, `services/entitlement_service.py`, `db/entitlements.py`
- `supabase/migrations/186`, `187`, `188` (skill/member_skills), `189`, `193`, `195`; `ls` of migrations (latest 197)
- `frontend/src/components/experts/catalog/ExpertCatalogPage.tsx`, `expertIcon.tsx`, `ExpertCard.tsx` / `ExpertDetailModal.tsx` (greps)
- `.planning/phases/266-*/266-PROD-PARITY.md` §F, `266-UAT-LOG.md`, `evidence/00`, `evidence/06`, `266-VERIFICATION.md`; `267-VERIFICATION.md`; ROADMAP §266-269 + progress table
- Local DB queries (system bundles, installs, NULL-tier count); `scripts/check-deploy-drift.sh` run; `scripts/check-seeds-register.cjs --phase 269` run; `scripts/check-hot-file-ledger.cjs` source; `docs/OPERATOR.md` Step-3; `.gitattributes`; `backend/.dockerignore` + `Dockerfile` (`COPY . .`, so the corpora ship in the image)
- `.planning/seeds/SEED-244-*.md`; `.planning/reported-bugs/` sweep

### Secondary / Tertiary
- None. No web or library research was needed: the phase adds no dependency and changes no provider behaviour.

## Metadata

**Confidence breakdown:**
- Install path / seed shape: HIGH (code + DB read directly)
- F-4 / greenfield / deploy-order pitfalls: HIGH (measured)
- Domain and corpus design: MEDIUM (proposals; the live drive is the validator)
- Evidence method: HIGH (266 precedent reproduced in shape)

**Research date:** 2026-09-29
**Valid until:** 2026-10-13 (fast-moving milestone; re-derive ledger triples and migration number at plan time)
