# Phase 175: Cross-Provider Streaming Fidelity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-22
**Phase:** 175-cross-provider-streaming-fidelity
**Areas discussed:** XPROV-01 depth, XPROV-02 DeepSeek strip-vs-execute, XPROV-03 title-gen narrow-vs-sweep, Honest-degrade surface, XPROV-04 reasoning-provider title quality (operator-flagged mid-discussion)

---

## XPROV-01 — reasoning-first OpenAI tool support depth

| Option | Description | Selected |
|--------|-------------|----------|
| Stopgap + honest error | Registry-capability stopgap so gpt-5.6 works without a 400 + honest hint; defer the full /v1/responses adapter to SEED-114. Fits the cleanup milestone. | ✓ |
| Full /v1/responses adapter now | Build the real Responses-API adapter this phase — keeps BOTH tools + reasoning; largest lift; risks ballooning the cleanup phase. | |
| Honest-degrade only | Don't make gpt-5.6 tool-capable; just make the failure honest; defer both stopgap + adapter. | |

**User's choice:** Stopgap + honest error.
**Sub-decision (stopgap behavior):** "Keep reasoning, tools via prompt path" — registry marks reasoning-first models `native_tools:False` (reasoning ON, tools via XML injection), NOT `reasoning_effort:'none'` (which would neuter reasoning). Capability-keyed flag, never a hardcoded id list.
**Notes:** Full Responses-API adapter (keeps both tools + reasoning) deferred to SEED-114 / a dedicated OpenAI-adapter phase. Folds BUG-260714-01 + BUG-260711-02 (un-defers the latter).

---

## XPROV-02 — DeepSeek tool-markup leak: strip-vs-execute

| Option | Description | Selected |
|--------|-------------|----------|
| Harden floor + honest-incomplete | Verify/harden the shipped strip (no dirty render on long turns + partial chunks); on leak, surface an honest "emitted a tool call as text — didn't run" signal. Defer re-parse-to-execute as a seed. | ✓ |
| Re-parse-to-execute now | Buffer the DSML block → synthetic structured tool_call → inject into finish event so the tool actually runs. More work + tests on a hot gateway. | |
| Strip-only, verify as-is | Just confirm the existing guard holds under SC#10 long-turn UAT and close. | |

**User's choice:** Harden floor + honest-incomplete.
**Notes:** Strip already shipped (`_strip_deepseek_tool_markup`, commit 2f18f870). Re-parse-to-execute deferred as a seed. Reuse existing honest-fail SSE vocabulary for the incomplete signal.

---

## XPROV-03 — title-gen fallback: narrow-vs-sweep

| Option | Description | Selected |
|--------|-------------|----------|
| Shared guard, all 4 sites | One helper "never send a utility model to a provider it doesn't belong to" applied at title + suggestion + sub-agent + task resolution. Root-cause fix. | ✓ |
| Title-gen only (exact req) | Fix only thread_title.py; leave the same latent pattern in 3 other paths. | |

**User's choice:** Shared guard, all 4 sites.
**Notes:** Code moved to thread_title.py in the 162.5 extraction. Folds BUG-260623-01. Additive, boundary-only, Deep byte-identical.

---

## Honest-degrade surface (UX)

| Option | Description | Selected |
|--------|-------------|----------|
| Suppress-when-fine + honest real copy | No banner when the primary utility model would succeed; name a genuine substitution honestly; clearer gpt-5.6 hint instead of "model parameter error". | ✓ |
| Minimal | Just remove the misleading banner + a slightly clearer gpt-5.6 error string. | |
| Picker-level capability signal | Surface capability limits in the model picker itself. Bigger UI lift; overlaps Phase 178. | |

**User's choice:** Suppress-when-fine + honest real copy.
**Notes:** Stays at the adapter/sanitizer boundary; no picker-level tagging this phase.

---

## XPROV-04 — reasoning-provider title quality (operator-flagged mid-discussion)

Operator flagged: title-gen "works" on all providers but Google/DeepSeek/Kimi/etc. produce a degenerate first-few-words-of-prompt title, not an LLM summary. Root cause read from code (`thread_title.py`): the derived-title fallback fires by design because reasoning providers get a tiny title-token budget (protects run-start latency — title-gen awaited inline before the producer spawns) and burn it on hidden `<think>`.

| Option | Description | Selected |
|--------|-------------|----------|
| Fold bounded fix into 175 | Add XPROV-04: reasoning providers emit a real title via reasoning-off on the title call (sibling of XPROV-01), provider-docs-first, scoped; unsafe providers keep the honest derived fallback. | ✓ |
| Keep separate — log bug, defer | File a reported-bug and defer the fix to a future phase. | |

**User's choice:** Fold bounded fix into 175 (→ XPROV-04). Captured as BUG-260722-01 (status: folded → 175).

**Companion question — per-provider title-model SELECTOR in Settings:**

| Option | Description | Selected |
|--------|-------------|----------|
| Plant as seed, defer | New seed for a Settings surface to pick the title-gen model per provider + fallback. | ✓ |
| Note only in CONTEXT deferred | Record in CONTEXT deferred without a standalone seed. | |

**User's choice:** Plant as seed → SEED-126 (deferred; net-new Settings surface).

---

## Claude's Discretion

- Exact registry marker name/shape for the reasoning-first capability flag (`reasoning_first` vs `tool_endpoint`) — must be capability-keyed, not an id list.
- Exact wording of the honest hints/copy.
- The shape/signature/home-module of the shared utility-model guard helper (D-03).
- The exact per-provider reasoning-off mechanism for the title call (D-05) — resolved by provider-docs-first research.

## Deferred Ideas

- Full OpenAI `/v1/responses` reasoning-first adapter → SEED-114.
- DeepSeek re-parse-to-execute (make the leaked tool actually run) → seed.
- BUG-260718-04 (per-thread model not remembered) → Phase 178 chat-polish, NOT this phase.
- OpenRouter-specific 400s (BUG-260714-02, external surface) → stay OUT.
- Picker-level capability tagging → Phase 178 if wanted.
- Per-provider title-generation-model + fallback selector in Settings → SEED-126.
