# Phase 283: Every Member Reaches Their Own Settings - Research

**Researched:** 2026-10-15 (HEAD `fa6372376`, branch `develop`)
**Domain:** permission-boundary UI reach (FastAPI per-route gate + React tab gating) and a bounded list in a scroll container
**Confidence:** HIGH (every load-bearing claim below was measured in this session: code read, prototype test run, gate run, local DB read)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Measured at discuss (scout, HEAD `78551612b`). These facts drive the decisions.

- The Settings rail entry is gated by `feature: "model_management"` at `frontend/src/lib/nav-items.ts`
  (last entry of `NAV_ITEMS`). `visibleNavItems` drops it for every member. **This is the only reason a
  member cannot reach the page.** `ChatLayout.tsx:938` renders `<SettingsPage />` for `activeView ===
  "settings"` with no further gate.
- `SettingsPage.tsx` **already gates per tab**: `canManageModels = features.model_management === true`
  hides tabs `"0"` (AI Model), `"1"` (Search & Retrieval), `"2"` (Integrations); `"3"` Memory and `"4"`
  Audit Log are unconditional; `"5"` is RETIRED (old Connections pin). It skips `getSettings()` for a
  member, and redirects a persisted invisible/retired tab to `"3"`.
- ⚠ **"Show technical names" and `<ModelDefaultPreference />` both sit INSIDE tab `"0"` (AI Model)**, which a
  member never sees. The Phase 154 comment claims "every user can reach it (SC#3)" — false since Phase 148
  gated the tab. So un-gating the rail alone would give a member Memory + Audit Log but **not** the toggle.
- Member-facing data paths are already ungated and owner-scoped:
  - "Show technical names" → `TechnicalNamesProvider` (`localStorage`, per device; persists across reload).
  - `ModelDefaultPreference` → `GET/PUT /me/preferences` (`backend/app/api/me_preferences.py`, no
    `require_visible`, RLS-scoped write through `get_user_pg_connection`, 400 outside the enabled set).
  - Memory → `MemorySection` reads/writes through the Supabase client under RLS.
  - Audit Log → `GET /audit-logs`, `GET /audit-logs/export` (`backend/app/api/audit.py`), owner-scoped by
    `.eq("user_id")`, no feature gate.
- Operator-only API routes in `backend/app/api/settings.py`: `GET /settings`, `PUT /settings`, and the two
  re-embed routes (~:1004, ~:1033) all carry `require_visible("model_management")`. `GET
  /settings/providers` is the **documented Run carve-out** (chat model picker) and stays ungated.
  `require_visible` (`dependencies.py:651`) is a no-op for operators, 403 `"This feature is available to
  administrators only."` otherwise.
- The header **Reset** button calls `handleReset`, which does nothing when `s` is null — i.e. it is a dead
  control for a member.
- Chunks: `DocumentChunksSection.tsx` renders `rows.map` into an unbounded `<ul>`; each chunk body is
  already `max-h-32 overflow-auto`. The count is **already shown** in the section header
  (`DocumentDetailPanel.tsx:432`, `<PanelSection title="Chunks" count={chunkTotal}>`).
- ⚠ `GET /documents/{id}/chunks` (`documents.py:1059`) has no `.range()`, so PostgREST's 1,000-row cap
  silently truncates a document with more than 1,000 chunks, and the header count reads 1,000. That is
  `BUG-261014-07`'s class and belongs to Phase 284 (see Deferred).

#### FIX-01: where the member's settings live

- **D-01: The door is the EXISTING Settings rail entry, un-gated.** Remove `feature: "model_management"` from
  the `settings` entry in `NAV_ITEMS`. No new door, no profile-menu item, no new rail slot for operators
  (they already see it). The entry joins `connections` / `skills` / `experts` as "ungoverned by design: the
  API is the wall". Rewrite the stale comments in `nav-items.ts` that justify the tag (the Connections
  note and the Phase 148 note) so they state the new truth.
- **D-02: A new member-visible "Preferences" tab holds "Show technical names" and `<ModelDefaultPreference />`,
  MOVED verbatim out of tab `"0"`.** One home per concern: these are personal preferences, not model
  management. The operator's AI Model tab loses those two blocks and keeps everything else.
- **D-03: Preferences gets tab id `"6"`.** Never reuse retired `"5"` (a persisted `"5"` must still redirect).
- **D-04: Strip order.** Operator: AI Model · Search & Retrieval · Integrations · **Preferences** · Memory ·
  Audit Log (operator default landing stays `"0"`, so "an operator's view unchanged" holds apart from the two
  moved blocks). Member: **Preferences** · Memory · Audit Log, landing on Preferences.
- **D-05: The fallback tab is DERIVED, not hardcoded.** A persisted tab the caller cannot see (governed,
  retired, unknown) lands on the caller's first visible tab from the registry (member → `"6"`, operator →
  `"0"`). Replaces today's hardcoded `"3"`.
- **D-06: Reset renders only for a caller who can manage models** (it only resets operator-tab form state).
  No dead control for a member.
- **D-07: The member's page makes ZERO calls to a `model_management`-gated endpoint**, on mount or on any
  tab click. Today's `getSettings` skip stays; the re-embed progress poll must also be operator-only. A
  request known to be refused is audit-log noise.
- **D-08: Copy.** The page subtitle "Changes take effect immediately." stays. No "ask your administrator"
  placeholder for hidden tabs — Phase 148's VANISH rule (no locked/badged placeholder) holds.

#### FIX-01: the API is the authority (security_enforcement)

- **D-09: No backend gate moves.** `model_management` stays Operators-only in `backend/app/api/features.py`;
  `settings.py`'s four gated routes keep `require_visible("model_management")`. The fix is UI reach, and
  the API already refuses correctly. `dependencies.py` is **not** modified (G-5 FIRES on it; the
  `app/security/access.py` seam is not taken here because nothing in this phase needs to edit that file).
