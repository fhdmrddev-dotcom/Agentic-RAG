# v3.1 — Consolidated Scope & Recommendation

*Merge of `ADVISORY.md` (Wave 1: Anthropic skills model + skill-creator + collision + IA) + `WAVE2-ADVISORY.md` (Wave 2: multi-provider + context/memory + task-desc parity + Workflow Studio UX + self-improving) + `COLL-03-EVIDENCE.md` (live confirmation) + `OPERATOR-INPUTS.md`. This is the artifact `/gsd:new-milestone` should consume.*

## ✅ DECISION — LOCKED 2026-06-21 (operator-approved)

**v3.1 = "Workflow & Skill Studio — Trust, Clarity & Triggers" (Option A).** Self-improving = the bounded human-in-the-loop **description-only** proposer (SI-02) as a v3.1 **STRETCH**.

- **v3.1 CORE:** COLL-01 · CTX-01 · IA-01 (collision + clarity) · MP-01 · MP-02 · MP-03 · TDP-01 (cross-provider trust + honesty parity) · TRIG-01 · TRIG-03 · CTX-03 (skill triggering quality) · WUX-01 · WUX-02 (UX soul + strict↔loose)
- **v3.1 STRETCH:** SI-02 (bounded description proposer) · TRIG-02 · WUX-03 · TDP-02 · MP-04 · COLL-02
- **DEFER → v3.2 "Skill Eval Studio (full) + Self-Improving":** SI-01 (skill_versions + eval tables + run_skill_eval + grader/comparator/analyzer + review viewer + publish gate) · STD-01 · DISC-01 · the full instruction-body self-improvement loop
- **OWN SLOTS / BACKLOG:** CTX-02 (compaction) · CTX-04/05
- **WUX routing:** resolved — the Workflow Studio UX (soul + strict↔loose) lands in **v3.1** (Option A), NOT v3.2 "Operator UX" (which stays IT-admin/deployment).

*The 3 options + full rationale are retained below for the record; Option A is the chosen path.*

---

**Bottom line up front:** the operator's full ask (skill quality + triggering + creation/eval + collision fix + UX simplification + full multi-provider + context/memory + task-desc parity + self-improving) is **~22 candidate requirements across 3 substantial substrates — genuinely 2-3 milestones, not one.** Both research waves reached this independently. The job now is to pick the v3.1 cut.

---

## Confirmed facts (not hypotheses)

