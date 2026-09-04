# Phase 213: Per-Tool Grants and the Approval Moment - Context

**Gathered:** 2026-08-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Each tool of a connection is granted or denied **individually** — reads and writes in one list —
and a tool whose posture requires approval **stops the run and asks a real person**, naming the
service, the tool and the arguments, before anything leaves.

This phase is the milestone's **trust boundary** and a ⭐ **HARD PREREQUISITE for Phase 216**. The
standing project rule — *never add an outbound capability to `_TOOL_REGISTRY` before the approval
model exists* — is what this phase builds.

**In scope:** the grant/posture data model + migration; the grant list UI; the run-time approval
pause; the refusal; the audit receipt; the structural unlock that makes SC#1 satisfiable
(`SEED-214`); and closing the MCP-only gate (`BUG-260827-02`).

**Out of scope, and deliberately:** FILLING the tool lists (growing an adapter's action set,
adopting a new MCP server, an OpenAPI ingester) — that is per-service work which must FOLLOW the
approval model, never accompany it. Also out: the workflow AUTHORING surface (Phase 214), the chat
surface (Phase 216), and anything resembling an automatic or background sync (that leaves this
milestone entirely — `SEED-209/210/211/212`).

</domain>

<guardrails>
## Guardrails — surfaced BEFORE the feature, per the orchestrator protocol

**G-2 (sketch before plan for UX) — ✅ SATISFIED, and it is the acceptance bar.**
`.planning/sketches/213-grants-and-the-approval-moment/` — 66 passing assertions,
`BUILD-CONTRACT.generated.md` emitted *from* the running sketch, operator picks recorded.
Its §3 invariants are the suite's contract. **Do not re-litigate what it settled.**

**G-5 (refactor between feature waves) — FIRES ON SEVEN FILES in this blast radius. All seven were
re-derived on 2026-08-27 rather than read from the ledger, and THREE cells were stale:**

| file | ledger row said | **measured 2026-08-27** | |
|---|---|---|---|
| `frontend/src/components/settings/ConnectionFormPanel.tsx` | 9 / 5 / **2009** | 10 / 5 / **2124** | ⚠ stale, +115 L |
| `frontend/src/components/settings/connectionFormCopy.ts` | 7 / 5 / **968** | 8 / 5 / **1069** | ⚠ stale, +101 L |
| `backend/app/models/connector.py` | 6 / **3** / 468 | 6 / **4** / 468 | ⚠ stale, crossed |
| `backend/app/services/harness/phase_types.py` | 47 / 21 / 2664 | 47 / 21 / 2664 | ⚠ obligation reads **OWED** |
| `frontend/src/components/settings/ConnectionsTab.tsx` | 13 / 5 / 1414 | 13 / 5 / 1414 | ✅ current |
| `backend/app/api/connectors.py` | 7 / **3** / 781 | 7 / **4** / 781 | ⚠ stale |
| `backend/app/services/connector_service.py` | 7 / 3 / 1149 | 7 / 3 / 1149 | ✅ current |

Re-derive rather than trust these; the recipe is in CLAUDE.md's ledger preamble.

⚠ **The headline is `phase_types.py`.** CLAUDE.md's own row records the G-5 obligation there as
**"now OWED, not honoured"** since `BUG-260827-01` closed on 2026-08-27 — and Gate 6, the thing this
phase must rewrite, sits at line **2511** of that 2,664-line file.

**D-213-00 — the refactor is taken BY CONSTRUCTION, in two named cuts, and the plan must ARGUE
this rather than assume it:**

- **Backend cut.** The grant/posture decision leaves `phase_types.py` into a **leaf module**
  (`backend/app/services/connectors/grants.py`), called by *both* connection shapes. Follow the
  `backend/app/services/harness/human_input.py` precedent exactly: a verbatim move where possible,
  the re-import kept and load-bearing, and the honest leaf invariant stated at its real strength —
  **this module must never import `phase_types` back.** Fixing `BUG-260827-02` *in place* would grow
  the hottest file in the phase, which is the thing G-5 exists to prevent.
- **Frontend cut.** The 44-row grant list is a **new component**, not new lines in
  `ConnectionFormPanel.tsx` (2124 L). The sketch already forces this: `COPY.js` ports to
  `frontend/src/components/settings/grantsVocabulary.ts` and the build **imports** it.

**G-1 (phase chain cap)** — 213 is the second consecutive phase on `ConnectionFormPanel.tsx` /
`ConnectionsTab.tsx`. **Answered by the same two cuts.**

