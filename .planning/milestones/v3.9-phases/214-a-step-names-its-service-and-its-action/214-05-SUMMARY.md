---
phase: 214-a-step-names-its-service-and-its-action
plan: 05
subsystem: publish gate / reachability lint / validate severity taxonomy
tags: [publish-gate, argument-satisfiability, STEP-03, D-214-00, D-214-09, D-214-10, D-214-11, D-214-12, BUG-260826-02]
requires:
  - backend/app/services/connectors/args.py::unsatisfiable_arguments
  - backend/app/services/connectors/args.py::schema_for_bound_tool
  - backend/app/services/connectors/args.py::resolve_arguments
  - backend/app/services/connector_service.py::resolve_connection
provides:
  - backend/app/services/harness/reachability.py::ARGUMENT_GAP_CODES (the five, published)
  - backend/app/services/harness/reachability.py::lint_workflow(definition, *, tool_schemas=None)
  - backend/app/services/harness/reachability.py::LintError.step_name/.argument/.upstream
  - backend/app/services/harness/publish_service.py::_bound_tool_schemas
  - backend/app/services/harness/publish_service.py::_golden_run_argument_failures
  - "the named_failures wire contract plan 214-10 reads (6 keys)"
affects:
  - "214-10 (the refusal surface) — consumes the 6-key named_failures entry"
  - "214-14 S-2b — asserts schema provenance across the module boundary"
  - "214-15 — owes reachability.py a hot-file ledger row: it now FIRES at 4 phases with no row"
tech-stack:
  added: []
  patterns:
    - "the shared-predicate precedent already won in publish_service for business_requirement_missing"
    - "a second spelling of a closed map, held by a MECHANICAL agreement test (models/harness.py's ArgumentSourceKind pattern)"
    - "value fences and AST fences instead of raw-text greps (the 187-24 trap)"
key-files:
  created:
    - backend/tests/unit/test_214_publish_arg_gate.py
  modified:
    - backend/app/services/harness/reachability.py
    - backend/app/services/harness/publish_service.py
    - backend/app/api/workflows.py
    - backend/tests/unit/test_182_severity_codes.py
    - backend/tests/unit/test_publish_service.py
decisions:
  - "Stage 2 was EXTENDED, not given a sibling stage — one lint stage, one _block, one blocked_stage, so sketch 215 invariant #8 stays trivially true."
  - "The D-214-11 golden-run check blocks at the EXISTING `structural_gate` stage; a new blocked_stage value would be a stage the refusal surface cannot name."
  - "`tool_schemas=None` (the caller never looked) is a different fact from `{}` (we looked and found nothing). /validate passes None and skips the MCP arm; PUBLISH always passes a map."
  - "The plan's gate/resolver `iff` is REFUTED by measurement — the binding claim is the implication, and both counter-rows are deliberate."
  - "A resolved value of the wrong type reports `no_source`; the five-kind vocabulary is compiler-enforced on the client and is not this plan's to widen."
metrics:
  tasks: 2
  commits: 2
  new-tests: 28
  duration: ~2h
  completed: 2026-08-28
---

# Phase 214 Plan 05: The Publish Argument Gate Summary

Publish now refuses a step whose required argument nothing can supply — naming the step in the
author's own words and the argument in the vendor's — by calling the **same predicate the
executor resolves with**, and the golden run additionally validates the object it actually
resolved without sending anything.

## What shipped

| Task | Commit | What |
|---|---|---|
| 1 | `c08d37a85` | the five codes, the check inside the ONE ordered walk, both registries, the strengthened drift detector |
| 2 | `1bbf09849` | the stage-2 block, the `tool_schemas` builder through the ONE accessor, D-214-11's golden-run check |

## The three things the plan asked this summary to record

### 1 · The observed RED of `test_182_severity_codes.py` — and why the plan's version of it could not have happened

The plan says: *"Run it FIRST, before adding the codes, and observe it go RED — a pairing test
that was never seen firing is a pairing test nobody has verified."*

**It was run first. It was GREEN, with all five emit sites already in the file.** That is the
finding, and it is a defect in the guard rather than in the plan:

