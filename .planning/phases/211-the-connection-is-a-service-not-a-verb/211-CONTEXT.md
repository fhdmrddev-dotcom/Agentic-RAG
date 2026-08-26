# Phase 211: The Connection Is a Service, Not a Verb - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning
**Builder:** Claude (critical phase — `AGENTS.md §3.1`, criterion 4: a migration that commits a table shape)
**Reviewer:** Gemini (mechanical gate) + operator-run `/code-review ultra`

<domain>
## Phase Boundary

A connection is created against a **service**, and the actions it offers come from that service's
own advertised tools — so that adding a service is **data rather than code**, and no surface
downstream ever has to branch on which of two connection models it is looking at.

⭐ **This is the milestone's PREREQUISITE (`SEED-207`).** 212, 214 and 216 all depend on it. While
two connection models coexist, every downstream surface — node face, service mark, filter, chat
mention, catalog entry, picker — must branch, and **each new surface pays the branch again**.

**In scope:** the connection row's identity, migration 127, a one-shape action list for every
connection kind, the `mcp_client` sanitizer widening, and the minimum UI change that makes SC#3 true.

**Out of scope:** the catalog design (212), OAuth (215), the chat surface (216), argument
satisfiability enforcement (214 — though this phase pre-pays it, see D-211-06).
</domain>

<decisions>
## Implementation Decisions

### Service identity — what migration 127 commits

- **D-211-01: A connection's identity is a FREE-TEXT service identifier on the row.** Not a
  CHECK-constrained enum. The user or the MCP server supplies it.
  ⚠ **A closed `service_id` enum was explicitly REJECTED**: it is migration 116's mistake moved to a
  nicer axis. Every unknown service would again become invisible or have to squeeze into a known
  name — the exact defect `SEED-207` exists to kill.
  ⚠ **Deriving identity from the MCP URL / OAuth provider was also REJECTED**: it breaks for two
  connections to the same service (prod + sandbox Jira), breaks for a generic SMTP host, and there
  is nothing to derive from until OAuth lands in 215.

- **D-211-02: The curated "Popular" set is a PRESENTATION LOOKUP keyed by that identifier, never a
  constraint on it.** It supplies mark, display name and starter prompts. **A miss degrades to a
  generic mark — never a refusal, never a hidden row.**
  ⭐ This is what makes the custom-URL door cost **zero engineering**: adding a service is a row in a
  presentation table, not a migration. The lookup table itself is built in Phase 212; 211 only
  commits that identity does not depend on it.

### The three legacy rows

- **D-211-03: Migration 127 BACKFILLS a service identity onto every existing row**, derived from its
  `capability` (`slack` / `jira` / `smtp`). One-time, at migration.
  ⚠ **`capability` STAYS ON THE ROW, untouched. Nothing about sending changes.** CONN-05 is
  "keeps working unchanged" — the backfill only ADDS identity.
  ⚠ **Read-time branching was REJECTED** — it is the cost `SEED-207` measured, paid again by 212,
  214 and 216. An adapter shim was also rejected: it becomes a second source of truth about what a
  connection IS, needing something to hold it in agreement with the real rows.

- **D-211-04: Migration 127 also drops migration 126's
  `CHECK (capability IS NOT NULL OR mcp_server_url IS NOT NULL)`** — the constraint that refuses an
  OAuth-authenticated service, which has neither (CONN-08).
  ⚠ **Relaxing a CHECK removes a database-level guarantee. Say what replaces it.** Migration 126's
  own comment records why the CHECK exists: with `NOT NULL` gone from `capability`, a
  NULL-capability INSERT is ACCEPTED, because `capability = ANY(ARRAY[...])` evaluates to NULL and a
  CHECK passes unless it is FALSE — so §1 alone permitted a row that is neither shape, "a connection
  that resolves to nothing, listed in every picker." **The replacement guarantee must be stated in
  the migration and must be enforced at the database, not only in the Pydantic model** — the model
  guards the API and a service-role writer walks around the API.

### Where a legacy connection's actions come from

