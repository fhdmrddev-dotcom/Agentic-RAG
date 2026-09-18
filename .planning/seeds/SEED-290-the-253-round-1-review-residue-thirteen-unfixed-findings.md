---
seed_id: SEED-290
title: Phase 253's round-1 review found 13 more findings after a 14/14 pass — 2 were fixed, these 13 were not
created: 2026-09-17
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: >-
  Any phase whose files_modified names scripts/check-schema-acl-parity.cjs,
  scripts/check-greenfield-privileges.py, .claude/hooks/schema-acl-parity-guard.js,
  .claude/settings.json, .github/workflows/backend-tests.yml, or either of the two
  backend/tests/unit/test_253_* modules. ALSO fires on its own terms: WR-05 the first time an
  E'...' escape string reaches supabase/migrations/ or the supplement (measured zero today, so it
  is latent, not safe); WR-04 whenever the ON ALL TABLES IN SCHEMA divergence is next cited as a
  reason to defer parser unification, because that citation was measured FALSE.
trigger_paths:
  - "scripts/check-schema-acl-parity.cjs"
  - "scripts/check-greenfield-privileges.py"
  - "scripts/full-schema-supplement.sql"
  - ".claude/hooks/schema-acl-parity-guard.js"
  - ".claude/settings.json"
  - ".github/workflows/backend-tests.yml"
  - ".github/workflows/schema-acl-parity.yml"
  - "backend/tests/unit/test_253_*.py"
  - "supabase/full-schema.sql"
trigger_surfaces: []
migration_note:
relates_to:
  - ".planning/phases/253-the-bootstrap-artifact-tells-the-whole-truth/253-REVIEW-R2.md"
  - ".planning/phases/253-the-bootstrap-artifact-tells-the-whole-truth/253-REVIEW.md"
  - "SEED-266"
  - "DEBT-06"
  - "BUS-257"
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-290: Phase 253's round-1 review residue — thirteen findings, recorded rather than fixed

## The finding

Phase 253 shipped, verified **14/14 with zero gaps**, and a code review then found **two live
criticals** it had missed. A gap-closure round closed five locked findings. A review *of that round*
(`253-REVIEW-R2.md`) then found **two more blockers of the same defect class the phase exists to
kill** — both since fixed inline at `3cedc6e51` and `71affadd1` — plus **13 findings that were not
fixed**.

Those 13 lived only inside `253-REVIEW-R2.md`. Round 1's own 13 deferrals were recorded properly,
each with a re-open trigger inside `253-03-PLAN.md`'s `<deferred>` block. R2's got none of that
treatment. This seed is the register they were missing, because — CLAUDE.md's own recurring
finding — *a fact in a register nobody re-reads is the same as no fact*.

### Warnings

