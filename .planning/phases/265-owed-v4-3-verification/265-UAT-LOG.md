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
