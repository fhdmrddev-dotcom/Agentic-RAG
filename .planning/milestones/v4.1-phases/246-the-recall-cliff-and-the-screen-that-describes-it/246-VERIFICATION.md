---
phase: 246
phase_name: "The Recall Cliff, and the Screen That Describes It"
verified: 2026-09-13
status: complete
verification_mode: peer-reviewed   # ⭐ THE FIRST PHASE SINCE OV-SOLO-01 WAS RE-ARMED. Builder gemini, reviewer claude, at three gates. ⛔ NOT a blanket claim — see `review_caveat`.
review_caveat: |
  ⛔ ONE COMMIT IN THIS PHASE IS **SELF-VERIFIED**, NOT REVIEWED, AND IT IS NAMED RATHER THAN
  FOLDED INTO THE HEADLINE. `521f4a025` (the ef_search revert, four code sites + help copy +
  the copy-pinning test) was authored by **claude**, the reviewer. Everything else — plans
  `246-01`/`02`/`03`, their execution, the EXPLAIN evidence, the SUMMARYs and `SEED-273` — was
  built by **gemini** and reviewed by claude at the context gate, the plan gate and
  post-execution. AGENTS.md §6.3 is satisfied for the build and **not** for the revert.
  Re-open trigger: the next phase touching `hnsw_ef_search` re-reviews that commit.
builder: gemini
reviewer: claude
independent_review: done          # ⚠ WRITTEN 2026-09-16 by the DEBT-06 milestone-close audit. The substance was here all along; only the INDEX entry was missing, which is why this row read as unmet for three days. ⭐ THIS IS THE ONE ROW OF THE EIGHT WHERE CLAUDE DID NOT BUILD THE PHASE — `builder: gemini`, `reviewer: claude`, at three gates (context, plan, post-execution). AGENTS.md §6.3's two-agent separation is genuinely satisfied for the build. ROADMAP's DEBT-06 row 3 says of this phase: "246 already carries peer-reviewed; confirm it rather than re-run it" — this marker IS that confirmation. ⛔ NOT A BLANKET CLAIM: `review_caveat` above is carried forward UNCHANGED and remains binding — commit `521f4a025` (the ef_search revert, four code sites + help copy + the copy-pinning test) was authored by claude, the reviewer, and is SELF-VERIFIED, not reviewed. Its re-open trigger stands: the next phase touching `hnsw_ef_search` re-reviews that commit. A `done` that swallowed that caveat would be the exact dishonesty this field exists to prevent. Full audit: `.planning/DEBT-06-AUDIT.md`.
score: "3 / 4 success criteria — SC#1 UNMET BY MEASUREMENT, and that is the phase's deliverable"
---

# Phase 246 — Verification

**The phase set out to fix small-tenant recall by raising a setting. It proved the setting cannot
fix it, and caught a false belief that had been shipping since Phase 241.** That refutation — not a
default change — is what 246 delivers.

## Success criteria

| SC | Verdict | Evidence |
|---|---|---|
| **SC#1** — a 0.2% tenant of a 100k corpus gets its documents back with nobody touching a setting | ⛔ **UNMET, BY MEASUREMENT** | The ladder below. No `ef_search` value achieves this through the index. |
| **SC#2** — an operator who wants to change search breadth can reach the control and save it | ✅ **MET** | Settings → Search saves; `SettingsPage.changedFields.test.tsx` 22/22. Rests on 242's SHIP-01, driven locally. |
| **SC#3** — the number on screen is the number in force | ✅ **MET** | Backend probe asks Postgres (`retrieval_tuning.py`); frontend renders `null` + skeleton pre-fetch and never a compiled-in guess. |
| **SC#4** — defended by a measurement that would fail if the default regressed | ✅ **MET** | `246-VERIFICATION-DATA.md` — before/after with corpus size, execution plans and latency. It is what caught the defect. |

## ⭐ The finding

