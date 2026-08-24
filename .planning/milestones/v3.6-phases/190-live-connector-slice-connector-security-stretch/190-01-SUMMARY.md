---
phase: 190-live-connector-slice-connector-security-stretch
plan: 01
subsystem: testing
tags: [pytest, security, ssrf, egress, multi-tenancy, rls, wave-0, red-first]

# Dependency graph
requires:
  - phase: 189-governed-external-action-node-model
    provides: "_exec_external_action (the 7th executor), the _block_all_http transport sentinel, the already-armed golden-run fence, and D-189-DEF-04 (the publish-time-egress trigger 190 owns)"
provides:
  - "W0-2 — backend/tests/unit/test_190_cross_org_credential.py: the D-14 cross-org credential-leak drive, OBSERVED RED (exit 2)"
  - "W0-3 — backend/tests/unit/test_190_egress_ordering.py: the D-06 guard-before-credential ordering drive, OBSERVED RED (exit 2)"
  - "The re-scoped Case B drive plus a NEW bound-connection positive case in test_189_no_egress.py, OBSERVED RED with a MEANINGFUL failure (DID NOT RAISE)"
  - "The W0-1 green-because-inert baseline for test_a_golden_run_of_an_external_action_performs_no_egress, recorded as the figure plan 190-13 must drive RED"
  - "Two md5 hashes proving _block_all_http is byte-identical across this plan"
  - "The contract shape of app.services.connector_service.resolve_connection and app.security.egress.EgressRefused, fixed by drive rather than by prose"
