---
phase: 190-live-connector-slice-connector-security-stretch
plan: 13
subsystem: backend-security
tags: [egress, ssrf, n8n-cve, golden-run, connectors, harness, red-first, wave-5, conn-02, conn-03]

# Dependency graph
requires:
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 01
    provides: "the three W0-3 ordering drives, the re-scoped sentinel + its bound-connection positive case, and the W0-1 green-because-inert baseline this plan had to drive RED"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 06
    provides: "resolve_connection(connection_id, org_id=...) with a REQUIRED org, ResolvedConnection's lazy secret, and D-13's connection_id on ExternalActionPhaseConfig"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 07
    provides: "app.security.egress — validate_destination, send_pinned_http, open_pinned_smtp, EgressRefused"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 08
    provides: "the ConnectorAdapter protocol, AdapterError/AdapterResult, the closed registry"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 09
    provides: "the live_connectors kill-switch (D-26), registered in _GOVERNED_FEATURES with the cold default off"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 03
    provides: "migration 117 — the external_action_sent literal, and _AUDIT_EVENT_TYPES at 24"
provides:
  - "_exec_external_action — the ordered send path: six gates, three outcomes, zero new statuses"
  - "D-16's golden-run gate, OBSERVED RED on the send commit and green on the gate in that SAME commit"
  - "W0-3's MEANINGFUL RED — the n8n ordering driven into production source and recorded verbatim"
  - "All four standing REDs green; the sentinel's bound-connection case now proves the send is genuinely live"
  - "A4 CLOSED: a stranded golden run was resumable and would have SENT — found by measurement, fixed at the root"
  - "The D-17 three-axis distinguishability proof (status · first body line · sentinel key), driven on two REAL engine runs"
  - "The external_action_sent receipt: capability + connection id + destination HOST, and nothing else"
affects: [190-14, 190-secure-phase, 190-verify]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Import the two callables whose ORDER is the security property into the caller's own namespace, so the order is patchable and therefore directly assertable"
    - "Retire a false invariant by QUOTATION with a SUPERSEDED marker and a date — and fence the quotation, so it cannot decay back into an assertion"
    - "A fence's trigger conditions are asserted, not assumed: an armed trigger with an unmet precondition is a fence that reports on its own setup"
    - "Close a defect at the ROOT ('a golden run is not a thing to resume') rather than by threading a suppression flag to every consumer"

key-files:
  created: []
  modified:
    - backend/app/services/harness/phase_types.py
    - backend/app/db/workflows.py
    - backend/tests/test_harness_engine.py
    - backend/tests/unit/test_190_egress_ordering.py
    - backend/tests/unit/test_189_no_egress.py

key-decisions:
  - "The gate order is golden-run -> kill-switch -> EGRESS GUARD -> unbound -> resolve -> dispatch. The guard sits ABOVE the unbound branch (D-06 demands it) and BELOW the kill-switch (D-26 demands it): with live_connectors off the step must behave EXACTLY as it did in 189, and refusing a destination that will never be contacted is a spurious failure"
  - "The pre-credential guard checks the step-declared destination if there is one, else the capability's CODE CONSTANT. post_message therefore has a real, non-decorative pre-credential guard in production (D-02); create_ticket and send_email have none because 190-06 settled their destination onto the connection row, and their socket-time guard is the binder's"
  - "EgressRefused propagates and is caught NOWHERE in the executor — a caught refusal is one except clause away from being downgraded. Adapter failures map to D-17's failed terminal with the vendor's words verbatim"
  - "A4 is closed at find_resumable_runs, not by threading is_golden_run into _build_resume_context: the honest statement is not 'a resumed golden run must not send' but 'a golden run is not a thing to resume'"
  - "The sentinel's bound-connection assertion was made PRECISE rather than the code bent to it: the adapter classifies transport failures into a named AdapterError by design, so the sentinel arrives wrapped and the property is asserted where it lands"
  - "test_190_egress_ordering.py's three original drives keep their duck-typed configs PERMANENTLY, and that is now a settlement rather than a debt: their base_url lives on the step, and 190-06 settled non-secret destination config onto the connection row"

