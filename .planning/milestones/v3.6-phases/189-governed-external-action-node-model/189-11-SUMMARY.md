---
phase: 189
plan: 11
subsystem: backend-harness-engine
tags: [wave-5, d-05, headline-gate, red-to-green, consequence-not-receipt, falsification-plants, revert-plants]
requires:
  - "189-06 — migration 115 APPLIED: workflow_phases_status_check admits the slug recorded_not_sent"
  - "189-09 — _exec_external_action + phase_types.RECORDED_INTENT_KEY (the producer half of the D-05 seam)"
  - "189-05 — ctx.is_golden_run + the armed checkpoint's golden-run auto-continue (CONFLICT 1)"
  - "189-04 — grounding.EXTERNAL_ACTION_CAPABILITIES unioned into GroundingBundle.tool_names (CONFLICT 2)"
  - "app.db.workflows.complete_phase — the atomic one-statement shape copied here"
provides:
  - "record_phase_not_sent — the FIFTH phase-keyed status write"
  - "the THIRD branch at the status-write seam: the consumer half of the D-05 seam"
  - "V20 GREEN — an external_action workflow PUBLISHES (the phase's headline gate)"
  - "the receipt question answered: no phase_completed row for a recorded_not_sent phase"
  - "the wire description for the sixth workflow_phases.status value"
affects:
  - "189-16 (VALIDATION coverage map — V20 is now green and its evidence lives here)"
  - "Phase 190 (the live send replaces the executor's no-op; this branch is the seam it keeps)"
tech-stack:
  added: []
  patterns:
    - "the 101.1 sentinel-key-on-an-ordinary-output-dict signal, extended to a THIRD branch"
    - "the run continues BY PLACEMENT — inside the same if/else, above the unconditional advance"
    - "REVERT-PLANTS: the two upstream fixes were each undone and V20 observed RED through them"
    - "three wrong-fix plants driven into production source, each observed RED"
key-files:
  created: []
  modified:
    - backend/app/db/workflows.py
    - backend/app/services/harness_engine.py
    - backend/app/api/workflow_runs.py
    - backend/tests/test_harness_engine.py
    - backend/tests/unit/test_publish_service.py
decisions:
  - "A recorded_not_sent phase writes NO phase_completed audit row. The ledger row rides the EXISTING phase_transition kind (via=recorded_not_sent), so D-09's no-new-event-type constraint holds without the phase's true terminal going unrecorded."
  - "NO SSE is emitted for the recorded terminal either, and that is a decision with a cost. phase_completed maps to a '✓ Complete' card in StreamsProvider.onPhaseCompleted — emitting it would paint on the live surface the exact lie the branch exists to prevent. A new event would need a client handler no plan in this phase builds. The resulting latency-of-honesty gap is logged as D-189-DEF-03 with Phase 190 as its trigger."
  - "V20 lives in tests/unit/test_publish_service.py, NOT tests/test_publish_gate.py. Third plan in a row to measure the plan's named file wrong; test_publish_gate.py is the Phase-136 SKILL gate and does not import publish_service."
  - "V20 drives the REAL stage 2.6 and the REAL golden run rather than mocking them, because those are the two seams its REDs lived in. Only the leaf registry READS, the DB edges and the judge are faked."
metrics:
  duration: "~90 min"
  completed: 2026-08-07
  tasks: 2
  commits: 2
  files_created: 0
  files_modified: 5
  tests_added: 4
---

# Phase 189 Plan 11: The D-05 Loop Closes — It Records, the Row Says So, and the Run Carries On Summary

**V20 is GREEN: an `external_action` workflow publishes.** The approved step writes
`recorded_not_sent` in one atomic UPDATE, the ledger gets no receipt claiming it completed,
and **the next phase runs** — asserted by the next phase running, not by the status alone.
Both of V20's original REDs were **re-observed through V20 itself** by reverting the two
upstream fixes one at a time, so the green is a measurement of those fixes rather than a
coincidence of mocking.

## What was built

