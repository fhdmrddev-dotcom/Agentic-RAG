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
- 🚧 **v4.0 Connected Knowledge** — Phases **228-241** (opened 2026-09-04). 14 phases, **38 requirements**, migrations reserved **153-176**. The knowledge base stops depending on somebody remembering to upload: a source is connected **once**, previewed before it brings anything in, and then watched on the **shipped** scheduler, safely and at a customer's scale. Four source families as **thin adapters over ONE contract** (Google Drive · OneDrive/SharePoint via Graph · any MCP file surface · mail), **connection-scoped visibility** enforced at all four RLS sites, a durable ingestion queue with cap/retry/resume, and the written anti-injection discipline **actually attacked**. ⭐ **Phase 234 retires the standing `CLAUDE.md` manual-upload-only rule in the same commit** (`SEED-142`) — and with it the reason ownership-based RLS was ever adequate. Carries the deferred Phase 219 (`LIB-08/09/10`) and `SEED-209/210/211`. Phase 228 is the **v3.9 closeout** — the debt gets a phase number, not a bullet in `STATE.md`.

---

## v4.0 Connected Knowledge — ACTIVE (opened 2026-09-04)

**14 phases · 228-241 · 38 requirements · migrations reserved 153-176.**
Requirements: [`REQUIREMENTS.md`](REQUIREMENTS.md) · research: [`research/SUMMARY.md`](research/SUMMARY.md) ·
architecture: [`research/ARCHITECTURE.md`](research/ARCHITECTURE.md) · pitfalls: [`research/PITFALLS.md`](research/PITFALLS.md)

**Goal:** The knowledge base stops depending on somebody remembering to upload — a person connects a
source **once**, sees exactly what it would bring in **before** it brings anything, and the Library
keeps reading it on a schedule, safely and at a customer's scale.

---

### ⚠ Corrections and measured facts this roadmap is built on — do NOT re-derive them from stale prose

**1. The requirement count is 38, not 34.** The intake brief and several downstream notes say *34*.
Counted from `REQUIREMENTS.md` at HEAD: **LIB 3 · SRC 6 · PREV 3 · VIS 6 · QUEUE 6 · TRUST 4 ·
RULES 2 · SURF 3 · DEBT 5 = 38.** `38 − 5 DEBT = 33`, which is probably where *34* came from. The
coverage map below maps **38/38**. The original figure is recorded rather than overwritten, because
a coverage check run against the wrong denominator is exactly how `LIB-08/09/10` survived an entire
milestone living only in a roadmap heading.

**2. The hot-file ledger triples were RE-DERIVED from git on 2026-09-04, not copied from the cells.**
CLAUDE.md's own instruction — *"re-derive with the recipe, do not trust a cell"* — was followed, with
`--follow`, and with six-digit dated-quick-task buckets subtracted:

| File | ledger cell | **re-derived 2026-09-04** | drift |
|---|---|---|---|
| `backend/app/api/documents.py` | 72 / 30 / 2535 | **73 / 30 / 2562** | +1 commit, +27 L |
| `backend/app/services/retrieval_service.py` | 17 / 9 / 362 | **17 / 9 / 362** | none |
| `frontend/src/pages/LibraryPage.tsx` | 35 / 11 / 814 | **38 / 11 / 817** | +3 commits |
| `backend/app/api/connectors.py` | 25 / 11 / 1678 | **27 / 11 / 1727** | +2 commits, +49 L |
| `backend/app/services/connector_service.py` | 21 / 7 / 1601 | **21 / 7 / 1601** | none |
| `frontend/src/components/ingestion/DocumentList.tsx` | 24 / 13 / 294 | **25 / 13 / 295** | +1 commit |
| `backend/app/main.py` | 74 / 54 / 835 | **77 / 56 / 839** | +3 commits, **+2 phases** |
| `backend/app/config.py` | 73 / 43 / 1331 | **76 / 43 / 1408** | +3 commits, +77 L |
| `frontend/src/components/settings/ConnectionsTab.tsx` | 23 / 8 / 1578 | **24 / 8 / 1578** | +1 commit |
| `frontend/src/components/settings/ConnectionFormPanel.tsx` | 17 / 7 / 2376 | **20 / 8 / 2376** | **+1 phase** |
| `backend/app/services/multimodal_service.py` | 14 / 7 / 984 | **17 / 9 / 1019** | **+2 phases**, +35 L |
| `frontend/src/hooks/useDocuments.ts` | 8 / 3 / 120 | **9 / 4 / 147** | **+1 phase** |

⚠ **`backend/app/services/scheduler_service.py` measures `5 / 2 / 399` and has NO LEDGER ROW** — so
G-5 cannot fire on it at any count. `LIB-08` binds this milestone's entire watch loop to it. **A row
is owed in Phase 234's commit**, per the same-commit sync rule.

**3. Connector documents reach the classification rules engine at Phase 234, not at Phase 237 —
MEASURED, not assumed.** Rule evaluation lives **inside `ingest_document`** (`documents.py:2030`,
the block at `:2483-2512`), not in the `/upload` HTTP handler. So the moment a watched sync mints a
row through the splice, it hits the rules engine. That is why **`VIS-06` is assigned to 234 and not
to the rule-engine phase** — a deliberate departure from research's *"the refusal in `P-RULES`"*,
stated here rather than smoothed over. Two supporting facts, also read at HEAD: the engine today
**never writes `folder_id`** (it writes one `_classification` suggestion), so the "suggests, never
moves" half is already structurally true — and `accept_classification` (`documents.py:1894`) **is**
the code that moves, which is where `VIS-06`'s narrower-of-two fence actually has to sit.

