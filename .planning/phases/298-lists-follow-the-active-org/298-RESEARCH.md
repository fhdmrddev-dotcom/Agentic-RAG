# Phase 298: Lists Follow the Active Org - Research

**Researched:** 2026-10-28
**Domain:** Multi-org list narrowing (FastAPI + supabase-py + asyncpg, React hooks), a cross-org move write, one migration
**Confidence:** HIGH for edit points and fences (every claim below was read in this tree today); MEDIUM for the move's refusal set (derived from the schema, not from a driven run)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
(Copied verbatim from `298-CONTEXT.md` `<decisions>`.)

#### Per-org vs per-person (SEED-389's open question)
- **D-01:** **Per-org.** Decided at milestone intake and recorded here as SEED-389's answer: a person's
  lists are the active org's lists. System-global workflows stay visible in every org (they belong to no
  user's org).

#### How the server narrows (ORG-01..04)
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

#### Uploads land where they are listed (folds SEED-313)
- **D-07:** Because Root documents now narrow by org, `POST /documents/upload` must stamp the org it will
  be listed under, or a two-org user's fresh upload vanishes. The foldered arm **already ships** (280-03
  D-26: a foldered upload mints in that folder's org). This phase adds only the **Root arm**: a Root upload
  takes the **active org** (`resolve_active_org_or_none`), falling back to today's trigger only when it
  resolves to `None`. One expression in `documents.py` (hot, 39 phases), the decision in the new module.

#### Refresh on switch, with no flash (ORG-01..04, pitfall 15)
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

#### Refusing a foreign-org folder (ORG-05)
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

#### Honest count of items elsewhere (ORG-06)
- **D-16:** One new read route returns, for the caller's **own** items outside the active org, a count
  per kind (folders, Root documents, workflows, threads, runs) per other org, with that org's name — one
  round trip, refetched on switch. Membership-checked; only orgs the caller is a member of are named.
- **D-17:** Each narrowed list shows one quiet line when its count is > 0:
  *"3 more in Acme Legal · Switch"* — Switch calls the existing `switchOrg`. Zero → no line. The line
  never reads 0 while items exist, and is absent (not "0") while loading.

#### Moving a mis-stamped item (ORG-06) — shape decided by the audit
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

#### Security (security_enforcement)
- **D-22:** The move is a cross-org write: threat-model it in the plan. Anon-role test on every new route
  (pitfall 16 / BUG-260911-01 class — no request in the suite has ever run as `anon`). Any new SQL function:
  revoke from `PUBLIC`, then grant back. `get_advisors(security)` read after the cloud paste.

#### Guardrails
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

### Claude's Discretion
- Route and module names, the response shape of the elsewhere-count route, exact copy beyond the
  sentences above (keep them plain and specific), and the request-guard mechanism in D-09.

#### Folded seeds
- **SEED-389** — this phase is its answer (per-org, D-01).
- **SEED-317** — the Library provenance effect re-reads on an org switch (D-08); its trigger ("a phase that
  gives LibraryPage an active-org handle") fires here.
- **SEED-313** — its open no-folder arm: a Root upload stamps the active org (D-07); without it D-02 makes
  fresh Root uploads vanish. (Folder arm settled by 280-03.)

### Deferred Ideas (OUT OF SCOPE)
- **Thread and run moves** across orgs (they drag messages, runs, artifacts) — new seed at plan time, trigger: a multi-org user reports a thread in the wrong org.
- **Org-scoping chat retrieval / the KB picker in chat** (research open question 10) — accepted as unchanged in v4.8; covered by D-05.
- **Per-run folder override at run start may name the owner's folder in another org** (`resolve_run_scope_root`, inherited, 295-10 ledger note) — left; candidate seed.
- **BUG-261027-02** — stays `open`, folded by Phase 299 (ROADMAP).
- **SEED-351** (eval runs billed to a guessed org), **SEED-311**, **SEED-377** (split `api/workflows.py`) — reviewed, not in scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ORG-01 | Library folders show only the active org's items; switching refreshes | §Edit points B1-B3, B5 (folders + Root/summary narrowing); §Frontend F1-F3 (useFolders org guard + Realtime filter, useLibraryDocuments org key, LibraryPage selection reset); upload header gap (Pitfall 2) |
| ORG-02 | Workflows list (published + drafts) shows only the active org's | §B6-B7 (db-layer keyword, fences that pin the predicate); §F5 (WorkflowsPage feeds); Pitfall 7 (useDraftPersistence reload, WorkspacePanel soul lookup) |
| ORG-03 | Chat thread list shows only the active org's threads | §B8 (`list_threads` predicate); §F4 (useThreads org-tagged state; ChatLayout already refetches; ChatHistoryColumn loading line) |
| ORG-04 | Run history shows only the active org's runs | §B9 (`list_workflow_runs` + the signature fence `test_there_is_no_all_users_mode`); §F6 RunLogPanel |
| ORG-05 | Save/launch to another org's folder refused, worded; unattended doors keep working | §ORG-05 doors (FOUR doors, two of which bypass `preflight_workflow_kickoff`); refusal wire shape; §Save "binding changed" algorithm; §D-15 pickers + labels read |
| ORG-06 | Honest count + per-item audited move; audit measured first | §Elsewhere-count SQL (RLS connection); §Move inventory (what moves, what refuses); migration 217 shape incl. the published-row trigger blocker; audit atomicity |
</phase_requirements>

## Summary

The phase is mostly a set of one-expression edits on hot routes plus three new modules (a backend
narrowing/refusal module, a backend move service + router, and a frontend active-org hook with an
elsewhere-count store). The narrowing itself is cheap: `fetch_visible_folders` already supports
`restrict_org_ids` (295-10 made a non-empty set narrow both arms), `library_documents` already exposes
`org_id` (mig 207/208), and every other list table carries `org_id NOT NULL`. The difficult parts are not
the predicates; they are (1) four places where the existing code does not behave the way CONTEXT assumes,
(2) the move's long tail of rows and constraints, and (3) the many source fences that pin the touched
routes byte-for-byte.

Four findings change how the plans must be written. **First**, `POST /documents/upload` from the web
client never sends `X-Org-Id` (`uploadDocument` builds its own headers from `getAuthToken()`), so the D-07
Root arm is a no-op unless `frontend/src/lib/api/documents.ts` is changed too. **Second**, D-13 says the
launch check sits in `preflight_workflow_kickoff` for every door, but the scheduled door
(`scheduler_service.launch_scheduled_run`) and the API-key door (`inbound.start_workflow_run`) never call
the preflight; each needs its own call, exactly as `template_refusal` was added at both in Phase 295.
**Third**, a published `workflow_definitions` row cannot change `org_id` at all: the
`workflow_definitions_block_published_update` trigger raises `check_violation` on any `org_id` change, so
D-19's "draft or published" move needs migration 217 to amend that trigger (or the plan must descope
published moves with a recorded decision). **Fourth**, the Library summary feeds IngestionTab, whose status
lists call `GET /documents` with no `folder_id`; narrowing only `folder_id=root` would make the in-flight
pill disagree with its own list, so the list route should narrow every non-folder read with the same
predicate as the summary.

**Primary recommendation:** Build `backend/app/services/org_lists.py` (polarity-safe helpers:
`folder_kw(org)`, `by_org(query, org)`, `root_upload_org(...)`, `foreign_binding_refusal(...)`), a new
router module for the two new read/write surfaces (never on `/workflows` or a Library-domain module, see
the fences), migration 217 (audit CHECK + the published-trigger amendment), and
`frontend/src/hooks/useActiveOrgId.ts` + an org-tagged state pattern applied inside each list hook so
LibraryPage / WorkflowsPage / ChatLayout each gain one call, not a block.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Which org a list shows | API / Backend (list routes) | Browser (sends `X-Org-Id`) | The header is a hint; `resolve_active_org_or_none` re-validates membership server-side |
| Folder visibility rule | API / Backend (`fetch_visible_folders`) | Database (RLS) | One home of the rule (SEED-124); routes pass the keyword, never post-filter |
| Root/summary narrowing | Database view `library_documents` + API predicate | — | Same predicate on list and summary keeps counts == lists by construction |
| Refetch-on-switch, drop stale rows | Browser (list hooks) | — | No query cache; each hook holds its own state (pitfall 15) |
| Foreign-folder refusal | API / Backend (save routes + 3 launch doors) | Browser (renders the sentence) | Definition org comes from the row, never the viewer |
| Elsewhere counts | API / Backend over an RLS connection | Database (RLS on 5 tables + `organizations`) | RLS makes "only orgs you are in, only your rows" structural |
| Cross-org move | API / Backend (asyncpg transaction) | Database (triggers, unique indexes, CHECK) | Child tables have no authenticated UPDATE policy, so a user-JWT move would silently half-apply |
| Move audit | Database (`audit_log` insert in the same transaction) | — | `write_audit_entry` swallows errors; SC#4 requires the row |

## Standard Stack

No new packages. Everything uses what the repo already ships.

