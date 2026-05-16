---
spike: 005
name: retrieval-value-smoke
validates: "Given the winning engine combo (pymupdf_full WITH the cap raised from 20→100), when 5-10 figure-grounded queries are run against the live pipeline, then answer quality observably exceeds the cap=20 baseline. This is the (b) leg of the SEED-021 re-open trigger."
verdict: NOT RUN — user opted to close SEED-021 on (a) findings alone (2026-05-16). Procedure preserved for optional future use or as the basis for Phase 072 Plan 03 UAT extension.
related: [001-pymupdf-full-baseline, 002-get-drawings-vector-cluster, 003-pdfplumber-figures]
tags: [seed-021, retrieval, leg-b, human-judgment, hand-evaluation]
---

# Spike 005: Retrieval Value Smoke (the (b) leg)

## What This Validates

**Given** the thesis with the storage cap raised from `_MAX_VISION_CALLS=20` to 100 (a preview of Phase 072 Plan 01 — full extraction ceiling of 67 figures now stored + described),
**when** 5–10 figure-grounded queries are run against the live agent pipeline,
**then** answer quality observably exceeds what the cap=20 state produced on the same queries.

This is the **decisive (b) leg of the SEED-021 re-open trigger**. Spikes 001-003 answered (a) — "which OSS engine gives best detection at $0 cost." The Spike 001 surprise (extraction was always at 67, the cap was the storage-layer ceiling) collapsed (a) to "raise the cap." Spike 005 now asks the harder question: **does raising the cap actually move retrieval quality, OR are figures not the retrieval bottleneck?**

The answer routes the next decision:
- **GREEN** — answers improve materially → Phase 072 Plan 01 is the high-value change; ship it. SEED-021 closes with "extraction storage cap was the bottleneck; recall lifted retrieval; opportunity validated."
- **YELLOW** — mixed signal → ship Plan 01 anyway (it's cheap) but redirect future effort away from recall-lift toward chunking/reranker.
- **RED** — no improvement → storage is NOT the retrieval bottleneck. Ship Plan 01 (still closes the dead-code seam) but de-prioritize follow-up image-recall work. The SEED-021 spike concludes "extraction was solved long ago; retrieval improvements live elsewhere."

## How to Run

```bash
# Tell me what's in the DB right now (baseline snapshot)
backend/venv/Scripts/python.exe .planning/spikes/005-retrieval-value-smoke/run.py status

# Print the full manual procedure (preview patch + query loop + revert)
backend/venv/Scripts/python.exe .planning/spikes/005-retrieval-value-smoke/run.py prep

# Print the revert reminder when done
backend/venv/Scripts/python.exe .planning/spikes/005-retrieval-value-smoke/run.py revert
```

## What to Expect

This spike is **NOT autonomous.** It requires:
- A running dev stack (uvicorn + frontend at http://localhost:5173)
- A one-line throwaway patch to `multimodal_service.py` (`_MAX_VISION_CALLS = 100`)
- One SQL update to `app_settings.multimodal_max_vision_calls = 100`
- A re-ingest of the thesis
- Hand-evaluation of 5–10 figure-grounded queries (before and after)
- A revert at the end

`run.py prep` prints the full step-by-step instructions. Total time: ~30 minutes including the re-ingest wait.

## Why this isn't redundant with Phase 072 Plan 03's UAT

Plan 03's live UAT measures **storage**: does total stored figure count rise, does empty share stay low. This spike measures **retrieval value**: do the additional stored figures actually change agent answers on real queries.

Plan 03's UAT can pass with high stored figure count but zero retrieval improvement (the bad outcome where Plan 01 ships but doesn't move the needle). Spike 005 catches that case BEFORE shipping.

## Results (2026-05-16)

**NOT RUN.** After Spikes 001-004 returned a conclusive (a)-leg finding ("extraction was never the bottleneck — storage cap was"), the operator opted to close SEED-021 on the (a) evidence alone and skip the (b) retrieval-value evaluation as a blocking gate.

Rationale:
- The (a) finding is mechanically unambiguous (the DB physically shows 20 stored figures with `empty=0` on a doc where the extractor finds 67 — the LLM successfully described every figure it tried).
- Phase 072 Plan 01 ships the actual fix regardless (replaces the hardcode with the `app_settings` read — closes the dead-code seam).
- The retrieval-quality observation can be made post-Plan-01 in real use without setting it up as a blocking spike.
- The full procedure (~30 min of manual hand-evaluation) was disproportionate to the marginal information gain given the conclusive (a) leg.

The manual procedure in `run.py prep` remains runnable if the question resurfaces. It is also a useful template for an optional extension to Phase 072 Plan 03's live UAT.

### Result template (fill in after run)

**Cap=20 baseline:**

| # | Query | Answer summary | Was the figure cited? |
|---|---|---|---|
| 1 | _e.g., "What does Figure 3 show?"_ | _<paste excerpt>_ | yes / no / partial |
| ... |

**Cap=100 (Plan 01 preview):**

| # | Query | Answer summary | Was the figure cited? | Δ vs baseline |
|---|---|---|---|---|
| 1 | (same query) | _<paste excerpt>_ | yes / no / partial | ↑↑ / ↑ / = / ↓ |
| ... |

**Aggregate scoreboard:**

- Queries with material improvement (↑↑): _N_
- Queries with modest improvement (↑): _N_
- Queries unchanged (=): _N_
- Queries regressed (↓): _N_

**Verdict:** GREEN / YELLOW / RED

**Notes / surprises:** _(free-form)_
