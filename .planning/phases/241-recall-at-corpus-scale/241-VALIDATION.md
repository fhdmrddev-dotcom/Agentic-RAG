# Phase 241 — Recall at Corpus Scale: the verdict

**Measured 2026-09-10.** Every number below cites the JSON report it came from, under
`.planning/phases/241-recall-at-corpus-scale/reports/`.

---

> ⚠ **READ `241-VERDICT-CORRECTION-PLAN-PATH.md` ALONGSIDE THIS DOCUMENT.** A post-verdict
> measurement found that the "control — real database" rows below were executed on a
> **sequential scan**, not on the HNSW index: `document_chunks_embedding_idx` has `idx_scan = 0`
> for the life of that database. The before/after therefore differs in corpus size **and** in
> execution plan. The finding is not overturned — it is sharpened, because the degradation is a
> **plan-change cliff rather than a slope** — but the two rows must not be described as differing
> only in size. That file also records `241-REVIEW.md` **WR-02 as OPEN**: the per-shape
> `recall_at_k = 1.000` readings in SC#2 are not yet proven, because the test that would prove
> them is blind on a corpus this size.


## ⛔ THIS IS A SELF-VERIFICATION, NOT AN INDEPENDENT REVIEW

**Claude planned this phase, built all four plans, and measured the result. Claude is also the
only party verifying it.** CLAUDE.md requires that *whoever REVIEWS a phase must not have shaped
the build*, and AGENTS.md §6.3's independent reviewer **does not exist for Phase 241** — the
operator directed a solo run (D-17), and Gemini has been unavailable since 2026-09-09. Nothing
in this document was checked by an agent that did not write the code it checks.

