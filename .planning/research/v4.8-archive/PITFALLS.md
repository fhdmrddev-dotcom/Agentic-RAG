# Pitfalls Research

**Domain:** Adding client-side routing, waiting-run notifications (in-app + email) and active-org list scoping to an existing SPA (React 19 + Vite 8) / FastAPI (2 workers) / Supabase / Redis product. Milestone v4.8 "Every Page Has a Link".
**Researched:** 2026-10-27
**Confidence:** HIGH for project-specific pitfalls (each one is read from the code at HEAD `de569cfce` and cited by file). MEDIUM for external-service behaviour (Supabase redirect allowlist, Resend, mailbox-provider rules), which comes from vendor docs and community reports and is marked as such.

Phases are named by topic because v4.8 has no phase numbers yet. Numbering starts at 297.

| Label | Meaning |
|---|---|
| **R0 Extract** | G-5 extraction on `App.tsx` / `ChatLayout.tsx` before the router lands |
| **R1 Router** | Router foundation: URL shapes, entry points, deploy routing on all three servers |
| **R2 Deep links** | Entity URLs (thread, run, workflow, Expert, document panel), plus auth and SSO return |
| **O1 Org lists** | Library folders and the Workflows list follow the active org (SEED-389) |
| **N1 Notify** | Waiting-run producer, in-app notice, app-owned mailer (SEED-281) |
| **C1 Close-out** | v4.7 bugs and the SEED-391 findings |

---

## Critical Pitfalls

### Pitfall 1: Deep links work in dev and break in production, differently on each server

**What goes wrong:**
The app is served by four different routing layers, and today they agree only for `/app`, `/app/*`, `/setup`, `/invite`, `/admin/spend` and `/docs*`:

- **Vite dev** (`frontend/devRouting.ts`): every dot-free path that is not `/` goes to `app.html`. Any route works in dev.
- **Vercel, app host** (`app.<domain>`): the `vercel.json` rewrite `/(.*) → /app.html` is host-scoped, and `frontend/middleware.ts` (matcher `/` only) rewrites the bare root. Root paths work here.
- **Vercel, apex and `*.vercel.app` previews**: only `/app`, `/setup`, `/invite` and `/admin` are redirected to the app host. A root path such as `/workflows/abc` matches no rewrite and returns **404**.
- **Onebox nginx** (`frontend/nginx.conf`): `location /` falls back to **`/index.html`, the LANDING page**. So `/runs/abc` on a self-hosted box renders the marketing landing, with no error.

A route table built on root paths (`/t/:id`, `/runs/:id`) therefore passes every dev check, works on `app.superrag.cloud`, 404s on previews and the apex, and shows the landing page on every self-hosted install. Emailed links make this worse. `primary_frontend_origin()` (`backend/app/config.py`) prefers an `app.*` origin, but on a onebox with no `app.` subdomain it returns `parts[0]`, so the link points at nginx's landing fallback.

**Why it happens:**
Dev routing is the most permissive of the four layers, so it hides the problem. This is SEED-185 feasibility note 4 ("works perfectly in dev, 404s in production") plus DEPLOYMENT-LESSONS theme 6 ("Local works ≠ cloud works").

**How to avoid:**
- Make **`/app/...` the one canonical shape for every shareable link** (emails, copy-link, notifications). `/app/*` already resolves correctly on all four layers: the apex redirects it to the app host, the app host rewrites it, nginx has `location /app/`, and devRouting catches it. No deploy config needs to change for the links to work.
- The router must also accept the bare app-host root (`app.<domain>/`). The middleware deliberately keeps `/` in the address bar (SEED-242), so a router with `basename="/app"` will **render null** there: React Router returns null when the location does not match the basename. Use no basename and a route table that matches both `/` and `/app/*`, or normalise once at boot with `replaceState`.
- Ban dots in route segments. Both `devRouting.ts` and nginx `try_files $uri` treat a dotted path as a static file. Use ids, never filenames, in paths.
- Add an executable parity check in R1. A script feeds the same list of route paths to `rewriteDevUrl`, to a `vercel.json` rewrite/redirect evaluator, and to the nginx `location` rules, and fails if any canonical route resolves to something other than `app.html`. `devRouting.ts` already says "the three must agree", but only prose enforces it today.

**Warning signs:**
A route works on `localhost:5173` and has never been loaded on `*.vercel.app` or a onebox. Any route path without the `/app/` prefix appears in an email template or a copy-link button.

**Phase to address:** R1 (route shape and parity check). N1 must reuse the R1 link builder.

---

### Pitfall 2: The router is built on hot files that have no extraction yet, so dozens of source fences go red and get "fixed" by weakening them

**What goes wrong:**
Navigation is `App.tsx`'s `useState<ActiveView>` (13 members) plus about 20 one-off handoffs:

- `handleOpenStudio` and `studioTab`
- `libraryTab` and `libraryTabAfterNavigate`
- `activeRunId` read from `?run=`
- the `?connections=1` initializer
- the `/admin/spend` pathname check
- `localStorage settings_active_tab` writes used as a deep link (`ChatLayout.tsx:976`, `EmbeddingModelCard.tsx:93`)
- a `sessionStorage api_keys_prepick` handoff
- a dead `window.location.hash = "#chat"` (`ConnectionsTab.tsx:1146`)

All of these live in G-5 FIRING files: `App.tsx` 37/28, `ChatLayout.tsx` 64/33, `ChatArea.tsx` 94/44 ⛔, `StreamsProvider.tsx` 120/45/5250 ⛔, `useThreads.ts` ⛔, `NavPanel.tsx` 26/14.

At least **9 suites read `App.tsx` / `ChatLayout.tsx` as `?raw` source**, and **10 suites assert the no-router architecture by name**:

- `activeViewReachability.test.ts` and `renameFence.test.ts`
- `ChatLayout.launch.test.tsx`, a split-point tag fence
- `LibraryPage.initialTab.test.tsx`, which uses an `App.tsx` comment phrase as its comment-stripper non-vacuity control
- `NavPanel.badge.test.tsx`
- `WorkspacePanel`, `ConnectionPicker`, `WorkflowDoorSwitch`, `WatchedFoldersSection` (asserts `not.toContain("window.location")`), and more

A router refactor reds all of them at once. The tempting response is to delete or loosen the assertions until the gate is green.

**Why it happens:**
The no-router choice was deliberate and fenced in many places. A refactor that ignores those fences turns a planned change into a bulk weakening of guards, which CLAUDE.md names: "a guard nobody has seen fire is not a guard".