### Core (existing, verified in tree)
| Library / module | Purpose | Where verified |
|---|---|---|
| FastAPI `Request` injection, `request: Request = None` default | Routes read the header; direct-call tests may omit it | `folders.py:53`, `workflows.py:1196` precedent [VERIFIED: codebase] |
| `app.dependencies.resolve_active_org_or_none` | Validated active org or `None`, never 400 | `dependencies.py:1020-1070` [VERIFIED: codebase] |
| `app.dependencies.get_user_pg_connection` | asyncpg connection as `authenticated` with JWT GUCs (RLS enforced) | `dependencies.py:159`; used by `library.py` summary [VERIFIED: codebase] |
| `app.dependencies.get_pg_pool` | BYPASSRLS pool (`postgres_dsn`) for transactions | `dependencies.py:~88-104` [VERIFIED: codebase] |
| `app.db.api_keys.is_org_member(pool, org_id=, user_id=)` | Live membership read | `db/api_keys.py:207` [VERIFIED: codebase] |
| `app.services.retention.hold_guard.assert_none_held` / `map_hold_refusal` | Hold refusal (409) + PT409 mapping | `hold_guard.py:175-226`; used by folder delete `folders.py:193-201` [VERIFIED: codebase] |
| `harness.scope.folder_scope_violations(..., restrict_org_ids=)` | The publish 2.6 rule | `scope.py:283-375` [VERIFIED: codebase] |
| zustand (already a dependency) | A tiny dedupe store for elsewhere counts | used by `streamsStore.ts`, `builderStore.ts` [VERIFIED: codebase] |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed by this phase. slopcheck was not run (nothing to check).
**Packages removed:** none. **Packages flagged:** none.

## Edit points — backend (file:line, the one expression)

All line numbers measured 2026-10-28 on `develop` (HEAD `29f570e27`).

### B1. `GET /folders` — `backend/app/api/folders.py:24-33` (FIRING 16/10/288)
Today: `folders = await fetch_visible_folders(supabase, current_user["id"])` (line 30), no `request` param.
Change: add `request: Request = None` (the `create_folder` precedent, line 53) and pass the keyword only
when an org resolved:
```python
folders = await fetch_visible_folders(
    supabase, current_user["id"], **await org_lists.folder_kw(request, current_user)
)
```
`folder_kw` returns `{}` for `None` and `{"restrict_org_ids": {org}}` otherwise. ⚠ Returning `{}`
(not `restrict_org_ids=None`) is required: `fetch_visible_folders` is a documented monkeypatch seam and
`resolve_project_subtree` forwards the kwarg only when set for exactly this reason (`scope.py:126-136`,
"THE SEAM-CONTRACT RULE"). [VERIFIED: codebase]

### B2. `GET /folders/{id}/children` — `folders.py:36-47`
Same one keyword on line 43. Not called by the frontend today (no `/children` client exists) but D-02
names it. [VERIFIED: grep of `frontend/src/lib/api`]

### B3. `GET /documents` — `backend/app/api/documents.py:867-925` (FIRING 99/39/2698)
The `build()` closure reads `public.library_documents`, which exposes `org_id` (mig 208 view, column
`u.org_id`). Add `request: Request = None` and one predicate inside `build()`:
```python
q = org_lists.by_org(q, active_org)   # no-op when active_org is None
```
⚠ **Narrow every read of this route, not only `folder_id == "root"`.** `IngestionTab.usePagedStatusList`
(`components/library/IngestionTab.tsx:381-395`) calls `GET /documents?status=…` with no folder, and its
counts come from `GET /library/summary`'s `status` buckets. If the summary narrows and these lists do not,
the in-flight pill reads 3 while its list shows 5 — the SEED-248 "count disagrees with the list" class. A
specific `folder_id` read is unaffected in practice (the audit measured document org ≠ folder org = 0 on
both DBs). `TakeoffSection.tsx:96` (`kind=spreadsheet`) rides along and becomes active-org scoped, which is
correct for a rate-sheet picker. [VERIFIED: codebase; audit counts from 298-ORG-AUDIT.md]

RLS interaction: the view is `security_invoker`, so RLS on `documents`/`folders` still applies beneath it;
adding `.eq("org_id", org)` can only narrow. PostgREST pushes the filter into the view's `WHERE`; the
`(user_id, is_latest, created_at …)` indexes from mig 208 still drive the scan, and `org_id` becomes a
post-filter on a bounded page. No index change needed at current scale (prod 206 documents). [VERIFIED:
mig 207/208 text] [ASSUMED: plan shape not EXPLAIN-measured]

### B4. `POST /documents/upload` — `documents.py:557-616` (the Root arm, D-07)
The minter call is at lines 609-616 (`async_mint_document_row(..., folder_id=folder_id)`). Add
`request: Request = None` and one keyword:
```python
org_id=await org_lists.root_upload_org(request, current_user, folder_id),
```
`root_upload_org` returns `None` whenever `folder_id` is truthy (the 280-03 foldered arm stays
byte-identical — `mint_document_row` derives the folder's org itself at `ingest_splice.py:206-230`; passing
an `org_id` with a folder would make it compare and 404 a folder in another org), else the active org or
`None`.

⚠ **Behaviour consequence to state in the plan:** passing `org_id` makes dedup and versioning
org-scoped for Root uploads (D-266-18, `ingest_splice.py:263-285`). A two-org user uploading the same bytes
to Root in org B no longer gets org A's copy back as "already in library" — it mints org B's copy. That is
the SEED-313 fix, not a regression; the unique index is `(org_id, user_id, content_hash)` since mig 195.

⚠ **The web client sends no `X-Org-Id` on upload** (`lib/api/documents.ts:164-180` builds
`{ Authorization }` from `getAuthToken()`). Without a frontend change the server always resolves `None`
and D-07 is a no-op. Add the header with `getActiveOrgId()` (from `_core.ts:178`). The same omission exists
at `documents.ts:198/350/413` and `workflows.ts:144/274/379/414`; only the upload one matters to this
phase. [VERIFIED: codebase]

Fences on this route: `test_071_1_threadpool_sweep.py` slices `upload_document`'s body and fails on any
unwrapped sync supabase call (the new line is an `await` on a helper — safe);
`test_280_minter_sequence.py:607` pins exactly one minter call from `api/documents.py` (do not add a second;
keep the call in `documents.py`, not in `org_lists`); `tests/integration/test_285_stuck_pending_live.py:142`
calls `upload_document(...)` with keywords (a defaulted `request` is safe). [VERIFIED: codebase]

### B5. `GET /library/summary` — `backend/app/api/library.py:150-299` (2/2/299, not firing)
`LIBRARY_SUMMARY_SQL` (line 161) reads `FROM public.library_documents WHERE is_latest`. Narrow with one
parameter:
```sql
  FROM public.library_documents
  WHERE is_latest AND ($1::uuid IS NULL OR org_id = $1)
```
and `rows = await conn.fetch(LIBRARY_SUMMARY_SQL, active_org)` (line 287). Fences:
`test_284_summary_shape.py:113-118` asserts `"WHERE is_latest" in sql`, one `GROUPING SETS`, and no
`FROM public.documents` — all still hold. `:121-148` drives `get_library_summary(MagicMock(), {...})` with
a fake connection whose `fetch(self, sql, *args)` accepts args — safe, but the route resolves the org from
`request`; with a `MagicMock()` request, `resolve_active_org_or_none` would read
`request.headers.get("X-Org-Id")` → a MagicMock (truthy) → `_to_uuid(MagicMock)` → `uuid.UUID(str(mock))`
raises `ValueError` → `None` (`dependencies.py:865-875`) → returns `None`, so the fence stays green.
`/library/index-summary` reads the `documents` table (not the view) and is NOT in D-02 — leave it.
[VERIFIED: codebase]

### B6. `GET /workflows/published` — route `backend/app/api/workflows.py:403-500`, SQL `backend/app/db/workflows.py:588-805` (both FIRING)
Recommended: a keyword-only `org_id: UUID | None = None` on `list_published_workflows`, appended after the
project filter exactly like `project_folder_id` (lines 718-721):
```python
if org_id is not None:
    params.append(org_id)
    sql += f" AND (wd.is_system_global = true OR wd.org_id = ${len(params)})"
```
Same clause in both branches (D-02: globals unchanged). Qualify `wd.` — the query joins two LATERALs. The
route passes `org_id=await org_lists.active_org_uuid(request, current_user)` (one keyword). ⚠ Fences that
must stay green: `test_workflows_updated_at.py:296-314` and `test_library_run_facts.py:779-802` assert the
two `WHERE status = 'published' AND …` predicates as substrings (an AND-append keeps them);
`test_library_run_facts.py:1133-1145` runs the SHIPPED SQL against the live DB and compares to
`list_published_workflows(pool, user_id=me)` with NO org — so the default must be byte-identical.
`threads.py:142` imports `list_published_workflows` for the kickoff and passes no org — unchanged.
[VERIFIED: codebase]

⚠ **Shared consumers of the route (default branch, no `scope`):** `useStartWorkflowInThread.ts:68` (chat
picker), `WorkspacePanel.tsx:149` (run-soul lookup by slug), `ConnectionsTab.tsx:1445`. All become
active-org scoped. WorkspacePanel matches the running thread's `definition_slug` against this list; a
thread in org A running the caller's own org-B workflow (possible before this phase) will lose its "soul"
panel content and fall back to the honest empty state the code already has (`setDef(null)`). Record as
an accepted consequence, not a bug. [VERIFIED: codebase]

### B7. `GET /workflows/drafts` — route `workflows.py:1233-1282`, SQL `db/workflows.py:1091-1206`
`list_draft_workflows(pool, *, user_id)` builds one f-string concatenation ending
`f"WHERE status = 'draft' AND created_by = $1 " f"ORDER BY updated_at DESC, id DESC", user_id`
(lines 1196-1203). Add `org_id: UUID | None = None` and two expressions:
```python
+ f"WHERE status = 'draft' AND created_by = $1 "
+ (f"AND wd.org_id = $2 " if org_id is not None else "")
+ f"ORDER BY updated_at DESC, id DESC",
user_id, *([org_id] if org_id is not None else []),
```
The fence substring `"WHERE status = 'draft' AND created_by = $1 "` (`test_workflows_updated_at.py:314`,
`test_library_run_facts.py:802/1221`) survives. ⚠ **`useDraftPersistence.ts:994` resolves a conflict by
calling `listDraftWorkflows()` and finding its own id**; a Builder left open on an org-B draft after
switching to org A would then report `DRAFT_GONE_SENTENCE` ("deleted somewhere else") — a false sentence.
Options: (a) the Builder closes/returns to the library on an org switch, or (b) the reload reads the single
row. Recommend (a) via the D-12 rule ("no stale row action after a switch"), decided in Plan 4.
[VERIFIED: codebase]

