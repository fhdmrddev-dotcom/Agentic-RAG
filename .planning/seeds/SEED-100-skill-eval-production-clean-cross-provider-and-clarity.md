---
seed_id: SEED-100
title: Dedicated phase — make Skill Eval production-clean (cross-provider robustness for ALL providers + user-facing clarity)
status: planted
planted: 2026-07-01
phase_origin: "Operator note after running live evals across the full native roster during/after Phase 133 (2026-06-30 → 2026-07-01). The eval engine + thin --skip-ui surface shipped and verified, but two gaps remain before it's something an end user can trust: (1) the WITHOUT-skill baseline arm trips provider-specific request-shape rules on several providers, and (2) the surface is confusing to a non-expert — it lives in the sidebar with very detailed information and the user doesn't know what 'eval' even means."
category: product + cross-provider robustness — close the Skill Eval feature cleanly, 100%, for every provider, with an end-user-legible surface
related_seeds:
  - SEED-099-feature-visibility-by-role-advanced-features-admin-gated (who sees evals + reframe the label)
  - SEED-095-settings-admin-control-center-provider-model-management-icon-convention (model curation / dynamic registry)
  - SEED-088-dynamic-model-registry-live-discovery-db-backed-ui-managed
related_memories: [project_133_executed, feedback_cross_provider_full_native_roster, feedback_no_cross_provider_regressions, feedback_vibe_coder_communication, feedback_provider_docs_first]
related_bugs:
  - BUG-260630-01 (DeepSeek without-skill reasoning_content 400)
  - BUG-260701-01 (agent-loop assistant prefill 400 on claude-sonnet-5 / 4.6+ family — without-skill arm)
related_decisions:
  - "D-14 red line: fix provider differences at the gateway/adapter/sanitizer boundary; never fork the shared Deep/agent-loop path. The eval without-skill (empty-catalog) baseline must produce a clean completion on ALL 8 providers (OpenAI/Anthropic/Google/OpenRouter + DeepSeek/Moonshot/GLM/MiniMax) — today it 400s on some and returns empty on others."
  - "Phase 134 (EVAL-03/04) owns the honest per-provider verdict + side-by-side + ratings; Phase 137 (PANEL-01, G-2 sketch) owns the DESIGNED eval panel. The clarity work below is that panel's acceptance bar, not the thin --skip-ui surface."
re_open_triggers:
  - "Phase 134 or Phase 137 enters discuss/sketch — fold this in: the panel must (a) explain what an eval is + what with/without means in plain language, (b) hide the verbose run internals behind progressive disclosure, and (c) only show evals to entitled roles (SEED-099)."
  - "Any eval run 400s or returns empty on a provider's baseline arm — the cross-provider hardening below is the fix."
priority: high
suggested_phase: "A dedicated 'Skill Eval — production-clean' phase (after the Phase 133 engine; pairs with 134/137). Two halves: (1) CROSS-PROVIDER ROBUSTNESS — the WITH and WITHOUT arms both complete a clean A/B on all 8 native providers, with provider request-shape traps fixed at the gateway/adapter boundary (assistant-prefill removed for prefill-rejecting models, DeepSeek reasoning_content shape, empty-baseline handling), per the full-native-roster mandate; (2) USER-FACING CLARITY — a legible eval surface that says what it is and what with/without means, with verbose run detail behind progressive disclosure, gated to entitled roles (SEED-099)."
---

# SEED-100 — Make Skill Eval production-clean (all providers + clarity)

Operator note, 2026-07-01, after running live evals across the native roster.

## The two gaps

**1. Cross-provider robustness of the baseline arm.** Phase 133's engine is sound and
the WITH-skill arm works across providers, but the **WITHOUT-skill (empty-catalog)
baseline** trips provider-specific request-shape rules:
- `claude-sonnet-5` (and the Claude 4.6+/5 family): **400 — assistant prefill removed** (BUG-260701-01).
- DeepSeek: **400 — `reasoning_content`** message-shape (BUG-260630-01).
- Some providers (haiku, gemini) returned an **empty** "no response after 2 iterations" baseline rather than a real completion.

Per `feedback_cross_provider_full_native_roster` + D-14, a clean A/B requires BOTH
arms to complete on **all 8 providers**, with the differences absorbed at the
gateway/adapter/sanitizer boundary — never by forking the shared path. This is the
"close it cleanly, 100%, for all providers" the operator asked for.

## The user-facing clarity gap

From the user, verbatim intent: *"as a user I still do not know what that means, and it
is in the sidebar with very detailed information that confuses the user."* The thin
`--skip-ui` surface (correct for Phase 133, D-07) exposes raw run internals. The
designed panel (Phase 137 / PANEL-01) must:
- **Explain the feature** — what a skill eval is, and what "with-skill vs without-skill"
  means, in plain language (`feedback_vibe_coder_communication`).
- **Progressive disclosure** — headline verdict first; the verbose per-case/per-arm
  detail behind a click, not dumped in the sidebar.
- **Role-gate it** — evals are an advanced/admin feature, not default end-user surface
  (SEED-099). Decide who sees it before polishing how it looks.

