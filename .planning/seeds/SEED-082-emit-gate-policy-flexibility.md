---
seed_id: SEED-082
title: Emit-gate policy flexibility — per-workflow citation/integrity strictness (strict | flag | partial | draft) + model-fit routing + failure-UX escalation
status: folded
partial: true
status_note: |
  ORIGINAL `status:` line, verbatim — displaced by Phase 251's frontmatter migration (D-10):
  status: partially-folded (102 half folded at Phase 102 discuss-phase 2026-06-12 — engine-side policy enum strict|flag|partial|draft + integrity strict|documented_limit + judge-verdict co-design captured as D-01/D-02 in 102-CONTEXT.md; 103 half — builder UX, model-fit routing, per-run override — stays pending its own trigger)

  The prose that followed the token, byte-for-byte:
  (102 half folded at Phase 102 discuss-phase 2026-06-12 — engine-side policy enum strict|flag|partial|draft + integrity strict|documented_limit + judge-verdict co-design captured as D-01/D-02 in 102-CONTEXT.md; 103 half — builder UX, model-fit routing, per-run override — stays pending its own trigger)

  Mapped `partially-folded` -> `folded` + `partial: true`. Reason: D-16 — folded on one axis, pending on another.
planted: 2026-06-12
phase_origin: "Phase 101.1 gaps-only live re-verify 2026-06-12 — operator direction after observing 4 weak-model honest failures"
category: workflow engine product semantics — what the citation/integrity gates DO with their verdict, per workflow; NOT a change to how the verdict is computed
related_seeds: [SEED-080]
related_memories: [project_101_1_emission_layer, project_provider_feature_fit_routing, feedback_business_value_framing, feedback_preserve_all_deferred_ideas]
related_decisions:
  - "101.1-CONTEXT D-08 (honest failure mandatory — never silent, never Markdown stand-in) — UNCHANGED by this seed; flexibility is about what 'honest' delivers, not about hiding failure"
  - "101.1 ratified line: no model-written code ever touches the deliverable — UNCHANGED; all policy modes below keep the pinned deterministic renderer"
  - "Phase 103/104 captured design gap: workflow builder has no model-selection design (model:null inherits composer → unforceable model silently gets best-effort)"
re_open_triggers:
  - Phase 102 (judge gate / output quality) discuss-phase begins — gate-policy enum is the same semantic family as the judge verdict policy; co-design them.
  - Phase 103 (NL workflow authoring / builder) discuss-phase begins — the builder MUST ask the deliverable-grade question ("compliance-grade or draft-grade?") and surface model-fit warnings at build time.
  - Any operator/user complaint that a fill workflow "fails too much" on their preferred model — the flag/partial modes are the answer before any gate-weakening hack.
  - EVAL-01 provider-feature-fit measurement lands — capability badges ("document-grade" vs "best-effort") become data-backed.
priority: high
suggested_phase: split across 102 (policy enum semantics + receipts) and 103 (builder UX + model routing); failure-UX escalation can ride either.
surface: Agentic-RAG
trigger_when: unset
---

# SEED-082 — Emit-gate policy flexibility (operator-directed, 2026-06-12)

## Context

101.1 live re-verify: the forced-emission pipeline works end-to-end (gpt-5.5/gpt-5.4-mini/GLM/nemotron render cited .docx) but 4 providers end in HONEST failures — DeepSeek/Gemini never commit the field-map; Sonnet/MiniMax emit full field-maps that the citation gate rejects (uncited/invented values). Operator: the all-or-nothing strict-reject is too rigid for many real business deliverables; wants the full option space "with honesty" — flexibility chosen during workflow BUILDING, not a global weakening.

Key architectural fact making this CHEAP: the citation gate already computes a per-leaf verdict (cited / uncited / invented, coverage %, covered_keys — all in the receipts today). Policy only changes what happens AFTER the verdict. The strict path stays byte-identical as the default. WR-02 fix (2026-06-12) already persists the field-map durably on `workflow_phases.output` — the substrate for "deliver the data even when the doc fails" exists.

