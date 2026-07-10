---
id: BUG-260624-01
title: Skill Trigger Tuner — design-fidelity & UX gaps surfaced in live UAT (cramped scoreboard, hidden seeded cases, no result persistence, cheap-only builder models)
reported: 2026-06-24
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [skills, frontend/tuner, frontend/SettingsPage, backend/skill_tuner]
folded_into: "123.1"
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: dbc75800
  date: 2026-06-24
---

# BUG-260624-01: Skill Trigger Tuner — design-fidelity & UX gaps (live UAT)

## What we observed

Operator ran the Phase 123 Trigger Tuner live (skill `docx`, 8 configured providers). The feature is *functionally* sound (the benchmark runs and scores across all providers, OpenRouter now concrete, survives SSE timeouts), but a comprehensive sketch-vs-build audit (5 auditors, one per sketch 041–044 + functionality/persistence) confirmed real lived-experience gaps the automated verification missed. Findings, by severity:

**HIGH**
1. **Cramped scoreboard (the "messy").** `ProviderScoreboard` is a horizontal `repeat(N, 1fr)` grid with no min-width floor, rendered inside the RIGHT half of a 50/50 page split (`SkillTunerPage.tsx:280`, `ProviderScoreboard.tsx:54`). The sketch (042-A) was designed for **4 columns at full width** as gracefully-stacking **vertical rows**. At the org's 8 native providers each cell collapses to ~30–45px — names/models truncate, the fires/no-false rows crowd, no wrap/scroll/reflow. This is what the operator saw as "messy."
2. **Auto-seeded cases are never shown (WR-05 confirmed).** Editor initializes `cases=[]` and never hydrates from the server; both columns show "No cases yet" while the background run benchmarks hidden auto-seeded cases. The start response returns only `case_count` (int), GET results returns only the scoreboard. The sketch's "edit & approve before running" premise is broken; `seeded`/`sibling`/`held` provenance is effectively dead code. (This is the operator's "0 cases" observation.)
3. **Results not persisted — lost on refresh/navigate.** Scoreboard lives only in Redis (`tuner_result:{run_id}`, TTL 600s) and the `run_id` is React state only — nothing in URL/DB. Refresh or navigate-away = the completed scoreboard is unrecoverable (data lingers in Redis ~10 min but nothing reads it back). Re-run correctly replaces (not accumulates). Auditor verdict: "defect-borderline" — a deliberate no-DB-migration scope cut, but poor UX.

**MEDIUM**
4. **Builder-model picker offers only the cheap tier per provider.** `SKILL_BUILDER_MODEL_OPTIONS` hardcodes one cheap forced-emission model per provider (haiku/gpt-5.4-mini/gemini-flash/deepseek-chat/local placeholders). The builder *writes* candidate descriptions — quality benefits from stronger models (Sonnet/Opus, GPT-5.5-pro, Gemini-Pro). Operator's point: the picker shouldn't cap at the cheapest; drive it from the user's *configured* models (like the chat picker). Also folds code-review IN-02 (local placeholder ids).
5. **Long descriptions render uncapped** in candidate cards + the diff-confirm strip (`CandidateCard.tsx:72`, 98-107) — docx's ~1500-char description becomes a wall of text burying the held-out score + Use action. Needs a line-clamp/expand.
6. **Standalone per-provider scoreboard block dropped (041).** The sketch's first-class "Per-provider held-out score" block (how the CURRENT description scores) is gone — provider scores exist only inside candidate cards. Plus missing "Built by {builder model} · measured on N production models" attribution and the pre-run cost preview ("= X live calls"), which is empty before the first run (`targets` is empty until a run starts).
7. **Per-cell colored magnitude bar + combined "big" score dropped (042).** Each cell is reduced to color-tinted text only; the typed `TunerCell.score` field is unused in this view. The sketch centered a per-cell bar (explicitly required) + a leading combined number.

**LOW** (cosmetic): provider color dots; bold green "best held-out" winner pill (vs subtle crown); amber border on the weak Description field; "Tune this →" arrow glyph; "Why this surface" callout banner; numeric per-column count badges; consolidated run-config row.

**Confirmed BUILT and faithful (not gaps):** sketch 044's inline lint warning + "Tune this" handoff (warn-never-block, silent-when-healthy, reachable) AND the Settings builder-model picker. The operator didn't see them because the lint is silent for strong descriptions (only shows after saving a *weak* one) and the picker sits below all 8 providers on the AI Model tab.

## Why it matters

The Trigger Tuner is the flagship TRIG-01 deliverable. It works, but at the org's real provider count (8, the milestone's explicit cross-provider target) the primary result surface is cramped and the seeded-case loop is invisible, so the operator can't trust or curate what's being benchmarked, and any completed result vanishes on refresh. These are exactly the lived-experience defects the SC#10 / G-4 live-UAT gate exists to catch — automated verify passed (12/12 must-haves at the code level) without surfacing them.

## Hypothesized cause

Sketches 041/042 were authored and design-checked at **4 providers / full width**; the build placed the scoreboard in a half-width column with an N-column grid and no responsive fallback. Seeded-case display + result persistence were scoped out (no DB migration) and the "reconcile on return" only works within a live in-memory session. Builder-model options were hardcoded for cost + guaranteed forced-emission rather than driven from configured models.

## Surface classification

`Agentic-RAG` — this app's Phase 123 Trigger Tuner UI + Settings + backend. Routed at `/gsd:discuss-phase 123.1` (Phase 123.1 was inserted specifically to scope/close these). Evidence: 5-agent sketch-vs-build audit + live Chrome MCP UAT on `develop@dbc75800`.
