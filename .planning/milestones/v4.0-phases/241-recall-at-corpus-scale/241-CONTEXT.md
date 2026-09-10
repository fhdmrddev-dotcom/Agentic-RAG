# Phase 241: Recall at Corpus Scale - Context

**Gathered:** 2026-09-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Answers stay correct when the corpus is large and every search is filtered — **measured**,
repeatably, on local and on cloud, rather than assumed because nothing looked wrong.

⚠ **THE PHASE'S OWN PREMISE IS FALSE AND THAT CHANGES ITS SHAPE.** ROADMAP says *"Its harness
ships at Phase 230"* and that this phase *"owns the tuning and the verdict"*. **Measured
2026-09-10: the Phase 230 harness exists as three files and cannot report a failure.** There is
no baseline. This phase owns **building the measurement, taking the verdict, AND shipping the
remedy as a product capability** — see F-1 below, which is the single most important finding here
and the reason the plan-count will not look like a tuning phase.

**In scope:**
1. A measurement that can fail — replacing the Phase 230 artifacts in place.
2. A bench corpus at scale, on local Docker, that never writes to the operator's real database.
3. The verdict: recall@k and under-fill, before/after, local and cloud.
4. The remedy shipped as a **product capability** — `hnsw.ef_search` + `hnsw.iterative_scan` as
   user settings, exposed in the existing Settings → Search & Retrieval → Retrieval card, with
   `config.py` holding only a minimal safe default.
5. Migration **176** (reserved): the two settings columns.

**Out of scope:** retrieval *quality* (embedding model, re-ranker, hybrid weights, chunking) —
SEED-076 says explicitly *"do not conflate"* with SEED-020. Adding new retrieval filter
parameters that no surface would call (see D-13). Any bench corpus in cloud Supabase.

</domain>

<decisions>
## Implementation Decisions

### The measurement (SC#1, SC#3)

- **D-01: The Phase 230 harness is REPLACED IN PLACE, not extended.** `scripts/measure-recall.py`,
  `backend/app/services/recall_eval.py` and `backend/tests/eval/test_retrieval_recall_baseline.py`
  are rewritten. Leaving them beside a real harness would leave a second, greener number in the
  tree for someone to quote. `EVAL_PROBES` gets **one** home — it is currently duplicated verbatim
  across two files, which is drift waiting to happen.

- **D-02: A miss is `None`. Never rank 1.** The current script scores an un-found target as
  `rank = 1` under the comment `# Standard ground truth baseline`. That is the defect that makes
  the metric structurally unable to fail.

- **D-03: An unmeasurable run EXITS NON-ZERO. It never prints a number.** The current script
  catches a connection failure and prints a hardcoded `mock_ranks` synthetic benchmark, then
  returns 0. *Could not measure* and *measured, and it was fine* must never share an exit code —
  this is the `resolve_template_placeholders` / `retrieval_unavailable` shape this codebase
  already applies twice elsewhere.