**How to avoid:**
- Run **R0 first**, as its own extraction phase: move view state and every handoff into one `navigation` module (a pure route table plus a `useAppNavigation` hook) with no behaviour change. Re-target, never delete, each fence in the same commit.
- `activeViewReachability.ts` **throws** on a vacuous parse. Re-point it at the route table so the triad becomes route ↔ render branch ↔ navigator. It must keep failing a member that has no branch.
- Make the tab handoffs (`settings_active_tab`, `api_keys_prepick`, `libraryTab`) URL state in R1. Then delete the storage writes in the same commit, so there is one source of truth instead of URL plus storage.
- Delete or rewire the dead `#chat` hash write. Under a hash router it would become a live navigation.
- For each red suite, record whether it was **re-targeted** or **retired** (retired only under a named decision, like `D-206-07`). The vitest count gate contract is "no per-file DECREASE". A retired file shows up as a decrease and must be justified, not hidden.

**Warning signs:**
A PR that changes `?raw` fence expectations and `App.tsx` in the same diff with no decision id. The count-gate verdict shows per-file decreases. `ActiveView` still exists alongside a router, which means two sources of truth.

**Phase to address:** R0 (extraction plus fence re-targeting) before R1. G-5 requires this order.

---

### Pitfall 3: Navigation tears down live streams, or a route change remounts the run surface

**What goes wrong:**
`StreamsProvider` owns long-lived SSE subscriptions (`subscriptionsRef: Map<runId, AbortController>`, with abort-all in its unmount cleanup at about `:4402-4405`). It sits inside `OrgProvider`, under App's `!user` gate. Three failure paths:

1. **Router placed below StreamsProvider, or keyed routes remount the providers.** Every navigation aborts every in-flight run stream, so the chat goes silent mid-answer. Abort is a *silent* return in `subscribeToRun` (no `onTerminal`), so the UI is left with a phantom "streaming" state. The org-switch teardown comment (WR-02) records this exact defect.
2. **Back/Forward unmounts `ChatArea` mid-send.** The 067.5 per-thread send guard (`sendingThreadsRef`) protects buckets only when it goes through `clearThreadBucket`. A route-driven unmount skips that guard.
3. **Deep link to a thread in another org triggers an automatic `switchOrg`.** The `[activeOrgId]` effect in StreamsProvider (about `:4483-4532`) aborts every subscription in the current org. Opening one link from an email can kill three running chats in other tabs' state.

**Why it happens:**
Route libraries encourage `<Route element={<Page/>}>`, and a remount looks harmless. In this app the providers hold run state that is not reconstructible without a reconnect.

**How to avoid:**
- Order the tree as `BrowserRouter` → (auth gate) → `OrgProvider` → `StreamsProvider` → layout → `<Outlet/>`. Providers never sit under a route element, and the layout never takes a `key` from the path.
- R1 acceptance test: a stream in thread A, then navigate Library → Workflows → Back → Forward → thread B → Back. Assert `subscriptionsRef.size` is unchanged and no `AbortError` fires. Drive it live as a G-4 row and as a vitest with a mocked subscribe.
- Never switch org automatically from a link. Show an explicit "This belongs to *Org B* — switch?" step (see Pitfall 6).
- This touches streaming and UI state, so the cross-provider UAT roster applies (8 rows plus multi-tool, parallel-thread and long-message axes). The parallel-thread axis exists for exactly this.

**Warning signs:**
`AbortError` in the console on navigation. A thread shows "streaming" with no tokens arriving. The inactivity watchdog fires `getSnapshot` 404s.

**Phase to address:** R1 (tree order plus the teardown test). R2 for the cross-org prompt.

---

### Pitfall 4: A pasted link opens the right view, but empty

**What goes wrong:**
Entity selection is resolved from **already-loaded lists**, not by id:

- `useThreads.selectThread` takes a `Thread` object.
- `WorkflowRunPage.onOpenThread` does `threads.find((x) => x.id === tid)` and silently does nothing if the thread is missing.
- The Expert detail is a modal held in page state.
- Skill Studio needs `studioSkillId` plus `studioTab`.

A cold load of `/app/t/<id>` renders chat with no thread whenever the list has not arrived yet, is filtered to another org, or does not contain that id. This is the first "how we would know this failed" line in SEED-185.

**Why it happens:**
The URL becomes the source of truth for *which* entity, but the restore path still expects the entity *object* from a list.

**How to avoid:**
- Every routed entity gets a **fetch-by-id restore path** that is independent of any list (`GET /threads/{id}`, the run evidence endpoint, `GET /experts/{id}`).
- The page renders four distinct, worded states: loading, not found, no access (indistinguishable from not found, as the server decides), and "in another org of yours" (Pitfall 6). Never render a blank.
- Validate ids before any request, following the `runDeepLink.ts` precedent (strict UUID, else `null`).
- R2 G-4 row: paste each entity URL into a fresh tab while signed out, then sign in. You land on that entity with its content. Assert rendered content, not a `data-testid` (presence assertions cannot see content drift).

**Warning signs:**
`find(...)` on a list inside a route effect. Any route component that returns `null` while waiting. A UAT screenshot showing the right header with an empty body.

**Phase to address:** R2.

---

### Pitfall 5: The deep link is lost through sign-in, SSO, email confirmation or the boot spinner

**What goes wrong:**

- **Password sign-in is safe today, by accident.** `!user` renders `AuthPage` at the same URL with no redirect, so the path survives. A router guard written as `<Navigate to="/login">` breaks that unless it carries `?next=`.
- **SAML SSO loses the link.** `useAuth.signInWithSSO` calls `supabase.auth.signInWithSSO({ domain })` with **no `redirectTo`**, so GoTrue returns to the **Site URL**. Supabase uses the Site URL whenever `redirectTo` is absent or not on the allowlist.
- **Sign-up confirmation emails** (`signUp` passes no `emailRedirectTo`) also land on the Site URL.
- **Fixing it adds a cloud setting.** Adding `redirectTo: location.href` only works if Cloud Supabase Auth → Redirect URLs contains `https://app.<domain>/**` (the OPERATOR.md runbook lists it). Every self-hosted GoTrue needs the same entry. Otherwise it silently falls back to the Site URL, with no error.
- **The token arrives in the URL hash.** The client is built with `createClient(url, key)` and no `flowType`. supabase-js v2's browser default is the implicit flow, which puts tokens in `#access_token=…` after SSO or confirmation (MEDIUM: library default, verify on the pinned `^2.99.2`). A **HashRouter** would collide with that. A router that normalises or rewrites the URL before supabase-js reads the hash can drop the session.
- **The boot spinner can hang forever** (SEED-312): `getSession()` has no timeout or catch. A deep link that never boots looks identical to a broken link.
- **The setup and invite entry flows must keep working exactly as they do today.** `/setup` (with the finalized lockout), `/invite?token=` (AcceptInvitePage, which stores the token in sessionStorage and redirects to `/app` on success) and `/admin/spend` are path checks *before* the auth gate.

