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
- 🚧 **v4.1 Ship It & Feel It** — Phases **242-246** (opened 2026-09-11). A deliberate **CONSOLIDATION** milestone: no new capability axis, **19 requirements**, every one of them closing something already in a register. v4.0 becomes a product that is provably running in production, and the chat surface the operator touches every day stops feeling busier than the bar it is aimed at. ⚠ **Opened on a stale premise that this roadmap CORRECTS by measurement** — the v4.0 production push already landed at `1f313670b` (2026-09-10) and 241's expiring UAT row 5 is already spent; see the corrections block below.

---

## v4.1 Ship It & Feel It — ACTIVE (opened 2026-09-11)

**5 phases · 242-246 · 19 requirements · migration reserved 177.**
Requirements: [`REQUIREMENTS.md`](REQUIREMENTS.md) · project: [`PROJECT.md`](PROJECT.md) · state: [`STATE.md`](STATE.md).
**No `research/SUMMARY.md` exists for this milestone, by decision** — every requirement names an existing file, line or register entry, so there is no external unknown to research. Do not go looking for one.

**Goal:** v4.0 stops being code that exists and becomes a product a person can prove is running — and the surface the operator actually touches every day stops feeling busier than the bar it is aimed at.

⭐ **Why five phases and not more.** The requirement set clusters on four genuinely different surfaces (the ship path · the streaming/render seam · the chat shell · the retrieval default) plus one register-honesty item that is not a build at all. Nothing here argues for splitting further, and **splitting the chat work would be actively wrong** — see `D-v4.1-02`. **G-8 is the governor on this milestone more than on any capability milestone**: a consolidation milestone has no natural stopping point, and Phase 235's 17 plans for 4-6 plans of substance is the named failure mode. Target **3-5 plans per phase**; a fix that is ≤ 1 file / ≤ 10 lines with no schema or API surface is **`/gsd:fast` under G-3 and must not become a plan**.

---

### ⚠ Corrections measured at HEAD on 2026-09-11 — this roadmap is built on these, not on the intake prose

Every claim below was **driven against the repository**, not read from a register. Both readings are published: the original is preserved, never overwritten, because *how* a claim went stale within one day is the finding.

**1. ⛔ THE REQUIREMENT COUNT IS 19, NOT 17.** `PROJECT.md`, the intake brief and the commit message `c1a395abf` (*"17 REQ-IDs, 5 categories"*) all say **17**. Counted from `REQUIREMENTS.md` at HEAD: **SHIP 4 · CHAT 5 · SHELL 5 · DEBT 3 · RECALL 2 = 19.** The coverage map below maps **19/19**. ⚠ This is the **identical** defect v4.0's roadmap opened with (*"the requirement count is 38, not 34"*) — **a coverage check run against the wrong denominator is how a requirement survives an entire milestone unnoticed**, and it has now happened on two consecutive milestones.

**2. ⛔ `SHIP-04` HAS ALREADY HAPPENED. The v4.0 production push landed 2026-09-10.** Measured with `git log`:

```
e65610ac2  2026-09-10  Merge master into production — app subdomain root serves the application
1f313670b  2026-09-10  Merge master into production — deploy v4.0 Connected Knowledge
```

`production` is at `e65610ac2`, and `git log --oneline production..develop` returns **2 commits — both of them v4.1 planning docs**. ⛔ **`STATE.md` and `REQUIREMENTS.md` both still say *"v4.0 has never deployed"* and *"cloud is 15 migrations behind"*.** Those sentences were true when written at the v4.0 close and became false **later the same day**. `SHIP-04` is therefore not a push to schedule — it is a **deployed state to verify**, plus `SEED-242`'s `app.<domain>` half, whose routing fix also already landed (`f63a8ebcc`).

**3. ⛔ `SHIP-02` IS ALREADY SPENT, AND ITS LOSS IS ALREADY WRITTEN DOWN.** `241-HUMAN-UAT.md` reads `status: complete`, **6 of 6 driven**, and its closing section states verbatim: *"The row as written can never be run again… Cloud was that database until 2026-09-10, when all fifteen pending migrations — 176 included — were applied during the v4.0 production preparation. The deploy runbook called the ordering out twice and the set went in as one batch anyway."* Row 5 was driven **on a local substitute** (`ALTER TABLE … DROP COLUMN`, backend restarted because `app_settings_has_hnsw_columns()` caches in a process global), all three assertions passed, and the substitution is defended on **one** narrow ground: the gate keys on **column presence**, not on environment. ⭐ **`SHIP-02`'s second arm — *"or explicitly retired with a written reason"* — is therefore ALREADY SATISFIED**, at commit `dbd63864b`. What this phase owes is not a drive; it is to stop carrying it as owed work.

⚠ **The forced ordering in the intake — row 5 → migrations → push — was RESOLVED BY EVENTS, in the wrong order.** The rule stands as written for any future expiring row; what is corrected is the belief that this particular window is still open. **A roadmap that plans an unreproducible drive is a roadmap that cannot close.**

**4. ⛔ `SHIP-01` IS GENUINELY OPEN — but only its structural half, and the register understates it.** Driven at HEAD: `backend/app/api/settings.py:466-467` still enforces `1 <= multimodal_max_vision_calls <= 1000`; `SettingsPage.tsx:888` still puts the field in the **Search tab's** payload unconditionally (read at `:880-901`); `grep` over `supabase/migrations/*.sql` still returns **no CHECK constraint** on the column. The local data fix `1001 → 1000` **was applied and deliberately left in place** (`241-HUMAN-UAT.md`, *"State restored"*), so the bug **no longer reproduces on the operator's local install** — the surface the report names. ⚠⚠ **What is UNMEASURED is the value cloud holds**, and cloud is what production serves from. **If the production row is out of range, the Search tab is unsaveable in production right now and nobody has looked.** That is the first thing Phase 242 measures.

**5. `RECALL-02`'s home is `retrieval_tuning.py`, NOT `retrieval_service.py`.** `SEED-268` names `_SERVER_DEFAULT_EF_SEARCH = 40` and the `if resolved_ef != _SERVER_DEFAULT_EF_SEARCH:` no-op shortcut in **`backend/app/services/retrieval_tuning.py`**. This matters for `D-v4.1-05`: **`RECALL-02` alone does not land on `retrieval_service.py` and does not trip its third G-5 landing.** `RECALL-01` might.

