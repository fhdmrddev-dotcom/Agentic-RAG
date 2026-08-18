---
phase: 197-guided-authoring
plan: 02
subsystem: backend
tags: [authoring, readiness-verdict, d-13, d-14, d-22-fence, one-source, red-then-green]

# Dependency graph
requires:
  - phase: 197
    plan: 01
    provides: "The phase base SHA as a literal + the four standing numstat criteria + the corrected backend baseline SCOPE"
  - phase: 182
    provides: "grounding.py as the ONE home for the publish invariant — the predicate AND (D-klo-DEF-01) its message"
  - phase: 193.2
    provides: "The server-side provenance stamp the readiness derivation sits AFTER, and the test file this plan extends"
  - phase: 193.1
    provides: "useTemplateFirstDraft.ts — the ONE production /generate call site half B reads"
provides:
  - "readiness on /generate's success payload — one server-derived verdict, sourced by import, present only on success"
  - "D-14 half A: ADVERTISED_BUT_NOT_ASKED — the emit contract's unrouted set pinned to an 8-entry reasoned allowlist with a synthetic control"
  - "D-14 half B: ACCEPTED_BUT_NEVER_SENT — the request contract fenced, landed RED on a real live instance, then allowlisted with its measured reason and a re-open trigger"
  - "A source fence asserting the authoring path declares NEITHER the predicate NOR the message of its own"
  - "The measured confirmation that api/workflows.py needs zero change (no response_model, body is `return result`)"
