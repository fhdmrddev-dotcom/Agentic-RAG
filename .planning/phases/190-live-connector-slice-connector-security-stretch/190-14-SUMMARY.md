---
phase: 190-live-connector-slice-connector-security-stretch
plan: 14
subsystem: backend-security
tags: [source-fence, ssti, d-05, d-04, d-09, d-32, conn-03, wave-5, property-not-patch, plants]

# Dependency graph
requires:
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 08
    provides: "the ConnectorAdapter protocol, the closed registry with its module-scope D-04 assert, and the banned-token tuple this plan generalised"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 10
    provides: "jira_adapter.py, and the credential-ENCODING vocabulary hand-off (case-insensitive)"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 11
    provides: "slack_adapter.py, and the explicit instruction to SCOPE the credential-header fence rather than apply 190-10's tree-wide"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 13
    provides: "_exec_external_action — the ordered send path this plan drives end to end for T9"
provides:
  - "test_190_connector_source_fence.py — the standing D-05 no-transport walk over connectors/**, expressed as a PROPERTY (no transport is imported, no attribute read off one) rather than as six substrings"
  - "The D-04 closed-registry proof: key set derived from EXTERNAL_ACTION_CAPABILITIES, asserted on SOURCE as well as by equality"
  - "190-08's promise kept with a date on it — all three capabilities resolve to an importable adapter claiming its own key"
  - "The SCOPED credential-encoding fence: slack_adapter.py exempt BY NAME, its replacement drives asserted to EXIST"
  - "test_190_ssti_fence.py — SC#3 PROVED, not built: no evaluator on the connector path, and a composed field driven to render LITERALLY through the real executor"
  - "D-32's scope fence as a tripwire: 3 capabilities, 7 phase types, 1 new config field, no expression-shaped field name, no retry/backoff/sleep/queue"
  - "A tripwire on a latent import cycle measured here and deliberately not fixed (deferred-items.md)"
affects: [190-secure-phase, 190-verify]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Express a banned-token fence as the PROPERTY the token stands for, then prove with a control that every literal token in the contract still fires — a substring fence both under-fires (`import requests` contains none of the six tokens) and over-fires on prose"
    - "Scope a fence by NAME with the reason written down, and assert the EXISTENCE of the replacement fence — an exemption pointing at a fence nobody checked is a hole with a comment over it"
    - "Plant once per WALK ROOT, not once per fence: three roots, three plants, so the walk's reach is proved by observation rather than by its own non-vacuity assertion"
    - "Delegate rather than duplicate a tree-wide fence, and assert the delegate still exists"
    - "Convert a defect you are not entitled to fix into a tripwire on the condition that keeps it unreachable"

key-files:
  created:
    - backend/tests/unit/test_190_connector_source_fence.py
    - backend/tests/unit/test_190_ssti_fence.py
  modified:
    - .planning/phases/190-live-connector-slice-connector-security-stretch/deferred-items.md

key-decisions:
  - "D-05's six literal tokens were REPLACED by seven property matchers, and the replacement is only admissible because the control proves it is a superset: each of the six tokens still fires inside a line of real source. The substring form was measured to be wrong in both directions — `import requests` contains none of the six, and a docstring sentence ending '...the number of requests.' contains one"
  - "The credential-header fence is SCOPED to a named exemption rather than applied tree-wide (190-11's hand-off, honoured literally). Measured before the fence was written: `Authorization` appears exactly twice under the package, both in slack_adapter.py, so a tree-wide ban would have been RED on correct code from its first commit — and a fence that is RED on correct code is deleted, taking the Jira half with it"
  - "SC#3 is stated as PROVED, not BUILT. 190 added no evaluator; the fence is over an existing property. Over-claiming here would be the exact failure mode the external_action node type exists to avoid"
  - "`idempot` is deliberately absent from the D-18 re-attempt vocabulary: three shipped prose lines carry the word on the CONTINUATION of a sentence whose D-18 citation is on the line above. Including it would make the fence RED on correct code — the prose-vs-fence conflict this phase hit four times"
  - "The latent import cycle discovered here was NOT fixed. It was created by 190-08 + 190-13, this plan is test-only under D-32, and the scope-boundary rule says log it. It got a tripwire instead of a fix: the sole-importer condition is asserted, so the fence turns RED on the commit that makes the cycle live"

