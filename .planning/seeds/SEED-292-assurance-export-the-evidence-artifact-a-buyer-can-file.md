---
seed_id: SEED-292
title: "Assurance export — ~106 KB of evaluation machinery produces NO artifact a buyer can file. The procurement differentiator nobody else is selling, missing only its last mile."
created: 2026-09-18
surface: Agentic-RAG
status: planted
partial: false
status_note: "Planted 2026-09-18 from the outside architecture read, and MEASURED before planting: `eval_runner_service.py` and `eval_aggregation.py` contain no export, csv or pdf path, and no existing seed covers one. This is one of only three genuinely-new items that read produced."
trigger_when: >
  Fire at the /gsd:new-milestone that scopes commercialisation, enterprise sales, procurement
  readiness, compliance, or a public-sector / government offering — an evaluation result that
  cannot leave the product is not evidence, and every one of those buyers asks for evidence as a
  FILE.

  Fire ALSO on any phase touching the eval runner, eval aggregation or recall eval — an export is
  cheapest to add while that code is already open, and the shape of what it must carry is decided
  by whatever that phase changes about what a run records.

  Mechanical check that the gap is still real, from the repo root:
    grep -rn "def .*export\|csv\|\.pdf" backend/app/services/eval_runner_service.py backend/app/services/eval_aggregation.py backend/app/services/recall_eval.py
trigger_paths:
  - "backend/app/services/eval_runner_service.py"
  - "backend/app/services/eval_aggregation.py"
  - "backend/app/services/recall_eval.py"
  - "backend/app/services/audit_service.py"
trigger_surfaces: [skills, admin, retrieval]
migration_note:
relates_to:
  - SEED-068 — public benchmark scoreboard. Adjacent but NOT the same: that one is outward marketing, this one is a per-customer artifact about THEIR corpus.
  - SEED-291 — the extension contract. An assurance export is an engine capability and stays first-party; it is a LAYER, never a pack.
  - SEED-294 — go-to-market. This is the single strongest procurement asset the tree already almost has.
  - Phase 137 / 137.1 — Skill Eval Studio. The machinery that would feed the export.
  - Phase 246 — `RECALL-01` refused by measurement. ⭐ The precedent artifact: an honest negative result, written down, is exactly the thing a serious buyer trusts.
  - SEED-273 — hnsw iterative scan. A recall figure in an export must not claim more than 246 proved.
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-292: Assurance export

## The finding

The tree carries roughly **106 KB of evaluation machinery** — `eval_runner_service.py` (45 KB),
`eval_aggregation.py`, `recall_eval.py` (47 KB) — plus per-case verdicts, judge feedback,
immutable skill versions, promotion gates and an audit ledger.

**Measured 2026-09-18: none of it can produce a file.** `grep` over the three services for
`def .*export`, `csv` or `.pdf` returns nothing. A customer can watch an evaluation run on a
screen; they cannot hand the result to anyone.

## Why it matters

**Every enterprise and public-sector buyer asks the same question — "how do you know it works?" —
and will not accept a screenshot.** They need an artifact that goes into a procurement file, an
internal risk register, or an auditor's bundle.

The asymmetry is the whole point:

- **Building the evidence is the expensive half, and it is already done.** Cases, runs, verdicts,
  judge reasoning, recall measurements, version pins, audit receipts.
- **Emitting it is the cheap half, and it does not exist.** A signed, dated document naming the
  corpus, the model, the gate thresholds, the pass/fail counts, and — critically — the FAILURES
  as well as the passes.

⭐ **Nobody visible in the category sells this.** The competitors sell orchestration; the closest
one sells governance (see SEED-293). Proof that the deployed system actually works, as a file a
customer can archive, is an unoccupied position — and for government procurement it is a
requirement rather than a feature.

⛔ **The artifact must be honest or it is worth less than nothing.** An export that reports only
what passed is marketing, and a buyer's auditor will find the gap. Phase 246 is the precedent
this seed should be built to: `RECALL-01` was **refused by measurement** and the negative result
written down. That is the tone. An export that cannot report a failure should not ship.

## When to surface

1. **The `/gsd:new-milestone` that scopes commercialisation, enterprise sales, procurement
   readiness, compliance or a government offering.**
2. **Any phase already touching `eval_runner_service.py`, `eval_aggregation.py` or
   `recall_eval.py`** — the export is far cheaper to add while that code is open, and what it
   must carry depends on what that phase changes about what a run records.

## Scope estimate

**Medium.** The data exists and is already structured. The work is: deciding the artifact's
contract (what a buyer's auditor needs to see), a renderer, a stable identifier so two exports of
the same run are comparable, and the honesty rule above enforced by a test rather than by care.
No new subsystem, no migration expected. The sandbox already carries `reportlab` and `docxtpl`,
so a rendered document needs no new dependency.

## Breadcrumbs

- Outside architecture read, 2026-09-18 (`.planning/external-reviews/`), §O2 and §5.2. **Its best
  original idea** — of nine "challenges" it raised, four were already closed and one was refuted,
  but this gap was measured and confirmed real the same day.
- Measurement, 2026-09-18: no export / csv / pdf path in any of the three eval services; no
  existing seed covers one (grepped `procurement`, `assurance`, `evidence artifact`, `export`
  across all 297 seeds).
- Related market signal, unverified: a competitor described as finding recoverable financial
  leakage "while preserving evidence and provenance" — the same shape, packaged for one vertical,
  with a number attached.