### B8. `GET /threads` — `backend/app/api/threads.py:269-287` (FIRING 283/95)
One predicate on the existing chain plus `request: Request = None`:
```python
response = org_lists.by_org(
    supabase.table("threads").select("*").eq("user_id", current_user["id"]).eq("is_eval", False),
    await org_lists.active_org(request, current_user),
).order("updated_at", desc=True).execute()
```
⚠ The route already calls a sync `.execute()` inside an async handler (pre-existing D-v2.5-01 debt);
optionally wrap in `aexec` in the same expression — do not widen the touch further. `ChatLayout.tsx:190-199`
already refetches threads on `activeOrgId` change and its comment already claims "fetches the NEW org's
threads" — that claim was false until this predicate exists. `test_267_handoff.py:471` documents that
`list_threads` returns every org's threads; its WR-03 refusal stays correct (and becomes less reachable).
[VERIFIED: codebase]

### B9. `GET /workflow-runs` — `backend/app/api/workflow_runs.py:658-742` (FIRING 21/15/1445, "extraction FIRST")
One predicate on `runs_query` (line ~728): `runs_query = org_lists.by_org(runs_query, active_org)` and a
`request: Request = None` param. ⛔ **Fence:** `tests/test_seed190_run_log.py:206-215`
(`test_there_is_no_all_users_mode`) asserts the signature params are exactly
`{"slug", "limit", "offset", "current_user", "supabase"}`. Adding `request` reds it. The fence's purpose
is "no parameter widens the scope"; `request` narrows. Amend the expected set deliberately with the reason
in the test body (the `D-206-07` retire-deliberately rule). Note this file lives in `backend/tests/` (not
`tests/unit`), so the baseline gate does not run it — run it explicitly. The ledger records 296-06's
one-touch on this "extraction FIRST" file as an audited override; 298 should record the same.
[VERIFIED: codebase]

### B10. Create actions that stamp the active org (D-12)
Already org-aware and unchanged: `create_folder` (`folders.py:62-67` — a parent in another org than the
active one is a 404), `create_draft` (`workflows.py:1211-1217`), `create_thread` (D-268-07),
`threads._authorize_thread_folder` (`threads.py:1203`, deliberately `set()` on `None` — an authorizer
fails closed; do not copy that polarity into list routes). [VERIFIED: codebase]

## ORG-05 — the refusal (save + four launch doors)

### Doors, measured
| Door | Entry | Calls `preflight_workflow_kickoff`? | Where to add the check | How the refusal surfaces today |
|---|---|---|---|---|
| Attended (Run modal, Library run, chat composer start) | `threads.send_message` → `workflow_kickoff.py:125` | yes (`threads.py:1849`) | after the existing `assert_folder_scopes_subset` block (`workflow_kickoff.py:301-308`) | `postMessage` throws `ApiError(detail)` when `detail` is a string (`lib/api/threads.ts:805-811`); RunModal renders `e.message` verbatim (`RunModal.tsx:277-278`) |
| Chat-started (in-thread picker) | `useStartWorkflowInThread` → `sendMessage` → same route | yes | same | ⚠ `failureFor` maps every 422 to `COPY.shared.startInputsRefused` ("some of its inputs weren't accepted") and never shows server text by design (`useStartWorkflowInThread.ts:20-25`) |
| Scheduled (tick + "Run now") | `scheduler_service.launch_scheduled_run` (`:100-196`) | **NO** | beside `template_refusal` (`:120-130`): `record_schedule_outcome(sentence)` then `raise ScheduledLaunchRefused(sentence)` | the schedule's outcome line (296-02) |
| API key | `inbound.start_workflow_run` (`inbound.py:290-420`) | **NO** | beside `template_refusal` (`:363-368`) via `_refused(..., reason="foreign_folder", exc=HTTPException(422, detail=sentence))` | the JSON `detail` string |

⚠ CONTEXT D-13 says the preflight covers "every door"; the measurement says it covers two. The check must
be called at three sites (preflight, scheduler, inbound) from one helper. [VERIFIED: codebase]

### Definition org
- Preflight: the `_def_resp` select (`workflow_kickoff.py:233-238`) lists
  `"id, definition, status, is_system_global, created_by, skill_snapshots"` — add `org_id` to that string
  (one token) rather than a second read.
- Scheduler: `get_definition` (`db/workflows.py:940-947`) does NOT project `org_id`; `row.get("org_id")`
  at `scheduler_service.py:132` is therefore always `None` today and the code falls back to the
  schedule's org. Read the definition org with a one-line pool read (the `_definition_org_id` SQL,
  `publish_service.py:768-780`) inside the new helper — do not import a private symbol from
  `publish_service` and do not edit it (D-26).
- Inbound: `_SCOPE_SQL` (`inbound.py:185-188`) already pins `org_id = key org OR is_system_global`; the
  helper can take `key.org_id` for a non-global row.
- System-global definitions: skip the check (D-01 — they belong to no user's org).

### The helper (recommended algorithm, one implementation, three callers + save)
1. `bound = {project_folder_id} ∪ ⋃ phase.config.folder_scope` (D-13's set; see Open Question 4 for
   `inputs[].folder_scope` and `output_target_folder`).
2. Save: `candidates = bound(new) − bound(stored)`; create: `bound(new)`; launch: `bound`. Empty → pass.
3. One pool read: `SELECT f.id, f.name, f.org_id FROM folders f WHERE f.id = ANY($1::uuid[])`. A
   candidate whose row exists and whose `org_id ≠ definition_org` is an offender. A missing folder is NOT
   an org offender (keeps today's launch behaviour for a deleted binding; the audit measured 0 missing).
4. If an offender exists, confirm with `folder_scope_violations(definition, supabase=…, user_id=…,
   restrict_org_ids={definition_org})` — the publish 2.6 rule, unchanged — so the save/launch gate can never
   refuse something publish would accept. (Cheap read first, the subtree walk only on a hit.)
5. Words: visible to the caller (unrestricted `fetch_visible_folders` contains the id) → name the folder
   and its org (the caller is a member of that org by construction, so naming it leaks nothing); not
   visible → *"a folder you can't open"*, no org.

### Save: "binding changed"
- `create_draft` (`workflows.py:1185-1231`): definition org = `_active_org` (line 1213). When `_active_org`
  is `None` (header-less non-browser caller), skip the save check — the launch check (which reads the row's
  org) is the backstop. Place it after `assert_phase_models_registered(body)` (line 1210).
- `update_draft` (`workflows.py:1283-1393`): the route already does a lazy owner-scoped
  `get_definition` for the model grandfather (lines 1351-1356). The org check needs the stored
  `definition` AND `org_id`; `get_definition` has no `org_id`, so the helper does its own
  `SELECT org_id, definition FROM workflow_definitions WHERE id=$1 AND created_by=$2`. If no row → fall
  through to the write so the 404 stays byte-identical (T-196-ORACLE). Decode the stored JSON through
  `_coerce_definition` (`workflow_wire.py:43`) — 325 local rows are double-encoded strings (SEED-154).
- Cost: run the read only when `bound(new)` is non-empty (autosaves of unbound drafts cost nothing).
- Fences: `test_286_workflows_seam_pins.py` pins the `/workflows` route table and OpenAPI sub-document.
  `request: Request` is not a query/header/body param, so the table is unchanged; adding a new ROUTE under
  `/workflows` would red both fixtures — put the new routes elsewhere. [VERIFIED: codebase]

### Refusal wire shape (Claude's discretion — recommendation)
D-14 locks a 422 with worded detail. Two consumers cannot distinguish a string 422 from other 422s:
- Builder save: `updateWorkflowDraft`'s 422 arm throws `WorkflowDraftUnreadableError` for ANY 422
  (`lib/api/workflows.ts:536-540`), which `refusalOf` maps to `HOLD_UNREADABLE` — the sentence would be
  swallowed. `createWorkflowDraft` (`:448-451`) throws a generic `Error`.
- Chat in-thread start: every 422 reads "inputs weren't accepted".

Recommend the `stale_token` precedent (`workflows.py` 409 `detail={"code": …, "message": …}`, branched on
`code`, never prose): on the attended preflight and the two save routes return
`detail={"code": "folder_in_other_org", "message": "<sentence>"}`; extend `postMessage`'s message pick to
`detail.message` when `detail` is an object with a string `message` (so RunModal keeps rendering it
verbatim); add a named error class (`WorkflowFolderRefusedError`) in the two draft clients' 422 arms; add a
`kind: "folder"` branch in `useStartWorkflowInThread.failureFor` showing the server message. The scheduler
and inbound doors keep a plain string (their consumers already read strings). [VERIFIED: codebase for the
precedent; the design is ASSUMED pending planner acceptance]

### D-15 pickers
- `WorkflowBuilderPage.tsx:2400-2402` renders `<option value={boundFolderId}>{UNNAMED_KB_OPTION}</option>`
  when the bound id is not in `folderOptions`. One expression: render `labelFor(boundFolderId)` (name +
  "lives in <org>") with `UNNAMED_KB_OPTION` as the fallback.
- `useBuilderNameMaps.ts:81-92` builds `folderNames`/`folderOptions` from `listFolders()`; after narrowing,
  a per-phase `folder_scope` chip naming another org's folder falls back to the raw id. ⛔ Fence
  `WorkflowBuilderPage.canvas.test.tsx:2375-2383` counts `listFolders\(|listSkills\(` across page + hook =
  3 — a second `listFolders(` call reds it. Use a differently named client.
- `DescribeKbPicker.tsx:174-231`: the CR-R5-01 effect calls `onChange("")` when a held id is not offered.
  Replace "not offered → drop" with "not offered → look up a label; drop only when the lookup says the
  caller cannot see it". Fences: `DescribeKbPicker.test.tsx:795` (exactly one import line from
  `@/lib/api` — add the symbol to that line) and `:514/:530/:535`.
- **Recommended new read:** `GET /<new-router>/folder-labels?ids=…` → `[{id, name, org_id, org_name}]`
  for ids in the caller's UNRESTRICTED `fetch_visible_folders` set (today's visibility, so nothing new is
  revealed), omitting the rest. One read serves all three surfaces. [ASSUMED: route shape]

