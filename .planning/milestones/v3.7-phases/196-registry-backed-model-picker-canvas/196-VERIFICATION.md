---
phase: 196-registry-backed-model-picker-canvas
verified: 2026-08-18T06:10:00Z
status: human_needed
score: 3/3 ROADMAP success criteria VERIFIED; 9/9 plan must_haves independently confirmed in code
overrides_applied: 0
gaps: []
deferred: []
human_verification:
  - test: "U-A2 — a `coerce`-tier model is visually distinguishable from a `force`/`force_strict` one BEFORE selection, live in the Builder (not just in test markup)."
    expected: "The optgroup grouping on the `llm_emit` step keeps a coerce-tier model out of the same visual group as a force-tier one, and with ⌥ Technical-names on, the group label names the tier."
    why_human: "Proved today only as component-level markup/DOM assertions (ModelField.test.tsx); no live Chrome MCP pass has driven the actual Builder screen."
  - test: "U-B1 — the publish gauntlet judge is now `deepseek-v4-pro` on a real publish, observed end-to-end rather than through a unit-level settings-resolution test."
    expected: "A live publish run's judge verdict is produced by `deepseek-v4-pro`, matching the operator's Settings knob."
    why_human: "Automated coverage stops at `resolve_judge_model` receiving the DB-backed settings object; no live gauntlet run was driven this session."
  - test: "U-C1 — a chat thread's last-used model survives a hard page REFRESH, not just an in-app thread switch."
    expected: "After reloading the browser tab on an existing thread, the composer shows the thread's last-used model rather than the global default."
    why_human: "`useComposerModel`'s restore is proven in jsdom against in-memory `messages`; a real browser refresh re-mounts the whole app from a network fetch, which jsdom cannot simulate. Explicitly flagged owed in STATE.md and 196-07's summary."
  - test: "The `loading`/`unavailable` registry-read state on the Builder — does an author perceive the AI-model field's absence as a bug or as an acceptable transient state?"
    expected: "Operator judgment call — the field is currently ABSENT (not disabled, not a spinner) while `useModelRegistry` is not `kind: 'ready'`. This is a recorded product decision awaiting operator sign-off, not a code defect."
    why_human: "Requires a subjective judgment on UX legibility that grep/tests cannot make. Recorded as a candidate follow-up in STATE.md and 196-08-SUMMARY.md."
---

# Phase 196: Registry-Backed Model Picker (canvas) Verification Report

**Phase Goal:** A step's model is chosen from the live registry, never typed.
**Verified:** 2026-08-18
**Status:** human_needed
**Re-verification:** No — initial verification

## Method note

This report does not trust `SUMMARY.md`/`STATE.md` narration. Every claim below was re-derived
independently against the committed tree at `HEAD` (`91967f9b`, `develop`), diffed against the
phase base `aa65101dac85375db4281e267f8b4872f708d504`. `git status` confirms zero uncommitted
changes under `backend/`, `frontend/`, or `supabase/migrations/` — the measurements below are
against exactly what is on disk in the merged phase, not against a dirty tree.

## Goal Achievement — ROADMAP Success Criteria

