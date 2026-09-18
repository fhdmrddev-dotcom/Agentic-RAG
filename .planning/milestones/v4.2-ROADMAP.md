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
- ✅ **v3.7 Workflow Product Completion** — Phases **192-200.3** (shipped 2026-08-24). 17 phases (CORE 192-198 + inserts 192.1, 192.2, 193.1, 193.2, 194.1, 199, 200, 200.1, 200.2, 200.3), 147 plans, 20/20 requirements satisfied. Full archive in `.planning/v3.7-MILESTONE-AUDIT.md`.
- ✅ **v3.8 Document Intelligence, Automations & Connectors** — Phases **201-209** (shipped 2026-08-26, git tag `v3.8`). 12 phases, 17 plans, migrations 124-126, 3 days. **11/11 requirements delivered.** Structured tables and email became first-class ingestion; workflows run unattended on a schedule with a brake that really stops work; a run can read its own prior run; and a workflow reaches any official MCP server with per-tool consent and **zero per-vendor adapter code**. ⚠ Closed `gaps_closed_partial` — three requirements are narrower than their wording and are carried with re-open triggers ([`audit`](milestones/v3.8-MILESTONE-AUDIT.md)).
- ✅ **v3.9 Connections: Any Service, Any Tool** — Phases **210-227** (shipped 2026-09-04, git tag `v3.9`). 16 phases (210-217 CORE + inserts 214.1 / 217.1 + 220-227; **218 absorbed** into 217.1; **219 deferred**), **111 plans**, migrations **127-129 / 140-141 / 150-152**, 9 days. **34/39 requirements delivered · 3 partial · 2 shipped-but-never-driven.** A connection became `{service identity, auth, discovered tools, per-tool grants}` — so adding a service adds **rows, not code**: Notion connects by OAuth with no developer console and returns **41 tools for zero lines of tool code**, and six Google applications sit under one token with **11/11 live writes**. Per-tool grants, an approval moment that stops a real run, an audit receipt per outbound call, connections usable by name in chat, and the Library as one home for documents. ⚠ **Phase 219 DEFERRED to the Connected Knowledge milestone** with `LIB-08/09/10` and `SEED-209/210/211/212` — its SC#1 *“watched on a schedule”* IS this milestone's own binding security re-open trigger ([`audit`](milestones/v3.9-MILESTONE-AUDIT.md)).
- ✅ **v4.0 Connected Knowledge** — Phases **228-241** (shipped 2026-09-10, git tag `v4.0`). 14 phases, **62 plans**, migrations **153-156 / 166-176**, 6 days. **33/38 requirements delivered · 5 ⛔ not ticked** (`SRC-03` Azure-blocked · `QUEUE-06` remedy shipped but the DEFAULT is unchanged · `SURF-03` home still an open decision · `DEBT-03` ultra ruled out · `DEBT-04` gated on a production push). The knowledge base stopped depending on somebody remembering to upload: a source is connected **once**, previewed before it brings anything in, and then watched on the **shipped** scheduler. Four families as thin adapters over ONE contract — Google Drive · OneDrive/SharePoint via Graph · **any** MCP file server · mail — with **239 proving zero-code by HASH** against GitHub MCP and **240 proving mail is a SHAPE, not a fourth adapter** (`sources/base.py` byte-identical). Connection-scoped visibility at all four RLS sites, a durable queue with cap/retry/resume, and the anti-injection discipline **actually attacked** (13/13 refused · 8/8 mutations caught · live drive refused by 8/8 native providers). ⚠ **241 measured a REAL recall defect at customer scale** — `recall@20` **0.040** at the shipped `ef_search = 40`, a **cliff not a slope**. ⛔ **238, 240 and 241 closed WITHOUT an independent §6.3 review**; two UAT sets owed on credentials ([`audit`](milestones/v4.0-MILESTONE-AUDIT.md)).
- ✅ **v4.1 Ship It & Feel It** — Phases **242-246** (shipped 2026-09-13, git tag `v4.1`). 5 phases, **25 plans**, migrations **177-180**, 3 days. **18/19 requirements delivered · 1 ⛔ unmet BY MEASUREMENT.** A deliberate **CONSOLIDATION** milestone — no new capability axis; every requirement closed something already in a register. The ship claims closed against the **database and the branch** rather than the deploy record; the chat surface stopped getting in the way (follow-scroll driven with a **real wheel** — 0 px drift, closing `BUG-260823-01` after two fixes that had passed on synthetic events; all five `SHELL` criteria driven in a browser); and v4.0's verification debt got **written verdicts** plus a greppable marker so a self-verification can no longer read as a review. ⭐ **Its best work is the requirement it did NOT deliver:** 246 proved by `EXPLAIN (ANALYZE)` that no `hnsw_ef_search` value fixes the small-tenant recall cliff through the index — every index walk returns **ONE row**, every good recall figure is a **~1.1 s sequential scan** — so the 200 default was **refused and reverted to 40**, with `RECALL-01` left open on `SEED-273`. ⭐ 246 is also the **first peer-reviewed phase since `OV-SOLO-01` was re-armed**. ⚠ Migrations **179/180 are not in cloud** and `production` is **287 commits behind**, so v4.1's own output is undeployed ([`audit`](milestones/v4.1-MILESTONE-AUDIT.md)).
- 🚧 **v4.2 The Connected Knowledge You Can Actually Run** — Phases **247-251** (started 2026-09-13). **26 requirements in 6 categories**, 25 of them mapped to five phases and `DEBT-06` held as a **milestone-wide standing gate**. ⚠ **The bullet above is CORRECTED, not rewritten: its closing claim — *"migrations 179/180 are not in cloud and `production` is 287 commits behind, so v4.1's own output is undeployed"* — was true when written and is now FALSE.** Measured at this scoping: `production` moved `e65610ac2 → eebc4c42f` (**292 commits**), `production..develop` is **0**, migrations **179 and 180 are applied and verified in cloud** (177/178 measured **already present** — `scripts/pending-cloud-migrations.sh` diffs git refs, not the live database, and over-reported by two), and `get_advisors(security)` returns **zero ERROR findings**. **v4.1 IS deployed.** v4.2 is therefore the SECOND consecutive **consolidation** milestone — no new capability axis, every requirement closes something already in a register, and each was **DRIVEN against the tree on 2026-09-13 rather than read from a `status:` field**, a method that caught three wrong register entries (two stale toward *"still broken"*, one toward *"fine"*). Watch-loop honesty (247) · the credential boundary (248) · the model you actually run (249) · run-honesty residue (250) · register integrity (251). **v4.2 opens on deployed code for the first time in three milestones.**

---

## v4.2 The Connected Knowledge You Can Actually Run — IN PROGRESS (started 2026-09-13)

**5 phases** (247-251, no inserts planned), **26 requirements** in 6 categories.
**Scope source:** `.planning/REQUIREMENTS.md` · **scoping record:** `PROJECT.md` → *Current Milestone: v4.2*.
**Numbering continues at 247** — v4.1 ended at 246; nothing resets.
**Migration head at open = `180`; next free slot = `181`** (expected in 248 only; 247/249 may need one, 250/251 should need none).

**Goal:** the capability v4.0 built and v4.1 deployed becomes the surface you can **live on** — the watch
loop tells the truth, a credential cannot land in a readable column, and the model you want to run
registers itself.

### Two facts carried in, so they are not rediscovered

⭐ **v4.1 IS DEPLOYED as of 2026-09-13.** `production` = `eebc4c42f`, **0 behind `develop`**, all
migrations **through 180 applied and verified in cloud**, `get_advisors(security)` returns **zero ERROR
findings**. This is the state v4.1 existed to reach and v4.0 never reached — **v4.2 is the first
milestone in three to open on deployed code.** Every *"cloud is N migrations behind"* sentence
inherited from a v4.0 / v4.1 register is stale; re-derive before quoting one.

⚠ **The UAT ledger moved with that promotion, and it moved in BOTH directions:**

- **242's UAT row 5 is now UNBLOCKED and OWED** — the production promotion **was its trigger**. It is a
  real owed row, not a closed one, and it belongs in the first phase close that can carry it.

- **241's UAT row 5 is EXPIRED, NOT OWED** — it needed a read-capable cloud DSN to prove an arm that
  **migration 176 already being in cloud makes unreproducible.** ⛔ Do not plan it, do not carry it as
  debt, and do not let a future audit re-open it as *"never run"*: it is **retired by measurement**.

### Known shape-risk, stated at scoping rather than discovered later

⚠⚠ **THIS IS THE SECOND CONSECUTIVE CONSOLIDATION MILESTONE, AND THE RISK COMPOUNDS RATHER THAN
FADES.** v4.1 named it in writing — *"a consolidation milestone has no natural stopping point; every
register it opens contains more than it can close"* — **and then ran 17 plans for 4-6 plans of
substance anyway.** The registers are larger now (27 open `surface: Agentic-RAG` bugs, 161 planted
seeds of 280, a 23-item operator queue), and `SEED-013` / `SEED-195` (Open Platform, reserved as
**v5.0**) has now been deferred **twice**; a third deferral needs a written reason, not silence.

⚠ **G-8 IS THE GOVERNOR OF THIS MILESTONE, more than on any capability milestone.**

- **Target 3-5 plans per phase.** Above **6**, CONTEXT.md must name what genuinely **cannot share a
  worktree** — adjacency is not a reason for a second plan.

- A bug that is **≤ 1 file / ≤ 10 lines with no schema or API surface is `/gsd:fast` under G-3, never a
  plan.** Several requirements here are explicitly that shape (`WATCH-06`, `WATCH-07`, plausibly
  `MODEL-07`), and counting them as plans is how 4-6 becomes 17.

- ⛔ **Never cut to save time:** the verifier, TDD RED drives, `security_enforcement` / `code_review`,
  migration discipline. **The lever is plan COUNT, never the agent roster.**

⚠ **`retrieval_service.py`'s G-5 extraction has been owed since Phase 231, and Phase 241 was the
deliberate SECOND landing.** No phase here is expected to touch it — **but if one does, the extraction
must be PROPOSED FIRST** (`SEED-224`), before the change that would be its third landing.

⚠ **G-5 generally: read `docs/HOT-FILE-LEDGER.md` at discuss-phase, not the CLAUDE.md table.** The
CLAUDE.md rows carry the verdict only; the named seam and the binding invariants live in the detail
file, and `node scripts/check-hot-file-ledger.cjs <phase>` is what actually enforces a row's existence.
Per-phase likely collisions are named in the Flags column below.

### DEBT-06 — a standing gate across the whole milestone, not a phase

`DEBT-06` is the only requirement **not** mapped to a phase, deliberately. It is a gate that runs
**alongside** the build rather than a bucket of work, and it discharges at these points:

| When | What discharges it |
|---|---|
| At each v4.2 phase close (247-251) | The phase's own §6.3 independent review runs **before** the phase is marked complete. `OV-SOLO-01` is **RE-ARMED** (Gemini returned 2026-09-13), so `AGENTS.md` §3 / §6.3 two-agent separation is back in force: **a phase's builder may not be its reviewer.** Record `verification_mode: peer-reviewed` with the reviewer named. |
| Alongside 247 and 248 | The **backlog** rows — Phases **238, 240, 241** — each receive a `/gsd:code-review <phase>` **or** a **written refusal naming who decided and why**. |
| Alongside 249, 250 and 251 | The **v4.1** rows — Phases **242-246** — same instrument. `BUS-202` is already waiting: Gemini reports Phase 246 complete and ready for post-phase review. (246 already carries `peer-reviewed`; confirm it rather than re-run it.) |
| At milestone close | Every one of 238 / 240 / 241 / 242-246 reads either `independent_review: done` **or** a written refusal. A row that reads **neither** is an **unmet `DEBT-06`**, not a rounding error. |

⛔ **Re-arming the rule retro-reviews NOTHING.** Those phases stay `verification_mode: self-verified`
with `independent_review: owed` until a review actually runs.
⚠ **`/code-review ultra` stays ruled out on cost** (standing operator decision). The **normal**
`/gsd:code-review <phase>` is the instrument — and it is what caught 241's shipped HTTP 500.

