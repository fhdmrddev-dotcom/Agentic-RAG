# Phase 074: SEED-009 + SEED-011 Polish Bundle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 074-seed-009-seed-011-polish-bundle
**Areas discussed:** Clamp breadth, Two output-token tables, BUG-260514-02 routing, Test fixture hoist

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Clamp breadth (Anthropic-only vs all providers) | Where to enforce the new max_tokens clamp | ✓ |
| Two output-token tables: keep both or consolidate? | `_MODEL_OUTPUT_DEFAULTS` (practical default) vs `MODEL_CAPABILITIES.max_output_tokens` (hard cap) | ✓ |
| Fold BUG-260514-02 (Anthropic narration vs summary)? | Same provider neighborhood, different root cause | ✓ |
| Test fixture: paste-only or hoist to shared conftest.py? | SEED-011 fix mechanics | ✓ |

**User selected all four areas.**

---

## Area 1: Clamp breadth

### Q1: Where should the new `_clamp_max_tokens` enforce the hard API cap?

| Option | Description | Selected |
|--------|-------------|----------|
| All providers via _resolve_max_tokens | Single chokepoint inside `openai_service._resolve_max_tokens`; clamp via `min(requested, MODEL_CAPABILITIES[model]["max_output_tokens"])` | ✓ |
| Anthropic-only in anthropic_service.py | Matches SEED-009 Path 1 literally; ~5 LOC at the call site | |
| Both — universal at _resolve + Anthropic-side defense | Belt + suspenders; more LOC, more places to maintain | |

**User's choice:** All providers via _resolve_max_tokens
**Notes:** Future-proofs OpenAI / Google / OpenRouter at zero extra LOC since `_resolve_max_tokens` is already the shared chokepoint for every provider's max_tokens decision.

### Q2: When the user picks a model that's NOT in MODEL_CAPABILITIES, what should the clamp do?

| Option | Description | Selected |
|--------|-------------|----------|
| Pass-through unchanged | No clamp on unknown model; mirrors `get_per_call_timeout` fallback | ✓ |
| Log warning + apply conservative cap (16384) | Defensive; warns + clamps to 16384 | |
| Hard fail (raise ValueError) | Forces every model to be registered; high friction | |

**User's choice:** Pass-through unchanged
**Notes:** The bug class only fires when a registry value EXISTS and is wrong; missing-entry case is genuinely unknown so guessing a cap would create a worse problem (silent output truncation for legitimate new models).

### Q3: Should the clamp emit a log line when it actually trims a value?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — logger.info on clamp | `logger.info("clamped max_tokens for model=%s: %d -> %d", model, requested, cap)` | ✓ |
| No — silent clamp | Just clamp and continue | |
| Warning level instead of info | logger.warning so it shows up in default log filters | |

**User's choice:** Yes — logger.info on clamp
**Notes:** Identifier-only format mirrors Phase 073 T-073-04 precedent — no token-value leak risk. Info level avoids alarm fatigue on routine clamps while still giving operators a breadcrumb for settings drift.

### Q4: More questions or next area?

**User's choice:** Next area

---

## Area 2: Two output-token tables

### Q1: How should the two layers coexist?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both — separate concerns | `_MODEL_OUTPUT_DEFAULTS` = practical default; `MODEL_CAPABILITIES.max_output_tokens` = hard cap | ✓ |
| Consolidate into MODEL_CAPABILITIES.max_output_tokens | Delete `_MODEL_OUTPUT_DEFAULTS`; one source of truth | |
| Move _MODEL_OUTPUT_DEFAULTS into MODEL_CAPABILITIES as a second field | Both fields in one registry; max clarity but more LOC | |

**User's choice:** Keep both — separate concerns
**Notes:** Two-layer model preserves the conceptual split: "what we request by default" vs "what the API refuses to exceed." Zero behavior change in nominal cases.

### Q2: Which Anthropic per-model values should `max_output_tokens` carry?

| Option | Description | Selected |
|--------|-------------|----------|
| Per SEED-009 (docs-verified, 2026-05) | opus-4-7=32000, sonnet-4-6=64000, haiku-4-5-20251001=64000 | ✓ |
| Verify-then-apply during execute | Don't lock numbers in CONTEXT.md; planner pulls at execute time | |

**User's choice:** Per SEED-009 (docs-verified, 2026-05)
**Notes:** Values written into CONTEXT.md as the starting point; planner re-verifies at plan time and surfaces drift as a Rule-1 deviation if Anthropic has changed caps between 2026-05-09 (SEED-009 authored) and 2026-05-17 (Phase 074 plan time).

### Q3: OpenAI / OpenRouter / Google coverage — same as Anthropic?

| Option | Description | Selected |
|--------|-------------|----------|
| Same coverage (all currently-listed models) | Populate every entry in MODEL_CAPABILITIES (26 models) | ✓ |
| Anthropic-only — minimum to close the bug | Only the immediate offender (haiku-4-5) | |

