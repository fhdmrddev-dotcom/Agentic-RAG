# Roadmap: Agentic RAG

## Milestones

- ✅ **v1.0 Knowledge Base Explorer** — Phases 1-8 (shipped 2026-03-29)
- ✅ **v2.0 Agent Skills & Code Execution** — Phases 9-17 (shipped 2026-04-04)
- ✅ **v2.1 Stability & RAG Correctness** — Phases 18-25 (shipped 2026-04-11)
- ✅ **v2.2 Trust & Compliance** — Phases 26-32 (shipped 2026-04-16)
- ✅ **v2.3 Memory, Multimodal & Experience** — Phases 33-43 (shipped 2026-04-19)
- ✅ **v2.4 Stability, Polish & UX Fixes** — Phases 44-57 (shipped 2026-04-30)
- ✅ **v2.5 Deployment Strategy** — Phases 058-067.5 (shipped 2026-05-09)
- ✅ **v2.6 Foundation: RAG Quality + Multi-Worker + Polish** — Phases 068-082 (shipped 2026-05-27)
- ✅ **v2.7 Agent Workspace & Panel** — Phases 083-088 (shipped 2026-05-30)
- ✅ **v2.8 Harness Engine & Workflow Mode** — Phases 089-096 (shipped 2026-06-07)
- ✅ **v2.9 Workflow Studio** — Phases 097-104 CORE (shipped 2026-06-15); STRETCH 105-109 deferred
- ✅ **v3.0 Document Management** — Phases 110-119 (shipped 2026-06-21). SEED-005 Tier A as a first-class product surface: DM Foundations → metadata enrichment + multi-provider embeddings → metadata-driven views / "virtual folders" → document relationships → auto-classification → governance health. 24/24 functional requirements delivered.
- ✅ **v3.1 Workflow & Skill Studio — Trust, Clarity & Triggers** — Phases 120-129 (CORE 120-124+123.1; STRETCH 127-129 shipped; 125/126/130/131 deferred) (shipped 2026-06-28). Collision fix + context isolation · cross-provider trust/honesty parity · Skill Trigger Tuner · Workflow Studio soul + strict↔loose · chat tool-card unification + provider logos · MiniMax/OpenRouter arg repair.
- ✅ **v3.2 Skill Eval Studio + Self-Improving** — Phases 132-145 (CORE 132-137 + inserts 134.1/137.1/137.2; STRETCH 138-143+145 shipped; 144/FILE-01 deferred → v3.3) (shipped 2026-07-10). Skill Eval Studio (eval persistence + versions + with-vs-without runner + honest verdicts + ratings + self-improve loop + publish gate + Evals panel) · built-in skill-creator · STRETCH honesty phases · run-lifecycle foundation (FND-01) · Starter Workflow Library (WF-01).
- ✅ **v3.3 Operator UX** — Phases 146-159 (shipped 2026-07-18). Operator/admin tier (gated /admin Control Room + governance) + dynamic model-registry/discovery + secrets-at-rest + workflow/agent file-inputs + inline citations + plain-language + WCAG-AA + deployment presets/install wizard. 20/20 requirements delivered.
- ✅ **v3.4 Multi-Tenancy & Org Access** — Phases 160-168 CORE (shipped 2026-07-22); STRETCH 169-173 deferred → carry-forward guide `.planning/v3.4-STRETCH-CARRYFORWARD.md`. The load-bearing **one-way RLS door**: membership-based tenancy (Tenancy ADR → org/dept/role schema → personal-org backfill → the atomic RLS + user-JWT-client-swap crux → SECDEF audit + two-org isolation suite → `is_global` retirement → org-admin shell/switcher → invitations/roles/greenlists → SAML SSO). Migrations 104-113.
- ✅ **v3.5 UX Consolidation & Chat Polish** — Phases 174-177 CORE (shipped 2026-07-23); STRETCH 178-180 deferred → carry-forward guide `.planning/v3.5-STRETCH-CARRYFORWARD.md`. Cleared the load-bearing chat-surface bug backlog + consolidated the accumulated UI/UX (incl. the new v3.4 org surfaces) into one coherent, honest experience: run-state & lifecycle honesty (174) · cross-provider streaming fidelity (175) · chat render correctness + exec reliability (176) · v3.4 org-surface family-cohesion polish (177). 14/14 CORE requirements delivered; no migration. Full detail archived: `.planning/milestones/v3.5-ROADMAP.md`.
- ✅ **v3.6 Visual / No-Code Workflow Studio** ([[SEED-123]]) — Phases **181-189 CORE + 190 STRETCH** (shipped 2026-08-09, git tag `v3.6`); STRETCH **191 deferred** → carry-forward guide `.planning/v3.6-STRETCH-CARRYFORWARD.md`. Inserts 184.1 / 188.1 / 188.2. A drag-and-drop node-canvas authoring + non-technical live-run-observability layer ON TOP of the existing governed harness engine (build-on-not-rewrite; `@xyflow/react` v12, the milestone's one net-new dep). **The differentiator shipped: graded governance** — strict-when-KB-grounded / flexible-when-open per node, structurally enforced at RUN time rather than authoring time, which is the category white-space the Beam/Glean/n8n deep crawl found none of them covering. **The D-14 red line held across all 13 phases — 7 harness executors at close, exactly as at open; the canvas never became a second runtime.** HARD gates: #1 revert-at-any-time ✅ (`test_revert_byte_identical`) · #2 study-and-beat ✅ · #3 connector story **⚠ CORE half ✅ (CONN-01), live half ⅓** — a real Slack message sends through the full governed path, but Jira and email are not drivable from a workflow (`D-190-DEF-17` → connections milestone, SEED-146). **20/24 requirements satisfied · 2 partial · 1 unsatisfied (CONN-02) · 1 deferred (SCALE-01);** CORE closed 19/21 satisfied with **zero unsatisfied**. Migrations 114-118. Full detail archived: `.planning/milestones/v3.6-ROADMAP.md`.
- 🚧 **v3.7 Workflow Product Completion** — Phases **192-198** (opened 2026-08-10). Makes the workflow product built across v2.8→v3.6 usable end to end. **Not new capability — completion.** Ten of the fourteen findings behind it were seeds the operator planted during earlier UAT and that were never scheduled; this milestone schedules them. Ingestion (SEED-149/150) → v3.8; connections (SEED-146, CONN-02) → after, deliberately, because safe outbound writes need RUN-01's stop control and NODE-02's human step.

---

## 🚧 Active: v3.7 Workflow Product Completion

**Goal:** an author can find a workflow, understand the door they are walking through, build it with
the right vocabulary, stop it, and see what it produced.

⚠ **Numbering starts at 192 — `191` is RESERVED** for the deferred canvas-scale phase
(`.planning/v3.6-STRETCH-CARRYFORWARD.md`). Do not reuse it.

| # | Phase | Goal | Requirements | SC |
|---|-------|------|--------------|-----|
| 192 | Workflow Library IA | The Workflows page can be searched, filtered and read at a glance, and its card actions are predictable | LIB-01…04 | 4 |
| 192.1 | **(INSERT)** Workflow Identity | A user can tell one workflow from another at a glance — which is which, whose it is, and which one just changed | LIB-05 | 3 |
| 193 | Authoring Doors + Template Placement | A user can tell the two doors apart before choosing, and can find where to supply a template | AUTH-01, AUTH-03 | 3 |
| 194 | Stop a Running Workflow | A run can be stopped at any point and says so honestly | RUN-01 | 3 |
| 195 | Show the Deliverable | A workflow that produces a file shows it, reusing the shipped file presentation | RUN-02, RUN-03 | 3 |
| 196 | Registry-Backed Model Picker (canvas) | A step's model is chosen from the live registry, never typed | AUTH-04 | 3 |
| 197 | Guided Authoring | 11/11 | In Progress|  |
| 198 | Node Vocabulary (research-first) | Establish whether deterministic primitives earn their place, and cover structured mid-run input | NODE-01, NODE-02 | 3 |

**Build order rationale:** 192-195 are the four things that block *using* the product, cheapest and
most independent first — 194 in particular is mostly UI over an endpoint that already exists. 196 and
197 improve authoring quality once the surface is usable. **198 is last and is research-first by
construction** — SEED-141 requires proving the need before shipping a primitive, and `execute_code`
is the incumbent any proposal must beat.

### Phase Checklist

- [x] **Phase 192: Workflow Library IA** ✓ 2026-08-11, **RE-OPENED for gap-closure round 1 and re-closed 2026-08-12** (12 plans + 4 round-1 plans = **16**; verified 6/6 at close — 5/6 at verification + CR-01 closed under G-3). ⚠ **The re-open was not bookkeeping: SC#3 was found UNMET in lived experience by a human on the first real click** — the fork verb 409'd twice in silence (`192-UAT.md` U5). **G-4 UAT is now DRIVEN, not owed** (2026-08-11/12): **9 of 11 passed** on live Chrome-MCP evidence at 107 rendered rows (U1 U2 U3 U4 U6 U7 U8 U10 U11); **U9 ⛔ skipped with its reason** (a costed live run; the launch path is untouched by this phase and already pinned); **U5 ❌ FAILED, twice.** Round 1 fixed the 409 it was aimed at — verified live: the repaired row opens its existing draft with the DB unchanged, a row with no draft to open refuses out loud, a never-forked row still creates — and **U5 still failed**, because the operator could not perceive any of it: **43 of their 104 workflows are named "Compliance Gap Report."** That finding is capability, not defect repair, so it is **routed to Phase 192.1 (LIB-05), NOT to a third closure round** (G-7). ⚠ Also recorded: the post-fix re-drive located rows by `getElementById`, so it proved the code and could not prove the row was findable — **a machine check that bypasses the human's task does not verify it.** LIB-01…04 stand as shipped; LIB-05 is the new, honest gap
- [x] **Phase 192.1: Workflow Identity** ✓ **CLOSED 2026-08-13** — 8 plans / 7 waves, LIB-05 satisfied. ⚠ **This entry was ABSENT from this checklist entirely until the close, exactly as Phase 188.2 was at the v3.6 close** — the list ran 192 → 193 while an eight-plan phase executed between them. A phase missing from its own checklist is invisible to every audit that reads the checklist, which is the `WorkflowsPage.tsx`/G-5 lesson one layer up. **G-4 UAT DRIVEN, not owed: 9 of 9 rows** (`192.1-UAT.md`), **7 pass · 2 fail**, every row carrying a recorded `result:` and **none locating its target by id** (D-27 — the rule Phase 192's own re-drive broke). **U1 — SC#1, the row 192 failed — PASSED**, driven by the operator by reading the screen. **U4 passed AND CHANGED THE PRODUCT** (`1 of 43` read as an index → `43 share this name`, fixed same-day under G-3, `773e6365`). **U7 FAILED on salience → fixed same-day** (`5646d043`, one `className`). **U6 passes on BEHAVIOUR with its disclosure half recorded NOT VERIFIED** — carried, not rounded up. **U8 FAILED and STAYS FAILED**: the operator put sketch 163 beside the live library and the card *"does not read the same"*. ⚠ **Three of U8's four complaints are OLDER CODE** — the 2-bare-line cards + purpose hero are **Phase 124** (`PhaseSpine.tsx:50`, `c5a6c610`, 2026-06-27, seven weeks before the sketch was drawn); the toolbar is **Phase 192** (`2dd9b748`). 192.1's own half is the counter's lost chip treatment, **accepted as a recorded deviation and routed to `SEED-155`** — not restyled, because U4 had already widened the string from `1 of 2` to `43 share this name` (~3× the pill's drawn width), and because fixing one badge leaves the gap the operator actually reacted to untouched. Root cause is **structural sketch→build drift**: the sketch hand-drew an atom the card *cannot* render, since the card consumes `WorkflowSoul scale="card"` UNCHANGED by explicit decision. **SECURED — `threats_open: 0`** (`192.1-SECURITY.md`): 29 entries / 8 plans, verify-mitigations mode, 4 accepted risks logged; it found **three durability holes where the property held but nothing defended it**, and **E-1 + E-2 were closed under G-3** (`15472e7c`) — T-192.1-16's register claimed a grep-assertion that did not exist, and the subtree guard proved only 3 of 12 modules loaded. **E-3 open by decision**, trigger named. **G-5 HONOURED IN THE ORDER D-01 REQUIRES** — the fork extraction shipped in Wave 3, *before* the feature it made room for. ⚠ **NO `192.1-VERIFICATION.md` EXISTS** — stated rather than implied; the evidence base for this close is the 9 driven UAT rows + SECURITY.md + the gates (tsc 33 unmoved · count gate 118/118 on the subtree fences · `failed 0`), not a goal-backward verifier report
- [ ] **Phase 192.2: Does This One Work?** — the library card answers *which of these is worth running*, not just *which is which* (LIB-06). ⚠ **INSERTED 2026-08-19 from sketch 179**, which is the first sketch in this project to RENDER the shipped component rather than redraw it — and rendering it **overturned the premise**: the card is not information-poor, it is nine rows deep, and it ALREADY answers LIB-05 on screen (`3 share this name · changed 2 days ago`). So this phase is **subtraction plus one field**, not a redesign. **G-2 SATISFIED — sketch 179, winner C.** ⚠ **G-5 on `WorkflowCard.tsx` (8/3/818) is UNDISCHARGED and this phase discharges it FIRST**, in the order D-01 requires — the presentation seam ships before the feature it makes room for.

  **Plan progress: 5 / 6 executed** — Wave 1 (`192.2-01`, measurement-only) COMPLETE at base SHA `82dd2efd13459e419d8e6036cdae19fae9ee574b`. Gates at base, all recorded verbatim in `192.2-01-SUMMARY.md`: `tsc` **33 / 19 files** (pre-existing, **zero under `library/`**) · count gate **`total 4455 · failed 0 · pinned total 4328` — `OK — 92/92`** · library suites + `WorkflowsPage` **9 files / 501 tests / 0 failed** · backend **62 failed / 2289 passed** (SEED-056 rot; **all six workflow suites green**). ⚠ **The card's 17 resting atoms are inventoried as literal strings BEFORE any source byte changes**, and the finding that matters is structural: **D-03's six CUT atoms live in exactly TWO JSX nodes** — `<WorkflowSoul scale="card" />` and `<p data-testid="fork-consequence">` — so Wave 4's subtraction is a two-line deletion, not a rewrite of five renderers, and it must NOT touch `WorkflowSoul.tsx` (its `run`/`pub` consumers are out of scope). ⚠ **D-04 confirmed in source: `43 share this name · changed 2 days ago` ALREADY SHIPS — LIB-05 stays COMPLETE.** ⚠ **Two plan-text defects corrected under Rule 3**: the count gate lives at the **repo root**, not under `frontend/` (and the plan's `| tail` form made the module-not-found **exit 0**), and the mark map is **`FACE`**, not `ROW_FACE`. ✅ **All three hot-file triples re-derived and all three MATCH** (`WorkflowCard.tsx` 8/3/818 · `api.ts` 171/98/6174 · `api/workflows.py` 36/18/1984); **G-5 confirmed FIRING and UNDISCHARGED**, Wave 2 discharges it. ⚠ **CLAUDE.md's count-gate constants have rotted a FOURTH time** (carries `4170/4096/83`, measured `4455/4328/92`) — recorded here, **Wave 5 owns the same-commit sync**. **ZERO source files modified by Wave 1, verified four ways.** ⚙ **WAVE 2 COMPLETE — `192.2-02` + `192.2-03`, run in PARALLEL worktrees, merged at `00b81f63` / `7bd88426`.** ⚠ **G-5 on `WorkflowCard.tsx` is now DISCHARGED**: the lead/defer decision extracted to `cardFace.ts`, and the proof is the ORDERING — the characterization pin `WorkflowCard.baseline.test.tsx` was committed at `b1017d20`, ONE COMMIT BEFORE `cardFace.ts` existed (24/24 green), and `git diff --numstat` on it across the routing commit is **empty**. ⚠ **The business words were IMPORTED, not re-spelled** — `STATE_RUNNABLE`/`STATE_DRAFT`/`STATE_STARTER` already ship in `libraryVocabulary.ts:297-307`, so spelling them in `cardFace.ts` as the plan said would have created the exact second copy T-06 forbids; the consequence is stated rather than smoothed — **the starter word is `Shared starter`, not the plan's `Starter`**, and Wave 4 now picks in ONE place. `./cardFace.ts` was added to `LIBRARY_SUBTREE_PATHS` although the plan's `files_modified` did not name it: an unlisted module is swept by six fences **not at all**. `192.2-03` joined `last_run_at` + `last_run_status` onto all three feeds through one shared `_LAST_RUN_LATERAL_SQL` — **no migration, no column, no write** — and drove all three routes live over real HTTP with `response_model` in force (`/published` 120 rows, 32 populated / 88 explicit-null · `/starters` 3 · `/drafts` 80, 16 populated). ⚠ **`/starters` needed an owner-scoping signature change the plan did not name** — `list_starter_workflows` took no user at all, while five `is_system_global` published rows carry 20/15/11/7/1 real runs belonging to ONE user on a pool that bypasses RLS; it gained a keyword-only, `None`-defaulted, **fail-closed** `user_id`, and a cross-tenant probe on a real world-readable row proves the runner sees the facts and a stranger sees the row and two `null`s. ⚠ **`models/harness.py` was NOT modified — the plan's `files_modified` was WRONG**: both wire models live in `api/workflows.py`, and `WorkflowDraftRow` does not exist in the backend at all (it is the FRONTEND type name). ⚠ **Three pre-existing test needles were over-specified and were corrected beside their originals** — one pinned a TRAILING SPACE in `"AS token, updated_at "`, i.e. that `updated_at` was the LAST column, which that test never claimed. Gates post-merge, verdict lines read verbatim: `tsc -p tsconfig.app.json` **33, unmoved, ZERO under `library/`** · count gate **`OK — total 4506 · failed 0 · pinned total 4328 · 92/92`** · backend **62 failed / 2328 passed** (failure set identical to the Wave 1 baseline; `+39` passed is 192.2-03's own suite) · backend workflow + run-facts suites **162 passed / 0 failed**. **For Wave 4: `last_run_status` arrives RAW (a `switch` needs a total default arm), and an ABSENT key is a THIRD state distinct from `null` — D-08 forbids rendering either one blank or green.** ⚙ **WAVE 3 COMPLETE — `192.2-04`, run SEQUENTIALLY on the main working tree (4 task commits `8c5ec85b` / `1c90a1d9` / `4618c148` / `0d846456`).** The run truth now travels wire → `LibraryRow` → `runFacts.ts` → `CardFace`, and **STILL NO PIXEL CHANGED**: `WorkflowCard.baseline.test.tsx` passes with a `git diff --numstat` of exactly nothing against both `8c32d986` and the base SHA. ⚠ **`LibraryRow`'s two run fields are typed `string | null | undefined`, NOT the plan's `string | undefined`** — the neighbouring `updatedAt` normalizer deliberately collapses `null` into `undefined`, and doing the same here erases the difference between *the backend says there is no run* and *the backend never mentioned runs*, which IS T-13; both normalizers therefore pass the wire value **verbatim**, with no `??`. `runFacts(row, now)` returns a **three-armed** discriminated union — `ran` / `never` / `unknown` — where neither absence arm carries an `outcome` or a `when` member at all, so neither is *structurally* readable as a run. ⚠ **An unrecognised status resolves to `unknown`, never success**, via `hasOwnProperty.call` rather than `TABLE[key] ?? fallback` (which this repo has measured returning `[Function Object]`), and the suite drives `succeeded`, `COMPLETED`, `""`, the three IN-FLIGHT statuses and five inherited property names. ⚠ **`relativeChanged.ts` was SPLIT, not copied** — `relativeBand` is the same nine bands without the `changed ` prefix, so the fourth relative-time formatter in this repository was never written (T-16); its own suite passes **unedited**, which is what proves no band boundary moved. The five run words went to `libraryVocabulary.ts` (T-06), **not** into `runFacts.ts` and **not** borrowed from `runVocabulary.ts`, whose words are the CANVAS's and describe one step of a run being watched. ⚠ **THE APPROVED SKETCH ITSELF HAS THE T-13 BUG** — `dev/SketchLibraryCard.tsx`'s `runWords` claims a three-armed unknown in its comment and ships two arms plus a `Never run` catch-all; it was deliberately not copied. ⚠ **Two of this plan's own fences were wrong and were fixed by RUNNING them**: a source needle red on the docblock documenting its own rule (the 187-24 trap, fourth time in this subtree — now swept over comment-stripped source with a scoping control), and the inherited import-set regex **could not cross a line**, so it read TWO specifiers where the module has THREE. ⚠ **`libraryRow.ts` was the WRONG path for the normalizers** (they live in `libraryFilter.ts`; `libraryRow.ts` emits zero runtime code) — the THIRD wrong `files_modified` entry in this phase. Gates, verdict lines read verbatim from the **repo root**: `tsc -p tsconfig.app.json` **33, byte-identical to the base set, ZERO under `library/`** (measured after every task) · count gate **`OK — total 4574 · failed 0 · pinned total 4328 · 92/92`**, and the `+68` is exactly `52 + 11 + 5` with no residual · library subtree **12 files / 620 tests / 0 failed** · **no file under `backend/` or `supabase/` touched**. **For Wave 4: hoist ONE `now` per render into `cardFace(row, now)` — 107 rows each reading their own clock is P-1; and `libraryVocabulary.ts` measures `8 / 4 / 584` with NO ledger row, which Wave 5 owes.**
- [ ] **Phase 193: Authoring Doors + Template Placement** — the two doors are tellable apart before choosing; template supply has a findable home (AUTH-01, AUTH-03)
- [x] **Phase 193.1: Template-First Authoring** — the AI drafts knowing what the template asks for (AUTH-03, the re-opened half). ⚠ **INSERTED 2026-08-14.** `REQUIREMENTS.md` records AUTH-03 as **"ANSWERED WRONGLY, not delivered — RE-OPENED, needs a new phase"**: 193 shipped the *draft-then-attach* half (and quick task `260814-q5r` added the placeholder read on top of it), but a user who describes a workflow still gets a draft built **blind to the template it will have to fill** (`SEED-157`). Measured: `POST /workflows/generate` has accepted `template_placeholders` since **Phase 103** and the frontend has **never sent it** (`WorkflowBuilderPage.tsx:1267` sends `{describe, project_folder_id?}` only); its sibling `template_asset_id` is typed `UUID` while asset ids are Storage **paths**, a measured 422. Same shape as 192 → 192.1: the parent phase shipped, a real gap was found in lived experience, and the gap gets its own phase rather than a closure round (G-7) ✅ **CLOSED 2026-08-15 — AUTH-03 SATISFIED on a real run** (`193.1-UAT.md` § U5: run `d8331add`, all 10 template fields rendered, branding intact, 11 of 13 planted facts). 11 plans / 7 waves; **plan `193.1-11` was authored MID-PHASE** after `193.1-04` measured the phase's central assumption false. Gates at close: `tsc` **33** unmoved, count gate **3892 / failed 0 / 75 pinned**, backend **62 (SEED-056 rot) / 2092**, G-7 clear, **no guardrail override** (G-5 fired on THREE files, all honoured). ⛔ **CLOSED WITH THREE UAT ROWS OWED BY DECISION, not by oversight — U2, U3, U4** (screen-judgement rows: control confusability, the disabled-CTA explanation, the describe-column fold). ⚠ **Two publish blockers found on the phase's own headline path and NOT fixed here** — `SEED-163` and `BUG-260815-01` (blocking), both routed to 197 / AUTH-02; the second is a consequence of this phase's own D-26 fix.
- [x] **Phase 193.2: From Authored to Runnable** ✅ **CLOSED 2026-08-15 — all four SCs DRIVEN, `AUTH-03` SATISFIED END TO END** (run `b021c7b0`: 10 of 10 template fields filled, 0 residual `{{ }}`, branding verified against a screenshot, all eight planted facts grounded; requirement pre-filled and durable; published with the canvas untouched; found at rendered position 4 of 112 without searching). ⏸ **Closed with TWO UAT rows NOT driven, by decision: U5** (the composer picker — the one consequence of the sort outside the library, thirty seconds) **and U2** (⚠ **unschedulable — no interactive step appeared, so the rewritten refusal copy has still never been read by a person; the defect not occurring is not the same as its message reading well**). 10 plans / 6 waves; **five hot-file ledger rows written for files G-5 could never see**; code review 0 Critical / 0 Warning / 5 Info; **G-7 clear**; **no guardrail override — the third consecutive phase to decline one**. Both blocking reports **CLOSED on driven evidence**, each with a falsifiable re-open trigger because `BUG-260815-01`'s closure rests on a **frequency (0/20), not an absence**. Four bugs + three seeds filed from the UAT session, incl. **`SEED-159`, whose trigger FIRED and whose prediction was WRONG** — everything between *"the AI wrote my workflow"* and *"I can run it and find it again"* (SEED-163, BUG-260815-01, BUG-260815-02). ⚠ **INSERTED 2026-08-15 on an explicit operator instruction that overruled the original routing.** All three were first routed to 197 / AUTH-02 because that is the phase already scoped to authoring; the operator hit **two publish walls in a single sitting** on Phase 193.1's own headline path and ruled them blocking. **The original reasoning is left visible in each artifact rather than overwritten** — it optimised for tidiness of scope, not for whether the product could be used. **The three share ONE root, which is why they are one phase and not three fixes: the authoring path makes decisions the author is never shown, and does not know what the publish gate requires.** ⏸ **EXECUTED 2026-08-15 — 10 of 10 plans, all gates green at HEAD, and DELIBERATELY NOT MARKED COMPLETE: all five UAT rows are OWED and no success criterion is ticked that a person has driven** (`193.2-UAT.md`). Gates: backend **62 failed / 2154 passed** (failures identical to baseline — the SEED-056 rot set) · six backend workflow suites **110 / 0** · five frontend workflow suites **359 / 0** · count gate **OK · 3918 · failed 0 · 75/75** · `tsc` **33** unmoved. **No guardrail override recorded — the third consecutive phase to be offered one and decline; G-5 fired on seven files and all seven were honoured by construction.** ⚠ **Both blocking reports stay `folded`, not `closed`, and the reason is a measurement:** `BUG-260815-01`'s fix is prompt-level and non-deterministic — measured `llm_human_input` **0/20** against a pre-fix 2/2-with-a-template, **a REDUCTION and never an absence**, which is exactly why the publish gate stays; `BUG-260815-02`'s ordering half is closed and proved server-side, but **position 4 of 109 is not position 1** and whether that is "findable" is the operator's judgement. ⚠ **Its own G-5 flag was measured FALSE — `api/workflows.py` was never touched** — and its `db/workflows.py` prediction understated the file, which turned out **absent from the hot-file ledger entirely at 17 phases**, the second-hottest backend file in the tree. **FIVE ledger rows were owed, not the three planned.**
- [ ] **Phase 194: Stop a Running Workflow** — a run can be stopped mid-execution and reports `cancelled` honestly (RUN-01)
- [x] **Phase 194.1: Make the Stop Visible** — ✅ **COMPLETE + VERIFIED 2026-08-16** (8 plans / 6 waves; UAT driven 5 of 5 rows, 5 PASS; one gap-closure fix; `194.1-VERIFICATION.md`). ⚠ **RUN-01 stays UNTICKED — the phase GOAL is met and the REQUIREMENT is not, and those are different statements**: its second clause (*"reports honestly that it was stopped"*) fails on ~half of stops at `WORKER_COUNT=2` (L-01, no terminal guard on `finish_run`). ⚠ **L-01 is recorded as an OWED PHASE with NO ROADMAP HOME — insert it next.** Fold outcomes: `BUG-260816-01`/`-02` folded; `BUG-260709-01` Direction A only; **`BUG-260610-01` RE-OPENED — its fold claim was refuted on screen the same day.** — the stop a user presses is legible: acknowledged on press, available on the run surface, and still visible in the thread afterwards (RUN-01, the re-opened user-facing half). ⚠ **INSERTED 2026-08-16.** Phase 194 landed the durable half and **verified it on seven live runs**; its own UAT then found a person cannot perceive any of it — the composer/tray Stop give no feedback, `WorkflowRunPage.tsx` has **no Stop control at all** (grep → 0), and a stopped thread shows only the original prompt. Claims `BUG-260816-01` + `BUG-260816-02` and the two re-opened `BUG-260709-01` + `BUG-260610-01` — **all four still `status: open`; the fold happens at discuss-phase.** Routed here rather than to a third gap-closure round on 194 (**G-7**) — this is missing capability, not defect repair of 194's own output. **G-2 fires: sketch first.**
- [ ] **Phase 195: Show the Deliverable** — a produced file is shown from the run surface, reusing the shipped file presentation (RUN-02, RUN-03)
- [x] **Phase 196: Registry-Backed Model Picker (canvas)** — a step's model comes from the live registry, never typed (AUTH-04)
- [ ] **Phase 197: Guided Authoring** — drafting from a description guides the decisions that change the result (AUTH-02)
- [ ] **Phase 198: Node Vocabulary (research-first)** — prove the deterministic-primitive need before shipping one; cover structured mid-run input (NODE-01, NODE-02) ⚙ **WAVE 4 COMPLETE — `192.2-05`, run SEQUENTIALLY on the main working tree (4 task commits `e2ebbbfc` / `70b7863b` / `98b47c19` / `68f2ac71`).** ✅ **LIB-06 IS SATISFIED ON SCREEN**: the card renders sketch 179 variant C — a 3px run gutter, the NAME still leading line 1 with the version deferred to its right (D-02; variant B was not chosen), and **line 2 saying the run truth then the state in BUSINESS words**. Three rows sharing ONE name and differing only by their last run now say **three different things**, asserted as a mutual-distinctness property and RE-ASSERTED after every `class` attribute is stripped off the rendered DOM — so *colour is never the only carrier* is proved, not promised. ⚠ **THE SUBTRACTION LANDED AS EXACTLY SIX ATOMS AND THE DELTA IS PROVED RATHER THAN CLAIMED.** Wave 1's finding held exactly: the cut is **TWO JSX nodes**, `<WorkflowSoul scale="card" />` and the fork-consequence `<p>`. The characterization pin was **RE-BASELINED BY INVERSION** — each of the six flips from *asserted present* to **asserted ABSENT**, **not one assertion was deleted** — plus a new sweep asserting all six absent on all three provenance faces; the pin went `24 → 29` cases, i.e. it grew STRICTER while growing. ⚠ **THREE SURVIVING ATOMS CHANGED THEIR LITERAL AND NONE DEPARTED** (D-06 — the mark, the folder chip, the state word): an auditor counting *"exactly six left"* must count DEPARTURES, not edits. ⚠ **`WorkflowSoul.tsx` and `lib/phaseGlyph.tsx` are BYTE-UNTOUCHED** (`git diff --stat` → 0 lines): the soul is CONSUMED not owned and still renders at `scale="run"` / `scale="pub"`, and the phase-glyph map is TOTAL OVER PHASE TYPES — `icon-convention.md` §4 forbids a phase-type glyph as a category icon BY NAME, so **the plan's `files_modified` naming `phaseGlyph.tsx` was DECLINED rather than obeyed. That is the FOURTH wrong path in this phase's plans** (after `models/harness.py` and `libraryRow.ts`). The three marks became **`lucide-react`** icons — the house chrome set this very file already drew three marks from, so no fourth icon path was introduced. ⚠ **THE IDENTITY LINE MOVED FROM DOM POSITION 2 TO 3**, deliberately: D-01 numbers the run truth as line 2 and 179-C is SILENT on the order (it rendered no identity line at all). Five child-order assertions moved with it in the same wave — which is exactly what asserting placement by child order was FOR. **LIB-05 was NOT re-opened**: no field, word or resolver of `rowIdentity.ts` changed. ⚠ **TWO CONSEQUENCES ARE RECORDED RATHER THAN SMOOTHED.** (1) On a name-colliding row `resolveIdentity` picks the STATE AXIS as its discriminator, so `Ready to run` now renders **TWICE** — line 2 and the identity line — found by a card-wide `getByText` throwing *"Found multiple elements"*, not by reasoning; **not fixed here** (D-04 forbids re-opening LIB-05, `rowIdentity.ts` is outside `files_modified` with 72 pinned cases, and the card *invents no part and drops none*), re-open trigger: an operator reads the stutter on the real shelf. (2) The filter still matches on `purpose` but the purpose hero is gone, so **a search hit is no longer self-explaining** — pinned in that direction with the trade written beside it. ⚠ **THE FORK CONSEQUENCE MOVED INTO THE `⋯` MENU, IT DID NOT DIE** (T-21) — `aria-describedby` round trip intact, and it is a plain `<p>` so Radix's roving focus and typeahead skip it. **P-1 discharged**: ONE hoisted `now` reaches `cardFace(row, now)`, the same instant the page already hoists for `resolveIdentity`. Gates, verdict lines read verbatim from the **repo root**: `tsc -p tsconfig.app.json` **33, byte-identical to the base set, ZERO under `library/`** (measured after every task) · count gate **`OK — total 4594 · failed 0 · pinned total 4328 · 92/92`**, and the `+20` is exactly `15 + 5` with **no residual** · library subtree + `WorkflowsPage` **12 files / 640 tests / 0 failed** (`WorkflowsPage.test.tsx` held at **55/55** — no pinned file decreased) · **no file under `backend/` or `supabase/` touched**. **For Wave 5: `WorkflowCard.tsx` re-derives to `11 / 4 / 1104` against a ledger row reading `8 / 3 / 818` — a FIFTH stale/absent ledger obligation alongside `libraryVocabulary.ts` (`8 / 4 / 584`, no row at all) and the count-gate constants.**

### Phase Details

> ⚠ **Format note (2026-08-10).** This section was rewritten from bold `**Phase NNN: …**` labels to
> `#### Phase NNN: …` headings. The GSD SDK resolves a phase with `#{2,4}\s*Phase\s+<n>\s*:`
> (`bin/lib/phase.cjs:221`); under the bold form **every** phase op for 192-198 returned
> `phase_found: false`, blocking `discuss-phase`, `plan-phase`, `execute-phase` and `progress`.
> No goal, requirement or success criterion was changed — only heading level and field structure.

#### Phase 192: Workflow Library IA

**Goal**: The Workflows page can be searched, filtered and read at a glance, and its card actions are predictable.
**Depends on**: Nothing (first phase of the milestone; deliberately the most independent).
**Requirements**: LIB-01, LIB-02, LIB-03, LIB-04
**Flags**: **G-2 fires (visual)** — sketch before spec/discuss. SEED-136 re-open trigger #3 says the same: do the IA question FIRST, do not restyle underneath it. **G-5 FIRED and was HONORED** at discuss-phase (`514c8e64`) — `WorkflowsPage.tsx` had been absent from the hot-file ledger for all ten phases that touched it (row added `d0c76525`); the seam is split by what survives 192 (D-01). **G-2 SATISFIED** — sketches 157/158/159, winners 157-B · 158-A · 159-C.
**Success Criteria** (what must be TRUE):

  1. A user can find a named workflow by typing part of its name.
  2. A user can narrow the list without reading every card.
  3. A user can state what a card's actions will do before clicking one; "Tweak" no longer surprises.
  4. The create affordance is reachable without scrolling past the existing shelves.

**Plans**: 12 plans across 8 waves — **ALL 12 EXECUTED 2026-08-11** (65 commits off base `17c30d4f`). Gates at close: count gate **60/60 pinned · total 3175 · failed 0**, `tsc -p tsconfig.app.json` unmoved at **33**, eslint + a11y 0, zero file deletions. `WorkflowsPage.tsx` **1407 → 1007 L** — its CODE **615 → 479 (−22.1 %)**; comments carry the difference, stated rather than smoothed.

⛔ **OWED — the eleven G-4 lived-experience UAT rows were NOT run.** Operator decision 2026-08-11: close with the rows owed. This is a DECISION, not a claim that everything ran. **Run U6 FIRST** — pick a project, and starters must remain **with a stated reason**; silence is a FAIL. It exists because of a measured IA defect under D-17 that no structural test can catch. **Then U4** — the `[title]` sweep, excluding the `workflow-soul` subtree (its two survivors at `WorkflowSoul.tsx:99` / `PhaseSpine.tsx:77` are inherited and out of scope; left unstated the row would fail 192 for a defect two prior phases shipped). Full record, tally (`0 driven · 0 passed · 0 failed · 11 owed`) and driving notes: `192-VALIDATION.md` § Manual-Only Verifications. Threats `T-192-21` / `T-192-32` remain **UNMITIGATED — OWED**.

⛔ **DEFERRED — D-07's search HIGHLIGHT is unshipped**, on measured grounds: wiring `HighlightTitle` REDS fence F1 by construction, its prop being spelled `title` (observed with a real plant, not reasoned). LIB-01's wording is *"search by name and filter the list"*, so this is a deferred DECISION, not a requirement gap. Re-open trigger: any phase that makes `title` legal in the library subtree, or a `HighlightTitle` variant whose prop is not `title`.

⚠ **NOT 192's, recorded so the next reader does not re-derive it:** an intermittent failure at **2 of 14** gate runs, always the same Phase-**184** case — `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` → *"184-11 … POSITIVE CONTROL — with the flag ON the very same read finds the key"*, `expected 0 to be greater than 0`. Identified from the gate's own JSON reports, not guessed. Deliberately NOT fixed inside 192 — it would fold unrelated drift into a commit that did not cause it. Re-open trigger: any phase touching that suite, or a third sighting outside 192.

- [x] `192-01-PLAN.md` (wave 1) — count-gate adoption: the five suites covering this page were in NEITHER knob (74 of 123 tests invisible). Must be commit 1.
- [x] `192-02-PLAN.md` (wave 1) — D-04 backend: `is_mine` + `is_system_global` computed server-side on `/published` and `/starters`, never a raw `created_by`; the widened wire type.
- [x] `192-03-PLAN.md` (wave 2) — `RunModal` characterization baseline, 6 states, captured while `library/RunModal.tsx` provably does not exist.
- [x] `192-04-PLAN.md` (wave 2) — delete-Sheet characterization baseline, 7 states + the two graded-guard invariants; the real ≈169 L extent recorded.
- [x] `192-05-PLAN.md` (wave 2) — the pure leaves: `libraryRow` · `libraryVocabulary` · `libraryFilter` (merge/dedupe-by-id/chips/substring search) + the F1/F4/F5 subtree fences.
- [x] `192-06-PLAN.md` (wave 3) — D-01 move 1: `RunModal` out of the page, create-additively then cut, zero re-capture.
- [x] `192-07-PLAN.md` (wave 3) — `LibraryToolbar`: create leads · always-on search · six counted chips · project select + the D-17 starters note · the updating marker.
- [x] `192-08-PLAN.md` (wave 4) — D-01 move 2: `WorkflowDeleteSheet` out of `PublishedCard`, state + JSX as one unit, proved on the original render path.
- [x] `192-09-PLAN.md` (wave 5) — `WorkflowCard` (159-C): one verb + `⋯`, the fork consequence as an `aria-describedby` contract, no `Publish…`, the D-18 draft delete.
- [x] `192-10-PLAN.md` (wave 6) — the page becomes composition: `allSettled` merge, one flat list, shelves/rail/cards/banner deleted, four tests rewritten and two deleted with the one authorized pin lowering.
- [x] `192-11-PLAN.md` (wave 7) — LIB-01…04 behaviour at 200 workflows: search, chip honesty, the carve-out, D-17, the D-04 cross-check, F2/F3 and create-first DOM order.
- [x] `192-12-PLAN.md` (wave 8) — every fence driven RED against a real plant and restored md5-identical, the subtree delta MEASURED, all suites pinned, G-5 recorded satisfied. **Task 3 (the eleven G-4 UAT rows) CLOSED BY DEFERRAL, not completed** — see the ⛔ OWED note above.

**⚠ GAP-CLOSURE ROUND 1 — opened 2026-08-11 (4 plans, waves 1-4).** SC#3 was found **UNMET in lived
experience**: `192-UAT.md` row U5, driven by the operator, hit `⋯ → Make my own copy` on *Compliance
Gap Report* and got **HTTP 409 twice with zero user-visible signal** — `workflow_definitions` stayed
at 222, nothing created, nothing navigated. Two compounding defects, both INHERITED from Phase 103
(`3adcb0ae`) and never touched by 192: the fork's version is computed from `definition.version`, a
JSONB key that is NULL on every row, so it is hard-wired to 2 in practice and collides forever on the
GLOBAL `UNIQUE(slug, version)`; and the catch swallows every error into `console.error`. Re-measured
at plan time: **18 slugs carry more than one version, 16 of them `v1 published + v2 draft`.**
Operator decision (2026-08-11): **when the user forks a workflow they already have a draft fork of,
OPEN THE EXISTING DRAFT** — it removes the failure class for those 16 rather than making the collision
rarer, and needs no backend and no wire-type change. G-7 ran **clear** (exit 0, 0 prior gap plans).
⛔ **NOT in this round:** U5-b card density (13 atoms per row — design work, routed to a sketch under
G-2, and folding it here would be the exact G-7 violation), and the **2 of 18** `published + published`
slugs (`meridian-risk-summary-good-07aedc33`, `readonly_refusal_098uat`) whose fork still refuses —
the change is that it now refuses OUT LOUD.

- [x] `192-13-PLAN.md` (round 1, wave 1) — the words: `FORK_CONSEQUENCE_EXISTING` + `forkFailedMessage`, and the card's consequence sentence becomes state-aware (default byte-identical to what shipped).
- [x] `192-14-PLAN.md` (round 1, wave 2) — `onTweak` opens the existing draft instead of colliding with it; `hasExistingFork` wired from the merged feed; **the regression test that forks a slug WHICH ALREADY HAS A v2** — the branch 3176 passing tests never entered, driven RED first.
- [x] `192-15-PLAN.md` (round 1, wave 3) — WR-03: both fork handlers surface a visible failure; `onUseStarter`'s single 409 retry is PRESERVED and pinned at two calls; no toast library added.
- [x] `192-16-PLAN.md` (round 1, wave 4) — pin both grown suites at READ numbers with the `[count-decrease]` guard driven RED; fences + characterization baselines proved unmoved; ROADMAP + hot-file ledger updated on measurement; **blocking operator checkpoint: re-drive U5.**

**⚠ GAP-CLOSURE ROUND 1 — CLOSED 2026-08-12. What it closed, and what it did NOT.**

**Closed:** the dead fork verb. `⋯ → Make my own copy` on a published row you have already forked
now OPENS the copy you started rather than attempting a colliding INSERT — the failure class is
REMOVED on those rows, not made rarer, because the branch creates nothing that can 409 (`192-14`).
Every fork click that still fails renders a visible sentence naming the workflow and stating that
nothing was created and nothing was changed, on BOTH handlers, because D-12 gives them one word on
the card face and a user cannot tell which they clicked (`192-15`). The card SAYS so before the
click, selected into the ONE existing `fork-consequence` node so the card gains no atom (`192-13`).

**Gates at round close, all measured** (`192-16`): count gate **60/60 pinned · total 3188 ·
failed 0 · exit 0**, with the two grown suites now pinned at numbers READ from the gate's own
`actual` column across two agreeing capped runs — `WorkflowsPage.test.tsx` **40 → 48**,
`WorkflowCard.test.tsx` **35 → 39**. The pin was **driven RED, not asserted**: deleting one whole
`it(` block printed `[count-decrease] … pinned 48, ran 47 (-1)` at `failed 0`, exit 1, and the file
restored md5-identical. `tsc -p tsconfig.app.json` unmoved at **33**, eslint + a11y **0**. All five
negative fences (**64**) and all three characterization baselines (`RunModal` **32**, `RunModal.a11y`
**16**, `PublishedCardDelete` **32**) UNMOVED with **zero re-capture** — this round changed what a
click does and what the page says, never how anything renders.

⛔ **NOT closed, and named rather than implied:**

- **U5-b card density** (13 atoms per row) — design work, routed to a sketch under G-2. Folding it
  into a closure round would be the exact G-7 violation.

- **The 2 of 18 `published + published` slugs** (`meridian-risk-summary-good-07aedc33`,
  `readonly_refusal_098uat`) have no draft to open, so their fork still refuses. **The change is
  that it now refuses OUT LOUD.** Named verbatim in `WorkflowsPage.tsx`.

- **WR-08** — the 409 classification still keys on error prose (`String(e).includes("409")`), now
  with ONE home instead of two. The real fix is a typed error at `createWorkflowDraft`'s throw site,
  an `api.ts` change with callers outside this page. Re-open trigger: the next phase that touches
  that throw site.

- **The four pre-existing count-gate drifts** (`ExternalActionSection` +9, `PhaseTimeline` +4,
  `WorkflowBuilderPage.canvas` +5, `builderStore` +6 = **+24 cases deletable with the gate green**)
  are unchanged and still owed as their own edit — deliberately not absorbed into a commit that did
  not cause them.

- **`D-192-DEF-01`** stands, with an HONEST characterization replacing `192-14`'s: capping at
  `GSD_VITEST_MAX_WORKERS=4` **REDUCES the flake, it does not eliminate it.** Measured by the
  orchestrator across three CAPPED runs on one tree: `failed 0`, `failed 0`, **`failed 1`**. The
  COUNT columns remain the regression backstop; the `failed` line, on this machine, is not.

#### Phase 192.1: Workflow Identity

**Goal**: A user can tell one workflow from another at a glance — which is which, whose it is, and which one just changed.
**Depends on**: Phase 192 (this is the surface 192 built; 192.1 gives its rows an identity).
**Requirements**: LIB-05 (new — see REQUIREMENTS.md)
**Inserted**: 2026-08-12, from Phase 192's own UAT. **This is NOT a gap-closure round** — G-7 forbids new user-facing capability inside a closure round, and an identity axis is capability. Phase 192's round 1 is closed and stays closed.

**Why this exists — measured, not asserted.** Phase 192 shipped search, six honest chips, one flat list
and predictable card actions. Nine of eleven G-4 UAT rows passed on live evidence. The operator then
used it and could not tell the rows apart. The measurement that explains it, over their own 104
workflows:

| Name | Rows | Distinct slugs |
|---|---|---|
| **Compliance Gap Report** | **43** | 41 |
| Risk Register | 10 | 9 |
| Weekly Status Report | 8 | 5 |
| Project Meridian Risk Summary (GOOD) | 8 | 4 |

**14 duplicated names; 41% of the library carries one name**, drafts and published interleaved.

⚠ **The original diagnosis was WRONG and is corrected here rather than quietly replaced.** This was
first logged as *"card density — 13 atoms per row"* (`U5-b`, severity minor). Removing atoms would not
have helped at all: **forty-three identical titles are indistinguishable at any density.** Raised to
major and re-scoped to identity.

### ⚠ A "two names" propagation defect was claimed here on 2026-08-12 and is **RETRACTED** — the check that would have caught it was run afterwards

**The retracted claim:** that a row carries a `name` column and a conflicting `definition->>'name'`,
that they disagree on 85 of 104 rows, and that `onTweak` therefore names a fork after the wrong
workflow. **That was wrong.** It was generalised from **n=1** — one surprising name returned by a
cleanup `DELETE` — and written up before the population was measured. It is left visible rather than
deleted, because the failure mode (a single observation promoted to a mechanism) is the same one this
phase exists to correct.

**What the measurement actually shows.** `select jsonb_typeof(definition) … group by 1`:

| `definition` column type | rows | have a `phases` array |
|---|---|---|
| **`string`** (double-encoded) | **83** | **0** |
| `object` (a real definition) | 20 | 20 |

`definition->>'name'` returns NULL on a **string scalar** — you cannot key into one. So "85 divergent"
was never 85 conflicting names; it was **83 rows whose definition is double-encoded**, plus 2 genuine
conflicts. `jsonb_object_keys` on them errors outright with *"cannot call on a scalar"*, which is the
already-recorded `definition` string-scalar trap.

**The genuine conflicts are exactly 2**, and they are test fixtures, not a pattern:

| `name` column | `definition->>'name'` | slug |
|---|---|---|
| SC10 multi-tool probe | Compliance Gap Report | `sc10-multitool-84c452` |
| SC10 armed-wait probe | Compliance Gap Report | `sc10-armed-f77e72` |

**And the answer to the question that mattered: the 42 duplicates were SEEDED, not created.** All 42
are `jsonb_typeof = string`. The app's own write paths bind `json.dumps(definition.model_dump())`
through a Pydantic model on which **`name: str` is REQUIRED** (`harness.py:519-522`), for both the
insert (`db/workflows.py:490-497`) and the update (`:580-598`, which writes `name` and `definition`
**together from one model**, so editing cannot drift them). A row the app wrote therefore *cannot*
have a null JSON name. These 83 did not come from those paths.

**So there is no name-propagation defect, and 192.1 does NOT have a cheap defect half.** It is the
design phase it was originally scoped as.

⚠ **Two real things did fall out of the check, and neither is this phase:**

1. **83 of 104 rows carry a double-encoded `definition`** — the recorded string-scalar trap, at
   scale, in the dev database. Whether any *live* app path still writes that shape is **unverified and
   worth its own check**; if one does, it is a real bug that silently empties `definition->'phases'`.

2. **The duplicate names are largely a dev-database artifact.** That does **not** dissolve LIB-05 —
   `onTweak` mints `<same name> v(N+1)` by design, so a real customer generates genuine duplicates by
   using the product normally — but the *severity* seen on this machine is inflated by test data, and
   192.1 must be judged against a fixture built to be realistic rather than against these 42 rows.

⚠ **It is partly UPSTREAM of the library.** Nothing stops duplicates being created — `onTweak` mints
`<same name> v(N+1)` deliberately. A read-side fix alone leaves that running. Whether this phase
touches naming/lineage is the first scope question, not an assumption.

⚠ **Why no gate caught it, recorded so the next phase inherits the lesson.** Every automated check in
192 ran against fixtures with **distinct names**. `LIB-02`'s bar — *"a card shows what the workflow is
for, at a glance"* — is true of one card in isolation and false of the list. 192 tested at 12 rows and
at 107 rows but never at *107 rows carrying 14 duplicated names*: **volume was real, shape was not.**
That is the 045 real-scale lesson in a new costume, and it is now a standing question for any
list-rendering phase — *is the fixture's SHAPE realistic, not just its SIZE?*

⚠ **And the verification of the fix was itself too weak — recorded against this project's own work.**
The post-fix re-drive proved the repaired fork by selecting its row with `getElementById` on a known
UUID. That proves the code and cannot prove the row was *findable*, because the driver never had to
find it. The operator, who did, could not. **A machine check that bypasses the human's actual task
does not verify the human's task.** Any UAT row in this phase must be driven the way a person would:
by looking.

**Flags**: **G-2 fires** — this is visual/IA work; sketch before planning. ~~G-5: `WorkflowCard.tsx` and `WorkflowsPage.tsx` are both on the hot-file ledger — check it before planning.~~ **⚠ CORRECTED ON MEASUREMENT (2026-08-13, plan `192.1-08` under D-02). The struck sentence above is FALSE and is left readable beside its correction rather than deleted, which is this project's habit.** What it said: *both* files are on the hot-file ledger. What was true when it was written: **only `WorkflowsPage.tsx` was.** `grep -o "WorkflowCard.tsx" CLAUDE.md | wc -l` returned **2**, and both occurrences sat inside the `WorkflowsPage.tsx` row's *prose* (*"`WorkflowCard.tsx` 545 L is a REWRITE"* and *"carries the identical figure"*) — a sentence is not a row, and the G-5 audit scans the table. (D-02 itself says *"the **single** occurrence"*; measured it is two — the count is corrected, the conclusion is not.) And on the numbers it would not have fired anyway: `git log --oneline -- frontend/src/components/workflows/library/WorkflowCard.tsx | wc -l` → **4 commits** at phase open, all in **ONE** phase (192), **567 L** — against a G-5 threshold of **≥ 3 phases**. **The flag is not deleted, it is made true:** G-5 fired on `WorkflowsPage.tsx` alone; it was HONOURED — `192.1-03` cut the fork concern out into `libraryFork.ts` + `useWorkflowFork.ts` in Wave 3, *before* the feature it made room for landed in Wave 6. And `WorkflowCard.tsx` **is on the ledger now**, added by `192.1-08` at its measured young count (**6 commits / 2 phases / 721 L**, G-5 explicitly NOT firing), because *a guardrail cannot see what is absent from its list* — which is exactly how `WorkflowsPage.tsx` escaped G-5 for ten phases. Cross-provider roster does NOT apply (no streaming, agent loop, provider routing, or UI-state surface).

**Success Criteria** (what must be TRUE):

  1. At 100+ rows containing at least 14 duplicated names, a user can identify a specific workflow without opening it — **the fixture must carry the duplicate shape, not just the row count.**
  2. A row says whose it is and how it relates to what it came from (original vs your copy, and of what).
  3. A user can tell which workflow changed most recently.

**How we'd know this failed** (G-6): the operator opens the library on their real data and still cannot point at a row and say which one it is; or a fix is verified by a driver that located rows by id rather than by reading the screen.

**Plans**: 8 plans in 7 waves (G-2 satisfied — sketches 160/161/162 driven, operator picked 160-B · 161-A · 162-B, 163 assembled with a generated build contract).

Plans:

- [ ] 192.1-01-PLAN.md — `updated_at` end to end: 4 SELECT lists, 2 Pydantic models, 3 builders, 2 wire types, `LibraryRow.updatedAt`, both normalizers (D-15/16/17)
- [ ] 192.1-02-PLAN.md — the pre-move baselines, captured on the UNMOVED tree, with the line classifier validated against 188.2's known-good (D-01)
- [ ] 192.1-03-PLAN.md — **the G-5 extraction**: `libraryFork.ts` + `useWorkflowFork.ts`, the page cut over, the OD fence extended, the growth measured (D-01/22/24/29/37)
- [ ] 192.1-04-PLAN.md — the ported COPY table, the nine-band `relativeChanged.ts`, and the scale fixture carrying the duplicate AND orphan shapes (D-14/18/25/26/30)
- [ ] 192.1-05-PLAN.md — `rowIdentity.ts`: the O(n) index, the four-state lineage whose fourth state is silence, and the D-31 ranker (D-03/04/05/12/13/31/32/34) + the two new fences (D-09/16)
- [ ] 192.1-06-PLAN.md — the 14th atom at DOM position 2, the `[rows]`-keyed memo and the hoisted clock (D-05/06/08/09/10/11/28/34)
- [ ] 192.1-07-PLAN.md — 162-B's fork name prompt, and 192's D-15 amended in the same commit (D-19/20/21/22/23/24/36)
- [ ] 192.1-08-PLAN.md — both hot-file ledger rows re-measured, the ROADMAP flag corrected, `192.1-UAT.md`'s nine G-4 rows, and the operator drive (D-02/07/27/28/31)

⚠ **Wave parallelism is genuinely limited here and it is stated rather than smoothed.** Only Wave 1
carries two plans. Every later wave is a single plan, because `WorkflowsPage.tsx` and
`librarySubtree.fences.test.ts` are the two files nearly every part of this phase touches, and D-33
requires the fences suite be widened in the SAME commit that adds a module — so two module-adding
plans can never share a wave. The 2-concurrent-vitest cap (`GSD_VITEST_MAX_WORKERS=4`) is therefore
never approached after Wave 1.

#### Phase 192.2: Does This One Work?

**Goal**: A user scanning the library can tell which workflows actually work — what ran, when, and whether it succeeded — and the card gets quieter, not louder, while saying it.
**Depends on**: Phase 192.1 (this rides the identity line 192.1 shipped; it does not replace it).
**Requirements**: LIB-06 (new — see REQUIREMENTS.md)
**Inserted**: 2026-08-19, from sketch 179. **NOT a gap-closure round** — G-7 forbids new user-facing capability inside one, and a run-truth axis is capability.
**Flags**: **G-2 SATISFIED** — sketch 179, winner **C (the triage board)**, and it is the project's first sketch that RENDERS the real `WorkflowCard` (dev route `/sketch-card`) rather than redrawing it, so `SEED-155` cannot recur here. ⚠ **G-5 FIRES on `WorkflowCard.tsx` with an obligation carried since sketch 175 and still UNDISCHARGED — this phase discharges it in Wave 1, BEFORE the feature.** G-1 does not fire (only one prior `192.x`).

**Why this exists — measured against the live DB on 2026-08-19, not asserted.**

| Candidate differentiator | Populated on real rows |
|---|---|
| `business_requirement` (the purpose line) | **16 / 117 — 14%** |
| non-empty `phases` | **28 / 117 — 24%** |
| **last run + outcome** | **32 of 36 published — 89%** |

117 real rows (excluding the `Global WF` / `Preview WF` test data), **96 distinct slugs**, 37 distinct
names. `Compliance Gap Report` is **43 rows across 41 DISTINCT slugs** — 41 separate workflows, not
versions of one, so collapsing versions does not help. **69% of the library is drafts.**

⚠ **The data already exists and is simply not joined.** `workflow_runs` holds **228 rows** (186
completed · 31 failed · 11 cancelled). The backend half is a `LEFT JOIN LATERAL` plus two keys on
`PublishedWorkflow` / `WorkflowDraftRow`. **No migration.**

**The settled card language (sketch 179, variant C):**

| Slot | Carries |
|---|---|
| gutter, 3px | last-run outcome — success / failure / never run. Colour, **and never colour alone** |
| line 1 | the **name**, dim mono version right |
| line 2 | the run truth in words, then the state in **business** words |
| everything else | **cut** from the resting card |

⚠ **C partially REFUTES sketches 177/178, and that is recorded rather than smoothed over.** Both argued
*lead with state, the name cannot be the differentiator*. C keeps the name as the lead; what moved is
the encoding. The subtraction is ~7 of the shipped card's 9 information rows: the purpose sentence,
`needs kickoff_prompt`, the phase glyphs, `STRICT`, `produces:`, and the two-line fork-consequence
paragraph all leave the resting card.

**Two defects found by reading the component, folded here:** the card's marks are **emoji**
(`📄 ✨ 📝`), against our single-source icon convention; and its state words are **system vocabulary**
(`published` / `draft`) rather than business vocabulary.

**Success criteria**
1. A published workflow's card states when it last ran and whether that run succeeded, in words plus colour — and a workflow that has never run says so explicitly rather than rendering blank.
2. The run facts reach the card from the library feed (no per-card fetch), and a feed that does not carry them degrades to "unknown", never to a fabricated time or a green tick.
3. The lead/defer decision lives in a presentation module, not in `WorkflowCard.tsx` — G-5 discharged, and the three library surfaces share ONE language rather than three copies.
4. The resting card is measurably quieter than today's: the six named atoms above are gone from it.
5. No emoji and no system vocabulary reach the user on the card.

**⚠ Teardown owed in this phase**: `frontend/src/dev/SketchLibraryCard.tsx` and the `/sketch-card` branch in `frontend/src/main.tsx` delete together once the real card lands.

#### Phase 193: Authoring Doors + Template Placement

**Goal**: A user can tell the two authoring doors apart before choosing, and can find where to supply a template.
**Depends on**: Phase 192 (the library is the surface the doors are reached from).
**Requirements**: AUTH-01, AUTH-03
**Flags**: **G-2 fires.** AUTH-03 is placement and discoverability — the capability shipped in Phase 152; this is NOT a rebuild.
**Success Criteria** (what must be TRUE):

  1. A person who has not seen the Builder can predict what each door does before clicking.
  2. The number of perceived choices does not increase (the 187 template-door lesson — seed the existing path, do not add a third).
  3. A user with a template to fill can find where to supply it.

**Plans**: 11 plans in 7 waves

Plans:
**Wave 1**

- [x] 193-01-PLAN.md — D-08 wave 0: six whole-`innerHTML` captures of the UNMOVED doors + the launch-error case that must survive D-17, in commits touching no source file
- [x] 193-02-PLAN.md — `templateAdmission()` in `soulData.ts` (D-21/D-25, three-state, bound-asset arm) + the two AUTH-03 strings in `libraryVocabulary.ts`

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 193-03-PLAN.md — **the G-5 extraction**: `doorGroup` → `DoorHeaderStrip.tsx`, verbatim, with the D-24(b) ESM-cycle fence (D-05/D-06/D-08)
- [x] 193-04-PLAN.md — D-23 through the generator: the govern door captured, `strip.labelGovern` added to `build.cjs`, the contract regenerated to 21 rows

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 193-05-PLAN.md — all 21 governed strings → `doorVocabulary.ts` at their SHIPPED values, plus the D-24(a) copy fence (D-10/D-11/D-12)
- [x] 193-06-PLAN.md — the card mark `· needs a template` at index 0 of `identityParts`, three-arm silence (D-13/D-14/D-15)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 193-07-PLAN.md — the Run modal: `Template to fill`, the render condition cut AROUND `run-upload-error`, the D-19 sentence untouched (D-17/D-18/D-20)
- [x] 193-08-PLAN.md — **variant D ships** (D-01/D-02/D-23): column D ported, codepoints pinned, four consumer suites re-captured (1 of 2)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 193-09-PLAN.md — the D-04/D-22 restack on both bands, asserted by child order; re-capture 2 of 2

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 193-10-PLAN.md — the pin sweep, the `WorkflowDoorSwitch.tsx` hot-file ledger row G-5 never had (D-07/D-09), and `193-UAT.md`

**Wave 7** *(blocked on Wave 6 completion)*

- [ ] 193-11-PLAN.md — the operator drives the eight G-4 rows; every fail dated, sized and routed

⚠ **Wave parallelism is capped at two, and the reason is measured rather than stylistic.**
`GSD_VITEST_MAX_WORKERS=4` is calibrated for TWO concurrent vitest runs; at three, `192-05` measured
the count gate flipping `failed 6 → 0 → 1 → 3` on a single commit. Waves 5-7 carry one plan each
because `DoorHeaderStrip.tsx` and `doorVocabulary.ts` are the files nearly every later step touches.

#### Phase 193.1: Template-First Authoring

**Goal**: The AI drafts a workflow knowing what the template asks for.
**Depends on**: Phase 193 (the doors are legible and the draft-then-attach half shipped) and quick task `260814-q5r` (`GET /workflows/{id}/template/placeholders` — the producer of the list `/generate` already consumes).
**Requirements**: AUTH-03
**Flags**:

  - ⚠ **AUTH-03 is the RE-OPENED half.** `REQUIREMENTS.md` carries a dated correction note recording that the requirement was written wrong, that Phase 193 built to it literally, and that a coverage tick here must mean *the workflow knows its template at draft time* — not *the user can find where to supply one*. Read that note before scoping.
  - **G-5 FIRES ON TWO FILES, both added to the ledger on 2026-08-14 and both certain to be touched here** — `frontend/src/pages/WorkflowBuilderPage.tsx` and `backend/app/api/workflows.py`. ⚠ **The figures this line originally quoted — 33/10/2055 and 32/16/1813 — were stale when written and are stale again now; re-derived at the phase's close they are `40 commits / 11 phases / 2252 L` and `34 / 17 / 1951`. G-5 ALSO fired on a THIRD file neither this line nor CONTEXT named, `PhaseFormPanel.tsx`, whose ledger row was wrong in both directions (it claimed a phase 140 that never touched the file). All three were HONOURED — the page was extracted BEFORE the feature, the API module took a third door in a template block it already owns, and the panel took one gated line — and NO guardrail override is recorded for this phase**. **`/gsd:discuss-phase 193.1` MUST produce a refactor recommendation as its FIRST option, before the planned feature.** Both ledger cells name their seam already: the page hosts the Builder shell, the canvas mount, the publish gauntlet, the asset-descriptor resolution and the save/concurrency machinery in one component; the API module hosts definition CRUD, validate/lint, the grounding palette, the publish gauntlet, the run launcher and the template door.
  - **G-2 fires** — this adds user-visible copy to the describe door, the surface `SEED-156` says is already indistinguishable from the govern door.
  - ⚠ **The chicken-and-egg is the scope-defining question and must be settled at discuss time, not planned around:** the shipped upload route is `POST /workflows/{definition_id}/template` and **requires a saved workflow**, but at describe time no workflow exists yet. Options include a stateless read-the-bytes-return-the-fields route (persist nothing until save), creating an empty draft up front (collides with 186-07's concurrency token and litters the library), or a third shape. **Recommendation on record: the stateless read** — it keeps the existing "one writer on the definition JSONB" discipline and commits the user to nothing.

**Success Criteria** (what must be TRUE):

  1. A user can supply a template **before** describing, and the resulting draft is built to that template's fields.
  2. The generated draft is verifiably grounded in the template's **actual** placeholder keys — proven on a **real** `/generate` call against a real template, never a stubbed one. (The 101.1 precedent: run `7fa36d2a` failed because a model that had never seen the placeholders invented its own key names.)
  3. A template attached to an **already-drafted** workflow surfaces any mismatch between that draft and the template's fields, rather than binding silently. (Without this, the shipped draft-then-attach path inherits the very defect this phase exists to remove.)
  4. Describing **without** a template is unchanged — the fast door stays fast (Phase 197's D-05 red line applies here too).

**Plans**: 10 plans in 7 waves — planned 2026-08-14. G-5 fired on **three** files (`WorkflowBuilderPage.tsx`, `backend/app/api/workflows.py`, and `PhaseFormPanel.tsx` — the third named only at plan time, its ledger cell wrong in both directions) and **all three were honoured, none waived**: the page's concern is EXTRACTED first (Wave 2, before the feature it makes room for — the 192.1 D-01 order), the API module gains a third door in the template block it already owns, and the name check ships as its own component behind one gated line. **No guardrail override is recorded for this phase.** ⚠ The wire (`template_placeholders`) and the bind (auto-attach on first save) sit in ONE plan and cannot merge apart: the field flips the DELIVERABLE RULE's branch, so an unbound `render_template` draft is terminal at run (`no_template_bound`) and strictly worse than the blind draft it replaces. ⚠ SC#2's real `/generate` call is a Wave-1 checkpoint, not a phase-gate afterthought.

Plans:

- [x] 193.1-01-PLAN.md — Wave 0 characterization baselines on the UNMOVED tree (flag ON/OFF × three `builderPhase` arms) + the `/generate` key-set pin
- [x] 193.1-02-PLAN.md — the stateless read route (`POST /workflows/template/placeholders`), one shared name assembly, no client and no pool
- [x] 193.1-03-PLAN.md — the grounding wire pinned mechanically: the names reach the prompt, the DELIVERABLE RULE's two branches, and `degraded` proved template-free
- [x] 193.1-04-PLAN.md — ⏸ checkpoint: the real `/generate` call with real keys, recorded raw; plus the ruling on two 167-C strings a measurement invalidated
- [x] 193.1-05-PLAN.md — the G-5 cut: `useTemplateFirstDraft.ts`, ESM-cycle fence, copy fence widened 3 → 4, baselines held with ZERO re-capture
- [x] 193.1-06-PLAN.md — the words, the row component and the client; one new governed id (21 → 22); `hint.withTemplate` declined
- [x] 193.1-07-PLAN.md — the wire AND the bind, indivisible; the CTA gate; the throwing-bind case in a suite the gate did not previously run
- [x] 193.1-08-PLAN.md — the mounts on BOTH describe screens, the handoff crossing, and two DECLARED re-captures
- [x] 193.1-09-PLAN.md — the three-bucket name check (re-sourced buckets, degenerate-first copy), its own component, one gated line
- [x] 193.1-11-PLAN.md — ⚠ **AUTHORED MID-PHASE, not at plan time.** `193.1-04` measured the phase's central assumption FALSE: `template_placeholders` alone did NOT flip the DELIVERABLE RULE's branch (0 `render_template` on 3 of 3 real calls). The grounding hedged rather than asserting a template was **provided**. This plan splits the section into two assertive arms — re-measured **3/3, key coverage 3-4/8 → 8/8, control unchanged at 0** (D-26)
- [x] 193.1-10-PLAN.md — ⏸ close-out: three corrected hot-file ledger rows, the four UAT rows driven, every gate re-run at HEAD

#### Phase 193.2: From Authored to Runnable

**Goal**: A person who describes a workflow can publish it and find it again, without being asked
for something they already said or blocked by a step they did not choose.

**Depends on**: Phase 193.1 (template-first authoring ships; all three findings below were observed
on its end-to-end UAT run).
**Requirements**: none new — this phase repairs the path to `AUTH-03`, which is already satisfied.

**Flags**:

  - ⚠ **All three items were found in ONE sitting by the operator**, on the phase's own headline
    path, immediately after `AUTH-03` was proven working. **The capability is delivered and the
    path around it is not.**

  - ⚠ **`BUG-260815-01` is a consequence of Phase 193.1's OWN `D-26` fix.** Once the model is told
    it must fill named template fields, it adds an `llm_human_input` step to ask the human for what
    it cannot find — and the synchronous publish gate categorically refuses that phase type.
    Measured **2 for 2** whenever a template step appears. **Neither side is wrong in isolation**:
    the gate is deliberate and its own docblock names the deferred Phase-103 background-job publish
    as the real fix. **Do NOT fix this by removing the gate** — an unsubscribed `ask_user` can wedge
    a publish indefinitely.

  - ⚠ **G-2 fires on the library half, and it must not absorb the sort bug.** The operator also
    raised card density (*"a lot of information, a lot of text… maybe instead of cards a list"*).
    That is a **design question** needing `/gsd:sketch` first, and `SEED-155` binds: a sketch that
    hand-writes its own CSS is a drawing, not an acceptance bar, and one depicting a shipped
    component must RENDER it. **Sorting is a defect and ships regardless of any layout decision.**

  - ⚠ **G-5 will fire on `backend/app/api/workflows.py` (17 phases at 193.1's close) and probably on
    the library modules.** The recency sort touches **three** `ORDER BY name` call sites
    (`backend/app/db/workflows.py:316`, `:352`, `:553`) — change them together or the feeds
    disagree.

  - **G-1 does NOT fire** — this is the second `193.x`, and the rule needs ≥ 2 priors. Worth noting
    that a third would trip it.

**Success Criteria** (what must be TRUE):

  1. A person who describes a workflow is **not asked to restate the same intent** before publishing — the business requirement arrives proposed and editable, never blank and never silently derived (`SEED-163`).
  2. A draft produced by the template-first path **publishes without hand-editing the canvas**; if a step genuinely cannot be validated, the refusal **names that step by its visible label and offers an action**, rather than naming internal phase-type identifiers (`BUG-260815-01`).
  3. **A just-published workflow is findable without knowing its name** — the author is taken to it, or it is at the top of the list, or both (`BUG-260815-02`).
  4. Nothing here regresses `AUTH-03`: the template-first run still fills the bound template end-to-end, provable by re-running the Phase 193.1 UAT kit (`C:\Users\fhdmr\Desktop\uat-193.1-qbr\`, scoring rule: 8+ planted facts).

**Plans**: **10 of 10 EXECUTED and the phase ✅ CLOSED, 2026-08-15** (planned the same day; 10 plans
in 6 waves). **All four success criteria were DRIVEN by the operator**, and ⏸ **two UAT rows were
NOT driven — by decision, and named** (`193.2-UAT.md` U5 and U2). *(Superseded, kept for the record:
this block read "deliberately NOT marked complete … all five UAT rows are OWED" before the D-21 run.)*

**Success-criteria status at close, stated per criterion rather than averaged:**

| SC | What must be TRUE | Code evidence | Verified by a person? |
|---|---|---|---|
| **SC#1** | the author is not asked to restate the same intent; the requirement arrives proposed, editable, never blank and never silently derived | prompt asks for it; **20/20** non-empty over 20 real paid generations against a pre-fix **0/N**; server-side provenance stamp; the visible `AI-proposed` mark demoting on any edit | ✅ **YES — U1 moment 1.** The requirement arrived durable and **NOT an echo of describe**, `seeded_by_ai: true`, so the anti-echo predicate **earned** the mark. ⚠ **One caveat: the operator confirmed broadly and did NOT specifically confirm the VISIBLE mark** — the durable half is measured, the visible half is not |
| **SC#2** | the draft publishes without hand-editing the canvas; a genuine refusal names the step by its **visible label** and offers an action | `llm_human_input` **0/20** against a pre-fix **2/2-with-a-template** / 4/6 overall; the refusal rewritten in two arms that share no sentence, naming the canvas label, with the model-authored label clamped and single-lined | ✅ **YES on the first half — U1 moment 2: published with the canvas UNTOUCHED.** ⚠ **The second half was NOT observed and could not be: no interactive step appeared, so the refusal never rendered (U2 NOT DRIVEN). The rewritten copy has still never been read by a person.** ⚠ **A MEASURED REDUCTION, NEVER AN ABSENCE (D-08) — the publish gate stays** |
| **SC#3** | a just-published workflow is findable without knowing its name | the two author feeds now `ORDER BY updated_at DESC` (starters stay alphabetical, D-16); rendered position **17 of 109 → 4 of 109**, pinned as arithmetic; the post-publish Run CTA's **first automated coverage ever** | ✅ **YES — U1 moment 3 + U4.** Found **without searching**, **position 4 of 112**, the predicted index `starters.length` **held exactly**; the Run CTA appeared and **named** the workflow. Recency proved against a near-identical OLDER row (14:17 above 02:07), not by alphabetical luck. ⚠ **The pass is the operator's JUDGEMENT — position 4 is not position 1, and had they said it was too far down the row would have failed** |
| **SC#4** | nothing regresses `AUTH-03` — the template-first run still fills the bound template end to end | the `render_template` **control did not fall**: 5/5 per arm on a **like-for-like** re-drive against 193.1's 3/3 | ✅ **YES — U1 moments 4-5, and this is the row no test could stand in for.** Run **`b021c7b0` COMPLETED**: 39,698 B vs a 37,424 B template, **10 of 10 fields filled**, 0 residual `{{ }}`, 0 literal `None`, branding verified against a **screenshot**, and **all eight planted facts grounded**. ⚠ **`AUTH-03` IS THEREFORE SATISFIED END TO END** — the control counted a `render_template` phase in a draft; **this is the document coming back FILLED** |

⚠ **The 193.1 attribution regression did NOT recur — Marcus Feld is named twice in the rendered
document.** A second data point in the right direction, so that deferral's *"a second sighting earns
a seed"* trigger is **not** fired and no seed is owed.

⚠ **Three publish attempts were blocked before the successful one and NONE was a product defect on
the publish path** — an **exhausted OpenAI credit balance** starved retrieval (every search must
embed its query), `citations_required` failed 3× per run and publish **correctly refused**; all three
audit rows read `blocked_stage: structural_gate`. **The gauntlet behaved exactly as designed.** Four
bugs and three seeds were filed from that session (`BUG-260815-05`…`08`, `SEED-159` — **whose trigger
FIRED and whose prediction was WRONG** — `SEED-165`, `SEED-166`).

**Gates re-run at HEAD by `193.2-10`, against `193.2-BASELINE.md`:** backend `tests/unit` **62 failed
/ 2154 passed** (failures **identical** to the pre-change baseline; the 62 is the recorded SEED-056
rot set) · the six backend workflow suites **110 / 0** (was 81 / 0) · the five frontend workflow
suites **359 / 0** (was 337 / 0) · count gate **`count gate OK` · total 3918 · failed 0 · pinned 3868
· 75/75** (was 3892) · `tsc -p tsconfig.app.json` **33, unmoved across all ten plans**. **No NEW
failure appeared.**

⚠ **NO GUARDRAIL OVERRIDE IS RECORDED FOR PHASE 193.2, AND THAT ABSENCE IS A MEASUREMENT.** G-5 fired
on **seven** files and every one was honoured **by construction**; a formal override was offered at
discuss time and declined — the **third consecutive phase** (193, 193.1, 193.2) to decline one.
**G-1 does not fire** (second `193.x`) — ⚠ **a third `193.x` would trip it.** **G-2 did not fire** on
anything in scope: the library work is an `ORDER BY`, not a render.

⚠ **The ROADMAP's own flag predicting "G-5 will fire on `backend/app/api/workflows.py`" was measured
FALSE — that file was not touched at all**, because D-12 makes one string feed both the publish
refusal and the canvas warning.

Plans:

- [x] 193.2-01-PLAN.md — wave 1: baselines measured on the UNMOVED tree; F-2 and F-7 driven RED against real plants and restored; D-01's declined override and D-04's scope fence recorded
- [x] 193.2-02-PLAN.md — wave 2: D-10 and D-19 confirmed at HEAD and recorded as artifacts (the gate DID fire; the publish endpoint never refused), plus the post-publish Run CTA's first automated pin ever
- [x] 193.2-03-PLAN.md — wave 3: `db/workflows.py` published + drafts to `ORDER BY updated_at DESC`, starters stay alphabetical, the D-16 divergence written into the code at all three sites, and the 192.1 scope fence REWRITTEN in place as F-1 after being observed RED
- [x] 193.2-04-PLAN.md — wave 3: the rendered-position arithmetic for SC#3 (newest published lands at index `starters.length` — position 4, not 1, and the residual is stated), and F-7 extended to `libraryFilter.ts` + `WorkflowsPage.tsx`
- [x] 193.2-05-PLAN.md — wave 3: the DELIVERABLE RULE learns what publish refuses, the 121-char `llm_human_input` nudge is shortened, the prompt asks for the DURABLE requirement, and F-8 makes the bullet-length rule mechanical for the first time
- [x] 193.2-06-PLAN.md — wave 3: the publish refusal rewritten in two arms that share no sentence, naming the step by its visible label with an honest empty-name degradation and a clamped label; F-3, F-4 and F-5 driven RED
- [x] 193.2-07-PLAN.md — wave 4: the additive-optional provenance field on `WorkflowDefinition` (zero migration) and the server-side stamp that refuses empty and refuses a copy of `describe`; F-6 with its adversarial half
- [x] 193.2-08-PLAN.md — wave 5 ⏸ checkpoint: the k/N frequency harness (2 driven rows, 6 recorded N/A) and the measured scoreboard stating the reduction-not-absence rule verbatim. SERIAL — real paid calls
- [x] 193.2-09-PLAN.md — wave 5: the visible AI-proposal mark inside the existing affordance under the same `canvasEnabled` gate, demoting on any edit — with `FLAG_OFF_HEADER_MARKUP` byte-unmoved
- [x] 193.2-10-PLAN.md — wave 6 ⏸ close-out: FOUR hot-file ledger rows (three files G-5 could never see), the stale cells corrected beside, STATE/ROADMAP/bug frontmatter, every gate re-run at HEAD, and D-21's single operator-driven end-to-end run

**Plan outcomes, one line each — the things a later reader should not re-derive:**

| Plan | Outcome |
|---|---|
| `01` | Baselines on the UNMOVED tree in commits touching **zero** source files; F-2 and F-7 driven RED against real plants and restored. ⚠ Found **FOUR** ledger rows owed, not three, and that **the frontend full-tree figure is NOT a baseline** — 49 then 46 failures on one identical commit |
| `02` | ⚠ **D-10's escape hatch NOT TRIGGERED — the gate FIRED and the 400 never happened.** Both facts CONTEXT put on trial are TRUE; the false premise was the unstated third, *that a 400 was received at all* (0 `publish_blocked` that day, 1 attempted + 1 succeeded 7.57 ms apart). Plus the post-publish Run CTA's **first automated coverage ever**, presence and absence driven RED independently. ⚠ `harness_audit.metadata` is a **DOUBLE-ENCODED jsonb string** — `->>'key'` is NULL on all 32 rows by definition |
| `03` | Two `ORDER BY` clauses — **the complete non-comment diff is two lines**; 109 of the +111 are recorded-decision comments. The shipped green fence that FORBADE the change was **rewritten in place, never deleted**, driven RED clause-by-clause. ⚠ One third of the replacement was **inert**: a bare `D-16` needle was already green on the drafts feed from a 192.1 comment about a different decision |
| `04` | The rendered position pinned as **arithmetic over pure functions**, not a DOM: index `SC3_STARTERS.length` as an EXPRESSION, never a literal. F-7 extended to the two modules that had **no sort coverage anywhere in the repository**, with a real plant per ARM. ⚠ The rejected merge re-order was measured to **invert the dedupe precedence** — a stated cost became a measured one |
| `05` | The DELIVERABLE RULE gained ONE clause (a pure APPEND — `new[:len(old)] == old`); the `llm_human_input` bullet cut **121 → 74**, its *active tail* being what made it a nudge. **F-8 is the first mechanical guard on a prompt-literal length this repository has ever had**, driven RED against a real 200-char plant. `grounding.py` deliberately untouched, so the two fixes stay independently attributable |
| `06` | The refusal rewritten in **two arms that share no complete sentence**; the label clamped and single-lined before it reaches copy, an aria label and a persisted audit row. ⚠ **The `external_action` hole is real and CANNOT wedge a publish** (auto-continued at `harness_engine.py:837`, send skipped at `phase_types.py` GATE 1) — **and widening the gate is FORBIDDEN by a shipped fence** (CONFLICT-1 Option B, REJECTED). ⚠ A fence asserting only `a != b` **passed** a real plant; the shared-sentence clause is what fired |
| `07` | An additive-optional `bool` on a JSONB column — **zero migration**, `extra="forbid"` proved not relaxed, **0 deletions**. The stamp refuses empty AND refuses a normalised copy of `describe`, and ignores the model's claim **in both directions**. ⚠ One plant failed **exactly one case out of thirty-three** — the only evidence the second adversarial direction is not redundant |
| `08` | **20 real paid generations. ⚠ THE PLAN'S CENTRAL PREMISE WAS FALSE AND THE CHECKPOINT CAUGHT IT** — 193.1's 3/3 was driven on the 8-key set, not the kit's 10-field `.docx`, so the operator authorized a **second like-for-like arm**. The counters were **planted before their zeroes were published**. ⚠ `193.1-11`'s *"`inputs[]` is fed by nothing"* is **true of anthropic and false as a general claim** (gpt-5.5: 7/10) — a PROVIDER difference. ⚠ Attribution between the clause and the bullet is **UNRESOLVED and UNDRIVEN** |
| `09` | One gated sibling inside the shipped affordance; the flag cleared in the **same `set()`** that writes the text; **no glyph — the word carries it**. ⚠ **THE PLAN'S OWN CLAIM WAS MEASURED FALSE:** the nine-phase-old byte pin it was told would catch a misplacement **stayed GREEN under the exact plant it was credited with catching** — its fixture cannot express the condition. ⚠ A plant *easier* to catch than the real regression proves less than it looks like (duplicate reds 7 cases; the realistic move, 2) |
| `10` | FIVE ledger rows, not four — `builderStore.ts` was in **no prior artifact of this phase**. Two disputed phase counts resolved by measurement (quick-task buckets counted OUT). Every gate re-run at HEAD with **no NEW failure**. STATE.md **hand-edited**; no `gsd-sdk state.*` verb was called. ⏸ D-21's operator run OWED |

⚠ **FIVE inert-fence findings across this phase, and EVERY ONE was caught by PLANTING, none by
reading** (plans 03, 06, 07, 08, 09). **A fence is only real once you have watched it fail.**

#### Phase 194: Stop a Running Workflow

**Goal**: A run can be stopped at any point and says so honestly.
**Depends on**: Nothing structural — mostly UI over an endpoint that already exists.
**Requirements**: RUN-01
**Flags**: Reuses the owned cancel endpoint + `run_lifecycle` internals — **this is not a new runtime path**. Hard prerequisite for the deferred scheduled/recurring-runs work (Phase 105 carry-forward).
**Success Criteria** (what must be TRUE):

  1. A user can stop a run mid-execution from the run surface.
  2. The stopped run reports `cancelled` honestly — not failed, not silently complete.
  3. Stopping is safe mid-phase: no partial write is presented as finished.

**Plans**: 13 plans in 8 waves

Plans:
**Wave 1**

- [ ] 194-01-PLAN.md — Wave 0: re-derive the four baselines + the six G-5 figures, MEASURE the duplicate-icon root cause, author the 8-row UAT scoreboard

**Wave 2** *(blocked on Wave 1 completion)*

- [ ] 194-02-PLAN.md — Migration 119 (`workflow_phases_status_check` 6 → 7) + its live-DB gate; authored, applied nowhere
- [ ] 194-03-PLAN.md — The panel Stop mount (V-04) + the F-1 union-scoped `workflowLock.runId` fence (V-05)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 194-04-PLAN.md — The `cancelled` phase-status vocabulary widening: types, the ONE derivation, the panel word + announcer, the canvas readings (V-18/V-19 client halves)
- [ ] 194-05-PLAN.md — The two `CLAUDE.md` hot-file ledger rows (D-02) + the correct-beside corrections + reported-bug coverage check

**Wave 4** *(blocked on Wave 3 completion)*

- [ ] 194-06-PLAN.md — The two phase-terminalize writers in `db/workflows.py` + `finish_run`'s docstring corrected beside
- [ ] 194-07-PLAN.md — The chat banner ADVANCE (D-18, V-07, F-9) with the byte pin unmoved + `RunCard`'s D-14 decision

**Wave 5** *(blocked on Wave 4 completion)*

- [ ] 194-08-PLAN.md — Composer Stop pinned (V-06), the pre-stamp silent no-op made observable, the tray pinned (V-08)
- [ ] 194-09-PLAN.md — Step 3b's `workflow_runs` co-write + the exported composition (V-09/10/11/12/13/17/18/19; F-2/3/4/5/6/11/12)

**Wave 6** *(blocked on Wave 5 completion)*

- [ ] 194-10-PLAN.md — The engine cancel arm's in-flight phase terminalize (V-16), 096-09's gate unmoved
- [ ] 194-11-PLAN.md — `DELETE /runs/{id}` dual-id fallback + FORWARD resolution (V-01/02/03; F-10, two plants)

**Wave 7** *(blocked on Wave 6 completion)*

- [ ] 194-12-PLAN.md — SERIALIZED: operator applies migration 119, V-14/V-15 proved on the live DB, F-7/F-8 driven RED, `full-schema.sql` regenerated

**Wave 8** *(blocked on Wave 7 completion)*

- [ ] 194-13-PLAN.md — SERIALIZED: the four-row data heal with a committed receipt (V-20) + every touched hot file's ledger cell re-derived

#### Phase 194.1: Make the Stop Visible (INSERTED)

**Goal**: Pressing Stop is legible — the press is acknowledged on screen, the surface showing the run can stop it, and a stopped thread still says so after navigating away and back.
**Depends on**: Phase 194 — this adds **no new runtime path**. 194 landed and verified the durable half on seven live runs (`workflow_runs` + the interrupted `workflow_phases` row + the thread anchor + the producer `runs` row).
**Requirements**: RUN-01 (the re-opened, user-facing half)
**Flags**: ⚠ **INSERTED 2026-08-16.** Phase 194's own UAT found that a person cannot perceive any of the state it correctly writes. **Same shape as 192 → 192.1 and 193 → 193.1**: the parent phase shipped, a real gap was found in lived experience, and the gap gets its own phase rather than a closure round (**G-7**). **G-2 fires (visual)** — a pressed/stopping state, a new canvas control and a durable thread mark are all screen judgement; **sketch before spec/discuss**. **G-5 will fire** on `frontend/src/components/chat/MessageInput.tsx`, `RunCard.tsx` (inherits `21 / 9 / 608`) and `WorkspacePanel.tsx` (inherits `14 / 9 / 580`) — the last two have ledger rows; audit at discuss-phase and expect a refactor recommendation to be owed FIRST. **Reported bugs CLAIMED (not yet folded)**: `BUG-260816-01`, `BUG-260816-02`, plus the two re-opened `BUG-260709-01` and `BUG-260610-01`. ⚠ **All four still carry `status: open` in their frontmatter, deliberately** — the fold is `/gsd:discuss-phase`'s touchpoint, and `status:` **is** the index a routing scan reads, so prose claiming a fold that the frontmatter does not record is worse than no claim at all. Flip them to `folded` / `folded_into: 194.1` at discuss-phase, once the scope that survives is known.
**Success Criteria** (what must be TRUE — refined at sketch/discuss):

  1. Pressing Stop is acknowledged at the moment of the press — the control shows a stopping state instead of looking inert.
  2. The workflow run surface can stop the run it is showing. Measured 2026-08-16: `frontend/src/pages/WorkflowRunPage.tsx` matches `onStop|stopThread|cancelRun|Stop` **zero** times — there is no Stop control there at all.
  3. Navigating back into a stopped workflow's thread shows that the run was **stopped by the user** — today it shows the original prompt alone, indistinguishable from a run that never started or one that finished.

**Plans**: 8 plans in 6 waves — **all 8 EXECUTED (2026-08-16)**, ⛔ **the three operator-driven G-4 rows are OWED and UNDRIVEN**

Plans:

- [x] 194.1-01-PLAN.md — Wave-0 baselines on the UNMOVED tree: the four Stop mounts, both resolvers, the kickoff placeholder, the transcript's silence, the approval's dispatchability + `194.1-BASELINE.md`
- [x] 194.1-02-PLAN.md — Backend: widen the shipped, UNGATED `ThreadWorkflowState` with `last_run_status` / `last_run_created_at` / `last_run_updated_at` (**D-09 AMENDED** — no new route, no `CANVAS_GATED_PATHS` edit, no migration, no extra round trip)
- [x] 194.1-03-PLAN.md — The whole provider/store change set: the stopping + not-confirmed + kickoff slices, the 8s provider-owned timer, the ONE slice-transition clear, R6 on BOTH resolvers, both false strings deleted, R5's kickoff gate **and** its 403 / network-failure repairs
- [x] 194.1-04-PLAN.md — `<StopControl>`, the one shared pressed-state mechanism (the control LEAVES its slot), + the composer mount routed at `stopThread`
- [x] 194.1-05-PLAN.md — SERIALIZED vs 07: the panel Stop gated on `isHarness` with `showTimeline` byte-unchanged (**D-25**), the tray mount, the retired-not-removed approval, `WorkspacePanel.test.tsx` pin
- [x] 194.1-06-PLAN.md — The converged run line (170-B + 171-C are ONE component in two states) + the seven-literal step count + the hoisted elapsed formatter + its `MessageList` mount
- [x] 194.1-07-PLAN.md — SERIALIZED vs 05: R3, the run surface's title-row Stop (sketch 169-A, direct flip), five status cases, two source fences, `WorkflowRunPage.test.tsx` pin
- [x] 194.1-08-PLAN.md — Close-out: the `CLAUDE.md` G-5 ledger rows (**D-04**), the filled Per-Task Verification Map, the deferral register, the ROADMAP, and the three operator-driven **G-4** rows (blocking checkpoint)

⚠ **CORRECTION ON MEASUREMENT AGAINST THIS BLOCK'S OWN `Flags` LINE, recorded beside the original rather than over it.** The flag predicted *"G-5 will fire on `MessageInput.tsx`, `RunCard.tsx` and `WorkspacePanel.tsx`"* — **three** files. **Measured, G-5 fires on SEVEN, and five of them were INVISIBLE to the audit:** `StreamsProvider.tsx` (**34 phases** — its row read *"5+ phases · satisfied (075.7)"*, **stale by 28 phases**, and a row that is present and WRONG answers the auditor `satisfied` and **stops the audit**), `ChatArea.tsx` (**29 phases**, absent from `CLAUDE.md` entirely and **missing from CONTEXT D-01's own G-5 audit too**), `MessageInput.tsx` (13, absent), `MessageList.tsx` (8, absent), `PendingAskCard.tsx` (5, absent), `WorkspacePanel.tsx` (10, present) and `WorkflowRunPage.tsx` (3 — ⚠ **D-04 instructed the row be written on a count of 2 where G-5 does NOT fire; this phase's own two commits made that stale before it could be written**). **All were fixed in `CLAUDE.md` at plan 08 — three rows added as scoped, two more added as a stated deviation, one corrected BESIDE its old value, two updated in place.** **G-5 was honoured BY CONSTRUCTION on every one — the FIFTH consecutive phase (193, 193.1, 193.2, 194, 194.1) — with an override OFFERED AND DECLINED, so `.planning/STATE.md`'s `Phase 194.1 — NONE` is a MEASUREMENT and not an omission.**

⚠ **RUN-01 STAYS UNTICKED when this phase closes.** It reads *"a user can stop a running workflow at any point, **and the run reports honestly that it was stopped**"* — 194.1 delivers the first clause and makes the second clause's failure VISIBLE. At the shipped `WORKER_COUNT=2` roughly **half of all stops still end with the run reporting `completed`** (194 SC#2, FAILED; `RUN_TASKS` is per-process and `finish_run` carries no terminal guard, `db/workflows.py:1458-1463`). The honest UI makes that lie **more** visible, not less, and a fence exists in plan 03 to red against any well-meaning suppression of the terminal reading. The tick waits for the inserted L-01 phase. ⚠ **CONFIRMED AT CLOSE (2026-08-16, plan `194.1-08`): the untick HELD, and it is a measurement rather than an assertion — `git diff --numstat a9e7d10c HEAD -- .planning/REQUIREMENTS.md` is EMPTY, no plan invoked `requirements.mark-complete`, and plans 03, 04, 05 and 06 each separately recorded *"RUN-01 is NOT claimed ticked"* in their SUMMARYs.** Plan 03's fence is **P4**, and it was driven RED in exactly the suppression direction — ⚠ its SOURCE arm had to be widened from one line to an eight-line window first, because the one-line form stayed GREEN under the very plant it was written for. **The tick is the operator's decision, and this phase explicitly declines to make it.**

#### Phase 195: Show the Deliverable

**Goal**: A workflow that produces a file shows it, reusing the shipped file presentation.
**Depends on**: Nothing structural — but see the measurement fence below; backend-vs-frontend scope is unknown until it is answered.
**Requirements**: RUN-02, RUN-03
**Flags**: ⚠ **First task is measurement** — establish whether a workflow run emits output files onto the wire at all (SEED-148 records this as explicitly unmeasured). RUN-03 exists specifically to forbid rebuilding output-file UI.
**Success Criteria** (what must be TRUE):

  1. A completed workflow that produced a file shows that file from the run surface.
  2. The presentation reuses `OutputFileCard` / `FilesSection` / `fileIcon` — no second file UI.
  3. Multiple produced files are handled with the ONE uniform quiet row — no hero, no second pattern — ordered newest-first client-side. ⚠ **CORRECTED 2026-08-17 by plan `195-08`; the original wording is quoted verbatim in the note below, never overwritten.**

⚠ **SC#3 NAMED A RETIRED PATTERN AND IS CORRECTED BY THIS PHASE — the original is preserved BESIDE the correction rather than overwritten** (`195-CONTEXT.md` D-10 / D-11; `195-RESEARCH.md` confirmed it at `:589`).

> **THE ORIGINAL SC#3, VERBATIM:** *"Multiple produced files are handled with the shipped hero/working split, not a new pattern."*

**Why it could not be satisfied:** Phase **095.1 (D-095.1-06) REVERSED** the hero/working split by an operator-approved decision. `OutputFileCard`'s `variant` prop is *"INERT … no longer changes the rendered shape — every row renders the one quiet uniform style"* (`OutputFileCard.tsx:59-66`) and `is_hero` is *written-but-unread* (`:54-57`) — the backend still WRITES it and nothing reads it. A criterion instructing the split therefore instructed code that no longer exists, and **a record that is present and WRONG answers the auditor and STOPS the audit**.

**What the criterion now names, and it is what ships:** ONE uniform quiet row for every file — no hero, no grouping, no `kind` distinction — **ordered newest-first client-side** (D-12, `fileRowUtils.byNewestFirst`, pinned in BOTH `created_at` regimes by plan `195-06`). The decision is `195-CONTEXT.md` **D-10**.

**The scale fact that makes it right, measured rather than argued:** **60 of 61 file-bearing runs have exactly ONE file** (the 61st is a chat thread carrying 19 `execute_code` PNGs, per D-01). Reviving a hero signal would build a pattern for a population of one — and would require inventing a hero flag on the workspace-file path, which has none.

⚠ **The criterion was corrected BY the phase it belongs to, which is why the phase can satisfy it.** Correcting a stale criterion is not the same as moving a goalpost: the original named a pattern that had been retired by an operator-approved decision **four milestones before this phase was scoped**, and the correction names what shipped rather than what the phase found convenient.

⚠ The stale twin of this criterion lives in `.claude/skills/sketch-findings-agentic-rag/references/chat-tool-card-unification.md` at **nine sites** (not the four CONTEXT names) and is corrected in the same phase — left alone, the next UI phase builds a hero block from the design record. Plan `195-08` owns both corrections. *(The paragraph above this line was the planner's, written at `/gsd:plan-phase 195`; plan `195-08` rewrote the criterion itself and quoted the original, because a note under an uncorrected criterion still leaves the criterion instructing retired code.)*

**Plans**: 8 plans in 4 waves

Plans:
**Wave 1**

- [x] 195-01-PLAN.md — Wave 0/1: the LIVE SC#1 baseline in a commit that PREDATES every source change (D-16), the named `BASE_SHA`, and the wave-1 browser + `.docx`-reader probe (**blocking checkpoint** — the orchestrator drives it)
- [x] 195-02-PLAN.md — Wave 0/1: the characterization fences on the UNMOVED tree — `supersedes` in BOTH branches and the inert `data-variant` (**zero coverage repo-wide**, F5), the dead-link pair as two cases (P2), the run page's SILENT dead row (F8), and the count-gate adoption of FIVE suites

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 195-03-PLAN.md — Wave 2: the shared module — `components/files/` (`FileRow` via Radix `asChild`/`Slottable`, `fileRowUtils`), the widened ONE icon path (`ribbon`/`tone`/`className`/`mimeType` + the nine missing extensions + the own-property guard), and the two-regime `byNewestFirst` whose missing-key arm is NEW GROUND (F7)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 195-04-PLAN.md — Wave 3: chat converts — `OutputFileCard` on the shared row with its public prop shape BYTE-IDENTICAL, so `MessageItem.tsx` (29 phases) and `ExecuteCodeBody.tsx` are never opened (F6/D-14 honoured structurally)
- [x] 195-05-PLAN.md — Wave 3: the panel converts — the copied `formatBytes` **and its own “keep byte-for-byte identical” confession** deleted, the mime-first `iconFor` deleted, listbox + roving focus + preview activation + Template badge unmoved
- [x] 195-06-PLAN.md — Wave 3: the run surface converts — the region on the shared row, D-02's honest heading (**three locations**), D-15's three-way empty state pinned, D-12 wired, and the TWO shipped fences that assert the duplication INVERTED IN PLACE with the originals quoted (F1; the suite is pinned EXACT)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 195-07-PLAN.md — Wave 4: SC#2 proved — the four-file source sweep with length+identity guards and the adopted 27th plant (the stripper non-vacuity case), the chat-capability arm, and every pin this phase moved reconciled to the gate's own printed `actual`
- [x] 195-08-PLAN.md — Wave 4: the records — D-11's two stale documents (ROADMAP SC#3 + nine sites in the design record), D-17's hot-file ledger under the SAME-COMMIT SYNC RULE (two files ABSENT today), two seeds for the measured lies the phase declines, and **D-20 driven** — launch, watch, download, OPEN the file (**blocking checkpoint**)

#### Phase 196: Registry-Backed Model Picker (canvas)

**Goal**: A step's model is chosen from the live registry, never typed.
**Depends on**: Nothing structural — the canvas surface it edits shipped in v3.6.
**Requirements**: AUTH-04
**Flags**: **Scope fence, deliberate** — the app-wide model single-source sweep (SEED-040 / SEED-088) is explicitly OUT; the canvas/workflow surface only.
**Success Criteria** (what must be TRUE):

  1. A step's model is chosen from a list sourced from the live registry.
  2. An unregistered model cannot be silently selected — the pick-time honesty SEED-135 asks for.
  3. The app-wide sweep is NOT attempted; the canvas surface only.

**Plans**: 9 plans — **ALL 9 EXECUTED and the phase ✅ CLOSED, 2026-08-18.** Executed in **5 waves**, not the 6 planned: `196-07` depends only on `196-04`, so it ran in wave 3 rather than 4 and the tail shifted up one. ⚠ Wave 3 was **SPLIT rather than serialised** — `196-05` and `196-07` both edit `scripts/vitest-count-gate.cjs`, so `196-05`+`196-06` ran parallel and `196-07` forked from a base already containing `196-05`'s edit, removing the conflict instead of avoiding it. **Verification: 3/3 success criteria VERIFIED** independently against the shipped tree (including SC#3's negative fence proven able to FIRE, not swept against an empty set). Gates at close: count gate **89/89 pinned · total 4291 · failed 0**, `tsc -p tsconfig.app.json` unmoved at **33** (0 in any phase file), backend **211 failed / 4046 passed** — ⚠ **the failure floor held at exactly 211 across all five waves** while passing rose 3964 → 4046. Migration `120` applied to the live local DB and **measured idempotent** (a re-run adds no second constraint — no shipped precedent existed for `ADD COLUMN IF NOT EXISTS … CHECK`). `full-schema.sql` regenerated. G-4 rows driven: **U-A2 PASS** (`kimi-k2.6` groups under *Best-effort only — may not fill a document*; `gemini-3.6-flash`, the id SEED-135 measured silently degrading a run, is now visibly labelled BEFORE selection), **U-B1 PARTIAL** (judge value confirmed live; a real publish stays operator-gated), **U-C1 FAILED for a cause outside this phase** → `BUG-260718-04` CLOSED by split, refresh half re-homed as `SEED-178`. ⚠ **The canvas-only fence above is deliberately WIDENED by an operator decision recorded as `196-CONTEXT.md` `<domain>`**: two open reported bugs living on other surfaces were folded in, because a typed model box that nothing validates, a judge knob the judge never reads, and a composer picker that silently reverts are the same defect wearing three faces. The SEED-040 / SEED-088 app-wide sweep stays OUT (SC#3).

Plans:
**Wave 1**

- [x] 196-01-PLAN.md — Wave 1: `emit_tier` end-to-end (D-13 / D-14) — ⚠ **a migration `120_` is required and was NOT anticipated: `model_capabilities_overrides` has no `emit_tier` column**. Overlay copy, PATCH allowlist + enum guard, the operator-ratified SEED-172 numeric bounds, the client row type and the registry tab's first enum control. **`autonomous: false` — a `[BLOCKING]` operator SQL-editor paste**
- [x] 196-02-PLAN.md — Wave 1: the judge knob (D-17, `BUG-260731-01`, `severity: critical`) — four consumers routed off the env singleton onto DB-backed settings, behind the report's **BINDING** RED-first test ×4 plus a negative control. ⚠ Changes which model grades every publish on the operator's own box
- [x] 196-03-PLAN.md — Wave 1: the harness enabled-check (D-10) — the disabled-model fallback the chat path has had since Phase 149 and the harness has never had, with a visible sub-step and a `policy_applied` receipt, and the A1 import-cycle guard driven first

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 196-04-PLAN.md — Wave 2: the union leaf + the non-operator route (D-01 / D-02 / D-03) — `_registry_row` extracted to a service leaf, `GET /models/registry` added beside `/features`, a six-field allowlist projection, and an honestly-computed `run_default_model`. ⚠ `GET /admin/models` stays a byte-identical 404, proven by contrast in the same file

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 196-05-PLAN.md — Wave 3: the picker leaf (D-04–D-08, D-12, D-15) — `modelFitness.ts`, `ModelField.tsx` (no state, no effect, fenced on its own source) and `useModelRegistry.ts`
- [x] 196-06-PLAN.md — Wave 3: the server refusal (D-09, SC#2) — 400 before any write on both draft doors, fired after ownership resolution, with D-08's grandfather so retiring a registry row never bricks an existing workflow

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 196-07-PLAN.md — Wave 4: the composer restore (D-18, `BUG-260718-04`) — derived from the thread's last run-backed message, provider restored first; G-5 honoured by REDUCTION via `useComposerModel` (`useState` 7→2, `useEffect` 4→3)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 196-08-PLAN.md — Wave 5: the mounts (D-20) — four free-text `AI model` inputs become four one-line gated `ModelField` mounts, plus the NEW source fence the 193.1 fence structurally cannot cover

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 196-09-PLAN.md — Wave 6: the records (D-16, D-19, D-21, D-22, D-23) — ledger rows and detail sections re-derived in one batch pass, the two folded bugs flipped only on named evidence, three seeds with mechanical re-open triggers, and the SC#3 negative fence proven over the real diff

#### Phase 197: Guided Authoring

**Goal**: Drafting from a description guides the decisions that matter.
**Depends on**: Phase 193 (the doors must be legible before the fast door is deepened).
**Requirements**: AUTH-02
**Flags**: **G-2 fires.** D-05 red line — the fast door must stay fast; guidance must not turn "Describe & run" into the strict door.
**Success Criteria** (what must be TRUE):

  1. A user drafting from a description is asked the decisions that change the result, rather than receiving a finished draft in one shot.
  2. The fast door stays fast — guidance must not turn "Describe & run" into the strict door (D-05).
  3. A user can still get a one-shot draft if they want one.

**Plans**: 11 plans in 7 waves

**Wave 1**

- [x] 197-01-PLAN.md — Wave 1: the D-05 red line as a MECHANICAL criterion, before any source edit — the shipped pre-draft baseline (it predates by four phases) run green at the base SHA, the four gate baselines re-derived, and the four numstat deletion criteria declared with their two exclusions

**Wave 2** *(five plans in parallel — zero `files_modified` overlap, no plan mutates the DB)*

- [x] 197-02-PLAN.md — Wave 2: the backend — D-13's ONE server-derived readiness verdict on `/generate`'s single success return (imported from `grounding.py`, never re-declared; the four failure arms carry none), plus D-14's two-half fence whose positive control is a REAL live fourth D-22 instance
- [x] 197-03-PLAN.md — Wave 2: `decisionsVocabulary.ts` — D-09/D-10's one copy home as a true zero-import leaf, with D-07's five-row order exported as DATA and a D-20 fence proving no row falsely claims a publish requirement
- [x] 197-04-PLAN.md — Wave 2: `terminalEmitSlug` beside `soulDeliverable` — WHICH step produces the deliverable, deterministic tie-break, without re-answering the question `soulDeliverable` already owns (D-18)
- [x] 197-05-PLAN.md — Wave 2: `setName` — the phase's ONLY new store action (D-15), one key, untracked, no trim, no provenance flag (C-1 declined), with the slug fence asserted over the PATCH body
- [x] 197-06-PLAN.md — Wave 2: the wire — a TYPE-only arm on `api.ts` (the repo's hottest file: 170/99/6154) and the `onDrafted` widening that stops the verdict being dropped at the hook boundary; absence travels as absence

**Wave 3** *(blocked on Wave 2)*

- [x] 197-07-PLAN.md — Wave 3: `DecisionsList` — five rows, always, in the exported order; each answer read LIVE off the definition; the three-arm readiness read where an absent verdict renders exactly what a green one does (nothing); rows 2+5 as ONE jump; row 4 an inline field (D-17)

**Wave 4** *(blocked on Wave 3)*

- [x] 197-08-PLAN.md — Wave 4: `DraftArrivalCard` — sketch 174's ONE card (149 px chrome, 65% to the graph), composing `SeedReceipt` **byte-unchanged** behind a fold. A COMPOSITION change, not a charter change; D-02 survives intact

**Wave 5** *(blocked on Wave 4)*

- [x] 197-09-PLAN.md — Wave 5: the page — the card mounted IN PLACE of the receipt (`graphColumn` stays at exactly THREE children or the graph strands at 0 px), the readiness captured as a SNAPSHOT beside `receiptPhases`, and two focus seams onto the controls that already exist

**Wave 6** *(blocked on Wave 5)*

- [x] 197-10-PLAN.md — Wave 6: D-19 — the drafted header renders the NAME when there is one (it is displayed nowhere today), with the `FLAG_OFF_HEADER_MARKUP` band-3 disposition declared in its own plan: a dated third re-capture following the file's own four-part procedure, or the recorded proof that none was forced

**Wave 7** *(blocked on Wave 6)*

- [x] 197-11-PLAN.md — Wave 7: the records — three gate pins taken from the gate's own counts, nine hot-file ledger rows RE-DERIVED in one batch pass with `docs/HOT-FILE-LEDGER.md` synced in the same commit, every declared criterion run once more, and every declined decision given a written re-open trigger

#### Phase 198: Node Vocabulary (research-first)

**Goal**: Establish whether deterministic primitives earn their place, and cover structured mid-run input.
**Depends on**: Last by construction — SEED-141 requires proving the need before shipping a primitive, and `execute_code` is the incumbent any proposal must beat.
**Requirements**: NODE-01, NODE-02
**Flags**: **Research-first — NODE-01 may legitimately ship nothing.** Branching/looping stays OUT: the spine is LINEAR by design; any primitive must stay linear-compatible or the linear commitment is revisited as its own decision. **G-5 fires** on `backend/app/services/harness/phase_types.py` (35 commits / 14 phases) — a phase adding a SECOND concern to that file produces a refactor recommendation first.
**Success Criteria** (what must be TRUE):

  1. **Research output first:** count how many prompts in real workflows exist only to reshape data between two real steps. If the number is low, NODE-01 ships nothing and says so.
  2. Any primitive proposed answers three constraints explicitly: the spine is LINEAR, governance vocabulary assumes an AI step, and a node's face is computed from its config.
  3. Structured mid-run input is covered — starting from what `llm_human_input` already does, not from a blank form node.

**Plans**: TBD — `/gsd:plan-phase 198`

---

<details>
<summary>✅ <strong>v3.6 Visual / No-Code Workflow Studio</strong> (Phases 181-190) — SHIPPED 2026-08-09 · 13 phases · 151 plans · 1,064 commits · full detail in <code>.planning/milestones/v3.6-ROADMAP.md</code></summary>

**Goal:** a drag-and-drop, business-friendly visual authoring + live-run observability layer on top
of the existing governed harness workflow engine — so a non-technical user (Legal / HR / Finance)
can draw their own process and watch it run, without losing the engine's governance rails.

| Phase | Name | Plans | Outcome |
|-------|------|-------|---------|
| 181 | Revert Foundation | 3/3 | ✅ verify `passed` 12/12 — HARD gate #1 (`visual_workflow_canvas` + `test_revert_byte_identical`) |
| 182 | Server Validation Seam | 12/12 | ✅ `POST /workflows/validate` reusing `lint_workflow` verbatim. ⚠ SC#3 accepted risk → SEED-134 |
| 183 | Read-Only Canvas | 9/9 | ✅ verify `passed` 8/8 + live gate 7/7 — pure projection proved before any write complexity |
| 184 | Editable Canvas + Live Structural Validation | 13/13 | ✅ UAT 13/13, SECURED. ⚠ **no VERIFICATION.md** — 5 reqs ride on UAT |
| 184.1 | Builder Header Consolidation (INSERTED) | 1/1 | ✅ nyquist compliant. ⚠ no VERIFICATION.md (carries no requirement) |
| **185** | **Graded Governance — Grounding Mode + Action-Risk Dial** | 13/13 | ✅ **THE HEADLINE DIFFERENTIATOR.** verify 12/12, operator gate PASSED, SECURED 49/49 — the audit caught a real fail-open BLOCKER before close |
| 186 | Concurrency & Autosave | 20/20 | ✅ verify 9/9, operator UAT passed, SECURED |
| 187 | Business Vocabulary + AI-Seeded Canvas | 29/29 | ✅ verify 13/14, SECURED 152/152. ⚠ VOCAB-02 partial → SEED-133 |
| 188 | Non-Technical Run Observability | 13/13 | ✅ UAT 16 PASS / 0 FAIL, SECURED 46/46. ⚠ **no VERIFICATION.md** — 3 reqs ride on UAT |
| 188.1 | WorkflowCanvas Extraction Refactor (INSERTED) | 5/5 | ✅ verify 6/6 — canvas 1593 → 1292 L; G-5 debt paid |
| 188.2 | PhaseNodeCard Extraction Refactor (INSERTED) | 7/7 | ✅ verify 7/7 — card 797 → 274 L (−65.6%); DOM proved byte-identical |
| 189 | Governed External-Action Node Model | 16/16 | ✅ UAT pass, SECURED, CONN-01 delivered — HARD gate #3 CORE half. ⚠ **no VERIFICATION.md** |
| 190 | **(STRETCH)** Live Connector Slice + Connector Security | 19/19 | ⚠ **split verdict** — CONN-03 ✅ (`threats_open: 0`, real Slack send); **CONN-02 ✗** (1 of 3 connectors drivable) |
| 191 | **(STRETCH)** Conditional Canvas Scale Hardening | 0/0 | ⏸ **DEFERRED, never built** — ship condition never fired → carry-forward |

**What shipped that mattered most.** Per-node *graded governance* (185): a node is strict when
grounded — the immutable `citations_required` coverage gate auto-attaches at RUN time to any
KB-reading phase regardless of how it was authored — and flexible when open, freely mixed in one
workflow, with the strict gate not author-loosenable-away. The deep competitor crawl (Beam / Glean /
n8n) confirmed none of them grade strictness by KB-grounding. Governance became the shape of the
artifact rather than a bolted-on run-time check.

**What did not ship, stated plainly.** Operator HARD gate #3's live half is at ⅓. A real Slack
message left the application through the full governed path — approval gate, six ordered guards,
send, `external_action_sent` audit receipt (`6379787c`) — but `_adapter_args` supplies only each
capability's `body_arg`, so Jira's `summary` and SMTP's `to`/`subject` have no author-facing field
and neither can be driven from a workflow. Slack works because its one required field happens to be
that arg. Recorded `D-190-DEF-17`; deliberately not patched at close because the fix is a phase
(schema + form + serializer) whose shape question is exactly what SEED-144/145/146 re-opened.

**Debt carried out of the milestone:** three missing `VERIFICATION.md` files carrying nine
requirements (184, 188, 189 — all wired and UAT-backed; documentation debt, not engineering debt) ·
SEED-133 and SEED-134 accepted risks · four phases at `nyquist_compliant: false` (181-184) ·
`phase_types.py` and `threads.py` both G-5 firing · **cloud parity owed at migrations 104 → 118,
where 118 is SECURITY-BEARING** (until applied, cloud still carries the CR-01 credential exposure —
118 and the `connector_service.py` deploy must land in the same operation).

**Security:** zero debt at close — all nine threat-modelled phases at `threats_open: 0`.

</details>

---

## v3.5 UX Consolidation & Chat Polish — ✅ SHIPPED 2026-07-23 (CORE); STRETCH deferred

**Started:** 2026-07-22 (operator-confirmed UX-track sequencing at v3.4-close: the polish cluster now, Visual Workflow Studio next as v3.6). **Roadmap created:** 2026-07-22. **Shipped:** 2026-07-23 (git tag `v3.5`; CORE 174-177; STRETCH 178-180 deferred → `.planning/v3.5-STRETCH-CARRYFORWARD.md`). Full detail archived → `.planning/milestones/v3.5-ROADMAP.md`.

**Goal:** Clear the parked `surface: Agentic-RAG` chat-surface bug backlog and consolidate the accumulated UI/UX rough edges — including the brand-new v3.4 org surfaces — into one coherent, polished, honest experience, before the large v3.6 Visual Workflow Studio build. A **Medium cleanup milestone**: mostly bug-fix + polish, no large net-new build; deliberately kept **separate** from v3.6.

**Red line (every phase):** never fork the shared Deep/agent-loop/provider path — provider differences stay at the gateway/adapter/sanitizer boundary (D-14). Deep Mode stays byte-identical; no new runtime.

**Numbering:** CORE **Phases 174-177**, STRETCH **Phases 178-180**. **Phases 169-173 are RESERVED** for the deferred v3.4 STRETCH carry-forwards (Dept-Admin, Entitlements, Permission-Aware Citations, OIDC SSO, Dept-Skills — `.planning/v3.4-STRETCH-CARRYFORWARD.md`) and are NOT reused here. Migrations: this is a cleanup milestone — prefer app-layer fixes; the head at v3.5's close was **113**, **next free slot = 114 reserved ONLY if a specific bug fix genuinely needs schema** (none expected). ⚠ *HISTORICAL — accurate when v3.5 shipped 2026-07-23. The live head is **115** as of 2026-08-07; see the v3.6 migrations bullet.*

**Scope source:** `.planning/REQUIREMENTS.md` (14 CORE + 9 STRETCH = 23 reqs). **Reported-bugs mandate:** this milestone IS the home of the parked backlog — at every `/gsd:discuss-phase`, re-list open/deferred `surface: Agentic-RAG` reports and fold the matching ones explicitly (some "open" reports may already be fixed-pending-verification — triage fix-vs-verify).

### Phase Table (CORE — Phases 174-177)

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 174 | Run-State & Lifecycle Honesty | Every run's lifecycle (setup → stream → stop/cancel/kill → navigation) is honestly reflected — no empty bubbles, no lost stop indicators, no hidden setup activity, no timer/avatar glitches | STATE-01, STATE-02, STATE-03, STATE-04 | 5 | **SC#10**; **G-2 sketch** (honest run-state "feels like"); **G-5** (`MessageItem.tsx`/`StreamsProvider.tsx`/`useMessages.ts`/`threads.py`); reported-bugs fold (5); UI hint; no threat model; no migration |
| 175 | Cross-Provider Streaming Fidelity | Newer reasoning models + non-OpenAI providers stream cleanly — correct params (no 400s), no tool-markup leak, honest title-gen fallback — all at the adapter/sanitizer boundary | XPROV-01, XPROV-02, XPROV-03 | 4 | **SC#10**; **G-5** (gateway/adapter/sanitizer boundary); **red line D-14**; reported-bugs fold (4); OpenRouter-400s OUT; no threat model; no migration |
| 176 | Chat Render Correctness + Exec Reliability | The transcript renders each message once, un-folded at a clean terminal, with honest send outcomes + live version-pointer updates; `execute_code` installs requested libraries reliably | RENDER-01, RENDER-02, RENDER-03, RENDER-04, EXEC-01 | 5 | **SC#10**; **G-2 sketch** (render visual); **G-5** (`MessageItem.tsx`/`useMessages.ts`/`StreamsProvider.tsx`; EXEC → `sandbox_service.py`/`tool_dispatcher.py`); reported-bugs fold (4 + 2 minor); UI hint; no threat model; migration only if RENDER-04 truly needs (unlikely) |
| 177 | v3.4 Org-Surface Polish | The new v3.4 org surfaces (admin shell, switcher, profile anchor, invitations, SSO sign-in) are polished + error-honest across every state — without widening the already-secured 166-168 authz | ORGUX-01, ORGUX-02 | 3 | **G-2 sketch** (org-surface "feels like"); **G-5 light** (`StreamsProvider.tsx` — keep `<OrgContext>` OUTSIDE the stream path, 067.5 Branch-D3 guard); rolls in 166/167/168 live-UAT status-lag; UI hint; **no SC#10**; **no threat model** (polish over secured surfaces, not new authz); no migration |

### Phase Table (STRETCH — gated behind CORE — Phases 178-180)

Committed as gated phases (ship only if CORE lands clean and budget remains; v2.9 105-109 / v3.1 125-131 / v3.2 138-144 / v3.3 156-159 / v3.4 169-173 precedent).

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 178 | Chat UI/UX Polish Pass (SEED-045 umbrella) | Sweep the collected chat/nav polish seeds into one coherent pass — SEED-045 remainder, provider-logo/nav consistency, a legible cited-vs-retrieved citation footer, run-state-aware todos, workspace-panel reliability | POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05 | 4 | — (SEED-045 anchors shipped in 156); **SC#10** (run-state todos + workspace panel + provider logos touch live state); **G-2 sketch**; **G-5** (`ToolCallPanel.tsx`/`MessageItem.tsx`/workspace panel/`useMessages.ts`/`providerLogo.tsx`); SEED-098 = verify/close only; UI hint |
| 179 | Plain-Language / Terminology Extensions | Extend the shipped v3.3 plain-language layer (`termMap`) onto the new org + chat surfaces so jargon doesn't creep back in | LANG-01 | 2 | — (extends Phase-154; best after 177 so org labels exist); label layer — **no SC#10, no G-2, no G-5**; red line (no enum/API/audit break, Deep byte-identical); UI hint |
| 180 | Agent-Loop Behavior Honesty | The agent honors explicit step-by-step / todo-loop requests, Anthropic's end-of-cycle output shows a user-facing summary (not a raw action list), and excessive tool iterations are bounded + honest | LOOP-01, LOOP-02, LOOP-03 | 4 | — (touches the agent loop — most careful STRETCH); **SC#10**; **G-5** (`agent_loop.py`/`anthropic_service.py` — both hot-file rows); **red line D-14**; reported-bugs fold (3 deferred majors + BUG-260626-02/-03); may warrant careful decomposition |

### Phase Checklist

- [x] **Phase 174: Run-State & Lifecycle Honesty** — no empty/orphaned cancel-kill bubbles, stop indicator survives nav+reload, "setting up agent" shows live activity, workflow-run timers/avatars stay accurate on nav (STATE-01..04) — COMPLETE 2026-07-22 (5/5 reqs; live UAT passed; STATE-01b resolved via Run-window surface)
- [ ] **Phase 175: Cross-Provider Streaming Fidelity** — gpt-5.6-class correct params (no 400), DeepSeek tool-markup strip holds on long turns, honest title-gen fallback (XPROV-01..03)
- [x] **Phase 176: Chat Render Correctness + Exec Reliability** — one user bubble, un-folded final answer, no silent send-drop, live version-pointer, reliable `execute_code` library install (RENDER-01..04, EXEC-01) — COMPLETE 2026-07-23 (4/4 plans; verify 5/5 must-haves; code-review CR-01/WR-01/WR-02 fixed; SC#10 live UAT rolling forward)
- [ ] **Phase 177: v3.4 Org-Surface Polish** — org-admin shell / switcher / profile anchor + invitations/SSO surfaces polished + error-honest across states (ORGUX-01, ORGUX-02)
- [ ] **Phase 178 (STRETCH): Chat UI/UX Polish Pass** — SEED-045 remainder + provider logos + citation-footer superset + run-state-aware todos + workspace-panel polish (POLISH-01..05)
- [ ] **Phase 179 (STRETCH): Plain-Language / Terminology Extensions** — extend the `termMap` reveal onto the new org + chat surfaces (LANG-01)
- [ ] **Phase 180 (STRETCH): Agent-Loop Behavior Honesty** — honor step-by-step/todo-loop, Anthropic user-facing end summary, bounded tool iterations (LOOP-01..03)

### Phase Details

#### Phase 174: Run-State & Lifecycle Honesty

**Goal**: Every run's lifecycle — setting up, streaming, stopping, cancelling, being killed, and navigating away-and-back — is honestly reflected in the chat surface, so a user is never left staring at an empty bubble, a lost stop indicator, a hidden model, or a glitched timer/avatar.
**Depends on**: Nothing (first phase — stabilizes the run-lifecycle surface the later chat phases render on).
**Requirements**: STATE-01, STATE-02, STATE-03, STATE-04
**Success Criteria** (what must be TRUE):

  1. A cancelled or killed run leaves no empty chat bubble and no orphaned run card — the surface honestly shows "cancelled — no output yet" (STATE-01).
  2. The "Response stopped" / stop indicator survives navigating away-and-back AND a full page reload (STATE-02) — read from the authoritative `runs.status` (FND-01/145), no new persistence needed.
  3. During "Setting up agent…", the user sees live model activity instead of a state that hides the model working (STATE-03).
  4. Run timers stay accurate when navigating to a workflow run — no timer reset, no duplicate avatar (STATE-04).
  5. All four hold across providers, multi-tool prompts, parallel threads, and long histories with Deep Mode byte-identical (SC#10).

**Plans**: 4 plans (3 waves)

- [x] 174-01-PLAN.md — STATE-03 pre-answer reasoning honesty (`outerBannerLabel` reasoningActive → "Reasoning…") [Wave 1]
- [x] 174-02-PLAN.md — STATE-01a + STATE-02 verify-and-close (cancelled-no-output + stop-indicator reload-derive) [Wave 1]
- [x] 174-03-PLAN.md — STATE-01b killed-workflow amber block (403 catch branch + composer unlock) [Wave 2]
- [x] 174-04-PLAN.md — STATE-04 workflow-run timer anchor + single avatar (startedAt stamp + pre-runId dedup) [Wave 3]

**UI hint**: yes
**Flags**: SC#10; G-2 sketch (honest run-state "feels like"); G-5 (`MessageItem.tsx`, `StreamsProvider.tsx`, `useMessages.ts`, `threads.py` run-lifecycle — audit at discuss); reported-bugs fold (`cancelled-run-empty-bubble-early-cancel`, `killed-workflow-empty-chat-card`, `cancelled-run-stop-indicator-lost-on-navigation`, `setting-up-agent-hides-model-activity`, `BUG-260610-01`); no threat model; no migration.

#### Phase 175: Cross-Provider Streaming Fidelity

**Goal**: Newer reasoning models and non-OpenAI providers stream cleanly — correct request params (no 400s), no tool-call markup leaking into visible content, and honest title-generation fallback — all handled at the gateway/adapter/sanitizer boundary with the shared path unforked.
**Depends on**: Phase 174 (lands after run-state honesty so the cross-provider streaming blast radius is clean).
**Requirements**: XPROV-01, XPROV-02, XPROV-03
**Success Criteria** (what must be TRUE):

  1. Newer reasoning models (gpt-5.6 class) send correct request params — no model-parameter 400 on chat or with tools (XPROV-01).
  2. DeepSeek tool-call markup never leaks into visible chat content; the re-parse/strip guard holds on long turns (XPROV-02).
  3. Title-generation cross-provider fallback is honest — no misleading fallback banner when a provider actually succeeds (XPROV-03).
  4. All three hold across the native providers with Deep Mode byte-identical — provider handling stays at the adapter/sanitizer boundary, no shared-path fork (SC#10 / D-14).

**Plans**: 4 plans (2 waves) — XPROV-04 (BUG-260722-01) folded in per D-05.

- [x] 175-01-PLAN.md — Foundation: capability markers (reasoning_first + reasoning_off SAFE list) + shared provider-safe utility-model guard (XPROV-01/03/04 substrate) [Wave 1]
- [x] 175-02-PLAN.md — XPROV-02: DSML strip stream-end flush + honest-incomplete leak signal (Option-B post-drain, existing `error` event) [Wave 1]
- [x] 175-03-PLAN.md — XPROV-01: reasoning_first STRUCTURED gate in resolve_calling_mode + honest reasoning-tools-unsupported error copy [Wave 2]
- [x] 175-04-PLAN.md — XPROV-03/04: provider-safe guard at title-gen + suggestion + per-MODEL reasoning-off title call [Wave 2]

**Flags**: SC#10; G-5 (gateway/adapter/sanitizer boundary — `openai_compat.py` DeepSeek strip, the `openai_service` param builder, `thread_title.py`; audit at discuss); red line D-14 (adapter boundary only); reported-bugs fold (`BUG-260714-01`, `BUG-260711-02` [deferred — triage fix-vs-verify], `BUG-260708-01`, `BUG-260623-01`, `BUG-260722-01` → XPROV-04); OpenRouter-specific 400s stay OUT (experimental — fix only if native-safe + low-complexity); no threat model; no migration.

#### Phase 176: Chat Render Correctness + Exec Reliability

**Goal**: The chat transcript renders each message exactly once, un-folded at a clean terminal, with honest send outcomes and live version-pointer updates — and the `execute_code` tool installs requested libraries reliably instead of silently no-op'ing.
**Depends on**: Phase 174 (shares the chat-render/streaming surface the run-state phase stabilizes).
**Requirements**: RENDER-01, RENDER-02, RENDER-03, RENDER-04, EXEC-01
**Success Criteria** (what must be TRUE):

  1. No duplicate user bubble — the optimistic temp row and the persisted row reconcile to exactly one (RENDER-01).
  2. The final answer renders un-folded at a clean terminal — no reload required to lift it out of the narration fold (RENDER-02).
  3. A submitted general-chat message always sends or surfaces an honest failure — no intermittent silent send-drop (RENDER-03).
  4. An approved skill/description version pointer updates in the UI without a reload (RENDER-04).
  5. The `execute_code` `libraries` parameter installs the requested packages reliably — no silent no-op, no wasted retry rounds (EXEC-01).

**Plans**: 4 plans (2 waves) — created 2026-07-22

- [x] 176-01-PLAN.md — RENDER-01 + RENDER-02: StreamsProvider reconcile correctness (user-bubble content-supersede drop + mount-path onTerminal un-fold by run.run_id) [Wave 1]
- [x] 176-02-PLAN.md — RENDER-04: Skill-Studio live version pointer (refreshVersions mirror of refreshGate + VersionsTab refreshNonce) [Wave 1]
- [x] 176-03-PLAN.md — EXEC-01: reliable execute_code install (python -m pip same-interpreter, retry x1) + bounded ModuleNotFound auto-heal + honest tool result [Wave 1]
- [x] 176-04-PLAN.md — RENDER-03: honest send-drop (non-dispatch → failedSendDrafts/reconcileErrors seam) + fresh-thread pending-send ordering [Wave 2, depends 176-01]

**UI hint**: yes
**Flags**: SC#10 (chat UI state + agent loop); G-2 sketch (render visual — D-13: NO fresh sketch, sketch 014 + StreamingNarration are the anchor); G-5 (`StreamsProvider.tsx` render-layer only — additive reconcile at existing seams, no refactor-first; EXEC-01 → `tool_dispatcher.py` only, sandbox_service unchanged); reported-bugs fold (`BUG-260712-02`, `BUG-260707-03`, `general-chat-intermittent-silent-send-drop`, `BUG-260706-01`, `BUG-260708-02`; minor `BUG-260609-02`/`-04` deferred → Phase 178); honest threat model (no new trust boundary — all `accept`); no migration (D-16 — all app-layer).

#### Phase 177: v3.4 Org-Surface Polish

**Goal**: The brand-new v3.4 org surfaces — org-admin shell, org switcher, profile-menu identity anchor, invitations, and SSO sign-in — are polished and error-honest across every state (member vs org-admin, 1-org vs multi-org, success vs failure), while the polish keeps the already-secured 166–168 authz intact.
**Depends on**: Nothing hard (an independent org surface); sequenced after Phase 174 so the shared nav/profile shell is stable first.
**Requirements**: ORGUX-01, ORGUX-02
**Success Criteria** (what must be TRUE):

  1. The org-admin shell, org switcher, and profile-menu identity anchor read correctly and honestly across states — member vs org-admin, single-org vs multi-org (ORGUX-01).
  2. The invitations and SSO surfaces (invite dialog, invitations tab, `/invite` landing, SSO tab, identifier-first sign-in) are polished and surface honest errors instead of dead-ends (ORGUX-02).
  3. The polish preserves the already-secured 166–168 authz — no widening of org-admin capability, no cross-org leak, no new trust boundary.

**Plans**: 5 plans (2 waves) — created 2026-07-23

- [x] 177-01-PLAN.md — Wave 0: extract the 3 shared org-zone primitives — `StatusChip` (D-08) · `RoleBadge`/`OrgIdentity` (D-04) · `HonestNotice` (D-11) + co-located tests [Wave 1]
- [x] 177-02-PLAN.md — Identity cohesion: OrgBand + ProfileMenu → shared RoleBadge; per-org-role / honest-absent / indigo-vs-amber-zone audit-and-lock (ORGUX-01, D-04/05/06/07) [Wave 2]
- [x] 177-03-PLAN.md — Management chips: InvitationsTab + SsoTab → shared StatusChip, RETIRE the UPPERCASE off-grid fork + snap to the 4px grid; link-first + victim-naming preserved (ORGUX-02, D-08/09/10) [Wave 2]
- [x] 177-04-PLAN.md — Roster + invite dialog: OrgMembersTab + InviteMemberDialog → shared RoleBadge/StatusChip/OrgAvatar + 4px grid; roster stays a pure read leaf (ORGUX-01/02, D-04/08/09/10) [Wave 2]
- [x] 177-05-PLAN.md — Entry/failure honesty: one AuthCardShell + HonestNotice across SignInForm + AcceptInvitePage; recoverable dead-ends → calm; legible fail-open note (ORGUX-02, D-11/12/13/14) [Wave 2]

**UI hint**: yes
**Flags**: G-2 sketch (org-surface polish — "feels like"); G-5 light (`StreamsProvider.tsx` — keep `<OrgContext>` OUTSIDE the stream path, preserve the 067.5 Branch-D3 clear guard); rolls in the 166/167/168 live-UAT status-lag (cross-provider SC#10 + SSO round-trip); no SC#10 (not streamed state); no threat model (polish over already-secured surfaces, not new authz); no migration. Fold the LANG-01 relabel here if Phase 179 hasn't run yet.

#### Phase 178: Chat UI/UX Polish Pass (SEED-045 umbrella) — STRETCH

**Goal**: Sweep the collected chat/nav polish seeds into one coherent pass — the SEED-045 remainder, provider-logo/nav-presence consistency, a legibly-superset citation footer, run-state-aware todos, and workspace-panel reliability — so the accumulated minor rough edges land as one polished surface rather than scattered inserts.
**Depends on**: — (gated behind CORE completion; the SEED-045 rail/chat-list anchors already shipped in Phase 156, so this is the remainder).
**Requirements**: POLISH-01, POLISH-02, POLISH-03, POLISH-04, POLISH-05
**Success Criteria** (what must be TRUE):

  1. The SEED-045 remainder minor-enhancement items land as one coherent polish pass (POLISH-01).
  2. Provider logos / nav-presence are consistent across the chat surface (POLISH-02 / SEED-058).
  3. The citation footer legibly reads as a superset of the inline `[n]` markers — cited-vs-retrieved is clear (POLISH-03 / SEED-119).
  4. The todos panel reflects the live run's state honestly (POLISH-04 / SEED-105) and the workspace panel is reliable + polished across run states (POLISH-05 / SEED-039).

**Plans**: TBD
**UI hint**: yes
**Flags**: SC#10 (run-state-aware todos + workspace panel + provider logos touch live-run / provider state); G-2 sketch (visual polish); G-5 (`ToolCallPanel.tsx`, `MessageItem.tsx`, the workspace panel, `useMessages.ts`, `providerLogo.tsx` — audit at discuss). **SEED-098 (tool-card dedup) = verify/close only** — already largely shipped via quick-task 260630-226; NOT a fresh build. No threat model; no migration.

#### Phase 179: Plain-Language / Terminology Extensions — STRETCH

**Goal**: Extend the shipped v3.3 plain-language layer (LANG-01 / `termMap`) onto the new v3.4 org surfaces and chat surfaces so jargon doesn't creep back in — purely a label layer behind the existing advanced reveal.
**Depends on**: — (gated behind CORE completion; extends the shipped Phase-154 plain-language reveal; best sequenced after Phase 177 so the org-surface labels exist to relabel).
**Requirements**: LANG-01
**Success Criteria** (what must be TRUE):

  1. The v3.3 plain-language reveal covers the new org + chat surfaces — jargon terms map to plain language behind the existing advanced reveal (LANG-01 / SEED-085).
  2. The relabel is additive — no enum/API/audit break, Deep Mode byte-identical (Phase-154 Pitfall-15 precedent).

**Plans**: TBD
**UI hint**: yes
**Flags**: no SC#10 (label layer); no G-2 (label pass, not net-new visual — Phase-154 precedent); no G-5 (additive term map); red line (no shared-path / enum break); no threat model; no migration.

#### Phase 180: Agent-Loop Behavior Honesty — STRETCH

**Goal**: The agent honors an explicit step-by-step / todo-loop request instead of collapsing it into one turn, Anthropic's end-of-cycle output shows a user-facing summary (not a raw action list), and excessive tool iterations on multi-step tasks are bounded and honest — all at the agent-loop / adapter boundary with Deep Mode byte-identical.
**Depends on**: — (gated behind CORE completion; touches the agent loop, so it is the most careful STRETCH — sequence after CORE lands clean).
**Requirements**: LOOP-01, LOOP-02, LOOP-03
**Success Criteria** (what must be TRUE):

  1. The agent honors an explicit step-by-step / todo-loop request instead of collapsing it into one turn (LOOP-01).
  2. Anthropic's end-of-cycle output shows a user-facing summary, not a raw action list (LOOP-02).
  3. Excessive tool iterations on multi-step tasks are reduced — bounded and honest — without regressing legitimate multi-step work (LOOP-03).
  4. All three hold across providers with Deep Mode byte-identical — provider-specific behavior stays at the adapter boundary, no shared-path fork (SC#10 / D-14).

**Plans**: TBD
**Flags**: SC#10; G-5 (`agent_loop.py` + `anthropic_service.py` — both on the hot-file ledger; audit at discuss); red line D-14; reported-bugs fold (`agent-ignores-step-by-step-request-no-todo-loop`, `anthropic-end-of-cycle-shows-actions-not-summary`, `anthropic-excessive-tool-iterations-on-multi-step-tasks`; related deferred `BUG-260626-02` baseline-leak-into-final-emit, `BUG-260626-03` run-end todo finalizer); may warrant its own careful decomposition at discuss-phase.

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 174. Run-State & Lifecycle Honesty | 0/? | Not started | - |
| 175. Cross-Provider Streaming Fidelity | 4/4 | Executed — ready for verification | 2026-07-22 |
| 176. Chat Render Correctness + Exec Reliability | 4/4 | Complete (SC#10 live-UAT rolling) | 2026-07-23 |
| 177. v3.4 Org-Surface Polish | 0/5 | Planned (5 plans / 2 waves) | - |
| 178 (STRETCH). Chat UI/UX Polish Pass | 0/? | Gated (behind CORE) | - |
| 179 (STRETCH). Plain-Language / Terminology Extensions | 0/? | Gated (behind CORE) | - |
| 180 (STRETCH). Agent-Loop Behavior Honesty | 0/? | Gated (behind CORE) | - |

**Guardrails firing (v3.5):**

- **G-2 sketch-first** on Phase 174 (honest run-state "feels like"), Phase 176 (render visual work), Phase 177 (org-surface polish), Phase 178 (chat polish seeds) — all live-UI / "feels like" surfaces. `/gsd:sketch` before `/gsd:spec-phase` / `/gsd:discuss-phase`. Phase 179 (label layer) needs no sketch (Phase-154 precedent).
- **G-5 hot files (audit at discuss-phase):** `MessageItem.tsx` / `StreamsProvider.tsx` / `useMessages.ts` (174, 176, 178), `ToolCallPanel.tsx` + workspace panel (178), `threads.py` (174 run-lifecycle — producer extraction paid down in 162.5 but the file stays hot), `agent_loop.py` + `anthropic_service.py` (180 — both hot-file ledger rows), the gateway/adapter/sanitizer boundary (175).
- **SC#10 (cross-provider mandate):** 174, 175, 176 (CORE chat surface) + 178 (run-state todos / workspace panel / provider logos touch live state) + 180 (agent loop). ORGUX (177) + LANG (179) deliberately NOT flagged — neither touches streamed state.
- **Reported-bugs mandate:** this milestone IS the parked chat-surface backlog's home — cross-check `.planning/reported-bugs/` (`surface: Agentic-RAG`, status open/deferred) at each `/gsd:discuss-phase` and fold matching reports; some "open" reports may be already-fixed-pending-verification (triage fix-vs-verify).
- **Threat models:** NONE this milestone — UI/bug-fix cleanup; ORGUX (177) is polish over the already-secured 166–168 surfaces, not new authz. Flag one only if a discuss-phase surfaces a real trust boundary.
- **Red line (D-14):** never fork the shared path — provider differences stay at the gateway/adapter/sanitizer boundary. Deep Mode byte-identical; no new runtime.
- **Cloud parity owed:** migrations 099–113 + `SECRETS_ENCRYPTION_KEY` still owed at the next production push (no new v3.5 migrations expected).

---

## v3.4 Multi-Tenancy & Org Access — ✅ SHIPPED 2026-07-22 (CORE); STRETCH deferred

Full detail archived → **`.planning/milestones/v3.4-ROADMAP.md`** · requirements → **`.planning/milestones/v3.4-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`** · STRETCH carry-forward guide → **`.planning/v3.4-STRETCH-CARRYFORWARD.md`**.

CORE Phases 160-168 (10 phases incl. the 162.5 `threads.py` refactor; 56 plans, 121 tasks) — the load-bearing **one-way RLS door** that turns Agentic RAG from a per-user app into an org-aware multi-tenant platform. **Tenancy foundation (160-162):** a ratify-not-relitigate Tenancy ADR (D-v3.4-01), the 8-table org/dept/role schema with correct-from-birth membership RLS + `current_user_org_ids()` (mig 104), and personal-org backfill across 35 tables (migs 105/106). **The atomic crux (162.5-164):** the `threads.py` producer extraction (2444→1214 LOC, `agent_loop` byte-identical) then the RLS rewrite + per-request user-JWT client swap (migs 107/108, FIX-A 109) so membership RLS is ENFORCED on every request path, then the SECDEF audit + `document_chunks`/`skill_embeddings` org-scoping + the two-org isolation exit-gate suite (mig 110). **Cleanup + surfaces (165-168):** `is_global` semantic retirement (mig 111 → `is_org_shared` / `is_system_global`), the org-admin shell/switcher/profile/audit + Settings split, invitations/roles/greenlists/JIT/per-user-prefs, and SAML SSO self-service (mig 113 — Supabase is the SAML SP, 0 new hard deps). 22/22 CORE requirements delivered + threat-secured (`threats_open: 0` across the isolation cluster + 166/167/168; SEED-124 + SEED-125 cross-org leaks closed). **Owed on cloud:** migrations 104-113 + `SECRETS_ENCRYPTION_KEY`. Live UAT (cross-provider SC#10 + the SSO round-trip, which needs cloud + a real IdP) rolls forward. **STRETCH 169-173** (Dept-Admin shell, entitlement/retention footholds, permission-aware citations, OIDC SSO, dept-targeted skills) deferred with concrete re-open triggers → the carry-forward guide.

---

## v3.3 Operator UX — ✅ SHIPPED 2026-07-18

Full detail archived → **`.planning/milestones/v3.3-ROADMAP.md`** · requirements → **`.planning/milestones/v3.3-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`**.

14 phases (146–159), 95 plans, 212 tasks. Made the platform operable + configurable by a non-developer operator from the UI. **Operator tier (146–148):** a gated `/admin` Control Room behind a byte-identical-404 `require_operator` gate (no RLS backstop — app-layer isolation) + operator audit ledger — health, active-runs + Kill, fail-closed capability kill-switches, maintenance/read-only mode, audit browser, user roster, API-enforced feature visibility. **Model & secrets (149–150, 159):** a dynamic model-capability registry + live propose-only discovery (no restart, no silently-guessed capabilities), add-model-by-ID + utility-filtered discovery curation (159), and app-layer Fernet secrets-at-rest with env-fallback. **Files & workflows (151–152):** `fetch_document_file` + `attach_skill_file` agent tools, Run-modal file-input + per-run KB-folder scope + safe workflow delete. **Trust & friendliness UX (153–156):** per-claim inline citations keyed to the run's real retrieval set, an app-wide plain-language layer behind an advanced reveal, a WCAG-AA sweep, everyday nav/thread polish. **Deployment (157–158):** Solo/Team/Enterprise presets + `docker-compose.prod.yml` + `OPERATOR.md`, and an idempotent lock-after-finalize install wizard at `/setup`. 20/20 requirements (16 CORE + 4 STRETCH); WFIN-02 one operator-accepted OpenRouter-axis limitation (external BUG-260714-02). Migrations 095–103; `SECRETS_ENCRYPTION_KEY` env. Threat-secured across 146–150 / 153 / 154 / 158 / 159 (`threats_open: 0`).

---

## v3.2 Skill Eval Studio + Self-Improving — ✅ SHIPPED 2026-07-10

Full detail archived → **`.planning/milestones/v3.2-ROADMAP.md`** · requirements → **`.planning/milestones/v3.2-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`**.

16 phases (132, 133, 134, 134.1, 135, 136, 137, 137.1, 137.2, 138, 139, 140, 141, 142, 143, 145), 81 plans. Turned the v3.1 Skill Trigger Tuner into a full **Skill Eval Studio**: persistent eval test cases + immutable skill versions, a with-skill-vs-without eval runner with a dual-arm LLM judge + honest per-provider verdicts + human ratings, a human-in-the-loop self-improvement loop, a publish gate, and the Evals·Triggering·Versions panel — plus a built-in skill-creator (every user, read-only + protected), STRETCH honesty phases (run-end honesty, smart-dispatch skill pre-filter, run-scoped template resolver, non-Python skill-script honesty), the FND-01 run-lifecycle foundation (`runs.status` authoritative + `threads.py` G-5 extraction, live SC#10 UAT 6/6), and a curated **Starter Workflow Library** (WF-01 — 3 KB→document starters proven live end-to-end: fork → judge-approved publish gauntlet → cited `.docx`).

**Deferred → v3.3:** FILE-01 (Phase 144, Agent-Driven Skill File Attachment — gated STRETCH, not executed; rolls forward with the workflow-file cluster SEED-110/112). **Verification debt:** live UATs pending/partial on 140/141/142/143 (see MILESTONES.md → Known Gaps).

**Next:** v3.3 Operator UX (authoritative map: `PRDs/SEQUENCE.md`).

---

## v3.1 Workflow & Skill Studio — Trust, Clarity & Triggers — ✅ SHIPPED 2026-06-28

**Started:** 2026-06-21 (Option A — scope LOCKED + operator-approved). Numbering continues from v3.0's last phase (119) → **CORE Phases 120-124**, then **STRETCH Phases 125-131** (gated behind CORE — ship only if CORE lands clean and budget remains; v2.9 105-109 precedent). *Phase 131 (SRH-01, non-Python skill-script honesty) folded in 2026-06-22 after a JS-skill-import investigation — SEED-044 Layer 1; the full Node-execution capability stays v3.2 DISC-01.*

**Goal:** Make the agent's skills + workflows trustworthy, legible, and reliably triggered across *all* providers — fix the live workflow↔skill collision (a confirmed, root-caused bug), lift cross-provider honesty to OpenAI-parity, add a Skill Trigger Tuner, and re-skin the Workflow Studio so each workflow's "soul" is obvious with a strict↔loose authoring/running split.

**Red line (every phase):** never fork the shared Deep/agent-loop/provider path — provider differences stay at the gateway/adapter/sanitizer boundary (D-14). Deep Mode stays byte-identical; no new runtime.

**Scope source:** `.planning/research/v3.1-skills-eval/CONSOLIDATED-SCOPE.md` (LOCKED). Operator pressures: `.planning/research/v3.1-skills-eval/OPERATOR-INPUTS.md`.

### Phase Table (CORE)

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 120 | Collision Fix + Context Isolation | A skill saving one file in a workflow-touched thread emits exactly that file, and Deep/Harness stop replaying each other's history | COLL-01, CTX-01 | 4 | G-5 (`threads.py` firing → extraction due, `agent_loop.py` `_reconstruct_history`); SC#10 |
| 121 | One Front Door for Workflows (IA) | Workflows launch from a single front door; the chat composer drops to 2-pill General/Explorer while the lock/409/reconcile is preserved | IA-01 | 3 | G-2 sketch-gated; UI hint; SC#10 |
| 122 | Cross-Provider Trust & Honesty Parity | Cross-provider emission is recovered-or-honest, doc-verified per provider, measured on a per-provider scoreboard, and task labels are concrete on every provider | MP-01, MP-02, MP-03, TDP-01 | 5 | G-5 (gateway/adapter boundary, `agent_loop.py`); SC#10 (cross-provider = EVAL axis, MP-03) |
| 123 | Skill Triggering Quality | A skill author can tune a description against a held-out benchmark, weak descriptions are flagged at save, and loaded skills don't fall out of context mid-session | TRIG-01, TRIG-03, CTX-03 | 5 | G-5 (`context_window.py`/`agent_loop.py` trim path for CTX-03); SC#10 (TRIG-01 cross-provider) |
| 123.1 (INSERTED) | Skill Trigger Tuner — Design Fidelity & UX Polish | The Trigger Tuner result surface reads cleanly at the org's real provider count, the seeded benchmark is visible/editable before running, a completed result survives refresh, and the builder model is choosable from configured models | TRIG-01 (gap-closure, BUG-260624-01) | TBD | G-2 sketch-gated (sketches 041–044 exist); frontend-heavy; SC#10 (cross-provider legibility) |
| 124 | Workflow Studio UX — Soul + Strict↔Loose | A user sees a workflow's "soul" at a glance in 3 sizes and meets a clear strict↔loose split ("Describe & run" vs "Author & govern") | WUX-01, WUX-02 | 4 | G-2 sketch-gated (both); UI hint; G-5 (`PhaseTimeline.tsx`/`PhaseCard.tsx`) |

### Phase Table (STRETCH — gated behind CORE)

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 125 | Self-Improve Proposer (description-only) | A bounded, human-in-the-loop description-only proposer drafts a description diff → human approves → new immutable version; never auto-publishes | SI-02 (STRETCH) | 3 | SC#10 (judge-as-gate cross-provider); depends on 122 + 123 |
| 126 | Smart-Dispatch Relevance Pre-Filter | Only plausibly-relevant skills are surfaced to the model and the catalog stays within a token budget | TRIG-02 (STRETCH) | 3 | G-5 (catalog injection path); SC#10; depends on 123 |
| 127 | Gauntlet Pip-Strip + Quiet Idle Cards | The publish gauntlet renders as a pip-strip + worded verdict with raw-on-demand; idle PhaseCards stay quiet | WUX-03 (STRETCH) | 2 | G-2 sketch-gated; UI hint; G-5 (`PhaseCard.tsx`); depends on 124 |
| 128 | Chat Tool-Card Unification + Chat-Area Reclaim | One honest, unified, space-efficient chat surface across every provider: live description before `tool_start` + provider logos in the tool-card header + a tool card that uniformly carries all run info + removing the redundant sticky composer timer + Read-more on long prompts | TDP-02, CTC-01, CTC-02, CTC-03, CTC-04 (STRETCH) | 5 | **G-2 sketch-gated** (now visual); SC#10 (cross-provider tool-card parity); **G-5** (`ToolCallPanel.tsx`/`MessageItem.tsx`/`ChatArea.tsx` — audit refactor-vs-feature at discuss); depends on 122 |
| 129 | MiniMax/OpenRouter Arg Repair | MiniMax malformed-args boundary repair + OpenRouter `require_parameters` for broader provider robustness | MP-04 (STRETCH) | 2 | G-5 (gateway/adapter boundary); SC#10; depends on 122 |
| 130 | template_input Resolver Run-Scope | The `template_input` resolver is run-scoped too — defense-in-depth for the `render_template` path alongside COLL-01 | COLL-02 (STRETCH) | 2 | depends on 120 |
| 131 | Non-Python Skill-Script Honesty | A user importing/running a skill with a non-Python script (e.g. `.js`) gets an honest message instead of a silent failure; instructions still work | SRH-01 (STRETCH) | 3 | additive, OFF the COLL-01 seam; SEED-044 Layer 1; precursor to v3.2 DISC-01 |

### Phase Checklist

- [x] **Phase 120: Collision Fix + Context Isolation** — run-scope the sandbox harvest baseline (kills the live 2-files bug) + tag `messages.origin` so Deep/Harness stop replaying each other (COLL-01, CTX-01) ✓ 2026-06-22
- [x] **Phase 121: One Front Door for Workflows (IA)** — remove the composer Harness pill → 2-pill General/Explorer, keep the lock/409/reconcile (IA-01) ✓ 2026-06-23
- [x] **Phase 122: Cross-Provider Trust & Honesty Parity** — force→coerce retry ladder, doc-verified `emit_tier`, per-provider scoreboard, OpenAI-parity task labels (MP-01, MP-02, MP-03, TDP-01) ✓ 2026-06-23
- [x] **Phase 123: Skill Triggering Quality** — Skill Trigger Tuner, save-time description lint, pin loaded skills out of trim (TRIG-01, TRIG-03, CTX-03) ✓ 2026-06-26 (all 3 gates: secure 29/29 · validate NYQUIST 12/12 · verify 12/12 + SC#10 4-axis live UAT 4/4 PASS)
- [x] **Phase 123.1 (INSERTED): Skill Trigger Tuner — Design Fidelity & UX Polish** — fix the cramped N-provider scoreboard, show/edit seeded cases, persist results across refresh, builder-model = configured models, restore dropped sketch elements (gap-closure for 123, BUG-260624-01)
 (completed 2026-06-25)

- [x] **Phase 124: Workflow Studio UX — Soul + Strict↔Loose** — soul in 3 sizes + strict↔loose disclosure (WUX-01, WUX-02) — 3 plans ✓ 2026-06-26 (code-review CR-01 fixed · verify 4/4 + operator UAT 7/7 PASS · CORE complete)
- [ ] **Phase 125 (STRETCH): Self-Improve Proposer (description-only)** — bounded human-in-the-loop description proposer (SI-02)
- [ ] **Phase 126 (STRETCH): Smart-Dispatch Relevance Pre-Filter** — relevance pre-filter + catalog token budget (TRIG-02)
- [x] **Phase 127 (STRETCH): Gauntlet Pip-Strip + Quiet Idle Cards** — pip-strip + worded verdict, quiet idle cards (WUX-03) — 3 plans (executed + code-verified 2026-06-27; manual UAT pending)
- [ ] **Phase 128 (STRETCH): Chat Tool-Card Unification + Chat-Area Reclaim** — live description before `tool_start` + provider logos in the tool-card header + uniform cross-provider tool card + remove the redundant sticky composer timer + Read-more on long prompts (TDP-02, CTC-01..04)
- [x] **Phase 129 (STRETCH): MiniMax/OpenRouter Arg Repair** — MiniMax-gated arg-repair guard (single-shot re-ask → recover or honest-fail) + OpenRouter `require_parameters` in the quality strategy (MP-04) — 3 plans ✓ 2026-06-27 (verify 11/11 · 12 unit tests green · SC#10 live 7/9 rows PASS, both load-bearing changes live-verified — OpenRouter API accepts `require_parameters` (R9), no regression on OpenAI/Anthropic/Google/MiniMax; repair rungs unit-proven, truncation trigger now dormant (cap moved 8192→9987+); BUG-260607-03 folded)
- [ ] **Phase 130 (STRETCH): template_input Resolver Run-Scope** — run-scope the render_template resolver (COLL-02)
- [ ] **Phase 131 (STRETCH): Non-Python Skill-Script Honesty** — honest import/exec message when a skill bundles a non-Python script the sandbox can't run; optional read-as-text for `.js` (SRH-01)

### Phase Details

#### Phase 120: Collision Fix + Context Isolation

**Goal**: A skill that runs in a thread that previously ran a workflow emits only its own output, and a subsequent Deep turn never replays the workflow's history — the live, root-caused collision (Mechanism A) is closed at the harvest baseline and the history-reconstruction filter.
**Depends on**: Nothing (first phase; sequenced EARLY because COLL-01 is a confirmed live bug)
**Requirements**: COLL-01, CTX-01
**Success Criteria** (what must be TRUE):

  1. A skill `execute_code` that saves exactly one file in a thread that previously ran a workflow emits exactly that one file — the prior workflow's leftover `/sandbox/output/` artifact is never re-emitted (the confirmed 2-files bug is gone).
  2. The sandbox-output harvest is run-scoped to its own run's baseline, so any file present before the run starts is excluded from that run's emitted outputs.
  3. When Deep chat and a workflow share a thread, a Deep turn's history reconstruction replays only `messages.origin = deep` rows, and a workflow phase replays only its `harness` rows — workflow context never bleeds into a subsequent Deep turn.
  4. The collision fix holds across providers, multi-tool prompts, parallel threads, and long (≥50-message) histories — Deep Mode stays byte-identical on the native-7 (no shared-path fork; SC#10).

**Plans**: 3 plans

- [x] 120-01-PLAN.md — COLL-01: run-scope the sandbox-output harvest (snapshot+hash baseline seed) + headline live-repro regression test
- [x] 120-02-PLAN.md — CTX-01: author migration 076 (messages.origin) + tag every harness insert site + asymmetric origin filter at agent_loop.py:1024
- [x] 120-03-PLAN.md — [BLOCKING] apply migration 076 to live DB (SQL-editor paste) + regenerate full-schema.sql + live-DB integration test

#### Phase 121: One Front Door for Workflows (IA)

**Goal**: A user launches workflows from a single, obvious front door (the Workflows page); the chat composer is simplified to a 2-pill General/Explorer control with the Harness pill and in-chat workflow selector removed, while the existing Harness↔Deep lock / 409 / reconcile behavior is preserved exactly.
**Depends on**: Phase 120 (context isolation is the actual collision fix; IA-01 is the clarity win that rides on top — and they touch overlapping thread/composer surfaces)
**Requirements**: IA-01
**Success Criteria** (what must be TRUE):

  1. The chat composer shows exactly two mode pills (General / Explorer) — the Harness pill and the in-chat workflow selector are gone, and the only place to launch a workflow is the Workflows page.
  2. Launching a workflow still works as an explicit "launch-in-context" action (the capability is not removed), and a launched workflow's thread still toggles into Harness mode and Continues correctly.
  3. The server-side Harness↔Deep lock still returns a 409 on an illegal switch, and the lock/reconcile behavior is unchanged from before the composer change.
  4. Behavior holds across providers and parallel threads with no Deep-mode regression (SC#10).

**Plans**: 2 plans

- [x] 121-01-PLAN.md — remove the Deep/Harness toggle + in-chat workflow picker (2-pill composer); preserve lock/409/reconcile + composer-stop Cancel (SC#1/SC#3)
- [x] 121-02-PLAN.md — rewrite ChatAreaMode + extend ChatAreaBanner + new ChatLayout launch test (SC#1/SC#2/SC#3 oracles)

**UI hint**: yes

#### Phase 122: Cross-Provider Trust & Honesty Parity

**Goal**: Structured emission is recovered-or-honest on every provider, each provider uses the emission path it actually supports (doc-verified, not guessed), cross-provider reliability is measured on a per-provider scoreboard that gates any tier change, and task/step labels are concrete on every provider (OpenAI-parity) — all at the gateway/adapter boundary, never the shared path.
**Depends on**: Phase 120 (lands after the collision fix so the cross-provider blast radius is clean)
**Requirements**: MP-01, MP-02, MP-03, TDP-01
**Success Criteria** (what must be TRUE):

  1. A model that silently fails a forced structured emit (e.g. the default model's no-metadata 400) is recovered by a force→coerce retry ladder in `forced_emit`, so a typed-artifact phase produces its emission instead of a silent empty result.
  2. Each provider's forcing/strict behavior is honest and doc-verified — an explicit `emit_tier` field replaces guesswork, the inert DeepSeek function-level `strict` is dropped, and GLM forcing is kept (intentional, live-verified).
  3. The eval treats provider as a first-class axis with a per-provider scoreboard (trigger / force / recovery / honest-fail), pass-OR-documented, and any `emit_tier` change is gated on that scoreboard (no silent tier flip).
  4. Task/todo/workflow-step labels are concrete on every provider (OpenAI-parity), not the bare tool name — an ungated prompt nudge fills `execute_code.description` and a deterministic frontend summarizer floor backstops providers that don't, without regressing providers that already do.
  5. The 4-axis SC#10 scoreboard (cross-provider × multi-tool × parallel-thread × long-message) passes as an EVAL axis (per MP-03), and Deep Mode stays byte-identical (no shared-path fork).

**Plans**: 4 plans

- [x] 122-01-PLAN.md — MP-02: explicit emit_tier field + 55-row registry migration (14/2/34/5) + remove the provider=="openai" gate + inert DeepSeek strict
- [x] 122-02-PLAN.md — MP-01: the ordered force_strict→non-strict→coerce→fail rung ladder inside forced_emit (reads emit_tier) + emit_rung telemetry
- [x] 122-03-PLAN.md — MP-03: --forced-emit scoreboard matrix (EASY+HARD × native-7, 4 axes PASS/FAIL/DOCUMENTED) + dated artifact + README grep ritual
- [x] 122-04-PLAN.md — TDP-01: ungated execute_code.description SYSTEM_PROMPT nudge + verified frontend label floor

#### Phase 123: Skill Triggering Quality

**Goal**: A skill author can measurably tune a skill's trigger description, the system flags weak trigger descriptions before a skill is saved, and a loaded skill's instructions stay available for the rest of the session instead of silently falling out of context.
**Depends on**: Phase 122 (the Trigger Tuner measures cross-provider on production model-ids; it reuses the per-provider scoreboard substrate landed in 122)
**Requirements**: TRIG-01, TRIG-03, CTX-03
**Success Criteria** (what must be TRUE):

  1. A skill author can run a description against a held-out should-trigger / should-not-trigger benchmark (Skill Trigger Tuner) and pick the winning description by held-out score, measured cross-provider on production model-ids.
  2. The Trigger Tuner reports a concrete trigger/should-not score per candidate description so the author can see one description beat another, not just a pass/fail.
  3. At `save_skill` (and in the skill-creator loop) a description-quality lint flags a weak or ambiguous trigger description before the skill is saved.
  4. A skill loaded mid-conversation stays in context for the rest of the session — its instructions are pinned out of the rolling trim window and don't silently disappear after the window rolls.
  5. Trigger measurement and the pinned-instruction behavior hold across providers and long histories (SC#10) with no shared-path fork on the trim path.

**Plans**: 6 plans

- [x] 123-01-PLAN.md — TRIG-03 deterministic save-time lint (3 hook points, warn-never-block) + D-01 catalog-note relaxation (shared LOAD_SKILL_POLICY)
- [x] 123-02-PLAN.md — CTX-03 trim-pin: load_skill tool-result as a third protected class in trim_messages_to_fit (de-dupe, 1/3 budget, LRU evict + marker) + reconstruct tag (G-5 RED LINE)
- [x] 123-03-PLAN.md — TRIG-01 core: D-08 builder-model knob + skill_tuner_service (candidates, policy-faithful classification, 60/40 held-out scoring, N-column adaptivity, owner-scoped auto-seed)
- [x] 123-04-PLAN.md — TRIG-01 routes: owner-scoped skill_tuner router (bounded background job over the run-buffer + tuner-specific SSE + held-out scoreboard)
- [x] 123-05-PLAN.md — TRIG-01 UI: focused full-surface Trigger Tuner (reachability triad) — case editor, N-column scoreboard (fires/no-false), candidate cards, live-run card, author-confirm diff (041-A/042-A/043-A)
- [x] 123-06-PLAN.md — TRIG-03 UI loop: inline never-block lint warning + "Tune this" handoff + the D-08 builder-model Settings picker (044-A)

### Phase 123.1: Skill Trigger Tuner — design fidelity and UX polish (INSERTED)

**Goal:** The Skill Trigger Tuner reads cleanly at the org's real provider count, makes the benchmark visible/editable before a run, makes a completed result durable across refresh/restart, and lets the builder model be chosen from configured models — closing the live-UAT design-fidelity + UX gaps in BUG-260624-01 (HIGH + MED) without changing the scoring core, the agent loop, the shared chat path, or the CTX-03 trim-pin.
**Requirements**: TBD (scope contract = the 12 locked decisions D-01..D-12 in 123.1-CONTEXT.md + the live-UAT audit backlog TT-05/07/08/09/10/11/12/14/15/16 in 123.1-AUDIT-BACKLOG.md; each is covered by >=1 plan)
**Depends on:** Phase 123
**Plans:** 10/10 plans complete

Plans:

- [x] 123.1-01-PLAN.md — Backend seam: tuner_runs table (migration 077) + durable latest-result upsert + GET-latest + seeded-cases GET + frontend wire (D-01/D-05/D-07/D-08)
- [x] 123.1-02-PLAN.md — Scoreboard polish: ProviderScoreboard vertical rows + magnitude bar + combined score; CandidateCard line-clamp/expand (D-02/D-04/D-11/D-12)
- [x] 123.1-03-PLAN.md — Settings builder-model picker from configured models + soft hint; remove IN-02 placeholders (D-09/D-10)
- [x] 123.1-04-PLAN.md — Page integration: full-width results, seeded-case hydrate/edit, standalone live-description scoreboard, result rehydration, pre-run cost preview + attribution (D-03/D-05/D-06/D-07/D-12)
- [x] 123.1-05-PLAN.md — [Wave 1] Editor-wall fix (sketch 045-B): backend seed-cap (MAX_SEEDED_SHOULD_NOT) + seeded GET `total` + legible/bounded CaseEditor + full-width pre-run stack (BUG-260624-01; seed-cap now load-bearing for RUN TIME per backlog section 5)
- [x] 123.1-06-PLAN.md — [Wave 2] Backend honesty: empty axis -> n/a not 1.0 (TT-05); all-error column -> unmeasured, excluded from target_count (TT-12); single-source cell_score (TT-15)
- [x] 123.1-07-PLAN.md — [Wave 3] Run UX: emit stage=provider_start so lanes flip queued->running (TT-07); real owner-scoped + run<->skill-bound DELETE cancel route + job checkpoint + claim release (TT-08)
- [x] 123.1-08-PLAN.md — [Wave 4] Run resilience: honest seeded-fetch note (TT-09); unmeasured-cell render (TT-12 render half); reconciling sub-state no-flash (TT-14); durable-poll reconnect honesty (TT-16)
- [x] 123.1-09-PLAN.md — [Wave 5] Layout: delete both decorative bg-sidebar deco-rails on SkillsPage + SkillTunerPage (TT-11)
- [x] 123.1-10-PLAN.md — [Wave 1] Observability: silence the LangSmith 429 uploader flood to ERROR + document LANGSMITH_TRACING_SAMPLING_RATE (TT-10)

#### Phase 124: Workflow Studio UX — Soul + Strict↔Loose

**Goal**: A user immediately sees the "soul" of a workflow (its purpose, what it needs, its phase spine, its tier, its output) in three consistent sizes, and meets a clear strict↔loose disclosure that offers two doors ("Describe & run" vs "Author & govern") without removing any control — accuracy and governance preserved, complexity demoted one click.
**Depends on**: Phase 121 (the Workflows page is now the single front door; the soul re-skin builds on that consolidated surface)
**Requirements**: WUX-01, WUX-02
**Success Criteria** (what must be TRUE):

  1. A user sees a workflow's "soul" at a glance in three sizes (library card / run header / publish summary): its purpose (`business_requirement`), what it needs, a glyph-dot phase spine (no type ribbons/index noise), one tier chip, and its output line.
  2. The library card / run header / publish summary all show the same soul object consistently — a user recognizes a workflow by the same essence in all three places.
  3. Authoring and running expose a strict↔loose disclosure keyed off `deriveTier` — two clear doors ("Describe & run" vs "Author & govern") — where nothing is removed and advanced controls are demoted exactly one click.
  4. The strict↔loose split preserves accuracy and control — a power user can still reach every advanced control, and a loose user can describe-and-run without meeting governance complexity (sketch-approved mockup is the acceptance bar).

**Plans**: 3 plans

- [x] 124-01-PLAN.md — Wave 0 foundation: extract shared soulData (tierForDefinition + PHASE_GLYPHS + needs/deliverable) + net-new WorkflowSoul (3 sizes) + glyph-dot PhaseSpine (WUX-01)
- [x] 124-02-PLAN.md — card-scale soul on library cards + the two-door fork (Describe & run / Author & govern) at the Studio authoring entry; library-card Run preserved (WUX-01, WUX-02)
- [x] 124-03-PLAN.md — run-surface soul as a G-5 additive sibling in WorkspacePanel + publish-summary soul block prepend (D-06 ladder untouched) (WUX-01)

**UI hint**: yes

#### Phase 125: Self-Improve Proposer (description-only)

**Goal**: A bounded, human-in-the-loop, description-only self-improvement proposer: eval surfaces a weak description → proposes a description diff → DRAFT → human approves → a new immutable version; it never auto-publishes, uses held-out selection, and uses the Phase-102 judge as a gate.
**Depends on**: Phase 122 + Phase 123 (reuses the cross-provider scoreboard, the Trigger Tuner's held-out selection, and the judge gate); gated behind CORE completion
**Requirements**: SI-02 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. The proposer can take an eval signal on a weak description and produce a proposed description diff as a DRAFT — it never edits a live skill description and never auto-publishes.
  2. A human reviews the proposed diff and, on approval, the proposal becomes a new immutable version; on rejection nothing changes.
  3. A proposed description is selected by held-out score and must clear the Phase-102 judge gate before it can be presented as a recommendation.

**Plans**: TBD
**UI hint**: yes

#### Phase 126: Smart-Dispatch Relevance Pre-Filter

**Goal**: Only plausibly-relevant skills are surfaced to the model and the skill catalog stays within a token budget, so the model isn't flooded with irrelevant skills and the catalog doesn't blow the context budget.
**Depends on**: Phase 123 (builds on the skill-triggering work); gated behind CORE completion
**Requirements**: TRIG-02 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. For a given user turn, only skills that pass a relevance pre-filter are surfaced to the model — clearly-irrelevant skills are not injected.
  2. The injected skill catalog stays within a defined token budget even as the user's skill count grows.
  3. The pre-filter never starves a genuinely-relevant skill (a should-trigger skill still reaches the model), verified cross-provider (SC#10).

**Plans**: TBD

#### Phase 127: Gauntlet Pip-Strip + Quiet Idle Cards

**Goal**: The publish gauntlet reads at a glance as a pip-strip + worded verdict with raw detail on demand, and idle PhaseCards stay visually quiet instead of competing for attention.
**Depends on**: Phase 124 (rides on the Workflow Studio UX re-skin); gated behind CORE completion
**Requirements**: WUX-03 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. The publish gauntlet renders as a pip-strip + a worded verdict, with the raw gauntlet detail available on demand (not shown by default).
  2. An idle PhaseCard stays quiet (no noisy animation/placeholder) and only animates when its phase is actually active (sketch-approved mockup is the acceptance bar).

**Plans**: 3 plans (planned 2026-06-27)

- [x] 127-01-PLAN.md — Icon foundation: build-time 3D-icon mechanism (unplugin-icons) + shared PHASE_GLYPHS 3D swap + PhaseSpine test migration
- [x] 127-02-PLAN.md — Publish gauntlet re-skin: energy-spine + worded verdict + raw-on-demand + golden-run hero (honesty contracts intact)
- [x] 127-03-PLAN.md — Living step-flow re-skin: quiet idle / bloomed active (activity line + engine chip) / folded done (G-5 PhaseCard/PhaseTimeline)

**UI hint**: yes

#### Phase 128: Chat Tool-Card Unification + Chat-Area Reclaim

**Goal**: One honest, unified, space-efficient chat surface across every provider — the tool card becomes the single canonical place for live run info, it reads identically on all providers, redundant chrome is removed, and every pixel of the chat area earns its place.
**Depends on**: Phase 122 (extends the task-label parity / tool-card honesty work); gated behind CORE completion
**Requirements**: TDP-02, CTC-01, CTC-02, CTC-03, CTC-04 (STRETCH)
**Reframed** 2026-06-27 (operator): the original narrow "Live Description Before tool_start" (TDP-02) was bundled with four operator-raised chat-surface improvements (CTC-01..04) because they share the same surface + G-5 hot files (`ToolCallPanel.tsx` / `MessageItem.tsx` / `ChatArea.tsx`) and one coherent vision — better as one sketched pass than five scattered inserts.
**Success Criteria** (what must be TRUE):

  1. A tool's `description` appears in the preparing window before the `tool_start` event fires (TDP-02), so the user sees what the agent is about to do during the prep gap — across providers, no Deep-mode regression, no shared-path fork (SC#10).
  2. The tool-card header shows the actual provider's logo per-provider, replacing the generic brand-pulse "spot" avatar (CTC-01).
  3. The tool card carries a unified content/layout across ALL providers — the single canonical, complete surface for live run info (status, elapsed, step/file counts, description), with no per-provider gaps (CTC-02; provider-docs-first / SC#10 — verified uniform before relying on it).
  4. The redundant sticky elapsed timer above the composer (`ChatArea.tsx` 076.1 D-03; today inconsistent across providers) is removed once CTC-02 holds, reclaiming chat-area space (CTC-03).
  5. Long user prompts collapse to a clamped preview with a "Read more" expander instead of rendering full-height (CTC-04).
  6. The unified surface is sketch-approved (G-2) before planning — the operator-approved mockup is the acceptance bar.

**Plans**: 6 plans

- [x] 128-01-PLAN.md — Install @lobehub/icons (supply-chain checkpoint) [D-08]
- [x] 128-02-PLAN.md — CTC-04 long-prompt clamp + gradient fade + Read-more (independent) [D-03]
- [x] 128-03-PLAN.md — providerLogo.tsx shared helper (logo map + preparingDescription) + Wave-0 unit tests [D-05]
- [x] 128-04-PLAN.md — CTC-01 RunCard logo + TDP-02 ToolCallPanel description = the unified card (CTC-02) [D-01/D-04]
- [x] 128-05-PLAN.md — D-06 LIVE native-7+OpenRouter cross-provider scoreboard (operator-run) [D-06]
- [x] 128-06-PLAN.md — CTC-03 StickyTimerBar deletion (LAST, gated on the D-06 proof) [D-02/D-07]

**UI hint**: yes

#### Phase 129: MiniMax/OpenRouter Arg Repair

> **STRETCH-origin** — promoted to active 2026-06-26 after v3.1 CORE (120–124) shipped clean; selected as a highest-value STRETCH (the only one closing a live open bug).

**Goal**: Broader provider robustness — MiniMax malformed tool-args are repaired at the adapter boundary, and OpenRouter requests set `require_parameters` so a wider set of routed providers honor the tool schema.
**Depends on**: Phase 122 (extends the cross-provider trust cluster at the gateway/adapter boundary); CORE complete (gate lifted)
**Requirements**: MP-04 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. A MiniMax malformed-args response is repaired at the adapter boundary so the tool call still dispatches instead of failing (closes the `minimax-m3-invalid-tool-args-400` class).
  2. OpenRouter requests carry `require_parameters`, and the change improves tool-schema honoring without regressing other providers (SC#10), with provider handling staying at the adapter boundary (no shared-path fork).

**Plans**: 3 plans

- [ ] 129-01-PLAN.md — OpenRouter `require_parameters` wired into the quality strategy (D-02) + unit test
- [ ] 129-02-PLAN.md — MiniMax-gated arg-validity guard + bounded re-ask + recovered signal / honest-fail (D-01/D-03); folds BUG-260607-03 + unit tests
- [ ] 129-03-PLAN.md — SC#10 4-axis live cross-provider scoreboard (authored in VALIDATION.md + operator-run)

#### Phase 130: template_input Resolver Run-Scope

**Goal**: Defense-in-depth for the collision — the `template_input` resolver is run-scoped too, so the `render_template` path can't re-introduce a cross-run leak alongside the COLL-01 harvest fix.
**Depends on**: Phase 120 (pairs with COLL-01 on the same collision/harvest surface); gated behind CORE completion
**Requirements**: COLL-02 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. The `template_input` resolver only resolves inputs scoped to the current run — a prior run's template inputs in the shared workspace are never picked up by a later run's `render_template`.
  2. The render_template path produces the same output it did before for in-scope inputs (no regression on the happy path).

**Plans**: TBD

#### Phase 131: Non-Python Skill-Script Honesty

**Goal**: A user who imports or runs a market skill that bundles a non-Python script the Python-only sandbox can't execute (e.g. `.js`) gets an honest, specific signal instead of a silent/confusing failure — closing the trust gap from the 2026-05-31 JS-skill-import incident (SEED-044 Layer 1). This is the honesty precursor to v3.2's DISC-01 (the full Node-execution capability); it is purely additive and stays OFF the COLL-01 sandbox-injection seam.
**Depends on**: Nothing hard; sequence after Phase 120 only to avoid touching the COLL-01 harvest/execution seam concurrently. Gated behind CORE completion. Lightweight (G-3-adjacent — import-boundary detection + an execution pre-check + message; no Node runtime, no image rebuild, no shared-path fork).
**Requirements**: SRH-01 (STRETCH)
**Success Criteria** (what must be TRUE):

  1. Importing a skill that bundles a non-Python script (e.g. `.js`) still succeeds, and the user sees an honest message that the skill includes a step the sandbox can't run yet while its instructions still work.
  2. When the agent would run a non-Python skill script, it fails cleanly with a specific message instead of silently running JS as Python and dying on a Python `SyntaxError`.
  3. (Optional) `read_skill_file` can return a bundled `.js` as reference text so the model can read/reason about it, without implying it can be executed.

**Plans**: TBD
**Note**: Real multi-language execution (Node in the image + language routing) is explicitly NOT this phase — that's v3.2 DISC-01, which must sequence after COLL-01.

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 120. Collision Fix + Context Isolation | 3/3 | Complete | 2026-06-22 |
| 121. One Front Door for Workflows (IA) | 2/2 | Complete | 2026-06-23 |
| 122. Cross-Provider Trust & Honesty Parity | 4/4 | Complete | 2026-06-23 |
| 123. Skill Triggering Quality | 6/6 | Complete (secure 29/29 · validate 12/12 · verify 12/12 + SC#10 4-axis UAT 4/4) | 2026-06-26 |
| 123.1 (INSERTED). Skill Trigger Tuner — Design Fidelity & UX Polish | 10/10 | Complete (verify 22/22 + UAT 8/8 · secure 34/34 · validate 9/9) | 2026-06-25 |
| 124. Workflow Studio UX — Soul + Strict↔Loose | 3/3 | Complete (code-review CR-01 fixed · verify 4/4 + operator UAT 7/7 · CORE complete) | 2026-06-26 |
| 125 (STRETCH). Self-Improve Proposer (description-only) | 0/? | Gated (behind CORE) | - |
| 126 (STRETCH). Smart-Dispatch Relevance Pre-Filter | 0/? | Gated (behind CORE) | - |
| 127 (STRETCH). Gauntlet Pip-Strip + Quiet Idle Cards | 3/3 | Code-verified (11/11 truths); manual UAT pending | 2026-06-27 |
| 128 (STRETCH). Chat Tool-Card Unification + Chat-Area Reclaim | 6/6 | Complete (verify 5/6 code truths · D-06 scoreboard PARTIAL — logos confirmed live both themes, exhaustive sweep deferred · 3 live-UAT carried · white-chip + lmstudio logo fixes) | 2026-06-27 |
| 129 (STRETCH). MiniMax/OpenRouter Arg Repair | 0/? | Gated (behind CORE) | - |
| 130 (STRETCH). template_input Resolver Run-Scope | 0/? | Gated (behind CORE) | - |
| 131 (STRETCH). Non-Python Skill-Script Honesty | 0/? | Gated (behind CORE) | - |

**Guardrails firing (v3.1):**

- **G-2 sketch-first** on Phase 121 (IA-01), Phase 124 (WUX-01/02), Phase 127 (WUX-03), Phase 128 (CTC-01..04 — reframed 2026-06-27 from a non-visual TDP-02 into a visual chat-surface bundle) — all live UI / "feels like" surfaces. `/gsd:sketch` before `/gsd:spec-phase` / `/gsd:discuss-phase`. `sketch-findings-agentic-rag` already names the workflow run surface, the Workflows page, the phase timeline, and the composer.
- **G-5 hot files:** `backend/app/api/threads.py` (firing → extraction due — do NOT grow it; 120/121 touch its thread/composer surface), `context_window.py`/`agent_loop.py` trim path (CTX-01 origin filter in `_reconstruct_history`, CTX-03 trim-pin), `PhaseTimeline.tsx`/`PhaseCard.tsx` (shared with the live harness — re-run replay tests in 124/127), the gateway/adapter boundary (122/128/129).
- **SC#10 cross-provider** is an EVAL axis here (MP-03), not just manual UAT — flagged on every phase touching streaming / agent loop / provider routing / UI state (120, 121, 122, 123, 124, and the dependent STRETCH phases).
- **Red line:** never fork the shared path — provider differences stay at the gateway/adapter/sanitizer boundary (D-14). Deep Mode stays byte-identical; no new runtime.

---

## v3.0 Document Management — ✅ SHIPPED 2026-06-21

Full detail archived → **`.planning/milestones/v3.0-ROADMAP.md`** · requirements → **`.planning/milestones/v3.0-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`**.

11 phases (110, 111, 111.1, 112–119; incl. inserted embeddings phase 111.1), 46 plans, shipped + validated — **every phase passed verify-work + secure-phase + validate-phase** (live cross-provider UAT on the agent-tool / upload-path phases; no formal milestone audit). Turned the product's incidental document handling into a first-class, metadata-driven surface (M-Files Tier A): user-defined custom metadata with per-field confidence + audited manual override, configurable multi-provider embeddings (retires the OpenAI SPOF), metadata-driven "virtual folders" (a closed-registry filter-AST → parameterized-jsonb compiler + a no-DSL builder + an agent tool), typed document relationships (a leak-safe share-don't-fork core + panel + agent tool), suggest-then-confirm auto-classification, and a light governance-health view. 24/24 functional requirements delivered; `threads.py` untouched all milestone (G-5); near-zero new deps.

**Next:** v3.1 Workflow & Skill Studio — Trust, Clarity & Triggers (active above; decided scope in `.planning/research/v3.1-skills-eval/CONSOLIDATED-SCOPE.md`).

---

## v2.9 Workflow Studio — ✅ SHIPPED 2026-06-15

Full detail archived → **`.planning/milestones/v2.9-ROADMAP.md`** · requirements → **`.planning/milestones/v2.9-REQUIREMENTS.md`** · summary → **`.planning/MILESTONES.md`**.

CORE phases 097–104 (9 phases incl. inserted 101.1, 57 plans) shipped + validated — every CORE phase passed verify-work + secure-phase + live cross-provider UAT. Turned the v2.8 harness into an authorable capability: project/scope binding + server-side KB governance, workflow↔skill composition, ephemeral template upload + guaranteed cited template-fill with integrity gates, a reusable validation-gate library + an output-quality judge **hard-wall**, a Workflows page with NL authoring + read-only graph + 8-stage publish gauntlet, and a PM flagship content pack on the generic primitives.

**STRETCH 105–109 deferred to backlog** (never started — roadmap gated them on "ship only if CORE lands clean and budget remains"): SCHED-01 (scheduled triggers + budget caps), GRID-01 (citation-traceable grid renderer), GOV-02 (per-run provenance receipt), PLUG-01 (plugin-contract lock), ROLE-01 (operator/admin role tier). They roll forward as next-milestone candidates.

---

## Shipped Milestones

<details>
<summary>v3.2 Skill Eval Studio + Self-Improving (Phases 132-145) — SHIPPED 2026-07-10</summary>

CORE 132-137 (+ inserts 134.1, 137.1, 137.2): eval test-case persistence + immutable versions + with-skill-vs-without runner + honest per-provider verdicts + ratings + self-improve loop (SI-01) + publish gate + Evals panel + eval production-clean + built-in skill-creator. STRETCH shipped: 138 Run-End Honesty · 139 Self-Improve Proposer (description-only) · 140 Smart-Dispatch Relevance Pre-Filter · 141 template_input Resolver Run-Scope · 142 Non-Python Skill-Script Honesty · 143 Starter Workflow Library · 145 Run-Lifecycle Honesty + threads.py Extraction (FND-01). STRETCH deferred: 144 (FILE-01) → v3.3. 81 plans total. Full details: `.planning/milestones/v3.2-ROADMAP.md`.

- [x] Phase 132: Skill Versioning + Eval Test-Case Persistence (3/3 plans) — completed 2026-06-30
- [x] Phase 133: Eval Runner — With-Skill vs Without-Skill (5/5 plans) — completed 2026-06-30
- [x] Phase 134: Eval Results, Honest Verdict + Ratings (4/4 plans) — completed 2026-07-02
- [x] Phase 134.1: Evals Run Silently (bug fix — inserted during 134 UAT) (1/1 plans) — completed 2026-07-02
- [x] Phase 135: Self-Improvement Loop (SI-01) (9/9 plans) — completed 2026-07-02
- [x] Phase 136: Skill Publish Gate (GATE-01) (4/4 plans) — completed 2026-07-03
- [x] Phase 137: Skill Evals Panel UI (PANEL-01) (7/7 plans) — completed 2026-07-04
- [x] Phase 137.1: Skill Eval Production-Clean (10/10 plans) — completed 2026-07-04
- [x] Phase 137.2: Skill Creator Reborn — Built-in + Protected (4/4 plans) — completed 2026-07-04
- [x] Phase 138: Run-End Honesty (STRETCH) (5/5 plans) — completed 2026-07-06
- [x] Phase 139: Self-Improve Proposer — Description-Only (STRETCH) (5/5 plans) — completed 2026-07-06
- [x] Phase 140: Smart-Dispatch Relevance Pre-Filter (STRETCH) (5/5 plans) — completed 2026-07-07
- [x] Phase 141: template_input Resolver Run-Scope (STRETCH) (3/3 plans) — completed 2026-07-07
- [x] Phase 142: Non-Python Skill-Script Honesty (STRETCH) (5/5 plans) — completed 2026-07-08
- [x] Phase 143: Starter Workflow Library (STRETCH) (5/5 plans; core UAT proven live, A1+empty-folder deferred) — completed 2026-07-10
- [x] Phase 145: Run-Lifecycle Honesty + threads.py Extraction (STRETCH · FOUNDATION) (6/6 plans; SC#10 UAT 6/6) — completed 2026-07-10
- [ ] Phase 144: Agent-Driven Skill File Attachment (FILE-01) — DEFERRED → v3.3 (not executed)

</details>

<details>
<summary>v3.1 Workflow &amp; Skill Studio — Trust, Clarity &amp; Triggers (Phases 120-129) — SHIPPED 2026-06-28</summary>

CORE (6 phases + inserted 123.1): 120 Collision Fix + Context Isolation · 121 One Front Door · 122 Cross-Provider Trust & Honesty · 123 Skill Triggering Quality · 123.1 Trigger Tuner UX Polish · 124 Workflow Studio UX Soul + Strict↔Loose. STRETCH shipped: 127 Gauntlet Pip-Strip (code-verified/UAT partial) · 128 Chat Tool-Card Unification + Provider Logos · 129 MiniMax/OpenRouter Arg Repair. STRETCH deferred: 125/126/130/131. 40 plans total. Full details: `.planning/milestones/v3.1-ROADMAP.md`.

- [x] Phase 120: Collision Fix + Context Isolation (3/3 plans) — completed 2026-06-22
- [x] Phase 121: One Front Door for Workflows (IA) (2/2 plans) — completed 2026-06-23
- [x] Phase 122: Cross-Provider Trust & Honesty Parity (4/4 plans) — completed 2026-06-23
- [x] Phase 123: Skill Triggering Quality (6/6 plans) — completed 2026-06-26
- [x] Phase 123.1: Skill Trigger Tuner — Design Fidelity & UX Polish (10/10 plans) — completed 2026-06-25
- [x] Phase 124: Workflow Studio UX — Soul + Strict↔Loose (3/3 plans) — completed 2026-06-26
- [x] Phase 127: Gauntlet Pip-Strip + Quiet Idle Cards (3/3 plans) — code-verified 2026-06-27
- [x] Phase 128: Chat Tool-Card Unification + Chat-Area Reclaim (6/6 plans) — completed 2026-06-27
- [x] Phase 129: MiniMax/OpenRouter Arg Repair (3/3 plans) — completed 2026-06-27

</details>

<details>
<summary>v3.0 Document Management (Phases 110-119) -- SHIPPED 2026-06-21</summary>

- [x] Phase 110: DM Foundations (2/2 plans) -- completed 2026-06-15
- [x] Phase 111: Metadata Enrichment — Extraction Backend (5/5 plans) -- completed 2026-06-16
- [x] Phase 111.1: Configurable / Multi-Provider Embeddings (6/6 plans) -- completed 2026-06-17
- [x] Phase 112: Metadata Enrichment — Detail Panel + Manual Edit (4/4 plans) -- completed 2026-06-18
- [x] Phase 113: Virtual Folders — Filter Compiler + Equality (Backend) (3/3 plans) -- completed 2026-06-18
- [x] Phase 114: Virtual Folders — Range/Date + Builder + Sidebar (6/6 plans) -- completed 2026-06-19
- [x] Phase 115: Virtual Folders — Agent Tool (3/3 plans) -- completed 2026-06-20
- [x] Phase 116: Document Relationships — Backend + Agent Tool (5/5 plans) -- completed 2026-06-20
- [x] Phase 117: Document Relationships — Panel UI (4/4 plans) -- completed 2026-06-20
- [x] Phase 118: Auto-Classification (6/6 plans) -- completed 2026-06-21
- [x] Phase 119: Document Governance Health (2/2 plans) -- completed 2026-06-21

</details>

<details>
<summary>v2.9 Workflow Studio (Phases 097-104 CORE) -- SHIPPED 2026-06-15</summary>

- [x] Phase 097: Spike — Risk-Register Template-Fill + Authoring Feel (5/5 plans) -- completed 2026-06-08
- [x] Phase 098: Project Binding + Server-Side KB Scope Governance (5/5 plans) -- completed 2026-06-09
- [x] Phase 099: Workflow ↔ Skill Composition (6/6 plans) -- completed 2026-06-10
- [x] Phase 100: Ephemeral Template Upload (6/6 plans) -- completed 2026-06-10
- [x] Phase 101: Template-Fill + Integrity Validation (5/5 plans, via 101.1) -- completed 2026-06-12
- [x] Phase 101.1: Guaranteed Structured Emission Layer (10/10 plans; verify-work 19/19 + secure 36/36) -- completed 2026-06-12
- [x] Phase 102: Reusable Validation-Gate Library + Output-Quality Gate (9/9 plans; verify-work 7/7 + secure 34/34) -- completed 2026-06-13
- [x] Phase 103: Workflows Page + Authoring API + NL Authoring (6/6 plans; secured 32 threats/0 open) -- completed 2026-06-14
- [x] Phase 104: PM Flagship Content Pack (3/3 plans; secured 15/0 + nyquist + live UAT 5/5) -- completed 2026-06-15

STRETCH (deferred to backlog, never started): 105 Scheduled Triggers + Budget Caps · 106 Citation-Traceable Grid Renderer · 107 Per-Run Provenance Receipt · 108 Plugin Contract Lock · 109 Operator/Admin Role Tier.

</details>

<details>
<summary>v1.0 Knowledge Base Explorer (Phases 1-8) -- SHIPPED 2026-03-29</summary>

- [X] Phase 1: Folder Schema & Core APIs (2/2 plans) -- completed 2026-03-21
- [X] Phase 2: Document-Folder Integration (2/2 plans) -- completed 2026-03-21
- [X] Phase 3: Ingestion UI (3/3 plans) -- completed 2026-03-21
- [X] Phase 4: Navigation Tools (2/2 plans) -- completed 2026-03-22
- [X] Phase 5: Search Tools (2/2 plans) -- completed 2026-03-21
- [X] Phase 6: Read Tool (2/2 plans) -- completed 2026-03-22
- [X] Phase 7: Explorer Sub-Agent (2/2 plans) -- completed 2026-03-22
- [X] Phase 8: Folder System Enhancements (3/3 plans) -- completed 2026-03-28

Full details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

<details>
<summary>v2.0 Agent Skills & Code Execution (Phases 9-17) -- SHIPPED 2026-04-04</summary>

Full details: `.planning/milestones/v2.0-ROADMAP.md`

</details>

<details>
<summary>v2.1 Stability & RAG Correctness (Phases 18-25) -- SHIPPED 2026-04-11</summary>

Full details: `.planning/milestones/v2.1-ROADMAP.md`

</details>

<details>
<summary>v2.2 Trust & Compliance (Phases 26-32) -- SHIPPED 2026-04-16</summary>

Full details: `.planning/milestones/v2.2-ROADMAP.md`

</details>

<details>
<summary>v2.3 Memory, Multimodal & Experience (Phases 33-43) -- SHIPPED 2026-04-19</summary>

Full details: `.planning/milestones/v2.3-ROADMAP.md`

</details>

<details>
<summary>v2.4 Stability, Polish & UX Fixes (Phases 44-57) -- SHIPPED 2026-04-30</summary>

Full details: `.planning/milestones/v2.4-ROADMAP.md`

</details>

<details>
<summary>v2.5 Deployment Strategy (Phases 058-067.5) -- SHIPPED 2026-05-09</summary>

Full details: `.planning/milestones/v2.5-ROADMAP.md`

</details>

<details>
<summary>v2.6 Foundation: RAG Quality + Multi-Worker + Polish (Phases 068-082) -- SHIPPED 2026-05-27</summary>

35 phases (068-082 including inserts), 91 plans complete. See `.planning/milestones/v2.6-phases/` for archived phase directories and `.planning/MILESTONES.md` for the full close-out narrative.

</details>

<details>
<summary>v2.7 Agent Workspace & Panel (Phases 083-088) -- SHIPPED 2026-05-30</summary>

6 phases (083-088), 28 plans, 50 tasks complete. Per-thread workspace filesystem (write/read/list/delete/version/diff, hybrid inline/Storage), 3 new agent tools (`write_todos`, `task` sub-agents, `ask_user` pause/resume via Redis pub/sub), the right-side collapsible workspace panel (todos · file browser · version diff · ask_user seam), and WCAG 2.1 AA across all panel surfaces. Full phase details: `.planning/milestones/v2.7-ROADMAP.md`. Close-out narrative + decisions: `.planning/MILESTONES.md`.

- [x] Phase 083: Foundation -- Tool-Dispatch Extraction + Bug Fixes (3/3 plans) -- completed 2026-05-27
- [x] Phase 084: Workspace Filesystem Backend (5/5 plans) -- completed 2026-05-28
- [x] Phase 085: New LLM Tools (5/5 plans) -- completed 2026-05-28
- [x] Phase 086: StreamsProvider Extension + Panel Hooks (2/2 plans) -- completed 2026-05-29
- [x] Phase 087: Panel UI (8/8 plans) -- completed 2026-05-29
- [x] Phase 088: Cross-Cutting Verification + Accessibility (5/5 plans) -- completed 2026-05-30

</details>

<details>
<summary>v2.8 Harness Engine & Workflow Mode (Phases 089-096) -- SHIPPED 2026-06-07</summary>

10 phases (089-096, incl. inserted refactor 092.5 + inserted live-UAT phase 095.1), 67 plans complete. A deterministic, auditable workflow runtime -- locked ordered phases + dispatcher-enforced per-phase tool whitelists + validation gates with bounded retry + Postgres-resumable phase state, plus a per-thread Deep/Harness dual-mode toggle and a live WCAG 2.1 AA phase-timeline in the workspace panel. The harness is ~80% composition of shipped primitives with zero new deps; Deep Mode stayed byte-identical (the red line). Mid-milestone rescope (discuss-093) inserted 092.5 (provider-gateway extraction) + 095.1 (cross-provider run honesty). Full details: `.planning/milestones/v2.8-ROADMAP.md`. Close-out narrative + decisions: `.planning/MILESTONES.md`.

- [x] Phase 089: Agent-Loop Extraction (G-5) + Kickoff UAT (4/4 plans) -- completed 2026-05-30
- [x] Phase 090: Harness Schema + RLS + Config Models (3/3 plans) -- completed 2026-05-31
- [x] Phase 091: Harness Engine + 5 Phase Types + Gates + Whitelist (8/8 plans) -- completed 2026-05-31
- [x] Phase 092: Dual-Mode Wiring + Continue Button (7/7 plans) -- completed 2026-06-01
- [x] Phase 092.5: Provider Gateway Extraction (6/6 plans) -- completed 2026-06-01
- [x] Phase 093: Harness Cross-Provider Parity + Phase-Type Hardening (9/9 plans) -- completed 2026-06-03
- [x] Phase 094: Workflow Legibility + Mode Clarity (5/5 plans) -- completed 2026-06-04
- [x] Phase 095: Chat Tool-Card Unification (9/9 plans) -- completed 2026-06-06
- [x] Phase 095.1: Cross-Provider Run Honesty & Workspace Parity (7/7 plans) -- completed 2026-06-06
- [x] Phase 096: Eval Harness + Cross-Provider Verification + Concurrency (9/9 plans) -- completed 2026-06-07

</details>

---

*Milestones v1.0–v3.1 shipped and archived under `.planning/milestones/`. **Next milestone: v3.2** — run `/gsd:new-milestone` to define scope. Re-sequenced PRD roadmap: see `.planning/PRDs/SEQUENCE.md`. v2.9 STRETCH 105–109 + v3.1 STRETCH 125/126/130/131 remain backlog carry-forwards.*
