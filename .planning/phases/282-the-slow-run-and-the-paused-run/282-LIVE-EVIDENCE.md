---
phase: 282-the-slow-run-and-the-paused-run
plan: 03
type: live-evidence
status: driven
created: 2026-10-15
merged_sha: 3c9bb11ab
---

# Phase 282 — Live evidence

Rows are defined in `282-VALIDATION.md` (authored before the drives). Every row below is filled with
pasted DOM / DB reads and run ids, or marked ⛔ / OWED with a reason — none is left blank at close.
No tokens, keys or document content are written here (T-282-15): run ids, counts, option names and
rendered sentences only.

## Merged-tree gates (Task 1, at `3c9bb11ab`, ledger commit `f3846d354`)

Recorded here so the continuation agent that writes `282-03-SUMMARY.md` has the verdict lines on disk.
Evidence files: `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-282/` (`*_03*`).

- **Backend unit baseline** (`baseline_merged_03.log`, under the local-DB lock): `71 failed, 7508 passed, 1 skipped, 2 xfailed, 2 xpassed` · `Errors: 0` · `[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0)`. Failing SET vs `base_failed_d1ba70553.txt`: identical (71 = 71). The only `comm -3` line is the known log artifact — `test_sql_service.py::TestQueryDocumentsOutput::test_returns_json_for_large_results` with a RuntimeWarning glued onto the line (the same id is in the base set).
- **Root/integration set** (`root_merged_03.txt`): `12 failed, 44 passed` — the same 12 failure names as 282-01's HEAD run and as base (11 integration tests in `root_base_d1ba70553.txt` + the base-measured `test_196::test_emit_tier_joined_the_patch_allowlist`). `comm -3` on failure names: empty.
- **test_282_*** (4 files): `63 passed`.
- **Closed core** (`test_255_extension_contract_guard.py` + `test_259_closed_core_inventory.py`): `13 passed` — 7 phase types / 1 emitter / 30 tools unchanged.
- **Vitest count gate** (one run, repo root, `GSD_VITEST_MAX_WORKERS=2`; report `vitest_gate_282-03.report.json`): `count gate OK — 436/436 pinned files present, no per-file decrease, 0 failing` · `total 10300 · failed 0`. `WorkflowBuilderPage.canvas.test.tsx` 154/154 passed this run — the 282-02 load-timing red did not recur (one green sample; not proof the flake is gone). `ModelRegistryTab.test.tsx` measured **33** → pin raised 29 → 33 in `f3846d354`; re-gated against the same report: OK, pinned total 9431.
- **tsc** (`npx tsc -p tsconfig.app.json --noEmit`, `tsc_merged_03.txt`): 103 lines; `comm -13` against each base file (`tsc_base_d1ba70553_01.txt`, `_02.txt`, sorted, duplicates kept) prints nothing. ⚠ A `sort -u` union of the two base files collapses duplicate continuation lines and falsely shows 11 "new" lines — compare as multisets.
- **Migrations:** `ls supabase/migrations | tail -1` → `206_retention_hold_hardening.sql` (none added).
- **Ledger gates:** `check-claude-md-size.cjs` exit 0 (92,607 chars); `check-hot-file-ledger.cjs 282` exit 0 (542 rows, 20 watched); `grep -c "provider_gateway/google.py" CLAUDE.md` = 1.
- **Seeds sweep** (`seeds_282-03.txt`): `seeds register gate OK — 361/361 parsed`; 37 `[trigger-fires]` path matches. Routing: SEED-172 → Task 3 on evidence (not path-matched by the sweep; folded by CONTEXT); SEED-289 → stays `deferred` per CONTEXT; every other match (SEED-027, 040, 052, 053, 054, 079, 177, 185, 188, 192, 194, 198, 249, 273, 280, 284, 287, 288, 291, 299, 300, 301, 303, 304, 308, 310, 314, 319, 323, 324, 327, 328, 334, 339, 346, 350) left unmodified — "path match only; 282 changed no subject of this seed". SEED-308 (Registry fields not read at runtime) names `max_tools` / `reasoning_off`, not the timeout; SEED-327 (forced_emit `system_prompt` dropped by the OpenAI-compat / Responses adapters) — 282 touched those adapters only to forward `timeout_s`.

## Operator setup (Task 2)

Operator reply, verbatim (relayed by the orchestrator, 2026-10-15):

> `ready: sha=22c409c2c lmstudio=spark-x2.5-4b`