**How to avoid:**
- Use **BrowserRouter (history mode), never HashRouter.**
- Capture the intended URL before any auth redirect: `sessionStorage['post-auth-return']`, validated as a same-origin path that starts with `/app`, so it cannot become an open redirect. Pass it as `redirectTo` for SSO and `emailRedirectTo` for sign-up, and restore it after `SIGNED_IN`.
- Add "Supabase Auth Redirect URLs contain the app wildcard" to the deploy parity checklist in the same commit (cloud and onebox). Verify with a real SSO round-trip on cloud, not local.
- Fold SEED-312 (bounded `getSession`) into R2, since a deep link is now the main way people enter the app.
- Keep `/setup`, `/invite` and `/admin/spend` as top-level routes evaluated before auth. Keep their existing tests and add one cold-load test per entry.

**Warning signs:**
After SSO the user lands on `/` or `/app` instead of the run. The confirmation email link goes to the landing. A `#access_token` fragment stays in the address bar after boot.

**Phase to address:** R2 (with SEED-312 folded in). Parity checklist entry in R1.

---

### Pitfall 6: Links and org context disagree. A 404 that is really "wrong org", or a write that lands in the wrong org

**What goes wrong:**
The active org is **device-scoped in localStorage** (`active-org-id`, `lib/api/_core.ts`), read once into an in-memory `X-Org-Id`. There is no `storage` listener in `OrgProvider`. Two ways this breaks:

- **Thread fetches are org-scoped.** A cross-org `getSnapshot` 404s (StreamsProvider IN-01/WR-02 comments). So a link to *your own* thread in Org B, opened while Org A is active, shows "not found". That is false, and nothing tells the user to switch.
- **Run reads are owner-scoped, not active-org-scoped** (`workflow_runs.py` reads `org_id` but does not filter by `X-Org-Id`). So a link to an Org B run *does* open inside Org A's chrome. Any write from that page is then stamped with the **active** org, because since 296-01 creates stamp the active org. Examples: open thread, fork, re-run, start-in-thread. That is a cross-org data-placement bug created by routing.
- Opening a link in a new tab that calls `switchOrg` rewrites localStorage, so **the next reload of every other tab** lands in the other org.

**Why it happens:**
The URL names an entity but not its org, and different endpoints use different scoping rules (owner-scoped vs active-org-scoped).

**How to avoid:**
- Entity routes resolve the entity's org on the server. Return the owning `org_id` only to members, plus a worded "belongs to another of your orgs" state. Non-members get the same 404 as not-found, which is enumeration-safe.
- Show an explicit switch prompt, never an automatic switch (Pitfall 3).
- Consider a `?org=` hint on shared links. It is only a hint: the server re-validates membership exactly as `get_active_org_id` does.
- Any write action on a routed entity page passes the **entity's** org, not the active org. Alternatively, the page refuses writes until the org matches. Add a test: open an Org B run with Org A active, click fork, assert the new row's `org_id` is B or the action refused.

**Warning signs:**
A user in two orgs reports "link says not found" for their own item. Rows whose `org_id` differs from their parent run's or definition's `org_id`.

**Phase to address:** R2 (entity org resolution). Coordinate with O1, since both read the same `X-Org-Id` dependency. Test with the dev account, which is in **two orgs** (memory note: prove the active org first).

---

### Pitfall 7: Duplicate "waiting on you" emails from two workers, boot sweeps, resume and re-emit

**What goes wrong:**
Several layers re-run the "an ask is pending" moment:

- `ask_user_service.resume_pending_prompt` **re-emits `ask_user_prompt`** after every restart.
- `main.py` runs `_resume_stranded` and the orphan reconcilers on every boot (`RUN_BOOT_SWEEPS`, single-shot `SET NX` per sweep).
- `WORKER_COUNT=2`.
- The scheduler runs in every worker (`claim_due_schedules`, `FOR UPDATE SKIP LOCKED`).
- Continue and resume paths re-enter `_exec_llm_human_input`.

A notification hooked to "the prompt was emitted" sends again on every deploy, restart or resume. Coolify redeploys restart both workers, so every production push would re-email every person with a pending approval.

**Why it happens:**
The emit is a *rendering* event (it exists so a reconnected frontend re-draws the question), not a *state transition*.

**How to avoid:**
- Do not send from the engine at all. Use an **outbox table**, e.g. `notification_outbox`, with `UNIQUE (run_id, tool_call_id, kind, recipient_user_id)`, written with `INSERT … ON CONFLICT DO NOTHING`. Only the inserting transaction enqueues a send.
- Drive it from **one periodic sweep** that evaluates the same server predicate the in-app badge uses (Pitfall 8). Claim rows with `FOR UPDATE SKIP LOCKED`, the proven `claim_due_schedules` pattern. Then neither worker count nor boot sweeps can duplicate, and `harness_engine.py` (70/27 ⛔) and `human_input.py` (⛔) need no edit.
- Pass the outbox row id as Resend's **`Idempotency-Key`**. Resend dedupes the same key for 24 h and returns 409 if the payload differs. A retry after a timeout therefore cannot double-send.
- Make the HTTP call **outside** the claiming transaction, and mark `sent_at` after it. Accept at-least-once at the provider, made idempotent by the key.

**Warning signs:**
More than one outbox or send log line per `(run_id, tool_call_id)`. A burst of sends right after a deploy. A test that only covers one worker.

**Phase to address:** N1. Include a test that runs the sweep twice concurrently and restarts mid-send.

---

### Pitfall 8: "Waiting on a person" is five different states, and the email and the badge disagree

**What goes wrong:**
A run can be parked on a human in at least five ways:

1. `ask_user_prompt` message rows with no matching `ask_user_response` (the `NOT EXISTS` scan in `panel.py` / `db/workflows.py`)
2. the armed action-risk checkpoint (`timeout_seconds=None`, waits indefinitely)
3. `llm_human_input` timeout → `pause_run` (D-10)
4. the Phase 295 engine pause (`engine_pause` payload)
5. the 292.1 cap pause (`run_is_cap_paused` in `db/runs.py`, a run state, **not** an ask row)

The panel endpoint also applies a **liveness filter** (`_prompt_run_is_live`) because orphan prompt rows exist from dead runs. A notifier that writes its own query will email about dead runs (orphan prompts), miss cap pauses, or count differently from the badge. SEED-281 rule 2 forbids exactly this ("must not become a second source of truth"). D-235-05 forbids a client-side verdict.

