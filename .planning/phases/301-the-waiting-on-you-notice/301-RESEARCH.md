# Phase 301: The Waiting-on-You Notice - Research

**Researched:** 2026-10-29
**Domain:** FastAPI read route over migration-218 notices + Supabase Realtime hint + app-shell attention registry (React/Radix)
**Confidence:** HIGH for code facts (every claim cites file:line, measured this session); MEDIUM for Realtime runtime behaviour (official docs + installed realtime-js source, not driven live)

## Summary

The data side is almost done: migration 218 already writes exactly one open `notifications` row per waiting workflow run, closes it on answer/expiry/terminal status, and has an owner-only SELECT policy. Phase 301 needs ONE read route, ONE migration (publication membership), ONE data hook, the second registry tenant, and the rail control. Nothing in the engine, the run page or `StreamsProvider` needs to change.

The code contradicts several CONTEXT premises in small but plan-shaping ways (F1–F18 below). The four that change task structure: (1) adding any route reds `test_276_openapi_snapshot_fresh` (backend gate has zero headroom) unless the OpenAPI snapshot is regenerated and `build-public-openapi.cjs` learns the new tag in the same commit; (2) Radix `DropdownMenuContent` swallows Tab, so rows must be `DropdownMenuItem`s (arrow-key stops, not tab stops); (3) the non-chat mobile hamburger has no dot at all, and the drawer and its Library badge live in `ChatLayout.tsx`, so "ChatLayout one hunk" (D-22) is not reachable — expect 3-4 small hunks plus an `AppViewSwitch.tsx` touch (which takes it to 3 phases); (4) `AttentionCondition` cannot carry org / waited-since / kind / server total today, and the badge count must be the server total, not the 50-capped list length.

**Primary recommendation:** Pool-read route with the caller bound as `$1` (the `link_resolver.RUN_SQL` posture) and `wr.status IN ('active','paused')` as a second wall; migration 219 + supplement §4 line; a `useWaitingNotices` hook (fetch is truth, Realtime only triggers refetch, try/catch around the channel); `AttentionCondition` becomes a discriminated union on a required `mark`; a new `WaitingOnYouControl` modelled on `ProfileMenu`'s Tooltip+DropdownMenuTrigger composition, rows as `DropdownMenuItem onSelect={() => openRun(id)}`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Where the badge lives (auto — recommended)**
- **D-01: One dedicated rail control, "Waiting on you", near the top of the 58px rail** (under New chat / Search, above the nav items) — present on every view `ChatLayout` mounts, collapsed or expanded rail. Not on the Library item (that badge stays the Library's), not inside the profile menu (hidden = the "nothing in the shell points at it" failure), not on the Workflows item (a scheduled run's owner may never open Workflows).
- **D-02: The control is always present; the count appears only when > 0.** Amber count (needs-you colour language) carried by the number, never colour alone; the control's accessible name carries the sentence ("2 workflow runs are waiting on you"). Zero → no badge, no reserved space; opening it shows "Nothing is waiting on you."
- **D-03: Mobile:** the drawer-opening hamburger dot lights for a waiting notice too (it already lights for any shell condition), and the drawer gets a "Waiting on you (N)" row that opens the same list.
- **D-04: Rail density (BUG-260923-01) is NOT folded** — it is an IA reorganisation owned by SEED-166 / SEED-196; this phase adds one control and records the count. Reviewed and left open (re-open trigger unchanged).

