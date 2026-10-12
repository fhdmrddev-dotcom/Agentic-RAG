# Phase 275: Retention & Legal Hold - Context

**Gathered:** 2026-10-12
**Status:** Ready for planning

<domain>
## Phase Boundary

An org admin says **how long** a document class or a folder is kept and **what happens after**
(archive / delete / review). A named legal hold stops it. A scheduled sweep **archives on its own**
and **queues deletes for a person to confirm**; every action writes a receipt. Archived documents
leave every agent retrieval path but stay findable, openable and downloadable from the Library.

Requirements: RET-01..04. Primary seed: `SEED-250`. ⛔ This deletes customer data. It ships with
the `SRC-06` fail-closed discipline: dry run before any real sweep; ambiguous means nothing happens;
a hold blocks **every** deletion path.

Not in scope: chat/message retention, per-org rate limits (SEED-345's other half), `workspace_files`
(thread attachments are never documents, D-274-01, and the sweep must never touch that table).

</domain>

<decisions>
## Implementation Decisions

### Carried forward from sketch 275 (operator, 2026-10-12, G-2 gate satisfied)
- **D-01:** Policy home is **Org admin → Retention**, unlocking the locked tab in `OrgAdminShell.tsx:104-109`. Sub-tabs with counts: **Policies · Legal holds · Waiting for you · History** (sketch 1B). The red count on "Waiting for you" is the only signal; no banner.
- **D-02:** Policy editor is a plain form. **Save is locked until Preview (the dry run) has run**; any edit after Preview marks it stale and re-locks Save (sketch 2B).
- **D-03:** Delete approval is **one batch per policy**: untick to keep, **type the count** to confirm. Every document is **re-checked at confirm**; a hold placed after the sweep drops that document and writes a "did not delete" receipt (sketch 3A).
- **D-04:** The Library shows retention: row chips (**On hold · Archived · Archives tonight · Delete pending · No date**, plus **Deleted at source** from D-17), a folder line naming the folder's policy/hold, and a **Retention section** in the document detail panel. Archived documents hidden by default with **"N archived hidden · Show"** and an **"Include archived"** control beside the version filter (sketch 4B).
- **D-05:** A legal hold is a **named matter** with a reason, covering documents and/or whole folders, **including anything added to those folders later**.
- **D-06:** Fail-closed states (all from the sketch, all binding): **no date → nothing happens**; **two policies that disagree on one document → nothing happens** until one changes, shown as a collision in Preview; **held → skipped by the sweep and refused by Delete**; **hold placed after the sweep → dropped at confirm**.
- **D-07:** Copy is **ported from the sketch** (`.planning/sketches/275-retention-legal-hold/index.html`), never re-typed. Visible text, never tooltip-only (OV-266-01).

### Delete gate + SC#3 wording
- **D-08:** **No automatic delete exists anywhere.** The sweep **archives on its own**; delete-action documents are **queued** in "Waiting for you" and nothing is deleted until an org admin confirms the batch (D-03). Each confirmed delete writes one receipt. ⛔ No per-policy auto-delete toggle.
- **D-09:** **ROADMAP SC#3 is reworded** to match D-08 (original kept, struck through, in ROADMAP.md): *"A dry run reports exactly what a sweep would do before any real sweep has run. A scheduled sweep then archives exactly the archive set on its own and queues exactly the delete set; nothing is deleted until an org admin confirms the batch. Every action writes one audit record naming the document, the policy, the action, the approver (for deletes) and the time. An incomplete or ambiguous evaluation disposes nothing."*
- **D-10:** Action **review** puts the document in "Waiting for you" with **Keep / Archive / Delete** per document. Delete still goes through the type-the-count confirm.
- **D-11:** A **kept** document (unticked from a batch, or "Keep" on review) is **skipped until the policy is edited or the document changes**. Recorded as "kept by <admin>" in History. Not re-proposed nightly.
- **D-12:** A confirmed delete removes **everything**: the row, **all its versions**, chunks/tables/images (cascade), and the file bytes in storage. No soft-delete grace window. **The receipt outlives the document**: it keeps the document name, policy, action, approver and time.
- **D-13:** ⚠ Constraint derived from D-12 (scout finding): `audit_log.user_id` is `ON DELETE CASCADE` from `auth.users` (full-schema.sql:5938), so a receipt keyed only on the approver's `user_id` **disappears when that user is deleted**. Disposition receipts must not cascade away. Research decides the shape (a retention-owned receipts table, or `SET NULL` on the receipt's actor), but the property is locked.