### Phase Table

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 247 | Sources & Watches — the surface you now live on | A watched source tells the truth about itself: what it brought in, where that came from, whether it is healthy, and when something went missing | WATCH-01, WATCH-02, WATCH-03, WATCH-04, WATCH-05, WATCH-06, WATCH-07, WATCH-08 | 5 | ⚠ **G-2 FIRES — `/gsd:sketch` BEFORE `/gsd:plan-phase 247`**, operator-approved mockup is the acceptance bar; **UI hint: yes**; **G-4** lived-experience UAT (3 operator-defined "I'd recognize failure here" scenarios, defined at scope-time); **G-3** — `WATCH-06` / `WATCH-07` are `/gsd:fast` candidates, not plans; **G-5** likely: `backend/app/api/connectors.py` (⛔ extraction OWED at its SIXTH landing), `backend/app/services/sources/preview_service.py`, `backend/app/services/connector_service.py`, `frontend/src/components/settings/ConnectionsTab.tsx`, `frontend/src/components/sources/sourceHealthVocabulary.ts` (fires on next touch), `backend/app/services/sources/failure_cause.py` (⛔ its `Cause` union must stay ONE plain-text line — a frontend suite binds it by `?raw`), `frontend/src/lib/api/connectors.ts`; migration only if `missing_since` needs backfill; **242's owed UAT row 5** can ride this close |
| 248 | The Credential Boundary | A secret cannot come to rest anywhere a reader who should not see it can read it | CRED-01, CRED-02, CRED-03, CRED-04 | 4 | ⚠ **TRUST BOUNDARY — threat model MANDATORY, dispatched `security_enforcement` + `code_review` NOT optional**; ⛔ **`REVOKE … FROM anon` is a NO-OP while the default `PUBLIC` grant stands** (see phase detail); **migration expected — next free slot `181`**, applied by pasting into the SQL editor, then `bash scripts/regenerate-full-schema.sh`; **cloud parity is security-bearing** — `CRED-04` writes `get_advisors(security)` into the deploy checklist; **G-5**: `backend/app/models/connector.py`, `backend/app/api/connectors.py`, `backend/app/security/secret_cipher.py` (⛔ `SECRET_COLUMNS` is the ONE encrypt-on-write set), `frontend/src/components/settings/ConnectionFormPanel.tsx` (wider `ConnectionShapeFields.tsx` seam OWED), `connectionFormCopy.ts`; no G-2 — refusal copy is a sentence, not a surface |
| 249 | The Model You Actually Run | The model a person wants to run registers itself from the UI, announces what it can and cannot do, and reaches every worker | MODEL-04, MODEL-05, MODEL-06, MODEL-07, MODEL-08, MODEL-09 | 5 | ⚠⚠ **`MODEL-09` HAS A PRECONDITION — re-measure BEFORE planning** (see phase detail); **G-2 light** — `MODEL-05` / `MODEL-07` are picker-surface legibility, sketch only if discuss-phase surfaces a visual decision; **UI hint: yes**; **SC#10 cross-provider** — `MODEL-04` / `MODEL-05` touch provider routing, so the full native roster + OpenRouter (8 rows) applies, **derived from `MODEL_CAPABILITIES`, never re-typed**; **G-5**: `backend/app/config.py` (⛔ `MODEL_CAPABILITIES` seam OWED at 48 phases), `backend/app/models/user_settings.py` (32), `frontend/src/pages/SettingsPage.tsx` (tab seam OWED, 24), `backend/app/api/admin.py`, `backend/app/api/settings.py`, `backend/app/main.py` (the broadcast path for `MODEL-06`), `frontend/src/components/admin/ModelRegistryTab.tsx`, `backend/app/services/eval_runner_service.py`; `SEED-172` / `SEED-040` / `SEED-135` are **answered by editing the seed**, not by shipping |
| 250 | Run Honesty — the residue | A run never claims something that did not happen — not about your question, not about its own output, not about work it did not finish | HONEST-01, HONEST-02, HONEST-03, HONEST-04 | 4 | ⚠⚠ **`HONEST-04` IS BLOCKED ON ONE MEASUREMENT that must be resolved at DISCUSS-phase, not at plan time** — the two arms lead to **OPPOSITE** fixes (see phase detail); ⛔ **auto-completing open todos at a clean run end is REJECTED** (rejected 2026-06-26, recorded so it is not re-proposed as new); **SC#10 cross-provider MANDATORY** — streaming + agent loop, and `HONEST-02` is filed `cross-provider/openai`; **red line D-14** — provider differences stay at the adapter boundary, never a shared-path fork; **G-2** for `HONEST-03` / `HONEST-04` (workspace panel + todo list are live UI); **UI hint: yes**; **G-5**: `backend/app/services/agent_loop.py` (21), `frontend/src/providers/StreamsProvider.tsx` (37), `frontend/src/components/panel/WorkspacePanel.tsx`, `backend/app/api/threads.py` (82), `backend/app/services/tool_dispatcher.py` (35); ⚠ `run_producer.py` + `todos_service.py` carry **NO ledger row** — add one at the plan that touches them |
| 251 | Register Integrity | The registers can be trusted as an index — an id resolves, a trigger is swept by something executable, and the operator queue is a decision list | REG-01, REG-02, REG-03 | 3 | **No G-2** (no product UI); **no SC#10**; **no migration**; **G-5 light** — the blast radius is `.planning/seeds/`, `.claude/commands/gsd/` and `scripts/`, none of which carry hot-file rows; ⛔ **`REG-03`: Claude may NOT close bus items** — the deliverable is a list the operator can rule on; ⚠ the new sweep in `REG-02` must be **driven RED against a planted defect** before it is trusted — a guard nobody has seen fire is not a guard, and Phase 242 measured two of this project's guards passing **vacuously** |
| **252** | **Close the v4.2 audit gaps** | The four things the milestone audit found that five green phase verifications could not: a migration that cannot reach a new deployment, a credential written to the log by the phase that refused to store it, a card that reports a sync it did not do, and a panel that calls a live run finished | **No new ids** — closes `CRED-01`, `CRED-03`, `WATCH-04`, `HONEST-03` and sweeps `REG-01`'s sibling register | 5 | ⛔ **GAP-CLOSURE PHASE, not a feature phase** — scope is `.planning/v4.2-MILESTONE-AUDIT.md` §8 and **nothing else**; a new user-facing capability here is a phase, not a gap (G-7). · ⚠ **TRUST BOUNDARY — `security_enforcement` + `code_review` NOT optional**: B-1 and B-2 are live security defects. · ⛔ **B-1 needs NO migration** — 181 is correct; what is missing is its ACL mirror in `scripts/full-schema-supplement.sql`, because `regenerate-full-schema.sh` passes `--no-privileges` and a dump can never carry a function grant. **Same-commit rule with `supabase/full-schema.sql`.** · ⛔ **Correct `BUG-260915-01` BEFORE building its fix** — its stated mechanism is measurably false and its candidate #1 is already implemented. · **G-5**: `frontend/src/components/sources/WatchRowCard.tsx`, `frontend/src/providers/StreamsProvider.tsx` (37), `frontend/src/components/panel/PhaseCard.tsx`, `backend/app/services/connector_service.py`, `backend/app/api/connectors.py` (⛔ extraction OWED at its SIXTH landing) · **G-8**: target **3-4 plans**; the register sweep is one task, not a plan · **G-4**: the owed **S2** (`McpAuthDoor` BYO-OAuth, live) row is B-3's own scenario and must be driven here |
| **253** | **The bootstrap artifact tells the whole truth** | A database born from `full-schema.sql` has the same privileges as one built by replaying migrations — **tables included, not just functions** — and the gate that claims to prove it can actually fail | **No new ids** — re-closes `CRED-03`, `CRED-04` | TBD | ⛔ **GAP-CLOSURE PHASE from 252 own code review** — scope is `252-REVIEW.md` §CR-01/02/03/08 and **nothing else**; the nine behavioural findings are `/gsd:fast` sized (G-3). · ⚠ **TRUST BOUNDARY** — CR-01 is a live privilege-escalation path on every new deployment: `grep -c connector_tokens scripts/full-schema-supplement.sql` → **0**, while `129:85` and `151:90` both revoke it. · ⭐ **CR-02 was DRIVEN**: deleting one `REVOKE … FROM PUBLIC` line still read `missing: 0 []`. · ⛔ **Measure as `authenticated`, never through the service role** — that is the `BUG-260911-01` blind spot. · **G-5**: `scripts/full-schema-supplement.sql` (**8 / 5, NO ROW**), `scripts/check-schema-acl-parity.cjs` (1 / 1, no row), `supabase/full-schema.sql` (96 / 72) · **G-8**: target **3 plans** |
| **254** | **Independent review of 249-253** | Every v4.2 phase that closed on its own word is read by an agent that did not build it, and each row ends reading `independent_review: done` **or** a written refusal | **No new ids** — discharges the milestone standing gate **`DEBT-06`** | TBD | ⛔ **REVIEW PHASE, not a build phase** — the deliverable is findings the operator can rule on; anything bigger than a `/gsd:fast` fix is a phase, not this one (G-3 / G-7). · ⚠ **claude built all five — a self-review discharges nothing.** Measured: 249, 250, 251, 252 and 253 each carry `verification_mode: self-verified` in their own `*-VERIFICATION.md`. Gemini is back and `OV-SOLO-01` is re-armed, so the reviewer is the agent that did not build. · ⛔ **`/code-review ultra` stays ruled out on cost** (standing operator decision); the normal `/gsd:code-review <phase>` is the instrument — it is what caught 241's shipped HTTP 500 and 249's two blockers (`BUS-247`), both past a green self-verified close. · ⛔ **A review is a CLAIM about code, not the code** — drive each finding against the tree before reporting it OPEN. 253's own R2 round is the precedent: a finding can already be fixed in an ancestor of the reviewer's base. · **No G-2** (no product surface), **no migration**, **no SC#10** |

### Phase Checklist

- [x] **Phase 247: Sources & Watches — the surface you now live on** — Drive/Graph paths stored whole and actually used by classification, watch health reads its connection, "Sync now" answers in place, a missing file says when, labels match behaviour, 240's seven warnings dispositioned (WATCH-01..08)
- [x] **Phase 248: The Credential Boundary** — a secret pasted into a non-secret field is refused not stored, the grant marker claims only what is knowable, all 13 anon-executable SECDEF functions ruled on, `get_advisors(security)` in the deploy checklist (CRED-01..04). **4/4 requirements passed**, `248-VERIFICATION.md` `status: complete`, `verification_mode: peer-reviewed` (builder gemini / reviewer claude). ⚠ **TICKED 2026-09-16 at Phase 252 Plan 01 — `D-37` asserted this row was "already corrected to `[x]` at the audit; verify, do not re-do", and THAT WAS MEASURED FALSE: it read `[ ]`, the only unticked row of the five, while all four of its requirements were ticked in `REQUIREMENTS.md`.** The audit's correction lived in an untracked working file and never reached the committed ROADMAP — a correction in a register nobody commits is the same as no correction. ⛔ Two things this row does NOT claim: `CRED-01` is discharged while `BUG-260907-02` is **not** (Phase 252 B-3 measured a DCR writer that reaches the same column without crossing any of 248's three validated models), and `CRED-03`'s *"`supabase/full-schema.sql` regenerated"* was **false for the ACL half** — `pg_dump --no-privileges` cannot carry a function grant, so migration 181 was unreachable by a greenfield bootstrap until Phase 252 Plan 01 mirrored it (`scripts/full-schema-supplement.sql` §6) and gated it (`scripts/check-schema-acl-parity.cjs`). ⛔ One UAT row owed: G-4 scenario **S2** (`McpAuthDoor` BYO-OAuth, live), recorded in `248-G4-UAT.md` · ⛔ **`CRED-01` and `CRED-03` were REOPENED by that same audit** — see Phase 252. The `[ ]`/✅ drift this row suffered is the one this file warns about at line 265, in this file.
- [x] **Phase 249: The Model You Actually Run** — local / self-hosted models addable from the UI, unregistered ids say so at pick time, registry writes reach every worker, the hide control is the discoverable one, refused writes report failure, eval engines name their own cause (MODEL-04..09). **6/6 delivered · 2 with a NAMED limit.** ⭐ Two requirements were ALREADY BUILT and one defect no longer reproduced — measured before planning, so none was rebuilt. ⭐ 13 of the operator's configured models were measured to lose tool calling silently; the composer now says so at pick time, on the model they currently run. ⛔ `verification_mode: self-verified` by operator instruction (*"without gemini"*) — a FOURTH owed `DEBT-06` row. ⛔ Owed: `MODEL-04` end-to-end in chat (no live self-hosted endpoint), `MODEL-06` multi-worker observation (this box runs two single-worker `--reload` servers), `MODEL-09` cloud sweep (one operator click)
- [x] **Phase 250: Run Honesty — the residue** — trimming never eats your own question, a silent reasoning model says what happened, the panel stops working when the run ends, a finished task leaves no false todo (HONEST-01..04)
- [x] **Phase 251: Register Integrity** — 8 duplicate seed ids resolved, an executable seeds sweep, `BUS-171`'s 23-item operator queue triaged into a decision list (REG-01..03)
- [x] **Phase 252: Close the v4.2 audit gaps** — migration 181 reaches a greenfield deploy, the credential-smell handler stops logging the credential, a dynamic-registration `client_id` is validated before it bricks a connection, "Sync now" reports what actually happened, and the panel stops calling a live run finished. **Inserted 2026-09-16 by `.planning/v4.2-MILESTONE-AUDIT.md` (`status: gaps_found`)** — 4 blockers and 9 warnings found across five phases whose own verifications all passed — ✅ **CLOSED 2026-09-16, 5/5 success criteria.** ⛔ `self-verified`, `independent_review: owed` (`BUS-256`); **`DEBT-06` is NOT ticked by this phase**, which the ROADMAP itself called a `DEBT-06` row.
- [x] **Phase 253: The bootstrap artifact tells the whole truth** — a database born from `supabase/full-schema.sql` has the same privileges as one built by replaying migrations — **tables included, not just functions** — and the gate that claims to prove it can actually fail. **Inserted 2026-09-16 as a GAP-CLOSURE phase from 252's own code review** — ✅ **CLOSED 2026-09-17, 5/5 success criteria, 14/14 must-haves re-driven post gap-closure round 1 + 2 fast-fixes.** ⚠ `253-VERIFICATION.md` reads `status: gaps_found`, and the one gap was **bookkeeping, now closed**: R2's 13 unfixed findings lived only inside the review file and are now `SEED-290`, each with a re-open trigger. ⛔ `self-verified`, `independent_review: owed` (`BUS-257`) — **`DEBT-06` is NOT ticked by this phase.** ⚠ **THIS ROW WAS ABSENT UNTIL 2026-09-18 AND THAT IS THE FINDING, not a typo:** 253 sat in the Phase Table, Phase Details, Coverage and Progress while `grep -cE '^- \[[ x]\] \*\*Phase 253'` returned **0** — so its box could never be ticked, because it did not exist. Same invisibility class as a hot file with no ledger row, one register over, found by `/gsd:progress` rather than by any gate.
- [x] **Phase 254: Independent review of 249-253** — the five v4.2 phases that closed on their own word (249, 250, 251, 252, 253) each get read by an agent that did not build them; `DEBT-06` ends this milestone reading `done` or a written refusal **per row**, which is the only state that is not an unmet requirement

### Phase Details

#### Phase 247: Sources & Watches — the surface you now live on

**Goal**: A watched source tells the truth about itself — what it brought in, where that came from, whether it is healthy, and when something went missing — so a person can rely on the watch loop instead of re-checking it by hand.
**Depends on**: Nothing (first phase of v4.2). It builds on v4.0's shipped watch loop, which reached production **for the first time on 2026-09-13** — these are the eight defects standing between *"it shipped"* and *"you can rely on it"*.
**Requirements**: WATCH-01, WATCH-02, WATCH-03, WATCH-04, WATCH-05, WATCH-06, WATCH-07, WATCH-08
**Success Criteria** (what must be TRUE):

  1. A document ingested from Google Drive or from OneDrive/SharePoint carries the same `metadata.source.path` an uploaded one does — a classification rule keyed on path **matches it**, and the path displayed equals the path stored, with no truncation (WATCH-01, WATCH-02).
  2. A watch card reports the health of **the connection it rides**: a healthy connection whose last run failed reads healthy, and a broken connection whose last run happened to succeed reads broken (WATCH-03).
  3. Pressing "Sync now" produces an answer **where it was pressed** — the section it writes into stays open and the result is readable without re-navigating (WATCH-04).
  4. A file that has gone missing at the source states **when** it went missing; every action label matches what the action does (a fix performs a fix, navigation is labelled as navigation); and every timestamp is either absolute or relative, never both concatenated (WATCH-05, WATCH-06, WATCH-07).
  5. Each of Phase 240's **seven** open build-review warnings reads either *closed* or *accepted, with the reason written down* — none is left undispositioned (WATCH-08).

**Plans**: TBD
**UI hint**: yes
**Flags**: ⚠ **G-2 FIRES — `/gsd:sketch` runs BEFORE `/gsd:plan-phase 247`, and the operator-approved mockup is the acceptance bar.** All eight WATCH complaints are **legibility** complaints: what a card claims, where an answer lands, how a timestamp reads, whether a label tells the truth about its own button. **A wire-format fix that does not change what a person reads has not satisfied this phase** — and this project has already measured a green composition fence coexisting with a shipped legibility defect, because presence assertions cannot see content drift. Assert the rendered **content** where the words are the deliverable. · **G-4**: three operator-defined *"I'd recognize failure here"* scenarios, defined **at scope-time**, driven in Chrome at verification — a screenshot plus a wire assertion is insufficient. · **G-3**: `WATCH-06` and `WATCH-07` look like ≤ 1-file / ≤ 10-line fixes; if they measure that way they are `/gsd:fast`, **not plans**. · **G-5**: see the Flags column above — `backend/app/api/connectors.py` has an **extraction OWED at its sixth landing**, so a plan that lands there must say why it is not the seventh. · **242's UAT row 5 is unblocked and owed** and can be driven at this phase's close. · Migration only if `missing_since` needs a backfill; prefer writing it forward.

