---
seed_id: SEED-321
title: /admin/spend is dark-only — AdminSpendPage.tsx and BlindSpotsCard.tsx ship classes with no light pair
created: 2026-09-28
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The next phase that edits frontend/src/pages/admin/AdminSpendPage.tsx or frontend/src/components/admin/spend/BlindSpotsCard.tsx. ⚠ AdminSpendPage.tsx FIRES G-5 after 268 (3 phases), so that phase proposes its extraction first — take the light pairs in the same move.
trigger_paths: ["frontend/src/pages/admin/AdminSpendPage.tsx", "frontend/src/components/admin/spend/BlindSpotsCard.tsx", "frontend/src/components/admin/spend/**"]
trigger_surfaces: [admin]
migration_note:
relates_to: ["257", "268", "268-UI-SPEC.md §9-D9", "frontend/src/components/chat/__tests__/expertThemeContrast.test.tsx"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-321: /admin/spend light theme

## The finding

Phase 257 shipped the Spend & Metering cockpit with dark-only colour classes in `AdminSpendPage.tsx` and
`BlindSpotsCard.tsx`. Phase 268's new leaves under `components/admin/spend/` (`ExpertFilterPills`, `ExpertSpendCard`,
`AttributionDisclosures`) carry light/dark pairs and joined the `expertThemeContrast` fence; the two shipped files did
not, by decision (268-UI-SPEC §9-D9: "leave the shipped dark-only classes, seed the light theme").

## Why it matters

An operator on the light theme sees the cockpit's shell and the Blind Spots card in dark-theme colours next to 268's
correctly themed leaves — mixed contrast on the one page whose job is to be read carefully.

## When to surface

The next phase editing either file. `AdminSpendPage.tsx` crossed the G-5 threshold in 268 (`9 / 3 / 974`), so that
phase starts with an extraction; the light pairs belong in it.

## Scope estimate

Small: add `dark:` pairs to the existing classes and bring both files into the theme-contrast fence.

## Breadcrumbs

- 268-UI-SPEC.md §9-D9; 268-02-SUMMARY (patterns-established); docs/HOT-FILE-LEDGER.md "Phase 268 CLOSE".