| File | Change | Result |
|---|---|---|
| `backend/app/db/workflows.py` | `record_phase_not_sent` — the 5th phase-keyed write | **+32 / −0** |
| `backend/app/services/harness_engine.py` | the third branch + the receipt suppression + both comment blocks | **+78 / −0** |
| `backend/app/api/workflow_runs.py` | the phase-read `status` description | +7 / −1 |
| `backend/tests/test_harness_engine.py` | the D-05 drive + 3 tests | +250 / −0 |
| `backend/tests/unit/test_publish_service.py` | **V20** + its real-gauntlet drive | +249 / −0 |

| Commit | Task |
|---|---|
| `7ce83c0d` | Task 1 — the fifth write, atomic, no failure vocabulary, D-09 proven still guarded |
| `61084eec` | Task 2 — the third branch, the receipt answer, the wire prose, V20 |

**Scope — exactly the five files, and the two untouchables are EMPTY:**

```
$ git diff --numstat 7ce83c0d~1..HEAD -- backend/
32  0   backend/app/db/workflows.py
7   1   backend/app/api/workflow_runs.py
78  0   backend/app/services/harness_engine.py
250 0   backend/tests/test_harness_engine.py
249 0   backend/tests/unit/test_publish_service.py

$ git diff --stat 7ce83c0d~1..HEAD -- frontend/ supabase/          → (empty)
$ git diff --diff-filter=D --name-only 7ce83c0d~1..HEAD            → (empty; no deletions)
```

`frontend/src/providers/StreamsProvider.tsx` and `frontend/src/stores/streamsStore.ts` were
READ and not edited, as the plan required. `supabase/` is untouched.

---

## V20 — THE HEADLINE GATE, GREEN, WITH BOTH ORIGINAL REDS BESIDE IT

### The GREEN

```
$ venv/Scripts/python.exe -m pytest tests/unit/test_publish_service.py -q --no-header
28 passed, 1 warning in 0.88s
```

```python
assert run.result["published"] is True          # ✅
assert run.result.get("blocked_stage") is None  # ✅
assert run.result["version"] == 2               # ✅
assert run.subscribe_timeouts == []             # ✅ nobody was asked
assert len(recorded) == 1                       # ✅ the governed step RAN and RECORDED
assert persisted["recorded_intent"]["capability"] == "send_email"   # ✅
assert "NOT SENT" in persisted["text"]          # ✅ it cannot read as a receipt
```

**Wall clock for the whole file: 0.88 s.** Nothing awaits a real timeout — the ask channel is
the raising `_SubscribeRecorder` 189-02 built, so reaching it is instantaneous and loud.

### RED 1 — CONFLICT 1, verbatim from `189-02-SUMMARY.md`

```
E       AssertionError: D-19 / CONFLICT 1: an armed phase SUBSCRIBED TO THE ASK CHANNEL on a golden run.
        subscribe_for_response was awaited 1 time(s) with timeout_seconds=[None] — and `None` is what
        ask_user_service.subscribe_for_response's own docstring calls 'wait indefinitely'. Nobody is
        watching a synchronous publish's ask channel, so this burns the full
        settings.harness_publish_max_seconds budget and the publish returns
        blocked_stage='golden_run_timeout'. D-06 ('a workflow containing the node PUBLISHES and RUNS')
        is FALSE while this is true. Owner: plan 189-05.
E       assert [None] == []
```

> the two numbers 189-02 asked to be carried: **subscribe call count expected `0`, observed `1`;
> recorded `timeout_seconds` = `None`**, inside a request bounded at **7200 s**.

### RED 2 — CONFLICT 2, verbatim from `189-02-SUMMARY.md`

```
E       AssertionError: D-20 / CONFLICT 2: stage 2.6 rule 2 refuses
        ['create_ticket', 'post_message', 'send_email'] — the external-action capabilities D-03 puts
        in available_tools. Findings emitted:
        [{'code': 'unregistered_tool', 'phase': 'research', 'message': "phase 'research' references a non-registered tool 'create_ticket'"},
         ...]
E       assert {'create_tick... 'send_email'} == set()
```

### ⚠ AND BOTH WERE RE-OBSERVED **THROUGH V20 ITSELF** — the REVERT-PLANTS

