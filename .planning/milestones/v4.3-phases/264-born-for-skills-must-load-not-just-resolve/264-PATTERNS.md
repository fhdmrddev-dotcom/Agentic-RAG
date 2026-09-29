# Phase 264: Born-For Skills Must LOAD, Not Just Resolve — Pattern Map

**Mapped:** 2026-09-22
**Files analyzed:** 8 modification targets (0 new source files) + 4 new/extended test files
**Analogs found:** 8 / 8 modification targets (6 exact-shape, 2 partial); 4 / 4 test surfaces

RESEARCH.md §3 already gives the ordered edit list with line numbers — this file does not repeat
it. What follows is the **code shape** each edit should copy, quoted verbatim from the analog.

---

## File Classification

| File to modify | Role | Data flow | Closest analog (same file, prior addition) | Match quality |
|---|---|---|---|---|
| `backend/app/utils/skill_visibility.py` | utility (pure predicate) | transform (string/bool) | itself — D-264-01 adds a keyword to its own two functions | N/A — self-modification, precedent is elsewhere (see §2) |
| `backend/app/services/expert_service.py:290-360` | service | CRUD (delegated read) | its own D-263-06 disjunct, now retired into a delegation | exact — same function, shape changes from hand-rolled to delegated |
| `backend/app/services/tool_dispatcher.py` (`ToolContext` field + 4 call sites) | dispatcher / dataclass | request-response | `skill_instructions_override` field (`:174-182`) + its 4 `getattr(ctx, …)` reads | exact |
| `backend/app/services/agent_loop.py` (`RunContext` field + 2 `ToolContext` builds) | orchestrator / dataclass | request-response | `skill_instructions_override` field (`:257-264`) + its bind at `:1334` + both builds (`:2057`, `:2939`) | exact |
| `backend/app/services/run_producer.py` (`_resolve_thread_scoping` return + 2 `RunContext(` sites) | service | request-response | the existing 4-tuple return + its two unpack sites | exact (arity widening, not field-shape) |
| `backend/app/services/task_service.py:585-651` | service (sub-agent context) | request-response | `workflow_run_id=parent_ctx.workflow_run_id` propagation (`:627-631`) | exact |
| `backend/app/services/harness/phase_types.py:637` | service (harness ctx builder) | request-response | itself — **stays unchanged**, no field added | N/A — fence target, not an edit |
| `backend/app/services/harness/grounding.py:208,215` | service (workflow grounding) | transform | itself — **stays unchanged**, fenced negatively | N/A — fence target, not an edit |