That is a real gap, and it is stated first rather than buried. **Phase 241 joins Phases 238 and
240 in owing an independent §6.3 review.** Read every verdict below as a builder's own report on
his own work: the *numbers* are machine-produced and re-runnable by anyone (that is the point of
SC#3), but the *framing, the scoring and the choice of what to measure* had exactly one author.

---

## The honest framing, before any number

**We measured selectivity-driven collapse at a feasible size. We did NOT reproduce a 10M-chunk
install on a laptop, and nothing here should be read as though we had.**

The collapse this phase exists to find is driven by **selectivity**, not by raw row count. A
tenant owning 0.2% of the corpus starves a 40-candidate index scan the same way at N = 100,000 as
at N = 20,000,000: the scan spends its fixed candidate budget on rows the caller may not see, and
the seven always-on predicates then discard nearly all of them. Growing N does not create the
defect; it only makes the surviving fraction smaller. **The bench manufactures the tenant skew the
real corpus structurally cannot show** — the operator's live corpus is ~one org owning everything,
which SEED-076 names precisely as the shape that *hides* this defect.

⚠ Two consequences follow, and both are limitations rather than caveats:

- **The absolute recall figures below are properties of THIS corpus at THIS size.** They are a
  demonstration that the mechanism is real and that the two shipped levers move it. They are not a
  sizing table for a customer install.
- **A larger corpus was refused on measured grounds, not skipped.** 241-02 measured the per-chunk
  cost at a 20k smoke build and extrapolated 250k to 3.80 GB against 5.1 GB free at the time; the
  operator confirmed **100,000**. The collapse was already visible at 20k, so a bigger corpus buys
  curve legibility, not the defect's existence.

### The measured storage basis, so a reader can size their own install

From `reports/bench-build.json`, at 100,000 chunks / 3,842 documents:

| | Measured |
|---|---|
| `document_chunks` total relation | **1,617.2 MB** |
| `document_chunks_embedding_idx` (HNSW, `m=16, ef_construction=64`) | **781.0 MB** |
| Per chunk, heap | **≈ 16.6 KB** |
| Per chunk, HNSW index | **≈ 8.0 KB** |
| Per chunk, total | **≈ 24.6 KB** |

Build wall time, same report: `create_database` 0.095 s · `apply_full_schema` 0.208 s ·
`copy_real_corpus` 5.02 s · `synthesize` 187.8 s · `build_hnsw_index` 46.7 s.

---

## What was measured, and how

- **Corpus:** a throwaway `recall_bench` database on the LOCAL Docker Postgres, built from
  `supabase/full-schema.sql` **after** migration 176 was applied by the operator and the artifact
  was regenerated (`bash scripts/regenerate-full-schema.sh`, **no `--reset`**). The project's own
  bootstrap artifact, so `match_document_chunks` under measurement is the real function.
- **The real 7,959 chunks are copied in verbatim** and the synthetic bulk is built around them by
  perturbing real embeddings — no provider call was made, at any point (`provider_calls: 0`).
- **Skew ladder, achieved exactly:** 0.2% (200 chunks) · 2% (2,000) · 20% (20,000), with a 69.8%
  filler tenant whose rows sit in the HNSW graph but outside every small tenant's org gate.
- **`k = 20`**, matching `hybrid_candidate_count` (`config.py:930`). `match_threshold = 0.3`.
- **Layer 1 (mechanical, SC#2):** for each query vector × filter shape, the *exact* arm is the true
  top-k under the SAME `WHERE`, forced off the index; the *ann* arm is what the RPC actually
  returns. 25 query vectors, seed 241. `recall_at_k = |ann ∩ exact| / |exact|`,
  `underfill = 1 − |ann|/k`.
- **Layer 2 (semantic, SC#1):** the ten evaluation probes driven through the real path, a miss
  scored as a miss, a target absent from the database **excluded** rather than counted as a miss.
- ⭐ **One probe-vector cache served every single run**, local and bench, before and after:
  `reports/probe-vectors.json`, md5 **`5be60f80415a6a74b054e832653d5f48`**, unchanged across all
  26 invocations. Without that, every delta would be a mixture of the configuration change and
  embedding non-determinism, and neither SC#1's *"the same questions"* nor SC#3's *"a later
  regression is detectable"* would mean anything.

---

## SC#1 — the same questions that worked at small scale still work

> *A person searching a Library grown to customer scale still gets the right documents back — the
> same questions that worked at small scale still work, and the before/after numbers are on record.*

### ⛔ SCORED: **FAILED on the shipped configuration. PASSES once `hnsw.ef_search` is raised.**

The same ten probes, the same query vectors, the same targets — at two corpus sizes:

| Run | Corpus | Hit@1 | Hit@3 | Hit@5 | MRR | Wall | Report |
|---|---|---|---|---|---|---|---|
| Control — real database, shipped config | 7,959 chunks | **0.78** | 0.78 | 0.78 | **0.778** | 0.484 s | `control-real-corpus-shipped-recheck.json` |
| Control — real database, earlier in the run | 7,953 chunks | 0.78 | 0.78 | 0.78 | 0.778 | 5.375 s | `control-real-corpus-shipped.json` |
| **Bench at 100,000, shipped config** | 100,000 chunks | **0.44** | 0.44 | 0.44 | **0.444** | 0.141 s | `l2-bench-before-shipped.json` |
| Bench at 100,000, `ef_search = 200` | 100,000 chunks | **0.78** | 0.78 | 0.78 | **0.778** | 5.812 s | `l2-bench-ef200.json` |
| Bench at 100,000, `ef_search = 200` + `relaxed_order` | 100,000 chunks | **0.78** | 0.78 | 0.78 | **0.778** | 5.891 s | `l2-bench-ef200-relaxed.json` |

**Three documents that were found at 7,959 chunks stopped being found at 100,000**, and named
individually rather than aggregated:

- `northwind-commercials-renewal.md`
- `Triangulation_Research_Complete_with_Visuals.docx`
- `sample_master_rate_sheet.xlsx`

All three return to rank **#1** at `ef_search = 200`. ⭐ **That is SC#1's sentence, measured, with a
before and an after** — and the failure is silent: nothing errors, nothing warns, the search simply
answers with less than it holds.

⚠ **Two probes miss at BOTH sizes** — `kb_doc3_metrics_decisions.md` and `uat111_axisa_minimax.md`
— and they are **not** this defect. They were already missing at 7,953 chunks, so they are a
retrieval-*quality* question (SEED-020's territory, explicitly out of scope here), not a
scale-recall one. Counting them into the collapse would have overstated it by two thirds.

⚠ **One probe target is not in the database at all** (`2026 Q3 board pack.pdf`) and is **excluded
from the metric, not scored as a miss** — *"the document is not here"* and *"retrieval did not find
it"* are different facts. 9 probes scored, in every run above.

⚠ **The latency trade is visible and is not free.** The shipped configuration answers in
**0.141 s** and is wrong; `ef_search = 200` answers in **5.812 s** and is right. That is ~0.58 s
per query at 100,000 chunks against ~0.014 s — a ~41× cost for the 10 probes as measured. **This is
why the knobs shipped as settings rather than as a raised constant** (241-03 / D-09): the right
value is an install-sizing decision, and the product now exposes it.

---

## SC#2 — a narrowed search returns what an unnarrowed one would have found within that scope

> *A search narrowed by folder, saved View, connection or source returns what an unnarrowed search
> would have found within that scope — the filter does not silently drop results that are there.*

### ⛔ SCORED: **HONESTLY-PARTIAL — three of four named axes measured, two named axes DO NOT EXIST, and neither was built.**

### The three axes that exist — all measured, all passing at every configuration

`recall_at_k` on the narrowed shapes, all three tenants, all seven configurations
(`reports/l1-*.json`):

| Shape | How it is reached | recall@20, every run | underfill (0.2% tenant) |
|---|---|---|---|
| `folder` | `p_folder_ids` — a real RPC parameter | **1.000** | 0.054 |
| `metadata` | `metadata @> {"document_type": …}` | **1.000** | 0.056 |
| `source_system` | `metadata->'source'` is a NESTED object, so `{"source":{"system":"google"}}` matches by jsonb containment | **1.000** | 0.116 |

**On all three reachable axes the filter does not silently drop results that are there — recall is
perfect at every `ef_search` including the shipped 40.** The non-zero under-fill on the smallest
tenant is *genuine scope size* (the exact arm also returns fewer than 20; `exact_size` ranges 5–20
for `folder`/`metadata` and 1–20 for `source_system`), and it is **unchanged by every knob** —
which is exactly how a scope-that-is-small is distinguished from an index-that-starves. Reporting
`recall_at_k` alone, or `underfill` alone, would have confused the two.

### ⭐ THE FINDING THAT INVERTS THE EXPECTATION — and it is settled by the data, not inferred from latency

At the shipped configuration, the **20% tenant**, `reports/l1-skew0.2-before-shipped.json`:

| Shape | `exact_size` | `ann_size` (min/median/max) | recall@20 |
|---|---|---|---|
| `none` — no extra filter | 20 | **4 / 8 / 17** | **0.360** |
| `folder` | 20 | 20 / 20 / 20 | 1.000 |
| `metadata` | 20 | 20 / 20 / 20 | 1.000 |
| `source_system` | 20 | 20 / 20 / 20 | 1.000 |

**Same tenant, same k, same server settings, same corpus, same query vectors — and the query with
FEWER predicates returns FEWER rows than its own subsets.** Under one execution plan that is
logically impossible: adding a conjunct can only shrink a result set, never grow it. With
`hnsw.iterative_scan = off` pgvector returns at most `ef_search` graph candidates and filters
after, so a more restrictive filter can never yield more rows on that path.

⭐ **The only consistent reading is that the narrowed shapes are NOT executed on the HNSW index at
all** — the planner drops it once a selective predicate is present and answers exactly. So
**adding a filter makes this product's search more accurate, and the dangerous query is the
UNNARROWED one.** That is the opposite of the intuition SC#2 is written against, and it is why
SC#2's own sentence passes while SC#1's fails.

⚠ **Stated as an inference, with what would confirm it.** The recall data establishes that the two
shapes take *different execution paths*; it does not directly observe the plan.
`match_document_chunks` is `SECURITY DEFINER`, so an outer `EXPLAIN` shows only a function scan —
confirming the plan needs `auto_explain` inside the function body, **which this phase did not run.**
An attempt was made and abandoned rather than guessed at.

### The two axes that DO NOT EXIST — and were deliberately not built

**Connection-by-id and saved View.** Measured, not assumed:

- `search_documents` accepts exactly **two** filter parameters: `metadata_filter` and
  `folder_ids`. There is no `connection_id`, no `view_id`, no `source_system` parameter — not in
  the Python signature, not in the tool schema the model is shown, not in the RPC's arguments.
- The live metadata keys are `title, summary, document_type, topics, language, author, date,
  source, email_*` (plus `_confidence`, `_classification`, `_vision`, `attachments`,
  `contract_value`, `_takeoff`, `_images`). **There is no `source_connection_id` key and no
  `source_system` key**, so neither axis is reachable even through the generic `metadata @>`
  escape hatch.
- `documents.source_connection_id` *is* a real, populated column and `match_document_chunks`
  already reads it — through `connection_doc_is_visible()`, as part of the **visibility**
  predicate. What is absent is a **caller-supplied filter** on it.

⛔ **They were not built, deliberately.** Nothing today — no UI control, no tool-schema parameter,
no workflow binding — would invoke either one. A filter exercised only by the measurement harness
is presence-without-behaviour: a green fence beside no behaviour, which is the shape this project
has paid for at Phase 235 (a `data-testid` presence assertion that could not see content drift), at
Phase 240 (a fence that stayed green when the call it guarded was deleted) and at Phase 239
(`Boolean(mcp_server_url)` printing *"Ready as source"* for rows that resolved no adapter).
**Adding the parameter would have scored SC#2 green while changing nothing a user can do.**

**No plan in this phase built either axis**, and that is checkable rather than asserted:
`git log <phase base>..HEAD -- backend/app/services/retrieval_service.py
backend/app/services/tool_dispatcher.py supabase/migrations/` adds no such parameter.

**Carried forward:** `SEED-265` — *narrow a search by connection or by saved View* — `status:
planted`, with `trigger_when` naming a concrete surface: **the first UI control, tool-schema
parameter, or workflow binding that would actually narrow a search by connection or by saved
View.** It records the two missing metadata keys and the two-parameter signature so the next reader
does not re-derive them.

⚠ **A warning written into that seed and repeated here:** a new, more selective filter axis makes
the caller's effective share *smaller*, so a connection filter on a small connection would be the
most starvation-prone query this product could offer. It must ship with the `ef_search` finding
understood, not after it.

---

## SC#3 — anyone can re-run the measurement and get a number, on local and on cloud

> *Anyone can re-run the measurement and get a number, on local and on cloud, so a later regression
> is detectable rather than anecdotal.*

### ⛔ SCORED: **MET on local. PARTIAL on cloud — parity measured live, the cloud recall run BLOCKED on a credential.**

### The reproduction command, verbatim

**Local (or any DSN), against the real database:**

```bash
cd backend && venv/Scripts/python.exe ../scripts/measure-recall.py \
  --dsn "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  --user-id d8a54002-6a29-4b88-b918-cff2aa4a06d5 \
  --layer both --k 20 \
  --probe-cache ../.planning/phases/241-recall-at-corpus-scale/reports/probe-vectors.json \
  --label my-run --json-out /path/to/my-run.json
```

**Cloud — the identical command, one flag different:**

```bash
cd backend && venv/Scripts/python.exe ../scripts/measure-recall.py \
  --dsn "<cloud connection string>" \
  --user-id <a cloud user who owns documents> \
  --layer both --k 20 \
  --probe-cache ../.planning/phases/241-recall-at-corpus-scale/reports/probe-vectors.json \
  --label cloud-as-is --json-out /path/to/cloud-as-is.json
```

**To rebuild the bench and reproduce the before/after** (⛔ in that order — the bench reads the
artifact):

```bash
bash scripts/regenerate-full-schema.sh                     # NO --reset. --reset wipes the local DB.
cd backend && venv/Scripts/python.exe ../scripts/build-recall-bench.py \
  --chunks 100000 --report ../.planning/phases/241-recall-at-corpus-scale/reports/bench-build.json
# … measure with --dsn postgresql://postgres:postgres@127.0.0.1:54322/recall_bench …
venv/Scripts/python.exe ../scripts/build-recall-bench.py --teardown
```

The build is seeded (`--seed 241` by default) and reproducible: the second 100k build produced
**byte-identical tenant user-ids** to the first.

**A number is a number, and a refusal is a refusal.** `measure-recall.py` exits **non-zero** and
writes **no report** when it cannot honestly measure — driven live during this phase against an
unreadable bench, where it printed a refusal naming the host and produced no metric. *Could not
measure* and *measured, and it was fine* do not share an exit code.

Every report carries its label, ISO timestamp, host + database (**never the credential**),
PostgreSQL and pgvector versions, the live `hnsw.*` values, the requested knobs, the caller's
visible corpus counts, `k`, the threshold, the query-vector sample size and the seed. **That is the
difference between a number and an anecdote.**

### Cloud parity — VERIFIED LIVE, and it satisfies D-14

Run by the operator in the cloud SQL editor, returned verbatim:

```json
{"pgvector": "0.8.0",
 "postgres": "PostgreSQL 17.6 on x86_64-pc-linux-gnu, compiled by gcc (GCC) 15.2.0, 64-bit",
 "forces_guc_registration": 1,
 "ef_search": "40",
 "iterative_scan": "off"}
```

| | Local (measured at 241's start) | **Cloud (measured 2026-09-10)** |
|---|---|---|
| pgvector | 0.8.0 | **0.8.0** |
| PostgreSQL | 17.6 | **17.6** |
| `hnsw.ef_search` | 40 | **40** |
| `hnsw.iterative_scan` | off | **off** |

**D-14's gate is SATISFIED. `hnsw.iterative_scan` EXISTS on the production server and may be
claimed as the remedy.** The ROADMAP's fallback verdict — *"if cloud is below 0.8 the verdict says
`ef_search` alone carries production"* — **does not fire**, and cloud is starved by exactly the
same shipped defaults as local.

### ⚠⚠ THE PARITY TEST AS PLANNED WAS WRONG, AND IT WOULD HAVE WITHDRAWN A WORKING REMEDY

Full record: `241-PARITY-PROBE-CORRECTION.md`. `241-04-PLAN.md`'s `<interfaces>` block said, of
`current_setting('hnsw.iterative_scan', true)`:

> *"On pgvector < 0.8 the third statement returns NULL … a NULL there IS the parity answer."*

**That is false.** The `hnsw.*` GUCs are registered by the extension the first time it is used in a
session, so `current_setting(…, true)` returns NULL on pgvector **0.8.0** too, in any session that
has not yet touched a vector operation. Proven on the LOCAL server, which is known to be 0.8.0:

```
--- fresh session, before any vector op ---   ef_search: None   iterative_scan: None
--- same session, AFTER '[1,0,0]'::vector <=> '[0,1,0]'::vector ---   ef_search: 40   iterative_scan: off
```

The first cloud probe **did** return `{ef_search: null, iterative_scan: null}`. Read through the
plan's stated rule that meant *"cloud is below 0.8 — withdraw the remedy"*, from a server that is
byte-for-byte at the same version as local. **This document would have recorded a hardware
limitation that does not exist**, and nobody re-runs a verdict.

A second, independent defect in the same test: the parity block was **four statements pasted
together**, and the Supabase SQL editor returns only the LAST statement's result set — so
`SELECT extversion` and `SELECT version()`, the two statements that actually answer the question,
never came back at all. The operator's paste was complete and correct; the test could not surface
its own answer.

**The corrected probe is one statement with the GUC registration forced first:**

```sql
SELECT
  (SELECT extversion FROM pg_extension WHERE extname = 'vector') AS pgvector,
  version()                                                       AS postgres,
  ('[1,0,0]'::vector <=> '[0,1,0]'::vector)                       AS forces_guc_registration,
  current_setting('hnsw.ef_search', true)                         AS ef_search,
  current_setting('hnsw.iterative_scan', true)                    AS iterative_scan;
```

⛔ **`pgvector` is the load-bearing column, never `iterative_scan`.** Read the version; never infer
it from a NULL GUC. And `forces_guc_registration: 1` is not decoration — it is the evidence that
the two `current_setting` values were read *after* the extension loaded. A re-run that drops the
`<=>` term gets NULLs again and means nothing by them.

⭐ **The cost of catching this was one query against a server of a KNOWN version. That control was
in hand the entire time.**

### ⛔ The cloud AS-IS recall run — BLOCKED, not dropped

| Row | Status | Reason | Unblocking action |
|---|---|---|---|
| Cloud pgvector / PostgreSQL parity | ✅ **MEASURED** | Operator ran the corrected probe in the cloud SQL editor | — |
| Cloud recall@k + under-fill AS-IS | ⛔ **BLOCKED** | **No read-capable cloud DSN was supplied to the executor.** The harness takes one on `--dsn`; none was provided, and no credential was sought from the environment | Operator supplies a read-capable cloud connection string; run the SC#3 cloud command above with the SAME `--probe-cache` file (md5 `5be60f80415a6a74b054e832653d5f48`), which is what makes the cloud number comparable to the local one rather than merely adjacent |
| Cloud `ef_search` proves it changes cloud behaviour (D-15) | ⛔ **BLOCKED** | Same | Same, plus a second run with `--ef-search` raised |

**A blocked row is recorded with its reason, never silently dropped from a scoreboard.** No cloud
number is reported here, and specifically **no cloud number derived from vectors the local runs
never saw** — reporting one from a fresh embed would have been worse than reporting none.

⛔ **No bench corpus was built in cloud Supabase, at any scale, for any reason** (D-15). Nothing in
this phase connected to cloud at all; the parity evidence came through the operator's SQL editor.

---

## The before/after tables — the full local verdict

**Shape `none`** — the shipped search with no *extra* narrowing. The seven always-on predicates
(org gate, the three-arm visibility predicate, threshold, `is_latest`, `metadata @>`,
`p_folder_ids`, `p_embedding_model`) still fire; **there is no unfiltered path in this product**
(D-05). `recall_at_k` / `underfill`, 25 query vectors, seed 241, `k = 20`.

| Tenant share | **ef 40 (SHIPPED)** | ef 100 | ef 200 | ef 400 | ef 1000 | `relaxed_order` @ ef 40 | ef 400 + `relaxed_order` |
|---|---|---|---|---|---|---|---|
| **0.2%** | **0.040 / 0.960** | 1.000 / 0.000 | 1.000 / 0.000 | 1.000 / 0.000 | 0.926 / 0.074 | 0.494 / 0.500 | 1.000 / 0.000 |
| **2%** | **0.068 / 0.932** | 1.000 / 0.000 | 1.000 / 0.000 | 1.000 / 0.000 | 0.926 / 0.074 | 0.564 / 0.434 | 1.000 / 0.000 |
| **20%** | **0.360 / 0.588** | 0.976 / 0.024 | 1.000 / 0.000 | 1.000 / 0.000 | 0.982 / 0.018 | 0.684 / 0.214 | 1.000 / 0.000 |

Reports: `l1-skew{0.002,0.02,0.2}-{before-shipped,ef100,ef200,ef400,ef1000,iter-relaxed,ef400-relaxed}.json`.

**Shapes `folder` / `metadata` / `source_system`: `recall_at_k = 1.000` in all 63 shape-runs**, with
the scope-genuine under-fill given in the SC#2 section above.

Wall time per shape (both arms, 25 vectors): the `none` shape costs **26.7 s → 55.8 s** going from
ef 40 to ef 100 and stays ~51–63 s through ef 1000; the narrowed shapes sit at **20–32 s**
regardless of `ef_search` — consistent with them not being on the index path at all.

### Four things the ladder shows that a headline number would have hidden

**1. Selectivity is the driver, and it is monotone.** At the shipped configuration: 0.2% → 0.040,
2% → 0.068, 20% → 0.360. **Even a tenant owning a fifth of the corpus loses ~64% of the right
answers.** This is SEED-076's prediction, measured.

**2. `ef_search` is the primary lever and it is cheap.** `100` already repairs the two small
tenants completely; `200` repairs all three. There is no need to go near the maximum.

**3. ⚠ `iterative_scan = relaxed_order` ALONE IS NOT SUFFICIENT, and that is a correction to the
seed's own ordering.** SEED-076 §3 calls iterative scan *"the purpose-built pgvector answer to
filtered recall"*. At the shipped `ef_search = 40` it lifts recall from 0.040 → **0.494**, 0.068 →
**0.564**, 0.360 → **0.684** — a large improvement that still leaves **11–13 of 25 query vectors
under-filled**. Combined with `ef_search = 400` it reaches 1.000, but so does `ef_search = 200`
alone. **On this evidence `ef_search` is the lever and `iterative_scan` is the companion, not the
other way round.** ⚠ Its two memory companions (`hnsw.max_scan_tuples = 20000`,
`hnsw.scan_mem_multiplier = 1.0`) are hardcoded in `config.py` by D-09 and were **not** varied
here; they are the most likely explanation for the ceiling and that is a **hypothesis, not a
measurement**.

**4. ⚠⚠ THE CURVE IS NOT MONOTONE — `ef_search = 1000` IS MEASURABLY WORSE THAN 400, REPRODUCIBLY.**
Recall drops 1.000 → **0.926** at both the 0.2% and 2% tenants and 1.000 → **0.982** at 20%. This
was **not** noise and was checked rather than assumed:

- The degradation is **bimodal, not uniform**: 23 of 25 query vectors return a perfect 20/20, and
  **two return `ann_size` 2 and 1** out of an `exact_size` of 20.
- A full re-run on an unchanged bench reproduced it **exactly** — the same two vector indices, the
  same `ann_size` 2 and 1.
- It is the same two vectors in both small tenants, and one vector (`ann_size` 11) at 20%.

⛔ **This is reported as measured and is NOT explained.** No mechanism is claimed; the honest
statement is that raising `ef_search` to pgvector's maximum reproducibly starves a small minority of
queries where a middling value does not.

⭐ **The practical consequence is the useful part, and it is the reverse of the obvious advice:
"set it as high as it goes" is measurably wrong here. `200` is the value this evidence supports.**

⭐ **And the deeper consequence for anyone reading a recall number: an aggregate of 0.926 sounds
healthy and describes a system where two users in twenty-five get one or two results out of twenty.
Report the per-vector spread, never the mean alone.** That is the same lesson as ROADMAP failure
mode #3, arriving from the measurement side.

---

## The five ROADMAP failure conditions, each answered with its evidence

> **1. "Recall is fine" is asserted from spot checks, with no number anyone can reproduce.**

✅ **Answered.** 26 JSON reports under `reports/`, each carrying seed, sample size, pgvector and
PostgreSQL versions, the live and requested `hnsw.*` values and the caller's corpus counts. The
verbatim reproduction command is in SC#3 above. ⚠ **The starting position was worse than this
condition describes:** the Phase 230 harness *did* produce a reproducible number — `MRR 1.000` —
and it was structurally incapable of being anything else (241-CONTEXT F-1). A green number that
cannot go red is more dangerous than no number, and replacing it was 241-01's whole job.

> **2. The measurement runs only on local, and cloud has a different pgvector.**

🟡 **Half-answered, and the half that is answered is the one that mattered.** Cloud's pgvector was
**measured, not assumed**, and is at **exact parity** with local (0.8.0 / 17.6 / 40 / off). The
cloud *recall run* is ⛔ **BLOCKED on a DSN** and is recorded as such with its unblocking action.
⚠ And the planned parity test was itself refuted — see the correction above; it would have reported
a version gap that does not exist.

> **3. A filter silently truncates results and the only symptom is answers that are slightly worse.**

✅ **Answered — and this is exactly what was happening.** Layer 1's `underfill` column is the
truncation made visible: **0.960 / 0.932 / 0.588** at the shipped configuration
(`l1-*-before-shipped.json`). Layer 2 shows the user-facing symptom in the same run: three named
documents stop being found, with no error, no warning and a *faster* response
(`l2-bench-before-shipped.json`, 0.141 s). ⚠ **The truncation is on the UNNARROWED query**, not the
narrowed ones — see the SC#2 inversion above.

> **4. `hnsw.iterative_scan` is planned before parity is verified, and cannot be enabled where it matters.**

✅ **Answered.** Parity was verified **live, on cloud, before** the knob is claimed anywhere, and it
is available (0.8.0). 241-03's implementation applies each GUC in its own `try`, so an older server
degrades the *tuning* and never the *search*. ⚠ And measurement added something the condition did
not anticipate: **iterative scan alone does not close the gap** (see finding 3 above), so a plan
that had bet on it as *the* remedy would have shipped an insufficient fix onto a capable server.

> **5. This is the third phase to land on `retrieval_service.py` with the extraction still owed and nobody proposing it.**

✅ **Answered — 241 is the SECOND landing, and the obligation is recorded, not discharged.**
`docs/HOT-FILE-LEDGER.md` still reads **`extraction still OWED`** and the ROADMAP's *"a third must
propose the extraction first"* rule is intact. 241-03 kept the landing to **11 non-comment lines**
by putting the knob logic in a new module (`retrieval_tuning.py`), capped by a fence driven RED at
13, and wrote the obligation **into the file itself** so the next author cannot miss it.

---

## What is OWED — stated as a decision, not absorbed

| # | Owed | Why it is owed rather than done | When it comes due |
|---|---|---|---|
| 1 | **Cloud application of migration 176** | Not this phase's work. Cloud schema changes are a deploy-parity item under CLAUDE.md's standing rule that every prod push walks the DB + non-code checklist | At the **next operator-triggered deploy**. ⚠ Until then cloud has no `hnsw_ef_search` / `hnsw_iterative_scan` columns, so the Settings controls will read the `config.py` defaults there and the knobs cannot be changed in production |
| 2 | **The cloud AS-IS recall number, and the D-15 proof that the knobs change cloud behaviour** | No read-capable cloud DSN was supplied to the executor | Operator supplies a DSN; the command is in SC#3 and MUST use the same `--probe-cache` file |
| 3 | **An independent §6.3 review** | Claude built and Claude verified. The reviewer-who-did-not-shape-the-build does not exist for this phase (D-17) | Whenever a second agent is available. **241 joins 238 and 240 in this queue** |
| 4 | **The `retrieval_service.py` G-5 extraction** | Owed since Phase 231; 241 is the deliberate SECOND landing | A **third** landing must propose the extraction before adding behaviour |
| 5 | **The `ef_search = 1000` non-monotonicity** | Reproducible and unexplained. A mechanism was not claimed on the evidence available | Anyone tuning above 400, or a retrieval phase that runs `auto_explain` inside the `SECURITY DEFINER` body |
| 6 | **Per-tenant partial indexes / partitioning (SEED-076 §4)** | Its re-open trigger was *"the measured curve shows the two shipped levers insufficient at the measured skew"*. **The curve shows they ARE sufficient** — `ef_search = 200` reaches 1.000 at every measured selectivity — so the trigger has NOT fired | Re-opens if a measured install shows `ef_search` + `iterative_scan` insufficient at its own skew, or at a scale materially beyond 100,000 chunks, which this phase did not test |
| 7 | **Connection-by-id and saved-View filters (SC#2's two unbuilt axes)** | Nothing would call them today | `SEED-265`'s trigger: the first real surface that would narrow a search by connection or by saved View |

---

## Two things measured along the way that are not about recall

**1. ⛔ `supabase/full-schema.sql` produces a database nobody can read.** It is generated by
`pg_dump --no-privileges`, so it carries **no table ACLs at all**, and default privileges live in
`pg_default_acl`, which is **per-database** and therefore absent from any newly created database.
The 100k bench applied green, reported all three RPCs present and the HNSW index correct — and then
refused the harness's first read with `42501 permission denied for table documents`, because
`public.documents.relacl` was `NULL` where the real database reads
`{postgres=arwdDxtm/postgres,anon=…,authenticated=…,service_role=…}`. Fixed in the bench builder by
installing the real database's own default privileges (read back from `pg_default_acl`, not
invented) **before** the apply, plus a build-time guard that reads all four harness tables *as*
`authenticated` — driven RED against the genuinely ungranted bench before it was fixed.

⚠ **This says nothing bad about `full-schema.sql` as a one-paste Supabase bootstrap** — a real
Supabase project already carries those default privileges, so the paste inherits them. It is a
finding about using the artifact to build a **plain** Postgres database, which is what the bench
does and what a non-Supabase deployment would do.

**2. ⚠ `full-schema.sql:33` is `SET row_security = off;`** — pg_dump emits it, it is a **session**
setting, and it survives the apply. Every later statement issued on the connection that applied the
artifact runs with **RLS disabled**. Harmless for a one-paste deploy (the paste session ends);
a live trap for any program that applies the artifact and then keeps working on the same
connection. The bench builder now restores it explicitly rather than working around it.

⭐ **Both were found by RUNNING the artifact, not by reading it** — and 241-02 already recorded that
its smoke build was *"the first thing that has ever exercised `full-schema.sql` end to end"*. Two
more defects surfaced the second time it was exercised, on a path one grant wider.

---

## Provenance, and one number that moved

**The operator's live database was never written to by anything in this phase.** Proven three ways
rather than asserted:

1. The bench opens the source with **`default_transaction_read_only = on`**, reported back by the
   server as `on` for the whole run — the source is protected by Postgres, not by convention.
2. Every destructive statement in the builder interpolates a module constant and sits behind
   `assert_bench_target(...)`, enforced by an AST source fence (21 unit cases, `test_241_bench_safety.py`).
3. Each build re-reads the source counts on both sides of its own work and exits non-zero if they
   differ. Both builds reported **before == after**.

⚠ **The corpus DID change during the plan, and it was NOT the bench.** Measured at the plan's start:
**159 documents / 7,955 chunks**. Measured at its end: **160 / 7,959**. The delta is one document —
a `.eml` message, 4 chunks, owned by the operator's own user, created at **2026-09-10T04:00:56Z**,
which is inside the working window. The product ingested it: it is mail-shaped (Phase 240's path),
it is not in the bench's naming scheme (`bench-<label>-<n>.txt`) and it is not in a `bench-*` org.
**A live dev database is not a frozen object, and the property that matters — the bench never wrote
to it — holds regardless.** Stating the two readings and the cause is the honest version of
"unchanged".

⚠ **Two corpus counts appear in this document and they are both right.** The harness reports the
corpus **as the caller sees it under RLS** (`156 documents / 7,957 chunks` for the measuring user at
the end); the raw table holds `160 / 7,959`. The four extra documents and two extra chunks belong to
three leak-test orgs left behind by Phases 117 and 217.1. A report that quoted only one of these
numbers would look like drift the next time somebody counted.

---

## Requirement

**QUEUE-06** — *filtered vector search still returns the right chunks as the corpus grows, measured
repeatably on local and cloud.* **Satisfied on local with a reproducible instrument and a recorded
before/after; the cloud half is parity-verified and the cloud measurement is BLOCKED on a
credential, recorded above with its unblocking action.**
