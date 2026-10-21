# Requirements: Milestone v4.7 Workflows You Can See and Start Anywhere

**Defined:** 2026-10-18 (operator intake; research skipped — every item has a planted seed with context)
**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and can be taught new behaviours (skills) that persist and can be shared.
**Milestone goal:** Workflows become easier to start, finish authoring and understand at a glance, with visuals that show what a run did.

Seeds folded at intake: SEED-232, SEED-195, SEED-014, SEED-084, SEED-164, SEED-051, SEED-183, SEED-086, SEED-337, SEED-348, SEED-155, SEED-152. SEED-163 is already delivered (Phase 193.2) and is only flipped (REG-06).

## v4.7 Requirements

### Start (START)

- [x] **START-01**: From inside a thread, a user can start a workflow, fill its launch form, and see the run attached to that thread. — `SEED-232`
- [ ] **START-02**: An external system can start a workflow run through an authenticated inbound call and read the result back. Org-scoped, rate-limited, audited. — `SEED-195`
- [x] **START-03**: A user can fork a starter workflow into their own draft in one click; at least 5 curated starters ship, each passing the publish gauntlet. — `SEED-084` (287: fork is menu + name dialog, not literal one click; operator to rule)
- [ ] **START-04**: A run started by a schedule or an inbound call shows how it was started, and its last and next run are visible. — `SEED-014`

### Author (AUTH)

- [ ] **AUTH-01**: A workflow that pauses for a person can be published, and the run surface shows who it is waiting on. — `SEED-164`
- [ ] **AUTH-02**: Describe-it authoring can take uploaded assets (template, form, reference docs) and derive the inputs, phases and tools from them. — `SEED-051`
- [ ] **AUTH-03**: A draft's configuration does not vanish when the author navigates away. — `SEED-183`

### See (VIS)

- [ ] **VIS-01**: A multi-agent workflow can be viewed as a truthful picture of orchestrator, workers and judge, with no edges the schema does not have. Sketch first (G-2). — `SEED-086`
- [ ] **VIS-02**: The agent can show more artifact types beyond chart, table and metric; the new set is chosen at sketch time from a closed registry only. — `SEED-337`
- [x] **VIS-03**: A finished run has one read-only page, with export, showing what it did and on what evidence (definition version, phase log, verdicts, cited sources). — `SEED-348`
- [ ] **VIS-04**: The workflow library card matches its approved sketch: labelled phase chips, and the description no longer dominates. — `SEED-155`

### Trust (TRUST)

- [x] **TRUST-01**: Each workflow phase output that came from the knowledge base carries a confidence level, shown on the run surface and in the receipt. — `SEED-152`

### Register hygiene (REG)

- [ ] **REG-06**: Seed statuses match reality: SEED-163 flipped, and each seed this milestone folds is updated.
- [x] **REG-07**: Hot-file refactors that guardrail G-5 requires are done before the feature phases that touch those files.

### Decision engine (DEC) — added 2026-10-20 by the operator, outside the milestone's workflow theme

- [ ] **DEC-01**: A Settings switch turns the decision engine on or off and picks the engine: Jev (TypeSafe, ~~direct or~~ via OpenRouter), OpenAI Decisions (`gpt-6-luna`), or a local model. Off is the default and leaves retrieval exactly as it is today. *Amended 2026-10-20 (294-CONTEXT D-03, operator): Jev ships via OpenRouter only; TypeSafe direct is deferred.*
- [ ] **DEC-02**: When on, knowledge-base search reranks its candidates with the chosen engine, accepts an optional steering instruction from the agent, and drops only candidates below a conservative threshold. Any engine failure falls back to the current order.
- [ ] **DEC-03**: A user can check an answer's citations and see, for each cited sentence, whether its source supports it fully, partly, not at all, or contradicts it, with a confidence.

### Runs (RUN) — added 2026-10-20 by the operator, from measured run failures

- [x] **RUN-01**: A knowledge-base step that finds nothing, or answers without citations, pauses the run and asks the person (search elsewhere / continue unsourced, visibly marked / stop) instead of failing it; a locked must-prove-it workflow never offers continue-unsourced. — `BUG-261020-07`
- [x] **RUN-02**: A report step with no template is refused when the workflow is saved or published, with a message that names the missing template. — `BUG-261020-08`
- [x] **RUN-03**: The publish judge does not fail a workflow because a recorded-not-sent action did not send. — `BUG-261020-09`
- [x] **RUN-04**: Every run ends in a true state with a reason: none stays active after its phases end, none fails without a recorded reason, and a run waiting for approval reads waiting. — `BUG-261020-10`, `-11`, `-12`

## Future Requirements (deferred)

- Decision-engine model routing (simple turns to a cheaper model) — after DEC-02 is measured; needs the full provider roster.
- Decision-engine chunk tagging at ingestion (table of contents, footer, signature, personal data) — through the classification splice (`ingest_splice.py`).

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
| REG-07 | Phase 286 | Complete |
| START-01 | Phase 287 | Complete |
| START-03 | Phase 287 | Complete |
| AUTH-03 | Phase 288 | Pending |
| AUTH-01 | Phase 288 | Pending |
| VIS-03 | Phase 289 | Complete |
| TRUST-01 | Phase 289 | Complete |
| VIS-04 | Phase 290 | Pending |
| VIS-01 | Phase 290 | Pending |
| AUTH-02 | Phase 291 | Pending |
| VIS-02 | Phase 292 | Pending |
| START-02 | Phase 293 | Pending |
| START-04 | Phase 293 | Pending |
| REG-06 | Phase 293 | Pending |
| DEC-01 | Phase 294 | Pending |
| DEC-02 | Phase 294 | Pending |
| DEC-03 | Phase 294 | Pending |
| RUN-01 | Phase 295 | Verified (2026-10-21; G-4 sign-off owed) |
| RUN-02 | Phase 295 | Verified (2026-10-21; G-4 sign-off owed) |
| RUN-03 | Phase 295 | Verified (2026-10-21; G-4 sign-off owed) |
| RUN-04 | Phase 295 | Verified (2026-10-21; G-4 sign-off owed) |

Mapped: 21/21, no orphans, no duplicates.

---
*Requirements defined: 2026-10-18*
