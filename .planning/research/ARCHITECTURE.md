# Architecture Research — v4.8 "Every Page Has a Link"

**Domain:** Integrating addressable URLs, waiting-run notifications (in-app + email) and an active-org list filter into an existing React 19 / FastAPI / Supabase app with no router
**Researched:** 2026-10-27
**Confidence:** HIGH for every claim about existing code (each read directly, cited `file:line`). MEDIUM for the recommended designs (they follow precedents already in this repo, but are not yet built). LOW items are flagged inline.

> Line numbers are as of `develop` @ `de569cfce` (2026-10-27). Hot files move fast — re-derive before planning against a number.

---

## 0. Six findings that change the plan

1. **A router precedent already exists in this repo, just not in the app entry.** `frontend/src/docs/router.ts:11-55` is a hand-rolled pure resolver (`resolveRoute(pathname, manifest)`) plus a History API `navigate()` that pushes and dispatches a synthetic `popstate` (`:52-55`), and `DocsApp.tsx:150` listens for it. The app entry can copy that shape. It does not have to adopt a framework router.
2. **`/app/...` already resolves to the SPA on every host, with no infra change.** Dev: `devRouting.ts:30` sends every dot-less path to `app.html`. Vercel: `vercel.json` rewrites `/app/(.*)` → `/app.html` on any host, rewrites *everything* on `app.*` hosts, and redirects apex `/app/(.*)` → `https://app.:host/app/$1`, so the path survives. Onebox nginx: `nginx.conf` `location /app/ { try_files $uri /app.html; }`. **Bare paths such as `/runs/<id>` would break on onebox** (`location /` → `/index.html`, the landing page) **and on `*.vercel.app` previews.** So the canonical URL scheme must be `/app/...`.
3. **An app-owned mailer already exists.** `backend/app/services/email_provider.py:1-105` (Phase 167) has a `ResendProvider` behind `EMAIL_PROVIDER=resend` + `RESEND_API_KEY` + `INVITE_FROM_EMAIL` (`config.py:1718-1725`), with the link base taken from `primary_frontend_origin()`. SEED-281's *"there is no app-owned mailer"* is out of date. ⚠ But the `resend` package is **not** in `backend/requirements.txt` or any Dockerfile (grep found nothing). `ResendProvider.send_invite` imports it lazily (`email_provider.py:70`), so on a deployed image with `EMAIL_PROVIDER=resend` that import fails, and `org.py:409-413` catches and logs it. Invite email has probably never sent from production (LOW confidence: production env not inspected). Building the email half is therefore *generalise and actually ship the sender*, not *add a sender*.
4. **The durable "ask" record is a `messages` row, and its answer is another `messages` row.** Prompt: `role='system'`, `tool_calls[0].kind='ask_user_prompt'`, carrying `run_id` + `tool_call_id`. Answer or expiry: a `kind='ask_user_response'` row with the matching `tool_call_id` (`harness_engine.py:215-235`, `db/workflows.py:1793-1830`). Every workflow-run pause kind writes that prompt row: human gate `human_input.py:233-256`, action-risk / ask disposition `engine_ask.py:451-475`, engine no-match pause `engine_ask.py:1013-1040`, and chat `ask_user` `tools/agent_control.py:377-392`. Every resolution writes the response row: answer route `api/runs.py:933+`, terminal expiry `_expire_pending_ask_user`. **A database trigger on those two row shapes covers every producer and every resolution path without editing a single G-5 engine file.**
5. **`messages.org_id` is wrong for two-org users on prompt rows.** None of the four prompt INSERTs sets `org_id`, so `messages_autofill_org_id` (`full-schema.sql:7050`) runs `autofill_org_id_by_owner`, which takes `org_members … LIMIT 1` with no `ORDER BY` (`full-schema.sql:75-79`). For a two-org user that is an arbitrary org. **A notification must take its org from `workflow_runs.org_id`, never from the prompt row.**
6. **The SEED-389 defect has siblings the seed does not name.** `GET /threads` filters only on `user_id` + `is_eval` (`api/threads.py:279-286`). RLS lets the caller see every org they belong to (`full-schema.sql:9117`, `org_id IN current_user_org_ids()`). So the thread sidebar is also all-orgs, even though `ChatLayout.tsx:193-197` claims an org switch *"fetches the NEW org's threads"*. `GET /workflow-runs` (`api/workflow_runs.py:658-700`) is owner-scoped across orgs too. Both need an explicit per-org decision at intake (MEDIUM: read from code, not driven live).

---

## 1. Standard Architecture

### System Overview (target state)