| New test file (by SC#) | Role | Data flow | Closest analog | Match quality |
|---|---|---|---|---|
| SC#3 one-table, both-encodings fixture test | test (parametrized fixture) | batch/transform | `test_seed125_skill_visibility_filter.py` (full file) | exact |
| SC#2 "one home" AST/grep count fence | test (structural invariant) | static analysis | `test_260_expert_chat_scoping.py::test_agent_loop_closed_core_ast_invariant` (`:155-176`) | exact |
| SC#5 byte-identical-base-literal pin | test (relationship/pin) | static assertion | `test_263_drafter_output_fits_its_consumers.py` (relationship-not-value framing) + `test_seed125…` literals at `:38-40` | exact |
| SC#1 `_handle_load_skill` end-to-end, mocked supabase chain, non-author org member | test (integration-shaped unit test) | request-response | `test_142_load_skill_flag.py` (`_PassthroughQuery` / `_FakeSupabase` / `_make_ctx`) for the mock shape; `tests/integration/test_v3_4_org_isolation.py:918-996` for the scenario shape | exact for mock plumbing; exact for scenario intent (adapted from disjoint-org to same-org-non-author) |

---

## Pattern Assignments

### 1. The additive `ToolContext` / `RunContext` field — copy `skill_instructions_override`'s shape, verbatim

**Why this one, not `phase_whitelist` / `workflow_run_id` / `skill_snapshot`:** all five fields
share the "additive, default-`None`, byte-identical when unset" discipline, but
`skill_instructions_override` is the **only one of the five that is bound in the run_agent_loop
local scope AND threaded through BOTH `ToolContext` builds AND propagated onto `sub_ctx`** — the
exact three-site shape `born_for_bundle_id` needs (D-264-03, D1-D4 in RESEARCH §3.D). `skill_snapshot`
and `phase_whitelist` are harness-only (never bound in `run_agent_loop`'s local scope, never on the
`RunContext` dataclass at all — they live only on `ToolContext`, set by `_build_phase_tool_context`).
`workflow_run_id` is likewise harness-only. `skill_instructions_override` is the one field that
already exists on **both** dataclasses (`RunContext` AND `ToolContext`) and is bound to a local
before both builds — the identical carrier shape D-264-03 specifies.

**`RunContext` field declaration** (`backend/app/services/agent_loop.py:257-264`):
```python
    # Phase 135 (135-02 / SI-01) — ADDITIVE default-off skill-INSTRUCTIONS override
    # for the honest DRAFT re-eval (RESEARCH Pitfall #1). OFF by default (None) at
    # EVERY existing call site → Deep Mode byte-identical (the skill_catalog_override
    # default-off discipline above). None => _handle_load_skill queries the DB live
    # (current behavior, D-14/D-16 red line); a map {skill_name: instructions} =>
    # _handle_load_skill returns the DRAFT instructions for that skill (for the
    # re-eval) instead of the live skills-row body, WITHOUT touching the live skill.
    skill_instructions_override: dict[str, str] | None = None
```
Copy this comment SHAPE (phase/decision tag, "OFF by default… byte-identical", what `None` means,
what a real value means) for `born_for_bundle_id: "UUID | None" = None`, appended after
`scoped_folder_path` (`:270`) per RESEARCH A-D1. `RunContext` is `@dataclass(frozen=True)` — the
new field must be **hashable** (`UUID` is; see Pitfall 8.3), same constraint `skill_catalog_override`
(a frozen `tuple`, not a `list`) already had to satisfy.

**`ToolContext` field declaration** (`backend/app/services/tool_dispatcher.py:174-182`):
```python
    # Phase 135 (135-02 / SI-01) — ADDITIVE default-off skill-INSTRUCTIONS override
    # for the honest DRAFT re-eval (RESEARCH Pitfall #1). None on EVERY Deep-mode /
    # normal caller => _handle_load_skill returns row["instructions"] byte-identical.
    # A map {skill_name: instructions} (set ONLY by the re-eval WITH-arm RunContext,
    # threaded through both agent_loop ToolContext builds + the task_service sub_ctx)
    # => _handle_load_skill returns the DRAFT instructions for that skill WITHOUT
    # touching the live skills row. Same additive-default-off discipline as
    # phase_whitelist / workflow_run_id / skill_snapshot above.
    skill_instructions_override: dict[str, str] | None = None
```
`ToolContext` is a plain (non-frozen) `@dataclass`; append after `has_connection_retrieval: bool =
False` (`:185`, the current last field), per RESEARCH C1.

**Binding in the loop's local scope, once, before both builds** (`agent_loop.py:1331-1334`):
```python
    # Phase 135 (SI-01) — additive default-off skill-INSTRUCTIONS override (None =
    # DB live / Deep byte-identical; {skill_name: instructions} = the DRAFT re-eval,
    # Pitfall #1). Passed into BOTH ToolContext builds below (primary + resume).
    skill_instructions_override = ctx.skill_instructions_override
```
Copy verbatim in shape for `born_for_bundle_id = ctx.born_for_bundle_id` (RESEARCH D2, `:1334`).

**Threaded into the resume `ToolContext` build** (`agent_loop.py:2054-2057`):
```python
                # Phase 135 (SI-01) — a RESUMED re-eval must keep measuring the
                # DRAFT, not silently revert to the live skill (Pitfall #1 / D-05).
                # None on every Deep/normal resume => byte-identical load_skill.
                skill_instructions_override=skill_instructions_override,
```
**Threaded into the primary per-iteration `ToolContext` build** (`agent_loop.py:2936-2939`):
```python
                # Phase 135 (SI-01) — carry the DRAFT instructions override so the
                # re-eval WITH arm measures the draft's instructions (Pitfall #1).
                # None on every Deep/normal caller => byte-identical load_skill.
                skill_instructions_override=skill_instructions_override,
```
Both builds must get the new kwarg (RESEARCH D3/D4) — this is the exact two-site trap §8.6 names;
the `skill_instructions_override` precedent is *why* that trap is documented at all (the 135
comment at `:2054-2057` exists because that same mistake is easy to make).

**Propagation onto the sub-agent `sub_ctx`** (`backend/app/services/task_service.py:643-650`):
```python
        # Phase 135 (135-02 / SI-01) — propagate the DRAFT instructions override onto
        # the SUB-agent ctx (the SAME structural-unreachability class as the 096-02
        # phase_whitelist + 099 skill_snapshot fixes above): a re-eval whose WITH arm
        # dispatches the `task` tool must keep measuring the DRAFT inside the sub-agent,
        # not silently revert to the LIVE skill (Pitfall #1). None (every Deep-Mode /
        # tasks caller — the dataclass default) keeps it a literal no-op => byte-identical
        # Deep dispatch.
        skill_instructions_override=parent_ctx.skill_instructions_override,
```
This is D-264-05's exact copy target: `born_for_bundle_id=parent_ctx.born_for_bundle_id,` with a
comment naming the same "structural-unreachability" reason (a sub-agent dispatches with `sub_ctx`,
never `parent_ctx`, so an unpropagated field is dead on the live path — the 096-02 lesson this
comment itself cites).

**Reading the field at the dispatcher resolver, `getattr`-not-attribute** — the duck-typed-ctx
precedent (RESEARCH C2 names this explicitly). Two existing call sites already do this because test
suites build `ToolContext`-shaped stubs that may lack a field:
- `tool_dispatcher.py:1408` — `getattr(ctx, "skill_instructions_override", None)`
- `tool_dispatcher.py:1566` — `getattr(ctx, "skill_snapshot", None)` (seen above at `:1569` in the
  `_handle_read_skill_file` excerpt: `snapshot = getattr(ctx, "skill_snapshot", None)`)

Copy this `getattr(ctx, "born_for_bundle_id", None)` shape inside `_resolve_skill_visibility_or`
when `born_for=True` — never `ctx.born_for_bundle_id` directly.

---

### 2. Optional-keyword widening of a pure predicate/query-builder — **no exact analog; two partial ones**

No existing function in `backend/app/` adds a keyword-only optional parameter to a **pure
predicate/query-builder string function** with a documented "byte-identical to base when omitted,
provable by literal `==`" contract — `skill_visibility.py` would be the first. Two partial analogs,
neither identical in shape, are worth reading before writing the new signature:

**Partial analog 1 — `backend/app/services/harness/phase_types.py:457-485`, `_skill_block`:**
```python
def _skill_block(phase, ctx=None, *, with_files: bool | None = None) -> str:
    """099 WFSKILL-01 (D-05/D-06) — the delimited skill framing block, or '' when no snapshot.
    ...
    ``with_files`` controls the file manifest (D-07): on ``llm_single`` (``tools=[]``,
    ``read_skill_file`` inert) the file list is OMITTED — instructions only. When
    ``with_files`` is left ``None`` it is DERIVED from the phase shape ... so the helper
    composes correctly whether the caller passes the explicit kwarg (the three
    executor seams below) or not (the unit test passes ``(phase, ctx)`` positionally).
    """
    snap = getattr(phase.config, "skill_snapshot", None)
    if snap is None:
        return ""
    ...
```
Same package (`app/services/harness`), same "pure string builder, additive keyword, `None` means
'derive/no-op'" shape, and the docstring explicitly states the byte-identical-no-op case
(`snap is None => ""`). What it does NOT match: `with_files=None` still *derives a real value* and
changes output — it is not "omit the kwarg ⇒ output is provably identical to the pre-existing
function," which is `skill_visibility.py`'s SC#5 contract.

**Partial analog 2 — `backend/app/services/sources/failure_cause.py:186`, `classify_failure_cause`:**
```python
def classify_failure_cause(message: str | None, *, status_code: int | None = None) -> Cause:
    """Name the cause of a source failure, or say honestly that we do not know.
    ...
    """
    if message and _APP_CREDENTIALS_TELL.search(message):
        return "app_credentials_invalid"
    if status_code is not None:
        mapped = _STATUS_CAUSE.get(status_code)
        if mapped is not None:
            return mapped
    if not message or not message.strip():
        return "unknown"
    for cause, pattern in _MATCHERS:
        if pattern.search(message):
            return cause
    return "unknown"
```
Pure classifier, additive keyword-only param defaulting to `None`, clean `if x is not None:` guard
— structurally the closest to what `build_skill_visibility_or`'s `expert_bundle_id=None` guard
should look like. What it does NOT match: it is a classifier, not a query-string builder, and it has
no PostgREST/DSL-injection concern (no `coerce_uid`-equivalent), so it is not evidence for the
UUID-splice-safety half of D-264-01.

**Recommendation:** write `skill_visibility.py`'s new signature using `classify_failure_cause`'s
guard shape (`if expert_bundle_id is None: <base path>`) for the None-check discipline, and
`_skill_block`'s docstring shape (name the byte-identical case explicitly, name what a real value
changes) for the comment — but do not treat either as a literal template. This is genuinely new
territory in this codebase: a query-builder whose *default* arm must be provably byte-identical to
its pre-change self.