```
$ python -c "<the test's own _LINT_EMIT_RE, over reachability.py>"
literal LintError emit sites scanned:
  ['bad_index', 'input_unsatisfied', 'no_terminal', 'orphan_phase', 'unsatisfiable_skip']
```

Five, while `lint_workflow` could really emit ten. `_LINT_EMIT_RE` is
`LintError\(\s*"([a-z_]+)"` — it requires the code to be a **string literal** at the call site,
and STEP-03's five are emitted as `LintError(gap.kind, ...)` because the kind is minted by
`args.unsatisfiable_arguments`. Re-typing the five as literals to satisfy the scanner would have
created the second copy D-214-00 exists to prevent, so the scanner was fixed instead of the code.

`test_lint_codes_match_the_reachability_emit_sites` now asserts over **both emit routes**:

```python
assert (scanned | minted) == set(reachability.LINT_CODES)
assert minted == set(get_args(ArgumentGapKind))     # and the minted half is not a literal either
assert scanned and minted and scanned.isdisjoint(minted)   # neither half can absorb the other
```

**Driven RED against exactly the defect the plan wanted to see, with the codes emitted and
unregistered** — verbatim:

```
E  AssertionError: DRIFT: a lint_workflow code was added or removed without updating
   reachability.LINT_CODES. Symmetric difference:
   ['ask_undeclared', 'no_source', 'shape_unknown', 'unrenderable', 'upstream_unreachable'].
FAILED tests/unit/test_182_severity_codes.py::test_lint_codes_match_the_reachability_emit_sites
1 failed, 8 passed
```

Then green in the commit that registered them: `9 passed`.

⚠ **This blindness is older than this plan.** Any code minted from an expression has been
invisible to that detector since Phase 182, and the detector is the only thing standing between
a new lint code and `_severity`'s fail-loud unknown branch.

### 2 · The exact `named_failures` key set — plan `214-10` reads this

An entry for one of the **five argument-gap codes** carries **six keys**:

```python
{"code": "ask_undeclared",              # one of the five ArgumentGapKind strings
 "phase": "notify-abc123",              # the SLUG — this is how the canvas highlights the node
 "message": "step 'Email the customer': the required argument 'to' is asked for at launch, "
            "but the workflow declares no matching input",
 "step_name": "Email the customer",     # the AUTHORED name, _clean_label-scrubbed and clamped
 "argument": "to",                      # the schema property name; None for shape_unknown ONLY
 "upstream": None}                      # the named slug on upstream_unreachable; None otherwise
```

- **The backend composes no English refusal.** `message` is the diagnostic for the log and the
  `harness_audit` receipt; sketch 215 §1 owns the author-facing sentence and asserts it for
  character identity in `publishRefusalVocabulary.test.ts`.
- **`step_name` never carries the slug** except for a phase with no authored name at all, where
  the two coincide — pinned by `test_a_phase_with_no_authored_name_degrades_to_its_slug`.
- **The other four stages are byte-unchanged.** The three extra keys ride only the five codes,
  pinned by `test_a_structural_lint_failure_keeps_its_shipped_three_key_payload`.
- **`blocked_stage` gains no new value.** A stage-2 refusal is `"lint"`; the D-214-11 golden-run
  refusal is `"structural_gate"`, an existing value.

### 3 · Stage 2 was EXTENDED, not given a sibling stage — and why

CONTEXT leaves this to discretion; only *cheap and before the golden run* is binding. A sibling
stage would have been ~14 lines and equally cheap. Extending keeps **one lint stage, one
`_block` call and one `blocked_stage` value**, so the refusal surface gains no stage to render
and **sketch 215 invariant #8 (exactly one blocked stage) stays trivially true rather than newly
argued**. The ordering rationale reproduced in the comment is stage 2.6's own: this check needs
what `/validate` needs — the definition and the server-side registries — plus one connection read
for the MCP shape, and nothing whatsoever from a run.

## Acceptance criteria — measured

