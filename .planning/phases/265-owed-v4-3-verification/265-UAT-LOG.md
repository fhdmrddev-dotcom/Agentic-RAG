# 265 UAT Log — phase-wide evidence

Drives by Claude over Chrome MCP on the LOCAL stack (backend `:8000`, vite `http://localhost:5173`, Postgres
`127.0.0.1:54322`). Every row carries its own evidence: page-text / network capture + an independent SQL read.
Screenshots live in `evidence/`. Row ids follow the row-id rule in `265-02-PLAN.md`.

⚠ **Screenshot constraint (2026-09-23 23:5x UTC):** the Chrome MCP tab reported `document.visibilityState = "hidden"`
(window behind / minimised), and `Page.captureScreenshot` timed out twice. Evidence for rows driven in that window is
the rendered page text (`get_page_text` / `document.body.innerText`) plus the API response captured by an in-page
`fetch` hook, plus SQL. One partial crop (`evidence/257-row1-kpi-crop.png`) was captured through the zoom action.

## Preflight

- `curl http://localhost:8000/health` → `200` · body `{"status":"ok","redis":"ok","maintenance":false}`
- `curl http://localhost:5173/` → `200`
- Local Supabase (`supabase status -o env`): `API_URL="http://127.0.0.1:54321"`, `DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"`.
- `backend/.env` could not be read (a permission deny rule blocks it). The local-DB proof is therefore **behavioural**:
  the fixture org below exists ONLY in the local Postgres, and the running backend serves it (see the 258 section).
- Base commit at drive start: `ca33dd9bb`.

## Fixtures

D-07: a dedicated standard-tier test org + member user, LOCAL only, kept for re-runs.

