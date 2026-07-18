---
phase: 159-model-registry-curation
verified: 2026-07-18T03:17:33Z
status: human_needed
score: 9/9 must-haves verified (code-level)
overrides_applied: 0
human_verification:
  - test: "Run live discovery and confirm the utility filter genuinely reduces the raw provider result set"
    expected: "'New models' collapses from ~401 raw entries to a small chat/tool-capable set; utility ids (embeddings/audio/image/moderation/rerank/transcribe) are hidden with an honest 'N utility models hidden' line; 'Show all' reveals them without changing the persisted default"
    why_human: "Requires a live discovery pull against real provider /models endpoints — automated tests only exercise fixture data, not the real ~401-entry volume the operator's pain point references"
  - test: "Toggle 'Filter to chat/tool models' off, then hard-reload the Control Room page"
    expected: "The toggle remains OFF after reload (persisted via app_settings, read back through GET /settings)"
    why_human: "Real session/reload persistence across the running app cannot be exercised by component-level vitest mocks"
  - test: "Add a model by ID (e.g. kimi-k3 / moonshot) end-to-end: open the form, confirm capability fields pre-fill amber 'default — confirm', submit, confirm the new row appears DISABLED in the registry table, then enable it from the table"
    expected: "The row appears disabled immediately after the shell re-fetches (no manual page refresh); enabling it from the table works via the existing Phase-149 write path"
    why_human: "End-to-end click-through across two components (form → table) and the post-submit re-fetch behavior are UI/UX flows that unit tests approximate but don't fully replace"
  - test: "Visually compare the three capability source badges (green provider-confirmed, amber 'default — confirm', blank amber 'unknown — you set it') on both the add-by-ID form and the discovery hand-fill"
    expected: "The three states are visually distinguishable at a glance, consistent with the sketch-findings design direction"
    why_human: "Visual/design-fidelity check — cannot be verified by grep or DOM-assertion tests alone"
  - test: "Add a model by ID, then run Live Discovery and confirm the just-added model no longer appears in 'New models'; separately, attempt to add an already-known model id and confirm the 409 refusal renders in-form"
    expected: "No duplicate/confusing state between the add-by-ID and discovery entry points; the 409 'already in the registry' detail is visible to the operator"
    why_human: "Requires a live two-surface sequence with real backend state between steps"
---

# Phase 159: Model Registry Curation Verification Report

