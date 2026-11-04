---
phase: 298-lists-follow-the-active-org
reviewed: 2026-10-28T10:40:31Z
depth: standard
independent_review: self
files_reviewed: 55
files_reviewed_list:
  - backend/app/services/org_move.py
  - backend/app/api/org_items.py
  - backend/app/services/foreign_folder_refusal.py
  - backend/app/services/org_lists.py
  - supabase/migrations/217_org_item_move_audit.sql
  - backend/app/api/documents.py
  - backend/app/api/folders.py
  - backend/app/api/inbound.py
  - backend/app/api/library.py
  - backend/app/api/threads.py
  - backend/app/api/workflow_runs.py
  - backend/app/api/workflows.py
  - backend/app/db/workflows.py
  - backend/app/main.py
  - backend/app/services/audit_service.py
  - backend/app/services/scheduler_service.py
  - backend/app/services/workflow_kickoff.py
  - frontend/src/components/org/ElsewhereLine.tsx
  - frontend/src/components/org/MoveToOrgButton.tsx
  - frontend/src/components/org/MoveToOrgMenuItem.tsx
  - frontend/src/components/org/MoveToOrgSheet.tsx
  - frontend/src/components/org/orgItemsCopy.ts
  - frontend/src/lib/elsewhereCounts.ts
  - frontend/src/lib/api/orgItems.ts
  - frontend/src/lib/api/documents.ts
  - frontend/src/lib/api/threads.ts
  - frontend/src/lib/api/workflows.ts
  - frontend/src/lib/api.ts
  - frontend/src/hooks/useActiveOrgId.ts
  - frontend/src/hooks/useDraftPersistence.ts
  - frontend/src/hooks/useFolders.ts
  - frontend/src/hooks/useLibraryDocuments.ts
  - frontend/src/hooks/useLibraryOrgSwitch.ts
  - frontend/src/hooks/useThreads.ts
  - frontend/src/providers/OrgProvider.tsx
  - frontend/src/pages/LibraryPage.tsx
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/pages/WorkflowsPage.tsx
  - frontend/src/components/workflows/library/useWorkflowLibraryFeeds.ts
  - frontend/src/components/workflows/library/WorkflowCardMenu.tsx
  - frontend/src/components/workflows/history/RunLogPanel.tsx
  - frontend/src/components/workflows/DescribeKbPicker.tsx
  - frontend/src/components/workflows/folderLabel.ts
  - frontend/src/components/workflows/useBuilderNameMaps.ts
  - frontend/src/components/chat/ThreadWorkflowPicker.tsx
  - frontend/src/components/chat/useStartWorkflowInThread.ts
  - frontend/src/components/ingestion/FolderNode.tsx
  - frontend/src/components/ingestion/FolderTree.tsx
  - frontend/src/components/layout/ChatHistoryColumn.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/metadata/DocumentDetailPanel.tsx
  - frontend/src/components/settings/apiKeys/apiKeyFacts.ts
  - frontend/src/components/settings/apiKeys/apiKeysCopy.ts
  - frontend/src/setupTests.ts
  - scripts/build-public-openapi.cjs
findings:
  critical: 1
  warning: 9
  info: 5
  total: 15
status: issues_found
---

# Phase 298: Code Review Report

**Reviewed:** 2026-10-28T10:40:31Z
**Depth:** standard (scoped to `git diff fb573b908^ HEAD`)
**Files Reviewed:** 55
**Status:** issues_found

## Summary

The list-narrowing half of the phase holds up. Every list route resolves the org only through
`org_lists` → `resolve_active_org_or_none`. `None` adds no predicate and never becomes `set()`.
`folder_kw` returns `{}` rather than binding `None`. The `$N` binding in `list_published_workflows`
and `list_draft_workflows` is correct in both branches. The org-items reads run over RLS, name only
member orgs, and give an unseen id the same answer as a missing one. The migration keeps all 39
literals from 215 and adds one. The ORG-05 refusal reads the definition's org from the row at
every door (kickoff, scheduler, inbound, update). The coded `detail={code, message}` shape is
consistent from server to client.

The defects are in the move and in the frontend switch lifecycle:

