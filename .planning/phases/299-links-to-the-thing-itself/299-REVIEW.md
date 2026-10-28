---
phase: 299-links-to-the-thing-itself
reviewed: 2026-10-28T20:12:36Z
depth: standard
diff_base: 593068492
files_reviewed: 48
files_reviewed_list:
  - backend/app/api/links.py
  - backend/app/services/link_resolver.py
  - backend/app/services/item_org_guard.py
  - backend/app/api/runs.py
  - backend/app/api/schedules.py
  - backend/app/api/threads.py
  - backend/app/api/workflow_runs.py
  - backend/app/api/workflows.py
  - backend/app/db/schedules.py
  - backend/app/main.py
  - backend/app/services/workflow_kickoff.py
  - frontend/src/App.tsx
  - frontend/src/components/chat/ChatArea.tsx
  - frontend/src/components/experts/catalog/ExpertCatalogPage.tsx
  - frontend/src/components/experts/catalog/ExpertDetailModal.tsx
  - frontend/src/components/experts/catalog/useExpertLinkTarget.ts
  - frontend/src/components/layout/AddressNotFound.tsx
  - frontend/src/components/layout/AppViewSwitch.tsx
  - frontend/src/components/layout/BootScreen.tsx
  - frontend/src/components/layout/CantBeOpened.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/layout/LinkGate.tsx
  - frontend/src/components/layout/SwitchOrgPrompt.tsx
  - frontend/src/components/org/SavesInOrg.tsx
  - frontend/src/components/org/orgItemsCopy.ts
  - frontend/src/components/share/ShareLinkMenu.tsx
  - frontend/src/components/workflows/RunEvidenceReport.tsx
  - frontend/src/components/workflows/library/RunModal.tsx
  - frontend/src/components/workflows/library/WorkflowCard.tsx
  - frontend/src/components/workflows/library/WorkflowCardMenu.tsx
  - frontend/src/components/workflows/library/useWorkflowFork.ts
  - frontend/src/components/workflows/library/useWorkflowLinkTarget.ts
  - frontend/src/hooks/useAppNavigation.ts
  - frontend/src/hooks/useAuth.ts
  - frontend/src/hooks/useThreadAddress.ts
  - frontend/src/hooks/useThreads.ts
  - frontend/src/lib/api.ts
  - frontend/src/lib/api/links.ts
  - frontend/src/lib/api/workflows.ts
  - frontend/src/lib/appRoutes.ts
  - frontend/src/lib/clipboard.ts
  - frontend/src/lib/linkAudience.ts
  - frontend/src/lib/returnTo.ts
  - frontend/src/pages/AuthPage.tsx
  - frontend/src/pages/WorkflowRunPage.tsx
  - frontend/src/pages/WorkflowsPage.tsx
  - frontend/src/types/index.ts
  - scripts/build-public-openapi.cjs
findings:
  critical: 3
  warning: 5
  info: 5
  total: 13
status: issues_found
fix_pass:
  fixed_at: 2026-10-29
  base: a7e94786d
  scope: critical_warning
  outcomes:
    CR-01: fixed (dfc135486)
    CR-02: fixed (0ac730b70)
    CR-03: fixed (339338102)
    WR-01: fixed, sentence only; header-less half no_change_needed (00bb01f9c)
    WR-02: fixed, backend half; client half no_change_needed (0da754f48)
    WR-03: fixed (92739897f wording, 45fca202c card, fd27b4ca6 403/404 only)
    WR-04: fixed (4c408abaa)
    WR-05: fixed (08750fa18)
    IN-01..IN-05: out of scope (not touched)
---

# Phase 299: Code Review Report

**Reviewed:** 2026-10-28T20:12:36Z
**Depth:** standard (diff `593068492..HEAD`, with pre-existing code read where the diff touches it)
**Files Reviewed:** 48
**Status:** issues_found

## Summary

I reviewed the link resolver and route, the four org write guards, the client gate, the
address-to-selection binding, the audience twin, the return-to-link flow and the share and
"Saves in" mounts.

