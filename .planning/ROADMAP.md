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
- 🚧 **v3.9 Connections: Any Service, Any Tool** — Phases **210-216** (ACTIVE, opened 2026-08-26). Seven phases, **32/32 requirements mapped**. A person connects a **service** — not a protocol — sees every tool it offers, grants each one individually, and then uses it **by name in chat** and as a **specific step** on the canvas. ⭐ Nothing is per-vendor: a connection is `{service identity, auth, discovered tools, per-tool grants}`, so adding a service adds **rows, not code**. Order is load-bearing — `SEED-207` (retire `capability` as the browse axis) is a PREREQUISITE, the per-tool approval model is a HARD prerequisite for the chat surface, CONN-08's migration precedes OAuth, and MCP-first precedes OAuth. Nine bugs folded (2 blocking).

---

## v3.9 Connections: Any Service, Any Tool — ACTIVE (opened 2026-08-26)

**Started:** 2026-08-26 via `/gsd:new-milestone`. **Roadmap created:** 2026-08-26.
**Numbering:** continues at **210** (v3.8 ended at 209). **No number is reserved or skipped.**
**Scope source:** `.planning/REQUIREMENTS.md` — **32 REQ-IDs** across 7 phases.
⚠ **The scoping brief said "31 requirements"; the file contains 32** (`grep -c "^- \[ \] \*\*"` →
`32`). Coverage below is validated against the file, not against the brief.

**The one sentence this milestone is measured against:**

> A person connects a **service** — not a protocol — sees every tool it offers, grants each one
> individually, and then uses it **by name in chat** and as a **specific step** on the canvas.

⭐ **NOTHING IS PER-VENDOR, and that is the architectural point.** A connection is
`{service identity, auth, discovered tools, per-tool grants}`. Adding a service adds **rows, not
code**. Three doors in, in cost order: **custom MCP URL** (zero engineering — this is what makes the
menu unbounded) → **Popular catalog entry** (a few strings) → **BYO OAuth** (only for first-party
APIs with no MCP server; the cost is per AUTH FAMILY, not per product). **If a requirement can only
be met by writing code per service, it is the wrong requirement.**

### Measured facts this roadmap is built on — do NOT re-derive them from stale prose

- ✅ **MCP-first is already HALF-BUILT.** `backend/app/services/mcp_client.py` (367 L) ships at HEAD;
  Phase 206.2 shipped **per-tool grants** (`tool_grants` — the industry's most advanced permission
  grain, per the competitor study, *"do not regress it"*); Phase 209 shipped the
  `All / Connected / Not connected` filter. **These phases EXTEND that work; none of them rebuilds
  it.** ⚠ `CONNECTIONS-MILESTONE-CANDIDATE.md`'s claims that *"no MCP client exists in the backend
  today"* and that `test_189_no_egress.py`'s fence must still be retired are **both STALE** — the
  fence was retired in v3.8. That document is rich and mostly right; those two lines are not.
- ⚠ **OAuth genuinely IS zero.** Exactly one occurrence of the string in all of `backend/app`, and
  it is a comment in `models/connector.py` saying there is no flow, no redirect URI, no callback, no
  refresh token and no consent surface.
- ⚠ **A migration is owed before OAuth can store one row.** Migration 126 leaves
  `CHECK (capability IS NOT NULL OR mcp_server_url IS NOT NULL)`; an OAuth service has neither and
  the database refuses the row. **That is why CONN-08 sits in Phase 211 and OAUTH-01 in Phase 215.**
- ⚠ **The three fixed verbs must NOT be deleted.** `send_email` / `create_ticket` / `post_message`
  (`phase_types.py:2311-2322`) are the only external path that works with **no MCP server**. They
  become an ATTRIBUTE, never the organising axis.
- ⚠ **`readOnlyHint` CANNOT carry a direction design.** Driven live 2026-08-25: DeepWiki ships
  **no `annotations` at all** on any of its three tools — including one whose name begins with
  `read`. It is an optimisation when present, never the mechanism. `outputSchema`, by contrast, was
  **present on every tool** and is discarded by `mcp_client.py:293-296` — the study's *"single
  cheapest actionable finding"*, and it lands in Phase 211.
- ⚠ **`mcp_client.py:220` does blocking DNS inside an async handler** (D-v2.5-01) while the sibling
  capability path IS threadpooled. In scope by adjacency → Phase 212.

### The sequencing constraints — this order is not a preference

1. **`SEED-207` is a PREREQUISITE, not a feature.** While two connection models coexist, every
   downstream surface — node face, service mark, filter, chat mention, catalog entry, picker — must
   branch, and **each new surface pays the branch again**. Phase **211 lands before 212, 214 and
   216**.
2. **The per-tool approval model (GRANT-01..05, Phase 213) is a HARD PREREQUISITE for the chat
   surface (CHAT-05..07, Phase 216).** Standing project rule: *never add an outbound capability to
   `_TOOL_REGISTRY` before the approval model exists.* An ordering that ships chat first is wrong.
3. **CONN-08 (Phase 211) before OAUTH-01 (Phase 215)** — the database refuses the row otherwise.
4. **MCP-first, then OAuth** (operator direction, and the competitor study's inverted tiering:
   six of the eight named services are reachable at today's credential shape; **Google and Microsoft
   are the only two that are not, and they were the proposed Tier 1**). Leading with them would
   front-load 100% of the auth bill before one read shipped.
5. **Prove the model and the grants on the GOVERNED surface first.** Phase 214 (workflow steps)
   precedes Phase 216 (chat) because the canvas already carries D-19's armed checkpoint and the
   egress guard; chat carries neither today.

### Bugs folded (9) — no phase is a bug phase; each bug rides its requirement

