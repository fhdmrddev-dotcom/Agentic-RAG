---
phase: 299
slug: links-to-the-thing-itself
status: verified
threats_total: 36
threats_open: 0
asvs_level: 1
block_on: high
register_authored_at_plan_time: true
created: 2026-10-29
audited_at_head: 5b05ce7a9
---

# Phase 299 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> The register is the union of the five plan-time `<threat_model>` blocks (299-01..05, T-299-01..36).
> Each threat was verified against the code at HEAD `5b05ce7a9`, after the 299-REVIEW fix pass, not against SUMMARY prose.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| browser → `GET /links/{kind}/{id}` | kind and id are untrusted path text; the caller's org membership is never taken from the client | item id (untrusted); item title, org name (sensitive, returned only to someone who may open the item) |
| service pool (BYPASSRLS) → Postgres for the `run` / `expert` kinds | RLS does not protect these two statements, so the `$2` caller predicate is the only wall | run/expert rows across tenants |
| browser → item-page writes (send, kickoff, Tweak, ask answer, schedule) | `X-Org-Id` is a hint and is re-validated for membership. The item's org comes from its row | org stamp on new rows (tenant integrity) |
| address bar → `parseAppLocation` / gate | the path is attacker-shapeable (shared links) | entity ids |
| server answer → render | title and org name come from the resolver | display strings (markup-injection surface) |
| sessionStorage → resume | a stored return target is replayed after sign-in; another script on the origin could plant it | same-origin path |
| app → Supabase Auth (`redirectTo` / `emailRedirectTo`) | GoTrue enforces its Redirect URLs allow-list; the app supplies only origin + rebuilt path | redirect target |
| app → clipboard | copied text leaves the app | the item address |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation / Evidence | Status |
|-----------|----------|-----------|-------------|-----------------------|--------|
| T-299-01 | Information disclosure | GET /links existence oracle | mitigate | `backend/app/api/links.py:37` one `NOT_FOUND_DETAIL`; `:80-81` an unknown kind or non-strict-UUID id gives a 404 before any I/O; `:91-92` a `None` row gives the same 404. `link_resolver.py:147-152` has one statement per kind, and `lookup` `:181-186` passes the same args for missing and forbidden. Tests: `test_299_links_route.py:149` (malformed → exact body bytes, zero SQL) and `:166` (missing ≡ forbidden: same SQL, arity, status, body, headers). | closed |
| T-299-02 | Information disclosure | timing between missing and forbidden | accept | See AR-01. Both cases are one primary-key `fetchrow` in one statement (`link_resolver.py:181-186`). | closed |
| T-299-03 | Elevation | anonymous access to the resolver | mitigate | `links.py:40-52`: `_require_bearer` is a router-level dependency, so every route answers 401 + `WWW-Authenticate: Bearer`. Test `test_299_links_route.py:112` enumerates the router's routes and asserts zero SQL. `git diff --stat 593068492 HEAD -- supabase/` is empty, so the route adds no table, function or grant. Deploy-time `get_advisors(security)` stays on the parity checklist. | closed |
| T-299-04 | Elevation / IDOR | reading another org's item | mitigate | Membership is checked inside each statement. THREAD `link_resolver.py:80` uses `t.user_id = auth.uid()` on `get_user_pg_connection` (`links.py:89`). WORKFLOW `:90` is owner or global published, under RLS. RUN `:112` uses an `org_members` EXISTS on both arms (WR-02 fix `0da754f48`). EXPERT `:128-144` checks the bundle's org through `org_members`. The header is never read (`test_299_links_route.py:204`). Live matrix: `tests/integration/test_299_links_live.py:94` and `test_299_review_fixes_live.py:228`, run green this audit (8 passed, real Postgres). | closed |
| T-299-05 | Elevation | pool kinds bypass RLS | mitigate | `POOL_KINDS = {run, expert}` (`link_resolver.py:55`); `$2` = the caller from the session (`links.py:83-87`). Test `test_299_links_route.py:188` asserts pool args `(item, caller)`. The predicates mirror `_ACCESS_SQL` / `check_expert_grant_access`, with the CR-02 owner-only title join (`:108`) and the CR-03 visibility∧manager arm (`:140-144`). Live: `test_299_review_fixes_live.py:131,157,191,228`. | closed |
| T-299-06 | Information disclosure | 422/403 revealing shape | mitigate | `links.py:68-70`: path params are `str`. Source scans `test_299_links_route.py:264` (no `get_active_org_id`, `require_capability`, `require_visible` or `str(exc` in links.py or link_resolver.py) and `:274` (no 403/422 literal). | closed |
| T-299-07 | Tampering | cross-org write mis-stamp (send, kickoff, Tweak) | mitigate | `item_org_guard.py:58-78` returns 409 on a mismatch and is a no-op with no I/O when either id is empty. Send: `threads.py:1840` (active org from `resolve_active_org_or_none` `:1820`, which re-checks membership at `dependencies.py:1020+`). Kickoff: `workflow_kickoff.py:312` (definition org vs thread org; header-less is stopped earlier by the 258 entitlement 403, see `test_299_write_org_guards.py:250`). Tweak: `workflows.py:1228-1231`. Tests: `test_299_write_org_guards.py:82-127,168-187,244-279,316-354`. | closed |
| T-299-08 | Tampering | ask answer / schedule stamped by the LIMIT-1 owner trigger | mitigate | Ask answer: `runs.py:951` selects `org_id` from the run, the workflow_runs fallback selects `org_id`, and `runs.py:1084` inserts `"org_id": row.get("org_id")` on the user-JWT client, so the messages RLS WITH CHECK still applies. Schedule: `schedules.py:147` passes `workflow_org(...)` or the validated active org, bound explicitly at `db/schedules.py:91-110`. CR-01 (`dfc135486`) added the membership arm to `WORKFLOW_ORG_SQL` (`link_resolver.py:161-167`), so a left org is never stamped. Tests: `test_299_write_org_guards.py:458,468,499,511,543-553,368`; live `test_299_review_fixes_live.py:88,106`. | closed |
| T-299-09 | Information disclosure | `from_definition_id` as an oracle | mitigate | `workflows.py:1230` reads only for `strict_uuid(...)` (`link_resolver.py:175-178`) and only with an active org. `WORKFLOW_ORG_SQL` is owner-scoped (`created_by = $2`, `:164`), so someone else's id reads `NULL` like a missing one and the guard is silent. Tests: `test_299_write_org_guards.py:336,345,360`. | closed |
| T-299-10 | Information disclosure | org name in the 409 sentence | accept | See AR-02. | closed |
| T-299-11 | Spoofing | open redirect via the return target | mitigate | `frontend/src/lib/returnTo.ts:36-45` rebuilds via `formatAppRoute(parseAppLocation(...))`, requires an `/app` prefix that does not start with `//`, and returns null otherwise. `useAuth.ts:16-20`: `redirectTo` / `emailRedirectTo` = `window.location.origin + target`. Test: the HOSTILE set in `lib/__tests__/returnTo.test.ts:24+` (`//evil.com`, `/https://evil.com`, …). | closed |
| T-299-12 | Spoofing | planted sessionStorage value | mitigate | `returnTo.ts:99-118`: removed before it is judged (`:106`), 15-min TTL (`:78,111-112`), re-validated, and must equal its rebuild (`:113-114`). `useAuth.ts:85` password sign-in calls `forgetReturnTarget()`. Tested in `returnTo.test.ts` (planted `//evil`, TTL). | closed |
| T-299-13 | Information disclosure | token in a URL / Referer | mitigate | `useAuth.ts` and `returnTo.ts` never read or write `location.hash`, verified by grep. The redirect value is origin + rebuilt path with no query and no hash (`returnTo.ts:14-19`). | closed |
| T-299-14 | Information disclosure | sign-in line names the item | mitigate | `pages/AuthPage.tsx:16-17` uses `kindWord(pathname, search)` → `RETURN_LINE`. `returnTo.ts:58-75` derives the kind from the path alone and never a title. Test: `pages/__tests__/AuthPage.returnLine.test.tsx`. | closed |
| T-299-15 | Denial of service | boot hangs forever (SEED-312) | mitigate | `useAuth.ts:65` has `getSession().catch(() => setLoading(false))`. `BootScreen` gives up at 20 s ("Can't reach Syrel" + reload) per `components/layout/__tests__/BootScreen.test.tsx`. | closed |
| T-299-16 | Elevation | timeout flips a signed-in person to sign-in | mitigate | `useAuth.ts:37-41,63-65`: no timer, and the `.catch` touches only `loading`, never `user`. Test: `hooks/__tests__/useAuth.test.ts:160` (a never-resolving `getSession` leaves `user` untouched). | closed |
| T-299-17 | Spoofing | Supabase Redirect URLs drift local↔cloud | transfer | Transfer documentation is present. `docs/DEPLOYMENT-WORKFLOW.md:119` has the §5 parity row (Redirect URLs `https://app.<domain>/**` + the one-box origin) and `:183` its dated log entry. GoTrue's allow-list is the enforcing control. G-4 row 4 SSO arm ⛔ per D-41. | closed |
| T-299-18 | Tampering | malformed / hostile path | mitigate | `lib/appRoutes.ts:137-142`: strict-UUID entity arms, lowercased. `parseAppLocation` `:184+` is total (never throws). `hooks/useAppNavigation.ts:241-250`: `go` refuses a non-UUID id for every id variant. Tests: `lib/__tests__/appRoutes.test.ts` (HOSTILE set) and `__tests__/routing/appRouteParity.test.ts`. | closed |
| T-299-19 | Tampering | a link triggers a write | mitigate | The open-by-id hooks only change local state or read. `components/workflows/library/__tests__/useWorkflowLinkTarget.test.tsx:71` asserts every API write fn is uncalled. `useExpertLinkTarget.ts` calls only `getExpert` (a read). | closed |
| T-299-20 | Information disclosure | a foreign id opened client-side | mitigate | Workflow focus comes only from server-narrowed lists. The Expert open is `getExpert` → the server's grant-aware read (`api/experts.get_expert` → `check_expert_grant_access`). A 403/404 shows the one card (`useExpertLinkTarget.ts:64-66`, WR-03 `fd27b4ca6`). Everything else goes through the resolver (T-299-04). | closed |
| T-299-21 | Denial of service | stream torn down by navigation | mitigate | `git log 593068492..HEAD -- frontend/src/providers/StreamsProvider.tsx` is empty (unedited). `__tests__/routing/navigationKeepsStreams.test.tsx` asserts subscriptions are unchanged, and was run green this audit. | closed |
| T-299-22 | Spoofing | history ping-pong / double entries | accept | See AR-03. Pinned by exact PUSH-count tests (`useAppNavigation.test.tsx`). | closed |
| T-299-23 | Information disclosure | card differs between missing and forbidden | mitigate | `lib/api/links.ts:43`: every 404 becomes `{status:"cant"}`. `CantBeOpened.tsx:10-16` words name the kind only. Identical-DOM cases are in `CantBeOpened.test.tsx`, `LinkGate.test.tsx` and `AppViewSwitch.addressStates.test.tsx`. | closed |
| T-299-24 | Spoofing | card echoes an attacker-chosen path | mitigate | `CantBeOpened.tsx:63-67,93`: the prop is a PARSED `AppRoute`, and the address shown is `window.location.host + formatAppRoute(route)`. A `null` route shows no address. There is no raw-path prop. | closed |
| T-299-25 | Information disclosure | outage shown as "can't be opened" | mitigate | `lib/api/links.ts:37-44`: a network error or any non-404 non-OK throws `ApiError`. `LinkGate.tsx:181-188` keeps holding and retries with backoff on a throw, and `:301` renders `cant` only on `answer.status === "cant"`. A 401 is not a refusal for Experts (`useExpertLinkTarget.ts:64-66`). Residual R-1 below. | closed |
| T-299-26 | Elevation | org switched without consent | mitigate | `LinkGate.tsx:285,291`: `switchOrg` is called only inside `switchTo` / `switchBack`, wired to the Switch / Switch back buttons (`SwitchOrgPrompt.tsx:107`). `SwitchOrgPrompt.tsx:65` has a focus-only effect. Tests: `LinkGate.test.tsx:276,473` (`switchOrg` not called on render). | closed |
| T-299-27 | Denial of service | Stay aborts a live stream | mitigate | `LinkGate.tsx:266-272`: Stay is an address replace only, with no org write and no subscription touched. Four-axis case in `navigationKeepsStreams.test.tsx`. | closed |
| T-299-28 | Tampering | title / org name injected as markup | mitigate | `SwitchOrgPrompt.tsx:95,116` and `LinkGate.tsx:337,356` render React text nodes. Grep for `dangerouslySetInnerHTML` in components/layout, share, org, workflows/library, experts/catalog and AuthPage matches only test files (source-scan fences). | closed |
| T-299-29 | Spoofing | resume replays a planted target | mitigate | `hooks/useAppNavigation.ts:430-439`: `takeReturnTarget()` (re-validated, consumed once). It acts only when the pathname is `/` or `/app`, re-parses, and refuses not-found / pre-auth. `LinkGate.tsx:198-203` resumes once per mount. | closed |
| T-299-30 | Information disclosure | Expert capability gate after a Switch | accept | See AR-04. WR-03 narrowed the residual: the audience line now says `plan_experts` (`link_resolver.py:201-205`, `linkAudience.ts:41,58`), and a refused `getExpert` shows the card. | closed |
| T-299-31 | Information disclosure | token / query string in the copied link | mitigate | `components/share/ShareLinkMenu.tsx:76,120` copies `window.location.origin + formatAppRoute(route)`. Test: `ShareLinkMenu.test.tsx:154-155` (no `?`, no `#`). | closed |
| T-299-32 | Spoofing | audience line over-promises access | mitigate | Twins `link_resolver.audience_of` (`:189-217`) and `linkAudience.audienceOf` (`:33-51`) are pinned to `backend/tests/unit/fixtures/link_audience_cases.json`: `test_299_link_resolver.py:146,155` and `linkAudience.lockstep.test.ts`. CR-03 (`339338102`) added the disabled private/granted rows (12→15), and the live check is `test_299_review_fixes_live.py:191`. Thread, draft, published and running run never return `org_members`. IN-04 (null `is_enabled`) is unreachable: `expert_bundles.is_enabled boolean DEFAULT true NOT NULL` (`supabase/full-schema.sql:2485`). | closed |
| T-299-33 | Elevation | a link grants access | accept | See AR-05. | closed |
| T-299-34 | Tampering | fork into the wrong org | mitigate | `useWorkflowFork.ts:336` sends `{ fromDefinitionId: wf.id }`, and `lib/api/workflows.ts:496-499` turns it into `?from_definition_id=`. The server refuses with 409 at `workflows.py:1230-1231` (T-299-07). "Saves in {Org}" is a hint only. | closed |
| T-299-35 | Tampering | client omits `from_definition_id` | accept | See AR-06. Corroborated by 299-REVIEW IN-01. | closed |
| T-299-36 | Tampering | markup in titles / org names / server sentences | mitigate | The same source-scan result as T-299-28 covers the new and touched expressions. `ForkFailure.sentence` is rendered as React text. The server sentence is limited to `item_org_guard.REFUSALS*` shapes (`item_org_guard.py:38-49`). | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Counts:** 36 total = 29 mitigate + 6 accept + 1 transfer. Open: 0.

