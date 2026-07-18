# Phase 146: Operator Foundation - Context

**Gathered:** 2026-07-10
**Status:** Ready for planning

<domain>
## Phase Boundary

A designated operator can reach a gated `/admin` Control Room that no ordinary user can even discover, and every operator action is recorded — with the operator-role schema deliberately shaped so the v3.4 multi-tenancy RLS rewrite is not poisoned.

Delivers (ADMIN-01): `operator_users` table + `require_operator` FastAPI dependency (default-deny, router-level, 404 not 403) + `operator_audit_log` + the `/admin` Control Room frontend shell (sketch 061-B) + the always-on ledger receipt (sketch 062-A) + the existing `/admin/backpressure` endpoint re-gated behind `require_operator` + `org_id` stub sweep + 404 regression tests.

Does NOT deliver: kill-switches/maintenance mode (147), active-runs view + Kill (147), audit browser filters/CSV + user management + impersonation (148), model registry (149), secrets encryption (150). Locked tabs for those sections render day-one with honest "coming soon" copy — phase numbers never appear in shipped copy.

</domain>

<decisions>
## Implementation Decisions

### Operator bootstrap & the old gate
- **D-01:** First operator is seeded via an **`OPERATOR_EMAILS` env var, idempotently upserted into `operator_users` on backend startup** (matching auth users resolved by email). Works identically local (backend/.env) + cloud (Coolify env). The DB table is the runtime source of truth; env is bootstrap-only — removing an email from the var does NOT un-operator anyone (removal is Phase 148 user-management territory). Must be idempotent and safe under multi-worker startup (`WORKER_COUNT=2` — concurrent upsert, ON CONFLICT-safe).
- **D-02:** **Clean replace of `BACKPRESSURE_ADMIN_USER_IDS` — no dev fail-open.** Delete the env var and the `_check_backpressure_auth` fail-open logic; `/admin/backpressure` sits behind `require_operator` like every `/admin` route. Non-operators get 404 even in dev; local behaves exactly like prod. Deployment parity note: cloud needs `OPERATOR_EMAILS` set in Coolify + the old var removed at the same promotion.

### Audit guarantee
- **D-03:** **Auto-log floor + rich labels.** The `require_operator` gate itself writes an `operator_audit_log` row for EVERY gated `/admin` request — the "every operator action is recorded" guarantee holds by construction when Phases 147–150 add endpoints. Write-endpoints can enrich the row with the plain-sentence label the sketch vocabulary requires ("Turned ON maintenance mode"); views get auto-derived plain labels ("Viewed system health"). Receipts are plain sentences, never action codes (062-A rule).
- **D-04:** **Manual refresh only day-one — no auto-polling.** Health data loads on Control Room entry + the visible ↻ Refresh button (which visibly prepends its own "Viewed system health" ledger row — the honesty beat). Every ledger row is a deliberate human action. Auto-poll (and the audit-floor exemption design it forces) is deferred to Phase 147's active-runs view.

### Schema shape (one-way door)
- **D-05:** **`org_id` stub sweep = new tables + core user-data tables.** `operator_audit_log` ships with `org_id` (nullable, no FK, no index, no backfill — the `harness_audit` mig-059 precedent), PLUS one migration adds the same stub to the core user-data tables v3.4 will org-scope (documents, folders, threads, skills, workflows, workflow_runs… **exact list finalized at planning from the live schema**). Metadata-only ALTERs, zero behavior change.
- **D-06:** `operator_users` is a **system-level, org-agnostic principal** — deliberately NOT a JWT custom claim, NOT an `is_admin` boolean, NOT a "special org" (locked by REQUIREMENTS ADMIN-01 + research Pitfall 2; the v3.4 one-way door).