| Criterion | Measured | |
|---|---|---|
| `test_182_severity_codes.py` green after, observed RED before | `9 passed` / `1 failed, 8 passed` | ✅ |
| `LINT_CODES` ⊇ the five | `['ask_undeclared','bad_index','input_unsatisfied','no_source','no_terminal','orphan_phase','shape_unknown','unrenderable','unsatisfiable_skip','upstream_unreachable']` | ✅ |
| `_KNOWN_RUN_INPUT_KEYS` not widened | diff lines touching its `=`: **0** (see the note below) | ✅ |
| `grep -c "def _check_"` +1 exactly | `1` → `2` | ✅ |
| `grep -c "for p in sorted(phases"` unchanged | `2` → `2` (ONE walk) | ✅ |
| MCP tool with no entry in `tool_schemas` → exactly one `shape_unknown`, not `[]` | asserted, plus the "connection present / tool absent" arm | ✅ |
| `grep -c "schema_for_bound_tool"` in `publish_service.py` ≥ 1 | **5** | ✅ |
| `reachability.py` import-light (no `harness_engine` in `sys.modules`) | subprocess probe: `['clean', 'clean']` | ✅ |
| `test_214_publish_arg_gate.py` ≥ 9 cases | **28** | ✅ |
| one case per refusal kind (literal count) | `no_source` 7 · `ask_undeclared` 3 · `upstream_unreachable` 3 · `shape_unknown` 5 · `unrenderable` 2 | ✅ |
| `shape_unknown` asserts `argument is None` | asserted twice (both absence arms) | ✅ |
| the refusal payload contains no slug in `step_name` | asserted at unit AND publish level | ✅ |
| the agreement case imports both and mocks neither | AST: **zero** mocking identifiers in the function | ✅ |
| short circuit: `golden_run_id is None`, `blocked_stage == "lint"`, drive not called | asserted | ✅ |
| no new adapter `send(` in the `publish_service.py` diff | added lines matching `\.send(`: **0** | ✅ |
| `pytest tests/unit -q` ≤ 68 failed | **68 failed / 2993 passed** (baseline 68 / 2965) | ✅ |

### The two criteria that could not be met literally, and what was done instead

**(a) `git diff -- reachability.py | grep -c "_KNOWN_RUN_INPUT_KEYS"` is 0 — measured `1`.**

The one occurrence is **this plan's own new comment at the definition site**, recording CONTEXT
failure mode #10 so the next reader meets the rule where the constant lives. This is exactly the
187-24 trap the brief names: *an acceptance criterion that greps raw text counts its own prose.*
Both measurements are published:

```
git diff -U0 | grep -cE '^[-+].*_KNOWN_RUN_INPUT_KEYS *='   ->  0   (the ASSIGNMENT is untouched)
git diff    | grep -c  '_KNOWN_RUN_INPUT_KEYS'              ->  1   (the added comment)
```

The criterion's purpose is asserted as a **value** instead —
`test_the_allowlist_was_not_widened` pins `_KNOWN_RUN_INPUT_KEYS == frozenset({"kickoff_prompt",
"topic"})`, which no comment can satisfy.

**(b) `grep -cE "INPUT_SCHEMA|discovered_tools"` in `publish_service.py` shows no NEW occurrence
against the baseline — baseline `0`, measured `3`, and `0` is unreachable.**

`schema_for_bound_tool`'s parameter is **keyword-only and spelled `discovered_tools`**, so *every*
call to the sanctioned accessor's MCP arm increments this grep. The three occurrences, each
attributed:

| Line | Occurrence | What it is |
|---|---|---|
| 630 | `discovered_tools=snapshot` | the accessor's own keyword — the sanctioned path |
| 666 | `getattr(resolved, "discovered_tools", None)` | reading the snapshot off `ResolvedConnection` to FEED that accessor |
| 798 | `discovered_tools=None` | the accessor's native arm (no connection read at all) |

The criterion's stated purpose — *"the map is built through `schema_for_bound_tool`, not by
reading either directly"* — is asserted by **AST**, which is strictly stronger than the grep (a
grep counts a keyword; the AST counts an extraction):

```
no ast.Attribute named "INPUT_SCHEMA"      anywhere in publish_service.py
no ast.Subscript on the constant "inputSchema"  anywhere in publish_service.py
+ a teeth assertion that the scan really does see this module's attributes and subscripts
```

Same shape 214-01 used for its own unmeetable criterion.