### Residual observations (non-blocking; recorded, not mitigation gaps)

| ID | Threat Ref | Observation | Severity |
|----|------------|-------------|----------|
| R-1 | T-299-25 | 299-REVIEW IN-02, still standing. A same-org thread that `/links` answers 200 for, but which the active list does not hold after the one reload (an `is_eval` thread, or past the ~1000-row cap), renders `cant`. If that one reload throws, `LinkGate.tsx:214-218` also lands on `cant` (`.catch` → `finally` "done"). The resolver throw path (the threat's subject) holds and retries correctly. This is a false "can't be opened" on a narrow path, not a disclosure. | low |
| R-2 | T-299-07 / T-299-08 | 299-REVIEW IN-03, still standing. `resolve_active_org_or_none` answers `None` for both "no header" and "membership read failed", so the guards fail open on a transient DB error (by the 298 D-03 polarity). The schedule global-definition fallback then uses the trigger's `LIMIT 1`. The caller is still bounded to their own orgs. | low |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-299-02 | Missing and forbidden are both one primary-key lookup in one constant statement per kind. The residual timing difference is microseconds under network jitter. D-08 forbids an artificial delay. | plan 299-01 threat register (plan-time) | 2026-10-29 |
| AR-02 | T-299-10 | The 409 names the item's org only to a caller who owns or launched the item. Tweak and schedule read the org through `WORKFLOW_ORG_SQL`, which since CR-01 requires current membership. Note: the chat guard's org comes from the caller's own thread row (threads RLS is owner-only, with no membership arm), so a caller who left that org can see its name in the refusal. The caller created that chat in that org, so they learn nothing new. | plan 299-01 threat register (plan-time) | 2026-10-29 |
| AR-03 | T-299-22 | A history ping-pong or double entry is a low-impact UX defect with no data exposure. It is pinned by exact history-length tests (Pitfall 4). | plan 299-02 threat register (plan-time) | 2026-10-29 |
| AR-04 | T-299-30 | After a Switch, the Experts catalog's own server capability refusal renders (Pitfall 9). The resolver stays ungated by design (D-08), because a capability gate on `/links` would add shape. | plan 299-03 threat register (plan-time) | 2026-10-29 |
| AR-05 | T-299-33 | A link is an address, never a grant (UI-D12 "Link", not "Share"). The resolver's per-kind read rule decides who opens it. No code path mints access from a link. | plan 299-04 threat register (plan-time) | 2026-10-29 |
| AR-06 | T-299-35 | If a client omits `from_definition_id`, today's behaviour returns: the draft lands in the validated active org, which is the item's org on any page reached through the prompt. The caller owns the source, so this is not a security boundary. The run and send guards are server-side and unconditional. | plan 299-04 threat register (plan-time) | 2026-10-29 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

None. All five SUMMARY `## Threat Flags` sections say "None", or map every item to T-299-01..36.

The 299-REVIEW security-relevant findings each map to a registered threat, and each was verified fixed at HEAD:

- **CR-01** (schedule stamped into a left org) maps to T-299-08 / T-299-10. Fixed in `dfc135486`: `link_resolver.py:165-166`, pinned by `test_299_write_org_guards.py:368` and live `test_299_review_fixes_live.py:88`.
- **CR-02** (private chat title leak) maps to T-299-04 / T-299-05. Fixed in `0ac730b70`: `link_resolver.py:108`, pinned by `test_299_link_resolver.py:96` and live `:131`.
- **CR-03** (audience over-promise) maps to T-299-32. Fixed in `339338102`.
- **WR-02** (run in a left org) maps to T-299-04. Fixed in `0da754f48`: `link_resolver.py:112`, pinned by `test_299_link_resolver.py:86` and live `:228`.
- **WR-03** maps to T-299-30 / T-299-32. Fixed in `92739897f`, `45fca202c` and `fd27b4ca6`.

---

## Verification Runs (this audit, HEAD `5b05ce7a9`)

- Backend unit: `pytest tests/unit/test_299_link_resolver.py tests/unit/test_299_links_route.py tests/unit/test_299_write_org_guards.py -q` gave **100 passed**.
- Backend live (real local Postgres, rolled back): `pytest tests/integration/test_299_links_live.py tests/integration/test_299_review_fixes_live.py -q` gave **8 passed**, with none skipped.
- Frontend: 22 phase-299 suites (returnTo, appRoutes, appRouteParity, navigationKeepsStreams, LinkGate, CantBeOpened, SwitchOrgPrompt, AppViewSwitch.addressStates, BootScreen, ShareLinkMenu, savesInOrg, shareMounts, useWorkflowLinkTarget, librarySubtree.fences, ExpertCatalogPage.link, useAppNavigation, useAuth, useThreadAddress, clipboard, linkAudience.lockstep, api/links, AuthPage.returnLine) run with `--maxWorkers=2` gave **22 files / 786 tests passed**.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-29 | 36 | 36 | 0 | gsd-security-auditor (Claude), HEAD `5b05ce7a9`, ASVS L1, block_on: high |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-29
