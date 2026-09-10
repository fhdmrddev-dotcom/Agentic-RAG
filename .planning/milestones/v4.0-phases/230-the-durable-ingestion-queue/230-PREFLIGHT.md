---
phase: 230-the-durable-ingestion-queue
type: preflight
author: Claude (reviewer)
builder: Gemini
date: 2026-09-05
plans_reviewed: [230-01, 230-02, 230-03, 230-04, 230-05]
also_read: [230-CONTEXT.md, 230-DISCUSSION-LOG.md, 230-SEAM-AUDIT.md, 230-VALIDATION.md]
verdict: revise — 3 BLOCKING gaps, 1 same-commit violation, 1 owed sketch
---

# Phase 230 — Pre-flight

A gap pass, not a re-plan. Everything closes **inside the existing five plans**.

⭐ **The seam audit is again strong** — the mechanical field-derivation table now covers eleven fields
including the `INGEST_*` deploy-artifact row and the recall metrics. That table is why this review could
go straight to the mechanisms.

⚠ **But the verdict is `revise`, not `execute`, because the phase's HEADLINE success criterion currently
has no mechanism at all.** See G-1.

---

## 1. Verified correct — do NOT re-check

| # | Claim | Evidence |
|---|---|---|
| V-1 | **H-3 is honoured** — the queue is proven on `/upload` first | `230-04` is the `/upload` cutover (`test_230_upload_queue_cutover.py`) and **no adapter exists in this phase**, so the queue's first customer is the path with 30 phases of coverage. Exactly as briefed. |
| V-2 | Deploy-artifact parity is planned correctly | `230-03` carries `backend/.env.example`, `deploy/onebox.env.example`, `docker-compose.prod.yml` and `docs/OPERATOR.md` **in the same plan** as the `INGEST_*` vars in `config.py`. That is the same-commit rule honoured by construction. |
| V-3 | The batcher's ceiling is right | `230-02` slices to **≤ 200,000 tokens and ≤ 512 chunks**, a real margin under OpenAI's **300,000-token per-request** limit — the ceiling a naive batcher misses. `SEED-197` correctly identified as the subject. |
| V-4 | Migration `153` is free and correctly numbered | Highest existing is `152_*`. `153_ingestion_jobs.sql` is monotonic; gaps at 130-139 / 142-149 untouched. |
| V-5 | The breaker is reused, not rewritten | `230-03` calls the shipped `CircuitBreaker` / `CircuitBreakerTrippedError` (`circuit_breaker.py:86`, `:63`). No second breaker. |
| V-6 | D-2 is respected | Nothing in any plan performs an automatic cross-provider embedding swap. |

---

## 2. Gaps to close

### ⛔ G-1 (BLOCKING) — SC#1 has NO MECHANISM. `claimed_at` is written and never read.

**This is the phase's headline criterion:**

> *"A person uploads a batch of files, the backend restarts part-way through, and **every file still
> finishes** — none is left reading `processing` forever (QUEUE-01)."*

`230-01` creates `claimed_at TIMESTAMPTZ` (`:101`) and sets it on claim (`:133`:
`SET status = 'processing', claimed_at = now(), claimed_by = $2`). **Nothing ever reads it back.**
Grepping all five plans for `stale` / `sweep` / `reclaim` / `orphan` / `restart` returns **nothing**.

**The consequence, precisely:** the poller claims `status IN ('pending', 'retry_queued')`. A worker that
claims a job and is then killed leaves that row at `'processing'` **forever** — outside the poller's
predicate, with no path back. So a restart mid-batch **loses exactly the jobs that were in flight**, which
is the one thing SC#1 promises it will not do.

⚠ **This is verbatim the roadmap's own first failure bullet:** *"A killed worker leaves documents stuck in
`processing` with no way back — the exact state a restart was supposed to survive."*

**Close it by:** adding a stale-claim sweeper that returns jobs whose `claimed_at` is older than a lease
timeout to `'pending'` (and increments `retry_count` so a poison job still terminates). ⭐ **Do not invent
it** — `main.py:426` already runs exactly this shape for workflow runs; copy it, and name the lease
timeout as an `INGEST_*` var so it lands with the deploy artifacts already in `230-03`.

⚠ **And the test must actually kill something.** A unit test that calls the sweeper directly proves the
function, not the criterion. SC#1 needs a case that claims jobs, simulates the worker vanishing (drop the
claim without completing), and asserts every job reaches `completed`.

### ⛔ G-2 (BLOCKING) — `230-05` targets a directory that does not exist

`230-05` lists `frontend/src/components/documents/DocumentList.tsx` and
`frontend/src/components/documents/IngestionPauseBanner.tsx`.