## The option space (offer ALL of these; per-workflow, set at build time)

**Dimension 1 — citation_policy enum on the llm_emit phase config:**
- `strict` (today's behavior, stays DEFAULT): any uncited/invented value → reject deliverable, honest fail + receipts. For compliance/financial/legal.
- `flag`: ALWAYS deliver; uncited values rendered WITH a visible mark (inline "[unverified]" suffix OR an appendix/footnote table "Unverified values: …" — rendering style itself an option) + coverage summary in the surfaced message ("28/36 values cited; 8 flagged") + per-leaf status in the receipt. "Freedom with honesty" = disclosure instead of refusal.
- `partial` (null-over-invent): uncited values are BLANKED (— / empty), cited values fill; deliver the partially-filled doc + gap list. Nothing invented ever reaches the doc; usable as a draft skeleton. Good for data-room extraction.
- `draft`: no citation enforcement; deliver whatever validated against the schema, doc visibly labeled DRAFT (header/watermark + message). Citations attached where they exist. This is what most competitor apps do silently — we do it loudly.
- (optional refinement) `threshold(N%)`: deliver if coverage ≥ N else fail — probably YAGNI v1; flag/partial cover the need.

**Dimension 2 — where policy is set:**
- Per-workflow phase config at build time (PRIMARY — the builder asks ONE plain-language question: "Is this deliverable compliance-grade (reject anything unverified) or working-grade (deliver and mark unverified values)?")
- Per-run override DOWN-only? (runner says "just give me a draft this once") — decide at 103; per-run override UP (draft→strict) always safe.
- Org/admin default + floor (governance, Phase 107: org can mandate strict for certain template classes).

**Dimension 3 — model strategy (the operator's own suggestion; = the captured 103/104 gap):**
- Builder model-fit check: fill phases declare needs (TIER-FORCE + citation-discipline); builder warns/pins when the inherited composer model can't satisfy ("this step needs a document-grade model — pin one of: …").
- Fallback chain: on no-commit/rejection under strict, offer or auto-retry the emit shot on a designated strong model (visible attribution: "filled by gpt-5.5"); emit shot is sealed/isolated so cross-model retry is clean.
- Capability badges data-backed by EVAL-01 (measure, then route — provider-feature-fit).

**Dimension 4 — failure UX (strict-mode dead-ends become choices):**
- On reject: surface the preserved cited field-map as a usable artifact (table in chat or .json/.csv workspace file) + one-click actions: "Retry with [strong model]" / "Deliver as draft anyway" (re-render under draft policy — no new emit shot needed, the field-map is already persisted) / "Show what's missing" (named uncited leaves — already computed).

**Dimension 5 — non-policy levers that raise strict pass rates anyway:**
- WR-04/05 fixes shipped 2026-06-12 (coerce tier viable on STRUCTURED models; DeepSeek strict fixed) — re-measure before assuming model incapability.
- Per-provider evidence-spotlight tuning (101.1-06 precedent: OpenAI 0%→100% from prompt-side fixes alone; Sonnet/MiniMax rejections may be the same class).

**Scenario mapping (the "real business solution" framing):**
| Deliverable | Policy | Model strategy |
|---|---|---|
| Compliance/financial report | strict | pinned document-grade |
| Weekly status memo | flag | any model |
| Client proposal draft | draft | any model (human reviews) |
| Data-room extraction | partial | pinned preferred |
| Internal research summary | flag | any model |

## Red lines (what this seed does NOT permit)
- No model-written code in workflow deliverables (SSTI/audit/reproducibility — the reason 101 exists). The weekly-report-writer skill remains the Deep-chat answer.
- No silent delivery of unverified data — every non-strict mode marks or blanks, never passes off.
- Verdict computation unchanged; receipts always written; D-08 honest-failure ladder unchanged for true failures (no-commit, integrity, provider error).
- Also fold in finding F3: pptx/xlsx documented_limit semantics (deliver-with-documented-limit instead of always integrity-rejecting) belongs to the same policy family — integrity gate gets `strict | documented_limit` modes.