affects: [197-03, 197-04, 197-05, 197-06, 197-07, 197-08, 197-09, 197-10, 197-11, wave-merge, phase-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A wire field derived by IMPORT from the one home that already owns the rule — the second-consumer posture (187-24), not a second predicate"
    - "A D-22 fence as a two-directional SET EQUALITY against a reason-bearing allowlist, so the allowlist cannot be grown to silence the test"
    - "A fence landed RED against a real, independently-recorded live defect before its allowlist entry exists — a positive control exercised against the wild rather than against a plant"
    - "A checker that takes its corpus as an ARGUMENT, so a synthetic control can hand it a modified copy and prove it still fires"

key-files:
  created:
    - ".planning/phases/197-guided-authoring/197-02-SUMMARY.md"
  modified:
    - "backend/app/services/workflow_authoring.py"
    - "backend/tests/unit/test_workflow_authoring_requirement.py"

key-decisions:
  - "The grounding import is FUNCTION-LOCAL, matching this module's own shipped 'Pitfall 4 discipline' convention rather than introducing a module-level import into a file that deliberately has none for that package"
  - "template_asset_id is CONFESSED in an allowlist with a re-open trigger, NOT fixed — wiring it is a template-binding contract change and therefore AUTH-03's surface"
  - "Half B's stripper survival guard is over TOKENS, never a character ratio — the call site measures 75% comment by character, so the obvious ratio guard is FALSE on the file it guards"
  - "The verification scope reported here is tests/unit, which is the plan's literal command AND 197-01's unit-scope row; the whole-tree lineage is explicitly NOT claimed"

patterns-established:
  - "Both halves of a contract fence assert set EQUALITY, so a deletion from the allowlist is as loud as an addition to the model"
  - "A reason string lives IN the literal, never in a comment beside it — the person who later wants to delete the row is the person who must read it"

requirements-completed: [AUTH-02]

# Metrics
duration: 41min
completed: 2026-08-18
---

# Phase 197 Plan 02: The D-13 Readiness Verdict + The D-14 Contract Fence Summary

**`/generate`'s success payload now carries ONE server-derived publish verdict, imported from the single home that already owns the rule; and both halves of the D-14 contract fence are installed — half A with a synthetic control, half B landed RED on a real, live, currently-unclosed fourth D-22 instance before its allowlist entry existed.**

## Performance

- **Duration:** 41 min
- **Started:** 2026-08-18T06:35:00Z
- **Completed:** 2026-08-18T07:16:00Z
- **Tasks:** 3 (four commits — half B is RED and GREEN separately, by instruction)
- **Files modified:** 2, both declared in `files_modified`. Nothing else.

---

## ⚠ THE WRONG-BASE DEFECT REPRODUCED, AND THE ASSERTION IS WHAT CAUGHT IT

Recorded first because it is the finding most likely to affect a sibling agent in this same wave.

```
$ git rev-parse HEAD                       # on arrival, after bootstrap
fda792141b0129de7b15dd40ddc1082e76f95a2a   ← NOT the dispatched base

$ git merge-base HEAD 7cf919f1438ad92d597f9749acba22bb1e8fab43
3781a3fe4690a9619e619f4cc412bd37a7dafc52   ← the dispatched base is NOT an ancestor
```

The worktree forked from **`fda79214`**, exactly the SHA the dispatch prompt names as the
previously-measured wrong base. `7cf919f1` was not an ancestor — the merge-base was a third commit
— so this was a genuine divergence, not a stale checkout. Corrected with the sanctioned
`git reset --hard 7cf919f1…` from `<worktree_branch_check>` and re-verified:

```
$ git rev-parse HEAD
7cf919f1438ad92d597f9749acba22bb1e8fab43
$ git status --short
                                            [empty]
```

**Every number in this SUMMARY is measured against `7cf919f1`, post-correction.** ⚠ Note the base
SHA differs from the one `197-01` recorded (`52e6bcdb`): `7cf919f1` is the tracking commit that
landed wave 1's SUMMARY on top of it. Since wave 1 modified **no source file**, the four standing
numstat criteria give identical answers against either — and all four were run against `7cf919f1`
below.

---

## Task 1 — the D-13 readiness verdict

**Commit `11db34d5`** (`feat`) — `backend/app/services/workflow_authoring.py`, `backend/tests/unit/test_workflow_authoring_requirement.py`

### What shipped

One key on the **single** success return, derived **after** the 193.2 provenance stamp and **after**
the slug mint, so the verdict describes the definition actually returned:

```python
from app.services.harness.grounding import (  # function-local (Pitfall 4 discipline)
    BUSINESS_REQUIREMENT_MISSING_MESSAGE,
    business_requirement_missing,
)

readiness: dict = {
    "business_requirement": (
        {"status": "missing", "message": BUSINESS_REQUIREMENT_MISSING_MESSAGE}
        if business_requirement_missing(wd)
        else {"status": "present"}
    )
}

return {
    "ok": True,
    "definition": wd.model_dump(mode="json"),
    "readiness": readiness,
}
```

**The message TRAVELS.** It is not compared to a string, it *is* the object — a test asserts
`missing_verdict["message"] is constant`, identity not equality, so a re-typed lookalike in the
service would fail even if it were character-identical today.

### The three acceptance greps, run

```bash
$ grep -c "BUSINESS_REQUIREMENT_MISSING_MESSAGE\s*[:=]" backend/app/services/workflow_authoring.py
0
$ grep -c "def business_requirement_missing" backend/app/services/workflow_authoring.py
0
```

Both `0` — the constant and the predicate are imported, never redeclared. That posture is now
fenced *mechanically* rather than asserted in a comment: `test_the_generate_path_declares_no_predicate_and_no_message_of_its_own`
reads `inspect.getsource(wa)` and runs the same two checks plus a positive requirement that the
import line is present. It reads the **source**, not the module object, because a re-implementation
producing equal values would be invisible to any behavioural assertion — which is precisely the
drift being fenced.

### ⭐ `backend/app/api/workflows.py` needs ZERO change — CONFIRMED BY READING, NOT ASSUMED

The plan required this be recorded. Read at `:1594-1630`:

- the route decorator is `@router.post("/generate", dependencies=[Depends(require_visible("workflow_authoring"))])` — **no `response_model`**;
- the body's last statement is **`return result`** — the service dict, untouched.

So the new key passes straight through. The file was **not opened for an edit**, and its numstat
criterion is verified below. Had a `response_model` been added "for tidiness" it would have changed
the four failure arms too, which is exactly why T-197-08 dispositions this as **accept + pin**
rather than as a thing to improve.

### The one-verdict rule (D-20) is enforced, not merely intended

`readiness` carries **exactly one** entry, and a test asserts `set(readiness) == {"business_requirement"}`
across **both** arms in one sweep — so a payload that widened on only the `missing` side still
fails. There is no key for the KB binding, the template, the name or the deliverable: research
enumerated every gauntlet stage from source and stage 1's predicate is the only definition-level
one, so four extra greens would be four claims the server cannot make.

The same assertion is the T-197-04 cross-tenant floor read the other way — one status token plus one
fixed server constant cannot carry a folder name, folder id or user id. The case additionally
asserts the stub user id the driver passes (`"u1"`) appears nowhere in `json.dumps(readiness)`.

### The nine new cases

| Case | Pins |
|---|---|
| `…carries_the_servers_own_readiness_verdict` (×4 params) | both statuses, from a stated requirement / an absent key / an empty string / whitespace-only |
| `…missing_arm_relays_the_gates_own_sentence_and_the_present_arm_is_silent` | the constant **by identity**; and `"message" not in` the present arm — absence means absence, never `None` |
| `…carries_exactly_one_entry_and_no_row_data` | D-20 + T-197-04, swept over both arms |
| `…could_not_generate_failure_carries_no_readiness_verdict` | T-197-07, the retry-exhausted arm, with `len(calls) == 2` as its non-vacuity proof |
| `…grounding_failure_carries_no_readiness_verdict` | T-197-07 **a second arm** — because "no verdict on failure" is a property of the control flow, not of one branch. This arm returns from an EARLIER point, so a future verdict attached at the top of the function would pass the case above and fail here |
| `…declares_no_predicate_and_no_message_of_its_own` | T-197-03 / 187-24, read off the source |

### One deliberate departure from the plan's letter, recorded as a decision

The plan said "Import … into `workflow_authoring`" without specifying placement. The import is
**function-local**, because this module's own convention is explicit and repeated — `_assemble_grounding`
already does `from app.services.harness.grounding import …  # function-local (Pitfall 4 discipline)`,
and there is no module-level import of that package anywhere in the file. A module-level import would
have been the only one of its kind in the file and would have introduced a new import-time edge into
`harness.grounding` for a module that has deliberately avoided one. The `key_links` grep pattern
(`from app.services.harness.grounding import`) matches either way, and the source fence asserts it.

**No import cycle appeared**, so the plan's "report it rather than working around it" branch was not
taken.

---

## Task 2 — D-14 half A, the emit contract fence

**Commit `cfd5d4ab`** (`test`) — `backend/tests/unit/test_workflow_authoring_requirement.py`

### The split was RE-DERIVED, not trusted

The plan said re-derive rather than trust its list. Run against this tree:

```bash
$ venv/Scripts/python.exe -c "
from app.services.workflow_authoring import WF_SCHEMA, AUTHORING_SYSTEM_PROMPT
props=list(WF_SCHEMA['properties'])
print(len(props))
for p in props: print(p, p in AUTHORING_SYSTEM_PROMPT)"
15
slug True · version True · name True · status True · phases True · project_folder_id True
output_target_folder False · reingest_output False · version_policy False · provenance False
inputs False · assets False · business_requirement True
business_requirement_seeded_by_ai False · category False
```

**15 advertised, 7 asked, 8 not** — RESEARCH's figure confirmed exactly, field for field. The eight
are the eight it named.

**This is why the fence needs an allowlist rather than a one-line assertion.** A naive *"every
advertised field must be asked for"* check is red on arrival on eight fields, most of which are
correctly unasked, and would be deleted within a week.

### `ADVERTISED_BUT_NOT_ASKED` — 8 entries, each reason IN the literal

Reasons were written from source rather than paraphrased from the plan:

| field | reason, in one line |
|---|---|
| `output_target_folder` | 098 additive-optional **shape only** (`models/harness.py:528`); no shipped path reads it |
| `reingest_output` | same, `:529` — a defaulted bool nothing acts on |
| `version_policy` | same, `:530` — a Literal with a shipped default; two tokens nothing reads |
| `provenance` | 098 net-new flag with a default, `:531` — a provenance claim is the SERVER's to make |
| `inputs` | the launch-form spec, authored on the canvas, `:532` — a generated form nobody asked for |
| `assets` | template/reference refs PRODUCED by the binding door, `:533` — an asset ref names a real Storage path, so an invented one names a file that does not exist |
| `business_requirement_seeded_by_ai` | the provenance stamp, ignored from the model in **both directions** and written server-side after validation — asking for it invites the exact laundering `T-193.2-03b` refuses |
| `category` | the Starters-shelf curation marker (`models/harness.py:575-581`) — in the schema so the fresh-copy **starter fork** round-trips it past `extra='forbid'`; a curation fact, not an authoring choice |

### It is two-directional, and that was DEMONSTRATED rather than argued

```bash
$ venv/Scripts/python.exe -c "… real = _advertised_but_not_asked(WF_SCHEMA) …"
actual  : ['assets', 'business_requirement_seeded_by_ai', 'category', 'inputs',
           'output_target_folder', 'provenance', 'reingest_output', 'version_policy']
removing one allowlist entry -> equal? False
```

A field **added** to the model and never routed reds on the commit that adds it; an entry **deleted**
from the allowlist while the field stays unasked reds too. So the allowlist cannot be grown *or*
emptied to silence the test without a reason being written.

### The synthetic control

`_advertised_but_not_asked(schema)` takes its schema as an **argument**, so the control hands it a
`copy.deepcopy` with a fabricated property inserted and asserts it is reported. A checker that could
only ever read the real schema could never be shown to fire.

⚠ **The fabricated name is assembled at runtime** — `"_".join(("plant", "ed", "unrouted", "prop"))` —
and appears nowhere in the file as a contiguous literal. That is the `196-08` needle trap, which
sprang four times there including inside the comment written to explain the first three. The control
also asserts the real `WF_SCHEMA` is untouched afterwards, so it cannot contaminate the fence.

### Acceptance

```bash
$ pytest tests/unit/test_workflow_authoring_requirement.py -k advertised -q
3 passed, 42 deselected
```

**3 collected**, against the required minimum of 2. `grep -c "def test"` on the file: **25** at the
base SHA → **34** after this task (and **36** at plan close) — strictly greater, as required.

---

## Task 3 — D-14 half B: RED, then GREEN

**Two commits, by instruction, so both states are in the history.**

### ⭐ THE RED RUN, VERBATIM — commit `0c814415`

Landed with `ACCEPTED_BUT_NEVER_SENT` **empty**. Output taken **before the allowlist entry existed**:

```
$ backend/venv/Scripts/python.exe -m pytest tests/unit/test_workflow_authoring_requirement.py -k accepted -q
F                                                                        [100%]
================================== FAILURES ===================================
_ test_every_accepted_request_field_is_either_sent_or_allowlisted_with_a_reason _

>       assert _accepted_but_never_sent() == set(ACCEPTED_BUT_NEVER_SENT)
E       AssertionError: assert {'template_asset_id'} == set()
E
E         Extra items in the left set:
E         'template_asset_id'
E         Use -v to get more diff

tests\unit\test_workflow_authoring_requirement.py:1521: AssertionError
=========================== short test summary info ===========================
FAILED tests/unit/test_workflow_authoring_requirement.py::test_every_accepted_request_field_is_either_sent_or_allowlisted_with_a_reason
1 failed, 46 deselected, 1 warning in 1.49s
```

**The fence fired, on its first run, on a real defect nobody planted.** `template_asset_id` has been
accepted by `GenerateRequest` since Phase 103 and has never once been sent by the one production call
site. That is materially stronger evidence than a synthetic plant: a fence whose only control is
something its author invented has never been exercised against the wild.

The companion non-vacuity case (`…call_site_is_readable_and_really_is_the_call_site`) was **green in
the same run**, so the RED is a real verdict rather than a broken reader.

### THE GREEN RUN — commit `a1df92f4`

```
$ backend/venv/Scripts/python.exe -m pytest tests/unit/test_workflow_authoring_requirement.py -q
...............................................                          [100%]
47 passed, 1 warning in 0.65s
```

The single allowlist entry carries `SEED-157`'s measurement verbatim in the literal: the field is
typed **`UUID | None`** while the Phase-193 upload door mints a **Storage path**, so passing a real
asset id is a **422 before the handler runs** (the identical defect found the same day on
`/workflows/grounding-bundle`, `260814-q5r-SUMMARY.md`). **The channel is unwirable as typed** — no
amount of frontend work sends it.

`ACCEPTED_BUT_NEVER_SENT` has **exactly one** entry and its reason contains the token **`SEED-157`**,
as required.

### ⚠ IT WAS NOT FIXED, AND THAT IS THE DECISION

Wiring the field means either widening the server's type or changing what the upload door mints —
a change to the **template-binding contract**, which is `AUTH-03`'s surface, not `AUTH-02`'s.

**RE-OPEN TRIGGER, recorded in the allowlist literal itself so it travels with the confession:**
*the next phase that takes up template binding.* Deleting the entry without wiring the field reds the
fence, which is the point of the equality.

### The needle trap, stated by role

The fence greps a **frontend source** and decides "sent" by membership, so a comment added to
`useTemplateFirstDraft.ts` naming one of the request fields would read as evidence the field is sent
and the fence would go quietly green on an unwired channel. Comments are stripped before the
membership test for exactly that reason — **and no plan may treat that stripping as a licence to
name a field in prose over there.** The hazard is stated in the case's docstring **by role**, never by
spelling the field name.

### Pathing

The call site is addressed as repo-relative **segments** joined against a root derived from
`__file__` (`Path(__file__).resolve().parents[3]`). Required grep:

```bash
$ grep -c 'C:\\\|/c/' backend/tests/unit/test_workflow_authoring_requirement.py
0
```

Zero absolute paths — which matters here more than usual, since this suite runs inside worktrees
routinely.

---

## Verification

### 1. The plan's test file

```
47 passed, 1 warning in 0.65s
```

### 2. Backend unit suite — ⚠ SCOPE STATED, NOT ASSUMED

```
$ backend/venv/Scripts/python.exe -m pytest tests/unit -q
62 failed, 2289 passed, 2 xfailed, 2 xpassed, 32 warnings in 401.48s (0:06:41)
```

| | `197-01` baseline (`tests/unit`) | **this tree** | delta |
|---|---|---|---|
| failed | 63 | **62** | **−1** |
| passed | 2274 | **2289** | **+15** |
| xfailed / xpassed | 2 / 2 | 2 / 2 | — |
| summary total | 2341 | **2355** | **+14** |

**+14 is exactly this plan's 14 new cases** (9 + 3 + 2). The arithmetic closes with nothing left
over, which is the check that matters — it proves no test was lost.

⚠ **The scope reported here is `tests/unit`, which is the plan's literal `<verification>` command AND
`197-01`'s unit-scope row. This plan makes NO claim against the `211/4046` whole-tree lineage** —
wave 1's standing instruction is honoured by *naming the scope*, not by silently substituting a
number. A later plan comparing against the whole-tree figure must run `backend/tests` itself.

⚠ **`failed` went DOWN by one, and this plan does not claim credit for it.** A previously-failing
unit test now passes; nothing in this diff plausibly causes that (the change is confined to one
success return in the authoring service). Recorded as an observation, not a result. The failing set
was captured by file and **none of the 62 is in this plan's scope**:

```
15 test_retrieval_service.py · 12 test_sql_service.py · 6 test_explorer_agent.py
 5 test_multimodal_query.py  ·  4 test_111_1_reembed_kickoff.py · 3 test_sandbox_service.py
 3 test_lifespan.py · 3 test_db_runs.py · 2 test_module7_tools.py · 2 test_extraction_service.py
 1 each: test_streaming_reliability · test_phase56_iteration_start
         test_get_model_capability_inference · test_forced_emit
         test_075_4_unknown_provider_error · test_071_1_threadpool_sweep · test_061_consumer
```

Pre-existing rot in retrieval / SQL / sandbox / lifespan subsystems this plan does not touch.

### 3. Targeted in-scope sweep — the number that actually defends this change

```
$ pytest tests/unit -q -k "authoring or workflow or grounding or publish or generate"
386 passed, 1969 deselected, 1 warning in 4.51s
```

**386 passed, 0 failed.** Every authoring, workflow, grounding, publish and generate unit test is
green.

### 4. The non-unit consumers of the generate path

Every module referencing `generate_workflow_definition` or `/workflows/generate` was enumerated and
the three runnable non-unit suites were driven (the two remaining are live-provider k/N frequency
measurements, not gates):

```
$ pytest tests/test_148_carveouts.py tests/test_182_canvas_gate.py tests/test_182_extraction_parity.py -q
17 passed, 1 warning in 1.26s
```

A widened success dict breaks nothing downstream.

### 5. The three `0 0` numstat criteria — ALL CLEAN

```bash
$ git diff --numstat 7cf919f1438ad92d597f9749acba22bb1e8fab43 HEAD -- \
    backend/app/api/workflows.py \
    backend/app/services/harness/publish_service.py \
    backend/app/services/harness/grounding.py
                                                                   [no output]
```

**None of the three appears in the diff at all.** `grounding.py` was READ (its predicate and message
are imported); it was not opened.

### 6. The four STANDING numstat criteria from `197-01` — run at this wave, as instructed

```bash
$ git diff --numstat 7cf919f1438ad92d597f9749acba22bb1e8fab43 HEAD -- \
    frontend/src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx \
    frontend/src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx \
    frontend/src/components/workflows/SeedReceipt.tsx \
    backend/app/services/harness/publish_service.py
                                                                   [no output]
```

**All four clean — 0 insertions, 0 deletions.** This plan is backend-only and touches no frontend
file, but the criteria are run at every wave merge by standing instruction, not only when a plan
expects to be near them.

### 7. The whole diff, and the deletions in it

```bash
$ git diff --numstat 7cf919f1438ad92d597f9749acba22bb1e8fab43 HEAD
56      3       backend/app/services/workflow_authoring.py
515     0       backend/tests/unit/test_workflow_authoring_requirement.py
```

**Exactly the two declared `files_modified`, and nothing else.** The test file has **zero deletions**.
The three deletions in the service are enumerated rather than summarised:

```
-    Returns on success ``{"ok": True, "definition": <model_dump json>}`` (NOT persisted —
-    persistence is REQ-1's explicit ``POST /workflows`` create). On failure returns an
-    return {"ok": True, "definition": wd.model_dump(mode="json")}
```

Two docstring lines rewritten to describe the new key, and the one success `return` widened. **No
code was removed.**

---

## Task Commits

1. **Task 1 — the D-13 readiness verdict + 9 cases** — `11db34d5` (`feat`)
2. **Task 2 — D-14 half A, the emit contract fence + synthetic control** — `cfd5d4ab` (`test`)
3. **Task 3a — D-14 half B, landed RED on the live instance** — `0c814415` (`test`)
4. **Task 3b — D-14 half B, GREEN with the confessed reason + re-open trigger** — `a1df92f4` (`test`)

## Files Created/Modified

- `backend/app/services/workflow_authoring.py` — modified (+56 / −3): the readiness derivation, its two imports, and the docstring
- `backend/tests/unit/test_workflow_authoring_requirement.py` — modified (+515 / −0): 14 new cases across three sections, two allowlists, three helpers
- `.planning/phases/197-guided-authoring/197-02-SUMMARY.md` — created

## Accomplishments

- The authoring surface now **renders** a verdict it does not **decide** — the 187-24 posture, made
  mechanical by a source fence rather than asserted in a comment.
- D-14 exists in both halves, and **half B's positive control is real**: the fence went red on a
  live, independently-recorded, currently-unclosed defect on its first run, before any allowlist
  entry existed.
- The `template_asset_id` gap is now **impossible to lose**. It was a line in a seed file; it is now
  a test that reds if anyone deletes its explanation, carrying its own re-open trigger.
- The wrong-base worktree defect was caught by assertion rather than by symptom — every figure in
  this SUMMARY is measured on the intended tree.

## Decisions Made

- **The grounding import is function-local.** The module's own repeated convention ("Pitfall 4
  discipline") and the absence of any module-level import of that package made a module-level import
  the odd one out. It would also have added an import-time edge the module has deliberately avoided.
- **`template_asset_id` is confessed, not fixed.** Explicitly forbidden by the plan, and correctly so:
  the fix is a contract change on a different requirement's surface.
- **Half B's stripper guard is over tokens, not a character ratio** — see Deviations.
- **The backend baseline is reported at `tests/unit` scope and says so.** Wave 1's finding is honoured
  by naming the scope, not by quoting a whole-tree number this plan did not measure.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] My own non-vacuity guard was FALSE on the file it guards**

