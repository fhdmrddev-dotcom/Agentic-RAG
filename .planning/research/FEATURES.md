# Feature Research — v4.8 "Every Page Has a Link"

**Domain:** Multi-tenant B2B AI agent / workflow platform (React SPA + FastAPI + Supabase). New capabilities only: addressable URLs, "a run is waiting on you" notifications (in-app + email), and active-org-scoped lists.
**Researched:** 2026-10-27
**Confidence:** MEDIUM overall. Notification behaviour of Linear, Slack, Zapier, Knock, GitHub and the email legal rules are sourced from official docs (HIGH). Most URL *shapes* of other products are not in official docs; they come from third-party guides or common knowledge and are marked as such (MEDIUM/LOW). Repo facts were measured in this session (HIGH).

---

## 0. Repo facts that change the picture (measured 2026-10-27)

Read these before the tables. Several of them move a feature's cost, or make a seed's premise out of date.

| Fact | Where | Consequence for v4.8 |
|---|---|---|
| `ActiveView` now has **12 members**: `chat, documents, skills, settings, workflows, connections, skill-studio, control-room, org-admin, workflow-run, admin-spend, experts`. The member list differs from SEED-185's 2026-08-18 list (`library-health`, `classification-rules` and `governance` are gone; `connections`, `admin-spend` and `experts` were added). | `frontend/src/App.tsx:132` | The route table comes from the current union, not from the seed. `frontend/src/lib/activeViewReachability.ts` (262-01) already lists the members, so it can serve as the router's coverage test. |
| **Three ad-hoc deep links already exist and are live contracts.** `/app?run=<uuid>` opens a run (289-04, and the reload is kept). `/admin/spend` opens admin-spend (257). `/app?connections=1&…` is the **OAuth callback landing** (BUG-260903-01). | `App.tsx:156-171` | ⛔ The OAuth redirect URI is **registered with Google and Microsoft**. Changing it breaks connectors outside our deploy. The router must keep all three working, either as permanent redirects or as aliases. Emails or bookmarks that already carry `?run=` must still resolve. |
| **Host rewrites already exist**: `app.<host>/(.*)` → `/app.html`, `/app/(.*)` → `/app.html`, with nginx mirroring it and `devRouting.ts` in dev. The root domain serves the landing page (`index.html`). | `frontend/vercel.json`, `frontend/nginx.conf` | SEED-185's note "needs a rewrite-all rule" is **mostly done already** for the app host. The open questions are **which base the routes live under** (`app.<domain>/…` in cloud, `/app/…` on one-box or self-hosted), and the Vercel rule that a real file beats a rewrite (a route can never be named like a built file). |
| Active org = a **localStorage hint plus an `X-Org-Id` header** that the server validates. It is not in the URL. | `frontend/src/hooks/useAuth.ts:87-91`, `lib/api/*.ts` | The "org slug in the path" decision is a real fork (see §2.1). Today a link carries no org, so a two-org user can open a link while the wrong org is active. |
| **Scheduled and API-key runs are owned by a person.** The schedule's `user_id` and the key's owner `user_id` become the run's `user_id`, in the key's or schedule's org. | `scheduler_service.py:103`, `api/inbound.py:24` | "Who gets notified" has a well-defined default (**the run owner**) even for 4 a.m. unattended runs. No routing design is needed for v1. |
| The **inbound API already returns a no-existence-leak 404** (`{"detail":"Not found."}` for a miss whatever the cause). | `api/inbound.py:18-22` | There is already an in-house precedent for "a link you can't open fails without leaking". Reuse the same rule. |
| An unanswered human-input step **no longer fails the run**. Since Phase 200 (D-10), a timeout raises `HumanInputTimeout`, so *"the run is paused and stays resumable"*. Per-call wait is 300 s by default, with a hard cap of 1800 s. | `harness/human_input.py:80-86, 319-339`, `config.py:1408-1416` | ⚠ **SEED-281's N-2 premise ("unanswered → fail_run") is partly stale.** At least for `human_input` steps, a waiting run now sits paused for as long as nobody acts, so "waiting on you" is a **durable state, not a 30-minute window**. Engine asks still route through `_resolve_failure_with_ask_user`, and its dispositions need re-measuring per type in the requirements step. This changes the reminder design (§3.2). |
| Pending asks are looked up **per thread** (`GET /panel/ask_user/pending`). There is no per-user "everything waiting on me" query. | `api/panel.py:164` | The notification producer needs a **new server-side, per-user, per-org "waiting on you" query**. `attentionConditions.ts` forbids deriving the verdict on the client (D-235-05). |
| The attention seam has exactly one tenant, and a test asserts `ATTENTION_PRODUCERS.length === 1` literally. | `layout/attentionConditions.ts`, `NavPanel.badge.test.tsx` | Registering the "waiting on you" producer is the **intended way in**. The test's number is re-baselined in the same commit. Do not build a second badge beside it. |
| The org model is flat, with only **two access levels** (member / admin). | memory: `project_org_model_flat_with_inert_departments` | Approver groups, "first to respond" and escalation chains have nothing to attach to. They are anti-features for v1. |

