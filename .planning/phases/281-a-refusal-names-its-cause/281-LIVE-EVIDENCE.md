# Phase 281 — live evidence (G-4, D-17..D-21, D-32)

Every row below is driven in Chrome against the **real local stack** and read from the rendered
**words** (DOM text), never from a block's presence, a screenshot or a test fixture (D-21). Each
row is then matched to the local database. A row is ✅ PASS only when both the screen and the DB
read agree; otherwise it is ⛔ OWED with its reason. No row is omitted.

- **Source under test:** plans 01-03 merged on `develop` (`3931b0978`); 281-04's own commits change
  docs only (ledger `6b85944da`, this file). The drives record the HEAD they ran at.
- **PHASE_BASE:** `95c62fc83`.
- **Reference data (research-measured, local DB):** pre-fix golden run
  `43b34171-35d9-4884-9f12-0d76f42b1352` (3 engine attempts / 9 shots: 7 × `covers_template` false
  with `rows` missing, 2 narrated, shot 1 also 2 uncited); draft `compliance-gap-report-cim40y`
  (status draft); freshness workflow `fresh-pause-102uat-20a89243`
  (`f59d361b-bc73-4f6c-b856-1a499195b59f`, published, carries a freshness validator).
- **Viewport:** ≥ 1280 px wide (WorkflowRunPage's run panel is `hidden … lg:flex`).
- **Org:** proven before each scenario by the DOM org switcher text plus a DB read of the user's
  memberships (the dev account is in two orgs).

## Operator reply (Task 2)

> *(pending: awaiting the operator's resume-signal, recorded here verbatim when it arrives)*

## Rows

| Row | Scenario | FAIL if (CONTEXT, verbatim) | Status | Evidence |
|---|---|---|---|---|
| A | **D-17** emit miss at publish (+ D-06 live half, + D-32 chat half) | "Publish `Compliance Gap Report` live. **FAIL if** the word "citations" appears, the missing fields are not named, or the step shows as a slug instead of its canvas name." | ⏳ pending | (not yet driven) |
| B | **D-18** golden-run link | "On a refused publish, click *Open the golden run…*. **FAIL if** "coming soon" appears anywhere, the button does nothing, or it opens a different run." | ⏳ pending | (not yet driven) |
| C | **D-19** describe-door refusal (+ SEED-218 connect click) | "Draft a workflow whose step needs an unchosen service. **FAIL if** `connection_not_allowed` shows with technical names OFF, or no next step is given. With the toggle ON, the code appears small." | ⏳ pending | (not yet driven) |
| D | **D-20** freshness with an archived doc | "Run a freshness-checked step over a folder whose newest document is archived. **FAIL if** the archived document's date decides the verdict. This is proven by the run's verdict on screen plus a DB read." | ⏳ pending | (not yet driven) |

### What each row must paste before it can read PASS (281-04-PLAN.md Task 3)

- **A:** the gauntlet's WHAT STOPPED IT headline and cause, verbatim; the new golden run's
  `harness_audit` `emit_rejected` / `emit_failed` rows (per-shot kinds, `missing_keys`,
  `uncited_value_count`, `invented_citation_count`) beside the rendered bullets;
  `workflow_phases.output->>'_failure_reason'`; the failed step's `phases[].name` from the draft
  definition (or NULL/blank); the chat failure message's rendered words and the DB `messages.content`
  row (origin `harness`) for the run's thread, with the D-32 header verdict. "citation" may appear
  only if a row shows `uncited_value_count > 0` or `invented_citation_count > 0`, and then only in
  that bullet. If the model passes the gate: ⛔ OWED "model passed — no refusal to read" with the run id.
- **B:** a `/coming soon/i` search over the whole gauntlet text; the run id WorkflowRunPage loaded,
  the verdict's `golden_run_id`, and the DB `workflow_runs` row (`is_golden_run = true`, latest for
  this definition): all three equal, and the run panel's failed-step reason equal to A's cause.
- **C:** the generate-error block text with technical names OFF, compared with
  `describeRefusalVocabulary.ts`'s `no_service_chosen` sentence + next step; the mono
  `connection_not_allowed · no_service_chosen` with the toggle ON; the page the "Connect …" control
  lands on (SEED-218).
- **D:** the folder's documents (`id`, `created_at`, `archived_at`, `retrievable`) and the
  workflow's `max_age_days`; the newest document's `archived_at` before (expected NULL), after the
  approved write, and after the restore; the verdict on screen and the run's gate audit row.

(The Task 4 sign-off section is added only when the operator's verdict arrives, so that Task 4's
`grep` cannot pass on a placeholder.)