**6. ⚠ `BUG-260718-02`'s part B is fixed while its report reads `open`, and the report now says so in its own frontmatter** (`status: open   # ⚠ PART B IS ALREADY FIXED`). It is cited here as the milestone's method rule, not as a task: **every line number in `REQUIREMENTS.md` is a claim about code from a report written weeks ago. Open the file before planning against it.** Each of `RunCard.tsx:501`, `StreamsProvider.tsx:421-425`, `MessageList.tsx:164-176` and `MessageItem.tsx:437-439` was opened while writing this roadmap and **all four are live as described** — but that is a reading taken today, and it expires.

**7. Hot-file ledger triples RE-DERIVED from git on 2026-09-11**, per CLAUDE.md's own instruction not to trust a cell (`--follow`, six-digit dated-quick-task buckets subtracted):

| File | ledger cell | **re-derived 2026-09-11** | drift |
|---|---|---|---|
| `frontend/src/providers/StreamsProvider.tsx` | 85 / 34 / 4144 | **88 / 35 / 4189** | +3 commits, **+1 phase** |
| `frontend/src/components/chat/MessageList.tsx` | 19 / 8 / 267 | **20 / 8 / 292** | +1 commit, +25 L |
| `frontend/src/components/chat/MessageItem.tsx` | 62 / 33 / 702 | **66 / 32 / 707** | +4 commits |
| `frontend/src/components/chat/RunCard.tsx` | 26 / 12 / 728 | **27 / 13 / 729** | **+1 phase — it FIRES now** |
| `frontend/src/components/layout/ChatLayout.tsx` | 49 / 25 / 997 | **49 / 25 / 997** | none |
| `frontend/src/components/chat/MessageInput.tsx` | 29 / 14 / 643 | **29 / 14 / 643** | none |
| `frontend/src/components/panel/PendingAskCard.tsx` | 13 / 7 / 736 | **14 / 7 / 765** | +1 commit, +29 L |
| `frontend/src/pages/SettingsPage.tsx` | 44 / 23 / 1738 | **45 / 23 / 1751** | +1 commit |
| `backend/app/api/settings.py` | 35 / 19 / 814 | **36 / 19 / 854** | +1 commit, +40 L |
| `backend/app/models/user_settings.py` | 50 / 32 / 1561 | **50 / 32 / 1561** | none |
| `backend/app/services/retrieval_service.py` | 19 / 11 / 456 | **19 / 11 / 456** | none — the cell is correct |
| `backend/app/api/documents.py` | 85 / 33 / 2437 | **89 / 34 / 2423** | +4 commits, **+1 phase** |

⚠ **`backend/app/services/retrieval_tuning.py` has NO LEDGER ROW** and `RECALL-02` lands on it. **A row is owed in Phase 246's commit**, per the same-commit sync rule — the identical gap `scheduler_service.py` had at Phase 234.

---

### The sequencing constraints — what is forced, and what is no longer

| Constraint | Status |
|---|---|
| `SHIP-01` before the production push, so the blocking bug is not deployed | ⛔ **OVERTAKEN BY EVENTS.** The push landed 2026-09-10 with the structural bug still in the code. The remedy is now *forward*: fix it and promote it, rather than gate a push that already happened |
| `SHIP-02` (row 5 on cloud) **before** migration 176 reaches cloud | ⛔ **EXPIRED, and recorded as a loss** — 176 went in as part of one 15-migration batch. Retired in writing at `dbd63864b`. **Not re-plannable** |
| `SHIP-03` migrations `153-156, 166-176` in numeric order, once each, via the SQL editor | ⚠ **CLAIMED DONE by the deploy record, UNVERIFIED by measurement.** Phase 242 runs `scripts/verify-v40-cloud-migrations.sql` **against cloud** and records the verdict |
| **`RECALL-01` depends on `SHIP-01`** | ⭐ **STANDS, unchanged.** `hnsw_ef_search` is set on the tab that cannot save. **Phase 246 comes after Phase 242, and its plans may not assume the tab works** — they assert it, on the database they are measuring |
| **`CHAT-02` and `CHAT-03` share a phase** | ⭐ **STANDS, and is binding.** `MessageList.tsx:164-176` is ONE mechanism: the `messages`-dependent effect that re-runs per token AND the `behavior: "smooth"` branch at `:171`. Splitting them fixes one bug and re-breaks the other |
| **G-2 fires on Phase 243** | ⭐ **STANDS.** `/gsd:sketch` runs **before** `/gsd:plan-phase 243`. The operator-approved mockup **is** the acceptance bar |
| **`retrieval_service.py`'s G-5 extraction, owed since 231** | ⭐ **STANDS.** 241 was the deliberate second landing (11 non-comment lines, fence driven RED at 13). **Phase 246 proposes the extraction FIRST** |

---

### ⚠ Two phases can be blocked on something that is not engineering

Stated here rather than discovered at execution. **A phase that can be blocked on a credential says so, and says what is still deliverable without it** — it never silently assumes the credential arrives.