### Hold reach (every path)
- **D-14:** **The database refuses** deleting a held document, from **any** path: user JWT, service role, FK cascades (including `documents_user_id_fkey ON DELETE CASCADE` from `auth.users`), and future code. On top of that, **each app path checks first** so the user gets a readable reason. Accepted side effect: deleting a user who owns held documents fails until the hold is released. The six known paths that must each check and explain:
  1. `DELETE /documents/{id}` `scope=version` (`documents.py:1866`)
  2. `DELETE /documents/{id}` `scope=all` (`documents.py:1835`)
  3. folder delete (`folders.py:133-169`, recursive)
  4. watch delete with `?purge_documents=true` (`sources.py:324-334`)
  5. watch purge of missing/unauthorized items (`sources.py:466-473`)
  6. user deletion cascade (database only)

  Plus the disposition confirm itself (D-03 re-check).
- **D-15:** A **folder delete** that contains any held document (at any depth) is **refused whole**: "This folder has N documents on legal hold. Nothing was deleted." All-or-nothing.
- **D-16:** A hold **stops deletion only**. New versions, metadata edits and re-ingest still work. **The hold covers every version** of a held document, and versioning never deletes old versions (`ingest_splice.py:259-262`).
- **D-17 (hold visibility):** A member sees **"On legal hold. Ask an org admin."** with **no matter name or reason**. Org admins see the name and reason. Enforced server-side (the API does not return the matter name to members), not only hidden in the UI.

### Archive + what "findable" means
- **D-18:** Archived documents are excluded from **every agent path**: `search_documents` (both vector and keyword arms), `query_documents`, `grep`, `read_document`, and Expert-scoped retrieval. The Library and Find **hide them by default** with "Include archived". **Open and download always work.** This closes the "archived exclusion applies to one retrieval arm only" failure. ⚠ D-272-22 accepted that grep/query_documents/read_document are not structurally locked by *filters*. This decision is different: the archived exclusion **must** reach them.
- **D-19:** **Org admins can un-archive.** The policy then skips that document until the policy or document changes (the D-11 rule). A receipt is written.
- **D-20:** A policy may have an **optional second stage**: "archive at X, then queue delete at Y". One policy, one rule, so a normal two-stage schedule never trips D-06's disagreement state.
- **D-21 (BUG-261004-01 folded):** Documents whose `source_state` is `missing_at_source`, `unauthorized_at_source` or `source_disconnected` are **excluded from agent retrieval the same way as archived**. They are still openable, and the Library shows a **"Deleted at source"** chip (wording for the other two states is ported or decided in UI-SPEC). **One home for the predicate** (the `retrieval_scope.py` seam plus the RPCs plus `expert_scope.py`), so the copies cannot drift again. One test per state asserts the chunk is or isn't returned.

