# Phase 266: Expert Knowledge in a Real Org - Context

**Gathered:** 2026-09-23
**Status:** Ready for planning

<domain>
## Phase Boundary

When an org **installs** a first-party Expert, that Expert's sample corpus is **copied into that org,
ingested through the real pipeline and embedded there**, and the Expert's retrieval resolves to the
**org's own copy**. It closes v4.3's `PACK-05` / `SEED-304` (PACK-18, PACK-19, PACK-20).

In scope: the install action (API + one button and its states on the existing Expert detail
modal/card), the corpus source, the per-org lookup, idempotent re-install, the two-org fence, and the
live Financial Analyzer drive.
Not in scope: uninstall, a starter library (Phase 269), tool-floor/scope honesty (Phase 267).

Operator decision at v4.4 intake (REQUIREMENTS.md): **per-org provisioning. ⛔ No cross-tenant read
path is built.**

</domain>

<decisions>
## Implementation Decisions

### Install trigger
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

### Corpus source
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

### How the Expert finds its per-org copy
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

### The copy inside the org
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

### Surface / guardrails
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The problem and the operator decision
- `.planning/seeds/SEED-304-financial-analyzer-knowledge-unreachable-cross-org.md`: the finding and
  the two options. Option 2, per-org provisioning, was chosen.
- `.planning/REQUIREMENTS.md`: "How this milestone was scoped", the intake decision and PACK-18..20.
- `.planning/ROADMAP.md` § Phase 266: success criteria, failure modes and flags.
- `.planning/milestones/v4.3-phases/260-the-expert-you-can-actually-use/260-VERIFICATION.md`: why
  PACK-05 failed.
- `.planning/milestones/v4.3-MILESTONE-AUDIT.md`: the PACK-05 carry-forward.

### Schema and seed history
- `supabase/migrations/187_expert_bundles.sql`: the bundle table, including `is_system` and
  `org_id NULL`.
- `supabase/migrations/188_expert_chat_scoping.sql`: the seed corpus (source of the verbatim text)
  and the rows D-266-06 retires.
- `supabase/migrations/189_expert_presentation_and_grants.sql`: `expert_grants` RLS pattern to mirror.
- `supabase/migrations/193_expert_seed_org_portable.sql`: the last touch on the seed rows.
- `supabase/SETUP.md` and CLAUDE.md migration rules: apply 195 in the SQL editor, run
  `scripts/regenerate-full-schema.sh` (no reset), then `get_advisors(security)`.

### Code seams
- `backend/app/services/expert_service.py`: `resolve_expert_bundle` folder validation (the bypass is
  about line 478).
- `backend/app/services/run_producer.py`, about lines 450-520: the consumer of resolved folders.
  Stays unchanged (D-266-11).
- `backend/app/db/experts.py`: bundle queries. New queries only.
- `backend/app/api/experts.py`: `require_expert_manage` and the capability gate.
- `backend/app/api/documents.py` `_upload_pipeline` and `backend/app/services/ingest_splice.py`
  `splice_document`: the one ingest path.
- `backend/app/services/entitlement_service.py`: `require_capability`.
- `backend/app/utils/skill_visibility.py`: why skill `…0264` stays.
- `frontend/src/components/experts/catalog/ExpertDetailModal.tsx` and `ExpertCard.tsx`: the install
  affordance.
- `docs/HOT-FILE-LEDGER.md`: rows for `run_producer.py`, `db/experts.py` and `expert_service.py`.

### Rules
- `docs/EXTENSION-CONTRACT.md`: an Expert is data, and the corpus-as-files choice must not become
  engine code.
- `docs/DEPLOYMENT-WORKFLOW.md`: prod parity. Migration 195 goes to prod via the SQL editor or MCP
  with per-write approval, and the corpus files ship with the backend.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `splice_document` (Phase 229 unified pipeline): storage, extraction, chunking, embeddings and
  terminal status. It is the whole ingest.
- `require_expert_manage` and `require_capability('experts')`: permission and tier gates already
  exist.
- The `expert_grants` table and RLS from migration 189: the template for `expert_installs` RLS.
- `listExperts` / `getExpert` in `frontend/src/lib/api/experts.ts`: add one install client function
  beside them.
- `ExpertDetailModal`'s primary CTA seam (`onSelectExpert`, D-262-08): the invite path, which is
  gated on install state.

### Established Patterns
- Scoping is **data handed to the loop** (D-260-05). `run_producer` consumes `resolved.*` and has no
  `if expert:` branch.
- Cross-org stripping is logged as `EXPERT_MEMBER_CROSS_ORG_STRIPPED`. Keep it for real cross-org
  folders.
- The two-org dev account: prove the active org before trusting an absence (262 row 1.4 passed
  vacuously).

### Integration Points
- A new install route in `api/experts.py` calls a new provisioning function in the service layer.
  That function creates the folder, writes the documents and calls `splice_document` for each one.
- `resolve_expert_bundle` reads `expert_installs` for the caller's org.
- The catalog card and modal read the install status for the active org.

</code_context>

<specifics>
## Specific Ideas

- The live answer must cite **`$124.5M`** revenue and **`+18.2%`** YoY from the **org's own copy**.
  The refusal question is out of scope, for example the employee vacation policy (D-260-09).
- "Identical counts" in SC#2 means documents, chunks and folders are measured before and after a
  second install, from the DB.

</specifics>

<deferred>
## Deferred Ideas

- **Uninstall**: an explicit uninstall with a destructive-action guard, which would delete the folder
  and install row. Revisit when a starter library (269) makes installs common.
- **Corpus updates to installed orgs**: when a first-party corpus changes, how existing installs
  learn of it. `corpus_version` is recorded now so this is possible later, with no sync built.
- **Auto-provision on entitlement**: rejected for 266 in favour of explicit Install. Revisit if Phase
  269 wants a new org to open with the starter library already installed.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md`: matched on generic keywords only (score 0.6). It is unrelated to
  Expert provisioning and was not folded.

</deferred>

---

*Phase: 266-expert-knowledge-in-a-real-org*
*Context gathered: 2026-09-23*
