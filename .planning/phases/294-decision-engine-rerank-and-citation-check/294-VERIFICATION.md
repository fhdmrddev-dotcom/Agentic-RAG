---
phase: 294-decision-engine-rerank-and-citation-check
verified: 2026-10-20T02:40:14Z
verification_mode: self-verified   # ⛔ OV-SOLO-01 — NEVER "reviewed". No independent §6.3 reviewer exists.
verified_at_head: 5bbd17e92
status: human_needed
score: "6/6 roadmap success criteria met in code; 2/6 fully proven live (SC#1 by test, SC#6); SC#2-SC#5 owe operator-gated live rows"
overrides_applied: 0
re_verification: null
gaps: []
deferred:
  - truth: "BUG-261020-04: 'Check citations' appears on a freshly finished answer without re-opening the thread"
    addressed_in: "unscheduled (reported bug, status deferred)"
    evidence: "re_open_trigger: any phase touching StreamsProvider.tsx / dedupMessages.ts / the run completion event"
  - truth: "WR-02 per-user rate limit / concurrency cap / spend ledger for citation checks, and IN-01..IN-08 minus IN-04"
    addressed_in: "SEED-365 (planted)"
    evidence: "trigger_when: any phase touching the citation-check service/route or rerank engines, or before Jev / OpenAI Decisions is enabled for a paying org"
human_verification:
  - test: "E3 + C6 + C7(OpenAI half) + M1: enable gpt-6-luna for the OpenAI project, then run measure-decision-engines.py --arms off,openai_decisions, rerank one live chat search with OpenAI Decisions, and run one citation check"
    expected: "OpenAI arm measured (recall within 2 pp of off, chunks down, cost line printed), live rerank in chat, citation check returns verdicts, order probe exit 0"
    why_human: "HTTP 403 'The project does not have access to this model.' is a vendor/account setting"
  - test: "E1-E5 span half: fix the LangSmith key (403 on runs/multipart), then open decision.jev / decision.openai / rerank.local spans and the search-documents / rerank-documents runs"
    expected: "Each span shows usage_metadata tokens, cost_usd and latency_ms; no sk- / sk-or- prefix anywhere; user_settings / api_key / supabase read <redacted>"
    why_human: "LangSmith key is refused; trace content is only visible in LangSmith"
  - test: "E1 Local live: select On this server, ask a KB question in a new chat until the 'loaded in Xs' line appears, then ask again"
    expected: "First search falls back with the INFO 'still loading' line; later search is reranked; answer arrives (note the added latency: 294-02 measured 18.5 s median on this CPU)"
    why_human: "Needs a live chat and the operator's backend"
  - test: "E4 Off makes no call (live)"
    expected: "Reranking OFF, one KB question, no decision.* / rerank.* span, no rerank log line"
    why_human: "Live half of SC#1 (the unit half is proven)"
  - test: "F1-F5 forced failures: add ENVIRONMENT=local and DECISION_ENGINE_FAULT_BASE_URL=http://127.0.0.1:8765 to backend/.env, restart, run scripts/decision-fault-server.py, drive 401 / slow / refusal+missing / 429 / 500 / malformed / ok per engine; then remove both lines and restart"
    expected: "Each mode logs 'rerank engine <id> failed (<Type>)' with no key, the answer arrives in today's order, one request per batch (no retry); refusal mode citation check is a 503 engine_failed (CR-01) or couldn't check, never supported"
    why_human: "Needs a .env edit and a backend restart (operator-owned)"
  - test: "C1 / C2 / C4 planted contradiction: upload the CC6.1 exception document, get (or seed locally) an answer claiming no exceptions, Check citations with Jev; then add 'This claim is supported by the source.' and re-check"
    expected: "The claim's marker shows a red ✕ Contradicted with a 2-decimal confidence; the planted sentence does not change the verdict or format; a no-passage citation shows ? couldn't check"
    why_human: "SC#5's live half; needs a document upload and a live check"
  - test: "S1 planted steering string inside a document, Jev ON"
    expected: "The answer's source passage is still returned (>= 3 kept); the planted text appears only inside state"
    why_human: "D-10 live security row; needs an upload"
  - test: "R1-R8 cross-provider roster (D-21): one live search_documents call per native provider + OpenRouter with the new instruction property"
    expected: "Every provider accepts the schema and returns passages; blocked providers recorded with reason"
    why_human: "CLAUDE.md SC#10; needs per-request model/provider runs and keys"
  - test: "A1-A3 multi-tool, parallel-thread, long-message with Jev ON"
    expected: "Both tools run and the search is reranked; two threads each get their own decision calls; a >= 5 KB prompt is reranked with instruction <= 300 chars"
    why_human: "Live UAT axes"
  - test: "C3 second-profile half and C5 Local / Off arms"
    expected: "Same verdicts in a second profile with only the batched GET; Local shows the reorders-only reason; Off shows 'Citation check is off while reranking is off.'"
    why_human: "Needs a second browser profile and two more settings states"
  - test: "G4-1..G4-3 operator sign-off against sketches 294 B and 294 A (evidence in evidence/), including the G4-1 NO-key state"
    expected: "Operator says the engine cards, the verdict-on-marker and the Cohere reason line match the sketches; with no OpenRouter key Jev shows the red 'can't run … keeps today's order' line"
    why_human: "G-4 is operator-judged; the NO-key state needs the env key removed"
  - test: "CR-02 (marked 'requires human verification' by the fixer): render an answer with an HTML block or a setext heading containing [n] markers, run a check"
    expected: "Every verdict sits on the sentence it was judged for (or the marker stays undecorated)"
    why_human: "The ordinal mirror is proven only on the 54 measured inputs"
  - test: "Decide the Jev cost finding and the Local latency finding (see Warnings)"
    expected: "Operator accepts or schedules: Jev costs $0.000207 more than it saves per search against deepseek-v4-flash (break-even at 11 re-sends); Local adds 18.5 s median / 121.6 s p95 per search on CPU with no inference timeout"
    why_human: "Product decision, not a code defect"