> ### ⛔ CORRECTION 2026-09-06 — POINT 3'S CENTRAL CLAIM IS MEASURED **FALSE**. The original is kept above, never overwritten, because *how* a measured claim went wrong is the finding.
>
> **"The moment a watched sync mints a row through the splice, it hits the rules engine" does not
> happen. Connector documents reach the classification rules engine at NO phase, including 234.**
> Filed as **`BUG-260906-01`**, found in the operator's G-4 session at Phase 234's close and measured
> on the live database: the first document ever delivered by a watch carries
> `metadata._classification = None`.
>
> **Why the measurement was right and the conclusion still wrong.** Rule evaluation *is* inside
> `ingest_document` — that part was read correctly at HEAD and is still true (now at
> `documents.py:2385-2396`). But **a watched sync does not call `ingest_document`.**
> `watch_service.sync_watch` calls `async_mint_document_row` and then `insert_ingestion_job`, handing
> the file to **Phase 230's durable queue** — and `grep -n classification` across
> `ingest_enrich.py` + `ingestion_queue_service.py` returns **one comment and nothing executable.**
> The claim tracked the rules engine to the right function and never checked that the new path
> reaches that function.
>
> ⚠ **The queue is what changed underneath it.** Point 3 was written when `/upload` → `ingest_document`
> was the only ingest, so "mints through the splice" and "runs `ingest_document`" were the same
> sentence. **Phase 230 (H-3, sequenced deliberately *before* 234) split them**, and this claim was
> not re-derived afterwards. ⭐ **A cross-phase claim must be re-measured against the phase that
> lands between it and its subject** — H-3 put a phase there on purpose.
>
> ⚠ **This is the FIFTH instance of the 2026-09-05 shape** — two paths serving one outcome, only one
> doing the work — and the second time it is the *queue* that is the silent path.
>
> **What this does and does not change for `VIS-06`:**
> - ⚠ **The assignment of `VIS-06` to 234 loses the reason given for it here.** H-4 says the fence
>   must land in the same phase that first lets connector documents reach the rules engine; **no
>   phase has done that yet**, so 234 was not it.
> - ✅ **The fence itself is still correctly placed and must NOT be moved.** It sits at
>   `accept_classification` (`documents.py:1892`) and at rule evaluation (`:2325`), which is where
>   the *move* happens — and that reasoning (the last sentence of point 3) was independent of the
>   false premise and survives it intact. **H-4 is honoured early rather than late**, which is the
>   safe direction: the fence exists before the path that needs it does.
> - ⛔ **Fix `BUG-260906-01` BEFORE Phase 235.** Its SC#1 is a per-source run history reporting what
>   each sync did; a history built while filing silently never runs would be designed around the hole.
>   The fix is the `ingest_enrich.py` extraction that closed `BUG-260905-06`, plus an **agreement**
>   test in `test_ingest_enrich_shared.py` — never a second per-path test.
> - See also **`SEED-252`** (the operator's ask: many rules contributing, and actually moving the file).

**4. The four RLS sites are two policies and two `SECURITY DEFINER` bodies** — the `documents` and
`document_chunks` policies, and the bodies of `match_document_chunks` and `keyword_search_chunks`.
`match_document_chunks`'s body filters `AND d.is_latest = true`, which is why a row minted without
`is_latest` (Defect 1) is invisible to retrieval even while the Library lists it.

**5. Migrations are monotonic from 153.** The highest existing is `152_*`. **The gaps at 130-139 and
142-149 must NOT be backfilled.** A phase needing no migration takes no number; an unused number
inside a reserved block is skipped, never reused.

**6. `ATTACH-01`'s import has probably never written a row.** `connectors.py:1693` mints a
`documents` row with a `storage_path` key against a table that has no such column, and a `NOT NULL
file_path` it never supplies. The schema mismatch is **VERIFIED**; the runtime error mode
(`PGRST204` vs `23502`) is **UNVERIFIED**. Phase 229 must drive it once before planning around
"this route currently does nothing."

---

### The sequencing constraints — this order is not a preference

Five ordering hazards were reconciled across three research files. Each is an edge in the graph
below, and none may be reordered casually.

| # | Hazard | Where it binds |
|---|---|---|
| H-1 | Widening the two `SECURITY DEFINER` retrieval bodies **before** the two RLS policies makes the agent cite chunks the Library refuses to show. The reverse direction (policies first) is merely annoying. | **231** — policies first, DEFINER bodies last, **one transaction**, with the negative case (second user, same org, connection still private) driven **RED against all four sites before** the widening |
| H-2 | The splice extraction precedes **every** adapter. Two producers already mint document rows by hand and **both get it wrong**; a third and fourth would each get it wrong differently. | **229 before 232 / 238 / 239 / 240** |
| H-3 | The durable queue precedes any adapter reaching a customer, and is **proven on `/upload` first**, so a red run is never ambiguous between the queue and a new adapter. | **230 before 234** |
| H-4 | The rules-engine fence must land in the **same phase** that first lets connector documents reach the rules engine — never retrofitted after a rule has over-shared a corpus. | **`VIS-06` in 234** (Correction 3 — measured, and a departure from the research slotting) |
| H-5 | A `missing` verdict may be written **only** from a listing whose final page asserted `complete=True` — **structurally, not as a discipline** — and it must exist before any diff can write a deletion verdict. | **`SRC-06` in 234, in the same plan as the diff** |

```
228  v3.9 CLOSEOUT                          the debt gets a phase number
        |                                   (DEBT-04 may be driven OUT OF ORDER - see below)
        v
229  THE ONE INGEST SPLICE                  REFACTOR ONLY - no new capability
        |                                   G-5 DISCHARGE on documents.py (30 phases)
        v
230  THE DURABLE INGESTION QUEUE            mig 153 - PROVEN ON /upload FIRST
        |
        +----------------------------+-------------------------------------
        v                            v
231  CONNECTION-SCOPED VISIBILITY  232  THE SOURCE CONTRACT + GOOGLE DRIVE
     mig 154 - 4-site widening          services/sources/* + drive_adapter
     THREAT MODEL MANDATORY             ONE family, proving the seam
        +------------+---------------+
                     v
              233  THE PREVIEW                       no migration - G-2 SKETCH
                     v
              234  THE WATCH LOOP + FIRST REAL SYNC  migs 168-171
                     |  RETIRES THE CLAUDE.md MANUAL-UPLOAD-ONLY RULE, SAME COMMIT
                     |  THREAT MODEL MANDATORY
                     v
              235  THE SOURCE SAYS WHAT IT DID       mig 172 - G-2 SKETCH
                     v
              236  THE CORPUS UNDER ATTACK           no migration - GA gate
                     v
              237  ONE RULE ENGINE                   mig 173
        +------------+---------------+
        v                            v
238  MICROSOFT GRAPH             239  ANY MCP SERVER WITH FILES
     if not SMALL, 232 was wrong      mig 174 (reserve) - rows-not-code proof
        +------------+---------------+
                     v
              240  MAIL IS A SHAPE                   mig 175 - own discuss-phase, LAST
                     v
              241  RECALL AT CORPUS SCALE            mig 176 (reserve) - HARD
```

**Departures from the reconciled build order (slots 228-238), and why:**

| Departure | Why |
|---|---|
| **Two phases added: 235 (source health surface) and 236 (adversarial corpus).** | Research's slot 234 carried `LIB-08/09/10` + `SURF-01/02/03` + all four `VIS` lifecycle rows + `QUEUE-03` + `TRUST-03` + `SRC-06` + the threat model + the rule retirement. That is not one phase, it is three — and the two things that *can* be lifted out without breaking a fence are the **honesty surface** (`LIB-10`/`SURF-02`/`SURF-03` — one screen family, G-2-sketchable together) and the **adversarial corpus** (which PITFALLS itself calls a GA gate *"built once the trifecta fence exists"*). The fences themselves stay welded to the diff they fence. |
| **236 (attack the corpus) sits immediately after the fence, not at the end.** | `TRUST-02` exists because `SEED-188` found four modules carrying a written anti-injection discipline that **nothing tries to break**. Deferring the attack until after three more adapters have poured untrusted content in re-creates that exact failure. Attacking at 236 also means Graph / MCP / mail inherit a *tested* fence. |
| **241 (recall at scale) is its own phase, after mail.** | Research left `P-SCALE` *"cross-cutting, not a slotted phase"* — but `QUEUE-06` is a requirement, and a requirement with no phase is an orphan. The **harness** still ships early (inside 230, as research asks); the **tuning and the measured verdict** need a corpus that only exists after the adapters land. |
| **`VIS-06` in 234, not in the rule-engine phase.** | Measured — see Correction 3. This is H-4 and it is load-bearing. |
| **`VIS-05` (disconnect freeze) in 234, not in 235's surface phase.** | It is retrieval-affecting and security-bearing. `SEED-210` names disconnect as *"the moment a user most expects their data to stop being used, and the moment an implementation is most likely to leave it in place."* Shipping the first sync with a window in which disconnect does nothing is that defect, on purpose. |
| **`QUEUE-03` (no overlapping runs) in 234, not in the queue phase.** | It is a **watch lease**, not a queue property — there is nothing to overlap until a watch exists. PITFALLS agrees: *"the lease and the honest states are `P-WATCH`."* |

⚠ **`DEBT-04` (`app.<domain>`, `SEED-242`) does NOT sequence cleanly, and this roadmap says so rather
than pretending otherwise.** It is gated on a **production push**, which is operator-triggered and
may not fall in Phase 228's calendar slot. If the push comes later, `DEBT-04` is driven **out of
order** and recorded against Phase 228 wherever it actually lands — never silently re-scoped to make
the sequence look clean. The other four `DEBT` rows carry no such gate and are the phase's real body.

---

### ⚠ SURF-03 has no home in this product, and this roadmap does not pretend one exists

Research confirmed there is **no in-app notification surface**. `SURF-03` was written to *name* that
gap, not to assume past it. **It is given a phase (235) so it cannot become an orphan, and its home
surface is an EXPLICIT SCOPING DECISION owed at 235's `discuss-phase`.** The three cost-ordered
options FEATURES named (TS-8), plus the recommendation:

| Option | Cost | What it buys |
|---|---|---|
| A · A row in the Library **Health** tab | lowest — the tab already ships (217.1) | ⚠ **Does not satisfy the requirement's own words** — the person is still "looking at the page" |
| B · A persistent app-shell signal (badge / banner) visible on **any** page while a watch is broken | small — one shell component over a poll the app already makes | Satisfies *"reaches a person who is not already looking at the page"* with **no new infrastructure** |
| C · Email on permanent failure | real infra — there is **no system mailer**; the SMTP path is a *user's* connection, not ours | The only option that reaches someone who is not in the product at all |

⭐ **Recommendation: B + A, with C deferred behind a trigger.** B is the minimum that makes the
requirement's sentence true; A is where the detail lives once B is clicked; C re-opens when a
customer reports learning about a dead watch from a stale answer. ⚠ **If the operator rejects B,
`SURF-03` must be explicitly re-deferred with a named trigger — it must NOT be closed against option
A, because A does not do what the requirement says.**

---
### Phase Table

| Phase | Name | Goal | Requirements | SC# | Migrations | Flags |
|-------|------|------|--------------|-----|-----------|-------|
| 228 | v3.9 Closeout — The Debt Gets a Number | Everything v3.9 shipped without proving is either driven or re-deferred with a named reason, and the product serves from its production home | DEBT-01, DEBT-02, DEBT-03, DEBT-04, DEBT-05 | 5 | none expected | ⚠ **`DEBT-04` is gated on a production push — may be driven OUT OF ORDER.** UI hint (resume controls, landing/app split). **G-5**: `MessageItem.tsx` / `RunCard.tsx` / `ToolCallPanel.tsx` — all three **DISCHARGED at 227**, so the resume-cluster fix is **honoured by construction** on a run frame that finally has one owner. No threat model. No migration |
| 229 | The One Ingest Splice | Every document row in the product is minted by one piece of code, so a file behaves identically no matter which door it came through | TRUST-01 | 4 | none expected | ⭐ **REFACTOR ONLY — no new user-facing capability.** ⭐ **G-5 DISCHARGED**: `documents.py` (**73/30/2562**). Fixes D-5's two shipped defects as a side effect. **H-2: this is the prerequisite every adapter calls.** ⚠ Drive `ATTACH-01`'s import ONCE before planning (Correction 6). Skip research-phase. No UI |
| 230 | The Durable Ingestion Queue | Ingestion survives a restart, a burst and a provider outage — and says which of those happened | QUEUE-01, QUEUE-02, QUEUE-04, QUEUE-05 | 5 | **153** `153_ingestion_jobs.sql` | ⭐ **H-3: PROVEN ON `/upload` FIRST**, before any connector uses it. **G-5**: `main.py` (**77/56/839**) + `config.py` (**76/43/1408**) — both **honoured by construction**; `config.py`'s named seam stays **OWED**. **`check-deploy-drift.sh` gates this phase.** Carries the **recall harness** Phase 241 measures against. D-2 binds `QUEUE-05`. Skip research-phase. UI hint (the named refusal) |
| 231 | Connection-Scoped Visibility | A document that arrived through a connection is visible to exactly the people its owner chose — and the screen says who that is, in this product's own words | VIS-01, VIS-02, TRUST-04 | 4 | **154** `154_connection_scoped_visibility.sql` | ⚠ **THREAT MODEL MANDATORY.** ⚠ **H-1: policies FIRST, `SECURITY DEFINER` bodies LAST, ONE transaction; the negative case driven RED against all four sites BEFORE widening.** ⚠ **G-2 SKETCH before planning** (`VIS-02`). **G-5**: `retrieval_service.py` (**17/9/362** — fires, **absent from the ledger for its entire life**; honoured by construction here, **extraction stays OWED**), `connector_service.py` (honoured by construction). ⚠ **RESEARCH FLAG — deeper pass**: the four-site interaction with folder sharing is novel territory here |
| 232 | The Source Contract + Google Drive | A person browses a connected Google Drive from inside the product and picks a folder — over one contract every later family implements | SRC-01, SRC-02 | 4 | none expected | ⭐ **The "DATA, not code" constraint is decided HERE**; 238 and 239 are its measurement. **No new OAuth scope** (`drive.readonly` already granted at 221). **G-5**: `connectors.py` (**27/11/1727** — the file-import route moves OUT to `services/sources/`, a **PARTIAL DISCHARGE**, not merely construction); `cloud_storage.py` retired. ⚠ Shared-drive invisibility is **INFERRED, not driven**. Skip research-phase. UI hint |
| 233 | The Preview — See It Before It Lands | A person sees exactly what a source would bring in, labelled honestly, and nothing enters the Library until they say so | PREV-01, PREV-02, PREV-03, LIB-09 | 5 | none expected | ⭐ **THE MILESTONE'S DIFFERENTIATOR.** ⚠ **G-2 SKETCH MANDATORY before planning** (`PREV-01` — the four honest labels ARE the feature). **D-1's two-tier identity lands HERE**, never earlier. **G-5**: `LibraryPage.tsx` (**38/11/817** — 217-09 seam taken, a tab body is a CHILD: honoured by construction), `DocumentList.tsx` (**25/13/295** — ⚠ 7-column order load-bearing). ⚠ `vitest-count-gate.cjs` needs `TARGETS` **and** `BASELINE` for every new suite, in this phase |
| 234 | The Watch Loop — The Library Reads By Itself | A connected folder is read on a schedule without anyone remembering to upload, and everything that can go wrong at the source has an outcome a person could have predicted | LIB-08, SRC-06, QUEUE-03, VIS-03, VIS-04, VIS-05, VIS-06, TRUST-03, SURF-01 | 5 | **168-171** `connector_watches` · `connector_watch_items` · `documents_source_state` · reserve | ⭐⭐ **THIS COMMIT RETIRES THE STANDING `CLAUDE.md` MANUAL-UPLOAD-ONLY RULE, IN THE SAME COMMIT** (`SEED-142`). ⚠⚠ **THREAT MODEL MANDATORY** — untrusted external content enters the answered corpus **and** a new credential scope is added. ⚠ **H-4 (`VIS-06`) and H-5 (`SRC-06`) both bind here.** ⚠ **G-2 SKETCH** (`SURF-01`'s sentence + the watch-config screen). ⚠ **G-1 RISK PRE-EMPTED** — the sources UI gets its **own home**, never a bolt-on to `ConnectionFormPanel.tsx` (**20/8/2376**) or `ConnectionsTab.tsx` (**24/8/1578**). **G-5**: `scheduler_service.py` (**5/2/399 — NO LEDGER ROW; one is OWED in this commit**), `documents.py` (**keep 229's discharge**). Uses the **SHIPPED** scheduler. `check-deploy-drift.sh` gates. ⚠ **RESEARCH FLAG — the threat model needs its own pass.** ⭐ **The milestone's crux and largest phase** |
| 235 | The Source Says What It Did | A watch that stopped reading tells somebody who is not looking at it, says when it stopped, and offers the one action that fixes it | LIB-10, SURF-02, SURF-03 | 4 | **172** `172_connector_sync_runs.sql` | ⚠⚠ **`SURF-03`'s HOME IS AN OPEN SCOPING DECISION** — forced at discuss-phase; three options above; recommendation **B + A**. ⚠ **Option A alone does NOT satisfy the requirement.** ⚠ **G-2 SKETCH MANDATORY** (`SURF-02` history + `SURF-03` signal + the stopped-reading card). Folds **`SEED-239`** — one malformed `config` row degrades **one** source, not all. **G-5**: `LibraryPage.tsx` (honoured by construction), `DocumentList.tsx` (⚠ 7-column order), `useDocuments.ts` (**9/4/147** — Realtime is a hint, reconcile by fetch, D-v2.5-03) |
| 236 | The Corpus Under Attack | The anti-injection discipline this codebase wrote down is actually attacked, and fails loudly when a defence is removed | TRUST-02 | 3 | none expected | ⭐ **GA GATE.** Folds **`SEED-188`** — four modules carry a written discipline and **nothing tries to break it**. ⚠ **`SC#10` FIRES with the FULL 8-row native roster, derived from `MODEL_CAPABILITIES`, never re-typed**; a blocked provider is ⛔-with-a-reason, **never omitted**. ⚠ **Plant the payload in a SYNCED document during UAT**, not only a unit test. ⛔ No new Python package. No UI. No migration |
| 237 | One Rule Engine, Not Two | A routing rule and a classification rule are the same thing with a different scope, and a rule can use where a document came from | RULES-01, RULES-02 | 4 | **173** `173_classification_rules_scope.sql` | Folds **`SEED-243`** + **`SEED-209`**. ⛔ **A second AST is the anti-pattern this phase exists to prevent** — a scope discriminator on the existing `classification_matcher`, not a new engine. ⚠ **234's `VIS-06` fence must be RE-PROVEN under the widened engine** — widening the matcher is exactly the change that could quietly re-open H-4. **G-5**: `classification_matcher.py` / `classification_rule_service.py` are young with **no ledger rows** — add rows if either crosses 3 phases. Skip research-phase. UI hint |
| 238 | Microsoft Graph — OneDrive and SharePoint | A person watches a OneDrive or SharePoint folder exactly the way they watch a Drive folder | SRC-03 | 4 | none expected | ⭐ **THIS PHASE IS A MEASUREMENT of Phase 232's contract: if it is not SMALL, the contract was wrong — and THAT is the finding, not something to absorb quietly.** ⚠ Graph `/content` returns a **302** and `egress.py` refuses redirects by design — `$select=@microsoft.graph.downloadUrl` + a second pinned call to a different host with its **own egress key**; **the redirect must NOT leak into the shared contract**. ⚠ **RESEARCH FLAG — two MEDIUM/unverified facts**: `driveItem.file.hashes` member availability, and whether `Files.Read.All`/`Sites.Read.All` self-consent works in a real tenant or needs admin approval (**drive this before planning — it can block the phase**). UI hint |
| 239 | Any MCP Server With Files | A source family is added by connecting a server and pointing at what it serves — rows, not code | SRC-04 | 3 | **174** reserve | ⭐ **THE "ADDING A SOURCE ADDS ROWS, NOT CODE" PROOF** (Pitfall 12's fence, made observable). Tool binding stored as **data on the watch row**. ⚠ **Widen the `mcp_client` sanitizer allow-list, never remove it** — a raw passthrough puts server-controlled keys into `discovered_tools`. ⚠ A hint from an untrusted server may never **widen** a permission. **G-5**: `mcp_client.py` (4/2/407 — young). UI hint |
| 240 | Mail Is a Shape, Not a Fourth Adapter | A watched mailbox becomes knowledge without turning one conversation into fourteen copies of the same paragraph | SRC-05 | 4 | **175** `175_documents_thread_key.sql` | ⚠⚠ **A SHAPE PHASE, NOT AN ADAPTER PHASE — its own `discuss-phase`.** ⭐ **The boundary IS decided** (D-3: one message = one document, `thread_key` groups) — discuss-phase **confirms and records**; if it flips it flips **explicitly**, because STACK and PITFALLS recommend opposite defaults. Finally READS `message_id`/`in_reply_to`/`references`, which ship parsed and are consumed by nothing (v3.8 audit finding). **~80% already ships.** **Sequenced LAST so three families ship if it is cut.** ⛔ `SEED-212` transcripts stay OUT. UI hint (minimal) |
| 241 | Recall at Corpus Scale | Answers stay correct when the corpus is large and every search is filtered | QUEUE-06 | 3 | **176** reserve | ⭐ **HARD.** Folds **`SEED-076`** + **`SEED-197`**. ⚠ **The harness ships at 230, not here** — a baseline measured after the corpus grew is not a baseline. ⚠ **Verify local↔cloud pgvector version parity LIVE before `hnsw.iterative_scan` can be planned** as the `SEED-076` remedy. ⛔ No new Python package. **G-5**: `retrieval_service.py` (**17/9/362** — ⚠ **second landing this milestone, extraction still OWED from 231; a third must propose the extraction first**). ⚠ It computes a per-hit similarity and **drops it** (`SEED-224`) — the cheapest honest instrumentation available. No UI |s not a baseline. ⚠ **Verify local↔cloud pgvector version parity LIVE before `hnsw.iterative_scan` can be planned** as the `SEED-076` remedy. ⛔ No new Python package. **G-5**: `retrieval_service.py` (**17/9/362** — ⚠ **second landing this milestone, extraction still OWED from 231; a third must propose the extraction first**). ⚠ It computes a per-hit similarity and **drops it** (`SEED-224`) — the cheapest honest instrumentation available. No UI |

### Phase Checklist

- [ ] **Phase 228: v3.9 Closeout — The Debt Gets a Number** — owed UAT driven or re-deferred with a reason, the resume/continue moment stops lying, the product serves from `app.<domain>`, and the backend baseline is a number that can gate again (DEBT-01..05)
- [ ] **Phase 229: The One Ingest Splice** — one piece of code mints every document row; the same bytes through any door produce the same row (TRUST-01) ⭐ REFACTOR ONLY · G-5 DISCHARGE on `documents.py`
- [x] **Phase 230: The Durable Ingestion Queue** — ingestion survives a restart and a burst, batches within real provider limits, and names an embedding failure instead of saying your documents returned nothing (QUEUE-01/02/04/05) ⭐ PROVEN ON `/upload` FIRST
- [x] **Phase 231: Connection-Scoped Visibility** — one visibility per connection enforced at all four RLS sites, stated plainly on screen, with provenance visible at retrieval and citation time (VIS-01, VIS-02, TRUST-04) ⚠ THREAT MODEL · G-2 SKETCH
- [x] **Phase 232: The Source Contract + Google Drive** — one `browse/list/read/check` contract with Drive as the first thin adapter, and the shipped one-file import re-pointed onto it (SRC-01, SRC-02)
- [x] **Phase 233: The Preview — See It Before It Lands** — four honestly-labelled buckets, two-tier identity, rules evaluated with nothing written, and nothing ingested until a person confirms (PREV-01/02/03, LIB-09) ⚠ G-2 SKETCH MANDATORY — **DISCHARGED**: sketches 229 (winner C) + 230 (winner A), both operator-locked 2026-09-05
- [x] **Phase 234: The Watch Loop — The Library Reads By Itself** — a mapped folder read on the shipped scheduler, a lifecycle diff that can never delete on an incomplete listing, a disconnect that freezes, and a synced document that cannot make the agent act (LIB-08, SRC-06, QUEUE-03, VIS-03/04/05/06, TRUST-03, SURF-01) ⭐ RETIRES THE CLAUDE.md RULE, SAME COMMIT · ⚠ THREAT MODEL MANDATORY
- [ ] **Phase 235: The Source Says What It Did** — per-source run history with counts and errors, a stopped source that says when and offers the fix, and a signal that reaches someone who is not on the page (LIB-10, SURF-02, SURF-03) ⚠ SURF-03's home is an OPEN DECISION · G-2 SKETCH
- [x] **Phase 236: The Corpus Under Attack** — an adversarial corpus that fails when a defence is removed, driven on the full native roster, with the payload planted in a real synced document (TRUST-02) *(✅ **GA GATE MET 2026-09-06.** SC#2 8/8 mutations caught at the point of USE; SC#3 legible report; **SC#1 driven LIVE — payload planted in a watched Google Drive folder, synced, and refused by all 8 native-roster providers with ZERO write-tool invocations**; SC#10 behavioural refusal driven on all 8. Three providers surfaced the injection to the user unprompted. Two unscoreable turns EXCLUDED not counted — `BUG-260906-01`. Record: `236-VALIDATION.md`)*
- [x] **Phase 237: One Rule Engine, Not Two** — one AST and one matcher discriminated by scope, with source facts as first-class filterable fields (RULES-01, RULES-02)
- [ ] **Phase 238: Microsoft Graph — OneDrive and SharePoint** — a Graph folder watched exactly like a Drive folder, with the 302 dance sealed inside the adapter (SRC-03) ⭐ THE CONTRACT'S TEST
- [ ] **Phase 239: Any MCP Server With Files** — a file-serving MCP server becomes a watchable source by rows, not code (SRC-04)
- [ ] **Phase 240: Mail Is a Shape, Not a Fourth Adapter** — one message is one document, `thread_key` groups, attachments are children, and a fourteen-message thread does not answer fourteen times (SRC-05) ⚠ OWN DISCUSS-PHASE · LAST
- [ ] **Phase 241: Recall at Corpus Scale** — filtered vector search still returns the right chunks as the corpus grows, measured repeatably on local and cloud (QUEUE-06)

### Phase Details

#### Phase 228: v3.9 Closeout — The Debt Gets a Number

**Goal**: Everything v3.9 shipped without proving is either driven or explicitly re-deferred with a named reason, the moment a run stops stops lying about what its controls do, and the product serves from its production home — so nothing this milestone builds is stacked on unmeasured ground.
**Depends on**: Nothing (first phase).
**Requirements**: DEBT-01, DEBT-02, DEBT-03, DEBT-04, DEBT-05
**Success Criteria** (what must be TRUE):

  1. Every owed v3.9 verification row has a verdict a person can read — Phase 210's four undriven SC, Phase 211's UAT plus schema regeneration, Phase 214's eight-row cross-provider roster and eight G-4 operator drives, Phase 217's sixteen UAT rows. Each row reads **pass**, **⛔ blocked with its reason and blocking id**, or **re-deferred with a named trigger**. No row is silently absent (DEBT-01).
  2. A person whose run stopped can tell **Resume** from **Continue**: Resume carries on from where the work stopped instead of replaying the first prompt, and it keeps the model the thread was using. At the iteration cap the Continue control is on screen after a reload, not only during a live stream (DEBT-02 — `BUG-260818-01/02/03` and `BUG-260823-02/03/04` triaged **together**).
  3. A person visits the product's public root and gets the landing page; signing in takes them to `app.<domain>`; and every OAuth redirect — Google, Notion, any MCP server — returns to a URL that works. Verified on a **preview deployment before promotion** (DEBT-04, `SEED-242`).
  4. A developer reads the OAuth state rework's review findings, and each one is fixed, planted as a seed with a trigger, or accepted with a stated reason — none is left unaddressed (DEBT-03).
  5. `pytest tests/unit -q --continue-on-collection-errors` prints a figure, and the figure quoted anywhere in the repo is the figure that command prints — so a later run can be compared against it (DEBT-05).

**Plans**: TBD

**UI hint**: yes
**Migrations**: none expected.
**Flags**: ⚠ **`DEBT-04` is gated on an operator-triggered production push and may be driven OUT OF ORDER** — if the push happens later, `DEBT-04` is recorded against this phase wherever it actually lands, never re-scoped to hide the gap. **G-5**: the resume-cluster fix lands on `MessageItem.tsx` / `RunCard.tsx` / `ToolCallPanel.tsx`, all three **DISCHARGED at Phase 227** — so this work is **honoured by construction** on a run frame that finally has one owner; do not re-hollow it. No threat model (no new trust boundary). ⚠ `DEBT-01`'s Phase 214 rows include the **eight-row native roster** and **eight G-4 operator drives** — those are operator actions, not agent actions. Schedule them; do not simulate them. ⚠ `DEBT-05` must state the command **and** the flag it was measured with — the `71` quoted all through v3.9 was measured over a different set, which is the whole reason this row exists.

**## How we'd know this failed**

- A v3.9 owed row is marked done on the strength of a green suite rather than a driven observation.
- Resume is "fixed" by renaming the button — the label changes and the behaviour does not.
- One of the three resume bugs is fixed alone, leaving the moment still lying about the other two.
- The `app.<domain>` move is promoted straight to production without a preview verification, and an OAuth redirect breaks live — which is exactly what happened on 2026-09-04.
- The backend baseline is re-quoted from a different command than the one written down, so the number cannot gate anything, again.

---

#### Phase 229: The One Ingest Splice

**Goal**: Every document row this product will ever create is minted by one piece of code, so a file behaves identically no matter which door it came through — and so a red test on a future adapter can be attributed to that adapter.
**Depends on**: Nothing structural (may run alongside 228). ⭐ **Everything from 232 onward depends on this** (H-2).
**Requirements**: TRUST-01
**Success Criteria** (what must be TRUE):

  1. A person pulls a named file in from a connected service and **the file appears in the Library** — today the import writes a row the database refuses, so it does not (fixes D-5 defect 1: `connectors.py:1693`'s `storage_path` key, missing `file_path`, missing `content_hash` / `folder_id` / `version_number` / `is_latest`).
  2. The same file arriving through the upload button and through a connection produces documents a person cannot tell apart in the Library — same dedupe outcome, same version number, same folder, same searchable chunks, same metadata extraction.
  3. An email carrying two attachments puts **both** into the Library, or says which one it could not take and why — instead of dropping one into a log line nobody reads (fixes D-5 defect 2: `documents.py:2380-2444`'s unguarded insert inside a blanket `except Exception: log.warning`).
  4. Re-uploading a file already in the Library still produces one document with a new version, exactly as before this phase — **nothing a person can see changed on the upload path**.

**Plans**: TBD

**UI hint**: no (pure refactor; the only visible change is that a broken import starts working).
**Migrations**: none expected.
**Flags**: ⭐ **REFACTOR ONLY — no new user-facing capability**, which is precisely what G-5 asks for. ⭐ **G-5 DISCHARGED on `backend/app/api/documents.py`** (re-derived **73 commits / 30 phases / 2562 L**; the ledger cell reads `72/30/2535`): `mint_document_row()` + `splice_document()` extracted into `services/ingest_splice.py`. The ledger row **and** its section in `docs/HOT-FILE-LEDGER.md` update in the **same commit**. Also lands on `connectors.py` (**27/11/1727**) and `multimodal_service.py` (**17/9/1019** — ⚠ **+2 phases against its cell**) — both **honoured by construction**. ⚠ **Drive `import_connection_file` ONCE before planning**: the schema mismatch is verified but the runtime error mode is not, and *"this route currently does nothing"* is an assumption until it is driven. ⚠ **There are FOUR chunk-write sites** — the extraction must cover all four, not only `/upload`'s. ⚠ The shipped dedupe/versioning protections live in the **`/upload` HTTP handler** (`documents.py:547`), not in `ingest_document` (`:2030`) — which is why every non-`/upload` caller inherits none of them today. **Skip research-phase**: every line is already read at file:line; there are no external unknowns.

**## How we'd know this failed**

- The extraction ships and `/upload` still has its own dedupe/versioning preamble — two doors, only one of them watched.
- A later producer mints a row by hand anyway, because the splice did not cover the field it needed.
- `documents.py` shrinks but the ledger row still reads `extraction due` — or the row updates and `docs/HOT-FILE-LEDGER.md` does not, which is drift by this project's own same-commit rule.
- The upload path changes behaviour a person can notice: a different version number, a lost folder, a re-extracted metadata field.
- The attachment cascade still swallows its failures, just from a new file.

---

#### Phase 230: The Durable Ingestion Queue

**Goal**: Ingestion survives a restart, a burst and a provider outage — and when it cannot proceed, it says which of those happened instead of producing an empty answer.
**Depends on**: Phase 229 (the splice the queue calls).
**Requirements**: QUEUE-01, QUEUE-02, QUEUE-04, QUEUE-05
**Success Criteria** (what must be TRUE):

  1. A person uploads a batch of files, the backend restarts part-way through, and **every file still finishes** — none is left reading `processing` forever (QUEUE-01).
  2. A person uploads several hundred files at once and the product stays usable — files complete steadily under a visible cap, rather than the app becoming unresponsive or the provider refusing everything at once (QUEUE-01, QUEUE-04).
  3. When the embedding provider rate-limits or fails, the person is told **the embedding provider failed, and which one** — never *"your documents returned nothing"* — ingestion pauses with that refusal on screen, and resumes on its own when the provider recovers (QUEUE-05; closes ⛔ `BUG-260815-05`).
  4. A file that failed nine-tenths of the way through is picked up where it stopped — a person does not watch the same nine thousand files re-embed from zero (QUEUE-01's resume, QUEUE-05's retry).
  5. Everything else about the existing upload experience is unchanged — same screen, same stages, same counts. The queue is proven by the path that already has coverage, **before any connector touches it** (QUEUE-02).

**Plans**: 5 plans (230-01..230-05) executed and verified by driving (PASS)

**UI hint**: yes (the named refusal and the paused state are user-visible).
**Migrations**: **153** — `153_ingestion_jobs.sql`.
**Flags**: ⭐ **H-3 — PROVEN ON `/upload` FIRST.** A queue whose first customer is a new adapter makes every red run ambiguous between the two; this is the single highest-leverage ordering decision in the milestone. ⛔ **No broker and no new process** — reuse the shipped `FOR UPDATE SKIP LOCKED` claim pattern from `db/schedules.py` (`claim_due_schedules`) for a second table with a different claim key; `SchedulerService`'s own module docblock already states why no leader election is needed. **D-2 binds `QUEUE-05`**: retry the same endpoint with backoff/jitter → fail over to a **different credential/endpoint for the SAME model** (same vector space) → trip `circuit_breaker.py` and pause with a named refusal. ⛔ **No automatic cross-provider substitution, ever** — `document_chunks.embedding` is `vector(N)` with one global `N`, and matching the dimension does **not** make the vector **spaces** compatible; a half-OpenAI/half-Gemini corpus is silently degraded recall with green status everywhere, on the milestone whose own requirement is recall at scale. **`QUEUE-04`'s real ceiling is 300,000 tokens per request** (OpenAI) — the limit a naive batcher misses, not the 2048-input or 8192-token-per-input ones. **G-5**: `main.py` (**77/56/839** — ⚠ **+2 phases against its cell**) and `config.py` (**76/43/1408**), both **honoured by construction**; `config.py`'s named seam (`MODEL_CAPABILITIES` and its readers out) stays **OWED**. ⚠ **`check-deploy-drift.sh` gates this phase** — `docker-compose.prod.yml`, `deploy/onebox.env.example` and `docs/OPERATOR.md` update in the **same commit** as any `INGEST_*` var; a deliberately-omitted var is registered in `OMITTED_FROM_ONEBOX`, never left to drift. **Carries the recall harness** Phase 241 measures against. **Skip research-phase**: the pattern is already shipped and running in this codebase.

**## How we'd know this failed**

- A killed worker leaves documents stuck in `processing` with no way back — the exact state a restart was supposed to survive.
- The first bulk sync is the queue's first real customer, so a red run cannot be attributed to the queue or to the adapter.
- A 429 is handled by silently swapping providers, and recall degrades with every status green (D-2's named worst case).
- The batcher respects the input count and ignores the token ceiling, so large documents fail at exactly the size that matters.
- `INGEST_*` vars ship without their deployment artifacts and `check-deploy-drift.sh` fails — or worse, they are added to the omit list to make it pass.
- The recall harness is deferred "until there is a corpus", so Phase 241 has no baseline to compare against.

---

#### Phase 231: Connection-Scoped Visibility

**Goal**: A document that arrived through a connection is visible to exactly the people the connection's owner chose — enforced in the database, not in application code — and the screen says who those people are, in this product's own words, before anything is brought in.
**Depends on**: Phase 229 (same rows touched). **Land adjacent to 232 and review the two together**, per the reconciliation between ARCHITECTURE (sequence them) and PITFALLS (one wave).
**Requirements**: VIS-01, VIS-02, TRUST-04
**Success Criteria** (what must be TRUE):

  1. A person setting up a connection reads **one plain sentence** saying who will be able to see everything it brings in — before it brings anything in. There is no configuration path where that sentence is absent (VIS-02).
  2. A second person in the same organisation cannot reach a document from someone else's private connection **by any route**: it is not in the Library, it is not in search, and asking the agent about its contents produces an answer that does not contain them and a citation list that does not name it (VIS-01).
  3. Widening a connection to the whole organisation makes the same document appear in **both** the Library and the agent's citations — never one without the other, in either direction (VIS-01; this is the four-site lockstep, made observable).
  4. Opening a document that came from a connection shows **which connection placed it**, and a citation of that document carries the same fact — so a person reading an answer can tell machine-placed knowledge from knowledge somebody chose to upload (TRUST-04).

**Plans**: TBD

**UI hint**: yes
**Migrations**: ⚠ **154 · 155 · 156 — THREE, not the ONE reserved.** `154_connection_scoped_visibility.sql` (`ingest_visibility` + `source_connection_id` + the four-site widening, **in one transaction**) · `155_connection_default_ingest_visibility.sql` (`default_ingest_visibility` on the connection, so ingest can stamp it) · ⛔ `156_grant_default_ingest_visibility_column.sql` (**a hotfix — 155 broke the Connections page** by adding a column with no grant: the `connector_connections` column-grant trap firing a second time). **234 onward shifted up; numbers are monotonic and gaps are never backfilled.**
**Flags**: ⚠ **THREAT MODEL MANDATORY.** ⭐ **This is where the milestone stops being a feature and becomes a permission model** — until now every document in this corpus was deliberately placed by a person who could already read it, which is the entire reason ownership-based RLS was sound. ⚠⚠ **H-1 — THE ORDER OF WIDENING IS THE WHOLE RISK: widen the two RLS policies FIRST, the two `SECURITY DEFINER` bodies LAST, inside ONE transaction.** The dangerous direction (DEFINER first) makes the agent cite chunks the Library refuses to show; the safe direction is merely annoying. **Drive the negative case — a second user, same org, connection still `private` — RED against all four sites BEFORE any widening**, and keep those four assertions in the suite afterwards. **The four sites**: the `documents` policy, the `document_chunks` policy, the body of `match_document_chunks`, the body of `keyword_search_chunks`. ⚠ `match_document_chunks`'s body filters `AND d.is_latest = true` — a row minted without `is_latest` is invisible to retrieval while the Library lists it, which is why 229 comes first. ⚠ **G-2 SKETCH before planning** — `VIS-02` is *"feels like"* copy on a live surface, and *"silence is not an option the milestone allows"* means the sentence **is** the deliverable, not decoration. **G-5**: `retrieval_service.py` (**17/9/362** — **fires**, and **absent from the ledger for its entire life**; this phase is **honoured by construction** (one added term) but **the extraction obligation stays OWED**, and a row is due in this commit); `connector_service.py` (**21/7/1601** — honoured by construction). ⚠ **RESEARCH FLAG — deeper pass needed**: the four-site interaction with the existing folder-sharing model is genuinely novel territory for this codebase, and Pitfall 1's *narrower-of-two* predicate needs a concrete design, not the sketch. ⚠ **Pitfall 2**: the connecting user must not silently become a gateway — the connect flow states the scope and the preview states the count and tree. ⚠ **Pitfall 3**: one `audit_log` row per connection-sourced retrieval hit must exist **from the first sync** — retrofitting means the first months are permanently unauditable. ⚠ **`SEED-211`'s M-Files metadata-derived model is DECIDED AND RECORDED WITH A MIGRATION PATH, NOT BUILT** — record the path in this phase's decision log; retrofitting later is a re-ingest, not a migration, which is why the decision could not wait even though the build can.

**## How we'd know this failed**

- The Library and the agent disagree about one document — in either direction, but especially the agent citing what the Library hides.
- The visibility rule is enforced in a service function rather than in the policy, so a service-role read bypasses it — and this codebase has service-role readers inside `ingest_document` today.
- The four sites are widened in separate migrations or separate commits, so a window exists where three agree and one does not.
- The plain sentence exists on one configuration screen and not on another.
- A person cannot tell from a citation that the source was machine-placed through a connection.
- The connecting user quietly becomes a gateway — their personal Drive access re-exported to everyone the connection is shared with, and nothing on screen said so.
- "Who saw content from connection C" is not answerable in one query, because the audit row was left for later.

---

#### Phase 232: The Source Contract + Google Drive

**Goal**: A person browses a connected Google Drive from inside the product and picks a folder — and the code that does it is one `browse / list / read / check` contract every later source family implements as a thin adapter, so adding a family adds an adapter and never an ingest path.
**Depends on**: Phase 229 (the splice every adapter calls). Lands adjacent to 231 and is reviewed with it.
**Requirements**: SRC-01, SRC-02
**Success Criteria** (what must be TRUE):

  1. A person with a connected Google account browses their Drive folder tree **inside this product** and picks a folder to work with (SRC-02).
  2. That browse includes **shared drives**, not only My Drive — a person who keeps their team's documents in a shared drive can find them (SRC-02; ⚠ today's shared-drive invisibility is inferred from the absence of `supportsAllDrives` / `corpora` / `includeItemsFromAllDrives` and must be **driven**, not assumed).
  3. Pulling a single named file in from a connection — the flow that shipped at Phase 216 — still works, unchanged from a person's point of view, and now runs through the source contract instead of its own code (SRC-01).
  4. A source family that exists only in the test suite appears in the product's own source picker and browses exactly like Drive, using no code outside its own adapter file — so *"a family is a registration, not an ingest path"* is a fact a person can see rather than a claim in a docblock (SRC-01).

**Plans**: TBD

**UI hint**: yes
**Migrations**: none expected.
**Flags**: ⭐ **THE MILESTONE'S BINDING CONSTRAINT IS DECIDED HERE** — *a watched source must be DATA, not code.* Phases 238 and 239 are the measurement of whether it held. **Google is first for one reason: zero new OAuth scopes** (`drive.readonly` already granted at Phase 221) **and two-thirds of the code already exists** in `cloud_storage.py`, which this phase retires. **Provider specifics stay behind the boundary**: pagination cursors, Drive shared-drive vs my-drive, Graph drive/site ids, MCP tool-name variance — none may appear above the adapter. **The abstraction fence is COMMITTED WITH ADAPTER #2 (238), not after adapter #4** — but its shape is designed here: a CI check that no `provider ==` branch exists outside `adapters/`, plus a conformance suite every adapter **and a fake** must pass. **G-5**: `connectors.py` (**27/11/1727** — fires; the file-import route **moves out** to `services/sources/`, which is a **PARTIAL DISCHARGE**, not merely construction — say so in the ledger row); `connector_service.py` (honoured by construction). **Skip research-phase**: two-thirds of the code is already read at file:line and there are no new scopes.

**## How we'd know this failed**

- The Drive adapter needs something the contract does not have, and the fix is a parameter on the contract rather than a change inside the adapter.
- `cloud_storage.py` survives alongside the new adapter — two paths, only one of them tested.
- The conformance suite passes for Drive and has never been run against a fake, so it is a Drive test wearing a contract's name.
- Shared-drive files are still invisible and nobody drove the case, so the research's inference stays an inference.
- The one-file import behaves differently after being re-pointed — a different folder, a different dedupe outcome, a different failure message.

---

#### Phase 233: The Preview — See It Before It Lands

**Goal**: A person points at a folder in a connected source and sees exactly what bringing it in would do — told honestly, including what we cannot know without reading the file — and nothing enters the Library until they say so.
**Depends on**: Phase 229 (the mint's verdict) **and** Phase 232 (the listing). It cannot exist before either.
**Requirements**: PREV-01, PREV-02, PREV-03, LIB-09
**Success Criteria** (what must be TRUE):

  1. A person points at a Drive folder and sees **four lists** before anything is imported: what would be **added**, what is **already here (matched by source file, not by content)**, what **type is not supported**, and what **cannot be told without reading it** (PREV-01, LIB-09).
  2. A person closes the preview without confirming and **the Library is exactly as it was** — no document row, no chunk, no folder, no job (PREV-03).
  3. The preview shows **where each file would land**, including any folder a rule would suggest, before any row exists (PREV-03).
  4. A person confirms, and the files that arrive are the files the preview said would arrive — the counts match and the buckets were not optimistic (PREV-01, LIB-09).
  5. A file already in the Library is not imported again and not embedded again when the person confirms — and a file the preview could only guess at resolves honestly once read, landing either in the Library or in a named refusal, never silently in neither (PREV-02).

**Plans**: TBD

**UI hint**: yes
**Migrations**: none expected.
**Flags**: ⭐ **THE MILESTONE'S DIFFERENTIATOR.** ⚠ **G-2 SKETCH MANDATORY BEFORE PLANNING** — this is live UI whose entire value is how honestly it reads; the operator-approved mockup is the acceptance bar, and the four bucket labels are the deliverable, not decoration. ⭐ **D-1 lands HERE and nowhere earlier**: identity is **two-tier** — Tier 1 at preview time is `(source_system, external_id, source_version)` **compared for equality and never called a hash**; Tier 2 is the shipped `sha256` dedupe, which still runs at splice. ⛔ **`PROJECT.md`'s "a `content_hash` lookup, not a guess" is FALSE for a list-only pass and must not be reinstated in the copy** — `documents.py:620` hashes raw **bytes** (requiring the download the preview exists to avoid), Google Drive has **no** hash at all for native Docs/Sheets/Slides, and Microsoft Graph guarantees only `quickXorHash`, documents `sha256Hash` as unsupported, and populates hashes **after** the item is downloaded. ⭐ **The preview IS the diff pass — the same code with `dry_run=True`** — because a preview built as its own path is guaranteed to eventually disagree with the ingest. **G-5**: `LibraryPage.tsx` (**38/11/817** — fires; the 217-09 seam was taken and each tab body is a CHILD, so **honoured by construction**), `DocumentList.tsx` (**25/13/295** — ⚠ its **7-column order is load-bearing**: `LibraryPage` sheds columns 3-5 by `nth-child`). ⚠ **`vitest-count-gate.cjs` needs `TARGETS` AND `BASELINE` entries for every new suite, in this phase** — TARGETS decides what runs, BASELINE decides what is guarded, and a suite can sit on the wrong side of exactly one of them.

**## How we'd know this failed**

- The preview says "already here" about a file whose bytes we never compared, and the label claims certainty we do not have.
- A bucket is dropped to make the screen tidier — three buckets is the version that lies.
- Opening a preview writes something: a job row, a placeholder document, an audit entry that reads like an import.
- The preview and the real import disagree about counts, or about where a file lands.
- Confirming re-embeds files already in the Library, and the cost is only noticed on the bill.
- The preview is built as its own code path, and the first divergence from the ingest verdict is found by a user.

---
#### Phase 234: The Watch Loop — The Library Reads By Itself

**Goal**: A connected folder is read on a schedule without anyone remembering to upload, and every way a source can change — deleted, unshared, moved, modified, disconnected — has an outcome a person could have predicted from the screen.
**Depends on**: Phases **229 + 230 + 231 + 232** — all four. This is the first phase in this product's history where a document **no human placed** can reach a live corpus the agent answers from.
**Requirements**: LIB-08, SRC-06, QUEUE-03, VIS-03, VIS-04, VIS-05, VIS-06, TRUST-03, SURF-01
**Success Criteria** (what must be TRUE):

  1. A person maps a folder from a connected source to a Library folder, and files that appear at the source appear in the Library **without anyone uploading them**. The screen says **"checked every N minutes"** — never *"instantly"*, never *"on change"*. A check still running when the next one is due is **skipped and says so**, rather than running twice over the same folder (LIB-08, SURF-01, QUEUE-03).
  2. A file deleted at the source is **still in the Library** and still answerable, marked as missing at the source — and when a listing did not finish (a rate limit part-way through pagination, or an empty page that still claims there is more), **nothing at all is marked missing** (VIS-03, SRC-06).
  3. A person disconnects a connection: its documents **remain**, they **immediately stop appearing** in search and in the agent's answers, the frozen state is visible on screen, and **Purge now** and **Reconnect** are both offered by name (VIS-05).
  4. A file renamed, moved, re-shared or edited at the source produces the outcome the screen said it would — and a routing rule that would make a document visible to **more** people than the connection chose produces a **suggestion a person must accept**, never a move (VIS-04, VIS-06).
  5. A document brought in by a watch **cannot make the agent act on its behalf** — an instruction planted inside a synced file does not cause an outbound write, and the refusal names why it refused (TRUST-03).

**Plans**: TBD

**UI hint**: yes
**Migrations**: **168-171** — `168_connector_watches.sql` · `169_connector_watch_items.sql` · `170_documents_source_state.sql` · `171` reserved (audit action types / freeze state). ⚠ **Renumbered from 157-160 via operator ruling (BUS-143)** — 157-165 never existed; 166 and 167 were minted on 2026-09-05.
**Flags**: ⭐⭐ **THIS COMMIT RETIRES A STANDING `CLAUDE.md` RULE, IN THE SAME COMMIT** — *"Ingestion is manual file upload only — no connectors or automated pipelines"* is marked *dated, not permanent*, and `SEED-142` binds whoever ships the first sync connector to change it in the same commit. ⭐ **That same commit also retires the reason ownership-based RLS was ever adequate**, which is why 231 must already be live. ⚠⚠ **THREAT MODEL MANDATORY**: untrusted external content enters the corpus the agent answers from, **and** a new credential scope is added. ⚠ **RESEARCH FLAG — the threat model needs its own pass**; it is a security design problem, not a feature build. ⚠ **H-5 (`SRC-06`) is STRUCTURAL, not a discipline** — a `SourceListing` must assert `complete=True`, and a `missing` verdict may be written **only** from such a listing; the assertion ships in the same plan as the diff, never after it. Google's own tracker issue 406305173 (an empty page with a non-null `nextPageToken`) is the concrete mechanism; Onyx issue #1161 (*"removed 976 docs that were detected as deleted in the source"*, closed as not planned) and Microsoft's 28-day auto-removal are the two shipped products this fence exists to not become. ⚠ **H-4 (`VIS-06`) BINDS HERE, NOT AT 237 — measured**: rule evaluation lives **inside `ingest_document`** (`documents.py:2280`, measured in 234-MEASUREMENTS), so a synced row reaches the rules engine the moment it is minted. The engine never writes `folder_id` today (suggestion only), so the fence has to sit on `accept_classification` (`documents.py:1847`), which is the code that moves. ⚠ **G-2 SKETCH** — `SURF-01`'s sentence and the watch-config screen are live UI. ⚠ **G-1 RISK, NAMED IN ADVANCE**: do **not** bolt the sources UI onto `ConnectionFormPanel.tsx` (**22/9/2418**) or `ConnectionsTab.tsx` (**24/8/1578**). Both fire G-5, and both would then carry a third and fourth consecutive connection-settings phase — exactly the chain G-1 exists to stop. **Give the sources surface its own home.** **G-5**: `scheduler_service.py` (**5/2/399 — NO LEDGER ROW; one is OWED in this commit**, because this milestone's entire watch loop binds to it and G-5 currently cannot fire on it at any count); `db/schedules.py` (**1/1/359 — NO LEDGER ROW, row owed**); `documents.py` (**discharged at 229 — keep it discharged**); `connector_service.py` and `connectors.py` (honoured by construction). **Uses the SHIPPED scheduler** (`backend/app/db/schedules.py:263` `claim_due_schedules`) — ⛔ **a second scheduler is out of scope and re-litigates a solved split-brain problem.** Folds **`SEED-239`**: a malformed `config` row must degrade **one** source, not every connection in the org. ⚠ `check-deploy-drift.sh` gates this phase. ⭐ **This is the milestone's crux and will be its largest phase — watch the plan count, and if it exceeds what one phase can honestly verify, split the SURFACE out, never the fences.**

**## How we'd know this failed**

- A 429 mid-pagination marked files missing — the Onyx #1161 failure, in our product.
- A document became visible to someone the connection owner did not choose.
- A source delete removed a Library document, and nobody asked for that.
- The same file was ingested twice, or one poll ran on top of another over the same folder.
- The screen says *"instantly"* or *"on change"* anywhere, when there is no delta cursor and no webhook.
- A person disconnects and the agent keeps answering from the disconnected corpus.
- A synced document talks the agent into an outbound write — or the fence exists but was never tested with a real planted payload in a real synced file.
- The `CLAUDE.md` rule is changed in a *different* commit from the first sync — or the sync ships and the rule is still there, so the repo's own standing instructions contradict what shipped.

---

#### Phase 235: The Source Says What It Did

**Goal**: A watch that has stopped reading tells somebody who is not already looking at it, says when it stopped, and offers the one action that fixes it — and a person can always see what the last sync actually did rather than inferring it from what appeared.
**Depends on**: Phase 234 (there must be runs to report, and watches that can break).
**Requirements**: LIB-10, SURF-02, SURF-03
**Success Criteria** (what must be TRUE):

  1. A person opens a source and sees **every run it has made**: when it ran, how many files were added, skipped and failed, and the reason for each failure in plain language they can act on (SURF-02).
  2. A source whose token expired, whose folder was unshared, or whose server stopped answering **says that it stopped**, says **when it last succeeded**, and offers **one control** that fixes it — Reconnect, or re-pick the folder. It is never silently quiet (LIB-10).
  3. A person who has not opened the sources screen **finds out that a watch is broken** — the signal reaches them where they already are in the product (SURF-03).
  4. That signal does **not** fire for a healthy source, and does not fire for a single transient failure the next check recovered from — a person who ignores it once has not been trained to ignore it always (SURF-03, LIB-10).

**Plans**: 12 plans in 5 waves, plus 5 gap-closure plans in 2 waves (round 1) — **all 12 executed** (verified against `235-NN-PLAN.md` on disk, 12 files, and against twelve `235-NN-SUMMARY.md`).

⚠ **The `**Migrations**` line below reads `172` and was NOT stale at execution.** `235-12-PLAN.md` expected to find `161` there and correct it; the correction had already been made at planning time (D-235-20), and this is recorded because *verifying a discharge rather than assuming it* is the same rule D-235-18 turns on. The Phase Table row and this detail block agree.

Plans:
**Wave 1**

- [x] 235-01-PLAN.md — migration 172 + the DAL that writes and prunes the run row (wave 1)
- [x] 235-02-PLAN.md — the failure cause is DATA, and every cause has one sentence and one control (wave 1)
- [x] 235-03-PLAN.md — the composition fence, generated from the sketch and driven RED (wave 1)
- [x] 235-04-PLAN.md — the API client, the one verdict reader, and the quiet-run fold (wave 1)
- [x] 235-08-PLAN.md — an external caller can open the Library Health tab (`initialTab` threading) (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 235-05-PLAN.md — all FOUR release seams write an honest run row (wave 2)
- [x] 235-06-PLAN.md — the stopped verdict, computed once, from the live reader state (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 235-07-PLAN.md — the Sync button’s three-part honesty fix + the per-row degraded boundary (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 235-09-PLAN.md — the app-shell signal: rail badge, popover, and a mobile home (wave 4)
- [x] 235-10-PLAN.md — the variant-B source card, its run history, and the instance statement (wave 4)
- [x] 235-11-PLAN.md — the Health tab’s Sources attention section and the hop back to the card (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 235-12-PLAN.md — adopt the fence green (both knobs), the ledger rows, and the deferral record (wave 5)

**Gap-closure round 1** *(planned 2026-09-06 from `235-VERIFICATION.md` — G-7 checked and CLEAR: 12 plans, 0 prior gap-closure rounds. Five plans, two waves. ⚠ SC#3's mobile reach is deliberately NOT planned here: `SEED-253` is pre-existing, needs its own sketch under G-2, and building it inside a closure round is the new-capability move G-7 forbids.)*

- [ ] 235-13-PLAN.md — a switched-off connection is a named cause, and the vocabulary gains every word this round renders (wave 1)
- [ ] 235-14-PLAN.md — the last-good instant outlives the five-row verdict window, decided on the server (wave 1)
- [ ] 235-15-PLAN.md — the Health hand-off is one-shot, and the reader-count docblock says what is true (wave 1)
- [ ] 235-16-PLAN.md — ⭐ the BLOCKER: a run row renders the per-category breakdown, not one summed number (wave 2)
- [ ] 235-17-PLAN.md — which files could not be read and why, the last-good instant on screen, and the one control wired (wave 2)

**UI hint**: yes
**Migrations**: **172** — `172_connector_sync_runs.sql` (per-source run history: counts, errors, listing completeness). ⚠ **CORRECTED at planning (D-235-20): this detail block read `161` and was STALE; the Phase Table row already said 172.** Phase 234 consumed 168-171 and `supabase/migrations/` ends at `171_reserved.sql`, so 172 is the next monotonic number — gaps are never backfilled.
**Flags**: ⚠⚠ **`SURF-03` HAS NO HOME IN THIS PRODUCT AND THIS PHASE MUST NOT PRETEND OTHERWISE.** Research confirmed there is **no in-app notification surface**; the requirement was written to *name* that gap. **The home is an explicit scoping decision owed at this phase's `discuss-phase`**, from the three cost-ordered options in the section above. ⭐ **Recommendation: option B (a persistent app-shell signal visible on any page) + option A (the detail row in the Library Health tab), with option C (email on permanent failure) deferred behind a trigger.** ⚠ **Option A ALONE does not satisfy the requirement** — the Health tab is still a page a person has to open, so closing `SURF-03` against it would be closing it against its own sentence. If B is rejected, `SURF-03` is **re-deferred with a named trigger**, not marked done. ⚠ **G-2 SKETCH MANDATORY** — three live surfaces at once (run history, the stopped-reading card, the broken-watch signal), and *"reaches a person"* is a *"feels like"* judgement no wire format settles. Folds **`SEED-239`**: one malformed `config` row degrades **one** source while the others keep reading — the blast radius is the point, and it is observable here. **G-5**: `LibraryPage.tsx` (**38/11/817** — honoured by construction, a tab body is a child), `DocumentList.tsx` (**25/13/295** — ⚠ the **7-column order is load-bearing**), `useDocuments.ts` (**9/4/147** — ⚠ **+1 phase against its cell**; Realtime is a **hint, not truth** — reconcile by fetch on reconnect, D-v2.5-03).

**## How we'd know this failed**

- A watch has been dead for a week and the only way anyone would know is by opening its page.
- The signal fires on every transient blip until people stop reading it.
- The run history shows counts but not the reason a file failed, so the "one action that fixes it" cannot be chosen.
- `SURF-03` is closed against the Health tab — exactly the surface the requirement says is not enough.
- One broken connection makes every source's history unreadable (`SEED-239`'s blast radius, applied to a watcher).
- The run list is driven purely off Realtime and goes stale on a reconnect, with no fetch reconcile.

---

#### Phase 236: The Corpus Under Attack

**Goal**: The anti-prompt-injection discipline this codebase already wrote down is actually attacked by a corpus built to break it — and the suite goes red when a defence is removed, so the discipline stops being a comment and becomes a guarantee.
**Depends on**: Phase 234 (the fence must exist before it can be attacked, and the payload must be planted in a **real synced document**).
**Requirements**: TRUST-02
**Success Criteria** (what must be TRUE):

  1. A document carrying a planted instruction is **synced in from a real source**, and asking the agent an ordinary question does not make it follow that instruction — on every provider in the native roster (TRUST-02).
  2. Removing **any one** named defence turns the suite **red**, and the output names which defence was removed — so a green run means the defences are load-bearing, not that the attack was weak (TRUST-02).
  3. A person reading the run can see which attacks were tried and which were refused — a pass is legible, not a bare exit code (TRUST-02).

**Plans**: 3 plans (all 3 executed)

- [x] 236-01-PLAN.md — typed adversarial corpus, attack test suite & SC#3 attack report generator
- [x] 236-02-PLAN.md — SC#2 GA Gate in-process mutation runner with pytest monkeypatch fixture & 8/8 mutations caught
- [x] 236-03-PLAN.md — SC#10 dynamic native roster test suite, 236-ROSTER-REPORT.md & lived-experience sync UAT

**UI hint**: no
**Migrations**: none expected.
**Flags**: ⭐ **GA GATE.** Folds **`SEED-188`**, whose exact finding is that four modules carry a written anti-injection discipline and **nothing tries to break it** — a guard nobody has seen fire is not a guard. ⚠ **`SC#10` FIRES HERE with the FULL 8-row native roster** (OpenAI · Anthropic · Google · DeepSeek · Zhipu/GLM · MiniMax · Moonshot/Kimi · OpenRouter), **derived from `MODEL_CAPABILITIES`, never re-typed** — prompt-level guarantees are exactly the class that fails per-provider, and Moonshot's `emit_tier: coerce` rows are the weakest emission guarantee in the registry. **A provider with no key or a known blocker is recorded ⛔ with its reason and blocking id — never dropped from the table**; a scoreboard listing only what passed is not a scoreboard. ⚠ **Plant the payload in a SYNCED document during UAT, not only in a unit test** — the lethal trifecta is only real when the untrusted content arrived the way untrusted content actually arrives. **The corpus is the asset; the runner (pytest, promptfoo) is an implementation detail.** ⛔ **No new Python package** — research found every axis resolves to primitives at HEAD; a new dependency here is a finding to raise, not a default. **Placed immediately after the fence rather than at the end of the milestone** — deferring the attack until after three more adapters had poured untrusted content in would re-create `SEED-188`'s own failure.

**## How we'd know this failed**

- The suite is green and always has been — nobody ever proved it could go red.
- The attacks run against a unit-test string rather than a document that arrived through a sync.
- It is driven on one provider and called cross-provider.
- A blocked provider is quietly omitted, so the scoreboard lists only what passed.
- The corpus is written to match the defences that exist rather than to the attacks that are published.

---

#### Phase 237: One Rule Engine, Not Two

**Goal**: A watch-routing rule and a classification rule are the same thing with a different scope — one AST, one matcher — and where a document came from is an ordinary field a rule or a saved View can filter on.
**Depends on**: Phase 234 (a routing rule needs a real corpus and real source fields to tune against, and its access-control fence must already be live).
**Requirements**: RULES-01, RULES-02
**Success Criteria** (what must be TRUE):

  1. A person writes one rule that files incoming files by name, type, path or size **at the moment they arrive**, and another that files them by extracted metadata **after they are read** — in the same builder, with the same controls, having learned one thing (RULES-01).
  2. A person builds a rule, and a saved View, using **where it came from** as ordinary fields: this source system, this SharePoint library, under this path, from this sender (RULES-02).
  3. A watch rule that tries to match a field which does not exist yet at watch time is **refused at build time, with the reason** — rather than saved and silently never matching (RULES-01).
  4. A rule that would make a document visible to more people than its connection chose **still only ever suggests**, under the widened engine exactly as under the old one (RULES-01 — 234's `VIS-06` fence, re-proven).

**Plans**: 4 plans (4/4 complete)

**UI hint**: yes
**Migrations**: **173** — `173_classification_rules_scope.sql` (`rule_scope` discriminator + the `SOURCE_FIELDS` whitelist).
**Flags**: Folds **`SEED-209`** — the deferred phase text says the folder-watch rules and the classification surface *"should be designed together rather than growing two rule engines."* ⛔ **A second AST is the anti-pattern this phase exists to prevent**: it is a **scope discriminator on the existing, well-understood `classification_matcher`**, not a new engine. ⚠ **The scope split is real and load-bearing** — a watch rule at preview time has only `name` / `mime` / `path` / `size`, while a classification rule matches extracted metadata that exists only **after** extraction; a per-scope field whitelist is what makes SC#3 possible at build time rather than at never-matches time. ⚠ **`VIS-06`'s fence must be RE-PROVEN under the widened engine** — widening the matcher is exactly the change that could quietly re-open H-4. ⚠ The shipped rule read is a **service-role** read whose sole owner gate is an in-app `.or_(user_id.eq.…,is_system_global.eq.true)` predicate with a fail-closed Python re-filter (`documents.py:2487-2501`) — widening the engine must not weaken that, and the re-filter is defence in depth, not redundancy. **G-5**: `classification_matcher.py` and `classification_rule_service.py` are young and have **no ledger rows** — add rows if either crosses three phases in this commit. **Skip research-phase**: a scope discriminator on a matcher already read at file:line.

**## How we'd know this failed**

- Two builders exist, and a person has to know which kind of rule they are writing before they can start.
- A watch rule references extracted metadata, saves cleanly, and never fires — the failure mode that looks like a data problem forever.
- Source fields are available to rules but not to saved Views, or the reverse.
- The widened engine can move a document into a folder more people can see, because the fence was written for the old matcher.
- The whitelist is bypassed by one caller, and rule evaluation reads a field nobody vetted.
- The owner-scoping predicate or its fail-closed re-filter is dropped during the widening, and a global rule evaluates against another user's metadata.

---

#### Phase 238: Microsoft Graph — OneDrive and SharePoint

**Goal**: A person watches a OneDrive or SharePoint folder exactly the way they watch a Drive folder — and how small this phase is, is the milestone's measurement of whether Phase 232's contract was real.
**Depends on**: Phase 232 (the contract) and Phase 234 (the loop it plugs into).
**Requirements**: SRC-03
**Success Criteria** (what must be TRUE):

  1. A person connects a Microsoft account, browses **OneDrive and a SharePoint document library**, picks a folder, and previews it with the same four buckets they saw for Drive (SRC-03).
  2. Files from that folder are read and appear in the Library on the schedule — including files large enough to need the two-step download (SRC-03).
  3. Everything Phase 234 promised behaves **identically** for a Graph source: deletion does not delete, disconnect freezes, visibility is the connection's, an incomplete listing marks nothing missing. A person cannot tell from the behaviour which family they are watching (SRC-01's real test, observed through SRC-03).
  4. If this phase was **not small**, that is recorded as a finding against Phase 232's contract — naming the specific thing the contract could not express — rather than absorbed quietly into the adapter.

**Plans**: TBD

**UI hint**: yes
**Migrations**: none expected.
**Flags**: ⭐ **THIS PHASE IS A MEASUREMENT, not only a feature** — the milestone's binding constraint says a source family is an adapter, and adapters 2 and 3 are how that claim is tested. **If it is not small, the contract was wrong, and THAT is the finding**, requiring a stop rather than a surprise absorbed quietly. ⚠ **The 302 dance is adapter-internal and MUST NOT leak into the shared contract**: Graph `/content` returns a **302** and `egress.py` refuses redirects **by design**, so the adapter must `$select=@microsoft.graph.downloadUrl` and make a **second pinned call to a different host with its own egress key**. A contract that grows a `follow_redirects` flag has already failed this phase's real test. ⚠ **RESEARCH FLAG — two facts are MEDIUM confidence and unverified against a live tenant**: which `driveItem.file.hashes` members are actually populated (`quickXorHash` is the only guaranteed one, `sha256Hash` is documented unsupported, and hashes are populated **after** download), and whether `Files.Read.All` / `Sites.Read.All` self-consent works in a typical enterprise tenant or requires admin approval — **the second can block the whole phase and should be driven BEFORE planning.** **G-5**: `connector_service.py` and `connectors.py` — honoured by construction **if the contract held**; **if either grows a Graph branch, the contract did not hold.**

**## How we'd know this failed**

- The shared contract grew a Graph-shaped parameter — a redirect flag, a site id, a hash-kind enum.
- A `provider ==` branch appears outside the adapter directory.
- The phase took as long as Phase 232 did, and nobody recorded that as a finding.
- Admin consent turns out to be required, and it is discovered during execution rather than before planning.
- Graph documents behave differently under deletion or disconnect than Drive documents do.

---

#### Phase 239: Any MCP Server With Files

**Goal**: A source family is added by connecting a server and pointing at what it serves — rows, not code — which is v3.9's own lesson applied inbound.
**Depends on**: Phase 232 (the contract) and Phase 234 (the loop).
**Requirements**: SRC-04
**Success Criteria** (what must be TRUE):

  1. A person connects an MCP server that exposes a file surface, points the product at a folder it serves, and watches it on a schedule (SRC-04).
  2. Adding that source **added rows, not code** — a person can add a second, different MCP file server afterwards with no change to the product at all (SRC-04).
  3. It previews, syncs, and behaves under deletion, disconnect and visibility exactly as Drive does (SRC-04).

**Plans**: TBD

**UI hint**: yes
**Migrations**: **163** reserved (⚠ shifted +2 at 231's close) — the per-connection tool binding stored as **data on the watch row** (skip the number if it fits on an existing column).
**Flags**: ⭐ **THE "ADDING A SOURCE ADDS ROWS, NOT CODE" PROOF** — Pitfall 12's fence, made observable. **MCP tool-name variance stays behind the adapter boundary**: which tool lists and which tool reads is stored per connection as **data**, never branched on in code. ⚠ **Widen the `mcp_client` sanitizer allow-list, never remove it** — a raw passthrough puts server-controlled keys into `discovered_tools` JSONB. ⚠ **A hint from an untrusted server may never WIDEN a permission** — `annotations` / `readOnlyHint` may be carried and must not be depended on; they were measured absent in the wild. **G-5**: `mcp_client.py` (4/2/407 — young, no row owed yet), `connector_service.py` (honoured by construction).

**## How we'd know this failed**

- A second MCP file server needs a code change, so the family turned out to be a vendor after all.
- The tool binding is inferred by name-matching in code instead of stored as data.
- A server's advertised hint is trusted to grant something.
- Preview, deletion or disconnect behaves differently here than for Drive, so the contract only ever fitted two families.

---

#### Phase 240: Mail Is a Shape, Not a Fourth Adapter

**Goal**: A watched mailbox becomes knowledge the agent can answer from, without turning one conversation into fourteen copies of the same paragraph.
**Depends on**: Phase 234 (the loop) — and sequenced **last**, so three source families ship even if this one is cut.
**Requirements**: SRC-05
**Success Criteria** (what must be TRUE):

  1. A person watches a mailbox and asks the agent about something discussed in a long thread — the answer cites **the message that said it, once**, not the same paragraph repeated for every reply that quoted it (SRC-05).
  2. Attachments arrive as documents of their own, attached to the message they came on, and are findable both ways round (SRC-05).
  3. A reply that arrives later joins the same conversation without duplicating what was already there — a person searching the Library sees a conversation, not a pile (SRC-05).
  4. Everything Phase 234 promised behaves the same for mail: deletion does not delete, disconnect freezes, visibility is the connection's (SRC-05 under SRC-01).

**Plans**: TBD

**UI hint**: yes (minimal — a conversation grouping in the Library)
**Migrations**: **164** — `164_documents_thread_key.sql` (the retrieval-grouping column and its index). ⚠ Shifted +2 at 231's close.
**Flags**: ⚠⚠ **A SHAPE PHASE, NOT AN ADAPTER PHASE — it gets its own `discuss-phase`.** ⭐ **The boundary IS already decided and written into `SRC-05`: one message = one document, `thread_key` groups (D-3).** Discuss-phase **confirms and records** it — it does not silently inherit it, because **STACK and PITFALLS independently recommend opposite defaults** (message-as-document vs thread-as-document-with-newest-message-as-version) while agreeing on every surrounding fact. If it flips, it flips **explicitly, with the reason written down.** ⭐ **This finally READS `message_id` / `in_reply_to` / `references`, which ship parsed today and are consumed by nothing** — a v3.8 milestone-audit finding. **~80% already ships**: `strip_quoted_replies()` runs **before** chunking (which is why the poisoning that motivates thread-as-document is already mitigated), attachments-as-children ship with caps (`MAX_ATTACHMENTS_PER_EMAIL=50`, `MAX_ATTACHMENT_BYTES=25MB`), and Gmail and Graph mail both land on one `parse_eml_bytes()` — one parser, two adapters. ⚠ **The failure mode is dedup and retrieval poisoning, not a broken adapter**: a 14-message thread contains message 1 fourteen times, each body differs by the accreted quote block so hash dedup never fires, and retrieval returns the same paragraph fourteen times. ⚠ **The intake warning is SOFTENED, not withdrawn** — mail is still last and still its own phase. ⛔ **Meeting transcripts (`SEED-212`) stay OUT** with their trigger intact; they are event-shaped, and folding them in here is how this phase becomes two.

**## How we'd know this failed**

- An answer quotes the same paragraph several times because each quoting reply became its own document.
- The document boundary was picked by whichever research file the planner read last, with no recorded decision.
- `thread_key` is stored and read by nothing — the exact fate `message_id` / `in_reply_to` / `references` already suffered here.
- Two different emails carrying the same attachment collide on `documents_dedup_idx` and one is silently swallowed.
- Mail grows its own ingest path because "email is different", and the milestone becomes four milestones wearing one name.

---

#### Phase 241: Recall at Corpus Scale

**Goal**: Answers stay correct when the corpus is large and every search is filtered — measured, repeatably, rather than assumed because nothing looked wrong.
**Depends on**: Phases 234-240 (a corpus that is actually big, and filters that are actually applied). ⚠ **Its harness ships at Phase 230.**
**Requirements**: QUEUE-06
**Success Criteria** (what must be TRUE):

  1. A person searching a Library grown to customer scale still gets the right documents back — the same questions that worked at small scale still work, and the before/after numbers are on record (QUEUE-06).
  2. A search narrowed by folder, saved View, connection or source returns what an unnarrowed search would have found **within that scope** — the filter does not silently drop results that are there (QUEUE-06).
  3. Anyone can re-run the measurement and get a number, on **local and on cloud**, so a later regression is detectable rather than anecdotal (QUEUE-06).

**Plans**: TBD

**UI hint**: no
**Migrations**: **165** reserved (⚠ shifted +2 at 231's close) (index parameters / a filtered-search index; skip the number if none is needed).
**Flags**: ⭐ **HARD.** Folds **`SEED-076`** and **`SEED-197`**. ⚠ **The harness ships at Phase 230, not here** — a baseline measured after the corpus grew is not a baseline. This phase owns the **tuning and the verdict**. ⚠ **Local↔cloud pgvector version parity must be VERIFIED LIVE before `hnsw.iterative_scan` can be planned as the `SEED-076` remedy** — local Supabase and cloud Supabase can differ, which is precisely the cloud-parity drift class this project already tracks; assuming parity would put the remedy on an install that cannot run it. ⛔ **No new Python package.** **G-5**: `retrieval_service.py` (**17/9/362** — fires; ⚠ its **extraction obligation is still OWED from 231**, and this is the **second** phase in the milestone to land on it — if a third does, propose the extraction first under G-5 rather than adding to it). ⚠ `retrieval_service.py` computes a per-hit similarity and **drops it** (`SEED-224`) — that is the one retrieval fact this phase's measurement most wants, and surfacing it is the cheapest honest instrumentation available.

**## How we'd know this failed**

- "Recall is fine" is asserted from spot checks, with no number anyone can reproduce.
- The measurement runs only on local, and cloud has a different pgvector.
- A filter silently truncates results and the only symptom is answers that are slightly worse.
- `hnsw.iterative_scan` is planned before parity is verified, and cannot be enabled where it matters.
- This is the third phase to land on `retrieval_service.py` with the extraction still owed and nobody proposing it.

---
### Coverage Map — 38 / 38 requirements, each in exactly one phase

| REQ-ID | Phase | | REQ-ID | Phase |
|---|---|---|---|---|
| LIB-08 | 234 | | VIS-06 | **234** ⚠ not 237 — H-4, measured |
| LIB-09 | 233 | | QUEUE-01 | 230 |
| LIB-10 | 235 | | QUEUE-02 | 230 |
| SRC-01 | 232 | | QUEUE-03 | **234** ⚠ not 230 — it is a watch lease |
| SRC-02 | 232 | | QUEUE-04 | 230 |
| SRC-03 | 238 | | QUEUE-05 | 230 |
| SRC-04 | 239 | | QUEUE-06 | **241** (harness ships at 230) |
| SRC-05 | 240 | | TRUST-01 | 229 |
| SRC-06 | 234 | | TRUST-02 | 236 |
| PREV-01 | 233 | | TRUST-03 | 234 |
| PREV-02 | 233 | | TRUST-04 | 231 |
| PREV-03 | 233 | | RULES-01 | 237 |
| VIS-01 | 231 | | RULES-02 | 237 |
| VIS-02 | 231 | | SURF-01 | 234 |
| VIS-03 | 234 | | SURF-02 | 235 |
| VIS-04 | 234 | | SURF-03 | **235** ⚠ home is an OPEN DECISION |
| VIS-05 | **234** ⚠ not 235 — security-bearing | | DEBT-01..05 | 228 |

**Per-phase totals:** 228 → 5 · 229 → 1 · 230 → 4 · 231 → 3 · 232 → 2 · 233 → 4 · 234 → 9 · 235 → 3 ·
236 → 1 · 237 → 2 · 238 → 1 · 239 → 1 · 240 → 1 · 241 → 1.
**Sum = 38. No orphans. No duplicates. Coverage 38/38.**

### Guardrail summary — where each rule fires, and its disposition

| Rule | Fires at | Disposition |
|---|---|---|
| **G-1** phase-chain cap | ⚠ **`ConnectionFormPanel.tsx` (20/8/2376) / `ConnectionsTab.tsx` (24/8/1578)** — 232 / 234 / 235 would each add connection-settings surface | **PRE-EMPTED**: the sources/watch UI gets its **own home**, not a third and fourth bolt-on. **No `.N` insert chain is planned on any file in this milestone.** |
| **G-2** sketch before plan | **231** (`VIS-02`, the visibility sentence) · **233** (`PREV-01`, the four buckets) · **234** (`SURF-01`'s sentence + the watch-config screen) · **235** (`SURF-02` history + `SURF-03` signal + the stopped-reading card) · 237 (the rule builder, light) | `/gsd:sketch` **before** `/gsd:plan-phase` on all of them. **233 and 235 are MANDATORY** — their entire value is how honestly they read, and the operator-approved mockup is the acceptance bar. |
| **G-5** hot-file refactor | per-phase, see Flags | **DISCHARGED**: `documents.py` at **229** (73/30/2562). **PARTIAL DISCHARGE**: `connectors.py` at **232** (the file-import route moves out to `services/sources/`). **OWED**: `retrieval_service.py` (fires at 231 **and** 241 — a third landing must propose the extraction first); `config.py`'s `MODEL_CAPABILITIES` seam. **ROW OWED**: `scheduler_service.py` (**5/2/399**) has **no ledger row at all** — one is due in 234's commit. All other landings are **HONOURED BY CONSTRUCTION** (new modules, new children, one added term). |
| **G-6** failure criteria | every phase | `## How we'd know this failed` is written for **all 14** phases above. 234's includes verbatim the four conditions research named: a 429 mid-pagination marking files missing · a document visible to someone the owner did not choose · a source delete removing a Library document · the same file ingested twice. |
| **G-7** gap-closure cap | at execution | Run `node scripts/check-gap-closure-rounds.cjs <phase>` at every `gaps_found`, before emitting any `--gaps` routing. ⚠ **234 is the crux and the likeliest to run rounds** — and a closure round may **never** introduce a new user-facing capability. |
| **SC#10** cross-provider | **236** (the full 8-row native roster, derived from `MODEL_CAPABILITIES`) · lightly at **229 / 230** wherever the metadata-extraction model or `embed_chunks`' provider resolution is touched | Does **not** fire on most of this milestone — ingestion is not a streaming or agent-loop surface. |
| **Threat model** | **231** (the permission model) and **234** (untrusted content + a new credential scope) | **MANDATORY on both.** 234's needs its own research pass — it is a security design problem, not a feature build. |
| **Deploy drift** | **230** and **234** | `scripts/check-deploy-drift.sh`; `docker-compose.prod.yml` / `deploy/onebox.env.example` / `docs/OPERATOR.md` in the **same commit**. |
| **Count gate** | every phase creating a frontend suite | `TARGETS` **and** `BASELINE` in the creating phase. A suite present in only one of the two either runs unguarded or is guarded without running. `GSD_VITEST_MAX_WORKERS=2`; re-derive the total, never quote a stale one. |

### Migration reservations — monotonic from 153; the gaps at 130-139 and 142-149 are NEVER backfilled

| Phase | Numbers | File |
|---|---|---|
| 228 | — | none expected |
| 229 | — | none expected (pure refactor) |
| 230 | **153** | `153_ingestion_jobs.sql` |
| 231 | ⚠ **154 · 155 · 156** (reserved 1, used 3) | `connection_scoped_visibility` (four-site widening, one transaction) · `connection_default_ingest_visibility` · ⛔ `grant_default_ingest_visibility_column` (hotfix — 155 broke the Connections page) |
| 232 | — | none expected |
| 233 | — | none expected |
| 234 | **168 · 169 · 170 · 171** | `connector_watches` · `connector_watch_items` · `documents_source_state` · reserve (audit action types / freeze state) |
| 235 | **172** | `connector_sync_runs` |
| 236 | — | none expected |
| 237 | **173** | `classification_rules_scope` |
| 238 | — | none expected |
| 239 | **174** (reserve) | MCP tool binding on the watch row |
| 240 | **175** | `documents_thread_key` |
| 241 | **176** (reserve) | filtered-search index parameters |

**Rules:** a phase needing no migration takes no number; an unused reserved number is **skipped, never
reused**. Apply each by **pasting it into the Supabase SQL editor** — never `supabase db push` or
`db reset` — then run `bash scripts/regenerate-full-schema.sh` (no `--reset`). Filenames must match
`<digits>_name.sql`; letter suffixes like `155b` are silently skipped by the Supabase CLI. ⚠ A
`jsonb` column takes a **Python object**, never a pre-encoded string — a pre-encoded string becomes a
jsonb **string scalar**, the defect migration 123 had to repair and the fourth instance of which was
found at the v3.7 close.

### Deferred with triggers intact (not in this milestone)

| Item | Trigger to re-open |
|---|---|
| **Meeting transcripts as an event-shaped source** (`SEED-212`) | Any Teams / Zoom / Meet / transcription connector is proposed; or a user asks the knowledge base what was decided in a meeting; or chunking is revisited for a non-page-shaped source |
| **Per-document ACL mirroring / metadata-derived permissions** (`SEED-211`'s BUILD) | Connection-scoped visibility is **measured** insufficient by a real tenant. ⭐ The fork is DECIDED and a migration path recorded at **231**; only the build is deferred |
| **Delta / change-notification sync** (webhooks, `startPageToken`, Graph delta) | Polling is measured too slow or too expensive by a real customer. ⚠ `SURF-01`'s sentence changes **in the same commit** |
| **Inbound / Open Platform** (`SEED-013`, `SEED-195`) | Its own milestone |
| **PII / DLP redaction beyond `TRUST-04`** (`SEED-079`) | A regulated customer or the co-tenant SaaS tier exists |
| **Data-subject erasure beyond `VIS-05`'s purge** (`SEED-072`) | An EU customer or co-tenant exists; `VIS-05` answers only the disconnect row |
| **Structure-aware chunking** (`SEED-060`) · **Documents-space redesign** (`SEED-224`) | Folded into this milestone's seed list but given **no requirement** — they ride whichever phase touches their surface (`SEED-224`'s dropped per-hit similarity is named at 241) or return to the register |

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 228. v3.9 Closeout — The Debt Gets a Number | 4/4 | ✅ Complete (4 passed / 1 ⛔ blocked — `DEBT-03`) | 2026-09-04 |
| 229. The One Ingest Splice | 4/4 | ✅ Complete — VERIFIED by driving | 2026-09-05 |
| 230. The Durable Ingestion Queue | 5/5 | ✅ Complete — ⚠ **SC#2 / SC#3 are OWED DRIVES**, deadline before v4.0 closes | 2026-09-05 |
| 231. Connection-Scoped Visibility | — (built direct under the pairing, no GSD plan set) | ✅ Complete — Claude built, Gemini REVIEWED PASS by driving | 2026-09-05 |
| 232. The Source Contract + Google Drive | 4/4 | ✅ Complete — Gemini built, Claude REVIEWED by driving. ⚠ `OD-232-01` live-Drive drive OWED | 2026-09-05 |
| 233. The Preview — See It Before It Lands | 2/2 | ✅ Complete — Claude built AND verified (Gemini out, operator direction). ⚠ **G-4 lived-experience UAT is OWED** — 5 rows, run row 2 first | 2026-09-05 |
| 234. The Watch Loop — The Library Reads By Itself | 5/5 | ✅ **CLOSED — Gemini built, Claude VERIFIED BY DRIVING.** ⭐ A file arrived by itself: `last_status=success`, items 0→6. SC#4 held across two ingest paths (0 dupes, 0 re-embeds). ⛔ It did NOT work at first — `watch_process_enabled` ships `False`, so the watch had **never run once**; fixed with `WATCH_PROCESS_ENABLED=true`. 4 findings filed, none folded in: `BUG-260906-01` (classification never runs on the queue path — **fix before 235**), `-02`, `-03`, `SEED-252`. ⛔ SC#2/SC#3/H-5 unexercised, not failed | 2026-09-06 |
| 235. The Source Says What It Did | 17/17 | ✅ **CLOSED 2026-09-06** — Claude built, Gemini reviewed. 17 plans + 1 quick fix + 1 health task | 2026-09-06 |
| 236. The Corpus Under Attack | 3/3 | ✅ **CLOSED 2026-09-06** — Gemini built, Claude VERIFIED on BUS-168. 13/13 attacks refused in offline corpus, 8/8 mutations caught loudly at point of use, SC#10 parity verified. ⚠ **SC#1 & Live UAT OWED to operator live drive** (drive Google Drive first with live credentials & watched sync) | 2026-09-06 |
| 237. One Rule Engine, Not Two | 4/4 | ✅ **CLOSED 2026-09-06** — Gemini built, Claude VERIFIED on BUS-182/BUS-183. Unified rule builder with scope switcher, source facts as view filters, arrival facts matched at preview & ingest, suggestion-only retained under VIS-06 fence, migration 173 live. ⚠ **G-4 Manual UAT OWED by decision** (rule builder surface not manually clicked) | 2026-09-06 |
| 238. Microsoft Graph — OneDrive and SharePoint | 0/? | Not started | — |
| 239. Any MCP Server With Files | 0/? | Not started | — |
| 240. Mail Is a Shape, Not a Fourth Adapter | 0/? | Not started | — |
| 241. Recall at Corpus Scale | 0/? | Not started | — |

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