**User's choice:** Same coverage (all currently-listed models)
**Notes:** Matches SC#1 ROADMAP wording verbatim; future-proofs all four providers. Per-provider vendor doc verification at plan time.

### Q4: More questions or next area?

**User's choice:** Next area

---

## Area 3: BUG-260514-02 routing

### Q1: Fold or defer?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer — separate phase later | Different root cause; spin as 075.1 or fold into v2.7 | ✓ |
| Fold — Anthropic polish bundle | Phase 074 becomes "Anthropic polish bundle"; ~3x LOC | |
| Investigate-only in Phase 074 | Read-only audit; decide fold/defer based on findings | |

**User's choice:** Defer — separate phase later
**Notes:** Different fix surface (system-prompt / agent-loop terminal frame OR frontend block-ordering), would cross backend↔frontend boundary, double phase size. Re-open trigger set to "Phase 075 polish bundle planning OR any system-prompt redesign touching anthropic_service.py / threads.py agent loop terminal frame OR v2.7 Agent Workspace milestone planning."

---

## Area 4: Test fixture hoist

### Q1: How should `_reset_redis_singleton` land?

| Option | Description | Selected |
|--------|-------------|----------|
| Hoist to backend/tests/integration/conftest.py | Single autouse fixture; delete 2 local copies (062, 063); SEED-011 fix becomes the hoist itself | ✓ |
| Paste-only into test_059_disconnect.py | Match SEED-011 verbatim; 3 copies across 3 files | |
| Hoist + add Phase 073 `_reset_pg_pool_singleton` to the same conftest | Consolidate both singleton-reset fixtures; mild scope creep | |

**User's choice:** Hoist to backend/tests/integration/conftest.py
**Notes:** Future integration tests inherit Redis-singleton-reset protection automatically. Drift risk across 3 local copies eliminated. Phase 073's pg-pool fixture is left untouched per scope discipline.

### Q2: Should we run a no-regression sweep of test_058 / test_062 / test_063 / test_059?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — all four files green is a phase ship gate | `pytest test_058 test_059 test_062 test_063 -q` all-green required | ✓ |
| test_059 only — minimum gate | Just SC#4 (3/3 PASS on test_059_disconnect.py) | |

**User's choice:** Yes — all four files green is a phase ship gate

### Q3: If `_reset_sse_starlette_app_status` is also relevant to other test files, should we hoist it too?

| Option | Description | Selected |
|--------|-------------|----------|
| Leave it local to test_059 | Preserves pinned-version assertion + existing cross-import from test_062 | ✓ |
| Hoist both fixtures to conftest.py | Symmetric; changes import paths in test_062 | |

**User's choice:** Leave it local to test_059
**Notes:** sse-starlette fixture has a pinned-version assertion (`sse_starlette.__version__.startswith("2.4.")`); already cross-imported by test_062. Don't disturb a working pattern.

### Q4: Ready to create context, or explore more gray areas?

**User's choice:** Create context

---

## Claude's Discretion

- Registry key shape (full model IDs like `"claude-haiku-4-5-20251001"`, NOT family stems like `"claude-haiku-4-5"`) — SEED-009's family-stem `rsplit` suggestion rejected to match existing MODEL_CAPABILITIES key shape and disambiguate Anthropic model-snapshot releases.
- Plan split: Plan 01 = SEED-009 (registry + clamp + log + unit + UAT); Plan 02 = SEED-011 (conftest hoist + local-copy delete + 4-file regression sweep). Independent plans, parallel-able.
- Unit-test parametrization for SC#2: three cases (under cap, at cap, over cap) — assert clamp behavior + log line.
- Live UAT (SC#3) mechanics: drive via chat UI at localhost:5173 (test login per `reference_local_dev_app.md`); haiku-4-5 prompt + temporary `MODEL_OUTPUT_LIMITS` override to force the clamp path; verify backend `clamped max_tokens` info line + `runs.status='completed'`. Chrome DevTools MCP available for automation.
- Code-review depth: quick (matches Phase 065 / 073 polish-phase precedent).

## Deferred Ideas

- BUG-260514-02 (Anthropic narration vs synthesized summary) — frontmatter updated to `status: deferred` by this discussion.
- Consolidate `_MODEL_OUTPUT_DEFAULTS` into MODEL_CAPABILITIES — rejected per D-074-05 / D-074-06; eventual unification owned by Phase 081.1 / SEED-024.
- Hoist `_reset_pg_pool_singleton` alongside `_reset_redis_singleton` — rejected per D-074-13 (Phase 073 scope).
- Hoist `_reset_sse_starlette_app_status` — rejected per D-074-12 (sse-starlette-specific, already cross-imported).
- Per-provider `_clamp_max_tokens` helpers — rejected per D-074-04 (single chokepoint covers all).
- Hard-fail on unknown-model clamp request — rejected per D-074-02 (preserves ad-hoc model experiments).