- **Found during:** Task 3, before the RED commit
- **Issue:** The stripper-survival check was first written as `assert len(stripped) > len(raw) // 2`
  — "comment stripping must not eat the code". It failed immediately:
  ```
  E  AssertionError: comment stripping ate the code
  E  assert 8048 > (32762 // 2)
  ```
  The stripping was working perfectly. **`useTemplateFirstDraft.ts` is 32,762 raw characters and
  8,048 stripped — 75% comment by character**, because the module documents every wire decision it
  makes at length (correctly — that documentation is why this plan could read the call site with
  confidence). A "more than half survives" heuristic is therefore **wrong by construction** on the
  very file it guards, and would need re-tuning every time someone documented something. This is the
  same rot mode as the `GSD_VITEST_MAX_WORKERS=4` constant: a number that was a function of the
  thing measured, frozen as a literal.
- **Fix:** Replaced the ratio with a **token survival** check — `import`, `export`, `await`,
  `function` must all still be present. A token that must survive cannot rot with the comment ratio.
  The measured 32,762 / 8,048 figures are recorded in the case's own docstring so the next reader
  does not re-derive the same wrong guard.
- **Files modified:** `backend/tests/unit/test_workflow_authoring_requirement.py`
- **Verification:** the case is green while the fence beside it is RED — proving the reader works and
  the RED is a real verdict
