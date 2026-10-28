# Phase 299: Links to the Thing Itself - Research

**Researched:** 2026-10-28
**Domain:** SPA entity routing (react-router 8.5 data mode, one catch-all route), server-side link resolution with existence-hiding 404s, cross-org switch, Supabase Auth return-to-link (supabase-js 2.99.2 implicit flow), boot give-up, list loading state
**Confidence:** HIGH for code-derived facts (every rule below cites file:line in this repo); MEDIUM for Supabase redirect-allowlist fallback (official dashboard text plus one secondary source); LOW only where tagged `[ASSUMED]`

## Summary

All four item kinds can be opened by address without a new router, a new package, or a migration. 297's route table (`frontend/src/lib/appRoutes.ts`) takes three new id-bearing variants (chat, workflows, experts) beside the existing `workflow-run` one. `useAppNavigation` stays the only router-hook caller. The server gets one new read-only router (`GET /links/{kind}/{id}`) that runs one RLS-bound SQL statement per kind on `get_user_pg_connection`, following the `org_items.py` analog. Missing and forbidden then come back as the same zero rows, and so as the same 404.

Five measured facts correct the CONTEXT and will change plan tasks. Each is below with evidence; none reverses a locked decision's intent.
1. **A published workflow is not shared with org members.** Its read rule is owner OR system-global (`full-schema.sql:8968`, `db/workflows.py:951`, `workflow_kickoff.py:238`). The D-20 line "Opens for members of <org> who can see it" would promise more than the rule allows.
2. **A finished workflow run IS readable by every member of its org.** That is the evidence report, `workflow_run_evidence.py:193-203`. So the run rule is "owner, or any org member once finished", not owner only.
3. **System-global workflows have a non-null `org_id`** (`workflow_definitions.org_id uuid NOT NULL`). D-09 has to key off `is_system_global` / `is_system`, not off a null `org_id`.
4. **Switch cannot leave the live stream's subscription intact.** `switchOrg` triggers StreamsProvider's teardown, which aborts every run subscription (`StreamsProvider.tsx:4483-4532`). D-19's "`subscriptionsRef` unchanged" holds for Stay only. For Switch, the honest claim is that the run keeps going on the server and reattaches on switch-back.
5. **The run page has no re-run control.** It ships Stop plus Answer only (`WorkflowRunPage.tsx:47-49`, `:1298`, `:1563`). SC#3's "re-run" can only mean Run from the workflow's library card.

Auth return is simpler than feared. The client uses supabase-js's default **implicit** flow (`#access_token=`), and no PKCE `?code=` is in play. The token is read from `window.location.href` inside the client's own `_initialize`. 297's normaliser leaves every already-canonical address alone and always carries the hash, so it cannot strip tokens. Password sign-in already lands on the address, because the URL never changes. SSO and sign-up need `redirectTo` / `emailRedirectTo` built from origin plus `formatAppRoute(parsed)`, and a sessionStorage copy for the Site-URL fallback. FIX-02 is a single derived flag in `useThreads` (`pending = held === null || held.org !== activeOrgId`). The desktop column already shows the loading line from that flag's slot. On first load the bug is on desktop too, not only mobile: `switching` is false before the first answer (`useThreads.ts:117-118`).

**Primary recommendation:** five plans in three waves. W1 is the backend resolver plus write guards (01), alongside auth return, boot and FIX-02 (05). W2 is entity routes plus the gate plus the in-place card (02). W3 is the switch prompt (03), alongside share plus "saves in" (04). No new npm or PyPI packages, no migration. Every FIRING-file touch is one expression; the logic lives in new modules.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Addresses (LINK-02)
- **D-01:** Four new entity addresses, spelled only in `appRoutes.ts` (297 D-11 rule: one home):
  `/app/chat/<threadId>`, `/app/workflows/<definitionId>`, `/app/runs/<runId>` (exists since 297),
  `/app/experts/<bundleId>`. Ids are strict UUIDs, lowercased (297 D-12). `/app` and `/app/chat` stay
  chat home. The parser stays total and never throws.
- **D-02:** Selecting a thread **pushes** `/app/chat/<id>`; New chat pushes `/app`. Refresh on a thread
  address reopens that thread. The URL → selection binding goes through `useAppNavigation` /
  `AppViewSwitch` (297's extracted modules). ⛔ `StreamsProvider.tsx` is not edited and
  `setViewingThread` keeps its sole writer (297 D-09, L-068-03 gate). No path-derived `key`, no remount
  of `OrgProvider` → `StreamsProvider` → `ChatLayout` (297 D-07).
- **D-03:** `/app/workflows/<id>` opens, for an owned **draft**, the Builder on that draft (the existing
  `onOpenDraft` path). For a **published** workflow the caller can see, it opens the Workflows library
  with that card focused and highlighted (no fork, no write on open). A link never triggers a write.
- **D-04:** `/app/experts/<id>` opens the Experts catalog with that Expert's detail open
  (`ExpertDetailModal`).
- **D-05:** 297's legacy links keep working byte-identically (`/app?run=`, `?connections=1&…`,
  `/admin/spend`, `/setup`, `/invite`) — existing cold-load tests stay green.

#### One resolver on the server (LINK-04, LINK-05, security)
- **D-06:** One new read route, in a **new module** (e.g. `backend/app/api/links.py` + a service), so no
  hot route file grows: `GET /links/{kind}/{id}` → `{kind, id, org_id, org_name, title}` when the caller
  may open the item in **any** org they belong to; otherwise **404 with one fixed body** for every
  reason (missing, deleted, another user's, an org they are not in, a disabled Expert). `main.py` gains
  one `include_router` (honoured by construction).
- **D-07:** Per-kind visibility rule = the rule the item's existing read already applies (thread: owner;
  run: owner, the `workflow_runs` T-092-04 query; workflow: owned draft / visible published /
  system-global; Expert: grant-aware bundle visibility, evaluated per org the caller belongs to). The
  resolver never widens access. Research confirms each rule from code.
- **D-08:** Identical response: same status, same body, same headers for missing and forbidden; both
  arms run the same query shape (one lookup per kind, filtered by caller in the same statement) so
  timing does not separate them. No artificial delay. A 403 never appears on this route (no
  `require_visible`; tier/capability gates that could 403 are not added to it).
- **D-09:** System-global and first-party items (`org_id` null) open in the active org with **no**
  switch prompt.
- **D-10:** The run read gains an additive `org_id` (roadmap flag) — on the model, not as a new branch in
  `workflow_runs.py` (FIRING, "extraction FIRST"); one field, honoured by construction.
- **D-11:** Anon-role test on the new route; caller-is-member checked through `org_members` server-side.
  Threat model in the plan (security_enforcement).

#### Can't be opened (LINK-04) — sketch 299-1 winner B
- **D-12:** The card opens **in place, over the generic area for that kind** (chat history for a thread,
  workflow library for a workflow/run, Experts catalog for an Expert), dimmed, with the address shown and
  a Copy address button. The area behind is never filtered or scrolled toward the item.
- **D-13:** Words name only the kind (from the path), e.g. "This workflow run can't be opened" — never a
  reason, never a title. Identical render for missing and forbidden (drive-proven, as in the sketch).
- **D-14:** 297's `AddressNotFound` (unparseable `/app/...`) moves into the same in-place card ("This
  address doesn't open anything"), so the app has one page. Below 820px the card sits over the main area.
- **D-15:** Never falls back to chat silently.

#### Switch org (LINK-05) — sketch 299-2 winner A
- **D-16:** The prompt **replaces the main area** where the item would open. It shows the item's
  **title** (the resolver returns it only to someone who may open it) plus the org name and colour
  square, worded with 298's vocabulary: "This is in Acme Legal — Switch to Acme Legal / Stay".
- **D-17:** Stay → active org unchanged, any live stream untouched; a bottom chip says the other chat is
  still answering, with "Back to it". Switch → existing `switchOrg`, then the item opens; a line says
  the previous org's chat is still answering, with "Switch back".
- **D-18:** Writes from an item page land in the **item's** org: re-run, fork/Tweak, Continue, start a
  chat from an Expert. Server rule: each such write resolves the org from the item's row, or refuses
  (409 worded) when the request's active org disagrees — never stamps the previously active org. The
  planner inventories every write reachable from the four item pages and lists, per write, "resolves
  from row" (already) or "guard added". Buttons carry "saves in <org>".
- **D-19:** Four-axis UI state applies: a stream live in org A while a link to org B is opened, Stay and
  Switch both leave it intact (`subscriptionsRef` unchanged).

#### Copy link (LINK-03) — sketch 299-3 winner C
- **D-20:** A share popover on each of the four surfaces: chat header, workflow library card (and Builder
  header for a draft), run page header, Expert detail. It shows the address, a Copy button and one
  "who can open it" line derived from the D-07 rule for that kind — thread/run/draft: "Opens only for
  you, on any device you're signed in on"; published workflow / Expert: "Opens for members of <org> who
  can see it". It never promises more than the rule.
- **D-21:** One "✓ Link copied" receipt. The address is the item's own `/app/...` path on
  `window.location.origin`, from `formatAppRoute` — never a token. Real clipboard write, with a
  select-the-text fallback when the clipboard API is refused.

#### Sign-in return and boot (LINK-06) — sketch 299-4 winner A
- **D-22:** Signed out on a link: the sign-in card shows one quiet line under the form — "After you sign
  in, you'll go to a workflow run." Kind only, from the path; never the title.
- **D-23:** The return target is accepted **only** if `parseAppLocation` resolves it to an `/app/...`
  route; the stored/forwarded value is rebuilt from `formatAppRoute` (never echoed). Anything else —
  off-site, `//host`, absolute URL, a non-app path — is dropped: no line, land on chat. No token ever
  rides in the URL.
- **D-24:** Same landing for password, SSO and sign-up. Password keeps the address in place. SSO passes
  `redirectTo` = origin + the rebuilt path; sign-up passes `emailRedirectTo` likewise; a sessionStorage
  copy covers the same-tab round trip. Research confirms how supabase-js `^2.99.2` returns tokens (hash
  vs PKCE `?code=`) and that 297's canonicalization never strips them before the auth client reads them
  (297 Pitfall 10).
- **D-25:** Operator action, on the deploy parity checklist: add `https://app.<domain>/**` and the
  one-box origin to Supabase Auth Redirect URLs. One live SSO round trip on cloud is a G-4 row (or ⛔
  with reason if no SSO provider is configured).