```
┌──────────────────────────── Browser (app.html) ────────────────────────────────┐
│                                                                                 │
│  location (/app/...)  ──parse──►  useAppNavigation()  ◄──popstate──  History    │
│        ▲                         (NEW, App.tsx seam)                            │
│        └──── navigate(route,{replace}) ─────┘   │ route: AppRoute               │
│                                                 ▼                               │
│   App.tsx ── activeView + per-view ids ──► ChatLayout ──► AppViewSwitch (NEW)   │
│                                               │                                 │
│        useDeepLinkResolver (NEW) ── entity GET ─► org check ─► OrgProvider      │
│               │                                     .switchOrg (existing)       │
│               ▼                                                                 │
│     useThreads.selectThread (existing) ──► ChatArea useLayoutEffect             │
│                                  ──► StreamsProvider.setViewingThread (SOLE     │
│                                      writer of activeThreadIdRef — unchanged)   │
│                                                                                 │
│   ATTENTION_PRODUCERS: [stopped-sources, waiting-runs (NEW)]                    │
│        └── GET /notifications?state=open (server verdict, polled)               │
└─────────────────────────────────────────────────────────────────────────────────┘
                          │ X-Org-Id (validated server-side)
┌──────────────────────────── FastAPI (2 workers) ───────────────────────────────┐
│  /folders, /workflows/published|drafts ─► resolve_active_org_or_none ─► filter  │
│  /notifications (NEW router)  ─ read / mark-read                                │
│  NotificationDrainer (NEW, every worker) ─ FOR UPDATE SKIP LOCKED ─► Resend     │
│  app_links.run_link() (NEW) = primary_frontend_origin() + "/app/runs/<id>"     │
└─────────────────────────────────────────────────────────────────────────────────┘
                          │
┌──────────────────────────── Postgres (Supabase) ───────────────────────────────┐
│  messages ──AFTER INSERT trigger (NEW, mig 217)──► notifications               │
│                                                     └─► notification_deliveries │
│  workflow_runs ──AFTER UPDATE OF status (NEW)──► resolve open notification     │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Owns | Status |
|---|---|---|
| `frontend/src/lib/appRoutes.ts` | Pure leaf: `AppRoute` union, `parseAppLocation(pathname, search)`, `formatAppRoute(route)`, legacy aliases, strict UUID check | **NEW** |
| `frontend/src/hooks/useAppNavigation.ts` | The one URL reader/writer: route state, `navigate(route, {replace})`, `popstate` listener, the `onNavigate(view)` adapter | **NEW**. This is the seam the ledger names for `App.tsx` (*"extract an `useAppNavigation()` hook rather than adding a fifth pair"*, HOT-FILE-LEDGER `App.tsx` section) |
| `frontend/src/components/layout/AppViewSwitch.tsx` | The `activeView` mount ternary moved out of ChatLayout | **NEW**. The ledger's named candidate seam for `ChatLayout.tsx` (*"the `ActiveView` mount switch, ~150 lines of branch, owns none of the state around it"*) |
| `frontend/src/hooks/useDeepLinkResolver.ts` | Entity id in route → fetch → org check → switch → apply selection; not-found state | **NEW** |
| `App.tsx` | Auth/setup/invite gates, provider stack. Delegates view state to the hook | **MODIFIED** (shrinks) |
| `ChatLayout.tsx` | Threads, `doRun`, panel. Writes the route instead of local `activeRunId` | **MODIFIED** |
| `lib/runDeepLink.ts` + its 3 call sites | `?run=` writer/reader | **RETIRED** (parser keeps it as a legacy alias) |
| `attentionConditions.ts` | Registry gains a second tenant; conditions gain a home view | **MODIFIED** (deliberate re-baseline of the `length === 1` pin) |
| `NavPanel.tsx` | Badge placed per condition home instead of Library-only | **MODIFIED** |
| `hooks/useWaitingRuns.ts` | Polls `GET /notifications?state=open` at the server-named interval | **NEW** |
| `supabase/migrations/217_notifications.sql` | Tables, RLS, triggers, grants | **NEW** |
| `backend/app/db/notifications.py` | Claim/advance/read helpers (`$N` binds only) | **NEW** |
| `backend/app/api/notifications.py` | `GET /notifications`, `POST /notifications/{id}/read` | **NEW** |
| `backend/app/services/notification_drainer.py` | Per-worker poll loop that sends email | **NEW** |
| `backend/app/services/app_links.py` | `app_link(path)`, `run_path(id)`, `thread_path(id)` | **NEW** |
| `services/email_provider.py` | Gains `send_notification(to, subject, html, idempotency_key)` | **MODIFIED** |
| `api/folders.py`, `api/workflows.py`, `db/workflows.py` | Active-org narrowing on list routes | **MODIFIED** |
| `hooks/useFolders.ts`, `pages/WorkflowsPage.tsx` | Refetch on `activeOrgId` change | **MODIFIED** |

---

## 2. Recommended Project Structure (new files only)

```
frontend/src/
├── lib/appRoutes.ts                  # pure: AppRoute, parse/format, aliases (no React)
├── lib/appRoutes.test.ts
├── hooks/useAppNavigation.ts         # the ONLY History API writer in the app entry
├── hooks/useDeepLinkResolver.ts      # entity → org → selection
├── hooks/useWaitingRuns.ts           # server-verdict poll for the attention tenant
└── components/layout/
    ├── AppViewSwitch.tsx             # moved verbatim from ChatLayout (extraction-first)
    └── LinkNotFound.tsx              # "not found, or not yours" in-view state