The four blank fields were resolved by the orchestrator, not the operator: **row6 = NO** (no approval
for the reversible write; G4-6 is owed, "write not approved"); **keys = derive by driving** (a key
failure is ⛔ with the measured error); **org = read from the UI before the first drive**; **sandbox =
from the app's own status**.

## Pre-drive proofs

- **Backend sha:** develop HEAD `22c409c2c`; the orchestrator measured backend :8000 `/health` 200 with
  its process (pid 39116) started 2026-10-15 17:28, after the merge, and frontend :5173 200. Re-read by
  the executor: `/health` → `{"status":"ok","redis":"ok","maintenance":false}`.
- **LM Studio :1234** (`/v1/models`): `spark-x2.5-4b`, `nvidia_nvidia-nemotron-nano-9b-v2`,
  `text-embedding-nomic-embed-text-v1.5`. None of the three 900 s models (`openai/gpt-oss-20b`,
  `qwen3.6-35b-a3b-mtp`, `qwen3.5-9b-mtp`) is loaded.
- **Effective timeout of the operator's model** (local reads only): `spark-x2.5-4b` has **no
  `model_capabilities_overrides` row** and is **not in `MODEL_CAPABILITIES`**, so both
  `get_per_call_timeout` and `get_per_call_timeout_async` resolve **300 s** (the unknown-model default,
  `DEFAULT_LLM_CALL_TIMEOUT_SECONDS`). The other loaded chat model, `nvidia_nvidia-nemotron-nano-9b-v2`,
  has a row at **550 s**. ⚠ **Neither loaded model can carry a single call past 600 s**: the run
  would end at 300 s (or 550 s) by design. That bears directly on G4-4.
- **Sandbox:** `Settings().sandbox_enabled` → `True`, read in-process (the app's own settings object;
  the env file itself was not opened). Not yet confirmed from a running endpoint.
- **Workflow-pause candidate:** `workflow_definitions` id `f59d361b-bc73-4f6c-b856-1a499195b59f`, slug
  `fresh-pause-102uat-20a89243`, `status: published`, org `22f9c615-…`; its definition text mentions
  `ask_user` and `approval`. Whether it actually raises a pause on a run is still to be driven.
- **Active org:** read at drive time; see "Drives: done by the orchestrator" below.

### ⛔ Blocker found at resume (2026-10-15)

The executor that resumed Task 3 **has no Chrome MCP tools**. Its tool set is Read / Write / Edit /
Bash / Grep / Glob. That blocks Task 3 in two ways:

1. **G4-1, G4-2, G4-3 and G4-5** need DOM-state reads (`aria-checked`, textarea `value`, the
   `[data-ask-card]` count, `document.activeElement`) in the operator's Chrome. No browser tool means
   no evidence. A screenshot or API substitute is not acceptable evidence under the plan.
2. **The SC#10 board** is driven over HTTP with **the signed-in user's JWT, read from the Chrome
   session** (VALIDATION.md "Method"). Without the browser the executor has no legitimate user token.
   Two alternatives were **not** taken, because each needs explicit operator approval:
   - minting a token with the local Supabase JWT secret (impersonating the user);
   - reading the browser's on-disk session.

No row was driven. Every board and G-4 row below stays pending. No bug or seed was flipped.

## Drives: done by the orchestrator (2026-10-15, 13:44–14:01 UTC)

The blocker above was cleared by having the **orchestrator** run Task 3 itself, because it has the Chrome MCP tools:
- **Environment:** Chrome at 1536 px, on the operator's signed-in session.
- **Auth:** each board POST used the page's own Supabase session token and `X-Org-Id` (the same headers `getAuthHeaders` sends). Neither was written to a file.
- **Active org:** `GET /org/me` → `22f9c615-0eec-440a-8804-ed4784d6f57f`, "fhdmrd@gmail.com's Organization" (org-admin). It is the same org as the workflow candidate.
- **Sandbox:** proven on. Row 1's `execute_code` ran and printed 391.
- **Global settings:** none changed. Every row used a per-request `model` + `provider`.
- **Run reads:** from the local DB (`runs`, read-only). Message reads used `GET /threads/{id}/messages`.

### ⚠ Prompt amendment, and why

