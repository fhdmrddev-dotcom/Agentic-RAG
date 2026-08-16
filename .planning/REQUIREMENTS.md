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
- [x] **AUTH-03**: A user attaches a template to a workflow **when authoring it**, and every run fills that same template with current information. *(SEED-110 / **REWRITTEN 2026-08-14, operator** — see the correction note below)*

  > ⚠ **THIS REQUIREMENT WAS WRITTEN WRONG, AND PHASE 193 BUILT THE WRONG THING TO IT.**
  >
  > It used to read: *"A user can find where to supply a template for a workflow that fills one
  > (the capability shipped in Phase 152; this is placement and discoverability, NOT a rebuild)."*
  > That wording contained an unexamined assumption — that supplying a template at **run** time is
  > the right shape — and the *"NOT a rebuild"* clause actively forbade questioning it. Phase 193
  > optimised inside the assumption: it labelled the run-time upload box `Template to fill` and hid
  > it on rows that cannot use one. **The box itself is the defect.**
  >
  > **The operator's correction (2026-08-14), in their words:** *"the template should be there when
  > I author, not when I run — the same template, with the content changed based on the most
  > up-to-date information in the knowledge base."*
  >
  > **Measured, not assumed** — three facts that make the correction concrete:
  > - **No authoring UI can bind a template.** `WorkflowBuilderPage.tsx:667` only *reads*
  >   `assets.find(kind === "template")?.filename` to display it. Nothing sets it. The trusted
  >   library path (`{user_id}/_library/…`) exists only as a comment describing a **seeded fixture**;
  >   there is no endpoint and no control.
  > - **10 of 145 published workflows bind a template**, and they were seeded directly — not
  >   authored. The other 135 are shown the run-time box.
  > - **For a workflow that DOES bind one, the run-time upload is unreachable code.** Phase 193's own
  >   research measured it: `resolve_template_source` returns unconditionally on Branch 1
  >   (`template_asset_service.py:147-181`) whenever the definition binds a library template, so an
  >   uploaded file is silently discarded. The old wording asked users to find a control that, on the
  >   workflows most likely to need it, **does nothing**.
  >
  > **What satisfying this now means:** a template is attached to the workflow at authoring time and
  > stored durably against it; the Builder shows which template is attached (the read half already
  > exists); and the run-time upload box is **removed, not relabelled**. The ephemeral run-scoped
  > upload (`workspace.py:230`, Phase 100/TMPL-01) is a different, deliberately-untrusted capability
  > and is not what this requirement is about.
  >
  > **The lesson, recorded so it does not recur:** a requirement that names a *solution*
  > (“where to supply”) rather than a *user's goal* (“the workflow knows its template”) will be built
  > to literally. The *"NOT a rebuild"* guard was meant to prevent scope creep and instead prevented
  > the question.
- [ ] **AUTH-04**: A user selects the model for a step from the live model registry, rather than typing a model name or slug by hand. *(SEED-135 / SEED-040 / SEED-088 — **the canvas/workflow surface only**; the app-wide single-source sweep is explicitly deferred)*

### Run control and results (RUN)

