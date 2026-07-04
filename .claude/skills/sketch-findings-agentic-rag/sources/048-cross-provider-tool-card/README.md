---
sketch: 048
name: cross-provider-tool-card
question: What does the unified tool-card header look like across all 8 providers — the provider logo (replacing the brand-pulse dot) + the live "about to…" description shown BEFORE the tool starts + one canonical layout every provider fills identically?
winner: "A"
tags: [phase-128, tool-card, header, provider-logo, ctc-01, ctc-02, tdp-02, cross-provider, G-5]
---

# Sketch 048 — Cross-Provider Tool Card

Refines the LOCKED chat tool-card frame (sketches 014/015/016, Phase 095). This is
NOT a new frame — it changes only the header **avatar** (provider logo), surfaces the
agent's **preparing description** earlier, and proves the card reads **identically**
across all 8 providers. Bundles **TDP-02 + CTC-01 + CTC-02**.

## Design Question

The tool card is becoming the single canonical place for live run info. Three things
have to land at once:

1. **CTC-01** — the header avatar (today a generic gradient brand-pulse `Bot` dot,
   `RunCard.tsx:280`, identical for every provider) is replaced by the **actual
   provider's logo**, per-provider, on a **per-provider tinted backing** (OpenAI teal,
   Anthropic clay, Google blue …) so the avatar carries provider identity by colour as
   well as glyph — not the single indigo/violet gradient. The `brandPulse` ring stays
   while streaming.
2. **TDP-02** — the agent's own preparing description (`tc.args.description`, e.g.
   "Searching the knowledge base for Q3 revenue figures") appears **during the
   preparing window, BEFORE `tool_start` fires** — closing the prep-gap blind spot.
3. **CTC-02** — the card reads **byte-identically across all 8 providers**; the only
   thing that differs is the logo.

The genuine fork between variants is the **logo treatment**.

## How to View

Open `index.html` (links `../themes/default.css`). Use the **variant tabs** (top) to
switch logo treatment, and the **toolbar** (bottom-right) for theme + Phone/Tablet/
Desktop viewport widths.

Each variant has two live surfaces:

- **Live streaming run** — a 5-step rail with the header strip live. Use the
  **lifecycle cycler** (`▶ Advance step`) to walk one tool through
  `preparing → tool_start → running → done` and FEEL the "about to…" description
  appear during the prep gap (TDP-02). The lifecycle pips light up to show the phase.
  Use the **provider flipper** to swap which logo the live header shows.
- **Cross-provider matrix** — the same running header rendered stacked for all 8 real
  providers (openai · anthropic · google · deepseek · moonshot · zhipu · minimax ·
  openrouter), each with its real `{provider} · {model} · turn N` subline. The CTC-02
  uniformity proof: only the logo differs.

## Variants

- **A — Real brand marks.** Each provider's **real official logo** (the open
  `@lobehub/icons` brand-colour marks) replacing the avatar. Most recognizable; the
  assets are net-new to the repo.
- **B — Unified monochrome glyph, tinted per provider.** ONE consistent chip shape with
  a simple monochrome mark, tinted with a per-provider accent. Calmest, perfectly
  uniform, no trademark risk — trades instant brand recognition.
- **C — Logo + provider wordmark chip.** The logo PLUS a small mono wordmark naming the
  provider, so the provider is named as well as shown.

## What to Look For

- Does the **avatar logo** make "which provider is running" instantly readable without
  hurting the calm header rhythm? (A = recognizable, B = calmest/uniform, C = named.)
- During `preparing`/`tool_start`, does the **"about to… {description}"** line read as
  honest intent rather than noise? Does it disappear cleanly once the result lands?
- In the **matrix**, can you confirm status / elapsed / Step N / file count / layout are
  identical for all 8 — that nothing is missing for any provider (the SC#10 felt-
  coverage bar)? The matrix renders in a **calm static state** (no avatar pulse, no
  bouncing dot) so the rows are byte-comparable at a glance; only the live run frame
  animates.
- The acceptance moment: 30+ seconds into a multi-tool run — can you read what the agent
  did, what it's doing now, which provider is running, and trust the status is honest?

## Build Handover