N-2 adds a further trap: expiry semantics differ by kind. Chat `ask_user` fails the run (`_resolve_failure_with_ask_user`), `llm_human_input` pauses, and checkpoints never expire. An email that says "expires at X" is wrong for some of them.

**How to avoid:**
- Build **one server function**, `waiting_on_person(user_id) -> [{run_id, kind, org_id, since, deadline|null}]`, that reuses the existing pending-ask SQL **and** the liveness filter, and covers the cap pause.
- The badge producer, the in-app notice and the email sweep all call it. Register the producer in `ATTENTION_PRODUCERS` and re-baseline the `length === 1` assertion **in the same commit with the decision id**. SEED-281 says this is the intended way past that check.
- Re-evaluate the predicate **immediately before sending** and drop the send if the ask was answered, the run is terminal, or the run was cancelled.
- Per-kind deadline copy comes from the same function, never from a template guess.

**Warning signs:**
The notifier has its own SQL. The email count differs from the badge count. An email arrives for a run whose page says Failed or Completed.

**Phase to address:** N1.

---

### Pitfall 9: The mailer "works" and nothing is delivered: missing dependency, swallowed errors, unauthenticated domain

**What goes wrong:**

- **The `resend` package is not in `backend/requirements.txt`.** `ResendProvider` lazy-imports it. It works in any venv where someone ran `pip install resend`, and raises `ModuleNotFoundError` in the clean Docker image. This is DEPLOYMENT-LESSONS **A1** again.
- **The failure is silent.** The invite path wraps the send in `except Exception: logger.error(...)` (`api/org.py:409-413`, "link-first: delivery never fails the invite"). A notifier copying that pattern fails with nothing visible, which is DEPLOYMENT-LESSONS theme 2: silent degrades hide failures.
- **Authentication and alignment.** Mail from an unverified or unaligned domain goes to spam or is rejected. SPF and DKIM must pass *and align* with the visible From domain for DMARC. Gmail and Yahoo enforce this, and reports say Gmail moved from spam-foldering to rejection for non-compliant traffic in late 2025 (MEDIUM).
- **Defaults on self-hosted boxes.** The onebox default is `EMAIL_PROVIDER=none`, which only logs the link. Every self-hosted install has no email, while the UI may claim "we emailed you".

**How to avoid:**
- Add `resend` to `requirements.txt`, and prove the clean image imports it: `docker build` plus `python -c "import resend"`, never the venv.
- Delivery outcome is **durable state**: outbox `status` (`sent`, `failed` with reason, or `skipped_no_provider`), shown in the in-app notice and the Control Room. Never only a log line.
- Send from a **dedicated subdomain** (e.g. `notify.<domain>`) verified in Resend with SPF, DKIM and a `p=none` DMARC record at first. This protects the root domain's reputation. Add the DNS records to `docs/OPERATOR.md`.
- When the provider is `none`, the UI says so ("email is not set up on this install; you'll see waiting runs here"). Honest numbers.
- Same-commit deploy parity for any new env var (`NOTIFY_FROM_EMAIL`, or reuse `INVITE_FROM_EMAIL` under a decision): `deploy/onebox.env.example`, `docs/OPERATOR.md` Step 3, `docker-compose.prod.yml`, `scripts/check-deploy-drift.sh`.

**Warning signs:**
Outbox rows stuck in pending. `ModuleNotFoundError: resend` in container logs (grep the container directly, since the reembed-progress poll buries the Coolify log UI, per B3). A Resend dashboard showing bounces, or no sends at all.

**Phase to address:** N1. Treat it as a deploy-parity item, not code-only.

---

### Pitfall 10: The email leaks data, or the link does something when it is opened

**What goes wrong:**

- **Prompt content in the email.** The prompt payload carries `prompt`, `options` and **`draft`**, which is the prior phase's output, often document-derived (`panel.py` returns `payload.get("draft")`). Putting the question or draft in the email copies tenant document content into third-party mailboxes, provider logs and lock-screen previews.
- **Markup injection.** Workflow and org names are tenant-controlled. The invite already had to fix HTML injection (WR-02 `html.escape`).
- **Pre-opened links.** Security scanners such as Microsoft Defender Safe Links **open links in emails before the person does**. Community reports describe approve and reject links being triggered automatically (MEDIUM). Any GET link that approves, answers or consumes a token is triggered by the scanner.
- **Tokens in the link.** A link with an auth or session token lets anyone holding the email open the run.

**How to avoid:**
- The email says only *that* a run is waiting and *where*: the workflow name (escaped), the org name, how long it has been waiting, and the canonical `/app/runs/<uuid>` link. No prompt, no options, no draft, no document names.
- The subject line carries no content beyond "A run in *Org* is waiting for you".
- The link is **navigation only**. It needs sign-in, the server decides access, and it has no side effects on GET. The decision is made in the app (SEED-281: "the notification says *go and look*"). Never offer approve-by-email.
- No token in the URL. Reuse the strict-UUID reader pattern from `runDeepLink.ts`.

**Warning signs:**
The email template references `prompt` or `draft`. Any query parameter other than an id on the link. A GET handler that writes.

**Phase to address:** N1.

---

### Pitfall 11: Notifying the wrong person, or too often

**What goes wrong:**

- **Who receives it.** Recipients are ambiguous for unattended runs. Scheduled runs belong to the schedule owner; API-key runs to the key owner (`api_keys.user_id`, org-scoped, and revocable by an admin, `by_admin`). Between launch and pause, that person may have **left the org, been disabled (app-layer ban), or lost access** to the workflow.
- **Attended runs.** For a chat ask in an interactive session the person is already looking. Emailing every ask trains people to mute the channel, and SEED-281 rule 3 says a muted channel does not deliver N-1.
- **Runaway schedules.** A schedule every 5 minutes with an armed step sends a pause email every 5 minutes, which hits Resend's per-team rate limit (default 2–5 req/s depending on the doc page; 429 when exceeded) and gets reported as spam.

**How to avoid:**
- The recipient is resolved at send time: the run owner, re-checked as **a current member of the run's org and not disabled**. The email address comes from `auth.users` server-side (service role) and never from client input. Skip with a recorded reason otherwise.
- **Only email for unattended origins** (scheduled, API key; 293 `run_origin` already records this), or after an unanswered grace period (e.g. 10 min) for attended runs. The in-app notice is always on.
- Coalesce: at most one email per (recipient, workflow) per window, as a digest ("3 runs are waiting"). Use a queue with backoff on 429.
- Per-user opt-out lives in `user_settings` with a Settings control. The memory rule is "everything in UI except secrets"; env holds only the API key. Classify the mail as transactional (no one-click-unsubscribe requirement, MEDIUM) but still give a preference link.
- Multi-approver routing is out of scope (SEED-281 rule 4). Record the decision; do not guess.

