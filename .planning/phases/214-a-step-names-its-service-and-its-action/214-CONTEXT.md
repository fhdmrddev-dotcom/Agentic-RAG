# Phase 214: A Step Names Its Service and Its Action - Context

**Gathered:** 2026-08-28
**Status:** Ready for planning

<domain>
## Phase Boundary

An author adds an external step by picking a **service** and then a **named action**; that step's
required arguments arrive from whatever launched the run; publish **refuses** a step nothing can
satisfy; and **every surface a run appears on** says which service and which action — including
when it fails. Requirements: **STEP-01 .. STEP-06**.

⚠ **STEP-01 IS ALREADY HALF-BUILT AND THE PHASE MUST NOT REBUILD IT.** Phase 211-04 deleted the two
radiogroups from `ExternalActionSection.tsx` (498 L → 176 L) and replaced them with *one question,
then one question*: pick a connection (every shape, one unscoped read), then pick one of that
connection's own actions. **What remains of STEP-01 for this phase is the ARGUMENTS** — specifically
the deletion of `MCP_TOOL_ARGS_LABEL = "Tool Arguments (JSON)"` (`McpToolPicker.tsx:68`), which is
the "hand-written JSON argument object" SC#1 forbids.

**Out of scope, by the roadmap's own fence:**
- **Growing any adapter's action set** — `SEED-214`'s *filling* half (Slack `list_channels`, IMAP
  `list_messages`, an OpenAPI ingester). Per-service work that must FOLLOW the approval model.
- **The full xyOps canvas grammar** — `SEED-199` (two node classes, triggers/constraints as nodes,
  typed edges). `STEP-04` takes only the connector-mark half; a canvas phase is scoped in its own right.
- **Connections in chat** — Phase 216. The chat *launch form* (D-214-04) is in scope; a connected
  service reachable by name in a thread is not.
- **The `live_connectors` flip** — a separate, deliberately-armed decision (see D-214-19).

</domain>

<decisions>
## Implementation Decisions

### Guardrails — surfaced BEFORE the feature, per the orchestrator protocol

**G-5 fires on TEN files in this blast radius. All were re-derived from git on 2026-08-28 and
SIX ledger cells were found STALE.** Re-derive again at plan time rather than trusting these —
that is this ledger's own repeated finding.

| File | Ledger cell | **Measured 2026-08-28** | |
|---|---|---|---|
| `frontend/src/components/workflows/ConnectionPicker.tsx` | 5/3/651 | **6 / 4 / 706** | ⚠ STALE |
| `frontend/src/components/workflows/ExternalActionSection.tsx` | 4/3/498 | **6 / 4 / 176** | ⚠ STALE — 211-04 *shrank* it |
| `frontend/src/components/workflows/McpToolPicker.tsx` | 3/3/645 | **4 / 4 / 645** | ⚠ STALE |
| `backend/app/services/harness/phase_types.py` | 47/21/2664 | **49 / 22 / 2733** | ⚠ STALE · obligation **OWED** |
| `backend/app/services/harness/grounding.py` | 19/6/1311 | **20 / 7 / 1366** | ⚠ STALE |
| `frontend/src/components/workflows/doorVocabulary.ts` | 4/3/341 | **5 / 3 / 364** | ⚠ STALE — at threshold |
| `frontend/src/pages/WorkflowRunPage.tsx` | 25/8/1601 | **26 / 8 / 1601** | ⚠ STALE |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | 29/13/1561 | 29 / 13 / 1561 | fires |
| `backend/app/services/harness/publish_service.py` | 22/9/1223 | 22 / 9 / 1223 | fires |
| `frontend/src/components/panel/PhaseCard.tsx` | 13/9/623 | 13 / 9 / 623 | fires |

Not firing but in the blast radius: `RunSpine.tsx` (**4 / 2 / 372** — ledger says 3/2/372),
`useTemplateFirstDraft.ts` (5 / 2 / 630).

⚠ **`McpToolPicker.tsx` was flagged in the ROADMAP as having "no ledger row of its own". It DOES
have one now** (`3 / 3 / 645`), and that row is already stale at `4 / 4 / 645`. **Sync every row
above in the SAME commit as its section in `docs/HOT-FILE-LEDGER.md`** — a row without a section,
or a section without a row, is drift.

- **D-214-00 — THE `phase_types.py` REFACTOR IS TAKEN, AS A LEAF CUT, AND IT IS A PREREQUISITE
  RATHER THAN A CLEANUP.** Argument **resolution** and the argument **satisfiability predicate**
  leave into a new pure module — `backend/app/services/connectors/args.py` — on the precedent
  Phase 213 set with `connectors/grants.py` and the `human_input.py` shape before it.

  ⚠ **The mechanical reason, not the tidiness one: the PUBLISH GATE and the EXECUTOR must use the
  SAME predicate.** STEP-03 refuses at publish what STEP-02 resolves at run time; two copies of that
  logic in two files is a guaranteed drift, and the drift's symptom is a workflow that publishes and
  then fails — which is `BUG-260826-02` restated. One pure function over
  `(config, schema, upstream phases, run inputs)`, called from both, is what makes the gate honest.

  The frontend half — the argument editor — **discharges by construction** (a new component, not
  new lines in `PhaseFormPanel.tsx`, which is the shape `GovernanceSection.tsx` and
  `ExternalActionSection.tsx` both already took, one import plus one gated JSX expression).
  ⚠ **The plan must ARGUE that, not assume it**; "honoured by construction" is the disposition four
  ledger rows already carry and the ledger's finding is that the claim goes stale.

- **G-2 sketch is OWED before planning** — the step picker with its argument fields, and the canvas
  + run node faces. `sketch-findings-agentic-rag` auto-loads; read `references/icon-convention.md`
  §4 before drawing any canvas mark. **The `…workflow-edit.webp` xyOps reference is the canvas bar.**
  ⚠ **Panel layout/width is a SKETCH question, not a discuss question** — the operator's standing
  objection to the 400px split (raised while driving 212, carried into 213) applies to a step form
  that now carries a field per argument. 213 set the precedent that the sketch settles it.
- **Threat model REQUIRED** — the publish gate is a safety gate, and **argument provenance decides
  what a step is allowed to send**. The `From an earlier step` arm means LLM-produced text can now
  reach a vendor as a named argument; that is a new trust edge.
- **SC#10 cross-provider UAT is owed** (full native roster + OpenRouter, 8 rows; multi-tool,
  parallel-thread, long-message). A pause suspends a live run.
