# Phase 288 Validation: G-4 scenarios and the SC#10 four-axis scoreboard

**Driven:** 2026-10-19 against the live local stack (backend :8000 current `develop` code with reload, vite :5173, local Supabase).
**Driver:** headless Chromium through Playwright (`frontend/node_modules/playwright`), signed in as the dev account through the real login form. The claude-in-chrome tools were not available to this executor, so this is a deviation from "drive in Chrome"; every UI assertion reads the live DOM and the DB, and key screenshots are in `evidence/`.
**Org:** the dev account is in ONE org on this box (`org_members` read: `22f9c615-...`, role org-admin), so there was no two-org ambiguity. API drives send that id as `X-Org-Id`.
**DB discipline:** local DB only. Reads through the local PostgREST with the local service role; no Supabase MCP call of any kind. Row ids were snapshotted before the first drive and restored afterwards (see Cleanup).

## G-4 scenarios

| # | Scenario | Verdict |
|---|---|---|
| S2 | Two drafts, no bleed (run FIRST) | PASS: does not reproduce |
| S1 | Name, decisions, node config survive library round trip and hard reload | PASS on the persistence arm; the generate-and-dismiss arm is BLOCKED (billing) |
| S4 | Planted waits 0 / -5 / 99999 / 1801 refused, 300 / 1800 publish | PASS (RED then GREEN) |
| S3 | Publish a pause workflow, run it, waiting-on sentence, reload, answer, completes | PASS in the window; paused-then-answered FAILS to resume (finding F-3) |

### S2 (no cross-draft bleed): not reproduced; the plan 01 unit pin is NOT the evidence, this drive is

