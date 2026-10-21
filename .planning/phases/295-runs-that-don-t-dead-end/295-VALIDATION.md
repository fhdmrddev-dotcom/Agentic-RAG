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

**Measured 2026-10-21 00:37:25Z by 295-07**, local DB `127.0.0.1:54322`, asyncpg inside a read-only transaction (`SET default_transaction_read_only = on`). Script: the 295-07 scratchpad `sc5.py`, results saved beside it as `sc5_after.json`.

**`:since` = `2026-10-20T23:58:10Z`**, the UAT start instant: the id snapshot was taken at that second, before the first plant. It is later than 20:10Z, so the four 295-02 before-publishes are outside the window, as 295-02 asked.

- **The same query, verbatim** (the §G text above). The only change is the bind: `:since` became `$1::text::timestamptz`, passed `'2026-10-20T23:58:10Z'`. The combined row comes from the same `term` CTE with no `group by`.

| | terminal | failed | citations_failed | share |
|---|---|---|---|---|
| live | 18 | 1 | 0 | **0.0 %** |
| golden | 5 | 0 | 0 | **0.0 %** |
| combined | 23 | 1 | 0 | **0.0 %** |

  Beside the baseline: since 2026-09-01 the combined share was **8.3 %** (1 of 12); all time it was **10.0 %** (27 of 270). The one live failure in the window is S3's Stop (`b9c4635d`, reason `Searched 295-07 empty KB folder and found nothing for “Find the project status”. Stopped by the person who started this run.`), and it carries no citation code.

- **Behaviour-level count** (so the drop cannot be read as a renaming). Query text, verbatim, with the same bind:

```sql
select wr.id, wr.is_golden_run, wr.status,
       (select count(*) from harness_audit ha where ha.run_id = wr.id and ha.event_type = 'policy_applied'
          and ha.metadata #>> '{}' like '%"engine_ask_pause"%') as engine_pauses,
       (select ha.metadata #>> '{}' from harness_audit ha where ha.run_id = wr.id and ha.event_type = 'policy_applied'
          and ha.metadata #>> '{}' like '%"engine_ask_pause"%' order by ha.created_at limit 1) as first_pause,
       (select ha.metadata #>> '{}' from harness_audit ha where ha.run_id = wr.id and ha.event_type = 'run_failed'
          order by ha.created_at desc limit 1) as fail_md
from workflow_runs wr
where wr.created_at >= :since
  and (exists (select 1 from harness_audit ha where ha.run_id = wr.id and ha.event_type = 'policy_applied'
               and ha.metadata #>> '{}' like '%"engine_ask_pause"%')
       or (wr.is_golden_run and exists (select 1 from harness_audit ha where ha.run_id = wr.id and ha.event_type = 'run_failed'
               and ha.metadata #>> '{}' ilike '%during the trial run%')))
order by wr.created_at;
```

  Result: **15 runs** in which the engine gate fired. How they ended: **13 completed, 1 failed** (S3, stopped by the person), **1 cancelled** (S7's armed step, stopped while it waited). 14 were `no_sources` pauses on the `research` step and 1 was an `action_risk` pause on `act`. No golden run hit the found-nothing gate in the window. In the same window, 42 `gate_failed` audit rows carry `citations_required`, which shows the gate DID fire: it fired, it asked a person, and the runs did not end in a citation failure.

⚠ **What this number is and is not.** The window holds only this plan's own UAT drives: 23 terminal runs, most of them deliberately planted over an empty folder so that the gate would fire. So the 0.0 % shows the mechanism working (every gate firing became a pause, never a `citations_required` failure). It is **not** a production rate. A rate needs real use over time, and the operator's production DB was not read (no read was needed by this plan).

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

**Driven 2026-10-21 00:28Z by 295-07**, against the merged code live on `:8000`. The same route the Builder calls was used (`POST /workflows/{id}/publish`), with the same golden input as the before-drive, and nothing was changed on the draft.

| | definition | golden run | publish | `blocked_stage` | judge `overall_passed` / score | judge summary (quoted verbatim) |
|---|---|---|---|---|---|---|
| **after** | `edd81b32-38d9-4d56-bbad-1b37f7c8b835` (295-02's untouched draft) | `41f76119-d2fd-42d1-9ada-9596c93b1d95` | **published v1** (39 s) | none | true / 8 | "The recorded action is a well-formed Project Meridian status email and fits the designed behavior of recording an intended outbound action rather than sending it. It satisfies the apparent business requirement for what would have been emailed." |
| before (4 publishes, 295-02) | `e96b2d97` / `6a3e5e4d` / `e2575151` / `26205b9b` | see above | published v1 ×4 | none | true / 100, 100, 95, 100 | "…correctly indicates that the email was not sent…" (graded the NOT-SENT envelope) |

**Verdict: S5 PASS.** The DMT shape publishes after the fix. ⭐ **What changed, measured:** the before-summaries graded whether the email was honestly *not sent*. The after-summary grades **what the email says** ("a well-formed Project Meridian status email") and checks it against the business requirement. That is D-16's intent: grade the content, not the envelope. 295-02 classified the base evidence as neither (a) nor (b) and shipped the default shape (the note plus the full recorded inputs). The risk 295-02 named, that grading the content could now fail a publish the envelope had passed, did not happen on this sample.

⚠ **One sample, and a score with no scale.** One publish is one sample of a stochastic judge. The score `8` is not comparable with the before-scores (100 / 100 / 95 / 100): the rubric (`JUDGE_RUBRIC_CORE`) names no scale, and the gate reads only `overall_passed`. Two of the four D-47 judge calls below answered `10` and two answered `100`, so this judge picks its own scale call by call. That is recorded as an observation about the rubric, not as a 295 defect.

## D-47 / SEED-360 F-2: the 288 pause plant, 4 publishes after D-10

**Driven 2026-10-21 00:29-00:31Z by 295-07**, against the merged code live on `:8000`, with D-10 already merged (295-04).

**The plant.** This is the 288 S3 shape: `intro` "Draft the note" (`llm_single`), then `approve` "Approve the note" (`llm_human_input`, options Yes / No, `timeout_seconds: 300`), then `wrap` "Finalise" (`llm_single`). Four byte-identical drafts were made through `POST /workflows` (slugs `p295-07-d47-pause-a…d`) and each was published through `POST /workflows/{id}/publish`, with golden input *"Write a short note on why weekly status updates help a team, and get it approved before it is finalised."* Every publish response carried `auto_answered: [{phase: "approve", …}]`, so the pause step was answered automatically each time.

| # | definition / golden run | Verdict | Judge score | Quoted evidence (judge summary, verbatim) | Cites the auto-answer? |
|---|---|---|---|---|---|
| 1 | `18b43a28-…` / `cb438c18-…` | **published v1** | 10 | "The response is concise, relevant, and addresses the benefits of weekly status updates clearly." | **no** |
| 2 | `9c7c91bd-…` / `902df6f5-…` | **published v1** | 100 | "The response clearly and succinctly explains the value of weekly status updates and satisfies the prompt." | **no** |
| 3 | `a2f1f76d-…` / `49bae8ed-…` | **published v1** | 100 | "The provided text is clear, relevant, and well-grounded in the user's prompt, effectively summarizing why weekly status updates matter." | **no** |
| 4 | `63059416-…` / `177868cd-…` | **published v1** | 10 | "The provided text is clear, relevant, and fully aligned with the user’s statement about weekly status updates." | **no** |

**Decision (D-47 / D-17): no `_golden_run_mock` note.** 4 of 4 published, and no summary mentions the auto-answered step. Before D-10, 288 measured 3 of 4 blocked in the UI and 3 of 4 via the API, with summaries like "User only replied 'Yes.' with no task context". The cause 288 suspected, that the wrap step never received the answer (BUG-261020-01), is what D-10 fixed. Neither `validator_kinds.py` nor `publish_service.py` was changed by 295-07: `git diff --numstat 018fbd5c7 -- backend/app/services/harness/validator_kinds.py backend/app/services/harness/publish_service.py` prints nothing. Because no code changed, there is no after-merge re-drive to owe.

Decision rule (D-47 / D-17): add the `_golden_run_mock` sibling note only if the judge still cites the auto-answer; record the counts either way. If the note is added, the after-publishes run only once that commit is merged to develop and the live :8000 worker is proven to serve it; until then the after-row reads OWED ("awaiting merge of <sha>").

---

## G-4 scenarios (CONTEXT D-31)

| # | Scenario | The failure the operator would recognise | Verdict |
|---|---|---|---|
| S1 | A KB step over an empty folder pauses with its worded choices; reload, still paused; answer "Search another folder" with a populated folder; the run completes, cited | The run fails instead of pausing; the card says the window passed or the agent stopped; the folder list shows a folder outside the run's scope; the re-run ignores the folder; the band reads ● Running while it waits | **FAIL (chat-panel home)**: PASS on the run page (`b8a3e6f3`), but the Workspace panel shows the live ask RETIRED: "The run was stopped, so this question no longer needs an answer" (`PendingAskCard.tsx:897`). **Re-driven 2026-10-21 after gap round 1: the retirement is fixed in the chat panel (`b5678cc3`); two new defects in the same home, D-r1-01 and D-r1-02. See "Gap round 1 re-drive (2026-10-21)" below.** |
| S2 | Same plant, answer "Continue without sources"; the step, the evidence page and the export all say unsourced | Any of the four places shows the step done with no `Unsourced` text; the export lacks `unsourced.continued_by` / `at`; the mark is grey and quiet | **PASS** (`d5d77eed`) |
| S3 | S1's exact plant (empty KB folder plus at least one other permitted populated folder) with `grounding_escalated` planted by direct DB (D-36): the locked step PAUSES offering Search another folder and Stop the run with the locked addendum, never Continue; a forged continue POST (by label and by index) is refused | The run fails instead of pausing; `Continue without sources` appears anywhere in the DOM; the forged POST returns 2xx, persists a response row, or completes the step | **PASS** (`b9c4635d`; four forged answers got 422 and wrote no row). The `Answered · run stopped` header was not observed live |
| S4 | Saving a report step with no template is named (warning, save succeeds); publishing is refused naming the template; starting a run is refused naming the template (Run modal and thread entry show the server's words) | The save is rejected; the message names a citation code; publish or run start succeeds; the client shows a constant instead of the server's sentence | **PASS** (Builder, publish route, Run modal, thread entry) |
| S5 | The DMT-shaped workflow (KB → summary → recorded email) publishes | Still blocked by the judge (recorded FAIL with the judge's evidence, never a silent pass) | **PASS** (`edd81b32` published; see SC#3 after) |
| S6 | KB → approve → wrap, where the wrap quotes the real answer | The wrap's output does not contain the person's answer | **PASS** (`dda11389`) |
| S7 | The two stuck runs (`51924c91…` "200-Word Essay Writer", `a77ed2c0…` "Knowledge Base Library Structure Summary") and the reasonless failed runs read truthfully after the reconcile | A stuck run still reads `active` / ● Running; a failed run shows a blank reason; the no-reason sentence shows where a reason was recorded; a run is hidden instead of finalised | **PASS, with a corrected cause** (see S7 below) |

S7 before (RESEARCH Q-9a / Q-9b, 2026-10-20): both stuck runs `active`, anchored, phases terminal (`…:completed | act:cancelled`); 20 failed runs with no `run_failed` (15 `test_214` fixtures from 2026-08-28, 5 June F2 escapes). After: see **S7** in the drive record below (the two runs were already `cancelled` before the merged code was live; a fresh stuck run was planted and the merged reconciler ended it).

**Operator G-4 sign-off:** OWED (autonomous run). The agent's drives are evidence, not the operator's recognition test.

### Drive record (295-07, 2026-10-20 23:57Z to 2026-10-21 00:45Z)

**Set-up, proven before the first drive.**
- **The merged code is live on `:8000`.** `GET /health` answered `{"status":"ok","redis":"ok","maintenance":false}`. `POST /workflows/validate` with a template-less `llm_emit` step answered `200 {"ok":false,"verdicts":[{"code":"no_template_bound","phase":"report","message":"“Write the report” fills a template, but no template is attached to this workflow. Attach a template before you publish or run it.","severity":"incomplete"}]}`. `GET /workflow-runs/<a failed run>` carried the `end_reason` key. The operator's worker log (`backend/logs/backend.53124.log`) shows the reload at `2026-10-21 03:42:42` local (23:42:42Z), after the 295-04 merge. Nothing was restarted.
- **Org proven:** `org_members` holds one row for `fhdmrd@gmail.com` (`d8a54002-…`): org `22f9c615-0eec-440a-8804-ed4784d6f57f`, role `org-admin`.
- **Driver:** headless Chromium through `frontend/node_modules/playwright` (1.60.0) against vite on `localhost:5173`. ⚠ **Deviation from 288/289:** the session was not typed into the login form. A real GoTrue session was minted through the local admin `generate_link` (magic link) plus `/auth/v1/verify`, the 295-02 method (no password read or changed), and placed in the browser's `localStorage` where supabase-js reads it. API-level steps used the same token, through the routes the app calls. No token is recorded here.
- **DB discipline:** the local-DB lock was taken at 23:57:57Z (noclobber). Every `id` / `run_id` in 87 `public` + `auth` tables was snapshotted at 23:58:10Z (47,146 ids) and diffed after cleanup (see Cleanup). No Supabase MCP call of any kind.

**The plants** (created through `POST /workflows`, then flipped to `published` with the same `UPDATE` that `publish_definition` runs, the 289-05 precedent of keeping the stochastic judge out of UAT fixtures):
- An empty folder `295-07 empty KB folder` (`d886d6a8-…`), made through `POST /folders`, with 0 documents.
- **S1 plant** `3b6794c0-…` (`p295-07-s1-found-nothing`): `project_folder_id` = the empty folder, no per-phase `folder_scope` (an unscoped project). Step 1 `research` "Find the project status" (`llm_agent`, `search_documents`), step 2 `wrap` (`llm_single`). The owner can see 30 other folders, several of them populated.
- **S2 plant** `5d58c517-…`: the same KB step, then `approve` (`llm_human_input`, Yes / No), then `wrap`, so the run stays live after the KB step and the spine can be read.
- **S3 plant** `0589c0e1-…`: a byte copy of the S1 definition with `grounding_escalated: true` written on the KB phase by direct DB insert (D-36).
- **S6 plant** `dfb4e0df-…`: a KB step over "PM Demo Project (sample data)" (populated), then `approve` (Yes / No, 600 s window), then a `wrap` that must quote the answer.
- **S7 armed plant** `7cd9c45a-…`: `draft` (`llm_single`), then `act` (`external_action`, `send_email` through the local "Email (SMTP)" connection, `action_risk_armed: true`). It was stopped before approval, so nothing was sent.
- **S4 plant** `5eec4aa6-…`: one `llm_emit` step with no template asset. It was a draft for the Builder and publish drives, then flipped to published past lint (the D-14 precedent) so the Run modal would offer it. It was deleted at cleanup.

#### S1: FAIL in the chat-panel home (PASS on the run page)
Run `b8a3e6f3-e2f0-42b7-b2a5-3c4532d70bd0`, thread `156c78e6-…`, owner default model `deepseek-v4-flash`. Everything below PASSES on the run page (`/app?run=<id>`), which is where it was driven. ⛔ **The same paused ask in the chat thread's Workspace panel is shown RETIRED.** Measured on runs `3ec118a2` (S3 plant) and `108bb381` (the armed plant), both `paused`, in a fresh session. The panel card reads `RETIRED` / the prompt / **`The run was stopped, so this question no longer needs an answer`**, with `Send Answer` disabled (`evidence/s3c_thread_view.png`, `s7armed_thread_panel.png`). That is the scenario's own failure ("the card says … the agent stopped"), in one of the two homes.
- **Cause, read from code (not yet driven RED):** `PendingAskStack` derives `const runIsOver = workflowLock == null && phases.length > 0` at **`frontend/src/components/panel/PendingAskCard.tsx:897`**. For a durable pause the server's `GET /threads/{id}/workflow` answers `locked: true, run_status: "paused", lock_is_stale: true` (no live producer, by design since 295-03). The client seeds the workflow lock only when `locked && !lock_is_stale` (**`frontend/src/providers/StreamsProvider.tsx:2536`**, **`frontend/src/components/chat/ChatArea.tsx:380`**), so the lock is null and the card retires.
- **Why it is a 295 regression and not only inherited:** before 295-03 the armed approval waited in-process with its producer alive (the lock held, so the panel card was live). Now every engine ask is a durable pause, so it lands in this branch. The 289 human-step pause after its window has the same shape, but 289 drove it on the run page only.
- **Route (for the orchestrator):** one derived conjunct, so that a thread whose workflow read says `paused` / `cap_paused` is not "over". It is about 1-3 lines in a G-5-firing file, with a RED test in `PendingAskCard.retired.baseline.test.tsx`. That fits `/gsd:fast` under G-3 (or a G-7-counted gap round if the verifier prefers). The live re-drive is owed after merge.
- **DB:** 3 `gate_failed` (`citations_required: nothing was retrieved (0 sources)`), then `policy_applied {policy: engine_ask_pause, finding: no_sources}` at 00:01:44Z, and the run went `paused` 58 s after start.
- **Card on the run page (DOM text):** `NEEDS YOU` / `No deadline — the run is waiting for your answer and will not continue on its own` / the draft / `Searched 295-07 empty KB folder and found nothing for “Find the project status”. How should the run continue?` / chips in order `Search another folder`, `Continue without sources`, `Stop the run` / `Send Answer`. The band read `Paused for your answer` and `Waiting on fhdmrd@gmail.com (you) to answer "Searched 295-07 empty KB folder and found nothing for “Find the project…".` There was no countdown, and no `● Running` while it waited.
- **Reload:** the page was reloaded and the same three choices came back.
- **Folder list:** after picking `Search another folder`, the chooser listed 30 names. The prompt row's `engine_pause.folders` held the same 30. The owner can see 31 folders (owned, or org-shared in the org), and the only one not offered is the empty folder that was already searched. That matches `resolve_run_scope_root`'s rule for an unscoped definition (any owner-visible folder), and no folder outside the owner's view appears.
- **Answer:** `PM Demo Project (sample data)`, Send Answer at 00:03:36.194Z (UI).
- **DB after:** `validator_ask_user_approved {choice: "Search another folder", finding: no_sources, folder_id: "1564da7e-…"}` at 00:03:37Z. Then `gate_passed`, `research` completed with 10 cited passages (confidence `medium`, 0.47), `wrap` completed, `run_completed` at 00:03:58Z. That is 22 s from the click to completed.
- Screenshots: `evidence/s1_before.png`, `s1_after_reload.png`, `s1_folder_list.png`, `s1_after_send.png`.

#### S2: PASS
Run `d5d77eed-9453-43cc-8a46-602be6adbf27`, thread `b2315257-…`.
- Paused with the three choices. `Continue without sources` was sent through the UI at 00:07:31Z.
- **DB:** `research.output.unsourced = {"at": "2026-10-21T00:07:32.902990+00:00", "continued_by": "d8a54002-…"}`, with the produced text kept as produced and `citations: []`.
- **The four places:**
  1. **Run-page spine** (while the run waited at the approval step): `step-unsourced-line` inside `spine-step-research`: `◌ Unsourced · continued by fhdmrd@gmail.com (you)` / `This output was kept without sources — it does not cite your documents.` (`evidence/s2marks_runpage_spine.png`).
  2. **Chat panel PhaseCard** (thread view, Workspace panel): `research · ◌ Unsourced · continued by fhdmrd@gmail.com (you) · This output was kept without sources — it does not cite your documents. · ✓ Complete` (`evidence/s2_panel_phasecard_unsourced.png`).
  3. **Evidence page** (after `Yes` was answered and the run completed at 00:15:05Z): the same line, with `step-unsourced-line` count 1 (`evidence/s2_evidence.png`).
  4. **Downloaded JSON** `run-evidence-d5d77eed.json`: `phase_log[0].unsourced = {"continued_by": "fhdmrd@gmail.com (you)", "at": "2026-10-21T00:07:32.902990+00:00"}`, and the other steps read `null`. The stored user id does not appear anywhere in the file.
- The mark is the bordered amber `◌ Unsourced` chip, not grey (panel screenshot).
- The wrap step said: "The first step reported that no documents or sources were found for the latest project status, and the person answered “Yes” to approving the note without sources." So the answer and the unsourced note both reached the next model (D-10 / D-11).

#### S3: PASS
Run `b9c4635d-d3f0-4c11-a7d0-b2b6b9beeb3c`, thread `d385ff48-…`, the S3 plant (S1's exact plant plus the D-36 bit).
- **It paused, and did not fail.** `engine_pause = {kind: no_sources, locked: true, continue_allowed: false}`. The options were `["Search another folder", "Stop the run"]`, and the same 30 folders were offered.
- **Prompt, verbatim:** `Searched 295-07 empty KB folder and found nothing for “Find the project status”. This step is set to Must prove it, so it can't continue without sources. How should the run continue?`
- **DOM:** after a reload, `Continue without sources` appears **nowhere** in the page HTML (`page.content()` checked), and `Must prove it` is in the text (`evidence/s3_after_reload.png`).
- **Forged answers** (`POST /runs/b9c4635d…/ask_user_response`, verbatim bodies):
  - by label `{"response_text": "Continue without sources"}` → `422 {"detail":"This step is set to Must prove it, so it can't continue without sources."}`
  - by label and index `{"response_text": "Continue without sources", "choice_index": 1}` → the same `422`.
  - index only `{"response_text": "anything", "choice_index": 1}` → `422 {"detail":"That choice is not one this question offers."}`
  - an unoffered folder (the searched empty one) → `422 {"detail":"That folder is not one this question offers."}`
  - Response rows in the thread: **0 before, 0 after**. The run was still `paused`.
- **Stop the run** was sent through the UI at 00:06:50Z. The run went `failed`, with ONE `run_failed {"reason": "Searched 295-07 empty KB folder and found nothing for “Find the project status”. Stopped by the person who started this run."}`. The evidence page read `Why it stopped: Searched 295-07 empty KB folder and found nothing for “Find the project status”. Stopped by the person who started this run.` The name is the fallback words, because the dev profile has no display name, and the email is never used.
- **The `Answered · run stopped` header: NOT OBSERVED live.** On the run page, the card unmounts as soon as the run leaves `paused`. A text sample 5 s after Send already read the re-driving spine (`● Running`), and the card was gone. In the chat panel the card is retired before it can be answered (see S1). The header is covered only by 295-06's suites, so it is owed to the operator's G-4 pass once the S1 panel defect is fixed.
- ⚠ A second S3 run (`6ec2f298`) was contaminated by this plan's own unit gate (see S7) and was stopped. It is not used as evidence for anything except that.

#### S4: PASS
- **Builder (UI):** the draft `295-07 S4 report with no template` was opened from the Workflows library. The library card itself reads `NEEDS A TEMPLATE`. The tray showed `“Write the report” fills a template, but no template is attached to this workflow. Attach a template before you publish or run it.` The `◆ Publish…` control was **disabled** and `Save draft` was enabled. Pressing `Save draft` gave `PATCH /workflows/5eec4aa6… → 200` and `Saved · still a draft`, so the save succeeded (`evidence/s4_builder_tray.png`, `s4_after_save.png`).
- **Publish (route):** `POST /workflows/5eec4aa6…/publish` → `200 {"published":false,"blocked_stage":"lint","named_failures":[{"code":"no_template_bound","phase":"report","message":"“Write the report” fills a template, but no template is attached to this workflow. Attach a template before you publish or run it."}]}`. No citation code appears in it.
- **Run modal (UI):** with the plant flipped to published past lint, the library card's `Run` opened the modal, which offered `Template to fill · Upload template`. Pressing `▶ Run workflow` without a template gave `POST /threads/5a77ab0a…/messages → 400 {"detail":"“Write the report” fills a template, but no template is attached to this workflow. Attach a template before you publish or run it."}`, and that sentence is in the DOM after the click (`evidence/s4_run_modal_after.png`). ⚠ **Observation (not this phase's code):** the modal had already created its thread (`POST /threads → 201`) before the refusal, so a refused start leaves an empty thread behind. It was deleted at cleanup.
- **Thread entry (UI):** in an existing thread, `Run a workflow`, then the S4 workflow, gave `POST /threads/da71784d…/messages → 400` with the same sentence, and the sentence is in the DOM (`evidence/s4_thread_refused.png`). ⚠ The first attempt of this drive read no sentence, but that was the driver's fault, not the app's: a second click landed on an unrelated sidebar thread named "Run workflow" and navigated away. The corrected drive clicks nothing after the pick.
- **Attaching a template clears it:** `/validate` on the same definition with `assets: [{kind: "template", …}]` answered `200 {"ok":true,"verdicts":[]}`. This was API-level. The Builder upload was not driven.
- No run was created for any refused start (`workflow_runs` on both threads: 0 for S4).

#### S5: PASS
See "SC#3 DMT drive — after" above.

#### S6: PASS
Run `dda11389-b67b-4d0e-8cd4-538b04629e1b`, thread `fd1eb848-…`. The KB step searched "PM Demo Project (sample data)" and cited 11 passages. The approval paused after its 600 s window, and `Yes` was answered through the UI at 00:16:39Z. **DB:** `approve.output = {"text": "Approve the note?", "answer": "Yes"}`. `wrap.output.text` = "The person answered the approval question with "Yes". Project Meridian is at Week 9 of 24 with an overall AMBER status, driven by escalated data-quality and third-party integration risks." The wrap quotes the real answer. Completed at 00:16:44Z.

#### S7: PASS, with the cause corrected

**The two historical stuck runs were already finalised before the merged code was live, and not by it.** Read-only, 2026-10-21 00:00Z:
- `51924c91` "200-Word Essay Writer": `cancelled`, `updated_at 2026-10-20 23:22:22.497Z`.
- `a77ed2c0` "Knowledge Base Library Structure Summary": `cancelled`, `updated_at 23:22:22.665Z`.
- Their last steps were already `cancelled`, and their `claimed_at` values are unchanged (10-19 18:58 / 10-20 00:17).
- **No `harness_audit` row was written at 23:22** (no `run_failed`, no `policy_applied`). Two `ask_user_response {expired: true}` system rows were written at 23:22:22.6Z in 51924c91's thread.
- No other `workflow_runs` row changed in 23:15-23:45Z.

That signature is exactly `_reconcile_workflow_runs`' **cancelled** arm (last step cancelled → `cancelled`, no `run_failed`, prompts expired). But the 295-04 merge landed at 23:41:43Z and the operator's worker reloaded at 23:42:42Z. The operator's `:8000` log has **no line between 03:20 and 03:23 local**, and none of the backend logs mentions either id. 23:22:22Z (03:22:22 +04) falls between 295-04's Task 3 RED commit (03:20:47) and GREEN commit (03:26:57), the window in which that executor had the sweep drafted in its worktree and ran its suites against the local DB under the lock.

**Cause (inferred, strongly supported, not proven to the process):** a test process in the 295-04 worktree booted the app's lifespan (a `TestClient(app)` context), and its boot reconciler ran the worktree's new sweep against the real local DB. This is the SEED-363 hazard 289-05 recorded, when an unprotected TestClient run claimed these same two runs. ⭐ **The same mechanism was reproduced in this plan:** 295-07's own backend unit gate started at about 00:38:40Z. At 00:40:08Z a run this plan had just started (`6ec2f298`, S3 recheck) got a second `phase_started` and a resume shell (`runs.model = unknown`, the `_build_resume_context` signature), with no request to `:8000` that explains it. So a unit-test process re-drove a live run from worktree code. **The finding for the orchestrator:** the unit suite can boot the real lifespan against the operator's local DB. Any worktree run of `tests/unit` while live runs exist can terminalize or re-drive them. SEED-363 is the record, and this is now its second and third observation.

**After, read through the app.** Both runs' evidence pages read `RESULT Cancelled`, with no reason line, which UI-SPEC C.1 specifies for a cancelled run with no recorded reason. Their `end_reason` is `null` on both `GET /workflow-runs/{id}` and the evidence read. They are shown, not hidden.
- ⚠ The evidence report's result fact reads `Cancelled` with no `⊘` glyph, while a failed run reads `✕ Failed`. This is an observation for the operator's G-4 pass, not a reading the row requires.
- ⚠ Neither run carries the plan's expected "Finalised by the reconciler" sentence. The sweep's cancelled arm writes no reason by design (D-21), and the sweep that ended them was not the merged one.

**The merged reconciler, proven on a fresh plant.** A stuck run was planted at 00:00:27Z: `ef53f1fc-8e17-411b-b120-58c18d26af78`, `active`, both steps `completed`, row `updated_at` 20 min old (older than the 300 s lease). The periodic sweep on `:8000` (every 120 s) ended it at **00:00:50.74Z**: `failed`, ONE `run_failed {"reason": "Finalised by the reconciler: its steps had ended."}`. Log, verbatim: `2026-10-21 04:00:50,803 INFO app.services.run_reconciler Run reconciler terminalized 1 orphaned run(s)` / `2026-10-21 04:00:50,803 INFO app.main Periodic run reconciler closed 1 orphan(s)`. The run page and evidence page read `✕ Failed` / `Why it stopped: Finalised by the reconciler: its steps had ended.` (`evidence/s7_ef53f1fc.png`).

**The reasonless failed runs.** Q-9b (RESEARCH, verbatim) now returns **5 rows, not 20**. The 15 `test_214` fixtures are gone from the local DB (295-02 and 295-04 recorded the operator's deletion). The 5 June runs (`5aa42b6b`, `e0d1f740`, `575e7345`, `a7f415ad`, `4ea9bc56`) have `end_reason: null` on both reads, and their pages read `✕ Failed` / `No reason was recorded when this run failed.` (seen on `5aa42b6b` and `575e7345`, `evidence/s7_*.png`). Q-9a returns no stuck run, only this plan's live runs at the moment of the read.

**Waiting for approval reads paused; a Stop reads cancelled.** Run `15fadac6-9606-4be2-85a8-167c31451b23` (S7 armed plant):
- `policy_applied {engine_ask_pause, finding: action_risk}` and the run went `paused` 3 s after start. The band read **`Paused for your answer`**, with no `● Running` and no `✕ Failed` in the page. The card read `No deadline — the run is waiting for your answer and will not continue on its own` and offered `Approve this step` / `Do not run it` (`evidence/s7armed_paused_band.png`).
- `Stop` on the run page gave `cancelled` at 00:17:20.96Z, with ONE `policy_applied {policy: run_cancelled, reason: "Stopped by the person who started this run."}`. The page read `Cancelled` and `Why it stopped: Stopped by the person who started this run.` (`evidence/s7armed_after_stop.png`).
- The plan 04 residual (a duplicate `action_risk_pending` on an approved re-drive) was not exercised: this run was stopped, not approved, so it shows one `action_risk_pending`.
- **The plan 04 gap, observed live:** run `b0a8203a` (a run of the "Compliance Gap Report" starter this plan started by mistake, see Cleanup) was cancelled through `DELETE /runs/{id}` while its producer was live. It ended `cancelled` with **no** "Stopped by" reason. That is the recorded D-19 gap (a Stop that reaches a live producer), and it was left as is.

#### Cleanup and the id-snapshot diff
- **Deleted:**
  - the thread of the accidental Compliance Gap run (`c2e21bfb-…`, via `DELETE /threads`). The driver's card locator first matched the wrong library card and pressed `Run workflow` on a shared starter. The run was cancelled 21 s later and its thread deleted, together with its one orphaned `harness_audit` row;
  - the empty thread the refused Run modal left (`5a77ab0a-…`);
  - the S4 plant definition (`5eec4aa6-…`, direct local delete). A published row is immutable and the API deletes only drafts, and a published workflow that lint refuses should not stay in the library.
- **Kept, because this file cites them:**
  - the empty folder;
  - the definitions S1, S2, S3, S6, S7-armed, the two axis plants and the four D-47 plants;
  - the DMT definition `edd81b32` (now published);
  - every cited run and thread.
- **Diff** (`snap_before` 47,146 ids → `snap_after` 48,117), with **0 ids removed** in any table except `connector_sync_runs` (2 added and 2 removed by the operator's background watch loop, not by this plan). Added by this plan:
  - `workflow_definitions` +11, `workflow_runs` +23, `workflow_phases` +53, `threads` +23, `messages` +71, `runs` +83, `harness_audit` +271, `code_executions` +3, `folders` +1;
  - `auth.sessions` +21 and related auth rows (the magic-link sessions);
  - `audit_log` +298 (the app's own route audit).
- **Not touched:** the 15 historical `test_214` rows (already absent), and no production data of any kind.
- **After the diff:** three more runs were made after `snap_after`, for the S3 header recheck and the panel finding: `6ec2f298` (contaminated by the unit gate), `3ec118a2` and `108bb381`. Their threads are `d5d872ce`, `a5bf61a7` and `38cdf37f`. All three were stopped through `DELETE /runs/{id}` and read `cancelled` with ONE `run_cancelled` reason each. They are kept as evidence. At the end, `workflow_runs` held 0 `active` / `paused` rows, and no `runs` shell was left `streaming`.


---

## Gap round 1 re-drive (2026-10-21)

**What was driven, and how.** Driven from 02:26Z to 03:08Z on the merged develop checkout at `128266ef6`, which carries 295-08 (frontend) and 295-09 (backend). The servers were the operator's own: `:8000` (worker reloaded 06:23:46 +04, after the 06:22:53 merge) and vite on `5173`. Nothing was restarted.

The method is 295-07's: headless Chromium through `frontend/node_modules/playwright`, signed in with a magic-link session placed in `localStorage` (no password read), and every verdict read from the live DOM text and checked against a local DB read.

- The local-DB lock was taken at 02:26:34Z with noclobber and released at 03:08:04Z.
- No unit suite or TestClient suite was run.
- No Supabase MCP call of any kind was made.
- Screenshots are in `evidence/r1_*.png`. Records are in `evidence/r1_cr01_api.json`, `r1_wr06_offered.json`, `r1_wr05_publish.json`, `r1_wr01_export.json` and `r1_s2_export.json`.

### S1 in the chat panel: before and after

| | Before (295-07, runs `3ec118a2`, `108bb381`) | After (r1, run `b5678cc3`) |
|---|---|---|
| Panel card on a paused found-nothing run | `RETIRED` · "The run was stopped, so this question no longer needs an answer", Send disabled | `NEEDS YOU` · "No deadline — the run is waiting for your answer and will not continue on its own", three worded choices, Send enabled once a choice is made |
| Panel card on a paused armed approval | `RETIRED`, Send disabled | `NEEDS YOU`, Approve this step / Do not run it, answerable (run `9cb788d0`) |

| # | 295-08 re-drive item | Verdict | Run | The evidence that decides it |
|---|---|---|---|---|
| 1 | "Needs you", not "Retired" | **PASS** | `b5678cc3` | The panel text reads `NEEDS YOU` and the no-deadline line, and the word Retired does not appear (`r1_s1_live_arrival.png`). The DB read `paused` at 02:33:25.6Z. |
| 2 | Three worded choices, no free-text box | **PASS** | `b5678cc3` | The panel shows Search another folder, Continue without sources and Stop the run, in that order. It has 0 `textarea`s, no `ask-free-label`, and no "Reason" label. |
| 3 | Search another folder lists the server's folders, and Send stays disabled until one is chosen | **PASS** | `b5678cc3` | Send was disabled after the choice and enabled after a folder was picked. The list held 31 names: every folder the owner can see, minus the empty folder that was already searched (`r1_s1_panel_folder_list.png`). |
| 4 | Resume, then complete with citations | **PASS in the DB, FAIL in the open tab** | `b5678cc3`, `c4232e01` | **DB:** the run went `paused` → `active` 0.8 s after Send. The research step completed with 25 citations (12 passages, confidence medium), and `run_completed` followed 28 s later. **Same tab** (`c4232e01`, no reload): the panel read `research — Running` for 90 s, which is 62 s past `run_completed` at 03:05:30Z. Only a thread switch showed `wrap — Complete · 30 sources` (`r1_s1resume_same_tab_90s.png`, `r1_s1resume_after_switch.png`). This is **D-r1-02** below. |
| 5 | Reload while paused: still answerable | **PASS** | `b5678cc3` | The app has no URL router, so a reload lands on the home screen (`r1_s1_after_reload.png`). Reopening the thread showed `NEEDS YOU` and the three choices, and the answer in item 3 was sent from that card (`r1_s1_panel_before.png`). |
| 6 | Stop a paused run: the card turns Retired with the stop sentence | **Not observed as written. The expectation is changed** (see HUMAN-UAT test 1) | `3f231cab`, `15867461` | The chat thread has **no Stop control** for a paused run (0 `Stop run` buttons), so the Stop was pressed on the run page. The run page then read `Cancelled` and "Why it stopped: Stopped by the person who started this run." A thread opened afterwards shows **no card**, only `research — Stopped`. That is because `/ask_user/pending` serves no prompt of a run that has ended (by design, D-06). A tab that was already open kept `NEEDS YOU` for 30 s. Answering it got `404 {"detail":"Run not found"}`, and the card then read `EXPIRED · This prompt has expired — the run is no longer active` (`r1_s1stop2_tab1_*.png`). Nothing claims the run is live after the next read. |
| 7 | Panel closed: the full card is in the chat column. Panel open: a one-line pointer | **PASS** | `b5678cc3` | **Panel closed:** the three choices are in the chat column, the page has 1 Send Answer, and there is no pointer (`r1_s1_panel_closed_chat_card.png`). **Panel reopened:** the chat column has 0 choices and the pointer `NEEDS YOU · Searched 295-07 empty KB folder and found nothing … · No answer yet · Answer in panel →`, and the page still has 1 Send Answer (`r1_s1_panel_open_pointer.png`). |
| 8 | A pause that lands while the thread is already open | **Answerable at once if this tab started the run. Not seen if the run was started elsewhere** | `b5678cc3`, `3f231cab` | **Started from this tab** ("Run a workflow"): the card was answerable in the panel 60 s after the start, which is the same moment the DB read `paused`. **Started through the API** while the thread sat open: the panel read "No workspace activity yet" for 155 s after the pause. A thread switch then showed the answerable card (`r1_s1api_live_arrival.png`, `r1_s1api_after_switch.png`). This is the reconcile-trigger limit 295-08 recorded, now measured. |
| 9 | Type in the composer while paused | **Recorded: 409, then a dead-end instruction** | `b5678cc3`, `3f231cab` | The composer is enabled ("Ask anything…"). Sending gives `POST /threads/{id}/messages → 409 {"detail":"Thread is workflow-locked — cancel the active workflow to switch back to Deep mode."}`. The typed message is rolled back, and the column reads "This thread is running a workflow — cancel it to send a Deep message." But the thread offers no cancel control for a paused run (item 6). This is **D-r1-03**. |
| 10 | Armed approval in the panel | **PASS** | `9cb788d0` | The card arrived 6 s after the start. It shows the no-deadline line, the two choices, no countdown and no text box. The 289 line ("The answer window has passed…") does not show, and that is correct: an engine ask has no answer window. "Do not run it" → `failed`, reason "the person who started this run chose not to run “Email the note”, so the run stopped." No email was sent. ⚠ 7 s after the run had failed, the same tab still read `act — Running · paused, waiting on a person` (D-r1-02). |

**S1 verdict.** The defect that gap round 1 was opened for is fixed. The chat panel no longer retires a live paused ask, and the card is answerable in both of the chat homes (panel and chat column) as well as on the run page. But the chat home is not yet a clean experience. After an answer, the thread does not follow the run (D-r1-02). A stale card's refusal is worded falsely (D-r1-01, under CR-01). And the composer tells the person to cancel a run that the thread cannot cancel (D-r1-03).

### 295-09's re-drive list

| Row | Verdict | Run | The evidence that decides it |
|---|---|---|---|
| **CR-01**: a stale answer is refused, nothing re-runs, and the current card still resumes | **PASS on the server. The card's words FAIL (D-r1-01)** | `1c95e132` | Tab A held card T1 with Continue chosen. Tab B answered T1 with Search another folder → "295-r1 second empty folder", and the run paused again on T2 54 s later. Tab A then pressed Send: `409 {"detail":"This question is no longer the one the run is waiting on."}`. Two API replays of T1 got the same 409. **Before → after the replays:** `phase_started` 2 → 2, `runs` rows 8 → 8, prompt rows 2 → 2, response rows 1 → 1, and the status stayed `paused`. `/threads/{id}/ask_user/pending` listed only T2 (`d87b9c1a…`). T2 was answered from the panel (PM Demo): `paused` → `active` in 0.9 s, then `completed` 22 s later, cited. ⚠ **The stale card in tab A read `EXPIRED · This run has already ended — your answer was not saved`**, which is false: the run was paused, waiting on T2 (`r1_cr01_tabA_stale_send.png`). Tab A never showed T2. |
| **WR-01 / BUG-261021-01**: a KB step on a provider with no credit | **PASS** | `f0d5d678` | `claude-opus-5-5` on `anthropic`. The 3 sub-runs (`claude-haiku-4-5-20251001`) failed with "credit balance is too low", and that text is kept only in `runs.error`. The run **failed in 3 s, with no pause and no prompt row**. `run_failed`: "Phase 1 (research) gate failed after 3 attempt(s): citations_required: the model call for this step failed — this is a service outage, not model non-compliance". **No vendor text** in `workflow_phases`, `harness_audit`, `messages`, `GET /workflow-runs/{id}`, the evidence page's text or HTML, or the downloaded export (`r1_wr01_evidence.png`, `r1_wr01_export.json`). No found-nothing choice appears on the page. ⚠ The failed step keeps only its failure reason, so the fixed sentence 295-09 wrote ("This step could not get an answer…") is not visible here. It is used where the step completes. ⚠ Observation, not a 295-09 regression: the reason a person reads carries the internal name `citations_required:` (pre-295 wording). |
| **WR-02**: the folder just searched is not offered again | **PASS** | `1c95e132` | T1's list (31 names) included "295-r1 second empty folder". T2's list (30 names), after that folder came up empty, omits it and also omits the first empty folder. Checked in the prompt row's `engine_pause.folders` and in the UI chooser (`r1_cr01_tabB_T2_folder_list.png`). |
| **WR-06**: a run in one org offers no folders from the other | **FAIL for the row. PASS for the half the review named** | `e9f5f925` (org `22f9c615`), `df323914` (org `c1f18150`) | Driven as `fhdmrd.dev@gmail.com`, the two-org account. The org is proven by each run row's `org_id`, set by `X-Org-Id` on the thread. **Org-A run:** 12 folders. 10 are org-A shared folders, and **2 are the account's own org-B folders** ("295-r1 WR-06 org-B empty project", "… org-B other folder"). The UI chooser shows the same 12 (`r1_wr06_orgA_folder_list.png`). **Org-B run:** 2 folders, "org-B other folder" and **the account's own org-A folder** "295-r1 WR-06 org-A empty project". None of org-A's 10 shared folders is offered. So the fix narrows shared folders as the review asked, but the owner's own folders still cross orgs in both directions. This is **D-r1-04**. Both runs were stopped afterwards. |
| **WR-03**: a non-emit step routed by `skip_to` posts no "gate failed" message | **PASS** | `a99ca39a` | The research gate failed ("citations_required: no field_map on output"). Then `phase_transition research → wrap via skip_to_phase`, and the run completed in 21 s. The thread's messages are the user prompt and the wrap answer only. Observation: the step "middle", which was jumped over, still reads `pending` in the completed run. |
| **WR-05**: the DMT shape still publishes | **PASS for the publish. ⛔ for the trace** | `9f40b1a7` | This is a byte copy of `edd81b32` under a new slug. `POST /publish` → `200 {"published":true}` in 61 s. `judge_verdict`: `overall_passed: true`, score 10, with the summary "The drafted email is well-structured, comprehensive, and grounded in the provided project evidence…" (`r1_wr05_publish.json`). ⛔ Whether the note sits in the judge's system prompt was **not checked**: this session has no LangSmith MCP tool. |
| **WR-07**: paused reads paused; answered reads active, then done | **PASS** | `b5678cc3`, `1c95e132`, `74493c29` | The DB watch logs read `paused` while each run waited. Each went `paused` → `active` within 1 s of the answer, and none went back to `paused` (`b5678cc3`: 02:33:25.6 paused, 02:34:53.4 active, 02:35:20.5 completed). |

### Regression spot-check

| Row | Verdict | Run | The evidence that decides it |
|---|---|---|---|
| **S2** | **PASS** | `74493c29` | Continue was sent from the chat panel. Research completed with `unsourced {at, continued_by}`. Yes was answered on the run page, and the run completed. **Evidence page:** `◌ Unsourced · continued by fhdmrd@gmail.com (you)` with its note (`step-unsourced-line` count 1). **Export:** `phase_log[0].unsourced = {continued_by: "fhdmrd@gmail.com (you)", at}`, and no user id appears in the file. The wrap quotes "Yes". ⚠ The chat panel read `research — Running` for 120 s while the run waited on its approval, and the approval card did not appear. After a thread switch, both the unsourced mark and the card showed (D-r1-02). |
| **S6** | **PASS** | `ae5e412b` | The KB step was cited (24 citations, 10 passages). Yes was answered on the run page. The wrap reads: "The person answered "Yes" to the approval question. …" |

### New defects (recorded, not fixed)

| Id | What | Where | Sized fix |
|---|---|---|---|
| **D-r1-01** | A stale card that is refused under CR-01 says **"This run has already ended — your answer was not saved"** while the run is paused on a newer question. The server's sentence ("This question is no longer the one the run is waiting on.") is not shown, and the stale tab never shows the new card. | `frontend/src/components/panel/PendingAskCard.tsx`, the 409 arm (~line 484-507): it keeps its own words. 295-08 left that arm unchanged before CR-01 gave 409 this second meaning. | In the 409 arm, show `err.message` when it is the server's sentence (not `ASK_ANSWER_FAILED`), and keep the retire. Optionally refetch the stack's pending list so the current card appears. About 3-6 lines plus one case in `PendingAskStack.pausedRun.test.tsx`. Fits G-3 (`/gsd:fast`). |
| **D-r1-02** | **After an answer is given in the chat thread, the thread stops following the run.** The step reads `Running` until the person switches threads, past the run's end and through the next question. Measured three times: S1 `c4232e01` (62 s past completion), S2 `74493c29` (120 s while the run waited on approval, with no card shown), and armed `9cb788d0` (Running after the run failed). This is a 295 consequence: every engine ask is now a durable pause, re-driven by a new producer that the tab is not subscribed to. | `frontend/src/providers/StreamsProvider.tsx` (FIRING): the answer-settle reconcile runs once, while the re-drive is only starting. | After an engine-ask answer, reconcile again until the run leaves `active` (a bounded poll, for example every 3 s until the run ends or pauses), or attach to the new producer's stream. About 15-30 lines in a FIRING hot file, plus a test. Not G-3 sized. It is a gap plan (G-7: one round has run, so a second is allowed) or a named follow-up. It keeps SC#4 ("waiting reads waiting") unmet in the chat home. |
| **D-r1-03** | On a paused run, the composer is enabled, the send is refused with 409, and the client says "cancel it to send a Deep message". But the thread has **no Stop control** for a paused run. | `backend/app/services/workflow_kickoff.py:147-182` refuses. `backend/app/api/threads.py` F2 backstop (~2153-2175) reports the lock as stale, so the client unlocks the composer and shows no Stop. This is the 295-08 finding, now seen live. | **Small option:** word the refusal for a paused run ("This thread's workflow is waiting for your answer in the panel."). That is ~3 lines in `workflow_kickoff.py` plus the client showing the server's words, and fits G-3. **Structural option** (295-08's): exempt `paused` from the F2 stale rule so the lock holds, the composer locks and the Stop control shows. That is ~10-20 lines across two hot files. |
| **D-r1-04** | The WR-06 fix narrows **shared** folders only. A two-org owner's **own** folders from the other org are still offered, in both directions. | `backend/app/utils/folder_utils.py:268-278`: `f["user_id"] == user_id` admits owned folders whatever their `org_id`. | When `restrict_org_ids` is given, an owned folder must also be in the allowed orgs. That is ~2 lines plus one test in `test_295_09_review_fixes.py`. It also tightens publish stage 2.6, whose docstring asks for exactly that. Check `scope.resolve_run_scope_root` for the same rule on a per-run folder override (inherited, D-39 parity). |

**Observation, outside 295's files:** for the two-org account, `POST /folders` and `POST /workflows` ignored `X-Org-Id`, and both landed in the account's own org `c1f18150`. `POST /threads` honoured the header. The WR-06 plants were therefore moved by direct DB update (listed below). Route this separately if it proves real.

### SC#1 now

**Met in both homes for the property it names:** a run pauses with choices, survives a reload, and is answerable. The run page proved it in 295-07, and the chat panel and chat column prove it in this re-drive.

The chat home's lived experience is still owed two fixes:
- **D-r1-02:** after an answer, the thread does not follow the run. This also leaves **SC#4 unmet in the chat home**: the panel read Running while the run waited on its approval.
- **D-r1-01:** a stale card's false words.

The Anthropic roster row stays ⛔ (billing). The credit was still out at 02:46Z (`f0d5d678`'s sub-runs).

### Plants, cleanup and the id-snapshot diff

**Plants made through the app:**
- the folder "295-r1 second empty folder" (`3e4d1a16`);
- eleven threads named `295-r1 …`;
- WR-03 definition `c75e6500`;
- DMT copy `9f40b1a7`, published by the gauntlet;
- as the dev account, folders `c8ce1ab5`, `d1d38ee7` and `b1192620`, and definitions `2398e6f3` and `19ce7dba`.

**Direct-DB plants** (the 295-07 precedent):
- folder `c8ce1ab5` was moved to org `22f9c615`;
- definition `2398e6f3` was moved to org `22f9c615` and set to published;
- definitions `19ce7dba` and `c75e6500` were set to published.

All of these are kept, because this section cites them.

**Snapshot diff:** 48,255 ids → 48,814. **0 ids were removed** in any table except `connector_sync_runs` (2 added and 2 removed by the operator's background watch loop). Added:
- `folders` +4, `workflow_definitions` +4, `threads` +12 (one is the publish golden run's), `workflow_runs` +13, `workflow_phases` +30;
- `messages` +41, `runs` +56, `harness_audit` +137, `audit_log` +241;
- auth rows +8 (the magic-link sessions).

**End state:** `workflow_runs` has 0 `active` / `paused` rows, and `runs` has 0 `streaming` rows.

---

## Four-axis scoreboard (CLAUDE.md UAT recipe, CONTEXT D-33)

Row method: drive the S1 plant (KB step over an empty folder) as a real run with a per-request `model` + `provider` on `POST /threads/{id}/messages`; expect `workflow_runs.status = paused` with an `engine_pause` prompt row; answer `Continue without sources`; expect `completed` with `unsourced` on the KB phase. Verdicts are read from `workflow_runs` / `workflow_phases` / `harness_audit`. Record each row's actual model. The roster is DERIVED at drive time from `MODEL_CAPABILITIES` grouped by provider (newest registry-backed id), never re-typed from here; the column below is the research-time reading.

**Driven 2026-10-21 00:31-00:37Z by 295-07**, against the merged code live on `:8000`. Each row is one real run of the S1 plant (`3b6794c0`, a KB step over the empty folder), started with a per-request `model` and `provider` on `POST /threads/{id}/messages`, with no global setting touched. A row passes when (a) the run went `paused` with an `engine_pause` prompt row and three choices, (b) `Continue without sources` (sent through `POST /runs/{id}/ask_user_response`, the route the card calls) answered 200, and (c) the run ended `completed` with `unsourced` on the KB step. All verdicts were read from `workflow_runs` / `workflow_phases` / `messages` / `runs`.

**Roster derivation** (from `MODEL_CAPABILITIES` in `config.py`, grouped by `provider`, plus the local Model Registry rows in `model_capabilities_overrides`; newest enabled registry-backed id per provider):
- openai: `gpt-5.6-sol` (seed).
- anthropic: `claude-opus-5-5` (registry, `native_tools: true`; newer than the seed's `claude-sonnet-5`).
- google: `gemini-3.8-flash` (registry; the seed's newest is `gemini-3.5-flash`).
- deepseek: `deepseek-v4-pro`.
- zhipu: `glm-5.3` (registry).
- minimax: `MiniMax-M3` (seed).
- moonshot: `kimi-k3` (registry).
- openrouter: `deepseek/deepseek-v4-pro` (seed and registry).

⚠ **What "the actual model" means here, measured:** `workflow_runs.model` records the requested model, but the KB step's agent calls (`runs` sub-run shells) ran on each provider's **sub-agent model**, not the requested one. The KB column below names that model, so a reader can see which model actually faced the empty search.

| # | Provider | Requested (= `workflow_runs.model`) | KB step ran on (sub-runs) | Paused with choices | Continue → completed + unsourced | Verdict |
|---|---|---|---|---|---|---|
| 1 | OpenAI | `gpt-5.6-sol` | `gpt-5.4-mini` | yes, 18 s, 3 choices | yes (`7a58cce3`) | **PASS** |
| 2 | Anthropic | `claude-opus-5-5` | `claude-haiku-4-5-20251001`, **all 3 sub-runs `failed`**: `Your credit balance is too low to access the Anthropic API` | yes, 6 s | yes (`b87cb924`) | ⛔ **BLOCKED (billing), re-tested, not assumed.** The pause and continue mechanics did run, but the KB step never searched. See the finding below. |
| 3 | Google | `gemini-3.8-flash` | `gemini-3.5-flash` | yes, 104 s | yes (`31270f19`) | **PASS** |
| 4 | DeepSeek | `deepseek-v4-pro` | `deepseek-v4-flash` | yes, 49 s | yes (`dc41bf73`) | **PASS** |
| 5 | Zhipu / GLM | `glm-5.3` | `glm-5-turbo` | yes, 97 s | yes (`c56ce422`) | **PASS** |
| 6 | MiniMax | `MiniMax-M3` | `MiniMax-M2.7-highspeed` | yes, 49 s | yes (`e883f07c`) | **PASS** |
| 7 | Moonshot / Kimi | `kimi-k3` (coerce tier) | `kimi-k2.6` | yes, 101 s | yes (`36cb19b3`) | **PASS** |
| 8 | OpenRouter | `deepseek/deepseek-v4-pro` | `deepseek-v4-flash` (via openrouter) | yes, 58 s | yes (`6a5a7342`) | **PASS** (non-native tool path) |

⚠ **Finding, Anthropic row (for the orchestrator; not fixed here):** when the KB step's agent fails at the provider (here a billing refusal, HTTP 400), the step is **not** treated as an outage. `retrieval_error` is `null`, the step's text is the raw provider error (`Sub-agent failed: Error code: 400 - {... 'credit balance is too low' ...}`), and the citations gate reads it as **"found nothing (0 sources)"**. So the person is offered `Search another folder` / `Continue without sources` for what is a provider failure, and `Continue` keeps the error text as an "unsourced" output that is handed to the next step. D-06 says an outage keeps failing with its outage sentence; this path is a sub-agent failure that never reaches retrieval, so D-06's check does not see it. Proposed routing: a reported bug ("a provider error on the KB step is offered as found nothing"), with the fix at the point where the sub-agent failure becomes the step output, so it fails with words.

| Axis | Row | Verdict |
|---|---|---|
| Multi-tool | Plant `e7645ff8` (KB step with `search_documents` and `execute_code`; prompt: compute 17 × 23, then search). Run `1880cf56`, default model. **Both tools ran:** 3 `code_executions` rows in the KB sub-run's thread `15a2e042` (one per attempt; log `Sandbox session opened for thread 15a2e042…`), and the step text reads `Computed value: 17 × 23 = 391` followed by the five empty searches. Then paused (64 s), Continue, completed, `unsourced` set. | **PASS** |
| Parallel-thread | Thread A (`c72eafb4`, run `7efbc5cf`, S1 plant) paused at the found-nothing card after 67 s. While A waited, thread B (`4950fe58`, run `a61e9ee1`, plant `09aa6525` over the populated folder) started at 00:35:49Z and **completed in 27 s** (both steps completed). A still read `paused` when B finished. Then A was answered Continue → 200 → `completed`, `unsourced` set. | **PASS** |
| Long-message | A **7,009-byte** kickoff prompt (21 numbered paragraphs) into the S1 plant. Run `126f1adf`, default model. Paused (64 s) with the three choices, Continue → 200 → `completed`, `unsourced` set. | **PASS** |

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
