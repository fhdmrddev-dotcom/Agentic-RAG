# Phase 128: Chat Tool-Card Unification + Chat-Area Reclaim - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 128-chat-tool-card-unification-chat-area-reclaim
**Areas discussed:** Reported-bug folding, G-5 audit, Cross-provider proof bar, Logos + dependency

> Context note: this phase is G-2 sketch-gated. Sketches 048/049/050 (winners ALL **A**,
> operator-approved 2026-06-27, MANIFEST decisions 38–40) locked the visual/UX direction
> BEFORE this discussion — so discuss-phase settled only the implementation forks the sketch
> left open (cross-provider correctness, the two mandatory guardrail checks, the logo dep).
> The operator accepted all four recommendations verbatim.

---

## Reported-bug folding (mandatory cross-check)

3 open `surface: Agentic-RAG` reports overlap the phase domain.

| Option | Description | Selected |
|--------|-------------|----------|
| TDP-02 + conditional reseed | Fold the TDP-02 description fix; fold BUG-260610-01's timer-reseed ONLY if planner confirms it's the same canonical RunStatusStrip 128 owns; leave the 'Setting up agent…' banner + title-gen causes for a run-legibility phase; defer the duplicate-avatar race + BUG-260609-02. | ✓ |
| Also fold banner-honesty | Above PLUS the frontend banner-honesty fix (toolMeta.ts:73). Same family, single biggest fix for the 'major' bug — but unsketched, widens the phase. | |
| TDP-02 slice only | Fold nothing but the core description fix; leave ALL of BUG-260610-01 open. | |

**User's choice:** TDP-02 + conditional reseed (Recommended)
**Notes:** Reports' frontmatter updated to reflect routing — `setting-up-agent-hides-model-activity` stays open (partial/TDP-02 slice), `BUG-260610-01` stays open (conditional timer-reseed fold + dup-avatar deferred), `BUG-260609-02` stays open (harness Sub-Results panel surface, tangential).

---

## G-5 audit (mandatory guardrail)

`ToolCallPanel.tsx` / `MessageItem.tsx` / `RunCard.tsx` / `ChatArea.tsx` re-touched.

| Option | Description | Selected |
|--------|-------------|----------|
| Proceed + shared helper | Proceed (surgical + net-subtractive; CTC-03 deletes a whole timer bar; ToolCallPanel/MessageItem debt paid at 075.7; threads.py untouched). Micro-extraction: one shared providerLogo()/header helper so RunCard + ToolCallPanel don't both grow copies. | ✓ |
| Proceed, no extraction | Same proceed verdict, edits in place, mild duplication. | |
| Refactor-first phase | Block 128 behind a dedicated refactor phase (strict G-5 reading). | |

**User's choice:** Proceed + shared helper (Recommended)
**Notes:** CTC-03 is the "refactor dividend" — it removes one of three redundant elapsed surfaces, shrinking the ChatArea hot file.

---

## Cross-provider proof bar

The acceptance gate that "CTC-02 holds" before CTC-03 deletes the fallback sticky timer.

| Option | Description | Selected |
|--------|-------------|----------|
| Live native-7 + OpenRouter | Live SC#10 across the full roster (OpenAI/Anthropic/Google/DeepSeek/Moonshot/GLM/MiniMax + OpenRouter), then CTC-03 deletion as the last gated plan. | ✓ |
| Live big-4 only | Live SC#10 representative-4 only; leaves DeepSeek/Moonshot/GLM/MiniMax unverified. | |
| Static 8-provider matrix | The sketch's static screenshot matrix only (no live run). | |

**User's choice:** Live native-7 + OpenRouter (Recommended)
**Notes:** Mocks/static have false-greened cross-provider in this codebase before (122 caught 2 live bugs). TDP-02 honest fallback locked: show description only when present, quiet `Preparing {tool}…` otherwise, never fabricate.

---

## Logos + dependency

How to ship the CTC-01 provider logos. `@lobehub/icons` is not yet a dependency.

| Option | Description | Selected |
|--------|-------------|----------|
| @lobehub/icons package | Maintained, tree-shakeable official-mark package (~8 marks, negligible bundle, MIT). Fallback rule: OpenRouter→OR mark, Ollama→Ollama mark, LM Studio/OpenAI-compat/unknown→brand-pulse Bot dot. | ✓ |
| Vendored SVGs from 048/logos/ | No new dep, but manual updates + gradient-ID collision risk the wrap-up already hit. | |

**User's choice:** @lobehub/icons package (Recommended)
**Notes:** 048/logos/ SVGs drop to reference. Planner to verify the package covers the exact provider set + tree-shakes under Vite.

---

## Claude's Discretion

- CTC-04 clamp threshold (line-count vs char-count vs overflow-detect) — overflow-detect is the recommended default.
- The exact shape/name of the D-05 shared header helper.

## Deferred Ideas

- `setting-up-agent-hides-model-activity` causes (b) banner-honesty (toolMeta.ts:73) + (c) title-gen-async (threads.py:1039) → dedicated run-legibility & latency phase.
- `BUG-260610-01` duplicate empty-assistant-avatar (StreamsProvider/MessageList double-mount) → run-honesty cluster slot.
- `BUG-260609-02` Sub-Results panel desc loss → run-honesty cluster slot.
- Sketch 049-B (promoted floating-chip trigger) → documented fallback only if users report lost always-visible status post-ship.
