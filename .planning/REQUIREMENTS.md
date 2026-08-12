# Requirements — v3.7 Workflow Product Completion

**Milestone:** v3.7 · **Opened:** 2026-08-10 · **Status:** scoped, roadmap written

**Goal:** make the workflow product built across v2.8→v3.6 usable end to end — find it, understand
the door, build it with the right vocabulary, stop it, see what it produced.

**Provenance:** every requirement below traces to a seed the operator planted during earlier UAT, or
to a measured finding from the 2026-08-10 product review. **Nothing here is speculative scope.**
Where a requirement's seed carries analysis, the seed is the spec input — read it before planning.

---

## v3.7 Requirements

### Library — finding and choosing a workflow (LIB)

- [x] **LIB-01**: A user can search the Workflows page by name and filter the list, instead of scanning three unlabelled shelves. *(SEED-136)*
- [x] **LIB-02**: A workflow card shows what the workflow is for, at a glance, without the reader having to decode internal vocabulary. *(SEED-136)*
- [x] **LIB-03**: A user can predict what each card action does before clicking — in particular, "Tweak" must not silently open a full edit surface. *(SEED-136, operator 2026-08-10)*
- [x] **LIB-04**: The create affordance is findable without scrolling past two shelves of existing workflows. *(SEED-136)*
- [x] **LIB-05**: A user can tell one workflow from another at a glance — which row is which when many share a name, whose it is and what it was copied from, and which one changed most recently. *(Phase 192 UAT, operator 2026-08-12 — measured: 43 of 104 workflows share the name "Compliance Gap Report" across 41 slugs; 14 duplicated names in total. Distinct from LIB-02, which is about reading ONE card; this is about telling MANY apart.)*

### Authoring — the doors and the journey (AUTH)

- [ ] **AUTH-01**: A user can tell the two authoring doors apart and predict what each will do, before choosing. *(SEED-147)*
- [ ] **AUTH-02**: A user drafting from a description is guided through the decisions that matter, rather than getting one shot at a prompt and a finished draft. *(SEED-051)*
- [ ] **AUTH-03**: A user can find where to supply a template for a workflow that fills one. *(SEED-110 — the capability shipped in Phase 152; this is placement and discoverability, NOT a rebuild)*
- [ ] **AUTH-04**: A user selects the model for a step from the live model registry, rather than typing a model name or slug by hand. *(SEED-135 / SEED-040 / SEED-088 — **the canvas/workflow surface only**; the app-wide single-source sweep is explicitly deferred)*

### Run control and results (RUN)

- [ ] **RUN-01**: A user can stop a running workflow at any point, and the run reports honestly that it was stopped. *(SEED-140 — an owned cancel endpoint and a `cancelled` status already exist; this is mostly the missing control)*
- [ ] **RUN-02**: A workflow that produces a file shows that file to the user when the run finishes, from the run surface. *(SEED-148)*
- [ ] **RUN-03**: Where a produced file is shown, it reuses the shipped output-file presentation rather than a second one. *(SEED-148 — `OutputFileCard`, `FilesSection`, `fileIcon`, the hero/working split all already exist)*

### Node vocabulary (NODE)

- [ ] **NODE-01**: An author can express a deterministic step between two AI steps without writing a prompt for it. *(SEED-141 — **research-first**; the seed requires establishing that the need is real before any primitive ships, and `execute_code` is the incumbent that any proposal must beat)*
- [ ] **NODE-02**: A workflow can collect structured input from a person mid-run. *(operator 2026-08-10; note `llm_human_input` already exists — establish what it does and does not cover BEFORE building a form node)*

---

## Future Requirements (deferred, with the reason)

| Deferred | Why, and where it goes |
|---|---|
| Scheduled / recurring runs + budget caps | Phase 105. Hard prerequisite RUN-01 lands here; the spend-cap brake does not exist yet. → next milestone. `.planning/v2.9-STRETCH-CARRYFORWARD.md` |
| Ingestion + retrieval quality (CSV tables, stranded tables, `.msg` email) | SEED-149, SEED-150, SEED-060, SEED-087. Real, measured, and a different subsystem. → v3.8 |
| Connections / integrations, incl. CONN-02 | SEED-146 umbrella. **Sequenced after v3.7 on purpose** — safe outbound writes need RUN-01's stop and NODE-02's human step |
| `live_connectors` Control Room card | D-190-DEF-09 / BUG-260810-01. Ships with the connections milestone so the first control an operator finds is one they can safely use |
| App-wide model single-source-of-truth sweep | SEED-040 / SEED-088 beyond the canvas. AUTH-04 covers the workflow surface only |
| Canvas scale hardening | Phase 191 (reserved). Conditional; its triggers are measured and have not fired |
| Citation-traceable grid renderer | Phase 106. Prerequisite is RUN-02 — no point rendering a grid on a surface that shows no outputs |
| Per-run provenance receipt | Phase 107. Likely an assembly job now; re-derive before planning |
| Office/PDF in-panel preview | Phase 108 `file_preview` half + SEED-037. Trigger fires once RUN-02 makes produced files visible |