## Deviations from Plan

### Auto-fixed

**1. [Rule 1 — Bug] The `test_182` drift detector is blind to a non-literal lint code**

- **Found during:** Task 1, running the plan's own "observe it RED" step.
- **Issue:** `_LINT_EMIT_RE` matches only string-literal `LintError("code", ...)` sites. Five new
  reachable codes left it green. Present since Phase 182, for any code minted from an expression.
- **Fix:** the detector now asserts `scanned | ARGUMENT_GAP_CODES == LINT_CODES`, that
  `ARGUMENT_GAP_CODES` equals `args.ArgumentGapKind`'s members, and that both halves are non-empty
  and disjoint.
- **Files:** `backend/tests/unit/test_182_severity_codes.py`
- **Commit:** `c08d37a85`

**2. [Rule 3 — Blocking] Two shipped V20 fixtures were themselves unsatisfiable steps**

Neither file is in the plan's `files_modified`; both were made red *by the gate working*.

| Fixture | Refused as | Repair |
|---|---|---|
| `_external_action_definition_dict` (`send_email`) | `no_source` × 2 (`to`, `subject`) | `tool_args` supplied. `body` deliberately still absent — it is the capability's body argument, so its absence is now a live assertion that the D-214-03 exemption works |
| `_mcp_external_action_definition_dict` (`read_wiki_structure`) | `shape_unknown` | bound to a connection whose `discovered_tools` snapshot declares the tool, patched at `connector_service.resolve_connection` — the same repair 214-01 applied to four shipped MCP fixtures |

⚠ **Both refusals were CORRECT and are `BUG-260826-02`'s own shape**: a `send_email` step with no
arguments publishes today and dies at the send with `the 'to' recipient must be a string, got
NoneType`. The fixtures were demonstrating the defect while asserting the opposite. **D-06 and
D-206.3-01 are unchanged** — an external-action workflow still publishes and its step still
records — so the repair was to make the steps satisfiable, never to weaken the gate. The verbatim
refusals are quoted at each fixture so the next reader meets the reason rather than a mystery.

- **Files:** `backend/tests/unit/test_publish_service.py`
- **Commits:** `c08d37a85` (native), `1bbf09849` (MCP)

**3. [Rule 3 — Blocking] `_block_all_http` intercepted the test harness, not the code**

- **Found during:** Task 2, wiring the no-send fence.
- **Issue:** the shipped fence patches `socket.socket.connect` last, and on Windows `asyncio.run`
  builds a proactor loop whose self-pipe calls exactly that: `socket.socket.connect was called -
  outbound egress attempted ... proactor_events.py:787 in _make_self_pipe`.
- **Fix:** the loop is constructed **before** the fence and passed in as a `runner`. This is the
  ordering hazard the fence's own docstring warns about; it is now recorded at the call site.
- **Files:** `backend/tests/unit/test_214_publish_arg_gate.py`
- **Commit:** `1bbf09849`

### Design choices the plan left open, or that measurement forced

**⭐ THE PLAN'S GATE/RESOLVER `iff` IS REFUTED, AND THE COUNTER-EXAMPLES ARE KEPT AS A CASE.**
The plan asks the agreement case to assert *"gate returns `[]` **iff** the resolver produces a
value for every required property"*. Driven against the shipped predicates, the `<==` direction
is FALSE on two rows, and **both are deliberate**:

1. **The legacy run-input fallback.** `resolve_arguments`' no-entry arm reads `tool_args` **then**
   `run_inputs` (214-01's own Rule-1 fix, without which every pre-214 workflow silently stops
   sending). The gate does not credit it: a value that happens to arrive in the launch bag is not
   a *declared source*, and STEP-03's whole point is that the author says where each argument
   comes from. Nothing is retroactive — the published row keeps running; the **next** publish must
   declare.
2. **An `ask` arm the launcher leaves blank.** The gate proves the key is DECLARED, which is all
   D-214-09 asks; whether a person typed anything is a run-time fact. That gap is precisely what
   D-214-11 exists for.

