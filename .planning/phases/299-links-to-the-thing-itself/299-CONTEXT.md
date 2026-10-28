# Phase 299: Links to the Thing Itself - Context

**Gathered:** 2026-10-28
**Status:** Ready for planning
**Mode:** `--auto` (operator: "continue autonomously end to end") — every gray area resolved with the
recommended option; the four G-2 sketch winners were picked by the operator on 2026-10-28 and are binding.

<domain>
## Phase Boundary

A chat thread, a workflow, a workflow run and an Expert each get their own `/app/...` address that can
be copied, opened in a new tab or on another signed-in machine, and reached again after sign-in. A link
the user cannot open shows one "can't be opened" card that is identical for missing and forbidden. A
link to an item in another of the user's orgs asks "This is in <org> — switch?" before switching, and
nothing is saved under the wrong org. The boot screen gives up with words and a retry. The chat list
shows a loading state instead of "No recent chats" while threads load (FIX-02).

Requirements: LINK-02, LINK-03, LINK-04, LINK-05, LINK-06, FIX-02. Builds on 297's route table
(`frontend/src/lib/appRoutes.ts`, `useAppNavigation`, `AppViewSwitch`) and 298's org-following lists.

Out of scope: sharing with people outside the item's visibility rule, public links, link expiry, a
skill-studio tab in the URL, any change to who may open an item.
</domain>

<decisions>
## Implementation Decisions

### Addresses (LINK-02)
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

### One resolver on the server (LINK-04, LINK-05, security)
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

### Can't be opened (LINK-04) — sketch 299-1 winner B
- **D-12:** The card opens **in place, over the generic area for that kind** (chat history for a thread,
  workflow library for a workflow/run, Experts catalog for an Expert), dimmed, with the address shown and
  a Copy address button. The area behind is never filtered or scrolled toward the item.
- **D-13:** Words name only the kind (from the path), e.g. "This workflow run can't be opened" — never a
  reason, never a title. Identical render for missing and forbidden (drive-proven, as in the sketch).
- **D-14:** 297's `AddressNotFound` (unparseable `/app/...`) moves into the same in-place card ("This
  address doesn't open anything"), so the app has one page. Below 820px the card sits over the main area.
- **D-15:** Never falls back to chat silently.

### Switch org (LINK-05) — sketch 299-2 winner A
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

### Copy link (LINK-03) — sketch 299-3 winner C
- **D-20:** A share popover on each of the four surfaces: chat header, workflow library card (and Builder
  header for a draft), run page header, Expert detail. It shows the address, a Copy button and one
  "who can open it" line derived from the D-07 rule for that kind — thread/run/draft: "Opens only for
  you, on any device you're signed in on"; published workflow / Expert: "Opens for members of <org> who
  can see it". It never promises more than the rule.
- **D-21:** One "✓ Link copied" receipt. The address is the item's own `/app/...` path on
  `window.location.origin`, from `formatAppRoute` — never a token. Real clipboard write, with a
  select-the-text fallback when the clipboard API is refused.

### Sign-in return and boot (LINK-06) — sketch 299-4 winner A
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

### Chat list loading (FIX-02)
- **D-27:** Mobile chat list (`ChatLayout.tsx:713`) shows the same "Loading your chats…" line desktop
  already shows (`ChatHistoryColumn.tsx:470`) — words, no skeleton; one vocabulary. "No recent chats"
  appears only after a settled empty answer. Desktop's first-load path is re-checked against the
  1,400-thread slow load (BUG-261027-02), not only the org-switch path 298 fixed.

### Guardrails and plan shape
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

### Amendments from research (2026-10-28, `--auto`, recommended option each time; 299-RESEARCH.md F1-F7)
- **D-32 (amends D-02, F7):** "New chat" already creates a real thread, so it pushes `/app/chat/<newId>`; only a
  thread-less chat home is `/app`.
- **D-33 (amends D-07/D-20, F1):** a published workflow is visible to its OWNER (or system-global), not to org
  members. The resolver rule and the share line follow that: "Opens only for you, on any device you're signed in on".
- **D-34 (amends D-07/D-20, F2):** a run is openable by its owner, or by any member of its org once it has finished
  (the evidence-report rule, `workflow_run_evidence.py`). The share line differs for a running run (owner only) and
  a finished one ("Opens for members of <org>").
- **D-35 (amends D-09, F3):** `workflow_definitions.org_id` is NOT NULL; "no switch prompt" keys off
  `is_system_global` / `is_system`, and the resolver returns `org_id: null` for those rows.
- **D-36 (amends D-12, F6):** the can't-be-opened card shows only the REBUILT canonical address of a parsed item link
  (from `formatAppRoute`), and no address at all for a mistyped one — never echoes the requested path (297 rule).
- **D-37 (amends D-19, F4):** Stay keeps `subscriptionsRef` unchanged. Switch goes through `switchOrg`, which aborts
  run subscriptions by design (`StreamsProvider.tsx` is not edited); for Switch the proof is that the run keeps going
  on the server and reattaches on switch-back — G-4 row 2.
- **D-38 (amends D-18, F5):** the run page has no re-run control; "re-run" in SC#3 means Run from the workflow's
  library card. No new re-run button (that would be a new capability). Guards added where research found the active
  org stamped: sending a message on a non-Expert thread, workflow launch, answering an ask, Tweak (optional
  `from_definition_id`), schedule creation (one keyword in `schedules.py` + `db/schedules.py`; `db/workflows.py`
  untouched so 298 WR-08 stays deferred).
