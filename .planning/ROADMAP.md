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
- 🔨 **v3.2 Skill Eval Studio + Self-Improving** — Phases 132-144 (CORE 132-137; STRETCH 138-144), started 2026-06-28. The net-new eval+versioning backend: immutable skill version snapshots + eval test-case persistence + with-skill-vs-without eval runner (SSE) + honest per-provider results + inline ratings + the full self-improvement loop (SI-01) + a skill publish gate, surfaced in a sketch-gated Skill Evals panel. Brief: `PRDs/v3.1-skill-studio-eval.md`.
- 📋 **v3.3 Operator UX** → **v3.4 Multi-tenancy** → **v3.5 Open Platform (API/MCP)** → **v3.6 Automations** — the enterprise-GTM track (shifted down one slot 2026-06-21 by the Skill-Studio split; brief filenames keep old numbers). ⚠ Multi-tenancy (one-way RLS door) now 3 slots out — the GTM track jumps the queue if a paying customer appears. **Authoritative map: `PRDs/SEQUENCE.md`.**

---

## v3.2 Skill Eval Studio + Self-Improving — 🔨 IN PROGRESS (started 2026-06-28)

**Started:** 2026-06-28. Numbering continues from v3.1's last phase (131) → **CORE Phases 132-137**, then **STRETCH Phases 138-144** (gated behind CORE — ship only if CORE lands clean and budget remains; v2.9 105-109 / v3.1 125-131 precedent). *Phase 144 added 2026-07-05 (SEED-104, promoted from Phase 137.2's live SC#4 UAT).*

**Goal:** Give users a real iterative environment to test, compare, and improve their skills — see exactly how a skill change affects real outputs across providers, and let the system suggest improvements automatically (human always in the loop). This turns the v3.1 Skill Trigger Tuner into a full improvement cycle.

**Red line (every phase):** never fork the shared Deep/agent-loop/provider path — provider differences stay at the gateway/adapter/sanitizer boundary (D-14). Deep Mode stays byte-identical; **no new eval runtime** — evals re-use the existing agent loop + provider gateway (with-skill vs without-skill on the same provider).

**Scope source:** `.planning/REQUIREMENTS.md` (v3.2 — 8 CORE + 6 STRETCH); brief `.planning/PRDs/v3.1-skill-studio-eval.md`. SEED-002 pre-work: catalog-injection cost (full vs target-only inject during eval) resolved in EVAL-02 (Phase 133) planning; Skills-tab scope = PANEL-01 (Evals panel addition, not a full redesign).

