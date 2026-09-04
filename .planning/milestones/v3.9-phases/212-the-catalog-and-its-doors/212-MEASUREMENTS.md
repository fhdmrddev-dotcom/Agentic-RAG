---
type: measurement-pack
phase: 212
phase_name: "The Catalog and Its Doors"
builder: gemini
reviewer: claude
captured_by: claude
captured_at: 2026-08-27
tree_state: UNTOUCHED — clean working tree at `43c95968`, captured before any Phase 212 work began
---

# Phase 212 — measurement pack

**What this is.** `AGENTS.md §3.1` makes the reviewer supply CLAUDE.md's three mandatory
discuss-phase cross-checks — reported bugs, the seeds sweep, and the G-5 hot-file scan — as
**measurements, on the bus, before `discuss-phase` opens**. Phase 212 is Gemini-built under
`BUS-002`; the builder owns `discuss-phase` and every decision in it.

⚠ **There are no recommendations in this file, deliberately.** Every line below is a fact with the
command that produced it. If you want a judgement, ask the operator — a measurement pack carrying a
suggested fix is a design direction wearing a lab coat.

⚠ **Captured on the UNTOUCHED tree.** `git status --short` was empty; HEAD was
`43c95968 fix(210): the circuit-breaker sentences could never render (ultrareview)` on `develop`.

⚠ **Every figure below was RE-DERIVED, not copied from `210-MEASUREMENTS.md`,
`211-MEASUREMENTS.md`, the ROADMAP or the CLAUDE.md ledger.** Six ledger rows and four ROADMAP
triples in this phase's blast radius were measured STALE — §2.1.

---

## 1 · Gate baselines

| Gate | Command | Baseline |
|---|---|---|
| Frontend typecheck | `npx tsc --noEmit -p tsconfig.app.json` (from `frontend/`) | **34 errors** |
| Frontend count gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (from repo root) | **OK** · 116/116 pinned · **total 5829** · pinned 5211 · **failed 0** |
| Backend unit suite | `./venv/Scripts/python.exe -m pytest tests/unit -q` (from `backend/`) | **68 failed · 2788 passed** · 2 xfailed · 2 xpassed · 72.75s |
| CLAUDE.md size | `node scripts/check-claude-md-size.cjs` | **85,424 chars · 56.9% of limit · OK** (headroom 64,576) |

⚠ **`tsc --noEmit` WITHOUT `-p tsconfig.app.json` checks ZERO files.** Use the flag.

⚠ **34 is a BASELINE, not a target.** It matches the figure recorded at Phase 209 close, Phase 210
open and Phase 211 open. A Phase 212 plan is clean if it introduces **no error in a file it
touched**, not if the total is 0.

### 1.1 Pre-existing `tsc` errors inside 212's likely blast radius

Four of the 34 sit in files this phase may touch, so they cannot read as caused:

```
src/pages/SettingsPage.tsx           2 errors
src/pages/SettingsPage.test.tsx      1 error
src/lib/api.test.ts                  1 error
```

Full per-file breakdown preserved at `<scratchpad>/tsc.txt` for the session that produced it;
re-derive rather than cite it.

### 1.2 The count gate GREW again — 114/114 → 116/116, and that is the gate WORKING

| | 210 / 211 packs (2026-08-26) | **measured 2026-08-27** |
|---|---|---|
| pinned files | 114/114 | **116/116** |
| grand total | 5793 | **5829** |
| pinned total | 5180 | **5211** |

Newly adopted since the 210/211 baseline, read from the gate's own `new` column:
`PromptVariableChips` (+3), `RunHero` (+18), `RunStepList` (+17), `WorkflowScheduleModal` (+3),
`automationFacts` (+11), `nodeEffectBanner` (+8), `toolReadOnlyMap` (+7); `WorkflowSoul.test.tsx`
8 → 18 (+10). The gate's contract is *no per-file DECREASE* and *zero failing*, **never a fixed
grand total** — a plan that reads a bigger figure than this paragraph quotes has read the correct
current one. Verdict line, verbatim:

```
  total                                      5211    5829    +618
  total 5829  ·  failed 0  ·  pinned total 5211
count gate OK — 116/116 pinned files present, no per-file decrease, 0 failing.
```

### 1.3 The four PINNED suites on this phase's own surface — per-file, so a decrease is visible

`npx vitest run src/components/settings/__tests__/` → **4 files passed · 281 tests passed · 0
failed.** Per file, each run alone:

| Pinned entry | tests |
|---|---|
| `src/components/settings/__tests__/ConnectionsTab.test.tsx` | **77** |
| `src/components/settings/__tests__/ConnectionFormPanel.test.tsx` | **142** |
| `src/components/settings/__tests__/connectionMark.test.tsx` | **41** |
| `src/components/settings/__tests__/connectionVerbFence.test.ts` | **21** |

⚠ **`src/components/settings/` is pinned FILE-LEVEL only — there is no bare-directory entry.**
Measured: `grep -oE '"src/[^"]+"' scripts/vitest-count-gate.cjs | sort -u | grep settings` returns
exactly the four rows above and nothing else. Consequences, stated as facts:

- A **new** test file created under `src/components/settings/` is **not gated** until it is added to
  `TARGETS` by hand.
- Three test files that already exist there are **not pinned at all**:
  `EngineHealthCard.test.tsx`, `JudgeModelPicker.test.tsx`, `ModelDefaultPreference.test.tsx`.
