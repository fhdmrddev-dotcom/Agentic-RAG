# Phase 128 Sketch Grounding — Chat Tool-Card Unification + Chat-Area Reclaim

**For sketches 048–050.** Read this before building. These sketches **refine the
LOCKED chat tool-card frame** (sketches 014/015/016, Phase 095) — they are NOT a new
frame. Mirror the existing language; change only what Phase 128 changes.

---

## The phase in one line

One honest, unified, space-efficient chat surface across **every** provider — the tool
card becomes the single canonical place for live run info, it reads identically on all
providers, redundant chrome is removed, and every pixel of the chat area earns its place.

5 bundled requirements → 3 sketches:

| Sketch | Reqs | Surface |
|---|---|---|
| **048 cross-provider-tool-card** | TDP-02 + CTC-01 + CTC-02 | the tool-card **header** (provider logo + canonical layout) + the live preparing-description |
| **049 chat-area-reclaim** | CTC-03 | remove the redundant sticky composer timer; before/after of the 3 elapsed surfaces |
| **050 long-prompt-readmore** | CTC-04 | user-prompt clamp + "Read more" expander |

---

## The LOCKED design language (do not re-invent)

- **Theme:** Aether Deep Midnight. Link `../themes/default.css`. `<html lang="en" class="dark">`.
  Use the CSS variables ONLY (`--color-bg/-surface/-border/-text/-text-muted/-text-dim/
  -primary/-primary-dim/-primary-glow/-success/-warning/-danger/-accent-violet`,
  `--font-sans/-headline/-mono`, `--space-*`, `--radius-sm|md|lg|full`, `--shadow-*`,
  `--ease-out`, `--dur-fast|base|slow`). Never hardcode hex outside an SVG glyph.
- **House chrome is already in default.css — REUSE the classes, don't redefine:**
  `.sketch-toolbar` (fixed bottom-right utility bar), `.variant-nav` + `.variant-tab`
  (+ `.variant-tab.active`, `.variant-tab .star` for the ★ winner), `.progress-bar`,
  `.scrollbar-thin`, `.mono/.headline/.text-muted/.text-dim`.
- **Motion vocab (keyframes already defined):** `brandPulse` (1.5s, active avatar),
  `pulseGlow` (active rail node), `dotBounce` (status pill dot), `progressShimmer`
  (active run band), `fadeSlideUp` (new content), `toolSlideIn` (tool rows),
  `checkPop` (completion). **No decorative spin.**
- **The locked run-frame anatomy** (from sketch 014, mirrors `RunCard.tsx`):
  ```
  .run-frame (.active when streaming → primary border + glow)
    .run-header  (sticky; avatar + [title + run-sub + status-strip] + fileCount + spinner)
    .run-progress  (shimmer band, only while active)
    .run-body  (the step rail — borderless, step-numbered status nodes)
  ```
- **The run-sub line is REAL:** `{provider} · {model} · turn N` — `message.provider` and
  `message.model` are already threaded through the wire (Plan 095.1-03 D-04). The data
  exists; 128 only changes how the header AVATAR and preparing-description render.
- **The status strip** (`.status-strip`): `⏱ {elapsed} · Step {N} · {activity verb}`,
  mono, pill-shaped, never vanishes (elapsed derives from a stable start-ts; freezes only
  on a true terminal). `.done` modifier = green when finished. This is the canonical
  always-honest surface. Two placements: header (in view) + floating chip (scroll-away).

## House honesty convention (load-bearing)

When a surface needs a wire field or asset that **does not exist yet**, mark it with a
small violet "net-new" flag so the operator never mistakes a mockup for shipped reality.
Use the accent-violet token. Example chip:
`<span class="nn-flag">net-new</span>` styled with `--color-accent-violet`, ~10px mono,
uppercase, subtle. Anything REAL (already wired) needs no flag.

---

## The REAL "before" each sketch changes

### CTC-01 — provider logo in the header (sketch 048)
- TODAY (`RunCard.tsx:280`): the header avatar is a generic gradient **brand-pulse dot**
  with a `Bot` glyph — IDENTICAL for every provider. `animate-brandPulse` while streaming.
- CHANGE: replace that dot with the **actual provider's logo**, per-provider.
- **HONESTY: no provider-logo assets exist anywhere in the repo** (only hero.png /
  react.svg / vite.svg). The logos are **net-new** — flag them. `message.provider` IS
  real (already threaded), so the *routing* data is there; only the art is net-new.

### TDP-02 — live description before tool_start (sketch 048)
- TODAY: a tool's card exists during the `status === "preparing"` window, but the agent's
  own `description` ("about to do X") doesn't surface until the `tool_start` event fires —
  so during the prep gap the user sees a tool name but not the intent.
- CHANGE: the `description` **streams into the card during the preparing window, BEFORE
  tool_start**, closing the prep-gap blind spot.
- Real lifecycle to show: `preparing` → `tool_start` → `running` → `done`. The description
  is present from `preparing` onward. `tc.args.description` is the field (real).

### CTC-02 — unified cross-provider card (sketch 048)
- The tool card = the single canonical, COMPLETE surface for live run info: status,
  elapsed, step count, file count, description. It must read **identically across all 8
  providers** with no per-provider gaps. (Provider-docs-first / SC#10: the operator must be
  able to FEEL uniform coverage before CTC-03 leans on it.)
- The 8 providers (real `MODEL_CAPABILITIES` values): **openai, anthropic, google,
  deepseek, moonshot, zhipu, minimax, openrouter**.