- **Committed in:** `0c814415`

**2. [Rule 3 — Blocking] The worktree forked from the wrong base**

- **Found during:** setup, before any file was read
- **Issue:** `HEAD` was `fda79214`, not the dispatched `7cf919f1`, and `git merge-base` returned a
  third commit — so the dispatched base was not an ancestor and this was a real divergence. Every
  numstat criterion in this plan has the base SHA as its left-hand side; measuring against the wrong
  one would have produced confident, wrong, unfalsifiable numbers.
- **Fix:** The sanctioned `git reset --hard 7cf919f1…` from `<worktree_branch_check>`, then
  re-verified `rev-parse` and a clean `git status`.
- **Files modified:** none
- **Verification:** quoted at the top of this SUMMARY

### Documentation adjustments

**3. [Rule 2 — Missing Critical] The service docstring described a payload shape that had stopped being true**

- `generate_workflow_definition`'s docstring stated the success return as
  `{"ok": True, "definition": …}`. Left alone it would have been a contract description contradicting
  the line of code directly below it — the exact stale-prose failure mode this project keeps
  recording. Updated in the same commit as the change it describes.
- **Committed in:** `11db34d5`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing critical)
**Impact on plan:** No scope change. Two files touched, both declared. Deviation 1 is the one worth
carrying forward — it is a measurement about a file other plans in this phase will also read.

