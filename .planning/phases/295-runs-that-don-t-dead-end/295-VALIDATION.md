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

Research-time reading (2026-10-20, all time): live 13/227 (5.7%), golden 14/58 (24.1%), combined 27/285 (9.5%). **Re-measured at base by 295-02:**

Measured 2026-10-20 20:02:57Z, base `7fdf86e70`, local DB `127.0.0.1:54322`, asyncpg inside a read-only transaction (`SET default_transaction_read_only = on`). The query above ran verbatim with one bind change: `:since` became `$1::text::timestamptz`, passed `'-infinity'` and `'2026-09-01'`. Combined rows come from the same `term` CTE with no `group by`. Script: the 295-02 scratchpad `sc5_baseline.py`.

⚠ **The denominator moved, and the reason is recorded.** The operator deleted the 15 leaked `test_214_argument_seams.py` "Global WF" fixture runs on 2026-10-20, before this run (`5b7ec6640`; re-checked here: 0 rows for that definition name). They were live, `failed`, with no `run_failed` audit. The research-time 227 / 285 counted them; this baseline does not. The numerator does not change (13 live, 14 golden), because none of the 15 carried a `run_failed` reason.

**All time (`:since = '-infinity'`):**

| | terminal | failed | citations_failed | share |
|---|---|---|---|---|
| live | 212 | 26 | 13 | **6.1 %** |
| golden | 58 | 19 | 14 | **24.1 %** |
| combined | 270 | 45 | 27 | **10.0 %** (210 completed) |

**Since 2026-09-01 (`:since = '2026-09-01'`):**

| | terminal | failed | citations_failed | share |
|---|---|---|---|---|
| live | 10 | 7 | 1 | **10.0 %** |
| golden | 2 | 0 | 0 | **0.0 %** |
| combined | 12 | 7 | 1 | **8.3 %** (5 completed) |

**Gate-failure mix (RESEARCH "Measurements", verbatim, same read-only transaction):** `cit 109 · zero_src 53 · zero_markers 22 · no_fm 10 · total 122`. Identical to the research-time reading.

## SC#5 after (filled by 295-07)

- The same query with `:since` = the 295 UAT start instant: _(owed)_
- Behaviour-level count (so the drop cannot be read as a renaming): over the same window, runs where the engine citations gate fired (`policy_applied` with `policy = 'engine_ask_pause'`, or a golden `run_failed` carrying the D-07 sentence) and how each ended (`paused` / `completed` / `failed`). Query text recorded beside the result: _(owed)_

## SC#3 DMT drive — before (filled by 295-02 Task 1; D-16)

Source shape: `evidence/dmt-shape-prod-75922069.json`. Local definition id, remaps, publish response, `blocked_stage`, judge score / threshold, quoted evidence:

**Driven 2026-10-20 20:05-20:10Z by 295-02**, under the local-DB lock, against the live backend on `:8000` (the operator's `develop` checkout at the base; `GET /health` answered `{"status":"ok","redis":"ok","maintenance":false}`; nothing was restarted). All calls went through the routes the Builder calls: `POST /workflows/validate`, `POST /workflows` (create draft), `PATCH /workflows/{id}`, `POST /workflows/{id}/publish`. Signed in as `fhdmrd@gmail.com` (`d8a54002-…`) with a real GoTrue session, minted through the local admin `generate_link` (magic link) plus `/auth/v1/verify`. No password was read or changed. **Org proven first:** `org_members` holds ONE row for the account: org `22f9c615-0eec-440a-8804-ed4784d6f57f`, `org-admin`. Judge model: `app_settings.harness_judge_model = gpt-5.4-mini`. Golden input (all publishes): *"Summarise where the project stands: key progress, open risks and the plans for the next weeks, and record an email of that summary to me."*

**Remaps (all recorded):**
- No local folder is named like DMT. `project_folder_id` and phase 0's `folder_scope` → `1564da7e-2348-4237-b7a1-ec17c5ea8f4b`, "PM Demo Project (sample data)": 5 completed documents, 26 of 26 chunks embedded, all `retrievable` (charter, risk log, sprint log, week-8 and week-9 notes).
- The only words edited: `the DMT project's` → `the PM Demo project's` and `the DMT knowledge base` → `the PM Demo knowledge base` in the business requirement; `the DMT project knowledge base` → `the PM Demo project knowledge base` (phase 0 prompt); `the DMT project information` → `the PM Demo project information` (phase 1 prompt). Name and step names are unchanged.
- `connection_id` → `f7884ce6-bf62-4a17-8dc4-cda22a2ee957`, the local "Email (SMTP)" connection (`capability send_email`, `active`). Not dropped.
- Added `slug` / `version: 1`: the prod JSON carries neither, and `WorkflowDefinition` requires both. Validated with `WorkflowDefinition.model_validate` before every insert.

**Attempt 1: the prod shape as-is (`tool_args: {}`).** Definition `e96b2d97-4bcd-4160-a122-f318904b4174`. `/validate`: `ok:false`, two `no_source` errors: *"step 'Send the DMT status summary by email': nothing supplies the required argument 'to'"* and the same for `'subject'`. Publish: `200 {"published":false,"blocked_stage":"lint","named_failures":[no_source to, no_source subject],"golden_run_id":null}`. **On the base code the production shape never reaches the judge.** The Phase 214 argument check (it shipped after the 2026-08-26 attempts) refuses it at lint first. This is a finding about the shape, not about the judge.

**Attempt 2: the same shape with the two required non-body arguments fixed.** `tool_args = {"to": "fhdmrd@gmail.com", "subject": "PM Demo project status summary"}`. Nothing else changed: the body (`content`) is still auto-filled from the upstream step. `/validate`: `ok:true`, 0 verdicts. Then four publishes of byte-identical definitions on fresh drafts, because one judge sample is not a rate:

| # | definition | golden run | publish | `blocked_stage` | judge `overall_passed` / score | judge summary (quoted verbatim) |
|---|---|---|---|---|---|---|
| 1 | `e96b2d97-…` (PATCHed) | `a03e7b44-f1aa-456f-8741-dec3186c6b75` | **published v1** (36 s) | none | true / 100 | "This is a straightforward non-actionable record confirming an unsent email intention. The response is appropriately grounded and does not delegate or fabricate any work." |
| 2 | `6a3e5e4d-13be-4feb-88ae-5a93421746ec` | `a9e78629-9948-424c-b034-e9491b5f9cb0` | **published v1** | none | true / 100 | "The response correctly indicates that the email was not sent and frames the message as a record of intent rather than a completed action." |
| 3 | `e2575151-572e-4eb3-a2ed-6f6d448d5c01` | `564f6407-ae38-4336-b3df-ef58947ba061` | **published v1** | none | true / 95 | "The response correctly treats the prompt as an unexecuted workflow step and records the email intention without inventing a sent message or downstream result." |
| 4 | `26205b9b-43a8-46b4-9ded-b0e2a7a1e599` | `7765d64f-a16d-42aa-956c-65f5cc8653f8` | **published v1** | none | true / 100 | "The record accurately reflects that the email action was only intended, not performed, and no side effects occurred." |

Golden run 1, read from the DB: `gather-dmt-info` completed (it read all five documents and cited them), `summarize-status` completed (a 3,666-character Key Progress / Risks / Plans summary), `email-summary` `recorded_not_sent`. The NOT-SENT body clipped `content` at 500 characters ("… (3666 chars — kept in full in the record)"). `recorded_intent.inputs.content` holds the whole summary.

**Verdict: the before-fix DMT shape is NOT blocked by the judge on the base code (4 of 4 published, scores 100 / 100 / 95 / 100).** The 2026-08-26 blocks (4, 2 in production) do not reproduce locally today. ⚠ **But every summary shows what the judge graded: the NOT-SENT envelope ("correctly indicates that the email was not sent"), never the summary's content.** It passes the step for being honest about not sending, not for what it would have sent. So the base judge does not grade the deliverable, and a recorded step whose content was wrong would pass the same way. This is the evidence Task 3 classifies (see `295-02-SUMMARY.md`).

**Left in place for 295-07:** `edd81b32-38d9-4d56-bbad-1b37f7c8b835` (slug `dmt-project-status-summary-email-295-02-plan07`), the attempt-2 shape, **still a draft and never published**. Publish it after the fix. The four published copies above can no longer be re-published (409). Their golden runs are completed runs created after the SC#5 baseline instant; the SC#5 after-window must start later than 20:10Z on 2026-10-20 or exclude them.

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