| fixture | id | how |
|---|---|---|
| auth user `uat265-standard@example.test` | `8913beee-ca7d-4a58-9376-9b4c477c5bde` | `POST http://127.0.0.1:54321/auth/v1/admin/users` with the LOCAL service-role key from `supabase status` (`email_confirm: true`). The password is held only in the session scratchpad, outside the repo. |
| org `UAT-265 Standard Tier` | `29851b83-7ab7-400d-aa90-65dc369dbba6` | **Deviation from plan:** the `on_auth_user_created` trigger (`handle_new_user`) auto-provisions a personal org + `org-admin` membership for every new user. Creating a second org would have given the user TWO memberships, which defeats the single-membership proof. So the auto-created org was converted in place: `UPDATE organizations SET name='UAT-265 Standard Tier', slug='uat-265-standard', subscription_tier='standard' WHERE id='29851b83-…'` |
| org_members row | (that org, that user, `org-admin`) | created by the trigger; the user's ONLY membership |
| published workflow `UAT-265 Essay Writer` | `dfa0d728-b437-4c20-bc45-fb40596c13e3` | `INSERT INTO workflow_definitions (slug, version, name, description, status, definition, created_by, is_system_global, org_id, skill_snapshots) SELECT 'uat265-essay-writer', 1, 'UAT-265 Essay Writer', description, 'published', definition, <test user>, false, <test org>, skill_snapshots FROM workflow_definitions WHERE id = '84de5934-…'` (the dev org's published "200-Word Essay Writer") |
| schedule `UAT-265 schedule (never fires)` | `52b6631d-fc34-40d5-ab1f-4898fc5ab7db` | `INSERT INTO workflow_schedules (org_id, workflow_id, user_id, name, cron_expression, timezone, is_active, next_run_at) VALUES (<org>, <wf>, <user>, 'UAT-265 schedule (never fires)', '0 0 1 1 *', 'UTC', false, '2099-01-01T00:00:00Z')` |

Single membership: `SELECT org_id FROM org_members WHERE user_id = '8913beee-…'` → **1 row: `29851b83-7ab7-400d-aa90-65dc369dbba6`**.

Tier check: `SELECT subscription_tier FROM organizations WHERE slug='uat-265-standard'` → `standard` (one row).
`tier_capabilities` for `standard` = `basic_rag`, `chat` only; `workflows` is enterprise-only.

Before/after org-tier listing (`SELECT id, coalesce(slug,''), subscription_tier FROM organizations ORDER BY created_at, id`):
33 orgs before, 34 after. `diff` output — the ONLY change is the added line:

```
33c33,34
< a0311162-40da-45f4-91e2-baaffbc642cb||enterprise
---
> a0311162-40da-45f4-91e2-baaffbc642cb||enterprise
> 29851b83-7ab7-400d-aa90-65dc369dbba6|uat-265-standard|standard
```

(The "before" snapshot was taken before the user was created, so the new org did not exist yet. Every pre-existing org,
including the operator's dev org `22f9c615`, kept `enterprise`.)

## 257 row 1 — /admin/spend KPIs, honesty card, ledger (UAT-265-257-1)

Signed in as the operator's dev account (session already present in the browser). Page scope proven by an in-page
`fetch` hook: all three calls (`/admin/spend/summary`, `/admin/spend/runs`, `/admin/spend/rates`) sent
**`X-Org-Id: 22f9c615-0eec-440a-8804-ed4784d6f57f`**, and the summary body echoed `org_id: 22f9c615-…`.
Time filter: `Last 30D` (summary `start_time = 2026-08-23T23:51:41Z`; ledger `time_range=30d`).

Screenshot: `evidence/257-row1-kpi-crop.png` (partial — the KPI card `TOTAL ORG SPEND (ATTRIBUTABLE) $4.2553 *`; see
the screenshot constraint above). Full rendered text read with `get_page_text`.

Independent SQL: rates resolved with a `row_number()` window over `model_rates` (not the route's `LATERAL … LIMIT 1`),
same precedence (org-specific > provider match > latest `effective_from <= started_at`), over
`runs WHERE org_id = '22f9c615-…' AND parent_run_id IS NULL AND started_at >= now() - interval '30 days'`.

| on-screen figure | page | SQL | match |
|---|---|---|---|
| Total org spend | `$4.2553` | per-run `ROUND(cost, 4)` summed → `4.2553` (unrounded sum `4.2546`; the page sums per-run-rounded costs so its rows add up to its total) | ✅ |
| Runs in scope (ledger total) | `Showing 1–50 of 244` | `count(*)` → `244` | ✅ |
| Priced | `121 priced` | rate AND tokens recorded → `121` | ✅ |
| Unrated | `87 unrated` | no rate → `87` | ✅ |
| No tokens (rate, nothing measured) | `36 no tokens` | rate AND `input_tokens IS NULL AND output_tokens IS NULL` → `36` | ✅ |
| Rated (API `rated_runs_count`) | `157` | has rate → `157` (= 121 + 36) | ✅ |
| Tokens counted | `15.07M · In 97% · Out 3%` | `sum(input)=14,581,709`, `sum(output)=490,271` → 15,071,980; in 96.7% | ✅ |
| Partial coverage | `32 partial` | `workflow_runs` last 30 d with coverage NULL or missing a leg → `32` | ✅ |
| Blind spots | `155` | 87 + 36 + 32 = 155 | ✅ |
| Pricing coverage ratio | **`50%` (121 / 244)** | 121/244 = 49.59% | ⚠ see below |
| Honesty gauge | **`49% Priced` · `15% No tokens` · `36% Unrated`** | 49.59 / 14.75 / 35.66 → sums to 100 with largest-remainder rounding | ✅ sums to 100 |

⚠ **Observation `UAT-265-257-1-OBS` (minor, triage input):** the same ratio (121/244) is printed as **50%** on the
"Pricing coverage ratio" KPI and as **49% Priced** on the honesty gauge a few hundred pixels below. The gauge uses
largest-remainder rounding so its three segments sum to 100; the KPI rounds half-up on its own. Both are defensible
alone; side by side, the page contradicts itself by one point on its own headline honesty figure.

"View 87 Unrated Runs →" → ledger request `filter_status=unrated&limit=50&time_range=30d` → API `total_count: 87`;
page text `Showing 1–50 of 87`, 50 rows, 50 `▲ Unrated` badges, **0** occurrences of `$0.0000`. Page 2 (below) holds
37 rows → 50 + 37 = **87 = N**. No unrated or unmeasured run shows `$0.0000` anywhere on the unfiltered page 1 either
(no-token runs render `No tokens recorded`, unrated render `▲ Unrated`).

**Result `UAT-265-257-1`: PASS** — every figure equals its SQL; the filter yields exactly N; no false `$0.0000`.
One minor self-contradiction recorded as `UAT-265-257-1-OBS`. Evidence is page text + API capture + SQL; the full-page
screenshot is owed because the tab was hidden (constraint above).

## D-09 — Spend ledger pagination (UAT-265-D09)

On the unrated filter (N = 87), separate from row 1's reads:

| step | request | page text | rows | first row |
|---|---|---|---|---|
| page 1 | `offset` absent, `limit=50` | `Showing 1–50 of 87` | 50 | `fca551d0…` |
| Next → page 2 | `offset=50` | `Showing 51–87 of 87` | 37 | `43fecdce…` (nvidia/nemotron) |
| Previous → page 1 | `offset` absent | `Showing 1–50 of 87` | 50 | `fca551d0…` |

SQL (unrated runs, same scope, `ORDER BY started_at DESC`): count **87**; row 1 = `fca551d0-28e6-4e58-9b59-403950af5234`;
row 51 = `43fecdce-b020-4f61-b978-2fb6ff9ac93c` — both equal what each page shows first. The unfiltered ledger reads
`Showing 1–50 of 244` = `count(*)` 244. No silent truncation: the total is stated and every row is reachable.

**Result `UAT-265-D09`: PASS.**

## 256 row 2 — pre-stop

`SELECT id, status, input_tokens, output_tokens, token_coverage, updated_at FROM workflow_runs WHERE id = 'a77ed2c0-0b0f-42db-86a3-51e12513e394'`:

```
id=a77ed2c0-0b0f-42db-86a3-51e12513e394  status=active  input_tokens=135142  output_tokens=10317
token_coverage=['agent','single','batch','emit']  updated_at=2026-09-22 21:50:13.597332+00
```

(Tokens identical to the 2026-09-19 reading. Note `status` reads `active`, not a paused literal.)

uvicorn on :8000: `Get-NetTCPConnection -LocalPort 8000 -State Listen` → PID **56412** `python`, StartTime **9/20/2026 9:00:48 AM** (local).

## Incident — backend wedged by a `--reload` restart (2026-09-24, ~04:28 local)

- The operator's backend runs `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload` (master PID 56412,
  started 9/20 9:00 AM). Its worker was **respawned at 9/23 04:28:31 local (PID 75208)**. That was the moment Claude
  created `backend/tests/integration/test_265_org_tier_self_upgrade.py` inside the watched tree (the migration 194
  hotfix; see `265-HOTFIX-194.md`).
- After the respawn, `curl --max-time 10 http://localhost:8000/health` → `000` after 10.0 s. Same for `/setup/status`:
  the socket accepts, and nothing answers. `pg_stat_activity` shows no stuck query. The app shell hangs on its boot
  spinner on every route, because `App.tsx:295` waits on `GET /setup/status`.
- Lesson (restates an existing memory): **never write files into `backend/` while the operator's `--reload` backend is
  serving a UAT**. Claude does not restart the backend (the user owns it), so the drive is paused for the operator.
- ⚠ Observation `UAT-265-257-2-OBS` (triage input): with the backend **hung** (accepting sockets but never answering),
  the app shows an infinite spinner with no reason and no Retry, because `getSetupStatus` has no timeout. 257 row 2
  covers a STOPPED backend (connection refused). The hung case is a separate failure path.

## 257 row 2 — /admin/spend against a stopped backend (UAT-265-257-2)

Backend stop: the operator pressed Ctrl+C, which stopped only the `--reload` worker. The parent (PID 56412) and then
the orphaned worker (PID 75208, which had inherited the listening socket) were ended by Claude **at the operator's
explicit instruction ("kill it")**. After that: `Get-NetTCPConnection -LocalPort 8000 -State Listen` → 0, and
`curl http://localhost:8000/health` → `000`, curl exit **7** (connection refused).

Hard navigation to `http://localhost:5173/admin/spend`. The app shell booted: `/setup/status` fails fast when the
connection is refused. Rendered text, verbatim excerpts:

- `Could not load spend — Failed to fetch` · `Retry`
- `TOTAL ORG SPEND (ATTRIBUTABLE)` `Unavailable` `Data load failed` · `TOKENS COUNTED` `Unavailable` `In: —` `Out: —` ·
  `PRICING COVERAGE RATIO` `Unavailable` · `BLIND SPOTS & RESIDUES` `Unavailable` `— — —`
- `Chart unavailable — spend data did not load` (both charts)
- `What this view cannot see is itself unavailable — spend data did not load.`
- `Attributable Runs Ledger (0)` … `Runs unavailable — the ledger did not load.`

Counts in the rendered text: `0.0k` = **0**, standalone `0%` = **0**, `$0.0000` = **0**, `100%` = **0**; recharts
surfaces = **0** (no empty charts). Clicked Retry once: the banner still reads `Could not load spend — Failed to fetch`,
the 4 `Unavailable` KPIs remain, and there is still no `0.0k` or `$0.0000`.

Screenshot: not captured. `Page.captureScreenshot` timed out again while the tab stayed `hidden`. Evidence is the
rendered text above.

**Result `UAT-265-257-2`: PASS** (CR-07 contract holds for a stopped backend).

row 2 recorded — restart the backend now

## 256 row 2 — post-restart (UAT-265-256-2)

| reading | when | input_tokens | output_tokens | token_coverage | uvicorn |
|---|---|---|---|---|---|
| pre-stop (DB) | before the stop | 135142 | 10317 | agent,single,batch,emit | PID 56412, StartTime 9/20/2026 9:00:48 AM |
| post-restart (DB, direct asyncpg 54322) | after the operator's restart | 135142 | 10317 | agent,single,batch,emit | PID **54832**, StartTime **9/23/2026 8:24:51 AM**, strictly later |
| post-restart (API `GET /workflow-runs/a77ed2c0…`, dev bearer in-page, `X-Org-Id: 22f9c615…`) | same | — (not exposed) | — (not exposed) | agent,single,batch,emit | 200 |

The API returns `cost_usd = 0.0529`. Recomputed from the persisted tokens with the resolved rate (deepseek-v4-flash,
global, `$0.30` in / `$1.20` out per M, effective 2024-01-01): 135142 × 0.30/1e6 + 10317 × 1.20/1e6 = 0.05292 → **0.0529**.
The API is therefore pricing exactly the persisted tokens.

Process boundary: the stop was real. `Get-NetTCPConnection -LocalPort 8000 -State Listen` → 0, and curl returned exit
7 (connection refused) before the restart.

`updated_at` moved from `2026-09-22 21:50:13` to `2026-09-23 00:39:44` UTC between readings on 09-22 and 09-23, with
the tokens unchanged. Some writer touched the row. Recorded, not investigated.

**Result `UAT-265-256-2`: PASS.**

## 257 row 3 — cost on chat RunCards and the workflow run page (UAT-265-257-3)

Signed in as the dev account, org `22f9c615`. Evidence: rendered text plus the **computed `color`** of each badge
element (`getComputedStyle`), the API `/threads/{id}/messages` body read in-page, and SQL. No screenshot, because the
tab was hidden.

| surface | thread / run | run(s) (SQL) | rendered | color |
|---|---|---|---|---|
| chat, rated, tool-using | `644ac824` "Document fetch and sandbox operation task" | 5 completed rated runs with tokens | `$0.0225` `$0.0155` `$0.1639` `$0.0389` `$0.0081` (each rendered twice: header + collapsed row) | `rgb(52, 211, 153)` = emerald-400 ✅ |
| chat, unrated, tool-using | `fa964e0d` "list my folders" | 3 × `openai/gpt-oss-20b` (ollama, no rate), 18341/190 · 18877/200 · 19660/426 tokens | `Unrated` × 3 runs (×2 renders) | `rgb(251, 191, 36)` = amber-400 ✅ |
| chat, **rated, tool-LESS** | `fa964e0d`, message `9b6a5002` | `ee6e5412` deepseek-v4-flash, 12170/592 tokens; API returns `cost_usd: 0.0044, is_rated: true` | **nothing**: no model, no cost, not on hover either | — ❌ |
| chat, rated-but-unmeasured | — | ⛔ none observable: 0 completed rated no-token runs in the org have a tool-using reply (SQL); Meridian's `af905f64` has no `message_id` | — | ⛔ |
| chat asterisk | all of the above | — | `$x.xxxx *` pattern count = **0** | ✅ |
| workflow run page | `a77ed2c0` (via "Open the run") | deepseek-v4-flash 135142/10317 | `$0.0529` | `rgb(52, 211, 153)` emerald ✅ |

⛔ **Finding `UAT-265-257-3-NOCARD` (major, triage input):** `MessageItem.tsx:528` mounts `RunCard` only when
`message.tool_calls` is non-empty, and `RunCostBadge` is mounted only inside `RunCard` (`RunCard.tsx:409-417, 453-460`).
So **a chat reply that used no tools never shows its cost**, whether rated, unrated or unmeasured, even though
`GET /threads/{id}/messages` returns `cost_usd` / `is_rated` for it. Size, measured in the dev org: **148 of 596**
completed chat runs with a linked reply are tool-less (25%). SC#4 "an operator sees spend in dollars per run" does not
hold for a quarter of chat runs. The `No tokens recorded` chat state could not be observed with existing data (it does
render on the /admin/spend ledger, row 1).

**Result `UAT-265-257-3`: FAIL.** Rated (emerald), unrated (amber) and no-asterisk pass on tool-using cards and on
the run page. Tool-less replies show no cost at all (`UAT-265-257-3-NOCARD`). The unmeasured chat state is ⛔ not
observable.

## 258 — the three refusals as a standard-tier org (UAT-265-258-a/b/c)

**Sign-in method (deviation, stated):** Claude does not type passwords into page fields. It obtained a session for
the LOCAL fixture user `uat265-standard@example.test` from the local GoTrue token endpoint (shell, password from the
session scratchpad), backed up the operator's browser session to a separate localStorage key, swapped in the fixture
session plus `active-org-id = 29851b83…`, drove the three rows, then restored the operator's session. Restoration was
verified: the page shows `fhdmrd@gmail.com` and `active-org-id = 22f9c615…`. The session file was deleted from the
scratchpad afterwards. No token or password is written in `.planning`.

**Active org proof:** every API call the pages made carried **`X-Org-Id: 29851b83-7ab7-400d-aa90-65dc369dbba6`**
(in-page fetch capture), e.g. `GET /workflows/published`, `GET /workflows/dfa0d728…/schedules`, and the three refused
POSTs below. The sidebar identity read `uat265-standard@example.test`. The fixture user has exactly ONE membership
(`SELECT org_id FROM org_members WHERE user_id='8913beee-…'` → 1 row, `29851b83…`). The running backend served this
LOCAL-only fixture org, which is the behavioural proof that the backend is on the local DB.

**Visibility:** the Workflows nav entry, the library (4 ready-to-run, including `UAT-265 Essay Writer`), the Builder,
and the schedule dialog's `Run now` are all SHOWN to the standard tier. No door is hidden, so no `-HIDDEN` rows.

| id | action | request | status | response body (verbatim) | on-screen text (verbatim) | names the plan? |
|---|---|---|---|---|---|---|
| **UAT-265-258-a** | run the published workflow into a thread (card `Run` → modal `▶ Run workflow`) | `POST /threads` 201 → `POST /threads/fe3c413b…/messages` → `DELETE /threads/fe3c413b…` 204 (cleanup) | **403** | `{"error":"entitlement_required","capability":"workflows","required_tier":"enterprise","current_tier":"standard","upgrade_hint":"Upgrade to Enterprise to use workflows."}` | `Your plan doesn't include workflows. It is part of the Enterprise plan.` (modal + toast) | ✅ **PASS** |
| **UAT-265-258-b** | create a draft (`Build a workflow` → `Build it myself` → goal → `Write the first draft`) | `POST /workflows/generate` | **403** | same shape, `required_tier: enterprise` | `Couldn't generate — Couldn't generate the workflow.` · `Failed to generate workflow (status 403)` · `Nothing was saved.` | ❌ **FAIL** |
| UAT-265-258-b (API arm) | plain draft create | `POST /workflows` `{}` (fixture bearer, in-page) | **403** | same shape, `required_tier: enterprise` (the gate fires before body validation) | — | (API only) |
| **UAT-265-258-c** | `Workflow actions` → `Schedules…` → `Run now` on `UAT-265 schedule (never fires)` | `POST /schedules/52b6631d…/trigger` | **403** | same shape, `required_tier: enterprise` | toast: `The request was refused (status 403)` | ❌ **FAIL** |

Afterwards (SQL, test org): `workflow_runs` 0 · `runs` 0 · threads 0 · schedule `is_active=false,
last_run_at=NULL, last_status=NULL`. Every refusal refused. Nothing ran and nothing was kept.

**Result (258 row): FAIL.** `UAT-265-258-a` PASS; `UAT-265-258-b` and `UAT-265-258-c` FAIL: the server names the
plan in every body, but two of the three UI doors discard it and print a raw status code. This matches the audit-fix
review's R265-audit-fixes-05 (five of six gated authoring doors still show "Failed … (status 403)").

## 261 — fixtures (VERIFY-03)

Drive org: the dev enterprise org `22f9c615-0eec-440a-8804-ed4784d6f57f`. Three LOCAL fixture users, created through the
GoTrue admin API. Passwords are kept only in the session scratchpad, never in `.planning`. Each fixture's
trigger-provisioned personal-org membership was **detached**, so each has exactly ONE membership (in the drive org).

| user | id | role in drive org | why this role |
|---|---|---|---|
| `uat265-author@example.test` | `1f13dc7b-746f-41f3-9318-d921ea94d5b2` | `org-admin` | lowest role that can author: `require_expert_manage` (`api/experts.py:111`) checks `experts:manage`, and `role_permissions` grants it only to `super-admin` and `org-admin` |
| `uat265-inside@example.test` | `cdaa02a1-b1b4-4ee8-b8b8-fbf9fae8021f` | `dept-admin` | a real `org_members.role` value (CHECK: super-admin / org-admin / dept-admin / member), resolved by `resolve_caller_role` (per `cdf3a308a`) |
| `uat265-outside@example.test` | `d9e4f4e7-bf88-46c8-a4ce-2af03bca9de7` | `member` | distinct from inside |

`SELECT u.email, m.org_id, m.role FROM org_members m JOIN auth.users u ON u.id = m.user_id WHERE u.email LIKE 'uat265-%'`
→ author, inside and outside each have ONE row in `22f9c615`. The standard-tier fixture has one row in `29851b83`.
The Org Admin > Members list, rendered as the author, shows all three with these roles.

**Removal SQL (for the operator, at will):**
```sql
DELETE FROM public.org_members WHERE user_id IN ('1f13dc7b-746f-41f3-9318-d921ea94d5b2','cdaa02a1-b1b4-4ee8-b8b8-fbf9fae8021f','d9e4f4e7-bf88-46c8-a4ce-2af03bca9de7');
DELETE FROM public.expert_grants WHERE expert_id = '253ba288-7483-4af7-9979-e88f8c54cc98';
DELETE FROM public.expert_bundles WHERE id = '253ba288-7483-4af7-9979-e88f8c54cc98';
DELETE FROM auth.users WHERE id IN ('1f13dc7b-746f-41f3-9318-d921ea94d5b2','cdaa02a1-b1b4-4ee8-b8b8-fbf9fae8021f','d9e4f4e7-bf88-46c8-a4ce-2af03bca9de7');
-- detached personal orgs (now memberless): 534245dc-946f-4b2c-851e-7f87d0eca29f, 23ca2a2e-ab2d-47bf-a763-cb289f3f323c, 823a8a30-c866-4804-8cbf-75ff980e0bbb
```

Sign-in used the same session-swap method as the 258 section: the operator's session was backed up and restored, and
no password was typed into a page. The API-only arms used each fixture's session inside a shell process.

## 261 row 1 — authoring mechanics (UAT-265-261-1)

Driven as the author: the sidebar reads `uat265-author@example.test` and every call carries `X-Org-Id: 22f9c615…`.
Surface: Org Admin > Experts. Counts are `SELECT count(*) FROM expert_bundles WHERE org_id = <org>` and the same query
on `documents`.

| step | UI / API | expert_bundles | documents | notes |
|---|---|---|---|---|
| BEFORE | — | **3** | **165** | UI reads "Showing 4 of 4 experts" (3 org + 1 system) |
| attach `reference.pdf` (3 KB) + brainstorm → **Generate Candidate Draft** | `POST /experts/draft` 200 | — | — | draft built from the PDF: name "Technical Reference Briefing Analyst", sample output "Kestrel HTTP Server Limits — v2.4 Reference · Brief" |
| edit the draft (rename to "… (UAT-265)") | — | — | — | — |
| **pre-Save** | — | **3** | **165** | nothing saved; `documents WHERE filename ILIKE '%reference%'` = 0 |
| Save held | UI | — | — | "3 capabilities are not real yet … Create or remove each one first … Save is held while proposed skills are unresolved." Claude removed the 3 proposed skills, because creating skills is plan 04's scope |
| **Save & Publish Expert** | `POST /experts` 201 | **4** | **165** | listed; row `44b9d5b0…`, created_by = author, description of **3090 chars** saved (the old 1000-char cap did not block it) |
| edit + **Update Expert** | `PATCH /experts/44b9d5b0…` 200 | 4 | 165 | listed as "(UAT-265 edited)" |
| trash → "Delete Expert Bundle?" → **Delete Expert** | `DELETE /experts/44b9d5b0…` 200 | **3** | **165** | gone from the list ("Showing 4 of 4") and from the DB |

The PDF never reached the Library: the org's `documents` count stayed at 165 at every step, and no document named like
`reference` exists. Claude's reading is that every mechanic this row names held. **The verdict is the operator's
(D-06).** Evidence is API captures, rendered text and SQL, because screenshots were not possible (the tab was hidden).

## 261 row 2 — grant fence, creator bypass excluded (UAT-265-261-2-user / UAT-265-261-2-role)

Expert `253ba288-7483-4af7-9979-e88f8c54cc98` "UAT-265 Billing SOP Advisor", `visibility = granted`, was created by the
author via `POST /experts` (201). **`created_by = 1f13dc7b` (author), which differs from inside `cdaa02a1` and from
outside `d9e4f4e7`**, so the creator bypass (`experts.py:281-282 / :323`) is not in play for either caller. Each
caller drove against a thread it created itself (outside `09f7ec0d…`, inside `5933c897…`).

**UAT-265-261-2-user.** `expert_grants` = `[user:cdaa02a1]` (grant `d1d0d98e…`).

| caller | id | role | created_by | GET /experts (listed?) | GET /experts/{id} | PATCH /threads/{own} active_expert_id |
|---|---|---|---|---|---|---|
| outside | d9e4f4e7 | member | 1f13dc7b | 200, **absent** | **404** `Expert bundle not found` | **404** `Expert bundle not found or access denied` |
| inside | cdaa02a1 | dept-admin | 1f13dc7b | 200, **present** | **200** | **200** (invite applied) |

**UAT-265-261-2-role.** The user grant was removed (200) and a role grant added (201, `7f91b47f…`), so
`expert_grants` = `[role:dept-admin]`.

| caller | id | role | created_by | listed? | GET | PATCH invite |
|---|---|---|---|---|---|---|
| outside | d9e4f4e7 | member | 1f13dc7b | **absent** | **404** | **404** |
| inside | cdaa02a1 | dept-admin | 1f13dc7b | **present** | **200** | **200** |

⚠ Method note: between arms Claude sent `active_expert_id: null` to reset the inside thread. `ThreadUpdate` clears
with `clear_active_expert`, not with null, so the inside thread still held the Expert and the role-arm 200 re-applied
it. The access check runs on every PATCH (the outside 404 on the same request shape proves this), so the positive
control still holds. The list and picker evidence is the API list, not a screenshot.

**Result: PASS.** All four negatives and both positive controls hold, with `created_by ≠ caller` on every line.

## 261 row 3 — D-v4.3-03 union + tool floor (UAT-265-261-3)

Expert folder: **SOPs** `1fce5dee…` (document `ac8e1abd…` "CS SOPs final_29 Oct 2025_Billing Team Comments.pptx").
Thread folder: **ToT** `e400e289…` (document `9f0af715…` "Train-the-Trainer.pptx").
Expert settings: `scope_mode = biased` (union), `tool_floor_enabled = true`.

**Attempt 1 — as the author fixture** (thread `bcc3a269…`, run `e340ddc5…`). The UI showed `USING: UAT-265 Billing
SOP Advisor · BIASED`. After 19 steps the agent paused on `ask_user`, saying *"your document library currently
contains 0 documents and 0 folders."* Cause (SQL): both folders are the operator's **private** folders
(`is_org_shared = false`, owner `fhdmrd@gmail.com`), so retrieval correctly returns nothing to another user. Claude
answered the pause ("test, stop") to end the run.

⚠ **Observation `UAT-265-261-3-ACCESS` (triage input):**
- (i) `POST /experts` accepted `knowledge_folder_ids` naming a folder the author cannot read, and `POST /threads`
  accepted a `folder_id` the author cannot read. Both returned 201 with no refusal.
- (ii) An Expert granted to users carries no read access to its own folders. A granted user whose own permissions
  exclude those folders gets an Expert with no knowledge, and is not told so up front.

**Attempt 2 — as the folders' owner** (the operator dev account `fhdmrd@gmail.com`; a user grant `14a19546…` was
added so it may use the Expert). Thread `1746c825-c354-4d4f-b774-050f4771ae94` has folder ToT and the Expert invited;
the UI shows `USING: UAT-265 Billing SOP Advisor`. Run `bc90b61b-8650-4c04-bbb7-ef5c92cceea7` got the same three-part
prompt and completed in about 80 s.

| tool call | argument | documents hit (folder) |
|---|---|---|
| `ls` | `/ToT` | Train-the-Trainer.pptx (**ToT**, the thread folder) |
| `search_documents` ×4 | training and billing queries | the billing SOP doc (**SOPs**, the Expert folder) |
| `read_document` | `9f0af715…` | Train-the-Trainer.pptx (**ToT**) |
| `read_document` | `ac8e1abd…` | CS SOPs … Billing Team Comments.pptx (**SOPs**) |
| `analyze_document` | training programme summary | — |
| `execute_code` | writes `uat265-summary.md` | output file of **2547 bytes** at `/sandbox-outputs/d8a54002…/4378043c…/uat265-summary.md`; a `code_executions` row exists for the thread |

The answer covers both folders. From ToT: the 2-day / 16-hour Train-the-Trainer programme and its 8 sessions. From
SOPs: IBT billing tickets resolved within 48 working hours, with a 24h / 48h / 72h escalation ladder. It ends
"I've created uat265-summary.md". `workspace_files` has no row for the thread; the file is a sandbox output, not a
workspace file.

Claude's reading: the union holds (both folders read in one run), and so does the tool floor (`execute_code` stayed
available and the file was written). **The verdict is the operator's (D-06).**