backend/app/
├── api/notifications.py
├── db/notifications.py
├── services/notification_drainer.py
└── services/app_links.py
supabase/migrations/217_notifications.sql   # 218+ for any follow-up
```

**Structure rationale:** `appRoutes.ts` is a strict leaf, the same discipline as `attentionCountByTab` (`attentionConditions.ts:205-214`) and `docs/router.ts`, so it is unit-testable without mounting anything and it is the one place the path vocabulary is spelled. The backend mirrors only the run and thread paths it emails (`app_links.py`). It does not import frontend source, because `?raw` cross-tree imports are a known rot vector in this repo (memory: *"?raw imports backend .py red-at-BASE"*).

---

## 3. URL scheme and source-of-truth split

### 3.1 Route table (canonical form always starts `/app`)

| Path | `ActiveView` | Per-view id currently held in | Current holder (file:line) |
|---|---|---|---|
| `/app` (also bare `/` on an `app.*` host) | `chat` (new chat) | n/a | `App.tsx:156-171` initializer |
| `/app/chat/:threadId` | `chat` | `useThreads.selectedThread` | `hooks/useThreads.ts:25,38-40` |
| `/app/runs/:workflowRunId` | `workflow-run` | `activeRunId` | `ChatLayout.tsx:309` |
| `/app/workflows` | `workflows` | `pageView` (library/builder) | `pages/WorkflowsPage.tsx:304` |
| `/app/library` (`?tab=`) | `documents` | `libraryTab` | `App.tsx:222-226` |
| `/app/experts`, `/app/experts/:bundleId` | `experts` | `inspected` (modal) | `experts/catalog/ExpertCatalogPage.tsx:100,351` |
| `/app/skills`, `/app/skills/:skillId/:tab` | `skills` / `skill-studio` | `studioSkillId`, `studioTab` | `App.tsx:183-188` |
| `/app/settings/:tab` | `settings` | localStorage `SETTINGS_TAB_STORAGE_KEY` | `pages/SettingsPage.tsx:449,477` |
| `/app/connections` | `connections` | n/a | `ChatLayout.tsx:938` |
| `/app/org/:tab` | `org-admin` | `activeTab` | `org/OrgAdminShell.tsx:82` |
| `/admin` | `control-room` | n/a (probe-gated) | `ChatLayout.tsx:996-1004` |
| `/admin/spend` | `admin-spend` | n/a | `App.tsx:158` (existing path read, keep it) |

**Legacy aliases (parse, then `replace` to canonical):** `/app?run=<uuid>` (`lib/runDeepLink.ts:24-33`, shipped 289-04, may already be in the wild), `/app?connections=1&…` (OAuth callbacks built at `api/connectors.py:1443-1479,1638-1770`; keep the query so the Connections tab can read `oauth_error`), and bare `/` on `app.*` (`frontend/middleware.ts` rewrites it to `app.html`).

**Scope note:** the milestone lists "view, thread, workflow run, Expert". The Builder draft (`/app/workflows/drafts/:id`) and per-document links are natural next members, but they sit on `WorkflowBuilderPage.tsx` (27 phases) and `LibraryPage.tsx` (20 phases). Add them only as route members plus a resolver arm, never inside the same plan as the router core.

**Never put a dot in a route segment.** `devRouting.ts:28` treats any dotted path as a file. Vercel serves the filesystem before rewrites (memory: *"Vercel: filesystem beats rewrites"*).

**Never put the org in the path.** Every routed entity is a UUID that already carries `org_id`. Putting the org in the URL would make the URL a second source of truth against `OrgProvider`'s localStorage hint (`providers/OrgProvider.tsx:90-105`) and the server-validated header (`dependencies.py:899-951`).

**Tradeoff to state at intake:** canonical `/app/...` puts `/app` back in the address bar on `app.superrag.cloud`, which SEED-242's middleware removed for the root only. The parser accepts both `/chat/:id` and `/app/chat/:id` on an `app.*` host. The formatter, emailed links and copy-link always emit `/app/...`, because that is the only form that works on all four hosts.

### 3.2 What becomes source of truth, and what stays a store

| Concern | Source of truth after v4.8 | Notes |
|---|---|---|
| Which view is open | **URL** (via `useAppNavigation`) | `App.tsx:156` `useState<ActiveView>` becomes derived |
| Which thread / run / expert / skill+tab / settings tab is open | **URL** (ids only) | |
| Thread list, thread objects, message buckets, SSE subscriptions | **Stores, unchanged** | `useThreads`, `streamsStore`, `StreamsProvider` |
| `activeThreadIdRef` | **StreamsProvider.setViewingThread, sole writer, unchanged** | `StreamsProvider.tsx:30,2108-2119`. Called only from `ChatArea.tsx:463-465` (`useLayoutEffect`) and `:575` (first-send path) |
| Active org | **OrgProvider (localStorage hint + server validation), unchanged** | A deep link may *request* a switch; it never writes the org itself |
| Library tab hand-off lifetime | URL `?tab=` replaces `libraryTabAfterNavigate` | The `setLibraryTab(` writer-count pin in `LibraryPage.tabAttention.test.tsx` must be re-baselined in the same commit, never broken by surprise |

**The rule that keeps SSE ownership intact:** the router selects *which thread*; it never talks to StreamsProvider. The chain is `URL → route.threadId → useDeepLinkResolver → useThreads.selectThread(thread) → ChatArea prop → useLayoutEffect → setViewingThread`. Each link already exists except the first two. Nothing new may call `setViewingThread`, because the L-068-03 sole-writer gate counts assignments.

### 3.3 Incremental migration from `ActiveView` (no big bang)

1. **Introduce, don't replace.** `useAppNavigation` returns `{ route, activeView, navigate, onNavigate }`, where `onNavigate(view: ActiveView)` is `navigate({ view })`. The props `ChatLayout` already takes (`onNavigate`, `activeView`, `studioSkillId`, `studioTab`, `libraryTab`, `ChatLayout.tsx:143`) are fed from the hook, so the ~40 existing `onNavigate("…")` call sites compile and behave unchanged. They now also push a history entry, which is the point: Back works for every existing door on day one.
2. **Move state holders to the route one at a time**, each in its own task with its own RED test: `activeRunId` (`ChatLayout.tsx:309`) first, since it already has a URL; then `studioSkillId`/`studioTab` (`App.tsx:183-188`); then `libraryTab`; then thread selection; then the Expert modal; then the Settings and OrgAdmin tabs.
3. **Retire the competing URL writers in the same commit as their replacement.** `RunEvidenceReport.tsx:443-444` (`writeRunDeepLink` / `clearRunDeepLink`) and `ChatLayout.tsx:314-316` (`clearRunDeepLink` effect) both `replaceState` the address bar. Left alive, they fight the router: `?run=` gets written onto `/app/runs/<id>`, or stripped mid-navigation.
4. **Route the two other view writers through `navigate`.** The 403 visibility bounce `App.tsx:285-287` (`setActiveView("chat")`) becomes `navigate({view:"chat"}, {replace:true})`. `CitationNavProvider navigate={handleNavigate}` (`App.tsx:394`) gets the adapter.
5. **Preserve the pre-auth gates byte-for-byte.** `/setup` (`App.tsx:320-326`) and `/invite` (`App.tsx:337-340`) are evaluated before the router mounts. `useAppNavigation` lives inside the authenticated branch or ignores those two paths. Its first parse must not `replaceState` them away.

---

## 4. Deep-link resolution: entity → view → org

### 4.1 What the server already tells us

| Entity | Read | Org-scoped? | Exposes `org_id`? |
|---|---|---|---|
| Thread | `GET /threads/{id}` `api/threads.py:1040-1054`, filtered by `user_id` only; RLS = any member org | No, across the caller's orgs | Yes (`select("*")`) |
| Workflow run | `GET /workflow-runs/{id}` `api/workflow_runs.py:1010-1044`, owner-scoped, 404 on miss, canvas-gated | No, across orgs | Selected (`:1025`) but **not on `WorkflowRunRead`** (`:379-440`). Needs one additive field |
| Expert bundle | `GET /experts/{bundle_id}` `api/experts.py:566` | Not verified (LOW) | Not verified. Check at phase research |

### 4.2 Resolver algorithm (`useDeepLinkResolver`)

```
on route change with an entity id:
  1. if the entity is already in a loaded store (threads list) and its org == activeOrgId → select, done
  2. else GET the entity (owner-scoped read above)
       404 → render LinkNotFound in that view ("not found, or not shared with you").
             NEVER bounce to chat silently — SEED-185's own failure test
       ok  → entity.org_id == activeOrgId  → select
             entity.org_id != activeOrgId  → membership in OrgProvider.memberships?
                  yes → pendingSelection = {route, org: entity.org_id}
                        org.switchOrg(entity.org_id)            (OrgProvider.tsx:173-180)
                        show "Opened in <Org name>" banner (role=status, auto-dismiss)
                  no  → LinkNotFound (cannot happen today: RLS already filters to member orgs)
  3. effect on [activeOrgId]: when pendingSelection.org === activeOrgId,
       re-fetch (the switch's teardown has cleared buckets) → select → clear pending
```

**Why step 3 is a separate effect:** an org switch fires two existing effects that would destroy a selection made in the same tick. `ChatLayout.tsx:202-210` calls `selectThread(null)` and `loadThreads()` on every real org change. `StreamsProvider.tsx:4483-4532` aborts every subscription and clears the viewed bucket. The selection must land *after* both. `ChatLayout`'s IN-01 `selectThread(null)` must also become route-aware: clear the selection only when the route's entity does not belong to the new org, and do it with `navigate({view:"chat"},{replace:true})`, so the URL never names a thread the screen is not showing.

**Back/Forward across orgs:** a `popstate` onto an entity in another org goes through the same resolver, so it switches orgs with the banner. That is acceptable, because the switch is visible and reversible. The alternative (refusing) makes Back feel broken.

**Gating while capabilities load:** `useEffectiveFeatures` fails closed to `{}` until resolved (`App.tsx:256-262`). The `workflow-run` branch requires `canvasEnabled === true` (`ChatLayout.tsx:337-338,1014`). On a cold deep link the resolver must wait for `featuresLoading === false` before deciding refusal or `UnknownViewFallback`. Otherwise every cold `/app/runs/<id>` flashes the fallback, or gets refused, during the first features fetch.

**A route the audience cannot see** (SEED-185 note 5): render the existing plain refusal (`VISIBILITY_REFUSAL`, `App.tsx:275-293`) in place and keep the URL. Do not `replace` to chat, so a reload after an audience change still works.

---

## 5. Notifications data model

### 5.1 Tables (migration `217_notifications.sql`)

```sql
-- One row per "a person should know X" fact. The in-app inbox AND the delivery ledger's parent.
CREATE TABLE public.notifications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id           uuid NOT NULL,                 -- from workflow_runs.org_id, NEVER messages.org_id
  kind             text NOT NULL CHECK (kind IN ('run_waiting')),   -- SEED-281 N-1; N-2..N-4 extend the CHECK
  subject_type     text NOT NULL CHECK (subject_type IN ('workflow_run')),
  subject_id       uuid NOT NULL,                 -- workflow_runs.id
  dedupe_key       text NOT NULL,                 -- 'run_waiting:<workflow_run_id>'
  source_ref       text,                          -- current prompt tool_call_id (updated on re-ask)
  title            text NOT NULL,                 -- workflow name, server-composed
  body             text,                          -- prompt sentence, truncated
  created_at       timestamptz NOT NULL DEFAULT now(),
  read_at          timestamptz,
  resolved_at      timestamptz,
  resolution       text CHECK (resolution IN ('answered','expired','run_ended','superseded'))
);
-- ONE OPEN notice per (recipient, subject). Re-asks update it; they never multiply.
CREATE UNIQUE INDEX notifications_one_open
  ON public.notifications (recipient_user_id, dedupe_key) WHERE resolved_at IS NULL;
CREATE INDEX notifications_recipient_open
  ON public.notifications (recipient_user_id, created_at DESC) WHERE resolved_at IS NULL;

-- Outbox: one row per (notification, channel). Service-role only.
CREATE TABLE public.notification_deliveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  channel         text NOT NULL CHECK (channel IN ('email')),
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sending','sent','skipped','failed')),
  not_before      timestamptz NOT NULL,           -- created_at + grace (quiet when attended)
  attempts        int NOT NULL DEFAULT 0,
  claimed_at      timestamptz,                    -- lease; a stale 'sending' is re-claimable
  sent_at         timestamptz,
  skip_reason     text,                           -- 'resolved_before_send' | 'no_provider' | 'opted_out' | 'no_email'
  last_error      text,                           -- sanitized; never a token or raw provider body
  idempotency_key text NOT NULL,                  -- = notification_id || ':email'; also sent to Resend
  UNIQUE (notification_id, channel)
);
CREATE INDEX notification_deliveries_due
  ON public.notification_deliveries (not_before) WHERE status IN ('pending','sending');
