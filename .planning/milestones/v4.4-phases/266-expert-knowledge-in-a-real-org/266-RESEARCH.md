# Phase 266: Expert Knowledge in a Real Org - Research

**Researched:** 2026-09-24
**Domain:** Per-org provisioning of a first-party Expert's corpus through the one ingest path; tenant isolation in retrieval; Postgres RLS / migration discipline
**Confidence:** HIGH for code seams, schema and gates (all measured against the tree at `2bc236e3f`); MEDIUM for live-DB state (local Supabase refused `:54322` during research, and Docker probing is denied to agents; see Environment Availability)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Install trigger
- **D-266-01: Explicit Install.** The corpus reaches an org only when someone presses **Install** on
  the existing `ExpertDetailModal` (Phase 262). Nothing is auto-provisioned on first invite or on
  gaining a tier. Inviting an Expert that the org has not installed prompts the user to install it
  first, and says why. It never starts a run against an empty scope.
- **D-266-02: Install needs `experts:manage`.** Install reuses Phase 261's `require_expert_manage`
  gate. It writes org-wide Library content, so it is an admin act.
- **D-266-03: Installing → Ready → Failed states.** The card/modal shows `Installing…` until every
  copied document reaches a terminal success status. While installing, invite is blocked and the UI
  gives the reason. If any document fails to ingest, the UI shows `Install failed — retry` and names
  the cause. Retry is the re-install path (D-266-13).
- **D-266-04: Install is tier-gated through the one home.** The route goes through
  `require_capability('experts')` (Phase 258). A standard-tier org gets the plan-naming refusal, never
  a silent no-op. ⛔ No second tier check.

#### Corpus source
- **D-266-05: The corpus ships as files in the repo, keyed by Expert slug.** Example path:
  `backend/app/experts/corpora/financial-analyzer/acme_q3_2026_financial_report.md`. The researcher
  picks the exact path. The content is lifted **verbatim** from migration 188's `full_markdown`. This
  works the same locally and in prod, needs no seed org, and the installer **never reads another
  tenant's rows**.
- **D-266-06: Migration 195 retires 188's orphaned knowledge rows.** It deletes folder `…0260`,
  document `…0261` and chunks `…0262/…0263` (seed-only org, `status='failed'`, 0 embeddings). It
  clears the bundle's global `knowledge_folder_ids` for `financial-analyzer`. The reason for the
  original seed stays in the migration comment (SEED-177 / D-206-07 rule: retire deliberately, never
  silently).
  - ⚠ **Keep skill `…0264` (`financial_ratio_calculator`).** It is `is_system = true`, which
    `skill_visibility.py` treats as visible platform-wide, so it already reaches every org and is not
    part of SEED-304.
  - ⚠ **The migration number is 195, not 194.** 194 was taken during Phase 265
    (`194_org_plan_columns_not_client_writable.sql`, commit `9890ebd19`). The ROADMAP's "194" flag is
    stale; correct it beside the original.
