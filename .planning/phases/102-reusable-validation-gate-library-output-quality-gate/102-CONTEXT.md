# Phase 102: Reusable Validation-Gate Library + Output-Quality Gate - Context

**Gathered:** 2026-06-12
**Status:** Ready for planning

<domain>
## Phase Boundary

**This phase delivers two things on the shipped harness substrate:**

1. **A reusable validation-gate library** — five author-attachable validator kinds (`citations_required`, `freshness`, `structure_check`, `output_file_valid`, `llm_judge_rubric`) added as first-class kinds to the existing closed `VALIDATOR_REGISTRY` (Phase 091), each riding the existing gate + bounded-retry ≤3 + `on_failure` routing loop.
2. **The output-quality publish gate (QUAL-01)** — a workflow declares exactly one `business_requirement`; a server-side publish path enforces structural lint → a real golden run → an `llm_judge` verdict as a **HARD publish blocker**. A structurally lint-clean workflow that produces bad output cannot publish.

Plus the **SEED-082 policy-enum co-design (engine side only)**: `citation_policy: strict | flag | partial | draft` and the integrity `strict | documented_limit` sibling — the semantics layer Phase 103's builder will surface with one plain-language question.

**Requirements:** GATE-01, QUAL-01. **NL-authoring (103) MUST NOT ship without QUAL-01.**

