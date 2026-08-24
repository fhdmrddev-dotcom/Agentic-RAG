# Phase 189: Governed External-Action Node Model — Research

**Researched:** 2026-08-07
**Domain:** Harness phase-type extension (Python/Pydantic discriminated union) + canvas vocabulary (React/TS) + one Postgres CHECK migration + a recorded architecture decision
**Confidence:** HIGH — every claim below carries the command that produced it, run on the working tree at `develop` on 2026-08-07. Nothing is inherited.

---

## Summary

Phase 189's decisions are locked (D-01 … D-18). This research answers **how**, by measurement. Thirty-one of CONTEXT's file pointers were re-derived: **28 HOLD exactly, 1 is off by a line-range, 2 are stale prose in the tree itself** (not in CONTEXT). Every landmine CONTEXT names still HOLDS.

The phase is mechanically larger than the decision text implies, and the size is concentrated in three places CONTEXT does not name:

1. **A 7th `phase_type` is 27 enumeration sites, of which 5 are typecheck-forced and 16 are hard-coded `toHaveLength(6)` test pins.** The forced ones are cheap (the compiler names them); the sixteen pins are silent — the count gate checks test COUNTS, not assertions, so a missed pin is a RED suite, not a blind one. Full list in §A1.
2. **A 6th `workflow_phases.status` is an 8th `CanvasReading`, and `CanvasReading` fans out into FOUR exhaustive `Record<CanvasReading, …>` tables.** One of them (`RING_GEOMETRY`) carries a documented uniqueness rule — every reading must be identifiable *by arc shape alone in greyscale*. An 8th reading owes an 8th distinguishable shape. §B9.
3. **⚠ Two locked decisions are in mechanical conflict with the shipped publish gauntlet, and the plan MUST budget work for both.** D-04 (always armed) makes the stage-3 golden run block for 7200 s and return `golden_run_timeout`, which falsifies D-06 (the workflow publishes). D-03 (the capability rides `available_tools`) trips stage 2.6's `unregistered_tool` rule, which also falsifies D-06. Neither is a reason to re-open a decision — both are work. §⚠ CONFLICTS.

**Primary recommendation:** Sequence the phase around the two publish-gauntlet conflicts FIRST (they are backend, cheap to prove with unit tests, and they determine whether the phase is shippable at all), then the additive 7th type, then the status vocabulary, then the canvas face. The canvas work is the *largest* by file count and the *least* risky — it is all compiler-forced or test-pinned.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied from `189-CONTEXT.md` `<decisions>`. **D-01 … D-13 locked 2026-08-06; D-14 … D-18 ratified by the operator 2026-08-07. None are re-opened here.**

| ID | Decision |
|---|---|
| **D-01** | A 7th `phase_type` — `external_action`. Appended to the `PhaseConfig` discriminated union as a 7th member. Additive-optional; `_StrictBase` rejects unknown keys; old JSONB rows still `model_validate()`. Rejected: config-on-`llm_agent`; a `PROGRAMMATIC_PHASE_REGISTRY` entry. |
| **D-02** | The author picks a NAMED CAPABILITY from a CLOSED SET. Closed-registry discipline matching `_TOOL_REGISTRY` / `PROGRAMMATIC_PHASE_REGISTRY`: *a name not present raises in the executor — never resolved dynamically, never eval'd.* Rejected: one generic node; author-supplied MCP server + tool identifiers. |
| **D-03** | The capability IS an entry in `available_tools`, so it flows through `resolve_phase_available_tools` and the closed `_TOOL_REGISTRY` exactly like every other tool. **Verify at planning:** capability names must be DISJOINT from `KB_TOOLS`. Rejected: a parallel guard; mirroring one fact into two representations. |
| **D-04** | `action_risk_armed` is STRUCTURALLY TRUE and NOT disarmable on this node type. Not a default the author can clear. Accepted cost: no escape hatch for a genuinely harmless external action — revisit at 190, never by loosening this node. |
| **D-05** | On approval, the step RECORDS THE INTENDED ACTION and the run CONTINUES. The step emits a structured record (capability + resolved inputs) as its output. 190 swaps the no-op for a real MCP call behind an unchanged seam. Rejected: a hard refusal; skipping the step. |
| **D-06** | A workflow containing the node PUBLISHES and RUNS. The 8-stage gauntlet treats it as any other governed node. |
| **D-07** | The not-sent state gets its OWN WORDED STATUS, distinct from passed/done at every surface it renders — canvas node, run surface, phase output. **"running" and "waiting for you" may never share a word**; the new word must not collide with either. |
| **D-08** | ⚠ AMENDS THE ROADMAP — migration 115 persists the 6th status value. Rejected: deriving the word at render while the column stays `completed`; reusing `skipped`. |
| **D-09** | Recorded in the PHASE OUTPUT ONLY — no new `harness_audit` event. Deferred to 190. |
| **D-10** | A doc under `docs/` + a citable D-entry in `.planning/prd-reset/DECISIONS.md`. **The D-entry POINTS AT the doc — it must not restate it.** |
| **D-11** | RECORD the existing verdict with a dated re-open trigger — do not re-validate. Verdict: **MCP-first, first-party-thin, broad catalog sequenced with Open Platform (SEED-013/014)**. |
| **D-12** | Spend badge slot 1 on the NOT-YET-CONNECTED state, conditional on that state rather than on the type. **189 spends slot 1 and no more.** |
| **D-13** | The vocabulary ladder's middle tier is CONFIG-DERIVED from the chosen capability — "Sends an email", "Creates a ticket" — falling back to a generic type sentence only when no capability is chosen yet. Computed at render, never stored. |
| **D-14** | `BUG-260807-01` is fixed by `/gsd:fast` BEFORE 189 plans — it is NOT folded into this phase. |
| **D-15** | The closed capability set is EXACTLY THREE — `send_email`, `create_ticket`, `post_message`. *Nothing is built here that 190 cannot later make real.* |
| **D-16** | The run-time status word is **"Not sent — recorded"**. Renders at all three surfaces per D-07. |
| **D-17** | ⚠ THE STORED VALUE AND THE RENDERED WORD ARE DIFFERENT THINGS. The CHECK constraint gains the SLUG `recorded_not_sent`. **A plan that adds `'Not sent — recorded'` to `workflow_phases_status_check` has misread this decision.** |
| **D-18** | The badge word is **"Not connected"**, conditional on that state. |

### Claude's Discretion

- The 7th `PHASE_GLYPHS` entry — mechanical under the icon convention. **Its home is `soulData.ts:43`, NOT `phaseVocabulary.ts`; `lib/phaseGlyph.tsx` must be swapped in the SAME commit.**
- The exact phrasing of the phase OUTPUT body (the "would have sent to / subject / NOTHING WAS SENT" block) — it must read unmistakably as not-sent, never as a receipt.

### Deferred Ideas (OUT OF SCOPE)