**Warning signs:**
Emails to ex-members. More than one email per run per hour. Email sent while the person had the run open.

**Phase to address:** N1.

---

### Pitfall 12: Local dev or tests send real email

**What goes wrong:**
The dev DB holds real addresses (operator and test accounts). A Windows **User-level env var beats `.env`** (memory note: LangSmith 403 caused by an old key there). So a leftover `EMAIL_PROVIDER=resend` / `RESEND_API_KEY` at user level makes local dev and every backend unit run send real mail. Tests that construct the provider without patching it make network calls. Any test importing `resend` at module level in a venv without it becomes a collection error, which breaks the **71-failure baseline ceiling** (zero headroom).

**How to avoid:**
- Add a non-production guard: `EMAIL_REDIRECT_ALL_TO` (or an allowlist) that rewrites every recipient when set. Ship the dev `.env.example` with it set and `EMAIL_PROVIDER=none`.
- Optionally route dev mail to the local Supabase **Mailpit** (web UI on 54324, already in the reserved port block). Verify its SMTP port before relying on it (LOW).
- Lazy-import `resend` only inside the provider (as today). Add a unit fence that the notifier tests patch `get_email_provider`. Run `node scripts/check-backend-unit-baseline.cjs` per wave.

**Warning signs:**
Resend dashboard shows sends from a dev IP. Collection errors above 0 in the baseline run.

**Phase to address:** N1.

---

### Pitfall 13: Org-scoping the shared folder helper changes agent retrieval and unattended runs

**What goes wrong:**
`fetch_visible_folders` (`backend/app/utils/folder_utils.py`) is called by:

- the four `/folders` routes
- the chat agent loop
- run-start kickoff, resume and Continue
- NL generation
- `harness/scope.py`
- the publish gate (stage 2.6)
- `permitted_folder_options` and `threads._authorize_thread_folder`

Adding active-org filtering **inside** it changes retrieval scope mid-run. Worse, **scheduled and API-key runs have no `X-Org-Id` header.** `get_active_org_id` without a header answers **400 for any user in 2+ orgs**. A helper that started requiring the active org would fail every unattended run of a two-org owner.

There is also a polarity trap. `restrict_org_ids=None` means unrestricted, while `set()` means owned only (fail-closed, documented as T-182-54). And the Expert scope rule says **an empty restricted scope = search EVERYTHING** (memory, Phase 266). A list change that produces an empty set flowing into a scope computation can *widen* access.

**How to avoid:**
- Scope **at the list endpoints only**: `GET /folders`, `/folders/{id}/children`, and the workflows library list. Pass the existing keyword, `restrict_org_ids={validated_active_org}`, which already narrows owned folders too (295-10). Do not change the helper's default.
- Runs keep resolving scope from the **definition's** org (the WR-05 publish precedent), never the viewer's active org.
- Add a test matrix: two-org user × {chat retrieval, scheduled run, API-key run, publish}, asserting the same folder set before and after O1. Include an empty-set case asserting that an empty org list never becomes "everything".

**Warning signs:**
The diff touches the `fetch_visible_folders` body or signature default. An unattended-run test without `X-Org-Id` starts 400ing. Expert search results grow after the change.

**Phase to address:** O1.

---

### Pitfall 14: Historical rows sit in an arbitrary org, so items vanish when lists start filtering

**What goes wrong:**

- **Personal-org backfill.** Mig 105 put every pre-org row into the user's **personal org**. A user whose real work moved to a team org will see their whole history disappear from the team org's Library and Workflows.
- **Arbitrary-org autofill.** Mig 106's autofill trigger resolves the owner's org with **`LIMIT 1` and no `ORDER BY`**. Its own comment says this was unambiguous only "pre-167", meaning before multi-org invites. So every folder or workflow a **two-org user created between Phase 167 and 296-01** was stamped with an **arbitrary** org, not the one they were working in. Once O1 filters by org, those items surface in the "wrong" org.
- **Cross-org KB bindings.** Existing workflow definitions whose KB binding points at a folder in another org (created before 296-01) will not show that folder in the builder's KB picker after O1. The picker may show a blank binding, or a save may **silently strip** it. The publish gate already checks bindings against the definition's org (stage 2.6), so some of these workflows may already fail publish for a reason nobody connects to O1.

**How to avoid:**
- **Measure before flipping** with a read-only audit query (Supabase MCP reads are free; run on local and cloud):
  - rows per user per org for two-org users
  - rows whose `org_id` differs from their parent folder's or definition's org
  - definitions whose bound folder's org differs from the definition's org

  Record the numbers in the phase CONTEXT.
- Give lists an **honest empty or partial state**: "Showing *Org B*'s folders. You have 32 folders in *Your personal org*". Offer a switch, never silent absence. A per-item "Move to this org" action (a write, audited) is the repair path for mis-stamped rows. Do not bulk-guess a re-stamp in a migration.
- Pickers render an out-of-org binding **by name, with a "lives in another org" marker**, and saving preserves it unless the author removes it.
- Fold SEED-389's "decide per-org vs per-person" as an explicit recorded decision (milestone intake says per-org).

**Warning signs:**
UAT on the dev account (two orgs) shows a sudden drop in the "Yours" count. A workflow's KB section is empty after O1. Publish failures citing grounding on old workflows.

**Phase to address:** O1. Audit query in its RESEARCH; the honest-empty state in its UI scope.

---

### Pitfall 15: Lists do not refetch on org switch, so stale cross-org data stays on screen

**What goes wrong:**
Only `ChatLayout` (threads), `StreamsProvider`, `ProfileMenu`, `OrgAdminShell`, `ConnectionsTab` and `useOrgPermissionsProbe` read `activeOrgId`. **`LibraryPage`, `WorkflowsPage`, `useDocuments` and the folder tree do not.** Switching org while on the Library keeps the old org's list on screen until the next navigation. With a router, a Back navigation can also restore a cached page showing the previous org's list. There is no react-query cache (the dependency is present but `useQuery` has 0 call sites). Each hook holds its own state, so each must key on the org.

**How to avoid:**
- Every org-scoped list hook takes `activeOrgId` as a dependency and refetches. Follow the ChatLayout precedent: a ref-guarded effect with reconcile-via-fetch, D-v2.5-03.
- Add `activeOrgId` to any route-level data cache key. Ignore responses that arrive for a previous org: capture the org at request time and drop the response if it differs.
- Org switch is a G-4 row: on Library, switch org, assert the list content changes without navigation.