- **D-211-05: Hand-author a STATIC TOOL DESCRIPTOR per adapter, in the same schema as
  `discovered_tools`.** Three small descriptors (Slack, Jira, SMTP). Downstream, a legacy connection
  is **indistinguishable** from an MCP one.
  ⚠ Runtime reflection over the adapter's Python signature was REJECTED: fragile, and it produces no
  human-readable action name or description for a catalog to display.

- **D-211-06: The descriptors MUST declare each adapter's REQUIRED ARGUMENTS.**
  ⭐ **This is the hidden payoff and it closes a defect that has been open since v3.6.** CONN-02's
  recorded failure is that `_adapter_args` fills exactly one field — the capability's `body_arg` —
  so **Slack works by coincidence** (it needs only `["text"]`, which *is* that arg) while Jira needs
  `summary` and SMTP needs `to`/`subject`, neither of which has an author-facing field; both raise,
  are caught, and report `failed`. Declaring the required arguments here is what makes Phase 214's
  STEP-02/STEP-03 (argument satisfiability, closing ⛔ `BUG-260826-01`/`-02`) possible at all.

### UI reach — the line against Phase 212

- **D-211-07: 211 does the API plus the MINIMUM UI that makes SC#3 true; 212 designs the catalog.**
  211 removes the verb wherever it ORGANISES — filters, pickers, form categories — and swaps the
  data source. **It changes no layout.**
- **D-211-08: 211 therefore owes NO Stitch pass and NO sketch.** G-2 does not fire: this phase
  *removes an organising axis*, it does not design a surface. **Phase 212 owes both.**
  ⚠ When 212 does run them, the design bar is the **shipped** `Aether Intelligence` tokens in
  `frontend/src/index.css`, NOT the Stitch project's design-md — see *Risks* below.

### The sanitizer

- **D-211-09: Widen the `mcp_client` allow-list to carry `title` and `outputSchema`. WIDEN THE LIST,
  NEVER REMOVE IT.** A raw passthrough puts server-controlled keys into `discovered_tools` JSONB.
  `title` feeds Phase 212's catalog label; `outputSchema` feeds Phase 214's argument satisfiability.
- **D-211-10: `annotations` / `readOnlyHint` MAY be carried but MUST NOT be depended on.** Measured
  absent in the wild, and per the MCP spec a hint from an untrusted server may never *widen* a
  permission. **No direction/read-ness design may rest on it.**

### Claude's Discretion

- The exact column name and type for the service identifier, and whether the presentation lookup
  lands in code or in a table (212 decides its home; 211 only fixes that identity does not depend
  on it).
- The internal shape of the static descriptors, provided it is byte-compatible with what
  `discovered_tools` already holds so downstream readers cannot tell them apart.
- Plan/wave decomposition, and which of the ~17 verb-spelling sites move in which plan.

### Reviewed Todos

- `spike-nl-workflow-authoring.md` (score 0.6) — **NOT folded.** The match is keyword-only
  (`run`, `before`, `schema`); the todo is about NL→workflow authoring, which is Phase 216/`SEED-208`
  territory, not the connection model.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The requirement and the phase
