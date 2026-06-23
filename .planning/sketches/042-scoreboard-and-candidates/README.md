---
sketch: 042
name: scoreboard-and-candidates
question: "How does one tuning iteration read — the per-provider held-out score, the ≤N candidate rewrites each auto-scored, picking the winner by held-out score, and the author-confirm → PATCH?"
winner: "A"
tags: [phase-123, skill-triggering, trigger-tuner, scoreboard, candidates, held-out, honesty, author-confirm, trig-01]
---

# Sketch 042: Scoreboard & Candidates — the iteration heart

## Design Question

This is the core of TRIG-01: the author has a benchmark, the Tuner has produced ≤N candidate rewrites
(via `forced_emit`, built by the configurable builder model), each one scored **cross-provider on the 4
production model-ids**. How does the author read all that and **pick the winner by held-out score**, then
confirm the write — without anything being auto-applied, and without the false-fire axis hiding?

## How to View

`open .planning/sketches/042-scoreboard-and-candidates/index.html`

## Variants

- **A: Candidate cards + per-provider grid ★** — each candidate is a card carrying its held-out score and a
  4-cell provider grid; every cell shows BOTH sub-scores (**fires** = should-trigger recall · **no-false** =
  should-NOT precision). "Use → confirm & save" reveals an explicit diff confirm strip. Most honest, most space.
- **B: Leaderboard rows** — all candidates + baseline in one ranked table sorted by held-out, with a compact
  4-cell provider sparkline. Densest, comparison-first; the fires/no-false split drops to hover.
- **C: Diff-against-current** — pick a candidate from a list; the right pane shows it head-to-head vs the live
  description with the **per-provider delta** (▲/▼ vs baseline) as the hero — catches a candidate that lifts the
  average but quietly regresses one provider.

## What to Look For

- **Is the false-fire rail always visible?** (A shows fires/no-false in every cell; B hides it to hover; C
  shows it as a residual note.) The new description-driven policy (D-01) makes should-NOT precision the thing
  that must not silently regress — SC#10's whole reason for being.
- **Held-out vs train:** the number the author picks by is the **held-out** score (40% never used to pick).
- **No auto-apply:** the winner is author-confirmed → `PATCH /skills` → re-lint. Variant A makes the confirm a
  real diff step; B/C make it a button.
- **The production model-ids are real** — `gpt-5.4-mini` / `claude-haiku-4-5` / `gemini-3.5-flash` / `z-ai/glm-5.1`.

## Provider-set adaptivity (load-bearing — added 2026-06-23)

**The scoreboard is N-column, driven by the org's configured/enabled targets — NOT a fixed four.** A top band
in the sketch demonstrates the same candidate rendered for three orgs:

- **Multi-provider org** → the familiar cross-provider grid (their real target set, 1 representative per provider).
- **Single-provider org (e.g. Anthropic-only)** → **one column**. This is the **clean baseline, not a degraded
  mode** — "tune this description for Claude," no cross-provider machinery. The card layout collapses to a single
  cell and the held-out score *is* that provider's score.
- **Self-hosted org (e.g. DeepSeek on own infra)** → one column labeled by their actual deployment + endpoint;
  the **builder model (D-08) can also be self-hosted**, so the entire tuner loop runs air-gapped.

Two hard rules: (1) **a provider the org doesn't run never renders** (a score you can't act on is a fabricated
measurement — violates honesty-is-load-bearing); (2) **OpenRouter is one gateway** — native DeepSeek / GLM
(zhipu/z-ai) / Kimi (moonshot) / MiniMax are first-class targets distinct from OpenRouter-routed copies, because
trigger/tool-call behavior depends on the serving path, not just the model name (cf. Phase 115 Gemini schema,
Phase 122 per-provider `emit_tier`). The targets default to "the models you actually use."

The **SC#10 4-axis recipe is OUR development/QA gate** for building this feature (we must prove no false-fire
regression cross-provider) — it is **never a runtime requirement imposed on the org**. 042-A's per-cell grid is
what makes the single→multi adaptation cleanest (it's just N cells).

## Build Notes (reuse vs net-new)

- **Reuse:** `forced_emit` (candidate generation + per-case trigger classification), the
  `eval_cross_provider.py` provider-axis scoreboard rig (extended for trigger/no-false), `PATCH /skills/{id}`
  (`skills.py:260`) for the confirmed write, the D-09 lint on that save path.
- **Net-new:** the held-out scoring (60/40 split, 3 repeats), the candidate-card / leaderboard / delta render,
  the confirm-diff step. Builder model = the configurable D-08 knob (`resolve_authoring_model()` pattern).
- **Honesty (load-bearing):** never show a fabricated aggregate that hides a regressed provider; the confirm
  strip writes the live description and the skill begins firing immediately — say so.