- **The move (`org_move.py`):** it checks the caller's membership only against the org stamped
  on the item's ROOT row. Subfolders and documents carry their own `org_id`, and nothing compares
  it to the source. Mis-stamped rows (the SEED-313 class) can therefore move out of an org the
  caller is not in, and the receipt names the wrong from-org. The same gap makes the move refuse
  the exact mis-stamp repair it exists for.
- **Ancestor folders:** blockers that come from an ancestor folder (org-shared visibility, or
  bindings on a parent) are not checked.
- **Locking (TOCTOU):** the "every check re-runs under lock" claim does not cover tables the move
  does not lock.
- **The Library switch reset:** it leaves a saved view, an ad-hoc filter or a Find search on
  screen.
- **Mobile:** the folder sheet mounts the move-sheet host twice.
- **Thread list:** a failed thread refetch after a switch leaves the column loading forever.

## Critical Issues

### CR-01: The move never checks subfolder/document `org_id` against the source org. Rows can leave an org the caller is not in, the receipt names the wrong from-org, and the intended mis-stamp repair self-collides

**File:** `backend/app/services/org_move.py:471-494`, `:626-656`, `:839-855`, `:950-980`

**Issue:** `_prepare` takes `src = items.source_org`, which is the `org_id` of the ROOT folder, or
of the one document row the caller named. It checks membership in that org only (`:850`). After
that, `_collect` gathers every subtree folder (`_SUBTREE_SQL`) and every document in those folders
(`_DOCS_IN_FOLDERS_SQL`) whatever each row's own `org_id` is. `_apply` then sets
`org_id = dst` on all of them and on their chunks, images, tables, extraction runs and jobs. No
refusal compares `f["org_id"]` or `d["org_id"]` to `src`. The phase itself documents that such
rows exist: SEED-313 is the bug where a header-less upload into an org-A folder was stamped with
the owner's `LIMIT 1` org B (mig 106).

Failure scenarios:

1. The caller owns folder F in org A. F holds their `report.pdf`, legacy-stamped org B, and the
   caller has since been removed from B. The caller moves F to org C. Their membership is checked
   in A and C only. `report.pdf` and its child rows leave B without a B membership check, which
   breaks D-20 ("member of BOTH the source and target org"). The audit row is written under A with
   `from_org: A`, so B's ledger has no record that its row left. The receipt is wrong.
2. Same F, but the caller is in B and moves F to B to repair it, which is exactly the D-18 per-item
   repair. `report.pdf` is already in B and completed, so the collision query
   (`t.org_id = $2 AND t.user_id = m.user_id AND t.content_hash = m.content_hash`) matches the row
   against ITSELF. The move is refused with "“report.pdf” is already in B." The `same_name` query
   has the same self-match.

**Fix:** Treat any moving row whose org differs from the root's as a worded refusal, or check
membership for every distinct org in the set. Exclude the moving set from the target-side joins
either way.

```python
# in _prepare, after src is known
stray = {r["org_id"] for r in (*items.folders, *items.documents)} - {src}
if stray:
    found.setdefault("mixed_orgs", []).append(
        f"{q(items.name)} holds items stamped in another organization. Move those first."
    )  # add "mixed_orgs" to REFUSAL_ORDER
# collision / same_name: never match a row against itself
#   ... JOIN public.documents t ON t.org_id = $2 AND ... AND NOT (t.id = ANY($1::uuid[]))
```

## Warnings

### WR-01: An org switch on the Library resets the folder but keeps a saved view, an ad-hoc filter or a Find search, so the list keeps showing the old org's resolved rows under a sidebar that says Root

**File:** `frontend/src/hooks/useLibraryOrgSwitch.ts:50-55`; `frontend/src/pages/LibraryPage.tsx:349-367, 516-522`

**Issue:** The switch reset only dispatches `SELECT_FOLDER {folderId: null}` and closes the panel.
The page's own folder handler (`handleSelectFolder`, `:516`) does two more things: it clears the
Find search (`findDispatch({type: "CLEAR_SEARCH"})`) and drops `listTarget` (`setListTarget(null)`).
`listTarget` is page state outside the reducer, and the list source is
`listTarget ?? {kind:"browse", …}` (`:367`).

Scenario: in org A, open a saved view (`listTarget = {kind:"view"}`) and switch to org B. The
sidebar shows Root selected, and the list re-resolves the same view through `resolveView` →
`document_view_resolver`, which D-05 leaves un-narrowed. The documents tab keeps showing the view's
cross-org result set, labelled as the new org's Root. A Find search behaves the same way through
`findRows`. This is G-4 scenario 1 ("the old org's … never show after the switch").

