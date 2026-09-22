---
seed_id: SEED-299
title: "A stranded Deep chat run's token count is unrecoverable — run_reconciler.py:245 writes NULL because the in-memory usage box died with the producer process"
created: 2026-09-18
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: >
  Any phase that adds MID-STREAM token persistence to the chat path (a per-turn or
  per-iteration write of the usage box to runs.input_tokens rather than only at
  finalize) — which is the only thing that would make this number knowable. Also
  fires if METER-07 reports an unacceptable share of orphaned runs as uncounted.
trigger_paths:
  - "backend/app/services/run_reconciler.py"
  - "backend/app/services/task_service.py"
  - "backend/app/services/run_producer.py"
trigger_surfaces: [chat, harness]
migration_note:
relates_to:
  - "backend/app/services/run_reconciler.py:245"
  - "backend/app/services/task_service.py:451"
  - "256"
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-299: A stranded Deep chat run's token count is genuinely unknowable

## The finding

`backend/app/services/run_reconciler.py:245` finalizes an orphaned non-terminal chat run with
`input_tokens=None, output_tokens=None`. **That `NULL` is HONEST, not a defect.**

D-256-08 enumerates the `input_tokens=None` finalize sites that `METER-05` closes. **Site #7 is not
closable**, and the reason is structural rather than an oversight: the chat path accumulates usage in
an **in-memory box** on the producer process (`backend/app/services/task_service.py:414-455`), and it
is persisted only at finalize. When the producer process is **gone** — which is the definition of the
run being orphaned — the box died with it. There is no surviving record to write. Any number the
reconciler invented would be a guess wearing the costume of a measurement.

## Why it matters

Mostly it matters for what it **stops** someone doing. A future reader scanning for
`input_tokens=None` will find this site, assume it is the same bug as the other six, and "fix" it —
most plausibly by writing `0`, which converts *"we cannot know"* into *"nothing was spent."* **That
is strictly worse than the `NULL`**, because `0` is a claim and `NULL` is an admission.

⭐ **The nuance that bounds the blast radius, and it is load-bearing:**
`run_reconciler.py:217-247` only touches **non-terminal** rows. So this site can **never** overwrite
a COMPLETED run's real total. A phase that widens the candidate status set to include terminal
statuses would turn an honest unknown into data loss — which is precisely the failure `SEED-297`
records one code path over.

## When to surface

Any phase that adds **mid-stream** token persistence to the chat path — a per-turn or
per-iteration write of the usage box to `runs.input_tokens`, rather than only at finalize. That is
the **only** change that would make this number knowable, and it has a real cost (a write per turn
on the hottest path in the product), which is why it is a seed and not a task.

Also fires if `METER-07` reports an unacceptable **share** of orphaned runs as uncounted — i.e. when
the size of the hole, rather than its existence, becomes the argument.

## Scope estimate

**Medium.** Not a bug fix: it is a durability change to the chat streaming path, trading one write
per turn for recoverability after a process death. ⛔ The decision is a cost/benefit call that needs
the METER-07 share figure first — **register now, decide when the number exists.**

## Breadcrumbs

- `256-RESEARCH.md` §"Register Entries Owed" → R-3; disposition confirmed at Phase 256 plan
  `256-02` (D-256-08 site #7 REGISTERED, not fixed).
- `docs/HOT-FILE-LEDGER.md` → `backend/app/services/run_reconciler.py`, row added at Phase 256 —
  invariant 3 of that section restates the unknowability, so an editor of that file meets it without
  reading this seed.
- ⛔ **Distinct from `SEED-297`**, and they must not be merged: that seed is about a `NULL`
  **destroying a value that was known and persisted**; this one is about a value that never existed
  anywhere to be destroyed. A single sizing query cannot separate them today, which is itself
  recorded in `SEED-297`.