## ORG-06 — elsewhere counts

### Access layer
Use `get_user_pg_connection(request, current_user)` (RLS as the caller), the `library.py` precedent. RLS
already restricts all five tables to `org_id IN current_user_org_ids()` and, for the owner arm, to
`auth.uid()` (policies at `full-schema.sql:8947, 8968, 9024, 9117, 10238`), and `organizations` SELECT is
`id IN current_user_org_ids()` (`:9813`). So "only orgs you are in" holds even if the SQL is wrong. No new
SQL function → no PUBLIC-grant exposure. [VERIFIED: full-schema.sql]

### Query (one round trip; same predicates as the lists so a count equals what Switch will show)
```sql
SELECT o.id AS org_id, o.name AS org_name,
  (SELECT count(*) FROM public.folders f
     WHERE f.org_id = o.id AND f.user_id = auth.uid())                                   AS folders,
  (SELECT count(*) FROM public.documents d
     WHERE d.org_id = o.id AND d.user_id = auth.uid() AND d.folder_id IS NULL
       AND d.is_latest)                                                                   AS root_documents,
  (SELECT count(*) FROM public.workflow_definitions w
     WHERE w.org_id = o.id AND w.created_by = auth.uid() AND NOT w.is_system_global)      AS workflows,
  (SELECT count(*) FROM public.threads t
     WHERE t.org_id = o.id AND t.user_id = auth.uid() AND t.is_eval = false)             AS threads,
  (SELECT count(*) FROM public.workflow_runs r
     WHERE r.org_id = o.id AND r.user_id = auth.uid())                                    AS runs
FROM public.organizations o
JOIN public.org_members m ON m.org_id = o.id AND m.user_id = auth.uid()
WHERE o.id <> $1
ORDER BY o.name, o.id
```
- `workflow_definitions.status` is only `draft | published` (CHECK at `full-schema.sql:4378`), so no status
  filter is needed. `workflow_runs.user_id` is nullable (`:4454`); the run log filters on it too.
- Root documents: match the Library list's default (archived hidden) or the summary's (archived counted)
  — pick one and state it; the summary counts archived in `root.count`. [ASSUMED: which one]
- **Active org `None` → return `[]`.** When no org resolves, every list is unnarrowed, so nothing is
  hidden; an empty answer is the honest one and avoids naming a "current" org that does not exist.
- Route: a NEW router module (not `org.py`, whose routes use the 400-ing `get_active_org_id`, and which has
  no ledger row). Every new router needs: `app.include_router(...)` in `main.py` (FIRING — one line,
  honoured by construction), its tag added to `TAG_GROUPS` in `scripts/build-public-openapi.cjs` (else
  `[ungrouped-tag]`), `python scripts/export-openapi.py` to refresh `docs/public/api/openapi.snapshot.json`
  (`test_276_openapi_snapshot_fresh.py` reds otherwise), then `node scripts/build-public-openapi.cjs`.
  [VERIFIED: scripts + test exist]

## ORG-06 — the move

