# Phase 148: Governance — Audit, Users & Feature Visibility - Context

**Gathered:** 2026-07-11
**Status:** Ready for planning

<domain>
## Phase Boundary

An operator can investigate what happened (browse BOTH ledgers — `operator_audit_log` + platform `audit_log` — with action-type/date-range chip filters, pagination, and a recorded CSV export of exactly the filtered set), govern who gets in (users roster with last-active honesty, disable/enable via GoTrue `banned_until` + an app-layer check, grant/revoke operator), and control who sees advanced features (an audience map living on Users & Access, API-enforced via a `require_visible` dependency on each feature router) — all inside the locked Phase-146 shell with 062-A receipts.

Delivers (ADMIN-03 + VIS-01): the 067-A audit browser (source switch across both ledgers; net-new operator read path over platform `audit_log`; `audit.view_platform` makes cross-user reads visible; CSV names its count and is itself recorded), the 068-A users roster (instrument table; victim-naming Disable / direct Enable; lockout-proof self-rows; amber-sheet operator grant + revoke), and the 069-A feature-visibility audience rows (Everyone | ⛨ Operators only; extensible-audience never-boolean contract; day-one map = Skill Studio · model management · workflow authoring & publishing · governance health).

Does NOT deliver: impersonation / "sign in as user" (deferred with a named trigger — see Deferred), the 069-B live end-user preview, model registry (149), secrets encryption (150), doc-level ACL mirroring (v3.4+ / SEED-115).

Threat model applies (ROADMAP SC#4): every cross-user read path in the admin browser runs on the service-role client with NO RLS backstop — reads must be explicitly filtered and paginated; no full-tenant leak.

</domain>

<decisions>
## Implementation Decisions

### Operator grant/revoke (ratifies sketch 068-A's flagged scope)
- **D-01 Ship grant + revoke in 148, from the roster.** Closes the 146 deferral (operator add/remove UI); env-seed (`OPERATOR_EMAILS`) remains bootstrap-only per 146 D-01 — the roster becomes the runtime management path. Migration 095's `granted_by` column gets populated. Guards per the locked sketch + 066 graded-guard rule: grant = AMBER sheet naming the blast radius ("they can see every user's activity, kill anyone's runs…"); revoke is target-specific-with-a-victim → also a sheet; revoke keeps the person's normal account; their past operator actions stay in the trail forever; self-revoke/self-disable blocked with tooltip (lockout-proof).

### Impersonation
- **D-02 Deferred — fails the ROADMAP's "only if scoped cheaply" bar.** No clean GoTrue "sign in as" API; honest dual-identity audit would thread operator identity through shared paths (red-line risk). Goes to STRETCH backlog with the named re-open trigger: **the first real support case an operator cannot resolve from the audit browser + active-runs + roster views alone.** 069-B's read-only "view as user" preview stays a documented enhancement, not day-one.

### Feature-visibility refusal shape (resolves 069-A's open 403-vs-404 decision)
- **D-03 `require_visible` returns 403 with a plain-language body** ("This feature is available to administrators only."). NOT 404: non-discoverability is the `/admin` threat model, not this one — these are governed product features end users may have legitimately seen before a flip; a 404 would read as breakage and mask real bugs. `/admin` keeps its byte-identical 404.
- **D-04 Frontend learns the map via an authenticated effective-features fetch** piggybacking the existing app-bootstrap/settings load; hidden features simply don't render in nav/pages (the sketch's "no longer see X" vanish — never badge-locked). Mid-session flip = graceful bounce: the surface's next data fetch returns 403 → show the plain refusal, route home. Propagation within the ~30s `app_settings` TTL window (the 147 kill-switch "on their next call" precedent). No push/instant eviction.

### Rollout defaults & failure polarity
- **D-05 Mixed day-one audience defaults:** Skill Studio (ONE flag covering eval studio + trigger tuner, per 057-A) and model management → **Operators only** at deploy — ROADMAP SC#3 is TRUE verbatim without a manual flip. Workflow authoring & publishing and governance health → **Everyone** (shipped v2.9/v3.0 end-user capabilities keep working; VIS-01 never named them; operator can tighten). **Run stays for everyone regardless** (locked by the sketch map).
- **D-06 Cold-read polarity = per-feature hardcoded default** (the 147 D-Q4 pattern): last-known-good TTL cache absorbs blips; a genuine cold-read failure (fresh worker, DB unreachable) resolves each feature to its D-05 day-one default — deny for Skill Studio/model management, allow for workflow authoring/governance health. A DB blip never yanks core end-user capabilities; tightened features never fail open.

