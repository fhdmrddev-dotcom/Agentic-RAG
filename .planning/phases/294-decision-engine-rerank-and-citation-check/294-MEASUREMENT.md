# Phase 294: decision-engine measurement (SC#3, D-18, D-19)

**Measured:** 2026-10-20, label `294-02`, by `scripts/measure-decision-engines.py` (exit 0). Every number below is copied from `294-measurement.json` in this directory; none was typed from memory.

## What was measured

| Setting | Value |
|---|---|
| Held-out set | `backend/tests/unit/fixtures/decision_heldout_v1.json` |
| Held-out sha256 | `bbbd6bddc437356fa7fd6efc88e299926543fc452beb87f967fb99d917b3d796` (matches the committed sidecar; the harness refuses any other hash) |
| Items | 57: 48 chunk questions + 9 of the 10 `EVAL_PROBES` |
| Unresolved probe | `2026 Q3 board pack.pdf` is not in the local database, so that probe is recorded in the fixture's `unresolved_probes` and not scored |
| Freeze commit | `729e1be19`, committed before the harness (`45f840c1c`) and before any engine ran |
| Search path | the real `retrieval_service.search_documents`, hybrid on, one query vector per question (cached once, the same for every arm) |
| Candidate pool | **20** (`rerank_top_n = hybrid_candidate_count = 20`) |
| Passages kept | **top_k 5** (`retrieval_top_k`) |
| Database | `127.0.0.1:54322/postgres`, dev user `d8a54002-6a29-4b88-b918-cff2aa4a06d5`, read only |
| Embedding model | `text-embedding-3-small` |
| Main model (cost gate) | `deepseek-v4-flash`, input **$0.30 per 1M tokens** (`model_rates`) |
| Tokens | tiktoken `o200k_base` over the returned passages. Exact for current OpenAI models, an approximation for DeepSeek |
| Settings | applied per arm with `model_copy`; `app_settings` was never written |

**The threshold was not tuned.** The D-07 prune (floor 0.1, keep at least 3) was fixed in `rerank_engines/prune.py` by plan 01, before this set was frozen, and nothing was changed after these results were seen (D-18).

**Why the pool is 20.** With the local defaults (pool 5, keep 5) an engine could drop at most 2 passages and could never lift a passage that rerank-off had cut. A pool of 20 gives both effects room to show.

### How to read the cost line

The harness drives single searches, not whole chats, so the cost gate is **per search**. In a real chat the agent runs several searches and re-sends each search's passages on every later step. The saving per chat is therefore *saving per search × searches × re-sends*, while the engine is paid once per search. A positive per-search figure is a floor for the per-chat figure. A negative one is printed with its **break-even re-send count**: the number of times a search's passages must be re-sent in one chat before the engine pays for itself.

### Local and Cohere: chunks and cost are N/A (D-08)

Cohere and Local only reorder and keep today's `top_n` cut. With `top_k` fixed they send exactly as many passages as rerank-off, so their "chunks go down" and cost gates read **N/A (reorders only, D-08)**. This is how the locked decision works, not a missing measurement. Their rows report recall, flips and latency. They do change token counts, because they pick different (here, longer) passages; the figures are in the table.

## Results per engine

| Arm | Status | Recall (found of 57) | vs off | Recall gate (within 2 pp) | Chunks off → arm | Chunks gate | Tokens per search off → arm | Saved per search | Engine cost per search | Cost gate | Cost line | Engine latency p50 / p95 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| off | measured | 73.7% (42) | — | baseline | 4.54 | baseline | 966.2 | — | $0 | baseline | — | 0 / 0 ms |
| local | measured | 80.7% (46) | +7.02 pp | **pass** | 4.54 → 4.54 | N/A (reorders only, D-08) | 966.2 → 1167.6 | — | $0 (runs on this server) | N/A (reorders only, D-08) | sends as many passages as off; it picks longer ones (+201 tokens per search) | **18,499 / 121,620 ms** |
| jev | measured | 80.7% (46) | +7.02 pp | **pass** | 4.54 → 4.02 | **pass** | 966.2 → 891.3 | $0.00002246 | $0.00022959 | **fail** | **costs $0.00020713 more than it saves per search; breaks even if a search's passages are re-sent 11 times in a chat** | 773 / 927 ms |
| openai_decisions | **UNMEASURED** | — | — | — | — | — | — | — | — | — | engine fell back on 3 of 3 searches (stopped after the first 3 of 57 all fell back); reasons: `HTTPStatusError:403`. Vendor text: *"The project does not have access to this model."* (`invalid_request_error`) | — |
| cohere | measured | 80.7% (46) | +7.02 pp | **pass** | 4.54 → 4.54 | N/A (reorders only, D-08) | 966.2 → 1082.9 | — | unpriced (Cohere publishes no per-search price) | N/A (reorders only, D-08) | sends as many passages as off; it picks longer ones (+117 tokens per search) | 830 / 1,658 ms |