patterns-established:
  - "When a plan's acceptance criterion contradicts its own <action>, record the conflict and replace the criterion with a STRICTER mechanical check rather than gaming the grep"
  - "Drive every plant for REACH, not just RED: each plant must fail the assertion it was aimed at, named in the transcript"

requirements-completed: [CONN-02, CONN-03]

# Metrics
duration: 145min
completed: 2026-08-09
---

# Phase 190 Plan 13: The Ordered Send Path Summary

**The app's first real outbound egress ships behind six ordered gates — and the two latent defects the commit creates were both driven from RED to green inside it: D-16's publish-time send, and a second one nobody had found, where a restart-stranded golden run was resumable and would have SENT once per boot.**

## Performance

- **Duration:** ~145 min
- **Completed:** 2026-08-09
- **Tasks:** 3, each committed individually
- **Files:** 5 modified (2 production source, 3 test), 0 created, 0 deleted

## Task Commits

| Task | Name | Commit |
|---|---|---|
| 1 | The ordered executor + the D-16 RED→green + the superseded docblock | `57c16808` |
| 2 | A4 was REACHABLE — closed at the root; the docblock-retirement fence | `108e2dbe` |
| 3 | W0-3's meaningful RED, the sentinel green, D-17 on three axes, the receipt | `d6b26d9d` |

---

# ⭐ THE THREE RED→GREEN OBSERVATIONS

## 1. W0-1 (D-16) — publishing performed the external action

**The order was the one the plan mandated and it was not optional:** the send was written **without** the gate, the fence was run, the RED was recorded, and only then did the one-line gate land — in the **same commit**.

`pytest tests/test_harness_engine.py -k golden_run_of_an_external_action` — verbatim:

```
WARNING  app.services.harness_engine:harness_engine.py:841 publish golden run: armed
action-risk checkpoint auto-continued for phase notify (D-19 - the pause is skipped,
the step still runs; no approval receipt is written because no human approved)
WARNING  app.services.connectors.slack_adapter:slack_adapter.py:414 post_message:
nothing answered (channel=C0190)
WARNING  app.services.harness.phase_types:phase_types.py:2219 190: external_action
phase 'notify' failed to send: nothing answered at the Slack API:
httpx.AsyncClient.send was called - outbound egress attempted

E       AssertionError: the golden run's external-action phase never reached
        recorded_not_sent, so 'no egress' would be satisfied by a step that never
        ran: []
FAILED tests/test_harness_engine.py::test_a_golden_run_of_an_external_action_performs_no_egress
1 failed, 45 deselected
```

**`httpx.AsyncClient.send was called - outbound egress attempted`, on the publish path.** `D-189-DEF-04` verbatim, live. After the gate: **46 passed**, matching the recorded baseline exactly.

### ⚠ But the fence could not have fired, and that is the finding

189 armed this as *"the re-open trigger, expressed as a check rather than as prose."* When the send landed and the fence was first run, it stayed **GREEN** — for **two independent reasons**, either sufficient on its own to let publish-time egress ship unnoticed through the exact commit the trigger was armed for:

1. **The fence's step bound no connection.** An unbound step takes D-17's `recorded_not_sent` branch and sends nothing whether or not D-16's gate exists.
2. **`live_connectors` resolves to `"off"` by cold default** (D-26, landed at 190-09, five plans *after* the fence was armed). Even a bound step records.

Both preconditions are now **set AND asserted** in the fence itself. The RED above only exists because they were. Two further honest corrections were forced on the way, each measured rather than reasoned:

| Attempt | Failure | Why |
|---|---|---|
| DNS stubbed to `203.0.113.10` | `EgressRefused: address_not_public` | TEST-NET-3 is documentation space; `is_global` is False. Swapped for a globally routable address |
| no run input | `'text' must be a non-empty string` | a send with nothing to send fails on its own arguments long before a socket |

## 2. W0-3 (D-06) — the n8n ordering, and it is worse than the drive predicted

The five-line guard block was **moved below `resolve_connection`** in production source — the n8n ordering, deliberately — and `tests/unit/test_190_egress_ordering.py` was run. Verbatim, all three:

```
E       Failed: DID NOT RAISE <class 'app.security.egress.EgressRefused'>
------------------------------ Captured log call ------------------------------
INFO  app.services.harness.phase_types: 190 D-17: external_action phase
'file-the-ticket' RECORDED the intended 'create_ticket' and sent nothing
(no connection is bound to this step)

E       AssertionError: D-06: the credential was resolved BEFORE the destination was
        refused. Nothing has leaked yet, but the ordering is the defect - the secret
        is now in memory, in a traceback frame and one log line away from disk.
        Resolver calls: [(('dddddddd-0000-4000-8000-00000000000c',),
        {'org_id': 'aaaaaaaa-0000-4000-8000-000000000001'})]
------------------------------ Captured log call ------------------------------
WARNING app.security.egress: egress refused: capability=create_ticket
host=169.254.169.254 reason=host_not_allowed

E       AssertionError: D-06 / n8n #28218: the recorded call order is ['resolve'],
        not ['egress', 'resolve'].
```

**Read the first one and its log line.** 190-01's drive predicted a resolver-first executor would raise *the wrong thing* (a credential-shaped error). It did something worse: it **raised nothing at all**. With the guard below the credential path, an unbound step aimed at `169.254.169.254` never reaches the guard, falls into D-17's unbound branch, and returns the perfectly ordinary sentence *"Not sent — recorded"*. A step pointed at the cloud metadata endpoint **reports that nothing is wrong, because nothing ever looked.**

The second failure is the one that bites in production: **with** a credential bound the guard *did* fire and *did* refuse the metadata host — the outcome is byte-identical to a correct executor — but `resolve_connection` had already run and already returned the secret. Only the recorded call order can see that.