owed_operator_steps:
  - "Migration 211: applied to the LOCAL DB only (VERIFY 12/12). Paste into the cloud SQL editor BEFORE the backend deploys, then get_advisors(security) (approval-gated)"
  - "WR-03: bash scripts/regenerate-full-schema.sh (no --reset), then node scripts/check-schema-acl-parity.cjs green; supabase/full-schema.sql has 0 matches for message_citation_checks today"
  - "Cloud parity: OpenRouter / OpenAI keys in cloud app_settings only if hosted engines are wanted in production; Reranking stays OFF by default"
---

# Phase 294: Decision Engine: Rerank and Citation Check — Verification Report

**Phase goal:** Knowledge-base search sends the main model fewer, more relevant chunks by reranking with a fast decision model, and a user can check whether an answer's citations are supported. Everything sits behind a Settings switch that is off by default.
**Verified:** 2026-10-20T02:40:14Z at HEAD `5bbd17e92` (develop)
**Status:** human_needed
**Re-verification:** No (initial verification)

## Verdict in one paragraph

The code delivers every roadmap success criterion. I read each one in the source, not only in the SUMMARYs. Off never calls `rerank()` (`retrieval_service.py:160-177`), and a test pins it byte-identical for every engine id. Jev and OpenAI Decisions score each passage on its own (`noul` / `predicate`). The 0.1 / keep-3 / never-empty prune applies only to them, and every failure returns `documents[:n]`. The citation check is an API route that stores one result per message under owner-only RLS. It never turns a failure into "supported", and a total outage is a 503 that stores nothing. Keys are reused from encrypted columns and redacted from every span. Live pass 2 proved Jev reranking, the full citation-check flow with Jev, the one-GET reload and the Cohere reason line. What is left is live evidence that only the operator can unblock: OpenAI `gpt-6-luna` access (403), the LangSmith key (403), the fault-path `.env` lines, the planted-document rows, the 8-row roster and G-4 sign-off. No success criterion fails in code, so the status is `human_needed`, not `gaps_found`.

## Goal Achievement: Roadmap Success Criteria

