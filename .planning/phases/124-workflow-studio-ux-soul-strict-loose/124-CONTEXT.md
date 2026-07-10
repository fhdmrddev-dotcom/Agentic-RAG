# Phase 124: Workflow Studio UX — Soul + Strict↔Loose - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-skin the Workflow Studio surfaces so a workflow's **"soul"** reads at a glance in
three consistent sizes (library card / run header / publish summary), and the
authoring/running entry becomes a clear **strict↔loose two-door disclosure**
("Describe & run" vs "Author & govern"). **Pure-frontend** — surfaces existing-but-hidden
data (`business_requirement`, `deriveTier`), removes/demotes nothing, adds no schema.

Requirements: **WUX-01** (soul in 3 sizes), **WUX-02** (strict↔loose two doors).

**G-2 sketch gate: SATISFIED** — sketches **046-A** (purpose-led soul object) and **047-A**
(explicit-fork two doors) are both winner-A, **operator-approved 2026-06-26**. The
mockups are the acceptance bar (SC#4) — the build MUST match them.

</domain>

<decisions>
## Implementation Decisions

### Launch seam vs Phase 121 (WUX-02)
- **D-01:** The two-door fork (Describe & run / Author & govern) lives at the **Studio/authoring ENTRY only** — reached via "New workflow" and via "Author & govern" on an existing draft. The **library card's Run** stays the one-click **launch-into-thread** exactly as Phase 121 shipped it; the fork never wraps or replaces it. This preserves 121's single-front-door consolidation: a loose user who wants to run a published workflow clicks Run and goes; a user who wants to *create or shape* a workflow enters the Studio and meets the doors.

### Soul object (WUX-01)
- **D-02:** **Pure-frontend.** `business_requirement` already exists on `WorkflowDefinition` (`backend/app/models/harness.py:240`) and is a publish-time required invariant (D-13 — every *published* workflow declares exactly one). `deriveTier`/`TIERS` already exist (`frontend/src/components/workflows/deriveTier.ts`). 124 surfaces these hidden fields — **no migration, no new authoring field, no backend touch.**
- **D-03:** **Honest empty-states — the soul never shows blank and never lies.** A **draft** purpose (`business_requirement` may be null pre-publish) renders **"draft · purpose not declared yet."** The **output line** reads the workflow's terminal `llm_emit` deliverable when present (e.g. "Status Report · .docx"), else an honest **"produces: answer in chat"** for workflows with no file deliverable. The atom is always rendered.
- **D-04:** Soul = **5 atoms, purpose-led** (per 046-A): `business_requirement` (HERO at every size) · needs (kickoff `inputs`) · **glyph-dot `PhaseSpine`** (⚙✎🤖⛓☺◆ type glyphs ONLY — type ribbons + phase-index numbers STRIPPED; phase names are quiet labels/`title=`) · ONE tier chip from `deriveTier()` (glyph + WORD, never colour-alone) · output/deliverable line. The **SAME shared, scale-keyed atoms** feed library card → run header → publish summary so a user recognizes the workflow by the same essence in all three (SC#1+2).

### Strict↔loose disclosure (WUX-02)
- **D-05:** Two big door cards side by side (per 047-A): **"Describe & run"** (loose — a describe box + the soul preview + one CTA; descends from 018-A requirement-first authoring) vs **"Author & govern"** (strict — opens the full Builder: read-only vertical phase-spine graph + 400px right-side form panel + ALL advanced controls). Keyed off `deriveTier`: the govern-door advanced controls (`citation_policy` · gate chips · per-phase `folder_scope` · per-phase model) **recompute the tier live**, and `llm_judge_rubric` is **LOCKED always-on** so a STRICT workflow can never be silently downgraded (SC#3+4). A persistent **"‹ both doors"** returns; the describe door carries a visible **"switch to Author & govern ›"** strip so **nothing is lost by picking fast** — advanced is exactly one click away, never removed. Shares the 046 soul header across both Authoring and Running contexts (toolbar context toggle).

### Scope boundary
- **D-06:** On the **publish summary**, 124 **prepends the soul block ONLY.** The gauntlet **ladder rendering** (pip-strip + worded verdict + quiet idle cards) is **WUX-03 → Phase 127 STRETCH**, untouched here.
- **D-07:** **G-5 RED LINE** — the soul header on the run surface is an **ADDITIVE SIBLING** of `panel/PhaseTimeline.tsx` / `panel/PhaseCard.tsx`. Do **NOT** thread soul atoms into PhaseCard internals.
- **D-08:** Deep Mode stays byte-identical; no shared-path fork (SC#10 discipline — this is FE-only chrome, but the red line is stated so the planner keeps it).

### Claude's Discretion
- Exact net-new component file names + placement; CSS token choices within the locked Aether Deep Midnight theme; precise copy strings — all **subject to matching sketches 046-A / 047-A** (the acceptance bar).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` → Phase 124 block — goal, 4 success criteria, WUX-01/WUX-02 mapping.
- `.planning/REQUIREMENTS.md` §WUX-01, §WUX-02 — verbatim requirement text (both G-2 sketch-gated).

### Sketch contract (THE acceptance bar — SC#4)
- `.planning/sketches/046-workflow-soul-object/index.html` + `README.md` — winner-A: the purpose-led 5-atom soul, rendered the same across 3 sizes; the glyph-dot `PhaseSpine`; draft `draft · test run` honesty.
- `.planning/sketches/047-strict-loose-two-doors/index.html` + `README.md` — winner-A: the explicit two-door fork; live `deriveTier` recompute (STRICT→MIDDLE→LOOSE) + locked judge.
- `.planning/sketches/MANIFEST.md` → **Running Design Decisions #36 (046-A)** + **#37 (047-A)** + the **"Phase 124 session"** block (~line 245) — the full locked design contract + documented rejected alternatives.

### Validated design patterns + real data shapes / reuse seams
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — Skill(`sketch-findings-agentic-rag`); auto-loads when building these surfaces.
- `.claude/skills/sketch-findings-agentic-rag/references/workflows-page.md` — `deriveTier()`/`TIERS` single-source-of-truth rule (badge can't drift; NO stored strictness column; real STRICT/MIDDLE/LOOSE → strict/flag/draft vocab only).
- `.claude/skills/sketch-findings-agentic-rag/sources/103-grounding/BRIEF.md` + `APP-LINKAGE-MAP.md` + `DATA-CONTRACT.md` — the real `WorkflowDefinition` vocabulary, the strict↔loose policy mapping, per-phase gate set, launch-path linkage (`POST /threads/{id}/messages` → `create_workflow_run`, SEED-047).

### Predecessor decision (the launch seam this builds on)
- `.planning/phases/121-one-front-door-for-workflows-ia/121-CONTEXT.md` — the single-front-door / 2-pill consolidation D-01 preserves.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/components/workflows/deriveTier.ts` (`deriveTier` + `TIERS`): single source of truth for the tier chip — REUSE, never add a stored `strictness` column. Already used by `WorkflowsPage.tsx`.
- `backend/app/models/harness.py:240` — `business_requirement: str | None` on `WorkflowDefinition`: the purpose hero atom (read-only for 124; required at publish via D-13).
- `frontend/src/components/workflows/PublishGauntlet.tsx` — the publish-summary surface; the soul block prepends here (D-06 soul-block-only).
- `frontend/src/pages/WorkflowsPage.tsx` — the library; card Run = launch-into-thread (Phase 121, untouched by D-01).
- The ⚙✎🤖⛓☺◆ phase-type **glyph map** — reuse for the glyph-dot `PhaseSpine`.

### Established Patterns
- **G-5 hot files** `frontend/src/panel/PhaseTimeline.tsx` + `panel/PhaseCard.tsx`: the soul header is an **additive sibling** (D-07), not a timeline-internals edit.
- **deriveTier is a pure derivation** — card / run header / publish summary can never show a tier that disagrees with the workflow's own gate set.
- Launch primitive: `POST /threads/{id}/messages` → `create_workflow_run(...)` (SEED-047 kickoff seeding) is the ONLY launch path and is preserved.

### Integration Points
- **Net-new (FE):** the horizontal glyph-dot `PhaseSpine`; the shared scale-keyed `WorkflowSoul` atoms/header (3 sizes); the soul block atop the publish summary; the headline `business_requirement`; the two-door disclosure shell + describe box (descends from 018-A).
- The soul header rides on the run surface beside (not inside) `PhaseTimeline`/`PhaseCard`.

</code_context>

<specifics>
## Specific Ideas

- The two operator-approved sketches **046-A** and **047-A** ARE the acceptance bar (SC#4) — the implementation must match them visually and behaviorally; deviations need operator sign-off.
- Tier vocab is locked to the REAL enum: STRICT 🔒 / MIDDLE ◐ / LOOSE ○ → `citation_policy` strict/flag/draft + the actual gate set. NO invented "level 1/2/3", NO "compliance-mode", NO colour-alone signaling.

</specifics>

<deferred>
## Deferred Ideas

- **WUX-03** — publish gauntlet as pip-strip + worded verdict (raw-on-demand) + quiet idle cards → **Phase 127 STRETCH**. 124 stays soul-block-only on that surface (D-06).
- **BUG-260610-01** (timer reseed + duplicated empty avatar on nav during a workflow run; `minor`) — **left OPEN, not folded.** Live-run *mechanics* (timer reseed / reconcile), not the soul/door chrome 124 re-skins. `re_open_trigger`: re-check if the 124 run-header re-skin touches the run strip.
- **BUG-260609-04** (phase card shows placeholder slug `phase-0`; `minor`) — **left OPEN, not folded.** Live-run reconcile-floor clobber, not the static glyph-dot spine 124 builds. `re_open_trigger`: re-check if the 124 run-header / soul-spine re-skin touches phase-card slug rendering.

</deferred>

---

*Phase: 124-workflow-studio-ux-soul-strict-loose*
*Context gathered: 2026-06-26*
