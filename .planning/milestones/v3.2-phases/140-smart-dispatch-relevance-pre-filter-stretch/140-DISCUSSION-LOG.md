# Phase 140: Smart-Dispatch Relevance Pre-Filter (STRETCH) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-07
**Phase:** 140-smart-dispatch-relevance-pre-filter-stretch
**Areas discussed:** Relevance mechanism, Never-starve safety net, Small-catalog bypass, Config & rollout, Filter scope (SC#1 interpretation)

---

## Relevance mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Semantic match | Embedding similarity (query vs skill description + should-fire cases); reuse embedding_service.py. Fast/cheap per turn, scales, catches paraphrases; needs a skill-embedding backfill. | ✓ |
| Keyword match | Plain word-overlap. Zero infra, but misses paraphrases. | |
| Quick LLM check each turn | Per-turn classify_fires. Most accurate, but adds seconds + $ to every hot-path turn and varies per provider. | |

**User's choice:** Semantic match (Recommended)
**Notes:** Runs on every chat turn → latency is the deciding factor; the per-turn LLM classifier was ruled out for the hot path. Signal set locked in CONTEXT D-01 (description + `should_fire` cases, fall back to description/name).

---

## Never-starve safety net (SC#3)

| Option | Description | Selected |
|--------|-------------|----------|
| Marker + name-load escape hatch | Honest "N more skills exist" truncation marker (mirrors CTX-03 D-14) AND load_skill can load any enabled skill by exact name even if not in the menu; recently-loaded/pinned always listed. | ✓ |
| Honest marker only | Just the note; rely on user/agent to ask to list. Simpler but a named-but-hidden skill may not load. | |
| You decide | Design the net during planning inside the D-14/CTX-03 pattern. | |

**User's choice:** Marker + name-load escape hatch (Recommended)
**Notes:** Both parts locked (CONTEXT D-02). Pinned/recently-loaded skills always stay in the menu.

---

## Small-catalog bypass

| Option | Description | Selected |
|--------|-------------|----------|
| Budget is the only gate | Full catalog fits budget → inject all unchanged (byte-identical); filter only activates over budget. One knob. | ✓ |
| Yes, plus a skill-count cutoff | Also skip filtering under ~15 skills regardless of tokens. A redundant second knob. | |
| No — always filter | Rank every turn even for tiny catalogs. Changes behavior for everyone, adds starvation risk. | |

**User's choice:** Yes — budget is the only gate (Recommended)
**Notes:** No separate count threshold; the token budget expresses "small enough" (CONTEXT D-03).

---

## Config & rollout

| Option | Description | Selected |
|--------|-------------|----------|
| Global app setting, default ON + off switch | Budget in app_settings (admin-tunable), sane default; budget=0/disable = today's behavior. Default ON safe because of the bypass. Per-user deferred. | ✓ |
| Global app setting, default OFF (feature-flagged) | Ship dark; operator flips on after cross-provider UAT. Safest, but nobody benefits until flipped. | |
| Per-user setting in Settings UI | Each user tunes their own budget day one. More Settings UI work this phase. | |

**User's choice:** Global app setting, default ON + off switch (Recommended)
**Notes:** Default ON is safe by construction (D-03 bypass); off-switch = budget 0 / disable flag; per-user override deferred (CONTEXT D-04).

---

## Filter scope (SC#1 interpretation)

| Option | Description | Selected |
|--------|-------------|----------|
| Budget-only, inject all when it fits | Filter is purely a budget tool; under budget → inject all. SC#1 satisfied because the cut-first skills when over budget are the least-relevant. No always-on floor to tune. | ✓ |
| Also drop clearly-irrelevant under budget | Minimum-relevance floor every turn even with budget room. Stricter SC#1 reading, but changes small-catalog behavior + adds a threshold + starvation risk. | |

**User's choice:** Budget-only, inject all when it fits (Recommended)
**Notes:** Locked in CONTEXT D-03. Verification must exercise SC#1 with an OVER-budget catalog, not a small one.

---

## Claude's Discretion

- Exact embedding field weighting (description vs test-case prompts), the preceding-turn context window for the query embedding, the default budget number, honest-marker templating, and whether skill vectors live in a new `skills` column vs a sibling table — all planner/researcher calls within the locked decisions.

## Deferred Ideas

- Per-user budget override (start global; add later via app→user override pattern).
- Always-on minimum-relevance floor (explicitly rejected; revisit only if usage shows small catalogs still confuse the model).
- SEED-093 Trigger Tuner scoring-honesty residuals (WR-04/05/06) — NOT folded here; route to a dedicated tuner-polish phase (different surface: offline Tuner scoring/UI vs live backend dispatch).
- Preceding-turn context window for the query embedding — default latest-turn-only; revisit if recall suffers.