**The list (auto — recommended)**
- **D-05: A popover anchored to the control, on the same shadcn `DropdownMenu` primitive as `AttentionPopover`/`ProfileMenu`** (no new package). Header "Waiting on you"; one row per open notice.
- **D-06: A row says:** workflow name (title) · the org (298's `OrgAvatar` + org name) · the kind word ("needs your answer" / "needs your approval", from `notifications.kind` only) · how long it has waited ("waiting 3 min", from `created_at`, re-rendered each minute). No question text, no document content. Every row names its org, including rows in the active org (one shape, never a conditional label).
- **D-07: Order = waited longest first.** One flat list, not grouped by org (the org is on every row).
- **D-08: The whole row is one button** (keyboard + touch reachable, one tab stop per row) that closes the popover and calls `openRun(run_id)` → `/app/runs/<id>`. ⛔ It never calls `switchOrg` itself: 299's `LinkGate` resolves the run and shows `SwitchOrgPrompt` when the run's org differs (Stay / Switch). Research confirms the run route goes through the gate when opened by push, not only on cold load.
- **D-09: No mark-read, no dismiss, no snooze.** A notice is a fact about a run that is waiting; it leaves only when the wait ends. A dismissed waiting run is exactly the silent stop `SEED-281` is about. (Deferred, see below.)
- **D-10: No cap in the UI below the server's bound:** the route returns at most 50 open notices (oldest-waiting first); above that the list ends with "and N more" as plain text (count from the route).

**The registry: second tenant (from ROADMAP flags — locked; shape auto — recommended)**
- **D-11: The waiting notice is the second tenant of `ATTENTION_PRODUCERS`** (key `waiting-runs`). The `length === 1` pins in `NavPanel.badge.test.tsx` and `attentionTab.test.ts` are **re-baselined to 2 with the second key asserted, in the same commit** — never deleted. The D-235-03 docblock is amended *beside* its original sentence (struck through, not overwritten), naming this phase as the deliberate override and correcting the seed id (`SEED-231` in the docblock is superseded; the register id is `SEED-281`).
- **D-12: Each condition says which shell mark it belongs to** (a new field set by its producer, e.g. `mark: "library" | "waiting"`); the Library rail badge and its popover count only `library` conditions, the new control only `waiting` ones; the mobile hamburger dot lights for any. Waiting conditions carry no `tab`, so `attentionCountByTab` and the Library tab strip are unchanged by construction (the "breaks the Library's tab badge" failure). The Library popover keeps its one footer action.
- **D-13: The producer hook signature widens to a context object** (`use({ openLibraryHealth, openRun })`) so each tenant takes the door it needs; `ChatLayout` keeps its ONE `ATTENTION_PRODUCERS.flatMap` read (the `ChatLayout.badge.test.tsx` count fence stays at 1). Research names the exact pins this touches.
- **D-14: One reader.** The waiting data hook is called once, through the registry in `ChatLayout`; nothing else calls it (an inventory fence like the `useSourceAttention(` one pins the call-site count).

**Freshness: server is truth, Realtime is a hint (D-v2.5-03 — locked; mechanics auto — recommended)**
- **D-15: `GET /notifications`** in a **new module** (`backend/app/api/notifications.py` + a small db/service helper), `main.py` gains one `include_router` (honoured by construction). Returns the caller's OPEN notices (`closed_at IS NULL`) **across every org they currently belong to** (joined through `org_members` — a notice for an org they have left is not listed), each `{id, run_id, org_id, org_name, workflow_name, kind, created_at}` plus a total count. Reads through `run_in_threadpool` (D-v2.5-01). Recipient filter in the same statement; anon-role test; a test that one user never sees another's notices.
- **D-16: Migration `219`** adds `public.notifications` to the `supabase_realtime` publication (precedent: migrations 002/014/032) — nothing else. RLS's owner-only SELECT policy (218) governs what Realtime delivers. Local apply via SQL editor, then `bash scripts/regenerate-full-schema.sh` (no `--reset`); cloud paste + `get_advisors(security)` only at deploy, per-action approval. Research checks whether publication membership survives the schema dump or needs `scripts/full-schema-supplement.sql`.
- **D-17: The client reconciles by fetch on:** first mount, any Realtime event on its own notices (INSERT or UPDATE → refetch, never patch local state from the payload), Realtime (re)subscribe, window focus / tab visible, an active-org switch, and a fallback poll (60 s) — so a missed event can only delay, never strand, the count. A failed fetch keeps the last known list (never shows an empty all-clear it did not receive; same `verdictKnown` rule as `useSourceAttention`).
- **D-18: The subscription is user-scoped, not org-scoped** (`recipient_id = eq.<uid>`), so an org switch never drops cross-org notices, and it lives outside `StreamsProvider` (no edit to that file; no effect on any live stream subscription).

**Exclusions held by construction**
- **D-19: A chat `ask_user` never produces a notice** — 218's trigger writes only for asks on a workflow run in `active`/`paused` status. A DB-backed test drives a chat-thread ask and asserts zero rows (the "a chat ask_user shows up as a notice" failure).
- **D-20: Scheduled and API-key runs** appear because their owner is the recipient (218 triggers); one G-4 row uses a schedule's Run now.

**Guardrails and plan shape**
- **D-21: G-2** — sketch FIRST (badge placement, the row naming its org, mark-read). Variants: (A) dedicated rail control [recommended], (B) mark on the identity/avatar footer, (C) mark on the Workflows rail item; row anatomy and the empty state drawn in each. Winner self-picked under the autonomous mandate, recorded in STATE.md → Guardrail overrides; operator approval owed at G-4 (SC#4).
- **D-22: G-5** — `ChatLayout.tsx` (FIRING): one hunk (pass `openRun` into the producer context), honoured by construction. `NavPanel.tsx` (FIRING): one mount of the new control + the D-12 count filter, honoured by construction; new UI lives in new files (control + popover + vocabulary leaf). `attentionConditions.ts` reaches 3 phases → ledger row + `docs/HOT-FILE-LEDGER.md` section in the same commit as its first touch. `PendingAskCard.tsx`, `StreamsProvider.tsx`, the run page: not touched. `main.py`: one line. Planner runs `node scripts/check-hot-file-ledger.cjs`.
- **D-23: G-8** — 3 plans: (1) backend route + migration 219 + tests (anon, cross-user, left-org, chat-ask exclusion); (2) the data hook + second registry tenant + pin re-baselines + D-12 partition; (3) the rail control, popover, mobile row, vocabulary leaf. Targeted suites per task, full gates once per wave; backend unit baseline ceiling (71 failed) holds; vitest count gate per-file no-decrease.
- **D-24: G-4 scenarios, set now at scope time** (Claude drives in Chrome as the two-org dev account, proving the active org first):
  1. Start a workflow with a question step in the active org, move to Library: the badge shows 1 without a reload; the row names the org, the workflow, "needs your answer"; clicking opens the run.
  2. A run waiting in the OTHER org: its row names that org; clicking shows "This is in <org> — switch?"; Stay leaves the active org unchanged; Switch opens the run.
  3. Answer the question in a second tab: the first tab's badge drops without a reload. Then block the Realtime websocket, answer another, restore: on focus/reconnect the count is right.
  4. With a stopped source present, the Library badge and its tab mark show only the source; the waiting count is separate; the mobile hamburger dot lights.
  5. A Deep-chat `ask_user` produces no notice; a notice arriving while another thread streams leaves the stream intact (parallel-thread axis); a schedule's Run now that pauses appears too.
- **D-25: Four-axis UAT** (UI state): cross-provider = the run-pauses→notice-appears row across the full native roster + OpenRouter (derive the roster from `MODEL_CAPABILITIES`; blocked rows ⛔ with reason — Moonshot balance, OpenRouter 402 known); multi-tool = a workflow step using 2+ tools before its question; parallel-thread = D-24 row 5; long-message = the list with ≥ 10 waiting notices across two orgs. Rows authored in VALIDATION.md, not PLAN.md.

### Claude's Discretion
- Exact words of the empty state, kind words, the "and N more" line, the control's tooltip — words-first, no raw status values, in a vocabulary leaf.
- Icon for the control (from the existing icon set; distinct from the Library and Workflows icons).
- Poll interval within 30-120 s; minute-tick mechanics; db helper module names.
- Whether the route also exposes a count-only mode (not required).

### Deferred Ideas (OUT OF SCOPE)
- Mark-read / dismiss / snooze a notice (D-09) — a new capability; revisit only if a list grows noisy.
- Browser push / desktop notifications, sound.
- An owner-facing "your email failed" line in the list (300 deferred it here; not in NOTE-01/05 — left).
- Rail density IA reorganisation (BUG-260923-01 → SEED-166 / SEED-196).
- Hoisting attention readers into a context provider (attentionConditions.ts re-open trigger) — not fired: still one reader per tenant.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NOTE-01 | Owner sees waiting workflow runs (question/approval, incl. scheduled + API-key) in an in-app list + badge, across every org, each naming its org and linking to the run | §Q1 (218 writes rows for any owned non-golden live run; scheduled/key runs carry `origin_kind`), §Q2 route SQL, §Q4 rail mount, §Q5 LinkGate verified on push, §Q6 OrgAvatar |
| NOTE-05 | Answered / ended → leaves list and badge, also after a missed Realtime event | §Q1 close paths (answer, expiry, terminal status), F10 status predicate, §Q3 Realtime + reconcile mechanics, D-17 triggers |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Backend in `venv`; backend gate `pytest tests/unit -q --continue-on-collection-errors` ceiling **71 failed, zero headroom** — a new route that reds `test_276_openapi_snapshot_fresh` breaks it (F6).
- No LangChain/LangGraph; Pydantic for structured output (route response models).
- RLS on every table; Realtime is a HINT (D-v2.5-03) — reconcile by fetch on (re)connect.
- No blocking I/O in async handlers (`run_in_threadpool` for supabase-py). asyncpg is async and needs no threadpool (F5).
- Migrations: numbered `supabase/migrations/219_*.sql`, applied by SQL-editor paste, never `db push`/`db reset`; then `bash scripts/regenerate-full-schema.sh` (no `--reset`). Never hand-edit `full-schema.sql`. Cross-schema bits go in `scripts/full-schema-supplement.sql` (§Q3).
- Supabase MCP = production: reads free, every write per-action approval; run `get_advisors(security)` at deploy.
- Worktrees: bootstrap first; `GSD_VITEST_MAX_WORKERS=2`; serialize plans whose tests mutate the local DB (plan 1's live tests insert+rollback); never `rm -rf` a worktree.
- Frontend typecheck: `npx tsc -p tsconfig.app.json --noEmit` with a set diff vs base (tests ARE included — `tsconfig.app.json` `"include": ["src"]`).
- Vitest count gate: per-file no-decrease, 0 failing; new files pinned in BOTH knobs (`BASELINE` basename→count and `TARGETS` path) from the gate's printed `actual`.
- G-5 ledger gate: `node scripts/check-hot-file-ledger.cjs <phase>`; row + section same commit; disposition ≤ 200 chars (CLAUDE.md FIRING cell ≤ 80).
- G-8: 3-5 plans; targeted suites per task, full gates once per wave.
- UAT four-axis, full native roster + OpenRouter, rows in VALIDATION.md; per-request `model`+`provider` on `POST /threads/{id}/messages`.
- Presence assertions miss content drift — assert rendered words where words are the deliverable.
- Extension contract: no dynamic registration of engine code (registry is a frozen module constant — fine).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Write/close a notice | Database (218 triggers) | — | Already shipped; 301 adds nothing here |
| Who may read which notice | Database (RLS owner-only) + API (`$1` caller predicate + `org_members` join) | — | Two walls; pool read binds caller explicitly |
| List open notices across orgs | API (`GET /notifications`) | Database | One statement, server is truth |
| Freshness hint | Database (`supabase_realtime` publication, mig 219) → Browser (channel) | API refetch | Event only triggers a refetch, never patches state |
| Count / partition by mark | Browser (registry + leaf helper) | — | Pure derivation from the one read |
| Open the run, cross-org prompt | Browser (`openRun` → `LinkGate` → `/links/run/<id>`) | API (299 resolver) | Already shipped (299) |

## Standard Stack

No new packages. Everything is in the repo:

| Library | Version (installed) | Purpose |
|---------|---------|---------|
| `@supabase/supabase-js` / `realtime-js` | 2.99.2 / 2.99.2 [VERIFIED: node_modules package.json] | `postgres_changes` channel |
| `@radix-ui/react-dropdown-menu` (shadcn `dropdown-menu`) | 2.1.16 [VERIFIED: node_modules] | Popover primitive (D-05) |
| `lucide-react` `Hourglass` | installed | Control icon (unused elsewhere; matches the sketch's ⏳; distinct from `Workflow`/`FileText`) [VERIFIED: grep] |
| asyncpg via `app.dependencies.get_pg_pool` | in repo | Route read |
| `react-router` 8.5.0 via `useAppNavigation` only | in repo | `openRun` push |

## Package Legitimacy Audit

No external packages are installed by this phase. slopcheck not run (nothing to check). **Packages removed:** none. **Flagged:** none.

## Answers to the planner's questions (from code)

### Q1 — migration 218 facts
- Columns (`218_run_waiting_notifications.sql:58-68`): `id uuid PK`, `recipient_id uuid NOT NULL → auth.users ON DELETE CASCADE`, `org_id uuid NULL → organizations ON DELETE CASCADE`, `run_id uuid NOT NULL → workflow_runs ON DELETE CASCADE`, `kind text CHECK ('question','approval')`, `tool_call_id text NULL`, `created_at timestamptz DEFAULT now()`, `closed_at timestamptz NULL`, `closed_reason text CHECK (NULL|'answered'|'run_ended')`.
- Indexes: one open per (recipient, run) partial unique (`:77-78`); `(recipient_id, created_at DESC)` (`:81-82`) — serves the list query.
- RLS: `ENABLE` + `GRANT SELECT TO authenticated` + policy `recipient_id = (SELECT auth.uid())` (`:86-98`); anon has nothing (`:89`). No INSERT/UPDATE/DELETE policy.
- **Chat `ask_user` exclusion (D-19) holds; there is no stale-run-id path.** The write arm requires ALL of: `tool_calls->0->>'kind' = 'ask_user_prompt'`, `NEW.origin = 'harness'`, a UUID-shaped `run_id` (`:216-218`), a `workflow_runs` row with that id **AND `wr.thread_id = NEW.thread_id`** (`:223-227`), `user_id IS NOT NULL`, not golden, status `active|paused` (`:228-231`). A Deep chat ask is `origin='deep'` and names a `runs.id` — fails twice. A chat thread that also hosts a workflow run: a Deep ask there is still `origin='deep'` → nothing. **Already proven live** by `backend/tests/integration/test_300_notice_triggers_live.py:285-295` (`test_a_chat_ask_user_writes_no_notice`, both arms). 301 can cite/re-run it rather than re-author.
- Close paths: answer row with same `tool_call_id` in the run's thread (`:253-266`); engine expiry (`expired=true` → `run_ended`); terminal status trigger closes every open notice of the run (`:298-302`, `:330-334`). ⚠ Both functions are FAIL-SOFT (`EXCEPTION WHEN OTHERS → WARNING`, `:268-270`, `:322-324`) → a close can silently not happen (F10).
- `workflow_name`: `workflow_runs.definition_id → workflow_definitions.name` (`full-schema.sql:4631-4646`, `name text NOT NULL`; FK `ON DELETE RESTRICT` at `:8866`). Prefer `COALESCE(NULLIF(wr.definition_snapshot->>'name',''), NULLIF(d.name,''), 'Workflow run')` — the exact expression `link_resolver.RUN_SQL` uses (`backend/app/services/link_resolver.py:104-105`); the snapshot is the version that RAN (old rows are jsonb string scalars, `db/workflows.py:495-499`, so the `d.name` fallback is load-bearing).
- `org_name`: `organizations.name text NOT NULL` (`full-schema.sql:3847-3856`).
- `org_members(org_id, user_id, role)` is the membership table (`full-schema.sql:3832-3840`) — correct names.
- `workflow_runs.org_id` is `NOT NULL` (`full-schema.sql:4714`), so `notifications.org_id` is never null in practice despite the nullable column.
- `workflow_runs.origin_kind` ∈ `app|schedule|key|NULL` (`full-schema.sql:4728,4731`); set to `schedule` by `scheduler_service.py:261`, `key` by `api/inbound.py:409` (F7).

### Q2 — backend route
- **Best analog:** `backend/app/api/links.py` (router-level `_require_bearer` 401, `:40-52`) + `backend/app/services/link_resolver.py` `RUN_SQL` (pool, caller bound as a parameter, membership via `org_members` in the statement, `:102-114`). Secondary: `backend/app/api/org_items.py` `ELSEWHERE_SQL` (RLS connection, `org_members` join on `auth.uid()`, `:102-119`, `:209-211`).
- **Connection choice — recommend the POOL with the caller bound as `$1`** (F5). Reason measured: `workflow_runs_select_own` requires the run's THREAD owner = `auth.uid()` (`full-schema.sql:10636-10638`) and `workflow_definitions` SELECT is own-or-global only (`:9354`); on the RLS connection a notice whose run thread is owned differently would vanish silently. 299 hit the same wall and moved runs to the pool (`link_resolver.py:25-29`). ⚠ On the pool `auth.uid()` is NULL — every predicate must use `$1`.
- Pool acquisition: `pool = await get_pg_pool(); async with pool.acquire() as conn:` (`links.py:84-87`). Auth dependency: `current_user: dict = Depends(get_current_user)`; caller id `UUID(str(current_user["id"]))` (`links.py:72,83`).
- Router mount: `app.include_router(notifications.router)` beside `links.router` (`backend/app/main.py:967`) + the import token.
- Recommended SQL (one statement, `$1` caller, `$2` limit):
  ```sql
  SELECT n.id, n.run_id, n.org_id, o.name AS org_name, n.kind, n.created_at, wr.origin_kind,
         COALESCE(NULLIF(wr.definition_snapshot->>'name',''), NULLIF(d.name,''), 'Workflow run') AS workflow_name,
         count(*) OVER () AS total
    FROM public.notifications n
    JOIN public.org_members m   ON m.org_id = n.org_id AND m.user_id = $1
    JOIN public.organizations o ON o.id = n.org_id
    JOIN public.workflow_runs wr ON wr.id = n.run_id AND wr.status IN ('active','paused')
    LEFT JOIN public.workflow_definitions d ON d.id = wr.definition_id
   WHERE n.recipient_id = $1 AND n.closed_at IS NULL
   ORDER BY n.created_at ASC, n.id
   LIMIT $2
  ```
  (`count(*) OVER ()` is computed before LIMIT → true total; empty result → total 0.) Select no `tool_call_id`, no message text (NOTE-03 analog; `db/notifications.py:22-25` scans its SQL for this — copy that scan).
- Put the SQL in a module constant in a db helper (e.g. a new function in `backend/app/db/notifications.py`, which already exists — young row `1/1/326` in the ledger — or a new `backend/app/services/waiting_notices.py`) so the live test can run it on the seeded rolled-back connection.
- Tests to copy: unit route shape from `backend/tests/unit/test_299_links_route.py` (recording fake pool, 401 enumeration over every route on the router, source scan for forbidden imports); live from `backend/tests/integration/test_300_notice_triggers_live.py` (`_world()` seeds two users / two orgs, owner in both, `other` in org B only, rolls back, `:200-229`; helpers `_run`, `_prompt`, `_response`, `_member`). "Anon-role test" for a route = no bearer → 401 + `WWW-Authenticate: Bearer` (299/298 pattern); table-level anon is already proven by `test_300_rls_anon_live.py:68-84`.

### Q3 — Realtime
- **Not in the publication today.** Measured on local `:54322`: `pg_publication_tables` for `supabase_realtime` = `documents, folders, messages` [VERIFIED: live query]. `relreplident` for notifications = `d` (default).
- **`regenerate-full-schema.sh` does NOT carry publication membership** — it runs `pg_dump --schema-only --no-privileges --schema=public` (`scripts/regenerate-full-schema.sh:101-105`), and the supplement says so (`scripts/full-schema-supplement.sql:4-11`). Membership lives in supplement §4 (`:226-236`) as idempotent `DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.<t>; EXCEPTION WHEN duplicate_object THEN NULL; END $$;` and reappears in `full-schema.sql:10991-11001` only because the supplement is appended. → Migration 219 = that DO-block for `public.notifications`; **add the same line to supplement §4 and the header source list (`:27`) in the same commit**, then regenerate.
- Replica identity: NOT needed. Supabase docs: filters on `postgres_changes` need `replica identity full` only for DELETE events [CITED: supabase.com/docs/guides/realtime/postgres-changes]. The project comments claiming UPDATE filters need FULL (`useDocuments.ts:77-79`, `useFolders.ts:102-103`) are contradicted by the docs. D-16 "nothing else" holds.
- RLS: DELETE events are not RLS-checked [CITED: same page]; notifications are only deleted by cascades and the client ignores payloads anyway. INSERT/UPDATE delivery is gated by the subscriber's SELECT policy (218's owner-only policy + `authenticated` SELECT grant) — repo precedent relies on this (`useFolders.ts:102`) [MEDIUM: docs imply via the DELETE caution].
- Subscription pattern (precedent `frontend/src/hooks/useFolders.ts:95-152`): `supabase.auth.getSession()` → `supabase.channel(name).on("postgres_changes", {event, schema:"public", table, filter?}, cb).subscribe()` → cleanup `supabase.removeChannel(ref)`. Filter syntax `recipient_id=eq.<uid>` [CITED]. Neither precedent uses the status callback.
- Status callback (installed `realtime-js` 2.99.2, `dist/module/RealtimeChannel.js:23-26,139-188`): `subscribe((status, err) => …)` with `SUBSCRIBED | TIMED_OUT | CLOSED | CHANNEL_ERROR`; the `'ok'` hook is attached to the channel's single `joinPush`, which `_rejoin` re-sends after a socket drop → **SUBSCRIBED fires again on every rejoin** → "refetch on (re)subscribe" = refetch on each `SUBSCRIBED` [VERIFIED: source read; MEDIUM on runtime].

### Q4 — frontend shell pins (every one the change touches)

| File:line | What it asserts | What 301 must do |
|---|---|---|
| `NavPanel.badge.test.tsx:113-121` | `ATTENTION_PRODUCERS.length === 1`, `[0].key === "stopped-sources"` | Re-baseline to 2, assert keys `["stopped-sources","waiting-runs"]` (D-11); amend the file docblock rule 3 (`:23-27`) beside, not over |
| `NavPanel.badge.test.tsx:62-69` (`conditions()` fixture) + every case using it (`:125-267`) | Library badge/popover from mark-less conditions | Add `mark: "library"` if `mark` is required (F9); assertions unchanged |
| `attentionTab.test.ts:183-191` | `length === 1` + key | Re-baseline to 2 (D-11) |
| `attentionTab.test.ts:128,140,151,209` | `useStoppedSourceConditions(vi.fn())` — function arg | Change to the D-13 context object `{ openLibraryHealth: vi.fn(), openRun: vi.fn() }` |
| `attentionTab.test.ts:160-178` | tab-less "homeless" `AttentionCondition` still renders in `AttentionPopover` | Add `mark` (typed literal); it is itself the "SEED-231 waiting approval" placeholder — update its words/seed id |
| `attentionTab.test.ts:290-300` + `ChatLayout.badge.test.tsx:381-391` | `useSourceAttention(` inventory = exactly 3 files | Unchanged (new hook has a different name) — add a SIBLING inventory for the new hook (D-14) |
| `ChatLayout.badge.test.tsx:202-216` | `getSourceHealth` called exactly once while rail badge, hamburger dot, drawer badge render | Keep; the waiting fetch must not be `getSourceHealth`. Add `vi.mock("@/lib/api/notifications")` |
| `ChatLayout.badge.test.tsx:94-111` | supabase mock: `channel: vi.fn()` returns `undefined`, session user `user-1` | ⚠ A Realtime hook calling `.channel(...).on` throws inside a promise → unhandled rejection fails the suite (F11). Fix the mock (`channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }))`) AND guard the hook |
| `ChatLayout.badge.test.tsx:221-235, 237-245, 250-264` | drawer Library badge text `"2"` + `aria-label="Library"`; dot inside hamburger; silence when nothing stopped | With D-12 partition: drawer Library badge counts library only; a waiting-only world lights the dot but NOT the Library badge (new case) |
| `ChatLayout.badge.test.tsx:393-399`, `LibraryPage.tabAttention.test.tsx:476` | `ATTENTION_PRODUCERS.flatMap` appears exactly once in ChatLayout | Keep the one `flatMap` (D-13) |
| `LibraryPage.tabAttention.test.tsx:466-474` | literal `attentionConditions={attentionConditions}` in ChatLayout; regex `/<AppViewSwitch[^/]*attentionConditions=\{attentionConditions\}/` | Keep passing the FULL list as `attentionConditions` to AppViewSwitch (waiting conditions have no `tab` → `attentionCountByTab` ignores them, `attentionConditions.ts:214`). ⚠ No `/` (JSX comment, URL, `//`) in any prop inserted before `attentionConditions=` in the `<AppViewSwitch` mount (F15) |
| `LibraryPage.tabAttention.test.tsx:223-231, 412-415` | fixtures without `mark` | Add `mark: "library"` (typecheck) |
| `sourceComposition.test.tsx:551-564, 587` | `RAIL_ATTENTION` (no mark) to NavPanel | Add `mark: "library"`. (Suite is a standing red, not in a gate — keep it compiling) |
| `NavPanel.test.tsx` (`components/layout/NavPanel.test.tsx` + `__tests__/NavPanel.test.tsx`) | no rail-item count/order assertions found (only theme control count `:146`) | New control must not need supabase (keep it presentational) |
| Vitest pins | `NavPanel.badge 14`, `ChatLayout.badge 5`, `attentionTab 10`, `LibraryPage.tabAttention 15`, `NavPanel.test 20`, `ChatLayout.launch 38` (`scripts/vitest-count-gate.cjs:3876-3877,4032,4045,4213,1784`) | Counts may only grow |

- **Where the control mounts:** `NavPanel.tsx:280-289` is New chat; the nav items start at `:291`. There is **no Search rail item** (F1) — mount directly after the New chat `RailItem`, inside the same `flex-col gap-1` block (`:277`).
- **NavPanel on every view:** `ChatLayout` renders `<NavPanel>` unconditionally (`ChatLayout.tsx:622-635`), and every signed-in view goes through `ChatLayout` (`App.tsx:317`; only Boot/Setup/Lockout/Invite/Auth return before it, `App.tsx:230-261`). Desktop only (`NavPanel.tsx:244` `hidden md:flex`) — mobile is the drawer.
- **Mobile today:** drawer markup + its Library badge are in `ChatLayout.tsx:686-855` (badge `:778-803`). The hamburger dot exists ONLY in `ChatArea.tsx:923-929` (chat view; fed by `AppViewSwitch.tsx:289` `attentionCount={showAttention ? attentionCount : 0}`). The non-chat mobile bar `AppViewSwitch.tsx:325-333` has **no dot** (F3).
- `showAttention` is gated on `Boolean(onOpenLibraryHealth)` (`ChatLayout.tsx:613`, `NavPanel.tsx:168`) — the waiting mark must NOT inherit that gate.

### Q5 — opening a run
- `openRun(id)` → `go({ view: "workflow-run", runId: id })` → push `/app/runs/<id>` (`useAppNavigation.ts:68-69,410`; `navigate(target, {replace:false})` `:259`; no-op if already on screen `:251-252`). App passes it: `App.tsx:335`; ChatLayout prop is optional (`ChatLayout.tsx:132`).
- **LinkGate gates on PUSH, not only cold load — verified.** The gate is keyed on `entityLink.target` (`LinkGate.tsx:124-126`); a push changes the target → `askKey` changes → the ask effect runs `resolveLink("run", id)` (`:153-195`) → 200 with another org → `status: "prompt"` (`:302-320`) → `AppViewSwitch.tsx:360-363` renders `SwitchOrgPrompt`. Stay = address REPLACE, no org write (`:266-272`); Switch = `org.switchOrg` (`:273-286`). Resolver `RUN_SQL` lets the owner open at any status in a member org (`link_resolver.py:111-113`). Nothing missing. D-08 premise TRUE (F13).

### Q6 — OrgAvatar + active org
- `OrgAvatar({ initial: string; pending?: boolean })` at `frontend/src/components/org/OrgIdentity.tsx:71-94`; fixed `h-9 w-9` (36 px, `:67`), `aria-hidden`, no size/className prop. Usage pattern: `SwitchOrgPrompt.tsx:69-70` derives `initial = (orgName.trim().charAt(0) || "?").toUpperCase()`. ⚠ `OrgIdentity.tsx` has NO ledger scan row — editing it (e.g. a `size` prop) fails the gate until a row is added (F14).
- Active org: `useActiveOrgId()` (`hooks/useActiveOrgId.ts`) = `useOrgOptional()?.activeOrgId ?? null`; memberships `useOrgOptional()?.orgs` (`OrgProvider.tsx:45-47`); `switchOrg` `:178`. Refetch-on-switch = put `activeOrgId` (and a membership key, `LinkGate.tsx:138` pattern) in the hook's effect deps.

### Q7 — gates
- **Vitest count gate:** two knobs — `BASELINE` (basename → count, e.g. `"NavPanel.badge.test.tsx": 14`, `scripts/vitest-count-gate.cjs:122`, `:3876`) and `TARGETS` (path list, `:4869`, e.g. `:5986`). A new test file is added to BOTH, using the gate's printed `actual`; pins are never lowered. Basenames must be unique.
- **Hot-file ledger gate** (`node scripts/check-hot-file-ledger.cjs --files …`, run this session): rows EXIST for `attentionConditions.ts`, `AttentionPopover.tsx`, `NavPanel.tsx`, `ChatLayout.tsx`, `AppViewSwitch.tsx`, `main.py`, `ChatArea.tsx`, `build-public-openapi.cjs`, `vitest-count-gate.cjs`, `full-schema-supplement.sql`. **No row** for every NEW file (e.g. `backend/app/api/notifications.py`, `frontend/src/hooks/useWaitingNotices.ts`, `frontend/src/lib/api/notifications.ts`, the control/popover/vocabulary files) and for `OrgIdentity.tsx` → add young rows + sections in the creating commit.
- Re-derived triples (recipe, 6-digit buckets dropped): `attentionConditions.ts 4/2/226` (→ 3 phases with 301: at threshold), `AttentionPopover.tsx 1/1/109`, `AppViewSwitch.tsx 7/2/600` (→ 3 if touched, F3), `NavPanel.tsx 27/14/422`, `ChatLayout.tsx 73/36/934`, `ChatArea.tsx 96/45/1192` (do NOT touch — the dot is prop-fed), `main.py 98/72/1020`.

### Q8 — cheapest honest pause for G-4 / UAT
- **Question step:** phase type `llm_human_input` (`services/harness/phase_types.py:3126`). **Approval:** an `external_action` step with action-risk posture `ask` armed (`phase_types.py:2958`; engine writes `engine_pause.kind = action_risk` → 218 maps to `approval`, `218…sql:237`).
- **Ready-made on the local DB** [VERIFIED: live query]: `Doc Q&A` is **published + `is_system_global`** and contains `llm_human_input` → runnable from EITHER org, the run's `org_id` = the active org → this alone covers G-4 rows 1 and 2 without authoring. In `fhdmrd.dev`'s own org: `300 MT-1 multi-tool then ask` (multi-tool axis) and `300 G4-5 schedule rows` (schedule Run now, D-20).
- **Two-org account:** `fhdmrd.dev@gmail.com` is a member of `fhdmrd.dev@gmail.com's Organization` (org-admin, `c1f18150…`) and `fhdmrd@gmail.com's Organization` (member, `22f9c615…`) [VERIFIED]. ⚠ It already has **5 open paused question notices** in its own org from 300 UAT (F16) — record the starting count before row 1.
- **Per-request model on a workflow run:** yes for the run context — `resolve_run_model` takes `body.model`/`body.provider` and switches credentials via `override_provider` (`services/run_model_resolution.py:152-165,224`), and the kickoff sets `ctx.model = resolve_workflow_ctx_model(user_settings)` (`services/workflow_kickoff.py:401-407,546`); 296-02 records the provider in run metadata for resume. ⚠ Precedence is `phase.config.model` > `ctx.model` (`workflow_kickoff.py:405-406`) — a UAT workflow whose steps pin a model ignores the per-request one. Scheduled runs use the owner's settings (no request body) [MEDIUM].
- Realtime outage for D-24 row 3: emulate offline on tab A only (chrome-devtools per-page network emulation), answer in tab B, restore A → `SUBSCRIBED` refetch / focus refetch. (Docker is denied to the agent shell, so stopping the realtime container is not an option for Claude.)

## Findings that contradict or sharpen CONTEXT (F1–F18)

| # | Finding (evidence) | Recommended amendment |
|---|---|---|
| F1 | No "Search" on the rail — `NavPanel.tsx:276-329` has New chat then nav items | Mount under New chat (after `:289`); wording "under New chat" |
| F2 | D-22 "ChatLayout: one hunk" unreachable: D-03's drawer row and D-12's drawer Library badge live in `ChatLayout.tsx:686-855`/`:778-803`; `showAttention` (`:613`) feeds the dot | Expect ~4 small hunks: memoised ctx `{openLibraryHealth, openRun}` (`:603-606`), mark partition counts, one drawer-row mount (component in a new file), one any-mark dot count to AppViewSwitch. Still honoured by construction |
| F3 | D-03 premise "the hamburger already lights for any shell condition" is true only on the chat view; the non-chat mobile bar `AppViewSwitch.tsx:325-333` has no dot | Add the dot to that bar (pure markup — AppViewSwitch owns no hooks, D-28) and pass an any-mark count; `AppViewSwitch.tsx` goes 2→3 phases → ledger row/section update in that commit |
| F4 | D-08 "one tab stop per row" impossible in Radix menu: `react-menu/dist/index.mjs:305` `if (event.key === "Tab") event.preventDefault()`; roving focus covers `menuitem`s only | Rows = `DropdownMenuItem` (`role="menuitem"`, arrow keys + Enter/Space, `onSelect` closes the menu then `openRun`). Tests query `getAllByRole("menuitem")` |
| F5 | D-15 "reads through `run_in_threadpool`" names the supabase-py rule; the current analogs are asyncpg (async). RLS connection would hide notices whose run thread/definition the caller cannot SELECT (`full-schema.sql:10636`, `:9354`) | Pool + `$1` caller predicates (`link_resolver.py:25-29` precedent); no threadpool |
| F6 | A new route reds `backend/tests/unit/test_276_openapi_snapshot_fresh.py` (committed `docs/public/api/openapi.snapshot.json` must equal the app) — zero-headroom backend gate; and `frontend/src/docs/__tests__/publicOpenapi.test.ts:174-196` refuses an ungrouped tag | Same commit as the route: `backend/venv/Scripts/python scripts/export-openapi.py`; in `scripts/build-public-openapi.cjs` add tag `notifications` to "Account & org" (`:131`) and `/notifications` to `FLAGGED_EXACT` (`:81-87`, UI-internal like `/links/`); run `node scripts/build-public-openapi.cjs` (CI `--check`). FIRING file → ledger row update |
| F7 | Sketch row shows "· scheduled" (`index.html:142`); D-15 wire has no origin | Add `origin` (`workflow_runs.origin_kind`) to the wire; words "scheduled" / "started by an API key" in the vocabulary leaf. Or drop it from the sketch — decide before SC#4 |
| F8 | `AttentionCondition` has only `id,title,detail,onOpen,tab?` (`attentionConditions.ts:124-156`); a waiting row needs org, since, kind; and with D-10's 50-cap the badge must show the server TOTAL, not `conditions.length` | Discriminated union on required `mark`: library `{mark:"library"; tab?}` / waiting `{mark:"waiting"; orgId; orgName; since; kind; origin?; total}` (total identical on each waiting row; badge = `waiting[0]?.total ?? 0`, "and N more" = total − rows) |
| F9 | Test files are typechecked (`tsconfig.app.json` `"include": ["src"]`); mark-less fixtures exist in 4 suites (Q4 table) | Make `mark` required; update those fixtures in the same commit (set-diff typecheck stays clean); NavPanel filters `=== "library"` / `=== "waiting"` via one leaf helper (e.g. `conditionsForMark`) reused by ChatLayout |
| F10 | 218 triggers are fail-soft (a close can be swallowed as a WARNING); 300's drainer guards with `wr.status IN ('active','paused')` (`db/notifications.py:113`) | Same predicate in the list SQL — a run that ended can never be listed even if its close was swallowed (NOTE-05) |
| F11 | `ChatLayout.badge.test.tsx:108` mock `channel: vi.fn()` → `undefined` with a live session → `.on` throws in a promise | Hook wraps channel creation in `try/catch` (Realtime is a hint; a failed subscribe degrades to poll+focus) AND the mock is fixed; also don't chain after `.subscribe()` (several mocks return `undefined`, e.g. `ChatLayout.startChat.test.tsx:42`) |
| F12 | Docblocks say "this app has no router (SEED-185), navigation is always a callback" (`attentionConditions.ts:132-134`) and "NO URL, EVER" (`AttentionPopover.tsx:18-21`) — stale since 297 | Amend beside the original (struck-through convention). The waiting component still writes no URL — it calls `openRun` |
| F13 | LinkGate push-gating verified (Q5) | D-08 stands |
| F14 | `OrgAvatar` is fixed 36 px; `OrgIdentity.tsx` has no ledger row | Reuse as-is (popover `w-80`), or add an optional size prop WITH a new ledger row |
| F15 | Regex pin `LibraryPage.tabAttention.test.tsx:473` uses `[^/]*` up to `attentionConditions=` in the `<AppViewSwitch` mount | Add new props after it, slash-free |
| F16 | 5 open paused notices already exist for `fhdmrd.dev` (local) | G-4 row 1 asserts "+1", not "shows 1" |
| F17 | Route is org-agnostic; what can change the answer is the membership SET, not the active org | Refetch on `activeOrgId` (D-17) AND on a membership key (`LinkGate.tsx:138`) |
| F18 | `notifications.org_id` nullable (`218:61`) but always set (run org NOT NULL) | Inner joins are fine; note in the SQL comment |

## Architecture Patterns

### System Architecture Diagram

```
engine pause (harness ask_user_prompt row) ──► messages INSERT ──► trigger notify_on_ask_row ──► notifications (open)
answer row / expiry row / run terminal status ──► triggers ──► notifications.closed_at set
                                                                 │
                         mig 219: supabase_realtime publication ◄┘ (WAL)
                                                                 │ INSERT/UPDATE, RLS: recipient only
Browser ─ ChatLayout (ONE registry read) ─┬─ producer "stopped-sources" ─► useSourceAttention (poll)
                                          └─ producer "waiting-runs" ──► useWaitingNotices
                                                 │  triggers: mount · Realtime event · SUBSCRIBED · focus/visible · org/membership change · 60 s poll
                                                 └─► GET /notifications ─► pool SQL ($1 caller; org_members; run active|paused) ─► {notices[≤50], total}
   conditions[] (mark library|waiting) ─┬─► NavPanel: Library badge+popover (library only) │ WaitingOnYouControl (waiting only)
                                        ├─► drawer: Library badge (library) + "Waiting on you (N)" row
                                        ├─► hamburger dots (any mark) — ChatArea (prop) + AppViewSwitch non-chat bar
                                        └─► LibraryPage tab marks (attentionCountByTab — tab-less waiting rows ignored)
row click ─► DropdownMenuItem onSelect ─► openRun(id) ─► push /app/runs/<id> ─► LinkGate ─► /links/run/<id> ─► open | SwitchOrgPrompt
```

### Recommended file layout (new files in **bold**)
```
supabase/migrations/219_notifications_realtime.sql        # DO-block ADD TABLE + VERIFY select
scripts/full-schema-supplement.sql                         # §4 + header source list
backend/app/api/notifications.py                           # router, _require_bearer, GET /notifications
backend/app/db/notifications.py  (or services/waiting_notices.py)  # LIST_OPEN_SQL constant + fetch fn
frontend/src/lib/api/notifications.ts                      # getWaitingNotices(signal) — NOT added to the api.ts barrel
frontend/src/hooks/useWaitingNotices.ts                    # fetch-truth + Realtime hint
frontend/src/components/layout/attentionConditions.ts      # union type, ctx signature, 2nd tenant, conditionsForMark leaf
frontend/src/components/layout/WaitingOnYouControl.tsx     # rail control + popover (DropdownMenu)
frontend/src/components/layout/waitingVocabulary.ts        # words-first strings (strict leaf)
```
(Keep `@/lib/api/notifications` out of the `@/lib/api` barrel: `api.ts` is 215/128 commits/phases, and whole-module barrel mocks are allow-lists — `ChatLayout.badge.test.tsx:47-48`.)

### Pattern: the hook (mirror `useSourceAttention` + `useFolders`)
```ts
// Source: frontend/src/hooks/useSourceAttention.ts:79-131 + useFolders.ts:95-152 (shapes), realtime-js 2.99.2 subscribe(status)
const refresh = useCallback(() => { inFlight.current?.abort(); const c = new AbortController(); inFlight.current = c
  getWaitingNotices(c.signal).then(v => { if (!c.signal.aborted) { setVerdict(v); setLoading(false) } })
                             .catch(() => { if (!c.signal.aborted) setLoading(false) }) /* keep last verdict */ }, [])
useEffect(() => { refresh(); return () => inFlight.current?.abort() }, [refresh, activeOrgId, membershipKey])
useEffect(() => { const id = setInterval(refresh, 60_000); return () => clearInterval(id) }, [refresh])
useEffect(() => { const on = () => { if (document.visibilityState === "visible") refresh() }
  window.addEventListener("focus", on); document.addEventListener("visibilitychange", on)
  return () => { window.removeEventListener("focus", on); document.removeEventListener("visibilitychange", on) } }, [refresh])
useEffect(() => { let cancelled = false; let ch: ReturnType<typeof supabase.channel> | null = null
  supabase.auth.getSession().then(({ data }) => { const uid = data.session?.user.id; if (cancelled || !uid) return
    try { ch = supabase.channel(`waiting-notices:${uid}`)
      ch.on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${uid}` }, () => refresh())
      ch.subscribe((status) => { if (status === "SUBSCRIBED") refresh() })
    } catch { ch = null /* Realtime is a hint; poll + focus still reconcile */ } })
  return () => { cancelled = true; if (ch) supabase.removeChannel(ch) } }, [refresh])