- A `harness_audit` event for the recorded intent (D-09) → **Phase 190**. Re-open trigger: the first live outbound call.
- An escape hatch to disarm action-risk on a low-consequence external action (D-04) → **Phase 190**. Re-open trigger: real usage showing an external capability whose consequence genuinely does not warrant approval.
- A per-capability risk taxonomy → deferred; 189 has no egress to calibrate risk against.
- Who may extend the closed capability set, and how → belongs with 190's connector-credential and org-scoping work.
- How 190 swaps the no-op for a real call without re-authoring → a 190 planning concern.
- **Open bugs reviewed and NOT folded:** `BUG-260730-02`, `BUG-260731-01`, `BUG-260609-02` (triggers recorded in CONTEXT).
- **188.2 residue riding along (look-while-you're-there, NOT blockers):** UAT row A2 (`D-188.2-DEF-07` — needs a live run; **189 will launch live runs under D-06, run A2 on the first one**) and UAT row A1's subjective visual half (`D-188.2-DEF-08`).

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **CONN-01** | *(`.planning/REQUIREMENTS.md:59`, verified verbatim)* "A user can place a governed **external-action node** on the canvas whose capabilities ride the existing per-phase tool-whitelist guard (an MCP-backed node model — zero new governance concept); the milestone **records the own-framework-vs-Open-Platform decision** (research verdict: MCP-first, first-party-thin, broad catalog sequenced with Open Platform SEED-013/014). CORE ships the governed node vocabulary + the recorded decision — no live outbound egress (that is CONN-02/03, STRETCH)." | §A1 (the 27 enumeration sites the 7th type touches) · §A2 (the executor registry shape) · §A5/A6 (how the capability rides the whitelist, and the leak it must not open) · §E (SEED-013/014 + the deep-dive crawl the verdict rests on) · §⚠ CONFLICTS (the two publish-gauntlet blockers that stand between the node and "a user can place it and run it") |

---

## Project Constraints (from CLAUDE.md)

Binding on every plan task. Extracted verbatim in substance:

| Directive | Where it bites in 189 |
|---|---|
| Schema changes ship as numbered SQL under `supabase/migrations/`, filename `<digits>_name.sql` | Migration `115_*.sql` — no letter suffix |
| **Apply by pasting into the Supabase SQL editor — NEVER `supabase db push` / `db reset`** | The migration-115 apply task is a `checkpoint:human` (operator, autonomous:false) — the 114 precedent says so in its own header |
| Then `bash scripts/regenerate-full-schema.sh` (no reset); never hand-edit `full-schema.sql`; commit both | Same task, same commit |
| Python backend must use a `venv` | `backend/venv/Scripts/python.exe` — measured present |
| No LangChain / LangGraph; raw SDK calls | The 7th executor writes no framework code |
| Use Pydantic for structured LLM outputs | `ExternalActionPhaseConfig` is a `_StrictBase` |
| All tables need RLS | 115 touches a CHECK only — no table, no RLS change (the 114 precedent is explicit that it "Does NOT touch the INSERT-only RLS") |
| Deployment-artifact parity (same-commit rule), `scripts/check-deploy-drift.sh` | 189 adds no env var and no seed-bearing migration ⇒ **expected no-op**, but the drift script runs in CI regardless |
| Cloud migration parity is a STANDING rule | 115 joins the owed 099→114 queue; it is NOT applied to cloud in this phase |
| G-1 … G-7 workflow guardrails + hot-file ledger | §G-5 audit below |
| Reported-bugs cross-check at `plan-phase` | No report carries `folded_into: 189` (D-14 routed `BUG-260807-01` OUT) — the planner must verify this holds at plan time |
| Provider-docs-first | **Not triggered.** 189 touches no provider surface: no streaming, no tool-call emission, no structured output. ROADMAP line 52 records "no SC#10" for exactly this reason. |

### G-5 hot-file audit (required at plan time)

| File 189 touches | Ledger row | Status |
|---|---|---|
| `frontend/src/components/workflows/PhaseNodeCard.tsx` | 8 plans / 5 phases | **satisfied (188.2 — 2026-08-07)** — measured `wc -l` = **274** (was 797). G-5 does NOT fire. |
| `frontend/src/components/workflows/WorkflowCanvas.tsx` | 13 plans / 6 phases | satisfied (188.1). 189 need not touch it at all — see §C11. |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | 140/183/184/185, 1095 L | G-5 fired at 185 and was **honoured by construction** (a mount point, not a feature). **189 must keep that shape:** the capability picker gets its own component and one gated line, exactly as `GovernanceSection.tsx` did. |
| `backend/app/services/harness/phase_types.py` | not on the ledger; **1681 L measured** | Not ledger-tracked, but the largest file 189 touches. A 7th executor is ~40 lines at the bottom + one registry line — additive, not a refactor trigger. |

⚠ **The subtree cost 189 inherits:** the six-file card subtree measured **2278 L** across `PhaseNodeCard.tsx` (274) + `phaseNodeCardContract.ts` (214) + `NodeCornerMarks.tsx` (272) + `NodeRunOverlay.tsx` (319) + `NodeIconWell.tsx` (167) + `ownProperty.ts` (86) — that is 1332 L for the six FENCED files (CONTEXT's figure, and it reproduces: 274+214+272+319+167+86 = **1332** ✅). **Prefer filling an existing slot over adding a seventh module.** 189 needs no new module — every change lands in a file that already exists (§C11).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| The 7th `phase_type` schema | API / Backend (`models/harness.py`) | — | The discriminated union IS the contract; the client mirrors it, never defines it (`definitionOps.ts:57-63` says so verbatim) |
| Capability closed-set membership | API / Backend (a new closed constant beside `KB_TOOLS`) | — | D-02's "a name not present raises in the executor"; the client renders a picker from server data, never a frontend constant (`PhaseFormPanel.tsx:483`: *"There is no frontend [option source]"*) |
| The whitelist guard | API / Backend (`tool_dispatcher.dispatch_tool`, `ctx.phase_whitelist`) | — | Already server-authoritative and re-read at run time (D-08 of Phase 184) |
| The armed approval checkpoint | API / Backend (`harness_engine.py:754`) | — | Hoisted out of `phase.validators` by D-187-01; reads the boolean directly |
| Recording the intended action | API / Backend (the 7th executor + `db/workflows.py` status write) | — | D-05 — the run's durable output is a DB write |
| The `recorded_not_sent` status value | Database / Storage (CHECK constraint, migration 115) | API (the write function) | D-08 / D-17 — the SLUG is a column value |
| Rendering "Not sent — recorded" | Browser / Client (`runVocabulary.ts` + `PhaseCard.tsx` STATUS_META) | — | D-17 — the WORD is client vocabulary, never in the constraint |
| The node face (glyph, title, subtitle, badge) | Browser / Client (`soulData.ts` + `phaseVocabulary.ts` + `PhaseNode.tsx`) | — | D-13 — computed at render, never stored (the 148-C ladder's own rule) |
| The recorded architecture decision | *(no tier — documentation)* | — | D-10 — `docs/` + `DECISIONS.md` |

---

## ⚠ CONFLICTS WITH A LOCKED DECISION

**Two locked decisions are, as written, falsified by shipped code. Neither is re-opened here. Both are WORK the plan must budget, and each is stated with the command that proves it.**

### ⚠ CONFLICT 1 — D-04 (always armed) mechanically falsifies D-06 (the workflow publishes)

**The chain, each link measured:**

```bash
sed -n '186,206p' backend/app/services/harness/publish_service.py   # stage 2.5
sed -n '500,540p' backend/app/services/harness/publish_service.py   # _interactive_phase_failures
sed -n '748,800p' backend/app/services/harness_engine.py            # the armed checkpoint
sed -n '1095,1110p' backend/app/services/harness_engine.py          # DELTA 2 — timeout=None
grep -n "async def subscribe_for_response" -A 15 backend/app/services/ask_user_service.py
grep -n "harness_publish_max_seconds" backend/app/config.py
```

1. `publish_service._interactive_phase_failures` (`:500-540`) blocks a publish PRE-RUN for exactly two shapes: `config.phase_type == "llm_human_input"` (`:521`) and a validator with `on_failure == "ask_user"` (`:531`). **Nothing else.**
2. The armed action-risk checkpoint is **not a validator**. D-187-01 hoisted it OUT of `phase.validators` — `harness_engine.py:754` reads `getattr(phase, "action_risk_armed", False)` directly, and its own comment says *"the armed action-risk checkpoint is not a member of `phase.validators` at all"*.
3. ⇒ An `external_action` phase passes stage 2.5 untouched and reaches **stage 3, the REAL golden run** (`publish_service.py:244`, `is_golden_run=True`).
4. The golden run hits the checkpoint, which calls `_resolve_failure_with_ask_user(..., is_action_risk=True)`. `harness_engine.py:1104`: `timeout_seconds = None if is_action_risk else min(...)`.
5. `ask_user_service.subscribe_for_response` docstring, verbatim: *"`timeout_seconds=None` means **wait indefinitely**"*.
6. `settings.harness_publish_max_seconds = DEFAULT_LLM_CALL_TIMEOUT_SECONDS * 24` = **7200** (`config.py:1184`).

**Result:** publishing a workflow containing an `external_action` node hangs the request for **2 hours** and then returns `blocked_stage="golden_run_timeout"`. **D-06 is false as the tree stands.**

**This is not an argument against D-04.** D-04 is right and 185's reasoning holds: a gate that can be loosened away is not a gate. It is an argument that **189 owes a golden-run-aware arming path**, and there are three shapes, all consistent with every locked decision:

| Option | Shape | Verdict |
|---|---|---|
| **A (recommended)** | Thread `is_golden_run` into the run ctx and make the armed checkpoint **auto-record-and-continue** on a golden run — the checkpoint is skipped for the *pause*, but the phase still records `recorded_not_sent`. | Preserves D-04 (nothing is disarmable), preserves D-05 (the intent is still recorded), preserves D-06. `is_golden_run` already exists as a `workflow_runs` column (`db/workflows.py:150,194,203,811`) but is **NOT** currently threaded into ctx — that threading is the work. |
| **B** | Extend `_interactive_phase_failures` to name armed phases ⇒ an `external_action` workflow **cannot publish**. | **Directly contradicts D-06.** Rejected. |
| **C** | Auto-approve the checkpoint on a golden run by publishing a synthetic response onto the ask channel. | Writes a `validator_ask_user_approved` receipt claiming a human approved when none did — violates the ledger's `consequence ≠ receipt` rule. Rejected. |

**Whatever the plan picks, it must be proven with a driven test, not asserted** — this exact class (an armed checkpoint killing a run) is `BUG-260731-02`, which is why migration 114 exists.

### ⚠ CONFLICT 2 — D-03 (`available_tools`) trips stage 2.6's `unregistered_tool` rule

```bash
sed -n '208,243p' backend/app/services/harness/publish_service.py   # stage 2.6
grep -n "_unregistered_tools" -A 10 backend/app/services/harness/grounding.py   # :643
grep -n "tool_names = " backend/app/services/harness/grounding.py             # :388
```

- Stage 2.6 rule 2 (`grounding.py:643-651`): every `available_tools` entry must be in `tool_names`, else a `{"code": "unregistered_tool"}` finding blocks the publish.
- `tool_names` is built at **`grounding.py:388`**: `tool_names = {t["function"]["name"] for t in get_tools(None)}`.
- `get_tools()` (`openai_service.py:1116-1128`) is the **LLM-facing schema list**, not `_TOOL_REGISTRY`. Its own comment at `:1133` records the asymmetry: *"The inverse of render_template (registered in `_TOOL_REGISTRY` but NOT advertised here — harness-only)"*.

⇒ `send_email` / `create_ticket` / `post_message` in an `available_tools` list would **block publish at stage 2.6** unless they are in `tool_names`. **D-06 is false a second time.**

**⚠ AND THE OBVIOUS FIX OPENS A GOVERNANCE HOLE.** `GroundingBundle.tools = sorted(tool_names)` (`grounding.py:111`, `:427`) is served on `GET /workflows/grounding-bundle`, and `WorkflowBuilderPage.tsx:885` binds it straight to `PhaseFormPanel`'s `toolOptions`, which is the **author-facing whitelist rail** for `llm_agent` and `llm_batch_agents` (`PhaseFormPanel.tsx:873`, `:925`). Adding the three names to `get_tools()` would let an author whitelist `send_email` on an **ordinary agent step** — bypassing the `external_action` type's structural arming entirely. That is precisely the wire-around D-04 and SC#2 forbid.

**Recommended shape (§A5 has the detail):** a new closed constant `EXTERNAL_ACTION_CAPABILITIES: frozenset[str]` in `grounding.py`, **beside `KB_TOOLS` and in the same shape**, unioned into `tool_names` for the FIDELITY check only and deliberately kept OUT of `GroundingBundle.tools`. That gives the closed set ONE home which both the executor (D-02) and the fidelity gate read, matches `KB_TOOLS`'s own "this list DEFINES which steps are governed, so a second copy is a safety hole" argument verbatim, and does not widen the author-choosable option set by one entry.

⚠ It does break the currently-true identity `tools == sorted(tool_names)`, which `grounding.py:446-447` asserts in prose. **That prose must be corrected in the same commit**, with the reason recorded.

### ⚠ CONFLICT 3 (documentation only) — `canvasModel.ts:196-203` makes a claim about 189 that D-04 falsifies

```bash
sed -n '178,206p' frontend/src/components/workflows/canvasModel.ts
sed -n '259,277p' frontend/src/components/workflows/canvasModel.ts   # checkpointOnTarget
```

`CanvasEdgeData.armed` documents THREE states and says, verbatim at `:201-203`: *"`false` is Phase 189's state — an external-action step whose checkpoint the author turned off — and `FlowEdge` carries it now so the unarmed reading is a shipped, tested behaviour rather than a promise."*

**D-04 makes that state unreachable forever.** And it already is: `checkpointOnTarget` (`canvasModel.ts:274-276`) returns `actionRiskArmed(phase) ? true : undefined` — `false` is not producible from the projection today, and D-04 guarantees it never will be for this type.

This is a **prose correction, not a feature.** The plan must NOT read this docblock as a requirement to wire up a ghost-detour edge for 189. The `FlowEdge` `GhostMarks` branch (`FlowEdge.tsx:343`) stays shipped and stays unreachable; the docblock stops naming 189 as its claimant.

---

## Section A — Backend: the 7th phase type (D-01, D-02, D-05)

### A1 · Every enumeration site the 6 existing type names occupy

```bash
grep -rn "llm_batch_agents" backend/app --include=*.py
grep -rn "llm_human_input" backend/app --include=*.py
grep -rn "llm_single|llm_human_input" frontend/src --include=*.ts --include=*.tsx   # non-test filtered
```

**BACKEND — 5 sites, 3 of them load-bearing:**

| # | File:line | What | 7th member needed? | Forced by? |
|---|---|---|---|---|
| B1 | `backend/app/models/harness.py:57-160` | The six `*PhaseConfig` classes, each with `phase_type: Literal[...]` (`:58, :67, :83, :100, :119, :144`) | **YES** — a new class | — |
| B2 | `backend/app/models/harness.py:162-172` | `PhaseConfig = Annotated[Union[…6 members…], Field(discriminator="phase_type")]` | **YES** | Pydantic — an unlisted `phase_type` 422s |
| B3 | `backend/app/services/harness/phase_types.py:1658-1667` | `PHASE_TYPE_REGISTRY_ENTRIES` (6 keys) | **YES** | Runtime — `PhaseTypeNotRegistered` at `harness_engine.py:565` |
| B4 | `backend/app/services/workflow_authoring.py:62-69` | The NL generator's prompt: *"The 6 phase types you can compose"* + one bullet each | **OPTIONAL** — 187's AI-seed will never emit an `external_action` node without it. Recommend YES, and correct "6" → "7". | No |
| B5 | `backend/app/api/runs.py:677-678` | Docstring: *"other phase types (llm_single / programmatic / llm_human_input) have none → empty list"* | Prose only | No |

**Two Literal sets, not one** (`models/harness.py:10` says *"The two Literal sets GROW ADDITIVELY"*): the `phase_type` set (B1/B2) and the `ValidatorSpec.kind` set (`:216-221`, 10 members). **189 needs NO new validator kind** — D-04 reuses `action_risk_approval`, which is already a member.

**`_StrictBase` and the discriminator are LOCKED mechanism** (`harness.py:16-18`): *"the discriminator, `extra='forbid'` and the union structure remain LOCKED."* A 7th member is additive INSIDE that mechanism — old rows never name it, so every stored JSONB row still validates.

**FRONTEND — 22 non-test sites. Five are typecheck-forced (the compiler names them); the rest are silent.**

| # | File:line | What | Forced? |
|---|---|---|---|
| F1 | `definitionOps.ts:63-69` | `export type PhaseTypeId` union | — (the source of the forcing) |
| F2 | `definitionOps.ts:76-83` | `PHASE_TYPE_ORDER` `as const satisfies readonly PhaseTypeId[]` | **NO** — a subset satisfies. Silent. **Add anyway or the picker never offers the type.** |
| F3 | `definitionOps.ts:828-835` | `SLUG_BASE` `as const satisfies Record<PhaseTypeId, string>` | ✅ **TYPECHECK ERROR** without a 7th entry |
| F4 | `definitionOps.ts:874-892` | `requiredConfigFor` switch, `const _never: never = type` at `:886` | ✅ **TYPECHECK ERROR** |
| F5 | `phaseVocabulary.ts:152-159` | `PHASE_TYPE_SENTENCES` (`Record<string,…>`) — the D-13 tier-3 floor | ❌ silent |
| F6 | `phaseVocabulary.ts:162-169` | `PHASE_TYPE_SUBTITLES` — the ONE supporting line | ❌ silent (`canvasModel.ts:~447` reads it with `?? ""`) |
| F7 | `phaseVocabulary.ts:176-183` | `PHASE_TYPE_LABELS` — the ⌥ Technical-names vocabulary | ❌ silent |
| F8 | `phaseVocabulary.ts:516-580` | `derivedFace` — the D-13 tier-2 ladder. Insert a numbered tier. | ❌ silent |
| F9 | `soulData.ts:43-50` | `PHASE_GLYPHS` — **6 entries confirmed** (`programmatic:gear, llm_single:memo, llm_agent:compass, llm_batch_agents:handshake, llm_human_input:raised-hand, llm_emit:package`) | ❌ silent |
| F10 | `lib/phaseGlyph.tsx:60-67` | `PHASE_GLYPH_MARKS` + 6 build-time `~icons/fluent-emoji/*` imports | ❌ silent — **but a missing slug FAILS THE BUILD** |
| F11 | `nodePresentation.ts:83-90` | `ICON_TINT` (6 entries) + `DEFAULT_TINT` fallback at `:92` | ❌ silent, pinned by a test (§D15) |
| F12 | `PhaseFormPanel.tsx:169-175` | `PHASE_TYPE_FRIENDLY` (a LOCAL 6-entry duplicate of `PHASE_TYPE_LABELS`) | ❌ silent |
| F13 | `PhaseFormPanel.tsx:804-1000` | The per-type config editor branches (`{pt === "llm_single" && …}` etc.) | ❌ silent — **the capability picker's home** |
| F14 | `components/panel/PhaseCard.tsx:43-49` | `PHASE_TYPE_LABEL` — **only 5 entries** (`llm_emit` absent) with `UNKNOWN_PHASE_META` at `:50` | ❌ silent, **and optional** — the developer panel already degrades a 6th type to *"Step"*. Precedent for declining. |
| F15 | `PhaseSpine.tsx:88` | `PHASE_GLYPHS[type] ?? "•"` — reads F9 | inherits F9 |
| F16 | `canvasModel.ts:150` | Comment: *"Badge slot 2 — true ONLY on `llm_human_input`"* | prose |
| F17-F22 | `PhaseNode.tsx:213,253` · `phaseVocabulary.ts:206,454,635` · `runVocabulary.ts:49` | prose references to `llm_human_input`/`llm_emit` as the only members of a set | prose |

**Where the compiler helps and where it does not, stated plainly:** exactly **two** frontend sites (F3, F4) fail to compile without a 7th entry. Everything else is silent and must be found by this list. That asymmetry is the single biggest execution risk in the phase.

### A2 · How a phase-type executor registers, and the smallest one verbatim

```bash
sed -n '1655,1681p' backend/app/services/harness/phase_types.py
grep -n "^async def _exec_" backend/app/services/harness/phase_types.py
sed -n '560,570p' backend/app/services/harness_engine.py
```

**The registry** (`phase_types.py:1658-1681`, the file is **1681 L**):

```python
PHASE_TYPE_REGISTRY_ENTRIES: dict = {
    "programmatic": _exec_programmatic,
    "llm_single": _exec_llm_single,
    "llm_agent": _exec_llm_agent,
    "llm_batch_agents": _exec_llm_batch_agents,
    "llm_human_input": _exec_llm_human_input,
    "llm_emit": _exec_llm_emit,          # 101.1 — the 6th
}

def register_all() -> None:
    from app.services.harness_engine import PHASE_TYPE_REGISTRY
    PHASE_TYPE_REGISTRY.update(PHASE_TYPE_REGISTRY_ENTRIES)

register_all()   # at import time (idempotent dict.update)
```

**The signature and the dispatch** (`harness_engine.py:560-570`):

```python
async def _execute_phase(phase, accumulated_outputs: dict, ctx) -> dict:
    phase_type = phase.config.phase_type
    executor = PHASE_TYPE_REGISTRY.get(phase_type)
    if executor is None:
        raise PhaseTypeNotRegistered(...)
    return await executor(phase, accumulated_outputs, ctx)
```

So: **`async def _exec_external_action(phase, accumulated_outputs: dict, ctx) -> dict`**, one registry line, nothing else.

**The smallest existing executor** is `_exec_llm_single` (`:466-489`, 24 lines). `_exec_programmatic` (`:433-463`, 31 lines) is the closer structural model for D-02, because it is the one that resolves a name against a closed registry and raises:

```python
    fn = PROGRAMMATIC_PHASE_REGISTRY.get(fn_name)
    if fn is None:
        raise KeyError(
            f"programmatic phase {phase.slug!r}: fn {fn_name!r} is not registered "
            f"in PROGRAMMATIC_PHASE_REGISTRY (closed dict — register it explicitly)"
        )
```

**Copy that shape verbatim for the capability lookup** — it is D-02's "a name not present raises in the executor" already written in this codebase's own words.

**Every executor returns a plain `dict`**, and every phase output carries `text` by convention (`_latest_phase_text`, `:1640-1652`, scans for it). The D-05 output should carry `text` (the human-readable not-sent block) plus the structured record.

### A3 · The D-05 seam — exactly where an executor's result becomes the persisted status

```bash
grep -n "complete_phase\|fail_phase\|skip_phase\|mark_phase_active" backend/app/services/harness_engine.py backend/app/db/workflows.py
sed -n '1605,1630p' backend/app/services/harness_engine.py
sed -n '958,1015p' backend/app/db/workflows.py
```

**THE SEAM IS `harness_engine.py:1605-1623`.** Verbatim:

```python
        output = outcome.output
        durable_output = _persist_output(output)
        _emit_failure = output.get("failure") if isinstance(output, dict) else None
        if _emit_failure:
            await fail_phase(pool, phase_id, str(_emit_failure), output=durable_output)
        else:
            await complete_phase(pool, phase_id, durable_output)
        accumulated_outputs[phase.slug] = output
        last_output = output
```

**This is an exact precedent for D-05, and it is 101.1's own invention for the same class of problem:** an executor signals a non-`completed` terminal by putting a sentinel key on its normal output dict, and the engine branches on that key to choose which status-write function to call. 189 adds a **third branch** — e.g. `output.get("recorded_intent")` → `await record_phase_not_sent(pool, phase_id, durable_output)`.

**The four write functions** (`db/workflows.py:958-1014`), all one-statement `UPDATE`s:

| Function | Line | SQL |
|---|---|---|
| `mark_phase_active` | `:959` | `SET status='active'` |
| `complete_phase` | `:975` | `SET status='completed', output=$2::jsonb` — atomic, "never two statements" |
| `fail_phase` | `:986` | `SET status='failed', output=$2::jsonb` |
| `skip_phase` | `:1007` | `SET status='skipped'` |

⇒ a 5th, `record_phase_not_sent(pool, phase_id, output)` → `SET status='recorded_not_sent', output=$2::jsonb`, copying `complete_phase`'s atomic shape.

**Does anything downstream treat non-`completed` as a run halt? NO — and this is the important half.** The `fail_run` and `skip_to` branches (`:1533`, `:1561`) both `return`/`continue` out of the loop. The `completed` branch does neither: it falls through to `advance_current_phase` (`:1630`) and the loop continues. **A third branch placed alongside the `_emit_failure` ternary inherits the CONTINUE for free** — it is inside the same `if/else`, after the `outcome.kind` checks have already passed. D-05's "the run CONTINUES" is satisfied by placement, not by new control flow.

**`finalizeAllPhasesForThread` — checked, and it is a CLIENT sweep, not a server one:**

```bash
grep -rn "finalizeAllPhasesForThread" frontend/src
```

It lives at `stores/streamsStore.ts:277` / `providers/StreamsProvider.tsx:2837`, fired on `run_completed` at `:1044`, and narrowed by Phase 188 Plan 02 (`:3360`). It sweeps `pending` → `done` in the client store. **It is a fail-open risk for the new status only if the phase row is still `pending` in the client's view when `run_completed` arrives** — it does not read `recorded_not_sent` at all. The reconcile path (`phaseStatusFromDb`) is what carries the new slug, and today it resolves it to `"unknown"` (§B9). Phase 188's `PhaseReconcile.test.tsx:235` ("finalizeAllPhasesForThread sweep honesty (Req 3, the REACHABLE fail-open)") is the live guard; 189 owes it a row for the new status.

### A4 · D-04 — making `action_risk_armed` structurally true

```bash
sed -n '201,236p' backend/app/models/harness.py      # PhaseSpec
sed -n '748,760p' backend/app/services/harness_engine.py
sed -n '714,745p' backend/app/services/harness/validator_kinds.py
grep -n "action_risk_armed" -r backend/app frontend/src
```

**Verified pointers:** `action_risk_armed` is at **`harness.py:235`** ✅ (CONTEXT said 235). `action_risk_approval` is at **`validator_kinds.py:715-716`** — CONTEXT said `:714`; that is the section-header comment line. Effectively correct, one line off.

**How it is read today — there are exactly THREE readers, and the plan must satisfy all three:**

| # | Reader | Line | Effect |
|---|---|---|---|
| 1 | `harness_engine._run_phase_with_gates` | `:754` `if getattr(phase, "action_risk_armed", False):` | The run-time pause |
| 2 | `harness_engine._is_armed_action_risk` | `:2148` | The boot-time resume sweep (re-drive vs re-subscribe). Deliberately INDEPENDENT of #1 and pinned by `test_the_two_resume_predicates_are_independent` |
| 3 | `phaseVocabulary.actionRiskArmed` | `:417-419` `return phase.action_risk_armed === true` | The canvas edge state, via `canvasModel.isArmed` (`:260`) |

**The gate itself** (`validator_kinds.py:744`) is `return GateResult(False, "action_risk:approval|" + ...)` — *always fails by design*, and the pause is owned by `_resolve_failure_with_ask_user`. ✅ CONTEXT's characterisation HOLDS.

**Every write path that could set it false — measured:**

| Path | Can write `action_risk_armed: false`? |
|---|---|
| `PhaseSpec` field default | Yes — `bool = False` at `:235`. **A `Literal[True]` would break every OTHER phase type**, so it cannot go on `PhaseSpec`. |
| Draft save (`PATCH /workflows/{id}`) | Yes — the definition JSONB round-trips through `model_dump(mode="json")` |
| Canvas / panel edit (`GovernanceSection.tsx`) | Yes today — the arming switch is offered on EVERY step type (`phaseVocabulary.ts:414`: *"offered on EVERY step type (SPEC Req 8)"*) |
| Direct JSONB hand-edit | Yes |
| Publish gauntlet | No write |
| NL generator (`workflow_authoring`) | Yes (it emits a whole definition) |

**RECOMMENDATION — a `model_validator(mode="after")` on `PhaseSpec` that PINS the value, not a `Literal[True]` field.**

```
if self.config.phase_type == "external_action" and not self.action_risk_armed:
    → coerce to True (or raise)
```

Reasoning, and why the alternatives lose:

- **`Literal[True]` on a new field:** cannot work — `action_risk_armed` lives on `PhaseSpec`, which is shared by all seven types. Moving it onto the config would create a second home for one fact (the exact drift D-03 rejects).
- **Enforcement at resolve time (in the engine):** protects the RUN but not the STORED ROW. A row can then read `armed: false` while the engine arms anyway, and the canvas (`isArmed` reader #3) would paint an unarmed edge on an armed step — a lie on screen.
- **A `model_validator` on `PhaseSpec`:** catches ALL SIX write paths at once, because every one of them goes through `WorkflowDefinition.model_validate()`. It also makes the property *structural in the same sense D-185-08 used for grounding*: "a detected step set back to free-to-think is not a representable value."
- ⚠ **COERCE, don't RAISE.** `harness.py:11-14` records that growth is safe because *"an old row never names the new member"* — but a NEW row that a client wrote with `armed: false` before the client shipped its own pin would then 422 the whole definition and brick the workflow. Coercing to `True` is fail-CLOSED (it arms) and never destroys a row. Log the coercion.
- **The client half is separate and also owed:** `GovernanceSection.tsx:90` `DIAL_TYPES` gates the *grounding* dial to two types; the *arming* switch is ungated. 189 must render the arming switch as **on and non-interactive** for `external_action` (the 185 refusal vocabulary already exists for exactly this — D-04 says reuse it, don't author new copy).

### A5 · D-03 — what registering the three capabilities actually requires

```bash
sed -n '4009,4046p' backend/app/services/tool_dispatcher.py     # _TOOL_REGISTRY
sed -n '4134,4168p' backend/app/services/tool_dispatcher.py     # dispatch_tool
sed -n '671,682p' backend/app/api/runs.py                        # resolve_phase_available_tools
sed -n '795,805p' backend/app/services/harness/grounding.py      # KB_TOOLS
```

**✅ `resolve_phase_available_tools` is at `backend/app/api/runs.py:671`** — CONTEXT's pointer HOLDS exactly.

⚠ **But note its scope, which CONTEXT does not:** it has exactly TWO references (`:671` def, `:861` call) and both are on the **`POST /runs/{id}/continue`** path. It is the *Continue* re-read, not the main run's whitelist builder. The main run's whitelist is built by `phase_types._build_phase_tool_context` (`:324` `base = list(phase.config.available_tools)`) into `ToolContext.phase_whitelist` (`:418`), and enforced at `tool_dispatcher.dispatch_tool:4141`:

```python
    if ctx.phase_whitelist is not None and tool_name not in ctx.phase_whitelist:
        _spawn_tool_refused_audit(ctx, tool_name, allowed)
        return ToolResult(result=json.dumps({"error": "tool_not_available_in_phase", ...}))
```

D-03's claim still holds — the guard IS the existing guard — but the plan should name `dispatch_tool` as the enforcement point, not only `resolve_phase_available_tools`.

**What happens to a name in `available_tools` with no `_TOOL_REGISTRY` entry** (`tool_dispatcher.py:4164-4167`):

```python
    handler = _TOOL_REGISTRY.get(tool_name)
    if handler is None:
        return ToolResult(result=f"Unknown tool: {tool_name}")
```

⇒ a **soft error string**, not a raise. The phase whitelist ADMITS it (it is in `available_tools`), and dispatch then hands the model a plain "Unknown tool" string. **Nothing crashes and nothing is sent** — which is, incidentally, the safest possible failure mode for a phase whose whole point is not to send anything.

#### ✅ MANDATORY CHECK — capability names vs `KB_TOOLS`: **DISJOINT**

`KB_TOOLS` is at **`grounding.py:797`** ✅ (CONTEXT's pointer HOLDS), `KB_TOOLS_SORTED` at `:803`. Contents printed verbatim:

```python
KB_TOOLS: frozenset[str] = frozenset({
    "search_documents", "query_documents", "read_document",
    "analyze_document", "get_related_documents",
})
```

| D-15 capability | ∈ `KB_TOOLS`? |
|---|---|
| `send_email` | **NO** ✅ |
| `create_ticket` | **NO** ✅ |
| `post_message` | **NO** ✅ |

**All three are disjoint. The grounding dial is NOT silently armed.** The detection rule is `grounding.py:832`: `if set(getattr(phase.config, "available_tools", None) or ()) & KB_TOOLS:` — an empty intersection, so `grounding_cause` returns `None` and an `external_action` step is *free to think* by construction. That is the right answer: an external-action step reads no knowledge base.

⚠ **One consequence worth recording:** because `external_action` is not in `GROUNDING_DIAL_TYPES` (`phaseVocabulary.ts:277` = `["llm_agent", "llm_batch_agents"]`, and `phaseVocabulary.ts:557` calls that constant *"READ here and NEVER edited"* — a D-185-15 red line), the node carries **no ⛨ governance seal**. Its whole governance reading is the armed edge + the D-18 badge. The plan must not treat the missing seal as a bug.

### A6 · **Is a capability a TOOL the LLM calls, or a step the executor performs?**

**Answer: a STEP the executor performs. The name in `available_tools` is a GOVERNANCE DECLARATION, not a dispatchable schema. Evidence, three independent lines:**

**(i) The `render_template` precedent proves the shape already exists** (`phase_types.py:296-320`, the 101-06 WR-01 correction, verbatim):

> *"Layer 1 — the SCHEMAS the model actually sees are NOT the names on `ToolContext.available_tools`; they are the function-schemas in the `tools_override` list… A whitelisted NAME with no SCHEMA in the candidate list is a no-op. …Layer 2 — the DISPATCH backstop is `ToolContext.available_tools` / `phase_whitelist`… It does NOT control which schemas the model sees."*

So a name can ride `available_tools` for the WHITELIST while being invisible to the model. That is exactly what 189 needs, and it is not an invention — `render_template` is a shipped instance of it.

**(ii) The tool reading would require an agent loop, which the executor must not have.** `_TOOL_REGISTRY` handlers are reached only from `dispatch_tool`, which is reached only from the agent loop. Making the capability a callable tool would mean the `external_action` executor drives `_stream_one_iteration` with a tools_override — i.e. an LLM decides *whether and how* to send. That contradicts D-05 ("the step RECORDS the intended action"), contradicts D-02's closed-set determinism, and adds a provider surface that ROADMAP line 52 explicitly excludes ("no SC#10").

**(iii) The step reading is the only one that leaves 190 a clean seam.** D-05 promises "190 swaps the no-op for a real MCP call behind an unchanged seam." A no-op *inside the executor* is one function to replace. A no-op *inside a `_TOOL_REGISTRY` handler* would additionally require the schema, the `get_tools()` advertisement and the `apply_tool_budget` candidate-injection to already exist — i.e. 189 would ship most of the plumbing for live egress, which SC#4 forbids.

**⇒ Recommended concrete shape:**

- `ExternalActionPhaseConfig` carries `capability: Literal["send_email","create_ticket","post_message"]` **and** `available_tools: list[str]` (D-03).
- A `model_validator` pins `available_tools == [capability]` — one fact, one derivation, no drift (the `useCanvasGate` one-definition rule D-03 cites).
- **NO `_TOOL_REGISTRY` entry and NO `get_tools()` schema in 189.** Both are 190's.
- The three names live in ONE new closed constant in `grounding.py` beside `KB_TOOLS`, read by the executor (D-02's raise) and unioned into the fidelity gate's `tool_names` (Conflict 2).

---

## Section B — The migration (D-08, D-17)

### B7 · Migration 114 verbatim, the head, and the exact SQL 115 needs

```bash
ls supabase/migrations/ | tail -8          # → 114_harness_audit_action_risk_pending.sql is LAST
cat supabase/migrations/114_harness_audit_action_risk_pending.sql
grep -n "workflow_phases_status_check" supabase/full-schema.sql    # → 1932
grep -rln "workflow_phases_status_check" supabase/migrations/      # → (no output)
```

✅ **Live head is 114. Slot 115 is free.** ✅ **`workflow_phases_status_check` is still at `supabase/full-schema.sql:1932` and still caps at exactly FIVE values.** Verbatim:

```sql
CONSTRAINT workflow_phases_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'skipped'::text])))
```

⚠ **New finding CONTEXT does not carry:** `workflow_phases_status_check` appears in **NO migration file** — it predates the numbered-migration era and exists only in the live DB and the dump. That is fine for a `DROP CONSTRAINT` (the constraint exists by that name in the live DB, which is what the dump reflects), but it means **115 is the first migration ever to touch it** and there is no earlier ALTER to copy verbatim.

**The shape 115 copies is 114's** — `DROP CONSTRAINT` then `ADD CONSTRAINT`, one literal added, nothing else:

```sql
ALTER TABLE public.harness_audit DROP CONSTRAINT harness_audit_event_type_check;
ALTER TABLE public.harness_audit ADD CONSTRAINT harness_audit_event_type_check CHECK (
    event_type IN ( … 22 literals …, 'action_risk_pending' )
);
```

**⇒ The exact SQL migration 115 needs** (⚠ **D-17: the SLUG, never the sentence**):

```sql
ALTER TABLE public.workflow_phases DROP CONSTRAINT workflow_phases_status_check;
ALTER TABLE public.workflow_phases ADD CONSTRAINT workflow_phases_status_check CHECK (
    status = ANY (ARRAY[
        'pending'::text, 'active'::text, 'completed'::text, 'failed'::text, 'skipped'::text,
        -- 189 (CONN-01 / D-08, D-17) — the governed external action that was recorded, not sent:
        'recorded_not_sent'::text
    ])
);
```

**114's header conventions the 115 header must carry** (they are load-bearing, not decoration): the WHY with the measured evidence; the ALTER-not-CREATE note; the "adds exactly ONE literal and changes nothing else — no table, no column, no index, no grant" line; the "does NOT touch RLS" line; the apply instructions (**"paste into the Supabase SQL editor — NEVER `supabase db push`/`db reset`; then `bash scripts/regenerate-full-schema.sh`"**); the "this plan ONLY AUTHORS the file — it is NOT applied here" line; and the ACCESS EXCLUSIVE lock note for the cloud parity window.

⚠ **`ARRAY[…]` vs `IN (…)`:** 114 used `IN`; the shipped `workflow_phases` constraint uses `= ANY (ARRAY[…])`. **Use `= ANY (ARRAY[…])`** — it is what the dump will regenerate, so `full-schema.sql` stays stable and the regeneration diff is one line rather than a reformat.

⚠ **No Python literal set to pin.** Unlike `harness_audit` (whose Python allow-list at `db/workflows.py:99-136` is pinned equal by `test_audit_event_registration.py`), `workflow_phases.status` has **no** Python enum — it is written as a string literal inside each `UPDATE`. Confirmed: `grep -n "SET status=" backend/app/db/workflows.py` returns four call sites and nothing else. So 115 has exactly one code counterpart (the new `record_phase_not_sent` function), not two.

### B8 · ⚠ D-17's trap — where the SLUG becomes the WORD

```bash
grep -rn "Record<CanvasReading" frontend/src --include=*.ts --include=*.tsx
sed -n '41,79p' frontend/src/lib/phaseState.ts
sed -n '55,70p' frontend/src/components/workflows/runVocabulary.ts
sed -n '89,112p' frontend/src/components/panel/PhaseCard.tsx
```

**The rendering happens in TWO vocabularies, and that is by design** (`lib/phaseState.ts:12-20`, verbatim): *"this module holds the DERIVATION, never the VOCABULARY. Two vocabularies are correct here — the developer panel has its own harness words… the canvas has business words… Two DERIVATIONS are not correct."*

| Layer | File:line | Role | 189 edit |
|---|---|---|---|
| **DERIVATION** | `lib/phaseState.ts:41-47` `DB_PHASE_STATUS` | slug → `Phase["status"]` | add `recorded_not_sent: "recorded-not-sent"` |
| | `lib/phaseState.ts:76-79` `phaseStatusFromDb` | total, own-guarded | no change (it reads the map) |
| | `lib/phaseState.ts:87-94` `CanvasReading` | the 7 readings | add an 8th |
| | `lib/phaseState.ts:122-140` `canvasReading` | switch, `default → "unknown"` | add an arm |
| **CANVAS VOCABULARY** | `components/workflows/runVocabulary.ts:61-69` `RUN_READING_WORD` | **⇐ THE D-16 HOME.** `"Not sent — recorded"` goes HERE | ✅ exhaustive `Record<CanvasReading,string>` — **typecheck-forced** |
| **PANEL VOCABULARY** | `components/panel/PhaseCard.tsx:89-111` `STATUS_META` | glyph + text + colour class | ✅ exhaustive `Record<Phase["status"],StatusMeta>` — **typecheck-forced** |
| | `components/panel/PhaseTimeline.tsx:60-74` `milestoneFor` | the a11y announcer switch, `default → ""` | ❌ silent |
| **WIRE** | `backend/app/api/workflow_runs.py:87-89` | `status: str = Field(description="pending \| active \| completed \| failed \| skipped …")` | prose only — **the wire is `str`, so the backend needs NO model change**, only the description |

**⇒ Point the planner at `runVocabulary.ts:61` for D-16's sentence and at migration 115 for D-17's slug. They are 400 lines and one language apart, which is the whole point of the decision.**

### B9 · Every consumer of `workflow_phases.status` a 6th value flows through

```bash
grep -rn "workflow_phases" backend/app
grep -rn "\"skipped\"" frontend/src --glob '!*.test.*'
grep -rn "Record<CanvasReading" frontend/src --glob '!*.test.*'
```

**BACKEND — 5 consumers, none of which needs a code change:**

| File:line | Read | Impact of a 6th value |
|---|---|---|
| `db/workflows.py:208` | `INSERT … status` (seeded `'pending'`) | none |
| `db/workflows.py:959/975/986/1007` | the four `UPDATE`s | **+1 new function** |
| `db/workflows.py:802,836,855` | run-keyed SELECTs | none (no status filter on the new value) |
| `api/threads.py:1199` | `SELECT slug, phase_index, status` for reconcile | passes through |
| `api/workflow_runs.py:87,216` | `WorkflowRunPhaseRead.status: str` | passes through — **untyped on the wire** |

**FRONTEND — the fan-out is real. 11 sites, 6 of them typecheck-forced:**

| # | File:line | What | Forced? |
|---|---|---|---|
| 1 | `types/index.ts:1020` | `status: "pending"\|"running"\|"done"\|"failed"\|"retrying"\|"skipped"\|"unknown"` | — (the source) |
| 2 | `lib/phaseState.ts:41` | `DB_PHASE_STATUS` (`Record<string,…>`) | ❌ silent |
| 3 | `lib/phaseState.ts:87` | `CanvasReading` union (7) | — (the source) |
| 4 | `lib/phaseState.ts:122` | `canvasReading` switch | ❌ silent (`default:`) |
| 5 | `components/panel/PhaseCard.tsx:89` | `STATUS_META: Record<Phase["status"],…>` | ✅ **FORCED** |
| 6 | `components/panel/PhaseTimeline.tsx:60` | `milestoneFor` switch | ❌ silent |
| 7 | `components/workflows/runVocabulary.ts:61` | `RUN_READING_WORD: Record<CanvasReading,string>` | ✅ **FORCED** |
| 8 | `components/workflows/runVocabulary.ts:170` | `STATIC_CLAUSE: Record<CanvasReading, string\|null>` | ✅ **FORCED** |
| 9 | `components/workflows/runVocabulary.ts:313` | `RING_GEOMETRY: Record<CanvasReading, RingSpec>` | ✅ **FORCED** |
| 10 | `components/workflows/runVocabulary.ts:239` | `RUN_READING_BORDER: Partial<Record<…>>` | ❌ silent — Partial. Correct to leave unset (a quiet state). |
| 11 | `components/workflows/NodeRunOverlay.tsx:134` | `RING_STROKE: Record<CanvasReading,string>` | ✅ **FORCED** |

⚠ **`RING_GEOMETRY` is the expensive one, and it is not a table fill.** Its docblock (`runVocabulary.ts:296-311`) states a BUILD CRITERION, verbatim: *"**The arc geometry IS the state; colour only ever reinforces it.** …with colour switched off every reading must still be identifiable, and each row below is unique in a property a test can assert"* — and then enumerates all seven uniqueness properties (`not-started` = the only one with NO arc; `done` = the only closed ring; `failed` = the only one snapped in TWO; `unknown` = the only DOTTED; etc.).

**An 8th reading owes an 8th shape that is unique in an assertable property, in greyscale.** The remaining design space is thin. The two obvious candidates and their honest costs:

- a `{kind:"length"}` texture with a third dash/gap ratio — cheap, but `skipped` (5/7) and `unknown` (1.5/6) already occupy the coarse and the fine ends, so a third sits between them and is the **weakest** distinction on the board;
- a `{kind:"fraction"}` arc with a gap centred somewhere no other reading uses (`waiting-for-you` owns 12 o'clock at `gapCentre: 0.75`; `failed` owns `0.375`) — stronger, and the shape stays readable at 22 px radius.

**This is a G-2-exempt phase, so there is no sketch to defer to** (ROADMAP line 675 exempts 189 by name as "the design/decision phase"). ⇒ **the ring shape is a plan decision that owes a driven greyscale UAT row**, not a table entry.

**✅ D-07's instrument confirmed — what a new slug renders as TODAY, before any vocabulary is added:**
`phaseStatusFromDb("recorded_not_sent")` → the own-property guard misses → `"unknown"` → `canvasReading` `default:` → `"unknown"` → `RUN_READING_WORD.unknown` = **`"State unknown"`** (`runVocabulary.ts:68`) and `WorkflowRunPage.tsx:302` = *"State unknown — this run reported a state we don't recognise."* Never *"Complete"*. **That is the fail-closed baseline, and it means the migration can land BEFORE the vocabulary without ever lying** — which is a genuine wave-ordering freedom.

**✅ D-16's word does not collide.** `RUN_READING_WORD` = `Not started · Running · Complete · Failed · Skipped · Paused for your answer · State unknown`. "Not sent — recorded" collides with none, and specifically not with `Running` or the waiting reading (D-07's binding constraint). ⚠ Note it *shares a prefix* with "Not started"; a test asserting `.toContain("Not")` would become ambiguous. Prefer exact-match assertions.

---

## Section C — The canvas surface (D-12, D-13, D-18, the 7th glyph)

### C10 · Re-derived subtree measurements and every anchor CONTEXT names

```bash
wc -l PhaseNodeCard.tsx phaseNodeCardContract.ts NodeCornerMarks.tsx NodeRunOverlay.tsx NodeIconWell.tsx ownProperty.ts
grep -n "── The card ──" PhaseNodeCard.tsx
grep -rn "slot 1|badge slot|BadgeSlot|189" <the six files> canvasModel.ts PhaseNode.tsx
grep -n "PHASE_GLYPHS" components/workflows/soulData.ts lib/phaseGlyph.tsx
```

| CONTEXT claim | Measured | Verdict |
|---|---|---|
| `PhaseNodeCard.tsx` 274 L, separator at `:106` | **274 L**, `── The card ──` at **`:106`** | ✅ HOLDS |
| `phaseNodeCardContract.ts` 214 L | **214** | ✅ |
| `NodeCornerMarks.tsx` 272 L | **272** | ✅ |
| `NodeRunOverlay.tsx` 319 L | **319** | ✅ |
| `NodeIconWell.tsx` 167 L | **167** | ✅ |
| `ownProperty.ts` 86 L, zero imports | **86**, zero imports | ✅ |
| subtree = 1332 L | 274+214+272+319+167+86 = **1332** | ✅ HOLDS |
| `BadgeSlots` at `phaseNodeCardContract.ts:104` | `export type BadgeSlots = readonly [] \| readonly [BadgeSlot] \| BadgeSlot2Tuple` at **`:104`** | ✅ HOLDS |
| top-right claimed at `:196` | `:196` — *"the card is CLAIMED for governance — 188/189 may not take it"* | ✅ HOLDS |
| `PHASE_GLYPHS` at `soulData.ts:43` | **`:43`**, 6 entries | ✅ HOLDS (and CONTEXT's correction of the old `phaseVocabulary.ts` pointer is confirmed right) |
| `phaseGlyph.tsx:34` states the same-commit rule | `:34` — *"Both maps below… swapped in the SAME commit: swapping one alone leaves phaseGlyph() returning the old component while the string fallback changed, a silent split-brain."* | ✅ HOLDS |
| `phaseVocabulary.ts` 641 L | **641** | ✅ |
| Badge slot 1 reserved: "5 source files + 2 test guards" | **verified — see below** | ✅ HOLDS, with one addition |

**The badge-slot-1 reservation — all SEVEN sites, exact `file:line`:**

| # | Site | Text |
|---|---|---|
| 1 | `PhaseNodeCard.tsx:39-40` | *"Badge slot 1 stays EMPTY and RESERVED FOR PHASE 189 (D-12)"* |
| 2 | `canvasModel.ts:138-139` | *"both badge slots are committed to 188/189. Badge slot 1 is deliberately EMPTY"* |
| 3 | `NodeCornerMarks.tsx:25-27` (also `:217`, `:223`) | *"the freed slot belongs to 188 / 189"* |
| 4 | `PhaseNode.tsx:209-211` | *"Slot 1 is therefore still empty and now belongs to Phase 189 alone."* |
| 5 | `PhaseNode.tsx:259` | *"would spend the corner the seal claims or a badge slot 188/189 owns"* |
| **+** | `phaseNodeCardContract.ts:6-7` | ⚠ **A SIXTH source file CONTEXT's list omits** — *"189 adds a slot to a contract of this size rather than to a 797-line component"* |
| T1 | `PhaseNodeCard.test.tsx:2156` | *"Non-vacuity: it is a real badge row, and slot 1 is still empty and still reserved."* (CONTEXT said `:2147-2156` — the `describe` opens at `:2146`, the assertion is `:2156`) ✅ |
| T2 | `WorkflowCanvas.test.tsx:422-423` | `describe("WorkflowCanvas — the badge slots (D-183-07, Phase 185 frees slot 1)")` / `it("NO phase node carries a grounding chip — slot 1 is empty and reserved")` ✅ EXACT |

**⇒ Spending slot 1 flips SIX prose claims from "reserved" to "spent" and requires BOTH test guards to be rewritten (not deleted — rewritten to assert the new conditional).** T2 in particular currently asserts *an absence on every node*; after 189 it must assert "absent unless not-connected", with a positive control.

### C11 · What spending badge slot 1 mechanically requires — the full trace

```bash
sed -n '70,110p' phaseNodeCardContract.ts
sed -n '190,235p' PhaseNode.tsx
sed -n '120,155p' canvasModel.ts
```

**Who CONSTRUCTS the tuple: `PhaseNode.tsx:214-220`, and nobody else.** Verbatim:

```tsx
  const waitsForYou: BadgeSlot = {
    testId: "canvas-waits-for-you",
    tone: "primary",
    label: "Waits for you",
    dataAttr: { "data-waits-for-you": "true" },
  }
  const badges: BadgeSlots = data.waitsForYou ? [waitsForYou] : []
```

**⇒ The D-18 "Not connected" conditional lives at `PhaseNode.tsx:220`**, and the edit is one expression:

```
const badges: BadgeSlots = <notConnected ? [notConnectedBadge] : []>  combined with  <waitsForYou ? [waitsForYou] : []>
```

⚠ **Order matters and is not free.** `BadgeSlots` is an ORDERED tuple: `[slot1, slot2]`. The `waitsForYou` badge is documented as **slot 2** (`canvasModel.ts:150`, `PhaseNode.tsx:213`, `phaseVocabulary.ts:635`). So the new badge must be FIRST in the array. A naive `[...a, ...b]` spread also **loses the tuple type** and turns `BadgeSlots` into `BadgeSlot[]` — which silently retires the max-2 typecheck guard. **Build the tuple with explicit branches, never a spread.**

⚠ **`external_action` and `llm_human_input` are different types, so both badges can never co-occur today** — but the plan should still write the two-badge branch, because the tuple type demands it be representable and because a positive control needs it.

**The data path** (three hops, all measured):

1. **`canvasModel.PhaseNodeData`** (`:121-152`) gains a `notConnected: boolean`. Every sibling field (`grounded`, `armed`, `waitsForYou`) is resolved once at projection time in `buildPhaseData` (`:285-300`) through a small delegating predicate (`isGrounded` `:255`, `isArmed` `:259`, `waitsForYou` from `phaseVocabulary:639`). **Follow that shape exactly** — add `notConnectedOf(phase)` to `phaseVocabulary.ts` and one line to `buildPhaseData`.
2. **`PhaseNode.tsx:220`** builds the tuple from `data.notConnected`.
3. **`PhaseNodeCard`** renders it via the existing `badges?: BadgeSlots` prop (`phaseNodeCardContract.ts:164-165`) — **no change to the card at all.** That is exactly what 188.2 cut the contract out for.

**The max-2 guard is control-tested, not merely typed:** `phaseNodeCardContract.ts:94-104` — *"a third is a TYPECHECK ERROR, not a review comment"* — plus 188.2-01's `@ts-expect-error` control observed RED at 34 type errors and back at 33. **Measured today: `npx tsc --noEmit -p tsconfig.app.json` → 33 errors** ✅ (CONTEXT's figure HOLDS).

**Three invariants 189 must not break, all mechanically guarded:**
- **No third badge** — typecheck (`BadgeSlots`)
- **No focusable control inside the card** — 188.2 drove it RED against a planted `<button>` in `NodeCornerMarks.tsx`. The badge is a `<span>`; keep it so.
- **Top-right is the seal's** — `phaseNodeCardContract.ts:196`. The badge row is not top-right; no conflict.

**⇒ 189 needs NO new module in the card subtree.** Files touched: `canvasModel.ts` (+1 field, +1 predicate call), `phaseVocabulary.ts` (+1 predicate), `PhaseNode.tsx` (+1 badge object, 1 changed expression). `PhaseNodeCard.tsx` and the five sibling modules are **untouched**. That honours the "prefer filling an existing slot" cost note.

### C12 · The D-13 ladder — the maps, the shapes, and how tier 2 is computed today

```bash
grep -n "^export function|^export const" components/workflows/phaseVocabulary.ts
sed -n '152,210p' components/workflows/phaseVocabulary.ts
sed -n '480,600p' components/workflows/phaseVocabulary.ts
```

**The three per-type maps** (all `Record<string, string>`, all silent to a 7th key):

| Tier | Const | Line | Entry shape | 189's entry |
|---|---|---|---|---|
| 3 (floor) | `PHASE_TYPE_SENTENCES` | **`:152-159`** | `llm_emit: "Produce the deliverable"` | the generic type sentence D-13 falls back to |
| supporting line | `PHASE_TYPE_SUBTITLES` | **`:162-169`** | `llm_emit: "Fills your template and produces the file"` | one line |
| ⌥ reveal | `PHASE_TYPE_LABELS` | **`:176-183`** | `llm_emit: "Deliverable"` | one label |

**Tier 2 — `derivedFace`** (`:516-580`) is where D-13 lands. It is a **numbered, most-specific-first ladder** whose order is itself the decision (D-187-04), with **two of five tiers TYPE-GATED**:

```
(1) BOUND SKILL      → `Run the ${skillName}`                                   — ungated
(2) TEMPLATE         → `Fill ${templateFilename}`   — GATED on llm_emit
(3) FOLDER SCOPE     → `Search ${folderName}`       — GATED on GROUNDING_DIAL_TYPES
(4) HUMAN INPUT      → "Wait for your approval"     — GATED on llm_human_input
(5) otherwise NULL   → the honest floor; caller falls through to the type sentence
```

**How it is computed at render, never stored** (three properties the plan inherits):
- `derivedFace(inputs: DerivedFaceInputs)` is a **pure function of flat inputs**; `derivedFaceOf(phase, ctx)` (`:595`) is the phase-shaped adapter that *"declares NO branch of its own"*. The panel calls one, the canvas the other — that is what stops them drifting.
- **INJECTED CONTEXT, NOT A FETCH** — `NameContext` (`:461-478`) carries `folderNames` / `skillNames` / the template asset, all optional, every miss a fall-through.
- **NEVER FABRICATE A CAPABILITY** (`:471-478`, the 187-17/WR-02 rule): *"rendering `Search {folder}` on a step whose executor performs no retrieval states something the step cannot do."*

**⇒ D-13's tier for 189 is clean and needs NO new mechanism:** `capability` is stored ON THE CONFIG (unlike `folder_scope`'s UUIDs and `skill_ref`'s ids), so no `NameContext` lookup is needed at all — it is a pure map from a closed three-member set to three sentences. Insert it as a **type-gated tier**, numbered, above (4):

```
(3.5) EXTERNAL CAPABILITY → "Sends an email" / "Creates a ticket" / "Posts a message"
      GATED on phaseType === "external_action"
```

⚠ **Two things the plan must get right, both stated in the source:** (a) tier 4's gate is `HUMAN_INPUT_PHASE_TYPE` at `:454` and each gate is a named module-scope constant, not an inline literal — follow that; (b) **`GROUNDING_DIAL_TYPES` is READ and NEVER edited** (`:557`, a D-185-15 red line) — an `external_action` node must not be added to it.

**The measured reason D-13 matters** (`:483-489`): *"On the live corpus (:54322, 2026-08-02) **0 of 57** phases across the 27 well-formed rows carry a real `phase.name`"* — so tier 3 is what users actually see 100% of the time. (CONTEXT quotes "10 of 119"; the shipped docblock's own corrected figure is **0 of 57 well-formed**. Both describe the same finding; use the source's.)

### C13 · The `?raw` source fence — the exact path list

```bash
sed -n '260,272p' PhaseNodeCard.test.tsx
grep -n "cardSubtreeSource" PhaseNodeCard.test.tsx
```

**`CARD_SUBTREE_PATHS` — `PhaseNodeCard.test.tsx:260-267`, verbatim:**

```ts
const CARD_SUBTREE_PATHS = [
  "./PhaseNodeCard.tsx",
  "./phaseNodeCardContract.ts",
  "./ownProperty.ts",
  "./NodeCornerMarks.tsx",
  "./NodeRunOverlay.tsx",
  "./NodeIconWell.tsx",
] as const
const CARD_MODULES = import.meta.glob("./*.{ts,tsx}", { query: "?raw", eager: true, import: "default" })
const cardSubtreeSource = CARD_SUBTREE_PATHS.map((p) => CARD_MODULES[p] ?? "").join("\n")
```

**17 negative fences + 4 haystacks read it** (measured: 27 `cardSubtreeSource` references at `:269, :449, :452, :453, :481, :491, :492, :493, :500, :508, :513, :535-540, :712, :754, :1416, :1428, :1432, :1449, :2021, :2084, :2100, :2118, :2119, :2135`). The bans include `onClick=`, `dangerouslySetInnerHTML=`, `<Handle`, `<ReactFlow`, `NodeProps<`, `@/lib/api`, `ICON_TINT[`, and the graph-package scope.

⚠ **`CARD_SUBTREE_PATHS` length is PINNED at `PhaseNodeCard.test.tsx:545`: `expect(CARD_SUBTREE_PATHS).toHaveLength(6)`.** So adding a file to the subtree is a two-line edit *plus* a pin move, in one commit — **and 189 should not need it at all** (§C11 keeps every edit outside the six fenced files). If a plan ever proposes a seventh module here, that is the signal to reconsider.

### C14 · The publish gauntlet's lint path — what it says about a new type

```bash
grep -n "def lint_workflow" -A 85 backend/app/services/harness/reachability.py
sed -n '1,55p' backend/app/services/harness/publish_service.py
```

**`lint_workflow` (`reachability.py:111-200`) is completely PHASE-TYPE-AGNOSTIC.** It emits five codes — `bad_index`, `unsatisfiable_skip`, `orphan_phase`, `no_terminal` (×2 situations) — every one derived from slugs, `phase_index` contiguity, skip targets and reachability. **The string `phase_type` does not appear in the function.**

**⇒ D-06 is satisfied at stage 2 (lint) with zero work.** ✅

**But D-06 is NOT satisfied at stages 2.6 and 3** — see ⚠ CONFLICTS 1 and 2. The eight-stage gauntlet in full (`publish_service.py:5-16`), with 189's verdict per stage:

| Stage | What | 189 verdict |
|---|---|---|
| 0 | load + owner-check | ✅ pass |
| 1 | `business_requirement` present | ✅ pass |
| 2 | structural lint | ✅ **pass — type-agnostic** |
| 2.5 | interactive-phase pre-run block | ✅ passes (armed ≠ validator) — **and that is the problem, see Conflict 1** |
| 2.6 | grounding fidelity | ❌ **BLOCKS on `unregistered_tool`** — Conflict 2 |
| 3 | REAL golden run | ❌ **HANGS 7200 s → `golden_run_timeout`** — Conflict 1 |
| 4 | judge verdict | untested (unreachable until 3 passes) |
| 5 | flip | — |

---

## Section D — Test / validation surface

### D15 · Current measured baselines

**FRONTEND — the count gate, run 2026-08-07:**

```bash
node scripts/vitest-count-gate.cjs
```

**`count gate OK — 45/45 pinned files present, no per-file decrease, 0 failing. total 2508 · failed 0 · pinned total 2508`**

The nine files 189 touches, with their pins:

| File | Pinned | Actual |
|---|---|---|
| `definitionOps.test.ts` | 232 | 232 |
| `PhaseNodeCard.test.tsx` | 128 | 128 |
| `phaseVocabulary.test.ts` | 96 | 96 |
| `WorkflowRunPage.test.tsx` | 89 | 89 |
| `WorkflowCanvas.test.tsx` | 52 | 52 |
| `canvasModel.test.ts` | 49 | 49 |
| `StepTypePicker.test.tsx` | 43 | 43 |
| `phaseState.test.ts` | 34 | 34 |
| `PhaseNode.test.tsx` | 26 | 26 |
| `soulData.test.ts` | 14 | 14 |
| `PhaseTimeline.test.tsx` | 10 | 10 |

**The two knobs** (`scripts/vitest-count-gate.cjs`): **`TARGETS`** (`:527`, what RUNS — `src/components/workflows` + 8 named files) and **`BASELINE`** (`:122`, what is PINNED; `BASELINE_TOTAL` computed at `:524` from `Object.values`). ⚠ **`src/lib/`, `src/components/panel/__tests__/` and `src/pages/` are covered by NAMED FILES ONLY** — a new suite beside them is invisible to the gate until its own entry exists, and **an entry pointing at a path that does not exist yet makes the gate ERROR (exit 2), so it can only be added in the commit that creates the file.**

⚠ **`D-188.2-DEF-01` re-confirmed** (`188.2-DEFERRED.md:15`): the gate's `failed` column is **not** a regression backstop on this machine. It read `failed 0` in this run; that means nothing. The COUNT columns are sound.

**`tsc`:** `npx tsc --noEmit -p tsconfig.app.json` → **33 errors** ✅ (CONTEXT's figure HOLDS exactly). ⚠ Bare `tsc --noEmit` checks ZERO files — always pass `-p tsconfig.app.json`.

**⚠ THE SIXTEEN SILENT COUNT-6 PINS.** A 7th `PhaseTypeId` makes these RED. They are assertion-level, so the count gate cannot see them coming:

```bash
grep -rn "toHaveLength(6)|\.length).toBe(6)" frontend/src/components/workflows/*.test.* frontend/src/pages/*.test.*
```

| File:line | Assertion | Why it fires |
|---|---|---|
| `definitionOps.test.ts:247` | `expect(after).toHaveLength(6)` | phase-count fixture — verify before changing |
| `definitionOps.test.ts:1479, 1497, 1508, 1512, 1524` | `allowedTypesAt(...)` → 6 | ⇒ **7** |
| `definitionOps.test.ts:1650` | `expect(out).toHaveLength(6)` | ⇒ **7** |
| `definitionOps.test.ts:1590` | `REQUIRED_CONFIG_KEYS: Record<PhaseTypeId, string[]>` | ✅ **typecheck-forced** |
| `StepTypePicker.test.tsx:140,144,372` | `describe("the six choices")`, order 6, rows 6 | ⇒ **7** + rename |
| `WorkflowCanvas.editing.test.tsx:853, 865, 873` | picker rows / reasons = 6 | ⇒ **7** |
| `phaseVocabulary.corpus.test.ts:221` | `RAW_PHASE_TYPE_TOKENS` = 6 | ⇒ **7** |
| `phaseVocabulary.test.ts:142, 659` | the six-type loops | ⇒ **7** |
| `soulData.test.ts:131-148` | the 6 glyph keys, asserted individually | ⇒ **7** |
| `PhaseNodeCard.test.tsx:796` | `Object.keys(ICON_TINT)` = 6 | ⇒ **7** |
| `PhaseNodeCard.test.tsx:545` | `CARD_SUBTREE_PATHS` = 6 | **stays 6** if §C11 is honoured |
| `PhaseNodeCard.test.tsx:727` | contract exports = 6 | **stays 6** — 189 adds a FIELD, not a type |
| `PhaseFormPanel.test.tsx:235` / `PhaseFormPanel.rails.test.tsx:365` | `const nonEmit = [5 types]` loops | ⇒ likely **6** |

⚠ Also: `definitionOps.ts:383` prose — *"the six choices offered at render position `index`. **Never fewer than six**"* — becomes wrong; and `workflow_authoring.py:62` *"The 6 phase types you can compose"* likewise.

**BACKEND — measured 2026-08-07:**

```bash
backend/venv/Scripts/python.exe -m pytest \
  tests/unit/test_harness_models.py tests/unit/test_185_detection.py tests/unit/test_validator_kinds.py \
  tests/unit/test_audit_event_registration.py tests/test_harness_engine.py tests/test_harness_reachability.py \
  tests/test_publish_gate.py tests/unit/test_103_grounding_fidelity.py tests/test_182_grounding_bundle.py \
  -q --no-header
```

**`2 failed, 166 passed`.** Both failures are `tests/test_182_grounding_bundle.py::test_grounding_bundle_returns_server_sourced_palette` and `::test_grounding_bundle_fields_come_from_the_bundle`, failing on `asyncpg.exceptions._base.InterfaceError: pool is closing` — **live-DB integration, pre-existing, unrelated to 189**. ⚠ The venv is at `backend/venv/Scripts/python.exe`; a bare `python -m pytest` fails with `ModuleNotFoundError: No module named 'pydantic_settings'`.

**Backend suites 189 must extend:** `test_harness_models.py` (union parse, `:72`, `:105` enumerate types), `test_harness_conftest_smoke.py:51` and `test_harness_engine.py:200,236` (six-type lists), `test_185_detection.py` (the detection/arming matrix), `test_publish_gate.py` + `tests/unit/test_103_grounding_fidelity.py` (the two Conflict surfaces), `test_harness_reachability.py` (lint stays type-agnostic).

---

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Frontend framework | **vitest** (`frontend/package.json` → `"test": "vitest run"`) + jsdom + @testing-library |
| Frontend gate | `node scripts/vitest-count-gate.cjs` — per-FILE count differential, two knobs (`TARGETS` / `BASELINE`) |
| Frontend typecheck | `npx tsc --noEmit -p tsconfig.app.json` (**baseline 33**; bare `--noEmit` checks ZERO files) |
| Backend framework | **pytest** (`backend/pytest.ini`) via **`backend/venv/Scripts/python.exe`** |
| Backend config | `backend/pytest.ini`; `backend/tests/conftest.py` (imports `app.main` — needs the venv) |
| Quick run (frontend) | `cd frontend && npx vitest run src/components/workflows/<file>.test.tsx` |
| Quick run (backend) | `backend/venv/Scripts/python.exe -m pytest tests/unit/test_harness_models.py -q` |
| Full suite (frontend) | `node scripts/vitest-count-gate.cjs` (**2508 / 45 files / 0 failing** at HEAD) |
| Full suite (backend, 189 scope) | the 9-file command in §D15 (**166 passed / 2 pre-existing failed**) |

### Phase Requirements → Test Map

| Req / SC | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| SC#1 · CONN-01 | The 7th union member parses; an unknown key still 422s; a pre-189 row still validates | unit | `venv/Scripts/python.exe -m pytest tests/unit/test_harness_models.py -q` | ✅ extend |
| SC#1 | `PHASE_TYPE_REGISTRY` resolves `external_action`; no `PhaseTypeNotRegistered` | unit | `… -m pytest tests/test_harness_engine.py -q` | ✅ extend |
| SC#1 | The picker offers **7** choices in `PHASE_TYPE_ORDER`; `slugForType` + `minimalPhaseFor` produce a valid phase | unit | `npx vitest run src/components/workflows/definitionOps.test.ts src/components/workflows/StepTypePicker.test.tsx` | ✅ extend (⚠ 8 `toHaveLength(6)` pins) |
| SC#1 · D-03 | The capability lands in `available_tools`; `phase_whitelist` refuses a name not on it | unit | `… -m pytest tests/test_harness_whitelist.py -q` | ✅ extend |
| SC#1 · D-03 | **Disjointness: `{send_email,create_ticket,post_message} ∩ KB_TOOLS == ∅`, and `grounding_cause` returns `None`** | unit | `… -m pytest tests/unit/test_185_detection.py -q` | ✅ extend — **assert the SET, not one name** |
| SC#2 · D-04 | `action_risk_armed` **cannot be stored false** on this type — falsify by round-tripping a definition with `armed: false` through `model_validate` and asserting `True` | unit | `… -m pytest tests/unit/test_harness_models.py -q` | ❌ **Wave 0** |
| SC#2 · D-04 | The run-time checkpoint fires on an `external_action` phase (`harness_engine.py:754`) | unit | `… -m pytest tests/test_harness_engine.py -q` | ✅ extend |
| SC#2 · D-04 | The canvas arming switch renders **on and non-interactive** for the type | unit (jsdom) | `npx vitest run src/components/workflows/GovernanceSection.test.tsx` | ✅ extend |
| SC#2 | Cannot be wired around: an `external_action` phase with an emptied `available_tools` is a validation error | unit | `… -m pytest tests/unit/test_harness_models.py -q` | ❌ **Wave 0** |
| SC#4 · D-05 | The executor performs **NO network I/O** — assert with a falsifying control (patch the HTTP transport to raise, run the executor, assert it does not raise) | unit | `… -m pytest tests/test_harness_engine.py -q` | ❌ **Wave 0 — this is SC#4's only mechanical proof** |
| SC#4 | **`grep -rn "mcp" backend/app` returns 0** (a source fence, the `?raw` idiom in Python) | unit | `… -m pytest tests/unit/test_189_no_egress.py -q` | ❌ **Wave 0** |
| D-05 | On approval the phase writes `status='recorded_not_sent'` **and the run CONTINUES to the next phase** | unit | `… -m pytest tests/test_harness_engine.py -q` | ✅ extend — **assert the NEXT phase ran, not just the status** |
| D-08 / D-17 | Migration 115 admits `recorded_not_sent` and **rejects `'Not sent — recorded'`** (a positive AND a negative control against the constraint) | integration | `… -m pytest tests/test_migration_115.py -q` (live :54322) | ❌ **Wave 0**, runs after the operator applies |
| D-07 / D-16 | `phaseStatusFromDb("recorded_not_sent")` ≠ `"done"`; `runReadingWord` ≠ `"Complete"`; **≠ `"Running"` and ≠ the waiting word** | unit | `npx vitest run src/lib/phaseState.test.ts src/components/workflows/PhaseNodeCard.test.tsx` | ✅ extend |
| D-07 | The word renders at all **three** surfaces (canvas node, run surface, phase output) | unit | `npx vitest run src/pages/WorkflowRunPage.test.tsx src/components/workflows/PhaseNode.test.tsx` | ✅ extend |
| D-09 | **NO new `harness_audit` event type** — assert the Python literal set is unchanged (the existing pin already does this) | unit | `… -m pytest tests/unit/test_audit_event_registration.py -q` | ✅ **already guards it** |
| D-12 / D-18 | Badge slot 1 carries "Not connected" **only when not connected**; slot 2 unchanged; a third badge is a typecheck error (`@ts-expect-error` control) | unit | `npx vitest run src/components/workflows/PhaseNodeCard.test.tsx src/components/workflows/WorkflowCanvas.test.tsx` + `tsc -p tsconfig.app.json` | ✅ **rewrite** T1/T2 |
| D-13 | The derived face is capability-specific for all three capabilities and falls to the type sentence when none is chosen | unit | `npx vitest run src/components/workflows/phaseVocabulary.test.ts` | ✅ extend |
| Glyph | `PHASE_GLYPHS` and `PHASE_GLYPH_MARKS` agree (7 = 7, same keys) — the split-brain fence | unit | `npx vitest run src/components/workflows/soulData.test.ts` | ✅ extend |
| D-06 · ⚠ C1 | **An `external_action` workflow PUBLISHES** — mock the judge, assert `published: true` and `blocked_stage` absent | unit | `… -m pytest tests/test_publish_gate.py -q` | ✅ extend — **this test fails RED today and is the phase's headline gate** |
| D-06 · ⚠ C2 | Stage 2.6 emits **no** `unregistered_tool` finding for the three capabilities | unit | `… -m pytest tests/unit/test_103_grounding_fidelity.py -q` | ✅ extend |
| ⚠ C2 leak | The three capabilities are **NOT** in `GroundingBundle.tools` (so no `llm_agent` can whitelist one) | unit | `… -m pytest tests/test_182_grounding_bundle.py -q` | ✅ extend — ⚠ this file has 2 pre-existing DB failures |
| SC#3 · D-10 | The `docs/` doc exists and the `DECISIONS.md` entry **points at it without restating it** | unit (grep) | a doc-fence test, or a `checkpoint:human-verify` | ❌ **Wave 0 or checkpoint** |

### Sampling Rate

- **Per task commit:** the ONE quick command for the file touched (e.g. `npx vitest run src/components/workflows/phaseVocabulary.test.ts`, or `venv/Scripts/python.exe -m pytest tests/unit/test_harness_models.py -q`). < 15 s each.
- **Per wave merge:** `node scripts/vitest-count-gate.cjs` **and** `npx tsc --noEmit -p tsconfig.app.json` (must read exactly **33**, or the delta must be explained) **and** the 9-file backend command (must read **166 passed / 2 failed**, the two named).
- **Phase gate:** both full suites green at their measured baselines + all UAT rows below driven, before `/gsd:verify-work`.

⚠ **Do NOT read the count gate's `failed 0` as "no regression"** (`D-188.2-DEF-01`). The COUNT columns are the backstop; the failure column is rot.

### What jsdom CANNOT prove here — the rows that need a driven Chrome MCP session

`jsdom` applies **no CSS**, computes **no stacking contexts**, and `.click()` **bypasses hit-testing** entirely. That is how `BUG-260806-01` survived from 184-12 and how `BUG-260807-01` survives today. **A green unit suite is not evidence for any of the following:**

| # | Claim jsdom cannot reach | Driven method |
|---|---|---|
| U1 | The 7th glyph is **visible** on Deep Midnight and not ~4× dimmer than the other six (the exact `llm_batch_agents` luminance-34.5 defect that forced the 184 swap) | Chrome MCP `evaluate_script` reading computed fill/luminance of the rendered mark against the other six on one canvas |
| U2 | The "Not connected" badge does **not occlude, and is not occluded by**, the ⛨ seal, the verdict mark, or the ✕/＋ lane affordances | `document.elementFromPoint(x,y)` at the badge's own centre AND at each neighbour's — **with a falsification control observed swinging both ways**, exactly as `BUG-260806-01` was closed |
| U3 | The 8th ring reading is distinguishable **by shape alone in greyscale** from the other seven | screenshot with `filter: grayscale(1)` + read the `stroke-dasharray`/`stroke-dashoffset` presentation attributes for all eight |
| U4 | Adding a badge does not change card height or push the subtitle out of the 248 px / 62 px body budget | `getBoundingClientRect()` on the card before and after |
| U5 | **D-188.2-DEF-07 (owed) — row A2**: the seven readings stay distinguishable by shape on a **live run**, the running arc spins, a card with no reading is still | ride the first D-06 live run |
| U6 | **D-188.2-DEF-08 (owed) — row A1's visual half**: one glance at a Builder card | zero-cost, pair with U5 |

⚠ **The app has no URL router** — `ActiveView` is React state at `App.tsx:102` (verified: `export type ActiveView = "chat" \| … \| "workflow-run"`), so visiting `/workflows` renders chat and the URL is inert. **Every Chrome MCP row must navigate by clicking, never by deep link.** ⚠ `take_screenshot` times out repeatedly in this estate (`Page.captureScreenshot`) — prefer `evaluate_script` DOM/geometry reads, which are machine-checkable and do not wedge.

### Wave 0 Gaps

- [ ] `backend/tests/unit/test_189_external_action_model.py` — D-04's stored-false coercion, D-02's closed-set raise, the emptied-`available_tools` refusal
- [ ] `backend/tests/unit/test_189_no_egress.py` — SC#4: the `grep mcp → 0` source fence + the patched-transport falsification
- [ ] `backend/tests/test_migration_115.py` — the positive/negative CHECK controls (runs after operator apply)
- [ ] A capability-picker component test file, if the picker becomes its own component (§G-5 says it should)
- [ ] **No framework install needed** — vitest and pytest are both present and green.
- [ ] ⚠ **Every new frontend suite needs its `TARGETS` entry IN THE COMMIT THAT CREATES IT** (earlier = exit 2 ERROR; later = the gate never runs it). `src/lib/` and `src/pages/` are named-file-only.

---

## Section E — SC#3, the recorded decision (D-10, D-11)

### E17 · `DECISIONS.md` — the highest D-number and the exact entry format

```bash
wc -l .planning/prd-reset/DECISIONS.md            # → 1424
grep -n "^## D-" .planning/prd-reset/DECISIONS.md
```

| Fact | Measured |
|---|---|
| File length | **1424 L** |
| Highest cross-milestone ADR | **`D-PRD-15`** (`:1250`) — SecretsBackend Interface Contract |
| Highest per-milestone ADR | **`D-v3.4-01`** (`:1400`) — Tenancy-Model ADR, *"the FIRST `D-vX.Y-NN` entry recorded in this file"* |
| Structure after the ADRs | `## Decisions explicitly NOT made yet` (`:1311`) then `## Cross-references` (`:1411`) |

**⇒ 189's entry is `D-v3.6-01`** — the per-milestone prefix, first of its milestone. The ID convention is stated at `:29-32`: *"`D-PRD-NN` distinguishes these business-shape decisions from per-milestone architectural decisions (which keep the `D-v2.5-NN`, `D-v2.6-NN`, etc. prefix tied to the milestone they were locked in)."*

**The FORMAT to match — and `D-v3.4-01` is the exact model for D-10, because it is itself a POINTER entry that does not restate its doc:**

```markdown
## D-v3.4-01 — Tenancy-Model ADR (ratifies D-PRD-02)

**Status:** Ratified 2026-07-18
**Type:** Per-milestone architectural decision (v3.4). …

<2-3 paragraphs of what it locks and where the full text lives>

`D-PRD-02` itself is unchanged by this entry — see its section above for the full posture
rationale. **This is a pointer; the full ratification lives in `160-ADR.md`.**
```

The longer `D-PRD-15` shape (`### Context` / `### Decision` / `### Consequences` / rejected-alternatives) is the *full ADR* form. **D-10 explicitly forbids restating the doc**, so **copy `D-v3.4-01`'s pointer shape, not `D-PRD-15`'s.** Placement: **after `D-v3.4-01` (`:1409`) and before `## Cross-references` (`:1411`)**, and add a bullet to the `## Cross-references` list.

### E18 · The verdict basis — SEED-013 / SEED-014 and the deep-dive crawl

```bash
head -60 .planning/seeds/SEED-013-external-integrations-api-mcp.md
head -40 .planning/seeds/SEED-014-automations-routines.md
ls .planning/research/deep-dive/
```

**`.planning/research/deep-dive/` contains exactly three files: `BEAM.md`, `GLEAN.md`, `N8N.md`.** ✅ (CONTEXT's "the Beam / Glean / n8n crawl" HOLDS.)

**SEED-013** (`status: planted`, `priority: high`, planted at v2.5 close) — *External Integrations: public API, MCP server, webhooks, service accounts.* Three consumer modes: REST API, **MCP (we are the SERVER; Claude Desktop / Cursor / Cline are the clients)**, webhooks. Its own v2.5 audit records, verbatim: *"**No MCP code anywhere in the repo** (greps clean)… The MCP servers configured in `.mcp.json` are *consumed* by Claude Code, not *served* by this app."* ⚠ **This is the ORIGINAL source of the landmine 189 re-verified in §F18 — and it has been true continuously since 2026-05-09.** Its competitive section names OpenAI Assistants, Anthropic API, Glean, LangChain/LlamaIndex, Cursor/Cline/Aider, ChatGPT/Claude Desktop, n8n/Zapier.

**SEED-014** (`status: planted`, `priority: high`) — *Automations & Routines.* Its binding sequencing note: *"**Do not plan automations as a separate primitive — plan them as a runtime mode for skills.**"* Its `relates_to` names SEED-013 explicitly: *"webhook-triggered automations are the reactive mode of this seed; outgoing webhooks notify other apps when an automation completes."* Its trigger list already names *"confidence-gated escalation / human-in-the-loop… especially via **n8n + customer-support ticket triage**"* — the same JIRA/Slack slice 190 targets.

⚠ **Note SEED-031 is the LLM-provider seed, NOT connectors** (CONTEXT and ROADMAP line 615 both say so). Do not cite it.

**⇒ The verdict D-11 records — MCP-first, first-party-thin, broad catalog sequenced with Open Platform (SEED-013/014) — is supported by all three sources and needs no re-validation.** The doc's job is to state it, name the three research files as its basis, and carry the dated re-open trigger.

### E19 · `docs/` conventions the new architecture doc must match

```bash
ls docs/
head -20 docs/DEPLOYMENT-WORKFLOW.md docs/SANDBOX-PACKAGES.md
```

`docs/` holds exactly **five** files: `DEPLOYMENT-LESSONS.md`, `DEPLOYMENT-PIPELINE.md`, `DEPLOYMENT-WORKFLOW.md`, `OPERATOR.md`, `SANDBOX-PACKAGES.md`.

**Conventions, measured:** SCREAMING-KEBAB filenames · **no YAML front matter on any of the five** · a single `# TITLE` H1 then `##` sections · referenced BY NAME from `CLAUDE.md` (all five are). **⇒ `docs/CONNECTOR-ARCHITECTURE.md`** (or similar), no front matter, one H1, and — following the `SANDBOX-PACKAGES.md` precedent, which `CLAUDE.md` calls *"the canonical package list"* — **a `CLAUDE.md` pointer line in the same commit**, so the doc is discoverable rather than orphaned.

---

## Section F — Landmine re-verification

**Every landmine CONTEXT lists, with the command and the verdict.**

| # | Landmine | Command | Verdict |
|---|---|---|---|
| L1 | **Zero MCP code in `backend/app`** | `grep -rni "\bmcp\b" backend/app --include=*.py \| wc -l` | ✅ **HOLDS — 0 hits.** Any plan implying an MCP client exists is wrong. |
| L2 | `_exec_llm_human_input` times out at 300 s (cap 1800) and **returns NORMALLY — the run ADVANCES** | `sed -n '686,700p;775,815p' backend/app/services/harness/phase_types.py` + `sed -n '118,127p' backend/app/models/harness.py` | ✅ **HOLDS.** `timeout_seconds: int = 300` (`harness.py:126`), clamped to `settings.ask_user_max_timeout_seconds` (1800). On `payload is None` the function sets `answer = ""` and **returns `{"text": prompt, "answer": "", "tool_call_id": …}` normally**. ⚠ **BUT — and this materially changes the plan:** the ARMED checkpoint does **not** use this substrate. It goes through `_resolve_failure_with_ask_user` with `timeout_seconds = None` (`harness_engine.py:1104`, DELTA 2) ⇒ an indefinite wait ⇒ **already fail-closed.** DELTA 3 (`:1197`) additionally raises `CancelledError` on a shutdown sentinel so a deploy cannot destroy an armed run, and DELTA 4 (`:1215`) keeps the `None`-payload → refuse branch for unparseable answers. **189 must NOT reuse `_exec_llm_human_input`; the checkpoint it inherits is already correct.** |
| L3 | `workflow_phases.status` has exactly **5** allowed values | `grep -n workflow_phases_status_check supabase/full-schema.sql` | ✅ **HOLDS — still 5, still line 1932.** |
| L4 | The card subtree GREW to **1332 L** | `wc -l` × 6 | ✅ **HOLDS — 1332 exactly.** Prefer filling an existing slot. §C11 does. |
| L5 | `PhaseNodeCard.tsx` is G-5 firing at 797 L | `wc -l` | ✅ **RETIRED, as CONTEXT says — 274 L.** |
| L6 | jsdom is blind to CSS, stacking and hit-testing; `.click()` bypasses hit-testing | — (the standing project finding; `BUG-260806-01`/`BUG-260807-01` are its evidence) | ✅ HOLDS. Encoded as U1-U6 above. |
| L7 | The app has **no URL router** — `ActiveView` is React state at `App.tsx:102` | `grep -n "ActiveView" frontend/src/App.tsx` | ✅ **HOLDS — `:102` exactly**, `useState<ActiveView>` at `:126`; `:130` says *"ActiveView precedent — no router"*. |
| L8 | The count gate's `failed` column is not a regression backstop | `188.2-DEFERRED.md:15` + this session's run | ✅ HOLDS. |
| L9 | `slug: str` at `harness.py:202` is **unconstrained** | `grep -n "slug: str" backend/app/models/harness.py` | ✅ **HOLDS — `PhaseSpec.slug: str` at `:202`** (and `WorkflowDefinition.slug: str` at `:291`), no pattern, no enum, no reserved-word list. **Relevant to 189: any new slug-keyed OR type-keyed lookup must use `own<T>()`** (`ownProperty.ts`, 86 L, zero imports) — and there is one such lookup in this phase's blast radius already: `canvasModel.ts` reads `PHASE_TYPE_SUBTITLES[phaseType] ?? ""` on a plain object literal, which is the exact WR-04 shape `phaseGlyph.tsx:81-92` and `phaseState.ts:65-75` were both fixed for. Worth guarding while adding the 7th key. |

**Additional pointer verification (CONTEXT's `<canonical_refs>`):**

| Pointer | Verdict |
|---|---|
| `ROADMAP.md` §189 at **lines 606-620** | ✅ `#### Phase 189` is at **`:606`**; goal/deps/reqs/4 SCs/plans/UI-hint/flags run to `:620` |
| `ROADMAP.md:669` = 189's progress row · `:675` = G-2 exemption · `:678` = threat model → 190 | ✅ all three HOLD |
| `REQUIREMENTS.md:59` = CONN-01 verbatim; CONN-02/03 at `:65-66` | ✅ HOLDS (`:65` CONN-02, `:66` CONN-03) |
| `harness.py:162` = the union, 6 members | ✅ HOLDS |
| `harness.py:144+` = `LlmEmitPhaseConfig` docblock, the additive precedent | ✅ `:128-160`; the *"appended… as the 6th discriminated member (the standard extension — the 5 existing members were added this way)"* sentence is at `:137-139` |
| `phase_types.py` `PHASE_TYPE_REGISTRY_ENTRIES` at `:1658`, file 1681 L | ✅ **both exact** |
| `runs.py:671` `resolve_phase_available_tools` | ✅ exact |
| `grounding.py:797` `KB_TOOLS` | ✅ exact |
| `validator_kinds.py:714` `action_risk_approval` | ⚠ **off by one** — the section comment is `:714`, the decorator `:715`, the function `:716`. Immaterial. |
| `db/workflows.py:120-136` the audit literal set | ✅ the set runs `:99-136`; `action_risk_pending` is the last member at `:135` |
| `full-schema.sql:1932` | ✅ exact |
| `soulData.ts:43` `PHASE_GLYPHS` | ✅ exact, 6 entries |
| `phaseGlyph.tsx:34` same-commit rule | ✅ exact |
| `phaseNodeCardContract.ts:104` / `:196` / `:6-7` | ✅ all exact |
| `PhaseNodeCard.test.tsx:2147-2156` | ⚠ the `describe` opens `:2146`, the assertion is **`:2156`** — the range is right, the anchor is the last line |
| `WorkflowCanvas.test.tsx:422-423` | ✅ exact |

**⚠ TWO STALE CLAIMS FOUND IN THE TREE ITSELF (not in CONTEXT), both owed a same-commit correction:**

1. **`canvasModel.ts:201-203`** claims `false` is Phase 189's edge state. D-04 makes it unreachable. See ⚠ CONFLICT 3.
2. **`.planning/ROADMAP.md`** (the Migrations guardrail bullet, ~`:680`) still reads *"live head = 113; next free slot = 114"*. Measured head is **114**; next free is **115**. Migration 115 is itself the second ROADMAP amendment of this milestone (185/114 was the first), so this line is due an update anyway.

**Tally: 31 pointers checked · 28 exact · 2 off-by-one-or-range (immaterial) · 1 range-anchor · 2 stale claims found in source (not in CONTEXT).**

---

## Standard Stack

**189 adds NO dependency.** This is stated as a finding, not an omission: every mechanism the phase needs already ships.

### Core (all already installed — versions measured)

| Library | Version | Purpose | Why standard here |
|---|---|---|---|
| `pydantic` | installed (v2, `_StrictBase` uses `ConfigDict`) | The discriminated union that IS the phase-type contract | `harness.py:16-18` locks the mechanism |
| `asyncpg` | installed | The one-statement status `UPDATE`s | `db/workflows.py` — the 2-phase durable write |
| `@xyflow/react` | `^12.11.2` (`frontend/package.json`) | The canvas the node draws on | 183 introduced it; 189 adds data, not layout |
| `@iconify-json/fluent-emoji` | **`1.2.7`** (`node_modules/.../package.json`) — **3174 icons measured** | The 7th 3D glyph | `phaseGlyph.tsx:20-25` names it as the source of truth; a missing slug **fails the build** |
| `vitest` / `pytest` | installed | The two suites | measured green at 2508 / 166 |

### The 7th glyph — verified against the INSTALLED set

```bash
node -e "const d=require('./node_modules/@iconify-json/fluent-emoji/icons.json'); …"
```

| Candidate slug | Present in `@iconify-json/fluent-emoji@1.2.7`? |
|---|---|
| **`outbox-tray`** (📤) | ✅ **PRESENT** — recommended: semantically "leaves here / goes outside", distinct from all six shipped marks |
| `satellite-antenna` (📡) | ✅ PRESENT — second choice |
| `globe-with-meridians`, `link`, `envelope`, `envelope-with-arrow`, `e-mail`, `paperclip`, `electric-plug`, `rocket`, `postbox`, `incoming-envelope`, `right-arrow` | ✅ all PRESENT |
| `outbox` | ❌ **ABSENT** — the empty-icon trap, recorded so it is not tried |

⚠ **The mark is keyed by phase_type, so it is ONE mark for the type, not three per capability.** `envelope` would be a capability-specific mark and must not be used.
⚠ **Presence is necessary, not sufficient** — `llm_batch_agents` shipped a slug that existed and was *"measured luminance 34.5 on Deep Midnight, ~4x dimmer than the other five, and disappeared"* (`soulData.ts:36-40`). **U1 above is that check.**

### Alternatives Considered

| Instead of | Could use | Tradeoff |
|---|---|---|
| A 7th discriminated union member | Config-on-`llm_agent` | **Rejected by D-01.** Makes external action invisible in the schema, forcing the canvas to infer a node's nature from a tool-name string. |
| A new closed constant beside `KB_TOOLS` | Adding the three names to `get_tools()` | **Opens the leak in ⚠ CONFLICT 2** — an author could whitelist `send_email` on any agent step. |
| A `model_validator` pinning `action_risk_armed` | `Literal[True]` field · engine-only enforcement | §A4 — the first cannot work (shared `PhaseSpec`), the second protects the run but not the stored row. |
| An 8th `CanvasReading` | Mapping `recorded_not_sent` to an existing reading | **Rejected by D-07** — must be distinct at every surface. |

**Installation:** *(none — no `npm install`, no `pip install`)*

---

## Package Legitimacy Audit

**Not applicable — 189 installs no external package.** Verified: no new dependency appears anywhere in this research's recommendations; the only registry-adjacent item is a *slug* inside the already-installed `@iconify-json/fluent-emoji@1.2.7` set, confirmed present by reading the installed `icons.json` directly (3174 icons) rather than by a network lookup.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

---

## Architecture Patterns

### System Architecture Diagram

```
                         ┌───────────────────────────── AUTHORING ────────────────────────────┐
  author                 │                                                                     │
    │  picks a step type  │   StepTypePicker ──reads──▶ definitionOps.PHASE_TYPE_ORDER (+7th)  │
    ├────────────────────▶│         │                                                          │
    │                     │         └──▶ slugForType + minimalPhaseFor ──▶ builderStore        │
    │  picks a capability │                                                                     │
    ├────────────────────▶│   PhaseFormPanel ── (NEW, own component, one gated line) ───┐      │
    │                     │         │                                                    │      │
    │                     │         └── capability ⇒ config.capability                   │      │
    │                     │                        ⇒ config.available_tools = [capability]│     │
    │                     │                        ⇒ action_risk_armed PINNED TRUE ◀──────┘     │
    └─────────────────────┴──────────────────────────────┬──────────────────────────────────────┘
                                                         │ PATCH /workflows/{id}  (definition JSONB)
                                                         ▼
    ┌──────────────────────────────── BACKEND · one contract ─────────────────────────────────┐
    │  models/harness.py                                                                       │
    │    PhaseConfig = Union[…6…, ExternalActionPhaseConfig]  (discriminator=phase_type)       │
    │    PhaseSpec.model_validator ── PINS action_risk_armed=True on external_action  (D-04)   │
    └────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                             │
        ┌────────────────────────────────────┼──────────────────────────────────┐
        ▼ POST /workflows/{id}/publish       │                                   ▼ POST /threads/{id}/messages
  ┌───────────────────────────────┐          │                        ┌──────────────────────────────┐
  │ publish_service (8 stages)    │          │                        │ harness_engine.run_workflow  │
  │  2   lint       ✅ agnostic   │          │                        │                              │
  │  2.5 interactive ✅ passes    │          │                        │  mark_phase_active           │
  │  2.6 fidelity   ⚠ CONFLICT 2 │◀── tool_names ∪ EXTERNAL_ACTION_  │       │                      │
  │        needs the new constant │    CAPABILITIES (NOT bundle.tools)│       ▼                      │
  │  3   golden run ⚠ CONFLICT 1 │          │                        │  pre-gates (run_gates)       │
  │        armed ⇒ 7200s hang     │          │                        │       │                      │
  └───────────────────────────────┘          │                        │       ▼                      │
                                             │                        │  ⛨ ARMED CHECKPOINT :754    │
                                             │                        │   ask_user, timeout=None     │
                                             │                        │   ├─ refuse ─▶ run stops     │
                                             │                        │   └─ approve ─┐              │
                                             │                        │               ▼              │
                                             │                        │  _execute_phase ──▶ registry │
                                             │                        │       ▼                      │
                                             │                        │  _exec_external_action       │
                                             │                        │   • closed-set lookup, RAISE │
                                             │                        │     if absent          (D-02)│
                                             │                        │   • NO NETWORK I/O     (SC#4)│
                                             │                        │   • returns {recorded_intent}│
                                             │                        │       ▼                      │
                                             │                        │  :1605 the D-05 SEAM         │
                                             │                        │   if failure   → fail_phase  │
                                             │                        │   if recorded  → NEW WRITE   │
                                             │                        │   else         → complete    │
                                             │                        │       ▼                      │
                                             │                        │  advance_current_phase       │
                                             │                        │  ── THE RUN CONTINUES ──     │
                                             │                        └───────────┬──────────────────┘
                                             │                                    │ UPDATE workflow_phases
                                             │                                    ▼ status='recorded_not_sent'
                                             │                        ┌──────────────────────────────┐
                                             │                        │ Postgres · CHECK  (mig 115)  │
                                             │                        │  pending|active|completed|   │
                                             │                        │  failed|skipped|             │
                                             │                        │  recorded_not_sent   (D-17)  │
                                             │                        └───────────┬──────────────────┘
                                             │                                    │ GET /workflow-runs/{id}
                                             │                                    │ (status: str — untyped wire)
                                             ▼                                    ▼
    ┌──────────────────────────── CLIENT · one derivation, two vocabularies ───────────────────┐
    │  lib/phaseState.ts   DB_PHASE_STATUS ──▶ Phase["status"] ──▶ canvasReading() ──▶ 8 readings│
    │        │                                                                                   │
    │        ├──▶ panel  · PhaseCard.STATUS_META            → harness words                      │
    │        └──▶ canvas · runVocabulary.RUN_READING_WORD   → "Not sent — recorded"  (D-16)      │
    │                      runVocabulary.STATIC_CLAUSE / RING_GEOMETRY  ⚠ 8th shape owed         │
    │                      NodeRunOverlay.RING_STROKE                                            │
    │                                                                                            │
    │  canvasModel.buildPhaseData ──▶ PhaseNodeData{notConnected} ──▶ PhaseNode.tsx:220          │
    │                                              badges = notConnected ? ["Not connected"] : []│
    │                                              ──▶ PhaseNodeCard (UNCHANGED)                 │
    └────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended structure — every file 189 touches

```
backend/app/
├── models/harness.py                        # +ExternalActionPhaseConfig, +union member, +model_validator
├── services/harness/
│   ├── phase_types.py                       # +_exec_external_action, +1 registry line
│   ├── grounding.py                         # +EXTERNAL_ACTION_CAPABILITIES (beside KB_TOOLS:797)
│   │                                        #  ⚠ + tool_names ∪ capabilities at :388 (Conflict 2)
│   └── publish_service.py                   # ⚠ the Conflict-1 golden-run resolution
├── services/harness_engine.py               # +the third branch at :1605  (D-05)
├── services/workflow_authoring.py           # "6 phase types" → 7, +1 bullet
├── db/workflows.py                          # +record_phase_not_sent (copy complete_phase:975)
└── api/workflow_runs.py                     # description string only

supabase/
├── migrations/115_workflow_phases_recorded_not_sent.sql   # NEW — authored here, applied by the operator
└── full-schema.sql                                        # REGENERATED, never hand-edited

frontend/src/
├── types/index.ts                           # +Phase["status"] member
├── lib/
│   ├── phaseState.ts                        # +DB_PHASE_STATUS key, +CanvasReading member, +switch arm
│   └── phaseGlyph.tsx                       # +1 import +1 map entry  ⚠ SAME COMMIT as soulData
└── components/
    ├── panel/PhaseCard.tsx                  # +STATUS_META row  (FORCED)
    ├── panel/PhaseTimeline.tsx              # +milestoneFor arm  (silent)
    └── workflows/
        ├── definitionOps.ts                 # +PhaseTypeId, +ORDER, +SLUG_BASE (FORCED), +switch (FORCED)
        ├── phaseVocabulary.ts               # +3 map entries, +derivedFace tier, +notConnectedOf
        ├── soulData.ts                      # +PHASE_GLYPHS entry  ⚠ SAME COMMIT as phaseGlyph
        ├── nodePresentation.ts              # +ICON_TINT entry
        ├── runVocabulary.ts                 # +WORD (D-16) +CLAUSE +RING_GEOMETRY  (all 3 FORCED)
        ├── NodeRunOverlay.tsx               # +RING_STROKE entry  (FORCED)
        ├── canvasModel.ts                   # +PhaseNodeData.notConnected; ⚠ fix the :201 prose
        ├── PhaseNode.tsx                    # +the badge, the :220 tuple  (D-12/D-18)
        ├── GovernanceSection.tsx            # arming switch on + non-interactive for the type
        ├── PhaseFormPanel.tsx               # ONE gated line (G-5: honour 185's shape)
        └── ExternalActionSection.tsx        # NEW — the capability picker, its own file
```

*(`PhaseNodeCard.tsx` and the five fenced sibling modules are **NOT** in this list. That is the point of §C11.)*

### Pattern 1 — Additive discriminated-union growth

**What:** append a member; never rename an existing one; never touch the discriminator or `extra="forbid"`.
**When:** every new phase type. 5→6 happened at 101.1 the same way.
**Source:** `backend/app/models/harness.py:10-22` (verbatim):

> *"The two Literal sets GROW ADDITIVELY, and always have… Growth is SAFE because every value a stored JSONB row can already carry still validates: an old row never names the new member… What must NOT change is an EXISTING member's spelling — renaming one orphans every stored row that uses it — nor the mechanism around them: the discriminator, `extra='forbid'` and the union structure remain LOCKED."*

### Pattern 2 — Closed registry, never dynamic resolution

**What:** a name is looked up in a closed dict; absence RAISES.
**Source:** `backend/app/services/harness/phase_types.py:441-446`:

```python
    fn = PROGRAMMATIC_PHASE_REGISTRY.get(fn_name)
    if fn is None:
        raise KeyError(
            f"programmatic phase {phase.slug!r}: fn {fn_name!r} is not registered "
            f"in PROGRAMMATIC_PHASE_REGISTRY (closed dict — register it explicitly)"
        )
```

### Pattern 3 — The executor signals a non-`completed` terminal via an output key

**What:** the executor returns a normal dict with a sentinel key; the engine branches on it to pick the status write. **This is D-05's mechanism, already shipped for emit failures.**
**Source:** `backend/app/services/harness_engine.py:1613-1622` (quoted in §A3).

### Pattern 4 — One derivation, two vocabularies

**What:** state derivation lives in ONE module; each surface keeps its own words.
**Source:** `frontend/src/lib/phaseState.ts:12-20`. **The acceptance for Req 8 was a grep proving zero local re-derivations, fenced by `phaseState.test.ts`. 189 must not add a second copy of the status rule.**

### Pattern 5 — The exhaustive `Record` as a compiler-enforced reminder

**What:** declare a per-state table as `Record<Union, T>` with no `default:` arm, so a widened union becomes a typecheck error rather than a silent gap.
**Source:** `frontend/src/components/workflows/runVocabulary.ts:161-166`:

> *"Declared as an exhaustive `Record<CanvasReading, …>` rather than as a switch with a `default:` arm, and that is deliberate: an eighth reading added to `CanvasReading` later becomes a TYPECHECK ERROR here, where a `default:` would have silently absorbed it… The compiler is the reminder, not a comment."*

**189 is the "later" this sentence was written for.** Four tables fire.

### Pattern 6 — `own<T>()` on every keyed lookup

**What:** never `TABLE[key] ?? fallback` on an object literal — `constructor` / `toString` / `__proto__` are inherited, are never nullish, and the coalesce does not fire.
**Source:** `frontend/src/components/workflows/ownProperty.ts` (86 L, zero imports) and the measurement at `lib/phaseGlyph.tsx:79-93`: *"the observed value for `constructor` was literally `[Function Object]`… A HARD RENDER CRASH of the whole node."*

### Anti-Patterns to Avoid

- **Adding `'Not sent — recorded'` to the CHECK constraint.** D-17 names this exact misreading. The constraint takes the slug.
- **Spreading badge arrays.** `[...a, ...b]` widens `BadgeSlots` to `BadgeSlot[]` and silently retires the max-2 typecheck guard.
- **Editing `GROUNDING_DIAL_TYPES`.** `phaseVocabulary.ts:557` — READ, never edited; a third member changes grounding semantics (D-185-15).
- **Adding a `_TOOL_REGISTRY` entry or a `get_tools()` schema in 189.** Both are 190's, and the second opens the ⚠ Conflict 2 leak.
- **Adding a seventh module to the card subtree.** The `?raw` fence and its `toHaveLength(6)` pin both move; the subtree is already +67 %.
- **Swapping `soulData.PHASE_GLYPHS` without `lib/phaseGlyph.tsx`.** `phaseGlyph.tsx:34` calls this *"a silent split-brain"*.
- **Treating `canvasModel.ts:201`'s ghost-edge prose as a 189 requirement.** ⚠ Conflict 3.
- **Reading `failed 0` from the count gate as "no regression".** `D-188.2-DEF-01`.
- **Reusing `_exec_llm_human_input`'s substrate for the checkpoint.** It returns normally on timeout (L2). The armed path already fails closed.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| A human approval pause | A new gate / new wait loop | `action_risk_armed` + `action_risk_approval` + `_resolve_failure_with_ask_user` (`harness_engine.py:754-800`) | Shipped in 185 with DELTA 1-4 (indefinite wait · shutdown-safe · unparseable-payload-refusal). 189 arms an existing gate; it builds no checkpoint. |
| A per-phase tool guard | A parallel whitelist | `ctx.phase_whitelist` → `dispatch_tool:4141` | Already server-authoritative + re-read at run time (D-08 of 184). D-03 rejects a second path by name. |
| A status write | Inline SQL in the engine | a 5th function in `db/workflows.py` beside the four | The status flip and the output write are **one atomic statement** — the resumability invariant (HARNESS-03). |
| A run-state derivation | A local status→word mapping | `lib/phaseState.canvasReading` + `runVocabulary` | D-188-02 — one derivation, two vocabularies, fenced by a grep test. |
| A keyed-lookup guard | `?? fallback` | `own<T>()` from `ownProperty.ts` | Measured RED five times; one import, zero deps. |
| An audit receipt for the recorded intent | A new `harness_audit` event type | *(nothing — D-09 declines it)* | A new kind means a CHECK migration **plus** the Python literal set, and `action_risk_pending` already records that a human was asked and approved. |
| A glyph | Hand-drawn SVG or a per-surface mark | one `soulData.PHASE_GLYPHS` entry + one `phaseGlyph.tsx` import, same commit | `icon-convention.md` §4: *"an icon for the same concept is byte-identical everywhere."* |
| A capability option list on the client | A frontend constant | server data | `PhaseFormPanel.tsx:483`: *"THE OPTION SET IS THE SERVER'S… There is no frontend [source]."* |

**Key insight:** 189's entire governance stack already exists. The phase's real work is (a) resolving two publish-gauntlet conflicts the locked decisions create, (b) threading one new enum value through 27 enumeration sites, and (c) one honest new word. Anything a plan proposes to *build* in the governance space is a signal that a shipped mechanism was missed.

---

## Common Pitfalls

### Pitfall 1 — The sixteen silent `toHaveLength(6)` pins
**What goes wrong:** the 7th type lands, the two forced sites are fixed, and ~16 assertions across 5 suites go RED at once — looking like a broken feature rather than a bookkeeping debt.
**Why:** the count gate pins test COUNTS, not assertions. Nothing warns.
**Avoid:** treat §D15's table as a checklist; change the pins in the SAME commit as the 7th type.
**Warning sign:** a green `tsc` and a red vitest.

### Pitfall 2 — Spending badge slot 1 in the wrong tuple position
**What goes wrong:** the "Not connected" badge renders where "Waits for you" belongs, or a spread erases the max-2 type guard.
**Avoid:** `PhaseNode.tsx:220` with explicit branches, never a spread; keep the `@ts-expect-error` third-badge control and observe it RED.

### Pitfall 3 — The migration lands without its regeneration
**What goes wrong:** `supabase/full-schema.sql` disagrees with the live DB; the next greenfield deploy rejects the new status.
**Avoid:** apply → `bash scripts/regenerate-full-schema.sh` (no reset) → commit both, one task. **Never `db push` / `db reset`.**
**Warning sign:** `grep -n workflow_phases_status_check supabase/full-schema.sql` still shows five values after the apply.

### Pitfall 4 — Assuming an armed checkpoint blocks publish the way `llm_human_input` does
**What goes wrong:** the plan trusts stage 2.5 to catch it; the golden run hangs 2 hours in CI or UAT.
**Why:** D-187-01 hoisted arming out of `phase.validators`, and stage 2.5 only knows about validators and `llm_human_input`.
**Avoid:** ⚠ Conflict 1. **Drive one real publish of an `external_action` workflow before believing D-06.**

### Pitfall 5 — Registering the capabilities where the author can see them
**What goes wrong:** the three names land in `get_tools()`, appear in `GroundingBundle.tools`, and become choosable in the `llm_agent` whitelist rail — an unarmed step can now name `send_email`.
**Avoid:** ⚠ Conflict 2 — a separate constant unioned into `tool_names` only.
**Warning sign:** the capability appears in `ToolWhitelistRail`'s options for a non-`external_action` step.

### Pitfall 6 — The 7th glyph exists but disappears
**What goes wrong:** the slug resolves, the build passes, and the mark is invisible on Deep Midnight — exactly `llm_batch_agents` before 184-01.
**Avoid:** U1 — a driven luminance comparison against the other six.

### Pitfall 7 — An 8th ring shape that is not distinguishable in greyscale
**What goes wrong:** `RING_GEOMETRY` gains a row, the compiler is satisfied, and the new reading is indistinguishable from `skipped` or `unknown` with colour off — silently voiding a shipped BUILD CRITERION.
**Avoid:** U3, driven, with the falsification (a control that should NOT match).

### Pitfall 8 — Reading `canvasModel.ts:201` as a requirement
**What goes wrong:** the plan budgets work to make the ghost-detour edge reachable, which D-04 forbids.
**Avoid:** ⚠ Conflict 3 — correct the prose, build nothing.

### Pitfall 9 — The doc and the D-entry restating each other
**What goes wrong:** SC#3 ships two copies of one verdict; the register bloats or the doc's reasoning is lost.
**Avoid:** D-10 — copy `D-v3.4-01`'s pointer shape (`:1400`), not `D-PRD-15`'s full-ADR shape.

---

## Code Examples

### The additive union member (the shape D-01 follows)

```python
# Source: backend/app/models/harness.py:162-172 (verified 2026-08-07)
PhaseConfig = Annotated[
    Union[
        ProgrammaticPhaseConfig,
        LlmSinglePhaseConfig,
        LlmAgentPhaseConfig,
        LlmBatchAgentsPhaseConfig,
        LlmHumanInputPhaseConfig,
        LlmEmitPhaseConfig,
    ],
    Field(discriminator="phase_type"),
]
```

### The closed-registry raise (the shape D-02 follows)

```python
# Source: backend/app/services/harness/phase_types.py:441-446
    fn = PROGRAMMATIC_PHASE_REGISTRY.get(fn_name)
    if fn is None:
        raise KeyError(
            f"programmatic phase {phase.slug!r}: fn {fn_name!r} is not registered "
            f"in PROGRAMMATIC_PHASE_REGISTRY (closed dict — register it explicitly)"
        )
```

### The D-05 seam (the branch 189 extends)

```python
# Source: backend/app/services/harness_engine.py:1605-1631
        output = outcome.output
        durable_output = _persist_output(output)
        _emit_failure = output.get("failure") if isinstance(output, dict) else None
        if _emit_failure:
            await fail_phase(pool, phase_id, str(_emit_failure), output=durable_output)
        else:
            await complete_phase(pool, phase_id, durable_output)
        accumulated_outputs[phase.slug] = output
        # …
        next_phase_id = ordered[i + 1]["id"] if i + 1 < len(ordered) else None
        await advance_current_phase(pool, run_id, next_phase_id)   # ← the run CONTINUES
```

### The atomic status write (the shape the 5th function copies)

```python
# Source: backend/app/db/workflows.py:975-983
async def complete_phase(pool: asyncpg.Pool, phase_id: UUID, output: dict) -> None:
    await pool.execute(
        "UPDATE workflow_phases SET status='completed', output=$2::jsonb, updated_at=now() WHERE id = $1",
        phase_id,
        json.dumps(output),
    )
```

### The badge tuple (the one line D-12/D-18 change)

```tsx
// Source: frontend/src/components/workflows/PhaseNode.tsx:214-220
  const waitsForYou: BadgeSlot = {
    testId: "canvas-waits-for-you",
    tone: "primary",
    label: "Waits for you",
    dataAttr: { "data-waits-for-you": "true" },
  }
  const badges: BadgeSlots = data.waitsForYou ? [waitsForYou] : []
```

### The total, own-guarded status derivation (the file the 6th slug joins)

```ts
// Source: frontend/src/lib/phaseState.ts:41-79
export const DB_PHASE_STATUS: Record<string, Phase["status"]> = {
  pending: "pending", active: "running", completed: "done", failed: "failed", skipped: "skipped",
}
export function phaseStatusFromDb(raw: string): Phase["status"] {
  if (!Object.prototype.hasOwnProperty.call(DB_PHASE_STATUS, raw)) return "unknown"
  return DB_PHASE_STATUS[raw]
}
```

### The type-gated derived-face tier (the shape D-13 fills)

```ts
// Source: frontend/src/components/workflows/phaseVocabulary.ts:530-580
export function derivedFace(inputs: DerivedFaceInputs): string | null {
  // (1) BOUND SKILL — most-specific-first (D-187-04).
  if (inputs.skillName) return `Run the ${inputs.skillName}`
  // (2) TEMPLATE — gated on `llm_emit`, deliberately.
  if (inputs.phaseType === EMIT_PHASE_TYPE && inputs.templateFilename) return `Fill ${inputs.templateFilename}`
  // (3) FOLDER SCOPE — GATED on GROUNDING_DIAL_TYPES.
  if (inputs.folderName && GROUNDING_DIAL_TYPES.includes(inputs.phaseType)) return `Search ${inputs.folderName}`
  // (4) HUMAN INPUT — the type alone says what happens.
  if (inputs.phaseType === HUMAN_INPUT_PHASE_TYPE) return "Wait for your approval"
  // (5) otherwise NULL — the honest floor. Never fabricate.
  return null
}
```

### The 114 migration's ALTER shape (what 115 mirrors)

```sql
-- Source: supabase/migrations/114_harness_audit_action_risk_pending.sql (tail)
ALTER TABLE public.harness_audit DROP CONSTRAINT harness_audit_event_type_check;
ALTER TABLE public.harness_audit ADD CONSTRAINT harness_audit_event_type_check CHECK (
    event_type IN ( … , 'action_risk_pending' )
);
```

---

## State of the Art

| Old approach | Current approach | When changed | Impact on 189 |
|---|---|---|---|
| The armed checkpoint as a synthesized `timing="pre"` ValidatorSpec appended to `phase.validators` | **Hoisted** — `harness_engine.py:754` reads `phase.action_risk_armed` directly | Phase 187 / D-187-01 | ✅ D-04 is a boolean read, not a list append — **and this is exactly why stage 2.5 misses it** (⚠ Conflict 1) |
| The ask_user wait expiring and reading as consent | `timeout_seconds = None` — an indefinite, shutdown-safe wait | Phase 185 / D-185, DELTA 2-4 | ✅ 189 inherits fail-closed; L2's landmine does **not** apply to the armed path |
| An unrecognised `workflow_phases.status` resolving to `done` | `phaseStatusFromDb` → `"unknown"` → *"State unknown"* | Phase 188 Plan 02 / D-188-08 | ✅ D-07's instrument; the migration can land before the vocabulary and never lie |
| The status derivation living in `StreamsProvider` + `PhaseTimeline` | `lib/phaseState.ts` — one derivation, two vocabularies | Phase 188 Plan 05 / D-188-02 | ✅ one file to widen, fenced by a grep test |
| The grounding word-badge in slot 1 | Deleted; governance is the top-right seal, spending no colour and no badge | Phase 185 / SPEC Req 6 | ✅ slot 1 is free — this phase's whole D-12 premise |
| The card as one 797-line component | A six-file subtree with a 214-line types-only contract | Phase 188.2 | ✅ 189 adds a field to a small contract, not a change to a large component |
| `PhaseNodeCard.tsx` G-5 firing | satisfied (188.2) | 2026-08-07 | ✅ G-5 does not fire |

**Deprecated / superseded:**
- The `<canonical_refs>` claim that `PHASE_GLYPHS` lives in `phaseVocabulary.ts` — corrected by CONTEXT itself; the true home is `soulData.ts:43`. ✅ re-confirmed.
- `icon-convention.md` `:NNN` pointers generally — 188.2 corrected four of them, three already wrong before it moved anything. **Treat any remaining `:NNN` there as needing re-derivation.** (`NodeCornerMarks.tsx:266` and `PlaneEditingLayer.tsx:186/:234` are the current, re-measured ones.)
- `.planning/ROADMAP.md`'s *"live head = 113; next free slot = 114"* — stale; head is **114**.
- `canvasModel.ts:201-203`'s claim about Phase 189's edge state — falsified by D-04.
- `grounding.py:446-447`'s *"`tools == sorted(tool_names)` by construction"* — will become false if ⚠ Conflict 2 is resolved as recommended.

---

## Sequencing and Wave Shape

### Hard same-commit constraints (each one has a source that says so)

| # | Constraint | Source |
|---|---|---|
| S1 | `soulData.PHASE_GLYPHS` **+** `lib/phaseGlyph.tsx` | `phaseGlyph.tsx:34` — *"swapping one alone leaves phaseGlyph() returning the old component… a silent split-brain"* |
| S2 | A test-count change **+** its `BASELINE` pin | `vitest-count-gate.cjs:28-40` — *"a deletion that lands without its pin edit leaves HEAD red; a pin edit without the deletion leaves the gate blind"* |
| S3 | A new test file **+** its `TARGETS` entry | `vitest-count-gate.cjs:567` — earlier ⇒ **exit 2 ERROR**, later ⇒ never executed |
| S4 | Migration apply **+** `regenerate-full-schema.sh` **+** commit both | `CLAUDE.md` + the 114 header |
| S5 | A new file in the card subtree **+** `CARD_SUBTREE_PATHS` **+** its `:545` pin | `PhaseNodeCard.test.tsx:253-259` — *"the other FIFTEEN would stay green while covering nothing at all"*. **189 should not need this.** |
| S6 | The `Dockerfile.sandbox` ↔ `docs/SANDBOX-PACKAGES.md` and deploy-artifact same-commit rules | `CLAUDE.md` — **expected no-op for 189**; `scripts/check-deploy-drift.sh` runs regardless |

### Recommended waves

**Wave 0 — Baselines and falsifications (test-only, no source change).**
Pin `tsc = 33`, count gate `2508 / 45 / 0 failing`, backend `166 passed / 2 failed (named)`. Author the two Wave-0 backend suites and the migration-115 CHECK test. **Write the ⚠ Conflict 1 and ⚠ Conflict 2 publish tests and OBSERVE THEM RED** — they are the phase's headline gates and they fail today.
*Parallelisable within the wave.*

**Wave 1 — The two publish-gauntlet conflicts (backend only). STRICTLY FIRST.**
Resolve Conflict 2 (`EXTERNAL_ACTION_CAPABILITIES` + the `tool_names` union + the `grounding.py:446-447` prose correction) and Conflict 1 (the golden-run arming path). *Why first: if either is unresolvable as designed, the phase's shape changes, and every downstream wave would be wasted.* The Wave-0 tests go GREEN here.
*The two are independent of each other and may run in parallel.*

**Wave 2 — The 7th type, backend (depends on nothing but Wave 0).**
`ExternalActionPhaseConfig` + union member + the D-04 `model_validator` + `_exec_external_action` + the registry line + the `workflow_authoring` prompt. **Genuinely parallel with Wave 1**, if the plan is comfortable with two agents in `harness.py`/`grounding.py`; otherwise sequence.

**Wave 3 — Migration 115 (⚠ contains a `checkpoint:human`).**
Author the file (autonomous) → **operator pastes into the Supabase SQL editor** → regenerate → commit both → the `record_phase_not_sent` write + the D-05 third branch at `:1605`. **S4 binds.** The authoring half is parallel with Waves 1-2; the apply and everything after it is strictly serial.

**Wave 4 — The status vocabulary, client (depends on Wave 3's slug existing; NOT on it being applied).**
`types/index.ts` → `phaseState.ts` (map + union + switch) → the four forced `Record<CanvasReading,…>` tables + `STATUS_META` + `milestoneFor`. ⚠ **`RING_GEOMETRY`'s 8th shape is a design decision, not a table fill** — give it its own task with U3 attached.
*Strictly ordered internally (the union widening is what forces the tables).*

**Wave 5 — The 7th type, client (depends on Wave 2 for the type NAME only).**
Three sub-tracks, genuinely parallel:
 · **5a** `definitionOps.ts` (union + ORDER + SLUG_BASE + switch) **+ the 16 count-6 pins** — S2 binds
 · **5b** `soulData.ts` + `lib/phaseGlyph.tsx` **in ONE commit** — S1 binds — + `nodePresentation.ICON_TINT`
 · **5c** `phaseVocabulary.ts` (3 maps + the `derivedFace` tier + `notConnectedOf`) + `PhaseFormPanel` gated line + the new `ExternalActionSection.tsx` + `GovernanceSection` refusal

**Wave 6 — The badge (depends on 5c for `notConnectedOf`).**
`canvasModel.PhaseNodeData.notConnected` → `PhaseNode.tsx:220` → **rewrite** both slot-1 guards (`PhaseNodeCard.test.tsx:2156`, `WorkflowCanvas.test.tsx:423`) with positive controls → verify the `@ts-expect-error` third-badge control still swings.

**Wave 7 — SC#3, the recorded decision. Fully independent — parallelisable with ANY wave from 0 onward.**
`docs/CONNECTOR-ARCHITECTURE.md` + `D-v3.6-01` in `DECISIONS.md` (pointer shape) + the `CLAUDE.md` pointer line + the `## Cross-references` bullet.

**Wave 8 — Close: prose corrections + UAT.**
Fix `canvasModel.ts:201-203` (Conflict 3), the ROADMAP migrations bullet (113→114), `definitionOps.ts:383`'s *"Never fewer than six"*, `workflow_authoring.py:62`'s *"6 phase types"*. Then drive U1-U4 and the owed **U5 (`D-188.2-DEF-07`, row A2) on the first live D-06 run** — plus U6 (row A1's visual half) while the Builder is open.

### Genuinely parallel vs strictly ordered — summary

| Independent (may run concurrently) | Strictly ordered |
|---|---|
| Wave 7 (docs) vs everything | Wave 0 → Wave 1 (the tests must be RED first) |
| Conflict 1 vs Conflict 2 within Wave 1 | Wave 3's apply → Wave 3's write function → Wave 4 |
| 5a / 5b / 5c within Wave 5 | Wave 2 (type name) → Wave 5 |
| Migration *authoring* vs Waves 1-2 | Wave 5c (`notConnectedOf`) → Wave 6 |
| Wave 4 vs Wave 5 (different files entirely) | Wave 1 → everything (it can change the phase's shape) |

---

## Security Domain

> `security_enforcement` is absent from `.planning/config.json` ⇒ enabled. ROADMAP line 52 records **"no threat model"** for 189 *because there is no egress* — the threat model lands **with Phase 190** (ROADMAP line 678). This section is therefore the applicable-controls map, not a threat model.

### Applicable ASVS Categories

| Category | Applies | Standard control |
|---|---|---|
| **V2 Authentication** | no | 189 adds no auth surface; existing Supabase JWT unchanged |
| **V3 Session Management** | no | no session state added |
| **V4 Access Control** | **yes** | Definition reads/writes stay behind the shipped org-scoped RLS + owner checks (v3.4). 189 adds **no route.** The publish path's `_resolve_publish_supabase` refuses to construct an org-less service-role client — unchanged. |
| **V5 Input Validation** | **yes** | **Pydantic `_StrictBase` with `extra="forbid"`** is the control, and it is the codebase's own answer (`harness.py:5-8`: *"the FIRST strict-parse model in the codebase… a typo'd or injected key raises `ValidationError` BEFORE the engine consumes it (threat T-090-01 / V5)"*). The capability is a `Literal` of three, not a free string. |
| **V6 Cryptography** | no | no secrets, no credentials — **that is CONN-03 / Phase 190's** (`SECRETS_ENCRYPTION_KEY`, org-scoped Fernet `enc:v1:`) |
| **V12 Files/Resources** | no | no file I/O |
| **V13 API / SSRF** | **no — BY CONSTRUCTION, and this is SC#4's whole content** | 189 makes **no outbound request**. `grep -rni "\bmcp\b" backend/app` = **0**. The SSRF / egress allow-list requirement is CONN-03, explicitly Phase 190. |

### Known threat patterns for this stack

| Pattern | STRIDE | Standard mitigation | 189 status |
|---|---|---|---|
| Prototype pollution via a keyed lookup (`__proto__`, `constructor`) | Tampering | `own<T>()` / `Object.prototype.hasOwnProperty.call` | ✅ available (`ownProperty.ts`); ⚠ **owed** on `canvasModel.ts`'s `PHASE_TYPE_SUBTITLES[phaseType] ?? ""` while the 7th key is added |
| Unknown-value fail-OPEN (an unrecognised state read as success) | Spoofing | Total functions with an honest catch-all; never `?? "done"` | ✅ already fixed by 188 (`phaseStatusFromDb`); 189 must not regress it |
| Injected/typo'd config key in author-supplied JSONB | Tampering | `extra="forbid"` on every config model | ✅ inherited |
| **Governance bypass — whitelisting an external capability on an UNARMED step** | **Elevation of Privilege** | Keep the capabilities OUT of `GroundingBundle.tools`; pin `action_risk_armed` at the model layer | ⚠ **NET-NEW, introduced by this phase.** See ⚠ Conflict 2. **The single most important security property 189 owes.** |
| Governance bypass — disarming via a direct JSONB edit or a stale client | Elevation of Privilege | The `PhaseSpec` `model_validator` coercion (§A4) — catches all six write paths | ⚠ **owed** |
| A hallucinated tool name reaching a handler | Elevation of Privilege | `ctx.phase_whitelist` at `dispatch_tool:4141` + `tool_refused` audit | ✅ inherited |
| An approval receipt written when no human approved | Repudiation | `consequence ≠ receipt`; the 185 ledger rule | ⚠ relevant to ⚠ Conflict 1 **Option C, which is rejected for exactly this reason** |

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `outbox-tray` is the right 7th glyph *semantically* (its PRESENCE is `[VERIFIED: installed icons.json]`; its suitability is a judgement) | Standard Stack | Low — swap the slug; U1 is the check that catches a bad one |
| A2 | ⚠ Conflict 1 **Option A** (thread `is_golden_run` into ctx) is the right resolution | ⚠ CONFLICTS | **HIGH** — it is the only option that satisfies D-04, D-05 and D-06 simultaneously, but it is a **new decision the plan makes**, and it touches the engine. **Surface it to the operator at plan time.** |
| A3 | ⚠ Conflict 2's fix should be a new constant unioned into `tool_names` rather than a rule-2 exemption | ⚠ CONFLICTS | Medium — the alternative (exempting `external_action` from rule 2) is simpler but puts a type special-case inside a shared governance rule |
| A4 | A `model_validator` that **coerces** (not raises) is the right D-04 shape | §A4 | Medium — raising is stricter but can brick a stored row; coercion is fail-closed and non-destructive |
| A5 | `available_tools == [capability]` (a one-element list) is the right D-03 encoding | §A6 | Low — D-03 says "the capability IS an entry"; a one-element list is the minimal reading |
| A6 | The 8th ring shape should be a `fraction` arc with an unused `gapCentre` rather than a third `length` texture | §B9 | Medium — a design call with no sketch behind it (G-2 exempt). U3 is the falsifiable check. |
| A7 | `D-v3.6-01` is the correct new ADR id | §E17 | Low — mechanical from the `:29-32` convention; verify no other v3.6 entry has been added |
| A8 | 189 needs **no** new module in the card subtree | §C11 | Low — traced end-to-end; if a plan finds otherwise, S5 binds |

---

## Open Questions (RESOLVED)

> **All five were closed at plan-phase, 2026-08-07.** Each carries its resolution, the decision id that
> made it, and the plan that implements it. Nothing below is still open — this heading is kept rather
> than deleted so the reasoning that produced each answer stays readable beside the question.


1. **How should the armed checkpoint behave on a publish golden run? (⚠ Conflict 1)**
   - *Known:* it currently waits indefinitely and times the publish out at 7200 s; `is_golden_run` exists as a column but is not threaded into ctx.
   - *Unclear:* whether the operator prefers auto-record-and-continue (Option A) or accepts that an `external_action` workflow is publish-blocked (Option B, which contradicts D-06).
   - *Recommendation:* **surface at plan time as the phase's first decision.** Option A preserves all locked decisions; Option B does not.
   - ✅ **RESOLVED — `D-19`, implemented by plan `189-05`.** Option A was taken: `is_golden_run` is
     threaded onto the stage-3 ctx (a `SimpleNamespace` literal — the threading is four characters of
     signature and one `getattr` read) and the armed checkpoint SKIPS THE PAUSE while still running the
     step. Option B was rejected for contradicting D-06 outright; Option C for writing an approval
     receipt no human earned. Plan `189-02` captures the failure RED first, using a SHIPPED phase type,
     which additionally establishes that the 7200 s hang is a PRE-EXISTING defect rather than one 189
     introduces.

2. **Should the three capabilities appear anywhere in `GroundingBundle`? (⚠ Conflict 2)**
   - *Known:* `tools` and `tool_names` are separate `GroundingBundle` fields (`:111-112`) that are equal today by construction, and `tools` binds directly to the author-facing whitelist rail.
   - *Unclear:* whether a future surface needs the capabilities listed to the client at all.
   - *Recommendation:* keep them OUT of `tools` in 189; 190 can add a separate `capabilities` field if the connector UI needs one.
   - ✅ **RESOLVED — `D-20`, implemented by plan `189-04`.** They stay OUT of `GroundingBundle.tools`.
     The union is applied to the FIDELITY membership set only; `tools` — which binds into the
     author-facing whitelist rail — stays narrow. Plan `189-02` Task 3 authors the leak guard BEFORE the
     change that could break it and proves it non-vacuous with an observed plant. A future connector UI
     may add a separate field at 190; it must not widen this one.

3. **Does the `render_template` fidelity hole reproduce?**
   - *Known:* `render_template` is in `_TOOL_REGISTRY` but **not** in `get_tools()`, so a fill phase declaring it in `available_tools` should fail stage 2.6 rule 2.
   - *Unclear:* whether any `llm_emit` workflow has ever published with it declared — the executor resolves the template server-side, so it may never appear in `available_tools` in practice.
   - *Recommendation:* **out of scope for 189**, but the Conflict-2 fix may close it for free. If the plan adds a `HARNESS_ONLY_TOOLS` union rather than an `EXTERNAL_ACTION_CAPABILITIES` one, note the widened blast radius explicitly.
   - ✅ **RESOLVED — out of scope, and closed for free.** Plan `189-04` adds a narrowly-scoped
     `EXTERNAL_ACTION_CAPABILITIES` frozenset, NOT a broader harness-only union, so the blast radius is
     exactly three reviewed names and the `render_template` question is untouched. Plan `189-02` Task 2's
     negative control (a genuinely unknown tool STILL produces the finding) is what keeps the fix a
     WIDENING of rule 2 rather than a weakening of it — which is precisely why the neighbouring hole is
     not reopened here.

4. **Is the capability picker its own component or a `PhaseFormPanel` branch?**
   - *Known:* G-5 fired on `PhaseFormPanel.tsx` at 185 and was honoured by construction — 4 insertions reached the render body; everything else lived in `GovernanceSection.tsx`.
   - *Recommendation:* **own component + one gated line.** The ledger row says *"Keep this shape — the next surface that needs the panel gets its own component and one gated line."* 189 is that next surface.
   - ✅ **RESOLVED — `D-23` / `D-24`, implemented by plan `189-14`.** Its own component
     (`ExternalActionSection.tsx`) plus ONE gated line in the panel, honouring the hot-file ledger row by
     construction. The option-source tension the recommendation did not settle is closed by D-23: a
     CLIENT MIRROR of the backend `Literal`, licensed as a union mirror rather than as an options source
     (the shipped `PhaseTypeId` precedent), with the anti-drift guarantee made MECHANICAL — a
     cross-language test reads the Python `Literal` from raw source and asserts the client tuple matches,
     observed RED against a planted mismatch.

5. **Does `components/panel/PhaseCard.tsx` need a 7th `PHASE_TYPE_LABEL` entry?**
   - *Known:* it has only **5** (no `llm_emit`) and degrades unknown types to `UNKNOWN_PHASE_META` = *"Step"*.
   - *Recommendation:* **decline it, and record the declination** (declining a slot is a decision, `PhaseNode.tsx:231` makes exactly that argument).
   - ✅ **RESOLVED — DECLINED, and the declination is recorded in code by plan `189-08` Task 2.** The
     shipped table already declines `llm_emit` and degrades an unmapped type honestly, so a seventh entry
     would invent a panel vocabulary for a type the panel never gained one for. The declination is
     PINNED by a test on the table's entry count, not merely commented — declining a slot is a decision,
     and an uncommitted decision is indistinguishable from an oversight. ⚠ `STATUS_META` is a DIFFERENT
     table in the same file and is NOT declinable: it is typecheck-forced, and `189-08` fills it. The developer panel already treats an unmapped type honestly.

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Python venv | every backend test/measurement | ✅ | `backend/venv/Scripts/python.exe` | ⚠ **none** — a bare `python -m pytest` fails `ModuleNotFoundError: No module named 'pydantic_settings'` |
| `pytest` | backend suites | ✅ | in venv; 166 passed measured | — |
| `node` / `npx` | vitest, tsc, the count gate | ✅ | count gate ran clean | — |
| `vitest` | frontend suites | ✅ | `npx vitest run` via `scripts/vitest-count-gate.cjs` | — |
| `typescript` | `tsc -p tsconfig.app.json` | ✅ | 33 errors baseline | ⚠ bare `--noEmit` checks ZERO files |
| `@iconify-json/fluent-emoji` | the 7th glyph | ✅ | **1.2.7**, 3174 icons | — (a missing slug fails the build) |
| **Local Supabase (:54322)** | applying migration 115; the CHECK-constraint tests; any live UAT | ⚠ **NOT probed this session** | — | ⚠ **The migration-115 apply is a `checkpoint:human` regardless** — CLAUDE.md forbids `db push`/`db reset`, so the operator drives it |
| Redis (docker-compose.dev) | any live run (D-06 UAT, U5) | ⚠ **NOT probed** | — | required for a live run; no fallback |
| Backend uvicorn | live UAT | ⚠ **operator starts it** — never `run_in_background` | — | none |
| Chrome MCP | U1-U6 | assumed present | — | ⚠ `take_screenshot` times out repeatedly; use `evaluate_script` |

**Missing dependencies with no fallback:** none *identified* — but **Supabase, Redis and the backend were deliberately not probed** (starting the backend is the operator's, per the standing project rule). The plan must include an availability check before the first live-run task.

---

## Sources

### Primary (HIGH confidence — read directly from the working tree, 2026-08-07)

- `backend/app/models/harness.py` (349 L) — the union, `_StrictBase`, `PhaseSpec`, `action_risk_armed`
- `backend/app/services/harness/phase_types.py` (1681 L) — the six executors, the registry, the two-layer tool mechanism
- `backend/app/services/harness_engine.py` — the dispatch seam `:560`, the armed checkpoint `:748-800`, the ask_user deltas `:1095-1215`, **the D-05 seam `:1605-1631`**
- `backend/app/services/harness/publish_service.py` — the 8 stages, `_interactive_phase_failures:500`
- `backend/app/services/harness/grounding.py` — `KB_TOOLS:797`, `tool_names:388`, `_unregistered_tools:643`, `grounding_verdicts:667`
- `backend/app/services/harness/reachability.py` — `lint_workflow:111`
- `backend/app/services/harness/validator_kinds.py:714-744` — `action_risk_approval`
- `backend/app/services/tool_dispatcher.py` — `_TOOL_REGISTRY:4009`, `dispatch_tool:4134`
- `backend/app/services/openai_service.py:1116` — `get_tools()`
- `backend/app/services/ask_user_service.py:160` — `subscribe_for_response`
- `backend/app/db/workflows.py` — the four status writes `:958-1014`, the audit literal set `:99-136`
- `backend/app/api/runs.py:671` · `backend/app/api/workflow_runs.py:77-113`
- `backend/app/config.py:1184` — `harness_publish_max_seconds`
- `supabase/migrations/114_harness_audit_action_risk_pending.sql` (verbatim) · `supabase/full-schema.sql:1932`
- `frontend/src/lib/phaseState.ts` (169 L, read whole) · `frontend/src/lib/phaseGlyph.tsx` (94 L)
- `frontend/src/components/workflows/`: `definitionOps.ts` (974) · `phaseVocabulary.ts` (641) · `runVocabulary.ts` (401) · `canvasModel.ts` (586) · `PhaseNode.tsx` (360) · `PhaseNodeCard.tsx` (274) · `phaseNodeCardContract.ts` (214) · `NodeRunOverlay.tsx` (319) · `NodeCornerMarks.tsx` (272) · `NodeIconWell.tsx` (167) · `ownProperty.ts` (86) · `soulData.ts` (156) · `nodePresentation.ts` (219) · `PhaseFormPanel.tsx` (1095) · `FlowEdge.tsx`
- `frontend/src/components/panel/PhaseCard.tsx` · `PhaseTimeline.tsx` · `frontend/src/types/index.ts:1010-1030` · `frontend/src/App.tsx:96-131`
- `scripts/vitest-count-gate.cjs` (the two knobs, the pin history)
- `.planning/ROADMAP.md:44-52, 606-620, 666-680` · `.planning/REQUIREMENTS.md:59, 65-66, 121`
- `.planning/prd-reset/DECISIONS.md` (1424 L; `:1-32`, `:1250-1275`, `:1395-1424`)
- `.planning/seeds/SEED-013-*.md` · `SEED-014-*.md` · `.planning/research/deep-dive/{BEAM,GLEAN,N8N}.md` (listing)
- `.planning/phases/188.2-*/188.2-DEFERRED.md:15, 213, 247`
- `.claude/skills/sketch-findings-agentic-rag/references/icon-convention.md` §4
- `./CLAUDE.md` · `.planning/config.json`

### Measurements executed this session (HIGH — reproducible)

- `node scripts/vitest-count-gate.cjs` → **OK, 45/45, total 2508, failed 0**
- `npx tsc --noEmit -p tsconfig.app.json` → **33 errors**
- `backend/venv/Scripts/python.exe -m pytest <9 files> -q` → **2 failed, 166 passed** (both failures named)
- `wc -l` over the six-file card subtree → **1332**
- `grep -rni "\bmcp\b" backend/app --include=*.py | wc -l` → **0**
- `ls supabase/migrations/ | tail` → head **114**
- `node -e "require('@iconify-json/fluent-emoji/icons.json')"` → **3174 icons**; `outbox-tray` PRESENT, `outbox` ABSENT

### Secondary (MEDIUM)

- The shipped docblocks quoted throughout — treated as HIGH where they state a *mechanism* (verifiable against the code beside them) and MEDIUM where they state a *measurement* (e.g. "0 of 57 phases", "luminance 34.5") that was taken on a corpus this session did not re-query.

### Tertiary (LOW — flagged for validation)

- The assumption that Supabase/Redis/uvicorn are running (not probed — see Environment Availability).
- Any `:NNN` pointer inside `.claude/skills/.../references/*.md` not re-derived here — 188.2 found four stale, three already wrong before it moved anything.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| Backend phase-type extension | **HIGH** | Every site read directly; the union, registry, dispatch and D-05 seam are all quoted verbatim with verified line numbers |
| Migration 115 | **HIGH** | 114 read verbatim; the constraint re-verified at `full-schema.sql:1932`; the exact SQL derived from the live shape (`= ANY (ARRAY[…])`), not from 114's `IN` |
| The status-vocabulary fan-out | **HIGH** | All 11 consumers enumerated; the 6 compiler-forced ones identified by reading the type declarations |
| The canvas surface | **HIGH** | Every CONTEXT anchor re-derived; the badge trace followed end-to-end through three files |
| **⚠ The two publish-gauntlet conflicts** | **HIGH on the DIAGNOSIS, MEDIUM on the FIX** | Each link in both chains is quoted from source. The *resolutions* (Options A / the new constant) are recommendations this session reasoned to, not shipped patterns — recorded as A2/A3 in the Assumptions Log |
| Test baselines | **HIGH** | All three measured this session |
| The 8th ring shape | **LOW** | A design call with no sketch (G-2 exempt) and no shipped precedent; U3 is the falsifiable check |
| SC#3 doc/ADR format | **HIGH** | `D-v3.4-01` read verbatim as the pointer-shape model; `docs/` conventions measured across all five files |

**Pointer audit:** 31 CONTEXT pointers checked → **28 exact · 2 off-by-one (immaterial) · 1 range-anchor**. **2 additional stale claims found in the tree itself**, neither in CONTEXT (`canvasModel.ts:201`, `ROADMAP.md` migrations bullet).

**Research date:** 2026-08-07
**Valid until:** **2026-08-14 (7 days).** Fast-moving: this tree changed under three phases (188, 188.1, 188.2) in the six days before this research, and `BUG-260807-01`'s `/gsd:fast` fix (D-14) is expected to land in `editAffordance.ts` / `providerLogo.tsx` **before** planning begins. Re-derive the count-gate total and the `tsc` error count at plan time — both are pins this research quotes as absolutes.