# Metrics
duration: ~75 min
tasks_completed: 2
tests_added: 19
plants_driven: 6
completed: 2026-08-09
---

# Phase 190 Plan 14: The Three Fences That Guard Properties Rather Than Patches — Summary

**Two test files, nineteen tests, six plants — the D-05 no-transport walk, the D-04 closed
registry, and SC#3 proved by NOT adding an evaluator.**

---

## The one sentence this plan exists to say

**SC#3 was PROVED, not BUILT.**

Phase 190 added no evaluator. It did not build a sandbox, did not harden a renderer and did
not mitigate anything to earn CONN-03 SC#3. `_adapter_args` is a closed two-column lookup —
the upstream phase's text goes into one named argument per capability, every other resolved
input is projected onto the adapter's declared schema or dropped, and there is no syntax, no
interpolation and no `{{ }}` anywhere on the path. The shipped
`SandboxedEnvironment(autoescape=True)` at `template_render_service.py:657` and
`tool_dispatcher.py:2473` was written by Phase 101, not by this one.

So what shipped is a **fence over an existing property**, and both the module docstring and
this summary say so rather than claiming a mitigation. D-09 required exactly that:

> *"SC#3's proof is therefore largely a fence over an existing property, and the plan must say
> so rather than claiming to have built something."*

---

## Property, not patch — what each fence actually asserts

The Phase-185 lesson binds (CONTEXT D-28): *a deny-list cannot be made fail-closed by
extension.* Every fence below asserts a property in its own docstring, and the difference is
not cosmetic — in one case it was measured to change the verdict.

| # | Fence | The PATCH version (rejected) | The PROPERTY that shipped |
|---|---|---|---|
| 1 | D-05 no-transport | "`httpx.` does not appear" | *no transport module is imported and no attribute is read off one, in any spelling* |
| 2 | D-04 closed registry | "the key set equals the capability set" | *the key set is DERIVED from it — `registry.py` must import the frozenset by name* |
| 3 | capability resolution | "three module paths are listed" | *every capability imports a real adapter that claims its own key and declares a schema* |
| 4 | credential encoding | "no `Authorization` header anywhere" | *no adapter hand-builds an ENCODED credential; the one file whose vendor auth IS a bearer header is exempt by name and fenced on the stronger property instead* |
| 5 | SC#3 source | "`eval(` is not called" | *no evaluator of any kind exists on the connector path — and no Jinja environment that is not the sandboxed one* |
| 6 | SC#3 behaviour | — | *a composed field arrives at the adapter as the author wrote it* |
| 7 | D-32 scope | "there are three capabilities today" | *a fourth capability, an 8th phase type, an expression-shaped config field or any re-attempt machinery turns this RED* |
| 8 | Jinja regression | "these two lines exist" | *every `Environment(` construction under `backend/app` is the sandboxed one* |

### Where the distinction changed the verdict

**The D-05 substring fence was measured wrong in BOTH directions**, which is why it was
replaced rather than lifted:

- **It under-fires.** `import requests` — the line that makes `requests.` possible at all —
  contains none of D-05's six tokens. A module could import every transport in the standard
  library and the substring fence would report green.
- **It over-fires on prose.** These modules are ~65 % docstring. A sentence ending
  *"...to cap the number of requests."* contains `requests.` verbatim.

So each token became a property matcher, and the positive control then proves **all six of
D-05's literal tokens still fire**, each inside a line of real source. The contract is met by
a superset, and the superset is driven rather than asserted.

---

## The six plants — every fence observed RED against real production source

