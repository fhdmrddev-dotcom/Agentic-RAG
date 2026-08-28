---
phase: 214-a-step-names-its-service-and-its-action
plan: 01
subsystem: connectors / harness executor / harness models
tags: [argument-resolution, publish-gate, leaf-module, external-action, mcp, D-214-00]
requires:
  - backend/app/services/connectors/descriptors.py::descriptor_for
  - backend/app/services/connectors/registry.py::get_adapter
  - backend/app/services/connector_service.py::ResolvedConnection.discovered_tools
provides:
  - backend/app/services/connectors/args.py (7 exports — the ONE predicate + the ONE schema accessor)
  - backend/app/models/harness.py::ArgumentSourceSpec
  - backend/app/models/harness.py::ExternalActionPhaseConfig.arg_sources
affects:
  - "214-05 (publish gate) — calls unsatisfiable_arguments + schema_for_bound_tool"
  - "214-06 (approval pause) — calls schema_for_bound_tool"
  - "214-07 (argument editor) — written against the arg_sources field shape"
tech-stack:
  added: []
  patterns:
    - "grants.py's strict-leaf module skeleton (header invariant, explicit __all__, `Any` signatures, dual-shape reads)"
    - "human_input.py's cut discipline (boundaries asserted first; the re-import kept load-bearing)"
key-files:
  created:
    - backend/app/services/connectors/args.py
    - backend/tests/unit/test_214_args_leaf.py
    - backend/tests/unit/test_214_arg_source_field.py
  modified:
    - backend/app/models/harness.py
    - backend/app/services/harness/phase_types.py
    - backend/tests/unit/test_190_ssti_fence.py
    - backend/tests/unit/test_190_connector_source_fence.py
    - backend/tests/unit/test_213_approval_moment.py
    - backend/tests/unit/test_213_gate55_execution.py
    - backend/tests/unit/test_mcp_connector_client.py
decisions:
  - "The no-entry fallback in resolve_arguments reads tool_args THEN run_inputs — the plan's one-line spec named only tool_args, which its own D-214-12 characterization criterion cannot survive."
  - "schema=None on _adapter_args is a documented compatibility arm for the pre-214 three-positional call, not the production path; the production call site always passes the accessor's answer."
  - "body_arg exempts the capability's body field from no_source (and only from no_source) — otherwise the gate would refuse at publish a step the executor can in fact send."
metrics:
  tasks: 3
  commits: 3
  new-tests: 93
  duration: ~1h
  completed: 2026-08-28
---

# Phase 214 Plan 01: The Argument Leaf Summary

Argument resolution and argument satisfiability now live in one pure leaf that the executor
and the publish gate both call — and the seventh export makes their **schema provenance
identical by construction**, which is the half of D-214-00 a shared predicate alone does not
deliver.

## What shipped

| Task | Commit | What |
|---|---|---|
| 1 | `304c8910d` | `backend/app/services/connectors/args.py` — 7 exports, AST-asserted strict leaf, 47 cases |
| 2 | `fb830f216` | `ArgumentSourceSpec` + `ExternalActionPhaseConfig.arg_sources`, both validators driven RED |
| 3 | `a09715a0f` | `phase_types.py` re-pointed; both executor shapes through one predicate and one accessor |

## The three things the plan asked this summary to record

### 1 · The re-derived line boundaries

CONTEXT.md's `:2151` pointer was stale; PATTERNS.md measured `:2125`. **Re-derived at execute
time with `inspect.getsourcelines`, asserted before cutting rather than trusted:**

```
def line: 2125
end line: 2145
first line startswith 'def _adapter_args('   -> OK
last  line == 'return args'                  -> OK
BOUNDARY OK
```

`phase_types.py` measured **2733 lines** at `bd495af0f` and **2809** after the cut. ⚠ The file
grew, and that is honest rather than contradictory: the *responsibility* left (the projection
body is now four lines of delegation) while the *reasoning* stayed, because the D-09 sentence,
the re-import rule and the two schema-provenance blocks are exactly what stops the next reader
undoing this. The G-5 disposition (`extraction TAKEN`) rests on the responsibility, not the
line count, and this is stated so nobody quotes `+76` as a refutation.

### 2 · The `mock.patch` surface — measured, not assumed

```
grep -rn "phase_types\._adapter_args" backend --include=*.py | wc -l   ->  0
```

**Zero** patch sites, exactly as the plan predicted at plan time and re-measured here. The
patch surface therefore did not move. Recorded as a measurement rather than a silence, per
`human_input.py`'s cut rule 4 (nine sites had to move on that cut, measured RED first).