---

## 1. Feature Landscape

### Table Stakes (users assume these exist)

#### A. A URL for every view

| Feature | Why expected | Complexity | Depends on (existing) | Notes |
|---|---|---|---|---|
| **Each top-level view has a path** (`/chat`, `/workflows`, `/library`, `/experts`, `/settings`, `/admin`, `/org`) | Every comparable product does this. Loading `/workflows` cold and getting chat (measured in SEED-185) reads as broken. | MEDIUM | `ActiveView` union, `activeViewReachability.ts`, existing host rewrites | Mechanical once a router is chosen. The union *is* the route table. |
| **Entity deep links**: thread, workflow (builder), workflow run, Expert | ChatGPT `/c/{id}` and Claude.ai `/chat/{uuid}` (LOW: common knowledge, not documented), Temporal `/namespaces/{ns}/workflows/{wfId}/{runId}/history` (MEDIUM: community forum + third-party guide), n8n execution views. A run that can't be linked has to be described in prose. | HIGH | SEED-178 (thread restore), `WorkflowRunPage`, `ExpertDetailModal` (today a modal held in page state) | The real work is **restore-from-id**: the entity must load *from the URL*, not from a click that came before it. The Expert detail modal needs a URL of its own (`/experts/:id`) and must open over the catalog. |
| **Refresh lands in the same place** | F5 losing your place is the most-felt defect (SEED-015, SEED-178). | Falls out of the above | Same | The definition of done is SEED-178's console check: the URL carries the id, and F5 restores the conversation. |
| **Back / Forward work** | Standard browser behaviour. Users notice when it is missing. | LOW once routed | Router | ⚠ Decide which changes **push** a history entry and which **replace** one (§2.2). Pushing every tab click makes Back unusable. |
| **Open in new tab / middle-click / Cmd-click** | Links must be real `<a href>`, not click handlers. | MEDIUM (sweep) | NavPanel, list rows, cards | Every nav row, run row, thread row and Expert card should render an anchor. This is a broad but shallow sweep over many G-5-firing files. |
| **"Copy link" affordance** on a thread, run, workflow and Expert | Linear has a link icon on the issue sidebar (LOW: third-party guide). Notion has "Copy link". GitHub has permalinks. | LOW | The routes | A button that copies the canonical URL. It does **not** create a public or share token (see Anti-features). |
| **A link to something you can't open fails clearly and leaks nothing** | GitHub returns **404 instead of 403** for private repos so it does not reveal they exist (HIGH: GitHub REST docs). Slack deep links show **an HTTP 404 page** if you lack access or the channel doesn't exist (HIGH: Slack deep-linking docs). | MEDIUM | RLS, the inbound-API 404 precedent, the feature-visibility map | One worded page: *"This link can't be opened. It may not exist, or you may not have access."* The same text for missing and forbidden. Never render an empty shell of the view (SEED-185 failure criterion #1). |
| **Signed-out user opens a deep link → sign in → lands on the link** | Slack: *"users will be sent to their default team or asked to sign in"* (HIGH). Universal pattern. | MEDIUM | `useAuth`, the `/setup` and `/invite` entry flows | Keep the intended path across login (a `?next=` or saved path). ⛔ Only accept same-origin relative paths, to avoid an open redirect. `/setup` and `/invite` must behave exactly as before (SEED-185 #3). |
| **A view the user's audience can't see → refusal, not blank** | Admin-only routes typed by a member. | LOW | The API-enforced feature-visibility map, Control Room and Org Admin gates | The server already decides. The route only needs a refusal render. |
| **Existing link contracts keep working** (`/app?run=`, `/admin/spend`, `/app?connections=1`) | OAuth redirect URIs are registered outside the product. | LOW | App.tsx boot readers | Redirect them to canonical routes, or alias them. Never remove them. |

#### B. Told when a run waits on you

| Feature | Why expected | Complexity | Depends on (existing) | Notes |
|---|---|---|---|---|
| **In-app "waiting on you" indicator** (nav badge + popover list) | Every approval product shows pending items. GitHub shows *"a notification for the review request"* on the run (HIGH: GitHub docs). | LOW–MEDIUM | `attentionConditions.ts` seam (one tenant), `NavPanel` badge, `ChatLayout` single reader | Register the producer. Re-baseline `length === 1` → `2` in the same commit. The server provides the verdict. |
| **Each notice links straight to the waiting run** | The point of the milestone. Linear: clicking a notification opens the issue (HIGH: Linear inbox docs). Zapier: *"the notification includes a link to the step that needs review"* (HIGH: Zapier help). | LOW once routing exists | Routing (§A), run deep link | **Hard dependency: routing ships first.** |
| **Email to the run owner when a run starts waiting**, from an app-owned sender | Nobody is in the app at 4 a.m. (SEED-281 rule 1). Zapier notifies reviewers by email, Slack or another Zap (HIGH). | MEDIUM | New: app-owned mailer (one secret, env only), the run-owner `user_id` | Must cover schedule, API-key, thread and starter runs alike. That works because all of them have an owner `user_id`. |
| **The notice clears itself when the wait is resolved** (answered, approved, cancelled, run stopped) | A stale "waiting" badge trains people to ignore it. This is SEED-281's own "muted channel" warning. | MEDIUM | `/pending` liveness checks (`_prompt_run_is_live`), the run lifecycle | The in-app list is **derived from current state** (server query), not from a log of sent events, so it cannot go stale. |
| **Quiet about routine success** | SEED-281 rule 3. Linear and Slack both default to only important events. | — (a scoping rule) | — | v1 triggers: *waiting for an answer* and *waiting for approval*. Nothing for "completed". |
| **Email is legal and deliverable**: SPF/DKIM, aligned From, a working reply-to or a clearly no-reply sender, a footer naming the app and why you got it, a link to notification settings | Gmail requires **SPF or DKIM, valid PTR, TLS and a spam rate below 0.3%** from *all* senders (HIGH: Google sender guidelines). | LOW (code) / MEDIUM (ops: DNS) | New mailer, deploy parity checklist | Domain DNS records are the non-code half. Add them to `docs/DEPLOYMENT-WORKFLOW.md` parity. |
| **A per-user email off switch for this notification type** | Every reference product has per-type and per-channel settings (Linear: *"choose which update types to receive on each channel"*, HIGH). | LOW | `user_settings` (settings live in the UI, not env) | One toggle: "Email me when a run is waiting on me" (default **on**). The in-app badge cannot be turned off. |

#### C. Lists follow the active org

| Feature | Why expected | Complexity | Depends on (existing) | Notes |
|---|---|---|---|---|
| **Library folders and the Workflows list show only the active org's items** | Linear: *"Each workspace will have distinct member lists and separate billing plans"* (HIGH). Temporal: selecting a namespace opens *its* workflows (HIGH). Vercel and Slack scope the dashboard to the selected team. No reference product mixes two workspaces' items in one list. | LOW–MEDIUM | `X-Org-Id` validation (create already stamps the org since 296-01), `fetch_visible_folders`, the workflows list query | Filter by the **validated** active org, using the same read that create uses. Global folders and skills stay visible (CLAUDE.md: the only shared scope). |
| **Switching org refetches every scoped list and leaves org-specific deep pages** | After a switch, the Builder of an org-A workflow is not valid in org B. | MEDIUM | `ChatLayout.orgRefetch.test.tsx` (a refetch seam exists), the router | On switch, go to the list view of the current section (`/workflows`, `/library`), not the entity. Slack, Linear and Vercel all land you on the workspace home. |
| **Pickers follow the same scope** (KB folder picker inside a workflow, Expert scope picker) | SEED-389's concrete harm: picking org A's folder as the KB in an org-B workflow. | MEDIUM | `DescribeKbPicker`, the workflow KB picker, Expert scope | ⚠ This is where a cross-org mix becomes a *wrong run*, not just a cluttered list. The server must reject a foreign-org folder id at save or launch, not only hide it in the UI. |
| **Existing items created before org-stamping are handled deliberately** | Older rows may carry a null or first-org `org_id`. | MEDIUM (decision + possible migration) | Migrations from 217 | Decide: backfill to the user's oldest org, or show them in every org they belong to. This needs measuring (count of null-`org_id` rows) before planning. |

### Differentiators (where this product can do better than the references)

| Feature | Value proposition | Complexity | Notes |
|---|---|---|---|
| **The run page *is* the answer page.** The email and the badge carry no decision buttons. They open the run, where `PendingAskCard` shows the question with its evidence. | SEED-281 rule 2: *"the notification says go and look; the run surface stays the authority"*. Power Automate's actionable approval emails need a special sender, and guest users must use the portal (HIGH: Microsoft docs), which shows how much auth surface an email-borne decision brings. Approving from inside the evidence is safer and more honest. | LOW | This is also cheaper than actionable email, so the differentiator and the cost saving agree. |
| **The notice says *why* it is waiting, in words**: "Paused for your approval before *sending an email to 3 recipients*", or "Asking: *Which quarter should the report cover?*", plus the origin ("scheduled run at 04:19", "started by API key *Zapier prod*"). | Glean, n8n and Zapier emails mostly say "approval requested". Naming the action, the origin and the question lets a person triage from a phone. | LOW–MEDIUM | Origin is already on the run (`origin_kind` / `origin_ref`, Phase 293). The armed-checkpoint action description already exists for the review moment. |
| **The email is skipped if you already saw it in-app** (a short delay, then send only if unread or unresolved) | Linear: email digests are *"only sent if you haven't already read the Linear inbox notification"* (HIGH). Slack: email only *"when you're not active in Slack"*, bundled every 15 min or hourly (HIGH). Knock lists *"email only if the in-app message has not been seen"* as a standard step condition (MEDIUM). | MEDIUM | Needs a delayed job, which the existing scheduler or Redis can host. ⚠ For the 4 a.m. case the delay costs little, since nobody is looking. For an active user it avoids a duplicate email. **v1 can ship "send when still unresolved after N minutes"**: resolved state is already server truth, and read-tracking can come later. |
| **One reminder if it's still waiting** | Zapier has a **"Send reminder" value + unit after the initial notification** (HIGH). Because a waiting run is now durable (§0), a single reminder (e.g. at 24 h) is the honest form of SEED-281's N-2. | LOW–MEDIUM | Exactly one reminder, not a cadence. Name it in the email ("Still waiting since 04:19 yesterday"). |
| **A link that names the org it belongs to, and offers to switch** | If a two-org user opens an org-B run while org A is active, say *"This run is in **Acme Ops**. Switch to Acme Ops to open it."* instead of 404-ing. Slack sends you to your default team or asks you to sign in (HIGH). This is only possible because the user **is** a member of B. | MEDIUM | ⚠ Only reveal the org name when the user is a member of that org. For non-members the response must be the same no-leak 404. This needs a server endpoint that resolves an entity id to the requester's membership. |
| **The schedule shows "last run is waiting on you"** | Closes SEED-281 N-3's sibling: `last_status` is rendered nowhere a person passes. | LOW | Reuses the same "waiting on you" query. Optional. |

### Anti-Features (seem good, cause problems — explicitly do NOT build in v4.8)

| Anti-feature | Why requested | Why problematic | Alternative |
|---|---|---|---|
| **Approve/Reject buttons inside the email** (actionable or magic-link email) | Faster. Power Automate and n8n "send and wait" do it. | A link that *acts* is a bearer credential. It can be forwarded, prefetched by mail scanners (link scanners click GET links), and needs its own expiry, replay and CSRF story. SEED-281 rule 2 forbids it. Power Automate restricts actionable mails to its own sender and excludes guests (HIGH), which shows the cost. | The email links to the run; the decision happens behind normal auth. |
| **Public / anonymous share links** (ChatGPT `/share/…` style snapshots) | "Share a link" sounds like this. ChatGPT consumer links let *"anyone who has access to a shared link"* view (HIGH: OpenAI FAQ). | This is a new access model (a token beside RLS) on a B2B product with retention and legal hold. Snapshot-vs-live, revocation and what happens on delete all need policy. The milestone's own wording is *"the server still decides who may open them"*. | v4.8 links are **same-auth links only**: they work for anyone RLS already allows. Plant a seed for external sharing. |
| **Org slug in every path** (`/o/acme/workflows/…`) as part of v4.8 | Linear, Vercel, Slack and Temporal put the workspace in the URL. | It pulls in slug minting, uniqueness and rename handling (Linear lets admins change the *"domain key"*, HIGH, so old links must redirect), and every route and test changes. The entity ids are already globally unique UUIDs, so the server can resolve the org from the id. | **Keep the org out of the path.** Resolve it from the entity, and handle a mismatch with the "switch to org X" prompt above. Revisit at Open Platform (v4.9), which needs stable public URLs anyway. |
| **Full notification centre / inbox with history, snooze, archive and every event type** | Linear, GitHub and Slack have one. | Scope explosion. SEED-281 rule 3 (quiet by default). Linear itself caps at 2,000 open notifications and doesn't support archive (HIGH), so even the leaders keep it narrow. | A **derived "waiting on you" list**: current state, not an event log. Add an event log when a second notification type with no live state appears (e.g. N-3 "scheduled run failed"). |
| **Approver groups / "first to respond" / "everyone must approve" / escalation to admins** | Retool assigns tasks to user *groups* (MEDIUM: archived docs). Power Automate has all-must-approve modes. | The org model has two access levels and inert departments, so there is nothing to route to. Microsoft *deprecated* "first to respond" (HIGH). Escalation to admins puts an org admin in the path of every member's run. | **Run owner only** in v1. SEED-281 rule 4 says the recipient question must not be assumed. Record it as a seed with a trigger such as "the first org that needs someone other than the owner to approve". |
| **Auto-approve or auto-skip on timeout** | Zapier offers *"Skip and continue"* on timeout (HIGH). | SEED-281: *"Auto-approving an unattended run because nobody was told is the wrong repair."* An armed checkpoint is the one thing that behaved correctly. | Notify, remind once, leave the run durably paused. An author may choose to keep armed steps out of scheduled workflows. |
| **Email on every run completion / daily digest of all activity** | Feels informative. | A muted channel then fails to deliver the one email that matters (SEED-281 rule 3). | Event-specific, only when a person must act. |
| **Putting ephemeral UI state in the URL** (scroll position, open popovers, the composer draft, panel width, every tab of every page) | "Everything should survive refresh." | Makes URLs long and noisy, and every interaction becomes a history entry, which breaks Back. | URL = **identity + the major sub-view** (see §2.2). Everything else stays in local state or localStorage, as today. |
| **Web push / mobile push / Slack DM channel in v4.8** | Slack and Linear offer push. | Each is its own delivery stack (service worker + VAPID, an app, a Slack app install). The milestone already adds one new piece of infra (the mailer). | Email + in-app. Push goes to a seed. |
| **Marketing-style unsubscribe machinery** (List-Unsubscribe one-click, preference centre for a product email that is transactional) | Gmail bulk-sender rules. | Google's one-click requirement applies to *"marketing messages and subscribed messages"* from senders above **5,000/day** (HIGH). CAN-SPAM exempts transactional or relationship messages from most provisions; they only must not carry false routing information (HIGH: FTC). | A clear "Manage notification emails" link to the in-app setting, and honest headers. Revisit if volume or content ever turns promotional. ⚠ Not legal advice. EU/UK operators (GDPR/PECR) should confirm. |

---

## 2. How comparable products do it — the specifics the roadmap needs

### 2.1 URL shapes and where the org lives

| Product | Shape (observed) | Org/workspace in URL? | Confidence |
|---|---|---|---|
| Linear | `linear.app/<workspace>/issue/<TEAM-123>/<slug>` | Yes, a path slug ("domain key", admin-editable) | Slug editability HIGH (docs); exact path LOW (third-party + common knowledge) |
| Slack | `app.slack.com/client/<T_TEAM>/<C_CHANNEL>`; permalinks `<ws>.slack.com/archives/<C>/p<ts>` | Yes, a team id in the path or subdomain | MEDIUM (Slack API `chat.getPermalink` example + third-party guides) |
| Temporal UI | `/namespaces/<ns>/workflows/<workflowId>/<runId>/history` | Yes (namespace) | MEDIUM (community forum + third-party guide; namespace switcher HIGH) |
| Vercel | `vercel.com/<team-slug>/<project>/…` | Yes | LOW (common knowledge; docs only describe a scope selector) |
| GitHub | `github.com/<org>/<repo>/actions/runs/<id>` | Yes (owner is part of the resource's identity) | LOW (common knowledge) |
| ChatGPT / Claude.ai | `chatgpt.com/c/<id>`, `claude.ai/chat/<uuid>` | **No.** Workspace is session state | LOW (common knowledge) |
| Notion | `notion.so/<workspace>/<Title>-<id>` | Cosmetic. The id resolves the page | LOW |

**Read-across:** products whose entities are *named within* a workspace (Linear `ENG-123`, GitHub repos, Temporal workflow ids) need the workspace in the path to be unique. Products with **globally unique ids** (ChatGPT, Claude.ai, Notion) don't. All our entities (threads, runs, workflows, Experts) are UUIDs, so the Claude.ai/ChatGPT pattern fits: **no org in the path; the server resolves it.**

**Recommended shapes** (relative to the app base: `app.<domain>/` in cloud, `/app/` on one-box):

```
/chat                      new chat
/chat/:threadId            a thread                          (SEED-178, SEED-015)
/library                   Library (folder via ?folder=:id or /library/folders/:id)
/workflows                 Workflows library
/workflows/:workflowId     Builder / workflow detail
/runs/:runId               a workflow run                    (notification target)
/experts                   Expert catalog
/experts/:expertId         Expert detail (today a modal)
/skills, /skills/:skillId/:tab     Skill Studio
/settings/:tab             Settings (tabs are real sub-views)
/connections               Connections (OAuth callback lands here: keep ?connections=1 alias)
/admin/:tab                Control Room (keep /admin/spend)
/org/:tab                  Org Admin
```

`/runs/:runId` is flat rather than nested under `/workflows/:id/runs/:runId`. The run is the notification target, and the email builder shouldn't need the workflow id. Temporal nests because run ids are only unique within a workflow, and ours are UUIDs. (Nesting is fine if preferred. Flat keeps the email link a single id.)

### 2.2 What belongs in the URL vs not

| In the URL (path or query) | NOT in the URL |
|---|---|
| Section (view), entity id (thread/run/workflow/Expert/skill), a sub-view that is a *place* (Settings tab, Skill Studio tab, Admin tab), Library folder, a saved Library View id, a search query on the Find page if shareable | Active org (header + localStorage; resolved from the entity on deep link), panel open/collapsed and width, scroll position, composer draft, model picker selection, popovers/dialogs except entity-detail modals, streaming state |

**Push vs replace:** push on section and entity changes; **replace** on tab or filter changes inside one entity, so Back leaves the entity rather than replaying its tabs. Never push during streaming or auto-redirects (e.g. "new chat → created thread id" should *replace* `/chat` with `/chat/:id`).

### 2.3 Link to something in another org / without access

- **GitHub:** 404, not 403, to avoid revealing existence (HIGH).
- **Slack:** not signed in → default team or sign-in; private channel without membership or nonexistent → HTTP 404 page (HIGH).
- **Notion:** offers to request access, and tells users to check they're signed into the right account (HIGH: help article).
- **Recommended:** (1) Not signed in → sign in → return to the link. (2) The entity exists in an org the user **is a member of** but which isn't active → interstitial "This is in *Org B*. Switch?" (3) Anything else (deleted, other user's private thread, org you're not in) → one identical "can't be opened" page. Request-access is an anti-feature for v4.8 because there is no sharing model to request into.

### 2.4 Notifications — reference behaviour

| Concern | Reference behaviour | Source / confidence | Recommendation for v4.8 |
|---|---|---|---|
| In-app inbox vs badge | Linear: always-on inbox, read/unread (`U`), snooze, *Priority* tab, max 2,000, no archive. GitHub: run page shows "a notification for the review request". | Linear docs HIGH; GitHub docs HIGH | Badge + popover list of **currently waiting runs** via the existing attention seam. No event log. |
| Read/unread | Linear toggles and uses it to suppress email. | HIGH | Not needed in v1: the list is derived from live state, so "resolved" replaces "read". |
| Email: immediate vs digest | Linear: digest or immediate, digest delayed by urgency, skipped if read. Slack: bundled every 15 min / hourly when not active. | HIGH | **Immediate-ish** (short delay, skip if already resolved). An approval is urgent; a digest would defeat N-1. |
| Per-user preferences | Linear: per type × channel. GitHub: per-org email routing (pick a verified address per org). | HIGH | One toggle per user. ⚠ Per-org email address (GitHub style) is a nice later touch for two-org users; v1 uses the auth email. |
| Reminder / escalation | Zapier: one reminder value + unit, timeout with *Skip and continue* or *End run*. GitHub deployments: reviewers up to 6, one approval unblocks. n8n Wait: indefinite unless a limit is set (third-party). | Zapier HIGH; GitHub env reviewers MEDIUM; n8n LOW | One reminder. No escalation. No auto-continue. |
| Who is notified | Zapier: specific account members or anyone by email (must log in). Retool: user groups. Power Automate: assigned approvers. | Zapier HIGH; Retool MEDIUM; MS HIGH | **Run owner** (the schedule owner or key owner for unattended runs, already the run's `user_id`). |
| Notify on resolution | Linear and GitHub update the item in place; no "it was approved" email by default. | MEDIUM | The in-app item disappears. No resolution email. ⚠ N-4 (a scheduled run's outbound action really sent something) is a *different* notification. Leave it in the SEED-281 register. |
| Transactional email legal | CAN-SPAM: transactional/relationship messages exempt from most provisions, must not have false routing info; categories construed narrowly. Gmail: SPF/DKIM, PTR, TLS and spam rate below 0.3% for all senders; one-click unsubscribe only for marketing/subscribed mail from >5k/day senders. | FTC HIGH; Google HIGH | Treat as transactional: accurate From/Reply-To, no promotional content, a link to the setting. Configure SPF + DKIM (+ DMARC `p=none`, cheap insurance). |

### 2.5 Per-org list scoping on switch

Linear (distinct members and billing per workspace; switch via `O W`), Temporal (namespace switcher opens that namespace's Recent Workflows) and Slack (team in the URL) all treat the workspace as a **hard boundary on lists**. None show a cross-workspace union by default. The union (a cross-workspace inbox, as in Linear's or Slack's multi-workspace clients) only exists for **notifications**, which leads to one decision worth making explicitly:

> **Does the "waiting on you" badge count runs in *all* your orgs, or only the active one?** Recommendation: **the badge counts all orgs** (a 4 a.m. approval in org B must not be invisible because org A is active), and **each list row names its org** and offers the switch. That is the one place where crossing the org boundary is the right call. It means the producer query is per-user, not per-active-org. Flag this for the requirements step.

---

## 3. Feature Dependencies

```
Router + route table (A)
    ├──requires──> preserve /setup, /invite, /admin/spend, ?run=, ?connections=1 (OAuth URIs)
    ├──requires──> restore-from-id for thread / run / workflow / Expert   (SEED-178 inside)
    ├──requires──> "can't be opened" page + post-login return-to
    └──enables───> Copy link, new-tab anchors, Back/Forward

Org-mismatch interstitial ──requires──> Router + server "which org is this entity in, for me?"
                          ──enhances──> Lists follow active org (C)

"Waiting on you" server query (per user, all orgs)
    ├──requires──> run pause states measured per type (human_input = durable pause since 200;
    │              engine-ask dispositions re-measured)
    ├──feeds─────> attention producer #2 (badge + list)   ──requires──> Router (/runs/:id)
    └──feeds─────> Email job ──requires──> app-owned mailer (secret + DNS + deploy parity)
                             └──requires──> Router (link target must exist BEFORE first email)
    One reminder ──requires──> Email job + a delayed/scheduled check

Lists follow active org (C)
    ├──requires──> validated X-Org-Id read in list queries (create already uses it, 296-01)
    ├──requires──> decision on legacy rows with null/other org_id
    └──should pair──> server-side rejection of foreign-org folder ids at save/launch

Public share links ──conflicts──> "server/RLS decides" (milestone wording) — defer
Actionable approve-in-email ──conflicts──> SEED-281 rule 2 — never
```

### Dependency notes

- **Notifications require routing.** An email that links to `/app` lands on chat, which repeats the exact failure SEED-185 lists ("every link lands on the chat home"). Ship routing, including `/runs/:id` restore, before the first email is sent. PROJECT.md already states this ordering.
- **Lists-follow-org is independent of routing** and is the smallest piece. It can run in parallel or first. It *enhances* routing, because the org-mismatch interstitial is how a deep link interacts with the active org.
- **The "waiting on you" query is the shared core.** Badge, email and reminder all read it. Build it once on the server (D-235-05), then add each channel on top.
- **The mailer is new infra with a non-code half** (DNS records, a provider secret in Coolify, one-box env example, `check-deploy-drift.sh` registration). It falls under the deployment-artifact parity rule.

---

## 4. MVP Definition

### Launch with (v4.8)

- [ ] **Router with the full route table** from the current 12-member `ActiveView`, canonical paths for every view, and entity routes for thread, run, workflow and Expert (essential: the milestone's namesake and the link target for everything else).
- [ ] **Restore-from-id** for those four entities, plus F5/Back/Forward working (SEED-178's definition of done).
- [ ] **Legacy link contracts kept** (`?run=`, `?connections=1`, `/admin/spend`, `/setup`, `/invite`).
- [ ] **One no-leak "can't be opened" page**, plus sign-in → return-to-link.
- [ ] **Copy link** on thread, run, workflow and Expert, and real anchors so new tabs work.
- [ ] **Server "waiting on you" query** (per user, all orgs, live-state derived).
- [ ] **Attention producer #2**: badge + popover list, each row linking to `/runs/:id` and naming its org.
- [ ] **App-owned mailer + one email per newly-waiting run** to the run owner, sent only if still unresolved after a short delay, with words (what it's waiting for, origin, when). One user setting to turn it off.
- [ ] **Library folders + Workflows list + KB pickers scoped to the active org**, with a server-side guard against foreign-org ids, and a decision on legacy rows.

### Add after validation (v4.8.x / next)

- [ ] **One reminder email** after N hours still waiting. Trigger: the first real wait that outlives a working day. Cheap if the email job is built with a "check again later" step from day one.
- [ ] **Org-mismatch interstitial** ("This is in Org B — switch?"). Trigger: the first two-org user who follows a link while the wrong org is active. Can ship in v4.8 if the routing phase has room; without it, show the same 404.
- [ ] **N-3 "a scheduled run failed" notification**. Trigger: as SEED-281 records. Uses the same mailer, but needs an event log because a failure has no live waiting state.
- [ ] **Per-org notification email address** (GitHub custom routing). Trigger: a two-org user asks.

### Future consideration (v4.9+ / seeds)

- [ ] **External / public share links**: needs a sharing and access model (Open Platform era).
- [ ] **Org slug in URLs**: revisit with Open Platform's public URLs.
- [ ] **Approver groups, delegation, escalation**: needs an org role model beyond member/admin.
- [ ] **Web/mobile push, Slack/Teams delivery**.
- [ ] **Notification centre with history, snooze, read state**: only once a second non-live notification type exists.

---

## 5. Feature Prioritization Matrix

| Feature | User value | Implementation cost | Priority |
|---|---|---|---|
| Router + view paths + Back/Forward | HIGH | MEDIUM | P1 |
| Entity restore-from-id (thread/run/workflow/Expert) | HIGH | HIGH | P1 |
| Legacy link + OAuth callback preservation | HIGH (breakage otherwise) | LOW | P1 |
| No-leak "can't be opened" + login return-to | HIGH | MEDIUM | P1 |
| Copy link + real anchors | MEDIUM | LOW–MEDIUM | P1 |
| "Waiting on you" server query | HIGH | MEDIUM | P1 |
| Badge/list producer #2 | HIGH | LOW | P1 |
| App-owned mailer + waiting email | HIGH | MEDIUM (+ ops) | P1 |
| Email off-switch setting | MEDIUM | LOW | P1 |
| Lists + pickers follow active org (+ server guard) | MEDIUM–HIGH | LOW–MEDIUM | P1 |
| Worded notice (action, origin, question) | MEDIUM | LOW | P1 (it's mostly copy) |
| Skip email if already resolved (delay) | MEDIUM | MEDIUM | P2 |
| One reminder | MEDIUM | LOW once delay exists | P2 |
| Org-mismatch interstitial | MEDIUM | MEDIUM | P2 |
| Public share links | MEDIUM | HIGH | P3 (anti for v4.8) |
| Approve-from-email | MEDIUM | HIGH + risk | Never (anti) |

---

## 6. Competitor Feature Analysis

| Feature | Linear | Slack | Zapier HITL | GitHub (Actions/Repos) | ChatGPT/Claude.ai | Our approach |
|---|---|---|---|---|---|---|
| Entity URL | Workspace slug + issue id | Team id + channel id | Link to the step needing review | Owner/repo/run id | `/c/:id`, `/chat/:uuid`, no workspace | UUID routes, no org in path |
| No-access link | — | 404 page; sign-in or default team | Reviewer must log in to a Zapier account | 404, not 403 | — | One identical 404 page; interstitial only for orgs you're in |
| In-app | Inbox, read/unread, snooze, Priority tab | Badges/mentions | — | Notification on the run | — | Badge + live "waiting on you" list |
| Email | Digest or immediate; skipped if read | Bundled 15 min/hourly when inactive | Email/Slack/Zap to reviewers | Notification email (MEDIUM) | — | Per waiting run, delayed + skipped if resolved |
| Reminder | Reminders on issues | — | One reminder (value + unit) | 30-day job timeout (MEDIUM) | — | One reminder (P2) |
| Timeout behaviour | — | — | Skip and continue / End run | Job fails | — | Run stays durably paused; never auto-approve |
| Who | Subscribers | Mentioned/DM | Account members or any email | Up to 6 reviewers/teams; 1 unblocks | — | Run owner only |
| Workspace scoping | Distinct per workspace; `O W` switch | Per team | Per account | Per org | Per workspace | Lists per active org; badge spans orgs |

---

## Sources

**Official (HIGH)**
- Linear — Notifications: https://linear.app/docs/notifications (channels, digest vs immediate, *"only sent if you haven't already read"*)
- Linear — Inbox: https://linear.app/docs/inbox (read/unread, snooze, Priority tab, 2,000 cap, no archive)
- Linear — Workspaces: https://linear.app/docs/workspaces (distinct members/billing, editable domain key, `O W` switch)
- Slack — Deep linking: https://docs.slack.dev/interactivity/deep-linking (team id, sign-in/default team, 404 for no access)
- Slack — Guide to notifications: https://slack.com/help/articles/360025446073 (email when not active, bundled 15 min/hourly)
- Slack — `chat.getPermalink`: https://api.slack.com/methods/chat.getPermalink
- Zapier — Human in the Loop Collect Data/approval: https://help.zapier.com/hc/en-us/articles/38731264910733/ (reviewer types, channels, timeout + *Skip and continue/End run*, reminder)
- GitHub — REST troubleshooting (404 instead of 403): https://docs.github.com/en/enterprise-server@3.0/rest/overview/troubleshooting
- GitHub — Reviewing deployments: https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/review-deployments
- GitHub — Managing organization notifications (custom routing): https://docs.github.com/subscriptions-and-notifications/how-tos/managing-organization-notifications
- Temporal — Web UI (namespace switcher): https://docs.temporal.io/web-ui
- Google — Email sender guidelines: https://support.google.com/a/answer/81126
- FTC — CAN-SPAM Act compliance guide: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- Microsoft — Approvals connector (deprecated first-to-respond, guest limitation): https://learn.microsoft.com/en-us/connectors/approvals/
- OpenAI — ChatGPT shared links FAQ: https://help.openai.com/en/articles/7925741
- Notion — Can't access my own page: https://www.notion.com/help/cant-access-my-own-page

**Secondary (MEDIUM/LOW, flagged inline)**
- Temporal run-URL shape: https://community.temporal.io/t/web-ui-only-shows-most-recent-run-history-cannot-view-history-of-old-runs/11254
- Knock step conditions / read-status sequencing: https://docs.knock.app/getting-started/knocks-features, https://knock.app/changelog/2021-05-12
- Retool user tasks (archived 3.75 docs): https://docs.retool.com/3.75/workflows/guides/user-tasks
- GitHub environment reviewers / 30-day timeout (third-party): https://oneuptime.com/blog/post/2026-01-25-github-actions-environment-protection-rules/view
- n8n Wait/HITL timeout advice (third-party): https://en.kirim.email/blog/email-approval-workflow-n8n-human-in-the-loop/
- Linear "copy issue URL" chain icon (third-party): https://www.guideflow.com/tutorial/how-to-copy-a-url-from-an-issue-on-linear

**Repo (HIGH, measured this session)**
- `frontend/src/App.tsx:132, 156-171, 319-337`; `frontend/vercel.json`; `frontend/nginx.conf`; `frontend/src/components/layout/attentionConditions.ts`; `backend/app/services/harness/human_input.py`; `backend/app/config.py:1408-1416`; `backend/app/api/panel.py:164`; `backend/app/api/inbound.py`; `backend/app/services/scheduler_service.py:103`; seeds SEED-015, SEED-178, SEED-185, SEED-281, SEED-389.

---
*Feature research for: v4.8 Every Page Has a Link (addressable URLs, waiting-run notifications, per-org lists)*
*Researched: 2026-10-27*
