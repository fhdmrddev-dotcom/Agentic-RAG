# Skill Trigger Tuner (Phases 123 + 123.1)

## Design Decisions

**041 — The Tuner = a focused full-surface reached from the skill, NOT crammed into
the 384px detail panel (winner: A).**
A tuning run is cases × N models × repeats of live LLM calls with a case editor +
per-provider scoreboard + candidate list — too big for the right detail pane. The
Tuner takes the whole working area (rail stays; list + detail hidden) via an
`ActiveView`/no-router switch; `‹ Skills` returns. Mirrors the publish-gauntlet
"focused surface" precedent. Rejected: wide push/split panel (tall single-column
scroll), in-panel accordion (cramped in 384px). **This surface was later ABSORBED as
the "Triggering" tab of the unified Skill Studio (057) — internals untouched.**

**042 — One tuning iteration = candidate cards, pick by HELD-OUT, author-confirm →
PATCH (winner: D — the as-built reference; A = the original data-model record).**
The data model that survived: each candidate carries its **held-out score** (the 40%
never used to select) + a per-provider breakdown where **every cell shows BOTH
sub-scores — fires (should-trigger recall) AND no-false (should-NOT precision)** — the
false-fire rail is always visible, never a hidden aggregate. The author picks by
held-out, then an explicit **diff confirm** writes the live description via
`PATCH /skills/{id}` + re-lints — **never auto-applied**. ⚠ **Layout lesson
(123.1/BUG-260624-01):** A's fixed 4-up provider grid crammed illegibly at the org's
real 7–8 providers — Phase 123.1 replaced it with **N vertical full-width rows**
(042-D mirrors the shipped `ProviderScoreboard.tsx`). The ★ moved from A to D because
D is what the app actually renders.
**Provider-set adaptivity (load-bearing):** the scoreboard is **N-column = the org's
configured targets, never a fixed four** — a provider the org doesn't run never
renders (fabricated measurement = dishonest). Single-provider is the **clean
baseline** (one column, "tune for Claude"); self-hosted runs one column on own infra
(air-gapped loop); **OpenRouter is one gateway — native DeepSeek/GLM/Kimi/MiniMax are
first-class distinct targets** (serving path ≠ model name). The SC#10 4-axis recipe
is the dev/QA gate, never a runtime imposition on the org.

**043 — Benchmark cases = two-column should-fire / should-NOT lists + a 60/40 split
bar + a background-run live card (winner: A).**
Auto-seeded starter benchmark (should-fire = description paraphrases; should-NOT =
sibling catalog skills + generic off-topic — leak-safe owner-scoped), provenance tags
`seeded`/`sibling`/`held`/`you`; the author edits/approves/adds. The should-NOT column
visually IS the false-fire rail. The 60/40 train/held-out split is honest + visible.
The multi-minute run is a **background job** (run-buffer + SSE) with per-provider
live progress — never a fake percent for a queued provider; stable-start-ts elapsed
(the 095 never-vanishes lesson); "you can leave; it reconciles on return."

**044 — Save-time lint = inline-under-Description, warn-NEVER-block, one-click "Tune
this →" handoff + a provider-agnostic builder-model knob (winner: A).**
The weak-trigger warning fires on save, names the SPECIFIC deterministic reason
(name-echo / no trigger verb / too short / generic / duplicate), never blocks (hard
D-09 posture — failing the agent's own `save_skill` mid-task would be worse), and
lives in the **shared service layer** so it covers BOTH the human form AND the agent
path (same warning in-chat, tool never blocked). The builder-model knob reuses
`resolve_authoring_model()` + the 024 picker footer: strong default, full provider
list incl. local, always-on cloud/local tag, no paid-provider SPOF, **decoupled from
the benchmark targets** (builder *writes*, targets *measure*). The "Tune this →"
handoff now points at **Studio · Triggering** (057 re-pointing). Phase 137.1 D-13
adds two additive lints in this same home: kebab-case skill-name + description-length
(1024) portability warnings.

**045 — Pre-run case editor at scale = full-width stack (winner: B).**
The 041-A narrow-rail layout collapsed at real scale: `auto_seed_cases` seeds one
case per sibling skill (uncapped) → dozens of long cases at 9–11px in a 360px rail
while the results column sat EMPTY pre-run. Winner: **no rail pre-run** — one
full-width flow (description → two wide case columns → run bar); results render
full-width after a run. Sketch anti-regression rule: **always sketch list surfaces at
the org's REAL scale** (6/20/50-skill toolbar control), not a handful of illustrative
items.

## What to Avoid

- Fixed-N provider grids (cram at real rosters; fabricate absent providers).
- Auto-applying a winning candidate; picking by train score instead of held-out.
- Hiding the fires/no-false split behind hover (leaderboard variant's flaw).
- Blocking saves on lint; a lint that only covers the human path.
- Pre-run layouts that reserve the stage for not-yet-existing results.
- Sketching density surfaces with toy item counts (the 045 lesson).

## Origin

Synthesized from sketches: 041, 042, 043, 044, 045 (Phases 123 + 123.1, 2026-06-23/25).
Source files: sources/041-tuner-surface-shell/ … sources/045-tuner-prerun-editor-at-scale/