- **D-39 (F8/F9):** the org mark is 298's `OrgAvatar` (initial, no colour); the share surface is built on the existing
  `DropdownMenu` (no popover primitive exists).
- **D-40 (F10):** ledger rows + `docs/HOT-FILE-LEDGER.md` sections added, in the same commit as the first touch, for
  `useAuth.ts`, `lib/api/_core.ts`, `lib/supabase.ts`, `SignInForm.tsx`, `SignUpForm.tsx`, `useWorkflowFork.ts` and
  every new file. `useAuth.ts` and `_core.ts` already FIRE at 4 phases.
- **D-41:** whether a SAML SSO provider is configured is read through the Supabase MCP (read-only) before G-4 row 4;
  if none, that row is ⛔ with the reason.

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
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` §"Phase 299: Links to the Thing Itself" — goal, 5 SCs, failure list, flags
- `.planning/REQUIREMENTS.md` — LINK-02..06, FIX-02

### Approved designs (G-2, binding)
- `.planning/sketches/299-cant-be-opened/README.md` + `index.html` — winner B
- `.planning/sketches/299-switch-org/README.md` + `index.html` — winner A
- `.planning/sketches/299-copy-link/README.md` + `index.html` — winner C
- `.planning/sketches/299-sign-in-return-and-boot/README.md` + `index.html` — winner A
- `.planning/sketches/MANIFEST.md` §"Sketch 299"
- `Skill("sketch-findings-agentic-rag")` — IA / navigation contract, ElsewhereLine vocabulary

### Prior phase decisions
- `.planning/phases/297-every-view-has-an-address/297-CONTEXT.md` — route table, tree shape, D-07..D-19
- `.planning/phases/297-every-view-has-an-address/297-RESEARCH.md` — Pitfall 10 (auth `?code=`)
- `.planning/phases/298-lists-follow-the-active-org/298-CONTEXT.md` — D-03 org resolution, D-11, D-14/D-17 words
- `.planning/phases/298-lists-follow-the-active-org/deferred-items.md` §5 — WR-08 (reviewed, deferred)

### Folded registers
- `.planning/seeds/SEED-178-thread-selection-does-not-survive-reload.md`
- `.planning/seeds/SEED-015-per-thread-url-routing.md`
- `.planning/seeds/SEED-312-boot-spinner-waits-on-untimed-auth-getsession.md`
- `.planning/reported-bugs/BUG-261027-02-chat-list-says-no-recent-chats-while-loading.md`

### Guardrails
- `docs/HOT-FILE-LEDGER.md` — sections for every FIRING file in D-28
- `docs/DEPLOYMENT-WORKFLOW.md` — parity checklist (Redirect URLs, D-25)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/lib/appRoutes.ts` — strict-leaf parser/formatter; add the four entity routes here.
- `frontend/src/hooks/useAppNavigation.ts` — the only router-hook caller; derives the view from the URL.
- `frontend/src/components/layout/AddressNotFound.tsx` — becomes the in-place card (D-14).
- `frontend/src/lib/runDeepLink.ts` — `isStrictUuid`.
- `frontend/src/hooks/useAuth.ts` — `getSession().then` with no catch/timeout (SEED-312); SSO via `signInWithSSO`.
- `frontend/src/components/auth/SignInForm.tsx`, `SignUpForm.tsx`, `AuthCardShell.tsx` — the quiet line lands here.
- `frontend/src/App.tsx:227` — the boot splash (Iris) to stage per D-26.
- `ChatHistoryColumn.tsx:470` "Loading your chats…" — the wording to reuse on mobile.
- 298's `ElsewhereLine` + `switchOrg` (OrgProvider) — switch vocabulary and action.

### Established Patterns
- Ownership-filtered single query → same 404 (`workflow_runs.py` T-092-04, `threads.py:get_thread`).
- `experts.py:get_expert` uses `get_active_org_id` (400s a header-less two-org caller) and a grant-aware
  lookup scoped to the active org — the resolver must evaluate per membership, not per active org.
- No single-definition GET exists in `workflows.py`; the resolver supplies the workflow lookup.
- 298 D-03 polarity rule: never turn "no org" into an empty set.

### Integration Points
- Thread selection in `ChatLayout.tsx` (`selectedThread`) ↔ URL via `useAppNavigation`.
- `WorkflowsPage.tsx` `onOpenDraft` / library card focus.
- `ExpertCatalogPage.tsx` / `ExpertDetailModal.tsx` / `startScopedChat.ts`.
- `WorkflowRunPage.tsx` header (copy link); run re-run write path.
</code_context>

<specifics>
## Specific Ideas
- Sketch truth strip: a stream's word count keeps climbing through Stay/Switch — mirror it in the
  four-axis test (subscription count + no AbortError).
- Switch prompt colour square + name, exactly as 298's org chip.
</specifics>

<deferred>
## Deferred Ideas
- **298 WR-08** (Builder "lives in <org>" marker relative to the viewer's org) — reviewed, **deferred**:
  with D-16 every link open makes the viewer's org equal the item's org, so the residual case is a
  Builder left open across a manual switch — a wrong hint, never a wrong write (ORG-05 refusal is keyed
  on the row). Re-open: the next phase whose `files_modified` names `useBuilderNameMaps.ts` or
  `db/workflows.py`.
- Skill-studio tab in the URL (297 D-11 note) — not in LINK-02's four kinds.
- Public / outside-org share links, link expiry — new capability.
</deferred>

---

*Phase: 299-links-to-the-thing-itself*
*Context gathered: 2026-10-28*