**Out of scope (consumers / later phases):** the Workflows page + builder UI and the "compliance-grade or working-grade?" authoring question (→ 103), per-run policy overrides + one-click failure-UX actions (→ run-surface work), free-form PDF/charts emitters (→ 106), the receipt VIEW (→ 107), budget preflights (→ 105 — but they reuse this phase's `timing: pre` seam).

**Red lines (unchanged):** Deep Mode byte-identical; additive-optional schema, zero-migration discipline on `WorkflowDefinition`; closed registries, never eval; D-08 honest-failure ladder unchanged for true failures; no model-written code touches workflow deliverables; `strict` stays the default policy everywhere; verdict computation unchanged by policy (policy only changes what happens AFTER the verdict).
</domain>

<decisions>
## Implementation Decisions

### Judge gate + policy semantics (SEED-082 co-design, engine side)
- **D-01:** 102 ships the **full policy enum engine-side**: `citation_policy: strict | flag | partial | draft` on the `llm_emit` phase config (strict = today's behavior, stays DEFAULT, strict path byte-identical) + the judge verdict disposition designed in the **same vocabulary** + the F3 integrity sibling `strict | documented_limit` (pptx/xlsx deliver-with-documented-limit instead of always integrity-rejecting). **No builder UI** — 103 asks the plain-language question. Per-run overrides and one-click failure-UX actions are explicitly deferred. Policy semantics per SEED-082: `flag` = always deliver WITH visible marks + coverage summary; `partial` = blank uncited values (null-over-invent), deliver + gap list; `draft` = no citation enforcement, doc visibly labeled DRAFT. Every non-strict mode marks or blanks — never silent pass-off.
- **D-02:** A run-time judge failure rides the **standard gate loop** — bounded retry ≤3 with the judge's critique fed back into the prompt (this is where quality improvement actually happens), then the workflow's declared policy decides: `strict` → honest fail with receipt; `flag` → deliver WITH the judge's verdict surfaced visibly ("Quality check: N concerns — …"). One policy family governs both the citation gate and the judge gate. No new engine machinery.
- **D-03:** The judge model is a **designated model in `app_settings`** (settings-not-env), defaulting to a strong TIER-FORCE-capable model, **independent of the run model** — no self-judging; a coerce-tier or weak run model never becomes the publish blocker's weak link. Per-workflow override allowed but optional. EVAL-01-style measurement can make routing data-backed later (SEED-082 Dimension 3 → 103).
- **D-04:** The rubric is **stored explicitly in the workflow definition** (`llm_judge_rubric` validator config), frozen on publish: a **standard core** (grounded in the evidence? actually answers the `business_requirement`? did the work rather than delegating back to the user? — the SEED-050 failure modes) + the `business_requirement` woven in + author-extensible criteria. 103's NL authoring auto-drafts it. Inspectable + immutable — verdicts are reproducible against a known rubric, never derived on-the-fly at run time.
- **The judge verdict is itself a forced emission** via the 101.1 `forced_emit` seam (locked in 101.1 CONTEXT deferred section — "bulletproof for free"): cross-provider tiering, narrated-JSON recovery, truncation rejection, and honest failure all inherited.

### Golden run mechanics (QUAL-01)
- **D-05:** The golden run is a **real end-to-end `workflow_run`** against the project KB — author-supplied golden input (a representative kickoff prompt), executed by the real engine, **flagged as a validation run** — and the judge grades the final output against the rubric + `business_requirement`. Verdict-with-evidence persists as receipts. **No mocks** (the 099/101 mock-shape-drift lesson), **no opt-out** (HARD blocker). The golden run IS the judge gate executed once at publish time on a real run; cost (real tokens, minutes) is acceptable because publish is a rare deliberate event.
- **D-06:** Passing = **rubric-based** (judge passes + the structural gates — citations, integrity — pass on that run). **No automatic comparison to stored expected output** (the KB is alive; byte-golden rots). The golden run's **output snapshot IS persisted** with the receipts as a human-inspectable reference artifact — "what good looked like at publish approval" — for Phase 107 governance and future regression debugging. Criteria are golden, not bytes.
- **D-07:** 102 ships the **server-side publish path**: `POST /workflows/{id}/publish` is the ONLY way a draft becomes published, enforcing in order: structural lint (existing `reachability.py`) → golden run → judge verdict → flip to published. 103's page is just a client (same discipline as 092's server-enforced mode lock). Gives 102 a live-UAT story without 103's UI. Existing seed scripts remain dev fixtures; the endpoint is canonical and 103 must not bypass it.
- **D-08:** A blocked publish returns a **structured verdict**: which stage blocked (lint / structural gate / judge), named failures (lint codes / failing validator / per-criterion judge critique), and the `workflow_run` id of the golden run — a real, browsable run whose timeline + receipts show exactly what happened. Machine-renderable for 103 (nothing prose-only). The blocked attempt itself writes an audit receipt — publish attempts are governance events (Phase 107).

### Freshness validator + library-wide openness (OPERATOR STEER)
- **D-09 (operator-directed, library-wide principle):** **No library validator is mandatory.** The library is a menu the author picks from, never an auto-imposed checklist. Workflow variations must stay open — e.g., a free-form financial-report analysis over a scoped folder / document types, tool-driven (the per-phase tool whitelist selects which application tools the workflow uses), NO template, output possibly PDF with charts/tables/diagrams, sections loosely structured, not strict. Such workflows attach zero or few gates. Only the QUAL-01 publish gate stays mandatory — and its **rubric adapts to the workflow's declared `business_requirement`** (free-form workflows are judged on free-form criteria, not template strictness). Consequences threaded through the library: `structure_check` gets a **loose mode**; `output_file_valid` is **format-aware** (not OOXML-only — PDF-ready so Phase 106 emitters slot in without rework).
- **Freshness semantics:** opt-in (per D-09). Two deterministic checks against the workflow's KB scope (the 098 project-folder binding): (1) **stale sources** — newest relevant document older than a **per-workflow `max_age_days`** (author sets it when attaching; NO global default — staleness is meaningless without the deliverable's cadence); (2) **version ambiguity** — deterministic v1 only: the app's own version history (superseded versions) + exact-stem filename collisions (`report-v2.docx` / `report-v3.docx`). Semantic duplicate detection ("draft" vs "final" as separate uploads) is deferred — it's a knowledge-health problem, not a gate problem.
- **D-10:** A generic **`timing: pre | post` field on the validator spec** (default `post` — every existing gate byte-unchanged). A `pre` validator runs BEFORE the phase body, checking inputs/scope rather than output. Freshness is the first `pre` validator; the seam is generic so future preflights (Phase 105 budget caps) reuse it.
- **D-11:** **`ask_user` becomes a generic fourth `on_failure` disposition** (`fail_run` / `retry` / `skip_to_phase` / `ask_user`) — any validator can declare it. The engine pauses via the existing Phase 085 `ask_user_service` cross-worker machinery (battle-tested in `llm_human_input`), presenting the validator's structured finding as choices: staleness → "Proceed anyway / Abort"; version ambiguity → "Use version X / Use version Y / Abort". **Proceed** continues with the user's choice written as an **audit receipt** (someone explicitly approved grounding on stale data — governance-relevant). **Abort** → honest `fail_run`. Unanswered inherits the existing ask_user expiry → honest fail, never a hung run.

