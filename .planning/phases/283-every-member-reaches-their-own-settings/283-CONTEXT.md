# Phase 283: Every Member Reaches Their Own Settings - Context

**Gathered:** 2026-10-15 (autonomous `--auto`: the operator said "continue autonomously on this phase end to end, discuss, research and execute")
**Status:** Ready for planning

<domain>
## Phase Boundary

**FIX-01 (`BUG-261004-02`):** an ordinary org member (not an operator) can open Settings and use the
three things that are theirs: **Memory**, **Audit Log** and **"Show technical names"** (plus the per-user
default chat model, which already lives beside that toggle). Operator-only tabs (AI Model, Search &
Retrieval, Integrations) stay **hidden in the UI and refused 403 at the API**. `model_management`'s
audience is **not** widened.

**FIX-08 (`BUG-260908-01`):** expanding the Chunks section of a ~1,000-chunk document leaves every section
below it reachable. The list is bounded and scrolls inside itself; the chunk count stays visible.

No new capability. No migration. No new feature key. No chunk filter/search box. No "Show first 20 / Show
all" button.

</domain>

<decisions>
## Implementation Decisions

### Measured at discuss (scout, HEAD `78551612b`). These facts drive the decisions.

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

### FIX-01: where the member's settings live

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

### FIX-01: the API is the authority (security_enforcement)

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

### SettingsPage G-5: the tab seam, behaviour-preserving, FIRST

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

### FIX-08: the bounded Chunks list

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

### G-2 / G-4

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source bug reports and requirements
- `.planning/reported-bugs/BUG-261004-02-settings-unreachable-for-ordinary-users.md` — FIX-01's report
- `.planning/reported-bugs/BUG-260908-01-chunks-section-is-unbounded-and-buries-every-section-below-it.md` — FIX-08's report (rules out "Show all", names the `max-h` pattern)
- `.planning/REQUIREMENTS.md` — FIX-01, FIX-08
- `.planning/ROADMAP.md` §"Phase 283" — success criteria, "How we'd know this failed", flags

### Hot-file ledger (read the file's section before planning)
- `docs/HOT-FILE-LEDGER.md` §`frontend/src/pages/SettingsPage.tsx` — the owed tab seam; the seven binding invariants from 242 (changed-fields payload, two fixtures, `FieldRow` a11y gap)
- `docs/HOT-FILE-LEDGER.md` §`frontend/src/lib/nav-items.ts` — 262-05 / 271 entries
- `docs/HOT-FILE-LEDGER.md` §`backend/app/api/settings.py` — 239-09 / mig 180 entries
- `docs/HOT-FILE-LEDGER.md` §`frontend/src/components/metadata/DocumentDetailPanel.tsx` — 270 / 271 / 275-04 (only if it is touched)
- `scripts/check-hot-file-ledger.cjs` — fails a plan whose `files_modified` names a source file with no row (`DocumentChunksSection.tsx` and any new file need rows)

### Design contracts
- Skill `sketch-findings-agentic-rag` — Settings surfaces (Phase 111.1 picker + 🔒 footer), the document detail panel shell (Phase 112), and the Phase 148 VANISH rule (no locked/badged placeholder)

### Process
- `CLAUDE.md` §Workflow guardrails (G-2, G-4, G-5, G-8), §UAT scoreboard recipe, §Parallel execution (worktrees, `GSD_VITEST_MAX_WORKERS=2`, backend baseline gate 71 failed)
- `docs/VITEST-COUNT-GATE.md` — count-gate contract (no per-file decrease, 0 failing)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TechnicalNamesToggle` + `useTechnicalNames()` — move as-is into Preferences.
- `ModelDefaultPreference` — self-fetching, self-persisting via `/me/preferences`; move as-is.
- `MemorySection` (`components/settings/MemorySection.tsx`) — already its own file.
- `AuditLogSection` — in-file function at `SettingsPage.tsx:439`, to be extracted.
- `useEffectiveFeaturesOptional()` — the features map; fails CLOSED to `{}` (test is `=== true`).
- `PanelSection` with `count` — already shows the chunk total in the header.

### Established Patterns
- Per-endpoint `require_visible(...)`, never router-level (the `/settings/providers` carve-out).
- VANISH, not lock: a governed control the caller cannot use is absent, not disabled.
- Fail-closed features map: a blip hides, never flashes, a governed tab; the page waits for the map
  (spinner) before deciding.
- `SettingsPage.a11y.test.tsx` needs `EffectiveFeaturesProvider` in its render, or it audits an absence.

### Integration Points
- `frontend/src/lib/nav-items.ts` (`NAV_ITEMS`, `visibleNavItems`) — the rail and the mobile drawer both map it.
- `frontend/src/pages/SettingsPage.tsx` — tab strip at ~:1152-1167, contents ~:1171-1831.
- `backend/app/api/settings.py`, `backend/app/api/me_preferences.py`, `backend/app/api/audit.py` — fence targets.
- `frontend/src/components/metadata/DocumentChunksSection.tsx` — the list at ~:100-106.

</code_context>

<specifics>
## Specific Ideas

- The report's own words for FIX-08: *"suppose that I have 1000 chunks I have to scroll down 1000 times to
  reach to the next menu."* The fix is judged by reaching the next menu, not by how the list looks.
- An accordion's promise: expanding one section does not cost access to the others.

</specifics>

<deferred>
## Deferred Ideas

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

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` (score 0.6) — matched on generic keywords ("phases", "real", "case");
  it is about NL workflow authoring and has nothing to do with settings or chunks. Not folded despite the
  `--auto` ≥ 0.4 rule, because folding it would be scope creep.

### Seeds reviewed (none folded)
- The structured sweep matched 0 seeds (no plans yet). A manual grep found IA seeds that mention settings
  (`SEED-012`, `SEED-095`, `SEED-166`, `SEED-196`, `SEED-216`, `SEED-269`); all are reorganisation or new
  capability, none is answered by this phase, so none is edited.

</deferred>

---

*Phase: 283-every-member-reaches-their-own-settings*
*Context gathered: 2026-10-15*