## 256 row 3 — judge-usage fidelity (UAT-265-256-3)

First pass: ⛔ BLOCKED (LangSmith MCP not connected). Unblocked on 2026-09-24: `langsmith-mcp-server` had never been
installed, so the launcher exited. It now runs from an isolated `.tools/langsmith-mcp-venv` (commit `b7f510447`), and
the operator reconnected it.

**Drive (real provider, no `forced_emit` patch, no harness):** as the dev account (`fhdmrd@gmail.com`, org
`22f9c615`), a copy of the draft "KB Cited Answer (3–5 Bullets)" was created as `2f39686b-6b23-44ad-a41b-a1fd793341f3`
("UAT-265 judge probe"). Its `send_email` external-action step was removed so the golden run could neither send mail
nor stop at a human gate. The operator's own draft was untouched. Then
`POST /workflows/2f39686b…/publish {golden_input: "What do the documents in this project say about project management
best practices?"}` was sent from the page with the operator bearer; this is the same request the Builder's Publish
sends. It started 06:57:46Z and returned at 06:58:46Z:
`200 {published: false, blocked_stage: "judge", golden_run_id: "b9fd2baf-9dc1-4f3b-99c3-0b3b88109b5f"}` with judge
evidence "No answer to the underlying question is available from the provided materials." The judge shot ran, which
is all this row needs.