Ranked metrics (from `compute_metrics`, imported from `recall_eval`):

| Arm | Hit@1 | Hit@3 | Hit@5 | MRR | Chunk items found | Probe items found |
|---|---|---|---|---|---|---|
| off | 0.5439 | 0.6667 | 0.7368 | 0.6152 | 35 / 48 | 7 / 9 |
| local | 0.5614 | 0.7544 | 0.8070 | 0.6605 | 39 / 48 | 7 / 9 |
| jev | 0.6667 | 0.7895 | 0.8070 | 0.7266 | 39 / 48 | 7 / 9 |
| cohere | 0.5439 | 0.7544 | 0.8070 | 0.6518 | 39 / 48 | 7 / 9 |

### Flips (found with rerank off → absent with the engine)

- **local:** none
- **jev:** none
- **cohere:** none
- **openai_decisions:** not measured

### Gains (absent with rerank off → found with the engine)

All three measured engines found the same four extra targets, each of which sat in the pool of 20 but below rerank-off's top 5:

- `c05` Which vendor's API contract was still unsigned in week 9, and what risk did that create for integration testing?
- `c18` How much royalty income from Amazon.com Services was reported on the 2025 Form 1042-S, and how much federal tax was withheld?
- `c40` What actions does the ABRS presentation list for addressing housing, land and property concerns?
- `c45` What Year 1 budget must senior leadership approve for the PMO, and what is the estimated yearly cost of doing nothing?

### Notes on the numbers

- **Jev's cost.** Jev reads the whole pool of 20 passages to decide which to keep: on average 5,467 input tokens per search at $0.042 per 1M, about $0.00023. It then cuts 0.53 passages per search (75 tokens), which is worth $0.0000225 at DeepSeek's $0.30 per 1M. Against a cheap main model it loses money per search, and it would need its passages re-sent 11 times in one chat to break even. Against a dearer main model the same token cut is worth more (the break-even count falls in proportion to the main model's input price). Jev cut passages on 17 of 57 searches (13 went from 5 to 3, 4 went from 5 to 4: 30 passages in all).
- **Local's latency.** On this machine (CPU only), the Local cross-encoder added a median of 18.5 s and a p95 of 121.6 s to each search; the whole arm took 1,509 s for 57 searches. The machine was shared with other work during the run, so treat these as this box's figures, not the engine's floor. It is still far too slow for a chat search on a CPU-only server.
- **Local's download.** The first use of `BAAI/bge-reranker-v2-m3` downloaded and loaded the model in **51.5 s** (a one-off warm-up before the run). Inside the run, loading it from the disk cache took 17.9 s. The harness waits for the model before the arm starts, so no search fell back while it loaded.
- **Searches that return one passage.** Six questions (the near-identical `team-note-*.txt` files) come back with a single passage on every arm, because near-duplicate passages are collapsed before ranking. They count the same way on every arm.
- **LangSmith.** Tracing was on during the run, but the configured LangSmith key was refused (`403 Forbidden` on `runs/multipart`), so no trace from this run reached LangSmith. The D-19 trace check (tokens, cost and latency on each `decision.*` span) stays with plan 05's live drive.

## Verdict per engine

- **Local:** keeps recall within 2 points (it raises it by 7.0 points, no flips). Chunks and cost are N/A under D-08 because it only reorders. It is too slow on this CPU-only box: 18.5 s median added per search.
- **Jev:** keeps recall within 2 points (+7.0 points, no flips) and sends fewer chunks (4.54 → 4.02 per search). It **fails the cost gate**: it costs $0.00020713 more than it saves per search against `deepseek-v4-flash`, and breaks even only if a search's passages are re-sent 11 times in a chat. That is reported as a cost, not a saving.
- **OpenAI Decisions:** **UNMEASURED.** OpenAI returned 403, *"The project does not have access to this model."*, on the first three searches, so the arm was stopped. The configured OpenAI key's project has no access to `gpt-6-luna`. This is an operator action (enable Decisions access for that project, or store a key that has it); then re-run with `--arms off,openai_decisions` (294-VALIDATION.md row M1). Its `predicate` probability calibration is unverified by the vendor (RESEARCH A6), so this measurement, once it runs, is the calibration check.
- **Cohere:** keeps recall within 2 points (+7.0 points, no flips). Chunks and cost are N/A under D-08. Its engine cost is unpriced because Cohere publishes no per-search price.

## Reproduce

```bash
backend/venv/Scripts/python scripts/measure-decision-engines.py \
  --heldout backend/tests/unit/fixtures/decision_heldout_v1.json \
  --arms off,local,jev,openai_decisions,cohere --pool 20 --top-k 5 \
  --json-out .planning/phases/294-decision-engine-rerank-and-citation-check/294-measurement.json \
  --label 294-02
```

A held-out file whose bytes no longer hash to `decision_heldout_v1.sha256`, an unreachable database, or a frozen target that is no longer in the database stops the run with exit 2 and writes nothing.