**G-4 (lived-experience UAT)** — operator-defined scenarios are owed at scope time, and ⚠ **must
cover BOTH surfaces AND both breakpoints** (see D-213-10 / R-1..R-3): a chat-only drive, or an
`lg`-only one, would miss the run-page conditions by construction.
Every G-4 row must name the sketch file as its reference and be driven by *looking*, never by
`getElementById`.

**G-6 (failure criteria upfront)** — the plan owes a `## How we'd know this failed` section.
Candidate observables are listed under `<failure_modes>` below.

</guardrails>

<decisions>
## Implementation Decisions

### The 1:1 unlock (SEED-214 — SC#1 is unsatisfiable without it)

- **D-213-01: Mechanism only — the lists gain nothing.**
  `backend/app/services/connectors/descriptors.py::static_descriptors_for_capability` today returns
  `[descriptor_for(capability)]` — *"One element, always."* It becomes able to return **N**. Slack,
  Jira and SMTP still show one action each, because that is all their adapters do. **SC#1 becomes
  satisfiable and the screen stays honest.** Growing an adapter's action set is per-service work
  that must FOLLOW the approval model — it is explicitly out of scope here.

- **D-213-02: Derive, do not store — descriptors stay computed, never persisted.**
  `discovered_tools` (jsonb) remains the **MCP** shape's home. A capability connection's action list
  is still computed from the adapter registry at read time, just no longer capped at 1. Both shapes
  are read through **one function**. Nothing to migrate, nothing to keep in sync, and an adapter
  change is instantly true — the same *computed never stored* rule Phase 187's node-face ladder
  follows. A stored copy of a derived fact goes stale the moment an adapter changes.

- **D-213-03: Identical apparatus at one row.** The grant screen for a 1-action Slack connection is
  the *same* screen as GitHub's at 44 — default-posture control, search, the action row with its
  posture and direction tag — just short. No threshold, no collapse. ⚠ Collapsing to a single switch
  would build UI on the coincidence `BUG-260827-02` says is about to stop being true.

- **D-213-04: The authoring surface stays in Phase 214.** `ConnectionPicker`, `McpToolPicker` and
  `ExternalActionSection` assume a capability connection has one implied action. **Do not fix that
  here.** Phase 214 *is* "A Step Names Its Service and Its Action" (STEP-01/STEP-06) and its stated
  dependency is *"Phase 213 — STEP-06 needs GRANTED tools as its vocabulary"*. 213 makes many-actions
  possible and gated; 214 makes an author pick one. Building it here is the G-7 failure mode.

### Posture storage and the migration (GRANT-01, GRANT-02)

- **D-213-05: Migrate `tool_grants` IN PLACE to a posture map.**
  `Record<string, boolean>` → `Record<string, "allow" | "ask" | "deny">`. Migration **128** rewrites
  `true` → `"allow"` and drops `false` keys (absence already carried that meaning). **One field, one
  reader, no drift possible.** ⚠ A parallel `tool_postures` column was rejected: two fields
  describing one fact, with nothing holding them in agreement, is how a lie ships — and neither
  could answer *"which wins when they disagree?"*
  ⚠ **Every shipped `=== true` read moves in the same commit.** Enumerate them; known sites include
  `phase_types.py` Gate 6, `ConnectionFormPanel.tsx`, `connectionFormCopy.ts`, `McpToolPicker.tsx`,
  `ConnectionPicker.tsx`, `api/connectors.py`, `models/connector.py`, `lib/api/org.ts` and their
  test pins.

- **D-213-06: Absent = INHERIT, and the connection default has an "Ask first" FLOOR.**
  ⚠ **This is the sharpest edge in the phase and it is a deliberate semantic flip.** Today an absent
  key means **DENY** — an asymmetry `descriptors.py`'s docblock names as the desirable safe direction
  (T-211-05). Under GRANT-02 an absent key must mean **inherit the connection default**, because the
  sketch's `OVERRIDDEN_LABEL` / `OVERRIDDEN_RESET` pair ("You changed this" / "Use the default") is
  built on absence meaning inherited. **Safety is preserved not by keeping absence fail-closed but by
  never letting a default reach `allow` silently:** a new connection's `default_posture` is `"ask"`,
  and setting a default of Allow is a deliberate act a person performs on the screen. **Nothing is
  ever armed by a row merely existing** — the standing rule, read from the other side.
  ⚠ An explicit fourth `"inherit"` state was rejected: a 44-tool connection would write 44 keys on
  first save, and "newly discovered tool" would have no absence to fall into.