- **The collision is root-caused (Mechanism A).** Live DB evidence on thread `99af24d5`: a skill `execute_code` that saved ONE file emitted TWO `output_files` — the second is the workflow's leftover `.docx` (37,328 B, tagged `is_hero:true`) still sitting in the thread-shared `/sandbox/output/`, re-emitted by the unfiltered `harvest_output_files`. Fix = **COLL-01** (run-scope the harvest). Mechanism B (template resolver) did NOT fire here. See `COLL-03-EVIDENCE.md`.
- **Removing the chat Harness pill (IA-01) does NOT fix the collision** — the workflow + Deep chat share a thread even when launched from the Workflows page (you "Continue" and chat in the workflow's own thread). IA-01 is a clarity win; COLL-01 + CTX-01 are the actual fix.
- **Our skills design is correct + standard-aligned.** `skills` table + catalog injection + `load_skill` tool = the now-standard `agentskills.io` `SKILL.md` model; routing activation through a normal tool call is the ONLY mechanism that works identically across all providers — do not chase provider-native loaders.
- **The eval+versioning backend does not exist yet** (`skill_versions`/`current_version_id`/`skill_modes` = 0 hits in `full-schema.sql`). It is the v3.1 PRD's own planned spine — large enough to be most of a milestone by itself.

---

## Merged candidate requirements (ID · one-liner · tier · effort · source)

**Collision & IA (fixes — small):**
- **COLL-01** — run-scope the sandbox harvest baseline (kills the 2-files bug). CORE · S · *confirmed*
- **CTX-01** — add `messages.origin = deep|harness` + filter in `_reconstruct_history` (stop replaying the other mode's rows). CORE · M
- **IA-01** — remove composer Harness pill → 2-pill General/Explorer (keep the lock/409/reconcile). CORE · S · frontend-only · G-2 sketch
- **COLL-02** — run-scope the `template_input` resolver (defense for the render_template path). STRETCH · S

**Cross-provider trust (the operator's "all providers + honesty" ask — small/med):**
- **MP-01** — force→coerce **retry ladder** in `forced_emit` (fixes silent no-metadata 400 on the default model). CORE · S · ★★★★★
- **MP-02** — explicit doc-verified `emit_tier` field; drop DeepSeek function-level `strict` (inert); **KEEP GLM forcing** (intentional D-15), live-verify GLM strict only. CORE · S
- **MP-03** — Eval treats **provider as a first-class axis**: per-provider scoreboard (trigger/force/recovery/honest-fail), pass-OR-documented; **gates any MP-02 row flip**. CORE · M
- **MP-04** — MiniMax malformed-args boundary repair + OpenRouter `require_parameters`. STRETCH · S
- **TDP-01** — **ungated** prompt nudge to fill `execute_code.description` + deterministic frontend summarizer floor (OpenAI-parity task labels on ALL providers). CORE · S
- **TDP-02** — stream `description` live before `tool_start` (preparing-window honesty). STRETCH · M

**Skill quality / triggering (net-new, high product value — med):**
- **TRIG-01** — **Skill Trigger Tuner**: held-out should/should-not-trigger benchmark (60/40, 3 runs, ≤5 iter, pick by held-out), cross-provider on production model-ids. CORE · M · ★★★★★
- **TRIG-02** — smart-dispatch relevance pre-filter + catalog token budget (G1). CORE/STRETCH · M
- **TRIG-03** — description-quality lint at `save_skill`/skill-creator. CORE/STRETCH · S
- **CTX-03** — pin loaded-skill instructions out of the trim window (skills don't fall out mid-session). CORE · S

**Skill eval + versioning foundation (net-new — LARGE, the PRD spine):**
- **SI-01** — `skill_versions` table + immutability trigger + eval tables (`eval_cases/runs/run_outputs/feedback`) + `run_skill_eval` + grader/comparator/analyzer sub-agent roles (reuse `task` + Phase-102 judge + `check_coverage`) + with-skill-vs-snapshot baseline + review viewer + skill publish gate. CORE-of-its-own-milestone · L · ★★★★★
- **SI-02** — human-in-the-loop **description-only** self-improvement proposer (eval → propose diff → DRAFT → human approve → immutable version; never auto-publish; held-out selection; judge-as-gate). STRETCH · M
- **STD-01** — agentskills.io frontmatter enforcement (name rules, description ≤1024, optional metadata.version). STRETCH · S
- **DISC-01** — executable skill bundle / "run skill script" primitive (close the "code never enters context" gap; sequence AFTER COLL-01). STRETCH/LATER · M

**Context/memory (engine work — large):**
- **CTX-02** — SEED-041 rolling compaction (summarize trim-head instead of deleting). Own-slot · L · ★★★★★
- **CTX-04/05** — read_document cap + per-provider token estimation; relevance-ranked recall. Backlog

**Workflow Studio UX (the operator's clarity ask — mostly re-skin):**
- **WUX-01** — the **"soul of a workflow"** object surfaced in 3 sizes (card/run-header/publish-summary): purpose (`business_requirement`, shown nowhere today) + needs + glyph-dot spine (strip type ribbons/index) + one tier chip + output line. CORE · M · ★★★★★
- **WUX-02** — **strict↔loose** disclosure keyed off `deriveTier` (two doors: "Describe & run" vs "Author & govern"; nothing removed, advanced demoted one click). CORE · M
- **WUX-03** — gauntlet pip-strip + worded verdict + raw-on-demand; quiet idle PhaseCards. STRETCH · M

---

## The recommended split (3 options — operator picks)

### ⭐ Option A (recommended) — v3.1 "Trust, Clarity & Triggers"; full Eval Studio → v3.2
Delivers ALL the operator's concrete pains at a meaningful level, mostly fixes + re-skin + the highest-value skill-quality slice; defers the heavy net-new eval backend to its own slot.
- **v3.1 CORE:** COLL-01 + CTX-01 + IA-01 (collision + clarity) · MP-01 + MP-02 + MP-03 + TDP-01 (cross-provider trust + honesty parity) · TRIG-01 + TRIG-03 + CTX-03 (skill triggering quality) · WUX-01 + WUX-02 (UX soul + strict/loose)
- **v3.1 STRETCH:** TRIG-02 · WUX-03 · TDP-02 · MP-04 · COLL-02 · SI-02 (bounded description proposer)
- **v3.2 "Skill Eval Studio (full) + Self-Improving":** SI-01 (the 5-table eval+versioning spine + viewer + publish gate) · SI-02 (if not done) · STD-01 · DISC-01
- **Own slots / backlog:** CTX-02 (compaction) · CTX-04/05
- *Why:* the collision is a live bug, the UX is actively painful, the cross-provider honesty gap affects everything — all small/med and shippable now; the Trigger Tuner gives real skill-quality value without the full eval backend; the big eval build gets the room it needs in v3.2.

### Option B — v3.1 "Skill Eval Studio (foundation-first)"; fixes/UX → v3.2
Builds the PRD spine first.
- **v3.1 CORE:** SI-01 (eval+versioning foundation) · TRIG-01 · MP-01 + MP-03 (provider reliability that makes eval trustworthy) · COLL-01 + CTX-01 (collision)
- **Defer:** WUX-* (UX overhaul), TDP-*, MP-02/04, CTX-03, SI-02 → v3.2
- *Why:* matches the literal "Skill Studio focused on eval" framing; but defers the UX simplification the operator emotionally wants, and SI-01 alone fills most of the milestone.

### Option C — one ambitious v3.1 (accept overstuffing risk)
Everything CORE from A + SI-01. **Not recommended** — both waves flagged this as the v3.0/075.x cascade risk (8 phases on one hot surface). Realistic only if the operator accepts a long milestone and a hot-file refactor budget (threads.py G-5 already firing; context_window/agent_loop trim path; PhaseTimeline/PhaseCard shared with live harness).

---

## Open decisions the operator must make
1. **Which split** (A / B / C above). *(Recommend A.)*
2. **Where the Workflow Studio UX (WUX) lands** — it does NOT auto-belong to v3.2 "Operator UX" (that slot = IT-admin/deployment, not workflow-author legibility). Options: (a) WUX in v3.1 (Option A), (b) re-scope v3.2 to absorb author-UX, (c) give WUX its own slot.
3. **Self-improving** — bounded, human-in-the-loop, description-only proposer (SI-02) as a v3.1 STRETCH? Anthropic's stance: direction yes, autonomy no; full auto-improvement stays a LATER slot (the v3.1 PRD already marks "auto-improvement via meta-eval" out of scope).

---

## Guardrails that fire regardless of split
- **G-2 sketch-first** on IA-01 + all WUX (live UI / "feels like").
- **G-5 hot files:** `threads.py` (firing), `context_window.py`/`agent_loop.py` trim path, `PhaseTimeline.tsx`/`PhaseCard.tsx` (shared with live harness — re-run replay tests).
- **Cross-provider SC#10** as an eval axis (MP-03), not just manual UAT.
- **Never fork the shared path** — provider differences stay at the gateway/adapter/sanitizer boundary (D-14 RED LINE).