| id | Finding | Re-open trigger |
|---|---|---|
| **WR-01** | Self-test arm 5e (the CRLF counterfactual) is **vacuous**. `toCrlf(realSupplement)` returns a byte-identical buffer (md5 `da9c561…`, 42050 bytes, both) because the working tree is already CRLF — supplement 653 CRLF / 0 LF, artifact 7907 CRLF / 0 LF. The arm never builds an LF variant, so its comment's claim about normalisation is **untested**. This is the fifth vacuous arm found in this one phase. | The next touch of `check-schema-acl-parity.cjs`'s self-test, or any change to `core.autocrlf` / `.gitattributes`. |
| **WR-02** | The CI-coverage fence derives its **paths** but hand-types its **modules** — 2 of ~49. Adding two more using its own cited house idiom instantly surfaced `scripts/build-recall-bench.py` and `scripts/check-security-advisors.sh` as `push=False pull=False`. | The next `test_253_ci_path_coverage.py` edit, or the next `scripts/` file a backend test reads. |
| **WR-03** | The fence **exempts itself**. Including `test_253_ci_path_coverage` in its own scan set yields `.github/workflows/backend-tests.yml push=True pull=False` → its own coverage assertion fails. That gap is then *pinned as intentional* by a sibling test. | Any change to `backend-tests.yml`'s `pull_request.paths`. |
| **WR-04** | ⛔ **A docstring this round ADDED is FALSE.** It claims `_parse_statement` "invents `public.public`" for `ON ALL TABLES IN SCHEMA`; measured, both sides return nothing on 5 variants. It is cited as the justification for deferring WR-09 (parser unification). | Fires the moment that divergence is cited again as a reason to defer. ⭐ **Correct the docstring before believing it.** |
| **WR-05** | `E'…'` escape strings defeat **BOTH** lexers, reproducing CR-02/CR-03 exactly: `SELECT E'a \' -- x';` followed by `REVOKE ALL ON public.after_e FROM anon;` yields ONE chunk and the REVOKE is **dropped** — the permissive direction. Same shape for an unterminated `/*` (rest of file → `[]`) and `$`-bearing identifiers. **Latent only**: zero real `E'` in migrations, supplement or artifact, measured. | The first `E'` to reach `supabase/migrations/` or `scripts/full-schema-supplement.sql`. ⛔ Latent is not safe — it is unfenced. |
| **WR-06** | The WR-02 fix is **fenced by nothing**. Nothing tests the hook, and nothing pins its `settings.json` registration; `.claude/` is exempt from `check-hot-file-ledger.cjs` (`watched: 0` this phase). The round answered with a ledger row while fencing everything else executably. | The next `.claude/hooks/` or `.claude/settings.json` edit. Named seam is in `docs/HOT-FILE-LEDGER.md` under `.claude/settings.json`. |
| **WR-07** | The tail self-test arms run against the **REAL** repo, so a genuine unmirrored tuple reds arm 5d ("exits 0") for the wrong reason — and since `--self-test` runs *before* the scan step in CI, the informative verdict never prints. | The first real ACL gap after `schema-acl-parity.yml` actually runs. |

### Info

| id | Finding |
|---|---|
| **IN-01** | Unused import. |
| **IN-02** | `sys.path` is mutated on every call and never restored. |
| **IN-03** | The "no environment variable" claim is false for the coverage fence. |
| **IN-04** | Dead variable in the self-test. |
| **IN-05** | `.claude/settings.json` carries a stray top-level `"PostToolUse": []`. ⭐ **The operator was shown this explicitly on 2026-09-17 and DECLINED to take it**, under the five-finding scope lock. It stays by decision, not by oversight. |
| **IN-06** | `statements()` re-slices the whole remainder at every `$`. |

## Why it matters

Nobody pays for these today. WR-05 is the one with teeth: it is the *same defect* as CR-02 and CR-03,
in both lexers at once, and it is unfenced — so the next person to write an `E'` escape string into a
migration silently loses the ACL that follows it, in the permissive direction, and every gate stays
green. That is the exact failure mode this phase spent three rounds killing, surviving one syntax
over.

WR-04 matters for a different reason: it is a **false claim this phase itself introduced**, and it is
load-bearing — it is the stated reason another finding was deferred. A deferral resting on a refuted
premise is not a deferral.

## What would close it

Not a phase. WR-04 is a docstring correction. WR-01 is a one-line fixture fix. IN-01/IN-04 are
deletions. WR-05 deserves a lexer arm and a fence before it is latent-no-longer. Most of this is
`/gsd:fast` sized, taken opportunistically the next time one of the `trigger_paths` is open.

⛔ **What must NOT happen is another gap-closure round.** G-7 exists for this shape: the review gate
manufactures findings against code written the same day, and every ROADMAP success criterion for
Phase 253 is independently verified. See [[SEED-266]] for the row-security arm of the same artifact,
and `DEBT-06` / `BUS-257` for the independent review this phase still owes — its **sixth**
consecutive self-verified close.

## Also owed, and not this seed's to close

- **`schema-acl-parity.yml` has never executed.** `gh run list` → `HTTP 404: workflow not found on
  the default branch` — the file does not exist on `master`. `--self-test` has exactly one runner
  and that runner has never run.
- **`backend-tests` has never been green**: 40 of 40 runs failed. `3cedc6e51` makes the new fences
  legible via a dedicated must-pass step; it does **not** make the job green and **cannot**, because
  the project baseline is 71 failures.
- **The live MultiEdit dispatch is unobservable from the session that changed it** —
  `.claude/settings.json` is read at session start.
