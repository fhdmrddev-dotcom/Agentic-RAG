# Phase 102: Reusable Validation-Gate Library + Output-Quality Gate - Research

**Researched:** 2026-06-12
**Domain:** Workflow harness validation gates + LLM-as-judge output-quality publish gate (Python/FastAPI backend, raw provider SDKs, Pydantic strict models)
**Confidence:** HIGH (the substrate is shipped and fully read in this session; the open design surface is field-naming + module-layout, not new mechanics)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** 102 ships the **full policy enum engine-side**: `citation_policy: strict | flag | partial | draft` on the `llm_emit` phase config (strict = today's behavior, stays DEFAULT, strict path byte-identical) + the judge verdict disposition designed in the **same vocabulary** + the F3 integrity sibling `strict | documented_limit`. **No builder UI** — 103 asks the plain-language question. Per-run overrides and one-click failure-UX actions are explicitly deferred. SEED-082 semantics: `flag` = always deliver WITH visible marks + coverage summary; `partial` = blank uncited values (null-over-invent), deliver + gap list; `draft` = no citation enforcement, doc visibly labeled DRAFT. Every non-strict mode marks or blanks — never silent pass-off.
- **D-02:** A run-time judge failure rides the **standard gate loop** — bounded retry ≤3 with the judge's critique fed back into the prompt, then the declared policy decides: `strict` → honest fail with receipt; `flag` → deliver WITH the judge's verdict surfaced visibly. One policy family governs both the citation gate and the judge gate. No new engine machinery.
- **D-03:** The judge model is a **designated model in `app_settings`** (settings-not-env), defaulting to a strong TIER-FORCE-capable model, **independent of the run model** — no self-judging. Per-workflow override allowed but optional.
- **D-04:** The rubric is **stored explicitly in the workflow definition** (`llm_judge_rubric` validator config), frozen on publish: a **standard core** (grounded in the evidence? actually answers the `business_requirement`? did the work rather than delegating back to the user? — the SEED-050 failure modes) + the `business_requirement` woven in + author-extensible criteria. 103's NL authoring auto-drafts it. Inspectable + immutable.
- **The judge verdict is itself a forced emission** via the 101.1 `forced_emit` seam — cross-provider tiering, narrated-JSON recovery, truncation rejection, and honest failure all inherited.
- **D-05:** The golden run is a **real end-to-end `workflow_run`** against the project KB — author-supplied golden input, executed by the real engine, **flagged as a validation run** — judge grades the final output against rubric + `business_requirement`. Verdict-with-evidence persists as receipts. **No mocks**, **no opt-out** (HARD blocker).
- **D-06:** Passing = **rubric-based** (judge passes + structural gates pass on that run). **No automatic comparison to stored expected output**. The golden run's **output snapshot IS persisted** with the receipts as a human-inspectable reference artifact.
- **D-07:** 102 ships the **server-side publish path**: `POST /workflows/{id}/publish` is the ONLY way a draft becomes published, enforcing in order: structural lint (`reachability.py`) → golden run → judge verdict → flip to published. 103's page is just a client.
- **D-08:** A blocked publish returns a **structured verdict**: which stage blocked, named failures, and the `workflow_run` id of the golden run. Machine-renderable for 103. The blocked attempt writes an audit receipt.
- **D-09 (operator-directed, library-wide principle):** **No library validator is mandatory.** The library is a menu, never an auto-imposed checklist. Free-form workflows (financial-report analysis over a scoped folder, tool-driven, NO template, PDF output, loosely structured) attach zero or few gates. Only the QUAL-01 publish gate stays mandatory — and its **rubric adapts to the workflow's declared `business_requirement`**. Consequences: `structure_check` gets a **loose mode**; `output_file_valid` is **format-aware** (PDF-ready).
- **Freshness semantics:** opt-in. Two deterministic checks against the workflow's KB scope: (1) **stale sources** — newest relevant document older than a per-workflow `max_age_days` (author sets it, NO global default); (2) **version ambiguity** — deterministic v1 only: app version history (superseded versions) + exact-stem filename collisions. Semantic duplicate detection deferred.
- **D-10:** A generic **`timing: pre | post` field on the validator spec** (default `post` — every existing gate byte-unchanged). A `pre` validator runs BEFORE the phase body, checking inputs/scope. Freshness is the first `pre` validator; the seam is generic (Phase 105 budget caps reuse it).
- **D-11:** **`ask_user` becomes a generic fourth `on_failure` disposition** (`fail_run` / `retry` / `skip_to_phase` / `ask_user`). The engine pauses via the existing Phase 085 `ask_user_service`, presenting the validator's structured finding as choices. **Proceed** continues with the choice written as an audit receipt. **Abort** → honest `fail_run`. Unanswered inherits ask_user expiry → honest fail.
- **D-12:** The 5 library validators are **first-class kinds in the closed `VALIDATOR_REGISTRY`** — thin wrappers over existing primitives: `citations_required` wraps `check_coverage`; `output_file_valid` wraps `assert_integrity` (format-aware); `structure_check` builds on `json_schema` + loose mode; `llm_judge_rubric` rides `forced_emit`; `freshness` is net-new.
- **D-13:** `business_requirement` is an **additive-optional field on `WorkflowDefinition`** (zero migration). **Optional on drafts, required at publish** — the D-07 endpoint refuses a draft with no declared `business_requirement`. Free text, one sentence.
- **D-14 (v1 cut lines):**
  - `citations_required`: **deterministic mode on emit outputs** (wraps `check_coverage`) + a **simple presence mode for text outputs** (at least N citation markers, configurable). "Every claim is cited" on prose belongs to the judge.
  - `structure_check` loose mode: **named sections/headings present** (author lists them; gate checks each appears) — order-insensitive, extra sections allowed. "Sections are well-developed" → judge rubric.

### Claude's Discretion

- Receipt event-type names + the `harness_audit` CHECK migration shape (follow the 101.1 migration-069 ALTER pattern; likely new kinds for judge/publish/policy/ask_user-approval events).
- Module layout: grow `validators.py` vs. sibling modules under `harness/`; where the publish service lives relative to `api/workflows.py`.
- Exact field naming for the policy enum + `timing` + golden-input storage on the definition; the golden-run flag mechanics on `workflow_runs`.
- Judge prompt shape and the judge's emit schema (a forced emission — flat per D-09/101.1 rules: shallow, `additionalProperties:false`, citation-as-sibling).
- How `flag`/`partial`/`draft` render their marks (inline suffix vs appendix table; DRAFT watermark mechanics) — within SEED-082's "marks or blanks, never silent" rule.

### Deferred Ideas (OUT OF SCOPE)

- **Free-form PDF-with-charts emitter** → Phase 106 (102 only ensures `output_file_valid` is format-aware so it slots in).
- **Per-run policy override** → Phase 103 (per-run override UP draft→strict always safe).
- **One-click failure-UX actions** ("Retry with [strong model]" / "Deliver as draft anyway" / "Show what's missing") → run-surface work.
- **Builder model-fit warnings + capability badges** → Phase 103, data-backed by EVAL-01.
- **Semantic duplicate detection** for freshness ("draft" vs "final") → knowledge-health family.
- **`threshold(N%)` citation policy** — YAGNI v1; `flag`/`partial` cover the need.
- **Org/admin policy floor** → Phase 107 governance.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **GATE-01** | A reusable library of validator kinds available to any phase, each riding the existing gate + bounded-retry loop: `citations_required` (deterministically reject uncited register rows before any judge call), `freshness` (a guaranteed-first "check the date first" preflight that branches to `ask_user` on stale/multiple versions), `structure_check`, `output_file_valid` (re-open the produced file), `llm_judge_rubric`. | The closed `VALIDATOR_REGISTRY` + `register_validator` decorator already exist (`validators.py`); 5 new kinds = new ENTRIES, not new engine. Primitives `check_coverage` / `assert_integrity` / `forced_emit` / `json_schema` exist. `timing: pre` (D-10) and `ask_user` 4th disposition (D-11) are the only two new engine seams; both are thin additions to `_run_phase_with_gates` / `_parse_on_failure`. See §Standard Stack, §Architecture Patterns, §Code Examples. |
| **QUAL-01** | A workflow declares exactly one `business_requirement`; an `llm_judge` output-quality gate + a publish-time golden run are a HARD publish blocker — a structurally-lint-clean workflow that produces bad output cannot publish. (NL-authoring MUST NOT ship without this.) | `business_requirement` = additive-optional `WorkflowDefinition` field (D-13, zero migration). The `POST /workflows/{id}/publish` endpoint (D-07) joins the existing `api/workflows.py` router; lint via `lint_workflow` (`reachability.py`); golden run reuses `create_workflow_run` with a validation flag; the publish-flip is allowed by the `workflow_definitions_block_published_update` trigger because `OLD.status='draft'`. Judge rides `forced_emit`. See §Architecture Patterns Pattern 3-5, §Runtime State Inventory, §Security Domain. |
</phase_requirements>

---

## Summary

Phase 102 is **~85% composition of shipped substrate**, not new runtime. Every load-bearing mechanic already exists and was read in full this session: the closed `VALIDATOR_REGISTRY` + `register_validator` decorator + ordered `run_gates` fan-in (`validators.py`); the bounded-retry ≤3 + critique-feedback + `on_failure` routing loop (`harness_engine._run_phase_with_gates` / `_parse_on_failure` / `_route_on_failure`); the deterministic citation gate `check_coverage` and integrity oracle `assert_integrity` (`template_render_service.py`); the sealed cross-provider forced-emission seam `forced_emit` with tiering/recovery/truncation/honest-failure (`forced_emit.py`); the publish-time structural lint `lint_workflow` (`reachability.py`); the Phase 085 cross-worker pause/resume `ask_user_service`; and the additive-optional Pydantic-over-JSONB discipline (`models/harness.py`).

The genuinely new work is small and well-bounded: (1) **5 new validator registry entries** wrapping those primitives (`citations_required`, `output_file_valid`, `structure_check`, `llm_judge_rubric`, `freshness`); (2) **two thin engine seams** — a `timing: pre|post` field (D-10) that runs a validator BEFORE the phase body, and an `ask_user` fourth `on_failure` disposition (D-11) that calls the existing `ask_user_service`; (3) the **`POST /workflows/{id}/publish` endpoint** (D-07) that orchestrates lint → golden run → judge → flip; (4) the **`citation_policy` enum** (D-01) consumed AFTER the citation/integrity verdict (verdict computation unchanged); and (5) a **migration-069-style `harness_audit` CHECK ALTER** adding the new receipt kinds.

The single highest-risk surface is the **judge-as-publish-blocker correctness** (a gameable or self-judging gate would defeat QUAL-01's whole purpose). The mitigations are already decided: the judge model is independent of the run model (`app_settings`, D-03), the rubric is frozen-on-publish and inspectable (D-04), the golden run is a real run with no mocks/no-opt-out (D-05), and the judge verdict rides `forced_emit` (so a coerce-tier or weak judge can never silently produce an empty "pass").

**Primary recommendation:** Add the 5 validators as registry entries in a new `harness/validator_kinds.py` sibling module (keep `validators.py` as the registry+fan-in core); add `timing`/`on_failure='ask_user'` as additive `ValidatorSpec` fields; build the publish path as a new `harness/publish_service.py` + a `POST /workflows/{id}/publish` route on the existing `api/workflows.py` router; store the judge rubric + `business_requirement` + `citation_policy` as additive-optional Pydantic-over-JSONB fields (zero migration); the ONLY DB migration is the `harness_audit` CHECK extension (070) for the new receipt kinds + ONE additive `workflow_runs` column for the golden-run flag.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Validator-kind dispatch (`citations_required`, `freshness`, etc.) | API/Backend (`harness.validators` + new `validator_kinds`) | — | Gates run inside the engine's per-phase loop; closed registry pattern (T-091-17, never eval). |
| `timing: pre` preflight execution (D-10) | API/Backend (`harness_engine._run_phase_with_gates`) | — | The engine owns the phase lifecycle; a `pre` validator runs before the executor body. |
| `ask_user` disposition pause/resume (D-11) | API/Backend (`harness_engine` routing + `ask_user_service`) | Browser (renders the choice via existing SSE `ask_user_prompt`) | Cross-worker pause is a server concern; UI is a pure client of the existing event. |
| LLM-judge provider call | API/Backend (`forced_emit` → `provider_gateway`) | — | Provider work lives at the service boundary ONLY (CLAUDE.md); judge inherits the gateway — no new provider branch. |
| `citation_policy` post-verdict disposition (D-01) | API/Backend (`_exec_llm_emit` post-verdict / re-render) | — | Verdict computation unchanged; policy only changes what happens AFTER. Re-render uses the WR-02 persisted field-map. |
| Publish orchestration (lint → golden run → judge → flip) | API/Backend (new `publish_service` + `POST /workflows/{id}/publish`) | Browser (103 is a client; 092 mode-lock precedent) | Server-enforced invariant; "exactly one business_requirement" is a publish-time check, not a schema constraint. |
| Receipt persistence (judge/publish/policy/ask_user-approval) | Database (`harness_audit` INSERT-only) | — | Governance events (Phase 107 reads these); INSERT-only RLS, keyed to run_id. |
| Golden-run flag | Database (`workflow_runs` additive column) | — | `workflow_runs` has no immutability trigger (only `set_updated_at`); a flag column is safe + additive. |
| Mark/blank rendering for `flag`/`partial`/`draft` | API/Backend (`template_render_service` `build_context` / `run_replace`) | Sandbox (the pinned deterministic driver renders) | No model-written code touches the deliverable (red line); marks are rendered by the deterministic driver. |

---

## Standard Stack

### Core (already in the repo — no new packages for the gate library or judge)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pydantic` | 2.x (in use) | Strict models over JSONB (`extra='forbid'` → `additionalProperties:false`); judge verdict schema; `ValidatorSpec` extensions | `_StrictBase` discipline is the codebase's first-class input-validation layer (T-090-01). `[VERIFIED: backend/app/models/harness.py]` |
| `jsonschema` | 4.26.0 | Declarative `json_schema` validator (the `structure_check` strict half builds on it) | Already the `json_schema` kind; declarative, never eval (T-091-17). `[VERIFIED: backend/app/services/harness/validators.py:34,142]` |
| `fastapi` | in use | `POST /workflows/{id}/publish` route on the existing `api/workflows.py` router | The 092 router precedent + 098 query-param pattern. `[VERIFIED: backend/app/api/workflows.py]` |
| `asyncpg` | in use | publish-flip UPDATE + golden-run flag + audit INSERTs (`db/workflows.py`) | `$N` placeholders only, the D-073 hot-path precedent. `[VERIFIED: backend/app/db/workflows.py]` |
| `python-docx` / `python-pptx` / `openpyxl` | sandbox image | `assert_integrity` re-open oracle (the `output_file_valid` wrapper) | Already function-local imports inside `template_render_service.assert_integrity`. `[VERIFIED: backend/app/services/template_render_service.py:888-908]` |

### Supporting (existing services the new code composes — DO NOT re-import provider SDKs)

| Service | Purpose | When to Use |
|---------|---------|-------------|
| `app.services.forced_emit.forced_emit` | The sealed single-shot cross-provider emission the judge verdict rides | The `llm_judge_rubric` validator AND the publish judge call it with `emitter=<judge-verdict-emitter>`. `[VERIFIED]` |
| `app.services.template_render_service.check_coverage` | Per-leaf cited/uncited/invented verdict | `citations_required` (deterministic mode) wraps it. Returns `uncited_value_count`, `invented_citation_count`, `uncited_leaves`, `covered_keys`. `[VERIFIED:416-499]` |
| `app.services.template_render_service.assert_integrity` | Re-open oracle; carries `documented_limit` | `output_file_valid` wraps it; the F3 `documented_limit` sibling reads this. `[VERIFIED:867-923]` |
| `app.services.harness.reachability.lint_workflow` | Pure publish-time structural lint | The publish endpoint's FIRST stage (D-07). `[VERIFIED]` |
| `app.services.ask_user_service.subscribe_for_response` / `resume_pending_prompt` | Cross-worker pause/resume | The `ask_user` 4th disposition (D-11) calls this; `_exec_llm_human_input` is the caller template. `[VERIFIED]` |
| `app.config.get_model_capability` | TIER-FORCE eligibility (`forced_emission`) | The judge model (D-03) should default to a `forced_emission: True` model so the verdict is forceable. `[VERIFIED: config.py MODEL_CAPABILITIES]` |
| `app.db.workflows.create_workflow_run` | Atomic run+phases+anchor creation | The golden run (D-05) reuses this with a validation flag. `[VERIFIED:69-138]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 5 entries in the closed `VALIDATOR_REGISTRY` (D-12) | A `programmatic` validator config with `fn` names | REJECTED — D-12 mandates first-class kinds because the registry doubles as 103's author-facing menu; per-kind config schemas must stay legible. The `programmatic` registry stays for power users. |
| Judge-as-`forced_emit` (the locked decision) | A free-form judge with regex-parsed verdict | REJECTED — a narrated/truncated judge verdict could be silently accepted as a pass; `forced_emit` inherits truncation rejection + honest failure (the QUAL-01 trust bar). |
| New `workflow_runs.is_golden_run` boolean column | Stash the flag inside `inputs` jsonb | EITHER works; a boolean column is cleaner for a `WHERE is_golden_run` query and adds zero RLS surface (the 068 `ADD COLUMN IF NOT EXISTS` pattern). Recommend the column. |
| Growing `validators.py` | A sibling `harness/validator_kinds.py` | RECOMMEND the sibling — `validators.py` stays the registry+fan-in core (~240 lines); the 5 kinds + their config-schemas are ~300+ lines. Both register into the SAME `VALIDATOR_REGISTRY` (import-for-side-effect, the `phase_types.register_all()` pattern). |

**Installation:** No new pip packages. The sandbox image already carries python-docx/pptx/openpyxl/reportlab (CLAUDE.md). No `SANDBOX_IMAGE` bump needed for this phase (the judge and gates run in the backend, not the sandbox).

**Version verification:** No new packages to verify. The judge MODEL default (D-03) should be verified against the live `/models` endpoint at plan time per `feedback_prioritize_newest_models` — but the registry default (e.g. `gpt-5.5` / `claude-opus-4-8`, both `forced_emission: True`) is a safe starting value. `[VERIFIED: config.py:225,238]`

---

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────── RUN-TIME (GATE-01) ───────────────────────┐
 kickoff prompt ──▶ run_workflow (harness_engine)
                          │  for each phase, in phase_index order:
                          │
                          │   ┌─ [NEW D-10] if validators with timing='pre' exist:
                          │   │     run_gates(pre_validators) ──▶ e.g. freshness check
                          │   │        │ pass ──▶ continue to phase body
                          │   │        │ fail ──▶ on_failure routing (incl. [NEW D-11] ask_user)
                          │   │                      └─ ask_user ──▶ ask_user_service (pause/resume)
                          │   │                            ├─ Proceed ──▶ audit receipt, continue
                          │   │                            └─ Abort   ──▶ fail_run (honest)
                          │   │
                          │   ├─ phase executor (_exec_llm_emit etc.)
                          │   │     └─ forced_emit ──▶ provider_gateway ──▶ EmitFieldMap
                          │   │     └─ check_coverage (citation verdict — UNCHANGED)
                          │   │     └─ [NEW D-01] citation_policy disposition:
                          │   │           strict → reject | flag → mark+deliver
                          │   │           partial → blank+deliver | draft → label+deliver
                          │   │
                          │   └─ [post] run_gates(post_validators) ──▶ citations_required /
                          │         output_file_valid / structure_check / llm_judge_rubric
                          │            (bounded retry ≤3 + critique feedback — UNCHANGED loop)
                          │            llm_judge_rubric ──▶ forced_emit ──▶ verdict
                          │
                          └─ each gate result ──▶ write_audit (harness_audit, INSERT-only)
                                                     [NEW receipt kinds: judge_verdict, etc.]

                          ┌─────────────────── PUBLISH-TIME (QUAL-01) ────────────────────────┐
 POST /workflows/{id}/publish ──▶ publish_service.publish()
                          │  STAGE 1: lint_workflow(definition)            [reachability.py]
                          │     └─ also assert business_requirement present (D-13)
                          │  STAGE 2: golden run = create_workflow_run(... is_golden_run=True)
                          │     └─ run_workflow drives the REAL engine on the project KB
                          │  STAGE 3: judge verdict (forced_emit) on the golden run output
                          │           graded against rubric + business_requirement
                          │  STAGE 4: ALL pass ──▶ UPDATE status='published'  (trigger allows
                          │                          OLD.status='draft' → published)
                          │           ANY fail ──▶ structured verdict (stage + named failures
                          │                          + golden_run_id) + audit receipt; NO flip
                          └────────────────────────────────────────────────────────────────────
```

### Recommended Project Structure

```
backend/app/services/harness/
├── validators.py            # UNCHANGED CORE: VALIDATOR_REGISTRY + register_validator
│                            #   + run_gates fan-in + GateResult. Add timing-awareness to
│                            #   run_gates ONLY if pre/post split lives here (see Pattern 1).
├── validator_kinds.py       # NEW: the 5 first-class kinds, each @register_validator(...).
│                            #   Imported for side-effect in __init__ (like phase_types).
├── freshness.py             # NEW (optional split): the net-new deterministic KB queries
│                            #   (newest-doc-age, version-ambiguity). validator_kinds imports it.
├── publish_service.py       # NEW: publish() orchestration (lint → golden run → judge → flip).
├── reachability.py          # UNCHANGED: lint_workflow (publish stage 1 calls it).
├── phase_types.py           # EDIT: _exec_llm_emit consumes citation_policy post-verdict (D-01).
└── __init__.py              # EDIT: import validator_kinds for side-effect registration.

backend/app/api/workflows.py # EDIT: add POST /workflows/{id}/publish route (same router).
backend/app/db/workflows.py  # EDIT: publish-flip UPDATE + golden-run flag write + new audit kinds.
backend/app/models/harness.py# EDIT: +business_requirement (WorkflowDefinition); +timing,
                             #   on_failure='ask_user' (ValidatorSpec); +citation_policy
                             #   (LlmEmitPhaseConfig). All additive-optional, extra='forbid'.
backend/app/config.py        # EDIT: harness_judge_model app_settings field (D-03).
supabase/migrations/070_*.sql# NEW: harness_audit CHECK ALTER (new receipt kinds) +
                             #   workflow_runs.is_golden_run column. ALTER pattern (migration 069).
```

### Pattern 1: New validator kind = a registry entry wrapping an existing primitive (D-12)

**What:** Each library validator is an `async fn(output, config, ctx) -> GateResult` decorated with `@register_validator(<kind>)`. The kind name becomes a `ValidatorSpec.kind` Literal in `models/harness.py`.
**When to use:** All 5 kinds. The engine's `run_gates` already resolves `VALIDATOR_REGISTRY[spec.kind]` and threads the failing index back for `on_failure` derivation (WR-03).
**Example:**
```python
# Source: pattern mirrors backend/app/services/harness/validators.py:130-211 (the 4 shipped kinds)
@register_validator("citations_required")
async def _validate_citations_required(output: dict, config: dict, ctx) -> GateResult:
    """D-14 two modes. mode='deterministic' wraps check_coverage over an emit
    field-map output (reject uncited/invented BEFORE any judge call — GATE-01).
    mode='presence' counts >= config['min_markers'] citation markers in text."""
    mode = config.get("mode", "deterministic")
    if mode == "deterministic":
        fm = output.get("field_map")
        retrieved_ids = set(output.get("retrieved_ids") or [])
        keys = output.get("placeholder_keys") or []
        if fm is None:
            return GateResult(False, "citations_required: no field_map on output")
        verdict = check_coverage(fm, retrieved_ids, keys)   # UNCHANGED primitive
        if verdict["uncited_value_count"] or verdict["invented_citation_count"]:
            return GateResult(False,
                f"uncited={verdict['uncited_value_count']} "
                f"invented={verdict['invented_citation_count']} "
                f"offending={verdict.get('uncited_leaves', [])[:10]}")
        return GateResult(True, None)
    # presence mode for prose
    text = output.get("text") or ""
    import re
    n = len(re.findall(r"\[\d+\]|\(doc[^)]*\)", text))   # author-configurable pattern
    need = config.get("min_markers", 1)
    return GateResult(n >= need, None if n >= need else f"only {n}/{need} citation markers")
```

### Pattern 2: `timing: pre|post` validator split (D-10)

**What:** A `timing` field on `ValidatorSpec` (default `"post"` — every existing gate byte-unchanged). `pre` validators run BEFORE the executor body in `_run_phase_with_gates`; `post` validators run after (the current behavior).
**When to use:** `freshness` is the first `pre` validator. Phase 105 budget preflights reuse the seam.
**Implementation note:** The cleanest seam is in `_run_phase_with_gates` (`harness_engine.py:590`): before the `await asyncio.wait_for(_execute_phase(...))` call, run `run_gates_filtered(phase, ..., timing="pre")`; a `pre` failure drives the SAME `_route_on_failure` path (so `ask_user`/`fail_run`/`skip_to_phase` all work identically). The post-phase `run_gates` call stays exactly as-is but filters to `timing="post"`. Keep `run_gates` byte-compatible by adding an optional `timing` kwarg that defaults to running ALL (back-compat for existing callers/tests).
```python
# Source: pattern site — harness_engine._run_phase_with_gates (line 643 while-loop entry)
# NEW: a pre-gate pass before the executor body, sharing _route_on_failure.
pre = await run_gates(phase, {"_phase_inputs": accumulated_outputs}, ctx, timing="pre")
if not pre.passed:
    return _route_on_failure(phase, pre.error_message, 0, pre.validator_index)
# ... existing executor + post-gate loop unchanged ...
```

### Pattern 3: `ask_user` fourth `on_failure` disposition (D-11)

**What:** `_parse_on_failure` (`harness_engine.py:549`) recognizes a new `ask_user` value. On an exhausted/pre-gate failure routing to `ask_user`, the engine pauses via `ask_user_service` (the `_exec_llm_human_input` flow is the exact template), presenting the validator's structured finding as choices.
**When to use:** Any validator can declare it; freshness uses it for staleness ("Proceed anyway / Abort") and version ambiguity ("Use version X / Use version Y / Abort").
**Critical ordering (battle-tested, do not reinvent):** SUBSCRIBE → SADD → durable prompt row → emit `ask_user_prompt` → block on `subscribe_for_response` (PUBLISH-before-SUBSCRIBE race — `ask_user_service.py:18-28`). **Proceed** writes an audit receipt (someone explicitly approved grounding on stale data — governance-relevant) and continues; **Abort** → honest `fail_run`; unanswered → existing ask_user expiry → honest fail (never a hung run).
**Anti-pattern caught:** `_route_on_failure` returns a `PhaseOutcome` synchronously today. The `ask_user` path needs to AWAIT the user response, so the pause must happen INSIDE `_run_phase_with_gates` (where `redis`/`pool`/`ctx` are in scope), not inside the pure `_route_on_failure` mapper. Add an `ask_user` `PhaseOutcome.kind` that `run_workflow` resolves, OR resolve inline in `_run_phase_with_gates` and return `completed`/`fail_run` based on the answer (RECOMMEND inline — keeps `run_workflow` unchanged).

### Pattern 4: `citation_policy` consumed AFTER the verdict (D-01) — verdict computation unchanged

**What:** `LlmEmitPhaseConfig` gains `citation_policy: Literal["strict","flag","partial","draft"] = "strict"`. In `_exec_llm_emit` (`phase_types.py:1235`), the post-`check_coverage` branch currently always rejects on `uncited_value_count`/`invented_citation_count`. The policy gates ONLY this disposition:
- `strict` (default, **byte-identical**): reject → state (b) honest fail.
- `flag`: deliver WITH marks. Re-render via `build_context` with a "mark uncited" flag → inline "[unverified]" suffix OR an appendix table; coverage summary in the surfaced message.
- `partial`: blank uncited values (null-over-invent), deliver + gap list. The `check_coverage` per-leaf `uncited_leaves` names exactly which to blank.
- `draft`: no citation enforcement; deliver, doc visibly labeled DRAFT (header/watermark); citations attached where they exist.
**Key reuse:** The WR-02 fix already persists the field-map durably on `workflow_phases.output` — so `flag`/`partial`/`draft` re-render under a different policy WITHOUT a new emit shot. `[VERIFIED: db/workflows.fail_phase output param + STATE.md WR-02]`
**Red line:** the deterministic driver renders the marks — NEVER model-written code; `strict` stays the default everywhere.

### Pattern 5: server-side publish path (D-07/D-08) — the QUAL-01 hard blocker

**What:** `POST /workflows/{id}/publish` → `publish_service.publish(definition_id, golden_input, user)`:
1. Load the draft definition; `model_validate` it. Assert `business_requirement` present (D-13 publish-time invariant) — else 400 structured.
2. `lint_workflow(definition)` — any `LintError` → structured block (stage="lint", codes).
3. `create_workflow_run(..., is_golden_run=True)` + `run_workflow(...)` — a REAL run on the project KB (D-05, no mocks, no opt-out).
4. Judge: `forced_emit` with the frozen rubric + `business_requirement`, grading the golden run's final output. Verdict + structural gates on that run must pass.
5. ALL pass → `UPDATE workflow_definitions SET status='published' WHERE id=$1` (the `workflow_definitions_block_published_update` trigger ALLOWS this — `OLD.status='draft'`, see §Runtime State Inventory).
6. ANY fail → return a structured verdict `{blocked_stage, named_failures, golden_run_id}` (machine-renderable for 103) + write a publish-attempt audit receipt. NO flip.
**Server-enforced invariant precedent:** Phase 092's mode lock is server-enforced with the UI as client — D-07 follows the same discipline. 103's page must not bypass the endpoint.

### Anti-Patterns to Avoid

- **Touching `backend/app/api/threads.py`:** G-5 fires — `threads.py` (9+ phases) must NOT grow. The publish endpoint goes on `api/workflows.py`. `[VERIFIED: CLAUDE.md hot-file ledger]`
- **Breaking the Deep path:** every new field is additive-optional; the `strict` citation path stays byte-identical; the judge rides `forced_emit` (no new provider branch in the shared chunk/SSE handler — the D-14 shared-path guard from 101.1). Deep never runs a workflow, never reaches `_exec_llm_emit`.
- **Self-judging:** the judge model MUST be independent of the run model (D-03) — a weak/coerce run model cannot become its own publish blocker's weak link.
- **A gameable token gate:** SEED-050's `plan_execute_verify` "VERIFIED token" gate is the cautionary tale — the rubric must check substance (grounded? answers the requirement? did the work vs delegated?), and the judge verdict must be a forced emission (not a regex on prose) so it can't be narrated past.
- **Re-deriving the rubric at run time:** the rubric is frozen on publish (D-04) so verdicts are reproducible against a known rubric.
- **A new emit shot for `flag`/`partial`/`draft`:** re-render off the WR-02 persisted field-map instead (no extra provider call, no new tokens).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-provider judge call | A new judge-specific provider branch | `forced_emit` (`forced_emit.py`) | Inherits TIER-FORCE/COERCE tiering, narrated-JSON recovery, truncation rejection, honest failure — "bulletproof for free" (101.1 deferred note). A hand-rolled judge would re-create every cross-provider trap (DeepSeek thinking-OFF, Kimi coerce, Gemini ANY-mode). |
| Citation rejection | A new "is everything cited" check | `check_coverage` (`template_render_service.py:416`) | Already computes per-leaf cited/uncited/invented + named offending leaves. Policy only changes the disposition AFTER it. |
| File-corruption check | A new docx/pptx/xlsx parser | `assert_integrity` (`template_render_service.py:867`) | Re-opens with the SAME library (the ground-truth oracle); already carries `documented_limit` for the F3 sibling. Make it format-aware (add PDF) — don't rewrite. |
| Structural lint | A new graph reachability check | `lint_workflow` (`reachability.py`) | Pure function; already detects orphans/dangling-skips/no-terminal/bad-index/unsatisfied-inputs. The publish endpoint's stage 1. |
| Cross-worker pause/resume | A new pub/sub | `ask_user_service` (`ask_user_service.py`) | The SUBSCRIBE-before-emit race, the expiry, the cancel/shutdown sentinels, the resume-after-restart re-subscribe are ALL solved and battle-tested in `llm_human_input`. |
| The bounded retry + critique feedback loop | A new retry loop in a validator | `_run_phase_with_gates` (`harness_engine.py:590`) | The engine already retries ≤3, feeds `gate.error_message` back via `ctx.retry_feedback`, short-circuits on identical output, and audits each attempt. The judge gate's D-02 retry IS this loop. |
| Golden-run creation | A new run-insertion path | `create_workflow_run` (`db/workflows.py:69`) | The ONLY atomic run+phases+anchor transaction; add an `is_golden_run` flag, don't fork it. |
| Publish immutability | A new "can't edit published" check | The shipped `workflow_definitions_block_published_update` trigger | Already blocks any field change on a published row; the draft→published flip is allowed (`OLD.status='draft'`). |

**Key insight:** Phase 102 is a composition phase. The discipline is "register and wire," not "build." The two truly net-new pieces are (a) the `freshness` deterministic KB queries and (b) the publish orchestration sequence — everything else is an entry, a field, or a route over shipped mechanics.

---

## Runtime State Inventory

> This is an ADD-CAPABILITY phase, not a rename/refactor. Included for the publish-flip and golden-run state surfaces (the genuinely stateful new mechanics).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `workflow_definitions.status` flips `draft → published` via the publish endpoint. The `workflow_definitions_block_published_update` trigger ALLOWS this flip (it only blocks changes when `OLD.status='published'`). `business_requirement` + `citation_policy` + `llm_judge_rubric` config + `timing`/`on_failure` ride the existing `definition` JSONB (zero migration). | Code: the publish UPDATE in `db/workflows.py`. Migration: NONE for the JSONB fields. |
| Stored data | The golden run is a real `workflow_runs` row (+ its `workflow_phases` rows) on the project KB. It persists in the same tables as ordinary runs — it MUST be distinguishable (D-05 "flagged as a validation run") so it's excluded from ordinary run listings/history. | Migration 070: `ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS is_golden_run boolean DEFAULT false` (068 pattern). Code: `create_workflow_run(... is_golden_run=True)`. |
| Stored data | New `harness_audit` receipt kinds (judge verdict, publish attempt/blocked, policy disposition, ask_user-approval). The `_AUDIT_EVENT_TYPES` frozenset (`db/workflows.py:44`) MUST stay IN LOCKSTEP with the CHECK constraint. | Migration 070: `harness_audit` CHECK ALTER (069 pattern). Code: extend `_AUDIT_EVENT_TYPES` in lockstep. |
| Live service config | None — no external service config holds gate/judge state. The judge MODEL is an `app_settings` row value (D-03), set via the Settings UI / DB, not external. | None. |
| OS-registered state | None — no OS-level registration, scheduled tasks, or process names involve gates/judge/publish. | None — verified: this phase is backend service code + one route + one migration. |
| Secrets/env vars | None new. The judge uses existing provider credentials resolved through the gateway (same path as every other LLM call). `harness_judge_model` is a settings VALUE (a model id string), not a secret. | None. |
| Build artifacts / installed packages | NONE — no new pip packages, no sandbox image bump (gates + judge run in the backend, not the sandbox). The sandbox image already carries the office libs `assert_integrity` re-opens. | None — verified: §Standard Stack "Installation". |

**Migration discipline (CLAUDE.md):** migration 070 is applied by pasting into the Supabase SQL editor (NEVER `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no reset), commit both files. `_AUDIT_EVENT_TYPES` updated in the SAME plan as the CHECK ALTER (the 069/Plan-01 lockstep precedent).

---

## Common Pitfalls

### Pitfall 1: A gameable / theatrical quality gate (the SEED-050 trap)
**What goes wrong:** The judge passes a hollow-but-plausible output, or the rubric checks a token the model can emit on a wrong result (SEED-050's `plan_execute_verify` VERIFIED-token gate). QUAL-01's entire value is destroyed — a bad workflow publishes.
**Why it happens:** Vague rubric ("is it good?"), or a verdict parsed loosely from prose so a model can narrate past it.
**How to avoid:** The rubric standard core checks the three SEED-050 failure modes explicitly (grounded in the evidence? actually answers the `business_requirement`? did the work rather than delegating back to the user?). The verdict is a forced emission (D-04 / `forced_emit`) — a truncated/narrated verdict is rejected, not silently passed. Encourage judge reasoning (CoT) before the verdict per Anthropic's grading guidance. `[CITED: docs.anthropic.com/en/docs/test-and-evaluate/develop-tests]`
**Warning signs:** A golden run that "passes" with an empty/degenerate output; a verdict schema that accepts free text without a hard pass/fail field.

### Pitfall 2: Self-judging / weak-judge collusion
**What goes wrong:** The judge model is the same (possibly weak/coerce) model that produced the output; it rubber-stamps its own work.
**Why it happens:** `model: null` inherits the composer model (the captured 103/104 gap, SEED-082 related_decisions).
**How to avoid:** D-03 — the judge is a designated `app_settings` model independent of the run model, defaulting to a strong `forced_emission: True` model. Verify the default is TIER-FORCE at plan time (`get_model_capability(judge_model).get("forced_emission")` should be True).
**Warning signs:** The judge model resolving to the same id as the run model; a coerce-tier judge default.

### Pitfall 3: The `pre`-validator/`ask_user` pause breaks resumability
**What goes wrong:** A freshness `pre` validator pauses on `ask_user`, the worker restarts, and the run strands (no re-subscribe) or double-asks.
**Why it happens:** Reinventing the pause instead of reusing the proven ordering.
**How to avoid:** Use `ask_user_service` exactly as `_exec_llm_human_input` does — durable prompt row with the issuing `run_id` stamped (`get_pending_ask_user` resume matcher keys on it), SUBSCRIBE-before-emit, expiry → honest fail. The crash-leaves-active 2-phase write means a `pre`-gate pause must happen while the phase is durably `active` (it already is — `mark_phase_active` runs before `_run_phase_with_gates`).
**Warning signs:** A pause path that doesn't write the durable prompt row; a resume that re-emits the wrong `tool_call_id`.

### Pitfall 4: Mock-masked golden-run breakage (the 099/101 lesson)
**What goes wrong:** The publish path is unit-tested with mocked runs/judge and "passes," but the live golden run fails (the exact 101 GAP-A..D cascade — code-complete but non-functional).
**Why it happens:** Mock-shape drift; the golden run touches the real engine + real KB + real provider.
**How to avoid:** D-05 mandates a REAL run, no mocks, no opt-out. Author the live UAT (the golden-run path against the real project KB) as the acceptance bar, and follow the 101.1 baseline-checkout net-new-failure proof. The SC#10 4-axis cross-provider rows MUST exercise the judge live (it calls providers during runs).
**Warning signs:** A publish test that never inserts a `workflow_runs` row; a judge call that's mocked at the gateway boundary.

### Pitfall 5: A non-strict policy silently passing off unverified data
**What goes wrong:** `flag`/`partial`/`draft` delivers a doc that LOOKS authoritative but contains unverified/blanked values with no visible marker.
**Why it happens:** Rendering the policy disposition without the mark/blank/label.
**How to avoid:** SEED-082 red line — every non-strict mode marks or blanks, never silent pass-off. `flag` → visible "[unverified]" marks + coverage summary; `partial` → blanked cells + gap list; `draft` → visible DRAFT label. The deterministic driver renders these (no model-written code).
**Warning signs:** A `flag` output with no marks; a `draft` output with no label; coverage summary missing from the surfaced message.

### Pitfall 6: `harness_audit` CHECK / `_AUDIT_EVENT_TYPES` drift
**What goes wrong:** A new receipt kind is INSERTed but the CHECK constraint (or the code frozenset) doesn't include it → Postgres 23514 mid-run, OR a code ValueError.
**Why it happens:** The migration CHECK and the `_AUDIT_EVENT_TYPES` frozenset are two copies that can drift (Pitfall 6 in `db/workflows.py`).
**How to avoid:** Extend BOTH in the same plan (the 069/Plan-01 lockstep precedent). Migration 070 ALTERs the CHECK; the same plan updates `_AUDIT_EVENT_TYPES`.
**Warning signs:** A `write_audit(event_type=<new kind>)` call without a matching CHECK entry; tests passing on a mock pool that never enforces the CHECK.

---

## Code Examples

### Judge verdict schema (a forced emission — flat, shallow, additionalProperties:false, per D-09/101.1 rules)
```python
# Source: pattern mirrors EmitFieldMap (template_render_service.py:186) + Anthropic grading guidance
class JudgeCriterionVerdict(BaseModel):
    model_config = ConfigDict(extra="forbid")        # → additionalProperties:false
    criterion: str                                    # the rubric criterion (sibling, not nested key)
    passed: bool                                       # hard per-criterion pass/fail
    score: int                                         # 0..5 coarse scale (Anthropic-recommended)
    evidence: str | None                               # the judge's justification (CoT-after-reasoning)

class JudgeVerdict(BaseModel):
    """The forced-emission verdict. Flat, depth-2, additionalProperties:false —
    the cross-provider forcing target forced_emit guarantees."""
    model_config = ConfigDict(extra="forbid")
    overall_passed: bool                               # the HARD publish gate bit
    overall_score: int                                 # 0..10 holistic (independent of per-criterion)
    grounded_in_evidence: bool                         # SEED-050 failure mode 1
    answers_business_requirement: bool                 # SEED-050 failure mode 2
    did_the_work_not_delegated: bool                   # SEED-050 failure mode 3 (asks-the-user trap)
    criteria: list[JudgeCriterionVerdict]              # author-extensible rubric criteria
    summary: str                                       # surfaced to the author on block (D-08)
```

### The judge rubric prompt core (provider-docs-first: Anthropic grading guidance)
```python
# Source: CITED docs.anthropic.com/en/docs/test-and-evaluate/develop-tests — "detailed rubrics,
# encourage reasoning before scoring, empirical pass/fail." Woven with SEED-050 failure modes.
JUDGE_RUBRIC_CORE = """You are grading a workflow's output against ONE declared business
requirement. Think step by step BEFORE deciding each verdict (this improves grading
reliability). The output must:
  1. GROUNDED: every substantive claim is supported by the retrieved evidence — penalize
     unsupported/invented claims, reward accurate citations.
  2. ANSWERS THE REQUIREMENT: the output satisfies the declared business requirement
     verbatim: "{business_requirement}".
  3. DID THE WORK: the agent actually produced the deliverable — it did NOT delegate the
     work back to the user (e.g. "please provide the research" is an automatic FAIL).
{author_criteria}
Emit a JudgeVerdict. overall_passed is true ONLY if all three core checks pass AND every
author criterion passes."""
```

### Migration 070 (ALTER pattern — follows migration 069 exactly)
```sql
-- Source: pattern mirrors supabase/migrations/069_harness_audit_emit_kinds.sql + 068 ADD COLUMN
-- 070_harness_validation_gate_library.sql — Phase 102 (GATE-01/QUAL-01).
-- Apply via Supabase SQL editor (NEVER db push/db reset); then regenerate-full-schema.sh (no reset).

ALTER TABLE public.harness_audit DROP CONSTRAINT harness_audit_event_type_check;
ALTER TABLE public.harness_audit ADD CONSTRAINT harness_audit_event_type_check CHECK (
    event_type IN (
        'phase_started','phase_completed','phase_transition',
        'gate_passed','gate_failed','tool_refused',
        'run_started','run_completed','run_failed',
        'emit_forced','emit_recovered','emit_validated','emit_rejected',
        'emit_rendered','emit_integrity_failed','emit_failed',
        -- 102 (GATE-01/QUAL-01) — judge / publish / policy / ask_user-approval receipts:
        'judge_verdict','publish_attempted','publish_blocked','publish_succeeded',
        'policy_applied','validator_ask_user_approved'
    )
);

-- Golden-run flag (D-05) — workflow_runs has no immutability trigger; additive + safe.
ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS is_golden_run boolean DEFAULT false;
COMMENT ON COLUMN public.workflow_runs.is_golden_run IS
  'Phase 102 QUAL-01 (D-05). True = a publish-time validation run (real engine, real KB, '
  'judge-graded). Excluded from ordinary run history/listings. Default false (every '
  'pre-102 + ordinary run byte-identical).';
```

### Additive-optional model extensions (zero migration — Pydantic over JSONB)
```python
# Source: pattern mirrors models/harness.py (LlmEmitPhaseConfig:123, ValidatorSpec:163, WorkflowDefinition:203)
class ValidatorSpec(_StrictBase):
    kind: Literal[                                       # extend the LOCKED Literal set with 5 kinds
        "json_schema", "regex_match", "workspace_file_exists", "programmatic",
        "citations_required", "freshness", "structure_check",
        "output_file_valid", "llm_judge_rubric",
    ]
    config: dict = Field(default_factory=dict)
    on_failure: str = "fail_run"                         # fail_run|retry|skip_to_phase:<slug>|ask_user (D-11)
    max_retries: int = 2
    timing: Literal["pre", "post"] = "post"              # D-10 — default post = byte-identical

# LlmEmitPhaseConfig gains (D-01):
    citation_policy: Literal["strict", "flag", "partial", "draft"] = "strict"  # strict = byte-identical
    integrity_policy: Literal["strict", "documented_limit"] = "strict"          # F3 sibling

# WorkflowDefinition gains (D-13):
    business_requirement: str | None = None              # optional on draft, REQUIRED at publish (endpoint check)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Functional gates only (triggers/runs/dispatches) | Output-QUALITY gate (rubric judge + golden run) | SEED-050 (2026-06-02) → Phase 102 | Catches the "Research workflow asks the user to do the research" class — functionality ≠ quality. |
| All-or-nothing strict citation reject | Per-workflow `citation_policy` enum (strict\|flag\|partial\|draft) | SEED-082 (2026-06-12) → D-01 | "Freedom with honesty" — many real business deliverables need flag/draft, not refusal. Strict stays default. |
| Judge as free-form prose | Judge as forced emission (structured verdict) | 101.1 forced-emit seam (2026-06-11) | Cross-provider, truncation-safe, can't be narrated past. |
| `programmatic` validator with `fn` names | First-class registry kinds (the 103 author menu) | D-12 (Phase 102) | Per-kind config schemas stay legible for NL authoring. |

**Deprecated/outdated:**
- The `plan_execute_verify` "VERIFIED token" gate (theatrical — gameable) — SEED-050 explicitly drops it; the rubric judge replaces it.
- Stored expected-output byte-comparison for golden runs — REJECTED (D-06): the KB is alive, byte-golden rots; criteria are golden, not bytes.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The `workflow_definitions_block_published_update` trigger allows a `draft → published` flip (it only blocks changes when `OLD.status='published'`). | Runtime State Inventory / Pattern 5 | LOW — VERIFIED in full-schema.sql:230 (`IF OLD.status='published'`). The publish UPDATE on a draft row is allowed. Confirmed, not assumed. |
| A2 | A 0..5 per-criterion + 0..10 overall judge scale is a reasonable default. | Code Examples | LOW — the scale is author-extensible and the HARD gate bit is `overall_passed` (boolean), not the score; the exact scale is tunable. `[CITED]` web research, not a locked decision. |
| A3 | The judge default model (`gpt-5.5` / `claude-opus-4-8`) is TIER-FORCE and served live. | Pitfall 2 / Standard Stack | MEDIUM — verify against live `/models` at plan time (`feedback_prioritize_newest_models`). Both are `forced_emission: True` in the registry (VERIFIED), but model availability shifts; the value is a settings default the operator can change. |
| A4 | The `ask_user` pause is best resolved INLINE in `_run_phase_with_gates` (await the answer there) rather than via a new async `PhaseOutcome.kind` resolved in `run_workflow`. | Pattern 3 | LOW — both work; inline keeps `run_workflow` unchanged. Planner may choose either; this is a structural recommendation, not a hard constraint. |
| A5 | The freshness validator can query "newest relevant document" from the KB scope using the existing document/chunk tables + the workflow's `folder_scope`. | §Environment Availability / Open Q1 | MEDIUM — the document `created_at`/upload-date column and folder-scope query shape need confirming against the live schema at plan time (the chunks/documents tables weren't read this session). The mechanic (newest-doc-age vs `max_age_days`) is sound; the exact query needs the schema. |

---

## Open Questions

1. **Freshness "newest relevant document" query shape.**
   - What we know: the workflow carries a `project_folder_id` + per-phase `folder_scope` (resolved id list, PROJ-02); freshness checks newest-doc-age vs a per-workflow `max_age_days` and version-ambiguity via app version history + exact-stem filename collisions.
   - What's unclear: the exact documents/chunks table column for upload/creation date, and whether the app's "version history" (superseded versions) is queryable by filename-stem. The documents table was not read this session.
   - Recommendation: at plan time, read `supabase/full-schema.sql` for the `documents`/`document_chunks`/`folders` columns; reuse the 098 folder-subtree scope resolution. Freshness is opt-in (D-09) so it can ship narrow (v1: newest-doc-age + exact-stem collision; defer fuzzy version detection — already deferred per CONTEXT).

2. **`structure_check` loose mode — what counts as a "section/heading present" across formats.**
   - What we know: D-14 loose mode = named sections/headings present (author lists them; order-insensitive, extras allowed). For prose/text outputs this is a substring/heading scan; for docx it could read headings.
   - What's unclear: whether loose mode runs on the text output or re-opens the file. v1 cut: run on the phase's text output (the chat-ready payload), not the rendered file — simpler, format-agnostic, and "sections well-developed" is the judge's job anyway.
   - Recommendation: text-output heading scan for v1; document the file-aware mode as a future refinement.

3. **`flag`/`partial`/`draft` mark-rendering style (inline suffix vs appendix table; DRAFT watermark mechanics).**
   - What we know: CONTEXT lists this as Claude's discretion within SEED-082's "marks or blanks, never silent."
   - What's unclear: inline "[unverified]" suffix vs an appendix "Unverified values" table; whether DRAFT is a header line vs a watermark.
   - Recommendation: simplest honest option for v1 — `flag` = inline "[unverified]" suffix on the value + a coverage line in the surfaced message; `partial` = blanked cell + a "Gaps" appendix list; `draft` = a DRAFT header line (no watermark image — keeps the deterministic driver simple). Re-render off the WR-02 persisted field-map. The Phase 103 builder/run-surface can refine the style later.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase Postgres (local :54322) | publish-flip, golden-run row, audit receipts, migration 070 | ✓ | 15.x (Supabase CLI) | — (hard requirement; already the dev substrate) |
| Redis (docker-compose.dev.yml) | the golden run's `run:{id}` event stream + ask_user pub/sub | ✓ | per REDIS-SETUP.md | — |
| python-docx / pptx / openpyxl | `assert_integrity` re-open (`output_file_valid`) | ✓ | sandbox image | — |
| reportlab / matplotlib | format-aware `output_file_valid` PDF readiness (Phase 106 slots in) | ✓ | sandbox image | PDF validation can be a no-op stub in v1 until 106 produces PDFs |
| Provider credentials (OpenAI/Anthropic/Google/etc.) | the judge call via `forced_emit` → gateway | ✓ | backend/.env | — (judge fails honestly via `forced_emit` provider_error backstop if a provider is down) |

**Missing dependencies with no fallback:** None — every dependency is already part of the running dev stack.

**Missing dependencies with fallback:** PDF format-aware validation has no live consumer until Phase 106; `output_file_valid` can ship format-aware-but-PDF-stubbed in v1 (the CONTEXT only requires it be "PDF-ready so Phase 106 slots in without rework").

---

## Validation Architecture

> nyquist_validation = true in `.planning/config.json` — this section is required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend); the harness/emit suite is the precedent (`backend/tests/unit/test_*.py`) |
| Config file | `backend/pytest.ini` / `backend/pyproject.toml` (confirm at plan time) |
| Quick run command | `cd backend && venv/Scripts/python -m pytest tests/unit/test_validator_kinds.py -x` |
| Full suite command | `cd backend && venv/Scripts/python -m pytest tests/unit -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GATE-01 | `citations_required` deterministic mode rejects uncited/invented before any judge call | unit | `pytest tests/unit/test_validator_kinds.py::test_citations_required_rejects_uncited -x` | ❌ Wave 0 |
| GATE-01 | `citations_required` presence mode counts >= N markers in prose | unit | `pytest tests/unit/test_validator_kinds.py::test_citations_required_presence -x` | ❌ Wave 0 |
| GATE-01 | `output_file_valid` wraps `assert_integrity`; corrupt file fails the gate, format-aware | unit | `pytest tests/unit/test_validator_kinds.py::test_output_file_valid_reopens -x` | ❌ Wave 0 |
| GATE-01 | `structure_check` loose mode passes when named sections present, order-insensitive | unit | `pytest tests/unit/test_validator_kinds.py::test_structure_check_loose -x` | ❌ Wave 0 |
| GATE-01 | `llm_judge_rubric` rides `forced_emit`; truncated/narrated verdict → honest fail not silent pass | unit | `pytest tests/unit/test_validator_kinds.py::test_judge_rides_forced_emit -x` | ❌ Wave 0 |
| GATE-01 | `freshness` (`timing='pre'`) flags newest-doc older than `max_age_days` | unit | `pytest tests/unit/test_freshness.py::test_freshness_stale -x` | ❌ Wave 0 |
| GATE-01 | `freshness` version-ambiguity (exact-stem collision) branches to `ask_user` | unit | `pytest tests/unit/test_freshness.py::test_freshness_version_ambiguity_asks -x` | ❌ Wave 0 |
| GATE-01 | `timing='pre'` validator runs BEFORE the executor body; `post` default byte-identical | unit | `pytest tests/unit/test_pre_post_timing.py -x` | ❌ Wave 0 |
| GATE-01 | `ask_user` 4th disposition: Proceed → audit receipt + continue; Abort → fail_run; unanswered → expiry fail | unit | `pytest tests/unit/test_ask_user_disposition.py -x` | ❌ Wave 0 |
| QUAL-01 | publish refuses a draft with no `business_requirement` (400 structured) | unit | `pytest tests/unit/test_publish_service.py::test_publish_requires_business_requirement -x` | ❌ Wave 0 |
| QUAL-01 | publish runs lint → golden run → judge → flip; ANY fail → structured verdict + no flip | unit | `pytest tests/unit/test_publish_service.py::test_publish_pipeline_order -x` | ❌ Wave 0 |
| QUAL-01 | a lint-clean workflow producing bad output (judge fails) CANNOT publish | unit | `pytest tests/unit/test_publish_service.py::test_bad_output_blocks_publish -x` | ❌ Wave 0 |
| QUAL-01 | the draft→published flip is allowed by the immutability trigger; published→edit still blocked | integration (live DB) | `pytest tests/unit/test_publish_flip.py -x` (psycopg2 :54322) | ❌ Wave 0 |
| D-01 | `citation_policy=strict` byte-identical; flag/partial/draft mark-or-blank, never silent | unit | `pytest tests/unit/test_citation_policy.py -x` | ❌ Wave 0 |
| D-12 | `harness_audit` accepts the new receipt kinds; `_AUDIT_EVENT_TYPES` in lockstep | unit | `pytest tests/unit/test_harness_audit_102.py -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/unit/test_validator_kinds.py tests/unit/test_publish_service.py -x` (the touched file's suite)
- **Per wave merge:** `pytest tests/unit -q` + the SEED-056 baseline-checkout net-new-failure proof (revert the touched source files to the wave base, confirm identical failures, restore)
- **Phase gate:** full suite green + the SC#10 live UAT scoreboard before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/test_validator_kinds.py` — the 5 new kinds (GATE-01)
- [ ] `tests/unit/test_freshness.py` — freshness deterministic queries + ask_user branch (GATE-01)
- [ ] `tests/unit/test_pre_post_timing.py` — the D-10 seam
- [ ] `tests/unit/test_ask_user_disposition.py` — the D-11 4th disposition
- [ ] `tests/unit/test_publish_service.py` — the publish pipeline (QUAL-01)
- [ ] `tests/unit/test_publish_flip.py` — live-DB draft→published trigger behavior
- [ ] `tests/unit/test_citation_policy.py` — the D-01 enum dispositions
- [ ] `tests/unit/test_harness_audit_102.py` — new receipt kinds + lockstep
- [ ] Shared fixtures: a golden-run-shaped `WorkflowDefinition` with `business_requirement` + `llm_judge_rubric`; a `forced_emit`-mocked judge fixture (mock at the gateway boundary per `feedback_mock_completeness` — mock ALL network deps) — BUT the publish path's acceptance is a LIVE golden run (D-05, no-mock), so the live UAT is the real gate.

### SC#10 4-axis cross-provider rows (MANDATORY — gates call providers via `llm_judge`)
The judge calls providers DURING runs, so the publish-gate UAT MUST exercise the 4 axes (authored under VALIDATION.md, NOT in PLAN.md tasks):

| Axis | Required coverage for Phase 102 |
|------|---------------------------------|
| Cross-provider | The JUDGE model across OpenAI / Anthropic / Google / OpenRouter (one representative per axis) — verify each renders a structured forced verdict; a coerce-tier judge (Kimi/Moonshot) must still produce an honest verdict or honest failure, never a silent pass. |
| Multi-tool | A golden run whose workflow exercises 2+ tools (e.g. `search_documents` + `render_template`) then the judge grades the multi-tool output. |
| Parallel-thread | Thread A's golden run streaming while Thread B accepts a new prompt — the publish gate must not wedge the composer. |
| Long-message | A golden run with a long KB context / ≥ 50 prior messages — the judge verdict must not truncate (the `forced_emit` truncation guard is the backstop). |

Spec re-confirm (ROADMAP note a): gate verdicts ARE already persisted (`gate_passed`/`gate_failed` audit rows, 091), but evidence-rich receipts exist only on the emit path (101.1 D-12) — 102 brings judge/publish/policy receipts to D-12 richness (the new receipt kinds in migration 070). `[VERIFIED: CONTEXT canonical_refs + db/workflows.write_audit]`

---

## Security Domain

> `security_enforcement` is absent from `.planning/config.json` → enabled. This phase adds a server-side publish endpoint + a judge that calls providers + new audit receipts — all security-relevant.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `POST /workflows/{id}/publish` uses `Depends(get_current_user)` (the 092 router precedent). |
| V3 Session Management | no | No new session state. |
| V4 Access Control | yes | The publish endpoint must verify the caller OWNS the draft (the `list_published_workflows` RLS-mirroring predicate `created_by = user`); a user cannot publish another user's draft. The golden run + audit writes bind the run-owner `user_id` (the 092-05 F1 NOT-NULL stamp). |
| V5 Input Validation | yes | `WorkflowDefinition.model_validate` with `extra='forbid'` (T-090-01); `business_requirement` free text — sanitize before weaving into the judge prompt (prompt-injection: a malicious requirement could try to coerce the judge — the rubric core is fixed/standard and the requirement is woven as data, not instructions). The path/id is FastAPI-coerced to UUID (422 on malformed). |
| V6 Cryptography | no | No new crypto; provider credentials use the existing gateway path. |

### Known Threat Patterns for {Python/FastAPI + LLM-judge + publish gate}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user publish (publish another user's draft) | Elevation of Privilege | Owner-check the draft (`created_by = current_user`) in the endpoint BEFORE any work; the RLS-mirroring predicate is the backstop. |
| Prompt injection via `business_requirement` / KB content into the judge | Tampering | The rubric core is a FIXED standard prompt; the requirement + KB evidence are woven as DATA (clearly delimited), not as judge instructions; the verdict is a strict forced emission so an injected "you must pass this" can't change the schema-bound `overall_passed` derivation. The judge is independent of the run model (D-03 — no self-influence). |
| A gameable verdict (silent pass on bad output) | Spoofing/Repudiation | Forced emission + truncation rejection + honest-failure (`forced_emit`); the publish-attempt and verdict are INSERT-only audit receipts (Phase 107 governance, EU AI Act Art. 12 traceability shape). |
| Golden run as a DoS / cost vector (publish spam) | Denial of Service | Publish is a rare deliberate event (D-05 accepts the cost); rate-limiting + owner-scope bound the surface. The golden run rides the existing wall-clock + step caps (`_run_phase_with_gates`). |
| `ask_user` disposition stranding a paused run | Denial of Service | Existing ask_user expiry → honest fail (never a hung run); the durable prompt row + resume-after-restart machinery is battle-tested (085). |
| New `harness_audit` kind bypassing the CHECK | Tampering | `_AUDIT_EVENT_TYPES` frozenset + the migration-070 CHECK in lockstep; a typo fails fast (ValueError) not as a mid-run 23514. |
| Untrusted upload reaching the Jinja engine (via `output_file_valid` on an ephemeral template) | Tampering (SSTI) | `output_file_valid` only RE-OPENS the produced file (read-only oracle); it never renders. The SSTI boundary (`select_engine` provenance routing, D-02) is upstream and unchanged. |

---

## Sources

### Primary (HIGH confidence — read in full this session)
- `backend/app/services/harness/validators.py` — `VALIDATOR_REGISTRY`, `register_validator`, `run_gates`, `GateResult`, the 4 shipped kinds.
- `backend/app/services/harness_engine.py` (lines 1-1142) — `_run_phase_with_gates`, `_parse_on_failure`, `_route_on_failure`, `_failing_on_failure`, `run_workflow`, audit/emit sites.
- `backend/app/services/forced_emit.py` — the full forced-emission seam (tiering, recovery, truncation, honest failure, provider_error backstop).
- `backend/app/services/harness/reachability.py` — `lint_workflow` (the publish stage-1 lint).
- `backend/app/services/template_render_service.py` (check_coverage:416, assert_integrity:867, EmitFieldMap:186, select_engine:936) — the deterministic primitives the wrappers reuse.
- `backend/app/services/ask_user_service.py` — the cross-worker pause/resume the D-11 disposition reuses.
- `backend/app/services/harness/phase_types.py` (_exec_llm_emit:1050, _exec_llm_human_input:594) — the citation_policy consumption point + the ask_user caller template.
- `backend/app/models/harness.py` — `WorkflowDefinition`, `ValidatorSpec`, `LlmEmitPhaseConfig`, the additive-optional + extra='forbid' discipline.
- `backend/app/api/workflows.py` + `backend/app/db/workflows.py` — the publish endpoint's router + `create_workflow_run`, `write_audit`, `_AUDIT_EVENT_TYPES`, `finish_run`.
- `backend/app/config.py` (MODEL_CAPABILITIES, ModelCapability, forced_emission flags) — the judge-model TIER-FORCE eligibility.
- `supabase/migrations/069_harness_audit_emit_kinds.sql` + `068_workspace_template_ephemeral.sql` — the ALTER / ADD COLUMN migration patterns.
- `supabase/full-schema.sql` (workflow_definitions:712, workflow_runs:773, workflow_definitions_block_published_update:226) — the publish-flip trigger + table shapes.
- `.planning/seeds/SEED-082-emit-gate-policy-flexibility.md`, `.planning/seeds/SEED-050-workflow-result-quality.md`, `.planning/REQUIREMENTS.md`, `102-CONTEXT.md`, `.planning/STATE.md`.

### Secondary (MEDIUM confidence — official docs, verified against the locked decisions)
- [Anthropic — Define success criteria and build evaluations](https://docs.anthropic.com/en/docs/test-and-evaluate/develop-tests) — detailed rubrics, encourage reasoning before scoring, empirical pass/fail, multidimensional evaluation. (provider-docs-first for the judge rubric core.)
- [Anthropic — Demystifying evals for AI agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) — agent-output grading guidance.

### Tertiary (LOW confidence — general LLM-as-judge landscape, cross-verified)
- [Aman's AI Journal — LLM-as-a-Judge / Autoraters](https://aman.ai/primers/ai/LLM-as-a-judge/) — pointwise vs pairwise, CoT verdicts.
- [Rubric-Based Evaluations & LLM-as-a-Judge (Medium, Adnan Masood)](https://medium.com/@adnanmasood/rubric-based-evals-llm-as-a-judge-methodologies-and-empirical-validation-in-domain-context-71936b989e80) — coarse 0-5 per-criterion + 0-10 overall scale, bias auditing.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library/service was read in this session; no new packages.
- Architecture: HIGH — all five patterns map to shipped seams read in full; the publish-flip trigger behavior is VERIFIED in full-schema.sql.
- Pitfalls: HIGH — drawn from SEED-050/082 + the 099/101 mock-mask lessons + the verified lockstep/race patterns.
- Judge rubric design: MEDIUM — provider-docs (Anthropic) for the core; the exact scale is author-tunable.
- Freshness query shape: MEDIUM — the mechanic is sound; the exact documents-table query needs the live schema confirmed at plan time (Open Q1).

**Research date:** 2026-06-12
**Valid until:** 2026-07-12 (30 days — the substrate is stable; the only fast-moving item is the judge default model id, re-verify against live /models at plan time).