**A fence you did not observe failing is not a fence.** Six plants, each a real line in real
production source, each restored **md5-identical**, each restore in a `finally` (190-08's
lesson: its harness aborted on a subprocess error and left production planted).

### PLANT A — `httpx.AsyncClient()` in `slack_adapter.py`

md5 `e0474ecad3d18b95278abf310b5fbcb4` → planted `c77fb1c9b6b7a7698270748e1aa1e52a` →
restored `e0474ecad3d18b95278abf310b5fbcb4` ✅ identical

```
E       AssertionError: D-05: a module under backend/app/services/connectors/ references a transport directly. Every socket must come from `app.security.egress`, whose binders validate and PIN the destination; a client built here is guarded by nothing.
E         app/services/connectors/slack_adapter.py:341: an attribute read off `httpx` — client = httpx.AsyncClient(timeout=10.0)  # PLANT-A
E       assert ['app/service...)  # PLANT-A'] == []
FAILED tests/unit/test_190_connector_source_fence.py::test_no_connector_module_names_a_transport
1 failed, 7 deselected
```

Note what fired: the plant carried **no `import httpx`**, and the attribute-read matcher
caught it anyway. That is the property working.

### PLANT B — a FOURTH key in `registry.py`

md5 `c4d498656ebd37e1fa33f2e81e74f501` → planted `64347ed5458ccdaac94d4eea159a4129` →
restored `c4d498656ebd37e1fa33f2e81e74f501` ✅ identical

`_ADAPTERS` gained `"send_sms": "app.services.connectors.twilio_adapter"`. The result is
**stronger than "test 5 RED"** and is recorded as what it was: the whole pytest session
**aborted at collection**, because the D-04 assert fires while `conftest.py` imports
`app.main`:

```
ImportError while loading conftest 'C:\Vibe Apps\Agentic RAG\backend\tests\conftest.py'.
tests\conftest.py:107: in <module>
    from app.main import app  # noqa: E402
...
app\services\harness\phase_types.py:94: in <module>
    from app.services.connectors.registry import get_adapter
app\services\connectors\registry.py:59: in <module>
    assert set(_ADAPTERS) == set(EXTERNAL_ACTION_CAPABILITIES), (
E   AssertionError: D-04: the adapter registry's key set disagrees with EXTERNAL_ACTION_CAPABILITIES (['send_sms']). The capability set is CLOSED and has one runtime home; a registry key with no capability is an adapter no step can ever reach, and a capability with no registry key is a step that resolves to nothing at send time
```