### Claude's Discretion
- Audience-record storage shape on the `app_settings` TTL substrate (enum-shaped record per the extensible-audience contract — NEVER a boolean; the single swappable audience-resolver function inside `require_visible`)
- `require_visible` wiring per feature router (evals.py / skill_tuner.py / skill_test_cases.py cluster under the ONE Skill Studio flag; settings.py model-management sections; workflows.py authoring/publish endpoints with the Run carve-out; governance-health endpoints)
- The effective-features endpoint shape + how it folds into the existing bootstrap fetch; the graceful-bounce UX detail
- Disable enforcement mechanics: GoTrue `banned_until` duration value, where the app-layer check lives, in-flight-run cancellation on disable (sketch copy promises it — reuse the 147 kill internals), JWT-expiry latency handling
- Platform `audit_log` browse API shape (filters → parameterized queries, page size, CSV streaming/size cap; explicit user-scoping parameters — no unfiltered tenant dump)
- Audit action vocabulary for the new writes (`user.disable`, `user.enable`, `operator.grant`, `operator.revoke`, `visibility.set`, `audit.export`, `audit.view_platform` — follow 146 D-03 plain-sentence labels)
- Plain-first grouping of the 19 platform `action_type` codes (Documents / Chat & agent / Organizing / Other per 067-A) with raw codes behind ⌥
- Migration numbering (next free from live tree at planning) + full-schema regen + cloud-parity notes for new `app_settings` rows

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Approved design (G-2 sketch gate — satisfied 2026-07-11; the UI is LOCKED, do not re-litigate)
- `.claude/skills/sketch-findings-agentic-rag/references/governance-audit-users-visibility.md` — **the Phase 148 build contract** (067-A/068-A/069-A design decisions, CSS patterns, HTML structures, what-to-avoid)
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — Running Design Decisions **57** (067-A one audit browser, both ledgers), **58** (068-A instrument-table roster + graded guards), **59** (069-A audience rows + the extensible-audience never-boolean contract)
- `.planning/sketches/067-audit-browser/` — winner A (chip filters + paged table; source switch; recorded CSV)
- `.planning/sketches/068-users-and-access/` — winner A (instrument roster; victim-naming disable; flagged operator grant)
- `.planning/sketches/069-feature-visibility/` — winner A (audience rows; B live-preview = enhancement; C in-Controls foil = REJECTED placement)

### Prior phase & milestone ground truth
- `.planning/phases/146-operator-foundation/146-CONTEXT.md` — D-01 env-seed bootstrap (roster now supersedes for management), D-03 audit floor, D-07/D-08 shell + receipt vocabulary
- `.planning/phases/147-operator-control-plane/147-CONTEXT.md` — D-07 poll/floor-exemption seam, kill internals (`run_lifecycle._cancel_run_internals`) reusable for disable's in-flight cancellation, `app_settings` TTL substrate + D-Q4 polarity precedent
- `.planning/research/SUMMARY.md` — service-role/no-RLS-backstop red line, admin-console competitor shapes, Glean greenlist model
- `.planning/REQUIREMENTS.md` — ADMIN-03 + VIS-01 (the two requirements this phase must satisfy)
- `.planning/ROADMAP.md` §Phase 148 — the four success criteria
- `.planning/seeds/SEED-115-*` — extensible-audience → v3.4 roles/departments (this phase must not break its forward-compat contract)