**What holds up, checked against the code:**
- **No existence leak on the 404.** Within each kind, a missing id and a forbidden id run the same
  statement with the same arguments. Malformed input and unknown kinds are refused before any
  item read, and every arm raises the same `HTTPException(404, "Not found")`. A request with no
  bearer gets a 401 from a router-level dependency.
- **No open redirect.** `returnTarget` rebuilds the path from the route table, and
  `takeReturnTarget` re-validates, expires after 15 minutes and is consumed once. `resume` only
  replaces the chat home with a same-origin `/app` route. I found no path off-origin or to a
  non-`/app` page.
- **The org header is trusted correctly.** `X-Org-Id` reaches the write guards only through
  `resolve_active_org_or_none`, which re-checks membership.
- **The ask-answer stamp is safe.** It inserts on the user-JWT client, so the messages RLS
  `WITH CHECK` still enforces membership.

**What does not hold up:**
1. **Former-member write (CR-01).** The new schedule stamp runs on the service pool, which skips
   RLS. It can write a schedule into an org the caller has left, and the scheduler then runs it
   unattended in that org.
2. **Private title leak (CR-02).** For a finished run, the resolver shows the owner's private
   chat title to other org members.
3. **Over-promised audience (CR-03).** The "who can open" line for a turned-off Expert claims
   more than the backend allows. The lockstep fixture doesn't cover the failing cases, so it
   cannot catch this.
4. **Lesser issues.** The kickoff guard's refusal can send the user back and forth between two
   orgs, and the gate's switch can hang forever on an org the caller is no longer in. There are
   also gate-cache and link-focus robustness gaps.

## Fix outcomes (2026-10-29, base `a7e94786d`)

Each finding was DRIVEN before it was fixed: a test reproducing the failure scenario was written
and seen to fail, then the smallest fix turned it green. The backend resolver findings were driven
on the real local Postgres (`backend/tests/integration/test_299_review_fixes_live.py`, one
transaction per case, always rolled back) as well as pinned in the unit suite.

| ID | Outcome | Commit | RED evidence |
|----|---------|--------|--------------|
| CR-01 | fixed | `dfc135486` | live: `workflow_org` returned org A after the owner left A |
| CR-02 | fixed | `0ac730b70` | live: a member read `Severance terms for J. Smith` |
| CR-03 | fixed | `339338102` | live: another manager got the 404 for a disabled private Expert whose line promised managers; both fixture suites red on the new rows |
| WR-01 | fixed (sentence); header-less half **no_change_needed** | `00bb01f9c` | unit: the run sentence told the person to switch and retry on the same chat; the header-less claim does not reproduce (see below) |
| WR-02 | fixed (backend); client half **no_change_needed** | `0da754f48` | live: a run in a left org resolved (active + completed) |
| WR-03 | fixed | `92739897f`, `45fca202c`, `fd27b4ca6` | fixture, lockstep and shareMounts red on the new wording; `ExpertCatalogPage.link` red on the refused-link card |
| WR-04 | fixed | `4c408abaa` | `LinkGate.test.tsx`: 3 new cases red |
| WR-05 | fixed | `08750fa18` | `useWorkflowLinkTarget.test.tsx`: 4 cases red (old arg name aliased, so the red is behavioural) |