- **G-6:** the failure-mode list below is the input to the plan's `## How we'd know this failed`.

### Where a step's arguments come from (STEP-02 — closes ⛔ `BUG-260826-01`)

- **D-214-01: A PER-ARGUMENT SOURCE PICKER, three arms.** Each argument in the step's form carries
  a small source control:
  - **`Fixed value`** — the author types it; stored in `tool_args`.
  - **`Ask at launch`** — becomes a **real field** in the launcher's form; the key is declared in
    `WorkflowDefinition.inputs[]`.
  - **`From an earlier step`** — the author picks an upstream phase by its authored name.

  ⚠ **This is what makes SC#2's "from EVERY launch path" literally true** rather than trivially
  true: the author decides *per argument* which path supplies it. Rejected: fixed-values-only
  (a `send_email` step could then only ever email the same person the same subject).

- **D-214-02: THE UPSTREAM BINDING STORES A PHASE SLUG AND PASSES THAT PHASE'S WHOLE OUTPUT. NO
  FIELD SELECTION.** A dropdown of upstream phases by authored name — **no dotted paths, no
  `{{ }}`, no output-key sub-picker.** It is *structurally incapable* of becoming an expression
  language, which is what keeps **D-09** intact (`_adapter_args`'s own docstring: *"No expression
  language, no templating surface … a closed two-column lookup"*).

  ⚠ **The `output_keys` variant was REJECTED with a measured reason:** `output_keys` is a
  `list[str]` an author declares by hand and nothing verifies the phase produces them, so the picker
  could offer a key that never arrives — **`BUG-260826-01`'s own failure shape, one level up.**

- **D-214-03: `_adapter_args`'s SILENT BODY AUTO-FILL BECOMES A VISIBLE DEFAULT.** Today
  `_BODY_ARG_FOR_CAPABILITY` fills `body` from the previous phase's text when the run's inputs did
  not name it (`phase_types.py:2151`) — an invisible rule. A new step's body-class argument now
  arrives **pre-set to `From an earlier step → <the previous phase>`**: same behaviour, but the
  author can SEE it and change it. **The picker always shows a source; nothing silently fills
  anything.** ⚠ An invisible rule is what `BUG-260826-01` was.

- **D-214-04: `Ask at launch` BINDS EVERY LAUNCHER — INCLUDING CHAT, WHICH GROWS A FORM.**
  SC#2 names the library, a thread and a schedule explicitly, so a launcher that silently sends
  nothing **fails the criterion**. `RunModal` and the schedule modal render real fields (the
  `InputFieldSpec` machinery at `harness.py:567` already exists and is deliberately rendered as a
  *hint line only* today — `RunModal.tsx:552`, *"never fake structured fields"* — because nothing
  guaranteed the value would be used; this phase is what gives it a reason to become real).
  **Chat gains a launch moment it does not have today.**

  ⚠ **REJECTED: letting the agent fill the argument from the conversation.** An LLM choosing a
  recipient address is a new trust surface and is not reproducible between runs.

### The argument editor (STEP-01 — no hand-written JSON anywhere)

- **D-214-05: FIELDS ARE DERIVED FROM `inputSchema`, WHICH ALREADY EXISTS FOR BOTH SHAPES.**
  `backend/app/services/connectors/descriptors.py:169` emits `"inputSchema": _plain_json(adapter.INPUT_SCHEMA)`
  for a first-party row, and `mcp_client.py:343` emits the server's own for an MCP row. **One source,
  one field renderer, no branch.** Native adapters are flat `string` properties with `required` and
  `description` (`jira_adapter.py:419`) — trivially renderable.

- **D-214-06: RENDER WHAT WE CAN; REFUSE THE REST BY NAME. NO JSON ESCAPE HATCH — NOT ANYWHERE.**
  Flat scalars (string, number, boolean, enum) get real fields. An argument whose shape we cannot
  render (nested object, array of objects, `oneOf`) **says so in the author's terms and names
  itself**; if it is **required**, the step is unsatisfiable and publish refuses it (D-214-09).
  ⚠ **A JSON box "for the hard cases" is the surface SC#1 forbids under a different name, and once
  it exists every hard case routes to it — which is exactly how `Tool Arguments (JSON)` became the
  only surface.** `MCP_TOOL_ARGS_LABEL` and its `<Textarea>` are **deleted**.

- **D-214-07: A STEP BOUND TO A TOOL WHOSE SCHEMA WE DO NOT HAVE SAYS SO AND OFFERS RE-DISCOVERY.**
  No fields are invented, no key/value rows, no JSON. The re-discovery route already exists
  (`connector_service.py:880` — *"this is how the snapshot is retaken"*). **Publish refuses a step
  whose arguments are unknown, because "unknown" and "satisfied" must not look the same.**
  ⚠ Rejected: blocking the binding outright — a transient discovery failure would make a working
  connection unauthorable.

- **D-214-08: EXISTING `tool_args` OBJECTS ARE READ INTO THE FIELDS; UNMATCHED KEYS ARE SURFACED,
  NEVER DROPPED SILENTLY.** A key matching a schema property populates its field as a `Fixed value`.
  A key the schema does not declare is shown as an unrecognised leftover the author can remove.
  ⚠ **The adapter already fails closed on an undeclared key** (`jira_adapter.py:453`), so a silent
  drop would hide a step that was already broken — a behaviour change the author cannot see, on an
  outbound path. **One authoring surface only: no "old steps keep the old editor" arm**, or SC#1
  stays false for every workflow authored before this phase.

### What publish refuses, and when (STEP-03 — closes `BUG-260826-02`)

- **D-214-09: EACH SOURCE ARM IS PROVED ON ITS OWN TERMS. A CHOSEN ARM IS NOT ENOUGH.**
  - `Fixed value` → a non-empty value is stored.
  - `From an earlier step` → the named phase **exists and is upstream** of this one — the same
    predicate `reachability.py::_check_input_contracts` already computes.
  - `Ask at launch` → **the key is declared in `WorkflowDefinition.inputs[]`**, so a form can
    actually render it.

  Any arm unproved ⇒ **refused, naming the step and the argument**. ⚠ `Ask at launch` with no
  matching `inputs[]` entry is **`BUG-260826-01` again** — a declared intention no launcher can
  honour — and this gate exists because that shape shipped once already.

- **D-214-10: THE GATE'S HOME IS THE PRE-GOLDEN-RUN LINT.** Stage 2 is pure and short-circuits
  **before** the golden run (`publish_service.py:175`), and `reachability.py` already does this
  shape of check against `_KNOWN_RUN_INPUT_KEYS = frozenset({"kickoff_prompt", "topic"})`
  (`reachability.py:67`). ⚠ **That allowlist is exactly why nothing sees the defect today** — an
  adapter's `INPUT_SCHEMA` requirements are not `input_keys`. Whether it extends stage 2 or becomes
  a sibling lint is **Claude's discretion**; being *cheap and before the golden run* is not.

- **D-214-11: THE GOLDEN RUN ALSO VALIDATES THE ARGUMENTS IT RESOLVED — AND STILL SENDS NOTHING.**
  The golden run already resolves what it *would* have sent (`_external_action_inputs` builds it;
  `recorded_intent` keeps it whole). Running the adapter's own schema validation over that object
  costs nothing and catches what the static gate cannot: **an argument whose source is structurally
  fine but whose resolved VALUE is empty or the wrong type.** ⭐ **D-16's no-send line is UNTOUCHED**
  — publishing still cannot fire a real email.

- **D-214-12: NOTHING RETROACTIVE. The gate binds the NEXT publish.** Already-published workflows
  keep running — and keep failing at the send **honestly**, with STEP-05's real reason now shown.
  No migration, no mass invalidation, no library sweep. ⚠ Rejected: refusing to *run* them —
  that un-runs live rows without warning.

- **D-214-13: `BUG-260815-06` IS FOLDED AT ITS NEW-REFUSAL EDGE ONLY, AND ITS TRIGGER IS
  RE-ARMED.** STEP-03's own refusal names the step and the missing argument **from birth**, so this
  phase adds nothing to the pile. The other five stages' refusal copy is **not** touched.
  ⚠ **The bug stays `open`, `folded_into` stays `null`, and the re-open trigger is rewritten to
  record that it fired at 214 and was deliberately declined** — the same disposition Phase 197 gave
  it, for the same reason: repair on five untouched stages is a capability, not a gap.

### Service and action on every run surface (STEP-04 / STEP-05 — `SEED-206`, `BUG-260828-01`, `BUG-260826-05`)

- **D-214-14: THE COMPOSER STAYS PURE; THE CALLER RESOLVES THE SERVICE AND PASSES IT IN.**
  `_external_action_clause` (`grounding.py:1279-1293`) reads only `phase.config`, so
  `service = config.capability` produces the measured tautology
  **`It will run "post_message" through post_message.`** on a capability row, and omits the clause
  entirely on an MCP row (`capability is None`). The service a person needs — *Slack* — sits on the
  **connection row**. The engine already holds a pool and already reads that connection to run the
  step: it resolves the display name and hands it to the composer **as an argument**.

  ⚠ **Purity is what makes the composer testable and is what D-185's honesty rules rest on.**
  ⚠ **Rejected: storing the service name on the step config** — a stored copy of a derived fact goes
  stale the moment the connection is renamed; **D-213-02 rejected exactly this shape** for
  descriptors (*computed never stored*).
  ⚠ **An absent name still omits the service clause** — the existing *"never draw a name the system
  cannot know"* rule is preserved, not overridden.

- **D-214-15: THE APPROVAL PAUSE SHOWS THE FULLY RESOLVED ARGUMENT OBJECT — NOT `tool_args`.**
  ⚠ **THIS IS A DEFECT THE PHASE WOULD OTHERWISE CREATE.** `_external_action_clause` renders
  `config.tool_args` into *"What it will send"*. Under D-214-01, `tool_args` holds **only the fixed
  values** — an `Ask at launch` or `From an earlier step` argument is not in it. Left alone, the
  pause would **name the constants and silently omit exactly the arguments that vary**, which on an
  approval surface is worse than showing nothing.

  So the sentence is composed **after resolution**, from what will actually leave. ⭐ **D-213-14
  still holds unchanged:** shown once, in the moment, and **never written to the audit ledger** —
  the receipt keeps carrying capability, connection id, host and tool name, and never the body.
  ⚠ Per-argument source annotation (*"you typed this"* / *"from step 2"*) was considered and
  **rejected** — the sentence is already long.

- **D-214-16: EVERY SURFACE A RUN APPEARS ON, VIA ONE SHARED ELEMENT.** The panel's `PhaseCard` /
  `PhaseTimeline`, `WorkflowRunPage`'s `RunSpine` + `RunStepList`, the chat
  `RunCard`, **and the approval pause** — **FIVE surfaces.**

  ⚠ **CORRECTED 2026-08-28 AT PLAN-PHASE (operator decision), AND THE ORIGINAL IS RECORDED HERE
  RATHER THAN OVERWRITTEN: this decision as first written named `RunTranscript` as a sixth
  surface, and `RunTranscript` HAS NO MOUNT ANYWHERE IN THE PRODUCT.** `grep -rn '<RunTranscript'
  frontend/src` returns its own test file only. It was removed outright at **Phase 200.2** for
  four measured reasons recorded at `WorkflowRunPage.tsx:107` — it duplicated the run log, which
  an operator reported — and its absence is **pinned** at `WorkflowRunPage.test.tsx:2241-2244`
  (`expect(codeOf(pageSource)).not.toContain("RunTranscript")`).

  ⭐ **The operator-approved G-2 acceptance bar already had this right**: sketch 216's
  `BUILD-CONTRACT.generated.md:46` invariant #3 names **five** surfaces and excludes the
  transcript. The decision was written against a premise that stopped being true two milestones
  ago, and it was found the only way it could be — by opening the component and looking for its
  mount.

  ⚠ **Mounting it would have been worse than a no-op**, which is why this is a correction rather
  than a note: `WorkflowRunPage.test.tsx` sits in the owning plan's own `files_modified`, so an
  executor would have been **licensed to delete that pin** and would have silently reverted a
  removal the operator drove. **Re-mounting the transcript is a separate decision about their
  own removal and must never arrive inside a coverage task.**

  ⚠ **A G-5 ROW NOW FIRES ON AN UNMOUNTED COMPONENT** — `RunTranscript.tsx` measures
  `7 / 3 / 652` against a ledger cell reading *young (2 phases)*. Recorded because a hot-file
  obligation on code no user can reach is itself worth knowing. ⚠ `SEED-206`'s trigger is *the moment ANY step surface
  other than the builder canvas renders an external step*, and its own warning is **"do NOT wait for
  a catalog — the spine gap is live TODAY on shipped surfaces"**; a partial answer leaves the seed
  live for the next phase to rediscover. **Coverage should be a consequence of one component
  existing, not a list kept in sync.**

- **D-214-17: THE MARK IS A REUSE, NOT A NEW DECISION.** `frontend/src/components/settings/connectionMark.tsx`
  is *"the ONE service-to-mark map"* and already carries the rule **a vendor shows its own mark; a
  vendorless shape is drawn in the interface's own ink** — with slugs verified against the installed
  `@iconify-json/logos@1.2.13` rather than against any document. **That answers `SEED-206`'s measured
  ClickUp hole** (an unmapped service takes the neutral mark). ⚠ **Do not re-map anything**; if the
  module must serve a non-Settings surface, move or share it — do not fork it. Read
  `references/icon-convention.md` §1 and §4.

- **D-214-18: `BUG-260826-05` — MEASURE BEFORE FIXING.** The bug says outright *"worth confirming
  directly before fixing"* and names the run (`e2c0db68-dc94-4864-b7bd-afd0e163f69b`). **Read
  `workflow_phases.error` for that failed phase and compare it against the `run_failed` frame.**
  - Column populated ⇒ the defect is in **what the event carries**; fix the emitter, and
    `PhaseCard.tsx:253` needs nothing.
  - Column empty too ⇒ the defect is in the **executor's failure path**.

  ⚠ **Deciding before measuring is how the phase fixes the wrong half** — and the panel's
  unknown-reason sentinel is an *honesty mechanism*, so firing it when the reason is known trains
  readers to distrust it.

### The launch flag (owed by the ROADMAP)

- **D-214-19: `visual_workflow_canvas` FLIPS TO `everyone` IN THIS PHASE. `live_connectors` DOES
  NOT.** The canvas layer has shipped through 199, 200, 209, 211 and 213 and is the surface this
  whole milestone governs; left `off`, **SC#1, SC#3 and SC#4 render for nobody** and the phase would
  close on criteria no install can meet. Phase 209's 16/16 browser drive ran against a flag-flipped
  database and shipped nothing to anyone — that is the ROADMAP's own stated complaint.

  ⚠ **Mechanically this is a SEED ROW, NOT A MIGRATION.** `_GOVERNED_FEATURES` in
  `backend/app/models/user_settings.py:1197-1203` is *the ONE authoritative cold default*; the
  `app_settings.feature_visibility` JSONB gains the key only on an operator flip via
  `set_feature_visibility`'s atomic `||` merge. **Deployment-artifact parity applies in the same
  commit** (`docs/OPERATOR.md` Step-3 seed list; `scripts/check-deploy-drift.sh`).

  ⚠ **`live_connectors` (Phase 190 / CONN-03 / D-26) is a SECOND off-by-default flag** — *"with it
  off an external_action step behaves exactly as it does today"*. It stays a separate, deliberately
  armed decision and is **not** flipped here: arming real outbound sending for every user is a
  bigger decision than these six criteria describe.

  ⚠ **Consequence for verification:** any live drive of SC#2 / SC#4 needs **both** flags flipped,
  and the phase must say which flag state each row was driven under.

### The describe door (STEP-06 — `SEED-208`)

- **D-214-20: THE AUTHOR PICKS THEIR SERVICES BEFORE THE AI DRAFTS.** The describe screen shows the
  author's **connected services and their granted tools** and they choose which the workflow may
  use. The generator's vocabulary is then that set, so **a step naming an unconnected service is
  structurally impossible** rather than caught afterwards. ⚠ Post-draft validation alone was
  rejected: it is a *model-behaviour* guarantee, and the failure it must prevent is precisely
  *"an invented step that validates and fails at 03:00"*.

  ⭐ **The grant grain is the vocabulary grain** — this is why STEP-06's stated dependency is Phase
  213: **granted** tools, not merely discovered ones.

- **D-214-21: THE REFUSAL NAMES THE SERVICE AND NAMES THE NEXT ACTION, AND DRAFTS NOTHING.**
  For the case the picker cannot cover — the author's **prose** names a service they have not
  connected. Shape: *"Slack is not connected — connect it in Settings, or describe this step without
  it."* Two real next actions, in the author's own words. ⚠ **A refusal is only honest if it names
  the next action** (the ROADMAP's own words). Follows `DESCRIBE_REFUSAL`'s governed-vocabulary
  precedent in `doorVocabulary.ts:265` — a governed id, character-asserted, never a sentence living
  inside a component.

  ⚠ **The service name comes from what the author WROTE**, so no catalog lookup is needed to say it.
  ⚠ **Rejected: an inline "connect it now" control** — `SEED-156` already records that both
  authoring doors open onto the same crowded first screen; a second door onto Settings makes that
  worse. ⚠ **Rejected: drafting the rest and marking the gap** — a draft containing a hole is a
  draft that can be published if the hole is missed, and STEP-03's gate is a *different* gate at a
  *different* moment.

- **D-214-22 - THE PANEL TRACK IS DECIDED: THE BUILDER PANEL WIDENS TO `clamp(480px, 38%, 640px)`
  AND VARIANT B SHIPS, GUTTER AND ALL.** Operator decision, 2026-08-28, at `/gsd:plan-phase`.
  Sketch `214-argument-form-and-its-source` §4 drew both tracks over byte-identical content and left
  the fork open precisely so a plan could not pick it silently.

  ⚠ **THE CONSEQUENCE IS A SAME-COMMIT PIN CHANGE, AND THE PINS ARE NAMED HERE SO THE PLAN CANNOT
  DISCOVER THEM MID-RUN** — the exact shape of Phase 213's `ConnectionFormPanel.test.tsx:571`.
  Measured with `grep -rn "400px" frontend/src` on 2026-08-28:
  - `frontend/src/pages/WorkflowBuilderPage.tsx:2817` — the live track:
    `gridTemplateColumns: "minmax(0,1fr) " + (panelOpen ? "400px" : "44px")`. ⚠ **The 44px collapsed
    strip is NOT part of this decision and does not change.**
  - `frontend/src/pages/WorkflowBuilderPage.test.tsx:167` — **asserts the literal string `"400px"`
    on the grid style. THIS IS THE PIN.** It changes in the same commit.
  - `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx:367` — the test NAME says *"the shipped
    400px form panel"*; its assertion is on panel presence, not width. **Rename, do not re-baseline.**
  - `frontend/src/components/workflows/WorkflowCanvas.composition.test.tsx:123,234` — the shared
    column and a 900px overflow case. ⚠ **Re-run both: the overflow arithmetic at line 234 was
    written against a 400px panel and a wider panel moves that boundary.**
  - Prose-only mentions to keep truthful in the same commit (no behaviour change):
    `PhaseFormPanel.tsx:30`, `WorkflowBuilderPage.tsx:25,27,60,958,2181,2806`,
    `ConnectionPicker.tsx:73,433`, `McpToolPicker.tsx:125,521`, `WorkflowCanvas.tsx:1337`.

  ⚠ **`frontend/src/components/settings/*` 400px references are the SETTINGS panel and are NOT in
  scope** — Settings already moved to this clamp at Phase 213. That is the point of the decision:
  after this change the two authoring panels are ONE track, not two.

  **The gutter's binding property** (sketch SC#5 / BUILD-CONTRACT row 3): the lane is a grid column
  that **widens** — `.arow` ships `grid-template-columns: 0 minmax(0,1fr)` and `.gutter-on` widens
  *that same column* to `118px`. It is never inserted. A sourced and an unsourced row must have
  **identical** label-column offsets.

- **D-214-23 - D-214-18's MEASUREMENT WAS TAKEN, AND IT REFUTES BOTH ARMS OF THE BINARY.** That
  decision says *"read `workflow_phases.error` for that failed phase and compare it against the
  `run_failed` frame"*, then branches on populated-vs-empty. **Measured against the live local DB on
  2026-08-28 (psycopg2, `127.0.0.1:54322`), the answer is a THIRD one neither arm predicted:**

  1. ⚠ **`workflow_phases` HAS NO `error` COLUMN.** Its columns are exactly
     `id, workflow_run_id, phase_index, slug, status, output, org_id, created_at, updated_at,
     started_at, completed_at`. The binary was posed against a column that does not exist.
  2. ⚠ **The run the bug names — `e2c0db68-dc94-4864-b7bd-afd0e163f69b` — is ABSENT from this
     database** (`select count(*) from workflow_runs where id = …` → **0**). It cannot be measured
     here, so the measurement was taken over the **whole failed population instead: 43 failed phase
     rows** — a stronger sample than one run.
  3. ✅ **THE REASON IS CAPTURED.** It lives at **`output._failure_reason`**, written by
     `backend/app/db/workflows.py:1835` (`payload = {**(output or {}), "_failure_reason": reason}`).
     A real external-action failure is in there verbatim:
     `"tool 'read_wiki_structure' refused: permission not granted"`.

  **So the defect is NOT the executor's failure path and NOT the emitter. It is the READ/SERIALIZE
  SEAM, and it has two independent halves — both must close or SC#5 stays false:**

  - **(a) NOTHING PROJECTS IT.** `load_run_phases` (`backend/app/db/workflows.py:1371-1386`) selects
    `id, slug, phase_index, status, output, started_at, completed_at` — and cannot select an error
    column that does not exist. On the frontend, `Phase.error` is documented at
    `frontend/src/types/index.ts:188` as *"error string from SSE terminal errorPayload … Only
    available for live-streamed runs (not backfilled from DB)"*. **`grep -rn "_failure_reason"
    frontend/src` returns ZERO hits.** So `classifyFailure` (`PhaseCard.tsx:236`) reads
    `phase.error ?? ""`, finds it empty on any reconciled or reloaded run, and fires the
    `reason_unknown` sentinel — **while the reason sits in the row.** ⚠ This is **D-v2.5-03**
    (*Realtime is a best-effort hint, never a source of truth — always reconcile via fetch*), and it
    is `BUG-260826-05`'s mechanism stated precisely.
  - **(b) THE COLUMN IS A JSONB STRING SCALAR ON MOST FAILED ROWS.** Of the **43** failed phase rows:
    **38 are `jsonb_typeof = 'string'`**; only **5 are `'object'`, of which only 2 carry the
    `_failure_reason` key.** A reader written as `output["_failure_reason"]` therefore finds the
    reason on **2 of 43** rows and reads empty on the rest. ⚠ **This is the SAME string-scalar trap
    already recorded for `workflow_phases.output`** (the `declared_phase_measure` finding that killed
    Phase 200's per-step count silently) — measured here on the FAILURE path for the first time. Any
    projection MUST parse the string arm, and **must be driven RED against a string-scalar row**, or
    it ships green and reads empty in production.

  ⚠ **`PhaseCard.tsx:253`'s `reason_unknown` fallback is CORRECT and must not be weakened** — it is
  an honesty mechanism. The fix is to stop it firing when the reason is known, by carrying the
  reason; never by removing the sentinel.

  ⚠ **The plan must NOT re-open this as research.** It is measured. The reproduction is
  `select jsonb_typeof(output), count(*) from workflow_phases where status='failed' group by 1`.

- **D-214-24 - NO RESEARCH.md AND NO VALIDATION.md ARE OWED FOR THIS PHASE.** Operator decision,
  2026-08-28: plan directly from this CONTEXT.md plus the four generated BUILD-CONTRACTs. Precedent
  is Phase 213, which shipped with neither. ⚠ **Recorded as a DECISION, not as a claim that Nyquist
  ran** — `nyquist_validation` is `true` in `.planning/config.json`, so plans carry no Dimension-8
  VALIDATION.md and their acceptance bars come from the sketch contracts and the failure-mode list
  above instead.

### Claude's Discretion

- The internal shape of `connectors/args.py` — function names, whether resolution and satisfiability
  are one module or two, how the source-arm resolution is factored.
- Whether the satisfiability check extends stage 2's lint or becomes a sibling lint stage
  (D-214-10) — *cheap and before the golden run* is the binding property, not the placement.
- Component decomposition of the argument editor beyond "it is not inline in `PhaseFormPanel.tsx`".
- Whether the shared step-identity element (D-214-16) lives beside `connectionMark.tsx`, moves it,
  or wraps it.
- Tailwind classes, spacing, hover/focus states — a human comparison at G-4, never a generated one.
- The exact wording of the STEP-03 refusal, provided it names **the step** and **the argument**.

### Folded Bugs and Seeds

- **⛔ `BUG-260826-01`** (a `send_email` step can never receive its arguments) — **FOLDED**, SC#2.
  The milestone's blocking defect on the shipped surface.
- **`BUG-260826-02`** (publish accepts a step nothing can satisfy) — **FOLDED**, SC#3.
- **`BUG-260826-05`** (a failed external step reports no reason on the panel) — **FOLDED**, SC#5.
  ⚠ **Measure first** (D-214-18).
- **`BUG-260828-01`** (the approval pause names the tool but never the service) — **FOLD INTO 214**.
  Its frontmatter reads `folded_into: null` today while STATE.md and the ROADMAP both route it here;
  **write the frontmatter in this phase's commit** — `status:` / `folded_into:` **IS** the index, and
  prose pointing at a bug is invisible to the scan.
- **`SEED-206`** (the service mark belongs on every step surface, not only the canvas) — **FOLDED**,
  D-214-16 / D-214-17. It is SC#4's second half verbatim.
- **`SEED-208`** (the describe door hands the generator its connections as vocabulary) — **FOLDED**,
  D-214-20 / D-214-21. Its `trigger_when` said *sequence AFTER `SEED-207`*, which Phase 211 discharged.
- **`BUG-260815-06`** — **NOT folded**; trigger fired and **deliberately declined** (D-214-13).
  Rewrite its `re_open_trigger` to record this firing, exactly as Phase 197's decline is recorded.
- **`SEED-214`** — stays `partially-folded`; only the *unlock* was folded at 213 and the *filling*
  half is out of scope here too.

</decisions>

<failure_modes>
## How we'd know this failed — candidate observables for the plan's G-6 section

1. **A `send_email` step still fails with `the 'to' recipient must be a string, got NoneType`** on a
   real run through any of the four doors (Test Run, chat, library Run, schedule). SC#2 unmet.
2. **A JSON textarea survives anywhere in the authoring flow** — including as a "for advanced tools"
   fallback. SC#1 unmet by its own words.
3. **The publish gate and the executor disagree**: a workflow passes the gate and then fails at the
   send for a *missing argument*. That is two copies of one predicate, and D-214-00 exists to
   prevent it.
4. **The approval pause shows fewer arguments than actually leave** — the defect D-214-15 exists to
   stop. Drive it with a step whose `to` is `Ask at launch` and whose `body` is `From an earlier
   step`: if the pause lists neither, it regressed.
5. **The pause still says `It will run "post_message" through post_message.`** on a capability row,
   or omits the service on an MCP row when the connection has a name. SC#4 / `BUG-260828-01` unmet.
6. **The panel says "Failure reason not captured by the backend" while chat shows the reason** —
   the two surfaces disagreeing at the same moment. SC#5 unmet.
7. **A criterion is verified only with `visual_workflow_canvas` flipped by hand and the cold default
   left `off`** — Phase 209's exact failure. D-214-19 unmet.
8. **The describe door drafts a Slack step for an author with no Slack connection**, or refuses
   without naming a next action.
9. **A ledger row is updated without its `docs/HOT-FILE-LEDGER.md` section in the same commit**, or
   a triple is copied forward rather than re-derived.
10. **`_check_input_contracts`'s `_KNOWN_RUN_INPUT_KEYS` is widened instead of the schema being
    consulted** — that would make the gate pass by loosening it, which is the opposite of STEP-03.

</failure_modes>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The G-2 acceptance bar — owed, read FIRST once it exists
- ✅ **THE G-2 BAR SHIPPED 2026-08-28 (`1d36f4057`) — four sketches, `587 assertions, 0 failing`.**
  Each is the 213 pattern (`COPY.js` + `index.html` + `drive.cjs` + a **generated**
  `BUILD-CONTRACT.generated.md`). **Read the four generated contracts FIRST — they are the
  acceptance bar, and no UI-SPEC.md is owed** (operator decision 2026-08-28; CLAUDE.md G-2 and Phase
  213's precedent, which shipped with no UI-SPEC.md):
  - `.planning/sketches/214-argument-form-and-its-source/` (141) — the argument form + its source
    picker. **§4 is the panel-track fork, now CLOSED by D-214-22.**
  - `.planning/sketches/215-publish-refuses-by-name/` (129) — STEP-03's refusal.
  - `.planning/sketches/216-the-mark-and-the-action-everywhere/` (138) — STEP-04 / STEP-05.
  - `.planning/sketches/217-the-door-that-knows-your-services/` (179) — STEP-06.
  - Step 1 (Stitch — never collapsed with the sketch, `SEED-155`):
    `.planning/sketches/214-stitch-step-names-service-and-action/`.
  ⚠ **Stitch drew `Cc` and `Reply to` rows for `send_email` that the backend STRUCTURALLY REFUSES** —
  `smtp_adapter.INPUT_SCHEMA` (`smtp_adapter.py:293-311`) declares exactly `to`, `subject`, `body`
  under `additionalProperties: False`, and `send()` raises `SmtpArgumentsInvalid` on any undeclared
  key (`smtp_adapter.py:337`). **Never render a field the schema does not declare** — it would
  typecheck, render and pass every frontend test while failing every real submission.
- `screenshots/…workflow-edit.webp` — the **xyOps** canvas bar: named action nodes, per-node glyphs,
  typed edges. Named by the ROADMAP as this phase's canvas reference.
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — auto-loads; the validated design decisions
  for the run surface, the phase spine, the builder panel and the workflow Studio.
- `.claude/skills/sketch-findings-agentic-rag/references/icon-convention.md` §1 and §4 — §1 is the
  one-source provider/model mark rule; **§4 is the canvas glyph vocabulary — read it before drawing
  any canvas mark.**
- `.planning/sketches/213-grants-and-the-approval-moment/BUILD-CONTRACT.generated.md` — the
  immediately-prior sketch's generated contract; the pattern this phase's sketch should follow.

### Requirements, scope and the phase's own record
- `.planning/ROADMAP.md` → *"#### Phase 214: A Step Names Its Service and Its Action"* — goal,
  five success criteria, and the Flags block (G-2, G-5, threat model, SC#10, the flag decision).
- `.planning/REQUIREMENTS.md:92-104` — **STEP-01 .. STEP-06** verbatim.
- `.planning/STATE.md` → *Current Position* — Phase 213's three recorded findings, of which #1 is
  `BUG-260828-01` routed here.

### The folded bugs — read all four
- `.planning/reported-bugs/BUG-260826-01-send-email-arguments-unreachable-from-every-launch-path.md`
  — ⛔ blocking; the argument-resolution table and the four launcher paths.
- `.planning/reported-bugs/BUG-260826-02-publish-gauntlet-does-not-validate-adapter-argument-satisfiability.md`
  — why the golden run cannot see it, and `_KNOWN_RUN_INPUT_KEYS`.
- `.planning/reported-bugs/BUG-260826-05-run-failed-reason-empty-for-external-action-failure.md`
  — **names the run id to measure against.**
- `.planning/reported-bugs/approval-pause-never-names-the-service.md` (`BUG-260828-01`) — both
  shapes' verbatim prompts.
- `.planning/reported-bugs/BUG-260815-06-structural-gate-refusal-names-nothing-actionable.md`
  — declined here; its `re_open_trigger` must be rewritten, not left as-is.

### The seeds
- `.planning/seeds/SEED-206-the-service-mark-belongs-on-every-step-surface-not-only-the-canvas.md`
  — **and its measured ClickUp hole.**
- `.planning/seeds/SEED-208-the-describe-door-hands-the-generator-its-connections-as-vocabulary.md`
- `.planning/seeds/SEED-199-xyops-canvas-grammar-triggers-constraints-connectors-as-nodes.md`
  — **deferred**; STEP-04 takes only the connector-mark half.
- `.planning/seeds/SEED-214-a-connection-offers-its-full-capability-not-one-verb.md` — the
  *filling* half stays planted.
- `.planning/seeds/SEED-156-both-authoring-doors-open-onto-the-same-first-screen.md` — the
  constraint behind D-214-21's rejected inline-connect arm.
- `.planning/seeds/SEED-185-the-app-has-no-router-twelve-views-zero-addressable.md` — no URL
  router; a detail route is not free.

### Prior-phase decisions this phase inherits
- `.planning/phases/213-per-tool-grants-and-the-approval-moment/213-CONTEXT.md` — **D-213-01/-02**
  (the unlock; *derive, do not store*), **D-213-04** (*"the authoring surface stays in Phase 214"* —
  this phase is that surface), **D-213-09/-10** (the armed checkpoint is the one pause),
  **D-213-14** (the receipt never carries arguments), **D-213-15/-16** (refusals composed in the
  backend gate).
- `.planning/phases/211-the-connection-is-a-service-not-a-verb/211-CONTEXT.md` — the service model,
  and why `ExternalActionSection` stopped asking for a category.
- `.planning/phases/212-the-catalog-and-its-doors/212-CONTEXT.md` — the catalog, `connectionMark`,
  and the egress hardening.

### The seams this phase rewrites
- `backend/app/services/harness/phase_types.py` — `_adapter_args` (:2151, the closed two-column
  lookup + `_BODY_ARG_FOR_CAPABILITY`), `_external_action_inputs` (:1861), `_NON_ACTION_RUN_INPUTS`
  (:1858), the MCP `tool_args` read (:2616), `_write_send_receipt`, `_interpolate_prior_run_variables`
  (:207 — **prompt text only; it does NOT touch `tool_args`**).
- `backend/app/services/harness/grounding.py:1279-1293` — `_external_action_clause`, the pure
  composer D-214-14 gives one new parameter.
- `backend/app/services/harness/reachability.py:55-88` — `_check_input_contracts` and
  `_KNOWN_RUN_INPUT_KEYS`; the nearest existing check and the natural home.
- `backend/app/services/harness/publish_service.py` — the 6-stage flow; **stage 2 is pure and
  short-circuits before the golden run**; stage 3's D-16 no-send block.
- `backend/app/services/connectors/descriptors.py:122-170` — `static_descriptors_for_capability`
  and `inputSchema`; the ONE reader over both shapes.
- `backend/app/services/connectors/protocol.py:184` — the `INPUT_SCHEMA` contract.
- `backend/app/services/connectors/jira_adapter.py:419-455` — a concrete `INPUT_SCHEMA` and its
  fail-closed unknown-key refusal.
- `backend/app/services/mcp_client.py:285-345` — the sanitizer allow-list carrying `inputSchema`,
  `title` and `outputSchema`. ⚠ **Widen it, never remove it.**
- `backend/app/services/connector_service.py:880-900` — re-discovery, the snapshot retake.
- `backend/app/models/harness.py:319` (`tool_args`), `:567` (`inputs: list[InputFieldSpec]`).
- `backend/app/models/user_settings.py:1192-1210` — `_GOVERNED_FEATURES`, the ONE cold default.
- `backend/app/dependencies.py:616-695` — `require_canvas`, the 404-before-auth gate.
- `frontend/src/components/workflows/McpToolPicker.tsx:68,202-280` — `MCP_TOOL_ARGS_LABEL` and the
  JSON `<Textarea>` **being deleted**.
- `frontend/src/components/workflows/ConnectionPicker.tsx:350-420,509-525` — `handleSelectTool`,
  `handleChangeArgs`, and the `tool_args`-clears-with-`tool_name` rule.
- `frontend/src/components/workflows/ExternalActionSection.tsx` — *one question, then one question*;
  ⚠ its three dead write-seam props carry a **re-open trigger: the first phase whose
  `files_modified` names `PhaseFormPanel.tsx`** — **that is this phase**, so they come out here.
- `frontend/src/components/workflows/library/RunModal.tsx:540-570` — the hint-line-only rendering
  and *"never fake structured fields"*.
- `frontend/src/components/workflows/doorVocabulary.ts:265` — `DESCRIBE_REFUSAL`.
- `frontend/src/components/settings/connectionMark.tsx` — the ONE service-to-mark map, with slugs
  verified against the installed package.
- `frontend/src/components/panel/PhaseCard.tsx:253` — the unknown-reason sentinel.

### Project rules that bind this phase
- `CLAUDE.md` → *Workflow guardrails* (G-1..G-7 + the hot-file ledger scan list), *UAT scoreboard
  recipe* (SC#10, the full native roster), *Parallel execution* (`GSD_VITEST_MAX_WORKERS=2`;
  bootstrap every worktree; never `rm -rf` one), *Deployment* (deploy-artifact parity, same commit).
- `docs/HOT-FILE-LEDGER.md` — the ten firing rows' sections; **same-commit sync rule.**
- `docs/CONNECTOR-ARCHITECTURE.md` — the MCP-first verdict.
- `.planning/prd-reset/DECISIONS.md` — **D-09** (no expression/templating surface), **D-16** (the
  golden run does not send), **D-19** (the armed checkpoint), **D-26** (`live_connectors`),
  **D-v2.5-01** (no blocking I/O in async handlers), **D-v2.5-03** (Realtime is a hint, reconcile
  by fetch), **D-27** (the push/split panel, locked for a 3-5 field form).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets — this phase EXTENDS, it does not rebuild

- **`descriptors.py` already emits `inputSchema` for BOTH shapes.** The adapter's `INPUT_SCHEMA`
  converted to plain JSON (`:169`) and the MCP server's own (`mcp_client.py:343`). **One field
  renderer, one source, no branch** — this is the single most load-bearing asset in the phase.
  Phase 211 widened the sanitizer to carry `outputSchema` specifically *"for Phase 214's argument
  satisfiability"*.
- **`ExternalActionSection` + `ConnectionPicker` already do STEP-01's service→action half.** The
  argument surface slots into an existing structure; nothing about the picking flow is redesigned.
- **`ExternalActionPhaseConfig.tool_args`** (`harness.py:319`) is a persisted, validated
  `dict[str, Any]` and the MCP branch already reads it (`phase_types.py:2616`). **The natural home
  exists** — the defect is that the native branch never consults it.
- **`InputFieldSpec` / `WorkflowDefinition.inputs[]`** (`harness.py:567`) already models a launch
  form with authored labels. `RunModal` renders it as a hint line **because nothing guaranteed the
  value would be used**; D-214-04 is what changes that.
- **`reachability.py::_check_input_contracts`** is the exact predicate shape STEP-03 needs, already
  running pure and pre-golden-run.
- **`connectionMark.tsx`** — the ONE service-to-mark map, with its vendor/vendorless rule already
  measured against the installed icon package.
- **`connector_service.py:880`** — re-discovery exists; D-214-07 needs no new route.
- **`DESCRIBE_REFUSAL`** (`doorVocabulary.ts:265`) — the governed-refusal precedent for D-214-21.
- **`connectors/grants.py`** (Phase 213) — the leaf-cut precedent D-214-00 follows.

### Established Patterns

- **Governed vocabulary, character-asserted.** Every user-visible string is a named export from a
  vocabulary module, asserted for character-identity by its suite. *A sentence that lives inside a
  component is a sentence nobody can test for drift.*
- **Computed never stored** (D-213-02, and Phase 187's node-face ladder). Descriptors, node faces
  and now the service name on a run surface are derived at read time.
- **Fail closed, in the gate — never on a column default** (Phase 213's `d359bd2b` correction).
- **A leaf that consults no server** — `ExternalActionSection` proves it with a `?raw` source fence
  plus a positive control. The argument editor should inherit that discipline where it can.
- **`GovernanceSection.tsx`'s whole-file shape** — a new panel surface is its own component plus one
  gated JSX expression in `PhaseFormPanel.tsx`.
- **The cold default lives in `_GOVERNED_FEATURES`; a flip is a JSONB merge, never a migration.**

### Integration Points

- `connectors/args.py` (**new**) ← called by both `phase_types.py`'s executor and the publish lint.
- The argument editor (**new**) ← mounted by `ConnectionPicker`, inside `ExternalActionSection`,
  inside `PhaseFormPanel.tsx`'s one gated line.
- The step-identity element (**new**) ← mounted by `PhaseCard`, `RunSpine`, `RunStepList`,
  `RunTranscript`, chat `RunCard`, and the approval pause.
- `WorkflowDefinition.inputs[]` ← written by the `Ask at launch` arm; read by `RunModal`, the
  schedule modal, and the new chat launch form.
- The engine → `_external_action_clause`, now with a resolved service name parameter.

### ⚠ What Phase 213 taught, that 214 must not rediscover

- **Green gates closed a phase whose headline feature did not exist.** At `93fc2f521` every gate was
  green and the approval moment was inert. **The post-flight refused it; a driven check found it.**
- **A test that MOCKS THE THING UNDER TEST proves only that the caller is self-consistent** (Phase
  212's D-1/D-2). This phase's argument resolution must have at least one test mocking *neither*
  side of the publish-gate/executor seam.
- **Two of five defects were found by the operator driving, after close.** G-4 exists for this.
- **A red gate is sometimes REAL** — `196-08`'s 249 failures were missing mocks, not flake. Capture
  failing filenames from the gate's persisted JSON *before* re-running anything.

</code_context>

<specifics>
## Specific Ideas

- The argument editor's per-argument control is a **source picker plus one input**, not a form
  builder. Three arms, named in the author's words, with the source always visible — *"the picker
  always shows a source; nothing silently fills anything."*
- The upstream binding names a phase **by the author's own name for it**, never by slug in the UI
  and never as an expression.
- The publish refusal names **the step and the argument** — the concrete shape being: the step's
  authored name, the argument's schema name, and why it cannot be supplied.
- The describe refusal's shape: *"Slack is not connected — connect it in Settings, or describe this
  step without it."* Two next actions, the author's own service name, and no draft.

</specifics>

<deferred>
## Deferred Ideas

- **`SEED-199` — the full xyOps canvas grammar** (two node classes, triggers/constraints/connectors
  as nodes, typed edges). STEP-04 takes only the connector-mark half. **A canvas phase in its own
  right**; seed stays `planted`.
- **`SEED-214`'s *filling* half** — growing any adapter's action set, adopting an MCP server for a
  thin-adapter service, or a generic OpenAPI/REST ingester. Out by the roadmap's own fence; must
  FOLLOW the approval model. Stays `partially-folded`.
- **`BUG-260815-06`** — the other five publish stages' refusal copy. Trigger **fired and declined**
  (D-214-13); rewrite the `re_open_trigger` to record this firing.
- **`BUG-260823-04`** (the run-answer rule picks the `llm_emit` status line over the substantive
  answer) — trigger is *"the next phase touching the run surface's answer selection"*. This phase
  touches step **identity** and **failure**, not answer selection. **Reviewed, not folded**; leave
  `open` and record the consideration.
- **Per-argument source annotation in the approval pause** (*"you typed this"* / *"from step 2"*) —
  considered under D-214-15 and rejected as copy weight. Re-open if a driven approval reads
  ambiguously.
- **An `output_key` sub-picker on the upstream binding** — rejected under D-214-02 because
  `output_keys` is unverified author-declared text. Re-open only when a phase's produced keys are
  themselves verified.
- **The `live_connectors` flip** — a separate armed decision (D-214-19). ⚠ Re-open trigger: **the
  first phase whose success criteria require a real outbound send to a third party.**
- **`SEED-185`** — the app has no URL router. Recorded as a standing constraint on any detail
  surface; unchanged by this phase.
- **`SEED-156`** — both authoring doors open onto the same first screen. The constraint behind
  D-214-21's rejected inline-connect arm; stays `open`.
- **`SEED-188`** — prompt-injection defences have no adversarial test. Trigger stays **Phase 216**.
  ⚠ Noted here because D-214-02 lets LLM-produced text reach a vendor as a named argument, which
  the threat model must address even though the adversarial *test* belongs to 216.
- **Panel layout / width for a step form carrying a field per argument** — the operator's standing
  objection to the 400px split (raised at 212, carried through 213). **Routed to the owed G-2
  sketch**, on the precedent 213 set. `D-27` locked the push/split panel for a 3-5 field form.
- **Whether a schedule's free-form `inputs` dict stays API-only** now that arguments have named
  sources — raised, not settled. Not blocking: D-214-09 requires only that the key be declared.

</deferred>

---

*Phase: 214-a-step-names-its-service-and-its-action*
*Context gathered: 2026-08-28*
