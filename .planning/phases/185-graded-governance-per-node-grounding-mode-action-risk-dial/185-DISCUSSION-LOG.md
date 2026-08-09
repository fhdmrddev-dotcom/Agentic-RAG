# Phase 185: Graded Governance — Per-Node Grounding Mode + Action-Risk Dial - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-29
**Phase:** 185-graded-governance-per-node-grounding-mode-action-risk-dial
**Areas discussed:** What the gate checks, Where the field sits, Who computes detection, How the checkpoint runs, Dial scope by step type, G-4 lived-experience UAT

**Guardrails fired at open:** G-5 (hot-file ledger — pre-resolved by SPEC as honoured-by-construction),
G-4 (lived-experience UAT — collected below), G-2 (satisfied; sketches 142–147 approved and packaged).

---

## What the gate checks

**Framing finding presented before questions:** `citations_required`'s default `deterministic` mode reads
`output["field_map"]` (`validator_kinds.py:224`), which only `llm_emit` produces — but detection only fires
on `llm_agent` / `llm_batch_agents`. Attached unchanged, every detected step fails 100% of the time.
Counter-finding: those steps DO carry real retrieval evidence (`citations` / `source_refs` /
`similarity_scores`), just not in the shape `check_coverage` wants.

| Option | Description | Selected |
|--------|-------------|----------|
| Real evidence + marker | New deterministic mode: FAIL if `citations` is empty AND require ≥1 marker in text. The `citations` half cannot be faked — the objects come from the retrieval tool, not the model's prose | ✓ |
| Real evidence only | FAIL only when `citations` is empty. Zero regex tuning, zero false failures — but the answer can be backed by a retrieval the prose never used | |
| Marker presence only | Reuse the shipped `presence` mode as-is. Zero new code — but a step that retrieved nothing and hallucinated "[1]" passes. Closest to theatre | |
| You decide | Let research sample the live corpus first | |

**User's choice:** Real evidence + marker
**Notes:** Derived consequence recorded as D-185-02 — the panel's "what this gate does" sentence cannot
reuse the emit-path wording, because `check_coverage`'s "every value traceable" needs a structured leaf set
and free prose has none.

| Option | Description | Selected |
|--------|-------------|----------|
| Parse-time effective phase | Synthesize into `phase.validators` at PhaseSpec parse. Every downstream mechanism unchanged (index routing, retry rebinding, audit, SSE); visible to `/validate` + gauntlet for free | ✓ |
| Inside run_gates | Smallest surface — but `validator_index` points past the caller's list and `harness_engine.py:684-694` + `_route_on_failure` both index into it | |
| Engine loop, before run_gates | Indices stay consistent — but the gate is invisible to `/validate`, the publish gauntlet, and anything reading a definition without running it | |
| You decide | Let planning choose after confirming who reads `phase.validators` | |

**User's choice:** Parse-time effective phase

| Option | Description | Selected |
|--------|-------------|----------|
| Retry w/ feedback, then fail_run | `max_retries: 2`; the failure message names what was missing and rides the existing retry-feedback loop, mirroring `_exec_llm_emit`'s cite-or-null rounds | ✓ |
| fail_run immediately | `max_retries: 0`. Cheapest — but turns a recoverable "forgot the bracket" into a dead run for 36 live corpus steps | |
| Route to ask_user (HITL) | GOVERN-01's "route to HITL" read literally — but 185 ships no run surface, so it parks runs behind a chat prompt the SPEC left alone | |

**User's choice:** Retry w/ feedback, then fail_run

| Option | Description | Selected |
|--------|-------------|----------|
| Engine's gate always runs too | Both specs run, first failure wins — makes "not author-loosenable-away" structural, not trusted. A deliberately weak declared gate cannot displace the real one | ✓ |
| Author's spec wins, engine skips | Cleaner audit — but re-opens the loophole Req 3 exists to prevent | |
| Engine's gate replaces the author's | Closes the loophole — but silently discards `on_failure: skip_to_phase:<slug>` routing and could strand an approved branch | |

**User's choice:** Engine's gate always runs too

---

## Where the field sits

**Framing finding presented before questions:** of the three causes, only `escalated` is authored.
`detected` and `already-set` are pure functions of data already in the row.

| Option | Description | Selected |
|--------|-------------|----------|
| PhaseSpec level | Siblings of `validators` / `name`, outside the union. One field pair covers all 6 types; exact precedent is `PhaseSpec.name` (103). A union-member field would be copy-pasted 6× | ✓ |
| On each union member | Type system could say "grounding is meaningless on `programmatic`" — but the UI already handles that (absent, not disabled), at the cost of 6 near-identical additions and real drift risk | |
| Split: grounding in union, checkpoint on PhaseSpec | Most type-honest — but two placement idioms for one governance section, and the panel reads from two levels | |