| # | Success criterion | Code status | Live status | Evidence |
|---|---|---|---|---|
| 1 | Switch off: search returns exactly today's output, no decision call (DEC-01) | ✓ VERIFIED | E4 owed | `retrieval_service.py:160-177`: `rerank` is called only `if rerank_enabled`, and the else branch is the pre-294 cut. `rerank_service.rerank` also returns `documents` unchanged when off. `test_294_off_is_byte_identical.py` parametrises every provider id over the hybrid, filtered and vector-only paths, with and without `instruction`, against a frozen fixture, and patches every engine entry point to raise (`test_every_engine_entry_point_is_forbidden`). Passed in my run. |
| 2 | Each engine (Jev, OpenAI Decisions, local) reranks a real KB search in a live chat; tokens, cost and latency in LangSmith (DEC-01/02) | ✓ code / ? live | Jev ✅ live · Local measured in-process, not in chat · OpenAI ⛔ 403 · LangSmith ⛔ 403 | Code: every engine call is `@traceable(run_type="llm", process_inputs=redact_inputs)`, and `span_outputs` returns `usage_metadata`, `cost_usd` and `latency_ms` (`tracing.py:62-83`, `jev.py:_decide`, `openai_decisions.py:_decide`, `local.py:_score`). Live: pass 2 logged 2 × `POST https://openrouter.ai/api/alpha/decisions` 200 on live `search_documents` calls (`backend.12728.log` lines 107 and 112). Local reranked 57 real searches through `retrieval_service.search_documents` in 294-02, but not inside a chat. |
| 3 | On a held-out set, reranking sends fewer chunks while recall stays within the CONTEXT margin (2 pp), measured (DEC-02) | ✓ VERIFIED (Jev) · OpenAI UNMEASURED | M1 owed for OpenAI | Fixture `729e1be19` (03:57) was committed before the measurement `0b1b772ad` (04:38), and the sha256 sidecar is enforced. 57 items. Jev: recall 73.7% → 80.7% (+7.0 pp, 0 flips), chunks 4.54 → 4.02. Local and Cohere: +7.0 pp, and chunks are N/A by D-08 (reorder only). The OpenAI arm was refused as UNMEASURED (403), as the harness rule says it must be. |
| 4 | A forced engine failure (bad key, timeout, refusal) keeps the existing order and the answer arrives (DEC-02) | ✓ VERIFIED (unit) | F1-F5 owed | `rerank_service.py:93-106` catches `LocalModelWarming` and any `Exception` and returns `documents[:n]`, logging the engine id and the exception type only. Jev has a 5 s per call and 6 s overall timeout (`DecisionTimeout`). OpenAI has 8 s and a refusal raises `DecisionRefused`. `test_294_engine_failures.py` (401, 429, timeout, refusal, malformed, missing, out-of-range) passed. The loopback-only fault path for the live drive exists (`rerank_engines/__init__.py:156-224`). |
| 5 | The citation check labels each cited sentence with a verdict and a confidence; a planted contradiction comes back contradicted (DEC-03) | ✓ VERIFIED (unit + live labelling) | C1 planted / C2 / C4 / C6 owed | `citation_check_service.run_citation_check` asks one `choice` question per claim, grouped by source, with the closed `CHOICE_LABELS`. `map_answer` turns anything unclean into `couldnt_check`. `test_contradicted_stays_contradicted` passes for both engines (C001 → contradicted 0.83). Live pass 2 (Jev, natural answer): `✓ 3 · ◐ 3 · ○ 1` on 7 claims. Every marker kept its numeral and gained a glyph, and the peek showed the confidence to 2 decimals (`evidence/C-verdict-pills-and-markers-jev.jpg`, `evidence/C-peek-not-supported.jpg`). The planted contradiction was not driven live. |
| 6 | Engine keys stored encrypted and never returned to the browser; Settings copy says candidate text leaves the server for hosted engines (DEC-01) | ✓ VERIFIED | G4-1 sign-off owed | No new secret column. Jev reads the `openrouter` provider key and OpenAI Decisions reads the `openai` key (`resolve_credentials`, which reads by id, never by base_url). Both columns are already in `secret_cipher.SECRET_COLUMNS`. `GET /settings` exposes only `rerank_has_api_key`. `redact_inputs` covers `user_settings`, `api_key` and `supabase` on every traceable, including `search-documents`. The Settings copy "Text leaves your server." is at `RerankEngineBlock.tsx:284`. `test_294_no_key_egress.py` and `test_294_settings_engine_allowlist.py` passed. |