Three shipped suites DO import the moved names **by name, from `phase_types`** —
`test_190_ssti_fence.py:592/601`, `test_211_closed_set_agreement.py:53/95/173`, and
`test_190_connector_source_fence.py:334` (prose). All still resolve and all still pass; that is
what the re-import discipline bought.

### 3 · The exact `__all__` of `args.py` — plans 05, 06 and 07 read this list

```python
__all__ = [
    "ArgumentSourceKind",      # Literal["fixed", "ask", "upstream"]
    "ArgumentGapKind",         # Literal[no_source|ask_undeclared|upstream_unreachable|shape_unknown|unrenderable]
    "ArgumentGap",             # NamedTuple(kind, argument, upstream)
    "renderable_property",     # (prop) -> bool
    "resolve_arguments",       # (*, config, schema, upstream_outputs, run_inputs, body_arg=None) -> dict
    "unsatisfiable_arguments", # (*, config, schema, upstream_slugs, declared_input_keys, body_arg=None) -> list[ArgumentGap]
    "schema_for_bound_tool",   # (*, capability, tool_name, discovered_tools) -> dict | None
]
```

Seven names, asserted **as an ordered list** by `test_the_module_exports_exactly_seven_names_
including_the_schema_accessor`, plus a `hasattr` check per name so `__all__` cannot advertise
something the module does not have.

## Acceptance criteria — measured

| Criterion | Measured | |
|---|---|---|
| `args.py` imports nothing containing `harness` (AST) | `['logging', '__future__', 'collections.abc', 'typing', 'app.services.connectors']`, exit 0 | ✅ |
| `grep -c "^__all__" args.py` | `1`, naming 7 symbols incl. `schema_for_bound_tool` | ✅ |
| `args.py` ≥ 120 lines, contains `def schema_for_bound_tool` | 469 lines | ✅ |
| `args.py` contains no occurrence of the body-arg map identifier | 0 (+ positive control that it IS in `phase_types.py`) | ✅ |
| ≥ 1 assertion per `ArgumentGapKind` literal | `no_source` 3 · `ask_undeclared` 1 · `upstream_unreachable` 1 · `shape_unknown` 2 · `unrenderable` 1 | ✅ |
| `test_214_args_leaf.py` ≥ 12 cases | **58** | ✅ |
| `test_214_arg_source_field.py` green | **35** | ✅ |
| `grep -n "arg_sources" models/harness.py \| wc -l` ≥ 2 | `2` | ✅ |
| `grep -n "from app.services.connectors.args import"` = 1, line < 200 | line **104** | ✅ |
| `grep -c "def _adapter_args"` = 1 | `1` | ✅ |
| `grep -c "_BODY_ARG_FOR_CAPABILITY"` ≥ 4 | `4` (unchanged — the map did not move) | ✅ |
| `grep -c "INPUT_SCHEMA" phase_types.py` unchanged from HEAD | `1` → `1` | ✅ |
| `grep -c "_interpolate_prior_run_variables"` unchanged from HEAD | `4` → `4` | ✅ |
| `grep -rn "_interpolate_prior_run" args.py` = 0 | `0` | ✅ |
| `test_190_ssti_fence.py` + `test_211_closed_set_agreement.py` green | 87 passed with the other affected suites | ✅ |
| Legacy characterization pins for all three capabilities | pass, both call shapes | ✅ |
| MCP arm with no resolvable schema RECORDS and does not call `mcp_client.call_tool` | asserted, with a dispatching positive control beside it | ✅ |
| `pytest tests/unit -q` ≤ 68 failed | **68 failed / 2928 passed** | ✅ |

### The one criterion that could not be met literally, and what was done instead

> `grep -c "schema_for_bound_tool" backend/app/services/harness/phase_types.py` is **2** — one
> per shape.

**Measured `3`, and 2 is unreachable alongside the same plan's own key-link requirement.** The
plan requires a flat module-top import matching `from app\.services\.connectors\.args import`
(the `grants.py` precedent). That import contributes one textual occurrence; the two call sites
contribute two. `1 + 2 = 3` is the floor.

The criterion's *stated purpose* — "a count of 1 means one shape reads a schema some other way"
— is about **call sites**, so it is asserted as call sites, by AST, which is strictly stronger
than the grep (a grep counts a docstring mention; the AST counts a call):

```
test_the_executor_obtains_its_schema_from_the_accessor_at_exactly_two_call_sites
  -> ast.Call nodes with func.id == "schema_for_bound_tool"  ==  2
```

The two are GATE 6 (`:2661`, MCP) and GATE 7 (`:2731`, native). A docstring mention of the
literal was **removed** during execution so the textual count is exactly `import + 2 calls`
with no decorative third.

## Deviations from Plan

### Auto-fixed