- `.planning/REQUIREMENTS.md` — CONN-04, CONN-05, CONN-08 (this phase's three requirements)
- `.planning/ROADMAP.md` → `#### Phase 211` — goal, 4 success criteria, and the Flags block naming
  the capability spellings, migration 127, the sanitizer widening and the D-14 red line
- `.planning/STATE.md` → *Milestone v3.9 — scope* — the four scoping decisions (D-v3.9-01..04) and
  *Measured facts that must not be re-derived from stale prose*

### The seeds this phase discharges
- `.planning/seeds/SEED-207-the-three-verbs-become-one-shape-among-many-not-the-organizing-axis.md`
  — ⚠ **READ IN FULL.** Carries the measurement that the verbs must NOT be deleted, and the
  `phase_types.py:2311-2322` evidence that two shapes reach the executor closed by different sets
- `.planning/seeds/SEED-146-integration-capability-surface.md` — the umbrella; names committing the
  connection table shape twice as the expensive mistake
- `.planning/seeds/SEED-144-provider-shaped-connections-oauth.md` — provider-shaped, not
  action-shaped; one Google account is one connection

### Prior scoping and research
- `.planning/CONNECTIONS-MILESTONE-CANDIDATE.md` — ⚠ **PARTLY STALE.** Its claims that "no MCP
  client exists in the backend today" and that `test_189_no_egress.py`'s fence must be retired are
  both FALSE at HEAD; both were done in v3.8. The rest is sound.
- `.planning/research/connections-competitor-study.md` §Q2 — the verdict this phase acts on:
  *"we promoted an attribute to be the browse axis"*; and §Q1 on `ToolAnnotations.readOnlyHint`
- `.planning/milestones/v3.8-MILESTONE-AUDIT.md` — v3.8's carried gaps, incl. the discarded
  `outputSchema` that D-211-09 recovers

### The code that encodes the closed set
- `backend/app/services/harness/grounding.py` — `EXTERNAL_ACTION_CAPABILITIES` (runtime home) and
  the disjointness assert at **line 1146**
- `backend/app/models/connector.py` — `ConnectorCapability` (line ~101 assert),
  `CONFIG_MODEL_FOR_CAPABILITY` (line ~169 assert)
- `backend/app/models/harness.py` §`ExternalActionPhaseConfig` (lines ~225-262) — ⚠ **READ THE
  DOCBLOCK.** It records the `| str` inertness incident verbatim
- `supabase/migrations/116_*.sql` — the original CHECK-constrained closed set
- `supabase/migrations/126_mcp_connector_connections.sql` — the CHECK D-211-04 drops, and its
  comment explaining why a bare `DROP NOT NULL` is insufficient

### Project contract
- `CLAUDE.md` — migrations via the Supabase SQL editor then `scripts/regenerate-full-schema.sh`;
  the hot-file ledger; the UAT scoreboard
- `AGENTS.md` §3.1 — why this phase is Claude-built and who reviews it
- `.planning/phases/210-.../210-MEASUREMENTS.md` — the untouched-tree gate baselines (tsc 34,
  count gate 5793/0, backend 68 failed) apply to this phase too
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`backend/app/services/mcp_client.py` (367 L)** — the MCP client SHIPS. Tool discovery and the
  sanitizer allow-list (`~line 293-296`) already exist; D-211-09 widens that list rather than
  building anything.
- **`connector_connections.discovered_tools` / `tool_grants` JSONB (migration 126)** — the one-shape
  target already exists and is populated for MCP rows. D-211-05's descriptors are written to match
  what is already there, not to a new schema.
- **`backend/app/services/connectors/{slack,jira,smtp}_adapter.py` + `registry.py` + `protocol.py`**
  — the three adapters and their argument requirements are already expressed in code; D-211-05's
  descriptors are a declaration of what those files already do.

### Established Patterns
- **The closed-registry rule.** `_TOOL_REGISTRY`, `PROGRAMMATIC_PHASE_REGISTRY` and
  `EMITTER_REGISTRY` all share it: an unknown name is a `ValidationError` at parse time, never a
  dynamic lookup and never an `eval`. ⚠ **D-211-01 moves the closure from `capability` to the
  PER-TOOL GRANT, which is data and already ships — it does not abolish closure.** A plan that
  simply opens things up has misread this decision.
- **Mechanical agreement over remembered agreement.** Every duplicate spelling of the set is held by
  a module-scope `assert` plus a unit test. Whatever replaces the axis must be held the same way.

### Integration Points
- Measured, and **larger than the roadmap's Flags block states**: the roadmap says four spellings
  held by two asserts. Actual: **five backend spellings held by three asserts** —
  `EXTERNAL_ACTION_CAPABILITIES`, `ConnectorCapability`, `CONFIG_MODEL_FOR_CAPABILITY` (a third map
  at `connector.py:169`, not named in the roadmap), `ExternalActionPhaseConfig.capability`, and
  migration 116's SQL `CHECK` — plus **12+ frontend files spelling `send_email` literally**
  (`settings/{ConnectionFormPanel,connectionFormCopy,connectionMark,connectionRefusalCopy,connectionsCopy}`,
  `workflows/{ConnectionPicker,canvasModel,definitionOps}` and their tests).
- ⚠ **Migration 116's `CHECK` is held by NOTHING EXECUTABLE** — SQL cannot import the Python
  frozenset, and the migration says so itself. It is the one spelling that can drift silently.
- ⚠ **`live_connectors` co-resides in four of this phase's backend files** and Phase 210 (Gemini)
  is working that flag. **File fence agreed with the operator:** 211 owns `models/connector.py`,
  `api/connectors.py`, `connector_service.py`, `mcp_client.py`, `harness/grounding.py`,
  `phase_types.py`, migration 127 and all of `components/settings/`; 210 owns `api/admin.py`,
  `components/admin/`, `scheduler_service.py`, `retrieval_service.py`, `embedding_service.py`.
  If 210 needs a file on 211's list it goes on the bus. **A split seam owes an integration test that
  mocks NEITHER side** (`AGENTS.md §3.1`).
</code_context>

<specifics>
## Specific Ideas

- **The operator's framing, and it governs every decision above:** *"you do not mean to limit it to
  ClickUp — everything we are building step by step so we can grow this menu of integration."*
  ClickUp was an example. **Nothing may be per-vendor.** A plan that adds a vendor-specific branch
  has misread the phase.
- **`SEED-207`, verbatim:** *"Previously we designed like three actions — send a message, or create
  a ticket, or whatever. This is the old way… I hope that we will address this later, to populate
  actually each connection's available tools rather than this old thing that we changed."*
</specifics>

<deferred>
## Deferred Ideas

- **The Popular catalog lookup's own content and layout** — mark, display name, one-line purpose,
  starter prompts. → Phase 212 (CAT-01..05). 211 commits only that identity does not depend on it.
- **Retiring the three verbs entirely** — ⚠ **NOT a deferral, a REJECTION with a measured reason.**
  They are the only external path that works with **no MCP server**. They become an attribute; they
  are never removed.
- **Argument satisfiability enforcement + publish refusal** → Phase 214 (STEP-02/03). D-211-06
  supplies the declaration those criteria need.
- **`readOnlyHint`-driven read/write direction in the vocabulary** → not scheduled. D-211-10 bars
  depending on it; Phase 209's own review already killed one regex-over-tool-name attempt at
  inferring read-ness (`get_user_and_purge_records` rendered "ONLY READS" while deleting).
</deferred>

<risks>
## Risks and anti-patterns specific to this phase

1. ⛔ **MAKING THE GUARD INERT WHILE "DEMOTING" IT.** `ExternalActionPhaseConfig.capability` read
   `Literal[...] | str | None` for the length of one phase, and `| str` made the literal
   **completely inert** — any string accepted, the closed set existing only as documentation.
   Driven 2026-08-25: `test_a_capability_outside_the_closed_set_is_refused` **DID NOT RAISE**.
   ⚠ *Optional* and *closed* are independent properties. This phase makes the verb **stop
   organising**; it must not make it **stop being checked**. Any plan touching that annotation owes
   a RED-first test proving an outside value is still refused.
2. ⚠ **The disjointness invariant.** `EXTERNAL_ACTION_CAPABILITIES ∩ KB_TOOLS == ∅`
   (`grounding.py:1146`) is why an external step carries no ⛨ governance seal and is *free to
   think*. Whatever replaces the axis must preserve it, or grounding detection changes silently.
3. ⚠ **A dropped CHECK with no stated replacement** (D-211-04). Migration 126 already measured that
   the obvious relaxation admits a row that resolves to nothing.
4. ⚠ **The design-system trap for Phase 212, recorded here so it is not rediscovered.** The Stitch
   project `Aether Journey v2` (`projects/7797685529205337277`) carries a design-md whose **machine
   tokens and prose disagree**, and **neither matches the shipped app**: shipped
   `--background #06090f` / `--primary #a3a5ff` vs Stitch tokens `#13131b` / `#c0c1ff` vs Stitch
   prose `#121212` / `#6366F1`. The shipped tokens additionally carry **measured** WCAG AA work
   (`--muted-foreground-dim` lifted from a failing 3.6:1 to a documented 8.42:1). **The shipped
   `index.css` is the bar; the Stitch design-md must be corrected from it, not the reverse.**
5. **D-14 red line:** no new executor. Seven harness executors in, seven out.
</risks>

---

*Phase: 211-The Connection Is a Service, Not a Verb*
*Context gathered: 2026-08-26*