```

**RLS (mandatory, and remember BUG-260911-01):**
- `ALTER TABLE … ENABLE ROW LEVEL SECURITY` on both tables.
- `notifications`: `SELECT` and `UPDATE (read_at)` `TO authenticated USING (recipient_user_id = auth.uid() AND org_id IN (SELECT public.current_user_org_ids()))`. No INSERT/DELETE policy, so only the trigger (SECURITY DEFINER) and the service pool write.
- `notification_deliveries`: RLS enabled with **no policies** (deny-all to `authenticated`/`anon`).
- `REVOKE ALL … FROM anon` on both. Trigger functions get `REVOKE EXECUTE … FROM PUBLIC`, because of the PUBLIC-grant trap CLAUDE.md records for migration 177. Then run `get_advisors(security)` in the deploy parity check.
- Settings: `app_settings.notify_email_grace_seconds` (default 120) and `user_settings.notify_email_run_waiting` (default true), each with a Settings UI control, per the *settings live in app_settings/user_settings* rule.

### 5.2 Producer: one trigger, not N engine hooks

```
AFTER INSERT ON public.messages
FOR EACH ROW
WHEN (NEW.role = 'system' AND NEW.tool_calls @> '[{"kind":"ask_user_prompt"}]')
  → notify_on_ask_prompt()   SECURITY DEFINER, SET search_path = ''
     wr := workflow_runs WHERE id = (NEW.tool_calls->0->>'run_id')::uuid
     IF wr IS NULL OR wr.is_golden_run THEN RETURN NEW   -- chat Deep asks + publish golden runs: no notice
     INSERT notifications (recipient = wr.user_id, org_id = wr.org_id, kind='run_waiting',
            subject_id = wr.id, dedupe_key = 'run_waiting:'||wr.id, source_ref = tool_call_id, …)
       ON CONFLICT (recipient_user_id, dedupe_key) WHERE resolved_at IS NULL
       DO UPDATE SET source_ref = EXCLUDED.source_ref, body = EXCLUDED.body   -- re-ask: no new row, no new email
     INSERT notification_deliveries (…, not_before = now() + grace) ON CONFLICT DO NOTHING
     EXCEPTION WHEN OTHERS → RAISE WARNING; RETURN NEW      -- ⛔ MUST NOT FAIL THE PROMPT INSERT