**Measured: `frontend/src/components/documents/` is not a directory.** The real file is
**`frontend/src/components/ingestion/DocumentList.tsx`** — the same path the hot-file ledger carries.

**As written, `230-05` will create a new orphan directory containing a `DocumentList.tsx` that nothing
imports and an `IngestionPauseBanner.tsx` mounted inside it** — green tests, passing gate, and a pause
banner **no user can ever see**. That is this project's recorded "built, gated, green, structurally
unreachable" pattern (Phase 118 / Phase 200 SC#3).

**Close it by:** correcting both paths to `frontend/src/components/ingestion/`, and adding a reachability
assertion — the banner must be proven to render **from the route a person actually opens**, not from a
direct component mount.

### ⛔ G-3 (BLOCKING) — the recall harness will never run in any gate

`230-05` places the harness at **`tests/eval/test_retrieval_recall_baseline.py`** — repo root.

**Measured: `backend/pytest.ini` sets `testpaths = tests`, resolved relative to `backend/`.** So the
backend gate collects `backend/tests/**` and **never sees a repo-root `tests/` directory** — which does
not exist today either. The harness would be authored, committed, and executed by nothing.

⚠ The roadmap names the adjacent failure explicitly: *"The recall harness is deferred 'until there is a
corpus', so Phase 241 has no baseline to compare against."* **A harness that exists but never runs reaches
the same destination with extra steps** — and worse, it looks done.

**Close it by:** moving it under `backend/tests/` (e.g. `backend/tests/eval/`) so
`check-backend-unit-baseline.cjs` collects it, or stating explicitly which gate runs it and adding that
gate. ⚠ Note the baseline is **77 documents** — small, which is fine and is the point of taking it now,
but the harness should record the corpus size alongside the metric so Phase 241 compares like with like.

### G-4 — the hot-file ledger update is in the WRONG PLAN, breaking the same-commit rule

`230-03` (wave 2) modifies `backend/app/config.py` and `backend/app/main.py`.
`230-05` (wave 4) updates `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` for **those same two files**
(`230-05` must_have: *"G-5 hot files main.py and config.py are updated in both CLAUDE.md and
docs/HOT-FILE-LEDGER.md"*).

Different waves are different commits. CLAUDE.md's rule is that a row and its section move **in the same
commit** as the change they describe — Phase 229 got this right (`ba3010ffc`).

**Close it by:** moving the ledger update into **`230-03`**, the plan that actually touches those files.
`230-05` keeps only the ledger rows for files **it** modifies.

### G-5 — the G-2 sketch is genuinely owed, and only the operator can close it

`BUS-110` asks the reviewer to run `/gsd:sketch` for the paused state and the named refusal. **That request
is correct** — this phase's `UI hint` is `yes` and G-2 fires.

⚠ **But the acceptance bar for G-2 is an OPERATOR-APPROVED mockup**, not a reviewer-approved one. Neither
Gemini nor I can self-approve it. **`230-05` must not execute until that sketch exists and the operator has
accepted it** — the plan currently proceeds as though the surfaces were already specified.

**Close it by:** treating `230-05` as blocked on the sketch, and keeping waves 1-3 (backend) moving
meanwhile — they have no UI dependency.

---

## 3. Checks run and found clean

- **H-3 ordering** — honoured (V-1). This was the highest-risk thing to get wrong and it is right.
- **Deploy-artifact parity** — `230-03` carries all four artifacts with the vars (V-2).
- **No broker, no new process** — no plan adds a compose service or a worker process.
- **D-2** — no automatic cross-provider substitution anywhere.
- **Migration numbering** — `153`, monotonic, correctly named (V-4).
- **G-1 (phase-chain cap)** — does not fire; no `.N` insert proposed.
- **`user_setup`** — `[]` across all five plans, correct.

---

## 4. Verdict

**`revise` — three BLOCKING gaps. `G-1` is the one that matters: the phase's headline promise currently
has no implementation.**

Order:

1. **`G-1`** — add the stale-claim sweeper, copied from `main.py:426`, with a test that actually
   simulates a lost worker. Without it SC#1 is unmet regardless of what else ships.
2. **`G-2`** and **`G-3`** — two path corrections, minutes of work, but each one silently produces
   dead code that passes every gate.
3. **`G-4`** — move the ledger update into `230-03`.
4. **`G-5`** — waves 1-3 proceed; `230-05` waits on an operator-approved sketch.

⭐ **What is genuinely good here:** H-3 was honoured without prompting, the deploy artifacts ride in the
same plan as the vars they describe, the batcher targets the right ceiling, and the breaker is reused
rather than reinvented. The three blockers are all *"a mechanism is named but nothing reads it"* — the
same shape the field-derivation table is built to catch, applied one level deeper.

*Reviewed: 2026-09-05 · Builder: Gemini · Reviewer: Claude*