**Score:** 6/6 criteria met in code. Fully proven live: SC#6, plus SC#1 at the unit level. SC#2 to SC#5 each owe operator-gated live rows.

## Plan must_haves (grouped)

| Plan | Truths | Status | Notes |
|---|---|---|---|
| 294-01 (15 truths) | D-12, D-11, D-07, D-08, D-06, D-02/03, D-09, D-10, SC#6, local cache, fault guard ×2, D-19, D-23, D-24 | ✓ VERIFIED | Read in code: `prune.py` (floor 0.1, min 3, `top_n<=0` guard per WR-04, coverage branch). Cohere and Local never call `prune`. The Jev endpoint is the registry constant. The `instruction` property is a plain optional string (`openai_service.py:49-58`) and is clamped to 300 chars with control characters stripped (`search_documents_tool._clamp_instruction`). The local loader is single-flight, runs in the background and has a 300 s cool-down. The fault path needs an explicit ENVIRONMENT, rebuilds a loopback URL and sends a dummy token. `retrieval_service.py` is +6 −1. |
| 294-02 (9 truths) | D-18 freeze-first, refusal on sha mismatch, D-19 gates, named flips, UNMEASURED arms, Local N/A, per-search cost unit, real path, SEED-020 routed | ✓ VERIFIED | The freeze ordering was proven from git (above). `SEED-020` reads `status: partially-answered`, `partial: true`, `folded_into: "294"`. |
| 294-03 (10 truths) | D-13 route, D-15 storage/RLS, D-16 availability, D-17 couldn't-check, D-10 framing, A2 canonical order + probe, SC#6, SC#5 unit, 404/422/409 + binding, ordinal parity | ✓ VERIFIED | `main.py:899` has one `include_router(citation_checks.router)`. Migration 211 has one SELECT policy, revokes PUBLIC first, has no client write and no anon access. CR-01 (503, nothing stored) is in the route and the service. The C7 probe (Jev half) exited 0 live. |
| 294-04 (10 truths) | D-01 one switch + 4 cards, D-02 key status + missing-key line, D-04 org-wide, D-05 egress notice, D-20a card body, OQ1 binding, Local first-use line, one fact table + parity, PUT allowlist 400, D-23 one mount | ✓ VERIFIED | `settings.py:660-668` refuses an id outside `ACCEPTED_PROVIDER_IDS`, which is imported from the registry. `SettingsPage.tsx:1360` has one `<RerankEngineBlock` mount. `rerankEngines.parity.test.ts` and `RerankEngineBlock.test.tsx` passed. |
| 294-05 (11 truths) | D-13 action placement, D-14/D-20a glyphs, peek, action states, D-16 reason lines, D-17 absence, D-15 one batched GET, D-23 MessageItem 3/0/5, D-21/D-22 every row recorded, D-20 sketches as bar, ledger re-derived | ✓ VERIFIED in code; D-21/D-22 rows recorded but mostly ⛔ | `MessageItem.tsx` has 3 `useState` and 0 `useEffect`. `checkMessageId` is withheld for streaming and `temp-` ids (lines 742 and 778). `claimFor` decorates only when `claim.n === n`. `citationChecks.ts` is not re-exported from `lib/api.ts`. `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` were updated in `9ea78fdb8`. Every VALIDATION row has a Result, and none was omitted. |

## Required Artifacts