- **D-213-07: Migration 128 grandfathers what was TRUE and arms nothing new — per shape.**
  The two populations behave differently today and the backfill must preserve *observed behaviour*,
  not a uniform rule:
  - **MCP rows** — gated today, absent meant denied. Backfill `default_posture = "deny"` and rewrite
    `true` → `"allow"`. **Zero widening:** a tool that was absent (denied) inherits a deny default.
  - **Capability rows** — *not gated at all* today (`BUG-260827-02`), so a Slack send works with an
    empty `tool_grants`. Write an explicit `"allow"` key for the row's **own capability id** — that
    IS what the row did today — plus `default_posture = "deny"`, so the day D-213-01's unlock gives
    it a second action, **that action is not armed by the row existing**.

  The gate closes with nobody broken. ⚠ "Deny everything and make people re-grant" was rejected:
  every shipped workflow with an external_action step would break at its next run, silently, and
  the operator's own connections are first in line. "Ask first everywhere" was rejected because it
  converts every unattended/scheduled run into a blocked one.

- **D-213-08: `default_posture` is a real column, granted in the SAME migration, and the grant trap
  is driven RED first.**
  ⚠ `connector_connections` is **column-grant-scoped** — migration 118 granted SELECT *column by
  column*, so adding a column makes every read of the table fail `42501`, surfacing as a 503
  *"Could not load connections"* on rows that already worked. Migration 128 adds the column **and its
  GRANT** in one file, and the plan **drives a read before the grant so the 42501 is SEEN**, not
  assumed — a guard nobody has watched fire is not a guard.
  ⚠ **Cloud parity is security-bearing here:** the migration and the code reading the column ship in
  **ONE operation**, exactly as mig 118 + `connector_service.py` had to.
  ⚠ A magic `__default` key inside the jsonb was rejected — it collides with a tool literally so
  named, and hides a connection-level fact inside a per-tool structure.

### The approval moment (GRANT-03)

- **D-213-09: Two triggers, ONE pause — posture feeds the EXISTING armed checkpoint.**
  `harness_engine.py:787` already carries the armed action-risk checkpoint (D-187-01/D-187-02/
  D-187-17): hoisted OUT of the author's validator list, fires once per phase execution, before the
  body, after the pre-gate pass — and `models/harness.py:517` **coerces** `action_risk_armed` to True
  on every `external_action` ("structurally armed, not disarmable"). **"Ask first" becomes a second
  reason the same checkpoint fires**, and the prompt it composes gains the service / tool / arguments
  the sketch names. One pause point, one resume path, one subscribe channel — and the resume sweep's
  two deliberately-independent armed readings (`harness_engine.py:787` and `_is_armed_action_risk`
  at :2148, pinned by `test_the_two_resume_predicates_are_independent`) **do not grow a third**.
  ⚠ Posture must **NOT** supersede the armed boolean — a connection-level Allow would silently
  un-arm every external step, disarming a guarantee the model calls undisarmable.
  ⚠ **The roadmap's "two gates must differ" is honoured elsewhere, not here:** grant-time (per-tool,
  human, once) **must not key on direction**, because a read is exactly where prompt injection
  enters; run-time (D-19, armed) may.