| Phase | Blocked on | Still deliverable without it |
|---|---|---|
| **242** | a **read-capable cloud DSN** (the same blocker that killed 241's row 5) | SC#2 and SC#3 land entirely locally — the CHECK-constraint migration, the changed-fields-only payload, and the worded refusal. Only SC#1 and SC#4 need the DSN |
| **245** | **one Azure app registration** (`MICROSOFT_OAUTH_CLIENT_ID` / `_SECRET`) — ⚠ **run row M-1 first, it unblocks the other 8** | `DEBT-02` (233's five G-4 rows) and `DEBT-03` (the honesty sweep) in full, plus `DEBT-01`'s **retirement** arm. SharePoint rows S-1 / S-2 sit separately on `SEED-256` and may be retired on that ground alone |

---

### Phase Table

| Phase | Name | Goal | Requirements | SC# | Migrations | Flags |
|-------|------|------|--------------|-----|-----------|-------|
| 242 | Ship It — and Prove What Already Shipped | An operator can save the settings that control search, on the database production actually serves from, and every SHIP claim in the register has been replaced by a measurement | SHIP-01, SHIP-02, SHIP-03, SHIP-04 | 5 | **177** `177_app_settings_vision_calls_bound.sql` | ⚠⚠ **THE INTAKE PREMISE IS STALE — read the corrections block first.** The push already landed (`1f313670b`); row 5 is already spent and retired in writing (`dbd63864b`). **G-5**: `settings.py` (**36/19/854**), `SettingsPage.tsx` (**45/23/1751**), `user_settings.py` (**50/32/1561**) — all three FIRE, all honoured by construction. ⚠ **A new bound on an existing settings column is a MIGRATION, not just an API change.** ⚠ **Blocked on a read-capable cloud DSN for 2 of 5 SC.** `check-deploy-drift.sh` gates. UI hint (the Settings tab + the refusal) |
| 243 | The Thinking Block and the Follow-Scroll Seam | A reasoning stream reads as a calm, structured surface, and scrolling up during a tool call leaves you where you scrolled | CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05 | 5 | none expected | ⚠⚠ **G-2 SKETCH MANDATORY before `/gsd:plan-phase`** — live UI, "feels like", an explicit Claude.ai gold-standard comparison. **The operator-approved mockup is the acceptance bar.** ⭐ **`CHAT-02` + `CHAT-03` are ONE mechanism and may not be split** (`D-v4.1-02`). **G-5**: `StreamsProvider.tsx` (**88/35/4189**) and `MessageList.tsx` (**20/8/292**) carry live rows; `RunCard.tsx` (**27/13/729**) **newly fires**; `MessageItem.tsx` (**66/32/707**) was **DISCHARGED at 227** — do not re-hollow it. ⚠ **`SEED-049`'s trigger has FIRED** (it names *"a chat-surface / streaming / RunCard phase"* verbatim) and is deferred **by decision** — re-open at the first criterion here that cannot be verified without E2E. ⛔ No streaming-architecture rewrite: D-14's red line holds. UI hint |
| 244 | The Chat Shell and the Composer | The chrome around a conversation stops getting in the way of it — chat scrolls inside chat, a paused run leaves you able to act, and an approval is answerable where you are looking | SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05 | 5 | none expected | ⚠ **G-2 fires NARROWLY — sketch `SHELL-04`'s folder-choice surface and `SHELL-05`'s shell signal**, the two net-new surfaces; `SHELL-01/02/03` are bug fixes on shipped surfaces with named causes. ⭐ **`SURF-03`'s home was RULED at scoping** (operator, 2026-09-11): the **app shell**, not the Health tab — this is no longer an open question. Folds **`SEED-029`** (Continue-on-cap **IS** `BUG-260904-05`'s fix) + **`SEED-042`** (the "not in the KB" half of attach) + **`SEED-045`**'s chat-list / nav-collapse items. **G-5**: `ChatLayout.tsx` (**49/25/997**), `MessageInput.tsx` (**29/14/643**), `PendingAskCard.tsx` (**14/7/765**) — all fire. ⚠ `PendingAskCard.tsx` is a **cross-surface shell**, not a chat component: a redesign lands in chat first and shows up in the workflow panel. UI hint |
| 245 | The Verification Debt — Discharged or Retired in Writing | Every v4.0 row that was never driven has a verdict a person can read, and no phase's record calls a self-verification a review | DEBT-01, DEBT-02, DEBT-03 | 4 | none | ⭐ **`DEBT-03` IS A HONESTY REQUIREMENT, NOT A BUILD — it must not become a re-review.** Its whole content is: the word in the file, and the ruling in `STATE.md`. ⚠ **Blocked on ONE Azure app registration** — **M-1 first, it unblocks the other 8**. ⚠ **G-3 applies hard here**: several of these are ≤ 1 file / ≤ 10 lines of doc edit and are `/gsd:fast`, never plans. **Target 2-3 plans — the smallest phase in the milestone, deliberately.** No source change expected beyond what a driven row exposes. No UI. No migration |
| 246 | The Recall Cliff, and the Screen That Describes It | A tenant owning a small share of a large corpus gets honest recall out of the box, and the number on the Settings screen is the number in force | RECALL-01, RECALL-02 | 4 | none expected | ⚠⚠ **`retrieval_service.py` (19/11/456 — the ledger cell is CORRECT) is at its THIRD G-5 LANDING. The extraction, owed since Phase 231, must be PROPOSED AS THE FIRST OPTION at discuss-phase, and no line may land there until that proposal is answered.** ⚠ **Depends on Phase 242** — `hnsw_ef_search` is set on the tab `SHIP-01` repairs; **the plans must ASSERT the tab saves, never assume it**. ⚠ `RECALL-02`'s home is **`retrieval_tuning.py`, which has NO LEDGER ROW — one is owed in this phase's commit.** ⛔ **`D-v4.0-EF-DEFAULT` recorded why the default was left alone: re-open it EXPLICITLY, never reverse it silently.** ⛔ No new Python package. **G-5**: `config.py` (83/48/1506) fires — its `MODEL_CAPABILITIES` seam stays OWED. UI hint (the Retrieval card) |

---

### Phase Checklist

- [ ] **Phase 242: Ship It — and Prove What Already Shipped** — the Search tab saves on the database production serves from, a bound that was added in Python becomes a constraint in the schema, and the three SHIP claims the register still carries as owed are each replaced by a measurement or a written retirement (SHIP-01..04) ⚠ THE PREMISE IS STALE — READ THE CORRECTIONS BLOCK · blocked on a cloud DSN for 2/5 SC
- [ ] **Phase 243: The Thinking Block and the Follow-Scroll Seam** — one calm line while a model thinks, expandable into a timeline; deltas that repaint on a cadence instead of per token; a scroll position that survives a tool call; and reasoning visible on a plain answer (CHAT-01..05) ⚠ G-2 SKETCH MANDATORY · CHAT-02 + CHAT-03 ARE ONE MECHANISM
- [ ] **Phase 244: The Chat Shell and the Composer** — chat scrolls inside chat, a cap-paused run leaves you able to act, an approval is answerable in the thread, a local file attaches to a message, and a source that stopped reading reaches you in the shell (SHELL-01..05) ⭐ SURF-03's home RULED: the app shell
- [ ] **Phase 245: The Verification Debt — Discharged or Retired in Writing** — 238's nine rows and 233's five rows each carry a verdict, and 238 / 240 / 241 say "self-verified" in their own records with `OV-SOLO-01` written into STATE.md (DEBT-01..03) ⭐ HONESTY, NOT A BUILD · blocked on one Azure app registration · smallest phase, 2-3 plans
- [ ] **Phase 246: The Recall Cliff, and the Screen That Describes It** — an install answers correctly for a small tenant in a large corpus without anyone touching a setting, and the breadth on screen is the breadth in force (RECALL-01, RECALL-02) ⚠ THIRD G-5 LANDING — PROPOSE THE EXTRACTION FIRST · depends on 242

---

### Phase Details

#### Phase 242: Ship It — and Prove What Already Shipped

**Goal**: An operator can change a search setting and save it **on the database production actually serves from**, a bound that was added in Python becomes a constraint the schema enforces, and every SHIP claim the register still carries as owed work is replaced by either a measurement or a written retirement — so nothing later in this milestone is stacked on a premise that went stale within a day.
**Depends on**: Nothing (first phase). ⭐ **Phase 246 depends on this one** — `RECALL-01` is unreachable while the tab it lives on cannot save.
**Requirements**: SHIP-01, SHIP-02, SHIP-03, SHIP-04
**Success Criteria** (what must be TRUE):

  1. An operator opens Settings → Search **against the cloud database production serves from**, changes one field, and the save succeeds — and it succeeds **whatever value that database is holding** in a field they did not touch. ⚠ Verified by reading the **network response**, never the banner: `241-HUMAN-UAT.md`'s row 3 recorded that a red banner is exactly what a passing refusal looks like, and *"presence of an error is not evidence of the RIGHT error."* (SHIP-01)
  2. A field the operator did not edit can no longer take the whole tab down with it — either the tab submits only what changed, or it reports every failing field at once instead of raising on the first. And when a refusal names a field they never touched, the sentence says so (*"this was already set to a value outside the allowed range"*) rather than presenting it as a rejection of what they just typed (SHIP-01).
  3. `app_settings.multimodal_max_vision_calls` cannot hold a value outside the bound the API enforces — a CHECK constraint exists, any existing out-of-range row is brought into range by the same migration, and re-running the migration is safe (SHIP-01). ⭐ **This is the general fix, not the specific one**: the class of bug recurs on the next bound added to any settings column until a bound in Python is also a constraint in the schema.
  4. `scripts/verify-v40-cloud-migrations.sql` has been run **against cloud** and its verdict is written into this phase's record — each of `153, 154, 155, 156, 166..176` present exactly once. Any migration found missing is applied by pasting into the cloud SQL editor in numeric order, never `db push` / `db reset`; and the non-code parity half (env vars, seed rows, provider keys, `SANDBOX_IMAGE`) is walked per `docs/DEPLOYMENT-WORKFLOW.md` (SHIP-03).
  5. A person reading this milestone's record can tell, **with the evidence beside it**, that the v4.0 production push already landed at `1f313670b` on 2026-09-10 and that 241's UAT row 5 was driven on a local substitute with its cloud window permanently closed (`dbd63864b`) — so both read as **decisions with a written reason**, not as owed work quietly carried forward. `SEED-242` (`app.<domain>`) is closed or re-armed with a named trigger, its routing half having landed at `f63a8ebcc` (SHIP-02, SHIP-04).

**Plans**: TBD

**UI hint**: yes (the Settings → Search tab, its payload and its refusal copy).
**Migrations**: **177** `177_app_settings_vision_calls_bound.sql` — the CHECK constraint plus the in-range data fix. ⚠ Applied to **local** by pasting into the SQL editor, then to **cloud** in the same operation as the promotion; `scripts/regenerate-full-schema.sh` afterwards, no `--reset`.
**Flags**: ⚠⚠ **READ THE CORRECTIONS BLOCK ABOVE BEFORE PLANNING.** Three of this phase's four requirements describe a world that changed on 2026-09-10; planning them as written produces work that is already done, and one drive that is unreproducible. ⚠ **`SHIP-02` is NOT re-plannable** — the environment it needed no longer exists anywhere, by the UAT record's own words. ⚠ **Blocked on a read-capable cloud DSN for SC#1 and SC#4** — SC#2 and SC#3 are fully deliverable without it and should be sequenced first so the phase is never idle. **G-5**: `settings.py` (**36/19/854**), `SettingsPage.tsx` (**45/23/1751** — the tab seam stays OWED), `user_settings.py` (**50/32/1561** — stale in the ledger for the fourth close running) — all honoured by construction; **update the ledger rows AND their sections in `docs/HOT-FILE-LEDGER.md` in the same commit.** ⚠ `check-deploy-drift.sh` gates any env-var or seed change. **Skip research-phase**: every line is already read at file:line.

**## How we'd know this failed**

- The tab is declared fixed on the strength of the operator's **local** install, where the `1001 → 1000` data fix already landed — and production, which nobody measured, is still refusing every save.
- A green banner is read off the screen instead of the network response, and a refusal is mistaken for a success or the reverse — the exact error `241-HUMAN-UAT.md` caught itself making.
- The bound is fixed for `multimodal_max_vision_calls` only, and the next settings column with a Python-side bound reproduces the identical outage.
- `SHIP-02` is re-planned as a drive, burns a plan, and cannot close — because the database shape it needs does not exist anywhere.
- The cloud migration set is "verified" by re-reading the deploy record that claimed it, rather than by querying the database. **A register knows only the register below it; the database is the bottom.**
- Migration 177 is applied with `db push` or `db reset`, and the operator's data goes with it.

---

#### Phase 243: The Thinking Block and the Follow-Scroll Seam

**Goal**: While a model is thinking, the operator sees one calm, structured surface instead of a monospace blob repainted once per token — and if they scroll up to read something, the product leaves them there.
**Depends on**: Nothing structural. ⭐ **May run alongside 242** — the blast radii do not intersect.
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05
**Success Criteria** (what must be TRUE):

  1. During a reasoning stream the operator sees a **single calm line**, and expanding it gives a structured timeline rather than a flat wall — and the rendered surface **matches the operator-approved sketch**, which is the acceptance bar for this criterion and not a description of one (CHAT-01, `BUG-260718-02` part A). ⚠ Today `RunCard.tsx:501` renders `whitespace-pre-wrap font-mono` — verified by opening the file on 2026-09-11, not by reading the report.
  2. A long reasoning stream produces a thinking block that **updates steadily and does not flicker** — the message list repaints on a coalesced cadence, not once per delta. Observable by an operator watching a slow reasoning model, and measurable as a repaint count that does not track the token count (CHAT-02). ⚠ `lib/throttle.ts` already exists and is wired only to the cache writer; the UI path is the gap.
  3. The operator scrolls up while a tool is preparing, and **stays where they scrolled** — through the rest of the tool call, through the tokens that follow, until they choose to come back down (CHAT-03, `BUG-260823-01`). ⭐ Same seam as criterion 2: `MessageList.tsx:164-176` is one `messages`-dependent effect whose `behavior: "smooth"` branch at `:171` re-arms the pin it was meant to release.
  4. A reasoning model answering a plain question **with no tool calls at all** still shows its thinking — the reasoning surface is not gated on a tool-bearing turn (CHAT-04).
  5. A run that finished while the operator was on another page shows its **final answer resolved out of the narration fold** when they navigate back to it — with no reload (CHAT-05, `BUG-260707-03` residual #2, whose send-path half already shipped at Phase 176).

**Plans**: 5 plans, in 5 waves — **fully serial, and the reason is measured, not a preference.**

Plans:
- [x] 243-01-PLAN.md — ✅ **DONE 2026-09-11** (`a17955cc3`, `f9bd3ccc7` — 17 cases, both knobs, 2 plants driven RED) — the safety net: characterization cases for the thinking block written against the UNMOVED `RunCard`, driven RED against two planted defects, registered in both gate knobs (CHAT-01 guard, CHAT-04 declared-defect case)
- [x] 243-02-PLAN.md — ✅ **DONE 2026-09-11** (`2a62acb60`, `4bbd2c724`, `3de4a0cd3`) — the seam: `ThinkingBlock` extracted from `RunCard` and mounted from `MessageItem` for BOTH message shapes, tool-conditionality gone BY CONSTRUCTION (exactly ONE JSX-child render of `reasoningContent` in `frontend/src`). **CHAT-04 CLOSED.** ⭐ `RunCard.tsx`'s G-5 **DISCHARGED by deletion** (`-39/+20`, 729 → 710 L, one `useState` fewer); `MessageItem.tsx` **not re-hollowed** (`useState` 3→3, `useEffect` 0→0, props 5→5, 0 deleted). Net passes with §8/§9 inverted and §6b's render line moved; remount semantics **DECIDED** (no `key`). Gate `failed 0`, pin 17 → 23
- [ ] 243-03-PLAN.md — the cadence and the scroll, together per `D-v4.1-02`: a RED drive at HEAD first, then producer-side coalescing on the delta callbacks, then CHAT-03 fixed or discharged as already-fixed-by-228 (CHAT-02 + CHAT-03)
- [ ] 243-04-PLAN.md — V1's thin rule: four classes out, `text-sm`, real paragraphs, the self-removing clamp, and a duration that is measured or absent — never derived from character count (CHAT-01 appearance)
- [ ] 243-05-PLAN.md — the answer out of the fold, verified on the NAVIGATION path and not only a live send (CHAT-05)

⚠ **No wave holds two plans. That is a DECLINED TRADE, not an impossibility — and the distinction matters, because the next phase inherits whichever one is written here.** Every plan edits `scripts/vitest-count-gate.cjs` (a `BASELINE` key naming a file that does not yet exist makes the gate exit 2, so a suite and its pin land in ONE commit), and four also edit `docs/HOT-FILE-LEDGER.md` + `CLAUDE.md` (the same-commit sync rule). So no two `files_modified` sets are disjoint — **verified**. ~~⇒ no parallel wave exists to be had.~~ ⛔ **THAT INFERENCE IS FALSE and is struck through rather than deleted: worktrees isolate FILES, so a shared artifact produces a MERGE CONFLICT at merge time, not a false failure — and all three shared artifacts are append-shaped (two dict regions in the gate, one table row, one doc section).** `243-02 ∥ 243-03` is genuinely available: their *source* sets are disjoint (`ThinkingBlock`/`RunCard`/`MessageItem` vs `throttle`/`StreamsProvider`/`MessageList`/`useFollowScroll`). **It is declined for a measured reason instead:** two concurrent agents would both be editing the pin file the whole phase's correctness rests on, and CLAUDE.md measures that at two concurrent test-running agents `count gate OK` goes non-deterministic — on a phase whose gate is **already RED at base** (`243-BASELINE.md`), a non-deterministic third failure would be indistinguishable from this phase's own. `243-04 ∥ 243-05` is separately unavailable: both edit `StreamsProvider.tsx`, the largest file in the tree. ⭐ **On G-8: five is INSIDE the 3-5 band, so G-8 does not fire and no justification was owed** — the context-budget argument first written here was unevidenced and unnecessary, and is withdrawn. Four of the five boundaries are forced by hard semantics, not taste: 01→02 by **D-243-16** (the net must exist against unmoved code), 03 standing alone by **D-243-04** (CHAT-02+03 may not be split, nor diluted into a plan carrying other intents), 03→04 by **D-243-13** (the stamp site is defined relative to the coalescer), 02→05 by **D-243-06** (the answer's position depends on the mount order). Only 04/05 is discretionary, and merging it yields a 5-task plan on `StreamsProvider.tsx`; merging 01+02 would put the net and the move in one commit, which is precisely what D-243-16 exists to prevent. **13 tasks over 5 plans (2/3/3/3/2) is proportionate.** Semantic dependencies remain narrower than the waves: 243-03 is independent of 243-02/04/05, and 243-05 depends only on 243-02.

**UI hint**: yes — ⚠⚠ **and G-2 is MANDATORY, not advisory.**
**Migrations**: none expected.
**Flags**: ⚠⚠ **`/gsd:sketch` RUNS BEFORE `/gsd:plan-phase 243`.** Live UI, an operator saying *"feels like"*, and an explicit gold-standard comparison (Claude.ai) — all three of G-2's triggers. **The operator-approved mockup is the acceptance bar**; no criterion here is written in a form a sketch cannot be measured against. ⭐ **`CHAT-02` and `CHAT-03` MAY NOT BE SPLIT ACROSS PHASES OR ACROSS PLANS THAT CANNOT SEE EACH OTHER** (`D-v4.1-02`) — they are one line of code, and fixing either alone re-breaks the other. **G-5**: `StreamsProvider.tsx` (**88/35/4189** — ledger reads `85/34/4144`, **+1 phase**), `MessageList.tsx` (**20/8/292**), `RunCard.tsx` (**27/13/729** — **newly crosses the threshold; the cell reads `26/12/728`**), `MessageItem.tsx` (**66/32/707** — **DISCHARGED at Phase 227; honoured by construction, do not re-hollow it**). **Read each file's section in `docs/HOT-FILE-LEDGER.md` before planning**, and update row + section in the same commit. ⚠ **`SEED-049`'s trigger has FIRED verbatim** and it is deferred **by decision** — record it as fired-and-deferred; re-open at the first criterion here that cannot be verified without a live E2E drive. ⛔ **No streaming-architecture rewrite** — these are surgical fixes on named lines; D-14's red line holds and provider differences stay at the gateway / adapter / sanitizer boundary. ⚠ `vitest-count-gate.cjs` needs `TARGETS` **and** `BASELINE` for any new suite — a suite in one knob and not the other runs while guarding nothing. ⚠ `SEED-171`'s five cap-independent flaky suites sit near this blast radius: capture failing filenames from the gate's own persisted JSON **before** re-running anything. **Skip research-phase.**

**## How we'd know this failed**

- The thinking block is restyled and the flicker survives — because the repaint cadence was never touched, only the CSS.
- `CHAT-02` and `CHAT-03` land in different plans that do not see each other, the smooth-scroll branch gets fixed twice with opposite intent, and the pin re-arms again.
- The scroll fix works while streaming and breaks the settled view, or works on a short thread and fails on a long one — because it was verified once by hand and never on a thread with fifty messages.
- The sketch is approved and the build drifts from it, and the phase closes against a description of the mockup rather than the mockup — **the named sketch-to-build drift failure mode**.
- A green composition fence coexists with the shipped defect because it asserts a block is **present** by `data-testid` while the content drifts. **Presence assertions cannot see content drift** — assert the rendered CONTENT where the words are the deliverable.
- Reasoning appears on pure-text replies but the streaming cursor, the narration banner or the citation branch regress with it, and nobody notices because the criteria only asked about reasoning.

---

#### Phase 244: The Chat Shell and the Composer

**Goal**: The chrome around a conversation stops getting in the way of it — the page holds still while the messages move, a paused run leaves the operator something to do, an approval is answerable where they are already looking, and a file can join a message.
**Depends on**: Phase 243 (shares the chat frame; sequencing them stops two phases re-hollowing it at once). ⚠ **A sequencing preference, not a hard dependency** — if 243's sketch stalls, 244 may start, provided the two never hold the chat frame open simultaneously.
**Requirements**: SHELL-01, SHELL-02, SHELL-03, SHELL-04, SHELL-05
**Success Criteria** (what must be TRUE):

  1. The operator scrolls a long conversation and **the nav rail stays put** — the message list scrolls inside the chat pane, and no dead space opens under the composer at any window height or after the workspace panel opens and closes (SHELL-01, `BUG-260828-08`).
  2. A Deep run paused at its iteration cap leaves the operator **able to act**: either the composer works, or the control that actually continues the run is on screen and continues it. ⛔ Never a disabled composer beside a message telling them to use it (SHELL-02, `BUG-260904-05`, folding `SEED-029`). ⚠ Verified **after a reload**, not only during a live stream — Phase 228 removed the reload that used to free them.
  3. An approval pause is answerable **from the chat thread**, with the same two actions the workflow panel offers, and answering it in either home settles it in both (SHELL-03, `BUG-260828-07`, severity high).
  4. A person attaches a **local file** to a chat message and the agent can use it; and a cloud import **asks which Library folder it goes to** instead of writing permanently to the root (SHELL-04, `BUG-260905-01`, folding `SEED-042`'s "not in the KB" half).
  5. A watched source that has stopped reading raises a signal the operator **sees in the app shell while doing something else** — not only if they happen to open the Health tab (SHELL-05, `SURF-03`).

**Plans**: TBD

**UI hint**: yes.
**Migrations**: none expected.
**Flags**: ⚠ **G-2 fires NARROWLY** — `/gsd:sketch` for `SHELL-04`'s folder-choice surface and `SHELL-05`'s shell signal, the two net-new surfaces in this phase. `SHELL-01/02/03` are bug fixes on shipped surfaces with named causes and do not need one; **say so explicitly rather than sketching everything or nothing**. ⭐ **`SURF-03`'s home was RULED at scoping (operator, 2026-09-11): the app shell.** Closing it against the Health tab alone was already recorded as insufficient — settled, and not to be re-litigated at discuss-phase. Folds **`SEED-029`**, **`SEED-042`**, and **`SEED-045`**'s chat-list / nav-collapse items (the rest of that umbrella stays planted). **G-5**: `ChatLayout.tsx` (**49/25/997**), `MessageInput.tsx` (**29/14/643**), `PendingAskCard.tsx` (**14/7/765** — ledger reads `13/7/736`) — all fire, all honoured by construction expected. ⚠ **`PendingAskCard.tsx` is a CROSS-SURFACE SHELL, not a chat component** — a redesign lands in chat first and then appears in the workflow panel; check both homes. ⚠ `SHELL-04`'s cloud-import half touches the ingest splice Phase 229 built — **a file must still be minted by `mint_document_row` / `splice_document`, never by a new hand-rolled insert**. **Skip research-phase.**

**## How we'd know this failed**

- The scroll is fixed at one window height and the dead space returns at another, or when the workspace panel opens.
- The cap-paused composer is "fixed" by removing the message that told the operator to use it — the sentence goes away and the operator is still stuck.
- Approve renders in the thread but answering it there does not settle the panel's copy, so the same pause is now actionable twice and agreed in neither.
- A local attach ships that quietly writes to the Library anyway — `SEED-042`'s *"not in the KB"* half is the point, and losing it makes SHELL-04 a duplicate of the import it was meant to complement.
- The shell signal fires for a source that is healthy, or does not fire for one that stopped — a signal nobody will trust after the first false one.
- `SURF-03` is closed against a Health-tab row again, which the v4.0 close already recorded as not satisfying it.

---

#### Phase 245: The Verification Debt — Discharged or Retired in Writing

**Goal**: Every v4.0 row that was never driven has a verdict a person can read, and no phase's record calls a self-verification a review — so the next milestone opens on ground whose measured extent is known.
**Depends on**: Nothing. ⭐ **May run at any point in the milestone**, and should be started early: its longest pole is an operator action, not an engineering one.
**Requirements**: DEBT-01, DEBT-02, DEBT-03
**Success Criteria** (what must be TRUE):

  1. Each of Phase 238's **nine** UAT rows reads **pass**, **⛔ blocked with its reason and its blocking id**, or **retired with a named trigger**. No row is silently absent. ⚠ **M-1 is driven first — it unblocks the other eight**; S-1 / S-2 may be retired on `SEED-256` (no work/school tenant) alone, provided the retirement says so (DEBT-01).
  2. Each of Phase 233's **five** G-4 operator rows has been driven in a live browser by a person, with a written verdict per row. Owed since the phase shipped and never run (DEBT-02).
  3. A person opening `238-VERIFICATION.md`, `240-VERIFICATION.md` and `241-VERIFICATION.md` finds the words **"self-verified"** and does **not** find "reviewed" — and can tell from each file which gate did and did not run (DEBT-03).
  4. `STATE.md → Guardrail overrides` carries the `OV-SOLO-01` ruling in full: that solo running continues, that the dispatched code-review subagent is **mandatory** on any phase touching a trust boundary and is **not** an independent gate, that `/code-review ultra` stays ruled out on cost, and **what its next re-arm trigger is** — so it cannot lapse unnoticed a second time (DEBT-03).

**Plans**: TBD

**UI hint**: no.
**Migrations**: none.
**Flags**: ⭐⭐ **`DEBT-03` IS A HONESTY REQUIREMENT AND MUST NOT BECOME A RE-REVIEW.** Its entire content is the word in three files and the ruling in one. A phase that re-reviews 238 / 240 / 241 has silently changed the requirement into a different and much larger one. ⚠ **G-3 APPLIES HARD**: a one-word edit to a VERIFICATION.md is `/gsd:fast`, never a plan. **Target 2-3 plans — deliberately the smallest phase in the milestone**, and the temptation to grow it is exactly the consolidation-milestone failure mode `PROJECT.md` names at scoping. ⚠ **Blocked on ONE Azure app registration** (`MICROSOFT_OAUTH_CLIENT_ID` / `_SECRET`) — an **operator action**: schedule it, do not simulate it, and never mark a row done on the strength of a green suite. ⚠ No source change is expected; if a driven row **exposes a defect**, that defect is triaged under G-3 / G-7 as fast-fix, deferred-to-a-named-phase, or accepted with a reason — **it does not silently expand this phase**. ⚠ Also owed from earlier and named rather than left silent: **237's rule-builder surface was never manually clicked** (owed by decision) and **`SEED-177` still reads `status: planted` while its retire-the-egress-fence trigger already fired** — both are candidates for a written retirement in the same pass.

**## How we'd know this failed**

- A row is marked done on the strength of a passing test suite rather than a driven observation — the failure this requirement family exists to prevent.
- `DEBT-03` turns into a re-review of three phases, and a two-line honesty fix becomes the largest phase in the milestone.
- A VERIFICATION.md gets the word "self-verified" added while its verdict section still reads as though a reviewer signed it — the word changes and the document still lies.
- `OV-SOLO-01` is recorded without a re-arm trigger, and lapses unnoticed exactly the way it did between 2026-09-08 and 2026-09-10.
- The Azure registration does not arrive and the phase **stalls**, rather than delivering `DEBT-02`, `DEBT-03` and `DEBT-01`'s retirement arm — none of which needs a credential at all.

---

#### Phase 246: The Recall Cliff, and the Screen That Describes It

**Goal**: A tenant owning a small share of a large corpus gets honest answers **out of the box**, without anyone knowing a setting exists — and the search breadth the Settings screen displays is the search breadth actually in force.
**Depends on**: **Phase 242** (`SHIP-01`). ⭐ **A hard dependency, not a preference**: `hnsw_ef_search` is set on the tab that cannot save, so the remedy Phase 241 shipped is presently unreachable by an operator. ⚠ **This phase's plans may not ASSUME the tab works — they assert it, on the database they measure.**
**Requirements**: RECALL-01, RECALL-02
**Success Criteria** (what must be TRUE):

  1. A tenant owning **0.2% of a 100,000-chunk corpus** gets its documents back on a filtered search **with nobody having touched a setting** — measured on the recall harness Phase 230 shipped, at the selectivities Phase 241 measured, where `recall@20` reads **0.040** today and `ef_search = 200` restores **1.000** (RECALL-01, `QUEUE-06`).
  2. An operator who *does* want to change search breadth can reach the control and save it, on a Settings tab that saves. ⭐ This is what makes `QUEUE-06`'s shipped remedy actually reachable, and it is why this phase comes after 242 (RECALL-01).
  3. The number on the Settings screen is the number in force: the no-op shortcut **asks the server what it holds** instead of comparing against a compiled-in `40`, so an install running against a Postgres tuned to anything else can never be shown a breadth that is not in effect (RECALL-02, `SEED-268`).
  4. The change is defended by a measurement that would **fail if the default regressed** — the harness run recorded before and after, both figures written into the phase record with their corpus size and execution plan beside them, never a claim that recall improved (RECALL-01).

**Plans**: TBD

**UI hint**: yes (the Retrieval card's search-breadth control and its help text).
**Migrations**: none expected. ⚠ If the shipped default changes in `config.py` rather than in a settings row, that is a **code default**, not a migration — say which one it is.
**Flags**: ⚠⚠⚠ **`backend/app/services/retrieval_service.py` (re-derived **19 / 11 / 456** — the ledger cell is CORRECT for once) IS AT ITS THIRD G-5 LANDING.** The extraction has been owed since Phase 231; 241 was the deliberate **second** landing, capped at 11 non-comment lines with a fence driven RED at 13, and the obligation is written into the file itself. **`/gsd:discuss-phase 246` must produce the extraction proposal as its FIRST option, before the planned change — and no line may land in that file until the proposal is answered.** ⚠ **`RECALL-02`'s home is `backend/app/services/retrieval_tuning.py`, which has NO LEDGER ROW at all** — G-5 cannot fire on it at any count. **A row is owed in this phase's commit**, with its section in `docs/HOT-FILE-LEDGER.md`, same commit. ⛔ **`D-v4.0-EF-DEFAULT` recorded WHY the default was left alone at the v4.0 close — re-open that decision EXPLICITLY and record the reversal; never reverse it silently.** ⚠ **`SEED-076` §3's lever ordering was REFUTED by 241's measurement**: `iterative_scan` alone is **not** sufficient (0.494 / 0.564 / 0.684), and `ef_search = 1000` measured **reproducibly worse** than 400 — do not re-derive that ordering from the seed. ⚠ **A recall figure measured on a corpus the planner Seq-Scans is not a recall figure** — `241-VERDICT-CORRECTION-PLAN-PATH.md` found `document_chunks_embedding_idx` with `idx_scan = 0` for a database's entire life. ⛔ No new Python package. **G-5**: `config.py` (**83/48/1506** — stale for the eleventh time; the `MODEL_CAPABILITIES` seam stays OWED), `SettingsPage.tsx`, `settings.py`, `user_settings.py` — all fire, all honoured by construction expected. **Skip research-phase.**

**## How we'd know this failed**

- The default is raised and nothing measures it, so the phase closes on a config diff and a hope. **A number without a harness run beside it is a claim.**
- The improvement is measured on the operator's local corpus, which is too small for the index to be used at all — the trap `241-HUMAN-UAT.md` row 6 documented, where "no visible difference" was the *correct* result.
- A line lands in `retrieval_service.py` for the third time and the extraction proposal is written after the fact, or not at all.
- `retrieval_tuning.py` gets its `RECALL-02` change and still has no ledger row, so the next phase to touch it is invisible to G-5 again — exactly `scheduler_service.py`'s gap at Phase 234.
- Raising the default fixes small-tenant recall and quietly costs every large-tenant query its latency, because only the recall side was ever a criterion.
- `RECALL-02` ships and the screen is still authoritative about a value it never asked the server for, because the fix was applied to the frontend's `?? 40` fallback rather than to the backend's `_SERVER_DEFAULT_EF_SEARCH` shortcut.

---

### Coverage Map — 19 / 19 requirements, each in exactly one phase

| REQ-ID | Phase | REQ-ID | Phase |
|---|---|---|---|
| SHIP-01 | 242 | SHELL-01 | 244 |
| SHIP-02 | 242 | SHELL-02 | 244 |
| SHIP-03 | 242 | SHELL-03 | 244 |
| SHIP-04 | 242 | SHELL-04 | 244 |
| CHAT-01 | 243 | SHELL-05 | 244 |
| CHAT-02 | 243 | DEBT-01 | 245 |
| CHAT-03 | 243 | DEBT-02 | 245 |
| CHAT-04 | 243 | DEBT-03 | 245 |
| CHAT-05 | 243 | RECALL-01 | 246 |
| | | RECALL-02 | 246 |

**SHIP 4 · CHAT 5 · SHELL 5 · DEBT 3 · RECALL 2 = 19.** No orphans. No duplicates. ⚠ **The denominator is 19 and the intake said 17** — see correction 1. Any later coverage check that reads 17 is checking against the wrong number.

---

### Guardrail summary — where each rule fires, and its disposition

| Rule | Fires on | Disposition |
|---|---|---|
| **G-1** phase chain cap | Not fired — no `<base>.N` inserts exist yet. ⚠ Watch 243 / 244: they share the chat frame, and a third insert on it would fire | — |
| **G-2** sketch before plan for UX | **243 (MANDATORY, whole phase)** · **244 (NARROW — `SHELL-04` + `SHELL-05` only)** · 246's Retrieval-card copy is help text on a shipped card, not a new surface | `/gsd:sketch` runs before `/gsd:plan-phase` for both |
| **G-3** lightweight commands | **245 above all** (one-word doc edits) · any ≤ 1 file / ≤ 10 line fix in 242 or 244 | **`/gsd:fast` or `/gsd:quick`, never a plan** |
| **G-4** lived-experience UAT | **242, 243, 244, 246** — all touch user-visible UI. Operator-defined *"I'd recognize failure here"* scenarios at **scope time**, not post-hoc | Chrome MCP drives all three per phase; wire format + screenshot are insufficient |
| **G-5** refactor between feature waves | 242 (3 files) · **243 (4 files, `RunCard.tsx` NEWLY FIRING)** · 244 (3 files) · **246 (`retrieval_service.py` — THIRD LANDING, extraction owed since 231)** | Each phase reads `docs/HOT-FILE-LEDGER.md` before planning; `node scripts/check-hot-file-ledger.cjs <phase>` gates. ⚠ **246's extraction must be PROPOSED FIRST** |
| **G-6** failure criteria upfront | All five phases | `## How we'd know this failed` written above, at roadmap time |
| **G-7** gap-closure round cap | Not fired yet | `node scripts/check-gap-closure-rounds.cjs <phase>` at every `gaps_found` |
| **G-8** plan-count proportion | ⭐ **THE GOVERNOR ON THIS MILESTONE.** Targets: 242 → 3-4 · 243 → 4-5 · 244 → 4-5 · **245 → 2-3** · 246 → 3-4 | A phase exceeding **6** must name in CONTEXT.md what genuinely cannot share a worktree. ⛔ Never cut: the verifier, TDD RED drives, security review, migration discipline |
| **`OV-SOLO-01`** | Every phase in this milestone | Solo running continues by the operator's 2026-09-11 ruling. The dispatched code-review subagent is **MANDATORY** on any phase touching a trust boundary and is **NOT** an independent gate. Every phase closes reading **"self-verified"** |

---

### Migration reservations — monotonic from 177

| Number | File | Phase |
|---|---|---|
| **177** | `177_app_settings_vision_calls_bound.sql` — CHECK constraint + in-range data fix | 242 |

⚠ Filenames must match `<digits>_name.sql` — letter suffixes like `177b` are silently skipped by the Supabase CLI. Apply by **pasting into the SQL editor**, never `db push` / `db reset`, then `bash scripts/regenerate-full-schema.sh` (no `--reset`). ⚠ **Cloud parity is part of the same operation as the promotion**, not a follow-up.

---

### Deferred with triggers intact (not in this milestone)

| Item | Why | Re-open trigger |
|---|---|---|
| `SEED-013` / `SEED-195` — Open Platform | **This is v5.0.** A capability axis; mixing it in is how a consolidation milestone loses its stopping point | The next capability milestone |
| `SEED-049` — E2E Playwright revival | ⚠ **Its trigger IS already true** and it is deferred **by decision**, not oversight | The first Phase 243 criterion that cannot be verified without it |
| `SEED-045` — UI/UX polish umbrella (residue) | Its chat-list / nav-collapse items fold into `SHELL-01`; the rest do not | Next polish pass |
| `SEED-211` BUILD · `SEED-224` · `SEED-265/266/267` · `SEED-004` | Recorded at the v4.0 close with migration paths; none is a consolidation item | As written in each seed |
| `BUS-171` — the 23-item operator queue triage | **Parked is not dropped** | Operator's call; the method is in the bus item |
| **The 161-seed register sweep** | ⚠ At 161 `trigger_when` entries, a full sweep **is a phase of work, not a step in a command**. The sweep run at this milestone's scoping was **targeted against its scope** and surfaced 6 firing seeds | ⚠ **The register's size is itself a finding, and it does not shrink by being re-deferred** |

---

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 242. Ship It — and Prove What Already Shipped | 0/? | Not started | — |
| 243. The Thinking Block and the Follow-Scroll Seam | 0/? | Not started (⚠ sketch owed first) | — |
| 244. The Chat Shell and the Composer | 0/? | Not started | — |
| 245. The Verification Debt | 0/? | Not started | — |
| 246. The Recall Cliff | 0/? | Not started | — |

**0 / 5 phases complete · 0 / 19 requirements delivered.**

---

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

---

*Milestones v1.0–v3.1 shipped and archived under `.planning/milestones/`. **Next milestone: v3.2** — run `/gsd:new-milestone` to define scope. Re-sequenced PRD roadmap: see `.planning/PRDs/SEQUENCE.md`. v2.9 STRETCH 105–109 + v3.1 STRETCH 125/126/130/131 remain backlog carry-forwards.*