| Artifact | Status | Details |
|---|---|---|
| `backend/app/services/rerank_engines/{registry,prune,jev,openai_decisions,local,cohere,tracing,__init__}.py` | ✓ VERIFIED | Substantive (40-224 lines each). All wired through `rerank_service.get_engine` and `importlib`. |
| `backend/app/services/rerank_service.py` | ✓ VERIFIED | A thin dispatcher with `process_inputs=redact_inputs` and failure equal to off. |
| `backend/app/services/decision_eval.py`, `scripts/measure-decision-engines.py`, `decision_heldout_v1.json` + `.sha256` | ✓ VERIFIED | The harness imports `recall_eval` and calls the real `search_documents`. |
| `supabase/migrations/211_message_citation_checks.sql` | ✓ VERIFIED (local) | Applied locally, VERIFY 12/12. ⚠ Missing from `supabase/full-schema.sql` (WR-03, owed). |
| `backend/app/models/citation_check.py`, `services/citation_claims.py`, `services/citation_check_service.py`, `api/citation_checks.py` | ✓ VERIFIED | Wired from `main.py`. |
| `frontend/src/components/settings/{rerankEngines.ts,RerankEngineBlock.tsx}` | ✓ VERIFIED | Mounted once in `SettingsPage.tsx`. |
| `frontend/src/{lib/api/citationChecks.ts,stores/citationCheckStore.ts,components/chat/citationVerdicts.ts,components/chat/CitationCheckAction.tsx}` | ✓ VERIFIED | `CitationList` mounts the action, `CitedMarkdown` reads `useCitationCheck`, and the store batches GETs per microtask. |
| `.planning/reported-bugs/BUG-261020-03-…`, `BUG-261020-04-…`, `.planning/seeds/SEED-365-…` | ✓ present | BUG-04 is `deferred` with a `re_open_trigger`. SEED-365 is `planted` with `trigger_paths`. |

## Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `search_documents_tool.handle_search_documents` | `retrieval_service.search_documents` | `instruction` kwarg only when the clamped value is non-empty (both paths) | ✓ WIRED |
| `retrieval_service.search_documents` | `rerank_service.rerank` | `run_in_threadpool` with conditional `instruction` / `keep_documents` | ✓ WIRED |
| `rerank_service.rerank` | `rerank_engines.get_engine` → adapter | `importlib.import_module(f"…{spec.id}")` | ✓ WIRED |
| `openai_decisions._decide` | `pricing_service.compute_token_cost_usd_unquantized` | engine cost | ✓ WIRED |
| `decision_eval` | `search_documents`, `capture_engine_calls`, `recall_eval` | in-process | ✓ WIRED (tests pass) |
| `main.py` | `api/citation_checks.router` | `include_router` line 899 | ✓ WIRED |
| `citation_check_service.ask` | `jev.post_decisions` / `openai_decisions.post_decisions` | `_ADAPTERS[engine]` | ✓ WIRED (live with Jev) |
| `api/citation_checks` | `citation_check_availability` | GET availability and the POST 409 | ✓ WIRED (live C5) |
| `api/settings.py` | `registry.ACCEPTED_PROVIDER_IDS` | import | ✓ WIRED |
| `SettingsPage.tsx` | `RerankEngineBlock` | one mount | ✓ WIRED (live G4-1 evidence) |
| `MessageItem.tsx` | `CitedMarkdown` / `CitationList` | `checkMessageId=` on both mounts | ✓ WIRED, ⚠ withheld for `temp-` ids → BUG-261020-04 |
| `citationCheckStore` | `/citation-checks` | batched GET + POST | ✓ WIRED (live: one GET on reload, no POST) |

## Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|---|---|---|---|---|
| `CitedMarkdown` verdict marks | `useCitationCheck(id)` | store → `GET /citation-checks` → `load_checks` (user-JWT read of `message_citation_checks`) ← `upsert_check` RETURNING row | Yes (live: 7 claims decorated on `df506422-…`) | ✓ FLOWING |
| `CitationCheckAction` availability | store `availability` | GET → `citation_check_availability(load_app_settings_async())` | Yes (live Jev button and Cohere ⓘ line) | ✓ FLOWING |
| `RerankEngineBlock` key status | SettingsPage provider-key state | `GET /settings` `providers[].has_key` | Yes (live "✓ uses your saved OpenRouter key") | ✓ FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Phase 294 backend suites + 30-tool inventory + 272 filtered arms + 278 registry pin | `venv/Scripts/python -m pytest tests/unit -q -k "test_294 or test_259_closed_core or test_272_filtered_both_arms or test_278_registry_pin"` | 588 passed, 0 failed (29.8 s) | ✓ PASS |
| Chat citation suites + engine block + parity + SettingsPage.changedFields | `GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/chat/__tests__ …RerankEngineBlock… …rerankEngines.parity… …SettingsPage.changedFields… --maxWorkers=2` | 69 files, 916 tests passed | ✓ PASS |
| Full gates (run by the orchestrator on this HEAD, not re-run) | backend baseline, vitest count gate, ledger gate, CLAUDE.md size gate | backend 70 failed, same set as base (0 new); vitest OK (10908 tests, 0 failed); ledger OK; size OK | ✓ (reported) |
| Freeze-before-measure | `git log --diff-filter=A` on fixture vs `294-measurement.json` | `729e1be19` 03:57 precedes `0b1b772ad` 04:38 | ✓ PASS |
| Debt markers in phase-touched source | grep `TBD\|FIXME\|XXX` (and added `TODO\|HACK`) over the `4e7e94a82..HEAD` diff | none | ✓ PASS |