- [x] **RUN-01**: A user can stop a running workflow at any point, and the run reports honestly that it was stopped. *(SEED-140 — an owned cancel endpoint and a `cancelled` status already exist; this is mostly the missing control)*
  - ✅ **TICKED 2026-08-16, on BOTH clauses, and the bound is stated rather than implied.** Clause 1 (*"can stop at any point"*) — Phase 194 shipped the durable half and verified it on seven live runs; **Phase 194.1 made it perceivable on four surfaces** and the operator drove 5 of 5 UAT rows, all PASS (`194.1-UAT.md`, `194.1-VERIFICATION.md`). Clause 2 (*"reports honestly that it was stopped"*) — closed by the **L-01 terminal guard** (`9dbd57f5`): a terminal `workflow_runs.status` is now FINAL, so the far-worker producer can no longer write `completed` over a user's `cancelled`. Proved on real rows through the SHIPPED `finish_run`, with the pre-fix statement kept as a negative control that still reproduces the bug, and driven RED (planting the old statement fails 8 of 15 cases).
  - ⚠⚠ **WHAT THE TICK DOES NOT CLAIM, AND MUST NEVER BE READ AS: THE WORK DOES NOT YET STOP.** The guard fixes the REPORT, not the producer. On the ~half of stops where the producer lives on the other worker it **keeps running to completion**, consuming tokens and time, while the run correctly reads `cancelled`. **These are two different claims and this row ticks only the one the requirement words.**
  - ⚠ **The bound on why that is acceptable TODAY, and the trigger for when it stops being acceptable:** runs today are **user-initiated and watched**, so an unstopped producer costs tokens and a little confusion — not correctness and not data. **The moment runs become SCHEDULED or UNATTENDED, that flips**: nobody is watching, and a stop that does not stop is a real defect. ⇒ **The remaining L-01 work (an in-loop status re-read, or a cancel channel that reaches a producer not parked on an `ask_user:*` channel) is routed to the automations milestone, with the FIRST SCHEDULED RUN as its trigger — not a date.** See `SEED-014`, `SEED-168` axis A, and `.planning/reports/v3.7-CLOSE-AND-ABSORB.md`.
  - ⚠ **This tick was argued against before it was made, and the counter-argument is preserved because it is a good one.** `AUTH-03`'s correction note in this file records that *"a requirement that names a solution rather than a user's goal will be built to literally"* — and a user who stops a workflow plainly means *stop doing the work*, not *stop telling me about it*. The tick rests on the requirement's own wording plus a NAMED, TRIGGERED bound above; **if a reader thinks that trade was wrong, the deferral above is where to re-open it, not this checkbox.**
  - ⚠ **PARTIALLY SATISFIED BY PHASE 194 — DELIBERATELY LEFT UNTICKED. SC#2 is FAILED, and the second half of this requirement ("reports honestly that it was stopped") is the half that fails.** `194-VERIFICATION.md`: 2 of 3 success criteria verified. **SC#1 (reachable) and SC#3 (terminal + honest vocabulary) hold and are proved on live data.** SC#2 does not.
  - ⚠ **L-01 / CR-04 — at the SHIPPED default `WORKER_COUNT=2`, roughly HALF of all Stops end with the run reporting `completed`.** `RUN_TASKS` is per-process; when the producer lives on the other worker the Stop correctly writes `cancelled`, but the still-running producer then calls `finish_run(run_id, "completed")` (`harness_engine.py:2012`) and **overwrites it**. `finish_run` is an unconditional `UPDATE ... SET status = $2 WHERE id = $1` with **no terminal guard** (`db/workflows.py:1458-1463`); `publish_cancel_sentinel` publishes only onto `ask_user:*` channels, so it cannot reach a producer that is not paused at a prompt; and the engine has no in-loop status re-read. SC#2's wording is *"not failed, **not silently complete**"* — so this is a FAILED criterion, not a bounded exception. ⚠ **The limitation is INHERITED; what Phase 194 added is the CLAIM to have closed it.** Routed to a dedicated phase (in-loop status re-read first, Redis cancel channel as fallback) — **it currently has NO ROADMAP HOME: milestone phases 195-198 cover none of it.**
  - ⚠ **L-02** — `api/workflows.py:1483-1490` carries the identical unnarrowed producer join that CR-01 fixed in `api/runs.py`, so `delete_workflow_cascade` can cancel a **sub-agent**. Pre-existing (`git diff` on that file is EMPTY for all of Phase 194), owner-scoped so **no cross-tenant exposure**. Trigger: the next phase whose `files_modified` names that file.
  - ⚠ **A-1 (found at verification, in NO phase artifact — the client-side twin of CR-01, and CR-01's fix does NOT guard it).** `api/threads.py:475-482` selects active runs with `status='streaming'` and **no `parent_run_id IS NULL`**, while sub-agent runs carry the same `thread_id`/`user_id`/status (`task_service.py:551-562`). The reconcile loop stamps a `runStatus:"streaming"` placeholder per run (`StreamsProvider.tsx:1607-1638`) and `stopThread` picks by bucket order, so a sub-agent id can reach `DELETE /runs/{id}` through the **primary Step-1 path** — which CR-01's narrowing never touches. Ordering-dependent, therefore **UNCERTAIN**, which is precisely why the undriven *reload-mid-run, then Stop* UAT row matters.
  - ⏸ **`194-UAT.md` is entirely UNDRIVEN** — 8 cross-provider rows, 3 axes, 4 G-4 lived-experience rows. No browser was reachable for the whole phase (`list_connected_browsers` → `[]`). **Drive the reload-mid-run negative row FIRST**; it is the row that would have caught the two-id landmine and is the cheapest probe for A-1.
  - **Tick this box only when SC#2 is genuinely true at `WORKER_COUNT=2`.**
- [ ] **RUN-02**: A workflow that produces a file shows that file to the user when the run finishes, from the run surface. *(SEED-148)*
  - ✅ **OPERATOR-CONFIRMED WANTED, unprompted, 2026-08-16** (during 194.1 UAT — `BUG-260816-05`): *"in the canvas when I run a workflow I should be able to … see in the future files it produced."* The requirement is correctly scoped as-written; **the operator named the run surface specifically.** Read `BUG-260816-05` at `/gsd:discuss-phase 195` — it also carries the SECOND half of the same complaint, which is NOT RUN-02 (see NODE-02 below), so the two must not be conflated into one phase's scope by accident.
- [ ] **RUN-03**: Where a produced file is shown, it reuses the shipped output-file presentation rather than a second one. *(SEED-148 — `OutputFileCard`, `FilesSection`, `fileIcon`, the hero/working split all already exist)*

### Node vocabulary (NODE)

- [ ] **NODE-01**: An author can express a deterministic step between two AI steps without writing a prompt for it. *(SEED-141 — **research-first**; the seed requires establishing that the need is real before any primitive ships, and `execute_code` is the incumbent that any proposal must beat)*
- [ ] **NODE-02**: A workflow can collect structured input from a person mid-run. *(operator 2026-08-10; note `llm_human_input` already exists — establish what it does and does not cover BEFORE building a form node)*
  - ⚠ **THE FIRST PIECE OF THAT ESTABLISHING WORK EXISTS — read `BUG-260816-05` at `/gsd:discuss-phase 198` before scoping anything.** Measured 2026-08-16: `llm_human_input` works, but **only on the chat/panel surface**. `WorkflowRunPage.tsx` *paints* the waiting step (`useAskUserPrompt` at `:451`, `pendingAsk: askToken` at `:643`) while `PendingAskCard` / `PendingAskStack` is mounted in **exactly one place in the app** (`WorkspacePanel.tsx:71`), and `POST /runs/{id}/ask_user_response` has exactly one caller. **So the gap is not "we lack a form node" — it is that the existing human step has no responder on the canvas.** A form node built without fixing that would ship a second un-answerable step type.
  - ⚠ **It also reads as a hang.** From the canvas a run parked on an approval is indistinguishable from a dead one, and the only control that surface offers is the Stop that Phase 194.1 just added — i.e. today the surface actively invites killing a healthy run.
  - ⚠ **A publish-path collision to settle in the same phase:** the synchronous publish gate categorically REFUSES `llm_human_input` (`BUG-260815-01`, blocking). The three published workflows that contain one were published before that gate existed. So today a human step can be *run* but not *shipped* — NODE-02 cannot be considered delivered while that holds.
  - ⚠ **`BUG-260816-06` — the shipped human step is not merely thin, it is BROKEN: an unanswered `llm_human_input` TIMES OUT INTO A SILENT APPROVAL** (default 300 s; the phase records `completed` with `answer: ""` and the run proceeds). Measured on four of five real runs. **NODE-02 cannot be considered delivered while an unanswered step reads as an approval.**
  - ⚠⚠ **THE FRAMING IS LIKELY WRONG, AND CHANGING IT IS NEARLY FREE UNTIL 198 IS SCOPED — see `SEED-168`.** *"Collect structured input from a person"* reads as **a form node**. Across the six domains SEED-168 surveys (PM · HR · finance · legal · education · healthcare), a form is the **rarest** human role. The dominant one is **item-level adjudication over a list the run just produced** — *accept 8 of these 12 risks · flag 3 of these 40 obligations · approve these 5 variance explanations and rewrite one.* A form node would ship a second human step that still cannot do what a reviewer actually does.
    - ⚠ **It constrains upstream design, which is why it must be settled BEFORE planning, not during:** item-level decisions require the run to emit **items with stable identity** — the same identity problem `SEED-167` open-question 2 raises for registers. **Decide it once, for both.**
    - ⚠ **The nearest capability is already half-built and unclaimed:** `PendingAskCard` ships a *"⤢ Review & edit full draft"* overlay. What is missing is that the edited text becomes **the artifact** rather than a comment on it.

---

## Future Requirements (deferred, with the reason)

| Deferred | Why, and where it goes |
|---|---|
| Scheduled / recurring runs + budget caps | Phase 105. Hard prerequisite RUN-01 lands here; the spend-cap brake does not exist yet. → next milestone. `.planning/v2.9-STRETCH-CARRYFORWARD.md` |
| **The CLASS of work: standardized, knowledge-derived, human-accountable** | **`SEED-168`** (operator correction, 2026-08-16). ⚠ **The generalisation of SEED-167 and the file to read FIRST** — 167 is one INSTANCE, and planning from it alone builds a risk-register feature. Derives **six capability axes** (temporal · state · evidence · human role · output · accountability) from cases across PM, HR, finance, legal, education and healthcare, with a MEASURED coverage table. ⚠ **Measured summary: the engine expresses exactly ONE position on each of the six axes** — one-shot, stateless, retrieve-and-summarize, approve-once, fill-a-template, cited — while most real cases need two or more, and every domain hits the same wall at the same point. **Use the axes as the automations milestone coverage checklist.** Its one in-milestone action is the NODE-02 reframing, recorded on that requirement above. |
| **Incremental / stateful workflows — a run that reads its OWN last output** | **`SEED-167`** (operator, 2026-08-16, the "living risk register"). ⚠ **Plan this BEFORE, or with, the scheduler above — not after.** Measured: `grep -rn "previous_run\|prior_run\|last_run_output\|incremental\|since_last"` over `services/harness/` + `models/harness.py` returns **ZERO hits**; a run has no memory of the previous run. **A scheduler over stateless runs produces a new disconnected report every week, which is not what was asked for.** → automations milestone (SEED-014). ⚠ Its one in-milestone touchpoint is **NODE-01 (phase 198)** — the diff/merge (*close the resolved rows, append the new ones, preserve the rest*) is the worked example NODE-01's seed demands before any primitive ships, and preservation is precisely what a prompt-driven rewrite is worst at. |
| A read-only view of a **published** workflow | **`BUG-260816-04`** (operator, 2026-08-16). `▶ Run` is the only action on a runnable row; `✎ Open` is draft-only by construction (Phase 192 D-01 split the seam by SURVIVAL). Published is the state you most want to inspect before running and the only one you cannot. **No home in 195-198** — none owns the library card's action contract. → the deferred library-layout sketch (G-2), per `SEED-155`. |
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
| AUTH-01 | 193 | ⚠ **NOT satisfied.** Phase 193 shipped variant-D door names, the header-strip restack and the governed vocabulary, but its own success criterion — *a person can predict what each door does before clicking* — is **unverified and contradicted in lived experience**: the operator, unprompted, reported the two doors *“look the same exactly to me”* (2026-08-14). `SEED-156` measures why — **`GOVERN_STANDALONE` shares 11 of its 14 first-screen text nodes with `DESCRIBE_STANDALONE`**; below the header strip the two doors open onto the same screen. 193 changed the labels, not the journeys. |
| AUTH-03 | 193 → RE-OPENED → **193.1** | ✅ **SATISFIED 2026-08-15 — on a real run, with the artifact recorded.** The row's own standing condition was *"do not tick this row until a draft is grounded in a real template's real placeholder keys"*; that condition is now **met and observed**, not inferred from tests. **The evidence** (`193.1-UAT.md` § U5): the operator attached a purpose-built 10-field `.docx` to the pre-draft describe screen, described a Quarterly Business Review over a five-document knowledge base, and ran the published workflow. Run `d8331add` completed; output `/Northwind-QBR-Template.docx` **38,763 B against a 37,424 B template**, **all ten fields rendered, zero unrendered `{{ }}`, zero literal `None`**, and the template's branding survived intact (navy bar ×11, amber box, teal headings ×7, Georgia serif, 4 shading elements) — the discriminator the fixture was designed around, since a regenerated document would have been plain. **Grounding: 11 of 13 planted facts**, including `INC-4471`, 412 of 605 seats, £284,000 ARR, 31 Jan 2027 and AMBER, plus `SUP-9902` and an owner-dated action that were not even on the checklist. **Both halves of the rewritten requirement are therefore observed: the template is attached WHEN AUTHORING, and the run FILLS THAT SAME TEMPLATE.** ⚠ **Three things are recorded rather than smoothed.** (1) The model kept Marcus Feld's quote and **stripped his name** — content grounded, attribution lost; acceptable internally, a downgrade for a client-facing document. (2) The run only happened after the operator cleared **two publish blockers the authoring path does not know about** — `SEED-163` (the AI leaves `business_requirement` blank, so the author restates what the describe box already said) and **`BUG-260815-01` (severity blocking)**, where the draft grew an `llm_human_input` phase that the synchronous publish gate categorically refuses; the operator deleted the step by hand. ⚠ **(2) is a consequence of THIS PHASE'S OWN D-26 fix** — once the model knows it must fill ten named fields it adds a step to ask the human, measured 2 for 2 whenever a template step appears. **So the capability is delivered and the path around it has two gaps**, both routed to 197 / AUTH-02 with the shared root named: *authoring does not know what publish requires*. (3) Phase 193's earlier work is not wasted — the three-state predicate, the card mark and the hidden-box logic all remain correct and shipped. |
| RUN-01 | 194 → **194.1** | ✅ **Satisfied 2026-08-16, on BOTH clauses, with the residue named.** ⚠ **194 alone did NOT satisfy it and the table must not read as though it did** — 194 shipped the durable half (verified on seven live runs) and its own UAT then found *a person cannot perceive any of it*: the composer and tray Stops gave no feedback and `WorkflowRunPage.tsx` had **no Stop control at all** (`grep → 0`). **194.1** delivered the visible half — four mounts, one shared `StopControl`, one `stopThread` — and the operator drove **5 of 5 UAT rows, all PASS** (`194.1-UAT.md`, `194.1-VERIFICATION.md`). Clause 2 (*"reports honestly"*) was closed separately by the **L-01 terminal guard** (`9dbd57f5`) plus its phase-level companion (`e1200576`, found by this milestone's own integration audit), each proved on real rows with a negative control that still reproduces the bug. ⚠ **WHAT THE TICK DOES NOT CLAIM: the work does not yet stop** — the far-worker producer runs to completion while the run correctly reads `cancelled`. Bounded because runs today are user-initiated and watched; **routed to the automations milestone with THE FIRST SCHEDULED RUN as its trigger**, not a date. See the requirement entry above for the full argument, including the counter-argument against ticking, which is preserved rather than won. |
| RUN-02, RUN-03 | 195 |
| AUTH-04 | 196 |
| AUTH-02 | 197 |
| NODE-01, NODE-02 | 198 |

**Coverage: 13/13 requirements mapped.** ⚠ **AUTH-03 is mapped to a phase that did NOT satisfy it** and needs a new one; AUTH-01 is mapped to a phase whose success criterion is unverified and contradicted by the operator. Mapped ≠ met — stated here so a coverage count cannot read as progress.
