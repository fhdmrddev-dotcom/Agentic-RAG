# Phase 154: Plain-Language Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 154-plain-language-layer
**Mode:** Autonomous — operator granted full authority ("identify grey areas as usual,
then go with your comprehensive recommendation for each choice"). Claude selected the
recommended option for every area; alternatives + rationale preserved below.
**Areas discussed:** Reveal state (scope/persistence/audience), Single-source term-map,
Reveal mechanism, Coverage boundary, Contract safety

---

## Reveal state — scope, persistence, audience (D-01)

| Option | Description | Selected |
|--------|-------------|----------|
| App-wide localStorage context, all users, default plain | `TechnicalNamesProvider` modeled on `useTheme`; Settings toggle; no operator gate | ✓ |
| Server-side `user_settings.preferences` | Persists across devices; requires reviving preferences (v3.4 SEED-117) + schema/API surface | |
| Operator-tier-gated reveal | Only operators can flip; matches VIS-01 feel | |

**Claude's choice:** localStorage context, all users, default OFF.
**Notes:** Field/enum names aren't secret ⇒ no operator gate (VIS-01 gates *features*, not
*labels*). Server persistence rejected because reviving `user_settings.preferences` is
explicit v3.4 config-consolidation work (SEED-117) and adds contract surface that fights
the "display-only" invariant. Consolidate the admin Control Room's local `showTechnical`
onto this one context (D-01a) so there's no drift.

---

## Single-source term-map (D-02)

| Option | Description | Selected |
|--------|-------------|----------|
| One `termMap.ts` glossary + `usePlainLabel` consumer | Single source of truth (SEED-085); every surface routes through it | ✓ |
| Per-surface inline label maps | Faster per-surface, but drifts — the exact thing SEED-085 warns against | |

**Claude's choice:** single-source term-map.
**Notes:** SEED-085 explicitly demands "a small glossary / term-map as the single source
of truth ... so every surface renders consistently and nothing drifts."

---

## Reveal mechanism — global toggle vs inline ⓘ (D-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Global toggle primary + keep inline ⓘ in forms | Toggle flips all labels; ⓘ+helper retained in Builder-style dense forms | ✓ |
| Global toggle only (remove ⓘ) | Simpler, but loses per-field help in authoring forms | |
| Inline ⓘ everywhere (no global flip) | Per-field, but no one-flip advanced mode; heavy on simple surfaces | |

**Claude's choice:** global toggle primary, keep ⓘ+helper where it already lives.
**Notes:** Both read the same term-map. Don't rip out Phase 103's ⓘ; don't force ⓘ onto
simple surfaces.

---

## Coverage boundary — what "app-wide" means for THIS phase (D-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Spine + bounded prioritized end-user surfaces | Ship the contract + cover worst-jargon surfaces; term-map inherits the rest | ✓ |
| Exhaustive every-surface relabel now | Unbounded scope-creep risk; low ROI on low-traffic surfaces | |
| Spine only (no surfaces relabeled) | Under-delivers SC#1 ("plain labels across the app") | |

**Claude's choice:** spine + bounded prioritized end-user surfaces (chat/composer,
workflow user surfaces, documents, Settings); admin surfaces only consume the context.
**Notes:** Researcher produces the concrete term inventory + final ranked surface list
during plan-phase. Uncovered low-traffic surfaces are a documented follow-up, not a
failure.

---

## Contract safety + frontend-only (D-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Frontend display-only, backend untouched | Deep byte-identical by construction; no enum/API/audit rename | ✓ |
| Touch backend copy too (SSE/tool descriptions) | Risks contract breaks + Deep drift — barred by SC#2 | |

**Claude's choice:** frontend display-only.
**Notes:** Term-map maps DISPLAY strings only; underlying values flow untouched. Verified
via `git diff --name-only` showing zero backend files + no enum/const/API-key rename.

---

## Claude's Discretion

- Exact naming of the context/hook (`useTechnicalNames` vs `useAdvancedMode`), the
  localStorage key, and the `<PlainLabel>` API — consistent with `useTheme` + the
  existing `TechnicalNamesToggle` vocabulary.
- Final term-map key set + the ranked surface list within the D-04 boundary.

## Deferred Ideas

- Server-side persistence of the reveal preference → SEED-117 (v3.4).
- Exhaustive app-wide term coverage → follow-up after the spine + worst offenders.
- Nav/thread-list crowding → Phase 156 (POLISH-01).
- Chat-banner honesty/timing bug → 128-class streaming/honesty work.
- Accessibility of the toggle + relabeled surfaces → Phase 155 (A11Y-01).