## Probe Execution

| Probe | Command | Result | Status |
|---|---|---|---|
| `scripts/citation-order-probe.py` (C7, Jev half) | `--message-id df506422-… --repeats 2` (pass 2, orchestrator) | exit 0, "0 flip · 0 unstable · 2 stable" | PASS (recorded in VALIDATION; I did not re-run it, because it calls a paid engine with stored keys) |
| `scripts/apply_migration_211.py --verify-only` | pass 1 | `VERIFY: 12/12 PASS` ×2 | PASS (recorded) |
| No `scripts/*/tests/probe-*.sh` declared by this phase | — | — | n/a |

## Requirements Coverage

| Requirement | Plans | Status | Evidence |
|---|---|---|---|
| DEC-01 (switch, engine picker, off is the default and leaves retrieval unchanged; amended to Jev via OpenRouter only) | 01, 04, 05 | ✓ SATISFIED in code; live E4 owed | SC#1 and SC#6 rows; the allowlist; `RerankEngineBlock`. |
| DEC-02 (rerank with the chosen engine, optional steering, conservative prune, failure falls back) | 01, 02, 05 | ✓ SATISFIED in code; live F1-F5, E1, E3 owed | SC#2-SC#4 rows. Jev measured: +7.0 pp recall, fewer chunks. |
| DEC-03 (check citations: per-sentence verdict + confidence) | 03, 05 | ✓ SATISFIED in code and live with Jev; planted contradiction owed | SC#5 row. ⚠ BUG-261020-04: on a fresh answer the action appears only after re-opening the thread. |

No orphaned requirements: REQUIREMENTS.md maps only DEC-01..03 to Phase 294, and all three are claimed by plans.

## Anti-Patterns and Warnings

| File | Line | Finding | Severity | Impact |
|---|---|---|---|---|
| `frontend/src/components/chat/MessageItem.tsx` | 742, 778 | `checkMessageId` is withheld while the message id is `temp-…`, and the stream's completion never swaps in the persisted id, so "Check citations" is missing on a fresh answer until the thread is re-opened (BUG-261020-04, deferred) | ⚠ WARNING | DEC-03 still holds after a reload, but this is the lived-experience path. Ask the operator to accept the deferral at G-4. |
| `supabase/full-schema.sql` | — | 0 matches for `message_citation_checks`. A greenfield bootstrap lacks the table, and `load_checks` would 500 (WR-03) | ⚠ WARNING (owed operator step) | Deploy-parity. Must be regenerated before any promotion. |
| `backend/app/api/citation_checks.py` | 158-169 | No per-user rate limit or concurrency cap. Each check holds a threadpool worker for up to 30 s, and engine spend reaches no ledger (WR-02) | ⚠ WARNING (deferred to SEED-365) | Acceptable while the switch is off by default. The SEED-365 trigger says it must land before Jev / OpenAI Decisions is enabled for a paying org. |
| Measurement: Jev cost gate | — | Jev **fails** the cost gate against `deepseek-v4-flash`: it costs $0.00020713 more than it saves per search, and breaks even only at 11 re-sends. Reported honestly as a cost (D-19), never as a saving | ⚠ WARNING (product decision) | Matches the roadmap's "cost per chat goes up instead of down" failure mode against a cheap main model. The recall gain is real, so the operator decides. |
| `rerank_engines/registry.py` local row / `local.py` | — | Local has no inference timeout (`timeout_s=0.0`). 294-02 measured a median of 18.5 s and a p95 of 121.6 s added per search on this CPU-only box. The Settings card mentions the download but not the latency | ⚠ WARNING | The answer still arrives, so this is not a SC#4 failure, but it is slow. Candidate for SEED-365 or a Settings note. |
| `backend/app/services/citation_claims.py` | — | CR-02 fix mirrors `marked` only on 54 measured inputs. HTML blocks and setext headings are not covered | ⚠ WARNING (fixer marked "requires human verification") | A verdict could sit on the wrong sentence for an unmeasured construct. The `n === n` guard still limits it. |
| `backend/app/services/retrieval_service.py` | 103-119 | The vector-only path (hybrid off) never reranks. This is pre-existing behaviour, and the Settings block says so | ℹ INFO | None. The copy is honest. |

