# Phase 102: Reusable Validation-Gate Library + Output-Quality Gate - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-12
**Phase:** 102-reusable-validation-gate-library-output-quality-gate
**Areas discussed:** Judge gate + policy semantics, Golden run mechanics, Freshness validator design, Library shape + v1 scope
**Mode:** freeform one-question-at-a-time (operator preference), recommendations inline

---

## Judge gate + policy semantics

| Option | Description | Selected |
|--------|-------------|----------|
| A | Full SEED-082 policy enum engine-side (strict\|flag\|partial\|draft + integrity strict\|documented_limit), no builder UI | ✓ |
| B | Strict-only; enum slides to 103 | |
| C | Full enum + per-run override + failure-UX actions | |

**User's choice:** A → **D-01**

| Option | Description | Selected |
|--------|-------------|----------|
| A | Judge failure rides the standard gate loop (retry w/ critique, then policy decides) | ✓ |
| B | Judge always advisory at run time | |

**User's choice:** A → **D-02**

| Option | Description | Selected |
|--------|-------------|----------|
| A | Designated judge model in app_settings, strong + forceable, independent of run model | ✓ |
| B | Judge = the run's model | |
| C | Hardcoded judge model | |

**User's choice:** A → **D-03**

| Option | Description | Selected |
|--------|-------------|----------|
| A | Rubric stored in definition, frozen on publish; standard core + business_requirement; author-extensible | ✓ |
| B | Rubric auto-generated at run time | |
| C | Fully hand-authored, no standard core | |

**User's choice:** A → **D-04**

---

## Golden run mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| A | Real end-to-end flagged workflow_run, judge grades output, no mocks, no opt-out | ✓ |
| B | Simulated/partial run | |
| C | Optional per workflow | |

**User's choice:** A → **D-05**

| Option | Description | Selected |
|--------|-------------|----------|
| A | Rubric-based pass only | |
| B | Rubric pass + persisted output snapshot as reference artifact | ✓ |
| C | Exact/similarity matching vs stored expected output | |

**User's choice:** B → **D-06**

| Option | Description | Selected |
|--------|-------------|----------|
| A | Server-side POST /workflows/{id}/publish in 102 — the only publish path; 103 is a client | ✓ |
| B | Library function only; 103 wires the endpoint | |
| C | Gate in seeders only | |

**User's choice:** A → **D-07**

| Option | Description | Selected |
|--------|-------------|----------|
| A | Structured blocked verdict (stage + named failures + golden run id) + audit receipt | ✓ |
| B | 4xx with human-readable message | |

**User's choice:** A → **D-08**

---

## Freshness validator design

**Q1 (freeform):** Confirmed the stale-sources + version-ambiguity reading, per-workflow `max_age_days` (no global default), deterministic-only v1.
**Operator steer (verbatim intent):** not all workflows need a date check — e.g., a free financial-report analysis over a scoped folder/document types, tool-driven, no template, PDF output with charts/tables/diagrams, loose section structure. Do not make gates mandatory at workflow build time. → **D-09** (library-wide menu-not-checklist principle; QUAL-01 publish gate stays mandatory with an adaptive rubric; structure_check loose mode; output_file_valid format-aware; PDF emitter noted for Phase 106).

| Option | Description | Selected |
|--------|-------------|----------|
| A | Generic `timing: pre \| post` on the validator spec; freshness = first pre validator | ✓ |
| B | Auto-injected first phase | |

**User's choice:** A → **D-10**

| Option | Description | Selected |
|--------|-------------|----------|
| A | Generic `ask_user` fourth on_failure disposition via 085 machinery; choices + receipts + expiry | ✓ |
| B | Hardcoded ask_user inside freshness only | |

**User's choice:** A → **D-11**

---

## Library shape + v1 scope

| Option | Description | Selected |
|--------|-------------|----------|
| A | 5 first-class kinds in the closed VALIDATOR_REGISTRY, thin wrappers over existing primitives | ✓ |
| B | Programmatic registry fns under the existing `programmatic` kind | |

**User's choice:** A → **D-12**

| Option | Description | Selected |
|--------|-------------|----------|
| A | business_requirement additive-optional on WorkflowDefinition; required at publish | ✓ |
| B | New DB column + migration | |

**User's choice:** A → **D-13**

**Q3 (combined cut lines):** citations_required = deterministic on emit outputs + presence mode (≥N markers) on text, "every claim cited" → judge rubric; structure_check loose mode = named sections present, order-insensitive. **User agreed** → **D-14**

---

## Claude's Discretion

Receipt event-type names + harness_audit CHECK migration shape; module layout; exact field naming (policy enum, timing, golden-input storage, golden-run flag); judge prompt + flat verdict schema; flag/partial/draft mark rendering (within "marks or blanks, never silent").

## Deferred Ideas

Free-form PDF-with-charts emitter (→106), per-run policy override (→103), one-click failure-UX (→run-surface), builder model-fit warnings + badges (→103/EVAL-01), semantic duplicate detection (→knowledge-health), threshold(N%) policy (YAGNI), org policy floor (→107).

## Reported-bugs routing

6 open reports reviewed; none folded. minimax-m3-invalid-tool-args-400 marginally relates (judge calls providers) but the forced-emit seam already hard-validates — left open.
