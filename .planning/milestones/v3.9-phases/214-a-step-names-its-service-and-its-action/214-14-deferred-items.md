# 214-14 — deferred items (out of scope, logged not fixed)

Both entries were found while measuring D-214-19's blast radius. Both are **provably
pre-existing**: with the pre-flip default (`"visual_workflow_canvas": "off"`) restored in
`_GOVERNED_FEATURES` and nothing else changed, each still fails. Restored md5-identical after
the check. They are therefore out of this plan's scope-boundary (only issues DIRECTLY caused
by the current task's changes are auto-fixed) and are recorded rather than repaired.

⚠ Neither is in `backend/tests/unit`, so neither is covered by this phase's 68-failure
baseline — they were invisible to it, and would have stayed invisible if this plan had not run
the flag suites explicitly.

---

## 1. `tests/test_181_flip_on.py::test_canvas_ping_200_after_flip_on`

**Failure:** the grounding bundle returned by `GET /workflows/grounding-bundle` carries one
more key than the case's expected literal:

```
Left contains 1 more item:
{'kb_tools': []}
```

**Reading:** the bundle gained a `kb_tools` field in a later phase and this case's whole-object
equality was never updated. It is a stale expectation, not a defect in the bundle — the case
asserts `resp.status_code == 200` first and that passes, so the gate behaviour it exists to
prove (flag-on ⇒ no-op ⇒ 200) is intact.

**Owner:** whoever next touches `assemble_grounding_bundle`'s response shape. The fix is one
key in the expected literal, or a subset assertion.

---

## 2. `tests/test_182_canvas_gate.py::test_openapi_tracks_the_flag_in_both_directions_in_one_process`

**Failure:** the last assertion, `set(on_doc["paths"]) - set(off_doc["paths"]) == set(_CANVAS_PATHS)`,
finds two canvas-gated paths the module constant does not list:

```
Extra items in the left set:
'/workflow-runs'
'/workflow-runs/{workflow_run_id}/phases/{phase_slug}/citations'
```

**Reading:** `_CANVAS_PATHS` in that module is a hand-maintained list and has drifted behind
`CANVAS_GATED_PATHS`, which the app actually filters on. ⚠ **This one is worth reading twice:
the case's other five assertions all PASS, so the gate is genuinely tracking the flip in both
directions** — what has rotted is the test's own inventory of what "the canvas surface" is.
A drifted inventory in a NON-discoverability test is the shape that eventually says
"filtered correctly" about a surface it never looked at.

**Owner:** whoever next adds a canvas-gated route. The durable fix is to derive `_CANVAS_PATHS`
from `CANVAS_GATED_PATHS` rather than re-typing it — the same "never retyped" rule
`descriptors.py` states for its own derivation.
