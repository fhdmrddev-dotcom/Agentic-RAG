# Phase 264: Born-For Skills Must LOAD, Not Just Resolve - Context

**Gathered:** 2026-09-22
**Status:** Ready for planning
**Source:** ROADMAP Express Path (`.planning/ROADMAP.md` → `#### Phase 264`) + orchestrator measurement, 2026-09-22
**Origin:** `263-REVIEW.md` **CR-01** (routed to a phase, not a gap-closure round — G-7)

<domain>
## Phase Boundary

Phase 263 shipped the Expert-authoring provenance marker (`skills.born_for_expert_bundle_id`,
mig 191) and taught **resolve** time about it. The **load** path never heard of it. So an Expert's
system prompt advertises a born-for skill that the agent then cannot fetch, for every member of the
org except the person who authored it.

**This phase makes an existing promise true.** It does not add a capability; it carries one the
last layer to the user.

**IN scope**
- The born-for disjunct becomes reachable from `load_skill` (and the sibling skill-file reads that
  share the same predicate) when — and only when — an Expert is active on the run.
- The predicate collapses back to **one** home (`app/utils/skill_visibility.py`), both encodings.
- The Expert bundle id is plumbed through the run path (`RunContext` → `ToolContext`) using the
  established additive default-`None` idiom.
- A ledger row for `backend/app/utils/skill_visibility.py`, which has none.

**OUT of scope (fences, ratified in ROADMAP)**
- Cross-org skill sharing — PACK-17's fence stays, and `SEED-125`'s org gate is untouched.
- Anything about what an Expert *does* once a skill loads.
- The skill marketplace.
- Any new UI surface. This is a run-path fix. (**G-4 UI hint: no.**)

</domain>

<measured_state>
## Measured state of the seam (orchestrator, 2026-09-22 — re-derive, do not trust)

| Fact | Where | Measured |
|---|---|---|
| Provenance column | `supabase/migrations/191_skill_expert_provenance.sql` | column + partial index ONLY. **The live `skills` SELECT policy was NOT widened** — born-for is an in-app rule, never an RLS one. |
| Resolve-time arm (works) | `expert_service.filter_visible_skill_names` `:325-355` | 4th disjunct `bundle_id is not None and s_born_for == bundle_id`, inside the org+enabled parenthesis. Reads via **asyncpg**, not PostgREST. |
| The catalog it feeds | `run_producer.py:487-492` | `skill_catalog_override` — names + descriptions only, **no instruction body**. |
| Load-time predicate (blind) | `app/utils/skill_visibility.py` → `build_skill_visibility_or` | `is_system OR (org_id ∈ orgs AND (owner OR is_org_shared))`. No born-for term. |
| Python twin | same module → `skill_row_visible` | same rule, same blindness. Module docstring: *"Change one, change both, in one commit."* |
| The 4 dispatcher call sites | `tool_dispatcher.py:1315, 1459, 1589, 2197` | all through `_resolve_skill_visibility_or(ctx)` `:1291`. `:1315` is `_handle_load_skill` — **the miss branch at `:1326`** lists "loadable" names that exclude the promised one. |
| 2nd consumer | `services/harness/grounding.py:208, 215` | uses BOTH encodings. Workflow grounding — **not** an Expert surface. |
| `ToolContext` | `tool_dispatcher.py:105` | 30+ fields, **no bundle**. |
| `RunContext` | `agent_loop.py:221` | frozen; already carries `skill_catalog_override` / `effective_tools` / `scoped_folder_path` from the Expert resolve at `run_producer.py:430-494`. **This is the carrier.** |
| `ToolContext` build sites | `agent_loop.py:2034`, `agent_loop.py:2906`, `harness/phase_types.py:637`, `task_service.py:585` | four. The additive-field precedent (`phase_whitelist`, `workflow_run_id`, `skill_snapshot`, `skill_instructions_override`, `dead_gap_tokens_in_run`) threads exactly these. |

</measured_state>

<decisions>
## Implementation Decisions (locked)