- **Pass 1** used the authored pause prompt verbatim. In **5 of 5** native rows that paused, the question **expired after about 60 s**, before it could be answered. The final messages read "You didn't respond in time…" and similar. gpt-5.6-sol's first ask expired at the 300 s default.
- **Cause:** the ask_user schema makes `timeout_seconds` **required** but describes it as "Optional" (`openai_service.py:1135-1137`), so the models picked about 60. Filed as **BUG-261015-03** (major, open, not folded into 282).
- **Pass 2** appended "with timeout_seconds set to 1200" to the prompt. All five paused until they were answered. **The pass-2 rows are the verdict rows.** Pass-1 run ids are kept below.

## SC#10 board (D-16)

| # | Provider | Model | Axis | Thread / run ids | Run status | Final message names Blue | `runs.error` | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | OpenAI | `gpt-5.6-sol` | multi-tool | `c152dd60…` / `448c1be5-b340-48fc-b035-302625d3cfd3` | completed 13:55:50 | "The “invoice” search returned 5 results, Python printed 391, and your preferred colour is Blue." | none | ✅ PASS (first ask expired at 300 s and the model re-asked; the re-ask was answered Blue) |
| 2 | Anthropic | `claude-sonnet-5` | ~~parallel-thread A~~ | `7ccb6589…` / `d512fe97-428c-46de-bfd7-1469e9ade5d9` | failed 13:45:46 | — | `BadRequestError 400 … Your credit balance is too low to access the …` | ⛔ **no credit** (n/a — configuration). Chat showed "Model parameter error…", a mislabel filed as **BUG-261015-04** |
| 3 | Google | `gemini-3.5-flash` | parallel-thread B | `b7dd3900…` / `7122a691-0dd2-4c0a-a3d8-fec17dbd58cc` | completed 13:52:36 | "You selected Blue as your preferred colour." | none | ✅ PASS |
| 4 | DeepSeek | `deepseek-v4-pro` | long-message (5,685 B) | `0a6bceae…` / `c8d77147-8879-4811-8265-61b5095f9731` | completed 13:52:45 | "You chose Blue." | none | ✅ PASS |
| 5 | Zhipu | `glm-5.2` | **parallel-thread A** (moved from row 2) | `8a95fb75…` / `b9b8d4d1-42a4-4394-9a41-c639a6ee25b7` | completed (answered about 13:53) | "You chose Blue." | none | ✅ PASS |
| 6 | MiniMax | `MiniMax-M3` | — | `00e73b13…` / `dc4f88de-989a-4f51-b41c-66193fcd5640` | completed 13:52:21 | "You chose Blue." | none | ✅ PASS |
| 7 | Moonshot | `kimi-k2.6` | — | `e9961bef…` / `2b643199-4b58-492e-9d0b-65b091c49ccc` | completed | "You chose Blue." | none | ✅ PASS |
| 8 | OpenRouter | `z-ai/glm-5.2` | — | `2c39d7a8…` / `8d2c655c-63b7-46d2-9743-0b7edf00dfb4` | failed 13:46:16 | — | `APIStatusError 402 … This request requires more credits, or fewer max_tokens…` | ⛔ **no OpenRouter credit** (n/a — configuration) |

**Score: 6 PASS · 2 ⛔ (billing, not code) · 0 FAIL.** Every ask_user tool call on the passing rows returned `"Blue"`.