**Fix:** Have the switch reset do what `handleSelectFolder` does. One option is to pass a callback
from the page into `useLibraryOrgSwitch`:

```ts
// LibraryPage
useLibraryOrgSwitch({ dispatch, setSelectedDocId, onSwitch: () => { findDispatch({ type: "CLEAR_SEARCH" }); setListTarget(null) } })
// useLibraryOrgSwitch, inside the seenOrg branch
onSwitch?.()
```

### WR-02: On mobile the Library mounts two `FolderTree`s, so two `MoveToOrgSheetHost`s render two move sheets for one request

**File:** `frontend/src/components/org/ElsewhereLine.tsx:62-65`; `frontend/src/pages/LibraryPage.tsx:1224-1272, 1334-1341`

**Issue:** `sidebarGroupsEl` (and with it `FolderTree` → `ElsewhereLine kind="library"` →
`MoveToOrgSheetHost`) mounts in two places. One is the desktop sidebar, which renders whenever
`showSidebar` is true and is hidden below `md` only by CSS (`hidden md:flex`), so it stays
mounted. The other is the mobile bottom `Sheet`. With the mobile folder sheet open, both hosts read
the same `moveRequest`, and each renders a `MoveToOrgSheet`. Each sheet portals to `<body>`, so
`display:none` on the sidebar does not hide its copy. Each sheet fires its own `getMovePreview`.

Scenario: on a phone, ⋯ → "Move to Acme…". Two stacked sheets open. The person confirms in the
top one, and the move succeeds. The second sheet still offers "Move to Acme". Pressing it POSTs
again and gets the `SAME_ORG` 422, shown as "Can't move …".

**Fix:** Host the row-menu sheet once per page, outside `sidebarGroupsEl`: for example a
`<MoveToOrgSheetHost kinds={["folder"]} />` in `LibraryPage`, plus a `hostsMoves={false}` prop on
`ElsewhereLine` inside `FolderTree`. Alternatively, make the host a singleton by claiming a
module-level token.

### WR-03: A failed thread refetch after an org switch leaves "Loading your chats…" on screen forever

**File:** `frontend/src/hooks/useThreads.ts:65-78, 113-114`; `frontend/src/components/layout/ChatLayout.tsx:199`

**Issue:** `switching = held !== null && held.org !== activeOrgId`. In `loadThreads`, only
`finally` runs on error, and `held` still names the old org. `ChatLayout` swallows the rejection
(`.catch(console.error)`). Nothing retries, so `switching` stays `true`, `threads` stays `[]`, and
the history column shows its spinner indefinitely. `useFolders` handles this case
(`setHeld({ org: sentUnder, rows: [] })` in its catch, `:81-84`); `useThreads` does not.

Scenario: the user switches org, and `GET /threads` fails once (5xx, network, token refresh). The
column shows "Loading your chats…" until some later action happens to reload.

**Fix:**

```ts
} catch (err) {
  if (myReq === reqIdRef.current) setHeld({ org: sentUnder, rows: [] })
  throw err
} finally { … }
```

### WR-04: Ancestor-scoped blockers are not refused. A subfolder of an org-shared folder, or of a folder a workflow, chat, Expert or watch binds, moves out silently

**File:** `backend/app/services/org_move.py:659-768`

**Issue:** The retention check explicitly covers ANCESTORS (`retention_folder_ancestors(... ) WHERE
depth > 0`, `:698-710`), with the stated reason that "coverage would silently stop applying". Every
other blocker looks only at the subtree's own ids:

- `is_org_shared` on subtree rows (`:670`);
- `threads.folder_id`, workflow bindings, `expert_installs`, `connector_watches`,
  `classification_rules` and `document_views`, all matched with `= ANY(folder_ids)`.

Visibility through an org-shared ancestor (`is_in_global_subtree`) and a parent-folder binding both
reach the subtree. The move detaches the root (`parent_id = NULL`), so both silently lose it.

Scenario: org A has an org-shared folder "Team" holding the caller's private subfolder "Q3". Every
A member sees Q3 through Team. A workflow is bound to Team, and Team is a chat's folder scope. The
caller moves Q3 to org B. None of the refusals fire. Colleagues lose Q3's documents from the shared
tree. The workflow and the chat lose them from their scope with no error. This is the "only the
clean case moves" promise (D-33) failing for inherited state.

