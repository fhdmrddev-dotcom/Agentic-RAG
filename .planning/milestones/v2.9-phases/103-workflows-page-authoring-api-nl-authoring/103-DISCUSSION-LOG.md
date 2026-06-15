# Phase 103: Workflows Page + Authoring API + NL Authoring - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 103-workflows-page-authoring-api-nl-authoring
**Areas discussed:** Confirm-at-discuss verification (3 items), Run launch inputs, NL-gen authoring model, Template grounding supply, Drafts/seeds shelf

---

## Confirm-at-discuss items (SPEC-flagged) — resolved by codebase investigation, not by asking the user

SPEC.md flagged three items to confirm against the real code before locking the wire contracts.
Per the discuss-phase philosophy (codebase patterns are Claude's to investigate, not the user's
to decide), these were resolved by three parallel Explore agents and then **adversarially
re-verified** by three independent refute-by-default agents (workflow `verify-103-confirm-items`).

| Item | Finding | Verdict |
|------|---------|---------|
| `threads.py` kickoff route+field shape | kickoff carries ONE field (`content`→`kickoff_prompt`); no structured inputs; project scope baked into definition; thread must pre-exist; `active_workflow_run_id` set atomically in `create_workflow_run` | 6/6 sub-claims CONFIRMED |
| Phase 101 template-asset supply mechanism | `AssetRef` + `resolve_template_source` + `parse_docx_template_variables` exist; NO library-upload HTTP route; supply via asset-id reference OR placeholders-in-body | 5/5 sub-claims CONFIRMED |
| judge `named_failures` entry shape | POLYMORPHIC across stages; judge = `{criterion,score,evidence}`/`{summary}`/string; render by key-detection; string/unknown → block | 5/5 sub-claims CONFIRMED |

**Total: 16/16 sub-claims confirmed, 0 refuted, 0 partial.** File:line evidence captured in
CONTEXT.md `<decisions>` (D-103-CONF-1/2/3) and `<canonical_refs>`.

---

## Run launch inputs

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Single textarea + folder chip | One "what should this run work on?" textarea (→ `kickoff_prompt`) + read-only bound-folder chip + optional declared-inputs hint line | ✓ |
| (b) Labeled input_keys fields | Surface the workflow's declared `input_keys` as separate labeled fields, folded into the one content string | |

**User's choice:** (a) — "proceed with your recommendations."
**Notes:** Forced by the wire reality (D-103-CONF-1): `MessageCreate` carries only `content`; structured inputs would require touching `threads.py` (forbidden, G-5 + RED LINE). Hint line keeps the UX informative without fake structure. Run button stays enabled on empty input.

---

## NL-gen authoring model

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Fixed forceable authoring default | New `Settings.harness_authoring_model` knob (mirrors `harness_judge_model`); strong forceable default | ✓ |
| (b) Composer's selected model | Use whatever model the user currently has selected in the composer | |

**User's choice:** (a) — "proceed with your recommendations."
**Notes:** Consistent draft quality, guaranteed forceability for the structured emit, operator-swappable (preserve-optionality). Cross-provider VALIDATION still proves the path on DeepSeek/Moonshot/GLM/MiniMax.

---

## Template grounding supply

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Minimal + capable endpoint, no Builder upload UI | Headline grounds on folder tree + tool/skill registry; template OPTIONAL via `template_asset_id?` or `template_placeholders?` in the `/workflows/generate` body; no new upload route; no Builder upload control in 103 | ✓ |
| (b) Reuse ephemeral thread-upload | Wire the thread-scoped `POST /threads/{id}/workspace/files` into the Builder | |
| (c) Build a library-upload route | Net-new upload endpoint | (excluded by SPEC) |

**User's choice:** (a) — "proceed with your recommendations."
**Notes:** No library-upload route exists (D-103-CONF-2); (a) satisfies the SPEC "reference an ingested asset OR pass placeholders" clause with zero new infra. Builder upload affordance deferred (consistent with D-103-C).

---

## Drafts/seeds shelf

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Drafts + Build-card only | The caller's own drafts + the dashed "Build a workflow" card; "seeds" stays a label | ✓ |
| (b) Pre-seeded starter templates | Ship fork-able starter workflows in 103 | |

**User's choice:** (a) — "proceed with your recommendations."
**Notes:** Starter library deferred to SEED-084 with a concrete re-open trigger.

---

## Claude's Discretion
- Builder "Composing…" loading copy/visual + second-failure error surface (contracts locked, presentation discretionary).
- `deriveTier()` exact STRICT/MIDDLE/LOOSE thresholds (mapping rule fixed, presentation discretionary).
- Workflows nav lucide icon (`Workflow` vs `GitBranch`).

## Deferred Ideas
- Starter/seed workflow library → SEED-084.
- Sketch-022 run-surface DEEP refinement + 3 routed render bugs → D-103-A (103.1/104).
- Builder template-upload affordance → D-103-3 deferred.