- `frontend/src/pages/SettingsPage.test.tsx` exists on disk and is **not** a pinned entry.
- `src/lib/api/` has exactly one pinned entry across all twelve domain modules —
  `src/lib/apiRunFields.fences.test.ts`. **`src/lib/api/connectors.ts` has no pinned test.**

### 1.4 The backend rot set — per file, so a pre-existing failure cannot read as one you caused

The rot set is **68**, unchanged in count and in distribution from the 210 pack; the PASS count grew
`2680 → 2788`. STATE.md records `68 failed / 2778 passed` at `8487ec99`; HEAD `43c95968` measures
**2788**, so re-derive rather than inherit.

| Failures | File | |
|---|---|---|
| **15** | `test_retrieval_service.py` | RAG-09's home file (Phase 210) |
| **12** | `test_sql_service.py` | |
| 6 | `test_explorer_agent.py` | |
| 5 | `test_multimodal_query.py` | |
| 4 | `test_111_1_reembed_kickoff.py` | |
| 3 | `test_sandbox_service.py` · `test_lifespan.py` · `test_db_runs.py` | 3 each |
| 2 | `test_module7_tools.py` · `test_extraction_service.py` · `test_cross_worker_cancellation.py` | 2 each |
| **1** | **`test_071_1_threadpool_sweep.py`** | ⚠ see §6.2 — the D-v2.5-01 guard file |
| 1 | `test_streaming_reliability.py` · `test_published_workflow_ownership.py` · `test_phase56_iteration_start.py` · `test_get_model_capability_inference.py` · `test_forced_emit.py` · `test_email_ingestion.py` · `test_200_1_phase_output_shape.py` · `test_182_validate.py` · `test_075_4_unknown_provider_error.py` · `test_061_consumer.py` | 1 each |

⚠ **Every connector / MCP test file is GREEN at HEAD.** `grep -icE "connector|mcp_client"` over the
`FAILED` lines returns **0**. The six files —
`test_190_connector_check.py`, `test_190_connector_source_fence.py`, `test_190_connectors_api.py`,
`test_211_closed_set_agreement.py`, `test_211_static_descriptors.py`, `test_mcp_connector_client.py`
— carry **no** pre-existing failures, so a red in any of them during Phase 212 is caused, not
inherited.

Full run output preserved at `<scratchpad>/backend-baseline.txt`.

---

## 2 · G-5 hot-file scan — RE-DERIVED FROM GIT, not read from the ledger

Recipe used (CLAUDE.md), with six-digit dated quick-task buckets subtracted:

```bash
git log --oneline -- <file> | wc -l                                     # commits
git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' \
  | sed -E 's/-.*//' | grep -E '^[0-9]+(\.[0-9]+)?$' \
  | grep -vE '^[0-9]{6}$' | sort -u | wc -l                             # phases
wc -l <file>                                                            # lines
```