#### Phase 248: The Credential Boundary

**Goal**: A secret cannot come to rest anywhere a reader who should not see it can read it — not in a mis-typed field, not behind a marker that overclaims its own authorship, and not through a function the exposed API schema hands to `anon`.
**Depends on**: Nothing structurally. Sequenced **after 247** because its `connectors.py` / `connector_service.py` / `connector.py` blast radius overlaps 247's, and worktree Rule 4 forbids two plans mutating the same local Postgres concurrently.
**Requirements**: CRED-01, CRED-02, CRED-03, CRED-04
**Success Criteria** (what must be TRUE):

  1. A credential pasted into a field that is not a secret field is **refused, not stored** — and the refusal **names which field takes a secret** (CRED-01). Measured live 2026-09-13: `custom_client_id` is a bare `str | None = None` at `backend/app/models/connector.py` **244 / 351 / 558** — no pattern, no length bound, no shape check — while `config` is `SELECT`-able org-wide by `authenticated` and `secret_ciphertext` is not.
  2. The grant override marker claims only what the app can actually know — it does not assert a human author for a change the system cannot attribute (CRED-02).
  3. Each of the advisor's **13** anon-executable `SECURITY DEFINER` findings is either **revoked** or **recorded as intentionally public with the reason** — and a re-run of `get_advisors(security)` shows the ruled-on set rather than the original thirteen (CRED-03).
  4. `get_advisors(security)` is a step of the deploy parity checklist that a promotion cannot silently skip (CRED-04).

**Plans**: TBD
**Flags**: ⚠ **TRUST BOUNDARY — a threat model is MANDATORY and the dispatched code review is NOT optional.** `security_enforcement` and `code_review` are both on in `config.json`; neither may be cut to save time, on this phase least of all. · ⛔⛔ **THE TRAP THAT MAKES A NAIVE `CRED-03` FIX A NO-OP: Postgres grants `EXECUTE` to `PUBLIC` by default, so `REVOKE … FROM anon` changes NOTHING while the `PUBLIC` grant stands.** **Revoke from `PUBLIC`, then grant back the roles that genuinely need it.** This was **measured, not reasoned** — migration 177's first version applied cleanly and verify still read `FAIL`. **A role-by-role sweep of the 13 flagged functions would silently achieve nothing**, and would produce a green migration over an unchanged exposure. · ⭐ **`get_advisors(security)` is the only instrument that has ever caught this class.** `BUG-260911-01` was invisible to every gate this project runs, because **every gate reads through the service role and nothing in the suite ever makes a request as `anon`.** A `CRED-01` fence exercised only through the service role reproduces that blind spot exactly — **make at least one assertion as `anon`.** · **Migration expected; next free slot is `181`** — apply by pasting into the Supabase SQL editor (never `db push` / `db reset`), then `bash scripts/regenerate-full-schema.sh`. · **Supabase MCP reads are free and should be used** to verify the advisor set; **every write against production stays per-action operator-approved**. · **G-5**: `connector.py`, `connectors.py`, `secret_cipher.py` (⛔ a provider-key column absent from `SECRET_COLUMNS` is stored **plaintext** and nothing says so), `ConnectionFormPanel.tsx`, `connectionFormCopy.ts`.

#### Phase 249: The Model You Actually Run

**Goal**: The model a person wants to run registers itself from the UI, announces what it can and cannot do before it is used, and reaches every worker — so *"add a model"* stops meaning *"edit code and deploy"*, and a silent capability loss stops being the failure mode.
**Depends on**: Nothing structurally. ⚠ **It has a PRECONDITION rather than a dependency — see the flags.**
**Requirements**: MODEL-04, MODEL-05, MODEL-06, MODEL-07, MODEL-08, MODEL-09
**Success Criteria** (what must be TRUE):

  1. A local or self-hosted model — Ollama, LM Studio, vLLM, or any OpenAI-compatible endpoint — is added from the **Model Registry UI** and is then selectable and usable in chat, with **no code edit and no deploy** (MODEL-04).
  2. Picking a model whose id is absent from the capability registry **says so at pick time**, instead of resolving `capability_source = inferred`, silently losing `native_tools`, and producing a run that simply never calls a tool while nothing says why (MODEL-05).
  3. A registry or settings change made through one worker is visible on the **next** request no matter which worker serves it — a newly added model appears every time, not roughly half the time at the default `WORKER_COUNT=2` (MODEL-06).
  4. The control that hides a model from the picker is the one a person reaches first, and a settings write the database **refuses** reports **failure** rather than 200 + "Saved" (MODEL-07, MODEL-08).
  5. Every configured eval engine either reports healthy or **names its own cause** — no opaque `provider_error` (MODEL-09).

**Plans**: TBD
**UI hint**: yes
**Flags**: ⚠⚠ **`MODEL-09` MUST BE RE-MEASURED BEFORE IT IS PLANNED — this is a precondition on the phase, not a task inside it.** `BUG-260809-01` (0/8 engines healthy, 6 of 8 hiding why) was measured against the **OLD production on 2026-08-09**, and **292 commits have landed since**. ⛔ **Engine health is a LIVE SWEEP and is NOT PERSISTED, so it cannot be re-derived from the database, from a log, or from the Supabase MCP read path.** It needs **one operator click: Settings → Eval engine health → Run sweep.** Ask for it at `/gsd:discuss-phase 249` and record the result there. **If the sweep now reads healthy, `MODEL-09` collapses to a written closure rather than a plan** — and planning it first would build a fix for a defect that may no longer exist. · **SC#10 cross-provider**: `MODEL-04` / `MODEL-05` touch provider routing, so the **full native roster + OpenRouter (8 rows)** applies — **derive the roster from `MODEL_CAPABILITIES`, never re-type it**, and prefer a registry-backed id (an id absent from the registry measures a weaker configuration than the one that ships, which is `MODEL-05`'s own defect). A row with no key is recorded ⛔ with its reason, never dropped. · **`MODEL-04`'s root cause is already located**: `POST /admin/models` validates its provider argument against the **8-cloud SSRF discovery allowlist** rather than the routing roster — ⛔ **widening the roster must NOT widen the SSRF fence**, which is a different list for a different reason. · **`SEED-172`, `SEED-040` and `SEED-135` are answered by EDITING THE SEED** — flip `status` and record where it went; a seed that shipped but still reads `planted` will be re-proposed forever. · **G-5**: `config.py` (⛔ the `MODEL_CAPABILITIES` seam is OWED at 48 phases), `user_settings.py`, `SettingsPage.tsx` (tab seam OWED), `admin.py`, `settings.py`, `main.py`, `ModelRegistryTab.tsx`, `eval_runner_service.py`.

#### Phase 250: Run Honesty — the residue

**Goal**: A run never claims something that did not happen — not about the question you asked, not about output it did not produce, not about work it did not finish.
**Depends on**: Nothing structurally. Sequenced after 249 because `MODEL-05`'s capability honesty and `HONEST-02`'s empty-response honesty are adjacent failure modes, and the later phase inherits the earlier one's vocabulary rather than inventing a second one.
**Requirements**: HONEST-01, HONEST-02, HONEST-03, HONEST-04
**Success Criteria** (what must be TRUE):

  1. Context trimming never drops the user's own question — a long thread keeps every question the user asked, and the agent never announces that a question asked eight turns ago was trimmed (HONEST-01).
  2. A reasoning model that produces no text inside a tool loop **says what happened** rather than returning "empty response after N iterations" (HONEST-02).
  3. The workspace panel stops claiming a run is in progress the moment that run ends — **including a run that timed out**, which today leaves the panel working forever (HONEST-03).
  4. A task that completed leaves **no todo asserting unfinished work** — and nothing was auto-completed to achieve that (HONEST-04).

**Plans**: TBD
**UI hint**: yes
**Flags**: ⚠⚠ **`HONEST-04` IS BLOCKED ON ONE MEASUREMENT, AND IT MUST BE RESOLVED AT `/gsd:discuss-phase 250`, NOT AT PLAN TIME — THE TWO ARMS LEAD TO OPPOSITE FIXES.** The question is whether the stuck todo item carries the string `" (run ended — not completed)"`. **PRESENT ⇒ the reconciler RAN, and this is a copy / scoping decision for the operator** (what should a reconciled-but-unfinished item say, and should it say it at all). **ABSENT ⇒ the reconciler did NOT run, and this is a backend defect** — either the gate at `backend/app/services/run_producer.py:145` (`terminal_status == "completed" and result_sink.get("cap_disposition") != "cap_paused"`) never admitted the run, or the `except BaseException` at `:155` swallowed the failure into a log line nobody reads. **Planning before this is measured builds one of two mutually exclusive fixes at random.** · ⛔ **AUTO-COMPLETING OPEN TODOS AT A CLEAN RUN END IS REJECTED, and was rejected on 2026-06-26** — a clean terminal status is **not proof the listed work happened**, and shipping it fabricates success. Recorded here so it is not re-proposed as new. · **SC#10 cross-provider is MANDATORY** — this phase touches streaming, the agent loop and run state; `HONEST-02` is filed `cross-provider/openai`, and a fix proven on one provider is not proven. · **Red line D-14**: provider differences stay at the adapter / sanitizer boundary; never fork the shared path, and Deep Mode stays byte-identical. · **G-2** for `HONEST-03` / `HONEST-04` — both are live-UI honesty, and `Skill("sketch-findings-agentic-rag")` owns the workspace-panel and run-card vocabulary they must speak. · **G-5**: `agent_loop.py`, `StreamsProvider.tsx`, `WorkspacePanel.tsx`, `threads.py`, `tool_dispatcher.py`; ⚠ **`run_producer.py` and `todos_service.py` carry NO ledger row** — `node scripts/check-hot-file-ledger.cjs 250` will fail until one is added, and that is the gate working, not the gate breaking.

#### Phase 251: Register Integrity

**Goal**: The registers can be trusted as an index — a reference by id resolves to exactly one thing, a `trigger_when` is swept by something executable rather than by hope, and the operator's queue is a list they can actually rule on.
**Depends on**: Nothing. ⚠ **Sequenced LAST on purpose:** 247-250 will each plant, flip and answer seeds, so running the de-duplication and the sweep before them would leave the milestone's own output unswept. `REG-02`'s new sweep should be run **over this milestone's own seeds** as its first real exercise.
**Requirements**: REG-01, REG-02, REG-03
**Success Criteria** (what must be TRUE):

  1. No two seeds share an id — the **8 known duplicates** (`022, 092, 228, 229, 231, 253, 259, 269`) each resolve to exactly one seed, so a reference by id can be followed (REG-01).
  2. A person can run **one command** that reads every `trigger_when` in the register and prints the seeds whose trigger is already true — the sweep is **executable**, not a paragraph in `CLAUDE.md` asking an agent to read 161 planted seeds of 280 (REG-02).
  3. `BUS-171`'s **23** `--to operator` items exist as a decision list the operator can rule on in one sitting — each classified *superseded* (naming the evidence), *live decision* (one line), or *carries an unfixed finding* — and every item in that last class is **verified to be held by a durable register, planting one where it is not** (REG-03).

**Plans**: 4 plans, all SERIAL (waves 1→2→3→4)

Plans:
**Wave 1**

