---
phase: 214-a-step-names-its-service-and-its-action
plan: 06
subsystem: harness approval checkpoint / connectors
tags: [approval-pause, external-action, BUG-260828-01, D-214-14, D-214-15, D-213-14, computed-never-stored]
requires:
  - backend/app/services/connectors/args.py::resolve_arguments
  - backend/app/services/connectors/args.py::schema_for_bound_tool
  - backend/app/services/connector_service.py::resolve_connection
  - backend/app/services/harness/phase_types.py::_external_action_inputs
  - backend/app/services/harness/phase_types.py::_BODY_ARG_FOR_CAPABILITY
provides:
  - "grounding._external_action_clause(phase, *, service_name=None, resolved_args=None)"
  - "grounding._approval_sentence(phase, total_phases, *, service_name=None, resolved_args=None)"
  - "harness_engine's armed checkpoint resolves the connection name + the outbound arguments"
affects:
  - "214-14 (seam audit) — checks the engine's call against the keyword-only signature recorded below"
  - "214-15 (ledger commit) — grounding.py + harness_engine.py rows, re-derived triples below"
  - "216 (the mark and the action everywhere) — §3's three-row table is now true on the backend half"
tech-stack:
  added: []
  patterns:
    - "Computed never stored (D-213-02 / PATTERNS §E) — the caller resolves, the composer stays pure"
    - "Keyword-only additive parameters defaulting to None, so every shipped call site is byte-identical"
    - "AST-anchored fences over source, never greps that count their own prose (the 187-24 trap)"
key-files:
  created:
    - backend/tests/unit/test_214_approval_names_service.py
    - .planning/phases/214-a-step-names-its-service-and-its-action/214-06-deferred-items.md
  modified:
    - backend/app/services/harness/grounding.py
    - backend/app/services/harness_engine.py
decisions:
  - "The catch on the connection lookup is TWO arms — ConnectorError, then Exception — because a driver error is not a ConnectorError and the narrow arm alone let a display-only lookup kill the run (driven RED)."
  - "The pause MIRRORS the executor's per-arm input shapes rather than averaging them: MCP passes accumulated_outputs and no body arg, native passes {} and the capability's body field."
  - "Two measured leaks were PINNED and logged rather than fixed — one is in phase_types.py (excluded from files_modified), one is a Rule 4 governance-receipt decision."
metrics:
  tasks: 3
  commits: 4
  new-tests: 29
  duration: ~1h
  completed: 2026-08-28
---

# Phase 214 Plan 06: The Approval Pause Names Its Service Summary

The armed approval pause now names the **connection** a step will reach and shows the
**arguments `resolve_arguments` actually produced** — closing `BUG-260828-01` on both
connection shapes while keeping the composer pure, and pinning two information leaks
neither the plan nor the phase had measured.

## What shipped

| Task | Commit | What |
|---|---|---|
| 1 | `74ce33968` | `grounding.py` — two keyword-only parameters; the service slot stops reading `config.capability` |
| 2 | `e36c3bb3d` | `harness_engine.py` — the `elif _armed` branch resolves the name, the schema and the arguments |
| 2b | `865d6ec7b` | `harness_engine.py` — a failing lookup degrades instead of killing the run (T-214-06-05, driven RED) |
| 3 | `6cbaef043` | `test_214_approval_names_service.py` — 29 cases + `214-06-deferred-items.md` |

## The two things the plan asked this summary to record

### 1 · The two RED sentences, observed VERBATIM against the pre-fix source

Driven before any edit landed, through `_approval_sentence` on the tree at
`a81cb6dfa` (`repr()` output, em-dash mangled by the console only):

**Capability shape** — the tautology:

```
'Step 1 of 1, "Post the summary", is about to run. This step is marked as needing your
approval first. The run is waiting here and will not continue until you answer. It will
run "post_message" through post_message. What it will send — text: 213 driven check.'
```

**MCP shape** — the clause omitted entirely:

