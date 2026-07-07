# Phase 142: Non-Python Skill-Script Honesty (STRETCH) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-08
**Phase:** 142-non-python-skill-script-honesty-stretch
**Areas discussed:** Coverage breadth, Detection strategy, Signal surface + audience, read_skill_file + seed hygiene

---

## Coverage breadth

| Option | Description | Selected |
|--------|-------------|----------|
| All three (A+B+C) | Fire honesty on missing bundled file (G-A), non-Python script (G-B), AND missing binary (G-C). Matches SEED-096 routed decision; folds BUG-260707-02. | ✓ |
| B + C only | Non-Python + missing binary; skip the tree-flatten/missing-file case. | |
| G-B only (literal) | Just non-Python scripts — original SRH-01 / Phase 131 scope. | |

**User's choice:** All three (A+B+C).
**Notes:** Confirms the operator's 2026-06-29 SEED-096 routed broadening.

### Boundary follow-up (OUT line)

| Option | Description | Selected |
|--------|-------------|----------|
| Honesty-only, capability OUT | Detect + report only; do NOT preserve import tree, un-hardcode language, or add binaries. Tree-fidelity/Node/binaries stay DISC-01/v3.3+ (touch the risky COLL-01 seam). | ✓ |
| Allow cheap tree-fidelity too | Also fix import-flatten inside 142 so G-A files resolve — crosses into capability, bigger blast radius. | |

**User's choice:** Honesty-only, capability OUT.

---

## Detection strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Both | Declare capabilities upfront (prevent) AND a run-time backstop that reshapes + halts the retry loop. | ✓ |
| Reactive only | Just catch at run-time; model still burns the first attempt each time. | |
| Proactive only | Declare upfront but no backstop; a model that ignores it still fails silently. | |

**User's choice:** Both.

### Proactive home

| Option | Description | Selected |
|--------|-------------|----------|
| Tool desc + load_skill flag | Generic facts in the execute_code tool DESCRIPTION; per-skill specifics in the load_skill RESULT. Off the shared system prompt. | ✓ |
| Shared system prompt block | One static block in the system prompt — simplest but changes Deep's bytes (D-14 sensitivity). | |
| load_skill result only | Only annotate at skill-load; a raw execute_code without a loaded skill gets no upfront signal. | |

**User's choice:** Tool desc + load_skill flag.
**Notes:** Chosen deliberately to keep the proactive declaration off the shared system prompt, protecting the D-14 "Deep byte-identical" guarantee.

### Reactive backstop strength

| Option | Description | Selected |
|--------|-------------|----------|
| Reshape + repeat-guard | Honest permanent-framed message AND a per-run guard that short-circuits repeated identical dead calls — kills the 8-round loop by construction. | ✓ |
| Reshape only | Honest message but rely on the model heeding "do not retry" — a weak model could still loop. | |

**User's choice:** Reshape + repeat-guard.

---

## Signal surface + audience

| Option | Description | Selected |
|--------|-------------|----------|
| Model-facing + reuse UI | Reshaped tool_results / load_skill flags the model narrates honestly; one user-facing import note (SC#1) on the existing flow; no new UI → G-2 doesn't fire. | ✓ |
| + dedicated run-time card | Also render a distinct "sandbox can't run this" card — new UI → triggers G-2 sketch gate. | |
| Model-facing only | No import note, no card — under-delivers SC#1's required user-visible message. | |

**User's choice:** Model-facing + reuse UI.
**Notes:** Derived — the import note is inherently the G-B case (static ZIP scan); G-A/G-C are runtime-only.

---

## read_skill_file + seed hygiene

### SC#3 — read_skill_file reference-text

| Option | Description | Selected |
|--------|-------------|----------|
| In scope | Extend the text-ext whitelist to script types; return source as reference text with a "not executable here" caveat, replacing the misleading binary-error branch. | ✓ |
| Defer | Leave as-is — SC#3 is explicitly optional. | |

**User's choice:** In scope.

### Seed / skill-instruction hygiene

| Option | Description | Selected |
|--------|-------------|----------|
| Mechanism-only | Generic proactive+reactive makes any skill honest with NO per-skill edits; pptx/docx are user data; BUG-260707-02's data-fix becomes belt-and-suspenders. | ✓ |
| Also add save/import lint | Warn at save/import when instructions reference known-missing tools — drifts toward STD-01/skill-manifest scope. | |

**User's choice:** Mechanism-only.

---

## Claude's Discretion

- Exact reactive detection signatures (stderr patterns → G-A/G-B/G-C), the
  repeat-guard's "identical dead call" key, precise message wording, and pre-flight
  vs post-hoc detection per class — deferred to research/planning within the D-06
  framing (permanent, name-the-gap, offer-the-alternative).

## Deferred Ideas

- G-A tree-fidelity fix → DISC-01 / dedicated phase (after COLL-01 seam).
- G-B/G-C capability (Node in image, un-hardcode lang, route execute_code by
  language, add system binaries) → DISC-01 / v3.3+.
- STD-01 skill-declared runtime / manifest + a missing-tool save/import lint → own phase.
- Reviewed-not-folded todo: `spike-nl-workflow-authoring.md` (weak keyword match; unrelated).