- **D-26:** Boot give-up, one clock: 0–8 s the Iris; 8–20 s "Still connecting…"; after 20 s
  "Can't reach Syrel" + Try again, the link kept. Covers `getSession()` (folds SEED-312: add `.catch`
  setting `loading=false`, and bound the wait) as well as the two existing timed fetches. Thresholds as
  sketched.

#### Chat list loading (FIX-02)
- **D-27:** Mobile chat list (`ChatLayout.tsx:713`) shows the same "Loading your chats…" line desktop
  already shows (`ChatHistoryColumn.tsx:470`) — words, no skeleton; one vocabulary. "No recent chats"
  appears only after a settled empty answer. Desktop's first-load path is re-checked against the
  1,400-thread slow load (BUG-261027-02), not only the org-switch path 298 fixed.

#### Guardrails and plan shape
- **D-28:** G-5: every touch of a FIRING file (`ChatLayout.tsx`, `App.tsx`, `threads.py`,
  `workflow_runs.py`, `ChatHistoryColumn.tsx`, `useThreads.ts`, `WorkflowsPage.tsx`,
  `ExpertCatalogPage.tsx`, `ExpertDetailModal.tsx`, `WorkflowRunPage.tsx`, `main.py`, `useAuth.ts`…) is
  one expression honoured by construction, or the plan takes that file's named seam first. The planner
  reads each file's `docs/HOT-FILE-LEDGER.md` section and runs `node scripts/check-hot-file-ledger.cjs`.
- **D-29:** G-8: target 4-5 plans — (1) resolver + run `org_id` + write-org guard inventory [backend];
  (2) entity routes + can't-be-opened card; (3) switch prompt; (4) share popover on four surfaces;
  (5) sign-in return + boot give-up + FIX-02 (independent; can share a wave). Targeted suites per task,
  full gates once per wave. Backend unit baseline gate (71 failed ceiling) holds.
- **D-30:** G-2 satisfied by the operator-picked sketches (MANIFEST, 2026-10-28).
- **D-31:** G-4 scenarios, set now at scope time (Claude drives in Chrome as the two-org dev account,
  proving the active org first):
  1. Copy link on a thread, open it in a fresh tab → the same thread; refresh stays.
  2. Open a run link from the other org → "This is in <org> — switch?"; Stay with a chat answering in
     the current org → org unchanged, answer still streaming; Switch → the run opens.
  3. A made-up UUID and a real id belonging to another user → the same card, same words; network shows
     the same 404 body.
  4. Signed out, open a workflow run link → the quiet line → sign in → land on the run. An off-site
     return target lands on chat.
  5. Throttle network → the chat list says "Loading your chats…", never "No recent chats"; block Auth
     → boot shows "Still connecting…" then "Can't reach Syrel" + Try again.

### Claude's Discretion
- Resolver module names, response model name, the exact 404 body text.
- Copy-to-clipboard fallback mechanics; popover component reuse (existing popover primitive).
- Where the switch-prompt state lives (inside `useAppNavigation` vs a small sibling hook), provided no
  router hooks reach leaf components (297 D-08).

### Folded seeds and bugs
- **SEED-178** (thread does not survive reload) — discharged by D-01/D-02.
- **SEED-015** (per-thread URL routing) — discharged by D-01/D-02 + D-20.
- **SEED-312** (boot waits on un-timed `getSession`) — discharged by D-26.
- **BUG-261027-02** (No recent chats while loading) — discharged by D-27.