---

### 3. New test files

#### 3a. SC#3 — one parametrized fixture table drives BOTH encodings

**Analog:** `backend/tests/unit/test_seed125_skill_visibility_filter.py` (full file, 143 L) — this
IS the file the new born-for cases likely extend (D-264-07 says "one table," and this module
already carries the module-level docstring's contract *and* three existing born-for negative
cases at `:93-143`). Two things to copy exactly:

**The constants block** (`:31-33`, `:89-90`) — reuse verbatim so SC#5's frozen literal and the new
positive cases share the same fixture identities:
```python
_UID = "00000000-0000-0000-0000-000000000042"
_ORG_A = "11111111-1111-1111-1111-111111111111"
_ORG_B = "22222222-2222-2222-2222-222222222222"
...
_BUNDLE = "33333333-3333-3333-3333-333333333333"
_OTHER_USER = "99999999-9999-9999-9999-999999999999"
```

**The dual-encoding-in-one-test shape** (`:102-123`, `test_born_for_marker_does_not_widen_cross_org_visibility_row_encoding`) — the existing precedent for driving `skill_row_visible` directly against a
dict-shaped row, including the "same row minus the key" companion assertion that proves the column's
mere *existence* changes nothing:
```python
def test_born_for_marker_does_not_widen_cross_org_visibility_row_encoding():
    foreign_marked = {
        "is_system": False,
        "org_id": _ORG_B,
        "user_id": _OTHER_USER,
        "is_org_shared": True,
        "born_for_expert_bundle_id": _BUNDLE,
    }
    assert _skill_row_visible(foreign_marked, caller_id=_UID, org_ids={_ORG_A}) is False

    unmarked = dict(foreign_marked)
    unmarked.pop("born_for_expert_bundle_id")
    assert _skill_row_visible(unmarked, caller_id=_UID, org_ids={_ORG_A}) is False
```
D-264-07's new table should parametrize over rows shaped exactly like `foreign_marked` (dict keys,
not a real DB row) and assert `skill_row_visible(row, …)` against a **derived** expectation from
`build_skill_visibility_or`'s semantics for that row — the "change one, change both" contract made
executable, per RESEARCH §6.3 option 1.