Ledger-row presence checked with a **fixed-string** match on the row format
``| [`path`](docs/HOT-FILE-LEDGER.md`` — the 210 pack records that a backtick inside double quotes
becomes command substitution and produces a false "no row" reading.

| File | commits / phases / lines | G-5 | Row in CLAUDE.md? | Section in `docs/HOT-FILE-LEDGER.md`? |
|---|---|---|---|---|
| `frontend/src/components/settings/ConnectionsTab.tsx` | **9 / 4 / 1218** | **FIRES** | yes | yes |
| `frontend/src/components/settings/ConnectionFormPanel.tsx` | **7 / 4 / 1889** | **FIRES** | yes | yes |
| `frontend/src/components/settings/connectionsCopy.ts` | **6 / 5 / 571** | **FIRES** | yes | yes |
| `frontend/src/components/settings/connectionFormCopy.ts` | **5 / 4 / 966** | **FIRES** | yes | yes |
| `frontend/src/pages/SettingsPage.tsx` | **34 / 21 / 1426** | **FIRES** | ⚠ **NO** | named only, under a staleness marker |
| `frontend/src/lib/api.ts` | **184 / 107 / 414** | **FIRES** | yes | yes |
| `frontend/src/types/index.ts` | 70 / 56 / 1154 | **FIRES** | yes | yes |
| `backend/app/services/connector_service.py` | 7 / 3 / 1149 | **FIRES — AT THRESHOLD** | yes | yes |
| `backend/app/api/connectors.py` | 6 / 3 / 734 | **FIRES — AT THRESHOLD** | yes | yes |
| `backend/app/models/connector.py` | 5 / 3 / 450 | **FIRES — AT THRESHOLD** | yes | yes |
| `backend/app/services/mcp_client.py` | 3 / 3 / 400 | **FIRES — AT THRESHOLD** | yes | yes |
| `frontend/src/components/settings/connectionMark.tsx` | 2 / 2 / 231 | no (2 phases) | yes | yes |
| `frontend/src/components/settings/connectionRefusalCopy.ts` | 1 / 1 / 567 | no (1 phase) | ⚠ **NO** | ⚠ **NO** |
| `frontend/src/lib/api/connectors.ts` | 1 / 1 / 282 | no (1 phase) | ⚠ **NO** | ⚠ **NO** |
| `backend/app/services/connectors/descriptors.py` | 1 / 1 / 181 | no (1 phase) | ⚠ **NO** | ⚠ **NO** |
| `backend/app/services/connectors/protocol.py` | 1 / 1 / 226 | no (1 phase) | ⚠ **NO** | ⚠ **NO** |
| `backend/app/services/connectors/registry.py` | 1 / 1 / 96 | no (1 phase) | ⚠ **NO** | ⚠ **NO** |

**Eleven files in this phase's blast radius fire G-5.**

⚠ **`frontend/src/pages/SettingsPage.tsx` fires at 21 phases / 34 commits and has NO ledger row —
and its absence is a RECORDED DECISION whose re-open trigger is this phase.** CLAUDE.md (the
paragraph beginning *"ELEVEN MORE ROWS WERE ADDED ON 2026-08-18"*) says verbatim:

> ⚠ **Two files D-22 also named — `frontend/src/pages/SettingsPage.tsx` and
> `frontend/src/components/settings/ModelPillRow.tsx` — stay named-only BY DECISION** … the re-open
> trigger is *the next phase whose `files_modified` names either of them*.

`docs/HOT-FILE-LEDGER.md:2405` repeats it: *"The re-open trigger already recorded stands: the next
phase whose `files_modified` names either of them owes it a row and a section."* Sibling triple, for
the same trigger: `frontend/src/components/settings/ModelPillRow.tsx` = **4 / 3 / 141** (also fires,
also rowless).

⚠ **Five files in this blast radius have neither a CLAUDE.md row nor a detail section.** Four are
one-phase-young; `connectionRefusalCopy.ts` is 567 lines at one phase.

### 2.1 SIX ledger rows and FOUR ROADMAP triples in this blast radius are STALE

Every one understates. Rows quoted verbatim from `CLAUDE.md` lines 535, 596–600.

| File | CLAUDE.md row says | ROADMAP §Phase 212 flags say | **measured 2026-08-27** |
|---|---|---|---|
| `ConnectionsTab.tsx` | `8 / 3 / 1223` | `(8/3/1223)` | **9 / 4 / 1218** |
| `ConnectionFormPanel.tsx` | `5 / 3 / 1758` | `(5/3/1758 — crossed the threshold…)` | **7 / 4 / 1889** |
| `connectionsCopy.ts` | `4 / 3 / 541` | `(4/3/541)` | **6 / 5 / 571** |
| `connectionFormCopy.ts` | `4 / 3 / 759` | `(4/3/759)` | **5 / 4 / 966** |
| `connectionMark.tsx` | `1 / 1 / 232` | — | **2 / 2 / 231** |
| `frontend/src/lib/api.ts` | `182 / 105 / 412` | — | **184 / 107 / 414** |

The four backend connector rows added at Phase 211 (`connector.py 5/3/450`, `mcp_client.py 3/3/400`,
`api/connectors.py 6/3/734`, `connector_service.py 7/3/1149`) **re-derive EXACTLY** and are current.

⚠ The four ROADMAP figures and the four CLAUDE.md rows agree with **each other** and disagree with
**git**. CLAUDE.md's own note applies: *"A row that is present and WRONG answers the auditor with
`satisfied` and stops the audit, which is worse than an absent row."*

⚠ Two rows crossed a G-5 threshold since they were written: `connectionsCopy.ts` 3 → **5** phases,
and both `ConnectionsTab.tsx` and `ConnectionFormPanel.tsx` 3 → **4**. Their dispositions
(`honoured by construction (206.1)`, `no seam proposed`) were written against the smaller numbers.

---

## 3 · Reported bugs whose `affected_areas` touch this phase

Swept: every `.planning/reported-bugs/BUG-*.md` with `status:` containing `open` **and**
`surface: Agentic-RAG` — **20 reports**. Exactly **one** has `affected_areas` overlapping Phase
212's surface. Frontmatter quoted VERBATIM.

### `BUG-260810-01-cloud-settings-connections-no-add-button.md`

```yaml
id: BUG-260810-01
title: Settings → Connections shows no "Add connection" button on cloud (local is fine)
reported: 2026-08-10
surface: Agentic-RAG
severity: medium
status: open
affected_areas: [settings/connections, deployment/cloud-parity, admin/feature-visibility]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-144, SEED-145, SEED-146]
re_open_trigger: null
reproduces_on:
  branch: production
  commit: 5d5ea200
  date: 2026-08-10
```

⚠ **The ROADMAP routes this bug to 212; the report's own frontmatter does not.**
`.planning/ROADMAP.md:104` reads
``| `BUG-260810-01` — cloud Connections tab has no Add button | CAT-05 | **212** |``, while the
report carries `status: open`, `folded_into: null`, `re_open_trigger: null`. CLAUDE.md's rule is
that **`status:` frontmatter IS the index** — prose (or a ROADMAP table) saying otherwise is
invisible to the routing scan. The frontmatter write (`status` + `folded_into: 212`) is the
builder's, at `discuss-phase`; **it has not been done**, and I deliberately did not do it.

### The three `backend/connectors` reports that do NOT overlap

`BUG-260826-01` (⛔ blocking), `BUG-260826-02`, `BUG-260826-05` all name `backend/connectors` in
`affected_areas`. All three are `status: open` with **`folded_into: null`** in their own
frontmatter; `.planning/ROADMAP.md:97-101` routes all three to **214**. (The 211 pack listed them as
*"open (folded: 214)"* — that reflects the ROADMAP table, not the frontmatter.) Their subject matter
is `external_action` step arguments, publish-gauntlet argument satisfiability, and failure-reason
surfacing — none names a settings, catalog or connections-list surface.

### The 16 other open Agentic-RAG reports

None has `affected_areas` overlapping `settings/connections`, `frontend/settings`,
`deployment/cloud-parity`, `admin/feature-visibility`, `backend/connectors` or `backend/api`.
For the record they are: `BUG-260609-02`, `BUG-260610-01`, `BUG-260718-02`, `BUG-260718-03`,
`BUG-260722-02`, `BUG-260730-02`, `BUG-260809-01`, `BUG-260815-06`, `BUG-260816-03`,
`BUG-260818-01`, `BUG-260818-02`, `BUG-260818-03`, `BUG-260823-01`, `BUG-260823-02`,
`BUG-260823-03`, `BUG-260823-04`.

---

## 4 · Seeds register sweep

Register size: **214** seeds (`ls .planning/seeds/SEED-*.md | wc -l`).

⚠ **107 of the 214 carry NO `trigger_when` key in frontmatter at all — exactly half the register.**
Derived by parsing the frontmatter block of every file and counting `^trigger_when`. CLAUDE.md's
MANDATORY sweep instruction is *"Read each `trigger_when`"*, so half the register cannot be swept
that way. Among the rowless half are **SEED-142, SEED-062, SEED-099 and the entire
connected-knowledge block SEED-209 / 210 / 211 / 212 / 213** — for which `.planning/ROADMAP.md:266`
asserts a re-open trigger in prose (*"the first AUTOMATIC or BACKGROUND sync from a connected
source"*) that exists in **no** frontmatter field.

### 4.1 Seeds whose `trigger_when` NAMES this phase — quoted verbatim

**`SEED-207-the-three-verbs-become-one-shape-among-many-not-the-organizing-axis.md`** — ⚠ **still
`status: planted` at HEAD, after Phase 211 shipped to discharge it.** ROADMAP §Phase 211 flags it
``⭐ **PREREQUISITE (`SEED-207`)**``; STATE.md records 211 closed 2026-08-27, 5/5 plans, migration
127 applied.

```yaml
seed_id: SEED-207
title: "The three fixed actions (send_email / create_ticket / post_message) must stop being the ORGANIZING AXIS — every connection should present its own available tools instead. ⚠ But they must NOT be deleted: they are the only external path that works with no MCP server."
status: planted
priority: high
surface: Agentic-RAG
trigger_when: >
  When the Connections & Open Platform milestone is scoped. This is a PREREQUISITE for SEED-205's
  journey: as long as two models coexist, every downstream surface (node face, mark, filter, chat
  mention, catalog entry) must branch, and each new surface pays the branch again.
```

CLAUDE.md: *"A seed is answered by editing the seed… a seed that shipped but still reads `planted`
will be re-proposed forever."*

**`SEED-205-the-connection-journey-service-first-per-tool-grants-chat-and-canvas.md`**

```yaml
seed_id: SEED-205
title: "The connection JOURNEY, in the operator's own words: add a service → authenticate → see every tool it offers, read and write → grant each tool individually → then use it by NAME in chat, where the agent picks the tool, and as a SPECIFIC step on the canvas, never a generic one."
status: planted
priority: high
surface: Agentic-RAG
trigger_when: >
  Before the Connections & Open Platform milestone is SCOPED. This seed ANSWERS the question the
  orientation map and the competitor study both left open and both called the one the direction
  rests on — "how does a person pick a service and an action without knowing what MCP is?" The
  operator answered it unprompted: they pick the SERVICE, not the protocol. Scope the milestone
  against SEED-202 (what) + SEED-204 (how we reach it) + THIS (what the person actually does).
```

**`SEED-204-three-paths-to-any-external-application.md`**

```yaml
seed_id: SEED-204
title: "THREE paths to any external application — authenticate (OAuth), or MCP, or a plain API — and 'no OAuth exists today' is a GAP TO FILL, never a boundary. Plus: the capability belongs in CHAT, not only on the canvas, organised the way Claude.ai organises Connectors and Plugins."
status: planted
priority: high
surface: Agentic-RAG
trigger_when: >
  Before the Connections & Open Platform milestone is SCOPED. Read this together with SEED-202:
  that one is WHAT a workflow should be able to do, this one is HOW we reach anything at all,
  and WHERE the capability has to live.
```

Its `relates_to` names ``screenshots/ — Claude.ai Connectors + the Claude.ai Plugins directory, the
IA reference`` — the same artefact the ROADMAP names as 212's G-2 acceptance bar (§7.5).

**`SEED-208-the-describe-door-hands-the-generator-its-connections-as-vocabulary.md`**

```yaml
seed_id: SEED-208
status: planted
priority: high
surface: Agentic-RAG
trigger_when: >
  When the Connections & Open Platform milestone is scoped, OR when any work touches the describe
  door. ⚠ Sequence AFTER SEED-207: while two connection models coexist, this picker would have to
  render both shapes and would inherit the branch it exists to avoid.
```

**`SEED-144-provider-shaped-connections-oauth.md`** — `status: planted`, `priority: high`, title
*"Outbound connections should be PROVIDER-shaped, not ACTION-shaped — one Slack/Google/Jira account,
many capabilities, OAuth not pasted tokens"*. Two of its six `trigger_when` bullets, verbatim:

```yaml
trigger_when:
  - A SECOND capability is wanted for a provider already connected (e.g. Slack `upload_file` or `read_channel` alongside `post_message`) — the moment the operator would have to paste the same token twice
  - Any customer/partner asks "which apps do you integrate with?" — the answer's SHAPE is this seed
```

**`SEED-146-integration-capability-surface.md`** — `status: planted`, `priority: high`, title
*"The FULL integration capability surface — reads as well as writes, triggers, payloads, auth, ops
and catalog. The umbrella the other connector seeds hang from."* Two verbatim bullets:

```yaml
trigger_when:
  - Any "which apps do you integrate with?" conversation — the honest answer today is "three write verbs"
  - Before committing to the `connector_connections` table shape a second time — the migration cost compounds
```

It also carries an `answered_clauses:` block for **one** clause only:

```yaml
answered_clauses:
  - clause: "never add an outbound capability to the tool registry before the approval model exists"
    answered_by: "Phase 206.2 (206.2-04) — D-206.2-05"
    answered_on: 2026-08-25
    written_in_source: "frontend/src/components/workflows/McpToolPicker.tsx (module docblock + the grant handler)"
```

The catalog dimension is not among the answered clauses; the umbrella stays `planted`.

**`SEED-145-connections-are-platform-assets-not-workflow-assets.md`** — `status: planted`,
`priority: high`, title *"Connections are PLATFORM assets, not workflow assets — the agent should be
able to call Slack / email / Jira from inside a chat thread"*. Verbatim, the bullet that names a
settings surface:

```yaml
trigger_when:
  - Anyone asks "can the assistant email me this answer?" / "post this to the team channel?" / "open a ticket for this?" mid-conversation — the single most likely inbound request once connectors are visible in Settings
```

**`SEED-177-mcp-connections-connect-and-be-connected.md`** — `status: planted`, `priority: high`,
title *"MCP connections both ways — user-level "just connect" integrations usable in chat AND
workflows, plus the open-source leverage around them. Breadth is now asked for; re-open trigger #3
has fired."* Verbatim, all four bullets:

```yaml
trigger_when:
  - SEED-013 / Open Platform gets a phase number on .planning/ROADMAP.md (measured 2026-08-18 — 0 hits, still unscheduled)
  - Anyone proposes adding an MCP client to backend/app — retire the test_189_no_egress fence DELIBERATELY, never trip it by surprise
  - A user asks to pull from Slack / Jira / Monday / ClickUp / email / OneDrive
  - Anyone estimates connector work using the "OAuth is the hard part, once per vendor" framing — that framing is WRONG, see below
```

**`SEED-013-external-integrations-api-mcp.md`** — `status: planted`, `priority: high`, title
*"External Integrations — public API, MCP server, webhooks, service accounts"*. One verbatim bullet
fires on the milestone name:

```yaml
trigger_when:
  - Planning a milestone scoped to "API", "integration", "platform", "developer", "MCP", "webhook", "third-party", "embed", or "headless"
```

**`SEED-172-local-llm-providers-cannot-be-added-through-the-registry.md`** — `status: planted`,
`priority: medium`, title *"Local LLM providers (Ollama / LM Studio) cannot be added through the
Model Registry — the add-model endpoint validates against the SSRF discovery allowlist instead of
the routing roster"*:

```yaml
trigger_when: >
  Anyone needs to register, tune or time-out a local model (Ollama / LM Studio) through the UI;
  OR the add-model endpoint or the Model Registry provider picker is touched for any reason;
  OR someone needs an LLM call to run longer than 600 seconds.
```

Recorded because its subject is *an endpoint that validates a user-supplied URL against an SSRF
allowlist* — the same validator family §6 measures.

**`SEED-186-community-skill-repos-unreachable-by-one-predicate.md`** — `status: planted`,
`priority: high`. Its `trigger_when` opens `ALREADY TRUE`; its (b) arm names `/gsd:new-milestone`,
not this phase. Recorded because its title asserts *"we already speak the community skill format and
already solved catalog scale"* — the catalog-scale precedent this phase's SC#1 sits next to.

### 4.2 Seeds on this surface whose `trigger_when` field does not exist

**`SEED-142-two-way-connectors-read-pull-auto-ingest.md`** — `status: open`, `priority: high`, and
it has **no `trigger_when` field**. Verbatim:

```yaml
title: Connectors must be TWO-WAY — read/pull from external systems inside a workflow, and auto-ingest from a connected drive; today every planned connector is send-only
status: open
surface: Agentic-RAG
severity: info
priority: high
scope: Large — spans a platform milestone (Open Platform, SEED-013) AND a standing product rule (manual-upload-only ingestion)
affected_areas: [connectors, workflow-canvas, harness-engine, external-action-node, ingestion, documents, knowledge-base, credentials, egress-guard]
```

CLAUDE.md's ingestion rule names it by id as the dated re-open for manual-upload-only ingestion.

`SEED-209` / `SEED-210` / `SEED-211` / `SEED-212` / `SEED-213` — all `status: planted`, all
`surface: Agentic-RAG`, all with **no `trigger_when` field**. `.planning/ROADMAP.md:266` states
their re-open trigger in prose as *"the first AUTOMATIC or BACKGROUND sync from a connected
source"*.

### 4.3 Two seeds on this surface are already `answered` — the contrast case

`SEED-200-mcp-connection-cannot-be-bound-to-any-step.md` → `status: answered`.
`SEED-201-external-action-workflow-cannot-publish-golden-run-waits-forever.md` → `status: answered`.
Both name the connections surface; neither is a routing candidate.

---

## 5 · Critical-phase classification (`AGENTS.md §3.1`) — an OPEN QUESTION, not a verdict

`BUS-002` (2026-08-26) assigned Phase 212 to Gemini, verbatim: *"211/213/215 are Claude-built for
that reason -- 210, 212, 214, 216 are yours."* §3.1's closing line supports that assignment:
*"Everything else — catalog UI, chips, marks, filters, copy, presentation layers — is Gemini's, and
that is most of the work by volume."*

**What is measured, and left as a question rather than answered here:** the ROADMAP text for Phase
212 that BUS-002 predates contains scope that reads onto §3.1 criterion **2** (*"The outbound egress
boundary — anything that opens a socket to the internet. SSRF, loopback, RFC1918,
cloud-metadata."*):

- **SC#4**, verbatim — *"A user pastes an MCP server URL for a service nobody here has heard of, its
  tools are discovered and become grantable, and **no code changed on our side** (CONN-06)."*
- **Flags**, verbatim — *"**Threat model REQUIRED**: the paste-a-URL door is an operator-supplied
  outbound endpoint — SSRF, redirect chasing, response size, and the egress guard's ruling on a URL
  nobody curated. **Fix `mcp_client.py:220`'s blocking DNS in an async handler** (D-v2.5-01) — in
  scope by adjacency, and the sibling capability path already shows the threadpooled shape."*

⚠ **This is the operator's call, not the reviewer's and not the builder's.** It is on the bus as a
separate item `--to operator`. §6 below supplies the facts that question needs; it draws no
conclusion from them.

---

## 6 · The paste-a-URL door, measured — `mcp_client` vs the sibling capability path

Every line here is `grep`/`sed` output on the untouched tree. No judgement is attached.

### 6.1 Six measured differences between the two outbound paths

`backend/app/services/mcp_client.py::_send_jsonrpc` (line 210) is the MCP outbound path.
`backend/app/security/egress.py::send_pinned_http` (line 577) is the capability outbound path.

| Property | `mcp_client._send_jsonrpc` | `egress.send_pinned_http` |
|---|---|---|
| Validation call | `validate_mcp_destination(server_url)` — `mcp_client.py:220` | `await run_in_threadpool(validate_destination, …)` — `egress.py:619` |
| Runs off the event loop? | **no** — bare call inside `async def` | **yes** |
| Return value used? | **discarded** — line 220 assigns nothing | `pinned` → `httpx.URL(url).copy_with(host=pinned.ip)`, `egress.py:626` |
| `follow_redirects` | **`True`** — `mcp_client.py:233` | **`False`** — `egress.py:647` |
| `trust_env` | not set (httpx default) | **`False`**, with an in-file note that this is *"a SECURITY setting, not tidiness"* |
| Response size bound | none found — `response.text` read whole (`mcp_client.py:106`) | `Accept-Encoding: identity` + `_decode_bounded` |

`validate_mcp_destination` is a plain `def` (`egress.py:427`) whose default resolver reaches
`socket.getaddrinfo` (`egress.py:301`). `grep -rn "validate_mcp_destination" backend/app/` returns
exactly **one** call site — `mcp_client.py:220`.

`egress.py:605-613` states the cost of the unwrapped shape in the file's own words:

> ⚠ CR-04 / D-v2.5-01 — THE VALIDATION RUNS OFF THE EVENT LOOP, and the reason is the DNS lookup
> inside it, not the validation. … `timeout=` does NOT bound it: the timeout goes to the transport,
> not to `getaddrinfo`, so a blackholed nameserver blocks for the OS resolver's own budget (glibc
> `timeout:5 attempts:2` per nameserver — tens of seconds) with no application-level cap anywhere.

`egress.py:626` states what the discarded return value buys on the sibling path:

> This single line is the DNS-rebinding TOCTOU fix: the TCP connection goes to the address that was
> validated, not to whatever the next DNS answer says.

`validate_mcp_destination` does enforce, measured in its body (`egress.py:427-470`): HTTPS-only
(`scheme != "https"` → `_refuse`, with an in-file `WARNING` that this read `("https", "http")` until
2026-08-25), non-empty host, ASCII-only host, and a public-address predicate over every resolved
answer.

### 6.2 The D-v2.5-01 guard does not cover this file

`backend/tests/unit/test_071_1_threadpool_sweep.py` is the executable guard for D-v2.5-01. Its own
docstring scopes it: *"assert /reextract, /upload, /reingest handlers have zero unwrapped sync
supabase calls … slices each route's function body out of **documents.py** source"*.
`grep -nE "mcp_client|glob|walk|rglob"` over that file returns **nothing**. It holds 3 tests, of
which **1 fails at baseline**: `test_extract_composable_calls_wrapped_in_threadpool` (§1.4).

So: `mcp_client.py:220` is not inside any file that sweep reads.

### 6.3 What migration 127 already says Phase 212 owns

`supabase/migrations/127_connector_connection_service_identity.sql` is applied to the live DB
(STATE.md, 2026-08-27, zero-diff `regenerate-full-schema.sh` re-run) and names this phase three
times. Verbatim:

- `service_id` `COMMENT` (§2): *"FREE TEXT. It is NOT a foreign key, it is NEVER CHECK-constrained
  against a closed list, and no migration may later close it… The curated "Popular" set (Phase 212)
  is a PRESENTATION LOOKUP keyed by this value (D-211-02) — a miss degrades to a generic mark, NEVER
  to a refusal and NEVER to a hidden row, which is what makes adding a service cost a presentation
  row instead of a migration."*
- §5: *"⚠ MIGRATION 116'S `(org_id, capability)` INDEX IS DELIBERATELY **NOT** DROPPED HERE… The
  capability index becomes droppable once the read pattern has actually changed rather than merely
  been offered an alternative — **Phase 212 owns that call**, and owes a measurement of the live read
  pattern before making it."*
- §4: *"⚠ MIGRATION 118 RE-GRANTED `SELECT` ON THIS TABLE **COLUMN BY COLUMN**… **A NEW COLUMN IS
  THEREFORE UNREADABLE BY DEFAULT**, and the read that breaks is not this feature's — it is EVERY
  read of this table… **THE FAILURE IS TOTAL AND IT LOOKS LIKE AN OUTAGE**… Measured exactly that way
  on 2026-08-25, one migration ago."*

The two live constraints after 127: `connector_connections_has_a_service_identity`
(`service_id IS NOT NULL AND length(btrim(service_id)) > 0`) and
`connector_connections_shape_is_not_ambiguous` (`NOT (capability IS NOT NULL AND mcp_server_url IS
NOT NULL)`). Migration 126's `connector_connections_shape_is_one_of_two` is dropped.

---

## 7 · Live-tree measurements for the catalog surface

Driven against local Postgres on `127.0.0.1:54322` with `psycopg2`.

### 7.1 Every `connector_connections` row, post-migration-127

```
service_id            capability        has_mcp   discovered_tools
--------------------  ----------------  -------   ----------------
jira                  create_ticket     False     1
mcp.deepwiki.com      None              True      3
slack                 post_message      False     1
```

Three rows. `service_id` is backfilled and non-blank on all three (the §3 `CHECK` holds). ⚠ **The
MCP row's `service_id` is a HOSTNAME (`mcp.deepwiki.com`), not a service slug** — the two legacy rows
carry slugs. Stated as a measurement of the key a `service_id`-keyed presentation lookup would read.

⚠ **No SMTP / `send_email` connection exists on this install.** STATE.md records the same absence as
211's blocked UAT row 3: *"row 3 (SMTP · `send_email`) is ⛔ BLOCKED — no such connection exists here
(the table holds `slack`, `jira`, `mcp.deepwiki.com`)."*

### 7.2 Column-level SELECT grants on `connector_connections`

`authenticated` holds SELECT on exactly 15 columns:
`capability, config, created_at, created_by, discovered_tools, id, is_enabled, last_check_verdict,
last_checked_at, mcp_server_url, name, org_id, service_id, tool_grants, updated_at`.

`secret_ciphertext` is correctly **absent**. `anon` holds **zero** SELECT grants on this table.
`service_id`'s grant (migration 127 §4) is **present and live**.

### 7.3 `live_connectors` — the flag on both ends of `BUG-260810-01`

| Measurement | Value | Source |
|---|---|---|
| Cold default | **`"off"`** | `backend/app/models/user_settings.py:1214` |
| This install's live value | **`{'roles': [], 'groups': [], 'audience': 'everyone'}`** | `app_settings.feature_visibility`, read from the DB |
| Frontend read | fails **CLOSED** — an absent key reads as off | `ConnectionsTab.tsx:1019-1021` (module docblock) |
| Write-affordance gate | `const canWrite = isOrgAdmin && liveConnectorsOn` | `ConnectionsTab.tsx:270` |
| Off-state behaviour | *"every WRITE affordance is REMOVED rather than disabled"* | `ConnectionsTab.tsx:85-87` |

⚠ **This install is a FLIPPED install.** The DB says `everyone`; the shipped cold default is `off`.
The 210 pack's §6 caveat applies unchanged: *"its 16/16 browser drive ran against a flag-flipped
database, so it proves behaviour on a flipped install, not a fresh one."* The cloud install's value
is **not measurable from here** and is recorded as unmeasured, not as unknown-therefore-fine.

⚠ **`canWrite` has TWO conjuncts.** Both are stated; neither is diagnosed.

### 7.4 `live_connectors` operator reachability — the 210 pack's finding is now FALSE at HEAD

The 210 pack measured `grep -rn 'live_connectors' frontend/src/components/admin/` → **ZERO
occurrences** (`BUG-260826-04`'s crux). Re-run today it returns **four non-test hits**:

```
frontend/src/components/admin/ControlRoomPage.tsx:198
frontend/src/components/admin/ControlRoomPage.tsx:239
frontend/src/components/admin/FeatureVisibility.tsx:162
frontend/src/components/admin/FeatureVisibility.tsx:325
```

Phase 210 shipped the operator switch. Recorded so 212 does not inherit a superseded measurement.

### 7.5 The G-2 acceptance bar exists on disk

`ls screenshots/` resolves all three files the ROADMAP names:
`Screenshot 2026-08-24 202011.png`, `Screenshot 2026-08-24 202036.png`,
`Screenshot 2026-08-24 202044.png`.

### 7.6 What a catalog can enumerate today

`backend/app/services/connectors/descriptors.py` holds an authored label map whose own comment at
line 78 already names this phase: *"…field, and Phase 212's catalog label. Authored, because prose
cannot be derived."* Its `_TITLE_FOR_CAPABILITY` has exactly three entries —
`send_email → "Send email"`, `create_ticket → "Create issue"`, `post_message → "Post message"` —
i.e. it is keyed on `capability`, not on `service_id`.

`grep -rln "popular\|catalog"` over `backend/app` + `frontend/src`, filtered to connector/settings
paths, returns four files: `backend/app/models/connector.py`,
`backend/app/models/user_settings.py`, `backend/app/services/connectors/descriptors.py`,
`frontend/src/components/settings/connectionFormCopy.ts`.

---

## 8 · `D-207-06` — the barrel, measured

ROADMAP §Phase 212 flags, verbatim: *"⚠ **`D-207-06` has no guard**: a symbol exported from a
`lib/api` domain module but forgotten in the barrel typechecks perfectly and is invisible to every
consumer — this phase adds `lib/api` surface, so check the barrel explicitly."*

Measured at HEAD: `frontend/src/lib/api/connectors.ts` exports **11** symbols —
`ConnectorApiError, checkConnectorConnection, createConnectorConnection, deleteConnectorConnection,
discoverConnectorTools, getConnectorConnection, listConnectorConnections, updateConnectorConnection,
updateConnectorGrants` (values) and `ConnectorCheckBucket, ConnectorCheckResult` (types).
`frontend/src/lib/api.ts:389-404` re-exports **all 11**. **Barrel drift today: zero.**

The "no guard" half also re-derives: no test file under `frontend/src` references `api/connectors`
as a barrel-completeness check
(`grep -rln "api/connectors" --include=*.test.ts --include=*.test.tsx frontend/src` → no results).

---

## 9 · Reachability

Phase 212's SC#3 is a person on a **cloud** install connecting a Popular service in one click. The
Phase 118 / Phase 200 failure shape is: built, gated, green, and structurally unreachable.

Three facts bear on it, and no conclusion is drawn from them:

1. §7.3 — the write affordance is behind `isOrgAdmin && liveConnectorsOn`, and `live_connectors`
   ships cold as `off`.
2. §7.3 — this install has it flipped to `everyone`, so a local drive proves behaviour on a flipped
   install.
3. §7.4 — the operator switch that flips it now exists (Phase 210), which it did not when
   `BUG-260810-01` was filed against `production` at `5d5ea200`.

⚠ **The cloud install was not measured.** Nothing in this pack was driven against `production`, and
`BUG-260810-01`'s `reproduces_on` is `branch: production, commit: 5d5ea200, date: 2026-08-10` — 17
days and two milestones before HEAD.

---

## 10 · Cross-plan seam audit — the check that would have caught the Phase 204 defect

Not a finding; a **procedure the builder owes**, recorded because `AGENTS.md §3.1` names it as the
reviewer's mechanical gate on a critical phase and because the 204 defect is the reason it exists.

For every value one plan WRITES and another READS in this phase, name the exact column or key on
**both** sides and confirm they match. If the phase has parallel waves and no test that mocks
**neither** side, that is a gap.

Two seams are already visible on the tree, stated as facts:

- **`service_id` is written by migration 127 and read by whatever the catalog groups on.** It is
  free text with one `CHECK` (present and non-blank) and no closed list — §6.3. Today its three live
  values are `jira`, `slack`, `mcp.deepwiki.com` (§7.1), and one of the three is a hostname.
- **A new column on `connector_connections` needs a column-level `GRANT` in the same migration**, or
  every read of the table 42501s (§6.3, migration 127 §4). Measured 2026-08-25, one migration ago.

⚠ **STATE.md records one live obligation this phase may inherit and one it does not.** Verbatim:

> **ARM 1 IS STILL OPEN and is a DIFFERENT failure.** … **The UI-reachable path —
> `ConnectionPicker.bind` clears the step's `capability`, a service-only row advertises no action,
> and the closed-set guard raises a bare `KeyError` at `phase_types.py:~2323`** — is untouched and
> still stack-trace-shaped on the surface whose whole discipline is not over-claiming. … **A phase
> that reads only the `✅` will ship over it.**

> **G-5 ON `phase_types.py` IS NOW OWED, NOT HONOURED.** … Re-derived at the fix's commit:
> **47 commits / 21 phases / 2664 L, G-5 still FIRES.** The next phase whose `files_modified` names
> this file owes a refactor recommendation as its FIRST option.

`backend/app/services/harness/phase_types.py` is **not** in this pack's blast-radius table because
the ROADMAP does not name it for Phase 212. If a Phase 212 plan's `files_modified` names it, that
obligation attaches.

---

## 11 · Two operator-only items still owed from Phase 211

STATE.md, verbatim, under *"⚠ Owed before 212 — all three are OPERATOR-ONLY"*. Item 1 is discharged
(`regenerate-full-schema.sh` re-run by the reviewer: zero diff); items 2 and 3 are not:

2. ⭐ **`/code-review ultra review-210-211-base`** — 46 files / 5,784 lines, both phases' source in
   one pass. *"It is the ONLY independent gate on two reviewer-authored fixes that have no verifier
   (`7bd77065` W-1, `ca015df9` SC#10)."* Branch built in `.claude/worktrees/revbase`; tear down with
   `scripts/teardown-worktree.sh`, **never `rm -rf`**.
3. **211's five per-shape UAT rows + four G-4 lived-experience checks.** Row 5 is named as the one to
   run first; **row 3 (SMTP · `send_email`) is ⛔ BLOCKED** — §7.1 re-measures the absence.

`BUS-010` (to:gemini, from:claude, 2026-08-26) is **still OPEN** and unanswered.
