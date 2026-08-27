# Phase 213: Per-Tool Grants and the Approval Moment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-27
**Phase:** 213-per-tool-grants-and-the-approval-moment
**Areas discussed:** The 1:1 unlock's landing · Posture storage + the back-compat cliff · The approval moment's mechanism · Refusal + receipt reach

**Opened with a guardrail surface, not with the feature** (orchestrator protocol): G-2 ✅ satisfied
by the existing sketch; **G-5 fires on seven files** and three ledger cells were measured stale;
`phase_types.py`'s obligation reads **OWED**. The refactor recommendation (two named cuts) was
presented before any gray area. See CONTEXT.md `<guardrails>`.

---

## The 1:1 unlock's landing (SEED-214)

### Q1 — How much does 213 change `static_descriptors_for_capability`?

| Option | Description | Selected |
|--------|-------------|----------|
| Mechanism only — nothing new in the lists | Returns N; Slack/Jira/SMTP still show one each. SC#1 becomes satisfiable and stays honest. Roadmap already fences "filling the lists" out. | ✓ |
| Mechanism + one honest second action | Add e.g. Slack `list_channels` to prove >1 row. Cost: a new outbound capability shipped alongside the approval model the standing rule says must precede it. | |
| Mechanism + a non-shipping proof | Return N, ship one, prove many-rows in fixtures. Cost: the operator can never SEE a multi-row capability connection in 213. | |

**User's choice:** Mechanism only.
**Notes:** Keeps the roadmap's own scope fence intact — per-service breadth follows the approval model, never accompanies it.

### Q2 — Where do a capability connection's descriptors live?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep deriving — computed not stored | `discovered_tools` stays MCP-only; capability lists computed from the adapter registry, uncapped. Nothing to migrate or sync. | ✓ |
| Write descriptors into `discovered_tools` too | One field for every reader; shapes become truly indistinguishable. Cost: a stored copy of a derived fact, plus backfill + re-sync. | |

**User's choice:** Keep deriving.
**Notes:** Matches Phase 187's computed-never-stored rule and `descriptors.py`'s own refusal to duplicate `INPUT_SCHEMA["required"]`.

### Q3 — What does the grant screen do for a 1-action connection?

| Option | Description | Selected |
|--------|-------------|----------|
| Identical apparatus, one row | Same screen as GitHub's 44, just short. No special case; nothing changes the day Slack gains a second action. | ✓ |
| Hide search below a threshold | Less noise on short lists. Cost: a conditional surface and an unjustifiable magic number. | |
| Collapse to a single switch | One action means connection-grant and action-grant coincide. Cost: ⚠ builds UI on the coincidence BUG-260827-02 says is about to stop being true. | |

**User's choice:** Identical apparatus, one row.

### Q4 — Does 213 fix the workflow authoring pickers?

| Option | Description | Selected |
|--------|-------------|----------|
| Leave it — 214 owns the authoring surface | 214 IS "A Step Names Its Service and Its Action"; its stated dependency is 213's *granted* tools as vocabulary. | ✓ |
| Fix the picker here too | Multi-action connections authorable immediately. Cost: pulls STEP-01/06 forward and adds two more G-5 rows. | |
| Leave it, but assert the seam | A characterization pin of today's behaviour with a >1-action capability connection. | |

**User's choice:** Leave it — 214 owns it.
**Notes:** Building it here would be the G-7 failure mode (a closure surface growing a new capability).

---

## Posture storage + the back-compat cliff

### Q1 — How does `tool_grants` change shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Migrate in place to a posture map | `Record<string,'allow'\|'ask'\|'deny'>`; mig 128 rewrites `true`→`'allow'`, drops `false` keys. One field, one reader. | ✓ |
| New `tool_postures` column beside it | Nothing shipped breaks day one. Cost: ⚠ two spellings of one fact with nothing holding them in agreement. | |
| Keep boolean, posture on the connection only | Cheapest. Cost: kills GRANT-02's per-tool override and the sketch's whole "You changed this" mechanism. | |

**User's choice:** Migrate in place.
**Notes:** Every shipped `=== true` read must move in the same commit — enumerable by grep.

### Q2 — ⚠ Absent key: today DENY, tomorrow INHERIT

| Option | Description | Selected |
|--------|-------------|----------|
| Absent = inherit, default's FLOOR is "Ask first" | The sketch's model. Safety held by never letting a default reach Allow silently: new connections default to `ask`. Nothing armed by a row merely existing. | ✓ |
| Absent = inherit, any default allowed | Honest to what the person asked for. Cost: ⚠ one click arms 44 actions including `delete_repository`. | |
| Keep absent = deny; store `inherit` explicitly | Absence keeps its fail-closed meaning. Cost: a fourth state; 44 keys written on first save; "newly discovered tool" has no absence to fall into. | |

**User's choice:** Absent = inherit, with an "Ask first" floor.
**Notes:** The sharpest edge in the phase — a deliberate flip of the asymmetry `descriptors.py` names as the safe direction, with the safety re-established one level up.