**1. [Rule 1 — Bug] `resolve_arguments`' no-entry fallback must read `run_inputs`, not only `tool_args`**

- **Found during:** Task 1, while writing the D-214-12 characterization pins.
- **Issue:** The plan specifies the no-entry fallback as *"falls back to `config.tool_args[name]`
  if present"*. Every workflow published before this phase carries an **empty `tool_args`** on
  its native steps, and the value the pre-cut `_adapter_args` projected came from `resolved` —
  the run-input bag `_external_action_inputs` builds from `ctx.inputs` plus the upstream text. A
  fallback reading only `tool_args` returns `{}` for all of them: **a published workflow that
  silently stops sending**, which is the exact failure D-214-12 forbids and which the plan's own
  acceptance criterion ("the characterization case for legacy configs passes for all three
  capabilities") cannot survive.
- **Fix:** the arm reads `tool_args[name]` first (D-214-08), then `run_inputs[name]` (unfiltered,
  so the projection stays byte-identical to the old one). Documented in the function's docstring
  as the two halves of one branch.
- **Files:** `backend/app/services/connectors/args.py`
- **Commit:** `304c8910d`

**2. [Rule 3 — Blocking] Four shipped pins had to move with the change**

None of these four files is in the plan's `files_modified`; each was made red *by a required
edit*, and each is a pin whose own comment says a move is the fence working.

| Pin | Was | Is | Why |
|---|---|---|---|
| `test_190_ssti_fence.py::_ADDED_BY_214` | absent | `frozenset({"arg_sources"})` | The D-32 exact-field-set fence. The argument for the field is made **in the fence**, as it demands: `arg_sources` is a reference, not a program, and it still passes the second (expression-shaped-name) assertion. |
| `test_190_connector_source_fence.py` registry-importer line | `phase_types.py:106` | `:107` | The flat `args` import sits one line above. **The importer SET is unchanged** — `args.py` is a strict leaf whose only non-stdlib import is a deferred `descriptors`, so it adds no module-scope registry importer and joins no cycle. |
| `test_213_gate55_execution.py` MCP fixture | no `discovered_tools` | snapshot declaring `jira_create_issue` | See the behaviour note below. |
| `test_213_approval_moment.py::_conn`, `test_mcp_connector_client.py` MCP fixture | no `discovered_tools` | same | Without it the grant-gate cases would have gone green for the **wrong reason** — a schema refusal one gate later, not an approval. |

- **Commit:** `a09715a0f`

### An intended behaviour change, stated as one rather than buried

**The MCP arm no longer sends `dict(tool_args)` raw.** It projects onto the bound tool's
declared schema, so an undeclared stored key is dropped before the wire (pinned by
`test_an_mcp_step_with_a_snapshot_projects_onto_the_declared_schema_and_sends`), and a
connection whose snapshot cannot answer for the tool **RECORDS** instead of sending. The plan
mandates this (⛔ *"a `None` schema must NOT fall back to sending `tool_args` raw"*). It is
recorded here because it is the only place a *published* MCP workflow's observable behaviour
changes — narrowly, in the safe direction, and only where the publish gate refuses the same
case as `shape_unknown`.

### Design choices the interfaces left open

**`schema=None` on `_adapter_args` is a compatibility arm, not the production path.** The plan
says the native site must not read `adapter.INPUT_SCHEMA`, and separately that
`test_190_ssti_fence.py` must still pass — but that suite calls `_adapter_args` with a **stub
adapter whose declaration deliberately differs from Slack's** (`text` + `channel`, against the
real schema's `text` alone) and asserts on both keys. Deriving the schema inside `_adapter_args`
would have broken it. Resolution: the production call site passes the accessor's answer
explicitly; a `schema=None` call falls back to the *handed* adapter's declaration. That keeps
`grep -c "INPUT_SCHEMA"` at its HEAD value of `1` (the compatibility arm is the one read, and it
is not on the production path), and the AST case above proves the executor obtains its schema
from the accessor on both shapes.

**`body_arg` exempts the body field from `no_source`, and only from that.** The plan puts
`body_arg` in `unsatisfiable_arguments`' signature but no bullet uses it. The only reading that
is not dead code: the executor auto-fills that field from the upstream text, so reporting it as
unsourced would refuse at publish a step that can in fact send — D-214-00's drift pointing the
direction that costs an author a working workflow. An unrenderable or explicitly mis-sourced
body field is still a gap.

**The three arms are spelled twice.** `models/harness.py` states it must not import a service,
so `ArgumentSourceKind` exists in both the model and the leaf. The agreement is asserted
mechanically (`test_the_models_three_arms_equal_the_services_three_arms`), the same mechanism
the `capability` Literal / `EXTERNAL_ACTION_CAPABILITIES` pair already uses.

## The ROADMAP's carried-forward `{{prior_run.*}}` flag — DISCHARGED, in writing

The flag: *"`{{prior_run.*}}` misses `llm_emit` — if STEP-02's argument plumbing reuses that
resolver, the same gap applies."* **Re-verified at execute time, not inherited from the plan's
sentence.** Verbatim grep output:

```
$ grep -n "_interpolate_prior_run_variables" backend/app/services/harness/phase_types.py
207:def _interpolate_prior_run_variables(text: str, prior_run: dict | None) -> str:
703:    _raw_prompt = _interpolate_prior_run_variables(phase.config.prompt, getattr(ctx, "prior_run", None))
779:    _raw_prompt = _interpolate_prior_run_variables(phase.config.prompt, getattr(ctx, "prior_run", None))
876:    _raw_prompt = _interpolate_prior_run_variables(phase.config.prompt, getattr(ctx, "prior_run", None))

$ grep -rn "_interpolate_prior_run" backend/app/services/connectors/args.py
(0 lines)
```

The definition plus three call sites, each passing `phase.config.prompt`. It takes **prompt
text**; it never touches `tool_args`, `arg_sources` or any argument object; and the
`external_action` path does not call it at all. **The argument path this plan builds does not
route through it and gains none of its gap.** No call to it was added from `resolve_arguments`
or from either `_adapter_args` call site — a `{{ }}` resolver on the argument path would be the
second, undeclared mechanism D-214-02 refused.

⚠ The discharge is **executable**, not prose: `test_the_argument_path_does_not_route_through_
the_prompt_text_resolver` pins the site count at 4, asserts the leaf never names the resolver,
and asserts by AST that its caller set is exactly `{_exec_llm_single, _exec_llm_agent,
_exec_llm_batch_agents}` with `_exec_external_action` absent. A flag closed by a sentence is a
deletion that looks like a decision; this register's own findings keep catching exactly that.

## Threat register — dispositions applied

| Threat | Disposition | Where it landed |
|---|---|---|
| T-214-01-01 Tampering — `ask_key` / `upstream_slug` | mitigate | `field_validator` on `^[A-Za-z0-9_][A-Za-z0-9_.-]{0,63}$`, refusal names the field and the key. **Driven RED** over 14 planted non-name values (URL, scheme-relative, `host:port`, `user@host`, whitespace, tab, newline, leading dash/dot, empty, 65 chars, `/`, `\`) with an 8-value positive control. |
| T-214-01-02 EoP — projection onto a schema | mitigate | `resolve_arguments` walks the schema's declared properties. Pinned by the `cc`-against-`smtp_adapter` case (leftover ⇒ no gap, and dropped before the wire) and by the MCP `assignee` case. |
| T-214-01-03 Info disclosure — LLM text → vendor argument | mitigate | The `upstream` arm passes the named phase's WHOLE output; no field selection, no expression language. `_adapter_args`' D-09 sentence survives verbatim. |
| T-214-01-04 Repudiation — the receipt | accept | `_write_send_receipt`'s key set untouched; the plan's diff does not enter that function. |
| T-214-01-05 Spoofing — two arms at once | mitigate | `model_validator`, **driven RED** on both directions. |
| T-214-01-SC — package installs | mitigate | **No packages installed.** `args.py` imports only `logging`, `collections.abc`, `typing`, `__future__`, plus one deferred in-repo `descriptors`. `models/harness.py` gained stdlib `re` only. |

## Known Stubs

None. Every export is implemented and driven; there is no placeholder, no empty return that is
not a stated fail-closed answer, and no `TODO`.

## Threat Flags

None. This plan opens no network endpoint, no auth path and no file access, and adds no schema
at a trust boundary. The one NEW trust edge (`upstream` — LLM output reaching a vendor as a
named argument) was already in the plan's register as `T-214-01-03` and is mitigated there.

## Self-Check: PASSED

Created files, verified present:

```
FOUND: backend/app/services/connectors/args.py
FOUND: backend/tests/unit/test_214_args_leaf.py
FOUND: backend/tests/unit/test_214_arg_source_field.py
```

Commits, verified in `git log`:

```
FOUND: 304c8910d  feat(214-01): the argument leaf — resolution, satisfiability, and ONE schema accessor
FOUND: fb830f216  feat(214-01): ExternalActionPhaseConfig.arg_sources — a stored, validated per-argument source
FOUND: a09715a0f  refactor(214-01): re-point phase_types at the argument leaf — both shapes, one accessor
```

No file deletions in any of the three commits (`git diff --diff-filter=D HEAD~1 HEAD` empty each
time). No untracked residue. `STATE.md` and `ROADMAP.md` untouched, as the orchestrator requires.
