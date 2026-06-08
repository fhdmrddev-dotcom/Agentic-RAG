---
phase: 097-spike-risk-register-template-fill-authoring-feel
plan: 04
subsystem: workflow-authoring
tags: [spike, anthropic, forced-tool, WorkflowDefinition, nl-authoring, grounding, throwaway]

# Dependency graph
requires:
  - phase: 097-01
    provides: "scripts/spike-097/ scaffold, docxtpl risk-register template, spike-config.json (confirmed folder_id + user_id + template_path), find_risk_folder.py folders/BFS read"
  - phase: 097-02
    provides: "the native-Anthropic forced-tool call shape that mirrors but never imports anthropic_service (red line / G-5); the bound-scope retrieval pattern"
provides:
  - "Unknown (c) answered: the authoring-time grounding inventory the NL→workflow generator NEEDS (folder tree + tool names + template placeholders = MUST-HAVE; skill registry = nice-to-have)"
  - "Unknown (d) answered: describe→refine→publish feel verdict = MIXED, with two operator conditions for GOOD (grey-area validation loop + tweak-to-new-version)"
  - "Evidence that one-shot structured generation over the strict WorkflowDefinition schema (extra='forbid') yields correctly-typed, schema-valid drafts from plain English + one conversational refine"
  - "The PROJ-02 schema gap surfaced with evidence: no bound folder_scope/project_folder_id → scope leaks into prompt text"
affects: [098, 099, 100, 101, 103, "PROJ-02", "WFAUTH-02", "v2.9 schema lock"]

# Tech tracking
tech-stack:
  added: []   # throwaway spike — no production deps; reuses docxtpl (097-01 venv-only) + anthropic SDK shape
  patterns:
    - "Grounded one-shot structured generation: forced tool_choice with input_schema = WorkflowDefinition.model_json_schema(); model_validate() + re-prompt-once on ValidationError"
    - "Design-time grounding bundle (names only): folder tree + tool registry names + skill names + template-derived placeholders — no document content sent"
    - "Mirror-not-import of the production provider service (red line / G-5) carried from 097-02"

key-files:
  created:
    - scripts/spike-097/out/unknown-d.md
    - .planning/phases/097-spike-risk-register-template-fill-authoring-feel/097-04-SUMMARY.md
  modified: []

key-decisions:
  - "Feel verdict = MIXED (NOT GOOD): authoring mechanism works but is gated on a grey-area validation loop + a tweak-to-new-version path that aren't built yet"
  - "No silent substitution rule: Phase 103 authoring must SURFACE every ambiguity (unresolvable folder ref, vague scope, unmapped placeholder, missing tool/skill) for human validation — clarify-as-you-go, not one-shot-and-hope"
  - "Editability is a versioning operation: immutability applies per-version, not per-workflow; tweak republishes a new version (WorkflowDefinition.version + 'no-edit-published' anchor)"
  - "Grounding inventory (unknown c): folder tree + tool names + template placeholders are MUST-HAVE; skill registry is nice-to-have (unused this run)"
  - "PROJ-02 confirmed needed: scope must become an additive bound folder_scope/project_folder_id, not free-text in a prompt"

patterns-established:
  - "Authoring-feel verdict is an operator (human) artifact — VALIDATION manual-only; the spike captures a written verdict + a GOOD/MIXED/POOR rating, not a metric"

requirements-completed: []   # SPIKE — closes NO REQ-ID. Informs (does not close) WFAUTH-02 / PROJ-02.

# Metrics
duration: ~15min
completed: 2026-06-09
---

# Phase 097 Plan 04: Authoring-Feel Verdict (unknowns c + d) Summary

**A grounded one-shot generation over the strict WorkflowDefinition schema turned one plain-English sentence into a correctly-typed 4-phase pipeline and absorbed a conversational refine — but the operator rates the describe→refine→publish feel MIXED until a grey-area validation loop and a tweak-to-new-version path are built.**

## Performance

- **Duration:** ~15 min (continuation: verdict recording + plan close only — Task 1 generation was committed in 528e1d53)
- **Started:** 2026-06-09 (continuation executor)
- **Completed:** 2026-06-09
- **Tasks:** 2 (Task 1 generation — completed in prior run/commit; Task 2 human-verify verdict — completed here)
- **Files modified:** 1 created this run (unknown-d.md) + SUMMARY/STATE/ROADMAP