| Bug | Requirement | Phase |
|---|---|---|
| `BUG-260826-01` ⛔ **BLOCKING** — a `send_email` step can never receive its arguments | STEP-02 | **214** |
| `BUG-260826-02` — publish accepts a step nothing can satisfy | STEP-03 | **214** |
| `BUG-260826-03` — manual schedule trigger 500s on null `org_id` (browser reports CORS) | CONN-11 | **210** |
| `BUG-260826-04` — `live_connectors` kill-switch invisible in the Control Room | CONN-09 | **210** |
| `BUG-260826-05` — a failed external step does not report its own reason | STEP-05 | **214** |
| `BUG-260826-06` — schedules accepted while the scheduler is off | CONN-10 | **210** |
| `BUG-260826-07` — default scheduled-run token budget cancels realistic workflows | CONN-10 | **210** |
| `BUG-260810-01` — cloud Connections tab has no Add button | CAT-05 | **212** |
| `BUG-260815-05` ⛔ **BLOCKING** — an embedding-provider 429 surfaces as *"your documents returned nothing"* | RAG-09 | **210** |

⚠ **RAG-09 is deliberately NOT connector work.** It rides in Phase 210 rather than owning a phase
because it **poisons the trustworthiness of every deliverable this milestone produces** — a
connections milestone whose retrieval lies about its own failures cannot be believed. Phase 210 is
its natural home: *the install reports its own state honestly, before anything new is connected to
it.*

### Phase Table

