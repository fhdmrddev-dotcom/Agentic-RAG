# Eval Production-Clean: Matrix Runs, Determinate Progress, Engine Health (Phase 137.1)

Extends the Skill Studio (053–057) for EVAL-05/SEED-100: trust the eval engine on
every provider WITHOUT hand-running all 8. The 055-B run-row grammar is the locked
base — the matrix is a group OF those rows, never a new surface. Winners all A
(operator, 2026-07-04). MANIFEST Running Design Decisions 48–50.

## Design Decisions

**058 — Matrix run = ONE grouped card in RunHistory (winner: A).**
One click fans the skill's eval across all configured providers; the group renders as
a single collapsible matrix card whose N sub-rows ARE 055-B rows (provider logo +
model + ver + honest rollup, expand-in-place), so the resting history never floods (a
collapsed matrix = one row). Exactly ONE sub-row carries the **"▣ feeds gate"** chip
(designated at launch, default = the active provider) and the card header states the
semantics ONCE ("gate reads X only — other arms are analysis-only and never flip the
publish gate"). Launcher = one-click "⧉ Run matrix (N configured)" + an inline
gate-feeder select beside the UNCHANGED single-run RunBar (all-configured default
beat checkboxes; the cost-line popover + logo-chip toggles are documented
alternatives). Aggregation lives in the card FOOTER: per-config mean±stddev from
accumulated run HISTORY (×1 run per config per click; stddev only at ≥2 runs, "first
run — no spread yet" honesty), Δ = with−without mean judge score, + deterministic
analyst notes as TAGGED fixed-phrasing rules (non-discriminating / flaky-variance /
time-score) — never an LLM paragraph. Live: per-config determinate unit bars, NO
mid-run verdicts, aggregation lands only at finalize; RunBar disables with the
one-claim-per-skill note (Redis `SET NX` acquired once per matrix group). A
`not_measured` arm shows the VERBATIM provider error — excluded, never failed.

**059 — Running eval row = thin determinate unit bar + inline advisory case feedback
(winner: A).**
Units = cases × 2 arms + 1 judge step (judge = ONE unit; confirm at plan). The
running 055-B row carries a thin gradient unit bar + `case i/N · arm · u/U · %` —
scales to ANY case count (segmented pips rejected: structure-legible but stop scaling
past ~5 cases). The expanded live body is a per-arm checklist (✓ / ● / queued) where
each arm's wall-clock duration appears AS IT LANDS; finished arm cards show ⏱ beside
tokens (duration = metadata, never verdict). The judge's `case_feedback` renders
INLINE under the flagged case header as a violet dashed-left **"◇ Judge on this
case"** block — ADVISORY vocabulary (violet/info, never amber/red, never in rollup
math), captioned "feedback only — never blocks the run", visually distinct from
PASS/FAIL chips. No mid-run verdicts; elapsed derives from a stable start-ts (the
095 never-vanishes lesson). Applies identically to every arm of a 058 matrix.

**060 — Engine health = a Settings tile board + the shared judge knob (winner: A).**
Answers the operator's verbatim trust bar ("how do I know it reflects reality for
each model without hand-running all 8"): 8 compact logo tiles (one per CONFIGURED
provider) each ✓/✗ + representative model — the whole posture in one saccade; a
failing tile tints red with the VERBATIM provider error demoted below the grid
(never an engine-shaped error); every tile links to its smoke run in the Studio (the
sweep IS a matrix run over a hidden built-in smoke case). Header: "N/8 engines
healthy" + staleness ALWAYS shown (amber when old → green "just now" post-sweep;
on-demand only, no scheduler, no nudge) + "Run sweep". The subtitle carries the
load-bearing semantics: **ENGINE health ≠ model quality** — a model may honestly
fail the smoke case and still be a healthy row; ≈24 LLM calls, no user data. The
judge-model knob sits beneath as its own card: the 024-A picker pattern offering
ONLY registry-known models, with an always-on 🔒 footer showing the EFFECTIVE judge
(`claude-opus-4-8` when unset — never a blank implying "configured") + its double
duty (eval verdicts + publish-gauntlet judge). UI-only — the setting exists
end-to-end, no migration.

## Key Patterns

- Matrix card anatomy: `⧉ Matrix run · N configs · M cases` header → one gate
  semantics line → 055-B sub-rows → aggregation footer (mean±σ grid + Δ column +
  tagged analyst notes).
- Determinate unit bar: 3px gradient (`--color-primary-strong → --color-accent-violet`)
  in a `--color-primary-dim` track + a mono `case i/N · arm · u/U` caption.
- Advisory-feedback vocabulary: violet (`--color-accent-violet`) = information/
  critique; green/red stay reserved for verdicts; amber for needs-you/stale.
- Health tile: logo + name + ✓/✗ + mono model; red tint ONLY with a verbatim
  provider error attached.

## What to Avoid

- Flat-flooding RunHistory with N top-level rows per matrix click (the rejected B).
- Progress pips for user-defined case counts (die past ~5 cases — the rejected 059-B).
- Presenting per-click aggregation as if one click bought repeats (spread comes from
  history; no repeat knob).
- LLM-written analyst prose where deterministic rules were promised.
- Engine-shaped errors on the health board; ✗ without the verbatim provider error.
- A judge picker offering models the registry doesn't know (the picker↔registry
  drift lesson), or hiding the effective default when unset.

## Origin

Synthesized from sketches: 058, 059, 060 (Phase 137.1, 2026-07-04).
Source files: sources/058-matrix-launch-and-rows/, sources/059-determinate-progress-and-case-feedback/,
sources/060-engine-health-card/