Quoting a prior plan's RED beside a green proves the two happened; it does not prove they are
connected. So each upstream fix was **undone in production source**, V20 re-run, and the
failure read:

**REVERT-PLANT 1 — 189-05's golden-run branch disabled** (`if False and _armed and …`):

```
E       AssertionError: D-06 / V20: an external_action workflow did NOT publish.
        blocked_stage='golden_run_error'
        named_failures=['golden run could not complete: the ask channel was subscribed with timeout_seconds=None']
```

The mechanism is byte-for-byte CONFLICT 1's: the armed checkpoint subscribed with the
indefinite wait. (`golden_run_error` rather than `golden_run_timeout` only because the
recorder raises instead of burning 7200 real seconds — which is the whole reason it raises.)

**REVERT-PLANT 2 — 189-04's union removed** (`fidelity_tool_names = schema_tool_names`):

```
E       AssertionError: D-06 / V20: an external_action workflow did NOT publish.
        blocked_stage='grounding_fidelity'
        named_failures=[{'code': 'unregistered_tool', 'phase': 'notify-the-customer',
                         'message': "phase 'notify-the-customer' references a non-registered tool 'send_email'"}]
```

CONFLICT 2's exact finding shape, on this plan's own definition.

Both files restored and verified byte-identical by md5 (`85f2864b…` / `a5f5e7f2…` before and
after), `grep -c "REVERTPLANT"` → **0 / 0**.

**This is why V20 does not mock `_grounding_fidelity_failures` or `_drive_golden_run`.** The
shipped `test_publish_service.py` suite patches both — correctly, for the pipeline-ORDER
contracts it pins. V20 cannot: those are the two seams its REDs lived in, and patching either
would make it green for the wrong reason. What IS faked is the leaf registry READS
(`fetch_visible_folders`, `_resolve_caller_org_ids`, `_skill_registry`), the DB edges
(`create_workflow_run`, `insert_run`, `finalize_run`, `get_definition`, `write_audit`,
`publish_definition`), the service-role client and the judge — the
`test_182_publish_grounding_stage.py` posture ("fake the read, never the rule"), pushed one
level deeper so the tool-name union itself is the real one.

---

## The fix, and the two things placement buys for free

```python
_emit_failure = output.get("failure") if isinstance(output, dict) else None
_recorded_intent = output.get(RECORDED_INTENT_KEY) if isinstance(output, dict) else None
if _emit_failure:
    await fail_phase(pool, phase_id, str(_emit_failure), output=durable_output)
elif _recorded_intent:
    await record_phase_not_sent(pool, phase_id, durable_output)
else:
    await complete_phase(pool, phase_id, durable_output)
```

1. **The run CONTINUES.** The block falls through to the unconditional
   `advance_current_phase` immediately below; `fail_run` and `skip_to` `return`/`continue` out
   of the loop long before here. **Verified by reading, not by taking the plan's word:** the
   two early exits are at the `outcome.kind` checks above, and the advance has no guard.
2. **The failure sentinel keeps precedence** — a recorded intent that also carries a failure
   is a failure.

`RECORDED_INTENT_KEY` is **imported from the producer**, never re-typed
(`from app.services.harness.phase_types import RECORDED_INTENT_KEY`, lazy, per this module's
import-cycle rule). 189-09 exported it precisely so the two ends could not drift.

### The status literal, compared byte for byte (T-189-34)

| Source | Literal |
|---|---|
| `supabase/migrations/115_workflow_phases_recorded_not_sent.sql:90` | `'recorded_not_sent'::text` |
| `app/db/workflows.py` — `record_phase_not_sent` | `SET status='recorded_not_sent'` |

Identical. And `test_migration_115.py` **PASSES (3 passed), not skips** — the constraint is
live, so the write cannot die on a 23514 mid-run.

### The atomicity, read rather than assumed (T-189-33)

`record_phase_not_sent` contains exactly **one** `pool.execute` and exactly **one** `UPDATE`
statement (counted in the function body: `pool.execute` → 1). `grep -c "_failure_reason"`
inside the function → **0** — and the identifier is deliberately not spelled even in the
denial, because the plan's check is a grep and 189-09 learned that a denial and a use read
identically to one.