**User's choice:** PhaseSpec level

| Option | Description | Selected |
|--------|-------------|----------|
| Store intent only, derive the rest | Persist only the escalation bit; derive mode + cause. Req 3 becomes true BY CONSTRUCTION — no representable value says "detected but free to think"; a stale row cannot lie | ✓ |
| Store the full {mode, cause} | Literal round-trip, no derivation — but a direct DB write could claim `free to think` on a step carrying `search_documents`, degrading the guarantee to a code-audit claim | |
| Store full state, revalidate on write | Consistency plus literal round-trips — but the rule only holds where the write path is ours | |

**User's choice:** Store intent only, derive the rest

| Option | Description | Selected |
|--------|-------------|----------|
| Two flat optional fields | Additive, no nested model to version, absence unambiguous. GOVERN-01 and GOVERN-03 ship and evolve independently | ✓ |
| One nested `governance` object | Groups the concern and gives 188/189 a home — but "absent object" and "object with both false" become two ways to say the same thing | |

**User's choice:** Two flat optional fields
**Notes:** Wrinkle surfaced and recorded as D-185-10 — these fields sit at PhaseSpec level but the panel's
only write seam patches `config`.

---

## Who computes detection

| Option | Description | Selected |
|--------|-------------|----------|
| Server-supplied list, client intersects | KB membership ships on the existing `/grounding-bundle` payload; client does the intersection for instant feedback. One home for the list; the client never enforces, so a wrong read is a display bug not a safety hole | ✓ |
| Client hardcodes KB_TOOLS | Simplest and instant — but a second copy of the safety-defining list; a 6th backend KB tool would silently stop being marked. The exact drift D-182-06 was written against | |
| Round-trip /validate on every toggle | Purest server-authority — but the debounce lags the chip just clicked and the refusal reason needs a network hop | |
| You decide | Let research read the actual payload shape first | |

**User's choice:** Server-supplied list, client intersects

| Option | Description | Selected |
|--------|-------------|----------|
| New caller-owned prop | `WorkflowBuilderPage` owns the write — exactly the idiom `PhaseGateRow.onRemove` established. Keeps `onChange`'s documented contract honest | ✓ |
| Widen onChange to a PhaseSpec patch | One seam instead of two — but silently changes the meaning of a prop whose own shipped docblock defines it as config-only | |

**User's choice:** New caller-owned prop

| Option | Description | Selected |
|--------|-------------|----------|
| Show it, never block | Renders in the `gates` rail as a `🔒` locked row (the 184-09 container built for this); publish behaviour byte-unchanged. Matches Req 4's "bites at run time" | ✓ |
| Fully suppress at author time | Smallest blast radius — but the panel's "must prove it" claim would have no corresponding gate row, and enforcement is discovered only when a run fails | |
| Show it AND gate publish | Strongest guarantee — but a new blocking gauntlet stage (out of scope), and author-time cannot know whether a future run will retrieve anything | |

**User's choice:** Show it, never block

---

## How the checkpoint runs

**Framing finding presented before questions:** `run_gates(..., timing="pre")` already runs before the
executor body and routes without running it (`harness_engine.py:695`). Separately: with an indefinite wait,
the "you closed the tab but the clock kept running" gap the sketch assigned to 185 closes as a side effect.

| Option | Description | Selected |
|--------|-------------|----------|
| Synthesized pre-gate validator | Same parse-time attachment idiom as the citation gate; existing pre-gate routing, audit and SSE unchanged; Req 8's "doesn't change `len(phases)`" holds by construction. Caveat: an indefinite pub/sub block inside a gate abstraction — though shipped `ask_user` on_failure already blocks the same way | ✓ |
| Dedicated engine hook | Reads exactly like what it is and keeps the validator abstraction clean — but a second attachment idiom and it re-implements audit/emit/route wiring | |
| Call _exec_llm_human_input as a sub-step | Maximum reuse — but that function is shaped as a phase executor, and touching it risks the Req 9 byte-identity assertion for the unarmed path | |
| You decide | Let research confirm `subscribe_for_response` blocking semantics and multi-worker resume | |