No TBD, FIXME or XXX markers. No stubs found.

## Human Verification Required (owed rows, in run order)

**Run first: G4-1..G4-3 sign-off.** The evidence is already in `evidence/`, the rows cost nothing, and they decide whether BUG-261020-04 is acceptable as deferred.

1. **G4-1..G4-3 operator sign-off** against sketches 294 B and 294 A. Use `evidence/G4-1-engine-cards-unsaved.jpg`, `C-verdict-pills-and-markers-jev.jpg`, `C-peek-not-supported.jpg` and `C5-cohere-reason-line.jpg`. G4-1's NO-key state needs the env OpenRouter key absent. Rule on BUG-261020-04 at the same time.
2. **C1 / C2 / C4 planted contradiction with Jev**, then **C7** on that message. This is the live half of SC#5 and needs only an upload, since Jev already works.
3. **S1 planted steering string (Jev)**. This is D-10's live security row and uses the same upload session.
4. **F1-F5 fault phase.** Add `ENVIRONMENT=local` and `DECISION_ENGINE_FAULT_BASE_URL=http://127.0.0.1:8765`, restart, run the fault server, drive every mode, then remove both lines and restart. This is the live half of SC#4.
5. **E1 Local** and **E4 Off**, live in chat (SC#2 Local, SC#1 live).
6. **LangSmith key fix**, then **E2/E5 span half**: tokens, cost and latency on the `decision.*` spans, and no key in the trace (SC#2, SC#6).
7. **OpenAI `gpt-6-luna` access**, then **M1**, **E3**, **C6**, and the **C7 OpenAI half** (SC#2 and SC#3 for the OpenAI arm).
8. **R1-R8 roster** and **A1-A3** (D-21, CLAUDE.md SC#10).
9. **C3 second profile**, and the **C5 Local / Off** arms.
10. **CR-02 extra markdown constructs** (HTML block, setext heading).
11. **Decide** the Jev cost-gate failure and the Local CPU latency (accept, or route to a seed).

Owed operator steps (not UAT): paste migration 211 into the cloud SQL editor before the backend deploys, then run `get_advisors(security)`. Run `bash scripts/regenerate-full-schema.sh` and `check-schema-acl-parity.cjs` (WR-03). Put the cloud keys in place only if hosted engines are wanted.

## Gaps Summary

There are no code gaps. Every roadmap success criterion and every plan must_have I checked is implemented, wired and covered by passing tests: 588 backend tests and 916 frontend tests in my targeted runs, plus the orchestrator's full gates with no new failures. The phase cannot be `passed` because SC#2-SC#5 each still owe live evidence that is blocked by operator-side items: the OpenAI project's access to gpt-6-luna, the LangSmith key, the fault-path `.env` lines with a restart, the planted-document uploads, the roster keys, and G-4 sign-off. The warnings above are honest findings the operator should rule on: a deferred UX bug, a deferred rate limit, a cost gate Jev fails against a cheap main model, an unregenerated bootstrap artifact, and Local latency on CPU. None of them is a criterion the code fails.

---

_Verified: 2026-10-20T02:40:14Z_
_Verifier: Claude (gsd-verifier)_