---

## THE RECEIPT QUESTION, ANSWERED EXPLICITLY

**A `recorded_not_sent` phase writes NO `phase_completed` receipt.** Phase 107 / GOV-02 reads
`harness_audit` rows as receipts; a completion receipt would tell the ledger the step
completed when it recorded and sent nothing. That is the Control-Room `consequence ≠ receipt`
rule — the same argument D-09 used to decline a new event type, and the same one 189-05 used
to decline Option C.

**What IS written:** a row on the EXISTING `phase_transition` kind carrying
`via: "recorded_not_sent"` — the shape the emit-failure branch chose for the same reason, so
the phase's true terminal is in the ledger without inventing vocabulary. `via` names the
SLUG, never a rendered sentence (D-17).

**D-09 holds, measured:** `git diff` shows **no change** to the `harness_audit` event-type
literal set in `db/workflows.py:110-136`, and `tests/unit/test_audit_event_registration.py`
passes **UNCHANGED** (6 passed). The test itself asserts the Python set equals the SQL CHECK;
a new kind would have failed it.

---

## ANTI-VACUITY: THREE PLANTS + ONE PRE-IMPLEMENTATION RED, EACH OBSERVED

All plants were driven into **production source**, observed, removed, and restoration verified
by md5 against pre-plant backups (`85f2864b…` before and after; `grep -c "PLANT"` → **0**).

### The pre-implementation RED (the branch simply absent)

Captured before a line of `harness_engine.py` was edited:

```
E       AssertionError: D-05: expected exactly ONE recorded_not_sent write, saw 0. UPDATEs on
        workflow_phases: [... "UPDATE workflow_phases SET status='active' …",
        "UPDATE workflow_phases SET status='completed', output=$2::jsonb …", …]
E       assert 0 == 1
2 failed, 1 passed
```

### PLANT J — the record SKIPPED (`skip_phase` instead) — the PLANT H shape at this layer

```
FAILED tests/test_harness_engine.py::test_an_approved_external_action_records_not_sent_and_the_run_continues
FAILED tests/unit/test_publish_service.py::test_v20_an_external_action_workflow_publishes
2 failed, 70 passed
```

⚠ **`test_a_recorded_not_sent_phase_writes_no_phase_completed_receipt` stayed GREEN under
PLANT J.** The suppression still fires when the record is skipped, so the receipt fence alone
cannot see a step that was governed away. Only the write assertion can.

### PLANT K — the status written as `completed` ("the step ran, so it completed")

```
FAILED …::test_an_approved_external_action_records_not_sent_and_the_run_continues
FAILED …::test_v20_an_external_action_workflow_publishes
2 failed, 70 passed
```

The recorded UPDATEs read `SET status='completed'` twice — the row that would say "sent"
forever to anything querying the table.

### ⚠ PLANT L — the completion receipt written anyway

```
FAILED tests/test_harness_engine.py::test_a_recorded_not_sent_phase_writes_no_phase_completed_receipt
1 failed, 71 passed
E       AssertionError: a phase_completed receipt was written for a phase that recorded and sent
        nothing. The ledger would say the step completed; consequence is not receipt.
E       assert 'notify' not in ['notify', 'wrap-up']
```

**⚠ V20 and the D-05 core test both stayed GREEN under PLANT L.** A false completion receipt
in the governance ledger is completely invisible to the phase's headline gate — the fourth
time in this phase (189-05 PLANT E, 189-09 PLANTs F and H) that the headline proof could not
see a real defect, and the fourth time exactly one test could.

### PLANT M — the sentinel key renamed (`"recorded_intent_v2"`)

```
3 failed, 69 passed
```

All three 189 tests RED — the key is load-bearing at both ends, which is why it is imported.

---

## Deviations from Plan

### Rule 3 — a blocking issue, inherited for the THIRD time

**1. [Rule 3 — Blocking] The plan's `files_modified` names `backend/tests/test_publish_gate.py`; V20 belongs in `tests/unit/test_publish_service.py`**