AFTER INSERT ON public.messages
WHEN (NEW.role = 'system' AND NEW.tool_calls @> '[{"kind":"ask_user_response"}]')
  → UPDATE notifications SET resolved_at = now(),
         resolution = CASE WHEN (NEW.tool_calls->0->>'expired')::bool THEN 'expired' ELSE 'answered' END
     WHERE resolved_at IS NULL AND source_ref = NEW.tool_calls->0->>'tool_call_id'

AFTER UPDATE OF status ON public.workflow_runs
WHEN (NEW.status IN ('completed','failed','cancelled') AND OLD.status IS DISTINCT FROM NEW.status)
  → UPDATE notifications SET resolved_at = now(), resolution = 'run_ended'
     WHERE resolved_at IS NULL AND subject_type='workflow_run' AND subject_id = NEW.id
```

(The exact terminal-status literals must be re-derived from the `workflow_runs` CHECK at phase time. The list above is illustrative.)

**Why a trigger beats Python hooks here:**
- **Coverage without hot-file edits.** The four prompt INSERT sites live in `human_input.py` (G-5 FIRES), `engine_ask.py`, `agent_control.py` and, by extension, `harness_engine.py` (27 phases). The trigger touches none of them. A future pause kind that writes the same row shape is covered automatically.
- **Two workers and boot sweeps are handled by the data, not by coordination.** A restart re-drive of a human step mints a new `uuid4` `tool_call_id` and inserts a new prompt row (`human_input.py:137`; see the comment at `:166`). The partial unique index turns that into an UPDATE of the one open notice, so there is no duplicate notice or email. `resume_pending_prompt` re-emits without re-inserting (`ask_user_service.py:256-302`), so it never touches the trigger at all.
- **Resolution has every path.** Answer (`api/runs.py:933+`, response row insert near `:1076`), expiry on terminalisation (`harness_engine.py:215` inserts an `expired` response row), and any terminal path that skips `_expire_pending_ask_user` (caught by the `workflow_runs` status trigger).

**The one hard rule:** `engine_ask.py`'s prompt INSERT is fail-closed (*"3. The durable prompt row — FAIL-CLOSED (D-50)"*, `engine_ask.py:1013`). A raising trigger would turn a notification bug into a run that cannot pause. The trigger body must wrap all of its work in `BEGIN … EXCEPTION WHEN OTHERS THEN RAISE WARNING … END`. A test must prove that a planted failure inside the trigger still lets the prompt row insert.

**Scope of "waits on a person" in v4.8:** ask-prompt-backed workflow-run pauses only (human gate, action-risk approval, engine ask, and the timeout pause, which leaves its prompt open). Two cases are excluded deliberately, and both should be appended to the SEED-281 register:
- the **tool-round cap pause**: it has no prompt row, and its predicate is the complex `run_is_cap_paused` (`db/runs.py:236-270`);
- **chat Deep `ask_user`**: the person is in the chat.

### 5.3 Email outbox and retry (the scheduler's pattern, verbatim in shape)

`NotificationDrainer` copies `SchedulerService` (`scheduler_service.py:226-310`, wired in `main.py:498-535`):

- runs in **every** worker, with no leader election (`scheduler_service.py:8-14`);
- each tick: `BEGIN; SELECT d.* … WHERE d.status IN ('pending','sending') AND d.not_before <= now() AND (d.status='pending' OR d.claimed_at < now() - lease) FOR UPDATE OF d SKIP LOCKED LIMIT N; UPDATE … SET status='sending', claimed_at=now(), attempts=attempts+1; COMMIT`. **The in-transaction advance is load-bearing**, exactly as `db/schedules.py` documents for `next_run_at`;
- for each claimed row, re-read `notifications.resolved_at`. If resolved → `skipped/resolved_before_send`. This is what keeps an attended run quiet: the grace window lets the person answer before any email exists (SEED-281 rule 3);
- recipient email from `auth.users` on the service pool, the opt-out from `user_settings`, and `EMAIL_PROVIDER=none` → `skipped/no_provider`. The link is still logged, as `NoneLogProvider` does for invites (`email_provider.py:57-61`). The status must say *skipped*, never *sent*;
- send through `run_in_threadpool` (the blocking-call rule, same as `org.py:411`), passing `idempotency_key`. Resend keeps keys for 24 h and returns the original response on a duplicate (verified: resend.com/docs/dashboard/emails/idempotency-keys). So a worker that dies between send and `UPDATE … 'sent'` cannot double-send inside that window;
- failure → back to `pending`, with `not_before = now() + backoff(attempts)` (e.g. 1m, 5m, 30m) and `failed` after 5 attempts. `last_error` is sanitized;
- gated by a module flag like `RUN_BOOT_SWEEPS` (`main.py:44`) so tests boot without it. Skipped in setup mode, like every sweep in `main.py:415-463`.

### 5.4 In-app notice: the second tenant of the attention registry

- **Server verdict, not client derivation** (D-235-05): `GET /notifications?state=open` returns `{ items: [...], poll_interval_seconds }`. That mirrors `useSourceAttention`'s server-named cadence (`hooks/useSourceAttention.ts:113-116`). Items are the caller's open notices **across all their orgs**, each with its org name: a notice is addressed to a person, not to an org library, and hiding org B's waiting approval while the person is in org A is the SEED-281 failure again.
- **Registration is deliberate:** add `{ key: "waiting-runs", use: useWaitingRunConditions }` to `ATTENTION_PRODUCERS` (`attentionConditions.ts:220-222`) and re-baseline `NavPanel.badge.test.tsx:118-119` (`length === 1`) in the same commit, citing SEED-281. That is the path the seam's own docblock prescribes (`attentionConditions.ts:10-16`).
- **Two shell generalisations are required, because the shell hard-wires the Library today.**
  1. `AttentionProducer.use(onOpen)` receives only `openLibraryHealth` (`ChatLayout.tsx:590-592`). Widen it to `use(ctx: { openLibraryHealth, navigate })` so a waiting-run condition's `onOpen` is `navigate({view:"workflow-run", runId})`.
  2. Two places gate the badge on `Boolean(onOpenLibraryHealth)` (`ChatLayout.tsx:599`, `NavPanel.tsx:168`), and the badge is attached only to the Library rail item (`NavPanel.tsx:304`). Add an optional `home?: ActiveView` to `AttentionCondition`. Conditions with `tab` badge the Library, `run_waiting` conditions badge Workflows, and the popover lists them all.
- **Mark read vs resolved:** opening the popover or the run calls `POST /notifications/{id}/read`, which sets `read_at`. Resolution is server-only (the triggers). A badge counts unresolved notices, so it clears only when the ask is answered or the run ends. It never clears because someone glanced at it.
- **Realtime:** optionally add `notifications` to the `supabase_realtime` publication as a refetch *hint* only (D-v2.5-03). The poll remains the truth.

### 5.5 How email links are built

`primary_frontend_origin()` (`config.py:1786-1825`) splits the comma-separated `FRONTEND_URL`, strips trailing slashes, prefers an `://app.` origin, and falls back to the first entry. It never uses the raw string, which is the BUG-260904-04 lesson recorded in its docstring. Rules:

