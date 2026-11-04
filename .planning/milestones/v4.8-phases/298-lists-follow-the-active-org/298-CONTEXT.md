# Phase 298: Lists Follow the Active Org - Context

**Gathered:** 2026-10-28
**Status:** Ready for planning
**Mode:** `--auto` (operator: "continue autonomously end to end") — every gray area resolved to the
research-recommended option or to what the measured audit decides, logged in `298-DISCUSSION-LOG.md`.

<domain>
## Phase Boundary

Library folders (and the Library's Root documents), the Workflows list (published and drafts), the chat
thread list and workflow run history show only the **active org's** items, and refresh when the org
changes, with no flash of the old org's rows. A workflow cannot be saved or launched pointing at another
org's folder: the refusal is worded and names the folder. A person with items in another org sees
"N items in <org>" instead of a silent gap, and can move one of their own mis-stamped items to the right
org, one at a time, each move audited.

The read-only audit (SC#1) is **already measured** — `298-ORG-AUDIT.md`. Its counts shaped D-14..D-19.

Requirements: ORG-01, ORG-02, ORG-03, ORG-04, ORG-05, ORG-06.

**Not this phase:** entity deep links, the cross-org switch prompt on a link, `org_id` on the run read
(Phase 299); org-scoping chat retrieval or the agent's KB search (unchanged by design, D-05);
BUG-261027-02 "No recent chats while loading" (routed to 299 — but see D-11, which this phase must not
make worse).

</domain>

<decisions>
## Implementation Decisions

### Per-org vs per-person (SEED-389's open question)
- **D-01:** **Per-org.** Decided at milestone intake and recorded here as SEED-389's answer: a person's
  lists are the active org's lists. System-global workflows stay visible in every org (they belong to no
  user's org).

### How the server narrows (ORG-01..04)
- **D-02:** Narrowing happens **only at the list routes**, never inside `fetch_visible_folders` or any other
  shared helper. Routes: `GET /folders`, `GET /folders/{id}/children`, `GET /documents` when listing Root
  (`folder_id=root`) plus the Library document summary/counts that feed it, `GET /workflows/published`
  (the owner arm only — `is_system_global` rows unchanged), `GET /workflows/drafts`, `GET /threads`,
  `GET /workflow-runs`. ⛔ `fetch_visible_folders`'s body, positional signature and `restrict_org_ids`
  default stay byte-identical (ledger invariant; research pitfall 13).
- **D-03:** The org is read with the existing **`resolve_active_org_or_none`** (`dependencies.py:1020`).
  A resolved org → narrow to `{org}`; `None` (no header — API-key and other unattended callers, or a
  header naming an org the caller is not in) → **today's behaviour, unchanged**. This is the polarity rule:
  ⛔ never convert "no org" into `set()` or into an empty filter, and never let an empty set reach a scope
  computation (an empty restricted scope = search everything, Phase 266). `get_active_org_id` (which 400s
  a header-less two-org caller) is NOT used on these routes.
- **D-04:** Folder routes pass the existing keyword `restrict_org_ids={org}` (295-10 already makes a
  non-empty set narrow BOTH the owned and the org-shared arm — the arm that actually leaked in the 296
  G-4 observation, per the audit). The other routes add one `org_id = <org>` predicate.
- **D-05:** Unchanged on purpose: chat retrieval (`agent_loop`), `kb.py`, `document_search_service`,
  `document_view_resolver`, `expert_scope_*`, run start / resume / Continue (`run_producer`,
  `harness/scope.py` override gate), and the 297 thread-folder authorizer. Runs keep resolving scope from
  the **definition's** org, never the viewer's.
- **D-06:** New narrowing logic lives in a **new module** (`backend/app/services/org_lists.py` or similar
  — planner names it), so each hot route gains one expression honoured by construction (G-5): one call or
  one keyword per route.

### Uploads land where they are listed (folds SEED-313)
- **D-07:** Because Root documents now narrow by org, `POST /documents/upload` must stamp the org it will
  be listed under, or a two-org user's fresh upload vanishes. The foldered arm **already ships** (280-03
  D-26: a foldered upload mints in that folder's org). This phase adds only the **Root arm**: a Root upload
  takes the **active org** (`resolve_active_org_or_none`), falling back to today's trigger only when it
  resolves to `None`. One expression in `documents.py` (hot, 39 phases), the decision in the new module.

### Refresh on switch, with no flash (ORG-01..04, pitfall 15)
- **D-08:** Every list that narrows re-fetches when `activeOrgId` (OrgProvider) changes: `useFolders`
  (Library + chat folder picker), `useLibraryDocuments` + its summary, `LibraryPage` views/metadata and
  the `listExpertInstalls` provenance effect (folds **SEED-317**), `WorkflowsPage` published/drafts/
  starters, `RunLogPanel`, `useThreads`, `useBuilderNameMaps`, `DescribeKbPicker`. One shared hook
  (e.g. `useActiveOrgId()` from OrgProvider) supplies the key; no keyed remounts (297 rule: the router and
  providers never remount on a switch).
- **D-09:** On a switch each list **drops its rows at once** and shows its existing loading state — never
  the old org's rows, never "0" / "No …" before the new answer arrives. A response that comes back for
  the previous org is **discarded** (sequence/org guard), so a slow old fetch cannot repaint.
- **D-10:** The `folders` Realtime channel ignores an incoming row whose `org_id` ≠ the active org.
  Realtime stays a hint; the refetch is the truth (D-v2.5-03).
- **D-11:** The thread list's switch refetch shows a loading line, not "No recent chats" (do not widen
  BUG-261027-02; its full fix stays in 299). A thread that is mid-send when the switch happens is the
  StreamsProvider's (`sendingThreadsRef` survives the teardown) — the list must not crash or orphan it;
  it simply is not listed in the new org.
- **D-12:** An action started on a row from the old org cannot write under the new org: list actions use
  the row's own id, and server writes that already resolve org from the row keep doing so. The planner
  confirms which list actions stamp the active org instead (create-folder, create-draft) and makes sure no
  stale row can trigger one after a switch.

### Refusing a foreign-org folder (ORG-05)
- **D-13:** Check = "every folder the definition binds (`project_folder_id` and per-phase `folder_scope`)
  is in **the definition's org**". Reuse `harness/scope.folder_scope_violations(...,
  restrict_org_ids={definition_org})` — the same rule publish stage 2.6 already enforces — in a thin
  helper that returns the offending folder.
  - **Save** (`POST /workflows/drafts`, `PATCH /workflows/drafts/{id}`): refused only when the request
    **sets or changes** a binding to a foreign folder. An unchanged pre-existing foreign binding saves
    through (preserved, never silently stripped).
  - **Launch** (`preflight_workflow_kickoff` — every door: attended, scheduled, API key, chat-started):
    refused. Measured safe: 0 production workflows carry a cross-org binding (audit).
  - The definition's org comes from the row (`_definition_org_id` precedent), never the viewer's header.
- **D-14:** The refusal is a **422** with a worded `detail` that names the folder and its org:
  *"“Q3 Contracts” is in Acme Legal, not in this workflow's organization (Personal). Pick a folder from
  Personal."* If the caller cannot see the folder at all, it says *"a folder you can't open"* and names no
  org (no leak). Never a 500, never a generic "invalid". The UI shows the server's sentence verbatim where
  the save/launch already shows refusals.
- **D-15:** Builder pickers render an out-of-org bound folder **by name with a "lives in <org>" marker**
  (instead of today's `UNNAMED_KB_OPTION` or `DescribeKbPicker`'s silent `onChange("")`), so the author
  sees what will be refused. ⚠ `DescribeKbPicker`'s silent drop on a non-offered id must not strip a
  bound folder merely because the list narrowed.

### Honest count of items elsewhere (ORG-06)
- **D-16:** One new read route returns, for the caller's **own** items outside the active org, a count
  per kind (folders, Root documents, workflows, threads, runs) per other org, with that org's name — one
  round trip, refetched on switch. Membership-checked; only orgs the caller is a member of are named.
- **D-17:** Each narrowed list shows one quiet line when its count is > 0:
  *"3 more in Acme Legal · Switch"* — Switch calls the existing `switchOrg`. Zero → no line. The line
  never reads 0 while items exist, and is absent (not "0") while loading.

### Moving a mis-stamped item (ORG-06) — shape decided by the audit
- **D-18:** The audit found **no identifiable mis-stamp** (cloud: 0 multi-org users; local: only deliberate
  fixtures). A `LIMIT 1` mis-stamp always lands in a real membership, so only the owner can judge it. So:
  no migration repair, ⛔ never a bulk re-stamp; the move is a rare, owner-initiated, per-item repair.
- **D-19:** Movable kinds in v1: **a workflow definition** (draft or published, owned by the caller, not
  system-global, no live run) and **a Library folder the caller owns** (with its subtree and their
  documents and those documents' org-stamped child rows, in **one transaction**), plus **a Root
  document** (same document machinery). Refused with a worded reason when the folder is org-shared, under
  a legal hold, watched by a connector, or contains a folder/document the caller does not own. **Threads
  and runs are count + Switch only** in v1 (a thread drags messages, runs and artifacts) — recorded as a
  new seed.
- **D-20:** Every move: caller owns the item; caller is a **member of both** the source and target org
  (checked server-side through `org_members`, never trusted from the client); one `audit_log` row per move
  naming item kind, id, from-org and to-org. The new action type is added to `VALID_ACTION_TYPES` **and**
  the `audit_log_action_type_check` CHECK in the same change → **migration 217** (next free number;
  re-run `ls supabase/migrations` first). Paste into the local SQL editor, then
  `bash scripts/regenerate-full-schema.sh` (no `--reset`); cloud paste is an operator step before deploy.
- **D-21:** The move control lives on the item (row menu / detail), worded *"Move to <org>…"*, with a
  confirm that names what moves ("This folder, 2 subfolders and 14 documents move to Acme Legal").
  After a move the item leaves the current list and the elsewhere count updates.

### Security (security_enforcement)
- **D-22:** The move is a cross-org write: threat-model it in the plan. Anon-role test on every new route
  (pitfall 16 / BUG-260911-01 class — no request in the suite has ever run as `anon`). Any new SQL function:
  revoke from `PUBLIC`, then grant back. `get_advisors(security)` read after the cloud paste.

### Guardrails
- **D-23:** **G-2:** the "N more in <org> · Switch" line, the out-of-org picker marker and the move confirm
  are new UI. Under the autonomous mandate the sketch/UI-SPEC is produced and self-approved in planning;
  recorded as a guardrail override in STATE.md; operator sees it at G-4.
- **D-24:** **G-4** scenarios set now (Claude drives in Chrome, dev account in two orgs — prove the active
  org first, memory `reference_dev_account_is_in_two_orgs`):
  1. Switch org on the Library: the old org's folders never show after the switch; the new org's appear.
  2. Switch on Workflows (Yours + drafts) and on run history: same.
  3. Switch with a chat streaming in thread A: the stream's behaviour is what StreamsProvider already does,
     the thread list reloads without "No recent chats", nothing crashes.
  4. Pick another org's folder for a workflow (via a crafted request) → worded refusal naming the folder.
  5. "N more in <org> · Switch" appears with the true count; Switch lands in that org with those items.
  6. Move a folder to the other org → it leaves this list, appears there, one audit row.
- **D-25:** **Before/after matrix (SC#3)**, as tests: a two-org user × {chat retrieval, scheduled run,
  API-key run, publish, attended launch} asserts the same folder set before and after, plus the empty-set
  case asserting an empty/absent org never widens access. Header-less unattended calls must not 400.
- **D-26:** **G-5:** every touch to a FIRING file is one expression honoured by construction
  (`folders.py`, `threads.py`, `workflow_runs.py`, `workflows.py`, `db/workflows.py`, `documents.py`,
  `workflow_kickoff.py`, `useThreads.ts`, `useDocuments.ts`, `LibraryPage.tsx`, `WorkflowsPage.tsx`,
  `WorkflowBuilderPage.tsx`); logic goes to new modules. `publish_service.py` is NOT touched. Ledger rows
  re-derived in the same commit (`node scripts/check-hot-file-ledger.cjs`).
- **D-27:** **G-8:** target 4 plans. Plan 1 backend narrowing + upload stamp + the elsewhere-count route;
  Plan 2 ORG-05 refusal + pickers; Plan 3 move (migration 217, both-org membership, audit); Plan 4
  frontend refresh-on-switch + the count line + move control. Plans 1 and 3 mutate/depend on the local DB
  → serialized (worktree rule 4).
- **D-28:** Cross-provider roster: not exercised — no provider, prompt or streaming code changes. The
  chat-retrieval row of D-25 runs on one provider; stated as a decision, not omitted.

### Post-research amendments (2026-10-28, `--auto`, from 298-RESEARCH.md)
- **D-29 (amends D-07):** `uploadDocument` (`frontend/src/lib/api/documents.ts:164-171`) sends no
  `X-Org-Id`, so the Root-upload stamp also needs the client to attach the active-org header. The backend
  helper returns `None` whenever a folder is given, so the 280-03 folder arm is byte-identical.
- **D-30 (amends D-13):** scheduled runs (`scheduler_service.launch_scheduled_run`) and API-key runs
  (`inbound.start_workflow_run`) do not go through `preflight_workflow_kickoff`. Each gets its own call to
  the same refusal helper beside `template_refusal` (the 295 precedent): a recorded schedule outcome with
  the worded reason, and a 422 for the API key. The definition's org must be read from the row (today
  `get_definition` omits `org_id`, so `scheduler_service.py:132` reads `None`).
- **D-31 (amends D-19):** **published workflows are NOT movable in v1.** The
  `workflow_definitions_block_published_update` trigger rejects an `org_id` change on a published row, and
  loosening a publish lock is not worth it at a measured mis-stamp count of 0. Movable workflows = **drafts
  only, one row**. A published workflow in the wrong org shows in the count with Switch; a seed records
  the published move. Migration 217 therefore only extends the audit action CHECK.
- **D-32 (amends D-02):** narrow **every non-folder read** of `GET /documents` (Root and the IngestionTab
  status lists) with the same predicate as `LIBRARY_SUMMARY_SQL` (`$1::uuid IS NULL OR org_id = $1`), so the
  summary pill and its lists always agree.
- **D-33 (amends D-19):** a folder move is **refused** (worded) when any chat thread is bound to a folder in
  the subtree, when a workflow binds a folder in the subtree, or on any blocker the research lists
  (duplicate-content collision in the target org, version history crossing the subtree, watch, hold,
  retention, org-shared). Only the clean case moves.
- **D-34 (amends D-13):** the refusal's folder set is **every folder the definition names**:
  `project_folder_id`, per-phase `folder_scope`, kb_auto `inputs[].folder_scope`, and
  `output_target_folder`.
- **D-35 (amends D-20):** the move runs as **one asyncpg transaction on the pool** (child tables have no
  user UPDATE policy) with the audit row written **inside** it, recorded under the **org the item leaves**,
  metadata naming the target org. Membership in both orgs is checked inside the same transaction.
  ⚠ Deploy order: the boot audit-type sync check refuses to start without mig 217, so 217 is pasted
  (local, then cloud) **before** the new backend runs.
- **D-36 (amends D-14/D-16):** the attended save/launch refusal uses the existing `stale_token` shape,
  `detail={code: "folder_in_other_org", message}`, and the Builder save + chat in-thread picker branch on
  `code` (today they swallow every 422 as a generic message); scheduled/API-key keep a plain string. The
  count excludes archived Root documents (matches the list default). OrgProvider calls
  `syncActiveOrgHeader` when it adopts the default org on a fresh device, so an org-tagged list guard
  cannot wait forever.

### Claude's Discretion
- Route and module names, the response shape of the elsewhere-count route, exact copy beyond the
  sentences above (keep them plain and specific), and the request-guard mechanism in D-09.

### Folded seeds
- **SEED-389** — this phase is its answer (per-org, D-01).
- **SEED-317** — the Library provenance effect re-reads on an org switch (D-08); its trigger ("a phase that
  gives LibraryPage an active-org handle") fires here.
- **SEED-313** — its open no-folder arm: a Root upload stamps the active org (D-07); without it D-02 makes
  fresh Root uploads vanish. (Folder arm settled by 280-03.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase inputs
- `.planning/phases/298-lists-follow-the-active-org/298-ORG-AUDIT.md` — the measured audit (SC#1); decides D-18/D-19
- `.planning/ROADMAP.md` §"Phase 298" — goal, success criteria, "How we'd know this failed", flags
- `.planning/REQUIREMENTS.md` — ORG-01..06
- `.planning/research/SUMMARY.md` §"Org narrowing", §Critical pitfalls 6-7, Open questions 1, 9, 10
- `.planning/research/PITFALLS.md` — pitfall 13 (shared helper / polarity), 14 (mis-stamped rows), 15 (no refetch on switch), 16 (RLS / PUBLIC grants)

### Seeds folded
- `.planning/seeds/SEED-389-lists-follow-the-active-org.md`
- `.planning/seeds/SEED-317-library-provenance-does-not-follow-org-switch.md`
- `.planning/seeds/SEED-313-upload-never-stamps-the-active-org.md`

### Invariants and ledger
- `docs/HOT-FILE-LEDGER.md` — sections for every file in D-26, and `backend/app/utils/folder_utils.py` (signature + polarity invariants, 295-10)
- `CLAUDE.md` §Supabase MCP (writes approval-gated), §migrations, §G-2/G-4/G-5/G-8, anon / PUBLIC grant trap
- `supabase/migrations/105_personal_org_backfill.sql`, `106_org_id_autofill_trigger.sql` — the mis-stamp sources
- `supabase/migrations/215_api_keys_and_run_origin.sql:174` — the latest `audit_log_action_type_check` (the one 217 replaces)

### Prior phase
- `.planning/phases/297-every-view-has-an-address/297-CONTEXT.md` — no keyed remounts, router above providers

</canonical_refs>

<code_context>
## Existing Code Insights (scout, 2026-10-28)

### Reusable assets
- `backend/app/utils/folder_utils.py:222` `fetch_visible_folders(..., restrict_org_ids=)` — `None` unrestricted, `set()` owned-only, non-empty narrows owned + shared.
- `backend/app/dependencies.py:1020` `resolve_active_org_or_none` — no/foreign header → `None`, no error (used by create_folder, create_draft, send_message).
- `backend/app/services/harness/scope.py:283` `folder_scope_violations` — the publish 2.6 rule; `FolderScopeSubsetError` wording.
- `backend/app/services/harness/publish_service.py:768` `_definition_org_id` — definition org from the row.
- `backend/app/api/threads.py:1194` `_authorize_thread_folder` — per-folder org check pattern.
- `backend/app/services/audit_service.py:13` `VALID_ACTION_TYPES` (boot fails if out of sync with the CHECK), `write_audit_entry(..., org_id=)`.
- `backend/app/db/api_keys.py:207` `is_org_member(pool, org_id=, user_id=)`; `folder_utils._resolve_caller_org_ids`.
- `frontend/src/providers/OrgProvider.tsx:90` `activeOrgId`, `:173` `switchOrg`; `frontend/src/lib/api/_core.ts:286` X-Org-Id.

### What filters today (nothing by org)
- `/folders` + children: `folders.py:24-47`, no restriction. `/workflows/published`: `db/workflows.py:588` (`is_system_global OR created_by`). `/workflows/drafts`: `db/workflows.py:1091`. `/threads`: `threads.py:269-287` (`user_id`, `is_eval=false`). `/workflow-runs`: `workflow_runs.py:658-742`. Root docs: `documents.py:867-925` on the `library_documents` view (exposes `org_id`, mig 207).
- Save runs no org check (`workflows.py:1176-1182` comment); launch preflight runs `assert_folder_scopes_subset` unrestricted (`workflow_kickoff.py:301-308`, documented "DELIBERATELY WITHOUT restrict_org_ids" at `scope.py:378`).

### Frontend fetch effects (none keyed on org)
- `useFolders.ts:24-80` (+ unfiltered Realtime `:43-67`), `useLibraryDocuments.ts:230-291`, `useDocuments.ts:69-158` (Realtime), `LibraryPage.tsx:397-400` and `:499-511`, `WorkflowsPage.tsx:443/478/508`, `RunLogPanel.tsx` (`[scope]`), `useThreads.ts:29-37` (refetched only by `ChatLayout.tsx:190-199`), `useBuilderNameMaps` (`WorkflowBuilderPage.tsx:81-138`), `DescribeKbPicker.tsx:174-231` (drops a non-offered id).
- Org switch: `StreamsProvider.tsx:4483-4532` aborts run subscriptions, keeps `sendingThreadsRef` threads.

### Org stamping
- Every in-scope table has `org_id NOT NULL` (mig 105). Mig 106 autofills NULL with `LIMIT 1` by owner; `workflow_runs` from its thread. No move/re-stamp endpoint exists.

</code_context>

<specifics>
## Specific Ideas

- The count line's wording: "3 more in Acme Legal · Switch" — plain, one line, below the list header.
- Refusal wording names the folder and both orgs (D-14).
- `workflow_definitions.definition` is double-encoded on 325 local rows (SEED-154): any SQL reading `project_folder_id` must decode (`definition #>> '{}'`).

</specifics>

<deferred>
## Deferred Ideas

- **Thread and run moves** across orgs (they drag messages, runs, artifacts) — new seed at plan time, trigger: a multi-org user reports a thread in the wrong org.
- **Org-scoping chat retrieval / the KB picker in chat** (research open question 10) — accepted as unchanged in v4.8; covered by D-05.
- **Per-run folder override at run start may name the owner's folder in another org** (`resolve_run_scope_root`, inherited, 295-10 ledger note) — left; candidate seed.
- **BUG-261027-02** — stays `open`, folded by Phase 299 (ROADMAP).
- **SEED-351** (eval runs billed to a guessed org), **SEED-311**, **SEED-377** (split `api/workflows.py`) — reviewed, not in scope.

</deferred>

---

*Phase: 298-lists-follow-the-active-org*
*Context gathered: 2026-10-28*