- [x] 251-01-PLAN.md — build `scripts/check-seeds-register.cjs`, the executable sweep, and drive D-04's four arms + the count assertion RED via a committed `--self-test` before the register is touched

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 251-02-PLAN.md — migrate all ~~283~~ **284** seeds (⚠ `SEED-285` was planted in 251-01's own base commit; re-derive, never transcribe — see `251-GATE-BASELINE.md` §0) onto the D-09/D-10/D-16 frontmatter contract with every BODY proven md5-identical over raw Buffers, and write the contract down in TEMPLATE.md, plant-seed.md and CLAUDE.md

**Wave 3** *(blocked on Wave 2 completion)*

⛔ **251-02 MEASURED 251-03's id space and it has ZERO headroom:** 276 distinct ids, **highest is 285**, so `277-284` are free — **exactly eight, for eight renumbers**. A ninth must jump to **286**; the run is not contiguous. ⚠ `SEED-285` is TAKEN. And the `status: superseded-id` carve-out is live and exercised (gate arm 1b), so the eight stubs will read as resolutions rather than as eight new regressions.

- [x] 251-03-PLAN.md — renumber the 8 duplicate-id movers to 277-284 by the D-07/D-20 date rule and leave a disambiguating redirect stub at each old id, touching no product file and no archive

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 251-04-PLAN.md — wire the sweep into `discuss-phase` and `new-milestone` where the steps actually are, age the operator queue at every session start, and hand the operator a 5-item decision list

⚠ **No honest parallelism exists in this phase and that is stated rather than hidden.** Three of the
four plans operate on `.planning/seeds/` and the fourth validates the other three: plan 01's RED arms
plant defects into the same directory plan 02 bulk-rewrites and plan 03 renames, and plan 04's wiring
invokes plan 01's gate against plan 02's and plan 03's output. `use_worktrees: true` does not create
parallelism here; a wave boundary that looks parallel and is not is this project's recorded failure.

**Flags**: ⛔ **Claude may NOT close bus items** — `REG-03`'s deliverable is a **list the operator rules on**, and an item closed without the operator seeing it is a decision taken by the wrong party. The 2026-09-06 sweep found **two findings held only by a bus item**, which is exactly why the third classification arm exists. · ⚠ **`REG-02`'s new sweep must be DRIVEN RED against a planted defect before it is trusted.** A guard nobody has seen fire is not a guard — and this project has measured that twice in one phase: Phase 242 found `check-hot-file-ledger.cjs` exiting `0` over **zero parsed files** on a CRLF plan, and a pinned a11y suite that was red in **neither** knob. · ⚠ **`status:` frontmatter IS the index** — prose inside a seed body saying *"still open"* is invisible to any scan, so `REG-01`'s de-duplication must preserve and correct the **frontmatter**, not only the filenames. · **The cost of not doing this is measured, not theoretical:** `SEED-172` sat reachable for **four weeks** and it took a person hitting the wall to surface it. · No G-2, no SC#10, no migration, no product-surface G-5 rows.

#### Phase 252: Close the v4.2 audit gaps

**Goal**: The four things the milestone audit found that five green phase verifications could not — a migration that cannot reach a new deployment, a credential written to the log by the phase that refused to store it, a card that reports a sync it did not do, and a panel that calls a live run finished.

**Depends on**: 247-251, all closed. ⚠ **This phase exists because they closed green.** Five `*-VERIFICATION.md` files read `passed`, the backend gate held at its locked baseline, the seeds register read `293/293 · 0 duplicate ids` — and a cross-phase read found **4 blockers and 9 warnings**. ⭐ **Every one is a seam between two things that are individually correct**, which is `DEBT-06`'s argument arriving from the outside rather than from a register.

**Requirements**: No new ids. Closes **`CRED-01`**, **`CRED-03`**, **`WATCH-04`** and **`HONEST-03`**, which the audit moved from ✅ satisfied to ⛔ unsatisfied, and sweeps the reported-bugs register that `REG-01` left alone.

**Scope source**: `.planning/v4.2-MILESTONE-AUDIT.md` §8. ⛔ **Nothing outside it.** A new user-facing capability here is a phase, not a gap (G-7).

**Success Criteria** (what must be TRUE):

  1. **A greenfield deploy is not born with 13 anon-executable functions.** Bootstrapping from `supabase/full-schema.sql` alone leaves every one of migration 181's 13 SECURITY DEFINER functions without the default `PUBLIC` EXECUTE grant, and `get_advisors(security)` against that deployment returns **zero** ERROR findings rather than 13 (**B-1** → `CRED-03`, `CRED-04`).
  2. **The credential-smell path never writes the credential anywhere.** A connections-list read over a legacy row holding a secret in `custom_client_id` produces a log line containing **zero** occurrences of that value — driven against the real pydantic model, not reasoned (**B-2** → `CRED-01`).
  3. **A server-issued `client_id` cannot brick a connection.** The RFC 7591 dynamic-registration writer validates before storing, and a value the inbound boundary would refuse either never lands or leaves a repair path — proven by the owed **G-4 S2** scenario (`McpAuthDoor` BYO-OAuth, live), driven here (**B-3** → `CRED-01`).
  4. **"Sync now" says what happened.** The card reports the real `triggerWatchSync` result, never a literal; a refusal and a success cannot render simultaneously on one card; and a failure is caught (**B-4** → `WATCH-04`, `WATCH-06`).
  5. **The panel never calls a live run finished — on either of its two run-state surfaces.** Open todos do not read `NOT TICKED` during a live run at any point after a plain thread open, and `PhaseCard`/`PhaseTimeline` stop claiming `running` for a run that died without its phase-terminal event (**Flow C Holes 1 and 2** → `HONEST-03`, `HONEST-04`).

**Plans**: target **3-4** (G-8). The register sweep is a task, not a plan.

**Flags**:

⚠ **TRUST BOUNDARY — `security_enforcement` + `code_review` are NOT optional.** B-1 and B-2 are live security defects, not hygiene.

⛔ **B-1 NEEDS NO MIGRATION.** 181 is correct and applied. What is missing is its ACL mirror: `scripts/regenerate-full-schema.sh:104` passes **`--no-privileges`**, so a `pg_dump` can *never* carry a function grant, and neither bootstrap artifact contains a single `REVOKE … EXECUTE ON FUNCTION`. The fix is `scripts/full-schema-supplement.sql`, under the **same-commit rule** with `supabase/full-schema.sql`. ⭐ `full-schema.sql:7449-7456` documents this exact failure class verbatim **for migration 118** — 181 reproduced it, so this is the **third** recurrence and the fix must be the durable one.

⛔ **CORRECT `BUG-260915-01` BEFORE BUILDING ITS FIX.** Its stated mechanism is measurably false: `StreamsProvider.tsx:1936-1942` shows `setViewingThread` **already** fires `actions.reconcile(threadId)`, so its fix candidate #1 is implemented and building it ships a no-op. The real hole is that `loadMessages` is never called on thread open, so `loadingThreads` never sets and `isRunLive` reads false for the whole `/snapshot` round-trip — plus `reconcile`'s in-flight lock is **global, not per-thread** (`:1975`). Candidate #2 is correct.

⚠ **Hole 2 was never in scope anywhere.** `git grep` over Phase 250's artifacts returns **zero** mentions of `PhaseCard`, `PhaseTimeline` or `phaseStatusMeta`, yet `WorkspacePanel.tsx` mounts `PhaseTimeline` at `:72` beside `TodosSection` at `:68`. `HONEST-03` says *"the workspace panel"*; one of its two run-state surfaces was made honest.

⚠ **Nine warnings ride this phase or are dispositioned in writing** — W-1/W-2/W-3 (source-health honesty: a one-cause pill, a tautological `429`, a third navigation-only label still claiming a fix), W-4 (`POST /setup/provider-key` answers an opaque 500), W-6 (two NEW `TS2556` errors authored by Phase 250's own fix commit, three lines under a comment warning of that trap), W-7 (`vitest-count-gate.cjs:2887` pins `ConnectionGrantsList.test.tsx` at **8** while the file has **9** — permanent slack since Phase 221), W-8 (a dangling seed path in `ThinkingBlock.tsx:158`). **W-5 and W-9 resolved clean and need no work.**

⚠ **Register sweep, no code:** six reported bugs read `status: open` / `folded_into: null` while a v4.2 phase cites them as delivered (`BUG-260911-01`, `BUG-260910-03`, `BUG-260913-01`, `BUG-260907-02`, `BUG-260828-02`, `BUG-260902-06`) — and **`BUG-260828-02` is a duplicate id shared by two different bugs**, found by `248-CONTEXT.md:376` and never fixed. ⭐ **That is `REG-01`'s exact defect class, one register over, in the milestone that shipped `REG-01`.**

⛔ **`DEBT-06` is NOT in this phase's scope and must not be quietly ticked by it.** Its per-phase arm is unambiguously unmet — 249, 250 and 251 each closed `self-verified` while `OV-SOLO-01` was re-armed and a reviewer was available. Its milestone-close arm is **contested**: `.planning/DEBT-06-AUDIT.md` calls four rows *"genuinely unmet"* and **never reads `.planning/DEBT-06-REFUSALS.md`**, which covers exactly those four, operator-decided 2026-09-14 — while that refusals file says of itself *"the refusal is the record, not a discharge."* **Two registers disagree and the ruling is the operator's** (`BUS-247`). ⭐ And the structural half survives any ruling: `grep -rln "independent_review" scripts/ .claude/hooks/` returns **nothing**, so the field `DEBT-06`'s close condition is written against has no gate, and 240's marker went stale in **ten hours**.

⭐ **This phase is itself a `DEBT-06` row.** Given what its own audit found, closing it `self-verified` would be the fourth consecutive phase to break the gate this milestone wrote for itself.

#### Phase 253: The bootstrap artifact tells the whole truth

**Goal**: A database born from `supabase/full-schema.sql` has the same privileges as one built by replaying migrations — **tables included, not just functions** — and the gate that claims to prove it can actually fail.

**Depends on**: 252, closed. ⚠ **This phase exists because 252's own code review found the gate 252 shipped.** `252-REVIEW.md` → CR-01, CR-02, CR-03. ⭐ **CR-02 was DRIVEN, not reasoned**: one `REVOKE … FROM PUBLIC` line was deleted from a copy of the supplement, the shipped `analyse()` was run, and it printed `missing: 0 []`.

**Requirements**: No new ids. Re-closes **`CRED-03`** and **`CRED-04`**, which 252 closed against the **function** half of the same claim.

**Scope source**: `.planning/phases/252-close-the-v42-audit-gaps/252-REVIEW.md` §CR-01, §CR-02, §CR-03, §CR-08. ⛔ **Nothing outside it.** The nine behavioural findings (CR-04..CR-07, CR-09..CR-11) are `/gsd:fast` sized and are NOT this phase (G-3).

**Success Criteria** (what must be TRUE):

  1. **A greenfield deploy cannot read the OAuth ciphertext.** On a database bootstrapped from `supabase/full-schema.sql` + `scripts/full-schema-supplement.sql` **alone**, a `select access_token_ciphertext from connector_tokens` issued **as `authenticated`** is refused. ⛔ **Measured as `authenticated`, never through the service role** — every gate this project runs reads through the service role, which is precisely the blind spot `BUG-260911-01` lived in. Today: `grep -c connector_tokens scripts/full-schema-supplement.sql` → **0**, while `129:85` and `151:90` both carry `REVOKE ALL ON TABLE public.connector_tokens FROM anon, authenticated` (**CR-01** → `CRED-03`).
  2. **Every connector read works on a fresh database.** The supplement's `GRANT SELECT (…) ON public.connector_connections` column list equals `_TABLE_SELECTABLE_KEYS` exactly, and a fence pins the two to each other so a new response field cannot silently drift them. Measured today: the supplement grants **16** columns, the model derives **19** — missing `auth_type`, `status`, `error_message`, `default_approval_posture`, `default_ingest_visibility`, so **every connector list read is `42501`** on a greenfield DB (**CR-01** → `CRED-03`).
  3. **The parity gate fails on a PARTIAL revoke.** Deleting the single line `REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM PUBLIC;` makes `scripts/check-schema-acl-parity.cjs` exit non-zero — **driven RED against that exact planted defect before the fix, and again after.** It compares a `Set<signature>` today, so the surviving `FROM anon` revokes are inert while the PUBLIC grant stands, and `--self-test` plants only whole-function omissions (**CR-02** → `CRED-04`).
  4. **A comment cannot hide an ACL from the gate.** `aclsIn` is string-literal-aware: `COMMENT ON … IS '… -- verbatim';` followed by a `REVOKE EXECUTE ON FUNCTION …` still yields that signature. Migration **180 lines 30/32** already ship that construct, so this is live, not hypothetical (**CR-03**).
  5. **The ledger stops lying about this phase's own blast radius.** Two absent rows are added — `scripts/full-schema-supplement.sql` (**5 phases, G-5 FIRING, no row for its entire life**) and `scripts/check-schema-acl-parity.cjs` (row AT CREATION, the `settingsSearchPayload.ts` precedent) — and the twelve triples `252-REVIEW.md` CR-08 measured stale are re-derived with the CLAUDE.md recipe (**CR-08**).

**Plans**: **3** — waves 1 and 2 SERIAL, plus **wave 3, a GAP-CLOSURE ROUND added 2026-09-17**
from `253-REVIEW.md` (`gap_closure_round: 1`; `node scripts/check-gap-closure-rounds.cjs 253` reads
`rounds completed: 1 (cap is 2)`, G-7 clear). ⚠ The original `**2**, SERIAL — waves 1 and 2,
`depends_on: [253-01]`` is kept rather than overwritten: it was true of the phase as planned, and the
third plan exists because the phase's own VERIFICATION passed **14/14 with zero gaps** while the code
review found **2 critical + 11 warning + 5 info** in the same tree. ⚠ The `target 3` written here at
scoping is SUPERSEDED by `253-CONTEXT.md` **D-20**, which is the later and more specific decision;
the original is kept rather than overwritten. Under G-8's 3-5 target, and a plan is a wave-sized
unit of work, not a task. ⛔ **Serial is REQUIRED, not preferred:** CLAUDE.md worktree rule 4 —
`253-01`'s harness CREATEs and DROPs a database on the shared local cluster, which no
`files_modified` check can see. SC#5 (CR-08) is a TASK on `253-02`, the plan that lands last.

Plans:
**Wave 1**

- [x] 253-01-PLAN.md — the artifact half (`CRED-03`): greenfield harness driven RED → the seven-table mirror into the supplement AND `full-schema.sql`'s tail (same commit) → the pytest column fence → harness GREEN — ✅ **DONE 2026-09-16** (`253-01-SUMMARY.md`; 4 commits `10002454c`, `3192f480f`, `c73463658`, `95e9a1314`)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 253-02-PLAN.md — the gate half (`CRED-04`): tuple key, literal-aware lexer, TABLE/COLUMN regex, four `--self-test` arms, narrowed failure text, **plus WIRING the gate** (measured: nothing invokes it) and the D-23 ledger rows — ✅ **DONE 2026-09-17** (`253-02-SUMMARY.md`; 4 commits `b9067a904`, `8790c4119`, `22972ca6e`, `4df90a080`)

**Wave 3** *(gap closure — `253-REVIEW.md`, round 1 of 2)*

- [x] 253-03-PLAN.md — the five locked review findings, each a *guard that cannot fail*: **CR-01** the parity gate never opens `supabase/full-schema.sql` · **CR-02** the greenfield harness's `line.find("--")` loses a REVOKE behind a string literal (a false GREEN in the **permissive** direction) · **WR-02** the PostToolUse matcher is `Write|Edit`, so a **MultiEdit** fires nothing · **WR-06** `check-greenfield-privileges.py` is invoked by nothing executable · **WR-08** the §5 column fence does not run in CI for the change that breaks it. ⛔ The other 8 warnings + 5 info items are OUT by operator lock and are recorded as deferred **with a re-open trigger each** inside the plan. — ✅ **DONE 2026-09-17** (`253-03-SUMMARY.md`; merged FF at `feb3d4752`, 9 commits `507b3210e`, `a3aa2e1df`, `7025ef08b`, `b6dce5010`, `34011964d`, `566978a57`, `53bdc5c7f`). ⭐ **CR-01 was re-driven INDEPENDENTLY on the merged tree by the orchestrator**, not taken on the executor's word: three `resize_embedding_column` REVOKE lines stripped from `supabase/full-schema.sql` → gate **exit 1**, where the reviewer measured **exit 0** the same day; restore proven md5-identical (`a4f570396a44035102567ec1e3b7ff62`). Self-test **29 → 35/35** arms. ⚠ **WR-02 turned out to have TWO independent causes, not one** — the hook's path extraction AND the `.claude/settings.json` matcher (operator-approved) — and **fixing either alone is inert in a live session**; the plan's one-defect framing would have let cause 2 read as closed by cause 1's commit. ⛔ **`.claude/settings.json` measures `9 / 4 / 202`, FIRES G-5, and was in NEITHER register for its entire life** — `.claude/` is EXEMPT from `check-hot-file-ledger.cjs`, so no gate could have demanded it; the **fourth** file this one plan found structurally invisible to its own guardrail. ⛔ Owed: `independent_review` (DEBT-06 / BUS-257, the **sixth** consecutive self-verified close), the two GitHub jobs (never executed), and the live MultiEdit dispatch (needs a session restart to observe).

**Flags**:

⚠ **TRUST BOUNDARY — `security_enforcement` + `code_review` are NOT optional.** CR-01 is a live privilege-escalation path on every new deployment, not hygiene.

⛔ **THE PUBLIC TRAP, THIRD RECURRENCE.** Postgres grants `EXECUTE` to `PUBLIC` by default, so `REVOKE … FROM anon` changes nothing while the PUBLIC grant stands. CLAUDE.md records it, migration 177 measured it, and **CR-02 is that same trap surviving inside the gate written to catch it** — the gate's own failure text lectures the reader about PUBLIC-before-anon ordering, which reads as something it checks.

⛔ **THE SAME-COMMIT RULE BINDS.** `scripts/full-schema-supplement.sql` and `supabase/full-schema.sql` ship together; `scripts/regenerate-full-schema.sh:104` passes `--no-privileges`, so a `pg_dump` can **never** carry a grant and the supplement is the only home for one. ⛔ **Never hand-edit `full-schema.sql`.**

⚠ **CR-01 PRE-DATES 252 AND MUST NOT BE READ AS ITS REGRESSION.** What 252 added is a §6 header claiming *"table OR function"* over a gate enforcing only functions. **The exposure is older than the sentence that overstates the coverage.**

⚠ **G-5, measured 2026-09-16 rather than read**: `supabase/full-schema.sql` **96 / 72** (row present) · `scripts/full-schema-supplement.sql` **8 / 5 — NO ROW** · `scripts/check-schema-acl-parity.cjs` **1 / 1 — no row, young**. ⛔ A hot file with no row is invisible to its own guardrail at any count.

⭐ **`DEBT-06` applies to this phase too.** 249, 250, 251 and 252 each closed `self-verified`. Gemini is back and `OV-SOLO-01` is re-armed — **this one gets a reviewer, or it says in writing why not.**

#### Phase 254: Independent review of 249-253

**Goal**: Every v4.2 phase that closed on its own word is read by an agent that did not build it, and each row ends reading `independent_review: done` **or** a written refusal — which is what `DEBT-06` asks for and what no phase of this milestone has yet produced.

**Depends on**: 253, closed on code 2026-09-17.

**Requirements**: No new ids. Discharges **`DEBT-06`**, the milestone-wide standing gate — the **1 of 26** left unticked at every sweep so far, and unticked for a real reason rather than a bookkeeping one.

**Scope source**: the five phase directories `249-*` … `253-*`, their `*-VERIFICATION.md`, `*-SUMMARY.md` and existing `*-REVIEW*.md` files, and the code each phase shipped. ⛔ **Nothing outside them.**

**Measured at scoping (2026-09-17), not read from a summary line** — `grep verification_mode` across the five `*-VERIFICATION.md` files:

| Phase | `verification_mode` | `independent_review` |
|---|---|---|
| 249 | `self-verified` | owed (builder claude / reviewer claude) |
| 250 | `self-verified` | `owed`, `reviewer: null` |
| 251 | `self-verified` | owed |
| 252 | `self-verified` | `owed` (`BUS-256`) |
| 253 | `self-verified` | `owed` (`BUS-257`) |

⚠ **The registers disagree on the streak and the disagreement is left visible rather than resolved by
guess**: 253's Progress row calls itself the **SIXTH** consecutive self-verified close and its own
verification note calls it the **FIFTH**. **Five phase directories is what was measured**; a count that
reaches further back (238 / 240 / 241 / 242-246) belongs to `DEBT-06`'s at-milestone-close rule, which
is stated above this table and is **out of this phase's scope**.

**Why this is a phase and not bookkeeping.** ⭐ `BUS-247` is the argument in one paragraph: a
self-verified close shipped **two blockers** with every gate green, six fences driven red and three live
browser scenarios — because **neither blocker was gate-catchable**. Phase 253 then repeated the shape at
a second level: a 14/14 verification with `0 gaps` passed over **two live criticals**, and a review of
the *gap-closure round* found **two more**, both the same vacuity class the phase existed to kill. **A
green verification is a phase's account of itself.**

**Plans:** 4 plans in 3 waves (created 2026-09-17)

Plans:
- [ ] 254-01-PLAN.md — amend the five filed asks in place: the 2026-09-24 deadline, the risk rank, a per-phase brief; header and `**Answer:**` line fenced byte-identical (D-04 / D-06 / D-07)
- [ ] 254-02-PLAN.md — the claude quality-floor pass on 251, driven not read, stamped `review_type: self-assessed`, every finding dispositioned and none fixed (D-08 / D-11)
- [ ] 254-03-PLAN.md — five per-phase `*-REVIEW-REFUSAL.md` drafts, one adopted reading of the two registers that disagree, void if the ask is answered (D-04 / D-05 / D-09 / M-8)
- [ ] 254-04-PLAN.md — the register plumbing claude owns + `254-REVIEW-INDEX.md`, the operator's list with pre-filled unrun commands (D-02 / D-03 / D-10)

**Success Criteria** (derived at `/gsd:plan-phase 254` from `254-CONTEXT.md` D-04..D-11; the prior TBD line is preserved below rather than overwritten):
1. Each of 249, 250, 251, 252, 253 has a verdict artifact in **its own** directory — a review, or a refusal draft awaiting the operator's ruling.
2. All five bus asks carry the **2026-09-24** deadline and the rank `251 → 253 → 252 → 249 → 250`; the `to:gemini` queue is still **9** items and claude opened, answered, closed and archived **0**.
3. 251 carries a review file where it had none, and that file says in its own frontmatter that it is **not** an independent review.
4. A sweep of the five `*-VERIFICATION.md` files finds **5** `independent_review` keys where it found **4**, and all five still read `owed`.
5. `DEBT-06`'s text names both arms and its box is **still unticked**; `26 requirements` has not moved.
6. `254-REVIEW-INDEX.md` carries every finding with exactly one recommended disposition, the structural finding that **nothing reads `independent_review`**, and five pre-filled `answer`+`close` commands that claude did not run.
⛔ **A row that reads `done` or `refused` at this close is a FAILED criterion, not a better one** — no §6.3 review has run and no refusal has been ruled on.

**Success Criteria**: TBD — set at `/gsd:discuss-phase 254`. The floor `DEBT-06` already fixes: at
milestone close, **every one of 249-253 reads `independent_review: done` or carries a written refusal**,
and a row reading **neither** is an unmet requirement, not a rounding error.

⛔ **A finding is reported OPEN only after it has been DRIVEN against the tree.** On 2026-09-10 two
Phase 239 criticals were escalated as live when they had been fixed two days earlier, in an ancestor of
the reviewer's own base commit. **Each register only knows the one below it; the code is the bottom.**

⛔ **Claude may not close bus items** (the `REG-03` rule) — the deliverable of this phase is a list the
operator can rule on, per phase, with a recommended disposition and the evidence that backs it.

### Coverage

**26 requirements · 25 mapped to exactly one phase each · 1 (`DEBT-06`) held as a milestone-wide standing gate. No orphans, no duplicates.**

| Phase | Requirements | Count |
|---|---|---|
| 247 | WATCH-01, WATCH-02, WATCH-03, WATCH-04, WATCH-05, WATCH-06, WATCH-07, WATCH-08 | 8 |
| 248 | CRED-01, CRED-02, CRED-03, CRED-04 | 4 |
| 249 | MODEL-04, MODEL-05, MODEL-06, MODEL-07, MODEL-08, MODEL-09 | 6 |
| 250 | HONEST-01, HONEST-02, HONEST-03, HONEST-04 | 4 |
| 251 | REG-01, REG-02, REG-03 | 3 |
| *milestone standing gate* | DEBT-06 | 1 |
| **252** *(gap closure, added 2026-09-16)* | **no new ids** — re-closes `CRED-01`, `CRED-03`, `WATCH-04`, `HONEST-03` | **0** |
| **253** *(gap closure, added 2026-09-16)* | **no new ids** — re-closes `CRED-03`, `CRED-04` | **0** |
| **254** *(independent review, added 2026-09-17)* | **no new ids** — ⛔ **CORRECTED 2026-09-17 (`254-04`): 254 closes only the `DEBT-06` **249-253 arm**, and discharges the requirement at NEITHER this close NOR any close where the older arm is still owed.** Re-derived from the `*-VERIFICATION.md` files at this close: **ten rows unmet** (239, 241, 242, 244, 245, 249, 250, 251, 252, 253) against **four already accounted for**. 254's own arm closes with five *drafted refusals awaiting an operator ruling*, which is an accounting and not a review — so the box stays `- [ ]` per `ROADMAP.md:271`. The cell below was written when 254 was added and over-claimed; it is preserved rather than overwritten, because the over-claim is the finding this phase exists to stop repeating — **SUPERSEDED VERDICT FOLLOWS:** discharges the standing gate `DEBT-06` |  ⭐ **RE-DERIVED 2026-09-18 AFTER THE OPERATOR'S RULING — the pre-ruling figure below is KEPT, not overwritten.** **Eight rows unmet** (239, 241, 242, 244, 245, 251, 252, 253) against **six already accounted for** (238 `complete`, 240 `complete`, 243 `refused`, 246 `done`, 249 `refused`, 250 `refused`). ⛔ 249 and 250 moved by an operator RULING on a drafted refusal, NEVER by a review — recorded as the answer to `BUS-251` / `BUS-250`, both now `[CLOSED]`; 251 / 252 / 253 were DELIBERATELY left `[OPEN]` for a real §6.3 review. The box stays `- [ ]`: the older arm (239 · 241 · 242 · 244 · 245) is untouched. ⚠ **THIS ROW WENT STALE THE MOMENT THE PRIMARY BULLET WAS RE-DERIVED** — the hand-typed-list defect this family keeps re-paying, and it was found by the phase's own verifier, not by any gate. ⚠ **244 IS UNMET FOR A WORSE REASON THAN AN ABSENT KEY:** its `*-VERIFICATION.md` frontmatter is UNPARSEABLE YAML (an unquoted `: ` inside a value), so no parser can read that register at all — the same failure `STATE.md` was repaired for on 2026-09-17. PRE-RULING READING FOLLOWS: **0** |
| | **Total** | **26** |

⚠ **Phase 252 adds NO requirement and the total stays 26 — that is deliberate.** A gap-closure phase
that mints its own ids would make the denominator move and hide the reopening. **Four requirements the
milestone audit moved from ✅ satisfied to ⛔ unsatisfied are re-closed by 252, against the same ids.**

⚠ **Re-derive this from the phase directories at close, never from this table or from a summary line.**
v4.1's own close found its Progress table reading **`0 / 5 phases complete · 0 / 19 requirements
delivered`** with all five phases closed and fourteen boxes ticked, and the drift ran in **both**
directions. **A coverage check run against the wrong denominator is how a requirement survives a
milestone unnoticed** — v4.0 shipped with that defect in the requirement COUNT, v4.1 nearly shipped
with it in the phase STATUS.

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 247. Sources & Watches — the surface you now live on | 4/4 | ✅ **CLOSED 2026-09-14** — `247-VERIFICATION.md`, `verification_mode: peer-reviewed` (builder gemini / reviewer claude), **5 / 5** success criteria. ⚠ **Row corrected at the 251-04 sweep: it read `0/? · Not started` while the phase had four plans, four summaries and a peer-reviewed verification on disk** | WATCH-01..08 ✅ |
| 248. The Credential Boundary | 4/4 | ✅ **CLOSED 2026-09-15** — `248-VERIFICATION.md`, `verification_mode: peer-reviewed` (builder gemini / reviewer claude), **4 / 4** requirements. Migration `181` revokes `PUBLIC` **then** `anon` across all 13 SECURITY DEFINER functions. ⚠ G-4 **S2** (`McpAuthDoor` BYO-OAuth, live) recorded ⛔ owed. ⚠ **Row corrected at the 251-04 sweep** — and ⛔ **this phase has FOUR plans and ZERO `*-SUMMARY.md` files**, which is why a directory-count heuristic alone would have called it unfinished | CRED-01..04 ✅ |
| 249. The Model You Actually Run | 4/4 | ⭐ **REFUSED 2026-09-18 — BY THE OPERATOR, NOT BY CLAUDE.** `independent_review` moved `owed` → **`refused`** on the operator's ruling over the drafted refusal `249-REVIEW-REFUSAL.md`; claude prepared it and ruled on nothing (D-05). The ruling is recorded as the answer to **`BUS-251`**, now `[CLOSED]` — read it there. Residual risk **LOW**; the strongest of the five drafts. ⛔ **A REFUSAL IS NOT A PASS** — `verification_mode` stays `self-verified`, no §6.3 review ran, and the accepted risk is that a builder read its own work. BUG-260916-01 stays OPEN as a named input and was NOT fixed by this ruling. RE-OPEN: gemini reviewing this phase at ANY time voids the refusal and the value returns to `done`. — **SUPERSEDED VERDICT FOLLOWS:** ⚠ **`254-04` 2026-09-17 — THE REGISTER MOVED, THE ROW DID NOT: `independent_review` STILL READS `owed`, AND PHASE 254 HAS DISCHARGED NOTHING FOR THIS ROW.** The ask is **`BUS-251`**, filed 2026-09-16 `to:gemini` and **amended in place** (never re-filed) by `254-01` with a deadline of **2026-09-24** and rank **4 of 5** in the risk order `251 → 253 → 252 → 249 → 250`; it is **still `[OPEN]` and unanswered**. A refusal is **DRAFTED** at `.planning/phases/249-the-model-you-actually-run/249-REVIEW-REFUSAL.md` — `status: draft-pending-operator-ruling` — and ⛔ it becomes real only on an operator ruling (`REG-03`: claude may neither answer nor close a bus item), and is **void** if `BUS-251` is answered at any time, before or after the deadline. ⭐ Weighed as an INPUT to this row and deliberately NOT folded: `BUG-260916-01` (an llm-call timeout above 600s is accepted and cannot take effect) is an open `surface: Agentic-RAG` report squarely in this phase's domain — 254 fixes nothing. ⛔ The deadline expiring discharges nothing by itself. Full list, with the commands the operator runs: `.planning/phases/254-independent-review-of-249-253/254-REVIEW-INDEX.md`. — **SUPERSEDED VERDICT FOLLOWS:** ✅ **CLOSED 2026-09-15** — `249-VERIFICATION.md`, `status: complete`. ⛔ `verification_mode: self-verified`, `independent_review: owed` (DEBT-06). `MODEL-09` was re-measured and **closed by measurement** — a fresh sweep read 8/8 healthy — so the fix was never built for a defect that no longer existed. ⚠ `/gsd:code-review 249` afterwards found **two blockers the self-verified close had passed** (`BUS-247`), both since fixed. ⚠ **Row corrected at the 251-04 sweep** | MODEL-04..09 ✅ |
| 250. Run Honesty — the residue | 3/3 | ⭐ **REFUSED 2026-09-18 — BY THE OPERATOR, NOT BY CLAUDE.** `independent_review` moved `owed` → **`refused`** on the operator's ruling over the drafted refusal `250-REVIEW-REFUSAL.md`; claude prepared it and ruled on nothing (D-05). The ruling is recorded as the answer to **`BUS-250`**, now `[CLOSED]` — read it there. Residual risk **LOW**; the second-strongest of the five drafts. ⛔ **A REFUSAL IS NOT A PASS** — `verification_mode` stays `self-verified`, no §6.3 review ran, and the accepted risk is that a builder read its own work. RE-OPEN: gemini reviewing this phase at ANY time voids the refusal and the value returns to `done`. — **SUPERSEDED VERDICT FOLLOWS:** ⚠ **`254-04` 2026-09-17 — THE REGISTER MOVED, THE ROW DID NOT: `independent_review` STILL READS `owed`, AND PHASE 254 HAS DISCHARGED NOTHING FOR THIS ROW.** The ask is **`BUS-250`**, filed 2026-09-16 `to:gemini` and **amended in place** (never re-filed) by `254-01` with a deadline of **2026-09-24** and rank **5 of 5** in the risk order `251 → 253 → 252 → 249 → 250`; it is **still `[OPEN]` and unanswered**. A refusal is **DRAFTED** at `.planning/phases/250-run-honesty-the-residue/250-REVIEW-REFUSAL.md` — `status: draft-pending-operator-ruling` — and ⛔ it becomes real only on an operator ruling (`REG-03`: claude may neither answer nor close a bus item), and is **void** if `BUS-250` is answered at any time, before or after the deadline. ⭐ Its `250-VERIFICATION.md` `owed:` list gained ONE entry naming this apparatus; the five already there are byte-unchanged. ⛔ The deadline expiring discharges nothing by itself. Full list, with the commands the operator runs: `.planning/phases/254-independent-review-of-249-253/254-REVIEW-INDEX.md`. — **SUPERSEDED VERDICT FOLLOWS:** ✅ **CLOSED 2026-09-15** — built + self-verified by claude alone (operator instruction). ⚠ `HONEST-04`'s blocking measurement WAS taken first and the report's dichotomy was FALSE (both arms true, of different rows). ⛔ `independent_review: owed` | HONEST-01..04 |
| 251. Register Integrity | 4/4 | ⚠ **`254-04` 2026-09-17 — THE REGISTER MOVED, THE ROW DID NOT: `independent_review` STILL READS `owed`, AND PHASE 254 HAS DISCHARGED NOTHING FOR THIS ROW.** The ask is **`BUS-249`**, filed 2026-09-16 `to:gemini` and **amended in place** (never re-filed) by `254-01` with a deadline of **2026-09-24** and rank **1 of 5** in the risk order `251 → 253 → 252 → 249 → 250`; it is **still `[OPEN]` and unanswered**. A refusal is **DRAFTED** at `.planning/phases/251-register-integrity/251-REVIEW-REFUSAL.md` — `status: draft-pending-operator-ruling` — and ⛔ it becomes real only on an operator ruling (`REG-03`: claude may neither answer nor close a bus item), and is **void** if `BUS-249` is answered at any time, before or after the deadline. ⭐ **This is the row 254 changed most, and in two ways.** (1) `251-VERIFICATION.md` carried **NO `independent_review` key at all** for the phase's entire life, so every sweep counting it returned **4 of 5** and silently omitted this row — the key, plus `builder:` and `reviewer:`, were ADDED by `254-04`, never flipped. (2) `251-REVIEW.md` was written by `254-02` as a quality floor over the one phase with no review artifact of any kind: **2 critical · 0 blocker · 2 warning · 3 info**, `verdicts: still_live: 4`. ⛔ It is stamped `review_type: self-assessed` and `discharges_debt_06: false` — **it ticks NOTHING**, because claude built this phase and a builder's reading of its own work is the self-assessment `AGENTS.md` §6.3 exists to prevent. ⛔ The deadline expiring discharges nothing by itself. Full list, with the commands the operator runs: `.planning/phases/254-independent-review-of-249-253/254-REVIEW-INDEX.md`. — **SUPERSEDED VERDICT FOLLOWS:** ✅ **CLOSED 2026-09-16** — 251-01..04 shipped. ⭐ **THE REGISTER IS GREEN**: `register: 293 · parsed: 293 · skipped: 0 · duplicate ids: 0`, `293/293 carry all 5 required keys`, exit **0**, `--self-test 8/8 PASS`. 8 movers at 277-284 + 8 redirect stubs (03); the sweep **CALLED** at both GSD touchpoints and the by-hand 283-file read deleted (04). ⛔ **Plan 03's carried finding FIXED in 04**: the carve-out was `stubs.length === 1`, a COUNT, so keeper+squatter+stub read as resolved — now a SHAPE check, driven RED first. ⛔ **`[id-in-heading]` ADDED** and it caught `SEED-068`, titled `# SEED-063` since a v2.8 renumber. ⚠ **The wiring was proven by EXECUTING the fence, never by grep** — defanged to a prose mention the file still passes `grep` with **zero** runnable calls. ⛔ **No bus item was written by claude**; `251-BUS-TRIAGE.md` is a list the operator rules on, and `SEED-286` was planted by its third arm. `REQUIREMENTS.md` swept: **25 / 26 ticked, each citing an artifact; `DEBT-06` left unticked with its reason** | REG-01 ✅, REG-02 ✅, REG-03 ✅ |
| **252. Close the v4.2 audit gaps** | 5/5 | ⚠ **`254-04` 2026-09-17 — THE REGISTER MOVED, THE ROW DID NOT: `independent_review` STILL READS `owed`, AND PHASE 254 HAS DISCHARGED NOTHING FOR THIS ROW.** The ask is **`BUS-256`**, filed 2026-09-16 `to:gemini` and **amended in place** (never re-filed) by `254-01` with a deadline of **2026-09-24** and rank **3 of 5** in the risk order `251 → 253 → 252 → 249 → 250`; it is **still `[OPEN]` and unanswered**. A refusal is **DRAFTED** at `.planning/phases/252-close-the-v42-audit-gaps/252-REVIEW-REFUSAL.md` — `status: draft-pending-operator-ruling` — and ⛔ it becomes real only on an operator ruling (`REG-03`: claude may neither answer nor close a bus item), and is **void** if `BUS-256` is answered at any time, before or after the deadline. ⚠ Graded **moderate** residual risk, not low: with 253 it is the security-bearing pair `AGENTS.md` §3.1 catches, and §3.1's answer to a critical phase is to SWAP THE SEATS, not to skip one. ⛔ The deadline expiring discharges nothing by itself. Full list, with the commands the operator runs: `.planning/phases/254-independent-review-of-249-253/254-REVIEW-INDEX.md`. — **SUPERSEDED VERDICT FOLLOWS:** ✅ **CLOSED 2026-09-16** — `252-VERIFICATION.md`, **5 / 5** success criteria, 7 of 9 warnings closed (W-5/W-9 needed no work). ⛔ `verification_mode: self-verified`, `independent_review: owed` (**DEBT-06**; `BUS-256`). Backend at the locked ceiling with an **identical failing node-id set** (0 new, 0 gone); tsc 67→65; count-gate failing set ∅ before and after. ⭐ **Its own re-derivation refuted SEVEN inherited claims, three of them in its own plans** — including a B-2 test probe that was a **FALSE GREEN** (`logging_sink` redacts `sk-` before caplog, so it passed pre-fix), and a ROADMAP row D-37 asserted was already ticked and was not. ⭐ The new `check-schema-acl-parity.cjs` fired for **real on run one**: three function ACLs outside migration 181 were mirrored by nothing, including `resize_embedding_column` — the RPC `BUG-260911-01` found callable unauthenticated in production, which NULLs every vector, and which **every greenfield deploy re-opened**. ⛔ Owed: G-4 **S2** live, migration 181 not in cloud, `connectors.py` extraction at its **seventh** landing | re-closes CRED-01, CRED-03, WATCH-04, HONEST-03 |
| **253. The bootstrap artifact tells the whole truth** | 3/3 | ⚠ **`254-04` 2026-09-17 — THE REGISTER MOVED, THE ROW DID NOT: `independent_review` STILL READS `owed`, AND PHASE 254 HAS DISCHARGED NOTHING FOR THIS ROW.** The ask is **`BUS-257`**, filed 2026-09-16 `to:gemini` and **amended in place** (never re-filed) by `254-01` with a deadline of **2026-09-24** and rank **2 of 5** in the risk order `251 → 253 → 252 → 249 → 250`; it is **still `[OPEN]` and unanswered**. A refusal is **DRAFTED** at `.planning/phases/253-the-bootstrap-artifact-tells-the-whole-truth/253-REVIEW-REFUSAL.md` — `status: draft-pending-operator-ruling` — and ⛔ it becomes real only on an operator ruling (`REG-03`: claude may neither answer nor close a bus item), and is **void** if `BUS-257` is answered at any time, before or after the deadline. ⚠ Graded **HIGH** residual risk — the weakest of the five drafts, and saying so is the point; flattening the grading is how a refusal set stops carrying information. ⚠ `status: gaps_found` in its frontmatter and `COMPLETE` in this row both stand: neither refutes the other (M-4). ⛔ The deadline expiring discharges nothing by itself. Full list, with the commands the operator runs: `.planning/phases/254-independent-review-of-249-253/254-REVIEW-INDEX.md`. — **SUPERSEDED VERDICT FOLLOWS:** ✅ **COMPLETE 2026-09-17 — 5/5 success criteria, RE-DRIVEN independently after a gap-closure round.** ⛔ **THE `0 gaps` BELOW IS PRESERVED RATHER THAN OVERWRITTEN, BECAUSE IT WAS WRONG AND HOW IT WAS WRONG IS THE FINDING.** That 14/14 verification passed over **two live criticals**, which `/gsd:code-review 253` then found (`253-REVIEW.md`: CR-01 the gate never opened `supabase/full-schema.sql`, the artifact it exists to protect; CR-02 `_strip_sql_comments`' `line.find("--")` loses a REVOKE behind a string literal — a false GREEN in the **permissive** direction). The operator locked five findings; **`253-03` (gap-closure round 1)** closed them and FF-merged at `feb3d4752`. ⭐ **A review OF THAT ROUND (`253-REVIEW-R2.md`) found TWO MORE BLOCKERS — both the same vacuity defect class the phase exists to kill.** `R2-CR-01`: the parity gate's non-vacuity floor counted migration **FILES**, not tuples **PARSED** — driven, neutering both ACL regexes printed `migrations scanned: 148 · mirrored: 0/0` then `schema ACL parity OK` and **EXITED 0**; `MIN_ACL_TUPLES = 100` (real count 133) now exits 2. `R2-CR-02`: **`backend-tests` CI has NEVER been green — 40 of 40 runs failed**, because `psycopg2-binary` sits in the operator's local venv and **not** in `requirements.txt`, so CI died in COLLECTION and ran zero tests — meaning both fences this phase added were **executed by nothing**. ⛔ **The fix does NOT make that job green and cannot** (71-failure baseline); a **dedicated must-pass step** runs the three `scripts/` fences alone instead — 26 passed, exit 0. Both fast-fixed inline under **G-3** (`3cedc6e51`, `71affadd1`), so **no round 2 was spent and G-7 stands at 1 of 2**. `--self-test` **29 → 35 → 37** arms. ⭐ **CR-01 and R2-CR-01 were each re-driven by the ORCHESTRATOR on the merged tree**, not taken on an executor's word: stripping three `resize_embedding_column` REVOKEs from `full-schema.sql` → **exit 1** (was 0); neutering the regexes → **exit 2** (was 0); `full-schema.sql` md5 `a4f570396a44035102567ec1e3b7ff62` restored identical both times. ⚠ **WR-02 turned out to have TWO independent causes, not one** — the hook's path extraction AND the `.claude/settings.json` matcher (operator-approved 2026-09-17) — and **fixing either alone is inert in a live session**. ⛔ **`.claude/settings.json` measures `9 / 4 / 202`, FIRES G-5, and was in NEITHER register for its entire life** — `.claude/` is EXEMPT from `check-hot-file-ledger.cjs`, the **fourth** file this one plan found structurally invisible to its own guardrail. **`SEED-290`** records `253-REVIEW-R2.md`'s 13 unfixed findings with a re-open trigger each; **WR-05 is the one with teeth** — `E'…'` escape strings defeat **BOTH** lexers in the permissive direction, the same defect as CR-02/CR-03 surviving one syntax over, latent (zero `E'` in the corpus) and **unfenced**. ⚠ **`WR-04` is a FALSE docstring this phase itself added**, and it is the stated reason another finding was deferred — a deferral resting on a refuted premise. ⛔ `independent_review: owed` (**DEBT-06** / `BUS-257`) — the **SIXTH** consecutive self-verified close, not the fifth. ⛔ **`schema-acl-parity.yml` HAS NEVER EXECUTED**: `gh run list` → `HTTP 404: workflow not found on the default branch` — the file does not exist on `master`, so `--self-test`'s only runner has never run. — **SUPERSEDED VERDICT FOLLOWS:** ✅ **COMPLETE 2026-09-17 — `253-VERIFICATION.md`, 14/14 must-haves, 5/5 success criteria, 0 gaps, G-7 clear.** ⭐ **The verifier RE-MEASURED rather than read**: re-ran the greenfield harness end to end (scratch DB, `access_token_ciphertext` as `authenticated` → `permission denied`, operator data 169 docs / 7,995 chunks intact, 0 scratch DBs left behind), drove the partial-revoke and comment-swallow REDs itself, drove the **TABLE half** RED beyond what the SUMMARY claimed, drove the hook in an **isolated** `CLAUDE_PROJECT_DIR` with the defect still planted, and re-derived **7 of 12** ledger triples exactly. Both disclosed deviations judged SOUND — 253-01's substituted RED property proved from git (`3192f480f` adds **0** GRANT/REVOKE lines), and per-COLUMN keying is semantically correct because `GRANT SELECT (a,b)` IS two single-column grants. ⛔ **TWO ITEMS OWED, named rather than implied: (1) the `schema-acl-parity` CI JOB HAS NEVER EXECUTED** — confirm on the next push touching a matching path; it cannot be driven locally, and the PRIMARY half (the hook) was driven twice. **(2) `independent_review: owed`** — DEBT-06 / `BUS-257`, the FIFTH consecutive self-verified phase. — EXECUTION: both plans merged to `develop` (`a56d6fea1`, `e7200477d`). ⭐ **CR-02/CR-03 CLOSED, and the gate's reach is the measurement: it saw `16/16` function tuples and now sees `133/133` — 61 function + **72 table/column** tuples from 32 statements across 12 migrations, where the shipped `aclsIn` returned **zero** table entries.** The RED was reproduced before the fix: deleting the one `REVOKE EXECUTE ON FUNCTION public.resize_embedding_column(integer) FROM PUBLIC` line still printed `missing: 0`, exit 0 — that is the RPC `BUG-260911-01` found callable unauthenticated, which NULLs every vector in `document_chunks` and `skill_embeddings`. `--self-test` is **29/29**, and the arms were themselves falsified against three planted defects (3, 5 and 4 arms failing respectively) rather than trusted. ⚠ **One arm was VACUOUS and was caught by that falsification** — the dollar-quote arm PASSED against its own planted defect and was replaced with a false-positive control. ⭐ **MC-4 CLOSED: the gate is now invoked by something other than a human** — `grep` for it across `.github/` + `.claude/` read **0** and now reads **8**; the PostToolUse hook was driven loud-vs-silent with the defect **still planted**, so the negatives prove the path filter and not a clean tree. ⛔ **The CI workflow was NOT driven from here and the SUMMARY says so.** SC#5: three absent ledger rows added with their detail sections in the same commit, twelve CR-08 triples re-derived — and **two were findings, not bookkeeping**: `sourceHealthVocabulary.ts` had predicted its own firing and 252-03 was that touch (wrong by two phases), and `WatchedFoldersSection.tsx` CHANGED STATE from `no (3 phases)` to FIRING at 4. ⚠ **D-07 was NOT implemented as literally worded and that is stated, not glossed**: per-column-SET tuples were **measured** to produce 7 false reds against a correct supplement (a migration history vs a final state) with zero genuinely absent columns, so keys are per-COLUMN — strictly more sensitive. `SEED-266` arm (a) recorded answered; arms (b)/(c) left open. CLAUDE.md size gate **104,538 chars**, backend ceiling **71 / 0 collection errors**, D-11 md5 pair identical. ⛔ `independent_review: owed` (**DEBT-06**, `BUS-257`) — fifth consecutive self-verified phase. — `253-01` CLOSED 2026-09-16 (`253-01-SUMMARY.md`). ⭐ **CR-01 CONFIRMED LIVE AND CLOSED, measured as `authenticated` on a real scratch database**: `SELECT access_token_ciphertext FROM connector_tokens` **SUCCEEDED** before, `permission denied` after; `anon` held `app_settings` + `user_settings` (BUG-260911-01's exact pair) and no longer does; 1045 derived violations → **0**. All seven ACL-bearing tables mirrored, §5 at **20** columns (D-17's 19 + `created_by`, MC-3), tail md5-identical in one commit. ⛔ **THE HARNESS'S FIRST RUN FOUND SOMETHING NOBODY WAS LOOKING FOR: `supabase/full-schema.sql` DID NOT APPLY AT ALL** — `type "vector" does not exist` (42704), because pg_dump's `search_path = ''` at `:29` survives into §6's unqualified `(vector, uuid, …)`, introduced at `a7efe17d1` (Phase 252-01) and rolling back the ENTIRE greenfield paste. Fixed with a §0 `SET search_path = public;`, **not** by qualifying the type (that would break `check-schema-acl-parity.cjs`). ⚠ MC-2 re-derived: **32** statements across **12** files, not 25. ⚠ MC-4 confirmed: the ledger gate reads `watched: 0` here and cannot be cited — D-23 is manual on `253-02`. Backend ceiling **71 / 0 collection errors**, intact. ⛔ `independent_review: owed` (**DEBT-06**) — original scoping note follows: added 2026-09-16 from `/gsd:code-review 252` (`252-REVIEW.md`: 2 critical, 9 warning, 3 info). ⛔ **CR-01 pre-dates 252 and is NOT its regression** — what 252 added is a §6 header claiming *"table OR function"* over a gate enforcing only functions. Measured at scoping: the supplement mentions `connector_tokens` **zero** times, and its `connector_connections` column grant is **five columns behind** `_TABLE_SELECTABLE_KEYS` (16 vs 19), so every connector list read is `42501` on a greenfield DB. ⭐ **CR-02 driven, not reasoned**: one deleted `REVOKE … FROM PUBLIC` line → `missing: 0 []`. ⛔ `DEBT-06` applies — this one gets a reviewer or says in writing why not | re-closes CRED-03, CRED-04 |
| **254. Independent review of 249-253** | 4/4 | ✅ **254-04 CLOSED 2026-09-17 — all four plans executed; the three registers claude owns have moved and the fourth is in front of the operator.** `254-04` added the `independent_review` key that was ABSENT from `251-VERIFICATION.md` for its whole life (a sweep now finds **5** rows where it found **4**), amended the inline comment on the other four, amended `DEBT-06`'s text into two RE-DERIVED clauses — **ten unmet · four already accounted for** — and wrote `.planning/phases/254-independent-review-of-249-253/254-REVIEW-INDEX.md`. ⭐ **The derivation found a row NEITHER arm of `DEBT-06` had ever named: `239` reads `independent_review: owed` on disk.** A hand-typed list is the defect this family keeps re-paying. ⛔ **NOTHING WAS FLIPPED TO `done` OR `refused` AND `DEBT-06` IS NOT TICKED — that is the deliverable, not a shortfall.** All five rows still read `owed` (asserted by `yaml.safe_load`, never by grep), all five still read `verification_mode: self-verified`, the box is still `- [ ]`, and claude ran **no** `agent-bus.sh answer` or `close`. ⚠ **A defect in this plan's OWN fence, driven rather than argued:** its acceptance check `grep -h '^independent_review:' | grep -cE '(done|refused)'` reads **5**, because every new comment contains the words `done` and `refused` while EXPLAINING that neither applies — a fence that cannot tell a value from its own explanation, the same lexer class 253 fixed for SQL comments. The value-only reading is **0** and `yaml.safe_load` returns the string `owed` five times. — **SUPERSEDED VERDICT FOLLOWS:** 🔄 **EXECUTING 2026-09-17 — waves 1 and 2 CLOSED, `254-03` done, `254-04` (wave 3) is all that remains.** `254-01` `57df2665e` amended the five filed asks **in place** — deadline **2026-09-24**, rank `251 → 253 → 252 → 249 → 250` — with nothing opened, answered, closed or archived (`REG-03` intact). `254-02` `5040048e6` wrote `251-REVIEW.md`, the quality floor over the one phase with no review artifact of any kind: **2 critical · 0 blocker · 2 warning · 3 info**, `verdicts: still_live: 4`, `discharges_debt_06: false` — ⛔ it ticks nothing and `BUS-249` stays OPEN. `254-03` `c551be798` → `d2dc1358e` wrote **five `*-REVIEW-REFUSAL.md` drafts**, one in each reviewed phase’s own directory, every one `status: draft-pending-operator-ruling` and every one **void if its bus ask is answered**, before or after the deadline. ⭐ **They are graded, not uniform:** 253 **HIGH** and 252 **moderate** (the security-bearing pair `AGENTS.md` §3.1 catches — §3.1’s answer to a critical phase is to SWAP THE SEATS, not skip one), 251 low-moderate, 250 and 249 low. ⭐ **The M-8 adopted reading is byte-identical across all five by construction and by fence** (section-body md5, `sort -u` == 1), **driven RED** on a one-word change and restored to an identical md5 pair — so 254 states one reading of the two registers that disagree rather than inventing five. ⛔ **`251-REVIEW.md` is barred from 251’s own risk argument**: using a builder’s reading of its own work to argue the same builder’s refusal is low-risk is circular. ⚠ **TWO INHERITED CLAIMS DRIVEN AND REFUTED, corrections recorded beside their originals: (1) `schema-acl-parity.yml` HAS now executed** — `gh run list` → `completed success`, 2026-09-17T14:05:28Z on `develop`, where 253’s verification recorded `HTTP 404 / never run`; and **`backend-tests` is GREEN for the first time ever**, two successes the same day after 40 consecutive failures. Still owed: *one green run proves the job executes, not that it can fail.* **(2) A raw whole-file `md5sum` against `git show HEAD:` is UNSOUND here** — it reports a **false tamper** on `251-REVIEW.md` (27789 vs 27327 bytes = exactly its 462 lines; blob LF, worktree CRLF), on a file `git status` calls clean. ⛔ **No register moved and `DEBT-06` is not ticked** — that is `254-04`’s three writes plus the operator’s fourth — **SUPERSEDED VERDICT FOLLOWS:** 📋 **PLANNED 2026-09-17 — 4 plans in 3 waves.** Wave 1: `254-01` amends the five already-filed asks in place with the **2026-09-24** deadline and the risk rank `251 → 253 → 252 → 249 → 250` (D-06 — ⛔ no re-file, and `scripts/agent-bus.sh` has **no `amend` verb**, so it is a hand edit of the item BODY with the header and the bare `**Answer:**` line fenced byte-identical); `254-02` runs the claude quality-floor pass on **251**, the only one of the five with no review file of any kind, landing at `251-REVIEW.md` stamped `review_type: self-assessed`. Wave 2: `254-03` drafts five per-phase `*-REVIEW-REFUSAL.md`, ⛔ **draft-pending-operator-ruling** — only the operator makes a refusal real (D-05 / `REG-03`). Wave 3: `254-04` moves the three registers claude owns and writes `254-REVIEW-INDEX.md`, the list the operator rules on with its `answer`+`close` commands pre-filled and unrun. ⭐ **The one measured thing that changes a register today: `251-VERIFICATION.md` carries NO `independent_review` key at all**, so a sweep counting `independent_review: owed` returns **4** and silently omits it — the same invisibility class as a hot file with no ledger row. ⛔ **Nothing is flipped to `done` or `refused` and `DEBT-06` is NOT ticked**: the amendment (D-02) widens it to ten phases, 254 closes only the **249-253 arm**, and the **238/240/241 + 242-246 arm stays owed**. ⚠ Seeds sweep re-run once the plans existed — `297/297 parsed · 0 duplicate ids`, exit 0, **1 match (`SEED-177`, a path collision on `ROADMAP.md`) routed NOT FOLDED**; the hot-file ledger gate reads `subject: 15 · watched: 0`, which means *nothing to see*, never *clear* — **SUPERSEDED VERDICT FOLLOWS:** ⬜ **NOT STARTED — added 2026-09-17** by operator instruction, as the phase that discharges `DEBT-06` rather than carrying it forward a seventh time. Scope measured at scoping: **five** `*-VERIFICATION.md` files reading `verification_mode: self-verified` (249, 250, 251, 252, 253). ⛔ The reviewer must be the agent that did **not** build; `/code-review ultra` stays ruled out on cost | discharges DEBT-06 |

⚠ **8 / 8 v4.2 phases closed · 15 / 26 requirements satisfied · 6 partial · 5 unsatisfied.** ⭐ **UPDATED 2026-09-18 at Phase 254's CLOSE** — the numerator moves at a phase close, which is `/gsd:verify-work`'s call, and 254 re-verified `passed`. ⛔ **THE REQUIREMENTS FIGURE DOES NOT MOVE**: `DEBT-06` is still unticked, because its older arm (239 · 241 · 242 · 244 · 245) is untouched and 251 / 252 / 253 remain `owed` by the operator's deliberate choice. **v4.2 is complete on PHASES, not on `DEBT-06`.** PRIOR READING: ⚠ **7 / 8 v4.2 phases closed · 15 / 26 requirements satisfied · 6 partial · 5 unsatisfied.**

⛔ **THE `7 / 7` THAT STOOD HERE UNTIL 2026-09-17 IS SUPERSEDED AND PRESERVED, NOT OVERWRITTEN.** It was
true of the milestone as it stood, and went stale the moment **254** was added — the same way `5 / 5`
went stale when 252 and 253 were added, recorded directly below. **The denominator moves when a phase is
added; the numerator moves only when one closes.** The requirement figures are UNCHANGED and are NOT
re-derived here: 254 mints no new ids, so the 26 never moved.

⛔ **THE `5 / 5` THAT STOOD HERE UNTIL 2026-09-17 IS SUPERSEDED AND PRESERVED, NOT OVERWRITTEN.** It was
true of the milestone as SCOPED — 247-251 — and went stale the moment **252** and **253** were added as
gap-closure phases, each with its own directory, plans, summaries and verification on disk. The table
directly above it already carried seven rows while the line beneath it said five. ⭐ **Re-derived from the
phase directories, never from this line** — the same rule this section states about itself, for the third
time in two milestones. The requirement figures are UNCHANGED and are NOT re-derived here: 252 and 253
deliberately mint no new ids, so the denominator never moved.

⛔ **THE `25 / 26` THAT STOOD HERE UNTIL 2026-09-16 IS SUPERSEDED, AND IT IS PRESERVED RATHER THAN
OVERWRITTEN BECAUSE HOW IT WAS WRONG IS THE FINDING.** It read **`5 / 5 phases complete · 25 / 26
requirements delivered`** — and the phase count was right, the denominator was right, and **the
numerator was derived from checkboxes that each cited a real artifact.** Nothing about it was careless.
It was wrong because **every source it consulted was a phase's account of itself**: five
`*-VERIFICATION.md` files reading `passed`, `REQUIREMENTS.md` boxes ticked at the 251-04 sweep, a green
backend gate, a green seeds register, a green ledger gate.

⭐ **The milestone audit read ACROSS phases instead of within them, and four requirements moved from ✅
to ⛔** — a migration that is correct and cannot reach a new deployment (`CRED-03`), a handler that logs
the credential the same phase refused to store (`CRED-01`), a card that reports a sync it did not
perform (`WATCH-04`), and a panel with two run-state surfaces of which one was made honest
(`HONEST-03`). **Not one was catchable by the phase that shipped it**, because each is a seam between
two things that are individually correct.

⚠ **Re-derive from the phase directories at close, never from this line** — and note that this time the
drift was not in the bookkeeping. The bookkeeping was faithful to registers that were each telling the
truth about their own half.

⚠ **RE-DERIVED FROM THE PHASE DIRECTORIES AT THE 251-04 SWEEP, and it moved in both directions again.** The previous reading — `4 / 5 · 14 / 26` — was itself a correction made at Phase 250's close, and it had **already gone stale**: three rows in the table above still read `0/? · Not started` for phases carrying a peer-reviewed `*-VERIFICATION.md` on disk. ⛔ **The one requirement outstanding is `DEBT-06`**, and it is outstanding for a real reason rather than a bookkeeping one: **no independent §6.3 review has run** for 238/240/241, and 249 and 250 each closed `self-verified` with `independent_review: owed`. ⭐ **`BUS-247` is the argument for it in one paragraph** — a self-verified close shipped two blockers with every gate green, six fences driven red and three live browser scenarios, because neither blocker was gate-catchable. **A code-review pass is not a peer review.**

⚠ **Plan and summary counts are NOT interchangeable, measured here:** 247 has 4 plans / 4 summaries, **248 has 4 plans and ZERO summaries**, 249 has 4 / 1, 250 has 3 / 1, 251 has 4 / 4. A sweep that counted `*-SUMMARY.md` would have called 248 unstarted while its peer-reviewed verification sat beside it. **The VERIFICATION artifact is the authority for status; the PLAN count is the denominator.**

⚠ **CORRECTED 2026-09-15 AT PHASE 250'S CLOSE — this table read `0 / 5 phases complete · 0 / 26`
while FOUR phases were closed**, which is the same rot the v4.1 ROADMAP carried to its own
archive. ⚠ **AND THE REQUIREMENT TALLY IS DERIVED, NOT ASSERTED:** `REQUIREMENTS.md`'s checkboxes
read `MODEL 6/6`, `HONEST 4/4`, but **`WATCH 0/8` and `CRED 0/4` — both phases closed with every
box still unticked.** The `14` above counts 247's and 248's requirements as delivered on the
authority of `STATE.md`'s closure records, **not** on the authority of the checkboxes, and
⛔ **claude did not tick them**: flipping a box for work claude neither built nor reviewed would be
a claim it cannot back. **Phase 251 (`REG-01..03`) is where that gets swept**, and this is a live
example of exactly what `REG-02` exists for.

**Guardrails firing (v4.2):**

- **G-2 sketch-first:** **Phase 247 — binding, sketch BEFORE plan.** Phase 250 for `HONEST-03` / `HONEST-04`; Phase 249 light, only if discuss-phase surfaces a visual decision on the picker. **Phases 248 and 251 need no sketch** — refusal copy is a sentence, and 251 has no product surface.
- **G-3 lightweight commands:** `WATCH-06`, `WATCH-07` and plausibly `MODEL-07` are `/gsd:fast` candidates at ≤ 1 file / ≤ 10 lines with no schema or API surface. **Counting them as plans is exactly how v4.1's 4-6 plans of substance became 17.**
- **G-4 lived-experience UAT:** Phase 247 (mandatory — three operator-defined scenarios, set at scope-time, driven in Chrome), Phase 250 (panel + todo honesty), Phase 249 (the model picker).
- **G-5 hot files:** audited at discuss-phase against **`docs/HOT-FILE-LEDGER.md`**, enforced by `node scripts/check-hot-file-ledger.cjs <phase>`. ⛔ **`backend/app/api/connectors.py` carries an OWED extraction at its sixth landing** (247 / 248) and **`backend/app/config.py`'s `MODEL_CAPABILITIES` seam is owed at 48 phases** (249) — either one landing again must say why it is not the next. ⚠ `run_producer.py` and `todos_service.py` have **no row at all** (250). ⚠ **`retrieval_service.py`'s extraction, owed since 231 with 241 as the deliberate second landing, must be PROPOSED FIRST if any phase here touches it.**
- **G-7 gap-closure cap:** `node scripts/check-gap-closure-rounds.cjs <phase>` at every `gaps_found`, before emitting any `--gaps` routing. ⛔ **A closure round may never introduce a new user-facing capability** — that is a phase, not a gap.
- **G-8 plan-count proportion:** **3-5 plans per phase; above 6, CONTEXT.md names what genuinely cannot share a worktree.** This is the **governing** guardrail of the milestone, for the reason written at the top of this section.
- **SC#10 cross-provider:** Phase 250 (mandatory — streaming + agent loop) and Phase 249 (`MODEL-04` / `MODEL-05` — provider routing). Phases 247, 248 and 251 touch no streamed state and are deliberately **not** flagged.
- **Threat model:** **Phase 248 only, and mandatory there.** No other phase crosses a trust boundary; flag one if a discuss-phase surfaces otherwise.
- **Reported-bugs mandate:** every requirement here originates in `.planning/reported-bugs/`. At each `/gsd:discuss-phase`, re-list open `surface: Agentic-RAG` reports, fold the matching ones, and **write the routing back into each report's frontmatter** (`status` + `folded_into` / `re_open_trigger`). ⚠ **`BUG-260911-01` and `BUG-260910-03` are measured FIXED and must be flipped to `closed`** — bookkeeping, not work; leaving them `open` is what made two of three registers stale at scoping.
- **Seeds mandate:** `SEED-172`, `SEED-040`, `SEED-135` (249) and `SEED-224` (if `retrieval_service.py` is touched) are **answered by editing the seed**, not by shipping the code. Phase 251 then sweeps what this milestone itself planted.
- **Cloud parity:** ⭐ **nothing is owed at open** — migrations through **180** are applied and verified in cloud, and `production` is level with `develop`. Phase 248's expected migration (**`181`**) is **security-bearing**: its code half and its SQL half must reach cloud in **one operation**, and `get_advisors(security)` runs as part of that promotion (`CRED-04`).

---

## v4.1 Ship It & Feel It — SHIPPED 2026-09-13

**5 phases** (242-246, no inserts), **25 plans**, migrations **177-180**, 3 days, git tag `v4.1`.
**18 ✅ delivered · 1 ⛔ unmet BY MEASUREMENT, of 19 requirements.**
Full detail: [`milestones/v4.1-ROADMAP.md`](milestones/v4.1-ROADMAP.md) ·
requirements: [`milestones/v4.1-REQUIREMENTS.md`](milestones/v4.1-REQUIREMENTS.md) ·
audit: [`milestones/v4.1-MILESTONE-AUDIT.md`](milestones/v4.1-MILESTONE-AUDIT.md) ·
phases: `.planning/phases/24{2,3,4,5,6}-*`

A deliberate **consolidation** milestone — no new capability axis; every requirement closed something
already sitting in a register. **The ship claims stopped being claims**: all four `SHIP` items closed
against the database and the branch rather than the deploy record (20/20 migration checks measured in
cloud; `SHIP-04` confirmed already landed; `SHIP-02` **retired in writing** because the shape its
drive needed exists nowhere). **The chat surface stopped getting in the way**: one unconditional
thinking renderer, a 60 ms coalescer, and a follow-scroll finally driven with a **real wheel** —
0 px drift, 0 app scrolls, closing `BUG-260823-01` after two prior fixes that had passed on synthetic
events. All five `SHELL` criteria were **driven in a browser**, `SHELL-03` only on the second attempt
after being driven FALSE. **v4.0's verification debt got verdicts**: rows discharged or retired in
writing, and a greppable `verification_mode` marker shipped **with zero prose deleted**, so a
self-verification can no longer read as a review.

⭐ **The milestone's best work is a requirement it did NOT deliver.** Phase 246 set out to fix the
small-tenant recall cliff by raising `hnsw_ef_search` to 200 and proved by `EXPLAIN (ANALYZE)` that
**no value fixes it through the index**: 40/60/80 walk the index and return **ONE row** (~0.05 recall,
~4 ms); 100/150/200 reach recall 1.000 by **sequential scan** (~1,100 ms). Shipping 200 would have
cost **every** tenant ~1.1 s a query to cure a cliff only small tenants have. Default reverted to 40;
`RECALL-01` left open with `SEED-273` (`hnsw.iterative_scan`) as the remaining path. ⚠ Phase 241's
contrary conclusion **never inspected an execution plan**.

⭐ **Two-agent separation returned.** 246 is the **first phase since `OV-SOLO-01` was re-armed** to
carry `verification_mode: peer-reviewed` (gemini built, claude reviewed at three gates); the one
commit inside it authored by the reviewer is **named** self-verified rather than folded into the
headline — and the close audit then found `INT-01` inside exactly that commit.

⛔ **Open at close:** `RECALL-01` (above) · migrations **179 and 180 are NOT in cloud** (measured) ·
`origin/production` **287 commits behind `develop`**, so v4.1's own output is undeployed — the state
v4.1 was opened to end for v4.0 · 245's four named residues, including the independent §6.3 review
still owed by 238 / 240 / 241 · `SEED-172`, whose trigger **fired at this close** (local models still
cannot be registered, timed out or given a context window through the UI) · `SEED-272`.

⚠⚠ **THE CLOSE'S OWN FINDING, recorded because it recurred one milestone after being corrected:**
the Progress table in this file read **`0 / 5 phases complete · 0 / 19 requirements delivered`** with
all five phases closed and fourteen boxes ticked — and that is the register the close reads to build
the archive. Drift ran in **both** directions: `SHIP-02/03/04` unchecked while their traceability rows
carried full closing evidence; `SHELL-04/05` and `RECALL-02` ticked while their rows read *"Pending"*.
**A coverage check run against the wrong denominator is how a requirement survives a milestone
unnoticed** — v4.0 shipped with that defect in the requirement COUNT, v4.1 nearly shipped with it in
the phase STATUS. Re-derive from the phase directories, never from a summary line.

## v4.0 Connected Knowledge — SHIPPED 2026-09-10

**14 phases** (228-241, no inserts), **62 plans**, migrations **153-156 / 166-176** (15 files; **157-165 unused**, 171 reserved), 6 days, git tag `v4.0`.
**33 ✅ delivered · 5 ⛔ not ticked, of 38 requirements.**
Full detail: [`milestones/v4.0-ROADMAP.md`](milestones/v4.0-ROADMAP.md) ·
requirements: [`milestones/v4.0-REQUIREMENTS.md`](milestones/v4.0-REQUIREMENTS.md) ·
audit: [`milestones/v4.0-MILESTONE-AUDIT.md`](milestones/v4.0-MILESTONE-AUDIT.md) ·
state at close: [`milestones/v4.0-STATE-at-close.md`](milestones/v4.0-STATE-at-close.md) ·
phases: `milestones/v4.0-phases/`

⭐ **The premise came true: a source is connected once and then read by itself.** Four families —
Google Drive, OneDrive/SharePoint via Microsoft Graph, **any** MCP file server, and mail — sit on
ONE `browse / list / read / check` contract. The contract was then *tested* rather than asserted:
**239 bound GitHub MCP as a second file server entirely through the UI, proven zero-code by HASH**
(HEAD identical before and after), and **240 proved mail is a SHAPE, not a fourth adapter** —
`sources/base.py` byte-identical, no registry key, delegation `+35/-0`.

⭐ **Connection-scoped visibility is enforced in RLS at all four sites**, provenance rides every row
from the first write, a disconnect **freezes** rather than deletes, and a `missing` verdict may be
written only from a listing whose final page asserted completeness (`H-5`) — so an incomplete
listing can never delete a customer's documents.

⭐ **The anti-injection discipline was ACTUALLY ATTACKED, and it held.** 13/13 taxonomy attacks
refused offline, **8/8 mutations caught loudly at the point of use**, and the live drive planted the
payload in a really-synced Drive document: **all 8 native-roster providers refused it with zero
write-tool invocations**, three surfacing the injection to the user unprompted.

⚠ **THE MILESTONE'S SHARPEST FINDING IS A DEFECT IT FOUND IN ITSELF.** Phase 241 measured filtered
vector recall at customer scale and it was **REAL**: at the shipped `hnsw.ef_search = 40`, a tenant
owning 0.2% of a 100,000-chunk corpus scores `recall@20` **0.040**, and three named documents
silently stop being found. `ef_search = 200` restores **1.000**. ⛔ **The knobs ship as operator
settings but the DEFAULT is unchanged, so `QUEUE-06` is NOT ticked** — out of the box the
requirement is still not met. ⚠ The degradation is a **cliff, not a slope** (the "control" rows ran
on a SEQ SCAN), so an install can cross it with **no deploy and no setting change**.

⚠ **THE PREMISE OF PHASE 241 WAS REFUTED BEFORE IT STARTED, AND THAT IS THE LESSON.** There was no
Phase 230 baseline: `scripts/measure-recall.py` ran `content ILIKE`, never touched the vector path,
scored every miss `rank = 1` and printed **`MRR 1.000`** on the live corpus. **A harness that cannot
report a failure had been reporting success.**

⛔ **THREE PHASES CLOSED WITHOUT AN INDEPENDENT §6.3 REVIEW — 238, 240, 241.** Gemini has been
unavailable since 2026-09-09 and `/code-review ultra` is ruled out on cost, so their verdicts are
the builder's own. **A self-verification is not a review, and this milestone contains three.**

⛔ **TWO UAT SETS ARE OWED AND CREDENTIAL-BLOCKED, not skipped** — 238's nine live rows need one
Azure app registration; 241's row 5 needs a read-capable cloud DSN. ⚠⚠ **241's row 5 has a
DEADLINE: it dies the moment migration 176 reaches cloud.** ⛔ **Cloud is 15 migrations behind**
(`153-156`, `166-176`); v4.0 has not deployed.

⚠ **CORRECTED 2026-09-13 (Phase 245) — the paragraph above is preserved, not deleted, because the
rot being visible IS the finding.** The "238's nine live rows need one Azure app registration" half
is **FALSE, and was false when written.** All nine of 238's M rows were **DRIVEN LIVE on 2026-09-07** (`238-VERIFICATION.md:213-231` — 7 full pass, 2 half at the time; **four defects found by driving and NONE by the 15-case unit suite**). The operator completed the Azure registration *hours after* `238-SUMMARY.md` was written. **The blocker was
discharged six days before six live registers stopped saying so.** ⛔ 241's row 5 half **remains
true** — it still needs a read-capable cloud DSN, and it still dies when migration 176 reaches cloud.

⭐ **The method failure worth carrying forward, committed three times in one hour by the audit
written to catch it:** a file listing is not a review; a review is a claim ABOUT code; a summary is a
claim about a moment. **Each register only knows the one below it, and the code is the bottom.**
Two Phase-239 CRITICALs were escalated as live and open when they had been fixed two days earlier,
in an ancestor of the auditing commit. **Drive it, or do not report it.**

---

## v3.9 Connections: Any Service, Any Tool — SHIPPED 2026-09-04

**16 phases** (210-217 CORE + inserts 214.1 / 217.1 + 220-227; 218 ABSORBED into 217.1; **219
DEFERRED**), **111 plans**, migrations **127-129 / 140-141 / 150-152**, 9 days, git tag `v3.9`.
**34 ✅ delivered · 3 ⚠ partial · 2 ⛔ never-driven, of 39 requirements.**
Full detail: [`milestones/v3.9-ROADMAP.md`](milestones/v3.9-ROADMAP.md) ·
requirements: [`milestones/v3.9-REQUIREMENTS.md`](milestones/v3.9-REQUIREMENTS.md) ·
audit: [`milestones/v3.9-MILESTONE-AUDIT.md`](milestones/v3.9-MILESTONE-AUDIT.md) ·
phases: `milestones/v3.9-phases/`

⭐ **The one sentence it was measured against came true.** A person connects a **service** — not a
protocol — sees every tool it offers, grants each one individually, and uses it by name in chat and
as a specific step on the canvas. **Nothing is per-vendor:** Notion connects by OAuth with no
developer console and returns 41 tools for zero lines of tool code; six Google applications sit
under one token with 11/11 live writes.

⚠ **Phase 219 (`A Connected Source Feeds the Library`) is DEFERRED, not dropped** — operator
decision 2026-09-04, carried into the **Connected Knowledge** milestone with `LIB-08/09/10` and
`SEED-209/210/211/212`. Its SC#1 (*"watched on a schedule"*) is word for word v3.9's own binding
re-open trigger for those four security seeds, whose scope text reads: shipping auto-ingest without
them *"is not a gap, it is a security defect."* **The trigger did not fire — it was kept from firing
by moving the feature.**

⚠ **Two phases shipped with their headline feature ABSENT at HEAD while every gate was green** —
213 (the approval moment: Gate 5.5 fell through on `ask`, so the whole ask/refusal vocabulary was
consumed by nothing) and 216 (the chat wiring dead inside an `except` arm, invisible to 6,929 green
tests). Both found by driving, neither by a suite.

## v3.8 Document Intelligence, Automations & Connectors — SHIPPED 2026-08-26

**12 phases** (201-206 CORE + inserts 204.1 / 206.1 / 206.2 / 206.3 + guardrail debt 207 / 208 + 209),
17 plans, migrations 124-126, 3 days. **11/11 requirements delivered.**
Full detail: [`milestones/v3.8-ROADMAP.md`](milestones/v3.8-ROADMAP.md) ·
requirements: [`milestones/v3.8-REQUIREMENTS.md`](milestones/v3.8-REQUIREMENTS.md) ·
audit: [`milestones/v3.8-MILESTONE-AUDIT.md`](milestones/v3.8-MILESTONE-AUDIT.md) ·
phases: `milestones/v3.8-phases/`

⚠ **Closed `gaps_closed_partial`, not `passed`.** The audit found a **blocker** (a shipped Check
button that 500'd on MCP rows — fixed) and **three requirements narrower than their wording**:
`{{prior_run.*}}` never reaches `llm_emit` (the only path producing a typed deliverable), email
thread dedup is parsed and stored but read by nothing, and TAB-02 covers new ingests only. All
carried forward with re-open triggers rather than closed silently.

⚠ **Seven of twelve phases had no `VERIFICATION.md`** and `REQUIREMENTS.md` had been stale since
day one of the milestone. Both repaired at the audit; both are the SECOND consecutive milestone to
close this way.

## Prior Milestone Archive: v3.7 Workflow Product Completion — SHIPPED 2026-08-24

17 phases, 145 plans, migrations 119-123, git tag `v3.7`. 20/20 requirements satisfied.
Full detail: [`milestones/v3.7-ROADMAP.md`](milestones/v3.7-ROADMAP.md) ·
audit: [`milestones/v3.7-MILESTONE-AUDIT.md`](milestones/v3.7-MILESTONE-AUDIT.md)

⚠ **Collapsed at v3.8's close, not at its own** — this section carried 1,305 lines that were
already byte-for-byte in `milestones/v3.8-ROADMAP.md`'s sibling archive. The duplicate is exactly
the context cost the archive step exists to prevent, and it survived one whole milestone.

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