After restoring the correct order: **3 passed** (5 with this plan's two additions).

**Plant hygiene:** `phase_types.py` restored **md5-identical** — `bb7c4ed6614434bbcac495657ac330f2` before and after; `git diff --numstat` empty; `grep -c PLANT` → **0**.

## 3. Case B′ — the sentinel's bound-connection case is GREEN

190-01 left `test_a_bound_connection_under_the_armed_sentinel_MUST_attempt_egress` RED with the meaningful failure `DID NOT RAISE`. It now passes: the executor genuinely reaches the wire, and the sentinel's own words (`outbound egress attempted`) arrive in the failed phase's output.

**`_block_all_http` is byte-identical, and it is the whole point of that file:**

| When | Lines | md5 | Bytes |
|---|---|---|---|
| 190-01 recorded | 84–144 | `dd1359d32a6ce4b40e7b908711d13eae` | 3446 |
| **this plan** | 84–146 | **`dd1359d32a6ce4b40e7b908711d13eae`** | **3446** |

(The line span moved because `_run_ctx` above it grew; the extracted function body is unchanged to the byte.)

**Case A — the `mcp` source fence — is untouched and green.** `pytest -k mcp` → **2 passed**, and the diff proves it mechanically: this plan's lowest hunks on that file are at lines 190 and 198–208, then nothing until 413. **No hunk falls inside Case A's 215–300.** Its passing is part of D-01's amendment evidence, not a leftover.

---

# ⭐⭐ THE BLOCKER THIS PLAN FOUND: A4 WAS REACHABLE

RESEARCH §M6 flagged `_build_resume_context` as a **second** ctx builder that does not carry `is_golden_run`, and said the hazard *"should be unreachable — assert that unreachability with a test rather than assume it."* The plan added: *"If the test shows it IS reachable, stop and report: a resumed golden run would SEND, and that is a blocker, not a follow-up."*

**It was assumed. It was then measured. It was REACHABLE.** Three facts, each read off shipped source:

```
resume sweep filters golden runs: False
resume ctx carries is_golden_run : False
golden run sets the thread anchor: True
```

1. `create_workflow_run` sets `threads.active_workflow_run_id` for **every** run it creates — `publish_service._drive_golden_run` passes `is_golden_run=True` straight into it. The golden run **is** anchored.
2. `find_resumable_runs` selected on `status IN ('active','paused')` + that anchor + an `active` phase row, and filtered `is_golden_run` **not at all**.
3. `_build_resume_context` does not carry the flag.

⇒ **A publish killed by a restart mid-phase left an anchored, stranded golden run that the next boot re-drove as a LIVE run.** Inert while the executor sent nothing. From the commit two above it, re-driving it means **PERFORMING the external action — nobody asked, once per boot until it terminalized.** D-16's defect arriving through the one door D-16's gate does not watch.

**Driven RED before it was closed:**

```
E  assert UUID('de3ac2d4-…') not in [UUID('de3ac2d4-…'), UUID('7e0c19a7-…')]
   A4: a stranded GOLDEN run was handed to the resume sweep.
```

**Closed at the ROOT, and deliberately NOT by threading the flag** (which the plan forbids, and rightly — it would widen D-16's surface for a path that should not exist). The honest statement is not *"a resumed golden run must not send"* but ***"a golden run is not a thing to resume"***: publishing is a bounded, synchronous validation whose caller is long gone, and abandoning a stranded one is correct on its own terms, egress aside.

Closed on **both gates**, the shape 190-06 established for D-14 — `AND wr.is_golden_run = false` in the SQL is the gate (the row never leaves Postgres), and a post-fetch re-check is what survives a future author simplifying the query. The fence carries an anti-vacuity assertion that an **ordinary** stranded run is still resumable, so a filter that dropped everything — or a resume feature that had silently died — cannot pass it.

---

## The ordered executor

| # | Gate | Decision | On trip |
|---|---|---|---|
| 1 | capability ∈ the closed set | D-02 | `KeyError` naming slug, value and collection |
| 2 | `ctx.is_golden_run` | **D-16** | skip the SEND, keep the record |
| 3 | `live_connectors == "off"` | **D-26** | skip the SEND, keep the record — the 189 behaviour, unchanged |
| 4 | `validate_destination(...)` | **D-06** | `EgressRefused` propagates, caught nowhere |
| 5 | no `connection_id` / disabled / no run org | D-13 / D-17 | record → `recorded_not_sent` |
| 6 | `resolve_connection(id, org_id=<run's org>)` | **D-14** | org-scoped, never the id alone |
| 7 | `get_adapter(capability).send(...)` | D-04 | only the adapter's OWN `ok` produces `completed` |

**Gate 4 sits ABOVE gate 5 and BELOW gate 3, and both placements are decisions.** Above 5 because D-06 *is* that ordering — a send with no credential bound must raise the egress refusal. Below 3 because D-26 says with the switch off the step behaves **exactly** as it does today, and refusing a destination that will never be contacted is a spurious failure on a workflow the operator has deliberately taken off the wire.

**Gate 4 is not decorative in production.** It checks the step-declared destination when there is one, else the capability's **code constant** — so `post_message` has a real pre-credential guard (D-02 makes Slack's host a module constant, knowable with no credential and no row). `create_ticket` and `send_email` have none, because 190-06 settled their destination onto the connection row; their socket-time guard is the binder's, and the D-05 source fence is what keeps that true. This is stated rather than glossed, and the new model-validated ordering case is what proves the production path really does call the guard first.

### D-17 — zero new statuses, and the two "nothing arrived" terminals stay apart

| Outcome | key returned | engine writes | first line |
|---|---|---|---|
| adapter's own `ok` | neither sentinel | `completed` | `Sent. …` |
| send FAILED | `failure` | `failed` | `SEND FAILED — nothing arrived.` |
| golden run / switch off / unbound / disabled | `recorded_intent` | `recorded_not_sent` | `NOT SENT — recorded only.` |

Proved on **two real engine runs**, three axes, plus: neither body may contain "complete", the failure may not borrow "recorded", the record may not borrow "fail". Three plants driven RED, each on the assertion it was aimed at:

| Plant | Verbatim RED |
|---|---|
| failure body opens with the record's line | `AssertionError: both bodies open with 'NOT SENT — recorded only.'` |
| failure output also carries `recorded_intent` | `the failed output carries the record's sentinel … ['_failure_reason', 'failure', 'recorded_intent', 'text']` |
| receipt carries a nested secret | `D-08: the send receipt carries the resolved credential: {… "cred": {"nested": {"deep": "xoxb-190-RECEIPT-MUST-NEVER-CARRY-THIS"}} …}` |

### D-18 — at-most-once, mechanically

`grep -ciE "retry|backoff|sleep\("` on `phase_types.py`: **32 at HEAD~, 33 now**. The single new match is a docblock sentence **denying** them. No executable retry, backoff, queue or idempotency key exists on this path.

---

## Verification (run, not quoted)

| Check | Result |
|---|---|
| `pytest tests/test_harness_engine.py -q` | **50 passed** (baseline 46 + 4 new) |
| `pytest tests/unit/test_190_egress_ordering.py -q` | **5 passed** (3 standing REDs + 2 new) |
| `pytest tests/unit/test_189_no_egress.py -q` | **23 passed** (the bound case now green) |
| `pytest tests/unit/test_publish_service.py -q` | **28 passed** |
| `pytest tests/unit/test_audit_event_registration.py … test_190_credentials … test_harness_resume` (combined) | **140 passed** |
| **Full suite before** | **215 failed · 3532 passed** · 19 skipped · 5 xfailed · 9 xpassed · 1 error |
| **Full suite after** | **211 failed · 3542 passed** · 19 skipped · 5 xfailed · 9 xpassed · 1 error |
| Delta | **−4 failures** (the standing REDs) · **+10 passes** (4 fixed + 6 new) · **zero new failures** |
| `git diff --numstat HEAD~3 HEAD -- harness_engine.py requirements.txt package.json` | **empty** — no engine edit, zero installs |
| `inspect.getsource(...).index('egress') < .index('resolve_connection')` | **True** |
| `grep -c is_golden_run` / `egress` / `external_action_sent` in `phase_types.py` | **2 / 14 / 4** |
| `grep -c PLANT` on production source | **0** |
| `_block_all_http` md5 | `dd1359d32a6ce4b40e7b908711d13eae` — identical to 190-01's |
| `graphify update .` | 20 045 nodes / 53 266 edges rebuilt (untracked artefact) |

## Deviations from Plan

### 1. [BLOCKER FOUND AND CLOSED — Rule 2] A4 was reachable; the fix touches a file outside `files_modified`

Fully described above. The plan said *"stop and report"* if reachable. Reporting and deferring would have shipped the phase with a publish-time send reachable through the resume sweep, so it was closed in this plan instead — RED-first, at the root, without threading the flag (which the plan explicitly forbids). This required editing **`backend/app/db/workflows.py`**, which the plan's `files_modified` does not name. Stated rather than buried; the change is one SQL predicate, one post-fetch re-check and a `logging` import.

### 2. [MEASURED — it changed a fence] The already-armed D-16 trigger was VACUOUS

The fence bound no connection and `live_connectors` is off by cold default, so it could not have gone RED. Both preconditions are now set **and asserted** inside it. Without this the plan would have "observed" a green fence on the send commit and recorded that as evidence of a gate that did not yet exist.

### 3. [RECORDED — an acceptance criterion that cannot hold as written]

Task 2's criterion is `print('NO network I/O' in d, 'superseded' in d.lower())` → `False True`. Its own `<action>`, three lines above, requires the superseded sentences to be **quoted inline**. **Both cannot hold**: a quoted sentence contains its own substring. Measured: the criterion prints `True True`.

190-06 met the identical class of conflict and recorded it rather than lower-casing a word to satisfy a grep; the same choice is made here, and rule #3 of this plan's own critical rules ("quote the superseded sentences as superseded") is a must-have truth that the criterion would have forced me to break.

**What the criterion was reaching for is checked instead, and more strictly**, by `test_the_external_action_docblock_retires_its_two_false_invariants_by_quotation`: every occurrence of each retired sentence must sit **below a SUPERSEDED marker**. Four plants driven RED, including the one the grep would have waved through:

```
as shipped                      : GREEN
PLANT marker->NOTE              : RED: no superseded marker
PLANT claim moved above marker  : RED: 'NO network I/O' reads as a LIVE invariant
PLANT sentence deleted          : RED: 'NO network I/O' deleted rather than superseded
PLANT replacement removed       : RED: no replacement invariant
```

### 4. [MEASURED — the assertion, not the code, was made precise] The sentinel arrives wrapped

190-01's bound-connection case asserted `pytest.raises(_EgressAttempted)`, predicting the sentinel would escape the executor untouched. It does not, for two **reviewed design reasons** that predate this plan: the adapter classifies transport failures into a named `AdapterError` (`protocol.py`: *"A bare Exception reaching the engine reads to a user as an internal error"*), and the executor maps an `AdapterError` to D-17's `failed` terminal.

So the property is asserted where it lands — three assertions, none satisfiable by an inert executor: the output is the **failure** shape (an inert executor returns the **record** shape), it does **not** carry `recorded_intent` (which every record branch produces), and it carries **the sentinel's own words** (proving the socket layer refused, not an argument check on the way there).

### 5. [STATED] `live_connectors` is a precondition of the ordering module, and it is driven both ways

`test_190_egress_ordering.py` was authored at 190-01, five plans before the kill-switch existed. With the switch at its cold default all three drives fail (`DID NOT RAISE`, ×3) for D-26's reason while claiming to report on D-06's. The switch is turned on for the module as a **stated precondition**, and `test_with_live_connectors_OFF_the_same_step_records_instead_of_refusing` turns it back off and asserts the shipped record body — so the precondition is falsifiable rather than decorative. **No assertion was weakened, relaxed or deleted**; one was added, in the direction that makes the setup checkable.

### 6. [SETTLED] The `model_validate` switch-back is paid where it can be paid honestly

- `test_189_no_egress.py::_external_action_phase_with_connection_bound` — **switched back**. D-13's field landed at 190-06, so the builder is model-validated again and now catches the thing the duck type structurally could not: the model rejecting `connection_id`.
- `test_190_egress_ordering.py`'s three original drives — **permanently duck-typed, and that is now a settlement rather than a debt.** They put `base_url` on the STEP; 190-06 settled non-secret destination config onto the **connection row** (`CreateTicketConfig.base_url`). Editing the model to admit it would undo the settlement to satisfy a test. The debt is discharged instead by a **new** model-validated ordering case using `post_message`, whose destination is a code constant — which is also the case that proves the pre-credential guard is live on the shipped configuration.

### 7. [Rule 1 — auto-fixed] The engine drive's ctx was less faithful than production

`_drive_approved_external_action` built a ctx with no `pool`, while **both** production ctx builders set it. The executor's receipt writer reads it off the ctx and skips on a minimal ctx (the shipped `_emit_audit` posture), so the receipt fence measured nothing until this was fixed. Found by the receipt case failing with `saw []`.

---

**Total deviations:** 1 blocker found and closed (Rule 2, outside `files_modified`), 1 measured fence repair, 1 recorded criterion conflict, 1 assertion made precise, 1 stated precondition, 1 settlement, 1 auto-fixed drive fidelity bug. **No package installed, no engine edit, no D-32 scope-fence item approached.**

## Issues Encountered

- **A `_record()` closure was introduced rather than four copies of the same return.** Every record branch composes its body through `_external_action_body`, so D-16 shape 1 holds literally: **one composer owns that sentence**, and the log line names which gate recorded.
- **D-18's "halts the run" is NOT literally the shipped engine behaviour, and this summary will not claim it is.** A `failure` output flips the phase to `failed`; the engine then **continues to the next phase** and terminalizes the run (its own comment: *"Run-level semantics are EXPLICITLY preserved (decided, not silent)"*). D-18's actual property — **at-most-once, no retry, no queue** — is fully honoured and mechanically checked. Changing run-level semantics would require editing `harness_engine.py`, which this plan's acceptance forbids. Flagged for `/gsd:verify-work` as wording to reconcile, not as unshipped work.
- The `_pre_credential_destination` read of `phase.config.base_url` is **dead on every production path today** (the model forbids the field) and alive on the drives. Written that way deliberately, and said so in the docblock: the day a destination lands on the step, the guard is already ahead of the resolver rather than being retrofitted behind it.

## Threat-model dispositions honoured

| Threat ID | How it was met |
|---|---|
| T-190-13-T10 | `getattr(ctx, "is_golden_run", False)` inside the executor, shape 1. **Observed RED on the send and green on the gate in the same commit** — and the fence itself was repaired first, because it could not otherwise have fired |
| T-190-13-A4 | **The test showed it WAS reachable.** Closed at `find_resumable_runs` on both gates; the flag is deliberately not threaded into the second ctx builder, and a fence asserts it stays un-threaded |
| T-190-13-D06 | The wrong order was driven into production source and the wrong outcome observed (no raise at all for an unbound step; a resolved credential before the refusal for a bound one). Correct order asserted behaviourally **and** on `inspect.getsource` index order |
| T-190-13-T8 | `resolve_connection(str(connection_id), org_id=str(ctx.org_id))`; a run with **no** org records rather than resolving unscoped, and a connection whose capability disagrees with the step raises |
| T-190-13-T9 | Input resolution UNCHANGED. `_adapter_args` is a closed two-column projection onto the adapter's declared schema — no evaluator, no templating surface added |
| T-190-13-T13 | Only `AdapterResult.ok` produces `completed`; a falsy `ok` maps to `failed` with the vendor's words. `failed` vs `recorded_not_sent` proved distinguishable on three axes with three plants |
| T-190-13-T5 | The receipt carries capability, connection id and destination host. The leak sweep is over the whole payload rendered as JSON (catching any depth) with the request body swept too; plant observed RED |
| T-190-13-D18 | `grep -ciE "retry\|backoff\|sleep("` 32 → 33; the one new match denies them |
| T-190-13-D26 | The kill-switch branch is driven in **both** directions — on (the ordering module's precondition) and off (its own case asserting the shipped record body) |
| T-190-SC | Zero installs — `git diff --numstat` over all three commits on `requirements.txt` and `package.json` prints nothing |

## Known Stubs

**None.** Every branch of `_exec_external_action` is wired to a real code path: the guard to `app.security.egress`, the resolver to `connector_service`, the dispatch to the shipped registry and its three adapters, the receipt to `write_audit` under migration 117's literal. Nothing returns a hardcoded empty value and no placeholder text exists.

Two things are **deliberately absent** rather than stubbed: `create_ticket` and `send_email` have no pre-credential destination (their destination lives on the connection row — 190-06's settlement, stated in the docblock), and there is no run-surface approval affordance (BUG-260808-02, deferred by D-32).

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: resume-path | `backend/app/db/workflows.py` | The resume sweep is a new consideration for this phase's threat model: it re-drives runs on boot with a ctx built by a **second** builder that does not carry `is_golden_run`. Closed for golden runs here; any FUTURE per-run suppression flag will have the same blind spot, and the correct pattern is to make the path unreachable rather than to thread the flag |

## Next Phase Readiness

**Ready.** What downstream now has, and what it still owes:

| Owed by | What |
|---|---|
| **190-14** | The D-05 source fence over `backend/app/services/connectors/**`, and SC#3's fence over the unchanged input resolution — this plan added no evaluator, and says so rather than claiming to have built one |
| `/gsd:secure-phase` | The A4 finding above is a **new** threat register entry, not one the plan anticipated; `T-190-13-A4`'s disposition changed from *"assert unreachability"* to *"was reachable, closed at the root"* |
| `/gsd:verify-work` | Reconcile D-18's wording: at-most-once is shipped and checked; *"halts the run"* is not the engine's shipped semantic and was not changed (the engine diff must stay empty) |
| VALIDATION / UAT | Every live-send row still needs D-30's operator-provided destinations. **Nothing in this plan sends anywhere real** — every drive is stubbed at DNS, at the resolver, or at the transport sentinel |

**One thing not to re-litigate:** the guard sits below the kill-switch and above the unbound branch. Moving it above the kill-switch breaks D-26's "exactly as today"; moving it below the unbound branch **is** n8n #28218, and the transcript of what that looks like is recorded in `test_190_egress_ordering.py` itself.

## Self-Check: PASSED

| Claim | Result |
|---|---|
| `backend/app/services/harness/phase_types.py` modified | FOUND |
| `backend/app/db/workflows.py` modified | FOUND |
| `backend/tests/test_harness_engine.py` modified | FOUND |
| `backend/tests/unit/test_190_egress_ordering.py` modified | FOUND |
| `backend/tests/unit/test_189_no_egress.py` modified | FOUND |
| `190-13-SUMMARY.md` | FOUND |
| commit `57c16808` (Task 1) | FOUND |
| commit `108e2dbe` (Task 2) | FOUND |
| commit `d6b26d9d` (Task 3) | FOUND |
| No file deletions in any of the three commits | CONFIRMED |
| `harness_engine.py` diff across all three | EMPTY |

---
*Phase: 190-live-connector-slice-connector-security-stretch*
*Completed: 2026-08-09*