- **Multi-tool (row 1):** the tool events were `write_todos`, `search_documents` (done, 5 results), `execute_code` (done, printed 391 = 17×23), `ask_user` ×2 (the first expired at 300 s, the second was answered Blue), then `write_todos`.
- **Parallel-thread (rows 5 + 3):** the axis moved from row 2 to row 5 because row 2 is ⛔.
  - A's ask was raised about 13:49:50 and left unanswered.
  - B was answered at 13:52:26 and **completed at 13:52:36 while A was still pending** (A's run read `streaming`).
  - A was then answered Blue at about 13:53 (its draft was changed from Red plus "because A" to Blue, and the text cleared) and completed with "You chose Blue."
- **Long-message (row 4):** the prompt was **5,685 bytes**, ahead of the pause instruction. Pass 1 was 5,652 B.
- **A1 LangSmith nesting:** not checked in this drive. **A1 is unverified**, and owed.
- **Board-wide:** all 8 rows are listed and none is blank. No global setting changed.
- **Pass-1 run ids (expired asks, kept for the record):**
  - row 3 `1e189703…`
  - row 4 `3b9f1de4…`
  - row 5 `a8222fef…`
  - row 6 `77e9b002…`
  - row 7 `35d45a5e…`
- **Side observation:** in pass 1, the POST for row 3 (Google) took about 24 s, from 13:45:43 to 13:46:07. In pass 2 every POST took 96–155 ms, so it did not recur. It is not filed.

## G-4 rows (D-17)

### G4-1: Deep pause, panel open (sketch 282 variant A). ✅ PASS

Thread `282 board 5 zhipu` (pass 1). DOM reads:
- **Before:** `Send Answer` count **1**, home `panel`. Cards: `[panel]`. `ask-pointer` present in `main`. Pointer draft "No answer yet". Radios `Red:false:ti0`, `Blue:false:ti-1`.
- **The pointer button:** `[data-testid="ask-pointer-go"]` reads "Answer in panel →" and is **32 px** high (UI-SPEC owed item 2, measured).
- **After clicking it:** the active element is `BUTTON role=radio "Red"`, inside `[data-ask-home="panel"]`.
- **After ArrowDown:** the active element is `radio "Blue"`. Radios `Red:false:ti-1`, `Blue:true:ti0`. **Pointer draft "Draft: Blue"**.
- **Not colour-only:** the checked chip's mark contains `[data-testid="ask-radio-dot"]` (a filled 8 px dot). The unchecked chip has an empty ring.

### G4-2: Workflow pause, panel on the rail (BUG-260828-07). ✅ PASS

- **Candidate:** `f59d361b…` (definition read first). Its only phase, `brief`, has a **pre** freshness validator, `max_age_days: 2`, `on_failure: ask_user`.
- **Run:** thread `194a0c34…`, run `f901f8ce-e71c-452e-b2f8-44bd8cd4d433`, on deepseek-v4-pro. It paused with "A validation check on phase 'brief' flagged: freshness:staleness|newest source is 129d old (> 2d). How should the run proceed?" Options: Proceed anyway, Abort.

| State | Send Answer | home | pointer | checked option | textarea |
|---|---|---|---|---|---|
| rail | 1 | chat | no | none | "" |
| rail, after selecting option 2 and typing | 1 | chat | no | **Abort** | **"because"** |
| panel open | 1 | panel | yes, "Draft: Abort" | **Abort** | **"because"** |
| rail again | 1 | chat | no | **Abort** | **"because"** |

Sent Abort at 13:57:39. The run completed with "Phase 1 (brief) validation flagged … aborted by user".
**Once settled:** 0 cards, 0 pointer, 0 Send Answer. That is UI-SPEC owed item 6, observed.

### G4-3: Two threads paused at once. ✅ PASS

Threads A = `282 p2 board 5 zhipu thread A` and B = `282 p2 board 6 minimax`.

| Visit | checked | textarea |
|---|---|---|
| A, after selecting and typing | Red | "because A" |
| B, first visit | none | "" (A's draft was **not** copied) |
| B, after selecting | Blue | "" |
| A, return | **Red** | **"because A"** |
| B, revisit | **Blue** | "" |

### G4-4: Slow local model past 600 s (D-26). ⛔ OWED

- **Reason:** no loaded local model has a timeout above 600 s. The operator loaded `spark-x2.5-4b`, which has no Registry row and so resolves to the 300 s default. The only other loaded chat model is nemotron, at 550 s.
- **Not done, by decision:** loading a 900 s model, or raising Spark's timeout. A Registry write was not approved.
- **The automated half stands as the proof:** `test_282_slow_stub_scaled.py`.
- **Second-thread observation (BUG-261015-02), recorded anyway:**
  - A Spark run on a 12,132 B prompt (`0561d8f1-5b8d-4734-8ebf-56b61b77d17d`) completed at 14:00:52 after 74 s.
  - In its first 20 s, a deepseek thread (`bd0d550e-1d8d-4ebb-bb25-ce9005b3c70e`) posted in **136 ms** and completed in 8 s.
  - 180 `/health` pings in that window: p50 **8 ms**, max **192 ms**, **0** above 500 ms. The baseline maximum was 44 ms.
  - ⚠ The backend runs 2 workers, so this supports the automated measurement rather than replacing it.

### G4-5: Registry refusal on screen (SC#1 live). ✅ PASS

Model Registry, `glm-4.7-flash`:
- **Before:** the DB value is `llm_call_timeout_seconds = 550`, `updated_at 2026-08-18 07:03:28`.
- **While editing:** `[data-testid="timeout-help"]` reads exactly "Between 1 and 1800 seconds. Local models and Google models are tried once. Other cloud providers retry quick failures up to 2 times." The input's `aria-describedby` is `timeout-help-glm-4.7-flash`.
- **After typing 1801 + Enter:** one `role=alert` inside `[data-model-error="glm-4.7-flash"]` reads exactly "Timeout must be between 1 and 1800 seconds, because a longer call would outlast the run watchdog, which ends a run that has been silent for 2400 s. 1801 was not saved." The cell still shows `550s`. The help line is gone once the cell closes, as UI-SPEC owed item 5 requires.
- **After:** the DB still holds **550** with the same `updated_at`. Nothing was stored.

### G4-6: The timeout sentence (optional, needs approval)

**OWED: write not approved** (row6 = NO, 2026-10-15). Not driven. The sentence itself is pinned by `test_282_timeout_bound.py::test_timed_out_error_keeps_prefix_and_names_the_setting`, which is green on the merged tree.

### Evidence-gated flips (done 2026-10-15)

- **BUG-260918-01 → `closed`** (G4-1, G4-2 and G4-3 PASS). `verified_closed_by: "282"`.
- **BUG-261015-02 → `closed`** (`test_282_open_off_loop.py` green, plus the G4-4 second-thread observation). `verified_closed_by: "282"`.
- **BUG-260916-01 stays `folded`** because G4-4 is ⛔ OWED. The automated half is `test_282_slow_stub_scaled.py`. G4-5 passed.
- **SEED-172** stays `partially-answered`. Its status_note now says #2 and #3 (the timeout field) were **answered** by 282, and #4 is open.
- **New, not folded:** BUG-261015-03 (ask_user's required timeout makes models pick about 60 s) and BUG-261015-04 (Anthropic out-of-credit shown as "Model parameter error").

## Plan 282-04 live drive (2026-10-15, 14:29–14:39 UTC, backend restarted on `f173d3a4a`)

- **The backend serves the new code:** in the live `/openapi.json`, `AddModelRequest` has a `llm_call_timeout_seconds` property.
- **D-27, the resolver against the live local DB:**
  - an unregistered id with provider `lmstudio` → **900**;
  - the same id with `openai` → **300**.
- **Found while driving:** the operator had added `spark-x2.5-4b` from the Registry UI at 14:06:38 UTC and set its Timeout to 1200 (`operator_audit_log`: `model.added`, then `model.capability.set`).
  - **A model added from the Registry starts disabled** (D-159-02), and the resolver reads only enabled rows. A Spark send was therefore rerouted to the org default `deepseek-v4-flash`, with the fallback notice. That run (`6502211b…`) was cancelled at once.
  - This is the standing add-lands-disabled rule, not a 282 defect. **Owed to the operator:** enable Spark in the Registry for it to run, at its stored 1200 s.
- **The G-4 row 4 re-drive used `nvidia_nvidia-nemotron-nano-9b-v2`:**
  - Model setup: LM Studio, enabled, stored 1200 s. The operator set that at 14:06:52; it was 550 before.
  - Run `df9cbe53-b471-4b68-b3be-0a5d220fbc59` was **one model call with no tools**. It ran from 14:31:14 to 14:37:10, **356 s**, and **completed**. It reasoned and then declined the task in 440 chars.
  - It passed the old 300 s default without being cut off. **It did not reach 600 s**, so per D-30 **G4-4 stays ⛔ OWED, with a measured maximum of 356 s on the operator's hardware.** Spark (4B) is faster and was not expected to go longer.
- **The Add form, live:**
  - the Timeout field is present;
  - its placeholder reads `300` for openai and **`900` after switching the provider to lmstudio**;
  - the hint reads "s · blank = default".
- **⚠ A defect the live drive found and fixed in this plan:**
  - The field carried native `min=1 max=1800`. Typing 1801 and pressing Add model made the **browser** block the submit with its generic message "Value must be less than or equal to 1800." No request was sent, and the reason (the run watchdog) never appeared.
  - Both attributes were removed. A new vitest case fences that 1801 reaches the server and that its refusal shows in the form's `role=alert` (37/37).
- **The refusal after the fix:**
  - `POST /admin/models` with 1801, sent through the page's session, → **422** with exactly "Timeout must be between 1 and 1800 seconds, because a longer call would outlast the run watchdog, which ends a run that has been silent for 2400 s. 1801 was not saved."
  - **0** `zz-282-04%` rows in the DB afterwards.
  - The click-through re-drive of the fixed form could not run: the Chrome tab's renderer stopped responding to input and screenshots (CDP timeouts). So **the in-form alert is proven by vitest, not by a live click.** That re-drive is owed.

## Operator sign-off

*(pending — Task 4)*