| reading | input_tokens | output_tokens | source |
|---|---|---|---|
| golden run at completion (06:58:42Z, before the judge) | 155564 | 5142 | `SELECT … FROM workflow_runs WHERE id = 'b9fd2baf…'` (polled) |
| golden run after the judge (06:58:46Z) | 156070 | 5392 | same SELECT |
| **persisted judge delta** | **+506** | **+250** | difference |
| **provider-reported, judge shot** (LangSmith run `4a68bae7-ce46-4f63-8dab-1aad7eadab2b`, `ls_model_name = gpt-5.4-mini`, `ls_provider = openai`, 06:58:42 → 06:58:46) | **506** | **250** | FQL `and(eq(id, "4a68bae7…"), eq(prompt_tokens, 506), eq(completion_tokens, 250))` → returns the run |

Controls:
- `and(eq(id, "4a68bae7…"), eq(total_tokens, 757))` → **0 runs** (the filter discriminates).
- Every `gpt-5.4-mini` LLM run from 06:57:40 to 07:05:00 → exactly `4a68bae7`. The same filter with that id excluded
  → **0 runs**, so there was ONE judge shot and no retry was missed.

Why the delta method rather than persisted − Σ(non-judge): LangSmith's page budget (30k chars) cannot return the
golden run's streamed calls with their usage fields. The before/after reading of the same row isolates the judge's
contribution directly, which is what the row asks about.