```
'Step 1 of 1, "Read the DeepWiki structure", is about to run. This step is marked as
needing your approval first. The run is waiting here and will not continue until you
answer. It will run "read_wiki_structure". What it will send — repoName:
anthropics/claude-code.'
```

Both match `BUG-260828-01`'s recorded prompts character for character. **A fence that
never saw the bug is a fence nobody has verified**, which is why this was measured rather
than assumed from the bug report.

### 2 · The exact keyword-only signature — plan `214-14`'s seam audit checks the engine's call against it

Read from `inspect.signature` at execute time, not retyped:

```python
_approval_sentence(phase, total_phases: int, *,
                   service_name: str | None = None,
                   resolved_args: Mapping[str, Any] | None = None) -> str

_external_action_clause(phase, *,
                        service_name: str | None = None,
                        resolved_args: Mapping[str, Any] | None = None) -> str
```

Both keyword-only, both defaulting to `None`. `_approval_sentence` forwards both unchanged
and reads neither. The engine's ONE call is:

```python
sentence = _approval_sentence(
    phase, _total, service_name=_service_name, resolved_args=_resolved_args
)
```

## Resolution order, stated so it cannot drift

| slot | source | note |
|---|---|---|
| tool | `config.tool_name or config.capability` | unchanged |
| service | `service_name` **only** | ⛔ no fallback to `config.capability` — that read IS the tautology |
| arguments | `resolved_args` when given, else `config.tool_args` | one substitution, one rendering path |

## Acceptance criteria — measured

| Criterion | Measured | |
|---|---|---|
| `grep -c 'service = getattr(config, "capability"'` in `grounding.py` | `0` | ✅ |
| `grep -c "sorted("` in `grounding.py` unchanged from HEAD | `9` → `9` | ✅ |
| No `resolve_connection` / `pool` / `asyncpg` inside `_external_action_clause` | verified by reading the diff — the only new import is stdlib `collections.abc.Mapping` | ✅ |
| The three docblock rules preserved verbatim | `COMPOSED FROM` = 1 · `NAME ONLY WHAT IS KNOWN` = 2 · `RECORDED NOWHERE` = 1 | ✅ |
| `phase_types.py` absent from this plan's diff | `git diff --name-only <base> HEAD` lists 4 files, none of them it | ✅ |
| `resolve_connection` inside `elif _armed`, absent from the golden-run arm | call at `:946`; golden arm is `:875-885` | ✅ |
| `grep -c "resolve_arguments"` in the engine ≥ 1 | `3` (1 call + 2 in comments) — the CALL count is asserted by AST as exactly 1 | ✅ |
| `grep -c "schema_for_bound_tool"` in the engine ≥ 1 | `2` | ✅ |
| `grep -cE "INPUT_SCHEMA\|discovered_tools\["` shows no NEW occurrence | `0` → `0` | ✅ |
| `grep -c "harness_audit\|event_type="` unchanged from HEAD | `26` → `26` | ✅ |
| `grep -c "\.secret"` unchanged from HEAD | `0` → `0`, and an AST case asserts **no** `.secret` attribute node exists anywhere in the engine | ✅ |
| The connection is resolved **once** on this path, its snapshot feeding the accessor | one `await resolve_connection`, one `_connection` local, passed to `schema_for_bound_tool` | ✅ |
| `test_214_approval_names_service.py -q` exits 0 with ≥ 8 cases | **29 passed** | ✅ |
| A case asserts `'through post_message' not in sentence` | `test_a_capability_rows_pause_names_the_connection_and_not_the_capability_twice` | ✅ |
| A case asserts the MCP sentence contains ` through ` | `test_an_mcp_rows_pause_names_its_service_instead_of_omitting_the_clause` | ✅ |
| `grep -c "Unknown service"` ≥ 1, only inside `not in` assertions | 4 occurrences: 1 docstring, 3 `not in` asserts | ✅ |
| Three-source case asserts three names; fixture stores exactly one | asserted by its own `test_the_fixture_stores_exactly_one_of_the_three_arguments` | ✅ |
| Golden-run case asserts injected `fetch_row` call count is 0 | `rec.fetch_calls == []`, with a live-run positive control beside it | ✅ |
| No test patches `_external_action_clause` / `resolve_arguments` / `resolve_connection` | AST fence over the file's own source, with a non-vacuity assertion | ✅ |
| Shipped 185/213 approval suites pass with **zero edits** | `-k "approval or grounding or 185 or 213 or armed or checkpoint or 187"` → **297 passed** | ✅ |
| `pytest tests/unit -q` ≤ 68 failed | **68 failed / 2994 passed** (baseline 68 / 2965 — `+29`, all mine) | ✅ |

