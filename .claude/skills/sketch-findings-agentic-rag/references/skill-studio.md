# Skill Studio (Phase 137 — PANEL-01)

The consolidation of the whole v3.2 eval experience, born from the operator's own
136-UAT feedback: gate status only discoverable inside a confirm dialog; "Publish
ready 1/1" beside "0/2 cases passed" reading contradictory; verbatim *"messy UI, too
much information."* The cure: the eval experience LEAVES the 384px edit panel.

## Design Decisions

**053 + 057 — ONE focused full-surface Studio: persistent header + 3 tabs (winners:
053-A + 057-A + the operator Tuner⟷Evals lock).**
The skill detail panel slims to form + ONE gate line + "Open studio" + counts. The
Studio (041-A `ActiveView` form; `‹ Skills` returns with selection + panel state
preserved) owns **Evals · Triggering · Versions** as tabs under a persistent header
(skill name + vN + LIVE + a compact gate strip visible on EVERY tab); landing tab =
Evals. **The shipped Trigger Tuner is ABSORBED as the Triggering tab** — internals
untouched (a re-homing, not a rebuild; the old `skill-tuner` ActiveView value
redirects, no orphan surface). Nav contract (the 057 MAP is the build reference):
the 044-A lint "Tune this →" re-points to Studio·Triggering; the 136
`PublishGateDialog` gains ONE net-new "Review evals →" link on the unmet branch;
tabs are deep-linkable (gate line → Evals, lint → Triggering, version row →
Versions). Chat→Studio links = out of scope.

**054 — Skill publish status = the lifecycle stepper (winner: B).**
**Cases → Eval → Gate → Published** as a quiet 4-node journey; each count lives ON
its stage node (case count · latest-run verdict · gate passed/measured · published
state) so every number is spatially bound to what it measures — the "1/1 beside 0/2"
contradiction dissolves into sequential stages. ONLY the current stage narrates
itself (one message box — 052-A quiet-idle discipline); `passed_on_older_version`
reads as "the passing eval is stale — it measured vN-1, the live skill is vN"; the ⚡
collision (gate met on an earlier passing run + newest run failed) renders as a met
Gate node WITH the Eval node carrying the newest run's honest count. The Publish
button mirrors the gate (one source of truth); a force-publish override record ALWAYS
renders (amber receipt, never softens). The stepper is the DESIGNED status home (top
of the Evals tab + the detail panel's status section); the Studio header's gate strip
is a CONDENSATION of the same server `PublishGate` — never a second truth-teller.
A skill-scale, calm cousin of the workflow gauntlet — stage language rhymes, no
energy effects.

**055 — Eval run history = expandable rows (winner: B).**
Run rows (provider logo [048 map] + model + version binding + honest rollup) **expand
IN PLACE** to per-case detail — no navigation state; other runs stay visible. Detail
= side-by-side WITH/WITHOUT arms, judge verdict chip + score + reason, token counts,
and "your rating" thumbs **labeled DISTINCT from the judge's verdict** (two truths,
never blended). The honest state set is load-bearing: `not_measured` = *excluded,
never failed* (rollup appends "· N not measured"); `judge_error` = neither pass nor
fail; an interrupted run gets a banner + re-run (never silent); a running run shows
live per-arm progress with NO mid-run verdicts. Shipped as `RunHistory.tsx` +
`RunCaseDetail.tsx`; prompt-first case headers (the uuid NEVER appears as a label).

**056 — Version history = table + compare picker (winner: B).**
A scan-first table — version · origin chip · eval-on-this-version binding · date,
LIVE badged — plus an explicit **any-to-any Compare v[x] ↔ v[y]** picker rendering
ONE unified diff (reuses the 135 `lineDiff`). Provenance chips derive from
`SkillVersion.source` (⊕ created / ✎ edited / ✨ promoted-from-proposal / ⚡
force-promoted); a force-promoted version's failed `PromotionGate` evidence stays
visible un-softened; per-version eval bindings are what make 054's
`passed_on_older_version` stage legible. **"Restore" is deliberately ABSENT** —
versions are immutable; any future restore must mint a NEW version.

## Key Patterns

- Focused-surface recipe: `ActiveView` switch + `‹ back` that preserves selection;
  persistent identity header; tab strip; every tab shares the same gate condensation.
- Stage-node anatomy (054-B): glyph node + count-on-node + connector; current stage
  = the only narrator.
- Run-row grammar (055-B): logo + model + mono version + right-aligned honest rollup;
  expand-in-place body. **This is the base grammar Phase 137.1's matrix rows extend.**

## What to Avoid

- Hosting multi-subsurface experiences in the 384px detail panel (the "messy UI"
  root cause; same wall the Tuner hit at 041).
- Two truth-tellers for the gate (any second computation of publish-readiness).
- Blending human ratings with judge verdicts; coloring `not_measured`/`judge_error`
  as failure.
- Navigation-state run detail (a separate page) when scanning runs is the job.
- A "Restore" action on immutable versions.

## Origin

Synthesized from sketches: 053, 054, 055, 056, 057 (Phase 137, 2026-07-03).
Source files: sources/053-eval-studio-shell/ … sources/057-skill-studio-linkage/