⚠ Observation `UAT-265-256-3-OBS` (info): LangSmith names the OpenAI `gpt-5.4-mini` judge call **"ChatDeepseek"**.
The trace run name is mislabeled across providers, and only the metadata carries the true model.

**Result `UAT-265-256-3`: PASS**: persisted judge delta = provider-reported usage, exact for input (506) and output (250).

Leftover: draft `2f39686b…` "UAT-265 judge probe" remains in the dev org as an unpublished draft (removable at will).

## 261 — operator verdicts (D-06)

2026-09-24, operator reply: **"pass"**, covering both human-judgement rows.

- `UAT-265-261-1`: **PASS** (operator)
- `UAT-265-261-3`: **PASS** (operator)

## 263 re-drive post-WR-08 (UAT-265-263-R1 … R9)

Full per-row lines and the R-9 board are in `263-UAT.md` § "Re-drive post-WR-08 — Phase 265". HEAD `d24586ce2`
(`f04d9c406` is an ancestor). BEFORE: skills 11, expert_bundles (org) 4, `self_improve_enabled = true`.
AFTER: skills 12 (+1, the one approval), expert_bundles 5 (+1, the saved Expert), `self_improve_enabled = true`,
`zzz-265%` skills = 0.
Verdicts: R-1 through R-6 PASS, **R-7 FAIL**, R-8 PASS, R-9 PASS (8/8; DeepSeek on retry).