`EXPLAIN (ANALYZE)` inside `match_document_chunks`, against a purpose-built 100,000-chunk
`recall_bench` database:

| `ef_search` | plan | rows | recall@20 | latency |
|---|---|---|---|---|
| 40 / 60 / 80 | **Index Scan** | **1** | ~0.05 | ~4 ms |
| 100 / 150 / 200 | **Seq Scan** | 20 | 1.000 | ~1,100 ms |

⛔ **Every genuine index walk returns ONE row. Every good recall number is a full table scan.**
Above a cost inflection between ef 80 and ef 100 the planner abandons
`document_chunks_embedding_idx` entirely — so raising `ef_search` never widened the search, it
*accidentally disabled the index*. There is no knee and no value to pick.

⚠ **It reaches backward.** Phase 241 concluded `ef_search = 200` restores recall to 1.000 and
**never inspected a plan**; `QUEUE-06`'s shipped remedy and `D-v4.0-EF-DEFAULT`'s reversal both rest
on that. On this evidence 241 was measuring a sequential scan and did not know. ⛔ Deliberately
**not** repaired inside 246 — it is an operator-facing conclusion, not a plan edit.

## What shipped, and what did not

**Shipped:** the server-default probe (asks Postgres, 60 s TTL, fresh connection outside any
transaction); the pre-fetch loading state; honest help copy; execution-plan inspection and latency
instrumentation in the recall harness; three ledger rows corrected.

**Deliberately reverted:** the `ef_search` default is back at **40** (`521f4a025`). 200 is a table
scan, and shipping it would have cost every tenant ~1.1 s a query to fix a cliff only small tenants
have, by a mechanism nobody intended.

**Not delivered:** the recall cliff itself. `RECALL-01` is **unmet and honestly recorded** rather
than closed by a number. Follow-up is `SEED-273` (`hnsw.iterative_scan`, currently `off`), whose
trigger names both Phase 241's re-measurement and `SEED-076`'s refuted ordering — that refutation is
itself now suspect, since those runs may also have crossed the cost inflection.

## Gates

| Gate | Result |
|---|---|
| Fence — `retrieval_service.py` | ✅ **byte-unchanged** over the whole phase (no 3rd G-5 landing) |
| Backend unit | ⚠ **71 / 72 / 72 / 77 observed on one tree** — see the caveat below. **0 failures in 246's blast radius**, attributed by file on three runs. |
| Frontend typecheck | ✅ 67 = base (`tsc -p tsconfig.app.json`; the bare `--noEmit` form checks **zero** files) |
| `SettingsPage.changedFields` | ✅ 22/22 — and it **failed on the revert**, which is the content assertion earning its keep |
| Count gate | ✅ `failed 0`, total 8288 / pinned 7493 (one red run was SEED-171 flake; ⚠ filenames were lost by re-running first) |
| Ledger + CLAUDE.md size | ✅ both clear |

⚠ **THE BACKEND CEILING IS NOT A STABLE PROPERTY AND THIS PHASE IS THE EVIDENCE.** CLAUDE.md locks
it at **71 with zero headroom**; this session measured **71, 72, 72 and 77** on the same tree. A
proposed root cause (repo-root CWD) was **refuted** by measurement — `test_sql_service.py` fails
12 from both directories, `test_explorer_agent.py` 6 from both, and both runs collected an
identical 4,787 items. ⛔ Not repaired here; it wants its own re-derivation as *a set with a flake
band*, never a single integer.

## Process note

Two mechanism-shaped root causes were published in this phase and **both were wrong**: claude's
post-filter/Seq-Scan argument (refuted by a docstring in the file under review) and gemini's
CWD explanation for the failure count (refuted by two commands). In both cases the bare observation
was true and sufficient, and the causal story added nothing but confidence. ⭐ **Report the
observation; propose the mechanism only when you have driven it.** Notably, claude's *conclusion*
was right while its *argument* was wrong — and the withdrawal that followed was a second error,
corrected only because gemini ran the measurement it had been told to skip.