**Stated precisely rather than flatteringly:** `test_the_registry_key_set_is_derived_not_retyped`
did **not** report RED, because with a fourth key nothing in the app can be imported at all —
no test runs. That is D-04 working exactly as its docstring promises (*"an `AssertionError` at
import, which is a failure nobody can miss and nobody can defer"*) and it is D-32's scope fence
at its bluntest: a fourth capability is a phase, not a dictionary entry.

A second observation from the same plant, recorded because it is the seed of the deferred item
below: `python -c "import app.services.connectors.registry"` fails with a **circular-import**
`ImportError` rather than the D-04 assert, because that import order opens the cycle before the
assert is reached.

### PLANT C — an unsandboxed `Environment(` in `phase_types.py` *(walk root 1)*

md5 `bb7c4ed6614434bbcac495657ac330f2` → `055ab76bcd48d1e5809e5fb65d414cd8` → restored
`bb7c4ed6614434bbcac495657ac330f2` ✅ identical

```
E       AssertionError: SC#3 / D-09: an evaluator appeared on the connector send path. This phase's entire SSTI answer is that no expression is ever evaluated here — a composed field is a closed two-column lookup, not a template. Found:
E         app/services/harness/phase_types.py:1975: an unsandboxed Jinja Environment — jenv = Environment(autoescape=True)  # PLANT-C
FAILED tests/unit/test_190_ssti_fence.py::test_no_unsandboxed_jinja_environment_exists_on_the_connector_path
```

### PLANT D — a bare `eval(` in `slack_adapter.py` *(walk root 2)*

md5 `e0474ecad3d18b95278abf310b5fbcb4` → `062653c36f400308c7d0539817f6d87a` → restored
`e0474ecad3d18b95278abf310b5fbcb4` ✅ identical

```
E         app/services/connectors/slack_adapter.py:341: a bare `eval(` — return eval(expression)  # PLANT-D
FAILED tests/unit/test_190_ssti_fence.py::test_no_unsandboxed_jinja_environment_exists_on_the_connector_path
```

### PLANT E — a `__import__` in `egress.py` *(walk root 3)*

md5 `5284827f9c0be6baee9945694c246d9f` → `cf6dc27b5dd50376ea096c78f0007219` → restored
`5284827f9c0be6baee9945694c246d9f` ✅ identical

```
E         app/security/egress.py:331: `__import__` — return __import__(name)  # PLANT-E
FAILED tests/unit/test_190_ssti_fence.py::test_no_unsandboxed_jinja_environment_exists_on_the_connector_path
```

**Why three plants for one fence.** 190-13's lesson was a fence whose preconditions were never
set, so it *could not have fired*. One plant proves a matcher works; it does not prove the walk
reaches every root. C, D and E are one per root — `harness/phase_types.py`,
`connectors/**`, `security/egress.py` — so the reach is proved by observation rather than by
the fence's own non-vacuity assertion.

### PLANT F — `SandboxedEnvironment(` → `Environment(` at the shipped construction site

md5 `7cb089c56dbff3555a5f4db3f9a895ae` → `17cccb6a39e1065c102cfbae201dce6e` → restored
`7cb089c56dbff3555a5f4db3f9a895ae` ✅ identical **(driven twice — see below)**

**⭐ THIS PLANT CAUGHT THE FENCE BEING INERT, AND IT IS THE MOST USEFUL THING IN THIS PLAN.**

On the first run only the *tree-wide* half fired. The *named-site* half —
`assert "SandboxedEnvironment(autoescape=True)" in text` — **still passed**, satisfied by the
**docstring eighteen lines above** the construction, which quotes the string while constructing
nothing. That is 190-02's lesson verbatim (*a docstring is a string literal, not a comment*),
and it was completely invisible until the plant ran.

Run 1 (fence inert on the named-site half):

```
E       AssertionError: an unsandboxed Jinja environment exists under backend/app. ...
E         app/services/template_render_service.py:657: jenv = Environment(autoescape=True)  # SSTI containment + XML-safe (&<>)  # PLANT-F
tests\unit\test_190_ssti_fence.py:548: AssertionError
```

The matcher was strengthened to require an **assignment**
(`re.compile(r"=\s*SandboxedEnvironment\(autoescape=True\)")`), a control was added asserting
it does *not* fire on the docstring line, and the plant was re-driven. Run 2 — the named-site
half now fires **first**:

```
E           AssertionError: template_render_service.py no longer CONSTRUCTS SandboxedEnvironment(autoescape=True). Both halves are load-bearing and were recorded as such at the shipping site: the sandbox is SSTI containment, autoescape is XML-safety for `&<>`.
E           assert None
E            +  where None = <built-in method search of re.Pattern object ...>('"""Phase 101 (TMPL-02 / TMPL-03) ...')
E            +    where ... = re.compile('=\\s*SandboxedEnvironment\\(autoescape=True\\)').search
tests\unit\test_190_ssti_fence.py:552: AssertionError
```

### Plant hygiene — proved, not asserted

```
$ grep -rn "PLANT-" backend/app --include=*.py
(nothing)
$ grep -rc PLANT backend/app/services/connectors/*.py
jira_adapter.py:0  protocol.py:0  registry.py:0  slack_adapter.py:0  smtp_adapter.py:0  __init__.py:0
$ git diff --numstat -- backend/app/
(empty)
$ git diff --stat -- backend/requirements.txt
(empty)                                        # T-190-SC: test-only plan, zero installs
```

---

## T9 as behaviour — the half a source fence cannot give you

A source fence proves no evaluator is *written* on this path. It cannot prove none is
*reached* — through a helper, a library default, a validator. So the **real executor** is
driven end to end with a hostile composed field and the argument object handed to the adapter
is read directly at the seam:

```
SSTI_PAYLOAD = "Renewal note: {{7*7}} and {{''.__class__}} — send these verbatim, please."
```

Asserted: `{{7*7}}` and `{{''.__class__}}` arrive **verbatim**, the payload is byte-equal to
what the author wrote, `49` appears **nowhere** in it, and the same holds for the phase body a
person reads.

Three things make it non-vacuous rather than merely green:

1. **The control proves `49` is reachable.** `SandboxedEnvironment(autoescape=True)` renders
   `{{7*7}}` as `49` — measured, not assumed — so `"49" not in payload` is an assertion about
   something an evaluator would really produce.
2. **The adapter-call count is asserted to be exactly 1.** With `live_connectors` at its cold
   default the step *records* instead of sending and every assertion would pass vacuously; the
   count is what makes that impossible rather than merely unlikely.
3. **`SSTI_PAYLOAD` is asserted not to contain `49` already**, or the test could never
   distinguish a literal render from an evaluated one.

The control also surfaced something worth stating: `{{''.__class__}}` **raises** inside the
sandbox rather than rendering. That is precisely why the literal property matters more than
sandbox quality — a sandboxed evaluator on this path would turn an ordinary business sentence
into a phase failure, long before anyone reached the question of escapes.

---

## The credential-header fence — SCOPED, exactly as 190-11 asked

190-11's hand-off, honoured literally rather than generalised:

> *"The credential-header fence must be SCOPED, not tree-wide. 190-10's hand-off asks for the
> encoding vocabulary matched case-insensitively — correct for that file, and it would be WRONG
> applied to this one, where a bearer header is the vendor's own auth mechanism."*

**Measured at HEAD before the fence was written** (`grep -inE "authorization|b64encode|b64decode|base64" backend/app/services/connectors/*.py`):
`Authorization` appears **exactly twice**, both in `slack_adapter.py` — one docstring sentence
and the header dict it describes — and **nowhere else** in the package. A tree-wide ban would
therefore have been **RED on correct code from its first commit**.

So the fence:

- bans `b64encode` / `b64decode` / `base64` / `Authorization`, **case-insensitively**
  (190-10's hand-off), across the package;
- exempts `slack_adapter.py` **by name**, with the reason written into the constant's docblock;
- **asserts the replacement fence EXISTS** — `test_190_slack_ok_false.py` must still define
  `test_the_token_is_sent_in_the_HEADER_not_in_the_body` and
  `test_the_bot_token_never_appears_in_a_failure`. 190-13's lesson is that an exemption
  pointing at a fence nobody checked is a hole with a comment over it.

---

## The 189 acronym fence — untouched and still green

Both new files live under `backend/tests/`, and the 189 fence walks `backend/app` only
(`_APP_ROOT = _BACKEND_ROOT / "app"`, verified at HEAD). No production prose was written by
this plan, so there was no prose-vs-fence conflict to rewrite this time — the fifth recurrence
of that shape did not happen.

```
$ pytest tests/unit/test_189_no_egress.py -q -k mcp
2 passed, 21 deselected
```

Its continued green is part of D-01's evidence that this phase built no client for that
protocol, and `test_the_D32_scope_fence_holds_on_the_canvas_and_on_the_send_path` **delegates**
to it rather than duplicating it — asserting the delegate still exists, so a delegation cannot
quietly point at nothing.

---

## Deviations from Plan

### 1. [Rule 2 — missing critical fence] The credential-encoding fence was added to Task 1

**Found during:** Task 1.
**Issue:** `190-14-PLAN.md` Task 1 lists five tests and does not mention a credential fence at
all, while 190-10 and 190-11 both hand one off to this plan by name and the executor's phase
rules require it to be scoped.
**Fix:** added `test_the_credential_encoding_matcher_actually_matches` (control) and
`test_no_adapter_hand_builds_an_encoded_credential_EXCEPT_where_the_vendor_requires_it`.
**Why it is in scope:** it is a fence, not a capability — D-32 permits fences only, and this is
one.
**Files:** `backend/tests/unit/test_190_connector_source_fence.py`. **Commit:** `8d3ff9d0`.

### 2. [Rule 2] D-05's six substrings replaced by seven property matchers

**Found during:** Task 1. **Issue:** the substring tuple lifted from 190-08/190-10 both
under-fires (`import requests`) and over-fires (prose). **Fix:** property matchers, with the
control proving all six contract tokens still fire. **Commit:** `8d3ff9d0`.

### 3. [Rule 1 — inert fence] PLANT F caught the named-site Jinja assertion passing on a docstring

**Found during:** Task 2 plant round. **Fix:** matcher requires an assignment; a control
asserts it does not fire on the docstring; plant re-driven until both halves went RED.
**Commit:** `d191dd64`.

### 4. [Rule 3 → deferred] The in-process lazy-import test mutated `sys.modules`

**Found during:** Task 2 verification. The first draft of
`test_the_registry_module_constructs_nothing_at_import` deleted `app.services.connectors.*`
from `sys.modules` — global interpreter state, mutated mid-session, to measure a property about
a *fresh* interpreter. Rewritten as a subprocess probe. **Commit:** `d191dd64`.

### 5. [Scope boundary — logged, NOT fixed] A latent import cycle on the connector registry

Rewriting (4) as a subprocess immediately exposed a real defect:

```
$ python -c "import app.services.connectors.registry"
registry.py:38            from app.services.harness.grounding import EXTERNAL_ACTION_CAPABILITIES
harness/__init__.py:22    from . import phase_types
phase_types.py:94         from app.services.connectors.registry import get_adapter
ImportError: cannot import name 'get_adapter' from partially initialized module
             'app.services.connectors.registry' (most likely due to a circular import)
```

Unreachable in production for exactly one **measured** reason: `phase_types.py:94` is the
**only** importer of the registry anywhere under `backend/app`. Importing the harness first —
the app's real order — works and loads **zero** vendor adapter modules, which is the lazy
property 190-08 promised and which is now driven.

**Not fixed here.** The cycle was created by 190-08 + 190-13, this plan is test-only under
D-32, and the scope-boundary rule says log it. Logged to `deferred-items.md` with a concrete
re-open trigger — and given a **tripwire** instead of a fix: the sole-importer condition is
asserted literally, so the fence turns RED on the commit that makes the cycle live.

---

## Measured numbers (re-derive, do not inherit)

| Quantity | Command | Value |
|---|---|---|
| connector `.py` modules | `ls backend/app/services/connectors/*.py \| wc -l` | **6** |
| SSTI walk roots | `connectors/**` + `egress.py` + `phase_types.py` | **8 files** |
| app `.py` files (tree-wide Jinja fence floor) | `rglob("*.py")` under `backend/app` | **170** (189's fence recorded 160 at *its* plan time) |
| `Environment(` under `backend/app` | `grep -rn "Environment(" backend/app --include=*.py` | **4** — 2 constructions, 2 prose, all `Sandboxed` |
| `jinja2` imports under `backend/app` | `grep -rn "^\s*from jinja2\|^\s*import jinja2"` | **4** — 2× `TemplateSyntaxError`, 2× `jinja2.sandbox` |
| `Authorization` under the package | `grep -inE "authorization\|b64..." connectors/*.py` | **2**, both `slack_adapter.py` |
| pre-190 `ExternalActionPhaseConfig` fields | `git show 09808f6d^:backend/app/models/harness.py` | `phase_type`, `capability`, `available_tools` |
| fields added by 190 | — | **1** (`connection_id`) |
| registry importers under `backend/app` | `grep -rn "connectors.registry" backend/app --include=*.py` | **1** import + 1 docstring mention |
| new tests | — | **19** (8 + 11) |

---

## Verification

| Check | Result |
|---|---|
| `pytest tests/unit/test_190_connector_source_fence.py tests/unit/test_190_ssti_fence.py -q` | **19 passed, 0 failed** |
| `pytest tests/unit/test_189_no_egress.py -q` (the acronym fence) | **23 passed** |
| Positive control is the FIRST `def test_` in each file | `:156` source fence · `:145` ssti fence ✅ |
| `grep -c "sendmail" test_190_connector_source_fence.py` | **6** (≥ 1 required) |
| module docstring contains `added no evaluator` | **1 occurrence** ✅ |
| `ExternalActionPhaseConfig` field probe | prints `['connection_id'] []` ✅ |
| `grep -rn "PLANT-" backend/app --include=*.py` | **nothing** |
| `git diff --numstat -- backend/app/` | **empty** |
| `git diff --stat -- backend/requirements.txt` | **empty** (T-190-SC) |
| **Full backend suite WITH the new files** | `211 failed, 3561 passed, 19 skipped, 5 xfailed, 9 xpassed, 1 error` |
| **Full backend suite WITHOUT the new files** (baseline) | `211 failed, 3542 passed, 19 skipped, 5 xfailed, 9 xpassed, 1 error` |
| Δ | **+19 passed, +0 failed** — zero new failures, measured rather than assumed |

The 211 pre-existing failures are the known-rotted backend suite (SEED-049 / the recorded
"backend suite baselines — neither scope is a regression backstop" finding). They were measured
on both sides of this change rather than inherited: the delta is exactly the 19 tests this plan
added.

---

## Hand-offs

| To | What |
|---|---|
| **190-secure-phase** | Six of the fourteen falsification rows now have a standing fence with a driven RED behind it: **D-05**, **D-04**, **T9** (source *and* behaviour), plus D-32's scope tripwire. All plants restored md5-identical with the verbatim RED recorded above — no re-driving needed |
| **190-secure-phase** | ⚠ The credential-header fence is **scoped, and must stay scoped**. `slack_adapter.py` is exempt BY NAME because a bearer header is Slack's own auth mechanism; do not "complete" the fence by removing the exemption — it would be RED on correct code |
| **190-verify** | SC#3's claim is *"proved, not built"*. If a verification pass expects a mitigation artefact for SC#3, there is none by design and D-09 says so |
| **the next phase touching `connectors/**`** | The D-05 walk now covers the whole package, including modules that carry no adapter today. A new adapter needs no new fence — but it MUST route every socket through `app.security.egress`, and it inherits the D-18 per-line rule (a line naming retry/backoff/sleep/queue must cite `D-18`) |
| **SEED-013 / Open Platform** | The registry's latent import cycle is the first thing that plan will hit — it needs to import `connectors.registry` from outside `phase_types`, which is exactly the tripwire's condition. `deferred-items.md` names two cuts |

## Known Stubs

None. This plan created no production code and no UI; both files are tests over shipped
behaviour.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or schema was introduced —
`git diff --numstat -- backend/app/` is empty and `backend/requirements.txt` is untouched.

---

## Self-Check: PASSED

- `backend/tests/unit/test_190_connector_source_fence.py` — FOUND (527 L)
- `backend/tests/unit/test_190_ssti_fence.py` — FOUND (637 L)
- `.planning/.../190-14-SUMMARY.md` — FOUND
- `.planning/.../deferred-items.md` — FOUND (import-cycle entry appended)
- commit `8d3ff9d0` — FOUND
- commit `d191dd64` — FOUND