## Out of Scope (explicit)

| Excluded | Reasoning |
|---|---|
| A `phase_type` plugin contract | Phase 108's other half. **D-14** fixed the executor count at 7 with "no second runtime"; allowing third-party executors is a milestone-level reversal, not a stretch item |
| Restructuring PROJECT.md's accumulated heading rot | Six "Last Shipped" sections and a Current State full of stale per-phase entries. Real debt, but documentation hygiene — not this milestone |
| Rebuilding output-file UI | RUN-03 exists specifically to forbid it |
| Branching / looping on the canvas | The spine is LINEAR by design. NODE-01's primitives must stay linear-compatible or the linear commitment is revisited as its own decision |

---

## Traceability

| REQ | Phase |
|---|---|
| LIB-05 | 192.1 | ✅ **Complete 2026-08-13 — WITH ONE RECORDED DEVIATION AND ONE MISSING ARTIFACT, both named rather than implied.** Satisfied by the identity line: a `row-identity` node at DOM position 2 on every card, resolved by `rowIdentity.ts`'s O(n) index (four-state lineage incl. an explicit `"unknown"` — **57 resolve · 12 go quiet · 0 lie**), with `Yours`/`Shared` as the honest provenance ceiling and `relativeChanged`'s nine bands answering *which one changed most recently* (returning `null` rather than a fabricated time). **The requirement's own measured premise was met head-on:** 43 of 104 workflows share the name *"Compliance Gap Report"*, and **UAT row U1 — the row Phase 192 FAILED — passed**, driven by the operator by reading the screen, never by id (D-27). ⚠ **The residual is REPORTED, not papered over:** on dev-shape data the D-31 discrimination ranker narrows the identical block **41 → 39** and no further, guarded by a `>= 35` FLOOR test so no future change can fake success; at that point `1 of 43` is a *true warning* and the rename prompt (162-B) is the product's answer. ⚠ **DEVIATION: UAT U8 failed and stays failed** — the card does not match sketch 163. Three of its four complaints are Phase 124 / Phase 192 code; 192.1's own half (the counter's chip treatment) is **accepted and routed to `SEED-155`**, because U4's fix had already widened the string ~3× beyond what the pill was drawn to hold. ⚠ **No `192.1-VERIFICATION.md` exists** — the close rests on 9 driven UAT rows + `192.1-SECURITY.md` (`threats_open: 0`) + green gates, not on a verifier report. Original entry, kept for the record: inserted 2026-08-12 from Phase 192's own UAT. **LIB-02 is satisfied and LIB-05 is not, and that is not a contradiction:** LIB-02 asks whether ONE card is readable (it is — `WorkflowSoul`'s five atoms, verified); LIB-05 asks whether MANY cards are distinguishable (they are not — 43 rows share a name). The gap between those two questions is the whole phase. G-2 fires: sketch first. |
| LIB-01, LIB-02, LIB-03, LIB-04 | 192 | Complete 2026-08-11 — verified 6/6 must-haves in shipped source at 200 rows (192-VERIFICATION.md). Marked here only after verification, never per-plan. ⛔ Lived-experience confirmation OWED: the eleven G-4 UAT rows were NOT run (operator decision 2026-08-11, U6 first) — the requirements are proved structurally, not experientially. ⛔ D-07 search HIGHLIGHT deferred (wiring it reds fence F1 by construction); LIB-01 wording is "search by name and filter the list", which ships. |
| AUTH-01, AUTH-03 | 193 |
| RUN-01 | 194 |
| RUN-02, RUN-03 | 195 |
| AUTH-04 | 196 |
| AUTH-02 | 197 |
| NODE-01, NODE-02 | 198 |

**Coverage: 13/13 requirements mapped to exactly one phase.**