### Phase Table (CORE)

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 132 | Skill Versioning + Eval Test-Case Persistence | Every skill-instructions save captures an immutable version snapshot; a user builds a persistent, editable set of eval test cases traceable to that version | VER-01, EVAL-01 | 4 | Schema/RLS foundation (~5 new tables); owner-scoped (skills RLS precedent); no agent-loop/provider touch |
| 133 | Eval Runner — With-Skill vs Without-Skill | A user launches an eval that runs each case with-skill and without-skill, watches per-case progress stream, and finds the full result set after reload | EVAL-02 | 4 | **SC#10**; G-5 (do NOT grow `threads.py` — net-new eval router, `skill_tuner.py` precedent; consume `agent_loop.py`/gateway READ-ONLY); red line (no new runtime) |
| 134 | Eval Results, Honest Verdict + Ratings | A user reads an honest per-provider pass/fail verdict + side-by-side with/without comparison and rates individual outputs into a human preference signal | EVAL-03, EVAL-04 | 4 | SC#10 (per-provider verdict honesty, MP-03 precedent); UI hint (functional read/rate — polished panel = PANEL-01) |
| 135 | Self-Improvement Loop (SI-01) | Eval + Tuner signal → proposed instruction-body diff → human approves → new immutable version → auto-re-eval gate; never auto-applies | SI-01 | 4 | **SC#10**; UI hint (diff review/approve); G-5 (consume `agent_loop.py`/gateway READ-ONLY); human-in-the-loop mandatory |
| 136 | Skill Publish Gate (GATE-01) | A skill can be published (global/shareable) only after ≥1 eval has run and passed; the publish flow surfaces the gate with a clear status | GATE-01 | 3 | UI hint (publish-flow gate status); future-publish-only (no retroactive gating) |
| 137 | Skill Evals Panel UI (PANEL-01) | The Skills UI gains a sketch-gated Skill Evals panel: case editor, run history, run detail (side-by-side + pass/fail), inline ratings, diff-viewable version history | PANEL-01 | 4 | **G-2 sketch-gated**; UI hint; SC#10 (UI state surfacing per-provider results + live run); additive (no full Skills-tab redesign) |
| 137.1 | Skill Eval Production-Clean (INSERTED 2026-07-04) | The eval engine is trustworthy for every provider: automated cross-provider smoke sweep, matrix runs (N providers in parallel + mean±stddev/delta aggregation + analyst notes), determinate progress, judge case_feedback, per-arm duration, judge-model Settings knob, BUG-260701-01/-260702-02 closed | EVAL-05 | 4 | **SC#10 full-roster**; SEED-100 promoted; G-2 for matrix-run/progress UI; D-14 red line (gateway-boundary fixes only) |
| 137.2 | Skill Creator Reborn — Built-in + Protected (INSERTED 2026-07-04) | Every user (local + cloud) has a read-only, undeletable, "Built-in"-badged skill-creator whose platform-native instructions run our full loop: interview → RAG research → save_skill → eval cases → eval → proposals/tuner → publish gate | CREATE-01 | 3 | SEED-101 (full capability matrix from Anthropic's skill-creator zip); seed migration + deploy-parity entry; additive — never breaks 132–137 surfaces |

### Phase Table (STRETCH — gated behind CORE)

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 138 | Run-End Honesty | A run ends honestly — baseline-seeded files aren't dead "Download unavailable" cards, and open todos are marked "ended with open todos" not silently auto-completed | RUN-01 | 3 | SEED-094 (closes BUG-260626-02/-03); G-5 (`agent_loop.py` finalizer/terminal path); backend-only, small — can go early |
| 139 | Self-Improve Proposer — Description-Only | A bounded description-only proposer drafts a description diff → human approves → new immutable version; no instruction-body edits | SI-02 | 3 | SC#10; UI hint; depends on 135 (SI-01 substrate) |
| 140 | Smart-Dispatch Relevance Pre-Filter | Only plausibly-relevant skills are surfaced to the model, keeping the active catalog within a configurable token budget | TRIG-02 | 3 | **SC#10**; G-5 (catalog injection in `agent_loop.py` + token budget `context_window.py`); depends on Phase 123 CTX-03 (shipped) |
| 141 | template_input Resolver Run-Scope | The `template_input` resolver is run-scoped — a template uploaded in one run is not visible/accessible in another | COLL-02 | 2 | depends on Phase 120 COLL-01 run-scope seam (shipped); defense-in-depth |
| 142 | Non-Python Skill-Script Honesty | A skill bundling a non-Python script yields an honest "cannot execute this skill type" signal instead of silent failure / fake narration | SRH-01 | 3 | DISC-01 Layer 1 / SEED-044; additive, OFF the Phase 120 COLL-01 seam; precursor to v3.3+ full Node execution |
| 143 | Starter Workflow Library | A curated is_global shelf of fork-able starter workflows on the Workflows page; users fork a starter into a personal draft | WF-01 | 3 | SEED-084; UI hint; no new runtime — one shelf section + content authoring |
| 144 | Agent-Driven Skill File Attachment | The agent can attach files/scripts/assets it creates directly to the skill it's authoring, and a user can hand the agent an existing template file mid-conversation for the agent to attach — no manual upload hand-off for either path | FILE-01 | 4 | SEED-104 (promoted from Phase 137.2's live SC#4 UAT, the motivating consumer); new WRITE-capable tool (`attach_skill_file`) — needs its own threat model + SC#10 proof; reuses existing `skill_files` table/bucket (no new storage surface); no hard dependency |

### Phase Checklist

- [x] **Phase 132: Skill Versioning + Eval Test-Case Persistence** — immutable version snapshots on save + persistent, editable eval test cases (VER-01, EVAL-01) — verified 2026-06-30
- [x] **Phase 133: Eval Runner — With-Skill vs Without-Skill** — SSE-streamed eval run, two completions per case, persisted results (EVAL-02) — verified 2026-06-30 (secured 2026-07-01, threats_open 0)
- [x] **Phase 134: Eval Results, Honest Verdict + Ratings** — per-provider verdict + side-by-side comparison + thumbs up/down preference signal (EVAL-03, EVAL-04) — verified 2026-07-02 (8/8 truths + 9/9 live SC#10 UAT; secure-phase pending)
- [x] **Phase 134.1: Evals Run Silently (bug fix)** — hide eval-execution threads from the chat sidebar; eval outputs stay DB-only in the eval panel (BUG-260702-01)
- [x] **Phase 135: Self-Improvement Loop (SI-01)** — propose instruction diff → human approve → new version → auto-re-eval gate (SI-01) — verified 2026-07-02 (5/5 truths + live SC#10 UAT U1-U11: 10 passed, 1 blocked third-party); secured 2026-07-03 (threats_open 0)
- [x] **Phase 136: Skill Publish Gate (GATE-01)** — publish blocked until an eval passes; future publishes only (GATE-01) — complete + secured 2026-07-03 (`d78e9778`)
- [x] **Phase 137: Skill Evals Panel UI (PANEL-01)** — sketch-gated consolidated Evals panel in the Skills UI (PANEL-01) — UAT 13/13 2026-07-04; secured 2026-07-04 (threats_open 0, `7850cf72`)
- [x] **Phase 137.1: Skill Eval Production-Clean (INSERTED)** — cross-provider smoke sweep + matrix runs + determinate progress + judge case_feedback + per-arm duration + judge-model knob + bug closures (EVAL-05 / SEED-100) — complete 2026-07-05 (10/10 plans); secured (threats_open 0, `0fd0babb`) + validated (Nyquist; backend 120 / frontend 60 green, `f794eae4`) + UAT 9/9 (`dfc1be2c`)
- [ ] **Phase 137.2: Skill Creator Reborn — Built-in + Protected (INSERTED)** — seeded read-only platform-native skill-creator, Built-in badge, cloud deploy parity (CREATE-01 / SEED-101) — 4 plans (planned 2026-07-05)
- [x] **Phase 138: Run-End Honesty (STRETCH)** — honest baseline-file + open-todo run finalizer (RUN-01) — complete 2026-07-06 (5/5 plans; RUN-01a + RUN-01b backend + 138-04 fetch-on-terminal live-surfacing; live-verified Scenario B ×2 via Chrome MCP + psycopg2; closes SEED-094)
- [x] **Phase 139: Self-Improve Proposer — Description-Only (STRETCH)** — description-only diff → human approve → new version (SI-02) — executed + review-fix wave 2026-07-06 (verification: human_needed — live 4-axis+G-4 UAT via /gsd:verify-work 139)
- [x] **Phase 140: Smart-Dispatch Relevance Pre-Filter (STRETCH)** — relevance-filtered, token-budgeted skill catalog (TRIG-02) — executed 2026-07-07 (5/5 plans; migration 091 applied live + 7 vectors backfilled; verification human_needed — live 4-axis SC#10 UAT via /gsd:verify-work 140; 0 regressions vs cb9fef39 baseline; code-review 0 critical / 3 advisory WR-01..03)
- [x] **Phase 141: template_input Resolver Run-Scope (STRETCH)** — run-scoped template_input resolution (COLL-02) — executed 2026-07-07 (3/3 plans; migration 092 `run_claim` applied live on :54322 + full-schema regenerated; claim-aware resolver Branch 2 filter/stamp/honest-error + both callers + emit `_ProducerStreamCtx` lineage; verification human_needed — D-141-07 cross-provider render SMOKE via /gsd:verify-work 141; 236 passed / 1 pre-existing unrelated fail; code-review 0 critical / 3 advisory WR-01..03)
- [ ] **Phase 142: Non-Python Skill-Script Honesty (STRETCH)** — honest "can't execute this skill type" signal (SRH-01)
- [ ] **Phase 143: Starter Workflow Library (STRETCH)** — fork-able is_global starter-workflow shelf (WF-01)
- [ ] **Phase 144: Agent-Driven Skill File Attachment (STRETCH)** — new `attach_skill_file` tool + endpoint so the agent can attach files it creates, and a user can hand it a template mid-chat (FILE-01, SEED-104)

### Phase Details

#### Phase 132: Skill Versioning + Eval Test-Case Persistence

**Goal**: A skill author can build a persistent, editable set of eval test cases for a skill, and every save of a skill's instructions captures an immutable version snapshot so eval history is traceable to the exact instruction state.
**Depends on**: Nothing (first v3.2 phase — the schema / persistence foundation)
**Requirements**: VER-01, EVAL-01
**Success Criteria** (what must be TRUE):

  1. Creating or updating a skill's instructions automatically captures an immutable version snapshot — the prior instruction state is preserved and a later edit never overwrites earlier version history (VER-01).
  2. A user can define a set of test cases for a skill (prompt + expected-behavior description) and save them, and the cases persist across sessions / survive reload (EVAL-01).
  3. A user can edit or delete a saved test case before any eval run, and the change persists (EVAL-01).
  4. Every test case and version snapshot is owner-scoped (same RLS model as skills) and an eval run is traceable to the exact skill version that produced it — a user never sees another user's cases (VER-01 + EVAL-01).

**Plans**: 3 plans

- [x] 132-01-PLAN.md — Migration 079: skill_versions + skill_test_cases tables, version-capture trigger, append-only + owner-only RLS, v1 backfill + live-DB apply (VER-01, EVAL-01)
- [x] 132-02-PLAN.md — Owner-scoped test-case CRUD router + read-only version-history GET + Pydantic models (EVAL-01, VER-01)
- [x] 132-03-PLAN.md — Thin non-designed test-case editor + version-history read mounted in skill detail panel (EVAL-01, VER-01)

#### Phase 133: Eval Runner — With-Skill vs Without-Skill

**Goal**: A user can launch an eval run that executes each test case both with the skill and without it, watch per-case progress stream live, and find the complete result set still there after reload.
**Depends on**: Phase 132 (test cases + version snapshots must exist to run an eval against)
**Requirements**: EVAL-02
**Success Criteria** (what must be TRUE):

  1. A user can start an eval run for a skill, and each test case is executed twice — once with the skill active and once without — producing two comparable completions per case (EVAL-02).
  2. Per-case progress streams live over SSE as the run executes, so the user watches the run advance case-by-case instead of waiting for one final result (EVAL-02).
  3. The full result set (per-case outputs, per provider) is persisted and remains readable after a page reload or restart (EVAL-02).
  4. The eval reuses the existing agent loop + provider gateway (no new runtime) and holds across providers, multi-tool prompts, parallel threads, and long histories — Deep Mode stays byte-identical (SC#10).

**Plans**: 5 plans (waves 1-4)

- [x] 133-01-PLAN.md — Migration 080 (eval_runs + eval_results) + Pydantic models [wave 1]
- [x] 133-02-PLAN.md — RunContext.skill_catalog_override additive field + Deep-byte-identical guard [wave 1]
- [x] 133-03-PLAN.md — eval_runner_service engine (drive run_agent_loop 2xN, no-op emit) + Wave 0 tests [wave 2]
- [x] 133-04-PLAN.md — evals.py router + companion runs row + main.py mount + integration tests [wave 3]
- [x] 133-05-PLAN.md — thin --skip-ui eval surface (reused run-stream client) [wave 4]

#### Phase 134: Eval Results, Honest Verdict + Ratings

**Goal**: After an eval run, the user can read an honest per-provider pass/fail verdict and a side-by-side with-skill vs without-skill comparison, and rate individual outputs to create a human preference signal.
**Depends on**: Phase 133 (results come from a run)
**Requirements**: EVAL-03, EVAL-04
**Success Criteria** (what must be TRUE):

  1. An eval run produces a per-provider pass/fail verdict the user can read, and a provider that errored shows an honest "errored / not measured" state — never a fabricated score (EVAL-03).
  2. The user can read a side-by-side comparison of the with-skill vs without-skill output for each test case (EVAL-03).
  3. The user can rate individual eval outputs with thumbs up/down, and the rating persists as a human preference signal (EVAL-04).
  4. The accumulated ratings are queryable as a signal the self-improvement loop (Phase 135) can consume (EVAL-04).

**Plans**: 4 plans

- [x] 134-01-PLAN.md — Migration 081: verdict columns + rollup columns + owner-scoped eval_ratings table [wave 1]
- [x] 134-02-PLAN.md — Verdict engine: reuse-judge grading of both arms vs expected_behavior, honest not_measured/judge_error, with-skill rollup, verdict SSE [wave 2]
- [x] 134-03-PLAN.md — Ratings endpoint (owner-verify IDOR gate + upsert/clear) + rating merge in get_eval_run [wave 3]
- [x] 134-04-PLAN.md — Thin read/rate surface: verdict line + side-by-side pass/fail + one-line reason + thumbs [wave 4]

**UI hint**: yes — functional read/rate surfaces; the consolidated, sketch-gated Evals panel is PANEL-01 (Phase 137).

#### Phase 134.1: Evals Run Silently (bug fix — inserted during 134 UAT)

**Goal**: Eval runs execute silently — the agent-loop execution thread they require is hidden from the chat sidebar, so evals never pollute the user's conversation list; the eval's user-visible outputs stay in the eval panel (eval_results), retrieved per run.
**Depends on**: Phase 133 (the eval runner that creates the execution thread)
**Requirements**: BUG-260702-01 (surfaced during Phase 134 UAT)
**Success Criteria** (what must be TRUE):

  1. An eval run's execution thread never appears in the chat sidebar (GET /threads excludes is_eval=true) — verified live: 303 returned, 0 [eval].
  2. Existing leaked eval threads are hidden (flagged, not deleted — transcript preserved for debugging).
  3. Real chat threads are unaffected (is_eval defaults false; additive narrowing filter on the G-5 hot file, no widened rows / no IDOR).

**Plans**: shipped inline (quick-style, GSD guarantees) — migration 082 + 2 one-line code edits + guard test

- [x] Migration 082 (threads.is_eval flag + backfill + partial index) — `b073cced`
- [x] `_create_eval_thread` marks is_eval + `list_threads` filter + guard test — `58ec1da6`

**Verification**: 14/14 eval tests pass; live GET /threads = 303 (was 337), 0 [eval]. See `.planning/phases/134.1-evals-run-silently/134.1-SUMMARY.md`.

#### Phase 135: Self-Improvement Loop (SI-01)

**Goal**: The system closes the loop — it proposes instruction-body edits from eval results + Tuner signal, the user reviews the diff and approves, a new immutable version is created and automatically re-evaled before promotion; the system never auto-applies.
**Depends on**: Phases 132, 133, 134 (needs versioning + runner + results + ratings)
**Requirements**: SI-01
**Success Criteria** (what must be TRUE):

  1. From an eval result + Tuner signal, the system proposes a concrete instruction-body edit as a reviewable diff — it never edits the live skill and never auto-applies (SI-01).
  2. The user reviews the proposed diff and explicitly approves or rejects it; on approval a new immutable skill version is created, on rejection nothing changes (SI-01 — human always in the loop).
  3. An approved new version is automatically re-evaled and the result gates promotion — a version that fails re-eval is surfaced as not-promoted with honest evidence (SI-01 auto-re-eval gate).
  4. The proposer + re-eval behavior holds across providers (reuses the existing gateway; SC#10) with no shared-path fork.

**Plans**: 9 plans across 4 waves (7 original + 2 gap-closure from 135-VERIFICATION.md)
Plans:
**Wave 1**

- [x] 135-01-PLAN.md — Migration 083: owner-scoped skill_proposals table (schema foundation) [wave 1]
- [x] 135-02-PLAN.md — Instructions-override seam (Pitfall #1 fix; Deep byte-identical) [wave 1]
- [x] 135-03-PLAN.md — Proposer service + evidence bundle (disagreement-first forced emission) [wave 1]
- [x] 135-06-PLAN.md — Frontend contracts: unified line-diff util + types + api helpers [wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 135-04-PLAN.md — Propose/get/reject routes + proposal models [wave 2]
- [x] 135-07-PLAN.md — Proposal card in SkillEvalSection (thin, 137-fenced) [wave 2]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 135-05-PLAN.md — Approve → re-eval → promotion gate + resilience (interrupted/force-promote) [wave 3]

**Gap closure** *(from 135-VERIFICATION.md — closes CR-01/CR-02/CR-03/WR-02 blocking gaps; runs in parallel, no file overlap)*

- [x] 135-08-PLAN.md — Backend: force-promote optional body (CR-01) + reconcile cross-worker liveness (CR-02) + approve except/revert & stale-approved self-heal (CR-03) + override draft-name key (WR-02) + tests [gap]
- [x] 135-09-PLAN.md — Frontend: force-promote empty body (CR-01) + string-guarded error detail (WR-04) + approved-status Reject escape (CR-03) [gap]

**UI hint**: yes

#### Phase 136: Skill Publish Gate (GATE-01)

**Goal**: A skill can only be published (made global / shareable) after at least one eval has run and passed; the publish flow surfaces this gate clearly and blocks (or warns with evidence) when unmet.
**Depends on**: Phase 134 (the gate consumes the eval pass/fail verdict)
**Requirements**: GATE-01
**Success Criteria** (what must be TRUE):

  1. Attempting to publish (make global / shareable) a skill with no passing eval surfaces the unmet gate with a clear status and blocks (or warns with evidence) (GATE-01).
  2. After at least one eval has run and passed, the same skill can be published and the publish flow shows the gate satisfied (GATE-01).
  3. The gate applies only to future publish actions — already-published skills are not retroactively gated (GATE-01 scope).

**Plans**: 4 plans across 3 waves
Plans:
**Wave 1**

- [x] 136-01-PLAN.md — Migration 084 (skill_publish_overrides) + gate read-model compute_publish_gate (D-03 rule / D-04 content-equality) + PublishGate/TogglePublishBody contracts [wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 136-02-PLAN.md — Server-side enforcement: gated toggle (409 + recorded override) + closed born-global create door (D-08) + GET publish-gate [wave 2]
- [x] 136-03-PLAN.md — Thin publish dialog + client contracts (getPublishGate / override toggle) + SkillCard share-intercept [wave 2]

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 136-04-PLAN.md — SkillEvalSection gate-status line + owner-visible override record (D-06/D-02) [wave 3]

**UI hint**: yes

#### Phase 137: Skill Evals Panel UI (PANEL-01)

**Goal**: The Skills UI gains a Skill Evals panel that consolidates the whole eval experience — test case editor, run history, run detail (side-by-side + pass/fail), inline ratings, and diff-viewable version history — without redesigning the rest of the Skills tab.
**Depends on**: Phases 132-136 (consolidates the full eval experience; PANEL-01 minimally needs EVAL-01..04 + VER-01, and lands last so it can also surface SI-01 version history + the publish-gate status)
**Requirements**: PANEL-01
**Success Criteria** (what must be TRUE):

  1. From the Skills UI, a user opens a Skill Evals panel for a skill that surfaces the test case editor (add/edit/delete cases), the eval run history list, and the per-run detail (per-case side-by-side outputs + pass/fail) (PANEL-01).
  2. The panel offers inline rating controls (thumbs up/down) on eval outputs in context (PANEL-01 + EVAL-04).
  3. The panel shows diff-viewable version history so a user can compare instruction versions (PANEL-01 + VER-01).
  4. The existing Skills tab layout is otherwise unchanged (the panel is an addition, not a redesign) and the panel matches the operator-approved sketch — the G-2 acceptance bar (PANEL-01).

**Plans**: 7 plans in 4 waves (planned 2026-07-03)
- [x] 137-01-PLAN.md — Shared 054-B LifecycleStepper (one status truth-teller; ⚡ collision honesty) [wave 1]
- [x] 137-02-PLAN.md — Versions tab: 056-B table + any-to-any compare diff + client-side version↔eval/proposal joins [wave 1]
- [x] 137-03-PLAN.md — Run display trio: RunCaseDetail + RunHistory (055-B expandable) + RunBar (D-12) [wave 1]
- [x] 137-04-PLAN.md — ProposalCard re-skin (D-08 honesty locks + D-09 post-run nudge) [wave 1]
- [x] 137-05-PLAN.md — EvalsTab + CaseEditor: lift the SkillEvalSection machinery, compose the leaves [wave 2]
- [x] 137-06-PLAN.md — Studio shell + reachability: skill-studio ActiveView, header/3 tabs, tuner absorbed, Open studio [wave 3]
- [x] 137-07-PLAN.md — Detail-panel slim-down + nav MAP: shared full stepper in panel, "Review evals →" [wave 4]
**UI hint**: yes — **G-2 sketch-gated** (sketches 053–057 winners = the acceptance bar).

#### Phase 137.1: Skill Eval Production-Clean (INSERTED 2026-07-04)

**Goal**: The eval engine becomes something an operator can trust without hand-running all 8 providers — every arm completes honestly on every configured provider, results carry cost/variance context, and the run experience reads clearly while running.
**Depends on**: Phases 133–137 (engine + Studio shipped); baseline-contamination root-cause fix `f47d6736` + judge evidence channel `dd694916` (shipped 2026-07-04).
**Requirements**: EVAL-05 (SEED-100 promoted — full history + operator asks recorded there)
**Success Criteria** (what must be TRUE):

  1. An automated cross-provider engine smoke sweep runs one representative model per configured provider (native-7 + OpenRouter; exclude local) × one case, asserting per-arm ENGINE health: each arm completes with verdict `graded` or an honest `not_measured` carrying a REAL provider error — never an engine-shaped error (EVAL-05a; SEED-100 ask #1).
  2. A matrix run fans one skill's eval across N providers as N parallel run rows with explicit gate semantics (which run feeds the publish gate) and a multi-run live UI; per-config aggregation reports mean ± stddev + delta where run counts allow, with analyst-style annotations (non-discriminating case / flaky variance / time-token tradeoffs) (EVAL-05b; SEED-100 ask #4 + SEED-101 harvest).
  3. A running eval shows determinate progress (units = cases × 2 arms + judge step) instead of an indeterminate spinner (EVAL-05c; SEED-100 ask #3).
  4. The judge can flag weak/non-discriminating test cases (`case_feedback`, surfaced per-case, never blocking) and per-arm wall-clock duration is captured alongside tokens (EVAL-05d/e; SEED-101 harvest).
  5. The judge model is selectable in Settings (single-provider/local-model orgs unblocked); BUG-260701-01 is re-tested post-`f47d6736` (fix at the gateway/adapter boundary if still live — D-14); BUG-260702-02 restart reconciliation closes orphaned `running` runs honestly (EVAL-05f/g).
  6. The judge evidence channel's new prompt surface (tool receipts as judge input) is formalized in the phase threat model — rubric data-posture + 4KB cap named as mitigations (EVAL-05h).
  7. Folded SEED-100 harvest extras (discuss-phase 2026-07-04, CONTEXT D-13): description-builder 1024-char cap + auto-shorten retry, and additive lint warnings (kebab-case name + description length, never blocking); the Tuner failure-feedback iteration mode is explicitly OUT.

**UI hint**: yes — matrix-run rows + determinate progress are new UI → **G-2 sketch proposed at discuss-phase** (extend the 053–057 Studio language; RunHistory/RunBar are the existing homes).
**Guardrail note**: G-1 does not fire (first 137.x insert). D-14 red line: all provider fixes at the gateway/adapter/sanitizer boundary; the shared agent-loop path is never forked.
**Plans:** 10 plans (planned 2026-07-04, revised same day per plan-checker) — 5 waves
- [x] 137.1-01-PLAN.md — Contracts & migration 085 (matrix/gate/duration/case_feedback columns + nullable skill FKs for the skill-less sweep + JudgeVerdict field + TS types + api fns) [W1, autonomous:false — BLOCKING SQL apply]
- [x] 137.1-02-PLAN.md — Eval runner: per-arm duration timer + advisory case_feedback capture + NULL-tolerant persist for sweep arms (EVAL-05d/e/h) [W2]
- [x] 137.1-03-PLAN.md — Boot-time run reconciler (eval→interrupted, chat→failed) + lifespan mount (EVAL-05g / BUG-260702-02) [W1]
- [x] 137.1-04-PLAN.md — Matrix launch + skill-less engine smoke-sweep + GET engine-health board routes (one group claim, one gate-feeder) (EVAL-05a/b) [W3]
- [x] 137.1-05-PLAN.md — Judge-model settings API (registry-validated) + D-13 extras (kebab lint + 1024 cap) (EVAL-05f) [W1]
- [x] 137.1-06-PLAN.md — Provider bug re-tests (BUG-260701-01 / -260630-01) + conditional adapter-boundary fixes (EVAL-05g / D-14) [W1, autonomous:false]
- [x] 137.1-07-PLAN.md — Deterministic aggregation (mean±σ/Δ over history) + analyst-note rules + owner-scoped endpoint (EVAL-05b) [W4]
- [x] 137.1-08-PLAN.md — Studio matrix launch + live grouped card + determinate unit bar (058-A/059-A) [W4]
- [x] 137.1-09-PLAN.md — Aggregation footer + analyst notes + inline violet case_feedback + duration (058-A/059-A) [W5]
- [x] 137.1-10-PLAN.md — Settings Engine-health tile board + registry-only judge-model picker (060-A) (EVAL-05a/f) [W4]

#### Phase 137.2: Skill Creator Reborn — Built-in + Protected (INSERTED 2026-07-04)

**Goal**: Every user, on every environment, has a built-in skill-creator that teaches the agent to run OUR skill lifecycle conversationally — and that skill is read-only, undeletable, and deploy-safe. Closes the operator's "match Claude.ai's skill-creator to our app" ask via SEED-101's full capability matrix (every zip file studied and dispositioned).
**Depends on**: Phase 137.1 preferred first (the instructions reference matrix runs/progress being trustworthy) — soft dependency, can swap if 137.1 stalls; the 132–137 Studio (hard, shipped).
**Requirements**: CREATE-01 (SEED-101 — capability matrix + red lines)
**Success Criteria** (what must be TRUE):

  1. An idempotent seed migration installs the `skill-creator` skill (system-user-owned, `is_global=true`), superseding the stale 018 content; the seed reaches cloud via a documented deploy-parity entry (data seeds are NOT in `full-schema.sql`) (CREATE-01).
  2. The built-in skill is read-only and undeletable through all app paths for non-owners (existing owner-scoping verified end-to-end) and renders a "Built-in" badge in the Skills UI (CREATE-01).
  3. Its instructions are platform-native per SEED-101: interview/intent-capture → RAG research (`search_documents`) → `save_skill` draft with writing-craft guidance (imperative, explain-the-why, pushy-but-honest description, generalize-don't-overfit) → propose eval cases → eval run + honest verdict → proposals loop + Trigger Tuner → publish gate; it never claims capabilities the runtime lacks (no subagents/browser/`claude -p`; Python-only sandbox — SEED-096 honesty) (CREATE-01).
  4. A live conversational walkthrough ("help me create a skill for X") reaches a saved, eval-tested skill using only what the instructions teach — the lived-experience acceptance bar (G-4).
  5. The shipped 132–137 surfaces and the shared agent-loop path are untouched (additive-only; D-14).

**UI hint**: minimal (Built-in badge + any list ordering) — G-2 not expected to fire beyond a badge decision; confirm at discuss-phase.
**Guardrail note**: operator's manual skill-creator copy is offered a cleanup/rename after the built-in lands — operator decision, never auto-deleted.

**Plans**: 4 plans (planned 2026-07-05) — Wave 1 (3 parallel) + Wave 2 (1 gated apply)
Plans:
**Wave 1** *(parallel — disjoint files)*

- [x] 137.2-01-PLAN.md — Backend `is_system` contract: output-only `SkillResponse` field + pin-to-top `list_skills` order (D-05) + Wave 0 tests (CREATE-01) [wave 1]
- [x] 137.2-02-PLAN.md — Migration 087: additive `is_system` column + superseding platform-native skill-creator seed (D-02/D-03) + deploy-parity docs (CREATE-01) [wave 1]
- [x] 137.2-03-PLAN.md — Frontend: `is_system` wire type + "Built-in" pill (D-01) + `SkillCard.test.tsx` (CREATE-01) [wave 1]

**Wave 2** *(gated — blocked on Wave 1)*

- [x] 137.2-04-PLAN.md — [BLOCKING] apply migration 087 to the live DB + regenerate `full-schema.sql` + one-off rename of the operator's manual copy (D-04) (CREATE-01) [wave 2, autonomous:false]


#### Phase 138: Run-End Honesty (STRETCH)

**Goal**: A run ends honestly — baseline files seeded at run start don't appear as dead "Download unavailable" cards, and open todos are marked "ended with open todos" instead of silently auto-completed.
**Depends on**: Nothing hard (backend-only, small — the safest STRETCH to pull forward; touches the `agent_loop.py` finalizer). Gated behind CORE.
**Requirements**: RUN-01
**Success Criteria** (what must be TRUE):

  1. Baseline files seeded at run start no longer appear as dead "Download unavailable" cards in the run's final output files (RUN-01a).
  2. When a run ends with open todos, a run-end reconciler marks them "ended with open todos" — never silently auto-completed (RUN-01b).
  3. The change is additive and shared-path-safe — Deep Mode stays byte-identical (red line).

**Plans**: 5 plans (3 original + 2 gap-closure — RUN-01b live-surfacing)

**Wave 1** *(parallel — disjoint files)*

- [x] 138-01-PLAN.md — RUN-01a: filter the final_output_files emit to content-hashes genuinely new to the run (agent_loop.py accumulator + tool_dispatcher.py field); baseline/leftover files no longer leak (D-07/D-08) [wave 1]
- [x] 138-02-PLAN.md — RUN-01b: net-new reconcile_open_todos_on_run_end() in todos_service.py wired at BOTH clean-completion finalizers in threads.py (two-clause cap gate at _shielded_finalize, plain gate at the continuation site); marks open todos honestly, never auto-completes (D-01..D-06, LOCK-1/LOCK-2) [wave 1]

**Wave 2** *(gated — blocked on Wave 1)*

- [x] 138-03-PLAN.md — [CHECKPOINT] operator live-verifies both fixes + cap_paused negative + Continue positive + Deep red-line + cross-provider spot check; found RUN-01b live-surfacing gap (marker not shown live at run-end) → gap closure (RUN-01) [wave 2, autonomous:false]

**Gap closure** *(RUN-01b live-surfacing — Scenario B failed 138-03; backend correct, frontend never reconciled the todos panel at run-terminal)*

- [x] 138-04-PLAN.md — Frontend fetch-on-terminal: shared `_reconcileTodosOnTerminal(threadId, kind)` helper wired into BOTH StreamsProvider onTerminal handlers (clean-completion gated), reusing getThreadTodos + replaceTodosForThread so the `(run ended — not completed)` marker surfaces LIVE at run-end with no refresh; additive-only on the G-5 file + Vitest (D-v2.5-03, RUN-01) [wave 1]
- [x] 138-05-PLAN.md — [CHECKPOINT] operator live re-verifies Scenario B (marker surfaces live at run-end, no refresh; browser matches DB via psycopg2) + D-14 red line + cross-provider spot check; closes SEED-094 (RUN-01) [wave 2, autonomous:false]

#### Phase 139: Self-Improve Proposer — Description-Only (STRETCH)

**Goal**: A bounded, human-in-the-loop description-only proposer drafts a description diff → human approves → new immutable version; no instruction-body edits.
**Depends on**: Phase 135 (SI-01 eval/versioning substrate). Gated behind CORE.
**Requirements**: SI-02
**Success Criteria** (what must be TRUE):

  1. The proposer drafts a description-only diff (no instruction-body edits) as a DRAFT — it never auto-publishes and never edits a live skill description (SI-02).
  2. A human reviews and approves the description diff; on approval a new immutable version is created, on rejection nothing changes (SI-02).
  3. The proposal reuses the SI-01 substrate and the cross-provider scoreboard, holding across providers (SC#10) (SI-02).

**Plans**: 5 plans across 2 waves (planned 2026-07-06)
Plans:
**Wave 1** *(parallel — disjoint files: backend contracts vs frontend contracts)*
- [x] 139-01-PLAN.md — Migration 090 (skill_proposals kind discriminator + proposed_description + scoreboard_snapshot + provenance source_tuner_run_id FK + kind-gated CHECK) + extended SkillProposalResponse/ProposeDescriptionBody (SI-02) [wave 1]
- [x] 139-04-PLAN.md — Frontend contracts: extended SkillProposal type + proposeDescription/approveDescription/rejectDescription wire fns (SI-02) [wave 1]

**Wave 2** *(gated — blocked on Wave 1)*
- [x] 139-02-PLAN.md — Description propose/approve/reject routes in evals.py (honest-winner gate → 400 baseline-wins, inline scoreboard snapshot, synchronous trigger-versioned approve — no re-eval/SSE, never grow threads.py) + integration tests (SI-02) [wave 2]
- [x] 139-03-PLAN.md — [BLOCKING] apply migration 090 to live DB (SQL editor/psycopg2, never db push) + regen full-schema.sql + DB-CHECK test (SI-02) [wave 2, autonomous:false]
- [x] 139-05-PLAN.md — DescriptionProposalCard (lineDiff + ProviderScoreboard, Approve/Reject only) + repoint SkillTunerPage one-click apply → "Propose this description" + CandidateCard re-label (D-08) (SI-02) [wave 2]
**UI hint**: yes

#### Phase 140: Smart-Dispatch Relevance Pre-Filter (STRETCH)

**Goal**: Only plausibly-relevant skills are surfaced to the model for a given query, keeping the active skill catalog within a configurable token budget.
**Depends on**: Phase 123 CTX-03 pin substrate (shipped in v3.1). Gated behind CORE.
**Requirements**: TRIG-02
**Success Criteria** (what must be TRUE):

  1. For a given user turn, only skills that pass a relevance pre-filter are surfaced to the model — clearly-irrelevant skills are not injected (TRIG-02).
  2. The injected skill catalog stays within a configurable token budget even as the user's skill count grows (TRIG-02).
  3. A genuinely-relevant skill is never starved (a should-trigger skill still reaches the model), verified cross-provider (SC#10) (TRIG-02).

**Plans**: 5 plans
**Wave 1** *(parallel — disjoint files)*
- [x] 140-01-PLAN.md — Migration 091: skill_embeddings sibling table + owner-only RLS + 2 mark-stale triggers + match_skills cosine RPC (byte-exact catalog scope) + skill_catalog_max_tokens app_settings column + DB-CHECK scaffold (TRIG-02) [wave 1]
- [x] 140-02-PLAN.md — skill_embedding_service.py: build_skill_embed_source (D-01 signal set) + reembed-shaped backfill job (stale-only, user_id hand-scope, threadpool embed, non-destructive, fail-open) (TRIG-02) [wave 1]
- [x] 140-03-PLAN.md — Budget knob (config + user_settings, bounds-checked resolver) + pure build_skill_catalog_block trim fn + _CATALOG_TRIM_MARKER + pin-scan + DB-free unit tests (SC#1/SC#2/SC#3/D-05) (TRIG-02) [wave 1]

**Wave 2** *(gated — shares agent_loop.py; imports Plan 02 self-heal kick + Plan 03 trim fn + Plan 01 RPC)*
- [x] 140-04-PLAN.md — Hot-path wiring inside the skill_catalog_override-None branch only (fits->byte-identical no-embed fast path; over-budget->threadpool embed + match_skills + pure trim; fail-open; D-06 eval seam untouched) + extend override seam test + escape-hatch verification (TRIG-02) [wave 2]

**Wave 3** *(gated — [BLOCKING] apply, autonomous:false)*
- [x] 140-05-PLAN.md — [BLOCKING] apply migration 091 to live LOCAL DB (SQL editor, never db push) + one-time skill-vector backfill + regen full-schema.sql (no reset) + cloud deploy-parity checklist (TRIG-02) [wave 3, autonomous:false]

#### Phase 141: template_input Resolver Run-Scope (STRETCH)

**Goal**: The `template_input` resolver is scoped to the current run — a template uploaded in one run is not visible or accessible in another.
**Depends on**: Phase 120 COLL-01 run-scope seam (shipped in v3.1). Gated behind CORE.
**Requirements**: COLL-02
**Success Criteria** (what must be TRUE):

  1. The `template_input` resolver only resolves inputs scoped to the current run — a template uploaded in one run is never visible or accessible in another run's `render_template` (COLL-02).
  2. The `render_template` happy path is unchanged for in-scope inputs — no regression (COLL-02).

**Plans**: 3 plans

- [x] 141-01-PLAN.md — Claim contract: migration 092 run_claim column + pure helpers (claim_visible / own_claim_for_ctx) + RED test backstop [wave 1]
- [x] 141-02-PLAN.md — Resolver Branch 2 claim filter + stamp + honest foreign-claim error, both Branch-2 callers, _ProducerStreamCtx workflow_run_id stamp (Landmine 2) [wave 2]
- [x] 141-03-PLAN.md — [BLOCKING] apply migration 092 to live LOCAL DB (psycopg2 :54322, never db push) + regen full-schema.sql (no reset) + commit + cloud-parity note [wave 3, autonomous:false]

#### Phase 142: Non-Python Skill-Script Honesty (STRETCH)

**Goal**: When a skill's script is non-Python, the agent surfaces an honest "cannot execute this skill type" signal instead of silently failing or narrating the code as if it ran.
**Depends on**: Phase 120 (off the COLL-01 seam, shipped in v3.1); DISC-01 Layer 1 / SEED-044. Gated behind CORE.
**Requirements**: SRH-01
**Success Criteria** (what must be TRUE):

  1. Importing a skill that bundles a non-Python script (e.g. `.js`) still succeeds, and the user sees an honest message that the skill includes a step the sandbox can't run yet while its instructions still work (SRH-01).
  2. When the agent would run a non-Python skill script, it fails cleanly with a specific message instead of silently running it as Python or narrating it as if it executed (SRH-01).
  3. (Optional) `read_skill_file` can return a bundled non-Python file as reference text without implying it can be executed (SRH-01).

**Plans**: 5 plans (3 waves)
- [x] 142-01-PLAN.md - runtime-gap classifier + shared honesty constants (KNOWN_MISSING / GAP_MESSAGES / SCRIPT_EXTS); T-142-01 pass-through negative [wave 1]
- [ ] 142-02-PLAN.md - reactive reshape + per-run repeat-guard + run-scope threading (SC#2, D-06, D-03 loop-cap) [wave 2]
- [ ] 142-03-PLAN.md - skill-file read honesty: decode whitelist + load_skill flag (SC#3/D-11, D-05b) [wave 3]
- [x] 142-04-PLAN.md - proactive capability facts on the execute_code tool schema (D-05a, D-14-safe) [wave 1]
- [ ] 142-05-PLAN.md - import-time honesty note + frontend render (SC#1/D-08, D-09) [wave 2]
**Scope note (operator, 2026-06-29 — SEED-096):** broaden the honest "can't execute this" signal to fire on ALL "runtime can't do this" cases — **missing bundled file (G-A: bundle-tree flatten)** and **missing system binary (G-C: pandoc/LibreOffice/Poppler)** — not only non-Python scripts (G-B). Worked example: Anthropic's `docx` skill triggers but is inert (its all-Python edit path can't resolve `scripts/office/*.py` because import + sandbox injection flatten the nested tree). The CAPABILITY fix (real tree-fidelity + Node + binaries) is OUT of 142 → DISC-01 / v3.3+. Pull SEED-096 into discuss-phase 142.

#### Phase 143: Starter Workflow Library (STRETCH)

**Goal**: A curated set of fork-able starter workflows is available on the Workflows page as an `is_global` published shelf — users fork a starter into a personal draft instead of starting from a blank description.
**Depends on**: Nothing hard (the Workflows page + workflow primitives already exist); SEED-084. Gated behind CORE.
**Requirements**: WF-01
**Success Criteria** (what must be TRUE):

  1. The Workflows page shows a curated shelf of `is_global` published starter workflows (WF-01).
  2. A user can fork a starter into a personal draft and edit it without affecting the published starter (WF-01).
  3. The starters are authored on the existing generic primitives — no new runtime (red line) (WF-01).

**Plans**: TBD
**UI hint**: yes

#### Phase 144: Agent-Driven Skill File Attachment (STRETCH)

**Goal**: The agent can attach files it creates (scripts, generated config/style assets) directly to the skill it's authoring — no manual "please upload this" hand-off — and a user who hands the agent an existing template file mid-conversation gets it attached to the skill being built, not stranded in general workspace scratch.
**Depends on**: Nothing hard (the `skill_files` table + `skill-files` storage bucket already exist from the core skills system). Phase 137.2's skill-creator is the motivating consumer — its live SC#4 UAT is what surfaced this gap (SEED-104). Gated behind CORE.
**Requirements**: FILE-01
**Success Criteria** (what must be TRUE):

  1. A new agent tool (e.g. `attach_skill_file`) lets the agent write a file directly into the skill's own `skill_files` storage — not `workspace_write`'s general scratch area — so `read_skill_file` can find it in any later thread (FILE-01).
  2. A user can hand the agent an existing file (template, reference doc, script) during a skill-creation conversation, and the agent attaches it to the skill being authored, without a separate pre/post-chat upload step (FILE-01).
  3. The new tool/endpoint reuses the existing `skill_files` table + `skill-files` storage bucket and stays owner-scoped (same RLS model as every other skill-file path) — no new storage surface (FILE-01).
  4. Proven across representative providers (SC#10) — a net-new WRITE-capable tool needs the same cross-provider tool-use rigor (arg shape, error handling) as any other tool_dispatcher addition.

**Plans**: TBD
**Scope note (SEED-104, 2026-07-05):** distinct from SEED-096 (bundle-tree fidelity / execution capability — can a skill's own bundled scripts run) — this phase is about attachment capability (can the agent or user get a file INTO a skill's storage at all during authoring). Needs its own threat model at discuss-phase (new write path), per the project's security-review discipline — this is exactly the kind of surface the operator deliberately deferred out of Phase 137.2 rather than rush in mid-verification.

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 132. Skill Versioning + Eval Test-Case Persistence | 3/3 | Complete | 2026-06-30 |
| 133. Eval Runner — With-Skill vs Without-Skill | 5/5 | Complete | 2026-06-30 |
| 134. Eval Results, Honest Verdict + Ratings | 4/4 | Complete | 2026-07-02 |
| 135. Self-Improvement Loop (SI-01) | 9/9 | Complete | 2026-07-02 |
| 136. Skill Publish Gate (GATE-01) | 4/4 | Complete | 2026-07-03 |
| 137. Skill Evals Panel UI (PANEL-01) | 0/TBD | Not started | - |
| 138. Run-End Honesty (STRETCH) | 5/5 | Complete | 2026-07-06 |
| 139. Self-Improve Proposer — Description-Only (STRETCH) | 5/5 | Complete | 2026-07-06 |
| 140. Smart-Dispatch Relevance Pre-Filter (STRETCH) | 5/5 | Complete | 2026-07-07 |
| 141. template_input Resolver Run-Scope (STRETCH) | 3/3 | Complete | 2026-07-07 |
| 142. Non-Python Skill-Script Honesty (STRETCH) | 0/5 | Planned | - |
| 143. Starter Workflow Library (STRETCH) | 0/TBD | Gated (behind CORE) | - |
| 144. Agent-Driven Skill File Attachment (STRETCH) | 0/TBD | Gated (behind CORE) | - |

### Guardrails firing (v3.2)

- **G-2 sketch-first — Phase 137 (PANEL-01).** Live Skill Evals panel / "feels like" surface → `/gsd:sketch` before `/gsd:spec-phase` / `/gsd:discuss-phase`; the operator-approved mockup is the acceptance bar. The `sketch-findings-agentic-rag` skill already names the Skills surfaces — extend it for the Evals panel.
- **G-5 hot files (audit at discuss-phase).** `backend/app/api/threads.py` (firing → extraction STILL due — do NOT grow it; the eval runner (133) + SI-01 (135) must be net-new routers, `skill_tuner.py` precedent, consuming `agent_loop.py` + the provider gateway READ-ONLY). `backend/app/services/agent_loop.py` (RUN-01 / 138 touches the finalizer/terminal path; TRIG-02 / 140 touches the catalog-injection path; 133/135 consume it read-only). The catalog injection path + `context_window.py` token budget (TRIG-02 / 140).
- **SC#10 cross-provider mandate.** Flagged on every phase touching streaming / agent loop / provider routing / UI state — headline three EVAL-02 (133), SI-01 (135), TRIG-02 (140), plus the per-provider-display / UI-state phases 134, 137, 139. UAT rows = cross-provider × multi-tool × parallel-thread × long-message, authored under VALIDATION.md.
- **Red line (D-14).** Never fork the shared path — provider differences stay at the gateway/adapter/sanitizer boundary. Deep Mode byte-identical; no new eval runtime (evals reuse the agent loop + provider gateway).
- **Reported-bugs.** RUN-01 (138) closes SEED-094 (BUG-260626-02 baseline leak into live final-emit + BUG-260626-03 run-end todo finalizer), the two run-honesty items deferred from Phase 123.

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
