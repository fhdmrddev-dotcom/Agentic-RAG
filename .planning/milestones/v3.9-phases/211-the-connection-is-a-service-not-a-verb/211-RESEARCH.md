# Phase 211: The Connection Is a Service, Not a Verb — Research

**Researched:** 2026-08-26
**Domain:** connection data model / migration 127 / MCP tool descriptors / closed-set refactor
**Confidence:** HIGH (every claim below carries a `file:line` or a live-DB query; two web claims are `[CITED]` to the MCP spec)

---

<user_constraints>
## User Constraints (from `211-CONTEXT.md`)

### Locked Decisions — copied verbatim

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

- **D-211-07: 211 does the API plus the MINIMUM UI that makes SC#3 true; 212 designs the catalog.**
  211 removes the verb wherever it ORGANISES — filters, pickers, form categories — and swaps the
  data source. **It changes no layout.**
- **D-211-08: 211 therefore owes NO Stitch pass and NO sketch.** G-2 does not fire: this phase
  *removes an organising axis*, it does not design a surface. **Phase 212 owes both.**
  ⚠ When 212 does run them, the design bar is the **shipped** `Aether Intelligence` tokens in
  `frontend/src/index.css`, NOT the Stitch project's design-md.

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

### Deferred Ideas (OUT OF SCOPE)

- **The Popular catalog lookup's own content and layout** — mark, display name, one-line purpose,
  starter prompts. → Phase 212 (CAT-01..05). 211 commits only that identity does not depend on it.
- **Retiring the three verbs entirely** — ⚠ **NOT a deferral, a REJECTION with a measured reason.**
  They are the only external path that works with **no MCP server**. They become an attribute; they
  are never removed.
- **Argument satisfiability enforcement + publish refusal** → Phase 214 (STEP-02/03). D-211-06
  supplies the declaration those criteria need.
- **`readOnlyHint`-driven read/write direction in the vocabulary** → not scheduled. D-211-10 bars
  depending on it.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description (`.planning/REQUIREMENTS.md:28-40`) | Research support |
