# Phase 294: Decision Engine: Rerank and Citation Check - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-20
**Phase:** 294-decision-engine-rerank-and-citation-check
**Areas discussed:** Settings + keys, How pruning works, Citation check UX, Local model + test set

---

## Settings + keys

| Option | Description | Selected |
|--------|-------------|----------|
| Extend Rerank | One block, engine picker Cohere · Local · Jev · OpenAI Decisions | ✓ |
| New Decision block | Separate block; two switches can conflict | |
| Reuse provider keys | OpenRouter key for Jev, OpenAI key for Decisions; already encrypted | ✓ |
| Dedicated engine keys | Separate secret columns + migration | |
| OpenRouter only | One Jev path; narrows DEC-01 | ✓ |
| Both routes | TypeSafe direct too; second key + adapter | |
| Operator-wide | app_settings, as rerank today | ✓ |
| Per user | user_settings columns; per-person egress choice | |

**User's choice:** all recommended options.
**Notes:** "OpenRouter only" narrows DEC-01's wording; REQUIREMENTS.md amended in the same commit.

---

## How pruning works

| Option | Description | Selected |
|--------|-------------|----------|
| Per-doc probability | Jev `noul` / OpenAI `score`, thresholdable | ✓ |
| One ranked list | Listwise `choice`; ranks, cannot prune safely | |
| Hybrid | Listwise order + per-doc prune; double cost | |
| Conservative | Drop < 0.1, keep >= 3, never empty | ✓ |
| Reorder only | No pruning; SC#3 cannot pass | |
| Moderate | Drop < 0.3, keep >= 2 | |
| <= 2 points | Recall margin vs rerank-off | ✓ |
| Zero loss | Strict; noisy on small sets | |
| <= 5 points | Room to prune harder | |
| Optional tool arg | `instruction` on search_documents | ✓ |
| Automatic from question | User's last message as instruction | |

**User's choice:** all recommended options.

---

## Citation check UX

| Option | Description | Selected |
|--------|-------------|----------|
| On demand | Action on a settled cited answer | ✓ |
| Automatic | Every cited answer checked | |
| On the sentence | Mark per cited sentence, hover/tap | ✓ |
| In References list | Beside each source in CitationList | |
| Both | Sentence marks + summary line | |
| Saved | Stored per message; likely migration 211 | ✓ |
| Computed each time | No storage; pays every press | |
| Hosted only | Jev / OpenAI; hidden with reason otherwise | ✓ |
| Fall back to chat model | Full model call with Cohere/Local | |

**User's choice:** all recommended options.

---

## Local model + test set

| Option | Description | Selected |
|--------|-------------|----------|
| bge-reranker-v2-m3 | Apache-2.0, drop-in CrossEncoder | ✓ |
| Qwen3-Reranker-0.6B | Takes instruction; own loader | |
| Both selectable | Both driven and measured | |
| Grow to >=50, frozen | 10 probes + chunk-derived, frozen before tuning | ✓ |
| Existing 10 only | 1 flip = 10 points | |
| You write them | Operator-authored | |
| Measured and gated | Tokens saved vs engine cost per engine | ✓ |
| Report only | Numbers recorded, no pass/fail | |
| Full 8-row roster | SC#10 for the schema change | ✓ |
| Schema tests + 2 live rows | Would be a guardrail override | |

**User's choice:** all recommended options.

---

## Claude's Discretion

- OpenAI question type per use; concurrency, batch sizes and timeouts per engine; citation-check storage shape and wire format; chunk-derived question generation (freeze-first holds); local-model singleton fix; the `instruction` argument's description.

## Deferred Ideas

- Jev via TypeSafe direct; model routing; chunk tagging at ingestion; automatic citation check; Qwen3-Reranker locally.