**Phase Goal:** An operator can curate the model registry without wading through hundreds of irrelevant models — live discovery surfaces only chat/tool-capable models by default, and a single new model can be added by ID with its capabilities set explicitly.
**Verified:** 2026-07-18T03:17:33Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All 6 plans' code artifacts were read directly (not inferred from SUMMARY.md), all backend tests were re-run independently, the live local database was queried directly via `psycopg2`, a full `tsc -b` + `vite build` were re-run, and a broad backend regression sweep (99 admin/model-registry tests + a 341-test cross-cutting sweep) was executed to hunt for regressions the SUMMARYs might not have surfaced. No FAILED must-haves were found. The phase is held at `human_needed` — not `passed` — solely because live/visual/external-provider verification is still outstanding, exactly as both 159-05 and 159-06's own `<verification>` blocks call for ("Live UAT (phase verification, Chrome MCP)").

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **[Roadmap SC#1 / D-159-01 / D-159-04]** Live discovery filters to chat/tool-capable models by default (utility hidden), explicit "show all" opt-in, persisted default via `app_settings` | ✓ VERIFIED | `UTILITY_MODEL_EXCLUDE` regex + `is_utility_model()` in `model_discovery_service.py:120-135`; `_build_new_entry` tags `"utility"` (L452); `ModelDiscoveryPanel.tsx` renders `visibleNew`/`hiddenNewCount` (L261-268) + "Show all" (L377-393); toggle persists via `onSetFilter` → `setFlag("model_discovery_filter_enabled", …)` → `app_settings` (live DB confirmed: `boolean NOT NULL DEFAULT true`, current value `True`) |
| 2 | **[Roadmap SC#2 / D-159-02 / D-159-03]** Operator can add a single model by ID with capabilities, sensible per-family defaults pre-filled + editable, lands disabled | ✓ VERIFIED | `POST /admin/models` → `add_model_by_id` (`admin.py:1123`) forces `enabled=False` (L1222); `ModelRegistryTab.tsx` `AddModelForm` (L866+) pre-fills from `familyDefaults()`, 3-way `CapSourceTag`; `ControlRoomPage.handleAddModel` (L528) → `addModelById` → `pulseRecording()` → `fetchRegistry()` |
| 3 | **[Roadmap SC#3]** Newest-first ordering holds; a discovered/added model never silently lacks native tools (explicit, never guessed); filter/pre-fill are display-only, never auto-enable | ✓ VERIFIED | `sort_newest_first` untouched by any 159 commit (git diff empty); `native_tools` omitted from the add-by-ID body when the tri-state select is "unknown" (`ModelRegistryTab.test.tsx:495` asserts `not.toHaveProperty("native_tools")`); DB `NULL native_tools` falls through to the inferred provider default in `get_model_capability_async` (`config.py:702-707`), never a hard `false`; `buildChanges()` reads the FULL `result.new` regardless of the display filter (`ModelDiscoveryPanel.tsx:200`, test-asserted at `ModelDiscoveryPanel.test.tsx:354-364`) |
| 4 | **[D-159-01]** `UTILITY_MODEL_EXCLUDE` lives in ONE shared importable constant; `curate_models.py` imports it, cannot drift | ✓ VERIFIED | `grep -rn "UTILITY_MODEL_EXCLUDE = re.compile"` → exactly 1 hit (`model_discovery_service.py:120`); `curate_models.py:396-406` imports it locally inside `diff_provider` and unions with a local `_CHAT_LEGACY_EXCLUDE`; `--help` still exits 0 with no provider keys/network |
| 5 | **[D-159-02]** `POST /admin/models` is SQLi-safe, operator-gated, forces `enabled=false`, served immediately (no restart), rejects case-variant duplicates | ✓ VERIFIED | Router-level `require_operator` (`admin.py:137`); column names ONLY from `_ADD_MODEL_CAP_COLUMNS` + `$N` binds (`admin.py:1200-1223`); `enabled` bound as the literal `False`, last position, never `body.*`; case-folded dup guard (`admin.py:1186-1194`); `invalidate_model_overrides_cache()` on success |
| 6 | **[D-159-03]** `familyDefaults` per-provider-family capability table exists, source-labeled hierarchy (provider-returned > family-default > blank) | ✓ VERIFIED | `frontend/src/lib/model-defaults.ts` — 11-family substring table + provider fallback + all-null blank; 12/12 tests pass matching every acceptance value exactly (kimi-k3 → 256000/65536/true, claude → 200000/true, gpt-5.4 → 400000, google bare → 600000, unrecognized → all-null) |
| 7 | **[D-159-04]** `model_discovery_filter_enabled` is a persisted, operator-governed `app_settings` knob (default ON), fail-soft, survives sessions/workers | ✓ VERIFIED | Migration 103 applied — confirmed LIVE via direct `psycopg2` query: `('model_discovery_filter_enabled', 'boolean', 'NO', 'true')`, row value `True`; `full-schema.sql:481` matches; fail-soft `_val_bool(row, …, None, True)` (`user_settings.py:751`); `GET /settings` serializes it (`settings.py:241`); write rides `PUT /admin/flags` via `_FLAG_HUMAN_NAMES` (`admin.py:78`) |
| 8 | **[Wiring]** `ModelRegistryTab` "+ Add model by ID" form ↔ `ControlRoomPage` end-to-end | ✓ VERIFIED | `onAddModel={handleAddModel}` passed at `ControlRoomPage.tsx:781`; `handleAddModel` (L528-535) calls `addModelById` → `pulseRecording()` → `fetchRegistry()`, errors NOT swallowed (propagate to the form's in-form refusal) |
| 9 | **[Wiring]** `ModelDiscoveryPanel` filter toggle ↔ `ControlRoomPage` end-to-end | ✓ VERIFIED | `filterEnabled={settings?.model_discovery_filter_enabled ?? true}` + `onSetFilter={handleSetDiscoveryFilter}` at `ControlRoomPage.tsx:787-788`; `handleSetDiscoveryFilter` (L555-561) calls `setFlag(...)` → `fetchSettings()` — real network round-trip (`getSettings()`/`setFlag()` both hit `fetch(...)`, not stubs) |

**Score:** 9/9 truths verified at the code level. Held to `human_needed` because live/visual/external-provider confirmation is still outstanding (see Human Verification Required).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/model_discovery_service.py` | `UTILITY_MODEL_EXCLUDE` + `is_utility_model()` + display-only `utility` tag | ✓ VERIFIED | L120-135, L452; `compute_diff`'s `changed`/`vanished` builders carry no `utility` key (structurally confirmed by reading L500-539) |
| `scripts/curate_models.py` | Re-pointed to the shared exclude core | ✓ VERIFIED | L396-406 local import + union with `_CHAT_LEGACY_EXCLUDE`; `--help` exits 0 |
| `backend/tests/test_159_utility_filter.py` | Classification + tag assertions | ✓ VERIFIED | 9 tests, all pass |
| `backend/app/api/admin.py` | `add_model_by_id` route + `AddModelRequest` + `_FLAG_HUMAN_NAMES` key | ✓ VERIFIED | L1087-1248 (route), L78 (flag key) |
| `backend/tests/test_159_add_model.py` | Happy-path + validation + duplicate + honesty coverage | ✓ VERIFIED | 12 tests, all pass — asserts SQL text has no interpolated client value, only `$N`/`EXCLUDED` |
| `backend/tests/test_159_filter_flag.py` | Over-HTTP flag-toggle proof | ✓ VERIFIED | 5 tests, all pass |
| `supabase/migrations/103_model_discovery_filter.sql` | Idempotent `ADD COLUMN … DEFAULT true` | ✓ VERIFIED | File present, matches 099-style header; **applied to the live local DB** (independently confirmed via `psycopg2`, not just SUMMARY claim) |
| `backend/app/models/user_settings.py` | Settings field + fail-soft readback | ✓ VERIFIED | L172, L751 |
| `backend/app/api/settings.py` | `GET /settings` response field + serialization | ✓ VERIFIED | L80, L241 |
| `backend/app/main.py` | `_DIRECT_COLUMNS` entry | ✓ VERIFIED | L121 |
| `backend/tests/test_159_filter_setting.py` | Fail-soft + membership tests | ✓ VERIFIED | 5 tests, all pass |
| `frontend/src/lib/api.ts` | `addModelById`/`AddModelBody`/`DiscoveredNewModel.utility`/`FullAppSettings.model_discovery_filter_enabled`/`FlagKey` | ✓ VERIFIED | L2208, L4066-4074, L4202-4210, L4229-4241, L4311-4319 |
| `frontend/src/lib/model-defaults.ts` | `familyDefaults()` per-family table | ✓ VERIFIED | Full file read; 109 lines, substantive, 12/12 tests pass |
| `frontend/src/components/admin/ModelRegistryTab.tsx` | "+ Add model by ID" form | ✓ VERIFIED | `AddModelSection`/`AddModelForm`/`CapSourceTag` (L787-1040+); `onAddModel` prop wired |
| `frontend/src/components/admin/ModelDiscoveryPanel.tsx` | Filter toggle + hidden-count + show-all + pre-fill | ✓ VERIFIED | `filterEnabled`/`onSetFilter` props, `seedDraftsFromDefaults`, `visibleNew`/`hiddenNewCount` (L79-268, L336-396, L552-699) |
| `frontend/src/components/admin/ControlRoomPage.tsx` | `handleAddModel` + `handleSetDiscoveryFilter` wiring | ✓ VERIFIED | L528-535, L555-561, L777-789 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `scripts/curate_models.py` | `model_discovery_service.UTILITY_MODEL_EXCLUDE` | local import in `diff_provider` | ✓ WIRED | `grep` confirms import + usage; behavior-preservation proven by 149 discovery regression suite still green |
| `model_discovery_service._build_new_entry` | `is_utility_model` | display-only `utility` tag | ✓ WIRED | L452 |
| `ModelRegistryTab` "+ Add model by ID" form | `ControlRoomPage.handleAddModel` | `onAddModel` prop | ✓ WIRED | `ControlRoomPage.tsx:781` |
| `ControlRoomPage.handleAddModel` | `addModelById` → `POST /admin/models` | server-is-source-of-truth re-fetch | ✓ WIRED | Real `fetch()` in `api.ts:4311-4319`, not a stub |
| Add-by-ID form capability inputs | `familyDefaults` | source-labeled pre-fill | ✓ WIRED | `ModelRegistryTab.tsx:889` |
| `ModelDiscoveryPanel` filter toggle | `ControlRoomPage.handleSetDiscoveryFilter` | `onSetFilter` prop | ✓ WIRED | `ControlRoomPage.tsx:788` |
| `ControlRoomPage.handleSetDiscoveryFilter` | `setFlag(model_discovery_filter_enabled)` | persisted `app_settings` write + settings re-fetch | ✓ WIRED | `ControlRoomPage.tsx:555-561`; live DB confirms the column exists and is readable |
| `NewModelRow` un-returned inputs | `familyDefaults` | "default — confirm" pre-fill (never auto-enable) | ✓ WIRED | `ModelDiscoveryPanel.tsx:79-107, 628-669`; `enableNow` gating structurally unchanged |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `ModelDiscoveryPanel.filterEnabled` | `settings?.model_discovery_filter_enabled` | `ControlRoomPage.fetchSettings` → `getSettings()` → real `fetch(${API_BASE}/settings)` → DB-backed `app_settings` column | Yes | ✓ FLOWING |
| `ModelDiscoveryPanel` "New models" | `result.new` (with `utility` tag) | `onRunDiscovery` → `runModelDiscovery()` → real `fetch(POST /admin/models/discover)` → `model_discovery_service.discover_all`/`compute_diff` (live provider fan-out) | Yes | ✓ FLOWING |
| `ModelRegistryTab` rows | `rows` prop | `ControlRoomPage.fetchRegistry` → `getModelRegistry()` → real `fetch(GET /admin/models)` → `MODEL_CAPABILITIES ∪ overrides` | Yes | ✓ FLOWING |
| Add-by-ID persisted row | `model_capabilities_overrides` | `add_model_by_id` → real parameterized `pool.execute()` against live Postgres | Yes | ✓ FLOWING (independently confirmed: `model_discovery_filter_enabled` column + row value read directly via `psycopg2`) |

### Behavioral Spot-Checks

No live backend server was started for this verification (project convention: the user starts `uvicorn`; the verifier must not `run_in_background` it). In place of live HTTP spot-checks, the equivalent (and stronger) evidence was gathered by re-running the actual FastAPI route handlers through the real pytest suite (not trusting SUMMARY pass claims) plus a direct live-database query:

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Utility classification is correct on real ids | `pytest tests/test_159_utility_filter.py` | 9/9 pass (chatgpt-4o-latest survives; embed/whisper/dall-e/etc. excluded) | ✓ PASS |
| `POST /admin/models` SQL is injection-safe + forces disabled | `pytest tests/test_159_add_model.py` | 12/12 pass (source-asserts `$N`/`EXCLUDED` only, no interpolated id/provider) | ✓ PASS |
| Filter-flag write routes through `save_app_settings` | `pytest tests/test_159_filter_flag.py` | 5/5 pass | ✓ PASS |
| Fail-soft settings readback | `pytest tests/test_159_filter_setting.py` | 5/5 pass | ✓ PASS |
| `curate_models.py --help` stays fast | `backend/venv/Scripts/python.exe scripts/curate_models.py --help` | exit 0, no network/keys required | ✓ PASS |
| Migration 103 column exists live | direct `psycopg2` query against `127.0.0.1:54322` | `('model_discovery_filter_enabled', 'boolean', 'NO', 'true')`, value `True` | ✓ PASS |
| No regression across the whole 146-159 admin/model-registry test surface | `pytest tests/test_147_*.py tests/test_148_*.py tests/test_149_*.py tests/test_159_*.py` | 99/99 pass | ✓ PASS |
| Frontend component/a11y suites for all 159-touched components | `vitest run ModelRegistryTab* ModelDiscoveryPanel* ControlRoomPage.test.tsx model-defaults.test.ts` | 84/84 pass (72 component + 12 model-defaults) | ✓ PASS |
| TypeScript build has 0 net-new errors | `npx tsc -b` | 29 pre-existing errors, 0 touch any 159 file (confirmed by grep) | ✓ PASS |
| Deploy build succeeds | `npx vite build` | exit 0 | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist in the repo, and neither PLAN nor SUMMARY files for this phase reference a probe script. **SKIPPED (no runnable probes declared for this phase).**

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MODEL-03 (STRETCH) | 159-01..06 (all 6 plans declare `requirements: [MODEL-03]`) | "Live model discovery is curatable — filters to chat/tool-capable models by default … and an operator can add a single new model by ID with its capabilities … plus sensible per-provider-family defaults; preserving the propose-not-auto-enable rule (MODEL-02) and newest-first ordering" | Code SATISFIED / NEEDS HUMAN for final flip | Every clause of the requirement text is code-verified (see Observable Truths 1-9). `REQUIREMENTS.md:104` still shows `Pending` — intentionally, per the 148-156 convention of deferring the flip to live Chrome-MCP UAT at `/gsd:verify-work`. No orphaned requirements: `grep "Phase 159" REQUIREMENTS.md` returns only the MODEL-03 row. |

No orphaned requirements found — MODEL-03 is the only requirement ID mapped to Phase 159 in `REQUIREMENTS.md`, and it is declared in all 6 plans' frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| *(none in any 159-touched file)* | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers, no `dangerouslySetInnerHTML`, no console.log-only stubs, no hardcoded-empty stub returns in any of the 11 files this phase modified | — | — |
| *(cross-cutting, out of phase scope)* | — | 16 pre-existing backend test failures found during a broad `-k "admin or model or settings or discovery or flag"` sweep (`test_provider_router.py`, `test_mdl_verification.py`, `test_get_model_capability_inference.py`, `test_111_1_reembed_kickoff.py`, `test_threads.py`, `test_extraction_dispatcher.py`, `test_skill_tuner_routes.py`, `test_eval_runner.py`) | ℹ️ INFO | Independently confirmed NOT caused by Phase 159: `git diff` shows zero changes to `config.py`/`dependencies.py`/any of the 7 failing test files across the entire 159 commit range (`b15b2784^..HEAD`); the one file that did change (`user_settings.py`, +16 lines, purely additive) is not referenced by any of these tests. Root causes are unrelated (e.g. `test_provider_router.py` mocks `app.api.threads.insert_run`, a function that no longer exists in `threads.py`; `test_get_model_capability_inference.py` asserts a stale `llm_call_timeout_seconds == 90` against a constant that was deliberately revised to 300 back on 2026-05-24, months before this phase). This is backend-side rot analogous to the already-known SEED-056/049 frontend rot — logged here for hygiene visibility, not a Phase-159 gap. |
| Pre-existing frontend `tsc -b` rot | 29 locations across ~15 unrelated files | Stale mocks / unused vars / zustand type drift (SEED-056/049) | ℹ️ INFO | Confirmed pre-existing and unrelated: 0 of the 29 errors reference any of `ModelRegistryTab.tsx`, `ModelDiscoveryPanel.tsx`, `ControlRoomPage.tsx`, `api.ts`, or `model-defaults.ts` |

### Human Verification Required

The phase's own plans (159-05, 159-06) explicitly call for "Live UAT (phase verification, Chrome MCP)" as part of their `<verification>` blocks — this is not optional per CLAUDE.md's G-4 guardrail ("Phase touches user-visible UI → Chrome MCP drives all 3 [lived-experience] scenarios at phase verification — wire format + screenshot are insufficient"). All 5 items below are harvested directly from those plan blocks plus this verifier's own analysis of what code-level checks cannot reach (external provider volume, visual badge distinctness, session persistence, cross-surface sequencing).

### 1. Live discovery filter reduces the real provider result set

**Test:** In Control Room → Model Registry → Model Discovery, click "Run discovery" against real provider keys.
**Expected:** The "New models" group collapses from the raw ~401-entry pull to a small chat/tool-capable set; utility ids (embeddings, audio, image, moderation, rerank, transcribe) are hidden by default with an honest "N utility models hidden" line; "Show all" reveals them without flipping the persisted default.
**Why human:** Requires a live external API pull against real provider `/models` endpoints — automated tests only exercise small fixture sets, not the real volume the operator's stated pain point references.

### 2. Persisted filter toggle survives a page reload

**Test:** Toggle "Filter to chat/tool models" off, then hard-reload the Control Room page.
**Expected:** The toggle stays OFF after reload (persisted default read back from `GET /settings`).
**Why human:** Real session/reload persistence in the running app cannot be exercised by component-level vitest mocks.

### 3. "+ Add model by ID" end-to-end flow

**Test:** Open "+ Add model by ID", enter `kimi-k3` / provider `moonshot` (observe the capability fields pre-fill amber "default — confirm"), submit, confirm the new row appears **disabled** in the registry table, then enable it from the table.
**Expected:** The row appears disabled immediately after the shell re-fetches (no manual page refresh needed); enabling it from the table uses the existing Phase-149 write path successfully.
**Why human:** End-to-end click-through across two components (form → table) and the post-submit re-fetch/visual-appearance behavior are UX flows that unit tests approximate but do not fully replace.

### 4. Three-way capability source badges are visually distinguishable

**Test:** Compare the green provider-confirmed, amber "default — confirm", and blank amber "unknown — you set it" states side by side on both the add-by-ID form and the discovery hand-fill.
**Expected:** The three states are visually distinct at a glance, consistent with the sketch-findings design direction (070-A/071-A idiom).
**Why human:** Visual/design-fidelity judgment — cannot be verified by grep or DOM-assertion tests alone.

### 5. Add-by-ID and discovery interplay (no duplicate confusion)

**Test:** Add a model by ID, then run Live Discovery and confirm the just-added model no longer appears under "New models". Separately, attempt to add an already-known model id via the form and confirm the 409 "already in the registry" refusal renders in-form.
**Expected:** No duplicate or confusing state between the two entry points; the refusal is visible and readable to the operator.
**Why human:** Requires a live two-surface sequence with real backend state carried between steps.

### Gaps Summary

No code-level gaps were found. Every observable truth, artifact, and key link this phase's plans and the ROADMAP success criteria require was independently verified against the actual codebase — not inferred from SUMMARY.md claims:

- All 4 backend test suites (30 tests) plus the full 146-159 admin/model-registry regression surface (99 tests) were re-run directly and pass.
- The live local database was queried directly (not just trusted from the SUMMARY's claim) — `model_discovery_filter_enabled boolean NOT NULL DEFAULT true` exists and reads `True`.
- `tsc -b` and `vite build` were re-run directly; 0 net-new type errors, deploy build green.
- Security-sensitive claims (SQLi-safety, forced-disabled, case-folded duplicate guard, never-auto-enable) were verified by reading the actual source, not just trusting docstrings — and cross-checked against the actual test assertions to confirm the tests test what they claim.
- A "Chesterton's Fence" check on the pre-existing "accept all new/changed by default" discovery behavior confirmed (via `git show` on the actual diff) that Phase 159 did not alter it — the filter is genuinely display-only, exactly as the SC#3 red line requires.
- An adversarial regression sweep beyond the phase's own test scope surfaced 16 failing tests elsewheere in the backend; each was traced to a root cause with zero overlap with any file phase 159 touched, and confirmed pre-existing (not a phase-159 regression).

The phase is marked `human_needed` rather than `passed` strictly because the phase's own plans (159-05, 159-06) explicitly scope "Live UAT (Chrome MCP)" as part of phase verification, and this covers real external-provider data volume, visual design fidelity, and cross-surface/session-reload behavior that cannot be responsibly asserted from static code analysis alone. Once the 5 human-verification items above are confirmed, this phase is ready for `/gsd:secure-phase` and the MODEL-03 requirement flip.

---

*Verified: 2026-07-18T03:17:33Z*
*Verifier: Claude (gsd-verifier)*