So the binding assertion is the **implication** — `gate clean ==> the resolver produces every
required property, given a launch that honours the arms the gate proved` — which *is* CONTEXT
failure mode #3 ("passes the gate, then fails at the send"). The converse would be "refused
something that might have worked", which costs an author an edit rather than shipping a broken
publish. `test_the_converse_does_not_hold_and_both_exceptions_are_deliberate` keeps the two rows
as evidence so nobody later "fixes" the gate to match the resolver and re-opens `BUG-260826-01`.

⚠ The run context is **derived from the config**, not hand-written per row: hand-writing it lets a
row quietly withhold something the gate promised and turn a sound implication into a failure that
is really about the fixture.

**`tool_schemas=None` means "the caller never looked" and skips the MCP arm.** Within a SUPPLIED
map a missing entry is `shape_unknown` and blocks (T-214-05-01). `/validate` runs on every canvas
keystroke and cannot resolve connections, so it supplies nothing — this is the shipped division of
labour `publish_service`'s own docblock states (*advisory* vs *enforcing*), not a loophole, and
`test_a_caller_that_never_looked_is_not_entitled_to_conclude_unknown` pins both arms side by side.
⚠ Without this, every MCP step would paint a red `shape_unknown` on the canvas on every keystroke
and grey the Publish control for a perfectly bound workflow.

**A wrong-typed resolved value reports `no_source`.** The five-kind vocabulary has no "wrong type"
member, and minting a sixth is a cross-plan, cross-language change (`publishRefusalVocabulary.ts`
keys a compiler-enforced `Record` on the union, and each kind owns a hand-authored sentence).
`no_source` is the honest reading — *nothing supplied a usable value* — and the type detail rides
`message` into the log and the receipt. Recorded as a deliberate narrowing.

**The D-214-11 block reuses `structural_gate`.** A new `blocked_stage` value would be a stage the
refusal surface cannot name (sketch 215 §1 ships four stage words), and the failure genuinely
belongs to the golden run's own gate: the run produced an argument object its action cannot accept.

**A second spelling of `_BODY_ARG_FOR_CAPABILITY`, held mechanically.** `reachability` must stay
import-light for `/validate`, and that map sits beside a module-scope `assert` closing over
harness-engine names, so it cannot be imported. `test_the_body_argument_map_equals_the_executors_map`
asserts the two are equal — the same mechanism `models/harness.py` uses for `ArgumentSourceKind`
and for the capability `Literal`.

**The org read was extracted.** `_definition_org_id` is now the ONE implementation, called by both
`_resolve_publish_supabase` and the argument gate — so the gate scopes its connection reads
without constructing a third service-role client per publish (which would have compounded the
IN-05 deferral recorded at stage 2.6).

**Only MCP-shaped steps trigger a connection read.** A workflow whose external steps are all
native performs **zero** extra I/O in stage 2, because a native schema is a pure descriptor lookup
`reachability` performs itself through the same accessor.

## Threat register — dispositions applied

| Threat | Disposition | Where it landed |
|---|---|---|
| T-214-05-01 EoP — an absent schema treated as satisfied | mitigate | A missing entry in a SUPPLIED map is `shape_unknown` and BLOCKS. Two cases: `tool_schemas={}` and connection-present/tool-absent; plus `test_an_unreadable_connection_refuses_rather_than_passes`, which makes the real `resolve_connection` raise and asserts the refusal rather than `[]` |
| T-214-05-02 Tampering — a hostile `inputSchema` weakening the gate | mitigate | `test_an_adversarial_schema_grants_nothing`: `required: []` + `additionalProperties: true` produces no gaps AND grants nothing — `resolve_arguments` still projects onto declared properties, so a stored `secret_token` never reaches the object |
| T-214-05-03 DoS — the gate becoming expensive | mitigate | `test_a_refusal_short_circuits_before_the_golden_run`: `golden_run_id is None` and `_drive_golden_run` not called. Native steps read nothing; MCP steps read once per DISTINCT connection |
| T-214-05-04 Info disclosure — a refusal leaking an id or a host | mitigate | A VALUE fence over every field of every emitted `LintError`: no connection id, no `http`, no `@`. A key-set fence alone would miss a `message` that interpolates the id into prose |
| T-214-05-05 Repudiation — a block with no receipt | accept | `_safe_audit` unchanged; the plan's diff does not enter it. Recorded so the acceptance is deliberate rather than inherited |
| T-214-05-06 Tampering — the golden run sending for real | mitigate | `test_the_golden_run_argument_check_reaches_no_adapter_send` — the SHIPPED `_block_all_http` fence (httpx sync+async, smtplib, urllib, `socket.connect`) PLUS a raiser on all three adapters' `send`, so it fails whether the wire or merely an adapter is reached |
| T-214-05-SC — package installs | mitigate | **Nothing installed.** The only new import edges are in-repo: `reachability -> connectors.args` (module scope, stdlib-only leaf) and function-local `connector_service` / `db.workflows` / `models.thread` inside `publish_service` |