| Phase | Name | Goal | Requirements | SC# | Flags |
|-------|------|------|--------------|-----|-------|
| 210 | Ground Truth — Operability & Failure Honesty | The install honestly reports and controls its own external-action, scheduling and retrieval state — before anything new is connected to it | CONN-09, CONN-10, CONN-11, RAG-09 | 5 | Closes 5 bugs incl. ⛔ `BUG-260815-05`; **G-5** (`api/admin.py` — 32/12/1733, ⚠ **absent from the ledger at 12 phases**); UI hint; SC#10 **embedding roster** (not the chat roster); no threat model; no migration expected |
| 211 | The Connection Is a Service, Not a Verb | A connection is created against a service and its actions come from that service's own advertised tools; the three legacy verbs survive as one shape among many and organise nothing | CONN-04, CONN-05, CONN-08 | 5 | ⭐ **PREREQUISITE (`SEED-207`)** — blocks 212 / 214 / 216; **G-5** (`phase_types.py`, `grounding.py`, `models/connector.py`) — the retire IS the refactor; **migration 127** (drop mig 126's CHECK + service identity); widen the `mcp_client` sanitizer (`title` / `outputSchema`); light threat model (CHECK relaxation) |
| 212 | The Catalog and Its Doors | A person finds a service the way they find an app — by mark, name and purpose — and adds one from a Popular row or by pasting a URL, on every install including cloud | CAT-01, CAT-02, CAT-03, CAT-05, CONN-06, CONN-07 | 5 | **G-2 sketch** (`screenshots/` is the bar); **G-5 ×4** (`ConnectionsTab.tsx`, `ConnectionFormPanel.tsx`, `connectionsCopy.ts`, `connectionFormCopy.ts` — **all four fire**); closes `BUG-260810-01`; **threat model** (custom-URL door = SSRF / egress); fixes `mcp_client.py:220` blocking DNS (D-v2.5-01); UI hint |
| 213 | Per-Tool Grants and the Approval Moment | Each tool of a connection is granted or denied individually, and a tool whose posture requires approval stops and asks a real person before anything leaves | GRANT-01..05 | 5 | ⭐ **HARD PREREQUISITE for 216**; **G-2 sketch** (grant list + approval moment); ⚠ **G-1 risk** — 2nd consecutive phase on `ConnectionFormPanel.tsx`; **threat model** (the trust boundary of this milestone); SC#10 (pauses a live run); builds on 206.2 `tool_grants` + Phase 085 `ask_user` — **extend, do not regress**; migration likely (posture column) |
| 214 | A Step Names Its Service and Its Action | An author adds an external step by picking a service and a named action, the step's arguments arrive from whatever launched the run, publish refuses one nothing can satisfy, and every run surface says which service and action it was | STEP-01..06 | 5 | Closes ⛔ `BUG-260826-01` + `-02` + `-05`; **G-2 sketch** (step picker, canvas + run faces); **G-5 ×3** (`ConnectionPicker.tsx`, `ExternalActionSection.tsx`, `phase_types.py`) + `McpToolPicker.tsx` (⚠ **no ledger row of its own**); **threat model** (publish gate + argument provenance); SC#10; ⚠ **launch decision owed on `visual_workflow_canvas`** (cold default `off`) |
| 215 | BYO OAuth | A customer registers their own OAuth application, connects a first-party service with it on any deployment including self-hosted, and the connection keeps working without them reconnecting | OAUTH-01, OAUTH-02, OAUTH-03 | 4 | **Depends on CONN-08 (211)**; **threat model — MANDATORY** (this is migration 118's defect class); **G-2 sketch** ⚠ **whose bar is NOT `screenshots/`** — those show a vendor-owned 2-click Connect this milestone explicitly does not ship (D-v3.9-01); **migration** (token / refresh / expiry / scope / account identity); refresh must be **claim-based** (`WORKER_COUNT=2`, no leader); deployment-artifact parity (redirect URI is a new env var) |
| 216 | Connections in Chat, and One File In by Hand | A connected service is a platform asset a person uses by name in a thread, the agent picks which granted tool to call, and a person can pull a single named file from a connected source into the thread | CHAT-05, CHAT-06, CHAT-07, CAT-04, ATTACH-01 | 5 | ⭐ **Gated behind 213** — never an outbound capability in `_TOOL_REGISTRY` before the approval model; **G-2 sketch** (service chip, starter prompts, attach picker); **G-5 ×4** (`ChatLayout.tsx` ⚠ 21 phases and **absent from the ledger**, `MessageInput.tsx`, `ToolCallPanel.tsx`, `MessageItem.tsx` — the last two read **extraction due**); **threat model** (⚠ **prompt injection** — every read lands untrusted text in the model's context; the tree has never faced this because until 206.2 every connector was a write); **SC#10 full 8-row roster** |

### Phase Checklist

- [ ] **Phase 210: Ground Truth — Operability & Failure Honesty** — kill-switch visible and effective, a schedule cannot be silently accepted on a scheduler-off install, a null-`org_id` manual trigger works, and an embedding-provider failure is named as one (CONN-09, CONN-10, CONN-11, RAG-09)
- [ ] **Phase 211: The Connection Is a Service, Not a Verb** — service-shaped connections whose actions come from advertised tools; the three verbs demoted to an attribute; the OAuth-shaped row can exist (CONN-04, CONN-05, CONN-08) ⭐ PREREQUISITE
- [x] **Phase 212: The Catalog and Its Doors** — searchable service catalog with marks and purposes, state-only filters, a Popular row, the paste-a-URL door, and edit/delete that keeps grants (CAT-01, CAT-02, CAT-03, CAT-05, CONN-06, CONN-07) · ⚠ closed with owed rows (`/code-review ultra`, cloud SC#3) and two findings routed to 213 (`SEED-214`, `BUG-260827-02`)
- [ ] **Phase 213: Per-Tool Grants and the Approval Moment** — one list of reads and writes, an inheritable default posture, a run that pauses and names service/tool/arguments, a refusal that names its grant, and an audit receipt per call (GRANT-01..05) ⭐ HARD PREREQUISITE for 216 · ⚠ **+ the 1:1 unlock and the grant-gate close** (`SEED-214`, `BUG-260827-02`) — SC#1 is unsatisfiable without them
- [ ] **Phase 214: A Step Names Its Service and Its Action** — service→action picking with no URL and no hand-written JSON, arguments that arrive from every launch path, a publish that refuses the unsatisfiable, honest step identity and failure on the run surfaces, and a describe door bound to the author's real vocabulary (STEP-01..06)
- [ ] **Phase 215: BYO OAuth** — customer-registered client id/secret, an authorization-code consent that works self-hosted, silent refresh, a plainly-stated revoked state, and secrets unreadable at rest (OAUTH-01..03)
- [ ] **Phase 216: Connections in Chat, and One File In by Hand** — add a service to a thread by name, see and remove what is active, tool calls that render with the real mark and name, starter prompts that actually run, and one file pulled in by hand (CHAT-05..07, CAT-04, ATTACH-01)

### Phase Details

#### Phase 210: Ground Truth — Operability & Failure Honesty

**Goal**: The install honestly reports and controls its own external-action, scheduling and retrieval state — so that everything this milestone connects to it lands on a platform that does not lie about its own condition.
**Depends on**: Nothing (first phase — deliberately independent of the connection model so the two ⛔ blocking-class defects are not gated behind a schema change).
**Requirements**: CONN-09, CONN-10, CONN-11, RAG-09
**Success Criteria** (what must be TRUE):

  1. An operator opens the Control Room, sees the `live_connectors` kill-switch with its current state, flips it, and a subsequent external call is refused (CONN-09 — closes `BUG-260826-04`).
  2. A user who saves a schedule on an install whose scheduler is disabled is told so at save time; the schedule is never silently accepted and then never run (CONN-10 — closes `BUG-260826-06`).
  3. A scheduled run starts with a token budget a realistic workflow can finish inside, instead of cancelling itself part-way (CONN-10 — closes `BUG-260826-07`).
  4. A user whose `org_id` is null triggers a schedule manually and the run starts — no 500, and no CORS error in the browser standing in for one (CONN-11 — closes `BUG-260826-03`).
  5. When the embedding provider fails, the answer says the provider failed and names it — never *"your documents returned nothing"* (RAG-09 — closes ⛔ `BUG-260815-05`).

**Plans**: 3 plans (210-01, 210-02, 210-03)

**UI hint**: yes
**Flags**: Closes 5 of the milestone's 9 folded bugs, including ⛔ `BUG-260815-05`. **G-5**: `backend/app/api/admin.py` (32 commits / 12 phases / 1733 L — **fires**, and ⚠ **it has been absent from the ledger for its whole life**, so G-5 has never been able to fire on it; re-derive from git at discuss-phase rather than trusting the cell). **SC#10 applies with a DIFFERENT roster** — RAG-09's axis is the *embedding* provider set (OpenAI / Google / Ollama / LM Studio / OpenAI-compatible, per Phase 111.1), not the 8-row chat roster; a blocked provider is recorded ⛔ with its reason, never omitted. No threat model expected (no new trust boundary — CONN-09 tightens an existing one). No migration expected; if CONN-10's budget default is stored in `app_settings`, deployment-artifact parity applies in the same commit. ⚠ **CONN-10 has two halves and a plan must not close on one** — "cannot be silently accepted" and "the default budget does not guarantee cancellation" are two different defects (`-06` and `-07`) that share a requirement.

#### Phase 211: The Connection Is a Service, Not a Verb

**Goal**: A connection is created against a **service**, and the actions it offers come from that service's own advertised tools — so that adding a service is data rather than code, and no surface downstream ever has to branch on which of two connection models it is looking at.
**Depends on**: Nothing structural (may run alongside 210). ⭐ **Everything after it depends on this.**
**Requirements**: CONN-04, CONN-05, CONN-08
**Success Criteria** (what must be TRUE):

  1. A user creates a connection by naming a **service**, and the actions offered are the tools that service advertises — the three-verb dropdown appears nowhere in the flow (CONN-04).
  2. A Slack / Jira / SMTP connection created before this phase still sends, unchanged, and now presents as a service with named actions rather than as a capability (CONN-05).
  3. A user browsing, filtering or picking a connection is never offered `Message` / `Ticket` / `Email` as a category — the verb survives as an attribute of one shape, and organises nothing (CONN-05).
  4. A connection row for a service with **neither a capability nor an MCP URL** saves successfully (CONN-08).

**Plans**: 5 plans in 4 waves — waves 1-2 are a genuine `depends_on` chain, **wave 3 is a genuine PARALLEL pair** (211-03 settings ∥ 211-04 workflows, zero `files_modified` overlap), and 211-05 depends on both

Plans:
- [x] 211-01-PLAN.md - one shape: static tool descriptors derived from each adapter's own INPUT_SCHEMA, the sanitizer widened by `title` + `outputSchema`, and all seven closed-set spellings enumerated (incl. migration 116's SQL CHECK, held by nothing executable until now)
- [x] 211-02-PLAN.md - migration 127: `service_id` + backfill + ⭐ the §2b **descriptor backfill** that makes SC#2 true for the two rows that already exist + the stated replacement guarantee + the column GRANT; the five-point column lockstep, the third arm in `_validate_connection_shape`, and the `lib/api/org.ts` wire contract wave 3 compiles against. [BLOCKING] operator paste + `regenerate-full-schema.sh`
- [x] 211-03-PLAN.md - the create flow names a SERVICE: the three-verb chooser leaves the source, an unheard-of service saves with no capability key, no per-vendor branch enters the tree (settings only)
- [x] 211-04-PLAN.md - ⭐ the pickers read the tool list, never the endpoint: one unscoped read lists every shape, the browse axis goes, and **an empty action list keeps its Refresh control on EVERY shape** — the closed loop plan review caught (workflows only)
- [x] 211-05-PLAN.md - the two absences proved: the SC#3 source fence, **both halves of the seam** (backend data + frontend render, each naming the other), both count-gate knobs, five owed ledger rows, and the per-shape G-4 board

**UI hint**: yes
**Flags**: ⭐ **PREREQUISITE — `SEED-207`.** **G-5, and this phase IS the refactor**: `phase_types.py` (45/20/2621 — fires; the 200-03 extraction was taken, the file stays hot), `harness/grounding.py` (19/6/1311 — fires; `EXTERNAL_ACTION_CAPABILITIES` is the runtime home of the closed set), `models/connector.py`. ⚠ **`capability` is spelled in FOUR places held in agreement by two module-scope `assert`s** — migration 116's `CHECK`, `grounding.EXTERNAL_ACTION_CAPABILITIES`, `ConnectorCapability`, `ExternalActionPhaseConfig.capability`. That machinery is *good engineering of the wrong model*; **do not add a fifth verb**. The industry replacement is **service → (resource, operation)** as free text on the discovered-tool list, with the closed set moving to the **per-tool grant**, which is data and already ships. **Migration 127** (head is 126): drop mig 126's `CHECK`, add service identity. Apply by pasting into the Supabase SQL editor, then `bash scripts/regenerate-full-schema.sh`. **Widen the `mcp_client` sanitizer allow-list** (`mcp_client.py:293-296`) to carry `title` and `outputSchema` — ⚠ **widen the list, never remove it**; a raw passthrough puts server-controlled keys into `discovered_tools` JSONB. `title` feeds Phase 212's catalog label; `outputSchema` feeds Phase 214's argument satisfiability. ⚠ **`annotations` / `readOnlyHint` may be carried but MUST NOT be depended on** — measured absent in the wild, and per spec a hint from an untrusted server may never *widen* a permission. Light threat model (relaxing a `CHECK` is removing a database-level guarantee — say what replaces it). D-14 red line: no new executor.

#### Phase 212: The Catalog and Its Doors

**Goal**: A person finds a service the way they find an app — by its mark, its name and a one-line purpose — and adds one either from a curated Popular row or by pasting a URL for a service we have never heard of, on every install including cloud.
**Depends on**: Phase 211 (the catalog cannot be built on `capability` — that is the measured reason DeepWiki vanished from every chip).
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-05, CONN-06, CONN-07
**Success Criteria** (what must be TRUE):

  1. A user browses connections as a **searchable list of services**, each with its own mark, display name and one-line purpose (CAT-01).
  2. A user filters that list by `All / Connected / Not connected`, and finds no filter anywhere describing what a connector can *do* (CAT-03).
  3. A user **on a cloud install** connects one of the curated Popular services in one click, from the same list every other service lives in (CAT-02, CAT-05 — closes `BUG-260810-01`).
  4. A user pastes an MCP server URL for a service nobody here has heard of, its tools are discovered and become grantable, and **no code changed on our side** (CONN-06).
  5. A user edits a connection's name, credentials or endpoint and saves — and its existing per-tool grants are still exactly as they were; deleting the connection removes it cleanly (CONN-07).

**Plans**:
- [ ] 212-01-PLAN.md - outbound egress hardening (D-v2.5-01 threadpooled DNS, IP literal pinning, transport security) + POST /connectors/discover-tools pre-save discovery route
- [ ] 212-02-PLAN.md - servicesCatalog.ts presentation registry (curated popular services + starter prompts + total fallback) + connectionMark.tsx service_id resolver + discoverConnectorTools API export
- [ ] 212-03-PLAN.md - ConnectionFormPanel.tsx interactive pre-save discovery preview + popular service templates + key-preserving tool_grants merge + impact-aware deletion sheet
- [ ] 212-04-PLAN.md - ConnectionsTab.tsx unified catalog view with top Popular Services row, search & state filter chips (All / Connected / Not connected), multi-instance aggregation, and cloud parity policy banner (BUG-260810-01)
- [ ] 212-05-PLAN.md - D-207-06 barrel completeness guard + G-5 hot-file ledger updates + multi-gate verification gauntlet

**UI hint**: yes
**Flags**: **G-2 sketch owed before planning** — `screenshots/` is the acceptance bar (⚠ **Claude.ai**, verified by reading the images 2026-08-26; `202011` Connectors → the catalog IA and the `Custom` badge that IS the custom-URL door; `202036`/`202044` Plugins Directory → the long-tail catalog IA). ⚠ **The bar is the catalog IA and the grant grain, NOT the two-click Connect moment** — those shots depict a product where the vendor owns every OAuth app, which D-v3.9-01 explicitly declines. **G-5 fires on FOUR files this phase will touch** — `ConnectionsTab.tsx` (8/3/1223), `ConnectionFormPanel.tsx` (5/3/1758 — crossed the threshold in the commit that added its row), `connectionsCopy.ts` (4/3/541), `connectionFormCopy.ts` (4/3/759) — **so discuss-phase opens with a refactor recommendation, not with the feature**; the catalog rebuild plausibly discharges it by construction, but that must be *argued*, not assumed. **Threat model REQUIRED**: the paste-a-URL door is an operator-supplied outbound endpoint — SSRF, redirect chasing, response size, and the egress guard's ruling on a URL nobody curated. **Fix `mcp_client.py:220`'s blocking DNS in an async handler** (D-v2.5-01) — in scope by adjacency, and the sibling capability path already shows the threadpooled shape. ⚠ **`D-207-06` has no guard**: a symbol exported from a `lib/api` domain module but forgotten in the barrel typechecks perfectly and is invisible to every consumer — this phase adds `lib/api` surface, so check the barrel explicitly.

#### Phase 213: Per-Tool Grants and the Approval Moment

**Goal**: Each tool of a connection is granted or denied individually — reads and writes in one list — and a tool whose posture requires approval stops the run and asks a real person, naming the service, the tool and the arguments, before anything leaves.
**Depends on**: Phase 211 (grants key to a service's discovered tools) and Phase 212 (the detail screen the grant list lives on).
**Requirements**: GRANT-01, GRANT-02, GRANT-03, GRANT-04, GRANT-05
**Success Criteria** (what must be TRUE):

  1. A user sees every tool a connection offers in **one list** — a search and a create side by side — and switches each on or off independently, granting the search freely while holding the create back (GRANT-01).
     ⚠ **AND THIS IS TRUE FOR EVERY SHAPE, NOT ONLY THE MCP ONE** (`SEED-214`, added 2026-08-27 from the operator's drive of Phase 212). Today `connector_connections.capability` is a SINGLE column with a `CHECK` over three verbs, so a Slack, Jira or Email connection **structurally holds exactly one action** — GitHub lists 44, they list one each. This criterion is therefore **unsatisfiable as written** for three of the operator's connections unless the phase also breaks that 1:1 lock: a SERVICE maps to MANY descriptors written into `discovered_tools`, exactly as the MCP arm already does. **Additive — `capability` stays as the row's identity, nothing retires, no bound step breaks.** ⚠ **FILLING the lists is explicitly OUT of scope** (growing an adapter's action set, adopting a new MCP server, an OpenAPI ingester): that is per-service work which must FOLLOW the approval model, never accompany it.
  2. A user sets a connection-level approval posture **once**, and every tool shows that posture until it is individually overridden (GRANT-02).
  3. When the agent calls a tool whose posture requires approval, the run **pauses** and shows a person the service, the tool and the exact arguments — and nothing leaves until they answer (GRANT-03).
  4. A tool that is denied, or was never granted, is **refused** — and the refusal names the grant that would allow it (GRANT-04 — closes `BUG-260827-02`).
     ⚠ **AND THE REFUSAL MUST REACH THE CAPABILITY SHAPE, WHICH TODAY IT CANNOT.** Gate 6 (`phase_types.py:2511`) is nested inside `if connection.mcp_server_url:`, so `tool_grants` is enforced for MCP rows **only** — a Slack, Jira or SMTP send consults no grant at all, while `descriptors.py`'s docblock claims the opposite in our own source. It is survivable today *only because* of the 1:1 lock SC#1 removes: one action per connection means "grant the connection" and "grant the action" coincide. ⭐ **ORDERING IS BINDING — this gate closes BEFORE or WITH the unlock, never after.** A connection that can hold many actions with no per-tool gate is every one of them armed by the row merely existing, which is the standing rule (*never an outbound capability before the approval model exists*) read from the other side.
  5. Every outbound call made through a connection appears in the audit ledger naming service, tool, actor and outcome (GRANT-05).

**Plans**: 5 plans in 5 waves

Plans:
- [ ] 213-01-PLAN.md - migration 128: default_approval_posture + shape-aware backfill + column-level GRANT SELECT, Pydantic/service posture models, widened sanitizer, and frontend wire types
- [ ] 213-02-PLAN.md - connectors/grants.py leaf extraction (D-213-00), Gate 5.5 in _exec_external_action across MCP and capability shapes (BUG-260827-02), actionable refusals, and unified audit receipts
- [ ] 213-03-PLAN.md - static_descriptors_for_capability unlock (SEED-214 mechanism), grantsVocabulary.ts, ToolGrantsSection.tsx 3-state control with 10 sketch invariants, and clamp(480px, 38%, 640px) panel track
- [ ] 213-04-PLAN.md - approval moment: harness pause on 'ask' posture, PendingAskCard and WorkflowRunPage flow with formatted arguments, 'Always allow' button, and audit logs
- [ ] 213-05-PLAN.md - cross-plan integration test mocking neither side (S-3), count-gate pinning in vitest-count-gate.cjs (GATE-1), G-5 hot-file ledger sync, and verification gauntlet

**UI hint**: yes
**Flags**: ⭐ **HARD PREREQUISITE for Phase 216** — the standing rule is *never an outbound capability in `_TOOL_REGISTRY` before the approval model exists*, and this phase is that model. **Extend, do not rebuild:** 206.2 already shipped `tool_grants` at the per-tool grain, which the competitor study calls the industry's most advanced permission model with the instruction *"do not regress it"*; Phase 085's `ask_user` is the existing pause/ask primitive; Phase 189/190's armed checkpoint (D-19) and audit receipts are the existing run-time gate. **G-2 sketch owed** — the grant list and the approval moment are both "feels like" surfaces; the Rovo detail screen (7 tools, reads and writes in one list, a connector-level `Needs approval` default) is the bar. ⚠ **G-1 risk**: this is the **second consecutive phase** on `ConnectionFormPanel.tsx` / `ConnectionsTab.tsx`. If Phase 212 did not take the seam, this phase must — surface it at discuss-phase rather than paying the branch twice. **Threat model REQUIRED** — this is the trust boundary of the whole milestone. ⚠ **THE 400px SPLIT PANEL IS THE WRONG SHAPE FOR THIS PHASE AND THE OPERATOR SAID SO WHILE DRIVING 212** — *"should we open each one in a pop up window instead of being on the right and splitting the screen which is already narrow to 2 halves"*. `D-27` locked the push/split panel for a **3-5 field form**, on a real reason (*a dialog scrims away the list you need when a check fails*); a **44-row grant list with a tri-state posture per row plus a connection-level default** is a different object, and neither 400px nor a modal holds it — Rovo's own answer is a full detail SCREEN. ⚠ Constraint the sketch must respect: **the app has no URL router** (`SEED-185`), so a detail route is not free. The G-2 sketch settles this; do NOT patch 212's panel in the meantime. ⚠ **Two gates, and they must differ**: grant-time (per-tool, human, once) is where the industry approves a read; run-time (D-19, armed) is ours and is stricter than any engine studied. **The run-time gate may key on direction; the grant-time gate must NOT**, because a read is exactly where prompt injection enters. ⚠ **Direction must not be built on `readOnlyHint`** — measured absent on the one server we can reach; fail closed on absence, exactly as the spec specifies. **SC#10** (a pause suspends a live run — streaming and UI state). Migration likely (default posture on the connection).

#### Phase 214: A Step Names Its Service and Its Action

**Goal**: An author adds an external step by picking a service and then a named action; that step's required arguments arrive from whatever launched the run; publish refuses a step nothing can satisfy; and every surface a run appears on says which service and which action — including when it fails.
**Depends on**: Phase 211 (the service model) and Phase 213 (STEP-06 needs *granted* tools as its vocabulary).
**Requirements**: STEP-01, STEP-02, STEP-03, STEP-04, STEP-05, STEP-06
**Success Criteria** (what must be TRUE):

  1. An author adds an external step by picking a **service** and then a **named action** — no server URL and no hand-written JSON argument object anywhere in the flow (STEP-01).
  2. An author fills a step's required arguments and a run supplies them **from every launch path** — a `send_email` step actually receives its recipient, subject and body, whether launched from the library, from a thread, or on a schedule (STEP-02 — closes ⛔ `BUG-260826-01`).
  3. Publishing a workflow whose external step has a required argument nothing can supply is **refused**, naming the step and the missing argument (STEP-03 — closes `BUG-260826-02`).
  4. A run's spine and run surfaces show the service's mark and the action's real name — and when a step fails, the panel shows **that step's own failure reason**, not a generic one (STEP-04, STEP-05 — closes `BUG-260826-05`).
  5. The describe-a-workflow door is handed the author's connected services and granted tools as its vocabulary, and a named-but-absent service produces a **stated refusal with a next action** (*"Slack is not connected"*) rather than an invented step that validates and fails at 03:00 (STEP-06).

**Plans**: TBD

**UI hint**: yes
**Flags**: Closes three folded bugs including ⛔ **`BUG-260826-01`** — the milestone's blocking defect on the shipped surface. **Sequenced BEFORE chat deliberately**: the canvas already carries D-19's armed checkpoint and the egress guard, so the model and the grants are proven on the governed surface before outbound reaches chat, which carries neither. **G-2 sketch owed** (step picker + the canvas and run node faces; the `…workflow-edit.webp` **xyOps** reference is the canvas bar — named action nodes, per-node glyphs, typed edges — and the `sketch-findings-agentic-rag` skill auto-loads; read `references/icon-convention.md` §4 before drawing any canvas mark). **G-5**: `ConnectionPicker.tsx` (5/3/651 — fires at threshold), `ExternalActionSection.tsx` (4/3/498 — fires at threshold), `phase_types.py` (fires), plus `McpToolPicker.tsx` (2/2/570) which ⚠ **is named inside Phase 206's ledger section but has no row of its own**. Refactor recommendation owed first at discuss-phase. **Threat model REQUIRED** (the publish gate is a safety gate, and argument provenance decides what a step is allowed to send). ⚠ **A launch decision is owed on `visual_workflow_canvas`, whose cold default is `off`** — Phase 209's 16/16 browser drive ran against a flag-flipped database, so a criterion here that renders only behind the flag is not shipped. ⚠ **`SEED-206` is exactly SC#4's second half** — 209's node face never reached the run surface. **SC#10.** ⚠ **`{{prior_run.*}}` misses `llm_emit`** (carried from v3.8) — if STEP-02's argument plumbing reuses that resolver, the same gap applies. **Existing precedent to reuse, not reinvent**: `DESCRIBE_REFUSAL` in `doorVocabulary.ts` (Phase 199) already knows how to refuse in a governed vocabulary — ⚠ *a refusal is only honest if it names the next action*.

#### Phase 215: BYO OAuth

**Goal**: A customer registers their **own** OAuth application, connects a first-party service with it on any deployment including self-hosted and on-prem, and the connection keeps working afterwards without them reconnecting — or says plainly that it cannot.
**Depends on**: Phase 211 (**CONN-08** — until mig 126's `CHECK` is gone the database refuses an OAuth row) and Phase 212 (OAuth is a third door in the same Add menu).
**Requirements**: OAUTH-01, OAUTH-02, OAUTH-03
**Success Criteria** (what must be TRUE):

  1. A user pastes a client id and secret **they registered themselves**, completes an authorization-code consent, and lands back on a connected service — on a self-hosted install as readily as on cloud (OAUTH-01).
  2. A connection whose access token has expired keeps working on the next call, with nobody reconnecting anything (OAUTH-02).
  3. A connection whose grant was revoked, or cannot be refreshed, says so **as a connection state in plain words** — never as a tool error in the middle of a run (OAUTH-02).
  4. Client secrets and refresh tokens are unreadable at rest and to any database role that does not need them — verified the same way migration 118 verified `secret_ciphertext` (OAUTH-03).

**Plans**: TBD

**UI hint**: yes
**Flags**: **D-v3.9-01 binds this phase**: BYO first, we-own-the-app later. ⚠ **G-2 sketch owed, but `screenshots/` is NOT its bar** — Claude.ai's 2-click Connect exists because *Anthropic* registered the app; our redirect URI would point at our cloud and exclude every self-hosted install. **Do not let a sketch promise it.** The honest comparison is n8n / Windmill's per-operator registration (8+ steps for Google), and the design job is making that *tolerable and legible*, not pretending it is two clicks. **Threat model MANDATORY** — ⚠ **this is exactly the defect class migration 118 closed for `secret_ciphertext`; do not re-introduce it by copying an RLS shape from a table with no secret column**, and remember the measured trap that mig 118 granted SELECT *column by column*, so a NEW column is unreadable by default and the failure looks like an outage. **Migration** for access token + refresh token + expiry + scope set + provider account identity — ⚠ the `enc:v1:` envelope generalises, **the column shape does not**; this is the migration `SEED-146` warns about, so commit it once. **Refresh must be claim-based**: `WORKER_COUNT=2` with no leader, so two workers racing a rotation invalidates each other's token. **New public callback route + `state` CSRF param + per-org binding** — ⚠ the frontend has no URL router (`SEED-185`), which is a real cost to size at discuss-phase. **Deployment-artifact parity in the same commit** (the redirect URI is a new env var → `deploy/onebox.env.example`, `docs/OPERATOR.md`, `scripts/check-deploy-drift.sh`). ⚠ **MCP defers OAuth, it does not remove it** — a remote MCP server fronting Google holds a live grant we do not control, which is a credential concentration our egress guard does not answer.

#### Phase 216: Connections in Chat, and One File In by Hand

**Goal**: A connected service is a platform asset a person uses **by name in a thread** — the agent chooses which granted tool to call, the call renders as itself, a fresh connection offers a way in, and a person can pull one named file from a connected source into the thread by hand.
**Depends on**: ⭐ **Phase 213 (HARD)** — the approval model. Also Phase 211, Phase 212, and Phase 215 (so ATTACH-01 can be driven against a real first-party source rather than only an MCP one).
**Requirements**: CHAT-05, CHAT-06, CHAT-07, CAT-04, ATTACH-01
**Success Criteria** (what must be TRUE):

  1. A user adds a connected service to a thread **by name**, asks for something in their own words, and the agent chooses one of that service's **granted** tools and calls it (CHAT-05).
  2. A user sees which connected services are active in the current thread and removes one **without starting a new thread** (CHAT-06).
  3. A tool call made from chat renders with the **service's own mark and the tool's real name**, never as a generic external action (CHAT-07).
  4. A freshly connected service offers starter prompts, and clicking one starts a thread that actually runs against that connection (CAT-04).
  5. A user picks **one named file** from a connected source and attaches it to the thread or ingests it — a deliberate act with a visible result, never a background sync (ATTACH-01).

**Plans**: TBD

**UI hint**: yes
**Flags**: ⭐ **Gated behind Phase 213.** ⚠ **CAT-04 lives here, not in the catalog phase, and the reason is honesty**: a starter prompt is only truthful once the agent can act on it — chips shipped before the chat surface are suggestions that fail. **G-2 sketch owed** (service chip in the thread, starter prompts, the attach picker). **G-5 ×4, and two of them read *extraction due***: `ChatLayout.tsx` (40/21/815 — ⚠ fires at **21 phases** and has been **absent from the ledger for its entire life**), `MessageInput.tsx` (25/13/478), `ToolCallPanel.tsx` (47/19/995 — *extraction due*), `MessageItem.tsx` (57/29/856 — *extraction due*). Refactor recommendation owed first. ⚠ **The workspace panel is a CROSS-SURFACE shell mounted by `ChatLayout`** — a change here lands in chat first, so UAT on a workflow surface alone will miss it. **Threat model REQUIRED — and the named threat is PROMPT INJECTION**: every read lands untrusted external text in a model's context, and this tree has never faced that class because until 206.2 every connector was a write. ⚠ *No vendor in the competitor study documents a defence; treat it as unsolved, design for it rather than discovering it.* **SC#10 — the FULL 8-row native roster + OpenRouter**, plus multi-tool, parallel-thread and long-message rows; derive the roster from `MODEL_CAPABILITIES`, never re-type it; blocked rows recorded ⛔ with a reason. **ATTACH-01 is mode C and is deliberately human-initiated** — it dodges ACL mirroring, deletion propagation and sync loops by construction. ⚠ **The re-open trigger for `SEED-209/210/211/212` is "the first AUTOMATIC or BACKGROUND sync from a connected source"** — if any plan in this phase reaches for a poll, a watcher or a scheduled pull, **it has left this milestone** and the Connected Knowledge deferral applies.

### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 210. Ground Truth — Operability & Failure Honesty | 3/3 | ✅ Complete (1/5 SC driven; 4 owed — see 210-VERIFICATION.md) | 2026-08-26 |
| 211. The Connection Is a Service, Not a Verb | 5/5 | ✅ Complete (mig 127 applied; UAT rows + schema regen owed — see 211-05-SUMMARY.md) | 2026-08-27 |
| 212. The Catalog and Its Doors | 7/7 | ✅ **CLOSED** — all 5 driven defects fixed, operator-confirmed. ⛔ Notion blocked on 215 (OAuth-only endpoint). Owed: `/code-review ultra`, cloud SC#3 | 2026-08-27 |
| 213. Per-Tool Grants and the Approval Moment | 0/? | Not started | - |
| 214. A Step Names Its Service and Its Action | 0/? | Not started | - |
| 215. BYO OAuth | 0/? | Not started | - |
| 216. Connections in Chat, and One File In by Hand | 0/? | Not started | - |

**Coverage:** **32 / 32 requirements mapped, each to exactly one phase.** No orphans, no duplicates.
Counts by phase: 210 → 4 · 211 → 5 · 212 → 6 · 213 → 5 · 214 → 6 · 215 → 3 · 216 → 5.

**Guardrails firing (v3.9):**

- **G-2 sketch-first** on **212** (catalog), **213** (grant list + approval moment), **214** (step
  picker + canvas/run node faces), **215** (the connect moment — ⚠ **with a different bar**), **216**
  (chat service chip, starter prompts, attach picker). `screenshots/` is the acceptance bar for the
  **catalog IA, the per-tool grant grain and the starter chips**; the `…workflow-edit.webp` xyOps
  file is the canvas bar. ⚠ **Not for the Connect moment** — those shots are a vendor-owned-OAuth
  product and D-v3.9-01 declines that. The `sketch-findings-agentic-rag` skill auto-loads on 212-216.
  ⚠ **A sketch must RENDER the shipped component, not hand-write its own CSS** (`SEED-155`) — Stitch
  first for language, then a sketch that renders real components; never collapse the two.
- **G-5 hot files (re-derive from git at discuss-phase — do NOT trust a ledger cell).** 210:
  `api/admin.py`. 211: `phase_types.py`, `grounding.py`, `models/connector.py`. 212 + 213:
  `ConnectionsTab.tsx`, `ConnectionFormPanel.tsx`, `connectionsCopy.ts`, `connectionFormCopy.ts`
  (**all four fire**). 214: `ConnectionPicker.tsx`, `ExternalActionSection.tsx`, `phase_types.py`,
  `McpToolPicker.tsx`. 216: `ChatLayout.tsx`, `MessageInput.tsx`, `ToolCallPanel.tsx`,
  `MessageItem.tsx`. **Each of those phases opens discuss-phase with a refactor recommendation, not
  with the feature** — 211, 212 and 214 plausibly discharge theirs *by construction*, but that has to
  be argued in the phase's own CONTEXT, never assumed. ⚠ **`api.ts` was measured the hottest file in
  the repo while having no ledger row at all**; `ChatLayout.tsx` and `admin.py` are in the same
  condition here.
- **G-1 phase chain cap**: **213 is the second consecutive phase on `ConnectionFormPanel.tsx` /
  `ConnectionsTab.tsx`.** If a third lands on them, a refactor phase comes first.
- **G-7 gap-closure round cap**: run `node scripts/check-gap-closure-rounds.cjs <phase>` at every
  `gaps_found` — do not eyeball the round count. ⚠ **A closure round may never introduce a new
  user-facing capability**; on this milestone the temptation will be "the catalog has no X".
- **SC#10 (cross-provider mandate):** **216** owes the full 8-row native roster + OpenRouter with
  multi-tool / parallel-thread / long-message rows. **213** and **214** owe it because both suspend
  or resume a live run. **210** owes it on the **embedding-provider** roster (a different set —
  say so in VALIDATION.md rather than borrowing the chat table). Rows are authored under
  `VALIDATION.md`, never as PLAN.md tasks; blocked rows are ⛔ with a reason, **never omitted**.
- **Threat models:** **REQUIRED** on 212 (custom-URL door → SSRF/egress), 213 (the milestone's trust
  boundary), 214 (publish gate + argument provenance), **215 (mandatory — the mig-118 defect class)**
  and 216 (**prompt injection on reads — the class this tree has never faced**). 211 light (relaxing
  a `CHECK` removes a database-level guarantee; say what replaces it). 210 none expected.
- **Migrations:** head is **126**. Expected: **127** (211 — drop mig 126's `CHECK`, service
  identity), then 213 (posture) and 215 (OAuth token/refresh/expiry/scope/account identity) in the
  order they land. **Paste into the Supabase SQL editor — never `db push` / `db reset`** — then
  `bash scripts/regenerate-full-schema.sh`. ⚠ **Filenames must match `<digits>_name.sql`**; letter
  suffixes are silently skipped. ⚠ **Adding a column to `connector_connections` breaks every read of
  it** until it is granted — mig 118 granted SELECT column-by-column, and the failure looks like an
  outage on a pre-existing row.
- **Deployment-artifact parity (same-commit rule):** 215's redirect URI and any new
  `app_settings` seed row update `deploy/onebox.env.example`, `docs/OPERATOR.md` and
  `docker-compose.prod.yml` in the **same commit**; `scripts/check-deploy-drift.sh` enforces it.
- **Red lines:** **D-14** — no new harness executor; `external_action` already takes two shapes
  through one executor and a first-party read is a third shape on the same one. **D-v2.5-01** — no
  blocking I/O in an async handler (`mcp_client.py:220` is the standing violation, fixed in 212).
  **D-v2.5-03** — Realtime is a hint; reconcile via fetch on reconnect. **No arbitrary-code /
  community-node connectors, ever** — excluded by construction, and Gumloop's AI-generated node is
  the most seductive wrong answer in the study.
- **Reported-bugs mandate:** nine reports are folded (table above). At each `/gsd:discuss-phase`,
  re-list open `surface: Agentic-RAG` reports and write the routing **back into each report's
  frontmatter** — ⚠ **`status:` frontmatter IS the index; prose in the body is invisible to the
  scan.** ⚠ Also carried and still **unrouted**: `BUG-260818-01/-02/-03` (Resume replays the prompt ·
  Resume drops the model · the Continue that already exists and did not render). **Triage them
  together** — a user cannot tell Resume from Continue, and fixing one leaves the moment still lying.
- **Seeds register sweep:** 12 seeds are folded (`SEED-202` `204` `205` `206` `207` `208` + `142`
  `144` `145` `146` `177` + `213`). **A seed is answered by editing the seed** — flip `status` and
  record where it went, or it is re-proposed forever. ⚠ `SEED-209/210/211/212` are deferred with a
  **binding re-open trigger: the first automatic or background sync from a connected source.**
- **Verification-documentation debt is the standing failure mode here.** ⚠ **Seven of twelve v3.8
  phases had no `VERIFICATION.md` and `REQUIREMENTS.md` was stale from day one — the SECOND
  consecutive milestone to close that way**, and v3.6's own retrospective already read *"the
  paperwork was the problem, never the code."* Every phase in this milestone writes its
  `VERIFICATION.md` at its own close, and the traceability table below is updated as each phase
  ships — not at the audit.
- **Ceremony budget.** v3.7 spent **147 plans across 17 phases**; the operator's recorded direction
  is **fewer, larger, well-scoped phases**, because ceremony scales with PLAN COUNT rather than with
  risk. Seven phases here. **A phase that decomposes into 15 plans has been mis-scoped, not
  discovered to be large** — say so and re-scope rather than proceeding.

---

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
