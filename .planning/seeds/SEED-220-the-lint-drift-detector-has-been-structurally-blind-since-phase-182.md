---
id: SEED-220
title: "`test_182`'s lint-drift detector has been structurally blind since Phase 182 — its regex matches only a STRING LITERAL first argument to `LintError(`, so any code minted from an expression was invisible"
status: planted
planted: 2026-08-28
planted_by: Claude, 2026-08-28, measured by plan `214-05` while adding five new lint codes; the five are covered, the general blindness is not
surface: Agentic-RAG
severity: major
category: verification / guardrail integrity
priority: high
scope: >
  The detector is a source-reading test. Making it total means parsing the AST for every
  `LintError(...)` construction site rather than regexing for a quoted first argument — the same
  "anchor on code, never on raw text" rule the 187-24 trap taught this project.
affected_areas: [backend/harness, publish-gauntlet, verification]
related_seeds: []
related_bugs: [BUG-260826-02]
relates_to:
  - backend/tests/test_182_grounding_bundle.py / backend/tests/unit/test_182_severity_codes.py
  - backend/app/services/harness/publish_service.py — where lint codes are minted
  - .planning/phases/214-a-step-names-its-service-and-its-action/214-05-SUMMARY.md
re_open_trigger: >
  ⚠ ALREADY TRUE AT PLANTING, and it has been true for THIRTY-TWO PHASES. Re-open at whichever
  comes first: (1) any phase that adds or renames a publish lint code — that phase inherits a
  detector that cannot see half the ways a code can be minted; (2) any phase that touches
  `test_182_*`; (3) the next audit of source-reading guards generally, since this is the
  `187-24` trap in its dual form — there the grep counted its own prose, here the grep cannot
  see the code at all.

  Mechanical check that the gap is still real, from the repo root:
    grep -rn "LintError(" backend/app | grep -v "LintError(\"" | grep -v "LintError('"
  Every hit is a construction site the detector cannot see.
---

# SEED-220: a drift detector that has been blind since the phase that wrote it

## What was measured

`214-05` added five publish lint codes for argument satisfiability. While doing so it measured that
`test_182`'s lint-drift detector — the guard whose job is to notice when the lint code set changes —
matches only a **string-literal first argument** to `LintError(`. Any code minted from an expression
(a constant, an f-string, a lookup, a loop variable) is invisible to it.

The five new codes are covered, because `214-05` wrote them as literals after finding this. **The
general blindness is untouched.**

## Why it matters

⚠ **A guard that cannot fire is worse than no guard**, because it answers the auditor with a pass and
stops the audit — the same sentence this project's hot-file ledger keeps having to write about stale
rows. This one has answered `pass` since Phase 182.

⚠ **It is the `187-24` trap in its dual form.** There, a criterion that greps raw text COUNTS ITS OWN
PROSE and fires spuriously. Here, a criterion that greps raw text MISSES CODE and cannot fire at all.
Both have the same fix: anchor on the AST, or strip and control.

⚠ **It was invisible for a structural reason, not a careless one.** Nobody minted a code from an
expression between Phase 182 and Phase 214, so the detector's blindness never produced a wrong answer
— it produced no answer, indistinguishably from a correct one.

## Why Phase 214 did not fix it

`214-05`'s scope was the argument-satisfiability gate. Rewriting a Phase-182 guard's matching strategy
is repair on a file the phase does not otherwise touch, inside a phase already carrying its own threat
model — the same reasoning `D-214-13` records for `BUG-260815-06`.