## Accomplishments

- **Unknown (c) — grounding inventory answered.** The generator drew on four design-time sources; the draft actually USED the KB folder tree, the tool-registry names, and the template placeholders, and did NOT use the skill registry this run. Net: folder tree + tool names + template placeholders = MUST-HAVE grounding for the Phase 103 generator prompt; skill registry = nice-to-have. `folder_scope` had nowhere bound to live (no schema field), so scope surfaced only as a resolved folder id embedded in prompt text → the single biggest schema gap (PROJ-02). Full inventory: `scripts/spike-097/out/unknown-c.md`.
- **Unknown (d) — feel verdict answered = MIXED.** The conversational shape is promising (one sentence → correctly-typed 4-phase pipeline; refine absorbed as intent without hand-editing JSON; human-confirm inferred from "pause for me to confirm"), but it is MIXED because the generator SILENTLY GUESSED on ambiguities rather than surfacing them. Recorded verdict: `scripts/spike-097/out/unknown-d.md`.
- **Two operator conditions for GOOD captured as Phase 103 acceptance bars:** (1) a clarify-as-you-go grey-area validation loop (no silent substitution); (2) a tweak→new-version authoring path (immutability per-version, not per-workflow).

## Task Commits

1. **Task 1: authoring_feel.py — grounded one-shot generation + refine loop + transcript** — `528e1d53` (feat) — completed in the prior executor run; produced `authoring_feel.py`, `out/transcript.md`, `out/unknown-c.md`.
2. **Task 2: Operator records the describe→refine→publish feel verdict → out/unknown-d.md** — committed with the plan-close commit below (human-verify checkpoint resolved; operator verdict = MIXED).

**Plan metadata:** committed with `docs(097-04): record authoring-feel verdict (MIXED) + complete Plan 04` (this SUMMARY + unknown-d.md + STATE.md + ROADMAP.md).

## Files Created/Modified

- `scripts/spike-097/out/unknown-d.md` - The written subjective verdict on unknown (d): feel = MIXED, the two friction points (silent guess on non-existent "Acme" folder; "/Risks subfolder" mapped onto the whole folder with no such subfolder existing), what felt good (conversational refine, correct phase typing, inferred human-confirm), and the two operator conditions for GOOD (grey-area validation loop + tweak-to-new-version) — carried to Phase 103/098. >200 bytes, contains the `MIXED` rating line.
- `scripts/spike-097/out/transcript.md` - (from Task 1, commit 528e1d53) the describe → refine → re-draft conversation + two schema-valid WorkflowDefinition JSON blocks — the evidence the verdict judges.
- `scripts/spike-097/out/unknown-c.md` - (from Task 1) the authoring-time grounding inventory feeding WFAUTH-02.
- `scripts/spike-097/authoring_feel.py` - (from Task 1) the throwaway grounded generator + refine loop.

## Unknown (c) answer — grounding inventory (cross-ref `out/unknown-c.md`)

| Grounding source | Provided | Used by the draft | Verdict |
|---|---|---|---|
| (a) KB folder tree (name+id) | yes (5 folders) | YES — bound folder ids embedded | MUST-HAVE (needed to resolve spoken names/paths to ids) |
| (b) Tool registry (names only) | yes (24 tools) | YES — populated `available_tools` whitelists; 0 off-registry | MUST-HAVE (Phase 102 lint guards off-registry names) |
| (c) Skill registry (names) | yes (3 skills) | NO — unreferenced this run | nice-to-have (carry it so skill-backed phases are authorable) |
| (d) Template placeholders | yes (3 fields) | YES — `project_name, report_date, rows` | MUST-HAVE (shapes the fill/render step) |

**`folder_scope` shape finding:** the current strict schema has no `folder_scope`/`project_folder_id`, so scope could only be expressed as a **resolved folder id inside an llm_agent prompt string** — a hint the agent can widen, not a server-side bound parameter. The "/Risks subfolder" reference also proves the generator must RESOLVE a spoken path against the real tree (no literal `/Risks` child exists). → **PROJ-02**: add additive bound `folder_scope` (per-phase) + `project_folder_id` (per-definition), bound via the existing `ToolContext.folder_subtree_ids` seam.

## Unknown (d) answer — feel verdict (cross-ref `out/unknown-d.md`)