**Fix:** Walk `retention_folder_ancestors(item_id)` once. Treat an ancestor with `is_org_shared`,
or an ancestor id named by threads, workflow bindings, expert installs/bundles or connector
watches, as the same refusal sentences.

### WR-05: The TOCTOU claim does not hold for tables the move does not lock. A concurrent draft save or chat bind can attach the folder in the old org just before commit

**File:** `backend/app/services/org_move.py:25-31, 718-738`; `backend/app/services/foreign_folder_refusal.py:246-270`

**Issue:** The module docstring says the move "re-runs every refusal (so a blocker created between
preview and confirm is caught — TOCTOU)". The re-run happens inside the transaction, but only the
folder, document and draft rows are locked.

- Workflow bindings live in JSON. A concurrent `PATCH /workflows/drafts/{id}` reads the folder's
  org via the pool (still the source, so it passes `raise_if_foreign_change`) and writes after the
  move's LIKE scan. The move then commits, and the draft binds a folder in another org.
- Thread inserts take `KEY SHARE` on the folder, so they wait on the move's `FOR UPDATE`. But
  `_authorize_thread_folder`'s org check ran before the wait and is not re-run, so the insert
  completes after the move with a thread in A bound to a folder now in B.

Launch then refuses the workflow with a sentence, so the harm is bounded. Still, the "caught"
claim is false, and the chat case has no later guard.

**Fix:** Either correct the docstring to name the residual window, or serialize the dependents.
For example, take `pg_advisory_xact_lock(hashtext('folder-bind:' || folder_id))` for each subtree
folder in the move, and the same lock in the draft-save and thread-folder-bind paths.

### WR-06: `create_draft` without an `X-Org-Id` header skips the foreign-folder check, yet the row is still stamped with an org

**File:** `backend/app/api/workflows.py:1218-1229`; `backend/app/services/foreign_folder_refusal.py:187-191`

**Issue:** `raise_if_foreign(body, definition_org=_active_org, …)` gets `None` when no header
resolves (header-less client, foreign header, DB hiccup in `resolve_active_org_or_none`). The
helper then returns `None` without checking. The INSERT still lands in an org: the mig-106 trigger
picks the owner's `LIMIT 1` org. D-13 says the save is refused when a binding is foreign, but on
this path a draft whose `project_folder_id` is in org B saves into org A. The failure only shows up
at launch.

