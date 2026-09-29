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
~~`expert_bundle_id: UUID | None = None`~~ to `RunContext` (set where `skill_catalog_override` is
set) and to `ToolContext` (threaded at **both** `agent_loop.py` builds). `None` on every unwired
caller ⇒ literal no-op. This is the exact idiom `skill_instructions_override` and `phase_whitelist`
use.

⛔ **AMENDED 2026-09-22 by RESEARCH §2.1 — the field name is REFUTED, and the original is struck
through rather than deleted, because the reason is the finding.**
`backend/tests/unit/test_260_expert_chat_scoping.py:155-176`
(`test_agent_loop_closed_core_ast_invariant`, the PACK-01 Closed-Core Invariant) asserts that **no
`ast.Name` or `ast.Attribute` in `agent_loop.py` contains the substring `"expert"`**. `RunContext`
is *defined in* that file, so the field name IS an `ast.Name` and `ctx.<field>` IS an
`ast.Attribute`. The researcher drove it with a real `ast.parse`: the probe hits on
`expert_bundle_id` and `agent_loop.py` is at **zero hits today**. `test_261_expert_runtime_scoping.py:210`
is a second, narrower fence on `ast.If`.
⭐ **The fence is CORRECT and is NOT retired.** Its rule is precisely what D-264-03 claims to
honour — the Deep loop must not learn the Expert concept. **The field is named
`born_for_bundle_id`** on BOTH dataclasses: it names the mig-191 *column*, not the Expert concept,
so the invariant stays green by construction rather than by exemption.

### D-264-03a — `_resolve_thread_scoping` arity, and why it lands FIRST
RESEARCH §2.3: widening that helper's return tuple touches **2 production sites**
(`run_producer.py:657`, `:825`) and **10 unpack sites inside `tests/unit`** — which is the gate with
zero headroom. All ten are named in RESEARCH. **The arity change plus its ten updates is the FIRST
task of the phase**, so every following wave starts from a green 71.
⚠ There are **three** `RunContext` build sites, not two: `run_producer.py:663`, `run_producer.py:831`
and `eval_runner_service.py:570`. A field added at one of the two producer sites and not the other is
a defect no existing test can see.

### D-264-04 — Per-call-site decision, not a blanket change (the ROADMAP demands one each)
⛔ **AMENDED 2026-09-22 by RESEARCH §2.2 — TWO ROWS WERE SWAPPED. The original table is struck
through below rather than deleted.** `:1459` is `_sibling_filter` inside **`_handle_save_skill`**
(def `:1435`) — the TRIG-03 description-lint corpus, a WRITE handler's helper. `read_skill_file` is
**`:1589`** (def `:1563`). So the row this table locked as WIDEN was the one site that must NOT
widen, and the site it left open was the one it meant to lock.

~~`:1459` sibling `read_skill_file` → WIDEN · `:1589` → decide during planning~~

**The decisive fact, measured** (`tool_dispatcher.py:4585-4609`): `load_skill` and `read_skill_file`
are in `EXPERT_CORE_TOOLS`; `execute_code` is in `EXPERT_DELIVERABLE_TOOLS` (unioned by default);
**`save_skill` is in NEITHER.** Membership in the Expert toolset is what decides each row.

| Site | Handler | Decision |
|---|---|---|
| `tool_dispatcher.py:1315` | `_handle_load_skill` | **WIDEN** — the defect. The `:1347` miss branch reuses the same `_skill_filter` variable, so the "loadable names" listing is fixed **by construction**. |
| `tool_dispatcher.py:1459` | `_handle_save_skill` lint siblings | ⛔ **DO NOT WIDEN** — not advertised to an Expert, produces no user-visible capability (a lint corpus), and is a write handler's helper. Fence it. |
| `tool_dispatcher.py:1589` | `_handle_read_skill_file` | **WIDEN** — `load_skill` returns `files: [...]`, so the model is promised files it then cannot read. Same defect one layer down. |
| `tool_dispatcher.py:2197` | `_handle_execute_code` skill-file injection | **WIDEN** — failure here is a `logger.warning` and a silently skipped file; the sandbox then runs without the helper. |
| `harness/grounding.py:208/215` | workflow grounding | ⛔ **UNCHANGED**, and now VERIFIED unreachable from a chat Expert run: the full caller set of `assemble_grounding_bundle` is `api/workflows.py:1055,:1193`, `publish_service.py:1422`, `workflow_authoring.py:283`. Fence it. |
| `harness/phase_types.py:637`, `eval_runner_service.py:570` | harness / eval ToolContext + RunContext builds | ⛔ **UNCHANGED**, fenced. |