Two drafts planted through `POST /workflows` (A and B), then configured **through the UI** (settings row name input and the first step's Instructions field): A = `ALPHA-NAME` / `ALPHA-PROMPT`, B = `BRAVO-NAME` / `BRAVO-PROMPT`, each after "Saved - still a draft".

| Step | Observed |
|---|---|
| B opened right after A was configured | name `S288 two B ...`, never ALPHA |
| A reopened | name ALPHA-NAME, instructions ALPHA-PROMPT |
| B reopened | name BRAVO-NAME, instructions BRAVO-PROMPT |
| Reverse order (B then A) | same, no crossing |
| A renamed to `ALPHA-NAME-INFLIGHT`, back clicked at once (save-state still "Save draft", not yet "Saved"), B opened | B shows BRAVO-NAME / BRAVO-PROMPT; A afterwards shows ALPHA-NAME-INFLIGHT / ALPHA-PROMPT |
| Hard reload, reopen both | A: ALPHA-NAME-INFLIGHT, ALPHA-PROMPT, `decision-name-input` count 1; B: BRAVO-NAME, BRAVO-PROMPT |
| DB cross-check (local) | A row `name`=`definition.name`=ALPHA-NAME-INFLIGHT, phase 0 prompt ALPHA-PROMPT; B row BRAVO-NAME, BRAVO-PROMPT; neither row carries the other's text |

Verdict: **cannot reproduce; the regression test from plan 01 stands (A-01).** No keying fix was made. One observation worth a line: in the in-flight sequence the first click on `builder-back` did not navigate (the header re-wrapped to two rows after the rename, and the save was in flight); a second click did. It is a swallowed click, not bleed, and the data was correct afterwards; recorded, not chased.

### S1 (the draft keeps its configuration)

- **Blocked arm:** "generate a draft through the describe door, then dismiss the arrival". `POST /workflows/generate` returned `{"ok":false,"error":"could_not_generate","detail":"provider_error"}` and the UI showed "The model couldn't produce a usable draft. Nothing was saved." Cause measured, not assumed: `resolve_authoring_model` resolves to `claude-opus-4-8` (Anthropic), and a direct SDK call returned HTTP 400 "Your credit balance is too low". This is the same billing block recorded in Phase 287. **Owed:** the generate -> press X on the arrival card -> reopen arm (it is the only way to reach the receipt-then-dismiss state live). Unit coverage of that arm exists (plan 01); live evidence does not.
- **Driven arm (planted draft standing in for a generated one):** open from the shelf: `draft-settings-row` present, `draft-arrival-card` absent. Expand: `decision-name-input` present, five decision rows. Rename to `S288 ONE renamed`, set step 1 Instructions to `ONE-NODE-CONFIG`, wait for "Saved - still a draft". Library round trip, reopen: row present, name input count **1**, name `S288 ONE renamed`. Hard reload, library, reopen: count **1**, name present, three spine nodes, first node Instructions `ONE-NODE-CONFIG`. DB row: name `S288 ONE renamed`, status `draft`. SEED-183's mechanical check read **0** before the phase and **1** now.
- Screenshot: `evidence/s2_A_after_reload.png` shows the row and name after a hard reload.

### S4 (a planted unbounded wait is refused with a named reason): RED then GREEN

Definition planted for each value: one `llm_human_input` phase, `business_requirement` set, `timeout_seconds` in {0, -5, 99999, 1801, 300, 1800}.

**RED (before the lint exists), live.** The base commit's backend (`266e344c9`, worktree on :8001 against the same local DB, then stopped) answered `POST /workflows/validate`:

| timeout | BASE `ok` | BASE `interactive_phase` findings |
|---|---|---|
| 0 / -5 / 99999 / 1801 | true | 0 |
| 300 / 1800 | true | 0 |

So at base the four planted waits were NOT refused (0 findings each). The unit-level RED in `288-02-SUMMARY.md` (11 failed before implementation) agrees.

**GREEN, head backend (:8000), same six requests:**

| timeout | HEAD `ok` | HEAD findings |
|---|---|---|
| 0 / -5 / 99999 / 1801 | false | 1 each, code `interactive_phase`, severity `incomplete` |
| 300 / 1800 | true | 0 |

The message, identical for all four: "Publishing needs a clear time limit, and one pause step waits outside the allowed range. Set how long it waits to between 1 second and 30 minutes to publish." (it states the 30-minute ceiling, A-03).

**Through the real publish route** (`POST /workflows/{id}/publish`): all four return `published:false`, `blocked_stage:"interactive_phase"`, `named_failures:[{phase:"approve", message:<the sentence above>}]`, no golden run started.

**Through the Builder UI:** for each of the four drafts the `publish-trigger` button is disabled and `publish-blocked-reason` shows the same sentence (the author-time gate fires before the gauntlet is even opened, which is the intended "tray warns for free" behaviour). Screenshots: `evidence/s4_ui_0.png`, `evidence/s4_ui_99999.png`.

**300 and 1800 publish** through the gauntlet UI with the real golden run: both reached `status=published, version=1` in the DB. (The first 300 attempt and the first 1800 attempt were each judged and passed; see finding F-2 about how often the judge blocks these.)

The `on_failure:"ask_user"` validator refusal is unchanged and green (`test_288_pause_lint.py::test_ask_user_validator_refusal_is_unchanged`, and the re-pointed `test_182_validate.py` case now covers it with a second planted shape).

### S3 (a published pause workflow, a run, who it waits on, reload, answer, completes)

Workflow: `intro` (llm_single) -> `approve` (llm_human_input, options Yes/No) -> `wrap` (llm_single); real provider golden run at publish; published through the gauntlet UI (the independent judge blocked the planted pause workflow on 3 of 4 UI attempts and 3 of 4 API attempts before a publish passed; see F-2; the versions used here are ones that passed).

**Inside the answer window, all through the UI (window 120 s so the reload fits):**

| Step | Observed |
|---|---|
| Library -> Run -> kickoff -> confirm | run page opens; band "Running" |
| waiting-on line (`run-waiting-on`) | `Waiting on fhdmrd@gmail.com (you) to answer "Approve the release?".` |
| hard reload, Run log, reopen the run (13 s later) | the same sentence, run still `active` |
| answer Yes (UI radio + Send Answer) | run `completed`, phases intro / approve / wrap all `completed`, `wrap` output "The release was approved." |

Screenshots: `evidence/s3b_active.png`, `evidence/s3b_completed.png`. The sentence shows the owner's email followed by "(you)" because the dev profile has no display name (A-06 as pinned: the email fallback applies only to the owner viewer); it contains no UUID. `step_name` is `null` in the read because the planted phases carry no `name`; the sentence falls back to the prompt's first line, which is what the user sees.

**After the window (30 s workflow), through the UI:** DB `workflow_runs.status` becomes `paused` at 30 s; the run page band reads "Paused for your answer" and the line reads `Still waiting on fhdmrd@gmail.com (you); the run continues as soon as they answer.`; after a hard reload and reopen the same line is present (`evidence/s3_paused_reload.png`). It never says "expired".

**But (finding F-1 and F-3):** in the same screenshot the right-hand panel card reads "EXPIRED ... No response within 0:30 - agent stopped" and offers NO answer control, and answering the paused run through the API (`POST /runs/{id}/ask_user_response`, HTTP 200) leaves the run `active` with the `approve` phase `active` and `wrap` pending, never completing (observed twice, a run left for 17 minutes is still stuck). So S3's "answer, run completes" holds inside the window and does NOT hold after the window. The line's promise "the run continues as soon as they answer" is not true on this box for a paused run.

## SC#10 four-axis scoreboard

Roster derived from `MODEL_CAPABILITIES` (`python -I` over `app.config`, grouped by `provider`; one id per group, newest registry-backed, none inferred). Each row is a **real run** of the same published pause workflow (120 s window) started with a **per-request** `model` + `provider` on `POST /threads/{id}/messages` (no global setting touched), then verdicts read from `workflow_runs` / `workflow_phases` and the run read's `waiting_on`; the pause is answered through `POST /runs/{id}/ask_user_response` inside the window.

| # | Provider | Model id | Result | Evidence |
|---|---|---|---|---|
| 1 | OpenAI | gpt-5.6-sol | PASS | run `completed`, 7 s, run.model gpt-5.6-sol, waiting_on present while paused-in-window and null after, wrap "The release was approved." |
| 2 | Anthropic | claude-opus-5-5 | PASS (re-run 2026-10-24, after billing restored; was **BLOCKED** (billing) on 2026-10-19 with claude-opus-4-8) | workflow run `b985a16c-3695-4429-88c5-9e0f0b582646` (chat run `8e2bb621-b6c7-4f57-849e-29f0de82e641`) `completed`, 4 s, run.model claude-opus-5-5, chat run provider anthropic, waiting_on present while paused-in-window (`Waiting on fhdmrd@gmail.com (you) to answer "Approve the release?".`, `window_passed: false`) and null after, phases intro / approve (answer Yes) / wrap all `completed`, wrap "The release was approved." |
| 3 | Google | gemini-3.5-flash | PASS | `completed`, 8 s, waiting_on present |
| 4 | DeepSeek | deepseek-v4-pro | PASS | `completed`, 4 s, waiting_on present (`strict_json_schema` inert, not exercised here) |
| 5 | Zhipu / GLM | glm-5.2 | PASS | `completed`, 25 s, waiting_on present |
| 6 | MiniMax | MiniMax-M3 | PASS | `completed`, 8 s, waiting_on present; wrap text arrived with two leading newlines (cosmetic, provider formatting) |
| 7 | Moonshot / Kimi | kimi-k2.6 | PASS | `completed`, 18 s (`emit_tier: coerce`, the weakest guarantee in the roster), waiting_on present |
| 8 | OpenRouter | z-ai/glm-5.2 | PASS | `completed`, 15 s (non-native tool path), waiting_on present |
| M | Multi-tool | deepseek-v4-pro, one prompt | PASS | the same assistant turn made `search_documents` AND `execute_code` calls (read from the message `tool_calls`) and answered both; the run-status read for that row returned no row, so completion is judged from the transcript, not from `runs.status` |
| P | Parallel thread | deepseek-v4-pro | PASS | thread A paused on its prompt (`active`, waiting_on for A's run only); thread B took a prompt meanwhile and replied "pong"; B's thread has no `ask_user_prompt`; A's waiting_on sentence unchanged after B finished and A completed when answered |
| L | Long message | deepseek-v4-pro, 5,853-byte kickoff prompt | PASS | run reached the pause, waiting_on prompt_line "Approve the release?" (not the long input), completed when answered |

What this roster does and does not prove: every provider ran the workflow's two non-pause steps and the pause-in-window path; none was driven through the paused-after-window path (that path fails for the same reason on any provider, F-3). Blocked row 2 is recorded with its reason and is not dropped. No row was silently omitted.

**2026-10-24, row 2 re-run after Anthropic billing was restored: PASS.** Model re-derived from `MODEL_CAPABILITIES` + `model_capabilities_overrides` (`scripts/run-292-board.py --roster`): the newest registry-backed Anthropic id is now `claude-opus-5-5` (overlay row, native tools), so the row ran on that id rather than the 2026-10-19 `claude-opus-4-8`. The original plant had been deleted at cleanup, so the same shape was re-planted through `POST /workflows` (`intro` llm_single -> `approve` llm_human_input, prompt "Approve the release?", options Yes/No, 120 s window -> `wrap` llm_single) and published through `POST /workflows/{id}/publish` (the judge blocked attempt 1 and passed attempt 2, the same F-2 pattern; the passing verdict carried the `auto_answered` note for `approve`). The run was started with a per-request `model` + `provider` on `POST /threads/{id}/messages` (auth and org exactly as `scripts/run-273-board.py`), answered Yes through `POST /runs/{id}/ask_user_response` inside the window, and verdicts read from `workflow_runs` / `workflow_phases` / `runs` and the run read's `waiting_on`. Like every other row, only the pause-in-window path was driven, not the paused-after-window path (F-3). Cleanup: the definition was removed with `DELETE /workflows/{id}/cascade` (its two golden runs and the roster run went with it), the three threads (two golden-run threads, one roster thread) with `DELETE /threads/{id}`, and the 33 `harness_audit` rows for those six run ids through the local DB; afterwards `workflow_definitions`, `workflow_runs`, `threads`, `workflow_phases`, `messages`, `harness_audit` and `runs` all read the same counts as the snapshot taken before planting. One `operator_audit_log` row (`workflow.delete`, the cascade's own record of the deletion) was left in place.

## Cleanup

Row ids were snapshotted before the first drive (`workflow_definitions` 315, `workflow_runs` 287, `threads` 1241, `workflow_phases` 696, `messages` 3151, `harness_audit` 3371) and diffed afterwards: every new row belonged to this drive (names `S288...`, `ALPHA/BRAVO-NAME...`, `[S288 roster]`, `[validation] publish golden run`). They were deleted in dependency order through the local service role (also the 34 chat `runs` rows tied to those threads), and a second diff read **0 new, 0 missing** for all six tables. The base worktree backend on :8001 was stopped; :8000 untouched.
