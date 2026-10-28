# Phase 289 Validation: G-4 scenarios and the SC#10 four-axis scoreboard

**Authored:** 2026-10-19 at planning (rows defined then, per D-15 and G-4: failure scenarios fixed at scope time, not post-hoc).
**Driven:** 2026-10-19, 22:49-23:12 local (18:49-19:12Z), by 289-05, against the live local stack: backend `:8000` on `develop` with `--reload` (it hot-reloaded the restored sentence at `dd863ca5a`; the evidence route answered `404 {"detail":"Run not found"}` for a random uuid before the first drive, so the merged code was live), vite `[::1]:5173`, local Supabase.
**Driver:** headless Chromium through `frontend/node_modules/playwright`, signed in through the real two-step login form (email, Continue, password, Sign In), exactly as 288 did. The claude-in-chrome tools were not available to this executor, so this is the same recorded deviation as 288's. Every UI assertion reads the live DOM; screenshots are under `evidence/`; every state claim is cross-checked with a local DB read. API-level steps (B's and C's raw responses, the per-request roster kickoffs) go through the same routes the app calls.
**Org:** proven first: `org_members` for `fhdmrd@gmail.com` (`d8a54002-…`) reads ONE row, org `22f9c615-0eec-440a-8804-ed4784d6f57f`, role `org-admin`. No two-org ambiguity for the owner.
**DB discipline:** local DB only, under the local-DB lock (`agentic-rag-localdb.lock`, taken 18:49:44Z before the first write). Every `id` / `run_id` in 84 `public` + `auth` tables was snapshotted before planting (46,184 ids) and diffed after cleanup (see Cleanup). No Supabase MCP call of any kind.

Verdict vocabulary: `PASS`, `FAIL` (with what was seen), `BLOCKED` (with the reason and an issue id). No row is dropped.

## Fixture (planted by 289-05)

Planted straight into the local DB (`workflow_definitions 109449fd-…`, slug `s289-ev-109449fd`, `published`, v1), bypassing the publish gauntlet on purpose: the judge blocks planted pause workflows most of the time (SEED-360 F-2, still deferred), and 289-01 planted its D-11 workflow the same way. It validates against `WorkflowDefinition`. `project_folder_id` is the owner's PRIVATE folder "Weekly reports" (`2a33b3e3-…`, `is_org_shared = false`, 5 completed documents), so the colleague case can exercise R-01 masking and the W3a label.

1. `research` "Find the evidence": `llm_agent`, `available_tools: ["search_documents"]` (the KB step);
2. `draft` "Draft the note": `llm_agent`, `available_tools: []` (the non-KB step; it can never search);
3. `approve` "Approve the note": `llm_human_input`, options Yes / No, `timeout_seconds: 30`;
4. `wrap` "Confirm": `llm_single` (work left to do after the answer, so a resume is observable).

## G-4 scenarios (D-15)

| # | Scenario | The failure the operator would recognise | Verdict |
|---|---|---|---|
| S5 | Let a pause window pass, answer from the card, the run completes; reload reads completed | The card says "agent stopped" or offers no answer; the run sits `active` after the answer; the log shows `re-drive failed` | **PASS** |
| S1 | Finished run with a KB and a non-KB step opens as the report: four sections, snapshot version, KB step shows confidence, the other shows none | The live spine still shows; a section is missing; the non-KB step shows any confidence chip; the version shown is the current one | **PASS** |
| S2 | Edit the workflow after the run, reopen: still the run's version, banner says it changed | The page shows the edited definition, or no banner | **PASS** |
| S3 | Export, compare the export's four sections to the page | The JSON omits the sources, or differs from what the page shows | **PASS** |
| S4 | Another-org user refused (404) for page and export; same-org non-owner reads it with no write controls and no owner email | The outsider sees anything about the run, or a 403; the colleague sees an email, "(you)", a Cancel/Answer control, or a private document name | **PASS** (one recorded observation: the org's own NAME contains the founder's email) |

S5 ran FIRST: it gated the D-13 sentence restore in `compose_waiting_on`.

### S5 (a paused run that is answered resumes): PASS

Run `229f45ae-c85e-4707-a46c-bf4787541547`, thread `bed19e8c-…`, started 18:50:52Z with the owner's default model (`workflow_runs.model = deepseek-v4-flash`).

| Step | Observed |
|---|---|
| DB after the window | `workflow_runs.status = paused` at 18:51:44Z; `research` completed, `draft` completed, `approve` active, `wrap` pending. `:8000` log: `phase approve paused on the human gate for run 229f45ae-…: no answer after 30s — the run is paused and stays resumable` |
| Run page `/app?run=229f45ae-…`, card DOM text before answering | `NEEDS YOU` / `The answer window has passed. The run is paused and still waiting for your answer.` / `DRAFT · AWAITING YOUR REVIEW — NOT YET SAVED` / (the draft text) / `Approve the note?` / `Yes` `No` / `OR` / `REASON` / `Send Answer` |
| Controls | `Send Answer` buttons: 1. `/agent stopped/i` on the whole page: **false** |
| Answer | radio `Yes`, then `Send Answer`, clicked through the UI at 18:53:32.296Z |
| DB | `status = completed` at 18:53:36.73Z (about 4.4 s after the click); `approve` completed, `wrap` completed with "Yes — the note is approved because …" |
| Reload | `/app?run=229f45ae-…` renders the evidence report, Result fact `✓ Completed` (see S1) |
| Screenshots | `evidence/s5_paused_card.png` (card + spine before), `evidence/s5_after_answer.png` |