- **D-266-07: The copy goes through the real ingest pipeline.** Each file is written to storage and
  processed by `_upload_pipeline` → `ingest_splice.splice_document`, the same path a user upload
  takes. ⛔ No second ingest path and no pre-chunked inserts. Success is judged by real embeddings:
  non-null vectors, chunk count > 0, and a terminal success status (SC#1).

#### How the Expert finds its per-org copy
- **D-266-08: A new `expert_installs` table (migration 195).** Proposed shape: `(org_id,
  expert_bundle_id, folder_id, status, installed_by, corpus_version, created_at, updated_at)`, with
  UNIQUE `(org_id, expert_bundle_id)` and RLS so a member reads only their own org's rows. The planner
  finalises the columns. The table is the per-org lookup, the home of the Installing/Ready/Failed
  state, and the idempotency key.
  - Rejected: a provenance column on `folders`, because install state and idempotency would have no
    clean home.
  - Rejected: a per-org clone of the bundle row, because updates to the first-party Expert would stop
    reaching orgs that installed it.
- **D-266-09: `resolve_expert_bundle` resolves folders for the caller's org.** For a first-party
  (`is_system`) bundle, the effective knowledge folders come from `expert_installs` for the caller's
  org. With no install row, the Expert has no knowledge, and D-266-01's prompt handles that.
  Org-authored bundles keep using `knowledge_folder_ids` unchanged.
- **D-266-10: Delete the `is_system_folder` bypass** (`backend/app/services/expert_service.py`, about
  line 478: `is_system_folder = f_user_id == SYSTEM_USER_ID and f_shared`). Folder validity becomes
  strictly caller-org. The bypass approved scope that retrieval could never read, because search
  filters by org, and that is exactly SEED-304's shape. Replace the line with a comment naming why.
  Add a fence test driven **RED against the old rule**.
- **D-266-11: The seam is `expert_service` only.** `backend/app/services/run_producer.py` (G-5
  FIRES) stays **byte-unchanged**. Its tuple already consumes `resolved.effective_folder_ids`, so G-5
  is honoured by construction. Record this in the ledger row. `backend/app/db/experts.py` (G-5 FIRES)
  gets new queries only, never edits to existing ones (the 263-01 precedent).

#### The copy inside the org
- **D-266-12: The installer owns the copy, and it is org-shared.** The folder and documents carry
  `user_id` = the installing admin, `org_id` = the active org and `is_org_shared = true`. ⛔ No
  `SYSTEM_USER_ID` rows in tenant orgs. `expert_installs.installed_by` records who installed it.
  - ⚠ The dev account belongs to **two orgs**. The install targets the **active** org (header /
    switcher), and the drive must prove which org was active, never assume it.
- **D-266-13: A normal, visible Library folder** (e.g. "Financial Reports & Filings"). It carries a
  small provenance note ("from Financial Analyzer"). Users may add or delete documents like in any
  folder, and the Expert reads whatever is there. There is no new lock concept.
- **D-266-14: Re-install restores what is missing and never overwrites.**
  - Install row + folder present → reuse the folder.
  - A corpus file missing **by filename** in that folder → ingest only that file.
  - Existing or edited documents → untouched.
  - Folder deleted → recreate it and repoint the install row.
  - A clean second install leaves documents, chunks and folders **identical** (SC#2).
  - ⛔ It never wipes and re-copies.
- **D-266-15: Uninstall is out of scope.** Losing the tier already hides the Expert (Phase 258), and
  the documents stay as ordinary org content.

#### Surface / guardrails
- **D-266-16: No G-2 sketch, by operator decision.** The UI change is one Install button plus three
  states on the shipped `ExpertDetailModal` / `ExpertCard`, and a provenance note on a Library folder.
  All of it reuses the existing ingest-status vocabulary. Record this under STATE.md guardrail
  overrides as a decision, not a skip.
- **D-266-17: Proof is live, not mocked.** `test_260_financial_analyzer_conversation.py` mocks
  `search_documents` and proves nothing about PACK-05, so it does not count. SC#3 is a **driven**
  two-org fence (org A cannot get org B's copy through search, chat retrieval or the Expert's scope).
  SC#4 is a live transcript in a real org, citing `$124.5M` / `+18.2%` from that org's copy, plus one
  refused out-of-scope question. Evidence must include the retrieved chunks' `org_id`, so a run that
  reads the seed org's rows cannot pass.

### Claude's Discretion
- The exact repo path and layout of the corpus directory, and how `corpus_version` is derived (for
  example a content hash).
- Whether install ingestion runs as a background task polled by the modal or via the existing
  ingest-status realtime/poll pattern. Realtime is a hint, so reconcile by fetch (D-v2.5-03).
- The route shape (for example `POST /experts/{id}/install`) and the response model.
- The exact wording of the states and the prompt on an uninstalled invite, within the existing Expert
  vocabulary.

### Deferred Ideas (OUT OF SCOPE)
- **Uninstall**: an explicit uninstall with a destructive-action guard, which would delete the folder
  and install row. Revisit when a starter library (269) makes installs common.
- **Corpus updates to installed orgs**: when a first-party corpus changes, how existing installs
  learn of it. `corpus_version` is recorded now so this is possible later, with no sync built.
- **Auto-provision on entitlement**: rejected for 266 in favour of explicit Install. Revisit if Phase
  269 wants a new org to open with the starter library already installed.

#### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md`: matched on generic keywords only (score 0.6). It is unrelated to
  Expert provisioning and was not folded.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PACK-18 | When an org installs (or is entitled to) a first-party Expert, the Expert's sample corpus is copied into that org and ingested there, reaching a terminal success status with real embeddings. | §Pattern 2 (installer mirrors `import_service.import_single_file` + `_enqueue_or_splice`: mint with explicit `org_id` → storage PUT → `ingestion_jobs` → worker `splice_document(job_id=…)`); §Pitfall 1 (explicit `org_id` is mandatory, the autofill trigger picks an arbitrary org); corpus measured at 2,359 B → 3 chunks at chunk_size 1000/200 |
| PACK-19 | Provisioning is idempotent and org-contained — re-installing does not duplicate, and a driven fence proves org A cannot retrieve org B's copy. | §Pattern 3 (CAS claim on `expert_installs`, missing-by-filename, failed doc re-driven not re-minted); §Pitfall 2 (user-scoped dedup + `(user_id, content_hash)` unique index break a two-org admin); §Pattern 4 (retrieval org gate = `current_user_org_ids()`, fence subject must be a single-org user); `tests/integration/_rls_harness.py` |
| PACK-20 | The Financial Analyzer answers from its report for a real user in a real org (cites `$124.5M` / `+18.2%`) and refuses one out-of-scope question — recorded live. Closes v4.3's PACK-05. | §Live drive recipe (per-request `model`/`provider`, `X-Org-Id`, evidence = `audit_log` `search.query` `metadata.document_ids` → `documents.org_id`); §Pitfall 7 (`$124.5M` is not a literal in the corpus, so assert a regex) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These carry the same authority as locked decisions. The planner must verify each plan against them.

- **venv** for the Python backend. Backend gate: `node scripts/check-backend-unit-baseline.cjs` (ceiling **71 failed**, zero headroom; last measured at Phase 265: `failed 71 ≤ 71, passed 5533, errors 0`).
- **No LangChain / LangGraph.** Raw SDK only. **Pydantic** for structured outputs and response models.
- **RLS on every table.** Users see only their own org's data. `expert_installs` needs RLS.
- **Migrations:** `supabase/migrations/<digits>_name.sql`. **Next is `195`.** Apply by **pasting into the Supabase SQL editor**. Never `supabase db push` or `db reset`. Then `bash scripts/regenerate-full-schema.sh` (no `--reset`). Never hand-edit `full-schema.sql`.
- **The PUBLIC-grant trap:** `REVOKE … FROM anon` is a no-op while a `PUBLIC` grant stands. Revoke from `PUBLIC`, then grant back what is needed. New tables inherit Supabase's default `GRANT ALL … TO anon, authenticated` (supplement :255-258).
- **ACL hand-mirror:** `regenerate-full-schema.sh` runs `pg_dump --no-privileges`, so every GRANT/REVOKE in 195 must also appear in `scripts/full-schema-supplement.sql` §5e, same commit. `node scripts/check-schema-acl-parity.cjs` fails otherwise (measured OK today: 183/183 mirrored).
- **Supabase MCP:** reads against production are free; **every write needs explicit per-action operator approval** (migration 195 on prod included). Run `get_advisors(security)` in the deploy parity checklist.
- **No blocking I/O in async handlers.** Wrap `supabase-py` with `run_in_threadpool` (D-v2.5-01).
- **Realtime is a hint.** Reconcile by fetch (D-v2.5-03). The install status poll must be a fetch.
- **Multi-worker uvicorn (`WORKER_COUNT=2`).** No per-process install locks. Use a DB-level claim.
- **Settings live in `user_settings` / `app_settings`.** Env vars are for secrets and infra only.
- **G-5:** `node scripts/check-hot-file-ledger.cjs 266` must pass. It fails on any non-test source file in `files_modified` with no ledger row, and a FIRING file needs a named seam or an "honoured by construction" note. Rows go in `docs/HOT-FILE-LEDGER.md` § Scan list and that file's own section, **same commit**. Disposition cells are capped at **200 chars**.
- **CLAUDE.md size budget:** measured **119,168 chars**, **832 below the 120,000 warn band** (limit 150,000). Any row added to CLAUDE.md's FIRING table must be short. Prefer putting the narrative in `docs/HOT-FILE-LEDGER.md`.
- **Worktrees:** bootstrap first (`bash scripts/bootstrap-worktree.sh "$(pwd)"`), never `rm -rf` one, and tear down with `scripts/teardown-worktree.sh`. **Serialize plans whose tests mutate the local DB** (the live-drive plan and the RLS integration fence).
- **Vitest:** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root. Contract: no per-file decrease and 0 failing. Last measured at Phase 265: `8775 total · 326/326 pinned · 0 failing`. **`src/components/experts` has no bare-directory TARGETS entry**, so any new suite there must be NAMED in TARGETS **and** pinned in BASELINE, same commit (vitest-count-gate.cjs:176-178, :4436-4460).
- **Typecheck:** `npx tsc -p tsconfig.app.json --noEmit` as a **set diff** against the base commit. `npx tsc --noEmit` checks zero files.
- **Extension Contract:** a plugin is DATA, an EXTERNAL PROCESS or SANDBOXED CODE. The corpus is DATA. The installer is closed service code, and nothing may be dynamically imported from the corpus directory.
- **G-8:** target 3-5 plans. Never cut the verifier, TDD RED drives, security review or migration discipline.
- **Independent review:** whoever reviews the phase must not have shaped the build (AGENTS.md / `.agent-bus`).
- **Deployment:** never push `master`/`production` without an explicit operator "deploy". Code deploying is not the same as cloud configured, so 195 goes to prod by approval-gated MCP or the SQL editor.

## Summary

The phase is mostly **reuse**, but four measured facts change how it must be built.

**1. The "one ingest path" is not `_upload_pipeline`.** `/upload` mints the row, PUTs the bytes to storage and inserts an `ingestion_jobs` row. The durable worker then calls `splice_document(job_id=…)` (`documents.py:611-735`, `ingestion_queue_service.py:223-238`). `_upload_pipeline` only runs when `ingest_worker_enabled` is `False`. Without a `job_id`, `splice_document` delegates to the legacy `ingest_document` (`ingest_splice.py:581-597`). The exact server-side precedent is `sources/import_service.py`: `import_single_file` mints with an **explicit `org_id`** (`:237-248`), and `_enqueue_or_splice` (`:64-161`) PUTs the bytes before enqueueing and falls back to a direct splice only if the enqueue fails. The installer must mirror that path.

**2. Org placement is not automatic.** `get_current_user` returns `{id, email}` only (`dependencies.py:381`). When `org_id` is omitted, `documents.org_id` and `folders.org_id` are filled by migration 106's trigger with an **unordered `LIMIT 1` over `org_members`** (`full-schema.sql:75-79`). For a user in two orgs, that is an arbitrary org. The installer must pass the validated active org explicitly to both the folder insert and the mint. `document_chunks.org_id` then inherits from the parent document (mig 107).

**3. Dedup and versioning are per-user, not per-org.** `mint_document_row` dedups on `(user_id, content_hash, status='completed')` and retires `is_latest` on `(user_id, filename)` (`ingest_splice.py:194-226`). The DB enforces `documents_completed_hash_unique_idx ON (user_id, content_hash) WHERE status='completed'` (`full-schema.sql:3991`). So an admin who installs into org A and then org B gets org A's document back as a "duplicate", and no copy is made in B. If A's copy is still processing, the mint **flips A's `is_latest` to false**, and retrieval requires `d.is_latest = true` (`full-schema.sql:384`), so A's Expert silently loses its knowledge. That is a cross-org side effect of an install, and it breaks PACK-19's "org-contained" in exactly the case the phase flags (an admin of two orgs). The fix is to org-scope the dedup and versioning when `org_id` is passed, and widen the unique index to include `org_id` in migration 195.

**4. Retrieval is gated by all of the caller's orgs, not the active one.** `match_document_chunks` / `keyword_search_chunks` filter `dc.org_id = ANY(current_user_org_ids())`, which is every membership (`full-schema.sql:252-257`, `:376`). The Library list is not active-org scoped either (`documents.py:737-771`). With an Expert active, the folder filter confines retrieval to the install folder resolved for the **active** org, which makes SC#4 sound. But a user in both orgs can legitimately search both copies without an Expert. **The SC#3 fence subject must be a member of exactly one of the two orgs.** Otherwise the fence either false-fails (the user is allowed to see both copies) or proves nothing.

**Primary recommendation:** mirror `import_service`'s mint → PUT → enqueue path with an explicit active `org_id`. Org-scope `mint_document_row`'s dedup/versioning when `org_id` is given, and widen the `(user_id, content_hash)` unique index in migration 195. Derive Installing/Ready/Failed from the corpus documents' own `status` rather than storing a second copy. Resolve first-party folders from `expert_installs` inside `resolve_expert_bundle`'s existing validation loop, after deleting the bypass. Prove SC#3 with a single-org user and SC#4 with `audit_log` `search.query` document ids joined to `documents.org_id`.

### Measured corrections to CONTEXT.md and inherited claims

| # | Claim (source) | Measured | Consequence |
|---|---|---|---|
| C-1 | D-266-12: "The folder **and documents** carry … `is_org_shared = true`" | **`documents` has no `is_org_shared` column** (`full-schema.sql:1505-1535`). Sharing is folder-only: `folder_is_org_shared(d.folder_id)` in the retrieval RPC (`:379`) and the documents SELECT policy (`:6863`) | Set `is_org_shared=true` on the **folder** only. A plan that writes it on documents will fail at insert. |
| C-2 | D-266-07: "processed by `_upload_pipeline` → `splice_document`, the same path a user upload takes" | `/upload` does **not** call `_upload_pipeline` by default. It enqueues `ingestion_jobs`, and the worker calls `splice_document(job_id=…)`. `_upload_pipeline` is the `ingest_worker_enabled=False` fallback only (`documents.py:711-723`) | Follow the queue path (`import_service._enqueue_or_splice`), not `_upload_pipeline`. The intent of D-266-07 (one path, no pre-chunked inserts) holds. Only the named function is wrong. |
| C-3 | D-266-10: bypass "about line 478" | Defined at **`expert_service.py:484`**, used at `:486` | Cosmetic. |
| C-4 | CONTEXT Reusable Assets: "`ExpertDetailModal`'s primary CTA seam (`onSelectExpert`, D-262-08)" | The modal's prop is **`onStartChat`** (`ExpertDetailModal.tsx:124-130`). `onSelectExpert` belongs to `InviteExpertDialog` (`:24`) | Two invite doors to gate: the catalog (`onStartChat` → `startScopedChat`) and the composer (`onSelectExpert`). |
| C-5 | D-266-13: "Users may add or delete documents like in any folder" | True only in the sense of **any org-shared folder**. `mint_document_row` refuses a non-owner upload (`ingest_splice.py:154-168`: "Cannot upload to a folder you do not own"), and document DELETE RLS requires `auth.uid() = user_id` (`full-schema.sql:6474`). Only the installing admin can add, and only a document's owner can delete. | No new lock concept is needed, and none should be built. State this plainly in any UI copy. Do not promise "anyone can add". |
| C-6 | Memory: "chat reads the OLDEST org (no `X-Org-Id` on a stream)" | **Stale since 2026-08-31.** `threads.py:947-949` stamps the validated `X-Org-Id` onto `current_user`, and the client sends it (`lib/api/threads.ts:541` via `_core.ts:280`). `run_producer` reads `current_user["org_id"]` (`:418`). | The Expert resolves the **active** org's install. But retrieval's org gate is all memberships (see summary point 4). |
| C-7 | Migration 188 seed: `file_size 3420`, and the chunks say "$124.5 million … 18.2%" | `full_markdown` is **2,359 bytes** (ASCII, LF, 29 lines). `$124.5` and `+18.2%` are present. **The literal `$124.5M` and the phrase `124.5 million` are absent.** Those were only in the hand-written seed chunks this phase retires. | SC#4 evidence must match a pattern such as `\$124\.5\s*(M\b\|million)` and `\+?18\.2\s*%`, and show the retrieved chunk containing `$124.5` / `+18.2%`. |
| C-8 | `/upload` stamps `org_id` from `current_user.get("org_id")` (`documents.py:674`) | Always `None`, because `get_current_user` returns `{id, email}`. `ingestion_jobs.org_id` is NULL and `documents.org_id` comes from the unordered-LIMIT-1 trigger. | **Pre-existing defect, out of scope.** For a two-org user, a manual upload can land in the wrong org. Plant a seed. The installer must not copy this shape. |
| C-9 | CLAUDE.md G-5 rows | Re-derived: `api/experts.py` **12/4/621** (row 9/3/605) · `run_producer.py` **12/6/943** (11/6/932) · `ExpertCatalogPage.tsx` **4/2/238** (2/1/216) · `ExpertDetailModal.tsx` **2/1/349** (1/1/349) · `models/expert.py` **5/3/131** (4/3/131). **`api/folders.py` 11/7/233, `ingestion/FolderTree.tsx` 11/6/202 and `ingestion/FolderNode.tsx` 9/5/259 FIRE and have NO ledger row** (gate output below). | A plan that touches them must add rows (same-commit sync). The Library provenance note (D-266-13) lands on two of them. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Install trigger + states (Install / Installing… / Ready / Install failed — retry) | Browser (ExpertDetailModal, ExpertCard, InviteExpertDialog) | API (derived status) | The UI only renders server-derived state. It never decides readiness. |
| Permission + tier + active-org resolution | API (`require_capability('experts')`, `require_expert_manage`, `get_active_org_id`) | Database (`org_members`, `current_user_has_permission`) | All three share one validated `get_active_org_id` per request (`entitlement_service.py:140-146`, `experts.py:111-126`). |
| Corpus bytes | Backend image (repo files under `backend/app/experts/corpora/`) | — | DATA shipped with the code. `COPY . .` with a `.dockerignore` that excludes neither `app/` nor `.md`. |
| Copy into the org (folder, document rows) | API / Backend service, **as the caller** (user-JWT client, RLS `WITH CHECK org_id ∈ caller orgs AND user_id = auth.uid()`) | Database RLS | The DB proves the org and the owner. Service role is used only for the storage PUT and the job enqueue. |
| Extraction / chunking / embedding | Backend ingest worker (`splice_document` with `job_id`) | Storage + embedding provider | The one pipeline. It is not re-implemented. |
| Install lookup, idempotency claim | Database (`expert_installs`, UNIQUE `(org_id, expert_bundle_id)`) | Backend (`db/experts.py`, new queries only) | A DB-native compare-and-set survives `WORKER_COUNT=2`. |
| Expert scope for the run | Backend service (`resolve_expert_bundle`) | `run_producer` (byte-unchanged consumer) | D-266-11. Scoping stays data handed to the loop. |
| Tenant isolation of retrieval | Database (SECURITY DEFINER RPC org gate + folder filter) | Backend post-query clip (`tool_dispatcher.py:877-890`) | Unchanged by this phase. The phase must prove it, not rebuild it. |
| Library provenance note | Browser (LibraryPage → FolderTree → FolderNode) | API (install list) | Rendered from install rows joined by `folder_id`. No folder column (D-266-08 rejected it). |

## Standard Stack

No new libraries. Everything needed already ships.

### Core (existing, reused)
| Component | Location | Purpose | Why |
|---|---|---|---|
| `mint_document_row` / `async_mint_document_row` | `backend/app/services/ingest_splice.py:122-333` | Validate, hash, dedup, version and insert the document row | The single minting site for every door (Phase 229) |
| `_enqueue_or_splice` | `backend/app/services/sources/import_service.py:64-161` | Storage PUT **before** enqueue, `insert_ingestion_job`, and a never-strand direct-splice fallback | Exact server-side precedent, carrying the BUG-260905-04 lessons |
| `insert_ingestion_job` | `backend/app/db/ingestion_jobs.py:31-55` | Durable job (retries, lease recovery, concurrency cap) | What `/upload` uses |
| `splice_document` | `backend/app/services/ingest_splice.py:336-856` | Extraction, enrichment, chunking, embedding, authoritative recount, terminal status | The whole ingest. Refuses empty (0 chunks → `failed`) |
| `resolve_expert_bundle` | `backend/app/services/expert_service.py:394-551` | Two-phase member evaluation | The seam D-266-09/10 edit |
| `require_capability`, `require_expert_manage`, `get_active_org_id` | `entitlement_service.py:132-148`, `api/experts.py:111-126`, `dependencies.py:877-929` | Tier, permission, validated org | Existing gates. D-266-04 forbids a second tier check. |
| `classifyIngestionError` | `frontend/src/components/library/ingestionErrorVocabulary.ts` | Human sentence for a document's `error_message` | The one home for failure wording. Use it for "Install failed — retry" causes. |
| `_rls_harness.py` | `backend/tests/integration/_rls_harness.py` | SET-LOCAL-as-user RLS context, `auth.uid()` preflight, skip guard on `:54322` | Substrate for the driven two-org fence |

**Installation:** none. No `npm install` / `pip install`.

## Package Legitimacy Audit

**Not applicable. This phase installs no external packages.** No npm, PyPI or crates additions are recommended. slopcheck was not run because nothing is installed.

## Architecture Patterns

### System Architecture Diagram

```
Admin clicks Install (ExpertDetailModal / InviteExpertDialog prompt)
   │  POST /experts/{bundle_id}/install      headers: Authorization, X-Org-Id
   ▼
[router dep] require_capability('experts') ──► get_active_org_id (validates X-Org-Id vs org_members) ──► 403 plan-naming if standard tier
   ▼
require_expert_manage (experts:manage in the SAME active org) ──► 403 if not
   ▼
get_expert_service(bundle, org) ── not visible ──► 404
   │ is_system == false ──► 409 "org Experts bind their own folders"
   ▼
load_corpus(slug)  ◄── backend/app/experts/corpora/<slug>/ (slug regex + path containment, CRLF→LF)
   ▼
CLAIM expert_installs (org_id, bundle_id)   ── INSERT … ON CONFLICT DO UPDATE … WHERE not in-flight RETURNING
   │ no row returned (another install in flight) ──► 202 + current derived state
   ▼
ensure folder (user-JWT client, explicit org_id, is_org_shared=true, owner = caller)
   │ install.folder_id missing/deleted ──► create + repoint
   ▼
for each corpus file:
   present by filename (is_latest, same org+folder) and not failed ──► skip (never overwrite)
   present and failed ──► re-drive the SAME document id (bytes to its file_path, status→pending, enqueue)
   absent ──► async_mint_document_row(org_id=active, folder_id, user-JWT client)
               ──► storage PUT (service role) ──► insert_ingestion_job(org_id) ─┐
   ▼                                                                             │
return derived state (installing)                                                │
                                                                                 ▼
                         ingest worker ──► splice_document(job_id) ──► document_chunks (org_id inherited from document)
                                                                    ──► documents.status = completed / failed
   ▼
GET install state (poll by fetch) ──► derive: any corpus doc failed → failed(cause) · all completed & chunk_count>0 → ready · else installing
   ▼
Chat run in active org: POST /threads/{id}/messages (X-Org-Id) ──► run_producer (unchanged) ──► resolve_expert_bundle
      is_system ──► expert_installs[caller_org].folder_id ──► strict caller-org folder validation ──► effective_folder_ids
   ──► search_documents(folder_ids) ──► match_document_chunks: org ∈ current_user_org_ids() AND folder filter
   ──► audit_log search.query metadata.document_ids  (evidence: join documents.org_id)
```

### Recommended file layout

```
backend/app/experts/                      # NEW package-less data dir (no __init__.py needed; never imported)
└── corpora/
    └── financial-analyzer/
        ├── manifest.json                 # {"folder_name": "Financial Reports & Filings", "files": [{"filename": "...", "mime_type": "text/markdown"}]}
        └── acme_q3_2026_financial_report.md   # verbatim 188 full_markdown, LF
backend/app/services/expert_install_service.py   # NEW: load_corpus, install_expert, derive_install_state
backend/app/db/experts.py                 # +NEW functions only: get_expert_install, list_expert_installs_for_org, claim_expert_install, set_expert_install_folder/status
backend/app/services/expert_service.py    # resolve_expert_bundle: installs source for is_system; bypass deleted; list/get overlay
backend/app/services/ingest_splice.py     # org-scope dedup + versioning ONLY when org_id is passed
backend/app/api/experts.py                # POST /experts/{id}/install, GET /experts/installs (declared BEFORE /{bundle_id})
supabase/migrations/195_expert_installs_and_seed_retirement.sql
scripts/full-schema-supplement.sql        # §5e mirror of 195's grants/revokes
frontend/src/lib/api/experts.ts           # installExpert, listExpertInstalls, ExpertInstallState type
frontend/src/components/experts/catalog/{ExpertDetailModal,ExpertCard,ExpertCatalogPage}.tsx
frontend/src/components/chat/InviteExpertDialog.tsx
frontend/src/pages/LibraryPage.tsx → components/ingestion/FolderTree.tsx → FolderNode.tsx   # provenance map, `folderDocumentCounts` precedent
```

A manifest keeps the folder name and MIME type out of code and lets Phase 269 add Experts as data. `corpus_version` should be `sha256` over the sorted `(filename, sha256(lf_bytes))` pairs, which is deterministic across OSes once the bytes are LF-normalised (Pitfall 5).

### Pattern 1: Resolver reads the install, then runs the existing strict loop (D-266-09/10/11)

**What:** feed the caller org's install folder into the **existing** validation loop, and delete the `is_system_folder` arm. Do not add a parallel path.
**Why:** the loop already strips and logs `EXPERT_MEMBER_CROSS_ORG_STRIPPED`, and `run_producer` consumes `resolved.effective_folder_ids` (`run_producer.py:455`), so it stays byte-unchanged.

```python
# backend/app/services/expert_service.py — inside resolve_expert_bundle, replacing :466-468 source
# Source: measured seam expert_service.py:466-501
if bundle.get("is_system"):
    # D-266-09: a first-party Expert's knowledge is the CALLER ORG's installed copy, never a global id.
    install = (
        await experts_db.get_expert_install(pool, caller_org_id, bundle["id"])
        if caller_org_id is not None else None
    )
    raw_folder_ids = [install["folder_id"]] if install and install.get("folder_id") else []
else:
    raw_folder_ids = bundle.get("knowledge_folder_ids") or []
...
for r in folder_rows:
    # D-266-10: the SYSTEM_USER_ID bypass is gone. It approved scope that retrieval could never read,
    # because match_document_chunks gates on current_user_org_ids() (SEED-304's exact shape).
    is_tenant_folder = bool(f_org_id == caller_org_id and (f_user_id == caller_user_id or f_shared))
    if is_tenant_folder:
        valid_folders.add(f_id)
```

⚠ **Mock-order trap:** existing resolver tests drive `pool.fetch` with a sequenced `side_effect` and `pool.fetchrow` with a fixed `return_value=bundle_row` (`test_259_expert_member_isolation.py:22-80`). Put the install read in a **dedicated `experts_db` function** so tests can patch it, and call it only when `is_system` is true. Measured: no existing test resolves an `is_system` bundle through `resolve_expert_bundle`. `test_261_expert_authoring_scenarios.py:310-380` uses a system template only for update/delete/clone. The planner should still re-grep before claiming zero impact.

⚠ After the bypass is deleted, `SYSTEM_USER_ID` (`expert_service.py:15`) has no other reader in `app/` (measured by grep). Leave the constant or delete it. If deleted, grep `tests/` first.

### Pattern 2: The installer mirrors `import_single_file` (PACK-18)

```python
# backend/app/services/expert_install_service.py  (sketch — shape measured from import_service.py:237-261 and :64-161)
mint = await ingest_splice.async_mint_document_row(
    raw=lf_bytes, filename=f.filename, mime_type=f.mime_type,
    user_id=str(caller_id),
    supabase=user_client,          # user-JWT: RLS proves org + owner (documents INSERT policy full-schema.sql:6607)
    folder_id=str(folder_id),
    org_id=str(active_org),        # ⛔ mandatory — omitted, the mig-106 trigger picks an arbitrary org
    on_conflict="link",
)
if not mint.is_duplicate:
    await _enqueue_or_splice(      # storage PUT BEFORE the job exists; job carries org_id; never-strand fallback
        doc=dict(mint.document), raw=lf_bytes, mime_type=f.mime_type, filename=f.filename,
        user_id=str(caller_id), active_org=str(active_org),
        storage_path=mint.storage_path, background_tasks=background_tasks,
    )
elif str(mint.document.get("org_id")) != str(active_org) or str(mint.document.get("folder_id")) != str(folder_id):
    # the dedup found a copy that is NOT this org's install folder — never adopt it
    raise InstallRefused(...)
```

Reusing `import_service._enqueue_or_splice` directly is acceptable: it is generic apart from its log wording. The alternative is promoting it to a public name in the same module. **Do not re-implement it.** Its docstring records three production defects that a copy would reintroduce.

**Folder creation:** insert with the user-JWT client, `{"user_id": caller, "org_id": active_org, "name": manifest.folder_name, "parent_id": None, "is_org_shared": True}`. The folders INSERT policy (`full-schema.sql:6537`) proves `org_id ∈ caller orgs AND auth.uid() = user_id`. Do **not** go through `POST /folders`. Its name-uniqueness check is per-user across orgs (`folders.py:48-64`), and it passes no `org_id`, so it inherits C-8's defect.

### Pattern 3: Idempotency by claim + filename + re-drive (D-266-14, PACK-19)

1. **Claim (race-safe across `WORKER_COUNT=2`):**
   ```sql
   INSERT INTO public.expert_installs (org_id, expert_bundle_id, installed_by, corpus_version, status)
   VALUES ($1, $2, $3, $4, 'installing')
   ON CONFLICT (org_id, expert_bundle_id) DO UPDATE
      SET status = 'installing', installed_by = EXCLUDED.installed_by,
          corpus_version = EXCLUDED.corpus_version, error = NULL, updated_at = now()
    WHERE public.expert_installs.status <> 'installing'
       OR public.expert_installs.updated_at < now() - interval '10 minutes'   -- stale-claim recovery
   RETURNING *;
   ```
   No row returned means another install holds the claim. Return the current derived state with 202 and mint nothing. Do not use an in-process lock (multi-worker) or a session advisory lock held across awaits.
2. **Missing by filename:** `SELECT id, filename, status, chunk_count FROM documents WHERE org_id=$org AND folder_id=$folder AND is_latest AND filename = ANY($manifest_filenames)`. A present, non-failed doc is left untouched ("never overwrite").
3. **Failed doc → re-drive the same row,** not a new mint. A new mint by a *different* admin would leave a second row with the same filename (versioning is per-user). Re-drive by setting `status='pending'`, re-PUTting the bytes to its existing `file_path`, and enqueueing a job for the same `document_id`. This is the `/reingest` shape (`documents.py:1165-1260`).
4. **Folder gone → recreate + repoint:** give `expert_installs.folder_id` a FK `ON DELETE SET NULL`. A NULL (or a folder id that no longer exists in this org) means create a new folder and `UPDATE … SET folder_id`. Deleting a folder through the API deletes the caller's documents in it (`folders.py:133-169`). But `documents.folder_id` is `ON DELETE SET NULL` (`full-schema.sql:5766`), so documents owned by *other* users survive at the root.
5. **Readiness is derived, never stored twice:** store only what the installer knows (`installing` for the copy step, or `failed` with `error` when the copy step itself failed). Compute Ready/Installing/Failed at read time from the corpus documents' `status` / `chunk_count` / `error_message`. The ingest worker never learns about installs, so a stored `ready` would need a second writer racing the worker. This satisfies D-266-08 ("home of the state") with one source of truth per fact.

### Pattern 4: Retrieval isolation facts the fence must respect (PACK-19 SC#3)

- Org gate: `dc.org_id = ANY(SELECT current_user_org_ids())`. That is **all** the caller's memberships (`full-schema.sql:252-257, 376`).
- Within-org visibility: owner, or `folder_is_org_shared(d.folder_id)` (recursive over ancestors, `:273-289`), or connection visibility (`:377-381`).
- `d.is_latest = true` is required (`:384`).
- Folder filter: `p_folder_ids` in the RPC, plus the dispatcher's post-query clip (`tool_dispatcher.py:877-890`). An **empty** scope list (`[]`) sends `None` to the RPC but then clips every hit, so the result is empty (fail-closed) with a `scope_violation` emit. An uninstalled Expert therefore answers from nothing. It does not leak.
- **So the fence subject must belong to exactly one of the two orgs.** With the dev account (member of both `c1f18150` and `22f9c615`, per the recorded memory), un-scoped search legitimately returns both copies.

### Pattern 5: Surfacing install state without touching five folder-count readers

Five frontend surfaces derive a folder count or names from `expert.knowledge_folder_ids`: `ExpertCard.tsx:56`, `ExpertDetailModal.tsx:138`, `InviteExpertDialog.tsx:161-164`, `ExpertSpotlightCard.tsx:106` and `OrgExpertsTab.tsx:269`. After 195 clears the column, all of them would read **0** for the Financial Analyzer, even when installed.

**Recommended:** in `list_experts_service` / `get_expert_service`, for `is_system` bundles **overlay** `knowledge_folder_ids` with the caller org's install folder (`[folder_id]` or `[]`) and add an additive `install` object (`{status, folder_id, cause?, can_install}`). Fetch it with one `list_expert_installs_for_org(pool, org_id)` query per list call. System bundles are not tenant-writable (`expert_bundles_write_policy` requires `is_system=false`, mig 187), so the overlay can never round-trip into an update. That fixes all five surfaces with zero edits to four of them. Compute `can_install` server-side with `_has_org_permission(…, "experts:manage")`: `useOrg()` exposes only `canManage` (org:manage), and there is no `experts:manage` probe on the client.

TS typing: add one optional field, `install?: ExpertInstallState`, to `ExpertBundle`. That field lives in `frontend/src/types/index.ts`, which FIRES (row exists, "honoured by construction" = one optional field). If the planner wants to avoid `types/index.ts`, declare `ExpertInstallState` in `lib/api/experts.ts` and a narrowing type there. Either is defensible. The single optional field is simpler.

### Anti-Patterns to Avoid
- **Omitting `org_id` anywhere in the installer.** The trigger fills an arbitrary org for multi-org users (C-8).
- **Calling `_upload_pipeline` / `splice_document` without a job** as the main path. That is the legacy branch (`ingest_splice.py:581-597`) with no retries, lease recovery or concurrency cap (BUG-260905-04).
- **Writing folders or documents with the service-role client.** RLS would stop proving org membership and ownership.
- **A disabled button for "Installing…".** `ExpertDetailModal.test.tsx` case (8) asserts **zero disabled buttons** (`:193-200`), and D-262-02 refuses dead affordances. Replace the CTA with a status line that carries the reason.
- **Route order:** `GET /experts/installs` declared after `GET /experts/{bundle_id}` (a `UUID` path param) is matched by the param route and 422s. Declare it first, or use `GET /experts/{bundle_id}/install`.
- **Reading `audit_log.org_id` as evidence.** Its org is also autofilled by the unordered trigger. Join `metadata.document_ids` to `documents.org_id` instead.
- **Wipe-and-recopy on re-install** (D-266-14 forbids it) or storing readiness twice (Pattern 3.5).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Ingest a file server-side | A new extract/chunk/embed loop or pre-chunked inserts | `async_mint_document_row` + `_enqueue_or_splice` → worker `splice_document` | Retries, lease recovery, empty-doc refusal, metadata enrichment, recount |
| Org resolution | Parsing `X-Org-Id` yourself, or taking org from the body | `get_active_org_id` (shared by `require_capability`) | Validates membership on the caller's RLS connection. Spoofed header → 403. |
| Permission | A role string compare | `require_expert_manage` → `_has_org_permission(…, "experts:manage")` | Data-driven `role_permissions` (mig 189) |
| Tier | An `if tier ==` check | Router-level `require_capability("experts")` | D-266-04: one home |
| Concurrency | In-process locks or long-held advisory locks | `INSERT … ON CONFLICT … DO UPDATE … WHERE … RETURNING` claim | `WORKER_COUNT=2`, and awaits span network I/O |
| Failure wording | New error strings from `error_message` | `classifyIngestionError` | Never prints a driver dict. Never invents a cause. |
| Two-org RLS test context | New `SET LOCAL` plumbing | `tests/integration/_rls_harness.py` | Imports the app's `_apply_rls_user_context`, and has a fail-loud `auth.uid()` preflight |

**Key insight:** every hard part (org proof, owner proof, durable ingest, embedding) already exists and has been paid for in production defects. The phase's risk is in the **glue**: which org id, which client, which dedup scope.

## Runtime State Inventory

This phase retires seeded data and changes a unique index, so the inventory applies.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Mig 188 rows: folder `…0260`, document `…0261`, chunks `…0262/…0263` in the seed org (local: `430bffc6`, re-pointed by 193 to the seed user's org). `expert_bundles.knowledge_folder_ids = {…0260}` for `financial-analyzer`. Local threads `619cdee6`, `22c52c89`, `ec2e49e9` carry `active_expert_id = …0259` (260-VERIFICATION). **Live counts not re-measured** (local DB refused `:54322`). | **Data migration in 195:** `DELETE` by fixed id (idempotent). Clear or `array_remove` `…0260` from the bundle. Keep skill `…0264`. Existing threads keep `active_expert_id` and resolve to the org's install after install. **No code change needed for threads.** |
| Stored data (prod) | Unknown whether 188's inserts landed on prod. `folders.user_id` references `auth.users`, so they only exist if the seed user `…0001` exists there. | Before applying 195 to prod, **read** with Supabase MCP `execute_sql` (free): `SELECT id FROM folders WHERE id='…0260'` etc. 195 must be safe either way (DELETE by id is). The write needs operator approval. |
| Live service config | None. There is no n8n or external UI config for Experts. | None, verified by grep of `app/` for the seed ids (only tests reference them). |
| OS-registered state | None. | None. |
| Secrets / env vars | None. No new env var. An embedding provider key must exist in every environment where install runs (already required for any ingest). | None. Note it in the deploy parity checklist. |
| Build artifacts | The corpus directory ships in the backend image via `COPY . .` (`backend/Dockerfile`). `.dockerignore` excludes `tests/`, `supabase/`, logs and secrets, not `app/**` or `*.md`. `git check-ignore` confirms the path is not ignored. | None beyond committing the file. Verify it is in the image at deploy (`docker run … ls app/experts/corpora`), which is an operator step. |
| Unique index | `documents_completed_hash_unique_idx (user_id, content_hash)` | **195:** drop and recreate as `(org_id, user_id, content_hash) WHERE content_hash IS NOT NULL AND status='completed'`. This is strictly looser, so no existing row can violate it. |

## Common Pitfalls

### Pitfall 1: The copy lands in the wrong org
**What goes wrong:** folder or document rows get an org chosen by the mig-106 trigger's unordered `LIMIT 1`.
**Why:** `org_id` omitted, and `get_current_user` carries no org (C-8).
**How to avoid:** pass the validated `active_org` explicitly to the folder insert, `async_mint_document_row(org_id=…)` and `insert_ingestion_job(org_id=…)`. Test it by asserting the insert payload carries `org_id`, with a two-membership user fixture.
**Warning signs:** `documents.org_id` differs from the `X-Org-Id` the install request carried.

### Pitfall 2: A two-org admin's second install dedups into the first org, or un-latests it
**What goes wrong:** the org B install returns org A's document (`is_duplicate=True`), so B gets no copy. Or, while A's copy is in flight, B's mint runs `UPDATE documents SET is_latest=false WHERE user_id=… AND filename=…` across orgs, and A's Expert loses its document (`d.is_latest` is required in retrieval).
**Why:** `ingest_splice.py:194-226` dedups and versions per user, and `documents_completed_hash_unique_idx` is `(user_id, content_hash)` (`full-schema.sql:3991`). Even with the app check fixed, the completion write of B's copy would 23505 on the old index.
**How to avoid (recommended):** when `org_id is not None`, add `.eq("org_id", org_id)` to the dedup query, the version lookup and the `is_latest` retire. Recreate the unique index with `org_id` in 195. `/upload` passes no `org_id`, so its behaviour is byte-unchanged. `import_service` / `watch_service` pass `org_id`, so their dedup becomes org-scoped too. That is the correct behaviour ("already here" should never point at another org's row), but the planner must say it out loud and run their suites.
**Alternative (weaker):** leave the mint alone and have the installer refuse when the dedup returns a row from another org. This would ship a named limitation ("a person who administers two orgs cannot install in both"), and the in-flight `is_latest` flip would still happen.
**Warning signs:** after installing in B, count A's `is_latest` corpus docs. A drop is this bug.

### Pitfall 3: A fence that passes vacuously or fails for the wrong reason
**What goes wrong:** the fence uses the dev account, which is in both orgs. It either "finds" B's copy legitimately, or someone narrows retrieval to make it pass.
**How to avoid:** the fence subject is a user whose `org_members` rows contain **only** org A. Record the membership query in the evidence. Include a **positive control**: the same query as an org-B member returns B's copy. Otherwise "0 rows" proves nothing (262 row 1.4's vacuous pass).

### Pitfall 4: "Installing…" forever
**What goes wrong:** the ingest queue's circuit breaker is tripped (provider outage, `ingestion_queue_service.py:240-260`), so jobs sit `pending` and the card never leaves Installing.
**How to avoid:** when deriving state, surface a queue-paused reason if the jobs for the corpus documents are pending while the queue is paused. At minimum, show how long the install has been waiting. Stale-claim recovery (Pattern 3.1) lets Retry proceed.

### Pitfall 5: CRLF makes the corpus hash environment-dependent
**What goes wrong:** `core.autocrlf=true` and there is **no `.gitattributes`** (measured). The `.md` checks out CRLF on Windows and LF in the Linux image. `content_hash`, `corpus_version` and the verbatim test all differ by environment. The measured sha256 of the corpus is `f97f7ce2…935b` with LF and `9255aba2…1f29` with CRLF.
**How to avoid:** normalise in code (`raw.replace(b"\r\n", b"\n")`) before hashing and minting. Optionally also add `backend/app/experts/corpora/** text eol=lf` to a new `.gitattributes`. Pin it with a test: normalised corpus bytes == 188's `full_markdown` (extract the literal from the migration file, un-double `''`).

### Pitfall 6: New audit action type bricks boot
**What goes wrong:** adding `"expert.install"` to `VALID_ACTION_TYPES` without widening `audit_log_action_type_check`. `assert_action_types_synced` hard-fails the lifespan (`audit_service.py:31-56`).
**How to avoid (recommended):** add no new action type. `installed_by` / `updated_at` record who and when, and a `document.upload` audit entry per minted document (existing type, as `/upload` does) records the writes. If an `expert.install` action is wanted, 195 must re-issue the full CHECK list (copy `170_documents_source_state.sql:122-140`), and the migration must be applied **before** the new backend boots, locally and in prod.

### Pitfall 7: Asserting the literal `$124.5M`
It is not in the corpus (C-7). The model composes it from `$124.5` under a `($M)` header, or writes "124.5 million". Assert a regex, and separately show the retrieved chunk text contains `$124.5` and `+18.2%` (chunk 0 of 3 carries both, measured).

### Pitfall 8: Library shows two same-named folders for a two-org user
`list_documents` / `list_folders` are not active-org scoped (`documents.py:737-771`, `folders.py:11-20`). A two-org user who installed in both orgs sees two "Financial Reports & Filings" folders. This is pre-existing behaviour and out of scope. The provenance note helps. **SC#1's "appears in that org's Library" must be evidenced by `documents.org_id` / `folders.org_id` from the DB plus a UI view by a single-org user.**

### Pitfall 9: Hot files with no ledger row
`FolderNode.tsx` (9/5), `FolderTree.tsx` (11/6) and `api/folders.py` (11/7) **fire G-5 and have no row** (gate output below). The provenance note touches the first two. Keep each change to one threaded prop and one conditional (the `folderDocumentCounts` precedent, `FolderTree.tsx:15-17`), and add both rows in the same commit. `NavRow`'s existing `sharedLabel` prop (`NavRow.tsx:49-51`) can carry "Shared with org · from Financial Analyzer" with zero `NavRow` changes. **Do not touch `api/folders.py`.** The installer should not route through it (Pattern 2).

### Pitfall 10: Standard-tier Library load 403s
`GET /experts/installs` sits behind router-level `require_capability("experts")`. If LibraryPage calls it for the provenance map, a standard-tier org gets a 403 on every Library load. Treat a tier refusal as an empty map, silently. A standard-tier org cannot have installs anyway.

## Code Examples

### Migration 195 skeleton (shape to mirror; the planner finalises it)
```sql
-- 195_expert_installs_and_seed_retirement.sql — Phase 266 (PACK-18/19/20, D-266-06/08, SEED-304)
-- WHY the 188 rows go: seeded into ONE org (the seed user's), status='failed', 0 embeddings; the
-- is_system_folder bypass approved them cross-org while retrieval could never read them (SEED-304).
-- Retired deliberately (SEED-177 / D-206-07). Skill …0264 is KEPT (is_system → visible platform-wide).

CREATE TABLE IF NOT EXISTS public.expert_installs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    expert_bundle_id uuid NOT NULL REFERENCES public.expert_bundles(id) ON DELETE CASCADE,
    folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,   -- NULL => recreate on re-install
    status text NOT NULL DEFAULT 'installing' CHECK (status IN ('installing', 'installed', 'failed')),
    error text,
    installed_by uuid,                     -- no FK: an installer's account deletion must not erase the audit fact
    corpus_version text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_expert_install UNIQUE (org_id, expert_bundle_id)
);
ALTER TABLE public.expert_installs ENABLE ROW LEVEL SECURITY;
-- Default privileges gave anon/authenticated ALL; take them back, then grant only what is needed.
REVOKE ALL ON TABLE public.expert_installs FROM PUBLIC;
REVOKE ALL ON TABLE public.expert_installs FROM anon;
REVOKE ALL ON TABLE public.expert_installs FROM authenticated;
GRANT SELECT ON TABLE public.expert_installs TO authenticated;          -- members READ their org's rows
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expert_installs TO service_role;
DROP POLICY IF EXISTS "expert_installs_member_read" ON public.expert_installs;
CREATE POLICY "expert_installs_member_read" ON public.expert_installs
    FOR SELECT TO authenticated
    USING (org_id IN (SELECT public.current_user_org_ids()));
-- No authenticated write policy: installs are written only by the backend (asyncpg/postgres), behind
-- require_capability('experts') + require_expert_manage.

-- Org-scope the completed-hash uniqueness (Pitfall 2). Strictly looser than before => no violations.
DROP INDEX IF EXISTS public.documents_completed_hash_unique_idx;
CREATE UNIQUE INDEX documents_completed_hash_unique_idx
    ON public.documents USING btree (org_id, user_id, content_hash)
    WHERE ((content_hash IS NOT NULL) AND (status = 'completed'::text));

-- Retire 188's orphaned knowledge (idempotent; chunks also cascade from the document FK).
DELETE FROM public.document_chunks WHERE document_id = '00000000-0000-0000-0000-000000000261'::uuid;
DELETE FROM public.documents       WHERE id = '00000000-0000-0000-0000-000000000261'::uuid;
DELETE FROM public.folders         WHERE id = '00000000-0000-0000-0000-000000000260'::uuid
                                     AND user_id = '00000000-0000-0000-0000-000000000001'::uuid;
UPDATE public.expert_bundles
   SET knowledge_folder_ids = array_remove(knowledge_folder_ids, '00000000-0000-0000-0000-000000000260'::uuid),
       updated_at = now()
 WHERE slug = 'financial-analyzer' AND is_system = true;
```
Then mirror **every** GRANT/REVOKE line above into `scripts/full-schema-supplement.sql` §5e (`:476-501`), run `node scripts/check-schema-acl-parity.cjs`, and after the paste run `bash scripts/regenerate-full-schema.sh` (needs Docker, so it is an operator step) and `get_advisors(security)`. Wrap the file in `BEGIN; … COMMIT;` as 170 does, or leave it unwrapped for SQL-editor paste. Both are idempotent here.

⚠ `CREATE UNIQUE INDEX` without `CONCURRENTLY` takes a lock on `documents` for its build. At current table sizes this is short. `CONCURRENTLY` cannot run inside a transaction block. The planner picks one and states it.

### The D-266-10 fence, driven RED against the old rule
```python
# backend/tests/unit/test_266_system_folder_bypass_fence.py
async def test_a_system_owned_shared_folder_in_another_org_is_stripped(caplog):
    org_a, org_b, user_a = uuid4(), uuid4(), uuid4()
    foreign_system_folder = uuid4()
    bundle = {..., "is_system": False, "org_id": org_a, "visibility": "org", "created_by": user_a,
              "knowledge_folder_ids": [foreign_system_folder], ...}
    pool.fetch side_effect -> [[{"id": foreign_system_folder, "org_id": org_b,
                                 "user_id": UUID("00000000-0000-0000-0000-000000000001"),
                                 "is_org_shared": True}]]
    resolved = await resolve_expert_bundle(pool, bundle_id, org_a, user_a)
    assert resolved.effective_folder_ids == []                       # RED on the old rule (:484 admits it)
    assert "EXPERT_MEMBER_CROSS_ORG_STRIPPED" in caplog.text
```
Record the plant: check out `expert_service.py` at the base, run it (1 failed), restore, run it (passed). Use an **org-authored** bundle so the fence does not depend on the new install source.

## State of the Art (in this repo)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `BackgroundTasks` → `splice_document` for server-side ingest | mint → storage PUT → `ingestion_jobs` → worker | Phase 230 / BUG-260905-04 | The installer must enqueue |
| Chat ignored `X-Org-Id` (oldest org) | `resolve_active_org_or_none` stamps the validated org onto `current_user` | 2026-08-31 (`threads.py:925-949`) | Expert scope follows the active org |
| System folder admitted cross-org by `SYSTEM_USER_ID` | Strictly caller-org (this phase) | 266 | Retires SEED-304's shape |

**Deprecated/outdated:** `test_260_financial_analyzer_conversation.py` as PACK-05 proof. Relabel it as dispatcher wiring (docstring + name, or a marker), or replace its tautological assertions (260-VERIFICATION gap, `:96-101, :155-162, :186-193`). Its hardcoded `…0260` references (`:36, :327, :338, :360`) are mock ids and are not affected by the DB retirement.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The dev account `fhdmrd.dev@gmail.com` (`e6dc45ca…`) is org-admin of `c1f18150` and a plain member of `22f9c615`, and `fhdmrd@gmail.com` owns `22f9c615`. Taken from the recorded memory (2026-09-22), **not re-measured** because the local DB was down. | Pattern 4, live drive | The fence and SC#4 setup would target the wrong users. The executor must query `org_members` first and record it. |
| A2 | Both dev orgs are `enterprise` tier (required for `experts`). Not measured. | Live drive | The install 403s with the plan refusal. Set tier by SQL, which is a service action. |
| A3 | Production has two orgs, both `enterprise` (STATE.md, 2026-09-23). Not re-read. | Deploy parity | Low. Re-read with MCP before the prod push. |
| A4 | Whether 188's rows exist on prod is unknown. | Runtime State Inventory | None if 195 deletes by id (idempotent). |
| A5 | The ingest worker is enabled in dev and prod (`ingest_worker_enabled` default `True`, `documents.py:711`). Runtime value not read. | Pattern 2 | `_enqueue_or_splice` falls back to a direct splice. Still one pipeline, but no job row. |
| A6 | A fresh org can be created by signing up a new user (`handle_new_user` creates a personal org, per mig 105 naming). Not re-verified this session. | Live drive SC#1 | The executor needs another route to a "fresh org". |

## Open Questions (RESOLVED)

1. **Org-scoped dedup in `ingest_splice.py` (Pitfall 2): fix, or refuse?** RESOLVED: fix it, per CONTEXT.md D-266-18 (operator, 2026-09-24).
   - What we know: without the fix, a two-org admin cannot install in both orgs, and can silently un-latest org A's copy. The fix touches a FIRING file (14/5/856, row exists) and changes `import_service` / `watch_service` dedup to per-org.
   - Recommendation: **fix it** (two `.eq("org_id")` arms gated on `org_id is not None`, plus the index in 195). PACK-19 says "org-contained", and this is the one path by which an install changes another org's retrieval. Confirm with the operator at plan review, since it widens scope beyond the literal CONTEXT seams.
2. **Backend refusal of inviting an uninstalled Expert.** RESOLVED: UI gating only, operator-accepted default (CONTEXT.md). D-266-01 is satisfied in the UI. A stale or direct `PATCH /threads/{id}` can still set `active_expert_id`. That is harmless (empty scope → the clip returns nothing), but it would "start a run against an empty scope". Recommendation: UI gating only this phase. `threads.py` FIRES at 82 phases, and the failure is fail-closed. Record the residual.
3. **`is_system` bundles and `knowledge_folder_ids`.** RESOLVED: installs only, no union, operator-accepted default (CONTEXT.md). After 195 the column is `{}`. Recommendation: for `is_system`, read installs **only** (D-266-09 literal). Do not union with the column.
4. **Where the Install CTA sits for non-managers.** RESOLVED: status line for non-managers, operator-accepted default (CONTEXT.md). Recommendation: server `can_install=false` → a status line such as "An org admin needs to install this Expert before it can answer from its documents." No button.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | gates, vitest | ✓ | v24.19.0 | — |
| Python venv | backend tests | ✓ | 3.12.6, pytest 9.0.2 | — |
| vitest / TypeScript | frontend | ✓ | ^4.1.0 / ~5.9.3 | — |
| Supabase CLI | local stack | ✓ | 2.98.2 | — |
| Local Postgres `:54322` | integration fence, migration apply, live drive | **✗ at research time** (`ConnectionRefusedError`) | — | Operator: `powershell -ExecutionPolicy Bypass -File scripts/start-local-infra.ps1`. If a port-reservation fault is suspected, check `netsh int ipv4 show excludedportrange protocol=tcp` (CLAUDE.md). Integration tests skip-guard themselves. |
| Docker (for agents) | `regenerate-full-schema.sh` (`docker exec pg_dump`) | **✗ denied to agents** | — | **Operator runs the regeneration.** Make it a `checkpoint:human-action`. |
| Embedding provider key | ingest of the corpus (local + prod) | not probed | — | None. Install fails with a named cause. |
| Supabase MCP (prod reads/writes) | prod parity | not available to this researcher | — | Executor / operator. Writes are approval-gated. |

**Missing with no fallback:** none that block planning. **Blocking at execution:** local Postgres must be up for the migration apply, the fence and the live drive.

## Validation Architecture

(`workflow.nyquist_validation` is `false` in `.planning/config.json`. This section is included because the orchestrator explicitly requested it.)

### Test Framework
| Property | Value |
|----------|-------|
| Backend | pytest 9.0.2 (`backend/pytest.ini`), venv |
| Frontend | vitest ^4.1.0 |
| Quick run (backend) | `cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/test_266_*.py -q` |
| Integration (live DB, skip-guarded) | `cd backend && ./venv/Scripts/python.exe -m pytest tests/integration/test_266_two_org_fence.py -q` |
| Quick run (frontend) | `cd frontend && npx vitest run src/components/experts src/components/chat/__tests__/ComposerExpert.test.tsx --maxWorkers=2` |
| Backend gate | `node scripts/check-backend-unit-baseline.cjs` (≤ 71 failed) |
| Frontend gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) |
| Typecheck | `cd frontend && npx tsc -p tsconfig.app.json --noEmit` (set diff vs base) |
| Structural gates | `node scripts/check-hot-file-ledger.cjs 266` · `node scripts/check-schema-acl-parity.cjs` · `node scripts/check-claude-md-size.cjs` |

### Phase Requirements → Test Map
| Req | Behavior | Type | Command / Evidence | Exists? |
|-----|----------|------|--------------------|---------|
| PACK-19 (D-266-10) | Foreign-org SYSTEM_USER_ID shared folder is stripped | unit, **RED-first** vs old rule | `pytest tests/unit/test_266_system_folder_bypass_fence.py` + recorded plant | ❌ Wave 0 |
| PACK-18/19 (D-266-09) | `is_system` bundle resolves the caller org's install folder, and none without an install | unit, RED-first | `test_266_resolver_reads_installs.py` | ❌ |
| PACK-18 (D-266-05) | Corpus bytes (LF-normalised) == 188 `full_markdown`, contain `$124.5` and `+18.2%`, and slug traversal is refused | unit, RED-first | `test_266_corpus_verbatim.py` | ❌ |
| PACK-18 | Installer passes explicit `org_id` to folder, mint and job, uses the user-JWT client for rows, and refuses non-system bundles | unit, RED-first | `test_266_install_service.py` | ❌ |
| PACK-19 (D-266-14) | Second install mints nothing. Missing-by-filename mints one. A failed doc is re-driven, not re-minted. A deleted folder is recreated and repointed. A lost claim mints nothing. | unit, RED-first | `test_266_install_idempotency.py` | ❌ |
| PACK-19 (Pitfall 2) | With `org_id` passed, dedup/versioning ignore another org's rows. `/upload` (no `org_id`) is byte-unchanged. | unit, RED-first | `test_266_mint_org_scope.py` + re-run `test_229_*`, import/watch suites | ❌ |
| D-266-02/04 | Non-manager → 403; standard tier → plan-naming 403; spoofed `X-Org-Id` → 403 | unit (TestClient, dependency overrides) | `test_266_install_route_gates.py` | ❌ |
| PACK-19 SC#3 | Org-A-only user: RPC search, `GET /documents/{B doc}`, and the resolved Expert scope all exclude B's copy. Positive control: a B member sees it. | integration (real RLS, `_rls_harness`) | `tests/integration/test_266_two_org_fence.py` | ❌ |
| D-266-01/03 | Modal: Install (can_install) / status line with reason (no disabled buttons) / "Install failed — retry" + cause via `classifyIngestionError`. Invite dialog prompts instead of selecting. | vitest, RED-first on the new cases | `ExpertDetailModal.test.tsx`, `ComposerExpert.test.tsx`, new install suite **named in TARGETS + BASELINE** | partial |
| PACK-18 SC#1/2 | Fresh org install → completed, `chunk_count>0`, non-null embeddings, org = active. Re-install → identical doc/chunk/folder counts. | **live**, SQL evidence | recorded in `266-UAT-LOG.md` | manual |
| PACK-20 SC#4 | Live answer cites `$124.5`(M) / `+18.2%` with `search.query` document ids whose `documents.org_id` = active org. Out-of-scope refusal. | **live** | recorded transcript + SQL | manual |

### Sampling Rate
- **Per task:** targeted suite for the files touched (commands above).
- **Per wave:** backend baseline gate + vitest count gate + tsc set diff + ledger + ACL parity.
- **Phase gate:** all green, plus the live UAT log rows each backed by their own SQL evidence.

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_266_*.py` (the seven files above), RED before implementation
- [ ] `backend/tests/integration/test_266_two_org_fence.py` on `_rls_harness`, with a real org-A-only user and a positive control
- [ ] Frontend install-state cases. Any new file under `src/components/experts/**/__tests__/` must be named in `TARGETS` and pinned in `BASELINE` in the same commit.

## Security Domain

`security_enforcement: true`. Threat model: **the provisioning writer runs as whom, into which org.**

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (existing) | `get_current_user` (GoTrue) |
| V3 Session Management | no | — |
| V4 Access Control | **yes, central** | `get_active_org_id` (validated `X-Org-Id`), `require_capability('experts')`, `require_expert_manage`, RLS `WITH CHECK` on folders/documents, `expert_installs` member-read RLS, strict caller-org folder validation |
| V5 Input Validation | yes | `bundle_id: UUID`. **Never an `org_id` in the body.** Slug regex `^[a-z0-9-]+$` plus resolved-path containment for the corpus dir. Pydantic response model. |
| V6 Cryptography | no | (sha256 is used for identity, not secrecy) |
| V7 Error handling / logging | yes | Failure cause via `classifyIngestionError`, never raw `error_message`. Keep `EXPERT_MEMBER_CROSS_ORG_STRIPPED`. |

### Known Threat Patterns
| Pattern | STRIDE | Mitigation |
|---------|--------|------------|
| Install into an org the caller is not in (spoofed `X-Org-Id` or body org) | Elevation / Tampering | `get_active_org_id` 403s a non-member. Org is never read from the body. RLS `WITH CHECK` on the folder/document inserts is a second, DB-level proof. |
| Non-admin installs org-wide content | Elevation | `require_expert_manage` (experts:manage in the **same** active org) |
| Standard tier bypass | Elevation | Router-level `require_capability` (one home) |
| Cross-org folder injected into an Expert's scope | Info disclosure | Bypass deleted (D-266-10). Fence driven RED against the old rule. |
| Service-role write lands in the wrong org | Tampering | Rows are written with the **user-JWT** client. Service role is used only for the storage PUT and the job, both keyed to the minted document id. `expert_installs` writes via the pool carry `org_id = $validated` in every statement. |
| Install in org B changes org A's retrieval (`is_latest` flip / dedup adoption) | Tampering / DoS | Org-scoped dedup/versioning + index (Pitfall 2). Adopt a dedup hit only if it is in this org's install folder. |
| Reading another org's install rows via PostgREST | Info disclosure | RLS `org_id IN current_user_org_ids()`. No client write grants. anon/PUBLIC revoked. Mirrored in the supplement. `get_advisors(security)` after apply. |
| Path traversal via slug into the filesystem | Tampering / Info disclosure | Slug regex + `Path.resolve().is_relative_to(CORPORA_ROOT)`. The slug comes from a DB row a tenant cannot write for `is_system` bundles (mig 187 write policy). |
| Concurrent installs duplicate documents | DoS / Integrity | CAS claim on `(org_id, expert_bundle_id)` |
| Cross-tenant read path (operator red line) | Info disclosure | None is built. The installer reads only repo files and the caller org's rows. |

## Recommended Plan Decomposition (G-8: 4 plans, TDD mode)

| Plan | Wave | Scope | RED-first behaviours | Notes |
|---|---|---|---|---|
| **266-01 Schema, corpus, resolver** | 1 | Migration 195 (table + RLS + grants, index widen, 188 retirement, bundle folder clear). Supplement §5e mirror. Corpus file + manifest + loader (LF normalisation, traversal guard). `db/experts.py` **new** queries. `resolve_expert_bundle` install source + bypass deletion. | D-266-10 fence (plant recorded). Resolver reads installs. Corpus verbatim/hash. ACL parity. | `checkpoint:human-action`: operator pastes 195 locally, runs `regenerate-full-schema.sh`, runs `get_advisors`. Ledger rows: `expert_service.py`, `db/experts.py`, `run_producer.py` (byte-unchanged note), new files at creation. Serialize: the migration mutates the local DB. |
| **266-02 Install service + API** | 2 | `expert_install_service.py`. Org-scoped mint in `ingest_splice.py`. Routes (`POST /experts/{id}/install`, `GET /experts/installs` declared before `/{bundle_id}`). List/get overlay + `install` + `can_install`. | Explicit `org_id` everywhere. Idempotency matrix. Claim loser. Mint org scope (and `/upload` unchanged). Route gates (403 manage / tier / spoofed org). | Run `test_229_*`, import and watch suites. They exercise the mint. |
| **266-03 Frontend states + provenance** | 2 (parallel with 02, disjoint files; contract frozen below) | `lib/api/experts.ts` (install fns + type). Modal/Card/CatalogPage states + polling fetch. `InviteExpertDialog` prompt. LibraryPage → FolderTree → FolderNode provenance (`sharedLabel`). Optional `install?` on `ExpertBundle`. | Modal: Install / status line / retry + cause. **Still zero disabled buttons.** Invite prompt instead of select. | New suites named in TARGETS + BASELINE, same commit. Ledger rows for `FolderNode.tsx` / `FolderTree.tsx` (no row today). `tsc -p tsconfig.app.json` set diff. |
| **266-04 Live proof + closeout** | 3 | Integration fence (real RLS, single-org subject + positive control). Live SC#1/2/4 drives with SQL evidence. Relabel `test_260_financial_analyzer_conversation.py`. STATE override record for D-266-16. Seed for C-8 (upload org defect). Prod parity checklist (MCP read first, then the approval-gated write). | The fence is RED if the resolver or RPC were widened (a plant on a copy is optional). | Serialize (DB-mutating). The operator drives the browser where asked. `independent_review` must be done by a non-builder. |

**API contract for 03 (frozen here so 02 ∥ 03):**
- `POST /experts/{bundle_id}/install` → `202 {expert_bundle_id, folder_id, state: "installing"|"ready"|"failed", cause: string|null, corpus_version, can_install: bool}`. Errors: 403 (tier: existing entitlement body; manage: detail string), 404, 409 (`{"error":"expert_not_installable"}` for non-system bundles).
- `GET /experts/installs` → `200 [ {expert_bundle_id, expert_name, folder_id, state, cause, can_install} ]` for the active org.
- `GET /experts` and `GET /experts/{id}` for `is_system` rows gain `install: {state, folder_id, cause, can_install} | null` and an overlaid `knowledge_folder_ids`.
- `state` is derived: any corpus doc `failed` → `failed` (cause = that doc's `error_message`, rendered via `classifyIngestionError`). All corpus docs `completed` with `chunk_count > 0` → `ready`. Otherwise `installing`.

### Live drive recipe (266-04)
1. **Prove the orgs.** `SELECT m.user_id, u.email, m.org_id, m.role, o.subscription_tier FROM org_members m JOIN auth.users u ON u.id=m.user_id JOIN organizations o ON o.id=m.org_id;` Pick org A and org B, an org-A-only user (the fence subject) and an admin of each.
2. **SC#1:** the admin of a **fresh** org presses Install (browser, active org shown in the switcher). Evidence: `SELECT d.org_id, d.status, d.chunk_count, count(c.*) FILTER (WHERE c.embedding IS NOT NULL) AS embedded, f.org_id AS folder_org, f.is_org_shared FROM documents d JOIN folders f ON f.id=d.folder_id LEFT JOIN document_chunks c ON c.document_id=d.id WHERE d.folder_id = (SELECT folder_id FROM expert_installs WHERE org_id=$A AND expert_bundle_id='…0259') GROUP BY 1,2,3,5,6;`
3. **SC#2:** counts of documents, chunks and folders for org A, before and after a second Install. They must be identical.
4. **SC#3:** install in org B by B's admin. As the org-A-only user: `search_documents` via a chat turn with no Expert, a direct `GET /documents/{B_doc_id}` (expect 404), and a run with the Expert active. Every `audit_log` `search.query` row's `document_ids` must map to `documents.org_id = A`. Positive control: B's admin sees B's doc.
5. **SC#4:** in a new thread in org A with the Expert invited, `POST /threads/{id}/messages` with `{content, model, provider}` and `X-Org-Id: A`. Ask a revenue question, then an out-of-scope one ("What is the employee vacation policy?"). Evidence: the transcript, the retrieved chunk text containing `$124.5` / `+18.2%`, and the `search.query` document ids → `documents.org_id = A`. For the two-org account (in both A and B), repeat with the switcher on B and show the cited document's org flips to B. That is the non-vacuous "not the seed org / not the other org" proof.

## Sources

### Primary (HIGH, measured in this tree at `2bc236e3f`)
- `backend/app/services/ingest_splice.py:122-333, 336-856` (mint, dedup, versioning, splice, job vs legacy branch)
- `backend/app/api/documents.py:311-333, 553-735, 737-771, 1165-1260` (`_upload_pipeline`, `/upload` queue cutover, list, reingest)
- `backend/app/services/sources/import_service.py:64-161, 164-261` (server-side precedent)
- `backend/app/services/ingestion_queue_service.py:223-238`, `backend/app/db/ingestion_jobs.py:31-55`
- `backend/app/services/expert_service.py:15, 117-186, 394-551`; `backend/app/db/experts.py:147-187`; `backend/app/api/experts.py:1-126, 386-506`
- `backend/app/services/run_producer.py:378-526`; `backend/app/services/agent_loop.py:1397-1398`; `backend/app/services/tool_dispatcher.py:250-274, 778-890`
- `backend/app/services/retrieval_service.py:38-156, 188-243`; `backend/app/dependencies.py:300-381, 877-1050`; `backend/app/api/threads.py:706-760, 925-949`
- `backend/app/api/folders.py:11-169`; `backend/app/services/entitlement_service.py:132-148`; `backend/app/services/audit_service.py:13-56`
- `supabase/full-schema.sql:54-84, 252-289, 366-391, 1374-1535, 1963-1972, 3991-4054, 5678-5878, 6418-6863`
- `supabase/migrations/106, 107, 170, 187, 188, 189, 193, 194`
- `scripts/full-schema-supplement.sql:255-270, 476-501`; `scripts/check-schema-acl-parity.cjs` (run: OK 183/183); `scripts/check-hot-file-ledger.cjs` (run: 4 no-row); `scripts/check-claude-md-size.cjs` (run: 119,168 chars); `scripts/regenerate-full-schema.sh:17-110`
- `backend/Dockerfile`, `backend/.dockerignore`, `git config core.autocrlf` (= true), no `.gitattributes`
- Frontend: `ExpertDetailModal.tsx`, `ExpertDetailModal.test.tsx:182-200`, `ExpertCard.tsx:56,141-155`, `ExpertCatalogPage.tsx`, `startScopedChat.ts`, `InviteExpertDialog.tsx:21-24,161-188`, `lib/api/experts.ts:179-198`, `lib/api/_core.ts:270-282`, `lib/api/threads.ts:541`, `FolderTree.tsx:10-23`, `NavRow.tsx:32-62`, `providers/OrgProvider.tsx:43-49`, `scripts/vitest-count-gate.cjs:170-200, 4433-4460`
- Corpus measurement: 188 `full_markdown` extracted and chunked with app settings (2,359 B; 3 chunks `[954, 607, 1196]`; chunk 0 carries both figures)

### Secondary (MEDIUM, recorded, not re-measured this session)
- Memory `reference_dev_account_is_in_two_orgs.md` (2026-09-22): dev account org roles
- `.planning/phases/265-owed-v4-3-verification/*` (backend gate 71/5533, vitest 8775 · 326/326)
- `.planning/milestones/v4.3-phases/260-…/260-VERIFICATION.md` (seed rows failed / 0 embeddings, threads `619cdee6` etc.)

### Tertiary (LOW)
- None. No web sources were needed. This phase is internal code and schema.

## Metadata

**Confidence breakdown:**
- Standard stack / seams: **HIGH**. Every function, line and index was read in the tree.
- Architecture (install flow, idempotency, overlay): **HIGH** on mechanics, **MEDIUM** on UX wording (discretion).
- Pitfalls: **HIGH**. Pitfalls 1, 2, 5, 6 and 9 are measured, not inferred.
- Live-DB facts (org roster, tiers, existing rows): **MEDIUM/LOW**. The local DB was down, so the executor must re-measure.

**Research date:** 2026-09-24
**Valid until:** ~2026-10-08. The seams are hot, so re-derive the ledger triples at plan time.