## Issues Encountered

- The `-1 failed` movement in the unit suite is unexplained and **not claimed as an improvement**. It
  is consistent with a pre-existing flaky test in an unrelated subsystem; the full failing set was
  captured by file and none of it is in this plan's scope.
- No disk-pressure `ENOSPC` reporter failure was observed in this plan (no vitest run was needed —
  this plan is backend-only).

## Next Phase Readiness

**Ready.** What this plan hands forward:

1. **The wire contract for the arrival card.** `/generate` success responses carry
   `readiness.business_requirement.status ∈ {"present", "missing"}`, with `message` present **only**
   on `missing`. ⚠ A client union must treat **absence as absence** — there is no `null` arm and one
   must not be added.
2. ⚠ **`api.ts` will need a TYPE for this, and only a type.** Per Phase 196's measured lesson, adding
   a **type** to `frontend/src/lib/api.ts` does not trigger the `196-08` failure mode; adding a
   **runtime export** does, and costs one mock line per mounting suite. This plan added neither — it
   is backend-only.
3. **`template_asset_id` is fenced with a re-open trigger.** The next phase that takes up template
   binding inherits it. Deleting the allowlist entry without wiring the field reds the fence.
4. ⚠ **Do not name a request field in a comment inside `useTemplateFirstDraft.ts`.** Half B reads that
   file by membership and strips comments; a field named in prose over there would still be a hazard
   for any future reader who relaxes the stripping.