### D-264-01 — ONE home, by an OPTIONAL parameter (resolves SC#2 and SC#5 together)
The born-for arm moves into `app/utils/skill_visibility.py` as an **optional keyword** on both
encodings: `build_skill_visibility_or(user_id, org_ids, *, expert_bundle_id=None)` and
`skill_row_visible(row, *, caller_id, org_ids, expert_bundle_id=None)`.

- `expert_bundle_id=None` ⇒ the predicate string is **byte-identical to base** (SC#5 — provable by
  string comparison against a frozen literal, not by inspection).
- Only a caller that actually has an active Expert passes it.
- `expert_service.filter_visible_skill_names` then **delegates** to `skill_row_visible` instead of
  hand-rolling the fourth disjunct ⇒ independent encodings of the born-for predicate = **1**.

### D-264-02 — 263's `D-263-06` docstring is RETIRED DELIBERATELY, with its reason rewritten
`expert_service.py:305-320` currently argues *"WHY THIS IS NOT IN `app/utils/skill_visibility.py`,
deliberately"*. That reasoning was correct **when the arm was unconditional**; it is refuted by the
optional-parameter shape, which cannot widen a caller that does not opt in. Rewrite the block to say
what changed and why — **never delete it silently**. Same obligation for
`tests/unit/test_seed125_skill_visibility_filter.py:126-142`, which documents the asymmetry as
deliberate. (`SEED-177` rule; precedent `D-206-07`, Phase 206's no-egress fence.)

### D-264-03 — The bundle rides `RunContext` → `ToolContext`, additive and default-`None`
`run_producer` already resolves the Expert and already builds `RunContext`. Add
`expert_bundle_id: UUID | None = None` to `RunContext` (set where `skill_catalog_override` is set)
and to `ToolContext` (threaded at **both** `agent_loop.py` builds). `None` on every unwired caller
⇒ literal no-op. This is the exact idiom `skill_instructions_override` and `phase_whitelist` use.

### D-264-04 — Per-call-site decision, not a blanket change (the ROADMAP demands one each)
| Site | Decision |
|---|---|
| `tool_dispatcher.py:1315` `_handle_load_skill` | **WIDEN** — this is the defect. Both the primary query AND the `:1326` miss-branch "loadable names" listing. |
| `tool_dispatcher.py:1459` sibling `read_skill_file` | **WIDEN** — a born-for skill whose body loads but whose bundled files 404 is the same defect one layer down. |
| `tool_dispatcher.py:1589` | **decide during planning, from the reading** — widen only if it serves the same agent-facing skill fetch; record the reason either way. |
| `tool_dispatcher.py:2197` `execute_code` skill_files | **decide during planning**; same rule. |
| `harness/grounding.py:208/215` | ⛔ **UNCHANGED.** Workflow grounding is not an Expert surface; it passes no bundle and keeps the base predicate. Fence it. |

### D-264-05 — `task_service.py:585` sub-agent context
A sub-agent of an Expert run is inside the same Expert. **Propagate** the bundle onto `sub_ctx`
(mirrors `workflow_run_id`), unless planning finds a measured reason not to — in which case say so.

### D-264-06 — The widening must be NARROW, and driven (SC#4)
Four arms, each driven on the **LOAD** path the way 263 drove them on the resolve path:
`NULL`/absent bundle never matches · a **wrong** bundle never matches · a **different org** never
matches · `None == None` never matches (the `bundle_id is not None` trap, `T-263-02`).

### D-264-07 — Both encodings driven against ONE table of rows (SC#3)
The module's *"change one, change both"* rule becomes **executable**: a single parametrized fixture
table of rows (including born-for cases) drives `skill_row_visible` directly AND is asserted against
what `build_skill_visibility_or`'s predicate would admit. Not two parallel suites that can drift.

### D-264-08 — TDD, RED first
`tdd_mode` is on. Every fence above is driven RED against the pre-fix code (or a planted defect)
before it goes green. A guard nobody has seen fire is not a guard.

### D-264-09 — G-4 lived bar drives UAT
*A second person in the org runs the Expert and gets the same capability the author gets.* Driven
end to end — a real run, a real `load_skill`, the instruction **body** returned — never asserted at
the predicate. `263-UAT.md`'s R-7 passed on five arms and could not see this defect; the UAT rows
here must touch `load_skill` as a non-author org member or they repeat that miss.

### Claude's Discretion
- Whether sites `:1589` / `:2197` widen (D-264-04 requires a recorded reason, not a preference).
- Test file names/placement, fixture shapes, and how the frozen base-predicate literal is pinned.
- Whether the `skill_visibility.py` ledger row lands in its own plan or the first plan touching it.

</decisions>

<canonical_refs>
## Canonical References — downstream agents MUST read these

### The rule and its two encodings
- `backend/app/utils/skill_visibility.py` — the module docstring IS the contract (one copy, two
  encodings, fail-closed, mirrors the live RLS policy).
- `backend/app/services/expert_service.py:290-360` — `filter_visible_skill_names`, the third copy,
  and `D-263-06`'s now-refuted reasoning.
- `supabase/migrations/191_skill_expert_provenance.sql` — what 263 actually shipped to the DB.

### The run path
- `backend/app/services/run_producer.py:387-494` — Expert resolve → `RunContext` inputs.
- `backend/app/services/agent_loop.py:221-275` (RunContext), `:2034`, `:2906` (ToolContext builds).
- `backend/app/services/tool_dispatcher.py:105-190` (ToolContext), `:1291-1340` (resolver +
  `_handle_load_skill` + the miss branch), `:1459`, `:1589`, `:2197`.
- `backend/app/services/task_service.py:585` — sub-agent context.

### Fences that already exist and must not be tripped by surprise
- `backend/tests/unit/test_seed125_skill_visibility_filter.py:126-142` — the asymmetry comment
  (`D-264-02` retires it deliberately).
- `backend/tests/unit/test_263_drafter_output_fits_its_consumers.py` — 263's cross-plan-seam fence;
  the precedent for asserting a RELATIONSHIP rather than a value.

### Guardrails (MANDATORY before planning)
- `docs/HOT-FILE-LEDGER.md` → `backend/app/services/tool_dispatcher.py` (**85 / 35 / 5048**) and
  → `backend/app/services/agent_loop.py` (**48 / 22 / 3441**). **G-5 fires on both.**
  `backend/app/utils/skill_visibility.py` has **no row at all** — it needs one at first touch.
- `CLAUDE.md` § Workflow guardrails — **G-8** (3-5 plans), **G-5**, **G-4**.
- `.planning/seeds/SEED-125*` — the leak this predicate exists to prevent.

</canonical_refs>

<specifics>
## Specific Ideas

- **The byte-identical proof (SC#5) should be a pinned literal** — assert the exact
  `build_skill_visibility_or` output string for a fixed caller/org set, so a future widening of the
  *default* path goes red rather than silent.
- **The count in SC#2 should be MEASURED, not asserted** — a fence that counts independent
  encodings of the born-for predicate in source and pins it at 1.
- **The miss branch at `:1326` is half the user-visible defect.** Widening only the primary query
  leaves an error message that still lists the wrong set of names.

</specifics>

<deferred>
## Deferred Ideas

- Making the born-for arm an **RLS** policy on `public.skills` (mig 191 deliberately did not).
  Re-open trigger: the first non-service-role reader that needs born-for visibility.
- Cross-org Expert skill sharing — PACK-17 fence; out of scope by ROADMAP.

</deferred>

<cross_checks>
## Mandatory cross-checks run at context time

- **Seeds register** (`node scripts/check-seeds-register.cjs --phase 264`): gate **OK**, 310/310
  parsed, 0 duplicate ids. **0 seeds matched** — and the gate says why: the phase declared no
  `files_modified` yet, so `trigger_surfaces` had nothing to match. ⚠ **Re-run the sweep once
  PLAN.md files exist** — this reading is a fact about the phase, not a clean sweep.
- **Reported bugs** (`status: open` ∧ `surface: Agentic-RAG`): 14 open. **None** names skill
  visibility, `load_skill`, or the Expert run path. Nothing to fold.
- **G-7**: not applicable — this is a phase, not a gap-closure round (that is why CR-01 was routed
  here at all).

</cross_checks>

---

*Phase: 264-born-for-skills-must-load-not-just-resolve*
*Context gathered: 2026-09-22 via ROADMAP Express Path + orchestrator measurement*