**The resolver carries the decision in its signature.** Use
`_resolve_skill_visibility_or(ctx, *, born_for: bool = False)` so each site's choice is **readable
in source** rather than implied — a future reader must not have to infer which sites opted in.

### D-264-04a — `is_enabled` disagrees across the four paths (RESEARCH §2.4)
`filter_visible_skill_names` requires `s_enabled`; `_handle_load_skill` has
`.eq("is_enabled", True)`; **`_handle_read_skill_file` and `_handle_execute_code` have NO enablement
filter at all.** A bare born-for disjunct at those two sites would admit a **disabled** born-for
skill's files. The widened predicate form must close that without touching the default path — and
the closure is driven, not asserted.

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

### D-264-10 — What the 2026-09-22 research settled, and what it left as an obligation
- **Baseline measured twice, identical:** `71 failed, 5423 passed, 2 xfailed, 2 xpassed` — exactly
  the ceiling, **zero headroom, 0 collection errors**. ⭐ **ZERO of the 71 is in this phase's blast
  radius**, so inherited-vs-new is settled before a line is written: **any red this phase produces
  is NEW.**
- **The PostgREST grammar is proven, not assumed** — both candidate predicate forms returned HTTP
  200 against the live local PostgREST on the real `public.skills`, with **two negative controls at
  400** (unknown column → `42703`; unbalanced paren → `PGRST100`). `postgrest 2.29.0`'s `or_` is a
  pure passthrough, so **`coerce_uid` is the only guard** on every spliced UUID.
- **`SEED-125`'s own fence, `test_seed125_skill_visibility_filter.py:126-142`** — D-264-02's
  obligation is a **docstring rewrite plus a NEW sibling case**, *not* a changed assertion. The
  existing assertion calls the DEFAULT path and **stays green**; what is refuted is its stated
  *reason* (*"the agent loop has no such scope"*), which this phase makes false.
- **`str(None) == str(None)` is `True`.** A `str()`-based comparison re-creates the `T-263-02` trap
  in a new shape. Guard **both** operands.
- ⚠ **`backend/tests/test_eval_runner.py:737` asserts `git diff --quiet backend/app/services/agent_loop.py`.**
  An executor that edits `agent_loop.py` and runs that suite **before committing** sees a FALSE RED.
  Outside `tests/unit`, but named here so nobody triages it as a real defect.
- ⚠ **SC#5's existing pins use `startswith` / `in`, which cannot see an APPENDED term.** The
  byte-identical proof must be an `==` against the frozen literal, or it proves nothing.
- ⚠ **Ledger rows measured STALE** — `tool_dispatcher.py` **87/37/5082** (row says 85/35/5048),
  `agent_loop.py` **51/25/3473** (48/22/3441), `run_producer.py` **9/5/899** (5/3/749),
  `expert_service.py` **7/4/515** (6/4/507). `app/utils/skill_visibility.py` **1/1/83** and has
  ⛔ **NO ROW AT ALL** — `check-hot-file-ledger.cjs` WILL fail `[no-row]` on it once plans exist
  (`backend/app/` is WATCHED; `app/utils/` is not EXEMPT).
- **Out of scope, but attached:** `agent_loop.py:1435` (the Deep skill catalog) is still org-blind —
  `SEED-129`, `status: open`, high. **264 does not need to touch it** (an Expert run takes the
  override branch). ⛔ If any plan edits those lines, SEED-129's trigger attaches and must be routed.

### Claude's Discretion
- ~~Whether sites `:1589` / `:2197` widen~~ — **settled by D-264-04's amendment.**
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
