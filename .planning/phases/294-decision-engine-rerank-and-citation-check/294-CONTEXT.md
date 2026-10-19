# Phase 294: Decision Engine: Rerank and Citation Check - Context

**Gathered:** 2026-10-20
**Status:** Ready for planning. ✅ G-2 satisfied 2026-10-20: operator picked **B + A** (see D-20a).
**Mode:** interactive. The operator chose the recommended option on all 16 questions.

<domain>
## Phase Boundary

Three things, all behind one operator-wide Settings switch that is **off by default**:

1. **DEC-01**: the existing Rerank block gets an engine picker (Cohere · Local · Jev · OpenAI Decisions). Off leaves retrieval byte-for-byte as it is today.
2. **DEC-02**: when on, knowledge-base search reranks its candidates with the chosen engine, takes an optional steering instruction from the agent, and prunes conservatively. Any engine failure keeps the current order.
3. **DEC-03**: on a settled cited answer, a user can check its citations and see, on each cited sentence, whether its source supports it fully, partly, not at all, or contradicts it, with a confidence.

Requirements: DEC-01, DEC-02, DEC-03. Out of scope: model routing and chunk tagging at ingestion (REQUIREMENTS.md Future).
</domain>

<measured>
## What is already true (measured 2026-10-20, not assumed)

- **The rerank seam exists and is off by default.** `backend/app/services/rerank_service.py` (122 lines): providers `api`/`cohere` (Cohere v2 over `httpx`) and `local` (sentence-transformers `CrossEncoder`, lazy module singleton). It is `@traceable(name="rerank-documents")` and returns the original order on any exception.
- **One call site.** `retrieval_service.py:158-170`, after RRF fusion, dedup and the top-K cut, via `run_in_threadpool` (SEED-065). The filtered path (D-27 of 272) reranks the full matched set and then re-applies `_cover_matched_documents`; that coverage rule must survive pruning.
- **Settings are operator-wide.** The rerank fields are `app_settings` columns (`010_app_settings.sql`), read through `UserEffectiveSettings` (`user_settings.py:203-207`, `:1118-1122`) and exposed by `api/settings.py:94-98` (the key is returned only as `rerank_has_api_key`) and `:303-307` (`"***"` keeps the key, `""` clears it).
- **`rerank_provider` is plain `text` with no CHECK.** New engine values need **no migration**.
- **Keys are already encrypted.** `rerank_api_key`, `openai_api_key` and `openrouter_api_key` are all in `secret_cipher.SECRET_COLUMNS` (`backend/app/security/secret_cipher.py:50-58`).
- **Citations are checked for structure only.** `citation_markers.py` (177 lines) drops out-of-range `[n]` markers. Nothing checks whether a source supports its sentence. Chat renders citations through `CitedMarkdown`, `CitationList`, `CitationCard` and `CitationPeek` from `MessageItem.tsx:737-766`.
- **The recall harness is honest but small.** `recall_eval.py` (Phase 241) has 10 `EVAL_PROBES` (`:63`) driven through the real path, and it refuses rather than inventing numbers (`RecallUnmeasurable`). On 10 questions one flip moves recall by 10 points.
- **The local model singleton ignores the model name.** `_get_local_model` caches the first model loaded and never reloads, even when `rerank_model` changes. This is the opposite of the roadmap's "reloads on every request" failure, and it is still a defect.
- **Installed:** `sentence-transformers 5.4.1`, `openai 2.28.0` (it may lack `client.decisions`; raw `httpx` is acceptable, as `rerank_service` already uses it).
- **Next free migration: 211** (the last file is `210_starter_workflows_v2.sql`). Re-run `ls supabase/migrations | tail` at plan time.
- **Seeds sweep:** 0 matched (the phase declares no `files_modified` yet). **Todo match:** one keyword-only hit (NL→workflow authoring spike), which belongs to Phase 291 (AUTH-02) and was not folded.
</measured>

<decisions>
## Implementation Decisions

### Settings and keys (DEC-01)