## Why a dedicated phase

The engine is done; what's left is (a) provider hardening that touches the shared
gateway boundary (needs its own careful, D-14-respecting pass with full-roster UAT) and
(b) a designed, role-gated, legible surface (sketch-gated, pairs with 134/137). Bundling
both as one "production-clean" phase keeps the eval feature from shipping half-trustable.

## Update 2026-07-02 — full-native-roster confirmation + fresh operator design input (Phase 134 UAT)

**Native-4 verdict-honesty confirmed live** (one docx eval run each, DB-verified, browser
spot-checked): DeepSeek `deepseek-v4-flash` (with=graded FAIL·30; baseline=BUG-260630-01
400 → honest `not_measured`), GLM `glm-5.1` (both arms graded), MiniMax `MiniMax-M3`
(both arms graded), Moonshot `kimi-k2.6` (both arms graded). No crashes, no fabricated
scores — the Phase-134 honest-verdict contract holds on all 8 providers. The BASELINE-ARM
fixes (this seed's half 1) remain open for DeepSeek + Claude-4.6+/5.

**NEW finding — picker↔registry drift:** the Settings provider list offers models the
`MODEL_CAPABILITIES` registry doesn't know (`glm-5.2`, `kimi-k2.7-code`), so the eval
router's D-01 validation rejects them with "Unknown model" — the picker can offer a model
the Run button then refuses. Fix belongs to the dynamic-model-registry work
(SEED-088/SEED-095): one source of truth for "models we can actually run".

**Operator design input (2026-07-02, for the Phase 137 sketch — treat as acceptance-bar
material):**
- *"The results are not representative, not user friendly … as a user I did not
  understand what that means."* Specifically: the "2/3 with-skill cases passed" line, the
  FAIL badge, and the raw prompt/response dumps did not communicate. The panel must lead
  with a plain-language outcome sentence (e.g. "This skill made the answers better in 2
  of 3 tests") — scores/arms/judge-reasons behind progressive disclosure.
- **This is a general theme, not eval-only:** the operator names the Tuner (Tune
  triggers) and Workflows as surfaces that "look amazing but have too much information,
  which is confusing." Phase 137's sketch should establish the less-is-more pattern
  (headline first, detail on demand) as the house style these other surfaces later adopt.
- Confirmed to the operator that Phase 137 (PANEL-01, G-2 sketch-gated) is the planned
  designed panel — the operator approves the mockup before build.

## Update 2026-07-04 — BASELINE ROOT CAUSE FOUND + FIXED; four new operator asks

**Root cause of the baseline-arm failures (half 1) found and fixed** (`f47d6736`):
`run_eval_job` reset the shared eval thread ONLY before the WITH arm, so every
WITHOUT arm ran with the with-skill conversation still in history. That one bug
produced the whole baseline symptom family:
- DeepSeek thinking mode 400 "`reasoning_content` must be passed back" on the
  replayed assistant turn → **BUG-260630-01's likely root cause** (re-verify live,
  then close);
- Gemini/GPT "empty response after 2 iterations" baselines (model sees the question
  already answered above it);
- contaminated A/B (an answering baseline could crib from the with-skill output).
Fix = reset before EACH arm; regression test `test_thread_reset_before_each_arm`.
BUG-260701-01 (Claude 4.6+/5 prefill 400) may be a genuinely separate request-shape
trap — re-test after this fix before assuming it's closed.

**Also fixed live the same day:** orphaned `running` eval run (gemini, 2026-07-02)
manually flipped to `interrupted` — BUG-260702-02 (restart reconciliation) remains
this seed's ops item.

**New operator asks (2026-07-04) — fold into the production-clean phase:**
1. **Automated cross-provider ENGINE smoke sweep** — one representative model per
   provider × all 8 (native-7 + OpenRouter; exclude local), one case, asserting
   engine health per arm (arm completes; verdict `graded` or honest `not_measured`
   with a REAL provider error — never an engine-shaped error), NOT model pass/fail.
   ~24 LLM calls/sweep. This is the operator's trust bar: "how do I know it reflects
   reality for each model without hand-running all 8."
2. **Judge evidence channel** — the judge grades ONLY `full_content_final`; a model
   that genuinely creates the file (deepseek docx: real tool_calls, real file) but
   writes a one-line prose answer fails as "unverifiable claim". Feed the judge a
   bounded tool-trace/evidence digest alongside the answer so honest-but-terse runs
   grade on what actually happened.
3. **Determinate run progress** — Run button currently greys with a spinner; the
   live per-case list is sparse for 1-case runs. Cheap determinate bar: total units
   = cases × 2 arms (+ judge step), events already stream per arm.
4. **Parallel / provider-matrix runs** — the one-eval-per-SKILL 409 guard is
   deliberate (publish gate reads the LATEST run; panel attaches to a single live
   stream; proposer source-run semantics). Different skills already run in parallel.
   The wanted feature is a matrix run: one click fans out N providers as N run rows
   in parallel (providers are independent APIs — operator is right), with explicit
   gate semantics (which run feeds the gate) + multi-run live UI. Pairs naturally
   with ask #1.