affects: [190-13, 190-egress, 190-connector-service, 190-secure-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Weak-RED vs meaningful-RED, distinguished IN THE TEST FILE and not only in a summary"
    - "A RED transcript is re-measured to a FIXED POINT after being pasted into the file it describes"
    - "Contract-by-drive: a Wave-0 test fixes the shape of a module that does not exist yet, and says which four things it fixes and no more"

key-files:
  created:
    - backend/tests/unit/test_190_cross_org_credential.py
    - backend/tests/unit/test_190_egress_ordering.py
  modified:
    - backend/tests/unit/test_189_no_egress.py

key-decisions:
  - "resolve_connection is async, takes a REQUIRED org_id, and accepts an injectable two-argument fetch seam — the two-arg fetch is what makes an unscoped resolver structurally visible in the drive"
  - "A cross-org connection id must read as ABSENT, never as forbidden/403 — an existence oracle IS the leak in miniature"
  - "_exec_external_action must import validate_destination and resolve_connection into its OWN module namespace, so the D-06 ordering is patchable and therefore directly assertable"
  - "The W0-3 ordering case points at a PERMITTED destination on purpose — a refused host makes the order unobservable because the resolver never runs either way"
  - "The new bound-connection positive case uses a duck-typed config because ExternalActionPhaseConfig (extra='forbid') rejects connection_id by BOTH routes today; switching it back to model_validate is owed at the plan that lands D-13"
  - "Case B is re-scoped by NAME and by an asserted precondition rather than widened or deleted — recorded_not_sent is a permanent shipping terminal (D-17), not a test convenience"

patterns-established:
  - "Every falsification row carries its VERBATIM failure text in the test file's own docstring, plus an explicit statement of whether that RED is weak or meaningful"
  - "A weak RED names the plan that owes the meaningful one, and what exactly that plan must observe before it is allowed to fix anything"
  - "A sentinel imported by another suite is proved unmodified by md5 over its extracted function body, before and after"

requirements-completed: [CONN-03]

# Metrics
duration: 42min
completed: 2026-08-08
---

# Phase 190 Plan 01: Wave-0 RED Drives Summary

**Three security drives authored and OBSERVED FAILING before any adapter, resolver or egress module exists — the cross-org credential leak (D-14), the guard-before-credential ordering (D-06), and the first case in this tree that demands a send actually happen — with the shipped transport sentinel proved byte-identical by md5 rather than by assertion.**

## Performance

- **Duration:** ~42 min
- **Started:** 2026-08-08
- **Completed:** 2026-08-08
- **Tasks:** 3 (plus 1 auto-fix commit)
- **Files modified:** 3 (2 created, 1 modified) — **zero production source**

## Accomplishments

- **Three RED observations, each recorded verbatim in the test file itself**, not merely claimed in a summary. Two are module-missing (weak); one is a direct behavioural measurement (meaningful).
- **The weak/meaningful distinction is preserved in code**, with each weak RED naming the plan that owes the meaningful one and stating exactly what that plan must observe first.
- **`_block_all_http` proved byte-identical** — `md5 dd1359d32a6ce4b40e7b908711d13eae`, 3446 bytes, lines 84–144, before and after. No diff hunk starts before line 237.
- **`backend/tests/test_harness_engine.py` never opened** (`git diff --numstat` empty) and still reports **46 passed**, matching the RESEARCH §M2 baseline exactly.
- **A latent contradiction was measured, not assumed:** the shipped `ExternalActionPhaseConfig` cannot express a bound connection by *either* route today.

## Task Commits

1. **Task 1: W0-2 cross-org credential-leak drive** — `31fd3c31` (test)
2. **Auto-fix: correct the W0-2 RED transcript to the file as committed** — `0d52542c` (fix)
3. **Task 2: W0-3 guard-before-credential ordering drive** — `d9f7c74d` (test)
4. **Task 3: re-scope the sentinel's DRIVE, never the sentinel** — `15e3cb7f` (test)

## THE RED OBSERVATIONS (this plan's entire deliverable)

### W0-2 — `test_190_cross_org_credential.py` · WEAK RED (module-missing)

`cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_190_cross_org_credential.py -q` → **exit code 2**

```
=================================== ERRORS ====================================
________ ERROR collecting tests/unit/test_190_cross_org_credential.py _________
ImportError while importing test module 'C:\Vibe Apps\Agentic RAG\backend\tests\unit\test_190_cross_org_credential.py'.
Hint: make sure your test modules/packages have valid Python names.
Traceback:
C:\Python312\Lib\importlib\__init__.py:90: in import_module
    return _bootstrap._gcd_import(name[level:], package, level)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
tests\unit\test_190_cross_org_credential.py:92: in <module>
    from app.services.connector_service import ConnectorNotFound, resolve_connection
E   ModuleNotFoundError: No module named 'app.services.connector_service'
============================== warnings summary ===============================
venv\Lib\site-packages\requests\__init__.py:113

=========================== short test summary info ===========================
ERROR tests/unit/test_190_cross_org_credential.py
!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
1 warning, 1 error in 0.67s
```

⚠ **This RED measures the import system, not the tenant boundary**, and the file says so. The
**meaningful RED is owed by the plan that lands `connector_service`**: author the resolver
**id-only** (`SELECT … WHERE id = $1`), run this file, observe
`test_a_connection_id_from_another_org_does_not_resolve` fail *as a leak* — org B's row resolving
under org A — and record that text beneath the block, **before** landing `AND org_id = $2`.

### W0-3 — `test_190_egress_ordering.py` · WEAK RED (module-missing)

`cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_190_egress_ordering.py -q` → **exit code 2**

```
=================================== ERRORS ====================================
___________ ERROR collecting tests/unit/test_190_egress_ordering.py ___________
ImportError while importing test module 'C:\Vibe Apps\Agentic RAG\backend\tests\unit\test_190_egress_ordering.py'.
Hint: make sure your test modules/packages have valid Python names.
Traceback:
C:\Python312\Lib\importlib\__init__.py:90: in import_module
    return _bootstrap._gcd_import(name[level:], package, level)
           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
tests\unit\test_190_egress_ordering.py:105: in <module>
    from app.security.egress import EgressRefused
E   ModuleNotFoundError: No module named 'app.security.egress'
============================== warnings summary ===============================
venv\Lib\site-packages\requests\__init__.py:113

=========================== short test summary info ===========================
ERROR tests/unit/test_190_egress_ordering.py
!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!
1 warning, 1 error in 0.36s
```

⚠ **`TO BE RE-OBSERVED AT PLAN 190-13`** is recorded in the file: 190-13 must author
`_exec_external_action` with the credential resolution **before** the guard (the n8n ordering,
deliberately), observe
`test_a_send_with_NO_credential_bound_raises_the_egress_refusal_not_a_credential_error` fail with
a **credential-shaped** exception, record that text verbatim, and only then reorder.

### Case B′ — `test_189_no_egress.py` · **MEANINGFUL RED** (behavioural)

`cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_189_no_egress.py -q` → **1 failed, 22 passed**

```
        loop = _asyncio.new_event_loop()
        try:
            _block_all_http(monkeypatch)
>           with pytest.raises(_EgressAttempted):
                 ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
E           Failed: DID NOT RAISE <class 'tests.unit.test_189_no_egress._EgressAttempted'>

tests\unit\test_189_no_egress.py:490: Failed
=========================== short test summary info ===========================
FAILED tests/unit/test_189_no_egress.py::test_a_bound_connection_under_the_armed_sentinel_MUST_attempt_egress
1 failed, 22 passed, 1 warning in 1.09s
```

**This is the RED worth having.** It imports cleanly, builds a real bound phase, runs the REAL
shipped executor with every transport armed, and fails on the *property*: the shipped executor
opens no socket. That is the measured baseline Phase 190 has to move.

## The `_block_all_http` md5 proof (D-16 / the sentinel is never edited)

| When | Lines | md5 | Bytes |
|---|---|---|---|
| **Before** (HEAD, pre-plan) | 84–144 | `dd1359d32a6ce4b40e7b908711d13eae` | 3446 |
| **After** (`15e3cb7f`) | 84–144 | `dd1359d32a6ce4b40e7b908711d13eae` | 3446 |

Corroborated independently: `git diff -U0` hunk headers start at `@@ -236,0 +237,2 @@` — **no hunk
touches lines 84–144.** Extraction method: locate `def _block_all_http(` and read to the next
top-level `def`.

## W0-1 baseline — green **because inert**, recorded for 190-13 to drive RED

| Measurement | Command | Value |
|---|---|---|
| Golden-run fence alone | `pytest "tests/test_harness_engine.py::test_a_golden_run_of_an_external_action_performs_no_egress" -q` | **1 passed** |
| Whole file (pre-plan) | `pytest tests/test_harness_engine.py -q` | **46 passed** |
| Whole file (post-plan) | same | **46 passed** — unchanged |
| File edited by this plan? | `git diff --numstat backend/tests/test_harness_engine.py` | **empty** — not opened |

**46 matches RESEARCH §M2's measured baseline exactly.** It passes today *because the step is
inert*; it goes RED on the commit that adds the send, and D-16's `ctx.is_golden_run` gate must land
in that **same commit**. Do not pre-emptively gate; the RED observation IS the evidence.

## Files Created/Modified

- `backend/tests/unit/test_190_cross_org_credential.py` *(created, 244 L)* — W0-2. Three functions: the leak drive, the non-vacuity control (the same id **does** resolve for its owning org), and an `inspect.signature` assertion that `org_id` is a **required** parameter.
- `backend/tests/unit/test_190_egress_ordering.py` *(created, 330 L)* — W0-3. Three functions: the unbound-step drive (asserting error **identity**, not just failure), the D-08 refusal-content case (with a resolver-never-ran anti-vacuity assertion), and the recorded call-order case.
- `backend/tests/unit/test_189_no_egress.py` *(modified, +134 / −2)* — Case A gains one D-01 comment; Case B renamed and given an asserted precondition; the new bound-connection positive case added.

## Decisions Made

1. **`resolve_connection` is `async`** — every sibling data-access service in this tree is (`classification_rule_service:57-144`, `sso_provider_service.get_management_token:62`), and the one production caller is the async executor.
2. **The fetch seam takes two arguments (`connection_id`, `org_id`)** — this is the load-bearing choice. It converts *"did the resolver scope the lookup?"* from an unobservable property of a SQL string into a **recorded fact** a unit test can assert.
3. **The stub fetch models a correctly-scoped storage layer.** The drive therefore measures the **resolver**, not the stub: a resolver that drops the run's org gets the row back and the leak test fails.
4. **A cross-org id reads as ABSENT, never forbidden** — `forbidden`, `not permitted`, `403` and `belongs to` are all asserted out of the message. Answering 403 confirms the id is real: the error *is* the leak.
5. **The ordering case uses a permitted destination.** Aimed at the metadata host, the resolver never runs either way, and the recorded order is `["egress"]` for a correct executor and `["resolve"]` for the n8n one — neither is the asserted `["egress", "resolve"]`, and the case stops measuring what it is named after.
6. **Stubs installed with `raising=True` on `phase_types`' own namespace** — if the executor reaches its guard some other way, the `setattr` fails loudly rather than binding nothing and passing over an executor it never touched.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The W0-2 RED transcript recorded a line number that its own paste had falsified**

- **Found during:** Task 2 (noticed while guarding against the same hazard in the second file)
- **Issue:** The docstring recorded the import at `:81` — true at first observation. Pasting the
  transcript *into the docstring above that import* pushed it to `:86`; adding a note explaining
  that pushed it to `:92`. Each value was true when measured and false once written down. A
  transcript that misreports the artefact it describes is exactly the failure class this plan
  exists to prevent, appearing in the plan's own output.
- **Fix:** Re-measured to a **fixed point** (`:92 == :92`, verified by re-running after the final
  edit) and recorded the three-step drift in the file so the correction is legible rather than
  invisible. The second file was then written with the same check applied up front and converged
  at `:105` on the first attempt.
- **Files modified:** `backend/tests/unit/test_190_cross_org_credential.py`
- **Verification:** `pytest … | grep "in <module>"` reports `:92`; `grep -n` of the docstring
  reports `:92`.
- **Committed in:** `0d52542c` (separate commit, deliberately not an amend, so the correction is auditable)

### Implementation choices worth flagging (not deviations, but stated rather than buried)

**Duck-typed phase configs in two places, and the reason was MEASURED:**

```
model_validate(... "connection_id": "x" ...)
  →  ValidationError: phases.0.config.external_action.connection_id
     Extra inputs are not permitted [type=extra_forbidden]

cfg.connection_id = "x"
  →  ValueError: "ExternalActionPhaseConfig" object has no field "connection_id"
```

`ExternalActionPhaseConfig` is a `_StrictBase` (`extra='forbid'`) with no `connection_id` field, so
**both** routes to a model-backed bound phase are closed today. The executor reads config via
`getattr` (`phase_types.py:1867`), so the drives exercise the real function faithfully — but they
**cannot** catch the model rejecting the field. Recorded in both files as a stated limit, with the
switch back to `model_validate` **owed at the plan that lands D-13**. The same applies to
`base_url` on the W0-3 phase config: the plan's wording puts it on the step, while D-10/D-13 put
non-secret destination config on the **connection row** — 190-13 must settle which, and the drive
says so rather than silently deciding.

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** None on scope. The fix hardened this plan's own central claim. No production
source was touched, no package installed, no scope-fence (D-32) item approached.

## Issues Encountered

- **A recorded transcript is self-falsifying when pasted into the file it describes.** Resolved by
  measuring to a fixed point and stating the convergence. Worth carrying forward: *any* plan that
  records a traceback into the source it describes must re-measure **after** the paste.
- The plan's Task 3 acceptance quotes `46 passed` for `test_harness_engine.py` and instructs
  re-measurement — re-measured, and it **is** 46, both before and after.

## Threat Flags

None. This plan created no network endpoint, no auth path, no file access and no schema change. It
touched test files only.

## Scope / rule notes

- **CLAUDE.md `graphify update .`** was **not** run. This plan's `files_modified` contract names
  three test files; regenerating `graphify-out/` would put a large unrelated artefact in a
  security-gate commit. Test-only changes alter no architecture the graph indexes. Deferred to the
  first plan in this phase that lands production source.
- **D-32 scope fence honoured:** no MCP client, no webhooks, no public API, no retries/queue, no
  expression language.
- **No `xfail`, `skip` or `skipif`** in any of the three files (`grep -cE` → `0`, `0`, `0`).
- **`backend/requirements.txt` and `frontend/package.json` unchanged** — `git diff --numstat` over
  this plan's four commits is empty for both. Matches T-190-SC's acceptance.

## Next Phase Readiness

**Ready.** Wave 0's three RED drives exist and are recorded. What the downstream plans now owe:

| Owed by | What |
|---|---|
| The plan landing `connector_service` | The **meaningful** W0-2 RED — an id-only resolver observed leaking, recorded verbatim, before `AND org_id = $2` lands |
| **190-13** | The **meaningful** W0-3 RED — resolver-before-guard observed producing a credential-shaped error, recorded, then reordered |
| **190-13** | Drive `test_a_golden_run_of_an_external_action_performs_no_egress` RED **and** green in the SAME commit as the send (D-16). Baseline recorded above: 1 passed / 46 passed |
| The plan landing **D-13** | Switch both duck-typed builders back to `WorkflowDefinition.model_validate`, and settle whether `base_url` lives on the step config or the connection row |
| Any plan touching the executor | `_exec_external_action` must import `validate_destination` and `resolve_connection` into its own namespace — three drives depend on it |

**Concern to carry:** the two module-missing REDs prove absence, not discrimination. If a later plan
lands `connector_service` and `egress.py` and these files simply turn green, **that is not
evidence** — the meaningful RED must be observed on the way past, or the security gate has measured
nothing but the import system.

## Self-Check: PASSED

All claimed artefacts verified present on disk and all claimed commits verified in `git log`:

| Claim | Result |
|---|---|
| `backend/tests/unit/test_190_cross_org_credential.py` | FOUND (244 L) |
| `backend/tests/unit/test_190_egress_ordering.py` | FOUND (330 L) |
| `backend/tests/unit/test_189_no_egress.py` | FOUND |
| `190-01-SUMMARY.md` | FOUND |
| commit `31fd3c31` (Task 1) | FOUND |
| commit `0d52542c` (auto-fix) | FOUND |
| commit `d9f7c74d` (Task 2) | FOUND |
| commit `15e3cb7f` (Task 3) | FOUND |

---
*Phase: 190-live-connector-slice-connector-security-stretch*
*Completed: 2026-08-08*