5. **Two of the six G-5 ledger triples wave 1 recorded are now stale** — `workflow_authoring.py` was
   `12 / 6 / 572` and has moved. Re-derive at phase close, as `197-01` instructed.

## Self-Check: PASSED

| Claim | Command | Result |
|---|---|---|
| SUMMARY exists | `ls .planning/phases/197-guided-authoring/197-02-SUMMARY.md` | FOUND |
| Task 1 commit exists | `git log --oneline` | FOUND `11db34d5` |
| Task 2 commit exists | `git log --oneline` | FOUND `cfd5d4ab` |
| Task 3 RED commit exists | `git log --oneline` | FOUND `0c814415` |
| Task 3 GREEN commit exists | `git log --oneline` | FOUND `a1df92f4` |
| Plan test file green | `pytest …test_workflow_authoring_requirement.py -q` | **47 passed** |
| `-k advertised` collects ≥ 2 | `pytest … -k advertised -q` | **3 passed** |
| No local predicate / message | two `grep -c` | **0** and **0** |
| Three `0 0` criteria | `git diff --numstat <base> HEAD -- …` | no output (absent from diff) |
| Four standing criteria | `git diff --numstat <base> HEAD -- …` | no output |
| No absolute path in the fence | `grep -c 'C:\\\|/c/'` | **0** |
| Only declared files touched | `git diff --numstat <base> HEAD` | 2 paths, both declared |
| Zero deletions in the test file | same | `515  0` |

