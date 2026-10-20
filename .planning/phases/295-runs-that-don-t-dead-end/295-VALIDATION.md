# Phase 295 Validation: G-4 scenarios, SC#3 / SC#5 measurements, and the four-axis scoreboard

**Authored:** 2026-10-20 at planning. Rows are defined now (G-4: failure scenarios fixed at scope time, CONTEXT D-31), driven later.
**Filled by:** 295-02 Task 1 (SC#5 baseline, SC#3 before) and 295-07 (everything else).
**Driver (295-07):** headless Chromium through `frontend/node_modules/playwright`, signed in through the real two-step login form, as 288 and 289 did (the claude-in-chrome tools are not assumed available; that is the recorded deviation). Every UI verdict reads the live DOM text; every state claim is cross-checked with a local DB read; API-level steps go through the routes the app calls. Screenshots go under `evidence/`.
**Stack:** backend `:8000` (the operator's `develop` checkout; never restarted by an agent), vite `[::1]:5173`, local Supabase `127.0.0.1:54322`. Prove the merged code is live before the first drive (295-07 Task 1 probe).
**Org:** prove the dev account's active org first (the account is in two orgs).
**DB discipline:** local DB only, under the local-DB lock (`agentic-rag-localdb.lock`). No Supabase MCP write of any kind. Snapshot ids before planting and diff after cleanup, as 289-05 did.

Verdict vocabulary: `PASS`, `FAIL` (with what was seen), `BLOCKED` (with the reason and an issue id). No row is dropped.

---

## SC#5 baseline (filled by 295-02 Task 1, before any source edit; D-09)

Query (RESEARCH §G, verbatim; `:since` = `'-infinity'` for all-time, `'2026-09-01'` for the recent window):

```sql
with term as (
  select wr.id, wr.is_golden_run, wr.status,
         (select ha.metadata #>> '{}' from harness_audit ha
           where ha.run_id = wr.id and ha.event_type = 'run_failed'
           order by ha.created_at desc limit 1) as fail_md
  from workflow_runs wr
  where wr.status in ('completed','failed','cancelled')
    and wr.created_at >= :since
)
select is_golden_run,
       count(*)                                                            as terminal_runs,
       count(*) filter (where status='failed')                             as failed_runs,
       count(*) filter (where status='failed' and fail_md ilike '%citations_required%') as citations_failed,
       round(100.0 * count(*) filter (where status='failed' and fail_md ilike '%citations_required%')
             / nullif(count(*),0), 1)                                      as pct_of_terminal
from term group by is_golden_run order by is_golden_run;
```

Research-time reading (2026-10-20, all time): live 13/227 (5.7%), golden 14/58 (24.1%), combined 27/285 (9.5%). **Re-measured at base by 295-02:** _(owed)_

## SC#5 after (filled by 295-07)

- The same query with `:since` = the 295 UAT start instant: _(owed)_
- Behaviour-level count (so the drop cannot be read as a renaming): over the same window, runs where the engine citations gate fired (`policy_applied` with `policy = 'engine_ask_pause'`, or a golden `run_failed` carrying the D-07 sentence) and how each ended (`paused` / `completed` / `failed`). Query text recorded beside the result: _(owed)_

## SC#3 DMT drive — before (filled by 295-02 Task 1; D-16)

Source shape: `evidence/dmt-shape-prod-75922069.json`. Local definition id, remaps, publish response, `blocked_stage`, judge score / threshold, quoted evidence: _(owed)_

## SC#3 DMT drive — after (filled by 295-07; D-16)

Same local definition, published after 295-02's judge note: _(owed)_

## D-47 / SEED-360 F-2: the 288 pause plant, 4 publishes after D-10

| # | Verdict | Judge score | Quoted evidence | Cites the auto-answer? |
|---|---|---|---|---|
| 1 | _(owed)_ | | | |
| 2 | _(owed)_ | | | |
| 3 | _(owed)_ | | | |
| 4 | _(owed)_ | | | |

Decision rule (D-47 / D-17): add the `_golden_run_mock` sibling note only if the judge still cites the auto-answer; record the counts either way. If the note is added, the after-publishes run only once that commit is merged to develop and the live :8000 worker is proven to serve it; until then the after-row reads OWED ("awaiting merge of <sha>").

---

## G-4 scenarios (CONTEXT D-31)

| # | Scenario | The failure the operator would recognise | Verdict |
|---|---|---|---|
| S1 | A KB step over an empty folder pauses with its worded choices; reload, still paused; answer "Search another folder" with a populated folder; the run completes, cited | The run fails instead of pausing; the card says the window passed or the agent stopped; the folder list shows a folder outside the run's scope; the re-run ignores the folder; the band reads ● Running while it waits | _(owed)_ |
| S2 | Same plant, answer "Continue without sources"; the step, the evidence page and the export all say unsourced | Any of the four places shows the step done with no `Unsourced` text; the export lacks `unsourced.continued_by` / `at`; the mark is grey and quiet | _(owed)_ |
| S3 | S1's exact plant (empty KB folder plus at least one other permitted populated folder) with `grounding_escalated` planted by direct DB (D-36): the locked step PAUSES offering Search another folder and Stop the run with the locked addendum, never Continue; a forged continue POST (by label and by index) is refused | The run fails instead of pausing; `Continue without sources` appears anywhere in the DOM; the forged POST returns 2xx, persists a response row, or completes the step | _(owed)_ |
| S4 | Saving a report step with no template is named (warning, save succeeds); publishing is refused naming the template; starting a run is refused naming the template (Run modal and thread entry show the server's words) | The save is rejected; the message names a citation code; publish or run start succeeds; the client shows a constant instead of the server's sentence | _(owed)_ |
| S5 | The DMT-shaped workflow (KB → summary → recorded email) publishes | Still blocked by the judge (recorded FAIL with the judge's evidence, never a silent pass) | _(owed)_ |
| S6 | KB → approve → wrap, where the wrap quotes the real answer | The wrap's output does not contain the person's answer | _(owed)_ |
| S7 | The two stuck runs (`51924c91…` "200-Word Essay Writer", `a77ed2c0…` "Knowledge Base Library Structure Summary") and the reasonless failed runs read truthfully after the reconcile | A stuck run still reads `active` / ● Running; a failed run shows a blank reason; the no-reason sentence shows where a reason was recorded; a run is hidden instead of finalised | _(owed)_ |

S7 before (RESEARCH Q-9a / Q-9b, 2026-10-20): both stuck runs `active`, anchored, phases terminal (`…:completed | act:cancelled`); 20 failed runs with no `run_failed` (15 `test_214` fixtures from 2026-08-28, 5 June F2 escapes). After: _(owed)_

**Operator G-4 sign-off:** OWED (autonomous run). The agent's drives are evidence, not the operator's recognition test.

---

## Four-axis scoreboard (CLAUDE.md UAT recipe, CONTEXT D-33)

Row method: drive the S1 plant (KB step over an empty folder) as a real run with a per-request `model` + `provider` on `POST /threads/{id}/messages`; expect `workflow_runs.status = paused` with an `engine_pause` prompt row; answer `Continue without sources`; expect `completed` with `unsourced` on the KB phase. Verdicts are read from `workflow_runs` / `workflow_phases` / `harness_audit`. Record each row's actual model. The roster is DERIVED at drive time from `MODEL_CAPABILITIES` grouped by provider (newest registry-backed id), never re-typed from here; the column below is the research-time reading.

| # | Provider | Model (research-time; re-derive) | Paused with choices | Continue → completed + unsourced | Verdict |
|---|---|---|---|---|---|
| 1 | OpenAI | gpt-5.6-sol | | | _(owed)_ |
| 2 | Anthropic | claude-opus-4-8 / registry claude-opus-5-5 (billing-blocked in 288/289/294: re-test, do not assume) | | | _(owed)_ |
| 3 | Google | gemini-3.5-flash / registry gemini-3.8-flash | | | _(owed)_ |
| 4 | DeepSeek | deepseek-v4-pro | | | _(owed)_ |
| 5 | Zhipu / GLM | glm-5.2 / registry glm-5.3 | | | _(owed)_ |
| 6 | MiniMax | MiniMax-M3 | | | _(owed)_ |
| 7 | Moonshot / Kimi | kimi-k2.6 / registry kimi-k3 (coerce tier) | | | _(owed)_ |
| 8 | OpenRouter | deepseek/deepseek-v4-pro or z-ai/glm-5.2 (non-native tool path) | | | _(owed)_ |

| Axis | Row | Verdict |
|---|---|---|
| Multi-tool | the KB step carries `search_documents` + `execute_code`; one run uses both before the gate pauses | _(owed)_ |
| Parallel-thread | thread A paused at the found-nothing card while thread B starts and completes a run | _(owed)_ |
| Long-message | a ≥ 5 KB kickoff prompt into the KB step; the pause and the answer still work | _(owed)_ |

---

## Automated coverage map (per plan; the Nyquist map from RESEARCH "Validation Architecture")

| Decision | Test | Plan |
|---|---|---|
| D-51 pure move | `backend/tests/unit/test_295_engine_ask_seam.py` | 01 |
| D-09, D-16 before | this file's SC#5 baseline and SC#3 before sections | 02 |
| D-12, D-13, D-45 | `backend/tests/unit/test_295_template_lint.py`, `test_182_severity_codes.py`, `verdictModel.test.ts` | 02 |
| D-15, D-16, D-47 | `backend/tests/unit/test_295_judge_recorded_intent.py` | 02 |
| D-01, D-18, D-37, D-38, D-50 | `backend/tests/unit/test_295_engine_ask_pause.py` | 03 |
| D-02, D-03, D-05, D-36, D-39, D-08, D-48 | `backend/tests/unit/test_295_found_nothing_choices.py` | 03 |
| re-drive, lease, sweep, forged answers | `backend/tests/test_295_engine_ask_redrive.py` | 03 |
| D-10, D-11, D-46 | `backend/tests/unit/test_295_prior_output_answer.py` | 04 |
| D-14, D-19, D-20, D-21, D-23, D-41, D-43, D-49 | `backend/tests/unit/test_295_truthful_run_ends.py`, `test_281_engine_cause_precedence.py`, reconciler suites, `tests/integration/test_214_argument_seams.py` | 04 |
| D-04, D-22, D-37 (read side) | `backend/tests/unit/test_295_run_read_wire.py`, `test_200_1_deliverable_text.py`, `test_288_waiting_on.py`, evidence contract | 05 |
| D-04, D-22 (render) | `StepEvidenceLine`, `RunSpine`, `RunEvidenceReport`, `evidenceView`, `RunEndReasonLine`, `PhaseCard`, `WorkflowRunPage` suites | 05 |
| D-02, D-03, D-37 (card) | `enginePause`, `AskFolderChoice`, `askDraftStore`, `PendingAskCard*`, `PendingAskStack.oneInput` suites | 06 |