|----|-------------|------------------|
| **CONN-04** | A connection is created against a **service**, and its available actions come from that service's own advertised tools — never from a fixed three-verb list | §A (the `discovered_tools` key set a static descriptor must match), §C.4 (the ORGANISE-site list — the three-verb `<select>` at `ConnectionFormPanel.tsx:966-978`), §E (create/list path), §H (candidate migration) |
| **CONN-05** | The legacy three capabilities keep working unchanged as **one shape among many**, and no longer organise any surface. ⚠ They must NOT be deleted — `phase_types.py:2311-2322` | §B (the three adapters' required args, verbatim), §C (the SEVEN spellings and the FIVE asserts that must all still hold), §F.1 (the D-14 red line and the two-shape executor branch), §K (validation) |
| **CONN-08** | A connection stores an OAuth-authenticated service — neither a capability nor an MCP URL — without the database refusing the row | §D (mig 126's CHECK verbatim + its own comment), §H (three candidate replacements with SQL), ⚠ §E.3 — **there is a SECOND gate, in Pydantic, that CONTEXT does not name** |
</phase_requirements>

---

## Summary

Everything Phase 211 needs already exists in the tree; nothing here is a build-from-scratch. The
one-shape target (`discovered_tools` JSONB) is populated and read by four total, defensive readers;
the three adapters already declare JSON-Schema `INPUT_SCHEMA` blocks with explicit `required` arrays,
so D-211-05's descriptors are a *transcription* of `MappingProxyType` literals that already ship,
not a new authoring exercise. The MCP sanitizer is 24 lines and D-211-09 widens it by two keys.

Three measurements materially change the plan's shape versus what CONTEXT assumes, and all three are
in the "more work than stated" direction, never less:

1. **The closed set has SEVEN backend spellings held by FIVE module-scope asserts, not five held by
   three.** `connectors/registry.py:48-64` and `phase_types.py:2039-2059` are two more, and
   `registry.py`'s own docstring calls itself *"the SIXTH consumer"*. Every one is a static,
   data-independent `assert` that fires at import — so any of them left disagreeing is an
   `ImportError` for the whole app, not a latent surface.
2. **CONN-08 is refused at TWO gates, not one.** The DB CHECK is the one CONTEXT names; the other is
   `ConnectorConnectionCreate._validate_connection_shape` at `models/connector.py:257-258`, which
   raises `"Either capability or mcp_server_url must be provided"`. **Migration 127 alone does not
   make SC#4 true from the API.**
3. **A new column on `connector_connections` owes a `GRANT SELECT (col)` in the SAME migration or
   every read of the table 503s** — migration 118's column-by-column grant, re-stated at length in
   migration 126 §3 because it already caused exactly that outage on 2026-08-25.

**Primary recommendation:** decompose as (W0) descriptor + sanitizer + closed-set spellings — pure
backend, no schema; (W1) migration 127 + the `service_id` column threaded through
`ConnectorConnectionResponse` → `_RESPONSE_KEYS` → `_SELECTABLE_COLUMNS` → the `GRANT` → the create
row dict, plus the Pydantic shape validator; (W2) the frontend ORGANISE sites. Wave 1's five
touch-points are a single lockstep and must not be split across plans.

---

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Rationale |
|---|---|---|---|
| Service identity on the row | Database / Storage | API (Pydantic) | D-211-01 is free text; the DB is the only writer a service-role client cannot bypass (mig 126 §2's own argument) |
| Replacement shape guarantee | Database / Storage | — | D-211-04 states it explicitly: *"enforced at the database, not only in the Pydantic model"* |
| Static tool descriptors | API / Backend | — | Written server-side into the same JSONB readers already consume; a client-side descriptor is a second source of truth |
| MCP sanitizer widening | API / Backend | — | Server-controlled keys must never reach JSONB unfiltered (D-211-09) |
| Verb-de-organising (form/picker/filter) | Browser / Client | API (the `?capability=` query param) | The picker's *read* is capability-scoped at `ConnectionPicker.tsx:459`; removing the organising axis needs both halves |
| Closed-set agreement | API / Backend | — | Five import-time asserts; none is reachable from any other tier |

---

## A · The `discovered_tools` JSONB shape (blocks D-211-05)

### A.1 · The DDL, verbatim — `supabase/migrations/126_mcp_connector_connections.sql:12-20`

```sql
ALTER TABLE public.connector_connections
    ADD COLUMN IF NOT EXISTS mcp_server_url text,
    ADD COLUMN IF NOT EXISTS tool_grants jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS discovered_tools jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Drop NOT NULL on capability to allow provider-shaped MCP connections
ALTER TABLE public.connector_connections
    ALTER COLUMN capability DROP NOT NULL;
```

### A.2 · The CHECK D-211-04 drops — `126:42-47`

```sql
ALTER TABLE public.connector_connections
    DROP CONSTRAINT IF EXISTS connector_connections_shape_is_one_of_two;

ALTER TABLE public.connector_connections
    ADD CONSTRAINT connector_connections_shape_is_one_of_two
    CHECK (capability IS NOT NULL OR mcp_server_url IS NOT NULL);
```

### A.3 · Migration 126's own comment on why a bare `DROP NOT NULL` is insufficient — `126:31-40`, verbatim

```
-- ⚠ DROPPING NOT NULL ON `capability` OPENS A SHAPE THE TABLE CANNOT OTHERWISE REFUSE, and it
-- was measured rather than reasoned about (2026-08-25 pre-flight): with NOT NULL gone, a
-- NULL-capability INSERT is ACCEPTED, because `capability = ANY(ARRAY[...])` evaluates to NULL
-- and a CHECK passes unless it is FALSE. So §1 alone permits a row that is NEITHER a capability
-- connection NOR an MCP one — a connection that resolves to nothing, listed in every picker.
--
-- The model (`ConnectorConnectionCreate`) enforces exactly this, and that is precisely why the
-- database must too: the model guards the API, and a service-role writer walks around the API.
```

### A.4 · The sanitizer allow-list, verbatim — `backend/app/services/mcp_client.py:280-305`

```python
        sanitized_tools: list[dict[str, Any]] = []
        for item in raw_tools:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()
            if not name:
                continue
            description = str(item.get("description") or "").strip()
            input_schema = item.get("inputSchema")
            if not isinstance(input_schema, dict):
                input_schema = {"type": "object", "properties": {}}

            sanitized_tools.append({
                "name": name,
                "description": description,
                "inputSchema": input_schema,
                # Phase 209 (SC#2 · D-209-02) — forward annotations so `readOnlyHint`
                # reaches the frontend. ... Only forwarded when present and a dict.
                **({
                    "annotations": item["annotations"]
                } if isinstance(item.get("annotations"), dict) else {}),
            })

        return sanitized_tools
```

The writer of `discovered_tools` is `connector_service.discover_connection_tools`
(`connector_service.py:737-776`), whose write is `.update({"discovered_tools": tools})` at
`connector_service.py:766` — a **whole-column REPLACE**, same semantics as `tool_grants`
(`:791`, and `McpToolPicker.tsx:254-272` documents the lost-update hazard that follows from it).

### A.5 · **The exact key set a discovered tool object carries today**

| Key | Type after sanitizing | Always present? | Notes |
|---|---|---|---|
| `name` | `str`, stripped, non-empty | **yes** — a blank-named tool is dropped (`mcp_client.py:285-287`) | the grant key (`phase_types.py:2474-2475`) and the picker's `<option>` value |
| `description` | `str` | **yes** — defaults to `""` (`:288`) | never `None` |
| `inputSchema` | `dict` | **yes** — defaults to `{"type": "object", "properties": {}}` (`:289-291`) | never `None`, never a non-dict |
| `annotations` | `dict` | **no** — only when the server sent a dict (`:296-302`) | absence is meaningful; see `toolReadOnlyMap.ts:11-25` |

**A real object, read from the live DB** (`connector_connections` row `7ca5e114…`, *DeepWiki (206.1
UAT)*, `mcp.deepwiki.com/mcp`, 3 tools; `annotations` absent on all three, matching what Phase 209
measured):

```json
{
  "name": "ask_question",
  "description": "Ask any question about a GitHub repository and get an AI-powered, context-grounded response.",
  "inputSchema": {
    "type": "object",
    "required": ["repoName", "question"],
    "properties": {
      "question": { "type": "string", "description": "The question to ask about the repository." },
      "repoName": {
        "anyOf": [ { "type": "string" }, { "type": "array", "items": { "type": "string" } } ],
        "description": "GitHub repository or list of repositories (max 10) in owner/repo format."
      }
    }
  }
}
```

⭐ **Note `inputSchema.required` is already an array of strings in the wild.** D-211-06's *"declare
each adapter's REQUIRED ARGUMENTS"* therefore needs **no new field** — it is `inputSchema.required`,
which is exactly the key each adapter's `INPUT_SCHEMA` already spells (§B).

### A.6 · Every reader of `discovered_tools` / `tool_grants`, and what each requires

| Reader | Site | Requires |
|---|---|---|
| Pydantic response model | `models/connector.py:326` — `discovered_tools: list[dict[str, Any]]`, `:325` `tool_grants: dict[str, bool]` | a JSON list of objects; no key is required by the model |
| Pydantic update model | `models/connector.py:285-286` | same, optional |
| Row → response projection | `connector_service.py:299-302` (`None` → `{}` / `[]`), `:467-468`, `:512-513` | total over `None`; coerces to `dict`/`list` |
| Resolver dataclass | `connector_service.py:224-225` (`ResolvedConnection.tool_grants` / `.discovered_tools`) | list of `dict` |
| **Executor grant gate** | `phase_types.py:2474-2476` — `grants.get(tool_name) is True` | reads **`tool_grants`, never `discovered_tools`**; missing key DENIES |
| TS type | `lib/api/org.ts:424-442` `McpDiscoveredTool` — `name: string`, `description?`, `inputSchema?`, `annotations?.readOnlyHint?` | `name` only |
| Tool `<select>` + grant switch | `McpToolPicker.tsx:198-199`, `:279-305` | `name`; grant read via `isToolGranted(connection.tool_grants, toolName)` |
| read-only-hint map | `toolReadOnlyMap.ts:51-63` | `name` string, `annotations.readOnlyHint` **only if `typeof === "boolean"`**; everything else contributes no key |

**Verdict for D-211-05:** a static descriptor of the form
`{"name": …, "description": …, "inputSchema": {"type":"object","required":[…],"properties":{…}}}`
is indistinguishable to **seven of the eight** readers, because all of them are total and key-tolerant.

⚠ **The eighth is not, and this is the one branch D-211-05's "indistinguishable" claim does not
survive today:**

```tsx
// frontend/src/components/workflows/McpToolPicker.tsx:302
if (!connection?.mcp_server_url) {
  return null
}
```

A legacy connection carrying a perfectly-shaped `discovered_tools` list **renders no tool picker at
all**, because the component early-returns on the absence of an MCP URL. The same shape-test appears
in the picker's fetch (`ConnectionPicker.tsx:429-452`, the `shape === "mcp"` arm filters
`rows.filter(row => Boolean(row.mcp_server_url))`). **A plan that writes descriptors and stops has
not made SC#2's "presents as a service with named actions" true.** Flagged, not decided — 211's
minimum-UI line (D-211-07) is the planner's call.

---

## B · The three adapters' required arguments (blocks D-211-06 — the CONN-02 payoff)

### B.1 · Where the requirement is expressed

Every adapter declares `INPUT_SCHEMA` as a frozen `MappingProxyType` on its `Adapter` class, per the
seam's borrowed-property 2 (`connectors/protocol.py:180-184`). The `required` array is the
declaration D-211-06 needs.

| Capability | Adapter | `CAPABILITY` | `INPUT_SCHEMA` | **`required`** | Property types |
|---|---|---|---|---|---|
| `post_message` | `slack_adapter.py` | `:133`, class attr `:362` | `:369-380` | **`["text"]`** (`:372`) | `text: string` |
| `create_ticket` | `jira_adapter.py` | `:137`, class attr `:413` | `:419-437` | **`["summary", "description"]`** (`:422`) | `summary: string`, `description: string` (plain text → ADF; a document object is refused) |
| `send_email` | `smtp_adapter.py` | `:80`, class attr `:287` | `:293-311` | **`["to", "subject", "body"]`** (`:296`) | `to: string` (exactly one `local@domain`), `subject: string` (a line break is refused), `body: string` |

All three schemas also carry `"type": "object"` and `"additionalProperties": false`, and each
adapter independently re-checks undeclared keys — `slack_adapter.py:399-402`,
`jira_adapter.py:453-457`, `smtp_adapter.py:337-341` — so the descriptors are a faithful declaration
of a rule the code already enforces twice.

### B.2 · `_adapter_args` and the `body_arg` mechanism — quoted

```python
# backend/app/services/harness/phase_types.py:2047-2053
#: Where the upstream phase's text goes when the run's inputs do not name it. A CLOSED
#: two-column map, not a template language: D-09 is satisfied by NOT adding an evaluator, and
#: a per-field mapping UI is deferred with its own trigger.
_BODY_ARG_FOR_CAPABILITY: dict[str, str] = {
    "send_email": "body",
    "create_ticket": "description",
    "post_message": "text",
}
```

```python
# backend/app/services/harness/phase_types.py:2118-2140  (docstring elided)
def _adapter_args(adapter, capability: str, resolved: dict) -> dict:
    declared = set(adapter.INPUT_SCHEMA.get("properties", {}))
    args = {key: value for key, value in resolved.items() if key in declared}
    body_arg = _BODY_ARG_FOR_CAPABILITY[capability]
    if body_arg in declared and body_arg not in args and resolved.get("content"):
        args[body_arg] = resolved["content"]
    return args
```

Called once, at `phase_types.py:2548`.

### B.3 · **CONFIRMED — the CONTEXT's claim is exactly right, with one precision worth adding**

The `if` at `:2136-2137` fills **exactly one field**, and only the capability's `body_arg`. So:

- **`post_message`** needs `["text"]`; its `body_arg` **is** `"text"` → the one filled field satisfies
  the entire `required` array. **Slack works by coincidence** — CONTEXT verbatim, and measured true.
- **`create_ticket`** needs `["summary", "description"]`; `body_arg` is `"description"` →
  **`summary` is never filled.**
- **`send_email`** needs `["to", "subject", "body"]`; `body_arg` is `"body"` → **`to` and `subject`
  are never filled.**

**Precision:** line `:2135` is a projection of `resolved` (from
`_external_action_inputs(accumulated_outputs, ctx)`) onto the declared properties, so a run whose
*inputs happen to be keyed* `summary` / `to` / `subject` would satisfy them. There is **no
author-facing field that produces those keys** — `ExternalActionPhaseConfig` is `extra='forbid'` and
carries only `capability`, `available_tools`, `connection_id`, `tool_name`, `tool_args`
(`models/harness.py:262-…`). So the defect is reachable on every ordinary run, exactly as recorded.

### B.4 · The exact lines where Jira / SMTP raise

| Field | Raise site | Called from |
|---|---|---|
| Jira `summary` | `jira_adapter.py:280-284` — `_validated_text` → `raise JiraArgumentsInvalid(f"'{key}' must be a non-empty string")` | `jira_adapter.py:460` — `_validated_text(args, "summary")` |
| SMTP `to` | `smtp_adapter.py:126-150` — `_validated_envelope_recipient` → `raise SmtpRecipientRefused("the 'to' recipient is empty")` (`:145`) / `"must be a string, got NoneType"` (`:139-141`) | `smtp_adapter.py:345` — `_validated_envelope_recipient(args.get("to"))` |
| SMTP `subject` | `smtp_adapter.py:188-192` — `_validated_text` → `raise SmtpArgumentsInvalid(f"'{key}' must be a non-empty string")` | `smtp_adapter.py:346` — `_validated_text(args, "subject")` |

All three are `AdapterError` subclasses, so they are caught at `phase_types.py:2554-2562` and turned
into `{"text": …, "failure": f"{capability} was not performed: {exc}"}` — i.e. the run reports
`failed` with the adapter's own words, never a crash. That is why the defect is quiet.

---

## C · The spellings of the closed set, and the asserts that hold them

### C.1 · ⚠ MEASURED: **SEVEN backend spellings held by FIVE module-scope asserts**

CONTEXT records *"five backend spellings held by three asserts"* (itself a correction of the
roadmap's *"four … two"*). Re-derived at HEAD, the count is higher again. This **extends** the
locked decisions rather than contradicting them, but a plan sized against five/three will miss two
import-time asserts.

| # | Spelling | Site | Held by |
|---|---|---|---|
| 1 | `EXTERNAL_ACTION_CAPABILITIES: frozenset[str]` — **the runtime home** | `harness/grounding.py:1141-1143` | assert `:1146-1150` (disjointness vs `KB_TOOLS`) |
| 2 | `ConnectorCapability = Literal[...]` | `models/connector.py:96` | assert `:101-106` (vs #1) |
| 3 | `CONFIG_MODEL_FOR_CAPABILITY: dict[str, type]` | `models/connector.py:163-167` | assert `:169-172` (vs #1) |
| 4 | `ExternalActionPhaseConfig.capability: Literal[...] \| None` | `models/harness.py:262` | *no module-scope assert* — held by `tests/unit/test_189_external_action_model.py::test_the_literal_and_the_runtime_frozenset_are_the_same_closed_set` (`:376`) |
| 5 | SQL `CHECK (capability IN (…))` | `supabase/migrations/116_connector_connections.sql:71-75` | **NOTHING EXECUTABLE** — the migration says so itself (`:68-70`: *"SQL cannot import the Python frozenset"*). Verified LIVE as `connector_connections_capability_check` |
| **6** | **`_ADAPTERS: dict[str, str]`** (capability → adapter module) | **`services/connectors/registry.py:48-52`** | **assert `:58-64` (vs #1)** — the module's own docstring calls itself *"the **SIXTH** consumer of the closed capability set"* (`registry.py:3`) |
| **7** | **`_PRE_CREDENTIAL_DESTINATION` + `_BODY_ARG_FOR_CAPABILITY`** (two maps, one assert) | **`phase_types.py:2039-2043` and `:2049-2053`** | **assert `:2054-2059` (both vs #1)** |

Frontend mirrors (no import-time assert is possible across the language boundary):

| Spelling | Site |
|---|---|
| `export type ConnectorCapability = "send_email" \| "create_ticket" \| "post_message"` | `lib/api/org.ts:378` |
| `MARKS` (capability → icon) | `settings/connectionMark.tsx:143-145` |
| `CAPABILITY_CHOICES` (the three-verb dropdown) | `settings/connectionFormCopy.ts:115-118` |
| `FIELD_COUNTS` | `settings/connectionFormCopy.ts:255-258` |
| `EXTERNAL_CAPABILITY_SENTENCES` / `..._DESTINATION_JOINERS` | `workflows/phaseVocabulary.ts:587-589` / `:623-625` |
| `CONNECTION_CAPABILITY_WORDS` | `workflows/ConnectionPicker.tsx:106-108` |
| refusal nouns / vendor names / `NOTHING_HAPPENED` / the closed array | `settings/connectionRefusalCopy.ts:203-205`, `:218-219`, `:460-462`, `:466-468` |
| `EXTERNAL_ACTION_CAPABILITIES` (client mirror) | `workflows/ExternalActionSection.tsx:75-92` — ⚠ **derived from `EXTERNAL_CAPABILITY_SENTENCES`, not retyped**, and fenced cross-language by a `?raw` read of `harness.py` |

### C.2 · The disjointness assert at `grounding.py:1146` — verbatim, and what breaks

```python
EXTERNAL_ACTION_CAPABILITIES: frozenset[str] = frozenset({
    "send_email", "create_ticket", "post_message",
})
# Static, data-independent: both operands are literal frozensets declared in this file, so
# this can only fire when someone edits one of them — which is precisely when it should.
assert EXTERNAL_ACTION_CAPABILITIES & KB_TOOLS == frozenset(), (
    "D-03: an external-action capability collides with KB_TOOLS "
    f"({sorted(EXTERNAL_ACTION_CAPABILITIES & KB_TOOLS)}), which would make every "
    "external_action step read as grounding-`detected`"
)
```

**What breaks if violated.** Grounding detection is `available_tools ∩ KB_TOOLS`
(`grounding.grounding_cause`, `:1153-…`; the branch order is documented as load-bearing at
`:1163-1169`). `ExternalActionPhaseConfig` **derives** `available_tools` from `capability` and
**persists** it (`models/harness.py:215-224`). So a capability name that collides with a KB tool
makes `grounding_cause` return `"detected"` for every external-action step. Two consequences, both
silent:

1. Every external step gains a ⛨ **governance seal** it should not carry, and stops being *free to
   think* — `models/harness.py:226-236`: *"an external-action step reads no knowledge base. …
   `grounding_cause` returns `None` for this step."*
2. Because `detected` is recomputed every read and **checked FIRST** (`grounding.py:1163-1169`),
   there is no stored value and no author undo — the change would be unattributable and
   un-revertable from the UI.

The membership is fenced two ways by design (`models/harness.py:230-234`): this assert, and
`tests/unit/test_189_external_action_model.py:340` (`::test_the_capability_set_is_exactly_three_and_disjoint_from_kb_tools`)
plus `tests/unit/test_185_detection.py:339`.

### C.3 · The `| str` inertness incident — `models/harness.py:249-262`, verbatim

```
    # WARNING - THIS READ ``Literal[...] | str | None = "send_email"`` FOR THE LENGTH OF ONE
    # PHASE, AND ``| str`` MADE THE LITERAL COMPLETELY INERT. Any string was accepted, so the
    # D-15 closed set - the thing SC#2's "cannot be wired around a gate" means AT THE MODEL
    # LAYER - existed only as documentation. Driven 2026-08-25:
    # ``test_a_capability_outside_the_closed_set_is_refused`` DID NOT RAISE. Grounding
    # detection and the publish fidelity gate both read ``EXTERNAL_ACTION_CAPABILITIES``, so
    # an admitted-but-unknown capability is an UNENFORCED step, not merely an odd one.
    #
    # It is now OPTIONAL but still CLOSED, and the two properties are independent: an MCP
    # step names a ``tool_name`` and has no capability at all, which is a legitimate absence.
    # The default is gone with the ``| str``: defaulting to ``"send_email"`` meant an MCP step
    # that forgot its tool name silently became an EMAIL step.
    capability: Literal["send_email", "create_ticket", "post_message"] | None = None
```

**The existing test is real and it is named exactly as CONTEXT states:**
`backend/tests/unit/test_189_external_action_model.py:414` —
`def test_a_capability_outside_the_closed_set_is_refused():`. It is already **non-vacuous by
construction** (its own docstring, `:420-423`): it parses every admissible capability first, then
asserts `ValidationError` on `"wire_transfer"`.

**The RED-first test a plan touching that annotation owes.** The existing test is the *green
backstop*, not the RED-first artefact — it is already green at HEAD, so re-running it proves
nothing about a new annotation. A plan that edits line 262 must, **before** editing it:

1. run `pytest tests/unit/test_189_external_action_model.py::test_a_capability_outside_the_closed_set_is_refused -x`
   against the *proposed* annotation applied in isolation, and record it **RED** with the observed
   output verbatim (the 2026-08-25 incident's signature is *"DID NOT RAISE"*, so the RED evidence
   must be the `Failed: DID NOT RAISE <class 'pydantic_core...ValidationError'>` line, not a
   summary); **or**
2. if the annotation is not being edited at all, say so explicitly in the plan and cite this
   paragraph — silence reads as *"unchanged"* and means *"unchecked"*.

Companion tests in the same file that must stay green untouched: `:340`
`test_the_capability_set_is_exactly_three_and_disjoint_from_kb_tools`, `:376`
`test_the_literal_and_the_runtime_frozenset_are_the_same_closed_set`.

⚠ **Optional and closed are independent properties.** The annotation is *already* optional at HEAD
(`| None = None`, landed with Phase 206). This phase makes the verb stop **organising**; nothing in
CONN-04/05/08 requires the annotation to change at all. **The cheapest correct plan does not touch
line 262.**

### C.4 · The frontend verb sites — the ACTUAL list, split organise vs attribute

Measured with `grep -rc "send_email\|create_ticket\|post_message" src --include=*.ts --include=*.tsx`
from `frontend/`. **26 files, of which 11 are non-test source.** CONTEXT's *"12+ files"* is the right
order of magnitude; the split below is what the planner needs.

#### (a) Sites where the verb **ORGANISES** — this phase must remove or re-source these

| File | count | What organises | Why it is an organise-site |
|---|---|---|---|
| `settings/connectionFormCopy.ts` | **23** | `CAPABILITY_CHOICES` `:115-118`; `FIELD_COUNTS` `:255-258`; `capabilityLabelOf` `:126`; `configFromDraft` arms `:432/:441/:450`; `SLACK_ENDPOINT` `:480`; validity arms `:547/:557/:593` | **This is the three-verb dropdown's data.** SC#1 names it directly |
| `settings/ConnectionFormPanel.tsx` | **10** | the `<select>` at `:966-978` rendering `CAPABILITY_CHOICES` `:973`; the per-capability field blocks `:1006`, `:1052`, `:1126`; the label ladders `:798-802`, `:813-817` | **The literal "three-verb dropdown" of SC#1.** `data-testid="connection-capability-chooser"` `:952` |
| `workflows/ConnectionPicker.tsx` | **7** | the **capability-scoped fetch** `listConnectorConnections(capability)` `:459`, versus the MCP arm's unscoped read `:430` + shape filter `:436` | The picker *browses by verb*. `SEED-200` is exactly this line |
| `workflows/ExternalActionSection.tsx` | *(0 literals — derives)* | the shape radiogroup `:115`, the capability radio rows `:430-470`, and `{shape === "capability" && … <ConnectionPicker capability={selected} />}` `:475` | **The node-form's browse axis.** It renders `EXTERNAL_CAPABILITY_SENTENCES` as the option labels (`:468`) |
| `workflows/phaseVocabulary.ts` | **6** | `EXTERNAL_CAPABILITY_SENTENCES` `:587-589` (the picker's option labels, per its own docblock `:44`), `EXTERNAL_CAPABILITY_DESTINATION_JOINERS` `:623-625` | Doubles as the **picker's label source**, so it is organise *and* attribute |
| `settings/connectionMark.tsx` | **4** | `MARKS` `:143-145` — keyed by capability | The **mark** is the catalog's browse handle (SEED-207's table row *"3 capability arms + an MCP arm"* → *"one service→mark lookup"*). 212 owns the lookup; 211 must not deepen the keying |
| `lib/api/org.ts` | 2 | `ConnectorCapability` `:378` (`:106`, `:123` are `postMessage` prose, not the verb) | Types the `?capability=` query and the form draft |

⚠ **`ConnectionsTab.tsx` is already clean.** Its filter chips are STATE-based, not verb-based —
`CONNECTIONS_FILTER_CHIPS` at `connectionsCopy.ts:154-161` is `All / Connected / Not connected`, and
`ConnectionsTab.tsx:273-283` filters on `filterState ∈ {null,"ready","not_connected"}` plus a text
query. **Phase 209 item 3 already killed the verb chips.** Its one remaining literal is `:591`
`const isSlack = connection.capability === "post_message"` — an attribute read, category (b).

#### (b) Sites where the verb is a mere **attribute or adapter identifier** — these STAY

| File | count | What it is |
|---|---|---|
| `settings/connectionRefusalCopy.ts` | 15 | refusal nouns `:203-205`, vendor names `:218-219`, `NOTHING_HAPPENED` `:460-462`, the closed array `:466-468` — **all downstream of a capability that already exists on a row** |
| `settings/connectionsCopy.ts` | 4 | `destinationFactsOf` arms `:239/:244/:268` — describes *where a given row sends*, an attribute |
| `settings/ConnectionsTab.tsx` | 1 | `:591` `isSlack` — a per-row render fact |
| `workflows/definitionOps.ts` | 2 | `:1010` `return { capability: "send_email" }` — the **placed-step default**; `:926` prose. Its own comment (`:1004-1009`) says the value is fenced against `harness.py` and *"nothing downstream depends on this being the author's intent"* |
| `workflows/nodeEffectBanner.ts` | 1 | `:12` prose only |
| `workflows/canvasModel.ts` | 0 | ⚠ **CONTEXT lists this file; it has ZERO literal spellings at HEAD.** Verified `grep -c` → 0 |

#### (c) Tests (change follows the source they pin — **not** a separate decision)

`ConnectionFormPanel.test.tsx` 44 · `ExternalActionSection.test.tsx` 31 · `ConnectionPicker.test.tsx`
26 · `phaseVocabulary.test.ts` 23 · `connectionMark.test.tsx` 16 · `ConnectionsTab.test.tsx` 15 ·
`McpToolPicker.reachability.test.tsx` 6 · `PhaseFormPanel.test.tsx` 3 · `definitionOps.test.ts` 3 ·
`canvasModel.test.ts` 3 · `StepPanelPort.test.tsx` 2 · `nodeEffectBanner.test.ts` 2 ·
`StepTypePicker.test.tsx` 1 · `PhaseNode.test.tsx` 1 · `GovernanceSection.test.tsx` 1.

---

## D · The live table, right now

Read 2026-08-26 via `psycopg2` → `127.0.0.1:54322` (`backend/venv`; `psycopg2` is not on the system
Python — use `backend/venv/Scripts/python.exe`).

### D.1 · Columns

| column | type | nullable | default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `org_id` | uuid | NO | — |
| `created_by` | uuid | NO | — |
| `capability` | text | **YES** | — |
| `name` | text | NO | — |
| `config` | jsonb | NO | `'{}'::jsonb` |
| `secret_ciphertext` | text | YES | — |
| `is_enabled` | boolean | NO | `true` |
| `last_checked_at` | timestamptz | YES | — |
| `last_check_verdict` | text | YES | — |
| `created_at` | timestamptz | NO | `now()` |
| `updated_at` | timestamptz | NO | `now()` |
| `mcp_server_url` | text | YES | — |
| `tool_grants` | jsonb | NO | `'{}'::jsonb` |
| `discovered_tools` | jsonb | NO | `'[]'::jsonb` |

**Convention:** `snake_case`; `text` for identifiers (never `varchar(n)`); `jsonb` with a
`NOT NULL DEFAULT` for collections; `timestamptz` for time. A free-text service identifier fits the
house style as **`text`, nullable** (or `NOT NULL DEFAULT ''` — but see §H, a nullable column is what
lets a replacement CHECK be written cleanly).

### D.2 · Constraints, live

```
connector_connections_pkey                        PRIMARY KEY (id)
connector_connections_org_id_fkey                 FOREIGN KEY (org_id) → organizations(id) ON DELETE CASCADE
connector_connections_created_by_fkey             FOREIGN KEY (created_by) → auth.users(id) ON DELETE CASCADE
connector_connections_capability_check            CHECK (capability = ANY (ARRAY['send_email','create_ticket','post_message']))
connector_connections_last_check_verdict_check    CHECK (last_check_verdict = ANY (ARRAY['not_checked','ok','failed']))
connector_connections_mcp_url_is_https            CHECK (mcp_server_url IS NULL OR mcp_server_url ~~ 'https://%')
connector_connections_shape_is_one_of_two         CHECK (capability IS NOT NULL OR mcp_server_url IS NOT NULL)   ← D-211-04 drops this
```

Indexes from mig 116 `:99-108`: `idx_connector_connections_org_id`,
**`idx_connector_connections_org_capability` (org_id, capability)** — mig 116's own comment calls it
*"the picker's read is ALWAYS capability-scoped"*. A service-scoped read wants the analogous
`(org_id, <service column>)` index; the capability index becomes dead weight the day
`ConnectionPicker.tsx:459` stops passing `?capability=`.

### D.3 · ⚠ The rows — **there are three rows, but NOT "three legacy rows"**

| id | capability | name | mcp_server_url | tools | grants |
|---|---|---|---|---|---|
| `e62eed75…` | `post_message` | `Slack-rag-test` | — | 0 | `{}` |
| `477a4074…` | `create_ticket` | `Jira – KAN` | — | 0 | `{}` |
| `7ca5e114…` | **NULL** | `DeepWiki (206.1 UAT)` | `https://mcp.deepwiki.com/mcp` | **3** | `{read_wiki_contents: true, read_wiki_structure: true}` |

`GROUP BY capability` → `create_ticket: 1`, `post_message: 1`, `NULL: 1`.

**There is NO `send_email` row on this box.** See §J — this is the one measurement that bears on a
locked decision.

### D.4 · The regeneration rule (CLAUDE.md, and `scripts/regenerate-full-schema.sh:1-32`)

The plan MUST say, in the migration task's own text:

1. **Paste `127_*.sql` into the Supabase SQL editor.** Never `supabase db push`, never
   `supabase db reset` — both wipe dev data.
2. Then run **`bash scripts/regenerate-full-schema.sh`** (no flag). Default mode does **no reset**:
   it `pg_dump`s the live DB schema and rebuilds `supabase/full-schema.sql`, the single-file
   greenfield deploy artifact.
3. `--reset` is **destructive** (`:8-13`) and is for CI/release verification only.
4. Never hand-edit `full-schema.sql`.
5. Filename regex: **`<digits>_name.sql`**. Letter suffixes (`127b_…`) are *silently skipped by the
   Supabase CLI* (CLAUDE.md). Head is **126** — verified by `ls supabase/migrations/`; `127` is free.

---

## E · Backfill and the API surface

### E.1 · The create path — `connector_service.create_connection:520-573`

The row is an **explicit literal dict** (`:544-556`):

```python
    row = {
        "org_id": str(org_id),          # HARD-SET — never from the body (D-14)
        "created_by": str(created_by),  # HARD-SET — never from the body
        "capability": payload.capability,
        "name": payload.name,
        "config": config_data,
        "secret_ciphertext": ciphertext,
        "is_enabled": True,
        "last_check_verdict": "not_checked",
        "mcp_server_url": payload.mcp_server_url,
        "tool_grants": payload.tool_grants,
    }
```

⭐ **A new column that is not added HERE is never written**, no matter what the model declares. Note
`discovered_tools` is *already absent* from this dict — it is written only by
`discover_connection_tools` (`:766`). A static descriptor for a legacy row must therefore be written
by either (a) migration 127's backfill, (b) an addition to this dict, or (c) a read-time projection
— and (c) is the read-time branching **D-211-03 explicitly rejects**.

### E.2 · The five-point lockstep a new column owes — **all in one plan**

| # | Site | What |
|---|---|---|
| 1 | migration 127 | `ADD COLUMN` + backfill + `COMMENT ON COLUMN` |
| 2 | migration 127 §grant | **`GRANT SELECT (<col>) ON public.connector_connections TO authenticated;`** |
| 3 | `models/connector.py` `ConnectorConnectionResponse` | add the field — this is what feeds `_RESPONSE_KEYS` |
| 4 | `connector_service.py:139` | `_SELECTABLE_COLUMNS = ",".join(_RESPONSE_KEYS)` — **derived, so it follows #3 automatically** |
| 5 | `connector_service.py:544-556` | add the key to the create `row` dict |

⚠ **#2 is the one that turns an omission into an outage.** Migration 126 §3 (`:66-88`) records the
measurement verbatim: on 2026-08-25 `GET /connectors/connections` returned **503** and Settings →
Connections rendered *"Could not load connections"* **for a pre-existing Slack connection that has
nothing to do with MCP**, because `_SELECTABLE_COLUMNS` named columns `authenticated` had no grant
on and PostgREST answered `42501`. Migration 126's own rule: *"A column added to
`connector_connections` and to `ConnectorConnectionResponse` owes a grant HERE, in the same
migration."* Follow its convention of **one column per line** so an omission is visible in a diff.

### E.3 · ⚠ CONN-08 has a SECOND gate, in Pydantic — `models/connector.py:222-270`

```python
    @model_validator(mode="after")
    def _validate_connection_shape(self) -> "ConnectorConnectionCreate":
        if self.mcp_server_url:
            if not self.mcp_server_url.startswith("https://"):
                raise ValueError("mcp_server_url must be an HTTPS URL")
            return self

        # ── Capability shape: exactly the pre-206 contract, restored in full ──
        if not self.capability:
            raise ValueError("Either capability or mcp_server_url must be provided")   # :258
        _reject_config_capability_mismatch(self.capability, self.config)
        if self.secret is None or not str(self.secret).strip():
            raise ValueError("secret is required for a capability connection")          # :269
```

**SC#4 says "saves successfully."** Dropping the DB CHECK does not reach this validator. A third
shape needs a third arm here, and the docblock at `:224-246` is emphatic about *how*: the first
version of this validator let an MCP row's laxity leak onto every capability row, measured, three
`ACCEPTED` rows that should have been refused. Its own conclusion, verbatim:

> *"The fix is to branch on the SHAPE and validate each one on its own terms, never to loosen the
> shared path."*

A plan that widens the existing arms instead of adding a third is repeating a measured defect.

⚠ Same shape at `ConnectorConnectionResponse.config: ConnectorConfig` (`:323`) — a row whose config
matches no union member fails `model_validate` in `_to_response` (`:292-306`). `McpConfig` (`:152-155`)
is `{headers: dict}` with `extra='forbid'`, so an empty `{}` config validates as `McpConfig` today.
A service row with no config is therefore **already representable** on the response side.

### E.4 · What create / list / read return today, and the minimum change

| Route | Site | Returns | Minimum change for SC#1 / SC#3 |
|---|---|---|---|
| `GET /connectors/connections?capability=` | `api/connectors.py:295-320` → `connector_service.list_connections:577-601` | `list[ConnectorConnectionResponse]`, `.eq("capability", capability)` when the param is present (`:598-599`) | **SC#3:** the `capability` query param must stop being how the picker browses. Keep the param (it is additive and harmless) but change `ConnectionPicker.tsx:459` to stop passing it, or add a service filter. Either way the *server* need not change |
| `GET /connectors/connections/{id}` | `api/connectors.py:323-343` → `:605-625` | one response | + the new field (via #3/#4 above) |
| `POST /connectors/connections` | `api/connectors.py:345-380` → `:520-573`, gated `require_visible("live_connectors")` `:349` | 201 + response | **SC#1 + SC#4:** accept the service identifier; accept the third shape (§E.3) |
| `PATCH /…/{id}` | `:382-422` → `:627-…` | response | `ConnectorConnectionUpdate` `:273-286` — decide whether the service identifier is editable (CONN-07 is Phase 213's, not this phase's) |
| `POST /…/{id}/check` | `:448-…`, `capability = connection.capability` `:524`, `get_adapter(capability)` `:548` | `ConnectorCheckResponse` | ⚠ **A service row with no capability has no adapter to check.** `:528-536` already documents that an MCP row's NULL capability produced an unhandled `KeyError` once. A third shape reaches the same code — flag it, do not silently widen |

### E.5 · The Pydantic models for a connection row

- `ConnectorConnectionCreate` — `models/connector.py:193-270`. Fields: `capability` (optional closed
  Literal), `name` (`NonEmpty`), `config: ConnectorConfig` (4-member smart union, default
  `McpConfig`), `mcp_server_url`, `tool_grants`, `secret` (`NonEmpty | None`).
- `ConnectorConnectionUpdate` — `:273-286`. All-optional; **no `capability` field on purpose** (`:277-278`).
- `ConnectorConnectionResponse` — `:303-331`. **`extra='forbid'`, and the ABSENCE of `secret` /
  `secret_ciphertext` IS VALIDATION row T7** (`:306-309`), fenced by a module-scope assert at
  `connector_service.py:~105-112` proved by a plant in `test_190_connectors_api.py`.

**What changes when a free-text service identifier lands and `capability` becomes optional:**
`capability` is **already** `ConnectorCapability | None = None` on Create (`:202`) and Response
(`:313`) — Phase 206 did that. So the *only* model changes this phase needs are: the new field on
Create + Response (+ optionally Update), and the third arm in `_validate_connection_shape`. **The
capability `Literal` itself need not be touched, and per §C.3 the cheapest correct plan does not
touch it.**

---

## F · Risk and fence material

### F.1 · SEED-207's `phase_types.py:2311-2322` — verified EXACT at HEAD

```python
# backend/app/services/harness/phase_types.py:2311-2322
    if mcp_tool_name:
        if not str(mcp_tool_name).strip():
            raise KeyError(
                f"external_action phase {getattr(phase, 'slug', '?')!r}: an MCP step's "
                f"tool_name is blank — there is nothing to grant and nothing to invoke"
            )
    elif capability not in EXTERNAL_ACTION_CAPABILITIES:
        raise KeyError(
            f"external_action phase {getattr(phase, 'slug', '?')!r}: capability "
            f"{capability!r} is not registered in EXTERNAL_ACTION_CAPABILITIES "
            f"(closed set — register it explicitly)"
        )
```

The block's own preamble (`:2300-2310`), verbatim:

> `# ⚠ TWO SHAPES REACH THIS EXECUTOR AND EACH IS CLOSED BY A DIFFERENT SET. A native step`
> `# names one of the three D-15 capabilities; an MCP step (206) names a `tool_name` and has`
> `# no capability at all, and its closure is the PER-TOOL GRANT checked below — an ungranted`
> `# tool is refused there, by name, with an audit row.`
> `#`
> `# ⚠ THIS GUARD WAS SATISFIED BY ACCIDENT FOR THE LENGTH OF ONE PHASE … A default is not a`
> `# way through a gate.`

**What a plan must preserve here:**

1. **Both closures, each on its own terms.** The `elif` is not dead code for legacy rows — it is the
   *only* thing standing between an unknown capability and `get_adapter()` at `:2547`.
2. **No default on `capability`.** Restoring one re-creates the measured defect where an MCP step
   arrived claiming to be an email step.
3. **The per-capability config match at `:2453-2465`** (`getattr(connection,"capability",capability) != capability`
   → `_record(...)`) — its own WR-03 comment records that this used to raise a bare `ValueError`,
   which is not an `AdapterError`, so the handler never caught it and the run died stack-trace-shaped.
4. **D-14: seven executors in, seven out.** The registry is `PHASE_TYPE_REGISTRY_ENTRIES` at
   `phase_types.py:2595`, with `"external_action": _exec_external_action` at `:2605`. A service-shaped
   connection is dispatched by the **existing** `_exec_external_action`, never by a new entry.
5. **Gate 6's grant check (`:2470-2504`) reads `tool_grants` only.** Adding `discovered_tools` to a
   legacy row does **not** grant anything — the grant is a separate column and `grants.get(name) is True`
   denies on a missing key. That is the desirable direction (SEED-207's *"consent win"*), but it means
   a legacy connection whose descriptor lists `send_email` is **not** thereby MCP-dispatchable, and
   nothing about the native path changes. State this in the plan so nobody "wires it up."

### F.2 · Tests over the affected surfaces

**Backend** (`backend/tests/unit/`, case counts by `def test_`):

| File | cases | Disposition |
|---|---|---|
| `test_189_external_action_model.py` | 9 | ⚠ `:340`, `:376`, `:414` are the closed-set fence. **Must stay green untouched** unless §C.3's RED-first path is entered |
| `test_190_connectors_api.py` | 11 | **Will legitimately change** — a third shape is a new accepted body |
| `test_190_connector_check.py` | 12 | Likely changes if the check route gains a third arm (§E.4) |
| `test_190_credentials.py` | 8 | Should stay green — secret handling is untouched |
| `test_190_cross_org_credential.py` | 3 | **Stay green untouched** (D-14 tenant scope) |
| `test_190_ctx_org_scoping.py` | 3 | **Stay green untouched** |
| `test_190_egress.py` / `_ordering.py` | 25 / 5 | **Stay green untouched** — no egress change in scope |
| `test_190_slack_ok_false.py` | 18 | **Stay green untouched** — the verdict contract is unchanged |
| `test_190_jira_adapter.py` | 17 | **Stay green untouched**; may GAIN a descriptor↔`INPUT_SCHEMA` agreement case |
| `test_190_smtp_header_injection.py` | 13 | **Stay green untouched** |
| `test_190_connector_source_fence.py` | 8 | ⚠ source fences over the adapter files — a descriptor added *inside* an adapter module may trip one. Read before choosing the descriptors' home |
| `test_190_residual_fence.py` / `_ssti_fence.py` | 5 / 9 | Fences; read before moving code |
| `test_190_review_fix_data_layer.py` / `_executor.py` | 8 / 8 | `connector_service` + executor — **will change** |
| `test_mcp_connector_client.py` | **21** | **Will legitimately change** — D-211-09 widens the sanitizer. ⚠ The RED-first case is *"a server-controlled key that is NOT on the list is still dropped"*, not *"`title` survives"* |
| `test_103_grounding_fidelity.py` | — | `:373-378` asserts `len(EXTERNAL_ACTION_CAPABILITIES) == 3`. **Stay green untouched** |
| `test_185_detection.py` | — | `:305-339` re-derives the set and the disjointness. **Stay green untouched** |
| `test_189_no_egress.py` | — | ⚠ sweeps every line under `backend/app` for the three-letter protocol acronym. **A descriptor docstring must not spell it** — `connectors/protocol.py:4-14` states the rule and the workaround (write the expansion) |

**Frontend** (`frontend/src/`, `it(`/`test(` counts):

| File | cases | Gate pin |
|---|---|---|
| `settings/__tests__/ConnectionFormPanel.test.tsx` | 115 | pinned **63** (`vitest-count-gate.cjs:1744`), file-listed `:3310` — **will change** |
| `settings/__tests__/ConnectionsTab.test.tsx` | 67 | pinned **36** (`:1677`), listed `:3294` — may change |
| `settings/__tests__/connectionMark.test.tsx` | 25 | pinned **39** (`:1695`), listed `:3340` — may change |
| `workflows/ConnectionPicker.test.tsx` | 47 | pinned **58** (`:1643`) — **will change** |
| `workflows/ExternalActionSection.test.tsx` | 56 | pinned **25** (`:1608`, a known long-standing +9 drift) — **will change** |
| `workflows/phaseVocabulary.test.ts` | 110 | pinned **117** (`:266`) — may change |
| `workflows/McpToolPicker.test.tsx` / `.reachability.test.tsx` | — / 11 | pinned **29** / **11** (`:2705-2706`) — ⚠ reachability is *"the pin that matters most"* per its own comment |
| `workflows/toolReadOnlyMap.test.ts` | 7 | covered by the `src/components/workflows` directory target (`:3078`) |

⚠ **`src/components/workflows` is a DIRECTORY target** (`vitest-count-gate.cjs:3078`), so every
workflows suite is gated automatically. **`src/components/settings` is NOT** — only the three named
files at `:3294`, `:3310`, `:3340` are. A new settings test file needs **both knobs** (the pin *and*
the file list), a rule the gate's own comments state at `:1683-1695`.

### F.3 · `live_connectors` — the file fence with Phase 210

| File | 211 or 210? |
|---|---|
| `backend/app/api/connectors.py` `:14`, `:88-89`, `:349`, `:385`, `:427`, `:451` | **211** |
| `backend/app/services/harness/phase_types.py` `:2027-2031`, `:2237`, `:2381-2391` | **211** |
| `backend/app/models/user_settings.py:1214` (`"live_connectors": "off"`) | ⚠ **neither list names it.** It is the cold-default registry. If 211 needs to touch it, it goes on the bus |
| `backend/app/api/admin.py:119` (`_VISIBILITY_FEATURES`) | **210** — do not touch |
| `frontend/src/components/settings/{connectionsCopy,connectionFormCopy,connectionRefusalCopy,ConnectionsTab,ConnectionFormPanel}.tsx/.ts` | **211** (all of `components/settings/`) |
| `frontend/src/components/admin/` | **210** |

Per CONTEXT and `AGENTS.md §3.1`: **a split seam owes an integration test that mocks NEITHER side**,
and that test is a blocking gate.

### F.4 · G-5 hot-file status (from `211-MEASUREMENTS.md` §2 — already measured, not re-derived)

| File | triple | G-5 | Ledger row? |
|---|---|---|---|
| `harness/phase_types.py` | 45 / 20 / 2621 | **FIRES** | yes |
| `harness/grounding.py` | 19 / 6 / 1311 | **FIRES** | yes |
| `models/connector.py` | 4 / 2 / 346 | no | **no** |
| `services/mcp_client.py` | 2 / 2 / 367 | no | **no** |

⚠ Not in the measurement pack but in this phase's blast radius and **absent from the ledger**:
`backend/app/api/connectors.py`, `backend/app/services/connector_service.py`,
`backend/app/services/connectors/{registry,protocol,slack_adapter,jira_adapter,smtp_adapter}.py`,
`frontend/src/components/settings/connectionRefusalCopy.ts`,
`frontend/src/components/workflows/toolReadOnlyMap.ts`. Two of them
(`settings/ConnectionsTab.tsx` 8/3, `settings/ConnectionFormPanel.tsx` 5/3,
`settings/connectionsCopy.ts` 4/3, `settings/connectionFormCopy.ts` 4/3) **already have rows that
FIRE at exactly the threshold** per CLAUDE.md's ledger. The phase itself is the refactor
(ROADMAP Flags), which is how G-5 is honoured — but the rows need updating in the same commit
(CLAUDE.md's same-commit sync rule).

---

## G · MCP spec check (provider-docs-first)

**Source:** MCP specification `2025-06-18`, *Server / Tools*, § Data Types → Tool.
`[CITED: modelcontextprotocol.io/specification/2025-06-18/server/tools]`

> A tool definition includes:
> * `name`: Unique identifier for the tool
> * `title`: Optional human-readable name of the tool for display purposes.
> * `description`: Human-readable description of functionality
> * `inputSchema`: JSON Schema defining expected parameters
> * `outputSchema`: Optional JSON Schema defining expected output structure
> * `annotations`: optional properties describing tool behavior

**D-211-09 is spec-correct.** `title` and `outputSchema` are the exact field names, in exactly that
casing (camelCase, matching `inputSchema`). The spec's own worked example carries both:

```json
{
  "name": "get_weather_data",
  "title": "Weather Data Retriever",
  "description": "Get current weather data for a location",
  "inputSchema": { "type": "object", "properties": { "location": { "type": "string" } }, "required": ["location"] },
  "outputSchema": { "type": "object", "properties": { "temperature": { "type": "number" }, … }, "required": ["temperature","conditions","humidity"] }
}
```

**D-211-10's rule is the spec's own, stated as a `MUST`:**

> **Warning** — For trust & safety and security, clients **MUST** consider tool annotations to be
> untrusted unless they come from trusted servers.

And on `outputSchema`, the spec assigns the obligations D-211-09 depends on:

> If an output schema is provided: Servers **MUST** provide structured results that conform to this
> schema. Clients **SHOULD** validate structured results against this schema.

⚠ **Two spec facts the plan should not discover late:**

1. **`tools/list` is paginated** (`params.cursor`, `result.nextCursor`). `mcp_client.list_tools`
   (`:246-305`) sends `params={}` and never reads `nextCursor` — so a server with more tools than
   one page silently returns a truncated list. Out of scope for 211, but D-211-09 is the last time
   anyone will be inside this function before Phase 212 renders the list as a catalog. Worth a seed.
2. The sanitizer's current `annotations` passthrough (`:296-302`) forwards the **whole dict**
   verbatim. Widening to `title` / `outputSchema` should keep the same discipline the existing keys
   use — coerce `title` to a stripped `str` and require `outputSchema` to be a `dict`, matching
   `:288-291`'s treatment of `inputSchema` — rather than a bare `item["title"]` read.

---

## H · Candidate replacements for the dropped CHECK (D-211-04) — **tradeoff, not a choice**

The property to preserve, in migration 126's own words: refuse *"a connection that resolves to
nothing, listed in every picker."* The property to newly admit: an OAuth row with **neither**
`capability` **nor** `mcp_server_url`.

Assume the service identifier column is named `service_id text` for the SQL below; the name is
Claude's discretion (D-211's discretion list).

### Candidate 1 — identity is mandatory; that IS the guarantee

```sql
ALTER TABLE public.connector_connections
    DROP CONSTRAINT IF EXISTS connector_connections_shape_is_one_of_two;

ALTER TABLE public.connector_connections
    ADD CONSTRAINT connector_connections_has_a_service_identity
    CHECK (service_id IS NOT NULL AND length(btrim(service_id)) > 0);
```

| | |
|---|---|
| **Admits** | any row naming a service — OAuth (no capability, no URL), MCP, legacy capability |
| **Refuses** | a row with no identity at all. A picker can always render *something* true |
| **Does NOT refuse** | a row with an identity and **no way to reach the service** — no adapter, no URL, no credential. That is precisely *"resolves to nothing"* wearing a name |
| **Migration cost** | needs the backfill (D-211-03) to complete before the constraint is added, and `NOT VALID` + `VALIDATE CONSTRAINT` is unnecessary at 3 rows |
| **Reads as** | *"every connection is a service"* — the cleanest statement of the phase's thesis |

### Candidate 2 — identity **plus** a reachable shape, with an explicit auth-kind

```sql
ALTER TABLE public.connector_connections
    ADD COLUMN IF NOT EXISTS auth_kind text;   -- e.g. 'static' | 'oauth' | 'none'

ALTER TABLE public.connector_connections
    ADD CONSTRAINT connector_connections_resolves_to_something
    CHECK (
        service_id IS NOT NULL AND length(btrim(service_id)) > 0
        AND (
            capability      IS NOT NULL      -- a first-party adapter can reach it
         OR mcp_server_url  IS NOT NULL      -- a remote server can reach it
         OR auth_kind       = 'oauth'        -- 215 will supply the endpoint
        )
    );
```

| | |
|---|---|
| **Admits** | all three of today's shapes plus the OAuth shape, each *named* |
| **Refuses** | an identified row that is none of the three — i.e. it preserves the original guarantee literally |
| **Cost** | ⚠ **it re-introduces a closed set** (`auth_kind`), on a new axis, which is the shape D-211-01 rejected for `service_id`. Whether that is the same mistake or a legitimately different one is a judgement the planner must make and record |
| **Also** | a second column ⇒ a second `GRANT SELECT` line and a second `ConnectorConnectionResponse` field (§E.2) |
| **Sequencing** | `auth_kind` is Phase 215's vocabulary. Committing it here is *committing the connection shape twice*, which `SEED-146` names as the expensive mistake |

### Candidate 3 — identity mandatory, **plus** a narrow "not-yet-reachable" carve-out with an expiry

```sql
ALTER TABLE public.connector_connections
    ADD CONSTRAINT connector_connections_has_a_service_identity
    CHECK (service_id IS NOT NULL AND length(btrim(service_id)) > 0);

-- Second, INDEPENDENT constraint: the two reachable shapes may not BOTH be present.
-- (The pre-211 table could not express this; two shapes on one row is a dispatch ambiguity —
--  `phase_types.py:2311-2322` branches on `mcp_tool_name` FIRST, so a row carrying both would
--  silently take the MCP path and the capability would go inert.)
ALTER TABLE public.connector_connections
    ADD CONSTRAINT connector_connections_shape_is_not_ambiguous
    CHECK (NOT (capability IS NOT NULL AND mcp_server_url IS NOT NULL));
```

| | |
|---|---|
| **Admits** | everything Candidate 1 admits |
| **Refuses** | additionally, a row that is **both** shapes at once — a guarantee the table has never had and which the executor's branch order silently depends on |
| **Cost** | still does not refuse *"resolves to nothing"* |
| **Bonus** | ⭐ closes a real, currently-representable ambiguity: nothing today stops an `UPDATE` from setting both columns. Verified: the live table has no such constraint (§D.2) |

**Recommendation for the planner's decision, not a decision:** Candidates 1 and 3 are compatible and
stack; Candidate 2 is the only one that literally preserves the *"resolves to something"* guarantee,
and it does so by paying `SEED-146`'s named price. Whichever is chosen, **D-211-04 requires the
migration to STATE the replacement in its own comment block**, in migration 126 §2's style — an
uncommented relaxation is the failure mode 126 was written to prevent.

⚠ **Also required by D-211-04's "at the database, not only in Pydantic":** whatever CHECK is chosen
must have a matching arm in `_validate_connection_shape` (§E.3) — the model is not the gate, but a
model that is *laxer than the database* produces a 500 instead of a 422.

---

## I · Don't hand-roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Declaring each adapter's required arguments | a new `REQUIRED_ARGS` constant, or `inspect.signature` reflection | **`Adapter.INPUT_SCHEMA["required"]`**, already frozen `MappingProxyType`s at `slack:372` / `jira:422` / `smtp:296` | D-211-05 rejects reflection; and a parallel constant is a fourth spelling with nothing holding it in agreement |
| A "descriptor ↔ adapter" agreement check | a doc note, a review checklist | a **module-scope `assert`** in the descriptors' module, in the shape of `registry.py:58-64` | The house rule (`registry.py:1-9`, `models/harness.py:230-234`): *"the agreement is MECHANICAL rather than remembered"* |
| Keeping the response projection in sync with the table | a hand-maintained column list in the router | `_RESPONSE_KEYS` → `_SELECTABLE_COLUMNS` (`connector_service.py:139`) — **already derived** from the response model | `models/connector.py:10-14` states this is the enforcing surface for T7 |
| Reading a key off a plain object literal in TS | `MAP[key] ?? fallback` | **`own(MAP, key)`** from `ownProperty.ts` | Nine measured live sinks in this tree; `ConnectionPicker.tsx:198-212` documents the ninth |
| Inferring whether a tool writes | a regex over the tool name | **`annotations.readOnlyHint`, explicit boolean only, fail closed** | `toolReadOnlyMap.ts:22-25`: `get_user_and_purge_records` rendered *ONLY READS* while deleting |
| Merging `tool_grants` client-side from local state | `useState` copy | the server-owned prop, whole-map PATCH | `McpToolPicker.tsx:250-272` — the write is a whole-column REPLACE (`connector_service.py:791`) |

---

## J · ⚠ Measurement contradicts / qualifies a locked decision

### J.1 · D-211-03 — **"the three legacy rows" is not what is on this box**

`D-211-03` and the ROADMAP both speak of backfilling *"every existing row"*, derived from
`capability` → `slack` / `jira` / `smtp`. **Measured (§D.3): the local DB has THREE rows total —
`post_message` × 1, `create_ticket` × 1, and one NULL-capability MCP row. There is no `send_email`
row.**

This does **not** invalidate the decision — the backfill must be total over `capability` regardless
of what happens to be present, and `smtp` must be in the mapping because cloud may differ. What it
*does* invalidate is a **verification plan that assumes three legacy connections exist to re-drive**.
SC#2 (*"a Slack / Jira / SMTP connection created before this phase still sends, unchanged"*) can be
driven for Slack and Jira from existing rows; **the SMTP arm needs a row to be created first, or it
must be recorded ⛔ with the reason** (the UAT scoreboard rule: *"rows may be blocked, but never
silently omitted"*). Cloud parity must be checked separately before the migration is promoted.

### J.2 · CONTEXT's Integration Points — **five spellings / three asserts under-counts by two/two**

Measured at HEAD: **seven backend spellings, five module-scope asserts** (§C.1). The two extra are
`connectors/registry.py:48-64` and `phase_types.py:2039-2059`. `registry.py`'s own docstring names
itself *"the SIXTH consumer"*, so this is not a new drift — it is a count that was already known in
one file and did not reach CONTEXT. **Direction of error: more work, never less.** Every one of them
is an import-time `assert`, so a plan that misses one produces an `ImportError` for the whole app at
first import — loud, not latent.

### J.3 · CONN-08 is gated TWICE — the migration alone does not satisfy SC#4

`models/connector.py:257-258` raises `"Either capability or mcp_server_url must be provided"` before
any INSERT is attempted. **Dropping the DB CHECK makes the row *storable*; it does not make it
*savable* through the API**, which is what SC#4's "saves successfully" means to a user. §E.3.

### J.4 · D-211-05's "indistinguishable downstream" is FALSE at one reader today

`McpToolPicker.tsx:302` — `if (!connection?.mcp_server_url) return null` — and the picker's own shape
filter at `ConnectionPicker.tsx:436`. A legacy row with a perfect descriptor renders no tool list.
§A.6. Whether closing that is 211's minimum UI or 212's catalog work is D-211-07's line and the
planner's call; it is flagged here so it is not discovered at UAT.

### J.5 · `canvasModel.ts` carries zero verb literals

CONTEXT's Integration Points names `workflows/{ConnectionPicker,canvasModel,definitionOps}`.
`grep -c "send_email\|create_ticket\|post_message" src/components/workflows/canvasModel.ts` → **0**.
Its test file has 3. Minor, but a plan that budgets a task for it will find nothing to do.

---

## K · Validation Architecture

### K.1 · Test framework

| Property | Backend | Frontend |
|---|---|---|
| Framework | `pytest` | `vitest` + `@testing-library/react` (jsdom) |
| Config | `backend/pytest.ini` / `pyproject` | `frontend/vitest.config.ts`; gate `scripts/vitest-count-gate.cjs` |
| Quick run | `cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/<file> -q` | `cd frontend && npx vitest run src/components/<dir> --reporter=basic` |
| Full suite | `cd backend && python -m pytest tests/unit -q` | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` **from the repo root** |
| Typecheck | — | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` (⚠ **the `-p` flag is load-bearing — without it tsc checks ZERO files**) |

**Baselines (from `211-MEASUREMENTS.md` §1, untouched tree — do NOT re-derive):**
tsc **34 errors** · count gate **OK, 114/114 pinned, total 5793, 0 failed** · backend unit
**68 failed / 2680 passed** (rot set 68) · CLAUDE.md **83,431 chars, 55.6%**.

### K.2 · Phase requirements → test map

| SC | Behavior to prove | Type | Automated command | Exists? |
|---|---|---|---|---|
| **SC#1** | The three-verb `<select>` is gone from the create flow | unit (FE) | `npx vitest run src/components/settings/__tests__/ConnectionFormPanel.test.tsx -t "capability"` | ✅ suite exists — **assertion must invert**: `queryByTestId("connection-capability-chooser")` → `toBeNull()` |
| **SC#1** | Actions offered come from the connection's own advertised tools | unit (FE) | `npx vitest run src/components/workflows/McpToolPicker.reachability.test.tsx` | ✅ 11 cases; ⚠ **needs a legacy-shaped fixture** (a connection with `discovered_tools` and **no** `mcp_server_url`) — that fixture does not exist today |
| **SC#1** | A static descriptor is byte-shaped like a sanitized MCP tool | unit (BE) | `pytest tests/unit/<new>_211_static_descriptors.py -q` | ❌ **Wave 0** |
| **SC#1** | The descriptor's `required` array equals the adapter's `INPUT_SCHEMA["required"]`, for **all three**, derived not retyped | unit (BE) | same file | ❌ **Wave 0** — this is the mechanical-agreement assert (§I) |
| **SC#2** | Slack still sends: `ok:true` ⇒ `AdapterResult.ok` | unit (BE) | `pytest tests/unit/test_190_slack_ok_false.py -q` | ✅ 18 — **must stay green untouched** |
| **SC#2** | Jira / SMTP argument refusals unchanged | unit (BE) | `pytest tests/unit/test_190_jira_adapter.py tests/unit/test_190_smtp_header_injection.py -q` | ✅ 17 + 13 — green untouched |
| **SC#2** | The executor's two-shape branch still refuses an unknown capability | unit (BE) | `pytest tests/unit/test_190_review_fix_executor.py -q` | ✅ 8 — will change; the refusal case must remain |
| **SC#2** | A legacy row **presents** as a service with named actions | integration (BE+FE, mocks neither side — `AGENTS.md §3.1`) | new | ❌ **Wave 0** |
| **SC#3** | No `Message`/`Ticket`/`Email` category is offered anywhere | unit (FE), **negative fence** | `npx vitest run src/components/settings src/components/workflows -t "category"` | ❌ **Wave 0** — a source/DOM sweep asserting the three words never appear as an option/chip/tab label. ⚠ Model it on the existing `?raw` cross-language fence in `ExternalActionSection.tsx:38` rather than inventing one |
| **SC#3** | The picker's read is no longer capability-scoped | unit (FE) | `npx vitest run src/components/workflows/ConnectionPicker.test.tsx` | ✅ 47 — **will change**; assert `listConnectorConnections` is called with **no** capability argument |
| **SC#4** | A row with neither capability nor MCP URL is ACCEPTED by the DB | integration (DB) | `psycopg2` INSERT against `127.0.0.1:54322`, post-migration | ❌ **Wave 0** — ⚠ must be driven **RED before** migration 127 (today the CHECK refuses it) so the green is attributable |
| **SC#4** | The same row is accepted through `POST /connectors/connections` | unit (BE) | `pytest tests/unit/test_190_connectors_api.py -q` | ✅ 11 — **will change**; the RED-first case is `_validate_connection_shape` raising `"Either capability or mcp_server_url must be provided"` (§E.3 / §J.3) |
| **SC#4** | A row that resolves to nothing is STILL refused | unit (BE), **negative control** | same file | ❌ **Wave 0** — without this, SC#4's green proves only that the guarantee was deleted |
| **D-211-09** | An off-list, server-controlled key is still DROPPED | unit (BE), **negative control** | `pytest tests/unit/test_mcp_connector_client.py -q` | ✅ 21 — **will change**. ⚠ The load-bearing case is the *drop*, not the *carry* |
| **D-211-10** | An absent `readOnlyHint` still fails CLOSED | unit (FE) | `npx vitest run src/components/workflows/toolReadOnlyMap.test.ts` | ✅ 7 — green untouched |
| **Closed set** | Seven spellings agree; an outside value is refused | unit (BE), import-time | `pytest tests/unit/test_189_external_action_model.py tests/unit/test_103_grounding_fidelity.py tests/unit/test_185_detection.py -q` | ✅ green untouched (see §C.3) |
| **Column grant** | `GET /connectors/connections` still returns 200 after the new column | manual/UAT | load Settings → Connections in the browser | ⚠ **The 42501 failure looks like an outage, not a missing column** (mig 126 §3). Put it on the scoreboard |

### K.3 · Sampling rate (Nyquist)

- **Per task commit** — the suite(s) the task's `files_modified` touch, only:
  `pytest tests/unit/<the touched files> -q` and/or
  `npx vitest run <the touched dir> --reporter=basic`. Under 30 s.
- **Per wave merge** — backend `python -m pytest tests/unit -q` (compare against the **68**-failure
  rot baseline, per-file, never against 0) **and**
  `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root, reading the
  **verdict line verbatim**. Plus `npx tsc --noEmit -p tsconfig.app.json` against the **34** baseline.
- **Migration wave — an extra sample, not the same one.** The DB shape must be sampled *twice*:
  RED before the migration (SC#4 INSERT refused) and green after (accepted, negative control still
  refused). A single post-migration sample cannot distinguish *"the constraint was replaced"* from
  *"the constraint was deleted."*
- **Phase gate** — full backend suite at or below the 68 rot set with **no new failing file**;
  count gate `OK` with **no per-file decrease**; tsc ≤ 34; then `/gsd:verify-work`.
- ⚠ **A red count-gate run is not automatically a flake.** Capture failing filenames from the gate's
  own persisted JSON **before re-running anything**, check each against `git diff --numstat`, and
  only then compare against SEED-171's five known-flaky suites. `WorkflowsPage.test.tsx` /
  `WorkflowCard.test.tsx` / `WorkflowBuilderPage.{session,canvas}.test.tsx` /
  `WorkflowRunPage.test.tsx` are the five. **Do not reach for the worker cap.**

### K.4 · Wave 0 gaps

- [ ] `backend/tests/unit/test_211_static_descriptors.py` — descriptor shape + `required` agreement
      with all three `INPUT_SCHEMA`s (SC#1, D-211-05, D-211-06)
- [ ] A **DB-level** SC#4 case (RED before mig 127, green after) + its *resolves-to-nothing* negative
      control
- [ ] A **negative fence** over the three category words in the FE (SC#3)
- [ ] A legacy-shaped connection fixture (`discovered_tools` present, `mcp_server_url` absent) —
      needed by SC#1's FE cases and by §A.6 / §J.4
- [ ] The **cross-plan integration test that mocks neither side** (`AGENTS.md §3.1`), since 211 and
      210 share a flag and the backend/frontend halves ship in different waves
- [ ] Gate bookkeeping: `settings/` needs **both knobs** for any new test file (`vitest-count-gate.cjs`
      pin map **and** the file list at `:3294`/`:3310`/`:3340`)

*(Framework install: none — pytest and vitest both ship.)*

### K.5 · UAT scoreboard note

CLAUDE.md's 4-axis cross-provider scoreboard rule is triggered by *"streaming, agent loop, provider
routing, or UI state."* This phase touches **none** of those — it is a connection-model refactor with
no model call anywhere in its blast radius (`phase_types.py:2288-2294`, D-22: *"a STEP the executor
performs, not a tool the LLM may call. No agent loop, no `tools_override`, no model call"*). **The
8-row roster does not apply.** What this phase owes instead is a **per-shape** scoreboard: legacy
capability × 3 (Slack ✅ has a row, Jira ✅ has a row, SMTP ⛔ no row — §J.1), MCP × 1 (DeepWiki),
service-only × 1 (new, CONN-08). Record the ⛔ with its reason; never drop the row.

---

## Project Constraints (from `CLAUDE.md`)

| Directive | Bearing on this phase |
|---|---|
| Python backend must use a `venv` | `backend/venv/Scripts/python.exe` — the system Python has no `psycopg2` (measured) |
| No LangChain / LangGraph; raw SDK only | no bearing (no model call in scope) |
| Pydantic for structured outputs | `models/connector.py` is the gate, and `extra='forbid'` everywhere |
| **All tables need RLS** | `connector_connections` has four policies (mig 116 §3). A new column changes no policy — but it **does** need a column-level `GRANT SELECT` (§E.2) |
| **Migrations: numbered `<digits>_name.sql`, applied by PASTING into the Supabase SQL editor. NEVER `supabase db push` / `db reset`.** Then `bash scripts/regenerate-full-schema.sh`. Never hand-edit `full-schema.sql` | §D.4 — must appear in the migration task's own text |
| Deployment-artifact parity (same-commit rule) | Migration 127 is **seed-bearing** (it backfills). Check `scripts/check-deploy-drift.sh` / `docs/OPERATOR.md` Step-3 seed list. A new env var: none expected |
| Hot-file ledger + G-5 | §F.4. The phase IS the refactor; ledger rows and `docs/HOT-FILE-LEDGER.md` sections update in the **same commit** |
| `docs/CONNECTOR-ARCHITECTURE.md` records the MCP-first verdict | The one file where the protocol acronym may be spelled; `backend/app` may not (`test_189_no_egress.py`, `connectors/protocol.py:4-14`) |
| Provider-docs-first | §G — the MCP spec was read for D-211-09 / D-211-10 rather than recalled |
| Worktrees ENABLED; `bash scripts/bootstrap-worktree.sh "$(pwd)"` FIRST; `GSD_VITEST_MAX_WORKERS=2`; **never `rm -rf` a worktree** | Applies to every parallel plan. ⚠ **Serialize any plan whose tests mutate the local DB** — the migration wave and any `psycopg2`-driven case are exactly that |
| G-7 gap-closure round cap | `node scripts/check-gap-closure-rounds.cjs 211` before any `--gaps` routing |
| Reported bugs + seeds sweep | Already supplied in `211-MEASUREMENTS.md` §3-4; `BUG-260826-01/-02/-05` are folded into **214**, `BUG-260810-01` into **212** — **none is 211's to close.** D-211-06 pre-pays 214 |

---

## Package Legitimacy Audit

**No external packages are installed by this phase.** Every dependency it touches — `httpx`,
`pydantic`, `psycopg2`, `pytest`, `vitest` — already ships in `backend/requirements.txt` /
`frontend/package.json`. The Package Legitimacy Gate is **not applicable**; no `slopcheck` run is
owed, and no `checkpoint:human-verify` install task should appear in any plan.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | The service identifier column is named `service_id text` in the candidate SQL | §H | **Naming only** — D-211's discretion list makes the name Claude's call. The SQL's *shape* does not depend on it |
| A2 | Cloud `connector_connections` holds the same three rows as local | §D.3, §J.1 | A cloud row with a shape local does not have could fail the backfill or the new CHECK. **Verify before promoting** — CLAUDE.md's standing cloud-parity rule |
| A3 | `docs/CONNECTOR-ARCHITECTURE.md` and the deploy-drift script need no edit | Project Constraints | A missed same-commit artifact → CI `deploy-artifacts` failure. Cheap to check; not checked here |
| A4 | The descriptors' home is a new module under `services/connectors/` | §I, §F.2 | `test_190_connector_source_fence.py` (8 cases) asserts things *about the adapter files*. A descriptor placed inside an adapter module may trip it. **Read that file before choosing** |
| A5 | `models/user_settings.py:1214` (`live_connectors` cold default) is not needed by either phase | §F.3 | A silent 210/211 collision on an unfenced file. Post to the bus if it is needed |

---

## Open Questions (ALL RESOLVED at plan-phase, 2026-08-26)

> **RESOLVED — Q1:** the class-attribute design was **REJECTED** by the planner; descriptors live in
> `connectors/descriptors.py` with `inputSchema` DERIVED through a function-body `get_adapter`
> import, because a module-scope assert in `registry.py` would drag the vendor modules into the cold
> import graph and turn `test_no_vendor_module_enters_the_import_graph_until_a_send_happens`
> (`test_190_connector_source_fence.py:426`) RED. **Verified present in the tree.**
> **RESOLVED — Q2:** adopted (write at migration AND assert agreement in code; staleness window
> stated in the migration comment) — and hardened at revision iteration 1 into migration 127 §2b's
> backfill plus the cross-language fence `test_the_sql_backfill_matches_the_python_descriptor`.
> **RESOLVED — Q3:** adopted — keep the `?capability=` parameter, stop calling it.
> **RESOLVED — Q4:** out of scope; planted as a seed rather than folded in.

> ⚠ **One correction to this file, found at planning:** the three-letter-acronym fence
> `test_189_no_egress.py::test_no_mcp_identifiers_in_backend_app` is **RETIRED** (`:249-257` — the
> docstring says so and the body only asserts `mcp_client is not None`). An executor owes it no effort.

1. **Where do the static descriptors live?**
   - Known: they must be byte-compatible with `discovered_tools` (D-211's discretion), and the
     agreement with `INPUT_SCHEMA` must be a module-scope `assert` (§I).
   - Unclear: a new `services/connectors/descriptors.py` vs. a `TOOL_DESCRIPTOR` class attribute on
     each `Adapter` beside `INPUT_SCHEMA`. The latter is closer to the seam's *"borrowed properties"*
     framing (`protocol.py:27-38`) and cannot drift; the former is one file to review.
   - Recommendation: **class attribute on each Adapter**, with a single derived assert in
     `registry.py` (the file that already owns capability↔adapter agreement). ⚠ Read
     `test_190_connector_source_fence.py` first (A4).

2. **Are descriptors WRITTEN to the row, or COMPUTED at read time?**
   - Known: **read-time branching is explicitly rejected** (D-211-03).
   - Unclear: writing them into `discovered_tools` at migration time makes legacy rows literally
     indistinguishable — but it also makes the descriptor a *copy* that can go stale when an
     adapter's `INPUT_SCHEMA` changes, with nothing holding the row in agreement with the code.
   - Recommendation: **write at migration AND assert agreement in code**, plus a re-write on the
     next `PATCH` of the row. State the staleness window in the migration comment rather than
     leaving it to be discovered.

3. **Does the `?capability=` query parameter get removed, deprecated, or kept?**
   - Known: `ConnectionPicker.tsx:459` is the only caller that passes it; `api/connectors.py:297-306`
     documents it as *"the picker's per-capability read"*, backed by mig 116's index.
   - Recommendation for the planner: **keep the parameter, stop calling it.** Removing a public query
     param is an API break for no gain, and the index can be dropped later once the read pattern has
     actually changed. This also keeps `test_190_connectors_api.py`'s existing cases meaningful.

4. **`tools/list` pagination** (`nextCursor`) is unhandled at `mcp_client.py:246-305`. Out of scope,
   but D-211-09 is the last visit to this function before Phase 212 renders the list as a catalog.
   Recommendation: **plant a seed** rather than fold it in.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Local Supabase Postgres @ `127.0.0.1:54322` | migration 127 + the DB-level SC#4 case | ✅ | connected; 3 rows read | — |
| `psycopg2` | driving the DB case | ✅ **only in `backend/venv`** | — | ⚠ system Python raises `ModuleNotFoundError` — **use `backend/venv/Scripts/python.exe`** |
| Supabase CLI | `regenerate-full-schema.sh` | assumed ✅ (script guards with `command -v supabase`) | — | script exits with a named error |
| Docker | `pg_dump` inside the container, for the regen | assumed ✅ | — | ⚠ `docker` is DENIED to the agent — the regen is an **operator step** |
| `node` + `npx` | count gate, tsc, vitest | ✅ | — | — |
| Slack / Jira / SMTP live credentials | SC#2 send-unchanged UAT | ⚠ Slack + Jira rows exist; **SMTP row does not** | — | record SMTP ⛔ with reason (§J.1) |
| A reachable MCP server | sanitizer widening UAT | ✅ `https://mcp.deepwiki.com/mcp` (row `7ca5e114…`, 3 tools) — ⚠ **sends no `annotations`**, so it cannot exercise D-211-10's carry path | — | a fixture, for the annotations arm |

**Missing with no fallback:** none.
**Missing with fallback:** SMTP credential (record ⛔); an `annotations`-emitting MCP server (fixture);
`docker` for the schema regen (operator step).

---

## Security Domain

`security_enforcement` is not set to `false`, so this section applies.

### Applicable ASVS categories

| ASVS | Applies | Standard control in this tree |
|---|---|---|
| V2 Authentication | no (215 owns OAuth) | — |
| V3 Session Management | no | — |
| **V4 Access Control** | **yes** | RLS (mig 116 §3) + `require_org_manage` + **column-level `GRANT SELECT`** (mig 118 / 126 §3). ⚠ **The new column's grant is an access-control change, not plumbing** |
| **V5 Input Validation** | **yes** | Pydantic `extra='forbid'` on every model; `NonEmpty` / `Port` constrained types (`models/connector.py:84-92`); the free-text service identifier is **new untrusted input** and needs a length bound and a non-empty constraint at BOTH the model and the DB |
| **V6 Cryptography** | **yes (unchanged)** | `secret_cipher.encrypt_secret` / `enc:v1:`; **never hand-rolled**. This phase must not touch it |
| V7 Error handling / logging | yes | `ResolvedConnection.__repr__` redacts (`connector_service.py:261-268`); D-08 bars a credential or a request body from any receipt |
| V9 Communications | yes (unchanged) | `connector_connections_mcp_url_is_https` CHECK + `validate_mcp_destination` |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation, in this tree |
|---|---|---|
| **Constraint relaxation admits a shape nothing can refuse** | Tampering / DoS-by-data | Mig 126 §2's measured lesson. **State the replacement in the migration** (D-211-04) and add a *negative control* test (§K.2) |
| **A new column without its grant → total read outage** | DoS | Mig 126 §3, measured 503. `GRANT SELECT (col)` one per line, same migration |
| **Free-text identifier becomes a lookup key** | Injection / Tampering | Never interpolate it into SQL; it is a *parameterised* value. In TS, read it through `own(MAP, key)` — never `MAP[key]` on an object literal (nine measured `[Function Object]` sinks) |
| **Free-text identifier rendered unescaped** | XSS | React escapes by default; **no `dangerouslySetInnerHTML` may take this value** |
| **Server-controlled JSONB keys** | Tampering | D-211-09's allow-list. ⚠ **Widen, never remove**; the RED-first test is that an off-list key is still dropped |
| **Trusting `readOnlyHint` to widen a permission** | Elevation of Privilege | Spec `MUST` (§G). Fail closed: `toolReadOnlyMap.ts:58-60` records only an explicit boolean |
| **A default that walks through a gate** | Elevation of Privilege | `phase_types.py:2305-2310` — *"A default is not a way through a gate."* Do not restore a `capability` default |
| **Cross-org row read** | Information Disclosure | `_fetch_connection_row` is `WHERE id AND org_id`, never id alone (`connector_service.py:311-320`); `test_190_cross_org_credential.py` (3 cases) must stay green |
| **`live_connectors` fail-open** | Elevation of Privilege | `phase_types.py:2027-2031` asserts the constant is a governed feature, because `feature_audience` answers `"operators"` for an *unknown* feature — a typo would enable live sending everywhere |

---

## Sources

### Primary (HIGH confidence — read in this session)
- `supabase/migrations/126_mcp_connector_connections.sql` (full) · `116_connector_connections.sql:60-108`
- `backend/app/services/mcp_client.py` (full, 367 L)
- `backend/app/services/connectors/{protocol,registry,slack_adapter,jira_adapter,smtp_adapter}.py`
- `backend/app/services/harness/phase_types.py:2020-2160`, `:2288-2570`, `:2595-2610`
- `backend/app/services/harness/grounding.py:1120-1170`
- `backend/app/models/connector.py` (full, 346 L) · `backend/app/models/harness.py:215-300`
- `backend/app/services/connector_service.py:105-145`, `:200-320`, `:520-605`, `:737-800`
- `backend/app/api/connectors.py` (route map + `:273-320`, `:345-460`, `:603-660`)
- `backend/tests/unit/test_189_external_action_model.py:340-434`
- `frontend/src/lib/api/org.ts:378`, `:415-500`
- `frontend/src/components/settings/{ConnectionFormPanel.tsx,ConnectionsTab.tsx,connectionFormCopy.ts,connectionsCopy.ts,connectionMark.tsx,connectionRefusalCopy.ts}`
- `frontend/src/components/workflows/{ConnectionPicker,McpToolPicker,ExternalActionSection}.tsx`, `{phaseVocabulary,toolReadOnlyMap,definitionOps,canvasModel,nodeEffectBanner}.ts`
- `scripts/vitest-count-gate.cjs` (pin map + `TARGETS`) · `scripts/regenerate-full-schema.sh:1-60`
- `.planning/seeds/SEED-207-*.md` (full) · `.planning/REQUIREMENTS.md:25-45` · `.planning/ROADMAP.md` §Phase 211 · `AGENTS.md §3.1` · `CLAUDE.md`
- **Live DB** — `psycopg2` → `127.0.0.1:54322`: `information_schema.columns`, `pg_constraint`, and the three rows of `connector_connections`

### Primary (HIGH confidence — official spec)
- MCP specification `2025-06-18`, *Server / Tools* — `https://modelcontextprotocol.io/specification/2025-06-18/server/tools` (Tool fields; the annotations-are-untrusted `MUST`; the `outputSchema` obligations)

### Secondary (MEDIUM)
- `.planning/phases/211-.../211-CONTEXT.md`, `211-MEASUREMENTS.md` — upstream, treated as locked input

### Tertiary (LOW / unverified)
- Cloud `connector_connections` row set — **not measured** (A2). Verify before promoting migration 127.

---

## Metadata

**Confidence breakdown:**
- Standard stack — **HIGH.** No new packages; every library already ships and was read at HEAD.
- `discovered_tools` shape + readers — **HIGH.** Sanitizer read in full; a real object read from the live DB; all eight readers enumerated with line references.
- Adapter required args — **HIGH.** Three `required` arrays quoted from source; the `_adapter_args` one-field claim verified against the code, not inferred.
- The seven spellings / five asserts — **HIGH.** Each site opened and quoted; `registry.py` self-identifies as the sixth consumer.
- Migration candidates — **MEDIUM.** The SQL is correct and the tradeoffs are measured, but the choice is deliberately left open (D-211-04's *"say what replaces it"* is a decision, not a finding).
- Live row set — **HIGH locally, LOW for cloud.** See A2.
- MCP spec claims — **HIGH.** Read from the official 2025-06-18 spec page in this session.

**Research date:** 2026-08-26
**Valid until:** 2026-09-09 (14 days — the tree moves fast: `api.ts` measured 105 phases and the
count-gate total has rotted four times in eleven days. **Re-derive any line number before relying on
it in a plan task.**)
