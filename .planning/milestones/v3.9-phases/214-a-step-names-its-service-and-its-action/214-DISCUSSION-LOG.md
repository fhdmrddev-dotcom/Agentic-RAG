# Phase 214: A Step Names Its Service and Its Action - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-28
**Phase:** 214-a-step-names-its-service-and-its-action
**Areas discussed:** Where arguments come from · The argument editor's shape · What publish refuses
and when · Service + action on run surfaces · The `visual_workflow_canvas` launch decision · The
describe door's vocabulary and refusal · The G-5 disposition

---

## Area selection

Six areas offered across two multi-select questions; **all six selected.** The G-5 disposition was
surfaced before any of them, per the orchestrator protocol, and ruled on at the end of the
discussion rather than at the start — the ruling depended on knowing what the phase would add to
`phase_types.py`.

---

## Where arguments come from (STEP-02)

| Option | Description | Selected |
|---|---|---|
| Per-argument source picker | Three arms per argument: `Fixed value` (stored in `tool_args`), `Ask at launch` (a real field in the launcher's form), `From an earlier step` (pick a phase, not write an expression). Makes "from every launch path" literally true. Cost: three arms to build, test, and give a publish story. | ✓ |
| Fixed values only — `tool_args` for both shapes | Author types everything at design time; `_adapter_args` starts reading `tool_args` as the MCP branch already does. Smallest change, furthest from D-09. Cost: a `send_email` step could only ever email the same person the same subject. | |
| Fixed + ask-at-launch, no upstream binding | Two arms; keeps the D-09 line bright and unarguable. Cost: `body` could still only come from the existing implicit upstream-text fill. | |

**User's choice:** Per-argument source picker.

---

| Option | Description | Selected |
|---|---|---|
| Pick a phase from a list — whole output only | Stores a phase slug; passes that phase's whole output. No dotted paths, no `{{ }}`, no field selection — structurally incapable of becoming an expression language. Is what `_adapter_args`'s existing `content`→body fill already does, made explicit and per-argument. | ✓ |
| Pick a phase AND a declared `output_key` | More precise — send one field rather than a wall of text. Cost: `output_keys` is author-declared `list[str]` that nothing verifies, so the picker could offer a key that never arrives — BUG-260826-01's own failure shape, one level up. | |
| No upstream binding at all | Drop the arm entirely. | |

**User's choice:** Pick a phase from a list — whole output only.

---

| Option | Description | Selected |
|---|---|---|
| The launcher must ask — chat grows a form too | `Ask at launch` writes into `WorkflowDefinition.inputs[]` and every launcher renders real fields, including a chat pre-launch step. SC#2 names library, thread and schedule explicitly, so a launcher that silently sends nothing fails the criterion. | ✓ |
| Chat launches ask nothing and the run REFUSES before spending | Refuse up front naming step and argument, rather than failing after 2–3 min of LLM spend. Cost: a whole class of workflow becomes chat-unlaunchable. | |
| The agent fills it from the conversation | Chat is the one launcher with a model in the loop; show the choice at the armed checkpoint. Cost: an LLM decides a recipient address — a new trust surface, not reproducible between runs. | |

**User's choice:** The launcher must ask — chat grows a form too.

---

| Option | Description | Selected |
|---|---|---|
| The body auto-fill becomes a visible default | A new step's body-class argument arrives pre-set to `From an earlier step → <previous phase>` — same behaviour, author can see and change it. Removes `_BODY_ARG_FOR_CAPABILITY`'s status as an invisible rule. | ✓ |
| Delete it — every argument explicit or absent | Cleanest; the publish gate then proves every argument has a source. Cost: a behaviour change on shipped steps, needing grandfathering. | |
| Leave it as-is, underneath the picker | Smallest blast radius. Cost: one argument playing by different rules than the rest — and an invisible rule is what BUG-260826-01 was. | |

**User's choice:** It becomes a visible default, not a hidden one.

**Notes:** The invisible-rule framing was the deciding factor in both this and the upstream-binding
question. No free-text follow-ups.

---

## The argument editor's shape (STEP-01)

| Option | Description | Selected |
|---|---|---|
| Render what we can, refuse the rest by name | Flat scalars get real fields; an unrenderable shape names itself, and if required the step is unsatisfiable so publish refuses it. A JSON escape hatch is the surface SC#1 forbids under another name. | ✓ |
| Fields for what we can, a JSON box for the rest | Pragmatic; nobody is locked out. Cost: re-introduces the forbidden surface, and every hard case routes to it — how `Tool Arguments (JSON)` became the only surface. | |
| Build a real recursive schema form | Most capable, nothing unreachable. Cost: a component of its own scope, on a phase carrying six criteria and a threat model — and no shipped adapter needs it. | |

**User's choice:** Render what we can, refuse the rest by name.

---

| Option | Description | Selected |
|---|---|---|
| Say so, offer to re-discover, author nothing | No invented fields, no JSON. Re-discovery already exists (`connector_service.py:880`). Publish refuses a step whose arguments are unknown — "unknown" and "satisfied" must not look the same. | ✓ |
| Fall back to free-form key/value rows | Structured rows, not raw JSON, so SC#1's letter holds. Cost: nothing validates the keys — reproduces `output_keys`' failure shape. | |
| Block the binding entirely | Strictest. Cost: a transient discovery failure makes a working connection unauthorable. | |

**User's choice:** Say so, offer to re-discover, author nothing.

---

| Option | Description | Selected |
|---|---|---|
| Read existing `tool_args` into the fields; surface unmatched keys | Matching keys populate as `Fixed value`; undeclared keys shown as removable leftovers. The adapter already fails closed on an undeclared key, so a silent drop would hide an already-broken step. | ✓ |
| Read what matches, drop the rest silently | Simplest. Cost: a step stops sending an extra key with nothing said, on an outbound path. | |
| Leave old steps on the old editor | No migration risk. Cost: two authoring surfaces, and SC#1 stays false for anything authored before this phase. | |

**User's choice:** Read them into the fields; surface unmatched keys.

---

| Option | Description | Selected |
|---|---|---|
| Builder warns, publish refuses | The step form and canvas node show the incompleteness; nothing blocks mid-edit; publish is the enforcing gate. Matches the gauntlet's role as the quality wall, not the typing experience. | ✓ |
| Builder blocks the save | An unsatisfiable step never exists in the DB. Cost: every partially-authored workflow becomes unsaveable. | |
| Publish only — the builder says nothing | Cheapest. Cost: the author learns at publish what they could have known while typing — the same "expensive and late" complaint. | |

**User's choice:** Builder warns, publish refuses.

---

## What publish refuses, and when (STEP-03)

Placement (extend stage 2's lint vs. a sibling stage) was explicitly **not** put to the user —
recorded as Claude's discretion, with *cheap and before the golden run* as the binding property.

| Option | Description | Selected |
|---|---|---|
| Each arm proved on its own terms | Fixed → non-empty stored; upstream → the named phase exists and is upstream; ask-at-launch → the key is declared in `inputs[]` so a form can render it. Any arm unproved ⇒ refused, naming step and argument. | ✓ |
| A source being chosen is enough | Simple and fast. Cost: ask-at-launch with no `inputs[]` entry is BUG-260826-01 again — the shape that shipped once already. | |
| Also require the golden run to observe it arriving | Strongest guarantee. Cost: the golden run deliberately does not attempt the send (D-16) so publishing cannot fire a real email; changing that is a safety decision. | |

**User's choice:** Each arm proved on its own terms.

---

| Option | Description | Selected |
|---|---|---|
| Fold only the new refusal — write it right, fix nothing else | STEP-03's refusal names step and argument from birth; the other five stages' copy is untouched; BUG-260815-06 stays `open` with its trigger re-armed. Same disposition Phase 197 gave it, same reasoning. | ✓ |
| Fold it fully — fix the whole gauntlet's refusal copy | The cause is stored one table away; surface it everywhere. Cost: repair on five untouched stages, on a G-5 file, in a phase already carrying a threat model. | |
| Defer and say so | Leave it open, touch nothing, record the trigger as fired-and-declined. | |

**User's choice:** Fold only the new refusal — write it right, fix nothing else.

---

| Option | Description | Selected |
|---|---|---|
| The golden run validates the args it resolved, still sends nothing | It already resolves what it would have sent; running the adapter's schema validation over that object costs nothing and catches a source that is structurally fine but resolves empty or wrong-typed. D-16's no-send line untouched. | ✓ |
| No — the static gate is enough | Keeps the D-16 block untouched entirely. Cost: a step whose source resolves to an empty string still publishes. | |

**User's choice:** Yes — validate the resolved args, still send nothing.

---

| Option | Description | Selected |
|---|---|---|
| Nothing retroactive; the gate binds the next publish | Published workflows keep running and keep failing honestly, with STEP-05's real reason now shown. No migration, no mass invalidation. | ✓ |
| Flag them in the library | Findable without running one. Cost: a sweep over stored definitions and a new library state — a capability the criteria do not ask for. | |
| Refuse to RUN them | Answers the "expensive and late" complaint directly. Cost: un-runs live rows without warning. | |

**User's choice:** Nothing retroactive; the gate binds the next publish.

---

## Service + action on the run surfaces (STEP-04 / STEP-05)

A finding was surfaced to the user before these questions: `_external_action_clause` renders
`config.tool_args` into the approval sentence's *"What it will send"*, so under the new source model
the pause would show only the fixed values and silently omit the ones that vary — **a defect this
phase would create.** It was accepted as in-scope without objection.

| Option | Description | Selected |
|---|---|---|
| The caller resolves the service and passes it in | The engine has a pool and already reads the connection; the composer stays pure and gains one parameter. Absent name still omits the clause. | ✓ |
| Store the service name on the step config at bind time | Composer needs nothing new. Cost: a stored copy of a derived fact — rename the connection and the step lies. D-213-02 rejected exactly this shape. | |
| Resolve it in the composer — make it impure | Simplest call sites. Cost: every shipped test becomes an integration test, and a function on the approval path gains an I/O failure mode. | |

**User's choice:** The caller resolves it and passes it in.

---

| Option | Description | Selected |
|---|---|---|
| The pause shows the fully resolved argument object | What will actually leave, composed after resolution. A person approves the send, not the template. D-213-14 still holds — shown once, never written to the ledger. | ✓ |
| Resolved values, with each argument's source named | A person learns not just what leaves but why it has that value — where a prompt-injected value would show itself. Cost: more governed copy, and the sentence is already long. | |
| Keep showing `tool_args` only | No composer change. Cost: names the constants, omits the variables — worse than showing nothing on an approval surface. | |

**User's choice:** The fully resolved argument object.

**Notes:** The source-annotation variant was explicitly passed over on copy weight, and is recorded
in CONTEXT.md's deferred list with a re-open trigger (a driven approval reading ambiguously).

---

| Option | Description | Selected |
|---|---|---|
| Every surface a run appears on | Panel `PhaseCard`/`PhaseTimeline`, `RunSpine`/`RunStepList`/`RunTranscript`, chat `RunCard`, and the approval pause. SEED-206's own warning is "do NOT wait". Cost: the widest file list in the phase, several G-5 rows. | ✓ |
| The panel + the run page only | The two surfaces SC#4 names literally; chat is arguably 216's ground. Cost: SEED-206 stays partly true. | |
| One shared component, mounted wherever it fits | Coverage becomes a consequence of the component existing rather than a list to keep in sync. | |

**User's choice:** Every surface a run appears on. (The third option's mechanism was adopted anyway
in CONTEXT.md D-214-16 — one shared element — since it is how the first option is best achieved.)

---

| Option | Description | Selected |
|---|---|---|
| Confirm against the DB first, then fix where it's actually missing | The bug names the run id and says outright to confirm before fixing. Populated column ⇒ fix the emitter; empty ⇒ fix the executor's failure path. | ✓ |
| Make the panel reconcile via fetch | Robust either way, and matches D-v2.5-03. Cost: papers over an emitter that drops a field, and the gap reaches any other consumer of that event. | |
| Fix the emitter only | Cost: if the row is also empty this fixes nothing and the sentinel keeps firing correctly. | |

**User's choice:** Confirm against the DB first.

**Notes:** `connectionMark.tsx` was surfaced as already answering SEED-206's measured ClickUp hole
(vendor mark / vendorless neutral ink, slugs verified against the installed package), so the mark
itself was never put to the user as a decision.

---

## The `visual_workflow_canvas` launch decision

The user was told there are **two** off-by-default flags, not one — `visual_workflow_canvas` and
`live_connectors` (Phase 190 / D-26) — and that both must be flipped for any 214 criterion to be
true on a real install.

| Option | Description | Selected |
|---|---|---|
| Flip it to `everyone` in this phase | The canvas has shipped through five phases and is the surface the milestone governs; left off, SC#1/#3/#4 render for nobody. `live_connectors` stays a separate armed decision. | ✓ |
| Keep it off; verify behind an operator flip | Honest, and exactly what Phase 209 did. Cost: also exactly what the ROADMAP flags as the problem — 209's drive shipped nothing to anyone. | |
| Flip it, and decide `live_connectors` here too | Settles both; 212/213 shipped the stated preconditions. Cost: makes 214 the phase that arms real outbound for every user — a bigger decision than its criteria describe. | |

**User's choice:** Flip `visual_workflow_canvas` to `everyone` in this phase; leave `live_connectors`
as a separate armed decision.

---

## The describe door (STEP-06)

| Option | Description | Selected |
|---|---|---|
| The author picks their services before the AI drafts | SEED-208's own proposal. The generator's vocabulary is the chosen set, so an unconnected-service step is structurally impossible rather than caught afterwards. | ✓ |
| Injected silently; refuse post-draft | Less UI, catches cases the author never considered. Cost: a model-behaviour guarantee — the class that produced "a step that validates and fails at 03:00". | |
| Both — picker AND post-draft validation | Belt and braces. Cost: two mechanisms to keep in agreement, on a first screen SEED-156 already calls crowded. | |

**User's choice:** The author picks, before the AI drafts.

---

| Option | Description | Selected |
|---|---|---|
| Name the service, name the next action, don't draft | *"Slack is not connected — connect it in Settings, or describe this step without it."* Two real next actions; the service name comes from what the author wrote, so no catalog lookup is needed. | ✓ |
| Draft everything else, mark the gap | Preserves momentum. Cost: a draft with a hole can be published if the hole is missed, and STEP-03's gate is a different gate at a different moment. | |
| Refuse, and offer to connect it inline | Strongest next action. Cost: a second door onto Settings on a screen SEED-156 already flags. | |

**User's choice:** Name the service, name the next action, don't draft.

---

## The G-5 disposition

| Option | Description | Selected |
|---|---|---|
| Take the leaf cut — `connectors/args.py` | Argument resolution + the satisfiability predicate leave as a pure module, on 213's `grants.py` precedent. The publish gate and the executor need the *same* predicate and duplicating it guarantees drift. The frontend half discharges by construction and the plan must argue that. | ✓ |
| Honour by construction only — argue it, extract nothing | Cost: the file grew 2664 → 2733 since the ledger cell was written, and "honoured by construction" is the disposition four rows already carry. | |
| Dedicated refactor phase first, 214 after | Strictest reading of G-5. Cost: 214 closes the milestone's one BLOCKING defect; a refactor phase in front of it delays that with no user-visible change. | |

**User's choice:** Take the leaf cut — `connectors/args.py`.

---

## Claude's Discretion

- The internal shape of `connectors/args.py` — module count, function names, factoring of the
  source-arm resolution.
- Whether the satisfiability check extends stage 2's lint or becomes a sibling lint stage.
- Component decomposition of the argument editor beyond "not inline in `PhaseFormPanel.tsx`".
- Whether the shared step-identity element lives beside `connectionMark.tsx`, moves it, or wraps it.
- Tailwind classes, spacing, hover/focus states.
- The exact wording of the STEP-03 refusal, provided it names the step and the argument.

## Deferred Ideas

- `SEED-199` — the full xyOps canvas grammar. A canvas phase in its own right.
- `SEED-214`'s *filling* half — growing any adapter's action set. Out by the roadmap's own fence.
- `BUG-260815-06` — the other five publish stages' refusal copy. Trigger fired and **declined**.
- `BUG-260823-04` — the run-answer selection rule. **Reviewed, not folded**: this phase touches step
  identity and failure, not answer selection.
- Per-argument source annotation in the approval pause — rejected on copy weight, with a re-open
  trigger.
- An `output_key` sub-picker on the upstream binding — rejected because `output_keys` is unverified.
- The `live_connectors` flip — separate armed decision, re-open trigger recorded.
- Panel layout / width for a step form carrying a field per argument — routed to the owed G-2 sketch.
- Whether a schedule's free-form `inputs` dict stays API-only — raised, not settled, not blocking.
- `SEED-185` (no URL router) and `SEED-156` (both doors, one first screen) — standing constraints.
- `SEED-188` (no adversarial prompt-injection test) — trigger stays Phase 216, but noted because the
  upstream-binding arm lets LLM-produced text reach a vendor as a named argument.