### Where it runs
An asyncpg transaction on `get_pg_pool()` (`async with pool.acquire() as con: async with con.transaction():`
— `db/workflows.py:540-541` precedent), with app-level checks. ⚠ A user-JWT move would half-apply:
`folders`/`documents`/`threads`/`workflow_definitions` have authenticated UPDATE policies, but
`document_chunks`, `document_images`, `document_tables`, `pdf_extraction_runs`, `ingestion_jobs` are
service-written; a security-invoker UPDATE there silently touches 0 rows (the "runs is SELECT-only:
user-JWT UPDATEs no-op" lesson, memory 268). Re-check every precondition inside the transaction with
`SELECT … FOR UPDATE` on the moved rows (TOCTOU between preview and confirm).

### Folder subtree — rows and dispositions (from FKs in `full-schema.sql:7479-8527`)
| Table / constraint | Relation | Disposition |
|---|---|---|
| `folders` (subtree via `parent_id`) | the item | **move** `org_id`; the moved root's `parent_id := NULL` when its parent is not moving (else child org ≠ parent org — an invariant the audit measured at 0) |
| `documents` (`folder_id` in subtree) | children | **move** |
| `document_chunks`, `document_images`, `document_tables`, `pdf_extraction_runs`, `ingestion_jobs` (`document_id`) | org-stamped children | **move** (chunks carry `org_id`; leaving them would drop the docs from the new org's search) |
| `document_relationships` (source/target) | both ends | **move** when both ends move; **refuse** when one end stays |
| `legal_hold_folders` / `legal_hold_documents` | holds | **refuse** — `hold_guard.assert_none_held(..., folder_ids=subtree)`; DB backstop `folders_hold_identity_guard` / `documents_hold_identity_guard` raise PT409 on an `org_id` change (`full-schema.sql:309-334, 483-495, 6875, 6952`) |
| `connector_watches.library_folder_id`, `connector_watch_items.document_id` | watched | **refuse** (D-19) |
| `retention_policies.folder_id` | org-admin policy | **refuse** |
| `retention_queue.latest_document_id` | pending disposition | **refuse** ("waiting on a retention decision") |
| `expert_installs.folder_id` | org install | **refuse** |
| `classification_rules.suggest_folder_id` | org rule | **refuse** (or leave — decide) |
| `document_views.folder_scope` | saved view | **refuse** (or leave — decide) |
| `threads.folder_id` | chats bound to the folder | **refuse** with a count (moving would break `_authorize_thread_folder` for those chats) — see Open Question 2 |
| `workflow_definitions` binding any subtree folder (`project_folder_id` / phase `folder_scope`, decoded per SEED-154) | workflows | **refuse** — after the move they would be cross-org bindings and ORG-05 would refuse their launches |
| `checked_queries.expected_document_id` | recall checks | **refuse** (or leave — decide) |
| `workspace_files.library_document_id` (SET NULL FK) | thread artifact link | **leave** |
| `is_org_shared` on any subtree folder; any folder/document in the subtree not owned by the caller | D-19 | **refuse** |
| `documents_completed_hash_unique_idx (org_id,user_id,content_hash)` and `documents_dedup_idx (…,folder)` (`full-schema.sql:5566-5573`) | target-org collision | **refuse** ("the same file is already in Acme Legal"); map a `UniqueViolationError` to the same 409 sentence |
| version family (same `user_id`, `filename`, source org) with members outside the subtree | versioning | **refuse** (moving part of a family splits `is_latest` across orgs) |
| any document `pending`/`processing` | in flight | **refuse** |

Storage paths are `{user_id}/{document_id}/{filename}` (no org), so no bytes move.

### Root document
Same machinery for the version family `{user_id, filename, folder_id IS NULL, org_id = source}`; refuse
when a family member sits in a folder, plus every document-level refusal above.

### Workflow definition
| Item | Disposition |
|---|---|
| Rows | the caller's rows sharing the slug (the run log already treats "a workflow" as every version of its slug — `workflow_runs.py` Step 1); see Open Question 3 |
| ⛔ Published rows | `workflow_definitions_block_published_update` raises on ANY `org_id` change (`full-schema.sql:1176-1198`). Migration 217 must replace the function to allow an `org_id`-only change when `current_setting('app.org_move', true) = 'on' AND current_user NOT IN ('anon','authenticated')` (the `workflow_runs_origin_immutable` role-guard precedent, mig 215), set with `SELECT set_config('app.org_move','on', true)` inside the move transaction — or descope published moves with a recorded decision |
| `workflow_schedules.workflow_id` (CASCADE FK, has `org_id`) | **move** with the definition (the scheduler reads `schedule.org_id` for entitlement and the run's thread) and name it in the confirm — or refuse; decide |
| `workflow_runs.definition_id` (RESTRICT) | **leave** (a run lives in its runner's org; the audit shows this is normal) |
| live run (`workflow_runs.status` running/paused) | **refuse** (D-19) |
| API keys listing the workflow (`api_keys.workflows` jsonb, `_SCOPE_SQL` requires the key's org) | **refuse** — after a move the key would silently 404 it |
| bound folders not already in the target org | **refuse** ("its knowledge base Q3 Contracts is in Personal") — otherwise the move manufactures an ORG-05 refusal |
| `is_system_global` | **refuse** |

### Membership + audit
- Both orgs: `is_org_member(pool, org_id=src, user_id=caller)` and `…dst…` inside the transaction; `src` is
  read from the row, `dst` from the body, never trusted.
- Audit: insert the `audit_log` row INSIDE the transaction (`INSERT INTO audit_log (user_id, action_type,
  metadata, org_id) …`) so move and receipt commit together; `write_audit_entry` swallows failures
  (`audit_service.py:72-97`), which would make SC#4 unprovable. Metadata: `kind`, `item_id`, `from_org`,
  `to_org`, counts. Which org's ledger carries it is Open Question 5 (recommend the source org).
- Migration 217 (re-run `ls supabase/migrations`; last is `216_neutral_default_org_name.sql`):
  `ALTER TABLE public.audit_log DROP CONSTRAINT IF EXISTS audit_log_action_type_check;` then `ADD … CHECK
  (action_type = ANY (ARRAY[…every literal…]::text[]))` copying mig 215 lines 173-191 **after reading the
  live CHECK first** (`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname =
  'audit_log_action_type_check'`; mig 215's comment says "every live literal kept (read from the live
  CHECK)"), plus the new literal (e.g. `'org.item.move'`). Add the same literal to `VALID_ACTION_TYPES`
  (`audit_service.py:13-34`). Trigger-function replacement: `REVOKE EXECUTE … FROM PUBLIC/anon/
  authenticated`, `GRANT … TO service_role` (mig 215 lines 162-167); mirror the grant lines in
  `scripts/full-schema-supplement.sql` (the dump is `--no-privileges`). Add a shape test
  (`test_293_migration_215.py` / `test_296_migration_shape.py` precedents).
- ⛔ **Deploy order:** `assert_action_types_synced` runs at boot (`main.py` lifespan) and hard-fails when
  `VALID_ACTION_TYPES` holds a type the live CHECK lacks. A backend carrying the new literal will NOT BOOT
  on a DB without 217 — locally until 217 is pasted, in cloud until the operator pastes it. 217 goes to
  cloud first, then `get_advisors(security)`, then the deploy. [VERIFIED: audit_service.py:37-63]

## Edit points — frontend

### F0. The active-org key
- `OrgProvider.tsx:90` holds `activeOrgId`; `useOrgOptional()` (`:215`) is the non-throwing reader that
  lets pages render without a provider in tests. New `frontend/src/hooks/useActiveOrgId.ts`:
  `return useOrgOptional()?.activeOrgId ?? null`.
- **Request guard (D-09, Claude's discretion):** tag each answer with the org the request was SENT under
  — `getActiveOrgId()` from `lib/api/_core.ts:178` read at request time (the header value) — and derive
  rows as `state.org === activeOrgId ? state.rows : []` (loading while mismatched). This drops a late
  old-org answer and needs no keyed remount.
- ⚠ **Header-sync race:** `switchOrg` (`OrgProvider.tsx:173-180`) sets the header synchronously before the
  state flip, but the WR-01 self-heal (`:126-130`) calls `setActiveOrgIdState(resolvedOrgId)` WITHOUT
  `syncActiveOrgHeader`; the header follows in OrgProvider's own effect (`:99-105`), which React runs AFTER
  child effects. So on a fresh device a child list effect keyed on the new org fires header-less, gets the
  UNNARROWED answer, tags it `null`, discards it — and nothing refetches. Add
  `syncActiveOrgHeader(resolvedOrgId)` before the state set in the self-heal (one line, mirrors
  D-166-08). OrgProvider has no ledger row (3/2/217) — add one.
- First paint on a fresh device (no persisted org) is header-less → unnarrowed → all orgs' rows until the
  self-heal answer. Same as today; rare (multi-org users only). State as accepted.

### F1. `useFolders` — `frontend/src/hooks/useFolders.ts` (3 commits / 3 phases / 115 L — FIRES, NO ledger row)
- `folders` starts `[]` with no loading flag (`:21`); LibraryPage cannot tell "none" from "loading". Add an
  org-tagged state + `loading`.
- `loadFolders` (`:24-27`) has no stale guard; add the tag.
- Realtime (`:43-67`): read the active org through a ref; INSERT with `payload.new.org_id ≠ active` →
  ignore; UPDATE with a foreign `org_id` → REMOVE the row (this is how a moved folder leaves the list in
  another tab); DELETE unchanged (`payload.old` carries only the id under default replica identity).
  `FolderResponse` (`models/folder.py:21-31`) has no `org_id`, but the Realtime payload is the raw row, so
  `org_id` is present there. [ASSUMED: folders replica identity is default — check before relying on UPDATE `old`]
- Consumers that narrow with it (intended): `ChatLayout` (chat folder picker), `LibraryPage`,
  `AppViewSwitch`, `LegalHoldDialog`, `RetentionPolicyEditor`, `CreateWatchModal`, `WatchedFoldersSection`.

### F2. `useLibraryDocuments` — `frontend/src/hooks/useLibraryDocuments.ts:228-291` (3/1/390, young)
- Page: fold the org into the source identity — `sourceKey = JSON.stringify({ source, org: activeOrgId })`
  — so a switch is a COLD source switch: `onScreen` becomes false, rows clear, `listState` is `cold`, the
  existing `reqIdRef` drops the old answer. The hook's own rule 3 already says a source switch is cold.
- Summary (`:276-291`): add `activeOrgId` to the effect and hold `{org, summary}`; derive `summary = null`
  while mismatched so `NavRow` omits counts (never 0 — rule 2).
- Upload header: see B4.

### F3. `LibraryPage.tsx` (FIRING 63/20/1344; ledger: "page-UI state … still lives in the page", seam owed)
Touches needed: the two `[]` effects (`:396-400` metadata fields + views; `:499-511` `listExpertInstalls`,
SEED-317), a selection reset on switch (a folder id from the old org would make `useLibraryDocuments` read
`GET /documents?folder_id=<old-org folder>` — a specific-folder read is NOT narrowed, so the old org's
documents would render), `selectedDocId`/`listTarget` reset, and the count-line mount. Recommend ONE new
hook (`useLibraryOrgSwitch` or similar) that owns the moved effects (move-only) and dispatches
`{ type: "SELECT_FOLDER", folderId: null }` (an existing action, `librarySelection.ts:163`) on an org
change; the page gains one hook call replacing two effects plus one JSX mount — a net reduction, honoured
by construction. Fences: `LibraryPage.cloudImport.test.tsx:404` (`.folder_id` reads = 0), `:412`
(`const canUploadToFolder =` once), `LibraryPage.tabAttention.test.tsx:447` (`setLibraryTab(` = 2).
[VERIFIED: codebase]

### F4. Threads — `useThreads.ts` (FIRES 5/3/65), `ChatLayout.tsx` (FIRING 68/34), `ChatHistoryColumn.tsx` (7/2/513)
- `ChatLayout.tsx:190-199` already refetches on `activeOrgId` and clears the selection; no change there.
- `useThreads.loadThreads` (`:29-37`) keeps old rows until the answer → add the org tag inside the hook
  (`threads` derived to `[]` and `loading` true while mismatched). `newThread`/`patchThread` write through
  the same tagged setter. ⛔ `selectThread` stays a bare `setSelectedThread(thread)` —
  `ChatHistoryColumn.clickPath.test.tsx:107-113` pins it.
- `ChatHistoryColumn.tsx:459-462` renders "No recent chats" whenever `filtered.length === 0`; it receives no
  loading prop, and `ChatLayout` destructures `loading: _loading` (`:136`) and drops it. D-11 needs ONE prop
  in ChatLayout (`loading={…}` on the `<ChatHistoryColumn>` at `:623`) and a loading line in the column.
  ⚠ Choose deliberately what drives it: `useThreads.loading` is `false` on the very first render
  (`useState(false)`), so passing it shows "No recent chats" on first paint exactly as today (BUG-261027-02
  untouched, D-11) while a switch shows the loading line.
- Mid-send thread (D-11): StreamsProvider's switch effect (`StreamsProvider.tsx:4483-4532`) keeps
  `sendingThreadsRef` threads in `streamingThreads`; the list simply omits them. No change.

### F5. `WorkflowsPage.tsx` (FIRING 49/21/1496)
Feeds: `refetchPublished` (`:413-443`, deps `[selectedProjectId, markSource]`), `refetchStarters`
(`:448-460`), `refetchDrafts` (`:462-479`), driven by one effect (`:497-504`) with a first-load
`allSettled` + later published-only re-query. On a switch: published + drafts must drop rows, go `pending`
(the page already derives `loading`/`updating` from `sourceState`, `:652-659`), bump their seq refs, and
`selectedProjectId` (`:329`) must reset (its folders come from ChatLayout's `useFolders`, which narrows).
That is not one expression. Recommend extracting the three feeds + `sourceState` + seq refs into a hook
(move-only) that takes `activeOrgId`; the page gains one call. Fences: `WorkflowsPage.test.tsx` pins
`Promise.allSettled` as source and the chip counts; `WorkflowsPage.leaveGuard.test.tsx` pins exactly one
`useLeaveGuard(`, three `approveNextLeave()`, one `clearLeaveApproval()` — an extraction must not move
those. [VERIFIED: codebase + ledger 297-03/WR-02]

### F6. `RunLogPanel.tsx` (1/0/317, NO ledger row)
`load` (`:102-133`) clears rows only on failure; add `activeOrgId` to its deps and clear rows on an org
change so the loading state shows (the generation counter already drops late answers).

### F7. Count line + move control (new UI, G-2)
- Data: a tiny module store (zustand, already used) `useElsewhereCounts()` keyed by `activeOrgId` with
  in-flight dedupe, so four mounts cost one request (D-16 "one round trip"); invalidated after a move.
- Mounts: Library sidebar (folders + Root), Workflows library header (workflows), `ChatHistoryColumn`
  (threads), `RunLogPanel` (runs). Absent while loading and at zero (D-17).
- Move control: `FolderNode.tsx:185-229` already has a `⋯` `DropdownMenu` (Rename / Share / Delete) —
  add a leaf `MoveToOrgMenuItem` shown for `isOwner` when the caller has 2+ orgs; workflows: the
  `WorkflowCardMenu.tsx` (young, 286-04) `⋯` menu; Root document: `DocumentRow.tsx` has icon buttons, no
  menu — the detail panel is the better home. Confirm = the victim-naming sheet (sketch rule: a
  target-specific consequential action names what it affects; see
  `references/control-room-shell-and-receipts.md` "graded action-guards by SHAPE"), worded from a
  preview read ("This folder, 2 subfolders and 14 documents move to Acme Legal"). Org switcher renders
  only at 2+ orgs (`references/org-admin-and-identity.md` D2) — hide the move item for solo users.
- After a move: the folders Realtime UPDATE removes it (F1), plus an explicit refresh of the affected list
  and the counts store. ⚠ Do NOT add `org_id` to `useDocuments.MEMBERSHIP_FIELDS` (`useDocuments.ts:30`):
  list rows come from `LIST_SELECT`, which has no `org_id`, so `changesMembership` would read every
  UPDATE as a membership change and refetch on every ingest tick.

## Architecture Patterns

### System flow
```
Browser list hook ──(X-Org-Id = getActiveOrgId())──► list route
   ▲   tag answer with sent org                         │ resolve_active_org_or_none (membership, RLS conn)
   │   drop if tag ≠ activeOrgId                        ├─ None → today's query, unchanged
   │                                                    └─ org → folder_kw / by_org / org_id kwarg
   │                                                          │
   └────────────── rows (active org only) ◄───────────────────┘

Save/launch ──► foreign_binding_refusal(definition, definition_org=row.org_id)
                 ├─ pool read of bound folder orgs → offender?
                 ├─ confirm with folder_scope_violations(restrict={def_org})   (publish 2.6 rule)
                 └─ 422 worded (name+org if visible, else "a folder you can't open")
   doors: preflight (attended + chat) · scheduler (+outcome) · inbound (API key)

Elsewhere line ──► GET counts (RLS conn) ──► [{org, name, folders, root_documents, workflows, threads, runs}]
Move ──► preview (counts + first refusal) ──► confirm ──► POST move
          └─ pool txn: lock rows → re-check refusals → both-org membership → UPDATE org_id … → INSERT audit_log
```

### Recommended new files
```
backend/app/services/org_lists.py      # active_org(), folder_kw(), by_org(), root_upload_org(), foreign_binding_refusal()
backend/app/services/org_move.py       # preview + execute (pool transaction), refusal sentences
backend/app/api/org_moves.py           # new router: GET elsewhere counts, GET folder-labels, GET preview, POST move
supabase/migrations/217_org_move.sql   # audit CHECK + published-trigger amendment (+ grants)
frontend/src/hooks/useActiveOrgId.ts
frontend/src/lib/elsewhereCounts.ts    # store + useElsewhereCounts()
frontend/src/components/org/ElsewhereLine.tsx, MoveToOrgDialog.tsx (names are discretion)
```
Every new `backend/app` / `frontend/src` file needs a scan-list row (the ledger gate treats new files as
unledgered). Measured: `check-hot-file-ledger.cjs` reports `[no-row]` for `org_lists.py`,
`useActiveOrgId.ts`, `useFolders.ts`, `RunLogPanel.tsx`, `DescribeKbPicker.tsx`, `OrgProvider.tsx`,
`api/org.py`. [VERIFIED: gate run 2026-10-28]

### Anti-patterns
- **Post-filtering `fetch_visible_folders` output in a route.** The ledger's binding invariant: "a second
  predicate one layer up (a post-filter) is how the SEED-124 leak re-opens". Pass the keyword.
- **`restrict_org_ids=None` forwarded explicitly**, or `set()` for "no org". Forward nothing.
- **Keyed remounts** to reset state (297 rule).
- **A new route under `/workflows` or in a `LIBRARY_MODULES` module** (`test_284_route_inventory.py:42-53`
  requires every Library-module route to be paged or allow-listed; `test_286_workflows_seam_pins.py` pins
  the `/workflows` table and OpenAPI).
- **`write_audit_entry` as a background task for the move** — it swallows; the receipt must commit with
  the move.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Folder visibility per org | a filter over folder rows | `fetch_visible_folders(..., restrict_org_ids={org})` | one home of the subtree/shared rule |
| Header validation | reading `X-Org-Id` directly | `resolve_active_org_or_none` | membership check is mandatory (its docstring) |
| "Is this binding in the definition's org" | a new subtree walk | `folder_scope_violations(restrict_org_ids=…)` | parity with publish 2.6 |
| Legal-hold refusal | a holds query | `hold_guard.assert_none_held` + `map_hold_refusal` | worded 409 + receipts + PT409 mapping |
| Membership | client-sent org list | `is_org_member` (pool) / RLS `current_user_org_ids()` | never trust the client |
| Run-as-user SQL | manual `SET ROLE` | `get_user_pg_connection` | shared GUC sequence with the RLS harness |

## Runtime State Inventory

The move is a data-migration-shaped write, so the inventory applies to it.

| Category | Items found | Action |
|---|---|---|
| Stored data | Rows moved per the tables above; `audit_log` gains one row per move; no bulk change (D-18) | code (move service) |
| Live service config | Supabase Realtime: `folders` and `documents` are in the publication (hooks subscribe); a moved row arrives as UPDATE in other tabs | client filter (F1); no config change |
| OS-registered state | None — verified: no scheduled task or worker keys on org; the scheduler reads `schedule.org_id` per tick | none, unless schedules move (Open Question) |
| Secrets / env vars | None — no env var added or read | none |
| Build artifacts | `docs/public/api/openapi.snapshot.json` + public spec (new routes); `supabase/full-schema.sql` (regenerate after 217, no `--reset`); `scripts/full-schema-supplement.sql` (grant mirror) | regenerate in the same commit |

## Common Pitfalls

### Pitfall 1: The upload door ignores the active org
**What goes wrong:** Root uploads keep landing in the trigger's `LIMIT 1` org and vanish from the narrowed Root list.
**Why:** `uploadDocument` sends no `X-Org-Id` (`documents.ts:164-171`).
**Avoid:** add the header in the same plan as B4; drive it live with the two-org fixture.
**Warning sign:** a fresh Root upload shows in the other org's Root.

### Pitfall 2: Two launch doors bypass the preflight
**What goes wrong:** a scheduled or API-key run of a cross-org-bound workflow still starts.
**Avoid:** call the one helper from `scheduler_service` and `inbound` beside `template_refusal`.
**Warning sign:** a test of the refusal that only drives `send_message`.

### Pitfall 3: Published definitions cannot be re-stamped
**What goes wrong:** the move raises `check_violation` (Postgres 23514) on the first published row.
**Avoid:** migration 217 trigger amendment with a role + GUC guard, or descope published with a decision.
**Warning sign:** a move test that only uses drafts.

### Pitfall 4: Summary and lists disagree
**What goes wrong:** IngestionTab's in-flight count reads one number and its list another.
**Avoid:** one predicate on `GET /documents` (every non-folder read) and on `LIBRARY_SUMMARY_SQL`.

### Pitfall 5: The audit boot guard blocks the deploy
**What goes wrong:** backend with the new action type fails to boot against a DB without 217.
**Avoid:** paste 217 locally before running the backend; cloud paste before deploy (operator, approval-gated).

### Pitfall 6: Stale answers repaint, or tagged answers are dropped forever
**What goes wrong:** (a) a slow old-org response paints after a switch; (b) the self-heal path sends a header-less request, the tag mismatches, the answer is dropped, and the list stays empty.
**Avoid:** tag by the header value at send time; sync the header in the self-heal path (F0).

### Pitfall 7: Consumers of the narrowed lists that look things up by id
`useDraftPersistence.reload` (draft by id in the drafts list → false "deleted"), `WorkspacePanel` soul
lookup by slug, `useBuilderNameMaps` folder names, `DescribeKbPicker` held id. Each degrades silently
after narrowing unless handled (B6, B7, D-15).

### Pitfall 8: The move half-applies or manufactures new refusals
Child tables without authenticated UPDATE policies; a folder that workflows bind; a document family that
spans folders; a target-org hash collision. Each is a refusal row in the table above; drive at least the
hash-collision and bound-workflow refusals RED first.

### Pitfall 9: Fences that pin the touched code
`test_there_is_no_all_users_mode` (run-log signature), the `list_*_workflows` predicate substrings and the
live shipped-SQL characterization, `test_284_summary_shape`, the `listFolders(` count, the
`DescribeKbPicker` single-import fence, `selectThread` bare setState, WorkflowsPage leave-guard counts,
`test_286_workflows_seam_pins`, `test_284_route_inventory`, `test_276_openapi_snapshot_fresh`,
`test_280_minter_sequence`. Amend a fence only deliberately, with the reason in the test.

## Code Examples

### Polarity-safe helpers (new module)
```python
# backend/app/services/org_lists.py — pattern; names are discretion
from app.dependencies import resolve_active_org_or_none

async def active_org(request, current_user) -> str | None:
    return await resolve_active_org_or_none(request, current_user)   # never 400s

async def folder_kw(request, current_user) -> dict:
    org = await active_org(request, current_user)
    return {"restrict_org_ids": {org}} if org else {}                 # ⛔ never set(), never None

def by_org(query, org: str | None):
    return query.eq("org_id", org) if org else query                  # None = today's query

async def root_upload_org(request, current_user, folder_id) -> str | None:
    if folder_id:                                                     # foldered arm: the minter decides (280-03)
        return None
    return await active_org(request, current_user)
```

### Org-tagged list state (frontend pattern)
```ts
// inside a list hook — pattern only
const activeOrgId = useActiveOrgId()
const [state, setState] = useState<{ org: string | null; rows: Row[] } | null>(null)
const load = useCallback(async () => {
  const sentUnder = getActiveOrgId()          // the header value this request carries
  const rows = await listX()
  setState({ org: sentUnder, rows })
}, [])
useEffect(() => { void load() }, [load, activeOrgId])
const rows = state && state.org === activeOrgId ? state.rows : NO_ROWS
const loading = !state || state.org !== activeOrgId
```

### Migration 217 trigger amendment (shape)
```sql
CREATE OR REPLACE FUNCTION public.workflow_definitions_block_published_update() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'published' AND (
        NEW.slug IS DISTINCT FROM OLD.slug OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.name IS DISTINCT FROM OLD.name OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.status IS DISTINCT FROM OLD.status OR NEW.definition IS DISTINCT FROM OLD.definition
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.is_system_global IS DISTINCT FROM OLD.is_system_global
     OR (NEW.org_id IS DISTINCT FROM OLD.org_id
         AND NOT (current_setting('app.org_move', true) = 'on'
                  AND current_user NOT IN ('anon', 'authenticated')))
  ) THEN
    RAISE EXCEPTION 'workflow_definitions row % is published and immutable; create a new version instead',
      OLD.id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END; $$;
```
(Every other column stays frozen; only the guarded `org_id` arm changes.) [ASSUMED: the planner accepts amending this guard]

## State of the Art

| Old | Current | When | Impact |
|---|---|---|---|
| `fetch_visible_folders` `restrict_org_ids` narrowed shared folders only | narrows owned folders too (non-empty set) | 295-10 | folder routes need only the keyword |
| Library lists computed in Python | `library_documents` view + `GROUPING SETS` summary | 284 (mig 207/208) | one predicate narrows list and counts |
| `get_definition` used for org | does not project `org_id` | measured today | read the org explicitly |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A2 | The `{code, message}` 422 shape (stale_token precedent) is acceptable for D-14 | ORG-05 wire shape | rework of three clients |
| A3 | Amending `workflow_definitions_block_published_update` is acceptable (vs descoping published moves) | Move | D-19 published moves impossible without it |
| A4 | Folders Realtime uses default replica identity (DELETE `old` has id only) | F1 | Realtime filter logic |
| A5 | No EXPLAIN-measured regression from `org_id` post-filter on `library_documents` | B3 | slow list at scale |
| A6 | Moving schedules with a workflow (vs refusing) is the desired behaviour | Move | wrong-org scheduled runs |
| A7 | A `folder-labels` read route is the right home for D-15 names | D-15 | alternative design |

## Open Questions (RESOLVED)

All six were resolved in `298-CONTEXT.md` (post-research amendments, 2026-10-28). Where CONTEXT
differs from the recommendation below, CONTEXT wins.

1. **Published definitions in the move.** What we know: the immutability trigger blocks any `org_id`
   change. Unclear: whether the operator accepts amending that guard. Recommendation: amend in 217 with the
   role + GUC guard; the planner records it as a decision (it is a security-bearing DDL change).
   **RESOLVED: D-31** — published workflows are NOT movable in v1; the trigger is left untouched; 217 only extends the audit CHECK.
2. **Threads bound to a moved folder.** Refusing keeps the move bounded but may make most folders
   unmovable for an active chat user. Recommendation: refuse with a count ("2 chats in Personal use this
   folder") in v1; seed the alternative.
   **RESOLVED: D-33** — refused, worded.
3. **"A workflow" = one row or the slug family.** Recommendation: the caller's rows sharing the slug, all
   or none (the run log and library cards already treat the slug as the workflow).
   **RESOLVED: D-31** — drafts only, one row.
4. **`inputs[].folder_scope` (kb_auto) and `output_target_folder`.** D-13 names only `project_folder_id`
   and per-phase `folder_scope`; `folder_scope_violations` checks only those. Recommendation: keep D-13's
   set for the refusal; flag kb_auto inputs as a seed.
   **RESOLVED: D-34** — the refusal set includes kb_auto `inputs[].folder_scope` and `output_target_folder`.
5. **Which org's audit ledger carries the move row.** One row per D-20. Recommendation: the source org
   (the org losing the item), metadata naming both.
   **RESOLVED: D-35** — source org, inside the move transaction.
6. **Root documents count: archived in or out.** Recommendation: match the Library Root list default the
   person will see after Switch (archived hidden).
   **RESOLVED: D-36** — archived excluded.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Local Postgres :54322 | live two-org tests, migration paste, audit boot guard | ✓ (TCP open) | — | — |
| Local Supabase API :54321 | PostgREST-backed integration tests (`require_gotrue`) | ✓ (TCP open) | — | — |
| Python venv | backend tests | ✓ | 3.12.6 | — |
| Node | vitest / gates | ✓ | 24.19.0 | — |
| Supabase MCP (cloud) | read `get_advisors(security)` after the operator's paste | reads free; writes approval-gated | — | operator pastes 217 by hand |

## Validation Architecture

(`workflow.nyquist_validation` is `false` in `.planning/config.json`; included because the orchestrator
asked for it. `tdd_mode` is on: RED drives are mandatory.)

### Test framework
| Property | Value |
|---|---|
| Backend | pytest in `backend/venv`; unit suite + skip-guarded integration (`tests/integration`, `requires_pg`) |
| Frontend | vitest via the count gate; `npx tsc -p tsconfig.app.json --noEmit` (set diff vs base — `npx tsc --noEmit` checks 0 files) |
| Quick backend | `cd backend && venv/Scripts/python -m pytest tests/unit/<file> -q` |
| Backend baseline gate | `node scripts/check-backend-unit-baseline.cjs` (ceiling 71 failed, 0 headroom) |
| Frontend gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root; no per-file decrease, 0 failing) |
| Ledger / docs gates | `node scripts/check-hot-file-ledger.cjs 298`, `node scripts/check-claude-md-size.cjs`, `node scripts/build-public-openapi.cjs --check`, `node scripts/check-seeds-register.cjs` (new seed) |

### Requirement → test map
| Req | Behaviour | Type | Command / file | Exists? |
|---|---|---|---|---|
| ORG-01 | two-org user: `GET /folders` with header B lists only B (owned + shared); no header = today's set; a non-member header = today's set | unit + live | new `tests/unit/test_298_list_narrowing.py`; live `tests/integration/test_298_two_org_lists_live.py` (fixture: `test_296_two_org_create.py`) | ❌ Wave 0 |
| ORG-01 | Root upload with header B mints in B; foldered upload unchanged | live | extend pattern of `test_280_cr01_two_org_live.py` / `test_285_stuck_pending_live.py` | ❌ |
| ORG-01 | summary and list totals agree under narrowing | unit | extend `test_284_summary_shape.py` (one new case) | ✅ extend |
| ORG-02 | published (owner arm + globals) and drafts narrow; default byte-identical | unit + live | `test_workflows_updated_at.py`, `test_library_run_facts.py` stay green + new keyword cases | ✅ + new |
| ORG-03/04 | threads / runs narrow; header-less unchanged | unit | `test_298_list_narrowing.py`; `tests/test_seed190_run_log.py` (amended fence) | ❌ / amend |
| ORG-05 | save refuses a changed foreign binding; unchanged binding saves; create with no header skips | unit | new `test_298_foreign_binding.py` | ❌ |
| ORG-05 | launch refused at preflight, scheduler (outcome recorded), inbound (422) | unit | same file; patterns from `test_296_kickoff_and_keys.py`, `test_296_schedule_trigger_words.py` | ❌ |
| ORG-05 / D-25 | matrix: two-org user × {chat retrieval, scheduled run, API-key run, publish, attended launch} same folder set before/after; empty-set case never widens; header-less never 400 | unit (+ one live row) | new `test_298_org_matrix.py`; publish row reuses `test_182_publish_org_scope.py` shapes; `test_165_folder_utils_org_scope.py` pins polarity | ❌ |
| ORG-06 | counts per other org, own rows only, none when no active org; anon → 401 and RLS returns nothing as `anon` | unit + live | new `test_298_elsewhere_counts.py`; anon pattern `tests/integration/test_275_policy_rls.py:129-139`, 401 pattern `test_276_api_docs_gate.py:90-97` | ❌ |
| ORG-06 | move: membership both orgs, every refusal row worded, hash collision 409, one audit row in the same txn, published row moves only via the guarded trigger | live | new `tests/integration/test_298_org_move_live.py`; migration shape `test_298_migration_217_shape.py`; drift `tests/integration/test_110_audit_drift_guard.py` | ❌ |
| UI | switch drops rows, loading not "0"/"No …", late answer discarded; Realtime foreign row ignored/removed; count line absent at 0/loading | vitest | `src/__tests__/hooks/useFolders.test.ts`, `useLibraryDocuments.test.ts`, `RunLogPanel.test.tsx`, `ChatHistoryColumn.*`, `WorkflowsPage.test.tsx`, `OrgProvider.test.tsx` (self-heal header sync) | ✅ extend |
| UI | builder/describe pickers show out-of-org binding by name + marker; save refusal sentence shown | vitest | `WorkflowBuilderPage.canvas.test.tsx`, `DescribeKbPicker.test.tsx`, `useDraftPersistence.test.tsx` | ✅ extend |

### Sampling rate
- Per task: the targeted files above + every fence named in Pitfall 9 for the files that task touches.
- Per wave: backend baseline gate + vitest count gate (once per wave, G-8).
- Phase gate: both full gates, `check-hot-file-ledger 298`, `build-public-openapi --check`, live integration
  files run with `-rs` (a skip is a skip, never a pass), then G-4 (D-24).

### Wave 0 gaps
- [ ] `backend/tests/unit/test_298_list_narrowing.py`, `test_298_foreign_binding.py`, `test_298_org_matrix.py`, `test_298_elsewhere_counts.py`, `test_298_migration_217_shape.py`
- [ ] `backend/tests/integration/test_298_two_org_lists_live.py`, `test_298_org_move_live.py`
- [ ] Frontend: org-switch cases in the existing hook/page suites; a fake OrgProvider value in the test utils where pages render without the provider (they use `useOrgOptional`).

### Fences per touched file (avoid surprise reds)
| File | Fence |
|---|---|
| `api/workflow_runs.py` | `tests/test_seed190_run_log.py::test_there_is_no_all_users_mode` (amend deliberately) |
| `db/workflows.py` | predicate substrings + live shipped-SQL comparison (`test_workflows_updated_at.py`, `test_library_run_facts.py`) |
| `api/workflows.py` | `test_286_workflows_seam_pins.py` (route table, OpenAPI, AST of moved symbols) |
| `api/library.py` | `test_284_summary_shape.py` |
| `api/documents.py` | `test_071_1_threadpool_sweep.py`, `test_280_minter_sequence.py`, `test_284_route_inventory.py` |
| any new route | `test_276_openapi_snapshot_fresh.py`, `build-public-openapi --check` |
| `useThreads.ts` | `ChatHistoryColumn.clickPath.test.tsx` (`selectThread` bare setState) |
| `useBuilderNameMaps.ts` / `WorkflowBuilderPage.tsx` | `WorkflowBuilderPage.canvas.test.tsx:2375-2383` (`listFolders(`/`listSkills(` = 3) |
| `DescribeKbPicker.tsx` | `DescribeKbPicker.test.tsx:514/530/535/795` |
| `WorkflowsPage.tsx` | `WorkflowsPage.test.tsx` (allSettled as source), `WorkflowsPage.leaveGuard.test.tsx` (exact counts) |
| `LibraryPage.tsx` | `LibraryPage.cloudImport.test.tsx:404/412`, `LibraryPage.tabAttention.test.tsx:447` |

## G-5 per FIRING file

| File (triple from the scan list) | Touch | Verdict |
|---|---|---|
| `api/folders.py` 16/10/288 | `request` param + one `**folder_kw(...)` ×2 routes | honoured by construction |
| `api/threads.py` 283/95/2745 | `request` param + one `by_org(...)` wrap | honoured by construction |
| `api/workflow_runs.py` 21/15/1445 ("extraction FIRST") | `request` param + one `by_org` | audited one-touch override (296-06 precedent) + fence amendment |
| `api/workflows.py` 50/26/1699 ("split OWED") | one keyword on `/published` and `/drafts`; one helper call in create + update | honoured; no new route here |
| `db/workflows.py` 63/31/2862 | one keyword-only param + AND-append on two feeds | honoured (project_folder_id precedent) |
| `api/documents.py` 99/39/2698 | `request` param + `by_org` in `build()` + one `org_id=` keyword on the minter call | honoured |
| `services/workflow_kickoff.py` 13/10/602 | `org_id` in one select string + one helper call | honoured |
| `services/scheduler_service.py` 12/7/314 | one helper call beside `template_refusal` | honoured |
| `main.py` 95/69/991 | one `include_router` | honoured |
| `useThreads.ts` 5/3/65 | org-tagged state inside the hook | honoured if `selectThread` untouched |
| `useDocuments.ts` 10/5/164 | none recommended (see F7) | not touched |
| `LibraryPage.tsx` 63/20/1344 (seam owed) | one hook call replacing two effects + one mount | take the org-switch extraction (move-only) |
| `WorkflowsPage.tsx` 49/21/1496 | feeds into a hook | take the feed extraction (move-only) first, then one call |
| `WorkflowBuilderPage.tsx` 65/27/2940 | one option label expression | honoured |
| `ChatLayout.tsx` 68/34/902 | one `loading` prop | honoured |
| `FolderNode.tsx` 15/8/316 | one menu item mount | honoured |
| `useFolders.ts` 3/3/115 (FIRES, no row) | org guard + Realtime filter | add row; honoured |
| `scripts/build-public-openapi.cjs` 7/3/468 | one tag in `TAG_GROUPS` | honoured |
| `scripts/full-schema-supplement.sql` 25/17/863 | grant mirror lines for 217 | honoured |

## Security Domain

### Applicable ASVS categories
| Category | Applies | Control |
|---|---|---|
| V2 Authentication | yes | every new route behind `get_current_user`; 401 test without a bearer |
| V4 Access Control | yes | `resolve_active_org_or_none` (membership), RLS connection for counts, `is_org_member` ×2 for the move, owner checks on every moved row |
| V5 Input Validation | yes | UUID-validate ids and `to` org before SQL (`_uuid_or_422` precedent, `documents.py:819`); Pydantic bodies |
| V7 Error handling | yes | worded 409/422, never a 500; no existence oracle (missing vs not-yours read the same) |
| V8 Data protection | yes | folder labels and refusal sentences name only orgs the caller is a member of |
| V6 Cryptography | no | — |

### Threats
| Pattern | STRIDE | Mitigation |
|---|---|---|
| Forged `X-Org-Id` to list another org | Spoofing / Info disclosure | membership re-validated; non-member header → `None` → caller's own rows only (today's set) |
| Empty set widening scope | Elevation | `folder_kw` returns `{}`, never `set()`; matrix empty-set test |
| Move into an org the caller is not in | Elevation / Tampering | `is_org_member(dst)` inside the txn; RLS not relied on (pool) |
| Moving someone else's rows inside a shared subtree | Tampering | refuse shared folders and any non-owned subtree row |
| TOCTOU between preview and move | Tampering | `FOR UPDATE` locks + re-check inside the txn |
| Published-row guard bypass via the GUC | Elevation | GUC honoured only when `current_user NOT IN ('anon','authenticated')`; authenticated UPDATE also blocked by RLS org check |
| New SQL function exposed to anon | Elevation | revoke PUBLIC/anon/authenticated on the replaced trigger function; `get_advisors(security)` after the paste |
| Missing audit receipt | Repudiation | audit insert inside the move transaction |
| Refusal leaking a folder's org | Info disclosure | name only when the caller can see the folder; else "a folder you can't open" |

## Project Constraints (from CLAUDE.md)

- Backend in `venv`; baseline `pytest tests/unit -q --continue-on-collection-errors` ceiling **71 failed**, zero headroom.
- No LangChain/LangGraph; Pydantic for structured outputs (not relevant here beyond request/response models).
- All tables keep RLS; new migration numbered `217_<name>.sql` under `supabase/migrations/`; paste into the local SQL editor (never `db push`/`db reset`); then `bash scripts/regenerate-full-schema.sh` without `--reset`.
- Blocking supabase-py calls inside async handlers go through `run_in_threadpool` / `aexec` (D-v2.5-01).
- Realtime is a hint; reconcile by fetch (D-v2.5-03).
- Settings live in the UI/DB; env vars only for secrets/infra (none added).
- Supabase MCP: reads free; every cloud write (the 217 paste) needs explicit per-action operator approval; run `get_advisors(security)` after.
- Postgres functions default to `EXECUTE` for `PUBLIC`: revoke from PUBLIC, then grant back.
- G-5: one expression per FIRING file or take the seam; ledger rows + sections in the same commit; CLAUDE.md FIRING cells ≤ 80 chars, scan-list cells ≤ 200; `check-hot-file-ledger.cjs` must pass.
- G-8: 3-5 plans; executors run targeted suites per task, full gates once per wave; never cut verifier, TDD RED, security review, migration discipline.
- Worktrees: bootstrap first; `GSD_VITEST_MAX_WORKERS=2`; never `rm -rf` a worktree; serialize plans that mutate the local DB.
- Deploy is operator-triggered; migration 217 to cloud BEFORE the backend (the boot guard).
- A new seed (thread/run moves) follows `.planning/seeds/TEMPLATE.md`; run `node scripts/check-seeds-register.cjs`.

## Sources

### Primary (HIGH — read in this tree, 2026-10-28)
- `backend/app/api/{folders,documents,library,threads,workflow_runs,workflows,inbound}.py`, `backend/app/db/workflows.py`, `backend/app/services/{workflow_kickoff,scheduler_service,unattended_launch,ingest_splice,audit_service}.py`, `backend/app/services/harness/{scope,publish_service}.py`, `backend/app/utils/folder_utils.py`, `backend/app/dependencies.py`, `backend/app/services/retention/hold_guard.py`
- `supabase/migrations/207_library_documents_view.sql`, `208_library_page_index.sql`, `215_api_keys_and_run_origin.sql`; `supabase/full-schema.sql` (policies, triggers, FKs, unique indexes)
- `frontend/src/hooks/{useFolders,useLibraryDocuments,useDocuments,useThreads,useDraftPersistence}.ts`, `providers/{OrgProvider,StreamsProvider}.tsx`, `pages/{LibraryPage,WorkflowsPage,WorkflowBuilderPage}.tsx`, `components/{workflows/DescribeKbPicker,workflows/useBuilderNameMaps,workflows/history/RunLogPanel,chat/useStartWorkflowInThread,layout/ChatLayout,layout/ChatHistoryColumn,ingestion/FolderNode,library/IngestionTab,panel/WorkspacePanel}.tsx|ts`, `lib/api/{_core,documents,threads,workflows}.ts`
- Tests/fences cited inline; `scripts/check-hot-file-ledger.cjs` (run), `scripts/build-public-openapi.cjs`
- `docs/HOT-FILE-LEDGER.md` sections: folder_utils (295-10), workflow_kickoff, LibraryPage (284 close), WorkflowsPage (297-03, WR-02), workflow_runs (296-06)
- `.claude/skills/sketch-findings-agentic-rag/references/{org-admin-and-identity,control-room-shell-and-receipts}.md`

### Secondary / Tertiary
- None — no web sources were needed; this phase is entirely internal.

## Metadata

**Confidence breakdown:**
- Edit points and fences: HIGH — each read at file:line today.
- ORG-05 doors and wire shape: HIGH for the facts, MEDIUM for the recommended shape (A2).
- Move inventory: MEDIUM — derived from FKs/triggers/indexes; not driven against a live move.
- Frontend guard mechanism: MEDIUM — pattern is standard; the self-heal race is reasoned from React effect order and the code, not reproduced.

**Research date:** 2026-10-28
**Valid until:** 2026-11-11 (hot files move weekly; re-derive line numbers at plan time)