- **Found during:** the `<read_first>` step, and pre-flagged by the executor prompt.
- **Issue:** the plan names `backend/tests/test_publish_gate.py` in `files_modified`, in its
  `<verify>` command and in three acceptance criteria. **Re-measured 2026-08-07 (third time
  this phase, after 189-02 and 189-05):** that file's own docblock reads *"Phase 136
  (GATE-01) — skill publish gate"*; it tests `compute_publish_gate` over `eval_runs` and does
  not import `publish_service`. `189-VALIDATION.md`'s V20 row was corrected in Wave 0 and
  points at `tests/unit/test_publish_service.py`.
- **Fix:** V20 landed in `tests/unit/test_publish_service.py`, reusing that file's
  `_SubscribeRecorder`, its `_USER` / `_DEF_ID` and its judge-mock style. `test_publish_gate.py`
  was **run and left unedited** — **11 passed, unchanged**, exactly as at HEAD.
- **Commit:** `61084eec`

### Rule 2 — missing critical functionality

**2. [Rule 2] `test_audit_event_registration.py` is in `files_modified` but must NOT be modified**

- **Issue:** the plan lists it as a modified file while its acceptance criterion requires it to
  PASS **UNCHANGED** and `git diff` to show no change to the literal set. Those cannot both be
  satisfied.
- **Fix:** the criterion wins. The file is untouched and green (6 passed). Recorded rather
  than smoothed, because a `files_modified` entry that never gets a diff is how a later reader
  concludes a guard was edited when it was not.

**3. [Rule 2] The wire decision the plan did not name: NO SSE is emitted for the recorded terminal**

- **Found during:** Task 2 B, reading `StreamsProvider.tsx` / `streamsStore.ts` as instructed.
- **Issue:** the plan asks only that no `phase_completed` **receipt** be written. But
  `phase_completed` is also an SSE, and `StreamsProvider.onPhaseCompleted` maps it to
  `setPhaseStatusForThread(..., "done")` — a "✓ Complete" card on the live run surface.
  Suppressing the ledger row while still emitting the event would move the lie one layer out,
  which is the exact criticism 189-05 levelled at its own rejected Option C.
- **Fix:** both suppressed, with the reason in the comment so the next reader meets a decision
  rather than an omission. **The cost is stated, not hidden:** with nothing emitted the card
  stays non-terminal and `finalizeAllPhasesForThread` sweeps it to `done` at `run_completed`,
  so a live viewer sees "Complete" until a reconcile fetch replaces it with the honest DB
  status. That is a latency-of-honesty gap, not a persistent lie (CLAUDE.md: Realtime is a
  best-effort HINT, the fetch is the truth) — **logged as `D-189-DEF-03`** with a concrete
  trigger, because closing it needs a new SSE + a client handler + a sweep exclusion in one
  commit, which is a plan and not a deviation.
- **Commit:** `61084eec`

**4. [Rule 2] V20's first run passed every publish assertion over an EMPTY phase spine**

- **Found during:** Task 2 E, the first run of V20.
- **Issue:** the mock pool had no `fetch` result set, so `load_run_phases` returned `[]`, the
  engine looped over zero phases, and the publish returned `published: True` with a
  `blocked_stage` of `None`. **A publish test that asserts only the verdict cannot tell a
  workflow that ran from one that did not.**
- **Fix:** the phase spine is now set explicitly, and the observation is recorded IN THE TEST
  as the reason the `recorded_not_sent` write is asserted at all. This is the same class as
  189-05's PLANT E, discovered by accident rather than by planting — which is itself the
  argument for the recorded-write assertion being non-negotiable.
- **Commit:** `61084eec`

---

## Re-derived, not inherited

Every load-bearing pointer was re-derived by **symbol search** on 2026-08-07.