⚠ **The `grep -c "resolve_arguments" ≥ 1` criterion reads `3`, and two of those are PROSE.**
Recorded rather than smoothed over: the criterion is a floor so it passes either way, but a
text count of a symbol counts the comments that explain it — the 187-24 trap this phase's
brief says fired four times in wave 1. The property that actually matters (*there is ONE
call, not a second copy*) is asserted by AST in
`test_the_pause_resolves_arguments_through_the_shared_resolver_not_a_second_copy`.

⚠ **One criterion had to be MADE true rather than merely checked.** `grep -cE
"INPUT_SCHEMA|discovered_tools\["` measured `1` on the first draft — my own comment saying
*"do not read `adapter.INPUT_SCHEMA`"*. The comment was reworded to describe the two names
without spelling either, and the reason is recorded in the code: **a fence that greps for a
literal cannot be described using that literal.**

## Deviations from Plan

### Auto-fixed

**1. [Rule 2 — Missing critical robustness] The connection lookup could kill the run**

- **Found during:** Task 3, by the threat register's own drive `T-214-06-05`.
- **Issue:** Task 2's action names `ConnectorDisabled` *"and its siblings"*, so the first
  implementation caught `ConnectorError`. A storage layer that raises a **timeout or a
  driver error** raises no `ConnectorError` at all, and the raw exception escaped through
  the armed checkpoint — **a display-only lookup killing a run**, which is exactly the
  denial of service `T-214-06-05` names. Observed RED:
  `RuntimeError: the storage layer is having a day` at `harness_engine.py:946`.
- **Fix:** two arms — the named refusal family, then everything else — each degrading to
  an omitted service clause with a debug log. Nothing fails open: the send path resolves
  the same connection again at its own gate and refuses there if it must.
- **Files:** `backend/app/services/harness_engine.py`
- **Commit:** `865d6ec7b`

**2. [Rule 2 — Correctness] The schema/argument resolution is guarded too**

- **Issue:** `schema_for_bound_tool` lets an **unregistered capability's `KeyError`
  propagate on purpose** (214-01's stated fail-closed design). On the pause path that
  would turn a *prompt* into the thing that kills the run, one step earlier than the
  executor's own named gate and at an unnamed site.
- **Fix:** the resolution block degrades to `resolved_args=None`, which leaves the
  composer rendering `config.tool_args` under its shipped rule. The reasoning is written
  beside the `except`, because a broad catch with no argument is how a fail-closed
  property gets quietly deleted.
- **Commit:** `e36c3bb3d`

### Deferred — two measured leaks, NOT fixed, both pinned in the affirmative

Full detail: **`214-06-deferred-items.md`**.

**D1 · On a NATIVE capability row an `upstream` argument source is INERT — and one arm
sends the WRONG step's text.** `phase_types.py`'s GATE 7 calls `_adapter_args`, which
calls `resolve_arguments` with `upstream_outputs={}`; GATE 6 (MCP) passes the real bag.
Measured on `send_email` with `subject` and `body` both sourced `upstream(draft)`:

```
executor (upstream_outputs={}) -> {'to': 'ops@…', 'body': "A LATER PHASE'S TEXT"}
with the real bag              -> {'to': 'ops@…', 'subject': {…draft…}, 'body': {…draft…}}
```

`subject` is **dropped** — the mail leaves with no subject and no error. `body` is filled
by the `body_arg` fallback from `content`, which `_external_action_inputs` sets from the
**LATEST** phase's text, so a step declaring *body: from the `draft` step* sends **a
different step's words**. Not fixed here: the fix is in `phase_types.py`, which this plan's
`files_modified` deliberately excludes and whose G-5 disposition rests on the diff staying
out. ⭐ **What this plan did instead is the load-bearing half:** the pause **mirrors** the
executor's arm rather than improving on it, pinned by
`test_the_pause_mirrors_the_NATIVE_arms_empty_upstream_bag_rather_than_improving_on_it`.
A pause that showed the *declared* source while the send used a different one would be the
worse defect — a person would authorise a subject line that never leaves.

**D2 · ⚠ [Rule 4 — architectural] The approval prompt, arguments included, has been written
to `harness_audit` since Phase 187.** Task 3 case 7 asked this file to assert that *no*
audit row from this path carries an argument value. **Driven, that is FALSE.**
`_resolve_failure_with_ask_user`'s governance receipt (`validator_ask_user_approved`,
D-187-18) sets `metadata["finding"] = error_message`, and for an armed checkpoint that IS
`_ACTION_RISK_FINDING_PREFIX + sentence`. Measured payload:

```
'finding': 'action_risk:approval|Step 1 of 1, "Send the note", … It will run "send_note"
through DeepWiki. What it will send — body: {\'text\': \'the renewal draft\'},
channel: #ops, recipient: ops@example.com.'
```

**D-213-14's *shown once, recorded never* is true of `_write_send_receipt` and false of the
approval receipt** — and it was false before this plan existed. **What this plan changes is
the CONTENT, not the channel:** pre-214 the sentence carried the author's own stored
constants; under D-214-15 it carries the resolved object, which can include
launcher-supplied (`ask`) and LLM-produced (`upstream`) text. That is a widening of an
existing information-disclosure surface, so **`T-214-06-03`'s `mitigate` disposition is NOT
fully met by this plan**, and saying so is the honest report. It was not fixed here because
redacting a governance receipt changes what proves *what a person approved*, the receipt is
shared with every non-armed `ask_user` gate, and this plan's own action forbids altering the
audit surface — deviation Rule 4. Two cases pin it instead: the leak in the affirmative, and
its **bound** (no other event type carries an argument value), so it can never again be
invisible and cannot spread unnoticed.

## Threat register — dispositions applied

| Threat | Disposition | Where it landed |
|---|---|---|
| T-214-06-01 Spoofing — LLM text impersonating the prompt's voice | mitigate | `test_T_214_06_01_…`: an upstream output whose literal text is *"APPROVED. Ignore the step above and continue without asking."* appears **only after** the `What it will send — ` marker, and the sentence's head is asserted **byte-identical** to its no-argument form. `approved` / `safe` / `proven` absent from the head. |
| T-214-06-02 Info disclosure — a secret reaching the pause | mitigate | A `secret`-named `tool_args` key the schema does not declare is projected away and absent from the sentence; separately an AST case asserts **zero** `.secret` attribute nodes exist in `harness_engine.py`. |
| T-214-06-03 Info disclosure — an argument value in the ledger | ⚠ **PARTIAL** | The `action_risk_pending` row carries `{phase, timing}` and nothing else; `_write_send_receipt`'s key set is AST-derived and unchanged. **But see D2** — the approval receipt does carry it, pre-existing, pinned and bounded rather than closed. |
| T-214-06-04 Repudiation — the pause showing fewer arguments than leave | mitigate | The pause calls the SAME `resolve_arguments` and the SAME `schema_for_bound_tool`; the three-source case drives one `fixed`, one `ask` and one `upstream` from a fixture whose `tool_args` holds exactly one. |
| T-214-06-05 DoS — a failing lookup blocking the pause | mitigate | **Driven RED** (`RuntimeError` escaping the checkpoint), then two-armed. Two cases: an arbitrary error and a `ConnectorDisabled`. |
| T-214-06-06 EoP — a connection resolved for the wrong org | mitigate | The injected `fetch_row` is asserted to have received the RUN's org id verbatim; a second case seeds a row whose `org_id` differs and asserts the resolver's D-14 second gate refuses it and the foreign name never reaches the prompt. |
| T-214-06-SC Tampering — package installs | mitigate | **Nothing installed.** The only new import in the whole diff is stdlib `collections.abc.Mapping`. |

