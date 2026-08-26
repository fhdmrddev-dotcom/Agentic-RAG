---
phase: 206-mcp-connector-client-workflow-scoped
type: preflight
stage: plan → execute boundary
reviewed: 2026-08-25
reviewer: Claude (validation pass over Gemini's 206-01-PLAN.md)
verdict: CLEARED TO EXECUTE 2026-08-25. The one blocker was a governance blocker, it went to the operator, and the operator chose ESCALATION — the api.ts split is now ROADMAP Phase 207.
---

# Phase 206 pre-flight

**This is a good plan.** One plan, six tasks, a real SSRF story, and it independently caught the
two-file fence retirement and the platform-asset scoping rule. Everything it names EXISTS — verified,
not assumed: `app.security.egress.validate_destination` (`egress.py:330`), `models/connector.py`,
`api/connectors.py`, `ExternalActionSection.tsx`, `ConnectionPicker.tsx`, `ConnectionPicker.test.tsx`,
`_exec_external_action` (`phase_types.py:2143`), `ExternalActionPhaseConfig` (`harness.py:172`).
Migration **126** is the correct next number (125 is the highest, applied 2026-08-24).

## ✅ Verified — do not re-check

| Claim | Evidence |
|---|---|
| Two-file fence retirement is required | `test_190_ssti_fence.py:475` really does assert the 189 test exists by name. The plan gets this right. |
| `DROP NOT NULL` on `capability` is sufficient | **DRIVEN, not reasoned:** with NOT NULL dropped, a NULL-capability INSERT is **ACCEPTED** — `capability = ANY(ARRAY[...])` evaluates to NULL and a CHECK passes unless it is FALSE. Probe rolled back; table unchanged at 2 rows. |
| Single plan | correct, and it is 204's paid-for lesson |
| No workflow FK on the connection | correctly carried from the roadmap |

---

## ✅ BLOCKER RESOLVED 2026-08-25 — escalated, and Phase 207 now exists

> **OPERATOR DECISION (2026-08-25): ESCALATE.** Phase 206 adds its two runtime exports and spends the
> 7-suite mock budget in the same commit. The split is registered as **ROADMAP Phase 207: `api.ts`
> split**, with a goal, a dependency on 206 landing first, and five success criteria.
>
> ⚠ **The plan's own wording was corrected as part of this.** `206-01-PLAN.md:98` proposed recording
> the escalation as a ledger entry — which is the outcome the strengthened trigger forbids by name
> (*"neither of them is another entry in this file"*). Escalation means a roadmap row. Both the row
> and the ledger pointer are written; **206 writes neither.**

The original finding is preserved below.

### ⛔ (original) `frontend/src/lib/api.ts` adds RUNTIME EXPORTS, and its trigger forbids another decline

Task 5 adds **two runtime exports**: `discoverConnectorTools` and `updateConnectorGrants`.

`docs/HOT-FILE-LEDGER.md:3676` carries the trigger `204-03` wrote, verbatim:

> **The NEXT phase that adds a runtime export to `frontend/src/lib/api.ts` TAKES the split, or
> escalates it to the operator as a phase of its own. It may NOT re-decline.**

**This phase is that next phase, and the plan does not mention the trigger at all.** The two prior
declines (197, 192.2) were each defensible because their changes were **type-only** — measured, with
`git diff … | grep -E 'export (function|const|let|var|class)'` reading 0. That defence is not
available here: these are functions.

⚠ **THIS IS A GOVERNANCE BLOCKER, NOT A TECHNICAL ONE.** Nothing about the MCP client is wrong. The
question is whether Phase 206 takes an extraction of the repository's hottest file (179 commits /
102 phases / 6580 lines) as a side quest, or whether that becomes its own phase. **That is the
operator's call, and the trigger says so explicitly** — "escalates it to the operator" is one of the
two permitted answers.

**Recommendation: escalate and defer.** Taking a 6,580-line extraction inside a phase whose real work
is an MCP client is exactly the "closure round smuggling in a feature" shape G-7 exists to stop. But
it must be recorded as a DECISION with a fresh trigger, not carried silently — and the operator has
to say so, because the trigger removed the executor's authority to decide alone.

⚠ **AND THE MOCK BUDGET IS REAL AND MUST BE SPENT IN THE SAME COMMIT.** Adding a runtime export to
`api.ts` is precisely what produced **249 red tests** at `196-08`. Measured now — **7 suites**
`vi.mock("@/lib/api")` AND touch the surfaces this plan edits:

```
components/chat/__tests__/StopControl.test.tsx
components/workflows/ConnectionPicker.test.tsx
components/workflows/TemplateAttachSection.test.tsx
components/workflows/WorkflowDoorSwitch.test.tsx
hooks/useDraftPersistence.test.tsx
pages/WorkflowBuilderPage.canvas.test.tsx
pages/WorkflowBuilderPage.header.test.tsx
```