| Claim | How | Result |
|---|---|---|
| the seam is at `harness_engine.py:~1605-1623` | `grep -n "_emit_failure\|complete_phase"` | ⚠ **the branch is at `:1673-1680`**, the audit follow-through at `:1691-1735` — RESEARCH's figure is 68 lines stale (189-05 added 60 lines above it) |
| the four write functions at `db/workflows.py:~958-1014` | `grep -n "def .*_phase"` | ✅ `:959 / :970 / :985 / :1007` — HOLDS |
| `advance_current_phase` is unconditional in that block | read the body | ✅ HOLDS — no guard; the two early exits are the `outcome.kind` checks above |
| `RECORDED_INTENT_KEY` is exported by `phase_types` | `grep -n` | ✅ `phase_types.py:1705` |
| the `harness_audit` literal set | `grep -n` | ✅ `db/workflows.py:110-136` — HOLDS, and unchanged by this plan |
| `test_publish_gate.py` is the SKILL gate | read its docblock | ✅ HOLDS — *"Phase 136 (GATE-01) — skill publish gate"* |
| the nine-file §D15 baseline | re-run before any edit | **2 failed / 178 passed** (189-09's figure CONFIRMED; RESEARCH's `166` is two plans stale) |
| `tests/unit` pre-plan | 189-09's recorded figure | **62 failed / 1744 passed** |
| `test_migration_115.py` passes (not skips) | re-run | ✅ **3 passed** — migration 115 is applied |
| the SQL and Python status literals | compared as strings | ✅ byte-identical |

---

## Verification

**The plan's `<verify>` commands:**

```
$ venv/Scripts/python.exe -m pytest tests/unit/test_audit_event_registration.py -q --no-header
6 passed                                    ← Task 1 (D-09 still guarded)

$ venv/Scripts/python.exe -m pytest tests/test_harness_engine.py tests/test_publish_gate.py -q --no-header
55 passed                                   ← Task 2 (44 + 11)

$ venv/Scripts/python.exe -m pytest tests/test_migration_115.py -q --no-header
3 passed                                    ← not skipped: the constraint is live
```

**The nine-file 189-scope command (§D15) — only the two named pre-existing failures:**

```
$ venv/Scripts/python.exe -m pytest <the nine §D15 files> -q --no-header
2 failed, 181 passed, 3 warnings in 2.99s

FAILED tests/test_182_grounding_bundle.py::test_grounding_bundle_returns_server_sourced_palette
FAILED tests/test_182_grounding_bundle.py::test_grounding_bundle_fields_come_from_the_bundle
```

| | After 189-09 | **After 189-11** | Delta | Accounted for by |
|---|---|---|---|---|
| failed | 2 | **2** | 0 | the two pre-existing `asyncpg … pool is closing` live-DB rows, unmoved |
| passed | 178 | **181** | **+3** | the three new `test_harness_engine.py` tests |

**BLAST RADIUS — the whole `tests/unit` tree, reconciled EXACTLY:**

| | After 189-09 | **After 189-11** | Delta |
|---|---|---|---|
| `tests/unit` failed | **62** | **62** | **0** |
| `tests/unit` passed | **1744** | **1745** | **+1** |

**+1 = V20, the single new test inside `tests/unit`. ZERO regressions**, including the 62
pre-existing failures, which are unmoved.

**Targeted:**

| Command | Result |
|---|---|
| `pytest tests/test_harness_engine.py -q` | **44 passed** (was 41) |
| `pytest tests/unit/test_publish_service.py -q` | **28 passed** (was 27) — **V20 is the +1** |
| `pytest tests/test_publish_gate.py -q` | **11 passed — UNCHANGED, file not edited** |
| `pytest tests/unit/test_audit_event_registration.py -q` | **6 passed — unchanged, D-09 holds** |
| `pytest tests/test_migration_115.py -q` | **3 passed** |
| `pytest tests/unit/test_189_no_egress.py tests/test_harness_whitelist.py tests/unit/test_182_publish_grounding_stage.py tests/unit/test_187_armed_checkpoint_property.py -q` | **all green** (with the above: 96 passed) |

**Acceptance greps:**