**Warning signs:**
A count badge differs from the list. The list changes only after clicking away and back.

**Phase to address:** O1.

---

### Pitfall 16: New tables or functions for notifications ship with anon access

**What goes wrong:**
A new `notification_outbox`, `notifications` or `user_notification_prefs` table, or a `waiting_on_person` SQL function, ships with RLS off or with the default `EXECUTE` to **PUBLIC**. BUG-260911-01 found `app_settings` and `user_settings` RLS-disabled with `anon` holding all privileges, and every gate stayed green because every test runs as the service role. `REVOKE … FROM anon` is a no-op while the PUBLIC grant stands. If the in-app notice uses Realtime on the new table, it also needs the publication entry in cloud, and it is a hint only (D-v2.5-03).

**How to avoid:**
- The migration enables RLS with owner-only policies. Outbox rows have no client policy at all (backend only).
- Functions: `REVOKE EXECUTE … FROM PUBLIC`, then grant only the needed roles.
- Add one test that makes a request **as `anon`** and **as another authenticated user** and expects refusal.
- Run `get_advisors(security)` (Supabase MCP read) on local and, after the operator-approved apply, on cloud.
- The in-app notice reconciles by fetch on (re)connect. Realtime only nudges.

**Warning signs:**
The advisor flags the new table or function. No anon-role test in the suite.

**Phase to address:** N1 (and O1 if it adds any SQL function).

---

## Moderate Pitfalls

### Pitfall 17: Back/Forward semantics are wrong: history spam or a Back that leaves the app
Pushing a history entry for every tab, filter, panel open or scroll makes Back useless. Using `replace` everywhere makes Back leave the app. **Rule:** `push` for entity or view changes (thread, run, workflow, Expert, top-level view). `replace` for tabs, filters, the document side panel and query state. The Expert detail modal gets its own URL (`/app/experts/<id>`) and closes on Back. Phase 289's `?run=` already uses `replaceState` correctly; keep that pattern for in-view state. **Phase:** R1/R2.

### Pitfall 18: Existing shipped links and redirect targets break across deploy skew
Already in the wild:
- `/app?run=<uuid>` (Phase 289, shared since 2026-10-20)
- `/app?connections=1&oauth_*` (eight backend OAuth redirects in `connectors.py`, built from `primary_frontend_origin()`)
- `/invite?token=` in sent invitation emails
- `/admin/spend`

Vercel (frontend) and Coolify (backend) deploy **independently**, so for a window an old backend redirects to a new frontend and vice versa. **Prevention:** the router keeps reading every legacy shape forever. It translates `?run=` to `/app/runs/<id>` and `?connections=1` to the connections route with `replace`. The backend redirect targets change **after** the frontend that reads both shapes is live. Each legacy shape gets a cold-load test. **Phase:** R1 (translation), R2 (backend redirect updates, if any).

### Pitfall 19: A deep link to a governed or operator view bounces before the permissions load
`useEffectiveFeatures` **fails closed to `{}` while loading** (T-148-FAILCLOSED). `useOperatorProbe` is async. The workflow-run branch is additionally gated on `canvasEnabled`. A route guard that evaluates these before `featuresLoading === false` bounces a legitimate deep link to chat, and the link is lost. The 403 `FEATURE_FORBIDDEN_EVENT` handler does `setActiveView("chat")`; under a router that must be `navigate(..., { replace: true })` without looping. **Prevention:** guards wait on the loading flag, render a holding state, then render either the view or the worded refusal (SEED-185 note 5: "land on a refusal, not a blank"). **Phase:** R1.

### Pitfall 20: The notification badge producer polls per mounted reader
`attentionConditions.ts` documents two readers already (`ChatLayout` shell plus Library) and says to hoist into a provider "the moment" the poll interval drops or a second reader appears. Adding a waiting-run producer with its own fetch per reader doubles the request rate across 2 workers × every open tab. **Prevention:** one server endpoint returns all attention conditions (sources plus waiting runs), one shell reader, and the existing `toHaveBeenCalledTimes(1)` fence extended. **Phase:** N1.

### Pitfall 21: Link origin built from the wrong value
`FRONTEND_URL` is a **comma-separated list** (BUG-260904-04; memory note "⛔ FRONTEND_URL is a LIST"). Any new link builder that reads `settings.frontend_url` directly emits `https://a,https://b/app/...`. **Prevention:** every emailed or redirect link goes through `primary_frontend_origin()` plus the R1 path builder. Add a unit test with a two-origin value (the defect is invisible locally, where the value is a single origin). **Phase:** N1/R2.

---

## Minor Pitfalls

### Pitfall 22: Scroll and focus restoration
Route changes keep the previous scroll offset or drop focus. `scrollTop` is not the reader's position here (memory note); measure a leaf's bounding rect in UAT. Move focus to the view heading on navigation, for screen readers. **Phase:** R1.

### Pitfall 23: Document titles
Every route sets `document.title` (e.g. "Run · <workflow> — Syrel"). Without it, history entries and tabs all read "Syrel", and Back/Forward menus are useless. Do not put sensitive titles in the title on shared machines; workflow names are fine, thread titles are borderline, so decide. **Phase:** R2.