- **D-01 (one block: extend Rerank).** The existing Rerank block gains an engine picker: Cohere · Local · Jev · OpenAI Decisions. The existing `rerank_enabled` switch is the single on/off. There is no second "Decision engine" block. *Why:* one home per concern, and two switches could both be on.
- **D-02 (reuse provider keys).** Jev uses the stored **OpenRouter** key and OpenAI Decisions uses the stored **OpenAI** key. Cohere keeps `rerank_api_key`. No new secret columns. *Why:* those keys are already encrypted and never returned to the browser (SC#6 holds by construction). The Settings block must say which key an engine uses, and that the engine cannot run when that key is missing.
- **D-03 (Jev via OpenRouter only).** ⚠ **This narrows DEC-01**, which says "direct or via OpenRouter". TypeSafe direct is deferred (see `<deferred>`), and REQUIREMENTS.md DEC-01 is amended to match in the same commit as this file. *Why:* one adapter and one live drive; TypeSafe direct would need its own key and adapter.
- **D-04 (operator-wide).** The engine choice stays in `app_settings`, as rerank is today. There is no per-user override. *Why:* sending candidate text to a hosted engine is an organisation decision.
- **D-05 (data-egress notice).** When Jev or OpenAI Decisions is selected, the block states in plain words that candidate passages (and, for the citation check, answer sentences) leave the server for that vendor. Local and off say nothing of the kind. *Why:* SC#6.

### Scoring and pruning (DEC-02)

- **D-06 (per-document probability).** Hosted engines score each passage on its own: Jev `noul`, and OpenAI `score` or `predicate`. Research picks the OpenAI question type and cites the docs. Calls are concurrent, within each vendor's limits (Jev about 30 passages / about 32k tokens per call; OpenAI 1-200 questions per request). The listwise `choice` is **not** used. *Why:* only absolute probabilities can be thresholded (Jev's listwise scores are ranks, a named failure mode), and per-document questions have no option order, so OpenAI's order bias (up to 15 points) cannot apply.
- **D-07 (conservative prune).** Drop a candidate only when its probability is **< 0.1**; always keep **at least 3** (or all, if fewer exist); never more than `top_k`; **never return an empty set**. The filtered path's `_cover_matched_documents` rule still applies after pruning. *Why:* one team that kept about 1.6 of 30 lost 19% of the right evidence; below 0.1 a passage was relevant 0.5% of the time (intake research).
- **D-08 (Cohere and Local stay as today).** For Cohere and Local, D-07's threshold applies only if research shows their scores are calibrated probabilities; otherwise they keep today's `top_n` cut. Research states which, with evidence. *Why:* a 0.1 floor on raw cross-encoder logits means nothing.
- **D-09 (steering = optional tool argument).** `search_documents` gains an optional `instruction` string, which the agent fills when it knows what matters (e.g. "prefer 2025 figures"). It is passed to engines that accept one (Jev, OpenAI). The tool count stays **30** (re-counted with `test_259_closed_core_inventory.py`). The schema stays provider-safe (no `anyOf`, no type arrays; see the Phase 272 comment at `openai_service.py:44-50`). *Why:* the roadmap names it; the agent knows the intent better than a copy of the user's message.
- **D-10 (instruction is untrusted).** The instruction and the passages are data to the engine, never instructions to our system. Text inside a passage or the answer must not change the verdict format or the threshold. A planted steering string inside a document is part of the security review. *Why:* "text in the cited answer steers the checker" is a named failure mode.
- **D-11 (failure keeps the order).** A bad key, timeout, refusal, malformed response or rate limit returns the pre-rerank candidates in their current order, logged by name (never the key), and the chat answer still arrives. Each engine has its own timeout, chosen by research. *Why:* SC#4.
- **D-12 (off is byte-identical).** With the switch off, `search_documents` output equals today's, pinned by a test, and **no** decision client is constructed or called (asserted, not inferred). *Why:* SC#1.

### Citation check (DEC-03)