**What was decided, and why:**
- **CR-01:** the membership arm (the definitions SELECT policy's own) went into
  `WORKFLOW_ORG_SQL`. A definition in an org its owner left now reads like a global one, so the
  schedule takes the caller's active org (a member org, the pre-299 trigger shape) and the Tweak
  guard names nothing. The review's "better still: refuse with a 404" was NOT taken: it needs a new
  response arm in `schedules.py` (FIRING). The operator may still prefer refusing.
- **CR-02:** the threads join carries `t.user_id = $2`; non-owners read
  `definition_snapshot->>'name'`, else the definition row's name. That is the evidence report's own
  precedence (`workflow_run_evidence.py:375-377`), so the link never shows more than the report a
  member can already read.
- **CR-03:** the real read rule was checked first: `EXPERT_SQL` and
  `get_expert -> check_expert_grant_access` both AND the manager arm with the visibility arm. Both
  twins answer `managers_only` only for org/public; private and granted read `only_you`. Three
  fixture rows added (disabled public / private / granted; 12 -> 15).
- **WR-01:** the guard module's contract is "no org resolved -> do nothing". **The header-less half
  of the finding does not reproduce.** A header-less send carries no `org_id` on the caller
  (`get_current_user` returns `{id, email}`; `send_message` adds `org_id` only when the header
  validates), and the 258 entitlement gate (`enforce_entitlement`, `workflow_kickoff.py:228`) fails
  closed with a 403 "No active organization" BEFORE the definition is read, so the org guard is
  never reached. Pinned by `test_a_header_less_kickoff_never_reaches_the_org_guard`. The ping-pong
  IS real and was fixed in the words only: "This workflow is in {org}. Switch to {org} and start it
  from a new chat there." The comparison (definition vs thread) is unchanged, because the chat guard
  already makes the thread's org the active one; `workflow_kickoff.py` is byte-unchanged. (Switching
  the comparison to the active org was tried and reverted: it changed nothing reachable and broke
  two 298 matrix fixtures that carry no thread org.)
- **WR-02:** backend: membership now binds both arms of `RUN_SQL`, matching
  `workflow_runs_select_own` behind the run read. With that, **all four kinds require membership of
  the item's org** (thread and workflow through RLS, run and Expert in the statement), so the server
  never answers with an org the caller is not in. **The client half does not reproduce:** the
  claimed "Switching to X... forever" depends on `OrgProvider`'s self-heal re-adopting another org,
  but the self-heal fires only while `activeOrgId === null` (`OrgProvider.tsx:125-135`), and
  `switchOrg` sets the new id synchronously (`:178-185`), so the gate's next render is `open`, not
  `switching`. A client-side "not in memberships -> can't be opened" check was NOT added: the
  membership list can lag an accepted invite, which would turn a working link into a false card.
