# Phase 241: Recall at Corpus Scale - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-10
**Phase:** 241-recall-at-corpus-scale
**Areas discussed:** Corpus growth · Ground-truth definition · SC#2's filter axes · Verdict home + cloud · Retrieval knobs in the UI · Solo execution / review obligation

---

## Round 0 — the scout, before any question was asked

The phase was scoped by ROADMAP as *"the harness ships at Phase 230; this phase owns the tuning
and the verdict."* The scout read the three Phase 230 artifacts and **ran them**, which changed
what the discussion was about:

- `scripts/measure-recall.py` executed live → `Hit@1 1.00 · Hit@3 1.00 · Hit@5 1.00 · MRR 1.000`,
  because every miss is scored `rank = 1`.
- `pytest tests/eval` executed live → `1 failed, 3 passed`; the failure is `assert count == 77`
  against 159 actual documents.
- Server GUCs read live → `hnsw.ef_search = 40`, `hnsw.iterative_scan = off`, pgvector `0.8.0`,
  PostgreSQL `17.6`.
- Backend baseline run → `71 failed / 4374 passed`, at the ceiling with zero headroom.

⭐ **This is why no question in this log asks "should we build a harness?"** — the premise that one
existed was refuted before the operator was asked anything, and the four areas offered were the
ones that remained genuinely open afterwards.

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Growing the corpus to scale | Perturb existing embeddings vs. generate + embed real text; real DB vs. throwaway | ✓ |
| What "the right documents" means | Exact brute-force k-NN as ground truth vs. curated probe set | ✓ |
| SC#2's missing filter axes (F-6) | Measure what exists vs. add connection/source scoping | ✓ |
| Where the verdict lives + cloud (SC#3) | Script vs. gated pytest; how cloud gets measured | ✓ |

**User's choice:** all four.

---

## Corpus growth

**Not asked as a multiple choice in the end** — the operator answered it in free text before the
question was put, and added a new requirement with it.

**User's words:** *"like as long as it is on my local docker it's OK for testing we are just
testing but on rail ['real'] production we should have for the full capability and we should again
have this configuration allowed in the UI somehow with a minimal configuration in the hard coded
values"*

**Read as two separate instructions, and both were acted on:**
1. The **bench** is a test rig — local Docker is fine, size and teardown are not worth agonising
   over. → `recall_bench` database from `full-schema.sql` (D-07), ~250k chunks by perturbing real
   vectors (D-08). The operator's real database is never written to.
2. The **remedy** is a product capability — on real production it ships in full, and the tuning is
   **UI-configurable** with only a minimal hardcoded default. → D-09 / D-10 / D-11 / D-12.

**Notes:** The second instruction changed the recommended remedy shape. The pre-existing
recommendation was a *migration-baked* function-level `SET hnsw.ef_search`, chosen specifically
because it needs **zero** Python and therefore avoids a second G-5 landing on
`retrieval_service.py`. That option cannot be changed from the UI, so it was dropped in favour of
`SET LOCAL` inside the request transaction — accepting the G-5 landing deliberately and recording
that the extraction stays owed (D-11).

Before recommending it, two seam checks were run rather than assumed:
- `SettingsPage.tsx:1490-1496` — the `<SectionCard title="Retrieval">` the knobs join **exists**.
- `dependencies.py:174-177` — `get_user_pg_connection` already opens `conn.transaction()` and
  already issues `SET LOCAL`s, so the GUCs auto-revert at COMMIT and cannot leak to the next
  borrower of the pooled connection. **This was the one thing that could have made the remedy
  unsafe.**

---

## Ground-truth definition

**Not put to the operator as a choice.** Both layers were recommended and neither was contested;
the mechanical layer is a restatement of SC#2's own sentence rather than a design preference.

| Option | Description | Selected |
|--------|-------------|----------|
| Exact brute-force k-NN under the same WHERE | Geometric, deterministic, cannot self-score; is literally SC#2 | ✓ (Layer 1) |
| Curated probe set with known answers | Semantic; is literally SC#1's "the same questions still work" | ✓ (Layer 2) |
| One or the other | — | |

**Notes:** The rule that carries the weight is not which layer, but D-02 and D-03 — a miss is
`None`, and an unmeasurable run exits non-zero. Those two are what separate the new harness from
the one being replaced. D-03 is the **third** application in this codebase of the *could-not-read
≠ nothing-to-read* rule (after `resolve_template_placeholders` and `retrieval_unavailable`).

---

## Retrieval knobs in the Settings UI

| Option | Description | Selected |
|--------|-------------|----------|
| ef_search + iterative_scan | UI: candidate budget + scan mode. Hardcoded: max_scan_tuples, scan_mem_multiplier — memory footguns with no safe NumberInput bound | ✓ |
| All four pgvector knobs in the UI | Full control; two of them can make a query allocate hard | |
| One named "Recall profile" select | Fast / Balanced / Thorough; least rope, but no off-profile tuning without a code change | |

**User's choice:** ef_search + iterative_scan.
**Notes:** Matches the operator's own phrasing — *"minimal configuration in the hard coded
values"* — and CLAUDE.md's standing rule that settings live in `user_settings` / `app_settings`
and the Settings UI, with env vars reserved for secrets and infra.

---

## SC#2's filter axes

| Option | Description | Selected |
|--------|-------------|----------|
| Measure what exists, seed the gap | Measure folder + metadata + source.system; record connection-by-id and saved View as unreachable, with a seed and a trigger | ✓ |
| Add connection scoping to the search path | ~3 lines in the RPC + one kwarg; all four named axes measurable — but ships a filter with no UI, no tool schema and no caller | |

**User's choice:** measure what exists, seed the gap.
**Notes:** The scout found that one of the three "unreachable" axes is in fact reachable —
`metadata->'source'` is a nested object, so `{"source":{"system":"google"}}` works through jsonb
containment. That narrowed the gap from three axes to two before the question was asked. The
argument against building the filter is this project's own repeated finding: a fence exercised by
the harness and by nothing else is presence without behaviour.

---

## Verdict home + cloud

| Option | Description | Selected |
|--------|-------------|----------|
| Parity check + measure cloud as-is + prove the knobs apply | Verify pgvector version and GUCs on cloud BEFORE planning iterative_scan as the remedy; then the same script against the cloud DSN at cloud's own scale | ✓ |
| Also build a bench corpus on cloud | Symmetric numbers, but writes hundreds of thousands of rows into the Supabase project backing production | |
| Parity check only, record SC#3 partially unmet | Cheapest and honest, but SC#3's "get a number on cloud" goes down as unmet | |

**User's choice:** parity check + measure cloud as-is + prove the knobs apply.
**Notes:** The ROADMAP's own flag demands the parity check gate the remedy, and it was right to:
local measured pgvector **0.8.0** (iterative scan available), cloud is unverified. If cloud is
< 0.8, `ef_search` alone carries production and that must be discovered before planning, not after.
D-16 also records that the current script hardcodes a local DSN at module scope, which makes SC#3
unsatisfiable by construction.

---

## Solo execution / review obligation

| Option | Description | Selected |
|--------|-------------|----------|
| Self-review, labelled as such | /gsd:code-review over the diff, recorded in VERIFICATION.md explicitly as a SELF-verification, not an independent §6.3 review | ✓ |
| Self-review + operator launches /code-review ultra | Adds a genuine independent multi-agent pass Claude cannot start itself | |

**User's choice:** self-review, labelled as such.
**Notes:** Operator direction was *"there is no bus at this phase you will implement alone no
Gemini at all so you will execute it end to end"*. CLAUDE.md requires that whoever reviews a phase
must not have shaped the build; solo, that cannot be satisfied. The decision is therefore to state
the limitation in VERIFICATION.md rather than let a solo pass read as independent. Bus items are
not routed `--to gemini`; operator-owed items batch to the end.

---

## Claude's Discretion

- Plan decomposition (G-8 targets 3–5 plans; overhead is per-plan).
- The perturbation function, the tenant-skew ladder, and the query-vector sample size.
- Report file shape and location, subject to D-16 (`--dsn`, JSON beside the verdict line).
- Whether Layer 1's exact arm is forced off-index via `enable_indexscan` or a distinct query form.

## Deferred Ideas

- Connection-by-id and saved-View retrieval filters — seed with a trigger: the first surface that
  would actually narrow a search by connection or saved View.
- `retrieval_service.py` extraction (G-5) — **still owed after this phase**; D-11 is a deliberate
  second landing, not a discharge.
- SEED-243 (*find the document, not just the answer*) — its trigger fires at
  `/gsd:new-milestone`, not inside v4.0's last phase. Left `planted`.
- SEED-020 / 059 / 087 / 153 — retrieval *quality*; orthogonal by SEED-076's own instruction.
- Per-tenant partial indexes / partitioning — SEED-076 §4, deliberately chosen against the
  measured curve rather than before it.
- `retrieval_events` substrate (SEED-224) — not this phase.
- SEED-197's actual fix (batching `embed_texts`) — D-08 removes the exposure rather than fixing it.

## Corrections recorded during discussion

Two ROADMAP Flags for this phase were measured **stale** and are corrected in CONTEXT.md rather
than carried forward:

- **F-7** — the SEED-224 hook (*"computes a per-hit similarity and drops it… the cheapest honest
  instrumentation available"*) was **already discharged at Phase 217.1 (BE-5)**. Per-hit
  similarity travels in `citations[].similarity` and `audit_log.metadata.similarities`. No work is
  owed for it.
- **F-8** — the G-5 triple reads `17 / 9 / 362`; re-derived from git it is **`18 / 10 / 423`**.
  The count matters because the ROADMAP's *"a third landing must propose the extraction first"*
  rule is counted against it.