### Deferred Ideas (OUT OF SCOPE)
- **298 WR-08** (Builder "lives in <org>" marker relative to the viewer's org) — reviewed, **deferred**:
  with D-16 every link open makes the viewer's org equal the item's org, so the residual case is a
  Builder left open across a manual switch — a wrong hint, never a wrong write (ORG-05 refusal is keyed
  on the row). Re-open: the next phase whose `files_modified` names `useBuilderNameMaps.ts` or
  `db/workflows.py`.
- Skill-studio tab in the URL (297 D-11 note) — not in LINK-02's four kinds.
- Public / outside-org share links, link expiry — new capability.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LINK-02 | Thread, workflow, run, Expert each have their own address; refresh returns to the same item | §Pattern 1 (route variants in `appRoutes.ts`), §Pattern 3 (thread URL⇄selection binding without touching StreamsProvider), §Pattern 4 (workflow and Expert open-by-id hooks) |
| LINK-03 | Copy a link; it opens the same item in a new tab or on another signed-in machine; legacy links keep working | §Pattern 6 (share surface on DropdownMenu, no new package), §Code Example "clipboard"; legacy cold-load tests listed under §Validation; D-20 copy corrected by Finding F1/F2 |
| LINK-04 | Missing and forbidden show one identical "can't be opened" page, never chat | §Pattern 2 (resolver: one statement per kind, same 404), §Pattern 5 (in-place card), Pitfall 1 (T-297-09 no-echo vs D-12 address display) |
| LINK-05 | A link into another of the user's orgs asks before switching; nothing saved under the wrong org | §Pattern 5 (LinkGate state machine), §Write inventory (D-18), Finding F4 (Switch tears down subscriptions) |
| LINK-06 | Password / SSO / sign-up land on the link; boot cannot hang forever | §Pattern 7 (implicit flow, `redirectTo`, `emailRedirectTo`, sessionStorage resume), §Pattern 8 (boot clock, SEED-312) |
| FIX-02 | Chat list shows a loading state, not "No recent chats", while threads load | §Pattern 9 (`pending` flag in `useThreads`; desktop first load is broken too) |
</phase_requirements>

## Measured findings that correct CONTEXT (planner must carry these into PLAN.md)

| # | CONTEXT says | Code says (evidence) | Recommended handling |
|---|--------------|----------------------|----------------------|
| F1 | D-20: published workflow "Opens for members of <org> who can see it" | Workflow SELECT RLS is `is_system_global = true OR (org_id IN current_user_org_ids() AND auth.uid() = created_by)` (`supabase/full-schema.sql:8968`); `get_definition` reads `created_by = $2 OR (is_system_global AND status='published')` (`backend/app/db/workflows.py:951`); kickoff reads `is_system_global.eq.true,created_by.eq.<caller>` (`backend/app/services/workflow_kickoff.py:238`). **No org-member arm exists.** | Published (non-global) workflow → "Opens only for you, on any device you're signed in on". System-global → "Opens for anyone signed in to Syrel" `[ASSUMED wording]`. Never the org-members line for workflows. |
| F2 | D-07/D-20: run = owner only | `GET /workflow-runs/{id}` is owner-only (`workflow_runs.py:1064-1065`), BUT a 404 there renders `RunEvidenceReport` (`WorkflowRunPage.tsx:1151-1160`), whose access SQL is `status IN ('completed','failed','cancelled') AND (user_id = $2 OR EXISTS org_members m WHERE m.org_id = wr.org_id AND m.user_id = $2)` (`workflow_run_evidence.py:193-203`). | Resolver run rule = owner (any status) OR (terminal status AND caller is a member of the run's org). Share line: active run → "Opens only for you…"; finished run → "Opens for members of <org>". The resolver returns an `audience` field so the line is never derived twice. |
| F3 | D-09: "System-global and first-party items (`org_id` null)" | `workflow_definitions.org_id uuid NOT NULL` even for system-global rows (full-schema, table def). `expert_bundles.org_id` IS nullable and `is_system` rows may have it null (`CHECK (is_system OR org_id IS NOT NULL)`). | Resolver returns `org_id: null, org_name: null` whenever `is_system_global` (workflow) or `is_system` (Expert) is true. The client prompts only on a non-null `org_id` ≠ active org. |
| F4 | D-19: Stay AND Switch leave `subscriptionsRef` unchanged | `switchOrg` → `activeOrgId` change → StreamsProvider effect #5 aborts EVERY run subscription and clears `subscriptionsRef` (`frontend/src/providers/StreamsProvider.tsx:4483-4532`, Phase 166 D-166-08 / WR-02). StreamsProvider may not be edited (D-02). | Four-axis assertion splits: **Stay** → `subscriptionsRef.size` unchanged, no AbortError. **Switch** → the server-side run keeps running (DB `runs.status` not cancelled) and reattaches when the person switches back and reopens the thread. The "still answering · Switch back" line is a snapshot of `useStreamsStore.getState().streamingThreads` taken *before* `switchOrg` (a read of `stores/streamsStore.ts`, not an edit of the provider). Reattach-on-return is `[ASSUMED]`: drive it in G-4 row 2. |
| F5 | SC#3 / D-18: "re-run" from the run page | The run page ships only Stop (`WorkflowRunPage.tsx:1298`) and Answer (`PendingAskCard`, `:1563`); its header comment says it ships "zero run-mutating ones" besides those (`:47-49`). | Do NOT add a re-run control (that is a new capability). "Re-run" = **Run** on the workflow's library card (the page a workflow link opens). Record this in CONTEXT as an amendment. |
| F6 | D-12: card shows the address | `AddressNotFound` invariant: "⛔ No path prop and no icon — the requested address is never echoed (T-297-09)" (`docs/HOT-FILE-LEDGER.md` §AddressNotFound; `AddressNotFound.tsx:13-14`). | Show the address ONLY when it parsed to an entity route, rebuilt with `formatAppRoute` (fixed vocabulary + lowercase hex UUID, so nothing attacker-chosen is shown). An unparseable address shows no address line and no Copy button. This satisfies D-12 and T-297-09 together. |
| F7 | D-02: "New chat pushes `/app`" | New chat creates a real thread immediately: `newThread` → `createThread("New Chat")` → `setSelectedThread(thread)` (`useThreads.ts:88-93`), wired to the rail's "+" and the column's New chat (`ChatLayout.tsx:604,629`). | New chat pushes `/app/chat/<newId>`. Pushing `/app` while a thread is selected would recreate SEED-178 (refresh loses the new chat). `/app` stays the address of "no thread selected" (Back to it shows the empty composer). Confirm at plan time. |
| F8 | D-16: "org name and colour square" | Orgs have no colour field (`public.organizations` has `name, slug, subscription_tier, add_ons, settings`). The 298 chip is `OrgAvatar({initial})`, a gradient square (`frontend/src/components/org/OrgIdentity.tsx:68,84`). | Use `OrgAvatar` with the org's initial. Do not invent a per-org colour. |
| F9 | D-20: "existing popover primitive" | No `@radix-ui/react-popover` in `frontend/package.json`. The repo's floating surfaces are `DropdownMenuContent` (e.g. `ScopePicker.tsx:21-26,194`) or `Dialog`. | Build the share surface on `DropdownMenu` + `DropdownMenuContent` (no new package). The text fallback uses `Selection.selectAllChildren` on a `user-select: all` `<code>` (no focusable input, which a Radix menu fights; see memory `reference_radix_menu_focus_kills_inline_editor`). |
| F10 | Ledger | `useAuth.ts` (5/**4**/100), `lib/api/_core.ts` (6/**4**/299), `lib/supabase.ts` (4/2/85), `SignInForm.tsx` (3/2/163), `SignUpForm.tsx` (1/0/84) and `useWorkflowFork.ts` (3/1/517) have **no ledger row**. `useAuth.ts` and `_core.ts` already FIRE at 4 phases. Every new file also needs a row (gate run: `[no-row] frontend/src/lib/links.ts`). | Add rows plus sections in the same commit as the first touch. Prefer designs that leave `SignInForm`/`SignUpForm` untouched (Pattern 7 does). |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Path vocabulary (parse/format entity addresses) | Browser (pure leaf `appRoutes.ts`) | — | 297 D-11: one home, no React, never throws |
| URL ↔ view/entity derivation, push/replace | Browser (`useAppNavigation`, only router-hook caller) | — | 297 D-08 |
| "May this caller open item X, and in which org?" | API (`GET /links/{kind}/{id}`) | Database (RLS on user-JWT connection) | Visibility is a security rule; never decided client-side |
| Existence hiding (missing ≡ forbidden) | API | Database (one statement per kind) | Same status/body/headers/query shape (D-08) |
| Switch prompt / Stay / Switch | Browser (LinkGate under OrgProvider) | — | Needs `useOrg()` (below App), so it cannot live in `useAppNavigation` |
| Writes land in the item's org | API (row-derived org or 409) | Database (RLS insert checks) | D-18: never trust the client's active org for an item page write |
| Return-to-link target validation | Browser (pure leaf `lib/returnTo.ts`) | Auth server (Redirect URL allow-list) | Client rebuilds from `formatAppRoute`; GoTrue enforces the allow-list |
| Token handling after SSO / email confirm | Auth client (supabase-js `_initialize`) | — | Implicit flow; app must not touch the hash |
| Boot give-up clock | Browser (`BootScreen` + bounded `getSession`) | — | Purely a client wait |
| Chat list loading vs empty | Browser (`useThreads` derived flag) | — | The list answer's org tag is client state |

## Standard Stack

### Core (all already installed — nothing new)
| Library | Version (verified) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-router | 8.5.0 | `useLocation`/`useNavigate`/`useBlocker` inside `useAppNavigation` only | Already the router (297 D-04) `[VERIFIED: frontend/package.json:51]` |
| @supabase/supabase-js / @supabase/auth-js | 2.99.2 / 2.99.2 | `signInWithSSO({domain, options:{redirectTo}})`, `signUp({email,password,options:{emailRedirectTo}})`, implicit-flow callback | `[VERIFIED: node_modules/@supabase/*/package.json]` |
| @radix-ui/react-dropdown-menu | ^2.1.16 | Share surface + ⋯ menu item | Repo precedent for floating surfaces `[VERIFIED: package.json:23]` |
| FastAPI + asyncpg | (repo) | New `links` router; SQL on `get_user_pg_connection` | `org_items.py` analog (298) `[VERIFIED: backend/app/api/org_items.py:13-31]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DropdownMenu share surface | `@radix-ui/react-popover` | A new package means a provenance and slopcheck gate plus an install serialized against the junctioned `node_modules` (297 D-39). Not worth it for one surface. |
| Resolver SQL on user-JWT connection | Service-role pool + hand predicates | Loses the RLS backstop. `org_items.py` chose RLS deliberately. |
| `window.location.reload()` for "Try again" | Re-bind supabase listeners in place | A hung GoTrue refresh holds the auth lock (`GoTrueClient.js:1264-1271`). Reload is the honest reset, and it keeps the URL, so the link is kept. |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed by this phase, so slopcheck was not run. Every library used is already in `frontend/package.json` or the backend venv.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to slopcheck [SLOP] verdict:** none. **Packages flagged [SUS]:** none.
If the planner picks `@radix-ui/react-popover` instead of the DropdownMenu surface, that install needs a `checkpoint:human-verify` and a 297 D-39-style provenance check.

## Architecture Patterns

### System Architecture Diagram

```
 address bar (/app/chat/<id> | /app/workflows/<id> | /app/runs/<id> | /app/experts/<id>)
        │
        ▼
 main.tsx: ONE catch-all route ──► App ──► useAppNavigation()  ◄── only router-hook caller
        │                                   parseAppLocation → {view, entityId}
        │                                   canonicalAddress (never touches #hash)
        │
        ├── signed out? ──► AuthPage (+ quiet line from returnTo.kindOf(path))
        │                     ├─ password: URL unchanged → lands in place
        │                     ├─ SSO: redirectTo = origin + formatAppRoute(parsed) ; sessionStorage copy
        │                     └─ sign-up: emailRedirectTo = same
        │                    GoTrue ──(allow-listed?)──► back to /app/... #access_token  (else Site URL → resume from sessionStorage)
        │
        ├── booting? ──► BootScreen (0–8 s Iris · 8–20 s "Still connecting…" · >20 s "Can't reach Syrel" + reload)
        │
        └── signed in ──► OrgProvider ─► StreamsProvider ─► ChatLayout ─► AppViewSwitch
                                                                │
                                                                ▼
                                       LinkGate(kind, id)  ── GET /links/{kind}/{id} ──► links.py
                                         │                                              │ one SQL per kind
                                         │                                              │ (user-JWT, RLS)
                                         │   404 (missing ≡ forbidden) ◄────────────────┤
                                         │   200 {org_id, org_name, title, audience} ◄──┘
                                         ▼
                 ┌───────────── decision ──────────────┐
                 │ 404 → CantBeOpened card over the     │
                 │       generic area of that kind      │
                 │ org_id && org_id ≠ active → Switch   │──Stay──► replace back / chat, "Open it after all"
                 │       prompt (replaces main area)    │──Switch─► switchOrg() → lists refetch → item opens
                 │ else → open item:                    │
                 │   thread → select thread             │
                 │   draft  → Builder (onOpenDraft)     │
                 │   published → library, card focused │
                 │   run → WorkflowRunPage              │
                 │   Expert → catalog + detail modal    │
                 └──────────────────────────────────────┘
 item-page writes ──► server resolves org from the ROW, or 409 if the active org disagrees
```

### Recommended Project Structure (new files only)
```
backend/app/api/links.py                         # GET /links/{kind}/{id}; _require_bearer; one 404 body
backend/app/services/link_resolver.py            # one SQL per kind, audience rule, org name
backend/app/services/item_org_guard.py           # refuse_if_other_org(row_org, active_org, detail) — D-18 helper
backend/tests/unit/test_299_link_resolver.py     # SQL shape, per-kind rules, identical 404, audience
backend/tests/unit/test_299_links_route.py       # 401 without bearer, 404 body/headers identical, no 403/422
backend/tests/unit/test_299_write_org_guards.py  # send_message / kickoff / ask_user / create_draft(from)
frontend/src/lib/returnTo.ts                     # pure leaf: returnTarget(path, search), kindOf(...), remember/take
frontend/src/lib/clipboard.ts                    # copyText(text) → "copied" | "refused"
frontend/src/lib/api/links.ts                    # resolveLink(kind, id) client (X-Org-Id irrelevant to the answer)
frontend/src/components/layout/BootScreen.tsx    # the 3-stage clock
frontend/src/components/layout/LinkGate.tsx      # resolves + decides (hooks OK here; AppViewSwitch stays hook-free)
frontend/src/components/layout/CantBeOpened.tsx  # the one in-place card (absorbs AddressNotFound S1 copy)
frontend/src/components/layout/SwitchOrgPrompt.tsx
frontend/src/hooks/useThreadAddress.ts           # URL⇄selection binding for threads
frontend/src/components/workflows/library/useWorkflowLinkTarget.ts
frontend/src/components/share/ShareLinkMenu.tsx  # trigger + DropdownMenuContent body + receipt
```

### Pattern 1: Entity variants in the route table (D-01)
**What:** extend `AppRoute` with optional entity ids on existing views. No new `ActiveView` member, so `VIEW_PATHS` (keyed by the union, `appRoutes.ts:48-61`) and the reachability route leg stay intact.
**Example:**
```ts
// frontend/src/lib/appRoutes.ts — Source: existing file shape (297-02)
export type AppRoute =
  | { view: "workflow-run"; runId: string }
  | { view: "skill-studio"; skillId: string }
  | { view: "chat"; threadId: string }          // 299
  | { view: "workflows"; definitionId: string } // 299
  | { view: "experts"; bundleId: string }       // 299
  | { view: Exclude<ActiveView, "workflow-run" | "skill-studio"> }

// viewOf(): beside the existing `runs`/`skills` id arms (appRoutes.ts:121-122)
if (head === "chat" && isStrictUuid(id)) return { view: "chat", threadId: id.toLowerCase() }
if (head === "workflows" && isStrictUuid(id)) return { view: "workflows", definitionId: id.toLowerCase() }
if (head === "experts" && isStrictUuid(id)) return { view: "experts", bundleId: id.toLowerCase() }
```
Exact-equality fences that must stay green: `parseAppLocation("/app","")` and `("/app/chat","")` → `{ view: "chat" }` (`appRoutes.test.ts:70-71,80,189`). Keep the id-less variant id-free (do not add `threadId: undefined`). The bare-prefix path `/chat/<id>`, `/workflows/<id>`, `/experts/<id>` normalises to `/app/...` by D-13 automatically (`BARE_PREFIXES`, `:68`).
`useAppNavigation` additions: derive `threadId` / `workflowId` / `expertId` from `parsed` (as `runId` is at `:103`), keep `lastThreadId` like `lastRunId` (`:109,113`), and add navigators `openThread(id)`, `openWorkflow(id)`, `openExpert(id)` (all `go(...)`). `handleNavigate("chat")` goes to `/app/chat/<lastThreadId>` when one exists, else `/app` (mirrors the `workflow-run` arm at `:321-325`). Pass them to ChatLayout as **one** prop object (e.g. `entityLink={nav.entityLink}`) so App.tsx gains one expression.

### Pattern 2: The resolver: one statement per kind, RLS-bound, identical 404 (D-06..D-11)
**What:** `backend/app/api/links.py`, a copy of the `org_items.py` posture: router-level `_require_bearer` (401 without a credential, `org_items.py:75-89`); SQL on `get_user_pg_connection(request, current_user)` (`dependencies.py:889-896`), so `auth.uid()` is the caller and RLS backs every predicate. Validate `kind ∈ {thread, workflow, run, expert}` and the strict UUID **inside the handler**, raising the same 404. Do NOT type the path param as `UUID`: FastAPI would 422 a malformed id, which is a different status. Never depend on `get_active_org_id` (400s a header-less two-org caller, `dependencies.py:945-949`), `require_capability` (resolves the active org via that gate, `entitlement_service.py:132-145`) or `require_visible` (403).

**Per-kind rules, from code:**

| Kind | Existing read it mirrors | Resolver predicate (same statement for both arms) |
|------|--------------------------|----------------------------------------------------|
| thread | `get_thread`: `.eq("id").eq("user_id", caller)` on the user client (`threads.py:1047-1063`) | `t.id = $1 AND t.user_id = auth.uid()`; RLS adds the org-membership arm |
| run | `read_workflow_run` owner (`workflow_runs.py:1046-1066`) ∪ evidence access (`workflow_run_evidence.py:193-203`) | `wr.id = $1 AND (wr.user_id = auth.uid() OR (wr.status IN ('completed','failed','cancelled') AND EXISTS (SELECT 1 FROM org_members m WHERE m.org_id = wr.org_id AND m.user_id = auth.uid())))` |
| workflow | `get_definition` (`db/workflows.py:951`) + RLS (`full-schema.sql:8968`) | `d.id = $1 AND (d.created_by = auth.uid() OR (d.is_system_global AND d.status = 'published'))` |
| expert | `get_expert_bundle_by_id` (`db/experts.py:147-165`) + `check_expert_grant_access` (`:309-337`) + the disabled-hides rule (`api/experts.py:595-598`) | below |

```sql
-- expert: evaluated per org the caller belongs to (the bundle's own org), never the active org
SELECT b.id, b.name AS title, b.is_system, b.visibility,
       CASE WHEN b.is_system THEN NULL ELSE b.org_id END AS org_id,
       CASE WHEN b.is_system THEN NULL ELSE o.name  END AS org_name
FROM public.expert_bundles b
LEFT JOIN public.organizations o ON o.id = b.org_id
WHERE b.id = $1
  AND (
        b.is_system
     OR EXISTS (
          SELECT 1 FROM public.org_members m
          WHERE m.org_id = b.org_id AND m.user_id = auth.uid()
            AND ( b.visibility IN ('org','public')
               OR b.created_by = auth.uid()
               OR ( b.visibility = 'granted' AND EXISTS (
                      SELECT 1 FROM public.expert_grants g
                      WHERE g.expert_id = b.id
                        AND ( (g.grantee_type = 'user' AND g.grantee_id = auth.uid()::text)
                           OR (g.grantee_type = 'role' AND g.grantee_id = m.role) ))))
        )
      )
  AND (b.is_enabled OR public.current_user_has_permission(b.org_id, 'experts:manage'))
```
Notes. The role used for a role grant is the caller's role **in the bundle's org** (`m.role`). That is what "evaluated per org" means; today's `get_expert` uses the active-org role (`api/experts.py:583`). `current_user_has_permission` is mig 104's SECDEF helper, called as the caller (`dependencies.py:878-896`). A disabled system bundle has a NULL `org_id`, so the permission check returns false and the bundle stays hidden. That matches `get_expert` for a non-manager. `[VERIFIED: codebase]`; the SQL as a whole is `[ASSUMED]` until the TDD RED drive runs it on local Postgres.

**Response model (Claude's discretion):** `LinkTarget{kind, id, org_id: UUID|None, org_name: str|None, title: str, state: "draft"|"published"|None, audience: "only_you"|"org_members"|"granted"|"everyone"}`. `state` lets D-03 choose Builder or library without a second read. `audience` feeds D-20 from the same row. One fixed 404: `{"detail": "Not found"}` (one constant, reused by every arm, never `str(exc)`).

**Timing:** every arm is a primary-key lookup plus predicate on the same statement. For a nonexistent id the index miss is a little cheaper than evaluating the EXISTS arms on a row that exists and is refused. The gap is microseconds, far under network jitter. D-08 accepts no artificial delay. Record it as a residual in the threat model.

### Pattern 3: Thread address ⇄ selection without touching StreamsProvider (D-02)
**Facts:** ChatArea is the sole `setViewingThread` caller, fed by the `thread` prop (`ChatArea.tsx:464,575`). The prop is `useThreads().selectedThread` (`ChatLayout.tsx:135`, passed at `AppViewSwitch.tsx` chat branch). The ledger requires `selectThread` to stay a bare `setState` (`HOT-FILE-LEDGER.md` §useThreads 298-04). `useThreads` lists ALL of the active org's threads with no limit (`threads.py:270-303`), so the URL id can be found in `threads` once the list settles.
**Design:** a new hook `useThreadAddress({ threadId, entityLink, threads, threadsPending, selectedThread, selectThread })`, called ONCE in ChatLayout:
1. **URL → selection** (deps: `threadId`, `threadsPending`; read `threads` via a ref so a list refetch cannot re-fire it). When `threadId` is set, the list has settled for the active org, and the selection differs: select `threads.find(id)`. If it is absent, hand the id to the LinkGate (the resolver decides between card and switch prompt). When `threadId` goes from X to null on the chat view (Back to `/app`), call `selectThread(null)`.
2. **selection → URL** (deps: `selectedThread?.id`, chat view only). A selection made programmatically by `newThread` (New chat, first send) pushes `/app/chat/<id>`. A deselect while the URL holds a thread replaces with `/app`.
3. Replace the programmatic `selectThread(t); onNavigate("chat")` pairs with one `openThread(t)` call (= select + `entityLink.openThread(t.id)`). They are at `ChatLayout.tsx:156-157` (threadNavigation), `:494-496` (doRun) and `AppViewSwitch.tsx:501-503` (startScopedChat deps). One push per action, no double entry. The history column and mobile list pass `pickThread` (select + push).
**While pending:** with a thread address and the list not yet settled, render the holding state in the main area, never ChatArea with `thread=null`. Otherwise a keystroke in the welcome composer would create a new thread and the binding would overwrite the link's address.

### Pattern 4: Opening a workflow / Expert by id (D-03, D-04)
- **Workflows:** `WorkflowsPage` gains ONE optional prop (`linkedDefinitionId`) and ONE hook call, `useWorkflowLinkTarget({ id, state, drafts, rows, onOpenDraft })`. The hook lives in `components/workflows/library/` (if it sits there it must join `LIBRARY_SUBTREE_PATHS` in `librarySubtree.fences.test.ts`, the 298-04 precedent, and never import the page). Draft → `onOpenDraft(draft)` (`WorkflowsPage.tsx:562-576`; it needs the row's `token`, which only the drafts list carries). Published → scroll the card into view, focus it and mark it. `WorkflowCard` root carries `data-provenance` but no id (`WorkflowCard.tsx:1023-1025`), so add ONE `data-row-id={row.id}` attribute (honoured by construction). Keep the highlight classes inside the hook file so Tailwind sees them. Pitfall: a project filter or shelf can hide the card, so the hook clears the project filter (the `onOrgSwitch` reset precedent) before focusing.
- **Experts:** `ExpertCatalogPage` gains ONE optional prop (`openBundleId`). A hook sets `inspected` (`ExpertCatalogPage.tsx:100`) to the list's row once the list loads; if the row is absent, it calls `getExpert(id)` (`lib/api/experts.ts:234`). The modal is already controlled by `inspected` (`:351-356`).

### Pattern 5: LinkGate: one decision point under OrgProvider (D-12..D-17)
`AppViewSwitch` must stay hook-free (ledger §AppViewSwitch "⛔ No hooks"), so the gate is a **component** it mounts. The gate takes `{kind, id, activeOrgId}` (activeOrgId from `useOrgOptional()`; wait while it is null on a fresh device, `OrgProvider.tsx:123-135`) and holds `resolving | open | cant | prompt | stayed`. A `stayed` state shows "You stayed in <org>. The link wasn't opened. · Open it after all" over the previous surface (sketch 299-2 A, `index.html:155`).
- **Generic area behind the card (D-12):** thread → chat area plus history column (unfiltered, unscrolled). Workflow and run → `WorkflowsPage` with no linked id. Expert → `ExpertCatalogPage` with no open id. The run case renders the library, not `WorkflowRunPage`. Then check the rail highlight (297 D-43 left Chat highlighted for S1, and `NavPanel.tsx` derives it from `activeView`).
- **Unparseable address (D-14):** the same card, heading "This address doesn't open anything", no address line (F6). ⛔ The admin-refusal arms (`AppViewSwitch.tsx:379,453`) must render the SAME words as an unknown address (T-297-07). They keep importing the one copy constant.
- **Prompt (D-16):** title from the resolver, `OrgAvatar` square, "This is in {org}" with buttons `switchToLabel(org)` / "Stay in {current}" (298 `orgItemsCopy.ts`). Switch first snapshots `streamingThreads` from `useStreamsStore` (F4), then calls `switchOrg`. The lists refetch (298 D-08), and the gate re-evaluates once `activeOrgId === target.org_id`.

### Pattern 6: Share surface (D-20, D-21)
One `ShareLinkMenu({ kind, id, audience, orgName })` component: a trigger button, a `DropdownMenuContent` body (address in `<code class="select-all">`, a Copy button, the audience line), and a `role="status"` receipt "✓ Link copied". The address is `window.location.origin + formatAppRoute(route)`. Clipboard follows the shipped idiom with an explicit failure arm (`components/panel/FilePreview.tsx:353-404`). On refusal, call `getSelection().selectAllChildren(codeEl)` and say "Press Ctrl+C to copy". Mounts, one each: chat header after the `<h2>` (`ChatArea.tsx:1043`); the library card ⋯ menu (one `DropdownMenuItem`, the `MoveToOrgMenuItem` pattern at `WorkflowCardMenu.tsx:295`); the Builder header (the `WorkflowsPage.tsx` builder branch, `:775-797`); the run page header (`WorkflowRunPage.tsx` header, `:1197-1300`); the Expert detail (`ExpertDetailModal.tsx` `DialogHeader` `:243-276`). Audience wording per F1/F2 (thread/draft/own published/active run → "Opens only for you, on any device you're signed in on"; finished run, `org`/`public` Expert → "Opens for members of {org}"; `granted` Expert → "Opens for the people it's shared with in {org}"; system → "Opens for anyone signed in to Syrel"). Each surface without a resolver answer in hand derives the audience from the row it already holds, using the same pure function the backend's `audience` mirrors. Put that function in one leaf and pin it with a shared fixture.

### Pattern 7: Return to the link (D-22..D-25)
**Token delivery, verified in the installed source:**
- `createClient(url, key)` is called with no `auth` options (`frontend/src/lib/supabase.ts:36-39`, re-created at `:75`). auth-js defaults to `flowType: 'implicit'` and `detectSessionInUrl: true` (`node_modules/@supabase/auth-js/dist/module/GoTrueClient.js:19,21`).
- The constructor auto-calls `initialize()` (`:203-207`). `_initialize` reads `parseParametersFromURL(window.location.href)`, which merges the hash and the query, with the query winning (`lib/helpers.js:66-85`). If `access_token` is present, `_getSessionFromURL` validates it with a network `_getUser` and clears the hash with a raw `window.location.hash = ''` (`GoTrueClient.js:1706`). PKCE (`?code=` + a stored verifier) is never taken because no verifier is ever stored.
- 297's normaliser returns `null` for an already-canonical path with unknown params (`appRoutes.ts:189-190`) and carries `location.hash` on every replace it does make (`useAppNavigation.ts:160`). So it cannot strip the token in either order of execution. The WR-01 `idx` stamp (`useAppNavigation.ts:117-146`) already handles the history entry the raw hash clear creates.
- `signInWithSSO` sends `redirect_to: params.options.redirectTo` and itself calls `window.location.assign(url)` unless `skipBrowserRedirect` (`GoTrueClient.js:1148-1167`). `useAuth` also assigns `href` (`useAuth.ts:77`), which is harmless. `signUp` forwards `options.emailRedirectTo` as `redirectTo` (`GoTrueClient.js` signUp, ~`:550`).
- If `redirect_to` is not on the Redirect URLs list, GoTrue uses the **Site URL** instead `[CITED: supabase.com dashboard "URL Configuration": "the default redirect URL used when a redirect URL is not specified or doesn't match one from the allow list"]` `[MEDIUM]`. Hence the sessionStorage copy.
**Design (no change to `SignInForm`/`SignUpForm`, which are unledgered and whose test pins `signInWithSSO("ssocorp.com")` exactly, `SignInForm.test.tsx:70`):**
- `lib/returnTo.ts` (pure leaf). `returnTarget(pathname, search)` returns `formatAppRoute(parsed)` only when `parseAppLocation` yields an `AppRoute`, else `null`. `kindWord(parsed)` returns "a chat" / "a workflow" / "a workflow run" / "an Expert" for entity routes only. `remember(path)` / `take()` use sessionStorage with a TTL (e.g. 15 min) and re-validate through `returnTarget` on read.
- `useAuth.signInWithSSO(domain)` computes `redirectTo = origin + returnTarget(location)` internally, calls `remember`, then signs in. `signUp(email, password)` passes `emailRedirectTo` the same way (falling back to `origin + "/app"`). `useAuth` reads `window.location` itself. It is not a router hook, so D-08 holds.
- `AuthPage` renders the quiet line under the form from `kindWord(parse(window.location))`. App needs no prop.
- **Resume:** after sign-in, the LinkGate (it mounts only when signed in) calls `entityLink.resume()` once. The hook does `take()` and, only if the address on screen is chat home (`/` or `/app`), REPLACEs it with the stored target. Password sign-in never needs it, because the URL never left.
- **Operator parity (D-25):** `docs/OPERATOR.md:550-554` already lists `https://app.<domain>/**` and `https://<domain>/**` under Redirect URLs. Add the one-box origin, and add a line to `docs/DEPLOYMENT-WORKFLOW.md` §5. Local Supabase CLI config is **not in the repo** (`find` for `config.toml` returned nothing), so the local allow-list is unknown. Read it before the G-4 SSO row (Open Q2).

### Pattern 8: Boot give-up (D-26, SEED-312)
- Today the splash shows while `loading || setupStatus === null` (`App.tsx:227-237`). `setupStatus` comes from `hydrateSupabaseFromRuntime` (10 s timeout, `supabase.ts:64`) followed by `getSetupStatus` (10 s, `lib/api/admin.ts:971`). Both fall through on failure, so the worst case is about 20 s and then the app proceeds. `loading` clears only inside `getSession().then` with no catch (`useAuth.ts:38-42`). `getSession` awaits `initializePromise` plus the auth lock (`GoTrueClient.js:1264-1271`), and on an SSO return that includes a network `_getUser`.
- `useAuth`: wrap with `.catch(() => setLoading(false))` and race a bound. On timeout, set `stalled=true` but keep `loading` true. Never set `user=null` on a timeout: that would show the sign-in form to a signed-in person.
- `BootScreen` owns one clock from its mount, which is the start of the wait: `<8 s` the Iris (today's markup verbatim, `role="status" aria-label="Loading Syrel"`), `8–20 s` "Still connecting…", `>20 s` "Can't reach Syrel" + **Try again** = `window.location.reload()` (keeps the URL, so the link survives; not a History write, so `noRawHistoryWrites.test.ts` stays green). If the wait ends at any stage, the app proceeds normally. App.tsx change: the splash JSX becomes `<BootScreen />` (one expression).

### Pattern 9: FIX-02 is one derived flag
`useThreads` holds `held: {org, rows} | null`. `switching = held !== null && held.org !== activeOrgId` is **false before the first answer** (`useThreads.ts:117-118`), so desktop also shows "No recent chats" on first load. The ledger records this deliberately: "first paint unchanged… BUG-261027-02 stays for 299" (§useThreads 298-04). Add `pending = held === null || held.org !== activeOrgId`. In ChatLayout, pass `loading={threadsPending}` to `ChatHistoryColumn` (replacing `threadsSwitching`, `ChatLayout.tsx:136` and the column prop), so `ChatHistoryColumn.tsx` is **not modified**. Add the loading arm to the mobile ternary (`ChatLayout.tsx:711-714`) with `SyrelLoader` and `LOADING_CHATS` (`orgItemsCopy.ts:13`). A failed first load still settles to `[]` (WR-03, `useThreads.ts:75-78`) and shows the empty sentence after the 2 s retry. That is pre-existing behaviour; note it, do not widen the phase.

### Write inventory: what D-18 requires the planner to list

| Write reachable from an item page | Endpoint (file:line) | Org today | Verdict |
|---|---|---|---|
| Send / Continue typing in a thread | `POST /threads/{id}/messages` (`threads.py:1777`) | Messages and run stamped with the **active** org (`:1819-1821`, `:1889-1890`, `:2001`); the thread-org guard runs only for Expert threads (`_require_thread_org`, `:833-845`, call at `:1835-1836`) | **Guard added:** when the active org resolves and ≠ `thread.org_id`, 409 "Switch to this chat's organization to keep chatting." Header-less callers are unchanged (polarity, 298 D-03) |
| Deep / harness Continue | `POST /runs/{id}/continue` (`runs.py:1239`) | From the run row (`runs.py:1256-1260`, `:1692-1695`) | Resolves from row |
| Answer an ask (run page / panel) | `POST /runs/{id}/ask_user_response` (`runs.py:933`) | The message insert carries no `org_id` (`runs.py:1073-1088`), so the `autofill_org_id_by_owner` LIMIT-1 trigger stamps it (mig 106 `messages_autofill_org_id`): the wrong org for a two-org user | **Guard added:** stamp `org_id` from the run row (add `org_id` to the `:951` select; one key in the insert) |
| Stop | `cancelRun` → `DELETE /runs/...` (`runs.py:1798`) | Updates the existing row | Resolves from row |
| Run (library card / RunModal → `doRun`) | `POST /threads` then `POST /threads/{id}/messages` with `workflowDefinitionId` → `preflight_workflow_kickoff` (`workflow_kickoff.py:126`) | Thread stamped with the active org (`threads.py` create ~`:968-972`); the run inherits the thread's org; the definition's org is never compared (`workflow_kickoff.py:234-258`) | **Guard added:** in preflight, for a non-global definition with `_def_row.org_id` ≠ `thread_row.org_id`, 409 "This workflow is in another organization — switch to it to run it." `[ASSUMED wording]` |
| Tweak (fork published → new draft) | `POST /workflows` `create_draft` (`workflows.py:1190-1238`) via `useWorkflowFork.ts:125` | **Active** org; the source id is not sent | **Guard added:** optional `from_definition_id` query param; when present and the source is non-global with org ≠ active org → 409. Absent param → today. `useWorkflowFork` passes it |
| Save draft (Builder) | `PATCH /workflows/{id}` (`workflows.py:1294`) | Row keeps its org; ORG-05 refusal keyed on the row (298 D-13) | Resolves from row |
| Schedule a workflow | `POST /workflows/{id}/schedules` (`schedules.py:95-143`) → `create_schedule` (`db/schedules.py:74-100`) | No `org_id` bound, so the LIMIT-1 owner trigger stamps it | **Guard added (recommended):** pass the definition's org (non-global) or the active org; one kwarg in each file. Read the definition org via `link_resolver`, NOT `db/workflows.get_definition`: touching `db/workflows.py` re-opens 298 WR-08 |
| Start chat from an Expert | `startScopedChat` → `POST /threads` + `PATCH /threads/{id}` (`startScopedChat.ts:56-70`) | `assert_expert_bindable` resolves the bundle **in the active org** and 404s otherwise (`threads.py:798-830`); `_require_thread_org` 409s a mismatch | Resolves from row / already refuses |
| Install an Expert | `POST /experts/{id}/install` (`experts.py:613-626`) | Active org by design (first-party only) | No change (D-09: first-party opens in the active org) |
| Handoff a thread | `POST /threads/{id}/handoff` (`threads.py:1541`) | New thread in the **source** thread's org, plus a `_require_thread_org` guard | Resolves from row |

"Saves in <org>" (D-18): apply it only to buttons that **create** an item (Run, Tweak, Start chat), and only when the user has two or more orgs, so single-org users see no change. Those buttons live in `RunModal.tsx` (FIRING), `WorkflowCardMenu.tsx` and `ExpertDetailModal.tsx`. One string expression each.

### Anti-Patterns to Avoid
- **Resolver on the service-role pool**, or on `get_active_org_id` / `require_capability` / `require_visible`. Each one either drops the RLS backstop, 400s a two-org caller or 403s (D-08).
- **FastAPI `UUID` path typing on `/links/{kind}/{id}`.** A malformed id becomes a 422, which is a second status.
- **Router hooks in LinkGate or any leaf.** Pass navigators down (297 D-08).
- **A `key` derived from the path, or a provider remount, to "reset" a page on a link** (297 D-07).
- **Echoing the raw requested path** into the card (T-297-09). Echo only `formatAppRoute(parsed)`.
- **A new raw `history.*` write** for return-to-link. Only `useAppNavigation` writes (`noRawHistoryWrites.test.ts`).
- **Reading `get_definition` in the schedule guard** (touches `db/workflows.py`, re-opens WR-08).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth callback parsing | Reading `#access_token` yourself | supabase-js `_initialize` (`detectSessionInUrl`) | It validates via `_getUser`, saves the session and fires SIGNED_IN |
| Membership check | Trusting `org_id` from the client | `org_members` + `auth.uid()` on `get_user_pg_connection` | The client header is a hint (`dependencies.py:1020-1060`) |
| Expert grant logic | A second Python reimplementation | One SQL mirroring `check_expert_grant_access` (`db/experts.py:309-337`) | Keeps a single statement shape (D-08) |
| Floating surface | Custom absolute-positioned popover | `DropdownMenu` / `DropdownMenuContent` | Focus, escape and outside-click are already handled |
| Return-target validation | Regex on URLs | `parseAppLocation` + `formatAppRoute` | Total, strict, never echoes, no host in output (T-297-05) |
| Org switch | A new switch path | `switchOrg` (`OrgProvider.tsx:178`) | 298 lists and 166 teardown are keyed on it |

## Common Pitfalls

### Pitfall 1: The card leaks through the address it shows
**What goes wrong:** D-12 shows the address, but 297 forbade echoing the requested path (T-297-09).
**How to avoid:** show `formatAppRoute(parsed)` only for parsed entity routes; an unparseable address shows no address. Pin it: `/app/chat/<UPPER>` displays the lowercase canonical form, and `/app/<script>` displays none.

### Pitfall 2: Missing vs forbidden separated by a second code path
**What goes wrong:** "fetch then check owner" or "Expert row, then grant query in Python" adds a round trip only for rows that exist.
**How to avoid:** one statement per kind (Pattern 2). The test asserts the same SQL text runs for both arms, and the same status, body and headers come back (compare `response.headers` minus `date`).

### Pitfall 3: D-19's Switch arm is not achievable as written (F4)
**How to avoid:** assert Stay → `subscriptionsRef` unchanged. Assert Switch → the run is not cancelled server-side, the "still answering" line comes from a pre-switch snapshot, and switching back plus reopening the thread reattaches it (G-4).

### Pitfall 4: URL⇄selection ping-pong or double history entries
**What goes wrong:** `selectThread(t)` followed by `onNavigate("chat")` in one tick, plus a selection→URL effect, writes two entries. A list refetch re-fires URL→selection.
**How to avoid:** use `openThread` for programmatic flows. Make URL→selection depend on `[threadId, pending]` only, reading `threads` through a ref. Test: "doRun from Library writes exactly one entry"; "rail New chat from Library writes one entry"; "Back from `/app/chat/B` to `/app/chat/A` selects A and pushes nothing."

### Pitfall 5: A cold thread link shows the welcome composer
**How to avoid:** while `threadId && pending`, render `AddressHolding` in the main area (Pattern 3). The card or prompt appears only after the resolver answers.

### Pitfall 6: The boot bound flips a signed-in person to the sign-in form
**How to avoid:** on timeout set `stalled`, never `user=null`. Only a rejected `getSession` sets `loading=false` (SEED-312's catch).

### Pitfall 7: Return-target resume fires on a normal visit
**How to avoid:** write sessionStorage only from the SSO and sign-up starts, use a TTL, consume once, and resume only when the address on screen is chat home right after a signed-out → signed-in edge.

### Pitfall 8: OpenAPI snapshot and public-docs registry
**What goes wrong:** a new route plus a new `org_id` field on `WorkflowRunRead` change the snapshot, and `test_276_openapi_snapshot_fresh.py` reds the backend gate.
**How to avoid:** regenerate with `backend/venv/Scripts/python scripts/export-openapi.py`. Add the `links` tag to a `TAG_GROUPS` entry and `/links/` to `FLAGGED_PREFIXES` in `scripts/build-public-openapi.cjs:88` (FIRING; a one-token edit). Run `node scripts/build-public-openapi.cjs --check`.

### Pitfall 9: The Experts tier gate after a Switch
**What goes wrong:** the resolver opens an org-authored Expert in org A, but org A lacks the `experts` capability, so the catalog's own `GET /experts` refuses (`experts.py:72-76`).
**How to avoid:** the resolver stays ungated (D-08). The catalog already renders its refusal. Note it in the threat model; no new branch.

### Pitfall 10: New test files invisible to the count gate
**How to avoid:** pin each new vitest file in `scripts/vitest-count-gate.cjs` BASELINE/TARGETS in the same commit (file-level when no directory entry covers it, the 298-04 precedent).

## Runtime State Inventory
Not a rename/refactor phase, so this section is omitted. (No stored data, live config or OS registration carries a renamed string. The only non-code half is the D-25 Supabase Redirect URLs operator step.)

## Code Examples

### Route skeleton (resolver)
```python
# backend/app/api/links.py — Source: org_items.py posture (298)
NOT_FOUND = {"detail": "Not found"}           # ONE body for every refusal
_KINDS = {"thread", "workflow", "run", "expert"}

router = APIRouter(prefix="/links", tags=["links"], dependencies=[Depends(_require_bearer)])

@router.get("/{kind}/{item_id}", response_model=LinkTarget)
async def resolve_link(kind: str, item_id: str, request: Request,
                       current_user: dict = Depends(get_current_user)) -> LinkTarget:
    uid = _strict_uuid(item_id)               # None for anything else
    if kind not in _KINDS or uid is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND["detail"])
    async with get_user_pg_connection(request, current_user) as conn:
        row = await link_resolver.lookup(conn, kind, uid)   # ONE statement per kind
    if row is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND["detail"])
    return link_resolver.to_target(kind, row)
```

### Write-org guard helper
```python
# backend/app/services/item_org_guard.py
def refuse_if_other_org(row_org_id, active_org_id, *, detail: str) -> None:
    """D-18: an item-page write lands in the item's org. No active org -> unchanged (polarity)."""
    if not active_org_id or row_org_id is None:
        return
    if str(row_org_id) != str(active_org_id):
        raise HTTPException(status_code=409, detail=detail)
```

### useThreads pending flag (FIX-02)
```ts
// frontend/src/hooks/useThreads.ts — beside :117-118
const pending = held === null || held.org !== activeOrgId
```

### Boot clock
```ts
// frontend/src/components/layout/BootScreen.tsx
const [stage, setStage] = useState<"iris" | "still" | "gaveup">("iris")
useEffect(() => {
  const a = window.setTimeout(() => setStage("still"), 8_000)
  const b = window.setTimeout(() => setStage("gaveup"), 20_000)
  return () => { window.clearTimeout(a); window.clearTimeout(b) }
}, [])
```

### Return target leaf
```ts
// frontend/src/lib/returnTo.ts — pure; reuses the route table
export function returnTarget(pathname: string, search: string): string | null {
  const p = parseAppLocation(pathname, search)
  if (p.view === "not-found" || p.view === "pre-auth") return null
  const out = formatAppRoute(p)
  return out.startsWith("/app") ? out : null      // never a host, never echoed
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| No router; `useState<ActiveView>` | react-router 8.5 data mode, one catch-all route | Phase 297 (2026-10-27) | Entity routes are table rows, not new mechanisms |
| Run id in `?run=` | `/app/runs/<id>` (legacy alias kept) | 297-02 | The run kind already exists |
| Lists unscoped by org | Lists narrowed to the active org, refetch on switch | Phase 298 (2026-10-28) | A link into another org must switch before its list can show it |

**Deprecated/outdated:** the IA skill's "Tab and entity addresses… are Phase 299" line (`.claude/skills/sketch-findings-agentic-rag/SKILL.md:89`). Correct it beside the original in plan 02 (the 297 D-40 precedent).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | After Switch and switch back, reopening the thread reattaches to the still-running server run | F4, Pitfall 3 | The "still answering · Switch back" copy over-promises; reword to "keeps running; open it to see the answer" |
| A2 | The Expert resolver SQL (Pattern 2) is valid against local Postgres and matches `get_expert` for every visibility | Pattern 2 | A visible Expert reads as can't-be-opened (or the reverse). TDD RED against a live local query catches it |
| A3 | GoTrue silently falls back to the Site URL for a non-allow-listed `redirect_to` | Pattern 7 | Without the fallback, SSO errors instead; the sessionStorage copy is harmless either way |
| A4 | Audience and refusal wordings marked `[ASSUMED wording]` | F1, write inventory | Copy only; confirm in UI-SPEC |
| A5 | No production thread or run sits in an org that differs from its owner's active-org usage in a way the new send/kickoff 409 would wrongly refuse (298 audit measured 0 mis-stamps) | Write inventory | A legitimate send refused; the 409 is worded and the user can switch |
| A6 | supabase-js `_initialize` parses the URL before any app effect could replace it. This matters only for bare-prefix links, and the normaliser carries the hash anyway | Pattern 7 | None in practice: the hash survives the replace |

## Open Questions

1. **Is "New chat pushes `/app`" (D-02) meant literally?** (F7)
   - Known: New chat creates and selects a real thread.
   - Recommendation: push `/app/chat/<newId>`. Record it as a D-02 amendment at plan time.
2. **Is a SAML SSO provider configured locally or on cloud, and what is the local Redirect URL allow-list?**
   - Known: no `supabase/config.toml` is tracked in the repo.
   - Recommendation: read the cloud Auth config via the Supabase MCP (read, no approval needed) before G-4 row 4. If none is configured, the SSO row is ⛔ with that reason (D-25). Password and sign-up rows still run.
3. **Should the schedule-create org fix be in 299 or seeded?**
   - Recommendation: include it (one kwarg each in `schedules.py` and `db/schedules.py`, which is young). It is a write reachable from the workflow card, and LINK-05 says "nothing is saved under the wrong org".
4. **Is the "re-run" in SC#3 the library card's Run?** (F5) Recommendation: yes. Record it as a CONTEXT amendment; do not build a run-page re-run.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Backend venv | pytest, OpenAPI export | ✓ | `backend/venv/Scripts/python.exe` | — |
| Node / vitest | frontend tests, count gate | ✓ | vitest ^4.1.0 | — |
| Local Supabase (Postgres 54322) | Live resolver SQL drive, G-4 | not probed (Docker is operator-run; memory: Git Bash, docker denied) | — | Unit tests with mocked connection; live drive by the operator or Chrome |
| Two-org dev account | G-4 rows 2/3 | ✓ (memory `reference_dev_account_is_in_two_orgs`) | — | — |
| SAML SSO provider | G-4 row 4 SSO arm | unknown | — | ⛔ row with reason (D-25) |

## Validation Architecture

> `.planning/config.json` has `workflow.nyquist_validation: false`. This section is included because the orchestrator asked for it explicitly, and it is written so it can be dropped into VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1 (frontend), pytest (backend, `backend/pytest.ini`) |
| Config file | `frontend/vitest.config.ts`, `backend/pytest.ini` |
| Quick run (frontend) | `cd frontend && npx vitest run <paths>` |
| Quick run (backend) | `cd backend && venv/Scripts/python -m pytest tests/unit/test_299_*.py -q` |
| Typecheck | `cd frontend && npx tsc -p tsconfig.app.json --noEmit` (set diff vs base; plain `tsc --noEmit` checks zero files) |
| Full suite (frontend, once per wave) | from repo root: `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (no per-file decrease, 0 failing) |
| Full suite (backend, once per wave) | `node scripts/check-backend-unit-baseline.cjs` (ceiling 71 failed, zero headroom) |
| Other gates | `node scripts/check-hot-file-ledger.cjs 299`; `node scripts/build-public-openapi.cjs --check`; `node scripts/check-claude-md-size.cjs` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LINK-02 | `/app/chat\|workflows\|experts/<uuid>` parse/format round-trip, lowercased; partial or extra segments are not-found; `/app` and `/app/chat` exactly `{view:"chat"}` | unit | `npx vitest run src/lib/__tests__/appRoutes.test.ts` | ✅ extend |
| LINK-02 | Parity: the three new entity shapes resolve to `app.html` in dev, Vercel and nginx | unit | `npx vitest run src/__tests__/routing/appRouteParity.test.ts` | ✅ extend (separate ENTITY list; keep `Set(CANONICAL).size === VIEWS.length`) |
| LINK-02 | Thread URL⇄selection: cold load selects after list settles; pick pushes one entry; doRun writes one entry; Back selects previous; `/app` deselects; setViewingThread untouched | component | `npx vitest run src/hooks/__tests__/useThreadAddress.test.tsx` | ❌ W0 |
| LINK-02 | Stream survives thread-address navigation (subscriptionsRef unchanged, no AbortError) | component | `npx vitest run src/__tests__/routing/navigationKeepsStreams.test.tsx` | ✅ extend |
| LINK-02 | Draft link opens the Builder with token; published link focuses card and clears project filter; no write calls | component | `npx vitest run src/components/workflows/library/__tests__/useWorkflowLinkTarget.test.tsx` | ❌ W0 |
| LINK-02 | Expert link opens the detail modal (list hit and `getExpert` fallback) | component | `npx vitest run src/components/experts/catalog/__tests__/ExpertCatalogPage.link.test.tsx` | ❌ W0 |
| LINK-03 | Share: address = origin + formatAppRoute; real clipboard write; refused → text selected + words; one receipt; audience line per kind | component | `npx vitest run src/components/share/__tests__/ShareLinkMenu.test.tsx` | ❌ W0 |
| LINK-03 | Legacy `?run=`, `?connections=1`, `/admin/spend`, `/setup`, `/invite` cold loads unchanged | unit/component | `npx vitest run src/lib/__tests__/appRoutes.test.ts src/components/layout/__tests__/ChatLayout.runDeepLink.test.tsx src/pages/__tests__/SetupWizard.test.tsx` | ✅ (must stay green) |
| LINK-04 | Resolver: same SQL text for missing and forbidden; 404 status, body and headers identical; malformed id / unknown kind → same 404 (no 422, no 403); 401 without bearer | unit | `venv/Scripts/python -m pytest tests/unit/test_299_links_route.py -q` | ❌ W0 |
| LINK-04 | Per-kind rules: thread owner; run owner ∪ (terminal ∧ org member); workflow owner ∪ global-published; Expert visibility/grants/role-in-bundle-org/disabled | unit (+ live SQL drive) | `venv/Scripts/python -m pytest tests/unit/test_299_link_resolver.py -q` | ❌ W0 |
| LINK-04 | In-place card: identical render for missing and forbidden per kind; canonical address only for parsed entity routes; unparseable shows no address; admin refusal words = unknown-address words | component | `npx vitest run src/components/layout/__tests__/AppViewSwitch.addressStates.test.tsx src/components/layout/__tests__/CantBeOpened.test.tsx` | ✅ re-target + ❌ W0 |
| LINK-05 | Prompt when org_id ≠ active; none when null (global or system); Stay keeps org and subscriptions; Switch calls switchOrg once, then opens; pre-switch "still answering" snapshot | component | `npx vitest run src/components/layout/__tests__/LinkGate.test.tsx` | ❌ W0 |
| LINK-05 | Write guards: send_message 409 on org mismatch (Expert and non-Expert), unchanged header-less; kickoff 409 for a non-global foreign definition; ask_user message stamped with the run's org; create_draft `from_definition_id` 409; schedule stamped with the definition's org | unit | `venv/Scripts/python -m pytest tests/unit/test_299_write_org_guards.py -q` | ❌ W0 |
| LINK-05 | Run read carries `org_id`; OpenAPI snapshot fresh | unit | `venv/Scripts/python -m pytest tests/unit/test_276_openapi_snapshot_fresh.py -q` | ✅ (regen) |
| LINK-06 | returnTarget: entity and view routes rebuilt; `//evil`, absolute, `/setup`, `/nonsense`, HOSTILE set → null; kindWord only for entities | unit | `npx vitest run src/lib/__tests__/returnTo.test.ts` | ❌ W0 |
| LINK-06 | useAuth: SSO redirectTo = origin + rebuilt path; signUp emailRedirectTo; getSession reject → loading false; hang → stalled, user untouched | unit | `npx vitest run src/hooks/__tests__/useAuth.test.ts` | ❌ W0 |
| LINK-06 | AuthPage quiet line per kind; none for chat home or off-site; SignInForm test unchanged | component | `npx vitest run src/pages/__tests__/AuthPage.returnLine.test.tsx src/components/auth/SignInForm.test.tsx` | ❌ W0 + ✅ |
| LINK-06 | BootScreen stages at 8 s / 20 s (fake timers); Try again reloads; answer at 4 s shows no message | component | `npx vitest run src/components/layout/__tests__/BootScreen.test.tsx` | ❌ W0 |
| FIX-02 | `pending` true before first answer and during a switch; desktop column and mobile list say "Loading your chats…", never "No recent chats" until settled empty | unit/component | `npx vitest run src/__tests__/hooks/useThreads.orgSwitch.test.ts src/components/layout/__tests__/ChatHistoryColumn.orgSwitch.test.tsx src/components/layout/__tests__/ChatLayout.mobileLoading.test.tsx` | ✅ extend + ❌ W0 |

Every new test file is RED-first (`tdd_mode: true`). Planted-defect drives: (a) a second Python grant query makes the "same SQL text" assertion red; (b) removing the hash carry in the normaliser reds a `/runs/<id>#access_token=x` case; (c) setting `user=null` on the boot timeout reds the stalled case.

### Sampling Rate
- **Per task commit:** the targeted files above for that task, plus `tsc -p tsconfig.app.json` set diff.
- **Per wave merge:** the vitest count gate and the backend baseline gate, ledger gate, OpenAPI `--check`.
- **Phase gate:** all green before `/gsd:verify-work`, then G-4.

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_299_links_route.py`, `test_299_link_resolver.py`, `test_299_write_org_guards.py`
- [ ] `frontend/src/hooks/__tests__/useThreadAddress.test.tsx`, `useAuth.test.ts`
- [ ] `frontend/src/lib/__tests__/returnTo.test.ts`
- [ ] `frontend/src/components/layout/__tests__/LinkGate.test.tsx`, `CantBeOpened.test.tsx`, `BootScreen.test.tsx`, `ChatLayout.mobileLoading.test.tsx`
- [ ] `frontend/src/components/share/__tests__/ShareLinkMenu.test.tsx`
- [ ] `frontend/src/components/workflows/library/__tests__/useWorkflowLinkTarget.test.tsx`, Expert link test
- [ ] Count-gate pins for each new vitest file; no framework install needed

### Four-axis UAT rows (VALIDATION.md, not PLAN.md)
| Axis | Row |
|------|-----|
| Cross-provider (8 rows, derived from `MODEL_CAPABILITIES`, newest registry-backed id per provider, per-request `model`+`provider`) | An answer from each of OpenAI, Anthropic, Google, DeepSeek, Zhipu/GLM, MiniMax, Moonshot/Kimi and OpenRouter keeps streaming while: thread address A → B → Back → Forward, then an other-org run link opened and **Stay** pressed. Verdict from `runs.status` and the transcript: complete with no gap. Blocked providers are recorded ⛔ with a reason, never omitted |
| Multi-tool | `search_documents` + `execute_code` in one prompt, opened by its `/app/chat/<id>` address in a fresh tab mid-run, reattaches and completes |
| Parallel-thread | Thread A streams while thread B is opened by pasting its address; A is not aborted |
| Long-message | A thread with ≥ 50 messages (or a ≥ 5 KB prompt) opened by address in a fresh tab, refreshed, reopens on the same thread at its tail |

### G-4 lived-experience rows (D-31, Chrome MCP, dev account in two orgs; prove the active org first)
1. Copy link on a thread (share menu) → paste into a fresh tab → same thread; refresh stays.
2. With a chat answering in org A, open a run link from org B → prompt with title and org → **Stay**: org unchanged, answer still streaming (`subscriptionsRef` size via DOM/state probe). Then **Switch**: run opens, "still answering · Switch back" line. Switch back, reopen the thread: answer present or still streaming (A1).
3. A made-up UUID and another user's real run id → the same card, same words; DevTools shows the same 404 body for both `GET /links/run/...`.
4. Signed out, open `/app/runs/<id>` → quiet line "After you sign in, you'll go to a workflow run." → password sign-in → on the run. Repeat with SSO (or ⛔ with reason) and sign-up (email link). Then `/app/runs/<id>` with a crafted off-site return in sessionStorage → lands on chat.
5. Throttle to Slow 3G → chat list (desktop and mobile width) says "Loading your chats…", never "No recent chats". Block `*/auth/v1/*` → boot shows the Iris, then "Still connecting…" at 8 s, "Can't reach Syrel" + Try again at 20 s; Try again keeps the URL.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | supabase-js implicit flow untouched; `redirectTo` built only from `formatAppRoute`; GoTrue allow-list (D-25) |
| V3 Session Management | yes | No token in any app-written URL; sessionStorage holds only a rebuilt path, never a token |
| V4 Access Control | yes | Resolver mirrors each kind's existing read on an RLS user-JWT connection; writes resolve org from the row or 409 |
| V5 Input Validation | yes | Strict UUID plus kind allow-list in the handler; `parseAppLocation` for every client address |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Existence oracle (missing vs forbidden) | Information disclosure | One statement per kind, one 404 body/status/headers, no 403/422 on the route; residual microsecond timing accepted (D-08) |
| Open redirect via return target | Spoofing | `returnTarget` rebuilds from `formatAppRoute`; origin is `window.location.origin`; GoTrue allow-list |
| Token in URL / Referer leak | Information disclosure | App never writes tokens; supabase-js clears the hash; `?code=` never used |
| Content spoofing in the card | Spoofing | Show only canonical rebuilt addresses (F6 / T-297-09) |
| Cross-org write mis-stamp | Tampering | `item_org_guard.refuse_if_other_org` on send / kickoff / Tweak; row-org stamp on ask_user and schedule |
| Anonymous access | Elevation | Router-level `_require_bearer` → 401; a live `anon` SQL read of the resolver's statements returns zero rows (BUG-260911-01 class; anon test D-11) |
| Header spoofing of `X-Org-Id` | Spoofing | Resolver ignores the header for its answer; guards use `resolve_active_org_or_none` (membership re-validated) |

## Recommended plan split (G-8: 5 plans, 3 waves)

| Plan | Wave | Scope | files_modified (expected) |
|------|------|-------|---------------------------|
| **299-01** Resolver + run `org_id` + write-org guards | 1 | Pattern 2, D-10, write inventory guards, OpenAPI regen, ledger rows | `backend/app/api/links.py` (new), `backend/app/services/link_resolver.py` (new), `backend/app/services/item_org_guard.py` (new), `backend/app/main.py` (one include_router + import), `backend/app/api/workflow_runs.py` (one field + one kwarg), `backend/app/api/threads.py` (one guard call in send_message), `backend/app/services/workflow_kickoff.py` (one guard call), `backend/app/api/workflows.py` (one optional param + one call), `backend/app/api/runs.py` (select token + one insert key), `backend/app/api/schedules.py` + `backend/app/db/schedules.py` (one kwarg each), `scripts/build-public-openapi.cjs`, `docs/public/api/openapi.snapshot.json`, `backend/tests/unit/test_299_*.py`, `docs/HOT-FILE-LEDGER.md` |
| **299-05** Sign-in return + boot + FIX-02 | 1 (parallel to 01; disjoint files) | Patterns 7, 8, 9 | `frontend/src/lib/returnTo.ts` (new), `frontend/src/hooks/useAuth.ts` (row added), `frontend/src/pages/AuthPage.tsx`, `frontend/src/components/layout/BootScreen.tsx` (new), `frontend/src/App.tsx` (splash → `<BootScreen/>`), `frontend/src/hooks/useThreads.ts` (`pending`), `frontend/src/components/layout/ChatLayout.tsx` (destructure + mobile arm), tests, `scripts/vitest-count-gate.cjs`, `docs/OPERATOR.md` + `docs/DEPLOYMENT-WORKFLOW.md` (D-25), `docs/HOT-FILE-LEDGER.md` |
| **299-02** Entity routes + LinkGate + in-place card + open-by-id | 2 (after 01 for the resolver contract, after 05 for App/ChatLayout merges) | Patterns 1, 3, 4, 5 (without prompt UI), resume of return target | `frontend/src/lib/appRoutes.ts`, `frontend/src/hooks/useAppNavigation.ts`, `frontend/src/App.tsx` (one `entityLink` prop), `frontend/src/components/layout/ChatLayout.tsx` (one hook call + openThread swaps), `frontend/src/components/layout/AppViewSwitch.tsx` (gate mount + props), `frontend/src/components/layout/AddressNotFound.tsx` → `CantBeOpened.tsx`, `frontend/src/components/layout/LinkGate.tsx` (new), `frontend/src/hooks/useThreadAddress.ts` (new), `frontend/src/lib/api/links.ts` (new) + `frontend/src/lib/api.ts` (one export block), `frontend/src/pages/WorkflowsPage.tsx` (one prop + one hook call), `frontend/src/components/workflows/library/useWorkflowLinkTarget.ts` (new), `frontend/src/components/workflows/library/WorkflowCard.tsx` (one `data-row-id`), `frontend/src/components/experts/catalog/ExpertCatalogPage.tsx` (one prop + hook), the re-targeted fences, `.claude/skills/sketch-findings-agentic-rag/SKILL.md` (correction beside :89), ledger, count gate |
| **299-03** Switch prompt | 3 | D-16, D-17, F4 snapshot, Stay / "Open it after all" | `frontend/src/components/layout/SwitchOrgPrompt.tsx` (new), `frontend/src/components/layout/LinkGate.tsx`, `frontend/src/components/org/orgItemsCopy.ts` (new strings), tests, count gate, ledger |
| **299-04** Share menu + "saves in <org>" | 3 (parallel to 03; disjoint files) | Pattern 6, D-18 labels | `frontend/src/components/share/ShareLinkMenu.tsx` (new), `frontend/src/lib/clipboard.ts` (new), `frontend/src/lib/linkAudience.ts` (new), mounts in `frontend/src/components/chat/ChatArea.tsx`, `frontend/src/components/workflows/library/WorkflowCardMenu.tsx`, `frontend/src/pages/WorkflowsPage.tsx` (Builder header), `frontend/src/pages/WorkflowRunPage.tsx`, `frontend/src/components/experts/catalog/ExpertDetailModal.tsx`, `frontend/src/components/workflows/library/RunModal.tsx` + `useWorkflowFork.ts` (from_definition_id and label), tests, count gate, ledger |

Worktree rule 4: none of these plans' automated tests mutate the local DB (resolver and guard tests mock the connection; the live SQL drive is read-only), so W1's two plans and W3's two plans can run in parallel. Run full gates once per wave. Executors run targeted suites per task.

## Sources

### Primary (HIGH confidence, this repo and installed packages)
- `frontend/src/lib/appRoutes.ts`, `frontend/src/hooks/useAppNavigation.ts`, `frontend/src/App.tsx`, `frontend/src/main.tsx`, `frontend/src/components/layout/{AppViewSwitch,AddressNotFound,ChatLayout,ChatHistoryColumn}.tsx`, `frontend/src/hooks/{useThreads,useAuth}.ts`, `frontend/src/lib/supabase.ts`, `frontend/src/components/auth/*`, `frontend/src/providers/{OrgProvider,StreamsProvider}.tsx`
- `node_modules/@supabase/auth-js/dist/module/GoTrueClient.js` (flowType default, `_initialize`, `_getSessionFromURL`, `signInWithSSO`, `getSession`), `lib/helpers.js` (`parseParametersFromURL`); supabase-js and auth-js 2.99.2
- `backend/app/api/{threads,workflow_runs,workflow_run_evidence,workflows,experts,runs,schedules,org_items}.py`, `backend/app/db/{workflows,experts,schedules}.py`, `backend/app/services/{workflow_kickoff,entitlement_service}.py`, `backend/app/dependencies.py`
- `supabase/full-schema.sql` (table defs, RLS policies), `supabase/migrations/106_org_id_autofill_trigger.sql`
- `docs/HOT-FILE-LEDGER.md` sections; `node scripts/check-hot-file-ledger.cjs --files …` (run 2026-10-28)
- Phase 297/298 CONTEXT, 297 RESEARCH Pitfall 10, the four 299 sketch READMEs and `299-switch-org/index.html`

### Secondary (MEDIUM)
- [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls): `*` / `**` wildcard semantics
- [Supabase URL Configuration](https://supabase.com/dashboard/project/default/auth/url-configuration): Site URL is used when the redirect does not match the allow list

### Tertiary (LOW)
- [claudskills supabase-oauth-redirect-trap](https://claudskills.com/skills/supabase-oauth-redirect-trap/SKILL.md) and [lightrun redirectTo issue](https://lightrun.com/answers/supabase-supabase-redirectto-not-being-respected-when-using-email-or-magic-link-auth): the silent Site-URL fallback (corroboration only)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Nothing new; versions read from `node_modules`.
- Architecture: HIGH for the route table, resolver posture and auth flow (source-verified). MEDIUM for the thread binding (design; TDD drives it).
- Pitfalls: HIGH. Each one is anchored to a cited line or a ledger invariant.

**Research date:** 2026-10-28
**Valid until:** 2026-11-27 (stable; re-check if `useThreads.ts`, `StreamsProvider.tsx` teardown, or supabase-js is upgraded)
