# Phase 096: Eval Harness + Cross-Provider Verification + Concurrency - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-06
**Phase:** 096-eval-harness-cross-provider-verification-concurrency
**Areas discussed:** CI gate semantics, Eval scope & curation, Bug routing + ask_user UAT, Stream-cap behavior

---

## CI gate semantics

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Full live CI job | GitHub Actions nightly/manual with 8 provider keys as secrets, boots Supabase+Redis+backend in runner | |
| (b) Operator gate | Eval stays local; "CI gate" = documented mandatory pre-closure ritual | |
| (c) Hybrid | Mock-provider structural workflow test in real GitHub CI + live eval as documented operator gate | ✓ |

**User's choice:** (c) Hybrid — "go with your recommendations"
**Notes:** CI proves structure (deterministic, free, every push); operator's live eval proves providers. The eval's localhost-hard-gate philosophy stays intact; no provider keys in GitHub secrets.

---

## Eval scope & curation

| Option | Description | Selected |
|--------|-------------|----------|
| One max-coverage workflow per provider | programmatic → batch → agent → single, once per provider | ✓ |
| All 4 seed workflows × 8 providers | 32 live multi-phase runs per eval | |

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-answer ask_user via POST | Robot-watches the F10 round-trip every eval run | ✓ |
| Skip ask_user in automated eval | Cover via EVAL-02 restart UAT only | |

| Option | Description | Selected |
|--------|-------------|----------|
| Measure feature-fit only | Per-provider capability table artifact; routing changes deferred to v2.9 | ✓ |
| Measure + change routing in 096 | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Full registry curation | MODEL_CAPABILITIES + Settings lists vs live /models, newest-first | ✓ |
| Eval PROVIDERS constant only | | |

**User's choice:** all recommendations — "proceed"
**Notes:** Provider matrix carried forward unchanged from D-089-05 (native-7 hard, OpenRouter best-effort) — not re-asked.

---

## Bug routing + ask_user UAT

| Option | Description | Selected |
|--------|-------------|----------|
| Fold BUG-260605-01 as fix | Backend terminal-status ask_user cleanup + frontend expired card + surfaced 404; restart UAT verifies | ✓ |
| UAT-only, defer fix | Document the bug, fix in a dedicated HITL-cleanup phase | |

| Option | Description | Selected |
|--------|-------------|----------|
| BUG-260603-01 stays open | Composer surface, no 096 overlap | ✓ |
| Fold into 096 | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Operator-driven restart, script-assisted | Script seeds + signals kill point + asserts DB truth after | ✓ |
| Fully scripted restart automation | | |

**User's choice:** all recommendations — "go with your recommendations"
**Notes:** Rationale for folding: EVAL-02's restart-mid-ask_user UAT would trip over BUG-260605-01 if unfixed. Both bug reports' frontmatter updated during the session.

---

## Stream-cap behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Pool = 3 (viewed + 2 MRU background) | Leaves 3 of 6 per-host connections free; one configurable constant | ✓ |
| Viewed-thread-only (pool = 1) | Simplest, but background runs fully dark | |

| Option | Description | Selected |
|--------|-------------|----------|
| Honest "running" indicator | Capped threads keep pulse from known run status; no fake progress | ✓ |
| Realtime-hint live badges | Best-effort progress hints for capped threads | |

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot-first + Redis replay re-attach | Instant render, lossless catch-up, LRU eviction | ✓ |

**User's choice:** all recommendations — "proceed with your recommendations"
**Notes:** D-11a — the cap trade-off (≥4 concurrent runs → unwatched threads show no live tokens until visited) is asserted in the parallel-thread UAT row as designed behavior.

## Claude's Discretion

- Mock-provider design for the CI structural test
- Capability-table artifact format + location
- Cross-tab GET <50ms measurement + AnyIO threadpool budget verification method (SEED-036a)
- Restart-smoke helper script UX
- Stream-pool LRU bookkeeping (PANEL-06 isolation preserved)

## Deferred Ideas

- Feature-fit routing CHANGES → v2.9 (measurement artifact ships in 096)
- BUG-260603-01 → dedicated composer/send-reliability fix (SEED-055 residual)
- Live-eval GitHub Actions job (workflow_dispatch + secrets) → later hardening if the operator ritual proves insufficient
- Playwright E2E revival → SEED-049 (not part of 096's CI gate)
