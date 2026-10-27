---
seed_id: SEED-385
title: Derive the practice (golden) run's launch answers from the author's test instruction instead of typed stand-ins
created: 2026-10-27
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The next phase whose files_modified names backend/app/services/harness/publish_service.py's golden-input build (golden_run_inputs), or an author reports that a publish passed on stand-in answers that would fail on real ones.
trigger_paths: ["backend/app/services/harness/publish_service.py", "frontend/src/components/workflows/PublishGauntlet.tsx"]
trigger_surfaces: ["workflow", "harness"]
migration_note:
relates_to: ["296-CONTEXT D-08 (amended)", "296-INVENTORY 291-S6-F7", "296-03 313d5f124 (typed stand-ins + the auto_answered note)"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-385: Golden-run inputs from the author's test instruction

## The finding

Before 296 the practice run answered every declared input with `golden run placeholder for <key>`,
so Publish never proved a fill. `InputFieldSpec` has no example or default field, so 296-03
(`313d5f124`) used TYPED stand-ins (an enum's first option, `2026-01-15`, `1`, `a short example
answer`) and the gauntlet now says in words that stand-ins were used. Reading real answers out of the
author's own test instruction is a new capability (D-08 amended) — this seed.

## Why it matters

A publish can pass on stand-ins that a real launch would fail on. The author is told; the proof is
still weaker than it could be.

## When to surface

A change to the golden-input build, or an author report.

## Scope estimate

Medium: a bounded extraction of `key: value` answers from the test instruction (or an `example` field
on `InputFieldSpec`, which needs the wire, the builder and a migration of nothing), with stand-ins as
the fallback.

## Breadcrumbs

- 291-S6-F7 (291 S6 UAT); 296-03-SUMMARY discretion values.