- **D-13 (on demand).** A "Check citations" action appears on a **settled** assistant message that has citations. It is an **API route, not a tool** (the tool count stays 30). It never runs automatically. *Why:* zero cost until pressed, in line with off by default.
- **D-14 (verdict on the sentence).** Each cited sentence gets a mark (supported fully · partly · not supported · contradicted, plus a confidence), opened by hover or tap. The exact look is decided at the G-2 sketch (D-20). *Why:* SC#5 says "labels each cited sentence"; one source can back several sentences with different verdicts.
- **D-15 (saved once).** The result is stored per message, so a reload or another device shows it without paying again. Storage is owner-only under RLS. Research picks a new table or a column on `messages` (likely **migration 211**; re-run `ls` first). A re-check is allowed and replaces the stored result. *Why:* pay once.
- **D-16 (hosted engines only).** The check runs on Jev or OpenAI Decisions (a choice or predicate question per sentence-source pair, with `refusal` allowed). When Cohere or Local is selected, or the switch is off, the action is hidden and a one-line reason is shown where it would be. There is no fallback to the chat model. *Why:* a reranker scores relevance, not support or contradiction; a chat-model fallback breaks the fast-decision premise.
- **D-17 (a refusal is "can't tell", not a verdict).** An engine refusal or a missing source shows as "couldn't check", never as "supported". A planted contradicting citation must come back **contradicted** (SC#5). *Why:* absence must render as absence (289 D-09 precedent).

### Measurement (SC#2, SC#3)

- **D-18 (held-out set of 50 or more, frozen first).** It holds the 10 existing `EVAL_PROBES` plus questions written from real chunks (each target = its source chunk), committed to a file **before** the 0.1 threshold or any engine is measured. The harness extends `recall_eval.py`'s Layer 2 and keeps its refusal rule. *Why:* at 50 questions, 2 points = 1 question; freezing first stops the threshold being tuned to the test.
- **D-19 (the gates, per engine, on that set).**
  - Recall of the right passage stays within **2 percentage points** of rerank-off.
  - The number of chunks sent to the main model goes **down**.
  - **Cost is gated:** main-model input tokens saved versus engine cost, per chat. An engine that costs more than it saves is reported as that number and never called a saving.
  - Every engine call's tokens, cost and latency appear in **LangSmith** (extend the existing `@traceable`).

  *Why:* SC#3, plus the named failures "dropped the answer" and "cost went up".

### Process and guardrails

- **D-20 (G-2 sketch before plan).** `/gsd:sketch` of (a) the extended Rerank block with the engine picker, key source and egress notice, and (b) the citation-check action and per-sentence verdict mark runs **before** `/gsd:plan-phase 294`. The operator's pick is the acceptance bar. Load `sketch-findings-agentic-rag` (Settings model-picker, ConfidenceChip and citation contracts) first.
- **D-20a (sketch winners, operator 2026-10-20; these are the acceptance bar).**
  - `.planning/sketches/294-rerank-engine-block/` **B, engine cards.** Under the existing Enabled toggle, four radio cards in a 2×2 grid (On this server · Jev via OpenRouter · OpenAI Decisions · Cohere). Each card shows: name, a where-it-runs tag (● stays on your server / ↗ hosted · vendor), model id, key status (✓ uses your saved OpenRouter/OpenAI key, or ✕ missing), list price, and "cuts below 0.1 / reorders only · steering ✓/— · citation check ✓/—". Below the grid: "Keep at most N passages per search", then the red missing-key line ("can't run … search keeps today's order") when it applies, then the amber egress notice for hosted engines. Save says "Saved for the whole organisation". Engine facts come from one exported table (024 rule: preset data never hardcoded in component logic); prices and capability flags are re-verified at research (D-24). With the switch off, the cards are hidden and one line says no engine is called.
  - `.planning/sketches/294-citation-check/` **A, the marker carries the verdict.** The existing superscript `[n]` chip (074 A) gains a verdict glyph and the verdict's colour after a check: ✓ supported (green) · ◐ partly (amber) · ○ not supported (muted) · ✕ contradicted (red + ring) · ? couldn't check (dashed, dim). Hover peeks and click pins (075): verdict word, confidence (raw, 2 decimals), source `[n] file · chunk`, the quoted passage and a one-line reason. The action sits in the References footer header: "Check citations · Jev" → "Checking N citations…" → per-verdict count pills + Re-check, with a "checked by <engine> · saved with this answer · <time>" line. With Cohere/Local or the switch off, the header shows an ⓘ reason instead of the button. Unchecked markers stay exactly as today.
- **D-21 (full 8-row roster).** The `instruction` argument changes the `search_documents` schema, so CLAUDE.md SC#10 applies: one live `search_documents` call per native provider plus OpenRouter, derived from `MODEL_CAPABILITIES`. Rows are blocked with a reason (e.g. Anthropic billing), never omitted. The other three axes (multi-tool, parallel-thread, long-message) are authored in VALIDATION.md.
- **D-22 (every engine driven live).** Jev, OpenAI Decisions and Local each rerank a real knowledge-base search in a live chat (SC#2). Each forced failure in D-11 is driven at least once. "Only one engine was driven" is a named failure.
- **D-23 (G-5 hot files).** `retrieval_service.py` (G-5 discharged in 272-01; keep its touch to the rerank call), `config.py`, `user_settings.py`, `api/settings.py`, `SettingsPage.tsx`, `MessageItem.tsx`, `openai_service.py` (tool schema). Read each file's section in `docs/HOT-FILE-LEDGER.md` before planning. The engine logic goes in `rerank_service.py` or a sibling module, never into the hot files. Run `node scripts/check-hot-file-ledger.cjs` on the plans.
- **D-24 (provider-docs-first).** Before any adapter is written, research reads the current OpenRouter Jev docs (`/api/alpha/decisions`) and OpenAI Decisions docs (`POST /v1/decisions`, `gpt-6-luna`), and re-verifies every figure in the intake research: prices, limits, question types, refusal shape, beta status.

### Claude's Discretion

- The OpenAI question type per use (`score` vs `predicate` for rerank; `choice` vs `predicate` for the citation check), after reading the docs.
- Concurrency and batch sizes per engine, and per-engine timeouts.
- The citation-check storage shape (new table vs `messages` column), and the exact verdict and confidence wire format.
- How the 40-plus chunk-derived questions are generated, as long as D-18's freeze-first rule holds and generation never sees the engines' outputs.
- Fixing the local-model singleton so it reloads only when `rerank_model` changes (load once per model, never per request).
- How the `instruction` argument is described to the agent in the tool schema.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope and intake
- `.planning/ROADMAP.md` § "Phase 294: Decision Engine: Rerank and Citation Check": SC#1-6, failure modes, flags
- `.planning/REQUIREMENTS.md`: DEC-01..03 (DEC-01 amended by D-03) and the Future section (model routing, chunk tagging)
- `.planning/phases/294-decision-engine-rerank-and-citation-check/294-INTAKE-RESEARCH.md`: engine table, findings 1-5, sources (re-verify at research)

### Rerank and retrieval
- `backend/app/services/rerank_service.py`: the seam to extend
- `backend/app/services/retrieval_service.py:85-176`: the call site, the filtered-coverage rule (D-27) and the low-similarity carry (D-10)
- `backend/app/services/recall_eval.py`: Layer 2 harness and `EVAL_PROBES`, plus the refusal rule
- `backend/app/services/openai_service.py:24-80`: the `search_documents` schema and its provider-safe constraints
- `backend/app/services/tool_dispatcher.py:108` and `backend/app/services/tools/`: the search handler path

### Settings and secrets
- `backend/app/config.py:1238-1243`: rerank defaults
- `backend/app/models/user_settings.py:203-207, 600-650, 1040-1080, 1118-1122`: effective settings, encrypt-on-write, decrypt-on-read
- `backend/app/api/settings.py:94-98, 303-307, 398-402, 655-665`: wire shape, key sentinel
- `backend/app/security/secret_cipher.py:50-62`: `SECRET_COLUMNS`
- `frontend/src/pages/SettingsPage.tsx`, `frontend/src/components/settings/ProviderPicker.tsx`: the existing Rerank UI

### Citations
- `backend/app/services/citation_markers.py`: structural marker validation (unchanged by this phase)
- `frontend/src/components/chat/MessageItem.tsx:737-766`, `CitedMarkdown.tsx`, `CitationList.tsx`, `CitationCard.tsx`, `CitationPeek.tsx`: where the verdict mark attaches

### Guardrails
- `CLAUDE.md` § UAT scoreboard recipe (8-row roster), § Workflow guardrails (G-2, G-4, G-5, G-8), § Provider-docs-first
- `docs/HOT-FILE-LEDGER.md`: sections for every file in D-23
- `docs/EXTENSION-CONTRACT.md`: no new tool, phase type or emitter
- `backend/tests/unit/test_259_closed_core_inventory.py`: the 7 / 1 / 30 recount
- Skill `sketch-findings-agentic-rag`: Settings provider-picker, ConfidenceChip, citation surfaces

### External (re-verify; vendor claims)
- https://openrouter.ai/blog/insights/what-is-jev/ · https://github.com/hev/jev-rerank · https://hindsight.vectorize.io/blog/2026/09/24/adding-jev-reranker-what-we-learned
- https://developers.openai.com/api/docs/guides/decisions · https://community.openai.com/t/results-from-toy-experiments-with-decisions-api/1404010
- https://huggingface.co/BAAI/bge-reranker-v2-m3 (Apache-2.0)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `rerank_service.rerank()`: the dispatch on `rerank_provider` plus fallback-on-exception is exactly the shape for two more engines.
- `_get_local_model` + `CrossEncoder`: bge-reranker-v2-m3 loads with it unchanged (set `rerank_model`).
- `secret_cipher` + `save_app_settings`: encrypt-on-write and the `"***"` sentinel already cover the reused keys.
- `recall_eval.py` Layer 2: the real-path probe driver to extend for D-18.
- The ConfidenceChip vocabulary (Phase 112 / 289 TRUST-01): a candidate for the verdict confidence display (sketch decides).

### Established Patterns
- Blocking I/O in async paths goes through `run_in_threadpool` (D-v2.5-01, SEED-065). Concurrent per-document engine calls must not block the loop.
- Raw SDK / `httpx` only, with no LangChain. Pydantic for structured engine responses.
- Fail open to the current order (rerank) and fail as "couldn't check" (citations), never as a fabricated pass.
- Tool schemas stay provider-safe (Phase 115 / 272 constraints).

### Integration Points
- `retrieval_service.search_documents` → `rerank()` (adds the `instruction` passthrough).
- The `search_documents` tool handler → `retrieval_service` (carries `instruction` from tool args).
- New citation-check route under `backend/app/api/` (org/owner-scoped) → engine adapter → storage (migration 211 if a table).
- The Rerank block in `SettingsPage.tsx` / `ProviderPicker.tsx` → the engine picker plus the egress notice.
- `MessageItem.tsx` cited branch → one mount for the check action and the sentence marks (G-5: one mount or prop).

</code_context>

<specifics>
## Specific Ideas

- The origin is an operator-shared demo of an Agentic RAG app using Jev as a "System One" decision model (steerable rerank, citation check, model routing). Only the first two are in this phase.
- Verdict words, fixed: **supported**, **partly supported**, **not supported**, **contradicted**, plus **couldn't check** for refusals and failures.

</specifics>

<deferred>
## Deferred Ideas

- **Jev via TypeSafe direct**: own key, own adapter, second live drive. Re-open if OpenRouter pricing or limits make it worth it.
- **Decision-engine model routing** (simple turns to a cheaper model): REQUIREMENTS.md Future; after DEC-02 is measured; needs the full roster (SEED-362 touches the same per-request model path).
- **Chunk tagging at ingestion** (table of contents, footer, signature, personal data) through `ingest_splice.py`: REQUIREMENTS.md Future.
- **Automatic citation check on every answer**: rejected for this phase on cost; re-open if on-demand usage shows people check most answers.
- **Qwen3-Reranker locally** (takes the steering instruction): needs its own loader; re-open if local steering is asked for.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` (NL→workflow authoring): matched on generic keywords only; it belongs to Phase 291 (AUTH-02).

</deferred>

<failure>
## How we'd know this failed

- Pruning drops the passage that held the answer: held-out recall falls by more than 2 points, or any question goes from found to absent without the report naming it.
- "Off" still constructs a client, makes a call, or changes order or content.
- Cost per chat goes up for an engine and is reported as a saving.
- A probability threshold is applied to rank scores or to uncalibrated logits.
- Text inside a passage, the instruction or the cited answer changes a verdict or the output format.
- A refusal or failure renders as "supported".
- The local model reloads per request, or never reloads after `rerank_model` changes.
- Only one engine, or fewer than 8 roster rows, was driven, and the gap is not written down.
- An engine key reaches the browser, a log line, or a LangSmith trace.

</failure>

---

*Phase: 294-decision-engine-rerank-and-citation-check*
*Context gathered: 2026-10-20*