## G-5 disposition — RE-DERIVED FROM GIT AT EXECUTE TIME (2026-08-28, after both commits)

| File | Ledger cell | **Measured now** | Verdict |
|---|---|---|---|
| `backend/app/services/harness/publish_service.py` | 22 / 9 / 1223 | **23 / 10 / 1567** | fires — honoured by construction |
| `backend/app/api/workflows.py` | 38 / 19 / 2143 | **40 / 21 / 2192** | fires — ledger says *extraction due*, and this plan does NOT take it |
| `backend/app/services/harness/reachability.py` | *(no row at all)* | **4 / 4 / 463** | ⚠ **FIRES, AND IT HAS NEVER BEEN IN THE SCAN LIST** |

**`publish_service.py` — honoured by construction, argued.** The plan added **no stage**: no new
`_block` call site, no new `blocked_stage` value, no new branch in the six-stage flow — which is
exactly the shape its ledger section names as the thing to avoid. The `+344` lines are three
private helpers and their reasoning, not a sixth arm of the orchestration. The extraction it is
owed is neither taken nor obstructed.

**`api/workflows.py` — honoured by construction, and the argument is weaker so it is stated
plainly.** Its disposition reads *extraction due* and this plan does not take it. The diff is
confined to the severity taxonomy's **composed** registries: no literal was added to
`_KNOWN_CODES`, `_INCOMPLETE_CODES` or the derived `_ERROR_CODES` — the five join by composition
from `LINT_CODES`, which is the file behaving as designed. **The extraction stays OWED.**

⚠ **`reachability.py` HAS NO LEDGER ROW, and it now measures 4 phases — G-5 FIRES.** It is the
home of this phase's safety-gate predicate and it has been invisible to its own guardrail for its
entire life (091 / 093 / 182 / 214). Plan `214-15` owes it a row **and** its
`docs/HOT-FILE-LEDGER.md` section in the same commit, per the same-commit sync rule. This plan
does not add it — the ledger is `214-15`'s file and a parallel wave must not both edit CLAUDE.md.
⚠ The triple above is the one to copy; do not re-derive it from a stale cell, because there is
none.

## Known Stubs

None. Every branch is implemented and driven. The one deliberate no-op —
`_golden_run_argument_failures` returning `[]` for a phase with no `recorded_intent` — is a stated
fail-open on a step that never ran, not a placeholder: accusing it would refuse a publish over a
branch the golden run skipped.

## Threat Flags

None. This plan opens no network endpoint, adds no auth path, no file access and no schema at a
trust boundary. It ADDS one read (`connector_connections` via the shipped org-scoped
`resolve_connection`) on a path that already reads folders, skills and the definition, and that
read is fail-closed in the refusing direction.

## Self-Check: PASSED

Created files, verified present:

```
FOUND: backend/tests/unit/test_214_publish_arg_gate.py
FOUND: .planning/phases/214-a-step-names-its-service-and-its-action/214-05-SUMMARY.md
```

Commits, verified in `git log`:

```
FOUND: c08d37a85  feat(214-05): the argument-satisfiability lint — five codes, one predicate, two registries
FOUND: 1bbf09849  feat(214-05): publish blocks on an unsatisfiable argument, and the golden run checks its own
```

No file deletions in either commit (`git diff --diff-filter=D HEAD~1 HEAD` empty both times). No
untracked residue. `STATE.md` and `ROADMAP.md` untouched, as the orchestrator requires.