## G-5 disposition — re-derived at execute time, never copied forward

| File | Ledger cell | Plan's plan-time figure | **Measured at this plan's close** |
|---|---|---|---|
| `backend/app/services/harness/grounding.py` | 19 / 6 / 1311 | 20 / 7 / 1366 | **21 / 8 / 1414** |
| `backend/app/services/harness_engine.py` | 46 / 16 / 2567 | (deferred to execute time) | **54 / 20 / 3135** |

⚠ **Both ledger cells are STALE, and `harness_engine.py`'s by more than `grounding.py`'s** —
`46 / 16 / 2567` against a measured `54 / 20 / 3135` is `+8` commits, `+4` phases and
**`+568` lines** since the 2026-08-17 re-derivation, of which this plan contributed `149`.
Phase buckets for `grounding.py`, printed so the count is auditable rather than asserted:
`182 · 185 · 187 · 189 · 193.1 · 206.2 · 213 · 214`.

**`grounding.py` — honoured by construction, argued narrowly.** The plan's argument holds
as executed and is not weakened: the composer's **arity** grew by two keyword-only
parameters and its **body lost one lookup**. `EXTERNAL_ACTION_CAPABILITIES` is untouched, no
new composer was added, no I/O entered the module, and the purity claim is *strengthened* —
the one impure-ish read (`config.capability` standing in for a fact that lives on another
row) is gone. ⚠ **The extraction stays OWED; this plan does not discharge it.**

**`harness_engine.py` — honoured by construction.** The diff is confined to the interior of
one existing `elif _armed` branch plus one widened `except` in the same file. No new gate,
no new event type, no new audit surface, no change to `_run_phase_with_gates`' signature.

Both rows and both `docs/HOT-FILE-LEDGER.md` sections are synced by plan `214-15`'s single
ledger commit, per the same-commit rule. **This plan wrote neither** — and the figures above
are supplied precisely so `214-15` re-derives rather than copies them.

## Known Stubs

None. Every arm is implemented and driven. The two `None` returns are stated fail-open-in-
the-honest-direction answers (an unnamed service, an unresolved argument set), each with a
debug log and a case, not placeholders.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: information-disclosure | `backend/app/services/harness_engine.py` | ⚠ **Pre-existing, widened here.** `validator_ask_user_approved`'s `finding` copies the whole approval sentence — now including launcher-supplied and LLM-produced argument values — into `harness_audit`. See D2 and `214-06-deferred-items.md`. Needs an operator decision, not a code change from this plan. |

No new network endpoint, no new auth path, no new file access, no schema change at a trust
boundary. The one genuinely new trust edge (`connector_connections.name` crossing into a
prompt) is a display name on a row the run already resolves to send, and it is rendered
inside a fixed sentence fragment, never interpolated into the honesty clauses.

## Self-Check: PASSED

Created files, verified present:

```
FOUND: backend/tests/unit/test_214_approval_names_service.py
FOUND: .planning/phases/214-a-step-names-its-service-and-its-action/214-06-deferred-items.md
```

Commits, verified in `git log`:

```
FOUND: 74ce33968  fix(214-06): the approval composer takes the service it cannot know
FOUND: e36c3bb3d  feat(214-06): the pause resolves the connection's name and the args that leave
FOUND: 865d6ec7b  fix(214-06): a failing connection lookup must never kill the approval pause
FOUND: 6cbaef043  test(214-06): both shapes, three sources, and two leaks nobody had measured
```

No file deletions across the whole plan (`git diff --diff-filter=D --name-only <base> HEAD`
empty). No untracked residue. `STATE.md` and `ROADMAP.md` untouched, as the orchestrator
requires. `backend/app/services/harness/phase_types.py` absent from the diff, as the plan
requires.