---

## ⚠ Findings to close inside the existing tasks

### F-1 · `tool_grants` has TWO spellings for one state — pick one now

Task 4 says: *"`connection.tool_grants.get(tool_name) == "enabled"` or `"granted"`"*. **Two strings
for one concept, in the security predicate itself.** This repo has shipped that shape before
(`runFacts.ts` CR-01, `DecisionsList` D-20) and it always ends the same way: one writer uses one
spelling, one reader checks the other, and the check silently never matches.

Worse here, because **the failure direction is a permission grant**. Decide ONE representation and
write it into the model — a `bool`, or a single literal. And whichever it is, **the absent key must
deny**: `tool_grants.get(name)` returning `None` is "not granted", never "unknown so allow".

### F-2 · The grant read must be an own-property lookup, not a bracket read with a fallback

`tool_grants` is JSONB → a plain `dict`, so `tool_grants.get(...)` is safe in Python. But the
FRONTEND mirror is a JS object literal, where `grants[toolName] ?? false` resolves **inherited** keys
— `"constructor"` returns a function and the fallback never fires. That is the eighth-live-WR-04 sink
(`200-04`), and `automationFacts.ts`, `toolNames.ts` and `modelFitness.ts` each exist because of it.
Use `Object.prototype.hasOwnProperty.call` on the JS side.

### F-3 · The permission refusal owes an AUDIT ROW, not just a failed phase

Task 4 says an ungranted tool should "fail/record with an explicit permission refusal". A refused
outbound action is exactly the event an operator needs afterwards, and `harness_audit` already
carries `external_action_sent` (190) and `circuit_breaker_tripped` (204). ⚠ **A new audit kind means
BOTH layers move in the same commit** — the Python `_AUDIT_EVENT_TYPES` set AND the SQL CHECK.
Registering only Python turns a `ValueError` into a Postgres `23514` **during** the insert; that is
`BUG-260731-02` verbatim, and migration 114's header records the run it killed.

### F-4 · `discovered_tools` is model-controlled text reaching an author's screen

Tool names and descriptions come from a **remote server we do not control**. They are persisted and
then rendered in `ConnectionPicker` / `ExternalActionSection`. The plan has no threat-model entry for
this. ⚠ **Standing criterion for this milestone: every mitigation named in a `<threat_model>` gets a
test — and Phase 203 wrote three and implemented none while every task passed.** This plan has no
`<threat_model>` block at all; it has "must-haves". Add the block, and give SSRF, per-tool grant
enforcement and untrusted-tool-metadata a test each.

### F-5 · SSRF: HTTPS + private-range blocking is necessary and not sufficient

`validate_destination` exists and should be used — but a DNS name that resolves to a private address
**at connect time** defeats a pre-flight check (classic TOCTOU rebinding). Verify whether
`egress.py:330` already pins the resolved IP; if it does not, say so in the SUMMARY rather than
implying the check is stronger than it is.

### F-6 · Two G-5 hot files are edited and the plan names only one

Task 4 updates `docs/HOT-FILE-LEDGER.md` for `phase_types.py` and `connector_service.py`. But Task 5
edits **`frontend/src/lib/api.ts` (the hottest file in the repo)** and `PhaseFormPanel.tsx`
(24/11/1375, G-5). Both need rows re-derived in the same commit — the same-commit sync rule.

### F-7 · The zero-hook pin will bite Task 5

`PhaseFormPanel.test.tsx` pins `useState`/`useMemo`/`useEffect` at an **ABSOLUTE ZERO**. A tool
picker with selection state cannot live there. Two prior phases answered this with extractions
(`FieldGuidance.tsx` 199-06, `StepCardSection.tsx` 200-04) and 204.1 with `PromptVariableChips.tsx`.
**Budget a new leaf component**; the plan says "preserve the pin" without saying how.

---

## Gates for execution

- `backend\venv\Scripts\python -m pytest backend/tests/unit -q` — baseline **68 failing**; report
  only NEW failures, measured by diffing failing-ID SETS against base, not by counting.
- `npx tsc --noEmit -p tsconfig.app.json` from `frontend/` — baseline **34**. ⚠ The bare `--noEmit`
  checks ZERO files.
- `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root — baseline
  `5444 · failed 0 · 110/110`.
- Migration 126: **paste into the local Supabase SQL editor**, never `db push`/`db reset`, then
  `bash scripts/regenerate-full-schema.sh` with no `--reset`.
- ⚠ **Verify by DRIVING a real MCP call**, not by reading code. Both 204 defects and 205's confidence
  came from live runs; 106 green tests hid both. A public MCP endpoint or a local stub server both
  count — what does not count is a mock asserting against itself.