**The retirement-not-deletion obligation (D-264-02)** — the exact comment block that must be
rewritten, quoted so nobody edits it silently, is `:126-142`
(`test_born_for_marker_does_not_admit_another_users_private_same_org_skill`), already reproduced in
264-CONTEXT.md §6.4. Its assertion **stays unchanged** (calls `skill_row_visible` with no
`expert_bundle_id` kwarg — the default path); only the docstring's *reason* is refuted and must be
rewritten in place, plus a **new sibling case** proving the same row IS admitted when
`expert_bundle_id=_BUNDLE` is passed.

#### 3b. SC#2 — "exactly one home" as a measured count, not an assertion

**Analog:** `backend/tests/unit/test_260_expert_chat_scoping.py:155-176`,
`test_agent_loop_closed_core_ast_invariant`:
```python
def test_agent_loop_closed_core_ast_invariant():
    """PACK-01 / EXT-01 / D-260-05: Closed-Core Invariant.

    agent_loop.py MUST NOT contain any branching on 'expert' or attribute/name check containing 'expert'.
    The loop executes purely on data (effective_folder_ids, effective_tools).
    """
    loop_path = APP_DIR / "services" / "agent_loop.py"
    content = loop_path.read_text(encoding="utf-8")
    tree = ast.parse(content, filename=str(loop_path))

    for node in ast.walk(tree):
        if isinstance(node, ast.Name):
            assert "expert" not in node.id.lower(), f"Forbidden AST Name '{node.id}' in agent_loop.py:{node.lineno}"
        if isinstance(node, ast.Attribute):
            assert "expert" not in node.attr.lower(), f"Forbidden AST Attribute '{node.attr}' in agent_loop.py:{node.lineno}"
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            assert "expert" not in node.name.lower(), f"Forbidden function name '{node.name}' in agent_loop.py:{node.lineno}"
```
This is the exact shape for SC#2's "count of independent encodings of the born-for predicate == 1"
fence: `ast.parse` the target file(s) (`expert_service.py`, `skill_visibility.py`, and — as a
regression guard — `tool_dispatcher.py`/`agent_loop.py`/`harness/grounding.py`), walk the tree, and
assert a **measured count** of some structural marker (e.g. occurrences of the literal
`"born_for_expert_bundle_id"` used as a *comparison operand* rather than a passed-through kwarg/field
name) equals exactly 1 in the places that implement the rule and 0 elsewhere. Reuse this test's
`APP_DIR`-relative path pattern and its per-node-kind assertion style rather than a single
regex/grep line — the AST walk is what makes the fence immune to the string appearing inside a
comment or a kwarg name (the same subtlety RESEARCH §2.1 found in the *existing* fence: a
keyword-argument name is `ast.keyword`, not `ast.Name`).