- `services/app_links.py`: `def run_link(run_id: UUID) -> str: return f"{primary_frontend_origin()}{run_path(run_id)}"`, with `run_path` returning `f"/app/runs/{run_id}"`. One function per routed entity the backend emails. No new `APP_BASE_URL` env var (the Phase 167 decision, `email_provider.py:12-13`).
- A backend unit test pins `run_path` to the literal `/app/runs/<uuid>`. A frontend test pins `parseAppLocation("/app/runs/<uuid>")` to the run route. Both cite this section. Run a multi-origin `FRONTEND_URL` case (`https://superrag.cloud,https://app.superrag.cloud`) because, as `config.py:1806-1808` warns, *"only a multi-origin install reproduces it"*.
- No token or secret in the link. Opening it goes through the normal auth gate. With password sign-in, `App.tsx:342-344` renders `AuthPage` at the same URL, so the path survives. **SSO sign-in does not:** `useAuth.ts:74-78` calls `signInWithSSO({ domain })` with no `redirectTo`, so GoTrue returns to its site URL and the deep link is lost. Stash the intended path in `sessionStorage` before the redirect and restore it once after auth (MEDIUM; drive it live).
- HTML-escape every interpolated value (workflow name, prompt, org name), as `ResendProvider` does (`email_provider.py:72-80`). These are tenant-controlled strings at an outbound-email trust boundary.

---

## 6. Active-org list filter (SEED-389) and its blast radius

### 6.1 The change

| Route | Today | Change |
|---|---|---|
| `GET /folders` `api/folders.py:24-33` | `fetch_visible_folders(supabase, uid)`, no org narrowing | `org = await resolve_active_org_or_none(request, current_user)`; pass `restrict_org_ids={org}` when `org` is set |
| `GET /folders/{id}/children` `api/folders.py:36-47` | same | same |
| `GET /workflows/published` `api/workflows.py:403-440` → `db/workflows.py:588+` | `is_system_global OR created_by=$1` | add `org_id` kwarg: `(is_system_global OR (created_by=$1 AND ($2::uuid IS NULL OR org_id=$2)))` in **both** branches (`owned_only` and default) |
| `GET /workflows/drafts` `api/workflows.py:1233-1250` → `db/workflows.py:1091` | `status='draft' AND created_by=$1` | add `AND ($2::uuid IS NULL OR org_id=$2)` |

**Reuse the existing narrowing; do not write a second one.** `fetch_visible_folders` already has `restrict_org_ids` (`utils/folder_utils.py:222-287`), with the asymmetric semantics documented at `:239-270`: `None` means no narrowing, `set()` fails closed, and since 295-10 a non-empty set narrows **owned** folders too (`:265-268,284`). That is exactly SEED-389's per-org reading. `_authorize_thread_folder` already calls it this way (`api/threads.py:1194-1203`). Do **not** change the function's default: its docstring records why a post-filter or a changed default reopens the SEED-124 leak class.

`resolve_active_org_or_none` (`dependencies.py:1020-1069`) is the right resolver, and it is the one 296-01 used for create (`api/folders.py:56-60`, `api/workflows.py:1216-1220`). An absent header → `None` → unchanged behaviour (tests and old clients). A non-member header → `None`, logged, never trusted. `workflow_definitions.org_id` is NOT NULL since migration 105 (`105_personal_org_backfill.sql:580`), so no NULL arm is needed.

### 6.2 Blast radius — every caller, and whether it changes

**Folder visibility (`fetch_visible_folders`, ~20 callers): only the two list routes change.** Every other caller keeps calling it without `restrict_org_ids`, so it is unchanged by construction:
- `api/folders.py:64` (create parent check, already re-checks the active org), `:273` (move);
- `api/kb.py:21-345`;
- `services/agent_loop.py:1498`, `document_search_service.py:304`, `document_view_resolver.py:389`, `expert_scope_statement.py:157,287`, `run_producer.py:615`;
- `harness/scope.py:138,245`, `harness/grounding.py:424`, `engine_ask.py:857`, `workflow_kickoff.py:431`.

