# Cross-Provider Chat Polish (Phase 128)

## Design Decisions

**048 — Unified cross-provider tool card = provider-logo avatar +
preparing-description-before-`tool_start` + ONE byte-identical layout on all 8
providers (winner: A — real brand marks).**
The header avatar (previously a generic gradient `Bot` dot identical for every
provider) becomes the provider's REAL official logo (`@lobehub/icons`: OpenAI /
Claude / Gemini / DeepSeek / Kimi / Zhipu / MiniMax / OpenRouter — brand-colour marks
on a faint per-provider tinted backing; the `brandPulse` ring stays while streaming).
The agent's `tc.args.description` ("about to…") surfaces DURING the `preparing`
window, before `tool_start` (TDP-02). The card reads byte-identically across all 8
providers (CTC-02) — proven by a calm STATIC 8-provider uniformity matrix; only the
logo differs. Already-wired (no flag): `message.provider`/`message.model` (the
`{provider} · {model} · turn N` sub), `tc.args.description`, the `RunStatusStrip`.
Net-new: the logo ART (`providerLogo.tsx` single-source map; `message.provider →
logo` is a one-line map). Rejected: unified monochrome glyph (calmest but loses brand
recognition), logo + wordmark chip (busiest). This card is the canonical surface the
048 logo map serves everywhere (scoreboards, run rows, engine-health tiles).

**049 — Chat-area reclaim = DELETE the redundant sticky composer timer; the header
strip + floating chip are the ONLY status homes (winner: A — clean removal).**
Three elapsed surfaces existed; the old `StickyTimerBar` above the composer
duplicated the canonical `RunStatusStrip` (header while in view) + the floating
"↓ Jump to live" chip (on scroll-away) and was the motivating "shows for some
providers, vanishes for others" bug. Remove it + its mount; the composer reclaims the
space. **Gated on CTC-02 holding** (only remove once the 048 card is verifiably
canonical). Pure subtraction, NO net-new wire. B (a promoted floating-chip trigger)
was REJECTED because the operator could not perceive the A/B difference — a net-new
trigger rule isn't worth a delta no one can feel (documented FALLBACK only if users
report lost always-visible status post-ship).

**050 — Long USER prompt = clamp to a 7-line preview + fade + inline "Read more"
(winner: A).**
A long pasted prompt collapses to `-webkit-line-clamp:7` with a fade **matched to the
violet end of the bubble's 135° gradient** (not the page bg) + an inline "Read
more"/"Show less" chip. SHORT prompts render UNCHANGED; right-alignment, the
`rounded-br-md` tail, `max-w-[70%]`, `pre-wrap`+`break-words`, and the avatar all
preserved. **Scope = USER prompts ONLY** (never clamp the assistant branch — it has
its own preview path). Net-new: NONE — pure client-side clamp; cheapest honest impl =
always render the clamp container, reveal fade + Read-more only when `scrollHeight >
clientHeight`.

## Key Patterns

- Provider logo rule: ONE source (`@lobehub/icons` via `providerLogo.tsx`), identical
  everywhere; sketch placeholder marks are NEVER shipped art (icon convention).
- Status-home rule: exactly TWO elapsed-time homes (header strip in view + floating
  chip on scroll-away) — any third is a bug factory.
- Clamp fade must match the surface it sits on (the bubble gradient), or the fade
  reads as a rendering glitch.

## What to Avoid

- Per-provider or hand-drawn logo art; per-surface logo forks.
- A third elapsed/status surface anywhere in the chat column.
- Clamping assistant answers with the user-bubble clamp.
- Imperceptible variant deltas — if the operator can't feel the difference in a
  sketch, don't ship the extra mechanism (the 049-B lesson).

## Origin

Synthesized from sketches: 048, 049, 050 (Phase 128, 2026-06-27; adversarial
design-fidelity workflow `wf_def489d0-8e2`; real logos swapped in post-review).
Source files: sources/048-cross-provider-tool-card/ (incl. logos/), sources/049-chat-area-reclaim/,
sources/050-long-prompt-readmore/