### The policy clock
- **D-22:** **Each policy picks its clock date**: "document date" (`date_typed`, generated from `metadata->>'date'`) or "date added" (`created_at`). **No fallback.** A missing chosen date means "No date — nothing will happen" (D-06).
- **D-23:** A folder policy **covers all subfolders; the nearest folder's policy wins**. This is not counted as a disagreement.
- **D-24:** A document matched by **both a folder policy and a class policy that disagree → nothing happens** (the sketch's fail-closed rule, D-06), shown as a collision in Preview. ⛔ Not "longest keep wins".
- **D-25:** **Versions age together**, by the latest version's date. All versions archive and delete together (consistent with D-12).

### Verification (G-4, agreed at scope time)
- **D-26:** Three Chrome-driven scenarios, operator-accepted:
  1. **HOLD:** put a folder on a named hold. Deleting a document in it **and** deleting the folder are both refused with a reason, and rows show "On hold".
  2. **LIFECYCLE:**
     - Create the policy "archive after 1 day, delete after 2" on a test folder.
     - Preview lists the exact documents.
     - The sweep archives them: they are gone from chat answers, found in Find with "Include archived", and downloadable.
     - Deletes wait in "Waiting for you".
     - A hold placed before confirm drops that document with a "did not delete" receipt.
  3. **MEMBER:** a member cannot create or edit a policy (**refused by the server**, not just hidden). They see "On legal hold. Ask an org admin." with no matter name.

### Security, migrations, deploy (from ROADMAP flags, locked)
- **D-27:** Migration(s) start at **204**. They cover the policies, holds (matters + coverage), archive state, the receipts shape from D-13, the hold-refusal rule from D-14, and new `audit_log` action types extending migration 170's CHECK.
  - `VALID_ACTION_TYPES` in `audit_service.py` must stay a subset (boot asserts it). ⚠ It is already missing the three `connector.watch.*` types (scout); sync it in the same change.
  - **RLS on every new table.** Revoke function `EXECUTE` from **`PUBLIC`**, then grant back. Run `get_advisors(security)`.
  - Apply via the SQL editor, regenerate `full-schema.sql` (no reset).
- **D-28:** Policy and hold create/edit/release, delete confirm and un-archive require **`require_org_manage`** (`dependencies.py:1072`). A policy reaches **only its own org's documents**. Cross-org must be refused and tested.
- **D-29:** **Deploy parity:** migrations go to production before the backend. **The sweep ships disabled by default** (config flag), and is not enabled in production until the operator has read a dry run.
- **D-30:** `security_enforcement` and the code review are mandatory. ⛔ Never cut (G-8).

### G-5 hot-file audit (recorded at discuss)
- **D-31:** `backend/app/services/scheduler_service.py` **FIRES**. Honour by construction: the sweep is a **new service plus a claim function** in the watch pattern (`db/watches.py:205-254`, SKIP LOCKED + lease + `next_run_at`), started in the lifespan behind a config flag. **`scheduler_service.py` is not edited.**
- **D-32:** `backend/app/api/documents.py` **FIRES** (91/35/2518). Honour by construction: the hold check is **one shared guard function** (new module) called once per delete path, backed by the database refusal (D-14). No new branching logic lives in `documents.py`. An extraction of `documents.py` is **not** taken this phase. Re-open trigger: the next phase adding logic (not a guard call) to `documents.py`.
- **D-33:** `backend/app/services/retrieval_service.py` is **not edited**. The archived and source-state exclusions ride the `retrieval_scope.py` seam / RPC predicates (D-13 of 272).
  - `document_governance.py` (FIRES): touch only if the Retention section needs it; justify in the plan.
  - New rows are owed for `folders.py`, `sources.py`, `OrgAdminShell.tsx` and every new module. Run `node scripts/check-hot-file-ledger.cjs 275` at planning.

### Resolved at planning (2026-10-12, Claude — operator delegated all decisions for this run; 275-RESEARCH Open Questions)
- **D-34:** A policy reaches **only documents an org admin can see** (org-shared / org-visible under current RLS). Members' private documents are **not** evaluated, archived or queued. **Preview shows the count of documents the policy does not cover because they are private** ("N private documents are not covered"). Fail closed (SRC-06). Revisit with SEED-345's remainder.
- **D-35:** A legal hold can only cover what an org admin can pick, so **private documents cannot be held this phase**. Recorded as a known limit in VERIFICATION and a new seed ("org-wide matter by custodian"). The database hold refusal (D-14) still applies to every covered document on every path.
- **D-36:** The archived / source-state exclusion is enforced **in the two search RPCs via a stored generated column `documents.retrievable`** (`archived_at IS NULL AND (source_state IS NULL OR source_state = 'live')`), with `ANALYZE public.documents` in the migration (measured: without stats the vector arm went 25 ms → 943 ms). `query_documents` / `grep` (model-written SQL) are covered by restrictive RLS policies switched on by a transaction-local `app.agent_read` setting; service-role readers (`read_document`, `analyze_document`, `fetch_document_file`, `query_tables`) get a one-line check on the same column. The listing tools **`ls`, `tree`, `glob`** also filter non-retrievable documents (D-18 "every agent path").
- **D-37:** The sweep enable flag is the env var **`RETENTION_SWEEP_ENABLED`** (default off), matching the watch/scheduler daemons; it lands in all four deploy-parity artifacts in one commit (D-29).
- **D-38:** Every user delete path is reordered to **check hold → delete rows → remove file bytes** (today bytes are removed first, so a refused row would lose its file). The two watch-purge paths stop swallowing database errors (a refused delete must not report success).

### Claude's Discretion
- **Where the archived/source-state exclusion is enforced for chat search:**
  - Inside the RPCs (`enforced_in_rpc=True`, a migration redefining `match_document_chunks` / `keyword_search_chunks` that keeps `SET plan_cache_mode TO 'force_custom_plan'`), **or**
  - in the Python seam (`enforced_in_rpc=False`, which routes **every** unfiltered search through the two-step resolve).
  - Research must **measure** the cost before choosing. The RPC route is the likely winner, since it costs unfiltered search nothing.
  - Either way it is data in `DEFAULT_PREDICATES`, never a new branch, and it must also reach `query_documents` / `grep` / `read_document` / Find / `expert_scope.py` (D-18).
- **Archive state shape:** column(s) on `documents`, e.g. `archived_at` plus the policy that archived it. Hold coverage as a matter table plus a coverage table (document | folder).
- **Class matching:** a class policy matches on `document_type_norm` (lower-cased, free text). The editor picks from the org's live distribution (`top_document_types`, `retrieval_scope.py:451`) rather than free typing.
- **Who may confirm a delete batch:** any `org:manage` admin, including the policy's author. Four-eyes is deferred.
- **Sweep cadence:** nightly (the sketch's "Archives tonight" chip), plus on-demand Preview. One sweep per org per night via claim + lease; multi-worker safe.
- **Folder-delete audit row:** folder delete writes no audit row today. Adding one alongside the hold check is in bounds.
- **Plan count:** G-8 target is 3-5 plans.

### Folded registers
- **SEED-250** (retention is the one absent DMS capability): folded. This phase is that seed.
- **BUG-261004-01** (search serves documents deleted/unshared at source): folded as D-21.
- **SEED-345** (per-org retention + rate limits): **partially answered**. The documents half ships here; chat/message retention and per-org rate limits stay open.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design (G-2)
- `.planning/sketches/275-retention-legal-hold/README.md`: winners and fail-closed states.
- `.planning/sketches/275-retention-legal-hold/index.html`: the copy source (D-07) and the 24-document worked example.
- `Skill("sketch-findings-agentic-rag")`: covers the 080-A org band + tabs, the 062-A ledger-as-receipt (✎), the 066 graded action guards (victim-naming confirm), and the 270 labelled dates in the detail panel.

### Scope and requirements
- `.planning/ROADMAP.md` § Phase 275: goal, SC#1-4 (SC#3 reworded per D-09), "How we'd know this failed", flags.
- `.planning/REQUIREMENTS.md`: RET-01..04.
- `.planning/seeds/SEED-250-retention-and-archival-is-the-one-absent-dms-capability.md`: the shape and the fail-closed mandate.
- `.planning/seeds/SEED-345-per-org-retention-and-rate-limit-settings.md`: partially answered (see "Folded registers" above).
- `.planning/reported-bugs/BUG-261004-01-search-serves-documents-deleted-or-unshared-at-source.md`: the fix shape for D-21.

### Prior-phase decisions that bind
- `.planning/phases/272-close-means-wrong/272-CONTEXT.md`:
  - D-13: the seam takes a default predicate as data.
  - D-18: empty never means everything.
  - D-19: both arms.
  - D-21: two-step RLS resolve.
  - D-22: unlocked tools.
- `.planning/phases/272-close-means-wrong/272-RESEARCH.md` (lines ~79, ~334): the planned `not_archived` predicate and its cost warning.
- `.planning/phases/271-find-the-document/271-CONTEXT.md`:
  - D-03: Find is exact field match.
  - D-06/D-07: version filter, latest never hidden.
  - D-08/D-09: "Filing rules" sub-view.
  - Reuse `view_filter_compiler.py` / `document_view_resolver.py`.
- `.planning/phases/274-thread-scoped-attachments/274-CONTEXT.md`:
  - D-01: attachments are never documents.
  - D-11: a promoted copy IS a document.
  - D-18: the documents minters list.
  - D-28: `library_document_id ON DELETE SET NULL`.

### Project rules
- `CLAUDE.md`: migrations, RLS, the `PUBLIC` EXECUTE trap, `get_advisors(security)`, deploy parity, G-2/G-4/G-5/G-8.
- `docs/HOT-FILE-LEDGER.md`: sections for `documents.py`, `retrieval_service.py` / `retrieval_scope.py` (Phase 272), `scheduler_service.py`, `document_governance.py`.
- `docs/DEPLOYMENT-WORKFLOW.md`: parity checklist (migrations before backend; sweep flag off).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/services/retrieval_scope.py`:
  - `RetrievalPredicate` (:55), `DEFAULT_PREDICATES` (:72-83), `requires_resolved_scope` (:88), `resolve_document_scope` (:262).
  - The module docstring (:13) already names the Phase 275 `not_archived` predicate.
- `supabase/migrations/200_filtered_retrieval_document_scope.sql`: `match_document_chunks` / `keyword_search_chunks`. Hardcoded predicates are at :168-170, :191-193 and :238-240. `force_custom_plan` is at :69-79.
- `backend/app/db/watches.py:205-254` `claim_due_watches`: the claim + lease + `next_run_at` pattern for the sweep. Lifespan wiring is `main.py:529-604`, behind config flags (`config.py:1359/1399/1412`).
- `backend/app/services/audit_service.py:59-89` `write_audit_entry`, plus `VALID_ACTION_TYPES` (:13-28) and `assert_action_types_synced` (:31).
- `backend/app/dependencies.py:1072` `require_org_manage`, and `get_active_org_id` (:899).
- `frontend/src/components/org/OrgAdminShell.tsx`: `TABS` (:86-110), lazy per-tab fetch (:221-225), the render chain (:391-436), and `useOrg().canManage` (:120).
- Document search (Find): `backend/app/api/document_search.py:38`, `backend/app/models/document_search.py:148-162`, and `document_search_service.py:217` (the version filter). This is where "Include archived" joins.

### Established Patterns
- Fail closed (SRC-06, H-5 `SourceListing.complete`): `watch_service.py:531-566` never deletes and only marks state. The dry-run-first rule follows the same discipline.
- Read through the user JWT/RLS before any service-role action (BUG-260903-02, D-272-21).
- Ledger-as-receipt (062-A) and graded destructive guards (066): type-the-count is the victim-naming confirm.
- Columns: `documents.date_typed` (generated from `metadata->>'date'`), `created_at`, `document_type_norm` (generated, free text), `is_latest`, `source_state`, `folder_id`, `org_id` (no FK).
- Folders: `parent_id` self-FK CASCADE, `is_org_shared`. A folder delete removes documents with no user filter, and RLS limits it to the owner's rows. Other owners' documents fall to `folder_id NULL` (`ON DELETE SET NULL`).

### Integration Points
- The six delete paths in D-14, and the disposition confirm.
- Retrieval consumers that must honour the archived and source-state exclusion (D-18/D-21):
  - `search_documents_tool.py:1221`
  - `query_documents` / `document_view_resolver`
  - `grep`
  - `read_document`
  - `expert_scope.py`
  - Find (`document_search_service.py`)
- Library: row chips (`DocumentRow.tsx`), the folder line (`FolderNode` / Library header), the detail panel's Retention section (`DocumentDetailPanel.tsx`), and "Include archived" beside the version filter.
- `workspace_files.library_document_id` (mig 203) is `ON DELETE SET NULL`, so a disposition delete nulls the link. That is fine, and the sweep never reads `workspace_files`.

</code_context>

<specifics>
## Specific Ideas

- The sketch's worked example org (Halden & Co., 24 documents, today = 12 Oct 2026) is a good fixture shape for the dry-run tests. "Computed, not faked."
- Receipt wording reads like the sketch's History rows: document · policy · action · approver · time. A late-hold drop reads "did not delete — on legal hold since <time>".
- The member hold line is exactly "On legal hold. Ask an org admin."

</specifics>

<deferred>
## Deferred Ideas

- **Four-eyes delete approval** (a second admin must confirm a batch the first proposed). A candidate add-on for regulated buyers (SEED-249 module).
- **Soft-delete grace window** before purge. Rejected for this phase (D-12); revisit only on customer demand.
- **Chat/message retention and per-org rate limits**: the remainder of SEED-345.
- **Watch purge endpoints never remove storage bytes** (`sources.py:324-334`, `:466-473`, scout finding). They orphan files in the bucket. File as a reported bug if not fixed in passing.
- **Artifacts hold copied rows** (`message_artifacts`, mig 202) that a document disposition would not reach (an inference from 273 I-5). Note for a future data-protection review (SEED-072).
- **Storage cleanup on user deletion** is unconfirmed (no code found). It sits with the data-protection review.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md`: matched only on generic keywords (run, real, milestone). Unrelated to retention.

</deferred>

---

*Phase: 275-retention-legal-hold*
*Context gathered: 2026-10-12*