| Check | Command | Result |
|---|---|---|
| SC#4 fence | `grep -rniE "\bmcp\b" backend/app --include=*.py \| wc -l` | **0** ✅ |
| V22 (the D-20 leak) | `pytest tests/test_182_grounding_bundle.py -k external_action` | **green** ✅ |
| D-09 | `git diff` over the `harness_audit` literal set | **no hunk** ✅ |
| the two read-only client files | `git diff --stat -- frontend/` | **empty** ✅ |
| `workflow_runs.py` is prose only | `git diff --numstat` | **7 ins / 1 del**, the description string ✅ |
| additive engine diff | `git diff --numstat` | **78 ins / 0 del** — no shipped line changed ✅ |
| plants removed | `grep -c "PLANT"` + md5 vs backups | **0**, md5 identical ✅ |

**Frontend: untouched.** `git diff -- frontend/` is empty across the whole plan, so `tsc` and
the count gate cannot have moved and neither was re-run.

---

## Deferred Issues

- **`D-189-DEF-03` (NEW)** — the live run surface has no honest wire signal for
  `recorded_not_sent`; a viewer sees "Complete" until reconcile. Full measurement, the three
  sites, and the re-open trigger (Phase 190, or a 189 UAT row that observes it) are in
  `deferred-items.md`.
- **`D-189-DEF-01`** — `test_182_extraction_parity.py`'s NL-gen count pin, RED since 189-02.
  **Verified as not mine:** it counts test defs in `tests/unit/test_103_grounding_fidelity.py`,
  a file this plan adds nothing to.
- **`D-189-DEF-02`** — carried unchanged; this plan touches no frontend file.
- the two `test_182_grounding_bundle.py` `pool is closing` failures — live-DB, pre-existing,
  unmoved and still exactly two.

## Authentication Gates

None.

## Known Stubs

None. The executor's no-op is the *specified behaviour* of this milestone (D-05), not a stub —
and this plan is the half that makes the record durable, which is the opposite of a stub. What
Phase 190 replaces is one function and one status, by design.

## Threat Flags

None — no new network endpoint, no auth path, no file-access pattern, no schema change. This
plan's own register is addressed rather than deferred:

| Threat | Disposition | Evidence |
|---|---|---|
| **T-189-31** — Repudiation: a `phase_completed` receipt for a phase that recorded | **mitigated** | The branch suppresses it at the ledger AND the wire, driven from recorded audit writes with a positive control (the ordinary phase in the same run DOES get its receipt). **PLANT L observed RED — and V20 could not see it.** |
| **T-189-32** — Spoofing: a governed step silently skipped | **mitigated** | The next-phase-ran assertion plus V20's recorded-write assertion. **PLANT J observed RED**, and V20's own first run (empty spine) proved the failure mode is reachable by accident, not just by planting. |
| **T-189-33** — Tampering: a non-atomic status+output write | **mitigated** | ONE `pool.execute`, ONE `UPDATE`, copying `complete_phase`; counted in the body, not assumed. |
| **T-189-34** — DoS: a mid-run 23514 on an unlisted status | **mitigated** | `test_migration_115.py` **PASSES (3), not skips**; the Python and SQL literals compared byte for byte above. |
| **T-189-35** — Tampering: the sentinel colliding with a Deep output key | **mitigated** | `test_an_output_with_no_sentinel_still_routes_to_complete_phase` — a real drive, 2 completed / 0 recorded. The branch is a literal no-op on the shared path (D-14). |
| Information Disclosure — the recorded output | accept | Nothing left the system; SC#4's fence is still 0 and 189-01's patched-transport falsification is still green. |
| **T-189-SC** — package installs | accept | This plan installed nothing. |

## Self-Check: PASSED

- `backend/app/db/workflows.py` — FOUND
- `backend/app/services/harness_engine.py` — FOUND
- `backend/app/api/workflow_runs.py` — FOUND
- `backend/tests/test_harness_engine.py` — FOUND
- `backend/tests/unit/test_publish_service.py` — FOUND
- `.planning/phases/189-governed-external-action-node-model/189-11-SUMMARY.md` — FOUND
- commit `7ce83c0d` — FOUND
- commit `61084eec` — FOUND
- `git diff HEAD -- backend/` — EMPTY (no plant residue, no uncommitted work)
- `grep -c "PLANT"` over both production files — **0 / 0**
</content>