- **WR-03:** the system-Expert line now names the gate (new audience `plan_experts`: "Opens for
  anyone signed in whose plan includes Experts."), with no gate added to the resolver (D-08). A
  refused `getExpert` (a 403 or 404; its thrown error now carries `status`) shows the one can't-be-opened
  card over the catalog, and the exit pushes `/app/experts`. A network throw, a 5xx or a 401 still shows
  nothing (T-299-25).
- **WR-04:** a 298 move (`useOrgItemsVersion`) or a change in the SET of membership ids drops the
  cache; the answer on screen is marked stale and re-asked while it stays displayed (no holding
  flash). The first membership load is not a change. The after-Switch reuse (no second request) and
  "leave and come back asks nothing new" both still hold when nothing moved.
- **WR-05:** the filters (query, chips, project) are cleared first, once per id; the hook also
  re-runs on the rendered rows; the once-per-id memory resets when the address names no workflow.
  `StreamsProvider.tsx` and `setViewingThread` are untouched.

**Gates at the end of the pass (HEAD after the last fix commit):**
- Backend unit: `69 failed, 10426 passed, 1 skipped, 2 xfailed, 2 xpassed` (ceiling 71). The first
  full run read 70: the WR-03 `plan_experts` literal had made the committed OpenAPI snapshot stale
  (`test_276_openapi_snapshot_fresh`, green at base); regenerated and committed, then re-run.
- Vitest: `count gate OK — 565/565 pinned files present, no per-file decrease, 0 failing.`
- Typecheck: `npx tsc -p tsconfig.app.json --noEmit` 61 errors at base `a7e94786d` and 61 at HEAD;
  set diff 0 new, 0 gone.
- Live resolver suites: `test_299_review_fixes_live.py` + `test_299_links_live.py` 8 passed.
- `check-hot-file-ledger.cjs` OK; `check-claude-md-size.cjs` OK.

**Not fixed here (Info, out of scope):** IN-01..IN-05. IN-04 (`is_enabled: null`) still stands:
the CR-03 edit kept each twin's own null reading.

## Critical Issues

### CR-01: A new schedule can be stamped into an org the caller has LEFT, and runs there unattended

**Outcome:** fixed, `dfc135486` (membership arm in `WORKFLOW_ORG_SQL`).

**File:** `backend/app/services/link_resolver.py:162-166` (`WORKFLOW_ORG_SQL`), used at `backend/app/api/schedules.py:146-147` and `backend/app/db/schedules.py:91-110`

**Issue:** `WORKFLOW_ORG_SQL` returns `d.org_id` for any non-global definition with
`created_by = $2`. It never checks that the caller is still a member of that org, and it runs on
the service pool, where RLS does not apply. `create_workflow_schedule` passes that value to
`create_schedule`, which INSERTs `org_id` explicitly, also on the pool. The policy
`workflow_schedules_insert` (`org_id IN current_user_org_ids()`) is therefore bypassed, and the
`autofill_org_id_by_owner` trigger keeps the value as given.

The route's own load, `get_definition` (`db/workflows.py:947`), is also pool-side and owner-only
with no membership check, so nothing earlier catches it. `require_capability("workflows")`
checks the *active* org, not the definition's org.

**Failure scenario:**
1. User U authors and publishes workflow W while in org A, then is removed from A. The definition
   row survives with `created_by = U` and `org_id = A`.
2. From org B, U calls `POST /workflows/{W}/schedules`.
3. The schedule is written with `org_id = A`.
4. `scheduler_service` (`org_id = schedule.get("org_id") or …`, line 152) checks A's
   entitlement and calls `launch_unattended_run(owner_id=U, org_id=A, …)` every tick. A
   non-member now runs workflows that spend org A's metered budget and land threads and runs in
   org A.
5. U cannot even see or delete the schedule through RLS, because `workflow_schedules_select`
   requires membership.

Before 299 the trigger's `LIMIT 1` membership read could only pick an org U still belongs to,
so this is a regression introduced by the explicit stamp.

The same unchecked value feeds the Tweak guard (`workflows.py:1231`). There it names an org the
caller left in the 409. That contradicts `item_org_guard.py`'s docblock claim ("the caller is a
member of that org … so naming it leaks nothing").

**Fix:** Require current membership in the statement, so a left org reads like "not yours":
```sql
SELECT CASE WHEN d.is_system_global THEN NULL ELSE d.org_id END
FROM public.workflow_definitions d
WHERE d.id = $1 AND d.created_by = $2
  AND (d.is_system_global
       OR EXISTS (SELECT 1 FROM public.org_members m
                  WHERE m.org_id = d.org_id AND m.user_id = $2))
```
Better still, refuse the schedule (404, the route's own "workflow not found") when the
definition's org is not one of the caller's orgs, instead of falling back to the active org.
Add a unit case where a "former member" owns a definition in an org they are no longer in.

### CR-02: The run resolver discloses the owner's PRIVATE chat title to every member of the run's org

**Outcome:** fixed, `0ac730b70` (chat title only for its owner; others read the frozen name).

**File:** `backend/app/services/link_resolver.py:102-114` (`RUN_SQL`)

**Issue:** For a finished run, the org-member arm admits any member of `wr.org_id`. The
statement then returns `COALESCE(NULLIF(t.title,''), NULLIF(d.name,''), 'Workflow run')`, where
`t` is the owner's thread.

Thread titles are owner-only: the `threads` SELECT policy is `auth.uid() = user_id`. The
evidence rule this arm copies (`workflow_run_evidence._ACCESS_SQL`, and `run_evidence.py`)
never returns a thread title. So the resolver gives non-owners more than the read rule it claims
to mirror.

`d.name` is also the *live* definition's name, which D-33 makes owner-only. The evidence report
uses the run's snapshot instead.

**Failure scenario:**
1. Alice starts a workflow inside an existing private chat, which `ThreadWorkflowPicker`
   supports. The chat's auto-title is something like "Severance terms for J. Smith".
2. She shares the finished run's link, whose share line promises "Opens for members of Acme".
3. Bob, an Acme member, calls `GET /links/run/<id>` and gets
   `{"title": "Severance terms for J. Smith", …}`.
4. If Bob's active org differs from the run's org, `SwitchOrgPrompt` also renders that title in
   the item box.

**Fix:** Return the thread title only to the owner, and use the run's frozen definition name
for everyone else:
```sql
SELECT wr.id,
       CASE WHEN wr.user_id = $2
            THEN COALESCE(NULLIF(t.title,''), NULLIF(wr.definition_snapshot->>'name',''), 'Workflow run')
            ELSE COALESCE(NULLIF(wr.definition_snapshot->>'name',''), 'Workflow run')
       END AS title,
       wr.status, wr.org_id, o.name AS org_name
FROM public.workflow_runs wr
LEFT JOIN public.threads t ON t.id = wr.thread_id AND t.user_id = $2
...
```
Add a route test asserting that a non-owner member never receives the thread title.

### CR-03: "Turned off" Expert audience over-promises: a disabled private or granted Expert does not open for "people who manage Experts"

**Outcome:** fixed, `339338102` (both twins + 3 fixture rows).

**File:** `backend/app/services/link_resolver.py:203-206` and `frontend/src/lib/linkAudience.ts:41,58`

**Issue:** `audience_of` and `audienceOf` both return `managers_only` for any disabled bundle,
before they look at visibility. The UI then says *"It's turned off, so it opens only for people
who manage Experts in <org>."*

`EXPERT_SQL` (and `get_expert` → `check_expert_grant_access`) *ANDs* the disabled-bundle
manager arm with the visibility arm:
- A disabled **private** bundle opens only for its creator, and only if the creator holds
  `experts:manage`.
- A disabled **granted** bundle opens only for grantees who also manage Experts.

Any other manager gets the 404 card. This breaks the phase's own T-299-32 ("the line NEVER
promises more than the rule"). The lockstep fixture (`link_audience_cases.json`) only has a
disabled **org** case, so it cannot see the problem.

**Failure scenario:** An org admin turns off their own private draft Expert and copies its link
to a fellow admin, because the line says managers can open it. The colleague gets "This Expert
can't be opened".

**Fix:** Narrow by visibility first, and keep "managers" only where every manager truly passes
the visibility arm:
```python
if not facts.get("is_enabled", True):
    vis = facts.get("visibility")
    if vis in ("org", "public"):
        return "managers_only"
    return "only_you"   # private / granted & disabled: never wider than the creator
```
Mirror this in `linkAudience.ts`. Add `{disabled, private}` and `{disabled, granted}` rows to the
fixture so both twins are pinned to the narrower answer.

## Warnings

### WR-01: The kickoff guard's refusal sends the user back and forth between two orgs, and it fires for callers with no org header too

**Outcome:** fixed in the words, `00bb01f9c`; the header-less half is no_change_needed (the 258 entitlement gate 403s first).

**File:** `backend/app/services/workflow_kickoff.py:311-312`

**Issue:** This guard compares the **definition's** org with the **thread's** org, not with the
active org. Its sentence ("This workflow is in B. Switch to B to run it.") tells the user to
switch to B. If they do, the next send on the same thread (thread in A) is refused by the chat
guard at `threads.py:1840` ("This chat is in A. Switch to A to keep chatting."). Neither
instruction can ever succeed on that thread.

Separately, the module contract (`item_org_guard.py` docblock: "no active org resolved → no-op.
A header-less caller is byte-identical to today") is broken here. With no `X-Org-Id`, the chat
guard no-ops, but this guard still refuses whenever the definition's org differs from the
thread's org.

**Fix:** Pick one of these:
- **(a) Compare against the active org, as documented.** Pass `active_org_id` into
  `preflight_workflow_kickoff` and call `refuse_if_other_org(def_org, active_org_id, kind="run")`.
- **(b) Keep the thread-versus-definition check, but change it.** Make it a no-op when
  `active_org_id` is None, and give it its own sentence that names the real remedy ("This
  workflow is in B. Start it from a chat in B."). Never tell the user to switch while they are
  on this thread.

### WR-02: The gate offers to switch to an org the caller is not in, then shows "Switching to X…" forever

**Outcome:** backend fixed, `0da754f48`; client half no_change_needed (`switchOrg` lands synchronously).

**File:** `backend/app/services/link_resolver.py:110-113` (owner arm) and `frontend/src/components/layout/LinkGate.tsx:246-259, 237, 285`

**Issue:**
- **Backend.** `RUN_SQL`'s owner arm is `wr.user_id = $2` with no membership check, while
  `workflow_runs_select_own` requires `org_id IN current_user_org_ids()`. A run the caller
  started in an org they have since left resolves `200` with that org's id and name.
- **Client.** `switchTo` calls `org.switchOrg(t.org_id)` without checking that `t.org_id` is in
  `org.orgs`. `OrgProvider`'s self-heal then adopts a valid membership again, so the active org
  never becomes `t.org_id`. `switchingKey` is cleared only when `key` changes (line 237), so the
  prompt stays in `switching: true`. The prompt then shows only the "Switching to X…" status and
  no buttons, permanently, with no way out except leaving the address.

The same hang happens whenever a switch does not land, for any reason.

**Fix:**
- Add the membership `EXISTS` to the owner arm, matching RLS.
- In `LinkGate`, render `cant` when `answer.target.org_id` is not in `memberships`, once
  memberships have loaded.
- Clear `switchingKey` when `activeOrgId` settles to something other than the target. Either
  track the requested org and reset when `activeOrgId` changes, or add a timeout that reverts to
  the buttons.

### WR-03: A system Expert's "Opens for anyone signed in to Syrel" ignores the `experts` capability gate, and the open fails silently

**Outcome:** fixed, `92739897f` (wording), `45fca202c` (the card) and `fd27b4ca6` (only a 403/404 is a refusal; a 401 is not).

**File:** `backend/app/services/link_resolver.py:200-202` and `frontend/src/lib/linkAudience.ts:40,53`; consumer `frontend/src/components/experts/catalog/useExpertLinkTarget.ts:39-45`

**Issue:** The whole `/experts` router carries `dependencies=[Depends(require_capability("experts"))]`
(`api/experts.py:72-76`), evaluated for the **active** org. The resolver has no capability arm,
so a system Expert resolves `200` / `audience: everyone` for every caller.

For a caller whose org tier lacks `experts`:
- the share line over-promises;
- the gate answers `open`;
- `ExpertCatalogPage` renders, and `useExpertLinkTarget`'s `getExpert()` 403 is swallowed by
  `.catch(() => {})`.

The person sees the catalog (or its tier refusal) with nothing opened and no
"can't be opened" card. That is the silent no-op `clipboard.ts`'s own docblock calls
"worse than none".

**Fix:**
- Word the system-Expert line around the gate, for example "Opens for anyone signed in whose
  plan includes Experts". Do not include an entitlement check in the 404 arm, since that would
  add shape.
- In `useExpertLinkTarget`, surface a refused `getExpert` as the gate's `cant` card, or as a
  one-line notice, instead of doing nothing.

### WR-04: LinkGate's lifetime answer cache goes stale after a 298 move-to-org, and keeps a `cant` after access is gained

**Outcome:** fixed, `4c408abaa`.

**File:** `frontend/src/components/layout/LinkGate.tsx:122, 145, 179`

**Issue:** The cache is keyed `kind:id` for the gate's whole life, on the stated premise that
"the answer names the ITEM's org, so it does not depend on the active org". Phase 298 made the
item's org mutable (Move to org):
- **Stale org.** If a workflow (or Expert) is moved from A to B after its answer was cached, the
  next visit to its address, with B active, shows "This is in A — switch?". Switching to A then
  "opens" an item that is no longer in A, and the Workflows page silently focuses nothing.
- **Stale refusal.** A cached `cant` survives the person accepting an invite or being granted the
  Expert until a full reload.

**Fix:** Invalidate the cache when `useOrgItemsVersion()` bumps (298's move signal) and when
`org.orgs` changes. Alternatively, drop the cache entry when the address leaves the key and keep
only the in-session "after Switch" reuse the docblock needs.

### WR-05: A workflow link can silently do nothing on a mounted Workflows page (filters not cleared; once-per-id)

**Outcome:** fixed, `08750fa18`.

**File:** `frontend/src/components/workflows/library/useWorkflowLinkTarget.ts:65-89`

**Issue:** There are three problems:
- **Project filter never cleared.** The project filter is cleared only *after* the row is found
  in `rows` (line 73-78). Published rows are narrowed **server-side** by `?project_folder_id=`
  (`WorkflowsPage.tsx:434-437`), so a published workflow outside the selected project is never
  in `rows`. The filter is never cleared and the card is never focused.
- **Query and chips never reset.** `query` and `activeChips` (client filters) are never reset.
  If they hide the card, `document.querySelector` finds nothing and nothing retries until
  `rows` changes.
- **Once per id.** `handled` is per id for the page's life, so Back/Forward onto the same
  `/app/workflows/<id>` while the page stays mounted does nothing.

The page stays mounted when the gate answers from cache (no holding arm), so all three are
reachable on a second visit to the link, or after an org switch with a project selected.

**Fix:**
- When `id` is set and the row is not yet found, clear the project filter **and** the
  query/chips first, then search.
- Reset `handled`/`cleared` when `id` becomes `null`, so re-entering the address re-runs the
  hook.

## Info

### IN-01: The Tweak org guard can be skipped by leaving out the optional parameter

**File:** `backend/app/api/workflows.py:1204-1209, 1230-1231`

**Issue:** The 409 fires only when the client sends `from_definition_id`. Any other client (or a
future fork path) that omits it creates the copy in the active org with no refusal. This is not
a security boundary, because the caller owns the source. But the docblock frames it as "a Tweak
of a workflow in another org is refused", and that is only true for the one cooperating caller.

**Fix:** Document it as advisory, or derive the source from the body (for example, a
`forked_from` field the server validates).

### IN-02: A same-org thread missing from the list shows "can't be opened" despite a 200

**File:** `frontend/src/components/layout/LinkGate.tsx:294-299`

**Issue:** The gate opens threads only from the active org's list. `list_threads` excludes
`is_eval` threads and is bounded by PostgREST's row cap (default 1000), while `THREAD_SQL`
resolves both. Such a thread gets the 404 card after the reload. That contradicts the module's
own rule that only the server's 404 produces "can't be opened".

**Fix:** For a `200` same-org thread absent after the reload, fetch and select that one thread
(`getThread(id)`) instead of rendering `cant`.

### IN-03: Write guards fail open when the membership read errors

**File:** `backend/app/services/item_org_guard.py:58-60`; `backend/app/api/schedules.py:147`

**Issue:** `resolve_active_org_or_none` returns `None` both for "no header" and for "the
membership read failed". On a transient DB error, the chat, kickoff and Tweak guards no-op. The
schedule path for a global definition then falls to the trigger's `LIMIT 1` org, which is the
SEED-313 mis-stamp that 298-review WR-09 chose to refuse with a 503 for Root uploads.

**Fix:** For the schedule's global-definition fallback, reuse `org_lists._confirm_header_or_refuse`
(503 when a well-formed header could not be confirmed).

### IN-04: The audience twins disagree on `is_enabled: null`

**File:** `frontend/src/lib/linkAudience.ts:41` vs `backend/app/services/link_resolver.py:203`

**Issue:** TypeScript checks `facts.is_enabled === false`, so `null` is not disabled. Python
checks `not facts.get("is_enabled", True)`, so `None` *is* disabled. The fixture has no null
case, so "two twins, one fixture" does not pin this.

**Fix:** Pick one meaning in both twins and add a fixture row for it.

### IN-05: The Expert link hook never reopens the same Expert while the address is unchanged

**File:** `frontend/src/components/experts/catalog/useExpertLinkTarget.ts:32-34`

**Issue:** `handled` is never reset while `linked` stays the same. After the person closes the
modal, clicking the same shared link again (same address, so no navigation) opens nothing. This
is by design per the docblock ("never reopens while the address is unchanged"), but it reads as
a dead link.

**Fix:** Clear `handled` when the modal closes and the address is re-pushed, or have the close
action replace the address with `/app/experts`.

---

_Reviewed: 2026-10-28T20:12:36Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