- **D-04: TWO LAYERS, because SC#1 and SC#2 are different questions.**
  - **Layer 1 — mechanical (SC#2).** For each query vector × each filter shape: `exact` = the true
    top-k under the **same `WHERE`**, forced off the index; `ann` = what `match_document_chunks`
    actually returns. Report `recall@k = |ann ∩ exact| / |exact|` and `underfill = 1 − |ann|/k`.
    Deterministic, needs no judgement, cannot self-score, and it is **literally SC#2's sentence**.
  - **Layer 2 — semantic (SC#1).** The 10 existing probes driven through the real path, scored
    honestly, **before and after growth** — literally SC#1's *"the same questions that worked at
    small scale still work, and the before/after numbers are on record"*.

- **D-05: "Unnarrowed" means EXACT k-NN UNDER THE SAME PREDICATE — not "no filter".** Measured:
  `match_document_chunks` (mig 154:148-174) applies **seven** predicates inside the
  `ORDER BY … <=> … LIMIT` scan — org gate, the three-arm visibility predicate, threshold,
  `is_latest`, `metadata @>`, `p_folder_ids`, `p_embedding_model`. The last two always fire
  (`retrieval_service.py:78` always passes a model, defaulting to `text-embedding-3-small`).
  **There is no unfiltered path in this product**, so SC#2 cannot be read as filtered-vs-unfiltered.

- **D-06: The unit test pins the ARITHMETIC and the HONESTY, never the environment.** It must
  drive the honest-miss arm and the cannot-connect arm **RED against a planted defect** — a guard
  nobody has seen fire is not a guard. It must **not** assert a corpus size or a recall threshold:
  `assert count == 77` is RED right now against the live 159 documents, and it is invisible to the
  canonical gate because `tests/eval` is not `tests/unit`. Environment facts belong in the report,
  not in a test.

### The bench corpus (SC#1)

- **D-07: A throwaway `recall_bench` database on the LOCAL Docker Postgres. The operator's real
  database is never written to.** Operator direction, verbatim: *"as long as it is on my local
  docker it's OK for testing we are just testing"*.
  - Built from **`supabase/full-schema.sql`** — the project's own bootstrap artifact — so the RPC
    measured is the **real** function, byte-identical, not a hand-copied one. Confirmed present:
    `grep -c connection_doc_is_visible supabase/full-schema.sql` → 9.
  - **ONE documented delta:** `full-schema.sql` references `auth.uid()` in 143 places but only
    creates schema `public`. The bench needs a faithful `auth.uid()` stub reading
    `request.jwt.claims` — which is exactly the GUC `get_user_pg_connection` already sets
    (`dependencies.py:176`). It is the only difference from production and it is named here so it
    is never discovered as a surprise.
  - Teardown is `DROP DATABASE recall_bench`. Side benefit: this is the first thing that has ever
    exercised `full-schema.sql` end-to-end.

- **D-08: Vectors by PERTURBING the 7,953 real embeddings — no provider calls.** Zero cost, real
  cluster geometry (uniform random vectors would make HNSW recall unrepresentative), **and no
  SEED-197 exposure at all** — nothing calls `embed_texts`, so the 2048-input cap is never
  approached. Synthetic rows carry short/empty content to keep the volume feasible.
  - **The real 159 documents' chunks are copied in verbatim** (real vectors, real content) and the
    synthetic bulk is built around them, so the Layer-2 probes resolve to real targets and
    "before/after" is the same probes against the same targets at two corpus sizes.
  - **Scale target ~250k chunks (≈3.5–4 GB), and the framing is stated, not glossed.** The collapse
    is driven by **selectivity**, not raw size: a tenant owning 0.2% of 250k chunks starves
    `ef_search = 40` exactly as one owning 0.2% of 20M does. Measured cost basis:
    `document_chunks` is **155 MB / 7,953 chunks** with a **68 MB** HNSW index → ~19.5 KB stored
    and ~8.5 KB indexed per chunk. ⚠ **VALIDATION.md must SAY we measured selectivity-driven
    collapse at a feasible size** — never claim a 10M-chunk install was reproduced on a laptop.

### The remedy — a PRODUCT CAPABILITY, not a tuning constant (operator direction)

Operator direction, verbatim: *"on [real] production we should have for the full capability and we
should again have this configuration allowed in the UI somehow with a minimal configuration in the
hard coded values"*.

- **D-09: `hnsw.ef_search` and `hnsw.iterative_scan` ship as USER SETTINGS, surfaced in the
  existing Settings UI.** `max_scan_tuples` and `scan_mem_multiplier` stay as minimal hardcoded
  defaults in `config.py` — they matter only once iterative scan is ON, and a wrong value there is
  a memory footgun rather than a tuning choice with a safe `NumberInput` bound.
  - This follows CLAUDE.md's standing rule: *settings live in `user_settings` / `app_settings` and
    the Settings UI; env vars are for secrets and infra only.*

- **D-10: The GUC seam is `SET LOCAL` inside the transaction that already exists — VERIFIED SAFE
  BEFORE BEING RECOMMENDED.** `get_user_pg_connection` (`dependencies.py:174-177`) already does
  `async with conn.transaction()` and already issues `SET LOCAL`s; *"the COMMIT at context exit
  auto-reverts every `SET LOCAL`"*. So the knobs cannot leak to the next borrower of the pooled
  connection. **This was the one thing that could have made the whole remedy unsafe, and it does
  not.**

- **D-11: The UI-configurable path COSTS the G-5 landing, and that trade is taken deliberately.**
  A migration-baked function-level `SET hnsw.ef_search` would need **zero** Python — but it cannot
  be changed from the UI, which is exactly what the operator asked for. Making it a setting means
  ~3 lines in `retrieval_service.py`'s `_call_as_user`. That is the **second** milestone landing on
  a file whose extraction has been **owed since 231**. Permitted (ROADMAP forbids a *third* without
  proposing the extraction first) — **and the extraction stays owed. Record it; do not let this
  phase's landing read as a discharge.**

- **D-12: Migration 176 (already reserved) carries the two settings columns.** Apply by pasting
  into the Supabase SQL editor — never `db push` / `db reset` — then
  `bash scripts/regenerate-full-schema.sh` (no `--reset`). ⚠ The bench in D-07 reads
  `full-schema.sql`, so **regenerating it is not optional bookkeeping here — the bench depends on
  it being current.**

### SC#2's filter axes

- **D-13: Measure the three axes that EXIST; record the two that do not, with a seed.**
  - **Reachable, and measured:** `p_folder_ids` (folder) · `metadata @>` (arbitrary metadata) ·
    **`source.system`** — `metadata->'source'` is a nested object
    (`{path, system, version, external_id}`), so `{"source":{"system":"google"}}` works through
    jsonb containment. Measured on the live corpus.
  - **NOT reachable:** connection-by-id and saved View. `search_documents` accepts only
    `metadata_filter` and `folder_ids`; `source_connection_id` and `source_system` are **not**
    metadata keys (live keys measured: `title, summary, document_type, topics, language, author,
    date, source, email_*`).
  - **The filter is NOT built.** Nothing today — no UI, no tool schema, no caller — would invoke a
    connection filter. A filter exercised by the harness and by nothing else is the *"green fence
    beside a shipped defect"* / presence-without-behaviour shape this project has now paid for
    repeatedly. **SC#2 is scored honestly-partial in VALIDATION.md, with the reason, and a seed
    carries the gap forward with a trigger.**

### Cloud (SC#3)

- **D-14: Parity check FIRST, and it gates the remedy.** ROADMAP is explicit and it is right:
  `hnsw.iterative_scan` may not be planned as the SEED-076 remedy until pgvector parity is
  **verified live**. Measured local 2026-09-10: **pgvector 0.8.0, PostgreSQL 17.6** — iterative
  scan is available *here*. **Cloud is UNVERIFIED.** If cloud is < 0.8, `iterative_scan` is
  unavailable there and `ef_search` alone carries production. Operator-assisted (cloud SQL editor).

- **D-15: Measure cloud AS-IS, and prove the knobs take effect there.** The same script against the
  cloud DSN at whatever scale cloud holds, plus evidence the new settings actually change cloud
  behaviour. SC#3 asks for a **reproducible number on cloud** so a later regression is detectable —
  it does not ask for cloud to be at bench scale. **No bench corpus is built in cloud Supabase.**

- **D-16: One script, `--dsn`, one command everywhere.** The current script hardcodes
  `postgresql://postgres:postgres@127.0.0.1:54322/postgres` at module scope, so SC#3 is
  unsatisfiable by construction. A JSON report lands beside the verdict line so a number can be
  diffed rather than re-read.

### Execution model

- **D-17: SOLO. Claude builds AND verifies; the verdict is labelled a SELF-verification.**
  Operator direction: no bus, no Gemini, end to end. CLAUDE.md requires that *whoever REVIEWS a
  phase must not have shaped the build*; alone that **cannot** be satisfied. `/gsd:code-review`
  runs over the diff and the result is recorded in VERIFICATION.md **explicitly as a
  self-verification, not an independent §6.3 review**. ⚠ Do not route bus items `--to gemini`.
  Operator-owed items batch to the end.

### Claude's Discretion

- Plan decomposition (G-8: target 3–5 plans; overhead is per-plan).
- The exact perturbation function, the tenant-skew ladder, and the query-vector sample size —
  chosen to make the curve legible, reported with whatever was chosen.
- Report shape and file location, subject to D-16.
- Whether Layer 1 forces the exact arm off-index via `enable_indexscan` or a distinct query form.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The phase's own contract
- `.planning/ROADMAP.md` → `#### Phase 241: Recall at Corpus Scale` — goal, 3 success criteria,
  `## How we'd know this failed`. ⚠ **Two of its Flags are measured STALE — see `<specifics>` F-7
  and F-8. Read them there before quoting the ROADMAP.**
- `.planning/REQUIREMENTS.md:79` — QUEUE-06, the phase's only requirement.

### The seeds this phase folds
- `.planning/seeds/SEED-076-filtered-vector-search-recall-pgvector-index-scale.md` — **the
  substantive spec for this phase.** Its "Likely shape if promoted" §1–3 is the plan skeleton:
  harness first, then `ef_search`, then iterative scan. Its lever table is confirmed still
  accurate — all four levers remain untaken.
- `.planning/seeds/SEED-197-embed-texts-sends-every-chunk-in-one-request.md` — folded by ROADMAP. ⚠ **D-08 removes the
  exposure rather than fixing it**: no bench path calls `embed_texts`. If planning ever reverts to
  a real-embedding corpus, this seed becomes live and its 2048-input cap binds.

### The code under measurement
- `backend/app/services/retrieval_service.py` (**18 / 10 / 423**) — `_vector_search:56-94`,
  `_call_as_user:36-53`, `search_documents:335-423`. **G-5 fires; extraction owed since 231.**
- `supabase/migrations/154_connection_scoped_visibility.sql:148-174` — the current
  `match_document_chunks`. **The seven-predicate scan is here.** `:176-204` is
  `keyword_search_chunks`.
- `supabase/migrations/002_module2_byo_retrieval.sql:35-37` — the HNSW index, `m=16,
  ef_construction=64`. Sound; untouched by this phase.
- `backend/app/dependencies.py:159-177` — `get_user_pg_connection`. **The transaction that makes
  `SET LOCAL` safe (D-10).**
- `backend/app/config.py:925-940` — the retrieval defaults, including
  `hybrid_candidate_count = 20`.

### The artifacts being replaced
- `scripts/measure-recall.py` · `backend/app/services/recall_eval.py` ·
  `backend/tests/eval/test_retrieval_recall_baseline.py` — **read all three before planning; F-1
  is not obvious from their names.**

### The settings seam being extended
- `frontend/src/pages/SettingsPage.tsx:1357` (Tab 1 "Search & Retrieval"), `:1490-1496`
  (`<SectionCard title="Retrieval">`) — the card the two knobs join.
- `backend/app/models/user_settings.py:140-149`, `:933-941` — the `_val(row, …)` fallback pattern
  the two new settings follow.
- `supabase/full-schema.sql` — **the bench's build input (D-07), not just a deploy artifact.**

### Project rules that bind this phase
- `CLAUDE.md` → *Rules* (settings live in `user_settings`/`app_settings`, not env vars; migrations
  via SQL editor then `regenerate-full-schema.sh`), *Workflow guardrails* (**G-5** hot files,
  **G-7** gap-closure cap, **G-8** plan-count proportion), *UAT scoreboard recipe*, *Backend unit
  testing baseline gate*.
- `docs/HOT-FILE-LEDGER.md` → `backend/app/services/retrieval_service.py` — the named seam and the
  binding invariants. **Read before the D-11 landing.**
- `docs/PLANNING-PROPORTION.md` — G-8's evidence base.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`compute_metrics`** (`recall_eval.py:57-77`) — the Hit@K / MRR arithmetic is **correct and
  already unit-tested**, including the `None`-is-a-miss case. Keep it; it is the one part of the
  Phase 230 work that does its job. The defect is entirely in what feeds it.
- **The 10 `EVAL_PROBES`** — real filenames in the operator's real corpus. Reusable for Layer 2
  once de-duplicated to one home and scored honestly.
- **`get_user_pg_connection`** — supplies the transaction, the role swap and both GUC forms. The
  `SET LOCAL` seam needs no new plumbing.
- **`supabase/full-schema.sql`** — a complete, current, single-file schema. It makes the bench a
  fidelity win instead of a fidelity compromise.
- **`SectionCard` + `NumberInput`** in `SettingsPage.tsx` — the two knobs are additions to a
  shipped card, not a new surface.

### Established Patterns
- **`_val(row, …, default)`** — `user_settings` → `app_settings` → `config.py` fallback. Both new
  settings follow it exactly; the `config.py` default is the "minimal hardcoded value".
- **`SET LOCAL` inside the request transaction** — already how role and JWT claims are applied.
- **Honest third state** — `retrieval_unavailable` (`tool_dispatcher.py:735-786`) and Phase 193.1's
  `resolve_template_placeholders`: *could not read* and *nothing to read* never share a message.
  **D-03 is the third application of this exact rule in this codebase.**
- **Migration discipline** — numbered file, SQL editor, then regenerate. 176 is reserved.

### Integration Points
- `retrieval_service._call_as_user` (or `_vector_search`) — the ~3-line `SET LOCAL` landing (D-11).
- `user_settings.py` model + `_val` mapping + migration 176 columns.
- `SettingsPage.tsx` Retrieval card + its save payload (`:853-856`).
- `scripts/measure-recall.py` — rewritten; the only entry point for both layers, local and cloud.
- ⚠ **`tests/eval` is NOT in the canonical gate** (`pytest tests/unit`). The honesty guard (D-06)
  must live somewhere `tests/unit` collects, or it is a guard nobody runs.

</code_context>

<specifics>
## Specific Ideas

**Everything below was MEASURED on 2026-09-10, not reasoned about.** Re-derive rather than doubt.

### F-1 ⛔ The Phase 230 harness cannot report a failure — the finding that reshapes this phase
- `scripts/measure-recall.py` **never touches the vector path**. It runs
  `content ILIKE '%token%'` on `document_chunks`. No embedding, no `match_document_chunks`, no
  filter, no vector.
- Every miss scores `rank = 1` (`# Standard ground truth baseline`, `:127`). **Run live against
  the 159-document corpus: `Hit@1 1.00 · Hit@3 1.00 · Hit@5 1.00 · MRR 1.000`.** That output is
  structurally incapable of being anything else.
- On a DB failure it prints a hardcoded `mock_ranks = [1,1,2,1,1,3,2,1,1,2]` benchmark and
  **returns 0**.
- `test_retrieval_recall_baseline.py`'s only measurement asserts `Hit@5 >= 0.80` against a literal
  `simulated_ranks` list — the same ten numbers.
- Its precondition `assert count == 77` is **RED right now** (159 actual) and invisible to the
  canonical gate, because `tests/eval` is not `tests/unit`.
- `EVAL_PROBES` is duplicated verbatim across `recall_eval.py` and `measure-recall.py`.

⭐ **The consequence for planning:** ROADMAP's failure mode #1 is *"'Recall is fine' is asserted
from spot checks, with no number anyone can reproduce."* The live state is **worse** — there **is**
a reproducible number, it is perfect, and it is meaningless. A plan that treats 230 as a baseline
will tune against nothing.

### F-2 The starved configuration, read live from the server
```
hnsw.ef_search = 40      hnsw.iterative_scan = off      pgvector 0.8.0      PostgreSQL 17.6
```
`hybrid_candidate_count = 20` (`config.py:930`). The scan walks 40 global candidates, discards
with seven predicates, then takes 20. **That is the collapse mechanism, stated concretely enough
to measure.** pgvector 0.8.0 means `iterative_scan` is available **locally**; cloud is unverified
(D-14).

### F-3 SEED-076's levers are all still untaken
`grep -rn "ef_search|iterative_scan"` over `supabase/migrations/` and `backend/app` → **zero
matches**. Only the five `USING hnsw (...)` index definitions appear.

### F-4 Every query is already a filtered query
Seven predicates inside the `ORDER BY … <=> … LIMIT` at mig 154:160-170. `is_latest` and
`p_embedding_model` always fire. **There is no unfiltered path** → D-05.

### F-5 Corpus as it stands
159 documents (153 latest, 6 non-latest) · **7,953 chunks** · 3 distinct users · 3 distinct orgs ·
one embedding model (`text-embedding-3-small`) · 66 connection-sourced · 71 foldered.
`document_chunks` **155 MB**, `document_chunks_embedding_idx` **68 MB**.
⚠ Tenant skew is ≈1/3 each — **precisely the shape SEED-076 says hides the defect** (*"one user
IS the whole table"*). The bench must create the skew; the real corpus cannot show it.

### F-6 SC#2 names two axes that do not exist → D-13
Live metadata keys: `title(145) summary(142) document_type(135) topics(134) language(134)
_confidence(126) author(90) date(86) source(63) email_*(28) _classification(8) _vision(7)
attachments(5) contract_value(3) _takeoff(3) _images(1)`. **No `source_system`. No
`source_connection_id`.** But `metadata->'source'` is a nested object, so
`{"source":{"system":"google"}}` **does** work via jsonb containment — one of the three axes is
reachable after all.

### F-7 ⚠ THE ROADMAP'S SEED-224 HOOK IS ALREADY DISCHARGED — do not plan work for it
ROADMAP Flags claim `retrieval_service.py` *"computes a per-hit similarity and drops it"* and call
surfacing it *"the cheapest honest instrumentation available"*. **That was fixed at Phase 217.1
(BE-5).** Per-hit similarity now travels in `citations[].similarity`
(`tool_dispatcher.py:825`) and in `audit_log.metadata.similarities` (`:860-870`), max-per-document
to 3 dp. **The instrumentation is already installed.** The ROADMAP text is stale, not wrong about
what would have been useful.

### F-8 ⚠ THE ROADMAP'S G-5 TRIPLE IS STALE
ROADMAP says `retrieval_service.py` is `17 / 9 / 362`. **Re-derived from git 2026-09-10 with the
CLAUDE.md recipe: `18 / 10 / 423`.** `docs/HOT-FILE-LEDGER.md`'s row is the current one. G-5 fires
either way; the count matters because the ROADMAP's *"third landing must propose the extraction
first"* rule is counted against it.

### F-9 Backend baseline, measured at the phase's start
`pytest tests/unit -q --continue-on-collection-errors` →
**71 failed · 4374 passed · 2 xfailed · 2 xpassed · 0 collection errors · 181 s.**
**At the ceiling with ZERO headroom.** Any new failure breaks the gate. (CLAUDE.md's `3497 passed`
is the v4.0-lock figure; the passed count has grown, the 71 has not.)

### Cross-check sweeps (CLAUDE.md MANDATORY)
- **Reported bugs:** 29 open `surface: Agentic-RAG` reports listed and read. **None overlaps
  retrieval, recall or vector search.** Nothing folds. Nearest miss — `BUG-260908-01` (chunks
  section unbounded) — is a frontend panel-layout defect, not a retrieval one.
- **Seeds:** 22 planted seeds mention retrieval. **SEED-076** and **SEED-197** fold (per ROADMAP).
  **SEED-020 / 059 / 087 / 153 / 243 are retrieval QUALITY and are explicitly NOT this phase** —
  SEED-076 itself says *"do not conflate"*. See `<deferred>`.

</specifics>

<deferred>
## Deferred Ideas

- **Connection-by-id and saved-View retrieval filters** (D-13) — the SC#2 gap. Plant a seed at
  execution with a concrete trigger: *the first surface (UI control, tool-schema parameter, or
  workflow binding) that would actually narrow a search by connection or by saved View.* Building
  the filter before that trigger ships a parameter with no caller.
- **`retrieval_service.py` extraction** (G-5, owed since 231) — **still owed after this phase.**
  D-11 is a deliberate second landing, not a discharge. A third landing must propose the extraction
  first, per ROADMAP.
- **SEED-243 — "find the document, not just the answer"** — its `trigger_when` says it fires
  *immediately on the next milestone definition*. That is `/gsd:new-milestone`, not here: v4.0's
  scope is closed and folding it would be a new capability inside the milestone's last phase.
  Leave `planted`; it is a genuine candidate REQ-ID for the next milestone.
- **SEED-020 / 059 / 087 / 153** — retrieval quality (embedding model, re-ranker, exact-identifier
  keyword semantics, dimensions-must-be-filters). Orthogonal by SEED-076's own instruction. Leave
  planted; triggers intact.
- **Per-tenant partial indexes / table partitioning** — SEED-076 §4. Deliberately *after* the
  measurement: the seed's own §1 says every lever is chosen against the measured curve, not an
  estimate. Re-open trigger: the curve shows `ef_search` + `iterative_scan` insufficient at the
  measured skew.
- **`retrieval_events` substrate** (SEED-224) — the Retrieval tab's honest half. Not this phase;
  this phase measures recall offline, it does not log production retrievals.
- **SEED-197's actual fix** (batching `embed_texts`) — D-08 sidesteps the exposure rather than
  fixing it. If a future phase adds a second high-fan-out embedding caller, or a real spreadsheet
  produces > ~1,500 table chunks, the seed's own trigger fires and the fix is owed.

</deferred>

---

*Phase: 241-Recall at Corpus Scale*
*Context gathered: 2026-09-10*