**D-11 after-capture** (beside 289-01's base capture, where the same answer produced `ERROR app.api.runs ask_user_response: re-drive failed for run c396cd9a-…` and `UndefinedFunctionError: operator does not exist: uuid = text`). The `:8000` worker log (`backend/logs/backend.16012.log`) for this run, verbatim:

```
2026-10-19 22:53:33,579 INFO app.api.runs ask_user_response: re-drove paused run 229f45ae-c85e-4707-a46c-bf4787541547 on tcid e15d4d05fd5443359e269805cad17423
2026-10-19 22:53:33,615 INFO app.services.harness.human_input llm_human_input: consumed the durable answer on re-drive run=229f45ae-c85e-4707-a46c-bf4787541547 tcid=e15d4d05fd5443359e269805cad17423
2026-10-19 22:53:34,237 INFO httpx HTTP Request: POST https://api.deepseek.com/v1/chat/completions "HTTP/1.1 200 OK"
```

`grep` of that log for `re-drive failed` / `paused re-drive raised` / `re-drive skipped`: **0 / 0 / 0** (whole file, not just this run). The roster below re-drove eleven more paused runs on the reloaded worker (`backend.35560.log`) with the same 0/0/0.

The resumed segment's model: the `wrap` call after the re-drive went to `api.deepseek.com`; the resume shell's `runs` row records `model = unknown`, `provider = unknown` (`_build_resume_context` inserts that placeholder by design; it is never used for an LLM call). Here the run's own model was also the owner default, so S5 alone cannot show the divergence; the roster does.

**D-13 consequence:** S5 is PASS, so `compose_waiting_on`'s paused sentence was restored to `Still waiting on {who}; the run continues as soon as they answer.` with `test_288_waiting_on.py` pinning it exactly, in commit `dd863ca5a` (`fix(289-05): restore the paused sentence after S5 proved it`). Seen live after the reload: every paused roster run's `GET /workflow-runs/{id}` returned `waiting_on.sentence = "Still waiting on fhdmrd@gmail.com (you); the run continues as soon as they answer."`, and the run page header showed the same line (row P below).

### S1 (the four sections, the snapshot, confidence only where the KB was used): PASS

On the completed S5 run, owner view (`evidence/s1_owner_report.png`):

- `run-evidence-report` present, no `run-spine`.
- Sub line: `Completed in 2m 44s · started 19 Oct 2026, 22:50 by fhdmrd@gmail.com (you) · fhdmrd@gmail.com · fhdmrd@gmail.com's Organization`.
- Facts: `RESULT ✓ Completed` · `VERSION RUN v1` · `CHECKS 1 of 2 passed` · `DELIVERABLE Written answer`.
- Section headings in order: `1 What it ran`, `2 What happened, step by step`, `3 Checks and verdicts`, `4 Sources it used`.
- §1: `Version 1 · 4 steps` and the four snapshot step names. DB: `workflow_runs.definition_snapshot.version = 1`.
- §2, the KB row's evidence line, exactly: `Answered from Weekly reports · 5 passages · ● Medium · 0.50`. DB: `workflow_phases.output->'confidence' = {"level": "medium", "passages": 5, "disclaimer": null, "avg_similarity": 0.4951}`.
- `step-evidence-line` count per row: research **1**, draft **0**, approve **0**, wrap **0**. DB: `draft.output->'confidence' = null`.
- §3: `✕ The step's checks did not pass · Check · step 1 · Failed`, `✓ The step's checks passed · Check · step 1 · Passed`, `A governance policy was applied · Recorded decision · step 3 · Recorded` (the KB step's attached citation gate failed its first attempt, then passed).
- §4: `SKILL_INSTRUCTIONS.md passage 1, passage 2 cited by step 1`, `kb_doc1_project_updates.md passage 1, passage 2 cited by step 1`, `kb_doc2_team_highlights.md passage 2 cited by step 1`.
- Owner buttons in the report: `‹ Back to Workflows`, `Download JSON`, `Print / save as PDF`, `Open the chat thread`. No answer, cancel, retry or edit control.

**SC#4 run-surface arm (live spine):** on a LIVE run the spine card carries the line under the finished KB step only. Seen twice: on S5 while paused (`evidence/s5_paused_card.png`: `Answered from Weekly reports · 5 passages · ● Medium · 0.50` under "Find the evidence", nothing under "Draft the note"), and on the parallel-thread run A while paused (DOM: `step-evidence-line` count 1, text `Answered from Weekly reports · 8 passages · ● Medium · 0.46`; `evidence/p_threadA_paused_spine_line.png`).

Observations (recorded, not failures of the SC):
- **F-B confirmed live:** the KB step's output renders its markdown verbatim (`**No documents matched this week, …**` shows the asterisks). Plan 04 recorded this as a follow-up whose trigger was "the operator, in the S1 drive". The report is readable; whether a record should render markdown is the operator's call.
- The owner's sub line names the email twice (`by fhdmrd@gmail.com (you) · fhdmrd@gmail.com · …`) because the dev profile has no display name, so the "by" name falls back to the email and the email slot repeats it. Cosmetic.

### S2 (edited since the run): PASS

A v2 of the same slug was published (planted: `workflow_definitions 9778a3eb-…`, `version 2`, `published`, step 2 renamed "Draft the short note" with a one-sentence prompt). DB: two rows for `s289-ev-109449fd`, versions 1 and 2. Reopening the S5 run (`evidence/s2_owner_changed.png`):

- Banner, exactly: `⚠ This workflow has changed since this run. The page shows version 1, exactly as it ran. The current version is 2.`
- Facts still `VERSION RUN v1`; §1 still `Version 1 · 4 steps` with "Draft the note" (the snapshot), not "Draft the short note".

### S3 (export matches the page): PASS

`Download JSON` on the owner's report saved `run-evidence-229f45ae.json`. Compared by content:

| Section | Comparison | Result |
|---|---|---|
| whole file | parsed export `==` the parsed `GET /workflow-runs/229f45ae-…/evidence` body the page itself fetched | equal |
| `definition` | `version 1`, `recorded true`; all four `phases[].name` appear in §1; `Version 1 · 4 steps` in §1 | equal |
| `phase_log` | 4 entries = 4 §2 rows; each `name` and the first 50 chars of each `output_text` are in its row; `confidence` non-null on row 1 only, and row 1 is the only row with a `step-evidence-line` | equal |
| `verdicts` | 3 entries (`gate_failed` step 1, `gate_passed` step 1, `policy_applied` step 3) = 3 §3 rows | equal |
| `sources` | 3 entries, each `filename` in §4; `locations [0,1]` = "passage 1, passage 2"; `cited_by [1]` = "cited by step 1" | equal |

### S4 (another org refused; same-org colleague read-only): PASS

Setup through the LOCAL GoTrue admin API with the local service-role key (never printed): user **B** `s289-outsider-b@example.test`, which got its own new org `4562ca84-…` from the signup trigger and nothing else; user **C** `s289-colleague-c@example.test`, its own org plus an `org_members` row in `22f9c615-…` with role `member`. Passwords were random and are not recorded.

**Canvas flag first (Pitfall 2):** `app_settings.feature_visibility.visual_workflow_canvas = {"audience": "everyone"}`, and `GET /workflow-runs` (a `require_canvas` route) answered **200** `{"runs":[],"total":0,…}` for both B and C. So any 404 below is the org scope, not the canvas gate.

**B (another org):**
- Page `/app?run=229f45ae-…`: `This run isn't available` / `It may not exist, or it belongs to an organisation you're not in. Nothing about it is shown here.` / `‹ Back to Workflows`; no report; 0 occurrences of the owner email in the HTML (`evidence/s4_outsider_b.png`). The page's own evidence fetch got 404.
- API, verbatim bodies: B on the real run `404 b'{"detail":"Run not found"}'`; B on a random uuid `404 b'{"detail":"Run not found"}'`. **Byte-identical: true**; status equal; response headers (minus `date` / request id) equal. B sending the owner's org as `X-Org-Id` also gets the same 404 body.

**C (same org, not the owner),** API with `X-Org-Id: 22f9c615-…` → 200, 6,466 bytes:
- `run.started_by = {"name": "the person who started this run", "email": null, "is_you": false}`, `viewer_is_owner: false`; the S5 thread id: 0 occurrences.
- Grep of C's raw response for `fhdmrd@gmail.com`: **1 hit, and it is `run.org_name = "fhdmrd@gmail.com's Organization"`** (the org's display name, auto-generated from the founder's email at signup). It is not an owner field: C receives the same string from `GET /org/me` (`memberships[].name`) and sees it in the org switcher. Excluding `org_name`, the hits are **0**. Recorded as an observation about how orgs are named, outside this phase.
- Sources: all three are `{"masked": true, "document_id": null, "filename": null, "locations": [], "cited_by": [1]}` (R-01). C's own RLS reads: `GET /rest/v1/folders?id=eq.<Weekly reports>` → `[]`, `GET /rest/v1/documents?folder_id=eq.<…>` → `[]`.
- Human step (R-04): `output_text: null`, `human_input = {"answered": true, "question": null, "answer": null, "answered_by": null}`. The owner's view of the same step carries the question and the answer.
- Deliverable: `{"kind": "text", "name": null, "file_id": null}` (no file id, R-02).
- ~~**Accepted risk T-289-31, observed:** C DOES receive the non-human steps' `output_text`, by decision.~~ First 80 characters of step 1 in C's raw response: `"**No documents matched this week, so I can't summarise it.** I searched with a d"`. Step 2 is present too.
  - ⚠ **CORRECTED 2026-10-20 (289-REVIEW CR-01) — T-289-31 is now MITIGATED for masked citations; the original line is struck through rather than deleted.** The live S4 drive observed a step that matched nothing, so the leaking case (a step that cited a document C cannot read, whose output is the model's synthesis of it) was never observed. For a non-owner, a step whose citations include any document masked for that viewer now ships `output_text = "This step's output draws on a document you don't have access to."` (`run_evidence.WITHHELD_OUTPUT_SENTENCE`); an RLS-check failure withholds every citing step (fail closed). The owner path is unchanged, and a non-owner step with no masked citation keeps its output (the accepted remainder). Pinned by `test_289_run_evidence.py::test_a_masked_documents_content_never_reaches_the_colleague_through_output_text`, whose step output carries the private document's title and asserts it absent from the colleague's JSON. ~~**Not re-driven live**~~ (re-driven live 2026-10-20: PASS, see R1 under "Post-review live re-drive" below; the residual was observed live there too): on this S4 run step 1's three cited documents were all masked for C, so C would now read the sentence in place of step 1's text. Residual, recorded rather than claimed closed: a later step that cites nothing but builds on a withheld step's output still ships its text.
- **KB label (W3a):** C sees `kb_label = "the knowledge base"` on the payload and inside step 1's confidence. The owner's view of the same run reads `"Weekly reports"`. C cannot read that folder under RLS (empty read above), so the default words are correct, and the private folder name is absent from C's JSON text.

**C, page** (`evidence/s4_colleague_c.png`): the report renders; sub line `Completed in 2m 44s · started 19 Oct 2026, 22:50 by the person who started this run · fhdmrd@gmail.com's Organization`; KB row line `Answered from the knowledge base · 5 passages · ● Medium · 0.50`; non-KB rows 0 lines; §2 human row `Approve the note · Needs you · approve · Waited for an answer · answered · ✓ Done`; §4 three rows `A document you don't have access to · cited by step 1`; the S2 banner is shown to C too. Report buttons: `‹ Back to Workflows`, `Download JSON`, `Print / save as PDF` only (no thread link, no deliverable download, no answer or cancel). `(you)` on the page: **false**. Owner email in the page text: 1 hit, the org name in the sub line, same as the API.

**C's writes, all refused** (the run stayed `completed`, and no `No` answer message was written):

| Call | Response |
|---|---|
| `POST /runs/<run>/ask_user_response` | `404 {"detail":"Run not found"}` |
| `DELETE /runs/<run>` (cancel) | `404 {"detail":"Run not found"}` |
| `DELETE /runs/<producer runs id>` | `404 {"detail":"Run not found"}` |
| `POST /runs/<run>/continue` | `404 {"detail":"Run not found"}` |

## Four-axis scoreboard (D-17, CLAUDE.md SC#10)

**Method:** each row is a real run started through the app's one kickoff path (`POST /threads`, then `POST /threads/{id}/messages` with `workflow_definition_id` and a **per-request `model` + `provider`**), as 288 did. **No global setting was changed**; `app_settings.llm_model` stayed `deepseek-v4-flash` throughout. Each run was left past its 30 s window to pause, then answered through `POST /runs/{id}/ask_user_response` (the card path was proven through the UI in S5 and row P). The answers were sent one at a time, so every provider request in the log between a run's `re-drove paused run <id>` line and its completion belongs to that run. Scored from `workflow_runs` / `workflow_phases` / `harness_audit` / `runs` and the `:8000` log.

**Roster re-derived from `MODEL_CAPABILITIES`** (grouped by `provider`, newest registry-backed id per group, no inferred ids): openai `gpt-5.6-sol`, anthropic `claude-sonnet-5` (newest; 288 used `claude-opus-4-8`), google `gemini-3.5-flash`, deepseek `deepseek-v4-pro`, zhipu `glm-5.2`, minimax `MiniMax-M3`, moonshot `kimi-k2.6`, openrouter `z-ai/glm-5.2`. That is the seven native providers plus OpenRouter, as at planning.

Per-row checks: (a) KB step `confidence.level` present; (b) non-KB step `confidence` null; (c) the paused-then-answered run reaches `completed`; (d) the resumed segment's actual model.

| Row | Provider / axis | Model id | (a) KB confidence | (b) non-KB none | (c) completes after answer | (d) resumed-segment model | Verdict |
|---|---|---|---|---|---|---|---|
| 1 | OpenAI | gpt-5.6-sol (sub-agents ran on `gpt-5.4-mini`) | first kickoff ("this week's…"): the KB step retrieved 0 sources on 3 attempts, the citation gate failed it, run `failed`; re-run 1b with "…in the weekly reports": **high**, 5 passages, 0.5432 | null (1b) | 1b: paused, answered, **completed** | `api.deepseek.com` (owner default), not OpenAI | **PASS** on 1b (first kickoff FAIL, provider retrieval behaviour, see note) |
| 2 | Anthropic (native SDK; billing-blocked at 288, RE-TESTED) | claude-sonnet-5 (sub-agents ran on `claude-haiku-4-5-20251001`) | not reached | not reached | not reached: run `failed` at `research` | not reached | **BLOCKED** (billing): every sub-agent call returned `Error code: 400 … 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.'` (`request_id req_011CgC7WWTwfYASN2EEA9CET`). Same block as 287/288, re-tested today, not assumed. Issue: operator top-up |
| 3 | Google | gemini-3.5-flash | medium, 8, 0.4365 | null | **completed** | `api.deepseek.com`, not Google | **PASS** |
| 4 | DeepSeek | deepseek-v4-pro | medium, 11, 0.4232 | null | **completed** | `api.deepseek.com` (the owner default `deepseek-v4-flash`, not the run's v4-pro; the log line does not carry the model id) | **PASS** |
| 5 | Zhipu / GLM | glm-5.2 | medium, 5, 0.3958 | null | **completed** | `api.deepseek.com`, not Zhipu | **PASS** |
| 6 | MiniMax | MiniMax-M3 | medium, 9, 0.4203 | null | **completed** | `api.deepseek.com`, not MiniMax | **PASS** |
| 7 | Moonshot / Kimi (emit_tier coerce) | kimi-k2.6 | medium, 7, 0.4397 | null | **completed** | `api.deepseek.com`, not Moonshot | **PASS** |
| 8 | OpenRouter (non-native tool path) | z-ai/glm-5.2 | medium, 8, 0.3909 | null | **completed** | `api.deepseek.com`, not OpenRouter | **PASS** |
| M | Multi-tool: the KB step's prompt drives `search_documents` + `execute_code` in one step | deepseek-v4-pro (fixture variant with `available_tools: [search_documents, execute_code]`) | medium, 19, 0.4347; `audit_log` has `search.query` rows and 2 `code.execute` rows for this thread; the sandbox log reads `Sandbox session using custom image agentic-rag-sandbox:101.1 for thread 2a126d97-…`; output: "Count: 5 distinct documents … (printed by the code run)" | null | **completed** | `api.deepseek.com` | **PASS** |
| P | Parallel thread: thread A's run paused while thread B runs a second workflow; the card and waiting-on belong to A only; B completes | deepseek-v4-pro (A: the fixture; B: a two-step no-pause workflow) | A: medium, 8, 0.4613; live spine line on A's page `Answered from Weekly reports · 8 passages · ● Medium · 0.46`; B's report line `… 8 passages · ● Medium · 0.44` | null (A) | While B was `active`: A `paused` with `waiting_on.sentence = "Still waiting on fhdmrd@gmail.com (you); the run continues as soon as they answer."`, B `waiting_on = null`, B's thread has 0 ask prompts. B **completed**; A's sentence unchanged after. B's page: report, 0 `Send Answer`, no waiting line. A's page: `Send Answer` 1, no "agent stopped"; answered through the card UI at 19:08:35Z; reload: report, `✓ Completed`, `v2` | `api.deepseek.com` (two calls after A's re-drive line) | **PASS** |
| L | Long message: a kickoff of 5 KB or more | deepseek-v4-pro, 6,794-byte kickoff | medium, 5, 0.4951 | null | **completed**; the waiting-on prompt line was the step's question, not the long input | `api.deepseek.com` | **PASS** |

**Row 1 note.** The first OpenAI kickoff said "Summarise this week's project updates". The sub-agent (`gpt-5.4-mini`) searched with a date window that matched nothing (the documents are dated April 2026), and the Phase 185 citation gate failed the step 3 times with `citations_required: nothing was retrieved (0 sources)`. Every other provider retried without the date filter and found passages. The same kickoff without the date words (1b) passed with **high** confidence. This is provider retrieval behaviour under a strict gate, not this phase's code. It is recorded rather than re-scored silently.

**Row (d), the finding the roster was built to measure.** Every resumed segment, whatever provider started the run, ran on the owner's default provider (`api.deepseek.com`). `workflow_runs.model` keeps the per-request id (`gpt-5.6-sol`, `gemini-3.5-flash`, …), and the resume shell's `runs` row says `unknown`. So a run started on OpenAI is finished by DeepSeek after a pause, and nothing on the run records it. `_build_resume_context` resolves `resolve_workflow_ctx_model(owner settings)` (`harness_engine.py`), not `workflow_runs.model`. This is research's "Not fixed" item, now measured on 9 providers' runs. Planted as a seed by 289-05.

What this roster does and does not prove: every non-blocked provider ran the KB step (confidence present with a level), the non-KB step (confidence null) and the paused-after-window-then-answered path to `completed`. Row 2 is blocked by billing, recorded with its reason. No row was dropped.

## Known gaps carried in (not failures of this phase; recorded so they are not mistaken for one)

- The chat panel's `PendingAskStack` has no run status, so its card stays countdown-driven for a paused workflow run (research Open Q4); the run page is the surface D-13 fixes. Decided at plan revision by reading the code, not assumed: the stack's only run signals are the thread lock and the phases (`PendingAskCard.tsx:857-858` at 289-01 HEAD); the lock has no status field (`streamsStore.ts:98-144`), `reconcilePhases` discards the wire's `run_status` (`StreamsProvider.tsx:4640-4641`), and a paused human step reads `running` (`phaseState.ts:61`). Planted as a seed by 289-05. Full evidence: `289-01-SUMMARY.md` `## Named gap: PendingAskStack`.
- A resumed segment runs on the owner's default model, not the run's per-request model: measured above in row (d). Planted as a seed by 289-05.
- The run-level confidence on the final chat message uses default buckets (research F3); per-phase confidence uses the owner's buckets, like chat. Not observable here (the owner has the shipped buckets 0.54 / 0.38).
- SEED-360 F-2 (the judge blocks the planted pause workflow) and F-4 (the `auto_answered` note unmounts with the gauntlet) are deferred.

## Shared-DB hazard, reproduced a third time during this plan

At 18:58Z, after the sentence edit, `pytest tests/test_288_waiting_on.py` was run once WITHOUT the sweep-neutralising plugin. Its `client` fixture entered the real lifespan (`backend/logs/backend.17252.log`, `GET http://testserver/workflow-runs/…`), whose boot sweep `resume_stranded_workflows` **claimed the two pre-existing stranded runs `a77ed2c0-…` and `51924c91-…`** (`claimed_at` 18:58:47-49Z) and then died with `asyncpg … InterfaceError: pool is closing` as the test process shut down. Two empty `system` messages (`expired pending ask_user prompt …`) were written on the old thread `68539c29-…` ("200-Word Essay Writer"). Those two messages were deleted in cleanup. The two runs' `claimed_at` could not be restored, because the before-value is not in the id snapshot. Both runs were already stranded `active` runs before this plan (289-03 found them with `find_resumable_runs`). Every later TestClient run in this plan used the process-local `-p no_run_sweeps` plugin, and their `claimed_at` did not move again. This is the third reproduction (289-01, 289-03, 289-05) and is planted as a seed.

## Cleanup

Snapshot before: 84 tables, **46,184** ids. Created and deleted, in one transaction (dependency order) plus the GoTrue admin API:

| Table | Deleted |
|---|---|
| `workflow_definitions` | 4 (fixture v1, v2, the multi-tool variant, the no-pause workflow B) |
| `threads` | 14 |
| `workflow_runs` | 14 |
| `workflow_phases` | 54 |
| `messages` | 52 (50 on this plan's threads + the 2 sweep markers above) |
| `runs` | 62 |
| `harness_audit` | 189 |
| `audit_log` | 80 (78 `search.query` + 2 `code.execute`, every one carrying one of this plan's thread ids) |
| `code_executions` | 2 |
| `org_members` | 1 (C in `22f9c615`), plus B's and C's own rows through the user delete |
| `auth.users` | 2 (B, C; `identities` / `profiles` cascaded) |
| `organizations` / `departments` | 2 / 2 (B's and C's signup orgs) |
| `auth.sessions` / `refresh_tokens` / `mfa_amr_claims` | 12 / 12 / 12 (this plan's own logins as the owner) |
| `auth.audit_log_entries` | 21 |

Snapshot after: **46,184** ids. Diff against before: **0 new, 0 missing in every table except `connector_sync_runs` (2 new, 2 missing)**, which is the watch service's own rolling history and was not touched. One more blocked drive left no rows (the first M definition, `88e397a6-…`, was refused an UPDATE by the published-immutability trigger and deleted at once). Evidence screenshots stay in `evidence/`.

## Post-review live re-drive (2026-10-20)

**Why:** the eight `fix(289-REVIEW)` commits changed behaviour after S1-S5 were driven (`289-REVIEW-FIX.md`), and only unit tests covered them. This section drives them live. It is UAT evidence only: no code was changed, and nothing that failed would have been fixed here.

**Driven:** 2026-10-19 20:35-20:45Z (00:35-00:45 local on the 20th). Against:
- backend `:8000` on `develop` at `0e130f8f0`, `--reload` worker pid 14072, log `backend/logs/backend.14072.log`. The worker started at 00:21:50 local, after the newest backend source write (`search_documents_tool.py` / `task_service.py` at 00:21:32, the WR-04 fix), and `git status backend/app` was clean, so it served HEAD.
- vite `localhost:5173`, local Supabase.

**Driver:** headless Chromium (`frontend/node_modules/playwright`) through the real two-step login form, plus API calls through the routes the app uses. This is the same recorded deviation as 288 and 289-05: the claude-in-chrome tools were not available. Every UI claim reads the live DOM and is cross-checked with a local DB read. The DB clock and the host clock agree within 10 ms (measured three times), so log times and DB timestamps compare directly.

**DB discipline:**
- The local-DB lock (`agentic-rag-localdb.lock`) was taken at 20:35:04Z, once the orchestrator's baseline released it, and removed at 20:45:30Z.
- Every `id` / `run_id` in 84 `public` + `auth` tables was snapshotted before the first write: **46,187 ids**.
- No Supabase MCP call of any kind.
- The two stranded runs `a77ed2c0` / `51924c91` were never touched. Their `claimed_at` (`20:17:51.733373Z` / `18:58:47.696143Z`) was identical before, mid-drive and after.

**Fixture:** a fresh plant of the 289-05 fixture (`workflow_definitions 8f61c9f7-…`, slug `s289-ev-8f61c9f7`):
- private folder "Weekly reports" (`is_org_shared = false`);
- the same four steps: research (KB), draft (non-KB), approve (`llm_human_input`, 30 s), wrap.

Its KB prompt asks each bullet to name the document it came from, so the KB step's output carries the private filenames. That is exactly the content CR-01 must withhold.

**Users:**
- Owner A: `fhdmrd@gmail.com`, org `22f9c615-…`, `org-admin`, one membership.
- Same-org colleague B: `s289r-colleague-b@example.test`. Created through the local GoTrue admin API, then given an `org_members` row in `22f9c615-…` with role `member`. The password was random and is not recorded.
- Canvas flag: `visual_workflow_canvas.audience = everyone`. B's `GET /workflow-runs` → **200**, so any refusal is the org scope, not the canvas gate.

**Runs** (all owner kickoffs through `POST /threads` + `POST /threads/{id}/messages`, owner default model `deepseek-v4-flash`):
- A `a052667d-8b51-4ef5-9b92-5fd24ae7932f`
- C `4af6909f-5543-4d74-b094-5a00c89d0311`
- D `d6f9c254-e9df-4e6e-b01c-e4451e9debe8`
- E `b464d95d-a4fb-4332-a778-a95ec9255c36`

| # | Item | Verdict | The deciding observation |
|---|---|---|---|
| R1 | CR-01: a colleague who cannot read a cited private document opens the finished run | **PASS** (residual observed live, see below) | On A and E, B's step 1 `output_text` is exactly `This step's output draws on a document you don't have access to.` The private filenames have **0** hits in B's raw JSON and **0** in B's full page `outerHTML`. The owner's JSON names them on both runs, and the owner's page shows the full step 1 text. |
| R2 | CR-02: the card counts down to zero before the 5 s poll reports `paused` | **PASS** | Run E was watched continuously from 20:37:10Z. The card read `EXPIRED / Approve the note? / No response within 0:30 — agent stopped` at 20:38:03.759Z. The poll read `paused` at 20:38:06.424Z, and 54 ms later the card was back to the answer layout with `Send Answer`. |
| R3 | S5 happy path on post-fix code | **PASS** (×2) | E (answered from the recovered card) and A (opened after the pause, answered from the card) both reached `completed`. Drive-window log: **0** `re-drive failed` / `paused re-drive raised` / `re-drive skipped`, and 0 of five other failure-arm strings. Both answers logged `consumed the durable answer on re-drive`. The sentence is still true (seen live on C's header). See the **new finding F-1** below about what the next step receives. |
| R4a | WR-02 stop-first: cancel, then answer | **PASS** | C: cancel `204`, then answer `404 {"detail":"Run not found"}`. Final `cancelled`, **0** `run_failed` rows, no answer message persisted, no re-drive line, no `streaming` shell. |
| R4a′ | WR-02, concurrent: answer and cancel fired at the same instant | **PASS** (supplementary) | D: cancel `204` and answer `200`. The answer won the anchor check and re-drove, then the engine logged `cancel signal observed at the phase boundary before approve — stopping the engine (L-01)`. Final `cancelled`, **0** `run_failed` rows, resume shell finalized (not stranded). |
| R4b | WR-06: the definition cannot load | **⛔ blocked: needs fault injection** | Not reachable through data. Covered by unit test `test_289_redrive_failure.py::test_an_unloadable_definition_ends_the_answered_run_failed_with_words`. |
| R4c | WR-01: the context build raises | **⛔ blocked: needs fault injection** | Not reachable through data. Covered by `test_289_redrive_failure.py::test_a_raising_build_context_ends_the_run_failed_and_still_returns`, `::test_a_build_context_raise_never_strands_a_streaming_shell`, `::test_a_raise_where_the_insert_used_to_precede_it_never_strands_a_shell` and `::test_the_success_path_still_mints_exactly_one_shell_in_the_runs_org`. |
| R5 | WR-05: open `/app?run=<live run>`, then "Back to Workflows" | **PASS** | On D while `active` and on C while `paused`, clicking the run page's own back control (in the header; it reads `‹ Workflows` on the live page) turned `/app?run=<id>&keep=1` into `/app?keep=1`. A reload landed on Chats, not the run. |

Not driven here (operator-owned, still owed): the G-4 print/export sign-off, and the Anthropic roster row (billing).

### R1 (CR-01): PASS, with the residual seen live

`GET /workflow-runs/{id}/evidence` with `X-Org-Id: 22f9c615-…`. Raw bodies were saved in the session scratchpad.

| | Run A | Run E |
|---|---|---|
| Owner response | 200, 7,964 bytes, `viewer_is_owner: true` | 200, 8,484 bytes |
| Colleague B response | 200, 5,707 bytes, `viewer_is_owner: false` | 200, 6,137 bytes |
| Owner step 1 output names | `kb_doc1_project_updates.md`, `kb_doc2_team_highlights.md`, `SKILL_INSTRUCTIONS.md` | `kb_doc1_project_updates.md`, `kb_doc2_team_highlights.md` |
| Owner sources (all `cited_by [1]`) | 4: `kb_doc1…`, `SKILL_INSTRUCTIONS.md`, `kb_doc2…`, `kb_doc3_metrics_decisions.md` | 4: `SKILL_INSTRUCTIONS.md`, `kb_doc1…`, `kb_doc2…`, `weekly_report_structure.md` |
| B step 1 `output_text` | the withheld sentence, exactly | the withheld sentence, exactly |
| B sources | 4 × `{filename: null, masked: true, cited_by: [1]}` | the same |
| Title hits in B's raw JSON | **0** | **0** |
| Title hits in the owner's raw JSON | 9 needles, 16 hits (including `Weekly reports` 2) | 9 needles, 16 hits (including `Weekly reports` 2) |

The needles were the five filenames in the folder, the same five without their extensions, and the folder name `Weekly reports`.

B's own RLS reads confirm B cannot read them: `GET /rest/v1/folders?id=eq.<Weekly reports>` → `[]`, and `GET /rest/v1/documents?folder_id=eq.<…>` → `[]`.

**Pages:**
- B's report on A and on E (`evidence/cr01_colleague_runA.png`, `evidence/cr01_colleague_runE.png`):
  - step 1 row reads `This step's output draws on a document you don't have access to. · 20 sources · Answered from the knowledge base · 11 passages · ● Medium · 0.42` (A);
  - §4 shows four `A document you don't have access to · cited by step 1`;
  - buttons are `‹ Back to Workflows`, `Download JSON`, `Print / save as PDF` only;
  - `(you)` is absent;
  - the full `document.documentElement.outerHTML` has **0** hits for every needle (A 266,247 bytes, E 267,118 bytes).
- The owner's report on A (`evidence/cr01_owner_runA.png`) shows step 1's full text, the four filenames in §4 and `Open the chat thread`.

**Residual, observed live (recorded by the fixer as open; not a regression):** step 2 ("Draft the note") cites nothing, so its text is not withheld. It is built from step 1's output and ships the private documents' **substance** to B: project status, figures, and named people's hiring and departure news. Example: A's step 2 opens `For the week of April 7–11, Alpha Dashboard work is in progress but blocked on dark-mode b…`. No filename or folder name appeared in step 2 on either run, so the CR-01 criterion (the titles) holds. The content boundary is still open, one step downstream. This is the residual named in `289-REVIEW-FIX.md` CR-01. The live drive shows it is not theoretical: on this fixture the step that follows the KB step always restates it.

### R2 (CR-02): PASS

Run E: kicked off at 20:36:59Z. The watcher opened `/app?run=b464d95d-…` at 20:37:10Z and sampled the DOM every 200 ms; it logged every change and every poll status change. Abridged, from the watcher log:

| Time (Z) | Source | Observed |
|---|---|---|
| 20:37:11.112 | poll | `active` |
| 20:37:36.360 | DOM | card `NEEDS YOU / 0:27 / DRAFT · AWAITING YOUR REVIEW …`, `Send Answer` 1 |
| 20:38:02.624 | `:8000` log | `phase approve paused on the human gate for run b464d95d-…: no answer after 30s — the run is paused and stays resumable` |
| 20:38:03.759 | DOM | card `EXPIRED / Approve the note? / No response within 0:30 — agent stopped`, `Send Answer` 0 (`evidence/cr02_runE_clock_expired.png`). The spine header still read `● Running`. |
| 20:38:06.424 | poll | `paused` |
| 20:38:06.478 | DOM | card `NEEDS YOU / The answer window has passed. The run is paused and still waiting for your answer. / DRAFT …`, `Send Answer` 1, `agent stopped` false (`evidence/cr02_runE_recovered.png`). Header: `Paused for your answer · Still waiting on fhdmrd@gmail.com (you); the run continues as soon as they answer.` |

The card spent **2.7 s** in the terminal-looking `EXPIRED … agent stopped` state, which is the pre-fix bug's state. It then returned to the answer layout on the first poll that read `paused`, as CR-02 requires. It did not stay expired.

Not observed (not driven): the server-driven 404/409 expiry staying terminal. That arm is pinned by `PendingAskCard.paused.test.tsx`.

Runs A and C do NOT count for R2. A's first watcher died on a regex error in the drive script (not the app), and C's watcher opened after C had already paused. Both are recorded, not used.

### R3 (S5 re-run on post-fix code): PASS on two runs

| | Run E (answered from the recovered card) | Run A (page opened after the pause) |
|---|---|---|
| Paused | `:8000` 20:38:02.624Z | `:8000` 20:36:21.394Z |
| Card before answering | recovered layout (R2) | `NEEDS YOU / The answer window has passed …`, `Send Answer` 1, no `agent stopped` (`evidence/s5r_runA_paused_no_expiry.png`) |
| Answer | radio `Yes` + `Send Answer` through the UI, 20:38:08.506Z | the same, 20:39:02.188Z |
| Card right after | `ANSWERED · AGENT RESUMED / You answered Yes` | the same |
| Log | `20:38:10,181 re-drove paused run b464d95d-… on tcid c902a188…` then `20:38:10,232 consumed the durable answer on re-drive` | `20:39:03,753 re-drove paused run a052667d-…` then `20:39:03,821 consumed the durable answer on re-drive` |
| DB | `run_completed` at 20:38:12.239Z; approve `output.answer = "Yes"`; 1 answer message | `run_completed` at 20:39:06.566Z; approve `output.answer = "Yes"`; 1 answer message |
| Poll / page | `completed` at 20:38:16.359Z; the report rendered at 20:38:16.630Z without a reload; the reload shows the report (`evidence/cr02_runE_after_answer.png`, `evidence/cr02_runE_reload.png`) | `completed` at 20:39:09.851Z; the report rendered; reload shows the report (`evidence/s5r_runA_after_answer.png`, `evidence/s5r_runA_reload.png`) |
| Resume shell | `runs` row `model = unknown`, `completed` | the same |

**Drive-window log** (`backend.14072.log`, lines after the 75 present at the start: 1,632 lines). Each of these strings has **0** hits:
- `re-drive failed`, `paused re-drive raised`, `re-drive skipped` (the three named);
- `re-drive context failed`, `could not end failed re-drive`, `no loadable definition`, `producer-shell finalize failed`, `run_failed emit failed`.

`re-drove paused run` appears 3 times (E, A, D). The sentence `Still waiting on fhdmrd@gmail.com (you); the run continues as soon as they answer.` was seen live in E's header (R2) and in C's header (`evidence/wr05_runC_header_live_run_page.png`).

**New finding F-1 (pre-existing, outside the fixes; recorded, not fixed): the person's answer never reaches the step after the human step.**
- `phase_types._prior_output_text` feeds a downstream LLM step only each prior phase's `text`.
- `human_input._exec_llm_human_input` returns `{"text": <the question>, "answer": <the answer>, …}` on all three of its return paths: timeout default (`:142`), re-drive (`:188`) and live (`:327`).
- So the `wrap` step ("confirm whether the note was approved, based on the answer you are given") receives `Approve the note?` and never `Yes`.
- Live: A's wrap wrote `I can't confirm the note was approved because no approval decision was provided.` E's wrap wrote `Approved — the note accurately summarizes …`. Both runs had `approve.output.answer = "Yes"`.
- So E's wording, and 289-05 S5's `Yes — the note is approved because …`, were the model guessing, not reading the answer.
- The run DOES continue as soon as they answer, so the restored sentence stays literally true. What the continuation does with the answer is a separate defect.
- No seed or bug names it. The nearest is SEED-050 (workflow result quality, general). It should be filed.

### R4: the re-drive arms

**R4a, stop-first (cancel, then answer), run C: PASS.**
- C paused at 20:36:29.710Z (`:8000`: `phase approve paused on the human gate for run 4af6909f-…`).
- The owner's `DELETE /runs/4af6909f-…` → `204` at 20:39:34.378Z. The status read straight after was `cancelled`.
- Then `POST /runs/4af6909f-…/ask_user_response` with the real tcid `f04ec061…` → `404 {"detail":"Run not found"}` at 20:39:34.618Z. The cancel had cleared the thread anchor, so the harness fallback misses and the route returns 404 before persisting anything.
- Final DB:
  - `workflow_runs.status = cancelled`; phases research completed / draft completed / approve **cancelled** / wrap pending;
  - `harness_audit`: 9 rows, ending `policy_applied`. **`run_failed`: 0**;
  - thread anchor `null`; answer messages **0**; `runs` rows on the thread all `completed`, none `streaming`;
  - no `re-drove` line and no failure line for this run.
- Observation: someone answering a run that was just cancelled gets 404 "Run not found" here, not 409 "This run has already been cancelled", because the anchor clear runs first.

**R4a′, concurrent (answer and cancel fired together from two threads), run D: PASS, supplementary.** This is closer to WR-02's race than the sequential order. Timeline from `backend.14072.log` and the DB:
1. D paused at 20:39:48.681Z.
2. At 20:39:50.145-.159 the answer request passed the ownership and anchor checks and persisted its message (`POST /rest/v1/messages 201`).
3. The cancel request read the anchor at 20:39:50.160. `workflow_runs.updated_at` reads 20:39:50.166538, which is `now()`, the transaction start.
4. Both responses returned about 1 s later: cancel `204` at 20:39:51.167Z, answer `200 {"status":"ok"}` at 20:39:51.197Z.
5. In between, the log shows `20:39:51,196 ask_user_response: re-drove paused run d6f9c254-…`, then `20:39:51,204 run d6f9c254-…: cancel signal observed at the phase boundary before approve — stopping the engine (L-01)`.

Final DB:
- `cancelled`; approve `cancelled`; **`run_failed`: 0**; anchor `null`;
- the resume shell's `runs` row (`model = unknown`) finalized `completed`, not left `streaming`;
- 1 answer message.

The guard did what it is for: a Stop racing a re-drive left a cancelled run with no failure record. Observations, not failures:
- (i) The answer was persisted and told `ok` for a run that ended cancelled.
- (ii) The resume shell is finalized `completed` although the run it served was cancelled, because the shell's status only distinguishes `failed`.

**What neither order reaches:** WR-02's exact window is a Stop landing between `resume_run` and `_fail_redrive`'s terminal write. It only opens when the re-drive itself fails, and no live re-drive failed (by design). That arm stays covered by `test_289_redrive_failure.py::test_a_stop_racing_the_fail_arm_leaves_no_failure_record` and `::test_the_fail_arm_emits_run_failed_like_the_engine`.

**R4b, definition unloadable (WR-06): ⛔ BLOCKED, needs fault injection.** `_load_run_definition` returns `None` only when the join `workflow_runs.definition_id → workflow_definitions` finds no row, or the row's `definition` is empty. On local data neither can be produced without changing a guard. Measured read-only:
- `workflow_runs_definition_id_fkey` is `FOREIGN KEY (definition_id) REFERENCES workflow_definitions(id) ON DELETE RESTRICT`;
- `definition_id` is `NOT NULL`;
- `workflow_definitions_block_published` refuses an UPDATE of a published definition.

Disabling a trigger or the FK is fault injection. Covered by the unit test named in the table.

**R4c, context build raises (WR-01): ⛔ BLOCKED, needs fault injection.** In `_build_resume_context` every fallible step except two is wrapped in its own `try/except`: scope resolution, folder-override resolution and owner-settings load.
- The two uncaught raisers are `get_service_role_supabase(org_id)`, which refuses a falsy org, and the final `insert_run`.
- `workflow_runs.org_id` is `NOT NULL` (measured), so the first cannot be reached through data.
- The second needs a DB fault.

Covered by the four unit tests named in the table.

### R5 (WR-05): PASS

The live run page's back control is the header button `‹ Workflows`, with the same `onBack` handler as the report's `‹ Back to Workflows`. The report and the not-found state carry the longer label. It was clicked by a selector scoped to `header button` (`inHeader: true`, chevron present, 1 match).

| Run, state at click | URL before click | After click | After reload |
|---|---|---|---|
| D, `active` (DB `active` before and after the drive, click at 20:39:08.992Z) | `/app?run=d6f9c254-…&keep=1`, live spine shown, no report | `/app?keep=1`, Workflows page | `/app?keep=1`, Chats (not the run) |
| C, `paused` (a live run page, not the report; click at 20:38:21.001Z) | `/app?run=4af6909f-…&keep=1` | `/app?keep=1` | `/app?keep=1`, Chats |

The param was still present right after load (`urlAt0` kept `run=`), so the new `useEffect` does not strip a deep link before the run view mounts. Screenshots: `evidence/wr05_runD_active_header_{live_run_page,after_back,after_reload}.png`, `evidence/wr05_runC_header_{live_run_page,after_back,after_reload}.png`.

Also recorded:
- A first attempt on E clicked the **nav rail's** icon-only "Workflows" button, because an unscoped role match took the first of two matches. It also cleared `run=` and kept `keep=1` (`evidence/wr05_runE_*.png`), which is consistent with the fix's "any departure from the run view" rule. It is not counted as the back-button drive.
- A first attempt on C timed out looking for the label "Back to Workflows" on the live page (`evidence/wr05_runC_live_run_page.png`). That is how the label difference was found.

### Inherited noise in the drive window (not caused here)

- The `:8000` log has 4 `ERROR app.services.audit_service audit write failed [action=thread.create …]: new row violates row-level security policy for table "audit_log"` lines, one per `POST /threads`. They are inherited: 289-05's own drive logs carry the same error (`backend.16012.log` 1, `backend.35560.log` 13).
- 5 `runs.usage missing` warnings (sub-agent and resume shells), the known Phase 256 warning contract.

### Cleanup

Every new id in the mid-drive snapshot was attributed before deletion:
- `threads` (4) and `workflow_runs` (4) were exactly this drive's;
- `messages` 13, `workflow_phases` 16, `harness_audit` 49 and `runs` 16 all hang off those threads/runs (0 unattributable);
- `audit_log` 18 = `search.query` rows, each naming one of this drive's threads;
- `auth.sessions` 23 = 18 owner logins (8 `python-httpx`, 10 browser) + 5 for B, matching this drive's exact login count.

Deleted, the public tables in one transaction, in dependency order:

| Table | Deleted |
|---|---|
| `harness_audit` | 49 |
| `workflow_phases` | 16 |
| `audit_log` | 18 |
| `messages` | 13 |
| `workflow_runs` | 4 |
| `runs` | 16 (9 sub-agent, then 7 top-level) |
| `threads` | 4 |
| `workflow_definitions` | 1 |
| `org_members` | 1 (B in `22f9c615`); B's own row went with the user delete |
| `auth.users` | 1 (B, through the GoTrue admin API; `identities` / `profiles` cascaded) |
| `organizations` / `departments` | 1 / 1 (B's signup org) |
| `auth.sessions` / `refresh_tokens` / `mfa_amr_claims` | 23 / 23 / 23 |
| `auth.audit_log_entries` | 25 (23 logins, B's signup, and the `user_deleted` entry the admin delete wrote) |

Snapshot after: **46,190** ids against **46,187** before. **0 missing in every table.** The only 3 new ids are not this drive's: one `auth.refresh_tokens` row plus its `token_refreshed` / `token_revoked` audit entries at 20:40:41Z. They belong to session `a598755c-…`, the owner's own browser session created 2026-10-13, which rotated its token during the drive. They were left alone.

Evidence screenshots added under `evidence/`: `cr01_*` (3), `cr02_*` (5), `s5r_*` (3), `wr05_*` (10).