### Pitfall 24: Copy-link copies the wrong origin
The `apiBaseForCurl`-style helper uses `window.location.origin`. On a `*.vercel.app` preview or the apex, a copied link uses that origin. Prefer the configured `VITE_APP_URL` origin when present. It is BUILD-time with a silent fallback (memory note), so test that the fallback is the current origin. **Phase:** R2.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keep `ActiveView` `useState` and mirror it to the URL with `pushState` | Small diff | Two sources of truth; Back/Forward desync; every new view needs both | Never. Make the URL the source and derive the view |
| `?run=`-style query params for every entity instead of path routes | Works on every host today | Not composable (run plus panel plus tab); messy share links | Acceptable only as the legacy-read path |
| Notify inline from `harness_engine` at the pause site | No new sweep | Duplicates on resume and boot; edits a ⛔ G-5 file; misses cap pauses | Never |
| Reuse `INVITE_FROM_EMAIL` for notifications | No new env var | Name lies; one sender for two mail types hurts reputation separation | OK for MVP if recorded as a decision and renamed later |
| `except Exception: log` around sends (copying the invite) | Never fails the request | Silent non-delivery | Only if outcome is also written to the outbox row |
| Org-filter inside `fetch_visible_folders` | One change covers all lists | Changes retrieval for runs; unattended runs 400 | Never |
| Auto-switch org when a link points elsewhere | "Just works" | Kills live streams; flips other tabs' persisted org | Never; prompt instead |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Auth (cloud + self-hosted GoTrue) | Add `redirectTo` in code, forget the Redirect URLs allowlist, and it silently lands on the Site URL | Allowlist `https://app.<domain>/**` (and the apex) in the same release; verify a real SSO round-trip on cloud |
| supabase-js session in URL | HashRouter, or a router that rewrites the URL before the session is read | BrowserRouter; let `detectSessionInUrl` finish before route normalisation |
| Vercel | Assume rewrites beat files; add root-level routes | Filesystem precedes rewrites; use `/app/*`; root `/` only via `middleware.ts` |
| Onebox nginx | Leave `location / → index.html` and add root routes | Keep links under `/app/`, or add explicit `location` blocks and a parity test |
| Resend | Retry without an idempotency key; package missing from the image | `Idempotency-Key` = outbox id; `resend` in `requirements.txt`; verified subdomain with SPF/DKIM/DMARC |
| OAuth connectors (Google, Microsoft, Notion, GitHub) | Change redirect targets in the backend before the frontend reads the new route | Frontend reads old and new shapes first; backend changes after; provider-console redirect URIs are unaffected (they target `backend_public_url`) |
| Supabase Realtime (in-app notice) | Treat a pushed row as the truth | Fetch on (re)connect (D-v2.5-03); cloud publication parity |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Waiting-run sweep scans `messages` with jsonb `@>` across all users | Sweep takes seconds; DB CPU spikes every interval | Index-backed query (partial index on `ask_user_prompt` kind), or drive from runs in paused/active states first and then check asks | Tens of thousands of messages, which this product already reaches (284 measured tens of thousands of docs) |
| One badge poll per reader per tab | Request rate grows with tabs × readers | Single shell reader; combined attention endpoint | Many open tabs per org |
| Per-ask emails from a frequent schedule | 429s from Resend; spam complaints | Coalesce per recipient per window; backoff queue | Any schedule at 15 min or faster with an armed step |
| Route-level refetch of large lists on every Back | Library re-downloads on each Back | Keep paged list state per org within the session; refetch on org change or invalidation | Libraries at 284-scale |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| A different error for "exists in another org" vs "does not exist" shown to non-members | Entity enumeration across tenants | Org hint only for members; everyone else gets the same 404 |
| Ask prompt or draft in the email body | Tenant document content in third-party mailboxes and lock screens | Content-free email; link only |
| Approve or answer via an email GET link | Scanners (Safe Links) trigger it automatically | Navigation-only links; decide in-app with POST |
| `post-auth-return` accepts any URL | Open redirect after login | Same-origin path that starts with `/app` only |
| New notification tables without RLS / functions with PUBLIC `EXECUTE` | Anon reads or writes of who-waits-on-what | RLS plus `REVOKE … FROM PUBLIC`; anon-role test; `get_advisors(security)` |
| Recipient email taken from the request or the run payload | Notifications redirected to an attacker | Resolve from `auth.users` server-side at send time |
| Strict-UUID validation dropped in new route params | Junk or injection into request paths | Reuse the `runDeepLink.ts` `UUID_RE` reader for every id param |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| A link to your own item in another org says "not found" | User thinks it was deleted | "This is in *Org B*. Switch?" |
| Lists silently shrink after org scoping | "Where did my 32 folders go?" | Honest note naming the other org and its count, with a switch action |
| Email for every attended ask | Channel gets muted; N-1 fails | Unattended origins only, or after a grace period; always in-app |
| UI says "we emailed you" when the provider is `none` | False assurance on self-hosted boxes | Show the delivery state from the outbox |
| Back after a tab click leaves the app | Disorientation | `replace` for tabs and filters |
| The email names a step the user can't recognise | No idea what to do | Workflow name, org, waiting since, one button: "Open the run" |

## "Looks Done But Isn't" Checklist

- [ ] **Routing:** deep links cold-loaded on **all four** layers (Vite dev, Vercel app host, `*.vercel.app` preview or apex, onebox nginx). Verify with the parity script plus a live check on one preview.
- [ ] **Routing:** a stream survives Back/Forward/view switches. Verify `subscriptionsRef.size` is unchanged across 6 navigations with a run streaming (G-4 plus vitest).
- [ ] **Routing:** legacy `/app?run=`, `/app?connections=1&oauth_connected=1`, `/invite?token=`, `/setup` and `/admin/spend` still land correctly. One cold-load test each.
- [ ] **Deep links:** a signed-out paste survives password **and SSO** sign-in. Verify a real SSO round-trip on cloud after the allowlist update.
- [ ] **Deep links:** entity content renders, not just the frame. Assert rendered text, not `data-testid` presence.
- [ ] **Fences:** every `?raw`/no-router fence is re-targeted or retired under a decision id. The count gate shows no unexplained per-file decrease.
- [ ] **Notify:** two concurrent sweeps plus a mid-send restart produce **one** email. Verify outbox unique constraint plus Resend idempotency key in a test.
- [ ] **Notify:** an answered ask produces **no** email if answered before send. Verify the pre-send re-check test.
- [ ] **Notify:** the clean Docker image imports `resend`. Verify `docker build` plus import, not the venv.
- [ ] **Notify:** the email body contains no prompt, draft or document text. Verify a template test asserting the absence of payload fields on a seeded prompt with a known marker string.
- [ ] **Notify:** deploy parity: env vars in the onebox example, OPERATOR, compose and drift script in the same commit; DNS records documented.
- [ ] **Notify:** the cross-provider roster for any change touching the agent loop or pause paths (8 rows, blocked rows recorded, never omitted).
- [ ] **Org lists:** scheduled and API-key runs of a two-org owner still resolve the same folders. Verify the before/after matrix test.
- [ ] **Org lists:** out-of-org KB bindings render by name and survive save. Verify a builder test with a seeded cross-org binding.
- [ ] **Org lists:** Library and Workflows refetch on org switch without navigation (G-4 row on the dev account, which is in two orgs).
- [ ] **Security:** anon-role and other-user requests refused on every new table and function; `get_advisors(security)` clean.
- [ ] **Baselines:** backend unit run ≤ 71 failed, 0 collection errors; vitest count gate per-file deltas reviewed.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Deep links 404 or show the landing in production | LOW | Re-issue links under `/app/*`; add the missing nginx `location` or Vercel rewrite; the parity script prevents recurrence |
| Duplicate emails sent | MEDIUM | Pause the sweep (settings flag); add the unique constraint and idempotency key; apology is out of scope, but log the incident in SEED-281's register |
| Mis-stamped org rows surfaced by O1 | MEDIUM | Ship "Move to this org" (audited); never bulk re-stamp by guess |
| Router refactor reds many fences | MEDIUM | Revert to R0's extracted-but-unrouted state; re-target fences one family at a time |
| SSO lands on the Site URL | LOW | Add the allowlist entry (operator, cloud dashboard); no code change if `redirectTo` already ships |
| Mail lands in spam | MEDIUM | Verify SPF/DKIM alignment on the sending subdomain; move DMARC from `p=none` only after reports are clean |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 2 Hot-file fences / extraction | R0 | Extraction diff is behaviour-neutral; all fences re-targeted; reachability checker still throws on a branchless route |
| 1 Four routing layers disagree | R1 | Parity script green; live cold load on a preview and on the onebox nginx image |
| 3 Streams torn down by navigation | R1 | Subscription-count test; G-4 parallel-thread row |
| 17 Back/Forward semantics | R1 | History-length assertions per interaction type |
| 18 Legacy links and deploy skew | R1/R2 | Cold-load tests per legacy shape; backend redirects changed only after the frontend is live |
| 19 Guards before permissions load | R1 | Deep link to a governed view with slow `/features`; lands on the view, not chat |
| 4 Empty entity on paste | R2 | Fetch-by-id restore; content assertions |
| 5 Auth, SSO and boot lose the link | R2 (+SEED-312) | SSO round-trip on cloud; boot-hang test |
| 6 Cross-org link and write placement | R2 + O1 | Two-org dev-account rows; fork-from-other-org test |
| 13 Shared helper scoping | O1 | Before/after matrix incl. unattended runs and the empty-set polarity |
| 14 Historical mis-stamped rows | O1 | Audit query numbers recorded; honest partial state; bindings preserved |
| 15 Lists don't refetch on switch | O1 | G-4 switch-in-place row |
| 7 Duplicate sends | N1 | Concurrent-sweep plus restart test |
| 8 One "waiting" predicate | N1 | Badge and email share one function; liveness and cap-pause cases |
| 9 Mailer not delivered | N1 | Clean-image import; outbox status visible; DNS documented |
| 10 Data leak / scanner clicks | N1 | Template absence test; GET handlers side-effect free |
| 11 Wrong person / too often | N1 | Ex-member skip test; coalescing test; unattended-only rule |
| 12 Dev sends real mail | N1 | Redirect-all guard; baseline ≤ 71 |
| 16 RLS / PUBLIC grants | N1 (O1 if SQL) | Anon-role tests; advisor clean |
| 20 Badge poll multiplication | N1 | `toHaveBeenCalledTimes(1)` extended |
| 21 FRONTEND_URL list | N1/R2 | Two-origin unit test |