### Q3 — What does migration 128 backfill?

| Option | Description | Selected |
|--------|-------------|----------|
| Grandfather what was TRUE, arm nothing new | Per shape: MCP → `default_posture='deny'` + `true`→`allow` (zero widening); capability → explicit `allow` for its own capability id + `default_posture='deny'`. | ✓ |
| Deny everything, make people re-grant | Cleanest security story. Cost: every shipped external_action workflow breaks silently at next run. | |
| Backfill "ask first" everywhere | Nothing silently denied or sent. Cost: converts every unattended/scheduled run into a blocked one. | |

**User's choice:** Grandfather what was true.
**Notes:** Preserves *observed* behaviour per population rather than applying a uniform rule to two populations that behave differently today.

### Q4 — The column-grant trap

| Option | Description | Selected |
|--------|-------------|----------|
| Grant in the same migration, driven RED first | Column + GRANT in one file; the plan drives a read before the grant so the 42501 is SEEN. Cloud parity ships as one operation. | ✓ |
| Grant in the same migration, no RED drive | Cheaper. Cost: an unproven guard. | |
| Avoid the column — a reserved key in the jsonb | No new column. Cost: ⚠ collides with a tool literally named `__default`; hides a connection fact inside a per-tool structure. | |

**User's choice:** Same migration, driven RED.

---

## The approval moment's mechanism

### Q1 — Same checkpoint, or a second one?

| Option | Description | Selected |
|--------|-------------|----------|
| Two triggers, ONE pause | Posture becomes a second reason the existing armed checkpoint fires; its prompt gains service/tool/arguments. One pause, one resume path; the resume sweep's two armed readings don't grow a third. | ✓ |
| A distinct grant-approval pause | Clean conceptual separation. Cost: an armed step whose tool is also "Ask first" asks twice. | |
| Posture SUPERSEDES the armed checkpoint | One prompt always. Cost: ⚠ a connection-level Allow would silently un-arm every external step, disarming a guarantee `models/harness.py:517` coerces to True. | |

**User's choice:** Two triggers, one pause.
**Notes:** The roadmap's "two gates must differ" is honoured elsewhere — grant-time must not key on direction; run-time may.

### Q2 — Reachability: the ask has no home on `WorkflowRunPage`

| Option | Description | Selected |
|--------|-------------|----------|
| Render the ask on the run page too | Reuse `PendingAskStack`; lands as a section component (WorkflowRunPage.tsx is 25/8/1601, G-5 fires). G-4 drives BOTH surfaces. | ✓ |
| Chat only — name the gap and defer | Honest about what shipped. Cost: ⚠ the operator's own launch path is the library, so the first drive hits the broken one. | |
| Block the pause where it can't be answered | Never strands a run. Cost: punishes the person for a UI gap. | |

**User's choice:** Render it on the run page too.
**Notes:** Measured, not assumed — `ChatLayout.launch.test.tsx:502` asserts `WorkspacePanel` mounts only in the chat branch. Same shape as the Phase 194 finding (no Stop control on `WorkflowRunPage`).

### Q3 — Does "Always allow X on this connection" ship?

| Option | Description | Selected |
|--------|-------------|----------|
| Ships, as an explicit opt-in with its own receipt | Not the default action; copy already says it changes the setting; writes an audit row naming who widened a permission mid-run. | ✓ |
| Ships, but never for a destructive action | Approve-once only on "Cannot be undone" rows. Cost: ⚠ the tag derives from metadata measured ABSENT on the one reachable server — a rule enforced by untrustworthy data. | |
| Cut it — approve once, or go to Settings | Simplest trust story. Cost: the only escape from a nagging prompt becomes the blunt one (set the connection to Allow). | |

**User's choice:** Ships, with its own receipt.

### Q4 — What happens when nobody answers?

| Option | Description | Selected |
|--------|-------------|----------|
| Waits indefinitely, no countdown | Phase 185 already replaced the countdown with an honest line for armed approvals; `PendingAskCard.tsx:249` records this class waits indefinitely. Sketch invariant #9 satisfied by a shipped mechanism. | ✓ |
| Times out into a REFUSAL | Bounds an unattended run. Cost: an invented constant; "the run waits for you" becomes false. | |
| Times out, and the run FAILS | Explicit dead end. Cost: every scheduled run touching an Ask-first tool becomes a scheduled failure. | |

**User's choice:** Waits indefinitely.

---

## Refusal + receipt reach

### Q1 — How does GRANT-05's receipt reach every call?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse `external_action_sent` for both shapes | MCP arm starts writing it; metadata gains `tool_name`. No new kind, no rival vocabulary. | ✓ |
| A new `tool_called` kind for the MCP arm | Distinguishes MCP from first-party in the ledger. Cost: two-layer registration risk; re-splits the distinction SEED-214 is erasing. | |
| Receipt only on refusal + approval | Cheapest. Cost: GRANT-05 says *every* outbound call; a refusal-only ledger can't answer what a connection has done. | |

**User's choice:** Reuse `external_action_sent`.

