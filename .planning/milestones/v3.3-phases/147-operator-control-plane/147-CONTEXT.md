# Phase 147: Operator Control Plane - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

An operator watches live system health (Redis / Supabase / sandbox dependency probes + the four backpressure signals) and active runs inside the Phase-146 `/admin` shell, kills a runaway run via the existing `cancel_run` zombie-heal path, toggles four fail-closed per-feature kill-switches (web search / code sandbox / self-improvement / workflows), and puts the platform into maintenance/read-only mode — all on the existing `app_settings` TTL-cached substrate with NO new flag infrastructure.

Delivers (ADMIN-02 + FLAG-01): dependency-health probes additive on the `/admin/backpressure` JSON (D-078-08 additive-only), the 063-B pinned-vitals Control Plane tab (promoted from 146's Overview per D-147-IA), the 064-B active-runs cards + confirm-sheet Kill (new operator-side kill path — `cancel_run` is owner-scoped), the 065-A capability card grid + separated maintenance panel, the maintenance write-block middleware + end-user banner, the poll/audit-floor exemption seam deferred from 146 D-04, and the two folded cancelled-run display bugs (BUG-260710-01/-02).

Does NOT deliver: audit browser filters/CSV + user management + impersonation (148), model registry (149), secrets encryption (150), eval/tuner run cancellation (future, if ever), workflow pause/resume semantics.

SC#10 applies: the active-runs list + Kill touch run/stream state — cross-provider × multi-tool × parallel-thread × long-message UAT rows required in VALIDATION.md.

</domain>

<decisions>
## Implementation Decisions

### Active runs & Kill (sketch 064-B locked; these fill its open behavior)
- **D-01 Run-list scope:** EVERY `runs:active` entry renders with a kind badge — Chat / Workflow / Eval / Tuner (full monitoring honesty; the set is fed by chats, workflow runs, eval matrix runs, and skill-tuner jobs). Kill is wired day-one for **chat + workflow runs only**; eval/tuner jobs show as bounded internal jobs with honest "ends on its own" copy, no Kill affordance.
- **D-02 Operator kill path:** `cancel_run` (`backend/app/api/runs.py:1097`) is ownership-scoped (`eq user_id` → 404 on others' runs), so Kill needs a new admin-side endpoint that reuses the SAME cancel/zombie-heal internals (sentinel ordering, idempotent-terminal 204, D-062-13 Redis best-effort discipline) minus the ownership filter — refactor-to-share, never copy-paste. Audit label names the victim per 064-B ("Ended maria's run on GPT-5…", write `run.kill`).
- **D-03 Victim experience:** the killed user sees **exactly a self-cancel** — the "Stopped" indicator, no operator attribution in their chat. Who/why lives ONLY in `operator_audit_log`. Zero new shared-path render surface (G-5-safe); the folded BUG-260710 fixes make that display honest.

### Kill-switches & maintenance (sketch 065-A locked; these fill its behavior)
- **D-04 Capability OFF = two-layer, fail-closed:** new runs don't advertise the disabled tool at all (removed from the tool schema so models never try) AND any in-flight call gets a plain refusal ToolResult ("Code execution is currently disabled by the administrator") the agent can relay and work around. Enforced at the single `dispatch_tool` seam. Matches the sketch's "N runs using code will error on their next call" impact copy.
- **D-05 Workflows switch = block new launches only:** Run buttons refuse with plain copy; in-flight workflow runs finish normally. Shape rule: switches stop NEW work; the Kill button is the tool for in-flight work.
- **D-06 Maintenance/read-only = middleware write-block + banner:** a middleware-level gate rejects mutating requests (POST/PUT/PATCH/DELETE) with a plain "maintenance mode — read-only" error. Allowlist: auth/login, ALL `/admin` routes (the off-switch must stay reachable), and users cancelling their own runs. In-flight runs finish. End users get a persistent app-wide banner and can browse/read everything. Arm-to-confirm + persistent 062-A consequence banner on the operator side (065-A).

### Live data vs the audit ledger (resolves 146 D-04's deferred seam)
- **D-07 Poll + visit-row exemption:** the Control Plane auto-polls read-only data while open (~10s default; pause when the tab is hidden). Automated reads are floor-EXEMPT; instead the ledger records ONE deliberate row per visit ("Opened the Control Plane") plus the existing manual ↻ row. Writes are floor-logged always, no exceptions. The honesty rule survives: every ledger row is a human action, and the pinned vitals can actually go amber/red while scrolled (the 063-B load-bearing degrade state). Elapsed tickers are client-side math from `started_at` — no poll needed for ticking.

### IA (ratifies sketch 066's open decision)
- **D-08 D-147-IA RATIFIED — Promote:** the 146 "Overview" tab becomes the live "Control Plane" landing tab (063-B composition: pinned vitals → Health detail → Active runs → Controls → Activity). Health lives in exactly ONE place; band tabs read Control Plane · Users&Access(🔒148) · Model Registry(🔒149) · Secrets(🔒150) · Audit log. This is how sketch 066 is drawn.

### Claude's Discretion
- The new operator-kill endpoint shape/name (e.g., `POST /admin/runs/{run_id}/kill`) and how the cancel internals are factored for reuse
- Long-running (>8 min per sketch) and "not responding" (stalled-stream) threshold mechanics for the 064-B card tags
- Workflow-run Kill delegation (whole-run cancel via the existing workflow-run cancel machinery)
- Flag key names for the net-new switches (self-improve / workflows / maintenance) alongside existing `web_search_enabled` + `sandbox_enabled`; flag-read failure semantics (fail-closed on genuinely unknown state without turning a transient DB blip into a platform outage — last-known-good TTL cache is the substrate)
- Dependency-probe implementation (Redis PING, trivial Supabase select, sandbox/Docker reachability + latency; healthy/slow/down thresholds; "off by config" vs "down" for a disabled sandbox)
- The impact-copy data source for switch cards ("2 runs using code…" — derive from runs:active + run metadata)
- Exact poll cadence/backoff, hidden-tab pause mechanics, and which GET endpoints are floor-exempt
- Where the maintenance middleware sits in the FastAPI stack and its exact allowlist expression
- Audit action vocabulary for the new writes (`run.kill`, `flag.*`, `maintenance.set` per sketch 066's linkage rows)

### Folded Todos
None from the todo matcher (see Reviewed Todos). Two reported bugs folded instead:
- **BUG-260710-01** (`.planning/reported-bugs/cancelled-run-stop-indicator-lost-on-navigation.md`) — "Stopped" indicator on a cancelled message disappears after navigation. Folded because operator Kill produces exactly this state; the 064-B honest two-state contract must hold on the victim's side too.
- **BUG-260710-02** (`.planning/reported-bugs/cancelled-run-empty-bubble-early-cancel.md`) — cancelling before the first visible token leaves an empty assistant bubble. Same cancel-display path; D-03 (victim sees self-cancel) depends on that display being honest.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Approved design (G-2 sketch gate — satisfied 2026-07-11; the UI is LOCKED, do not re-litigate)
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — Running Design Decisions **53** (063-B pinned-health composition), **54** (064-B confirm-sheet Kill that names the victim), **55** (065-A card grid + separated maintenance), **56** (066 navigation/linkage contract: band-tab IA, 15 button→destination rows, 7 consistency guards, graded action-guards)
- `.planning/sketches/063-control-plane-composition-and-health/` — winner B (pinned vitals + sectioned scroll)
- `.planning/sketches/064-active-runs-and-kill/` — winner B (run cards + confirm sheet; honest Cancelling…→Cancelled·recorded; long-running/not-responding tags; calm empty state)
- `.planning/sketches/065-system-controls-and-maintenance/` — winner A (2×2 capability grid, red armed OFF state + concrete impact copy; amber-framed separate Platform state panel; direct-flip switches vs arm-to-confirm maintenance)
- `.planning/sketches/066-control-plane-assembled-and-linkage/` — the assembled surface + the whole-product linkage contract (READ the README: every button's destination is specified there)

### Prior phase & milestone ground truth
- `.planning/phases/146-operator-foundation/146-CONTEXT.md` — carried-forward decisions: D-03 audit floor, D-04 (manual-refresh posture this phase now supersedes via D-07), D-07/D-08 shell + receipt vocabulary, Claude-discretion notes on the probe endpoint
- `.planning/research/SUMMARY.md` — fail-closed kill-switches on the `app_settings` substrate (NOT a flag SaaS), no-RLS-backstop red line, admin-console competitor shapes
- `.planning/REQUIREMENTS.md` — ADMIN-02 + FLAG-01 (the two requirements this phase must satisfy)
- `.planning/ROADMAP.md` §Phase 147 — the four success criteria

### Folded bug reports
- `.planning/reported-bugs/cancelled-run-stop-indicator-lost-on-navigation.md` — BUG-260710-01
- `.planning/reported-bugs/cancelled-run-empty-bubble-early-cancel.md` — BUG-260710-02

### Code + schema precedents
- `backend/app/api/admin.py` — the 146 router (`require_operator` router-level + `operator_audit_floor` per-endpoint; `/backpressure` already ZCARDs `runs:active`); 147 extends THIS router
- `backend/app/api/runs.py` (~line 1071-1265) — `cancel_run` + the D-062-* cancel/zombie-heal discipline the operator Kill must reuse (sentinel-before-cancel ordering, idempotent-terminal, Redis best-effort)
- `backend/app/main.py:103` — the `app_settings` TTL-cached keys list (`web_search_enabled`, `sandbox_enabled` already live)
- `backend/app/services/tool_dispatcher.py` — the single `dispatch_tool` seam for D-04's refuse layer (Phase 091 whitelist precedent: gate is a literal no-op when unset)
- `docs/DEPLOYMENT-WORKFLOW.md` — cloud parity for any new `app_settings` rows (paste into cloud SQL editor at promotion)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/api/admin.py` (137 lines post-146): `require_operator` router gate + `operator_audit_floor` dependency + `/backpressure`, `/me`, `/audit` — the new health/runs/kill/flag endpoints join this router
- `cancel_run` internals (`runs.py`): ownership SELECT → idempotent-terminal check → RUN_TASKS happy path (PUBLISH-first ask_user wake) → zombie heal (D-062-11) — factor into a shared helper; operator path skips only the ownership filter
- `runs:active` sorted set (score = start time) + the `runs` table rows — the active-runs data source; elapsed = now − score; enrichment (thread/user/model) joins the `runs` row
- Frontend 146 components (`frontend/src/components/admin/`): OperatorBand, HealthSignals, LockedTab, TechnicalNamesToggle, RecentActionsCard, AuditTab, ControlRoomPage — 147 recomposes ControlRoomPage per 063-B and promotes Overview
- `@lobehub/icons` provider marks (048 map) for the cross-provider run cards (RDD 43: single-source, never sketch-placeholder art)

### Established Patterns
- **`operator_audit_floor` as a per-endpoint dependency** — D-07's exemption = simply not attaching the floor to the poll GETs while attaching it to every write (the `/admin/me` no-floor precedent already exists)
- **`app_settings` TTL cache (~30s)** — flag flips propagate within the TTL window without restart; the sketch's "on their next call" copy already accounts for this latency
- **Whitelist-gate no-op pattern** (Phase 091): capability checks at `dispatch_tool` must be literal no-ops when flags are absent/on — Deep Mode byte-identical when nothing is disabled
- **`run_in_threadpool` for supabase-py calls** (D-v2.5-01) inside any new middleware/dependency
- **Multi-worker uvicorn (WORKER_COUNT=2)** — flag reads are per-worker cached; maintenance middleware must behave identically per worker
- **Migrations**: numbered SQL under `supabase/migrations/` (next free number from live tree at planning), applied via Supabase SQL editor, then `bash scripts/regenerate-full-schema.sh`

### Integration Points
- `/admin/backpressure` JSON — dependency health is ADDITIVE fields on this payload (D-078-08 additive-only)
- `dispatch_tool` (tool refuse layer) + tool-schema assembly (hide layer) — the two D-04 enforcement points
- Workflow-run launch path — the D-05 refusal point for the workflows switch
- FastAPI middleware stack in `main.py` — the D-06 maintenance gate
- Frontend app shell — the persistent maintenance banner for end users (outside the admin surface)

</code_context>

<specifics>
## Specific Ideas

- The confirm sheet names the victim in plain words: "End maria's run on GPT-5, 2m 14s in — cancels immediately, recorded with your name" (064-B verbatim vocabulary)
- OFF cards look ARMED, not neutral: red tint + "off for everyone" tag + concrete impact ("2 runs using code will error on their next call") — a kill-switch is not a preference (065-A)
- A stuck run killed via zombie-heal reads "recovered a stuck run", never "killed" (064-B honesty)
- "Opened the Control Plane" is the visit's single ledger row — polls are silent, the ↻ still visibly prepends its row (the 146 honesty beat, adapted)
- Locked tabs keep naming what's coming without phase numbers (146 D-07 rule)
- Plain-language-first everywhere + ⌥ Technical names toggle (LANG-01 pattern, born plain)

</specifics>

<deferred>
## Deferred Ideas

- **Eval/tuner run cancellation** (killable internal jobs) — only if a real need surfaces; they're bounded jobs with their own timeout/claim lifecycles
- **Workflow pause/resume at phase boundaries** — rejected as the workflows-switch semantics; would be its own harness-engine capability
- **Operator-typed kill reason threaded to the victim** — rejected D-03 variant; revisit only if attribution becomes a governance requirement (v3.4 multi-tenancy territory)
- **Sub-tabbed Control Plane** (sketch 063-C) — the documented scale-up if the runs table + audit browser outgrow the single scroll

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` — matched on generic keywords only ("run"); belongs to the workflow-inputs cluster, resurfaces at Phase 151/152 discuss-phase (same disposition as 146)

</deferred>

---

*Phase: 147-operator-control-plane*
*Context gathered: 2026-07-11*