### CTC-03 — remove the redundant sticky composer timer (sketch 049)
- There are **THREE elapsed surfaces** today:
  1. `RunStatusStrip` (header placement) in `RunCard.tsx` — the canonical 095 one. **KEEP.**
  2. `RunStatusStrip` (floating "↓ Jump to live" chip) in `MessageList.tsx` — the 095
     hybrid home #2, appears on scroll-away. **KEEP.**
  3. `StickyTimerBar` in `ChatArea.tsx:517` — an OLD Phase 076.1 D-03 surface (a separate
     component: `Loader2` spinner + `{time}` + `Step {N}` + `{N} files` + `{description}`),
     sitting above the composer, OUTSIDE the scroll area. **REMOVE this one.**
- Why remove #3: it duplicates #1+#2 and is the motivating bug — "today inconsistent across
  providers, shows for some / vanishes for others." Its job (always-visible status) is
  already covered by the header strip (in view) + floating chip (scrolled away).
- **GATED on CTC-02 holding first** — only remove once the card is verifiably canonical.
- Pure subtraction of an old surface; no net-new wire. The win is reclaimed chat-area space
  + one honest status source instead of three.

### CTC-04 — long user prompt → clamped preview + Read more (sketch 050)
- TODAY (`MessageItem.tsx:205`): a user message renders full-height —
  `<p class="whitespace-pre-wrap break-words">{message.content}</p>` inside a right-aligned
  `gradient-primary` bubble, `max-w-[70%]`, with a `User` avatar to its right, rounded
  `rounded-2xl rounded-br-md`. A pasted 600-word spec renders at full height and shoves the
  conversation down.
- CHANGE: long prompts collapse to a clamped preview + a "Read more" expander; short
  prompts render unchanged.
- **Scope: USER prompts ONLY** (assistant answers already have their own preview/expand
  path — out of scope). Preserve the bubble shape, right-alignment, and `pre-wrap`.

---

## Real content to use (no lorem ipsum)

- **Provider · model · turn sublines:** `anthropic · claude-opus-4-7 · turn 1` ·
  `openai · gpt-5.4 · turn 1` · `google · gemini-3.1-pro-preview · turn 2` ·
  `deepseek · deepseek-r1 · turn 1` · `moonshot · kimi-k2.6 · turn 1` ·
  `zhipu · glm-5.1 · turn 1` · `minimax · minimax-m3 · turn 1` ·
  `openrouter · deepseek/deepseek-r1 · turn 1`.
- **Real tool names + resting essence strings** (`{step#} {icon} {tool} → {result}`):
  - `🔍 search_documents → Found 14 chunks in "thesis.pdf" (avg 0.61)`
  - `📄 read_file → Read board_minutes_q3.md (1,204 lines)`
  - `🐍 execute_code → Executed 22 lines → chart_revenue.png (exit 0, 2.1s)`
  - `🌐 web_search → 6 results for "FY25 SaaS retention benchmarks"`
  - `✅ write_todos → 4 todos (2 done)`
- **Real preparing descriptions** (`tc.args.description`, present from the prep window):
  - `Searching the knowledge base for Q3 revenue figures`
  - `Writing a Python script to chart the revenue trend`
  - `Reading the board minutes to extract the retention number`
- **Status strip live:** `⏱ 3m12s · Step 5 · Running code…`
- **A realistic long user prompt (for 050):** a ~150–600 word pasted analysis request /
  spec (e.g. "Here is our Q3 board deck outline. For each section, pull the supporting
  figures from the knowledge base, then …" continuing for many lines).

---

## Sketch mechanics (every sketch)

- `index.html` linking `../themes/default.css`, plus a per-sketch `<style>` block for the
  surfaces this sketch introduces (reuse theme tokens).
- **2–3 variant tabs** via `.variant-nav` / `.variant-tab` (sticky top). Each variant is a
  `<div class="variant">` toggled by a `showVariant()` JS fn. Label tabs clearly
  (`A: Real brand marks`, etc.). Mark the winner later with `★` (leave unmarked for now).
- The shared `.sketch-toolbar` (bottom-right): a theme `<select>` (Default) + viewport
  buttons (Phone 400 / Tablet 720 / Desktop 860) that set a `max-width` on the stage.
- **Make it ALIVE** (sketch-interactivity rules): every interactive element responds.
  048 should cycle the preparing→running→done lifecycle and let you flip provider;
  049 should toggle before/after + scroll to feel the floating chip; 050 should expand/
  collapse Read-more and cycle prompt length. Use vanilla inline JS, no frameworks.
- Real-ish content from the section above. Right-aligned user bubbles, left-aligned run
  frames — match the real chat layout.
- Must render **headlessly clean** (no broken HTML/JS, no console errors).

## README.md (every sketch)

Frontmatter: `sketch`, `name`, `question`, `winner: null`, `tags`. Body: Design Question ·
How to View · Variants (A/B/C one-liners) · What to Look For · a **Build Handover** section
(reuse-vs-net-new: which real files/components this maps to, what is net-new, the honesty
flags). Name the real files: `RunCard.tsx`, `ToolCallPanel.tsx`, `RunStatusStrip.tsx`,
`MessageList.tsx`, `ChatArea.tsx` (`StickyTimerBar`), `MessageItem.tsx`.

## Acceptance bar (the standard every variant is judged against)

The **long execution in progress** moment — 30+ seconds into a multi-tool run, across
providers. Can the user instantly read what the agent did, what it's doing, which provider
is running, and trust status is still honest? Plus: does the card read **identically** on
all 8 providers (the CTC-02 uniformity proof)?
