# Phase 270: The Document as an Object - Context

**Gathered:** 2026-09-30
**Status:** Ready for planning

<domain>
## Phase Boundary

A person downloads the **original file** of any document they can access (Library list row + detail panel), and the detail panel states what the file is: created, modified, pages, size, type, uploader, every date labelled for what it means. Requirements FIND-04, FIND-05 (4 success criteria in ROADMAP Phase 270). First phase of v4.5. Its file facts become searchable dimensions in Phase 271.

</domain>

<decisions>
## Implementation Decisions

### Old-document backfill (FIND-05)
- **D-01:** NO backfill. Documents ingested before this phase show **"not recorded"** for any fact they lack. Never `0`, never a wrong date. New uploads fill the facts at ingest.
- **D-02:** Migration **199** adds **typed nullable columns** on `documents`: `page_count int`, `source_created_at timestamptz`, `source_modified_at timestamptz`, `source_author text`. Typed (not one jsonb) so Phase 271 filters them directly, per the `date_typed` precedent. Re-derive the migration number with `ls supabase/migrations` at plan time.
- **D-03:** Page count is one line at `extraction_service.py`'s page loop (SEED-243). Source dates/author come from PDF/DOCX document properties. Apply via SQL editor, regenerate `full-schema.sql` (no reset), run `get_advisors(security)`.

### Download mechanism (FIND-04)
- **D-04:** **Signed storage URL, org-checked first.** The endpoint proves access through the **user-JWT / RLS path** (row must be readable by the caller) BEFORE minting. No URL is minted on refusal. Precedent shape: `workspace.py:588` `create_signed_url` wrapped in `run_in_threadpool` (D-v2.5-01). Never the service role before the check (the BUG-260903-02 shape).
- **D-05:** URL lifetime is an **`app_settings` setting, default 60 seconds**, not hardcoded. Deploy parity: seed row + `docs/OPERATOR.md` seed list + `deploy/onebox.env.example` if any env var is added.
- **D-06:** A document with **no stored file** (connector-ingested, empty `file_path`) shows the download control **disabled with visible words** ("File lives in <source>, not stored here"). No dead button, no 404. Fetch-from-source-on-demand is a new capability: deferred.

### Version wording + control (FIND-04)
- **D-07:** **One button that names its target**: "Download v3 (latest)" or "Download v2 (viewed, not latest)"; single-version docs say "Download". It fetches exactly the version it names (SC#2, prove with hash vs `content_hash`).
- **D-08:** Placement: **visible labelled button in the panel header AND a list-row action** on `DocumentList.tsx`. Wording is never tooltip-only (OV-266-01). The list row always fetches its own row's version.

### File-facts layout + dates (FIND-05)
- **D-09:** Two **separate labelled rows**: "Created in the file" (`source_created_at`) and "Added to Agentic RAG" (`documents.created_at`), plus "Last modified in the file". Never merged, never falling back to the upload date under the source label.
- **D-10:** **Every fact row is always present** with its honest value; a fact a file type lacks (CSV/email/image pages) reads "not recorded". Hiding rows cannot tell "does not apply" from "failed to read".
- **D-11:** **G-2 sketch SKIPPED, recorded decision.** Small addition on shipped surfaces reusing the panel's section pattern; visual contract goes into UI-SPEC/G-4 scenarios instead. Assert rendered CONTENT (labels + values), not testid presence.

### Claude's Discretion
- Exact endpoint path/name and response shape; where in the panel the facts block sits; uploader display (name vs email); size formatting; how the hash-equality check is scripted in the live drive.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase + requirements
- `.planning/ROADMAP.md` §Phase 270 — goal, 4 success criteria, "How we'd know this failed", flags
- `.planning/REQUIREMENTS.md` — FIND-04, FIND-05
- `.planning/seeds/SEED-243-find-the-document-not-just-the-answer.md` — operator's original ask (both halves)

### Hot-file audit (G-5)
- `docs/HOT-FILE-LEDGER.md` — sections for `backend/app/api/documents.py` (DISCHARGED 229), `frontend/src/components/metadata/DocumentDetailPanel.tsx` (FIRES), `frontend/src/components/ingestion/DocumentList.tsx` (seam taken 217.1-05), `frontend/src/types/index.ts` (seam OWED), extraction service. Run `node scripts/check-hot-file-ledger.cjs` on the phase dir once plans exist.

### Rules that bind this phase
- `CLAUDE.md` §Supabase MCP (writes approval-gated), §Deployment (migration before backend; parity checklist), §Migrations via SQL editor
- `docs/EXTENSION-CONTRACT.md` — closed core (7 phase types / 1 emitter / 29 tools) must be unchanged; this phase adds no agent tool
- `docs/DEPLOYMENT-WORKFLOW.md` — parity checklist for the new setting + migration

### Precedent code
- `backend/app/api/workspace.py:588` and `backend/app/api/sandbox_outputs.py:73` — `create_signed_url` in threadpool
- `supabase/full-schema.sql` `public.documents` (line ~1504): `file_path`, `file_size`, `mime_type`, `content_hash`, `version_number`, `is_latest`, `user_id`, `org_id`
- `backend/app/api/documents.py:800` — `GET /{document_id}/versions`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `documents` already carries size, mime, `content_hash`, `version_number`, `is_latest`, `user_id`, `created_at`: several facts need no migration.
- `GET /documents/{id}/versions` gives the version list for the "latest vs viewed" label.
- `create_signed_url` precedent in two API modules.

### Established Patterns
- Blocking supabase-py calls wrapped in `run_in_threadpool` (D-v2.5-01).
- Settings in `app_settings`, env vars for secrets/infra only.
- Migrations: numbered SQL in `supabase/migrations/`, pasted in SQL editor, then `bash scripts/regenerate-full-schema.sh`.
- `frontend/src/lib/api/*` modules (barrel split taken at 207): add to a module, never the barrel.

### Integration Points
- `extraction_service.py` page loop (`reader.pages` ~line 172) for `page_count`; upload pipeline persists new columns.
- `DocumentDetailPanel.tsx` (596 L) header + a facts section; `DocumentList.tsx` row actions; `types/index.ts` `Document` type (optional fields).

</code_context>

<specifics>
## Specific Ideas

- Failure shapes to drive live: URL minted before org check; link still valid an hour later; 2019 contract reading "created 2026"; old docs showing `0 pages`; panel shows v1 but download returns latest; download works for uploader but 403s for an org colleague who can see the doc.
- Dev account is in TWO orgs: prove the active org before trusting an absence in the cross-org refusal test.
- Milestone rule: live drive as a real user with recorded evidence, not fixtures alone.

</specifics>

<deferred>
## Deferred Ideas

- Backfill of old documents' file facts (script or lazy fill): consciously not done; revisit if "not recorded" proves noisy. Re-ingest fills a doc.
- Fetch original from the source connector on demand for docs with no stored file: new egress capability, own phase.
- Two-button (this version / latest) download layout: rejected for clutter.

### Reviewed reported bugs (not folded)
- `BUG-260908-01` (chunks section unbounded, buries sections below it) touches `DocumentDetailPanel.tsx` but is a different defect; stays open. Plan may note the overlap when adding the facts section.

### Seeds sweep
- `check-seeds-register.cjs --phase 270` could not run at discuss time (FATAL: no phase directory existed). Re-run at plan time.

</deferred>

---

*Phase: 270-The Document as an Object*
*Context gathered: 2026-09-30*