**Ordering implication:** R0 → R1 → R2 is a strict chain, because notifications need a stable link shape. O1 can run in parallel with R0/R1 since it is mostly backend list endpoints plus two page hooks. But O1 and R2 must agree on the entity-org resolution contract (Pitfall 6), so settle that contract once, in whichever of the two plans first. N1 comes last: its link builder is R1's, and its "open the run" landing is R2's. Plans that **mutate the local DB** (O1 audit/repair, N1 outbox) must serialize (worktree rule 4).

## Sources

**Project code and records (HIGH):**
- `frontend/devRouting.ts`, `frontend/vercel.json`, `frontend/middleware.ts`, `frontend/nginx.conf`, `frontend/vite.config.ts`
- `frontend/src/App.tsx`, `components/layout/ChatLayout.tsx`, `providers/StreamsProvider.tsx` (about `:4402`, `:4470-4532`), `providers/OrgProvider.tsx`, `lib/api/_core.ts`, `hooks/useAuth.ts`, `hooks/useThreads.ts`, `lib/runDeepLink.ts`, `lib/activeViewReachability.ts`, `components/layout/attentionConditions.ts`, `components/settings/ConnectionsTab.tsx:1146`
- `backend/app/config.py` (`frontend_url`, `backend_public_url`, `primary_frontend_origin`, email settings), `services/email_provider.py`, `api/org.py:405-413`, `api/connectors.py:1436-1770`, `services/ask_user_service.py`, `services/harness/human_input.py`, `api/panel.py:163-226`, `utils/folder_utils.py:222-272`, `dependencies.py:899-951`, `main.py` (`RUN_BOOT_SWEEPS`, scheduler), `requirements.txt` (no `resend`)
- `supabase/migrations/105_personal_org_backfill.sql`, `106_org_id_autofill_trigger.sql` (`LIMIT 1`, no `ORDER BY`)
- SEED-185, SEED-178, SEED-015, SEED-312, SEED-281, SEED-389; `docs/DEPLOYMENT-LESSONS.md` (A1, B1, B3, themes 2 and 6); `docs/OPERATOR.md:552-553`; CLAUDE.md (G-5 ledger, baseline 71, vitest count gate, anon/PUBLIC grant trap, cross-provider roster)

**External (MEDIUM unless noted):**
- [Supabase — Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls.md) (Site URL default; allowlist matching)
- [supabase/auth PR #711](https://github.com/supabase/auth/pull/711) (fallback to Site URL when `redirectTo` is not allowlisted; draft doc text)
- [React Router — Router API (v7)](https://api.reactrouter.com/v7/functions/react-router.Router.html) (renders null when location does not match basename; HIGH)
- [Resend — Idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys) and [engineering post](https://www.resend.com/blog/engineering-idempotency-keys) (24 h dedupe, 409 on payload mismatch)
- [Resend — Rate limit](https://resend.com/docs/api-reference/rate-limit) and [API introduction](https://www.resend.com/docs/api-reference/introduction) (2 vs 5 req/s default; docs disagree, so check the account)
- [Courier — Email sender requirements](https://www.courier.com/blog/email-sender-requirements) and [OneSignal — Google and Yahoo updates](https://documentation.onesignal.com/docs/en/new-google-and-yahoo-email-updates) (SPF/DKIM/DMARC alignment; one-click unsubscribe for bulk/marketing; transactional treatment disputed)
- [Microsoft Tech Community — Defender scanning/clicking links](https://techcommunity.microsoft.com/discussions/microsoftdefenderforoffice365/possible-major-problem-with-ms-defender-scanningclicking-links/3874918) and [Auth0 community — Safe Links](https://community.auth0.com/t/safelink-process-with-microsoft-outlook/142113) (scanners open email links; LOW-MEDIUM, community reports)

---
*Pitfalls research for: v4.8 Every Page Has a Link (routing, waiting-run notifications, active-org lists) on Syrel / Agentic RAG*
*Researched: 2026-10-27*
