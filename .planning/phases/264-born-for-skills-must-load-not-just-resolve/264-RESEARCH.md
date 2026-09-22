# Phase 264: Born-For Skills Must LOAD, Not Just Resolve — Research

**Researched:** 2026-09-22
**Domain:** Backend run-path plumbing + one org-gated visibility predicate. No new library, no new
framework, no external API. Every claim below was measured in this repository on 2026-09-22.
**Confidence:** HIGH (everything load-bearing was driven against the real code, the real PostgREST,
or a real pytest run; the two `[ASSUMED]` items are named in §8).

---

<user_constraints>
## User Constraints (from 264-CONTEXT.md)

### Locked Decisions

- **D-264-01** — ONE home, by an OPTIONAL parameter. The born-for arm moves into
  `app/utils/skill_visibility.py` as an optional keyword on both encodings:
  `build_skill_visibility_or(user_id, org_ids, *, expert_bundle_id=None)` and
  `skill_row_visible(row, *, caller_id, org_ids, expert_bundle_id=None)`.
  `expert_bundle_id=None` ⇒ the predicate string is byte-identical to base (SC#5 — provable by
  string comparison against a frozen literal, not by inspection). Only a caller that actually has
  an active Expert passes it. `expert_service.filter_visible_skill_names` then **delegates** to
  `skill_row_visible` instead of hand-rolling the fourth disjunct ⇒ independent encodings of the
  born-for predicate = **1**.
- **D-264-02** — 263's `D-263-06` docstring is RETIRED DELIBERATELY, with its reason rewritten.
  `expert_service.py:305-320` currently argues *"WHY THIS IS NOT IN
  `app/utils/skill_visibility.py`, deliberately"*. That reasoning was correct when the arm was
  unconditional; it is refuted by the optional-parameter shape, which cannot widen a caller that
  does not opt in. Rewrite the block to say what changed and why — never delete it silently. Same
  obligation for `tests/unit/test_seed125_skill_visibility_filter.py:126-142`, which documents the
  asymmetry as deliberate. (`SEED-177` rule; precedent `D-206-07`.)
- **D-264-03** — The bundle rides `RunContext` → `ToolContext`, additive and default-`None`.
  Add `expert_bundle_id: UUID | None = None` to `RunContext` (set where `skill_catalog_override`
  is set) and to `ToolContext` (threaded at **both** `agent_loop.py` builds). `None` on every
  unwired caller ⇒ literal no-op. Exact idiom `skill_instructions_override` / `phase_whitelist` use.
- **D-264-04** — Per-call-site decision, not a blanket change:
  `tool_dispatcher.py:1315` `_handle_load_skill` → **WIDEN** (primary query AND the `:1326`
  miss-branch "loadable names"); `:1459` sibling `read_skill_file` → **WIDEN**;
  `:1589` → decide during planning, from the reading; `:2197` `execute_code` skill_files →
  decide during planning; `harness/grounding.py:208/215` → ⛔ **UNCHANGED**, fence it.
- **D-264-05** — `task_service.py:585` sub-agent context: a sub-agent of an Expert run is inside
  the same Expert. **Propagate** the bundle onto `sub_ctx` (mirrors `workflow_run_id`), unless
  planning finds a measured reason not to — in which case say so.