`UAT-265-BUG-260921-02 PASS 4432 chars saved, draft-skill-body HTTP 200`. The fresh doctoral draft's description is
4432 chars. `POST /experts/draft-skill-body` carried `expert_description` of 4432 chars and returned 200.
`POST /experts` saved the Expert with `length(description) = 4432`.

## 263 approval round trip (UAT-265-263-APPROVAL)

- Expert **`a3cbcb0c-7d7a-4dee-97a1-318c3e3b8500`** "UAT-265 Doctoral Literature Review Methodologist". Created by
  the dev account (`d8a54002`) with `visibility = org`.
- Approved ONE proposal through "Create this skill →": `prisma-2020-protocol-builder` → `POST /skills` 201.
- Ticked ONE existing library skill: `financial_ratio_calculator`.
- Captured Save Expert request (`POST /experts` 201) → **`born_skills: ["prisma-2020-protocol-builder"]`**.
  `member_skills: [search-strategy-builder, docx, xlsx, prisma-2020-protocol-builder, financial_ratio_calculator]`.
- `SELECT name, born_for_expert_bundle_id FROM skills WHERE name IN (…)`:
  - `prisma-2020-protocol-builder` → **`a3cbcb0c…`** (stamped)
  - `financial_ratio_calculator` → **NULL** (not stamped)
- Second member: `uat265-outside@example.test` (`d9e4f4e7`, member). Active org is `22f9c615` (`X-Org-Id`).
  `created_by` (`d8a54002`) ≠ caller. `GET /experts/a3cbcb0c` → 200.
  - Thread **`13fb6a40-1a48-4f16-922c-c201593ad36b`**, run **`1813ba6b-f802-471b-9069-bc81027d3b0f`** (completed):
    `load_skill` returned `{"name": "prisma-2020-protocol-builder", "instructions": "When given a review question, …"}`,
    and the answer followed its five-step method ("built per the skill's five-step method").
  - A follow-up run `3eeeecc2…` asked for the other four skills. `docx` and `financial_ratio_calculator` loaded;
    `search-strategy-builder` and `xlsx` returned "not found or not enabled". This is the R-7 FAIL.
- Claude's reading: WR-08's non-empty `born_skills` path works end to end. **The verdict is the operator's (D-06).**

## 263 approval — operator verdict (D-06)

2026-09-24: operator **"pass"**, so `UAT-265-263-APPROVAL` is **PASS**. BUG-260921-02 is closed on the R-1/R-3 evidence.
