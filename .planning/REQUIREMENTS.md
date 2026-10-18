# Requirements: Milestone v4.7 Workflows You Can See and Start Anywhere

**Defined:** 2026-10-18 (operator intake; research skipped — every item has a planted seed with context)
**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviours (skills) that persist and can be shared.
**Milestone goal:** Workflows become easier to start, finish authoring and understand at a glance, with visuals that show what a run did.

Seeds folded at intake: SEED-232, SEED-195, SEED-014, SEED-084, SEED-164, SEED-051, SEED-183, SEED-086, SEED-337, SEED-348, SEED-155, SEED-152. SEED-163 is already delivered (Phase 193.2) and is only flipped (REG-06).

## v4.7 Requirements

### Start (START)

- [ ] **START-01**: From inside a thread, a user can start a workflow, fill its launch form, and see the run attached to that thread. — `SEED-232`
- [ ] **START-02**: An external system can start a workflow run through an authenticated inbound call and read the result back. Org-scoped, rate-limited, audited. — `SEED-195`
- [ ] **START-03**: A user can fork a starter workflow into their own draft in one click; at least 5 curated starters ship, each passing the publish gauntlet. — `SEED-084`
- [ ] **START-04**: A run started by a schedule or an inbound call shows how it was started, and its last and next run are visible. — `SEED-014`

### Author (AUTH)

- [ ] **AUTH-01**: A workflow that pauses for a person can be published, and the run surface shows who it is waiting on. — `SEED-164`
- [ ] **AUTH-02**: Describe-it authoring can take uploaded assets (template, form, reference docs) and derive the inputs, phases and tools from them. — `SEED-051`
- [ ] **AUTH-03**: A draft's configuration does not vanish when the author navigates away. — `SEED-183`

### See (VIS)

- [ ] **VIS-01**: A multi-agent workflow can be viewed as a truthful picture of orchestrator, workers and judge, with no edges the schema does not have. Sketch first (G-2). — `SEED-086`
- [ ] **VIS-02**: The agent can show more artifact types beyond chart, table and metric; the new set is chosen at sketch time from a closed registry only. — `SEED-337`
- [ ] **VIS-03**: A finished run has one read-only page, with export, showing what it did and on what evidence (definition version, phase log, verdicts, cited sources). — `SEED-348`
- [ ] **VIS-04**: The workflow library card matches its approved sketch: labelled phase chips, and the description no longer dominates. — `SEED-155`

### Trust (TRUST)

- [ ] **TRUST-01**: Each workflow phase output that came from the knowledge base carries a confidence level, shown on the run surface and in the receipt. — `SEED-152`

### Register hygiene (REG)

- [ ] **REG-06**: Seed statuses match reality: SEED-163 flipped, and each seed this milestone folds is updated.
- [ ] **REG-07**: Hot-file refactors that guardrail G-5 requires are done before the feature phases that touch those files.

## Future Requirements (deferred)

- `SEED-347` canvas scale hardening — conditional on a real large workflow.
- `SEED-013` Open Platform (public API, MCP server) — planned as v4.8.
- Owed operator verification from v4.6: Coolify rebuild confirmation, logged-in production smoke, 282 G4-4/G4-6/A1, 281 G-4 rows A/C/D.

## Out of Scope

| Item | Reason |
|------|--------|
| New tools, phase types or emitters beyond the closed core (7 / 1 / 30) | Extension Contract; needs explicit approval per requirement |
| Open Platform / public API / MCP server | Next milestone (v4.8) |
| Medium/minor open bugs not named above | Carried in `.planning/reported-bugs/` |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|

---
*Requirements defined: 2026-10-18*