- **D-213-10: The ask must be REACHABLE wherever a run can pause — and the mount already exists.**

  ⚠ **CORRECTED 2026-08-27 (`213-PREFLIGHT.md` §0 / CORR-1), and the original is kept below rather
  than overwritten, because the wrong version would have bought a component nobody needed.**

  > **What this decision originally said, and it is FALSE:** *"`ChatLayout.launch.test.tsx:502`
  > asserts `WorkspacePanel` mounts ONLY inside the chat branch, so `PendingAskCard` /
  > `PendingAskStack` do not exist on `WorkflowRunPage`… Reuse `PendingAskStack` rather than
  > inventing a second card."*

  The `ChatLayout` assertion is real; the inference from it was not. **`WorkflowRunPage` renders
  `PendingAskCard` DIRECTLY, bypassing the panel** — `WorkflowRunPage.tsx:120` (import), `:563`
  (`useAskUserPrompt(run?.thread_id)`), `:1560-1575` (rendered through `RunSpine`'s `renderAsk`).
  Phase 200.2 put the ask **inside the spine, at the step it belongs to**, and its own comment calls
  that placement *"the whole point of it"*.

  **So this decision is: prove the grant ask flows through the mount that exists — do not build a
  second one.** Three conditions gate it, and all three are checks rather than claims:

  | | condition | where |
  |---|---|---|
  | **R-1** | the aside is `hidden … lg:flex` — **below `lg` the ask has no home on this page** | `WorkflowRunPage.tsx:552` |
  | **R-2** | the card renders **only at `askAnchorSlug`** — first step reading `waiting-for-you`, else first `running`, else the last row | `:962-968` |
  | **R-3** | asks are fetched by **`run.thread_id`** — a run without one fetches nothing | `:563` |

  ⚠ **R-2 is UNMEASURED and must be driven.** A step paused at the armed action-risk checkpoint is
  not an `llm_human_input` step; if its reading is not `waiting-for-you` the anchor falls through to
  `running`, which may or may not be the right row.

  ⚠ `frontend/src/pages/WorkflowRunPage.tsx` is **25 / 8 / 1601** and G-5 **FIRES** — so any change
  here lands as a **section component**, never as inline lines.
  ⚠ SC#3 says *nothing leaves until they answer*, so a pause nobody can answer fails the criterion.
  Compare the Phase 194 finding where `WorkflowRunPage` had no Stop control at all.

- **D-213-11: "Always allow X on this connection" SHIPS — explicit opt-in, with its own receipt.**
  The sketch's `ASK_ALWAYS` + `ASK_ALWAYS_NOTE` ("Changes the setting above, not just this run").
  It is **not** the default action — `ASK_APPROVE` ("Approve once") is — and it **writes its own
  audit row**, so the ledger shows who widened a permission mid-run and when. Rationale: without it,
  the only escape from a nagging prompt is to set the whole connection to Allow, which is far worse.
  ⚠ Restricting it for "Cannot be undone" rows was rejected: that tag derives from
  `readOnlyHint`-adjacent metadata **measured absent** on the one server we can reach, so the rule
  would be enforced by data we cannot trust and would silently not apply.

- **D-213-12: A grant approval waits INDEFINITELY — no countdown, following Phase 185's precedent.**
  `PendingAskCard.tsx` runs a countdown and a calm expired state (Phase 096 / BUG-260605-01), but
  **Phase 185 (GOVERN-03) already replaced it with an honest line for armed approvals**
  (`PendingAskCard.tsx:482`), and `:249` records that this class of ask waits for a person
  indefinitely. Grant approval **inherits that treatment unchanged** — sketch invariant **#9** ("no
  countdown / timer / progressbar on the ask moment") is satisfied by a shipped mechanism rather than
  a new one. ⚠ A timeout-into-refusal was rejected: an invented constant nobody can justify, which
  makes *"nothing leaves until they answer"* technically true and *"the run waits for you"* false.

### Refusal and receipts (GRANT-04, GRANT-05)

- **D-213-13: One receipt kind for both shapes — reuse `external_action_sent`.**
  Mig 117's kind already ships, but ⚠ **only the CAPABILITY adapter path writes it**
  (`phase_types.py:2631` via `_write_send_receipt`); the **MCP arm writes `tool_refused` and nothing
  on success**. The MCP arm starts writing `external_action_sent`, and the metadata gains
  `tool_name` so the ledger can name *which* action. **No new event kind**, no second receipt
  vocabulary — Phases 146–148 shipped one and the sketch explicitly refuses to invent a rival.
  ⚠ A new kind would need registering in `_AUDIT_EVENT_TYPES` **and** in a migration CHECK **in the
  same commit** (BUG-260731-02's lesson; `test_audit_event_registration.py` pins the two sets equal),
  and it would re-split the very distinction this phase is erasing.

- **D-213-14: D-08 HOLDS — the receipt gains `tool_name` and outcome, and NEVER the arguments.**
  `_write_send_receipt`'s docstring pins what a receipt may carry: capability, connection id,
  destination host — *"never the credential, never the request body, never the recipient's address.
  A receipt is a record that something left the app, not a copy of what left."* GRANT-05 asks for
  **service / tool / actor / outcome** and **all four fit inside D-08**, since a tool NAME is not its
  payload. The approval moment **showing** arguments is a different act — shown once, to one person,
  in the moment, and **not written down**. ⚠ An argument hash was rejected (a hash of an email
  address is still a strong identifier of it); recording arguments on APPROVED calls only was
  rejected because it persists exactly the most sensitive payloads, inverting the safe direction.

- **D-213-15: The refusal sentence is composed in the BACKEND gate, from the sketch's copy.**
  So it reaches every surface that shows a failed phase — chat, run page, panel, ledger — without
  four renderers having to agree, and so a non-UI consumer (logs, a failed scheduled run) still has a
  sentence. This is the standing answer to open `BUG-260815-06` (*structural gate refusals name
  nothing actionable*). The words come from the sketch: `REFUSED_HEADLINE`,
  `REFUSED_BECAUSE_DENIED`, `REFUSED_NEXT` — *"delete_repository is set to Deny on this connection."*
  + *"Set it to Allow or Ask first to let this run continue."*
  **Two homes, each owning its own surface:** `grantsVocabulary.ts` carries the settings-screen
  strings; the backend carries the run sentence. **Neither invents the other's words.**
  ⚠ The shipped sentence (*"Tool execution refused: Tool 'X' is not granted permission on
  connection 'Y'"*) keeps the mechanism-naming voice the sketch deliberately replaced — `posture`,
  `permission` and `integration` are codebase words, and the house rule is *never name the
  mechanism*.

- **D-213-16: One `tool_refused` kind, with a `reason` that tells the three cases apart.**
  Three different things can now stop a call: the grant says **Deny**; the tool was **never
  granted** and inherited a Deny default; a **PERSON** pressed Deny at the approval moment. The kind
  already carries `reason: "permission_denied"` — add the distinct values, and the ledger can answer
  *"did a person refuse this, or did a setting?"*, the operator-facing question that actually
  matters. **No new kind** means no `_AUDIT_EVENT_TYPES` ↔ migration-CHECK lockstep risk, and the
  audit browser's existing chip filters keep working.

### Claude's Discretion

- The internal shape of the backend leaf module (`grants.py`) — function names, whether the posture
  resolution is one function or two, how the shared reader over both connection shapes is factored.
- Component decomposition of the grant list beyond "it is not inline in `ConnectionFormPanel.tsx`".
- Tailwind class choices, hover/focus states, spacing — the sketch's §4 explicitly says no generated
  contract can catch these, and they stay a human comparison at G-4.
- The exact `reason` string values in D-213-16, provided the three cases are distinguishable.

### Folded Bugs and Seeds

- **`BUG-260827-02`** (capability connections bypass the tool-grant gate) — **FOLDED**. Named
  directly by SC#4. ⭐ **ORDERING IS BINDING: this gate closes BEFORE or WITH D-213-01's unlock,
  never after.** A connection that can hold many actions with no per-tool gate is every one of them
  armed by the row merely existing.
- **`SEED-214`** (a connection offers its full capability, not one verb) — **FOLDED at the unlock
  only** (D-213-01 / D-213-02). Its *filling* half stays planted; flip its `status` to reflect the
  partial fold rather than closing it.

</decisions>

<failure_modes>
## How we'd know this failed — candidate observables for the plan's G-6 section

1. A shipped Slack / Jira / SMTP workflow that worked yesterday returns a refusal after migration 128
   — the backfill did not grandfather (D-213-07).
2. `GET /connectors/connections` returns 503 / *"Could not load connections"* on a pre-existing row —
   the column grant was forgotten (D-213-08).
3. A run pauses on "Ask first" and the person cannot find where to answer — the ask did not anchor
   to the paused step, or the window was below `lg` (D-213-10 / R-1, R-2).
4. An armed `external_action` whose tool is also "Ask first" asks **twice** — a second pause was
   built instead of a second trigger (D-213-09).
5. The ledger shows a send with no matching receipt on the MCP arm (D-213-13), or shows arguments
   (D-213-14).
6. Setting a connection default to Allow silently arms a tool nobody granted (D-213-06).
7. A refusal reaches a surface as *"Tool execution refused: …"* rather than the sketch's words
   (D-213-15).
8. `ConnectionFormPanel.tsx` grows past 2124 L, or `phase_types.py` past 2664 L — the refactor was
   claimed, not taken (D-213-00).

</failure_modes>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The G-2 acceptance bar — read FIRST
- `.planning/sketches/213-grants-and-the-approval-moment/BUILD-CONTRACT.generated.md` — ⭐ **the
  contract.** §1 exact strings, §2 rendered row shapes, §3 the ten invariants the React suite must
  reproduce, §4 what it cannot catch. **Generated from the running sketch — never hand-edit.**
- `.planning/sketches/213-grants-and-the-approval-moment/README.md` — the operator's picks, the two
  copy replacements and why, ⚠ **§2 the one recorded departure from Stitch** (the override edge is
  coloured by AUTHORSHIP, not state), ⚠ **§5 the five defects the drive script caught**, §6 what the
  sketch deliberately does NOT settle.
- `.planning/sketches/213-grants-and-the-approval-moment/COPY.js` — ports to
  `frontend/src/components/settings/grantsVocabulary.ts`. **The build IMPORTS it; it does not retype
  strings into JSX.**
- `.planning/sketches/213-grants-and-the-approval-moment/index.html` + `drive.cjs` — 66 executable
  assertions; re-run `node drive.cjs --emit` after any sketch change.
- `.planning/sketches/213-stitch-grants/README.md` — step 1 (direction). The layout question is
  **measured, not argued**: at 400px the three-state control cannot fit on the row. Operator chose
  **A** (the panel stays, D-27 holds) at `clamp(480px, 38%, 640px)` — matching `ChatLayout.tsx:657`'s
  shipped `clamp(300px, 30%, 420px)` house pattern rather than inventing a number.
  ⚠ **`ConnectionFormPanel.test.tsx:571` currently pins `400px` and MUST be updated in the same
  commit** — a shipped assertion this sketch deliberately invalidates.
- `.planning/sketches/STITCH-BRIEF-213-grants-and-the-approval-moment.md` — the brief.

### Requirements, scope and the phase's own record
- `.planning/ROADMAP.md` §"Phase 213" (lines 202–221) — goal, the five success criteria **with their
  two ⚠ amendments**, and the flags block.
- `.planning/REQUIREMENTS.md` lines 66–79 — GRANT-01..05 verbatim.
- `.planning/seeds/SEED-214-a-connection-offers-its-full-capability-not-one-verb.md` — ⚠ its first
  re-open trigger was **already TRUE at planting**; read the operator's verbatim question and the
  correction it forced (SMTP sends, but **Email-the-service reads too**).
- `.planning/reported-bugs/BUG-260827-02-capability-connections-bypass-the-tool-grant-gate.md` —
  the measured gate defect, the UI half, and ⚠ why commit `4aa28090` removing the "Granted" checkbox
  is the **honest rendering** of this bug and **not a fix for it**.

### Prior-phase decisions this phase inherits
- `.planning/phases/212-the-catalog-and-its-doors/212-CONTEXT.md` — D-212-04 (presentation-driven
  catalog, `servicesCatalog.ts`), **D-212-13 (key-preserving additive grant merge — newly discovered
  tools default to ungranted; obsolete tools pruned)**, D-212-15 (modular presentation extraction).
- `.planning/phases/211-the-connection-is-a-service-not-a-verb/211-CONTEXT.md` — the service model,
  D-211-05 / D-211-06 (descriptors; **no parallel required-arguments constant, ever**).

### The backend seams this phase rewrites
- `backend/app/services/harness/phase_types.py:2510-2545` — **Gate 6**, nested inside
  `if getattr(connection, "mcp_server_url", None):`. The nesting IS `BUG-260827-02`.
- `backend/app/services/harness/phase_types.py:2147-2185` — `_write_send_receipt`, and ⚠ **the D-08
  docstring that fixes what a receipt may carry**.
- `backend/app/services/connectors/descriptors.py` — `static_descriptors_for_capability`
  (*"One element, always."*), the lazy-import rule and the fence that pins it, and the
  ⚠ **"a descriptor is an advertisement, not a permission"** docblock that `BUG-260827-02` shows is
  true for only one of the two shapes.
- `backend/app/services/harness_engine.py:765-800` — the **armed action-risk checkpoint** (D-187-01 /
  D-187-02 / D-187-17 / D-19), including why it is NOT a member of `phase.validators`.
- `backend/app/models/harness.py:439, 475-526` — `action_risk_armed` and the D-04 coercion that makes
  it structurally true and undisarmable on `external_action`.
- `backend/app/db/workflows.py:259-315` — `_AUDIT_EVENT_TYPES` and ⚠ the BUG-260731-02 note: a kind
  registered here but absent from the migration CHECK **moves** the failure, it does not remove it.
- `backend/app/services/harness/human_input.py` (module docstring) — **the extraction precedent
  D-213-00 follows**: verbatim move, re-import load-bearing and never "tidied" away, the honest leaf
  invariant stated at its real strength, and the nine patch sites the move repointed.

### Migrations
- `supabase/migrations/116_connector_connections.sql` — the `capability` CHECK over three verbs;
  ⚠ **the 1:1 lock, and it is a schema lock, not a lazy adapter**.
- `supabase/migrations/126_mcp_connector_connections.sql` — made `capability` NULLABLE, and ⚠ §34-47
  on why dropping NOT NULL opened a shape the table could not otherwise refuse (`CHECK` passes unless
  FALSE, so a NULL-capability insert was accepted).
- `supabase/migrations/127_connector_connection_service_identity.sql` — `service_id`; the newest
  migration. **213's is `128_`** — the filename must match `<digits>_name.sql`.
- ⚠ **Apply by pasting into the Supabase SQL editor — never `db push` / `db reset`** — then
  `bash scripts/regenerate-full-schema.sh`. Never hand-edit `supabase/full-schema.sql`.

### Project rules that bind this phase
- `CLAUDE.md` → *Workflow guardrails* (G-1..G-7) and the **hot-file ledger** — and
  `docs/HOT-FILE-LEDGER.md` for each blast-radius file's named seam and binding invariants.
  ⚠ **Same-commit sync rule:** a ledger row and its detail section move together; a disposition cell
  is capped at 200 chars.
- `CLAUDE.md` → *UAT scoreboard recipe* — **SC#10 owes the FULL 8-row native roster + OpenRouter**,
  derived from `MODEL_CAPABILITIES`, never re-typed. Blocked rows are recorded ⛔ with a reason,
  never dropped.
- `docs/CONNECTOR-ARCHITECTURE.md` — the recorded MCP-first verdict.
- `.planning/PROJECT.md`, `.planning/STATE.md` — ⚠ **hand-edit STATE.md; do NOT call the `state.*`
  SDK verbs** (seven write false records).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets — this phase EXTENDS, it does not rebuild
- **`tool_grants` (jsonb on `connector_connections`)** — 206.2 already shipped grants at the
  **per-tool grain**, which the competitor study calls the industry's most advanced permission model
  with the instruction *"do not regress it"*. D-213-05 changes its value type, not its existence.
- **The armed action-risk checkpoint** (`harness_engine.py:787`) — the run-time pause primitive.
  D-213-09 gives it a second trigger rather than a rival.
- **`ask_user` / `subscribe_for_response`** (`harness/human_input.py`, `ask_user_service.py`,
  `api/panel.py`, `api/runs.py`) — Phase 085's pause/ask plumbing, already resume-safe.
- **`PendingAskCard` / `PendingAskStack`** (`components/panel/PendingAskCard.tsx`, 629 L) — the
  answer surface, with Phase 185's honest no-countdown line already in it at `:482`.
- **`write_audit`** (`db/workflows.py:2313`) + `external_action_sent` (mig 117) + `tool_refused` —
  the receipt machinery. Phases 146–148 shipped the ledger vocabulary and the audit browser's chips.
- **`connectionsCopy.ts` / `connectionFormCopy.ts`** — the shape `grantsVocabulary.ts` mirrors.
- **`servicesCatalog.ts`** (212) — presentation lookup by `service_id`, keyed off migration 127.

### Established Patterns
- **Computed, never stored** (D-213-02) — Phase 187's node-face ladder; `descriptors.py`'s refusal to
  duplicate `INPUT_SCHEMA["required"]`.
- **Missing key DENIES** — the shipped asymmetry D-213-06 deliberately replaces, and must be shown to
  have replaced it *safely* rather than quietly.
- **Two-layer audit registration** — `_AUDIT_EVENT_TYPES` **and** the migration CHECK, same commit.
- **Leaf-module extraction with a load-bearing re-import** — `human_input.py`.
- **Copy tables imported, not retyped** — the sketch's `COPY.js` → `grantsVocabulary.ts` rule.
- **Blocking I/O never in an async handler** (D-v2.5-01) — `run_in_threadpool`; 212 applied it at
  `mcp_client.py`.

### Integration Points
- `phase_types.py` Gate 6 → the new `connectors/grants.py` leaf, called by **both** shapes.
- `descriptors.py::static_descriptors_for_capability` → the one function both shapes read for a
  connection's action list.
- `ConnectionFormPanel.tsx` → a new grant-list component + `grantsVocabulary.ts`.
- `WorkflowRunPage.tsx` → a new section component mounting `PendingAskStack`.
- Migration 128 → column + GRANT + backfill, then `regenerate-full-schema.sh`.
- ⚠ `lib/api` barrel — **D-207-06 has no guard**: a symbol exported from a domain module but
  forgotten in the barrel typechecks perfectly and is invisible to every consumer. This phase adds
  `lib/api` surface; check the barrel explicitly.

### ⚠ What Phase 212 taught, that 213 must not rediscover
**Five defects, and not one was visible to a gate** — 2,796 passing backend tests, a green count gate
and a green typecheck saw none of them. **Three shared one cause: a test that MOCKS THE THING UNDER
TEST.** *A mock proves the caller is self-consistent; it cannot prove the wire is right.*
**Two of the five were found by the OPERATOR driving, after the phase was closed.** G-4 exists for
exactly this.

</code_context>

<specifics>
## Specific Ideas

- **Rovo's detail screen is the bar** (roadmap flag): seven tools, reads and writes in **one list**,
  a connector-level `Needs approval` default. The sketch renders that composition at GitHub's 44.
- **The operator's own words on layout, while driving 212:** *"should we open each one in a pop up
  window instead of being on the right and splitting the screen which is already narrow to 2
  halves"*. Settled by the Stitch pass: **A, the panel stays**, widened to `clamp(480px,38%,640px)`.
  ⚠ **A's cost is a function of 400px, not of being a panel** — the operator's own rider.
- **The operator's verbatim question behind SEED-214:** *"each tool that — or connection that — we
  are going to have the full capability that it is offering. How to achieve this?"* — asked on seeing
  **GitHub list 44 actions while Slack, Jira and Email listed one each**.
- **Direction must NOT be built on `readOnlyHint`** — measured **absent** on the one server we can
  reach. **Fail closed on absence**, and say so in real DOM text: the sketch's `DIRECTION_UNKNOWN`
  ("Unknown") + `DIRECTION_UNKNOWN_HELP` ("This server does not say whether this action only reads.
  Treated as if it changes things."). Never infer a read from an absent hint.
- **The override edge is coloured by AUTHORSHIP, not state** — always `--primary`, whichever way you
  decided. Three reasons in the README §2, and §4 of the sketch renders both rules over the same six
  rows so it can be re-judged by looking. ⚠ The edge lane is **always reserved**
  (`border-left: 2px solid transparent`) so a row never shifts 2px when overridden.
- **Colour is never the only carrier** — every overridden row also carries the words *"You changed
  this"* (invariant #10).

</specifics>

<deferred>
## Deferred Ideas

- **SEED-214's *filling* half** — growing an adapter's action set (Slack `list_channels`, IMAP
  `list_messages`, …), adopting an MCP server for a service that has a thin adapter, or building a
  generic OpenAPI/REST ingester. **Deferred by the roadmap's own fence**, and it must FOLLOW the
  approval model. Seed stays planted with its remaining triggers; only the unlock is folded.
- **The workflow authoring surface** (`ConnectionPicker`, `McpToolPicker`, `ExternalActionSection`,
  `PhaseFormPanel.tsx`) → **Phase 214** (STEP-01 / STEP-06). D-213-04.
- **Connections in chat** (`_TOOL_REGISTRY`, the service chip, starter prompts, attach) →
  **Phase 216**, gated behind this phase.
- **`SEED-188` — prompt-injection defences have no adversarial test.** Left **planted**; the trigger
  is **Phase 216**, where the ROADMAP already requires the threat model and names injection as
  unsolved. 213 ships **no read path**, so an adversarial test here would have no surface. ⚠ Recorded
  so it is not "handled" by neither phase.
- **`BUG-260826-01`** (send_email arguments unreachable from every launch path),
  **`BUG-260826-02`** (publish gauntlet does not validate adapter argument satisfiability),
  **`BUG-260826-05`** (failed external_action shows no reason in the panel) → **routed to Phase 214**;
  their frontmatter is updated to `folded_into: 214` in this commit, because until now only ROADMAP
  prose pointed at them and **`status:` / `folded_into:` frontmatter IS the index**.
- **`BUG-260815-06`** (structural gate refusals name nothing actionable) — **not folded**, but
  D-213-15 is written so this phase's refusals do not add to it. Leave open.
- **`SEED-185`** — the app has **no URL router**, so a full detail *route* is not free. Recorded as
  the constraint that made Layout A the answer; unchanged by this phase.

</deferred>

---

*Phase: 213-per-tool-grants-and-the-approval-moment*
*Context gathered: 2026-08-27*