### Code + schema precedents
- `backend/app/api/admin.py` (549 lines post-147) — the operator router; 148's browse/users/visibility endpoints join it (`require_operator` router-level + `operator_audit_floor` per-write)
- `supabase/migrations/030_missing_tables.sql` + `071_dm_foundations.sql` — the platform `audit_log` table + its 19-action CHECK vocabulary (the browse target)
- `supabase/migrations/095_operator_foundation.sql` — `operator_users` (`granted_by` anticipated grant), `operator_audit_log`
- `supabase/migrations/097_operator_flags.sql` — the `app_settings` flag precedent the audience records extend
- `backend/app/main.py:104-110` — the TTL-cached `app_settings` keys list (audience keys join it)
- `backend/app/api/` feature routers for `require_visible`: `evals.py`, `skill_tuner.py`, `skill_test_cases.py` (Skill Studio flag), `settings.py` (model-management sections), `workflows.py` (authoring/publish; Run carve-out), governance-health routes (`knowledge_health.py` / `document_governance.py` — confirm exact router at planning)
- `docs/DEPLOYMENT-WORKFLOW.md` — cloud parity for new `app_settings` rows / migrations at promotion

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/api/admin.py` — `require_operator` gate + `operator_audit_floor` + the 146 `/admin/audit` endpoint (the operator-ledger half of the source switch already has a read path; platform `audit_log` browse is net-new)
- `run_lifecycle._cancel_run_internals` (extracted in 147) — disable's "in-flight run cancelled" promise reuses this, never re-implements
- Frontend admin components (`frontend/src/components/admin/`): OperatorBand, ControlRoomPage, AuditTab, RecentActionsCard, TechnicalNamesToggle, LockedTab — 148 unlocks Users & Access and upgrades AuditTab with the source switch + chip filters
- 029-A chip-strip filter grammar (Documents-page filter builder heritage) — the audit filter strip reuses this visual grammar per 067-A
- `app_settings` TTL cache + last-known-good (147) — audience records ride the same substrate, no new flag infra

### Established Patterns
- **No RLS backstop on service-role reads** — every admin read explicitly filtered/paginated (the standing 146/148 threat model)
- **`operator_audit_floor` per-endpoint** — reads that cross user boundaries get deliberate ledger rows (`audit.view_platform`); poll-style GETs stay floor-exempt per 147 D-07
- **`run_in_threadpool` for supabase-py calls** (D-v2.5-01) in all new admin endpoints
- **Multi-worker uvicorn (WORKER_COUNT=2)** — per-worker TTL caches; audience flips propagate within the window, identically per worker
- **Whitelist-gate no-op pattern** (091/147): `require_visible` must be a literal no-op for operators and for Everyone-audience features — Deep Mode and non-governed surfaces byte-identical
- **Plain-first + ⌥ Technical names** (146 D-07) — action labels, route prefixes, raw `action_type` codes all behind the toggle
- **Migrations**: numbered SQL under `supabase/migrations/`, applied via Supabase SQL editor, then `bash scripts/regenerate-full-schema.sh`

### Integration Points
- `AuditTab` — gains the source switch (operator | platform), chip filters, pager, CSV button
- Users & Access locked tab — unlocks with the roster + (below it) the feature-visibility cards
- GoTrue admin API (`auth.admin`) — `banned_until` for disable; app-layer check for the JWT-window gap
- Feature routers listed above — one `require_visible` dependency each, audience resolved by the single swappable function
- App bootstrap/settings fetch — carries the effective-features map for nav rendering

</code_context>

<specifics>
## Specific Ideas

- The disable sheet speaks the 064-B victim-naming vocabulary: names the user, states the effect ("loses access immediately — sign-in refused, API refused, in-flight run cancelled"), states what is KEPT ("their documents, chats and settings are kept, untouched"), states reversibility, says it's recorded
- Enable is restorative → flips direct (deliberate asymmetry); every write flips the row to a `✎ … · recorded` receipt + band-marker flash (062-A)
- CSV export always names its row count, exports exactly the filtered set, and lands in the ledger itself (`audit.export` with the filter summary in the label)
- Switching to Platform activity shows the quiet in-surface note: "looking at user activity is itself recorded"
- Last-active is honest: `last_sign_in_at` (recent=green, stale=dim, `never signed in` italic) — never fabricated
- Flipping a feature to Operators-only reveals the concrete consequence line ("End users no longer see X — and their API calls to it are refused server-side, not just hidden") + expandable "what exactly this controls"
- Audience control styling: operators-only = amber-warmed, NEVER kill-switch red — visibility ≠ kill-switch, and they never sit next to each other (the rejected 069-C foil)
- The disabled user's own experience: "This account is disabled — contact your administrator"

</specifics>

<deferred>
## Deferred Ideas

- **Impersonation ("Sign in as user")** — STRETCH; named re-open trigger: **first real support case an operator cannot resolve from the audit browser + active-runs + roster views alone** (D-02)
- **069-B live end-user preview** (mini-app + 200→404 API probe "view as user") — documented enhancement on the visibility surface
- **067-B day-grouped feed headers** — possible later graft onto 067-A's table (documented alternative)
- **Audience picker beyond two positions** (groups/departments) — v3.4 org-RBAC territory; 148 only preserves the extensible contract (SEED-115)
- **Sub-tabbed Control Plane** (063-C) — still the documented scale-up if the audit browser outgrows the tab

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` — matched on generic keywords only ("date, trigger"); belongs to the workflow-inputs cluster, resurfaces at Phase 151/152 discuss-phase (same disposition as 146/147)

</deferred>

---

*Phase: 148-governance-audit-users-feature-visibility*
*Context gathered: 2026-07-11*
