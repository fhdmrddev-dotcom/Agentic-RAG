---
seed_id: SEED-296
title: "Evaluation has NO front door — the one capability the competitor catalogue does not sell is the one with no top-level home, and `recall_eval` has zero UI at all"
created: 2026-09-18
surface: Agentic-RAG
status: planted
partial: false
status_note: |
  Planted 2026-09-18 from an operator observation against a competitor Studio screenshot, then
  measured against the tree the same day. The register was searched first — `SEED-292` (assurance
  export) is the nearest and is a DIFFERENT thing: it is about the ARTIFACT evaluation produces,
  not about whether anyone can reach evaluation at all. Nothing else fits, so this is planted
  rather than appended. Its three siblings from the same observation WERE appended, to `SEED-151`,
  `SEED-166` and `SEED-196`.
trigger_when: >
  Fire at any milestone that scopes a commercial, procurement, pilot or buyer-facing surface —
  evaluation is the strongest differentiator this product owns and it is currently unreachable, so
  a go-to-market scope that does not confront this is selling something nobody can be shown.

  Fire ALSO when `SEED-292` (assurance export) is scoped. ⛔ These two are sequenced, not
  duplicated: an export nobody can find is not an asset. Whichever ships second must not
  re-litigate the other's decision.

  Fire ALSO on any navigation / IA work — but ⛔ ONLY AFTER `SEED-151` (Projects). A new top-level
  rail entry today would deepen the one-axis problem `SEED-151` / `SEED-166` / `SEED-196` record.

  Fire ALSO the first time anyone asks "how do I see whether retrieval is any good?" and the honest
  answer is that they cannot, from the product.
trigger_paths:
  - "frontend/src/lib/nav-items.ts"
  - "frontend/src/App.tsx"
  - "backend/app/services/recall_eval.py"
  - "backend/app/services/eval_runner_service.py"
trigger_surfaces: [admin, settings, skills]
migration_note:
relates_to:
  - SEED-292 — assurance export. THE SEQUENCED SIBLING. That seed gives evaluation an artifact; this one gives it a door. An export nobody can find is not a procurement asset.
  - SEED-151 — Projects as a configuration container. ⛔ THE PREREQUISITE. The competitor's Evaluations is top-level BECAUSE their rail has a second axis to carry it; ours does not yet.
  - SEED-166 / SEED-196 — the configuration-homes problem. Same root cause, different symptom.
  - SEED-294 — go-to-market. This is the capability that seed calls the strongest procurement asset.
  - SEED-293 — the stale competitive record. ⛔ Re-crawl before claiming nobody else sells this.
  - Phase 137 / 137.1 — Skill Studio (EvalsTab, TriggeringTab, VersionsTab). The machinery that exists.
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-296: Evaluation has no front door

## The finding, measured 2026-09-18

**There are TWO bodies of evaluation machinery and ZERO top-level doors to either.**

| Machinery | Reachable how |
|---|---|
| **Skill Studio evals** (`eval_runner_service`, `eval_aggregation`, EvalsTab / RunBar / RunHistory / RunCaseDetail — Phase 137 / 137.1) | `skill-studio` IS an `ActiveView`, but it is **deliberately not in `NAV_ITEMS`**. The only door is `onOpenStudio` **inside** `SkillsPage`. `nav-items.ts` says so in its own words: *"a separate `ActiveView` and is deliberately NOT in this array"* |
| **`recall_eval`** (retrieval quality — the recall harness) | ⛔ **NO UI AT ALL.** `grep -rln "recall_eval\|recallEval" frontend/src` returns **zero files** |

Also measured: `ls frontend/src/pages/ | grep -iE "eval\|recall\|quality"` returns **nothing**.

## Why it matters — and it is commercial, not cosmetic

The 2026-09-18 competitor read found **Evaluations as a top-level left-rail entry** in their Studio,
alongside Overview, Projects, Lifecycle, Components and Knowledge.

⭐ **And the same read concluded that correctness evaluation is the thing their catalogue does NOT
sell** — they ship Red Teaming, which is adversarial, while *"nobody in their catalogue sells proof
that the output is right."*

**So the position is exactly inverted from where it should be.** They give a top-level home to a
capability they have; we bury the capability they lack. ⛔ **A differentiator nobody can reach is
not a differentiator** — it is an implementation detail with a cost.

⚠ **This compounds `SEED-292`.** That seed found ~106 KB of evaluation machinery producing no
artifact a buyer can file. This one finds that the machinery has no door either. **Together they
mean the strongest procurement asset in the product is both unreachable and unexportable** — and
neither gap is a hard build.

## ⛔ What this seed must NOT be used to justify

**Adding a top-level rail entry today.** Operator direction, 2026-09-18, on the navigation
observation that produced this seed: *"I think it's a symptom and it resolves when Projects exist,
so I don't want it treated as standalone work."*

The competitor's Evaluations entry works because their rail carries **where you work** while a
second axis carries **what the selected project contains**. Ours is one flat axis of seven peers
plus three hand-appended admin entries. **An eighth peer makes `SEED-166` / `SEED-196` worse, not
better.** Sequence after `SEED-151`.

## The cheap interim, if the full answer is far off

Recorded as an option, not a recommendation — it needs its own judgement at scope time:

- Skill Studio already has a door, just a deep one. **Making `onOpenStudio` discoverable from where
  a person already is** costs far less than a new home.
- `recall_eval` has no door at all, and is the half a *buyer* would ask about. ⚠ It is also the
  half with no surface to attach to — so it is the one that genuinely waits for `SEED-151`.

## Open question, deliberately unanswered

**Is evaluation one home or two?** Skill evals answer *"is this skill behaving?"*; recall eval
answers *"is retrieval any good?"*. Those are different questions for different people, and
collapsing them into one "Evaluations" page because a competitor has one page with that name would
be copying a label rather than a decision.