### UI shape (sketch-locked — do not re-litigate)
- **D-07:** The shell is **sketch 061-B**: operator-only amber shield entry at the bottom of the 52px app rail (probe-gated — a non-operator's nav is byte-identical to today); full-width amber-warmed operator band (shield + "Control Room" + OPERATOR chip + identity + "every action recorded" marker + ‹ Back to app) over horizontal section tabs — NOT a second left nav rail. Day-one = full map, honest locks: Overview + Audit tabs live; System Controls / Users & Access / AI Models / API Keys render locked with calm "Not built yet — coming soon" refusals. Landing = System health (the four real `/admin/backpressure` signals under plain labels: Server capacity · Agents working · Database connections · Work spread) + recent-operator-actions feed. ALL copy plain-first with an "⌥ Technical names" toggle revealing raw field/action/endpoint names (the LANG-01 two-audience pattern, born plain at 146).
- **D-08:** The receipt is **sketch 062-A**: the action lands at the top of the always-visible "Recent operator actions" card (row slides in; the band's recording marker flashes) — no toasts, no counters; the ledger IS the receipt. Write actions carry a leading ✎ mark; full history lives in the Audit tab (count-pill). Consequence ≠ receipt: a write that stays in effect gets its own persistent banner (147+ inherits this vocabulary).

### G-4 lived-experience UAT scenarios (defined at scope-time, verified live at phase verification)
- **D-09:** Three scenarios, all driven live (Chrome MCP or operator-clicks):
  1. **The invisible door** — fresh normal user: app byte-identical to today (no shield, no admin hints); any `/admin` API hit directly returns a plain 404 indistinguishable from a nonexistent route. Failure = any visible trace, a 403, or a branded/differently-shaped error.
  2. **The control room feels like a zone** — seeded operator: shield appears; band shows shield + "Control Room" + OPERATOR chip + identity + recording marker; 4 plain-labeled health signals; locked tabs say "coming soon" with NO phase numbers; ⌥ toggle reveals raw names. Failure = missing zone identity, jargon-first copy, or phase numbers leaking into shipped copy.
  3. **The ledger is the receipt** — ↻ Refresh slides "Viewed system health" into Recent operator actions + marker flash; the row persists across a page reload (it lives in `operator_audit_log`, not client state). Failure = no row, a toast instead, code-y labels, or the row vanishing on reload.

### Claude's Discretion
- The operator-probe endpoint shape (e.g., `GET /admin/me` that 404s for non-operators; frontend treats 404 as "render nothing")
- `operator_audit_log` column schema + event/action vocabulary (follow the `harness_audit` precedent: jsonb metadata; text + CHECK vs free-text action field)
- The exact core-table list for the D-05 org_id sweep (derive from live schema at planning)
- How 404 indistinguishability is achieved (match FastAPI's default `{"detail": "Not Found"}` shape/headers exactly)
- The new `ActiveView` entry name for the Control Room + component file layout
- RLS posture on the two new tables (backend is service-role so RLS never gates it; enable RLS + deny-all/no policies for anon/authenticated per the "all tables need RLS" project rule)
- Migration numbering/split (next free number is 095) + full-schema regeneration per project rules

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone research (ground truths that supersede the stale v3.2 brief)
- `.planning/research/SUMMARY.md` — no-RLS-backstop on `/admin` (service-role only), the one-way-door operator schema (Pitfall 2), single router-level `require_operator` dependency (Pitfall 1), UI-only gating forbidden (Pitfall 13), Phase-1 delivery list

### Approved design (G-2 sketch gate — satisfied 2026-07-10)
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — Running Design Decisions **51** (061-B operator band + tabs, plain-language-first) and **52** (062-A always-on ledger receipt)
- `.planning/sketches/061-control-room-shell/` — approved control-room shell mockup (index.html + README)
- `.planning/sketches/062-gate-honesty-and-receipts/` — approved ledger-receipt mockup (index.html + README)

### Code + schema precedents
- `backend/app/api/admin.py` — the existing `/admin` router + `/admin/backpressure` endpoint + the `_check_backpressure_auth` env-var gate being replaced (D-02)
- `supabase/migrations/059_harness_audit_and_threads_col.sql` — the audit-table precedent (`harness_audit`): jsonb metadata, text + CHECK event types, nullable no-FK `org_id` (the D-05 pattern)
- `.planning/REQUIREMENTS.md` — ADMIN-01 (the single requirement this phase must satisfy)

### Deployment parity (D-02 has a non-code half)
- `docs/DEPLOYMENT-WORKFLOW.md` — cloud parity checklist: `OPERATOR_EMAILS` into Coolify, `BACKPRESSURE_ADMIN_USER_IDS` removed, migrations pasted into cloud Supabase SQL editor

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/api/admin.py` — existing `APIRouter(prefix="/admin")`; Phase 146 upgrades its gate rather than creating a new router
- `backend/app/dependencies.py:103 get_current_user` — Supabase JWT validation returning `{id, email}`; `require_operator` composes on top of it
- `harness_audit` (mig 059) — schema pattern for `operator_audit_log`
- `frontend/src/lib/nav-items.ts` + `frontend/src/App.tsx` `ActiveView` — the single shared nav source; the shield entry is probe-gated and deliberately NOT added to `NAV_ITEMS` (non-operator nav must stay byte-identical)
- Aether Deep Midnight theme components — the Control Room stays in-theme, marked as a zone by the amber band (061-B)

### Established Patterns
- **No URL router** — navigation is a `useState<ActiveView>` switch (sketch 023-A precedent); the Control Room is a new `ActiveView`, not a browser route. "Non-discoverable" is enforced at the API (404) + probe-gated rendering, not by route hiding
- **`run_in_threadpool` for supabase-py calls** (D-v2.5-01) — the audit-floor write inside the gate dependency must not block async handlers
- **Multi-worker uvicorn** (`WORKER_COUNT=2`, D-PRD-12) — startup seeding (D-01) runs per worker; must be concurrent-safe/idempotent
- **Migrations**: numbered SQL under `supabase/migrations/` (next: 095), applied via Supabase SQL editor (never db push/reset), then `bash scripts/regenerate-full-schema.sh`
- **Settings vs env**: `OPERATOR_EMAILS` is legitimately an env var (bootstrap/infra, not a runtime setting)

### Integration Points
- Router-level dependency on `admin.py` (`APIRouter(dependencies=[Depends(require_operator)])`) — the single place the gate applies
- `backend/.env.example` — add `OPERATOR_EMAILS`, remove `BACKPRESSURE_ADMIN_USER_IDS`
- Frontend rail (NavPanel / ChatLayout) — the probe-gated shield entry at rail bottom
- `main.py`/startup lifecycle — the idempotent operator seed

</code_context>

<specifics>
## Specific Ideas

- The four backpressure signals render under plain labels with one-line subtexts: **Server capacity · Agents working · Database connections · Work spread** (raw names `anyio_threadpool_depth` etc. behind the ⌥ toggle) — sketch 061-B copy
- ↻ Refresh must *visibly* prepend "Viewed system health" to the feed — the operator watching their own view get recorded is the day-one honesty beat
- Locked tabs name what's coming ("System Controls", "Users & Access", "AI Models", "API Keys") but never phase numbers
- 404 body/shape for non-operators must be indistinguishable from FastAPI's genuine unknown-route 404

</specifics>

<deferred>
## Deferred Ideas

- **Auto-poll for Control Room health + the audit-floor exemption design it forces** — Phase 147 (active-runs view needs live data; design the poll/audit seam there)
- **Operator add/remove management UI** — Phase 148 (user management); until then, membership changes are env-seed additions or manual SQL
- **"Sign in as user" impersonation** — Phase 148 STRETCH/named-trigger per REQUIREMENTS ADMIN-03
- **Audit browser search/filters/CSV export** — Phase 148; the 146 Audit tab is the honest minimal history view

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` — matched only on generic keywords ("first, schema"); belongs to the workflow-inputs cluster, resurfaces at Phase 151/152 discuss-phase

</deferred>

---

*Phase: 146-operator-foundation*
*Context gathered: 2026-07-10*