### Maps to (reuse — already shipped)

| Surface in this sketch | Real file / component | Note |
|---|---|---|
| `.run-frame` / `.run-header` / `.run-progress` / `.run-body` | `RunCard.tsx` | The locked 095 anatomy. Only the avatar + preparing-desc render change. |
| The header avatar dot | `RunCard.tsx:280` (`gradient-primary` + `Bot`, `animate-brandPulse`) | CTC-01 swaps the glyph for the provider logo on a per-provider tinted backing; keep the ring + `animate-brandPulse` while streaming. |
| The header "still working" cue | (header right edge) | An approved-motion `brandPulse` dot — **NOT a spinner**. The 095 motion vocab forbids decorative spin; the progress shimmer band + strip dot already carry activity, so the dot is a quiet secondary cue, and it is suppressed entirely in the uniformity matrix. |
| `.run-sub` (`{provider} · {model} · turn N`) | `RunCard.tsx:246-248` | **REAL — no flag.** `message.provider`/`message.model` already threaded (Plan 095.1-03 D-04). `turnNumber` is the stable `1`. |
| `.status-strip` (`⏱ elapsed · Step N · verb`) | `RunStatusStrip.tsx` (header placement) | Reused as-is; single source for elapsed/step/verb. |
| The preparing description | `tc.args.description` | **REAL field** — `StickyTimerBar` already reads it (`ChatArea.tsx:553`). TDP-02 changes only WHEN it shows: from the `preparing` window onward, before `tool_start`. The render hook is `ToolCallPanel.tsx` (the `status === "preparing"` branch, ~:819, ~:891-942). |
| The step rail / node states | `ToolCallPanel.tsx` (`nodeState` from `tc.status`, ~:483-491) | The `preparing`/`running` tool is the active node; the rail anatomy is the locked 014 winner. |

### Net-new (honesty-flagged in the sketch)

- **Provider logo assets** — `net-new` to the repo, but **the REAL official marks** (no
  longer approximations). They come from the open [`@lobehub/icons`](https://github.com/lobehub/lobe-icons)
  set and are stored in `./logos/` as `<provider>-color.svg` (brand-colour mark) +
  `<provider>-mono.svg` (monochrome, `fill="currentColor"` so it tints via CSS `color`)
  for all 8 providers. The provider→mark mapping is baked into the filenames:
  `anthropic-*` = the **Claude** mark, `moonshot-*` = the **Kimi** mark, `google-*` =
  the **Gemini** mark. No logo files ship in the repo today (only `hero.png` /
  `react.svg` / `vite.svg`), so they are still net-new **to the repo** — but they are
  the real logos, not drawn.
  - **Build options:** add the `@lobehub/icons` package and render its React components
    (`OpenAI`, `Claude`, `Gemini`, `DeepSeek`, `Kimi`, `Zhipu`, `Minimax`,
    `OpenRouter` — color or mono variants), **or** bundle these static SVGs straight from
    `./logos/`. Variant B uses the `-mono` mark tinted via `currentColor`; variants A/C
    use the `-color` mark.
  - **Mapping:** `message.provider` → logo is the one-line lookup
    (`PROVIDER_LOGOS[provider]` / the chosen `@lobehub/icons` component). The *routing
    data* (`message.provider`) is already real; only the **asset** is net-new.
- Everything else (subline, strip, elapsed, step count, file count, description text) is
  already wired — **no flag**.

### Honesty flags present

- Violet `net-new` chip on the provider-logo assets in every variant's legend — the
  marks are the **real official `@lobehub/icons`** logos but still net-new TO THE REPO
  (variant B flags the per-provider monochrome marks tinted via `currentColor`).
- Green `✓ real` notes calling out `message.provider`/`message.model`,
  `tc.args.description`, and the `RunStatusStrip` reuse — so the operator never mistakes
  the wired data for net-new.

### Risk / G-5

HIGH — touches the G-5 hot files `RunCard.tsx` and `ToolCallPanel.tsx`. This is the
canonical surface that **CTC-03** (sketch 049, the sticky-timer removal) then depends on:
CTC-03 only removes the redundant `StickyTimerBar` once this card is verifiably the one
honest, complete, cross-provider source.