#### 3c. SC#5 — the byte-identical-base-literal pin

**Analog for the RELATIONSHIP-not-value framing:**
`backend/tests/unit/test_263_drafter_output_fits_its_consumers.py:1-80`. Its docstring states the
governing principle SC#5 should adopt for its own framing:
```python
⛔ THIS FENCE ASSERTS A RELATIONSHIP, NEVER A CONSTANT. It does not care what the caps ARE; it
cares that every producer field is BOUNDED and that its consumer's bound is not smaller. Raising a
cap keeps it green; re-introducing an unbounded producer, or narrowing a consumer below its
producer, turns it red. A test pinning ``== 8000`` would have to be edited on every legitimate
widening and would teach nobody why the number matters.
```
and its parametrized-pairs + helper-extractor shape (`_max_length`, `PRODUCER_CONSUMER_PAIRS`,
`@pytest.mark.parametrize`) is the pattern for asserting "producer bound ≤ consumer bound" as a
structural relationship rather than a copied number.

⚠ SC#5 itself is NOT quite this shape — it needs a literal `==` against a **frozen string**, which
is closer to `test_seed125_skill_visibility_filter.py`'s existing (but weaker) pins at `:38-40`:
```python
def test_empty_org_set_is_fail_closed_system_only():
    out = _build_skill_visibility_or(_UID, set())
    assert out == "is_system.eq.true"
```
This IS already an `==` against a literal (the empty-org case). RESEARCH §5.1 supplies the two
non-empty frozen literals (single-org and two-org) to extend this same style to `expert_bundle_id`
omitted — write `assert out == <the exact string from §5.1>` for all three arms, not
`startswith`/`in` (RESEARCH's own critique of the current non-empty-arm tests at `:44-55`).

#### 3d. SC#1 — `_handle_load_skill` end-to-end, mocked supabase chain, as a non-author org member

**Analog for the MOCK PLUMBING:** `backend/tests/unit/test_142_load_skill_flag.py:42-109` — the
`_FakeResult` / `_PassthroughQuery` / `_FakeSupabase` / `_skill_row()` / `_make_ctx()` scaffold:
```python
class _FakeResult:
    def __init__(self, data):
        self.data = data
        self.count = len(data) if isinstance(data, list) else None

class _PassthroughQuery:
    """Chainable builder whose ``.execute()`` returns the seeded rows verbatim.
    ...select/or_/eq/order are chainable no-ops routed through ``__getattr__``.
    """
    def __init__(self, rows):
        self._rows = list(rows)
    def __getattr__(self, _name):
        def _chain(*a, **k):
            return self
        return _chain
    def execute(self):
        return _FakeResult(self._rows)

class _FakeSupabase:
    def __init__(self, skills_rows, files_rows):
        self._skills = skills_rows
        self._files = files_rows
    def table(self, name):
        if name == "skills":
            return _PassthroughQuery(self._skills)
        if name == "skill_files":
            return _PassthroughQuery(self._files)
        return _PassthroughQuery([])
```
⛔ **Do not copy this fake as-is for SC#1** — RESEARCH §2.6/§8.9 measured that this exact
`_PassthroughQuery` shape is why *no existing test proves anything about visibility*: `.or_()` is a
no-op, so any predicate — correct, widened, or absent — returns the same rows. SC#1 needs a
**recording** fake: a `.or_()` that stores its argument (so the test can assert the predicate string
sent) or filters `self._rows` by re-implementing the same rule the production code calls (so the
fake and the code under test can disagree and the test can see it). Copy `_FakeResult` /
`_FakeSupabase.table()` / `_skill_row()` verbatim (they are shape-only, no predicate logic); replace
only `_PassthroughQuery.or_` with a variant that records or filters.

**Analog for the SCENARIO shape (same-org non-author, not disjoint-org):**
`backend/tests/integration/test_v3_4_org_isolation.py:918-996`,
`test_load_skill_cross_org_refused_seed125` — the positive-control-then-refusal pattern:
```python
async def test_load_skill_cross_org_refused_seed125(pg_pool, two_orgs_two_users):
    a, b = two_orgs_two_users["a"], two_orgs_two_users["b"]
    sb = _service_role_supabase_or_skip()
    _sid, name, body = await _seed_org_shared_skill(pg_pool, a["uid"], a["org_id"])

    # Owner A resolves the skill (positive control — the skill exists + is loadable).
    out_a = json.loads((await _handle_load_skill(
        {"skill_name": name}, _make_seed125_tool_ctx(sb, a["uid"]))).result)
    assert out_a.get("instructions") == body, (
        "positive-control failure: owner A cannot load its OWN skill ..."
    )

    # Disjoint-org B must be REFUSED at resolution — no instructions, the not-found error.
    out_b = json.loads((await _handle_load_skill(
        {"skill_name": name}, _make_seed125_tool_ctx(sb, b["uid"]))).result)
    assert "instructions" not in out_b, (...)
```
This test drives the WRONG axis for 264 (disjoint-org, always-refused) — RESEARCH §2.6 names it as
"the best available template," not a direct fit. The **positive-control-then-target-assertion**
shape is exactly right; the scenario needs inverting: seed a **private** (`is_org_shared=False`)
skill with `born_for_expert_bundle_id=<bundle>` owned by user A, then assert a **same-org
non-author** caller B — driving `ToolContext(born_for_bundle_id=<bundle>, ...)` — DOES resolve it
(where today it would not). This test is **outside `tests/unit`** (RESEARCH §2.6), so it is
UAT-adjacent evidence for D-264-09, not a gate defense; SC#1's actual gate-facing proof should be
the mocked/recording `tests/unit` version built on the `test_142_load_skill_flag.py` scaffold above.

---

## Shared Patterns

### The additive-default-`None` discipline (applies to every `RunContext`/`ToolContext` edit)
**Source:** `agent_loop.py:257-270` (RunContext trailing fields), `tool_dispatcher.py:149-185`
(ToolContext trailing fields). Every field added in the last five phases follows the same shape:
a phase/decision-tag comment, an explicit statement of what `None` means ("byte-identical … no-op"),
and an explicit statement of what a real value changes. Apply this verbatim to `born_for_bundle_id`
on both dataclasses.

### `getattr(ctx, "<field>", None)` at the dispatcher boundary, never `ctx.<field>`
**Source:** `tool_dispatcher.py:1408`, `:1566` (`:1569` shown above). Applies to
`_resolve_skill_visibility_or`'s read of `ctx.born_for_bundle_id` (RESEARCH C2) — duck-typed
`ToolContext` stubs in three existing test suites lack fields added after they were written.

### Propagation onto `sub_ctx` mirrors `workflow_run_id` / `skill_snapshot` / `skill_instructions_override`
**Source:** `task_service.py:618-650`. All three are propagated for the identical measured reason
(a sub-agent dispatches with `sub_ctx`, never `parent_ctx`) — apply the same one-line propagation +
comment to `born_for_bundle_id` (D-264-05). Do NOT copy the *other* pattern in this same block —
`dead_gap_tokens_in_run=set()` / `previous_files_in_run={}` are **fresh-per-sub-agent** mutable
accumulators, the opposite shape from an immutable scope id (RESEARCH F2).

### Fencing an UNCHANGED site — negative assertion, not silence
**Source:** the existing `harness/phase_types.py:637` / `harness/grounding.py:208,215` sites need no
code change, but D-264-04's discipline ("a recorded decision, not an omission") means the plan's
tests should assert a negative: no `born_for_bundle_id`/`expert_bundle_id` keyword reaches
`_build_phase_tool_context` or `assemble_grounding_bundle`'s callers, and `grounding.py`'s predicate
output string never contains `born_for_expert_bundle_id`. No single existing test does this
"unchanged, and provably so" shape yet — model it on `test_seed125_skill_visibility_filter.py`'s own
`"born_for_expert_bundle_id" not in out` assertion (`:96`).

---

## No Analog Found

| File / edit | Role | Data flow | Reason |
|---|---|---|---|
| `skill_visibility.py`'s new `expert_bundle_id`/`is_enabled`-aware disjunct (Form 2, RESEARCH §5.3) | utility | transform | No existing PostgREST `.or_()` builder in this codebase nests a THIRD conditional term with its own sub-`and()` for enablement. `expert_service.py`'s hand-rolled version (being retired) is the closest prior art, but it operates on already-fetched asyncpg rows, not a query string. |
| The "count of independent encodings == 1" AST/grep fence (SC#2) itself | test | static analysis | `test_260_expert_chat_scoping.py`'s AST walk is the closest shape (§3b) but counts a **forbidden substring**, not a **required-exactly-once** structural marker — inverting the assertion direction is new. |

---

## Metadata

**Analog search scope:** `backend/app/services/`, `backend/app/utils/`, `backend/app/services/harness/`,
`backend/app/services/sources/`, `backend/tests/unit/`, `backend/tests/integration/`,
`docs/HOT-FILE-LEDGER.md`.
**Files scanned (Read/Grep):** `tool_dispatcher.py`, `agent_loop.py`, `task_service.py`,
`harness/phase_types.py`, `skill_visibility.py`, `expert_service.py`, `skill_catalog_filter.py`,
`sources/failure_cause.py`, `model_registry.py`, `test_seed125_skill_visibility_filter.py`,
`test_260_expert_chat_scoping.py`, `test_263_drafter_output_fits_its_consumers.py`,
`test_142_load_skill_flag.py`, `tests/integration/test_v3_4_org_isolation.py`,
`docs/HOT-FILE-LEDGER.md` (§`workspaceAllowedExt.ts`, §`entitlements.py`, §`experts.py`).
**Pattern extraction date:** 2026-09-22

---

## Appendix: ledger-row precedent (scope note item 4)

Two examples of a row added **at first touch**, in both the CLAUDE.md scan-list shape and the
`docs/HOT-FILE-LEDGER.md` detail-section shape — the exact same-commit pair `skill_visibility.py`'s
new row must produce.

**CLAUDE.md scan-list row shape** (from the live table):
```
| `backend/app/db/entitlements.py` | 2 / 1 / 169 | young (created 258). Row added AT CREATION — an absent row is invisible to G-5 at any count |
```

**`docs/HOT-FILE-LEDGER.md` scan-list row shape** (same file, that document's own copy of the list,
`docs/HOT-FILE-LEDGER.md:10641`):
```
| [`backend/app/db/entitlements.py`](docs/HOT-FILE-LEDGER.md#backendappdbentitlementspy) | 2 / 1 / 169 | no (new) | young (created Phase 258). Row added AT CREATION — absent row is invisible to G-5 (TIER-01/02). |
```

**`docs/HOT-FILE-LEDGER.md` detail-section shape** (`docs/HOT-FILE-LEDGER.md:15477-15481`):
```
## `backend/app/db/entitlements.py`

**`1 / 1 / 169`** — created by Phase 258 (`258-01`). **Row added AT CREATION.** Precedent in `CLAUDE.md` is explicit: rows added at creation, since an absent row is invisible to G-5 at any count (`LibraryCloudImport.tsx` / `settingsSearchPayload.ts` precedent).

What it owns. The database access layer for commercial capability matrix queries (`public.tier_capabilities`) and additive `organizations.add_ons` overrides. Provides `get_tier_capabilities()`, `is_capability_enabled_for_tier()`, and `resolve_org_entitlement()`. Strictly fails closed on database connectivity errors or unresolvable organizations (TIER-05).
```

**Second example — `frontend/src/lib/workspaceAllowedExt.ts`** (`docs/HOT-FILE-LEDGER.md:12176-12198`,
detail section; scan-list row at `:10915`):
```
| [`frontend/src/lib/workspaceAllowedExt.ts`](docs/HOT-FILE-LEDGER.md#frontendsrclibworkspaceallowedextts) | 1 / 1 / 54 | no (new) | young (created 244-02). Row added AT CREATION, per the `settingsSearchPayload.ts` precedent — an absent row is invisible to G-5 at any count |
```
```
## `frontend/src/lib/workspaceAllowedExt.ts`

**`1 / 1 / 54`** — created by `244-02` T1. Row added **at creation**.

**The single frontend source of the attachment allow-list.** Exports `WORKSPACE_ALLOWED_EXT`
(grouped by the server's own four validator categories, in the server's order) and
`WORKSPACE_ACCEPT_ATTR` (the comma-joined `accept=` value).

⛔ **This is a UX hint, never a gate.** ...
```

**Applied to `skill_visibility.py`** (per RESEARCH §7's exact triple, `1 / 1 / 83`): the new row's
disposition sentence should read something close to *"young (this is the file's SECOND phase, not
creation — the module predates 264, but had NO row for its entire life until now). Row added at
first touch. Binding invariant: exactly one copy of the rule, two encodings, they MUST agree, and
the born-for arm nests INSIDE the org gate — never as a fourth top-level branch."* — matching
RESEARCH §7's own recommended text — and the detail-file section should carry the same three-part
shape (triple + creation/first-touch note, what the file owns, binding invariant), same commit as
the code edit (RESEARCH A7).