```
Return `{ notices, total, loading, verdictKnown }`; the producer maps to waiting conditions with `useMemo`.

### Pattern: the control (mirror `ProfileMenu.tsx:103-113`)
Collapsed: `Tooltip > TooltipTrigger asChild > DropdownMenuTrigger asChild > <button aria-label={sentence}>` ; expanded: `DropdownMenuTrigger asChild > button` with visible "Waiting on you". Count `<span aria-hidden>` (amber `bg-warning text-warning-foreground`, the `rail-badge` anchor classes `NavPanel.tsx:191-202`). Content: `DropdownMenuLabel` header, rows as `DropdownMenuItem onSelect={() => c.onOpen()}`, empty state text, "and N more" plain text. Testids `rail-waiting-trigger`, `rail-waiting-badge`, `rail-waiting-popover`, `rail-waiting-item` (screen prefix `rail`, composition convention).

### Anti-Patterns to Avoid
- Patching the list from the Realtime payload (D-17) — always refetch.
- A minute tick in the hook/ChatLayout (re-renders the FIRING shell every 60 s) — tick inside the popover rows only while open (`Math.max(0, …)` against clock skew).
- An un-memoised ctx object passed to `producer.use` — breaks every producer `useMemo` (use `useMemo(() => ({ openLibraryHealth, openRun }), …)`).
- `auth.uid()` in pool SQL (NULL on the pool).
- Gating the waiting mark on `onOpenLibraryHealth`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-org "switch?" on open | a switch call in the row | `openRun` → 299 `LinkGate` | Already gates on push; D-08 |
| Popover/menu | custom floating panel | shadcn `DropdownMenu` (Radix 2.1.16) | Focus, Esc, outside-click, roving focus |
| Writing/closing notices | client or route writes | 218 triggers | Single writer, already tested live |
| Realtime reconnect logic | own websocket retry | realtime-js rejoin + `SUBSCRIBED` callback + poll | Library already rejoins |
| Relative org initial | new avatar | `OrgAvatar` | 298/299 identity |

## Runtime State Inventory

Not a rename/refactor phase — omitted. (Cloud state to carry at deploy: migration 219 paste with per-action approval, then `get_advisors(security)`.)

## Common Pitfalls

1. **OpenAPI snapshot red** (F6) — warning sign: `test_276` fails in the backend gate after adding the router.
2. **Tab swallowed in the menu** (F4) — rows built as `<button>` look fine with a mouse and fail keyboard UAT.
3. **Badge shows 50 when 60 wait** (F8) — count from `total`, not `length`.
4. **Library badge counts waiting rows** — the D-12 failure; test: waiting-only world → no `rail-badge`, no `drawer-attention-badge`, dot lit.
5. **Unhandled rejection from the channel in mocked suites** (F11).
6. **Dead run stuck in the list** after a swallowed close (F10).
7. **Notice hidden by RLS on the run's thread** if the route uses the user connection (F5).
8. **Regex pin broken by a comment** in the `<AppViewSwitch` mount (F15).
9. **`regenerate-full-schema.sh` needs `docker exec`** — denied in the agent shell this session; the executor may need the operator to run it (or permission) after the SQL-editor paste.

## State of the Art

| Old (project belief) | Current | Impact |
|---|---|---|
| "UPDATE filters need REPLICA IDENTITY FULL" (`useDocuments.ts:77-79`) | Only DELETE filtering needs FULL [CITED] | Mig 219 can stay one statement |
| "No router, navigation is a callback" (`attentionConditions.ts:132-134`) | 297/299 routes; `openRun` pushes an address | Docblock amendment |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Realtime applies the subscriber's SELECT policy to INSERT/UPDATE events for `postgres_changes` | Q3 | Cross-user event delivery would only cause a harmless refetch (route still filters by `$1`) — no data leak via the list; payload carries no text |
| A2 | `SUBSCRIBED` re-fires after a socket rejoin (read from source, not driven) | Q3 | Reconcile still happens via focus + 60 s poll |
| A3 | Scheduled runs resolve the model from owner settings, not a per-request body | Q8 | Only affects the schedule UAT row's provider label |

## Open Questions

1. **"· scheduled" on the row (F7)** — wire it (recommended, one column) or remove from the sketch? Decide in planning; SC#4 compares against the sketch.
2. **Approval row in G-4** — no ready-made published approval workflow was located on the local DB this session (only question steps were searched). Recommendation: author one tiny `external_action` (send_email, posture ask) workflow in the dev org during UAT prep, or drive the approval case at the DB/unit level and keep the Chrome rows to questions.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Postgres `:54322` | live tests, mig 219 apply | ✓ (queried) | — | — |
| Python venv | backend tests, OpenAPI export | ✓ | 3.12.6 | — |
| Node | vitest, gates | ✓ | 24.19.0 | — |
| Docker CLI (agent shell) | `regenerate-full-schema.sh` (`docker exec pg_dump`) | ✗ (permission denied) | — | Operator runs the script, or grant permission |
| Supabase Realtime (local) | G-4 rows 1/3 | assumed up with the stack | — | Poll + focus still pass NOTE-05 |

## Validation Architecture

(nyquist is off in config; included on request.)

### Test Framework
| Property | Value |
|----------|-------|
| Backend | pytest (venv); unit + `tests/integration` live (skip-guarded on :54322 + mig 218) |
| Frontend | vitest (jsdom), RTL, user-event |
| Quick run | `cd backend && venv/Scripts/python -m pytest tests/unit/test_301_*.py -q` · `cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/layout src/hooks/__tests__/useWaitingNotices.test.tsx` |
| Full suite | `node scripts/check-backend-unit-baseline.cjs` · `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` · `npx tsc -p tsconfig.app.json --noEmit` (set diff) |

### Phase Requirements → Test Map
| Req | Behavior | Type | Command / file | Exists? |
|-----|----------|------|----------------|---------|
| NOTE-01 | route: 401 no bearer on every router route; one statement; `$1` bound; no `tool_call_id`/text selected; limit 50 + total | unit | `tests/unit/test_301_notifications_route.py` | ❌ new |
| NOTE-01 | live: owner sees notices from BOTH orgs, oldest first, names org + workflow; `other` sees none of owner's; left-org (delete membership) → not listed; ended run not listed | integration | `tests/integration/test_301_notifications_live.py` (reuse `_world`) | ❌ new |
| NOTE-01 | chat ask_user → no row (D-19) | integration | `test_300_notice_triggers_live.py::test_a_chat_ask_user_writes_no_notice` | ✅ re-run |
| NOTE-01 | mig 219: notifications in publication; supplement carries it | integration/shape | `tests/unit/test_301_migration_219_shape.py` (+ live `pg_publication_tables`) | ❌ new |
| NOTE-01 | OpenAPI snapshot fresh + tag grouped | unit | `test_276_openapi_snapshot_fresh.py`, `publicOpenapi.test.ts` | ✅ must stay green |
| NOTE-01 | registry = 2 tenants, keys asserted; ctx signature; one `flatMap`; one `useWaitingNotices(` call site (inventory) | unit | `NavPanel.badge.test.tsx`, `attentionTab.test.ts`, `ChatLayout.badge.test.tsx` | ✅ edit |
| NOTE-01 | control: always present; count only > 0 (total); aria name sentence; rows menuitem with org name + kind words + waited; empty words; "and N more"; select → openRun(id), never switchOrg | component | `WaitingOnYouControl.test.tsx` | ❌ new |
| NOTE-01 | D-12: waiting-only → no Library badge/drawer badge, dot lit (chat + non-chat bars), drawer row "Waiting on you (N)"; Library tab marks unchanged | component | `ChatLayout.badge.test.tsx` (+ cases), `LibraryPage.tabAttention.test.tsx` | ✅ edit |
| NOTE-05 | hook: refetch on mount / Realtime event / SUBSCRIBED / focus / org change / poll; payload never used; failed fetch keeps last list (`verdictKnown`); channel throw tolerated; cleanup removes channel | unit | `useWaitingNotices.test.tsx` (fake timers, mocked supabase + api) | ❌ new |
| NOTE-05 | parallel-thread: a notice refetch does not resubscribe streams | integration (FE) | extend `src/__tests__/routing/navigationKeepsStreams.test.tsx` pattern | ❌ new case |
| SC#4 / G-4 | five D-24 scenarios in Chrome | manual | VALIDATION.md | — |

### Sampling Rate
- Per task: targeted suites above. Per wave: backend baseline script + vitest count gate + tsc set diff. Phase gate: all green before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_301_notifications_route.py`, `backend/tests/integration/test_301_notifications_live.py`, `backend/tests/unit/test_301_migration_219_shape.py`
- [ ] `frontend/src/hooks/__tests__/useWaitingNotices.test.tsx`, `frontend/src/components/layout/__tests__/WaitingOnYouControl.test.tsx`
- [ ] Pins for each new vitest file in `BASELINE` + `TARGETS`

## Security Domain

| ASVS | Applies | Control |
|------|---------|---------|
| V2 Authentication | yes | `get_current_user` + router `_require_bearer` (401 + `WWW-Authenticate`) |
| V3 Session | no (Supabase JWT, unchanged) | — |
| V4 Access Control | yes | `n.recipient_id = $1` + `org_members` join on `$1` in the statement; RLS owner-only on the table for Realtime/direct reads |
| V5 Input Validation | minimal | no params (or a bounded `limit` ≤ 50 via `Query(le=50)`) |
| V6 Cryptography | no | — |

| Threat | STRIDE | Mitigation |
|---|---|---|
| Anonymous read of notices | Info disclosure | 401 before I/O; anon has no table grant (`218:89`; live-proven `test_300_rls_anon_live.py`) |
| User B lists user A's notices | Info disclosure | `$1` = caller from the verified JWT, never a param; live test with `_world().other` |
| Left an org, still sees its runs | Info disclosure | inner `org_members` join (live test deletes the membership row) |
| Realtime leaks another user's events | Info disclosure | owner-only SELECT policy applies to Realtime; client filter is UX only; payload ignored, list refetched under `$1` |
| Question text leaks into the shell | Info disclosure (NOTE-03 analog) | SQL selects no `tool_call_id`/messages; source scan test like `db/notifications.py:22-25` |
| Silent org switch on click | Tampering/UX | row calls `openRun` only; test asserts `switchOrg` never called |
| Stranded stale notice (dead run) | Repudiation-ish | `wr.status IN ('active','paused')` (F10) |
| Cloud drift (219 not applied) | — | deploy parity: paste 219 with approval, `get_advisors(security)` |

## Sources

### Primary (HIGH)
- Repo code at the cited file:line (migration 218, full-schema.sql, link_resolver.py, links.py, org_items.py, db/notifications.py, attentionConditions.ts, NavPanel.tsx, ChatLayout.tsx, AppViewSwitch.tsx, ChatArea.tsx, LinkGate.tsx, useAppNavigation.ts, OrgIdentity.tsx, the listed tests, vitest-count-gate.cjs, check-hot-file-ledger.cjs, build-public-openapi.cjs, regenerate-full-schema.sh, full-schema-supplement.sql)
- Installed packages: `@radix-ui/react-menu@2.1.16` `dist/index.mjs:305`; `@supabase/realtime-js@2.99.2` `dist/module/RealtimeChannel.js:23-26,125-188`
- Live local DB queries (publication membership, replica identity, open notices, published `llm_human_input` workflows, dev-account memberships)

### Secondary (MEDIUM)
- https://supabase.com/docs/guides/realtime/postgres-changes — filter syntax; replica identity only for DELETE filtering; DELETE not RLS-checked

## Metadata

**Confidence breakdown:** Standard stack HIGH (installed, no new deps) · Architecture HIGH (every seam measured) · Pitfalls HIGH (each tied to a line or a live query); Realtime runtime MEDIUM.
**Research date:** 2026-10-29 · **Valid until:** 2026-11-12 (hot files move daily — re-derive ledger triples at plan time)