### Q2 — ⚠ D-08 vs. the approval moment showing arguments

| Option | Description | Selected |
|--------|-------------|----------|
| D-08 HOLDS — add `tool_name` + outcome, never arguments | All four of GRANT-05's facts fit inside D-08; a tool NAME is not its payload. Showing arguments once, to one person, is a different act from writing them down. | ✓ |
| Also record a hash / shape of the arguments | Proves the approved call is the call made. Cost: a hash of an email address is still a strong identifier of it. | |
| Record arguments on APPROVED calls only | If a person said yes, the record is theirs. Cost: ⚠ persists exactly the most sensitive payloads — inverts the safe direction. | |

**User's choice:** D-08 holds.

### Q3 — Where does the refusal copy live?

| Option | Description | Selected |
|--------|-------------|----------|
| Composed in the backend gate, from the sketch's copy | Reaches every surface (chat, run page, panel, ledger) without four renderers agreeing; non-UI consumers still get a sentence. Two homes, each owning its own surface. | ✓ |
| Backend returns structured reason, frontend renders words | One copy table, no duplication. Cost: ⚠ the ledger and non-UI consumers get no sentence — BUG-260815-06 restated. | |
| Reuse the existing sentence, just extend it | Minimal diff. Cost: keeps the mechanism-naming voice (`posture`, `permission`, `integration`) the sketch deliberately replaced. | |

**User's choice:** Composed in the backend gate.

### Q4 — Does the ledger distinguish the three ways a call can be stopped?

| Option | Description | Selected |
|--------|-------------|----------|
| One kind, a `reason` that tells them apart | `tool_refused` already carries `reason`; add distinct values. No new-kind lockstep risk; audit-browser chips keep working. | ✓ |
| A separate kind for the human denial | A person saying no is arguably its own category. Cost: a new kind in two places, same commit, plus new chips. | |
| Don't distinguish — refused is refused | Simplest. Cost: ⚠ the ledger can't show a human ever exercised the approval gate — the one thing this phase makes legible. | |

**User's choice:** One kind, distinct reasons.

---

## Register cross-checks (MANDATORY touchpoints)

### Reported bugs

| Bug | Routing chosen | Written back |
|---|---|---|
| `BUG-260827-02` — capability connections bypass the tool-grant gate | **FOLDED into 213** (named by SC#4) | `status: folded`, `folded_into: 213` |
| `BUG-260826-01` — send_email arguments unreachable from every launch path | → **214** | `folded_into: 214` |
| `BUG-260826-02` — publish gauntlet doesn't validate adapter argument satisfiability | → **214** | `folded_into: 214` |
| `BUG-260826-05` — failed external_action shows no reason in the panel | → **214** | `folded_into: 214` |
| `BUG-260815-06` — structural gate refusals name nothing actionable | **left open**; D-213-15 written so 213 does not add to it | unchanged |

**User's choice on the three 214-shaped bugs:** write `folded_into: 214` now rather than leave it to
214's discuss-phase — because until now only ROADMAP prose pointed at them, and `status:` /
`folded_into:` frontmatter IS the index.

### Seeds

| Seed | Routing chosen | Written back |
|---|---|---|
| `SEED-214` — full capability, not one verb | **UNLOCK folded** into 213; **FILLING stays planted** | `status: partially-folded` + a routing note recording that triggers 2/3/4 remain live and trigger 1 is discharged |
| `SEED-188` — prompt-injection defences have no adversarial test | **left planted**, trigger named as **216** | unchanged; recorded in CONTEXT `<deferred>` so it isn't handled by neither phase |
| `SEED-185` — the app has no URL router | recorded as the constraint behind Layout A | unchanged |

---

## Claude's Discretion

- The internal shape of the backend leaf module (`connectors/grants.py`) — function names, whether
  posture resolution is one function or two, how the shared both-shapes reader is factored.
- Component decomposition of the grant list beyond "not inline in `ConnectionFormPanel.tsx`".
- Tailwind class choices, hover/focus states, spacing — the sketch says no generated contract can
  catch these; they stay a human comparison at G-4.
- The exact `reason` string values, provided the three refusal cases stay distinguishable.

## Deferred Ideas

- SEED-214's *filling* half (adapter action sets, MCP adoption for thin-adapter services, an OpenAPI
  ingester) — fenced out by the roadmap; must follow the approval model.
- The workflow authoring surface (`ConnectionPicker`, `McpToolPicker`, `ExternalActionSection`,
  `PhaseFormPanel.tsx`) → Phase 214.
- Connections in chat (`_TOOL_REGISTRY`, service chip, starter prompts, attach) → Phase 216.
- Prompt-injection adversarial testing (SEED-188) → Phase 216, where a read path first exists.

## Gray areas offered but not taken

Named at the close, in case a later round wants them: what a NEWLY DISCOVERED tool inherits after a
re-discovery (D-212-13 says ungranted — does that survive the posture migration?); whether the grant
screen is org-admin-only; and what SC#10's 8-row provider roster means for a phase whose defining
behaviour is pausing a live run.