**Feel rating: MIXED.** Operator verbatim: *"Mixed until the workflow is built. The user must have to validate the grey areas until the workflow is built and of course user should be able to modify later or tweak as v2, v3..."*

- **What felt good:** one sentence → a correctly-typed `llm_agent → llm_single → llm_human_input → llm_agent` pipeline; the refine ("pull only from /Risks", "add a confirm step") was absorbed as intent without hand-editing JSON; the human-confirm phase was INFERRED from "pause for me to confirm" in the FIRST draft; tools and template fields came through clean (zero off-registry hallucinations).
- **What made it MIXED (the friction):** the generator SILENTLY GUESSED on grey areas instead of surfacing them — (1) it substituted a non-existent "Acme" folder with the real "Project Meridian — Risks" folder without asking; (2) it mapped the spoken "/Risks subfolder" onto the whole folder (no such subfolder exists), writing "this is the /Risks subfolder" into the prompt as settled fact. Both are confident, schema-valid guesses a non-coder would only catch by inspecting the embedded folder id — that is wiring-by-inspection, not talking.
- **The two operator conditions for GOOD:** (1) a **grey-area validation loop** — during authoring the AI must surface every ambiguity (unresolvable folder ref, vague scope, unmapped placeholder, missing tool/skill) for the user to validate, iteratively, with NO silent substitution; (2) **post-build editability/versioning** — a published workflow must not be frozen; the user can tweak it into v2, v3 (immutability per-version, not per-workflow; `WorkflowDefinition.version` + "no-edit-published" anchor already support republishing a new version).

## Decisions Made

- Recorded the rating as **MIXED**, faithful to the operator's wording — explicitly NOT inflated to GOOD despite the strong conversational mechanism, because both named conditions are unbuilt.
- Framed editability as a **versioning** operation compatible with the existing immutability anchor, so Phase 098/103 do not read it as a conflict.

## Deviations from Plan

None - plan executed exactly as written. (Continuation executor: Task 1 was already complete and committed `528e1d53`; this run recorded the Task 2 human-verify verdict and closed the plan, per the continuation prompt.)

## Issues Encountered

None. The Task 2 automated verify (`unknown-d.md` > 200 bytes + a GOOD/MIXED/POOR rating present) passed first run: `unknown-d verdict OK`.

## Threat Surface

No new threat surface. Per the plan's threat register: T-097-12 (schema injection) stays mitigated by the strict `extra="forbid"` schema + `model_validate()`; T-097-13/14 accepted (names-only grounding; draft never executed in the spike — Phase 102 lint + the publish-time gate are the production guard, recorded as a Phase 103 requirement). The unknown-d verdict makes the grey-area validation loop an additional Phase 103 correctness requirement (prevents silent wrong-folder binding).

## Known Stubs

None. This is a throwaway spike whose deliverables are evidence artifacts (Markdown verdict + transcript + grounding inventory), not production code paths. No stubbed data flows to any UI.

## Next Phase Readiness

- **Plan 097-05 (Wave 3 — go/no-go):** both Wave-1 unknowns (a from 097-02, c+d from 097-04) are now answered with written evidence; only Wave 2 (097-03, unknown b) remains before the Plan 05 conclusion can be assembled. The MIXED rating + the two conditions are ready to carry into the go/no-go.
- **Phase 103 (Workflows page + NL authoring, WFAUTH-02):** acceptance bars = the clarify-as-you-go grey-area validation loop (no silent substitution) + the tweak→new-version path. G-2 sketch-gated.
- **Phase 098 (Project Binding + KB Scope Governance, PROJ-02):** add the additive bound `folder_scope` + `project_folder_id`; generator resolves spoken folder names/paths → ids.
- No blockers introduced.

## Self-Check: PASSED

- `scripts/spike-097/out/unknown-d.md` — FOUND (verified on disk; Task 2 verify printed `unknown-d verdict OK`; >200 bytes; contains `MIXED`).
- `.planning/phases/097-spike-risk-register-template-fill-authoring-feel/097-04-SUMMARY.md` — FOUND (this file).
- Task 1 commit `528e1d53` — FOUND in git log (`feat(097-04): grounded WorkflowDefinition generation + refine loop`).
- No files written under `backend/` (CLAUDE.md constraint honored — all artifacts under `scripts/spike-097/` + `.planning/`).

---
*Phase: 097-spike-risk-register-template-fill-authoring-feel*
*Completed: 2026-06-09*