**User's choice:** Synthesized pre-gate validator
**Notes:** Caveat carried into CONTEXT.md as an explicit research task — `WORKER_COUNT=2` is the default,
so the boot-time resume sweep's cross-worker behaviour must be confirmed.

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse the shipped ask_user prompt surface | Durable row + `/pending` replay + Phase 094 frame, in chat. Zero new run-time surface; 188 replaces it wholesale. The detour edge already says WHERE it stopped | ✓ |
| Minimal new inline affordance | Better than a prompt in a stream — but a net-new run-time surface the SPEC routed to 188, thrown away when 145/146 land | |

**User's choice:** Reuse the shipped ask_user prompt surface

| Option | Description | Selected |
|--------|-------------|----------|
| Engine-generated from the step | Composed from the step's name/verb and position. Keeps the armed state a single boolean; every armed step gets honest copy with zero authoring | ✓ |
| Optional author-written message | More control — but a third governance field for a dial that ships default-OFF, plus an empty-vs-absent distinction in the round trip | |
| Fixed generic copy | Simplest — but a prompt that doesn't name the step about to run is exactly the rubber stamp the sketches warn against | |

**User's choice:** Engine-generated from the step

---

## Dial scope by step type

**Gap surfaced by Claude after the four selected areas:** Req 5 says the dial is absent where grounding
"cannot apply" but never enumerates the types — and an author could escalate an `llm_single`, which has no
retrieval path and would therefore fail the just-locked gate on every run. An author-reachable way to build
a permanently failing step.

| Option | Description | Selected |
|--------|-------------|----------|
| Only types that can retrieve | Dial on `llm_agent` + `llm_batch_agents` only; `llm_emit` read-only (owned by `citation_policy`); `llm_single` / `llm_human_input` / `programmatic` render none. The trap becomes unrepresentable | ✓ |
| Any type that makes a claim | Adds `llm_single` — but escalating one must also change what the gate checks, a second gate shape inside a phase that already has two dials | |
| All six, absent only on programmatic | Widest reach and maximum consistency — and maximum surface for the same trap, including on `llm_human_input`, whose locked vocabulary is "Nothing to prove here" | |

**User's choice:** Only types that can retrieve

| Option | Description | Selected |
|--------|-------------|----------|
| State it in the locked words | Render the section with "Nothing to prove here" and no control — the author learns why, and the required-term grep gets a home | ✓ |
| Omit the whole section | Cleanest panel — but "ungoverned" becomes indistinguishable from "this build forgot to render it" | |

**User's choice:** State it in the locked words

---

## G-4 — lived-experience UAT (mandatory, operator-defined at scope time)

Multi-select. **All four selected**, to be driven live via Chrome MCP at phase verification (wire format +
screenshot are insufficient per CLAUDE.md G-4):

| Scenario | Selected |
|---|---|
| Watch a step lock in front of you — dial strike-through, refusal text, canvas seal, all with no reload | ✓ |
| The seal survives a live run — legible and unmoved across idle / running / needs-you / failed | ✓ |
| Arm it and walk away — close the tab, come back much later, the run is still waiting and answerable | ✓ |
| The detour reads as a detour — armed arc with no straight line past it; unarmed dashed ghost; no ✕/＋ collision | ✓ |

---

## Claude's Discretion

- Exact field names for the two PhaseSpec booleans (shape locked, spelling not).
- The exact registered `mode` string for the new `citations_required` behaviour.
- The exact `/grounding-bundle` payload extension carrying KB membership (separate array vs per-tool flag)
  — researcher reads the shipped shape first.
- The generated approval prompt's precise sentence construction, subject to the Req 9 honesty rule.

## Deferred Ideas

- `PhaseNodeCard` 137-D → 137-B geometry rebuild (+ `padding-top` 34→42, `NODE_MIN_HEIGHT` 96→104, and the
  two docblocks that reason from 137-B on a 137-D component) — **its own task**, not smuggled into 185.
- `.docx` / `.pptx` / `.xlsx` / `.pdf` inline preview → its own insert phase immediately after 185.
- The review moment (145), the round trip (146), a dedicated run surface, a colour-blind-safe run-state
  shape → Phase 188.
- "Someone else approved it" → Phase 186. Armed-on-by-default for external actions → Phase 189.
- The `stepNumber` slot 2×16px graze (slot renders nothing today; `left:16` clears it if it ever ships).
- Sketch-143-B stitched-rail fallback if the corner seal proves too quiet in live use.
- Reported bugs `BUG-260609-02` / `BUG-260609-04` — Phase-188 run-surface affinity, left `open`, not folded.
- Todo `spike-nl-workflow-authoring.md` (matched 0.6) — reviewed, **not folded**; it is VOCAB track and
  belongs to Phase 187.
