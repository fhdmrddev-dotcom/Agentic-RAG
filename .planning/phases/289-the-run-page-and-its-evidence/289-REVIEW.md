---
phase: 289-the-run-page-and-its-evidence
reviewed: 2026-10-19T19:57:18Z
depth: standard
files_reviewed: 49
files_reviewed_list:
  - backend/app/api/runs.py
  - backend/app/api/workflow_run_evidence.py
  - backend/app/api/workflow_runs.py
  - backend/app/db/workflows.py
  - backend/app/main.py
  - backend/app/middleware/canvas_gate.py
  - backend/app/services/harness/phase_confidence.py
  - backend/app/services/harness/phase_types.py
  - backend/app/services/run_evidence.py
  - backend/app/services/task_service.py
  - backend/tests/fixtures/phase289/run_evidence_contract.json
  - backend/tests/test_182_canvas_gate.py
  - backend/tests/test_288_waiting_on.py
  - backend/tests/test_289_ask_user_sql.py
  - backend/tests/test_harness_resume.py
  - backend/tests/unit/test_190_connector_source_fence.py
  - backend/tests/unit/test_200_1_deliverable_text.py
  - backend/tests/unit/test_256_finish_run_unchanged.py
  - backend/tests/unit/test_289_evidence_contract.py
  - backend/tests/unit/test_289_phase_confidence.py
  - backend/tests/unit/test_289_redrive_failure.py
  - backend/tests/unit/test_289_run_evidence.py
  - frontend/src/App.tsx
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/panel/__tests__/PendingAskCard.paused.test.tsx
  - frontend/src/components/panel/__tests__/PendingAskCard.retired.baseline.test.tsx
  - frontend/src/components/panel/PendingAskCard.tsx
  - frontend/src/components/workflows/argumentVocabulary.test.ts
  - frontend/src/components/workflows/evidenceFixtures.testutil.ts
  - frontend/src/components/workflows/evidenceView.test.ts
  - frontend/src/components/workflows/evidenceView.ts
  - frontend/src/components/workflows/evidenceVocabulary.ts
  - frontend/src/components/workflows/RunEvidenceReport.test.tsx
  - frontend/src/components/workflows/RunEvidenceReport.tsx
  - frontend/src/components/workflows/RunSpine.test.tsx
  - frontend/src/components/workflows/RunSpine.tsx
  - frontend/src/components/workflows/StepEvidenceLine.test.tsx
  - frontend/src/components/workflows/StepEvidenceLine.tsx
  - frontend/src/index.css
  - frontend/src/lib/api/__tests__/runEvidence.contract.test.ts
  - frontend/src/lib/api/runEvidence.test.ts
  - frontend/src/lib/api/runEvidence.ts
  - frontend/src/lib/api/workflows.ts
  - frontend/src/lib/runDeepLink.test.ts
  - frontend/src/lib/runDeepLink.ts
  - frontend/src/pages/__tests__/WorkflowRunPage.seam286.pin.test.tsx
  - frontend/src/pages/WorkflowRunPage.test.tsx
  - frontend/src/pages/WorkflowRunPage.tsx
  - scripts/vitest-count-gate.cjs
findings:
  critical: 2
  warning: 6
  info: 8
  total: 16
status: issues_found
---

# Phase 289: Code Review Report

**Reviewed:** 2026-10-19T19:57:18Z
**Depth:** standard (phase diff `dcf6ba649..HEAD` for the large pre-existing files, whole files for the new ones)
**Files Reviewed:** 49
**Status:** issues_found

## Summary

The evidence route's access posture holds up. Owner-or-member, the terminal status and the id are
all checked in one SELECT. Every miss gets the same 404 body. The route reads nothing else before
that row exists, and it runs no blocking supabase-py call (asyncpg only, so D-v2.5-01 holds). The
non-owner masking is also implemented as specified: no email or thread id, no deliverable file id
or passage text, the human-input answer withheld, and the KB label resolved on the viewer's own
RLS connection with a fail-closed fallback. The `?run=` reader accepts a strict UUID only, and
every payload string renders as React text, so I found no XSS or open-redirect path. The
WorkflowRunPage early return comes after every hook (no hook calls after line 1128). The JSON
export is the fetched object itself.

Two findings are blockers:

1. **The accepted risk T-289-31 is escalated.** A colleague sees "A document you don't have access
   to" in Sources. In the same report they get that document's synthesised content in the step's
   `output_text`. S4 observed this risk only on a step that matched nothing, so the leaking case
   was never observed.
2. **The paused-card fix (D-13 / SEED-360 F-1) misses the live path.** When the client countdown
   expires before the 5 s poll reports `paused`, the card stays expired. That is the normal case
   for someone watching the page.

The warnings cover:

- the re-drive failure arm, which strands the producer shell and has a status/audit TOCTOU
- the evidence verdicts, which report "checks" that never ran
- the confidence line, which says "nothing matched" for searches that were refused and never queried
- a `?run=` link that is never cleared on live runs
- a paused run with an unloadable definition, which stays stranded while the server now promises it continues

SEED-364 (`org_name` carries the founder's email) is **confirmed as accepted**. Only members get
past the access query, and members already receive the same name from `GET /org/me`. No escalation.

## Critical Issues

### CR-01: A masked source's content still reaches the colleague through `output_text` (T-289-31 escalated)

**File:** `backend/app/services/run_evidence.py:212-213, 234-247` (with `backend/app/api/workflow_run_evidence.py:317-321, 357`)
**Issue:** The route builds R-01 masking carefully. It does an RLS readability check on the viewer's
own connection and fails closed. Then a document the colleague cannot read is reduced to its step
numbers ("A document you don't have access to"). But `compose_phase_log` ships every non-human
step's `output_text` to that same colleague, and a KB step's `output_text` is the model's synthesis
of exactly those cited passages. So the report hides the filename of an owner-private document and
prints what it says in the row above.

This contradicts the project rule in CLAUDE.md ("All tables need Row-Level Security — users only
see their own data (global folders/skills are the only shared scope)"). A document outside an
org-shared folder is owner-only under `documents` RLS (`full-schema.sql:8684`). The R-04 answer
withholding has the same hole: the human's answer feeds the next step, whose `output_text` ships
whole.

The acceptance (T-289-31, 289-03-PLAN.md:216) argues that "the owner ran it inside the org". It
never weighs the owner-private-document case. The live S4 observation quoted a step that matched
nothing (`"**No documents matched this week…"`, 289-VALIDATION.md:116), so the case that leaks was
never observed. Org visibility (D-05) was an operator decision. Shipping owner-private document
content to colleagues was not.
**Fix:** Withhold the text for a non-owner whenever a step cited anything the viewer cannot read.
The masking decision is already computed in the same request, so this is local:
```python
# workflow_run_evidence.py, after _viewer_reads
masked_ids = set(ev.cited_document_ids(phase_rows)) - (readable or set()) if not viewer_is_owner else set()
phase_log = ev.compose_phase_log(phase_rows, full, viewer_is_owner, who["name"], kb_label,
                                 masked_document_ids=masked_ids)

# run_evidence.compose_phase_log, per row
if not viewer_is_owner and masked_document_ids and any(
    c["document_id"] in masked_document_ids for c in _citations_of(row)
):
    output_text = None   # and render "Output withheld: it draws on documents you can't read"
```
Alternatively, get the operator to ratify T-289-31 explicitly for this case, record it in
`STATE.md → Guardrail overrides`, and drop the "masked" wording, which currently claims a privacy
property the payload does not have.

### CR-02: A card that has already counted down to "expired" never comes back when the run turns `paused` (D-13 / SEED-360 F-1 still fires live)

**File:** `frontend/src/components/panel/PendingAskCard.tsx:368-382` (fed by `frontend/src/pages/WorkflowRunPage.tsx:1557`)
**Issue:** `paused` only stops the countdown from *starting* the expiry. In the live sequence:

1. The person is on the run page while the window runs out.
2. The client clock reaches `remaining <= 0` at the same moment the server's `subscribe_for_response` times out.
3. The effect calls `setState("expired")` and `markSettled(tool_call_id)`, which also discards the draft.
4. The page's 5 s run poll (`RUN_POLL_MS`) reports `paused` up to five seconds later.
5. The card is keyed on `tool_call_id`, so it keeps its local state. Nothing moves `state` back to `"pending"`, and the expired arm keeps rendering.

The answer control is gone while the run is paused and waiting for that answer, which is exactly
F-1. The server now also says "the run continues as soon as they answer"
(`workflow_runs.py:821`). `PendingAskCard.paused.test.tsx` covers only a card mounted with
`paused` already true. No test re-renders pending → expired → paused, which is the path a person
watching the page actually takes. S5 passed through a reload or remount, which resets the state.
**Fix:** Make a clock-driven expiry reversible while the run is paused, and do not settle the draft
on a clock expiry until the run status is known:
```tsx
useEffect(() => {
  // A clock expiry (no 404 message) is not terminal when the run is paused and still waiting.
  if (paused && state === "expired" && expiredMessage === null) setState("pending")
}, [paused, state, expiredMessage])
```
Move `markSettled` out of the clock arm (or defer it to `runIsOver`). Add a RED test: render with
`paused={false}`, advance past the deadline, re-render with `paused`, and assert the submit control
and `PAUSED_WAITING_LINE` are present.

## Warnings

### WR-01: The new `_build_resume_context` failure arm strands the minted producer shell

**File:** `backend/app/api/runs.py:687-696` (with `backend/app/services/harness_engine.py:2899-2928`)
**Issue:** `_build_resume_context` INSERTs the `status='streaming'` producer shell (`insert_run`)
and then can still raise. `get_service_role_supabase(_org_id)` raises `ValueError` whenever
`_org_id` is falsy, and that call sits after the insert. The new `except` arm calls `_fail_redrive`
and returns, but `ctx` was never bound, so the shell is never finalized. This function's own
docstring makes that a hard invariant ("THE MINTED PRODUCER SHELL IS TERMINALIZED ON EVERY EXIT
PATH… a stranded one becomes the thread's latest runs row and defeats the F2 self-heal, re-wedging
the thread"). `test_289_redrive_failure.py::test_a_raising_build_context…` raises before any
insert, so it cannot see this.
**Fix:** Have `_build_resume_context` finalize its own shell on any raise after `insert_run`
(`try: … except: await finalize_run(pool, run_id=_producer_id, status="failed", …); raise`). The
other option is to resolve `get_service_role_supabase` before the insert. Then add a test that
raises after the insert and asserts that `finalize_run` was called.

### WR-02: `_fail_redrive` is check-then-act, so it can audit `run_failed` on a run that ended `cancelled`

**File:** `backend/app/api/runs.py:580-593`
**Issue:** The function reads `status`, then makes three separate writes. A Stop can land between
the read and `finish_run`. `finish_run`'s terminal guard then (correctly) refuses `failed` over
`cancelled`, but `write_audit(event_type="run_failed")` runs unconditionally after it. The audit
trail and the evidence report then record a failure for a run that reports `cancelled`. The arm
also emits no `run_failed` SSE event, unlike the engine's fail arm it claims to mirror
(`harness_engine.py:2465-2470`). A live owner surface only learns of the failure on its next poll.
**Fix:** Make the terminal write the guard. Either have `finish_run` return whether it wrote, or use
`UPDATE workflow_runs SET status='failed' … WHERE id=$1 AND status='active' RETURNING id`. Write the
phase failure and the audit only when that returns a row, and add the
`_emit(redis, run_id, "run_failed", reason=…)` call (with `redis` passed in).

### WR-03: The evidence report counts "checks" that never ran

**File:** `backend/app/services/run_evidence.py:284-310`; `frontend/src/components/workflows/evidenceView.ts:181-190`
**Issue:** There are two false statements on a page whose purpose is evidence:

1. A wall-clock timeout writes `gate_failed` with no validator having run
   (`harness_engine.py:1122-1128`: "the phase hung before gates ran"). It carries no `timing`, so
   `compose_verdicts` treats it as `post` and fills `checked` with every post validator on the
   phase. The report then says "The step's checks did not pass · checked: X, Y" for checks that
   never executed. On a phase with no validators it still counts one failed check.
2. Every retry attempt is a separate row. A step that failed its gate on attempt 0 and passed on
   attempt 1 shows a red "1 of 2 passed" in the facts strip, even though every gate in the run
   ended passing.

**Fix:** Leave `checked` empty and render a distinct "Timed out before its checks ran" kind when the
metadata `error` starts with `wall_clock_timeout` (or when `validator_error` is absent on a post
row). In `checksFact`, count the final attempt per `(phase_slug, timing)` rather than every audit
row, or label the figure as attempts.

### WR-04: `kb_search_calls` counts refused searches, so the line says "nothing matched" for a search that never queried

**File:** `backend/app/services/task_service.py:793-794`; `backend/app/services/harness/phase_confidence.py:74-77`
**Issue:** The counter increments for every `search_documents` dispatch. That includes the
`_invalid_filter` and `_refused_retry` results (`search_documents_tool.py:869-905`), which run no
retrieval and set no `retrieval_error`. A phase whose only searches were refused therefore stores
`level: "none"`, and both surfaces render "Searched <KB> · nothing matched · ○ No match found —
The knowledge base returned nothing for this step". That breaks D-09's own rule ("'nothing matched'
would be a false sentence about a search that never ran to completion").
**Fix:** Count a call as a search only when retrieval actually ran. For example, set a flag on
`ToolResult` in the passages and empty-result arms (`searched=True`) and increment on
`getattr(tr, "searched", False)`. Alternatively, treat `invalid_filter` / `refused_retry` as
`retrieval_error`-equivalent for `phase_confidence`.

### WR-05: `?run=` is never cleared when the deep-linked run is still live

**File:** `frontend/src/components/layout/ChatLayout.tsx:307`; `frontend/src/App.tsx:163`; `frontend/src/components/workflows/RunEvidenceReport.tsx:411-414`
**Issue:** Only `RunEvidenceReport` writes or clears the link. If `/app?run=<id>` points at an
active or paused run, `WorkflowRunPage` renders the live surface and never mounts the report. "‹
Back to Workflows" or a nav-rail jump then leaves `?run=<id>` in the address bar, and the next
reload drops the person back on that run page instead of where they navigated. App's initializer
returns `"workflow-run"` for any valid link. That breaks the module's own contract that "the
address bar always names the record on screen".
**Fix:** Clear the link where the view is left rather than in one child. A ChatLayout effect can
call `clearRunDeepLink()` when `activeView !== "workflow-run"`. Alternatively, move
`writeRunDeepLink` / `clearRunDeepLink` up into `WorkflowRunPage` so the live and finished states
share one owner.

### WR-06: An answered paused run whose definition cannot load stays stranded, while the server now promises it continues

**File:** `backend/app/api/runs.py:672-679` (with `backend/app/api/workflow_runs.py:819-821`)
**Issue:** D-12's charter is that no answered run is left behind. The `definition is None` arm
returns `False` with the run still `paused` and the lease claimed. The answer row exists, so
`/pending` omits the prompt and no surface can answer it again. The only re-drive left is the
boot-time sweep. Meanwhile this phase restored the unconditional sentence "…the run continues as
soon as they answer." The `claim_run` False arm has the same shape when a stale lease from a dead
worker is still inside its window.
**Fix:** Terminalize this arm truthfully too. Use a `_fail_redrive` variant that accepts `paused`
(`WHERE status IN ('active','paused')`), with words such as "Your answer was saved, but the
workflow could not be loaded". Alternatively, drop the "continues" clause whenever the re-drive
returns `False`.

## Info

### IN-01: SEED-364 confirmed accepted, not escalated

**File:** `backend/app/api/workflow_run_evidence.py:309, 344`
**Issue:** `run.org_name` can carry the founder's email (an auto-generated "<email>'s
Organization"). Only the owner or members of that org pass `_ACCESS_SQL`, and members already
receive the identical string from `GET /org/me`, so nothing new crosses. The real fix belongs to
SEED-364 (default org naming).
**Fix:** None here. Keep the seed's trigger.

### IN-02: R-04's "question withheld" is partly vacuous

**File:** `backend/app/services/run_evidence.py:228-234`
**Issue:** For `llm_human_input`, `text` is `phase.config.prompt` (`human_input.py:127, 327`), which
is authored definition text. It ships to the colleague verbatim in `definition.full` (T-289-18).
Only the answer is actually private.
**Fix:** Word R-04 as "the answer is withheld", or drop `config.prompt` of human-input phases from
`definition.full` for non-owners.

### IN-03: Non-owners receive a similarity figure the plan said they would not

**File:** `backend/app/services/harness/phase_confidence.py:112-118`; `backend/app/api/workflow_run_evidence.py:22, 106`
**Issue:** The 289-03 must-have reads "never a citation passage or similarity", and the module
docstring says "no citation passage or score". Every viewer still gets `phase_log[].confidence.avg_similarity`
(an aggregate). The risk is low, but the contract and the payload disagree.
**Fix:** Either state that the aggregate is allowed, or null it for non-owners.

### IN-04: One malformed cited id masks every source for a colleague

**File:** `backend/app/services/run_evidence.py:337-339`; `backend/app/api/workflow_run_evidence.py:203, 240`
**Issue:** `cited_document_ids` keeps any non-empty string. If one id is not a UUID, the
`$1::uuid[]` cast fails, and the fail-closed arm then masks every source and defaults the label.
That is safe, but a single bad row silently degrades the whole report.
**Fix:** Drop ids that fail `UUID(...)` before the query; they are masked anyway.

### IN-05: `_redrive_paused_workflow_run` now returns True when no re-drive was spawned

**File:** `backend/app/api/runs.py:696`
**Issue:** The docstring contract says "Returns True if a re-drive was spawned". The context-failure
arm returns True to suit the one caller.
**Fix:** Return False and update the comment, or update the docstring contract.

### IN-06: The "no match" explanation says "your documents" to a colleague

**File:** `frontend/src/components/workflows/evidenceVocabulary.ts:48-49`
**Issue:** The leaf renders in a colleague's report of someone else's run.
**Fix:** Use "…is not drawn from the knowledge base".

### IN-07: The owner read's `confidence` field is an untyped `dict`

**File:** `backend/app/api/workflow_runs.py:271`
**Issue:** The OpenAPI schema publishes an untyped object, while the evidence route declares
`RunEvidenceConfidence` for the same shape.
**Fix:** Reuse one Pydantic model for both wires.

### IN-08: Missing space in the router import line

**File:** `backend/app/main.py:878`
**Issue:** `workflow_run_evidence,metadata_fields` breaks the list's formatting.
**Fix:** Add the space.

---

_Reviewed: 2026-10-19T19:57:18Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