## Threat Flags

None. No new network endpoint, no new auth path, no file access pattern and no schema change were
introduced — the diff is one dict key on an existing authenticated route plus test code.

The register's dispositions are discharged as planned:

| Threat | Disposition | Evidence in this plan |
|---|---|---|
| T-197-01 | mitigate | Not relaxed. The readiness derivation reads the **validated `wd`** *after* the stamp, never the emitted payload; the flag stays in half A's allowlist with that reason in the literal |
| T-197-03 | mitigate | Two `grep -c` → `0`, plus a source fence asserting both absences AND the import |
| T-197-04 | mitigate | `set(readiness) == {"business_requirement"}` over both arms; every leaf asserted a `str`; the stub user id asserted absent from the serialised payload. `/generate` keeps `Depends(get_current_user)` + `require_visible("workflow_authoring")` — **unchanged, the route was not opened** |
| T-197-07 | mitigate | `"readiness" not in result` on **two** different failure arms, each with its own non-vacuity proof |
| T-197-08 | accept | Confirmed by reading: no `response_model`, body is `return result`. Pinned by a `0 0` criterion, verified above |
| T-197-SC | accept | **Vacuous with reason: no package was installed and none was proposed.** No `npm`/`pip`/`cargo` command was run at any point in this plan |

---
*Phase: 197-guided-authoring*
*Completed: 2026-08-18*