- **D-10: Two-role fence on the real auth path (backend, pytest).** Identity is injected (two users: an
  operator and an ordinary org member), but **`require_visible` / `feature_visible` / `is_operator` run
  unmocked**, so the fence proves the real decision. Asserts:
  - member: `GET /settings` → 403, `PUT /settings` → 403, both re-embed routes → 403;
  - member: `PUT /me/preferences` (valid model) → 200 and `GET` reads it back; `GET /audit-logs` → 200;
  - member: `GET /settings/providers` → 200 (the carve-out still works);
  - operator: `GET /settings` → 200.
  Must be **driven RED** against a planted regression (e.g. delete one route's `require_visible`) before it
  counts. If the unit harness cannot run the real `is_operator` without a DB, the researcher finds the
  closest seam that still exercises the real decision function; a test that overrides `require_visible`
  itself does not satisfy D-10.
- **D-11: Route-inventory fence.** Introspect `settings.py`'s router: every route except an explicit
  carve-out allow-list (`GET /settings/providers`) carries the `model_management` gate. A new settings
  route added without the gate fails the test. Driven RED by planting an ungated route.
- **D-12: Frontend fences.** (a) `nav-items` test pins the Settings entry ungoverned and visible under an
  empty feature map; (b) `SettingsPage` rendered as a member shows exactly Preferences · Memory · Audit Log,
  lands on Preferences, and clicking every visible tab calls no gated API function; (c) rendered as an
  operator shows all six tabs, lands on `"0"`; (d) the moved toggle and default-model picker render under
  Preferences, not under AI Model. Assert rendered **content** (tab names, the toggle label), not test ids
  only — presence assertions cannot see content drift.
- **D-13: Live two-role check (G-4, done by the orchestrator, not an executor).** With real JWTs from the
  local Supabase, `curl` the gated routes as member (403) and operator (200), and save a preference as
  member that survives reload. Record in `283-LIVE-EVIDENCE.md`.

#### SettingsPage G-5: the tab seam, behaviour-preserving, FIRST

- **D-14: Wave 1 takes the tab-REGISTRATION seam, before any gate moves.** A small registry module (e.g.
  `frontend/src/components/settings/settingsTabs.ts`) declares each tab once: id, label (or label key),
  audience (`"everyone"` | `"model_management"`), and a pure `visibleSettingsTabs(canManageModels)` +
  fallback-tab function. `SettingsPage` maps the strip from it. `AuditLogSection` moves out of
  `SettingsPage.tsx` into its own file. **Behaviour-preserving**: every existing SettingsPage suite stays
  green with no edits to its assertions; the registry at the end of wave 1 reproduces today's five tabs and
  today's `"3"` fallback exactly.
- **D-15: The deeper split (each operator tab's state, hydrate slice, payload builder and save handler beside
  its own panel) stays OWED** and is recorded as such in the ledger — partial discharge, stated honestly,
  never "G-5 discharged". It is not needed for FIX-01 and is the risky half on a 1,814-line file.

#### FIX-08: the bounded Chunks list

- **D-16: Bound the LIST, scroll inside it.** The chunk list container gets a max height (`max-h-96`, 24rem,
  the planner may pick an equivalent viewport-aware cap) with `overflow-y-auto`. Same pattern as the
  per-chunk `max-h-32` one level down. Sections below Chunks then sit at a fixed offset at any chunk count.
- **D-17: No scroll trap.** Do NOT set `overscroll-behavior: contain`: wheel scroll at the list's end must
  chain to the panel. The scroll container is keyboard-reachable (`tabIndex={0}`, `role="region"` with an
  aria-label naming the chunk count) so arrow/PageDown scroll it, and Tab moves on past it — no focus trap.
- **D-18: The count stays where it is** (the section header). No duplicate counter inside the list.
- **D-19: No virtualisation unless measured slow.** Record the expand time of a ~1,000-chunk document in the
  G-4 drive. Only if it is visibly slow does windowing become a follow-up (a separate decision, not this
  phase).
- **D-20: Measured by bounding rect.** The G-4 check reads the next section header's
  `getBoundingClientRect()` relative to the panel with Chunks expanded, on a ~1,000-chunk document, never
  `scrollTop`. A unit test asserts the list container carries the bound classes and the region semantics.

#### G-2 / G-4

- **D-21: Sketch SKIPPED, recorded as a decision.** No new door: FIX-01 reuses the existing rail entry and
  the existing tab strip, and the Preferences tab holds two existing components moved verbatim. FIX-08's
  layout is settled by its own report (bound the list using the file's own `max-h` pattern).
- **D-22: G-4 lived-experience scenarios (defined at scope time, driven by Chrome MCP as the real role):**
  1. **A member's first visit.** Signed in as an ordinary member of a real org: the Settings door is on the
     rail; the page opens on Preferences; flip "Show technical names" and set a default chat model; reload;
     both persist; Memory and Audit Log open with the member's own data; no operator tab is in the strip;
     the network log shows no 403.
  2. **An operator's view unchanged.** Signed in as the operator: same rail; Settings opens on AI Model; all
     six tabs present; AI Model saves as before; Preferences carries the toggle + default-model picker.
  3. **A 1,000-chunk document.** Open a document with about 1,000 chunks, expand Chunks: the next section
     header's bounding rect is within one list-height below the Chunks header; wheel past the list's end
     scrolls the panel; Tab moves past the list.
  ⚠ The dev account is in two orgs: prove the active org before every drive. A local member account (and a
  ~1,000-chunk document, synthetic chunks acceptable) may need to be created in the LOCAL database for the
  drive; never on production.
- **D-23: Plan shape (G-8, target 3).**
  - `283-01` (wave 1): SettingsPage tab-registration seam, behaviour-preserving (D-14).
  - `283-02` (wave 2, depends on 01): FIX-01 — Preferences tab, rail un-gate, derived fallback, Reset gate,
    backend two-role + route-inventory fences, frontend fences; TDD RED first.
  - `283-03` (wave 1, parallel with 01 — disjoint files): FIX-08 bounded Chunks list + its test.
  - The G-4 drive + live two-role check + close are done by the orchestrator after verification (executors
    have no Chrome MCP), recorded in `283-LIVE-EVIDENCE.md`.

### Claude's Discretion

- Exact registry shape and file name; whether labels are plain strings or term-map keys (the Search tab
  label already goes through `usePlainLabel`, keep that).
- Exact max-height value for the chunk list, within "fixed slice of the panel".
- Wording of the Preferences tab's section heading, if any.

### Deferred Ideas (OUT OF SCOPE)

- **Chunk list truncated at 1,000 rows** (`documents.py:1059` has no `.range()`; the header count reads
  1,000 for a larger document). Same class as `BUG-261014-07` → **Phase 284 (Library at Scale)**, whose SC#6
  guard covers every list endpoint. Not fixed here.
- **Finding a chunk** (filter box, "N of M") — a capability, explicitly out of scope per the report.
- **Virtualising the chunk list** — only if the G-4 measurement shows it is slow (D-19).
- **The deeper SettingsPage split** (per-tab state/hydrate/save beside each panel) — still OWED (D-15).
- **`BUG-260923-01` (Settings surfaces crowd the nav rail; move settings into the user menu like Claude.ai)** —
  an IA reorganisation, left open; belongs with `SEED-166` / `SEED-196` (configuration homes). This phase
  adds no rail slot for operators.
- **`app/security/access.py` seam on `dependencies.py`** — not taken; this phase does not edit that file.
- Reviewed Todos (not folded): `spike-nl-workflow-authoring.md` — unrelated, not folded.
- Seeds reviewed (none folded): `SEED-012`, `SEED-095`, `SEED-166`, `SEED-196`, `SEED-216`, `SEED-269` — none answered.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIX-01 (`BUG-261004-02`, `folded_into: "283"`) | An ordinary org member can open Settings and use Memory, Audit Log and "Show technical names"; operator-only tabs stay hidden from them. | §Backend fence seam (D-10 prototype, run green + driven RED), §Route inventory (D-11, introspection verified), §Frontend inventory (which suites/assertions move in 283-02), §Registry shape (Option A keeps the two drift gates intact), §Gated-call audit (D-07 holds by Radix unmount; JudgeModelPicker calls `getSettings`), §Docs/landing collateral (Preferences adds a code key two CI gates check). |
| FIX-08 (`BUG-260908-01`, `folded_into: "283"`) | Expanding Chunks on a ~1,000-chunk document leaves every section below it reachable. | §Chunks bound (scroll container = `DocumentDetailPanel.tsx:327`, no `overscroll`; precedents `max-h-72` / `max-h-[28rem]` in sibling sections; `role="region"`+`tabIndex={0}` trips `lint:a11y`, so an inline disable is needed), §Existing test home (`DetailSections.lazy.test.tsx` "Chunks section"), §G-4 data (largest local doc = 764 chunks). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Python backend runs in `backend/venv`; backend unit gate = `pytest tests/unit -q --continue-on-collection-errors` (or `node scripts/check-backend-unit-baseline.cjs`), ceiling **71 failed** with zero headroom. ⚠ Memory note `project_280_closed.md` records the base reading **72** once because of a flaky `test_230`: re-derive at the phase base before blaming a plan.
- New backend fence files MUST live under `backend/tests/unit/` — the `test_148_*` precedents live in `backend/tests/` root and are therefore **outside** the canonical baseline gate.
- No LangChain/LangGraph; Pydantic; RLS on all tables; no blocking I/O in async handlers (not touched here).
- Worktrees ENABLED: every executor runs `bash scripts/bootstrap-worktree.sh "$(pwd)"` first; tear down only with `scripts/teardown-worktree.sh`; `GSD_VITEST_MAX_WORKERS=2`; ≤2 concurrent test-running agents.
- Rule 4 (serialize DB-mutating plans): none of the recommended tests mutate the local DB (all backend fences run through the mocked asyncpg pool), so 283-01 ∥ 283-03 is safe.
- Frontend typecheck: `npx tsc -p tsconfig.app.json --noEmit` with a **set diff** against base (plain `npx tsc --noEmit` checks zero files). `noUnusedLocals: true` is on.
- G-5: `node scripts/check-hot-file-ledger.cjs 283` must exit 0; new/absent files need rows **and** a same-commit section in `docs/HOT-FILE-LEDGER.md` (cell ≤200 chars).
- G-8: 3-5 plans; targeted suites per task, full gates once per wave. Never cut verifier, TDD RED drives, security review, code review.
- Vitest count gate: no per-file DECREASE, 0 failing; a new suite is added to BOTH knobs (`TARGETS` file-level entry + `BASELINE` pin read from the gate's `actual` column).
- Presence assertions cannot see content drift: assert rendered tab names/labels, not test ids.
- Reported-bugs: both `BUG-261004-02` and `BUG-260908-01` read `status: folded, folded_into: "283"` — each must be covered by a plan task (they are: 283-02 and 283-03).
- Settings live in `user_settings`/`app_settings`; env vars are secrets/infra only (no change here).
- Supabase MCP = production; reads free, writes approval-gated (this phase needs no cloud write; no migration).

## Summary

FIX-01 is genuinely a UI-reach fix: the API already refuses a member on all four operator routes, and every member-facing data path (`/me/preferences`, `/audit-logs`, `user_memory` under RLS, `localStorage` for the technical-names reveal) is already ungated and owner-scoped. The work is (1) un-tag one `NAV_ITEMS` entry, (2) move two blocks out of tab `"0"` into a new tab `"6"`, (3) make the fallback tab derived, (4) hide Reset for members, and (5) fence it. The one thing that looks easy and is not: the registry seam collides with **two CI drift gates** (`scripts/lib/docs-content.cjs` and `scripts/check-landing-drift.cjs` §7c) that regex-scrape the literal `<TabsTrigger>…</TabsTrigger>` labels out of `SettingsPage.tsx`, with a floor of 3. A strip mapped from a registry (`{tabs.map(...)}`) collapses that extraction to one bogus key and the docs-coverage gate fails with a harness error. Keep the trigger labels literal in JSX and let the registry own id / audience / order / fallback (Option A below).

The D-10 fence can run the **real** `require_visible → feature_visible → is_operator → feature_audience` chain without a database: patch only `app.dependencies._pg_pool` with the conftest `mock_asyncpg_pool`, and route the single `SELECT 1 FROM operator_users WHERE user_id = $1` read on the user id (row for the operator id, `None` for the member id). Identity is injected through the existing `get_current_user` dependency override. I prototyped this in the scratchpad: member 403 on all four gated routes with the exact detail string, member 200 on `/settings/providers`, `PUT /me/preferences`, `GET /me/preferences` and `/audit-logs`, a 400 on an out-of-set model, operator 200 on `GET /settings`: **3/3 green**. With `require_visible` stripped from one route in memory, the member arm failed: **RED confirmed**.

FIX-08 is a three-class change plus a wrapper element, and the panel already carries the precedents: `DocumentConversationSection`'s `<ol className="flex max-h-72 … overflow-y-auto" aria-label="Conversation">` and `DocumentContentSection`'s `max-h-[28rem] overflow-auto`. The only trap is lint: `role="region"` + `tabIndex={0}` fails `jsx-a11y/no-noninteractive-tabindex` under `npm run lint:a11y` (measured on the existing `Markdown.tsx:125` precedent). D-17's keyboard-reachability therefore needs a justified inline disable.

**Primary recommendation:** Run 283-01 (registry with literal JSX labels + `AuditLogSection` extraction) and 283-03 (bounded chunk list) in parallel, then 283-02. 283-02 adds `"6"` Preferences and the rail un-gate, and changes the docs/landing facts in the same commit. Its backend fences go in `tests/unit/test_283_*.py` using the mocked-pool seam proven here.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Refusing operator-only settings reads/writes | API / Backend (`require_visible("model_management")` per route) | — | The API is the wall; the UI only reflects the decision. D-09: no backend gate moves. |
| Deciding who is an operator | API / Backend (`operator_service.is_operator` → `operator_users`) | Database | One swappable boundary; fenced via the pool seam. |
| Showing/hiding the Settings door | Browser (`nav-items.ts` `visibleNavItems`) | — | Render-only; fail-open for `undefined`, hides on known `false`. |
| Showing/hiding tabs + fallback tab | Browser (`settingsTabs.ts` registry + `SettingsPage`) | API (`GET /features` supplies `model_management`) | Same feature map the API gate derives from. |
| Per-user default model | API (`/me/preferences`, RLS write keyed on `auth.uid()`) | Database (`user_settings.preferences`) | Server re-validates the enabled set + lock. |
| Technical-names reveal | Browser (`localStorage` via `TechnicalNamesProvider`) | — | Per device; no API. |
| Memory list | Browser → Supabase (PostgREST under RLS on `user_memory`) | Database (owner + org policies, verified in `full-schema.sql`) | No FastAPI hop. |
| Audit log list/export | API (`/audit-logs`, service-role + `.eq("user_id")`) | Database | `audit_log` has no authenticated SELECT policy, so owner scoping is in code. |
| Bounded chunk list | Browser (`DocumentChunksSection` inside `DocumentDetailPanel` scroll container) | — | Pure layout; no API change (1,000-row cap is Phase 284). |

## Standard Stack

No new packages. Everything uses what is installed and verified in this session:

### Core (existing)
| Library | Version (measured) | Purpose | Why |
|---------|-------------------|---------|-----|
| FastAPI `APIRoute.dependant` tree | installed in `backend/venv` | Route-inventory introspection (D-11) | Same flattening `tests/test_148_carveouts.py::_flat_dep_calls` already uses |
| pytest + pytest-asyncio (`asyncio_mode = auto`) | `backend/pytest.ini` | Backend fences | Existing harness, `client` / `mock_asyncpg_pool` / `auth_headers` fixtures in `tests/conftest.py` |
| `@radix-ui/react-tabs` | `^1.1.13` | Settings tabs | `TabsContent` without `forceMount` renders children only when active, which is why a member never mounts operator-tab components |
| Tailwind | `^3.4.19` | `max-h-96`, `overflow-y-auto` | Default scale; arbitrary values also available |
| vitest + @testing-library/react + userEvent | jsdom, `src/setupTests.ts` | Frontend fences | Existing `vi.hoisted` + `vi.mock("@/lib/api")` idiom in `SettingsPage.test.tsx` |
| eslint-plugin-jsx-a11y (recommended) | `eslint.a11y.config.js` | `npm run lint:a11y` CI gate | Flags `tabIndex` on non-interactive elements |

**Installation:** none.

## Package Legitimacy Audit

No external packages are installed by this phase. Slopcheck was not run because there was nothing to check.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed:** none. **Packages flagged:** none.

## Architecture Patterns

### System Architecture Diagram

```
 member/operator signs in
        │
        ▼
 GET /features ──► is_operator(user_id) ──► operator_users  ─┐
        │          feature_audience("model_management")      │ (same two seams as require_visible)
        ▼                                                     │
 features map {model_management: true|false}                  │
        │                                                     │
        ├──► nav-items.visibleNavItems ──► Settings door (UNGATED after 283-02: always shown)
        │
        ▼
 SettingsPage ──► settingsTabs.resolveSettingsTab(persisted, canManageModels)
        │              │
        │              ├─ member  → visible {6 Preferences, 3 Memory, 4 Audit Log}, fallback "6"
        │              └─ operator→ visible {0,1,2,6,3,4},                        fallback "0"
        │
        ├─ canManageModels ─► getSettings() ──► GET /settings ──► require_visible ──► 200
        │                     (ReembedStatusCard, JudgeModelPicker, EngineHealthCard mount only in tabs 0/1)
        │
        └─ member tabs:
             Preferences ─► TechnicalNamesToggle (localStorage)
                         └► ModelDefaultPreference ─► GET/PUT /me/preferences (ungated, RLS write, 400 outside set)
             Memory      ─► supabase.from("user_memory") (RLS: owner + org)
             Audit Log   ─► GET /audit-logs[/export] (service-role, .eq("user_id"))

 Direct API call by a member to GET|PUT /settings, GET /settings/reembed-progress, POST /settings/reembed
        └──► require_visible("model_management") ──► 403 "This feature is available to administrators only."

 Document detail panel (aside, h-full) ─► div.min-h-0.flex-1.overflow-y-auto  (THE scroll container, :327)
        └─ PanelSection "Chunks" (count = rows.length in header)
             └─ div[role=region][tabIndex=0][aria-label="N chunks"].max-h-96.overflow-y-auto  ← NEW bound
                  └─ ul > li … (each body already max-h-32)
        └─ PanelSection "Tables" … (now at a fixed offset)
```

### Recommended Project Structure (new/changed files)

```
frontend/src/components/settings/
├── settingsTabs.ts            # NEW (283-01): tab ids, audience, order, pure visibility + fallback
├── AuditLogSection.tsx        # NEW (283-01): moved verbatim from SettingsPage.tsx:377-603
└── PreferencesSection.tsx     # NEW (283-02, recommended): the two moved blocks; calls useTechnicalNames itself
frontend/src/pages/SettingsPage.tsx              # 283-01 seam, 283-02 tab "6" + Reset gate
frontend/src/lib/nav-items.ts                    # 283-02 un-tag + comment rewrite
frontend/src/landing/facts.ts                    # 283-02 SURFACE_TABS.settings gains "Preferences"
frontend/src/components/metadata/DocumentChunksSection.tsx   # 283-03 bound
backend/tests/unit/test_283_settings_two_role_fence.py       # 283-02 (D-10)
backend/tests/unit/test_283_settings_route_inventory.py      # 283-02 (D-11)
docs/public/use/choosing-a-model.md (+ prose in 3 pages)     # 283-02 covers settings-tab:preferences
```

(`frontend/src/pages/settingsSearchPayload.ts` is a precedent for putting the registry in `pages/`. Either location works. CONTEXT's example path is `components/settings/`, so use that.)

### Pattern 1: Registry owns ids/audience/order/fallback; labels stay literal JSX (Option A, RECOMMENDED)

**What:** `settingsTabs.ts` is a `.ts` module (not `.tsx`), which avoids the `react-refresh/only-export-components` break that `settingsSearchPayload.ts` was created to avoid. SettingsPage keeps its literal `<TabsTrigger value="0">AI Model</TabsTrigger>` elements, and each is guarded by `isVisible("0")`.

**Why not map the strip from the registry (Option B):** I measured two consumers that regex-scrape the strip:
- `scripts/lib/docs-content.cjs:727-735` (`extractCodeKeys`): reads `<TabsList[^>]*>([\s\S]*?)<\/TabsList>` then `<TabsTrigger[^>]*>([\s\S]*?)<\/TabsTrigger>` from `SettingsPage.tsx`, slugifies each label into `settings-tab:<slug>`, and enforces `MIN_SETTINGS_TAB = 3`. A mapped strip yields one label like `{labelFor(t)}` → floor fails → `check-docs-coverage.cjs` exits 2.
- `scripts/check-landing-drift.cjs:237-252` (§7c): same regex, compares against `frontend/src/landing/facts.ts` `SURFACE_TABS.settings`.

Both run as PostToolUse hooks (`.claude/hooks/docs-coverage-guard.js`, `landing-drift-guard.js` watch `SettingsPage.tsx`) and in CI (`docs-coverage.yml`, `landing-drift.yml`). Option B would mean repointing both extractors at `settingsTabs.ts` (the `OrgAdminShell` `label: "..."` precedent at drift §7b), updating `docsCoverageGate.test.ts` `COPY_FILES`, `docs/public/README.md:64`, two hook watch lists and two workflow path filters. That is a lot of collateral for a seam, and it is all non-functional.

**Shape:**
```ts
// frontend/src/components/settings/settingsTabs.ts
export type SettingsTabAudience = "everyone" | "model_management"
export interface SettingsTabDef { id: string; audience: SettingsTabAudience; name: string }
// ORDER IS THE STRIP ORDER (pinned by a test against the rendered DOM).
export const SETTINGS_TABS: readonly SettingsTabDef[] = [
  { id: "0", audience: "model_management", name: "AI Model" },
  { id: "1", audience: "model_management", name: "Search & Retrieval" }, // label via usePlainLabel("settings.tab.retrieval") in JSX
  { id: "2", audience: "model_management", name: "Integrations" },
  // 283-02 inserts { id: "6", audience: "everyone", name: "Preferences" } HERE (D-04)
  { id: "3", audience: "everyone", name: "Memory" },
  { id: "4", audience: "everyone", name: "Audit Log" },
] as const
export const RETIRED_SETTINGS_TABS: readonly string[] = ["5"] // never reuse
export const SETTINGS_TAB_STORAGE_KEY = "settings_active_tab"
export function visibleSettingsTabs(canManageModels: boolean): readonly SettingsTabDef[]
export function isSettingsTabVisible(id: string, canManageModels: boolean): boolean
/** wave 1: fallback = first "everyone" tab ("3") — reproduces today for BOTH roles.
 *  283-02: fallback = first VISIBLE tab (member "6", operator "0") — D-05. */
export function resolveSettingsTab(persisted: string | null, canManageModels: boolean): string
```
`name` is a test/doc handle only. It is never rendered, so a label has one rendered home (the JSX the gates read). The `usePlainLabel("settings.tab.retrieval")` call stays at the top of `SettingsPage` unchanged; it is a hook and cannot run inside a registry or a `.map`.

**Wave-1 fidelity trap:** "first visible tab" does NOT reproduce today's behaviour, because an operator with a persisted `"5"` lands on `"3"` today and the first visible operator tab is `"0"`. In wave 1 use "first `everyone`-audience tab" (= `"3"` for both roles). 283-02 switches it to "first visible", and that switch is the moment the two `"5"` tests in `SettingsPage.test.tsx` change.

### Pattern 2: D-10 seam: patch the pool, route the operator read on user id, inject identity

```python
# backend/tests/unit/test_283_settings_two_role_fence.py  (shape PROVEN in scratchpad: 3/3 green, RED under plant)
import app.models.user_settings as us
from app.dependencies import get_current_user
from app.main import app

OP, MEMBER = "11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222"
_SETTINGS_ROW = {"id": "global", "llm_provider": "openai", "llm_model": "gpt-4o",
                 "openai_api_key": "sk-test", "provider_model_lists": {"openai": ["gpt-4o"]}}
_OVERRIDES = [{"model_id": "gpt-4o", "provider": "openai", "enabled": True, "deprecated": False}]

def _prime(monkeypatch, pool, who):
    monkeypatch.setattr("app.dependencies._pg_pool", pool)      # the ONLY data seam
    pool.set_fetchrow_result(_SETTINGS_ROW)                       # app_settings row (no feature_visibility → cold default "operators")
    pool.set_fetch_result(_OVERRIDES)                             # model_capabilities_overrides → enabled set
    inner = pool._conn.fetchrow
    async def fetchrow(sql, *args):                               # is_operator's read, decided by IDENTITY only
        if "operator_users" in sql:
            pool.calls.append((sql, args))
            return {"?column?": 1} if args and args[0] == OP else None
        return await inner(sql, *args)
    monkeypatch.setattr(pool._conn, "fetchrow", fetchrow)
    us._settings_cache = None; us._settings_cache_time = 0.0
    us._model_overrides_cache = {}; us._model_overrides_cache_time = 0.0
    us._all_model_overrides_cache = {}; us._all_model_overrides_cache_time = 0.0
    app.dependency_overrides[get_current_user] = lambda: {"id": who, "email": f"{who[:4]}@x.test"}
    # conftest's autouse reset_mocks restores the canonical override after each test.
```
Asserts (all measured passing at HEAD):
- member: `GET /settings` 403 with `detail == "This feature is available to administrators only."`; `PUT /settings json={}` 403; `GET /settings/reembed-progress` 403; `POST /settings/reembed` 403.
- member: `GET /settings/providers` 200; `PUT /me/preferences {"default_model":"gpt-4o"}` 200, and `pool.calls` contains `"SET LOCAL ROLE authenticated"` and an `INSERT INTO public.user_settings …` (the write ran on the member's RLS connection); `GET /me/preferences` 200 with `default_model == "gpt-4o"` after `set_fetchval_result("gpt-4o")`; `PUT /me/preferences {"default_model":"not-a-model"}` 400; `GET /audit-logs` 200 and `mock_builder.eq` called with `("user_id", MEMBER)`.
- operator: `GET /settings` 200.
- Pin "not widened": `us._GOVERNED_FEATURES["model_management"] == "operators"` (today only `tests/test_148_visibility_cold_default.py` pins it, and that file is outside the unit gate).

⚠ **Be honest about the read-back:** under the mock, `GET /me/preferences` returns whatever `fetchval` is primed with. The unit test proves the GET composes the stored preference, and that the PUT wrote through `auth.uid()` on an RLS-swapped connection. Real persistence across reload is D-13 / G-4, done live.

**Planting the RED (D-10):** strip `require_visible` from **`GET /settings`** (in source, temporarily, or in memory via `monkeypatch.setattr(route.dependant, "dependencies", [...])`). The member then gets a clean `200 != 403`. Do NOT plant on `/settings/reembed-progress`: under the mock its handler raises `TypeError: '>' not supported between 'MagicMock' and 'int'` (`reembed_service.py:338`), and `TestClient` re-raises it. That is still RED, but it reads as a crash rather than as the gate missing.

### Pattern 3: D-11 route inventory: read the feature out of the closure cell

Verified in this session against the live app object:
```python
def _require_visible_features(route) -> set[str]:
    found, stack = set(), list(route.dependant.dependencies)
    while stack:
        d = stack.pop()
        c = getattr(d, "call", None)
        if c is not None and "require_visible.<locals>" in getattr(c, "__qualname__", ""):
            cells = dict(zip(c.__code__.co_freevars, (x.cell_contents for x in (c.__closure__ or ()))))
            assert "feature" in cells, "require_visible's closure no longer carries `feature` — fence must be updated, not pass"
            found.add(cells["feature"])
        stack.extend(getattr(d, "dependencies", []))
    return found
```
Measured output today (`app.routes`, `endpoint.__module__ == "app.api.settings"`):

| Method | Path | Handler | Gate |
|---|---|---|---|
| GET | `/settings` | `get_settings` | `{'feature': 'model_management'}` |
| PUT | `/settings` | `update_settings` | `{'feature': 'model_management'}` |
| GET | `/settings/reembed-progress` | `get_reembed_progress` | `{'feature': 'model_management'}` |
| POST | `/settings/reembed` | `rekick_reembed` | `{'feature': 'model_management'}` |
| GET | `/settings/providers` | `get_providers` | none (Run carve-out) |

No other module mounts a `/settings*` path (checked across `app.routes`). The inventory should be the UNION of "endpoint module is `app.api.settings`" and "path is `/settings` or starts with `/settings/`", so a gated-looking path added from another module is caught too. Add non-vacuity floors (inventory ≥ 5 routes, exactly 4 gated), so a prefix rename cannot make the test pass over zero routes.

**RED for D-11:** (1) a PERMANENT detector self-test: build a throwaway `APIRouter(prefix="/settings")` with one route carrying `Depends(require_visible("model_management"))` and one carrying nothing, then assert the detector names exactly the ungated one. (2) A one-off source plant (add an ungated `@router.get("/_planted")` to `settings.py`, run, see red, revert), recorded in the SUMMARY.

### Pattern 4: D-12(b): spy on the module the components import, with a positive control

Spy on `@/lib/api`, not `fetch`. In jsdom `getAuthHeaders()` throws `"Not authenticated"` before any `fetch`, so a fetch spy would be **vacuous**. Mock every gated client function: `getSettings, updateSettings, getReembedProgress, kickReembed, getJudgeModel, setJudgeModel, getEngineHealth, runEngineSweep`. Also mock `getModelDefault`/`setModelDefault`/`getAuditLogs` (allowed). Then click every visible tab as a member and assert none of the gated spies was called. **Positive control:** the same file's operator render must show `getSettings` called. Without it, a mock that never wires reads as "no calls".

⚠ `getJudgeModel()` is implemented as `const s = await getSettings()` (`lib/api/settings.ts:54-57`), so `JudgeModelPicker` is a **hidden `GET /settings` caller**. It lives in tab `"0"` (`SettingsPage.tsx:1476`) and is safe only because a member never mounts tab 0. Mocking `getJudgeModel` at the barrel catches it if that ever changes.

### Pattern 5: bounded chunk list (283-03)

```tsx
// DocumentChunksSection.tsx — replace the bare <ul> (lines ~100-106)
{state === "ready" && rows.length > 0 && (
  // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WCAG 2.1.1: a scrollable region must be keyboard-reachable (axe scrollable-region-focusable); the region is labelled and is not a focus trap
  <div
    role="region"
    aria-label={`Chunk list, ${rows.length} chunks`}
    tabIndex={0}
    className="max-h-96 overflow-y-auto rounded-md focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
  >
    <ul className="flex flex-col gap-2">{rows.map((row) => <ChunkRowView key={row.id} row={row} />)}</ul>
  </div>
)}
```
- No `overscroll-*` class anywhere (D-17). Verified: no `overscroll` utility exists in `src/components/metadata` or `src/components/panel` today.
- Do NOT add `tabIndex` to the 1,000 per-chunk `<p class="max-h-32 overflow-auto">` bodies: that would add 1,000 Tab stops, which is a trap in all but name.
- `max-h-96` (24rem) sits between the sibling precedents `max-h-72` (Conversation) and `max-h-[28rem]` (Text). The desktop panel is `h-full`. On mobile the panel is a bottom `Sheet` with `max-h-[80vh]`, where 24rem is a large share of a phone. `max-h-[min(24rem,50vh)]` is the viewport-aware alternative D-16 allows. Recommend `max-h-96` for one assertable class, and record the mobile observation in G-4.

### Anti-Patterns to Avoid
- **Mapping `<TabsTrigger>` from the registry without repointing the two extractors:** the docs-coverage gate fails with a harness error and landing-drift reports a mismatch.
- **Overriding `require_visible` or patching `is_operator`/`feature_audience` in the D-10 fence:** the `test_148_require_visible.py` style. D-10 explicitly rejects it.
- **`visibleNavItems({})` as the D-12(a) fence:** `{}` already shows every governed item (fail-open for unknown, `nav-items.ts:152`), so the assertion passes at HEAD and can never go RED. Use the real member shape `{ model_management: false, … }`.
- **A fetch-level spy for "no gated calls":** vacuous in jsdom (see Pattern 4).
- **Importing `getAuditLogs`/`exportAuditLogs` in `AuditLogSection.tsx` from `@/lib/api/settings`:** the four SettingsPage suites mock the `@/lib/api` barrel, so import from `@/lib/api` or the mocks stop intercepting.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| A fake operator check in tests | A patched `is_operator` / overridden `require_visible` | `monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)` + id-routed `operator_users` read | Keeps the real decision chain under test (D-10) |
| Reading which feature a route is gated on | String-matching source text | Closure-cell read (`__code__.co_freevars` + `__closure__`) on the dependant tree | Exact; verified on all 5 routes |
| A per-route "is this gated" helper | New code | Extend `tests/test_148_carveouts.py::_flat_dep_calls` shape | Same flattening, already proven |
| Creating a real local member with a real JWT | Hand SQL into `auth.users` | `backend/tests/integration/_271_gotrue_users.py` (`GoTrueUsers`, `create_org`, `drop_org`, `require_gotrue`) or sign in as `fhdmrd.dev@gmail.com` | GoTrue admin API; strips the personal org so the subject is in ONE org |
| Scroll-container keyboard access | A custom key handler | Native `tabIndex={0}` on the overflow container | Browsers scroll a focused overflow box with arrows / PageDown |
| Virtualising 1,000 rows | `react-window` etc. | Nothing (D-19) | Only if G-4 measures it slow |

## Runtime State Inventory

This is not a rename phase, but it moves a localStorage-persisted UI choice, so stored state matters:

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `localStorage["settings_active_tab"]` in every browser that has opened Settings (values `"0"`–`"5"`). Writers: `SettingsPage.tsx:658` and `EmbeddingModelCard.tsx:93` (writes `"1"`, operator-only path). | No migration: D-05's derived fallback absorbs any stale value (member `"0"` → `"6"`, anyone `"5"` → first visible). |
| Live service config | `app_settings.feature_visibility.model_management = {"audience":"operators"}` in the LOCAL DB (measured). Production not read in this session. | None. D-09 forbids widening. The orchestrator may read prod via Supabase MCP (free) for parity evidence. |
| OS-registered state | None: verified there is nothing OS-level in scope. | None |
| Secrets/env vars | None touched. | None |
| Build artifacts | `graphify-out/` graph (run `graphify update .` after code edits, per CLAUDE.md). | Post-execution housekeeping only |

## Common Pitfalls

### Pitfall 1: Registry-mapped strip breaks two CI drift gates
**What goes wrong:** `check-docs-coverage.cjs` harness-errors (`[floor] … extracted 1 settings-tab key(s), below the floor of 3`) and `check-landing-drift.cjs` reports a SURFACE_TABS mismatch.
**How to avoid:** Option A (literal JSX labels). If Option B is chosen anyway, the collateral list in Pattern 1 is mandatory and belongs in the same plan.
**Warning signs:** the PostToolUse `docs-coverage-guard` / `landing-drift-guard` message in the turn `SettingsPage.tsx` is edited.

### Pitfall 2: Adding "Preferences" adds a code key that docs must cover
**What goes wrong:** a new literal `<TabsTrigger value="6">Preferences</TabsTrigger>` creates `settings-tab:preferences`. `check-docs-coverage.cjs` fails with `[uncovered] settings-tab:preferences`, and landing-drift fails until `facts.ts` `SURFACE_TABS.settings` reads `["AI Model","Search & Retrieval","Integrations","Preferences","Memory","Audit Log"]`. That also breaks `facts.test.ts:55` (`toHaveLength(5)`).
**How to avoid:** in the SAME 283-02 commit, add `settings-tab:preferences` to the `covers:` of `docs/public/use/choosing-a-model.md` (it already covers E20, the default model), update `facts.ts`, and change `facts.test.ts` to `toHaveLength(6)`. Rewrite the now-false prose that says Settings is for "people with model management" in `docs/public/get-started/navigating-syrel.md:12,29,36`, `use/memory.md:11` and `security/audit-trails.md:22`. Optionally fix the "5 Settings tabs" count at `.planning/research/docs-coverage-inventory.md:94`.
**Warning signs:** `node scripts/check-docs-coverage.cjs` / `node scripts/check-landing-drift.cjs` non-zero.

### Pitfall 3: Wave 1 "first visible" fallback is NOT behaviour-preserving
**What goes wrong:** an operator with a persisted `"5"` lands on `"0"` instead of `"3"`, and `SettingsPage.test.tsx` "lands an operator with a persisted Connections tab on Memory" goes red in a plan that promised zero assertion edits.
**How to avoid:** wave 1 = first `everyone` tab. 283-02 switches to first visible and rewrites exactly the two `"5"` tests (operator → AI Model, member → Preferences), keeping their history comments.

### Pitfall 4: The a11y suite opens tab "0" to find the toggle
**What goes wrong:** `SettingsPage.a11y.test.tsx:153` sets `settings_active_tab="0"` "AI Model tab — hosts the toggle", and 3 of its 4 cases `findByRole("button", {name: /technical names/i})`. After the move, Radix does not mount Preferences while `"0"` is active, so the cases fail on an absence.
**How to avoid:** in 283-02 set `"6"` there, and add `Preferences` to the relabeled-tabs case (`:216-221`). Its count stays 4.

### Pitfall 5: `noUnusedLocals` after the AuditLogSection extraction
**What goes wrong:** `tsc -p tsconfig.app.json` errors on now-unused imports.
**Measured:** after removing lines 377-603, the only remaining use of `Download`, `ChevronLeft`, `ChevronRight`, `getAuditLogs`, `exportAuditLogs` and `AuditEntry` is the import line, so remove them. `Loader2`, `Card*` and `Button` stay used. In 283-02, moving the toggle into `PreferencesSection` likewise orphans `TechnicalNamesToggle`, `useTechnicalNames`, `ModelDefaultPreference` and the `showTechnical/toggleTechnical` destructure (`:619`).

### Pitfall 6: `role="region" tabIndex={0}` fails `lint:a11y`
**What goes wrong:** `jsx-a11y/no-noninteractive-tabindex` error. I measured it on the precedent `src/docs/components/Markdown.tsx:125`, which is itself one of the **45 errors `npm run lint:a11y` already reports at HEAD** (the CI gate is inherited-red).
**How to avoid:** add the justified inline disable (Pattern 5) and check by **set diff**: `SettingsPage.tsx` and `DocumentChunksSection.tsx` have **0** lint:a11y errors at base and must stay at 0.

### Pitfall 7: Two hidden callers of gated endpoints outside Settings (scope note)
- `LibraryStatTiles.tsx:77` calls `getReembedProgress()` unconditionally (`LibraryPage.tsx:1017`), so **every member opening the Library already gets a 403** on `/settings/reembed-progress`. This predates the phase and is outside FIX-01's scope. It matters for G-4 scenario 1 ("the network log shows no 403"): drive scenario 1 from a fresh load that goes **straight to Settings** and filter the network log to the Settings session. Otherwise the Library tile's 403 will be misread as a Settings regression. Candidate new bug report, not a fold.
- `JudgeModelPicker` → `getJudgeModel()` → `getSettings()` (tab 0 only). Safe today, and fenced by Pattern 4.

### Pitfall 8: The header count lies above 1,000 chunks (deferred, but affects G-4)
`onTotalChange?.(res.length)` and the endpoint has no `.range()`, so a 1,500-chunk document reads "1000". **Seed any synthetic G-4 document with ≤ 1,000 chunks** (or use the real 764-chunk one), so the drive does not record a Phase-284 defect as a Phase-283 result.

### Pitfall 9: Defense-in-depth for D-07
D-07 holds today only because (a) Radix unmounts inactive `TabsContent` and (b) the fallback never selects an operator tab for a member. In 283-02, also render the three operator `TabsContent` blocks only when `canManageModels` (`{isVisible("0") && <TabsContent value="0">…}`). That makes the zero-gated-calls property structural, at no cost to operators.

## Code Examples

### Member-render fence skeleton (283-02, frontend)
```tsx
// Source: SettingsPage.test.tsx idiom (vi.hoisted + vi.mock("@/lib/api") + EffectiveFeaturesProvider)
const gated = vi.hoisted(() => ({
  getSettings: vi.fn(), updateSettings: vi.fn(), getReembedProgress: vi.fn(), kickReembed: vi.fn(),
  getJudgeModel: vi.fn(), setJudgeModel: vi.fn(), getEngineHealth: vi.fn(), runEngineSweep: vi.fn(),
}))
vi.mock("@/lib/api", async () => ({
  ...(await vi.importActual<typeof import("@/lib/api")>("@/lib/api")),
  ...gated,
  getModelDefault: vi.fn().mockResolvedValue({ default_model: null, effective_model: "gpt-4o", locked: false, allowed_models: ["gpt-4o"] }),
  setModelDefault: vi.fn(), getAuditLogs: vi.fn().mockResolvedValue({ entries: [], total: 0 }), exportAuditLogs: vi.fn(),
}))
vi.mock("@/components/settings/MemorySection", () => ({ MemorySection: () => <p>memory-stub</p> }))
// member = { model_management: false } (the REAL /features shape), operator = { model_management: true }
// assert: tab names in DOM order === ["Preferences","Memory","Audit Log"]; Preferences aria-selected;
//         getByText("Show technical names") + getByText("Default chat model") under Preferences;
//         click every tab; for each gated fn: expect(fn).not.toHaveBeenCalled();
//         positive control (operator render): expect(gated.getSettings).toHaveBeenCalled();
//         no "Reset" button for the member, present for the operator (D-06).
```

### nav fence (283-02)
```ts
const MEMBER_REAL = { model_management: false, workflow_authoring: true, skill_studio: false, governance_health: true } as unknown as EffectiveFeatures
expect(NAV_ITEMS.find(i => i.view === "settings")?.feature).toBeUndefined()
expect(Object.prototype.hasOwnProperty.call(NAV_ITEMS.find(i => i.view === "settings") ?? {}, "feature")).toBe(false)
expect(visibleNavItems(MEMBER_REAL).some(i => i.view === "settings")).toBe(true)   // RED at HEAD
```
`navItemsConnections.test.ts:51-56` ("still hides the model_management Settings entry from a member") must be **flipped in place**, not deleted (its count of 6 is pinned). Its `MEMBER` fixture is derived from `NAV_ITEMS.filter(i => i.feature)`, so after the un-tag it no longer contains `model_management`. Pass the explicit deny in the flipped case. `navItemsUnknownIsNotDenied.test.ts` keeps a non-empty `governed` set (`workflows` remains tagged), so it stays meaningful.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Settings door gated by `model_management` | Door ungoverned; API is the wall (like `connections`/`skills`/`experts`) | 283-02 | Members reach their own tabs |
| Toggle + default model in AI Model tab | Preferences tab `"6"` | 283-02 | Fixes the false Phase 154 "every user can reach it" claim |
| Hardcoded `"3"` fallback | Registry-derived first visible tab | 283-01 (shape) → 283-02 (rule) | Survives future tab adds |

**Stale comments to rewrite (D-01):** `nav-items.ts` lines ~43-57 (the Connections note: "Un-tagging Settings was the other candidate and is the WRONG fix…", which also cites stale `api/settings.py:331,341`) and the Phase 148 note on the `settings` entry. Also the Phase 154 comment block in `SettingsPage.tsx` ~:1177-1182 ("lives here … so every user can reach it (SC#3)").

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Option A (registry owns id/audience/order/fallback, labels stay literal JSX) satisfies D-14's "SettingsPage maps the strip from it" in spirit | Pattern 1 | Low. If the operator insists on a mapped strip, add the Option-B collateral to 283-01 |
| A2 | An inline `eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex` with a WCAG justification is acceptable | Pattern 5 / Pitfall 6 | Low. The alternative `tabIndex={expr}` dodges the rule via `allowExpressionValues` (dishonest), or D-17's keyboard reach is dropped |
| A3 | The operator knows the password for `fhdmrd.dev@gmail.com` (the non-operator local member) | Environment | If not, create a GoTrue member via `_271_gotrue_users.py` |
| A4 | The local PostgREST row cap is the Supabase default of 1,000 (no `config.toml` was found at `supabase/config.toml`) | Pitfall 8 | Only affects the synthetic-doc size choice |
| A5 | Production `app_settings.feature_visibility.model_management` is also `operators` | Runtime State | If prod were widened, a member would see operator tabs there; one free Supabase-MCP read settles it |

## Open Questions

1. **Should the new `PreferencesSection.tsx` exist, or should the two blocks be inlined in SettingsPage's tab `"6"`?**
   - Known: inlining grows a 1,849-line G-5 hot file; a component is one home and drops a hook + 3 imports from SettingsPage.
   - Recommendation: create the component (needs a ledger row).
2. **G-4 scenario 3 document:** the largest local document has **764** chunks (`59e27382-2ff6-4382-b457-306264556215`, "Fahed Mrad Chapters 1-4_FM_29032026.docx", operator-owned). Is 764 "about 1,000"?
   - Recommendation: drive on it first (zero DB writes). Seed a synthetic ≤1,000-chunk local document only if the operator wants exactly ~1,000, and only under the local-DB lock file.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `backend/venv` Python + pytest | backend fences | ✓ | asyncpg 0.31.0 | — |
| Node / npx vitest | frontend fences | ✓ | (10 suites ran: 102 tests green at HEAD) | — |
| Local Supabase Postgres :54322 | G-4 / D-13, read-only probes | ✓ (connected) | — | — |
| `psql` CLI | ad-hoc reads | ✗ | — | `backend/venv` asyncpg read-only script (used in this session) |
| A non-operator member account | G-4 scenario 1, D-13 | ✓ | `fhdmrd.dev@gmail.com` (`e6dc45ca…`): **member** of `22f9c615` (fhdmrd@gmail.com's Organization), org-admin of its own `c1f18150`, NOT in `operator_users` | `uat265-outside@example.test`, `uat266-u4…`, `uat267-u2…` are also plain members; or a fresh GoTrue user via `_271_gotrue_users.py` |
| Operator account | G-4 scenario 2 | ✓ | `fhdmrd@gmail.com` (`d8a54002…`): the ONLY row in `operator_users` | — |
| ~1,000-chunk document | G-4 scenario 3 | partial | max 764 chunks locally | synthetic chunks on LOCAL only |
| Chrome MCP | G-4 drive | orchestrator only | — | executors cannot drive it |
| Running backend on :8000 | D-13 curl | operator starts it | — | check for stale uvicorn holding :8000 first |

**Prove the active org before every member drive:** `fhdmrd.dev` opens in its OWN org `c1f18150`. Switch via the profile menu to "fhdmrd@gmail.com's Organization" (`22f9c615`). For `model_management` (operators audience) the org does not change the 403, but the "ordinary member of a real org" wording of SC#1 does.

## Validation Architecture

(`workflow.nyquist_validation` is `false` in `.planning/config.json`; this section is included because the orchestrator asked for it.)

### Test Framework
| Property | Value |
|----------|-------|
| Backend | pytest, `backend/pytest.ini` (`asyncio_mode = auto`, `testpaths = tests`), fixtures in `backend/tests/conftest.py` |
| Frontend | vitest (jsdom, `src/setupTests.ts`), RTL + userEvent |
| Quick backend | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_283_settings_two_role_fence.py tests/unit/test_283_settings_route_inventory.py tests/test_148_carveouts.py tests/test_148_require_visible.py tests/test_148_visibility_cold_default.py tests/unit/test_249_unverified_at_pick_time.py -q` (the existing five measured **39 passed / 34 s** at HEAD) |
| Full backend gate (once per wave) | `node scripts/check-backend-unit-baseline.cjs` (≤ 71 failed, 0 collection errors) |
| Full frontend gate (once per wave) | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from repo root |

### Phase Requirements → Test Map
| Req / Decision | Behavior | Type | Automated Command | File Exists? |
|--------|----------|------|-------------------|-------------|
| D-14 (283-01) | registry reproduces 5 tabs + `"3"` fallback; DOM order == registry order | unit | `cd frontend && npx vitest run src/components/settings/__tests__/settingsTabs.test.ts src/pages/SettingsPage.test.tsx src/pages/__tests__/SettingsPage.a11y.test.tsx src/pages/__tests__/SettingsPage.changedFields.test.tsx src/pages/__tests__/SettingsPage.sourceCeiling.test.tsx --maxWorkers=2` | ❌ new `settingsTabs.test.ts`; others ✅ (24/4/23/9 cases, unchanged assertions) |
| D-14 extraction | Audit Log tab still renders + paginates/exports | unit | covered by existing SettingsPage suites + optional `AuditLogSection.test.tsx` | ✅ / optional |
| FIX-01 D-10 | real-chain two-role fence | unit (mocked pool) | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_283_settings_two_role_fence.py -q` | ❌ Wave 0 of 283-02 |
| FIX-01 D-11 | route inventory + detector self-test | unit | `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_283_settings_route_inventory.py -q` | ❌ |
| FIX-01 D-12(a) | nav entry ungoverned + visible for `{model_management:false}` | unit | `cd frontend && npx vitest run src/lib/nav-items.test.ts src/lib/__tests__/navItemsConnections.test.ts src/lib/__tests__/navItemsUnknownIsNotDenied.test.ts --maxWorkers=2` | ✅ (flip in place) |
| FIX-01 D-12(b-d) | member/operator strips, landing, zero gated calls, toggle under Preferences, Reset hidden | unit | `cd frontend && npx vitest run src/pages/__tests__/SettingsPage.member283.test.tsx src/pages/SettingsPage.test.tsx src/pages/__tests__/SettingsPage.a11y.test.tsx --maxWorkers=2` | ❌ new member283 suite |
| FIX-01 collateral | docs/landing gates | gate | `node scripts/check-docs-coverage.cjs && node scripts/check-landing-drift.cjs && cd frontend && npx vitest run src/landing/__tests__/facts.test.ts src/docs/__tests__/docsCoverageGate.test.ts --maxWorkers=2` | ✅ (facts.test length 5 → 6) |
| FIX-08 D-16/17/20 | list bound classes, region role, `tabIndex=0`, aria-label names count, NO `overscroll-` class, next section still a sibling | unit | `cd frontend && npx vitest run src/components/metadata/__tests__/DetailSections.lazy.test.tsx --maxWorkers=2` | ✅ extend its "Chunks section" describe (pin 14 → 14+N, same commit) |
| FIX-08 layout | next header rect within one list-height | manual (G-4, Chrome MCP) | orchestrator drive, `283-LIVE-EVIDENCE.md` | — |
| D-13 | real JWT curl member 403 / operator 200; preference survives reload | manual-live | orchestrator | — |

### Sampling Rate
- **Per task:** the targeted command(s) above for the files touched.
- **Per wave:** backend baseline gate + vitest count gate + `npx tsc -p tsconfig.app.json --noEmit` (set diff vs base) + `npx eslint -c eslint.a11y.config.js <touched files>` (0 errors each at base) + `node scripts/check-hot-file-ledger.cjs 283` + docs/landing drift scripts.
- **Phase gate:** all green, then the orchestrator's G-4 + D-13.

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_283_settings_two_role_fence.py`: D-10 (shape proven in this research)
- [ ] `backend/tests/unit/test_283_settings_route_inventory.py`: D-11
- [ ] `frontend/src/components/settings/__tests__/settingsTabs.test.ts`: registry pure functions (wave 1 rule; 283-02 rule)
- [ ] `frontend/src/pages/__tests__/SettingsPage.member283.test.tsx`: D-12(b-d)
- [ ] Count-gate registration: each NEW suite is added to `TARGETS` (file-level; `src/pages/__tests__` and `src/components/settings` are NOT directory entries) and to `BASELINE` with the `actual` value from the gate's own output, in the same commit. Existing pins: `SettingsPage.test.tsx` 24, `SettingsPage.a11y` 4, `.changedFields` 17 (actual 23), `.sourceCeiling` 9, `nav-items.test.ts` 5, `navItemsConnections` 6, `navItemsUnknownIsNotDenied` 4, `facts.test.ts` 5, `docsCoverageGate` 8, `DetailSections.lazy` 14.

## Hot-file ledger (measured with the gate)

`node scripts/check-hot-file-ledger.cjs --files …` over the likely `files_modified` reports **5 files with no row**:

| File | Triple (re-derived 2026-10-15) | Plan | Note |
|---|---|---|---|
| `frontend/src/components/metadata/DocumentChunksSection.tsx` | 1 / 1 / 147 | 283-03 | absent its entire life, so add row + section |
| `frontend/src/components/settings/settingsTabs.ts` | new | 283-01 | young, created 283 |
| `frontend/src/components/settings/AuditLogSection.tsx` | new | 283-01 | young, created 283 |
| `frontend/src/components/settings/PreferencesSection.tsx` | new | 283-02 | only if created |
| `frontend/src/landing/facts.ts` | 4 / 1 / 546 | 283-02 | absent; touched for SURFACE_TABS |

Rows present and FIRING (read their sections before planning): `SettingsPage.tsx` re-derived **51 / 26 / 1849** (row reads 47/24/1814, so it is stale; seam OWED, D-15 partial discharge), `nav-items.ts` **12 / 8 / 153** (matches), `backend/app/api/settings.py` **43 / 22 / 1148**, test-only here. `DocumentDetailPanel.tsx` is **16 / 11 / 666** and does NOT need touching (the bound lives in `DocumentChunksSection`). Exempt from the gate: everything under `scripts/`, `docs/`, `.planning/`, `backend/tests/`, `__tests__/` and `*.test.*`.

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no change | `get_current_user` (GoTrue JWT), untouched |
| V3 Session Management | no | — |
| V4 Access Control | **yes, core** | per-route `require_visible("model_management")` (server authority); UI hide is cosmetic; D-10 + D-11 fences; `model_management` audience pinned `operators` |
| V5 Input Validation | yes | Pydantic `ModelDefaultBody`; server re-checks `default_model ∈ enabled set` (400) and honours the operator lock |
| V6 Cryptography | no | — |
| V7 Errors/Logging | yes | D-07: no knowingly-refused calls (audit-log noise); 403 body is a fixed sentence (no detail leak) |

### Known Threat Patterns (inputs for the plan's `<threat_model>`)
| Pattern | STRIDE | Mitigation (existing / added) |
|---------|--------|---------------------|
| Member calls `GET /settings` directly to read provider config/keys | Information disclosure | `require_visible` 403 (existing); D-10 fence (added) |
| Member calls `PUT /settings` / `POST /settings/reembed` (cost / DoS: re-embedding everything) | Elevation of privilege / DoS | 403 (existing); D-10 asserts both |
| A future `/settings/*` route added without the gate | Elevation of privilege | D-11 inventory fence + detector self-test |
| Operator "fixes" member reach by widening `model_management` | Elevation of privilege | D-09; `_GOVERNED_FEATURES` pin in the unit gate |
| Member sets a default model outside the enabled set | Tampering | server 400 (`me_preferences.py`), asserted in D-10 |
| Member reads another user's preference/memory/audit | Information disclosure | `/me/preferences` writes keyed on `auth.uid()` under `SET LOCAL ROLE authenticated`; `user_memory` RLS (owner + org, all four verbs, `full-schema.sql:8073-8339`); `/audit-logs` `.eq("user_id", caller)`. D-10 asserts the RLS swap and the `.eq` |
| Spoofed `X-Org-Id` | Spoofing | Irrelevant to `operators` audience (only `role` audience reads org; `resolve_caller_role` fails closed to `member`) |
| CSV formula injection in `/audit-logs/export` (a filename like `=HYPERLINK(...)`) | Tampering (client-side) | **Pre-existing, not introduced.** Members gain UI reach to an export the API already served them. Note it; do not fold |
| `GET /settings/providers` reveals configured provider names/models to members | Information disclosure (accepted) | Documented Run carve-out (Phase 148), unchanged |

No surface a member can reach after the un-gate calls a write endpoint without a server-side check. Every operator-tab component (`ReembedStatusCard`, `JudgeModelPicker`, `EngineHealthCard`, `SourceFileCeilingCard`, the save handlers) mounts only in tabs `"0"`/`"1"`/`"2"`.

## Sources

### Primary (HIGH confidence, measured this session)
- `backend/app/dependencies.py:84-109, 127-176, 600-662` (`get_pg_pool`, `_apply_rls_user_context`, `get_user_pg_connection`, `feature_visible`, `require_visible`)
- `backend/app/services/operator_service.py:31-46` (`is_operator` + its documented test seam)
- `backend/app/models/user_settings.py:375-401, 527-568, 799-830, 1289-1367, 1582-1686`
- `backend/app/api/settings.py` (routes at :578, :587, :1004, :1033, :1067), `me_preferences.py`, `audit.py`, `features.py`
- `backend/tests/conftest.py` (`mock_asyncpg_pool`, `_reset_pg_pool_singleton`, `reset_mocks`, `get_current_user` override)
- `backend/tests/test_148_carveouts.py`, `test_148_require_visible.py`, `test_196_model_registry_route.py`, `tests/unit/test_249_unverified_at_pick_time.py`
- Scratchpad prototype `proto283/test_proto_283_two_role.py`: 2 passed (member + operator); in-memory plant → 1 failed (RED)
- Live introspection of `app.routes` (route/gate table above)
- `frontend/src/pages/SettingsPage.tsx`, `lib/nav-items.ts`, `lib/api/settings.ts`, `components/settings/*`, `components/ui/tabs.tsx`, `components/metadata/DocumentChunksSection.tsx`, `DocumentDetailPanel.tsx`, `components/panel/PanelSection.tsx`, `components/library/LibraryStatTiles.tsx`
- `scripts/lib/docs-content.cjs:645-735`, `scripts/check-landing-drift.cjs:237-252`, `scripts/check-docs-coverage.cjs`, `scripts/check-hot-file-ledger.cjs`, `scripts/vitest-count-gate.cjs`
- Gate runs: `check-docs-coverage` OK (112 keys), `check-landing-drift` zero drift, 10 frontend suites 102/102 green, `lint:a11y` 45 errors at HEAD (inherited; 0 in the two touched files)
- Local DB read-only probe (asyncpg, read-only transactions): `operator_users`, `org_members`, `app_settings.feature_visibility`, chunk counts
- `.claude/skills/sketch-findings-agentic-rag/references/governance-audit-users-visibility.md` (069-A: model management = Settings *sections*, VANISH), `document-detail-panel.md`

### Secondary / Tertiary
- None needed; no web sources were relied on.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, nothing new; all existing and exercised.
- Architecture / seams: HIGH, D-10 seam prototyped green and driven RED; D-11 introspection run on the real app.
- Pitfalls: HIGH, each measured (gate runs, lint run, regex read, DB probe).

**Research date:** 2026-10-15
**Valid until:** 2026-11-14, or the next commit touching `SettingsPage.tsx`, `settings.py`, `nav-items.ts` or the docs/landing extractors.