- **D-264-06** — The widening must be NARROW, and driven (SC#4). Four arms, each driven on the
  **LOAD** path the way 263 drove them on the resolve path: `NULL`/absent bundle never matches ·
  a **wrong** bundle never matches · a **different org** never matches · `None == None` never
  matches (the `bundle_id is not None` trap, `T-263-02`).
- **D-264-07** — Both encodings driven against ONE table of rows (SC#3). A single parametrized
  fixture table of rows (including born-for cases) drives `skill_row_visible` directly AND is
  asserted against what `build_skill_visibility_or`'s predicate would admit. Not two parallel
  suites that can drift.
- **D-264-08** — TDD, RED first. `tdd_mode` is on. Every fence driven RED against the pre-fix code
  (or a planted defect) before it goes green.
- **D-264-09** — G-4 lived bar drives UAT. *A second person in the org runs the Expert and gets the
  same capability the author gets.* Driven end to end — a real run, a real `load_skill`, the
  instruction **body** returned — never asserted at the predicate.

### Claude's Discretion

- Whether sites `:1589` / `:2197` widen (D-264-04 requires a recorded reason, not a preference).
- Test file names/placement, fixture shapes, and how the frozen base-predicate literal is pinned.
- Whether the `skill_visibility.py` ledger row lands in its own plan or the first plan touching it.

### Deferred Ideas (OUT OF SCOPE)

- Making the born-for arm an **RLS** policy on `public.skills` (mig 191 deliberately did not).
  Re-open trigger: the first non-service-role reader that needs born-for visibility.
- Cross-org Expert skill sharing — PACK-17 fence; out of scope by ROADMAP.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **PACK-17** (completion — the run-time half of the same axis) | A skill born for an Expert is loadable by everyone that Expert serves, not only its author. | §3 ordered edit list (the carrier); §4 per-call-site decisions (`load_skill` + `read_skill_file` + `execute_code` are all in `EXPERT_CORE_TOOLS` / `EXPERT_DELIVERABLE_TOOLS`, measured `tool_dispatcher.py:4585-4609`); §5 the exact widened predicate, verified against a live PostgREST; §6 the test surface that must exist because none does today. |

</phase_requirements>

---

## 1. Verdict

**The CONTEXT's approach is sound and should be built essentially as decided** — the optional-keyword
shape (D-264-01), the additive `RunContext` → `ToolContext` carrier (D-264-03), the per-site decision
discipline (D-264-04) and the grounding fence (D-264-04 last row) all survived measurement. The
PostgREST grammar the phase needs is **verified working against a real server** (§5): a third disjunct
nests inside the existing `and(org_id.in.(…),or(…))` without any change to the org fence.

**Four things changed after measuring, and one of them is a blocker for D-264-03 as written.**
(1) **`expert_bundle_id` as a field name in `agent_loop.py` is FORBIDDEN by an existing green fence** —
`test_260_expert_chat_scoping.py::test_agent_loop_closed_core_ast_invariant` fails on any `ast.Name`
or `ast.Attribute` containing `"expert"` in that file. Proven by parsing the probe (§2.1). The field
must be named `born_for_bundle_id` (or similar). (2) **D-264-04's site table has `:1459` and `:1589`
swapped** — `:1459` is `_handle_save_skill`'s lint-sibling read, not `read_skill_file`; `read_skill_file`
is `:1589`. (3) **Widening `_resolve_thread_scoping` to a 5-tuple breaks TEN existing unpack sites in
`tests/unit`** — all inside the baseline gate, which has **zero headroom** at 71 failed (§6). (4) The
born-for arm should carry its own `is_enabled` term, because `read_skill_file` and `execute_code`
**do not filter `is_enabled` at all** and the resolve-time predicate does — otherwise the two
encodings still disagree, which is SC#2/SC#3's whole point.

**Primary recommendation:** name the carrier field `born_for_bundle_id`; give
`_resolve_skill_visibility_or` an explicit `born_for: bool` keyword so each of the four dispatcher
sites states its D-264-04 decision **in source**; widen `:1315`, `:1589`, `:2197`; leave `:1459`
unwidened with its reason written in; and budget one plan's worth of work for the ten mechanical
test-unpack updates plus the two ledger rows.

---

## 2. Refuted / corrected CONTEXT claims

### 2.1 ⛔ REFUTED (blocking) — `expert_bundle_id` cannot be the field name in `agent_loop.py`

**D-264-03 says:** *"Add `expert_bundle_id: UUID | None = None` to `RunContext` … and to
`ToolContext` (threaded at **both** `agent_loop.py` builds)."*

`backend/tests/unit/test_260_expert_chat_scoping.py:155-176` —
`test_agent_loop_closed_core_ast_invariant` (PACK-01 / EXT-01 / D-260-05, the **Closed-Core
Invariant**) parses `agent_loop.py` and asserts, for every node:

```python
if isinstance(node, ast.Name):
    assert "expert" not in node.id.lower()
if isinstance(node, ast.Attribute):
    assert "expert" not in node.attr.lower()
if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
    assert "expert" not in node.name.lower()
```

`RunContext` is **defined in** `agent_loop.py:220`, so the field name is an `ast.Name` in that file,
and the loop reads it as `ctx.<field>` — an `ast.Attribute`. Measured with the real `ast` module
(`backend/venv`):

```
field-name probe hits: [('Name', 'expert_bundle_id')]
attr+kwarg probe hits: [('Attribute', 'expert_bundle_id')]
current agent_loop.py hits: []          # the fence is green today, at zero
```

`test_261_expert_runtime_scoping.py:210-224` (`test_agent_loop_contains_zero_expert_branches`) is a
second, narrower fence on `ast.If` test expressions — it also fires on
`if ctx.expert_bundle_id is not None:`.

**This fence is CORRECT and must NOT be retired.** Its rule is exactly what D-264-03 claims to
honour: *the loop executes purely on data*. The honest fix is the name. **Recommend
`born_for_bundle_id`** on BOTH `RunContext` and `ToolContext` — it names the `skills` column
(`born_for_expert_bundle_id`, mig 191) rather than the Expert concept, so the loop still knows
nothing about Experts. `run_producer.py`, `tool_dispatcher.py` and `task_service.py` carry no such
fence; a single consistent name across all four is still the right call.

> ⚠ One loophole the measurement found and the plan should NOT use: a keyword-argument *name* is an
> `ast.keyword`, not an `ast.Name`, so `ToolContext(expert_bundle_id=_born)` alone passes. Relying on
> that would leave `ctx.expert_bundle_id` unreadable inside the loop and is a trick, not a design.

### 2.2 ⛔ CORRECTED — D-264-04's site table has two rows swapped

| CONTEXT / ROADMAP says | Measured (`tool_dispatcher.py`) |
|---|---|
| `:1459` "sibling `read_skill_file`" → **WIDEN** | `:1459` is `_sibling_filter` inside **`_handle_save_skill`** (def at `:1435`) — the TRIG-03 description-lint sibling read. Not `read_skill_file`. |
| `:1589` "decide during planning" | `:1589` is `_skill_filter` inside **`_handle_read_skill_file`** (def at `:1563`) — this IS the site D-264-04 meant to lock WIDEN. |

Function boundaries, measured:
`_handle_load_skill` `:1314` · `_handle_save_skill` `:1435` · `_decode_skill_file_bytes` `:1510` ·
`_handle_read_skill_file` `:1563` · `_handle_execute_code` `:2040`.

The *intent* of D-264-04 is unchanged and is honoured by §4 below; only the line labels were wrong.

### 2.3 ⚠ CORRECTED — the module docstring's "five call sites" is four

`expert_service.py:309-310` and `skill_visibility.py`'s own reasoning both say *"imported by
`tool_dispatcher` (five call sites)"*. Measured: **four** `_resolve_skill_visibility_or(ctx)` calls
(`:1315`, `:1459`, `:1589`, `:2197`) feeding **six** `.or_(...)` applications (`:1319`, `:1347`,
`:1594`, `:1606`, `:2204`, `:2219`). The ROADMAP's "four call sites" is the correct figure. The prose
in both docstrings should be corrected in the same commit that edits them (D-264-02 already opens
`expert_service.py`'s block).

### 2.4 ⚠ CORRECTED — CONTEXT's line references for the run-path carrier

| CONTEXT says | Measured |
|---|---|
| `run_producer.py:430-494` Expert resolve → RunContext inputs | `_resolve_thread_scoping` is **`:378`–`:502`**; the catalog build is `:487-492` (CONTEXT/ROADMAP correct on that one). |
| `agent_loop.py:221-275` (RunContext) | `@dataclass(frozen=True) class RunContext` — decorator `:219`, `class` `:220`, body to `:270`. |
| `RunContext` build sites | **three**, not one: `run_producer.py:663`, `run_producer.py:831`, `eval_runner_service.py:570`. |
| `run_producer.py ~654-690` and `~830-860` (research brief) | **Confirmed TWO** — `_resolve_thread_scoping` called at `:657` and `:825`; `RunContext(` at `:663` and `:831`. The brief's suspicion is right. |

### 2.5 ✅ HELD — `grounding.py` is not reachable from a chat Expert run (D-264-04 fence is correct)

`_skill_registry` (`grounding.py:155`, both encodings at `:208` / `:215`) is reached only via
`assemble_grounding_bundle`. Its complete caller set, measured:

```
backend/app/api/workflows.py:1055, :1193          # /workflows/validate + /workflows/grounding-bundle
backend/app/services/harness/publish_service.py:1422   # the publish gauntlet
backend/app/services/workflow_authoring.py:283         # NL workflow authoring
```

None is `run_producer`, `agent_loop`, `task_service` or `tool_dispatcher`. **D-264-04's ⛔ UNCHANGED
row is correct and fenceable.** The natural fence is a negative one: `grounding.py` passes no
`expert_bundle_id` / `born_for_bundle_id` keyword and its output string contains no
`born_for_expert_bundle_id` token.

### 2.6 ✅ HELD — no test drives `load_skill` as a non-author org member

The ROADMAP's claim is **verified**. Every test that reaches `_handle_load_skill` either ignores the
predicate or patches it away:

| Test | Why it proves nothing about visibility |
|---|---|
| `tests/unit/test_142_load_skill_flag.py:114-170` | `_PassthroughQuery.__getattr__` makes `select/or_/eq/order` chainable **no-ops**; `.execute()` returns the seeded rows verbatim. `org_members` returns `[]`. |
| `tests/unit/test_260_financial_analyzer_conversation.py:156` | patches `app.services.tool_dispatcher.aexec` with an explicit `side_effect` list — the query object is never executed. |
| `tests/test_load_skill_collision.py:150` · `tests/test_load_skill_override.py:110,124` | same passthrough/sorting fakes; also **outside `tests/unit`** (SEED-165). |
| `tests/integration/test_140_escape_hatch.py:122,139` | outside `tests/unit`. |

The **one** test that drives the real predicate on a real DB is
`tests/integration/test_v3_4_org_isolation.py:967-995`
(`test_load_skill_cross_org_refused_seed125`) — and it drives a **disjoint-org** caller, not a
**same-org non-author** one, which is precisely the case 264 must make pass. It is also outside the
`tests/unit` gate. It is nonetheless the best available template for SC#1 (§6.3).

### 2.7 ⚠ NEW — the born-for arm and `is_enabled` disagree across the two paths

- `expert_service.filter_visible_skill_names:345-352` requires **`s_enabled`** before any of the
  three org-side disjuncts, so a **disabled** born-for skill never reaches the catalog
  (`test_263_expert_born_skill_resolution.py:237` pins this).
- `skill_visibility.py:64-83` deliberately does **not** check `is_enabled` (docstring `:76-78`).
- `_handle_load_skill` adds `.eq("is_enabled", True)` (`:1321`, and `:1349` on the miss branch), so
  it is safe.
- **`_handle_read_skill_file` (`:1592-1597`, `:1602-1608`) and `_handle_execute_code` (`:2201-2223`)
  add NO `is_enabled` filter at all.** Widening them with a bare born-for term therefore admits a
  **disabled** born-for skill's bundled files.

This is a pre-existing asymmetry for the owner/shared arms (not a 264 regression), but 264 is the
commit that can either propagate it or close it. **Recommendation:** make the born-for disjunct
carry its own enablement term (§5.3) — it keeps the default path byte-identical, and it makes the
one-home claim in SC#2 *semantically* true, not just syntactically.

### 2.8 ⚠ NEW — `_resolve_thread_scoping`'s arity is load-bearing for the baseline gate

**TWELVE** call sites unpack the 4-tuple. Two are production, **ten are in `tests/unit`**:

```
backend/app/services/run_producer.py:657, :825                          (production)
backend/tests/unit/test_260_expert_chat_scoping.py:81, :122
backend/tests/unit/test_260_financial_analyzer_conversation.py:352
backend/tests/unit/test_261_expert_authoring_scenarios.py:179, :232, :276
backend/tests/unit/test_261_expert_runtime_scoping.py:59, :113, :158, :197
```

A 5-tuple return raises `ValueError: too many values to unpack` in all ten — the baseline goes
**71 → 81 failed**, breaking a gate with **zero headroom**. All ten must be updated in the same
commit. This is mechanical but it is *not free*, and it is the single biggest reason this phase is
larger than "a predicate edit".

### 2.9 ⚠ NEW — `effective_tools` is a *schema* filter, not a dispatch gate

`agent_loop.py:1679-1685` filters the tool **schema list** the model sees. `dispatch_tool`'s only
refusal backstop is `ctx.phase_whitelist` (`tool_dispatcher.py:5054`), which is `None` on an Expert
chat run. So an Expert run *can* reach a handler outside `EXPERT_CORE_TOOLS ∪ EXPERT_DELIVERABLE_TOOLS`
if the model hallucinates the name. This does not change any §4 recommendation (widening
`save_skill`'s lint corpus buys nothing either way) but it means "unreachable" must be written as
"not advertised", which is the honest word.

### 2.10 ⚠ OBSERVATION (out of scope) — the *promise* side is still org-blind, and it is a known seed

`agent_loop.py:1435` builds the Deep-mode skill catalog with the pre-SEED-125 flat predicate
`.or_(f"user_id.eq.{current_user['id']},is_org_shared.eq.true")` — no `org_id` term, on the
service-role client. This is `SEED-129` (`status: open`, `priority: high`), third bullet of
`needs_confirmation`, and its third re-open trigger reads *"Any future phase touches … the
`agent_loop.py` skill-catalog block — org-gate the read in that same commit rather than planting
another sibling."* **Phase 264 does not need to touch that block** (an Expert run takes the
`skill_catalog_override is not None` branch and never runs the query), so the trigger does not fire
— but if any plan edits those lines for any reason, SEED-129's obligation attaches.

---

## 3. The ordered edit list

Every line number measured 2026-09-22 at `f04d9c406`. **Re-derive before editing** — this repo's own
recurring finding is that a line number written at a phase's open is stale by its close.

### A. `backend/app/utils/skill_visibility.py` — 1 / 1 / 83 · **NO LEDGER ROW**

| # | Line | Edit |
|---|---|---|
| A1 | `:45` | `def build_skill_visibility_or(user_id: str, org_ids: set[str]) -> str:` → add `, *, expert_bundle_id: str \| UUID \| None = None` |
| A2 | `:55-56` | **DO NOT TOUCH the empty-org arm.** `if not org_ids: return "is_system.eq.true"` stays even when a bundle is passed — the born-for arm nests *inside* the org gate, so with no org gate there is no arm. Fail-closed, and it must be pinned (§5.2). |
| A3 | `:58-61` | Append the third disjunct **inside the inner `or(...)`** (§5.3). ⛔ never as a fourth top-level branch. |
| A4 | `:64` | `def skill_row_visible(row: dict, *, caller_id: str, org_ids: set[str]) -> bool:` → add `expert_bundle_id=None` |
| A5 | `:83` | `return str(row.get("user_id")) == str(caller_id) or bool(row.get("is_org_shared"))` → add the guarded born-for term (§5.4, and the `None == None` trap in §8.1) |
| A6 | `:1-38` | Docstring: record the optional-parameter shape, why a non-opting caller cannot be widened, and correct *"five call sites"* → four (§2.3). |
| A7 | — | **Add a ledger row** in `docs/HOT-FILE-LEDGER.md` **and** the CLAUDE.md scan table, same commit (§7). The gate (`check-hot-file-ledger.cjs`) will fail `[no-row]` on this file otherwise — `backend/app/` is WATCHED and `app/utils/` is not in `EXEMPT` (`scripts/check-hot-file-ledger.cjs:51-66`). |

### B. `backend/app/services/expert_service.py` — 7 / 4 / 515 · **G-5 FIRES**

| # | Line | Edit |
|---|---|---|
| B1 | `:308-314` | Rewrite the `⛔ WHY THIS IS NOT IN app/utils/skill_visibility.py, deliberately` block per **D-264-02**. Keep the original sentence visible (struck through / quoted) and say what changed. |
| B2 | `:341-352` | Replace the hand-rolled fourth disjunct with a delegation to `skill_row_visible`, preserving the `is_sys` / `s_enabled` split **exactly**: `if is_sys: add` / `elif s_enabled and skill_row_visible(...): add`. `skill_row_visible`'s own `is_system` branch is unreachable from the `elif`, so semantics are preserved. |
| B3 | `:341-352` | ⚠ **Type coercion at the seam.** `filter_visible_skill_names` reads via **asyncpg** — `org_id`, `user_id`, `born_for_expert_bundle_id` come back as `UUID` objects and `caller_org_id` / `caller_user_id` / `bundle_id` are `UUID`. `skill_row_visible` compares strings (`str(row.get("org_id")) not in org_ids`). Pass `org_ids={str(caller_org_id)}`, `caller_id=str(caller_user_id)`, `expert_bundle_id=str(bundle_id) if bundle_id else None`. |
| B4 | `:303-307` | The `bundle_id is not None` MEASURED-TRAP paragraph (T-263-02) **moves with the arm** — the trap now lives in `skill_visibility.py`. Do not leave the warning behind in a module that no longer implements it. |

⚠ **A behaviour delta to verify, not assume (B2):** today's org gate is `s_org_id == caller_org_id`.
If `caller_org_id` were ever `None` **and** a row's `org_id` were `NULL`, `None == None` is `True`
and today's code admits the row; `skill_row_visible` would return `False` (`"None" not in set()`).
`api/experts.py:81` passes the route's `org_id`, and `resolve_expert_bundle` types it `UUID` — so
this path is believed unreachable, but the delegation is **strictly tighter** on it and the plan
should drive a case rather than reason about it.

### C. `backend/app/services/tool_dispatcher.py` — 87 / 37 / 5082 · **G-5 FIRES**

| # | Line | Edit |
|---|---|---|
| C1 | `:190` (after `has_connection_retrieval`) | `ToolContext` — add `born_for_bundle_id: "UUID \| None" = None` with the standard additive-default-off comment. `ToolContext` is a plain `@dataclass` (not frozen); the last field today is `has_connection_retrieval: bool = False` (`:190`), so appending a defaulted field is safe. |
| C2 | `:1291-1302` | `_resolve_skill_visibility_or(ctx)` → `_resolve_skill_visibility_or(ctx, *, born_for: bool = False)`; when `born_for` is true, pass `expert_bundle_id=getattr(ctx, "born_for_bundle_id", None)`. ⭐ **`getattr`, not `ctx.x`** — the duck-typed-ctx precedent at `:1408` (`getattr(ctx, "skill_instructions_override", None)`) and `:1566` (`getattr(ctx, "skill_snapshot", None)`), because three test suites build `ToolContext`-shaped stubs. ⭐ **The explicit keyword is the point:** it makes each site's D-264-04 decision readable in source instead of implied by the resolver. |
| C3 | `:1315` | `_handle_load_skill` primary → `born_for=True`. **The `:1326` miss branch needs no separate edit** — `:1347` reuses the same `_skill_filter` variable, so widening the primary fixes the "loadable names" listing by construction. Assert that reuse, don't re-derive it. |
| C4 | `:1459` | `_handle_save_skill` lint siblings → leave at the default (`born_for=False`), **with the reason written in** (§4). |
| C5 | `:1589` | `_handle_read_skill_file` → `born_for=True` (this is the site D-264-04 meant, §2.2). Both `.or_()` applications (`:1594`, `:1606`) reuse the one variable. |
| C6 | `:2197` | `_handle_execute_code` skill-file injection → `born_for=True`. Both `.or_()` applications (`:2204`, `:2219`) reuse `_sf_filter`. |

### D. `backend/app/services/agent_loop.py` — 51 / 25 / 3473 · **G-5 FIRES**

⛔ **The field name must not contain `"expert"` (§2.1).** Use `born_for_bundle_id`.

| # | Line | Edit |
|---|---|---|
| D1 | `:270` (after `scoped_folder_path`) | `RunContext` — add `born_for_bundle_id: "UUID \| None" = None`. Frozen dataclass; all trailing fields already have defaults, so appending is safe. |
| D2 | `:1334` (beside `skill_instructions_override = ctx.skill_instructions_override`) | bind `born_for_bundle_id = ctx.born_for_bundle_id` once, exactly as 135 did. |
| D3 | `:2034-2058` | `_resume_ctx = ToolContext(...)` — add `born_for_bundle_id=born_for_bundle_id`. |
| D4 | `:2906-2940` | `tool_ctx = ToolContext(...)` — add `born_for_bundle_id=born_for_bundle_id`. |

⚠ **A field added at only one of the two builds is a defect every existing test would miss** — the
135 `skill_instructions_override` comment at `:2053-2057` exists because that exact mistake is
easy here. Pin **both** builds.

### E. `backend/app/services/run_producer.py` — 9 / 5 / 899 · **G-5 FIRES** (ledger row STALE at `5/3/749`)

| # | Line | Edit |
|---|---|---|
| E1 | `:378-383` | `_resolve_thread_scoping` signature + return annotation → 5-tuple (`..., UUID \| None`). |
| E2 | `:401` | `return None, None, None, None` → `return None, None, None, None, None` (the no-expert arm). |
| E3 | `:494` | `return effective_folder_ids, effective_tools, skill_catalog_override, scoped_folder_path` → append **`resolved.bundle_id`**. ⭐ Use `resolved.bundle_id` (`ResolvedExpertBundle.bundle_id: UUID`, `expert_service.py:18`), **not** the raw `active_expert_id` read at `:398` — `resolved` is the access-checked value, and `resolve_expert_bundle` returning non-`None` is what makes it honest. |
| E4 | `:657-663` | Deep branch: unpack five, pass `born_for_bundle_id=_born_for` into `RunContext`. |
| E5 | `:825-831` | Continuation branch: **same two edits**. This is the site a one-site fix would miss. |
| E6 | `:495-502` | The `except` arm re-raises (fail-closed) — no change, but confirm the 5-tuple does not introduce a silent 4-tuple path. |

### F. `backend/app/services/task_service.py` — 19 / 10 / 958 · **G-5 FIRES**

| # | Line | Edit |
|---|---|---|
| F1 | `:585-651`, beside `skill_instructions_override=parent_ctx.skill_instructions_override` (`:650`) | `born_for_bundle_id=parent_ctx.born_for_bundle_id` — **PROPAGATE** (D-264-05). This mirrors `workflow_run_id` / `skill_snapshot` / `skill_instructions_override`, all three of which are propagated for the same measured reason: the harness/eval builders set the field on the PARENT ctx but **every tool call dispatches with `sub_ctx`**, so a non-propagated field is structurally unreachable on the live path (the 096-02 and 099 CR-02 fixes, recorded in the comments at `:637-650`). No measured reason to deviate — **propagate**. |
| F2 | — | ⛔ **Do NOT copy the `dead_gap_tokens_in_run=set()` / `previous_files_in_run={}` "fresh per sub-agent" shape.** Those are run-scoped mutable accumulators; this is an immutable scope id. |

### G/H/I. Sites that stay UNCHANGED (and should be fenced)

| Site | Decision | Reason |
|---|---|---|
| `harness/phase_types.py:637` (`_build_phase_tool_context`) | **UNCHANGED** — dataclass default `None` | Workflow phase ctx. No Expert exists on the harness path; `phase_whitelist` governs it instead. |
| `harness/grounding.py:208,215` | ⛔ **UNCHANGED** | Not reachable from a chat Expert run — full caller set measured, §2.5. |
| `eval_runner_service.py:570` (`RunContext(`) | **UNCHANGED** — dataclass default `None` | The eval harness has no Expert. |
| `agent_loop.py:1435` (Deep skill catalog) | **UNCHANGED** | An Expert run takes the `skill_catalog_override is not None` branch; SEED-129 owns this line (§2.10). |

### J. Tests that MUST change in the same commit (else the baseline breaks)

Ten 4-tuple unpacks of `_resolve_thread_scoping`, all in `tests/unit` (§2.8). Named individually so
none is missed:

```
tests/unit/test_260_expert_chat_scoping.py:81, :122
tests/unit/test_260_financial_analyzer_conversation.py:352
tests/unit/test_261_expert_authoring_scenarios.py:179, :232, :276
tests/unit/test_261_expert_runtime_scoping.py:59, :113, :158, :197
```

### K. Ledger / docs obligations (same commit — CLAUDE.md same-commit sync rule)

| File | Obligation |
|---|---|
| `backend/app/utils/skill_visibility.py` | **New row** in `docs/HOT-FILE-LEDGER.md` + the CLAUDE.md scan table. Triple `1 / 1 / 83`; G-5 does NOT fire (1 phase) — the row exists so it is never invisible, the `settingsSearchPayload.ts` / `workspaceAllowedExt.ts` precedent. |
| `run_producer.py` | Row STALE at `5 / 3 / 749` → **measured `9 / 5 / 899`**. |
| `expert_service.py` | Row STALE at `6 / 4 / 507` → **measured `7 / 4 / 515`**. |
| `tool_dispatcher.py` | CLAUDE.md scan row STALE at `85 / 35 / 5048` → **measured `87 / 37 / 5082`**. |
| `agent_loop.py` | CLAUDE.md scan row STALE at `48 / 22 / 3441` → **measured `51 / 25 / 3473`**. |

---

## 4. Per-call-site decisions (D-264-04), with reasons

**The decisive measurement** — `tool_dispatcher.py:4585-4609`, the Expert's tool roster:

```python
EXPERT_CORE_TOOLS = frozenset({
    "search_documents","query_documents","read_document","analyze_document",
    "ls","tree","grep","glob","load_skill","read_skill_file",
})
EXPERT_DELIVERABLE_TOOLS = frozenset({"execute_code","workspace_write","render_template","ask_user"})
```

`run_producer.py:481-485` unions the two when `resolved.tool_floor_enabled` (default `True`,
`ResolvedExpertBundle.tool_floor_enabled: bool = True`, `expert_service.py:25`).

| Site | Handler | What it reads | Reachable on an Expert run? | **Decision** | Reason |
|---|---|---|---|---|---|
| `:1315` | `_handle_load_skill` | `skills` → `id,name,description,instructions,user_id`, `.eq("is_enabled",True)`; reused at `:1347` for the miss-branch candidate list | ✅ `load_skill` ∈ `EXPERT_CORE_TOOLS` | **WIDEN** (`born_for=True`) | This *is* the defect. Widening the one `_skill_filter` variable fixes both the primary query **and** the `:1362` `available_skills` listing — half the user-visible defect, closed by construction rather than by a second edit. |
| `:1459` | `_handle_save_skill` | `skills` → `id,description` — the **TRIG-03 description-lint sibling corpus**, used only to compute non-blocking `lint_warnings` on a save. Wrapped in `try/except → lint_warnings = []`. | ❌ `save_skill` ∉ either Expert set — **not advertised** to an Expert run (a hallucinated call could still dispatch, §2.9) | **DO NOT WIDEN** (`born_for=False`, default) | Three independent reasons: (1) the Expert is never offered this tool; (2) the read produces **no user-visible capability** — it feeds a lint corpus, and widening it would make an Expert's borrowed skills influence *another user's* save-time warnings, which is a widening with no upside; (3) it is a **write** handler's helper, and PACK-17's axis is *read the body you were promised*. ⛔ Record this reason in the source comment beside the call, per D-264-04. |
| `:1589` | `_handle_read_skill_file` | `skills` → `id,user_id` → the storage path `{user_id}/{id}/{filename}`; reused at `:1606` for the normalised-name retry | ✅ `read_skill_file` ∈ `EXPERT_CORE_TOOLS` | **WIDEN** (`born_for=True`) | Exactly D-264-04's stated rationale, one row down from where it was written: *"a born-for skill whose body loads but whose bundled files 404 is the same defect one layer down."* `load_skill` returns `files: [...]` (`:1394-1396`), so the model is told the files exist and then cannot read them. ⚠ Carries the `is_enabled` caveat — see §2.7 / §5.3. |
| `:2197` | `_handle_execute_code` (skill-file injection) | `skills` → `id,user_id` per requested `skill_files` entry → downloads bytes into `/sandbox`; reused at `:2219` | ✅ `execute_code` ∈ `EXPERT_DELIVERABLE_TOOLS`, unioned in whenever `tool_floor_enabled` (the default) | **WIDEN** (`born_for=True`) | Same class as `:1589` and the same user-visible failure mode, one layer further out: the failure is a `logger.warning` + a silently-skipped file (`:2226`), so the sandbox runs **without** the skill's helper and the model reasons on from a false premise. A born-for skill that bundles a script is useless to a non-author without this. ⚠ Same `is_enabled` caveat. |
| `grounding.py:208/215` | `_skill_registry` | workflow canvas skill palette | ❌ caller set measured, §2.5 | ⛔ **UNCHANGED** | Fence it negatively: no keyword passed, no `born_for_expert_bundle_id` token in its predicate string. |
| `phase_types.py:637` | `_build_phase_tool_context` | harness phase ctx | ❌ no Expert on the harness path | **UNCHANGED** (default `None`) | |

> ⚠ **A note the plan should carry into the fences:** `:1589` and `:2197` **do not filter
> `is_enabled` at all** (measured — no `.eq("is_enabled", True)` in either query). `:1315` does.
> Widening `:1589`/`:2197` with a bare born-for term therefore admits a *disabled* born-for skill's
> files, which `filter_visible_skill_names` would have stripped. §5.3 offers a form that closes this
> without touching the default path.

---

## 5. The predicate: base literal, widened form, and the grammar evidence

### 5.1 The exact base literals (run against the real function, `backend/venv`)

```
build_skill_visibility_or(U, set())      == 'is_system.eq.true'

build_skill_visibility_or(U, {A})        == 'is_system.eq.true,and(org_id.in.(11111111-1111-1111-1111-111111111111),or(user_id.eq.00000000-0000-0000-0000-000000000042,is_org_shared.eq.true))'

build_skill_visibility_or(U, {A,B})      == 'is_system.eq.true,and(org_id.in.(11111111-1111-1111-1111-111111111111,22222222-2222-2222-2222-222222222222),or(user_id.eq.00000000-0000-0000-0000-000000000042,is_org_shared.eq.true))'
```

with `U = 00000000-0000-0000-0000-000000000042`, `A = 11111111-…-111111111111`,
`B = 22222222-…-222222222222` (the constants already in
`tests/unit/test_seed125_skill_visibility_filter.py:31-33`, so SC#5's frozen literal can reuse them).

**SC#5 is satisfiable as a literal `==` assertion** against these three strings for
`expert_bundle_id=None`. That is strictly stronger than the current
`assert out.startswith(...)` / `assert ... in out` shape at `:44-55`, which cannot see an appended
term. ⭐ Recommend `assert out == <frozen literal>` for all three arms.

### 5.2 The empty-org arm must NOT gain the term (fail-closed)

`build_skill_visibility_or(U, set(), expert_bundle_id=<any>)` must still return exactly
`'is_system.eq.true'`. The born-for disjunct lives **inside** `and(org_id.in.(…), …)`; with no org
gate there is nothing to nest inside, and a top-level `born_for_expert_bundle_id.eq.<b>` would be a
fourth top-level branch — the SEED-125 shape, letting a **foreign-org** row carrying the marker
through. This arm needs its own driven case.

### 5.3 The widened form — two candidates, both VERIFIED against a live PostgREST

**Form 1 (minimal, mirrors 263's disjunct exactly):**

```
is_system.eq.true,and(org_id.in.(<orgs>),or(user_id.eq.<caller>,is_org_shared.eq.true,born_for_expert_bundle_id.eq.<bundle>))
```

**Form 2 (recommended — carries the enablement `filter_visible_skill_names` already requires, §2.7):**

```
is_system.eq.true,and(org_id.in.(<orgs>),or(user_id.eq.<caller>,is_org_shared.eq.true,and(born_for_expert_bundle_id.eq.<bundle>,is_enabled.is.true)))
```

Both were sent to the **real local PostgREST** against the **real `public.skills`** table:

```
Form 1  → HTTP 200, []      # parses, column resolves
Form 2  → HTTP 200, []      # parses, both columns resolve
```

**Negative controls, so the 200s mean something** (a green that cannot go red is not evidence):

```
…or(…,no_such_column_xyz.eq.1)   → HTTP 400 {"code":"42703","message":"column skills.no_such_column_xyz does not exist"}
… unbalanced paren …             → HTTP 400 {"code":"PGRST100","details":"unexpected end of input expecting \",\" or \")\"",
                                              "message":"failed to parse logic tree … (line 1, column 126)"}
```

So PostgREST **does** parse the logic tree and **does** resolve every column name — the 200 is a real
parse + a real column resolution, not a silently-ignored filter. `born_for_expert_bundle_id` exists
on the local DB (mig 191 applied).

**Transport evidence:** `postgrest 2.29.0` (`backend/venv`). `SyncFilterRequestBuilder.or_` is a
pure passthrough — `self.request.params.add("or", f"({filters})")`. **No escaping, no quoting, no
validation happens in the client.** The grammar is entirely our responsibility, which is exactly why
`coerce_uid` is the right validator.

### 5.4 `coerce_uid` is the right validator — and the trap it does NOT cover

`coerce_uid` (`app/utils/db.py:33-46`) is `str(UUID(str(v)))` — it raises `ValueError` on anything
that is not a well-formed UUID, so a malformed bundle id can never break out of the `.eq.` term.
Apply it to `expert_bundle_id` exactly as `:54` and `:57` apply it to the caller and each org.
`test_seed125_skill_visibility_filter.py:63-70` already pins "malformed ids raise, not inject" —
**add a third arm for the bundle id**, RED-driven against an un-coerced splice.

⛔ **What `coerce_uid` does not cover:** `None`. The guard must be structural —
`if expert_bundle_id is None: <emit base literal>` — not a coercion.

### 5.5 The Python twin (`skill_row_visible`)

```python
return (
    str(row.get("user_id")) == str(caller_id)
    or bool(row.get("is_org_shared"))
    or (
        expert_bundle_id is not None
        and row.get("born_for_expert_bundle_id") is not None
        and str(row.get("born_for_expert_bundle_id")) == str(expert_bundle_id)
    )
)
```

⛔ **Both `is not None` guards are load-bearing.** `expert_bundle_id is not None` is `T-263-02`
(`expert_service.py:303-307`). The **second** guard is a `str()`-specific hazard this module has that
263's asyncpg version did not: `str(None) == str(None)` is `"None" == "None"` → `True`. With only the
first guard the expression is still safe (a real UUID never stringifies to `"None"`), but the second
guard makes it safe **by construction** rather than by a property of UUID formatting. Use both, and
drive a row with `born_for_expert_bundle_id: None` against a non-`None` bundle.

⚠ Use `.get()`, **never** `row["born_for_expert_bundle_id"]` — the comment at
`expert_service.py:340` records why: *"every pre-263 mock fixture is a plain dict without this key."*
Measured still true: `tests/unit/test_142_load_skill_flag.py:83-95`'s `_skill_row()` has no such key.

---

## 6. Test surface + baseline

### 6.1 The backend baseline — **measured, at the ceiling, zero headroom**

Run in `backend/` with the venv, 2026-09-22 on `f04d9c406`:

```
$ venv/Scripts/python.exe -m pytest tests/unit -q --continue-on-collection-errors
...
71 failed, 5423 passed, 2 xfailed, 2 xpassed, 44 warnings in 246.56s (0:04:06)
[exited with code 0]
```

**71 failed — exactly the CLAUDE.md ceiling, zero headroom. 0 collection errors.** (CLAUDE.md's
v4.0 lock also quotes `3497 passed`; the passed count has since grown to **5423**. The *contract* is
the 71 ceiling, not the passed figure — a growing passed count is the suite working.)

**The failing SET, captured (not a tail), and identical across TWO independent runs.** Regenerate
with `pytest tests/unit -q --continue-on-collection-errors 2>&1 | grep "^FAILED" | sort`.
⛔ **Diff SETS, never counts** — a plan that fixes one inherited red and introduces one new red
reads `71` and is broken.

| count | file | | count | file |
|---|---|---|---|---|
| 15 | `tests/unit/test_retrieval_service.py` | | 2 | `tests/unit/test_extraction_service.py` |
| 12 | `tests/unit/test_sql_service.py` | | 2 | `tests/unit/test_cross_worker_cancellation.py` |
| 6 | `tests/unit/test_explorer_agent.py` | | 2 | `tests/unit/test_071_1_threadpool_sweep.py` |
| 5 | `tests/unit/test_multimodal_query.py` | | 1 | `tests/unit/test_streaming_reliability.py` |
| 4 | `tests/unit/test_111_1_reembed_kickoff.py` | | 1 | `tests/unit/test_published_workflow_ownership.py` |
| 3 | `tests/unit/test_sandbox_service.py` | | 1 | `tests/unit/test_phase56_iteration_start.py` |
| 3 | `tests/unit/test_lifespan.py` | | 1 | `tests/unit/test_per_format_ingestion.py` |
| 3 | `tests/unit/test_db_runs.py` | | 1 | `tests/unit/test_get_model_capability_inference.py` |
| 2 | `tests/unit/test_module7_tools.py` | | 1 | `tests/unit/test_forced_emit.py` |
| 1 | `tests/unit/test_chat_tool_approval.py` | | 1 | `tests/unit/test_200_1_phase_output_shape.py` |
| 1 | `tests/unit/test_190_review_fix_data_layer.py` | | 1 | `tests/unit/test_182_validate.py` |
| 1 | `tests/unit/test_075_4_unknown_provider_error.py` | | 1 | `tests/unit/test_061_consumer.py` |

⭐ **ZERO of the 71 is in this phase's blast radius.** Measured:
`grep -cE "seed125|_263_|_260_|_261_|load_skill|skill_visibility|tool_dispatcher|agent_loop|run_producer|task_service|expert"` over the captured set returns **0**.
**So every test this phase touches is GREEN at base, and any red it produces is NEW** — the
inherited-vs-new question is already settled, before a line is written. Record this in the plan; it
is the cheapest triage a wave can inherit.

⚠ **Two arity edits in this phase (§2.8, §3.J) can move this number by +10 on their own.** Every
wave must set-diff in **both** directions.

### 6.2 What currently drives the predicate

| File | Drives | In `tests/unit`? |
|---|---|---|
| `tests/unit/test_seed125_skill_visibility_filter.py` (142 L) | `build_skill_visibility_or` (`:36-70`) and `skill_row_visible` (`:93-142`), including the three Phase 263 negative born-for cases | ✅ **gated** |
| `tests/unit/test_182_grounding_skill_org_gate.py` | `grounding._skill_registry`'s use of both encodings | ✅ gated |
| `tests/unit/test_263_expert_born_skill_resolution.py` (8 tests) | `filter_visible_skill_names` — **all five born-for arms, on the RESOLVE path only** | ✅ gated |
| `tests/unit/test_263_expert_save_refuses_unknown_skills.py` | mocks `filter_visible_skill_names` entirely | ✅ gated |
| `tests/unit/test_142_load_skill_flag.py` | `_handle_load_skill` with a **passthrough fake that ignores `.or_()`** | ✅ gated, but **blind to visibility** |
| `tests/unit/test_260_financial_analyzer_conversation.py:156` | `_handle_load_skill` with `aexec` **patched out** | ✅ gated, **blind** |
| `tests/test_load_skill_collision.py` · `tests/test_load_skill_override.py` · `tests/test_099_skill_composition.py` · `tests/test_agent_loop_catalog_override.py` | `_handle_load_skill` / the carrier fields | ❌ **top-level — outside the gate** (SEED-165) |
| `tests/integration/test_140_escape_hatch.py` · `tests/integration/test_v3_4_org_isolation.py` | `_handle_load_skill` / `_handle_read_skill_file` on a **real DB, real service-role client** | ❌ outside the gate |

**SC#1 is not provable by any existing shape.** The suites that reach `_handle_load_skill` in
`tests/unit` all neutralise the predicate; the suite that drives the predicate for real is outside
the gate. §6.3 names the two honest options.

### 6.3 Two honest ways to drive SC#1, with their costs

1. **Assert the predicate STRING at the `.or_()` boundary.** A fake whose `.or_()` **records** its
   argument instead of no-op'ing it, asserted against the widened literal from §5.3. Cheap,
   deterministic, lands in `tests/unit`, catches the plumbing end-to-end (RunContext → ToolContext →
   resolver → predicate). ⛔ It proves the *query we would send*, not the *rows Postgres returns* —
   say that in the docstring rather than letting the green read as more than it is.
2. **A real-DB driver, modelled on `tests/integration/test_v3_4_org_isolation.py:967-995`.** That
   test already has the fixtures: `two_orgs_two_users`, `_seed_org_shared_skill(pool, owner, org)`,
   `_make_seed125_tool_ctx(sb, caller_uid)` (`:918-939`), and `_service_role_supabase_or_skip()`.
   264's case is a **one-line variant**: seed the skill as **private** (`is_org_shared=False`) with
   `born_for_expert_bundle_id=<bundle>`, and drive `_handle_load_skill` as a **same-org non-author**
   with `born_for_bundle_id` set. ⛔ It sits **outside** `pytest tests/unit`, so it will not defend
   the ceiling — name it as UAT-adjacent evidence, not as a gate.

**D-264-07 (one table, both encodings) is directly implementable** by parametrizing over rows and
asserting `skill_row_visible(row, …)` **equals** a pure evaluator of the `.or_()` string's semantics
for that row. That is the "change one, change both" rule made executable, and it is the strongest
guard the phase can ship.

### 6.4 The two comment blocks D-264-02 must retire, quoted verbatim

**`tests/unit/test_seed125_skill_visibility_filter.py:126-142`** —
`test_born_for_marker_does_not_admit_another_users_private_same_org_skill`:

> ```
> """Same org, another author, not shared, marker set -> still invisible HERE.
>
> ⛔ A DELIBERATE ASYMMETRY, and the reason it is safe: the Expert resolver DOES
> admit this row (D-263-06), because an Expert is a scope its author opted the skill
> into. The agent loop has no such scope, so admitting it here would hand every
> Expert-authored skill in the org to every user's ordinary chat. The two predicates
> may differ ONLY in this direction — Expert-side wider, agent-side byte-unchanged.
> """
> ```

⭐ **A precise reading that changes what the plan must do:** the **assertion still passes unchanged**
— it calls `_skill_row_visible(row, caller_id=…, org_ids=…)` with **no** `expert_bundle_id`, which is
the default path, which stays `False`. **It is the REASON that is refuted, not the result.** The
sentence *"The agent loop has no such scope"* becomes false the moment an Expert is active on the
run. So D-264-02's obligation here is a **rewrite of the docstring plus a NEW sibling case** proving
the same row IS admitted when the bundle is passed — never a deletion, and never a silent edit of
the assertion.

The block comment above it (`:79-87`) says the same thing at module scope and is the second half of
the same obligation:

> *"Widening it here would widen skill resolution for the agent loop and for workflow grounding,
> which is the exact shape of SEED-125."*

**`expert_service.py:308-314`** — the D-263-06 block, whose first sentence is the one the
optional-parameter shape refutes:

> *"⛔ WHY THIS IS NOT IN `app/utils/skill_visibility.py`, deliberately. That module is the declared
> one home of the AGENT-side rule and is imported by `tool_dispatcher` (five call sites) and
> `harness/grounding.py`. Adding the born-for arm there would widen skill resolution for the agent
> loop and for workflow grounding — two consumers this phase has no business touching, and the exact
> shape of `SEED-125`. The Expert arm therefore stays in the Expert module. That is a decision, not
> an oversight."*

⭐ **The rewrite should say what is actually different:** the 263 shape was **unconditional**, so
hoisting it widened both consumers; the 264 shape is **opt-in by keyword**, so `grounding.py` and
every non-Expert dispatcher caller keep a byte-identical predicate — **provable by the §5.1 literal**,
not by the argument. Precedent for doing this properly: `D-206-07` (`test_189_no_egress.py`'s Case A
source fence, retired with its reason in the test body).

### 6.5 ⛔ A fence that will false-RED inside a worktree

`backend/tests/test_eval_runner.py:737-759` (`test_deep_mode_byte_identical_guard`) runs:

```python
r = subprocess.run(["git","diff","--quiet","backend/app/services/agent_loop.py"], cwd=repo_root)
assert r.returncode == 0, "agent_loop.py must stay byte-identical this phase (D-13)"
```

It asserts the **working tree** is clean for `agent_loop.py`. Any executor that edits `agent_loop.py`
and runs this test **before committing** sees a RED that is not a defect. It is in `backend/tests/`
(top level) so it is **outside** `pytest tests/unit` and outside the ceiling — but a plan running a
broader selection will hit it. **Name it in the plan so nobody triages it as a real failure.** It
goes green again the moment the change is committed.

### 6.6 Other dataclass fences (all additive-safe, none blocking)

| Fence | Asserts | Effect of this phase |
|---|---|---|
| `tests/test_099_skill_composition.py:209-216` | `ToolContext` has `skill_snapshot`, default `None` | none (additive) |
| `tests/test_eval_runner.py:748-751` | `RunContext` has `skill_catalog_override`, default `None` | none (additive) |
| `tests/test_harness_whitelist.py:35-37` | `ToolContext.__dataclass_fields__` contains `phase_whitelist` | none (additive) |

No fence pins a field **count** on either dataclass — measured by grepping
`fields(ToolContext)` / `__dataclass_fields__` across `backend/`.

---

## 7. Ledger triples (re-derived 2026-09-22 with the CLAUDE.md recipe)

Six-digit quick-task buckets subtracted, per the recipe.

| File | **Measured** commits / phases / lines | G-5 | Ledger row state |
|---|---|---|---|
| `backend/app/services/tool_dispatcher.py` | **87 / 37 / 5082** | ⚠ **FIRES** | present; CLAUDE.md row **STALE** (`85 / 35 / 5048`) |
| `backend/app/services/agent_loop.py` | **51 / 25 / 3473** | ⚠ **FIRES** | present; CLAUDE.md row **STALE** (`48 / 22 / 3441`); detail file **STALE** (`44 / 21 / 3303`) |
| `backend/app/services/run_producer.py` | **9 / 5 / 899** | ⚠ **FIRES** | present; row **STALE** (`5 / 3 / 749`) — the previous row already carried a "verdict was WRONG" correction |
| `backend/app/services/task_service.py` | **19 / 10 / 958** | ⚠ **FIRES** | present and **accurate** (`19 / 10 / 958`, added 256-02) |
| `backend/app/services/expert_service.py` | **7 / 4 / 515** | ⚠ **FIRES** | present; row **STALE** (`6 / 4 / 507`) |
| `backend/app/utils/skill_visibility.py` | **1 / 1 / 83** | no (1 phase) | ⛔ **NO ROW AT ALL** — the only mention is a sentence *inside* `expert_service.py`'s section |
| `backend/app/services/harness/phase_types.py` | 54 / 27 / 2954 | ⚠ FIRES | present, accurate — **not modified by this phase** |
| `backend/app/services/harness/grounding.py` | 21 / 8 / 1414 | ⚠ FIRES | present — **not modified by this phase** (fenced) |

**Five of the six files this phase touches fire G-5**, and the sixth has no row. Every one needs a
disposition sentence, and `skill_visibility.py` needs a row **created**.

**Gate behaviour, measured:** `node scripts/check-hot-file-ledger.cjs 264` currently exits with
`FATAL: no *-PLAN.md` — it cannot run until plans exist. When it does run,
`backend/app/utils/skill_visibility.py` matches `WATCHED = [/^backend\/app\//]` and matches **none**
of the `EXEMPT` patterns (`scripts/check-hot-file-ledger.cjs:51-66`), so it **will** fail `[no-row]`.
Confirmed obligation, not a guess.

**Named seams (recorded, not necessarily taken):**
- `tool_dispatcher.py` — `_resolve_skill_visibility_or` + the four consumers are already a seam; the
  natural extraction if a fifth site ever appears is a `skills`-resolution module, not another
  handler-local helper.
- `agent_loop.py` — the ledger's standing named seam is *"the prompt-assembly block is six
  conditional appends deep inside one 400-line branch"*. **This phase does not touch it** (D1-D4 are
  a dataclass field, one binding and two keyword arguments) — say so, so the seam stays owed rather
  than looking discharged.
- `skill_visibility.py`'s new row should record its binding invariant: **exactly one copy of the
  rule, two encodings, they MUST agree, and the born-for arm nests INSIDE the org gate — never as a
  fourth top-level branch.**

---

## 8. Pitfalls

### 8.1 The `None == None` trap (T-263-02) — and its `str()` variant, which is NEW here

`expert_service.py:303-307` records the original: at save time `bundle_id=None` and every unstamped
row carries `born_for_expert_bundle_id = None`, so a bare `==` admits **every other user's private
skill in the org**. In `skill_row_visible` there is a **second** form of the same trap:
`str(None) == str(None)` is `"None" == "None"` → `True`. Guard **both** operands (§5.5) and drive a
row with an explicit `None` marker against a non-`None` bundle.

### 8.2 `.get()` vs `[...]` on pre-263 fixtures

`expert_service.py:340` already carries the rule: *".get(), never [...]: every pre-263 mock fixture
is a plain dict without this key."* Measured still true — `tests/unit/test_142_load_skill_flag.py:83-95`'s
`_skill_row()` has no `born_for_expert_bundle_id` key, and `_PassthroughQuery` returns it verbatim.
A `KeyError` here would surface as a `load_skill` handler crash, not a visibility miss.

### 8.3 The frozen `RunContext`

`@dataclass(frozen=True)` (`agent_loop.py:219`). Two consequences: the new field must have a default
(it does — `None`) **and must be hashable**. `UUID` is hashable, so `UUID | None` is fine; a `dict`
or `set` would not be (the dataclass docstring at `:224-229` says why the frozen-ness is deliberate).
Append after `scoped_folder_path` (`:270`) — all trailing fields already carry defaults.

### 8.4 The import-light constraint on `skill_visibility.py`

Its docstring (`:24-32`) records a **real** cycle: `tool_dispatcher` → `harness.scope` →
`task_service` → back to `tool_dispatcher`, which is why `grounding.py` cannot import the dispatcher.
⛔ **`skill_visibility.py` must NOT import `expert_service`, `app.models.expert`, or anything under
`app.services.`.** Its only import today is `from app.utils.db import coerce_uid` — keep it that way.
Type the new parameter as `str | UUID | None` with `from uuid import UUID` (stdlib) or as a string
annotation; do **not** reach for an Expert type. The dependency must point **expert_service →
skill_visibility**, never back.

### 8.5 Widening can admit a DISABLED skill — at two of the four sites

`skill_visibility.py:76-78` says it deliberately does not check `is_enabled`. `:1315` compensates
with `.eq("is_enabled", True)`; **`:1589` and `:2197` do not compensate at all** (measured — no
enablement term in either query). Widening those two with a bare born-for disjunct admits a disabled
born-for skill's files, which `filter_visible_skill_names` (which *does* require `s_enabled`) would
have stripped. Form 2 in §5.3 closes this inside the arm, leaves the default path byte-identical,
and is verified to parse. **Whichever way the plan goes, it must be a recorded decision with a
driven case — not an omission.**

### 8.6 Two `RunContext` build sites in `run_producer`, not one

`:663` (Deep) and `:831` (continuation). **A field set at only one is a defect every existing test
would miss** — no test exercises the continuation path's scoping. Pin both by construction (e.g. an
AST/source fence counting `born_for_bundle_id=` occurrences in `run_producer.py` at exactly 2).
Same discipline for `agent_loop.py`'s two `ToolContext` builds (`:2034`, `:2906`).

### 8.7 The arity change is the baseline risk, not the predicate

Ten `tests/unit` unpack sites (§2.8). With **zero headroom** at 71, forgetting one is a broken gate.
Consider making the 5-tuple change its own first task with the ten updates in the same diff, so the
wave that follows starts from a green 71.

### 8.8 `available_skills` in the miss branch is fixed by REUSE, not by a second edit

`:1347` reuses `_skill_filter`. That is the right shape, but it is also invisible — a future
refactor that re-derives the filter there would silently re-open half the defect. **Fence the
reuse** (one resolver call per handler, asserted), not just the outcome.

### 8.9 A green passthrough fake proves nothing about visibility

Every gated `load_skill` test neutralises `.or_()` (§6.2). A plan that "verifies the widening" with
those fakes has verified nothing. Assert the **predicate string** (§6.3 option 1) or drive a real DB
(option 2) — and say in the docstring which one the green means.

### 8.10 Do not let `filter_visible_skill_names`'s delegation change the degenerate org case

§3.B3/B-warning: `s_org_id == caller_org_id` with both `None` is `True` today; `skill_row_visible`
returns `False`. Believed unreachable, **not proven**. Drive it.

### 8.11 ⚠ `[ASSUMED]` items — the only two claims here not measured in session

- **`[ASSUMED]`** That widening `read_skill_file` / `execute_code` is what a non-author *needs* in
  practice — i.e. that born-for skills in this deployment actually bundle files. The reasoning
  (the `files: [...]` list `load_skill` returns is a promise) is sound, but no shipped born-for skill
  was inspected. Confirm at UAT (D-264-09).
- **`[ASSUMED]`** That `caller_org_id` is never `None` at `api/experts.py:81`. The route types it
  `org_id` and `resolve_expert_bundle` annotates `UUID`, but `run_producer.py:404` builds it as
  `UUID(...) if current_user.get("org_id") else None` — so a **`None` is constructible** on the
  chat path. §8.10 is the driven case that settles it.

---

## 8b. Security domain (`security_enforcement: true`)

⛔ **This phase IS a security change.** It widens a tenancy-isolation predicate that exists because of
a real, shipped cross-org leak (`SEED-125`). Treat every widening as a control change, not a feature.

### Applicable ASVS categories

| ASVS category | Applies | Standard control, as it exists in this codebase |
|---|---|---|
| V1 Architecture | **yes** | One home for the rule (`skill_visibility.py`); the born-for arm nests **inside** the org gate, never beside it. |
| V4 Access Control | **yes — the whole phase** | The in-app org gate that substitutes for RLS on the **service-role (BYPASSRLS)** client. `build_skill_visibility_or` + `skill_row_visible`, which MUST agree. |
| V5 Input Validation | **yes** | `coerce_uid` on every runtime value spliced into the `.or_()` DSL — now including `expert_bundle_id`. |
| V7 Error Handling / Logging | partial | `_handle_load_skill`'s miss branch **enumerates loadable names**; widening changes what a caller can enumerate. Keep it scoped to the caller's own visible set. |
| V2 Authn · V3 Session · V6 Crypto | no | Untouched. |

### Threat patterns for this change

| Pattern | STRIDE | Mitigation, and where it is enforced |
|---|---|---|
| A **fourth top-level** `or` branch lets a foreign-org row carrying the marker through | Information disclosure | The disjunct MUST nest inside `and(org_id.in.(…), or(…))`. `expert_service.py:294-300` already argues this is true **by construction**; §5.2 + §5.3 keep it so, and the empty-org arm must stay `is_system.eq.true`. |
| `None == None` admits every other user's private skill in the org | Elevation of privilege | `T-263-02`; both `is not None` guards (§5.5, §8.1), driven. |
| Query widens but the Python post-filter does not (or vice versa) | Information disclosure | The module's own rule: *"a post-filter looser than the query re-opens the leak the moment the query is bypassed, degraded, or widened."* D-264-07's one-table fence is the control. |
| A malformed bundle id breaks out of the `.eq.` term | Tampering / injection | `coerce_uid` raises. Needs its own driven arm (§5.4) — the existing pin at `test_seed125_…:63` covers only caller + org. |
| An **unwanted consumer** is widened because the resolver reads `ctx` unconditionally | Information disclosure | The explicit `born_for: bool` keyword (§3.C2) makes each of the four sites state its decision in source, so a widening cannot happen by omission. |
| A **disabled** born-for skill's files become readable | Information disclosure (minor) | §2.7 / §8.5 — Form 2 of the predicate, or a recorded decision. |

### Enumeration note

`_handle_load_skill:1362` returns `available_skills` — the names of every row the predicate admitted.
Widening the predicate widens that list. That is **intended** here (the miss branch is half the
defect) but it means the list is a disclosure surface: it must never be built from a *different*
filter than the primary query. §8.8's reuse fence is the control.

---

## 9. Sources

### Primary (HIGH — measured this session)
- `backend/app/utils/skill_visibility.py` (full read) · executed via `backend/venv` for §5.1.
- `backend/app/services/tool_dispatcher.py` `:42-46`, `:100-195`, `:1280-1432`, `:1435-1508`,
  `:1563-1630`, `:2190-2235`, `:4585-4614`, `:5045-5080`.
- `backend/app/services/agent_loop.py` `:215-300`, `:1325-1345`, `:1415-1470`, `:1670-1690`,
  `:2020-2075`, `:2895-2960`.
- `backend/app/services/run_producer.py` `:378-502`, `:640-700`, `:810-870`.
- `backend/app/services/task_service.py` `:560-660`.
- `backend/app/services/expert_service.py` `:17-32`, `:278-360`, `:400-415`.
- `backend/app/services/harness/phase_types.py` `:620-670`; `backend/app/services/harness/grounding.py` `:155-215`.
- `backend/app/utils/db.py` `:33-46`; `backend/app/utils/folder_utils.py` `:130-153`.
- `supabase/migrations/191_skill_expert_provenance.sql` (full).
- `backend/tests/unit/test_seed125_skill_visibility_filter.py` (full, 142 L),
  `test_260_expert_chat_scoping.py:155-176`, `test_261_expert_runtime_scoping.py:205-224`,
  `test_142_load_skill_flag.py:36-115`, `test_263_expert_born_skill_resolution.py` (map),
  `test_263_drafter_output_fits_its_consumers.py:1-45`,
  `tests/integration/test_v3_4_org_isolation.py:918-1010`, `tests/test_eval_runner.py:737-759`,
  `tests/test_099_skill_composition.py:209-216`.
- `pytest tests/unit -q --continue-on-collection-errors` → `71 failed, 5423 passed, 2 xfailed, 2 xpassed` (246.56s).
- `ast.parse` probes for the closed-core invariant (§2.1).
- Live local PostgREST (`http://127.0.0.1:54321/rest/v1/skills`) — two positive forms + two negative
  controls (§5.3).
- `postgrest 2.29.0` `SyncFilterRequestBuilder.or_` source via `inspect.getsource`.
- `git log` / `wc -l` per the CLAUDE.md ledger recipe (§7); `scripts/check-hot-file-ledger.cjs:40-66`.

### Secondary (MEDIUM — read, not independently re-derived)
- `docs/HOT-FILE-LEDGER.md` sections for `tool_dispatcher.py`, `agent_loop.py`, `expert_service.py`,
  `run_producer.py`, `task_service.py`.
- `CLAUDE.md` § Workflow guardrails, § hot-file scan table, § backend unit testing baseline gate.
- `.planning/ROADMAP.md` → `#### Phase 264`; `.planning/STATE.md` (263 close).
- `.planning/seeds/SEED-129-residual-org-blind-service-role-skill-reads.md` (frontmatter + gap).

---

## 10. Metadata

**Confidence breakdown:**
- Predicate + grammar: **HIGH** — driven against a live PostgREST with negative controls.
- Carrier edit list: **HIGH** — every site enumerated by grep, every build site read.
- Per-site decisions: **HIGH** — settled by the measured `EXPERT_CORE_TOOLS` / `EXPERT_DELIVERABLE_TOOLS` rosters.
- The AST-fence refutation: **HIGH** — reproduced with `ast.parse`.
- Baseline: **HIGH** — real run, real numbers.
- Ledger triples: **HIGH** — re-derived with the recipe, not copied.
- The two `[ASSUMED]` items in §8.11: **LOW** — flagged, with the driven case that settles each.

**Research date:** 2026-09-22
**Valid until:** ~7 days. Three of the six triples were already stale when this was written; the two
`run_producer` line numbers moved between 261 and 263. **Re-derive, do not quote.**

---

## ⚠ CORRECTED AT WAVE 1's CLOSE (2026-09-22, plan `264-01`) — two §-level claims measured wrong

Both originals are left in place above rather than overwritten, because in this project a figure
that rots is the finding, not an embarrassment.

**§2.8's arity prediction is OFF BY ONE.** The ten unpack sites are only **NINE node ids** —
`test_261_expert_runtime_scoping.py::test_additive_tool_floor_preserves_deliverable_tools` unpacks
**twice inside one test**. So the RED moved the gate `71 → 80`, not the predicted `81`. **All ten
sites were real and all ten were updated**; only the count was wrong. A later plan quoting `81` as
a target would chase a number that cannot occur.

**§8.3 is REFUTED, measured at the base.** It argues the new field "must be hashable" because
`RunContext` is frozen. ⛔ **`RunContext` instances have been UNHASHABLE since Phase 260** —
`current_user: dict`. Driven against the base copy of `agent_loop.py`: `hash(ctx)` raises
`TypeError: unhashable type: 'dict'`. ⭐ **No code change was needed: the premise was wrong, not the
implementation.** The *discipline* survives — the fence now pins frozen-ness (+`FrozenInstanceError`)
and field-type hashability, and §8.3's original wording is preserved in that test's docstring.

**⛔ A PROCESS FINDING WORTH MORE THAN EITHER.** Wave 1's Task-2 gate read **`72 failed`** with one
new id in `test_256_llm_emit_rollup.py`. Cause: a planted defect was written into `phase_types.py`
**while that gate was already running.** That test uses `inspect.getsource`, which re-reads the file
by recorded line number — a plant inserting a line *above* the target shifted what it read and
returned an unrelated function body. **Never mutate source while a gate runs, even for a plant you
intend to revert.** Smaller sibling: interleaved stderr can append text to a `FAILED` line
mid-capture, so a raw `comm` reports one test as both NEW and GONE — **diff the node id, never the
printed line.**

**Wave 1's closing measurement:** `71 failed, 5436 passed, 2 xfailed, 2 xpassed`; FAILED node-id
set-diff **empty in both directions** (71/71).