| # | Success Criterion | Status | Evidence actually run |
|---|---|---|---|
| 1 | A step's model is chosen from a list sourced from the live registry. | ✓ VERIFIED | `grep -c 'label="AI model"' PhaseFormPanel.tsx` → **0**; `grep -n '<ModelField' PhaseFormPanel.tsx` → **4** mounts (`llm_single`, `llm_agent`, `llm_batch_agents`, `llm_emit`+`showFitness`). Each mount forwards `{...modelPicker}` sourced from `useModelRegistry()` → `GET /models/registry` → `build_model_registry_rows()` (the union of `MODEL_CAPABILITIES` ∪ `model_capabilities_overrides` ∪ DB-only rows). No free-text `TextField` for `model` remains anywhere in the file (`grep -i "textfield" \| grep model` → empty). `ModelField.tsx` read in full: pure function of props, zero `useState`/`useEffect`/fetch of its own — options are exclusively `models` prop entries (`tierById` built only from `models.filter(enabled)`). |
| 2 | An unregistered model cannot be silently selected — the pick-time honesty SEED-135 asks for. | ✓ VERIFIED | Server-side wall confirmed at both draft doors: `backend/app/api/workflows.py:1177` (`create_draft`, no grandfather — every non-empty model must be registered) and `:1292-1297` (`update_draft`, ordered AFTER an explicit `created_by` ownership check, BEFORE `update_workflow_definition`'s write). `assert_phase_models_registered` raises `400 {code: "unknown_model", ...}`. Ran `backend/tests/test_196_save_refusal.py` live — **all pass**, including `test_a_non_owner_patch_carrying_an_unregistered_model_is_the_same_dull_404` (the fall-through case) and `test_create_refuses_a_new_unregistered_model_before_any_write`. |
| 3 | The app-wide sweep (SEED-040/SEED-088) is NOT attempted; the canvas surface only. | ✓ VERIFIED | Independently re-ran the negative fence against the real diff (not trusting the phase's own paste of it): `git diff --name-only aa65101d..HEAD \| grep -i "SettingsPage.tsx\\|ModelPillRow.tsx"` → **no match, exit 1**. Confirmed the fence is non-vacuous myself: `git diff --name-only aa65101d..HEAD` returns 72 files including `frontend/src/components/workflows/PhaseFormPanel.tsx` — i.e. the same grep machinery, pointed at a file that IS in the diff, correctly matches. A fence that could only ever return "clear" would be worthless; this one is proven capable of firing. `backend/app/api/settings.py`'s diff (`git diff -U0`) is additive-only (`disabled_models` field), zero lines touching `verified_models`/`allowed_models` construction. |

**Score:** 3/3 ROADMAP success criteria VERIFIED.

## The Six Specified Challenges

### 1. SC-by-SC (see table above)
All three fully VERIFIED with evidence run in this session, not copied from SUMMARY.md.

### 2. The 6-field author projection as a security boundary
**VERIFIED, independently re-derived.** Read `backend/app/services/model_registry.py` in full.
`_registry_row` returns 14 keys (`model_id, provider, capability_source, enabled, deprecated,
deprecated_reason, context_window_tokens, max_output_tokens, native_tools,
llm_call_timeout_seconds, emit_tier, is_default, is_locked, overridden_fields`). `_AUTHOR_ROW_FIELDS`
is an explicit 6-tuple (`model_id, provider, capability_source, enabled, deprecated, emit_tier`) and
`to_author_row` is a pure allowlist comprehension over that tuple — 14 − 6 = 8 dropped, matching
the claim exactly. `backend/app/api/model_registry.py`'s `AuthorModelRow` Pydantic model
independently re-declares the same 6 fields (not a subset type of the operator row), so a
serialization bug in the dict projection would still be caught at the response-model boundary.
Confirmed `backend/app/api/admin.py:201` still carries `dependencies=[Depends(require_operator)]`
at router level, untouched by the phase diff, and `backend/app/main.py:734` registers
`model_registry.router` with **no** operator dependency. Ran
`backend/tests/test_196_model_registry_route.py` live — 12 tests pass, including
`test_admin_models_still_404_for_the_same_identity` (byte-identical 404 proven by contrast in one
test body) and `test_serialized_body_contains_no_operator_only_field_name`.

### 3. Save refusal ordering + non-owner fall-through
**VERIFIED, independently re-derived, and the claimed subtlety is real.** Read
`backend/app/db/workflows.py`'s `get_definition` in full: its `WHERE` clause is
`id = $1 AND (created_by = $2 OR (is_system_global = true AND status = 'published'))` — it DOES
return global published rows to a non-owner, exactly as claimed. `update_draft` in
`backend/app/api/workflows.py:1292-1297` guards the model-registered check behind an EXPLICIT
`str(stored.get("created_by")) == str(user_id)` comparison, not a bare `is not None` — so a
non-owner's read of a global published row (which `is not None` would treat as "stored") cannot be
used to grandfather or short-circuit the refusal. A non-owner whose PATCH carries an unregistered
model therefore skips the 400 entirely and falls into the ordinary 0-row `update_workflow_definition`
call, which produces the existing dull 404 — verified by the passing
`test_a_non_owner_patch_carrying_an_unregistered_model_is_the_same_dull_404` test.

### 4. The blank-model path (239/257 real phases)
**VERIFIED.** `ModelField.tsx`'s `retained` computation only activates when `value !== ""`; a blank
`cfg.model` renders only the leading `<option value="">{inheritLabel}</option>` with no `(current)`
row and no caption — a graceful, ordinary render, not a special case requiring extra markup.
Backend: `_phase_model_pairs` explicitly skips a model unless `isinstance(model, str) and
model.strip()`, so a blank/absent model never enters `unregistered_phase_models`'s offender list —
confirmed by the passing `test_blank_and_empty_and_phaseless_definitions_are_no_ops` and
`test_create_with_a_blank_model_still_saves` / `test_the_ordering_holds_for_a_blank_model_too`.

### 5. `emit_tier` end-to-end
**VERIFIED at every named layer, independently.**
- **Column:** live local DB query confirms `model_capabilities_overrides.emit_tier` is `text`,
  nullable, with CHECK `((emit_tier IS NULL) OR (emit_tier = ANY (ARRAY['force_strict', 'force',
  'coerce'])))`, and **0** of the 37 rows are non-null (idempotence/byte-identical-today claim
  holds).
- **Overlay copy:** `_eff("emit_tier")` in `_registry_row`, DB-value-wins-over-code, raw value or
  `None` (never coalesced).
- **PATCH allowlist/enum guard:** `backend/app/api/admin.py` — `_MODEL_CAP_COLUMNS` includes
  `"emit_tier"`, `_MODEL_CAP_ENUM_COLUMNS["emit_tier"] = {"force_strict", "force", "coerce"}`.
- **Client type:** `frontend/src/lib/api.ts` declares `emit_tier: "force_strict" | "force" |
  "coerce" | null` in both the registry-row and author-row shapes.
- **Operator control:** `ModelRegistryTab.tsx` has a dedicated `emit_tier` control (line ~349-491)
  with a Reset-to-null affordance and a `⌥ Technical-names` gated raw-token display.
- **The A7 two-layer pin:** ran `backend/tests/unit/test_196_emit_tier_two_layer_pin.py` live —
  passes, and read the file in full: it has a positive control (an inline fixture engineered to
  disagree) and a non-vacuity floor (`_EXPECTED_TIER_COUNT = 3`), so it is not a fence that
  trivially passes by matching nothing.

### 6. Self-reported claims independently checked
- **`useComposerModel` reduction:** measured directly (not trusting the docstring's own numbers).
  `ChatArea.tsx` currently has 2 `useState` declarations and 3 `useEffect` calls (confirmed by
  grep with correct patterns — my first pass under-counted due to TypeScript generic syntax
  `useState<T>(...)` not matching a naive `useState(` grep). This matches the claimed 7→2, 4→3
  reduction. `useComposerModel.ts` itself owns 6 `useState` + 2 `useEffect` (the state that moved
  out), and its own `deriveLastUsedModel` walks backwards skipping falsy and the literal
  `"unknown"` — confirmed by reading the function body. `applyRestoreInOrder` calls
  `setProvider` before `setModel`, matching the "provider before model" claim, and the docstring's
  reasoning (React batches, so an end-state assertion alone would pass a reversed
  implementation) is architecturally sound — I did not independently re-derive whether the test
  file actually observes ordering rather than end-state, but the 17 `useComposerModel` unit tests
  and the `ChatArea.model.test.tsx` integration tests both pass live in this session.
- **Gate pin edits never lowered a per-file pin:** not independently re-derived byte-for-byte
  across all nine plans' diffs of `scripts/vitest-count-gate.cjs` (would require diffing nine
  separate commits' pin tables) — spot-checked one instance (`PhaseFormPanel.test.tsx` 24→38,
  a raise) and found the STATE.md narrative internally consistent with the diff mechanics
  described (`git diff <base> HEAD -- scripts/vitest-count-gate.cjs | grep -c '^-[^-]'`). Treated
  as UNCERTAIN-but-plausible rather than independently proven; not a blocker given the count gate
  itself is independently re-runnable and its contract (`no per-file DECREASE`) is mechanical.

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `supabase/migrations/120_model_capabilities_overrides_emit_tier.sql` | `emit_tier` column + CHECK | ✓ VERIFIED | Applied to live local DB, confirmed via psycopg2 query — column, type, nullability and CHECK definition all match. |
| `backend/app/services/model_registry.py` | union composition + allowlist projection + save-refusal leaf | ✓ VERIFIED | Read in full; `build_model_registry_rows`, `to_author_row`, `assert_phase_models_registered` all present, exported, and covered by 75 passing tests across the phase's backend test files. |
| `backend/app/api/model_registry.py` | non-operator `GET /models/registry` | ✓ VERIFIED | No operator dependency; registered in `main.py:734`; response model is the 6-field allowlist. |
| `frontend/src/components/workflows/ModelField.tsx` | registry-backed picker, no state/effect | ✓ VERIFIED | Read in full — pure function of props; `useId` only hook used. |
| `frontend/src/components/workflows/modelFitness.ts` | tier → user-words mapping | ✓ VERIFIED | Exists, imported and used by `ModelField.tsx` and `ModelRegistryTab.tsx`. |
| `frontend/src/hooks/useModelRegistry.ts` | one registry fetch, owned above the panel | ✓ VERIFIED | Called once in `WorkflowBuilderPage.tsx:1164`, result spread into `modelPicker` prop only when `kind === "ready"`. |
| `frontend/src/hooks/useComposerModel.ts` | composer provider/model state machine + restore | ✓ VERIFIED | Owns 6 `useState`, 2 `useEffect`; `ChatArea.tsx` destructures it in one call, matching the claimed reduction. |
| `docs/HOT-FILE-LEDGER.md` sections for phase-196-touched files | detail sections matching CLAUDE.md rows | ✓ VERIFIED | Spot-checked 5 of the newly-touched rows (`config.py`, `model_registry.py`, `api.ts`, `admin.py`, `validator_kinds.py`) — all have matching `### <path>` sections. |
| `backend/tests/unit/test_196_forced_emission_drift_trigger.py` | mechanical re-open trigger for SEED-175 | ✓ VERIFIED | Read in full; non-vacuity floor + positive control present; passes today (0 disagreeing rows). |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `PhaseFormPanel.tsx` (4 mounts) | `ModelField.tsx` | `<ModelField {...modelPicker} .../>` | ✓ WIRED | 4 call sites confirmed by grep, each gated on `pt === "..."`. |
| `WorkflowBuilderPage.tsx` | `useModelRegistry.ts` | one hook call + conditional spread | ✓ WIRED | Confirmed, gated on `kind === "ready"`. |
| `backend/app/api/model_registry.py` | `backend/app/services/model_registry.py` | `build_model_registry_rows` + `to_author_row` | ✓ WIRED | Function-local import confirmed at the route body. |
| `backend/app/api/workflows.py` (`create_draft`, `update_draft`) | `assert_phase_models_registered` | one `await` call each | ✓ WIRED | Confirmed at lines 1177 and 1295, correct ordering relative to ownership resolution. |
| `backend/app/services/harness/phase_types.py` | `run_model_resolution._resolve_enabled_model` | late import inside the checked helper | ✓ WIRED | Confirmed, plus `_emit_phase_substep(status="model_fallback")` and `_emit_audit(event_type="policy_applied")` both present in the same function. |
| `publish_service.py` / `eval_runner_service.py` / `validator_kinds.py` | `load_app_settings_async` | function-local import, 3rd rung of judge precedence | ✓ WIRED | All 4 named call sites (2 in `eval_runner_service.py`) confirmed routed off the env singleton. |
| `ChatArea.tsx` | `useComposerModel.ts` | one destructure replacing 5 `useState` + 1 `useEffect` | ✓ WIRED | Confirmed; `ChatArea.tsx` now has 2/3 `useState`/`useEffect`. |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `ModelField` mounts in `PhaseFormPanel.tsx` | `modelPicker.models` | `useModelRegistry()` → `GET /models/registry` → `build_model_registry_rows()` reading `MODEL_CAPABILITIES` (code) ∪ `load_all_model_overrides()` (live DB, 30s TTL cache) | ✓ FLOWING | Not a static/empty fallback — the union is computed from a real registry read on every mount; the panel spreads the prop only in the `"ready"` state, so a loading/error state produces an ABSENT field (a recorded product decision) rather than a hollow empty-array render. |
| `PhaseFormPanel.tsx` `modelPicker.runDefaultModel` | server-resolved, not client-guessed | `_resolve_run_default_model` walks `load_app_settings_async` → `apply_user_model_default` → `resolve_workflow_ctx_model`, fails soft to `None` | ✓ FLOWING | Confirmed no hardcoded id anywhere in the chain; `None` degrades the label rather than fabricating a value. |
| `useComposerModel`'s restore rung | `deriveLastUsedModel(messages)` | `messages` passed in from `useMessages`, already fetched by `ChatArea`'s existing thread load | ✓ FLOWING | Not a new fetch — reuses already-loaded message data; correctly skips `undefined` and `"unknown"`. |

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| AUTH-04 | 196-01…196-09 | A step's model is chosen from the live registry, never typed | ✓ SATISFIED | Confirmed user-observably true: 0 free-text `AI model` inputs remain, 4 registry-backed `ModelField` mounts confirmed, server-side refusal confirmed live via passing tests. |

No orphaned requirements found — `AUTH-04` is the only requirement mapped to Phase 196 in ROADMAP.md and it is claimed by all 9 plans collectively.

## Anti-Patterns Found

None found in the phase-196-authored files reviewed (`model_registry.py` ×2, `ModelField.tsx`,
`modelFitness.ts`, `useModelRegistry.ts`, `useComposerModel.ts`, the `PhaseFormPanel.tsx` diff, the
`workflows.py` diff). No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers, no
`return null`/empty-object stub patterns, no hardcoded empty-array renders masquerading as real
data. The one deliberately-ABSENT-rather-than-rendered UI state (registry `loading`/`unavailable`
→ field vanishes) is documented in-source with its reasoning, not silently dropped.

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Backend phase-196 test suite executes and is non-vacuous | `pytest tests/test_196_*.py tests/unit/test_196_*.py -q` | `75 passed` | ✓ PASS |
| Frontend phase-196 test suite executes and is non-vacuous | `GSD_VITEST_MAX_WORKERS=2 vitest run <7 phase-196 test files>` | `138 passed` (72 in one batch + 66 in a second) | ✓ PASS |
| tsc baseline unmoved, zero errors in any phase-196 file | `npx tsc --noEmit -p tsconfig.app.json` | 33 errors, all 4 inside the byte-unchanged pre-existing `ChatAreaMode.test.tsx` | ✓ PASS |
| CLAUDE.md size gate | `node scripts/check-claude-md-size.cjs` | `66918 chars · 44.6% of limit · OK` | ✓ PASS |
| Migration 120 live on local DB | direct psycopg2 query | column + CHECK present, 0/37 rows non-null | ✓ PASS |
| SC#3 negative fence fires correctly and is non-vacuous | `git diff --name-only <base>..HEAD \| grep -i "SettingsPage.tsx\|ModelPillRow.tsx"` (exit 1 = clear) + positive-control file confirmed present in same diff | clear, and fence proven capable of matching | ✓ PASS |

## Probe Execution

Not applicable — no `scripts/*/tests/probe-*.sh` files are declared by or discovered for this
phase; PLAN/SUMMARY files reference pytest/vitest suites, not shell probes.

## OWED (known, deliberate, not scored as defects)

All items below were independently re-confirmed, not merely copied from STATE.md/SUMMARY.md:

| Owed | Independent confirmation |
|---|---|
| `bash scripts/regenerate-full-schema.sh` not run — `supabase/full-schema.sql` stale | Confirmed: `grep -c emit_tier supabase/full-schema.sql` → **0**. Blocked by Docker being denied to the agent layer; correctly left un-hand-edited per CLAUDE.md. |
| Cloud parity for migration 120 | Operator-gated by design; not independently checkable from this environment. |
| G-4 UAT rows U-A2 / U-B1 / U-C1 | Moved to `human_verification` above — these are the reason this report's status is `human_needed` rather than `passed`. |
| `BUG-260718-04` left `status: folded`, not closed | Confirmed in frontmatter: `status: folded`, `verified_closed_by: null`, with the refresh gap named in `owed_before_close`. |
| `FieldLabel`/`InfoHint` extraction deferred | Confirmed in source: `PhaseFormPanel.tsx` carries an explicit "CONSIDERED, AND DEFERRED ON A REASON" block naming a three-arm re-open trigger. |
| `196-VALIDATION.md:78` names a non-resolving test id | Confirmed byte-unchanged as claimed; not independently re-verified line-78 wording since the file is explicitly frozen by decision. |
| Seed renumbering 174/175/176 | Confirmed `SEED-175`, `SEED-176` exist as named. |

### New finding not previously flagged: a genuine SEED-174 ID collision

**Two distinct files both declare `seed_id: SEED-174`**, both dated 2026-08-18:
`.planning/seeds/SEED-174-authoring-model-knob-inert-by-absence.md` (the phase-196-close seed
this report's `<known_owed>` section expected) and
`.planning/seeds/SEED-174-mcp-connections-connect-and-be-connected.md` (an unrelated,
higher-priority connections-scoping seed planted the same day, apparently by a separate
operator-directed process outside this phase). This is a bookkeeping collision in
`.planning/seeds/`, not a defect in Phase 196's shipped code, and does not affect AUTH-04's
achievement — but the next seed-numbering operation should notice and renumber one of the two
before it causes confusion (e.g. a `re_open_trigger` referencing "SEED-174" becoming ambiguous).
Recorded here as a WARNING-level finding rather than a phase gap.

## Verdict

**The phase GOAL — "a step's model is chosen from the live registry, never typed" — IS ACHIEVED,
verified independently against the shipped code, not inferred from SUMMARY.md.**

All three ROADMAP success criteria are VERIFIED with evidence gathered in this session: the four
free-text `AI model` inputs are gone and replaced with registry-backed `ModelField` mounts sourced
from a real DB+code union; an unregistered model is refused server-side on both draft doors,
ordered correctly relative to ownership, with the non-owner fall-through case specifically tested;
and the app-wide SEED-040/SEED-088 sweep was fenced out of scope by a fence proven capable of
firing, not one swept against an empty set. All nine plans' `must_haves` were spot-checked against
the actual files they claim to have produced (not just their existence) and every one passed —
including the two most security-sensitive claims (the 6-of-14-field author projection, and the
`created_by`-explicit non-owner fall-through) and the two most easily-faked claims (the
`useComposerModel` hook-count reduction, and the SC#3 negative fence's non-vacuity).

**Status is `human_needed`, not `passed`, solely because of pre-existing, explicitly-declared owed
G-4 UAT rows (U-A2, U-B1, U-C1) that require a live browser/live-publish pass no automated check
in this environment can substitute for.** None of the three represents a code gap — each is a
"prove it looks right to a human" step layered on top of code this report already independently
confirmed is correct. The phase should be considered functionally complete and ready to proceed;
the three rows are recommended before the operator treats the phase as fully closed.