⚠ **Product consequence to decide at intake:** chat retrieval and the KB picker (`api/kb.py`) will still see every org's folders while the Library shows one. Either accept that (retrieval scope is a separate question, already governed by thread org for threads with a folder) or file it as a follow-up seed. Do not widen this phase to retrieval.

**`/workflows/published` frontend callers, all affected, all intended:**
- `pages/WorkflowsPage.tsx:420` (`scope:"mine"`, the "Yours N" count SEED-389 measured);
- `chat/useStartWorkflowInThread.ts:68` (thread picker);
- `panel/WorkspacePanel.tsx:149`;
- `settings/ConnectionsTab.tsx:1446` (connection grants; connections are org-scoped, so this is a correctness gain).

`/workflows/starters` is global and untouched.

**Client refetch is required:**
- `hooks/useFolders.ts:24-29` loads once with no `activeOrgId` key, so after the server filter it would show the old org's folders until reload. Key it on `useOrgOptional()?.activeOrgId`, following the precedent at `ChatLayout.tsx:201-210`.
- The Workflows page lists must refetch on the same key.
- Folder Realtime events (`useFolders.ts:33+`) stay refetch hints.

**Siblings to decide at intake (same defect class, not in SEED-389's text):** the thread list (`api/threads.py:279-286`) and the run log (`api/workflow_runs.py:658+`). If the thread list goes per-org, §4's resolver is what keeps an email link to an org-B thread working. That ordering is why this phase lands before the entity deep links.

---

## 7. Architectural Patterns to Follow

### Pattern 1: Pure route leaf plus one History writer
**What:** `parse`/`format` as pure functions; one hook owns `pushState`/`replaceState`/`popstate`.
**Precedent:** `docs/router.ts:11-55`, `lib/runDeepLink.ts` (strict UUID, never throws).
**Trade-off:** no nested layouts or loaders. That suits a closed 12-member union rendered by one ternary.

```ts
// appRoutes.ts — leaf, no React
export type AppRoute =
  | { view: "chat"; threadId?: string }
  | { view: "workflow-run"; runId: string }
  | { view: "experts"; expertId?: string }
  | { view: "skill-studio"; skillId: string; tab: StudioTab }
  | { view: Exclude<ActiveView, "chat" | "workflow-run" | "experts" | "skill-studio"> }
export function parseAppLocation(pathname: string, search: string): AppRoute | { view: "not-found" }
export function formatAppRoute(r: AppRoute): string   // always "/app/..."
```

### Pattern 2: The database owns exactly-once
**What:** claim with `FOR UPDATE SKIP LOCKED` and advance state inside the same transaction. A partial unique index makes producers idempotent.
**Precedent:** `scheduler_service.py:8-14`, `db/schedules.py` `claim_due_schedules`.
**Trade-off:** logic in SQL is invisible to mocked-supabase unit tests. Mitigate with a DB-backed test (serialize it: it mutates the local DB, worktree rule 4).

### Pattern 3: Server verdict, client renderer
**What:** the attention producer shapes a server answer and derives nothing.
**Precedent:** `attentionConditions.ts:18-25` (D-235-05), `useSourceAttention.ts:113`.

---

## 8. Data Flow

### Deep link (cold load from an email)
```
https://app.superrag.cloud/app/runs/<id>
  → Vercel rewrite (app.* host) → app.html
  → App: setup probe, auth gate (AuthPage keeps the URL) → providers mount
  → useAppNavigation parses → {view:"workflow-run", runId}
  → wait featuresLoading=false (canvas gate)
  → GET /workflow-runs/<id> (owner 404 | ok + org_id)
  → org differs → switchOrg → [ChatLayout org effect, StreamsProvider teardown]
  → effect on activeOrgId → setActiveRun → WorkflowRunPage renders PendingAskCard
```

### Waiting run → person
```
engine writes ask_user_prompt row (any of 4 sites)
  → trigger: notifications (open, 1 per run) + delivery (not_before = +grace)
  → /notifications poll → waiting-runs condition → Workflows rail badge + popover
  → drainer tick (any worker) claims due delivery → still open? → Resend (idempotency key)
person answers → POST /runs/<id>/ask_user_response → response row → trigger resolves
run ends any other way → workflow_runs status trigger resolves ('run_ended')
```

---

## 9. Anti-Patterns

### AP-1: The router calls StreamsProvider
**Why bad:** it breaks the L-068-03 sole-writer gate and the useLayoutEffect ordering that keeps F5 replay correct (`ChatArea.tsx:445-465`).
**Instead:** the router selects a thread; ChatArea's existing effect does the rest.

### AP-2: Keeping `?run=` writers alongside the router
**Why bad:** two `replaceState` writers race. 289-REVIEW WR-05 already found one such leak (`ChatLayout.tsx:311-316`).
**Instead:** retire `writeRunDeepLink`/`clearRunDeepLink` in the commit that routes runs. Keep only the parser alias.

### AP-3: Notification hooks inside engine executors
**Why bad:** four G-5 files edited, the restart re-ask producing duplicates, and resolution paths missed.
**Instead:** the §5.2 triggers.

### AP-4: Trusting `messages.org_id` or the client for the notice's org
**Why bad:** the `LIMIT 1` autofill (`full-schema.sql:75-79`) picks an arbitrary org for two-org users.
**Instead:** `workflow_runs.org_id`.

### AP-5: Changing `fetch_visible_folders`' default
**Why bad:** it silently re-scopes retrieval, grounding, kickoff and publish (~20 callers).
**Instead:** pass `restrict_org_ids` at the two list routes only.

### AP-6: Emailing on every pause immediately
**Why bad:** attended runs get noise, the channel gets muted, and then N-1 is not delivered either (SEED-281 rule 3).
**Instead:** a grace window plus a resolved-before-send skip.

### AP-7: A bare-path URL scheme
**Why bad:** it works in dev and on `app.*`, then 404s or shows the landing page on onebox and previews (SEED-185 "how we'd know this failed" #2).
**Instead:** canonical `/app/...`.

---

## 10. Scaling Considerations

| Concern | Now (single-digit orgs) | 10k users | Notes |
|---|---|---|---|
| Notification poll | 1 GET / user / interval | Server-named interval lets ops slow it without a deploy | Same lever as `useSourceAttention` |
| Trigger cost on `messages` | `WHEN` clause filters to system ask rows | negligible | The `WHEN` is evaluated before the function call |
| Drainer | 2 workers × 1 tick/30-60 s | batch `LIMIT N` per tick | Resend rate limits; backoff covers 429 |
| Thread list size (1,400+ threads, BUG-261027-02) | full list load | the deep-link resolver must not depend on the list containing the thread | §4.2 step 2 fetches by id |

---

## 11. Integration Points

### External
| Service | Pattern | Notes |
|---|---|---|
| Resend | `send_notification` on the existing `EmailProvider` protocol, via `run_in_threadpool`, plus `Idempotency-Key` | ⚠ `resend` is missing from `requirements.txt`. Either add it (deploy-artifact parity, same commit) or call the Resend REST API through the existing shared `httpx` client (`dependencies.py:183`). The httpx route adds no dependency and is the leaner choice (STACK.md decides). Reuse `RESEND_API_KEY`/`INVITE_FROM_EMAIL`; a new generic `EMAIL_FROM` would need the `check-deploy-drift.sh` same-commit update |
| Vercel / nginx / dev | `/app/*` → `app.html` already on all three | No routing change needed. Add a smoke check for one deep path per host to the parity checklist |

### Internal boundaries
| Boundary | Communication | Notes |
|---|---|---|
| useAppNavigation ↔ ChatLayout | props (`activeView`, ids, `onNavigate`) | Existing prop surface, so the migration is incremental |
| Resolver ↔ OrgProvider | `switchOrg` + effect on `activeOrgId` | Never writes localStorage directly |
| Engine ↔ notifications | Postgres triggers only | No Python import edge into the engine |
| Drainer ↔ email provider | `get_email_provider()` | `none` path logs and marks `skipped` |

---

## 12. Suggested Build Order (phases from 297)

| # | Phase | Depends on | Hot files / extraction-first |
|---|---|---|---|
| **297** | **Router core + extractions.** Plan 1 is extraction only: move ChatLayout's mount switch into `AppViewSwitch.tsx` verbatim, and App's four view/tab `useState` pairs into `useAppNavigation` (the ledger's two named seams). Then `appRoutes.ts`, top-level view URLs, Back/Forward, legacy aliases, `?run=` writers retired, the run route `/app/runs/:id`, and pre-auth gates kept byte-identical | nothing | App.tsx (28 phases), ChatLayout.tsx (33), the G-5 refactor recommendation is satisfied by taking the named seams *first* |
| **298** | **Lists follow the active org** (SEED-389 + the thread-list/run-log decision) | none (backend + two hooks). Can run **in parallel with 297**: no shared files | `api/workflows.py` (26), `db/workflows.py` (31), `api/folders.py`. Honour by construction (one kwarg per route); the `api/workflows.py` split stays owed |
| **299** | **Entity deep links + org resolution:** `/app/chat/:id` (SEED-178), Experts modal, skill studio, settings/org tabs, `LinkNotFound`, cross-org switch banner, SSO path stash, additive `org_id` on `WorkflowRunRead` | 297 (navigate), 298 (per-org lists make the switch observable and testable) | `useThreads.ts`, `ExpertCatalogPage.tsx`, `SettingsPage.tsx` (30), `OrgAdminShell.tsx`. Fold BUG-261027-02 here (it touches the same thread-list load path, and "loading" vs "not found" matters to the resolver) |
| **300** | **Notifications backend:** migration 217, triggers, RLS, `/notifications` API, drainer, `app_links`, generalized email provider | 297's **path contract only** (`/app/runs/<id>`, fixed in 297 plan 1), so it can start right after that plan lands | New files plus a `main.py` lifespan registration (69 phases: one guarded block, the scheduler shape). **Fold BUG-261027-04/-05 first or alongside:** notifications send people to answer scheduled and key-started runs, which then resume on the wrong provider or with a blank required input |
| **301** | **In-app notice:** second attention tenant, `home` on conditions, badge placement, popover rows, mark-read | 297 + 300 | `attentionConditions.ts`, `NavPanel.tsx` (14), `ChatLayout.tsx`. G-2/G-4: sketch the popover and run-row first, then lived-experience UAT |
| **302** | **Close-out:** BUG-261027-01, -03, SEED-391's six findings | independent; can parallel 298/300 | the SEED-391 trigger paths (publish_service, WorkflowCanvas, …) |

**Ordering rationale:**
- URLs come first because every later feature needs a link to point at. That is the milestone's own stated reason.
- The extraction comes first inside 297 because App.tsx and ChatLayout.tsx both fire G-5 and the ledger names the seam for each.
- Lists-per-org lands before entity deep links, because the cross-org switch path is only exercised once lists are per-org.
- The notification backend depends only on the path *contract*, not on the router UI, which lets 300 overlap with 299.
- The in-app notice is last, because it needs both `navigate` and the server verdict.

**Research flags:**
- 297 needs a decision recorded at discuss time: hand-rolled vs library router (STACK.md).
- 299 needs Expert bundle org semantics verified (LOW here).
- 300 needs the terminal-status literals and a live check of whether production has ever sent an email (LOW).
- 298 and 302 are standard patterns.

---

## Sources

- Code read directly, `develop` @ `de569cfce`. Every `file:line` above.
- `.planning/seeds/SEED-185`, `SEED-178`, `SEED-281`, `SEED-389`; `.planning/PROJECT.md` §Current Milestone; `docs/HOT-FILE-LEDGER.md` sections for `App.tsx`, `ChatLayout.tsx`, `NavPanel.tsx`, `attentionConditions.ts` (HIGH).
- Resend idempotency keys: https://resend.com/docs/dashboard/emails/idempotency-keys (header `Idempotency-Key`, 24 h retention, same response on duplicate, Python `resend.Emails.send(params, {"idempotency_key": …})`) (HIGH, official docs).