**Fix:** When `_active_org` is `None`, check against the org the row actually got. Either read
`org_id` back from `create_workflow_definition`'s RETURNING and run the check inside the same
transaction, or resolve the trigger's org first (`SELECT org_id FROM org_members WHERE user_id=$1
LIMIT 1`, the same rule) and pass that.

### WR-07: The org audit ledgers have no label for `org.item.move`, so the receipt the sheet promises shows as a raw code

**File:** `frontend/src/components/org/OrgAuditTab.tsx:40-68`, `frontend/src/components/admin/AuditTab.tsx:~92-98` (not in the review list, but the consumers of migration 217's new type)

**Issue:** The move sheet tells the person the move is "recorded", and the row is written under
the source org. `OrgAuditTab.actionLabel` falls back to `code` for unmapped types
(`ACTION_META[code]?.label ?? code`), and neither map gained `org.item.move`. The org admin sees
`org.item.move` in their ledger, outside every group filter chip. Phase 293 added its five
`api_key.*` labels in the same change as migration 215; 298 did not follow that precedent.

**Fix:** Add `"org.item.move": { label: "Moved an item to another organization", group: "Organizing" }`
to both maps, and add a case to `OrgAuditTab.test.tsx`'s label table.

### WR-08: The Builder's "lives in <org>" marker is keyed on the viewer's active org, not the definition's org, so it inverts for a Builder open on another org's draft

**File:** `frontend/src/components/workflows/useBuilderNameMaps.ts:186-224`; `frontend/src/components/workflows/folderLabel.ts:27-36`; `frontend/src/pages/WorkflowBuilderPage.tsx:2400-2404`

**Issue:** D-15's purpose is that "the author sees what will be refused". The refusal rule is
"not in the definition's org". The picker instead narrows to the ACTIVE org and marks folders that
are not in it. `useDraftPersistence` deliberately reloads header-less (`allOrgs: true`) so a
Builder stays open on an org-A draft after a switch to B.

Scenario: draft in A, active org B. The `<select>` offers B's folders as plain names, with no
marker, and picking one is refused with a 422 on save. The draft's own A folder renders as
"Q3 — lives in A", a warning on the one binding that is valid.

**Fix:** Pass the definition's org (the draft row's `org_id`, available from the draft read) into
`useBuilderNameMaps` and `folderLabel`. Mark relative to it, and either narrow the folder read to it
or mark every option whose org differs.

### WR-09: A Root upload resolves the org from a client hint and silently falls back to the trigger, so an unresolved header still lands the upload outside the listed org

**File:** `backend/app/services/org_lists.py:62-71`; `backend/app/dependencies.py:1050-1061`

**Issue:** `root_upload_org` returns `resolve_active_org_or_none`. That function returns `None`
both for "no header" and for any exception while validating membership (`except Exception:
… return None`). For a list read, `None` is the correct, safe polarity. For a WRITE it means a
transient DB error during the membership probe makes the Root upload fall back to the mig-106
`LIMIT 1` org. That is the SEED-313 defect this phase folds, and the fresh upload then vanishes from
the Root list the person is looking at. The list-narrowing modules' "never raises" contract is
being reused for a write decision.

**Fix:** For the upload, distinguish "no or foreign header" (fall back) from "could not validate"
(fail with a 503 rather than mis-stamp). For example, add `resolve_active_org_strict_or_none` that
re-raises on DB errors, and use it only in `root_upload_org`.

## Info

### IN-01: The workflow fork turns the coded folder refusal into the generic fork-failed notice

**File:** `frontend/src/components/workflows/library/useWorkflowFork.ts:314, 380` (caller of `createWorkflowDraft`, which now throws `WorkflowFolderRefusedError`)

**Issue:** A Tweak or starter copy whose definition binds a folder outside the active org gets a 422
with the server's sentence. The fork's catch shows its own generic copy, so the person never learns
which folder or why.

**Fix:** Branch on `e.name === "WorkflowFolderRefusedError"` and show `e.message`, as
`useDraftPersistence.refusalOf` does.

### IN-02: The save, scheduler and API-key doors describe a visible org-shared folder as "a folder you can't open"

**File:** `backend/app/services/foreign_folder_refusal.py:210-214`

**Issue:** With no supabase client, visibility is approximated as "owned". An org-shared folder the
caller can open, in an org they belong to, is worded as unopenable and its org is not named. No
data leaks, but the sentence is wrong.

**Fix:** On the pool path, also treat `is_org_shared` with membership in the folder's org as
visible (one `org_members` read).

### IN-03: A move retried after a committed-but-lost response is refused as `SAME_ORG`, and the lists are never refreshed

**File:** `frontend/src/components/org/MoveToOrgSheet.tsx:237-253, 364-368`

**Issue:** Phase `failed` → Try again re-POSTs. If the first POST committed but its response was
lost, the server answers 422 "“X” is already in Y.". The sheet shows a refusal, and `noteMoved` is
never called, so the item stays in the current list until a manual reload.

**Fix:** On a refusal after a `failed` attempt, call `noteMoved` (or `invalidateElsewhereCounts`
plus a version bump) so the lists reconcile from the server.

### IN-04: A service module imports from the API layer

**File:** `backend/app/services/foreign_folder_refusal.py:52`

**Issue:** `from app.api.workflow_wire import _coerce_definition` makes a service depend on a
private helper in an API module that is itself imported by `app.api.workflows`. That is an
import-cycle hazard, and it inverts the layering.

**Fix:** Move `_coerce_definition` to a neutral module (e.g. `app.utils.definition_json`) and
re-export it from `workflow_wire`.

### IN-05: `refreshViews` is not org-guarded, unlike its sibling effect

**File:** `frontend/src/hooks/useLibraryOrgSwitch.ts:92-94`

**Issue:** The mount/switch read drops a late answer via `live`, but `refreshViews` writes
whatever returns. A refresh started just before a switch can repaint the previous org's views.

**Fix:** Tag the call with `getActiveOrgId()` at send time and drop the answer if it no longer
matches.

---

_Reviewed: 2026-10-28T10:40:31Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