### Library shape + v1 scope
- **D-12:** The 5 library validators are **first-class kinds in the closed `VALIDATOR_REGISTRY`** — thin wrappers over primitives that already exist: `citations_required` wraps `check_coverage`; `output_file_valid` wraps `assert_integrity` (made format-aware); `structure_check` builds on `json_schema` + the loose mode; `llm_judge_rubric` rides `forced_emit`; `freshness` is net-new. First-class kinds because the registry doubles as **103's author-facing menu** — per-kind config schemas stay legible.
- **D-13:** `business_requirement` is an **additive-optional field on `WorkflowDefinition`** (Pydantic over the JSONB content — old rows `model_validate` unchanged, zero migration). **Optional on drafts, required at publish** — the D-07 endpoint refuses a draft with no declared `business_requirement`, making "exactly one" a publish-time invariant rather than a schema constraint. Free text, one sentence — the author's plain-language statement the rubric anchors to.
- **D-14 (v1 cut lines — principle: deterministic gates check what's provable; the judge owns judgment):**
  - `citations_required`: **deterministic mode on emit outputs** (wraps `check_coverage` — the GATE-01 "deterministically rejects uncited register rows before any judge call" wording) + a **simple presence mode for text outputs** (at least N citation markers, configurable). "Every claim is cited" on prose is NOT pretend-deterministic — that judgment belongs to the `llm_judge_rubric` standard core's grounded-criterion.
  - `structure_check` loose mode: **named sections/headings present in the output** (author lists them; gate checks each appears) — order-insensitive, extra sections allowed. "Sections are well-developed" → judge rubric, not a structural gate.

### Claude's Discretion
- Receipt event-type names + the `harness_audit` CHECK migration shape (follow the 101.1 migration-069 ALTER pattern; likely new kinds for judge/publish/policy/ask_user-approval events — numbered migration, live-apply via SQL editor, full-schema regen).
- Module layout: grow `validators.py` vs. sibling modules under `harness/`; where the publish service lives relative to `api/workflows.py`.
- Exact field naming for the policy enum + `timing` + golden-input storage on the definition; the golden-run flag mechanics on `workflow_runs`.
- Judge prompt shape and the judge's emit schema (it is a forced emission — design the verdict schema flat per D-09/101.1 rules: shallow, `additionalProperties:false`, citation-as-sibling).
- How `flag`/`partial`/`draft` render their marks (inline suffix vs appendix table; DRAFT watermark mechanics) — within SEED-082's "marks or blanks, never silent" rule.

### Routed bugs (cross-check 2026-06-12)
- 6 open `surface: Agentic-RAG` reports reviewed; **none folded.** BUG-260609-02/-04, BUG-260610-01, BUG-260603-01, BUG-260607-02 are chat-surface/run-legibility — no overlap with the gate/publish domain. `minimax-m3-invalid-tool-args-400` (BUG-260607-03) marginally relates (the judge calls providers during runs) but the judge rides the 101.1 forced-emit seam which already hard-validates; **left open**, no fold.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase inputs (read first)
- `.planning/seeds/SEED-082-emit-gate-policy-flexibility.md` — the operator-directed policy option space (strict|flag|partial|draft semantics, red lines, scenario mapping, F3 documented_limit). D-01/D-02 implement its 102 half.
- `.planning/seeds/SEED-050-workflow-result-quality.md` — why the golden run exists (functionality ≠ quality; the gameable-token-gate and asks-the-user failure modes the rubric core must catch).
- `.planning/phases/101.1-guaranteed-emission-layer/101.1-CONTEXT.md` — D-05..D-08 forcing tiers + no-fail ladder + D-12 receipt posture; the deferred note locking "judge verdict = forced emission".
- `.planning/REQUIREMENTS.md` — GATE-01 + QUAL-01 verbatim.

### Code seams to extend (verified by scout)
- `backend/app/services/harness/validators.py` — the closed `VALIDATOR_REGISTRY` (4 kinds) + `register_validator` + `run_gates` fan-in; the 5 new kinds land here (D-12); `GateResult` carries `validator_index` for on_failure derivation.
- `backend/app/services/harness_engine.py` — `_run_phase_with_gates` (bounded retry ≤3 + critique feedback), `_parse_on_failure` / `_failing_on_failure` (the routing enum `ask_user` extends, D-11), `gate_passed`/`gate_failed` `write_audit` sites (the receipt pattern to enrich).
- `backend/app/services/harness/reachability.py` — publish-time structural lint (pure function; the D-07 endpoint's first stage; its docstring notes the publish endpoint was deferred — 102 closes that).
- `backend/app/services/forced_emit.py` — the sealed single-shot emission the judge rides (D-03/D-04).
- `backend/app/services/template_render_service.py` — `check_coverage` (citations_required wraps it), `assert_integrity` (output_file_valid wraps it; carries the documented_limit info F3 needs).
- `backend/app/services/ask_user_service.py` — the 085 pause/resume machinery D-11 reuses (SUBSCRIBE-first, expiry, cross-worker).
- `backend/app/models/harness.py` — `WorkflowDefinition` (+`business_requirement`, D-13), `ValidatorSpec` (+`timing`, D-10; `on_failure` enum, D-11), `LlmEmitPhaseConfig` (+`citation_policy`, D-01) — all additive-optional, `extra='forbid'`, zero-migration.
- `backend/app/api/workflows.py` — the existing published-list router the D-07 publish endpoint joins (does NOT touch `threads.py` — G-5).
- `backend/app/db/workflows.py` — definition/run CRUD the publish flip + golden-run flag extend.

### Spec re-confirm answered (ROADMAP note a)
- Gate verdicts ARE already persisted (`gate_passed`/`gate_failed` audit rows with error metadata, 091), but **evidence-rich receipts exist only on the emit path** (101.1 D-12). 102 brings judge/publish/policy receipts to D-12 richness.

### Project rules
- `CLAUDE.md` — Deep byte-identical red line, provider-docs-first, SC#10 4-axis UAT mandate, G-5 hot-file ledger (`threads.py` must not grow), migrations via SQL editor + full-schema regen.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (compose, don't rebuild)
- The **gate loop is complete** (091): closed registry, ordered execution, first-failure routing, bounded retry with critique feedback, `gate_failed` audit + SSE. The library is mostly new ENTRIES, not new engine.
- The **deterministic primitives exist** (101): `check_coverage` (per-leaf cited/uncited/invented verdict — policy only changes what happens AFTER it), `assert_integrity` (re-open oracle + documented_limit awareness).
- The **forced-emit seam exists** (101.1): the judge verdict is one more forced emission — tiering, recovery, honest failure inherited.
- The **pause/resume machinery exists** (085): `ask_user_service` with expiry; D-11 is a new caller, not new infrastructure.
- The **publish lint exists** (091): `reachability.py` pure function awaiting its endpoint.
- **WR-02 (101.1) persists the field-map durably** on `workflow_phases.output` — the substrate for `flag`/`partial`/`draft` delivery modes (re-render under a different policy without a new emit shot).

### Established Patterns (constraints to honor)
- Closed registries + decorator registration; unknown names raise, never eval (T-091-17).
- Additive-optional Pydantic on JSONB content; old rows `model_validate` unchanged; zero migration for schema fields (migrations only for the `harness_audit` CHECK extension).
- INSERT-only `harness_audit` receipts keyed to `run_id` + `definition@version` (D-12 posture).
- Provider work at the service boundary only; the judge inherits this via `forced_emit` — no new provider branches.
- Server-enforced invariants, UI as client (092 mode-lock precedent → D-07 publish endpoint).

### Integration Points
- New validator kinds register into `VALIDATOR_REGISTRY` (validators.py).
- `ask_user` disposition extends `_parse_on_failure` routing (harness_engine.py) + calls `ask_user_service`.
- `timing: pre` hooks into `_run_phase_with_gates` (or a sibling pre-hook in the phase execution path) before the executor body.
- Publish endpoint joins `api/workflows.py` router; golden run reuses `create_workflow_run` with a validation flag.
- `citation_policy` consumed inside `_exec_llm_emit`'s post-verdict handling (phase_types.py) — the strict branch byte-identical.
</code_context>

<specifics>
## Specific Ideas

- **The operator's framing sentence for QUAL-01:** a workflow is "strictly adherent to ONE business requirement" — the judge + golden run exist to make that provable, and the rubric core must catch the SEED-050 lived failures (the Research workflow that asked the user to do the research; the token-gate a model could game).
- **The free-form workflow archetype (operator, verbatim intent):** a free financial-report analysis over a scoped folder or document types, using selected application tools, NO template, output possibly a PDF with charts/tables/diagrams, sections loosely structured. The library must serve this workflow with zero or few gates attached — design every validator config so this archetype never hits a mandatory wall.
- **One policy family, two gates:** the SEED-082 enum governs both what the citation gate delivers and what the judge verdict does — designed once in 102, surfaced once in 103.
</specifics>

<deferred>
## Deferred Ideas

- **Free-form PDF-with-charts emitter** (the operator's financial-report archetype as a deliverable producer) → Phase 106 (new `EMITTER_REGISTRY` entry; pinned deterministic driver — reportlab/matplotlib already in the sandbox image). 102 only ensures `output_file_valid` is format-aware so it slots in.
- **Per-run policy override** (down-only? runner says "just a draft this once") → Phase 103 (SEED-082 Dimension 2); per-run override UP (draft→strict) always safe.
- **One-click failure-UX actions** ("Retry with [strong model]" / "Deliver as draft anyway" / "Show what's missing") → run-surface work (SEED-082 Dimension 4); the WR-02 persisted field-map already enables re-render-under-draft without a new emit shot.
- **Builder model-fit warnings + capability badges** ("this step needs a document-grade model") → Phase 103, data-backed by EVAL-01 (SEED-082 Dimension 3).
- **Semantic duplicate detection** for freshness ("draft" vs "final" as separate uploads) → knowledge-health family (F-09 dashboard), not a gate.
- **`threshold(N%)` citation policy** — YAGNI v1 per SEED-082; `flag`/`partial` cover the need.
- **Org/admin policy floor** (org mandates strict for certain template classes) → Phase 107 governance.

### Reviewed Todos (not folded)
No pending todos matched this phase (todo.match-phase returned 0).
</deferred>

---

*Phase: 102-reusable-validation-gate-library-output-quality-gate*
*Context gathered: 2026-06-12*
